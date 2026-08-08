/*
 * Catalog of indicators for the canvas-chart.html "+ Indicator" dropdown.
 * Every compute() here calls this app's REAL, already-shipped indicator
 * math (window.computeSMA/computeEMA/computeMACD/computeRSI/... - loaded
 * from ../src/js/utils/indicators.js and ../src/js/core/technical-indicators.js,
 * the same functions MultiIndicatorSystem's own wrapper methods delegate to
 * for the other four pages), not reimplementations. This file only adapts
 * each function's actual return shape into what chart-canvas-engine.js
 * expects: an array (or {seriesName: array}) the same length as the input
 * data, null-padded wherever that indicator doesn't have enough history yet.
 *
 * That padding matters and differs per function - verified by reading each
 * one's source rather than assumed:
 *   - computeSMA/computeEMA/computeMACD/computeBollingerBands/computeWilliamsR/
 *     computeCCI/computeADX return SHORT, un-padded arrays (length < input);
 *     padLeft() below aligns them back to the full bar count.
 *   - computeRSI/computeStochastic/computeATR already return full-length
 *     arrays with their own leading nulls - passed through as-is.
 */
(function (root) {
  function padLeft(arr, fullLength, offset) {
    const out = new Array(fullLength).fill(null);
    if (!arr) return out;
    for (let i = 0; i < arr.length; i++) {
      const idx = offset + i;
      if (idx >= 0 && idx < fullLength) out[idx] = arr[i];
    }
    return out;
  }

  const closesOf = (data) => data.map((d) => d.close);
  const highsOf = (data) => data.map((d) => d.high);
  const lowsOf = (data) => data.map((d) => d.low);

  const REGISTRY = [
    {
      id: 'sma', type: 'overlay', category: 'Overlay', label: 'Simple Moving Average (SMA)',
      defaultParams: { period: 20 },
      build(params) {
        return {
          id: 'sma', label: `SMA(${params.period})`,
          series: [{ key: null, color: '#2962FF', lineWidth: 1.5 }],
          params,
          compute(data, p) {
            const short = root.computeSMA(closesOf(data), p.period);
            return padLeft(short, data.length, p.period - 1);
          },
        };
      },
    },
    {
      id: 'ema', type: 'overlay', category: 'Overlay', label: 'Exponential Moving Average (EMA)',
      defaultParams: { period: 20 },
      build(params) {
        return {
          id: 'ema', label: `EMA(${params.period})`,
          series: [{ key: null, color: '#f59e0b', lineWidth: 1.5 }],
          params,
          compute(data, p) {
            const short = root.computeEMA(closesOf(data), p.period);
            return padLeft(short, data.length, p.period - 1);
          },
        };
      },
    },
    {
      id: 'bb', type: 'overlay', category: 'Overlay', label: 'Bollinger Bands',
      defaultParams: { period: 20, stdDev: 2 },
      build(params) {
        return {
          id: 'bb', label: `BB(${params.period},${params.stdDev})`,
          series: [
            { key: 'upper', color: '#9aa1b0', lineWidth: 1 },
            { key: 'middle', color: '#2962FF', lineWidth: 1.5 },
            { key: 'lower', color: '#9aa1b0', lineWidth: 1 },
          ],
          params,
          compute(data, p) {
            const r = root.computeBollingerBands(closesOf(data), p.period, p.stdDev);
            const offset = p.period - 1;
            return {
              upper: padLeft(r.upper, data.length, offset),
              middle: padLeft(r.middle, data.length, offset),
              lower: padLeft(r.lower, data.length, offset),
            };
          },
        };
      },
    },
    {
      id: 'rsi', type: 'subpane', category: 'Oscillator', label: 'Relative Strength Index (RSI)',
      defaultParams: { period: 14 },
      build(params) {
        return {
          id: 'rsi', label: `RSI(${params.period})`,
          series: [{ key: null, color: '#f59e0b', lineWidth: 1.5 }],
          min: 0, max: 100, referenceLines: [30, 50, 70], autoScale: false,
          params,
          compute(data, p) {
            // computeRSI already returns a full-length, self-aligned array.
            return root.computeRSI(closesOf(data), p.period);
          },
        };
      },
    },
    {
      id: 'macd', type: 'subpane', category: 'Oscillator', label: 'MACD',
      defaultParams: { fast: 12, slow: 26, signal: 9 },
      build(params) {
        return {
          id: 'macd', label: `MACD(${params.fast},${params.slow},${params.signal})`,
          series: [
            { key: 'hist', style: 'histogram' },
            { key: 'macd', color: '#2962FF', lineWidth: 1.5 },
            { key: 'signal', color: '#f59e0b', lineWidth: 1.5 },
          ],
          autoScale: true, referenceLines: [],
          params,
          compute(data, p) {
            const r = root.computeMACD(closesOf(data), p.fast, p.slow, p.signal);
            const offset = p.slow + p.signal - 2;
            return {
              macd: padLeft(r.macd, data.length, offset),
              signal: padLeft(r.signal, data.length, offset),
              hist: padLeft(r.hist, data.length, offset),
            };
          },
        };
      },
    },
    {
      id: 'stoch', type: 'subpane', category: 'Oscillator', label: 'Stochastic Oscillator',
      defaultParams: { kPeriod: 14, dPeriod: 3 },
      build(params) {
        return {
          id: 'stoch', label: `Stoch(${params.kPeriod},${params.dPeriod})`,
          series: [
            { key: 'k', color: '#2962FF', lineWidth: 1.5 },
            { key: 'd', color: '#f59e0b', lineWidth: 1.5 },
          ],
          min: 0, max: 100, referenceLines: [20, 50, 80], autoScale: false,
          params,
          compute(data, p) {
            // computeStochastic already returns full-length, self-aligned k/d.
            return root.computeStochastic(highsOf(data), lowsOf(data), closesOf(data), p.kPeriod, p.dPeriod);
          },
        };
      },
    },
    {
      id: 'williamsr', type: 'subpane', category: 'Oscillator', label: 'Williams %R',
      defaultParams: { period: 14 },
      build(params) {
        return {
          id: 'williamsr', label: `Williams %R(${params.period})`,
          series: [{ key: null, color: '#a855f7', lineWidth: 1.5 }],
          min: -100, max: 0, referenceLines: [-20, -50, -80], autoScale: false,
          params,
          compute(data, p) {
            const short = root.computeWilliamsR(highsOf(data), lowsOf(data), closesOf(data), p.period);
            return padLeft(short, data.length, p.period - 1);
          },
        };
      },
    },
    {
      id: 'cci', type: 'subpane', category: 'Oscillator', label: 'Commodity Channel Index (CCI)',
      defaultParams: { period: 20 },
      build(params) {
        return {
          id: 'cci', label: `CCI(${params.period})`,
          series: [{ key: null, color: '#089981', lineWidth: 1.5 }],
          autoScale: true, referenceLines: [],
          params,
          compute(data, p) {
            const short = root.computeCCI(highsOf(data), lowsOf(data), closesOf(data), p.period);
            return padLeft(short, data.length, p.period - 1);
          },
        };
      },
    },
    {
      id: 'adx', type: 'subpane', category: 'Oscillator', label: 'ADX / DMI',
      defaultParams: { period: 14 },
      build(params) {
        return {
          id: 'adx', label: `ADX(${params.period})`,
          series: [
            { key: 'adx', color: '#2962FF', lineWidth: 1.5 },
            { key: 'plusDI', color: '#089981', lineWidth: 1 },
            { key: 'minusDI', color: '#f23645', lineWidth: 1 },
          ],
          min: 0, max: 100, referenceLines: [20, 50], autoScale: false,
          params,
          compute(data, p) {
            const r = root.computeADX(highsOf(data), lowsOf(data), closesOf(data), p.period);
            const offset = 2 * p.period - 1;
            return {
              adx: padLeft(r.adx, data.length, offset),
              plusDI: padLeft(r.plusDI, data.length, offset),
              minusDI: padLeft(r.minusDI, data.length, offset),
            };
          },
        };
      },
    },
    {
      id: 'atr', type: 'subpane', category: 'Oscillator', label: 'Average True Range (ATR)',
      defaultParams: { period: 14 },
      build(params) {
        return {
          id: 'atr', label: `ATR(${params.period})`,
          series: [{ key: null, color: '#f59e0b', lineWidth: 1.5 }],
          autoScale: true, referenceLines: [],
          params,
          compute(data, p) {
            // computeATR already returns a full-length array (index 0 = null).
            return root.computeATR(highsOf(data), lowsOf(data), closesOf(data), p.period).atr;
          },
        };
      },
    },
  ];

  const ChartIndicatorRegistry = { REGISTRY, padLeft };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartIndicatorRegistry;
  } else {
    root.ChartIndicatorRegistry = ChartIndicatorRegistry;
  }
})(typeof window !== 'undefined' ? window : globalThis);
