/*
 * Three jobs for a signed-in user, on every stock-market page:
 *
 *  1. HYDRATE - runs synchronously (via a blocking XHR) the moment this
 *     script tag is parsed. Must be a plain <script src> placed in the
 *     static HTML *before* the ScriptLoader-driven trading scripts start
 *     loading (those kick off on DOMContentLoaded, which only fires after
 *     this tag has finished running) - see terminal.html/dashboard.html/
 *     zen.html/index.html. This guarantees portfolio.js's very first
 *     `localStorage.getItem('stock_portfolio')` already sees this
 *     account's saved state, not last session's or nothing at all. Also
 *     hydrates every `stock_alerts_<SYMBOL>` key price-alerts.js reads, so
 *     alerts set on another device/browser show up here too - see job 3.
 *     It also sets window.TL_SIGNED_IN, which
 *     pages/auth/order-authority.js (loaded right after this file) checks
 *     before doing anything.
 *
 *  2. WATCH WATCHLIST - every few seconds, push the watchlist (only) up if
 *     it changed. Positions/working orders/trade history are NOT synced
 *     from here anymore - api/orders/*.php (via order-authority.js) now
 *     writes those one event at a time, with server-verified prices, as
 *     they happen. Mirroring the whole portfolio wholesale on a timer the
 *     way this used to is exactly the gap "server-side price authority"
 *     closed (see docs/SETUP_AUTH.md) - a modified browser could otherwise
 *     just report whatever positions/balance it wanted and have this push
 *     them straight into the database.
 *
 *  3. WATCH ALERTS - same idea, for price-alerts.js's per-symbol
 *     `stock_alerts_<SYMBOL>` localStorage keys. Alerts have no financial
 *     consequence (they're just browser-notification triggers - the
 *     trigger check itself stays entirely client-side in
 *     price-alerts.js's checkAlertTriggers()), so unlike positions/orders
 *     there's nothing to protect here; this is purely a "your alerts
 *     follow you across devices" convenience, same trust model as the
 *     watchlist.
 *
 * Logged-out visitors: the very first bootstrap call reports
 * authenticated:false and this script does nothing else - the pre-existing
 * localStorage-only behavior is untouched.
 */
