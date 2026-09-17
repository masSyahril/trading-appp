/*
 * Drop-in language switcher widget. Mirrors pages/auth/auth-widget.js's
 * pattern so it feels like part of the same codebase:
 *
 *   <div data-tl-lang-switcher></div>
 *   <script src="i18n/lang-switcher.js" defer></script>
 *
 * Needs i18n.js on the same page (order doesn't matter - it waits for
 * TLI18n.ready). Self-contained: injects its own <style> once, class names
 * namespaced (tl-langw-*) to avoid colliding with the host page's CSS.
 *
 * Adding a third language later is just adding it to LANGUAGES below plus
 * its i18n/<code>.json file and i18n.js's SUPPORTED list - nothing else
 * here changes.
 */
(function () {
  var STYLE_ID = 'tl-langw-styles';

  var LANGUAGES = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'zh-TW', label: '繁體中文', short: '繁中' },
  ];

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.tl-langw { position: relative; display: inline-flex; align-items: center; font-family: inherit; }',
      '.tl-langw button {',
      '  font-family: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer;',
      '  border-radius: 7px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.06);',
      '  color: #e6edf3; padding: 6px 10px; line-height: 1.2;',
      '  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;',
      '}',
      '.tl-langw button:hover { background: rgba(255,255,255,0.14); }',
      '.tl-langw-menu {',
      '  position: absolute; top: calc(100% + 8px); right: 0; min-width: 150px;',
      '  background: #1c2128; border: 1px solid rgba(255,255,255,0.14); border-radius: 10px;',
      '  box-shadow: 0 12px 28px rgba(0,0,0,0.45); padding: 6px; z-index: 1000; display: none;',
      '}',
      '.tl-langw-menu.open { display: block; }',
      '.tl-langw-item {',
      '  display: flex; width: 100%; text-align: left; background: none; border: none; color: #e6edf3;',
      '  padding: 8px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 500; cursor: pointer;',
      '  justify-content: space-between; align-items: center; gap: 10px; box-sizing: border-box;',
      '}',
      '.tl-langw-item:hover { background: rgba(255,255,255,0.08); }',
      '.tl-langw-item.active { color: #79c0ff; }',
      '.tl-langw-check { font-size: 0.8rem; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render(el) {
    var current = window.TLI18n ? window.TLI18n.getLocale() : 'en';
    var currentLang = LANGUAGES.filter(function (l) { return l.code === current; })[0] || LANGUAGES[0];

    el.innerHTML =
      '<div class="tl-langw">' +
        '<button type="button" class="tl-langw-toggle" aria-haspopup="true" aria-expanded="false">' +
          '<span aria-hidden="true">🌐</span><span>' + escapeHtml(currentLang.short) + '</span>' +
        '</button>' +
        '<div class="tl-langw-menu" role="menu">' +
          LANGUAGES.map(function (l) {
            var isActive = l.code === current;
            return '<button type="button" class="tl-langw-item' + (isActive ? ' active' : '') + '" data-lang="' + l.code + '" role="menuitem">' +
              '<span>' + escapeHtml(l.label) + '</span>' +
              (isActive ? '<span class="tl-langw-check">✓</span>' : '') +
              '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    var toggle = el.querySelector('.tl-langw-toggle');
    var menu = el.querySelector('.tl-langw-menu');
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function () {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    el.querySelectorAll('.tl-langw-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (window.TLI18n) window.TLI18n.setLocale(lang);
      });
    });
  }

  function mountAll() {
    ensureStyles();
    document.querySelectorAll('[data-tl-lang-switcher]').forEach(render);
  }

  function init() {
    if (window.TLI18n && window.TLI18n.ready) {
      window.TLI18n.ready.then(mountAll).catch(mountAll);
    } else {
      // i18n.js missing or not loaded yet - still render, just defaulting
      // to English, rather than leaving the mount point blank.
      mountAll();
    }
    window.addEventListener('tl:localechange', function () {
      document.querySelectorAll('[data-tl-lang-switcher]').forEach(render);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
