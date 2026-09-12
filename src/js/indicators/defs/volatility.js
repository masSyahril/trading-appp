/*
 * Volatility pane indicators, converted from the MultiIndicatorSystem
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
    category: 'Volatility',
    placement: 'pane',
    ...entry,
    compute: (candles, params) => {
      const M = util.math();
      M.chartData = candles;
      return math(M, candles, params);
    },
  });

  add({
    id: 'ATR', name: 'ATR (Average True Range)', minBars: 2,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeATRIndicator(c, p.period),
    outputs: [line('atr', C.LINE1)],
  });

  add({
    id: 'WilliamsVolatilityChannel', name: 'Williams Volatility Channel', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeWilliamsVolatilityChannelIndicator(c, p.day, p.esp),
    outputs: [
      line('Upperline', C.LINE1, 'Upper Line'),
      line('MiddleLine', C.LINE2, 'Middle Line'),
      line('Lowerline', C.LINE3, 'Lower Line'),
    ],
  });

  add({
    id: 'FractalDimensionIndex', name: 'Fractal Dimension Index', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeFractalDimensionIndex(c, p.day),
    outputs: [line('FDI', C.LINE1)],
  });

  add({
    id: 'EfficiencyRatio', name: 'Efficiency Ratio', minBars: 11,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeEfficiencyRatio(c, p.day, p.esp),
    outputs: [
      line('ER', C.LINE1, 'ER'),
      line('eER', C.LINE2, 'eER Signal'),
    ],
  });

  add({
    id: 'ChoppinessIdx', name: 'Choppiness Index', minBars: 11,
    params: [['num', 'Period', 10]],
    math: (M, c, p) => M.computeChoppinessIdx(c, p.num),
    outputs: [line('Choppiness', C.LINE1)],
  });

  add({
    id: 'RVI_Vol', name: 'Relative Volatility Index', minBars: 10,
    params: [['SD_num', 'SD Period', 10], ['esp', 'Smooth', 14]],
    math: (M, c, p) => M.computeRVI_Vol(c, p.SD_num, p.esp),
    outputs: [
      line('RVI_Vol', C.LINE1, 'RVI'),
      line('eRVI_Vol', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'StdDevIndicator', name: 'Standard Deviation', minBars: 10,
    params: [['SD_num', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeStdDevIndicator(c, p.SD_num, p.esp),
    outputs: [
      line('SD', C.LINE1, 'Std Dev'),
      line('eSD', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'ATRPercentage', name: 'ATR Percentage', minBars: 7,
    params: [['ATR_num', 'ATR Period', 14]],
    math: (M, c, p) => M.computeATRPercentage(c, p.ATR_num),
    outputs: [line('ATR_percent', C.LINE1)],
  });

  add({
    id: 'HistoricalVolatility_Close', name: 'Historical Volatility (Close)', minBars: 10,
    params: [['HV_num', 'HV Period', 10]],
    math: (M, c, p) => M.computeHistoricalVolatility_Close(c, p.HV_num),
    outputs: [line('HV', C.LINE1)],
  });

  add({
    id: 'HistoricalVolatility_TP', name: 'Historical Volatility (True Range)', minBars: 10,
    params: [['HV_num', 'HV Period', 10]],
    math: (M, c, p) => M.computeHistoricalVolatility_TP(c, p.HV_num),
    outputs: [line('HV', C.LINE1)],
  });

  add({
    id: 'Z_Score_TP_Return', name: 'Z-Score (True Range Return)', minBars: 10,
    params: [['Z_num', 'Z Period', 10]],
    math: (M, c, p) => M.computeZ_Score_TP_Return(c, p.Z_num),
    outputs: [line('Z_Score', C.LINE1)],
  });

  add({
    id: 'Z_Score_Close_Return', name: 'Z-Score (Close Return)', minBars: 10,
    params: [['Z_num', 'Z Period', 10]],
    math: (M, c, p) => M.computeZ_Score_Close_Return(c, p.Z_num),
    outputs: [line('Z_score', C.LINE1)],
  });

  add({
    id: 'Z_Score_EMA', name: 'Z-Score (EMA)', minBars: 10,
    params: [['Z_num', 'Z Period', 10], ['esp', 'EMA Period', 9]],
    math: (M, c, p) => M.computeZ_Score_EMA(c, p.Z_num, p.esp),
    outputs: [line('Z_Score', C.LINE1)],
  });

  add({
    id: 'Z_Score_Typical', name: 'Z-Score (Typical)', minBars: 10,
    params: [['Z_num', 'Z Period', 10]],
    math: (M, c, p) => M.computeZ_Score_typical(c, p.Z_num),
    outputs: [line('Z_score', C.LINE1)],
  });

  add({
    id: 'Z_Score_Close', name: 'Z-Score (Close)', minBars: 10,
    params: [['Z_num', 'Z Period', 10]],
    math: (M, c, p) => M.computeZ_Score_close(c, p.Z_num),
    outputs: [line('Z_score', C.LINE1)],
  });
})();
