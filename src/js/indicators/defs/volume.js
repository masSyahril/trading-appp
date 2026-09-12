/*
 * Volume pane indicators, converted from the MultiIndicatorSystem
 * definitions in multi-indicator-system.js. `math` calls the same compute
 * method as before - the crypto-trading page's panels still use it, so each
 * formula lives in one place - and `outputs`, `levels` and `stats` say what
 * the old render() and panel legend drew.
 */
(function () {
  'use strict';
  const { registry, util, palette: C, outputs: { line, hist } } = window.TFIndicators;

  // math(M, candles, params) runs the shared MultiIndicatorSystem compute method.
  const add = ({ math, ...entry }) => registry.register({
    category: 'Volume',
    placement: 'pane',
    ...entry,
    compute: (candles, params) => {
      const M = util.math();
      M.chartData = candles;
      return math(M, candles, params);
    },
  });

  add({
    id: 'VOLUME', name: 'Volume',
    params: [['maPeriod', 'MA Period', 20]],
    math: (M, c, p) => ({ ...M.computeVolume(c, p), dir: c.map(d => (d.close >= d.open ? C.UP : C.DOWN)) }),
    outputs: [
      hist('volume', { title: 'Vol', from: 'volumes', colorKey: 'dir', color: C.VOLUME, priceFormat: { type: 'volume' } }),
      line('volma', C.LINE1, 'MA', { from: 'volMA', priceFormat: { type: 'volume' } }),
    ],
  });

  add({
    id: 'OBV', name: 'On Balance Volume',
    math: (M, c, p) => M.computeOBV(c),
    outputs: [line('obv', C.LINE1, null, { from: 'value' })],
  });

  add({
    id: 'ADO', name: 'ADO (Accumulation/Distribution)',
    math: (M, c, p) => M.computeADOIndicator(c),
    outputs: [line('ado', C.LINE1)],
    levels: [{ value: 50 }],
  });

  add({
    id: 'ADI', name: 'ADI (Accum/Dist Impulse)', minBars: 2,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeADIIndicator(c, p.period),
    outputs: [
      line('adi', C.LINE1, 'ADI'),
      line('adis', C.LINE2, 'ADIS'),
    ],
  });

  add({
    id: 'VAO', name: 'VAO (Volume Osc)',
    math: (M, c, p) => M.computeVAOIndicator(c),
    outputs: [line('vao', C.LINE1)],
  });

  add({
    id: 'MFI', name: 'Money Flow Index', minBars: 14,
    params: [['period', 'Period', 14]],
    math: (M, c, p) => M.computeMFI(c, p.period),
    outputs: [line('mfi', C.LINE1, null, { from: 'value' })],
    levels: [{ value: 80, color: C.LINE2 }, { value: 20, color: C.LINE3 }],
  });

  add({
    id: 'VR', name: 'VR (Volume Ratio)', minBars: 5,
    params: [['period', 'Period', 26], ['esp', 'Smooth', 10]],
    math: (M, c, p) => M.computeVRIndicator(c, p.period, p.esp),
    outputs: [
      line('vr', C.LINE1, 'VR'),
      line('vrs', C.LINE2, 'VRS'),
    ],
  });

  add({
    id: 'OBV_ALT', name: 'OBV (On-Balance Volume Alt)',
    math: (M, c, p) => M.computeOBVIndicator(c),
    outputs: [
      line('obv', C.LINE1, 'OBV', { from: 'OBV' }),
      line('eobv', C.LINE2, 'eOBV', { from: 'eOBV' }),
    ],
  });

  add({
    id: 'WAD', name: 'WAD (Williams A/D)',
    math: (M, c, p) => M.computeWADIndicator(c),
    outputs: [
      line('wad', C.LINE1, 'WAD', { from: 'WAD' }),
      line('ewad', C.LINE2, 'eWAD', { from: 'eWAD' }),
    ],
  });

  add({
    id: 'VROC', name: 'VROC (Volume ROC)', minBars: 10,
    params: [['day1', 'Period 1', 10], ['day2', 'Period 2', 20]],
    math: (M, c, p) => M.computeVROCIndicator(c, p.day1, p.day2),
    outputs: [
      line('vroc1', C.LINE1, 'VROC1', { from: 'VROC1' }),
      line('vroc2', C.LINE2, 'VROC2', { from: 'VROC2' }),
    ],
  });

  add({
    id: 'EOM', name: 'EOM (Ease of Movement)', minBars: 2,
    math: (M, c, p) => M.computeEOMIndicator(c),
    outputs: [
      line('eom', C.LINE1, 'EOM', { from: 'EOM' }),
      line('eeom', C.LINE2, 'eEOM', { from: 'eEOM' }),
    ],
  });

  add({
    id: 'PVT', name: 'PVT (Price Volume Trend)',
    math: (M, c, p) => M.computePVTIndicator(c),
    outputs: [
      line('pvt', C.LINE1, 'PVT', { from: 'PVT' }),
      line('epvt', C.LINE2, 'ePVT', { from: 'ePVT' }),
    ],
  });

  add({
    id: 'VOLMA', name: 'VolMA (Volume Moving Average)', minBars: 2,
    params: [['period', 'Period', 20]],
    math: (M, c, p) => M.computeVolMAIndicator(c, p.period),
    outputs: [line('volma', C.LINE1)],
  });

  add({
    id: 'PVIpercentRiseFall', name: 'PVIpercentRiseFall (Percent Rise Fall)', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'esp', 10]],
    math: (M, c, p) => M.computePVIpercentRiseFallIndicator(c, p.day, p.esp),
    outputs: [
      line('line1', C.LINE1, 'PVI'),
      line('line2', C.LINE2, 'ePVI'),
    ],
  });

  add({
    id: 'DVO', name: 'DVO (Detrended Volume Osc)', minBars: 10,
    params: [['day', 'smooth Day', 10], ['m', 'M', 9]],
    math: (M, c, p) => M.computeDVOIndicator(c, p.day, p.m),
    outputs: [line('percentil', C.LINE1)],
  });

  add({
    id: 'VolumeZoneOsc', name: 'Volume Zone Oscillator', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeVolumeZoneOscillator(c, p.day, p.esp),
    outputs: [line('VolZoneOsc', C.LINE1)],
  });

  add({
    id: 'VolumeFlowIndicator', name: 'Volume Flow Indicator', minBars: 10,
    params: [['day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeVolumeFlowIndicator(c, p.day, p.esp),
    outputs: [
      line('VolFlowIndicator', C.LINE1, 'VFI'),
      line('eVolFlowIndicator', C.LINE2, 'eVFI'),
    ],
  });

  add({
    id: 'AccuDistLine', name: 'Accum Dist Line', minBars: 2,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeAccuDistLine(c, p.esp),
    outputs: [
      line('ADL', C.LINE1, 'Accum Dist'),
      line('eADL', C.LINE2, 'Signal'),
    ],
  });

  add({
    id: 'WaveVolume', name: 'Wave Volume', minBars: 2,
    math: (M, c, p) => M.computeWaveVolume(c),
    outputs: [line('WaveVol', C.LINE1)],
  });

  add({
    id: 'TimeSegVol', name: 'Time Segmented Vol', minBars: 11,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeTimeSegVol(c, p.day),
    outputs: [line('TimeSegVol', C.LINE1)],
  });

  add({
    id: 'TimeSegVolTP', name: 'Time Seg Vol (TP)', minBars: 11,
    params: [['day', 'Period', 10]],
    math: (M, c, p) => M.computeTimeSegVolTP(c, p.day),
    outputs: [line('TimeSegVol_TP', C.LINE1)],
  });

  add({
    id: 'NVR', name: 'NVR (Normalized Volume Ratio)', minBars: 10,
    params: [['KD_day', 'Period', 10], ['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeNVR(c, p.KD_day, p.esp),
    outputs: [
      line('NVR', C.LINE1, 'NVR'),
      line('eNVR', C.LINE6, 'eNVR'),
    ],
  });

  add({
    id: 'VolAccuDistOsc', name: 'Vol Accu Dist Osc', minBars: 10,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeVolAccuDistOsc(c, p.esp),
    outputs: [
      line('VolAccuDistOsc', C.LINE1, 'VolAccuDistOsc'),
      line('eVolAccuDistOsc', C.LINE6, 'eVolAccuDistOsc'),
    ],
  });

  add({
    id: 'HighLowOsc', name: 'High and Low OSCillator', minBars: 10,
    params: [['esp', 'Smooth', 9]],
    math: (M, c, p) => M.computeHighLowOsc(c, p.esp),
    outputs: [
      line('HLO', C.LINE1, 'HLO'),
      line('eHLO', C.LINE6, 'eHLO'),
    ],
  });
})();
