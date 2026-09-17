/*
 * Crypto counterpart of pages/auth/portfolio-sync.js - same two jobs, for
 * crypto-trading/index.html instead of the stock-market pages:
 *
 *  1. HYDRATE - runs synchronously (blocking XHR) the moment this script
 *     tag is parsed, which must be BEFORE crypto-app.prod.js's ScriptLoader
 *     kicks off on DOMContentLoaded - see crypto-trading/index.html. This
 *     guarantees crypto-app.prod.js's first `loadLS(CRYPTO_LS_KEYS.positions, ...)`
 *     already sees this account's server-side position book, not
 *     whatever was last in this browser. Also sets window.TL_SIGNED_IN,
 *     which pages/auth/crypto-order-authority.js (loaded right after this
 *     file) checks before doing anything.
 *
 *  2. WATCH - every few seconds, push the watchlist (only) up if it
 *     changed. Positions/orders are never pushed wholesale from here -
 *     api/crypto/order.php (via crypto-order-authority.js) writes those
 *     one fill at a time with a server-verified price, same principle as
 *     the stock side's "server-side price authority" (see
 *     docs/SETUP_AUTH.md).
 *
 * The localStorage key names below ('crypto_watchlist', 'crypto_positions',
 * 'crypto_orders') are hardcoded to match crypto-app.prod.js's own
 * CRYPTO_LS_KEYS constant - this file runs before that one is loaded, so it
 * can't read that constant off window.cryptoApp yet.
 *
 * Logged-out visitors: the first bootstrap call reports authenticated:false
 * and this script does nothing else - the pre-existing localStorage-only
 * behavior is untouched.
 */
(function () {
  var API_BASE = '../api';
  var POSITIONS_KEY = 'crypto_positions';
  var ORDERS_KEY = 'crypto_orders';
  var WATCHLIST_KEY = 'crypto_watchlist';
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

  var boot = syncRequest('GET', API_BASE + '/crypto/bootstrap.php');
  window.TL_SIGNED_IN = !!(boot && boot.authenticated);
  if (!boot || !boot.authenticated) {
    return;
  }

  var lastPushedWatchlistJSON;

  if (boot.hasServerData) {
    // Returning session - server wins.
    writeLocal(POSITIONS_KEY, boot.positions || {});
    writeLocal(ORDERS_KEY, boot.orders || []);
    if (boot.watchlist !== null) {
      writeLocal(WATCHLIST_KEY, boot.watchlist);
    }
    lastPushedWatchlistJSON = JSON.stringify(boot.watchlist);
  } else {
    // Brand new account (crypto-wise) - import whatever is already sitting
    // in this browser instead of wiping it out. api/crypto/seed.php only
    // ever does this once per account.
    var localPositions = readLocal(POSITIONS_KEY, {});
    var localOrders = readLocal(ORDERS_KEY, []);
    var localWatchlist = readLocal(WATCHLIST_KEY, null); // null = let crypto-app.prod.js's own default apply
    syncRequest('POST', API_BASE + '/crypto/seed.php', { positions: localPositions, orders: localOrders, watchlist: localWatchlist });
    lastPushedWatchlistJSON = JSON.stringify(localWatchlist);
  }

  function push(watchlist, useBeacon) {
    var payload = { watchlist: watchlist };
    if (useBeacon && navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(API_BASE + '/crypto/save-watchlist.php', blob);
      return;
    }
    fetch(API_BASE + '/crypto/save-watchlist.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(function () {
      /* will retry next tick once localStorage differs from last-confirmed push again */
    });
  }

  function tick(useBeacon) {
    var watchlist = readLocal(WATCHLIST_KEY, null);
    var watchlistJSON = JSON.stringify(watchlist);
    if (watchlistJSON === lastPushedWatchlistJSON) {
      return;
    }
    lastPushedWatchlistJSON = watchlistJSON;
    push(watchlist, useBeacon);
  }

  setInterval(function () { tick(false); }, PUSH_INTERVAL_MS);
  window.addEventListener('beforeunload', function () { tick(true); });
})();
