/*
 * Minimal, deliberately boring backtest engine for comparing indicator
 * variants on the same data with the same rules.
 *
 * Rules (identical for every variant, so only the indicator math differs):
 *   - Long-only, all-in / all-out, no leverage, no pyramiding.
 *   - A signal is decided on the CLOSE of bar t and executed at the OPEN of
 *     bar t+1 (no look-ahead: the strategy never trades on a price it could
 *     not have known).
 *   - Costs are charged on every fill: broker commission both sides,
 *     securities transaction tax on sells, and a slippage allowance both sides.
 *   - Equity is marked to the close every bar.
 *
 * Defaults are Taiwan cash-equity costs at full list price: 0.1425%
 * commission each side and 0.3% transaction tax on the sell (ETFs pay 0.1% -
 * pass --tax 0.001). Real brokers discount the commission; full price is the
 * conservative choice.
 */

const DEFAULT_COSTS = {
  commission: 0.001425,
  sellTax: 0.003,
  slippage: 0.0005,
};

/**
 * @param {{time:string, open:number, high:number, low:number, close:number, volume:number}[]} candles
 * @param {(boolean|null)[]} wantLong  wantLong[t] = desired position after the close of bar t
 *                                     (null = indicator not ready yet, stay flat)
 */
function runBacktest(candles, wantLong, costs = DEFAULT_COSTS) {
  const n = candles.length;
  let cash = 1;
  let shares = 0;
  let entryCost = 0;
  const equity = new Array(n).fill(1);
  const trades = [];
  let barsInMarket = 0;

  for (let t = 1; t < n; t++) {
    const desired = wantLong[t - 1] === true;
    const open = candles[t].open;

    if (desired && shares === 0) {
      const fillPrice = open * (1 + costs.slippage);
      const spend = cash;
      shares = spend / (fillPrice * (1 + costs.commission));
      entryCost = spend;
      cash = 0;
      trades.push({ entryTime: candles[t].time, entryPrice: fillPrice });
    } else if (!desired && shares > 0) {
      cash = sellProceeds(shares, open, costs);
      shares = 0;
      closeTrade(trades, candles[t].time, open * (1 - costs.slippage), cash, entryCost);
    }

    if (shares > 0) barsInMarket++;
    equity[t] = cash + shares * candles[t].close;
  }

  // Close any open trade at the final close so its P&L (net of exit costs) is counted.
  if (shares > 0) {
    const last = candles[n - 1];
    cash = sellProceeds(shares, last.close, costs);
    shares = 0;
    closeTrade(trades, last.time, last.close * (1 - costs.slippage), cash, entryCost);
    equity[n - 1] = cash;
  }

  return { equity, trades, exposure: n > 1 ? barsInMarket / (n - 1) : 0 };
}

function sellProceeds(shares, price, costs) {
  const gross = shares * price * (1 - costs.slippage);
  return gross * (1 - costs.commission - costs.sellTax);
}

function closeTrade(trades, time, exitPrice, proceeds, entryCost) {
  const tr = trades[trades.length - 1];
  tr.exitTime = time;
  tr.exitPrice = exitPrice;
  tr.returnPct = proceeds / entryCost - 1;
}

function metrics(candles, result) {
  const { equity, trades, exposure } = result;
  const n = equity.length;
  const totalReturn = equity[n - 1] / equity[0] - 1;
  const years = yearsBetween(candles[0].time, candles[n - 1].time);
  const cagr = years > 0 && equity[n - 1] > 0 ? Math.pow(equity[n - 1], 1 / years) - 1 : NaN;

  let peak = equity[0];
  let maxDrawdown = 0;
  const daily = [];
  for (let i = 1; i < n; i++) {
    peak = Math.max(peak, equity[i]);
    maxDrawdown = Math.min(maxDrawdown, equity[i] / peak - 1);
    daily.push(equity[i] / equity[i - 1] - 1);
  }
  const mean = daily.reduce((a, b) => a + b, 0) / (daily.length || 1);
  const sd = Math.sqrt(daily.reduce((a, b) => a + (b - mean) ** 2, 0) / (daily.length || 1));
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(252) : NaN;

  const closed = trades.filter(t => t.returnPct !== undefined);
  const wins = closed.filter(t => t.returnPct > 0).length;

  return {
    totalReturn,
    cagr,
    maxDrawdown,
    sharpe,
    trades: closed.length,
    winRate: closed.length ? wins / closed.length : NaN,
    avgTrade: closed.length ? closed.reduce((a, t) => a + t.returnPct, 0) / closed.length : NaN,
    exposure,
  };
}

function yearsBetween(a, b) {
  return (Date.parse(b) - Date.parse(a)) / (365.25 * 86400000);
}

/** Buy at the first open, sell at the last close, same costs. */
function buyAndHold(candles, costs = DEFAULT_COSTS) {
  return runBacktest(candles, candles.map(() => true), costs);
}

// ---------------------------------------------------------------------------
// Signal helpers shared by the comparisons.
// ---------------------------------------------------------------------------

const ready = v => typeof v === 'number' && Number.isFinite(v);

/** Long while line > signal (i.e. enter on cross above, exit on cross below). */
function crossoverSignal(line, signal, n) {
  const out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ready(line[i]) && ready(signal[i])) out[i] = line[i] > signal[i];
  }
  return out;
}

/**
 * Mean-reversion band rule: go long when the value drops below `low`, stay
 * long until it rises above `high`.
 */
function bandSignal(values, low, high, n) {
  const out = new Array(n).fill(null);
  let long = false;
  for (let i = 0; i < n; i++) {
    if (!ready(values[i])) continue;
    if (!long && values[i] < low) long = true;
    else if (long && values[i] > high) long = false;
    out[i] = long;
  }
  return out;
}

module.exports = {
  DEFAULT_COSTS,
  runBacktest,
  buyAndHold,
  metrics,
  crossoverSignal,
  bandSignal,
};
