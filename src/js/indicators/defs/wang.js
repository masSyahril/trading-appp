/*
 * Prof. Wang's pane indicators from technical-indicators.prods__Wang__2026.js -
 * the functions whose comments say "drawing ... in the small windows". They
 * differ only in which window.<fn> they call and which of its returned arrays
 * they draw, so each is one row here, turned into a registry entry below.
 *   fn          window.<fn> to call
 *   inputs      candle fields passed first, in the function's argument order
 *   params      the remaining arguments in order: [name, default, fractional?]
 *               (non-fractional ones are day counts and get rounded)
 *   lines       returned arrays drawn as lines; `titles` renames any in the legend
 *   histogram   returned array drawn as bars (coloured by `colorKey`'s
 *               "Green"/"Red"/"Blue" per bar if given, else by sign)
 *   withClose   also draw the close price - for the price-scale indicators whose
 *               comment says to draw them together with STK_close
 *   volumeScale axis shows K/M/B (values in the millions)
 *   precision   decimals on the axis, for very small values
 *   minPeriod   fewest candles to draw on (default: the largest day count)
 * The Wang functions loop from index 1 but are handed 0-based arrays, so
 * out[i] belongs to bar i - no shift.
 *
 * multi-indicator-system.js keeps its own copy of this table
 * (WANG_PANEL_INDICATORS) for the crypto-trading page, which still uses the
 * old panels - a row added here only reaches the stock pages.
 */
