/* TradeLite Stock Market App - Design 3 (TradeFlow Style) */
(function () {
  // Stock-specific configuration
  const DEFAULT_STOCK_SYMBOLS = ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN", "NVDA"];
  const DEFAULT_TIMEFRAME = "5d";
  // What each timeframe button shows, Yahoo/Google Finance style: the label is
  // how much history is on screen, and each gets a candle size that suits it.
  // `range` is how much history is fetched - well past the on-screen window,
  // so indicators have warm-up bars and there's room to scroll back.
  //   sessions: last N trading days   months: last N months   ytd: since Jan 1
  const TIMEFRAMES = {
    "1d":  { interval: "5m",  range: "1mo", sessions: 1 },
    "5d":  { interval: "15m", range: "1mo", sessions: 5 },
    "1m":  { interval: "60m", range: "6mo", months: 1 },
    "3m":  { interval: "1d",  range: "5y",  months: 3 },
    "1y":  { interval: "1d",  range: "5y",  months: 12 },
    "ytd": { interval: "1d",  range: "5y",  ytd: true },
  };
  // Floor on candles shown per window, so e.g. 1D right after the open (or on
  // imported daily candles) isn't a single bar.
  const MIN_VISIBLE_CANDLES = 20;

  // Separate localStorage keys for stock trading
  const STOCK_LS_KEYS = {
    watchlist: "stock_watchlist",
    positions: "stock_positions", 
    orders: "stock_orders",
    localCandles: "tl_local_candles"
  };

  // State
  let watchlist = loadLS(STOCK_LS_KEYS.watchlist, DEFAULT_STOCK_SYMBOLS);
  let positions = loadLS(STOCK_LS_KEYS.positions, {});
  let orders = loadLS(STOCK_LS_KEYS.orders, []);
  let localCandles = loadLS(STOCK_LS_KEYS.localCandles, {});
  // Last price actually painted per symbol, so renderWatchlist() (which fully
  // rebuilds its <li> markup every call) can tell whether a fresh price is an
  // up-tick or down-tick and flash it accordingly - not persisted, resets each load.
  const lastFlashedPrice = {};

  let currentSymbol = watchlist[0] || "AAPL";
  let timeframe = loadLS("stock_timeframe", DEFAULT_TIMEFRAME);
  if (!TIMEFRAMES[timeframe]) timeframe = DEFAULT_TIMEFRAME;

  // Live prices for symbols in watchlist
  const lastPrice = {};
  const changePct = {};

  // Stock market polling
  let priceUpdateTimer = null;

  // Chart components
  let chart = null;
  let candleSeries = null;
  let chartData = [];
  let chartStyle = loadLS('stock_chart_style', 'candles'); // 'candles' | 'line' | 'area'
  // Bumped at the start of every loadCandlesAndDisplay() call. If a slower
  // call (e.g. a network fetch) resolves after a newer call has already
  // started, its result is stale and must not overwrite chartData/indicators -
  // otherwise indicator panels can end up rendered against a superseded
  // symbol/timeframe's data despite the UI showing the current one.
  let chartLoadToken = 0;

  // Indicators on the price chart and in panes (TFIndicators.IndicatorManager)
  let indicators = null;

  // DOM Elements
  let el = {};

  // Handle URL parameters
  try {
    const params = new URLSearchParams(window.location.search);
    const urlSym = (params.get('symbol') || '').toUpperCase().trim();
    if (urlSym && isStockSymbol(urlSym)) {
      currentSymbol = urlSym;
      if (!watchlist.includes(urlSym)) {
        watchlist.unshift(urlSym);
        saveLS(STOCK_LS_KEYS.watchlist, watchlist);
      }
    }
  } catch {}

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForLibrariesAndInit();
    });
  } else {
    waitForLibrariesAndInit();
  }
  
  function waitForLibrariesAndInit() {
    if (typeof LightweightCharts !== 'undefined') {
      init();
    } else {
      let attempts = 0;
      const checkLibrary = setInterval(() => {
        attempts++;
        if (typeof LightweightCharts !== 'undefined') {
          clearInterval(checkLibrary);
          init();
        } else if (attempts >= 10) {
          console.error('❌ LightweightCharts library failed to load');
          clearInterval(checkLibrary);
        }
      }, 1000);
    }
  }

  // Indicators (price chart and panes) live in src/js/indicators/ - see setupIndicators().

  function init() {
    setTimeout(() => {
      initializeDOMElements();

      if (!validateDOMElements()) {
        console.error('❌ Critical DOM elements not found!');
        return;
      }

      setupEventHandlers();
      updateMarketStatus();
      updateMarketIndicators();
      setupChart();
      setupIndicators();
      setupChartControls();
      setupChartStyleDropdown();

      renderWatchlist();
      syncSymbolHeader();

      startPriceUpdates();
      loadCandlesAndDisplay(currentSymbol, timeframe);

      setInterval(updateMarketIndicators, 30000);

      exposeTradeFlowChart();
    }, 100);
  }

  // Public seam: chart/candleSeries/chartData are private to this IIFE, so a companion
  // script (drawing-tools.js) reaches them only through this deliberately small surface.
  const symbolChangeListeners = [];
  const resizeListeners = [];

  function notifySymbolChange() {
    symbolChangeListeners.forEach(cb => { try { cb(currentSymbol); } catch (e) {} });
  }

  function exposeTradeFlowChart() {
    window.TradeFlowChart = {
      getChart: () => chart,
      getCandleSeries: () => candleSeries,
      getIndicators: () => indicators,
      openIndicatorPicker: () => { if (indicators) indicators.openPicker(); },
      // Height of the price pane (the chart minus indicator panes below it) -
      // drawing tools and price alerts only work inside it.
      getMainPaneHeight: () => (indicators && indicators.mainPaneHeight()) || (el.chart ? el.chart.clientHeight : null),
      getChartData: () => chartData,
      getCurrentSymbol: () => currentSymbol,
      // Last known price for ANY watchlist symbol, not just the one currently
      // charted - this is what renderWatchlist() itself reads from, so it's
      // kept live for every symbol even while a different one is on-screen.
      getLastPrice: (symbol) => lastPrice[symbol],
      getWatchlist: () => watchlist.slice(),
      onSymbolChange(cb) { if (typeof cb === 'function') symbolChangeListeners.push(cb); },
      onResize(cb) { if (typeof cb === 'function') resizeListeners.push(cb); },
      // Lets other modules (e.g. indicator crosshair-sync) drive the OHLCV
      // legend by time, not just the main chart's own crosshair move.
      showTooltipForTime(time) {
        if (time == null) { renderOhlcLegend(null); return; }
        const bar = chartData.find(c => c.time === time);
        renderOhlcLegend(bar || null);
      },
    };
  }
  
  function initializeDOMElements() {
    el = {
      watchlist: document.getElementById("watchlist"),
      symbolInput: document.getElementById("symbol-input"),
      addSymbol: document.getElementById("add-symbol"),
      resetData: document.getElementById("reset-data"),
      chart: document.getElementById("chart"),
      tfButtons: Array.from(document.querySelectorAll(".tab-btn")),
      indicatorCount: document.getElementById("indicator-count"),
      ohlcLegend: document.getElementById("ohlc-legend"),
      themeToggle: document.getElementById("theme-toggle"),
      watchlistRailBadges: document.getElementById("watchlist-rail-badges"),
    };
  }
  
  function validateDOMElements() {
    const requiredElements = ['watchlist', 'chart'];
    const missing = [];
    
    requiredElements.forEach(key => {
      if (!el[key]) {
        missing.push(key);
        console.warn(`⚠️ Missing element: ${key}`);
      }
    });
    
    if (missing.length > 0) {
      console.error('❌ Missing required DOM elements:', missing);
    }
    return true;
  }

  // Comfort/Ultra-Modern UX toggle. The active theme is applied to
  // <html data-theme="comfort"> - tradeflow-theme.css does the actual
  // re-theming from there. A tiny inline script in index.html's <head>
  // (not this function - that loads far too late via ScriptLoader) already
  // applied the saved choice before first paint; this just wires the click
  // handler and keeps the button's icon/label/aria-pressed in sync.
  const THEME_STORAGE_KEY = 'tradeflow_ui_theme';
  // Comfort (soft slate, spacious) is the app's default look - no attribute
  // needed on <html> for it. Compact (dense, higher-contrast) is the opt-in
  // alternate, flagged via data-theme="compact".
  const THEME_META = {
    comfort: { icon: 'sparkles', label: 'Comfort Mode', title: 'Switch to Compact View' },
    compact: { icon: 'layout-dashboard', label: 'Compact View', title: 'Switch to Comfort Mode' },
  };

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'compact' ? 'compact' : 'comfort';
  }

  function applyThemeToggleUI(theme) {
    if (!el.themeToggle) return;
    const meta = THEME_META[theme];
    const iconContainer = el.themeToggle.querySelector('.theme-toggle-icon');
    const labelEl = el.themeToggle.querySelector('.theme-toggle-label');
    if (iconContainer) {
      // Lucide replaces <i data-lucide> with an inline <svg> the first time
      // createIcons() runs, so on later toggles there's no [data-lucide]
      // element left to update in place - rebuild the placeholder <i> fresh
      // each time and let createIcons() convert it again.
      iconContainer.innerHTML = `<i data-lucide="${meta.icon}" class="w-4 h-4"></i>`;
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
      }
    }
    if (labelEl) labelEl.textContent = meta.label;
    el.themeToggle.title = meta.title;
    el.themeToggle.setAttribute('aria-pressed', theme === 'comfort' ? 'true' : 'false');
  }

  function setupThemeToggle() {
    if (!el.themeToggle) return;
    applyThemeToggleUI(currentTheme());

    el.themeToggle.addEventListener('click', () => {
      const next = currentTheme() === 'compact' ? 'comfort' : 'compact';
      if (next === 'compact') {
        document.documentElement.setAttribute('data-theme', 'compact');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (e) {}
      applyThemeToggleUI(next);
    });
  }

  function setupEventHandlers() {
    setupThemeToggle();

    if (el.addSymbol) {
      el.addSymbol.addEventListener("click", addSymbolToWatchlist);
    }
    if (el.symbolInput) {
      el.symbolInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") el.addSymbol?.click();
      });
    }
    if (el.resetData) {
      el.resetData.addEventListener("click", resetTradingData);
    }

    if (el.tfButtons && el.tfButtons.length > 0) {
      const setActiveTfButton = (tf) => {
        el.tfButtons.forEach((b) => {
          const isActive = b.getAttribute("data-tf") === tf;
          b.classList.toggle("active", isActive);
          b.classList.toggle("text-blue-400", isActive);
          b.classList.toggle("bg-slate-700/50", isActive);
          b.classList.toggle("font-bold", isActive);
          b.classList.toggle("text-slate-400", !isActive);
        });
      };
      // Restore whichever timeframe was persisted (defaults to the "5D" tab
      // marked active in the HTML, which may not match a restored value).
      // The pages share one saved value but not the same buttons (only the
      // dashboard has YTD), so fall back if this page can't show it.
      if (!el.tfButtons.some((b) => b.getAttribute("data-tf") === timeframe)) {
        timeframe = DEFAULT_TIMEFRAME;
      }
      setActiveTfButton(timeframe);

      el.tfButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          timeframe = btn.getAttribute("data-tf");
          setActiveTfButton(timeframe);
          saveLS("stock_timeframe", timeframe);
          loadCandlesAndDisplay(currentSymbol, timeframe);
        });
      });
    }

    // Update market status every minute
    setInterval(updateMarketStatus, 60000);
  }

  function updateMarketStatus() {
    const now = new Date();
    const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
    const est = new Date(utc.getTime() - (5 * 3600000));
    
    const hour = est.getHours();
    const day = est.getDay();
    
    const isWeekday = day >= 1 && day <= 5;
    const isMarketHours = hour >= 9.5 && hour < 16;
    const isAfterHours = isWeekday && ((hour >= 16 && hour < 20) || (hour >= 4 && hour < 9.5));
    
    const statusEl = el.marketStatus;
    if (!statusEl) return;
    
    const statusText = statusEl.querySelector('.status-text');
    const statusDot = statusEl.querySelector('.status-dot-compact');
    
    if (isWeekday && isMarketHours) {
      if (statusText) statusText.textContent = "Market Open";
      statusEl.className = "market-status-compact bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded";
      if (statusDot) statusDot.style.background = "#10b981";
    } else if (isAfterHours) {
      if (statusText) statusText.textContent = "After Hours";
      statusEl.className = "market-status-compact bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded";
      if (statusDot) statusDot.style.background = "#f59e0b";
    } else {
      if (statusText) statusText.textContent = "Market Closed";
      statusEl.className = "market-status-compact bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded";
      if (statusDot) statusDot.style.background = "#ef4444";
    }
  }
  
  function updateMarketIndicators() {
    const updateIndicator = async (symbol, changeId) => {
      try {
        const response = await fetch(`../api/stocks.php?symbol=${encodeURIComponent(symbol)}&latest=1`);
        if (!response.ok) return;
        const data = await response.json();
        if (!data || data.error) return;
        
        const changeEl = document.getElementById(changeId);
        if (changeEl && data.prevClose) {
          const change = ((data.last - data.prevClose) / data.prevClose) * 100;
          changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
          changeEl.className = change >= 0 ? "text-green-500" : "text-red-500";
        }
      } catch (error) {
        // Silently fail
      }
    };
    
    updateIndicator('^GSPC', 'sp-change');
    updateIndicator('^IXIC', 'nasdaq-change');
  }

  function addSymbolToWatchlist() {
    const raw = (el.symbolInput?.value || "").toUpperCase().trim();
    if (!raw) return;

    if (!isStockSymbol(raw)) {
      alert("Please enter a valid stock symbol (e.g., AAPL, GOOGL, TSLA)");
      return;
    }

    if (watchlist.includes(raw)) {
      focusSymbol(raw);
      el.symbolInput.value = "";
      return;
    }

    watchlist.push(raw);
    saveLS(STOCK_LS_KEYS.watchlist, watchlist);
    renderWatchlist();
    focusSymbol(raw);
    el.symbolInput.value = "";
  }

  function resetTradingData() {
    if (!confirm("Reset all stock trading data (positions, orders)? Watchlist will be kept.")) return;
    
    positions = {};
    orders = [];
    saveLS(STOCK_LS_KEYS.positions, positions);
    saveLS(STOCK_LS_KEYS.orders, orders);
  }

  function focusSymbol(sym) {
    if (!sym || !isStockSymbol(sym)) return;

    currentSymbol = sym;
    syncSymbolHeader();
    highlightActiveWatchlist();
    loadCandlesAndDisplay(currentSymbol, timeframe);
    notifySymbolChange();
  }

  function syncSymbolHeader() {
    // Stock info bar removed - no longer updating header elements
    // Price information is still tracked in lastPrice and changePct for internal use
  }

  function renderWatchlist() {
    if (!el.watchlist) return;
    el.watchlist.innerHTML = "";
    
    if (watchlist.length === 0) {
      const emptyMsg = document.createElement("li");
      emptyMsg.className = "p-4 text-center text-slate-400 text-sm";
      emptyMsg.textContent = "No stocks in watchlist";
      el.watchlist.appendChild(emptyMsg);
      return;
    }
    
    watchlist.forEach((sym) => {
      const item = document.createElement("li");
      item.className = `p-3 border-b border-slate-800 hover:bg-slate-800 cursor-pointer group ${sym === currentSymbol ? 'bg-slate-800' : ''}`;
      item.dataset.sym = sym;

      const lp = lastPrice[sym];
      const ch = changePct[sym];

      const priceDisplay = lp ? formatStockPrice(lp) : "—";
      const changeDisplay = ch != null ? `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%` : "—";
      const changeColor = ch != null ? (ch >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-slate-400';

      const prevFlashPrice = lastFlashedPrice[sym];
      let flashClass = '';
      if (lp != null && prevFlashPrice != null && lp !== prevFlashPrice) {
        flashClass = lp > prevFlashPrice ? 'price-flash-up' : 'price-flash-down';
      }
      if (lp != null) lastFlashedPrice[sym] = lp;

      const badgeDirClass = ch == null ? '' : (ch >= 0 ? 'badge-up' : 'badge-down');

      item.innerHTML = `
        <div class="flex justify-between items-start mb-1">
          <span class="flex items-center gap-2">
            <span class="ticker-badge ${badgeDirClass}">${sym.slice(0, 2)}</span>
            <span class="font-bold text-white text-sm">${sym}</span>
          </span>
          <span class="font-mono text-white text-sm ${flashClass}">${priceDisplay}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-slate-400">${getCompanyName(sym)}</span>
          <span class="${changeColor}">${changeDisplay}</span>
        </div>
      `;

      item.addEventListener("click", () => focusSymbol(sym));
      el.watchlist.appendChild(item);
    });

    renderWatchlistRail();
  }

  // Collapsed-sidebar icon bar: one clickable badge per watchlist symbol, so
  // collapsing the watchlist doesn't cost one-click symbol switching. Kept in
  // sync with the full list by being called at the end of renderWatchlist().
  function renderWatchlistRail() {
    if (!el.watchlistRailBadges) return;
    el.watchlistRailBadges.innerHTML = watchlist.map(sym => {
      const activeClass = sym === currentSymbol ? 'active' : '';
      return `<button type="button" class="watchlist-rail-badge ${activeClass}" data-sym="${sym}" title="${sym}">${sym.slice(0, 2)}</button>`;
    }).join('');
    el.watchlistRailBadges.querySelectorAll('[data-sym]').forEach(btn => {
      btn.addEventListener('click', () => focusSymbol(btn.dataset.sym));
    });
  }

  function getCompanyName(symbol) {
    const names = {
      'AAPL': 'Apple',
      'GOOGL': 'Google',
      'MSFT': 'Microsoft',
      'TSLA': 'Tesla',
      'AMZN': 'Amazon',
      'NVDA': 'NVIDIA'
    };
    return names[symbol] || symbol;
  }

  function highlightActiveWatchlist() {
    if (el.watchlist) {
      Array.from(el.watchlist.children).forEach((item) => {
        const sym = item.dataset.sym;
        if (sym === currentSymbol) {
          item.classList.add('bg-slate-800');
          item.classList.remove('hover:bg-slate-800');
        } else {
          item.classList.remove('bg-slate-800');
          item.classList.add('hover:bg-slate-800');
        }
      });
    }
    if (el.watchlistRailBadges) {
      Array.from(el.watchlistRailBadges.children).forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.sym === currentSymbol);
      });
    }
  }

  function startPriceUpdates() {
    if (priceUpdateTimer) {
      clearInterval(priceUpdateTimer);
    }

    const now = new Date();
    const hour = now.getHours();
    const isMarketHours = hour >= 9 && hour < 16;
    const interval = isMarketHours ? 15000 : 30000;

    priceUpdateTimer = setInterval(() => {
      updateAllPrices();
    }, interval);

    updateAllPrices();
  }

  async function updateAllPrices() {
    if (!watchlist.length) return;
    for (const symbol of watchlist) {
      try {
        await updateSymbolPrice(symbol);
        renderWatchlist();
        syncSymbolHeader();
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Silently fail
      }
    }
  }

  async function updateSymbolPrice(symbol) {
    try {
      const response = await fetch(`../api/stocks.php?symbol=${encodeURIComponent(symbol)}&latest=1`);
      if (!response.ok) return;

      const data = await response.json();
      if (!data || data.error) return;

      const currentPrice = data.last;
      const previousClose = data.prevClose || currentPrice;
      
      lastPrice[symbol] = currentPrice;
      changePct[symbol] = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
      
    } catch (error) {
      // Silently fail
    }
  }

  async function loadCandlesAndDisplay(symbol, tf) {
    const token = ++chartLoadToken;
    const isCurrent = () => token === chartLoadToken;
    const tfConfig = TIMEFRAMES[tf] || TIMEFRAMES[DEFAULT_TIMEFRAME];

    chartData = [];
    // Blank the indicators until the new data arrives (they keep their series and panes).
    if (indicators) indicators.clearData();
    if (candleSeries) {
      candleSeries.setData([]);
    }

    // Imported candles (companies page) are used as-is - they're whatever
    // granularity the spreadsheet had, so only the on-screen window follows tf.
    const local = localCandles[symbol];
    if (local && local.length) {
      chartData = local.slice().sort((a, b) => a.time - b.time);
      applyTimeFormatting(null, false);

      if (candleSeries) {
        applyChartStyleData(chartData);
        zoomToTimeframe(tf, isCurrent);
      }
      updateIndicators();
      lastPrice[symbol] = chartData[chartData.length - 1].close;
      syncSymbolHeader();
      return;
    }

    try {
      const response = await fetch(`../api/stocks.php?symbol=${encodeURIComponent(symbol)}&interval=${tfConfig.interval}&range=${tfConfig.range}`);
      if (!isCurrent()) return; // superseded by a newer symbol/timeframe request while this fetch was in flight

      if (response.ok) {
        const data = await response.json();
        if (!isCurrent()) return;
        if (data && data.candles && data.candles.length) {
          chartData = data.candles.map(c => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume ?? 0,
          }));
          applyTimeFormatting(data.timezone, tfConfig.interval !== "1d");

          if (candleSeries) {
            applyChartStyleData(chartData);
            zoomToTimeframe(tf, isCurrent);
          }
          updateIndicators();

          if (chartData.length > 0) {
            lastPrice[symbol] = chartData[chartData.length - 1].close;
          }
        }
      } else {
        createMockStockData(symbol);
      }
    } catch (error) {
      if (!isCurrent()) return;
      console.error(`❌ Error loading ${symbol} data:`, error);
      createMockStockData(symbol);
    }

    syncSymbolHeader();
  }

  function createMockStockData(symbol) {
    const basePrice = getBasePriceForSymbol(symbol);
    const now = Math.floor(Date.now() / 1000);
    const oneDaySeconds = 24 * 60 * 60;
    
    chartData = [];
    let price = basePrice;
    
    for (let i = 30; i >= 0; i--) {
      const time = now - (i * oneDaySeconds);
      const volatility = basePrice * 0.03;
      
      const change = (Math.random() - 0.5) * volatility;
      const open = price;
      const high = price + Math.random() * volatility * 0.5;
      const low = price - Math.random() * volatility * 0.5;
      price = Math.max(low, Math.min(high, price + change));
      
      chartData.push({
        time,
        open,
        high,
        low,
        close: price,
        volume: Math.floor(Math.random() * 10000000) + 1000000
      });
    }

    applyTimeFormatting(null, false);
    if (candleSeries) {
      applyChartStyleData(chartData);
      zoomToTimeframe(timeframe);
    }
    updateIndicators();
    lastPrice[symbol] = price;
    changePct[symbol] = (Math.random() - 0.5) * 6;
  }

  // Logical index range covering a timeframe's window: the last N trading
  // days (a new UTC date = a new session, which holds for US market hours),
  // the last N months, or year-to-date - never fewer than MIN_VISIBLE_CANDLES.
  function timeframeVisibleRange(data, tf) {
    const cfg = TIMEFRAMES[tf] || TIMEFRAMES[DEFAULT_TIMEFRAME];
    const dataMax = data.length - 1;
    let from = 0;
    if (cfg.sessions) {
      let sessions = 0;
      let prevDay = null;
      for (let i = dataMax; i >= 0; i--) {
        const day = Math.floor(data[i].time / 86400);
        if (day === prevDay) continue;
        if (++sessions > cfg.sessions) { from = i + 1; break; }
        prevDay = day;
      }
    } else {
      const last = new Date(data[dataMax].time * 1000);
      const cutoff = cfg.ytd
        ? Date.UTC(last.getUTCFullYear(), 0, 1) / 1000
        : Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - cfg.months, last.getUTCDate()) / 1000;
      from = data.findIndex(c => c.time >= cutoff);
    }
    return { from: Math.min(from, Math.max(0, dataMax - MIN_VISIBLE_CANDLES + 1)), to: dataMax };
  }

  // Deferred a tick so it lands after setData()'s own autoscale; isCurrent
  // drops it if a newer symbol/timeframe load has started meanwhile.
  function zoomToTimeframe(tf, isCurrent = () => true) {
    setTimeout(() => {
      if (!isCurrent() || !chart || !chartData.length) return;
      try {
        chart.timeScale().setVisibleLogicalRange(timeframeVisibleRange(chartData, tf));
      } catch (e) {}
    }, 100);
  }

  // lightweight-charts labels every time in UTC, which puts the US open at
  // "13:30". Label the time axis and crosshair in the exchange's timezone
  // instead (UTC for imported/mock candles - what they showed before), and
  // only include a time of day when the candles are intraday. Indicator
  // panels get the same formatters, since the bottom panel owns the date axis.
  function applyTimeFormatting(timeZone, intraday) {
    const fmtOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-US', { ...fmtOptions, timeZone: timeZone || 'UTC' });
    } catch (e) {
      fmt = new Intl.DateTimeFormat('en-US', { ...fmtOptions, timeZone: 'UTC' }); // zone name this browser doesn't know
    }
    const parts = (time) => {
      const p = {};
      fmt.formatToParts(new Date(time * 1000)).forEach(({ type, value }) => { p[type] = value; });
      return p;
    };
    const options = {
      localization: {
        timeFormatter: (time) => {
          const p = parts(time);
          const date = `${p.day} ${p.month} '${p.year.slice(-2)}`;
          return intraday ? `${date}  ${p.hour}:${p.minute}` : date;
        },
      },
      timeScale: {
        // tickMarkType: 0 year, 1 month, 2 day of month, 3 time, 4 time with seconds
        tickMarkFormatter: (time, tickMarkType) => {
          const p = parts(time);
          if (tickMarkType === 0) return p.year;
          if (tickMarkType === 1) return p.month;
          if (tickMarkType === 2) return p.day;
          return `${p.hour}:${p.minute}`;
        },
      },
    };
    if (chart) chart.applyOptions(options);
  }

  function getBasePriceForSymbol(symbol) {
    const prices = {
      'AAPL': 150, 'GOOGL': 2800, 'MSFT': 300, 'TSLA': 200,
      'AMZN': 3000, 'NVDA': 450, 'META': 280, 'NFLX': 400
    };
    return prices[symbol] || 100;
  }

  function setupChart() {
    try {
      if (typeof LightweightCharts === 'undefined') {
        throw new Error('LightweightCharts library not loaded');
      }

      if (!el.chart) {
        throw new Error('Chart container element not found');
      }

      const theme = {
        bg: readThemeVar('--tf-bg', '#131722'),
        text: readThemeVar('--tf-text', '#d1d4dc'),
        border: readThemeVar('--tf-border', '#2a2e39'),
        up: readThemeVar('--tf-up', '#26a69a'),
        down: readThemeVar('--tf-down', '#ef5350'),
      };

      chart = LightweightCharts.createChart(el.chart, {
        layout: {
          background: { color: theme.bg },
          textColor: theme.text,
          // Indicator panes (native panes of this chart) - drag a separator to resize.
          panes: { separatorColor: theme.border, separatorHoverColor: 'rgba(148, 163, 184, 0.3)', enableResize: true },
        },
        grid: {
          vertLines: { color: theme.border },
          horzLines: { color: theme.border },
        },
        rightPriceScale: {
          borderColor: theme.border,
          minimumWidth: (typeof MultiIndicatorSystem !== 'undefined' && MultiIndicatorSystem.PRICE_SCALE_ALIGN_WIDTH) || 56,
          scaleMargins: {
            top: 0,
            bottom: 0,
          },
        },
        timeScale: {
          borderColor: theme.border,
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
        chart.priceScale('right').applyOptions({ minimumWidth: alignW, scaleMargins: { top: 0, bottom: 0 } });
      } catch (e) {}

      candleSeries = createSeriesForStyle(chartStyle, theme.up, theme.down);

      chart.subscribeCrosshairMove((param) => {
        const bar = (param && param.time)
          ? chartData.find(c => c.time === param.time)
          : (chartData.length ? chartData[chartData.length - 1] : null);
        renderOhlcLegend(bar);
      });

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            clearTimeout(window.chartResizeTimeout);
            window.chartResizeTimeout = setTimeout(() => {
              try {
                // The chart sizes itself (autoSize, lightweight-charts v5); this
                // only tells the drawing canvas and other listeners.
                resizeListeners.forEach(cb => { try { cb(width, height); } catch (e) {} });
              } catch (error) {}
            }, 100);
          }
        }
      });
      resizeObserver.observe(el.chart);
    } catch (error) {
      console.error('❌ Failed to setup stock chart:', error);
      if (el.chart) {
        el.chart.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444; font-family: monospace;">Chart Error: ${error.message}</div>`;
      }
    }
  }

  // Repopulate the main series from the in-memory chartData array, mapped to whatever
  // shape the active chartStyle's series type expects. No API re-fetch.
  function applyChartStyleData(data) {
    if (!candleSeries || !data) return;
    if (chartStyle === 'line' || chartStyle === 'area') {
      candleSeries.setData(data.map(c => ({ time: c.time, value: c.close })));
    } else {
      candleSeries.setData(data.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    }
    renderOhlcLegend(data.length ? data[data.length - 1] : null);
  }

  function formatVolumeShort(vol) {
    if (!isFinite(vol)) return "—";
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
    if (vol >= 1e3) return (vol / 1e3).toFixed(2) + "K";
    return String(vol);
  }

  function renderOhlcLegend(bar) {
    if (!el.ohlcLegend) return;
    if (!bar) {
      el.ohlcLegend.innerHTML = "";
      return;
    }
    const cls = bar.close >= bar.open ? "ohlc-up" : "ohlc-down";
    const vol = bar.volume != null ? formatVolumeShort(bar.volume) : null;
    el.ohlcLegend.innerHTML = `
      <span><span class="ohlc-label">O</span> <span class="${cls}">${bar.open.toFixed(2)}</span></span>
      <span><span class="ohlc-label">H</span> <span class="${cls}">${bar.high.toFixed(2)}</span></span>
      <span><span class="ohlc-label">L</span> <span class="${cls}">${bar.low.toFixed(2)}</span></span>
      <span><span class="ohlc-label">C</span> <span class="${cls}">${bar.close.toFixed(2)}</span></span>
      ${vol != null ? `<span><span class="ohlc-label">Vol</span> <span class="${cls}">${vol}</span></span>` : ""}
    `;
  }

  function createSeriesForStyle(style, up, down) {
    const accent = readThemeVar('--tf-accent', '#2962ff');
    if (style === 'line') {
      return chart.addSeries(LightweightCharts.LineSeries, { color: accent, lineWidth: 2 });
    }
    if (style === 'area') {
      return chart.addSeries(LightweightCharts.AreaSeries, {
        lineColor: accent,
        topColor: 'rgba(41, 98, 255, 0.35)',
        bottomColor: 'rgba(41, 98, 255, 0.03)',
        lineWidth: 2,
      });
    }
    return chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
  }

  function setChartStyle(style) {
    if (!chart || style === chartStyle) return;

    const up = readThemeVar('--tf-up', '#26a69a');
    const down = readThemeVar('--tf-down', '#ef5350');

    try { chart.removeSeries(candleSeries); } catch (e) {}
    candleSeries = createSeriesForStyle(style, up, down);

    chartStyle = style;
    saveLS('stock_chart_style', style);
    applyChartStyleData(chartData);
  }

  function setupChartStyleDropdown() {
    const toggleBtn = document.getElementById('chart-style-btn');
    if (!toggleBtn) return;

    const STYLES = [
      { id: 'candles', label: 'Candles' },
      { id: 'line', label: 'Line' },
      { id: 'area', label: 'Area' },
    ];

    const panel = document.createElement('div');
    panel.id = 'chart-style-panel';
    panel.style.cssText = [
      'position:fixed',
      'z-index:9999',
      'background:#0f172a',
      'border:1px solid #334155',
      'border-radius:8px',
      'padding:6px',
      'min-width:130px',
      'box-shadow:0 12px 40px rgba(0,0,0,.7)',
      'display:none',
    ].join(';');
    document.body.appendChild(panel);

    function render() {
      panel.innerHTML = STYLES.map(s => `
        <div class="cs-row" data-id="${s.id}" style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:4px;cursor:pointer;font-size:12px;color:${s.id === chartStyle ? '#e2e8f0' : '#94a3b8'};background:${s.id === chartStyle ? 'rgba(41,98,255,0.15)' : 'transparent'}">
          ${s.label}
        </div>
      `).join('');

      panel.querySelectorAll('.cs-row').forEach(row => {
        row.addEventListener('mouseover', () => { if (row.dataset.id !== chartStyle) row.style.background = 'rgba(255,255,255,.05)'; });
        row.addEventListener('mouseout', () => { if (row.dataset.id !== chartStyle) row.style.background = 'transparent'; });
        row.addEventListener('click', () => {
          setChartStyle(row.dataset.id);
          toggleBtn.innerHTML = `${STYLES.find(s => s.id === row.dataset.id).label} <span style="font-size:10px;line-height:1">▾</span>`;
          panel.style.display = 'none';
          render();
        });
      });
    }
    render();

    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const rect = toggleBtn.getBoundingClientRect();
      const open = panel.style.display === 'none';
      panel.style.display = open ? 'block' : 'none';
      if (open) {
        panel.style.top = (rect.bottom + 5) + 'px';
        panel.style.left = rect.left + 'px';
      }
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== toggleBtn) panel.style.display = 'none';
    });

    // Reflect a persisted non-default style in the toggle button's label on boot
    if (chartStyle !== 'candles') {
      const cur = STYLES.find(s => s.id === chartStyle);
      if (cur) toggleBtn.innerHTML = `${cur.label} <span style="font-size:10px;line-height:1">▾</span>`;
    }
  }

  // ─── Indicators ───────────────────────────────────────────────────────────
  // One system for everything drawn from indicators (src/js/indicators/):
  // price-chart ones and ones in panes, which are native panes of this chart.
  const INDICATORS_STORAGE_KEY = 'tf_indicators_v1';
  const DEFAULT_PANES = ['MACD', 'STOCH', 'VOLUME'];

  function setupIndicators() {
    const NS = window.TFIndicators;
    if (!chart || !NS || !NS.IndicatorManager) {
      console.error('Stock app: indicator modules (src/js/indicators) not loaded');
      return;
    }
    try {
      indicators = new NS.IndicatorManager({
        chart,
        host: el.chart,
        mainLegendHost: document.getElementById('chart-overlay-legend'),
        storageKey: INDICATORS_STORAGE_KEY,
        // Pane added/removed/resized: the drawing canvas follows the price pane.
        onLayoutChange: () => resizeListeners.forEach(cb => { try { cb(); } catch (e) {} }),
      });

      const saved = loadLS(INDICATORS_STORAGE_KEY, null);
      if (saved && Array.isArray(saved.instances)) {
        indicators.restore(saved);
      } else {
        // First run on this system: bring over the old overlay menu's and
        // indicator panels' saved selections (or the old default panels).
        indicators.migrateLegacy({
          overlays: loadLS('stock_overlays_v2', []),
          overlayParams: loadLS('stock_overlay_params_v2', {}),
          panels: loadLS('stock_indicator_layout', null) || DEFAULT_PANES.map(indicatorType => ({ indicatorType })),
        });
      }

      document.querySelectorAll('#indicators-btn, [data-open-indicators]').forEach(btn => {
        btn.addEventListener('click', () => indicators.openPicker());
      });
      indicators.onChange(updateIndicatorsButton);
      updateIndicatorsButton();
    } catch (error) {
      console.error('❌ Stock app: Failed to set up indicators:', error);
    }
  }

  // "Indicators (5)" on the toolbar button(s).
  function updateIndicatorsButton() {
    const n = indicators ? indicators.instances.length : 0;
    document.querySelectorAll('.indicators-btn-count').forEach(el => { el.textContent = n ? String(n) : ''; });
  }

  function setupChartControls() {
    const btnLeft = document.getElementById('btn-pan-left');
    const btnRight = document.getElementById('btn-pan-right');
    const btnReset = document.getElementById('btn-reset-view');
    const btnJumpFirst = document.getElementById('btn-jump-first');
    const btnJumpLast = document.getElementById('btn-jump-last');

    if (!btnLeft || !btnRight) {
      return;
    }

    const getRange = () => chart?.timeScale().getVisibleLogicalRange();
    const setRangeBoth = (range) => {
      if (!range || !chart) return;
      try { 
        chart.timeScale().setVisibleLogicalRange(range); 
      } catch (e) { 
        console.error('Error setting range:', e);
      }
    };

    btnLeft.addEventListener('click', () => {
      adjustPan(-0.15);
    });
    btnRight.addEventListener('click', () => {
      adjustPan(0.15);
    });
    btnReset?.addEventListener('click', () => {
      resetToDefaultView();
    });
    
    if (btnJumpFirst) {
      btnJumpFirst.addEventListener('click', function() {
        jumpToFirst();
      });
    }

    if (btnJumpLast) {
      btnJumpLast.addEventListener('click', function() {
        jumpToLast();
      });
    }

    function resetToDefaultView() {
      if (!chartData.length) return;
      setRangeBoth(timeframeVisibleRange(chartData, timeframe));
    }
    
    function jumpToFirst() {
      if (!chartData || chartData.length === 0) return;
      if (!chart) return;
      
      // Use time-based coordinates instead of logical indices
      const firstTime = chartData[0].time;
      const lastTime = chartData[chartData.length - 1].time;
      
      // Calculate a range that shows about 40 candles from the start
      let endTime = firstTime;
      if (chartData.length > 1) {
        const candleDuration = chartData[1].time - chartData[0].time;
        endTime = firstTime + (candleDuration * 40);
      }
      
      // Make sure we don't exceed the last candle
      if (endTime > lastTime) {
        endTime = lastTime;
      }

      try {
        chart.timeScale().setVisibleRange({
          from: firstTime,
          to: endTime
        });
      } catch (e) {
        console.error('Error jumping to first:', e);
      }
    }
    
    function jumpToLast() {
      if (!chartData || chartData.length === 0) return;
      if (!chart) return;
      
      // Use time-based coordinates instead of logical indices
      const firstTime = chartData[0].time;
      const lastTime = chartData[chartData.length - 1].time;
      
      // Calculate a range that shows about 40 candles before the end
      let startTime = lastTime;
      if (chartData.length > 1) {
        const candleDuration = chartData[1].time - chartData[0].time;
        startTime = lastTime - (candleDuration * 40);
      }
      
      // Make sure we don't go before the first candle
      if (startTime < firstTime) {
        startTime = firstTime;
      }

      try {
        chart.timeScale().setVisibleRange({
          from: startTime,
          to: lastTime
        });
      } catch (e) {
        console.error('Error jumping to last:', e);
      }
    }
    
    function adjustPan(deltaFraction) {
      const r = getRange();
      if (!r || !chartData.length) return;
      const dataMin = 0;
      const dataMax = chartData.length - 1;
      const span = (r.to - r.from);
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
      const newR = { from: Math.max(dataMin, newFrom), to: Math.min(dataMax, newTo) };
      setRangeBoth(newR);
    }
  }

  function updateIndicators() {
    if (!chartData.length || !indicators) return;
    try {
      indicators.setData(chartData);
    } catch (error) {
      console.error('❌ Error updating indicators:', error);
    }
  }

  // Utility Functions
  function isStockSymbol(sym) {
    return sym && typeof sym === 'string' && 
           sym.length >= 1 && sym.length <= 5 && 
           /^[A-Z]+$/.test(sym) && 
           !sym.endsWith('USDT') && 
           !sym.endsWith('BUSD');
  }

  function formatStockPrice(price) {
    if (!isFinite(price)) return "—";
    return `$${price.toFixed(2)}`;
  }

  function readThemeVar(name, fallback) {
    try {
      const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return val || fallback;
    } catch {
      return fallback;
    }
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
      return s ? JSON.parse(s) : fallback;
    } catch {
      return fallback;
    }
  }

  // Expose for debugging
  window.stockApp = {
    watchlist,
    positions,
    orders,
    localCandles,
    lastPrice,
    changePct,
    loadLS,
    saveLS,
    STOCK_LS_KEYS
  };

})();