(function () {
  var API_BASE = '../api';
  var PORTFOLIO_KEY = 'stock_portfolio';
  var WATCHLIST_KEY = 'stock_watchlist';
  var ALERTS_PREFIX = 'stock_alerts_'; // price-alerts.js: STORAGE_PREFIX + symbol
  var DEFAULT_PORTFOLIO = { balance: 100000, positions: [], workingOrders: [], history: [] };
  var PUSH_INTERVAL_MS = 3000;

  function syncRequest(method, url, body) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, false); // synchronous - see file header for why
      if (body !== undefined) {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(body));
      } else {
        xhr.send();
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        return xhr.responseText ? JSON.parse(xhr.responseText) : {};
      }
    } catch (e) {
      /* offline or server unreachable - degrade to whatever localStorage already has */
    }
    return null;
  }

  function readLocal(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeLocal(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* private-browsing / storage full - trading engine still works, just unsynced */
    }
  }

  function allLocalAlertSymbols() {
    var symbols = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf(ALERTS_PREFIX) === 0) {
          symbols.push(key.slice(ALERTS_PREFIX.length));
        }
      }
    } catch (e) { /* ignore */ }
    return symbols;
  }

  // Flattens every stock_alerts_<SYMBOL> key into [{id, symbol, price}, ...]
  // (the shape api/state/save.php's tl_validate_alerts_payload expects).
  function readAllLocalAlertsFlat() {
    var flat = [];
    allLocalAlertSymbols().forEach(function (symbol) {
      var arr = readLocal(ALERTS_PREFIX + symbol, []);
      if (Array.isArray(arr)) {
        arr.forEach(function (a) {
          if (a && a.id != null && typeof a.price === 'number') {
            flat.push({ id: a.id, symbol: symbol, price: a.price });
          }
        });
      }
    });
    return flat;
  }

  // Writes the server's grouped {SYMBOL: [{id,price},...]} shape back into
  // per-symbol localStorage keys - server wins, so any local symbol NOT
  // present server-side (e.g. its last alert was removed on another
  // device) gets cleared too, not just left stale.
  function writeAllAlertsFromServer(grouped) {
    grouped = grouped || {};
    var existing = allLocalAlertSymbols();
    existing.forEach(function (symbol) {
      if (!Object.prototype.hasOwnProperty.call(grouped, symbol)) {
        try { localStorage.removeItem(ALERTS_PREFIX + symbol); } catch (e) { /* ignore */ }
      }
    });
    Object.keys(grouped).forEach(function (symbol) {
      writeLocal(ALERTS_PREFIX + symbol, grouped[symbol]);
    });
  }

  var boot = syncRequest('GET', API_BASE + '/state/bootstrap.php');
  window.TL_SIGNED_IN = !!(boot && boot.authenticated);
  if (!boot || !boot.authenticated) {
    return;
  }

  var lastPushedWatchlistJSON;
  var lastPushedAlertsJSON;

  if (boot.hasServerData) {
    // Returning session - possibly a different browser/device - server wins.
    writeLocal(PORTFOLIO_KEY, boot.portfolio);
    if (boot.watchlist !== null) {
      writeLocal(WATCHLIST_KEY, boot.watchlist);
    }
    if (boot.alerts !== null) {
      writeAllAlertsFromServer(boot.alerts);
    }
    lastPushedWatchlistJSON = JSON.stringify(boot.watchlist);
    lastPushedAlertsJSON = JSON.stringify(readAllLocalAlertsFlat());
  } else {
    // Brand new account, or first time this feature has run for it - import
    // whatever is already sitting in this browser (a fresh $100k default,
    // or a developer's existing test trades/alerts) instead of wiping it
    // out. api/state/seed.php only ever does this once per account - safe
    // to call unconditionally here even from multiple tabs.
    var localPortfolio = readLocal(PORTFOLIO_KEY, DEFAULT_PORTFOLIO);
    var localWatchlist = readLocal(WATCHLIST_KEY, null); // null = let stock-app.prod.js's own default apply; picked up next tick
    var localAlerts = readAllLocalAlertsFlat();
    syncRequest('POST', API_BASE + '/state/seed.php', { portfolio: localPortfolio, watchlist: localWatchlist, alerts: localAlerts });
    lastPushedWatchlistJSON = JSON.stringify(localWatchlist);
    lastPushedAlertsJSON = JSON.stringify(localAlerts);
  }

  function push(payload, useBeacon) {
    if (useBeacon && navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(API_BASE + '/state/save.php', blob);
      return;
    }
    fetch(API_BASE + '/state/save.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(function () {
      /* will retry next tick once localStorage still differs from last-confirmed push */
    });
  }

  function tick(useBeacon) {
    var watchlist = readLocal(WATCHLIST_KEY, null);
    var watchlistJSON = JSON.stringify(watchlist);
    var alerts = readAllLocalAlertsFlat();
    var alertsJSON = JSON.stringify(alerts);

    var watchlistChanged = watchlistJSON !== lastPushedWatchlistJSON;
    var alertsChanged = alertsJSON !== lastPushedAlertsJSON;
    if (!watchlistChanged && !alertsChanged) {
      return;
    }

    var payload = {};
    if (watchlistChanged) {
      payload.watchlist = watchlist;
      lastPushedWatchlistJSON = watchlistJSON;
    }
    if (alertsChanged) {
      payload.alerts = alerts;
      lastPushedAlertsJSON = alertsJSON;
    }
    push(payload, useBeacon);
  }

  setInterval(function () { tick(false); }, PUSH_INTERVAL_MS);
  window.addEventListener('beforeunload', function () { tick(true); });
})();
