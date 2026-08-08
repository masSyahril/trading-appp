/*
 * Standalone, dependency-free candlestick chart engine built directly on
 * HTML5 Canvas 2D - not a wrapper around lightweight-charts (that library
 * is what stock-app.prod.js/multi-indicator-system.js use for the other
 * four pages; this is a separate, from-scratch renderer for canvas-chart.html).
 *
 * Architecture: four stacked, transparent, same-size <canvas> elements, each
 * owning one concern so cheap-to-redraw layers never pay for expensive ones:
 *   1. base        - background, grid lines, price/time axis labels
 *   2. data        - candlesticks + volume bars
 *   3. indicator   - overlay lines (SMA/EMA) + sub-pane oscillator lines (RSI)
 *   4. interactive - crosshair, axis tags, redrawn on every mouse move
 * Layers 1-3 only redraw when data/pan/zoom/theme actually changes; layer 4
 * is the only one touched on mousemove, throttled to one paint per animation
 * frame via requestAnimationFrame (a real ~60fps cap, not a fixed timer).
 */
(function (root) {
  const THEMES = {
    light: { bg: '#FFFFFF', panel: '#F8F9FA', grid: '#F0F3FA', border: '#E0E3EB', text: '#131722', textMuted: '#787D8D', up: '#089981', down: '#F23645', accent: '#2962FF', crosshair: '#787D8D' },
    dark: { bg: '#131722', panel: '#1E222D', grid: '#1E222D', border: '#2A2E39', text: '#D1D4DC', textMuted: '#787B86', up: '#089981', down: '#F23645', accent: '#2962FF', crosshair: '#787B86' },
  };

  const PANE_GAP = 1;
  const AXIS_FONT = '11px "Roboto Mono", "JetBrains Mono", ui-monospace, monospace';

  class ChartCanvasEngine {
    constructor(container, options) {
      options = options || {};
      this.container = container;
      this.theme = THEMES[options.theme] || THEMES.light;
      this.data = [];
      this.overlays = [];
      this.subPanes = [];
      this.barSpacing = options.barSpacing || 8;
      this.minBarSpacing = 2;
      this.maxBarSpacing = 48;
      this.rightIndex = 0;
      this.startIndex = 0;
      this.endIndex = -1;
      this.hover = null;
      this.onHover = typeof options.onHover === 'function' ? options.onHover : null;

      this._dragging = false;
      this._rafFull = false;
      this._rafInteractive = false;
      this._pinchStartDist = null;

      this._buildDom();
      this._bindEvents();
      this._resizeObserver = new ResizeObserver(() => this._onResize());
      this._resizeObserver.observe(this.container);
      this._onResize();
    }

    // ─── DOM / lifecycle ────────────────────────────────────────────────
    _buildDom() {
      // Only force a positioning context if the container doesn't already
      // have one from its own CSS - checking the *computed* style, not
      // el.style.position (which only reflects an inline style="" attribute
      // and is empty even when a real stylesheet rule sets e.g.
      // position:absolute, as canvas-chart.html's #cc-canvas-container
      // does). Reading the wrong one here overwrote that absolute
      // positioning with position:relative, collapsing the container to
      // zero height (absolutely-positioned canvas children don't
      // contribute to a relative parent's auto height) and shrinking every
      // canvas to ~1x1px - the chart area rendering as fully blank.
      const computedPosition = root.getComputedStyle(this.container).position;
      if (computedPosition === 'static') {
        this.container.style.position = 'relative';
      }
      this.container.style.overflow = 'hidden';
      this.container.style.background = this.theme.bg;

      const mkCanvas = (zIndex) => {
        const c = document.createElement('canvas');
        c.style.position = 'absolute';
        c.style.inset = '0';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.zIndex = String(zIndex);
        this.container.appendChild(c);
        return c;
      };
      this.baseCanvas = mkCanvas(1);
      this.dataCanvas = mkCanvas(2);
      this.indicatorCanvas = mkCanvas(3);
      this.interactiveCanvas = mkCanvas(4);
      this.interactiveCanvas.style.cursor = 'crosshair';

      this.baseCtx = this.baseCanvas.getContext('2d');
      this.dataCtx = this.dataCanvas.getContext('2d');
      this.indicatorCtx = this.indicatorCanvas.getContext('2d');
      this.interactiveCtx = this.interactiveCanvas.getContext('2d');
    }

    destroy() {
      this._resizeObserver.disconnect();
      [this.baseCanvas, this.dataCanvas, this.indicatorCanvas, this.interactiveCanvas].forEach((c) => c.remove());
    }

    // ─── Public API ─────────────────────────────────────────────────────
    setData(data) {
      this.data = (data || []).slice().sort((a, b) => this._timeMs(a.time) - this._timeMs(b.time));
      this.rightIndex = this.data.length - 1;
      this._recomputeIndicators();
      this._computeLayout();
      this._scheduleFullRedraw();
    }

    // `series` lets one indicator draw more than one line from a single
    // compute() call - e.g. Bollinger Bands (upper/middle/lower) or MACD
    // (macd/signal/histogram). Each series entry is { key, color, lineWidth,
    // style }; `key: null` means compute() returned a plain array (the
    // common single-line case - SMA, RSI, etc.), otherwise compute() must
    // return an object and `key` names which property holds that series'
    // array. Omitting `series` entirely falls back to the single-line shape
    // implied by top-level color/lineWidth, for simple callers.
    addOverlayIndicator(cfg) {
      this.overlays = this.overlays.filter((o) => o.id !== cfg.id);
      const series = cfg.series || [{ key: null, color: cfg.color || '#2962FF', lineWidth: cfg.lineWidth || 1.5 }];
      const overlay = { id: cfg.id, label: cfg.label, params: cfg.params, compute: cfg.compute, series };
      overlay.data = overlay.compute(this.data, overlay.params);
      this.overlays.push(overlay);
      this._scheduleFullRedraw();
    }

    // `autoScale: true` computes this pane's min/max from its own visible
    // values every redraw (for unbounded indicators like CCI/ATR/MACD);
    // otherwise it uses the fixed min/max given here (for inherently bounded
    // ones like RSI/Stochastic/Williams %R, which read wrong if their scale
    // keeps jumping around).
    addSubPaneIndicator(cfg) {
      this.subPanes = this.subPanes.filter((p) => p.id !== cfg.id);
      const series = cfg.series || [{ key: null, color: cfg.color || '#2962FF', lineWidth: 1.5 }];
      const pane = {
        id: cfg.id, label: cfg.label, params: cfg.params, compute: cfg.compute, series,
        min: cfg.min != null ? cfg.min : 0,
        max: cfg.max != null ? cfg.max : 100,
        autoScale: !!cfg.autoScale,
        referenceLines: cfg.referenceLines || [],
      };
      pane.data = pane.compute(this.data, pane.params);
      this.subPanes.push(pane);
      this._computeLayout();
      this._scheduleFullRedraw();
    }

    _seriesValues(item, key) {
      if (key == null) return Array.isArray(item.data) ? item.data : [];
      return (item.data && item.data[key]) || [];
    }

    removeIndicator(id) {
      this.overlays = this.overlays.filter((o) => o.id !== id);
      const hadSubPane = this.subPanes.some((p) => p.id === id);
      this.subPanes = this.subPanes.filter((p) => p.id !== id);
      if (hadSubPane) this._computeLayout();
      this._scheduleFullRedraw();
    }

    setTheme(name) {
      this.theme = THEMES[name] || THEMES.light;
      this.container.style.background = this.theme.bg;
      this._scheduleFullRedraw();
    }

    resetView() {
      this.rightIndex = this.data.length - 1;
      this.barSpacing = 8;
      this._computeVisibleRange();
      this._scheduleFullRedraw();
    }

    // ─── Time / index / coordinate helpers ─────────────────────────────
    _timeMs(time) {
      if (typeof time === 'number') return time < 2e10 ? time * 1000 : time;
      const d = new Date(time);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    _formatTime(time) {
      const ms = this._timeMs(time);
      const d = new Date(ms);
      if (isNaN(d.getTime())) return String(time);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    _clampRightIndex(idx) {
      const n = this.data.length;
      if (!n) return 0;
      return Math.max(0, Math.min(n - 1, idx));
    }

    _indexForX(x) {
      return Math.round(this.startIndex + x / this.barSpacing - 0.5);
    }

    _xForIndex(index) {
      return (index - this.startIndex) * this.barSpacing + this.barSpacing / 2;
    }

    // ─── Layout ─────────────────────────────────────────────────────────
    _computeLayout() {
      this.priceAxisW = 64;
      this.timeAxisH = 26;
      this.plotW = Math.max(10, this.width - this.priceAxisW);
      this.plotH = Math.max(10, this.height - this.timeAxisH);

      const subCount = this.subPanes.length;
      const subRatio = subCount ? Math.min(0.55, subCount * 0.22) : 0;
      this.mainPaneH = this.plotH * (1 - subRatio);
      const subTotalH = this.plotH - this.mainPaneH;
      this.subPaneH = subCount ? (subTotalH - (subCount - 1) * PANE_GAP) / subCount : 0;

      this.volumeAreaH = this.mainPaneH * 0.2;
      this.candleAreaH = this.mainPaneH - this.volumeAreaH;

      this._computeVisibleRange();
    }

    _computeVisibleRange() {
      const n = this.data.length;
      if (!n) { this.startIndex = 0; this.endIndex = -1; return; }
      const visibleBars = Math.max(1, Math.floor(this.plotW / this.barSpacing));
      this.rightIndex = this._clampRightIndex(this.rightIndex);
      this.endIndex = this.rightIndex;
      this.startIndex = Math.max(0, this.endIndex - visibleBars + 1);
    }

    // ─── Price / value bounds ───────────────────────────────────────────
    _mainPriceBounds() {
      let min = Infinity;
      let max = -Infinity;
      for (let i = this.startIndex; i <= this.endIndex; i++) {
        const bar = this.data[i];
        if (!bar) continue;
        if (bar.low < min) min = bar.low;
        if (bar.high > max) max = bar.high;
      }
      // Include overlay indicator values so a fast-moving SMA/Bollinger line
      // is never clipped outside the visible price range.
      this.overlays.forEach((o) => {
        o.series.forEach((s) => {
          const vals = this._seriesValues(o, s.key);
          for (let i = this.startIndex; i <= this.endIndex; i++) {
            const v = vals[i];
            if (v == null) continue;
            if (v < min) min = v;
            if (v > max) max = v;
          }
        });
      });
      if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
      if (min === max) { min -= 1; max += 1; }
      const pad = (max - min) * 0.08;
      return { min: min - pad, max: max + pad };
    }

    // Fixed-range panes (RSI/Stochastic/Williams %R/ADX) use their declared
    // min/max unconditionally - letting those auto-scale would make the
    // classic "30/70" reference lines meaningless as the scale drifted.
    // Unbounded panes (CCI/ATR/MACD) auto-scale from their own visible
    // values instead, the same way the main price pane does.
    _subPaneBounds(pane) {
      if (!pane.autoScale) return { min: pane.min, max: pane.max };
      let min = Infinity;
      let max = -Infinity;
      pane.series.forEach((s) => {
        const vals = this._seriesValues(pane, s.key);
        for (let i = this.startIndex; i <= this.endIndex; i++) {
          const v = vals[i];
          if (v == null) continue;
          if (v < min) min = v;
          if (v > max) max = v;
        }
      });
      if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
      if (min === max) { min -= 1; max += 1; }
      // MACD-style panes should keep the zero line visible even if all
      // visible values happen to sit on one side of it.
      if (min > 0) min = 0;
      if (max < 0) max = 0;
      const pad = (max - min) * 0.1;
      return { min: min - pad, max: max + pad };
    }

    _yForMainPrice(price, bounds) {
      return ((bounds.max - price) / (bounds.max - bounds.min)) * this.candleAreaH;
    }

    _maxVisibleVolume() {
      let max = 0;
      for (let i = this.startIndex; i <= this.endIndex; i++) {
        const v = (this.data[i] && this.data[i].volume) || 0;
        if (v > max) max = v;
      }
      return max || 1;
    }

    _recomputeIndicators() {
      this.overlays.forEach((o) => { o.data = o.compute(this.data, o.params); });
      this.subPanes.forEach((p) => { p.data = p.compute(this.data, p.params); });
    }

    // ─── Resize (DPR-aware) ─────────────────────────────────────────────
    _onResize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = root.devicePixelRatio || 1;
      this.width = Math.max(1, Math.floor(rect.width));
      this.height = Math.max(1, Math.floor(rect.height));

      [this.baseCanvas, this.dataCanvas, this.indicatorCanvas, this.interactiveCanvas].forEach((c) => {
        c.width = this.width * dpr;
        c.height = this.height * dpr;
      });
      [this.baseCtx, this.dataCtx, this.indicatorCtx, this.interactiveCtx].forEach((ctx) => {
        // setTransform (not scale()) so repeated resizes never compound the DPR factor.
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      });

      this._computeLayout();
      this._drawBaseLayer();
      this._drawDataLayer();
      this._drawIndicatorLayer();
      this._drawInteractiveLayer();
    }

    // ─── Events: pan (mouse), zoom (wheel), pan+pinch (touch) ──────────
    _bindEvents() {
      const el = this.interactiveCanvas;

      el.addEventListener('mousedown', (e) => {
        this._dragging = true;
        this._dragStartX = e.clientX;
        this._dragStartRightIndex = this.rightIndex;
        el.style.cursor = 'grabbing';
      });
      root.addEventListener('mousemove', (e) => this._onMouseMove(e));
      root.addEventListener('mouseup', () => {
        this._dragging = false;
        el.style.cursor = 'crosshair';
      });
      el.addEventListener('mouseleave', () => {
        if (this._dragging) return;
        this.hover = null;
        this._scheduleInteractiveRedraw();
      });
      el.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

      el.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
      el.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
      el.addEventListener('touchend', () => { this._dragging = false; this._pinchStartDist = null; });
    }

    _onMouseMove(e) {
      const rect = this.interactiveCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this._dragging) {
        const deltaBars = Math.round((e.clientX - this._dragStartX) / this.barSpacing);
        this.rightIndex = this._clampRightIndex(this._dragStartRightIndex - deltaBars);
        this._computeVisibleRange();
        this._scheduleFullRedraw();
        return;
      }

      if (x >= 0 && x < this.plotW && y >= 0 && y < this.plotH && this.data.length) {
        this.hover = { x, y, index: this._indexForX(x) };
        this._scheduleInteractiveRedraw();
      } else if (this.hover) {
        this.hover = null;
        this._scheduleInteractiveRedraw();
      }
    }

    _onWheel(e) {
      e.preventDefault();
      if (!this.data.length) return;
      const rect = this.interactiveCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const anchorIndex = this._indexForX(x);
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.barSpacing = Math.max(this.minBarSpacing, Math.min(this.maxBarSpacing, this.barSpacing * factor));
      const visibleBars = Math.max(1, Math.floor(this.plotW / this.barSpacing));
      this.rightIndex = this._clampRightIndex(Math.round(anchorIndex - x / this.barSpacing) + visibleBars - 1);
      this._computeVisibleRange();
      this._scheduleFullRedraw();
    }

    _onTouchStart(e) {
      if (e.touches.length === 1) {
        this._dragging = true;
        this._dragStartX = e.touches[0].clientX;
        this._dragStartRightIndex = this.rightIndex;
      } else if (e.touches.length === 2) {
        this._dragging = false;
        this._pinchStartDist = this._touchDist(e.touches);
        this._pinchStartSpacing = this.barSpacing;
      }
      e.preventDefault();
    }

    _onTouchMove(e) {
      if (e.touches.length === 1 && this._dragging) {
        const deltaBars = Math.round((e.touches[0].clientX - this._dragStartX) / this.barSpacing);
        this.rightIndex = this._clampRightIndex(this._dragStartRightIndex - deltaBars);
        this._computeVisibleRange();
        this._scheduleFullRedraw();
      } else if (e.touches.length === 2 && this._pinchStartDist) {
        const dist = this._touchDist(e.touches);
        const factor = dist / this._pinchStartDist;
        this.barSpacing = Math.max(this.minBarSpacing, Math.min(this.maxBarSpacing, this._pinchStartSpacing * factor));
        this._computeVisibleRange();
        this._scheduleFullRedraw();
      }
      e.preventDefault();
    }

    _touchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // ─── rAF-throttled redraw scheduling ────────────────────────────────
    _scheduleInteractiveRedraw() {
      if (this._rafInteractive) return;
      this._rafInteractive = true;
      root.requestAnimationFrame(() => {
        this._rafInteractive = false;
        this._drawInteractiveLayer();
      });
    }

    _scheduleFullRedraw() {
      if (this._rafFull) return;
      this._rafFull = true;
      root.requestAnimationFrame(() => {
        this._rafFull = false;
        this._drawBaseLayer();
        this._drawDataLayer();
        this._drawIndicatorLayer();
        this._drawInteractiveLayer();
      });
    }

    // ─── Layer 1: base (background, grid, axes) ─────────────────────────
    _drawBaseLayer() {
      const ctx = this.baseCtx;
      const t = this.theme;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = t.bg;
      ctx.fillRect(0, 0, this.width, this.height);
      if (!this.data.length) return;

      ctx.font = AXIS_FONT;

      const bounds = this._mainPriceBounds();
      this._drawPaneGrid(ctx, 0, this.candleAreaH, bounds.min, bounds.max, true, null);

      this.subPanes.forEach((pane, i) => {
        const top = this.mainPaneH + i * (this.subPaneH + PANE_GAP);
        ctx.strokeStyle = t.border;
        ctx.beginPath();
        ctx.moveTo(0, top - PANE_GAP);
        ctx.lineTo(this.plotW, top - PANE_GAP);
        ctx.stroke();
        const pb = this._subPaneBounds(pane);
        // Auto-scaled panes (CCI/ATR/MACD) get plain nice-interval gridlines
        // instead of the fixed reference lines (e.g. RSI's 30/70), which
        // would be meaningless once the scale is no longer fixed.
        this._drawPaneGrid(ctx, top, this.subPaneH, pb.min, pb.max, false, pane.autoScale ? null : pane.referenceLines);
      });

      this._drawTimeAxis(ctx);

      ctx.strokeStyle = t.border;
      ctx.beginPath();
      ctx.moveTo(this.plotW + 0.5, 0);
      ctx.lineTo(this.plotW + 0.5, this.plotH);
      ctx.stroke();
    }

    _drawPaneGrid(ctx, top, height, min, max, isMain, referenceLines) {
      const t = this.theme;
      const lines = (referenceLines && referenceLines.length) ? referenceLines : this._niceTicks(min, max, 5);
      ctx.setLineDash(isMain ? [] : [2, 3]);
      lines.forEach((val) => {
        const y = top + ((max - val) / (max - min || 1)) * height;
        ctx.strokeStyle = t.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.plotW, y);
        ctx.stroke();
        ctx.fillStyle = t.textMuted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toFixed(isMain ? 2 : 0), this.plotW + 6, y);
      });
      ctx.setLineDash([]);
    }

    _niceTicks(min, max, count) {
      const ticks = [];
      const step = (max - min) / (count - 1);
      for (let i = 0; i < count; i++) ticks.push(min + step * i);
      return ticks;
    }

    _drawTimeAxis(ctx) {
      const t = this.theme;
      ctx.fillStyle = t.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const visible = this.endIndex - this.startIndex + 1;
      const step = Math.max(1, Math.floor(visible / 6));
      for (let i = this.startIndex; i <= this.endIndex; i += step) {
        const bar = this.data[i];
        if (!bar) continue;
        ctx.fillText(this._formatTime(bar.time), this._xForIndex(i), this.plotH + 6);
      }
    }

    // ─── Layer 2: data (candles + volume) ───────────────────────────────
    _drawDataLayer() {
      const ctx = this.dataCtx;
      const t = this.theme;
      ctx.clearRect(0, 0, this.width, this.height);
      if (!this.data.length) return;

      const bounds = this._mainPriceBounds();
      const maxVol = this._maxVisibleVolume();
      const bodyW = Math.max(1, this.barSpacing * 0.6);
      const halfBody = bodyW / 2;

      for (let i = this.startIndex; i <= this.endIndex; i++) {
        const bar = this.data[i];
        if (!bar) continue;
        const x = this._xForIndex(i);
        const up = bar.close >= bar.open;
        ctx.strokeStyle = ctx.fillStyle = up ? t.up : t.down;

        const yHigh = this._yForMainPrice(bar.high, bounds);
        const yLow = this._yForMainPrice(bar.low, bounds);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        const yOpen = this._yForMainPrice(bar.open, bounds);
        const yClose = this._yForMainPrice(bar.close, bounds);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1, Math.abs(yClose - yOpen));
        ctx.fillRect(x - halfBody, bodyTop, bodyW, bodyH);

        const vol = bar.volume || 0;
        const volH = (vol / maxVol) * this.volumeAreaH * 0.9;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x - halfBody, this.candleAreaH + this.volumeAreaH - volH, bodyW, volH);
        ctx.globalAlpha = 1;
      }
    }

    // ─── Layer 3: indicators (overlay lines + sub-pane oscillators) ─────
    _drawIndicatorLayer() {
      const ctx = this.indicatorCtx;
      ctx.clearRect(0, 0, this.width, this.height);
      if (!this.data.length) return;
      const bounds = this._mainPriceBounds();

      this.overlays.forEach((o) => {
        o.series.forEach((s) => {
          const vals = this._seriesValues(o, s.key);
          this._strokeSeries(ctx, vals, s.color, s.lineWidth || 1.5, (v) => this._yForMainPrice(v, bounds));
        });
      });

      this.subPanes.forEach((pane, paneIdx) => {
        const top = this.mainPaneH + paneIdx * (this.subPaneH + PANE_GAP);
        const pb = this._subPaneBounds(pane);
        const yFor = (v) => top + ((pb.max - v) / (pb.max - pb.min || 1)) * this.subPaneH;
        pane.series.forEach((s) => {
          const vals = this._seriesValues(pane, s.key);
          if (s.style === 'histogram') {
            this._drawHistogramSeries(ctx, vals, yFor);
          } else {
            this._strokeSeries(ctx, vals, s.color, s.lineWidth || 1.5, yFor);
          }
        });
      });
    }

    _strokeSeries(ctx, vals, color, lineWidth, yFor) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let started = false;
      for (let i = this.startIndex; i <= this.endIndex; i++) {
        const v = vals[i];
        if (v == null) { started = false; continue; }
        const x = this._xForIndex(i);
        const y = yFor(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }

    // Bar-per-value rendering (MACD's histogram): colored by sign relative
    // to zero rather than a fixed color, matching how every real MACD
    // histogram is conventionally read at a glance.
    _drawHistogramSeries(ctx, vals, yFor) {
      const t = this.theme;
      const barW = Math.max(1, this.barSpacing * 0.6);
      const zeroY = yFor(0);
      ctx.globalAlpha = 0.7;
      for (let i = this.startIndex; i <= this.endIndex; i++) {
        const v = vals[i];
        if (v == null) continue;
        const x = this._xForIndex(i);
        const y = yFor(v);
        ctx.fillStyle = v >= 0 ? t.up : t.down;
        ctx.fillRect(x - barW / 2, Math.min(y, zeroY), barW, Math.max(1, Math.abs(y - zeroY)));
      }
      ctx.globalAlpha = 1;
    }

    // ─── Layer 4: interactive (crosshair + axis tags) ───────────────────
    _drawInteractiveLayer() {
      const ctx = this.interactiveCtx;
      const t = this.theme;
      ctx.clearRect(0, 0, this.width, this.height);

      if (!this.hover || !this.data.length) {
        if (this.onHover) this.onHover(null);
        return;
      }

      const idx = Math.max(this.startIndex, Math.min(this.endIndex, this.hover.index));
      const bar = this.data[idx];
      if (!bar) return;
      const x = this._xForIndex(idx);

      ctx.strokeStyle = t.crosshair;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, this.hover.y);
      ctx.lineTo(this.plotW, this.hover.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price tag on the right axis - only meaningful while hovering the
      // main (candle) pane, since that's the only pane this converts Y via.
      if (this.hover.y <= this.candleAreaH) {
        const bounds = this._mainPriceBounds();
        const price = bounds.max - (this.hover.y / this.candleAreaH) * (bounds.max - bounds.min);
        ctx.fillStyle = t.accent;
        ctx.fillRect(this.plotW, this.hover.y - 8, this.priceAxisW, 16);
        ctx.fillStyle = '#fff';
        ctx.font = AXIS_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(price.toFixed(2), this.plotW + 6, this.hover.y);
      }

      const label = this._formatTime(bar.time);
      ctx.font = AXIS_FONT;
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = t.accent;
      ctx.fillRect(x - tw / 2, this.plotH, tw, this.timeAxisH);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, this.plotH + this.timeAxisH / 2);

      if (this.onHover) this.onHover({ index: idx, bar });
    }
  }

  function createChartCanvas(container, options) {
    return new ChartCanvasEngine(container, options);
  }

  root.ChartCanvasEngine = { createChartCanvas, THEMES };
})(typeof window !== 'undefined' ? window : globalThis);
