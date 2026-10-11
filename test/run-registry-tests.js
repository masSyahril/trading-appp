#!/usr/bin/env node
/*
 * Indicator registry tests (indicator system v2), no browser needed.
 *
 * Loads the same indicator scripts the pages load, then checks every registry
 * entry on 400 synthetic candles:
 *   - declarative entries: every output comes back from compute(), lined up
 *     with the candles, and the entry has values at the latest bars. A line
 *     with no values at all is listed as a warning (it fails only when every
 *     line of the entry is blank);
 *   - an entry that replaced a MultiIndicatorSystem definition of the same id
 *     (still there for the crypto-trading page) must draw exactly what the old
 *     render() drew: the same default inputs, and every old line with the same
 *     values on the same candles and the same bar colours - or, for an old
 *     reference line, a level at that value;
 *   - legacy entries (no declarative entry yet): compute() plus render()
 *     through a stand-in pane chart must give some series a finite value.
 *
 * Usage: node test/run-registry-tests.js
 */
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = { addEventListener() {}, createElement() { return {}; } };

const ROOT = path.join(__dirname, '..');
const core = (f) => path.join(ROOT, 'src', 'js', 'core', f);
const tfi = (...f) => path.join(ROOT, 'src', 'js', 'indicators', ...f);
const SCRIPTS = [
  core('utils.js'),
  path.join(ROOT, 'src', 'js', 'utils', 'indicators.js'),
  core('technical-indicators.js'),
  core('Wang_design__HullMA _2026-01-18.js'),
  core('technical-indicators-wang.js'),
  core('multi-indicator-system.js'),
  core('technical-indicators.prods__Wang__2026.js'),
  tfi('registry.js'),
  tfi('defs', 'overlays.js'),
  tfi('defs', 'wang.js'),
  tfi('defs', 'trend.js'),
  tfi('defs', 'momentum.js'),
  tfi('defs', 'oscillators.js'),
  tfi('defs', 'volume.js'),
  tfi('defs', 'volatility.js'),
  tfi('defs', 'legacy.js'),
];

// The indicator code logs a lot; keep the report readable.
const log = console.log;
console.log = () => {};
console.warn = () => {};
SCRIPTS.forEach(f => require(f));

// Deterministic candles (same generator idea as run-indicator-tests.js).
function makeCandles(n) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let price = 100;
  const out = [];
  for (let i = 0; i < n; i++) {
    const open = price;
    price = Math.max(5, price + Math.sin(i / 9) * 0.8 + (rand() - 0.5) * 2);
    out.push({
      time: 1700000000 + i * 86400,
      open,
      high: Math.max(open, price) + rand(),
      low: Math.min(open, price) - rand(),
      close: price,
      volume: Math.round(1e6 + rand() * 5e5),
    });
  }
  return out;
}

// Stand-in for the pane chart manager.js hands a legacy render().
function fakePaneChart(record) {
  const series = () => {
    const s = {
      data: null,
      setData(d) { this.data = d; },
      update() {},
      applyOptions() {},
      createPriceLine() { return {}; },
      priceScale() { return { applyOptions() {} }; },
    };
    record.push(s);
    return s;
  };
  return {
    addLineSeries: series, addHistogramSeries: series, addAreaSeries: series,
    addBaselineSeries: series, addCandlestickSeries: series, addBarSeries: series,
    removeSeries() {}, timeScale: () => ({}), priceScale: () => ({ applyOptions() {} }), applyOptions() {},
  };
}

const NS = window.TFIndicators;
const candles = makeCandles(400);
const n = candles.length;
const barAt = new Map(candles.map((c, i) => [c.time, i]));
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// What a MultiIndicatorSystem render() draws: per series, its value and bar colour at each candle.
function oldDrawing(ldef, params) {
  const system = NS.legacySystem;
  system.chartData = candles;
  const data = ldef.compute(candles, { ...params });
  const recorded = [];
  const seriesMap = new Map();
  ldef.render(fakePaneChart(recorded), data, system.colors, seriesMap);
  const keyOf = new Map([...seriesMap].map(([key, s]) => [s, String(key)]));
  return recorded.map(s => {
    const values = new Array(n).fill(null);
    const colors = new Array(n).fill(null);
    (s.data || []).forEach(p => {
      if (!p || !barAt.has(p.time) || !Number.isFinite(p.value)) return;
      values[barAt.get(p.time)] = p.value;
      colors[barAt.get(p.time)] = p.color || null;
    });
    return { key: keyOf.get(s), values, colors };
  });
}

