/*
 * Checks the backtest engine does exactly what backtest/engine.js promises:
 * next-open fills, Taiwan costs on each side, sell tax only on the exit, and
 * no position before an indicator is ready. Numbers are worked out by hand.
 *
 * Run with: node test/run-backtest-tests.js  (or `npm test`)
 */

const assert = require('assert');
const { runBacktest, metrics, bandSignal, crossoverSignal } = require('../backtest/engine');
const { parseCsv, parseDate } = require('../backtest/data');
const std = require('../backtest/standard');

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('ok - ' + name);
}
const close = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const bar = (time, open, closeP) => ({ time, open, high: Math.max(open, closeP), low: Math.min(open, closeP), close: closeP, volume: 1 });
const candles = [
  bar('2024-01-01', 100, 100),
  bar('2024-01-02', 110, 120), // signal from bar 0 fills here at 110
  bar('2024-01-03', 130, 125),
  bar('2024-01-04', 150, 150), // signal from bar 2 exits here at 150
];
const costs = { commission: 0.001425, sellTax: 0.003, slippage: 0 };

check('enters at the next open and exits at the next open, net of costs', () => {
  const r = runBacktest(candles, [true, true, false, false], costs);
  const shares = 1 / (110 * (1 + costs.commission));
  const proceeds = shares * 150 * (1 - costs.commission - costs.sellTax);
  assert.strictEqual(r.trades.length, 1);
  assert.strictEqual(r.trades[0].entryTime, '2024-01-02');
  assert.strictEqual(r.trades[0].exitTime, '2024-01-04');
  close(r.trades[0].returnPct, proceeds - 1);
  close(r.equity[1], shares * 120);
  close(r.equity[3], proceeds);
});

check('a still-open trade is closed at the last close with exit costs', () => {
  const r = runBacktest(candles, [true, true, true, true], costs);
  const shares = 1 / (110 * (1 + costs.commission));
  close(r.equity[3], shares * 150 * (1 - costs.commission - costs.sellTax));
  assert.strictEqual(metrics(candles, r).trades, 1);
});

check('null (indicator not ready) means flat', () => {
  const r = runBacktest(candles, [null, null, null, null], costs);
  assert.strictEqual(r.trades.length, 0);
  assert.ok(r.equity.every(e => e === 1));
});

check('slippage worsens both fills', () => {
  const withSlip = runBacktest(candles, [true, true, false, false], { ...costs, slippage: 0.01 });
  const noSlip = runBacktest(candles, [true, true, false, false], costs);
  assert.ok(withSlip.trades[0].returnPct < noSlip.trades[0].returnPct);
});

check('band rule holds the position between the bands', () => {
  assert.deepStrictEqual(bandSignal([undefined, 50, 20, 50, 80, 50], 25, 75, 6), [null, false, true, true, false, false]);
});

check('crossover rule waits for both lines', () => {
  assert.deepStrictEqual(crossoverSignal([1, 2, 3], [undefined, 1, 4], 3), [null, true, false]);
});

check('standard EMA seeds from the simple average', () => {
  const e = std.ema([1, 2, 3, 4], 3);
  assert.strictEqual(e[1], undefined);
  close(e[2], 2);
  close(e[3], 4 * 0.5 + 2 * 0.5);
});

check('standard PSY counts up-closes over n bars', () => {
  const p = std.psy([10, 11, 10, 12, 13], 4);
  close(p[4], 75);
});

check('TWSE CSV: Chinese headers, ROC dates, thousands commas, suspended rows', () => {
  const csv = '﻿日期,成交股數,開盤價,最高價,最低價,收盤價\n' +
    '113/01/03,"1,234",590,593,580,586\n' +
    '113/01/02,"2,000",593,593,589,593\n' +
    '113/01/04,0,--,--,--,--\n';
  const { bySymbol, skipped } = parseCsv(csv, '2330');
  const c = bySymbol.get('2330');
  assert.strictEqual(skipped, 1);
  assert.deepStrictEqual(c.map(x => x.time), ['2024-01-02', '2024-01-03']);
  assert.strictEqual(c[1].volume, 1234);
});

check('English CSV with a symbol column splits per stock', () => {
  const csv = 'Date,Symbol,Open,High,Low,Close,Volume\n2024-01-02,2330,1,2,1,2,10\n2024-01-02,2317,3,4,3,4,10\n';
  assert.deepStrictEqual([...parseCsv(csv, 'x').bySymbol.keys()], ['2330', '2317']);
});

check('date formats', () => {
  assert.strictEqual(parseDate('20240105'), '2024-01-05');
  assert.strictEqual(parseDate('114/9/1'), '2025-09-01');
});

console.log(`\n${passed} backtest checks passed.`);
