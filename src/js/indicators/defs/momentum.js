/*
 * Momentum pane indicators, converted from the MultiIndicatorSystem
 * definitions in multi-indicator-system.js. `math` calls the same compute
 * method as before - the crypto-trading page's panels still use it, so each
 * formula lives in one place - and `outputs`, `levels` and `stats` say what
 * the old render() and panel legend drew.
 */
(function () {
  'use strict';
  const { registry, util, palette: C, outputs: { line } } = window.TFIndicators;

  // math(M, candles, params) runs the shared MultiIndicatorSystem compute method.
  const add = ({ math, ...entry }) => registry.register({
    category: 'Momentum',
    placement: 'pane',
    ...entry,
    compute: (candles, params) => {
      const M = util.math();
      M.chartData = candles;
      return math(M, candles, params);
    },
  });

  add({
    id: 'MOMENTUM', name: 'Momentum', minBars: 10,
    params: [['period', 'Period', 10]],
    math: (M, c, p) => M.computeMomentum(c, p.period),
    outputs: [line('momentum', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'ROC', name: 'Rate of Change', minBars: 10,
    params: [['period', 'Period', 10]],
    math: (M, c, p) => M.computeROC(c, p.period),
    outputs: [line('roc', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'COPPOCK', name: 'Coppock Curve (估波指標)', minBars: 30,
    params: [['short_day', 'Short ROC', 10], ['long_day', 'Long ROC', 20], ['weight_day', 'MA Period', 10]],
    math: (M, c, p) => M.computeCoppockCurve(c, p.short_day, p.long_day, p.weight_day),
    outputs: [
      line('coppock', C.LINE1, 'Coppock (MA)'),
      line('ecoppock', C.LINE2, 'eCoppock (EMA)'),
    ],
  });

  add({
    id: 'ARBR', name: 'AR/BR', minBars: 26,
    params: [['period', 'Period', 26]],
    math: (M, c, p) => M.computeARBRIndicator(c, p.period),
    outputs: [
      line('ar', C.LINE1, 'AR'),
      line('br', C.LINE2, 'BR'),
    ],
    levels: [{ value: 100 }],
  });

  add({
    id: 'SYARBR', name: 'SYBR', minBars: 23,
    params: [['period', 'Period', 23]],
    math: (M, c, p) => M.computeSYARBRIndicator(c, p.period),
    outputs: [
      line('ar', C.LINE4, 'AR'),
      line('br', C.LINE5, 'BR'),
    ],
    levels: [{ value: 100 }],
  });

  add({
    id: 'CR', name: 'CR (Dual)', minBars: 10,
    params: [['periodA', 'CR A', 10], ['periodB', 'CR B', 26]],
    math: (M, c, p) => M.computeDualCR(c, p.periodA, p.periodB),
    outputs: [
      line('crA', C.LINE1, 'CR A'),
      line('crB', C.LINE2, 'CR B'),
    ],
    levels: [{ value: 100 }],
  });

  add({
    id: 'BULLBEAR', name: 'Bull Bear Power', minBars: 13,
    params: [['period', 'EMA Period', 13]],
    math: (M, c, p) => M.computeBullBearPowerIndicator(c, p.period),
    outputs: [
      line('bullPower', C.DOWN, 'Bull', { priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } }),
      line('bearPower', C.UP, 'Bear', { priceFormat: { type: 'price', precision: 4, minMove: 0.0001 } }),
    ],
    levels: [{ value: 0 }],
  });

  add({
    id: 'ADR', name: 'ADR (Advance/Decline Ratio)', minBars: 5,
    params: [['day', 'day', 20], ['esp', 'Smooth', 10]],
    math: (M, c, p) => M.computeADRIndicator(c, p.day, p.esp),
    outputs: [
      line('ADR', C.LINE1, 'ADR'),
      line('eADR', C.LINE2, 'eADR'),
    ],
  });

  add({
    id: 'IMI', name: 'IMI (Intraday Momentum)', minBars: 10,
    params: [['day1', 'IMI1', 10], ['day2', 'IMI2', 20]],
    math: (M, c, p) => M.computeIMIIndicator(c, p.day1, p.day2),
    outputs: [
      line('imi1', C.LINE1, 'IMI1', { from: 'IMI1' }),
      line('imi2', C.LINE2, 'IMI2', { from: 'IMI2' }),
    ],
  });

  add({
    id: 'QSTICK', name: 'Qstick (Quantitative Candle)', minBars: 10,
    params: [['day1', 'IMI1', 10], ['day2', 'IMI2', 20]],
    math: (M, c, p) => M.computeQstickIndicator(c, p.day1, p.day2),
    outputs: [
      line('qstick1', C.LINE1, 'Qstick1', { from: 'Qstick1' }),
      line('qstick2', C.LINE2, 'Qstick2', { from: 'Qstick2' }),
    ],
  });

  add({
    id: 'MTM', name: 'MTM (Momentum)', minBars: 10,
    params: [['day1', 'Period 1', 10], ['day2', 'Period 2', 20]],
    math: (M, c, p) => M.computeMTMIndicator(c, p.day1, p.day2),
    outputs: [
      line('mtm1', C.LINE1, 'MTM1', { from: 'MTM1' }),
      line('mtm2', C.LINE2, 'MTM2', { from: 'MTM2' }),
    ],
  });

  add({
    id: 'ROC_DUAL', name: 'ROC (Rate of Change Dual)', minBars: 10,
    params: [['day1', 'Period 1', 10], ['day2', 'Period 2', 20]],
    math: (M, c, p) => M.computeROCIndicator(c, p.day1, p.day2),
    outputs: [
      line('roc1', C.LINE1, 'ROC1', { from: 'ROC1' }),
      line('roc2', C.LINE2, 'ROC2', { from: 'ROC2' }),
    ],
  });

  add({
    id: 'KST', name: 'KST (Know Sure Things)', minBars: 30,
    params: [['day1', 'ROC1', 10], ['day2', 'ROC2', 15], ['day3', 'ROC3', 20], ['day4', 'ROC4', 30]],
    math: (M, c, p) => M.computeKSTIndicator(c, p.day1, p.day2, p.day3, p.day4),
    outputs: [
      line('kst', C.LINE1, 'KST', { from: 'KST' }),
      line('kstma', C.LINE2, 'KST Signal', { from: 'KSTma' }),
    ],
  });

  add({
    id: 'ACC', name: 'ACC (Acceleration)', minBars: 15,
    params: [['MTM_n', 'MTM Period', 10], ['ACC_n', 'ACC Period', 5]],
    math: (M, c, p) => M.computeACCIndicator(c, p.MTM_n, p.ACC_n),
    outputs: [
      line('mtm', C.LINE1, 'MTM', { from: 'MTM' }),
      line('acc', C.LINE2, 'ACC', { from: 'ACC' }),
    ],
  });

  add({
    id: 'BTI', name: 'BTI (Breadth Thrust)', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeBTIIndicator(c, p.day),
    outputs: [line('bti', C.LINE1)],
  });

  add({
    id: 'PGO', name: 'PGO (Price Growth Osc)', minBars: 14,
    params: [['day', 'MA_Day', 10], ['n_periods', 'Growth Periods', 14], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computePGOIndicator(c, p.day, p.n_periods, p.esp),
    outputs: [
      line('PGO', C.LINE1, 'PGO'),
      line('ePGO', C.LINE2, 'ePGO'),
    ],
  });

  add({
    id: 'QstickBodyAvg', name: 'Qstick Body Avg', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeQstickBodyAvgIndicator(c, p.day, p.esp),
    outputs: [
      line('QstickBodyAvg', C.LINE1, 'Qstick Body Avg'),
      line('eQstickBodyAvg', C.LINE2, 'eQstick Body Avg'),
    ],
  });

  add({
    id: 'ElderForceIndex', name: 'Elder Force Index', minBars: 2,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeElderForceIndex(c, p.esp),
    outputs: [
      line('EFI', C.LINE1, 'Elder Force'),
      line('eEFI', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'RSI_Mom', name: 'RSI Momentum', minBars: 12,
    params: [['RSI_day', 'RSI Period', 10]],
    math: (M, c, p) => M.computeRSI_Mom(c, p.RSI_day),
    outputs: [line('RSI_Mom', C.LINE1)],
  });

  add({
    id: 'RSI_CenteredCumul', name: 'RSI Centered Cumulative', minBars: 12,
    params: [['RSI_day', 'RSI Period', 10]],
    math: (M, c, p) => M.computeRSI_CenteredCumul(c, p.RSI_day),
    outputs: [line('CenteredCumulRSI', C.LINE1)],
  });

  add({
    id: 'AwesomeOsc', name: 'Awesome Oscillator', minBars: 34,
    params: [['day1', 'Short', 5], ['day2', 'Long', 34]],
    math: (M, c, p) => M.computeAwesomeOsc(c, p.day1, p.day2),
    outputs: [line('AwesomeOsc', C.LINE1)],
  });

  add({
    id: 'TSI', name: 'True Strength Index', minBars: 3,
    params: [['esp1', 'Long EMA', 25], ['esp2', 'Short EMA', 13], ['m', 'Signal', 7]],
    math: (M, c, p) => M.computeTSI(c, p.esp1, p.esp2, p.m),
    outputs: [
      line('TSI', C.LINE1, 'TSI'),
      line('TSI_Signal', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'RainbowOscillator', name: 'Rainbow Oscillator', minBars: 10,
    params: [['ma_day', 'MA Period', 10]],
    math: (M, c, p) => M.computeRainbowOscillator(c, p.ma_day),
    outputs: [line('Rainbow', C.LINE1)],
  });
})();
