/*
 * Regression harness for the Prof. Wang indicator library.
 *
 * Every bug fixed in this codebase so far has had the same signature: an
 * indicator panel renders blank, or goes blank only at the most recent bar,
 * even though the underlying compute function received perfectly good OHLCV
 * data. This script drives every indicator definition in MultiIndicatorSystem
 * with synthetic-but-realistic candle data and asserts the output isn't
 * degenerate, so that class of bug gets caught here instead of by eyeballing
 * a chart.
 *
 * Run with: node test/run-indicator-tests.js  (or `npm test`)
 */

const path = require('path');

// All of these are plain browser scripts (`window.X = X` at top level, no
// module.exports) - give them a `window` that's just the Node global object
// so those assignments become normal globals we can call. Loaded in the same
// order stock-market/index.html's ScriptLoader.loadTradingScripts() list
// uses, since later files intentionally override earlier same-named globals
// (e.g. the "-prods" bundle is meant to win over technical-indicators-wang.js)
// and some files (MAoneMAtwo, PVI, Bollinger4SD, ...) only exist as these
// separate small Wang_design_* files, not inside the two big bundles.
global.window = global;
global.document = { addEventListener() {} };

const core = (...p) => path.join(__dirname, '..', 'src', 'js', 'core', ...p);
const utils = (...p) => path.join(__dirname, '..', 'src', 'js', 'utils', ...p);

const scriptOrder = [
  core('utils.js'),
  utils('indicators.js'),
  core('technical-indicators.js'),
  core('Wang_design__HullMA _2026-01-18.js'),
  core('Wang_design_DEMA_2026-03-14.js'),
  core('technical-indicators-wang.js'),
  core('multi-indicator-system.js'),
  core('Wang_design_new_indicators__RandomWalkIndex _2026-01-20.js'),
  core('Wang_design__MAoneMAtwor_2026-04-06.js'),
  core('Wang_design_new_indicators__Alligator_2026-01-29.js'),
  core('Wang_design_new_indicators__PVI_percentRiseFall_2026-03-10.js'),
  core('Wang_design_new_indicators__Bollinger4SD_2026-02-28_.js'),
  core('Wang_design_new_indicators__VolumeRSI_2026-03-08.js'),
  core('technical-indicators.prods__Wang__2026.js'),
];

for (const file of scriptOrder) {
  require(file);
}

// ---------------------------------------------------------------------------
// Synthetic OHLCV data: a 400-bar trending random walk. Long enough to clear
// every indicator's minPeriod with room to spare, and varied enough (real
// up/down days, real volume swings) that guards like "high === low" or
// "volume === 0" don't mask genuine bugs by accident.
// ---------------------------------------------------------------------------
function generateCandles(n = 400) {
  const candles = [];
  let price = 100;
  const startTime = Math.floor(Date.UTC(2023, 0, 1) / 1000);
  const dayInSeconds = 86400;
  let seed = 42;
  const rand = () => {
    // Deterministic PRNG (mulberry32) so failures are reproducible.
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < n; i++) {
    const drift = Math.sin(i / 37) * 0.6; // slow trend so MAs actually move
    const change = (rand() - 0.48) * 3 + drift;
    const open = price;
    price = Math.max(1, price + change);
    const close = price;
    const wick = Math.abs(change) + rand() * 1.5 + 0.1;
    const high = Math.max(open, close) + rand() * wick;
    const low = Math.min(open, close) - rand() * wick;
    const volume = Math.floor(500000 + rand() * 4500000);

    candles.push({
      time: startTime + i * dayInSeconds,
      open: Number(open.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      close: Number(close.toFixed(4)),
      volume,
    });
  }
  return candles;
}

// ---------------------------------------------------------------------------
// Walk a compute() result and collect every numeric array it contains,
// ignoring scalar summary fields (Acc_RR, BS_times, etc.) that legitimately
// have no per-bar series.
// ---------------------------------------------------------------------------
function collectSeries(result) {
  const series = {};
  if (!result || typeof result !== 'object') return series;
  // A few compute() implementations (e.g. computeWangWilliamsR) return the
  // values array directly instead of wrapping it in a { field: [...] } object.
  if (Array.isArray(result)) {
    series._root = result;
    return series;
  }
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) series[key] = value;
  }
  return series;
}

