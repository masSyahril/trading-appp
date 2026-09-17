/*
 * Crypto counterpart of pages/auth/order-authority.js. Crypto trading only
 * has market buy/sell (no limit/stop, no SL/TP - see crypto-app.prod.js),
 * so there's no reconciliation loop to run here, just one seam to fill in:
 * crypto-app.prod.js checks for `window.cryptoApp.requestServerFill` (an
 * optional hook it never assumes exists) before falling back to its own
 * local fill logic. This file supplies that hook for signed-in users only,
 * so a market order's fill price comes from api/crypto/order.php's
 * server-fetched Binance price instead of whatever price the browser's own
 * WebSocket feed last saw.
 *
 * Signed-out visitors: window.TL_SIGNED_IN is false (set by
 * pages/auth/crypto-sync.js, loaded right before this file), so init()
 * returns immediately and crypto-app.prod.js's local-only behavior is
 * completely untouched.
 */
(function () {
  var API_BASE = '../api';

  waitForSeam(init);

  function waitForSeam(cb) {
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (window.cryptoApp) {
        clearInterval(iv);
        cb();
      } else if (attempts > 100) {
        clearInterval(iv);
        console.error('crypto-order-authority: window.cryptoApp seam never appeared');
      }
    }, 100);
  }

  function init() {
    if (!window.TL_SIGNED_IN) {
      return;
    }

    window.cryptoApp.requestServerFill = function (order) {
      return postJson('/crypto/order.php', order).then(function (res) {
        if (res && res.ok) {
          return { price: res.price, position: res.position };
        }
        throw new Error('Unexpected response from crypto/order.php');
      });
    };
  }

  function postJson(path, body) {
    return fetch(API_BASE + path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (data) {
        if (!resp.ok) {
          throw new Error(data && data.error ? data.error : ('HTTP ' + resp.status));
        }
        return data;
      });
    });
  }
})();
