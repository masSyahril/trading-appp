/* TradeLite Multi-Indicator System */

function computeRandomWalkIndex(RWI_n, esp, high, low, close) {
  const len = close.length;
  const RWI_high = new Array(len).fill(NaN);
  const RWI_low = new Array(len).fill(NaN);
  const TR = new Array(len).fill(0);
  const ATR = new Array(len).fill(NaN);

  // 1) True Range (need previous close) — start at i=1
  for (let i = 1; i < len; i++) {
    const tp1 = high[i] - low[i];
    const tp2 = Math.abs(high[i] - close[i - 1]);
    const tp3 = Math.abs(low[i] - close[i - 1]);
    TR[i] = Math.max(tp1, tp2, tp3);
  }
    
  // 2) ATR as EMA of TR. Initialize ATR[1]=TR[1] if available
  if (len > 1) ATR[1] = TR[1];
  for (let i = 2; i < len; i++) {
    ATR[i] = (esp - 1) / (esp + 1) * ATR[i - 1] + (2 / (esp + 1)) * TR[i];
  }

  // 3) For each bar compute rolling max/min over the RWI window and RWI values
  for (let i = RWI_n - 1; i < len; i++) {
    let max_high = -Infinity;
    let min_low = Infinity;
    const start = i - RWI_n + 1;
    for (let j = start; j <= i; j++) {
      if (high[j] > max_high) max_high = high[j];
      if (low[j] < min_low) min_low = low[j];
    }
    const denom = ATR[i] * Math.sqrt(RWI_n);
    if (denom && !isNaN(denom) && denom !== 0) {
      RWI_high[i] = (high[i] - min_low) / denom;
      RWI_low[i] = (max_high - low[i]) / denom;
    } else {
      RWI_high[i] = NaN;
      RWI_low[i] = NaN;
    }
  }

  return { RWI_high, RWI_low };
}

function computeBollinger4SD(K_close, MA_day, SD_day) {
  //K_high=STK_close, for example: MA_day=10, SD_day=20
  const MA=[];         // =middleBand[]
  const upperBand=[];  // =MA+2SD
  const lowerBand=[];  // =MA-2SD
  const SD=[];         // SD(Standard Deviation)
  const upperBand_lowerBand=[];  //upperBand-lowerBand=4SD
  const percentB=[];   // B percent布林極限％B
  const Bandwith=[];   // wide the Bollinger Bands 
  let sum=0;
  //compute MA[], MA_day=10, MA[]=10,11,...,2000
  for(let i=1; i<=MA_day; i++) {   //i=1 to 10
    sum=sum+K_close[i];
  }
  MA[MA_day]=sum/MA_day;     //first MA[10]=sum/10
  for(let i=MA_day+1; i<=K_close.length; i++) {  //i=11 to 2000
    sum=sum-K_close[i-MA_day]+K_close[i];   //先扣除舊的，再加新的
    MA[i]=sum/MA_day;       //second MA[21]=sum/20
  }
  //compute SD(Standard Deviation), SD[]=29,30,...,2000
  let sum_SD=0;
  for(let i=MA_day; i<=MA_day+SD_day-1; i++) {  //i=10 to 29(=10+20-1)
    sum_SD=sum_SD+(K_close[i]-MA[i])**2;   //平方=x**2，或=Math.pow(x,2)
  }
  let tp;
  tp=MA_day+SD_day-1;   //tp=10+20-1=29
  SD[tp]=Math.sqrt(sum_SD/SD_day);  //first SD[29],開根號=Math.sqrt()
  upperBand[tp]=MA[tp]+2*SD[tp];    //first=[29]
  lowerBand[tp]=MA[tp]-2*SD[tp];
  upperBand_lowerBand[tp]=4*SD[tp];
  percentB[tp]=(K_close[tp]-lowerBand[tp])/(upperBand[tp]-lowerBand[tp])*100;
  Bandwith[tp]=(upperBand[tp]-lowerBand[tp])/MA[tp]*100;
  //======================以上計算是所有指標的第1個數值。
  //======以下計算所有指標的其餘數值  SD[]=30,31,...2000
  for(let i=MA_day+SD_day; i<=K_close.length; i++) {  //i=30(10+20) to 2000
    //sum_SD先扣除舊的，再加新的
    sum_SD=sum_SD-(K_close[i-SD_day]-MA[i-SD_day])**2+(K_close[i]-MA[i])**2;
    SD[i]=Math.sqrt(sum_SD/SD_day);   //second SD[30]
    upperBand[i]=MA[i]+2*SD[i];       //first=[29]
    lowerBand[i]=MA[i]-2*SD[i];
    upperBand_lowerBand[i]=4*SD[i];   //second =[30]
    percentB[i]=(K_close[i]-lowerBand[i])/(upperBand[i]-lowerBand[i])*100;
    Bandwith[i]=(upperBand[i]-lowerBand[i])/MA[tp]*100;
  }
  // upperBand/MA/lowerBand are drawn in the K_Line area (main chart overlay);
  // upperBand_lowerBand/percentB/Bandwith are drawn in the small window (sub-pane).
  return {upperBand, MA, lowerBand, upperBand_lowerBand, percentB, Bandwith};
  //MA_day=10, SD_day=20, THREE Indicators[]=29,30,...,2000.
}
// REX Oscillator: TVB = 2*close - (high + low), REX = EMA(TVB, esp)
// function computeREXOscillator(K_high, K_low, K_close, esp) {
//   const len = K_close.length;
//   const TVB = [];
//   const REX = [];
//   for (let i = 1; i < len; i++) {
//     TVB[i] = 2 * K_close[i] - (K_high[i] + K_low[i]);
//   }
//   if (len > 1) REX[1] = TVB[1];
//   for (let i = 2; i < len; i++) {
//     REX[i] = (esp - 1) / (esp + 1) * REX[i - 1] + (2 / (esp + 1)) * TVB[i];
//   }
//   return { REX, TVB };
// }




// TradingView-style alignment: same time index lines up across main chart and indicator panels.
const PRICE_SCALE_ALIGN_WIDTH = 56;
const TIME_SCALE_RIGHT_OFFSET = 8;
const TIME_SCALE_BAR_SPACING = 6;


function computeREXOSC(K_high, K_low, K_close, esp) {
  const TVB = [];
  const REX = [];
  for (let i = 1; i < K_close.length; i++) {
    TVB[i] = 2 * K_close[i] - (K_high[i] + K_low[i]);
  }
  if (K_close.length > 1) REX[1] = TVB[1];
  for (let i = 2; i < K_close.length; i++) {
    REX[i] = (esp - 1) / (esp + 1) * REX[i - 1] + (2 / (esp + 1)) * TVB[i];
  }
  return { REX, TVB };
}

function _rsi0Based(closes, period) {
  const n = closes.length;
  const rsi = new Array(n).fill(null);
  if (n <= period) return rsi;
  let U = 0, D = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) U += d; else D += -d;
  }
  rsi[period] = (U + D === 0) ? 100 : U / (U + D) * 100;
  for (let i = period + 1; i < n; i++) {
    const dNew = closes[i] - closes[i - 1];
    if (dNew > 0) U += dNew; else D += -dNew;
    const dLeave = closes[i - period] - closes[i - period - 1];
    if (dLeave > 0) U -= dLeave; else D -= -dLeave;
    if (U < 0 && Math.abs(U) < 1e-12) U = 0;
    if (D < 0 && Math.abs(D) < 1e-12) D = 0;
    rsi[i] = (U + D === 0) ? 100 : U / (U + D) * 100;
  }
  return rsi;
}

class MultiIndicatorSystem {
  static get PRICE_SCALE_ALIGN_WIDTH() { return PRICE_SCALE_ALIGN_WIDTH; }
  static get TIME_SCALE_RIGHT_OFFSET() { return TIME_SCALE_RIGHT_OFFSET; }
  static get TIME_SCALE_BAR_SPACING() { return TIME_SCALE_BAR_SPACING; }
  constructor(options = {}) {
    this.panels = new Map(); // Panel ID -> Panel Instance
    this.panelCounter = 0;
    this.chartData = [];
    this.mainTimeScale = null;
    this.mainChart = null;
    this.syncEnabled = true;
    this.isUpdatingRange = false; // Prevent recursive updates
    this.isParameterUpdate = false; // Track parameter-driven updates
    
    // Chart display options
    this.displayOptions = {
      showSeriesLabels: options.showSeriesLabels !== false, // Show/hide series titles
      showCrosshairLabels: options.showCrosshairLabels !== false,
      showPriceScale: options.showPriceScale !== false,
      priceScaleMargins: {
        top: options.priceScaleMarginTop || 0.1,
        bottom: options.priceScaleMarginBottom || 0.1
      }
    };
    
    this.colors = {
      UP: '#ef4444',    // Red for up (Chinese style)
      DOWN: '#22c55e',  // Green for down (Chinese style)
      LINE1: '#00bcd4', // Taiwan style light blue
      LINE2: '#ffeb3b', // Taiwan style yellow
      LINE4: '#3b11d2ff', // Taiwan style yellow
      LINE5: '#380532ff', // Taiwan style yellow
      LINE6: '#029c0f', // Taiwan style yellow
      LINE3: '#ff9800', // Taiwan style orange
      VOLUME: '#6b7280' // Volume color
    };

    this.mainChartOverlays = new Map(); // Store MA overlays on main chart
    this.indicatorDefinitions = this.createIndicatorDefinitions();
    this.viewMode = 'stacked'; // 'stacked' (all panels) or 'tabbed' (one panel at a time via #indicators-tabbar)
  }

  /**
   * Build series data with lead-in null padding so indicator lines align vertically with
   * the correct price candles; the initial section is left empty (null) like TradingView.
   * @param {Array} dataArray - Indicator values (may be shorter than chartData)
   * @param {Function} [valueFn] - (value, i) => value or { value, color } for histogram
   * @returns {Array} Full-length array: nulls for lead-in, then mapped values
   */
  seriesWithLeadInPadding(dataArray, valueFn = (v) => v) {
    if (!this.chartData?.length || !dataArray?.length) return [];
    const n = this.chartData.length;
    let values = dataArray;
    if (dataArray.length > n) {
      values = dataArray.slice(dataArray.length - n);
    }
    const m = values.length;
    const startIdx = Math.max(0, n - m);
    const result = [];
    for (let i = 0; i < startIdx; i++) {
      const c = this.chartData[i];
      if (c && c.time != null) result.push({ time: c.time, value: null });
    }
    for (let i = 0; i < m; i++) {
      const c = this.chartData[startIdx + i];
      if (!c || c.time == null) continue;
      const out = valueFn(values[i], i);
      if (out != null && typeof out === 'object' && 'value' in out) {
        result.push({ time: c.time, ...out });
      } else {
        result.push({ time: c.time, value: out });
      }
    }
    return result;
  }

  createIndicatorDefinitions() {
    return {
      MACD: {
        name: 'MACD',
        type: 'oscillator',
        defaultParams: { fast: 12, slow: 26, signal: 9 },
        paramLabels: { fast: 'Fast', slow: 'Slow', signal: 'Signal' },
        minPeriod: 26,
        compute: (data, params) => this.computeMACD(data, params.fast, params.slow, params.signal),
        render: (chart, data, colors, seriesMap) => this.renderMACD(chart, data, colors, seriesMap)
      },
      RSI: {
        name: 'RSI (Dual)',
        type: 'oscillator',
        defaultParams: { periodA: 5, periodB: 10 },
        paramLabels: { periodA: 'RSI A', periodB: 'RSI B' },
        minPeriod: 5,
        overbought: 70,
        oversold: 30,
        compute: (data, params) => this.computeDualRSI(data, params.periodA, params.periodB),
        render: (chart, data, colors, seriesMap) => this.renderDualRSI(chart, data, colors, seriesMap)
      },
      STOCH: {
        name: 'KD ',
        type: 'oscillator',
        defaultParams: { kPeriod: 14, dPeriod: 3 },
        paramLabels: { kPeriod: '%K', dPeriod: '%D' },
        minPeriod: 14,
        overbought: 80,
        oversold: 20,
        editable: false, // Disable parameter editing to prevent unwanted updates
        compute: (data, params) => this.computeStochastic(data, params.kPeriod, params.dPeriod),
        render: (chart, data, colors, seriesMap) => this.renderStochastic(chart, data, colors, seriesMap)
      },
      WANG_KD: {
        name: 'Wang KD',
        type: 'oscillator',
        defaultParams: { period: 9 },
        paramLabels: { period: 'Period' },
        minPeriod: 9,
        overbought: 80,
        oversold: 20,
        compute: (data, params) => this.computeWangKD(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderStochastic(chart, data, colors, seriesMap)
      },
      NEW_KD: {
        name: 'New KD (K/D/K2/D2)',
        type: 'oscillator',
        defaultParams: { kdDay: 9, kd2Day: 9 },
        paramLabels: { kdDay: 'KD Period', kd2Day: 'K2/D2 Frequency' },
        minPeriod: 9,
        overbought: 80,
        oversold: 20,
        compute: (data, params) => this.computeNewKD(data, params.kdDay, params.kd2Day),
        render: (chart, data, colors, seriesMap) => this.renderNewKD(chart, data, colors, seriesMap)
      },
      WANG_WR: {
        name: 'Wang %R',
        type: 'oscillator',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 14,
        overbought: -20,
        oversold: -80,
        compute: (data, params) => this.computeWangWilliamsR(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderWilliamsR(chart, data, colors, seriesMap)
      },
      WILLIAMS: {
        name: 'Williams %R',
        type: 'oscillator',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 14,
        overbought: -20,
        oversold: -80,
        compute: (data, params) => this.computeWilliamsR(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderWilliamsR(chart, data, colors, seriesMap)
      },
      CCI: {
        name: 'CCI',
        type: 'oscillator',
        defaultParams: { period: 20 },
        paramLabels: { period: 'Period' },
        minPeriod: 20,
        overbought: 100,
        oversold: -100,
        compute: (data, params) => this.computeCCI(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderCCI(chart, data, colors, seriesMap)
      },
      VOL_RSI: {
        name: 'Volume RSI (Wang)',
        type: 'oscillator',
        defaultParams: { period: 10, esp: 9 },
        paramLabels: { period: 'RSI Period', esp: 'Smoothing' },
        minPeriod: 10,
        overbought: 70,
        oversold: 30,
        isNew: true,
        compute: (data, params) => this.computeVolumeRSI(data, params.period, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderVolumeRSI(chart, data, colors, seriesMap)
      },
      ADX: {
        name: 'ADX',
        type: 'trend',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 14,
        compute: (data, params) => this.computeADX(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderADX(chart, data, colors, seriesMap)
      },
      MOMENTUM: {
        name: 'Momentum',
        type: 'momentum',
        defaultParams: { period: 10 },
        paramLabels: { period: 'Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeMomentum(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderMomentum(chart, data, colors, seriesMap)
      },
      ROC: {
        name: 'Rate of Change',
        type: 'momentum',
        defaultParams: { period: 10 },
        paramLabels: { period: 'Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeROC(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderROC(chart, data, colors, seriesMap)
      },
      COPPOCK: {
        name: 'Coppock Curve (估波指標)',
        type: 'momentum',
        defaultParams: { short_day: 10, long_day: 20, weight_day: 10 },
        paramLabels: { short_day: 'Short ROC', long_day: 'Long ROC', weight_day: 'MA Period' },
        minPeriod: 30,
        compute: (data, params) => this.computeCoppockCurve(data, params.short_day, params.long_day, params.weight_day),
        render: (chart, data, colors, seriesMap) => this.renderCoppockCurve(chart, data, colors, seriesMap)
      },
      VOLUME: {
        name: 'Volume',
        type: 'volume',
        defaultParams: { maPeriod: 20 },
        paramLabels: { maPeriod: 'MA Period' },
        minPeriod: 1,
        compute: (data, params) => this.computeVolume(data, params),
        render: (chart, data, colors, seriesMap) => this.renderVolume(chart, data, colors, seriesMap)
      },
      OBV: {
        name: 'On Balance Volume',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 1,
        compute: (data, params) => this.computeOBV(data),
        render: (chart, data, colors, seriesMap) => this.renderOBV(chart, data, colors, seriesMap)
      },
      MA: {
        name: 'Moving Average',
        type: 'trend',
        defaultParams: { period: 20, type: 'SMA' },
        paramLabels: { period: 'Period', type: 'Type' },
        paramOptions: {
          type: ['SMA', 'EMA', 'WMA', 'TMA', 'HMA', 'KAMA', 'VWMA']
        },
        minPeriod: 2,
        compute: (data, params) => this.computeMA(data, params.period, params.type),
        render: (chart, data, colors, seriesMap) => this.renderMA(chart, data, colors, seriesMap)
      },
      ARBR: {
        name: 'AR/BR',
        type: 'momentum',
        defaultParams: { period: 26 },
        paramLabels: { period: 'Period' },
        minPeriod: 26,
        compute: (data, params) => this.computeARBRIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderARBR(chart, data, colors, seriesMap)
      },
      SYARBR: {
        name: 'SYBR',
        type: 'momentum',
        defaultParams: { period: 23 },
        paramLabels: { period: 'Period' },
        minPeriod: 23,
        compute: (data, params) => this.computeSYARBRIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderSYBR(chart, data, colors, seriesMap)
      },

      CR: {
        name: 'CR (Dual)',
        type: 'momentum',
        defaultParams: { periodA: 10, periodB: 26 },
        paramLabels: { periodA: 'CR A', periodB: 'CR B' },
        minPeriod: 10,
        compute: (data, params) => this.computeDualCR(data, params.periodA, params.periodB),
        render: (chart, data, colors, seriesMap) => this.renderDualCR(chart, data, colors, seriesMap)
      },
      BBI: {
        name: 'Bull Bear Index',
        type: 'trend',
        defaultParams: { short: 3, shortMed: 6, medLong: 12, long: 24 },
        paramLabels: { short: 'Short', shortMed: 'Short-Med', medLong: 'Med-Long', long: 'Long' },
        minPeriod: 24,
        compute: (data, params) => this.computeBBIIndicator(data, params),
        render: (chart, data, colors, seriesMap) => this.renderBBI(chart, data, colors, seriesMap)
      },
      BULLBEAR: {
        name: 'Bull Bear Power',
        type: 'momentum',
        defaultParams: { period: 13 },
        paramLabels: { period: 'EMA Period' },
        minPeriod: 13,
        compute: (data, params) => this.computeBullBearPowerIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderBullBearPower(chart, data, colors, seriesMap)
      },
      BBI3: {
        name: 'BBI-3 (Triple MA Average)',
        type: 'trend',
        defaultParams: { day1: 3, day2: 6, day3: 12 },
        paramLabels: { day1: 'MA1', day2: 'MA2', day3: 'MA3' },
        minPeriod: 3,
        compute: (data, params) => this.computeBBI3(data, params.day1, params.day2, params.day3),
        render: (chart, data, colors, seriesMap) => this.renderBBI3(chart, data, colors, seriesMap)
      },
      BBI4: {
        name: 'BBI-4 (Quad MA Average)',
        type: 'trend',
        defaultParams: { day1: 3, day2: 6, day3: 12, day4: 24 },
        paramLabels: { day1: 'MA1', day2: 'MA2', day3: 'MA3', day4: 'MA4' },
        minPeriod: 3,
        compute: (data, params) => this.computeBBI4(data, params.day1, params.day2, params.day3, params.day4),
        render: (chart, data, colors, seriesMap) => this.renderBBI4(chart, data, colors, seriesMap)
      },
      BBI5: {
        name: 'BBI-5 (Penta MA Average)',
        type: 'trend',
        defaultParams: { day1: 3, day2: 6, day3: 12, day4: 24, day5: 48 },
        paramLabels: { day1: 'MA1', day2: 'MA2', day3: 'MA3', day4: 'MA4', day5: 'MA5' },
        minPeriod: 3,
        compute: (data, params) => this.computeBBI5(data, params.day1, params.day2, params.day3, params.day4, params.day5),
        render: (chart, data, colors, seriesMap) => this.renderBBI5(chart, data, colors, seriesMap)
      },
      BBI3RR: {
        name: 'BBI-3-RR (Triple MA with Rate of Return)',
        type: 'trend',
        defaultParams: { day1: 3, day2: 6, day3: 12 },
        paramLabels: { day1: 'MA1', day2: 'MA2', day3: 'MA3' },
        minPeriod: 3,
        compute: (data, params) => this.computeBBI3RR(data, params.day1, params.day2, params.day3),
        render: (chart, data, colors, seriesMap) => this.renderBBI3(chart, data, colors, seriesMap)
      },
      BBI4RR: {
        name: 'BBI-4-RR (Quad MA with Rate of Return)',
        type: 'trend',
        defaultParams: { day1: 3, day2: 6, day3: 12, day4: 24 },
        paramLabels: { day1: 'MA1', day2: 'MA2', day3: 'MA3', day4: 'MA4' },
        minPeriod: 3,
        compute: (data, params) => this.computeBBI4RR(data, params.day1, params.day2, params.day3, params.day4),
        render: (chart, data, colors, seriesMap) => this.renderBBI4(chart, data, colors, seriesMap)
      },
      BBI5RR: {
        name: 'BBI-5-RR (Penta MA with Rate of Return)',
        type: 'trend',
        defaultParams: { day1: 3, day2: 6, day3: 12, day4: 24, day5: 48 },
        paramLabels: { day1: 'MA1', day2: 'MA2', day3: 'MA3', day4: 'MA4', day5: 'MA5' },
        minPeriod: 3,
        compute: (data, params) => this.computeBBI5RR(data, params.day1, params.day2, params.day3, params.day4, params.day5),
        render: (chart, data, colors, seriesMap) => this.renderBBI5(chart, data, colors, seriesMap)
      },
      OSC: {
        name: 'OSC (Oscillator)',
        type: 'oscillator',
        defaultParams: { period: 20 },
        paramLabels: { period: 'MA Period' },
        minPeriod: 2,
        compute: (data, params) => this.computeOSC(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderOSC(chart, data, colors, seriesMap)
      },
      BIAS: {
        name: 'BIAS (Dual)',
        type: 'oscillator',
        defaultParams: { day1: 6, day2: 12 },
        paramLabels: { day1: 'BIAS1', day2: 'BIAS2' },
        minPeriod: 2,
        compute: (data, params) => this.computeBIAS(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderBIAS(chart, data, colors, seriesMap)
      },
      MBIAS: {
        name: 'MBIAS (MA Difference)',
        type: 'oscillator',
        defaultParams: { day1: 6, day2: 12 },
        paramLabels: { day1: 'Short MA', day2: 'Long MA' },
        minPeriod: 2,
        compute: (data, params) => this.computeMBIAS(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderMBIAS(chart, data, colors, seriesMap)
      },
      UOSC: {
        name: 'UOSC (Ultimate Oscillator)',
        type: 'oscillator',
        defaultParams: { maPeriod: 20, oscPeriod: 10 },
        paramLabels: { maPeriod: 'MA Period', oscPeriod: 'OSC Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeUOSC(data, params.maPeriod, params.oscPeriod),
        render: (chart, data, colors, seriesMap) => this.renderUOSC(chart, data, colors, seriesMap)
      },
      ATR: {
        name: 'ATR (Average True Range)',
        type: 'volatility',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 2,
        compute: (data, params) => this.computeATRIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderATR(chart, data, colors, seriesMap)
      },
      ADO: {
        name: 'ADO (Accumulation/Distribution)',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 1,
        compute: (data, params) => this.computeADOIndicator(data),
        render: (chart, data, colors, seriesMap) => this.renderADO(chart, data, colors, seriesMap)
      },
      ADI: {
        name: 'ADI (Accum/Dist Impulse)',
        type: 'volume',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 2,
        compute: (data, params) => this.computeADIIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderADI(chart, data, colors, seriesMap)
      },
      VAO: {
        name: 'VAO (Volume Osc)',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 1,
        compute: (data, params) => this.computeVAOIndicator(data),
        render: (chart, data, colors, seriesMap) => this.renderVAO(chart, data, colors, seriesMap)
      },
      MFI: {
        name: 'Money Flow Index',
        type: 'volume',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 14,
        overbought: 80,
        oversold: 20,
        compute: (data, params) => this.computeMFI(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderMFI(chart, data, colors, seriesMap)
      },
      HLO: {
        name: 'HLO (High/Low Oscillator)',
        type: 'oscillator',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 2,
        compute: (data, params) => this.computeHLOIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderHLO(chart, data, colors, seriesMap)
      },
      VHF: {
        name: 'VHF (Vertical Horizontal Filter)',
        type: 'oscillator',
        defaultParams: { period: 14 },
        paramLabels: { period: 'Period' },
        minPeriod: 5,
        compute: (data, params) => this.computeVHFIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderVHF(chart, data, colors, seriesMap)
      },
      RWI: {
        name: 'RWI (Random Walk Index)',
        type: 'oscillator',
        defaultParams: { RWI_n: 14, esp: 10 },
        paramLabels: { RWI_n: 'Period', esp: 'Smooth' },
        minPeriod: 14,
        compute: (data, params) => this.computeRandomWalkingIndex(data, params.RWI_n, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderRandomWalkingIndex(chart, data, colors, seriesMap)
      },
      REX_OSC: {
        name: 'REX Oscillator',
        type: 'oscillator',
        defaultParams: { esp: 9, parameters: 10 },
        paramLabels: { esp: 'Smooth', parameters: 'Parameters' },
        minPeriod: 2,
        compute: (data, params) => this.computeREXOscillatorIndicator(data, params.esp, params.parameters),
        render: (chart, data, colors, seriesMap) => this.renderREXOscillator(chart, data, colors, seriesMap)
      },
      VR: {
        name: 'VR (Volume Ratio)',
        type: 'volume',
        defaultParams: { period: 26, esp: 10 },
        paramLabels: { period: 'Period', esp: 'Smooth' },
        minPeriod: 5,
        compute: (data, params) => this.computeVRIndicator(data, params.period, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderVR(chart, data, colors, seriesMap)
      },
      DEMA: {
        name: 'DEMA',
        type: 'trend',
        defaultParams: { esp: 9},
        paramLabels: { esp: 'Smooth' },
        minPeriod: 5,
        compute: (data, params) => this.computeDEMAIndicator(data, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderDEMA(chart, data, colors, seriesMap)
      },

      ADR: {
        name: 'ADR (Advance/Decline Ratio)',
        type: 'momentum',
        defaultParams: { day: 20, esp: 10 },
        paramLabels: { day: 'day', esp: 'Smooth' },
        minPeriod: 5,
        compute: (data, params) => this.computeADRIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderADR(chart, data, colors, seriesMap)
      },
      VRMA: {
        name: 'VRMA (MA Rate of Change)',
        type: 'trend',
        defaultParams: { day1: 5, day2: 10 },
        paramLabels: { day1: 'MA1', day2: 'MA2' },
        minPeriod: 5,
        compute: (data, params) => this.computeVRMAIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderVRMA(chart, data, colors, seriesMap)
      },
      IMI: {
        name: 'IMI (Intraday Momentum)',
        type: 'momentum',
        defaultParams: { day1: 10, day2: 20 },
        paramLabels: { day1: 'IMI1', day2: 'IMI2' },
        minPeriod: 10,
        compute: (data, params) => this.computeIMIIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderIMI(chart, data, colors, seriesMap)
      },
      QSTICK: {
        name: 'Qstick (Quantitative Candle)',
        type: 'momentum',
        defaultParams: { day1: 10, day2: 20 },
        paramLabels: { day1: 'IMI1', day2: 'IMI2' },
        minPeriod: 10,
        compute: (data, params) => this.computeQstickIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderQstick(chart, data, colors, seriesMap)
      },
      MTM: {
        name: 'MTM (Momentum)',
        type: 'momentum',
        defaultParams: { day1: 10, day2: 20 },
        paramLabels: { day1: 'Period 1', day2: 'Period 2' },
        minPeriod: 10,
        compute: (data, params) => this.computeMTMIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderMTM(chart, data, colors, seriesMap)
      },
      ROC_DUAL: {
        name: 'ROC (Rate of Change Dual)',
        type: 'momentum',
        defaultParams: { day1: 10, day2: 20 },
        paramLabels: { day1: 'Period 1', day2: 'Period 2' },
        minPeriod: 10,
        compute: (data, params) => this.computeROCIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderROC(chart, data, colors, seriesMap)
      },
      KST: {
        name: 'KST (Know Sure Things)',
        type: 'momentum',
        defaultParams: { day1: 10, day2: 15, day3: 20, day4: 30 },
        paramLabels: { day1: 'ROC1', day2: 'ROC2', day3: 'ROC3', day4: 'ROC4' },
        minPeriod: 30,
        compute: (data, params) => this.computeKSTIndicator(data, params.day1, params.day2, params.day3, params.day4),
        render: (chart, data, colors, seriesMap) => this.renderKST(chart, data, colors, seriesMap)
      },
      OBV_ALT: {
        name: 'OBV (On-Balance Volume Alt)',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 1,
        compute: (data, params) => this.computeOBVIndicator(data),
        render: (chart, data, colors, seriesMap) => this.renderOBV(chart, data, colors, seriesMap)
      },
      ACC: {
        name: 'ACC (Acceleration)',
        type: 'momentum',
        defaultParams: { MTM_n: 10, ACC_n: 5 },
        paramLabels: { MTM_n: 'MTM Period', ACC_n: 'ACC Period' },
        minPeriod: 15,
        compute: (data, params) => this.computeACCIndicator(data, params.MTM_n, params.ACC_n),
        render: (chart, data, colors, seriesMap) => this.renderACC(chart, data, colors, seriesMap)
      },
      WAD: {
        name: 'WAD (Williams A/D)',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 1,
        compute: (data, params) => this.computeWADIndicator(data),
        render: (chart, data, colors, seriesMap) => this.renderWAD(chart, data, colors, seriesMap)
      },
      COSTMA: {
        name: 'CostMA (Cost Moving Avg)',
        type: 'trend',
        defaultParams: { day: 10 },
        paramLabels: { day: 'Period' },
        minPeriod: 2,
        compute: (data, params) => this.computeCostMAIndicator(data, params.day),
        render: (chart, data, colors, seriesMap) => this.renderCostMA(chart, data, colors, seriesMap)
      },
      VROC: {
        name: 'VROC (Volume ROC)',
        type: 'volume',
        defaultParams: { day1: 10, day2: 20 },
        paramLabels: { day1: 'Period 1', day2: 'Period 2' },
        minPeriod: 10,
        compute: (data, params) => this.computeVROCIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderVROC(chart, data, colors, seriesMap)
      },
      BTI: {
        name: 'BTI (Breadth Thrust)',
        type: 'momentum',
        defaultParams: { day: 10 },
        paramLabels: { day: 'Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeBTIIndicator(data, params.day),
        render: (chart, data, colors, seriesMap) => this.renderBTI(chart, data, colors, seriesMap)
      },
      DPO: {
        name: 'DPO (Detrended Price Osc)',
        type: 'oscillator',
        defaultParams: { MA_day: 10 },
        paramLabels: { MA_day: 'MA Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeDPOIndicator(data, params.MA_day),
        render: (chart, data, colors, seriesMap) => this.renderDPO(chart, data, colors, seriesMap)
      },
      EOM: {
        name: 'EOM (Ease of Movement)',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 2,
        compute: (data, params) => this.computeEOMIndicator(data),
        render: (chart, data, colors, seriesMap) => this.renderEOM(chart, data, colors, seriesMap)
      },
      PVT: {
        name: 'PVT (Price Volume Trend)',
        type: 'volume',
        defaultParams: {},
        paramLabels: {},
        minPeriod: 1,
        compute: (data, params) => this.computePVTIndicator(data),
        render: (chart, data, colors, seriesMap) => this.renderPVT(chart, data, colors, seriesMap)
      },
      PSAR: {
        name: 'Parabolic SAR',
        type: 'trend',
        defaultParams: { acceleration: 0.02, maximum: 0.2 },
        paramLabels: { acceleration: 'Acceleration', maximum: 'Maximum' },
        minPeriod: 2,
        compute: (data, params) => this.computeParabolicSARIndicator(data, params.acceleration, params.maximum),
        render: (chart, data, colors, seriesMap) => this.renderParabolicSAR(chart, data, colors, seriesMap)
      },
      ICHIMOKU: {
        name: 'Ichimoku Cloud',
        type: 'trend',
        defaultParams: { tenkanPeriod: 9, kijunPeriod: 26, senkouBPeriod: 52 },
        paramLabels: { tenkanPeriod: 'Tenkan', kijunPeriod: 'Kijun', senkouBPeriod: 'Senkou B' },
        minPeriod: 52,
        compute: (data, params) => this.computeIchimokuIndicator(data, params.tenkanPeriod, params.kijunPeriod, params.senkouBPeriod),
        render: (chart, data, colors, seriesMap) => this.renderIchimoku(chart, data, colors, seriesMap)
      },
      M3: {
        name: 'M3 Indicator',
        type: 'oscillator',
        defaultParams: { num: 9 },
        paramLabels: { num: 'Smoothing Period' },
        minPeriod: 20,
        compute: (data, params) => this.computeM3Indicator(data, params.num),
        render: (chart, data, colors, seriesMap) => this.renderM3(chart, data, colors, seriesMap)
      },
      DMA: {
        name: 'DMA (Difference of Moving Average)',
        type: 'oscillator',
        defaultParams: { short_day: 10, long_day: 20, ema_n: 9 },
        paramLabels: { short_day: 'Short MA', long_day: 'Long MA', ema_n: 'EMA Period' },
        minPeriod: 20,
        compute: (data, params) => this.computeDMAIndicator(data, params.short_day, params.long_day, params.ema_n),
        render: (chart, data, colors, seriesMap) => this.renderDMA(chart, data, colors, seriesMap)
      },
      HULL_MA: {
        name: 'HULL_MA (Hull MA)',
        type: 'trend',
        defaultParams: { day: 10, ema_n: 9 },
        paramLabels: { day: 'Period', ema_n: 'EMA Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeHullMAIndicator(data, params.day, params.ema_n),
        render: (chart, data, colors, seriesMap) => this.renderHullMA(chart, data, colors, seriesMap)
      },
      // HULLHMA: {
      //     name: 'HULLHMA (Wang)',
      //     type: 'trend',
      //     defaultParams: { day: 10, esp: 9 },
      //     paramLabels: { day: 'Period', esp: 'Smooth' },
      //     minPeriod: 14,
      //     compute: (data, params) => this.computeHULLMA(data, params.day, params.esp),
      //     render: (chart, data, colors, seriesMap) => this.renderHULLMA(chart, data, colors, seriesMap)
      //   },
      MAoneMAtwo: {
        name: 'MAoneMAtwo with RR',
        type: 'trend',
        defaultParams: { day1: 5, day2: 10 },
        paramLabels: { day1: 'Period1', day2: 'Period2' },
        minPeriod: 10,
        compute: (data, params) => this.computeMAoneMAtwoIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderMAoneMAtwo(chart, data, colors, seriesMap)
      },
      MAone_MAtwo: {
        name: 'MAone + MAtwo + Close',
        type: 'trend',
        defaultParams: { day1: 5, day2: 10 },
        paramLabels: { day1: 'Period1', day2: 'Period2' },
        minPeriod: 10,
        compute: (data, params) => this.computeMAone_MAtwoIndicator(data, params.day1, params.day2),
        render: (chart, data, colors, seriesMap) => this.renderMAone_MAtwoClose(chart, data, colors, seriesMap)
      },
      
      VOLMA: {
        name: 'VolMA (Volume Moving Average)',
        type: 'volume',
        defaultParams: { period: 20 },
        paramLabels: { period: 'Period' },
        minPeriod: 2,
        compute: (data, params) => this.computeVolMAIndicator(data, params.period),
        render: (chart, data, colors, seriesMap) => this.renderVolMA(chart, data, colors, seriesMap)
      },
      BOLLINGER4SD:{
        name: 'Bollinger Bands 4SD',
        type: 'oscillator',
        defaultParams: { MA_day: 10, SD_day: 20 },
        paramLabels: { MA_day: 'MA_day', SD_day: 'SD_day' },
        minPeriod: 10,
        compute: (data, params) => this.computeBollingerBands4SDIndicator(data, params.MA_day, params.SD_day),
        render: (chart, data, colors, seriesMap) => this.renderBollingerBands4SD(chart, data, colors, seriesMap)
      },
      PVIpercentRiseFall: {
        name: 'PVIpercentRiseFall (Percent Rise Fall)',
        type: 'volume',
        defaultParams: { day: 10, esp: 10 },
        paramLabels: { day: 'Period', esp: 'esp' },
        minPeriod: 10,
        compute: (data, params) => this.computePVIpercentRiseFallIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderPVIpercentRiseFall(chart, data, colors, seriesMap)
      },
      Alligator: {
        name: 'Alligator (Prof. Wang)',
        type: 'oscillator',
        defaultParams: { day: 10 },
        paramLabels: { day: 'Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeAlligatorIndicator(data, params.day),
        render: (chart, data, colors, seriesMap) => this.renderAlligator(chart, data, colors, seriesMap)
      },
      ZeroLagHullMA: {
        name: 'ZeroLagHullMA  ', 
        type: 'trend',
        defaultParams: { day1: 10, day2: 15, esp: 9 },
        paramLabels: { day1: 'Day 1', day2: 'Day 2', esp: 'esp' },
        minPeriod: 10,
        compute: (data, params) => this.computeZeroLagHullMAIndicator(data, params.day1, params.day2, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderZeroLagHullMA(chart, data, colors, seriesMap)
      },
      StochasticSMI: {
        name: 'Stochastic SMI',
        type: 'trend',
        defaultParams: { lookback: 13, firstSmooth: 25, secondSmooth: 2, signalLine: 9 },
        paramLabels: { lookback: 'Lookback', firstSmooth: 'First Smooth', secondSmooth: 'Second Smooth', signalLine: 'Signal Line' },
        minPeriod: 13,
        compute: (data, params) => this.computeStochasticSMIIndicator(data, params.lookback || 13, params.firstSmooth || 25, params.secondSmooth || 2, params.signalLine || 9),
        render: (chart, data, colors, seriesMap) => this.renderStochasticSMI(chart, data, colors, seriesMap)
      },
      BalanceOfPower:{
        name: 'Balance of Power',
        type: 'oscillator',
        defaultParams: {day : 10, esp: 9},
        paramLabels: {day: 'Period', esp: 'esp'},
        minPeriod: 10,
        compute: (data, params) => this.computeBalanceOfPowerIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderBalanceOfPower(chart, data, colors, seriesMap)
      },
      RiseFallRatioCOG: {
        name: 'Rise Fall Ratio COG',
        type: 'oscillator',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'day', esp: 'esp' },
        minPeriod: 10,
        compute: (data, params) => this.computeRiseFallRatioCOGIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderRiseFallRatioCOG(chart, data, colors, seriesMap)
      },

      GravityOsc_COG: {
        name: 'Gravity Osc COG',
        type: 'oscillator',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'day', esp: 'esp' },
        minPeriod: 10,
        compute: (data, params) => this.computeGravityOscCOGIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderGravityOscCOG(chart, data, colors, seriesMap)
       }, 

       PGO: {
        name: 'PGO (Price Growth Osc)',
        type: 'momentum', 
        defaultParams: { day: 10, n_periods: 14, esp: 9 },
        paramLabels: { day: 'MA_Day', n_periods: 'Growth Periods', esp: 'Smooth' },
        minPeriod: 14,
        compute: (data, params) => this.computePGOIndicator(data, params.day, params.n_periods, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderPGO(chart, data, colors, seriesMap)
       },
       KairiRI: {
        name: 'Kairi RI (Kairi Rate of Change)',
        type: 'oscillator',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeKairiRIIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderKairiRI(chart, data, colors, seriesMap)
       },
       Gaussian: {
        name: 'Gaussian Filter',
        type: 'trend',
        defaultParams: { day:5, sigma:3, esp: 9 },
        paramLabels: { day: 'Period', sigma: 'Sigma', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeGaussianFilterIndicator(data, params.day, Math.min(params.sigma, 5), params.esp),
        render: (chart, data, colors, seriesMap) => this.renderGaussianFilter(chart, data, colors, seriesMap)
       },
       DVO : { // not finish
        name: 'DVO (Detrended Volume Osc)',
        type: 'volume',
        defaultParams: { day: 10, m: 9 },
        paramLabels: { day: 'smooth Day', m: 'M' },
        minPeriod: 10,
        compute: (data, params) => this.computeDVOIndicator(data, params.day, params.m),
        render: (chart, data, colors, seriesMap) => this.renderDVO(chart, data, colors, seriesMap)
       }, 
       Vortex: { 
        name: 'Vortex Indicator',
        type: 'trend',
        defaultParams: { day: 10 },
        paramLabels: { day: 'Period' },
        minPeriod: 14,
        compute: (data, params) => this.computeVortexIndicator(data, params.day),
        render: (chart, data, colors, seriesMap) => this.renderVortex(chart, data, colors, seriesMap)
       },

       KlingerOsc: {
        name: 'Klinger OSC',
        type: 'trend',
        defaultParams: { day1: 10, day2: 20, day3: 13 },
        paramLabels: { day1: 'Short Period', day2: 'Long Period', day3: 'Signal Period' },
        minPeriod: 20,
        compute: (data, params) => this.computeKlingerOscillator(data, params.day1, params.day2, params.day3),
        render: (chart, data, colors, seriesMap) => this.renderKlingerOscillator(chart, data, colors, seriesMap)
       },
       McClellanOSC: {
        name: 'McClellan OSC',
        type: 'oscillator',
        defaultParams: { day: 10, esp: 20, esp2: 40 },
        paramLabels: { day: 'Period', esp: 'Short EMA', esp2: 'Long EMA' },
        minPeriod: 10,
        compute: (data, params) => this.computeMcClellanOscillator(data, params.day, params.esp, params.esp2),
        render: (chart, data, colors, seriesMap) => this.renderMcClellanOscillator(chart, data, colors, seriesMap)
       },

       OBOS:{
        name: 'OBOS (Overbought/Oversold)',
        type: 'oscillator',
        defaultParams: { day: 10, esp:11 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeOBOSIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderOBOS(chart, data, colors, seriesMap)
       },

       QstickBodyAvg: {
        name: 'Qstick Body Avg',
        type: 'momentum',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeQstickBodyAvgIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderQstickBodyAvg(chart, data, colors, seriesMap)
       },

       ADX_DMI: {
        name: 'ADX/DMI',
        type: 'trend',
        defaultParams: { esp:2 },
        paramLabels: { esp: 'smooth' },
        minPeriod: 2,
        compute: (data, params) => this.computeADXDMIIndicator(data, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderADXDMI(chart, data, colors, seriesMap)
       },

       AdaptiveMA: {
        name: 'Adaptive MA',
        type: 'trend',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Adaptive MA' },
        minPeriod: 10,
        compute: (data, params) => this.computeAdaptiveMAIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderAdaptiveMA(chart, data, colors, seriesMap)
       },
       DeMarker: {
        name: 'DeMarker',
        type: 'oscillator',
        defaultParams: { day: 10 },
        paramLabels: { day: 'Period' },
        minPeriod: 10,
        compute: (data, params) => this.computeDeMarkerIndicator(data, params.day),
        render: (chart, data, colors, seriesMap) => this.renderDeMarker(chart, data, colors, seriesMap)
       },
       WilliamsVolatilityChannel: {
        name: 'Williams Volatility Channel',
        type: 'volatility',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeWilliamsVolatilityChannelIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderWilliamsVolatilityChannel(chart, data, colors, seriesMap)
       },
       VolumeZoneOsc:{
        name: 'Volume Zone Oscillator',
        type: 'volume',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeVolumeZoneOscillator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderVolumeZoneOscillator(chart, data, colors, seriesMap)
       },
       DynamicZoneRSI:{ // there is some problem with upper and lower zone, need to check
        name: 'Dynamic Zone RSI',
        type: 'oscillator',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 5,
        compute: (data, params) => this.computeDynamicZoneRSI(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderDynamicZoneRSI(chart, data, colors, seriesMap)
       },
       VolumeFlowIndicator: {
        name: 'Volume Flow Indicator',
        type: 'volume',
        defaultParams: { day: 10, esp: 9 },
        paramLabels: { day: 'Period', esp: 'Smooth' },
        minPeriod: 10,
        compute: (data, params) => this.computeVolumeFlowIndicator(data, params.day, params.esp),
        render: (chart, data, colors, seriesMap) => this.renderVolumeFlowIndicator(chart, data, colors, seriesMap)
        },
        FractalDimensionIndex: {
          name: 'Fractal Dimension Index',
          type: 'volatility',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeFractalDimensionIndex(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderFractalDimensionIndex(chart, data, colors, seriesMap)
        },
        EfficiencyRatio: {
          name: 'Efficiency Ratio',
          type: 'volatility',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 11,
          compute: (data, params) => this.computeEfficiencyRatio(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderEfficiencyRatio(chart, data, colors, seriesMap)
        },
        AccuDistLine: {
          name: 'Accum Dist Line',
          type: 'volume',
          defaultParams: { esp: 9 },
          paramLabels: { esp: 'Smooth' },
          minPeriod: 2,
          compute: (data, params) => this.computeAccuDistLine(data, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderAccuDistLine(chart, data, colors, seriesMap)
        },
        ZeroLagKD: {
          name: 'Zero Lag KD',
          type: 'oscillator',
          defaultParams: { KD_day: 9, esp: 9 },
          paramLabels: { KD_day: 'KD Period', esp: 'Smooth' },
          minPeriod: 9,
          overbought: 80,
          oversold: 20,
          compute: (data, params) => this.computeZeroLagKD(data, params.KD_day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderZeroLagKD(chart, data, colors, seriesMap)
        },
        WaveVolume: {
          name: 'Wave Volume',
          type: 'volume',
          defaultParams: {},
          paramLabels: {},
          minPeriod: 2,
          compute: (data, params) => this.computeWaveVolume(data),
          render: (chart, data, colors, seriesMap) => this.renderWaveVolume(chart, data, colors, seriesMap)
        },
        ElderForceIndex: {
          name: 'Elder Force Index',
          type: 'momentum',
          defaultParams: { esp: 9 },
          paramLabels: { esp: 'Smooth' },
          minPeriod: 2,
          compute: (data, params) => this.computeElderForceIndex(data, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderElderForceIndex(chart, data, colors, seriesMap)
        },
        TimeSegVol: {
          name: 'Time Segmented Vol',
          type: 'volume',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 11,
          compute: (data, params) => this.computeTimeSegVol(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderTimeSegVol(chart, data, colors, seriesMap)
        },
        TimeSegVolTP: {
          name: 'Time Seg Vol (TP)',
          type: 'volume',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 11,
          compute: (data, params) => this.computeTimeSegVolTP(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderTimeSegVolTP(chart, data, colors, seriesMap)
        },
        RSI_Mom: {
          name: 'RSI Momentum',
          type: 'momentum',
          defaultParams: { RSI_day: 10 },
          paramLabels: { RSI_day: 'RSI Period' },
          minPeriod: 12,
          compute: (data, params) => this.computeRSI_Mom(data, params.RSI_day),
          render: (chart, data, colors, seriesMap) => this.renderRSI_Mom(chart, data, colors, seriesMap)
        },
        RSI_CenteredCumul: {
          name: 'RSI Centered Cumulative',
          type: 'momentum',
          defaultParams: { RSI_day: 10 },
          paramLabels: { RSI_day: 'RSI Period' },
          minPeriod: 12,
          compute: (data, params) => this.computeRSI_CenteredCumul(data, params.RSI_day),
          render: (chart, data, colors, seriesMap) => this.renderRSI_CenteredCumul(chart, data, colors, seriesMap)
        },
        SchaffTrend: {
          name: 'Schaff Trend Cycle',
          type: 'oscillator',
          defaultParams: { short_day: 10, long_day: 20, kd_day: 9 },
          paramLabels: { short_day: 'Short EMA', long_day: 'Long EMA', kd_day: 'KD Period' },
          minPeriod: 20,
          overbought: 75,
          oversold: 25,
          compute: (data, params) => this.computeSchaffTrend(data, params.short_day, params.long_day, params.kd_day),
          render: (chart, data, colors, seriesMap) => this.renderSchaffTrend(chart, data, colors, seriesMap)
        },
        FisherTransform: {
          name: 'Fisher Transform',
          type: 'oscillator',
          defaultParams: { Fisher_day: 10, esp: 9 },
          paramLabels: { Fisher_day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeFisherTransform(data, params.Fisher_day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderFisherTransform(chart, data, colors, seriesMap)
        },
        AwesomeOsc: {
          name: 'Awesome Oscillator',
          type: 'momentum',
          defaultParams: { day1: 5, day2: 34 },
          paramLabels: { day1: 'Short', day2: 'Long' },
          minPeriod: 34,
          compute: (data, params) => this.computeAwesomeOsc(data, params.day1, params.day2),
          render: (chart, data, colors, seriesMap) => this.renderAwesomeOsc(chart, data, colors, seriesMap)
        },
        ChoppinessIdx: {
          name: 'Choppiness Index',
          type: 'volatility',
          defaultParams: { num: 10 },
          paramLabels: { num: 'Period' },
          minPeriod: 11,
          compute: (data, params) => this.computeChoppinessIdx(data, params.num),
          render: (chart, data, colors, seriesMap) => this.renderChoppinessIdx(chart, data, colors, seriesMap)
        },
        TSI: {
          name: 'True Strength Index',
          type: 'momentum',
          defaultParams: { esp1: 25, esp2: 13, m: 7 },
          paramLabels: { esp1: 'Long EMA', esp2: 'Short EMA', m: 'Signal' },
          minPeriod: 3,
          compute: (data, params) => this.computeTSI(data, params.esp1, params.esp2, params.m),
          render: (chart, data, colors, seriesMap) => this.renderTSI(chart, data, colors, seriesMap)
        },
        RVI_Vol: {
          name: 'Relative Volatility Index',
          type: 'volatility',
          defaultParams: { SD_num: 10, esp: 14 },
          paramLabels: { SD_num: 'SD Period', esp: 'Smooth' },
          minPeriod: 10,
          overbought: 60,
          oversold: 40,
          compute: (data, params) => this.computeRVI_Vol(data, params.SD_num, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderRVI_Vol(chart, data, colors, seriesMap)
        },
        REI: {
          name: 'Range Expansion Index',
          type: 'oscillator',
          defaultParams: { REI_length: 8, esp: 9 },
          paramLabels: { REI_length: 'Length', esp: 'Smooth' },
          minPeriod: 14,
          overbought: 60,
          oversold: -60,
          compute: (data, params) => this.computeREI(data, params.REI_length, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderREI(chart, data, colors, seriesMap)
        },
        RelVigorIndex: {
          name: 'Relative Vigor Index',
          type: 'oscillator',
          defaultParams: { RVI_day: 10 },
          paramLabels: { RVI_day: 'Period' },
          minPeriod: 16,
          compute: (data, params) => this.computeRelVigorIndex(data, params.RVI_day),
          render: (chart, data, colors, seriesMap) => this.renderRelVigorIndex(chart, data, colors, seriesMap)
        },
        AroonOsc: {
          name: 'Aroon Oscillator',
          type: 'oscillator',
          defaultParams: { Aroon_day: 25 },
          paramLabels: { Aroon_day: 'Period' },
          minPeriod: 25,
          overbought: 50,
          oversold: -50,
          compute: (data, params) => this.computeAroonOsc(data, params.Aroon_day),
          render: (chart, data, colors, seriesMap) => this.renderAroonOsc(chart, data, colors, seriesMap)
        },
        StdDevIndicator: {
          name: 'Standard Deviation',
          type: 'volatility',
          defaultParams: { SD_num: 10, esp: 9 },
          paramLabels: { SD_num: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeStdDevIndicator(data, params.SD_num, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderStdDevIndicator(chart, data, colors, seriesMap)
        },
        RainbowOscillator: {
          name: 'Rainbow Oscillator',
          type: 'momentum',
          defaultParams: { ma_day: 10 },
          paramLabels: { ma_day: 'MA Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeRainbowOscillator(data, params.ma_day),
          render: (chart, data, colors, seriesMap) => this.renderRainbowOscillator(chart, data, colors, seriesMap)
        },
        RainbowMA: {
          name: 'Rainbow MA (overlay)',
          type: 'trend',
          defaultParams: { num: 10 },
          paramLabels: { num: 'Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeRainbowMA(data, params.num),
          render: (chart, data, colors, seriesMap) => this.renderRainbowMA(chart, data, colors, seriesMap)
        },
        LinearReg: {
          name: 'Linear Regression',
          type: 'trend',
          defaultParams: { N: 10, K: 2 },
          paramLabels: { N: 'Period', K: 'Multiplier' },
          minPeriod: 10,
          compute: (data, params) => this.computeLinearReg(data, params.N, params.K),
          render: (chart, data, colors, seriesMap) => this.renderLinearReg(chart, data, colors, seriesMap)
        },
        LinearRegTP: {
          name: 'Linear Regression (TP)',
          type: 'trend',
          defaultParams: { N: 10, K: 2 },
          paramLabels: { N: 'Period', K: 'Multiplier' },
          minPeriod: 10,
          compute: (data, params) => this.computeLinearRegTP(data, params.N, params.K),
          render: (chart, data, colors, seriesMap) => this.renderLinearRegTP(chart, data, colors, seriesMap)
        },
        AdaptiveLaguerre: {
          name: 'Adaptive Laguerre',
          type: 'trend',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 18,
          compute: (data, params) => this.computeAdaptiveLaguerre(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderAdaptiveLaguerre(chart, data, colors, seriesMap)
        },
        HighLowBands: {
          name: 'High Low Bands',
          type: 'trend',
          defaultParams: { day: 10, esp: 10 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 11,
          compute: (data, params) => this.computeHighLowBands(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderHighLowBands(chart, data, colors, seriesMap)
        },
        StollerBands: {
          name: 'Stoller Avg Rng Chnl',
          type: 'trend',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'EMA Period', esp: 'ATR Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeStollerBands(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderStollerBands(chart, data, colors, seriesMap)
        },
        MA_Envelope: {
          name: 'MA Envelope',
          type: 'trend',
          defaultParams: { esp: 9, kk: 3 },
          paramLabels: { esp: 'EMA Period', kk: 'Band %' },
          minPeriod: 9,
          compute: (data, params) => this.computeMA_Envelope(data, params.esp, params.kk),
          render: (chart, data, colors, seriesMap) => this.renderMA_Envelope(chart, data, colors, seriesMap)
        },
        WilliamsPercentRange:{
          name: 'Williams %R (Wang)',
          type: 'oscillator',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeWilliamsPercentRange(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderWilliamsPercentRange(chart, data, colors, seriesMap)
        },
        AlphaBetaMA: {
          name: 'Alpha Beta MA',
          type: 'trend',
          defaultParams: { ma_day: 10, alpha:0, beta:0 },
          paramLabels: { ma_day: 'Period', alpha: 'Alpha', beta: 'Beta' },
          minPeriod: 10,
          compute: (data, params) => this.computeAlphaBetaMA(data, params.ma_day, params.alpha, params.beta),
          render: (chart, data, colors, seriesMap) => this.renderAlphaBetaMA(chart, data, colors, seriesMap)
        },
        LaguerreRSI: {
          name: 'Laguerre RSI',
          type: 'oscillator',
          defaultParams: { gamma: 0.5, esp: 9 },
          paramLabels: { gamma: 'Gamma', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeLaguerreRSI(data, params.gamma, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderLaguerreRSI(chart, data, colors, seriesMap)
        },
        InstantaneousTrendline: {
          name: 'Instant Trend',
          type: 'trend',
          defaultParams: { alpha: 0.07 },
          paramLabels: { alpha: 'Alpha' },
          minPeriod: 10,
          compute: (data, params) => this.computeInstantaneousTrendline(data, params.alpha),
          render: (chart, data, colors, seriesMap) => this.renderInstantaneousTrendline(chart, data, colors, seriesMap)
        },
        RSI_TP: {
          name: 'RSI (Typical Price)',
          type: 'oscillator',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeRSI_TP(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderRSI_TP(chart, data, colors, seriesMap)
        },

        AdaptiveRSI: {
          name: 'Adaptive RSI',
          type: 'oscillator',
          defaultParams: { esp: 9 },
          paramLabels: { esp: 'Smooth' },
          minPeriod: 48,
          compute: (data, params) => this.computeAdaptiveRSI(data, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderAdaptiveRSI(chart, data, colors, seriesMap)
        },
        NewKD: {
          name: 'New KD (3)',
          type: 'oscillator',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeNewKDW(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderNewKDW(chart, data, colors, seriesMap)
        },
        KD_K2D2:{
          name: 'KD_K2D2',
          type: 'oscillator',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeK2D2(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderK2D2(chart, data, colors, seriesMap)
        },
        KD_D2:{
          name: 'KD_D2',
          type: 'oscillator',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeKD_D2(data, params.day,  params.esp),
          render: (chart, data, colors, seriesMap) => this.renderKD_D2(chart, data, colors, seriesMap)
        },
        diffKD:{
          name: 'diffKD',
          type: 'oscillator',
          defaultParams: { day: 10, esp: 9 },
          paramLabels: { day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeDiffKD(data, params.day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderDiffKD(chart, data, colors, seriesMap)
        }, 
        NVR: {
          name: 'NVR (Normalized Volume Ratio)',
          type: 'volume',
          defaultParams: { KD_day: 10, esp: 9 },
          paramLabels: { KD_day: 'Period', esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeNVR(data, params.KD_day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderNVR(chart, data, colors, seriesMap)
        }, 
        StochasticOSC:{
          name: 'Stochastic OSC',
          type: 'oscillator',
          defaultParams: { K_day: 9, esp: 9 },
          paramLabels: { K_day: 'Period', esp: 'Smooth' },
          minPeriod: 9,
          compute: (data, params) => this.computeStochasticOSC(data, params.K_day, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderStochasticOSC(chart, data, colors, seriesMap)
        },
        WilliamR:{
          name: 'William %R b',
          type: 'oscillator',
          defaultParams: { WR_day: 10 },
          paramLabels: { WR_day: 'Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeWilliamR(data, params.WR_day),
          render: (chart, data, colors, seriesMap) => this.renderWilliamR(chart, data, colors, seriesMap)
        },
        VolAccuDistOsc:{
          name: 'Vol Accu Dist Osc',
          type: 'volume',
          defaultParams: { esp: 9 },
          paramLabels: { esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeVolAccuDistOsc(data, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderVolAccuDistOsc(chart, data, colors, seriesMap)
        },
        HighLowOsc:{ // not finish
          name: 'High and Low OSCillator',
          type: 'volume',
          defaultParams: { esp: 9 },
          paramLabels: { esp: 'Smooth' },
          minPeriod: 10,
          compute: (data, params) => this.computeHighLowOsc(data, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderHighLowOsc(chart, data, colors, seriesMap)
        },
        ZeroLagEMA:{
          name: 'Zero Lag EMA',
          type: 'trend',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeZeroLagEMA(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderZeroLagEMA(chart, data, colors, seriesMap)
        }, 
        StochasticEMA:{
          name: 'Stochastic EMA',
          type: 'oscillator',
          defaultParams: { day: 10 },
          paramLabels: { day: 'Period' },
          minPeriod: 10,
          compute: (data, params) => this.computeStochasticEMA(data, params.day),
          render: (chart, data, colors, seriesMap) => this.renderStochasticEMA(chart, data, colors, seriesMap)
        }, 
        JurikMovingAverage: {
          name: 'Jurik Moving Average',
          type: 'trend',
          defaultParams: { length: 20 },
          paramLabels: { length: 'Length' },
          minPeriod: 10,
          compute: (data, params) => this.computeJurikMovingAverage(data, params.length),
          render: (chart, data, colors, seriesMap) => this.renderJurikMovingAverage(chart, data, colors, seriesMap)
        },
        AdaptiveMACD: {
          name: 'Adaptive MACD',
          type: 'oscillator',
          defaultParams: { esp:5 },
          paramLabels: { esp: 'Smooth' },
          minPeriod: 3,
          compute: (data, params) => this.computeAdaptiveMACD(data, params.esp),
          render: (chart, data, colors, seriesMap) => this.renderAdaptiveMACD(chart, data, colors, seriesMap)
        }, 
        StochasticEMA_esp:  {
          name: 'Stocastic EMA)_esp',
          type: 'oscillator',
          defaultParams: { esp:9, KD_num: 10 },
          paramLabels: { esp: 'Smooth', KD_num: 'KD Number' },
          minPeriod: 3,
          compute: (data, params) => this.computeStochasticEMA_esp(data, params.esp, params.KD_num),
          render: (chart, data, colors, seriesMap) => this.renderStochasticEMA_esp(chart, data, colors, seriesMap)
        }, 
        ATRPercentage: {
          name: ' ATR Percentage',
          type: 'volatility',
          defaultParams: {ATR_num: 14},
          paramLabels: {ATR_num: 'ATR Period'},
          minPeriod: 7,
          compute: (data, params) => this.computeATRPercentage(data, params.ATR_num),
          render: (chart, data, colors, seriesMap) => this.renderATRPercentage(chart, data, colors, seriesMap)
        },
        HistoricalVolatility_Close: {
          name: 'Historical Volatility (Close)',
          type: 'volatility',
          defaultParams: {HV_num: 10},
          paramLabels: {HV_num: 'HV Period'},
          minPeriod: 10,
          compute: (data, params) => this.computeHistoricalVolatility_Close(data, params.HV_num),
          render: (chart, data, colors, seriesMap) => this.renderHistoricalVolatility_Close(chart, data, colors, seriesMap)
        },
        HistoricalVolatility_TP: {
          name: 'Historical Volatility (True Range)',
          type: 'volatility',
          defaultParams: {HV_num: 10},
          paramLabels: {HV_num: 'HV Period'},
          minPeriod: 10,
          compute: (data, params) => this.computeHistoricalVolatility_TP(data, params.HV_num),
          render: (chart, data, colors, seriesMap) => this.renderHistoricalVolatility_TP(chart, data, colors, seriesMap)
        }

    // last definition
    };
  }

  // Create flexible indicator section with multiple panels
  createFlexibleIndicatorSection(containerId, indicators = ['MACD', 'RSI', 'STOCH']) {
    console.log(`🎛️ Creating flexible indicator section in ${containerId}`);
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`❌ Container not found: ${containerId}`);
      return null;
    }

    // Create section wrapper
    const sectionId = `flex-section-${this.panelCounter++}`;
    const sectionHTML = `<div class="indicator-section-flexible" id="${sectionId}"></div>`;
    container.insertAdjacentHTML('beforeend', sectionHTML);

    const section = document.getElementById(sectionId);
    const panels = [];

    // Create panels in the flexible section
    indicators.forEach((indicator, index) => {
      const panelId = `panel-flex-${this.panelCounter++}`;
      const panel = this.createFlexiblePanel(panelId, sectionId, indicator, index + 1);
      if (panel) {
        panels.push(panel);
      }
    });

    return { sectionId, panels };
  }

  // Create a flexible panel (for use in flexible sections)
  createFlexiblePanel(panelId, containerId, defaultIndicator, panelNumber) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`❌ Container not found: ${containerId}`);
      return null;
    }

    const panelHTML = `
      <div class="indicator-panel flexible" id="${panelId}" data-indicator="${defaultIndicator}">
        <div class="indicator-header">
          <div class="indicator-title-text" id="${panelId}-title">${this.indicatorDefinitions[defaultIndicator].name}</div>
          <select class="indicator-select" id="${panelId}-select">
            ${Object.entries(this.indicatorDefinitions)
              .sort((a, b) => a[1].name.localeCompare(b[1].name))
              .map(([key, def]) => 
                `<option value="${key}" ${key === defaultIndicator ? 'selected' : ''}>${def.name}</option>`
              ).join('')}
          </select>
          <div class="indicator-params" id="${panelId}-params"></div>
          <div class="indicator-nav-controls">
            <button class="nav-btn" id="${panelId}-pan-left" title="Pan Left">⟵</button>
            <button class="nav-btn" id="${panelId}-zoom-out" title="Zoom Out">−</button>
            <button class="nav-btn" id="${panelId}-zoom-in" title="Zoom In">+</button>
            <button class="nav-btn" id="${panelId}-pan-right" title="Pan Right">⟶</button>
          </div>
          <button class="btn-minimize" id="${panelId}-minimize" title="Minimize/Maximize">
            <span id="${panelId}-toggle">−</span>
          </button>
        </div>
        <div class="indicator-chart" id="${panelId}-chart"></div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', panelHTML);

    // Initialize panel
    const panel = this.initializePanel(panelId, defaultIndicator);
    if (panel) {
      this.setupPanelEventHandlers(panelId);
      this.setupMinimizeHandler(panelId);
    }

    return panel;
  }

  // Setup minimize/maximize handler
  setupMinimizeHandler(panelId) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const minimizeBtn = document.getElementById(`${panelId}-minimize`);
      const panelElement = document.getElementById(panelId);

      if (!minimizeBtn) {
        console.warn(`Minimize button not found: ${panelId}-minimize`);
        return;
      }
      
      if (!panelElement) {
        console.warn(`Panel element not found: ${panelId}`);
        return;
      }

      // FIRST: Set up header click handler (before cloning minimize button)
      // Click minimized header to maximize - use event delegation
      const header = panelElement.querySelector('.indicator-header');
      if (header) {
        // Store handler reference for cleanup
        if (!this._headerClickHandlers) {
          this._headerClickHandlers = new Map();
        }
        
        // Remove existing handler if any
        const existingHandler = this._headerClickHandlers.get(panelId);
        if (existingHandler) {
          header.removeEventListener('click', existingHandler);
        }
        
        // Create a bound handler function
        const headerClickHandler = (e) => {
          const currentPanel = document.getElementById(panelId);
          // Only maximize if clicking on header itself, not on buttons or selects
          if (currentPanel && currentPanel.classList.contains('minimized')) {
            // Don't trigger if clicking on interactive elements
            const target = e.target;
            if (!target.closest('button') && !target.closest('select') && 
                !target.closest('.indicator-params') && !target.closest('.indicator-nav-controls') &&
                !target.closest('.panel-controls')) {
              e.stopPropagation();
              console.log(`📊 Maximizing panel from header click: ${panelId}`);
              this.togglePanelMinimize(panelId);
            }
          }
        };
        
        this._headerClickHandlers.set(panelId, headerClickHandler);
        header.addEventListener('click', headerClickHandler);
      }

      // SECOND: Set up minimize button handler (after header handler)
      // Remove any existing listeners to prevent duplicates
      const newMinimizeBtn = minimizeBtn.cloneNode(true);
      minimizeBtn.parentNode.replaceChild(newMinimizeBtn, minimizeBtn);

      newMinimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();
        console.log(`📉 Minimize button clicked for panel: ${panelId}`);
        this.togglePanelMinimize(panelId);
      });

      console.log(`✅ Minimize handler set up for ${panelId}`);
    }, 50); // Increased timeout to ensure all elements are ready
  }

  // Toggle panel minimize/maximize
  togglePanelMinimize(panelId) {
    const panelElement = document.getElementById(panelId);
    const minimizeBtn = document.getElementById(`${panelId}-minimize`);
    const panel = this.panels.get(panelId);

    if (!panelElement) {
      console.warn(`Panel element not found: ${panelId}`);
      return;
    }
    
    if (!panel) {
      console.warn(`Panel data not found: ${panelId}`);
      return;
    }

    const isMinimized = panelElement.classList.toggle('minimized');

    // The settings popover is position:fixed and won't auto-hide when its
    // panel collapses, so close it explicitly to avoid an orphaned floater
    if (isMinimized) {
      const popover = document.getElementById(`${panelId}-settings-popover`);
      if (popover) popover.hidden = true;
    }

    // Update button icon and class
    if (minimizeBtn) {
      const toggleIcon = minimizeBtn.querySelector('span') || minimizeBtn;
      if (toggleIcon.tagName === 'SPAN') {
        toggleIcon.textContent = isMinimized ? '▲' : '▼';
      } else {
        minimizeBtn.textContent = isMinimized ? '▲' : '▼';
      }
      minimizeBtn.classList.toggle('minimized', isMinimized);
    }

    // Update container class to trigger grid adjustments
    const container = panelElement.closest('.indicators-container') || panelElement.closest('#indicators-container');
    if (container) {
      const hasMinimized = container.querySelector('.indicator-panel.minimized');
      container.classList.toggle('has-minimized', !!hasMinimized);
    }

    this._updateIndicatorTimeAxisVisibility();

    // Re-render chart when maximized
    if (!isMinimized) {
      setTimeout(() => {
        const chartElement = document.getElementById(`${panelId}-chart`);
        if (chartElement && panel.chart) {
          try {
            panel.chart.resize(chartElement.clientWidth, chartElement.clientHeight);
            // Re-render indicator
            this.updateSinglePanel(panelId);
          } catch (error) {
            console.warn(`Failed to resize panel ${panelId}:`, error);
          }
        }
      }, 350); // Wait for CSS transition
    }

    console.log(`${isMinimized ? '📉' : '📊'} Panel ${panelId} ${isMinimized ? 'minimized' : 'maximized'}`);
  }

  // Maximize all panels in a section
  maximizeAllPanels(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const panels = section.querySelectorAll('.indicator-panel.flexible.minimized');
    panels.forEach(panelElement => {
      const panelId = panelElement.id;
      if (panelId) {
        this.togglePanelMinimize(panelId);
      }
    });

    console.log(`📊 Maximized all panels in section ${sectionId}`);
  }

  // Create indicator panel HTML
  createIndicatorPanel(panelId, containerId, defaultIndicator = 'MACD') {
    console.log(`🎛️ MultiIndicatorSystem: Creating panel ${panelId} in ${containerId} for ${defaultIndicator}`);
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`❌ Container element not found: ${containerId}`);
      console.log('Available containers:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
      return null;
    }
    console.log(`✅ Container found:`, container);

    const panelHTML = `
      <div class="indicator-panel" id="${panelId}">
        <div class="indicator-header">
          <button class="indicator-select-btn" id="${panelId}-select-btn" title="Change indicator">
            <span class="indicator-select-label">${(this.indicatorDefinitions[defaultIndicator] || {}).name || defaultIndicator}</span>
            <span class="chevron-icon">▾</span>
          </button>
          <div class="indicator-legend" id="${panelId}-legend"></div>
          <div class="panel-controls">
            <button class="icon-btn" id="${panelId}-move-up" title="Move panel up">↑</button>
            <button class="icon-btn" id="${panelId}-move-down" title="Move panel down">↓</button>
            <button class="icon-btn" id="${panelId}-settings" title="Indicator settings">⚙</button>
            <button class="icon-btn btn-maximize" id="${panelId}-maximize" title="Maximize panel">⛶</button>
            <button class="btn-minimize" id="${panelId}-minimize" title="Minimize/Maximize"><span id="${panelId}-toggle">▼</span></button>
            <button class="btn-remove-indicator" id="${panelId}-remove" title="Remove Indicator">✕</button>
          </div>
        </div>
        <div class="indicator-chart" id="${panelId}-chart"></div>
        <div class="indicator-resize-handle" id="${panelId}-resize-handle" title="Drag to resize"></div>
        <div class="indicator-settings-popover" id="${panelId}-settings-popover" hidden>
          <div class="indicator-settings-popover-header">
            <span>Settings</span>
            <button class="popover-close" id="${panelId}-settings-close" title="Close">✕</button>
          </div>
          <div class="indicator-params" id="${panelId}-params"></div>
        </div>
      </div>
    `;

    console.log(`Inserting HTML for panel: ${panelId}`);
    container.insertAdjacentHTML('beforeend', panelHTML);
    console.log(`HTML inserted successfully`);

    // Initialize panel
    console.log(`Initializing panel: ${panelId}`);
    const panel = this.initializePanel(panelId, defaultIndicator);
    if (panel) {
      console.log(`Panel initialized successfully: ${panelId}`);
      this.setupPanelEventHandlers(panelId);
      this.setupMinimizeHandler(panelId);
      this.setupRemoveHandler(panelId);
      this.setupResizeHandle(panelId);
      this._updateSectionFlexForPanelCount();
      this._persistLayout();
      setTimeout(() => {
        this.updateAllReorderButtonsState();
        this._refreshTabBarIfTabbed();
        this._updateIndicatorTimeAxisVisibility();
      }, 60);
    } else {
      console.error(`Failed to initialize panel: ${panelId}`);
    }

    return panel;
  }

  // Setup remove indicator handler
  setupRemoveHandler(panelId) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const removeBtn = document.getElementById(`${panelId}-remove`);
      if (!removeBtn) {
        console.warn(`Remove button not found: ${panelId}-remove`);
        return;
      }

      // Remove any existing listeners to prevent duplicates
      const newRemoveBtn = removeBtn.cloneNode(true);
      removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);

      newRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log(`🗑️ Remove button clicked for panel: ${panelId}`);
        if (confirm('Remove this indicator?')) {
          this.removePanel(panelId);
        }
      });
    }, 10);
  }

  // Remove indicator panel
  removePanel(panelId) {
    console.log(`🗑️ Removing indicator panel: ${panelId}`);

    const panelElementBefore = document.getElementById(panelId);
    const wasMaximized = !!(panelElementBefore && panelElementBefore.classList.contains('panel-maximized'));

    const panel = this.panels.get(panelId);
    if (panel) {
      if (panel.chart) {
        try {
          panel.chart.remove();
        } catch (error) {
          console.warn(`Error removing chart for ${panelId}:`, error);
        }
      }
      this.panels.delete(panelId);
    } else {
      console.warn(`Panel not found in panels map: ${panelId}`);
    }
    
    const panelElement = document.getElementById(panelId);
    if (panelElement) {
      try {
        panelElement.remove();
        console.log(`✅ Panel element removed: ${panelId}`);
      } catch (error) {
        console.error(`Error removing panel element ${panelId}:`, error);
      }
    } else {
      console.warn(`Panel element not found in DOM: ${panelId}`);
    }

    if (wasMaximized) {
      const container = document.getElementById('indicators-container');
      if (container) container.classList.remove('has-maximized');
    }

    this.updateAllReorderButtonsState();
    this._refreshTabBarIfTabbed();
    this._updateSectionFlexForPanelCount();
    this._updateIndicatorTimeAxisVisibility();
    this._persistLayout();
    console.log(`🗑️ Removed indicator panel: ${panelId}`);
  }

  // Drag-to-resize an individual panel's chart height. The chart element already
  // has a ResizeObserver attached (see initializePanel) that calls chart.resize()
  // automatically whenever its box size changes, so this only needs to mutate
  // the element's height on drag — no explicit resize call needed here.
  setupResizeHandle(panelId) {
    const handle = document.getElementById(`${panelId}-resize-handle`);
    const chartElement = document.getElementById(`${panelId}-chart`);
    if (!handle || !chartElement) return;

    const MIN_HEIGHT = 110; // keep the chart's own drag floor in step with .indicator-chart's CSS min-height
    const MAX_HEIGHT = 800;
    let dragging = false;
    let startY = 0;
    let startHeight = 0;

    const onMouseMove = (e) => {
      if (!dragging) return;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + (e.clientY - startY)));
      // .indicator-chart uses `flex: 1` (flex-basis: 0%) to fill its panel's
      // remaining space, so plain `height` is ignored for sizing purposes —
      // pin flex-basis to the dragged height instead (flex-grow/shrink: 0
      // so it stops auto-filling once manually resized).
      chartElement.style.setProperty('flex', `0 0 ${newHeight}px`, 'important');
      chartElement.style.setProperty('height', `${newHeight}px`, 'important');
      chartElement.style.setProperty('min-height', `${newHeight}px`, 'important');
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('indicator-resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startHeight = chartElement.clientHeight;
      document.body.classList.add('indicator-resizing');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // Swap a panel's DOM position with its previous/next sibling (direction: -1 up, 1 down)
  movePanel(panelId, direction) {
    const panelElement = document.getElementById(panelId);
    if (!panelElement) return;
    const container = panelElement.parentElement;
    if (!container) return;

    if (direction < 0) {
      const prev = panelElement.previousElementSibling;
      if (prev && prev.classList.contains('indicator-panel')) {
        container.insertBefore(panelElement, prev);
      }
    } else {
      const next = panelElement.nextElementSibling;
      if (next && next.classList.contains('indicator-panel')) {
        container.insertBefore(next, panelElement);
      }
    }

    this.updateAllReorderButtonsState();
    this._refreshTabBarIfTabbed();
    this._updateIndicatorTimeAxisVisibility();
    this._persistLayout();
  }

  // Disable the up-arrow on the first panel and the down-arrow on the last panel
  updateReorderButtonsState(panelId) {
    const panelElement = document.getElementById(panelId);
    if (!panelElement) return;
    const upBtn = document.getElementById(`${panelId}-move-up`);
    const downBtn = document.getElementById(`${panelId}-move-down`);
    const prev = panelElement.previousElementSibling;
    const next = panelElement.nextElementSibling;
    const isFirst = !prev || !prev.classList.contains('indicator-panel');
    const isLast = !next || !next.classList.contains('indicator-panel');
    if (upBtn) {
      upBtn.disabled = isFirst;
      upBtn.classList.toggle('disabled', isFirst);
    }
    if (downBtn) {
      downBtn.disabled = isLast;
      downBtn.classList.toggle('disabled', isLast);
    }
  }

  updateAllReorderButtonsState() {
    document.querySelectorAll('.indicator-panel').forEach(panelEl => {
      this.updateReorderButtonsState(panelEl.id);
    });
  }

  // Expand one panel to fill the whole indicators-container (~300px+), hiding
  // its siblings entirely. Clicking the same button again restores everyone.
  toggleMaximizePanel(panelId) {
    const panelElement = document.getElementById(panelId);
    const container = document.getElementById('indicators-container');
    if (!panelElement || !container) return;

    const wasMaximized = panelElement.classList.contains('panel-maximized');

    // Only one panel can be maximized at a time - clear any previous one first
    container.querySelectorAll('.indicator-panel.panel-maximized').forEach(p => {
      p.classList.remove('panel-maximized');
      const btn = document.getElementById(`${p.id}-maximize`);
      if (btn) {
        btn.textContent = '⛶';
        btn.title = 'Maximize panel';
        btn.classList.remove('active');
      }
    });

    if (!wasMaximized) {
      panelElement.classList.add('panel-maximized');
      container.classList.add('has-maximized');
      const btn = document.getElementById(`${panelId}-maximize`);
      if (btn) {
        btn.textContent = '🗗';
        btn.title = 'Restore standard view';
        btn.classList.add('active');
      }
    } else {
      container.classList.remove('has-maximized');
    }

    this._updateIndicatorTimeAxisVisibility();

    // Resize whatever's now visible once the CSS transition settles
    setTimeout(() => {
      container.querySelectorAll('.indicator-panel').forEach(p => {
        const panelData = this.panels.get(p.id);
        const chartEl = document.getElementById(`${p.id}-chart`);
        if (panelData && panelData.chart && chartEl && chartEl.offsetParent !== null) {
          try {
            panelData.chart.resize(chartEl.clientWidth, chartEl.clientHeight);
          } catch (e) {}
        }
      });
    }, 350);
  }

  // Switch between 'stacked' (all panels rendered) and 'tabbed' (one panel
  // full-height at a time, selected via #indicators-tabbar).
  setViewMode(mode) {
    const container = document.getElementById('indicators-container');
    const tabbar = document.getElementById('indicators-tabbar');
    if (!container) return;

    this.viewMode = mode === 'tabbed' ? 'tabbed' : 'stacked';
    container.classList.toggle('tabbed-view', this.viewMode === 'tabbed');
    if (tabbar) tabbar.hidden = this.viewMode !== 'tabbed';

    if (this.viewMode === 'tabbed') {
      this.renderTabBar();
    } else {
      container.querySelectorAll('.indicator-panel').forEach(p => p.classList.remove('tab-active'));
      this._updateIndicatorTimeAxisVisibility();
      setTimeout(() => {
        container.querySelectorAll('.indicator-panel').forEach(p => {
          const panelData = this.panels.get(p.id);
          const chartEl = document.getElementById(`${p.id}-chart`);
          if (panelData && panelData.chart && chartEl) {
            try {
              panelData.chart.resize(chartEl.clientWidth, chartEl.clientHeight);
            } catch (e) {}
          }
        });
      }, 350);
    }
  }

  // Rebuild the tab bar's buttons from the panels currently in the DOM (in
  // their current order), preserving whichever tab is already active.
  renderTabBar() {
    const tabbar = document.getElementById('indicators-tabbar');
    const container = document.getElementById('indicators-container');
    if (!tabbar || !container) return;

    const panelEls = Array.from(container.querySelectorAll('.indicator-panel'));
    if (!panelEls.length) {
      tabbar.innerHTML = '';
      return;
    }

    const currentActive = container.querySelector('.indicator-panel.tab-active');
    let activeId = currentActive ? currentActive.id : null;
    if (!activeId || !panelEls.some(p => p.id === activeId)) {
      activeId = panelEls[0].id;
    }

    tabbar.innerHTML = panelEls.map(p => {
      const panelData = this.panels.get(p.id);
      const def = panelData ? this.indicatorDefinitions[panelData.indicatorType] : null;
      const name = def ? def.name : p.id;
      const isActive = p.id === activeId;
      return `<button type="button" class="indicator-tab-btn${isActive ? ' active' : ''}" data-panel-id="${p.id}">${name}</button>`;
    }).join('');

    tabbar.querySelectorAll('.indicator-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._activateTab(btn.dataset.panelId));
    });

    this._activateTab(activeId);
  }

  _activateTab(panelId) {
    const container = document.getElementById('indicators-container');
    const tabbar = document.getElementById('indicators-tabbar');
    if (!container) return;

    container.querySelectorAll('.indicator-panel').forEach(p => {
      p.classList.toggle('tab-active', p.id === panelId);
    });
    if (tabbar) {
      tabbar.querySelectorAll('.indicator-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panelId === panelId);
      });
    }

    this._updateIndicatorTimeAxisVisibility();

    setTimeout(() => {
      const panelData = this.panels.get(panelId);
      const chartEl = document.getElementById(`${panelId}-chart`);
      if (panelData && panelData.chart && chartEl) {
        try {
          panelData.chart.resize(chartEl.clientWidth, chartEl.clientHeight);
        } catch (e) {}
      }
    }, 350);
  }

  _refreshTabBarIfTabbed() {
    if (this.viewMode === 'tabbed') this.renderTabBar();
  }

  // Custom Y-axis "last value" badges with collision avoidance. Native
  // lastValueVisible badges are disabled for every series (see the
  // addLineSeries/addHistogramSeries wrapping in initializePanel) because
  // lightweight-charts draws each one at its own exact price coordinate with
  // no awareness of its neighbors - when two series' values are close (e.g.
  // KD's %K/%D crossing), their badges land on top of each other. This
  // rebuilds them as absolutely-positioned DOM badges, sorted by vertical
  // position and pushed apart just enough to stay legible.
  _renderYAxisBadges(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.series || !panel.seriesArrays) return;
    const chartElement = document.getElementById(`${panelId}-chart`);
    if (!chartElement) return;

    let badgeLayer = document.getElementById(`${panelId}-y-badges`);
    if (!badgeLayer) {
      badgeLayer = document.createElement('div');
      badgeLayer.id = `${panelId}-y-badges`;
      badgeLayer.className = 'y-axis-badges';
      chartElement.appendChild(badgeLayer);
    }

    const entries = [];
    panel.series.forEach((series) => {
      const arr = panel.seriesArrays.get(series);
      const point = arr && arr.length ? arr[arr.length - 1] : null;
      if (!point) return;
      const value = point.value !== undefined ? point.value : point.close;
      if (value == null || !isFinite(value)) return;
      let y = null;
      try { y = series.priceToCoordinate(value); } catch (e) {}
      if (y == null || !isFinite(y)) return;
      let color = '#94a3b8';
      try { color = series.options().color || color; } catch (e) {}
      entries.push({ y, value, color });
    });

    if (!entries.length) {
      badgeLayer.innerHTML = '';
      return;
    }

    entries.sort((a, b) => a.y - b.y);
    const MIN_GAP = 19; // badges render ~16px tall; this leaves a couple of px of visible clearance
    for (let i = 1; i < entries.length; i++) {
      const minY = entries[i - 1].y + MIN_GAP;
      if (entries[i].y < minY) entries[i].y = minY;
    }

    badgeLayer.innerHTML = entries.map(e => `<span class="y-axis-badge" style="top:${e.y}px; background:${e.color};">${e.value.toFixed(2)}</span>`).join('');
  }

  // Only the bottom-most panel that's actually showing its chart keeps its
  // x-axis (date) labels - every other stacked panel hides them, since the
  // synced time scale means every panel already lines up under the same
  // dates anyway. "Bottom-most" is recomputed among whichever panels are
  // currently visible, so maximize/tabbed/minimize/reorder all stay correct.
  _updateIndicatorTimeAxisVisibility() {
    const container = document.getElementById('indicators-container');
    if (!container) return;

    const panelEls = Array.from(container.querySelectorAll('.indicator-panel')).filter(el => {
      return getComputedStyle(el).display !== 'none' && !el.classList.contains('minimized');
    });

    panelEls.forEach((el, idx) => {
      const isLastVisible = idx === panelEls.length - 1;
      const panel = this.panels.get(el.id);
      if (panel && panel.chart) {
        try {
          panel.chart.timeScale().applyOptions({ visible: isLastVisible });
        } catch (e) {}
      }
    });

    // The main chart only needs its own date row when there's no indicator
    // panel below to show one instead - otherwise that's two date axes for
    // one timeline. Falls back to showing it whenever every panel is
    // minimized/removed, so a date axis is always visible somewhere.
    try {
      const mainChart = window.TradeFlowChart && window.TradeFlowChart.getChart && window.TradeFlowChart.getChart();
      if (mainChart) mainChart.timeScale().applyOptions({ visible: panelEls.length === 0 });
    } catch (e) {}
  }

  // #chart stays fixed at flex:3 (see stock-market/index.html); #indicators-section's
  // own flex-grow is set to the live panel count so each panel keeps an even
  // ~1-share of it (flex:3 chart vs flex:n indicators => n panels each get
  // ~1/(3+n) of the viewport). Fewer panels means a smaller total weight for
  // indicators-section, so the chart and the remaining panels naturally expand
  // to fill the freed space instead of the indicators area staying pinned at 50%.
  _updateSectionFlexForPanelCount() {
    const section = document.getElementById('indicators-section');
    const container = document.getElementById('indicators-container');
    if (!section || !container) return;

    const n = container.querySelectorAll('.indicator-panel').length;
    if (n <= 0) {
      section.style.flex = '0 0 auto';
      section.style.minHeight = '0';
    } else {
      section.style.flex = `${n} 1 0%`;
      section.style.minHeight = '';
    }
  }

  // Chart layout persistence - saves which indicators are active (in their
  // current DOM/reorder order), plus each one's own parameters, so a page
  // reload restores the same setup. The host page opts in with a storage key
  // (see stock-app.prod.js's setupIndicatorSystem) rather than this running
  // unconditionally, since not every page embedding this class wants it.
  enableLayoutPersistence(storageKey) {
    this._layoutStorageKey = storageKey;
  }

  _persistLayout() {
    if (!this._layoutStorageKey) return;
    this.saveLayout(this._layoutStorageKey);
  }

  saveLayout(storageKey) {
    try {
      const container = document.getElementById('indicators-container');
      if (!container) return;
      const layout = Array.from(container.querySelectorAll('.indicator-panel'))
        .map(el => this.panels.get(el.id))
        .filter(Boolean)
        .map(panel => ({ indicatorType: panel.indicatorType, params: panel.params }));
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch (e) {}
  }

  loadLayout(storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  initializePanel(panelId, indicatorType) {
    console.log(`Initializing panel chart: ${panelId}-chart`);
    const chartElement = document.getElementById(`${panelId}-chart`);
    if (!chartElement) {
      console.error(`Chart element not found: ${panelId}-chart`);
      return null;
    }
    console.log(`Chart element found:`, chartElement);
    
    // Size comes from the CSS flex layout (.indicator-chart flex:1), not a fixed
    // inline pixel height - a hardcoded height/min-height here would silently
    // override the responsive flex sizing regardless of the panel's real space.
    chartElement.style.display = 'block';
    chartElement.style.position = 'relative';
    console.log(`Chart element dimensions set: ${chartElement.offsetWidth}x${chartElement.offsetHeight}`);

    // Create chart
    console.log(`Creating LightweightChart for panel: ${panelId}`);
    if (typeof LightweightCharts === 'undefined') {
      console.error('LightweightCharts is not available');
      return null;
    }
    const chart = LightweightCharts.createChart(chartElement, {
      layout: {
        background: { color: '#0b0f14' },
        textColor: '#e6edf3'
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#13202e' }
      },
      rightPriceScale: {
        borderColor: '#1f2a36',
        visible: this.displayOptions.showPriceScale,
        scaleMargins: this.displayOptions.priceScaleMargins,
        borderVisible: true,
        minimumWidth: PRICE_SCALE_ALIGN_WIDTH,
      },
      leftPriceScale: {
        visible: false
      },
      timeScale: {
        borderColor: '#1f2a36',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: TIME_SCALE_RIGHT_OFFSET,
        barSpacing: TIME_SCALE_BAR_SPACING,
        fixLeftEdge: true,
        fixRightEdge: true,
        lockVisibleTimeRangeOnResize: true
      },
      crosshair: {
        mode: 0,
        vertLine: {
          labelVisible: false  // Hide vertical crosshair label
        },
        horzLine: {
          labelVisible: true   // Keep horizontal price label
        }
      },
      // NOTE: lightweight-charts v3.8.0 (pinned in index.html) has no
      // autoSize option - sizing is handled entirely by the manual
      // ResizeObserver + _scheduleQuietRender below. Do not add autoSize
      // here; it's silently ignored by this version and just misleads
      // readers into thinking the library manages resize on its own.
      // Enhanced touch and mobile support
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      }
    });

    try {
      chart.priceScale('right').applyOptions({ minimumWidth: PRICE_SCALE_ALIGN_WIDTH });
    } catch (e) {}

    // Every indicator series gets its native last-value badge disabled and its
    // full data array tracked in `seriesArrays`, regardless of which of the
    // 120+ indicator definitions creates it - this build of the library has
    // no series.data() getter, so tracking it here (once, generically) is the
    // only way to read values back later for: the custom collision-avoided
    // Y-axis badges in _renderYAxisBadges (native badges have no such
    // avoidance and stack illegibly when two series' values are close), and
    // the unified crosshair tooltip in _updateUnifiedTooltip (which needs a
    // series' value at an arbitrary hovered time, not just its latest one).
    const seriesArrays = new Map();
    ['addLineSeries', 'addHistogramSeries', 'addAreaSeries', 'addBarSeries', 'addBaselineSeries'].forEach(factoryName => {
      if (typeof chart[factoryName] !== 'function') return;
      const original = chart[factoryName].bind(chart);
      chart[factoryName] = (options = {}) => {
        const series = original({ ...options, lastValueVisible: false });
        const originalSetData = series.setData.bind(series);
        series.setData = (data) => {
          if (Array.isArray(data)) seriesArrays.set(series, data);
          return originalSetData(data);
        };
        const originalUpdate = series.update.bind(series);
        series.update = (bar) => {
          if (bar) {
            const arr = seriesArrays.get(series) || [];
            const idx = arr.findIndex(d => d.time === bar.time);
            if (idx >= 0) arr[idx] = bar; else arr.push(bar);
            seriesArrays.set(series, arr);
          }
          return originalUpdate(bar);
        };
        return series;
      };
    });

    // Create panel object with deep parameter cloning
    const defaultParams = this.indicatorDefinitions[indicatorType].defaultParams || {};
    const panel = {
      id: panelId,
      chart: chart,
      seriesArrays,
      indicatorType: indicatorType,
      series: new Map(),
      params: JSON.parse(JSON.stringify(defaultParams)) // Deep clone to ensure isolation
    };

    this.panels.set(panelId, panel);

    // Synced-crosshair overlay line for this panel (see _broadcastCrosshairTime)
    const xLine = document.createElement('div');
    xLine.id = `${panelId}-xline`;
    xLine.className = 'crosshair-sync-line';
    chartElement.appendChild(xLine);

    // Broadcast this panel's hovered time to the main chart and every other
    // panel so the crosshair stays vertically in sync across all of them.
    chart.subscribeCrosshairMove((param) => {
      this._broadcastCrosshairTime(param && param.time != null ? param.time : null, chart);
    });

    // Setup enhanced resize observer for better zoom handling
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Debounced resize to prevent too many calls during zoom
          clearTimeout(panel.resizeTimeout);
          panel.resizeTimeout = setTimeout(() => {
            try {
              chart.resize(width, height);
              // Schedule a single debounced render once resizing goes quiet,
              // rather than rendering here directly - a render can itself
              // shift layout by a pixel and retrigger this same observer,
              // so calling updatePanel() synchronously risks a resize/render loop.
              this._scheduleQuietRender();
              console.log(`🔄 Resized ${panelId}: ${width}x${height}`);
            } catch (error) {
              console.warn(`Failed to resize ${panelId}:`, error.message);
            }
          }, 100);
        }
      }
    });
    resizeObserver.observe(chartElement);
    
    // Store resize observer for cleanup
    panel.resizeObserver = resizeObserver;
    
    // Force initial resize after a short delay to ensure dimensions are set
    setTimeout(() => {
      const w = chartElement.offsetWidth || chartElement.clientWidth || 800;
      const h = chartElement.offsetHeight || chartElement.clientHeight || 180;
      if (w > 0 && h > 0) {
        try {
          chart.resize(w, h);
          this._scheduleQuietRender();
          console.log(`🔄 Initial resize ${panelId}: ${w}x${h}`);
        } catch (error) {
          console.warn(`Failed initial resize ${panelId}:`, error.message);
        }
      }
    }, 300);

    // Setup time scale sync and zoom sync
    if (this.syncEnabled) {
      this.syncTimeScale(chart);
      this.setupZoomSync(panelId, chart.timeScale());
    }

    // Update parameters display
    this.updateParametersDisplay(panelId);

    return panel;
  }

  setupPanelEventHandlers(panelId) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const selectBtn = document.getElementById(`${panelId}-select-btn`);
      const settings = document.getElementById(`${panelId}-settings`);
      const maximizeBtn = document.getElementById(`${panelId}-maximize`);
      const moveUpBtn = document.getElementById(`${panelId}-move-up`);
      const moveDownBtn = document.getElementById(`${panelId}-move-down`);
      const panelPanLeft = document.getElementById(`${panelId}-pan-left`);
      const panelPanRight = document.getElementById(`${panelId}-pan-right`);
      const panelZoomIn = document.getElementById(`${panelId}-zoom-in`);
      const panelZoomOut = document.getElementById(`${panelId}-zoom-out`);

      if (selectBtn) {
        selectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openIndicatorPicker(panelId);
        });
      } else {
        console.warn(`⚠️ Select button not found: ${panelId}-select-btn`);
      }

      if (moveUpBtn) {
        moveUpBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.movePanel(panelId, -1);
        });
      }

      if (moveDownBtn) {
        moveDownBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.movePanel(panelId, 1);
        });
      }

      this.updateReorderButtonsState(panelId);

      if (settings) {
        settings.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showSettingsDialog(panelId);
        });
      }

      if (maximizeBtn) {
        maximizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleMaximizePanel(panelId);
        });
      }

      // Setup indicator panel navigation controls
    const panel = this.panels.get(panelId);
    if (!panel) return;
    
    const getRange = () => panel.chart?.timeScale().getVisibleLogicalRange();
    const setRange = (range) => {
      if (!range || !panel.chart) return;
      try {
        // Update this panel
        panel.chart.timeScale().setVisibleLogicalRange(range);
        // Sync with main chart and other indicators through the zoom sync system
      } catch (e) {
        console.warn(`Failed to set range for ${panelId}:`, e.message);
      }
    };
    
    // Pan functions with strict data boundaries - syncs across all panels
    function panIndicator(direction) {
      const range = getRange();
      if (!range || !this.chartData?.length) return;
      
      const dataMin = 0;
      const dataMax = this.chartData.length - 1;
      const span = range.to - range.from;
      const panAmount = span * 0.3 * direction;
      
      let newFrom = range.from + panAmount;
      let newTo = range.to + panAmount;
      
      // Strict boundary enforcement - no blank space allowed
      if (newFrom < dataMin) {
        newFrom = dataMin;
        newTo = dataMin + span;
      }
      if (newTo > dataMax) { // Stop exactly at last data point
        newTo = dataMax;
        newFrom = dataMax - span;
        // Ensure we don't go below minimum
        if (newFrom < dataMin) {
          newFrom = dataMin;
          newTo = Math.min(dataMin + span, dataMax);
        }
      }
      
      const finalRange = { from: Math.max(dataMin, newFrom), to: Math.min(dataMax, newTo) };
      
      // Set range on current panel - this will trigger sync via setupZoomSync
      setRange(finalRange);
      
      // Manually sync to all other panels including main chart
      if (this.syncEnabled) {
        this.isUpdatingRange = true;
        try {
          // Sync to main chart
          if (this.mainTimeScale) {
            this.mainTimeScale.setVisibleLogicalRange(finalRange);
          }
          
          // Sync to all other indicator panels
          this.panels.forEach((p, id) => {
            if (id !== panelId && p.chart) { // Don't sync to itself
              try {
                p.chart.timeScale().setVisibleLogicalRange(finalRange);
              } catch (e) {
                console.warn(`Failed to sync pan to panel ${id}:`, e.message);
              }
            }
          });
        } catch (error) {
          console.warn('Error during pan sync:', error.message);
        } finally {
          this.isUpdatingRange = false;
        }
      }
    }
    
    // Zoom: zoom-in has minimum span; zoom-out can show full data (first to last entry)
    function zoomIndicator(factor) {
      if (!this.chartData?.length) return;
      let range = getRange();
      const dataMin = 0;
      const dataMax = this.chartData.length - 1;
      const fullSpan = dataMax - dataMin + 1;
      if (!range || range.from == null || range.to == null) {
        range = { from: Math.max(0, dataMax - 50), to: dataMax };
        setRange(range);
      }
      const currentSpan = range.to - range.from;
      const center = (range.from + range.to) / 2;
      const newSpan = currentSpan * factor;

      const minSpan = 10;
      const maxSpan = fullSpan;

      // Zoom out: if new span would cover full data or more, show all data (first to last entry)
      if (factor > 1 && newSpan >= fullSpan) {
        const fullRange = { from: dataMin, to: dataMax };
        if (this.syncEnabled) this.isUpdatingRange = true;
        try {
          setRange(fullRange);
          if (this.syncEnabled) {
            if (this.mainTimeScale) this.mainTimeScale.setVisibleLogicalRange(fullRange);
            this.panels.forEach((p, id) => {
              if (id !== panelId && p.chart) {
                try { p.chart.timeScale().setVisibleLogicalRange(fullRange); } catch (e) {}
              }
            });
          }
        } finally {
          if (this.syncEnabled) this.isUpdatingRange = false;
        }
        return;
      }

      const clampedSpan = Math.max(minSpan, Math.min(maxSpan, newSpan));
      const halfSpan = clampedSpan / 2;
      let newFrom = center - halfSpan;
      let newTo = center + halfSpan;

      if (newFrom < dataMin) {
        newFrom = dataMin;
        newTo = Math.min(dataMin + clampedSpan, dataMax);
      } else if (newTo > dataMax) {
        newTo = dataMax;
        newFrom = Math.max(dataMax - clampedSpan, dataMin);
      }

      const finalRange = {
        from: Math.max(dataMin, Math.min(newFrom, dataMax)),
        to: Math.max(dataMin, Math.min(newTo, dataMax))
      };
      if (finalRange.to > finalRange.from) setRange(finalRange);
    }
    
    // Bind functions to correct context
    const boundPanIndicator = panIndicator.bind(this);
    const boundZoomIndicator = zoomIndicator.bind(this);
    
    // Event listeners
    if (panelPanLeft) {
      panelPanLeft.addEventListener('click', () => boundPanIndicator(-1));
      panelPanLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        panelPanLeft.style.transform = 'scale(0.9)';
      });
      panelPanLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        panelPanLeft.style.transform = '';
      });
    }
    
    if (panelPanRight) {
      panelPanRight.addEventListener('click', () => boundPanIndicator(1));
      panelPanRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        panelPanRight.style.transform = 'scale(0.9)';
      });
      panelPanRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        panelPanRight.style.transform = '';
      });
    }
    
    if (panelZoomIn) {
      // Zoom in: factor 0.95 (much more gradual, prevents too close view)
      panelZoomIn.addEventListener('click', () => boundZoomIndicator(0.95));
      panelZoomIn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        panelZoomIn.style.transform = 'scale(0.9)';
      });
      panelZoomIn.addEventListener('touchend', (e) => {
        e.preventDefault();
        panelZoomIn.style.transform = '';
      });
    }
    
      if (panelZoomOut) {
        // Zoom out: factor 1.1 (gradual; can eventually show full data)
        panelZoomOut.addEventListener('click', () => boundZoomIndicator(1.1));
        panelZoomOut.addEventListener('touchstart', (e) => {
          e.preventDefault();
          panelZoomOut.style.transform = 'scale(0.9)';
        });
        panelZoomOut.addEventListener('touchend', (e) => {
          e.preventDefault();
          panelZoomOut.style.transform = '';
        });
      }
    }, 10);
  }

  changeIndicator(panelId, newIndicatorType) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    console.log(`🔄 Changing indicator for panel ${panelId} to ${newIndicatorType} - ISOLATED UPDATE`);

    // Set flag to indicate this is an isolated update
    this.isParameterUpdate = true;

    // Clear existing series
    panel.series.forEach(series => {
      try {
        panel.chart.removeSeries(series);
      } catch (e) {
        console.warn(`Failed to remove series:`, e.message);
      }
    });
    panel.series.clear();
    if (panel.seriesArrays) panel.seriesArrays.clear();

    // Update panel with deep parameter cloning
    panel.indicatorType = newIndicatorType;
    const defaultParams = this.indicatorDefinitions[newIndicatorType].defaultParams || {};
    panel.params = JSON.parse(JSON.stringify(defaultParams)); // Deep clone to ensure isolation

    // Update UI
    this.updateParametersDisplay(panelId);
    const labelSpan = document.querySelector(`#${panelId}-select-btn .indicator-select-label`);
    if (labelSpan) labelSpan.textContent = this.indicatorDefinitions[newIndicatorType].name;
    this._refreshTabBarIfTabbed();
    this._persistLayout();

    // Recompute and render ONLY THIS PANEL - use updateSinglePanel to prevent cascade
    if (this.chartData.length > 0) {
      this.updateSinglePanel(panelId);
      setTimeout(() => this._healDegenerateRenders(), 2000);
    }

    // Clear the flag
    this.isParameterUpdate = false;

    console.log(`✅ Indicator changed for panel ${panelId} - other panels unchanged`);
  }

  updateParametersDisplay(panelId) {
    const panel = this.panels.get(panelId);
    const paramsContainer = document.getElementById(`${panelId}-params`);

    if (!panel || !paramsContainer) return;

    const definition = this.indicatorDefinitions[panel.indicatorType];
    const paramLabels = definition.paramLabels || {};
    const paramOptions = definition.paramOptions || {};

    // Check if this indicator allows parameter editing
    const isEditable = definition.editable !== false;
    
    let html = '';
    Object.entries(panel.params).forEach(([key, value]) => {
      const label = paramLabels[key] || key;
      
      if (!isEditable) {
        // Create read-only display for non-editable indicators
        html += `
          <div class="indicator-param">
            <span>${label}: <strong style="color: #58a6ff;">${value}</strong></span>
          </div>
        `;
      } else if (paramOptions[key] && Array.isArray(paramOptions[key])) {
        // Create dropdown for parameters with predefined options
        html += `
          <div class="indicator-param">
            <span>${label}:</span>
            <select id="${panelId}-param-${key}" style="width: 80px;">
              ${paramOptions[key].map(option => 
                `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`
              ).join('')}
            </select>
          </div>
        `;
      } else {
        // Create number input for numeric parameters
        html += `
          <div class="indicator-param">
            <span>${label}:</span>
            <input type="number"
                   id="${panelId}-param-${key}"
                   value="${value}"
                   min="0"
                   step="any"
                   style="width: 50px;">
          </div>
        `;
      }
    });

    paramsContainer.innerHTML = html;

    // Add event listeners to parameter inputs - ensure panel isolation (only for editable indicators)
    if (isEditable) {
      Object.keys(panel.params).forEach(key => {
        const input = document.getElementById(`${panelId}-param-${key}`);
        if (input) {
        // Remove any existing listeners to prevent duplicates
        input.removeEventListener('change', input._paramChangeHandler);
        
        // Create a new handler specifically for this panel with explicit isolation
        const paramChangeHandler = (e) => {
          // Prevent event propagation to avoid triggering other handlers
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const targetPanel = this.panels.get(panelId);
          if (!targetPanel) return;
          
          const _raw = parseFloat(e.target.value);
          const newValue = input.tagName === 'SELECT' ? e.target.value :
                          (!isNaN(_raw) ? _raw : targetPanel.params[key]);
          
          // Set flag to indicate this is a parameter-driven update
          this.isParameterUpdate = true;
          
          // Update only this specific panel's parameters
          targetPanel.params[key] = newValue;
          
          console.log(`📊 Panel ${panelId} parameter ${key} changed to ${newValue} - ISOLATED UPDATE`);
          
          // Update only this specific panel - NO OTHER PANELS OR MAIN CHART
          this.updateSinglePanel(panelId);
          this._persistLayout();

          // Clear the flag after update
          this.isParameterUpdate = false;
          
          // Prevent any default behavior
          e.preventDefault();
        };
        
        // Store reference for cleanup and add listener
        input._paramChangeHandler = paramChangeHandler;
        input.addEventListener('change', paramChangeHandler);
        }
      });
    } // End of isEditable check
    
    // Update legend display
    this.updateLegendDisplay(panelId);
  }

  // `atIndex`, when given, shows the value at that bar (e.g. the one under a
  // synced crosshair hover) instead of the most recent one - see
  // _updateLegendsForHoverTime, which is how the unified tooltip gets
  // correctly-labeled values per indicator type without duplicating this
  // switch statement's formatting logic.
  updateLegendDisplay(panelId, indicatorData = null, atIndex = null) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    const legendContainer = document.getElementById(`${panelId}-legend`);
    if (!legendContainer) return;

    // Build legend with current values
    let legendHTML = '';

    // Get the value at `atIndex` (or the last one if not given) from indicator data.
    // Many indicators' compute() output is shorter than this.chartData (the
    // lead-in period is simply absent, not null-padded) and gets right-aligned
    // against chartData at render time (see seriesWithLeadInPadding) - so an
    // atIndex meant for chartData has to be shifted by that same length
    // difference before indexing into these raw (possibly shorter) arrays.
    const getLastValue = (data) => {
      if (!data) return null;
      if (Array.isArray(data)) {
        let idx;
        if (atIndex != null) {
          const offset = this.chartData.length - data.length;
          idx = atIndex - offset;
        } else {
          idx = data.length - 1;
        }
        const val = idx >= 0 && idx < data.length ? data[idx] : null;
        return val != null ? val.toFixed(2) : '-';
      }
      return null;
    };

    // Build legend based on indicator type and data
    switch(panel.indicatorType) {
      case 'MACD':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● MACD: ${getLastValue(indicatorData.macd)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● Signal: ${getLastValue(indicatorData.signal)}</span>
            <span style="color: #888; margin-right: 10px;">● Hist: ${getLastValue(indicatorData.hist)}</span>
          `;
        }
        break;
      case 'RSI':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● RSI(${panel.params.periodA || 5}): ${getLastValue(indicatorData.rsiA)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● RSI(${panel.params.periodB || 10}): ${getLastValue(indicatorData.rsiB)}</span>
          `;
        }
        break;
      case 'VOL_RSI':
        if (indicatorData) {
          const p = panel.params.period || 10;
          const volVal = getLastValue(indicatorData.volRsi);
          const eVal = getLastValue(indicatorData.eVolRsi);
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● Vol RSI(${p}): ${volVal != null ? volVal.toFixed(2) : '-'}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● eVol RSI: ${eVal != null ? eVal.toFixed(2) : '-'}</span>
          `;
        }
        break;
      case 'STOCH':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● %K: ${getLastValue(indicatorData.k)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● %D: ${getLastValue(indicatorData.d)}</span>
          `;
        }
        break;
      case 'NEW_KD':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● K: ${getLastValue(indicatorData.K)}</span>
            <span style="color: ${this.colors.LINE3}; margin-right: 10px;">● K2: ${getLastValue(indicatorData.K2)}</span>
            <span style="color: ${this.colors.LINE6}; margin-right: 10px;">● D2: ${getLastValue(indicatorData.D2)}</span>
          `;
        }
        break;
      case 'WANG_KD':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● K: ${getLastValue(indicatorData.k)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● D: ${getLastValue(indicatorData.d)}</span>
          `;
        }
        break;
      case 'WANG_WR':
        if (indicatorData && Array.isArray(indicatorData)) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● %R: ${getLastValue(indicatorData)}</span>
          `;
        }
        break;
      case 'BIAS':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BIAS1: ${getLastValue(indicatorData.bias1)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● BIAS2: ${getLastValue(indicatorData.bias2)}</span>
          `;
        }
        break;
      case 'BBI3':
        if (indicatorData) {
          const rr = indicatorData.RR != null ? indicatorData.RR.toFixed(2) : '-';
          const accRR = indicatorData.Acc_RR != null ? indicatorData.Acc_RR.toFixed(2) : '-';
          const bsTimes = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BBI3: ${getLastValue(indicatorData.bbi3)}</span>
            <span style="color: #4ade80; margin-right: 10px;">RR: ${rr}%</span>
            <span style="color: #60a5fa; margin-right: 10px;">Acc_RR: ${accRR}%</span>
            <span style="color: #fbbf24; margin-right: 10px;">BS: ${bsTimes}</span>
          `;
        }
        break;
      case 'BBI4':
        if (indicatorData) {
          const rr = indicatorData.RR != null ? indicatorData.RR.toFixed(2) : '-';
          const accRR = indicatorData.Acc_RR != null ? indicatorData.Acc_RR.toFixed(2) : '-';
          const bsTimes = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BBI4: ${getLastValue(indicatorData.bbi4)}</span>
            <span style="color: #4ade80; margin-right: 10px;">RR: ${rr}%</span>
            <span style="color: #60a5fa; margin-right: 10px;">Acc_RR: ${accRR}%</span>
            <span style="color: #fbbf24; margin-right: 10px;">BS: ${bsTimes}</span>
          `;
        }
        break;
      case 'BBI5':
        if (indicatorData) {
          const rr = indicatorData.RR != null ? indicatorData.RR.toFixed(2) : '-';
          const accRR = indicatorData.Acc_RR != null ? indicatorData.Acc_RR.toFixed(2) : '-';
          const bsTimes = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BBI5: ${getLastValue(indicatorData.bbi5)}</span>
            <span style="color: #4ade80; margin-right: 10px;">RR: ${rr}%</span>
            <span style="color: #60a5fa; margin-right: 10px;">Acc_RR: ${accRR}%</span>
            <span style="color: #fbbf24; margin-right: 10px;">BS: ${bsTimes}</span>
          `;
        }
        break;
      case 'BBI3RR':
        if (indicatorData) {
          const rr = indicatorData.RR != null ? indicatorData.RR.toFixed(2) : '-';
          const accRR = indicatorData.Acc_RR != null ? indicatorData.Acc_RR.toFixed(2) : '-';
          const bsTimes = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BBI3RR: ${getLastValue(indicatorData.bbi3)}</span>
            <span style="color: #4ade80; margin-right: 10px;">RR: ${rr}%</span>
            <span style="color: #60a5fa; margin-right: 10px;">Acc_RR: ${accRR}%</span>
            <span style="color: #fbbf24; margin-right: 10px;">BS: ${bsTimes}</span>
          `;
        }
        break;
      case 'BBI4RR':
        if (indicatorData) {
          const rr = indicatorData.RR != null ? indicatorData.RR.toFixed(2) : '-';
          const accRR = indicatorData.Acc_RR != null ? indicatorData.Acc_RR.toFixed(2) : '-';
          const bsTimes = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BBI4RR: ${getLastValue(indicatorData.bbi4)}</span>
            <span style="color: #4ade80; margin-right: 10px;">RR: ${rr}%</span>
            <span style="color: #60a5fa; margin-right: 10px;">Acc_RR: ${accRR}%</span>
            <span style="color: #fbbf24; margin-right: 10px;">BS: ${bsTimes}</span>
          `;
        }
        break;
      case 'BBI5RR':
        if (indicatorData) {
          const rr = indicatorData.RR != null ? indicatorData.RR.toFixed(2) : '-';
          const accRR = indicatorData.Acc_RR != null ? indicatorData.Acc_RR.toFixed(2) : '-';
          const bsTimes = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● BBI5RR: ${getLastValue(indicatorData.bbi5)}</span>
            <span style="color: #4ade80; margin-right: 10px;">RR: ${rr}%</span>
            <span style="color: #60a5fa; margin-right: 10px;">Acc_RR: ${accRR}%</span>
            <span style="color: #fbbf24; margin-right: 10px;">BS: ${bsTimes}</span>
          `;
        }
        break;
      case 'OSC':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● OSC1: ${getLastValue(indicatorData.osc1)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● OSC2: ${getLastValue(indicatorData.osc2)}</span>
          `;
        }
        break;
      case 'MBIAS':
        if (indicatorData) {
          legendHTML = `<span style="color: ${this.colors.LINE1};">● MBIAS: ${getLastValue(indicatorData.mbias)}</span>`;
        }
        break;
      case 'UOSC':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● UOSC1: ${getLastValue(indicatorData.uosc1)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● UOSC2: ${getLastValue(indicatorData.uosc2)}</span>
          `;
        }
        break;
      case 'ROC_DUAL':
        if (indicatorData && (indicatorData.ROC1 || indicatorData.ROC2)) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● ROC1: ${getLastValue(indicatorData.ROC1)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● ROC2: ${getLastValue(indicatorData.ROC2)}</span>
          `;
        }
        break;
      case 'OBV_ALT':
        if (indicatorData && (indicatorData.OBV || indicatorData.eOBV)) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● OBV: ${getLastValue(indicatorData.OBV)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● eOBV: ${getLastValue(indicatorData.eOBV)}</span>
          `;
        }
        break;
      case 'MAoneMAtwo':
        if (indicatorData) {
          const acc = indicatorData.Acc_RR != null ? Number(indicatorData.Acc_RR).toFixed(2) : '-';
          const avg = indicatorData.Avg_RR != null ? Number(indicatorData.Avg_RR).toFixed(2) : '-';
          const bs = indicatorData.BS_times != null ? indicatorData.BS_times : '-';
          const lastTrade =
            indicatorData.rrTradePct && Array.isArray(indicatorData.rrTradePct)
              ? [...indicatorData.rrTradePct].reverse().find((x) => x != null && Number.isFinite(x))
              : null;
          const lastRR = lastTrade != null ? lastTrade.toFixed(2) : '-';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 8px;">● MA1: ${getLastValue(indicatorData.line1)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 8px;">● MA2: ${getLastValue(indicatorData.line2)}</span>
            <span style="color: ${this.colors.LINE3 || '#60a5fa'}; margin-right: 8px;">● ΣRR%: ${getLastValue(indicatorData.line3)}</span>
            <span style="color: #4ade80; margin-right: 8px;">Last trade: ${lastRR}%</span>
            <span style="color: #60a5fa; margin-right: 8px;">Acc: ${acc}%</span>
            <span style="color: #fbbf24; margin-right: 8px;">n=${bs}</span>
            <span style="color: #94a3b8;">Avg: ${avg}%</span>
          `;
        }
        break;
      case 'MAone_MAtwo':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 8px;">● MA1: ${getLastValue(indicatorData.line1)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 8px;">● MA2: ${getLastValue(indicatorData.line2)}</span>
            <span style="color: ${this.colors.LINE3 || '#94a3b8'}; margin-right: 8px;">● Close: ${getLastValue(indicatorData.line3)}</span>
          `;
        }
        break;
      case 'AlphaBetaMA':
        if (indicatorData) {
          const trades = indicatorData.sum_Buy_Sell_times ?? 0;
          const roi = indicatorData.sum_ROI != null ? indicatorData.sum_ROI.toFixed(2) : '0.00';
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 8px;">● MA: ${getLastValue(indicatorData.MA)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 8px;">● Close: ${getLastValue(indicatorData.STK_close)}</span>
            <span style="color: #94a3b8; margin-right: 8px;">| Trades: ${trades}</span>
            <span style="color: ${indicatorData.sum_ROI >= 0 ? '#22c55e' : '#ef4444'};">ROI: ${roi}%</span>
          `;
        }
        break;
      case 'ARBR':
      case 'SYARBR':
        if (indicatorData) {
          legendHTML = `
            <span style="color: ${this.colors.LINE1}; margin-right: 10px;">● AR: ${getLastValue(indicatorData.ar)}</span>
            <span style="color: ${this.colors.LINE2}; margin-right: 10px;">● BR: ${getLastValue(indicatorData.br)}</span>
          `;
        }
        break;
      case 'VOLUME':
        if (indicatorData) {
          const volMAValue = indicatorData.volMA ? getLastValue(indicatorData.volMA) : null;
          legendHTML = `
            <span style="color: ${this.colors.VOLUME}; margin-right: 10px;">● Volume: ${getLastValue(indicatorData.volumes)}</span>
            ${volMAValue != null ? `<span style="color: #f59e0b;">● VolMA: ${volMAValue}</span>` : ''}
          `;
        }
        break;
      default:
        // For other indicators, show just the name
        legendHTML = `<span style="color: ${this.colors.LINE1};">● ${panel.indicatorType}</span>`;
    }
    
    legendContainer.innerHTML = `<div style="font-size: 0.85em; white-space: nowrap;">${legendHTML}</div>`;
  }

  updateAllPanels(chartData) {
    console.log(`📊 MultiIndicatorSystem: Updating ${this.panels.size} panels with ${chartData.length} data points`);
    this.chartData = chartData;
    this.panels.forEach((panel, panelId) => {
      console.log(`🔄 Updating panel: ${panelId} (${panel.indicatorType})`);
      this.updatePanel(panelId);
    });

    // Update MA overlays on main chart if it exists
    if (this.mainChart) {
      this.updateMAOverlays();
    }

    this._scheduleQuietRender();
    setTimeout(() => this._healDegenerateRenders(), 2000);
  }

  // Panel charts go through several overlapping resize passes right after
  // boot (per-panel ResizeObserver, per-panel initial-resize timer,
  // syncIndicatorChartWidths called twice from outside this class). A
  // render that lands mid-churn can come out visually squashed against
  // whatever size the chart was at that instant, even though the plotted
  // data itself is correct - only a render *after* things go quiet fixes
  // it. Every resize path funnels into this one debounced call instead of
  // rendering directly, so repeated resizes collapse into a single render
  // once nothing has resized for `delay` ms, and a render-triggered layout
  // shift can't retrigger itself into a resize/render loop.
  _scheduleQuietRender(delay = 500) {
    clearTimeout(this._quietRenderTimeout);
    this._quietRenderTimeout = setTimeout(() => {
      this.panels.forEach((panel, panelId) => this.updatePanel(panelId));
    }, delay);
  }

  // Verify-and-heal pass: on some loads a panel's very first automatic
  // render comes out with a fully-null tail even though chartData is
  // complete and a plain recompute against the same data succeeds every
  // time it's been checked manually - the exact one-off trigger was never
  // pinned down despite extensive tracing (data, params, and resize timing
  // all check out fine by the time this runs). Rather than leave the panel
  // permanently stuck, re-verify a couple seconds after boot/update and
  // force one more render for anything that still looks degenerate.
  _healDegenerateRenders() {
    this.panels.forEach((panel, panelId) => {
      const definition = this.indicatorDefinitions[panel.indicatorType];
      if (!definition || this.chartData.length < definition.minPeriod + 5) return;
      if (!panel.series || panel.series.size === 0) return;
      let hasLiveTail = false;
      panel.series.forEach(series => {
        const arr = panel.seriesArrays.get(series) || [];
        if (arr.slice(-3).some(d => d && d.value != null)) hasLiveTail = true;
      });
      if (!hasLiveTail) {
        console.warn(`🩹 Healing degenerate render for panel ${panelId} (${panel.indicatorType})`);
        this.updatePanel(panelId);
      }
    });
  }

  // Update only a single panel without affecting others (for parameter changes)
  updateSinglePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    const definition = this.indicatorDefinitions[panel.indicatorType];
    if (!definition) return;

    // Check if we have enough data
    if (this.chartData.length < definition.minPeriod) {
      // Clear the chart if insufficient data
      panel.series.forEach(series => series.setData([]));
      return;
    }

    try {
      console.log(`🔒 ISOLATED UPDATE: Updating ONLY panel ${panelId} (${panel.indicatorType}) - no other panels affected`);
      
      // Compute indicator data
      const indicatorData = definition.compute(this.chartData, panel.params);
      if (indicatorData == null || (typeof indicatorData === 'object' && !Array.isArray(indicatorData) && Object.keys(indicatorData).length === 0)) {
        if (panel.series && panel.series.length) panel.series.forEach(s => { try { s.setData([]); } catch (e) {} });
        return;
      }
      if (Array.isArray(indicatorData) && indicatorData.length === 0) {
        if (panel.series && panel.series.length) panel.series.forEach(s => { try { s.setData([]); } catch (e) {} });
        return;
      }
      
      // Render ONLY this indicator - no side effects
      definition.render(panel.chart, indicatorData, this.colors, panel.series);

      // Update legend with current values
      panel.lastIndicatorData = indicatorData;
      this.updateLegendDisplay(panelId, indicatorData);
      this._renderYAxisBadges(panelId);

      console.log(`✓ Panel ${panelId} updated independently`);
    } catch (error) {
      console.error(`Error updating ${panel.indicatorType} indicator:`, error);
    }
  }

  updatePanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    const definition = this.indicatorDefinitions[panel.indicatorType];
    if (!definition) return;

    // Check if we have enough data
    if (this.chartData.length < definition.minPeriod) {
      // Clear the chart if insufficient data
      panel.series.forEach(series => series.setData([]));
      return;
    }

    try {
      // Ensure parameter change updates are isolated
      if (this.isParameterUpdate) {
        console.log(`🔒 ISOLATED UPDATE: Only updating panel ${panelId} for parameter change`);
      }

      // Compute indicator data with deep parameter isolation
      const indicatorData = definition.compute(this.chartData, panel.params);
      if (indicatorData == null || (typeof indicatorData === 'object' && !Array.isArray(indicatorData) && Object.keys(indicatorData).length === 0)) {
        if (panel.series && panel.series.length) panel.series.forEach(s => { try { s.setData([]); } catch (e) {} });
        return;
      }
      if (Array.isArray(indicatorData) && indicatorData.length === 0) {
        if (panel.series && panel.series.length) panel.series.forEach(s => { try { s.setData([]); } catch (e) {} });
        return;
      }
      
      // Render indicator
      definition.render(panel.chart, indicatorData, this.colors, panel.series);

      // Update legend with current values
      panel.lastIndicatorData = indicatorData;
      this.updateLegendDisplay(panelId, indicatorData);
      this._renderYAxisBadges(panelId);
    } catch (error) {
      console.error(`Error updating ${panel.indicatorType} indicator:`, error);
    }
  }

  syncTimeScale(chart) {
    if (!this.mainTimeScale || !this.chartData?.length) return;
    try {
      if (typeof this.mainTimeScale.getVisibleRange === 'function') {
        const tr = this.mainTimeScale.getVisibleRange();
        if (tr && tr.from != null && tr.to != null) {
          this.isUpdatingRange = true;
          try { chart.timeScale().setVisibleRange(tr); } catch (e) {}
          finally { this.isUpdatingRange = false; }
        }
      }
    } catch (e) {}
    const applyTimeRange = (timeRange) => {
      if (!timeRange || timeRange.from == null || timeRange.to == null || this.isUpdatingRange) return;
      try {
        this.isUpdatingRange = true;
        chart.timeScale().setVisibleRange(timeRange);
      } catch (e) {}
      finally { this.isUpdatingRange = false; }
    };
    if (typeof this.mainTimeScale.subscribeVisibleTimeRangeChange === 'function') {
      this.mainTimeScale.subscribeVisibleTimeRangeChange(applyTimeRange);
    } else {
      const syncRange = (range) => {
        if (!range || this.isUpdatingRange || !this.chartData?.length) return;
        const fromIdx = Math.max(0, Math.min(this.chartData.length - 1, Math.floor(range.from)));
        const toIdx = Math.max(0, Math.min(this.chartData.length - 1, Math.ceil(range.to)));
        const fromTime = this.chartData[fromIdx].time;
        const toTime = this.chartData[toIdx].time;
        try {
          this.isUpdatingRange = true;
          chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });
        } catch (e) {}
        finally { this.isUpdatingRange = false; }
      };
      this.mainTimeScale.subscribeVisibleLogicalRangeChange(syncRange);
    }
  }
  
  setupZoomSync(panelId, timeScale) {
    if (!timeScale || !this.syncEnabled) return;

    const minSpan = 10;
    const dataMin = 0;
    const dataMax = Math.max(0, (this.chartData?.length ?? 1) - 1);
    const maxSpan = dataMax - dataMin + 1;

    const logicalToTimeRange = (range) => {
      if (!range || !this.chartData?.length) return null;
      const fromIdx = Math.max(0, Math.min(this.chartData.length - 1, Math.floor(range.from)));
      const toIdx = Math.max(0, Math.min(this.chartData.length - 1, Math.ceil(range.to)));
      return { from: this.chartData[fromIdx].time, to: this.chartData[toIdx].time };
    };

    const clampLogicalRange = (range) => {
      if (!range || !this.chartData?.length) return null;
      let span = range.to - range.from;
      const center = (range.from + range.to) / 2;
      span = Math.max(minSpan, Math.min(maxSpan, span));
      const halfSpan = span / 2;
      let from = center - halfSpan;
      let to = center + halfSpan;
      if (from < dataMin) { from = dataMin; to = Math.min(dataMin + span, dataMax); }
      if (to > dataMax) { to = dataMax; from = Math.max(dataMax - span, dataMin); }
      from = Math.max(dataMin, Math.min(from, dataMax));
      to = Math.max(dataMin, Math.min(to, dataMax));
      return to > from ? { from, to } : null;
    };

    const applyTimeRangeToAll = (timeRange) => {
      if (!timeRange || timeRange.from == null || timeRange.to == null || timeRange.from >= timeRange.to || this.isUpdatingRange) return;
      this.isUpdatingRange = true;
      try {
        if (this.mainTimeScale && typeof this.mainTimeScale.setVisibleRange === 'function') {
          this.mainTimeScale.setVisibleRange(timeRange);
        }
        this.panels.forEach((panel) => {
          try { panel.chart.timeScale().setVisibleRange(timeRange); } catch (e) {}
        });
      } catch (e) { console.warn('Error applying time range:', e.message); }
      finally { this.isUpdatingRange = false; }
    };

    const onLogicalRangeChange = (range) => {
      if (!range || this.isUpdatingRange) return;
      let timeRange = null;
      if (typeof timeScale.getVisibleRange === 'function') {
        try { timeRange = timeScale.getVisibleRange(); } catch (e) {}
      }
      if (!timeRange || timeRange.from == null || timeRange.to == null) {
        const clamped = this.chartData?.length ? clampLogicalRange(range) : range;
        const rangeToApply = clamped || range;
        timeRange = logicalToTimeRange(rangeToApply);
      }
      if (timeRange && timeRange.from < timeRange.to) applyTimeRangeToAll(timeRange);
    };

    if (typeof timeScale.subscribeVisibleTimeRangeChange === 'function') {
      timeScale.subscribeVisibleTimeRangeChange((timeRange) => {
        if (!timeRange || this.isUpdatingRange) return;
        applyTimeRangeToAll(timeRange);
      });
    } else {
      timeScale.subscribeVisibleLogicalRangeChange(onLogicalRangeChange);
    }
    console.log(`✅ Zoom sync setup for ${panelId || 'main chart'}`);
  }

  setMainTimeScale(timeScale, mainChart = null, mainSeries = null) {
    this.mainTimeScale = timeScale;
    this.mainChart = mainChart;
    if (mainSeries) this.mainSeries = mainSeries;

    // Setup main chart zoom sync
    if (timeScale && this.syncEnabled) {
      this.setupZoomSync(null, timeScale); // null indicates main chart
    }

    // Sync all existing panels
    this.panels.forEach(panel => {
      this.syncTimeScale(panel.chart);
    });

    // Initialize MA overlay on main chart if data exists
    if (this.mainChart && this.chartData && this.chartData.length > 0) {
      this.updateMAOverlays();
    }

    this._setupMainCrosshairSync();
    this.setupMainSplitter();
  }

  // Drag handle between #main-chart-panel and #indicators-section, letting
  // the user manually rebalance the split (in addition to the automatic
  // panel-count-driven ratio and each panel's own individual resize handle).
  setupMainSplitter() {
    if (this._mainSplitterWired) return;
    const handle = document.getElementById('main-splitter');
    const mainPanel = document.getElementById('main-chart-panel');
    const indicatorsSection = document.getElementById('indicators-section');
    if (!handle || !mainPanel || !indicatorsSection) return;
    this._mainSplitterWired = true;

    const MIN_MAIN = 200;
    const MIN_INDICATORS = 110;
    let dragging = false;
    let startY = 0;
    let startMainHeight = 0;
    let startIndicatorsHeight = 0;

    const onMouseMove = (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      let newMain = startMainHeight + dy;
      let newIndicators = startIndicatorsHeight - dy;
      if (newMain < MIN_MAIN) {
        newIndicators -= (MIN_MAIN - newMain);
        newMain = MIN_MAIN;
      }
      if (newIndicators < MIN_INDICATORS) {
        newMain -= (MIN_INDICATORS - newIndicators);
        newIndicators = MIN_INDICATORS;
      }
      mainPanel.style.setProperty('flex', `0 0 ${Math.max(MIN_MAIN, newMain)}px`, 'important');
      indicatorsSection.style.setProperty('flex', `0 0 ${Math.max(MIN_INDICATORS, newIndicators)}px`, 'important');
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('main-splitter-dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startMainHeight = mainPanel.getBoundingClientRect().height;
      startIndicatorsHeight = indicatorsSection.getBoundingClientRect().height;
      document.body.classList.add('main-splitter-dragging');
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  // This build of lightweight-charts (3.8.0) has no setCrosshairPosition/
  // clearCrosshairPosition on IChartApi and no series.data() getter (verified
  // empirically - both are undefined at runtime), so a synced crosshair can't
  // be driven through the "official" cross-chart API. Instead each chart gets
  // a thin absolutely-positioned overlay line (created alongside the chart -
  // see initializePanel/the #chart markup) that's repositioned via
  // timeScale().timeToCoordinate(time), which IS available on this build.
  _getSyncLineEl(chart) {
    if (chart === this.mainChart) return document.getElementById('main-chart-xline');
    for (const panel of this.panels.values()) {
      if (panel.chart === chart) return document.getElementById(`${panel.id}-xline`);
    }
    return null;
  }

  // Push a shared crosshair time across the main chart and every indicator
  // panel so hovering any one of them highlights the same vertical position
  // on all the others. `sourceChart` is skipped (it already has its own
  // native crosshair from the user's actual mouse position).
  _broadcastCrosshairTime(time, sourceChart) {
    const positionLine = (chart) => {
      if (!chart || chart === sourceChart) return;
      const lineEl = this._getSyncLineEl(chart);
      if (!lineEl) return;
      let x = null;
      if (time != null) {
        try { x = chart.timeScale().timeToCoordinate(time); } catch (e) { x = null; }
      }
      if (x == null) {
        lineEl.style.display = 'none';
      } else {
        lineEl.style.display = 'block';
        lineEl.style.left = `${x}px`;
      }
    };

    positionLine(this.mainChart);
    this.panels.forEach(panel => positionLine(panel.chart));

    this._updateUnifiedTooltip(time);
    if (window.TradeFlowChart && typeof window.TradeFlowChart.showTooltipForTime === 'function') {
      window.TradeFlowChart.showTooltipForTime(time);
    }
  }

  // Unified tooltip: reuses updateLegendDisplay's existing per-indicator-type
  // switch statement (already knows the correct label/formatting for every
  // one of the 120+ indicator types) by asking it to render the HOVERED
  // bar's values instead of the latest one, then mirrors each panel's
  // (already-labeled, already-colored) legend HTML into one consolidated row
  // next to the main OHLCV legend. Fed by _broadcastCrosshairTime, so it
  // updates from a hover on the main chart OR any indicator panel alike, and
  // as a side effect each panel's own header legend also live-updates to the
  // hovered bar - reverting to the latest bar once the mouse leaves.
  _updateUnifiedTooltip(time) {
    const row = document.getElementById('indicator-tooltip-row');

    if (time == null) {
      this.panels.forEach((panel, panelId) => {
        if (panel.lastIndicatorData) this.updateLegendDisplay(panelId, panel.lastIndicatorData);
      });
      if (row) row.innerHTML = '';
      return;
    }

    const atIndex = this.chartData.findIndex(c => c.time === time);
    if (atIndex === -1) return;

    const parts = [];
    this.panels.forEach((panel, panelId) => {
      if (!panel.lastIndicatorData) return;
      this.updateLegendDisplay(panelId, panel.lastIndicatorData, atIndex);
      const legendEl = document.getElementById(`${panelId}-legend`);
      if (legendEl && legendEl.innerHTML.trim()) parts.push(legendEl.innerHTML);
    });

    if (row) row.innerHTML = parts.join('<span style="color:#334155;margin:0 8px;">|</span>');
  }

  _setupMainCrosshairSync() {
    if (this._mainCrosshairSyncWired || !this.mainChart || typeof this.mainChart.subscribeCrosshairMove !== 'function') return;
    this._mainCrosshairSyncWired = true;
    this.mainChart.subscribeCrosshairMove((param) => {
      this._broadcastCrosshairTime(param && param.time != null ? param.time : null, this.mainChart);
    });
  }

  /**
   * Sync indicator chart widths to match main chart container so time axis aligns (same pixel width).
   * Call this when the main chart container is resized and after panels are created.
   * @param {HTMLElement} mainChartContainer - The main chart DOM element (e.g. document.getElementById('chart'))
   */
  syncIndicatorChartWidths(mainChartContainer) {
    if (!mainChartContainer) return;
    const w = mainChartContainer.clientWidth || mainChartContainer.offsetWidth;
    if (w <= 0) return;
    this.panels.forEach((panel, panelId) => {
      const panelEl = document.getElementById(panelId);
      const chartEl = document.getElementById(`${panelId}-chart`);
      if (!chartEl || !panel.chart) return;
      if (panelEl) {
        panelEl.style.width = w + 'px';
        panelEl.style.minWidth = w + 'px';
        panelEl.style.maxWidth = w + 'px';
      }
      chartEl.style.width = w + 'px';
      chartEl.style.minWidth = w + 'px';
      chartEl.style.maxWidth = w + 'px';
      const h = chartEl.clientHeight || 180;
      try {
        panel.chart.resize(w, h);
      } catch (e) {}
    });
    this._scheduleQuietRender();
  }

  // Indicator computation methods
  computeMACD(data, fast = 12, slow = 26, signal = 9) {
    const closes = data.map(d => d.close);
    return computeMACD(closes, fast, slow, signal);
  }

  computeRSI(data, period = 14) {
    const closes = data.map(d => d.close);
    return computeRSI(closes, period);
  }

  computeDualRSI(data, periodA = 5, periodB = 10) {
    const closes = data.map(d => d.close);
    const rsiA = (typeof window !== 'undefined' && window.slidingWindowRSI)
      ? window.slidingWindowRSI(closes, periodA)
      : _rsi0Based(closes, periodA);
    const rsiB = (typeof window !== 'undefined' && window.slidingWindowRSI)
      ? window.slidingWindowRSI(closes, periodB)
      : _rsi0Based(closes, periodB);

    return {
      rsiA: rsiA,
      rsiB: rsiB,
      periodA: periodA,
      periodB: periodB
    };
  }
  
  computeStochastic(data, kPeriod = 14, dPeriod = 3) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return computeStochastic(highs, lows, closes, kPeriod, dPeriod);
  }

  // Wang KD - Uses Wang's KD computation method
  computeWangKD(data, period = 9) {
    if (!data || data.length < period) {
      console.warn('Wang KD: Insufficient data', { dataLength: data?.length, period });
      return { k: [], d: [] };
    }

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);

    if (typeof window.KD_KD === 'function') {
      const { KD_K, KD_D } = window.KD_KD(highs, lows, closes, period);
      return { k: KD_K, d: KD_D };
    }
    if (window.WangIndicators?.computeKD) {
      const result = window.WangIndicators.computeKD(highs, lows, closes, period);
      return { k: result.k, d: result.d };
    }

    // Fallback implementation (same as Wang's method)
    const k = new Array(closes.length).fill(null);
    const d = new Array(closes.length).fill(null);
    
    let prevK = 50;
    let prevD = 50;

    for (let i = period - 1; i < closes.length; i++) {
      // Find Max High and Min Low in window
      let maxH = -Infinity;
      let minL = Infinity;
      
      for(let j = 0; j < period; j++){
        if(highs[i - j] > maxH) maxH = highs[i - j];
        if(lows[i - j] < minL) minL = lows[i - j];
      }

      let rsv = 50;
      if (maxH !== minL) {
        rsv = ((closes[i] - minL) / (maxH - minL)) * 100;
      }

      const currK = (2/3) * prevK + (1/3) * rsv;
      const currD = (2/3) * prevD + (1/3) * currK;

      k[i] = currK;
      d[i] = currD;

      prevK = currK;
      prevD = currD;
    }

    // Return arrays with nulls preserved for alignment with chartData
    // The render function will handle filtering
    const validK = k.filter(v => v !== null && !isNaN(v) && isFinite(v));
    const validD = d.filter(v => v !== null && !isNaN(v) && isFinite(v));
    console.log(`Wang KD computed (fallback): k length=${validK.length}, d length=${validD.length}, total=${k.length}`);
    return { k: k, d: d };
  }

  // Wang Williams %R - Uses Wang's Williams %R computation method
  computeWangWilliamsR(data, period = 14) {
    if (!data || data.length < period) {
      console.warn('Wang %R: Insufficient data', { dataLength: data?.length, period });
      return [];
    }

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);

    // Use WangIndicators if available
    if (typeof window !== 'undefined' && window.WangIndicators && window.WangIndicators.computeWilliamsR) {
      const result = window.WangIndicators.computeWilliamsR(highs, lows, closes, period);
      // Convert to -100 to 0 scale (standard Williams %R) but preserve array alignment
      const wrValues = result.map(v => {
        if (v === null || isNaN(v) || !isFinite(v)) return null;
        return v - 100; // Convert from 0-100 to -100 to 0 scale
      });
      console.log(`Wang %R computed: length=${wrValues.length}`);
      return wrValues;
    }

    // Fallback implementation
    const wr = new Array(closes.length).fill(null);
    
    for (let i = period - 1; i < closes.length; i++) {
      let maxH = -Infinity;
      let minL = Infinity;
      
      for (let j = 0; j < period; j++) {
        if (highs[i - j] > maxH) maxH = highs[i - j];
        if (lows[i - j] < minL) minL = lows[i - j];
      }
      
      if (maxH === minL) {
        wr[i] = 0; // Will be converted to -100
      } else {
        wr[i] = ((maxH - closes[i]) / (maxH - minL)) * 100;
      }
    }

    // Convert to -100 to 0 scale but preserve array alignment
    const wrValues = wr.map(v => {
      if (v === null || isNaN(v) || !isFinite(v)) return null;
      return v - 100; // Convert from 0-100 to -100 to 0 scale
    });
    
    console.log(`Wang %R computed (fallback): length=${wrValues.length}`);
    return wrValues;
  }

  // New KD Indicator - Computes K2 and D2 using exponential smoothing
  // Simplified implementation based on the original algorithm
  computeNewKD(data, kdDay = 9, kd2Day = 9) {
    if (!data || data.length < kdDay) {
      console.warn('New KD: Insufficient data', { dataLength: data?.length, kdDay, kd2Day });
      return { K: [], D: [], K2: [], D2: [] };
    }

    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const n = closes.length;

    // Initialize arrays
    const KD_K = new Array(n).fill(null);
    const KD_D = new Array(n).fill(null);
    const K2 = new Array(n).fill(null);
    const D2 = new Array(n).fill(null);

    // Compute traditional KD first
    // Start from index kdDay-1 (first valid KD calculation)
    for (let i = kdDay - 1; i < n; i++) {
      // Find max high and min low in the period window [i-kdDay+1 to i]
      let KD_max = -Infinity;
      let KD_min = Infinity;

      for (let j = i - kdDay + 1; j <= i; j++) {
        if (j >= 0 && j < n) {
          if (highs[j] > KD_max) KD_max = highs[j];
          if (lows[j] < KD_min) KD_min = lows[j];
        }
      }

      // Calculate RSV
      let RSV;
      if (KD_max === KD_min) {
        RSV = 100;
      } else {
        RSV = ((closes[i] - KD_min) / (KD_max - KD_min)) * 100;
      }

      // Initialize KD values at first valid point
      if (i === kdDay - 1) {
        KD_K[i] = 50;
        KD_D[i] = 50;
      } else {
        // Traditional KD: K = 2/3 * K_prev + 1/3 * RSV
        KD_K[i] = (2/3) * KD_K[i - 1] + (1/3) * RSV;
        // D = 2/3 * D_prev + 1/3 * K
        KD_D[i] = (2/3) * KD_D[i - 1] + (1/3) * KD_K[i];
      }

      // Compute K2 and D2 using exponential smoothing
      if (i === kdDay - 1) {
        // Initialize K2 and D2 equal to KD values
        K2[i] = KD_K[i];
        D2[i] = KD_D[i];
      } else {
        // K2 = (n-1)/(n+1) * K2_prev + 2/(n+1) * KD_K
        const k2Factor = (kd2Day - 1) / (kd2Day + 1);
        const k2NewFactor = 2 / (kd2Day + 1);
        K2[i] = k2Factor * K2[i - 1] + k2NewFactor * KD_K[i];
        D2[i] = k2Factor * D2[i - 1] + k2NewFactor * KD_D[i];
      }
    }

    // Return all 4 arrays aligned with chartData (preserve nulls for alignment)
    // K and D from original KD, K2 and D2 from exponential smoothing
    console.log(`New KD computed: K length=${KD_K.length}, D length=${KD_D.length}, K2 length=${K2.length}, D2 length=${D2.length}, n=${n}`);
    
    // Get valid counts for logging
    const validK = KD_K.filter(v => v !== null && !isNaN(v) && isFinite(v));
    const validD = KD_D.filter(v => v !== null && !isNaN(v) && isFinite(v));
    const validK2 = K2.filter(v => v !== null && !isNaN(v) && isFinite(v));
    const validD2 = D2.filter(v => v !== null && !isNaN(v) && isFinite(v));
    
    if (validK.length > 0) {
      console.log(`New KD sample: K[0]=${validK[0].toFixed(2)}, D[0]=${validD[0].toFixed(2)}, K2[0]=${validK2[0].toFixed(2)}, D2[0]=${validD2[0].toFixed(2)}`);
    }
    
    return {
      K: KD_K,   // Original KD K line
      D: KD_D,   // Original KD D line
      K2: K2,    // Exponential smoothed K2 line
      D2: D2     // Exponential smoothed D2 line
    };
  }

  computeWilliamsR(data, period = 14) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return computeWilliamsR(highs, lows, closes, period);
  }

  computeCCI(data, period = 20) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return computeCCI(highs, lows, closes, period);
  }

  computeMFI(data, period = 14) {
    if (!data || data.length === 0) {
      console.warn('MFI: No data provided');
      return [];
    }

    const extractor = (typeof window !== 'undefined' && typeof window.extractOHLCVFromCandles === 'function')
      ? window.extractOHLCVFromCandles
      : null;

    const { highs, lows, closes, volumes } = extractor
      ? extractor(data)
      : {
          highs: data.map(d => d.high ?? 0),
          lows: data.map(d => d.low ?? 0),
          closes: data.map(d => d.close ?? 0),
          volumes: data.map(d => d.volume ?? 0)
        };

    const externalMFI = (typeof window !== 'undefined' && typeof window.computeMFIFromArrays === 'function')
      ? window.computeMFIFromArrays
      : null;

    if (externalMFI) {
      console.log('MFI: Using external computeMFIFromArrays function');
      return externalMFI(highs, lows, closes, volumes, period);
    }

    console.log('MFI: Using fallback calculation');

    // Fallback inline calculation mirrors src/js-prod/new.js
    const length = closes.length;
    const mfi = new Array(length).fill(null);
    if (length < period || !period) return mfi;

    const typicalPrices = [];
    const rawFlows = [];

    for (let i = 0; i < length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(tp);
      rawFlows.push(tp * (volumes[i] ?? 0));
    }

    for (let i = period; i < length; i++) {
      let positiveFlow = 0;
      let negativeFlow = 0;

      for (let j = 0; j < period; j++) {
        const idx = i - j;
        if (typicalPrices[idx] > typicalPrices[idx - 1]) {
          positiveFlow += rawFlows[idx];
        } else if (typicalPrices[idx] < typicalPrices[idx - 1]) {
          negativeFlow += rawFlows[idx];
        }
      }

      if (negativeFlow === 0) {
        mfi[i] = positiveFlow === 0 ? 50 : 100; // Neutral when no flow, 100 when only positive
      } else {
        const moneyFlowRatio = positiveFlow / negativeFlow;
        mfi[i] = 100 - (100 / (1 + moneyFlowRatio));
      }
    }

    return mfi;
  }

  computeADX(data, period = 14) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return computeADX(highs, lows, closes, period);
  }

  computeMomentum(data, period = 10) {
    const closes = data.map(d => d.close);
    const momentum = [];
    
    for (let i = period; i < closes.length; i++) {
      momentum.push(closes[i] - closes[i - period]);
    }
    
    return momentum;
  }

  computeROC(data, period = 10) {
    const closes = data.map(d => d.close);
    const roc = [];
    
    for (let i = period; i < closes.length; i++) {
      const current = closes[i];
      const past = closes[i - period];
      roc.push(((current - past) / past) * 100);
    }
    
    return roc;
  }

  computeCoppockCurve(data, short_day = 10, long_day = 20, weight_day = 10) {
    const closes = data.map(d => d.close);
    if (typeof window.CoppockCurve === 'function') {
      const { Coppock, eCoppock } = window.CoppockCurve(closes, short_day, long_day, weight_day);
      return { coppock: Coppock, ecoppock: eCoppock };
    }
    if (window.WangIndicators?.computeCoppockCurve) {
      return window.WangIndicators.computeCoppockCurve(closes, short_day, long_day, weight_day);
    }
    return { coppock: [], ecoppock: [] };
  }

  computeVolume(data, params = {}) {
    console.log('Computing volume data from', data.length, 'candles');
    const volumes = data.map(d => {
      const vol = d.volume || 0;
      if (vol === 0) {
        console.warn('Zero volume found in candle:', d);
      }
      return vol;
    });
    console.log('Volume computation complete:', volumes.length, 'volumes, max:', Math.max(...volumes));
    
    // Compute VolMA if maPeriod is provided
    const maPeriod = params?.maPeriod || 20;
    let volMA = null;
    if (maPeriod > 0 && volumes.length >= maPeriod && window.WangIndicators) {
      volMA = window.WangIndicators.computeVolMA(volumes, maPeriod);
      console.log('VolMA computed with period', maPeriod, ':', volMA.length, 'values');
    }
    
    return { volumes, volMA };
  }

  computeOBV(data) {
    const obv = [0];

    for (let i = 1; i < data.length; i++) {
      const prevObv = obv[i - 1];
      const volume = data[i].volume || 0;
      const close = data[i].close;
      const prevClose = data[i - 1].close;

      if (close > prevClose) {
        obv.push(prevObv + volume);
      } else if (close < prevClose) {
        obv.push(prevObv - volume);
      } else {
        obv.push(prevObv);
      }
    }

    return obv;
  }

  computeMA(data, period = 20, type = 'SMA') {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume || 0);
    
    // Use the enhanced MA computation from technical-indicators.js
    if (typeof computeMovingAverage !== 'undefined') {
      return computeMovingAverage(closes, period, type, { volumes });
    }
    
    // Fallback to local computation
    switch (type.toUpperCase()) {
      case 'SMA':
        return this.computeSMA(closes, period);
      case 'EMA':
        return this.computeEMA(closes, period);
      case 'WMA':
        return this.computeWMA(closes, period);
      case 'TMA':
        return this.computeTMA(closes, period);
      case 'HMA':
        return this.computeHMA(closes, period);
      case 'KAMA':
        return this.computeKAMA(closes, period);
      case 'VWMA':
        return this.computeVWMA(closes, volumes, period);
      default:
        return this.computeSMA(closes, period);
    }
  }

  computeARBRIndicator(data, period = 26) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const opens = data.map(d => d.open);
    const closes = data.map(d => d.close);
    return computeARBR(highs, lows, opens, closes, period);
  }

  computeSYARBRIndicator(data, period = 26) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const opens = data.map(d => d.open);
    const closes = data.map(d => d.close);
    return computeARBR(highs, lows, opens, closes, period);
  }

  computeCRIndicator(data, period = 26) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    return computeCR(highs, lows, period);
  }

  computeDualCR(data, periodA = 10, periodB = 26) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const crA = computeCR(highs, lows, periodA);
    const crB = computeCR(highs, lows, periodB);
    
    return {
      crA: crA,
      crB: crB,
      periodA: periodA,
      periodB: periodB
    };
  }

  computeBBIIndicator(data, periods = { short: 3, shortMed: 6, medLong: 12, long: 24 }) {
    const closes = data.map(d => d.close);
    return computeBBI(closes, periods);
  }

  computeBullBearPowerIndicator(data, period = 13) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return computeBullBearPower(highs, lows, closes, period);
  }

  computeSMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return [];
    const sma = [];
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  computeEMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return [];
    
    const ema = [];
    const k = 2 / (period + 1);
    
    // First EMA value is SMA of first 'period' values
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += values[i];
    }
    ema.push(sum / period);
    
    // Subsequent EMA values
    for (let i = period; i < values.length; i++) {
      const prevEMA = ema[ema.length - 1];
      ema.push(values[i] * k + prevEMA * (1 - k));
    }
    
    return ema;
  }

  computeWMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return [];
    
    const wma = [];
    const weightSum = period * (period + 1) / 2;
    
    for (let i = period - 1; i < values.length; i++) {
      let weightedSum = 0;
      for (let j = 0; j < period; j++) {
        const weight = j + 1;
        weightedSum += values[i - period + 1 + j] * weight;
      }
      wma.push(weightedSum / weightSum);
    }
    
    return wma;
  }

  computeTMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return [];
    
    const firstSMA = this.computeSMA(values, Math.ceil(period / 2));
    const tma = this.computeSMA(firstSMA, Math.floor(period / 2) + 1);
    
    return tma;
  }

  computeHMA(values, period) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return [];
    if (typeof window !== 'undefined' && window.HullMA) {
      const { HMA } = window.HullMA(values, period);
      return HMA;
    }
    const { HMA } = this._computeHullMAInline(values, period, 9);
    return HMA;
  }

  _computeHullMAInline(STK_close, day, ema_n = 9) {
    if (!Array.isArray(STK_close) || STK_close.length < day) return { HMA: [], eHMA: [] };
    if (day % 2 === 1) day = day + 1;
    const half_day = day / 2;
    const m = Math.ceil(Math.sqrt(day));
    const WMA1 = new Array(STK_close.length).fill(null);
    const WMA2 = new Array(STK_close.length).fill(null);
    const RawHMA = new Array(STK_close.length).fill(null);
    const HMA = new Array(STK_close.length).fill(null);
    const eHMA = new Array(STK_close.length).fill(null);
    let sum_wgt1 = 0;
    for (let i = 1; i <= half_day; i++) sum_wgt1 += i;
    for (let i = half_day - 1; i < STK_close.length; i++) {
      let sum_close = 0;
      for (let j = 1; j <= half_day; j++) sum_close += STK_close[i - half_day + j] * j;
      WMA1[i] = sum_close / sum_wgt1;
    }
    let sum_wgt2 = 0;
    for (let i = 1; i <= day; i++) sum_wgt2 += i;
    for (let i = day - 1; i < STK_close.length; i++) {
      let sum_close = 0;
      for (let j = 1; j <= day; j++) sum_close += STK_close[i - day + j] * j;
      WMA2[i] = sum_close / sum_wgt2;
    }
    for (let i = day - 1; i < STK_close.length; i++) RawHMA[i] = 2 * WMA1[i] - WMA2[i];
    const start_idx = day - 1 + m - 1;
    if (start_idx < STK_close.length) {
      let sum_tp = 0;
      for (let i = start_idx - m + 1; i <= start_idx; i++) sum_tp += RawHMA[i];
      HMA[start_idx] = sum_tp / m;
      eHMA[start_idx] = HMA[start_idx];
      for (let i = start_idx + 1; i < STK_close.length; i++) {
        sum_tp = sum_tp - RawHMA[i - m] + RawHMA[i];
        HMA[i] = sum_tp / m;
        eHMA[i] = ((ema_n - 1) / (ema_n + 1)) * eHMA[i - 1] + (2 / (ema_n + 1)) * HMA[i];
      }
    }
    return { HMA, eHMA };
  }

  computeKAMA(values, period = 10, fastSC = 2, slowSC = 30) {
    if (!Array.isArray(values) || values.length < period || period <= 0) return [];
    
    const kama = [];
    const fastSCRatio = 2 / (fastSC + 1);
    const slowSCRatio = 2 / (slowSC + 1);
    
    for (let i = period; i < values.length; i++) {
      const change = Math.abs(values[i] - values[i - period]);
      
      let volatility = 0;
      for (let j = 1; j <= period; j++) {
        volatility += Math.abs(values[i - j + 1] - values[i - j]);
      }
      
      const er = volatility !== 0 ? change / volatility : 0;
      const sc = Math.pow(er * (fastSCRatio - slowSCRatio) + slowSCRatio, 2);
      
      if (kama.length === 0) {
        kama.push(values[i]);
      } else {
        const prevKAMA = kama[kama.length - 1];
        kama.push(prevKAMA + sc * (values[i] - prevKAMA));
      }
    }
    
    return kama;
  }

  computeVWMA(values, volumes, period) {
    if (!Array.isArray(values) || !Array.isArray(volumes) || 
        values.length !== volumes.length || values.length < period || period <= 0) {
      return [];
    }
    
    const vwma = [];
    
    for (let i = period - 1; i < values.length; i++) {
      let weightedSum = 0;
      let volumeSum = 0;
      
      for (let j = 0; j < period; j++) {
        const price = values[i - j];
        const volume = volumes[i - j] || 0;
        weightedSum += price * volume;
        volumeSum += volume;
      }
      
      vwma.push(volumeSum > 0 ? weightedSum / volumeSum : values[i]);
    }
    
    return vwma;
  }

  // New Indicator Compute Methods
  computeBBI3(data, day1, day2, day3) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    const MA3 = this.computeSMA(closes, day3);
    
    const maxDay = Math.max(day1, day2, day3);
    const result = [];
    const startIndex = maxDay - 1;
    
    // Calculate the index offsets for each MA array
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    const offset3 = startIndex - (day3 - 1);
    
    for (let i = 0; i < closes.length - startIndex; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      const ma3Val = MA3[offset3 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined && ma3Val !== undefined) {
        result.push((ma1Val + ma2Val + ma3Val) / 3);
      }
    }
    
    // Compute RR (Rate-of-Return), Acc_RR (Accumulate Rate-of-Return), and BS_times (Buy/Sell times)
    // Designed by Prof Wang 2026-Nov-30
    let RR = 0;
    let Acc_RR = 0;
    let buy_price = 0;
    let BS_times = 0; // Buy and Sell times - cumulative buy/sell count
    
    // Check if buy point already occurred at start
    if (result.length > 0 && closes.length > startIndex) {
      const bbiStart = result[0];
      const closeStart = closes[startIndex];
      if (bbiStart < closeStart) {
        buy_price = closeStart;
      }
    }
    
    // Calculate buy/sell signals and returns
    for (let i = 1; i < result.length; i++) {
      const bbiPrev = result[i - 1];
      const bbiCurr = result[i];
      const closePrev = closes[startIndex + i - 1];
      const closeCurr = closes[startIndex + i];
      
      // Buy signal: BBI crosses below price (price crosses above BBI)
      if (bbiPrev > closePrev && bbiCurr < closeCurr) {
        buy_price = closeCurr;
      }
      // Sell signal: BBI crosses above price (price crosses below BBI)
      else if (bbiPrev < closePrev && bbiCurr > closeCurr) {
        if (buy_price > 0) {
          RR = (closeCurr - buy_price) / buy_price * 100;
          Acc_RR = Acc_RR + RR;
          BS_times = BS_times + 1;
        }
      }
    }
    
    return { 
      bbi3: result, 
      ma1: MA1, 
      ma2: MA2, 
      ma3: MA3, 
      startIndex,
      RR: RR,
      Acc_RR: Acc_RR,
      BS_times: BS_times
    };
  }

  computeBBI4(data, day1, day2, day3, day4) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    const MA3 = this.computeSMA(closes, day3);
    const MA4 = this.computeSMA(closes, day4);
    
    const maxDay = Math.max(day1, day2, day3, day4);
    const result = [];
    const startIndex = maxDay - 1;
    
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    const offset3 = startIndex - (day3 - 1);
    const offset4 = startIndex - (day4 - 1);
    
    for (let i = 0; i < closes.length - startIndex; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      const ma3Val = MA3[offset3 + i];
      const ma4Val = MA4[offset4 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined && ma3Val !== undefined && ma4Val !== undefined) {
        result.push((ma1Val + ma2Val + ma3Val + ma4Val) / 4);
      }
    }
    
    // Compute RR (Rate-of-Return), Acc_RR (Accumulate Rate-of-Return), and BS_times (Buy/Sell times)
    // Designed by Prof Wang 2026-Jan-12
    let RR = 0;
    let Acc_RR = 0;
    let buy_price = 0;
    let BS_times = 0; // Buy and Sell times - cumulative buy/sell count
    
    // Check if buy point already occurred at start
    if (result.length > 0 && closes.length > startIndex) {
      const bbiStart = result[0];
      const closeStart = closes[startIndex];
      if (bbiStart < closeStart) {
        buy_price = closeStart;
      }
    }
    
    // Calculate buy/sell signals and returns
    for (let i = 1; i < result.length; i++) {
      const bbiPrev = result[i - 1];
      const bbiCurr = result[i];
      const closePrev = closes[startIndex + i - 1];
      const closeCurr = closes[startIndex + i];
      
      // Buy signal: BBI crosses below price (price crosses above BBI)
      if (bbiPrev > closePrev && bbiCurr < closeCurr) {
        buy_price = closeCurr;
      }
      // Sell signal: BBI crosses above price (price crosses below BBI)
      else if (bbiPrev < closePrev && bbiCurr > closeCurr) {
        if (buy_price > 0) {
          RR = (closeCurr - buy_price) / buy_price * 100;
          Acc_RR = Acc_RR + RR;
          BS_times = BS_times + 1;
        }
      }
    }
    
    return { 
      bbi4: result, 
      ma1: MA1, 
      ma2: MA2, 
      ma3: MA3, 
      ma4: MA4, 
      startIndex,
      RR: RR,
      Acc_RR: Acc_RR,
      BS_times: BS_times
    };
  }

  computeBBI5(data, day1, day2, day3, day4, day5) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    const MA3 = this.computeSMA(closes, day3);
    const MA4 = this.computeSMA(closes, day4);
    const MA5 = this.computeSMA(closes, day5);
    
    const maxDay = Math.max(day1, day2, day3, day4, day5);
    const result = [];
    const startIndex = maxDay - 1;
    
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    const offset3 = startIndex - (day3 - 1);
    const offset4 = startIndex - (day4 - 1);
    const offset5 = startIndex - (day5 - 1);
    
    for (let i = 0; i < closes.length - startIndex; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      const ma3Val = MA3[offset3 + i];
      const ma4Val = MA4[offset4 + i];
      const ma5Val = MA5[offset5 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined && ma3Val !== undefined && 
          ma4Val !== undefined && ma5Val !== undefined) {
        result.push((ma1Val + ma2Val + ma3Val + ma4Val + ma5Val) / 5);
      }
    }
    
    // Compute RR (Rate-of-Return), Acc_RR (Accumulate Rate-of-Return), and BS_times (Buy/Sell times)
    // Designed by Prof Wang 2026-Jan-12
    let RR = 0;
    let Acc_RR = 0;
    let buy_price = 0;
    let BS_times = 0; // Buy and Sell times - cumulative buy/sell count
    
    // Check if buy point already occurred at start
    if (result.length > 0 && closes.length > startIndex) {
      const bbiStart = result[0];
      const closeStart = closes[startIndex];
      if (bbiStart < closeStart) {
        buy_price = closeStart;
      }
    }
    
    // Calculate buy/sell signals and returns
    for (let i = 1; i < result.length; i++) {
      const bbiPrev = result[i - 1];
      const bbiCurr = result[i];
      const closePrev = closes[startIndex + i - 1];
      const closeCurr = closes[startIndex + i];
      
      // Buy signal: BBI crosses below price (price crosses above BBI)
      if (bbiPrev > closePrev && bbiCurr < closeCurr) {
        buy_price = closeCurr;
      }
      // Sell signal: BBI crosses above price (price crosses below BBI)
      else if (bbiPrev < closePrev && bbiCurr > closeCurr) {
        if (buy_price > 0) {
          RR = (closeCurr - buy_price) / buy_price * 100;
          Acc_RR = Acc_RR + RR;
          BS_times = BS_times + 1;
        }
      }
    }
    
    return { 
      bbi5: result, 
      ma1: MA1, 
      ma2: MA2, 
      ma3: MA3, 
      ma4: MA4, 
      ma5: MA5, 
      startIndex,
      RR: RR,
      Acc_RR: Acc_RR,
      BS_times: BS_times
    };
  }

  // New BBI indicators with Rate of Return (separate from BBI3/BBI4/BBI5)
  computeBBI3RR(data, day1, day2, day3) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    const MA3 = this.computeSMA(closes, day3);
    
    const maxDay = Math.max(day1, day2, day3);
    const result = [];
    const startIndex = maxDay - 1;
    
    // Calculate the index offsets for each MA array
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    const offset3 = startIndex - (day3 - 1);
    
    for (let i = 0; i < closes.length - startIndex; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      const ma3Val = MA3[offset3 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined && ma3Val !== undefined) {
        result.push((ma1Val + ma2Val + ma3Val) / 3);
      }
    }
    
    // Compute RR (Rate-of-Return), Acc_RR (Accumulate Rate-of-Return), and BS_times (Buy/Sell times)
    // Designed by Prof Wang 2026-Nov-30
    let RR = 0;
    let Acc_RR = 0;
    let buy_price = 0;
    let BS_times = 0; // Buy and Sell times - cumulative buy/sell count
    
    // Check if buy point already occurred at start
    if (result.length > 0 && closes.length > startIndex) {
      const bbiStart = result[0];
      const closeStart = closes[startIndex];
      if (bbiStart < closeStart) {
        buy_price = closeStart;
      }
    }
    
    // Calculate buy/sell signals and returns
    for (let i = 1; i < result.length; i++) {
      const bbiPrev = result[i - 1];
      const bbiCurr = result[i];
      const closePrev = closes[startIndex + i - 1];
      const closeCurr = closes[startIndex + i];
      
      // Buy signal: BBI crosses below price (price crosses above BBI)
      if (bbiPrev > closePrev && bbiCurr < closeCurr) {
        buy_price = closeCurr;
      }
      // Sell signal: BBI crosses above price (price crosses below BBI)
      else if (bbiPrev < closePrev && bbiCurr > closeCurr) {
        if (buy_price > 0) {
          RR = (closeCurr - buy_price) / buy_price * 100;
          Acc_RR = Acc_RR + RR;
          BS_times = BS_times + 1;
        }
      }
    }
    
    return { 
      bbi3: result, 
      ma1: MA1, 
      ma2: MA2, 
      ma3: MA3, 
      startIndex,
      RR: RR,
      Acc_RR: Acc_RR,
      BS_times: BS_times
    };
  }

  computeBBI4RR(data, day1, day2, day3, day4) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    const MA3 = this.computeSMA(closes, day3);
    const MA4 = this.computeSMA(closes, day4);
    
    const maxDay = Math.max(day1, day2, day3, day4);
    const result = [];
    const startIndex = maxDay - 1;
    
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    const offset3 = startIndex - (day3 - 1);
    const offset4 = startIndex - (day4 - 1);
    
    for (let i = 0; i < closes.length - startIndex; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      const ma3Val = MA3[offset3 + i];
      const ma4Val = MA4[offset4 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined && ma3Val !== undefined && ma4Val !== undefined) {
        result.push((ma1Val + ma2Val + ma3Val + ma4Val) / 4);
      }
    }
    
    // Compute RR (Rate-of-Return), Acc_RR (Accumulate Rate-of-Return), and BS_times (Buy/Sell times)
    // Designed by Prof Wang 2026-Jan-12
    let RR = 0;
    let Acc_RR = 0;
    let buy_price = 0;
    let BS_times = 0; // Buy and Sell times - cumulative buy/sell count
    
    // Check if buy point already occurred at start
    if (result.length > 0 && closes.length > startIndex) {
      const bbiStart = result[0];
      const closeStart = closes[startIndex];
      if (bbiStart < closeStart) {
        buy_price = closeStart;
      }
    }
    
    // Calculate buy/sell signals and returns
    for (let i = 1; i < result.length; i++) {
      const bbiPrev = result[i - 1];
      const bbiCurr = result[i];
      const closePrev = closes[startIndex + i - 1];
      const closeCurr = closes[startIndex + i];
      
      // Buy signal: BBI crosses below price (price crosses above BBI)
      if (bbiPrev > closePrev && bbiCurr < closeCurr) {
        buy_price = closeCurr;
      }
      // Sell signal: BBI crosses above price (price crosses below BBI)
      else if (bbiPrev < closePrev && bbiCurr > closeCurr) {
        if (buy_price > 0) {
          RR = (closeCurr - buy_price) / buy_price * 100;
          Acc_RR = Acc_RR + RR;
          BS_times = BS_times + 1;
        }
      }
    }
    
    return { 
      bbi4: result, 
      ma1: MA1, 
      ma2: MA2, 
      ma3: MA3, 
      ma4: MA4, 
      startIndex,
      RR: RR,
      Acc_RR: Acc_RR,
      BS_times: BS_times
    };
  }

  computeBBI5RR(data, day1, day2, day3, day4, day5) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    const MA3 = this.computeSMA(closes, day3);
    const MA4 = this.computeSMA(closes, day4);
    const MA5 = this.computeSMA(closes, day5);
    
    const maxDay = Math.max(day1, day2, day3, day4, day5);
    const result = [];
    const startIndex = maxDay - 1;
    
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    const offset3 = startIndex - (day3 - 1);
    const offset4 = startIndex - (day4 - 1);
    const offset5 = startIndex - (day5 - 1);
    
    for (let i = 0; i < closes.length - startIndex; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      const ma3Val = MA3[offset3 + i];
      const ma4Val = MA4[offset4 + i];
      const ma5Val = MA5[offset5 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined && ma3Val !== undefined && 
          ma4Val !== undefined && ma5Val !== undefined) {
        result.push((ma1Val + ma2Val + ma3Val + ma4Val + ma5Val) / 5);
      }
    }
    
    // Compute RR (Rate-of-Return), Acc_RR (Accumulate Rate-of-Return), and BS_times (Buy/Sell times)
    // Designed by Prof Wang 2026-Jan-12
    let RR = 0;
    let Acc_RR = 0;
    let buy_price = 0;
    let BS_times = 0; // Buy and Sell times - cumulative buy/sell count
    
    // Check if buy point already occurred at start
    if (result.length > 0 && closes.length > startIndex) {
      const bbiStart = result[0];
      const closeStart = closes[startIndex];
      if (bbiStart < closeStart) {
        buy_price = closeStart;
      }
    }
    
    // Calculate buy/sell signals and returns
    for (let i = 1; i < result.length; i++) {
      const bbiPrev = result[i - 1];
      const bbiCurr = result[i];
      const closePrev = closes[startIndex + i - 1];
      const closeCurr = closes[startIndex + i];
      
      // Buy signal: BBI crosses below price (price crosses above BBI)
      if (bbiPrev > closePrev && bbiCurr < closeCurr) {
        buy_price = closeCurr;
      }
      // Sell signal: BBI crosses above price (price crosses below BBI)
      else if (bbiPrev < closePrev && bbiCurr > closeCurr) {
        if (buy_price > 0) {
          RR = (closeCurr - buy_price) / buy_price * 100;
          Acc_RR = Acc_RR + RR;
          BS_times = BS_times + 1;
        }
      }
    }
    
    return { 
      bbi5: result, 
      ma1: MA1, 
      ma2: MA2, 
      ma3: MA3, 
      ma4: MA4, 
      ma5: MA5, 
      startIndex,
      RR: RR,
      Acc_RR: Acc_RR,
      BS_times: BS_times
    };
  }

  computeOSC(data, period) {
    const closes = data.map(d => d.close);
    const MA = this.computeSMA(closes, period);
    
    const osc1 = []; // Price - MA (absolute difference)
    const osc2 = []; // Price / MA (ratio)
    const startIndex = period - 1;
    
    for (let i = 0; i < MA.length; i++) {
      const price = closes[startIndex + i];
      const ma = MA[i];
      
      osc1.push(price - ma);
      osc2.push(ma !== 0 ? (price / ma) : 1);
    }
    
    return { osc1, osc2, startIndex };
  }

  computeBIAS(data, day1, day2) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    
    const bias1 = [];
    const bias2 = [];
    
    // BIAS1 = (Close / MA1 - 1) * 100
    for (let i = 0; i < MA1.length; i++) {
      const price = closes[day1 - 1 + i];
      const ma = MA1[i];
      bias1.push(ma !== 0 ? ((price / ma) - 1) * 100 : 0);
    }
    
    // BIAS2 = (Close / MA2 - 1) * 100
    for (let i = 0; i < MA2.length; i++) {
      const price = closes[day2 - 1 + i];
      const ma = MA2[i];
      bias2.push(ma !== 0 ? ((price / ma) - 1) * 100 : 0);
    }
    
    return { bias1, bias2, startIndex1: day1 - 1, startIndex2: day2 - 1 };
  }

  computeMBIAS(data, day1, day2) {
    const closes = data.map(d => d.close);
    const MA1 = this.computeSMA(closes, day1);
    const MA2 = this.computeSMA(closes, day2);
    
    const mbias = [];
    const maxDay = Math.max(day1, day2);
    const startIndex = maxDay - 1;
    
    // Calculate offset for alignment
    const offset1 = startIndex - (day1 - 1);
    const offset2 = startIndex - (day2 - 1);
    
    // MBIAS = MA_short - MA_long (typically MA1 - MA2 if day1 < day2)
    const minLength = Math.min(MA1.length - offset1, MA2.length - offset2);
    
    for (let i = 0; i < minLength; i++) {
      const ma1Val = MA1[offset1 + i];
      const ma2Val = MA2[offset2 + i];
      
      if (ma1Val !== undefined && ma2Val !== undefined) {
        mbias.push(ma1Val - ma2Val);
      }
    }
    
    return { mbias, startIndex };
  }

  computeUOSC(data, maPeriod, oscPeriod) {
    const closes = data.map(d => d.close);
    const MA = this.computeSMA(closes, maPeriod);
    
    // First compute OSC values
    const osc1 = [];
    const osc2 = [];
    const oscStartIndex = maPeriod - 1;
    
    for (let i = 0; i < MA.length; i++) {
      const price = closes[oscStartIndex + i];
      const ma = MA[i];
      
      osc1.push(price - ma);
      osc2.push(ma !== 0 ? (price / ma) : 1);
    }
    
    // Then compute moving average of OSC values (UOSC)
    const uosc1 = [];
    const uosc2 = [];
    
    if (osc1.length >= oscPeriod) {
      for (let i = oscPeriod - 1; i < osc1.length; i++) {
        let sum1 = 0;
        let sum2 = 0;
        
        for (let j = 0; j < oscPeriod; j++) {
          sum1 += osc1[i - j];
          sum2 += osc2[i - j];
        }
        
        uosc1.push(sum1 / oscPeriod);
        uosc2.push(sum2 / oscPeriod);
      }
    }
    
    return { 
      uosc1, 
      uosc2, 
      startIndex: oscStartIndex + (oscPeriod - 1) 
    };
  }

  // MTM Indicator Computation
  computeMTMIndicator(data, day1, day2) {
    const closes = data.map(d => d.close);
    return computeMTM(closes, day1, day2);
  }

  // ROC Indicator Computation
  computeROCIndicator(data, day1, day2) {
    const closes = data.map(d => d.close);
    if (typeof window.ROC === 'function') {
      const r1 = window.ROC(closes, day1, 9);
      const r2 = window.ROC(closes, day2, 9);
      return { ROC1: r1.ROC, ROC2: r2.ROC };
    }
    return computeROC(closes, day1, day2);
  }

  // KST Indicator Computation
  computeKSTIndicator(data, day1, day2, day3, day4) {
    const closes = data.map(d => d.close);
    if (typeof window.KST === 'function') {
      const { KST, eKST } = window.KST(closes, day1, day2, day3, day4, 9);
      return { KST, KSTma: eKST };
    }
    return computeKST(closes, day1, day2, day3, day4);
  }

  // OBV Indicator Computation
  computeOBVIndicator(data) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    if (typeof window.OBV === 'function') {
      return window.OBV(highs, lows, closes, volumes, 9);
    }
    return computeOBV(highs, lows, closes, volumes);
  }

  // ACC Indicator Computation
  computeACCIndicator(data, MTM_n, ACC_n) {
    const closes = data.map(d => d.close);
    if (typeof window.Acceleration === 'function') {
      return window.Acceleration(closes, MTM_n, ACC_n);
    }
    return computeACC(closes, MTM_n, ACC_n);
  }

  // WAD Indicator Computation
  computeWADIndicator(data) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    if (typeof window.WilliamAccuDist === 'function') {
      return window.WilliamAccuDist(highs, lows, closes, 9);
    }
    return computeWAD(highs, lows, closes);
  }

  // CostMA Indicator Computation
  computeCostMAIndicator(data, day) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    if (typeof window.CostMA === 'function') {
      const { CostMA } = window.CostMA(highs, lows, closes, volumes, day);
      return { costma: CostMA };
    }
    return { costma: computeCostMA(highs, lows, closes, volumes, day) };
  }

  // VROC Indicator Computation
  computeVROCIndicator(data, day1, day2) {
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    if (typeof window.VolumeROC === 'function') {
      const { VolROC, VolROCma } = window.VolumeROC(volumes, day1, day2);
      return { VROC1: VolROC, VROC2: VolROCma };
    }
    return computeVROC(volumes, day1, day2);
  }

  // BTI Indicator Computation
  computeBTIIndicator(data, day) {
    const closes = data.map(d => d.close);
    if (typeof window.BTI === 'function') {
      const { BTI } = window.BTI(closes, day);
      return { bti: BTI };
    }
    return { bti: computeBTI(closes, day) };
  }

  // DPO Indicator Computation
  computeDPOIndicator(data, MA_day) {
    const closes = data.map(d => d.close);
    if (typeof window.DPO === 'function') {
      return window.DPO(closes, MA_day, 9);
    }
    return computeDPO(closes, MA_day);
  }

  // EOM Indicator Computation
  computeEOMIndicator(data) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    if (typeof window.EOM_EMV === 'function') {
      const { EOM_EMV, eEOM_EMV } = window.EOM_EMV(highs, lows, closes, volumes, 9);
      // Wang sets EOM=0 when high==low (division by zero guard); replace with null so the
      // chart renders a gap rather than a false zero spike at those candles.
      const cleanEOM = EOM_EMV.map((v, i) => (highs[i] === lows[i] || !Number.isFinite(v)) ? null : v);
      const cleaneEOM = eEOM_EMV.map((v, i) => (highs[i] === lows[i] || !Number.isFinite(v)) ? null : v);
      return { EOM: cleanEOM, eEOM: cleaneEOM };
    }
    return computeEOM(highs, lows, volumes);
  }

  // PVT Indicator Computation
  computePVTIndicator(data) {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    if (typeof window.PriceVolumTrend === 'function') {
      return window.PriceVolumTrend(closes, volumes, 9);
    }
    return computePVT(closes, volumes);
  }

  // ATR Indicator Computation
  computeATRIndicator(data, period = 14) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    if (typeof window.ATR === 'function') {
      const { ATR } = window.ATR(highs, lows, closes, period);
      return { atr: ATR };
    }
    if (window.WangIndicators?.computeATR) {
      return window.WangIndicators.computeATR(highs, lows, closes, period);
    }
    return { atr: [] };
  }

  // ADI (Accumulation/Distribution Impulse) Indicator Computation
  computeADIIndicator(data, period = 14) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    if (typeof computeADIRef === 'function') {
      return computeADIRef(highs, lows, closes, period);
    }
    // Inline fallback: same logic as computeADIRef
    const adi = new Array(closes.length).fill(null);
    const adis = new Array(closes.length).fill(null);
    if (!closes || closes.length < 2) return { adi, adis };
    adi[0] = 0;
    if (period > 0) adis[0] = adi[0];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        adi[i] = adi[i - 1] + (closes[i] - Math.min(lows[i], closes[i - 1]));
      } else if (closes[i] < closes[i - 1]) {
        adi[i] = adi[i - 1] - (Math.max(highs[i], closes[i - 1]) - closes[i]);
      } else {
        adi[i] = adi[i - 1];
      }
      if (period > 0) {
        adis[i] = ((period - 1) / (period + 1)) * adi[i - 1] + (2 / (period + 1)) * adi[i];
      }
    }
    return { adi, adis };
  }

 

  // ADO Indicator Computation
  computeADOIndicator(data) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const opens = data.map(d => d.open);
    const closes = data.map(d => d.close);
    
    if (!window.WangIndicators || !window.WangIndicators.computeADO) {
      console.error('WangIndicators.computeADO not available');
      return { ado: [] };
    }
    
    const ado = window.WangIndicators.computeADO(opens, highs, lows, closes);
    return { ado };
  }

  // VAO Indicator Computation
  computeVAOIndicator(data) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    
    if (!window.WangIndicators || !window.WangIndicators.computeVAO) {
      console.error('WangIndicators.computeVAO not available');
      return { vao: [] };
    }
    
    const vao = window.WangIndicators.computeVAO(highs, lows, closes, volumes);
    return { vao };
  }

  // HLO Indicator Computation
  computeHLOIndicator(data, period = 14) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    
    if (!window.WangIndicators || !window.WangIndicators.computeHLO) {
      console.error('WangIndicators.computeHLO not available');
      return { hlo: [], hlos: [] };
    }
    
    const result = window.WangIndicators.computeHLO(highs, lows, closes, period);
    return result;
  }

  // VHF Indicator Computation
  computeVHFIndicator(data, period = 14) {
    const closes = data.map(d => d.close);
    
    if (!window.WangIndicators || !window.WangIndicators.computeVHF) {
      console.error('WangIndicators.computeVHF not available');
      return { vhf: [] };
    }
    
    const vhf = window.WangIndicators.computeVHF(closes, period);
    return { vhf };
  }

  // RWI (Random Walk Index) — uses ATR-smoothed True Range and rolling high/low
  // Prefer window.computeRandomWalkIndex from your Wang file if loaded
  computeRandomWalkingIndex(data, RWI_n = 10, esp = 9) {
    const high = data.map(d => d.high);
    const low = data.map(d => d.low);
    const close = data.map(d => d.close);
    const fn = (typeof window !== 'undefined' && window.computeRandomWalkIndex)
      ? window.computeRandomWalkIndex
      : computeRandomWalkIndex;
    const result = fn(RWI_n, esp, high, low, close);
    // Chart expects null for missing; your function uses NaN
    const toNull = (v) => (v != null && Number.isFinite(v) ? v : null);
    return {
      RWI_high: result.RWI_high.map(toNull),
      RWI_low: result.RWI_low.map(toNull)
    };
  }

  // REX Oscillator: TVB = 2*close-(high+low), REX = EMA(TVB, esp)
  computeREXOscillatorIndicator(data, esp = 9, parameters = 10) {
    const high = data.map(d => d.high);
    const low = data.map(d => d.low);
    const close = data.map(d => d.close);
    const result = (typeof window !== 'undefined' && window.REXOscillator)
      ? window.REXOscillator(high, low, close, esp)
      : computeREXOSC(high, low, close, esp);
    const toNull = (v) => (v != null && Number.isFinite(v) ? v : null);
    return {
      REX: result.REX.map(toNull),
      TVB: result.TVB.map(toNull)
    };
  }

  // VR Indicator Computation — Prof Wang VolRatio: day=計算區間, esp=平滑天數
  computeVRIndicator(data, period = 26, esp = 10) {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    if (typeof window.VolRatio === 'function') {
      const { VolRatio, eVolRatio } = window.VolRatio(closes, volumes, period, esp);
      return { vr: VolRatio, vrs: eVolRatio };
    }
    if (window.WangIndicators?.computeVR) {
      return window.WangIndicators.computeVR(closes, volumes, period, esp);
    }
    return { vr: [], vrs: [] };
  }

  // Qstick Indicator Computation
  computeQstickIndicator(data, day1 = 10, day2 = 20) {
    const opens = data.map(d => d.open);
    const closes = data.map(d => d.close);
    if (typeof window.Qstick === 'function') {
      const r1 = window.Qstick(closes, opens, day1, 9);
      const r2 = window.Qstick(closes, opens, day2, 9);
      return { Qstick1: r1.Qstick, Qstick2: r2.Qstick };
    }
    return { Qstick1: [], Qstick2: [] };
  }

  // IMI Indicator Computation
  computeIMIIndicator(data, day1 = 10, day2 = 20) {
    const opens = data.map(d => d.open);
    const closes = data.map(d => d.close);
    if (typeof window.IntradayMomentum === 'function') {
      return window.IntradayMomentum(opens, closes, day1, day2);
    }
    return { IMI1: [], IMI2: [] };
  }

  // M3 Indicator Computation
  computeM3Indicator(data, num = 9) {
    const closes = data.map(d => d.close);
    if (typeof window.M3 === 'function') {
      const { M3, eM3 } = window.M3(closes, num);
      return { m3: M3, em3: eM3 };
    }
    if (window.WangIndicators?.computeM3) {
      return window.WangIndicators.computeM3(closes, num);
    }
    return { m3: [], em3: [] };
  }

  // DMA Indicator Computation
  computeDMAIndicator(data, short_day = 10, long_day = 20, ema_n = 9) {
    const closes = data.map(d => d.close);
    if (typeof window.DiffMA === 'function') {
      const { DiffMA, eDiffMA } = window.DiffMA(closes, short_day, long_day, ema_n);
      return { dma: DiffMA, ama: eDiffMA };
    }
    if (window.WangIndicators?.computeDMA) {
      return window.WangIndicators.computeDMA(closes, short_day, long_day, ema_n);
    }
    return { dma: [], ama: [] };
  }

  /**
   * Hull Moving Average (HMA) + eHMA — Prof Wang 2026-Jan-18
   * Uses window.HullMA from technical-indicators.prods__Wang__2026.js; otherwise inline (same math).
   */
  computeHullMAIndicator(data, day = 10, ema_n = 9) {
    const closes = data.map(d => d.close);
    if (!Array.isArray(closes) || closes.length < day) return { hma: [], ehma: [] };

    if (typeof window !== 'undefined' && typeof window.HullMA === 'function') {
      const { HMA, eHMA } = window.HullMA(closes, day, ema_n);
      return { hma: HMA || [], ehma: eHMA || [] };
    }

    const inline = this._computeHullMAInline(closes, day, ema_n);
    return { hma: inline.HMA || [], ehma: inline.eHMA || [] };
  }

  /**
   * HULLHMA (Wang) — same math as HULL_MA / window.HullMA, but this entry used a
   * different API: compute returned { HMA, eHMA } while render expected data.hullma (bug).
   * We normalize to { hullma, ehullma } for renderHULLMA.
   */
  computeHULLMA(data, day = 10, esp = 9) {
    const inline = this.computeHullMAIndicator(data, day, esp);
    return {
      hullma: inline.hma || [],
      ehullma: inline.ehma || [],
    };
  }

  // VolMA Indicator Computation
  computeVolMAIndicator(data, period = 20) {
    const volumes = data.map(d => d.volume ?? d.vol ?? 0);
    
    if (!window.WangIndicators || !window.WangIndicators.computeVolMA) {
      console.error('WangIndicators.computeVolMA not available');
      return { volma: [] };
    }
    
    const volma = window.WangIndicators.computeVolMA(volumes, period);
    return { volma };
  }

  // Parabolic SAR Indicator Computation
  computeParabolicSARIndicator(data, acceleration, maximum) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    return computeParabolicSAR(highs, lows, acceleration, maximum);
  }

  // Ichimoku Indicator Computation
  computeIchimokuIndicator(data, tenkanPeriod, kijunPeriod, senkouBPeriod) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return computeIchimoku(highs, lows, closes, tenkanPeriod, kijunPeriod, senkouBPeriod);
  }

computeBollingerBands4SDIndicator(data, MA_day=10, SD_day=20) {
  const closes = data.map(d => d.close);
  const len = closes.length; // Number of data points

  const line1 = new Array(len).fill(null);
  const line2 = new Array(len).fill(null);
  const line3 = new Array(len).fill(null);

  //return early if no data
  if(len == 0) return { line1: [], line2: [], line3: [] };

  // Use window.computeBollinger4SD if available; otherwise fall back to local function
  const fn = (typeof window !== 'undefined' && window.computeBollinger4SD)
  ? window.computeBollinger4SD
  : computeBollinger4SD;
  if (!fn) {
    return { line1, line2, line3 };
  }

const out = fn(closes, MA_day, SD_day);
const srcWidth   = out && out.upperBand_lowerBand ? out.upperBand_lowerBand : [];
const srcPercent = out && out.percentB ? out.percentB : [];
const srcBandw   = out && out.Bandwith ? out.Bandwith : [];

// Exactly like the THREE_LINE_EXAMPLE: return { line1, line2, line3 }
for (let i = 1; i < len; i++) {
  const w1 = srcWidth[i];
  const w2 = srcPercent[i];
  const w3 = srcBandw[i];

  line1[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  line2[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  line3[i] = (w3 != null && Number.isFinite(w3)) ? w3 : null;
}
return { line1, line2, line3 };
}

computeMAone_MAtwoIndicator(data, day1 = 5, day2 = 10) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const line1 = new Array(len).fill(null);
  const line2 = new Array(len).fill(null);
  const line3 = new Array(len).fill(null);
  if (len === 0) return { line1: [], line2: [], line3: [] };

  const king =
    typeof window !== 'undefined' && typeof window.KingMA === 'function' ? window.KingMA : null;
  if (!king) return { line1, line2, line3 };

  const r1 = Math.max(1, Math.floor(Number(day1)) || 5);
  const r2 = Math.max(1, Math.floor(Number(day2)) || 10);
  const d1 = Math.min(r1, r2);
  const d2 = Math.max(r1, r2);

  const MA1 = king(closes, d1);
  const MA2 = king(closes, d2);
  for (let i = 0; i < len; i++) {
    const a = MA1[i];
    const b = MA2[i];
    line1[i] = a != null && Number.isFinite(a) ? a : null;
    line2[i] = b != null && Number.isFinite(b) ? b : null;
    const c = closes[i];
    line3[i] = c != null && Number.isFinite(c) ? c : null;
  }
  return { line1, line2, line3 };
}

computeMAoneMAtwoIndicator(data, day1 = 5, day2 = 10) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const line1 = new Array(len).fill(null);
  const line2 = new Array(len).fill(null);
  const line3 = new Array(len).fill(null);
  const rrTradePct = new Array(len).fill(null);
  if (len === 0) {
    return { line1: [], line2: [], line3: [], rrTradePct: [], Acc_RR: 0, BS_times: 0, Avg_RR: 0 };
  }

  const fn =
    typeof window !== 'undefined' && typeof window.MAoneMAtwo === 'function' ? window.MAoneMAtwo : null;
  if (!fn) return { line1, line2, line3, rrTradePct, Acc_RR: 0, BS_times: 0, Avg_RR: 0 };

  const r1 = Math.max(1, Math.floor(Number(day1)) || 5);
  const r2 = Math.max(1, Math.floor(Number(day2)) || 10);

  let out;
  try {
    out = fn(closes, r1, r2);
  } catch (e) {
    console.warn('MAoneMAtwo (Wang):', e);
    return { line1, line2, line3, rrTradePct, Acc_RR: 0, BS_times: 0, Avg_RR: 0 };
  }
  if (!out) return { line1, line2, line3, rrTradePct, Acc_RR: 0, BS_times: 0, Avg_RR: 0 };

  const src1 = out.MA1 || [];
  const src2 = out.MA2 || [];

  for (let i = 0; i < len; i++) {
    const a = src1[i];
    const b = src2[i];
    line1[i] = a != null && Number.isFinite(a) ? a : null;
    line2[i] = b != null && Number.isFinite(b) ? b : null;
  }

  // window.MAoneMAtwo only returns scalar totals (Acc_RR/BS_times/Avg_RR), not a
  // per-bar series - replay the same buy(MA1)/sell(MA2) crossover logic here so
  // line3 (running cumulative RR%) and rrTradePct (per-trade RR%) have real data.
  let accRR = 0;
  let bsFlag = 'N';
  let buyPrice = 0;
  if (line1[r1] != null && closes[r1] > line1[r1]) {
    buyPrice = closes[r1];
    bsFlag = 'Y';
  }
  for (let i = r1 + 1; i < len; i++) {
    if (line1[i - 1] != null && line1[i] != null && closes[i - 1] < line1[i - 1] && closes[i] > line1[i] && bsFlag === 'N') {
      buyPrice = closes[i];
      bsFlag = 'Y';
    } else if (line2[i - 1] != null && line2[i] != null && closes[i - 1] > line2[i - 1] && closes[i] < line2[i] && bsFlag === 'Y') {
      const sellPrice = closes[i];
      const rr = buyPrice ? (sellPrice - buyPrice) / buyPrice * 100 : 0;
      accRR += rr;
      rrTradePct[i] = rr;
      bsFlag = 'N';
    }
    line3[i] = accRR;
  }

  return {
    line1,
    line2,
    line3,
    rrTradePct,
    Acc_RR: out.Acc_RR,
    BS_times: out.BS_times,
    Avg_RR: out.Avg_RR,
  };
}

computePVIpercentRiseFallIndicator(data, day = 10, esp = 10) {
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length;

  const line1 = new Array(len).fill(null);
  const line2 = new Array(len).fill(null);

  if (len === 0) return { line1: [], line2: [] };

  const fn = (typeof window !== 'undefined' && window.PVIpercentRiseFall)
    ? window.PVIpercentRiseFall
    : null;
  if (!fn) {
    return { line1, line2 };
  }

  const out = fn(closes, volumes, day, esp);
  const srcPVIpercentRiseFall = out && out.PVIpercentRiseFall ? out.PVIpercentRiseFall : [];
  const srcEPVIpercentRiseFall = out && out.ePVIpercentRiseFall ? out.ePVIpercentRiseFall : [];

  // PVIpercentRiseFall indexes straight into the closes/volumes arrays we pass it
  // (not a shifted 1-based copy), so its output aligns 1:1 with our own 0-based
  // index - no +1 shift here, or the last bar (index len-1) reads past what the
  // source function ever set (its loop stops at `i < K_close.length`) and comes
  // out null.
  for (let i = day; i < len; i++) {
    const w1 = srcPVIpercentRiseFall[i];
    const w2 = srcEPVIpercentRiseFall[i];
    line1[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    line2[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { line1, line2 };
}
// DEMA — delegates to Wang_design_DEMA_2026-03-14.js (1-based STK_close indexing)
  computeDEMAIndicator(data, esp = 9) {
    const closes = data.map((d) => d.close);
    const len = closes.length;
    const dema = new Array(len).fill(null);
    const ema = new Array(len).fill(null);

    if (len === 0) return { dema: [], ema: [] };

    const fn = typeof window !== 'undefined' && typeof window.DEMA === 'function'
      ? window.DEMA
      : null;
    if (!fn) return { dema, ema };

    const period = Math.max(1, Math.floor(Number(esp)) || 9);
    if (len < period) return { dema, ema };

    const STK_close = new Array(len + 1);
    for (let k = 0; k < len; k++) {
      STK_close[k + 1] = closes[k];
    }

    let out;
    try {
      out = fn(STK_close, period);
    } catch (e) {
      console.warn('DEMA (Wang):', e);
      return { dema, ema };
    }

    const srcDEMA = out && out.DEMA ? out.DEMA : [];
    const srcEMA = out && out.EMA ? out.EMA : [];

    for (let b = 0; b < len; b++) {
      const w = b + 1;
      const d = srcDEMA[w];
      const e = srcEMA[w];
      dema[b] = d != null && Number.isFinite(d) ? d : null;
      ema[b] = e != null && Number.isFinite(e) ? e : null;
    }

    return { dema, ema };
  }

computeAlligatorIndicator(data, day = 10) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
 
  const len = highs.length;

  const line1 = new Array(len).fill(null);
  const line2 = new Array(len).fill(null);
  const line3 = new Array(len).fill(null);

  if (len === 0) return { line1: [], line2: [], line3: [] };
  
  const fn = (typeof window !== 'undefined' && window.Alligator)
    ? window.Alligator
    : null;
  if (!fn) {
    return { line1, line2, line3 };
  }

  const out = fn(highs, lows);
  const srcLip = out && out.Lip_emp ? out.Lip_emp : [];
  const srcTeeth = out && out.Teeth_emp ? out.Teeth_emp : [];
  const srcJaw = out && out.Jaw_emp ? out.Jaw_emp : [];

  // Wang uses 1-based indexing: Lip_emp[4..len], Teeth_emp[6..len], Jaw_emp[9..len]
  for (let i = 3; i < len; i++) {
    const w1 = srcLip[i + 1];
    line1[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  }
  for (let i = 5; i < len; i++) {
    const w2 = srcTeeth[i + 1];
    line2[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  for (let i = 8; i < len; i++) {
    const w3 = srcJaw[i + 1];
    line3[i] = (w3 != null && Number.isFinite(w3)) ? w3 : null;
  }
  return { line1, line2, line3 };
}

computeZeroLagHullMAIndicator(data, day1 = 10, day2 = 15, esp = 9) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const zeroLagHMA = new Array(len).fill(null);
  const hma = new Array(len).fill(null);
  const eHMA = new Array(len).fill(null);
  if (len === 0) return { zeroLagHMA: [], hma: [], eHMA: [] };

  const fn = (typeof window !== 'undefined' && typeof window.ZeroLagHullMA === 'function')
    ? window.ZeroLagHullMA
    : null;
  if (!fn) return { zeroLagHMA, hma, eHMA };


  const closes1 = { length: len };
  for (let i = 1; i <= len; i++) closes1[i] = closes[i - 1];

  const out = fn(closes1, day1, day2, esp) || {};
  const srcZeroLagHMA = out.ZeroLagHMA || out.ZeroLagHullMA || [];
  const srcHMA = out.HMA || [];
  const srcEHMA = out.eHMA || [];

  for (let i = 0; i < len; i++) {
    const w1 = srcZeroLagHMA[i + 1];
    zeroLagHMA[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;

    const w2 = srcHMA[i + 1];
    hma[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;

    const w3 = srcEHMA[i + 1];
    eHMA[i] = (w3 != null && Number.isFinite(w3)) ? w3 : null;
  }

  // return with clear names, plus aliases for any older render code
  return { zeroLagHMA, hma, eHMA, zeroLagHullMA: zeroLagHMA };
}

computeBalanceOfPowerIndicator(data, day = 10, esp = 9) {
  const opens = data.map(d => d.open);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const bop = new Array(len).fill(null);
  const eBOP = new Array(len).fill(null);
  if (len === 0) return { bop: [], eBOP: [] };

  const fn = (typeof window !== 'undefined' && window.BalanceOfPower)
    ? window.BalanceOfPower
    : null;
  if (!fn) return { bop, eBOP };

  const out = fn(opens, highs, lows, closes, day, esp);
  const srcBOP = out && out.BOP_SMA ? out.BOP_SMA : [];
  const srcEBOP = out && out.BOP_esp ? out.BOP_esp : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcBOP[i] || null ;
    bop[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcEBOP[i] || null ;
    eBOP[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { bop, eBOP };
}


computeStochasticSMIIndicator(data, day = 13, rr = 25, ss = 2, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const SMI = new Array(len).fill(null);
  const SignalLine = new Array(len).fill(null);
  if (len === 0) return { SMI: [], SignalLine: [] };

  const fn = (typeof window !== 'undefined' && window.StochasticSMI)
    ? window.StochasticSMI
    : null;
  if (!fn) return { SMI, SignalLine };

  const out = fn(highs, lows, closes, day, rr, ss, esp);
  const srcSMI = out && out.SMI ? out.SMI : [];
  const srcSignalLine = out && out.SignalLine ? out.SignalLine : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcSMI[i];
    SMI[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcSignalLine[i];
    SignalLine[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { SMI, SignalLine };
}

computeRiseFallRatioCOGIndicator(data, day = 10, esp = 9) { 
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const riseFallRatio = new Array(len).fill(null);
  const eRiseFallRatioCOG = new Array(len).fill(null);
  if (len === 0) return { riseFallRatio: [], eRiseFallRatio: [] };

  const fn = (typeof window !== 'undefined' && window.RiseFallRatioCOG)
    ? window.RiseFallRatioCOG
    : null;
  if (!fn) return { riseFallRatio, eRiseFallRatio };

  const out = fn(closes, day, esp);
  const srcRiseFallRatio = out && out.RiseFallRatioCOG ? out.RiseFallRatioCOG : [];
  const srceRiseFallRatioCOG = out && out.eRiseFallRatioCOG ? out.eRiseFallRatioCOG : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcRiseFallRatio[i];
    riseFallRatio[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srceRiseFallRatioCOG[i];
    eRiseFallRatioCOG[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { riseFallRatio, eRiseFallRatioCOG };
}

computeGravityOscCOGIndicator(data, day = 10, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const COG = new Array(len).fill(null);
  const eCOG = new Array(len).fill(null);
  if (len === 0) return { COG: [], eCOG: [] };

  const fn = (typeof window !== 'undefined' && window.GravityOsc_COG)
    ? window.GravityOsc_COG
    : null;
  if (!fn) return { COG, eCOG };

  const out = fn(closes, day, esp);
  const srcCOG = out && out.COG ? out.COG : [];
  const srceCOG = out && out.eCOG ? out.eCOG : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcCOG[i];
    COG[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srceCOG[i];
    eCOG[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { COG, eCOG };
}

 // ADR (Advance/Decline Ratio) Indicator Computation
  computeADRIndicator(data, day = 20, esp = 10) {
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const len = closes.length;
    const ADR = new Array(closes.length).fill(null);
    const eADR = new Array(closes.length).fill(null);
    if (len === 0) return {ADR:[], eADR:[]};
    
    if (!window.ADR || !window.ADR) {
      console.error('WangIndicators.ADR not available');
      return { ADR: [], eADR: [] };
    }
    const fn = (typeof window !== 'undefined' && window.ADR) ? window.ADR : null;
    if (!fn) {
      return { ADR, eADR };
    }

    const out = fn(closes, day, esp);
    const srcADR = out && out.ADR ? out.ADR : [];
    const srceADR = out && out.eADR ? out.eADR : [];

    for (let i = 0; i < len; i++) {
      const w1 = srcADR[i];
      ADR[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
      const w2 = srceADR[i];
      eADR[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
    }
    return { ADR, eADR };
  }

  computeVRMAIndicator(data, day1 = 5, day2 = 10) {
    const closes = data.map(d => d.close);
    const len = closes.length;
    if (typeof window === 'undefined' || !window.VariantRateMA) {
      console.error('window.VariantRateMA not available');
      return { vrma1: new Array(len).fill(null), vrma2: new Array(len).fill(null) };
    }
    const out = window.VariantRateMA(closes, day1, day2);
    return {
      vrma1: out.VarRtMA1 || [],
      vrma2: out.VarRtMA2 || []
    };
  }

computePGOIndicator(data, day = 10, n_period = 14, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const PGO = new Array(len).fill(null);
  const ePGO = new Array(len).fill(null);
  if (len === 0) return { PGO: [], ePGO: [] };

  const fn = (typeof window !== 'undefined' && window.PGO) ? window.PGO : null;
  if (!fn) return { PGO, ePGO };

  const out = fn(highs, lows, closes, day, n_period, esp);
  const srcPGO = out && out.PGO ? out.PGO : [];
  const srcePGO = out && out.ePGO ? out.ePGO : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcPGO[i];
    PGO[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcePGO[i];
    ePGO[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { PGO, ePGO };
}

computeKairiRIIndicator(data, day = 10, esp = 9) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const KRI = new Array(len).fill(null);
  const eKRI = new Array(len).fill(null);
  if (len === 0) return { KRI: [], eKRI: [] };

  const fn = (typeof window !== 'undefined' && window.KairiRI) ? window.KairiRI : null;
  if (!fn) return { KRI, eKRI };

  const out = fn(closes, day, esp);
  const srcKRI = out && out.KRI ? out.KRI : [];
  const srceKRI = out && out.eKRI ? out.eKRI : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcKRI[i];
    KRI[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srceKRI[i];
    eKRI[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { KRI, eKRI };
}



computeGaussianFilterIndicator(data, day = 10, sigma = 3, esp = 9) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const GaussianMA = new Array(len).fill(null);
  const eGaussianMA = new Array(len).fill(null);
  if (len === 0) return { GaussianMA: [], eGaussianMA: [] };

  const fn = (typeof window !== 'undefined' && window.Gaussian) ? window.Gaussian : null;
  if (!fn) return { GaussianMA, eGaussianMA };
  sigma = Math.min(sigma, 5);
  
  const out = fn(closes, day, sigma, esp);
  const srcGaussianMA = out && out.GaussianMA ? out.GaussianMA : [];
  const srceGaussianMA = out && out.eGaussianMA ? out.eGaussianMA : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcGaussianMA[i];
    GaussianMA[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srceGaussianMA[i];
    eGaussianMA[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { GaussianMA, eGaussianMA };
 }


 computeVortexIndicator(data, day = 10) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const pVI = new Array(len).fill(null);
  const nVI = new Array(len).fill(null);
  if (len === 0) return { pVI: [], nVI: [] };

  const fn = (typeof window !== 'undefined' && window.Vortex) ? window.Vortex : null;
  if (!fn) return { pVI, nVI };

  const out = fn(highs, lows, closes, day);
  const srcPVI = out && out.pVI ? out.pVI : [];
  const srcNVI = out && out.nVI ? out.nVI : [];
  // Preserve the source index alignment from the Vortex function.
  for (let i = 0; i < len; i++) {
    const w1 = srcPVI[i];
    pVI[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcNVI[i];
    nVI[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { pVI, nVI };

 }

 computeDVOIndicator(data, day = 10, m = 20) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const percentil = new Array(len).fill(null);
  if (len === 0) return {percentil: []};

  const fn = (typeof window !== 'undefined' && window.DVO) ? window.DVO : null;
  if (!fn) return { percentil };  
  
  const out = fn(highs, lows, closes, day, m);
  const srcPercentil = out && out.PercentileRank ? out.PercentileRank : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcPercentil[i];
    percentil[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  }
  return { percentil };
}


computeKlingerOscillator(data, day1 = 34, day2 = 55, day3 = 13) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length;
  const KO = new Array(len).fill(null);
  const signalLine = new Array(len).fill(null);
  if (len === 0) return { KO: [], signalLine: [] };

  const fn = (typeof window !== 'undefined' && window.KlingerOsc) ? window.KlingerOsc : null;
  if (!fn) return { KO, signalLine };

  const out = fn(highs, lows, closes, volumes, day1, day2, day3);
  const srcKO = out && out.KO ? out.KO : [];
  const srcSignalLine = out && out.SignalLine ? out.SignalLine : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcKO[i];
    KO[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcSignalLine[i];
    signalLine[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { KO, signalLine };
}


computeMcClellanOscillator(data, day = 10, esp1 = 20, esp2 = 40) {
  const closes = data.map(d => d.close ?? 0);
  const len = closes.length;
  const mcclellanOsc = new Array(len).fill(null);
  const SI = new Array(len).fill(null);
  if (len === 0) return { mcclellanOsc: [], SI: [] };

  const fn = (typeof window !== 'undefined' && window.McClellanOSC) ? window.McClellanOSC : null;
  if (!fn) return { mcclellanOsc, SI };

  const out = fn(closes, day, esp1, esp2);
  const srcMcClellanOsc = out && out.McClellanOSC ? out.McClellanOSC : [];
  const srcSI = out && out.SI ? out.SI : [];
  // let day = out && out.McClellanOSC ? out.McClellanOSC : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcMcClellanOsc[i];
    mcclellanOsc[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcSI[i];
    SI[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { mcclellanOsc, SI };
}


computeOBOSIndicator(data, day = 10, esp = 11) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const OBOS = new Array(len).fill(null);
  const eOBOS = new Array(len).fill(null);
   if (len === 0) return { OBOS: [], eOBOS: [] };

  const fn = (typeof window !== 'undefined' && window.OBOS) ? window.OBOS : null;
  if (!fn) return { OBOS, eOBOS };
  const out = fn(closes, day, esp);
  const srcOBOS = out && out.OBOS ? out.OBOS : [];
  const srceOBOS = out && out.eOBOS ? out.eOBOS : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcOBOS[i];
    OBOS[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srceOBOS[i];
    eOBOS[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { OBOS, eOBOS };
}


computeQstickBodyAvgIndicator(data, day = 10, esp = 9) { 
  const opens = data.map(d => d.open);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const QstickBodyAvg = new Array(len).fill(null);
  const eQstickBodyAvg = new Array(len).fill(null);
  if (len === 0) return { QstickBodyAvg: [], eQstickBodyAvg: [] };

  const fn = (typeof window !== 'undefined' && window.QstickBodyAvg) ? window.QstickBodyAvg : null;
  if (!fn) return { QstickBodyAvg, eQstickBodyAvg };

  const out = fn(opens, closes, day, esp);
  const srcQstickBodyAvg = out && out.QstickBodyAvg ? out.QstickBodyAvg : [];
  const srceQstickBodyAvg = out && out.eQstickBodyAvg ? out.eQstickBodyAvg : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcQstickBodyAvg[i];
    QstickBodyAvg[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srceQstickBodyAvg[i];
    eQstickBodyAvg[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { QstickBodyAvg, eQstickBodyAvg };
}



computeADXDMIIndicator(data, esp = 2) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const ADX = new Array(len).fill(null);
  const DIPlus = new Array(len).fill(null);
  const DIMinus = new Array(len).fill(null);
  if (len === 0) return { ADX: [], DIPlus: [], DIMinus: [] };

  const fn = (typeof window !== 'undefined' && window.ADX_DMI) ? window.ADX_DMI : null;
  if (!fn) return { ADX, DIPlus, DIMinus };

  const out = fn(highs, lows, closes, esp);
  const srcADX = out && (out.ADX || out.adx) ? (out.ADX || out.adx) : [];
  const srcDIPlus = out && (out.DIPlus || out.DI_plus) ? (out.DIPlus || out.DI_plus) : [];
  const srcDIMinus = out && (out.DIMinus || out.DI_minus) ? (out.DIMinus || out.DI_minus) : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcADX[i];
    ADX[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcDIPlus[i];
    DIPlus[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
    const w3 = srcDIMinus[i];
    DIMinus[i] = (w3 != null && Number.isFinite(w3)) ? w3 : null;
  }
  return { ADX, DIPlus, DIMinus };
}


computeAdaptiveMAIndicator(data, day = 10, esp = 9) {
  const highs = data.map(d => d.high);
  const opens = data.map(d => d.open);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const AdaptiveMA = new Array(len).fill(null);
  // const eAdaptiveMA = new Array(len).fill(null);
  if (len === 0) return { AdaptiveMA: [] };

  const fn = (typeof window !== 'undefined' && window.AdaptiveMA) ? window.AdaptiveMA : null;
  if (!fn) return { AdaptiveMA };

   const out = fn(highs, opens, closes, day);
   const srcAdaptiveMA = out && (out.AdaptiveMA || out.adaptiveMA) ? (out.AdaptiveMA || out.adaptiveMA) : [];
  // const srcAdaptiveMA = out && out.AdaptiveMA ? out.AdaptiveMA : [];
  // const srceAdaptiveMA = out && out.eAdaptiveMA ? out.eAdaptiveMA : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcAdaptiveMA[i];
    AdaptiveMA[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    // const w2 = srceAdaptiveMA[i];
    // eAdaptiveMA[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { AdaptiveMA};
}


computeWilliamsVolatilityChannelIndicator(data, day = 10, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const Upperline = new Array(len).fill(null);
  const MiddleLine= new Array(len).fill(null);
  const Lowerline = new Array(len).fill(null);
  if (len === 0) return { Upperline: [], MiddleLine: [], Lowerline: [] };

  const fn = (typeof window !== 'undefined' && window.WilliamsVolatilityChannel) ? window.WilliamsVolatilityChannel : null;
  if (!fn) return { Upperline, MiddleLine, Lowerline };
  const out = fn(highs, lows, closes, day, esp);
  const srcUpper = out && out.UpperLine ? out.UpperLine : [];
  const srcMiddle = out && out.MiddleLine ? out.MiddleLine : [];
  const srcLower = out && out.LowerLine ? out.LowerLine : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcUpper[i];
    Upperline[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcMiddle[i];
    MiddleLine[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
    const w3 = srcLower[i];
    Lowerline[i] = (w3 != null && Number.isFinite(w3)) ? w3 : null;
  }
  return { Upperline, MiddleLine, Lowerline };
}


computeVolumeZoneOscillator(data, day = 10, esp = 9) {
  const closes  = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length;
  const VolZoneOsc = new Array(len).fill(null);
  if (len === 0) return { VolZoneOsc: [] };

  const fn = (typeof window !== 'undefined' && window.VolumeZoneOsc) ? window.VolumeZoneOsc : null;
  if (!fn) return { VolZoneOsc };
  const out = fn(closes, volumes, esp);
  const srcVolZoneOsc = out && out.VolZoneOsc ? out.VolZoneOsc : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcVolZoneOsc[i + 1];
    VolZoneOsc[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  }
  return { VolZoneOsc };
}

computeDynamicZoneRSI(data, day = 10, esp = 9) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const DZ_upper = new Array(len).fill(null);
  const DZ_mid = new Array(len).fill(null);
  const DZ_lower = new Array(len).fill(null);
   if (len === 0) return { DZ_upper: [], DZ_mid: [] , DZ_lower: []};

  const fn = (typeof window !== 'undefined' && window.DynamicZoneRSI) ? window.DynamicZoneRSI : null;
  if (!fn) return { DZ_upper, DZ_lower, DZ_mid };
  const out = fn(closes, day, esp); 
  const srcDZUpper = out && out.DZ_upper ? out.DZ_upper : [];
  const srcDZMid = out && out.DZ_mid ? out.DZ_mid : [];
  const srcDZLower = out && out.DZ_lower ? out.DZ_lower : [];
  
  for (let i = 0; i < len; i++) {
    const w1 = srcDZUpper[i];
    DZ_upper[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcDZMid[i];
    DZ_mid[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
    const w3 = srcDZLower[i];
    DZ_lower[i] = (w3 != null && Number.isFinite(w3)) ? w3 : null;
  }
  return { DZ_upper, DZ_lower, DZ_mid };
}

computeVolumeFlowIndicator(data, day = 10, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length;
  const VolFlowIndicator = new Array(len).fill(null);
  const eVolFlowIndicator = new Array(len).fill(null);
  if (len === 0) return { VolFlowIndicator: [], eVolFlowIndicator: [] };

  const fn = (typeof window !== 'undefined' && window.VolumeFlowIndicator) ? window.VolumeFlowIndicator : null;
  if (!fn) return { VolFlowIndicator, eVolFlowIndicator };

  const out = fn(highs, lows, closes, volumes, day, esp);
  const srcVolFlowIndicator = out && out.VolFlowIndicator ? out.VolFlowIndicator : [];
  const srceVolFlowIndicator = out && out.eVolFlowIndicator ? out.eVolFlowIndicator : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcVolFlowIndicator[i];
    VolFlowIndicator[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;  
    const w2 = srceVolFlowIndicator[i];
    eVolFlowIndicator[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }
  return { VolFlowIndicator, eVolFlowIndicator };
}

computeFractalDimensionIndex(data, day = 10) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const FDI = new Array(len).fill(null);
  if (len === 0) return { FDI: [] };

  const fn = (typeof window !== 'undefined' && window.FractalDimensionIndex) ? window.FractalDimensionIndex : null;
  if (!fn) return { FDI };
  const out = fn(highs, lows, closes, day);
  const srcFDI = out && out.FDI ? out.FDI : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcFDI[i];
    FDI[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  }
  return { FDI };
}


computeWilliamsPercentRange(data, day = 10) {
  const highs = data.map(d => d.high); 
  const lows = data.map(d => d.low); 
  const closes = data.map(d => d.close);
  const len = closes.length;
  const WilliamsPctRange = new Array(len).fill(null);
  if (len === 0) return { WilliamsPctRange: [] };

  const fn = (typeof window !== 'undefined' && window.WilliamsPercentRange) ? window.WilliamsPercentRange : null;
  if (!fn) return { WilliamsPctRange };
  const out = fn(highs, lows, closes, day);
  const srcWilliamsPctRange = out && out.WilliamsPctRange ? out.WilliamsPctRange : [];
  for (let i = 0; i < len; i++) { 
    const w1 = srcWilliamsPctRange[i];
    WilliamsPctRange[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  }
  return { WilliamsPctRange };
}

computeAlphaBetaMA(data, ma_day = 10, alpha = 1, beta = 1) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const STK_close = new Array(len).fill(null);
  const MA = new Array(len).fill(null);
  // const TypicalPrice = new Array(len).fill(null);
  if (len === 0) return { MA: [], STK_close: [] };

  const fn = (typeof window !== 'undefined' && window.AlphaBetaMA) ? window.AlphaBetaMA : null;
  if (!fn) return { MA, STK_close };
  const out = fn(highs, lows, closes, ma_day, alpha, beta);
  const srcMA = out && out.MA ? out.MA : [];
  const srcSTK_close = out && out.STK_close ? out.STK_close : [];

  for (let i = 0; i < len; i++) {
    const w1 = srcMA[i];
    MA[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    const w2 = srcSTK_close[i];
    STK_close[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  }

  // Count buy/sell transactions using the same logic as AlphaBetaMA
  let sum_Buy_Sell_times = 0;
  let sum_ROI = 0;
  let BuyPrice = 0;
  for (let i = ma_day + 2; i <= len; i++) {
    if (MA[i] == null || MA[i-1] == null || MA[i-2] == null) continue;
    if ((MA[i-1] < MA[i-2] && MA[i-1] < MA[i]) && (MA[i] > (1 + alpha / 100) * MA[i-1])) {
      BuyPrice = closes[i] ?? 0;
    } else if ((MA[i-1] > MA[i-2] && MA[i-1] > MA[i]) && (MA[i] < (1 - beta / 100) * MA[i-1])) {
      if (BuyPrice !== 0) {
        const SellPrice = closes[i] ?? 0;
        sum_ROI += (SellPrice - BuyPrice) / BuyPrice * 100;
        sum_Buy_Sell_times += 1;
        BuyPrice = 0;
      }
    }
  }

  return { MA, STK_close, sum_Buy_Sell_times, sum_ROI };
}




// ===================================NEW INDICATORS (Wang prods lines 6145-8461):===========

computeEfficiencyRatio(data, day = 10, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const ER = new Array(len).fill(null); const eER = new Array(len).fill(null);
  if (len === 0 || typeof window.EfficiencyRatio !== 'function') return { ER, eER };
  const out = window.EfficiencyRatio(highs, lows, closes, day, esp);
  const s1 = out.ER || []; const s2 = out.eER || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; ER[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eER[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { ER, eER };
}

computeAccuDistLine(data, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length; const ADL = new Array(len).fill(null); const eADL = new Array(len).fill(null);
  if (len === 0 || typeof window.AccuDistLine !== 'function') return { ADL, eADL };
  const out = window.AccuDistLine(highs, lows, closes, volumes, esp);
  const s1 = out.AccuDistLine || []; const s2 = out.eAccuDistLine || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; ADL[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eADL[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { ADL, eADL };
}

computeZeroLagKD(data, KD_day = 9, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const ZeroLag_K = new Array(len).fill(null); const ZeroLag_D = new Array(len).fill(null);
  if (len === 0 || typeof window.ZeroLag_KD !== 'function') return { ZeroLag_K, ZeroLag_D };
  const out = window.ZeroLag_KD(highs, lows, closes, KD_day, esp);
  const s1 = out.ZeroLag_K || []; const s2 = out.ZeroLag_D || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; ZeroLag_K[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; ZeroLag_D[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { ZeroLag_K, ZeroLag_D };
}

computeWaveVolume(data) {
  const closes = data.map(d => d.close); const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length; const WaveVol = new Array(len).fill(null);
  if (len === 0 || typeof window.WaveVolume !== 'function') return { WaveVol };
  const out = window.WaveVolume(closes, volumes);
  const s1 = out.WaveVolume || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; WaveVol[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { WaveVol };
}

computeElderForceIndex(data, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length; const EFI = new Array(len).fill(null); const eEFI = new Array(len).fill(null);
  if (len === 0 || typeof window.ElderForce !== 'function') return { EFI, eEFI };
  const out = window.ElderForce(highs, lows, closes, volumes, esp);
  const s1 = out.EFI || []; const s2 = out.eEFI || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; EFI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eEFI[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { EFI, eEFI };
}

computeTimeSegVol(data, day = 10) {
  const closes = data.map(d => d.close); const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length; const TimeSegVol = new Array(len).fill(null);
  if (len === 0 || typeof window.TimeSegmentedVol !== 'function') return { TimeSegVol };
  const out = window.TimeSegmentedVol(closes, volumes, day);
  const s1 = out.TimeSegVol || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; TimeSegVol[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { TimeSegVol };
}

computeTimeSegVolTP(data, day = 10) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume ?? d.vol ?? 0);
  const len = closes.length; const TimeSegVol_TP = new Array(len).fill(null);
  if (len === 0 || typeof window.TimeSegmentedVol_TP !== 'function') return { TimeSegVol_TP };
  const out = window.TimeSegmentedVol_TP(highs, lows, closes, volumes, day);
  const s1 = out.TimeSegVol_TP || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; TimeSegVol_TP[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { TimeSegVol_TP };
}

computeRSI_Mom(data, RSI_day = 10) {
  const closes = data.map(d => d.close);
  const len = closes.length; const RSI_Mom = new Array(len).fill(null);
  if (len === 0 || typeof window.RSI_Momentum !== 'function') return { RSI_Mom };
  const out = window.RSI_Momentum(closes, RSI_day);
  const s1 = out.RSI_Momentum || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; RSI_Mom[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { RSI_Mom };
}

computeRSI_CenteredCumul(data, RSI_day = 10) {
  const closes = data.map(d => d.close);
  const len = closes.length; const CenteredCumulRSI = new Array(len).fill(null);
  if (len === 0 || typeof window.RSI_CenteredCumulative !== 'function') return { CenteredCumulRSI };
  const out = window.RSI_CenteredCumulative(closes, RSI_day);
  const s1 = out.CenteredCumul_RSI || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; CenteredCumulRSI[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { CenteredCumulRSI };
}

computeSchaffTrend(data, short_day = 10, long_day = 20, kd_day = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const STC = new Array(len).fill(null);
  if (len === 0 || typeof window.SchaffTrend !== 'function') return { STC };
  const out = window.SchaffTrend(highs, lows, closes, short_day, long_day, kd_day);
  const s1 = out.STC || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; STC[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { STC };
}

computeFisherTransform(data, Fisher_day = 10, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const Fisher = new Array(len).fill(null); const FisherSignal = new Array(len).fill(null);
  if (len === 0 || typeof window.FisherTransform !== 'function') return { Fisher, FisherSignal };
  const out = window.FisherTransform(highs, lows, closes, Fisher_day, esp);
  const s1 = out.Fisher || []; const s2 = out.Signal || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; Fisher[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; FisherSignal[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { Fisher, FisherSignal };
}

computeAwesomeOsc(data, day1 = 5, day2 = 34) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low);
  const len = highs.length; const AwesomeOsc = new Array(len).fill(null);
  if (len === 0 || typeof window.AwesomeOscillator !== 'function') return { AwesomeOsc };
  const out = window.AwesomeOscillator(highs, lows, day1, day2);
  const s1 = out.AwesomeOsc || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; AwesomeOsc[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { AwesomeOsc };
}

computeChoppinessIdx(data, num = 10) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const Choppiness = new Array(len).fill(null);
  if (len === 0 || typeof window.ChoppinessIndex !== 'function') return { Choppiness };
  const out = window.ChoppinessIndex(highs, lows, closes, num);
  const s1 = out.Choppiness || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; Choppiness[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { Choppiness };
}

computeTSI(data, esp1 = 25, esp2 = 13, m = 7) {
  const closes = data.map(d => d.close);
  const len = closes.length; const TSI = new Array(len).fill(null); const TSI_Signal = new Array(len).fill(null);
  if (len === 0 || typeof window.TrueStrengthIndex !== 'function') return { TSI, TSI_Signal };
  const out = window.TrueStrengthIndex(closes, esp1, esp2, m);
  const s1 = out.TSI || []; const s2 = out.Signal || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; TSI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; TSI_Signal[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { TSI, TSI_Signal };
}

computeRVI_Vol(data, SD_num = 10, esp = 14) {
  const closes = data.map(d => d.close);
  const len = closes.length; const RVI_Vol = new Array(len).fill(null); const eRVI_Vol = new Array(len).fill(null);
  if (len === 0 || typeof window.RelativeVolatilityIndex !== 'function') return { RVI_Vol, eRVI_Vol };
  const out = window.RelativeVolatilityIndex(closes, SD_num, esp);
  const s1 = out.RVI || []; const s2 = out.eRVI || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; RVI_Vol[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eRVI_Vol[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { RVI_Vol, eRVI_Vol };
}

computeREI(data, REI_length = 8, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low);
  const len = highs.length; const REI = new Array(len).fill(null); const eREI = new Array(len).fill(null);
  if (len === 0 || typeof window.RangeExpansionIndex !== 'function') return { REI, eREI };
  const out = window.RangeExpansionIndex(highs, lows, REI_length, esp);
  const s1 = out.REI || []; const s2 = out.eREI || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; REI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eREI[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { REI, eREI };
}

computeRelVigorIndex(data, RVI_day = 10) {
  const opens = data.map(d => d.open); const highs = data.map(d => d.high);
  const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const VigorRVI = new Array(len).fill(null); const VigorSignal = new Array(len).fill(null);
  if (len === 0 || typeof window.RelativeVigorIndex !== 'function') return { VigorRVI, VigorSignal };
  const out = window.RelativeVigorIndex(opens, highs, lows, closes, RVI_day);
  const s1 = out.RVI || []; const s2 = out.Signal || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; VigorRVI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; VigorSignal[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { VigorRVI, VigorSignal };
}

computeAroonOsc(data, Aroon_day = 25) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low);
  const len = highs.length; const AroonOsc = new Array(len).fill(null);
  if (len === 0 || typeof window.AroonOscillator !== 'function') return { AroonOsc };
  const out = window.AroonOscillator(highs, lows, Aroon_day);
  const s1 = out.AroonOsc || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; AroonOsc[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { AroonOsc };
}

computeStdDevIndicator(data, SD_num = 10, esp = 9) {
  const closes = data.map(d => d.close);
  const len = closes.length; const SD = new Array(len).fill(null); const eSD = new Array(len).fill(null);
  if (len === 0 || typeof window.StandardDeviationIndicator !== 'function') return { SD, eSD };
  const out = window.StandardDeviationIndicator(closes, SD_num, esp);
  const s1 = out.SD || []; const s2 = out.eSD || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; SD[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eSD[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { SD, eSD };
}

computeRainbowOscillator(data, ma_day = 10) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const Rainbow = new Array(len).fill(null);
  if (len === 0 || typeof window.RainbowOsc !== 'function') return { Rainbow };
  const out = window.RainbowOsc(highs, lows, closes, ma_day);
  const s1 = out.Rainbow || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; Rainbow[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { Rainbow };
}

computeRainbowMA(data, num = 10) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length;
  const rma1 = new Array(len).fill(null); const rma2 = new Array(len).fill(null);
  const rma3 = new Array(len).fill(null); const rma4 = new Array(len).fill(null);
  const rma5 = new Array(len).fill(null); const rma = new Array(len).fill(null);
  if (len === 0 || typeof window.RainbowMA !== 'function') return { rma1, rma2, rma3, rma4, rma5, rma };
  const out = window.RainbowMA(highs, lows, closes, num);
  const keys = ['SMA1','SMA2','SMA3','SMA4','SMA5','RMA'];
  const tgts = [rma1, rma2, rma3, rma4, rma5, rma];
  keys.forEach((k, idx) => {
    const s = out[k] || [];
    for (let i = 0; i < len; i++) { const v = s[i]; tgts[idx][i] = (v != null && Number.isFinite(v)) ? v : null; }
  });
  return { rma1, rma2, rma3, rma4, rma5, rma };
}

computeLinearReg(data, N = 10, K = 2) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const LRI = new Array(len).fill(null); const LRI_upper = new Array(len).fill(null); const LRI_lower = new Array(len).fill(null);
  if (len === 0 || typeof window.LinearRegression !== 'function') return { LRI, LRI_upper, LRI_lower };
  const out = window.LinearRegression(closes, N, K);
  const s1 = out.LRI || []; const s2 = out.LRI_upper || []; const s3 = out.LRI_lower || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; LRI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; LRI_upper[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; LRI_lower[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { LRI, LRI_upper, LRI_lower };
}

computeLinearRegTP(data, N = 10, K = 2) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length;
  const LRI = new Array(len).fill(null); const LRI_upper = new Array(len).fill(null); const LRI_lower = new Array(len).fill(null);
  if (len === 0 || typeof window.LinearRegressionTP !== 'function') return { LRI, LRI_upper, LRI_lower };
  const out = window.LinearRegressionTP(highs, lows, closes, N, K);
  const s1 = out.LRI || []; const s2 = out.LRI_upper || []; const s3 = out.LRI_lower || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; LRI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; LRI_upper[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; LRI_lower[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { LRI, LRI_upper, LRI_lower };
}

computeAdaptiveLaguerre(data, day = 10) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length; const ALF = new Array(len).fill(null);
  if (len === 0 || typeof window.AdaptiveLaguerreFilter !== 'function') return { ALF };
  const out = window.AdaptiveLaguerreFilter(highs, lows, closes, day);
  const s1 = out.AdaptiveLaguerre || [];
  for (let i = 0; i < len; i++) { const v = s1[i]; ALF[i] = (v != null && Number.isFinite(v)) ? v : null; }
  return { ALF };
}

computeHighLowBands(data, day = 10, esp = 10) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length;
  const TEMA = new Array(len).fill(null); const HighBand = new Array(len).fill(null); const LowBand = new Array(len).fill(null);
  if (len === 0 || typeof window.HighLowBands !== 'function') return { TEMA, HighBand, LowBand };
  const out = window.HighLowBands(highs, lows, closes, day, esp);
  const s1 = out.TriangularEMA || []; const s2 = out.HighBand || []; const s3 = out.LowBand || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; TEMA[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; HighBand[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; LowBand[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { TEMA, HighBand, LowBand };
}

computeStollerBands(data, day = 10, esp = 9) {
  const highs = data.map(d => d.high); const lows = data.map(d => d.low); const closes = data.map(d => d.close);
  const len = closes.length;
  const STARC_EMA = new Array(len).fill(null); const upper_STARC = new Array(len).fill(null); const lower_STARC = new Array(len).fill(null);
  if (len === 0 || typeof window.StollerAverageRangeChannels !== 'function') return { STARC_EMA, upper_STARC, lower_STARC };
  const out = window.StollerAverageRangeChannels(highs, lows, closes, day, esp);
  const s1 = out.EMA || []; const s2 = out.upper_STARC || []; const s3 = out.lower_STARC || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; STARC_EMA[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; upper_STARC[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; lower_STARC[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { STARC_EMA, upper_STARC, lower_STARC };
}

computeMA_Envelope(data, esp = 9, kk = 3) {
  const closes = data.map(d => d.close);
  const len = closes.length;
  const ENV_EMA = new Array(len).fill(null); 
  const ENV_upper = new Array(len).fill(null); 
  const ENV_lower = new Array(len).fill(null);

  if (len === 0 || typeof window.MA_Envelope !== 'function') 
    return { ENV_EMA, ENV_upper, ENV_lower };
  const out = window.MA_Envelope(closes, esp, kk);
  const s1 = out.EMA || []; const s2 = out.upper || []; const s3 = out.lower || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; ENV_EMA[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; ENV_upper[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; ENV_lower[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { ENV_EMA, ENV_upper, ENV_lower };
}

computeDeMarkerIndicator(data, day = 10) {
  const highs  = data.map(d => d.high);
  const lows   = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = highs.length;
  const DeMarker = new Array(len).fill(null);
  if (len === 0) return { DeMarker: [] };

  const fn = (typeof window !== 'undefined' && window.DeMarker) ? window.DeMarker : null;
  if (!fn) return { DeMarker };

  const out = fn(highs, lows, closes, day);
  const srcDeMarker = out && out.DeMarker ? out.DeMarker : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcDeMarker[i + 1];  // Wang uses 1-based sparse arrays; index i+1 = bar i
    DeMarker[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
  }
  return { DeMarker };
}

computeLaguerreRSI(data, gamma = 0.5, esp = 9) {
  const closes = data.map(d => d.close);
  const len = closes.length; 
  const LaguerreRSI = new Array(len).fill(null); 
  const eLaguerreRSI = new Array(len).fill(null);
  if(len === 0) return { LaguerreRSI, eLaguerreRSI };

  const fn = (typeof window !== 'undefined' && window.LaguerreRSI) ? window.LaguerreRSI : null;
  if (!fn) return { LaguerreRSI, eLaguerreRSI };

  const out = fn(closes, gamma * 10, esp);
  const srcLaguerreRSI = out && out.LaguerreRSI ? out.LaguerreRSI : [];
  const src_eLaguerreRSI = out && out.eLaguerreRSI ? out.eLaguerreRSI : [];
  for (let i = 0; i < len; i++) {
    const w1 = srcLaguerreRSI[i ];  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const w2 = src_eLaguerreRSI[i ]; 
    LaguerreRSI[i] = (w1 != null && Number.isFinite(w1)) ? w1 : null;
    eLaguerreRSI[i] = (w2 != null && Number.isFinite(w2)) ? w2 : null;
  } 
  return { LaguerreRSI, eLaguerreRSI };
}

computeInstantaneousTrendline(data, alpha = 0.07) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const IT = new Array(len).fill(null);
  const Trigger = new Array(len).fill(null);
  if (len === 0 || typeof window.InstantaneousTrendline !== 'function') return { IT, Trigger };

  const out = window.InstantaneousTrendline(highs, lows, closes, alpha * 100);
  const s1 = out.IT || [];
  const s2 = out.Trigger || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i ];  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i ]; 
    IT[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    Trigger[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { IT, Trigger };
}

computeRSI_TP(data, RSI_day = 10, esp = 9) {
  const highs = data.map(d => d.high); 
  const lows = data.map(d => d.low); 
  const closes = data.map(d => d.close);
  const len = closes.length; 
  const RSI_TP = new Array(len).fill(null);
  if (len === 0 || typeof window.RSI_TP !== 'function') return { RSI_TP };
  const out = window.RSI_TP(highs, lows, closes, RSI_day, esp);
  const s1 = out.RSI || [];
  for (let i = 0; i < len; i++) {
    const v = s1[i];  // Wang uses 1-based sparse arrays; index i+1 = bar i
    RSI_TP[i] = (v != null && Number.isFinite(v)) ? v : null;
  }
  return { RSI_TP };
}

computeAdaptiveRSI(data, esp = 9) {
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const len = closes.length;
  const AdaptiveRSI = new Array(len).fill(null);
  const eAdaptiveRSI = new Array(len).fill(null);
  if (len === 0 || typeof window.AdaptiveRSI !== 'function') return { AdaptiveRSI, eAdaptiveRSI };
  const out = window.AdaptiveRSI(highs, lows, closes, esp);
  const s1 = out.Adaptive_RSI || [];
  const s2 = out.eAdaptive_RSI || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; AdaptiveRSI[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i]; eAdaptiveRSI[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { AdaptiveRSI, eAdaptiveRSI };
}

computeNewKDW(data, KD_day = 10, esp = 9) {

  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const KD_K = new Array(len).fill(null);
  const KD_D = new Array(len).fill(null);
  const enewD = new Array(len).fill(null);
  if (len === 0 || typeof window.NewKD !== 'function') return { KD_K, KD_D, enewD };
  const out = window.NewKD(highs, lows, closes, KD_day, esp);
  const s1 = out.newK || [];
  const s2 = out.newD || [];
  const s3 = out.enewD || [];
  
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; KD_K[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i]; KD_D[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; enewD[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { KD_K, KD_D, enewD };
}


computeK2D2(data, KD_day = 10 , esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const K2 = new Array(len).fill(null);
  const D2 = new Array(len).fill(null);
  if (len === 0 || typeof window.KD_K2D2 !== 'function') return { K2, D2 };
  const out = window.KD_K2D2(highs, lows, closes, KD_day, esp);
  const s1 = out.KD_K2 || [];
  const s2 = out.KD_D2 || [];

  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; K2[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i]; D2[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null ;
  }
  return{K2, D2};

}

computeKD_D2(data, KD_day = 10 , esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const D = new Array(len).fill(null);
  const D2 = new Array(len).fill(null);
  if (len === 0 || typeof window.KD_D2 !== 'function') return { D, D2 };
  const out = window.KD_D2(highs, lows, closes, KD_day, esp);
  const s1 = out.KD_D || [];
  const s2 = out.KD_D2 || [];

  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; D[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i]; D2[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null ;
  }
  return{D, D2};
}


computeDiffKD(data, KD_day = 10 , esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const DiffKD = new Array(len).fill(null);
  const eDiffKD = new Array(len).fill(null);
  if (len === 0 || typeof window.diffKD !== 'function') return { DiffKD, eDiffKD };
  const out = window.diffKD(highs, lows, closes, KD_day, esp);
  const s1 = out.diffKD || [];
  const s2 = out.ediffKD || [];

  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; DiffKD[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i]; eDiffKD[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null ;
  }
  return{DiffKD, eDiffKD};
}

computeNVR(data, KD_day = 10, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const NVR = new Array(len).fill(null);
  const eNVR = new Array(len).fill(null);
  if (len === 0 || typeof window.NVR !== 'function') return { NVR, eNVR };
  const out = window.NVR(highs, lows, closes, KD_day, esp);
  const s1 = out.NVR || [];
  const s2 = out.eNVR || [];

  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; NVR[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;  // Wang uses 1-based sparse arrays; index i+1 = bar i
    const v2 = s2[i]; eNVR[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null ;
  }
  return { NVR, eNVR };
}

computeStochasticOSC(data, KD_day = 9, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const KStochastic = new Array(len).fill(null);
  const StochasticOSC = new Array(len).fill(null);
  const eStochasticOSC = new Array(len).fill(null);
  if (len === 0 || typeof window.StochasticOSC !== 'function') return {KStochastic, StochasticOSC, eStochasticOSC };
  const out = window.StochasticOSC(highs, lows, closes, KD_day, esp);
  const s1 = out.Stoch_K || [];
  const s2 = out.Stoch_D || [];
  const s3 = out.eStoch_D || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; KStochastic[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; StochasticOSC[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
    const v3 = s3[i]; eStochasticOSC[i] = (v3 != null && Number.isFinite(v3)) ? v3 : null;
  }
  return { KStochastic, StochasticOSC, eStochasticOSC };
}

computeWilliamR(data, day = 10) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const WilliamR = new Array(len).fill(null);
  if (len === 0 || typeof window.WilliamR !== 'function') return { WilliamR };
  const out = window.WilliamR(highs, lows, closes, day);
  const s1 = out.WilliamR || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; WilliamR[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
  }
  return { WilliamR };
}


computeVolAccuDistOsc(data, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const vol = data.map(d =>d.volume);
  const len = closes.length;
  const  VolAccuDistOsc = new Array(len).fill(null);
  const  eVolAccuDistOsc = new Array(len).fill(null);

  if(len === 0 || typeof window.VolAccuDistOsc !== 'function') return {VolAccuDistOsc, eVolAccuDistOsc};
  const out = window.VolAccuDistOsc(highs, lows, closes, vol, esp );
  const s1 = out.VolAccuDistOsc || [];
  const s2 = out.eVolAccuDistOsc || [];
  for(let i = 0; i < len; i++){
    const v1 = s1[i]; VolAccuDistOsc[i] = (v1 !== null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eVolAccuDistOsc[i] = (v2 !== null && Number.isFinite(v2)) ? v2 : null;

  }
  return{VolAccuDistOsc, eVolAccuDistOsc};
}

computeHighLowOsc(data, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const HLO_data = new Array(len).fill(null);
  const eHLO_data = new Array(len).fill(null);

  if(len === 0 || typeof window.HighLowOsc !== 'function' ) return {HLO: HLO_data, eHLO: eHLO_data};
  const out = window.HighLowOsc(highs, lows, closes, esp);
  const s1 = out.HLO || [];
  const s2 = out.eHLO || [];
  for(let i = 0; i < len; i++){
    const v1 = s1[i]; HLO_data[i] = (v1 !== null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eHLO_data[i] = (v2 !== null && Number.isFinite(v2)) ? v2 : null;
  }
  return{HLO: HLO_data, eHLO: eHLO_data};
}

computeStochasticEMA(data, KD_day = 10, esp = 9) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const K_EMA = new Array(len).fill(null);
  const D_EMA = new Array(len).fill(null);
  if (len === 0 || typeof window.StochasticEMA !== 'function') return { K_EMA, D_EMA };
  const out = window.StochasticEMA(highs, lows, closes, KD_day, esp);
  const s1 = out.K_EMA || [];
  const s2 = out.D_EMA || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; K_EMA[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; D_EMA[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { K_EMA, D_EMA };
}


computeJurikMovingAverage(data, length = 10) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;  
  const JurikMA = new Array(len).fill(null);
  if (len === 0 || typeof window.JurikMovingAverage !== 'function') return { JurikMA };
  const out = window.JurikMovingAverage(highs, lows, closes, length);
  const s1 = out.JurikMA || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; JurikMA[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
  }
  return { JurikMA };
}

computeAdaptiveMACD(data, esp = 5){
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const Adaptive_MACD = new Array(len).fill(null);
  const Signal = new Array(len).fill(null);
  if(len === 0 || typeof window.AdaptiveMACD !== 'function') return {Adaptive_MACD, Signal};
  const out = window.AdaptiveMACD(highs, lows, closes, esp);
  const s1 = out.Adaptive_MACD || [];
  const s2 = out.Signal || [];
  for(let i = 0; i < len; i++){
    const v1 = s1[i]; Adaptive_MACD[i] = (v1 !== null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; Signal[i] = (v2 !== null && Number.isFinite(v2)) ? v2 : null;
  }
  return {Adaptive_MACD, Signal};

}

computeStochasticEMA_esp(data, esp = 9 , KD_num = 10) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const eK_EMA = new Array(len).fill(null);
  const eD_EMA = new Array(len).fill(null);
  if (len === 0 || typeof window.StochasticEMA_esp !== 'function') return { eK_EMA, eD_EMA };
  const out = window.StochasticEMA_esp(highs, lows, closes, esp, KD_num);
  const s1 = out.eK_EMA || [];
  const s2 = out.eD_EMA || [];
  for (let i = 0; i < len; i++) {
    const v1 = s1[i]; eK_EMA[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    const v2 = s2[i]; eD_EMA[i] = (v2 != null && Number.isFinite(v2)) ? v2 : null;
  }
  return { eK_EMA, eD_EMA };  
}

computeATRPercentage(data, ATR_num = 14) {
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const ATR_percent = new Array(len).fill(null);
  if (len === 0 || typeof window.ATRPercentage !== 'function') return { ATR_percent };
  const out = window.ATRPercentage(highs, lows, closes, ATR_num);
  const s1 = out.ATR_percent || [];
  for (let i = 0; i <len; i++) {
    const v1 = s1[i]; ATR_percent[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
  }
  return { ATR_percent };
}

  computeHistoricalVolatility_Close(data, HV_num = 10) { 
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    const len = closes.length;
    const HV = new Array(len).fill(null);
    if (len === 0 || typeof window.HistoricalVolatility_Close !== 'function') return { HV };
    const out = window.HistoricalVolatility_Close(highs, lows, closes, HV_num);
    const s1 = out.HV || [];
    for (let i = 0; i <len; i++) {
      const v1 = s1[i]; HV[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
    }
    return { HV };
  }

computeHistoricalVolatility_TP(data, HV_num = 10) { 
   const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const closes = data.map(d => d.close);
  const len = closes.length;
  const HV = new Array(len).fill(null);
  if (len === 0 || typeof window.HistoricalVolatility_TP !== 'function') return { HV };
  const out = window.HistoricalVolatility_TP(highs, lows, closes, HV_num);
  const s1 = out.HV || [];
  for (let i = 0; i <len; i++) {
    const v1 = s1[i]; HV[i] = (v1 != null && Number.isFinite(v1)) ? v1 : null;
  }
  return { HV };
}

// ===================================LAST COMPUTED INDICATORS:===============================

renderHistoricalVolatility_TP(chart, data, colors, seriesMap){
  if(!data || !data.HV) return;
  if(!seriesMap.has('HV')) {
    seriesMap.set('HV', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'HV',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }

  const HV_data = this.seriesWithLeadInPadding(data.HV, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('HV').setData(HV_data);
}

renderHistoricalVolatility_Close(chart, data, colors, seriesMap){
  if(!data || !data.HV) return;
  if(!seriesMap.has('HV')) {
    seriesMap.set('HV', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'HV',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }

  const HV_data = this.seriesWithLeadInPadding(data.HV, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('HV').setData(HV_data);
}

renderATRPercentage(chart, data, colors, seriesMap){
  if(!data || !data.ATR_percent) return;
  if(!seriesMap.has('ATR_percent')) {
    seriesMap.set('ATR_percent', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'ATR_percent',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }

  const ATR_percent_data = this.seriesWithLeadInPadding(data.ATR_percent, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('ATR_percent').setData(ATR_percent_data);
}

renderStochasticEMA_esp(chart, data, colors, seriesMap){
  if(!data || !data.eK_EMA) return;
  if(!seriesMap.has('eK_EMA')) {
    seriesMap.set('eK_EMA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'eK_EMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('eD_EMA')) {
    seriesMap.set('eD_EMA', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eD_EMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,  
  }));
  }
  const eK_EMA_data = this.seriesWithLeadInPadding(data.eK_EMA, (v) => (v == null || isNaN(v)) ? null : v);
  const eD_EMA_data = this.seriesWithLeadInPadding(data.eD_EMA, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('eK_EMA').setData(eK_EMA_data);
  seriesMap.get('eD_EMA').setData(eD_EMA_data);
}

renderAdaptiveMACD(chart, data, colors, seriesMap){
  if(!data || !data.Adaptive_MACD) return;
  if(!seriesMap.has('Adaptive_MACD')) {
    seriesMap.set('Adaptive_MACD', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Adaptive_MACD',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('Signal')) {  
    seriesMap.set('Signal', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Signal',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }

  const Adaptive_MACD_data = this.seriesWithLeadInPadding(data.Adaptive_MACD, (v) => (v == null || isNaN(v)) ? null : v);
  const Signal_data = this.seriesWithLeadInPadding(data.Signal, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('Adaptive_MACD').setData(Adaptive_MACD_data);
  seriesMap.get('Signal').setData(Signal_data);
}

renderJurikMovingAverage(chart, data, colors, seriesMap){
  if(!data || !data.JurikMA) return;
  if(!seriesMap.has('JurikMA')) {
    seriesMap.set('JurikMA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'JurikMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }

  const JurikMA_data = this.seriesWithLeadInPadding(data.JurikMA, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('JurikMA').setData(JurikMA_data);
}

renderStochasticEMA(chart, data, colors, seriesMap){
  if(!data || !data.K_EMA) return;
  if(!seriesMap.has('K_EMA')) {
    seriesMap.set('K_EMA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'K_EMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('D_EMA')) {
    seriesMap.set('D_EMA', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'D_EMA',
      crosshairMarkerVisible: false,  
    priceLineVisible: false,
    }));
  }
  const KEMA_data = this.seriesWithLeadInPadding(data.K_EMA, (v) => (v == null || isNaN(v)) ? null : v);
  const DEMA_data = this.seriesWithLeadInPadding(data.D_EMA, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('K_EMA').setData(KEMA_data);
  seriesMap.get('D_EMA').setData(DEMA_data);
}

renderHighLowOsc(chart, data, colors, seriesMap){
  if(!data || !data.HLO) return;
  if(!seriesMap.has('HLO')) {
    seriesMap.set('HLO', chart.addLineSeries({
      color:colors.LINE1,
      lineWidth: 2,
      title: 'HLO',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('eHLO')) {
    seriesMap.set('eHLO', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      title: 'eHLO',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  
  const HLO_data = this.seriesWithLeadInPadding(data.HLO, (v) => (v == null || isNaN(v)) ? null : v);
  const eHLO_data = this.seriesWithLeadInPadding(data.eHLO, (v) => (v == null ||isNaN(v)) ? null : v);
  seriesMap.get('HLO').setData(HLO_data);
  seriesMap.get('eHLO').setData(eHLO_data);
}

renderVolAccuDistOsc(chart, data, colors, seriesMap){
  if(!data || !data.VolAccuDistOsc) return;
  if(!seriesMap.has('VolAccuDistOsc')) {
    seriesMap.set('VolAccuDistOsc', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'VolAccuDistOsc',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('eVolAccuDistOsc')) {
    seriesMap.set('eVolAccuDistOsc', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      title: 'eVolAccuDistOsc',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const VolAccuDistOsc_data = this.seriesWithLeadInPadding(data.VolAccuDistOsc, (v) => (v == null || isNaN(v))? null : v);
  const eVolAccuDistOsc_data = this.seriesWithLeadInPadding(data.eVolAccuDistOsc, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('VolAccuDistOsc').setData(VolAccuDistOsc_data);
  seriesMap.get('eVolAccuDistOsc').setData(eVolAccuDistOsc_data);
}

renderWilliamR(chart, data, colors, seriesMap){
  if(!data || !data.WilliamR) return;
  if(!seriesMap.has('WilliamR')) {
    seriesMap.set('WilliamR', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'WilliamR',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const WilliamR_Data = this.seriesWithLeadInPadding(data.WilliamR, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('WilliamR').setData(WilliamR_Data);

}

renderStochasticOSC(chart, data, colors, seriesMap){
  if(!data || !data.KStochastic) return;
  if(!seriesMap.has('KStochastic')) {
    seriesMap.set('KStochastic', chart.addLineSeries({
      color: colors.LINE1,  
    lineWidth: 2,
    title: 'STOCH K',
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('StochasticOSC')) {
    seriesMap.set('StochasticOSC', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Stoch D',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('eStochasticOSC')) {
    seriesMap.set('eStochasticOSC', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      title: 'eStoch D',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));

  }
  const KStochastic_Data = this.seriesWithLeadInPadding(data.KStochastic, (v) => (v == null || isNaN(v)) ? null : v);
  const StochasticOSC_Data = this.seriesWithLeadInPadding(data.StochasticOSC, (v) => (v == null || isNaN(v)) ? null : v);
  const eStochasticOSC_Data = this.seriesWithLeadInPadding(data.eStochasticOSC, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('KStochastic').setData(KStochastic_Data);
  seriesMap.get('StochasticOSC').setData(StochasticOSC_Data);
  seriesMap.get('eStochasticOSC').setData(eStochasticOSC_Data);
}

renderNVR(chart, data, colors, seriesMap){
  if(!data || !data.NVR) return;
  if(!seriesMap.has('NVR')) {
    seriesMap.set('NVR', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'NVR',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('eNVR')) {
    seriesMap.set('eNVR', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      title: 'eNVR',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const NVR_Data = this.seriesWithLeadInPadding(data.NVR, (v) => (v == null || isNaN(v)) ? null : v);
  const eNVR_Data = this.seriesWithLeadInPadding(data.eNVR, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('NVR').setData(NVR_Data);
  seriesMap.get('eNVR').setData(eNVR_Data);
}

renderDiffKD(chart, data, colors, seriesMap){
  if(!data || !data.DiffKD) return;
  if(!seriesMap.has('DiffKD')) {
    seriesMap.set('DiffKD', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'DiffKD',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('eDiffKD')) {
    seriesMap.set('eDiffKD', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      title: 'eDiffKD',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const DiffKD_Data = this.seriesWithLeadInPadding(data.DiffKD, (v) => (v == null || isNaN(v)) ? null : v);
  const eDiffKD_Data = this.seriesWithLeadInPadding(data.eDiffKD, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('DiffKD').setData(DiffKD_Data);
  seriesMap.get('eDiffKD').setData(eDiffKD_Data);

}

renderKD_D2(chart, data, colors, seriesMap){
  if(!data || !data.D) return;
  if(!seriesMap.has('D')) {
    seriesMap.set('D', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'KD_D',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('D2')) {
    seriesMap.set('D2', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      title: 'KD_D2',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const KD_DData = this.seriesWithLeadInPadding(data.D, (v) => (v == null || isNaN(v)) ? null : v);
  const D2_Data = this.seriesWithLeadInPadding(data.D2, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('D').setData(KD_DData);
  seriesMap.get('D2').setData(D2_Data);
}

renderK2D2(chart, data, colors, seriesMap){
  if(!data || !data.K2) return;
  if(!seriesMap.has('K2')) {
    seriesMap.set('K2', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      itle: 'K2',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('D2')) {
    seriesMap.set('D2', chart.addLineSeries({
      color: colors.LINE6,
      lineWidth: 2,
      itle: 'D2',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  } 
  const K2_Data = this.seriesWithLeadInPadding(data.K2, (v) => (v == null || isNaN(v)) ? null : v);
  const D2_Data = this.seriesWithLeadInPadding(data.D2, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('K2').setData(K2_Data);
  seriesMap.get('D2').setData(D2_Data);

}

renderNewKDW(chart, data, colors, seriesMap) {
  if (!data || !data.KD_K) return;
  if (!seriesMap.has('KD_K')) {
    seriesMap.set('KD_K', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'KD_K',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('KD_D')) {
    seriesMap.set('KD_D', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'KD_D',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('enewD')) {
    seriesMap.set('enewD', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      title: 'enewD',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const KD_KData = this.seriesWithLeadInPadding(data.KD_K, (v) => (v == null || isNaN(v)) ? null : v);
  const KD_DData = this.seriesWithLeadInPadding(data.KD_D, (v) => (v == null || isNaN(v)) ? null : v);
  const enewDData = this.seriesWithLeadInPadding(data.enewD, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('KD_K').setData(KD_KData);
  seriesMap.get('KD_D').setData(KD_DData);
  seriesMap.get('enewD').setData(enewDData);
}

renderAdaptiveRSI(chart, data, colors, seriesMap) {
  if (!data || !data.AdaptiveRSI) return;
  if (!seriesMap.has('AdaptiveRSI')) {
    seriesMap.set('AdaptiveRSI', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Adaptive RSI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eAdaptiveRSI')) {
    seriesMap.set('eAdaptiveRSI', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eAdaptive RSI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const AdaptiveRSIData = this.seriesWithLeadInPadding(data.AdaptiveRSI, (v) => (v == null || isNaN(v)) ? null : v);
  const eAdaptiveRSIData = this.seriesWithLeadInPadding(data.eAdaptiveRSI, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('AdaptiveRSI').setData(AdaptiveRSIData);
  seriesMap.get('eAdaptiveRSI').setData(eAdaptiveRSIData);
}

renderRSI_TP(chart, data, colors, seriesMap) {
  if (!data || !data.RSI_TP) return;
  if (!seriesMap.has('RSI_TP')) {
    seriesMap.set('RSI_TP', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'RSI_TP',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const RSI_TPData = this.seriesWithLeadInPadding(data.RSI_TP, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('RSI_TP').setData(RSI_TPData);
}


renderInstantaneousTrendline(chart, data, colors, seriesMap) {
  if(!data || !data.IT) return;
  if(!seriesMap.has('IT')) {
    seriesMap.set('IT', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'IT',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if(!seriesMap.has('Trigger')) {
    seriesMap.set('Trigger', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Trigger',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const ITData = this.seriesWithLeadInPadding(data.IT, (v) => (v == null || isNaN(v)) ? null : v);
  const TriggerData = this.seriesWithLeadInPadding(data.Trigger, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('IT').setData(ITData);
  seriesMap.get('Trigger').setData(TriggerData);
}



renderLaguerreRSI(chart, data, colors, seriesMap) {
  if (!data || !data.LaguerreRSI) return;
  if (!seriesMap.has('LaguerreRSI')) {
    seriesMap.set('LaguerreRSI', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Laguerre RSI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eLaguerreRSI')) {
    seriesMap.set('eLaguerreRSI', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eLaguerre RSI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const LaguerreRSIData = this.seriesWithLeadInPadding(data.LaguerreRSI, (v) => (v == null || isNaN(v)) ? null : v);
  const eLaguerreRSIData = this.seriesWithLeadInPadding(data.eLaguerreRSI, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('LaguerreRSI').setData(LaguerreRSIData);
  seriesMap.get('eLaguerreRSI').setData(eLaguerreRSIData);
}



renderWilliamsPercentRange(chart, data, colors, seriesMap) {
  if (!data || !data.WilliamsPctRange) return;
  if (!seriesMap.has('WilliamsPctRange')) {
    seriesMap.set('WilliamsPctRange', chart.addLineSeries({ 
    color: colors.LINE1, 
    lineWidth: 2, 
    title: 'Williams %R', 
    crosshairMarkerVisible: false, 
    priceLineVisible: false }));
  }
  const WilliamsPctRangeData = this.seriesWithLeadInPadding(data.WilliamsPctRange, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('WilliamsPctRange').setData(WilliamsPctRangeData);
}

renderAlphaBetaMA(chart, data, colors, seriesMap) {
  if (!data || !data.MA || !data.STK_close) return; 
  if (!seriesMap.has('MA')) {
    seriesMap.set('MA', chart.addLineSeries({ color: colors.LINE1,
      lineWidth: 2,
      title: 'MA',
      crosshairMarkerVisible: false,
      priceLineVisible: false }));
  }
  if (!seriesMap.has('STK_close')) {
    seriesMap.set('STK_close', chart.addLineSeries({ color: colors.LINE2,
      lineWidth: 2,
      title: 'Close Price',
      crosshairMarkerVisible: false,
      priceLineVisible: false }));
  }
  const MAData = this.seriesWithLeadInPadding(data.MA, (v) => (v == null || isNaN(v)) ? null : v);
  const STK_closeData = this.seriesWithLeadInPadding(data.STK_close, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('MA').setData(MAData);
  seriesMap.get('STK_close').setData(STK_closeData);
}



renderFractalDimensionIndex(chart, data, colors, seriesMap) {
  if (!data || !data.FDI) return;
  if (!seriesMap.has('FDI')) {
    seriesMap.set('FDI', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'FDI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const FDIData = this.seriesWithLeadInPadding(data.FDI, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('FDI').setData(FDIData);
}

renderEfficiencyRatio(chart, data, colors, seriesMap) {
  if (!data || !data.ER) return;
  if (!seriesMap.has('ER')) {
    seriesMap.set('ER', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'ER', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('eER')) {
    seriesMap.set('eER', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'eER Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('ER').setData(this.seriesWithLeadInPadding(data.ER, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('eER').setData(this.seriesWithLeadInPadding(data.eER, (v) => (v == null || isNaN(v)) ? null : v));
}

renderAccuDistLine(chart, data, colors, seriesMap) {
  if (!data || !data.ADL) return;
  if (!seriesMap.has('ADL')) {
    seriesMap.set('ADL', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Accum Dist', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('eADL')) {
    seriesMap.set('eADL', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('ADL').setData(this.seriesWithLeadInPadding(data.ADL, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('eADL').setData(this.seriesWithLeadInPadding(data.eADL, (v) => (v == null || isNaN(v)) ? null : v));
}

renderZeroLagKD(chart, data, colors, seriesMap) {
  // Prevent accidental collapse to 0-line when underlying indicator returns sparse/1-based arrays.
  if (!data || !Array.isArray(data.ZeroLag_K) || !Array.isArray(data.ZeroLag_D)) return;

  const normalize = (arr) => {
    // Detect 1-based arrays (common in your Wang indicator code): first defined value at index 1.
    // If arr[0] is null/undefined and arr[1] is finite, shift left.
    if ((arr[0] == null || !Number.isFinite(arr[0])) && arr.length > 1 && Number.isFinite(arr[1])) {
      const out = new Array(arr.length - 1).fill(null);
      for (let i = 1; i < arr.length; i++) out[i - 1] = arr[i];
      return out;
    }
    return arr;
  };

  const kArr = normalize(data.ZeroLag_K);
  const dArr = normalize(data.ZeroLag_D);

  if (!seriesMap.has('ZeroLag_K')) {
    seriesMap.set('ZeroLag_K', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: '%K', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('ZeroLag_D')) {
    seriesMap.set('ZeroLag_D', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: '%D', crosshairMarkerVisible: false, priceLineVisible: false }));
  }

  seriesMap.get('ZeroLag_K').setData(this.seriesWithLeadInPadding(kArr, (v) => (v == null || !Number.isFinite(v)) ? null : v));
  seriesMap.get('ZeroLag_D').setData(this.seriesWithLeadInPadding(dArr, (v) => (v == null || !Number.isFinite(v)) ? null : v));
}

renderWaveVolume(chart, data, colors, seriesMap) {
  if (!data || !data.WaveVol) return;
  if (!seriesMap.has('WaveVol')) {
    seriesMap.set('WaveVol', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Wave Volume', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('WaveVol').setData(this.seriesWithLeadInPadding(data.WaveVol, (v) => (v == null || isNaN(v)) ? null : v));
}

renderElderForceIndex(chart, data, colors, seriesMap) {
  if (!data || !data.EFI) return;
  if (!seriesMap.has('EFI')) {
    seriesMap.set('EFI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Elder Force', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('eEFI')) {
    seriesMap.set('eEFI', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('EFI').setData(this.seriesWithLeadInPadding(data.EFI, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('eEFI').setData(this.seriesWithLeadInPadding(data.eEFI, (v) => (v == null || isNaN(v)) ? null : v));
}

renderTimeSegVol(chart, data, colors, seriesMap) {
  if (!data || !data.TimeSegVol) return;
  if (!seriesMap.has('TimeSegVol')) {
    seriesMap.set('TimeSegVol', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Time Seg Vol', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('TimeSegVol').setData(this.seriesWithLeadInPadding(data.TimeSegVol, (v) => (v == null || isNaN(v)) ? null : v));
}

renderTimeSegVolTP(chart, data, colors, seriesMap) {
  if (!data || !data.TimeSegVol_TP) return;
  if (!seriesMap.has('TimeSegVol_TP')) {
    seriesMap.set('TimeSegVol_TP', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Time Seg Vol (TP)', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('TimeSegVol_TP').setData(this.seriesWithLeadInPadding(data.TimeSegVol_TP, (v) => (v == null || isNaN(v)) ? null : v));
}

renderRSI_Mom(chart, data, colors, seriesMap) {
  if (!data || !data.RSI_Mom) return;
  if (!seriesMap.has('RSI_Mom')) {
    seriesMap.set('RSI_Mom', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'RSI Momentum', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('RSI_Mom').setData(this.seriesWithLeadInPadding(data.RSI_Mom, (v) => (v == null || isNaN(v)) ? null : v));
}

renderRSI_CenteredCumul(chart, data, colors, seriesMap) {
  if (!data || !data.CenteredCumulRSI) return;
  if (!seriesMap.has('CenteredCumulRSI')) {
    seriesMap.set('CenteredCumulRSI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'RSI Centered Cumul', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('CenteredCumulRSI').setData(this.seriesWithLeadInPadding(data.CenteredCumulRSI, (v) => (v == null || isNaN(v)) ? null : v));
}

renderSchaffTrend(chart, data, colors, seriesMap) {
  if (!data || !data.STC) return;
  if (!seriesMap.has('STC')) {
    seriesMap.set('STC', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Schaff Trend', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('STC').setData(this.seriesWithLeadInPadding(data.STC, (v) => (v == null || isNaN(v)) ? null : v));
}

renderFisherTransform(chart, data, colors, seriesMap) {
  if (!data || !data.Fisher) return;
  if (!seriesMap.has('Fisher')) {
    seriesMap.set('Fisher', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Fisher', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('FisherSignal')) {
    seriesMap.set('FisherSignal', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('Fisher').setData(this.seriesWithLeadInPadding(data.Fisher, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('FisherSignal').setData(this.seriesWithLeadInPadding(data.FisherSignal, (v) => (v == null || isNaN(v)) ? null : v));
}

renderAwesomeOsc(chart, data, colors, seriesMap) {
  if (!data || !data.AwesomeOsc) return;
  if (!seriesMap.has('AwesomeOsc')) {
    seriesMap.set('AwesomeOsc', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Awesome Osc', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('AwesomeOsc').setData(this.seriesWithLeadInPadding(data.AwesomeOsc, (v) => (v == null || isNaN(v)) ? null : v));
}

renderChoppinessIdx(chart, data, colors, seriesMap) {
  if (!data || !data.Choppiness) return;
  if (!seriesMap.has('Choppiness')) {
    seriesMap.set('Choppiness', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Choppiness', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('Choppiness').setData(this.seriesWithLeadInPadding(data.Choppiness, (v) => (v == null || isNaN(v)) ? null : v));
}

renderTSI(chart, data, colors, seriesMap) {
  if (!data || !data.TSI) return;
  if (!seriesMap.has('TSI')) {
    seriesMap.set('TSI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'TSI', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('TSI_Signal')) {
    seriesMap.set('TSI_Signal', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('TSI').setData(this.seriesWithLeadInPadding(data.TSI, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('TSI_Signal').setData(this.seriesWithLeadInPadding(data.TSI_Signal, (v) => (v == null || isNaN(v)) ? null : v));
}

renderRVI_Vol(chart, data, colors, seriesMap) {
  if (!data || !data.RVI_Vol) return;
  if (!seriesMap.has('RVI_Vol')) {
    seriesMap.set('RVI_Vol', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'RVI', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('eRVI_Vol')) {
    seriesMap.set('eRVI_Vol', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('RVI_Vol').setData(this.seriesWithLeadInPadding(data.RVI_Vol, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('eRVI_Vol').setData(this.seriesWithLeadInPadding(data.eRVI_Vol, (v) => (v == null || isNaN(v)) ? null : v));
}

renderREI(chart, data, colors, seriesMap) {
  if (!data || !data.REI) return;
  if (!seriesMap.has('REI')) {
    seriesMap.set('REI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'REI', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('eREI')) {
    seriesMap.set('eREI', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('REI').setData(this.seriesWithLeadInPadding(data.REI, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('eREI').setData(this.seriesWithLeadInPadding(data.eREI, (v) => (v == null || isNaN(v)) ? null : v));
}

renderRelVigorIndex(chart, data, colors, seriesMap) {
  if (!data || !data.VigorRVI) return;
  if (!seriesMap.has('VigorRVI')) {
    seriesMap.set('VigorRVI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Vigor RVI', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('VigorSignal')) {
    seriesMap.set('VigorSignal', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('VigorRVI').setData(this.seriesWithLeadInPadding(data.VigorRVI, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('VigorSignal').setData(this.seriesWithLeadInPadding(data.VigorSignal, (v) => (v == null || isNaN(v)) ? null : v));
}

renderAroonOsc(chart, data, colors, seriesMap) {
  if (!data || !data.AroonOsc) return;
  if (!seriesMap.has('AroonOsc')) {
    seriesMap.set('AroonOsc', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Aroon Osc', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('AroonOsc').setData(this.seriesWithLeadInPadding(data.AroonOsc, (v) => (v == null || isNaN(v)) ? null : v));
}

renderStdDevIndicator(chart, data, colors, seriesMap) {
  if (!data || !data.SD) return;
  if (!seriesMap.has('SD')) {
    seriesMap.set('SD', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Std Dev', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('eSD')) {
    seriesMap.set('eSD', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Signal', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('SD').setData(this.seriesWithLeadInPadding(data.SD, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('eSD').setData(this.seriesWithLeadInPadding(data.eSD, (v) => (v == null || isNaN(v)) ? null : v));
}

renderRainbowOscillator(chart, data, colors, seriesMap) {
  if (!data || !data.Rainbow) return;
  if (!seriesMap.has('Rainbow')) {
    seriesMap.set('Rainbow', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Rainbow Osc', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('Rainbow').setData(this.seriesWithLeadInPadding(data.Rainbow, (v) => (v == null || isNaN(v)) ? null : v));
}

renderRainbowMA(chart, data, colors, seriesMap) {
  if (!data || !data.rma1) return;
  if (!seriesMap.has('rma1')) {
    seriesMap.set('rma1', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'MA1', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('rma2')) {
    seriesMap.set('rma2', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'MA2', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('rma3')) {
    seriesMap.set('rma3', chart.addLineSeries({ color: colors.LINE3, lineWidth: 2, title: 'MA3', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('rma4')) {
    seriesMap.set('rma4', chart.addLineSeries({ color: colors.LINE4, lineWidth: 2, title: 'MA4', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('rma5')) {
    seriesMap.set('rma5', chart.addLineSeries({ color: colors.LINE5, lineWidth: 2, title: 'MA5', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('rma')) {
    seriesMap.set('rma', chart.addLineSeries({ color: colors.LINE6, lineWidth: 2, title: 'RMA', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('rma1').setData(this.seriesWithLeadInPadding(data.rma1, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('rma2').setData(this.seriesWithLeadInPadding(data.rma2, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('rma3').setData(this.seriesWithLeadInPadding(data.rma3, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('rma4').setData(this.seriesWithLeadInPadding(data.rma4, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('rma5').setData(this.seriesWithLeadInPadding(data.rma5, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('rma').setData(this.seriesWithLeadInPadding(data.rma, (v) => (v == null || isNaN(v)) ? null : v));
}

renderLinearReg(chart, data, colors, seriesMap) {
  if (!data || !data.LRI) return;
  if (!seriesMap.has('LRI')) {
    seriesMap.set('LRI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'LR', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('LRI_upper')) {
    seriesMap.set('LRI_upper', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Upper', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('LRI_lower')) {
    seriesMap.set('LRI_lower', chart.addLineSeries({ color: colors.LINE3, lineWidth: 2, title: 'Lower', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('LRI').setData(this.seriesWithLeadInPadding(data.LRI, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('LRI_upper').setData(this.seriesWithLeadInPadding(data.LRI_upper, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('LRI_lower').setData(this.seriesWithLeadInPadding(data.LRI_lower, (v) => (v == null || isNaN(v)) ? null : v));
}

renderLinearRegTP(chart, data, colors, seriesMap) {
  if (!data || !data.LRI) return;
  if (!seriesMap.has('LRI')) {
    seriesMap.set('LRI', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'LR(TP)', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('LRI_upper')) {
    seriesMap.set('LRI_upper', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Upper', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('LRI_lower')) {
    seriesMap.set('LRI_lower', chart.addLineSeries({ color: colors.LINE3, lineWidth: 2, title: 'Lower', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('LRI').setData(this.seriesWithLeadInPadding(data.LRI, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('LRI_upper').setData(this.seriesWithLeadInPadding(data.LRI_upper, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('LRI_lower').setData(this.seriesWithLeadInPadding(data.LRI_lower, (v) => (v == null || isNaN(v)) ? null : v));
}

renderAdaptiveLaguerre(chart, data, colors, seriesMap) {
  if (!data || !data.ALF) return;
  if (!seriesMap.has('ALF')) {
    seriesMap.set('ALF', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Adaptive Laguerre', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('ALF').setData(this.seriesWithLeadInPadding(data.ALF, (v) => (v == null || isNaN(v)) ? null : v));
}

renderHighLowBands(chart, data, colors, seriesMap) {
  if (!data || !data.TEMA) return;
  if (!seriesMap.has('TEMA')) {
    seriesMap.set('TEMA', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'TEMA', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('HighBand')) {
    seriesMap.set('HighBand', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'High Band', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('LowBand')) {
    seriesMap.set('LowBand', chart.addLineSeries({ color: colors.LINE3, lineWidth: 2, title: 'Low Band', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('TEMA').setData(this.seriesWithLeadInPadding(data.TEMA, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('HighBand').setData(this.seriesWithLeadInPadding(data.HighBand, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('LowBand').setData(this.seriesWithLeadInPadding(data.LowBand, (v) => (v == null || isNaN(v)) ? null : v));
}

renderStollerBands(chart, data, colors, seriesMap) {
  if (!data || !data.STARC_EMA) return;
  if (!seriesMap.has('STARC_EMA')) {
    seriesMap.set('STARC_EMA', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'EMA', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('upper_STARC')) {
    seriesMap.set('upper_STARC', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Upper STARC', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('lower_STARC')) {
    seriesMap.set('lower_STARC', chart.addLineSeries({ color: colors.LINE3, lineWidth: 2, title: 'Lower STARC', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('STARC_EMA').setData(this.seriesWithLeadInPadding(data.STARC_EMA, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('upper_STARC').setData(this.seriesWithLeadInPadding(data.upper_STARC, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('lower_STARC').setData(this.seriesWithLeadInPadding(data.lower_STARC, (v) => (v == null || isNaN(v)) ? null : v));
}

renderMA_Envelope(chart, data, colors, seriesMap) {
  if (!data || !data.ENV_EMA) return;
  if (!seriesMap.has('ENV_EMA')) {
    seriesMap.set('ENV_EMA', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'EMA', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('ENV_upper')) {
    seriesMap.set('ENV_upper', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'Upper', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  if (!seriesMap.has('ENV_lower')) {
    seriesMap.set('ENV_lower', chart.addLineSeries({ color: colors.LINE3, lineWidth: 2, title: 'Lower', crosshairMarkerVisible: false, priceLineVisible: false }));
  }
  seriesMap.get('ENV_EMA').setData(this.seriesWithLeadInPadding(data.ENV_EMA, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('ENV_upper').setData(this.seriesWithLeadInPadding(data.ENV_upper, (v) => (v == null || isNaN(v)) ? null : v));
  seriesMap.get('ENV_lower').setData(this.seriesWithLeadInPadding(data.ENV_lower, (v) => (v == null || isNaN(v)) ? null : v));
}


renderVolumeFlowIndicator(chart, data, colors, seriesMap) {
  if (!data || !data.VolFlowIndicator || !data.eVolFlowIndicator) return;
  if (!seriesMap.has('VolFlowIndicator')) {
    seriesMap.set('VolFlowIndicator', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Volume Flow Indicator',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eVolFlowIndicator')) {
    seriesMap.set('eVolFlowIndicator', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eVolume Flow Indicator',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const VolFlowIndicatorData = this.seriesWithLeadInPadding(data.VolFlowIndicator, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('VolFlowIndicator').setData(VolFlowIndicatorData);
  const eVolFlowIndicatorData = this.seriesWithLeadInPadding(data.eVolFlowIndicator, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('eVolFlowIndicator').setData(eVolFlowIndicatorData);
}

renderDynamicZoneRSI(chart, data, colors, seriesMap) {
  if (!data || !data.DZ_upper || !data.DZ_mid || !data.DZ_lower) return;
  if (!seriesMap.has('DZ_upper')) {
    seriesMap.set('DZ_upper', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'DZ RSI Upper',
      crosshairMarkerVisible: false,
      priceLineVisible: false,

    }));
  }
  if (!seriesMap.has('DZ_mid')) {
    seriesMap.set('DZ_mid', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'DZ RSI Mid',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('DZ_lower')) {
    seriesMap.set('DZ_lower', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      title: 'DZ RSI Lower',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const DZUpperData = this.seriesWithLeadInPadding(data.DZ_upper, (v) => (v == null || isNaN(v)) ? null : v);
  const DZMidData = this.seriesWithLeadInPadding(data.DZ_mid, (v) => (v == null || isNaN(v)) ? null : v);
  const DZLowerData = this.seriesWithLeadInPadding(data.DZ_lower, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('DZ_upper').setData(DZUpperData);
  seriesMap.get('DZ_mid').setData(DZMidData);
  seriesMap.get('DZ_lower').setData(DZLowerData);
}

renderVolumeZoneOscillator(chart, data, colors, seriesMap) {
  if (!data || !data.VolZoneOsc) return;
  if (!seriesMap.has('VolZoneOsc')) {
    seriesMap.set('VolZoneOsc', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Volume Zone Oscillator',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const VolZoneOscData = this.seriesWithLeadInPadding(data.VolZoneOsc, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('VolZoneOsc').setData(VolZoneOscData);
}

renderWilliamsVolatilityChannel(chart, data, colors, seriesMap) {
  if (!data || !data.Upperline || !data.MiddleLine || !data.Lowerline) return;
  if (!seriesMap.has('Upperline')) {
    seriesMap.set('Upperline', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Upper Line',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('MiddleLine')) {
    seriesMap.set('MiddleLine', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Middle Line',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  } 
  if (!seriesMap.has('Lowerline')) {
    seriesMap.set('Lowerline', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      title: 'Lower Line',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const UpperlineData = this.seriesWithLeadInPadding(data.Upperline, (v) => (v == null || isNaN(v)) ? null : v);
  const MiddleLineData = this.seriesWithLeadInPadding(data.MiddleLine, (v) => (v == null || isNaN(v)) ? null : v);
  const LowerlineData = this.seriesWithLeadInPadding(data.Lowerline, (v) => (v == null || isNaN(v)) ? null : v);  
  seriesMap.get('Upperline').setData(UpperlineData);
  seriesMap.get('MiddleLine').setData(MiddleLineData);
  seriesMap.get('Lowerline').setData(LowerlineData);
}

renderDeMarker(chart, data, colors, seriesMap) {
  if (!data || !data.DeMarker) return;
  if (!seriesMap.has('DeMarker')) {
    seriesMap.set('DeMarker', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'DeMarker',  
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const DeMarkerData = this.seriesWithLeadInPadding(data.DeMarker, (v) => (v == null || isNaN(v)) ? null : v);
  seriesMap.get('DeMarker').setData(DeMarkerData);
}



renderAdaptiveMA(chart, data, colors, seriesMap) {
  if (!data || !data.AdaptiveMA) return;
  if (!seriesMap.has('AdaptiveMA')) {
    seriesMap.set('AdaptiveMA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Adaptive MA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const AdaptiveMAData = this.seriesWithLeadInPadding(data.AdaptiveMA, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('AdaptiveMA').setData(AdaptiveMAData);
}

renderADXDMI(chart, data, colors, seriesMap) {
  if (!data || !data.ADX || !data.DIPlus || !data.DIMinus) return;
  if (!seriesMap.has('ADX')) {
    seriesMap.set('ADX', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'ADX',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('DIPlus')) {
    seriesMap.set('DIPlus', chart.addLineSeries({
      color: colors.LINE2,  
      lineWidth: 2,
      title: 'DI+',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('DIMinus')) {
    seriesMap.set('DIMinus', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      title: 'DI-',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const ADXData = this.seriesWithLeadInPadding(data.ADX, (v) => (v == null || isNaN(v) ? null : v));
  const DIPlusData = this.seriesWithLeadInPadding(data.DIPlus, (v) => (v == null || isNaN(v) ? null : v));
  const DIMinusData = this.seriesWithLeadInPadding(data.DIMinus, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('ADX').setData(ADXData);
  seriesMap.get('DIPlus').setData(DIPlusData);
  seriesMap.get('DIMinus').setData(DIMinusData);
}

renderQstickBodyAvg(chart, data, colors, seriesMap) {
  if (!data || !data.QstickBodyAvg || !data.eQstickBodyAvg) return;
  if (!seriesMap.has('QstickBodyAvg')) {
    seriesMap.set('QstickBodyAvg', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Qstick Body Avg',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eQstickBodyAvg')) {
    seriesMap.set('eQstickBodyAvg', chart.addLineSeries({
      color: colors.LINE2, 
      lineWidth: 2,
      title: 'eQstick Body Avg',  
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const QstickBodyAvgData = this.seriesWithLeadInPadding(data.QstickBodyAvg, (v) => (v == null || isNaN(v) ? null : v));
  const eQstickBodyAvgData = this.seriesWithLeadInPadding(data.eQstickBodyAvg, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('QstickBodyAvg').setData(QstickBodyAvgData);
  seriesMap.get('eQstickBodyAvg').setData(eQstickBodyAvgData);
}

renderOBOS(chart, data, colors, seriesMap) {
  if (!data || !data.OBOS || !data.eOBOS) return;
  if (!seriesMap.has('OBOS')) { 
    seriesMap.set('OBOS', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'OBOS',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eOBOS')) {
    seriesMap.set('eOBOS', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eOBOS',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const OBOSData = this.seriesWithLeadInPadding(data.OBOS, (v) => (v == null || isNaN(v) ? null : v));
  const eOBOSData = this.seriesWithLeadInPadding(data.eOBOS, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('OBOS').setData(OBOSData);
  seriesMap.get('eOBOS').setData(eOBOSData);
}

renderMcClellanOscillator(chart, data, colors, seriesMap) {
  if (!data || !data.mcclellanOsc || !data.SI) return;
  if (!seriesMap.has('mcclellanOsc')) {
    seriesMap.set('mcclellanOsc', chart.addLineSeries({ 
      color: colors.LINE1,
      lineWidth: 2, 
      title: 'McClellan Oscillator',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('SI')) {
    seriesMap.set('SI', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'SI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const mcclellanOscData = this.seriesWithLeadInPadding(data.mcclellanOsc, (v) => (v == null || isNaN(v) ? null : v));
  const SIData = this.seriesWithLeadInPadding(data.SI, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('mcclellanOsc').setData(mcclellanOscData);
  seriesMap.get('SI').setData(SIData);
}

// renderMcClellanOscillator(chart, data, colors, seriesMap) {
//   if (!data || !data.SI) return;
//   if (!seriesMap.has('SI')) {
//     seriesMap.set('SI', chart.addLineSeries({
//       color: colors.LINE1,
//       lineWidth: 2, 
//       title: 'SI Oscillator',
//       crosshairMarkerVisible: false,
//       priceLineVisible: false,
//     }));
//   }
//   const mcclellanOscData = this.seriesWithLeadInPadding(data.SI, (v) => (v == null || isNaN(v) ? null : v));
//   seriesMap.get('SI').setData(mcclellanOscData);
// }

renderKlingerOscillator(chart, data, colors, seriesMap) {
  if (!data || !data.KO || !data.signalLine) return;
  if (!seriesMap.has('KO')) {
    seriesMap.set('KO', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2, 
      title: 'KO',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('signalLine')) {
    seriesMap.set('signalLine', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Signal Line',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));  
  }
  const KOData = this.seriesWithLeadInPadding(data.KO, (v) => (v == null || isNaN(v) ? null : v));
  const signalLineData = this.seriesWithLeadInPadding(data.signalLine, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('KO').setData(KOData);
  seriesMap.get('signalLine').setData(signalLineData);
}

renderDVO(chart, data, colors, seriesMap) {
  if (!data || !data.percentil) return;
  if (!seriesMap.has('percentil')) {
    seriesMap.set('percentil', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2, 
      title: 'DVO Percentil',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const percentilData = this.seriesWithLeadInPadding(data.percentil, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('percentil').setData(percentilData);
}

renderVortex(chart, data, colors, seriesMap) {
  if (!data || !data.pVI || !data.nVI) return;
  if (!seriesMap.has('pVI')) {
    seriesMap.set('pVI', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Positive Vortex Indicator',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('nVI')) {
    seriesMap.set('nVI', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Negative Vortex Indicator',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));  
  }
  const pVIData = this.seriesWithLeadInPadding(data.pVI, (v) => (v == null || isNaN(v) ? null : v));
  const nVIData = this.seriesWithLeadInPadding(data.nVI, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('pVI').setData(pVIData);
  seriesMap.get('nVI').setData(nVIData);
}

renderGaussianFilter(chart, data, colors,  seriesMap) {
  if (!data || !data.GaussianMA || !data.eGaussianMA) return;
  if (!seriesMap.has('GaussianMA')) {
    seriesMap.set('GaussianMA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Gaussian Filter',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eGaussianMA')) {
    seriesMap.set('eGaussianMA', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eGaussian Filter',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));  
  }
  if(!seriesMap.get('closes')) {
    seriesMap.set('closes', chart.addLineSeries({
      color: '#ff01e6',
      lineWidth: 1,
      title: 'Close Price',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
   const closesData = this.seriesWithLeadInPadding(data.closes, (v) => (v == null || isNaN(v) ? null : v));
   seriesMap.get('closes').setData(closesData);
  const GaussianMAData = this.seriesWithLeadInPadding(data.GaussianMA, (v) => (v == null || isNaN(v) ? null : v));
  const eGaussianMAData = this.seriesWithLeadInPadding(data.eGaussianMA, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('GaussianMA').setData(GaussianMAData);
  seriesMap.get('eGaussianMA').setData(eGaussianMAData);  

}

renderKairiRI(chart, data, colors, seriesMap) {
  if (!data || !data.KRI || !data.eKRI) return;
  if (!seriesMap.has('KRI')) {
    seriesMap.set('KRI', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Kairi RI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eKRI')) {
    seriesMap.set('eKRI', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eKairi RI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));  
  }
  const KRIData = this.seriesWithLeadInPadding(data.KRI, (v) => (v == null || isNaN(v) ? null : v));
  const eKRIData = this.seriesWithLeadInPadding(data.eKRI, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('KRI').setData(KRIData);
  seriesMap.get('eKRI').setData(eKRIData);
}

renderPGO(chart, data, colors, seriesMap) {
  if (!data || !data.PGO || !data.ePGO) return;
  if (!seriesMap.has('PGO')) {
    seriesMap.set('PGO', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'PGO',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('ePGO')) {
    seriesMap.set('ePGO', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'ePGO',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));  
  }
  const PGOData = this.seriesWithLeadInPadding(data.PGO, (v) => (v == null || isNaN(v) ? null : v));
  const ePGOData = this.seriesWithLeadInPadding(data.ePGO, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('PGO').setData(PGOData);
  seriesMap.get('ePGO').setData(ePGOData);
} 

renderADR(chart, data, colors, seriesMap) {
  if (!data || !data.ADR || !data.eADR) return;
  if (!seriesMap.has('ADR')) {
    seriesMap.set('ADR', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'ADR',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eADR')) {
    seriesMap.set('eADR', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eADR',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));  
  }
  const ADRData = this.seriesWithLeadInPadding(data.ADR, (v) => (v == null || isNaN(v) ? null : v));
  const eADRData = this.seriesWithLeadInPadding(data.eADR, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('ADR').setData(ADRData);
  seriesMap.get('eADR').setData(eADRData);
}


renderGravityOscCOG(chart, data, colors, seriesMap) {
  if (!data || !data.COG || !data.eCOG) return;
  if (!seriesMap.has('COG')) {
    seriesMap.set('COG', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'COG',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eCOG')) {
    seriesMap.set('eCOG', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eGravity Osc COG',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const COG = this.seriesWithLeadInPadding(data.COG, (v) => (v == null || isNaN(v) ? null : v));
  const eCOGData = this.seriesWithLeadInPadding(data.eCOG, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('COG').setData(COG);
  seriesMap.get('eCOG').setData(eCOGData);
} 


renderRiseFallRatioCOG(chart, data, colors, seriesMap) {
  if (!data || !data.riseFallRatio || !data.eRiseFallRatioCOG) return;
  if (!seriesMap.has('riseFallRatio')) {
    seriesMap.set('riseFallRatio', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Rise/Fall Ratio',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eRiseFallRatioCOG')) {
    seriesMap.set('eRiseFallRatioCOG', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eRise/Fall Ratio COG',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const riseFallRatioData = this.seriesWithLeadInPadding(data.riseFallRatio, (v) => (v == null || isNaN(v) ? null : v));
  const eRiseFallRatioData = this.seriesWithLeadInPadding(data.eRiseFallRatioCOG, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('riseFallRatio').setData(riseFallRatioData);
  seriesMap.get('eRiseFallRatioCOG').setData(eRiseFallRatioData);
} 


renderBalanceOfPower(chart, data, colors, seriesMap) {
  if (!data || !data.bop || !data.eBOP) return;
  if (!seriesMap.has('bop')) {
    seriesMap.set('bop', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'BOP',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eBOP')) {
    seriesMap.set('eBOP', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'eBOP',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const bopData = this.seriesWithLeadInPadding(data.bop, (v) => (v == null || isNaN(v) ? null : v));
  const eBOPData = this.seriesWithLeadInPadding(data.eBOP, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('bop').setData(bopData);
  seriesMap.get('eBOP').setData(eBOPData);
}

renderStochasticSMI(chart, data, colors, seriesMap) {
  if (!data || !data.SMI || !data.SignalLine) return;
  if (!seriesMap.has('SMI')) {
    seriesMap.set('SMI', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'SMI',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('SignalLine')) {
    seriesMap.set('SignalLine', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'SignalLine',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const SMIData = this.seriesWithLeadInPadding(data.SMI, (v) => (v == null || isNaN(v) ? null : v));
  const SignalLineData = this.seriesWithLeadInPadding(data.SignalLine, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('SMI').setData(SMIData);
  seriesMap.get('SignalLine').setData(SignalLineData);
}


renderZeroLagHullMA(chart, data, colors, seriesMap) {
  if (!data || !data.zeroLagHMA || !data.hma || !data.eHMA) return;

  if (!seriesMap.has('ZeroLagHMA')) {
    seriesMap.set('ZeroLagHMA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'ZeroLagHMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('HMA')) {
    seriesMap.set('HMA', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'HMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('eHMA')) {
    seriesMap.set('eHMA', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      title: 'eHMA',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }

  const zeroLagHMAData = this.seriesWithLeadInPadding(data.zeroLagHMA, (v) => (v == null || isNaN(v) ? null : v));
  const hmaData = this.seriesWithLeadInPadding(data.hma, (v) => (v == null || isNaN(v) ? null : v));
  const eHMAData = this.seriesWithLeadInPadding(data.eHMA, (v) => (v == null || isNaN(v) ? null : v));

  seriesMap.get('ZeroLagHMA').setData(zeroLagHMAData);
  seriesMap.get('HMA').setData(hmaData);
  seriesMap.get('eHMA').setData(eHMAData);
}

renderAlligator(chart, data, colors, seriesMap) {
  if (!data || !data.line1 || !data.line2 || !data.line3) return;
  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({ 
      color: colors.LINE1, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line2')) {
    seriesMap.set('line2', chart.addLineSeries({ 
      color: colors.LINE2, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line3')) {
    seriesMap.set('line3', chart.addLineSeries({ 
      color: colors.LINE3, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  const line1Data = this.seriesWithLeadInPadding(data.line1, (v) => (v == null || isNaN(v) ? null : v));
  const line2Data = this.seriesWithLeadInPadding(data.line2, (v) => (v == null || isNaN(v) ? null : v));
  const line3Data = this.seriesWithLeadInPadding(data.line3, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('line1').setData(line1Data);
  seriesMap.get('line2').setData(line2Data);
  seriesMap.get('line3').setData(line3Data);
}

renderMAoneMAtwo(chart, data, colors, seriesMap) {
  if (!data || !data.line1 || !data.line2) return;
  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'MA1',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('line2')) {
    seriesMap.set('line2', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'MA2',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const stepType =
    typeof LightweightCharts !== 'undefined' && LightweightCharts.LineType
      ? LightweightCharts.LineType.WithSteps
      : 2;
  if (!seriesMap.has('line3')) {
    seriesMap.set(
      'line3',
      chart.addLineSeries({
        color: colors.LINE3 || '#60a5fa',
        lineWidth: 2,
        lineType: stepType,
        title: 'ΣRR%',
        priceScaleId: 'left',
        crosshairMarkerVisible: false,
        priceLineVisible: false,
      })
    );
  }
  if (!seriesMap.has('tradeRR')) {
    seriesMap.set(
      'tradeRR',
      chart.addHistogramSeries({
        priceScaleId: 'left',
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        base: 0,
      })
    );
  }
  try {
    chart.applyOptions({
      leftPriceScale: {
        visible: true,
        borderColor: colors.LINE3 || '#475569',
        scaleMargins: { top: 0.2, bottom: 0.2 },
      },
    });
  } catch (e) {}

  const line1Data = this.seriesWithLeadInPadding(data.line1, (v) => (v == null || isNaN(v) ? null : v));
  const line2Data = this.seriesWithLeadInPadding(data.line2, (v) => (v == null || isNaN(v) ? null : v));
  const line3Data = data.line3
    ? this.seriesWithLeadInPadding(data.line3, (v) => (v == null || isNaN(v) ? null : v))
    : [];
  seriesMap.get('line1').setData(line1Data);
  seriesMap.get('line2').setData(line2Data);
  seriesMap.get('line3').setData(line3Data);

  const hist = [];
  if (data.rrTradePct && this.chartData && this.chartData.length) {
    const n = Math.min(this.chartData.length, data.rrTradePct.length);
    for (let i = 0; i < n; i++) {
      const v = data.rrTradePct[i];
      if (v == null || !Number.isFinite(v)) continue;
      const c = this.chartData[i];
      if (!c || c.time == null) continue;
      hist.push({
        time: c.time,
        value: v,
        color: v >= 0 ? colors.LINE1 || '#089981' : colors.LINE2 || '#f23645',
      });
    }
  }
  seriesMap.get('tradeRR').setData(hist);
}

renderMAone_MAtwoClose(chart, data, colors, seriesMap) {
  if (!data || !data.line1 || !data.line2 || !data.line3) return;
  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'MA1',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  if (!seriesMap.has('line2')) {
    seriesMap.set('line2', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'MA2',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const dashed =
    typeof LightweightCharts !== 'undefined' && LightweightCharts.LineStyle
      ? LightweightCharts.LineStyle.Dashed
      : 2;
  if (!seriesMap.has('line3')) {
    seriesMap.set('line3', chart.addLineSeries({
      color: colors.LINE3 || '#94a3b8',
      lineWidth: 1,
      // lineStyle: dashed,
      title: 'Close',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
    }));
  }
  const line1Data = this.seriesWithLeadInPadding(data.line1, (v) => (v == null || isNaN(v) ? null : v));
  const line2Data = this.seriesWithLeadInPadding(data.line2, (v) => (v == null || isNaN(v) ? null : v));
  const line3Data = this.seriesWithLeadInPadding(data.line3, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('line1').setData(line1Data);
  seriesMap.get('line2').setData(line2Data);
  seriesMap.get('line3').setData(line3Data);
}


renderPVIpercentRiseFall(chart, data, colors, seriesMap) {
  if (!data || !data.line1 || !data.line2) return;
  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({ 
      color: colors.LINE1, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line2')) {
    seriesMap.set('line2', chart.addLineSeries({ 
      color: colors.LINE2, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  const line1Data = this.seriesWithLeadInPadding(data.line1, (v) => (v == null || isNaN(v) ? null : v));
  const line2Data = this.seriesWithLeadInPadding(data.line2, (v) => (v == null || isNaN(v) ? null : v));
  seriesMap.get('line1').setData(line1Data);
  seriesMap.get('line2').setData(line2Data);
}


renderBollingerBands4SD(chart, data, colors, seriesMap) {
  if (!data || !data.line1 || !data.line2 || !data.line3) return;

  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({ 
      color: colors.LINE1, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line2')) {
    seriesMap.set('line2', chart.addLineSeries({ 
      color: colors.LINE2, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line3')) {
    seriesMap.set('line3', chart.addLineSeries({ 
      color: colors.LINE3, 
      lineWidth: 2, 
      title: '',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }

  const line1Data = this.seriesWithLeadInPadding(data.line1, (v) => (v == null || isNaN(v) ? null : v));
  const line2Data = this.seriesWithLeadInPadding(data.line2, (v) => (v == null || isNaN(v) ? null : v));
  const line3Data = this.seriesWithLeadInPadding(data.line3, (v) => (v == null || isNaN(v) ? null : v));

  seriesMap.get('line1').setData(line1Data);
  seriesMap.get('line2').setData(line2Data);
  seriesMap.get('line3').setData(line3Data);
} 
  // Rendering methods
  renderMACD(chart, data, colors, seriesMap) {
    if (!data || !data.macd || !data.signal || !data.hist) return;

    // Log last 5 values for verification
    console.log('Live MACD Test - Last 5 MACD:', data.macd.slice(-5));
    console.log('Live MACD Test - Last 5 Signal:', data.signal.slice(-5));
    console.log('Live MACD Test - Last 5 Hist:', data.hist.slice(-5));

    // Create series if they don't exist
    if (!seriesMap.has('macd')) {
      seriesMap.set('macd', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('signal')) {
      seriesMap.set('signal', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('histogram')) {
      seriesMap.set('histogram', chart.addHistogramSeries({ base: 0, title: '' }));
    }

    // Lead-in null padding so indicator aligns with price candles (empty section at start)
    const macdData = this.seriesWithLeadInPadding(data.macd, (v) => (v == null || isNaN(v) ? null : v));
    const signalData = this.seriesWithLeadInPadding(data.signal, (v) => (v == null || isNaN(v) ? null : v));
    const histData = this.seriesWithLeadInPadding(data.hist, (v) => {
      if (v == null || isNaN(v)) return { value: null };
      return { value: v, color: v >= 0 ? colors.UP : colors.DOWN };
    });

    seriesMap.get('macd').setData(macdData);
    seriesMap.get('signal').setData(signalData);
    seriesMap.get('histogram').setData(histData);
  }

  renderRSI(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('rsi')) {
      seriesMap.set('rsi', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      
      // Add overbought/oversold lines with Taiwan-style colors
      seriesMap.set('overbought', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 1, 
        lineStyle: 2, // Dashed
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('oversold', chart.addLineSeries({ 
        color: colors.LINE3, 
        lineWidth: 1, 
        lineStyle: 2, // Dashed
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const rsiData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    const overboughtData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? 70 : null));
    const oversoldData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? 30 : null));
    seriesMap.get('rsi').setData(rsiData);
    seriesMap.get('overbought').setData(overboughtData);
    seriesMap.get('oversold').setData(oversoldData);
  }

  renderDualRSI(chart, data, colors, seriesMap) {
    if (!data || !data.rsiA || !data.rsiB) return;

    // Create series if they don't exist
    if (!seriesMap.has('rsiA')) {
      seriesMap.set('rsiA', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: `RSI(${data.periodA})`,
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    if (!seriesMap.has('rsiB')) {
      seriesMap.set('rsiB', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: `RSI(${data.periodB})`,
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    // Add overbought/oversold lines
    if (!seriesMap.has('overbought')) {
      seriesMap.set('overbought', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2, // Dashed
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    if (!seriesMap.has('oversold')) {
      seriesMap.set('oversold', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2, // Dashed
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Full-length with null lead-in so lines align with price candles
    const rsiAData = this.seriesWithLeadInPadding(data.rsiA, (v) => (v != null && !isNaN(v) ? v : null));
    const rsiBData = this.seriesWithLeadInPadding(data.rsiB, (v) => (v != null && !isNaN(v) ? v : null));
    const overboughtData = this.seriesWithLeadInPadding(data.rsiA, (v) => (v != null && !isNaN(v) ? 70 : null));
    const oversoldData = this.seriesWithLeadInPadding(data.rsiA, (v) => (v != null && !isNaN(v) ? 30 : null));

    // Update series
    seriesMap.get('rsiA').setData(rsiAData);
    seriesMap.get('rsiB').setData(rsiBData);
    seriesMap.get('overbought').setData(overboughtData);
    seriesMap.get('oversold').setData(oversoldData);
  }

  renderStochastic(chart, data, colors, seriesMap) {
    if (!data || !data.k || !data.d) return;

    if (!seriesMap.has('k')) {
      seriesMap.set('k', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('d', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Full-length with null lead-in / nulls for invalid so lines align with price candles
    let kData = [];
    let dData = [];
    if (data.k.length === this.chartData.length) {
      for (let i = 0; i < this.chartData.length; i++) {
        const t = this.chartData[i].time;
        const kv = (data.k[i] != null && !isNaN(data.k[i]) && isFinite(data.k[i])) ? data.k[i] : null;
        const dv = (data.d[i] != null && !isNaN(data.d[i]) && isFinite(data.d[i])) ? data.d[i] : null;
        kData.push({ time: t, value: kv });
        dData.push({ time: t, value: dv });
      }
    } else {
      kData = this.seriesWithLeadInPadding(data.k, (v) => (v == null || isNaN(v) || !isFinite(v) ? null : v));
      dData = this.seriesWithLeadInPadding(data.d, (v) => (v == null || isNaN(v) || !isFinite(v) ? null : v));
    }

    seriesMap.get('k').setData(kData);
    seriesMap.get('d').setData(dData);
  }

  renderNewKD(chart, data, colors, seriesMap) {
    if (!data || !data.K2 || !data.D2) return;

    // Create series for 2 lines: K2 and D2 only
    if (!seriesMap.has('k2')) {
      seriesMap.set('k2', chart.addLineSeries({ 
        color: colors.LINE3,  // Orange for K2
        lineWidth: 2, 
        title: 'K2',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('d2')) {
      seriesMap.set('d2', chart.addLineSeries({ 
        color: colors.LINE6,  // Green for D2
        lineWidth: 3, 
        title: 'D2',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Full-length with null lead-in so lines align with price candles
    const k2Data = data.K2.length === this.chartData.length
      ? this.chartData.map((d, i) => ({ time: d.time, value: (data.K2[i] != null && !isNaN(data.K2[i]) && isFinite(data.K2[i])) ? data.K2[i] : null }))
      : this.seriesWithLeadInPadding(data.K2, (v) => (v != null && !isNaN(v) && isFinite(v) ? v : null));
    const d2Data = data.D2.length === this.chartData.length
      ? this.chartData.map((d, i) => ({ time: d.time, value: (data.D2[i] != null && !isNaN(data.D2[i]) && isFinite(data.D2[i])) ? data.D2[i] : null }))
      : this.seriesWithLeadInPadding(data.D2, (v) => (v != null && !isNaN(v) && isFinite(v) ? v : null));

    seriesMap.get('k2').setData(k2Data);
    seriesMap.get('d2').setData(d2Data);
  }

  renderWilliamsR(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('williamsr')) {
      seriesMap.set('williamsr', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const williamsData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('williamsr').setData(williamsData);
  }

  renderCCI(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('cci')) {
      seriesMap.set('cci', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const cciData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('cci').setData(cciData);
  }

  renderMFI(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('MFI render: No data or invalid data format');
      return;
    }
    console.log(`MFI render: Rendering ${data.length} data points, chartData has ${this.chartData.length} points`);

    if (!seriesMap.has('mfi')) {
      seriesMap.set('mfi', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: 'MFI',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('overbought', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('oversold', chart.addLineSeries({ 
        color: colors.LINE3, 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const mfiData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    const overboughtData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? 80 : null));
    const oversoldData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? 20 : null));

    seriesMap.get('mfi').setData(mfiData);
    if (seriesMap.has('overbought')) seriesMap.get('overbought').setData(overboughtData);
    if (seriesMap.has('oversold')) seriesMap.get('oversold').setData(oversoldData);
  }

  renderADX(chart, data, colors, seriesMap) {
    if (!data || !data.adx) return;

    if (!seriesMap.has('adx')) {
      seriesMap.set('adx', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      if (data.plusDI) {
        seriesMap.set('plusdi', chart.addLineSeries({ 
          color: colors.UP, 
          lineWidth: 1, 
          title: '',
          crosshairMarkerVisible: false,
          priceLineVisible: false
        }));
      }
      if (data.minusDI) {
        seriesMap.set('minusdi', chart.addLineSeries({ 
          color: colors.DOWN, 
          lineWidth: 1, 
          title: '',
          crosshairMarkerVisible: false,
          priceLineVisible: false
        }));
      }
    }

    const adxData = this.seriesWithLeadInPadding(data.adx, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('adx').setData(adxData);

    if (data.plusDI && seriesMap.has('plusdi')) {
      seriesMap.get('plusdi').setData(this.seriesWithLeadInPadding(data.plusDI, (v) => (v != null && !isNaN(v) ? v : null)));
    }
    if (data.minusDI && seriesMap.has('minusdi')) {
      seriesMap.get('minusdi').setData(this.seriesWithLeadInPadding(data.minusDI, (v) => (v != null && !isNaN(v) ? v : null)));
    }
  }

  renderMomentum(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('momentum')) {
      seriesMap.set('momentum', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const momentumData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('momentum').setData(momentumData);
  }

  renderROCSingle(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('roc')) {
      seriesMap.set('roc', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const rocData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('roc').setData(rocData);
  }

  renderROC(chart, data, colors, seriesMap) {
    if (Array.isArray(data) && data.length > 0) {
      this.renderROCSingle(chart, data, colors, seriesMap);
      return;
    }
    if (data && (data.ROC1 || data.ROC2)) {
      this.renderMultiLine(chart, data, colors, seriesMap, ['ROC1', 'ROC2'], ['ROC1', 'ROC2']);
    }
  }

  renderCoppockCurve(chart, data, colors, seriesMap) {
    if (!data || (!data.coppock && !data.ecoppock)) return;

    // Handle both lowercase and uppercase property names
    const coppock = data.coppock || [];
    const ecoppock = data.ecoppock || [];

    // Create Coppock line (MA)
    if (!seriesMap.has('coppock')) {
      seriesMap.set('coppock', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: 'Coppock (MA)',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Create eCoppock line (EMA)
    if (!seriesMap.has('ecoppock')) {
      seriesMap.set('ecoppock', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: 'eCoppock (EMA)',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const coppockData = this.seriesWithLeadInPadding(coppock, (v) => (v != null && !isNaN(v) ? v : null));
    const ecoppockData = this.seriesWithLeadInPadding(ecoppock, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('coppock').setData(coppockData);
    seriesMap.get('ecoppock').setData(ecoppockData);
  }

  renderVolume(chart, data, colors, seriesMap) {
    // Handle both old format (array) and new format (object with volumes and volMA)
    const volumes = Array.isArray(data) ? data : (data?.volumes || []);
    const volMA = data?.volMA || null;
    
    if (!Array.isArray(volumes) || volumes.length === 0) return;

    if (!seriesMap.has('volume')) {
      seriesMap.set('volume', chart.addHistogramSeries({ color: colors.VOLUME, base: 0, title: '' }));
    }

    const volumeData = this.seriesWithLeadInPadding(volumes, (v, i) => {
      if (v == null) return { value: null };
      const idx = this.chartData.length - volumes.length + i;
      const c = this.chartData[idx];
      const color = c && c.close >= c.open ? colors.UP : colors.DOWN;
      return { value: v, color };
    });
    seriesMap.get('volume').setData(volumeData);

    if (volMA && Array.isArray(volMA) && volMA.length > 0) {
      if (!seriesMap.has('volma')) {
        seriesMap.set('volma', chart.addLineSeries({
          color: colors.LINE1 || '#ff6b6b', lineWidth: 2, title: 'VolMA',
          crosshairMarkerVisible: false, priceLineVisible: false
        }));
      }
      seriesMap.get('volma').setData(this.seriesWithLeadInPadding(volMA, (v) => (v != null && !isNaN(v) ? v : null)));
    }
  }

  renderOBVSingle(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('obv')) {
      seriesMap.set('obv', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const obvData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('obv').setData(obvData);
  }

  renderOBV(chart, data, colors, seriesMap) {
    if (Array.isArray(data) && data.length > 0) {
      this.renderOBVSingle(chart, data, colors, seriesMap);
      return;
    }
    if (data && (data.OBV || data.eOBV)) {
      this.renderMultiLine(chart, data, colors, seriesMap, ['OBV', 'eOBV'], ['OBV', 'eOBV']);
    }
  }

  renderARBR(chart, data, colors, seriesMap) {
    if (!data || !data.ar || !data.br) return;

    // Create series if they don't exist
    if (!seriesMap.has('ar')) {
      seriesMap.set('ar', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    if (!seriesMap.has('br')) {
      seriesMap.set('br', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add reference lines at 100 (equilibrium)
    if (!seriesMap.has('reference')) {
      seriesMap.set('reference', chart.addLineSeries({
        color: '#666666',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const arData = this.seriesWithLeadInPadding(data.ar, (v) => (v != null && !isNaN(v) ? v : null));
    const brData = this.seriesWithLeadInPadding(data.br, (v) => (v != null && !isNaN(v) ? v : null));
    const refData = this.seriesWithLeadInPadding(data.ar, () => 100);
    seriesMap.get('ar').setData(arData);
    seriesMap.get('br').setData(brData);
    seriesMap.get('reference').setData(refData);
  }

   renderSYBR(chart, data, colors, seriesMap) {
    if (!data || !data.ar || !data.br) return;

    // Create series if they don't exist
    if (!seriesMap.has('ar')) {
      seriesMap.set('ar', chart.addLineSeries({ 
        color: colors.LINE4, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    if (!seriesMap.has('br')) {
      seriesMap.set('br', chart.addLineSeries({ 
        color: colors.LINE5, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    // Add reference lines at 100 (equilibrium)
    if (!seriesMap.has('reference')) {
      seriesMap.set('reference', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2, // Dashed
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const arData = this.seriesWithLeadInPadding(data.ar, (v) => (v != null && !isNaN(v) ? v : null));
    const brData = this.seriesWithLeadInPadding(data.br, (v) => (v != null && !isNaN(v) ? v : null));
    const refData = this.seriesWithLeadInPadding(data.ar, () => 100);
    seriesMap.get('ar').setData(arData);
    seriesMap.get('br').setData(brData);
    seriesMap.get('reference').setData(refData);
  }

  renderCR(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('cr')) {
      seriesMap.set('cr', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    // Add reference line at 100
    if (!seriesMap.has('reference')) {
      seriesMap.set('reference', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const crData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    const refData = this.seriesWithLeadInPadding(data, () => 100);
    seriesMap.get('cr').setData(crData);
    seriesMap.get('reference').setData(refData);
  }

  renderDualCR(chart, data, colors, seriesMap) {
    if (!data || !data.crA || !data.crB) return;

    // Create series if they don't exist
    if (!seriesMap.has('crA')) {
      seriesMap.set('crA', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: `CR(${data.periodA})`,
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    if (!seriesMap.has('crB')) {
      seriesMap.set('crB', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: `CR(${data.periodB})`,
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    
    // Add reference line at 100
    if (!seriesMap.has('reference')) {
      seriesMap.set('reference', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const crAData = this.seriesWithLeadInPadding(data.crA, (v) => (v != null && !isNaN(v) ? v : null));
    const crBData = this.seriesWithLeadInPadding(data.crB, (v) => (v != null && !isNaN(v) ? v : null));
    const refData = this.seriesWithLeadInPadding(data.crB, () => 100);
    seriesMap.get('crA').setData(crAData);
    seriesMap.get('crB').setData(crBData);
    seriesMap.get('reference').setData(refData);
  }

  renderBBI(chart, data, colors, seriesMap) {
    if (!data || !data.bbi) return;

    // Create BBI line series
    if (!seriesMap.has('bbi')) {
      seriesMap.set('bbi', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 3, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add the four MA components for reference
    if (!seriesMap.has('ma3')) {
      seriesMap.set('ma3', chart.addLineSeries({ 
        color: '#4ade80', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    if (!seriesMap.has('ma24')) {
      seriesMap.set('ma24', chart.addLineSeries({ 
        color: '#f87171', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const bbiData = this.seriesWithLeadInPadding(data.bbi, (v) => (v != null && !isNaN(v) ? v : null));
    const ma3Data = this.seriesWithLeadInPadding(data.ma3, (v) => (v != null && !isNaN(v) ? v : null));
    const ma24Data = this.seriesWithLeadInPadding(data.ma24, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('bbi').setData(bbiData);
    seriesMap.get('ma3').setData(ma3Data);
    seriesMap.get('ma24').setData(ma24Data);
  }

  renderBullBearPower(chart, data, colors, seriesMap) {
    if (!data || !data.bullPower || !data.bearPower) return;

    // Create Bull Power line series (green)
    if (!seriesMap.has('bullPower')) {
      seriesMap.set('bullPower', chart.addLineSeries({ 
        color: '#22c55e', // Green for bull power
        lineWidth: 2, 
        title: '',
        priceFormat: {
          type: 'price',
          precision: 4,
          minMove: 0.0001
        },
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Create Bear Power line series (red)
    if (!seriesMap.has('bearPower')) {
      seriesMap.set('bearPower', chart.addLineSeries({ 
        color: '#ef4444', // Red for bear power
        lineWidth: 2, 
        title: '',
        priceFormat: {
          type: 'price',
          precision: 4,
          minMove: 0.0001
        },
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add zero line
    if (!seriesMap.has('zeroLine')) {
      seriesMap.set('zeroLine', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const bullData = this.seriesWithLeadInPadding(data.bullPower, (v) => (v != null && !isNaN(v) ? v : null));
    const bearData = this.seriesWithLeadInPadding(data.bearPower, (v) => (v != null && !isNaN(v) ? v : null));
    const zeroData = this.seriesWithLeadInPadding(data.bullPower, () => 0);
    seriesMap.get('bullPower').setData(bullData);
    seriesMap.get('bearPower').setData(bearData);
    seriesMap.get('zeroLine').setData(zeroData);
  }

  renderMA(chart, data, colors, seriesMap) {
    if (!Array.isArray(data) || data.length === 0) return;

    if (!seriesMap.has('ma')) {
      seriesMap.set('ma', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const maData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('ma').setData(maData);
  }

  // New Indicator Render Methods
  renderBBI3(chart, data, colors, seriesMap) {
    if (!data || !data.bbi3) return;

    // Create MA1 line
    if (!seriesMap.has('ma1')) {
      seriesMap.set('ma1', chart.addLineSeries({ 
        color: '#60a5fa', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Create MA2 line
    if (!seriesMap.has('ma2')) {
      seriesMap.set('ma2', chart.addLineSeries({ 
        color: '#fbbf24', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Create MA3 line
    if (!seriesMap.has('ma3')) {
      seriesMap.set('ma3', chart.addLineSeries({ 
        color: '#a78bfa', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Create BBI3 average line (thicker)
    if (!seriesMap.has('bbi3')) {
      seriesMap.set('bbi3', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 3, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const ma1Data = this.seriesWithLeadInPadding(data.ma1, (v) => (v != null && !isNaN(v) ? v : null));
    const ma2Data = this.seriesWithLeadInPadding(data.ma2, (v) => (v != null && !isNaN(v) ? v : null));
    const ma3Data = this.seriesWithLeadInPadding(data.ma3, (v) => (v != null && !isNaN(v) ? v : null));
    const bbi3Data = this.seriesWithLeadInPadding(data.bbi3, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('ma1').setData(ma1Data);
    seriesMap.get('ma2').setData(ma2Data);
    seriesMap.get('ma3').setData(ma3Data);
    seriesMap.get('bbi3').setData(bbi3Data);
  }

  renderBBI4(chart, data, colors, seriesMap) {
    if (!data || !data.bbi4) return;

    // Create MA lines
    if (!seriesMap.has('ma1')) {
      seriesMap.set('ma1', chart.addLineSeries({ 
        color: '#60a5fa', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma2')) {
      seriesMap.set('ma2', chart.addLineSeries({ 
        color: '#fbbf24', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma3')) {
      seriesMap.set('ma3', chart.addLineSeries({ 
        color: '#a78bfa', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma4')) {
      seriesMap.set('ma4', chart.addLineSeries({ 
        color: '#f87171', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }

    // Create BBI4 average line (thicker)
    if (!seriesMap.has('bbi4')) {
      seriesMap.set('bbi4', chart.addLineSeries({ 
        color: colors.LINE1, lineWidth: 3, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }

    const ma1Data = this.seriesWithLeadInPadding(data.ma1, (v) => (v != null && !isNaN(v) ? v : null));
    const ma2Data = this.seriesWithLeadInPadding(data.ma2, (v) => (v != null && !isNaN(v) ? v : null));
    const ma3Data = this.seriesWithLeadInPadding(data.ma3, (v) => (v != null && !isNaN(v) ? v : null));
    const ma4Data = this.seriesWithLeadInPadding(data.ma4, (v) => (v != null && !isNaN(v) ? v : null));
    const bbi4Data = this.seriesWithLeadInPadding(data.bbi4, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('ma1').setData(ma1Data);
    seriesMap.get('ma2').setData(ma2Data);
    seriesMap.get('ma3').setData(ma3Data);
    seriesMap.get('ma4').setData(ma4Data);
    seriesMap.get('bbi4').setData(bbi4Data);
  }

  renderBBI5(chart, data, colors, seriesMap) {
    if (!data || !data.bbi5) return;

    // Create MA lines
    if (!seriesMap.has('ma1')) {
      seriesMap.set('ma1', chart.addLineSeries({ 
        color: '#60a5fa', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma2')) {
      seriesMap.set('ma2', chart.addLineSeries({ 
        color: '#fbbf24', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma3')) {
      seriesMap.set('ma3', chart.addLineSeries({ 
        color: '#a78bfa', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma4')) {
      seriesMap.set('ma4', chart.addLineSeries({ 
        color: '#f87171', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ma5')) {
      seriesMap.set('ma5', chart.addLineSeries({ 
        color: '#34d399', lineWidth: 1, lineStyle: 2, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }

    // Create BBI5 average line (thicker)
    if (!seriesMap.has('bbi5')) {
      seriesMap.set('bbi5', chart.addLineSeries({ 
        color: colors.LINE1, lineWidth: 3, title: '',
        crosshairMarkerVisible: false, priceLineVisible: false
      }));
    }

    const ma1Data = this.seriesWithLeadInPadding(data.ma1, (v) => (v != null && !isNaN(v) ? v : null));
    const ma2Data = this.seriesWithLeadInPadding(data.ma2, (v) => (v != null && !isNaN(v) ? v : null));
    const ma3Data = this.seriesWithLeadInPadding(data.ma3, (v) => (v != null && !isNaN(v) ? v : null));
    const ma4Data = this.seriesWithLeadInPadding(data.ma4, (v) => (v != null && !isNaN(v) ? v : null));
    const ma5Data = this.seriesWithLeadInPadding(data.ma5, (v) => (v != null && !isNaN(v) ? v : null));
    const bbi5Data = this.seriesWithLeadInPadding(data.bbi5, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('ma1').setData(ma1Data);
    seriesMap.get('ma2').setData(ma2Data);
    seriesMap.get('ma3').setData(ma3Data);
    seriesMap.get('ma4').setData(ma4Data);
    seriesMap.get('ma5').setData(ma5Data);
    seriesMap.get('bbi5').setData(bbi5Data);
  }

  renderOSC(chart, data, colors, seriesMap) {
    if (!data || !data.osc1 || !data.osc2) return;

    if (!seriesMap.has('osc1')) {
      seriesMap.set('osc1', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    if (!seriesMap.has('osc2')) {
      seriesMap.set('osc2', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add zero/one reference lines
    if (!seriesMap.has('zeroLine')) {
      seriesMap.set('zeroLine', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const osc1Data = this.seriesWithLeadInPadding(data.osc1, (v) => (v != null && !isNaN(v) ? v : null));
    const osc2Data = this.seriesWithLeadInPadding(data.osc2, (v) => (v != null && !isNaN(v) ? v : null));
    const zeroData = this.seriesWithLeadInPadding(data.osc1, () => 0);
    seriesMap.get('osc1').setData(osc1Data);
    seriesMap.get('osc2').setData(osc2Data);
    seriesMap.get('zeroLine').setData(zeroData);
  }

  renderBIAS(chart, data, colors, seriesMap) {
    if (!data || !data.bias1 || !data.bias2) return;

    if (!seriesMap.has('bias1')) {
      seriesMap.set('bias1', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    if (!seriesMap.has('bias2')) {
      seriesMap.set('bias2', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add zero reference line
    if (!seriesMap.has('zeroLine')) {
      seriesMap.set('zeroLine', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const bias1Data = this.seriesWithLeadInPadding(data.bias1, (v) => (v != null && !isNaN(v) ? v : null));
    const bias2Data = this.seriesWithLeadInPadding(data.bias2, (v) => (v != null && !isNaN(v) ? v : null));
    const zeroData = this.seriesWithLeadInPadding(data.bias1, () => 0);
    seriesMap.get('bias1').setData(bias1Data);
    seriesMap.get('bias2').setData(bias2Data);
    seriesMap.get('zeroLine').setData(zeroData);
  }

  renderMBIAS(chart, data, colors, seriesMap) {
    if (!data || !data.mbias) return;

    if (!seriesMap.has('mbias')) {
      seriesMap.set('mbias', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add zero reference line
    if (!seriesMap.has('zeroLine')) {
      seriesMap.set('zeroLine', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const mbiasData = this.seriesWithLeadInPadding(data.mbias, (v) => (v != null && !isNaN(v) ? v : null));
    const zeroData = this.seriesWithLeadInPadding(data.mbias, () => 0);
    seriesMap.get('mbias').setData(mbiasData);
    seriesMap.get('zeroLine').setData(zeroData);
  }

  renderUOSC(chart, data, colors, seriesMap) {
    if (!data || !data.uosc1 || !data.uosc2) return;

    if (!seriesMap.has('uosc1')) {
      seriesMap.set('uosc1', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    if (!seriesMap.has('uosc2')) {
      seriesMap.set('uosc2', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add zero/one reference line
    if (!seriesMap.has('zeroLine')) {
      seriesMap.set('zeroLine', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const uosc1Data = this.seriesWithLeadInPadding(data.uosc1, (v) => (v != null && !isNaN(v) ? v : null));
    const uosc2Data = this.seriesWithLeadInPadding(data.uosc2, (v) => (v != null && !isNaN(v) ? v : null));
    const zeroData = this.seriesWithLeadInPadding(data.uosc1, () => 0);
    seriesMap.get('uosc1').setData(uosc1Data);
    seriesMap.get('uosc2').setData(uosc2Data);
    seriesMap.get('zeroLine').setData(zeroData);
  }

  renderATR(chart, data, colors, seriesMap) {
    if (!data || !data.atr) return;

    if (!seriesMap.has('atr')) {
      seriesMap.set('atr', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const atrData = this.seriesWithLeadInPadding(data.atr, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('atr').setData(atrData);
  }

  renderADO(chart, data, colors, seriesMap) {
    if (!data || !data.ado) return;

    if (!seriesMap.has('ado')) {
      seriesMap.set('ado', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    // Add reference line at 50 (neutral level)
    if (!seriesMap.has('midLine')) {
      seriesMap.set('midLine', chart.addLineSeries({ 
        color: '#666666', 
        lineWidth: 1, 
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const adoData = this.seriesWithLeadInPadding(data.ado, (v) => (v != null && !isNaN(v) ? v : null));
    const midData = this.seriesWithLeadInPadding(data.ado, () => 50);
    seriesMap.get('ado').setData(adoData);
    seriesMap.get('midLine').setData(midData);
  }

  renderVAO(chart, data, colors, seriesMap) {
    if (!data || !data.vao) return;

    if (!seriesMap.has('vao')) {
      seriesMap.set('vao', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const vaoData = this.seriesWithLeadInPadding(data.vao, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('vao').setData(vaoData);
  }

  renderHLO(chart, data, colors, seriesMap) {
    if (!data || !data.hlo || !data.hlos) return;

    if (!seriesMap.has('hlo')) {
      seriesMap.set('hlo', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 1, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    if (!seriesMap.has('hlos')) {
      seriesMap.set('hlos', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const hloData = this.seriesWithLeadInPadding(data.hlo, (v) => (v != null && !isNaN(v) ? v : null));
    const hlosData = this.seriesWithLeadInPadding(data.hlos, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('hlo').setData(hloData);
    seriesMap.get('hlos').setData(hlosData);
  }

  renderVHF(chart, data, colors, seriesMap) {
    if (!data || (!data.vhf && !data.vhfs)) return;
    const vhf = data.vhf || [];
    const vhfs = data.vhfs || [];

    if (!seriesMap.has('vhf')) {
      seriesMap.set('vhf', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 1,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('vhfs')) {
      seriesMap.set('vhfs', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const vhfData = this.seriesWithLeadInPadding(vhf, (v) => (v != null && !isNaN(v) ? v : null));
    const vhfsData = this.seriesWithLeadInPadding(vhfs, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('vhf').setData(vhfData);
    seriesMap.get('vhfs').setData(vhfsData);
  }

  renderRandomWalkingIndex(chart, data, colors, seriesMap) {
    if (!data || (!data.RWI_high && !data.RWI_low)) return;
    const rwiHigh = data.RWI_high || [];
    const rwiLow = data.RWI_low || [];

    if (!seriesMap.has('rwi_high')) {
      seriesMap.set('rwi_high', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: 'RWI High',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('rwi_low')) {
      seriesMap.set('rwi_low', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: 'RWI Low',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const highData = this.seriesWithLeadInPadding(rwiHigh, (v) => (v != null && !isNaN(v) && Number.isFinite(v) ? v : null));
    const lowData = this.seriesWithLeadInPadding(rwiLow, (v) => (v != null && !isNaN(v) && Number.isFinite(v) ? v : null));
    seriesMap.get('rwi_high').setData(highData);
    seriesMap.get('rwi_low').setData(lowData);
  }

  renderREXOscillator(chart, data, colors, seriesMap) {
    if (!data || (!data.REX && !data.TVB)) return;
    const rex = data.REX || [];
    const tvb = data.TVB || [];

    if (!seriesMap.has('rex')) {
      seriesMap.set('rex', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: 'REX',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('tvb')) {
      seriesMap.set('tvb', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: 'TVB',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const rexData = this.seriesWithLeadInPadding(rex, (v) => (v != null && !isNaN(v) && Number.isFinite(v) ? v : null));
    const tvbData = this.seriesWithLeadInPadding(tvb, (v) => (v != null && !isNaN(v) && Number.isFinite(v) ? v : null));
    seriesMap.get('rex').setData(rexData);
    seriesMap.get('tvb').setData(tvbData);
  }

  renderVR(chart, data, colors, seriesMap) {
    if (!data || (!data.vr && !data.vrs)) return;
    const vr = data.vr || [];
    const vrs = data.vrs || [];

    if (!seriesMap.has('vr')) {
      seriesMap.set('vr', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('vrs')) {
      seriesMap.set('vrs', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const vrData = this.seriesWithLeadInPadding(vr, (v) => (v != null && !isNaN(v) ? v : null));
    const vrsData = this.seriesWithLeadInPadding(vrs, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('vr').setData(vrData);
    seriesMap.get('vrs').setData(vrsData);
  }

  renderDEMA(chart, data, colors, seriesMap) {
    if (!data || (!data.dema && !data.ema)) return;
    const dema = data.dema || [];
    const ema = data.ema || [];

    if (!seriesMap.has('dema')) {
      seriesMap.set('dema', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('ema')) {
      seriesMap.set('ema', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 1,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const demaData = this.seriesWithLeadInPadding(dema, (v) => (v != null && !isNaN(v) ? v : null));
    const emaData = this.seriesWithLeadInPadding(ema, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('dema').setData(demaData);
    seriesMap.get('ema').setData(emaData);
  }

  

  renderVRMA(chart, data, colors, seriesMap) {
    if (!data || (!data.vrma1 && !data.vrma2)) return;
    const vrma1 = data.vrma1 || [];
    const vrma2 = data.vrma2 || [];

    if (!seriesMap.has('vrma1')) {
      seriesMap.set('vrma1', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    if (!seriesMap.has('vrma2')) {
      seriesMap.set('vrma2', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const vrma1Data = this.seriesWithLeadInPadding(vrma1, (v) => (v != null && !isNaN(v) ? v : null));
    const vrma2Data = this.seriesWithLeadInPadding(vrma2, (v) => (v != null && !isNaN(v) ? v : null));

    seriesMap.get('vrma1').setData(vrma1Data);
    seriesMap.get('vrma2').setData(vrma2Data);
  }

  renderADI(chart, data, colors, seriesMap) {
    if (!data || (!data.adi && !data.ADI) || (!data.adis && !data.ADIs)) return;

    // Handle both lowercase and uppercase property names
    const adi = data.ADI || data.adi || [];
    const adis = data.ADIs || data.adis || [];

    if (!seriesMap.has('adi')) {
      seriesMap.set('adi', chart.addLineSeries({ 
        color: colors.LINE1, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('adis', chart.addLineSeries({ 
        color: colors.LINE2, 
        lineWidth: 2, 
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }

    const adiData = this.seriesWithLeadInPadding(adi, (v) => (v != null && !isNaN(v) ? v : null));
    const adisData = this.seriesWithLeadInPadding(adis, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('adi').setData(adiData);
    seriesMap.get('adis').setData(adisData);
  }

  // Generic render function for indicators with N lines
  renderMultiLine(chart, data, colors, seriesMap, lineKeys, lineLabels = null) {
    if (!data) return;
    
    const lineColors = [colors.LINE1, colors.LINE2, colors.LINE3, colors.LINE4, colors.LINE5];
    
    lineKeys.forEach((key, idx) => {
      const values = data[key];
      if (!values || !Array.isArray(values) || values.length === 0) return;
      
      const seriesKey = key.toLowerCase();
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, chart.addLineSeries({ 
          color: lineColors[idx % lineColors.length], 
          lineWidth: 2, 
          title: lineLabels ? lineLabels[idx] : key,
          crosshairMarkerVisible: false,
          priceLineVisible: false
        }));
      }
      
      const chartData = this.seriesWithLeadInPadding(values, (v) => (v != null && !isNaN(v) ? v : null));
      seriesMap.get(seriesKey).setData(chartData);
    });
  }

  renderIMI(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['IMI1', 'IMI2'], ['IMI1', 'IMI2']);
  }

  renderQstick(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['Qstick1', 'Qstick2'], ['Qstick1', 'Qstick2']);
  }

  renderMTM(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['MTM1', 'MTM2'], ['MTM1', 'MTM2']);
  }

  renderKST(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['KST', 'KSTma'], ['KST', 'KST Signal']);
  }

  renderACC(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['MTM', 'ACC'], ['MTM', 'ACC']);
  }

  renderWAD(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['WAD', 'eWAD'], ['WAD', 'eWAD']);
  }

  renderCostMA(chart, data, colors, seriesMap) {
    if (!data || !data.costma) return;
    this.renderMultiLine(chart, data, colors, seriesMap, ['costma'], ['CostMA']);
  }

  renderVROC(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['VROC1', 'VROC2'], ['VROC1', 'VROC2']);
  }

  renderBTI(chart, data, colors, seriesMap) {
    if (!data || !data.bti) return;
    this.renderMultiLine(chart, data, colors, seriesMap, ['bti'], ['BTI']);
  }

  renderDPO(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['DPO', 'eDPO'], ['DPO', 'eDPO']);
  }

  renderEOM(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['EOM', 'eEOM'], ['EOM', 'eEOM']);
  }

  renderPVT(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['PVT', 'ePVT'], ['PVT', 'ePVT']);
  }

  renderParabolicSAR(chart, data, colors, seriesMap) {
    if (!data || !data.sar) return;
    this.renderMultiLine(chart, data, colors, seriesMap, ['sar'], ['SAR']);
  }

  renderIchimoku(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, 
      ['tenkanSen', 'kijunSen', 'chikouSpan', 'senkouA', 'senkouB'],
      ['Tenkan', 'Kijun', 'Chikou', 'Senkou A', 'Senkou B']);
  }

  renderM3(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['m3', 'em3'], ['M3', 'eM3']);
  }

  renderDMA(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['dma', 'ama'], ['DMA', 'AMA']);
  }

  renderHullMA(chart, data, colors, seriesMap) {
    this.renderMultiLine(chart, data, colors, seriesMap, ['hma', 'ehma'], ['HMA', 'eHMA']);
  }

  renderVolMA(chart, data, colors, seriesMap) {
    if (!data || !data.volma) return;
    this.renderMultiLine(chart, data, colors, seriesMap, ['volma'], ['VolMA']);
  }

  // Floating settings popover — houses the parameter controls that used to be
  // always-visible in the header (see updateParametersDisplay, which renders
  // into the popover's own #${panelId}-params container unchanged).
  showSettingsDialog(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;

    const popover = document.getElementById(`${panelId}-settings-popover`);
    const gearBtn = document.getElementById(`${panelId}-settings`);
    if (!popover || !gearBtn) return;

    // Only one settings popover open at a time
    document.querySelectorAll('.indicator-settings-popover').forEach(p => {
      if (p !== popover) p.hidden = true;
    });

    if (!popover.hidden) {
      popover.hidden = true;
      return;
    }

    this.updateParametersDisplay(panelId);

    popover.hidden = false;
    const rect = gearBtn.getBoundingClientRect();
    const popoverWidth = popover.offsetWidth || 260;
    const popoverHeight = popover.offsetHeight || 200;
    const fitsBelow = rect.bottom + 6 + popoverHeight <= window.innerHeight - 8;
    popover.style.top = fitsBelow
      ? `${rect.bottom + 6}px`
      : `${Math.max(8, rect.top - popoverHeight - 6)}px`;
    popover.style.left = `${Math.max(8, Math.min(rect.right - popoverWidth, window.innerWidth - popoverWidth - 8))}px`;

    const closeBtn = document.getElementById(`${panelId}-settings-close`);
    if (closeBtn && !closeBtn._wired) {
      closeBtn._wired = true;
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.hidden = true;
      });
    }

    if (!popover._outsideClickWired) {
      popover._outsideClickWired = true;
      document.addEventListener('click', (e) => {
        if (popover.hidden) return;
        if (popover.contains(e.target) || e.target === gearBtn || gearBtn.contains(e.target)) return;
        popover.hidden = true;
      });
    }
  }

  // ─── Indicator picker modal ─────────────────────────────────────────────
  // One shared modal instance reused across every panel; groups the ~120
  // indicator definitions by their existing `type` field (no new
  // categorization data needed) and supports live search by name/key.
  openIndicatorPicker(panelId) {
    this._pickerTargetPanelId = panelId;
    this._ensureIndicatorPickerModal();
    const modal = this._pickerModal;
    const searchInput = modal.querySelector('.indicator-picker-search');
    searchInput.value = '';
    this._renderIndicatorPickerList('');
    modal.hidden = false;
    setTimeout(() => searchInput.focus(), 30);
  }

  _ensureIndicatorPickerModal() {
    if (this._pickerModal) return;

    this._pickerCategoryLabels = {
      trend: 'Trend',
      momentum: 'Momentum',
      oscillator: 'Oscillators',
      volume: 'Volume',
      volatility: 'Volatility',
    };

    const overlay = document.createElement('div');
    overlay.className = 'indicator-picker-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="indicator-picker-modal">
        <div class="indicator-picker-header">
          <input type="text" class="indicator-picker-search" placeholder="Search indicators…" />
          <button type="button" class="indicator-picker-close" title="Close">✕</button>
        </div>
        <div class="indicator-picker-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const closeModal = () => { overlay.hidden = true; };
    overlay.querySelector('.indicator-picker-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    const searchInput = overlay.querySelector('.indicator-picker-search');
    searchInput.addEventListener('input', () => {
      this._renderIndicatorPickerList(searchInput.value);
    });

    this._pickerModal = overlay;
  }

  _renderIndicatorPickerList(term) {
    const modal = this._pickerModal;
    if (!modal) return;
    const body = modal.querySelector('.indicator-picker-body');
    const q = (term || '').trim().toLowerCase();

    const byCategory = {};
    Object.entries(this.indicatorDefinitions).forEach(([key, def]) => {
      if (q && !def.name.toLowerCase().includes(q) && !key.toLowerCase().includes(q)) return;
      const cat = def.type || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push([key, def]);
    });

    const order = ['trend', 'momentum', 'oscillator', 'volume', 'volatility'];
    const cats = Object.keys(byCategory).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    if (!cats.length) {
      body.innerHTML = `<div class="indicator-picker-empty">No indicators match "${term}"</div>`;
      return;
    }

    body.innerHTML = cats.map(cat => {
      const label = this._pickerCategoryLabels[cat] || (cat.charAt(0).toUpperCase() + cat.slice(1));
      const items = byCategory[cat].slice().sort((a, b) => a[1].name.localeCompare(b[1].name));
      return `
        <div class="indicator-picker-category">
          <div class="indicator-picker-category-label">${label}</div>
          ${items.map(([key, def]) => `<button type="button" class="indicator-picker-item" data-key="${key}">${def.name}</button>`).join('')}
        </div>
      `;
    }).join('');

    body.querySelectorAll('.indicator-picker-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const panelId = this._pickerTargetPanelId;
        if (panelId && key) {
          this.changeIndicator(panelId, key);
        }
        this._pickerModal.hidden = true;
      });
    });
  }

  // Update MA overlays on main chart
  updateMAOverlays(maConfigs = null) {
    if (!this.mainChart || !this.chartData || this.chartData.length === 0) return;

    // Clear existing MA overlays
    this.mainChartOverlays.forEach(series => {
      if (series) {
        this.mainChart.removeSeries(series);
      }
    });
    this.mainChartOverlays.clear();

    // Default MA configurations if none provided — empty by default (managed by overlay panel)
    if (!maConfigs) {
      maConfigs = [];
    }

    // Create MA overlays for each configuration
    maConfigs.forEach((config, index) => {
      const { period, type, color } = config;
      
      // Skip if not enough data
      if (this.chartData.length < period) return;
      
      const maData = this.computeMA(this.chartData, period, type);
      
      if (maData && maData.length > 0) {
        // Create MA overlay series on main chart
        const maSeries = this.mainChart.addLineSeries({
          color: color || this.colors.LINE1,
          lineWidth: 1.5,
          title: `${type}(${period})`,
          priceLineVisible: false,
          crosshairMarkerVisible: false
        });

        // Prepare data with time
        const startIdx = this.chartData.length - maData.length;
        const maChartData = maData.map((value, i) => ({
          time: this.chartData[startIdx + i].time,
          value: value
        }));

        // Set data to series
        maSeries.setData(maChartData);

        // Store the series for cleanup
        this.mainChartOverlays.set(`ma_${type}_${period}`, maSeries);
      }
    });
  }

  // Add MA overlay to main chart
  addMAOverlay(period = 20, type = 'SMA', color = null) {
    if (!this.mainChart || !this.chartData || this.chartData.length === 0) return null;
    
    const maData = this.computeMA(this.chartData, period, type);
    
    if (maData && maData.length > 0) {
      const maSeries = this.mainChart.addLineSeries({
        color: color || this.colors.LINE1,
        lineWidth: 1.5,
        title: `${type}(${period})`,
        priceLineVisible: false,
        crosshairMarkerVisible: false
      });

      const startIdx = this.chartData.length - maData.length;
      const maChartData = maData.map((value, i) => ({
        time: this.chartData[startIdx + i].time,
        value: value
      }));

      maSeries.setData(maChartData);
      
      const key = `ma_${type}_${period}`;
      this.mainChartOverlays.set(key, maSeries);
      
      return key;
    }
    
    return null;
  }

  // Remove specific MA overlay
  removeMAOverlay(key) {
    const series = this.mainChartOverlays.get(key);
    if (series && this.mainChart) {
      this.mainChart.removeSeries(series);
      this.mainChartOverlays.delete(key);
      return true;
    }
    return false;
  }

  destroy() {
    this.panels.forEach(panel => {
      if (panel.chart) {
        panel.chart.remove();
      }
    });
    this.panels.clear();

    // Clear main chart overlays
    this.mainChartOverlays.forEach(series => {
      if (series) {
        this.mainChart.removeSeries(series);
      }
    });
    this.mainChartOverlays.clear();
  }


  // ===============================================
  // PROF. WANG INDICATOR IMPLEMENTATIONS
  // ===============================================

  // --- Volume RSI (Prof. Wang 2026-03-08): RSI of volume on up/down days ---
  computeVolumeRSI(data, period = 10, esp = 9) {
    const close = data.map(d => d.close);
    const vol = data.map(d => (d.volume != null ? Number(d.volume) : 0));
    const len = close.length;
    const VolRSI = new Array(len).fill(null);
    const eVolRSI = new Array(len).fill(null);
    if (len < 2 || period < 1) return { volRsi: VolRSI, eVolRsi: eVolRSI };

    const fn = (typeof window !== 'undefined' && window.VolumeRSI) ? window.VolumeRSI : null;
    if (fn) {
      const out = fn(close, vol, period, esp);
      return { volRsi: out.VolRSI, eVolRsi: out.eVolRSI };
    }
    // Inline implementation (same algorithm as Wang_design_new_indicators__VolumeRSI_2026-03-08.js)
    const dif = new Array(len);
    dif[0] = NaN;
    for (let i = 1; i < len; i++) dif[i] = close[i] - close[i - 1];
    let sum_Up = 0, sum_Dn = 0;
    for (let i = 1; i <= period; i++) {
      if (dif[i] > 0) sum_Up += vol[i]; else sum_Dn += vol[i];
    }
    VolRSI[period] = (sum_Up + sum_Dn === 0) ? 100 : (sum_Up / (sum_Up + sum_Dn)) * 100;
    eVolRSI[period] = VolRSI[period];
    for (let i = period + 1; i < len; i++) {
      if (dif[i] > 0) sum_Up += vol[i]; else sum_Dn += vol[i];
      if (dif[i - period] > 0) sum_Up -= vol[i - period]; else sum_Dn -= vol[i - period];
      VolRSI[i] = (sum_Up + sum_Dn === 0) ? 100 : (sum_Up / (sum_Up + sum_Dn)) * 100;
      eVolRSI[i] = ((esp - 1) / (esp + 1)) * eVolRSI[i - 1] + (2 / (esp + 1)) * VolRSI[i];
    }
    return { volRsi: VolRSI, eVolRsi: eVolRSI };
  }

  renderVolumeRSI(chart, data, colors, seriesMap) {
    if (!data || !data.volRsi || !data.eVolRsi) return;
    if (!seriesMap.has('volRsi')) {
      seriesMap.set('volRsi', chart.addLineSeries({
        color: colors.LINE1,
        lineWidth: 2,
        title: 'Vol RSI',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('eVolRsi', chart.addLineSeries({
        color: colors.LINE2,
        lineWidth: 2,
        title: 'eVol RSI',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('volRsi_ob', chart.addLineSeries({
        color: '#666666',
        lineWidth: 1,
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
      seriesMap.set('volRsi_os', chart.addLineSeries({
        color: '#666666',
        lineWidth: 1,
        lineStyle: 2,
        title: '',
        crosshairMarkerVisible: false,
        priceLineVisible: false
      }));
    }
    const volRsiData = this.seriesWithLeadInPadding(data.volRsi, (v) => (v != null && !isNaN(v) ? v : null));
    const eVolRsiData = this.seriesWithLeadInPadding(data.eVolRsi, (v) => (v != null && !isNaN(v) ? v : null));
    const obData = this.seriesWithLeadInPadding(data.volRsi, (v) => (v != null && !isNaN(v) ? 70 : null));
    const osData = this.seriesWithLeadInPadding(data.volRsi, (v) => (v != null && !isNaN(v) ? 30 : null));
    seriesMap.get('volRsi').setData(volRsiData);
    seriesMap.get('eVolRsi').setData(eVolRsiData);
    seriesMap.get('volRsi_ob').setData(obData);
    seriesMap.get('volRsi_os').setData(osData);
  }

  // --- Wang RSI ---
  computeWangRSI(data, period) {
    if (!window.WangIndicators) {
      console.warn('WangIndicators not available');
      return [];
    }
    const closes = data.map(d => d.close);
    const result = window.WangIndicators.computeRSI(closes, period);
    console.log(`Wang RSI computed: ${result.length} values`);
    return result;
  }

  renderWangRSI(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) {
      console.warn('Wang RSI render: No data');
      return;
    }
    console.log(`Wang RSI render: Rendering ${data.length} points`);
    
    // Create Series if not exists
    if (!seriesMap.has('rsi')) {
      seriesMap.set('rsi', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'Wang RSI' }));
      // Reference lines
      seriesMap.set('ob', chart.addLineSeries({ color: colors.UP, lineWidth: 1, lineStyle: 2, title: '80' }));
      seriesMap.set('os', chart.addLineSeries({ color: colors.DOWN, lineWidth: 1, lineStyle: 2, title: '20' }));
    }

    const rsiData = this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null));
    seriesMap.get('rsi').setData(rsiData);
    
    // Set Constant Lines (fill entire chart range)
    const fullRange = this.chartData.map(d => d.time);
    seriesMap.get('ob').setData(fullRange.map(t => ({ time: t, value: 80 })));
    seriesMap.get('os').setData(fullRange.map(t => ({ time: t, value: 20 })));
  }

  renderWangBBI(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) return;

    if (!seriesMap.has('bbi')) {
      seriesMap.set('bbi', chart.addLineSeries({ color: '#f06292', lineWidth: 2, title: 'BBI' }));
    }

    seriesMap.get('bbi').setData(this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null)));
  }

  // --- Wang CCI ---
  computeWangCCI(data, period) {
    if (!window.WangIndicators) return [];
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeCCI(highs, lows, closes, period);
  }

  renderWangCCI(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) return;

    if (!seriesMap.has('cci')) {
      seriesMap.set('cci', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'CCI' }));
    }

    seriesMap.get('cci').setData(this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null)));
  }

  // --- Wang BBI3 ---
  computeWangBBI3(data, d1, d2, d3) {
    if (!window.WangIndicators) return [];
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeBBI3(closes, d1, d2, d3);
  }

  renderWangBBI3(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) return;
    if (!seriesMap.has('bbi3')) {
      seriesMap.set('bbi3', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'BBI-3' }));
    }
    seriesMap.get('bbi3').setData(this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null)));
  }

  // --- Wang BBI4 ---
  computeWangBBI4(data, d1, d2, d3, d4) {
    if (!window.WangIndicators) return [];
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeBBI4(closes, d1, d2, d3, d4);
  }

  renderWangBBI4(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) return;
    if (!seriesMap.has('bbi4')) {
      seriesMap.set('bbi4', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'BBI-4' }));
    }
    seriesMap.get('bbi4').setData(this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null)));
  }

  // --- Wang BBI5 ---
  computeWangBBI5(data, d1, d2, d3, d4, d5) {
    if (!window.WangIndicators) return [];
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeBBI5(closes, d1, d2, d3, d4, d5);
  }

  renderWangBBI5(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) return;
    if (!seriesMap.has('bbi5')) {
      seriesMap.set('bbi5', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'BBI-5' }));
    }
    seriesMap.get('bbi5').setData(this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null)));
  }

  // --- Wang OSC ---
  computeWangOSC(data, period) {
    if (!window.WangIndicators) return { osc1: [], osc2: [] };
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeOSC(closes, period);
  }

  renderWangOSC(chart, data, colors, seriesMap) {
    if (!data || !data.osc1 || data.osc1.length === 0) return;
    if (!seriesMap.has('osc1')) {
      seriesMap.set('osc1', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'OSC1' }));
      if (data.osc2) {
        seriesMap.set('osc2', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'OSC2' }));
      }
    }
    seriesMap.get('osc1').setData(this.seriesWithLeadInPadding(data.osc1, (v) => (v != null && !isNaN(v) ? v : null)));
    if (data.osc2 && seriesMap.has('osc2')) {
      seriesMap.get('osc2').setData(this.seriesWithLeadInPadding(data.osc2, (v) => (v != null && !isNaN(v) ? v : null)));
    }
  }

  // --- Wang BIAS ---
  computeWangBIAS(data, d1, d2) {
    if (!window.WangIndicators) return { bias1: [], bias2: [] };
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeBIAS(closes, d1, d2);
  }

  renderWangBIAS(chart, data, colors, seriesMap) {
    if (!data || !data.bias1 || data.bias1.length === 0) return;
    if (!seriesMap.has('bias1')) {
      seriesMap.set('bias1', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'BIAS1' }));
      if (data.bias2) {
        seriesMap.set('bias2', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'BIAS2' }));
      }
    }
    seriesMap.get('bias1').setData(this.seriesWithLeadInPadding(data.bias1, (v) => (v != null && !isNaN(v) ? v : null)));
    if (data.bias2 && seriesMap.has('bias2')) {
      seriesMap.get('bias2').setData(this.seriesWithLeadInPadding(data.bias2, (v) => (v != null && !isNaN(v) ? v : null)));
    }
  }

  // --- Wang MBIAS ---
  computeWangMBIAS(data, d1, d2) {
    if (!window.WangIndicators) return [];
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeMBIAS(closes, d1, d2);
  }

  renderWangMBIAS(chart, data, colors, seriesMap) {
    if (!data || data.length === 0) return;
    if (!seriesMap.has('mbias')) {
      seriesMap.set('mbias', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'MBIAS' }));
    }
    seriesMap.get('mbias').setData(this.seriesWithLeadInPadding(data, (v) => (v != null && !isNaN(v) ? v : null)));
  }

  // --- Wang UOSC ---
  computeWangUOSC(data, maPeriod, num) {
    if (!window.WangIndicators) return { uosc1: [], uosc2: [] };
    const closes = data.map(d => d.close);
    return window.WangIndicators.computeUOSC(closes, maPeriod, num);
  }

  renderWangUOSC(chart, data, colors, seriesMap) {
    if (!data || !data.uosc1 || data.uosc1.length === 0) return;
    if (!seriesMap.has('uosc1')) {
      seriesMap.set('uosc1', chart.addLineSeries({ color: colors.LINE1, lineWidth: 2, title: 'UOSC1' }));
      if (data.uosc2) {
        seriesMap.set('uosc2', chart.addLineSeries({ color: colors.LINE2, lineWidth: 2, title: 'UOSC2' }));
      }
    }
    seriesMap.get('uosc1').setData(this.seriesWithLeadInPadding(data.uosc1, (v) => (v != null && !isNaN(v) ? v : null)));
    if (data.uosc2 && seriesMap.has('uosc2')) {
      seriesMap.get('uosc2').setData(this.seriesWithLeadInPadding(data.uosc2, (v) => (v != null && !isNaN(v) ? v : null)));
    }
  }


  renderHULLMA(chart, data, colors, seriesMap) {
    if (!data || (!data.hullma && !data.ehullma)) return;
    this.renderMultiLine(chart, data, colors, seriesMap, ['hullma', 'ehullma'], ['HMA', 'eHMA']);
  }
}

// Global instance
window.MultiIndicatorSystem = MultiIndicatorSystem;