function analyze(series, tailWindow = 5) {
  let totalPoints = 0;
  let finitePoints = 0;
  let tailHasData = false;
  let longestSeriesLen = 0;

  for (const arr of Object.values(series)) {
    longestSeriesLen = Math.max(longestSeriesLen, arr.length);
    totalPoints += arr.length;
    for (const v of arr) {
      if (v != null && typeof v === 'object' && 'value' in v) {
        // histogram-style {time, value, color} entries
        if (v.value != null && Number.isFinite(v.value)) finitePoints++;
      } else if (Number.isFinite(v)) {
        finitePoints++;
      }
    }
    const tail = arr.slice(-tailWindow);
    if (tail.some((v) => {
      const val = (v != null && typeof v === 'object' && 'value' in v) ? v.value : v;
      return val != null && Number.isFinite(val);
    })) {
      tailHasData = true;
    }
  }

  return { totalPoints, finitePoints, tailHasData, longestSeriesLen, seriesCount: Object.keys(series).length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const candles = generateCandles(400);
  const sys = new global.MultiIndicatorSystem();
  sys.chartData = candles;

  const defs = sys.indicatorDefinitions;
  const results = [];

  for (const [key, def] of Object.entries(defs)) {
    if (typeof def.compute !== 'function') continue;

    const minPeriod = def.minPeriod || 30;
    const params = def.defaultParams || {};

    let outcome;
    try {
      const raw = def.compute(candles, params);
      const series = collectSeries(raw);
      const { totalPoints, finitePoints, tailHasData, seriesCount, longestSeriesLen } = analyze(series);

      if (seriesCount === 0) {
        outcome = { status: 'SKIP', reason: 'compute() returned no array fields to check' };
      } else if (finitePoints === 0) {
        outcome = { status: 'FAIL', reason: `all ${totalPoints} points across ${seriesCount} series are null/NaN - indicator would render completely blank` };
      } else if (candles.length - minPeriod > tailWindowMargin(minPeriod) && !tailHasData) {
        outcome = { status: 'FAIL', reason: `last 5 bars are null/NaN across all ${seriesCount} series despite ${candles.length} bars of input (minPeriod=${minPeriod}) - indicator would render blank at the most recent candle` };
      } else {
        outcome = { status: 'PASS', reason: `${finitePoints}/${totalPoints} finite points across ${seriesCount} series (longest ${longestSeriesLen})` };
      }
    } catch (err) {
      outcome = { status: 'FAIL', reason: `compute() threw: ${err.message}` };
    }

    results.push({ key, name: def.name || key, ...outcome });
  }

  const fails = results.filter((r) => r.status === 'FAIL');
  const skips = results.filter((r) => r.status === 'SKIP');
  const passes = results.filter((r) => r.status === 'PASS');

  for (const r of results) {
    if (r.status === 'PASS') continue;
    const icon = r.status === 'FAIL' ? '✖' : '–';
    console.log(`${icon} [${r.status}] ${r.key} (${r.name}): ${r.reason}`);
  }

  console.log('');
  console.log(`${passes.length} passed, ${fails.length} failed, ${skips.length} skipped, ${results.length} total indicators checked.`);

  if (fails.length > 0) {
    process.exitCode = 1;
  }
}

// A tiny margin so short-minPeriod indicators (minPeriod=2) don't get an
// unreasonably strict "must have data in the literal last 5 bars" check when
// there's barely any lead-in room to begin with.
function tailWindowMargin(minPeriod) {
  return Math.max(10, minPeriod + 5);
}

main();
