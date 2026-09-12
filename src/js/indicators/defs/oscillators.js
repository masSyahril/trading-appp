/*
 * Oscillators pane indicators, converted from the MultiIndicatorSystem
 * definitions in multi-indicator-system.js. `math` calls the same compute
 * method as before - the crypto-trading page's panels still use it, so each
 * formula lives in one place - and `outputs`, `levels` and `stats` say what
 * the old render() and panel legend drew.
 */
(function () {
  'use strict';
  const { registry, util, palette: C, outputs: { line, hist } } = window.TFIndicators;
  const SIGN = { up: C.UP, down: C.DOWN };

  // math(M, candles, params) runs the shared MultiIndicatorSystem compute method.
  const add = ({ math, ...entry }) => registry.register({
    category: 'Oscillators',
    placement: 'pane',
    ...entry,
    compute: (candles, params) => {
      const M = util.math();
      M.chartData = candles;
      return math(M, candles, params);
    },
  });

  add({
    id: 'MACD', name: 'MACD', minBars: 26,
    params: [['fast', 'Fast', 12], ['slow', 'Slow', 26], ['signal', 'Signal', 9]],
    math: (M, c, p) => M.computeMACD(c, p.fast, p.slow, p.signal),
    outputs: [
      line('macd', C.LINE1, 'MACD'),
      line('signal', C.LINE2, 'Signal'),
      hist('histogram', { title: 'Hist', from: 'hist', signColors: SIGN }),
    ],
  });

  add({
    id: 'RSI', name: 'RSI (Dual)', minBars: 5,
    params: [['periodA', 'RSI A', 5], ['periodB', 'RSI B', 10]],
    math: (M, c, p) => M.computeDualRSI(c, p.periodA, p.periodB),
    outputs: [
      line('rsiA', C.LINE1, 'RSI A'),
      line('rsiB', C.LINE2, 'RSI B'),
    ],
    levels: [{ value: 70 }, { value: 30 }],
  });

  add({
    id: 'STOCH', name: 'KD', minBars: 14, editable: false,
    params: [['kPeriod', '%K', 14], ['dPeriod', '%D', 3]],
    math: (M, c, p) => M.computeStochastic(c, p.kPeriod, p.dPeriod),
    outputs: [
      line('k', C.LINE1, 'K'),
      line('d', C.LINE2, 'D'),
    ],
  });

  add({
    id: 'WANG_KD', name: 'Wang KD', minBars: 9,
    params: [['period', 'Period', 9]],
    math: (M, c, p) => M.computeWangKD(c, p.period),
    outputs: [
      line('k', C.LINE1, 'K'),
      line('d', C.LINE2, 'D'),
    ],
  });

  add({
    id: 'NEW_KD', name: 'New KD (K/D/K2/D2)', minBars: 9,
    params: [['kdDay', 'KD Period', 9], ['kd2Day', 'K2/D2 Frequency', 9]],
    math: (M, c, p) => M.computeNewKD(c, p.kdDay, p.kd2Day),
    outputs: [
      line('k2', C.LINE3, 'K2', { from: 'K2' }),
      line('d2', C.LINE6, 'D2', { from: 'D2', lineWidth: 3 }),
    ],
  });

  add({
    id: 'WANG_WR', name: 'Wang %R', minBars: 14,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeWangWilliamsR(c, p.period),
    outputs: [line('williamsr', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'WILLIAMS', name: 'Williams %R', minBars: 14,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeWilliamsR(c, p.period),
    outputs: [line('williamsr', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'CCI', name: 'CCI', minBars: 20,
    params: [['period', 'Period', 20]],
    math: (M, c, p) => M.computeCCI(c, p.period),
    outputs: [line('cci', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'VOL_RSI', name: 'Volume RSI (Wang)', minBars: 10,
    params: [['period', 'RSI Period', 10], ['esp', 'Smoothing', 9]],
    math: (M, c, p) => M.computeVolumeRSI(c, p.period, p.esp),
    outputs: [
      line('volRsi', C.LINE1, 'Vol RSI'),
      line('eVolRsi', C.LINE2, 'eVol RSI'),
    ],
    levels: [{ value: 70 }, { value: 30 }],
  });

  add({
    id: 'OSC', name: 'OSC (Oscillator)', minBars: 2,
    params: [['period', 'MA Period', 20]],
    math: (M, c, p) => M.computeOSC(c, p.period),
    outputs: [
      line('osc1', C.LINE1, 'OSC1'),
      line('osc2', C.LINE2, 'OSC2'),
    ],
    levels: [{ value: 0 }],
  });

  add({
    id: 'BIAS', name: 'BIAS (Dual)', minBars: 2,
    params: [['day1', 'BIAS1', 6], ['day2', 'BIAS2', 12]],
    math: (M, c, p) => M.computeBIAS(c, p.day1, p.day2),
    outputs: [
      line('bias1', C.LINE1, 'BIAS1'),
      line('bias2', C.LINE2, 'BIAS2'),
    ],
    levels: [{ value: 0 }],
  });

  add({
    id: 'MBIAS', name: 'MBIAS (MA Difference)', minBars: 2,
    params: [['day1', 'Short MA', 6], ['day2', 'Long MA', 12]],
    math: (M, c, p) => M.computeMBIAS(c, p.day1, p.day2),
    outputs: [line('mbias', C.LINE1)],
    levels: [{ value: 0 }],
  });

  add({
    id: 'UOSC', name: 'UOSC (Ultimate Oscillator)', minBars: 10,
    params: [['maPeriod', 'MA Period', 20], ['oscPeriod', 'OSC Period', 10]],
    math: (M, c, p) => M.computeUOSC(c, p.maPeriod, p.oscPeriod),
    outputs: [
      line('uosc1', C.LINE1, 'UOSC1'),
      line('uosc2', C.LINE2, 'UOSC2'),
    ],
    levels: [{ value: 0 }],
  });

  add({
    id: 'HLO', name: 'HLO (High/Low Oscillator)', minBars: 2,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeHLOIndicator(c, p.period),
    outputs: [
      line('hlo', C.LINE1, 'HLO', { lineWidth: 1 }),
      line('hlos', C.LINE2, 'HLOS'),
    ],
  });

  add({
    id: 'VHF', name: 'VHF (Vertical Horizontal Filter)', minBars: 5,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeVHFIndicator(c, p.period),
    outputs: [line('vhf', C.LINE1, null, { lineWidth: 1 })],
  });

  add({
    id: 'RWI', name: 'RWI (Random Walk Index)', minBars: 14,
    params: [['RWI_n', 'Period', 14], ['esp', 'Smooth', 10]],
    math: (M, c, p) => M.computeRandomWalkingIndex(c, p.RWI_n, p.esp),
    outputs: [
      line('RWI_high', C.LINE1, 'RWI High'),
      line('RWI_low', C.LINE2, 'RWI Low'),
    ],
  });

  add({
    id: 'REX_OSC', name: 'REX Oscillator', minBars: 2,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeREXOscillatorIndicator(c, p.esp),
    outputs: [
      line('REX', C.LINE1, 'REX'),
      line('TVB', C.LINE2, 'TVB'),
    ],
  });

  add({
    id: 'DPO', name: 'DPO (Detrended Price Osc)', minBars: 10,
    params: [['MA_day', 'MA Period', 10]],
    math: (M, c, p) => M.computeDPOIndicator(c, p.MA_day),
    outputs: [
      line('dpo', C.LINE1, 'DPO', { from: 'DPO' }),
      line('edpo', C.LINE2, 'eDPO', { from: 'eDPO' }),
    ],
  });

  add({
    id: 'M3', name: 'M3 Indicator', minBars: 20,
    params: [['num', 'Smoothing Period', 9]],
    math: (M, c, p) => M.computeM3Indicator(c, p.num),
    outputs: [
      line('m3', C.LINE1, 'M3'),
      line('em3', C.LINE2, 'eM3'),
    ],
  });

  add({
    id: 'DMA', name: 'DMA (Difference of Moving Average)', minBars: 20,
    params: [['short_day', 'Short MA', 10], ['long_day', 'Long MA', 20], ['ema_n', 'EMA Period', 9]],
    math: (M, c, p) => M.computeDMAIndicator(c, p.short_day, p.long_day, p.ema_n),
    outputs: [
      line('dma', C.LINE1, 'DMA'),
      line('ama', C.LINE2, 'AMA'),
    ],
  });

  add({
    id: 'BOLLINGER4SD', name: 'Bollinger Bands 4SD', minBars: 10,
    params: [['MA_day', 'MA_day', 10], ['SD_day', 'SD_day', 20]],
    math: (M, c, p) => M.computeBollingerBands(c, p.MA_day, p.SD_day),
    outputs: [
      line('upperBand', C.LINE1, 'Upper'),
      line('MA', C.LINE2, 'MA'),
      line('lowerBand', C.LINE3, 'Lower'),
    ],
  });

  add({
    id: 'Alligator', name: 'Alligator (Prof. Wang)', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeAlligatorIndicator(c, p.day),
    outputs: [
      line('line1', C.LINE1, 'Lips'),
      line('line2', C.LINE2, 'Teeth'),
      line('line3', C.LINE3, 'Jaw'),
    ],
  });

  add({
    id: 'BalanceOfPower', name: 'Balance of Power', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'esp', 9]],
    math: (M, c, p) => M.computeBalanceOfPowerIndicator(c, p.day, p.esp),
    outputs: [
      line('bop', C.LINE1, 'BOP'),
      line('eBOP', C.LINE2, 'eBOP'),
    ],
  });

  add({
    id: 'RiseFallRatioCOG', name: 'Rise Fall Ratio COG', minBars: 10,
    params: [['day', 'day', 10], ['esp', 'esp', 9]],
    math: (M, c, p) => M.computeRiseFallRatioCOGIndicator(c, p.day, p.esp),
    outputs: [
      line('riseFallRatio', C.LINE1, 'Rise/Fall Ratio'),
      line('eRiseFallRatioCOG', C.LINE2, 'eRise/Fall Ratio COG'),
    ],
  });

  add({
    id: 'GravityOsc_COG', name: 'Gravity Osc COG', minBars: 10,
    params: [['day', 'day', 10], ['esp', 'esp', 9]],
    math: (M, c, p) => M.computeGravityOscCOGIndicator(c, p.day, p.esp),
    outputs: [
      line('COG', C.LINE1, 'COG'),
      line('eCOG', C.LINE2, 'eGravity Osc COG'),
    ],
  });

  add({
    id: 'KairiRI', name: 'Kairi RI (Kairi Rate of Change)', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeKairiRIIndicator(c, p.day, p.esp),
    outputs: [
      line('KRI', C.LINE1, 'Kairi RI'),
      line('eKRI', C.LINE2, 'eKairi RI'),
    ],
  });

  add({
    id: 'McClellanOSC', name: 'McClellan OSC', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Short EMA', 20], ['esp2', 'Long EMA', 40]],
    math: (M, c, p) => M.computeMcClellanOscillator(c, p.day, p.esp, p.esp2),
    outputs: [
      line('mcclellanOsc', C.LINE1, 'McClellan'),
      line('SI', C.LINE2, 'SI'),
    ],
  });

  add({
    id: 'OBOS', name: 'OBOS (Overbought/Oversold)', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 11]],
    math: (M, c, p) => M.computeOBOSIndicator(c, p.day, p.esp),
    outputs: [
      line('OBOS', C.LINE1, 'OBOS'),
      line('eOBOS', C.LINE2, 'eOBOS'),
    ],
  });

  add({
    id: 'DeMarker', name: 'DeMarker', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeDeMarkerIndicator(c, p.day),
    outputs: [line('DeMarker', C.LINE1)],
  });

  add({
    id: 'DynamicZoneRSI', name: 'Dynamic Zone RSI', minBars: 5,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeDynamicZoneRSI(c, p.day, p.esp),
    outputs: [
      line('DZ_upper', C.LINE1, 'DZ RSI Upper'),
      line('DZ_mid', C.LINE2, 'DZ RSI Mid'),
      line('DZ_lower', C.LINE3, 'DZ RSI Lower'),
    ],
  });

  add({
    id: 'ZeroLagKD', name: 'Zero Lag KD', minBars: 9,
    params: [['KD_day', 'KD Period', 9], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeZeroLagKD(c, p.KD_day, p.esp),
    outputs: [
      line('ZeroLag_K', C.LINE1, '%K'),
      line('ZeroLag_D', C.LINE2, '%D'),
    ],
  });

  add({
    id: 'SchaffTrend', name: 'Schaff Trend Cycle', minBars: 20,
    params: [['short_day', 'Short EMA', 10], ['long_day', 'Long EMA', 20], ['kd_day', 'KD Period', 9]],
    math: (M, c, p) => M.computeSchaffTrend(c, p.short_day, p.long_day, p.kd_day),
    outputs: [line('STC', C.LINE1)],
  });

  add({
    id: 'FisherTransform', name: 'Fisher Transform', minBars: 10,
    params: [['Fisher_day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeFisherTransform(c, p.Fisher_day, p.esp),
    outputs: [
      line('Fisher', C.LINE1, 'Fisher'),
      line('FisherSignal', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'REI', name: 'Range Expansion Index', minBars: 14,
    params: [['REI_length', 'Length', 8], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeREI(c, p.REI_length, p.esp),
    outputs: [
      line('REI', C.LINE1, 'REI'),
      line('eREI', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'RelVigorIndex', name: 'Relative Vigor Index', minBars: 16,
    params: [['RVI_day', 'Period', 10]],
    math: (M, c, p) => M.computeRelVigorIndex(c, p.RVI_day),
    outputs: [
      line('VigorRVI', C.LINE1, 'Vigor RVI'),
      line('VigorSignal', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'AroonOsc', name: 'Aroon Oscillator', minBars: 25,
    params: [['Aroon_day', 'Period', 25]],
    math: (M, c, p) => M.computeAroonOsc(c, p.Aroon_day),
    outputs: [line('AroonOsc', C.LINE1)],
  });

  add({
    id: 'WilliamsPercentRange', name: 'Williams %R (Wang)', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeWilliamsPercentRange(c, p.day),
    outputs: [line('WilliamsPctRange', C.LINE1)],
  });

  add({
    id: 'LaguerreRSI', name: 'Laguerre RSI', minBars: 10,
    params: [['gamma', 'Gamma', 0.5], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeLaguerreRSI(c, p.gamma, p.esp),
    outputs: [
      line('LaguerreRSI', C.LINE1, 'Laguerre RSI'),
      line('eLaguerreRSI', C.LINE2, 'eLaguerre RSI'),
    ],
  });

  add({
    id: 'RSI_TP', name: 'RSI (Typical Price)', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeRSI_TP(c, p.day, p.esp),
    outputs: [line('RSI_TP', C.LINE1)],
  });

  add({
    id: 'AdaptiveRSI', name: 'Adaptive RSI', minBars: 48,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeAdaptiveRSI(c, p.esp),
    outputs: [
      line('AdaptiveRSI', C.LINE1, 'Adaptive RSI'),
      line('eAdaptiveRSI', C.LINE2, 'eAdaptive RSI'),
    ],
  });

  add({
    id: 'NewKD', name: 'New KD (3)', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeNewKDW(c, p.day, p.esp),
    outputs: [
      line('KD_K', C.LINE1, 'KD_K'),
      line('KD_D', C.LINE2, 'KD_D'),
      line('enewD', C.LINE3, 'enewD'),
    ],
  });

  add({
    id: 'KD_K2D2', name: 'KD_K2D2', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeK2D2(c, p.day, p.esp),
    outputs: [
      line('K2', C.LINE3, 'K2'),
      line('D2', C.LINE6, 'D2'),
    ],
  });

  add({
    id: 'KD_D2', name: 'KD_D2', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeKD_D2(c, p.day, p.esp),
    outputs: [
      line('D', C.LINE1, 'KD_D'),
      line('D2', C.LINE6, 'KD_D2'),
    ],
  });

  add({
    id: 'diffKD', name: 'diffKD', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeDiffKD(c, p.day, p.esp),
    outputs: [
      line('DiffKD', C.LINE1, 'DiffKD'),
      line('eDiffKD', C.LINE6, 'eDiffKD'),
    ],
  });

  add({
    id: 'StochasticOSC', name: 'Stochastic OSC', minBars: 9,
    params: [['K_day', 'Period', 9], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeStochasticOSC(c, p.K_day, p.esp),
    outputs: [
      line('KStochastic', C.LINE1, 'STOCH K'),
      line('StochasticOSC', C.LINE2, 'Stoch D'),
      line('eStochasticOSC', C.LINE6, 'eStoch D'),
    ],
  });

  add({
    id: 'WilliamR', name: 'William %R b', minBars: 10,
    params: [['WR_day', 'Period', 10]],
    math: (M, c, p) => M.computeWilliamR(c, p.WR_day),
    outputs: [line('WilliamR', C.LINE1)],
  });

  add({
    id: 'StochasticEMA', name: 'Stochastic EMA', minBars: 10,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeStochasticEMA(c, p.day),
    outputs: [
      line('K_EMA', C.LINE1, 'K_EMA'),
      line('D_EMA', C.LINE2, 'D_EMA'),
    ],
  });

  add({
    id: 'AdaptiveMACD', name: 'Adaptive MACD', minBars: 3,
    params: [['esp', 'Smooth', 5]],
    math: (M, c, p) => M.computeAdaptiveMACD(c, p.esp),
    outputs: [
      line('Adaptive_MACD', C.LINE1, 'Adaptive_MACD'),
      line('Signal', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'StochasticEMA_esp', name: 'Stocastic EMA)_esp', minBars: 3,
    params: [['esp', 'Smooth', 9], ['KD_num', 'KD Number', 10]],
    math: (M, c, p) => M.computeStochasticEMA_esp(c, p.esp, p.KD_num),
    outputs: [
      line('eK_EMA', C.LINE1, 'eK_EMA'),
      line('eD_EMA', C.LINE2, 'eD_EMA'),
    ],
  });
})();
