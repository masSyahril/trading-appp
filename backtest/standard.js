/*
 * Textbook versions of the indicators Prof. Wang modified, written the way
 * the common references compute them (TA-Lib seeding: an EMA starts from
 * the simple average of its first `period` values). These are the baseline
 * his versions are measured against. Arrays are 0-based; entries before an
 * indicator is ready are undefined.
 */

function ema(values, period, start = 0) {
  const out = [];
  const k = 2 / (period + 1);
  let i = start;
  // Skip leading gaps so an EMA of another indicator seeds from its first real values.
  while (i < values.length && !Number.isFinite(values[i])) i++;
  if (i + period > values.length) return out;
  let sum = 0;
  for (let j = i; j < i + period; j++) sum += values[j];
  let prev = sum / period;
  out[i + period - 1] = prev;
  for (let j = i + period; j < values.length; j++) {
    prev = values[j] * k + prev * (1 - k);
    out[j] = prev;
  }
  return out;
}

/** TRIX: 1-bar % change of a triple-smoothed EMA, plus an EMA signal line. */
function trix(close, period, signalPeriod) {
  const e3 = ema(ema(ema(close, period), period), period);
  const line = [];
  for (let i = 1; i < close.length; i++) {
    if (Number.isFinite(e3[i]) && Number.isFinite(e3[i - 1]) && e3[i - 1] !== 0) {
      line[i] = ((e3[i] - e3[i - 1]) / e3[i - 1]) * 100;
    }
  }
  return { line, signal: ema(line, signalPeriod) };
}

/** Psychological line: % of the last n bars that closed up. */
function psy(close, n) {
  const out = [];
  for (let i = n; i < close.length; i++) {
    let up = 0;
    for (let j = i - n + 1; j <= i; j++) if (close[j] > close[j - 1]) up++;
    out[i] = (up / n) * 100;
  }
  return out;
}

module.exports = { ema, trix, psy };
