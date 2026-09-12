/*
 * TradeFlow interactive price alerts.
 * Click the Y-axis (price scale) or right-click anywhere on the main chart
 * canvas to add a horizontal alert line at that price. Clicking near an
 * existing alert's price removes it instead of adding a new one. When the
 * live price crosses an alert, fires a browser Notification (falling back to
 * an in-app toast if Notification isn't available/granted).
 * Talks to stock-app.prod.js only through the window.TradeFlowChart seam.
 */
(function () {
  const STORAGE_PREFIX = 'stock_alerts_';
  const PRICE_SCALE_GUTTER = 60; // px - roughly matches PRICE_SCALE_ALIGN_WIDTH plus a little slack
  const REMOVE_HIT_PX = 8;
  const CHECK_INTERVAL_MS = 3000;

  let chart = null;
  let chartEl = null;
  let currentSymbol = null;
  let alerts = [];               // [{ id, price, wasAbove }]
  const priceLines = new Map();  // id -> priceLine handle

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
        console.error('price-alerts: window.TradeFlowChart seam never appeared');
      }
    }, 100);
  }

  function init() {
    chart = window.TradeFlowChart.getChart();
    chartEl = document.getElementById('chart');
    if (!chart || !chartEl) {
      console.error('price-alerts: missing chart or #chart element');
      return;
    }

    currentSymbol = window.TradeFlowChart.getCurrentSymbol();
    loadAlerts();
    renderAllPriceLines();

    window.TradeFlowChart.onSymbolChange((sym) => {
      currentSymbol = sym;
      clearAllPriceLines();
      loadAlerts();
      renderAllPriceLines();
    });

    chartEl.addEventListener('click', onClick);
    chartEl.addEventListener('contextmenu', onRightClick);

    setInterval(checkAlertTriggers, CHECK_INTERVAL_MS);
  }

  // ─── Series/coordinate helpers ────────────────────────────────────────────
  function getSeries() {
    return window.TradeFlowChart.getCandleSeries();
  }

  function priceFromEvent(e) {
    const series = getSeries();
    if (!series) return null;
    const rect = chartEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Only the price pane has prices; indicator panes sit below it in the same element.
    const paneHeight = window.TradeFlowChart.getMainPaneHeight ? window.TradeFlowChart.getMainPaneHeight() : null;
    if (paneHeight > 0 && y > paneHeight) return null;
    try { return series.coordinateToPrice(y); } catch (err) { return null; }
  }

  function isOnPriceScale(e) {
    const rect = chartEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return x > rect.width - PRICE_SCALE_GUTTER;
  }

  function isDrawingToolActive() {
    const tool = window.TradeFlowActiveDrawTool;
    return !!tool && tool !== 'crosshair';
  }

  // ─── Interaction ──────────────────────────────────────────────────────────
  function onClick(e) {
    if (isDrawingToolActive()) return; // let trendline/measure/etc. own this click
    if (!isOnPriceScale(e)) return;
    toggleAlertAtEvent(e);
  }

  function onRightClick(e) {
    e.preventDefault();
    toggleAlertAtEvent(e);
  }

  function toggleAlertAtEvent(e) {
    const price = priceFromEvent(e);
    if (price == null || !isFinite(price)) return;

    const existing = findAlertNear(price);
    if (existing) {
      removeAlert(existing.id);
    } else {
      addAlert(price);
    }
  }

  function findAlertNear(price) {
    const series = getSeries();
    if (!series) return null;
    let closest = null;
    let closestDist = Infinity;
    alerts.forEach(a => {
      try {
        const y1 = series.priceToCoordinate(a.price);
        const y2 = series.priceToCoordinate(price);
        if (y1 == null || y2 == null) return;
        const d = Math.abs(y1 - y2);
        if (d <= REMOVE_HIT_PX && d < closestDist) { closest = a; closestDist = d; }
      } catch (err) {}
    });
    return closest;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────
  function addAlert(price) {
    const alert = { id: `alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`, price, wasAbove: undefined };
    alerts.push(alert);
    saveAlerts();
    renderPriceLine(alert);
    showToast(`Alert set at ${price.toFixed(2)}`);
  }

  function removeAlert(id) {
    alerts = alerts.filter(a => a.id !== id);
    const line = priceLines.get(id);
    const series = getSeries();
    if (line && series) {
      try { series.removePriceLine(line); } catch (e) {}
    }
    priceLines.delete(id);
    saveAlerts();
  }

  function renderPriceLine(alert) {
    const series = getSeries();
    if (!series) return;
    try {
      const line = series.createPriceLine({
        price: alert.price,
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: `🔔 ${alert.price.toFixed(2)}`,
      });
      priceLines.set(alert.id, line);
    } catch (e) {}
  }

  function renderAllPriceLines() {
    clearAllPriceLines();
    alerts.forEach(renderPriceLine);
  }

  function clearAllPriceLines() {
    const series = getSeries();
    priceLines.forEach(line => {
      if (series) { try { series.removePriceLine(line); } catch (e) {} }
    });
    priceLines.clear();
  }

  // ─── Persistence ──────────────────────────────────────────────────────────
  function storageKey() { return STORAGE_PREFIX + currentSymbol; }

  function loadAlerts() {
    try {
      const raw = localStorage.getItem(storageKey());
      alerts = raw ? JSON.parse(raw) : [];
    } catch (e) {
      alerts = [];
    }
  }

  function saveAlerts() {
    try {
      // Don't persist the transient wasAbove crossing-state
      const toSave = alerts.map(({ id, price }) => ({ id, price }));
      localStorage.setItem(storageKey(), JSON.stringify(toSave));
    } catch (e) {}
  }

  // ─── Trigger detection ────────────────────────────────────────────────────
  function checkAlertTriggers() {
    if (!alerts.length) return;
    const data = window.TradeFlowChart.getChartData();
    if (!data || !data.length) return;
    const lastClose = data[data.length - 1].close;

    alerts.forEach(alert => {
      const isAbove = lastClose >= alert.price;
      if (alert.wasAbove === undefined) {
        alert.wasAbove = isAbove;
        return;
      }
      if (isAbove !== alert.wasAbove) {
        alert.wasAbove = isAbove;
        const direction = isAbove ? 'crossed above' : 'crossed below';
        notify(`${currentSymbol} ${direction} ${alert.price.toFixed(2)} (now ${lastClose.toFixed(2)})`);
      }
    });
  }

  function notify(message) {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try { new Notification('TradeFlow Price Alert', { body: message }); } catch (e) {}
        showToast(message);
        return;
      }
      if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
    showToast(message);
  }

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
    }, 5000);
  }
})();
