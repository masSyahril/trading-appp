/*
 * Indicator settings dialog (indicator system v2), generated from the
 * definition: its parameters, then every line it draws (show/hide, colour,
 * width, style), then where it sits (price chart, an existing pane, a new
 * pane). Changes preview live; Cancel puts everything back.
 */
(function () {
  'use strict';
  const NS = window.TFIndicators;
  const MAIN = 'main';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let root = null;
  let manager = null;
  let uid = null;
  let snapshot = null;
  let paramTimer = null;

  // <input type="color"> only takes #rrggbb.
  function toHex(color) {
    if (!color || typeof color !== 'string') return '#ffffff';
    const c = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7);
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map(x => x + x).join('');
    const m = c.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/i);
    if (m) return '#' + m.slice(1, 4).map(n => (+n).toString(16).padStart(2, '0')).join('');
    return '#ffffff';
  }

  function build() {
    root = document.createElement('div');
    root.className = 'tfi-backdrop';
    root.hidden = true;
    root.innerHTML = `<div class="tfi-dialog tfi-settings" role="dialog" aria-modal="true" aria-labelledby="tfi-settings-title">
        <div class="tfi-dialog-head"><strong id="tfi-settings-title"></strong><button type="button" class="tfi-icon-btn" data-close title="Close">✕</button></div>
        <div class="tfi-settings-body"></div>
        <div class="tfi-dialog-foot tfi-settings-foot">
          <button type="button" class="tfi-btn" data-defaults>Defaults</button>
          <span style="flex:1"></span>
          <button type="button" class="tfi-btn" data-cancel>Cancel</button>
          <button type="button" class="tfi-btn tfi-btn-primary" data-ok>OK</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-cancel]') || e.target.closest('[data-close]')) cancel();
      else if (e.target.closest('[data-ok]')) close();
      else if (e.target.closest('[data-defaults]')) resetDefaults();
    });
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root && !root.hidden) cancel(); });
  }

  function inst() { return manager.instances.find(i => i.uid === uid); }

  function render() {
    const it = inst();
    if (!it) { close(); return; }
    const def = it.def;
    root.querySelector('#tfi-settings-title').textContent = manager.label(it);
    const editable = def.editable !== false;

    const params = def.params.length ? `<section><h4>Inputs</h4>${def.params.map(p => `
        <label class="tfi-field"><span>${esc(p.label)}</span>
          <input data-param="${esc(p.key)}" type="${p.type === 'number' ? 'number' : 'text'}" value="${esc(it.params[p.key] ?? p.default)}"
            ${p.min != null ? `min="${p.min}"` : ''} ${p.max != null ? `max="${p.max}"` : ''} ${p.type === 'number' ? `step="${p.step}"` : ''} ${editable ? '' : 'disabled'}>
        </label>`).join('')}${editable ? '' : '<p class="tfi-muted">This indicator\'s inputs are fixed.</p>'}</section>` : '';

    const targets = manager.styleTargets(it);
    const styles = targets.length ? `<section><h4>Style</h4>${targets.map(t => `
        <div class="tfi-style-row" data-style="${esc(t.key)}">
          <label class="tfi-check"><input type="checkbox" data-s="visible" ${t.visible ? 'checked' : ''}><span>${esc(t.title)}</span></label>
          ${t.perPointColor ? '<span class="tfi-muted tfi-small">bar colours</span>' : `<input type="color" data-s="color" value="${toHex(t.color)}" title="Colour">`}
          ${t.type === 'histogram' ? '' : `
            <select data-s="lineWidth" title="Width">${[1, 2, 3, 4].map(w => `<option value="${w}" ${Math.round(t.lineWidth) === w ? 'selected' : ''}>${w}px</option>`).join('')}</select>
            <select data-s="lineStyle" title="Line style">${['solid', 'dashed', 'dotted'].map(s => `<option value="${s}" ${t.lineStyle === s ? 'selected' : ''}>${s}</option>`).join('')}</select>`}
        </div>`).join('')}</section>` : '';

    const panes = manager.panes.slice(1).map((p, i) => {
      const names = manager.instances.filter(x => x.paneId === p.id).map(x => manager.label(x)).join(', ');
      return `<option value="${esc(p.id)}" ${it.paneId === p.id ? 'selected' : ''}>Pane ${i + 1}${names ? ' · ' + esc(names) : ''}</option>`;
    }).join('');
    const placement = `<section><h4>Placement</h4><label class="tfi-field"><span>Draw on</span>
        <select data-placement>
          <option value="${MAIN}" ${it.paneId === MAIN ? 'selected' : ''}>Price chart</option>
          ${panes}
          <option value="new">New pane</option>
        </select></label></section>`;

    root.querySelector('.tfi-settings-body').innerHTML = params + styles + placement;
  }

  function onInput(e) {
    const it = inst();
    if (!it) return;
    const t = e.target;
    if (t.dataset.param != null) {
      clearTimeout(paramTimer);
      const collect = () => {
        const params = {};
        root.querySelectorAll('[data-param]').forEach(el => {
          const p = it.def.params.find(x => x.key === el.dataset.param);
          if (!p) return;
          if (p.type === 'number') {
            let v = parseFloat(el.value);
            if (!Number.isFinite(v)) return;
            if (p.min != null) v = Math.max(p.min, v);
            if (p.max != null) v = Math.min(p.max, v);
            params[p.key] = v;
          } else {
            params[p.key] = el.value;
          }
        });
        manager.update(uid, { params });
        root.querySelector('#tfi-settings-title').textContent = manager.label(inst());
      };
      if (e.type === 'change') collect(); else paramTimer = setTimeout(collect, 300);
      return;
    }
    if (t.dataset.s) {
      if (e.type === 'input' && t.type !== 'color') return; // selects/checkboxes apply on change
      const row = t.closest('[data-style]');
      const styles = JSON.parse(JSON.stringify(it.styles || {}));
      const key = row.dataset.style;
      const s = (styles[key] = styles[key] || {});
      if (t.dataset.s === 'visible') s.visible = t.checked;
      else if (t.dataset.s === 'lineWidth') s.lineWidth = +t.value;
      else s[t.dataset.s] = t.value;
      manager.update(uid, { styles });
      return;
    }
    if (t.dataset.placement != null && e.type === 'change') {
      manager.move(uid, t.value);
      render(); // pane list and names changed
    }
  }

  function resetDefaults() {
    const it = inst();
    if (!it) return;
    manager.update(uid, { params: NS.registry.defaultParams(it.def), styles: {}, visible: true });
    render();
  }

  function cancel() {
    const it = inst();
    if (it && snapshot) {
      manager.update(uid, { params: snapshot.params, styles: snapshot.styles, visible: snapshot.visible });
      if (it.paneId !== snapshot.paneId) manager.move(uid, manager.panes.some(p => p.id === snapshot.paneId) ? snapshot.paneId : (snapshot.paneId === MAIN ? MAIN : 'new'));
    }
    close();
  }

  function close() {
    clearTimeout(paramTimer);
    if (root) root.hidden = true;
    snapshot = null;
  }

  function open(m, id) {
    manager = m;
    uid = id;
    if (!root) build();
    const it = inst();
    if (!it) return;
    snapshot = JSON.parse(JSON.stringify({ params: it.params, styles: it.styles || {}, visible: it.visible, paneId: it.paneId }));
    render();
    root.hidden = false;
  }

  NS.settings = { open, close };
})();
