/*
 * TradeLite shared appearance engine (light / dark).
 *
 * - Persists the choice in localStorage under 'tl-appearance' ('dark' | 'light'),
 *   shared across every page in the app (hub, crypto-trading, stock-market, auth).
 * - Sets data-appearance on <html>; every page's CSS reads that attribute to
 *   swap its own color tokens (see the "[data-appearance="light"]" blocks
 *   added alongside each page/theme's existing :root palette).
 * - The actual attribute is also set by a tiny inline snippet at the very
 *   top of <head> (before any stylesheet) so there is no flash of the wrong
 *   theme while this file loads - this file re-applies it (harmless) and
 *   then renders the toggle button.
 * - Renders a toggle button into any element carrying [data-tl-theme-toggle];
 *   if a page has no such placeholder, a small floating button is added
 *   instead so every page gets a working switch.
 * - Switching in one tab updates other open tabs/pages via the 'storage'
 *   event, and fires a 'tl:appearancechange' CustomEvent locally so a page
 *   can react (e.g. repaint a canvas/chart that reads colors at draw time).
 */
(function () {
  var KEY = 'tl-appearance';
  var DEFAULT = 'dark';

  function get() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : DEFAULT;
    } catch (e) {
      return DEFAULT;
    }
  }

  function apply(v) {
    document.documentElement.setAttribute('data-appearance', v);
    try { document.documentElement.style.colorScheme = v; } catch (e) {}
  }

  function set(v) {
    v = v === 'light' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, v); } catch (e) {}
    apply(v);
    try {
      window.dispatchEvent(new CustomEvent('tl:appearancechange', { detail: { appearance: v } }));
    } catch (e) {}
  }

  function toggle() {
    set(get() === 'light' ? 'dark' : 'light');
  }

  window.TLTheme = { get: get, set: set, toggle: toggle };

  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2 12h2.5M19.5 12H22M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/></svg>',
    moon: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.2A8.2 8.2 0 1 1 9.8 4a6.5 6.5 0 0 0 10.2 10.2z"/></svg>'
  };

  function renderInto(container) {
    if (!container || container.dataset.tlThemeToggleReady === '1') return;
    container.dataset.tlThemeToggleReady = '1';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tl-theme-toggle';

    function paint() {
      var v = get();
      var isLight = v === 'light';
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      var label = isLight ? 'Switch to dark mode' : 'Switch to light mode';
      btn.setAttribute('aria-label', label);
      btn.title = label;
      btn.innerHTML = ICONS[isLight ? 'sun' : 'moon'];
    }

    btn.addEventListener('click', function () {
      toggle();
      paint();
    });
    window.addEventListener('tl:appearancechange', paint);
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) {
        apply(get());
        paint();
      }
    });

    paint();
    container.appendChild(btn);
  }

  function init() {
    var hosts = document.querySelectorAll('[data-tl-theme-toggle]');
    if (hosts.length) {
      hosts.forEach(renderInto);
    } else {
      var floating = document.createElement('div');
      floating.className = 'tl-theme-toggle-floating';
      document.body.appendChild(floating);
      renderInto(floating);
    }
  }

  // Idempotent - the inline head snippet already set this before first paint.
  apply(get());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
