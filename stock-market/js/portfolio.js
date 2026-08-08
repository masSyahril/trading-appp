/*
 * TradeFlow paper-trading portfolio: open positions, working limit/stop
 * orders, closed-trade history, and an account summary - rendered into the
 * bottom drawer (#bottom-drawer in index.html). Order submission comes from
 * order-panel.js via window.TradeFlowPortfolio.submitOrder(); this module
 * owns all the state and persists it (account-wide, not per-symbol) to
 * localStorage. Talks to stock-app.prod.js only through window.TradeFlowChart.
 */
window.TradeFlowPortfolio = (function () {
  const STORAGE_KEY = 'stock_portfolio';
  const STARTING_BALANCE = 100000;
  const FILL_CHECK_INTERVAL_MS = 2000;

  let state = loadState();

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
        console.error('portfolio: window.TradeFlowChart seam never appeared');
      }
    }, 100);
  }

  function init() {
    setupTabs();
    setupCollapse();
    window.TradeFlowChart.onSymbolChange(() => render());
    setInterval(() => { checkWorkingOrderFills(); checkPositionStops(); render(); }, FILL_CHECK_INTERVAL_MS);
    render();
  }

  // ─── State ────────────────────────────────────────────────────────────────
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.positions)) return parsed;
    } catch (e) {}
    return { balance: STARTING_BALANCE, positions: [], workingOrders: [], history: [] };
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // Live price for ANY watchlist symbol (not just whichever one is currently
  // charted) - renderWatchlist() in stock-app.prod.js keeps this fresh for
  // every symbol, so positions in a symbol you've since navigated away from
  // still mark-to-market correctly instead of freezing at entry price.
  function currentPrice(symbol) {
    const p = window.TradeFlowChart.getLastPrice(symbol);
    return typeof p === 'number' && isFinite(p) ? p : null;
  }

  // ─── Order submission / fills ──────────────────────────────────────────────
  function submitOrder(order) {
    if (order.type === 'market') {
      const price = currentPrice(order.symbol);
      openPosition({ ...order, entryPrice: price ?? 0 });
    } else {
      state.workingOrders.push(order);
      save();
      render();
      showToast(`${order.side.toUpperCase()} ${order.type} order placed: ${order.symbol} @ ${order.price.toFixed(2)}`);
    }
  }

  function openPosition(order) {
    const position = {
      id: order.id, symbol: order.symbol, side: order.side, size: order.size,
      leverage: order.leverage || 1, entryPrice: order.entryPrice,
      sl: order.sl || null, tp: order.tp || null, openedAt: order.createdAt || Date.now(),
    };
    state.positions.push(position);
    save();
    render();
    showToast(`${position.side.toUpperCase()} filled: ${position.size} ${position.symbol} @ ${position.entryPrice.toFixed(2)}`);
  }

  function closePosition(id) {
    const pos = state.positions.find(p => p.id === id);
    if (!pos) return;
    const exitPrice = currentPrice(pos.symbol) ?? pos.entryPrice;
    closePositionAt(pos, exitPrice, 'Closed');
  }

  function closePositionAt(pos, exitPrice, reason) {
    const idx = state.positions.findIndex(p => p.id === pos.id);
    if (idx === -1) return;
    const pnl = (exitPrice - pos.entryPrice) * pos.size * (pos.side === 'sell' ? -1 : 1);
    state.balance += pnl;
    state.history.unshift({ ...pos, exitPrice, pnl, closedAt: Date.now() });
    state.positions.splice(idx, 1);
    save();
    render();
    showToast(`${reason} ${pos.symbol}: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
  }

  // sl/tp are captured on every position at order time but, until now,
  // nothing ever checked live price against them - a stop-loss just sat
  // there forever without being able to fire. Same polling cadence/pattern
  // as checkWorkingOrderFills(). Direction depends on side: a long's stop is
  // below entry and target is above; a short is the mirror image.
  function checkPositionStops() {
    if (!state.positions.length) return;
    const toClose = [];
    state.positions.forEach(pos => {
      if (pos.sl == null && pos.tp == null) return;
      const price = currentPrice(pos.symbol);
      if (price == null) return;
      const isLong = pos.side !== 'sell';
      const hitSl = pos.sl != null && (isLong ? price <= pos.sl : price >= pos.sl);
      const hitTp = pos.tp != null && (isLong ? price >= pos.tp : price <= pos.tp);
      if (hitSl || hitTp) toClose.push({ pos, price, reason: hitSl ? 'Stop-loss hit' : 'Take-profit hit' });
    });
    toClose.forEach(({ pos, price, reason }) => closePositionAt(pos, price, reason));
  }

  function cancelOrder(id) {
    state.workingOrders = state.workingOrders.filter(o => o.id !== id);
    save();
    render();
  }

  function editOrderPrice(id) {
    const order = state.workingOrders.find(o => o.id === id);
    if (!order) return;
    const next = prompt(`New trigger price for ${order.symbol} ${order.type}:`, order.price);
    if (next == null) return;
    const price = parseFloat(next);
    if (!isFinite(price)) return;
    order.price = price;
    save();
    render();
  }

  // A limit/stop order "fills" the moment the live price crosses its trigger -
  // same polling approach as price-alerts.js's checkAlertTriggers.
  function checkWorkingOrderFills() {
    if (!state.workingOrders.length) return;
    const stillWorking = [];
    state.workingOrders.forEach(order => {
      const price = currentPrice(order.symbol);
      if (price == null) { stillWorking.push(order); return; }
      const triggered = order.type === 'limit'
        ? (order.side === 'buy' ? price <= order.price : price >= order.price)
        : (order.side === 'buy' ? price >= order.price : price <= order.price); // stop
      if (triggered) {
        openPosition({ ...order, entryPrice: price });
      } else {
        stillWorking.push(order);
      }
    });
    if (stillWorking.length !== state.workingOrders.length) {
      state.workingOrders = stillWorking;
      save();
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────
  function fmtMoney(n) {
    const sign = n < 0 ? '-' : '';
    return `${sign}$${Math.abs(n).toFixed(2)}`;
  }

  function emptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="drawer-empty">${message}</td></tr>`;
  }

  function render() {
    renderPositions();
    renderOrders();
    renderHistory();
    renderAccount();
    const cp = document.getElementById('count-positions');
    const co = document.getElementById('count-orders');
    if (cp) cp.textContent = state.positions.length;
    if (co) co.textContent = state.workingOrders.length;
  }

  function renderPositions() {
    const tbody = document.querySelector('#panel-positions tbody');
    if (!tbody) return;
    tbody.innerHTML = state.positions.map(p => {
      const cur = currentPrice(p.symbol) ?? p.entryPrice;
      const pnl = (cur - p.entryPrice) * p.size * (p.side === 'sell' ? -1 : 1);
      const pnlPct = p.entryPrice ? (pnl / (p.entryPrice * p.size)) * 100 : 0;
      const cls = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      return `<tr>
        <td>${p.symbol}</td>
        <td class="${p.side === 'buy' ? 'pnl-positive' : 'pnl-negative'}">${p.side.toUpperCase()}</td>
        <td>${p.size}</td><td>${p.entryPrice.toFixed(2)}</td><td>${cur.toFixed(2)}</td>
        <td class="${cls}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</td>
        <td class="${cls}">${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%</td>
        <td><button data-close="${p.id}" class="drawer-action-btn">Close</button></td>
      </tr>`;
    }).join('') || emptyRow(8, 'No open positions');

    tbody.querySelectorAll('[data-close]').forEach(btn =>
      btn.addEventListener('click', () => closePosition(btn.dataset.close))
    );
  }

  function renderOrders() {
    const tbody = document.querySelector('#panel-orders tbody');
    if (!tbody) return;
    tbody.innerHTML = state.workingOrders.map(o => `<tr>
      <td>${o.symbol}</td><td>${o.type.toUpperCase()}</td>
      <td class="${o.side === 'buy' ? 'pnl-positive' : 'pnl-negative'}">${o.side.toUpperCase()}</td>
      <td>${o.size}</td><td>${o.price.toFixed(2)}</td>
      <td>
        <button data-edit="${o.id}" class="drawer-action-btn">Edit</button>
        <button data-cancel="${o.id}" class="drawer-action-btn drawer-action-danger">Cancel</button>
      </td>
    </tr>`).join('') || emptyRow(6, 'No working orders');

    tbody.querySelectorAll('[data-cancel]').forEach(btn =>
      btn.addEventListener('click', () => cancelOrder(btn.dataset.cancel))
    );
    tbody.querySelectorAll('[data-edit]').forEach(btn =>
      btn.addEventListener('click', () => editOrderPrice(btn.dataset.edit))
    );
  }

  function renderHistory() {
    const tbody = document.querySelector('#panel-history tbody');
    if (!tbody) return;
    tbody.innerHTML = state.history.slice(0, 50).map(h => {
      const cls = h.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      return `<tr>
        <td>${h.symbol}</td>
        <td class="${h.side === 'buy' ? 'pnl-positive' : 'pnl-negative'}">${h.side.toUpperCase()}</td>
        <td>${h.size}</td><td>${h.entryPrice.toFixed(2)}</td><td>${h.exitPrice.toFixed(2)}</td>
        <td class="${cls}">${h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}</td>
        <td>${new Date(h.closedAt).toLocaleString()}</td>
      </tr>`;
    }).join('') || emptyRow(7, 'No closed trades yet');
  }

  function getAccountSummary() {
    const unrealized = state.positions.reduce((sum, p) => {
      const cur = currentPrice(p.symbol) ?? p.entryPrice;
      return sum + (cur - p.entryPrice) * p.size * (p.side === 'sell' ? -1 : 1);
    }, 0);
    const marginUsed = state.positions.reduce((sum, p) => sum + (p.entryPrice * p.size) / (p.leverage || 1), 0);
    const equity = state.balance + unrealized;
    const available = equity - marginUsed;
    return { balance: state.balance, equity, marginUsed, available };
  }

  function renderAccount() {
    const { balance, equity, marginUsed, available } = getAccountSummary();

    setText('acct-balance', fmtMoney(balance));
    setText('acct-equity', fmtMoney(equity));
    setText('acct-margin', fmtMoney(marginUsed));
    setText('acct-available', fmtMoney(available));

    const availEl = document.getElementById('acct-available');
    if (availEl) availEl.classList.toggle('margin-warning', available < 0);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ─── Tabs + collapse ────────────────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.drawer-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.drawer-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.drawer-panel').forEach(p => { p.hidden = p.id !== `panel-${tab.dataset.panel}`; });
      });
    });
  }

  function setupCollapse() {
    const drawer = document.getElementById('bottom-drawer');
    const btn = document.getElementById('drawer-collapse-btn');
    if (!drawer || !btn) return;
    btn.addEventListener('click', () => {
      drawer.classList.toggle('collapsed');
      try { localStorage.setItem('stock_drawer_collapsed', drawer.classList.contains('collapsed') ? 'true' : 'false'); } catch (e) {}
    });
  }

  // ─── Toasts (reuses the #alert-toast-container/.alert-toast CSS already
  // defined in index.html - same visual language as price-alerts.js's toasts) ─
  function showToast(message) {
    let container = document.getElementById('alert-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'alert-toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'alert-toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('alert-toast-out');
      setTimeout(() => el.remove(), 300);
    }, 4000);
  }

  return { submitOrder, closePosition, cancelOrder, editOrderPrice, getAccountSummary };
})();
