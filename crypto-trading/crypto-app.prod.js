/* TradeLite Crypto Trading App — Binance public REST + WebSocket (real-time klines & tickers) */
(function () {
  const BINANCE_KLINE_BASES = [
    'https://data-api.binance.vision/api/v3/klines',
    'https://api.binance.com/api/v3/klines',
  ];
  const BINANCE_WS_STREAM = 'wss://stream.binance.com:9443/stream';
  const BINANCE_WS_KLINE = 'wss://stream.binance.com:9443/ws';

  // Crypto-specific configuration
  const DEFAULT_CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "XRPUSDT"];
  const DEFAULT_TIMEFRAME = "1m";
  
  // Separate localStorage keys for crypto trading
  const CRYPTO_LS_KEYS = {
    watchlist: "crypto_watchlist",
    positions: "crypto_positions",
    orders: "crypto_orders",
    localCandles: "crypto_local_candles"
  };

  // State
  let watchlist = loadLS(CRYPTO_LS_KEYS.watchlist, DEFAULT_CRYPTO_SYMBOLS);
  let positions = loadLS(CRYPTO_LS_KEYS.positions, {});
  let orders = loadLS(CRYPTO_LS_KEYS.orders, []);
  let localCandles = loadLS(CRYPTO_LS_KEYS.localCandles, {});

  let currentSymbol = watchlist[0] || "BTCUSDT";
  let timeframe = DEFAULT_TIMEFRAME;
  let orderSide = "buy";

  // Live prices for symbols in watchlist
  const lastPrice = {};
  const changePct = {};

  let watchlistSocket = null;
  let chartSocket = null;
  let chartLoadGen = 0; // fix 2026-09-19: bumped each loadCandlesAndSubscribe() call to detect/drop stale (superseded) symbol/timeframe switches
  let csvExportInProgress = false;
  let csvExportAbortController = null;

  /** Live 1m capture: REST seed (≤1000 closed bars) + dedicated kline_1m WS (k.x only). */
  let liveMinuteCapture = { active: false, seeding: false, rows: [], socket: null, symbol: null };
  let liveMinuteSeedGen = 0;

  function onCsvExportEscapeKey(ev) {
    if (ev.key !== 'Escape' || !csvExportInProgress) return;
    ev.preventDefault();
    csvExportAbortController?.abort();
  }

  // Chart components
  let chart = null;
  let candleSeries = null;
  let chartData = [];

  // Multi-Indicator System
  let indicatorSystem = null;
  let panelIds = [];

  // DOM Elements - will be initialized after DOM is ready
  let el = {};

  // Handle URL parameters for symbol linking
  try {
    const params = new URLSearchParams(window.location.search);
    const urlSym = (params.get('symbol') || '').toUpperCase().trim();
    if (urlSym && isCryptoSymbol(urlSym)) {
      currentSymbol = urlSym;
      if (!watchlist.includes(urlSym)) {
        watchlist.unshift(urlSym);
        saveLS(CRYPTO_LS_KEYS.watchlist, watchlist);
      }
    }
  } catch {}

  // Initialize the app after DOM and libraries are loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already loaded, check for LightweightCharts
    if (typeof LightweightCharts !== 'undefined') {
      init();
    } else {
      // Wait a bit more for the library to load
      setTimeout(() => {
        if (typeof LightweightCharts !== 'undefined') {
          init();
        } else {
          console.error('❌ LightweightCharts library failed to load');
          alert('Chart library failed to load. Please refresh the page.');
        }
      }, 1000);
    }
  }

  function init() {
    // Wait a bit more to ensure DOM is fully rendered
    setTimeout(() => {
      initializeDOMElements();
      
      if (!validateDOMElements()) {
        console.error('❌ Critical DOM elements not found!');
        return;
      }

      renderWatchlist();
    setupChart();
    setupChartControls();
    setupIndicatorSystem();
    setupThemeSync();
    syncSymbolHeader();
      connectWatchlistStream();
      loadCandlesAndSubscribe(currentSymbol, timeframe);
      renderPositions();
      renderOrders();
      setupEventHandlers();
      
      // Show crypto-specific welcome message
    }, 100);
  }
  
  function initializeDOMElements() {
    el = {
      watchlist: document.getElementById("watchlist"),
      symbolInput: document.getElementById("symbol-input"),
      symbolInputMobile: document.getElementById("symbol-input-mobile"),
      addSymbol: document.getElementById("add-symbol"),
      addSymbolMobile: document.getElementById("add-symbol-mobile"),
      resetData: document.getElementById("reset-data"),
      symbolTitle: document.getElementById("symbol-title"),
      lastPrice: document.getElementById("last-price"),
      priceChange: document.getElementById("price-change"),
      chart: document.getElementById("chart"),
      indicatorCount: document.getElementById("indicator-count"),
      tfButtons: Array.from(document.querySelectorAll(".tab-btn[data-tf]")),
      sideBuy: document.getElementById("side-buy"),
      sideSell: document.getElementById("side-sell"),
      orderQty: document.getElementById("order-qty"),
      placeOrder: document.getElementById("place-order"),
      positionsTable: document.getElementById("positions-table")?.querySelector("tbody"),
      ordersTable: document.getElementById("orders-table")?.querySelector("tbody"),
    };
  }
  
  function validateDOMElements() {
    const requiredElements = ['watchlist', 'chart', 'symbolTitle', 'lastPrice', 'priceChange'];
    const missing = [];
    
    requiredElements.forEach(key => {
      if (!el[key]) {
        missing.push(key);
      }
    });
    
    if (missing.length > 0) {
      console.error('❌ Missing required DOM elements:', missing);
      return false;
    }
    return true;
  }

  function setupEventHandlers() {
    if (el.addSymbol) el.addSymbol.addEventListener("click", addSymbolToWatchlist);
    if (el.addSymbolMobile) el.addSymbolMobile.addEventListener("click", addSymbolToWatchlist);
    if (el.symbolInput) {
      el.symbolInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") el.addSymbol?.click();
      });
      el.symbolInput.addEventListener("input", () => {
        if (el.symbolInputMobile) el.symbolInputMobile.value = el.symbolInput.value;
      });
    }
    if (el.symbolInputMobile) {
      el.symbolInputMobile.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addSymbolToWatchlist();
      });
      el.symbolInputMobile.addEventListener("input", () => {
        if (el.symbolInput) el.symbolInput.value = el.symbolInputMobile.value;
      });
    }
    if (el.resetData) el.resetData.addEventListener("click", resetTradingData);

    if (el.tfButtons && el.tfButtons.length > 0) {
      el.tfButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          el.tfButtons.forEach((b) => {
            b.classList.remove("active", "text-blue-400", "bg-slate-700/50", "font-bold");
            b.classList.add("text-slate-400");
          });
          btn.classList.add("active", "text-blue-400", "bg-slate-700/50", "font-bold");
          btn.classList.remove("text-slate-400");
          timeframe = btn.getAttribute("data-tf");
          loadCandlesAndSubscribe(currentSymbol, timeframe);
        });
      });
    }

    if (el.sideBuy) el.sideBuy.addEventListener("click", () => setSide("buy"));
    if (el.sideSell) el.sideSell.addEventListener("click", () => setSide("sell"));
    if (el.placeOrder) el.placeOrder.addEventListener("click", placeMarketOrder);
  }

  function getSymbolDraft() {
    return (el.symbolInput?.value || el.symbolInputMobile?.value || "").toUpperCase().trim();
  }

  function clearSymbolDraft() {
    if (el.symbolInput) el.symbolInput.value = "";
    if (el.symbolInputMobile) el.symbolInputMobile.value = "";
  }

  function addSymbolToWatchlist() {
    const raw = getSymbolDraft();
    if (!raw) return;

    if (!isCryptoSymbol(raw)) {
      alert("Please enter a valid Binance pair (e.g., BTCUSDT, ETHUSDT).");
      return;
    }

    if (watchlist.includes(raw)) {
      focusSymbol(raw);
      clearSymbolDraft();
      return;
    }

    watchlist.push(raw);
    saveLS(CRYPTO_LS_KEYS.watchlist, watchlist);
    renderWatchlist();
    connectWatchlistStream();
    focusSymbol(raw);
    clearSymbolDraft();
  }

  function resetTradingData() {
    if (!confirm("Reset all crypto trading data (positions, orders)? Watchlist will be kept.")) return;
    
    positions = {};
    orders = [];
    saveLS(CRYPTO_LS_KEYS.positions, positions);
    saveLS(CRYPTO_LS_KEYS.orders, orders);
    renderPositions();
    renderOrders();
  }

  function setSide(side) {
    if (!el.sideBuy || !el.sideSell) return;
    orderSide = side === "sell" ? "sell" : "buy";
    const reset = (btn) => {
      btn.classList.remove(
        "bg-emerald-600", "bg-red-600", "bg-slate-800",
        "text-white", "text-slate-300", "hover:bg-slate-700"
      );
    };
    reset(el.sideBuy);
    reset(el.sideSell);
    if (orderSide === "buy") {
      el.sideBuy.classList.add("bg-emerald-600", "text-white");
      el.sideSell.classList.add("bg-slate-800", "text-slate-300", "hover:bg-slate-700");
    } else {
      el.sideSell.classList.add("bg-red-600", "text-white");
      el.sideBuy.classList.add("bg-slate-800", "text-slate-300", "hover:bg-slate-700");
    }
  }

  function focusSymbol(sym) {
    if (!sym || !isCryptoSymbol(sym)) return;
    
    currentSymbol = sym;
    syncSymbolHeader();
    highlightActiveWatchlist();
    loadCandlesAndSubscribe(currentSymbol, timeframe);
    syncLiveMinuteCaptureOnSymbolChange();
  }

  function syncSymbolHeader() {
    if (el.symbolTitle) el.symbolTitle.textContent = formatCryptoDisplay(currentSymbol);
    const lp = lastPrice[currentSymbol];
    const ch = changePct[currentSymbol];
    const lastPriceBase = "font-mono text-sm sm:text-base";
    if (el.lastPrice) {
      el.lastPrice.textContent = lp ? formatCryptoPrice(lp) : "—";
      if (ch == null) el.lastPrice.className = `${lastPriceBase} text-white`;
      else if (ch >= 0) el.lastPrice.className = `${lastPriceBase} text-red-400`;
      else el.lastPrice.className = `${lastPriceBase} text-emerald-400`;
    }
    if (!el.priceChange) return;
    if (ch == null) {
      el.priceChange.textContent = "—";
      el.priceChange.className = "text-xs text-slate-400";
    } else {
      el.priceChange.textContent = `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`;
      /* + change = red, − change = green (same as candle / watchlist) */
      el.priceChange.className = ch >= 0
        ? "text-xs font-medium text-red-400"
        : "text-xs font-medium text-emerald-400";
    }
  }

  function renderWatchlist() {
    if (!el.watchlist) return;
    el.watchlist.innerHTML = "";

    if (watchlist.length === 0) {
      const emptyMsg = document.createElement("li");
      emptyMsg.className = "p-4 text-center text-slate-400 text-sm";
      emptyMsg.textContent = "No pairs in watchlist";
      el.watchlist.appendChild(emptyMsg);
      return;
    }

    watchlist.forEach((sym) => {
      const li = document.createElement("li");
      li.dataset.sym = sym;
      li.className = `p-3 border-b border-slate-800 cursor-pointer group relative ${
        sym === currentSymbol ? "bg-slate-800" : "hover:bg-slate-800/80"
      }`;

      const lp = lastPrice[sym];
      const ch = changePct[sym];
      const priceDisplay = lp != null ? formatCryptoPrice(lp) : "—";
      const changeDisplay = ch != null ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%` : "—";
      const changeColor = ch != null ? (ch >= 0 ? "text-red-400" : "text-emerald-400") : "text-slate-400";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className =
        "absolute top-2 right-2 p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700/80 opacity-0 group-hover:opacity-100 transition-opacity z-10";
      remove.setAttribute("aria-label", "Remove");
      remove.innerHTML = "×";
      remove.addEventListener("click", (e) => {
        e.stopPropagation();
        removeFromWatchlist(sym);
      });

      li.innerHTML = `
        <div class="flex justify-between items-start mb-1 pr-6">
          <span class="font-bold text-white text-sm">${formatCryptoDisplay(sym)}</span>
          <span class="font-mono text-white text-sm">${priceDisplay}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-slate-500">${sym}</span>
          <span class="${changeColor}">${changeDisplay}</span>
        </div>
      `;
      li.appendChild(remove);

      li.addEventListener("click", () => focusSymbol(sym));
      el.watchlist.appendChild(li);
    });
  }

  function removeFromWatchlist(sym) {
    watchlist = watchlist.filter((s) => s !== sym);
    saveLS(CRYPTO_LS_KEYS.watchlist, watchlist);
    
    if (currentSymbol === sym) {
      currentSymbol = watchlist[0] || "BTCUSDT";
      syncSymbolHeader();
      loadCandlesAndSubscribe(currentSymbol, timeframe);
      syncLiveMinuteCaptureOnSymbolChange();
    }
    
    renderWatchlist();
    connectWatchlistStream();
  }

  function highlightActiveWatchlist() {
    if (!el.watchlist) return;
    Array.from(el.watchlist.children).forEach((item) => {
      const sym = item.dataset.sym;
      if (!sym) return;
      if (sym === currentSymbol) {
        item.classList.add("bg-slate-800");
        item.classList.remove("hover:bg-slate-800/80");
      } else {
        item.classList.remove("bg-slate-800");
        item.classList.add("hover:bg-slate-800/80");
      }
    });
  }

  function connectWatchlistStream() {
    if (watchlistSocket) {
      try { watchlistSocket.close(); } catch (_) {}
      watchlistSocket = null;
    }

    if (!watchlist.length) return;

    const streams = watchlist.map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
    watchlistSocket = new WebSocket(`${BINANCE_WS_STREAM}?streams=${streams}`);

    watchlistSocket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const payload = msg.data || msg;
        const sym = payload.s || payload.symbol;

        if (!sym || !watchlist.includes(sym)) return;

        const priceStr = payload.c || payload.lastPrice;
        const openStr = payload.o || payload.openPrice;

        if (!priceStr || !openStr) return;

        const price = parseFloat(priceStr);
        const openPrice = parseFloat(openStr);

        lastPrice[sym] = price;
        changePct[sym] = ((price - openPrice) / openPrice) * 100;

        if (sym === currentSymbol) {
          syncSymbolHeader();
        }

        renderWatchlist();
        renderPositions();
      } catch (_) {}
    };

    watchlistSocket.onclose = () => {
      setTimeout(() => connectWatchlistStream(), 2000);
    };

    watchlistSocket.onerror = (err) => {
      console.error('Binance watchlist WebSocket error:', err);
    };
  }

  async function loadCandlesAndSubscribe(symbol, tf) {
    const gen = ++chartLoadGen; // fix 2026-09-19: this call's generation id
    if (chartSocket) {
      try { chartSocket.close(); } catch (_) {}
      chartSocket = null;
    }

    // fix 2026-09-19: setupChart() catches its own errors and can leave candleSeries null (e.g. the
    // charting library failed to load, or the container wasn't ready). Without this guard the next
    // line threw here, uncaught, which aborted init() before renderPositions()/renderOrders()/
    // setupEventHandlers() ran - silently disabling Buy/Sell/Place Order for the whole page.
    if (!candleSeries) {
      console.error('❌ Chart is not ready; skipping candle load for', symbol, tf);
      return;
    }

    // Clear chart data
    chartData = [];
    candleSeries.setData([]);

    // Check for local candles first
    const local = localCandles[symbol];
    if (local && local.length) {
      chartData = local.slice().sort((a, b) => a.time - b.time);
      // Ensure volume data is included
      chartData = chartData.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0
      }));
      candleSeries.setData(chartData.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      })));
      updateIndicators();
      
      // Set proper initial view boundaries
      setTimeout(() => {
        if (chartData.length > 0) {
          const dataMax = chartData.length - 1;
          const visibleCandles = Math.min(50, chartData.length);
          const range = {
            from: Math.max(0, dataMax - visibleCandles + 1),
            to: dataMax // Stop exactly at last data point
          };
          try {
            chart.timeScale().setVisibleLogicalRange(range);
          } catch (e) {
          }
        }
      }, 100);
      
      lastPrice[symbol] = chartData[chartData.length - 1].close;
      syncSymbolHeader();
      return;
    }

    try {
      let response = null;
      let lastErr = null;
      for (const base of BINANCE_KLINE_BASES) {
        try {
          const url = `${base}?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(tf)}&limit=500`;
          response = await fetch(url);
          if (response.ok) break;
        } catch (e) {
          lastErr = e;
          response = null;
        }
      }

      if (!response) {
        throw lastErr || new Error('Failed to reach Binance klines endpoint');
      }

      if (response.ok) {
        const data = await response.json();
        if (gen !== chartLoadGen) return; // fix 2026-09-19: a newer symbol/timeframe switch started while this fetch was in flight; drop this stale result instead of overwriting the chart
        chartData = data.map((k) => ({
          time: Math.floor(k[0] / 1000),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));

        candleSeries.setData(chartData);
        updateIndicators();

        setTimeout(() => {
          if (chartData.length > 0) {
            const dataMax = chartData.length - 1;
            const visibleCandles = Math.min(50, chartData.length);
            const range = {
              from: Math.max(0, dataMax - visibleCandles + 1),
              to: dataMax,
            };
            try {
              chart.timeScale().setVisibleLogicalRange(range);
            } catch (e) {}
          }
        }, 100);

        lastPrice[symbol] = chartData[chartData.length - 1].close;
        syncSymbolHeader();
      } else {
        console.error(
          `❌ Binance klines failed for ${symbol} ${tf}: HTTP ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(`❌ Error loading ${symbol} candles:`, error);
    }

    if (gen !== chartLoadGen) return; // fix 2026-09-19: a newer symbol/timeframe switch started; don't open/leak a socket for the stale one

    const wsUrl = `${BINANCE_WS_KLINE}/${symbol.toLowerCase()}@kline_${tf}`;
    chartSocket = new WebSocket(wsUrl);

    chartSocket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const k = msg.k;
        if (!k) return;

        const candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };

        const lastCandle = chartData[chartData.length - 1];
        if (lastCandle && lastCandle.time === candle.time) {
          chartData[chartData.length - 1] = candle;
        } else {
          chartData.push(candle);
        }

        candleSeries.update(candle);
        updateIndicators();

        lastPrice[symbol] = candle.close;
        syncSymbolHeader();
        renderPositions();
      } catch (_) {}
    };

    chartSocket.onclose = () => {
      setTimeout(() => {
        if (symbol === currentSymbol && tf === timeframe) {
          loadCandlesAndSubscribe(symbol, tf);
        }
      }, 2000);
    };
  }

  /**
   * Paginate Binance 1m klines from newest backward until exchange history starts
   * or limits are hit. Returns candles sorted oldest → newest.
   * @param {string} symbol
   * @param {{ maxBars?: number, maxRequests?: number, signal?: AbortSignal }} [opts]
   *   maxBars — cap total rows (default 5000). Use Infinity for “all available”.
   *   maxRequests — safety cap on HTTP calls (default 4000).
   *   signal — pass to cancel in-flight export (fetch respects AbortSignal).
   */
  async function fetch1mKlinesPaged(symbol, opts) {
    const maxBars = opts?.maxBars ?? 5000;
    const maxRequests = opts?.maxRequests ?? 4000;
    const signal = opts?.signal;
    const merged = [];
    let endTime = null;
    let requests = 0;

    while (requests < maxRequests) {
      if (signal?.aborted) {
        throw new DOMException('CSV export cancelled', 'AbortError');
      }
      if (Number.isFinite(maxBars) && merged.length >= maxBars) break;
      const need = Number.isFinite(maxBars)
        ? Math.min(1000, maxBars - merged.length)
        : 1000;
      if (need <= 0) break;

      requests += 1;
      let response = null;
      let lastErr = null;
      for (const base of BINANCE_KLINE_BASES) {
        try {
          let url = `${base}?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=${need}`;
          if (endTime != null) url += `&endTime=${endTime}`;
          response = await fetch(url, signal ? { signal } : undefined);
          if (response.ok) break;
        } catch (e) {
          lastErr = e;
          response = null;
          if (e && (e.name === 'AbortError' || signal?.aborted)) throw e;
        }
      }
      if (!response || !response.ok) {
        if (merged.length === 0) throw lastErr || new Error('Binance klines request failed');
        break;
      }
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) break;

      const batch = data.map((k) => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      merged.unshift(...batch);
      endTime = data[0][0] - 1;
      if (data.length < need) break;
    }

    return merged.sort((a, b) => a.time - b.time);
  }

  /**
   * Up to 1000 most recent 1m klines from Binance REST (same bases as chart); excludes the still-forming bar.
   * @param {string} symbol
   * @returns {Promise<Array<{time:number,open:number,high:number,low:number,close:number,volume:number}>>}
   */
  async function fetchUpTo1000Closed1mKlines(symbol) {
    const limit = 1000;
    let response = null;
    let lastErr = null;
    for (const base of BINANCE_KLINE_BASES) {
      try {
        const url = `${base}?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=${limit}`;
        response = await fetch(url);
        if (response.ok) break;
      } catch (e) {
        lastErr = e;
        response = null;
      }
    }
    if (!response || !response.ok) {
      throw lastErr || new Error('Binance klines request failed');
    }
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    const now = Date.now();
    const rows = [];
    for (const k of data) {
      const closeMs = k[6];
      if (closeMs == null || closeMs >= now) continue;
      rows.push({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      });
    }
    return rows.sort((a, b) => a.time - b.time);
  }

  function buildOhlcvCsv(rows) {
    const pad = (n) => String(n).padStart(2, '0');
    const lines = ['Date (UTC),Time (UTC),Open,High,Low,Close,Volume'];
    for (const c of rows) {
      const d = new Date(c.time * 1000);
      const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
      const nums = [c.open, c.high, c.low, c.close, c.volume].map((x) =>
        Number.isFinite(x) ? String(x) : ''
      );
      lines.push([dateStr, timeStr, ...nums].join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  function syncLiveMinuteCaptureOnSymbolChange() {
    if (!liveMinuteCapture.active || liveMinuteCapture.seeding) return;
    if (liveMinuteCapture.symbol === currentSymbol) return;
    void resyncLiveMinuteCaptureForNewSymbol(currentSymbol);
  }

  function stopLiveMinuteCaptureDiscard() {
    if (liveMinuteCapture.seeding) liveMinuteSeedGen++;
    liveMinuteCapture.active = false;
    liveMinuteCapture.seeding = false;
    liveMinuteCapture.rows = [];
    liveMinuteCapture.symbol = null;
    if (liveMinuteCapture.socket) {
      try { liveMinuteCapture.socket.close(); } catch (_) {}
      liveMinuteCapture.socket = null;
    }
    updateLiveMinuteCaptureButton();
  }

  async function resyncLiveMinuteCaptureForNewSymbol(sym) {
    if (!sym || !liveMinuteCapture.active) return;
    if (liveMinuteCapture.socket) {
      try { liveMinuteCapture.socket.close(); } catch (_) {}
      liveMinuteCapture.socket = null;
    }
    liveMinuteCapture.symbol = sym;
    liveMinuteCapture.rows = [];
    updateLiveMinuteCaptureButton();
    try {
      const rows = await fetchUpTo1000Closed1mKlines(sym);
      if (!liveMinuteCapture.active || liveMinuteCapture.symbol !== sym) return;
      liveMinuteCapture.rows = rows;
    } catch (e) {
      console.error('Live 1m re-seed failed:', e);
      if (liveMinuteCapture.active && liveMinuteCapture.symbol === sym) {
        alert('Could not load 1m history for the new symbol. Recording stopped.');
        stopLiveMinuteCaptureDiscard();
      }
      return;
    }
    updateLiveMinuteCaptureButton();
    if (liveMinuteCapture.active && liveMinuteCapture.symbol === sym) {
      reconnectLiveMinuteCaptureSocket();
    }
  }

  function updateLiveMinuteCaptureButton() {
    const btn = document.getElementById('btn-live-minute-capture');
    const btnM = document.getElementById('btn-live-minute-capture-mobile');
    const idleLabel = 'Record 1m CSV';
    const idleShort = 'Record';
    const apply = (b, longText) => {
      if (!b) return;
      if (liveMinuteCapture.seeding) {
        b.disabled = true;
        b.textContent = b === btnM ? 'Loading…' : 'Loading 1m history…';
        b.classList.remove('border-red-500/50', 'text-red-400', 'hover:bg-red-500/10', 'active:bg-red-500/15');
        b.classList.add('border-amber-500/50', 'text-amber-400', 'hover:bg-amber-500/10', 'active:bg-amber-500/15');
        return;
      }
      b.disabled = false;
      if (liveMinuteCapture.active) {
        const n = liveMinuteCapture.rows.length;
        b.textContent = b === btnM ? `Stop (${n})` : `Stop & download CSV (${n} bar${n === 1 ? '' : 's'})`;
        b.classList.remove('border-amber-500/50', 'text-amber-400', 'hover:bg-amber-500/10', 'active:bg-amber-500/15');
        b.classList.add('border-red-500/50', 'text-red-400', 'hover:bg-red-500/10', 'active:bg-red-500/15');
      } else {
        b.textContent = b === btnM ? idleShort : longText;
        b.classList.remove('border-red-500/50', 'text-red-400', 'hover:bg-red-500/10', 'active:bg-red-500/15');
        b.classList.add('border-amber-500/50', 'text-amber-400', 'hover:bg-amber-500/10', 'active:bg-amber-500/15');
      }
    };
    apply(btn, idleLabel);
    apply(btnM, idleLabel);
  }

  function reconnectLiveMinuteCaptureSocket() {
    if (liveMinuteCapture.socket) {
      try { liveMinuteCapture.socket.close(); } catch (_) {}
      liveMinuteCapture.socket = null;
    }
    if (!liveMinuteCapture.active || !liveMinuteCapture.symbol) return;
    const sym = liveMinuteCapture.symbol;
    const wsUrl = `${BINANCE_WS_KLINE}/${sym.toLowerCase()}@kline_1m`;
    const socket = new WebSocket(wsUrl);
    liveMinuteCapture.socket = socket;
    socket.onmessage = (ev) => {
      if (!liveMinuteCapture.active || liveMinuteCapture.symbol !== sym) return;
      try {
        const msg = JSON.parse(ev.data);
        const k = msg.k;
        if (!k || k.x !== true) return;
        const candle = {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        const rows = liveMinuteCapture.rows;
        const last = rows[rows.length - 1];
        if (last && last.time === candle.time) {
          rows[rows.length - 1] = candle;
        } else {
          rows.push(candle);
        }
        updateLiveMinuteCaptureButton();
      } catch (_) {}
    };
    socket.onclose = () => {
      liveMinuteCapture.socket = null;
      if (!liveMinuteCapture.active || liveMinuteCapture.symbol !== sym) return;
      setTimeout(() => {
        if (liveMinuteCapture.active && liveMinuteCapture.symbol === sym) {
          reconnectLiveMinuteCaptureSocket();
        }
      }, 2000);
    };
    socket.onerror = () => {
      try { socket.close(); } catch (_) {}
    };
  }

  async function startLiveMinuteCapture() {
    if (liveMinuteCapture.active || liveMinuteCapture.seeding || !currentSymbol) return;
    const sym = currentSymbol;
    const gen = ++liveMinuteSeedGen;
    liveMinuteCapture.seeding = true;
    updateLiveMinuteCaptureButton();
    try {
      const rows = await fetchUpTo1000Closed1mKlines(sym);
      if (gen !== liveMinuteSeedGen || currentSymbol !== sym) {
        liveMinuteCapture.seeding = false;
        updateLiveMinuteCaptureButton();
        return;
      }
      liveMinuteCapture.seeding = false;
      liveMinuteCapture.active = true;
      liveMinuteCapture.symbol = sym;
      liveMinuteCapture.rows = rows;
      updateLiveMinuteCaptureButton();
      reconnectLiveMinuteCaptureSocket();
    } catch (e) {
      if (gen === liveMinuteSeedGen) {
        liveMinuteCapture.seeding = false;
        updateLiveMinuteCaptureButton();
      }
      console.error('Live 1m seed failed:', e);
      if (gen === liveMinuteSeedGen) {
        alert('Could not start recording: failed to load 1m candles from Binance.');
      }
    }
  }

  function stopLiveMinuteCaptureAndSave() {
    if (liveMinuteCapture.seeding) {
      liveMinuteSeedGen++;
      liveMinuteCapture.seeding = false;
      if (liveMinuteCapture.socket) {
        try { liveMinuteCapture.socket.close(); } catch (_) {}
        liveMinuteCapture.socket = null;
      }
      updateLiveMinuteCaptureButton();
      return;
    }
    if (!liveMinuteCapture.active) return;
    liveMinuteCapture.active = false;
    const sym = liveMinuteCapture.symbol;
    const rows = liveMinuteCapture.rows.slice();
    liveMinuteCapture.rows = [];
    liveMinuteCapture.symbol = null;
    if (liveMinuteCapture.socket) {
      try { liveMinuteCapture.socket.close(); } catch (_) {}
      liveMinuteCapture.socket = null;
    }
    updateLiveMinuteCaptureButton();
    if (!rows.length) {
      alert('No rows to export. Try again after history loads or a closed minute arrives.');
      return;
    }
    const csv = buildOhlcvCsv(rows);
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fname = `${sym}_1m_OHLCV_${stamp.getUTCFullYear()}-${pad(stamp.getUTCMonth() + 1)}-${pad(stamp.getUTCDate())}-${pad(stamp.getUTCHours())}-${pad(stamp.getUTCMinutes())}-${pad(stamp.getUTCSeconds())}.csv`;
    triggerCsvDownload(fname, csv);
    console.log(`Live 1m capture saved: ${rows.length} bars for ${sym}`);
  }

  function toggleLiveMinuteCapture() {
    if (liveMinuteCapture.active || liveMinuteCapture.seeding) stopLiveMinuteCaptureAndSave();
    else void startLiveMinuteCapture();
  }

  function triggerCsvDownload(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
  }

  function setCsvExportUi(running) {
    const cancelBtn = document.getElementById('btn-cancel-csv-export');
    const cancelBtnM = document.getElementById('btn-cancel-csv-export-mobile');
    const headerBtn = document.getElementById('btn-export-csv-header');
    const headerBtnM = document.getElementById('btn-export-csv-header-mobile');
    const chartBtn = document.getElementById('btn-export-csv');
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !running);
    if (cancelBtnM) cancelBtnM.classList.toggle('hidden', !running);
    const labelHeader = 'Export 1m OHLCV (CSV)';
    const labelHeaderM = 'Export CSV';
    [
      [headerBtn, labelHeader],
      [headerBtnM, labelHeaderM],
      [chartBtn, 'CSV'],
    ].forEach(([b, idleText]) => {
      if (!b) return;
      if (running) {
        b.disabled = true;
        b.textContent = '…';
      } else {
        b.disabled = false;
        b.textContent = idleText;
      }
    });
    if (running) {
      document.addEventListener('keydown', onCsvExportEscapeKey, true);
    } else {
      document.removeEventListener('keydown', onCsvExportEscapeKey, true);
    }
  }

  async function exportMinuteOhlcvCsv() {
    if (csvExportInProgress || !currentSymbol) return;
    csvExportInProgress = true;
    csvExportAbortController = new AbortController();
    const { signal } = csvExportAbortController;
    // fix 2026-09-19: pin the symbol for the whole export. currentSymbol/chartData are live globals
    // that can change while fetch1mKlinesPaged() is still awaiting (it can take thousands of
    // requests); re-reading them afterward could merge/name the file from two different symbols.
    const exportSymbol = currentSymbol;
    setCsvExportUi(true);

    try {
      const historical = await fetch1mKlinesPaged(exportSymbol, {
        maxBars: Infinity,
        maxRequests: 6000,
        signal,
      });
      const byTime = new Map();
      for (const c of historical) byTime.set(c.time, c);
      // fix 2026-09-19: only fold in the live chart buffer if it still belongs to the symbol/timeframe being exported
      if (timeframe === '1m' && currentSymbol === exportSymbol && chartData.length) {
        for (const c of chartData) {
          byTime.set(c.time, {
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume != null ? c.volume : 0,
          });
        }
      }

      const rows = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
      if (!rows.length) {
        alert('No OHLCV data to export yet.');
        return;
      }

      const csv = buildOhlcvCsv(rows);
      const stamp = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fname = `${exportSymbol}_1m_OHLCV_${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`;
      triggerCsvDownload(fname, csv);
      console.log(`CSV export: ${rows.length} 1m bars for ${exportSymbol}`);
    } catch (e) {
      if (e && e.name === 'AbortError') {
        console.log('CSV export cancelled.');
      } else {
        console.error('CSV export failed:', e);
        alert('Could not download OHLCV CSV. Check your network or try again.');
      }
    } finally {
      csvExportInProgress = false;
      csvExportAbortController = null;
      setCsvExportUi(false);
    }
  }

  function readThemeVar(name, fallback) {
    try {
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return val || fallback;
    } catch {
      return fallback;
    }
  }

  // The chart is a <canvas> lightweight-charts draws into - its colors are
  // plain JS option values set once at chart-creation time (setupChart()),
  // not CSS, so switching --cc-* via the light/dark toggle (assets/theme/theme.js)
  // never repaints an already-created chart on its own. This re-reads the
  // --cc-* vars and pushes them back into the chart/series/indicator panels
  // whenever the appearance changes, so the canvas actually follows light/dark too.
  function applyLiveChartTheme() {
    if (!chart) return;
    try {
      const bg = readThemeVar('--cc-bg', '#020617');
      const text = readThemeVar('--cc-text', '#e2e8f0');
      const border = readThemeVar('--cc-border', '#1e293b');
      const up = readThemeVar('--cc-up', '#ef4444');
      const down = readThemeVar('--cc-down', '#10b981');

      chart.applyOptions({
        layout: {
          background: { color: bg },
          textColor: text,
        },
        grid: {
          vertLines: { color: border },
          horzLines: { color: border },
        },
        rightPriceScale: { borderColor: border },
        timeScale: { borderColor: border },
      });

      if (candleSeries) {
        candleSeries.applyOptions({
          upColor: up,
          downColor: down,
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: up,
          wickDownColor: down,
        });
      }

      // Each indicator panel below the main chart is its own separate
      // lightweight-charts instance (see multi-indicator-system.js), so it
      // needs its own repaint - refreshTheme() re-reads the same --cc-* vars.
      if (indicatorSystem && typeof indicatorSystem.refreshTheme === 'function') {
        try { indicatorSystem.refreshTheme(); } catch (e) {}
      }
    } catch (error) {
      console.error('❌ Failed to apply live chart theme:', error);
    }
  }

  function setupThemeSync() {
    window.addEventListener('tl:appearancechange', applyLiveChartTheme);
    window.addEventListener('storage', (e) => {
      if (e.key === 'tl-appearance') applyLiveChartTheme();
    });
  }

  // fix 2026-09-19: #chart-toolbar (the floating 1m/5m/.../Reset bar) wraps to 2 rows on narrow
  // screens and is taller there than the single-row desktop case a fixed scaleMargins.top was
  // tuned for. Measure the toolbar's actual rendered height and reserve just enough headroom so
  // candle wicks never get drawn underneath it, at any width.
  function syncChartTopMargin() {
    if (!chart) return;
    try {
      const toolbarEl = document.getElementById('chart-toolbar');
      const chartH = el.chart ? el.chart.clientHeight : 0;
      if (!toolbarEl || !chartH) return;
      const toolbarH = toolbarEl.getBoundingClientRect().height;
      const topFraction = Math.min(0.6, Math.max(0.16, (toolbarH + 12) / chartH));
      chart.priceScale('right').applyOptions({ scaleMargins: { top: topFraction, bottom: 0 } });
    } catch (e) {}
  }

  function setupChart() {
    try {
      // Check if LightweightCharts is available
      if (typeof LightweightCharts === 'undefined') {
        throw new Error('LightweightCharts library not loaded');
      }

      // Check if chart container exists
      if (!el.chart) {
        throw new Error('Chart container element not found');
      }
      chart = LightweightCharts.createChart(el.chart, {
        layout: {
          background: { color: readThemeVar('--cc-bg', "#020617") },
          textColor: readThemeVar('--cc-text', "#e2e8f0"),
        },
        grid: {
          vertLines: { color: readThemeVar('--cc-border', "#1e293b") },
          horzLines: { color: readThemeVar('--cc-border', "#1e293b") },
        },
        rightPriceScale: {
          borderColor: readThemeVar('--cc-border', "#334155"),
          minimumWidth: (typeof MultiIndicatorSystem !== 'undefined' && MultiIndicatorSystem.PRICE_SCALE_ALIGN_WIDTH) || 56,
          // fix 2026-09-19: was top:0, so candle wicks could be drawn right up to the very top of
          // the chart - directly under #chart-toolbar (the floating 1m/5m/.../Reset bar, position:
          // absolute top-1 over #chart). 0.16 reserves enough headroom to clear that toolbar.
          scaleMargins: {
            top: 0.16,
            bottom: 0,
          },
        },
        timeScale: {
          borderColor: readThemeVar('--cc-border', "#334155"),
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 8,
          barSpacing: 6,
          fixLeftEdge: true,
          fixRightEdge: true,
          lockVisibleTimeRangeOnResize: true,
        },
        crosshair: {
          mode: 0,
        },
        autoSize: true,
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      try {
        const alignW = (typeof MultiIndicatorSystem !== 'undefined' && MultiIndicatorSystem.PRICE_SCALE_ALIGN_WIDTH) || 56;
        // fix 2026-09-19: keep in sync with the createChart() rightPriceScale.scaleMargins above
        chart.priceScale('right').applyOptions({ minimumWidth: alignW, scaleMargins: { top: 0.16, bottom: 0 } });
      } catch (e) {}

      /* Asian-style candles: rising (close ≥ open) = red, falling = green */
      candleSeries = chart.addCandlestickSeries({
        upColor: readThemeVar('--cc-up', "#ef4444"),
        downColor: readThemeVar('--cc-down', "#10b981"),
        borderUpColor: readThemeVar('--cc-up', "#ef4444"),
        borderDownColor: readThemeVar('--cc-down', "#10b981"),
        wickUpColor: readThemeVar('--cc-up', "#ef4444"),
        wickDownColor: readThemeVar('--cc-down', "#10b981"),
      });

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            clearTimeout(window.chartResizeTimeout);
            window.chartResizeTimeout = setTimeout(() => {
              try {
                chart.resize(width, height);
                syncChartTopMargin();
                if (indicatorSystem && typeof indicatorSystem.syncIndicatorChartWidths === 'function') {
                  indicatorSystem.syncIndicatorChartWidths(el.chart);
                }
              } catch (error) {}
            }, 100);
          }
        }
      });
      resizeObserver.observe(el.chart);
      requestAnimationFrame(syncChartTopMargin);
    } catch (error) {
      console.error('❌ Failed to setup crypto chart:', error);
      // Show error message in chart container
      if (el.chart) {
        el.chart.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #e5534b; font-family: monospace;">Chart Error: ${error.message}</div>`;
      }
    }
  }

  function setupChartControls() {
    document.querySelectorAll('#btn-export-csv, #btn-export-csv-header, #btn-export-csv-header-mobile').forEach((btn) => {
      btn.addEventListener('click', () => exportMinuteOhlcvCsv());
    });
    document.getElementById('btn-cancel-csv-export')?.addEventListener('click', () => {
      csvExportAbortController?.abort();
    });
    document.getElementById('btn-cancel-csv-export-mobile')?.addEventListener('click', () => {
      csvExportAbortController?.abort();
    });
    document.getElementById('btn-live-minute-capture')?.addEventListener('click', toggleLiveMinuteCapture);
    document.getElementById('btn-live-minute-capture-mobile')?.addEventListener('click', toggleLiveMinuteCapture);

    const btnPanLeft = document.getElementById('btn-pan-left');
    const btnPanRight = document.getElementById('btn-pan-right');
    const btnResetView = document.getElementById('btn-reset-view');
    const btnJumpFirst = document.getElementById('btn-jump-first');
    const btnJumpLast = document.getElementById('btn-jump-last');

    if (!btnPanLeft || !btnPanRight) return;

    const getRange = () => chart?.timeScale().getVisibleLogicalRange();
    const setRangeBoth = (range) => {
      if (!range || !chart) return;
      try {
        chart.timeScale().setVisibleLogicalRange(range);
      } catch (e) {}
    };

    function resetToDefaultView() {
      if (!chartData.length) return;
      const dataMax = chartData.length - 1;
      const visibleCandles = Math.min(50, chartData.length);
      setRangeBoth({
        from: Math.max(0, dataMax - visibleCandles + 1),
        to: dataMax,
      });
    }

    function jumpToFirst() {
      if (!chartData?.length || !chart) return;
      const firstTime = chartData[0].time;
      const lastTime = chartData[chartData.length - 1].time;
      let endTime = firstTime;
      if (chartData.length > 1) {
        const candleDuration = chartData[1].time - chartData[0].time;
        endTime = firstTime + candleDuration * 40;
      }
      if (endTime > lastTime) endTime = lastTime;
      try {
        chart.timeScale().setVisibleRange({ from: firstTime, to: endTime });
      } catch (e) {}
    }

    function jumpToLast() {
      if (!chartData?.length || !chart) return;
      const firstTime = chartData[0].time;
      const lastTime = chartData[chartData.length - 1].time;
      let startTime = lastTime;
      if (chartData.length > 1) {
        const candleDuration = chartData[1].time - chartData[0].time;
        startTime = lastTime - candleDuration * 40;
      }
      if (startTime < firstTime) startTime = firstTime;
      try {
        chart.timeScale().setVisibleRange({ from: startTime, to: lastTime });
      } catch (e) {}
    }

    function adjustPan(deltaFraction) {
      const r = getRange();
      if (!r || !chartData.length) return;
      const dataMin = 0;
      const dataMax = chartData.length - 1;
      const span = r.to - r.from;
      const shift = span * deltaFraction;
      let newFrom = r.from + shift;
      let newTo = r.to + shift;
      if (newFrom < dataMin) {
        newFrom = dataMin;
        newTo = dataMin + span;
      }
      if (newTo > dataMax) {
        newTo = dataMax;
        newFrom = dataMax - span;
        if (newFrom < dataMin) {
          newFrom = dataMin;
          newTo = Math.min(dataMin + span, dataMax);
        }
      }
      setRangeBoth({ from: Math.max(dataMin, newFrom), to: Math.min(dataMax, newTo) });
    }

    btnPanLeft.addEventListener('click', () => {
      adjustPan(-0.15);
    });
    btnPanRight.addEventListener('click', () => {
      adjustPan(0.15);
    });
    btnResetView?.addEventListener('click', () => {
      resetToDefaultView();
    });
    btnJumpFirst?.addEventListener('click', jumpToFirst);
    btnJumpLast?.addEventListener('click', jumpToLast);

    [btnPanLeft, btnPanRight, btnResetView, btnJumpFirst, btnJumpLast].forEach((btn) => {
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btn.style.transform = 'scale(0.95)';
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.style.transform = '';
      });
    });
  }

  function setupIndicatorSystem() {
    try {
      if (typeof MultiIndicatorSystem === 'undefined') {
        console.error('Crypto Trading: MultiIndicatorSystem class not loaded');
        return;
      }
      indicatorSystem = new MultiIndicatorSystem();
      if (chart) {
        indicatorSystem.setMainTimeScale(chart.timeScale(), chart);
      }

      const defaultIndicators = ['MACD', 'STOCH', 'VOLUME'];
      const container = document.getElementById('indicators-container');

      if (container) {
        defaultIndicators.forEach((indicator, index) => {
          const panelId = `indicator-panel-${index}`;
          panelIds.push(panelId);
          indicatorSystem.createIndicatorPanel(panelId, 'indicators-container', indicator);
        });
        updateIndicatorCount();
        if (el.chart && typeof indicatorSystem.syncIndicatorChartWidths === 'function') {
          indicatorSystem.syncIndicatorChartWidths(el.chart);
          setTimeout(() => indicatorSystem.syncIndicatorChartWidths(el.chart), 150);
        }
      } else {
        console.error('❌ Crypto Trading: indicators-container element not found!');
      }

      setupAddIndicatorButton();

      const MAX_INDICATORS = 5;
      const originalRemovePanel = indicatorSystem.removePanel.bind(indicatorSystem);
      indicatorSystem.removePanel = function (panelId) {
        originalRemovePanel(panelId);
        const index = panelIds.indexOf(panelId);
        if (index > -1) {
          panelIds.splice(index, 1);
        }
        updateIndicatorCount();
        const addBtn = document.getElementById('add-indicator-btn');
        if (addBtn && panelIds.length < MAX_INDICATORS) {
          addBtn.disabled = false;
          addBtn.title = 'Add New Indicator';
        }
      };
    } catch (error) {
      console.error('❌ Crypto Trading: Failed to setup indicator system:', error);
    }
  }

  function updateIndicatorCount() {
    if (el.indicatorCount) {
      const container = document.getElementById('indicators-container');
      if (container) {
        const totalPanels = container.querySelectorAll('.indicator-panel').length;
        const visiblePanels = container.querySelectorAll('.indicator-panel:not(.minimized)').length;
        el.indicatorCount.textContent = `Indicators (${visiblePanels}/${totalPanels})`;
      } else {
        el.indicatorCount.textContent = `Indicators (${panelIds.length})`;
      }
    }
  }

  function setupAddIndicatorButton() {
    const addBtn = document.getElementById('add-indicator-btn');
    if (!addBtn) return;

    addBtn.addEventListener('click', () => {
      const container = document.getElementById('indicators-container');
      if (!container) return;

      const MAX_INDICATORS = 5;

      if (panelIds.length >= MAX_INDICATORS) {
        alert(`Maximum ${MAX_INDICATORS} indicators allowed. Please remove one before adding another.`);
        return;
      }

      const newIndex = panelIds.length;
      const indicatorName = 'RSI';
      const panelId = `indicator-panel-${newIndex}`;
      panelIds.push(panelId);

      if (indicatorSystem) {
        indicatorSystem.createIndicatorPanel(panelId, 'indicators-container', indicatorName);
        if (chartData.length) {
          indicatorSystem.updateSinglePanel(panelId);
        }
        updateIndicatorCount();
        if (el.chart && typeof indicatorSystem.syncIndicatorChartWidths === 'function') {
          indicatorSystem.syncIndicatorChartWidths(el.chart);
        }
        if (panelIds.length >= MAX_INDICATORS) {
          addBtn.disabled = true;
          addBtn.title = `Maximum ${MAX_INDICATORS} indicators reached`;
        }
      }
    });
  }

  function updateIndicators() {
    if (!indicatorSystem || !chartData.length) {
      return;
    }
    
    try {
      // Update all indicator panels with current chart data
      indicatorSystem.updateAllPanels(chartData);
    } catch (error) {
      console.error('❌ Crypto Trading: Error updating indicators:', error);
    }
  }

  function placeMarketOrder() {
    const side = orderSide === "buy" ? "BUY" : "SELL";
    const qty = parseFloat(el.orderQty?.value);

    if (!qty || qty <= 0 || !isFinite(qty)) {
      alert("Enter a valid quantity");
      return;
    }

    const localPrice = lastPrice[currentSymbol];
    if (!localPrice) {
      alert("No price data available. Please wait for connection.");
      return;
    }

    const symbol = currentSymbol;
    el.orderQty.value = ""; // clear immediately either way

    // Signed-in users: get a server-verified fill price + resulting
    // position instead of trusting this browser's own WebSocket feed for
    // the number that actually gets recorded (see docs/SETUP_AUTH.md,
    // "Crypto price authority"). pages/auth/crypto-order-authority.js
    // installs this hook only for a signed-in session; it's left undefined
    // otherwise, so a logged-out user's local-only flow below is untouched.
    if (typeof window.cryptoApp?.requestServerFill === "function") {
      const clientId = `CRYPTO-${Date.now()}`;
      window.cryptoApp.requestServerFill({ clientId, symbol, side: side.toLowerCase(), qty })
        .then((fill) => applyFill(clientId, symbol, side, qty, fill.price, fill.position))
        .catch((err) => {
          console.warn("crypto-app: server fill failed, falling back to local price", err);
          applyFill(`CRYPTO-${Date.now()}`, symbol, side, qty, localPrice, null);
        });
      return;
    }

    applyFill(`CRYPTO-${Date.now()}`, symbol, side, qty, localPrice, null);
  }

  /**
   * Records a fill (server-confirmed or local-only fallback) and refreshes
   * the UI. When `serverPosition` is provided (server-authoritative path),
   * it replaces this symbol's position wholesale instead of recomputing it
   * locally, so a signed-in user's numbers always match what the server
   * decided - the same "server wins" principle as stock-market/js/
   * portfolio.js's applyServerState/addServerPosition.
   */
  function applyFill(id, symbol, side, qty, price, serverPosition) {
    const order = { id, ts: Date.now(), symbol, side, qty, price, status: "Filled" };
    orders.unshift(order);

    if (serverPosition) {
      positions[symbol] = { qty: serverPosition.qty, avg: serverPosition.avg, realized: serverPosition.realized };
    } else {
      updatePosition(symbol, side, qty, price);
    }

    saveLS(CRYPTO_LS_KEYS.orders, orders);
    saveLS(CRYPTO_LS_KEYS.positions, positions);

    renderOrders();
    renderPositions();
  }

  function updatePosition(symbol, side, qty, price) {
    const pos = positions[symbol] || { qty: 0, avg: 0, realized: 0 };
    const signedQty = side === "BUY" ? qty : -qty;
    const newQty = pos.qty + signedQty;

    if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(newQty)) {
      // Adding to same direction
      const absOld = Math.abs(pos.qty);
      const absNew = Math.abs(newQty);
      const totalCost = pos.avg * absOld + price * Math.abs(signedQty);
      pos.avg = absNew === 0 ? 0 : totalCost / absNew;
      pos.qty = newQty;
    } else {
      // Reducing or flipping position
      const oldSign = Math.sign(pos.qty); // fix 2026-09-19: capture before pos.qty is overwritten below
      const closingQty = Math.min(Math.abs(pos.qty), Math.abs(signedQty));
      const pnlPerUnit = (price - pos.avg) * Math.sign(pos.qty);
      pos.realized += pnlPerUnit * closingQty;
      pos.qty = newQty;
      
      // fix 2026-09-19: was comparing sign(newQty) to sign(newQty + signedQty) (always equal, so a
      // flip never reset avg price); now compares the pre-trade sign to the post-trade sign.
      if (newQty !== 0 && Math.sign(newQty) !== oldSign) {
        pos.avg = price; // Reset avg price for flipped position
      }
      if (pos.qty === 0) pos.avg = 0;
    }

    positions[symbol] = pos;
  }

  function renderPositions() {
    const tbody = el.positionsTable;
    if (!tbody) return;
    tbody.innerHTML = "";
    
    Object.entries(positions).forEach(([sym, pos]) => {
      if (!pos || pos.qty === 0) return;
      
      const tr = document.createElement("tr");
      const markPrice = lastPrice[sym] || pos.avg || 0;
      const unrealPnl = (markPrice - pos.avg) * pos.qty;

      tr.innerHTML = `
        <td>${formatCryptoDisplay(sym)}</td>
        <td>${pos.qty.toFixed(6)}</td>
        <td>${formatCryptoPrice(pos.avg)}</td>
        <td>${formatCryptoPrice(markPrice)}</td>
        <td style="color:${unrealPnl >= 0 ? "#e5534b" : "#15b37d"}">${formatMoney(unrealPnl)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderOrders() {
    const tbody = el.ordersTable;
    if (!tbody) return;
    tbody.innerHTML = "";
    
    orders.slice(0, 50).forEach((order) => {
      const tr = document.createElement("tr");
      const time = new Date(order.ts);
      const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      
      tr.innerHTML = `
        <td>${timeStr}</td>
        <td>${formatCryptoDisplay(order.symbol)}</td>
        <td style="color:${order.side === "BUY" ? "#15b37d" : "#e5534b"}">${order.side}</td>
        <td>${order.qty}</td>
        <td>${formatCryptoPrice(order.price)}</td>
        <td>${order.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Utility Functions
  function isCryptoSymbol(sym) {
    return sym && typeof sym === 'string' && (
      sym.endsWith('USDT') || 
      sym.endsWith('BUSD') || 
      sym.endsWith('BTC') || 
      sym.endsWith('ETH')
    );
  }

  function formatCryptoDisplay(sym) {
    if (!sym) return "";
    if (sym.endsWith("USDT")) return sym.replace("USDT", "/USDT");
    if (sym.endsWith("BUSD")) return sym.replace("BUSD", "/BUSD");
    if (sym.endsWith("BTC")) return sym.replace("BTC", "/BTC");
    if (sym.endsWith("ETH")) return sym.replace("ETH", "/ETH");
    return sym;
  }

  function formatCryptoPrice(price) {
    if (!isFinite(price)) return "—";
    if (price >= 1000) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    if (price >= 0.01) return price.toFixed(6);
    return price.toFixed(8);
  }

  function formatMoney(value) {
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    return `${sign}$${abs.toFixed(2)}`;
  }

  function saveLS(key, val) {
    try { 
      localStorage.setItem(key, JSON.stringify(val)); 
    } catch (error) {
      console.error("localStorage save error:", error);
    }
  }

  function loadLS(key, fallback) {
    try {
      const s = localStorage.getItem(key);
      if (!s) return fallback;
      const parsed = JSON.parse(s);
      // fix 2026-09-19: validate the parsed shape matches what the caller expects (array vs plain
      // object). A corrupted or foreign-schema value in localStorage now falls back cleanly here
      // instead of throwing later out of .forEach/.push/.map calls elsewhere in the app.
      if (Array.isArray(fallback)) {
        if (!Array.isArray(parsed)) return fallback;
      } else if (fallback !== null && typeof fallback === "object") {
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
      }
      return parsed;
    } catch {
      return fallback;
    }
  }

  // MACD Calculation (same as original)
  function computeEMA(values, period) {
    const k = 2 / (period + 1);
    const ema = [];
    let sum = 0;
    
    for (let i = 0; i < values.length; i++) {
      if (i < period) {
        sum += values[i];
        if (i === period - 1) {
          ema.push(sum / period);
        } else {
          ema.push(NaN);
        }
      } else {
        const prev = ema[i - 1];
        ema.push(values[i] * k + prev * (1 - k));
      }
    }
    
    return ema.filter(x => !Number.isNaN(x));
  }

  function computeMACD(values, fast = 12, slow = 26, signal = 9) {
    if (values.length < slow + signal) {
      return { macd: [], signal: [], hist: [] };
    }
    
    const emaFast = computeEMA(values, fast);
    const emaSlow = computeEMA(values, slow);
    
    const offset = emaFast.length - emaSlow.length;
    const alignedFast = offset > 0 ? emaFast.slice(offset) : emaFast;
    const alignedSlow = emaSlow;
    
    const len = Math.min(alignedFast.length, alignedSlow.length);
    const macdLine = [];
    
    for (let i = 0; i < len; i++) {
      macdLine.push(alignedFast[i] - alignedSlow[i]);
    }
    
    const signalLine = computeEMA(macdLine, signal);
    const macdAligned = macdLine.slice(macdLine.length - signalLine.length);
    const hist = macdAligned.map((v, i) => v - signalLine[i]);
    
    return { 
      macd: macdAligned, 
      signal: signalLine, 
      hist 
    };
  }

  // Expose some functions globally for debugging
  window.cryptoApp = {
    watchlist,
    positions,
    orders,
    localCandles,
    lastPrice,
    changePct,
    loadLS,
    saveLS,
    CRYPTO_LS_KEYS
  };

})();