// Where a declarative entry draws differently from the old definition it replaced.
function differences(def, ldef, params) {
  const out = [];
  if (JSON.stringify(ldef.defaultParams || {}) !== JSON.stringify(params)) {
    out.push(`default inputs ${JSON.stringify(params)} vs old ${JSON.stringify(ldef.defaultParams || {})}`);
  }
  const ev = NS.registry.evaluate(def, candles, params);
  const levels = new Set(def.levels.map(l => l.value));
  oldDrawing(ldef, params).forEach(old => {
    const drawn = old.values.filter(v => v != null);
    if (!drawn.length) return; // the old line never drew anything
    const o = def.outputs.find(x => x.key === old.key);
    if (!o) {
      if (!(drawn.every(v => v === drawn[0]) && levels.has(drawn[0]))) out.push(`old line "${old.key}" is not drawn`);
      return;
    }
    const points = NS.registry.toPoints(o, ev.series[o.key], ev.colors[o.key], candles);
    const bar = old.values.findIndex((v, i) => {
      const p = points[i] || {};
      const nv = p.value != null ? p.value : null;
      if ((v == null) !== (nv == null) || (v != null && !near(v, nv))) return true;
      return old.colors[i] != null && p.color !== old.colors[i];
    });
    if (bar >= 0) {
      const p = points[bar] || {};
      out.push(`"${old.key}" differs at bar ${bar}: old ${old.values[bar]}${old.colors[bar] ? ' ' + old.colors[bar] : ''}, new ${p.value}${p.color ? ' ' + p.color : ''}`);
    }
  });
  return out;
}

// Checks for indicators drawn on the K-line (price chart) rather than in a pane.
const closes = candles.map(c => c.close);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const closeMedian = median(closes);
function priceChartProblems(def, ev) {
  const out = [];
  // Something must be drawn on the latest candle - the bar a trader looks at.
  if (!def.outputs.some(o => ev.series[o.key] && ev.series[o.key][n - 1] != null)) out.push('nothing drawn on the last candle');
  // Lines share the candles' price axis, so they must be at price level: a 0-100
  // stochastic or a ratio near 1.0 placed here would sit flat at the bottom.
  def.outputs.forEach(o => {
    if (o.type === 'histogram') return;
    const v = (ev.series[o.key] || []).filter(x => x != null && Number.isFinite(x));
    if (!v.length) return;
    const m = median(v);
    if (!(m > closeMedian * 0.5 && m < closeMedian * 2)) out.push(`${o.key}: median ${m.toFixed(3)} is off the price scale (close median ${closeMedian.toFixed(2)})`);
  });
  return out;
}

const results = [];
const warnings = [];
let compared = 0;

NS.registry.all().forEach(def => {
  const params = NS.registry.defaultParams(def);
  try {
    if (def.legacy) {
      const { system, def: ldef } = def.legacy;
      system.chartData = candles;
      const data = ldef.compute(candles, { ...params });
      const recorded = [];
      ldef.render(fakePaneChart(recorded), data, system.colors, new Map());
      if (!recorded.length) { results.push({ id: def.id, ok: false, why: 'render created no series' }); return; }
      const drawn = recorded.some(s => Array.isArray(s.data)
        && s.data.some(p => p && Number.isFinite(p.value != null ? p.value : p.close)));
      results.push({ id: def.id, ok: drawn, why: drawn ? '' : 'render gave no series a finite value' });
      return;
    }
    const problems = [];
    const blank = [];
    const ev = NS.registry.evaluate(def, candles, params);
    def.outputs.forEach(o => {
      const v = ev.series[o.key];
      if (!v) problems.push(`${o.key}: not in compute()'s result`);
      else if (!v.some(x => x != null)) blank.push(o.key);
    });
    if (blank.length === def.outputs.length) problems.push('every line is blank');
    else if (blank.length) warnings.push({ id: def.id, why: `no values for ${blank.join(', ')} (compute() returns the field, all blank)` });
    if (!def.outputs.some(o => ev.series[o.key] && ev.series[o.key].slice(-5).some(x => x != null))) problems.push('blank at the latest bars');
    // registry.fit() lines arrays up from the END, so an array with extra slots past the
    // last candle (a Wang loop running to i<=length) shifts the whole line a bar left.
    def.outputs.forEach(o => {
      const src = ev.raw[o.from || o.key];
      if (Array.isArray(src) && src.length > n) problems.push(`${o.key}: compute() returned ${src.length} values for ${n} candles (line drawn ${src.length - n} bar(s) early)`);
    });
    if (def.placement === 'chart') problems.push(...priceChartProblems(def, ev));
    const old = def.placement === 'pane' && NS.legacySystem && NS.legacySystem.indicatorDefinitions[def.id];
    if (old) {
      compared++;
      problems.push(...differences(def, old, params));
    }
    results.push({ id: def.id, chart: def.placement === 'chart', ok: !problems.length, why: problems.join('; ') });
  } catch (e) {
    results.push({ id: def.id, chart: def.placement === 'chart', ok: false, why: 'threw: ' + e.message });
  }
});

