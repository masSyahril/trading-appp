#!/usr/bin/env node
/*
 * Prof. Wang vs textbook indicators, same data, same rules, real costs.
 *
 *   node backtest/run.js [data dir or csv] [options]
 *
 *   --indicator TRIX|PSY|all   which comparison(s) to run (default all)
 *   --from 2015-01-01          ignore bars before this date
 *   --to 2025-12-31            ignore bars after this date
 *   --min-bars 500             skip stocks with less history than this
 *   --commission 0.001425      per side (default: Taiwan list price)
 *   --tax 0.003                on sells (0.001 for ETFs)
 *   --slippage 0.0005          per side
 *   --out report.csv           also write one row per stock x variant
 *
 * Default data location: backtest/data/ (git-ignored). See backtest/README.md.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_COSTS, runBacktest, buyAndHold, metrics } = require('./engine');
const { loadData } = require('./data');
const { loadWang } = require('./wang-lib');
const std = require('./standard');
const COMPARISONS = require('./comparisons');

function parseArgs(argv) {
  const opts = {
    data: path.join(__dirname, 'data'),
    indicator: 'all',
    minBars: 500,
    costs: { ...DEFAULT_COSTS },
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--indicator') opts.indicator = next();
    else if (a === '--from') opts.from = next();
    else if (a === '--to') opts.to = next();
    else if (a === '--min-bars') opts.minBars = Number(next());
    else if (a === '--commission') opts.costs.commission = Number(next());
    else if (a === '--tax') opts.costs.sellTax = Number(next());
    else if (a === '--slippage') opts.costs.slippage = Number(next());
    else if (a === '--out') opts.out = next();
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (!a.startsWith('--')) opts.data = a;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

const median = xs => {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const pct = (x, d = 1) => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '-');
const fix = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');

function table(rows) {
  const widths = rows[0].map((_, c) => Math.max(...rows.map(r => String(r[c]).length)));
  return rows
    .map((r, i) => {
      const line = r.map((v, c) => (c === 0 ? String(v).padEnd(widths[c]) : String(v).padStart(widths[c]))).join('  ');
      return i === 0 ? line + '\n' + widths.map(w => '-'.repeat(w)).join('  ') : line;
    })
    .join('\n');
}

/** Backtest a signal over [lo, hi) of the full series (signals computed on the full series, so no warm-up gap). */
function runRange(candles, signal, lo, hi, costs) {
  const c = candles.slice(lo, hi);
  const s = signal.slice(lo, hi);
  return metrics(c, runBacktest(c, s, costs));
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return;
  }
  if (!fs.existsSync(opts.data)) {
    console.error(`No data at ${opts.data}. Put one CSV per stock there (see backtest/README.md).`);
    process.exit(1);
  }

  const { data, warnings } = loadData(opts.data);
  warnings.forEach(w => console.warn('warning: ' + w));

  const stocks = [];
  for (const [sym, all] of data) {
    const candles = all.filter(c => (!opts.from || c.time >= opts.from) && (!opts.to || c.time <= opts.to));
    if (candles.length >= opts.minBars) stocks.push({ sym, candles });
    else console.warn(`warning: ${sym}: only ${candles.length} bars in range, skipped (--min-bars ${opts.minBars})`);
  }
  if (!stocks.length) {
    console.error('No stock has enough history to test.');
    process.exit(1);
  }

  const lib = { wang: loadWang(), std };
  const names = opts.indicator === 'all' ? Object.keys(COMPARISONS) : [opts.indicator];
  const csvRows = [['indicator', 'variant', 'symbol', 'from', 'to', 'total_return', 'cagr', 'max_drawdown', 'sharpe', 'trades', 'win_rate', 'avg_trade', 'exposure']];

  const first = stocks.map(s => s.candles[0].time).sort()[0];
  const last = stocks.map(s => s.candles[s.candles.length - 1].time).sort().pop();
  console.log(`\n${stocks.length} stock(s), ${first} to ${last}. Costs: commission ${pct(opts.costs.commission, 4)}/side, ` +
    `sell tax ${pct(opts.costs.sellTax, 2)}, slippage ${pct(opts.costs.slippage, 2)}/side. Long-only, next-open fills.`);

  // Buy & hold, for context.
  const bh = stocks.map(s => ({ sym: s.sym, m: metrics(s.candles, buyAndHold(s.candles, opts.costs)) }));
  console.log(`Buy & hold: median CAGR ${pct(median(bh.map(b => b.m.cagr)))}, median max drawdown ${pct(median(bh.map(b => b.m.maxDrawdown)))}`);

  for (const name of names) {
    const cmp = COMPARISONS[name];
    if (!cmp) throw new Error(`unknown indicator ${name}; choose from ${Object.keys(COMPARISONS).join(', ')}`);

    const results = {}; // variant -> [{sym, full, h1, h2}]
    for (const [variant, fn] of Object.entries(cmp.variants)) {
      results[variant] = stocks.map(({ sym, candles }) => {
        const signal = fn(candles, lib);
        const mid = Math.floor(candles.length / 2);
        const full = runRange(candles, signal, 0, candles.length, opts.costs);
        csvRows.push([name, variant, sym, candles[0].time, candles[candles.length - 1].time,
          full.totalReturn, full.cagr, full.maxDrawdown, full.sharpe, full.trades, full.winRate, full.avgTrade, full.exposure]);
        return {
          sym,
          full,
          h1: runRange(candles, signal, 0, mid, opts.costs),
          h2: runRange(candles, signal, mid, candles.length, opts.costs),
        };
      });
    }

    console.log(`\n=== ${name}: ${cmp.description}`);
    const rows = [['variant', 'med CAGR', '1st half', '2nd half', 'med maxDD', 'med Sharpe', 'trades', 'win rate', 'beats B&H', `beats baseline`]];
    const base = results[cmp.baseline];
    for (const [variant, rs] of Object.entries(results)) {
      const beatsBH = rs.filter((r, i) => r.full.cagr > bh[i].m.cagr).length;
      const beatsBase = variant === cmp.baseline ? '(baseline)'
        : `${rs.filter((r, i) => r.full.cagr > base[i].full.cagr).length}/${rs.length}`;
      rows.push([
        variant,
        pct(median(rs.map(r => r.full.cagr))),
        pct(median(rs.map(r => r.h1.cagr))),
        pct(median(rs.map(r => r.h2.cagr))),
        pct(median(rs.map(r => r.full.maxDrawdown))),
        fix(median(rs.map(r => r.full.sharpe))),
        // Under ~30 trades in total, win rate and CAGR are mostly noise.
        rs.reduce((a, r) => a + r.full.trades, 0) + (rs.reduce((a, r) => a + r.full.trades, 0) < 30 ? ' (!)' : ''),
        pct(median(rs.map(r => r.full.winRate))),
        `${beatsBH}/${rs.length}`,
        beatsBase,
      ]);
    }
    console.log(table(rows));
  }

  console.log('\nRead this before trusting it:');
  console.log('- "beats baseline" counts stocks where the variant\'s CAGR beat the textbook version\'s. Near half means no real difference.');
  console.log('- (!) after the trade count: fewer than 30 trades in total, too few to tell skill from luck.');
  console.log('- A variant that wins in only one half of the period probably got lucky with the market regime.');
  console.log('- The trading rules are generic assumptions, not Prof. Wang\'s own. Nothing here was tuned, so nothing here is overfit - but it is also not his method.');
  console.log('- Stocks that were delisted are missing from most data sets, which flatters every variant (survivorship bias).');

  if (opts.out) {
    fs.writeFileSync(opts.out, csvRows.map(r => r.join(',')).join('\n') + '\n');
    console.log(`\nPer-stock results written to ${opts.out}`);
  }
}

main();