(function () {
  'use strict';
  const { registry, palette: C } = window.TFIndicators;

  const TABLE = {
    KD_K2:                   { name: 'KD_K2', type: 'oscillator', fn: 'KD_K2', inputs: ['high', 'low', 'close'], params: [['KD_day', 9], ['esp', 9]], lines: ['KD_K', 'KD_K2'] },
    VariantRateMA2DaysAgo:   { name: 'VariantRateMA2DaysAgo', type: 'momentum', fn: 'VariantRateMA2DaysAgo', inputs: ['close'], params: [['day1', 5], ['day2', 10]], lines: ['VarRtMA2DaysAgo1', 'VarRtMA2DaysAgo2'] },
    MAPVT:                   { name: 'MAPVT', type: 'volume', fn: 'MAPriceVolumTrend', inputs: ['close', 'volume'], params: [['ma_day', 10], ['esp', 9]], lines: ['MAPVT', 'eMAPVT'], volumeScale: true },
    CumulativeVolume:        { name: 'Cumulative Volume(CV)', type: 'volume', fn: 'CumulativeVolume', inputs: ['close', 'volume'], params: [['esp', 9]], lines: ['CumuVol', 'eCumuVol'], volumeScale: true },
    NewCumulativeVolume:     { name: 'New Cumulative Volume', type: 'volume', fn: 'NewCumulativeVolume', inputs: ['close', 'volume'], params: [['ma_day', 10], ['esp', 9]], lines: ['MACumuVol', 'eMACumuVol'], volumeScale: true },
    // MASS's EMA1/EMA2 are marked for the K_Line area, but they're averages of
    // (High-Low) - a few points, not a price - so only Mass/eMass are drawn.
    MASS:                    { name: 'MASS Index', type: 'volatility', fn: 'MASS', inputs: ['high', 'low'], params: [['esp', 9]], lines: ['Mass', 'eMass'] },
    PriceOSC:                { name: 'Price Oscillator', type: 'oscillator', fn: 'PriceOSC', inputs: ['close'], params: [['short_day', 5], ['long_day', 10], ['esp', 9]], lines: ['PriceOSC', 'ePriceOSC'] },
    VolumeOSC:               { name: 'Volume Oscillator', type: 'volume', fn: 'VolumeOSC', inputs: ['volume'], params: [['short_day', 5], ['long_day', 10], ['esp', 9]], lines: ['VolOSC', 'eVolOSC'] },
    ChaikinOSC:              { name: 'ChaikinOSC', type: 'volume', fn: 'ChaikinOSC', inputs: ['high', 'low', 'close', 'volume'], params: [['short_day', 5], ['long_day', 10], ['esp', 9]], lines: ['ChaikinOSC', 'eChaikinOSC'], volumeScale: true },
    ChaikinVolatility:       { name: 'Chaikin Volatility', type: 'volatility', fn: 'ChaikinVolatility', inputs: ['high', 'low'], params: [['N_days_ago', 10], ['esp', 9]], lines: ['ChaikinVolatility', 'eChaikinVolatility'] },
    ChaikinVolatilityMaxMin: { name: 'Chaikin Volatility MaxMin', type: 'volatility', fn: 'ChaikinVolatilityMaxMin', inputs: ['high', 'low'], params: [['N_days', 10]], lines: ['ChaikinVolatility', 'eChaikinVolatility'] },
    ChaikinMoneyFlow:        { name: 'Chaikin Money Flow(CMF)', type: 'volume', fn: 'ChaikinMoneyFlow', inputs: ['high', 'low', 'close', 'volume'], params: [['day', 20], ['esp', 9]], lines: ['CMF', 'eCMF'] },
    ASI:                     { name: 'Accumulation Swing Index(ASI)', type: 'trend', fn: 'ASI', inputs: ['open', 'high', 'low', 'close'], params: [['ma_day', 10], ['esp', 9]], lines: ['ASI', 'ASIma', 'eASIma'] },
    TRIX:                    { name: 'TRIX', type: 'momentum', fn: 'TRIX', inputs: ['close'], params: [['esp', 9]], lines: ['TRIX', 'eTRIX'] },
    M4:                      { name: 'M4', type: 'oscillator', fn: 'M4', inputs: ['close'], params: [['esp', 9]], lines: ['M4', 'eM4'], minPeriod: 20 },
    GannHiLo:                { name: 'Gann HiLo', type: 'trend', fn: 'GannHiLo', inputs: ['high', 'low', 'close'], params: [['ma_day', 10]], lines: ['K_Close', 'MA_High_Low'] },
    NewMACD:                 { name: 'NewMACD', type: 'oscillator', fn: 'MAmacd', inputs: ['close'], params: [['ma_day1', 10], ['ma_day2', 20], ['esp', 9]], lines: ['DIF', 'MAmacd'], histogram: 'BarChart' },
    VariantMA:               { name: 'Variant MA', type: 'trend', fn: 'VariantMA', inputs: ['close'], params: [['ma_day', 10], ['alpha', 5], ['esp', 9]], lines: ['values', 'VariantMA', 'eVariantMA'], titles: { values: 'Close' } },
    T3MA:                    { name: 'T3MA', type: 'trend', fn: 'T3MA', inputs: ['close'], params: [['esp', 9], ['va', 0.7, true]], lines: ['T1', 'T2', 'T3'] },
    ZeroLagMACD:             { name: 'ZeroLagMACD', type: 'oscillator', fn: 'ZeroLagMACD', inputs: ['close'], params: [['n12', 12], ['n24', 24], ['n9', 9]], lines: ['ZeroLagMACD', 'Zero_Lag_Signal_Line'] },
    PSY:                     { name: 'PSY', type: 'oscillator', fn: 'PSY', inputs: ['close'], params: [['psy_n', 10], ['esp', 9]], lines: ['PSY', 'ePSY'] },
    VolAccPct:               { name: 'VolAccPct', type: 'volume', fn: 'VolAccPct', inputs: ['high', 'low', 'close', 'volume'], params: [['period', 10], ['esp', 9]], lines: ['VolAccPct', 'eVolAccPct'] },
    FourVolLine:             { name: 'FourVolLine', type: 'volume', fn: 'FourVolLine', inputs: ['volume'], params: [['n1', 5], ['n2', 10], ['n3', 15], ['n4', 20], ['esp', 9]], lines: ['FourVolLine', 'eFourVolLine'], volumeScale: true },
    VolMaRoc:                { name: 'VolMaRoc', type: 'volume', fn: 'VolMaRoc', inputs: ['volume'], params: [['roc_length', 10], ['ma_day', 5]], lines: ['VolMaRoc'], minPeriod: 15 },
    WilliamVolConDiv:        { name: 'WilliamVolConDiv', type: 'volume', fn: 'WilliamVolConDiv', inputs: ['high', 'low', 'close', 'volume'], params: [['WR_day', 10]], lines: ['WilliamVolConDiv'], volumeScale: true },
    WilliamVarAccuDist:      { name: 'WilliamVarAccuDist', type: 'volume', fn: 'WilliamVarAccuDist', inputs: ['open', 'high', 'low', 'close', 'volume'], params: [['WR_day', 10], ['esp', 9]], lines: ['WilliamVarAccuDist', 'eWilliamVarAccuDist'], volumeScale: true },
    VolumeKD:                { name: 'VolumeKD', type: 'volume', fn: 'VolumeKD', inputs: ['volume'], params: [['KD_day', 9], ['esp', 9]], lines: ['Vol_K', 'Vol_D', 'Vol_K2', 'Vol_D2'] },
    MarketFI:                { name: 'MarketFI(MFI)', type: 'volume', fn: 'MarketFacilitation', inputs: ['high', 'low', 'volume'], params: [['esp', 9]], lines: ['MFI', 'eMFI'], precision: 8 },
    NewMarketFI:             { name: 'New MarketFI', type: 'volume', fn: 'NewMarketFacilitation', inputs: ['high', 'low', 'volume'], params: [['esp', 9]], lines: ['NewMFI', 'eNewMFI'] },
    PriVolRiFaPtMu:          { name: 'PriVolRiFaPtMu', type: 'volume', fn: 'PriVolRiFaPtMu', inputs: ['close', 'volume'], params: [['esp', 9]], lines: ['PriVolRFPM', 'ePriVolRFPM'] },
    PriVolRiFaPtSum:         { name: 'PriVolRiseFallPctSum', type: 'volume', fn: 'PriVolRiFaPtSum', inputs: ['close', 'volume'], params: [], lines: ['PriRiseFallPct', 'VolRiseFallPct', 'PriVolRiseFallPctSum'] },
    VolWgtAvgPrice:          { name: 'VolWgtAvgPrice', type: 'volume', fn: 'VolWgtAvgPrice', inputs: ['high', 'low', 'close', 'volume'], params: [['period', 10], ['esp', 9]], lines: ['VolWgtAvgPrice', 'eVolWgtAvgPrice'] },
    CDP:                     { name: 'CDP', type: 'trend', fn: 'CDP', inputs: ['high', 'low', 'close'], params: [], lines: ['AH', 'NH', 'CDP', 'NL', 'AL', 'Support', 'Pressure'] },
    GatorOsc:                { name: 'Gator Osc', type: 'oscillator', fn: 'GatorOscillator', inputs: ['high', 'low'], params: [], lines: [], histogram: 'Gator' },
    PVIRiseFall:             { name: 'PVIRiseFall', type: 'volume', fn: 'PVIRiseFall', inputs: ['close', 'volume'], params: [['day', 10], ['esp', 9]], lines: ['PVIRiseFall', 'ePVIRiseFall'] },
    RSIKD:                   { name: 'RSIKD', type: 'oscillator', fn: 'RSIKD', inputs: ['close'], params: [['KD_day', 9], ['RSI_day', 10]], lines: ['RSIKD_K', 'RSIKD_D'], minPeriod: 19 },
    newRSIKD:                { name: 'newRSIKD', type: 'oscillator', fn: 'newRSIKD', inputs: ['close'], params: [['KD_day', 9], ['RSI_day', 10], ['esp', 9]], lines: ['newRSIKD_K', 'newRSIKD_D'], minPeriod: 19 },
    KeltnerChannels:         { name: 'Keltner Channels', type: 'volatility', fn: 'KeltnerChannels', inputs: ['high', 'low', 'close'], params: [['esp1', 10]], lines: ['upperEMA', 'middleEMA', 'lowerEMA'], withClose: true },
    ChandeMomOsc:            { name: 'ChandeMomOsc', type: 'momentum', fn: 'ChandeMomOsc', inputs: ['close'], params: [['day', 10], ['esp', 9]], lines: ['CMO', 'eCMO'] },
    Arms_TRIN:               { name: 'Arms_TRIN', type: 'volume', fn: 'Arms_TRIN', inputs: ['close', 'volume'], params: [['day', 10], ['esp', 9]], lines: ['Arms', 'eArms'] },
    AvgRFR_FI:               { name: 'AvgRFR_FI', type: 'volume', fn: 'AvgRiseFallRatioFI', inputs: ['close', 'volume'], params: [['day', 10], ['esp', 9]], lines: ['AvgRiseFallRatioFI', 'eAvgRiseFallRatioFI'] },
    PriceDifCOG:             { name: 'PriceDifCOG', type: 'momentum', fn: 'PriceDifCOG', inputs: ['close'], params: [['day', 10], ['esp', 9]], lines: ['PriceDifCOG', 'ePriceDifCOG'] },
    TDI:                     { name: 'TDI', type: 'momentum', fn: 'TDI', inputs: ['close'], params: [['RSI_day', 13]], lines: ['RSI', 'MBL', 'Upper', 'Lower'], minPeriod: 34 },
    MA_ER:                   { name: 'MA Efficiency Ratio', type: 'trend', fn: 'MAEfficiencyRatio', inputs: ['high', 'low', 'close'], params: [['MA_day', 10], ['ER_day', 10]], lines: ['MA_ER', 'eMA_ER'], minPeriod: 20 },
    PPO:                     { name: 'Pct Price Osc', type: 'oscillator', fn: 'PctPriceOSC', inputs: ['close'], params: [['short_day', 10], ['long_day', 20]], lines: ['PPO', 'ePPO'] },
    // The 10+2 Guppy EMAs go on the price chart (defs/overlays.js 'GuppyMA'); the Spread is this pane.
    GuppySpread:             { name: 'Guppy MA (Spread)', type: 'trend', fn: 'GuppyMA', inputs: ['high', 'low', 'close'], params: [['num', 5]], lines: ['Spread'], minPeriod: 10 },
    NewElderForce:           { name: 'New Elder Force', type: 'volume', fn: 'NewElderForce', inputs: ['high', 'low', 'close', 'volume'], params: [['esp', 10]], lines: ['NewEFI', 'eNewEFI', 'NewEFI2', 'eNewEFI2'] },
    ElderImpulse:            { name: 'Elder Impulse', type: 'momentum', fn: 'ElderImpulse', inputs: ['high', 'low', 'close'], params: [['n12', 12], ['n26', 26], ['n9', 9]], lines: ['MACD', 'Signal'], histogram: 'Histogram', colorKey: 'Color' },
    ZeroLagStochastics:      { name: 'Zero Lag Stochastics', type: 'oscillator', fn: 'ZeroLagStochastics', inputs: ['high', 'low', 'close'], params: [['KD_day', 9], ['esp', 9]], lines: ['finalK', 'finalD'], minPeriod: 25 },
    W_VixFix:                { name: 'W_VixFix', type: 'volatility', fn: 'WilliamsVixFix', inputs: ['high', 'low'], params: [['day_ago', 20], ['esp', 9]], lines: ['W_VixFix', 'eW_VixFix', 'Upper', 'Lower'], minPeriod: 29 },
    NewVixFix:               { name: 'New Vix Fix', type: 'volatility', fn: 'NewVixFix', inputs: ['high', 'low', 'close'], params: [['day_ago', 20], ['esp', 9]], lines: ['New_VixFix', 'eNew_VixFix', 'Upper', 'Lower'], minPeriod: 29 },
    ErgodicOsc:              { name: 'Ergodic Oscillator', type: 'momentum', fn: 'ErgodicOsc', inputs: ['close', 'volume'], params: [], lines: ['ErgodicOsc', 'Signal'], histogram: 'Histogram', minPeriod: 26 },
    TwiggsMoneyFlow:         { name: 'Twiggs Money Flow', type: 'volume', fn: 'TwiggsMoneyFw', inputs: ['high', 'low', 'close', 'volume'], params: [['esp', 20]], lines: ['TwiggsMoneyFlow'] },
    VolumeOSC_EMA:           { name: 'Volume Osc(EMA)', type: 'volume', fn: 'VolumeOSC_EMA', inputs: ['volume'], params: [['short_day', 10], ['long_day', 20], ['esp', 9]], lines: ['Vol_OSC_EMA', 'eVol_OSC_EMA'] },
    DisparityIndex:          { name: 'Disparity Index(Typical)', type: 'oscillator', fn: 'DisparityIndex', inputs: ['high', 'low', 'close'], params: [['ma_day', 10], ['esp', 9]], lines: ['Disparity', 'eDisparity'] },
    RSI_RollingCumulative:   { name: 'RSI RollingCumulative', type: 'momentum', fn: 'RSI_Rolling_Cumulative', inputs: ['close'], params: [['RSI_day', 10], ['period', 5]], lines: ['RSI', 'RSI_Rolling_Cumulative'], minPeriod: 15 },
    RSI_CumulativeMomentum:  { name: 'RSI CumulativeMomentum', type: 'momentum', fn: 'RSI_CumulativeMomentum', inputs: ['close'], params: [['RSI_day', 10]], lines: ['RSI', 'RSI_CumulMomet'] },
    // Bands go on the price chart (defs/overlays.js 'BollingerNew'); %B and Bandwith are this pane.
    BollingerNew_PctB:       { name: 'BollingerBands New (%B, Bandwith)', type: 'volatility', fn: 'BollingerBandsNew', inputs: ['close'], params: [['ma_day', 10]], lines: ['percentB', 'Bandwith'] },
    PFE:                     { name: 'Polarized(PFE)', type: 'trend', fn: 'PolarizedFractalEfficiency', inputs: ['close'], params: [['num', 10], ['esp', 9]], lines: ['PFE', 'ePFE'] },
    IBS:                     { name: 'IBS', type: 'oscillator', fn: 'InternalBarStrength', inputs: ['high', 'low', 'close'], params: [['esp', 9]], lines: ['IBS', 'eIBS'], precision: 4 },
    // Prof. Wang's 2026-September batch.
    BIAS2:                   { name: 'BIAS(C-EMA)/EMA', type: 'oscillator', fn: 'BIAS2', inputs: ['close'], params: [['esp', 9]], lines: ['BIAS2', 'eBIAS2'] },
    MABiasRate:              { name: 'MABiasRate', type: 'oscillator', fn: 'MABiasRate', inputs: ['close'], params: [['day1', 5], ['day2', 10], ['esp', 9]], lines: ['MABiasRate', 'eMABiasRate'] },
    EMABiasRate:             { name: 'EMABiasRate', type: 'oscillator', fn: 'EMABiasRate', inputs: ['close'], params: [['day1', 5], ['day2', 10], ['esp', 9]], lines: ['EMABiasRate', 'eEMABiasRate'] },
    VariRtMA_1DayAgo:        { name: 'VariRtMA_OneDayAgo', type: 'momentum', fn: 'VariantRateMA_OneDayAgo', inputs: ['close'], params: [['MA_day', 5]], lines: ['VarRtMA_OneDayAgo'], minPeriod: 6 },
    VariRtMA_2DaysAgo:       { name: 'VariRtMA_TwoDaysAgo', type: 'momentum', fn: 'VariantRateMA_TwoDaysAgo', inputs: ['close'], params: [['MA_day', 5]], lines: ['VarRtMA_TwoDaysAgo'], minPeriod: 7 },
    VariRtMA_3DaysAgo:       { name: 'VariRtMA_ThreeDaysAgo', type: 'momentum', fn: 'VariantRateMA_ThreeDaysAgo', inputs: ['close'], params: [['MA_day', 5]], lines: ['VarRtMA_ThreeDaysAgo'], minPeriod: 8 },
    VariRtEMA_1DayAgo:       { name: 'VariRtEMA_OneDayAgo', type: 'momentum', fn: 'VariantRateEMA_OneDayAgo', inputs: ['high', 'low', 'close'], params: [['esp', 9]], lines: ['VarRtEMA_OneDayAgo'] },
    VariRtEMA_2DaysAgo:      { name: 'VariRtEMA_TwoDaysAgo', type: 'momentum', fn: 'VariantRateEMA_TwoDaysAgo', inputs: ['high', 'low', 'close'], params: [['esp', 9]], lines: ['VarRtEMA_TwoDaysAgo'] },
    VariRtEMA_3DaysAgo:      { name: 'VariRtEMA_ThreeDaysAgo', type: 'momentum', fn: 'VariantRateEMA_ThreeDaysAgo', inputs: ['high', 'low', 'close'], params: [['esp', 9]], lines: ['VarRtEMA_ThreeDaysAgo'] },
    EMA_KD_TP:               { name: 'EMA_KD(TP)', type: 'oscillator', fn: 'EMA_KDliztion_TP', inputs: ['high', 'low', 'close'], params: [['EMA_num', 10], ['KD_num', 9]], lines: ['EMA_KD_K', 'EMA_KD_D'] },
    BIAS_KD_TP:              { name: 'BIAS_KD(TP)', type: 'oscillator', fn: 'BIAS_KDliztion_TP', inputs: ['high', 'low', 'close'], params: [['esp', 9], ['KD_num', 9]], lines: ['BIAS_KD_K', 'BIAS_KD_D'] },
    // MTM (TP/TP_n*100) and ROC ((TP/TP_n-1)*100) differ by a constant 100, and the
    // KD's min-max scaling cancels it - so these two draw the same pair of lines.
    MTM_KD_TP:               { name: 'MTM_KD(TP)', type: 'oscillator', fn: 'MTM_KDliztion_TP', inputs: ['high', 'low', 'close'], params: [['MTM_num', 5], ['KD_num', 9]], lines: ['MTM_KD_K', 'MTM_KD_D'], minPeriod: 15 },
    ROC_KD_TP:               { name: 'ROC_KD(TP)', type: 'oscillator', fn: 'ROC_KDliztion_TP', inputs: ['high', 'low', 'close'], params: [['ROC_num', 5], ['KD_num', 9]], lines: ['ROC_KD_K', 'ROC_KD_D'], minPeriod: 15 },
    MAVol_KD:                { name: 'MAVol_KD', type: 'volume', fn: 'MAVol_KDliztion', inputs: ['volume'], params: [['MA_day', 5], ['KD_num', 9]], lines: ['MAVol_KD_K', 'MAVol_KD_D'], minPeriod: 14 },
    BBI3_KD:                 { name: 'BBI3_KD', type: 'oscillator', fn: 'BBI3_KDliztion', inputs: ['close'], params: [['day1', 5], ['day2', 10], ['day3', 20], ['KD_num', 9]], lines: ['BBI3_KD_K', 'BBI3_KD_D'], minPeriod: 28 },
    BBI4_KD:                 { name: 'BBI4_KD', type: 'oscillator', fn: 'BBI4_KDliztion', inputs: ['close'], params: [['day1', 5], ['day2', 10], ['day3', 20], ['day4', 25], ['KD_num', 9]], lines: ['BBI4_KD_K', 'BBI4_KD_D'], minPeriod: 33 },
    BBI5_KD:                 { name: 'BBI5_KD', type: 'oscillator', fn: 'BBI5_KDliztion', inputs: ['close'], params: [['day1', 5], ['day2', 10], ['day3', 20], ['day4', 25], ['day5', 30], ['KD_num', 9]], lines: ['BBI5_KD_K', 'BBI5_KD_D'], minPeriod: 38 },
  };

  const CATEGORY = { trend: 'Trend', momentum: 'Momentum', oscillator: 'Oscillators', volume: 'Volume', volatility: 'Volatility' };
  // After the palette's LINE1-3: extras that stay readable on a dark pane.
  const LINE_COLORS = [C.LINE1, C.LINE2, C.LINE3, '#e879f9', '#4ade80', '#f87171', '#a78bfa', '#fbbf24', '#94a3b8'];
  const IMPULSE_COLORS = { Green: '#22c55e', Red: '#ef4444', Blue: '#3b82f6' };

  Object.entries(TABLE).forEach(([id, spec]) => {
    const params = spec.params || [];
    const priceFormat = spec.volumeScale ? { type: 'volume' }
      : spec.precision ? { type: 'price', precision: spec.precision, minMove: 10 ** -spec.precision }
      : undefined;
    const fmt = priceFormat ? { priceFormat } : {};
    const multi = spec.lines.length + (spec.histogram ? 1 : 0) + (spec.withClose ? 1 : 0) > 1;
    const outputs = [];
    if (spec.histogram) {
      outputs.push({
        key: spec.histogram,
        type: 'histogram',
        signColors: { up: C.UP, down: C.DOWN },
        ...(spec.colorKey ? { colorKey: spec.colorKey, colorMap: IMPULSE_COLORS } : {}),
        ...fmt,
      });
    }
    if (spec.withClose) outputs.push({ key: 'Close', title: 'Close', color: '#cbd5e1', lineWidth: 1, ...fmt });
    spec.lines.forEach((key, i) => outputs.push({
      key,
      ...(multi ? { title: (spec.titles && spec.titles[key]) || key } : {}),
      color: LINE_COLORS[i % LINE_COLORS.length],
      ...fmt,
    }));

    registry.register({
      id,
      name: spec.name,
      category: CATEGORY[spec.type] || 'Other',
      placement: 'pane',
      params: params.map(([key, value]) => [key, key, value]),
      minBars: spec.minPeriod || Math.max(2, ...params.filter(p => !p[2]).map(p => p[1])),
      outputs,
      compute: (candles, p) => {
        const fn = window[spec.fn];
        if (typeof fn !== 'function') return {};
        // Day counts are used as array indices inside the Wang functions, and
        // the inputs accept decimals - so round everything not marked fractional.
        const args = params.map(([key, value, fractional]) => {
          const v = p[key] != null ? p[key] : value;
          return fractional ? v : Math.round(v);
        });
        const out = fn(...spec.inputs.map(field => candles.map(d => d[field] ?? 0)), ...args) || {};
        // out[i] is bar i's value; some of these arrays run one past the last bar.
        const result = {};
        Object.entries(out).forEach(([k, v]) => { result[k] = Array.isArray(v) ? Array.from({ length: candles.length }, (_, i) => v[i]) : v; });
        if (spec.withClose) result.Close = candles.map(d => d.close);
        return result;
      },
    });
  });
})();
