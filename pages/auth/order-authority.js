/*
 * Signed-in-only integration layer between the trading UI
 * (stock-market/js/order-panel.js + portfolio.js) and the server-
 * authoritative order endpoints (api/orders/*.php). Loaded as a plain,
 * early <script> tag right next to portfolio-sync.js on every stock-market
 * page (see that file's own header for why these have to be classic,
 * synchronously-loaded scripts rather than deferred/ScriptLoader-driven
 * ones).
 *
 * What this fixes: before this, portfolio.js decided every fill price,
 * stop-loss/take-profit hit and limit/stop trigger itself, from whatever
 * window.TradeFlowChart.getLastPrice() said, and portfolio-sync.js just
 * mirrored the result into the database as-is - a modified browser could
 * claim any fill price it wanted. Now, for a signed-in user: market fills
 * and closes are confirmed against the server's own live-price fetch
 * (api/lib/quotes.php) before they're recorded as real, and limit/stop
 * triggers + stop-loss/take-profit hits are decided by the server's own
 * periodic reconciliation (api/orders/check-fills.php) instead of the
 * client's local polling.
 *
 * Logged-out / local-only use is completely untouched: this script checks
 * window.TL_SIGNED_IN (set by portfolio-sync.js, which runs first) and
 * does nothing at all if it isn't true.
 *
 * Network/API failures degrade to the original local-only behavior rather
 * than breaking the trading UI - paper trading staying slightly
 * un-reconciled for a few seconds is a far smaller problem than the order
 * ticket silently stopping working. Each fallback is logged to the console
 * so it's visible during development/testing.
 */
(function () {
  var API_BASE = '../api';
  var CHECK_FILLS_INTERVAL_MS = 5000;

  waitForSeam(init);

  function waitForSeam(cb) {
    var attempts = 0;
    var iv = setInterval(function () {
      attempts++;
      if (window.TradeFlowPortfolio) {
        clearInterval(iv);
        cb();
      } else if (attempts > 100) {
        clearInterval(iv);
        console.error('order-authority: window.TradeFlowPortfolio seam never appeared');
      }
    }, 100);
  }

  function init() {
    if (!window.TL_SIGNED_IN) {
      return; // logged-out / local-only session - leave portfolio.js exactly as it is
    }

    var TP = window.TradeFlowPortfolio;
    var originalSubmitOrder = TP.submitOrder;
    var originalClosePosition = TP.closePosition;
    var originalCancelOrder = TP.cancelOrder;
    var originalEditOrderPrice = TP.editOrderPrice;

    // The server's own reconciliation (check-fills.php) is now what decides
    // limit/stop triggers and stop-loss/take-profit hits - stop the local
    // polling from also deciding (and racing with) the same fills.
    TP.setLocalAutoTriggersEnabled(false);

    TP.submitOrder = function (order) {
      if (order.type !== 'market') {
        // No fill decision at placement time for a limit/stop order (the
        // trigger price is the user's own target, not a fill) - keep the
        // instant local UX, and mirror it server-side in the background so
        // check-fills.php has its own copy to reconcile against.
        originalSubmitOrder(order);
        postJson('/orders/place.php', orderToPlacePayload(order)).catch(function (err) {
          console.warn('order-authority: failed to register working order server-side (will stay local-only until next successful sync):', err);
        });
        return;
      }

      postJson('/orders/place.php', orderToPlacePayload(order)).then(function (res) {
        if (res && res.ok && res.position) {
          TP.addServerPosition(res.position);
        } else {
          throw new Error('Unexpected response from place.php');
        }
      }).catch(function (err) {
        console.warn('order-authority: server-priced market fill failed, falling back to local price:', err);
        originalSubmitOrder(order);
      });
    };

    TP.closePosition = function (id) {
      postJson('/orders/close.php', { id: id }).then(function (res) {
        if (res && res.ok) {
          TP.closePositionAtPrice(id, res.exitPrice, res.reason || 'Closed');
        } else {
          throw new Error('Unexpected response from close.php');
        }
      }).catch(function (err) {
        console.warn('order-authority: server-priced close failed, falling back to local price:', err);
        originalClosePosition(id);
      });
    };

    TP.cancelOrder = function (id) {
      originalCancelOrder(id);
      postJson('/orders/cancel.php', { id: id }).catch(function (err) {
        console.warn('order-authority: failed to cancel working order server-side:', err);
      });
    };

    TP.editOrderPrice = function (id) {
      var order = TP.getWorkingOrder(id);
      if (!order) {
        originalEditOrderPrice(id);
        return;
      }
      var next = prompt('New trigger price for ' + order.symbol + ' ' + order.type + ':', order.price);
      if (next == null) return;
      var price = parseFloat(next);
      if (!isFinite(price)) return;

      postJson('/orders/edit-price.php', { id: id, price: price }).catch(function (err) {
        console.warn('order-authority: failed to update trigger price server-side (will be out of sync until the next reconciliation catches it):', err);
      }).then(function () {
        TP.updateWorkingOrderPrice(id, price);
      });
    };

    setInterval(checkFills, CHECK_FILLS_INTERVAL_MS);
    checkFills(); // don't wait a full interval for the first reconciliation

    function checkFills() {
      postJson('/orders/check-fills.php', {}).then(function (res) {
        if (res && res.ok) {
          TP.applyServerState(res.portfolio);
        }
      }).catch(function (err) {
        // Offline / server unreachable - local state just stays as it was
        // until the next successful poll. Not logged as a warning since
        // this runs every few seconds and a blip shouldn't be noisy.
      });
    }
  }

  function orderToPlacePayload(order) {
    return {
      clientId: order.id,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      size: order.size,
      price: order.price,
      leverage: order.leverage,
      sl: order.sl,
      tp: order.tp,
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
          throw new Error((data && data.error) || ('HTTP ' + resp.status));
        }
        return data;
      });
    });
  }
})();
