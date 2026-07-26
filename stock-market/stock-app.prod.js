/* TradeLite Stock Market App - Design 3 (TradeFlow Style) */
(function () {
  // Stock-specific configuration
  const DEFAULT_STOCK_SYMBOLS = ["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN", "NVDA"];
  const DEFAULT_TIMEFRAME = "5d";
  
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

  let currentSymbol = watchlist[0] || "AAPL";
  let timeframe = loadLS("stock_timeframe", DEFAULT_TIMEFRAME);

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

  // Multi-Indicator System
  let indicatorSystem = null;
  let panelIds = [];

  // Main-chart overlay state
  let overlaySeries = {};
  const activeOverlays = new Set();
  let overlayParams = {};

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

  // ─── Overlay indicator definitions ───────────────────────────────────────
  const OVERLAY_DEFS = [
    { id:'SMA20',  group:'Moving Averages', label:'SMA',         color:'#34d399', defaultParam:20  },
    { id:'SMA200', group:'Moving Averages', label:'SMA',         color:'#f97316', defaultParam:200 },
    { id:'EMA9',   group:'Moving Averages', label:'EMA',         color:'#a78bfa', defaultParam:9   },
    { id:'EMA55',  group:'Moving Averages', label:'EMA',         color:'#fb7185', defaultParam:55  },
    { id:'BB20',   group:'Bands',           label:'Bollinger',   color:'#94a3b8', multi:true, defaultParam:20 },
    { id:'VWAP',   group:'Other',           label:'VWAP',        color:'#22d3ee' },
    { id:'KAMA',   group:'Other',           label:'Adaptive MA', color:'#4ade80', defaultParam:10  },
    { id:'HullMA', group:'Other',           label:'Hull MA',     color:'#fbbf24', defaultParam:10  },
    { id:'DEMA20', group:'Other',           label:'DEMA',        color:'#e879f9', defaultParam:20  },
    { id:'WVC',    group:'Bands', label:'WilliamsVC', color:'#38bdf8', colorUpper:'#f87171', colorLower:'#4ade80', multi:true, defaultParam:10, defaultParam2:9, paramLabel:'day', paramLabel2:'esp' },
    { id:'CKstop',          group:'Bands', label:'CK Stop',      color:'#4ade80', colorLong:'#4ade80', colorShort:'#f87171', multi:true, defaultParam:10, paramLabel:'n' },
    { id:'DonchianChannel', group:'Bands', label:'Donchian',      color:'#60a5fa',                                              multi:true, defaultParam:20, paramLabel:'n' },
    { id:'ChandelierExit',  group:'Bands', label:'Chandelier',    color:'#fbbf24', colorLong:'#4ade80', colorShort:'#f87171', multi:true, defaultParam:20, paramLabel:'n' },
  ];

  // ─── Compute helpers ─────────────────────────────────────────────────────
  function computeSMAData(data, period) {
    return data.map((d, i) => {
      if (i < period - 1) return { time: d.time, value: null };
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
      return { time: d.time, value: sum / period };
    });
  }

  function computeEMAData(data, period) {
    const k = 2 / (period + 1);
    let ema = null;
    return data.map((d, i) => {
      ema = ema === null ? d.close : d.close * k + ema * (1 - k);
      return { time: d.time, value: i >= period - 1 ? ema : null };
    });
  }

  function computeBBData(data, period, mult) {
    const upper = [], middle = [], lower = [];
    data.forEach((d, i) => {
      if (i < period - 1) {
        upper.push({ time: d.time, value: null });
        middle.push({ time: d.time, value: null });
        lower.push({ time: d.time, value: null });
        return;
      }
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
      const sma = sum / period;
      let variance = 0;
      for (let j = i - period + 1; j <= i; j++) variance += (data[j].close - sma) ** 2;
      const sd = Math.sqrt(variance / period);
      upper.push({ time: d.time, value: sma + mult * sd });
      middle.push({ time: d.time, value: sma });
      lower.push({ time: d.time, value: sma - mult * sd });
    });
    return { upper, middle, lower };
  }

  function computeVWAPData(data) {
    let cumTPV = 0, cumVol = 0;
    return data.map(d => {
      const tp = (d.high + d.low + d.close) / 3;
      cumTPV += tp * (d.volume || 0);
      cumVol += (d.volume || 0);
      return { time: d.time, value: cumVol > 0 ? cumTPV / cumVol : null };
    });
  }

  function computeKAMAData(data, day) {
    if (!window.AdaptiveMA) return null;
    const highs  = data.map(d => d.high);
    const lows   = data.map(d => d.low);
    const closes = data.map(d => d.close);
    try {
      const out = window.AdaptiveMA(highs, lows, closes, day);
      const src = out && out.AdaptiveMA ? out.AdaptiveMA : [];
      return data.map((d, i) => ({ time: d.time, value: (src[i+1] != null && Number.isFinite(src[i+1])) ? src[i+1] : null }));
    } catch (e) { return null; }
  }

  function computeHullMAData(data, day) {
    const fn = window.computeHullMA || window.HullMA;
    if (!fn) return null;
    const closes = data.map(d => d.close);
    try {
      const out = fn(closes, day, 9);
      const src = out && out.HMA ? out.HMA : [];
      return data.map((d, i) => ({ time: d.time, value: (src[i+1] != null && Number.isFinite(src[i+1])) ? src[i+1] : null }));
    } catch (e) { return null; }
  }

  function computeDEMAData(data, esp) {
    const fn = window.DEMA || window.computeDEMA;
    if (!fn) return null;
    const closes = data.map(d => d.close);
    try {
      const out = fn(closes, esp);
      const src = out && out.DEMA ? out.DEMA : [];
      return data.map((d, i) => ({ time: d.time, value: (src[i+1] != null && Number.isFinite(src[i+1])) ? src[i+1] : null }));
    } catch (e) { return null; }
  }

  function computeWVCData(data, day, esp) {
    const fn = window.WilliamsVolatilityChannel;
    if (!fn) return null;
    const highs  = data.map(d => d.high);
    const lows   = data.map(d => d.low);
    const closes = data.map(d => d.close);
    try {
      const out = fn(highs, lows, closes, day, esp != null ? esp : 9);
      if (!out) return null;
      const srcMid   = out.MiddleLine || [];
      const srcUpper = out.UpperLine  || [];
      const srcLower = out.LowerLine  || [];
      const toSeries = src => data.map((d, i) => ({
        time:  d.time,
        value: (src[i + 1] != null && Number.isFinite(src[i + 1])) ? src[i + 1] : null
      }));
      return { middle: toSeries(srcMid), upper: toSeries(srcUpper), lower: toSeries(srcLower) };
    } catch (e) { return null; }
  }

  function computeDonchianData(data, num) {
    const fn = window.DonchianChannel;
    if (!fn) return null;
    const highs = data.map(d => d.high);
    const lows  = data.map(d => d.low);
    try {
      const out = fn(highs, lows, num);
      if (!out) return null;
      const srcUpper  = out.UpperChannel  || [];
      const srcMiddle = out.MiddleChannel || [];
      const srcLower  = out.LowerChannel  || [];
      const toSeries = src => data.map((d, i) => ({
        time:  d.time,
        value: (src[i + 1] != null && Number.isFinite(src[i + 1])) ? src[i + 1] : null
      }));
      return { upper: toSeries(srcUpper), middle: toSeries(srcMiddle), lower: toSeries(srcLower) };
    } catch (e) { return null; }
  }

  function computeChandelierData(data, num) {
    const fn = window.ChandelierExit;
    if (!fn) return null;
    const highs  = data.map(d => d.high);
    const lows   = data.map(d => d.low);
    const closes = data.map(d => d.close);
    try {
      const out = fn(highs, lows, closes, num);
      if (!out) return null;
      const srcLong  = out.Long_ChandelierExit  || [];
      const srcShort = out.Short_ChandelierExit || [];
      const toSeries = src => data.map((d, i) => ({
        time:  d.time,
        value: (src[i + 1] != null && Number.isFinite(src[i + 1])) ? src[i + 1] : null
      }));
      return { long: toSeries(srcLong), short: toSeries(srcShort) };
    } catch (e) { return null; }
  }

  function computeCKstopData(data, num) {
    const fn = window.CKstop;
    if (!fn) return null;
    const highs  = data.map(d => d.high);
    const lows   = data.map(d => d.low);
    const closes = data.map(d => d.close);
    try {
      const out = fn(highs, lows, closes, num);
      if (!out) return null;
      const srcLong  = out.CKS_Long  || [];
      const srcShort = out.CKS_Short || [];
      const toSeries = src => data.map((d, i) => ({
        time:  d.time,
        value: (src[i + 1] != null && Number.isFinite(src[i + 1])) ? src[i + 1] : null
      }));
      return { long: toSeries(srcLong), short: toSeries(srcShort) };
    } catch (e) { return null; }
  }

  function getOverlayParam(id) {
    const def = OVERLAY_DEFS.find(x => x.id === id);
    return overlayParams[id] != null ? overlayParams[id] : (def && def.defaultParam != null ? def.defaultParam : 20);
  }

  function getOverlayParam2(id) {
    const def = OVERLAY_DEFS.find(x => x.id === id);
    return overlayParams[id + '_2'] != null ? overlayParams[id + '_2'] : (def && def.defaultParam2 != null ? def.defaultParam2 : null);
  }

  function getOverlayTitle(id) {
    const def = OVERLAY_DEFS.find(x => x.id === id);
    if (!def) return id;
    const p = getOverlayParam(id);
    return def.defaultParam != null ? `${def.label}(${p})` : def.label;
  }

  function getOverlayData(id) {
    const d = chartData;
    const p = getOverlayParam(id);
    switch (id) {
      case 'SMA20':
      case 'SMA200': return { type:'single', data: computeSMAData(d, p)    };
      case 'EMA9':
      case 'EMA55':  return { type:'single', data: computeEMAData(d, p)    };
      case 'BB20':   return { type:'bb',     ...computeBBData(d, p, 2)     };
      case 'VWAP':   return { type:'single', data: computeVWAPData(d)      };
      case 'KAMA':   return { type:'single', data: computeKAMAData(d, p)   };
      case 'HullMA': return { type:'single', data: computeHullMAData(d, p) };
      case 'DEMA20': return { type:'single', data: computeDEMAData(d, p)   };
      case 'WVC':    return { type:'wvc',    ...computeWVCData(d, p, getOverlayParam2(id)) };
      case 'CKstop':          return { type:'cks',      ...computeCKstopData(d, p)    };
      case 'DonchianChannel': return { type:'donchian', ...computeDonchianData(d, p)  };
      case 'ChandelierExit':  return { type:'cks',      ...computeChandelierData(d, p) };
      default: return null;
    }
  }

  // ─── Series management ────────────────────────────────────────────────────
  function nonNull(arr) {
    return (arr || []).filter(p => p.value !== null);
  }

  function addOverlayToChart(id) {
    if (!chart || overlaySeries[id]) return;
    const def = OVERLAY_DEFS.find(d => d.id === id);
    if (!def || !chartData.length) return;
    const result = getOverlayData(id);
    if (!result) return;

    if (result.type === 'bb') {
      const p = getOverlayParam(id);
      const opts = { lineWidth: 2.5, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true };
      const s1 = chart.addLineSeries({ ...opts, color: def.color, title: `BB+(${p})` });
      const s2 = chart.addLineSeries({ ...opts, color: def.color, lineStyle: 0, title: `BB(${p})` });
      const s3 = chart.addLineSeries({ ...opts, color: def.color, title: `BB-(${p})` });
      s1.setData(nonNull(result.upper));
      s2.setData(nonNull(result.middle));
      s3.setData(nonNull(result.lower));
      overlaySeries[id] = [s1, s2, s3];
    } else if (result.type === 'wvc') {
      const p    = getOverlayParam(id);
      const opts = { lineWidth: 2.5, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true };
      const sUpper  = chart.addLineSeries({ ...opts, color: def.colorUpper || def.color, lineStyle: 2, title: `WVC+(${p})` });
      const sMiddle = chart.addLineSeries({ ...opts, color: def.color,                   lineStyle: 0, title: `WVC(${p})`  });
      const sLower  = chart.addLineSeries({ ...opts, color: def.colorLower || def.color, lineStyle: 2, title: `WVC-(${p})` });
      sUpper .setData(nonNull(result.upper));
      sMiddle.setData(nonNull(result.middle));
      sLower .setData(nonNull(result.lower));
      overlaySeries[id] = [sUpper, sMiddle, sLower];
    } else if (result.type === 'cks') {
      if (!result.long || !result.short) return;
      const p    = getOverlayParam(id);
      const lbl  = def.label || id;
      const opts = { lineWidth: 2.5, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true };
      const sLong  = chart.addLineSeries({ ...opts, color: def.colorLong  || '#4ade80', lineStyle: 0, title: `${lbl}-Long(${p})`  });
      const sShort = chart.addLineSeries({ ...opts, color: def.colorShort || '#f87171', lineStyle: 0, title: `${lbl}-Short(${p})` });
      sLong .setData(nonNull(result.long));
      sShort.setData(nonNull(result.short));
      overlaySeries[id] = [sLong, sShort];
    } else if (result.type === 'donchian') {
      if (!result.upper || !result.lower) return;
      const p    = getOverlayParam(id);
      const opts = { lineWidth: 2.5, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true };
      const sUpper  = chart.addLineSeries({ ...opts, color: def.color, lineStyle: 2, title: `DC+(${p})` });
      const sMiddle = chart.addLineSeries({ ...opts, color: def.color, lineStyle: 0, title: `DC(${p})`  });
      const sLower  = chart.addLineSeries({ ...opts, color: def.color, lineStyle: 2, title: `DC-(${p})` });
      sUpper .setData(nonNull(result.upper));
      sMiddle.setData(nonNull(result.middle));
      sLower .setData(nonNull(result.lower));
      overlaySeries[id] = [sUpper, sMiddle, sLower];
    } else {
      if (!result.data) return;
      const pts = nonNull(result.data);
      if (!pts.length) return;
      const s = chart.addLineSeries({ color: def.color, lineWidth: 2.5, title: getOverlayTitle(id), priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true });
      s.setData(pts);
      overlaySeries[id] = [s];
    }
  }

  function removeOverlayFromChart(id) {
    if (!chart || !overlaySeries[id]) return;
    overlaySeries[id].forEach(s => { try { chart.removeSeries(s); } catch (e) {} });
    delete overlaySeries[id];
  }

  function refreshOverlays() {
    activeOverlays.forEach(id => {
      if (!overlaySeries[id]) { addOverlayToChart(id); return; }
      const result = getOverlayData(id);
      if (!result) return;
      if (result.type === 'bb') {
        overlaySeries[id][0].setData(nonNull(result.upper));
        overlaySeries[id][1].setData(nonNull(result.middle));
        overlaySeries[id][2].setData(nonNull(result.lower));
      } else if (result.type === 'wvc') {
        overlaySeries[id][0].setData(nonNull(result.upper));
        overlaySeries[id][1].setData(nonNull(result.middle));
        overlaySeries[id][2].setData(nonNull(result.lower));
      } else if (result.type === 'cks') {
        overlaySeries[id][0].setData(nonNull(result.long));
        overlaySeries[id][1].setData(nonNull(result.short));
      } else if (result.type === 'donchian') {
        overlaySeries[id][0].setData(nonNull(result.upper));
        overlaySeries[id][1].setData(nonNull(result.middle));
        overlaySeries[id][2].setData(nonNull(result.lower));
      } else if (result.data) {
        overlaySeries[id][0].setData(nonNull(result.data));
      }
    });
  }

  function toggleOverlay(id) {
    if (activeOverlays.has(id)) {
      activeOverlays.delete(id);
      removeOverlayFromChart(id);
    } else {
      activeOverlays.add(id);
      addOverlayToChart(id);
    }
    saveLS('stock_overlays_v2', [...activeOverlays]);
    updateOverlayBtn();
  }

  function clearAllOverlays() {
    [...activeOverlays].forEach(id => removeOverlayFromChart(id));
    activeOverlays.clear();
    saveLS('stock_overlays_v2', []);
    document.querySelectorAll('.overlay-check').forEach(cb => { cb.checked = false; });
    updateOverlayBtn();
  }

  function updateOverlayBtn() {
    const btn = document.getElementById('overlay-toggle-btn');
    if (!btn) return;
    const n = activeOverlays.size;
    btn.innerHTML = n > 0
      ? `Overlay(${n}) <span style="font-size:10px;line-height:1">▾</span>`
      : `Overlay <span style="font-size:10px;line-height:1">▾</span>`;
    btn.style.color = n > 0 ? '#60a5fa' : '';
  }

  // ─── Dropdown UI ──────────────────────────────────────────────────────────
  function setupOverlayDropdown() {
    const saved = loadLS('stock_overlays_v2', []);
    saved.forEach(id => { if (OVERLAY_DEFS.find(d => d.id === id)) activeOverlays.add(id); });

    // Load saved params
    const savedParams = loadLS('stock_overlay_params_v2', {});
    OVERLAY_DEFS.forEach(def => {
      if (def.defaultParam  != null) overlayParams[def.id]        = savedParams[def.id]        != null ? savedParams[def.id]        : def.defaultParam;
      if (def.defaultParam2 != null) overlayParams[def.id + '_2'] = savedParams[def.id + '_2'] != null ? savedParams[def.id + '_2'] : def.defaultParam2;
    });

    const toggleBtn = document.getElementById('overlay-toggle-btn');
    if (!toggleBtn) return;

    const panel = document.createElement('div');
    panel.id = 'overlay-panel';
    panel.style.cssText = [
      'position:fixed',
      'z-index:9999',
      'background:#0f172a',
      'border:1px solid #334155',
      'border-radius:8px',
      'padding:12px 14px',
      'min-width:240px',
      'box-shadow:0 12px 40px rgba(0,0,0,.7)',
      'display:none',
    ].join(';');
    document.body.appendChild(panel);

    const groups = [...new Set(OVERLAY_DEFS.map(d => d.group))];
    let html = '';
    groups.forEach((group, gi) => {
      html += `<div style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.08em;margin:${gi > 0 ? '10px' : '0'} 0 5px">${group}</div>`;
      OVERLAY_DEFS.filter(d => d.group === group).forEach(def => {
        const chk = activeOverlays.has(def.id) ? 'checked' : '';
        const curParam  = overlayParams[def.id]        ?? def.defaultParam;
        const curParam2 = overlayParams[def.id + '_2'] ?? def.defaultParam2;
        const inputStyle = 'width:40px;background:#1e293b;border:1px solid #334155;border-radius:3px;color:#94a3b8;font-size:11px;padding:1px 4px;text-align:right;outline:none;flex-shrink:0';
        const paramInput = def.defaultParam != null
          ? `<span style="font-size:10px;color:#475569;flex-shrink:0">${def.paramLabel || 'n'}</span><input type="number" class="overlay-param" data-id="${def.id}" value="${curParam}" min="2" max="999" style="${inputStyle}">`
          : '';
        const paramInput2 = def.defaultParam2 != null
          ? `<span style="font-size:10px;color:#475569;flex-shrink:0">${def.paramLabel2 || 'n2'}</span><input type="number" class="overlay-param2" data-id="${def.id}" value="${curParam2}" min="1" max="999" style="${inputStyle}">`
          : '';
        html += `<div style="display:flex;align-items:center;gap:5px;padding:3px 6px;border-radius:4px" class="ol-row">
          <input type="checkbox" class="overlay-check" data-id="${def.id}" ${chk} style="cursor:pointer;accent-color:${def.color};width:13px;height:13px;flex-shrink:0">
          <span style="width:8px;height:8px;border-radius:50%;background:${def.color};flex-shrink:0;display:inline-block"></span>
          <span style="flex:1;font-size:11.5px;color:#cbd5e1;white-space:nowrap">${def.label}</span>
          ${paramInput}${paramInput2}
        </div>`;
      });
    });
    html += `<div style="border-top:1px solid #1e293b;margin-top:10px;padding-top:8px;display:flex;justify-content:flex-end">
      <button id="overlay-clear-btn" style="font-size:11px;color:#94a3b8;background:transparent;border:1px solid #334155;border-radius:4px;padding:2px 10px;cursor:pointer">Clear All</button>
    </div>`;
    panel.innerHTML = html;

    panel.querySelectorAll('.ol-row').forEach(row => {
      row.addEventListener('mouseover', () => row.style.background = 'rgba(255,255,255,.05)');
      row.addEventListener('mouseout',  () => row.style.background = '');
    });

    panel.querySelectorAll('.overlay-check').forEach(cb => {
      cb.addEventListener('change', () => toggleOverlay(cb.dataset.id));
    });

    panel.querySelectorAll('.overlay-param').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.id;
        const val = Math.max(2, Math.min(999, parseInt(inp.value) || 2));
        inp.value = val;
        overlayParams[id] = val;
        saveLS('stock_overlay_params_v2', overlayParams);
        if (activeOverlays.has(id)) { removeOverlayFromChart(id); addOverlayToChart(id); }
      });
      inp.addEventListener('click', e => e.stopPropagation());
    });

    panel.querySelectorAll('.overlay-param2').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.dataset.id;
        const val = Math.max(1, Math.min(999, parseInt(inp.value) || 1));
        inp.value = val;
        overlayParams[id + '_2'] = val;
        saveLS('stock_overlay_params_v2', overlayParams);
        if (activeOverlays.has(id)) { removeOverlayFromChart(id); addOverlayToChart(id); }
      });
      inp.addEventListener('click', e => e.stopPropagation());
    });

    panel.querySelector('#overlay-clear-btn')?.addEventListener('click', clearAllOverlays);

    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      const rect = toggleBtn.getBoundingClientRect();
      const open = panel.style.display === 'none';
      panel.style.display = open ? 'block' : 'none';
      if (open) {
        panel.style.top  = (rect.bottom + 5) + 'px';
        panel.style.left = rect.left + 'px';
      }
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== toggleBtn) panel.style.display = 'none';
    });

    updateOverlayBtn();
    if (chartData.length) refreshOverlays();
  }

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
      setupIndicatorSystem();
      setupChartControls();
      setupOverlayDropdown();
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
      getIndicatorSystem: () => indicatorSystem,
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

  function setupEventHandlers() {
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

      item.innerHTML = `
        <div class="flex justify-between items-start mb-1">
          <span class="font-bold text-white text-sm">${sym}</span>
          <span class="font-mono text-white text-sm">${priceDisplay}</span>
        </div>
        <div class="flex justify-between text-xs">
          <span class="text-slate-400">${getCompanyName(sym)}</span>
          <span class="${changeColor}">${changeDisplay}</span>
        </div>
      `;

      item.addEventListener("click", () => focusSymbol(sym));
      el.watchlist.appendChild(item);
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
    if (!el.watchlist) return;
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

    chartData = [];
    // Remove stale overlay series from chart before loading new data; keep activeOverlays so refreshOverlays() re-applies them after new data is set
    [...activeOverlays].forEach(id => removeOverlayFromChart(id));
    if (candleSeries) {
      candleSeries.setData([]);
    }

    const local = localCandles[symbol];
    if (local && local.length) {
      chartData = local.slice().sort((a, b) => a.time - b.time);

      if (candleSeries) {
        applyChartStyleData(chartData);
        setTimeout(() => {
          if (!isCurrent()) return;
          if (chartData.length > 0) {
            const dataMax = chartData.length - 1;
            const visibleCandles = Math.min(40, chartData.length);
            const range = {
              from: Math.max(0, dataMax - visibleCandles + 1),
              to: dataMax
            };
            try {
              chart.timeScale().setVisibleLogicalRange(range);
            } catch (e) {}
          }
        }, 100);
      }
      updateIndicators();
      lastPrice[symbol] = chartData[chartData.length - 1].close;
      syncSymbolHeader();
      return;
    }

    try {
      const response = await fetch(`../api/stocks.php?symbol=${encodeURIComponent(symbol)}`);
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

          if (candleSeries) {
            applyChartStyleData(chartData);

            setTimeout(() => {
              if (!isCurrent()) return;
              if (chartData.length > 0) {
                const dataMax = chartData.length - 1;
                const visibleCandles = Math.min(40, chartData.length);
                const range = {
                  from: Math.max(0, dataMax - visibleCandles + 1),
                  to: dataMax
                };
                try {
                  chart.timeScale().setVisibleLogicalRange(range);
                } catch (e) {}
              }
            }, 100);
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

    if (candleSeries) {
      applyChartStyleData(chartData);
      setTimeout(() => {
        if (chartData.length > 0) {
          const dataMax = chartData.length - 1;
          // Show last 40 candles by default (good balance for analysis)
          const visibleCandles = Math.min(40, chartData.length);
          const newRange = {
            from: Math.max(0, dataMax - visibleCandles + 1),
            to: dataMax
          };
          try {
            chart.timeScale().setVisibleLogicalRange(newRange);
          } catch (e) {}
        }
      }, 50);
    }
    updateIndicators();
    lastPrice[symbol] = price;
    changePct[symbol] = (Math.random() - 0.5) * 6;
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
                chart.resize(width, height);
                if (indicatorSystem && typeof indicatorSystem.syncIndicatorChartWidths === 'function') {
                  indicatorSystem.syncIndicatorChartWidths(el.chart);
                }
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
      return chart.addLineSeries({ color: accent, lineWidth: 2 });
    }
    if (style === 'area') {
      return chart.addAreaSeries({
        lineColor: accent,
        topColor: 'rgba(41, 98, 255, 0.35)',
        bottomColor: 'rgba(41, 98, 255, 0.03)',
        lineWidth: 2,
      });
    }
    return chart.addCandlestickSeries({
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
    if (indicatorSystem) indicatorSystem.mainSeries = candleSeries;

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

  function setupIndicatorSystem() {
    try {
      if (typeof MultiIndicatorSystem === 'undefined') {
        console.error('Stock app: MultiIndicatorSystem class not loaded');
        return;
      }
      indicatorSystem = new MultiIndicatorSystem();
      if (chart) {
        indicatorSystem.setMainTimeScale(chart.timeScale(), chart, candleSeries);
      }
      indicatorSystem.enableLayoutPersistence('stock_indicator_layout');

      // Restore the previously-saved indicator list + their own parameters if
      // one exists, otherwise fall back to the 3 defaults (always show 3).
      const MAX_INDICATORS = 5;
      const savedLayout = indicatorSystem.loadLayout('stock_indicator_layout');
      const layout = savedLayout
        ? savedLayout.slice(0, MAX_INDICATORS)
        : ['MACD', 'STOCH', 'VOLUME'].map(indicatorType => ({ indicatorType, params: null }));

      const container = document.getElementById('indicators-container');

      if (container) {
        layout.forEach((entry, index) => {
          const panelId = `indicator-panel-${index}`;
          panelIds.push(panelId);
          const panel = indicatorSystem.createIndicatorPanel(panelId, 'indicators-container', entry.indicatorType);
          if (panel && entry.params) {
            panel.params = { ...panel.params, ...entry.params };
            indicatorSystem.updateParametersDisplay(panelId);
          }
        });
        updateIndicatorCount();
        if (el.chart && typeof indicatorSystem.syncIndicatorChartWidths === 'function') {
          indicatorSystem.syncIndicatorChartWidths(el.chart);
          setTimeout(() => indicatorSystem.syncIndicatorChartWidths(el.chart), 150);
        }
      }

      setupAddIndicatorButton();
      setupViewToggleButton();

      // Override removePanel to update button state
      const originalRemovePanel = indicatorSystem.removePanel.bind(indicatorSystem);
      indicatorSystem.removePanel = function(panelId) {
        originalRemovePanel(panelId);
        // Remove from panelIds array
        const index = panelIds.indexOf(panelId);
        if (index > -1) {
          panelIds.splice(index, 1);
        }
        updateIndicatorCount();
        
        // Re-enable add button if we're below max
        const addBtn = document.getElementById('add-indicator-btn');
        if (addBtn && panelIds.length < MAX_INDICATORS) {
          addBtn.disabled = false;
          addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          addBtn.title = 'Add New Indicator';
        }
      };
    } catch (error) {
      console.error('❌ Stock app: Failed to setup indicator system:', error);
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
      
      // Maximum of 5 indicators allowed
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
        const panel = indicatorSystem.createIndicatorPanel(panelId, 'indicators-container', indicatorName);
        if (panel && chartData.length) {
          indicatorSystem.updateSinglePanel(panelId);
        }
        updateIndicatorCount();
        if (el.chart && typeof indicatorSystem.syncIndicatorChartWidths === 'function') {
          indicatorSystem.syncIndicatorChartWidths(el.chart);
        }
        // Disable add button if we've reached the maximum
        if (panelIds.length >= MAX_INDICATORS) {
          addBtn.disabled = true;
          addBtn.classList.add('opacity-50', 'cursor-not-allowed');
          addBtn.title = `Maximum ${MAX_INDICATORS} indicators reached`;
        }
      }
    });
  }

  function setupViewToggleButton() {
    const toggleBtn = document.getElementById('view-toggle-btn');
    const label = document.getElementById('view-toggle-label');
    if (!toggleBtn || !indicatorSystem) return;

    toggleBtn.addEventListener('click', () => {
      const nextMode = indicatorSystem.viewMode === 'tabbed' ? 'stacked' : 'tabbed';
      indicatorSystem.setViewMode(nextMode);
      if (label) label.textContent = nextMode === 'tabbed' ? 'Tabs' : 'Stacked';
      toggleBtn.classList.toggle('active', nextMode === 'tabbed');
      toggleBtn.title = nextMode === 'tabbed'
        ? 'Switch to stacked view (show all indicators)'
        : 'Switch to tabbed view (one indicator at a time)';
    });
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
      
      const dataMax = chartData.length - 1;
      // Show last 40 candles by default (good balance for analysis)
      const defaultVisibleCandles = Math.min(40, chartData.length);
      const newR = {
        from: Math.max(0, dataMax - defaultVisibleCandles + 1),
        to: dataMax
      };
      setRangeBoth(newR);
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
    if (!chartData.length) return;
    try {
      if (indicatorSystem) indicatorSystem.updateAllPanels(chartData);
    } catch (error) {
      console.error('❌ Error updating indicators:', error);
    }
    try { refreshOverlays(); } catch (e) {}
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