// Single source: every indicator's numbers must come from Prof. Wang's file
// (technical-indicators.prods__Wang__2026.js). Each function it defines is wrapped,
// every indicator is computed once more, and one that calls none of them fails -
// unless it is listed here with the reason it has no Wang version yet.
const NOT_WANG = {
  VOLUME: 'raw volume bars - there is no formula',
  MA: 'no Wang version yet (SMA/EMA/WMA menu)',
  BBI: 'no Wang version yet (classic 4-MA BBI; Wang has BBI3/4/5)',
  BULLBEAR: 'no Wang version yet',
  VWAP: 'cumulative VWAP; Wang\'s VolWgtAvgPrice is a rolling N-day VWAP - not decided',
  MFI: 'kept as the standard MFI; Wang\'s is the MoneyFlowIndex entry',
};
const wangSource = fs.readFileSync(core('technical-indicators.prods__Wang__2026.js'), 'utf8');
const wangNames = [...new Set([...wangSource.matchAll(/^function (\w+)\(/gm)].map(m => m[1]))];
let calledWang = false;
wangNames.forEach(name => {
  const fn = window[name];
  if (typeof fn !== 'function') return;
  window[name] = function (...args) { calledWang = true; return fn.apply(this, args); };
});
const notWang = [];
NS.registry.all().forEach(def => {
  calledWang = false;
  try {
    if (def.legacy) def.legacy.def.compute(candles, { ...NS.registry.defaultParams(def) });
    else def.compute(candles, NS.registry.defaultParams(def));
  } catch (e) { /* reported by the checks above */ }
  if (!calledWang && !NOT_WANG[def.id]) notWang.push(def.id);
});
notWang.forEach(id => results.push({ id, ok: false, why: 'does not use Prof. Wang\'s file (technical-indicators.prods__Wang__2026.js) - wire it there, or list it in NOT_WANG with the reason' }));

console.log = log;
const failed = results.filter(r => !r.ok);
warnings.forEach(w => console.log(`! [WARN] ${w.id}: ${w.why}`));
failed.forEach(r => console.log(`✗ [FAIL] ${r.id}: ${r.why}`));
const all = NS.registry.all();
console.log(`\nRegistry: ${all.length} indicators (${all.filter(d => d.placement === 'chart').length} price-chart, ${all.filter(d => d.placement === 'pane').length} pane; ${all.filter(d => d.legacy).length} still legacy).`);
console.log(`${compared} converted indicators compared with their old drawing, point by point.`);
const chartResults = results.filter(r => r.chart);
const chartFailed = chartResults.filter(r => !r.ok);
console.log(`K-line (price chart): ${chartResults.length - chartFailed.length} passed, ${chartFailed.length} failed${chartFailed.length ? ' - ' + chartFailed.map(r => r.id).join(', ') : ''} (checked: drawn on the last candle, lines on the price scale).`);
console.log(`Single source: ${all.length - notWang.length - Object.keys(NOT_WANG).length} use Prof. Wang's file, ${notWang.length} do not${notWang.length ? ' - ' + notWang.join(', ') : ''}; ${Object.keys(NOT_WANG).length} listed exceptions (${Object.keys(NOT_WANG).join(', ')}).`);
console.log(`${results.length - failed.length} passed, ${failed.length} failed, ${warnings.length} with blank lines.`);
process.exit(failed.length ? 1 : 0);
