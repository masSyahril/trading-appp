/*
 * TradeFlow indicator registry (indicator system v2): one catalog for every
 * indicator, whether it draws on the price chart or in its own pane.
 *
 * A declarative entry is all a new indicator needs:
 *   {
 *     id, name, shortName?, category, placement: 'chart' | 'pane',
 *     params:  [{ key, label, default, min?, max?, step? }]  (or [key, label, default]),
 *     outputs: [{ key, title?, type?: 'line' | 'histogram' | 'area', color,
 *                 from?: 'field',                  // compute() field to draw; default: key
 *                 lineWidth?, lineStyle?: 'solid' | 'dashed' | 'dotted', lineType?: 'step',
 *                 scale?: 'left',                  // second price scale on the pane's left
 *                 priceFormat?, lastValue?: false, axisTitle?: true,
 *                 colorKey?: 'fieldWithPerBarColors', colorMap?: { name: colour },
 *                 signColors?: { up, down } }],    // histogram bar colours
 *     levels:  [{ value, color?, lineStyle? }],   // fixed horizontal lines (70 / 30 ...)
 *     stats:   [{ label, value: (result) => number, digits?, suffix?, color? }],
 *                                                 // summary numbers after the legend values
 *     leftScale?: { borderColor?, scaleMargins? },   // options for a `scale: 'left'` output
 *     minBars?: number,                            // draw nothing on fewer candles
 *     compute: (candles, params) => ({ [field]: number[] }),
 *     label?:  (params) => 'SMA 20',               // legend name; default "shortName p1, p2"
 *   }
 * compute() returns one array per drawn field: one value per candle, or fewer -
 * a shorter array is right-aligned, so its last value belongs to the latest
 * candle. null / NaN leave a gap. A bare array is the same as { value: array }.
 *
 * Older MultiIndicatorSystem definitions that have no entry here yet are
 * registered with `legacy: { system, def }` instead of outputs (defs/legacy.js).
 */
