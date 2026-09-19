/*
 * Minimal, dependency-free i18n loader for TradeFlow's multi-page vanilla-JS
 * frontend (same philosophy as api/lib/mailer.php's hand-rolled SMTP client:
 * no build step, no npm packages - just fetch() and a lookup table).
 * Language files live in stock-market/lang/<code>.json as flat
 * {"key": "string"} maps, fetched relative to the page's own URL, so this
 * works unchanged from any page under stock-market/ (index.html, zen.html,
 * terminal.html, ...).
 *
 * Load this FIRST in index.html's ScriptLoader manifest, before anything
 * that calls TradeFlowI18n.t(). Language loads asynchronously, so:
 *   TradeFlowI18n.ready(() => { ...use t() here for a one-time render... });
 * is the correct way to wait for it. Code that re-renders on its own timer
 * (like portfolio.js) can call t() directly without waiting - it returns the
 * raw key until the language file lands, then reads correctly from the next
 * render onward.
 */
window.TradeFlowI18n = (function () {
  const SUPPORTED = ['en', 'zh'];
  const DEFAULT_LANG = 'en';
  const STORAGE_KEY = 'tf_lang';

  let strings = {};
  let currentLang = DEFAULT_LANG;
  let readyPromise = null;

  function detectLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch (e) {
      // localStorage blocked (private mode, etc.) - fall through to browser detection.
    }
    const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return SUPPORTED.includes(browser) ? browser : DEFAULT_LANG;
  }

  async function loadLang(lang) {
    const res = await fetch(`lang/${lang}.json`);
    if (!res.ok) throw new Error(`i18n: could not load lang/${lang}.json (${res.status})`);
    return res.json();
  }

  async function init() {
    currentLang = detectLang();
    try {
      strings = await loadLang(currentLang);
    } catch (e) {
      console.error(`i18n: failed to load "${currentLang}"`, e);
      if (currentLang !== DEFAULT_LANG) {
        try {
          strings = await loadLang(DEFAULT_LANG);
          currentLang = DEFAULT_LANG;
        } catch (e2) {
          console.error('i18n: default language failed too, falling back to raw keys', e2);
          strings = {};
        }
      } else {
        strings = {};
      }
    }
  }

  /** Looks up `key`, replacing any {varName} placeholders from `vars`. Falls back to the raw key. */
  function t(key, vars) {
    let str = strings[key] ?? key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        str = str.split(`{${k}}`).join(vars[k]);
      });
    }
    return str;
  }

  /** Full BCP-47 locale tag for Intl.NumberFormat/DateTimeFormat - kept separate from the 2-letter language code. */
  function intlLocale() {
    return currentLang === 'zh' ? 'zh-CN' : 'en-US';
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang) || lang === currentLang) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.error('i18n: could not persist language choice', e);
    }
    location.reload(); // simplest correct way to re-render every script on a no-build-step page
  }

  function getLang() {
    return currentLang;
  }

  function ready(cb) {
    if (!readyPromise) {
      readyPromise = init();
    }
    if (cb) {
      readyPromise.then(cb);
    }
    return readyPromise;
  }

  /**
   * Applies translations to static markup via data-i18n* attributes, so a
   * plain page (no per-string JS needed) can just annotate its HTML:
   *   data-i18n="key"             -> element.textContent
   *   data-i18n-placeholder="key" -> element.placeholder
   *   data-i18n-title="key"       -> element.title
   *   data-i18n-aria-label="key"  -> element.aria-label
   * Called automatically once ready() resolves; safe to call again after
   * adding new markup to the page (e.g. dynamically-inserted rows/dialogs).
   */
  function applyStatic(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
  }

  return { ready, t, setLang, getLang, intlLocale, applyStatic, SUPPORTED };
})();

// Start loading immediately so it's likely already resolved by the time the
// scripts loaded after this one need it.
window.TradeFlowI18n.ready();

// Self-wiring: if the current page has a #lang-toggle-btn (index.html's
// header does), hook it up here so every page gets a working switcher just
// by loading this one script - no page-specific JS needed.
window.TradeFlowI18n.ready(() => {
  const btn = document.getElementById('lang-toggle-btn');
  if (!btn) return;
  const label = document.getElementById('lang-toggle-label');
  const current = window.TradeFlowI18n.getLang();
  const other = current === 'zh' ? 'en' : 'zh';
  if (label) label.textContent = current === 'zh' ? '中文' : 'EN';
  btn.title = current === 'zh' ? 'Switch to English' : '切换为中文';
  btn.addEventListener('click', () => window.TradeFlowI18n.setLang(other));
});

// Self-wiring: translate any data-i18n-annotated static markup on the page
// (see applyStatic above) once the language file has loaded.
window.TradeFlowI18n.ready(() => window.TradeFlowI18n.applyStatic());
