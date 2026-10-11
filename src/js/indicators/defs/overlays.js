/*
 * Price-chart indicators (placement 'chart') - the former OVERLAY_DEFS /
 * getOverlayData / addOverlayToChart code from stock-app.prod.js, now as
 * declarative registry entries. The Wang functions loop from index 1 but are
 * handed 0-based arrays, so src[i] belongs to bar i (shift 0) - see the
 * fix 2026-10-03 note at the moving averages below.
 */
(function () {
  'use strict';
  const { registry, util } = window.TFIndicators;
  const { column, aligned, call } = util;
  const HLC = (c) => [column(c, 'high'), column(c, 'low'), column(c, 'close')];

  const RESISTANCE = '#f87171';
  const SUPPORT = '#4ade80';

  const line = (key, color, extra = {}) => ({ key, color, lineWidth: 2, ...extra });
  const dashed = (key, color, extra = {}) => line(key, color, { lineStyle: 'dashed', ...extra });

  // ─── Moving averages ────────────────────────────────────────────────────
  registry.register({
    id: 'SMA', name: 'Simple Moving Average', shortName: 'SMA', category: 'Moving averages', placement: 'chart',
    params: [{ key: 'period', label: 'Length', default: 20, min: 1 }],
    outputs: [line('value', '#34d399')],
    // Prof. Wang's KingMA() - a plain array, value i belongs to bar i.
    compute: (c, p) => ({ value: aligned(c, call('KingMA', column(c, 'close'), p.period), 0) }),
  });
  registry.register({
    id: 'EMA', name: 'Exponential Moving Average', shortName: 'EMA', category: 'Moving averages', placement: 'chart',
    params: [{ key: 'period', label: 'Length', default: 9, min: 1 }],
    outputs: [line('value', '#a78bfa')],
    // Prof. Wang's KingEMA(): completeEMA is seeded with the SMA of the first `period` closes.
    compute: (c, p) => ({ value: aligned(c, (call('KingEMA', column(c, 'close'), p.period) || {}).completeEMA, 0) }),
  });
  registry.register({
    id: 'VWAP', name: 'VWAP', category: 'Moving averages', placement: 'chart',
    outputs: [line('value', '#22d3ee')],
    compute: (c) => {
      let tpv = 0, vol = 0;
      return {
        value: c.map(d => {
          tpv += ((d.high + d.low + d.close) / 3) * (d.volume || 0);
          vol += d.volume || 0;
          return vol > 0 ? tpv / vol : null;
        }),
      };
    },
  });

  // Single-line Wang moving averages:
  // [id, name, shortName, fn (or fallbacks), output field, inputs, shift, colour, default length]
  [
    ['KAMA', 'Adaptive MA (KAMA)', 'KAMA', 'AdaptiveMA', 'AdaptiveMA', 'hlc', 0, '#4ade80', 10],
    // DoubleEMA (fix 2026-09-26): was shift 1, which needed DEMA[STK_close.length] -
    // an index the function never fills (its main loop stops one short), so the
    // most recent bar always rendered blank. DEMA() is only ever called here with a
    // plain 0-based close array (no dummy at index 0), so DEMA[i] already belongs to
    // bar i - shift 0 is correct. (HullMA was checked on 2026-09-26 - see its entry below.)
    // KAMA, WVC, DonchianChannel, ChandelierExit and CKstop had the same mismatch
    // (fix 2026-10-03): each builds value i from candle i, so shift 1 drew the next
    // bar's value on every candle and left the last one blank. npm test now checks this.
    ['DoubleEMA', 'Double EMA (DEMA)', 'DEMA', ['DEMA', 'computeDEMA'], 'DEMA', 'close', 0, '#e879f9', 20],
    ['ZLEMA', 'Zero Lag EMA', 'ZLEMA', 'ZeroLagEMA', 'ZeroLag_EMA', 'hlc', 0, '#fb923c', 20],
    ['TEMA', 'Triple EMA', 'TEMA', 'TripleEMA', 'Triple_EMA', 'hlc', 0, '#facc15', 20],
    ['VIDYA', 'VIDYA', 'VIDYA', 'VariableIndexDynamicAvg', 'VIDYA', 'hlc', 0, '#2dd4bf', 10],
    ['MGD', 'McGinley Dynamic', 'McGinley', 'McGinleyDynamic', 'MGD', 'hlc', 0, '#f472b6', 10],
  ].forEach(([id, name, shortName, fn, field, inputs, shift, color, period]) => {
    const fnName = () => (Array.isArray(fn) ? fn.find(f => typeof window[f] === 'function') : fn);
    registry.register({
      id, name, shortName,
      category: 'Moving averages', placement: 'chart',
      params: [{ key: 'period', label: 'Length', default: period, min: 1 }],
      outputs: [line('value', color)],
      compute: (c, p) => {
        const args = inputs === 'hlc' ? HLC(c) : [column(c, 'close')];
        const out = call(fnName(), ...args, p.period);
        return { value: aligned(c, out && out[field], shift) };
      },
    });
  });

  // Prof. Wang's HullMA. His comment: "Normally drawing the STK_close[], HMA[],
  // eHMA[] figures in the K-Line area." It returns HMA and his smoothed eHMA, and
  // both are drawn - the single-line entry above used to draw HMA alone, through
  // computeHullMA() from Wang_design__HullMA _2026-01-18.js.
  // shift 0 was verified against the `values` array the function also returns, which
  // is the close it was handed: at shift 0 that matches the close on every one of 200
  // test bars, at shift 1 on none of them and the most recent bar renders blank.
  registry.register({
    id: 'HullMA', name: 'Hull MA', shortName: 'HMA',
    category: 'Moving averages', placement: 'chart',
    params: [
      { key: 'period', label: 'Length', default: 10, min: 1 },
      { key: 'esp', label: 'Smoothing', default: 9, min: 1 },
    ],
    outputs: [line('HMA', '#fbbf24'), line('eHMA', '#38bdf8', { lineWidth: 1 })],
    compute: (c, p) => {
      const out = call('HullMA', column(c, 'close'), Math.round(p.period), Math.round(p.esp)) || {};
      return { HMA: aligned(c, out.HMA, 0), eHMA: aligned(c, out.eHMA, 0) };
    },
  });
  // HullMA_KD's last comment: "Normally drawing the HMA[], eHMA[] figures in the
  // K-Line area." The function computes both, but used to return only the 0-100
  // HMA_KD_K / HMA_KD_D, so nothing could draw them; it now returns all four.
  // Split the same way as BollingerBandsNew, and named the same way round: the plain
  // name is the price-chart entry, the suffixed one is the pane ('HullMA_KD_KD' in
  // defs/wang.js, "HullMA_KD (K, D)"). The K/D have to stay in a pane - against a
  // price axis 0-100 values would be a flat line along the bottom. KD_num and alpha
  // only affect K/D, so this entry does not expose them.
  // HMA/eHMA here are identical to the 'HullMA' entry for the same day and esp -
  // HullMA_KD embeds the same Hull calculation.
  registry.register({
    id: 'HullMA_KD', name: 'HullMA_KD', shortName: 'HullMA_KD',
    category: 'Moving averages', placement: 'chart',
    params: [
      { key: 'day', label: 'Length', default: 10, min: 1 },
      { key: 'esp', label: 'Smoothing', default: 9, min: 1 },
    ],
    outputs: [line('HMA', '#fbbf24'), line('eHMA', '#38bdf8', { lineWidth: 1 })],
    compute: (c, p) => {
      const out = call('HullMA_KD', column(c, 'close'), Math.round(p.day), Math.round(p.esp), 9, 50) || {};
      return { HMA: aligned(c, out.HMA, 0), eHMA: aligned(c, out.eHMA, 0) };
    },
  });
  // Prof. Wang's 2026-09-18 redesign of DEMA: the same 2*EMA - EMA(EMA), but over
  // the Typical Price (H+L+4C)/6 instead of the close, plus his smoothed eDEMA.
  // Separate from 'DoubleEMA' above, which is the close-based one.
  registry.register({
    id: 'DEMA2', name: 'DEMA2', shortName: 'DEMA2',
    category: 'Moving averages', placement: 'chart',
    params: [{ key: 'esp', label: 'Smoothing', default: 9, min: 1 }],
    outputs: [line('DEMA', '#f472b6'), line('eDEMA', '#38bdf8', { lineWidth: 1 })],
    compute: (c, p) => {
      const out = call('DEMA2', ...HLC(c), Math.round(p.esp)) || {};
      return { DEMA: aligned(c, out.DEMA, 0), eDEMA: aligned(c, out.eDEMA, 0) };
    },
  });

  // Guppy: EMA1-5 short-term group, EMA6-10 long-term group, plus each group's average.
  registry.register({
    id: 'GuppyMA', name: 'Guppy Multiple MA', shortName: 'Guppy', category: 'Moving averages', placement: 'chart',
    params: [{ key: 'num', label: 'Base length', default: 5, min: 1 }],
    outputs: [
      ...['EMA1', 'EMA2', 'EMA3', 'EMA4', 'EMA5'].map(key => ({ key, color: '#38bdf8', lineWidth: 1, lastValue: false })),
      ...['EMA6', 'EMA7', 'EMA8', 'EMA9', 'EMA10'].map(key => ({ key, color: '#f97316', lineWidth: 1, lastValue: false })),
      { key: 'short_EMA', title: 'Short avg', color: '#e0f2fe', lineWidth: 1, lineStyle: 'dashed' },
      { key: 'long_EMA', title: 'Long avg', color: '#ffedd5', lineWidth: 1, lineStyle: 'dashed' },
    ],
    compute: (c, p) => {
      const out = call('GuppyMA', ...HLC(c), Math.round(p.num)) || {};
      return Object.fromEntries(Object.keys(out).map(k => [k, aligned(c, out[k])]));
    },
  });

  // Prof. Wang's NewEMA (2026-September): the EMA is taken of the MA instead
  // of the closes, and is drawn together with that MA ("K_Line area").
  registry.register({
    id: 'NewEMA', name: 'NewEMA (EMA of MA)', shortName: 'NewEMA', category: 'Moving averages', placement: 'chart',
    params: [{ key: 'ma_day', label: 'MA length', default: 10, min: 1 }, { key: 'esp', label: 'Smoothing', default: 9, min: 1 }],
    outputs: [line('MA', '#94a3b8', { title: 'MA', lineWidth: 1 }), line('NewEMA', '#38bdf8', { title: 'NewEMA' })],
    compute: (c, p) => {
      const out = call('NewEMA', column(c, 'close'), Math.round(p.ma_day), Math.round(p.esp)) || {};
      return { MA: aligned(c, out.MA), NewEMA: aligned(c, out.NewEMA) };
    },
  });

  // ─── Bands & channels ───────────────────────────────────────────────────
  registry.register({
    id: 'BB', name: 'Bollinger Bands', shortName: 'BB', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'period', label: 'Length', default: 20, min: 2 }, { key: 'mult', label: 'Std dev', default: 2, min: 0.1, step: 0.1 }],
    outputs: [dashed('upper', '#94a3b8', { title: 'Upper' }), line('middle', '#94a3b8', { title: 'Basis' }), dashed('lower', '#94a3b8', { title: 'Lower' })],
    // Prof. Wang's BollingerBands() always draws 2 SD; his SD is recovered from (upper - MA) / 2
    // so the Std dev setting still applies.
    compute: (c, p) => {
      const out = call('BollingerBands', column(c, 'close'), p.period, p.period) || {};
      const middle = aligned(c, out.MA, 0);
      const sd = aligned(c, out.upperBand, 0).map((u, i) => (u != null && middle[i] != null ? (u - middle[i]) / 2 : null));
      return {
        upper: middle.map((m, i) => (m != null && sd[i] != null ? m + p.mult * sd[i] : null)),
        middle,
        lower: middle.map((m, i) => (m != null && sd[i] != null ? m - p.mult * sd[i] : null)),
      };
    },
  });
  registry.register({
    id: 'WVC', name: 'Williams Volatility Channel', shortName: 'WVC', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'day', label: 'Days', default: 10, min: 1 }, { key: 'esp', label: 'Smoothing', default: 9, min: 1 }],
    outputs: [dashed('upper', RESISTANCE, { title: 'Upper' }), line('middle', '#38bdf8', { title: 'Middle' }), dashed('lower', SUPPORT, { title: 'Lower' })],
    compute: (c, p) => {
      const out = call('WilliamsVolatilityChannel', ...HLC(c), p.day, p.esp) || {};
      return { upper: aligned(c, out.UpperLine, 0), middle: aligned(c, out.MiddleLine, 0), lower: aligned(c, out.LowerLine, 0) };
    },
  });
  registry.register({
    id: 'BOLL4SD', name: 'Bollinger 4SD', shortName: 'B4SD', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'ma', label: 'MA length', default: 10, min: 1 }, { key: 'sd', label: 'SD length', default: 20, min: 1 }],
    outputs: [dashed('upper', '#c084fc', { title: 'Upper' }), line('middle', '#c084fc', { title: 'MA' }), dashed('lower', '#c084fc', { title: 'Lower' })],
    compute: (c, p) => {
      const out = call('computeBollinger4SD', column(c, 'close'), p.ma, p.sd) || {};
      return { upper: aligned(c, out.upperBand), middle: aligned(c, out.MA), lower: aligned(c, out.lowerBand) };
    },
  });
  registry.register({
    id: 'BollingerNew', name: 'Bollinger New', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'ma', label: 'MA length', default: 10, min: 2 }],
    outputs: [dashed('upperBand', '#fb7185', { title: 'Upper', lineWidth: 1 }), line('MA', '#fb7185', { title: 'MA', lineWidth: 1 }), dashed('lowerBand', '#fb7185', { title: 'Lower', lineWidth: 1 })],
    compute: (c, p) => {
      const out = call('BollingerBandsNew', column(c, 'close'), Math.round(p.ma)) || {};
      return { upperBand: aligned(c, out.upperBand), MA: aligned(c, out.MA), lowerBand: aligned(c, out.lowerBand) };
    },
  });
  registry.register({
    id: 'PrimeNumberBands', name: 'Prime Number Bands', shortName: 'PNB', category: 'Bands & channels', placement: 'chart',
    outputs: [dashed('upper_PNB', '#2dd4bf', { title: 'Upper', lineWidth: 1 }), line('middle_PNB', '#2dd4bf', { title: 'Middle', lineWidth: 1 }), dashed('lower_PNB', '#2dd4bf', { title: 'Lower', lineWidth: 1 })],
    compute: (c) => {
      const out = call('PrimeNumberBands', ...HLC(c)) || {};
      return { upper_PNB: aligned(c, out.upper_PNB), middle_PNB: aligned(c, out.middle_PNB), lower_PNB: aligned(c, out.lower_PNB) };
    },
  });
  registry.register({
    id: 'DonchianChannel', name: 'Donchian Channel', shortName: 'DC', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'period', label: 'Length', default: 20, min: 1 }],
    outputs: [dashed('upper', '#60a5fa', { title: 'Upper' }), line('middle', '#60a5fa', { title: 'Middle' }), dashed('lower', '#60a5fa', { title: 'Lower' })],
    compute: (c, p) => {
      const out = call('DonchianChannel', column(c, 'high'), column(c, 'low'), p.period) || {};
      return { upper: aligned(c, out.UpperChannel, 0), middle: aligned(c, out.MiddleChannel, 0), lower: aligned(c, out.LowerChannel, 0) };
    },
  });
  registry.register({
    id: 'ChandelierExit', name: 'Chandelier Exit', shortName: 'Chandelier', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'period', label: 'Length', default: 20, min: 1 }],
    outputs: [line('long', SUPPORT, { title: 'Long' }), line('short', RESISTANCE, { title: 'Short' })],
    compute: (c, p) => {
      const out = call('ChandelierExit', ...HLC(c), p.period) || {};
      return { long: aligned(c, out.Long_ChandelierExit, 0), short: aligned(c, out.Short_ChandelierExit, 0) };
    },
  });
  registry.register({
    id: 'CKstop', name: 'Chande Kroll Stop', shortName: 'CK Stop', category: 'Bands & channels', placement: 'chart',
    params: [{ key: 'period', label: 'Length', default: 10, min: 1 }],
    outputs: [line('long', SUPPORT, { title: 'Long' }), line('short', RESISTANCE, { title: 'Short' })],
    compute: (c, p) => {
      const out = call('CKstop', ...HLC(c), p.period) || {};
      return { long: aligned(c, out.CKS_Long, 0), short: aligned(c, out.CKS_Short, 0) };
    },
  });
  registry.register({
    id: 'FCB', name: 'Fractal Chaos Bands', shortName: 'FCB', category: 'Bands & channels', placement: 'chart',
    outputs: [dashed('high', RESISTANCE, { title: 'High', lineWidth: 1 }), dashed('low', SUPPORT, { title: 'Low', lineWidth: 1 })],
    compute: (c) => {
      const out = call('FractalChaosBands', column(c, 'high'), column(c, 'low')) || {};
      return { high: aligned(c, out.Fractal_High), low: aligned(c, out.Fractal_Low) };
    },
  });

  // ─── Pivots ─────────────────────────────────────────────────────────────
  // Lines are keyed by the Wang function's own output names. Level 1 and the
  // pivot are solid, further levels dashed; the axis label carries the key.
  function pivotOutputs(lines, pivotColor) {
    return lines.map(([key, role, opts = {}]) => ({
      key,
      color: opts.color || (role === 'resistance' ? RESISTANCE : role === 'support' ? SUPPORT : pivotColor),
      lineWidth: 1,
      lineStyle: (opts.dashed != null ? opts.dashed : !(key.endsWith('1') || role === 'pivot')) ? 'dashed' : 'solid',
      axisTitle: true,
    }));
  }
  function registerPivot(id, name, fnName, lines, color, extra = {}) {
    registry.register({
      id, name, category: 'Pivots', placement: 'chart',
      outputs: pivotOutputs(lines, color),
      compute: (c, p) => {
        const inputs = extra.withOpen ? [column(c, 'open'), ...HLC(c)] : HLC(c);
        const out = call(fnName, ...inputs, ...(extra.args ? extra.args(p) : [])) || {};
        return Object.fromEntries(lines.map(([key]) => [key, aligned(c, out[key])]));
      },
      ...(extra.params ? { params: extra.params } : {}),
    });
  }
  const R = (n) => [`Resistance${n}`, 'resistance'];
  const S = (n) => [`Support${n}`, 'support'];
  registerPivot('PivotClassic', 'Pivot Points Classic', 'PivotPointsClassic', [R(3), R(2), R(1), S(1), S(2), S(3)], '#60a5fa');
  registerPivot('PivotWoodie', 'Pivot Points Woodie', 'PivotPointsWoodie', [R(2), R(1), S(1), S(2)], '#a78bfa');
  registerPivot('PivotFibonacci', 'Pivot Points Fibonacci', 'PivotPointsFibonacci', [R(3), R(2), R(1), S(1), S(2), S(3)], '#fbbf24');
  registerPivot('PivotCamarilla', 'Pivot Points Camarilla', 'PivotPointsCamarilla',
    [['Resist4', 'resistance'], ['Resist3', 'resistance'], ['Resist2', 'resistance'], ['Resist1', 'resistance'], S(1), S(2), S(3), S(4)], '#34d399');
  registerPivot('PivotDeMark', 'Pivot Points DeMark', 'PivotPointsDeMark', [R(1), ['PivotPoints', 'pivot'], S(1)], '#c084fc', { withOpen: true });
  // Prof. Wang bundle functions whose comments say "drawing ... in the K_Line area".
  registerPivot('PIVG', 'PIVG Pivots', 'PIVG',
    [['R3', 'resistance'], ['R2', 'resistance'], ['R1', 'resistance'], ['TC', 'pivot', { dashed: true }], ['Pivot', 'pivot'], ['BC', 'pivot', { dashed: true }], ['S1', 'support'], ['S2', 'support'], ['S3', 'support']], '#f472b6');
  registerPivot('MIKE', 'MIKE Pivots', 'MIKE',
    [['SR', 'resistance'], ['MR', 'resistance'], ['WR', 'resistance', { dashed: false }], ['WS', 'support', { dashed: false }], ['MS', 'support'], ['SS', 'support']], '#94a3b8',
    { args: (p) => [Math.round(p.day)], params: [{ key: 'day', label: 'Days', default: 10, min: 1 }] });

  // Old OVERLAY_DEFS ids -> [new id, first param key, second param key, colour]
  // for migrating saved overlay selections (stock_overlays_v2).
  window.TFIndicators.LEGACY_OVERLAY_IDS = {
    SMA20: ['SMA', 'period', null, '#34d399'], SMA200: ['SMA', 'period', null, '#f97316'],
    EMA9: ['EMA', 'period', null, '#a78bfa'], EMA55: ['EMA', 'period', null, '#fb7185'],
    BB20: ['BB', 'period'], VWAP: ['VWAP'], KAMA: ['KAMA', 'period'], HullMA: ['HullMA', 'period'],
    DEMA20: ['DoubleEMA', 'period'], ZLEMA: ['ZLEMA', 'period'], TEMA: ['TEMA', 'period'],
    VIDYA: ['VIDYA', 'period'], MGD: ['MGD', 'period'], WVC: ['WVC', 'day', 'esp'], BOLL4SD: ['BOLL4SD', 'ma', 'sd'],
    CKstop: ['CKstop', 'period'], DonchianChannel: ['DonchianChannel', 'period'], ChandelierExit: ['ChandelierExit', 'period'],
    FCB: ['FCB'], PivotClassic: ['PivotClassic'], PivotWoodie: ['PivotWoodie'], PivotFibonacci: ['PivotFibonacci'],
    PivotCamarilla: ['PivotCamarilla'], PivotDeMark: ['PivotDeMark'], PIVG: ['PIVG'], MIKE: ['MIKE', 'day'],
    PrimeNumberBands: ['PrimeNumberBands'], BollingerNew: ['BollingerNew', 'ma'], GuppyMA: ['GuppyMA', 'num'],
  };
})();
