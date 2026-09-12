/*
 * Trend pane indicators, converted from the MultiIndicatorSystem
 * definitions in multi-indicator-system.js. `math` calls the same compute
 * method as before - the crypto-trading page's panels still use it, so each
 * formula lives in one place - and `outputs`, `levels` and `stats` say what
 * the old render() and panel legend drew.
 */
(function () {
  'use strict';
  const { registry, util, palette: C, outputs: { line, hist } } = window.TFIndicators;
  // Trade summary the BBI indicators' compute returns, shown after the legend values.
  const RR_STATS = [
    { label: 'RR', value: (r) => r.RR, digits: 2, suffix: '%', color: '#4ade80' },
    { label: 'Acc_RR', value: (r) => r.Acc_RR, digits: 2, suffix: '%', color: '#60a5fa' },
    { label: 'BS', value: (r) => r.BS_times, digits: 0, color: '#fbbf24' },
  ];

  // math(M, candles, params) runs the shared MultiIndicatorSystem compute method.
  const add = ({ math, ...entry }) => registry.register({
    category: 'Trend',
    placement: 'pane',
    ...entry,
    compute: (candles, params) => {
      const M = util.math();
      M.chartData = candles;
      return math(M, candles, params);
    },
  });

  add({
    id: 'ADX', name: 'ADX', minBars: 14,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeADX(c, p.period),
    outputs: [
      line('adx', C.LINE1, 'ADX'),
      line('plusdi', C.UP, '+DI', { from: 'plusDI', lineWidth: 1 }),
      line('minusdi', C.DOWN, '-DI', { from: 'minusDI', lineWidth: 1 }),
    ],
  });

  add({
    id: 'MA', name: 'Moving Average', minBars: 2,
    params: [['period', 'Period', 20], ['type', 'Type', 'SMA']],
    math: (M, c, p) => M.computeMA(c, p.period, p.type),
    outputs: [line('ma', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'BBI', name: 'Bull Bear Index', minBars: 24,
    params: [['short', 'Short', 3], ['shortMed', 'Short-Med', 6], ['medLong', 'Med-Long', 12], ['long', 'Long', 24]],
    math: (M, c, p) => M.computeBBIIndicator(c, p),
    outputs: [
      line('bbi', C.LINE1, 'BBI', { lineWidth: 3 }),
      line('ma3', '#4ade80', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma24', '#f87171', 'MA24', { lineWidth: 1, lineStyle: 'dashed' }),
    ],
  });

  add({
    id: 'BBI3', name: 'BBI-3 (Triple MA Average)', minBars: 3,
    params: [['day1', 'MA1', 3], ['day2', 'MA2', 6], ['day3', 'MA3', 12]],
    math: (M, c, p) => M.computeBBI3(c, p.day1, p.day2, p.day3),
    outputs: [
      line('ma1', '#60a5fa', 'MA1', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma2', '#fbbf24', 'MA2', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma3', '#a78bfa', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('bbi3', C.LINE1, 'BBI3', { lineWidth: 3 }),
    ],
    stats: RR_STATS,
  });

  add({
    id: 'BBI4', name: 'BBI-4 (Quad MA Average)', minBars: 3,
    params: [['day1', 'MA1', 3], ['day2', 'MA2', 6], ['day3', 'MA3', 12], ['day4', 'MA4', 24]],
    math: (M, c, p) => M.computeBBI4(c, p.day1, p.day2, p.day3, p.day4),
    outputs: [
      line('ma1', '#60a5fa', 'MA1', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma2', '#fbbf24', 'MA2', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma3', '#a78bfa', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma4', '#f87171', 'MA4', { lineWidth: 1, lineStyle: 'dashed' }),
      line('bbi4', C.LINE1, 'BBI4', { lineWidth: 3 }),
    ],
    stats: RR_STATS,
  });

  add({
    id: 'BBI5', name: 'BBI-5 (Penta MA Average)', minBars: 3,
    params: [['day1', 'MA1', 3], ['day2', 'MA2', 6], ['day3', 'MA3', 12], ['day4', 'MA4', 24], ['day5', 'MA5', 48]],
    math: (M, c, p) => M.computeBBI5(c, p.day1, p.day2, p.day3, p.day4, p.day5),
    outputs: [
      line('ma1', '#60a5fa', 'MA1', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma2', '#fbbf24', 'MA2', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma3', '#a78bfa', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma4', '#f87171', 'MA4', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma5', '#34d399', 'MA5', { lineWidth: 1, lineStyle: 'dashed' }),
      line('bbi5', C.LINE1, 'BBI5', { lineWidth: 3 }),
    ],
    stats: RR_STATS,
  });

  add({
    id: 'BBI3RR', name: 'BBI-3-RR (Triple MA with Rate of Return)', minBars: 3,
    params: [['day1', 'MA1', 3], ['day2', 'MA2', 6], ['day3', 'MA3', 12]],
    math: (M, c, p) => M.computeBBI3RR(c, p.day1, p.day2, p.day3),
    outputs: [
      line('ma1', '#60a5fa', 'MA1', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma2', '#fbbf24', 'MA2', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma3', '#a78bfa', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('bbi3', C.LINE1, 'BBI3', { lineWidth: 3 }),
    ],
    stats: RR_STATS,
  });

  add({
    id: 'BBI4RR', name: 'BBI-4-RR (Quad MA with Rate of Return)', minBars: 3,
    params: [['day1', 'MA1', 3], ['day2', 'MA2', 6], ['day3', 'MA3', 12], ['day4', 'MA4', 24]],
    math: (M, c, p) => M.computeBBI4RR(c, p.day1, p.day2, p.day3, p.day4),
    outputs: [
      line('ma1', '#60a5fa', 'MA1', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma2', '#fbbf24', 'MA2', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma3', '#a78bfa', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma4', '#f87171', 'MA4', { lineWidth: 1, lineStyle: 'dashed' }),
      line('bbi4', C.LINE1, 'BBI4', { lineWidth: 3 }),
    ],
    stats: RR_STATS,
  });

  add({
    id: 'BBI5RR', name: 'BBI-5-RR (Penta MA with Rate of Return)', minBars: 3,
    params: [['day1', 'MA1', 3], ['day2', 'MA2', 6], ['day3', 'MA3', 12], ['day4', 'MA4', 24], ['day5', 'MA5', 48]],
    math: (M, c, p) => M.computeBBI5RR(c, p.day1, p.day2, p.day3, p.day4, p.day5),
    outputs: [
      line('ma1', '#60a5fa', 'MA1', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma2', '#fbbf24', 'MA2', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma3', '#a78bfa', 'MA3', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma4', '#f87171', 'MA4', { lineWidth: 1, lineStyle: 'dashed' }),
      line('ma5', '#34d399', 'MA5', { lineWidth: 1, lineStyle: 'dashed' }),
      line('bbi5', C.LINE1, 'BBI5', { lineWidth: 3 }),
    ],
    stats: RR_STATS,
  });

  add({
    id: 'DEMA', name: 'DEMA', minBars: 5,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeDEMAIndicator(c, p.esp),
    outputs: [
      line('dema', C.LINE1, 'DEMA'),
      line('ema', C.LINE2, 'EMA', { lineWidth: 1 }),
    ],
  });

  add({
    id: 'VRMA', name: 'VRMA (MA Rate of Change)', minBars: 5,
    params: [['day1', 'MA1', 5], ['day2', 'MA2', 10]],
    math: (M, c, p) => M.computeVRMAIndicator(c, p.day1, p.day2),
    outputs: [
      line('vrma1', C.LINE1, 'VRMA1'),
      line('vrma2', C.LINE2, 'VRMA2'),
    ],
  });

  add({
    id: 'COSTMA', name: 'CostMA (Cost Moving Avg)', minBars: 2,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeCostMAIndicator(c, p.day),
    outputs: [line('costma', C.LINE1)],
  });

  add({
    id: 'PSAR', name: 'Parabolic SAR', minBars: 2,
    params: [['acceleration', 'Acceleration', 0.02], ['maximum', 'Maximum', 0.2]],
    math: (M, c, p) => M.computeParabolicSARIndicator(c, p.acceleration, p.maximum),
    outputs: [line('sar', C.LINE1)],
  });

  add({
    id: 'ICHIMOKU', name: 'Ichimoku Cloud', minBars: 52,
    params: [['tenkanPeriod', 'Tenkan', 9], ['kijunPeriod', 'Kijun', 26], ['senkouBPeriod', 'Senkou B', 52]],
    math: (M, c, p) => M.computeIchimokuIndicator(c, p.tenkanPeriod, p.kijunPeriod, p.senkouBPeriod),
    outputs: [
      line('tenkansen', C.LINE1, 'Tenkan', { from: 'tenkanSen' }),
      line('kijunsen', C.LINE2, 'Kijun', { from: 'kijunSen' }),
      line('chikouspan', C.LINE3, 'Chikou', { from: 'chikouSpan' }),
      line('senkoua', C.LINE4, 'Senkou A', { from: 'senkouA' }),
      line('senkoub', C.LINE5, 'Senkou B', { from: 'senkouB' }),
    ],
  });

  add({
    id: 'HULL_MA', name: 'HULL_MA (Hull MA)', minBars: 10,
    params: [['day', 'Period', 10], ['ema_n', 'EMA Period', 9]],
    math: (M, c, p) => M.computeHullMAIndicator(c, p.day, p.ema_n),
    outputs: [
      line('hma', C.LINE1, 'HMA'),
      line('ehma', C.LINE2, 'eHMA'),
    ],
  });

  add({
    id: 'MAoneMAtwo', name: 'MAoneMAtwo with RR', minBars: 10,
    params: [['day1', 'Period1', 5], ['day2', 'Period2', 10]],
    math: (M, c, p) => M.computeMAoneMAtwoIndicator(c, p.day1, p.day2),
    outputs: [
      line('line1', C.LINE1, 'MA1'),
      line('line2', C.LINE2, 'MA2'),
      line('line3', C.LINE3, 'ΣRR%', { lineType: 'step', scale: 'left' }),
      hist('tradeRR', { title: 'Trade RR%', from: 'rrTradePct', signColors: { up: C.LINE1, down: C.LINE2 }, scale: 'left', priceFormat: { type: 'price', precision: 2, minMove: 0.01 } }),
    ],
    leftScale: { borderColor: C.LINE3, scaleMargins: { top: 0.2, bottom: 0.2 } },
    stats: [
      { label: 'Last trade', value: (r) => util.lastFinite(r.rrTradePct), digits: 2, suffix: '%', color: '#4ade80' },
      { label: 'Acc', value: (r) => r.Acc_RR, digits: 2, suffix: '%', color: '#60a5fa' },
      { label: 'n', value: (r) => r.BS_times, digits: 0, color: '#fbbf24' },
      { label: 'Avg', value: (r) => r.Avg_RR, digits: 2, suffix: '%', color: '#94a3b8' },
    ],
  });

  add({
    id: 'MAone_MAtwo', name: 'MAone + MAtwo + Close', minBars: 10,
    params: [['day1', 'Period1', 5], ['day2', 'Period2', 10]],
    math: (M, c, p) => M.computeMAone_MAtwoIndicator(c, p.day1, p.day2),
    outputs: [
      line('line1', C.LINE1, 'MA1'),
      line('line2', C.LINE2, 'MA2'),
      line('line3', C.LINE3, 'Close', { lineWidth: 1 }),
    ],
  });

  add({
    id: 'ZeroLagHullMA', name: 'ZeroLagHullMA', minBars: 10,
    params: [['day1', 'Day 1', 10], ['day2', 'Day 2', 15], ['esp', 'esp', 9]],
    math: (M, c, p) => M.computeZeroLagHullMAIndicator(c, p.day1, p.day2, p.esp),
    outputs: [
      line('ZeroLagHMA', C.LINE1, 'ZeroLagHMA', { from: 'zeroLagHMA' }),
      line('HMA', C.LINE2, 'HMA', { from: 'hma' }),
      line('eHMA', C.LINE3, 'eHMA'),
    ],
  });

  add({
    id: 'StochasticSMI', name: 'Stochastic SMI', minBars: 13,
    params: [['lookback', 'Lookback', 13], ['firstSmooth', 'First Smooth', 25], ['secondSmooth', 'Second Smooth', 2], ['signalLine', 'Signal Line', 9]],
    math: (M, c, p) => M.computeStochasticSMIIndicator(c, p.lookback || 13, p.firstSmooth || 25, p.secondSmooth || 2, p.signalLine || 9),
    outputs: [
      line('SMI', C.LINE1, 'SMI'),
      line('SignalLine', C.LINE2, 'SignalLine'),
    ],
  });

  add({
    id: 'Gaussian', name: 'Gaussian Filter', minBars: 10,
    params: [['day', 'Period', 5], ['sigma', 'Sigma', 3], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeGaussianFilterIndicator(c, p.day, Math.min(p.sigma, 5), p.esp),
    outputs: [
      line('GaussianMA', C.LINE1, 'Gaussian Filter'),
      line('eGaussianMA', C.LINE2, 'eGaussian Filter'),
    ],
  });

  add({
    id: 'Vortex', name: 'Vortex Indicator', minBars: 14,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeVortexIndicator(c, p.day),
    outputs: [
      line('pVI', C.LINE1, 'VI+'),
      line('nVI', C.LINE2, 'VI-'),
    ],
  });

  add({
    id: 'KlingerOsc', name: 'Klinger OSC', minBars: 20,
    params: [['day1', 'Short Period', 10], ['day2', 'Long Period', 20], ['day3', 'Signal Period', 13]],
    math: (M, c, p) => M.computeKlingerOscillator(c, p.day1, p.day2, p.day3),
    outputs: [
      line('KO', C.LINE1, 'KO'),
      line('signalLine', C.LINE2, 'Signal Line'),
    ],
  });

  add({
    id: 'ADX_DMI', name: 'ADX/DMI', minBars: 2,
    params: [['esp', 'smooth', 2]],
    math: (M, c, p) => M.computeADXDMIIndicator(c, p.esp),
    outputs: [
      line('ADX', C.LINE1, 'ADX'),
      line('DIPlus', C.LINE2, 'DI+'),
      line('DIMinus', C.LINE3, 'DI-'),
    ],
  });

  add({
    id: 'AdaptiveMA', name: 'Adaptive MA', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Adaptive MA', 9]],
    math: (M, c, p) => M.computeAdaptiveMAIndicator(c, p.day, p.esp),
    outputs: [line('AdaptiveMA', C.LINE1)],
  });

  add({
    id: 'RainbowMA', name: 'Rainbow MA (overlay)', minBars: 10,
    params: [['num', 'Period', 10]],
    math: (M, c, p) => M.computeRainbowMA(c, p.num),
    outputs: [
      line('rma1', C.LINE1, 'MA1'),
      line('rma2', C.LINE2, 'MA2'),
      line('rma3', C.LINE3, 'MA3'),
      line('rma4', C.LINE4, 'MA4'),
      line('rma5', C.LINE5, 'MA5'),
      line('rma', C.LINE6, 'RMA'),
    ],
  });

  add({
    id: 'LinearReg', name: 'Linear Regression', minBars: 10,
    params: [['N', 'Period', 10], ['K', 'Multiplier', 2]],
    math: (M, c, p) => M.computeLinearReg(c, p.N, p.K),
    outputs: [
      line('LRI', C.LINE1, 'LR'),
      line('LRI_upper', C.LINE2, 'Upper'),
      line('LRI_lower', C.LINE3, 'Lower'),
    ],
  });

  add({
    id: 'LinearRegTP', name: 'Linear Regression (TP)', minBars: 10,
    params: [['N', 'Period', 10], ['K', 'Multiplier', 2]],
    math: (M, c, p) => M.computeLinearRegTP(c, p.N, p.K),
    outputs: [
      line('LRI', C.LINE1, 'LR(TP)'),
      line('LRI_upper', C.LINE2, 'Upper'),
      line('LRI_lower', C.LINE3, 'Lower'),
    ],
  });

  add({
    id: 'AdaptiveLaguerre', name: 'Adaptive Laguerre', minBars: 18,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeAdaptiveLaguerre(c, p.day),
    outputs: [line('ALF', C.LINE1)],
  });

  add({
    id: 'HighLowBands', name: 'High Low Bands', minBars: 11,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 10]],
    math: (M, c, p) => M.computeHighLowBands(c, p.day, p.esp),
    outputs: [
      line('TEMA', C.LINE1, 'TEMA'),
      line('HighBand', C.LINE2, 'High Band'),
      line('LowBand', C.LINE3, 'Low Band'),
    ],
  });

  add({
    id: 'StollerBands', name: 'Stoller Avg Rng Chnl', minBars: 10,
    params: [['day', 'EMA Period', 10], ['esp', 'ATR Smooth', 9]],
    math: (M, c, p) => M.computeStollerBands(c, p.day, p.esp),
    outputs: [
      line('STARC_EMA', C.LINE1, 'EMA'),
      line('upper_STARC', C.LINE2, 'Upper STARC'),
      line('lower_STARC', C.LINE3, 'Lower STARC'),
    ],
  });

  add({
    id: 'MA_Envelope', name: 'MA Envelope', minBars: 9,
    params: [['esp', 'EMA Period', 9], ['kk', 'Band %', 3]],
    math: (M, c, p) => M.computeMA_Envelope(c, p.esp, p.kk),
    outputs: [
      line('ENV_EMA', C.LINE1, 'EMA'),
      line('ENV_upper', C.LINE2, 'Upper'),
      line('ENV_lower', C.LINE3, 'Lower'),
    ],
  });

  add({
    id: 'AlphaBetaMA', name: 'Alpha Beta MA', minBars: 10,
    params: [['ma_day', 'Period', 10], ['alpha', 'Alpha', 0], ['beta', 'Beta', 0]],
    math: (M, c, p) => M.computeAlphaBetaMA(c, p.ma_day, p.alpha, p.beta),
    outputs: [
      line('MA', C.LINE1, 'MA'),
      line('STK_close', C.LINE2, 'Close Price'),
    ],
    stats: [
      { label: 'Trades', value: (r) => r.sum_Buy_Sell_times ?? 0, digits: 0, color: '#94a3b8' },
      { label: 'ROI', value: (r) => r.sum_ROI, digits: 2, suffix: '%', color: (v) => (v >= 0 ? '#22c55e' : '#ef4444') },
    ],
  });

  add({
    id: 'InstantaneousTrendline', name: 'Instant Trend', minBars: 10,
    params: [['alpha', 'Alpha', 0.07]],
    math: (M, c, p) => M.computeInstantaneousTrendline(c, p.alpha),
    outputs: [
      line('IT', C.LINE1, 'IT'),
      line('Trigger', C.LINE2, 'Trigger'),
    ],
  });

  add({
    id: 'ZeroLagEMA', name: 'Zero Lag EMA', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeZeroLagEMA(c, p.day),
    outputs: [line('ZeroLagEMA', C.LINE1)],
  });

  add({
    id: 'JurikMovingAverage', name: 'Jurik Moving Average', minBars: 10,
    params: [['length', 'Length', 20]],
    math: (M, c, p) => M.computeJurikMovingAverage(c, p.length),
    outputs: [line('JurikMA', C.LINE1)],
  });
})();
