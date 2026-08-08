/*
 * TradeFlow order execution panel (#order-panel in index.html). Builds an
 * order object from the form and hands it to window.TradeFlowPortfolio -
 * this module owns none of the trading state itself, only the ticket UI.
 * Talks to stock-app.prod.js only through window.TradeFlowChart.
 */
(function () {
  let orderType = 'market';

  waitForSeam(init);

  function waitForSeam(cb) {
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      if (window.TradeFlowChart) {
        clearInterval(iv);
        cb();
      } else if (attempts > 100) {
        clearInterval(iv);
        console.error('order-panel: window.TradeFlowChart seam never appeared');
      }
    }, 100);
  }

  function init() {
    const symbolEl = document.getElementById('order-symbol');
    const updateSymbol = () => { if (symbolEl) symbolEl.textContent = window.TradeFlowChart.getCurrentSymbol(); };
    updateSymbol();
    window.TradeFlowChart.onSymbolChange(updateSymbol);

    document.querySelectorAll('.order-type-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        orderType = tab.dataset.type;
        document.querySelectorAll('.order-type-tab').forEach(t => t.classList.toggle('active', t === tab));
        const priceField = document.getElementById('order-price-field');
        const priceInput = document.getElementById('order-price');
        if (priceField) priceField.hidden = orderType === 'market';
        if (priceInput && !priceInput.value) {
          const last = lastPrice();
          if (last != null) priceInput.value = last.toFixed(2);
        }
        computeRR();
      });
    });

    ['order-size', 'order-price', 'order-sl', 'order-tp'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', computeRR);
    });

    document.querySelectorAll('.size-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => applyQuickSize(parseFloat(btn.dataset.sizePct)));
    });

    document.getElementById('btn-buy')?.addEventListener('click', () => placeOrder('buy'));
    document.getElementById('btn-sell')?.addEventListener('click', () => placeOrder('sell'));

    computeRR();
  }

  function lastPrice() {
    const symbol = window.TradeFlowChart.getCurrentSymbol();
    const p = window.TradeFlowChart.getLastPrice(symbol);
    return typeof p === 'number' && isFinite(p) ? p : null;
  }

  function entryPriceEstimate() {
    if (orderType === 'market') return lastPrice();
    const v = parseFloat(document.getElementById('order-price')?.value);
    return isFinite(v) ? v : null;
  }

  function computeRR() {
    const entry = entryPriceEstimate();
    const size = parseFloat(document.getElementById('order-size')?.value) || 0;
    const sl = parseFloat(document.getElementById('order-sl')?.value);
    const tp = parseFloat(document.getElementById('order-tp')?.value);

    const riskEl = document.getElementById('rr-risk');
    const rewardEl = document.getElementById('rr-reward');
    const ratioEl = document.getElementById('rr-ratio');
    if (!riskEl || !rewardEl || !ratioEl) return;

    if (entry == null || !size) {
      riskEl.textContent = '$0.00';
      rewardEl.textContent = '$0.00';
      ratioEl.textContent = '—';
      return;
    }

    const risk = isFinite(sl) ? Math.abs(entry - sl) * size : 0;
    const reward = isFinite(tp) ? Math.abs(tp - entry) * size : 0;
    riskEl.textContent = `$${risk.toFixed(2)}`;
    rewardEl.textContent = `$${reward.toFixed(2)}`;
    ratioEl.textContent = risk > 0 ? (reward / risk).toFixed(2) : '—';
  }

  // Quick position-size buttons (25/50/75/100%): size shares to spend that
  // percentage of currently-available buying power (equity minus margin
  // already committed to open positions), scaled by the selected leverage.
  function applyQuickSize(pct) {
    const entry = entryPriceEstimate();
    const sizeInput = document.getElementById('order-size');
    if (!sizeInput || entry == null || !isFinite(entry) || entry <= 0) return;

    const summary = window.TradeFlowPortfolio?.getAccountSummary?.();
    const available = summary ? Math.max(0, summary.available) : 0;
    const leverage = parseFloat(document.getElementById('order-leverage')?.value) || 1;

    const shares = Math.max(1, Math.floor((available * (pct / 100) * leverage) / entry));
    sizeInput.value = shares;
    computeRR();
  }

  function placeOrder(side) {
    const symbol = window.TradeFlowChart.getCurrentSymbol();
    const size = parseFloat(document.getElementById('order-size')?.value);
    if (!size || size <= 0) { alert('Enter a valid position size.'); return; }

    let price = null;
    if (orderType !== 'market') {
      price = parseFloat(document.getElementById('order-price')?.value);
      if (!isFinite(price) || price <= 0) { alert('Enter a valid trigger price.'); return; }
    }

    const sl = parseFloat(document.getElementById('order-sl')?.value);
    const tp = parseFloat(document.getElementById('order-tp')?.value);
    const leverage = parseFloat(document.getElementById('order-leverage')?.value) || 1;

    const order = {
      id: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      symbol, side, type: orderType, size, price, leverage,
      sl: isFinite(sl) ? sl : null,
      tp: isFinite(tp) ? tp : null,
      createdAt: Date.now(),
    };

    window.TradeFlowPortfolio?.submitOrder(order);
  }
})();
