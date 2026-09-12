/*
 * Indicator legend (indicator system v2): one block per pane listing its
 * indicators - name + parameters, live values at the crosshair (last values
 * otherwise) in each line's colour, summary numbers some indicators compute
 * (stats), and actions: show/hide, settings, move between the price chart and
 * a pane, pane up/down, remove - always shown, not only on hover.
 *
 * The price pane's block sits inside #chart-overlay-legend under the OHLC
 * row; every other pane's block is positioned at that pane's top edge.
 */
(function () {
  'use strict';
  const NS = window.TFIndicators;
  const MAIN = 'main';

  const svg = (paths) => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    move: svg('<path d="M3 16l4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>'),
    up: svg('<path d="M18 15l-6-6-6 6"/>'),
    down: svg('<path d="M6 9l6 6 6-6"/>'),
    close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function formatValue(v) {
    if (v == null || !Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
    if (a >= 1) return v.toFixed(2);
    if (a === 0) return '0';
    return v.toFixed(4);
  }

  // A stats number: the entry's fixed decimals if it gives them.
  function formatStat(st) {
    if (st.value == null || !Number.isFinite(st.value)) return '—';
    return (st.digits != null ? st.value.toFixed(st.digits) : formatValue(st.value)) + (st.suffix || '');
  }

  class Legend {
    constructor(manager, { host, mainHost }) {
      this.m = manager;
      this.host = host;
      this.layer = document.createElement('div');
      this.layer.className = 'tfi-legend-layer';
      host.appendChild(this.layer);
      this.mainBlock = document.createElement('div');
      this.mainBlock.className = 'tfi-pane-legend tfi-main-legend';
      (mainHost || this.layer).appendChild(this.mainBlock);
      this.blocks = new Map();
      this.lastParam = null;
      [this.layer, this.mainBlock].forEach(el => el.addEventListener('click', (e) => this._onClick(e)));
    }

    render() {
      const byPane = new Map(this.m.panes.map(p => [p.id, []]));
      this.m.instances.forEach(inst => { if (byPane.has(inst.paneId)) byPane.get(inst.paneId).push(inst); });

      this.mainBlock.innerHTML = byPane.get(MAIN).map(inst => this._row(inst, MAIN)).join('');
      const live = new Set();
      this.m.panes.slice(1).forEach((pane, i, list) => {
        live.add(pane.id);
        let block = this.blocks.get(pane.id);
        if (!block) {
          block = document.createElement('div');
          block.className = 'tfi-pane-legend';
          this.layer.appendChild(block);
          this.blocks.set(pane.id, block);
        }
        block.dataset.pane = pane.id;
        block.innerHTML = byPane.get(pane.id).map((inst, k) => this._row(inst, pane.id, { first: k === 0, canUp: i > 0, canDown: i < list.length - 1 })).join('');
      });
      this.blocks.forEach((block, id) => { if (!live.has(id)) { block.remove(); this.blocks.delete(id); } });
      this.position();
      this.updateValues(this.lastParam);
    }

    _row(inst, paneId, { first = false, canUp = false, canDown = false } = {}) {
      const onMain = paneId === MAIN;
      const moveTitle = onMain ? 'Move to its own pane' : 'Move to the price chart';
      const paneButtons = !onMain && first
        ? `<button type="button" data-act="up" title="${canUp ? 'Move pane up' : 'Already the top pane'}"${canUp ? '' : ' disabled'}>${ICONS.up}</button>`
          + `<button type="button" data-act="down" title="${canDown ? 'Move pane down' : 'Already the bottom pane'}"${canDown ? '' : ' disabled'}>${ICONS.down}</button>`
        : '';
      return `<div class="tfi-row${inst.visible ? '' : ' tfi-hidden'}${inst.error ? ' tfi-error' : ''}" data-uid="${inst.uid}">
        <span class="tfi-name" title="${esc(inst.error ? 'Error: ' + inst.error : inst.def.name)}">${esc(this.m.label(inst))}</span>
        <span class="tfi-values"></span>
        <span class="tfi-actions">
          <button type="button" data-act="visible" title="${inst.visible ? 'Hide' : 'Show'}">${inst.visible ? ICONS.eye : ICONS.eyeOff}</button>
          <button type="button" data-act="settings" title="Settings">${ICONS.gear}</button>
          <button type="button" data-act="move" title="${moveTitle}">${ICONS.move}</button>
          ${paneButtons}
          <button type="button" data-act="remove" title="Remove">${ICONS.close}</button>
        </span>
      </div>`;
    }

    // Each pane's block goes at the top-left of that pane's plot area (the
    // price pane's block flows under the OHLC row instead). Called on every
    // pane size change.
    position() {
      const hostRect = this.host.getBoundingClientRect();
      const scaleWidth = (() => { try { return this.m.chart.priceScale('right').width(); } catch (e) { return 60; } })();
      this.mainBlock.style.maxWidth = Math.max(120, hostRect.width - scaleWidth - 16) + 'px';
      this.m.panes.slice(1).forEach(pane => {
        const block = this.blocks.get(pane.id);
        const el = pane.api.getHTMLElement && pane.api.getHTMLElement();
        if (!block) return;
        if (!el) { block.style.display = 'none'; return; }
        const row = el.getBoundingClientRect();
        // A pane row is [left scale, plot, right scale] - start past a left scale.
        const plot = el.children && el.children.length === 3 ? el.children[1].getBoundingClientRect() : null;
        block.style.display = '';
        block.style.top = Math.round(row.top - hostRect.top + 4) + 'px';
        block.style.left = Math.round((plot ? plot.left : row.left) - hostRect.left + 6) + 'px';
        block.style.maxWidth = Math.max(120, plot ? plot.width - 12 : row.width - scaleWidth - 16) + 'px';
      });
    }

    // Values at the crosshair, or each line's latest value when it's off the chart.
    updateValues(param) {
      this.lastParam = param;
      const atCrosshair = param && param.time != null && param.seriesData;
      this.m.instances.forEach(inst => {
        const row = this._rowEl(inst.uid);
        const box = row && row.querySelector('.tfi-values');
        if (!box) return;
        if (!inst.visible || inst.error) { box.innerHTML = ''; return; }
        const values = this.m.legendSeries(inst).map(s => {
          let value = null;
          let color = s.color;
          if (atCrosshair) {
            const point = param.seriesData.get(s.api);
            if (point && Number.isFinite(point.value)) { value = point.value; if (point.color) color = point.color; }
          } else if (s.last) {
            value = s.last.value;
            if (s.last.color) color = s.last.color;
          }
          const title = s.title ? `<span class="tfi-vtitle">${esc(s.title)}</span>` : '';
          return `<span class="tfi-value" style="color:${esc(color || 'inherit')}">${title}${formatValue(value)}</span>`;
        }).join('');
        const stats = this.m.stats(inst).map(st => `<span class="tfi-value tfi-stat"><span class="tfi-vtitle">${esc(st.label)}</span><span style="color:${esc(st.color || 'inherit')}">${formatStat(st)}</span></span>`).join('');
        box.innerHTML = values + stats;
      });
    }

    _rowEl(uid) {
      return this.mainBlock.querySelector(`[data-uid="${uid}"]`) || this.layer.querySelector(`[data-uid="${uid}"]`);
    }

    _onClick(e) {
      const row = e.target.closest('.tfi-row');
      if (!row) return;
      const uid = row.dataset.uid;
      const inst = this.m.instances.find(i => i.uid === uid);
      if (!inst) return;
      const btn = e.target.closest('button[data-act]');
      if (!btn) {
        // Click or tap on the name: settings.
        if (e.target.closest('.tfi-name')) NS.settings && NS.settings.open(this.m, uid);
        return;
      }
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'visible') this.m.update(uid, { visible: !inst.visible });
      else if (act === 'settings') NS.settings && NS.settings.open(this.m, uid);
      else if (act === 'move') this.m.move(uid, inst.paneId === MAIN ? 'new' : MAIN);
      else if (act === 'up') this.m.movePane(inst.paneId, -1);
      else if (act === 'down') this.m.movePane(inst.paneId, 1);
      else if (act === 'remove') this.m.remove(uid);
    }
  }

  NS.Legend = Legend;
  NS.formatValue = formatValue;
})();
