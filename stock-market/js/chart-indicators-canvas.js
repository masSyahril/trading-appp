/*
 * Pure calculation functions for the custom canvas chart engine
 * (chart-canvas-engine.js). Deliberately independent of the rest of the
 * app's indicator system (technical-indicators.js etc.) - this is a
 * standalone chart component, not wired into MultiIndicatorSystem.
 *
 * Every function takes the same OHLCV array shape used everywhere else in
 * this app ({ time, open, high, low, close, volume }) and returns an array
 * the same length as the input, with null where there isn't enough data yet
 * (e.g. the first period-1 bars of an SMA) - callers can index this array
 * directly by bar index, no separate offset bookkeeping.
 */
(function (root) {
  function calculateSMA(data, period) {
    period = period || 20;
    const out = new Array(data.length).fill(null);
    if (period <= 0) return out;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= period) sum -= data[i - period].close;
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }

  function calculateEMA(data, period) {
    period = period || 20;
    const out = new Array(data.length).fill(null);
    if (period <= 0 || data.length < period) return out;
    const k = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i].close;
    let ema = sum / period;
    out[period - 1] = ema;
    for (let i = period; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  // Wilder's smoothing (the industry-standard RSI formula - same one real
  // TradingView/most platforms use, not a simplified average-of-averages).
  function calculateRSI(data, period) {
    period = period || 14;
    const out = new Array(data.length).fill(null);
    if (data.length <= period) return out;

    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gainSum += diff; else lossSum -= diff;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }

  const ChartIndicatorsCanvas = { calculateSMA, calculateEMA, calculateRSI };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartIndicatorsCanvas;
  } else {
    root.ChartIndicatorsCanvas = ChartIndicatorsCanvas;
  }
})(typeof window !== 'undefined' ? window : globalThis);
