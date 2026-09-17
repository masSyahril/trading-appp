/*
 * TradeLite i18n core engine.
 *
 * Include this script on any page - it locates its own translation files
 * relative to wherever i18n.js itself is served from, so the same <script
 * src="..."> tag works no matter how deep the page sits in the folder tree.
 * Then mark up translatable elements:
 *
 *   <h1 data-i18n="hub.hero.title">Choose Your Trading Platform</h1>
 *   <input data-i18n-placeholder="auth.login.emailPlaceholder">
 *   <nav aria-label="Main navigation" data-i18n-aria-label="nav.mainLabel">
 *
 * The English text already sitting in the HTML is the fallback shown before
 * this script finishes loading, and again if a key is ever missing - so
 * every page still reads correctly with this script slow, blocked, or gone.
 *
 * JS that needs a translated string directly (alerts, dynamically-built
 * markup, alert() dialogs) calls TLI18n.t('some.key', { placeholders: 'x' }).
 *
 * Language choice is a plain browser preference for now (localStorage), not
 * yet tied to the signed-in account - see docs/I18N.md for why and what a
 * future account-linked version would need.
 */
(function () {
  var SCRIPT_URL = document.currentScript && document.currentScript.src;
  var BASE_URL = SCRIPT_URL ? new URL('.', SCRIPT_URL).href : './';
  var STORAGE_KEY = 'tl_lang';
  var SUPPORTED = ['en', 'zh-TW'];
  var FALLBACK = 'en';
  var HTML_LANG = { en: 'en', 'zh-TW': 'zh-Hant-TW' };

  var data = {};        // { en: {...}, 'zh-TW': {...} }
  var loaded = {};      // which locales have finished loading (success or not)
  var currentLocale = detectInitialLocale();
  var readyResolve, readyReject;
  var readyPromise = new Promise(function (resolve, reject) {
    readyResolve = resolve;
    readyReject = reject;
  });

  function detectInitialLocale() {
    try {
      var saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    } catch (e) {
      // localStorage unavailable (private mode, locked-down browser) - fall
      // through to browser-language detection for this page load.
    }

    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < langs.length; i++) {
      if (/^zh/i.test(langs[i])) return 'zh-TW';
    }
    return FALLBACK;
  }

  function fetchLocale(locale) {
    if (loaded[locale]) return Promise.resolve(data[locale]);
    return fetch(BASE_URL + locale + '.json', { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        data[locale] = json;
        loaded[locale] = true;
        return json;
      })
      .catch(function (err) {
        console.warn('[TLI18n] Failed to load locale "' + locale + '":', err.message);
        data[locale] = data[locale] || {};
        loaded[locale] = true;
        return data[locale];
      });
  }

  function resolveKey(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object' || !(parts[i] in cur)) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, function (m, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
    });
  }

  function t(key, vars) {
    var val = resolveKey(data[currentLocale], key);
    if (val === undefined && currentLocale !== FALLBACK) {
      val = resolveKey(data[FALLBACK], key);
    }
    if (val === undefined) {
      console.warn('[TLI18n] Missing translation key:', key);
      return key;
    }
    return typeof val === 'string' ? interpolate(val, vars) : val;
  }

  function applyTranslations(root) {
    root = root || document;

    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });

    document.documentElement.setAttribute('lang', HTML_LANG[currentLocale] || currentLocale);
  }

  function setLocale(locale) {
    if (SUPPORTED.indexOf(locale) === -1 || locale === currentLocale) return Promise.resolve();
    return fetchLocale(locale).then(function () {
      currentLocale = locale;
      try {
        window.localStorage.setItem(STORAGE_KEY, locale);
      } catch (e) {
        // Ignore - the switch still works for the rest of this page view,
        // it just won't be remembered on the next one.
      }
      applyTranslations(document);
      window.dispatchEvent(new CustomEvent('tl:localechange', { detail: { locale: locale } }));
    });
  }

  function init() {
    Promise.all([fetchLocale(FALLBACK), fetchLocale(currentLocale)])
      .then(function () {
        applyTranslations(document);
        readyResolve();
        window.dispatchEvent(new CustomEvent('tl:localeready', { detail: { locale: currentLocale } }));
      })
      .catch(readyReject);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TLI18n = {
    t: t,
    getLocale: function () { return currentLocale; },
    setLocale: setLocale,
    supportedLocales: SUPPORTED.slice(),
    applyTranslations: applyTranslations,
    ready: readyPromise,
  };
})();