(function () {
  'use strict';
  const NS = (window.TFIndicators = window.TFIndicators || {});
  const defs = new Map();

  const CATEGORY_ORDER = ['Moving averages', 'Bands & channels', 'Pivots', 'Trend', 'Momentum', 'Oscillators', 'Volume', 'Volatility', 'Other'];

  function normalizeParam(p) {
    if (Array.isArray(p)) p = { key: p[0], label: p[1], default: p[2] };
    const isNumber = typeof p.default === 'number';
    return {
      key: p.key,
      label: p.label || p.key,
      default: p.default,
      min: p.min,
      max: p.max,
      step: p.step != null ? p.step : (isNumber && !Number.isInteger(p.default) ? 0.1 : 1),
      type: isNumber ? 'number' : 'text',
    };
  }

  function register(def) {
    if (!def || !def.id) throw new Error('TFIndicators: an indicator needs an id');
    if (defs.has(def.id)) {
      console.warn(`TFIndicators: duplicate indicator id "${def.id}" skipped`);
      return;
    }
    defs.set(def.id, {
      category: 'Other',
      placement: 'pane',
      outputs: [],
      levels: [],
      ...def,
      params: (def.params || []).map(normalizeParam),
    });
  }

  function defaultParams(def) {
    return Object.fromEntries(def.params.map(p => [p.key, p.default]));
  }

  function label(def, params) {
    if (typeof def.label === 'function') return def.label(params || {});
    const name = def.shortName || def.name;
    const values = def.params
      .filter(p => p.type === 'number')
      .map(p => (params && params[p.key] != null ? params[p.key] : p.default))
      .filter(v => v != null && v !== '');
    return values.length ? `${name} ${values.join(', ')}` : name;
  }

  const num = (v) => (v != null && Number.isFinite(v) ? v : null);

  // One entry per candle: a shorter array is right-aligned (its last value is
  // the latest candle's), a longer one keeps its tail.
  function fit(values, n, map = num) {
    if (!Array.isArray(values)) return null;
    const out = new Array(n).fill(null);
    const m = Math.min(values.length, n);
    const offset = values.length - m;
    for (let i = 0; i < m; i++) out[n - m + i] = map(values[offset + i]);
    return out;
  }

  // Runs an entry's compute() and lines each output up with the candles.
  function evaluate(def, candles, params) {
    let raw = def.compute(candles, params);
    if (Array.isArray(raw)) raw = { value: raw };
    raw = raw || {};
    const n = candles.length;
    const series = {};
    const colors = {};
    def.outputs.forEach(o => {
      series[o.key] = fit(raw[o.from || o.key], n);
      if (o.colorKey) colors[o.key] = fit(raw[o.colorKey], n, (v) => v || null);
    });
    return { series, colors, raw };
  }

  // Chart points for one output. A gap is { time } (lightweight-charts v5 only
  // treats a point as blank when `value` is undefined); a histogram bar takes
  // its colour from colorKey / colorMap, falling back to signColors.
  function toPoints(out, values, colors, candles) {
    if (!Array.isArray(values)) return [];
    return candles.map((c, i) => {
      const v = values[i];
      if (v == null) return { time: c.time };
      const p = { time: c.time, value: v };
      if (out.type === 'histogram') {
        let color = colors ? (out.colorMap ? out.colorMap[colors[i]] : colors[i]) : null;
        if (!color && out.signColors) color = v >= 0 ? out.signColors.up : out.signColors.down;
        if (color) p.color = color;
      }
      return p;
    });
  }

  let mathInstance = null;

  // Shared helpers for compute() functions.
  const util = {
    num,
    fit,
    column: (candles, key) => candles.map(c => c[key]),
    // src[i + shift] belongs to bar i. Most of Prof. Wang's functions are
    // 1-based (shift 1); the ones that are 0-based are noted where used.
    aligned: (candles, src, shift = 0) => candles.map((_, i) => num(src ? src[i + shift] : null)),
    // Calls a window-level math function by name; null when it's missing or throws.
    call(fnName, ...args) {
      const fn = typeof fnName === 'function' ? fnName : window[fnName];
      if (typeof fn !== 'function') return null;
      try { return fn(...args); } catch (e) { return null; }
    },
    // The MultiIndicatorSystem instance whose compute methods hold the math of
    // the classic pane indicators (crypto-trading uses the same methods through
    // its own panels, so the math lives in one place). Created on first use.
    math() {
      if (!mathInstance && typeof window.MultiIndicatorSystem === 'function') mathInstance = new window.MultiIndicatorSystem();
      return mathInstance;
    },
  };

  // Last finite value of an array (for stats such as "last trade").
  util.lastFinite = (arr) => {
    if (!Array.isArray(arr)) return null;
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null && Number.isFinite(arr[i])) return arr[i];
    return null;
  };

  // Line colours of the pane indicators - the MultiIndicatorSystem palette, so
  // the converted indicators look the way they did.
  NS.palette = {
    UP: '#ef4444',     // red = up, green = down (Chinese convention)
    DOWN: '#22c55e',
    LINE1: '#00bcd4',
    LINE2: '#ffeb3b',
    LINE3: '#ff9800',
    LINE4: '#3b11d2ff',
    LINE5: '#380532ff',
    LINE6: '#029c0f',
    VOLUME: '#6b7280',
  };

  // Shorthands for `outputs` entries.
  NS.outputs = {
    line: (key, color, title, extra) => ({ key, color, ...(title ? { title } : {}), ...(extra || {}) }),
    hist: (key, extra) => ({ key, type: 'histogram', ...(extra || {}) }),
  };

  NS.registry = {
    register,
    get: (id) => defs.get(id),
    has: (id) => defs.has(id),
    all: () => [...defs.values()],
    defaultParams,
    label,
    evaluate,
    toPoints,
    CATEGORY_ORDER,
  };
  NS.util = util;
})();
