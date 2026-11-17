/*
 * Indicator picker (indicator system v2): the one place to add an indicator
 * - replaces both the old "Overlay" checkbox menu and "+ Indicators".
 * Searchable (name, short name, id, category), grouped by category, each
 * item badged "Chart" or "Pane" and showing how many are already on. Adding
 * keeps the picker open so several can be added in a row; Enter adds the
 * first match. A full-screen sheet on phones.
 *
 * Entries with an `added` date in the last NEW_DAYS days are badged "New",
 * listed again in a "New" group at the top, and found by searching "new" -
 * so a new indicator can be told apart from an older one with a similar name.
 * Entries without a date are the older ones.
 */
(function () {
  'use strict';
  const NS = window.TFIndicators;
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const NEW_DAYS = 10;
  const isNew = (def) => {
    const t = def.added ? Date.parse(def.added) : NaN;
    return Number.isFinite(t) && Date.now() - t <= NEW_DAYS * 864e5;
  };

  let manager = null;
  let root = null;
  let search = null;
  let list = null;

  function build() {
    root = document.createElement('div');
    root.className = 'tfi-backdrop';
    root.hidden = true;
    root.innerHTML = `
      <div class="tfi-dialog tfi-picker" role="dialog" aria-modal="true" aria-label="Add indicator">
        <div class="tfi-dialog-head">
          <input type="text" class="tfi-search" placeholder="Search indicators…" autocomplete="off" spellcheck="false" aria-label="Search indicators">
          <button type="button" class="tfi-icon-btn" data-close title="Close">✕</button>
        </div>
        <div class="tfi-picker-list" role="list"></div>
        <div class="tfi-dialog-foot tfi-muted">Click to add · the same indicator can be added more than once · <span class="tfi-badge tfi-badge-new">New</span> = added in the last ${NEW_DAYS} days (search "new") · <kbd>Esc</kbd> closes</div>
      </div>`;
    document.body.appendChild(root);
    search = root.querySelector('.tfi-search');
    list = root.querySelector('.tfi-picker-list');

    root.addEventListener('click', (e) => {
      if (e.target === root || e.target.closest('[data-close]')) { close(); return; }
      const item = e.target.closest('.tfi-pick');
      if (item) addFrom(item);
    });
    search.addEventListener('input', renderList);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = list.querySelector('.tfi-pick');
        if (first) addFrom(first);
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) close(); });
  }

  function addFrom(item) {
    manager.add(item.dataset.id);
    item.classList.remove('tfi-added');
    void item.offsetWidth; // restart the "added" flash
    item.classList.add('tfi-added');
    renderCounts();
  }

  const item = (def, showCategory) => `
    <button type="button" class="tfi-pick" data-id="${esc(def.id)}" role="listitem"${def.added ? ` title="Added ${esc(def.added)}"` : ''}>
      <span class="tfi-pick-name">${esc(def.name)}${showCategory ? ` <span class="tfi-pick-in">${esc(def.category)}</span>` : ''}</span>
      <span class="tfi-pick-count" data-count="${esc(def.id)}"></span>
      ${isNew(def) ? `<span class="tfi-badge tfi-badge-new">New</span>` : ''}
      <span class="tfi-badge tfi-badge-${def.placement}">${def.placement === 'chart' ? 'Chart' : 'Pane'}</span>
    </button>`;

  // How well a definition matches the search: exact name/short name/id,
  // then prefix, then a word starting with it, then anywhere.
  function score(def, q) {
    const names = [def.name, def.shortName || '', def.id].map(s => s.toLowerCase());
    if (names.includes(q)) return 0;
    if (names.some(n => n.startsWith(q))) return 1;
    if (names.some(n => n.split(/[\s_()\-,]+/).some(w => w.startsWith(q)))) return 2;
    return 3;
  }

  function renderList() {
    const q = search.value.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const matches = NS.registry.all().filter(def => {
      // "new" on its own lists only the recently added ones - not older entries that
      // merely have "new" in the name (NewMACD, New MarketFI ...).
      if (q === 'new') return isNew(def);
      const hay = `${def.name} ${def.shortName || ''} ${def.id} ${def.category}${isNew(def) ? ' new' : ''}`.toLowerCase();
      return terms.every(t => hay.includes(t));
    });
    let html;
    if (terms.length) {
      // Searching: one list, best matches first.
      html = matches
        .map(def => [score(def, q), def])
        .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
        .map(([, def]) => item(def, true)).join('');
    } else {
      const groups = new Map(NS.registry.CATEGORY_ORDER.map(c => [c, []]));
      matches.forEach(def => {
        if (!groups.has(def.category)) groups.set(def.category, []);
        groups.get(def.category).push(def);
      });
      // Recently added ones first, as their own group (they also stay in their category).
      const fresh = matches.filter(isNew).sort((a, b) => a.name.localeCompare(b.name));
      const dates = [...new Set(fresh.map(d => d.added))].sort();
      const newGroup = fresh.length ? `
        <div class="tfi-pick-group tfi-pick-group-new">
          <div class="tfi-pick-cat">New <span>${fresh.length} · added ${esc(dates.length === 1 ? dates[0] : `${dates[0]} – ${dates[dates.length - 1]}`)}</span></div>
          ${fresh.map(def => item(def, true)).join('')}
        </div>` : '';
      html = newGroup + [...groups].filter(([, defs]) => defs.length).map(([category, defs]) => `
        <div class="tfi-pick-group">
          <div class="tfi-pick-cat">${esc(category)} <span>${defs.length}</span></div>
          ${defs.sort((a, b) => a.name.localeCompare(b.name)).map(def => item(def, false)).join('')}
        </div>`).join('');
    }
    list.innerHTML = html || `<div class="tfi-empty">No indicators match "${esc(search.value.trim())}"</div>`;
    renderCounts();
  }

  function renderCounts() {
    const counts = {};
    manager.instances.forEach(i => { counts[i.id] = (counts[i.id] || 0) + 1; });
    list.querySelectorAll('[data-count]').forEach(el => {
      const n = counts[el.dataset.count];
      el.textContent = n ? `${n} on` : '';
    });
  }

  function open(m) {
    manager = m;
    if (!root) build();
    search.value = '';
    renderList();
    root.hidden = false;
    list.scrollTop = 0;
    setTimeout(() => search.focus(), 20);
  }

  function close() {
    if (root) root.hidden = true;
  }

  NS.picker = { open, close };
})();
