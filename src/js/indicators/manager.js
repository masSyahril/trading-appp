/*
 * IndicatorManager (indicator system v2) - owns every indicator on the chart:
 * the ones on the price chart and the ones in panes below it, which are
 * native panes of the same lightweight-charts v5 chart (one chart, one time
 * scale and crosshair - no separate panel charts and no sync code).
 *
 * Each instance is computed once per data load (and only the edited one on
 * a change), drawn, kept in the legend, and the whole setup is saved to
 * localStorage. The same indicator can be added any number of times, and any
 * instance can move between the price chart and a pane.
 *
 * Declarative registry entries are drawn from their `outputs`; an older
 * MultiIndicatorSystem definition without an entry (`legacy`) runs its own
 * render() against a small adapter that creates its series in the right pane.
 */
(function () {
  'use strict';
  const NS = window.TFIndicators;
  const LWC = window.LightweightCharts;
  const MAIN = 'main';
  const LINE_STYLE = { solid: 0, dotted: 1, dashed: 2 };
  const LINE_STYLE_NAME = { 0: 'solid', 1: 'dotted', 2: 'dashed', 3: 'dashed', 4: 'dotted' };
  const STEP_LINE = LWC.LineType ? LWC.LineType.WithSteps : 1;
  const AUTO_COLORS = ['#34d399', '#f97316', '#a78bfa', '#fb7185', '#38bdf8', '#fbbf24', '#e879f9', '#2dd4bf'];
  // An indicator pane's price scale. The chart's right scale has no margins so
  // the candles fill the price pane, and a new pane's scale inherits that - its
  // lines would touch the pane edges, run under the legend and cut the top and
  // bottom axis labels in half. These are the library's own defaults.
  const PANE_SCALE_MARGINS = { top: 0.2, bottom: 0.1 };

  let uidCounter = 0;
  const newUid = () => `i${Date.now().toString(36)}${(uidCounter++).toString(36)}`;
  const finite = (v) => v != null && Number.isFinite(v);
  // lightweight-charts v5 only treats a point as blank when `value` is undefined.
  const clean = (p) => (p && typeof p === 'object' && 'value' in p && !finite(p.value)) ? { time: p.time } : p;
  function lastPoint(points) {
    if (!Array.isArray(points)) return null;
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      if (p && finite(p.value)) return { value: p.value, color: p.color };
    }
    return null;
  }
  // Autoscale that keeps an indicator's fixed levels (70 / 30 ...) in view.
  const withLevels = (levels) => (original) => {
    const r = original();
    if (!r || !r.priceRange) return r;
    const values = levels.map(l => l.value);
    return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...values), maxValue: Math.max(r.priceRange.maxValue, ...values) } };
  };

  class IndicatorManager {
    constructor({ chart, host, mainLegendHost, storageKey, onLayoutChange }) {
      this.chart = chart;
      this.host = host;
      this.storageKey = storageKey;
      this.onLayoutChange = onLayoutChange || (() => {});
      this.instances = [];
      this.panes = [{ id: MAIN, api: chart.panes()[0] }];
      // Keep the price pane even while it's briefly empty (switching chart style
      // removes the candle series before adding the new one) - otherwise the
      // library drops it and the next pane down becomes pane 0.
      try { this.panes[0].api.setPreserveEmptyPane(true); } catch (e) {}
      this.paneCounter = 0;
      this.candles = [];
      this.listeners = new Set();
      this._batch = 0;
      this.legend = new NS.Legend(this, { host, mainHost: mainLegendHost });
      chart.subscribeCrosshairMove((param) => this.legend.updateValues(param));
      // Pane separators are dragged inside the library; save the new heights afterwards.
      host.addEventListener('pointerup', () => setTimeout(() => this._saveIfResized(), 50));
      // Light/dark switch (assets/theme/theme.js), in this tab and in others.
      this._onAppearance = () => this.refreshColors();
      window.addEventListener('tl:appearancechange', this._onAppearance);
      window.addEventListener('storage', (e) => { if (e.key === 'tl-appearance') this._onAppearance(); });
      this._syncPaneObservers();
    }

    // ─── Public API ────────────────────────────────────────────────────────
    add(id, { pane, params, styles, visible = true, uid } = {}) {
      const def = NS.registry.get(id);
      if (!def) return null;
      const inst = {
        uid: uid || newUid(),
        id,
        def,
        params: { ...NS.registry.defaultParams(def), ...(params || {}) },
        paneId: pane || (def.placement === 'chart' ? MAIN : 'new'),
        visible,
        styles: styles || this._autoStyles(def),
        series: [],
        seriesMap: new Map(),
        result: null,
        error: null,
      };
      if (inst.paneId === 'new' || !this._pane(inst.paneId)) inst.paneId = this._createPane();
      this.instances.push(inst);
      this._draw(inst);
      this._changed();
      return inst.uid;
    }

    remove(uid) {
      const inst = this._get(uid);
      if (!inst) return;
      this._destroySeries(inst);
      this.instances = this.instances.filter(i => i !== inst);
      this._dropPaneIfEmpty(inst.paneId);
      this._changed();
    }

    update(uid, { params, styles, visible } = {}) {
      const inst = this._get(uid);
      if (!inst) return;
      if (params) {
        inst.params = { ...inst.params, ...params };
        this._destroySeries(inst);
        this._draw(inst);
      }
      if (styles) inst.styles = styles;
      if (visible != null) inst.visible = visible;
      if (styles || visible != null) this._applyStyles(inst);
      this._changed();
    }

    // target: 'main' (price chart) | 'new' (a new pane) | an existing pane id
    move(uid, target) {
      const inst = this._get(uid);
      if (!inst) return;
      const from = inst.paneId;
      const to = target === 'new' ? this._createPane() : target;
      if (!this._pane(to) || to === from) return;
      this._destroySeries(inst);
      inst.paneId = to;
      this._draw(inst);
      this._dropPaneIfEmpty(from);
      this._changed();
    }

    // Moves a pane up (-1) or down (+1); the price pane always stays on top.
    movePane(paneId, delta) {
      const i = this.panes.findIndex(p => p.id === paneId);
      const j = i + delta;
      if (i <= 0 || j <= 0 || j >= this.panes.length) return;
      this.chart.swapPanes(i, j);
      [this.panes[i], this.panes[j]] = [this.panes[j], this.panes[i]];
      this._changed();
    }

    setData(candles) {
      this.candles = Array.isArray(candles) ? candles : [];
      this.instances.forEach(inst => this._draw(inst));
      this.legend.render();
    }

    clearData() {
      this.candles = [];
      this.instances.forEach(inst => {
        inst.series.forEach(s => { try { s.api.setData([]); } catch (e) {} s.last = null; });
        inst.result = null;
      });
      this.legend.render();
    }

    openPicker() { NS.picker.open(this); }
    onChange(cb) { if (typeof cb === 'function') this.listeners.add(cb); }
    label(inst) { return NS.registry.label(inst.def, inst.params); }
    mainPaneHeight() { try { return this.panes[0].api.getHeight(); } catch (e) { return null; } }

    // The lines the legend lists values for.
    legendSeries(inst) {
      if (inst.def.legacy) {
        const titled = inst.series.filter(s => s.title);
        return (titled.length ? titled : inst.series).filter(s => this._styleFor(inst, s).visible !== false);
      }
      return inst.series.filter(s => s.output.lastValue !== false && this._styleFor(inst, s).visible !== false);
    }

    // Summary numbers shown after the legend values (e.g. accumulated return).
    stats(inst) {
      if (!inst.def.stats || !inst.result) return [];
      return inst.def.stats.map(st => {
        let value = null;
        try { value = st.value(inst.result); } catch (e) {}
        return { label: st.label, value, digits: st.digits, suffix: st.suffix, color: typeof st.color === 'function' ? st.color(value) : st.color };
      });
    }

    // Everything the settings dialog can restyle, with current values.
    styleTargets(inst) {
      return inst.series.map(s => {
        const st = this._styleFor(inst, s);
        return {
          key: s.key,
          title: s.title || s.key,
          type: s.type,
          perPointColor: !!s.perPointColor,
          visible: st.visible !== false,
          color: st.color,
          lineWidth: st.lineWidth || 2,
          lineStyle: st.lineStyle || 'solid',
        };
      });
    }

    // ─── Persistence ───────────────────────────────────────────────────────
    serialize() {
      return {
        v: 1,
        mainStretch: this._stretch(this.panes[0]),
        panes: this.panes.slice(1).map(p => ({ id: p.id, stretch: this._stretch(p) })),
        instances: this.instances.map(i => ({ uid: i.uid, id: i.id, params: i.params, pane: i.paneId, visible: i.visible, styles: i.styles })),
      };
    }

    // Rebuilds a saved setup; false if there was nothing usable to restore.
    restore(state) {
      if (!state || !Array.isArray(state.instances)) return false;
      this._batch++;
      (state.panes || []).forEach(p => {
        if (!p || !p.id || this._pane(p.id)) return;
        this.panes.push({ id: p.id, api: this._addPane(), savedStretch: p.stretch });
        this.paneCounter = Math.max(this.paneCounter, parseInt(String(p.id).slice(1), 10) || 0);
      });
      state.instances.forEach(s => {
        if (!s || !NS.registry.has(s.id)) return;
        this.add(s.id, { uid: s.uid, params: s.params, styles: s.styles, visible: s.visible !== false, pane: s.pane === MAIN || this._pane(s.pane) ? s.pane : undefined });
      });
      this.panes.slice(1).forEach(p => this._dropPaneIfEmpty(p.id));
      this._batch--;
      this._layoutPanes();
      try {
        if (state.mainStretch) this.panes[0].api.setStretchFactor(state.mainStretch);
        this.panes.slice(1).forEach(p => { if (p.savedStretch) p.api.setStretchFactor(p.savedStretch); });
      } catch (e) {}
      this._changed();
      return this.instances.length > 0;
    }

    // One-off conversion of the old separate systems' saved selections.
    migrateLegacy({ overlays, overlayParams, panels } = {}) {
      const map = NS.LEGACY_OVERLAY_IDS || {};
      this._batch++;
      (overlays || []).forEach(oldId => {
        const m = map[oldId];
        if (!m || !NS.registry.has(m[0])) return;
        const [id, key1, key2, color] = m;
        const params = {};
        if (key1 && overlayParams && overlayParams[oldId] != null) params[key1] = overlayParams[oldId];
        if (key2 && overlayParams && overlayParams[oldId + '_2'] != null) params[key2] = overlayParams[oldId + '_2'];
        this.add(id, { params, styles: color ? { value: { color } } : undefined, pane: MAIN });
      });
      (panels || []).forEach(p => {
        if (p && NS.registry.has(p.indicatorType)) this.add(p.indicatorType, { params: p.params || undefined, pane: 'new' });
      });
      this._batch--;
      this._layoutPanes();
      this._changed();
      return this.instances.length > 0;
    }

    save() {
      if (!this.storageKey) return;
      try { localStorage.setItem(this.storageKey, JSON.stringify(this.serialize())); } catch (e) {}
    }

    // ─── Drawing ───────────────────────────────────────────────────────────
    _draw(inst) {
      inst.error = null;
      if (!this.candles.length) return;
      try {
        if (inst.def.legacy) this._drawLegacy(inst);
        else this._drawDeclarative(inst);
      } catch (e) {
        inst.error = (e && e.message) || String(e);
      }
      this._applyStyles(inst);
    }

    _drawDeclarative(inst) {
      const def = inst.def;
      if (this.candles.length < (def.minBars || 1)) {
        inst.series.forEach(s => { s.api.setData([]); s.last = null; });
        inst.result = null;
        return;
      }
      const { series, colors, raw } = NS.registry.evaluate(def, this.candles, inst.params);
      inst.result = raw;
      def.outputs.forEach(out => {
        const s = inst.series.find(x => x.key === out.key) || this._createOutputSeries(inst, out);
        const points = NS.registry.toPoints(out, series[out.key], colors[out.key], this.candles);
        s.api.setData(points);
        s.last = lastPoint(points);
      });
      if (def.levels.length && !inst.levelLines && inst.series[0]) {
        inst.levelLines = def.levels.map(l => inst.series[0].api.createPriceLine({
          price: l.value, color: l.color || '#64748b', lineWidth: 1, lineStyle: LINE_STYLE[l.lineStyle || 'dashed'], axisLabelVisible: false,
        }));
      }
    }

    _createOutputSeries(inst, out) {
      const def = inst.def;
      const type = out.type === 'histogram' ? LWC.HistogramSeries : out.type === 'area' ? LWC.AreaSeries : LWC.LineSeries;
      const base = {
        priceLineVisible: false,
        lastValueVisible: out.lastValue !== false,
        title: out.axisTitle ? out.key : '',
        // A second scale on the pane's left; on the price chart the whole
        // indicator gets its own overlay scale instead (_scaleOptions).
        ...(out.scale === 'left' && inst.paneId !== MAIN ? { priceScaleId: 'left' } : {}),
        ...this._scaleOptions(inst),
      };
      if (out.priceFormat) base.priceFormat = out.priceFormat;
      if (def.levels.length && !inst.series.length) base.autoscaleInfoProvider = withLevels(def.levels);
      const drawColor = NS.themeColor(out.color);
      const opts = out.type === 'histogram'
        ? { ...base, color: drawColor }
        : out.type === 'area'
          ? { ...base, lineColor: drawColor, topColor: drawColor + '55', bottomColor: drawColor + '05', lineWidth: out.lineWidth || 2, crosshairMarkerVisible: false }
          : {
            ...base,
            color: drawColor,
            lineWidth: out.lineWidth || 2,
            lineStyle: LINE_STYLE[out.lineStyle || 'solid'],
            crosshairMarkerVisible: false,
            ...(out.lineType === 'step' ? { lineType: STEP_LINE } : {}),
          };
      const api = this.chart.addSeries(type, opts, this._paneIndex(inst.paneId));
      const s = {
        key: out.key,
        title: out.title || (def.outputs.length > 1 ? out.key : ''),
        api,
        type: out.type || 'line',
        output: out,
        perPointColor: out.type === 'histogram' && !!(out.colorKey || out.signColors),
        base: { color: out.color, lineWidth: out.lineWidth || 2, lineStyle: out.lineStyle || 'solid' },
        last: null,
      };
      inst.series.push(s);
      return s;
    }

    _drawLegacy(inst) {
      const { system, def } = inst.def.legacy;
      const empty = () => inst.series.forEach(s => { try { s.api.setData([]); } catch (e) {} s.last = null; });
      if (this.candles.length < (def.minPeriod || 1)) { empty(); return; }
      system.chartData = this.candles;
      const data = def.compute(this.candles, { ...inst.params });
      const nothing = data == null
        || (Array.isArray(data) && data.length === 0)
        || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0);
      if (nothing) { empty(); return; }
      def.render(this._legacyChart(inst), data, system.colors, inst.seriesMap);
      // Name each recorded series by the key the render stored it under.
      inst.seriesMap.forEach((api, key) => {
        const s = inst.series.find(x => x.api === api);
        if (s && !s.key) s.key = String(key);
      });
      inst.series.forEach((s, i) => { if (!s.key) s.key = `#${i + 1}`; });
    }

    // What a legacy render() gets as its `chart`: series land in this
    // instance's pane, and are recorded for the legend and styling.
    _legacyChart(inst) {
      const chart = this.chart;
      const paneIndex = () => this._paneIndex(inst.paneId);
      const scale = this._scaleOptions(inst);
      const add = (type, kind) => (opts = {}) => {
        const api = chart.addSeries(type, { ...opts, ...scale }, paneIndex());
        const s = {
          key: null,
          title: opts.title || '',
          api,
          type: kind,
          perPointColor: false,
          // A render that creates a series hidden on purpose keeps it hidden.
          base: { color: opts.color || opts.lineColor, lineWidth: opts.lineWidth || 2, lineStyle: LINE_STYLE_NAME[opts.lineStyle] || 'solid', visible: opts.visible === false ? false : undefined },
          last: null,
        };
        const setData = api.setData.bind(api);
        api.setData = (data) => {
          const points = Array.isArray(data) ? data.map(clean) : data;
          s.perPointColor = Array.isArray(points) && points.some(p => p && p.color);
          s.last = lastPoint(points);
          setData(points);
        };
        const update = api.update.bind(api);
        api.update = (bar, ...rest) => update(clean(bar), ...rest);
        inst.series.push(s);
        return api;
      };
      return {
        addLineSeries: add(LWC.LineSeries, 'line'),
        addHistogramSeries: add(LWC.HistogramSeries, 'histogram'),
        addAreaSeries: add(LWC.AreaSeries, 'line'),
        addBaselineSeries: add(LWC.BaselineSeries, 'line'),
        addCandlestickSeries: add(LWC.CandlestickSeries, 'bars'),
        addBarSeries: add(LWC.BarSeries, 'bars'),
        removeSeries: (api) => { try { chart.removeSeries(api); } catch (e) {} inst.series = inst.series.filter(s => s.api !== api); },
        timeScale: () => chart.timeScale(),
        priceScale: (id) => chart.priceScale(id, paneIndex()),
        applyOptions: (o) => {
          ['left', 'right'].forEach(side => {
            const k = side + 'PriceScale';
            if (o && o[k]) { try { chart.priceScale(side, paneIndex()).applyOptions(o[k]); } catch (e) {} }
          });
        },
      };
    }

    // A pane-type indicator moved onto the price chart gets its own hidden
    // price scale in the lower part of the pane, so it can't squash the candles.
    _scaleOptions(inst) {
      if (inst.paneId !== MAIN || inst.def.placement === 'chart') return {};
      const id = `tfi-${inst.uid}`;
      setTimeout(() => { try { this.chart.priceScale(id, 0).applyOptions({ scaleMargins: { top: 0.65, bottom: 0.02 } }); } catch (e) {} }, 0);
      return { priceScaleId: id };
    }

    _styleFor(inst, s) {
      // The definition's colour is the dark-theme one; map it for the current
      // appearance first, so a user's own colour (applied after) still wins.
      const base = { ...s.base, color: NS.themeColor(s.base.color) };
      return { ...base, ...((inst.styles && inst.styles[s.key]) || {}) };
    }

    // The light/dark toggle swaps the pane background under lines whose colours
    // were picked for the other one, so re-push every series' colour.
    refreshColors() {
      this.instances.forEach(inst => { try { this._applyStyles(inst); } catch (e) {} });
      try { this.legend.render(); } catch (e) {}
    }

    _applyStyles(inst) {
      inst.series.forEach(s => {
        const st = this._styleFor(inst, s);
        const opts = { visible: inst.visible && st.visible !== false };
        if (s.type === 'line') {
          if (st.color) opts.color = st.color;
          if (st.lineWidth) opts.lineWidth = st.lineWidth;
          opts.lineStyle = LINE_STYLE[st.lineStyle] != null ? LINE_STYLE[st.lineStyle] : 0;
        } else if (s.type === 'histogram' && !s.perPointColor && st.color) {
          opts.color = st.color;
        }
        try { s.api.applyOptions(opts); } catch (e) {}
        // The legend shows values in the line's colour.
        s.color = st.color;
      });
    }

    // A repeat of a single-line price-chart indicator gets the next colour.
    _autoStyles(def) {
      if (def.placement !== 'chart' || def.outputs.length !== 1) return {};
      const n = this.instances.filter(i => i.id === def.id).length;
      if (!n) return {};
      const base = def.outputs[0].color;
      const palette = AUTO_COLORS.filter(c => c !== base);
      return { [def.outputs[0].key]: { color: palette[(n - 1) % palette.length] } };
    }

    _destroySeries(inst) {
      inst.series.forEach(s => { try { this.chart.removeSeries(s.api); } catch (e) {} });
      inst.series = [];
      inst.seriesMap = new Map();
      inst.levelLines = null;
      inst.result = null;
    }

    // ─── Panes ─────────────────────────────────────────────────────────────
    _get(uid) { return this.instances.find(i => i.uid === uid); }
    _pane(id) { return this.panes.find(p => p.id === id); }
    _paneIndex(id) { const p = this._pane(id); return p ? p.api.paneIndex() : 0; }
    _stretch(p) { try { return +p.api.getStretchFactor().toFixed(3); } catch (e) { return 1; } }

    _createPane() {
      const id = `p${++this.paneCounter}`;
      this.panes.push({ id, api: this._addPane() });
      this._layoutPanes();
      return id;
    }

    _addPane() {
      const api = this.chart.addPane(true);
      try { this.chart.priceScale('right', api.paneIndex()).applyOptions({ scaleMargins: PANE_SCALE_MARGINS }); } catch (e) {}
      return api;
    }

    _dropPaneIfEmpty(paneId) {
      if (paneId === MAIN || this.instances.some(i => i.paneId === paneId)) return;
      const pane = this._pane(paneId);
      if (!pane) return;
      try { this.chart.removePane(pane.api.paneIndex()); } catch (e) {}
      this.panes = this.panes.filter(p => p !== pane);
      this._layoutPanes();
    }

    // The price pane gets ~60% of the height, the other panes share the rest.
    _layoutPanes() {
      if (this._batch) return;
      const n = this.panes.length - 1;
      try {
        this.panes[0].api.setStretchFactor(n ? Math.max(2, n * 1.5) : 1);
        this.panes.slice(1).forEach(p => p.api.setStretchFactor(1));
      } catch (e) {}
      // Pane elements only exist once the chart has laid the new pane out.
      requestAnimationFrame(() => this._syncPaneObservers());
    }

    // A pane shows its left price scale while one of its indicators draws on
    // it (an output with scale: 'left'). Only scales turned on here are turned off.
    _syncLeftScales() {
      this.panes.slice(1).forEach(p => {
        const user = this.instances.find(i => i.paneId === p.id && !i.def.legacy && i.def.outputs.some(o => o.scale === 'left'));
        if (!!user === !!p.leftScale) return;
        p.leftScale = !!user;
        try {
          this.chart.priceScale('left', p.api.paneIndex()).applyOptions(user ? { visible: true, ...(user.def.leftScale || {}) } : { visible: false });
        } catch (e) {}
      });
    }

    _syncPaneObservers() {
      if (typeof ResizeObserver === 'undefined') return;
      if (!this._ro) this._ro = new ResizeObserver(() => this._scheduleLayout());
      this._ro.disconnect();
      this._ro.observe(this.host);
      this.chart.panes().forEach(p => { const el = p.getHTMLElement(); if (el) this._ro.observe(el); });
      this._scheduleLayout();
    }

    _scheduleLayout() {
      if (this._layoutRaf) return;
      this._layoutRaf = requestAnimationFrame(() => {
        this._layoutRaf = 0;
        this.legend.position();
        try { this.onLayoutChange(); } catch (e) {}
      });
    }

    _saveIfResized() {
      const now = JSON.stringify(this.panes.map(p => this._stretch(p)));
      if (now !== this._savedStretch) { this._savedStretch = now; this.save(); }
    }

    _changed() {
      if (this._batch) return;
      this._syncLeftScales();
      this.legend.render();
      this.save();
      this._savedStretch = JSON.stringify(this.panes.map(p => this._stretch(p)));
      this._scheduleLayout();
      this.listeners.forEach(cb => { try { cb(); } catch (e) {} });
    }
  }

  NS.IndicatorManager = IndicatorManager;
})();
