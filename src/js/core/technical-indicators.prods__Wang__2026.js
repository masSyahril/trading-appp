/* TradeLite Technical Analysis Indicators */

// Some legacy indicator code references `windows.*` (typo). Alias it to `window` to avoid runtime failures.
var windows = window;

// Exponential Moving Average
function computeEMA(values, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA value is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  ema.push(sum / period);
  
  // Subsequent EMA values
  for (let i = period; i < values.length; i++) {
    const currentValue = values[i];
    const previousEMA = ema[ema.length - 1];
    ema.push(currentValue * multiplier + previousEMA * (1 - multiplier));
  }
  
  return ema;
}

// Moving Average(Simple Moving Average)
function computeMA(values, Ma_day) { 
  // Ma_day = 5,10,20 etc. Values is an array of closing prices
  const MA = []; // MA array, if Ma_day=10 then MA[]=10,11,...,2000
  let sum = 0;
  //for (let i = 0; i < Ma_day; i++) { // Calculate first MA value
  for (let i = 1; i <= Ma_day; i++) { // Calculate first MA value
    sum += values[i];  // Sum of first Ma_day values
  }
  // MA.push(sum / Ma_day); // First MA value
  MA[Ma_day] = sum / Ma_day;  // First MA value, MA[10] = sum/10 if Ma_day=10
  for (let i = Ma_day +1; i <= values.length; i++) {  //i=11 to 2000 if Ma_day=10
    sum=sum-values[i-Ma_day]+values[i];   //subtract the old value and add the new value
    MA[i]=sum/Ma_day;
  }
  return MA;
  // Drawing the MA figure in the K-line area.
  // For example, if Ma_day=10, then MA[]=10,11,...,2000.
}

// MACD (Moving Average Convergence Divergence)
function computeMACD(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = computeWangEMA(values, fastPeriod);  // sparse 1-based, valid [fastPeriod..values.length-1]
  const slowEMA = computeWangEMA(values, slowPeriod);  // sparse 1-based, valid [slowPeriod..values.length-1]

  // Build dense MACD: both EMAs are valid from slowPeriod onward
  const macd = [];
  for (let i = slowPeriod; i < values.length; i++) {
    macd.push(fastEMA[i] - slowEMA[i]);
  }

  // Standard 0-based EMA for signal line (avoids 1-based sparse issue)
  const k = 2 / (signalPeriod + 1);
  const signal = [];
  let emaVal = 0;
  for (let i = 0; i < macd.length; i++) {
    if (i < signalPeriod) {
      emaVal += macd[i] / signalPeriod;
      if (i === signalPeriod - 1) signal.push(emaVal);
    } else {
      emaVal = k * macd[i] + (1 - k) * emaVal;
      signal.push(emaVal);
    }
  }

  // Histogram aligned with signal (signal is shorter than macd by signalPeriod-1)
  const offset = macd.length - signal.length;
  const hist = signal.map((s, i) => macd[offset + i] - s);

  return { macd, signal, hist };
}

// RSI (Relative Strength Index) - Window-Sum Method
/**
 * Compute RSI series for one RSI period using the window-sum method.
 * This method uses a fixed window of gains and losses (sliding window approach).
 *
 * Input:
 *   values: Array of close prices (number). Index 0 is first record.
 *   period: RSI period (integer, e.g. 14)
 *
 * Output:
 *   Array of same length as values. Elements are:
 *     - null for indices where RSI cannot be computed (insufficient history)
 *     - RSI value (0..100) for indices where it can
 *
 * Notes:
 *   - We compute diffs as close[i] - close[i-1], for i >= 1.
 *   - For a diff > 0 => gain = diff, loss = 0
 *     For a diff < 0 => gain = 0, loss = -diff (positive)
 *   - Initial sums (U and D) are sums for the first `period` diffs
 *     (i.e. diffs from index 1 .. period)
 *   - RSI at position `period` (0-based index) corresponds to the first
 *     time we have `period` diffs: that's values index `period`
 *   - On each step we add current gain/loss and subtract the gain/loss
 *     that leaves the window.
 *   - If (U + D) === 0 we return 100 (per the handwritten note).
 */

//===designed by Prof Wang, 2026-Feb-24===重新設計==Original design date 2025-Oct-20====
// RSI相對強弱指標(RSI, Relative Strength Index)
// eRSI完全自創指標,completely self-created indicators. 
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function computeRSI(K_close, RSI_day, esp) {
  // K_close=STK_close, RSI_day=5,10,15,...,  例：esp=9
  // First calculate RSI
  const RSI=[], eRSI=[];
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<K_close.length; i++) {
    dif[i]=K_close[i]-K_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  eRSI[RSI_day+1]=RSI[RSI_day+1]   //eRSI的初值=eRSI[11]
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];
    //eRSI新=(n-1)/(n+1)*eRSI舊+2/(n+1)*RSI新
  }
  //==========此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  return RSI, eRSI;
  // if RSI_day=10 then RSI and eRSI=11,12,...,2000.
  //drawing the RSI and eRSI figures in the small windows.
}
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-22===modified on 2026-April-08==
//AR人氣指標、BR意願指標。AR()=sum(H-O)/sum(O-L) 。BR()=sum(H-C)/sum(C-L)
function ARBR( STK_open, STK_high, STK_low, STK_close, ARBR_day) {
  // Menu Name: ARBR       // ARBR_day=10, 20
  const AR=[], BR=[];
  //let HO, OL, HC, CL; //this is wrong! HO, OL, HC, CL are arrays, not single variables.
  const HO=[], OL=[], HC=[], CL=[];
  for(let i=1; i<STK_close.length; i++) {  // i=1,2,...,2000
    HO[i]= STK_high[i] - STK_open[i];
    OL[i]= STK_open[i] - STK_low[i];
    HC[i]= STK_high[i] - STK_close[i];
    CL[i]= STK_close[i] - STK_low[i];  }
  let tp_HO = 0, tp_OL = 0, tp_HC = 0, tp_CL = 0;
  for(let i=1; i<ARBR_day; i++) {    // i=1,2,...,10
     tp_HO = tp_HO + HO[i];
     tp_OL = tp_OL + OL[i];
     tp_HC = tp_HC + HC[i];
     tp_CL = tp_CL + CL[i]; }
  // let AR, BR = ARBR_day; this is wrong !!!
  AR[ARBR_day] = tp_HO/tp_OL;
  BR[ARBR_day] = tp_HC/tp_CL;
  for(let i=ARBR_day+1; i<STK_close.length; i++){  // i=11,12,...,2000
    // AR(i) = AR(i-1) * (ARBR_day -1) + HO(i) / OL(i) )/ ARBR_day;
    AR[i]=(tp_HO+HO[i]-HO[i-ARBR_day])/(tp_OL+OL[i]-OL[i-ARBR_day]);
    BR[i]=(tp_HC+HC[i]-HC[i-ARBR_day])/(tp_CL+CL[i]-CL[i-ARBR_day]);
  }
  return { AR, BR };
  //if day=10, AR[], BR[]=10,11,...,2000.
  //drawing the AR[] and BR[] figures in the small windows.
}
window.ARBR = ARBR;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-23===modified on 2026-April-15==
//CR中間意願指標。 CR()=sum(H-MP)/sum(MP-L) 。 MP=(H+2C+L)/4
function CR(STK_high, STK_low, STK_close, CR_day, esp) {
  // Menu Name: CR        //CR_day=10,20,  esp=9 or 10,...
  const CR=[], eCR=[];    //自創的eCR指標, eCR是CR的EMA(esp)指標
  let MP;
  const H_MP=[], MP_L=[];   // 分子=H-MP, 分母=MP-L
  for(let i=2; i<STK_close.length; i++) {   // 2,3,...,2000
    MP = (STK_high[i-1] + 2*STK_close[i-1]+STK_low[i-1])/4;
    H_MP[i] = STK_high[i]-MP;   // 2 to 2000
    MP_L[i] = MP-STK_low[i];    // 2 to 2000
  }
  let sum_H_MP = 0, sum_MP_L = 0;
  for(let i=2; i<CR_day; i++) {  // 2,3,...,CR_day
    sum_H_MP=sum_H_MP+H_MP[i];    //sum_H_MP += H_MP(i)
    sum_MP_L=sum_MP_L+MP_L[i];    //sum_MP_L += MP_L(i)
  }
  // CR = CR_day +1;
  CR[CR_day+1]= sum_H_MP/sum_MP_L;  //first CR values=CR[11]
  eCR[CR_day+1] = CR[CR_day+1];     //first eCR values= eCR[11], 自創
  for(let i=CR_day+2; i<STK_close.length; i++) {  //12,...,2000
    //加新的H-MP, MP-L, 減去舊的H-MP, MP-L
    sum_H_MP = sum_H_MP + H_MP[i] - H_MP[i-CR_day];  // 分子
    sum_MP_L = sum_MP_L + MP_L[i] - MP_L[i-CR_day];  // 分母
    //此式正確：CR[i]=(sum_H_MP+H_MP[i]-H_MP[i-CR_day])/(sum_MP_L+MP_L[i]-MP_L[i-CR_day]); 
    CR[i] = sum_H_MP/sum_MP_L;   // CR[12],...,CR[2000]
    eCR[i]= (esp-1)/(esp+1)*eCR[i-1]+ 2/(esp+1)*CR[i];  // eCR[12],...,eCR[2000]
  }
  return { CR, eCR };
  //if day=10, AR[], BR[], CR[]=11,12,...,2000.
  //drawing the CR[], eCR[] figures in the small windows.
} 
window.CR = CR;
//----------------------------------------------------------------------

// ===designed by Prof Wang, 2025-Oct-26===modified on 2026-April-06==
//BBI多空指標(Bull and Bear Index, BBI) (價的多空指標)
//find the average of three MA values(BBI3)
function BBI3(STK_close, day1, day2, day3){
  // Menu Name: BBI3   //day1=5, day2=10, day3=20
  //STK_close is the closing price of a stock, 
  //day1, day2, day3 are the days of three MAs, such as 5,10,20.
  const BBI3=[];
  const MA1 = KingMA(STK_close, day1);  //check!!
  const MA2 = KingMA(STK_close, day2);
  const MA3 = KingMA(STK_close, day3);
  //compute three MAs, such as MA1, MA2, MA3
  let max_day;
  /*if (day2>max_day){   // 此段程式碼的邏輯有誤
    max_day=day2;  } 
  else if (day3>max_day){
    max_day=day3;  
  } */
  max_day=Math.max(day1, day2, day3);
  // for example day=5,10,20, then max_day=20
  for(let i=max_day; i<STK_close.length; i++) { //例如:i=20 to 2000
    BBI3[i]=(MA1[i]+MA2[i]+MA3[i])/3;    
  }
  //compute RR(Rate-of-Return) and Acc_RR(Accumulate Rate-of-Return)
  //designed by Prof Wang 2026-Nov-30
  let RR=0, Acc_RR=0;
  let buy_price=0;
  let BS_times=0;   //Buy and Sell times累積買賣次數
  if(BBI3[max_day]<STK_close[max_day]) {   //若條件成立，表示買點早已出現
     buy_price=STK_close[max_day]; }
  for(let i=max_day+1; i<STK_close.length; i++) {    //例如:i=21 to 2000
    if(BBI3[i-1]>STK_close[i-1] && BBI3[i]<STK_close[i]) {  //買點
      buy_price=STK_close[i]; }
    else if(BBI3[i-1]<STK_close[i-1] && BBI3[i]>STK_close[i]) {  //賣點
      RR=(STK_close[i]-buy_price)/buy_price*100;
      Acc_RR=Acc_RR+RR;
      BS_times=BS_times+1;    //Buy and Sell times
      console.log(RR);        //該次報酬率
      console.log(Acc_RR);    //累積報酬率
      console.log(BS_times);  //累積買賣次數
    }
  }  
  console.log(Acc_RR);  //print ACC_RR累積報酬率。
  return {STK_close, BBI3, RR, Acc_RR, BS_times};
  //try to draw the BBI3[] and STK_close[] figures in the small windows.
}
window.BBI3=BBI3;  //將BBI3函數放在window物件中，方便在其他地方調用。
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-26===modified on 2026-April-06==
//BBI多空指標(Bull and Bear Index, BBI) (價的多空指標)
//find the average of four MA values(BBI4)===
function BBI4(STK_close, day1, day2, day3, day4){
  // Menu Name: BBI4    //day1=5, day2=10, day3=15, day4=20
  const BBI4=[];
  const MA1 = KingMA(STK_close, day1);
  const MA2 = KingMA(STK_close, day2);
  const MA3 = KingMA(STK_close, day3);
  const MA4 = KingMA(STK_close, day4);
  let max_day = Math.max(day1, day2, day3, day4);
  for(let i=max_day; i<STK_close.length; i++){
    BBI4[i]=(MA1[i]+MA2[i]+MA3[i]+MA4[i])/4;
  }
  //return BBI4();
  
  //compute RR(Rate-of-Return) and Acc_RR(Accumulate Rate-of-Return)
  //designed by Prof Wang 2026-Jan-12
  let RR=0, Acc_RR=0;
  let buy_price=0;
  let BS_times=0;   //Buy and Sell times累積買賣次數
  if(BBI4[max_day]<STK_close[max_day]) {   //若條件成立，表示買點早已出現
    buy_price=STK_close[max_day]; }
  for(let i=max_day+1; i<STK_close.length; i++) {    //例如:i=21 to 2000
    if(BBI4[i-1]>STK_close[i-1] & BBI4[i]<STK_close[i]) {  //買點
      buy_price=STK_close[i]; }
    else if(BBI4[i-1]<STK_close[i-1] & BBI4[i]>STK_close[i]) {  //賣點
      RR=(STK_close[i]-buy_price)/buy_price*100;
      Acc_RR=Acc_RR+RR;
      BS_times=BS_times+1;    //Buy and Sell times
      console.log(RR);        //該次報酬率
      console.log(Acc_RR);    //累積報酬率
      console.log(BS_times);  //累積買賣次數
    }
  }  
  console.log(Acc_RR);  //print ACC_RR累積報酬率。
  return {STK_close, BBI4, RR, Acc_RR, BS_times};
  //try to draw the BBI4[] and STK_close[] figures in the small windows.
}
window.BBI4=BBI4;  //將BBI4函數放在window物件中，方便在其他地方調用。
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-26===modified on 2026-April-07==
//BBI多空指標(Bull and Bear Index, BBI) (價的多空指標)
//find the average of five MA values(BBI5)
function BBI5(STK_close, day1, day2, day3, day4, day5){
  // Menu Name: BBI5   //day1=5, day2=10, day3=15, day4=20, day5=30
  const BBI5=[];
  const MA1 = KingMA(STK_close, day1);
  const MA2 = KingMA(STK_close, day2);
  const MA3 = KingMA(STK_close, day3);
  const MA4 = KingMA(STK_close, day4);
  const MA5 = KingMA(STK_close, day5);
  let max_day = Math.max(day1,day2,day3,day4,day5);
  for(let i=max_day; i<STK_close.length; i++){
    BBI5[i]=(MA1[i]+MA2[i]+MA3[i]+MA4[i]+MA5[i])/5;
  }
  //return BBI5();
  //compute RR(Rate-of-Return) and Acc_RR(Accumulate Rate-of-Return)
  //designed by Prof Wang 2026-Jan-12
  let RR=0, Acc_RR=0;
  let buy_price=0;
  let BS_times=0;   //Buy and Sell times累積買賣次數
  if(BBI5(max_day)<STK_close(max_day)) {   //若條件成立，表示買點早已出現
    buy_price=STK_close(max_day); }
  for(let i=max_day+1; i<STK_close.length; i++) {    //例如:i=21 to 2000
    if(BBI5[i-1]>STK_close[i-1] & BBI5[i]<STK_close[i]) {  //買點
      buy_price=STK_close[i]; }
    else if(BBI5[i-1]<STK_close[i-1] & BBI5[i]>STK_close[i]) {  //賣點
      RR=(STK_close[i]-buy_price)/buy_price*100;
      Acc_RR=Acc_RR+RR;
      BS_times=BS_times+1;    //Buy and Sell times
      console.log(RR);        //該次報酬率
      console.log(Acc_RR);    //累積報酬率
      console.log(BS_times);  //累積買賣次數
    }
  }  
  console.log(Acc_RR);  //print ACC_RR,累積報酬率。
  return {STK_close, BBI5, RR, Acc_RR, BS_times};
  //try to draw the BBI5[] and STK_close[] figures in the small windows.
}
window.BBI5=BBI5;  //將BBI5函數放在window物件中，方便在其他地方調用。
//----------------------------------------------------------------------

//===designed by Prof Wang,v2025-Oct-26===modified on 2026-March-17==
//OSC1與OSC2振盪指標(OSC, Oscillator)。OSC1=C-MA 。 OSC2=C/MA
function OSC(K_close, MA_day) {
  //k_close=STK_close, MA_day=5,10,20
  const OSC1=[], OSC2=[];
  const MA = KingMA(K_close, MA_day);
  for(let i=MA_day; i<K_close.length; i++) {  //i=10 to 2000
    OSC1[i]=K_close[i]-MA[i];
    OSC2[i]=K_close[i]/MA[i];
  }
  return { OSC1, OSC2 };
  //drawing the OSC1[] and OSC2[] figures in the small windows.
  //if MA_day=10, then OSC1[], OSC2[]=10,11,...,2000.
}
window.OSC = OSC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-26==modified on 2026-April-07==
//BIAS乖離率，BIAS=(C-MA)/MA*100. 自創的eBIAS. esp=9,10,...
function BIAS(STK_close, day, esp) {
  //day=5, =10, ..., esp=9,10,.... 
  // esp is the parameter for the exponential moving average, 
  // which is not used in this function.   // It can be set to 0 or any value 
  // as it does not affect the calculation of BIAS.
  const BIAS=[], eBIAS=[];  //自創的eBIAS陣列，初始為空陣列。
  const MA1 = KingMA(STK_close,day);
  for(let i=day; i<STK_close.length; i++) {
    BIAS[i]=(STK_close[i]/MA1[i]-1)*100;
    if(i==day) { //the first day of BIAS calculation, eBIAS is the same as BIAS.
      eBIAS[i]=BIAS[i]; }
    else {
      eBIAS[i]=(esp-1)/(esp+1)*eBIAS[i-1]+2/(esp+1)*BIAS[i];
    }
  }
  return { BIAS, eBIAS };
  //drawing the BIAS and eBIAS figures in the small windows.
  //if day=10 then BIAS[], eBIAS[]=10,11,...,2000
}
window.BIAS = BIAS;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-26==modified on 2026-April-07==
//MBIAS移動平均乖離差, MBIAS=MA1-MA2, (楊本p-122)
//本人改名為MABIAS。自創eMABIAS。esp為平滑係數，通常取值為10或20。
function MABIAS(STK_close, day1, day2, esp) {
  //esp=9,10,...
  const MABIAS=[], eMABIAS=[];
  let tepm;
  if(day1<day2){  //確保day1>day2
    tepm=day2; 
    day2=day1; 
    day1=tepm; }
  const MA1 = KingMA(STK_close, day1); //day1較大
  const MA2 = KingMA(STK_close, day2);
 for(let i=day1; i<STK_close.length; i++){
   MABIAS[i]=MA2[i]-MA1[i];   //短期MA2減去長期MA1
   if(i==day1) {
     eMABIAS[i]=MABIAS[i]; }  //初值,自創eMABIAS
   else {
     eMABIAS[i]=(esp-1)/(esp+1)*eMABIAS[i-1]+(2/(esp+1))*MABIAS[i];
   }
 }
  return {MABIAS, eMABIAS};
  //drawing the MABIAS and eMABIAS figures in the small windows.
  //if day1=10, then MABIAS[],eMABIAS[]=10,11,...,2000.
}
window.MABIAS = MABIAS; //將MABIAS函數放在windows物件中，方便在其他地方調用。
//----------------------------------------------------------------------

//===designed by Prof Wang,v2025-Oct-26===modified on 2026-March-17==
//UOSC終極振盪指標(UOSC, Ultimate Oscillator)
//UOSC1=[sum(C-MA)]/m 。 UOSC2=[sum(C/MA)]/m
function UOSC(K_close, MA_day, UOSC_num) {
  //K_close=STK_close, for example: MA_day=10, UOSC_num=10
  const UOSC1=[], UOSC2=[];
  const OSC1=[], OSC2=[];
  const MA = KingMA(K_close, MA_day);
  for(let i=MA_day; i<K_close.length; i++) {  //i=10 to 2000
    OSC1[i] = K_close[i]-MA[i]; //傳統表示法, =10,11,...,2000. //比較大
    OSC2[i] = K_close[i]/MA[i]; //自創表示法, =10,11,...,2000. //比較小
  }
  let sum1 = 0;
  let sum2 = 0;
  for(let i=MA_day; i<MA_day+UOSC_num-1; i++) { //i=10 to 10+10-1=19
    sum1 += OSC1[i];
    sum2 += OSC2[i];
  }
  //first UOSC1, UOSC2 values, for example: UOSC1(19), UOSC2(19)
  UOSC1[MA_day+UOSC_num-1] = sum1/UOSC_num;
  UOSC2[MA_day+UOSC_num-1] = sum2/UOSC_num;
  for(let i=MA_day+UOSC_num; i<K_close.length; i++) {  //i=20 to 2000
    //扣除10天前的OSC1、OSC2值，加入新的OSC1、OSC2值
    sum1 += OSC1[i] - OSC1[i-UOSC_num];  //20-10=10
    sum2 += OSC2[i] - OSC2[i-UOSC_num];
    UOSC1[i] = sum1/UOSC_num;   //比較大
    UOSC2[i] = sum2/UOSC_num;   //比較小
  }
  return { UOSC1, UOSC2 };
  //drawing the UOSC1[] and UOSC2[] figures in the small windows.
  //if MA_day=10, UOSC_num=10, UOSC1[], UOSC2[]=19,20,...,2000.
}
window.UOSC = UOSC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01=================================
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//只繪圖KD指標的K、D線。KD_K[]、KD_D[]。
//esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
function KD_KD(K_high, K_low, K_close, KD_day) {
  // Menu Name: KD_KD        //原創：KD_day=9, esp=9,10,...
  //K_high=STK_high, K_low=STK_low, K_close=STK_close
  const KD_K=[], KD_D=[];
  //const KD_K2=[], KD_D2=[];
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    let maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    let minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50; }
      //KD_K2[i] = 50;      //i=9, KD_K2初值
      //KD_D2[i] = 50; }    //i=9, KD_D2初值
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      //KD_K2[i]=(esp-1)/(esp+1)*KD_K2[i-1] +2/(esp+1)*KD_K[i];
      //KD_D2[i]=(esp-1)/(esp+1)*KD_D2[i-1] +2/(esp+1)*KD_D[i];
    }
  }
  return { KD_K, KD_D };
  //drawing the KD_K[] and KD_D[] figures in the small windows.
  //if KD_day=9, KD_K[], KD_D[]=9,10,...,2000.
}
window.KD_KD = KD_KD;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01=================================
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//<<完全自創指標,completely self-created indicators >> 
function KD_K2D2(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: KD_K2D2     // KD_K2D2指標, KD_day=9, esp=9
  // Output: KD_K2[], KD_D2[]
  // 一般KD_day=9天, 對KD_K與KD_D指數平滑,取參數esp=9,之後取名KD_K2與KD_D2
  const KD_K=[], KD_D=[];
  const KD_K2=[], KD_D2=[];
  let maxHigh, minLow=0;
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50; 
      KD_K2[i] = 50;      //i=9, KD_K2初值
      KD_D2[i] = 50; }    //i=9, KD_D2初值
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      KD_K2[i]=(esp-1)/(esp+1)*KD_K2[i-1] +2/(esp+1)*KD_K[i];
      KD_D2[i]=(esp-1)/(esp+1)*KD_D2[i-1] +2/(esp+1)*KD_D[i];
    }
  }
  return { KD_K2, KD_D2 };
  //drawing the KD_K2[] and KD_D2[] figures in the small windows.
  //if KD_day=9, KD_K2[], KD_D2[]=9,10,...,2000.
}
window.KD_K2D2 = KD_K2D2;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01=================================
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//<<完全自創指標,completely self-created indicators >> 
//esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
function KD_K2(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: KD_K2        //原創：KD_day=9, esp=9,10,...
  // K_high=STK_high, K_low=STK_low, K_close=STK_close
  const KD_K=[], KD_D=[];
  const KD_K2=[], KD_D2=[];
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    let maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    let minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50; 
      KD_K2[i] = 50;      //i=9, KD_K2初值
      KD_D2[i] = 50; }    //i=9, KD_D2初值
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      KD_K2[i]=(esp-1)/(esp+1)*KD_K2[i-1] +2/(esp+1)*KD_K[i];
      KD_D2[i]=(esp-1)/(esp+1)*KD_D2[i-1] +2/(esp+1)*KD_D[i];
    }
  }
  return { KD_K, KD_K2 };
  //drawing the KD_K[] and KD_K2[] figures in the small windows.
  //if KD_day=9, KD_K[], KD_K2[]=9,10,...,2000.
}
window.KD_K2 = KD_K2;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01=================================
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//<<完全自創指標,completely self-created indicators >> 
//esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
function KD_D2(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: KD_D2     // KD_D2指標, KD_day=9, esp=9
  // Output: KD_D[], KD_D2[]
  // 一般KD_day=9天, 對KD_D指數平滑,取參數esp=9,之後取名KD_D2
  const KD_K=[], KD_D=[];
  const KD_K2=[], KD_D2=[];
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    let maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    let minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50; 
      KD_K2[i] = 50;      //i=9, KD_K2初值
      KD_D2[i] = 50; }    //i=9, KD_D2初值
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      KD_K2[i]=(esp-1)/(esp+1)*KD_K2[i-1] +2/(esp+1)*KD_K[i];
      KD_D2[i]=(esp-1)/(esp+1)*KD_D2[i-1] +2/(esp+1)*KD_D[i];
    }
  }
  return { KD_D, KD_D2 };
  //drawing the KD_D[] and KD_D2[] figures in the small windows.
  //if KD_day=9,  KD_D[],KD_D2[]=9,10,...,2000.
}
window.KD_D2 = KD_D2;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01=================================
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//<<完全自創指標,completely self-created indicators >> 
//esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
function KD_D2(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: KD_D2     // KD_D2指標, KD_day=9, esp=9
  // Output: KD_D[], KD_D2[]
  // 一般KD_day=9天, 對KD_D指數平滑,取參數esp=9,之後取名KD_D2
  const KD_K=[], KD_D=[];
  const KD_K2=[], KD_D2=[];
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    let maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    let minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50; 
      KD_K2[i] = 50;      //i=9, KD_K2初值
      KD_D2[i] = 50; }    //i=9, KD_D2初值
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      KD_K2[i]=(esp-1)/(esp+1)*KD_K2[i-1] +2/(esp+1)*KD_K[i];
      KD_D2[i]=(esp-1)/(esp+1)*KD_D2[i-1] +2/(esp+1)*KD_D[i];
    }
  }
  return { KD_D, KD_D2 };
  //drawing the KD_D[] and KD_D2[] figures in the small windows.
  //if KD_day=9,  KD_D[],KD_D2[]=9,10,...,2000.
}
window.KD_D2 = KD_D2;
//-----------------------------------------------------

//===designed by Prof Wang, 2026-April-15=================================
//與下列指標相同：Stochastic Oscillator隨機震盪指標,類似KD隨機指標.0<=K,D<=100
//<<enewD完全自創指標,completely self-created indicators>>
//newK=EMA(rsv, n),  newD=EMA(newK, n),  enewD=EMA(newD, n)
//指數平滑移動平均參數exponential smoothing parameter(esp)
//<係數不用原來的 2/3, 1/3>
function NewKD(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: NewKD      //New隨機震盪指標
  // KD_day=9, esp=9,10,
  const newK=[], newD=[], enewD=[];
  //當KD_day=9時, new_K[9]已經有值了,所以要在KD_day-1=8給new_D[8]初值=50
  newK[KD_day-1] = 50;   //newK[8]初值
  newD[KD_day-1] = 50;   //newD[8]初值,對newK再指數平滑移動平均
  enewD[KD_day-1] = 50;  //enewD[8]初值,對newD再指數平滑移動平均
  //enewD指標是"Stochastic Oscillator隨機震盪指標" 沒有的！
  let rsv;
  let maxHigh, minLow=0;
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    /*if(i === KD_day) {  //i=9, KD初值
      newK[i] = 50;     //i=9, 初值
      newD[i] = 50;     //i=9, 初值
      enewD[i] = 50; }  //i=9, 初值
    else {  */
      //KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      //KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      //<係數不用原來的 2/3, 1/3>
      newK[i]=(esp-1)/(esp+1)*newK[i-1] +2/(esp+1)*rsv;       //newK=EMA(rsv, n)
      newD[i]=(esp-1)/(esp+1)*newD[i-1] +2/(esp+1)*newK[i];   //newD=EMA(newK, n)
      enewD[i]=(esp-1)/(esp+1)*enewD[i-1] +2/(esp+1)*newD[i]; //enewD=EMA(newD, n),自創,新增
    //}
  }
  return { newK, newD, enewD };
  //drawing the newK[], newD[], enewD[] figures in the small windows. 
  //if KD_day=9, KD_K[], KD_D[]=8,9,,...,2000.
}
window.NewKD = NewKD;
//-----------------------------------------------------

//===designed by Prof Wang, 2026-April-15=================================
//KD隨機指標離差(KD Stochastic Indicator deviation), diffKD=newK-newD
//模仿：NVR指標, NVR is the difference between K and D
//模仿：New KD隨機指標(New Stochastic Indicator)	
//與下列指標相同：Stochastic Oscillator隨機震盪指標,類似KD隨機指標.0<=K,D<=100
//<<enewD完全自創指標,completely self-created indicators>>
//newK=EMA(rsv, n),  newD=EMA(newK, n),  enewD=EMA(newD, n)
//指數平滑移動平均參數exponential smoothing parameter(esp)
//<係數不用原來的 2/3, 1/3>
function diffKD(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: diffKD      //KD隨機指標離差
  // KD_day=9, esp=9,10,
  const newK=[], newD=[]; //enewD=[];
  const diffKD=[];        //diffKD=newK-newD, =9 to 2000
  const ediffKD=[];       //ediffKD=EMA(diffKD,n), =9 to 2000
  //當KD_day=9時, new_K[9]已經有值了,所以要在KD_day-1=8給new_D[8]初值=50
  newK[KD_day-1] = 50;   //newK[8]初值
  newD[KD_day-1] = 50;   //newD[8]初值,對newK再指數平滑移動平均
  //enewD[KD_day-1] = 50;  //enewD[8]初值,對newD再指數平滑移動平均
  //enewD指標是"Stochastic Oscillator隨機震盪指標" 沒有的！
  let rsv;
  let maxHigh, minLow=0;
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    //<係數不用原來的 2/3, 1/3>
    newK[i]=(esp-1)/(esp+1)*newK[i-1] +2/(esp+1)*rsv;       //newK=EMA(rsv, n)
    newD[i]=(esp-1)/(esp+1)*newD[i-1] +2/(esp+1)*newK[i];   //newD=EMA(newK, n)
    //enewD[i]=(esp-1)/(esp+1)*enewD[i-1] +2/(esp+1)*newD[i]; //enewD=EMA(newD,n),自創,新增
    diffKD[i]=newK[i]-newD[i];  //diffKD=newK-newD,自創,新增
    if(i===KD_day) {            //當i=9時, diffKD[9]才有值了
      ediffKD[KD_day]=diffKD[KD_day]; } //對newK-newD的離差diffKD再指數平滑移動平均
    else {
      ediffKD[i]=(esp-1)/(esp+1)*ediffKD[i-1] +2/(esp+1)*diffKD[i];
    }
  }
  return { diffKD, ediffKD };
  //drawing the diffKD[] and ediffKD[] figures in the small windows. 
  //if KD_day=9, diffKD[] and ediffKD[]=9,10,...,2000.
}
window.diffKD = diffKD;
//-----------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01=================================
//ＮＶＲ指標。公式：ＮＶＲ＝Ｋ－Ｄ之差值
//esp, 平滑的天數: exponential smoothing parameter(esp)
function NVR(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: NVR        //KD_day=9, esp=9
  // K_high=STK_high, K_low=STK_low, K_close=STK_close
  // eNVR -->> esp=9
  // 下列程式是計算KD值
  const KD_K = [], KD_D = [];
  const NVR=[];    // NVR=K-D
  const eNVR=[];   //指數平滑NVR=eNVR
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    let maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    let minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]); 
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50;
      NVR[i]=KD_K[i]-KD_D[i];  //初值 NVR(9)=0
      eNVR[i]=NVR[i]; }        //初值 eNVR(9)=NVR(9)=0
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      NVR[i]=KD_K[i]-KD_D[i];
      eNVR[i]=(esp-1)/(esp+1)*eNVR[i-1]+2/(esp+1)*NVR[i];
    }
  }
  return { NVR, eNVR };
  //drawing the NVR[] and eNVR[] figures in the small windows.
  //if KD_day=9,  NVR[9], eNVR[9]=9,10,...,2000.
}
window.NVR = NVR;
//-----------------------------------------------------

//===designed by Prof Wang, 2026-March-16=================================
//Stochastic Oscillator隨機震盪指標,類似KD隨機指標.0<=K,D<=100
//<<eStoch_D完全自創指標,completely self-created indicators >> 
//指數平滑移動平均參數exponential smoothing parameter(esp)
function StochasticOSC(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: Stochastic Osc      //隨機震盪指標
  // KD_day=9, esp=9,10,
  const Stoch_K=[], Stoch_D=[], eStoch_D=[];
  //當KD_day=9時, Stoch_K[9]已經有值了,所以要在KD_day-1=8給Stoch_D[8]初值=50
  Stoch_D[KD_day-1] = 50;   //Stoch_D[8]初值
  eStoch_D[KD_day-1] = 50;  //eStoch_D[8]初值,對Stoch_D再指數平滑移動平均
  let maxHigh, minLow=0;
  for(let i=KD_day; i<K_close.length; i++) {   // i=9 to 2000
    maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    //let rsv;    //由Stoch_K[i]取代rsv
    if(maxHigh === minLow) {
      Stoch_K[i] = 100; }   //此處的Stoch_K[i]=原來的rsv
    else {
      Stoch_K[i]=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    Stoch_D[i] = (esp-1)/(esp+1)*Stoch_D[i-1] + 2/(esp+1)*Stoch_K[i];
    eStoch_D[i] = (esp-1)/(esp+1)*eStoch_D[i-1] + 2/(esp+1)*Stoch_D[i];
  }
  return { Stoch_K, Stoch_D, eStoch_D };
  //drawing the Stoch_K[], Stoch_D[] and eStoch_D[] figures in the small windows.
  //if KD_day=9, Stoch_K[], Stoch_D[], eStoch_D[]=9,10,...,2000.
}
window.StochasticOSC = StochasticOSC;
//-----------------------------------------------------

//===designed by Prof Wang, 2025-Oct-29===modified on 2026-April-07==
//Williams %R 威廉指標(William’s Overbought/Oversold Index)。
//WilliamR=(Hn-Ct)/(Hn-Ln)*100.
function WilliamR(STK_high, STK_low, STK_close, WR_day) {
  //STK_high, STK_low, STK_close,  WR_day=10,15,... 天數
  const WilliamR=[];
  for(let i=0; i<STK_close.length-WR_day+1; i++) { // i=0 to 2000-10+1=1991
    let Max_high=0;
    let Min_low=9999;   // initial value can not be zero
    for(let j=i; j<=WR_day+i-1; j++) {
      if (STK_high[j]>Max_high) Max_high=STK_high[j];
      if (STK_low[j]<Min_low) Min_low=STK_low[j];
    }
    if(Max_high==Min_low) {
      WilliamR[WR_day+i-1]=100; }
    else {
      WilliamR[WR_day+i-1]=(Max_high-STK_close[WR_day+i-1])/(Max_high-Min_low)*100; 
    }
  }
  return { WilliamR };
  //drawing the WilliamR[] figure in the small windows.
  //if WR_day=9 then WilliamR[]=9,10,...,2000.
}
window.WilliamR = WilliamR;
//----------------------------------------------------------------------

//重新設計===designed by Prof Wang, 2026-March-12======
//原來設計==Original design date 2025-Oct-30====
//ATR均幅指標(ATR, Average True Range) indicator.
//ATR[]=TR的指數平滑移動平均
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ATR(STK_high, STK_low, STK_close, esp) {
  // for example: esp=9 
  const ATR=[]; //ATR[]=TR的指數平滑移動平均
  const TR=[];  //TR=真實波幅(True Range),TR是陣列不是變數
  let temp1, temp2, temp3;
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR[i] = Math.max(temp1, temp2, temp3);
    if(i===2) {
      ATR[2]=TR[2]; }  //ATR[2]=TR,因為i=2才開始計算TR,所以ATR[2]=TR.
    else {
      ATR[i]=(esp-1)/(esp+1)*ATR[i-1]+2/(esp+1)*TR[i];
    }
  }
  return { TR, ATR };
  // drawing the TR[] and ATR[] figures in the small windows.
  // TR[], ATR[]=2,3,...,2000.
}
window.ATR = ATR;
//----------------------------------------------------------------------

// ===designed by Prof Wang, 2025-Oct-30=================================
//此函數先計算simple MA，再計算EMA，所以整個過程都必須先算MA再算EMA。
//所以傳來的資料是原始資料。公式為EMA(t)=(n-1)/(n+1)*EMA(t-1)+2/(n+1)*MA(t)
//EMA(5),6,7,...,2000. 從第5開始到2000.
// Exponential Moving Average(EMA) - Prof Wang's sparse 1-based variant
function computeWangEMA(raw_data, ema_num) {
  const EMA=[];
  let sum=0;
  for(let i=1; i<ema_num; i++) {
    sum=sum+raw_data[i];
  }
  //First EMA value=EMA[ema_num], for example EMA[5]=sum/5=simple MA(5)
  EMA[ema_num]=sum/ema_num;   //第1筆EMA(5)就是移動平均的MA(5)
  for (let i=ema_num+1; i<raw_data.length; i++) {
    sum=sum+raw_data[i]-raw_data[i-ema_num];
    EMA[i]=(ema_num-1)/(ema_num+1)*EMA[i-1]+(2/(ema_num+1))*sum/ema_num;
  }
  return EMA;
  // 如果參數=5，則EMA()=5,6,...,2000. 繪圖在K線區域。
}
//----------------------------------------------------------------------

// ===designed by Prof Wang, 2025-Oct-30=================================
//此函數不必先計算simple MA，而是直接計算EMA。
//因為傳來的資料不是原始資料，而是已經加工過的資料。
//公式為EMA(t)=(n-1)/(n+1)*EMA(t-1)+2/(n+1)*MA(t)
//Smoothed_MA(1),2,3,...,2000. 從第1開始到2000.
function computeSmoothedAverage(processed_data, smoothed_num) {
  const Smoothed_MA = [];
  Smoothed_MA[1] = processed_data[2]; //set the initial value
  for(let i=2; i<processed_data.length; i++) {
    Smoothed_MA[i]=(smoothed_num-1)/(smoothed_num+1)*Smoothed_MA[i-1]+2/(smoothed_num+1)*processed_data[i];
  }
  return Smoothed_MA;
  // Smoothed_MA()=1,2,...,2000.
}
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Oct-31==modified on 2026-April-08==
//CCI商品通道指標(CCI, Commodity Channel Index)
function CCI(STK_high,STK_low, STK_close, CCI_day) {
  // CCI_day=5,10,20,...200
  const TP = [];   //const typicalPrices, TP=1,2,3,...,2000.
  const CCI = [];
  // Calculate Typical Price(TP), TP[]=1,2,...,2000
  for(let i=1; i<STK_close.length; i++) {
    TP[i]=(STK_high[i]+STK_low[i]+STK_close[i])/3;  //TP=1,2,...,2000
  }
  // Calculate MTP，計算n(CCD_day)日TP平均價, MTP=5,6,...,2000
  let sum=0;
  for(let i=1; i<CCI_day; i++){
    sum=sum+TP[i]; }
  //first MTP value, 例如：CCD_day=5,則第一個MPT為MTP(5)
  const MTP=[];
  MTP[CCI_day]=sum/CCI_day;   //例如MTP[]=5,6,...,2000
  for(let i=CCI_day+1; i<STK_close.length; i++) {   //6,7,...,2000.
    MTP[i]=(sum+TP[i]-TP[i-CCI_day])/CCI_day;    //6,7,...,2000.
  }  
  //計算5日平均價MTP之一階均差MD(Mean Deviation)
  //TP=1,2,...,2000 .  MTP=5,6,...,2000  ,  MD=(5+5-1=9),10,11,...,2000
  const MD=[];
  sum=0;
  for(let i=CCI_day; i<(CCI_day*2-1); i++) {  // i=5,6,7,8,9
    sum=sum+Math.abs(TP[i]-MTP[i]);  }
  MD[CCI_day*2-1]=sum/CCI_day;   //first MD value, MD[]=9.10.11....2000
  for(let i=CCI_day*2; i<STK_close.length; i++) {  // i=10,11,...,2000
    MD[i]=(sum+Math.abs(TP[i]-MTP[i])-Math.abs(TP[i-CCI_day]-MTP[i-CCI_day]))/CCI_day;
  }
  //Calculate CCI[],計算商品通道指標, CCI[], i=9,10,...,2000
  let alpha=0.015;  //常數0.015
  for(let i=CCI_day*2-1; i<STK_close.length; i++) { //i=9,10,...,2000
    CCI[i]=(TP[i]-MTP[i])/(alpha*MD[i]); }  
  return { CCI };    
  //如參數CCI_day=5，則CCI[]=9,10,...,2000.  例如：9=CCI_day*2-1
  //TP[]=1,2,...,2000. MTP[]=5,6,...,2000 , MD[]=(5+5-1=9),10,11,...,2000
}
window.CCI = CCI; 
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Nov-01==modified on 2026-April-08==
//ADI漲跌力道聚散指標。ADI指標的原文是(Accumulation Distribution Index, ADI)
//今日收盤價「大於」昨日收盤價，則今日ADI=昨日ADI＋[今日收盤價－Min(今日最低價，昨日收盤價)]
//否則今日ADI=昨日ADI－[Max(今日最高價，昨日收盤價)－今日收盤價]
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
//eADI()是ADI()的平滑化，即：(n-1)/(n+1)*昨+2/(n+1)*今
function AccuDistIndex(STK_close, STK_low, STK_high, esp) {
  //一般表示為ADI。  esp=9,平滑因子
  const ADI=[];
  const eADI=[];  //自創新
  ADI[1]=0;       //ADI(1)初值=0
  eADI[1]=0;      //eADI(1)初值=0
  for (let i=2; i<STK_close.length; i++) {
    switch (true) {
      case STK_close[i]>STK_close[i-1]:
        ADI[i]=ADI[i-1]+(STK_close[i]-Math.min(STK_low[i],STK_close[i-1]));
        break;
      case STK_close[i]<STK_close[i-1]:
        ADI[i]=ADI[i-1]-(Math.max(STK_high[i],STK_close[i-1])-STK_close[i]);
        break;
      case STK_close[i]===STK_close[i-1]:
        ADI[i]=ADI[i-1]+0;
        break;
    }
    eADI[i]=(esp-1)/(esp+1)*eADI[i-1]+2/(esp+1)*ADI[i];
    //eADI()是ADI()的平滑化，即：(n-1)/(n+1)*昨+2/(n+1)*今
  }
  return { ADI: ADI, eADI: eADI };
  //drawing the ADI[] and eADI[] figures in the small windows.
  //ADI[], eADI[]=2,3,...,2000.
}
window.AccuDistIndex = AccuDistIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Nov-01==modified on 2026-April-08==
//ADO聚散擺盪指標。ADO指標原文是Accumulation/Distribution Oscillator，直譯為「聚散擺盪」指標。
//計算公式如下：ADO＝(BP+SP)/(2*(最高價－最低價))*100。
//其中BP=最高價-開盤價。 SP=收盤盤-最低價
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
function AccuDistOSC(STK_open, STK_high, STK_low, STK_close, esp) { //原名:ADO
  // Menu Name: AccuDistOSC(ADO)
  const ADO=[], eADO=[];  //自創新
  for (let i=1; i<STK_close.length; i++) { //i=1,2,...,2000.
    if (STK_high(i)-STK_low(i)==0) {
      ADO[i]=100;  }
    else {
      ADO[i]=(STK_high[i]-STK_open[i]+STK_close[i]-STK_low[i])/(2*(STK_high[i]-STK_low[i]))*100;
    }
    if(i==1) {
      eADO[i]=ADO[i]; }  //eADO(1)初值=ADO(1)
    else {
      eADO[i]=(esp-1)/(esp+1)*eADO[i-1]+2/(esp+1)*ADO[i];  //自創新
    }
  }  
  return { ADO, eADO };
  //drawing the ADO and eADO figures in the small windows.
  //ADO[], eADO[]=1,2,3,...,2000.
}
window.AccuDistOSC = AccuDistOSC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Nov-01==modified on 2026-April-08==
//VAO成交量聚散擺盪指標。 VAO成交量多空比率淨額指標，直譯為「成交量累積散佈擺盪」指標。
//VAO指標的原文是Volume Accumulation／Distribution Oscillator指標
//VAO=((Close-Low)-(High-Close))/(High-Low)*Volume=(2*Close-High-Low)/(High-Low)*Volume
function VolAccuDistOsc(STK_high, STK_low, STK_close, STK_vol, esp) {  //原名稱:VAO
  // Menu Name=Vol Accu/Dist Osc(VAO)    , esp=9, 平滑化因子
  const VolAccuDistOsc=[], eVolAccuDistOsc=[];  //原名稱:VAO=[];
  for(let i=1; i<STK_close.length; i++){  //=1,2,...,2000.
    //if ((STK_high[i]-STK_low[i]!=0)) {
    //  VAO[i]=(2*STK_close[i]-STK_low[i]-STK_high[i])/(STK_high[i]-STK_low[i])*STK_vol;
    //}
    if (STK_high[i]-STK_low[i]==0) {
      VolAccuDistOsc[i]=0;  }
    else {
      VolAccuDistOsc[i]=(2*STK_close[i]-STK_low[i]-STK_high[i])/(STK_high[i]-STK_low[i])*STK_vol[i];
    }
    if(i==1) {  //i=1,初值=VolAccuDistOsc(1)。
      eVolAccuDistOsc[i]=VolAccuDistOsc[i]; }
    else {
      eVolAccuDistOsc[i]=(esp-1)/(esp+1)*eVolAccuDistOsc[i-1]+2/(esp+1)*VolAccuDistOsc[i];
    }
  }  
  return { VolAccuDistOsc, eVolAccuDistOsc };  //原名稱:VAO
  //drawing the VolAccuDistOsc[] figure in the small windows.
  //VolAccuDistOsc[], eVolAccuDistOsc[]=1,2,3,...,2000. 原名稱:VAO[]
}
window.VolAccuDistOsc = VolAccuDistOsc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Nov-02==modified on 2026-April-09==
// HLO高低價擺盪指標，全名為「High/Low Oscillator」，用來衡量每日價格波動的真實幅度。
//1. TRt=MAX((Ht-Lt), (Ht- Ct-1), (Lt-Ct-1))
//2. HLOt=(Ht-Ct-1)/TRt*100
function HighLowOsc(STK_high, STK_low, STK_close, esp) {  //原名稱:HLO
  // Menu Name=High Low Oscillator  === esp=9, 平滑化因子
  const HLO=[], eHLO=[];   //自創新指標，eHLO[]為平滑化後的數值。
  HLO[1]=50;      //HLO(1)初值=50,適當否？
  eHLO[1]=50;     //eHLO(1)初值=50,適當否？
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    const TR=Math.max(STK_high[i]-STK_low[i], STK_high[i]-STK_close[i-1], Math.abs(STK_low[i]-STK_close[i-1]));
    HLO[i]=(STK_high[i]-STK_close[i-1])/TR*100;
    eHLO[i]=(esp-1)/(esp+1)*eHLO[i-1]+2/(esp+1)*HLO[i];  //自創新指標
    //eHLO[]是HLO[]的平滑化，即：(n-1)/(n+1)*昨+(2/(n+1)*今
  }
  return { HLO, eHLO };
  //drawing the HLO[] and eHLO[] figures in the small windows.
  //HLO[], eHLO[]=2,3,...,2000.
}
window.HighLowOsc = HighLowOsc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Nov-02==modified on 2026-April-09==
//VHF垂直水平過濾指標(Vertical Horizontal Filter Indicator)。(VHF十字過濾線指標)
//1.找出一定計算期間內(N期)的最高收盤價及最低收盤價。HP=N期內最高收盤價，LP=N期內最低收盤價。
//2.取HP與LP之間的價差，作為指標的分子部份。分子=HP–LP。
//3.將計算期內的各日收盤價減去前一日收盤價求其價差，將各日價差皆取絕對值，最後再將其加總，
//此一加總值即為指標的分母部份。分母=Sum of(｜收盤價j－收盤價j-1｜)；j=1 to n。
//4.VHF=分子/分母。一般可取14天或28天。
function VertHoriFilter(STK_close, VHF_day, esp) {  //原名稱:VHF
  // Menu Name=Vertical Horizontal Filter
  // VHF_day=20, 計算期間的天數；esp=9, 平滑化因子
  const VHF=[];
  const eVHF=[]; //自創新指標，名為eVHF，eVHF=（esp-1/esp+1*前一筆eVHF+2/(esp+1)*本筆VHF
  let sum=0;
  for(let i=1; i<STK_close.length-VHF_day+1; i++) { //i=1 to 1981, 例VHF_day=20
    max_close=STK_close[i];  //令第一筆為max
    min_close=STK_close[i];  //令第一筆為min
    for(j=i++; j<=(i+VHF_day-1); j++) {   //例參數VHF_day=20，從2找到20
      if (STK_close[j]>max_close) {
        max_close=STK_close[j]; }        //例參數為20，在1~20找max,min
      if (STK_close[j]<min_close) {
        min_close=STK_close[j];  
      }
      sum=sum+Math.abs(STK_close[j]-STK_close[j-1]);     //累加(今收-昨收)
    }
    VHF[i+VHF_day-1]=Math.abs(max_close-min_close)/sum;  //例第一筆=VHF[20]
    eVHF[i+VHF_day-1]=VHF[i+VHF_day-1];                  //eVHF的第一筆=VHF的第一筆 
    if (i>1) {
      eVHF[i+VHF_day-1]=(esp-1)/(esp+1)*eVHF[i+VHF_day-2]+2/(esp+1)*VHF[i+VHF_day-1];
    }
    sum=0;  //分母的累加要歸零
  }
  return { VHF, eVHF };
  //drawing the VHF and eVHF figures in the small windows.
  //例參數VHF_day=20, VHF[], eVHF[]=20,21,...,2000
}
window.VertHoriFilter = VertHoriFilter;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-16==Modify===============================
//VR成交量比率(VR, Volume Ratio)
//計算式：VR=(UpVol+TtlVol/2)/(DnVol+TtlVol/2)*100
//UpVol為期間內股價上漲日的成交量累積值。DnVol為期間內股價下跌日的成交量累積值。
//TtlVol則為期間內各日成交量的累積值。一般取26日為計算區間。
function VolRatio(STK_close, STK_vol, day, esp) {   //原名=VR
  // Menu Name: Volume Ratio    //原名=VR
  //一般取day=26日為計算區間。// esp=10;平滑的天數exponential smoothing parameter(esp)
  const VolRatio=[], eVolRatio=[];  //自創新
  let UpVol = 0, DnVol = 0, TtlVol = 0;
  //上漲日的成交量累積值UpVol,下跌日的成交量累積值DnVol,期間內各日成交量的累積值TtlVol=0
  // UpVol=STK_vol(1);
  // DnVol=STK_vol(1);
  VolRatio[day]=100;       //初值三個均設為第一天的成交量，此時初值VR=100。VR(20)=100
  eVolRatio[day]=100;      //eVR初值與VR初值相同，供eVR(day+1)遞迴計算使用
  //第一輪先算第一個VR,假設day=20,則j=2 to 21,算出第一個VR(21)
  for(let j=2; j<=(day+1); j++) {          // j=2 to 21 (first round)
    if (STK_close[j]>=STK_close[j-1]) {   //上漲
      UpVol=UpVol+STK_vol[j];  }          //累加第一個上漲成交量STK_vol(2)
    if (STK_close[j]<STK_close[j-1]) {   //下跌
      DnVol=DnVol+STK_vol[j];             //累加第一個下跌成交量STK_vol(2)
    }
    TtlVol=TtlVol+STK_vol[j];             //每天成交量的累積值
  }
  VolRatio[day+1]=(UpVol+TtlVol/2)/(DnVol+TtlVol/2)*100;  //第2個VR(21)
  eVolRatio[day+1]=(esp-1)/(esp+1)*eVolRatio[day]+2/(esp+1)*VolRatio[day+1];
  //第一個平滑eVR(21)。 eVR(21)=(n-1)/(n+1)*eVR(20)+2/(n+1)*VR(21)
  for(let i=2+day; i<STK_close.length; i++) {   //let i=22 to 2000, 設day=20
    //先扣除20天前累積的成交量
    if (STK_close[i-day]>=STK_close[i-day-1]) {  //上漲
      UpVol=UpVol-STK_vol[i-day];  }                //扣除第一個上漲成交量STK_vol(2)
    if (STK_close[i-day]<STK_close[i-day-1]) {  //下跌
      DnVol=DnVol-STK_vol[i-day];                   //扣除第一個下跌成交量STK_vol(2)
    }               
    TtlVol=TtlVol-STK_vol[i-day];                  //扣除第一個每天成交量的累積值
    //例day=20,第一次進入迴圈,let i=22,三個累積值變數要扣除對應的第一個成交量,即STK_vol(2)
    if (STK_close[i]>=STK_close[i-1]) {   //上漲 
      UpVol=UpVol+STK_vol[i];  }          //累加第2個上漲成交量STK_vol(22)
    if (STK_close[i]<STK_close[i-1]) {   //下跌
      DnVol=DnVol+STK_vol[i];             //累加第2個下跌成交量STK_vol(22)
    }  
    TtlVol=TtlVol+STK_vol[i];             //每天成交量的累積值
    VolRatio[i]=(UpVol+TtlVol/2)/(DnVol+TtlVol/2)*100; //第2個VR是VR(22)
    eVolRatio[i]=(esp-1)/(esp+1)*eVolRatio[i-1]+2/(esp+1)*VolRatio[i]; //自創
    //例參數day=20，則第一筆平滑eVR=eVR(21),但第一筆VR=VR(20)
  }
  return { VolRatio, eVolRatio };
  //drawing the VolRatio and eVolRatio figures in the small windows. 
  //normally drawing in K-line area.
  //if day=20, VolRatio[]=20,21,...,2000, eVolRatio[]=21,22,...,2000.
}
window.VolRatio = VolRatio;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Nov-08===modify on 2026-March-14====
//DEMA指標(Double Exponential Moving Average)
//DEMA＝2*(N日EMA)－(N日EMA)的EMA。即：DEMA=2*EMA-EMA(EMA).
function DEMA(STK_close, esp) {
  //Menu Name: DEMA  ,指數平滑移動平均參數esp=9, 10, 20, 30
  const EMA=[], DEMA=[];
  //計算第一個EMA[], DEMA[]
  let yesterday_doubleEMA; //昨天的doubleEMA
  let today_doubleEMA;     //今天的doubleEMA
  let sum=0;
  for(let i=1; i<esp; i++) {   //例如：i=1 to 20
    sum=sum+STK_close[i];
  }
  EMA[esp]=sum/esp;    //第一個EMA(20)
  DEMA[esp]=sum/esp;   //第一個DEMA(20)
  yesterday_doubleEMA=sum/esp;  //昨天的第一個doubleEMA
  //計算EMA,DEMA=21,22,...,2000
  for(let i=esp+1; i<STK_close.length; i++) {
    EMA[i]=(esp-1)/(esp+1)*EMA[i-1]+(2/(esp+1))*STK_close[i];
    today_doubleEMA=(esp-1)/(esp+1)*yesterday_doubleEMA+(2/(esp+1))*EMA[i];
    DEMA[i]=2*EMA[i]-today_doubleEMA;
    yesterday_doubleEMA=today_doubleEMA;  //今日的雙EMA變數丟給昨日的雙EMA變數
  }  //平滑式=(n-1)/(n+1)*昨+2/(n+1)*今
     //double EMA採用與EMA同步方式計算，不再落後esp期。
  return { DEMA, EMA };
  //drawing the DEMA[] and EMA[] figures in the small windows.
  //if esp=20 then DEMA[], EMA[]=20,21,...,2000.
}
window.DEMA = DEMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-03==modified on 2026-April-09, 2026-May-07==
//ADR漲跌比率(ADR, Advance Decline Ratio)。
//ADRt=N日內上漲天數總和/N日內下跌天數總和。 ADRt=sum(Up_days)/sum(Dn_days)
//指數平滑移動平均的參數:exponential smoothing parameter(esp),自創新
function ADR(STK_close, ADR_day, esp) {
  // Menu Name: ADR    //ADR_day=10, 20, ...,  esp=9,10,...
  const ADR=[], eADR=[];    //自創新
  let Up_days = 0, Dn_days = 0;  //上漲天數，下跌天數
  //例ADR_day=20，計算1,2,...,20的漲跌天數
  for(let i=2; i<ADR_day; i++) {    //例： i=2,3,...,20
    if(STK_close[i]>STK_close[i-1]) {
      Up_days=Up_days+1; }
    else if(STK_close[i]<STK_close[i-1]) {
      Dn_days=Dn_days+1; }  
  }
  if(Dn_days==0) {             //分母為0時的處理方式，取N日值.
    ADR[ADR_day]=ADR_day; }    //ADR(20)，第1個ADR。
  else {
    ADR[ADR_day]=Up_days/Dn_days; 
  }
  eADR[ADR_day]=ADR[ADR_day];  //eADR(20)，第1個eADR
  //計算其餘的ADR=21,22,...,2000
  for(let i=ADR_day+1; i<STK_close.length; i++) {    //例： i=21,22,...,2000.
    //先扣掉第2天比第1天是否漲跌的天數。
    if(STK_close[i-ADR_day+1]>STK_close[i-ADR_day]) {  //第2天比第1天是否漲
      Up_days=Up_days-1;  }
    else if(STK_close[i-ADR_day+1]<STK_close[i-ADR_day]) {
      Dn_days=Dn_days-1;  } 
    //第21天比第20天是否漲。
    if(STK_close[i]>STK_close[i-1]) { 
      Up_days=Up_days+1; }
    else if(STK_close[i]<STK_close[i-1]) {
       Dn_days=Dn_days+1; 
    } 
    if(Dn_days==0) {        //分母為0，取N日值.
      ADR[i]=ADR_day; }     //ADR(21)，第2個ADR。
    else {
      ADR[i]=Up_days/Dn_days; 
    }
    eADR[i]=(esp-1)/(esp+1)*eADR[i-1]+2/(esp+1)*ADR[i];  //自創新
  }
  return { ADR, eADR };
  //drawing the ADR[], eADR[] figures in the small windows.
  //if day=20, ADR[], eADR[]=20,21,...,2000.
}
window.ADR = ADR;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-04==modified on 2026-April-11==
//VRMA移動平均變動率指標(VRMA, Variant Rate of Moving Average)
//<完全自創指標,中英文自命名, 2009-April-11>
//VRMA=(MA(t)-MA(t-1))/MA(t-1))
function VariantRateMA(STK_close, day1, day2) {      //MA_day1, MA_day2
  // Menu Name: VariantRateMA  , day1=5, day2=10, ...
  const VarRtMA1=[], VarRtMA2=[];  
  //例：VarRtMA1=5日MA變動率，VarRtMA2=10的MA變動率
  const MA1 = KingMA(STK_close, day1);
  const MA2 = KingMA(STK_close, day2);
  for(let i=day1+1; i<STK_close.length; i++) {  //例：VRMA1=5日的MA變化率
    VarRtMA1[i]=(MA1[i]-MA1[i-1])/MA1[i-1]*100; //例：VRMA1=6,7,...,2000.
  }
  for(let i=day2+1; i<STK_close.length; i++) {  //例：VRMA2=10日的MA變化率
    VarRtMA2[i]=(MA2[i]-MA2[i-1])/MA2[i-1]*100; //例：VRMA2=11,12,...,2000.
  }
  return { VarRtMA1, VarRtMA2 };
  //drawing the VarRtMA1 and VarRtMA2 figures in the small windows.
  //例參數day1=5, VarRtMA1=6,7,...,2000.
  //例參數day2=10,VarRtMA2=11,12,...,2000.
}
window.VariantRateMA = VariantRateMA;
//----------------------------------------------------------------------

//===designed by Prof Wang,==2026-April-11==Completely self-created indicators==
//VRMA移動平均二天前變動率指標(VRMA, Variant Rate of Moving Average Two Days Ago)
//<完全自創指標,中英文自命名, 2026-April-11>
//VRMA=(MA(t)-MA(t-2))/MA(t-2))
function VariantRateMA2DaysAgo(STK_close,day1, day2) {      //MA_day1, MA_day2
  // Menu Name: VariantRateMA2DaysAgo  , day1=5, day2=10, ...
  const VarRtMA2DaysAgo1=[], VarRtMA2DaysAgo2=[];  
  //例：VarRtMA1=5日MA變動率，VarRtMA2=10的MA變動率
  const MA1 = KingMA(STK_close, day1);
  const MA2 = KingMA(STK_close, day2);
  for(let i=day1+2; i<STK_close.length; i++) {  //例：VRMA1=5日的MA變化率
    VarRtMA2DaysAgo1[i]=(MA1[i]-MA1[i-2])/MA1[i-2]*100; //例：VRMA1=7,8,...,2000.
  }
  for(let i=day2+2; i<STK_close.length; i++) {  //例：VRMA2=10日的MA變化率
    VarRtMA2DaysAgo2[i]=(MA2[i]-MA2[i-2])/MA2[i-2]*100; //例：VRMA2=12,13,...,2000.
  }
  return { VarRtMA2DaysAgo1, VarRtMA2DaysAgo2 };
  //drawing the VarRtM2DaysAgo1 and VarRtMA2DaysAgo2 figures in the small windows.
  //例參數day1=5, VarRtM2DaysAgo1=7,8,...,2000..
  //例參數day2=10,VarRtMA2DaysAgo2=12,13,...,2000.
}
window.VariantRateMA2DaysAgo = VariantRateMA2DaysAgo;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-05==modified on 2026-April-11==
//日內動量指標 (IMI, Intraday Momentum Index)
//日內動量指標：IMlet i=[Iu/(Iu+Id)]*100
//Iu為在N日期間內的某日收盤價大於開盤價時，則將(收盤價－開盤價)後予以加總的值。
//Id為在N日期間內的某日開盤價大於收盤價時，則將(開盤價－收盤價後予以加總的值。
function IntradayMomentum(STK_open, STK_close, day1, day2) {  //原名: IMI
  // Menu Name: Intraday Momentum  , day1=10, day2=20, ...
  const IMI1=[], IMI2=[];
  let Iup = 0, Idn = 0;
  for (let i=1; i<day1; i++) {     //例: i=1 to 10
    if(STK_close[i]>STK_open[i]) {
      Iup=Iup+(STK_close[i]-STK_open[i]); }
    else if(STK_open[i]>STK_close[i]) {
      Idn=Idn+(STK_open[i]-STK_close[i]); } 
  }
  IMI1[day1]=Iup/(Iup+Idn)*100;  //計算第1個IMI，例:IMI1(10)。
  for(let i=day1+1; i<STK_close.length; i++) {  // i=11,12,...,2000.
    //先扣掉第1天比第1天是否C>O。
    if(STK_close[i-day1]>STK_open[i-day1]) {   //第1天比第1天是否C>O
      Iup=Iup-(STK_close[i-day1]-STK_open[i-day1]); }
    else if(STK_open[i-day1]>STK_close[i-day1]) {
      Idn=Idn-(STK_open[i-day1]-STK_close[i-day1]); }
    //第11天起是否C>O。
    if(STK_close[i]>STK_open[i]) {
      Iup=Iup+(STK_close[i]-STK_open[i]); }
    else if(STK_open[i]>STK_close[i]) {
      Idn=Idn+(STK_open[i]-STK_close[i]); }
    IMI1[i]=Iup/(Iup+Idn)*100;  //計算第2個IMI，例:IMI1(11),12,...,2000.
  }
  //相同程式邏輯，計算IMI2
  Iup=0;
  Idn=0;
  for(let i=1; i<day2; i++) {     //例: let i=1 to 20
    if(STK_close[i]>STK_open[i]) {
      Iup=Iup+(STK_close[i]-STK_open[i]); }
    else if(STK_open[i]>STK_close[i]) {
      Idn=Idn+(STK_open[i]-STK_close[i]); } 
  }
  IMI2[day2]=Iup/(Iup+Idn)*100;  //計算第1個IMI，例:IMI2(20)。
  for (let i=day2+1; i<STK_close.length; i++) {  //let i=21,22,...,2000.
    //先扣掉第1天比第1天是否C>O。
    if(STK_close[i-day2]>STK_open[i-day2]) {   //第1天比第1天是否C>O
      Iup=Iup-(STK_close[i-day2]-STK_open[i-day2]); }
    else if(STK_open[i-day2]>STK_close[i-day2]) {
      Idn=Idn-(STK_open[i-day2]-STK_close[i-day2]); }
    //第21天起是否C>O。
    if(STK_close[i]>STK_open[i]) {
      Iup=Iup+(STK_close[i]-STK_open[i]); }
    else if(STK_open[i]>STK_close[i]) {
      Idn=Idn+(STK_open[i]-STK_close[i]); }
    IMI2[i]=Iup/(Iup+Idn)*100;  //計算第2個IMI，例:IMI1(11),12,...,2000.
  }
  return { IMI1, IMI2 };
//drawing the IMI1 and IMI2 figures in the small windows.
//例參數day1=10, IMI1=10,11,...,2000.
//例參數day2=20, IMI2=20,21,...,2000.
}
window.IntradayMomentum = IntradayMomentum;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-25=============
//Qstick量化陰陽線(Quantitative Candle Stick, Qstick)
//例如:N=10, avg(Close-Open, 10)=sum(Close-Open, 1 to 10)/10
//Qstick>0表示多頭市場, Qstick<0表示空頭市場
//Qstick的優點:能夠同時考慮收盤價和開盤價的變化,比較適合用於分析短期趨勢和動量.
//eQstick=(n-1)/(n+1)*eQstick昨+2/(n+1)*Qstick今,  <自創>
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function Qstick(K_close, K_open, day, esp) {   //Qstick
  // Menu Name: Qstick       // day=10, 20, ..., esp=9
  // K_close=STK_close, K_open=STK_open
  const Qstick = [];    //例如:N=10, Qstick=2 to 2000
  const eQstick = [];   //例如:N=10, eQstick=2 to 2000
  //compute first Qstick[]=10, 例如:N=10, Qstick[10]
  let sum=0;  //加總N日內(C-O)總和
  for(let i=1; i<day; i++) {   //i=1 to 10, 例如:N=10}
    sum=sum+(K_close[i]-K_open[i]);  //例如:N=10
  }
  Qstick[day]=sum/day;  //例如:N=10, first Qstick[10]
  eQstick[day]=Qstick[day];  //<自創>,令eQstick初值=Qstick初值, 例如:N=10, eQstick[10]
  //compute Qstick[]=11 to 2000, 例如:N=10, i=day+1 to 2000
  for(let i=day+1; i<K_close.length; i++) {   //i=11 to 2000
    sum=sum-(K_close[i-day]-K_open[i-day])+(K_close[i]-K_open[i]);  
    //例如:N=10, sum=sum-(C[1]-O[1])+(C[11]-O[11])
    Qstick[i]=sum/day;  //例如:N=10, second Qstick[11]
    eQstick[i]=(esp-1)/(esp+1)*eQstick[i-1]+2/(esp+1)*Qstick[i]; // 2sec eQstick[11]
  }
  return { Qstick, eQstick };
  //drawing the Qstick and eQstick figures in the small windows.
  //if day=10, then Qstick[], eQstick[]=10,11,...,2000.
}
window.Qstick = Qstick;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-02==(原設計2025-Dec-06)=============
//MTM動量指標(Momentum)。MTM=C(t)/C(t-n)*100%
//MTM=(現在的收盤價÷n日以前的收盤價)×100%
// esp=10;平滑的天數exponential smoothing parameter(esp)
function Momentum(K_close, day, esp) {
  //Menu Name: Momentum, day=10, 20, ..., esp=9
  //K_close=STK_close[]
  //day=closing price <day> days ago
  const MTM=[], eMTM=[];
  for(let i=day; i<K_close.length; i++) {
    MTM[i]=K_close[i]/K_close[i-day+1]*100;
    //例:day=10, MTM(10)=close(10)/close(1)*100
    //MTM=10,11,...,2000.
    if(i===day) {
      eMTM[i]=MTM[i]; }  //自創新指標，第1個eMTM(10)=MTM(10)
    else {
      eMTM[i]=(esp-1)/(esp+1)*eMTM[i-1] + (2/(esp+1))*MTM[i];
    }
  }
  return { MTM, eMTM };
  //drawing the MTM and eMTM figures in the small windows.
  //例參數day=10, MTM,eMTM=10,11,...,2000.
}
window.Momentum = Momentum;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-06==modified on 2026-April-11==
//ROC變動率指標(ROC, Rate of Change),可以改為:價格變動率指標, Price Rate of Change, PriceROC
//ROC=(當天收盤價-n天前收盤價)/n天前收盤價*100%
//ROC=((當天收盤價/n天前收盤價)-1)*100%。二者相同。
function ROC(STK_close, day, esp ) {
  // Menu Name: ROC  , day=10, 20, ... , esp=9, 10, ...
  const ROC=[], eROC=[];  //eROC=自創新指標, Exponential ROC, 指數平滑ROC
  for(let i=day; i<STK_close.length; i++) {   // i=10, 11, ..., 2000.
    ROC[i]=(STK_close[i]-STK_close[i-day+1])/STK_close[i-day+1]*100;
    if(i==day) {
      eROC[i]=ROC[i]; }  //初值
    else {
      eROC[i]=(esp-1)/(esp+1)*eROC[i-1]+2/(esp+1)*ROC[i];
    }
    //ROC(i)=(STK_close(i)/STK_close(i-day+1)-1)*100;
    //例:day=10, ROC(10)=(close(10)-CLOSE(1))/close(1)*100
  }
  return { ROC, eROC };
  //drawing the ROC and eROC figures in the small windows.
  //if day=10 then ROC[], eROC[]=10,11,...,2000.
}
window.ROC = ROC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-06=================================
//KST明確指標(KST, Know Sure Things)，是由數個(4 ROC)『ROC變動率指標』組合而成
//eKST是KST的指數平滑移動平均，作為KST的Signal Line, 自創, esp=9,10,...
function KST(STK_close, day1, day2, day3, day4, esp) {
  // Menu Name: KST 
  //例：day1-4：10,15,20,30天.  esp=9,10,...
  const ROC1=[], ROC2=[], ROC3=[], ROC4=[];
  for(let i=day1; i<STK_close.length; i++) {   //ROC1(),10天
    //ROC1=10,11,...,2000.
    ROC1[i]=(STK_close[i]/STK_close[i-day1+1]-1)*100; }
  for(let i=day2; i<STK_close.length; i++) {   //ROC2(),15天
    //ROC2=15,16,...,2000.
    ROC2[i]=(STK_close[i]/STK_close[i-day2+1]-1)*100; }
  for(let i=day3; i<STK_close.length; i++) {   //ROC3(),20天
    //ROC3=20,21,...,2000.
    ROC3[i]=(STK_close[i]/STK_close[i-day3+1]-1)*100; }
  for(let i=day4; i<STK_close.length; i++) {   //ROC4(),30天
    //ROC4=30,31,...,2000.
    ROC4[i]=(STK_close[i]/STK_close[i-day4+1]-1)*100; 
  }
  //對4個ROC做SMA。以此式做SMA，(n-1)/n*舊+1/n*新=ROCma
  //對4個ROC做SMA的長度分別：10,10,10,15
  const ROCma1=[], ROCma2=[], ROCma3=[], ROCma4=[];
  let maday1=10;
  let maday2=10;
  let maday3=10;
  let maday4=15;
  ROCma1[day1]=ROC1[day1];     //令第1個ROCma1(10)=ROC1(10)
  for(let i=day1+1; i<STK_close.length; i++) {   //ROC1(),10天
    ROCma1[i]=(maday1-1)/maday1*ROCma1[i-1]+1/maday1*ROC1[i];
  }
  ROCma2[day2]=ROC2[day2];     //令第1個ROCma2(15)=ROC2(15)
  for(let i=day2+1; i<STK_close.length; i++) {   //ROC2(),15天
    ROCma2[i]=(maday2-1)/maday2*ROCma2[i-1]+1/maday2*ROC2[i];
  }
  ROCma3[day3]=ROC3[day3];     //令第1個ROCma3(20)=ROC3(20)
  for(let i=day3+1; i<STK_close.length; i++) {   //ROC3(),20天
    ROCma3[i]=(maday3-1)/maday3*ROCma3[i-1]+1/maday3*ROC3[i];
  }
  ROCma4[day4]=ROC4[day4];     //令第1個ROCma4(30)=ROC4(30)
  for(let i=day4+1; i<STK_close.length; i++) {   //ROC4(),30天
    ROCma4[i]=(maday4-1)/maday4*ROCma4[i-1]+1/maday4*ROC4[i];
  }
  //計算KST。設4個day最大值為30，則KST的第1個值為KST(30)
  const KST=[];
  max_day=Math.max(day1,day2,day3,day4);   //設4個day最大值為30
  for(let i=max_day; i<STK_close.length; i++) {  // i=30 to 2000
    KST[i]=(ROCma1[i]*1+ROCma2[i]*2+ROCma3[i]*3+ROCma4[i]*4)/10;
    //對4個ROCma加權，計算KST=30,31,...,2000.
  }
  //計算KST的指數平滑移動平均，(n-1)/(n+1)*舊+2/(n+1)*新。n=esp=9,10,...
  const eKST=[];   //KST的指數平滑移動平均。Signal Line, 自創
  eKST[max_day]=KST[max_day];   //令第1個eKST(30)=KST(30)
  for(let i=max_day+1; i<STK_close.length; i++) {  // i=31 to 2000
    eKST[i]=(esp-1)/(esp+1)*eKST[i-1]+2/(esp+1)*KST[i];   //自創
  }
  return { KST, eKST };
  //drawing the KST and eKST figures in the small windows.
  //設四個最大天數為30天，則KST與eKST=30,31,...,2000.
}
window.KST = KST;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-07==modified on 2026-April-11==
//本人採用下式移動平均OBV線。修正OBV能量線(OBV, On Balance Volume)
//OBV(t)=OBV(t-1)+(2C-H-L)/(H-L)*VOL
//eOBV(t)=(n-1)/(n+1)eOBV(t-1)+2/(n+1)*OBV(t)
function OBV(STK_high, STK_low, STK_close, STK_vol, esp) {
  // Menu Name: OBV     // esp=9, 10, ...
  const OBV=[], eOBV=[];   //OBV線，平滑eOBV線,自創新
  if(STK_high[1]!=STK_low[1]) {    //分母不為0，計算第1個OBV
    OBV[1]=(2*STK_close[1]-STK_high[1]-STK_low[1])/(STK_high[1]-STK_low[1])*STK_vol[1]; }
  else { 
    OBV[1]=STK_vol[1]; 
  }  //OBV[]=1
  eOBV[1]=OBV[1];   //OBV的EMA=eOBV。第1個eOBV.
  const ema_n=9;    //設平滑因子=9.
  for(let i=2; i<STK_close.length; i++) {   // i=2 to 2000.
    if(STK_high[i]!=STK_low[i]) {       //分母不為0
// wrong: OBV[i]=OBV[i-1)+(2*STK_close[i]-STK_high[i]-STK_low[i])/(STK_high[i]-STK_low[i])*STK_vol[i]; }
      OBV[i]=OBV[i-1]+(2*STK_close[i]-STK_high[i]-STK_low[i])/(STK_high[i]-STK_low[i])*STK_vol[i]; }
    else {
      OBV[i]=OBV[i-1]+STK_vol[i]; 
    }  //OBV=2,3,...,2000.
    eOBV[i]=(esp-1)/(esp+1)*eOBV[i-1]+2/(esp+1)*OBV[i]; // eOBV=2,3,...,2000.
  }
  return { OBV, eOBV };
  //drawing the OBV[] and eOBV[] figures in the small windows.
  //OBV[], eOBV[]=1,2,...,2000.
}
window.OBV = OBV;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-07==modified on 2026-April-11==
//ACC加速量指標(Acceleration)是將MTM動量指標再做一次動量運算的指標。
//所以ACC仿照MTM方式計算。ACC=MTM(t)/MTM(t-m)*100%
//MTM動量指標(Momentum)。MTM=C(t)/C(t-n)*100%
//MTM=(現在的MTM÷n日以前的MTM)×100%
//ACC(現在的收盤價÷m日以前的收盤價)×100%
function Acceleration(STK_close, MTM_n, ACC_n) {  //原名稱: ACC
  // Menu Name: Acceleration(ACC)     // MTM_n=10, ACC_n=5, ...
  const MTM=[], ACC=[];
  for(let i=MTM_n; i<STK_close.length; i++) {    //MTM()
    //先算MTM，例:MTM_n=10, MTM(10)=close(10)/close(1)*100
    MTM[i]=STK_close[i]/STK_close[i-MTM_n+1]*100; //MTM=10,11,...,2000.
  }
  //ACC仿照MTM方式計算。ACC=MTM(t)/MTM(t-m)*100%
  //例:MTM_n=10，ACC_n=5，則ACC第1個值是ACC(15)
  for(let i=MTM_n+ACC_n; i<STK_close.length; i++) {  // i=15 to 2000.
    ACC[i]=MTM[i]/MTM[i-ACC_n]*100;   //第1個ACC(15)=MTM(15)/MTM(10)
  }  //ACC=15,16,...,2000.
  return { MTM, ACC };
  //drawing the MTM[] and ACC[] figures in the small windows.
  //設MTM參數=10，ACC參數=5，則MTM[]=10,11,...,2000. ACC[]=15,16,...,2000.
}
window.Acceleration = Acceleration;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-08==modified on 2026-April-11==
//WAD威廉多空力度指標(William’s Accumulation/Distribution威廉聚散指標) 
function WilliamAccuDist(STK_high, STK_low, STK_close, esp) { //原名稱: WAD
  // Menu Name: WilliamAccuDist(WAD)    // esp=9, ...自創新
  const WAD=[], eWAD=[];  //自創新,將WAD用指數平滑化
  let TRH, TRL, AD=0;
  WAD[1]=STK_close[1];   //設定初值WAD(1)
  eWAD[1]=WAD[1];        //設定初值eWAD(1),自創新
  for(let i=2; i<STK_close.length; i++) {     // i=2 to 2000.
    TRH=Math.max(STK_close[i-1], STK_high[i]); //取大(昨收,今高)
    TRL=Math.min(STK_close[i-1], STK_low[i]);  //取小(昨收,今低)
    switch (true) {
      case STK_close[i]>STK_close[i-1]:
        AD=STK_close[i]-TRL;
        break;
      case STK_close[i]<STK_close[i-1]:
        AD=STK_close[i]-TRH;
        break;
      case STK_close[i]===STK_close[i-1]:
        AD=0;
        break;
    }
    WAD[i]=WAD[i-1]+AD;
    eWAD[i]=(esp-1)/(esp+1)*eWAD[i-1]+2/(esp+1)*WAD[i];  //自創新
    //將WAD指數平滑化。今eWAD=(n-1)/(n+1)*昨eWAD+2/(n+1)*今WAD
  }
  return { WAD, eWAD };
  //drawing the WAD[] and eWAD[] figures in the small windows.
  //WAD[], eWAD[]=1,2,...,2000.
}
window.WilliamAccuDist = WilliamAccuDist;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-08==modified on 2026-April-11==
//CostMA成本均線(CostMA, Cost Moving Average)
//CostMA=10天內sum(Vol*P)/10天內sum(Vol),例：時間長度=10
//P=average(H+L+C)
function CostMA(STK_high, STK_low, STK_close, STK_vol, day_length) {
  // Menu Name: CostMA  //day_length=加總之時間長度。例：day_length=10
  const CostMA=[];   //成本均線
  let sum_Vol_P=0;   //分子加總
  let sum_Vol=0;     //分母加總
  let P=0;           //P=average(H+L+C)
  for(let i=1; i<day_length; i++) {   //例:計算前10筆加總，i=1 to 10
    P=(STK_high[i]+STK_low[i]+STK_close[i])/3;
    sum_Vol_P=sum_Vol_P+STK_vol[i]*P;  //分子加總
    sum_Vol=sum_Vol+STK_vol[i];        //分母加總
  }
  CostMA[day_length]=sum_Vol_P/sum_Vol;   //第1個成本均線，例:CostMA(10)
  for(let i=day_length+1; i<STK_close.length; i++) {  //例:let i=11 to 2000
    //先扣除10天前的分子加總、分母加總
    P=(STK_high[i-day_length]+STK_low [i-day_length]+STK_close[i-day_length])/3;
    sum_Vol_P=sum_Vol_P-STK_vol[i-day_length]*P;  //先扣除10天前的分子加總
    sum_Vol=sum_Vol-STK_vol[i-day_length];        //先扣除10天前的分母加總
    //新的分子加總、新的分母加總
    P=(STK_high[i]+STK_low[i]+STK_close[i])/3;
    sum_Vol_P=sum_Vol_P+STK_vol[i]*P;  //新的分子加總
    sum_Vol=sum_Vol+STK_vol[i];        //新的分母加總
    CostMA[i]=sum_Vol_P/sum_Vol;       //第2筆為11
  }
  return { CostMA };
  //drawing the CostMA[] figure in the small windows.
  // if day_length=10 then CostMA[]=10,11,...,2000.
}
window.CostMA = CostMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-07===Original designed on 2025-Dec-08======
//VROC成交量變動率指標(VROC, Volume Rate of Change)	(楊本,p.75)
//VROC=(當天成交量-n天前成交量)/n天前成交量*100%
//VROC=((當天成交量/n天前成交量)-1)*100%。二者相同。
function VolumeROC(K_vol, roc_length, ma_day) {
  // Menu Name: VolumeROC  // K_vol=STK_vol, roc_length=length of ROC(Time Length)
  // roc_length=10, =15, =20,... ,K_vol(i-roc_length)=第i-roc_length日的成交量
  // ma_day=5,10,... 移動平均天數
  const VolROC=[];    //=11,12,...,2000
  for(let i=roc_length+1; i<K_vol.length; i++) {  // i=10+1, to 2000
    VolROC[i]=(K_vol[i]/K_vol[i-roc_length]-1)*100;  // (Vol(11)/Vol(1)-1)*100
  }
  //計算：成交量變動率之移動平均(Moving Average of Volume Change Rate:)
  const VolROCma=[];   // =10+5  to 2000
  let sum=0;
  for(let i=roc_length+1; i<roc_length+ma_day; i++) {  // i=10+1 to 10+5
    sum=sum+VolROC[i];
  }
  VolROCma[roc_length+ma_day]=sum/ma_day;    // 第1個VolROCma(15)=sum/5
  for(let i=roc_length+ma_day+1; i<K_vol.length; i++) { // i=10+5+1 to 2000
    //先扣除5天前舊的，再加新的
    sum=sum-VolROC[i-ma_day]+VolROC[i];   //sum=sum-(第11個)+(第16個)
    VolROCma[i]=sum/ma_day;
  }
  //可以考慮計算eVolROC代替VolROCma,即: 新=(n-1)/(n+1)*舊+2/(n+1)*VolROC
  return { VolROC, VolROCma };
  //drawing the VolROC() and VolROCma() figures in the small windows.
  //if roc_length=10, VolROC()=11,12,...,2000.
  //if ma_day=5, VolROCma()=15,16,...,2000
}
window.VolumeROC = VolumeROC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-08===modified on 2026-March-15==
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//BTI廣量衝力指標(BTI, Breadth Thrust Index)
//BTI=MA(up/(up+down), n), n=10. 
//up=個股上漲天數, down=個股下跌天數, n=10天.
function BTI(K_close, day) {
  //Memu Name: BTI   //day=10天, K_close=STK_close
  const BTI=[];
  let sum_up=0;    //個股上漲天數_加總
  let sum_down=0;  //個股下跌天數_加總
  for(let i=2; i<day+1; i++) {    //例：i=2 to 11
    if(K_close[i]>K_close[i-1]) {
      sum_up=sum_up+1; }
    else if(K_close[i]<K_close[i-1]) {
      sum_down=sum_down+1;  }
  }
  BTI[day+1]=(sum_up/(sum_up+sum_down))/day; //第1個，例:BTI(11)
  for(let i=day+2; i<K_close.length; i++) {  //i=12 to 2000
    //先扣除10天前的分子加總、分母加總
    if(K_close[i-day]>K_close[i-day-1]) {   //(12-10=)2 >1
      sum_up=sum_up-1; }
    else if(K_close[i-day]<K_close[i-day-1]) {
      sum_down=sum_down-1;  
    }
    //新的分子加總、新的分母加總
    if(K_close[i]>K_close[i-1]) {
      sum_up=sum_up+1; }
    else if(K_close[i]<K_close[i-1]) {
      sum_down=sum_down+1;
    }
    BTI[i]=(sum_up/(sum_up+sum_down))/day; //第2個，例:BTI(12)
  }
  return { BTI };
  //drawing the BTI[] figure in the small windows.
  //if day=10 then BTI[]=11,12,...,2000.
}
window.BTI = BTI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-10===modify on 2026-March-14====
//DPO除趨勢價格振盪指標(DPO, Detrended Price Oscillator)
//DPO=C(t)-MA of the previous (n/2)+1 days
//eDPO今=(n-1)/(n+1)*eDPO昨+2/(n+1)*DPO今。指數平滑移動平均參數esp=9,<本人自創>
function DPO(STK_close, MA_day, esp) {
  //Menu Name: DPO     //MA_day=10, esp=9,指數平滑移動平均參數
  const DPO=[], eDPO=[];
  const MA = KingMA(STK_close, MA_day);
  //例MA_day=10,則第1個MA值是MA(10),(n/2)+1=(10/2)+1=6,則第1個DPO落後4天
  //例MA_day=10,落後天數(n/2)+1=(10/2)+1=6,即10-6=4
  if(MA_day%2!==0) {
    MA_day=MA_day+1;  //如果MA_day是奇數，則改為偶數。例MA_day=9,則改為10。
  }
  let lag_day=MA_day-(MA_day/2+1);  //例MA_day=10, 10-(10/2+1)=4
  for(let i=MA_day+lag_day; i<STK_close.length; i++) { //例i=10+4 to 2000
    DPO[i]=STK_close[i]-MA[i-lag_day];  //DPO(14)=C(14)-MA(14-4)
    //例MA_day=10,則第1個DPO=DPO(14)
    if(i===MA_day+lag_day) {  //指數平滑移動平均
      eDPO[i]=DPO[i]; }       //第1個eDPO(14)=DPO(14)
    else {
      eDPO[i]=(esp-1)/(esp+1)*eDPO[i-1]+2/(esp+1)*DPO[i];
      //eDPO今=(n-1)/(n+1)*eDPO昨+2/(n+1)*DPO今。參數=9,<本人自創>
    }
  }
  return { DPO, eDPO };
  //drawing the DPO and eDPO figures in the small windows.
  //例MA_day=10,落後天數=4。 DPO,eDPO=14,15,...,2000.
}
window.DPO = DPO;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-10===modified on 2026-March-14===
//EOM(EMV)簡易波動指標(Ease of Movement)
function EOM_EMV(STK_high, STK_low, STK_close, STK_vol, esp) {
  // Menu Name: EOM_EMV    //esp=9;    //指數平滑移動平均參數=9
  const EOM_EMV=[], eEOM_EMV=[];  //本人自創
  let MID, VPU;
  for(let i=2; i<STK_close.length; i++) {
    // MID=MidPointMove
    MID=(STK_high[i]-STK_low[i])/2-(STK_high[i-1]-STK_low[i-1])/2;
    // VPU=VolumePerUnit
    if(STK_high[i]!=STK_low[i]) {  //如果當天最高價等於最低價
      VPU=STK_vol[i]/(STK_high[i]-STK_low[i]);
    }
    //compute EOM(EMV)
    if(STK_high[i]==STK_low[i]) {  //如果當天最高價等於最低價，則EOM_EMV=0
      EOM_EMV[i]=0; }
    else { 
      EOM_EMV[i]=MID/VPU*100;
    }
    if(i===2){             //指數平滑移動平均
      eEOM_EMV[2]=EOM_EMV[2]; }    //eEOM_EMV初值
    else {
      eEOM_EMV[i]=(esp-1)/(esp+1)*eEOM_EMV[i-1]+2/(esp+1)*EOM_EMV[i];
      //eEOM_EMV今=(n-1)/(n+1)*eEOM_EMV昨+2/(n+1)*EOM_EMV今。參數=9,<本人自創>
    }
      
  }
  return { EOM_EMV, eEOM_EMV };
  //drawing the EOM_EMV[] and eEOM_EMV[] figures in the small windows.
  //EOM_EMV[], eEOM_EMV[] =2,3,...,2000.
}
window.EOM_EMV = EOM_EMV;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-25===
//重新設計==Original design date 2025-Dec-10====
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//PVT(Price Volume Trend 價量趨勢指標)
//PVT今=PVT昨+(今C-昨C)/昨C*今Vol
//ePVT今=(n-1)/(n+1)*ePVT昨+2/(n+1)*PVT今。指數平滑移動平均參數=9
//ePVT完全自創指標,completely self-created indicators. 
function PriceVolumTrend(K_close, K_vol, esp) {
  //Menu Name: Price Volum Trend   //K_close=STK_close, esp=9, 10,...
  const PVT=[], ePVT=[];
  PVT[1]=K_vol[1];     //初值
  ePVT[1]=PVT[1];      //初值,指數平滑移動平均,自創
  for(let i=2; i<K_close.length; i++) {
    PVT[i]=PVT[i-1]+((K_close[i]-K_close[i-1])/K_close[i-1])*K_vol[i];
    ePVT[i]=(esp-1)/(esp+1)*ePVT[i-1]+2/(esp+1)*PVT[i];
    //ePVT今=(n-1)/(n+1)*ePVT昨+2/(n+1)*PVT今。參數=9,<本人自創>
  }
  return { PVT, ePVT };
  //drawing the PVT[] and ePVT[] figures in the small windows.
  //PVT[], ePVT[]=1,2,3,...,2000.
}
window.PriceVolumTrend = PriceVolumTrend;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-06===
//完全自創指標，仿照：PVT - Price Volume Trend 價量趨勢指標(價格成交量走勢)
//原PVT採用收盤價(C)計算，本創新採用MA替代收盤價(C).
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//MAPVT(MA Price Volume Trend 平均價量趨勢指標)
//MAPVT今=MAPVT昨+(今MA-昨MA)/昨MA*今Vol, 完全自創指標
//eMAPVT今=(n-1)/(n+1)*eMAPVT昨+2/(n+1)*MAPVT今。 參數=9
//eMAPVT完全自創指標,completely self-created indicators. 
function MAPriceVolumTrend(K_close, K_vol, ma_day, esp) {
  //Menu Name: MAPVT
  //K_close=STK_close, K_vol=STK_vol,   esp=9,10,...
  //ma_day=5, 10, 15, 20, ...
  const MAPVT=[], eMAPVT=[];
  //================First calculate MA ===
  const MA=[];
  let sum=0;
  for(let i=1; i<ma_day; i++) {
    sum=sum+K_close[i];
  }
  MA[ma_day]=sum/ma_day;   //first MA[10]
  for(let i=ma_day+1; i<K_close.length; i++) {  //i=11 to 2000
    sum=sum-K_close[i-ma_day]+K_close[i];   //先減舊的再加新的
    MA[i]=sum/ma_day;      //second MA[11]
  }
  //MAPVT價量趨勢指標(MA Price Volume Trend, MAPVT)
  //if ma_day=10, then MAPVT[]=11 ,12,...,2000
  MAPVT[ma_day]=K_vol[ma_day];   //初值,MAPVT[10]
  eMAPVT[ma_day]=MAPVT[ma_day];  //初值,指數平滑移動平均
  for(let i=ma_day+1; i<K_close.length; i++) {  //i=10+1 to 2000
    MAPVT[i]=MAPVT[i-1]+((MA[i]-MA[i-1])/MA[i-1])*K_vol[i];
    eMAPVT[i]=(esp-1)/(esp+1)*eMAPVT[i-1]+2/(esp+1)*MAPVT[i];
    //eMAPVT今=(n-1)/(n+1)*eMAPVT昨+2/(n+1)*MAPVT今。參數=9,<本人自創>
  }
  return { MAPVT, eMAPVT };
  //drawing the MAPVT and eMAPVT figures in the small windows.
  //if ma_day=10, then MAPVT[],eMAPVT[]=11 ,12,...,2000.
}
window.MAPriceVolumTrend = MAPriceVolumTrend;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-25==================
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//CV積量指標(Cumulative Volume, CV)
//CumuVol今=CumuVol昨+(今C-昨C)*今Vol
//eCumuVol今=(n-1)/(n+1)*eCumuVol昨+2/(n+1)*CumuVol今。參數=9
//eCumuVol完全自創指標,completely self-created indicators. 
function CumulativeVolume(K_close, K_vol, esp) {
  //Menu Name: Cumulative Volume(CV)  //K_close=STK_close, K_vol=STK_vol
  const CumuVol=[], eCumuVol=[];
  // esp=9;    //指數平滑移動平均參數=9
  CumuVol[1]=K_close[1];     //初值
  eCumuVol[1]=CumuVol[1];    //初值,指數平滑移動平均
  for(let i=2; i<K_close.length; i++) {
    CumuVol[i]=CumuVol[i-1]+(K_close[i]-K_close[i-1])*K_vol[i];
    eCumuVol[i]=(esp-1)/(esp+1)*eCumuVol[i-1]+2/(esp+1)*CumuVol[i];
    //eCumuVol今=(n-1)/(n+1)*eCumuVol昨+2/(n+1)*CumuVol今。參數=9,<本人自創>
  }
  return { CumuVol, eCumuVol };
  //drawing the CumuVol and eCumuVol figures in the small windows.
  //CumuVol, eCumuVol=1,2,3,...,2000.
}
window.CumulativeVolume = CumulativeVolume;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-06==================
//移動平均移動平均積量指標(MA Cumulative Volume) <完全自創指標>
//完全自創指標，仿照：CV積量指標(Cumulative Volume, CV),
//MACumuVol今=MACumuVol昨+(今MA-昨MA)*今Vol
//eMACumuVol今=(n-1)/(n+1)*eMACumuVol昨+2/(n+1)*MACumuVol今。參數=9
//eMACumuVol完全自創指標, completely self-created indicators. 
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function NewCumulativeVolume(K_close, K_vol, ma_day, esp) {
  //Menu Name: New Cumulative Volume    //亦可取名:MACumulativeVolume
  //K_close=STK_close, K_vol=STK_vol,  esp=9,10,...
  //ma_day=5, 10, 15, 20, ...
  const MACumuVol=[], eMACumuVol=[];    //original=CV, new=MACV
  //================First calculate MA ===
  const MA=[];
  let sum=0;
  for(let i=1; i<ma_day; i++) {
    sum=sum+K_close[i];
  }
  MA[ma_day]=sum/ma_day;   //first MA[10]
  for(let i=ma_day+1; i<K_close.length; i++) {  //i=11 to 2000
    sum=sum-K_close[i-ma_day]+K_close[i];   //先減舊的再加新的
    MA[i]=sum/ma_day;      //second MA[11]
  }
  //移動平均移動平均積量指標(MA Cumulative Volume)
  //if ma_day=10, then MACumuVol[]=11 ,12,...,2000
  MACumuVol[ma_day]=K_vol[ma_day];       //初值,MACumuVol[10]
  eMACumuVol[ma_day]=MACumuVol[ma_day];  //初值,指數平滑移動平均
  for(let i=ma_day+1; i<K_close.length; i++) {  //i=10+1 to 2000
    MACumuVol[i]=MACumuVol[i-1]+(MA[i]-MA[i-1])*K_vol[i];
    eMACumuVol[i]=(esp-1)/(esp+1)*eMACumuVol[i-1]+2/(esp+1)*MACumuVol[i];
    //eMACumuVol今=(n-1)/(n+1)*eMACumuVol昨+2/(n+1)*MACumuVol今。參數=9,<本人自創>
  }
  return { MACumuVol, eMACumuVol };
  //drawing the MACumuVol[] and eMACumuVol[] figures in the small windows.
  //if ma_day=10, then MACumuVol[],eMACumuVol[]=11 ,12,...,2000.
}
window.NewCumulativeVolume = NewCumulativeVolume;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-12===2026-02-16 modify=============
//MFI資金流向指標(MFI, Money Flow Index)
//TypicalPrice=(H+L+C)/3
//MoneyFlow=TypicalPrice X Volume
//MoneyRatio=PositiveMoneyFlow/NegativeMoneyFlow
//MFI=PositiveMoneyFlow/(PositiveMoneyFlow+NegativeMoneyFlow)*100
//eMFI今=(n-1)/(n+1)*eMFI昨+2/(n+1)*MFI今。參數=9,<本人自創>
function MoneyFlowIndex(STK_high,STK_low, STK_close, day, esp) {
  // Menu Name: Money Flow Index   //過去day日的正負資金流，例:day=10
  // esp=9, Exponential smoothing parameter(esp)
  const MFI=[], eMFI=[];    //=MoneyFlowIndex
  let PMF=0, NMF=0;   //PositiveMoneyFlow正資金流,NegativeMoneyFlow負資金流
  let yesterday_TpPrice, today_TpPrice;  //TypicalPrice 昨天的、今天的
  for(let i=2; i<day; i++) {   //例:i=2 to 10
    yesterday_TpPrice=(STK_high[i-1]+STK_low[i-1]+STK_close[i-1])/3;
    //TypicalPrice 昨天的
    today_TpPrice=(STK_high[i]+STK_low[i]+STK_close[i])/3;
    //TypicalPrice 今天的
    if(today_TpPrice > yesterday_TpPrice) {
      PMF=PMF+today_TpPrice*STK_vol[i]; }   //PositiveMoneyFlow 加總
    else if(today_TpPrice < yesterday_TpPrice) {
      NMF=NMF+today_TpPrice*STK_vol[i];     //NegativeMoneyFlow 加總
    }
    MFI[day]=PMF/(PMF+NMF)*100;   //第1個MFI值，例：MFI(10)
    eMFI[day]=PMF/(PMF+NMF)*100;  //初值,指數平滑移動平均eMFI(10)=MFI(10)
  }
  for(let i=day+1; i<STK_close.length; i++) {  //例:i=11 to 2000
    //下面是：先扣除10天前的PositiveMoneyFlow、NegativeMoneyFlow
    yesterday_TpPrice=(STK_high[i-day]+STK_low[i-day]+STK_close[i-day])/3;
    //TypicalPrice 昨天的,第1天
    today_TpPrice=(STK_high[i-day+1]+STK_low[i-day+1]+STK_close[i-day+1])/3;
    //TypicalPrice 今天的,第2天
    if(today_TpPrice > yesterday_TpPrice) {
      PMF=PMF-today_TpPrice*STK_vol[i-day+1]; }   //PositiveMoneyFlow扣除10天前
    else if(today_TpPrice < yesterday_TpPrice) {
      NMF=NMF-today_TpPrice*STK_vol[i-day+1];     //NegativeMoneyFlow扣除10天前
    }
    //上面是：先扣除10天前的PositiveMoneyFlow、NegativeMoneyFlow
    yesterday_TpPrice=(STK_high[i-1]+STK_low[i-1]+STK_close[i-1]);
    //TypicalPrice 昨天的
    today_TpPrice=(STK_high[i]+STK_low[i]+STK_close[i])/3;
    //TypicalPrice 今天的
    if(today_TpPrice > yesterday_TpPrice) {
      PMF=PMF+today_TpPrice*STK_vol[i]; }   //PositiveMoneyFlow 加總
    else if(today_TpPrice < yesterday_TpPrice) {
      NMF=NMF+today_TpPrice*STK_vol[i];     //NegativeMoneyFlow 加總
    }
    MFI[i]=PMF/(PMF+NMF)*100;   //第2個MFI值，例：MFI(11)
    eMFI[i]=(esp-1)/(esp+1)*eMFI[i-1]+2/(esp+1)*MFI[i];
    //eMFI今=(n-1)/(n+1)*eMFI昨+2/(n+1)*MFI今。參數=9,<本人自創>
    //第2個eMFI值，例：eMFI(11), eMFI=11,12,...,2000.
  }
  return { MFI, eMFI };   //MoneyFlowIndex
  //drawing the MFI[] and eMFI[] figures in the small windows.
  //if day=10, MFI[], eMFI[]=10,11,...,2000.
}
window.MoneyFlowIndex = MoneyFlowIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-15====modified on 2026-Feb-23===
//PVI正成交量指標(PVI, Positive Volume Index)
//PVI=100,初值設為100，若第t日成交量小於前一日(t-1)成交量，則PVI不變
//PVI今=PVI昨*(今C-昨C)/昨C。若第t日成交量大於前一日(t-1)成交量
//ePVI今=(n-1)/(n+1)*ePVI昨+2/(n+1)*PVI今。參數=9,<本人自創>
//上式也有使用"加號"的。
function PositiveVolIndex(STK_close, STK_vol, esp) {
  // Menu Name: Positive Volume Index     // esp=9,
  const PVI=[], ePVI=[];
  PVI[1]=100;        //初值
  ePVI[1]=PVI[1];    //初值,指數平滑移動平均,自創
  for(let i=2; i<STK_close.length; i++) {   //i=2 to 2000
    if(STK_vol[i] > STK_vol[i-1]) {  //若第t日成交量大於前一日(t-1)成交量
      PVI[i]=PVI[i-1]*(STK_close[i]-STK_close[i-1])/STK_close[i-1]; }
    else {   //if(STK_vol[i]<STK_vol[i-1]) {
      PVI[i]=PVI[i-1];   //若第t日成交量小於前一日(t-1)成交量，則PVI不變
    }
    ePVI[i]=(esp-1)/(esp+1)*ePVI[i-1]+2/(esp+1)*PVI[i];
    //ePVI今=(n-1)/(n+1)*ePVI昨+2/(n+1)*PVI今。參數=9,<本人自創>
  }
  return { PVI, ePVI };
  //drawing the PV[]I and ePVI[] figures in the small windows.
  //PVI[], ePVI[]=1,2,3,...,2000.
}
window.PositiveVolIndex = PositiveVolIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-15====modified on 2026-Feb-23===
//NVI負成交量指標(NVI, Negative Volume Index)
//NVI=100,初值設為100，若第t日成交量大於前一日(t-1)成交量，則NVI不變
//NVI今=NVI昨*(今C-昨C)/昨C。若第t日成交量小於前一日(t-1)成交量
//上式也有使用"加號"的。
//eNVI今=(n-1)/(n+1)*eNVI昨+2/(n+1)*NVI今。參數=9,<本人自創>
function NegativeVolIndex(STK_close, STK_vol, esp) {
  // Menu Name: Negative Volume Index   // esp=9
  const NVI=[], eNVI=[];
  NVI[1]=100;        //初值
  eNVI[1]=NVI[1];    //初值,指數平滑移動平均
  for(let i=2; i<STK_close.length; i++) {   //i=2 to 2000
    if(STK_vol[i] < STK_vol[i-1]) {  //若第t日成交量小於前一日(t-1)成交量
      NVI[i]=NVI[i-1]*((STK_close[i]-STK_close[i-1])/STK_close[i-1]); }
    else {   //else if(STK_vol[i]>STK_vol[i-1])
      NVI[i]=NVI[i-1];   //若第t日成交量大於前一日(t-1)成交量，則PVI不變
    }
    eNVI[i]=(esp-1)/(esp+1)*eNVI[i-1]+2/(esp+1)*NVI[i];
    //eNVI今=(n-1)/(n+1)*eNVI昨+2/(n+1)*NVI今。參數=9,<本人自創>
  }
  return { NVI, eNVI };
  //drawing the NVI and eNVI figures in the small windows.
  //NVI[], eNVI[]=1,2,3,...,2000.
}
window.NegativeVolIndex =NegativeVolIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-15===modified on 2026-03-14===
//EMA1=(最高價－最低價)的9日EMA
//EMA2=EMA1的9日EMA
//MI=(EMA1/EMA2)的N日簡單加總，此處N=5。
function MASS(STK_high, STK_low, esp) {
  // Menu Name: MASS Index     // esp=9
  const EMA1=[], EMA2=[], Mass=[], eMass=[];  //宣告EMA1,EMA2,Mass,eMass陣列
  let sum=0;          //前9天sum(最高價－最低價)等
  for(let i=1; i<esp; i++) {   //計算前9筆加總，i=1 to 9
    let sum=sum+(STK_high[i]-STK_low[i]);
  }
  EMA1[esp]=sum/esp;        //第1個EMA1值,EMA1(9)
  EMA2[esp]=EMA1[esp];      //第1個EMA2值,EMA2(9)=EMA1(9)
  sum=EMA1[esp]/EMA2[esp];  //暫時變數加總,EMA1(9)/EMA2(9)
  let mass_n=5;  //此處Mass參數N=5 (一般參數設為25天)
  //計算i=10 to 13
  for(let i=esp+1; i<esp+mass_n-1; i++) {  //i=10 to 13
    EMA1[i]=(esp-1)/(esp+1)*EMA1[i-1]+2/(esp+1)*(STK_high[i]-STK_low[i]);
    EMA2[i]=(esp-1)/(esp+1)*EMA2[i-1]+2/(esp+1)*EMA1[i];
    sum=sum+EMA1[i]/EMA2[i];  //前13天EMA1/EMA2的加總,即Mass(13)的值
  }
  Mass[esp+mass_n-1]=sum;  //第1個Mass值,Mass(13)=Mass(9+5-1)
  eMass[esp+mass_n-1]=Mass[esp+mass_n-1];  //第1個eMass值,eMass(13)=Mass(13)
  //計算i=14 to 2000
  for(let i=esp+mass_n; i<STK_close.length; i++) {  //i=14 to 2000
    EMA1[i]=(esp-1)/(esp+1)*EMA1[i-1]+2/(esp+1)*(STK_high[i]-STK_low[i]);
    EMA2[i]=(esp-1)/(esp+1)*EMA2[i-1]+2/(esp+1)*EMA1[i];
    //要移除第(i-5=9)天的EMA1/EMA2,即5天前的EMA1/EMA2
    sum=sum+EMA1[i]/EMA2[i]-EMA1[i-mass_n]/EMA2[i-mass_n];
    Mass[i]=sum;  //Mass=14,15,...,2000.
    eMass[i]=(esp-1)/(esp+1)*eMass[i-1]+2/(esp+1)*Mass[i];  //eMass=14,15,...,2000.
  }
  return { EMA1, EMA2, Mass, eMass };
  //drawing the EMA1 and EMA2 figures in the K-Line area.
  //drawing the Mass and eMass figures in the small windows.
  // EMA1,EMA2=9,10,...,2000.
  // Mass, eMass=13,14,...,2000.  eMass is useful for the investors 
  // to observe the trend of stock, and to make buy/sell decisions.
}
window.MASS = MASS;
//----------------------------------------------------------------------

//重新設計===designed by Prof Wang, 2026-March-13======
//==Original design date 2025-Dec-16====
//OSCP(Price Oscillator,價格擺動指標)
//OSCP今=(短期MA今－長期MA今)/短期MA今*100%
//eOSCP今=(n-1)/(n+1)*eOSCP昨+2/(n+1)*OSCP今。參數=9,<本人自創>
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
function PriceOSC(STK_close, short_day, long_day, esp) {
  //Menu Name: Price Oscillator    // esp=9 自創
  const PriceOSC=[], ePriceOSC=[];
  if(short_day > long_day) {  //例如: 10>5, 將二者對調,確保short_day比較小。
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
  }
  const shortMA = KingMA(STK_close, short_day);   //例如5天MA
  const longMA = KingMA(STK_close, long_day);     //例如10天MA
  for(let i=long_day; i<STK_close.length; i++) {    //i=10 to 2000
    PriceOSC[i]=(shortMA[i]-longMA[i])/shortMA[i]*100;   //計算第1個OSCP(10)
    if(i==long_day) {      //令eOSCP初值=OSCP初值, 例i=10
      ePriceOSC[i]=PriceOSC[i]; }
    else {                // i>10
      ePriceOSC[i]=(esp-1)/(esp+1)*ePriceOSC[i-1]+2/(esp+1)*PriceOSC[i];
    }
  }
  return { PriceOSC, ePriceOSC } ;
  //drawing the PriceOSC[] and ePriceOSC[] figures in the small windows.
  //if long_day=10 then PriceOSC[], ePriceOSC[]=10,11,...,2000.
}
window.PriceOSC = PriceOSC;
//----------------------------------------------------------------------

//重新設計===designed by Prof Wang, 2026-March-13======
//==Original design date 2025-Dec-16====
//OSCVol(Volume Oscillator,成交量擺動指標)。
//一般稱呼OSCV，本人改稱VolOSC，因為OSC是擺動指標的英文縮寫，Vol是成交量的英文縮寫，合起來就是VolOSC。
//OSCVol今=(短期MA今－長期MA今)/短期MA今*100%
//eOSCVol今=(n-1)/(n+1)*eOSCVol昨+2/(n+1)*OSCVol今。參數=9,<本人自創>
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
function VolumeOSC(STK_vol, short_day, long_day, esp) {  //一般稱呼OSCV
  // Menu Name: Volume Oscillator   // esp=9 自創
  const VolOSC=[], eVolOSC=[];
  if(short_day>long_day) {  //例如: 10>5, 將二者對調,確保short_day比較小。
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
  }
  const shortMA = SimpleMA_vol(STK_vol, short_day);  //例如5天MA
  const longMA = SimpleMA_vol(STK_vol, long_day);    //例如10天MA
  for(let i=long_day; i<STK_close.length; i++) {     //i=10 to 2000
    VolOSC[i]=(shortMA[i]-longMA[i])/shortMA[i]*100;    //計算第1個OSCV(10)
    if(i==long_day) {      //令eOSCV初值=OSCV初值, 例i=10
      eVolOSC[i]=VolOSC[i]; }
    else {                // i>10
      eVolOSC[i]=(esp-1)/(esp+1)*eVolOSC[i-1]+2/(esp+1)*VolOSC[i]; //自創新
    }
  }
  return { VolOSC, eVolOSC };
  //drawing the VolOSC[] and eVolOSC[] figures in the small windows.
  //if long_day=10 then VolOSC[], eVolOSC[]=10,11,...,2000.
}
window.VolumeOSC = VolumeOSC;
//----------------------------------------------------------------------

//重新設計===designed by Prof Wang, 2026-April-08======
//==Original design date 2025-Dec-16====
//MA_vol(Moving Average Volume,移動平均成交量)
function SimpleMA_vol(STK_vol, day) {
  const MA_vol = [];
  let sum = 0;
  for (let i=1; i< day; i++) {  // i=1 to 10
    sum=sum+STK_vol[i];
  }
  MA_vol[day]=sum/day;   //第1個MA_vol值,MA_vol(10)
  for (let i = day+1; i<STK_vol.length; i++) {   // i=11 to 2000
    sum=sum-STK_vol[i-day]+STK_vol[i];     //移除day天前的，加上今天的
    MA_vol[i]=sum/day;     //MA_vol=11,12,...,2000.
  }
  return { MA_vol };
  //drawing the MA_vol figure in the small windows.
  //例參數day=10，則 MA_vol[]=10,11,...,2000.
}
window.SimpleMA_vol = SimpleMA_vol;
//----------------------------------------------------------------------

//===Redesigned by Prof Wang, 2026-March-19=============
//===Original designed by Prof Wang, 2025-Dec-17========
//A/D聚散線(A/D, Accumulation/Distribution Line)
//AD今=AD昨+[(今C-今L)-(今H-今C)]/(今H-今L)*今Vol
//AD今=AD昨+(2今C-今H-今L)/(今H-今L)*今Vol
function AccuDistLine(K_high, K_low, K_close, K_vol) {  //原名: ADL, ADLine
  // Menu Name: AccuDistLine        //一般稱呼：ADL, ADLine
  // AccuDistLine=ADL, most people use ADL, but I use AccuDistLine,
  // because it is more intuitive and easier to understand.
  const AccuDistLine=[];
  AccuDistLine[1]=0;   //初值,第1個AccuDistLine值(1)=0。避免除以0的錯誤 
  //計算第2個AccuDistLine值(2)
  if(K_high[2]-K_low[2]==0) {  //分母為0,避免除以0的錯誤
    AccuDistLine[2]=(K_close[2]/K_close[1]-1)*K_vol[2]+AccuDistLine[1]; } //((Ct/Ct-1)-1)*Volt
  else {
    AccuDistLine[2]=(2*K_close[2]-K_high[2]-K_low[2])/(K_high[2]-K_low[2])*K_vol[2]+AccuDistLine[2];
  }
  //計算i=3 to 2000
  for(let i=3; i<K_close.length; i++) {   //i=3 to 2000
    if(K_high[i]-K_low[i]==0) {            //分母為0,避免除以0的錯誤
      AccuDistLine[i]=(K_close[i]/K_close[i-1]-1)*K_vol[i]+AccuDistLine[i-1]; }
    else {
      AccuDistLine[i]=(2*K_close[i]-K_high[i]-K_low[i])/(K_high[i]-K_low[i])*K_vol[i]+AccuDistLine[i-1];
    } 
  }
  return { AccuDistLine };
  //drawing the AccuDistLine figure in the small windows.
  //AccuDistLine=1,2,...,2000.
}
window.AccuDistLine = AccuDistLine;
//----------------------------------------------------------------------

//===Redesigned by Prof Wang, 2026-April-13=============
//===Original designed by Prof Wang, 2025-Dec-18========
//Chaikin Oscillator蔡金擺動指標
//ChaikinOscillator=短期EMA(ADLine)-長期EMA(ADLine)
// =EMA(ADLine, short_day)-EMA(ADLine, long_day)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ChaikinOSC(K_high, K_low, K_close, K_vol, short_day, long_day, esp) { 
  //Menu Name: ChaikinOSC 
  //e.g., short_day=5, long_day=10,   esp=9
  if(short_day>long_day) {  //例如: 10>5, 將二者對調,確保short_day比較小。
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
 }
  const ADLine = AccuDistLine(K_high, K_low, K_close, K_vol);  //取得ADLine值=1,2,...,2000.
  // shortEMA(ADLine, short_day)的計算
  const shortEMA_ADLine = [];     // i=1 to 2000
  //simpleEMA, the first simpleEMA[1]=values[1]
  shortEMA_ADLine[1]=K_close[1];  //=1,2,...,2000
  for(let i=2; i<K_close.length; i++) {  //i=2 to 2000
    shortEMA_ADLine[i]=(short_day-1)/(short_day+1)*shortEMA_ADLine[i-1]+2/(short_day+1)*ADLine[i];
  }
  // longEMA(ADLine, long_day)的計算
  const longEMA_ADLine = [];     // i=1 to 2000
  //simpleEMA, the first simpleEMA[1]=values[1]
  longEMA_ADLine[1]=K_close[1];  //=1,2,...,2000
  for(let i=2; i<K_close.length; i++) {  //i=2 to 2000
    longEMA_ADLine[i]=(long_day-1)/(long_day+1)*longEMA_ADLine[i-1]+2/(long_day+1)*ADLine[i];
  }
  const ChaikinOSC = [];    //例如：1 to 2000
  const eChaikinOSC = [];   //例如：1 to 2000
  for(let i=1; i<K_close.length; i++) {   //i=1 to 2000
    ChaikinOSC[i]=shortEMA_ADLine[i]-longEMA_ADLine[i];   //計算第1個ChaikinOSC
    if(i==1) {      //令eChaikinOscillator初值=ChaikinOscillator初值, i=1
      eChaikinOSC[i]=ChaikinOSC[i]; }
    else {                // i>=2, <本人自創>
      eChaikinOSC[i]=(esp-1)/(esp+1)*eChaikinOSC[i-1]+2/(esp+1)*ChaikinOSC[i];
    }
  }
  return { ChaikinOSC, eChaikinOSC };
  //drawing the ChaikinOSC[], eChaikinOSC[] figures in the small windows.
  //ChaikinOSC[], eChaikinOSC[]=1,...,2000.
}
window.ChaikinOSC = ChaikinOSC;
//=====================原來的設計======================================
/*function computeChaikinOscillator(short_day, long_day, esp) {  
  //e.g., short_day=5, long_day=10, esp=9
  if(short_day>long_day) {  //例如: 10>5, 將二者對調,確保short_day比較小。
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
 }
  const ADLine = computeADLine();  //取得ADLine值=1,2,...,2000.
  const shortEMA = computeEMA(ADLine, short_day);
  const longEMA = computeEMA(ADLine, long_day);
  const ChaikinOscillator = [];    //例如：10 to 2000, long_day=10,11,...,2000
  const eChaikinOscillator = [];   //例如：10 to 2000, long_day=10,11,...,2000
  //let eChaikinOscillator_n=9;      //指數平滑移動平均參數=9,變數名稱太長
  //let eCO_n=9;      //指數平滑移動平均參數=9, eChaikinOscillator_n=9。參數=9,<本人自創>
  for(let i=long_day; i<STK_close.length; i++) {   //i=10 to 2000
    ChaikinOscillator[i]=shortEMA[i]-longEMA[i];   //計算第1個ChaikinOscillator(10)
    if(i==long_day) {      //令eChaikinOscillator初值=ChaikinOscillator初值, 例i=10
      eChaikinOscillator[i]=ChaikinOscillator[i]; }
    else {                // i>10, <本人自創>
      eChaikinOscillator[i]=(esp-1)/(esp+1)*eChaikinOscillator[i-1]+2/(esp+1)*ChaikinOscillator[i];
    }
  }
  return { ChaikinOscillator, eChaikinOscillator };
  //drawing the ChaikinOscillator,eChaikinOscillator figures in the small windows.
  //ChaikinOscillator,eChaikinOscillator=long_day,...,2000=10,11,...,2000.
}
  */
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-20=============
//Chaikin Volatility蔡金波動性指標
//Range=High-Low, Range[]=1 to 2000
//RangeEMA=(n-1)/(n+1)*RangeEMA昨+2/(n+1)*Range今,例如:N=10, RangeEMA=2 to 2000
//Chaikin Volatility=(今RangeEMA-N日前的RangeEMA)/N日前的RangeEMA, 例:N=10
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ChaikinVolatility(K_high, K_low, N_days_ago, esp) { 
  // Menu Name: Chaikin Volatility    // N_days_ago=10, esp=9
  const Range = [];   // Range=High-Low, Range[]=1 to 2000
  for(let i=1; i<K_high.length; i++) {   //i=1 to 2000
    Range[i]=K_high[i]-K_low[i];
  }
  //compute RangeEMA[]=2 to 2000
  //RangeEMA=(n-1)/(n+1)*RangeEMA昨+2/(n+1)*Range今
  const RangeEMA = [];    //例如:N=10, RangeEMA=2 to 2000
  RangeEMA[1]=Range[1];   //令RangeEMA初值=Range初值, 例i=1
  for(let i=2; i<K_high.length; i++) {   //i=2 to 2000
    RangeEMA[i]=(esp-1)/(esp+1)*RangeEMA[i-1]+2/(esp+1)*Range[i];
  }
  //compute ChaikinVolatility[]=11 to 2000, 例如:N=10
  //Chaikin Volatility=(今RangeEMA-N日前的RangeEMA)/N日前的RangeEMA
  const ChaikinVolatility = [];
  const eChaikinVolatility = [];   //自創新
  for(let i=N_days_ago+1; i<K_high.length; i++) {   //i=11 to 2000
    ChaikinVolatility[i]=(RangeEMA[i]-RangeEMA[i-N_days_ago])/RangeEMA[i-N_days_ago]*100;
    if(i==N_days_ago+1) {   //i=11, //自創新
      eChaikinVolatility[i]=ChaikinVolatility[i];} //令eChaikinVolatility初值=ChaikinVolatility初值, 例i=11
    else {   //i=12 to 2000
      eChaikinVolatility[i]=(esp-1)/(esp+1)*eChaikinVolatility[i-1]+2/(esp+1)*ChaikinVolatility[i];
    }
  }
  return { ChaikinVolatility, eChaikinVolatility };
  //drawing the ChaikinVolatility[] and eChaikinVolatility[] figures in the small windows.
  //if N_days_ago=10, then ChaikinVolatility[], eChaikinVolatility[]=11,12,...,2000.
}
window.ChaikinVolatility = ChaikinVolatility;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-20=============
//Chaikin Volatility蔡金波動性指標
//Range=High-Low, Range[]=1 to 2000
//RangeEMA=(n-1)/(n+1)*RangeEMA昨+2/(n+1)*Range今,例如:N=10, RangeEMA=2 to 2000
//Chaikin Volatility=(今RangeEMA-N日前的RangeEMA)/N日前的RangeEMA, 例:N=10
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ChaikinVolatilityMaxMin(K_high, K_low, N_days) { 
  // Menu Name: Chaikin Volatility MaxMin    //N_days=10, esp=9
  //111111111111111111111111111111------------compute Range=1 to 2000
  //compute Range, Range=High-Low, Range[]=1 to 2000
  const Range = [];  //也可取名:High_Low[]=High-Low, Range[]=1 to 2000
  for(let i=1; i<K_high.length; i++) {   //i=1 to 2000
    Range[i]=K_high[i]-K_low[i];
  }
  //222222222222222222222222222222---compute maxHigh_minLow=10 to 2000
  let maxHigh, minLow;
  maxHigh=K_high[1], minLow=K_low[1]; //設第1筆=最大值和最小值
  for(let i=2; i<N_days; i++) {      //從i=2筆找到i=10筆
    if(K_high[i]>maxHigh) maxHigh=K_high[i];
    if(K_low[i]<minLow) minLow=K_low[i];
  }
  const maxHigh_minLow=[]; //=10 to 2000
  //(maxHigh within 10 days)-(minLow within 10 days)
  maxHigh_minLow[N_days]=maxHigh-minLow;  //第1筆=10
  //從i=11 to 2000, 每次比較新的一筆和前10筆的最大值和最小值
  for(let i=N_days+1; i<K_high.length; i++) {   //i=11 to 2000
    maxHigh=K_high[i-N_days+1]; //設第2筆=最大值
    minLow=K_low[i-N_days+1];   //設第2筆=最小值
    for(let j=i-N_days+2; j<=i; j++) {  //從第3筆找到第11筆
      if(K_high[j]>maxHigh) maxHigh=K_high[j];
      if(K_low[j]<minLow) minLow=K_low[j];
    }
    maxHigh_minLow[i]=maxHigh-minLow;  //第2筆=11 to 2000
  }  //以上maxHigh_minLow[]=10 to 2000,全部算好.
  // N_days=esp=10;指數平滑移動平均的參數:exponential smoothing parameter(esp)
  //333333333333333333333333333333--------compute RangeEMA=1 to 2000
  //compute RangeEMA, RangeEMA=(n-1)/(n+1)*RangeEMA昨+2/(n+1)*Range今,
  // 例如:N=10, RangeEMA=1 to 2000
  const RangeEMA=[];      //例如:N_days=10, RangeEMA=1 to 2000
  RangeEMA[1]=Range[1];   //令RangeEMA初值=Range初值, 例i=1
  let esp=N_days;         //esp=10
  for(let i=2; i<K_high.length; i++) {   //i=2 to 2000
    RangeEMA[i]=(esp-1)/(esp+1)*RangeEMA[i-1]+2/(esp+1)*Range[i];
  }
  //4444444444444444444444444444---compute EMA_maxHigh_minLow=10 to 2000
  //compute EMA_maxHigh_minLow[]=10 to 2000
  //EMA_maxHigh_minLow=(n-1)/(n+1)*EMA_maxHigh_minLow昨+2/(n+1)*maxHigh_minLow今
  const EMA_maxHigh_minLow=[];   //EMA_maxHigh_minLow=10 to 2000   
  EMA_maxHigh_minLow[N_days]=maxHigh_minLow[N_days]; //=10
  //令EMA_maxHigh_minLow初值=maxHigh_minLow初值, 例i=N_days
  for(let i=N_days+1; i<K_high.length; i++) {   //i=11 to 2000
    EMA_maxHigh_minLow[i]=(esp-1)/(esp+1)*EMA_maxHigh_minLow[i-1]+2/(esp+1)*maxHigh_minLow[i];
  }
  //555555555555555555555555555---compute ChaikinVolatility=10 to 2000
  //compute ChaikinVolatility[]=10 to 2000, 例如:N=10
  //Chaikin Volatility=(今EMA_maxHigh_minLow-N日前的EMA_maxHigh_minLow)/N日前的EMA_maxHigh_minLow
  const ChaikinVolatility = [];  
  const eChaikinVolatility = [];   //自創新
  for(let i=N_days; i<K_high.length; i++) {   //i=10 to 2000
    ChaikinVolatility[i]=(RangeEMA[i]-EMA_maxHigh_minLow[i])/EMA_maxHigh_minLow[i]*100;
    if(i==N_days) {   //i=10, //自創新
      eChaikinVolatility[i]=ChaikinVolatility[i];} //令eChaikinVolatility初值=ChaikinVolatility初值
    else {   //i=12 to 2000
      eChaikinVolatility[i]=(esp-1)/(esp+1)*eChaikinVolatility[i-1]+2/(esp+1)*ChaikinVolatility[i];
    }
  }
  return { ChaikinVolatility, eChaikinVolatility };
  //drawing the ChaikinVolatility[] and eChaikinVolatility[] figures in the small windows.
  //if N_days=10, then ChaikinVolatility[], eChaikinVolatility[]=10,12,...,2000.
}
window.ChaikinVolatilityMaxMin = ChaikinVolatilityMaxMin;
//----------------------------------------------------------------------

//===Redesigned by Prof Wang, 2026-March-21=============
//===Original designed by Prof Wang, 2025-Dec-18========
//Chaikin Money Flow (CMF) 蔡金資金流向指標  (蔡金=佳慶)
//CLV=(2今C-今H-今L)/(今H-今L), Close Location Value(CLV)=Money Flow Multiplier
//CMF=sum(今CLV X 今Vol)/sum(今Vol)  , 例:20天CMF
function ChaikinMoneyFlow(K_high, K_low, K_close, K_vol, day, esp) {
  // Menu Name: Chaikin Money Flow(CMF)     //蔡金資金流向指標
  // day: the number of days for CMF calculation (e.g., 20)
  // esp: the parameter for exponential smoothing (e.g., 9)指數平滑移動平均
  const CMF=[], eCMF=[];      //例如：=20,21,...,2000.  <本人自創>
  let sum_CLV, sum_Vol=0;     //分子與分母暫時變數,初值=0
  //先加總前20天的sum(今CLV X 今Vol)/sum(今Vol), 分子與分母
  for(let i=1; i<day; i++) {   //例:i=1 to 20
    sum_CLV=sum_CLV+((2*K_close[i]-K_high[i]-K_low[i])/(K_high[i]-K_low[i]))*K_vol[i];
    sum_Vol=sum_Vol+K_vol[i];
  }
  //計算第1個CMF值, 例:CMF(20)
  CMF[day]=sum_CLV/sum_Vol;   
  eCMF[day]=CMF[day];    //令eCMF初值=CMF初值, <本人自創>
  for(let i=day+1; i<K_close.length; i++) {   //例:i=21 to 2000
    //要移除第(i-20)天的CLV X Vol, 即20天前的CLV X Vol
    sum_CLV=sum_CLV-((2*K_close[i-day]-K_high[i-day]-K_low[i-day])/(K_high[i-day]-K_low[i-day]))*K_vol[i-day];
    sum_Vol=sum_Vol-K_vol[i-day];
    //加上今天的CLV X Vol, sum_CLV與sum_Vol
    sum_CLV=sum_CLV+((2*K_close[i]-K_high[i]-K_low[i])/(K_high[i]-K_low[i]))*K_vol[i];
    sum_Vol=sum_Vol+K_vol[i];
    CMF[i]=sum_CLV/sum_Vol;   //計算CMF值, 例:CMF(21), CMF=21,22,...,2000.
    eCMF[i]=(esp-1)/(esp+1)*eCMF[i-1]+2/(esp+1)*CMF[i];
    //eCMF今=(n-1)/(n+1)*eCMF昨+2/(n+1)*CMF今。參數=9,<本人自創>指數平滑移動平均
  }
  return { CMF, eCMF };
  //drawing the CMF, eCMF figures in the small windows.
  //if day=20, then CMF[], eCMF[]=20,21,...,2000.
}
window.ChaikinMoneyFlow = ChaikinMoneyFlow;
//----------------------------------------------------------------------

//重新設計===redesigned by Prof Wang, 2026-March-21======
//==Original design date on 2025-Dec-20=================
//ASI累積擺動指標(ASI, Accumulation Swing Index),此指標計算繁瑣
function ASI(STK_open, STK_high, STK_low, STK_close, ma_day, esp) {
  // Menu Name: Accumulation Swing Index(ASI)    //ASI累積擺動指標
  // ASI的移動平均=ASIma,天數=ma_day,例如=10。
  // ASI的移動平均=ASIma, ASIma的指數平滑移動平均=eASIma,參數=esp=9.
  const ASI=[];    //ASI[]=1,2,...,2000
  const ASIma=[], eASIma=[];  //if ma_day=10, then ASIma, eASIma=11,12,...,2000
  let sum_ASI=0;  //加總移動平均ASI的值
  ASI[1]=0;       //第1天的ASI[]無資料
  //計算第1天到第ma_day天(例如=10天)的ASI,它是從第1天開始累加的
  let aa=0,bb=0,cc=0,dd=0,ee=0,ff=0,gg=0,mm=0,kk=0,rr=0;  //宣告變數
  for(let i=2; i<ma_day+1; i++) {   //例如: i=2 to 11,共10天
    aa=Math.abs(STK_high[i]-STK_close[i-1]);
    bb=Math.abs(STK_low[i]-STK_close[i-1]);
    cc=Math.abs(STK_high[i]-STK_low[i-1]);
    dd=Math.abs(STK_close[i]-STK_open[i-1]);
    ee=STK_close[i]-STK_close[i-1];
    ff=STK_close[i]-STK_open[i];
    gg=STK_close[i-1]-STK_open[i-1];
    mm=ee+ff/2+gg/4;
    kk=Math.max(aa,bb);
    switch(true) {
      case Math.max(aa,bb,aa)==aa:
        rr=aa+bb/2+dd/4;     //為何不能寫為: let rr=....
        break;
      case Math.max(aa,bb,aa)==bb:
        rr=bb+aa/2+dd/4;
        break;
      case Math.max(aa,bb,aa)==cc:
        rr=cc+dd/4;
        break;
    }
    ASI[i]=ASI[i-1]+kk*mm/rr*50;   //ASI=2,3,...,11.  例:ma_day=10天
  }
  ASIma[i]=ASI[i]/ma_day;    //ASIma=11,第1個ASI的移動平均=ASIma(11)
  eASIma[i]=ASIma[i];        //eASIma=11,第1個ASIma指數平滑移動平均=eASIma(11),令相等。
  sum_ASI=ASI[i];            //加總移動平均ASI的值
  //計算其餘的ASI等例如:i=12 to 2000, ASI的移動平均=ASIma,天數=ma_day=10天
  for(let i=ma_day+2; i<STK_close.length; i++) {   //例如: i=12 to 2000.
    aa=Math.abs(STK_high[i]-STK_close[i-1]);
    bb=Math.abs(STK_low[i]-STK_close[i-1]);
    cc=Math.abs(STK_high[i]-STK_low[i-1]);
    dd=Math.abs(STK_close[i]-STK_open[i-1]);
    ee=STK_close[i]-STK_close[i-1];
    ff=STK_close[i]-STK_open[i];
    gg=STK_close[i-1]-STK_open[i-1];
    mm=ee+ff/2+gg/4;
    kk=Math.max(aa,bb);
    switch(true) {
      case Math.max(aa,bb,aa)==aa:
        rr=aa+bb/2+dd/4;
        break;
      case Math.max(aa,bb,aa)==bb:
        rr=bb+aa/2+dd/4;
        break;
      case Math.max(aa,bb,aa)==cc:
        rr=cc+dd/4;
        break;
    }
    ASI[i]=ASI[i-1]+kk*mm/rr*50;   //ASI=12,13,...,2000. 例:ma_day=10天
    //加總移動平均ASI的值sum_ASI,要先扣除10天前的(ASI(2)),再加上新的ASI(12)
    sum_ASI=sum_ASI-ASI[i-ma_day]+ASI[i];
    ASIma[i]=sum_ASI/ma_day;   //移動平均ASIma的時間長度=10天
    //ASIma的指數平滑移動平均=eASIma,參數=esp=9
    eASIma[i]=((esp-1)/(esp+1))*eASIma[i-1]+(2/(esp+1))*ASIma[i];
    //eASIma今=(n-1)/(n+1)*eASIma昨+2/(n+1)*ASIma今。參數=9,<本人自創>指數平滑移動平均
  }
  return { ASI, ASIma, eASIma };
  //drawing the ASI, ASIma, eASIma figures in the small windows.
  //ASI[]=1,2,...,2000. ASIma,eASIma=11,12,...,2000
  //ASI的移動平均=ASIma,天數=ma_day=10天, ASIma=11,12,...,2000.
  //設指數平滑移動平均參數=esp=9, eASIma=11,12,...,2000.
}
window.ASI = ASI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2025-Dec-20===modified on 2026-March-17==
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//TRIX(Triple Exponential Average)三重指數平滑移動平均指標
//對數據進行三次平滑處理，再根據這條移動平均線的變動情況來預測股價的長期走勢。
function TRIX(K_close, esp) {
  // Menu Name: TRIX          // esp=9, 指數平滑移動平均參數
  const EMA1=[], EMA2=[], EMA3=[];   // =1 to 2000
  const TRIX=[], eTRIX=[];           // =2 to 2000
  EMA1[1]=K_close[1];   //第1個EMA1值,EMA1(1)=close(1)
  EMA2[1]=EMA1[1];      //第1個EMA2值,EMA2(1)=EMA1(1)
  EMA3[1]=EMA2[1];      //第1個EMA3值,EMA3(1)=EMA2(1)
  //計算i=esp+1 to 2000
  for(let i=2; i<K_close.length; i++) {  //i=2 to 2000
    EMA1[i]=(esp-1)/(esp+1)*EMA1[i-1]+2/(esp+1)*K_close[i];
    EMA2[i]=(esp-1)/(esp+1)*EMA2[i-1]+2/(esp+1)*EMA1[i];
    EMA3[i]=(esp-1)/(esp+1)*EMA3[i-1]+2/(esp+1)*EMA2[i];
    // TRIX 是第三次 EMA 的「變動率」  //計算TRIX值(進行變化率計算)
    TRIX[i]=(EMA3[i]-EMA3[i-1])/EMA3[i-1]*100;   //TRIX=2,3,...,2000.
    //計算TRIX的EMA(指數平滑移動平均)
    if(i==2) {
      eTRIX[i]=TRIX[i];}  //第1個eTRIX值,eTRIX(2)=TRIX(2)
    else {
      eTRIX[i]=(esp-1)/(esp+1)*eTRIX[i-1]+2/(esp+1)*TRIX[i];  //eTRIX=2,3,...,2000.
    }
  }
  return { TRIX, eTRIX };
  //drawing the TRIX and eTRIX figures in the small windows.
  //EMA1, EMA2, EMA3=1,2,...,2000.   // TRIX, eTRIX=2,3,...,2000.
}  
window.TRIX = TRIX; 
//=====================================原設計程式如下：
/*
 const EMA1=[], EMA2=[], EMA3=[], EMA4=[], TRIX=[];
  let sum=0;      //暫時變數,前esp天sum(close)等
  for(let i=1; i<esp; i++) {   //計算前esp筆加總，i=1 to 9
    let sum=sum+K_close[i];
  }
  EMA1[esp]=sum/esp;        //第1個EMA1值,EMA1(9)
  EMA2[esp]=EMA1[esp];      //第1個EMA2值,EMA2(9)=EMA1(9)
  EMA3[esp]=EMA2[esp];      //第1個EMA3值,EMA3(9)=EMA2(9)
  EMA4[esp]=EMA3[esp];      //第1個EMA4值,EMA4(9)=EMA3(9)
  //計算i=esp+1 to 2000
  for(let i=esp+1; i<K_close.length; i++) {  //i=10 to 2000
    EMA1[i]=(esp-1)/(esp+1)*EMA1[i-1]+2/(esp+1)*K_close[i];
    EMA2[i]=(esp-1)/(esp+1)*EMA2[i-1]+2/(esp+1)*EMA1[i];
    EMA3[i]=(esp-1)/(esp+1)*EMA3[i-1]+2/(esp+1)*EMA2[i];
    //再對EMA3(三次指數平滑移動平均)進行指數平滑移動平均
    EMA4[i]=(esp-1)/(esp+1)*EMA4[i-1]+2/(esp+1)*EMA3[i];
    //計算TRIX值(進行變化率計算)
    TRIX[i]=(EMA3[i]-EMA3[i-1])/EMA3[i-1]*100;   //TRIX=10,11,...,2000.
  }
  return { EMA3, EMA4, TRIX };
  //drawing the EMA3, EMA4 and TRIX figures in the small windows.
  //EMA3,EMA4=9,10,...,2000.
  //TRIX=10,11,...,2000. */
//----------------------------------------------------------------------

// COMPUTE MAoneMAtwo FUNCTION and COMPUTE MAone FUNCTION ARE FOR BACKTESTING PURPOSES ONLY
// THEY ARE NOT USED FOR PLOTTING INDICATOR CHARTS
//===designed by Prof Wang, 2026-Jan-08 in HaNoi International Airport==
//===重新設計===modified on 2026-Apr-06===
//Follow-The-Wave Strategy (FWS策略指標)。此處有MA1與MA2兩條均線
//當股價由下往上突破MA1時買進，當股價由上往下突破MA2時賣出
function MAoneMAtwo(STK_close, day1, day2) {    // day1<day2
  // Menu Name: MAoneMAtwo      // day1=5, day2=10
  let temp1=Math.min(day1, day2);  //確保day1較小
  let temp2=Math.max(day1, day2);  //確保day2較大
  day1=temp1;   //確保day1比較小
  day2=temp2;   //確保day2比較大
  const MA1 = window.KingMA(STK_close, day1); //例如5天MA1
  const MA2 = window.KingMA(STK_close, day2); //例如10天MA2
  let RR=0;        //報酬率初值=0
  let Acc_RR=0;    //累積報酬率初值=0
  let BS_times=0;  //累積買賣次數=0
  let bs_flag="N"; //初始值表示空手
  let buy_price=0; //買進價格初值=0
  let sell_price=0; //賣出價格初值=0
  //判斷day1=5,第一天是否是買點
  if(STK_close[day1]>MA1[day1]) {   //條件成立，表示買點早已出現
    buy_price=STK_close[day1]; 
    bs_flag="Y";  //表示已買。此列好像可省略
  }
  for(let i=day1+1; i<STK_close.length; i++) {  //例:i=5+1 to 2000
    if((STK_close[i-1]<MA1[i-1]) & (STK_close[i]>MA1[i]) & bs_flag=="N") {
      buy_price=STK_close[i]; 
      bs_flag="Y"; }
    else if((STK_close[i-1]>MA2[i-1]) & (STK_close[i]<MA2[i])) {
      sell_price=STK_close[i];
      //compute RR, Acc_RR
      RR=(sell_price-buy_price)/buy_price*100;
      Acc_RR=Acc_RR+RR;
      BS_times=BS_times+1;
      bs_flag="N";   //表示空手。此列好像可省略
    }  
  }  
  return {MA1, MA2, STK_close, Acc_RR, BS_times, Avg_RR: Acc_RR/BS_times};
  //累積報酬率，累積買賣次數，平均一次報酬率
  // drawing (MA1, MA2, STK_close) in the K_Line area
  // (Acc_RR, BS_times, Avg_RR: Acc_RR/BS_times) in the Text area
}
window.MAoneMAtwo=MAoneMAtwo;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-09==modified on 2026-April-14==
//Follow-The-Wave Strategy (FWS策略指標)。此處只有MA1均線
//當股價由下往上突破MA1時買進，當股價由上往下突破MA1時賣出
function MAone(STK_close, day1) {
  // Menu Name: MAone      // day1=5, =10
  const MA1 = window.KingMA(STK_close, day1); //例如5天MA1
  let RR=0;        //報酬率初值=0
  let Acc_RR=0;    //累積報酬率初值=0
  let BS_times=0;  //累積買賣次數=0
  let bs_flag="N"; //初始值表示空手
  let buy_price=0; //買進價格初值=0
  let sell_price=0; //賣出價格初值=0
  //判斷day1=5,第一天是否是買點
  if(STK_close[day1]>MA1[day1]) {   //條件成立，表示買點早已出現
    buy_price=STK_close[day1]; 
    bs_flag="Y";  //表示已買。此列好像可省略
  }
  for(let i=day1+1; i<STK_close.length; i++) {  //例:i=5+1 to 2000
    if((STK_close[i-1]<MA1[i-1]) & (STK_close[i]>MA1[i]) & bs_flag=="N") {
      buy_price=STK_close[i]; 
      bs_flag="Y"; }
    else if((STK_close[i-1]>MA1[i-1]) & (STK_close[i]<MA1[i])) {
      sell_price=STK_close[i];
      //compute RR, Acc_RR
      RR=(sell_price-buy_price)/buy_price*100;
      Acc_RR=Acc_RR+RR;
      BS_times=BS_times+1;
      bs_flag="N";   //表示空手。此列好像可省略
    }  
  }  
  return { Acc_RR, BS_times, Avg_RR: Acc_RR/BS_times };
  //累積報酬率，累積買賣次數，平均一次報酬率
  // drawing (MA1, STK_close) in the K_Line area
  // (Acc_RR, BS_times, Avg_RR: Acc_RR/BS_times) in the Text area
}
window.MAone=MAone;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-13==modified on 2026-April-16==
//Coppock Curve 估波指標   <2026-Jan-13>
//Rate of Change(ROC), short_ROC, and long_ROC, composite_ROC
//輸入參數:short_day=10, long_day=20, weight_day=10
function CoppockCurve(STK_close, short_day, long_day, wgt_day) {
  // Menu Name: Coppock Curve
  // short_day=10, long_day=20, weight_day=10
  const short_ROC = [];
  const long_ROC = [];
  const composite_ROC = [];
  const Coppock = [];
  const eCoppock = [];  //eCoppock是Coppock的平滑化
  //確保long_day是最大, 例如:short_day=10, long_day=20
  if(short_day > long_day) {
    let temp=long_day;
    long_day=short_day;
    short_day=temp;   }
  //計算short_day=10的ROC, //short_ROC[]= 11 to 2000
  for(let i=short_day+1; i<STK_close.length; i++) {  //i=11 to 2000
    short_ROC[i]=((STK_close[i]-STK_close[i-short_day])/STK_close[i-short_day]);
  }
  //計算long_day=20的ROC,  //long_ROC[]= 21 to 2000
  for(let i=long_day+1; i<STK_close.length; i++) {  //i=21 to 2000
    long_ROC[i]=((STK_close[i]-STK_close[i-long_day])/STK_close[i-long_day]);
  }
  //計算composite_ROC=short_ROC+long_ROC,add the two ROCs。composite_ROC[]= 21 to 2000
  for(let i=long_day+1; i<STK_close.length; i++) {  //i=21 to 2000
    composite_ROC[i]=short_ROC[i]+long_ROC[i];
  }
  //計算Coppock Curve value, 即composite_ROC的MA, weight_day=10
  let sum=0;    //加總。 //i=21 tO 30, 第1個Coppock(30)
  for(let i=long_day+1; i<long_day+wgt_day; i++) {
    sum=sum+composite_ROC[i];
  }
  Coppock[long_day+wgt_day]=sum/wgt_day;   //第1個Coppock(30)
  eCoppock[long_day+wgt_day]=sum/wgt_day;  //第1個eCoppock(30)
  //計算其餘的Coppock=31,32,...,2000
  for(let i=long_day+wgt_day+1; i<STK_close.length; i++) { //i=31 to 2000
    sum=sum-composite_ROC[i-wgt_day+1];  //先扣除第22筆資料
    sum=sum+composite_ROC[i];            //再加新的第31筆資料
    Coppock[i]=sum/wgt_day;              //第2個Coppock(31)
    //指數平滑移動平均參數可與weight_day=10相同或不同
    eCoppock[i]=(wgt_day-1)/(wgt_day+1)*eCoppock[i-1]+2/(wgt_day+1)*Coppock[i];
  }
  return { Coppock, eCoppock };
  //drawing the Coppock[] figure in the small windows.
  //short_ROC[]=11,12,...2000  //short_day=10, long_day=20, weight_day=10
  //long_ROC[]=21 to 2000
  //composite_ROC[]=21 to 2000
  //Coppock[], eCoppock[]=30,31,...,2000
}
window.CoppockCurve = CoppockCurve;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-15==modified on 2026-April-15===
//MAV移動平均成交量(MAV, Moving Average Volume)
//VolMA=(1/n)(Total trading volume over N days)
//VolMA=N日的總成交量之平均(Average of total trading volume over N days)
function VolumeMA(STK_vol, ma_day, esp) {
  // Menu Name: VolumeMA     //ma_day=10,20,30,...  esp=9,10,...
  const VolMA=[], eVolMA=[];  //移動平均成交量,eVolMA=指數平滑移動平均成交量,自創
  let sum=0;
  for(i=1; i<ma_day; i++) {
    sum=sum+STK_vol[i];
  }
  VolMA[ma_day]=sum/ma_day;  //第1個移動平均成交量=VolMA(10),例:ma_day=10
  eVolMA[ma_day]=sum/ma_day;  //第1個移動平均成交量=eVolMA(10),例:ma_day=10
  for(i=ma_day+1; i<STK_close.length; i++) { //i=11 to 2000.
    sum=sum-STK_vol[i-ma_day]+STK_vol[i];     //先減10天前的+今天第11天的
    VolMA[i]=sum/ma_day;                      //第2個VolMA(11)
    eVolMA[i]=(esp-1)/(esp+1)*eVolMA[i-1]+2/(esp+1)*VolMA[i];  //指數平滑移動平均,esp=9
  }
  return { VolMA, eVolMA };
  //drawing the VolMA[], eVolMA[] figures in the STK_Vol window.
  //ma_day=10, VolMA[], eVolMA[]=10,11,...,2000
}
window.VolumeMA = VolumeMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-15==modified on 2026-April-16===
//M3多空指標乖離,M3=C-(MA5+MA10+MA15+MA20)/4
//M4多空乖離變動率指標,M4=(C-(MA5+MA10+MA15+MA20)/4)/((MA5+MA10+MA15+MA20)/4)*100
function M3(STK_close, esp) {
  // Menu Name: M3         // esp=9, 指數平滑移動平均參數
  const M3=[], eM3=[];    // 自創eM3[]是M3[]的指數平滑移動平均
  const MA5 = KingMA(STK_close,5);
  const MA10 = KingMA(STK_close,10);
  const MA15 = KingMA(STK_close,15);
  const MA20 = KingMA(STK_close,20);
  let avgFourMA;
  //如此設計是為了讓M3[]在前期(5-9)就有數值,以便觀察M3[]的變化趨勢,
  //而不是等到20才有第一個M3[]數值.
  for (let i=5; i<STK_close.length; i++) {  // i=5 to 2000
    switch (true) {
      case i>=5 && i<10:
        avgFourMA=(MA5[i])/1;
        M3[i]=STK_close[i]-avgFourMA; //M3多空乖離指標
        break;
      case i>=10 && i<15:
        avgFourMA=(MA5[i]+MA10[i])/2;
        M3[i]=STK_close[i]-avgFourMA; //M3 多空乖離變動率指標
        break;
      case i>=15 && i<20:
        avgFourMA=(MA5[i]+MA10[i]+MA15[i])/3;
        M3[i]=STK_close[i]-avgFourMA; //M3多空乖離變動率指標
        break;
      case i>=20:
        avgFourMA=(MA5[i]+MA10[i]+MA15[i]+MA20[i])/4;
        M3[i]=STK_close[i]-avgFourMA; //M3多空乖離變動率指標
        break;
    }
    if(i===5) {
      eM3[i]=M3[i]; }    //eM3初值=M3初值
    else {
      eM3[i]=(esp-1)/(esp+1)*eM3[i-1]+2/(esp+1)*M3[i];  //指數平滑esp=9
    }  
  }
  return { M3, eM3 };
  //drawing the M3[] and eM3[] figures in the small windows.
  //M3[] , eM3[]=5,6,...,2000
}
window.M3 = M3;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-April-16===============================
//M4多空乖離變動率指標(Bullish/Bearish Deviation Rate of Change Indicator)
//(本人創新與中英命名, 2026-04-16)
//原來的：M3多空指標乖離,M3=C-(MA5+MA10+MA15+MA20)/4
//M4多空乖離變動率指標,M4=(C-(MA5+MA10+MA15+MA20)/4)/((MA5+MA10+MA15+MA20)/4)*100
function M4(STK_close, esp) {
  // Menu Name: M4       // esp=9, 指數平滑移動平均參數
  const M4=[], eM4=[];   // 自創eM4[]是M4[]的指數平滑移動平均
  const MA5 = KingMA(STK_close,5);
  const MA10 = KingMA(STK_close,10);
  const MA15 = KingMA(STK_close,15);
  const MA20 = KingMA(STK_close,20);
  let avgFourMA;
  //如此設計是為了讓M4[]在前期(5-9)就有數值,以便觀察M4[]的變化趨勢,
  //而不是等到20才有第一個M4[]數值.
  for (let i=5; i<STK_close.length; i++) {  // i=5 to 2000
    switch (true) {
      case i>=5 && i<10:
        avgFourMA=(MA5[i])/1;
        M4[i]=(STK_close[i]-avgFourMA)/avgFourMA*100; //M4多空乖離變動率指標
        break;
      case i>=10 && i<15:
        avgFourMA=(MA5[i]+MA10[i])/2;
        M4[i]=(STK_close[i]-avgFourMA)/avgFourMA*100; //M4多空乖離變動率指標
        break;
      case i>=15 && i<20:
        avgFourMA=(MA5[i]+MA10[i]+MA15[i])/3;
        M4[i]=(STK_close[i]-avgFourMA)/avgFourMA*100; //M4多空乖離變動率指標
        break;
      case i>=20:
        avgFourMA=(MA5[i]+MA10[i]+MA15[i]+MA20[i])/4;
        M4[i]=(STK_close[i]-avgFourMA)/avgFourMA*100;
        break;
    }
    if(i===5) {
      eM4[i]=M4[i]; }    //eM4初值=M4初值
    else {
      eM4[i]=(esp-1)/(esp+1)*eM4[i-1]+2/(esp+1)*M4[i];  //指數平滑esp=9
    }  
  }
  return { M4, eM4 };
  //drawing the M4[] and eM4[] figures in the small windows.
  //M4[] , eM4[]=5,6,...,2000
}
window.M4 = M4;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-16==modified on 2026-April-15===
//DMA平均線差指標(DMA, Difference of Moving Average)
//DMA=MA(short)-MA(long), AMA=average(DMA)
//本程式AMA採用EMA處理DMA, 
function DiffMA(STK_close, short_day, long_day, esp) { //原名: DMA
  //Menu Name: Difference MA      //指數移動平均,係數=esp=9
  //例如:short_day=10, long_day=20
  const DiffMA=[], eDiffMA=[];
  //確保long_day是最大,例如:short_day=10, long_day=20
  let temp;
  if(short_day > long_day) {
    temp=long_day;
    long_day=short_day;
    short_day=temp;  
  }
  const shortMA=KingMA(STK_close, short_day);
  const longMA=KingMA(STK_close, long_day);
  for(let i=long_day; i<STK_close.length; i++) {   //例如: i=20 to 2000
    DiffMA[i]=shortMA[i]-longMA[i];   //DiffMA=短MA-長MA
    if(i===long_day) {
      eDiffMA[i]=DiffMA[i]; }    //初值令相等
    else {                //指數移動平均,係數esp=ema_n=9
      eDiffMA[i]= (esp-1)/(esp+1)*eDiffMA[i-1]+2/(esp+1)*DiffMA[i]; 
    }
  }
  return { DiffMA, eDiffMA };
  //drawing the DiffMA[] and eDiffMA[] figures in the small windows.
  //if short_day=10, long_day=20 then DiffMA[], eDiffMA[]=20,21,...,2000
}
window.DiffMA = DiffMA;
//----------------------------------------------------------------------

//designed by Prof Wang, 2026-Jan-18===(modified on 2026-Feb-21, April-15)
//HMA:Hull Moving Average 赫爾移動平均線
function HullMA(values, day, esp) {
  // Menu Name: HullMA            //values=STK_close[]
  //The parameter <day> can be 10, 15, 20, 30,...
  //esp=9,指數平滑參數=exponential smoothing parameter(esp)
  //例如參數=10:short_day=10/2=5, long_day=10, esp=9
  //day需要為偶數,求餘數的指令= %
  if(day % 2 ===1) {  //確保day為偶數,Ensure <day> is an even number
    day=day+1;  }
  const WMA1 = [];    //例如5天加權移動平均,天數=day/2
  const WMA2 = [];    //例如10天加權移動平均,天數=day
  const RawHMA = [];  //RawHMA=2*WMA1-WMA2
  const HMA = [];     //HMA=avg(sum(RawHMA), 1 to m), m=sqrt(n)=sqrt(10)
  const eHMA = [];    //自創, eHMA今=eMA(HMA)=(n-1)/(n+1)*eHMA昨+2/(n+1)HMA今
  let half_day=day/2; //WMA1加權移動平均天數
  //----------------------WMA1----------------------------------------
  //計算Weighted WMA1(=1/(n/2)Sum(wi*Ci), for (n/2)_days)
  //每個WMA1權重為:1,2,3,4,5,...,(day/2=half_day)
  //例如day=10,則WMA1[]=5,6,...,2000
  let sum_wgt1=0;              //加總WMA1的總權重,要放分母
  for(let i=1; i<half_day; i++) {   //i=1 to 5 (i=1 to day/2)
    sum_wgt1=sum_wgt1+i;       //例如=1+2+3+4+5=15,加總WMA1的總權重,要放分母
  }
  let sum_close=0;   //分子=5天加權收盤價加總
  for(let i=1; i<values.length-half_day+1; i++) {  //i=1 to 1996
    sum_close=0;     //每5天加權收盤價加總之前要歸零
    for(let j=1; j<=half_day; j++) {   //j=1 to 5  (j=1 to day/2)
      sum_close=sum_close+values[i+j-1]*j;   //權重係數=1,2,3,4,5
      //WMA1[]= 5 to 2000
    }
    WMA1[i+half_day-1]=sum_close/sum_wgt1;   //第1筆WMA1(1+5-1)=WMA1(5)
  }
  //----------------------WMA2----------------------------------------
  //計算Weighted WMA2(=1/(n)Sum(wi*Ci), for n_days)
  //每個WMA2權重為:1,2,3,4,5,...,day
  //例如day=10,則WMA2[]=10,11,...,2000
  let sum_wgt2=0;         //加總WMA2的總權重,要放分母
  for(let i=1; i<day; i++) {   //i=1 to 10 (i=1 to day)
    sum_wgt2=sum_wgt2+i;  //例如=1+2+...+10=55,加總WMA2的總權重,要放分母
  }  
  sum_close=0;   //分子=10天加權收盤價加總
  for(let i=1; i<values.length-day+1; i++) {  //i=1 to 1991
    sum_close=0;     //每10天加權收盤價加總之前要歸零
    for(let j=1; j<=day; j++) {     //j=1 to 10  (j=1 to day)
      sum_close=sum_close+values[i+j-1]*j;   //權重係數=1,2,...,10
      //WMA2[]= 10 to 2000
    }
    WMA2[i+day-1]=sum_close/sum_wgt2;   //第1筆WMA2(1+10-1)=WMA2(10)
  }
  //----------------------RawHMA-------------------------------------
  //計算RawHMA,從day=10開始,RawHMA=10 to 2000
  for(let i=day; i<values.length; i++) {  //i=10 to 2000
    RawHMA[i]=2*WMA1[i]-WMA2[i];
  }
  //----------------------HMA--eHMA----------------------------------
  //HMA的移動平均天數m=sqrt(day),無條件進位=Math.ceil(數字),開根號=Math.sqrt(數字)
  //m=HMA的移動平均天數,例如:m=4
  let m=Math.ceil(Math.sqrt(day)); //開根號後再無條件進位,m=HMA的移動平均天數=4
  let sum_wgt=0;         //加總RawHMA的總權重,要放分母
  for(let i=1; i<m; i++) { //i=1 to 4 (i=1 to m)
    sum_wgt=sum_wgt+i;      //例如=1+2+3+4=10,加總RawHMA的總權重,要放分母
  }
  let sum_tp;
  let count;
  for(let i=day+m-1; i<values.length; i++) {  //i=(10+4-1),14,...,2000
    sum_tp=0;
    count=1;
    for(let j=i-m+1; j<=i; j++) { //j=10 to 13  (j=i-m+1 to i)=(j=13-4+1 to 13)=(j=10 to 13)
      sum_tp=sum_tp+RawHMA[j]*count;  //權重分別=1,2,3,4
      count=count+1;
    }
    HMA[i]=sum_tp/sum_wgt;  //第1個HMA(13)=day+m-1
    if(i===(day+m-1)) {     //初值=第1個eHMA(13)
      eHMA[i]=HMA[i]; }
    else {                  //第2筆之後, =14,15,...,2000
      eHMA[i]=(esp-1)/(esp+1)*eHMA[i-1]+2/(esp+1)*HMA[i]; //自創
    }
  }
  return { values, HMA, eHMA };
  //drawing the STK_close[], HMA[], eHMA[] figures in the small windows.
  //Normally drawing the STK_close[], HMA[], eHMA[] figures in the K-Line area.
  //eg:day=10, half_day=5, m=4, esp=ema_n=9
  //STK_close[]=1,2,...2000 
  //HMA[], eHMA[]= 13 to 2000
}
window.HullMA = HullMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-20==modified on 2026-April-17==
//RWI(Random Walk Index)隨機漫步指標
//RWI_High, RWI_Low
//ex. exponential smoothing parameter(esp),esp=9
function RandomWalkIndex(STK_high, STK_low, STK_close, RWI_n, esp) { 
  // Menu Name: Random Walk          // esp=9
  // RWI_n是RWI計算的天數, eg. RWI_n=10
  // TR()=2,3,...,2000,  ATR()=1,2,...,2000
  // 先算TR[], ATR[]
  const RWI_high=[];  //RWI(Random Walk Index)隨機漫步指標
  const RWI_low=[];
  const TR=[];   //True Range(TR)
  const ATR=[];  //ATR=Average True Range
  let tp1, tp2, tp3, max_high, min_low;
  for(let i=2; i<STK_close.length; i++) {
    tp1=STK_high[i]-STK_low[i];
    tp2=Math.abs(STK_high[i]-STK_close[i-1]);
    tp3=Math.abs(STK_low[i]-STK_close[i-1]);
    TR[i]=Math.max(tp1, tp2, tp3);
    if(i===2) {
      ATR[1]=TR[2]; }
    //ATR=ema(TR), ATR今=(n-1)/(n+1)*ATR昨+2/(n+1)*TR今 
    ATR[i]=(esp-1)/(esp+1)*ATR[i-1]+2/(esp+1)*TR[i];
  }
  //start to find RWI_high[] and RWI_low[] values
  for(let i=RWI_n; i<STK_close.length; i++) {  //eg. i=10 to 2000
    max_high=0;
    min_low=999;
    for(let j=i-RWI_n+1; j<=i; j++) {  //j=1 to 10(first time)
      if(STK_high[j]>max_high) {  //eg. 找10天內最大的
        max_high=STK_high[j];  }
      if(STK_low[j]<min_low) {    //eg. 找10天內最小的
        min_low=STK_low[j];  }
    }
    RWI_high[i]=(STK_high[i]-min_low)/(ATR[i]*Math.sqrt(RWI_n));
    RWI_low[i]=(max_high-STK_low[i])/(ATR[i]*Math.sqrt(RWI_n));
    //RWI_high[], RWI_low[]=10,11,...,2000
  }
  return { RWI_high, RWI_low };
  //if RWI_n=10, then RWI_high[], RWI_low[]=10,11,...,2000
  //改為如上程式比較習慣
}
window.RandomWalkIndex = RandomWalkIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-29=================================
//鱷魚線(Alligator Indicator)
//藍色顎線(jaw)，紅色齒線(teeth)，綠色唇線(lip)
//分別計算MP的13日平滑移動平均。計算MP的8日平滑移動平均。計算MP的5日平滑移動平均
function Alligator(K_high, K_Low) { 
  // Menu Name: Alligator       //K_high=STK_high, K_Low=STK_low
  const Jaw_t=[], Teeth_t=[], Lip_t=[];       //暫時變數
  const Jaw_emp=[], Teeth_emp=[], Lip_emp=[]; //MP的指數平滑移動平均=emp
  let MP=0;   //MP=(High+Low)/2
  //first Jaw_t[1], Teeth_t[1], Jip_t[1]
  MP=(K_high[1]+K_Low[1])/2;
  Jaw_t[1]=MP; 
  Teeth_t[1]=MP; 
  Lip_t[1]=MP;
  //compute the rest values of indicators.   e.g. i=2 to 2000
  for(let i=2; i<K_high.length; i++) {      // i=2 to 2000  
    MP=(K_high[i]+K_Low[i])/2;
    Jaw_t[i]=(6/7)*Jaw_t[i-1]+(1/7)*MP;      //藍色顎線(jaw)_在下方
    Teeth_t[i]=(7/9)*Teeth_t[i-1]+(2/9)*MP;  //紅色齒線(teeth)_在中間
    Lip_t[i]=(2/3)*Lip_t[i-1]+(1/3)*MP;      //綠色唇線(lip)_在上方
  }
  //多頭時：藍色顎線(jaw)_在下方。紅色齒線(teeth)_在中間。綠色唇線(lip)_在上方
  //取8天前的Jaw_emp值作為當天的藍色顎線值_在下方
  //取5天前的Teeth_emp值作為當天的紅色齒線值_在中間
  //取3天前的Lip_emp值作為當天的綠色唇線值_在上方
  for(let i=4; i<K_high.length; i++) {   // i=4 to 2000
    Lip_emp[i]=Lip_t[i-3];       //取3天前的Lip值作為當天的綠色唇線值,Lip_emp[4]
    if(i>5) {                    // i=6 to 2000
      Teeth_emp[i]=Teeth_t[i-5]; } //取5天前的Teeth值作為當天的紅色齒線值,Teeth_emp[6]
    if(i>8) {                      // i=9 to 2000
      Jaw_emp[i]=Jaw_t[i-8]; }     //取8天前的Jaw值作為當天的藍色顎線值,Jaw_emp[9]
  }
  //上述整合原本需要用三個LOOP的，變為一個LOOP
  return {Lip_emp, Teeth_emp, Jaw_emp};
  //normally drawing these three indicators in K_Line area
  //in this case, drawing these three indicators and Close_Price in small windows
  //Lip_emp[]=4,...,2000, Teeth_emp[]=6,...,2000, Jaw_emp[]=9,...,2000
}
window.Alligator = Alligator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-30=================================
//Gann HiLo Activator(江恩希洛激活)指標
//內容組合了最高價移動平均線與最低價移動平均線。
//K線的收盤價若在平均線之上時，顯示最低價移動平均線，若在平均線之下，則會顯示最高價移動平均線。
function GannHiLo(K_High, K_Low, K_Close, ma_day) { 
  // Manu Name: Gann HiLo          // example: ma_day=10, =15, =20
  //K_High=STK_high, K_Low=STK_low, K_Close=STK_close
  const MA_high=[], MA_low=[], MA_High_Low=[]; //每天最高價的MA,最低價的MA,整合後的MA
  let High_sum=0;
  let Low_sum=0;
  for(let i=1; i<ma_day; i++) {    // i=1 to 10
    High_sum=High_sum+K_High[i];
    Low_sum=Low_sum+K_Low[i];
  }
  MA_high[ma_day]=High_sum/ma_day;   //first MA_high(10)
  MA_low[ma_day]=Low_sum/ma_day;     //first MA_low(10)
  if(K_Close[ma_day]>MA_low[ma_day]) {
    MA_High_Low[ma_day]=MA_low[ma_day]; } //K線的收盤價若在平均線之上時，顯示最低價移動平均線
  else {
    MA_High_Low[ma_day]=MA_high[ma_day];  //若在平均線之下，則會顯示最高價移動平均線  
  }
  //compute the remaining values of MA_high() and MA_low,  =>11,12,...,2000
  for(let i=ma_day+1; i<K_High.length; i++) {   // i=11 to 2000
    //累加值先扣除前10日的值,再加新值
    High_sum=High_sum-K_High[i-ma_day]+K_High[i];
    Low_sum=Low_sum-K_Low[i-ma_day]+K_Low[i];
    MA_high[i]=High_sum/ma_day;   //second MA_high(11)
    MA_low[i]=Low_sum/ma_day;     //second MA_low(11)
    if(K_Close[i]>MA_low[i]) {
      MA_High_Low[i]=MA_low[i]; } //K線的收盤價若在平均線之上時，顯示最低
    else {
      MA_High_Low[i]=MA_high[i]; //若在平均線之下，則會顯示最高價移動平
    }
  }
  return { K_Close, MA_High_Low };
  //normally drawing MA_High_Low[] in the K_Line area.
  //in this case, drawing STK_close() and MA_High_Low() in the small windows.
  //if ma_day=10, then MA_High_Low()=10,11,...,2000
}
window.GannHiLo = GannHiLo;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-31====modified on 2026-March-21===
//MA的MACD化！  <<完全自創指標,completely self-created indicators >> 
//MAmacd, DIF=MA5-MA10, or DIF=MA10-MA20
function MAmacd(values, ma_day1, ma_day2, esp) { 
  // Menu Name: NewMACD
  // ma_day1<ma_day2. (for example: ma_day1=10, ma_day2=20)
  // esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
  if(ma_day1 > ma_day2) {  //ensure ma_day1 < ma_day2
    let temp=ma_day2;
    ma_day2=ma_day1;
    ma_day1=temp; }
  //呼叫新的MA, computeKingMA=new program of MA[]
  const MA1 = KingMA(values, ma_day1);  //first MA
  const MA2 = KingMA(values, ma_day2);  //second MA
  //計算離差值DIF   (Calculate dispersion value DIF)
  const DIF=[];    //i=20 to 2000
  for(let i=ma_day2; i<values.length; i++) {  //i=20 to 2000
    DIF[i]=MA1[i]-MA2[i];
  }
  // compute MAmacd[]=20,21,...,2000. 指數平滑移動平均值
  const MAmacd=[], BarChart=[]; //宣告MAmacd=ma_day2,...,2000=20,21,...,2000
  MAmacd[ma_day2]=DIF[ma_day2]; //first MAmacd(20)=DIF(20)
  BarChart[ma_day2]=0;
  //let esp=9;             //指數平滑移動平均_參數esp=9
  for(let i=ma_day2+1; i<values.length; i++) {   //i=21 to 2000
    MAmacd[i]=(esp-1)/(esp+1)*MAmacd[i-1]+2/(esp+1)*DIF[i];
    BarChart[i]=(DIF[i]-MAmacd[i])*2   //柱狀圖,enlarge=2 times
  }
  return { DIF, MAmacd, BarChart };
  //drawing DIF[], MAmacd[] and BarChart[] in the small windows.
  //if ma_day2=20, then DIF[] and MAmacd[]=20,21,...,2000
}
window.MAmacd = MAmacd;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01==modified on 2026-April-17==
//VariantMA變異移動均線(VariantMA, Variant Moving Average)
//VariantMA=alpha*MA(t-1)+(1-alpha)*C(t)
//Variant中英文是本人取名, eVariantMA自創英文名稱
//esp=exponential smoothing parameter(esp)指數平滑的天數
function VariantMA(values, ma_day, alpha, esp) { 
  // Menu Name: Variant MA    //esp=9,10,...
  // values=STK_close, alpha= 1,2,3,...,9,10 
  // ma_day=5,10,20 etc.  MA[]=10,11,...,2000
  const MA=KingMA(values, ma_day)  //values=STK_close
  const VariantMA=[];              //VariantMA變異移動均
  const eVariantMA=[];             //eVariantMA指數平滑變異移動均
  VariantMA[ma_day]=MA[ma_day];    //VariantMA(10)=MA(10),初值
  eVariantMA[ma_day]=VariantMA[ma_day];  //eVariantMA(10)=VariantMA(10),初值
  for(let i=ma_day+1; i<values.length; i++) {   //i=10+1 to 2000
    VariantMA[i]=(alpha/10)*MA[i-1]+(10-alpha/10)*values[i];
    eVariantMA[i]=(esp-1)/(esp+1)*eVariantMA[i-1]+2/(esp+1)*VariantMA[i];
  }
  return { values, VariantMA, eVariantMA };
  //values=STK_close
  //normally drawing VariantMA[] and eVariantMA[] in the K_Line area. 
  //VariantMA[], eVariantMA[]=10,11,...,2000.
  //in this case, drawing STK_close[], VariantMA[] and eVariantMA[] in the small windows.
}
window.VariantMA = VariantMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-03=================================
//T3 Moving Average, 可以准确反映股价的走势，又不会有严重的滞后性。
//T1=EMA(C,N)*(1+VA)-EMA(EMA(C,N),N)*VA;
//T2=EMA(T1,N)*(1+VA)-EMA(EMA(T1,N),N)*VA;
//T3=EMA(T2,N)*(1+VA)-EMA(EMA(T2,N),N)*VA;
function T3MA(K_close, esp, va) {
  // Menu Name: T3MA       //K_close=STK_close, esp=9, 0<=va<=1
  //EMA今=(n-1)/(n+1)*EMA昨+2/(n+1)*MA今 
  //esp=9; 平滑的天數exponential smoothing parameter(esp)
  const T1=[];   // T1= 2 to 2000
  const T2=[];   // T2= 3 to 2000
  const T3=[];   // T3= 4 to 2000
  //T1=EMA(C,N)*(1+VA)-EMA(EMA(C,N),N)*VA;
  const EMA1=[];       //EMA1()=EMA(C,N)
  const EMA2=[];       //EMA2()=EMA(EMA(C,N),N)
  EMA1[1]=K_close[1];  //EMA1(1)初值,EMA1()=1 to 2000
  EMA2[1]=K_close[1];  //EMA2(1)初值,EMA2()=1 to 2000
  for(let i=2; i<K_close.length; i++) {
    EMA1[i]=(esp-1)/(esp+1)*EMA1[i-1]+2/(esp+1)*K_close[i]; //EMA1=EMA(C,N)
    EMA2[i]=(esp-1)/(esp+1)*EMA2[i-1]+2/(esp+1)*EMA1[i];  //EMA2=EMA(EMA(C,N),N)
    T1[i]=EMA1[i]*(1+va)-EMA2[i]*va;   // T1=2 to 2000
  }
  //T2=EMA(T1,N)*(1+VA)-EMA(EMA(T1,N),N)*VA;
  const EMA3=[];  //EMA3()=EMA(T1,N)
  const EMA4=[];  //EMA(EMA(T1,N),N)
  EMA3[2]=T1[2];  //EMA3(2)初值,EMA3()=2 to 2000
  EMA4[2]=T1[2];  //EMA4(2)初值,EMA4()=2 to 2000
  for(let i=3; i<K_close.length; i++) {
    EMA3[i]=(esp-1)/(esp+1)*EMA3[i-1]+2/(esp+1)*T1[i];
    EMA4[i]=(esp-1)/(esp+1)*EMA4[i-1]+2/(esp+1)*EMA3[i];
    T2[i]=EMA3[i]*(1+va)-EMA4[i]*va;   // T2=3 to 2000
  }
  //T3=EMA(T2,N)*(1+VA)-EMA(EMA(T2,N),N)*VA;
  const EMA5=[];  //EMA5()=EMA(T2,N)
  const EMA6=[];  //EMA(EMA(T2,N),N)
  EMA5[3]=T2[3];  //EMA5(3)初值,EMA5()=3 to 2000
  EMA6[3]=T2[3];  //EMA6(3)初值,EMA6()=3 to 2000
  for(let i=4; i<K_close.length; i++) {
    EMA5[i]=(esp-1)/(esp+1)*EMA5[i-1]+2/(esp+1)*T2[i];
    EMA6[i]=(esp-1)/(esp+1)*EMA6[i-1]+2/(esp+1)*EMA5[i];
    T3[i]=EMA5[i]*(1+va)-EMA6[i]*va;   // T3=4 to 2000
  }
  return { T1, T2, T3 };
  // T1=2 to 2000, T2=3 to 2000, T3=4 to 2000
  // drawing T1, T2 and T3 figures in the small windows.
}
window.T3MA = T3MA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-04=================================
//Zero Lag MACD(零滯後MACD),本人整理
function ZeroLagMACD(K_close, n12, n24, n9) {
  //Menu Name: ZeroLagMACD
  // K_close=STK_close, n12=12, n24=24, n9=9
  //================================= Short-Period Zero Lag MA:
  //EMAshort1 = 12-period EMA of close price
  const EMA_Short1=[];        // EMA_Short1()=1 to 2000. 
  EMA_Short1[1]=K_close[1];   // EMA_Short1(1)初值
  for(let i=2; i<K_close.length; i++) {   // i=2 to 2000
    EMA_Short1[i]=(n12-1)/(n12+1)*EMA_Short1[i-1]+2/(n12+1)*K_close[i];
    // EMA_Short1()=1 to 2000
  }
  //EMAshort2 = 12-period EMA of (EMAshort1)
  const EMA_Short2=[];            // EMA_Short2()=1 to 2000. 
  EMA_Short2[1]=EMA_Short1[1];    // EMA_Short2(1)初值
  for(let i=2; i<K_close.length; i++) {   // i=2 to 2000 )
    EMA_Short2[i]=(n12-1)/(n12+1)*EMA_Short2[i-1]+2/(n12+1)*EMA_Short1[i];
    // EMA_Short2()=1 to 2000
  }
  // compute ZeroLag_Short()=2*EMA_Short1()-EMA_Short2()
  const ZeroLag_Short=[];             // i=1 to 2000
  for(let i=1; i<K_close.length; i++) {   // i=1 to 2000
    ZeroLag_Short[i]=2*EMA_Short1[i]-EMA_Short2[i];
  }
  //================================= Long-Period Zero Lag MA:
  //EMAlong1 = 24-period EMA of close price
  const EMA_Long1=[];        // EMA_Long1()=1 to 2000. 
  EMA_Long1[1]=K_close[1];   // EMA_Long1(1)初值
  for(let i=2; i<K_close.length; i++) {   // i=2 to 2000
    EMA_Long1[i]=(n24-1)/(n24+1)*EMA_Long1[i-1]+2/(n24+1)*K_close[i];
    // EMA_Long1()=1 to 2000
  }
  //EMAlong2 = 24-period EMA of (EMAlong1)
  const EMA_Long2=[];            // EMA_Long2()=1 to 2000. 
  EMA_Long2[1]=EMA_Long1[1];     // EMA_Long2(1)初值
  for(let i=2; i<K_close.length; i++) {   // i=2 to 2000 )
    EMA_Long2[i]=(n24-1)/(n24+1)*EMA_Long2[i-1]+2/(n24+1)*EMA_Long1[i];
    // EMA_Long2()=1 to 2000
  }
  // compute ZeroLag_Long()=2*EMA_Long1()-EMA_Long2()
  const ZeroLag_Long=[];              // i=1 to 2000
  for(let i=1; i<K_close.length; i++) {   // i=1 to 2000
    ZeroLag_Long[i]=2*EMA_Long1[i]-EMA_Long2[i];
  }
  //================================= Zero Lag MACD:
  //Zero Lag MACD = ZeroLagShort-ZeroLagLong
  const ZeroLagMACD=[];    // ZeroLagMACD=ZeroLagShort-ZeroLagLong
  for(let i=1; i<K_close.length; i++) {
    ZeroLagMACD[i]=ZeroLag_Short[i]-ZeroLag_Long[i];
    // ZeroLagMACD()=1 to 2000
  }
  //================================= Zero Lag Signal Line:
  //Signal1 = 9-period EMA of (ZEROLAGMACD)
  const Signal1=[];     //Signal1=9-period EMA of (ZEROLAGMACD)
  Signal1[1]=ZeroLagMACD[1];   // Signal1(1)初值
  for(let i=2; i<K_close.length; i++) {   // i=2 to 2000 )
    Signal1[i]=(n9-1)/(n9+1)*Signal1[i-1]+2/(n9+1)*ZeroLagMACD[i];
    // Signal1()=1 to 2000
  }
  //Signal2 = 9-period EMA of (Signal1)
  const Signal2=[];         //Signal2=9-period EMA of (Signal1)
  Signal2[1]=Signal1[1];    // Signal2(1)初值
  for(let i=2; i<K_close.length; i++) {   // i=2 to 2000
    Signal2[i]=(n9-1)/(n9+1)*Signal2[i-1]+2/(n9+1)*Signal1[i];
    // Signal2()=1 to 2000
  }
  // compute Zero Lag Signal Line=2*Signal1 -Signal2
  const Zero_Lag_Signal_Line=[];
  for(let i=1; i<K_close.length; i++) {   // i=1 to 2000
    Zero_Lag_Signal_Line=2*Signal1[i]-Signal2[i];
  }
  return { ZeroLagMACD, Zero_Lag_Signal_Line };
  //drawing the ZeroLagMACD[] and Zero_Lag_Signal_Line[] figures in the small windows.
  //=1,2,...,2000.
}
window.ZeroLagMACD = ZeroLagMACD;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-05==modified on 2026-April-23==
//PSY心理線(Psychological Line)。公式：PSY=+N/N
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function PSY(K_close, psy_n, esp) {
  // Menu Name: PSY         //psy_n=10, =20, =30,..., esp=9, =10,...
  // K_close=STK_close, PSY_n=Time Length
  const PSY = [], ePSY = [];   //自創新
  let up_day=0; //PSY_n天內上漲天數(Number of days with price increases within n days)
  for(let i=2; i<psy_n+1; i++) {    // i=2 to 11
    if(K_close[i]>K_close[i-1]) {    // 第2天>第1天
      up_day=up_day+1; }  
  }
  PSY[psy_n+1]=up_day/psy_n*100;   //e.g. first PSY(11)=6/10*100
  ePSY[psy_n+1]=PSY[psy_n+1];      //e.g. first ePSY(11)
  //Calculate the remaining values of PSY
  for(let i=psy_n+2; i<K_close.length; i++) {  // i=12 to 2000
    up_day=0;    //Reset to zero
    for(let j=(i-psy_n+1); j<=i; j++) {  // j=3 to 12
      if(K_close[j]>K_close[j-1]) {      // 第3天>第2天
        up_day=up_day+1; }
    }
    PSY[i]=up_day/psy_n*100;   //e.g. second PSY(12)=6/10*100
    ePSY[i]=(esp-1)/(esp+1)*ePSY[i]+2/(esp+1)*PSY[i];  //e.g. second ePSY(12)
  }
  return { PSY, ePSY };
  //drawing the PSY[], ePSY[] figures in the small windows.
  //if psy_n=10, PSY[], ePSY[]=11,12,...,2000.
}
window.PSY = PSY;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-06==modified on 2026-April-21==
//Volume Accumulation Percentage (VAP, 成交量累積百分比)
//VAP=100xTVA/TV, TV=Sum(Volume, n), TVA=Sum(VolumexP, n), P=(2*C-H-L)/(H-L) 
function VolAccPct(K_high, K_low, K_close, K_vol, period, esp) {
  // Menu Name: VolAccPct      //esp=9,10,...
  // period=Time Length, period=5, =10, =20, =30,...
  const VolAccPct = [];    // VAP, 成交量累積百分比
  const eVolAccPct = [];   // eVAP, 自行創新
  let sum_vol_p=0;   //分子加總 Vol*Price=0
  let sum_vol=0;     //分母加總 Vol=0
  let price_CHL;     //price_CHL=(2C-H-L)/(H-L)
  for(let i=1; i<period; i++) {   // i=1 to 10
    price_CHL=(2*K_close[i]-K_high[i]-K_low[i])/(K_high[i]-K_low[i]);
    sum_vol_p=sum_vol_p + K_vol[i]*price_CHL;  //分子加總 Vol*Price
    sum_vol=sum_vol + K_vol[i];    //分母加總,累加成交量
  }
  VolAccPct[period]=sum_vol_p/sum_vol*100;    //VolAccPct(10) 第1個
  eVolAccPct[period]=VolAccPct[period];       //eVAP(10) 第1個
  //Calculate the rest values
  for(let i=period+1; i<K_close.length; i++) {  // i=11 to 2000
    //先扣除10天前的加總
    price_CHL=(2*K_close[i-period]-K_high[i-period]-K_low[i-period])/(K_high[i-period]-K_low[i-period]);
    sum_vol_p=sum_vol_p - K_vol[i-period]*price_CHL;  //分子
    sum_vol=sum_vol - K_vol[i-period];                //分母
    //再加上新的
    price_CHL=(2*K_close[i]-K_high[i]-K_low[i])/(K_high[i]-K_low[i]);
    sum_vol_p=sum_vol_p + K_vol[i]*price_CHL;  //分子加總 Vol*Price
    sum_vol=sum_vol + K_vol[i];                //分母加總,累加成交量
    VolAccPct[i]=sum_vol_p/sum_vol*100;        //VolAccPct(11) 第2個
    eVolAccPct[i]=(esp-1)/(esp+1)*eVolAccPct[i-1] + 2/(esp+1)*VolAccPct[i]; //eVAP(11) 第2個
  }
  return { VolAccPct, eVolAccPct };
  //drawing the VolAccPct[] and eVolAccPct[] figures in the small windows.
  //if period=10, VolAccPct[], eVolAccPct[]=11,12,...,2000.
}
window.VolAccPct = VolAccPct;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-06=================================
//FVI四量線指標(FVI, Four Volume Line Index)  <FourVolLine>
// 4條移動平均成交量加總平均
function FourVolLine(K_vol, n1, n2, n3, n4, esp) {
  // Menu Name: FourVolLine    // esp=9,10,...自行創新
  // for example: n1=5, n2=10, n3=15, n4=20,時間長度
  const FourVolLine = [];   // FVI四量線指標
  const eFourVolLine = [];  // eFVI四量線指標, 自行創新
  //1-----------------------------------------------------------1
  //求第1個=n1天數成交量Vol的移動平均
  let sum_vol=0;         //加總Vol=0,初值=0
  const avgVol1=[];      //第1個=n1天數成交量Vol的移動平均
  for(let i=1; i<n1; i++) {   // i=1 to 5
    sum_vol=sum_vol+K_vol[i];
  }
  avgVol1[n1]=sum_vol/n1;      // n1=5, 第1個avgVol1(5)
  //Calculate the rest values
  for(let i=n1+1; i<K_vol.length; i++) {  // i=5+1 to 2000
    //先扣除5天前的加總,再加新的值
    sum_vol=sum_vol-K_vol[i-n1]+K_vol[i];
    avgVol1[i]=sum_vol/n1;     // n1=5, 第2個avgVol1(6)
  }
  //2-----------------------------------------------------------2
  //求第2個=n2天數成交量Vol的移動平均
  sum_vol=0;          //加總Vol=0,初值=0
  const avgVol2=[];   //第2個=n2天數成交量Vol的移動平均
  for(let i=1; i<n2; i++) {  // i=1 to 10
    sum_vol=sum_vol+K_vol[i];
  }
  avgVol2[n2]=sum_vol/n2;      // n2=10, 第1個avgVol2(10)
  //Calculate the rest values
  for(let i=n2+1; i<K_vol.length; i++) {  // i=10+1 to 2000
    //先扣除10天前的加總,再加新的值
    sum_vol=sum_vol-K_vol[i-n2]+K_vol[i];
    avgVol2[i]=sum_vol/n2;     // n2=10, 第2個avgVol2(11)
  }
  //3-----------------------------------------------------------3
  //求第3個=n3天數成交量Vol的移動平均
  sum_vol=0;          //加總Vol=0,初值=0
  const avgVol3=[];   //第3個=n3天數成交量Vol的移動平均
  for(let i=1; i<n3; i++) {  // i=1 to 15
    sum_vol=sum_vol+K_vol[i];
  }
  avgVol3[n3]=sum_vol/n3;     // n3=15, 第1個avgVol3(15)
  //Calculate the rest values
  for(let i=n3+1; i<K_vol.length; i++) {  // i=15+1 to 2000
    //先扣除15天前的加總,再加新的值
    sum_vol=sum_vol-K_vol[i-n3]+K_vol[i];
    avgVol3[i]=sum_vol/n3;     // n3=15, 第2個avgVol3(16)
  }
  //4-----------------------------------------------------------4
  //求第4個=n4天數成交量Vol的移動平均
  sum_vol=0;          //加總Vol=0,初值=0
  const avgVol4=[];   //第4個=n4天數成交量Vol的移動平均
  for(let i=1; i<n4; i++) {   // i=1 to 20
    sum_vol=sum_vol+K_vol[i];
  }
  avgVol4[n4]=sum_vol/n4;      // n4=20, 第1個avgVol4(20)
  //Calculate the rest values
  for(let i=n4+1; i<K_vol.length; i++) {  // i=20+1 to 2000
    //先扣除20天前的加總,再加新的值
    sum_vol=sum_vol-K_vol[i-n4]+K_vol[i];
    avgVol4[i]=sum_vol/n4;     // n4=20, 第2個avgVol4(21)
  }
  // 計算FVI四量線指標, FourVolLine=[]
  let max_n=0;        //4個天數最大的,初值=0
  max_n=Math.max(n1,n2,n3,n4);   //找出4個天數最大的,以最大的起算,例如max_n=20天
  for(let i=max_n; i<K_vol.length; i++) {  //例如 i=20 to 2000
    FourVolLine[i]=(avgVol1[i]+avgVol2[i]+avgVol3[i]+avgVol4[i])/4;
    if(i==max_n) {  //例如 i=20, 第1個FourVolLine(20)
      eFourVolLine[i]=FourVolLine[i]; } // eFVI四量線指標,自行創新,第1個eFourVolLine(20)
    else {
      eFourVolLine[i]=(esp-1)/(esp+1)*eFourVolLine[i-1]+2/(esp+1)*FourVolLine[i];  
      // eFVI四量線指標, 自行創新, 第2個eFourVolLine(21)
    }
  }
  return { FourVolLine, eFourVolLine };
  //drawing the FourVolLine[] and eFourVolLine[] figures in the small windows.
  //if period=20, FourVolLine[], eFourVolLine[]=21,22,...,2000.
}
window.FourVolLine = FourVolLine;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-15=================================
//VolMaRoc移動平均成交量之變動率指標(VolMaRoc, MA Volume Rate of Change Indicator)
//<<完全自創指標>>, Completely self-created indicators
function VolMaRoc(K_vol, roc_length, ma_day) {
  // Menu Name: VolMaRoc    //MA Volume Rate of Change
  // K_vol=STK_vol, roc_length=length of ROC(Time Length)
  // roc_length=10, =15, =20,... ,K_vol(i-roc_length)=第roc_length日前的成交量
  // ma_day=5, 移動平均天數
  // 計算：移動平均成交量(Moving Average of Volume)
  const VolMa=[];   //=5, to 2000 (移動平均成交量)
  //assume ma_day=5, then VolMa[]=5,6, ...,2000
  let sum=0;
  for(let i=1; i<ma_day; i++) {  // i=1 to 5 (or i=1 to 10)
    sum=sum+K_vol[i];
  }
  VolMa[ma_day]=sum/ma_day;    // 第1個VolMa(5)=sum/5
  for(let i=ma_day+1; i<K_vol.length; i++) { // i=5+1 to 2000
    //先扣除5天前舊的，再加新的
    sum=sum-K_vol[i-ma_day]+K_vol[i];   //sum=sum-(第1個)+(第6個)
    VolMa[i]=sum/ma_day;
  }
  //計算：VOLmaROC移動平均成交量之變動率((VolMaRoc, MA Volume Rate of Change)
  //assume ma_day=5 and roc_length=10, then VolMaRoc[]=15,16, ...,2000
  const VolMaRoc=[];
  for(let i=ma_day+roc_length; i<K_vol.length; i++) {  // i=5+10 to 2000
    VolMaRoc[i]=(VolMa[i]/VolMa[i-roc_length]-1)*100;  // (VolMa(15)/VolMa(5)-1)*100
  }
  return { VolMaRoc };
  //drawing the VolMaRoc[] figure in the small windows.
  //if ma_day=5 and roc_length=10, then VolMaRoc[]=15,16,...,2000
}
window.VolMaRoc = VolMaRoc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-15==modified on 2026-April-21==
// 威廉成交量聚散指標(William’s Volume Convergence/Divergence Indicator)
// <<自創指標,2026-02-15>>, Completely self-created indicators
// 模仿Williams %R 威廉指標(William’s Overbought/Oversold Index)
// WilliamVolConDiv=(Hn-Ct)/(Hn-Ln)*Vol.
function WilliamVolConDiv(K_high, K_low, K_close, K_vol, WR_day) {
  // Menu Name: WilliamVolConDiv    // WR_day=5,10,15,... 天數
  // K_high=STK_igh, K_low=STK_low, K_close=STK_close, K_vol=STK_vol, 
  const WilliamVolConDiv=[];
  for(let i=1; i<K_close.length-WR_day+1; i++) {   // i=1 to 2000-10+1=1991
    let Max_high=0; 
    let Min_low=9999;   // initial value can not be zero
    for(j=i; j<=WR_day+i-1; j++) {  //找最大與最小, j=1 to 10
      if(K_high[j]>Max_high) { 
        Max_high=K_high[j]; }
      if(K_low[j]<Min_low) {
        Min_low=K_low[j];  }
    }
    if(Max_high==Min_low) {
      WilliamVolConDiv[WR_day+i-1]=K_vol[WR_day+i-1]; }   // 在威廉指標中是=100
    else{
      WilliamVolConDiv[WR_day+i-1]=(Max_high-K_close[WR_day+i-1])/(Max_high-Min_low)*K_vol[WR_day+i-1]; }
  }
  return { WilliamVolConDiv };
  //drawing the WilliamVolConDiv[] figure in the small windows.
  //if WR_day=10, then WilliamVolConDiv[]=10,11,...,2000
}
window.WilliamVolConDiv = WilliamVolConDiv;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-16==modified on 2026-April-21==
//威廉變異聚散量(WilliamVarAccuDist, William’s Variable Accumulation Distribution)
//WilliamVarAccuDist (威廉變異聚散量, 原名:WVAD, William’s Variable Accumulation Distribution)
// 英文名重新取為：WilliamVarAccuDist
//(楊本p.82,取名：WVAD,威廉變異離散量。我重取『中英文』名，楊本寫為Distribution)
// WilliamVarAccuDist=Sum{(C-O)/(H-L)*Vol, for i=1 to WR_day}.
function WilliamVarAccuDist(K_open, K_high, K_low, K_close, K_vol, WR_day, esp) {
  // Menu Name: WilliamVarAccuDist
  // K_open=STK_open, K_high=STK_igh, K_low=STK_low, K_close=STK_close, K_vol=STK_vol
  // WR_day=5,10,15,... 天數,   // esp=9,10,...,自創新
  const WilliamVarAccuDist=[];   //if WR_day=10, =10,11,...,2000
  const eWilliamVarAccuDist=[];  //if WR_day=10, =10,11,...,2000,自創新
  let sum=0;
  //從第1天到第WR_day天的加總
  for(let i=1; i<WR_day; i++) {  //i=1 to 10
    if(K_high[i]==K_low[i]) {     //分母為0之處理
      sum=sum+K_vol[i];  }    
    else {
      sum=sum+(K_close[i]-K_open[i])/(K_high[i]-K_low[i])*K_vol[i];
    }
  }
  WilliamVarAccuDist[WR_day]=sum;  //第1個:WilliamVarAccuDist[10]
  eWilliamVarAccuDist[WR_day]=sum; //第1個:eWilliamVarAccuDist[10]
  //從第WR_day+1天開始，扣除舊的加總，加入新的加總
  for(let i=WR_day+1; i<K_close.length; i++) {  //WR_day=10+1 to 2000
    //扣除舊的加總
    if(K_high[i-WR_day]==K_low[i-WR_day]) {  //分母為0之處理
      sum=sum-K_vol[i-WR_day]; }
    else {
      sum=sum-(K_close[i-WR_day]-K_open[i-WR_day])/(K_high[i-WR_day]-K_low[i-WR_day])*K_vol[i-WR_day];
    }
    //加入新的加總
    if(K_high[i]==K_low[i]) {  //分母為0之處理
      sum=sum+K_vol[i];  }  
    else {
      sum=sum+(K_close[i]-K_open[i])/(K_high[i]-K_low[i])*K_vol[i];
    }
    WilliamVarAccuDist[i]=sum;  //第2個:WilliamVarAccuDist[11]
    eWilliamVarAccuDist[i]=(esp-1)/(esp+1)*eWilliamVarAccuDist[i-1]+(2/(esp+1))*sum; 
    //第2個:eWilliamVarAccuDist[11]
  }
  return { WilliamVarAccuDist, eWilliamVarAccuDist };
  //drawing the WilliamVarAccuDist[], eWilliamVarAccuDist figures in the small windows.
  //if WR_day=10, then WilliamVarAccuDist[],eWilliamVarAccuDist[]=10,11,...,2000
}
window.WilliamVarAccuDist = WilliamVarAccuDist;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-23=================================
//VolumeKD成交量隨機指標(VolumeKD, Volume Stochastic Indicator)。  0<=K,D<=100.
//<<完全自創指標,completely self-created indicators >> 
function VolumeKD(K_vol, KD_day, esp) {
  // Menu Name: VolumeKD  
  // K_vol=STK_vol, KD_day=9, esp=9,10,...
  //esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
  const Vol_K=[], Vol_D=[];
  const Vol_K2=[], Vol_D2=[];
  let rsv, maxHigh, minLow;
  for(let i=KD_day; i<K_vol.length; i++) {   // i=9 to 2000
    maxHigh = K_vol[i-KD_day+1];
    minLow = K_vol[i-KD_day+1];
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_vol[j]);
      minLow = Math.min(minLow, K_vol[j]);
    }
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_vol[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {     //i=9, KD初值
      Vol_K[i] = 50;       //i=9, Vol_K初值
      Vol_D[i] = 50;       //i=9, Vol_D初值
      Vol_K2[i] = 50;      //i=9, Vol_K2初值
      Vol_D2[i] = 50; }    //i=9, Vol_D2初值
    else {
      Vol_K[i] = (2/3)*Vol_K[i-1] + (1/3)*rsv;        //第2筆 Vol_K[10]
      Vol_D[i] = (2/3)*Vol_D[i-1] + (1/3)*Vol_K[i];   //第2筆 Vol_D[10]
      Vol_K2[i]=(esp-1)/(esp+1)*Vol_K2[i-1] +2/(esp+1)*Vol_K[i];
      Vol_D2[i]=(esp-1)/(esp+1)*Vol_D2[i-1] +2/(esp+1)*Vol_D[i];
    }
  }
  return { Vol_K, Vol_K2, Vol_D, Vol_D2 };
  //drawing these four figures in the small windows.
  //if KD_day=9, Vol_K, Vol_K2, Vol_D, Vol_D2=9,10,...,2000.
}
window.VolumeKD = VolumeKD;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-27==================
//市場便利指標(MFI, Market Facilitation Index)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//MFI=(High-Low)/Volume
function MarketFacilitation(K_high, K_low, K_vol, esp) {
  // Menu Name: MarketFI(MFI)
  //K_high=STK_close, K_low=STK_low, K_vol=STK_vol, esp=9,10,...
  const MFI=[];   //MFI=[]
  const eMFI=[];  //eMFI=[]  //自創的指數平滑移動平均。
  for(let i=1; i<K_high.length; i++) {
    MFI[i]=(K_high[i]-K_low[i])/K_vol[i];
    if(i==1) {
      eMFI[i]=MFI[i]; }    //eMFI[1]=MFI[1]
    else {
      eMFI[i]=(esp-1)/(esp+1)*eMFI[i-1]+2/(esp+1)*MFI[i];
    }
  }
  return { MFI, eMFI };
  //drawing the MFI and eMFI figures in the small windows.
  //MFI=1,2,3,...,2000.
}
window.MarketFacilitation = MarketFacilitation;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-27======本人自己創新====
//市場便利指標(MFI, Market Facilitation Index)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//newMFI=[今(High-Low)/昨(High-Low)]/[(今Volume/昨Volume)]
//本人自己創新 <2026-02-27>
function NewMarketFacilitation(K_high, K_low, K_vol, esp) {
  //Menu Name: New MarketFI    // esp=9, 10,...
  //K_high=STK_high, K_low=STK_low, K_vol=STK_vol
  const NewMFI=[];   //newMFI=[]
  const eNewMFI=[];  //eNewMFI=[]  //自創的指數平滑移動平均。
  let tp1, tp2;  //分子,分母
  for(let i=2; i<K_high.length; i++) {
    if(K_high[i-1]===K_low[i-1]) {     //分母=0避開。
      NewMFI[i]=0; }
    else {
      tp1=(K_high[i]-K_low[i])/(K_high[i-1]-K_low[i-1]); //分子
      tp2=K_vol[i]/K_vol[i-1];                           //分母
      NewMFI[i]=tp1/tp2;
    }
    if(i==2) {
      eNewMFI[i]=NewMFI[i]; }
    else {
      eNewMFI[i]=(esp-1)/(esp+1)*eNewMFI[i-1]+2/(esp+1)*NewMFI[i];
    }
  }
  return { NewMFI, eNewMFI };
  //drawing the NewMFI and eNewMFI figures in the small windows.
  //NewMFI, eNewMFI=2,3,...,2000.
}
window.NewMarketFacilitation = NewMarketFacilitation;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-27======本人自己創新====
//價量漲跌百分比相乘指標(PriceVolRiseFallMulti, Multiply the percentage rise/fall in price and volume) 
//PriceVolRiseFallPctMulti=[(今收-昨收)/今收*100]*[abs(今量-昨量)/今量*100]
//本人自己創新 <2026-02-27>  
//function PriceVolRiseFallPctMulti  <old name>
function PriVolRiFaPtMu(K_close, K_vol, esp) {
  // Menu Name: PriVolRiFaPtMu  // esp=9,10,...,自創新
  // Description: This function calculates the PriceVolRiseFallPctMulti indicator, 
  // which multiplies the percentage rise/fall in price and volume. 
  // The formula is: PriceVolRiseFallPctMulti = 
  // [(Current Close - Previous Close) / Current Close * 100] * 
  // [abs(Current Volume - Previous Volume) / Current Volume * 100]. 
  // The function takes three parameters:
  //  K_close (array of closing prices), K_vol (array of volumes), 
  // and esp (smoothing factor for the exponential moving average). 
  // The function returns an object containing two arrays: 
  // PriVolRFPM (the raw PriceVolRiseFallPctMulti values) and 
  // ePriVolRFPM (the smoothed PriceVolRiseFallPctMulti values 
  //K_close=STK_close, K_vol=STK_vol, esp=9,10,...
  const PriVolRFPM=[];   //原取名:const PriceVolRiseFallPctMulti=[]
  const ePriVolRFPM=[];  //自己創新
  let tp1, tp2;  //價漲跌百分比, 量漲跌百分比
  for(let i=2; i<K_close.length; i++) {  // i=2 to 2000
    tp1=(K_close[i]-K_close[i-1])/(K_close[i-1])*100;  //價漲跌百分比,正負不一定
    tp2=Math.abs((K_vol[i]-K_vol[i-1]))/K_vol[i-1];    //量漲跌百分比,取絕對值
    PriVolRFPM[i]=tp1*tp2;
    if(i==2) {
      ePriVolRFPM[i]=PriVolRFPM[i]; } //第一筆資料,自創
    else {
      ePriVolRFPM[i]=(esp-1)/(esp+1)*ePriVolRFPM[i-1]+2/(esp+1)*PriVolRFPM[i];
    }
  }
  return { PriVolRFPM, ePriVolRFPM };
  //drawing the PriVolRFPM and ePriVolRFPM figures in the small windows.
  //PriVolRFPM, ePriVolRFPM =2,3,...,2000.
}
window.PriVolRiFaPtMu = PriVolRiFaPtMu;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-27======本人自己創新====
//價量漲跌百分比相加指標(PriceVolRiseFallPctSum, Sum the percentage rise/fall in price and volume)
//PriceVolRiseFallPctSum=[(今收-昨收)/今收*100]+[(今量-昨量)/今量*100]
//PriceRiseFallPct=(今收-昨收)/今收*100
//VolRiseFallPct=(今量-昨量)/今量*100
//本人自己創新 <2026-02-27>  //function PriceVolRiseFallPctSum  <old name>
function PriVolRiFaPtSum(K_close, K_vol) {
  // Menu Name: PriVolRiseFallPctSum
  //K_close=STK_close, K_vol=STK_vol
  const PriRiseFallPct=[];        //價漲跌百分比,正負不一定
  const VolRiseFallPct=[];        //量漲跌百分比,正負不一定
  const PriVolRiseFallPctSum=[];  //價量漲跌百分比相加
  for(let i=2; i<K_close.length; i++) {  // i=2 to 2000
    PriRiseFallPct[i]=(K_close[i]-K_close[i-1])/(K_close[i-1])*100; //價漲跌百分比,正負不一定
    VolRiseFallPct[i]=(K_vol[i]-K_vol[i-1])/K_vol[i-1];           //量漲跌百分比,正負不一定
    PriVolRiseFallPctSum[i]=PriRiseFallPct[i]+VolRiseFallPct[i];  //價量漲跌百分比相加
  }
  return { PriRiseFallPct, VolRiseFallPct, PriVolRiseFallPctSum };
  //drawing the THREE figures in the small windows.
  //THREE indicators=2,3,...,2000.
}
window.PriVolRiFaPtSum = PriVolRiFaPtSum;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-02===============================
//成交量加權平均價(VWAP, Volume Weighted Average Price ==>VolWgtAvgPrice)
//與相似，不同在於「Price」。Volume Accumulation Percentage (VAP, 成交量累積百分比)
//VAP=100xTVA/TV, TV=Sum(Volume, n), TVA=Sum(VolumexP, n), P=(2*C-H-L)/(H-L)
//新Price=Typical Price=(H+L+C)/3, or =(H+L+2C)/4
//eVolWgtAvgPrice 創新
function VolWgtAvgPrice(K_high, K_low, K_close, K_vol, period, esp) {
  // Menu Name: VolWgtAvgPrice   //period=5, =10, =20, =30,...//esp=9,10,...
  // period=Time Length
  const VolWgtAvgPrice = [];    // VAP, 成交量累積百分比
  const eVolWgtAvgPrice = [];   // eVAP, 成交量累積百分比
  let sum_vol_p=0;   //分子加總 Vol*Price=0
  let sum_vol=0;     //分母加總 Vol=0
  // price_CHL;      //price_CHL=(2C-H-L)/(H-L)
  TypicalPrice=0;    //Typical Price=(H+L+2C)/4
  for(let i=1; i<period; i++) {   // i=1 to 10
    TypicalPrice=(2*K_close[i]+K_high[i]+K_low[i])/4;  //=(H+L+2C)/4
    sum_vol_p=sum_vol_p + K_vol[i]*TypicalPrice;       //分子加總 Vol*Price
    sum_vol=sum_vol + K_vol[i];    //分母加總,累加成交量
  }
  VolWgtAvgPrice[period]=sum_vol_p/sum_vol;        //VolWgtAvgPrice(10),第1個
  eVolWgtAvgPrice[period]=VolWgtAvgPrice[period];  //創新
  //Calculate the rest values
  for(let i=period+1; i<K_close.length; i++) {  // i=11 to 2000
    //先扣除10天前的加總
    //price_CHL=(2*K_close[i-period]-K_high[i-period]-K_low[i-period])/(K_high[i-period]-K_low[i-period]);
    TypicalPrice=(2*K_close[i-period]+K_high[i-period]+K_low[i-period])/4;
    sum_vol_p=sum_vol_p - K_vol[i-period]*TypicalPrice;  //分子
    sum_vol=sum_vol - K_vol[i-period];    //分母
    //再加上新的
    //price_CHL=(2*K_close[i]-K_high[i]-K_low[i])/(K_high[i]-K_low[i]);
    TypicalPrice=(2*K_close[i]+K_high[i]+K_low[i])/4;  //=(H+L+2C)/4
    sum_vol_p=sum_vol_p + K_vol[i]*TypicalPrice;       //分子加總 Vol*Price
    sum_vol=sum_vol + K_vol[i];             //分母加總,累加成交量
    VolWgtAvgPrice[i]=sum_vol_p/sum_vol;    //VolWgtAvgPrice(11) 第2個
    eVolWgtAvgPrice[i]=(esp-1)/(esp+1)*eVolWgtAvgPrice[i-1]+2/(esp+1)*VolWgtAvgPrice[i];  //創新
  }
  return { VolWgtAvgPrice, eVolWgtAvgPrice };
  //drawing the VolWgtAvgPrice[] and eVolWgtAvgPrice[] figures in the small windows.
  //if period=10, then VolWgtAvgPrice[], eVolWgtAvgPrice[]=11,12,...,2000.
}
window.VolWgtAvgPrice = VolWgtAvgPrice;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-02===============================
//CDP指標(Central Daily Pivot，中心樞紐點)是一種技術分析逆勢操作工具
//最高值(AH)、近高值(NH)、最低值(AL)以及近低值(NL)，依序排列順序(由高至低)為AH,NH,CDP,NL,AL
//CDP=前日(H+L+2C)4.  AH=CDP+(H-L),  NH=2CDP-L,  NL=2CDP-H,  AL=CDP-(H-L)
//Support=2CDP-H,  Pressure=2CDP-L.
function CDP(K_high, K_low, K_close) {
  // Menu Name: CDP       //Central Daily Pivot
  // K_high=STK_high, K_low=STK_low, K_close=STK_close 
  const CDP=[];   // CDP指標（Central Daily Pivot，中心樞紐點
  const AH=[];    //最高值AH (Arriba High)
  const NH=[];    //近高值NH (Near High)
  const NL=[];    //近低值NL (Near Low)
  const AL=[];    //最低值AL (Arriba Low)
  const Support=[];  //支撐值(support)
  const Pressure=[]; //壓力值(pressure)
  for(let i=2; i<K_close.length; i++) {           // i=2 to 2000
    CDP[i]=(2*K_close[i-1]+K_high[i-1]+K_low[i-1])/4;   //=(H+L+2C)/4
    AH[i]= CDP[i] + (K_high[i-1]-K_low[i-1]);
    NH[i]= 2*CDP[i] - K_low[i-1];
    NL[i]= 2*CDP[i] - K_high[i-1];
    AL[i]= CDP[i] - (K_high[i-1]-K_low[i-1]);
    Support[i]= 2*CDP[i] - K_high[i-1];
    Pressure[i]= 2*CDP[i] - K_low[i-1];
  }
  return { AH, NH, CDP, NL, AL, Support, Pressure };
  //Normally drawing the Seven figures in the K_Line area.
  //drawing the Seven figures in the small windows
  //the Seven indicators=2,3,...,2000.
}
window.CDP = CDP;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-03===============================
//PIVG樞紐分析(PIVG, Pivot Value Gauge) 
//中心樞軸(Central Pivot), P=(H+L+C)/3. 區間下緣(Bottom Central), BC=(H+L)/2.
//區間上緣(Top Central),TC=2P-BC=(H+L+4C)/6.
//第一層(First layer): R1=2P-L=(2H+2C-L)/3.  S1=2P-H=(2L+2C-H)/3. 
//第二層(Secord layer): R2=P+(H-L)=(4H+C-2L)/3.  S2=P-(H-L)=(4L+C-2H)/3.
//第三層(Third layer): R3=H+2(P-L)=(5H+2C-4L)/3.  S3=L-2(H-P)=3L+2C.
//中央區寬度(Central area width), Central Width=TC-BC=2P-2BC=(2C-H-L)/3.
function PIVG(K_high, K_low, K_close) {
  // Menu Name: PIVG 
  //K_high=STK_high, K_low=STK_low, K_close=STK_close 
  const Pivot=[];   // 中心樞軸(Central Pivot), P=(H+L+C)/3.
  const BC=[];      // 區間下緣(Bottom Central), BC=(H+L)/2.
  const TC=[];      // 區間上緣(Top Central),TC=2P-BC=(H+L+4C)/6.
  const R1=[];      // 第一層(First layer): R1=2P-L=(2H+2C-L)/3.  
  const S1=[];      // S1=2P-H=(2L+2C-H)/3.
  const R2=[];      // 第二層(Secord layer): R2=P+(H-L)=(4H+C-2L)/3.
  const S2=[];      // S2=P-(H-L)=(4L+C-2H)/3.
  const R3=[];      // 第三層(Third layer): R3=H+2(P-L)=(5H+2C-4L)/3.
  const S3=[];      // S3=L-2(H-P)=3L+2C.
  for(let i=1; i<K_close.length; i++) {         // i=1 to 2000
    Pivot[i]=(K_high[i]+K_low[i]+K_close[i])/3; //中心樞軸,P=(H+L+C)/3
    BC[i]=(K_high[i]+K_low[i])/2;               //區間下緣,BC=(H+L)/2
    TC[i]=2*Pivot[i]-BC[i];       //區間上緣TC=2P-BC=(H+L+4C)/6
    R1[i]=2*Pivot[i]-K_low[i];    //第一層: R1=2P-L=(2H+2C-L)/3
    S1[i]=2*Pivot[i]-K_high[i];   //S1=2P-H=(2L+2C-H)/3
    R2[i]=Pivot[i]+(K_high[i]-K_low[i]); //第二層: R2=P+(H-L)=(4H+C-2L)/3
    S2[i]=Pivot[i]-(K_high[i]-K_low[i]); //S2=P-(H-L)=(4L+C-2H)/3
    R3[i]=K_high[i]+2*(Pivot[i]-K_low[i]); //第三層: R3=H+2(P-L)=(5H+2C-4L)/3
    S3[i]=K_low[i]-2*(K_high[i]-Pivot[i]); // S3=L-2(H-P)=3L+2C
  }
  return { Pivot, BC, TC, R1, S1, R2, S2, R3, S3 };
  //Normally drawing the Nine figures in the K_Line area.
  //the Nine indicators=1,2,...,2000.
}
window.PIVG = PIVG;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-04===============================
//MIKE麥克指標係由三條壓力線與三條支撐線組成
//TP=TYP=Typical Price=(H+L+C)/3, or =(H+L+2C)/4
//弱支撐(Weak Support)-> WS=2TYP-Hn
//中支撐(Medium Support)-> MS=TYP-(Hn-Ln)
//強支撐(Strong Support)-> SS=2xLn-Hn
//弱阻力(Weak Resistance)-> WR=TYP+(TYP-Ln)=2TYP-Ln
//中阻力(Medium Resistance)-> MR=TYP+(Hn-Ln)
//強阻力(Strong Resistance)-> SR=2xHn-Ln
function MIKE(K_high, K_low, K_close, day) {
  //Menu Name: MIKE
  //day represents the number of days in the calculation. ex. day=5,10,20
  //K_high=STK_high, K_low=STK_low, K_close=STK_close 
  const WS=[];      // 弱支撐(Weak Support)-> WS=2TYP-Hn
  const MS=[];      // 中支撐(Medium Support)-> MS=TYP-(Hn-Ln)
  const SS=[];      // 強支撐(Strong Support)-> SS=2xLn-Hn
  const WR=[];      // 弱阻力(Weak Resistance)-> WR=TYP+(TYP-Ln)=2TYP-Ln  
  const MR=[];      // 中阻力(Medium Resistance)-> MR=TYP+(Hn-Ln)
  const SR=[];      // 強阻力(Strong Resistance)-> SR=2xHn-Ln
  let TP;           //TP=TYP=Typical Price=(H+L+C)/3, or =(H+L+2C)/4
  let max_Hn  ;     //Maximum value within the day, for example: day=10
  let min_Ln ;      //Minimum value within the day
  for(let i=day; i<K_close.length; i++) {         // i=10 to 2000
    max_Hn=K_high[i-day+1];  //set the first value =max, max_High=K_high[1]
    min_Ln=K_low[i-day+1];    //set the first value =min, min_Low=K_low[1]
    for(let j=i-day+2; j<=i; j++) {  //j=2 to 10, find out the Hn and Ln
      if(K_high[j]>max_Hn){
        max_Hn=K_high[j]; }
      if(min_Ln>K_low[j]) {
        min_Ln=K_low[j];  }
    }
    //TP=TYP=Typical Price=(H+L+C)/3, or =(H+L+2C)/4
    TP=(K_high[i]+K_low[i]+2*K_close[i])/4;
    WS[i]= 2*TP-max_Hn;         // 弱支撐(Weak Support)-> WS=2TYP-Hn
    MS[i]=TP-(max_Hn-min_Ln);   // 中支撐(Medium Support)-> MS=TYP-(Hn-Ln)
    SS[i]=2*min_Ln-max_Hn;      // 強支撐(Strong Support)-> SS=2xLn-Hn
    WR[i]=2*TP-min_Ln;          // 弱阻力(Weak Resistance)-> WR=TYP+(TYP-Ln)=2TYP-Ln
    MR[i]=TP+(max_Hn-min_Ln);   // 中阻力(Medium Resistance)-> MR=TYP+(Hn-Ln)
    SR[i]=2*max_Hn-min_Ln;;     // 強阻力(Strong Resistance)-> SR=2xHn-Ln
  }
  return { WS, MS, SS, WR, MR, SR };
  //drawing the Six figures in the K_Line area.
  //if day=10, the Six indicators=10,11,...,2000.
}
window.MIKE = MIKE;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-07==================
//REX Oscillator=MA(TVB,n),this case uses EMA(TVB,esp)
//TVB(True Value of a Bar)=2C-(H+L)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function REXOscillator(K_high, K_low, K_close, esp) {
  // Menu Name: REX Oscillator     //ma_day=5, 10, 15, 20,...//esp=9, 10, 11,...
  const TVB=[], REX=[];   //TVB=2C-(H+L), REX=MA(TVB,n)
  //================ calculate all TVB[]=1,2,...,2000 ===
  for(let i=1; i<K_close.length; i++) {   // i=1 to 2000
    TVB[i]=2*K_close[i]-(K_high[i]+K_low[i]);
  }
  //== calculate REX Oscillator=MA(TVB,n), REX[]=1,2,...,2000
  //This case uses the exponential moving average method.
  REX[1]=TVB[1];      //first value, REX[1]=TVB[1]
  for(let i=2; i<K_close.length; i++) {    //i=2 to 2000
    REX[i]=(esp-1)/(esp+1)*REX[i-1]+2/(esp+1)*TVB[i];
    //REX今=(n-1)/(n+1)*REX昨+2/(n+1)*TVB今。參數=9, <本人自創>
  }
  return { REX, TVB };
  //drawing the REX and TVB figures in the small windows.
  //REX[],TVB[]=1,2,...,2000.
}
window.REXOscillator = REXOscillator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-08==================
//Average True Range Percentage(ATRP=AvgTRpct)
//ATR均幅指標(ATR, Average True Range)
//TR=max[abs(Hi-Li), abs(Ci_1-Hi), abs(Ci_1-Li)]
//ATR今=(n-1)/(n+1)ATR昨+2/(n+1)TR今
//ATRpercent=ATR今/Close今*100
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function AvgTRPct(K_high, K_low, K_close, esp) {
  // Menu Name: AvgTRPct(ATRP)       // esp=9,10,...
  //vK_close=STK_close, K_high=STK_high, K_low=STK_low
  const TR=[], AvgTR=[], AvgTRpct=[];
  //============== calculate first TR[2], ATR[2], ATRperct[2] ===
  TR[2]=Math.max((K_high[2]-K_low[2]),Math.abs(K_close[1]-K_high[2]),Math.abs(K_close[1]-K_low[2]));
  AvgTR[2]=TR[2];
  AvgTRpct[2]=(AvgTR[2]/K_close[2])*100;
  //====== calculate the rest of TR[],ATR[],ATRperct[]=3,4,...,2000 ===
  for(let i=3; i<K_close.length; i++) {   // i=3 to 2000
    TR[i]=Math.max((K_high[i]-K_low[i]),Math.abs(K_close[i-1]-K_high[i]),Math.abs(K_close[i-1]-K_low[i]) );
    AvgTR[i]=(esp-1)/(esp+1)*AvgTR[i-1]+2/(esp+1)*TR[i];
    //AvgTR今=(n-1)/(n+1)*AvgTR昨+2/(n+1)*TR今。參數=9,  <本人自創>
    AvgTRpct[i]=(AvgTR[i]/K_close[i])*100;
  }
  return { AvgTRpct };
  //If the three values are close in size, then return AvgTRpct, AvgTR, TR;
  //drawing the AvgTRpct[] figure in the small windows.
  //AvgTRpct[], AvgTR[], TR[] =2,3,...,2000.
}
window.AvgTRPct = AvgTRPct;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-08=======
// Volume RSI 成交量相對強弱指標(Volume RSI, Relative Strength Index)
// eVolRSI完全自創指標,completely self-created indicators. 
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function VolumeRSI(K_close, K_vol, RSI_day, esp) {
  // Menu Name: Vol RSI      //RSI_day=5,10,15,..., // esp=9
  // K_close=STK_close, K_vol=STK_vol, RSI_day=5,10,15,..., 例：esp=9
  // First calculate RSI
  const VolRSI=[], eVolRSI=[];   //自創新eVolRSI
  const dif=[];                  //dif=今收盤-昨收盤
  for(let i=2; i<K_close.length; i++) {
    dif[i]=K_close[i]-K_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和,改為上漲時成交量累加
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和,改為下跌時成交量累加
  for(let i=2; i<RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {  //Up
      //sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
      sum_Up = sum_Up + K_vol[i]; }    //上漲時成交量累加
    else {            //Down
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      //sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
      sum_Dn=sum_Dn + K_vol[i];        //下跌時成交量累加
    }
  }
  //if RSI_day=10 then first VolRSI value=VolRSI[11]
  if((sum_Up+sum_Dn) === 0) {
    VolRSI[RSI_day+1]=100; }
  else {
    VolRSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  eVolRSI[RSI_day+1]=VolRSI[RSI_day+1]   //eRSI的初值=eRSI[11],自創
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    // 先加新的成交量(收盤價)差值！
    if(dif[i] > 0) {
      //sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
      sum_Up=sum_Up + K_vol[i]; }         //上漲時成交量累加
    else {
      //sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
      sum_Dn=sum_Dn + K_vol[i];           //下跌時成交量累加
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      //sum_Up=sum_Up-dif[i-RSI_day]; }
      sum_Up=sum_Up - K_vol[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      //sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
      sum_Dn=sum_Dn - K_vol[i-RSI_day];
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      VolRSI[i]=100; }
    else {
      VolRSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    eVolRSI[i]=(esp-1)/(esp+1)*eVolRSI[i-1]+2/(esp+1)*VolRSI[i]; //自創
    //eRSI新=(n-1)/(n+1)*eRSI舊+2/(n+1)*RSI新
  }
  //==========此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  return { VolRSI, eVolRSI };
  //if RSI_day=10 then VolRSI[] and eVolRSI[]=11,12,...,2000.
  //drawing the VolRSI[] and eVolRSI[] figures in the small windows.
}
window.VolumeRSI = VolumeRSI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-10===============================
//短吻鱷魚線(Gator Oscillator), 改良自鱷魚線(Alligator Indicator)
//藍色顎線(jaw)，紅色齒線(teeth)，綠色唇線(lip)
//分別計算MP的13日平滑移動平均。計算MP的8日平滑移動平均。計算MP的5日平滑移動平均
function GatorOscillator(K_high, K_low) { 
  // Menu Name: Gator Osc
  //K_high=STK_high, K_low=STK_low
  const Jaw_t=[], Teeth_t=[], Lip_t=[];       //暫時變數
  const Jaw_emp=[], Teeth_emp=[], Lip_emp=[]; //MP的指數平滑移動平均=emp
  const MP=0;   //MP=(High+Low)/2
  //first Jaw_t[1], Teeth_t[1], Jip_t[1]
  MP=(K_high[1]+K_low[1])/2;
  Jaw_t[1]=MP; 
  Teeth_t[1]=MP; 
  Lip_t[1]=MP;
  //compute the rest values of indicators.   e.g. i=2 to 2000
  for(let i=2; i<K_high.length; i++) {      // i=2 to 2000  
    MP=(K_high[i]+K_low[i])/2;
    Jaw_t[i]=(12/14)*Jaw_t[i-1]+(2/14)*MP;   //藍色顎線(jaw)_在下方
    Teeth_t[i]=(7/9)*Teeth_t[i-1]+(2/9)*MP;  //紅色齒線(teeth)_在中間
    Lip_t[i]=(4/6)*Lip_t[i-1]+(2/6)*MP;      //綠色唇線(lip)_在上方
  }
  //多頭時：藍色顎線(jaw)_在下方。紅色齒線(teeth)_在中間。綠色唇線(lip)_在上方
  //取8天前的Jaw_emp值作為當天的藍色顎線值_在下方
  //取5天前的Teeth_emp值作為當天的紅色齒線值_在中間
  //取3天前的Lip_emp值作為當天的綠色唇線值_在上方
  for(let i=4; i<K_high.length; i++) {   // i=4 to 2000
    Lip_emp[i]=Lip_t[i-3];       //取3天前的Lip值作為當天的綠色唇線值,Lip_emp[4]
    if(i>5) {                    // i=6 to 2000
      Teeth_emp[i]=Teeth_t[i-5]; } //取5天前的Teeth值作為當天的紅色齒線值,Teeth_emp[6]
    if(i>8) {                      // i=9 to 2000
      Jaw_emp[i]=Jaw_t[i-8]; }     //取8天前的Jaw值作為當天的藍色顎線值,Jaw_emp[9]
  }
  //上述整合原本需要用三個LOOP的，變為一個LOOP
  //本例方法： Gator=[在上方綠色唇線(lip)] 減 [在下方藍色顎線(jaw)]
  const Gator=[];   //短吻鱷魚線(Gator Oscillator)
  for(let i=9; i<K_high.length; i++) {   // i=9 to 2000
    Gator[i]=Lip_emp[i]-Jaw_emp[i];
  }
  //return {Lip_emp, Teeth_emp, Jaw_emp}; //鱷魚線(Alligator Indicator)則傳回左列三陣列
  return { Gator };
  //in this case, drawing Gator[] indicator in the small windows
  //Gator[]=9,...,2000
}
window.GatorOscillator = GatorOscillator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-10=======
// 漲跌價量指標(PVIRiseFall, Price and Volume Indicator of Rise and Fall)
// 完全自創指標,completely self-created indicators. 
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// if 價格上漲: 分子=sum[(Ct-Ct_1)*Vol]
// if 價格下跌: 分母=sum[abs(Ct-Ct_1)*Vol]
// PVIRiseFall=分子/分母
function PVIRiseFall(K_close, K_vol, day, esp) {
  // Menu Name: PVIRiseFall      //day=10,15,...,  // esp=9
  // K_close=STK_close, K_vol=STK_vol
  const PVIRiseFall=[], ePVIRiseFall=[];
  let sum_Up=0;   //分子加總
  let sum_Dn=0;   //分母加總
  for(let i=2; i<day+1; i++) {    //ex. i=2 to 11
    if(K_close[i]>K_close[i-1]) {  //價格上漲
      sum_Up=sum_Up+(K_close[i]-K_close[i-1])*K_vol[i]; }
    if(K_close[i]<K_close[i-1]) {  //價格下跌
      sum_Dn=sum_Dn+(K_close[i-1]-K_close[i])*K_vol[i]; }
  }
  if(sum_Dn===0) {   //避免分母=0
    PVIRiseFall[day+1]=100; }
  else {
    PVIRiseFall[day+1]=sum_Up/sum_Dn;      //first value=PVIRiseFall[11]
  }
  ePVIRiseFall[day+1]=PVIRiseFall[day+1];  //first value=ePVIRiseFall[11]
  //calculate the remaining values
  for(let i=day+2; i<K_close.length; i++) {  //ex. i=12 to 2000
    //先減舊的
    if(K_close[i-day]>K_close[i-day-1]) {  //價格上漲
      sum_Up=sum_Up-(K_close[i-day]-K_close[i-day-1])*K_vol[i-day]; }
    if(K_close[i-day]<K_close[i-day-1]) {  //價格下跌
      sum_Dn=sum_Dn+(K_close[i-day-1]-K_close[i-day])*K_vol[i-day]; }
    //再加新的
    if(K_close[i]>K_close[i-1]) {  //價格上漲
      sum_Up=sum_Up+(K_close[i]-K_close[i-1])*K_vol[i]; }
    if(K_close[i]<K_close[i-1]) {  //價格下跌
      sum_Dn=sum_Dn+(K_close[i-1]-K_close[i])*K_vol[i]; }
    if(sum_Dn===0) {   //避免分母=0
      PVIRiseFall[i]=100; }
    else {
      PVIRiseFall[i]=sum_Up/sum_Dn;   //second value=PVIRiseFall[12]
    }
    ePVIRiseFall[i]=(esp-1)/(esp+1)*ePVIRiseFall[i-1]+2/(esp+1)*PVIRiseFall[i];
  }
  return { PVIRiseFall, ePVIRiseFall };
  //if day=10 then PVIRiseFall[] and ePVIRiseFall[] =11,12,...,2000.
  //drawing the PVIRiseFall[] and ePVIRiseFall[] figures in the small windows.
}
window.PVIRiseFall = PVIRiseFall;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-10=======
// 漲漲跌百分比價量指標(PVIpercentRiseFall, 
// Price-Volume Indicator of Percentage of Rise and Fall)
// 完全自創指標,completely self-created indicators. 
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// if 價格上漲: 分子=sum[(Ct-Ct_1)/Ct_1*Vol]
// if 價格下跌: 分母=sum[abs(Ct-Ct_1)/Ct_1*Vol]
// PVIpercentRiseFall=分子/分母
function PVIpercentRiseFall(K_close, K_vol, day, esp) {
  // Menu Name: PVIpercentRiseFall     //day=10,15,..., // esp=9
  // K_close=STK_close, K_vol=STK_vol
  const PVIpercentRiseFall=[], ePVIpercentRiseFall=[];
  let sum_Up=0;   //分子加總
  let sum_Dn=0;   //分母加總
  for(let i=2; i<day+1; i++) {    //ex. i=2 to 11
    if(K_close[i]>K_close[i-1]) {  //價格上漲
      sum_Up=sum_Up+(K_close[i]-K_close[i-1])/K_close[i-1]*K_vol[i]; }
    if(K_close[i]<K_close[i-1]) {  //價格下跌
      sum_Dn=sum_Dn+(K_close[i-1]-K_close[i])/K_close[i-1]*K_vol[i]; }
  }
  if(sum_Dn===0) {   //避免分母=0
    PVIpercentRiseFall[day+1]=100; }
  else {
    PVIpercentRiseFall[day+1]=sum_Up/sum_Dn;   //first value=PVIpercentRiseFall[11]
  }
  ePVIpercentRiseFall[day+1]=PVIpercentRiseFall[day+1]; //first value=PVIpercentRiseFall[11]
  //calculate the remaining values
  for(let i=day+2; i<K_close.length; i++) {  //ex. i=12 to 2000
    //先減舊的
    if(K_close[i-day]>K_close[i-day-1]) {  //價格上漲
      sum_Up=sum_Up-(K_close[i-day]-K_close[i-day-1])/K_close[i-day-1]*K_vol[i-day]; }
    if(K_close[i-day]<K_close[i-day-1]) {  //價格下跌
      sum_Dn=sum_Dn+(K_close[i-day-1]-K_close[i-day])/K_close[i-day-1]*K_vol[i-day]; }
    //再加新的
    if(K_close[i]>K_close[i-1]) {  //價格上漲
      sum_Up=sum_Up+(K_close[i]-K_close[i-1])/K_close[i-1]*K_vol[i]; }
    if(K_close[i]<K_close[i-1]) {  //價格下跌
      sum_Dn=sum_Dn+(K_close[i-1]-K_close[i])/K_close[i-1]*K_vol[i]; }
    if(sum_Dn===0) {   //避免分母=0
      PVIpercentRiseFall[i]=100; }
    else {
      PVIpercentRiseFall[i]=sum_Up/sum_Dn;   //second value=PVIpercentRiseFall[12]
    }
    ePVIpercentRiseFall[i]=(esp-1)/(esp+1)*ePVIpercentRiseFall[i-1]+2/(esp+1)*PVIpercentRiseFall[i];
  }
  return { PVIpercentRiseFall, ePVIpercentRiseFall };
  //if day=10 then PVIpercentRiseFall[] and ePVIpercentRiseFall[] =11,12,...,2000.
  //drawing the PVIpercentRiseFall[] and ePVIpercentRiseFall[] figures in the small windows.
}
window.PVIpercentRiseFall = PVIpercentRiseFall;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-23===modified on 2026-April-24==
// <<完全自創指標,completely self-created indicators >>  // Stochastic of RSI 
// RSIKD相對強弱隨機指標(RSIKD, Stochastic Relative Strength Index)
// RSIKD是將RSI的值當作原始資料，套用KD的計算方法，得到的指標。
// 由Tushar Chande和Stanley Kroll在1994年提出的技術分析指標，
// 旨在衡量RSI的相對位置，以識別超買和超賣狀態。RSIKD則是我完全自創的指標，將RSI的值當作原始資料，
// 套用KD的計算方法，得到的指標。RSIKD可以幫助投資者更好地理解市場動態，並做出更明智的投資決策。
//此程式上半部是完整的RSI設計，以此為主。<2026-Feb-24>
function RSIKD(K_close, KD_day, RSI_day) {
  // Menu Name: RSIKD      //KD_day=9   //RSI_day=5,10,15,...
  // Stochastic of RSI  <自創指標>
  // First calculate RSI
  const RSI = [];
  const dif = [];
  for(let i = 2; i <= K_close.length; i++){
    dif[i] = K_close[i] - K_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=5, RSI()=6,7,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  //for(let i=2; i<RSI_day; i++){  // Fahmi輸入此，應該錯誤!
  for(let i=2; i<RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    // 先加新的！
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn = sum_Dn + Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up = sum_Up - dif[i-RSI_day]; }
    else {
      //sum_Dn = sum_Dn + dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn = sum_Dn - Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i] = 100; }
    else {
       RSI[i] = sum_Up/(sum_Up+sum_Dn)*100;
    }
  }
  //==========此程式上半部是完整的RSI設計，以此為主。<2026-Feb-24>
  //compute the RSIKD 相對強弱隨機指標。completely self-created indicators.
  // KD_day=9,...
  const RSIKD_K=[], RSIKD_D=[];
  // if RSI_day=10, then first RSI is RSI[11]
  for(let i=RSI_day+KD_day; i<K_close.length; i++) { //i=(10+9),20,...,2000
    let maxHigh=RSI[i-KD_day+1];   //令第一筆 RSI 為最大=RSI[11]
    let minLow=RSI[i-KD_day+1];    //令第一筆 RSI 為最小=RSI[11]
    // 第一輪：在 RSI 第12-19筆之間找最大與最小的RSI.因為第11筆已經設為最大與最小。
    for(let j=i-KD_day+2; j<=i; j++) {  //第一輪：j=12 to 19
      maxHigh=Math.max(maxHigh, RSI(j));
      maxLow=Math.min(maxLow, RSI(j));
    }
    let rsv;
    if(maxHigh===minLow) {
      rsv=100; }
    else {
      rsv=((RSI[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i===RSI_day+KD_day) {  //i=10+9, KD初值
      RSIKD_K[i]=50;    //i=10+9, RSIKD_K初值
      RSIKD_D[i]=50; }  //i=10+9, RSIKD_D初值
    else {
      RSIKD_K[i]=(2/3)*RSIKD_K[i-1]+(1/3)*rsv;        //第2筆=RSIKD_K[20]
      RSIKD_D[i]=(2/3)*RSIKD_D[i-1]+(1/3)*RSIKD_K[i]; //第2筆=RSIKD_D[20]
    }
  }
  return { RSIKD_K, RSIKD_D };
  //if RSI_day=10, KD_day=9 then RSIKD_K and RSIKD_D=19,20,...,2000.
  //drawing the RSIKD_K and RSIKD_D figures in the small windows.
}
window.RSIKD = RSIKD;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-April-24==================================
// <<完全自創指標,completely self-created indicators >>  // Stochastic of RSI
// 此方法不用(2/3)和(1/3)的權重，而是用(esp-1)/(esp+1)和2/(esp+1)的權重
// 即指數平滑法的權重，esp=9,則(esp-1)/(esp+1)=0.8, 2/(esp+1)=0.2，與(2/3)和(1/3)的權重相近，
// 但更具彈性，可以根據需要調整esp的值，以適應不同的市場條件和投資策略。
// newRSIKD相對強弱隨機指標(newRSIKD, Stochastic Relative Strength Index)
// newRSIKD是將RSI的值當作原始資料，套用KD的計算方法，得到的指標。
// 旨在衡量RSI的相對位置，以識別超買和超賣狀態。newRSIKD與RSIKD都是我完全自創的指標，
// 將RSI的值當作原始資料，套用KD的計算方法，得到的指標。newRSIKD可以幫助投資者更好地理解市場動態，
// 並做出更明智的投資決策。
// 此程式上半部是完整的RSI設計，以此為主。<2026-Feb-24>
function newRSIKD(K_close, KD_day, RSI_day, esp) {
  // Menu Name: newRSIKD   //KD_day=9  //RSI_day=5,10,15,..//esp=9,10,...
  // Stochastic of RSI  <自創指標>
  // First calculate RSI
  const RSI = [];
  const dif = [];
  for(let i = 2; i <= K_close.length; i++){
    dif[i] = K_close[i] - K_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=5, RSI()=6,7,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    // 先加新的！
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn = sum_Dn + Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up = sum_Up - dif[i-RSI_day]; }
    else {
      //sum_Dn = sum_Dn + dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn = sum_Dn - Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i] = 100; }
    else {
       RSI[i] = sum_Up/(sum_Up+sum_Dn)*100;
    }
  }
  //==========此程式上半部是完整的RSI設計，以此為主。<2026-Feb-24>
  //compute the newRSIKD 相對強弱隨機指標。completely self-created indicators.
  // KD_day=9,...
  const newRSIKD_K=[], newRSIKD_D=[];
  // if RSI_day=10, then first RSI is RSI[11]
  for(let i=RSI_day+KD_day; i<K_close.length; i++) { //i=(10+9),20,...,2000
    let maxHigh=RSI[i-KD_day+1];   //令第一筆 RSI 為最大=RSI[11]
    let minLow=RSI[i-KD_day+1];    //令第一筆 RSI 為最小=RSI[11]
    // 第一輪：在 RSI 第12-19筆之間找最大與最小的RSI.因為第11筆已經設為最大與最小。
    for(let j=i-KD_day+2; j<=i; j++) {  //第一輪：j=12 to 19
      maxHigh=Math.max(maxHigh, RSI(j));
      maxLow=Math.min(maxLow, RSI(j));
    }
    let rsv;
    if(maxHigh===minLow) {
      rsv=100; }
    else {
      rsv=((RSI[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i===RSI_day+KD_day) {  //i=10+9, KD初值
      newRSIKD_K[i]=50;    //i=10+9, RSIKD_K初值
      newRSIKD_D[i]=50; }  //i=10+9, RSIKD_D初值
    else {
      //RSIKD_K[i]=(2/3)*newRSIKD_K[i-1]+(1/3)*rsv;        //第2筆=RSIKD_K[20]
      //RSIKD_D[i]=(2/3)*newRSIKD_D[i-1]+(1/3)*newRSIKD_K[i]; //第2筆=RSIKD_D[20]
      newRSIKD_K[i]=(esp-1)/(esp+1)*newRSIKD_K[i-1]+2/(esp+1)*rsv;        //第2筆=RSIKD_K[20]
      newRSIKD_D[i]=(esp-1)/(esp+1)*newRSIKD_D[i-1]+2/(esp+1)*newRSIKD_K[i]; //第2筆=RSIKD_D[20]
    }
  }
  return { newRSIKD_K, newRSIKD_D };
  //if RSI_day=10, KD_day=9 then newRSIKD_K and newRSIKD_D=19,20,...,2000.
  //drawing the newRSIKD_K and newRSIKD_D figures in the small windows.
}
window.newRSIKD = newRSIKD;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-14======
//ATR均幅指標(ATR, Average True Range) indicator.
//ATR[]=TR的指數平滑移動平均
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//20日EMA+2*ATR(20)為上軌。20日EMA-2*ATR(20)為下軌。20日EMA為中軌.
function KeltnerChannels(K_high, K_low, K_close, esp1) {
  // Menu Name: Keltner Channels     // esp1=9, 10,...
  // for example: esp=10
  const ATR=[]; //ATR[]=TR的指數平滑移動平均
  const TR=[];  //TR=真實波幅(True Range),TR是陣列不是變數
  let temp1, temp2, temp3;
  esp1 = (esp1 == null ? 10 : esp1);  //exponential smoothing parameter(esp)
  for(let i=2; i<K_close.length; i++) {  //i=2 to 2000
    temp1 = K_high[i] - K_low[i];
    temp2 = Math.abs(K_high[i] - K_close[i-1]);
    temp3 = Math.abs(K_low[i] - K_close[i-1]);
    TR[i] = Math.max(temp1, temp2, temp3);
    if(i===2) {
      ATR[2]=TR[2]; }  //ATR[2]=TR,因為i=2才開始計算TR,所以ATR[2]=TR.
    else {
      ATR[i]=(esp1-1)/(esp1+1)*ATR[i-1]+2/(esp1+1)*TR[i];
    }
  }  // TR[], ATR[]=2,3,...,2000.
  // compute EMA[]=2,3,...,2000
  const middleEMA=[];  //Green. middleEMA=simpleEMA[]=1,2,...,2000
  const upperEMA=[];   //Blue. =2,3,...,2000, upperEMA=middleEMA[]+2*ATR
  const lowerEMA=[];   //Blue. =2,3,...,2000, lowerEMA=middleEMA-2*ATR
  let esp2=20;         //exponential smoothing parameter(esp)
  middleEMA[1]=K_close[1];    //simpleEMA[]=1,2,...,2000
  // upperEMA, lowerEMA=2,3,...,2000.
  for(let i=2; i<K_close.length; i++) {  
    middleEMA[i]=(esp2-1)/(esp2+1)*middleEMA[i-1]+2/(esp2+1)*K_close[i];
    //EMA今=(n-1)/(n+1)*EMA昨+2/(n+1)*MA今
    upperEMA[i]=middleEMA[i]+2*ATR[i];  //上軌=中軌+2*ATR, Blue Color
    lowerEMA[i]=middleEMA[i]-2*ATR[i];  //下軌=中軌-2*ATR, Blue Color
  }
  return { upperEMA, middleEMA, lowerEMA };
  //normally drawing the upperEMA, middleEMA, lowerEMA figures in the K-Line area.
  //drawing the K_close, upperEMA, middleEMA, lowerEMA figures in the small windows.
  //upperEMA, middleEMA, lowerEMA=2,3,...,2000.
}
window.KeltnerChannels = KeltnerChannels;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-25=============
//錢德動量擺動指標(Chande Momentum Oscillator, CMO)
//Chande Momentum Oscillator(CMO)=(N日內漲幅總和-N日內跌幅總和)/(N日內漲幅總和+N日內跌幅總和)*100
//N日內漲幅總和=N日內漲幅1+N日內漲幅2+...+N日內漲幅N
//今N日內漲幅=今收盤價-昨收盤價, if 今收盤價>昨收盤價, else 今N日內漲幅=0
//今N日內跌幅總和=N日內跌幅1+N日內跌幅2+...+N日內跌幅N
//今N日內跌幅=昨收盤價-今收盤價, if 昨收盤價>今收盤價, else 今N日內跌幅=0
//CMO值範圍在-100到+100之間, CMO>0表示多頭市場, CMO<0表示空頭市場
//CMO=(N日內漲幅總和-N日內跌幅總和)/(N日內漲幅總和+N日內跌幅總和)*100
//eCMO=(n-1)/(n+1)*eCMO昨+2/(n+1)*CMO今, <自創>
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//function ChandeMomentumOscillator(K_close, day, esp) {   //CMO
function ChandeMomOsc(K_close, day, esp) {   //CMO
  // Menu Name: ChandeMomOsc    // day=10, 20, ...,  esp=9
  const up = [];    //例如:N=10, up=2 to 2000, 上漲
  const down = [];  //例如:N=10, down=2 to 2000, 下跌
  for(let i=2; i<K_close.length; i++) {   //i=2 to 2000
    if(K_close[i]>K_close[i-1]) {   //今收盤價>昨收盤價
      up[i]=K_close[i]-K_close[i-1]; }
    else {
      up[i]=0;
    }
    if(K_close[i-1]>K_close[i]) {   //昨收盤價>今收盤價
      down[i]=K_close[i-1]-K_close[i]; }
    else {
      down[i]=0;
    }
  }
  //compute CMO[]=11 to 2000, 例如:N=10, day+1 to 2000
  const CMO = [], eCMO = [];  //例如:N=10, CMO=11 to 2000
  let sum_up=0;    //加總N日內漲幅總和
  let sum_down=0;  //加總N日內跌幅總和
  for(let i=2; i<day+1; i++) {   //i=2 to 11, 例如:N=10
    sum_up+=up[i];
    sum_down+=down[i];
  }
  CMO[day+1]=(sum_up-sum_down)/(sum_up+sum_down)*100;  //例如:first CMO[11]
  eCMO[day+1]=CMO[day+1];               //<自創>,令eCMO初值=CMO初值, 例如:first eCMO[11]
  //compute CMO[]=12 to 2000, 例如:N=10, i=day+2 to 2000
  for(let i=day+2; i<K_close.length; i++) {   //i=12 to 2000
    sum_up=sum_up-up[i-day]+up[i];          //例如:N=10,sum_up=sum_up-up[2]+up[12]
    sum_down=sum_down-down[i-day]+down[i];  //例如:N=10,sum_down=sum_down-down[2]+down[12]
    CMO[i]=(sum_up-sum_down)/(sum_up+sum_down)*100;     //例如:N=10,second CMO[12]
    eCMO[i]=(esp-1)/(esp+1)*eCMO[i-1]+2/(esp+1)*CMO[i]; //例如:N=10,second eCMO[12]
  }
  return { CMO, eCMO };
  //drawing the CMO and eCMO figures in the small windows.
  //if day=10, then CMO[], eCMO[]=11,12,...,2000.
}
window.ChandeMomOsc = ChandeMomOsc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-26=============
//ARMS指標(Arms Index, TRIN),本人自創的指標,原用在大盤分析,本人改用在個股分析.
//ARMS指標的計算方法:ARMS=(Advancing Issues/Declining Issues)/(Advancing Volume/Declining Volume)
//ARMS指標的解讀:ARMS>1表示市場處於弱勢, ARMS<1表示市場處於強勢, ARMS=1表示市場處於平衡.
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function Arms_TRIN(K_close, K_vol, day, esp) {   //ARMS指標(Arms Index, TRIN)
  // Menu Name: Arms_TRIN         // day=10, 20, ...,  esp=9, 19,...
  //K_close=STK_close, K_vol=STK_vol 
  const Arms = [];    //例如:N=10, Arms=11 to 2000
  const eArms = [];   //例如:N=10, eArms=11 to 2000
  //compute first Arms[]=10, 例如:N=10, Arms[11 to 2000]
  let sum_up_price=0;    //加總N日內(C今>C昨)天數總和
  let sum_down_price=0;  //加總N日內(C今<C昨)天數總和
  let sum_up_vol=0;      //加總N日內(C今>C昨)成交量總和
  let sum_down_vol=0;    //加總N日內(C今<C昨)成交量總和
  for(let i=2; i<day+1; i++) {    //i=2 to 11, 例如:N=10
    if(K_close[i]>K_close[i-1]) {  //C今>C昨,上漲
      sum_up_price=sum_up_price+1; //C今>C昨的天數加1
      sum_up_vol += K_vol[i]; }    //C今>C昨的成交量累加
    else if(K_close[i]<K_close[i-1]) {  //C今<C昨,下跌
      sum_down_price=sum_down_price+1;  //C今<C昨的天數加1
      sum_down_vol += K_vol[i];   //C今<C昨的成交量累加
    }
  }
  if(sum_down_price===0) {
    sum_down_price=1;  //避免分母為0
    sum_down_vol=1;    //避免分母為0
  }
  Arms[day+1]=(sum_up_price/sum_down_price)/(sum_up_vol/sum_down_vol);  //例如:N=10, first Arms[11]
  eArms[day+1]=Arms[day+1];  //compute eArms[]=11 to 2000, 例如:N=10
  for(let i=day+2; i<K_close.length; i++) {   //i=12 to 2000
    //先扣除第i-day日的資料,再加入第i日的資料
    if(K_close[i-day]>K_close[i-day-1]) {  //C[2]>C[1],上漲
      sum_up_price=sum_up_price-1;         //C[2]>C[1],上漲的天數扣除1
      sum_up_vol=sum_up_vol-K_vol[i-day];  //C[2]>C[1],上漲的成交量扣除K_vol[2]
    } else if(K_close[i-day]<K_close[i-day-1]) {  //C[2]<C[1],下跌
      sum_down_price=sum_down_price-1;     //C[2]<C[1],下跌的天數扣除1
      sum_down_vol=sum_down_vol-K_vol[i-day];  //C[2]<C[1],下跌的成交量扣除K_vol[2]
    }
    //再加入第i日的資料
    if(K_close[i]>K_close[i-1]) {   //C今>C昨,上漲. C[12]>C[11],上漲
      sum_up_price=sum_up_price+1;  //C今>C昨的天數加1
      sum_up_vol=sum_up_vol+K_vol[i]; }   //C今>C昨的成交量累加
    else if(K_close[i]<K_close[i-1]) {    //C今<C昨,下跌. C[12]<C[11],下跌
      sum_down_price=sum_down_price+1;    //C今<C昨的天數加1
      sum_down_vol=sum_down_vol+K_vol[i]; //C今<C昨的成交量累加
    } 
    if(sum_down_price===0) {
      sum_down_price=1;  //避免分母為0
      sum_down_vol=1;    //避免分母為0
    }
    Arms[i]=(sum_up_price/sum_down_price)/(sum_up_vol/sum_down_vol);  //例如:N=10, second Arms[12]
    eArms[i]=(esp-1)/(esp+1)*eArms[i-1]+2/(esp+1)*Arms[i];            //second eArms[12]
  }
  return { Arms, eArms };
  //drawing the Arms[] and eArms[] figures in the small windows.
  //if day=10, then Arms[], eArms[]=11,12,...,2000.
}
window.Arms_TRIN = Arms_TRIN;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-28=============
//FI勁道指標(Force Index, FI)
//FI指標的計算方法:FI=(C今-C昨)*成交量
//FI指標的解讀:FI>0表示市場處於強勢, FI<0表示市場處於弱勢, FI=0表示市場處於平衡.
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ForceIndex(K_close, K_vol, esp) {   //FI指標(Force Index, FI)
  // Menu Name: Force Index        //day=10, 20, ...,  esp=9, 10,...
  const FI = [];    //例如:N=10, FI[]=2 to 2000
  const eFI = [];   //例如:N=10, eFI[]=2 to 2000
  //compute first FI[2], 例如:N=10, FI[2 to 2000]
  for(let i=2; i<K_close.length; i++) {    //i=2 to 2000
    FI[i]=(K_close[i]-K_close[i-1])*K_vol[i]; //first eFI[2],例如:N=10, eFI[2 to 2000]
    if(i==2) {         //i=2, first eFI[2]初始值等於FI[2]
      eFI[2]=FI[2]; }  //first eFI[2]
    else {
      eFI[i]=(esp-1)/(esp+1)*eFI[i-1]+2/(esp+1)*FI[i];   //second eFI[3] to eFI[2000]
    }
  }
  return { FI, eFI };
  //drawing the FI[] and eFI[] figures in the small windows.
  //FI[], eFI[]=2,3,...,2000.
}
window.ForceIndex = ForceIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-28=============
//FI勁道指標(Force Index, FI), FI=(C今-C昨)*成交量  <原來指標>
//漲跌比率FI勁道指標(RiseFallRatioFI, Rise/Fall Ratio Force Indicator) <自創指標>
//FI指標的計算方法:FI=(C今-C昨)/C昨*成交量。  //<自創指標,自己中英命名>
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function RiseFallRatioFI(K_close, K_vol, esp) {
  // Menu Name: RFR_FI        // esp=9, 10, ...//漲跌比率FI勁道指標(RiseFallRatioFI)
  const RiseFallRatioFI = [];    //例如:N=10, RiseFallRatioFI=2 to 2000
  const eRiseFallRatioFI = [];   //例如:N=10, eRiseFallRatioFI=2 to 2000
  //compute first FI[]=2, 例如:N=10, FI[2 to 2000]
  for(let i=2; i<K_close.length; i++) {    //i=2 to 2000
    RiseFallRatioFI[i]=(K_close[i]-K_close[i-1])/K_close[i-1]*K_vol[i]; 
    //first eFI[]=2,例如:N=10, eFI[2 to 2000]
    if(i==2) {         //i=2, first eFI[2]初始值等於FI[2]
      eRiseFallRatioFI[2]=RiseFallRatioFI[2];  //first eRiseFallRatioFI[2]
    }
    eRiseFallRatioFI[i]=(esp-1)/(esp+1)*eRiseFallRatioFI[i-1]+2/(esp+1)*RiseFallRatioFI[i];   
    //second eRiseFallRatioFI[3] to [2000]
  }
  return { RiseFallRatioFI, eRiseFallRatioFI };
  //drawing the RiseFallRatioFI and eRiseFallRatioFI figures in the small windows.
  //RiseFallRatioFI[], eRiseFallRatioFI[]=2,3,...,2000.
}
window.RiseFallRatioFI = RiseFallRatioFI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-28=============
//FI勁道指標(Force Index, FI)
//平均漲跌比率FI勁道指標」(AvgRiseFallRatioFI, Average Rise/Fall Ratio Force Indicator),自創指標
//FI指標的計算方法:FI=(C今-C昨)/C昨*成交量
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function AvgRiseFallRatioFI(K_close, K_vol, day, esp) {
  // Menu Name: AvgRFR_FI   //day=10, 20,..., esp=9, 10, ...//平均漲跌比率FI勁道指標(AvgRiseFallRatioFI)
  const AvgRiseFallRatioFI = [];    //例如:N=10, AvgRiseFallRatioFI=2 to 2000
  const eAvgRiseFallRatioFI = [];   //例如:N=10, eAvgRiseFallRatioFI=2 to 2000
  //compute AvgRiseFallRatioFI and eAvgRiseFallRatioFI from i=2 to day+1
  let sum=0;
  for(let i=2; i<day+1; i++) {    //i=2 to 11
    sum=sum+(K_close[i]-K_close[i-1])/K_close[i-1]*K_vol[i];
  }
  AvgRiseFallRatioFI[day+1]=sum/day;   //first AvgRiseFallRatioFI[11] for day=10
  eAvgRiseFallRatioFI[day+1]=AvgRiseFallRatioFI[day+1];  //first eAvgRiseFallRatioFI[day+1]
  //compute average rise/fall ratio,first AvgRiseFallRatioFI[11] for day=10, 
  // then AvgRiseFallRatioFI[21] for day=20, and so on.
  for(let i=day+2; i<K_close.length; i++) {    //i=12 to 2000
    //remove the first term of the previous sum
    sum=sum-(K_close[i-day]-K_close[i-day-1])/K_close[i-day-1]*K_vol[i-day];  
    //add the new term to the sum
    sum=sum+(K_close[i]-K_close[i-1])/K_close[i-1]*K_vol[i];
    AvgRiseFallRatioFI[i]=sum/day;  //compute average rise/fall ratio
    eAvgRiseFallRatioFI[i]=(esp-1)/(esp+1)*eAvgRiseFallRatioFI[i-1]+2/(esp+1)*AvgRiseFallRatioFI[i];   
    //compute exponential smoothing average of average rise/fall ratio,eAvgRiseFallRatioFI[12] to [2000]
  }
  return { AvgRiseFallRatioFI, eAvgRiseFallRatioFI };
  //drawing the AvgRiseFallRatioFI and eAvgRiseFallRatioFI figures in the small windows.
  //if day=10, then AvgRiseFallRatioFI[], eAvgRiseFallRatioFI[]=11,12,...,2000.
}
window.AvgRiseFallRatioFI = AvgRiseFallRatioFI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-March-29=============
//重心震盪指標(COG, Center of Gravity Oscillator) 
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
//function CenterOfGravityOscillator(K_close, day, esp) {
function GravityOsc_COG(K_close, day, esp) {   //原名:CenterOfGravityOscillator
  // Menu Name: GravityOsc_COG         // day=10, 20, ...,  esp=9, 10,...
  let sum_weighted_price=0;  //分子=加權價格總和=sum of weighted price=0
  let sum_weight=0;          //分母=權重總和=sum of weights=0
  const COG=[];   //重心震盪指標=分子/分母=Center of Gravity Oscillator,=10,11,...,2000
  const eCOG=[];  //自創,指數平滑移動平均=EMA of COG, =10,11,...,2000
  sum_weight=day*(day+1)/2;  //sum of weights=1+2+...+day=day*(day+1)/2
  let counter;
  for(let i=day; i<K_close.length; i++) {  //i=10 to 2000
    sum_weighted_price=0;  //分子=加權價格總和=sum of weighted price=0,歸零.
    counter=1;             //counter=1 to day,計數器=1, 2,...,day
    for(let j=i-day+1; j<=i; j++) {    //j=1 to 10
      sum_weighted_price += K_close[j]*counter;  //分子=加權價格總和=sum of weighted price
      counter=counter+1;  //counter=1, 2,...,day
    }
    COG[i]=sum_weighted_price/sum_weight;  //重心震盪指標=分子/分母=COG
    if(i==day) {         //當i=10時，eCOG[10]=COG[10]
      eCOG[i]=COG[i]; }  //eCOG=exponential moving average of COG
    else {               //當i>10時
      eCOG[i]=(esp-1)/(esp+1)*eCOG[i-1]+2/(esp+1)*COG[i];
    }
  } 
  return { COG, eCOG };
  //drawing the COG[] and eCOG[] figures in the small windows.
  //if day=10, then COG[], eCOG[]=10,11,...,2000.
}
window.GravityOsc_COG = GravityOsc_COG;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-April-01=============完全自創新
//價差重心震盪指標(PriceDifCOG, Price Difference Center of Gravity Oscillator),完全自創
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function PriceDifCOG(K_close, day, esp) {  //完全自創新
  // Menu Name: PriceDifCOG       //day=10, 20, ...,  esp=9, 10,...
  let sum_weighted_PriceDif=0;  //分子=加權價格總和=sum of weighted price difference=0
  let sum_weight=0;             //分母=權重總和=sum of weights=0
  const PriceDifCOG=[];   //重心震盪指標=分子/分母=Center of Gravity Oscillator, =11,12,...,2000
  const ePriceDifCOG=[];  //自創,指數平滑移動平均=exponential moving average(EMA) of COG, =11,12,...,2000
  sum_weight=day*(day+1)/2;  //sum of weights=1+2+...+day=day*(day+1)/2
  let counter;
  for(let i=day+1; i<K_close.length; i++) {  //i=11 to 2000
    sum_weighted_PriceDif=0;  //分子=加權價格總和=sum of weighted price difference=0,歸零.
    counter=1;                //counter=1 to day,計數器=1, 2,...,day
    for(let j=i-day+1; j<=i; j++) {    //j=2 to 11
      sum_weighted_PriceDif += (K_close[j]-K_close[j-1])*counter;  //分子=加權價格總和=sum of weighted price difference
      counter=counter+1;  //counter=1, 2,...,day
    }
    PriceDifCOG[i]=sum_weighted_PriceDif/sum_weight;  //PriceDifCOG[]=11 to 2000,重心震盪指標=分子/分母
    if(i==day+1) {         //當i=11時，ePriceDifCOG[11]=PriceDifCOG[11]
      ePriceDifCOG[i]=PriceDifCOG[i]; }  //ePriceDifCOG=exponential moving average of PriceDifCOG
    else {               //當i>11時
      ePriceDifCOG[i]=(esp-1)/(esp+1)*ePriceDifCOG[i-1]+2/(esp+1)*PriceDifCOG[i];
    }
  } 
  return { PriceDifCOG, ePriceDifCOG };
  //drawing the PriceDifCOG[] and ePriceDifCOG[] figures in the small windows.
  //if day=10, then PriceDifCOG[], ePriceDifCOG[]=11,12,...,2000.
}
window.PriceDifCOG = PriceDifCOG;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-April-01=============//完全自創新
//漲跌比率重心震盪指標(RiseFallRatioCOG, Rise/Fall Ratio Center of Gravity Oscillator),自創
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function RiseFallRatioCOG(K_close, day, esp) {  //完全自創新
  // Menu Name: RiseFallRatioCOG     //day=10, 20, ...,  esp=9, 10,...
  let sum_weighted_RiseFallRatio=0;  //分子=加權漲跌比率總和=sum of weighted rise/fall ratio=0
  let sum_weight=0;                  //分母=權重總和=sum of weights=0
  const RiseFallRatioCOG=[];   //重心震盪指標=分子/分母=Center of Gravity Oscillator, =11,12,...,2000
  const eRiseFallRatioCOG=[];  //自創,指數平滑移動平均=exponential moving average(EMA) of COG, =11,12,...,2000
  sum_weight=day*(day+1)/2;    //sum of weights=1+2+...+day=day*(day+1)/2
  let counter;
  for(let i=day+1; i<K_close.length; i++) {  //i=11 to 2000
    sum_weighted_RiseFallRatio=0;  //分子=加權漲跌比率總和=sum of weighted rise/fall ratio=0,歸零.
    counter=1;                //counter=1 to day,計數器=1, 2,...,day
    for(let j=i-day+1; j<=i; j++) {    //j=2 to 11
      sum_weighted_RiseFallRatio += ((K_close[j]-K_close[j-1])/K_close[j-1])*100*counter; //分子=加權漲跌比率總和
      counter=counter+1;  //counter=1, 2,...,day
    }
    RiseFallRatioCOG[i]=sum_weighted_RiseFallRatio/sum_weight; //RiseFallRatioCOG[]=11 to 2000,重心震盪指標=分子/分母
    if(i==day+1) {         //當i=11時，eRiseFallRatioCOG[11]=RiseFallRatioCOG[11]
      eRiseFallRatioCOG[i]=RiseFallRatioCOG[i]; }  //eRiseFallRatioCOG=exponential MA of RiseFallRatioCOG
    else {               //當i>11時
      eRiseFallRatioCOG[i]=(esp-1)/(esp+1)*eRiseFallRatioCOG[i-1]+2/(esp+1)*RiseFallRatioCOG[i];
    }
  } 
  return { RiseFallRatioCOG, eRiseFallRatioCOG };
  //drawing the RiseFallRatioCOG and eRiseFallRatioCOG figures in the small windows.
  //if day=10, then RiseFallRatioCOG[], eRiseFallRatioCOG[]=11,12,...,2000.
}
window.RiseFallRatioCOG = RiseFallRatioCOG;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-April-02=============
//力量平衡指標(BOP, Balance of Power)
//BOP=(C-O)/(H-L), 原作者method_1=SMA(BOP), 本人自創method_2=EMA(BOP)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)自創
function BalanceOfPower(K_open, K_high, K_low, K_close, day, esp) {
  // Menu Name: BalanceOfPower    //day=10, 20, ...,  esp=9, 10, ...
  let sum=0;  //sum of (C-O)/(H-L)
  //原作者method_1, Simple MA=SMA(BOP), sum=(C-O)/(H-L)
  for(let i=1; i<day; i++) {     //i=1 to day, day=10, 20, ...
    if(K_high[i]-K_low[i]!==0) {  //當H-L不等於0時，才計算BOP，避免除以0的錯誤 
      sum=sum+(K_close[i]-K_open[i])/(K_high[i]-K_low[i]); }
    else {  //當H-L等於0時，BOP定義為0，因為價格沒有波動
      sum=sum+0; 
    }
  }
  //first BOP_SMA[10]=sum/10
  const BOP_SMA=[];
  BOP_SMA[day]=sum/day;  //第1個BOP_SMA[10}=10日BOP的簡單移動平均
  for(let i=day+1; i<K_close.length; i++) {  //i=11 to 2000
    //先扣除10天前的BOP，再加上當天的BOP，得到新的sum，再除以10，得到新的BOP_SMA
    if(K_high[i-day]-K_low[i-day]!==0) {  //當10天前的H-L不等於0時，才扣除10天前的BOP，避免除以0的錯誤
      sum=sum-(K_close[i-day]-K_open[i-day])/(K_high[i-day]-K_low[i-day]); }
    else {  //當10天前的H-L等於0時，BOP定義為0，因為價格沒有波動，所以扣除0
      sum=sum-0;
    }
    //再加上當天的BOP，得到新的sum，再除以10，得到新的BOP_SMA
    if(K_high[i]-K_low[i]!==0) {  //當H-L不等於0時，才計算BOP，避免除以0的錯誤 
      sum=sum+(K_close[i]-K_open[i])/(K_high[i]-K_low[i])
    }
    else {  //當H-L等於0時，BOP定義為0，因為價格沒有波動
      sum=sum+0;
    }
    BOP_SMA[i]=sum/day;  //second BOP_SMA[11]]
  }
  //method_2, 指數平滑移動平均esp=9, sum=(C-O)/(H-L)
  let BOP=0;  //BOP=(C-O)/(H-L)
  const BOP_esp=[];  //BOP_esp=exponential moving average of BOP, =1,2,...,2000
  for(let i=1; i<K_close.length; i++) {  //i=1 to 2000
    if(K_high[i]-K_low[i]!==0) {          //當H-L不等於0時，才計算BOP，避免除以0的錯誤 
      BOP=(K_close[i]-K_open[i])/(K_high[i]-K_low[i]); }
    else {  //當H-L等於0時，BOP定義為0，因為價格沒有波動
      BOP=0;
    } 
    if(i==1) {  //當i=1時，BOP_esp[1]=BOP[1]
      BOP_esp[i]=BOP; } //BOP_esp=exponential MA of BOP
    else {  //當i>1時
      BOP_esp[i]=(esp-1)/(esp+1)*BOP_esp[i-1]+2/(esp+1)*BOP; 
    } 
  }
  return { BOP_SMA, BOP_esp };
  //drawing the BOP_SMA[] and BOP_esp[] figures in the small windows.
  //if day=10, then BOP_SMA[]=10,11,...,2000, 
  //BOP_esp[]=1,2,...,2000.
}
window.BalanceOfPower = BalanceOfPower;
//----------------------------------------------------------------------

//designed by Prof Wang, 2026-April-29========很複雜的程式，設計一天完成======
//HMA:Hull Moving Average 赫爾移動平均線
//Zero Lag Hull Moving Average, 接近零延遲的移動平均線
//零延遲赫爾移動平均線 (HMA) 是赫爾移動平均線 (HMA) 的增強版本
function ZeroLagHullMA(K_close, day1, day2, esp) {
  // Menu Name: ZeroLagHullMA      //day1=10,15, day2=10,15, esp=9,10,...
  //The parameter <day1> can be 10, 15, 20, 30,...
  //esp=9,指數平滑參數=exponential smoothing parameter(esp)
  //例如參數=10:half_day=10/2=5, day1=10, esp=9
  //day1需要為偶數,求餘數的指令= %
  const WMA1 = [];     //例如5天加權移動平均,天數=day1/2, WMA1(price, day1/2)
  const WMA2 = [];     //例如10天加權移動平均,天數=day1, WMA2(price, day1)
  const RawHMA = [];   //RawHMA=2*WMA1-WMA2
  const HMA = [];      //HMA=(WMA(RawHMA,m), m=sqrt(N)=sqrt(10)
  const eHMA = [];     //自創, eHMA今=eMA(HMA)=(n-1)/(n+1)*eHMA昨+2/(n+1)HMA今

  //day1需要為偶數,求餘數的指令= %
  if(day1 % 2 ===1) {  //確保day1為偶數,Ensure <day1> is an even number
    day1=day1+1;  }    // if day1=9, then day1=9+1
  let half_day1=day1/2; //WMA1加權移動平均天數, =10/2

  //1-----WMA1---計算WMA(price,N/2)=WMA(price,day1/2)=WMA(price,10/2)-----
  //計算Weighted WMA1(=1/(N/2)Sum(wi*Ci), for (N/2)_days)
  //每個WMA1權重為:1,2,3,4,5,...,(day1/2=half_day1)
  //例如day1=10,則WMA1[]=5,6,...,2000
  let sum_wgt1=0;              //加總WMA1的總權重,要放分母 //sum_wgt1=15
  for(let i=1; i<half_day1; i++) {   //i=1 to 5 (i=1 to day1/2)
    sum_wgt1=sum_wgt1+i;       //例如=1+2+3+4+5=15,加總WMA1的總權重,要放分母
  }
  let wgt_count;     //權重計數, 1,2,...,5 或 1,2,...,10     
  let sum_close;     //分子=5天加權收盤價加總
  for(let i=half_day1; i<=K_close.length; i++) {  //i=5 to 2000
    sum_close=0;
    wgt_count=1;     //權重計數
    for(let j=i-half_day1+1; j<i; j++) {  //j=1 to 5, j=2 to 6,...
      sum_close=sum_close+K_close[j]*wgt_count;   //權重係數=1,2,3,4,5
      wgt_count=wgt_count+1;
    }
    WMA1[i]=sum_close/sum_wgt1;   //第1筆WMA1[i]=WMA1[5], 5 to 2000
  }  // if day1=10 , WMA1[i]=5 to 2000

  //2-----WMA2---計算WMA(price,N)=WMA(price,day1)=WMA(price,10)-------
  //計算Weighted WMA2(=1/(n)Sum(wi*Ci), for n_days)
  //每個WMA2權重為:1,2,3,4,5,...,day1
  //例如day1=10,則WMA2[]=10,11,...,2000
  let sum_wgt2=0;         //加總WMA2的總權重,要放分母 //sum_wgt2=55
  for(let i=1; i<day1; i++) {   //i=1 to 10 (i=1 to day1)
    sum_wgt2=sum_wgt2+i;  //例如=1+2+...+10=55,加總WMA2的總權重,要放分母
  }  
  for(let i=day1; i<=K_close.length; i++) {  //i=10 to 2000
    sum_close=0;    //分子=10天加權收盤價加總
    wgt_count=1;    //權重計數
    for(let j=i-day1+1; j<=i; j++) {  //j=1 to 10, j=2 to 11,...
      sum_close=sum_close+K_close[j]*wgt_count;   //權重係數=1,2,3,4,5,...,10
      wgt_count=wgt_count+1;
    }
    WMA2[i]=sum_close/sum_wgt2;   //第1筆WMA2[i]=WMA2[10], 10 to 2000
  }  // if day1=10 , WMA2[i]=10 to 2000

  //3-----計算 RawHMA2-------------------------------------------
  //計算RawHMA, day1=10, RawHMA=10 to 2000
  for(let i=day1; i<=K_close.length; i++) {  //i=10 to 2000
    RawHMA[i]=2*WMA1[i]-WMA2[i];             //RawHMA[]=10 to 2000
  }  // if day1=10 , RawHMA[i]=10 to 2000

  //4-----計算  HMA, eHMA----------------------------------------
  //HMA的移動平均天數m=sqrt(day1),無條件進位=Math.ceil(數字),開根號=Math.sqrt(數字)
  //m=HMA的移動平均天數,例如:m=4
  let m1=Math.ceil(Math.sqrt(day1)); //開根號後再無條件進位,m1=HMA的移動平均天數=4
  let sum_wgt3=0;           //加總RawHMA的總權重,要放分母  //sum_wgt3=10
  for(let i=1; i<m1; i++) { //i=1 to 4 (i=1 to m1)
    sum_wgt3=sum_wgt3+i;      //例如=1+2+3+4=10,加總RawHMA的總權重,要放分母
  }
  // what kind of type is sum_temp ??? 
  let sum_temp = 0;    //暫時加總用
  wgt_count=1;     //權重計數, 1,2,...,5 或 1,2,...,10 或 1,2,...m1=4
  for(let i=day1+m1-1; i<=K_close.length; i++) {  //i=(10+4-1)=13,14,...,2000
    sum_temp=0;
    wgt_count=1;   //原設計count=1;
    for(let j=i-m1+1; j<=i; j++) { //j=10 to 13  (j=i-m1+1 to i)=(j=13-4+1 to 13)=(j=10 to 13)
      sum_temp=sum_temp+RawHMA[j]*wgt_count;  //權重分別=1,2,3,4
      wgt_count=wgt_count+1;                  //原設計count=count+1;
    }
    HMA[i]=sum_temp/sum_wgt3;   //第1個HMA(13)=day1+m1-1
    if(i===(day1+m1-1)) {     //初值=第1個eHMA(13)
      eHMA[i]=HMA[i]; }
    else {                  //第2筆之後, =14,15,...,2000
      eHMA[i]=(esp-1)/(esp+1)*eHMA[i-1]+2/(esp+1)*HMA[i]; //自創
    }
  }  // if day1=10 , HMA[i]=13 to 2000
  let first_HMA_is=day1+m1-1;     //第1個HMA[]是13， =10+4-1=13
  //---上述計算的是完整的：HMA=HullMA，RawHMA1=2WMA(HMA,N/2)-WMA(HMA,N)，N=day1=10
  //---HMA=WMA(RawHMA1, sqrt(N))，sqrt(N)=sqrt(day1)=sqrt(10)=4   --------------

  //---再對HMA做加權移動平均，RawHMA2=2WMA(HMA,n/2)-WMA(HMA,n)，n=day2=5 or =10
  //---ZeroLagHMA=WMA(RawHMA2, sqrt(n))，sqrt(n)=sqrt(day2)=sqrt(10)=4   -------
  //if day1=10 then HMA[]=13 to 2000, RawHMA[]=10 to 2000
  //----------------------------------------------------------------------------
  //compute ZeroLagHMA(Zero Lag Hull Moving Average)
  const WMA_HMA1 = [];   //例如5天加權移動平均,天數=day2/2, WMA_HMA1(HMA, day2/2)
  const WMA_HMA2 = [];   //例如10天加權移動平均,天數=day2, WMA_HMA2(HMA, day2)
  const RawHMA2 = [];    //RawHMA2=2*WMA_HMA1-WMA_HMA2
  const ZeroLagHMA = []; //ZeroLagHMA=(WMA(RawHMA2,m), m=sqrt(n)=sqrt(10)

  //day2需要為偶數,求餘數的指令= %
  if(day2 % 2 ===1) {  //確保day2為偶數,Ensure <day2> is an even number
    day2=day2+1;  }    // if day2=9, then day2=9+1
  let half_day2=day2/2;     //WMA1加權移動平均天數, =10/2

  //1-------WMA_HMA1---計算WMA(HMA,n/2)=WMA(HMA,day2/2)=WMA(HMA,10/2)=WMA(HMA,5)---
  //計算Weighted WMA_HMA1(=1/(n/2)Sum(wi*Ci), for (n/2)_days)
  //每個WMA1權重為:1,2,3,4,5,...,(day2/2=half_day2)
  //例如day2=10,WMA_HMA1[]=,...,2000
  sum_wgt1=0;              //加總WMA1的總權重,要放分母  //sum_wgt1=15
  for(let i=1; i<half_day2; i++) {   //i=1 to 5 (i=1 to day2/2)
    sum_wgt1=sum_wgt1+i;   //例如=1+2+3+4+5=15,加總WMA1的總權重,要放分母
  }
  // m=Math.ceil(Math.sqrt(day2)); //開根號後再無條件進位,m=HMA的移動平均天數=4
  wgt_count=0;     //權重計數, 1,2,...,5 或 1,2,...,10     
  sum_close=0;     //分子=5天加權收盤價加總
  //let first_HMA_is=day1+m1-1;    //第1個HMA[]是13， =10+4-1=13, if day1=10
  for(let i=first_HMA_is+half_day2-1; i<=K_close.length; i++) { //i=17 to 2000,13+5-1=17
    sum_close=0;
    wgt_count=1;  //權重計數
    for(let j=i-half_day2+1; j<=i; j++) {     //j=13 to 17, j=14 to 18,...
      sum_close=sum_close+HMA[j]*wgt_count;   //權重係數=1,2,3,4,5
      wgt_count=wgt_count+1;
    }
    WMA_HMA1[i]=sum_close/sum_wgt1;   //WMA_HMA1[i]=WMA_HMA1(17), =17 to 2000
  } // if day2=10 , WMA_HMA1[i]=17 to 2000

  //2-------WMA_HMA2---計算WMA(HMA,n)=WMA(HMA,day2)=WMA(HMA,10)--------------------
  //計算Weighted WMA_HMA2(=1/(n)Sum(wi*Ci), for n_days)
  //每個WMA_HMA2權重為:1,2,3,4,5,...,day2
  //例如day2=10,則WMA_HMA2[]=,,...,2000
  sum_wgt2=0;         //加總WMA_HMA2的總權重,要放分母  //sum_wgt2=55
  for(let i=1; i<day2; i++) {  //i=1 to 10 (i=1 to day2)
    sum_wgt2=sum_wgt2+i;        //例如=1+2+...+10=55,加總WMA2的總權重,要放分母
  }  
  for(let i=first_HMA_is+day2-1; i<=K_close.length; i++) {  //i=22 to 2000, (13+10-1=22)
    sum_close=0;    //分子=10天加權收盤價加總
    wgt_count=1;    //權重計數
    for(let j=i-day2+1; j<=i; j++) {        //j=13 to 22, j=14 to 23,...
      sum_close=sum_close+HMA[j]*wgt_count; //權重係數=1,2,3,4,5,...,10
      wgt_count=wgt_count+1;
    }
    WMA_HMA2[i]=sum_close/sum_wgt2;   //第1筆WMA_HMA2[i]=WMA_HMA2[22], =22 to 2000
  }  // if day2=10 , WMA_HMA2[i]=22 to 2000

  //3-----計算 RawHMA2---if day1=10 and day2=10, then RawHMA2=22 to 2000-----------
  // first_HMA_is+day2-1 = 13+10-1=22
  for(let i=first_HMA_is+day2-1; i<=K_close.length; i++) {  //i=22 to 2000
    RawHMA2[i]=2*WMA_HMA1[i]-WMA_HMA2[i];             //RawHMA2[]=22 to 2000
  } // if day2=10 , RawHMA2[i]=22 to 2000

  //4-----計算 ZeroLagHMA----------------------------------------
  //HMA的移動平均天數m2=sqrt(day2),無條件進位=Math.ceil(數字),開根號=Math.sqrt(數字)
  //m2=HMA的移動平均天數,例如:m2=4
  let m2=Math.ceil(Math.sqrt(day2)); //開根號後再無條件進位,m2=HMA的移動平均天數=4
  sum_wgt3=0;                //加總RawHMA2的總權重,要放分母  //sum_wgt3=10
  for(let i=1; i<m2; i++) { //i=1 to 4 (i=1 to m2)
    sum_wgt3=sum_wgt3+i;      //例如=1+2+3+4=10,加總RawHMA的總權重,要放分母
  }
  // let sum_temp;    //暫時加總用
  wgt_count=1;     //權重計數, 1,2,...,5 或 1,2,...,10 或 1,2,...m=4
  // let first_HMA_is=day1+m1-1;     //第1個HMA[]是13， =10+4-1=13
  let day_temp=first_HMA_is+day2+m2-2;  //=(day1+m1-1)+(day2+m2-2)=day1+day2+m1+m2-3=25
  for(let i=day_temp; i<=K_close.length; i++) {  //i=(13+10+4-2)=25 to 2000
    sum_temp=0;
    wgt_count=1;   //權重計數
    for(let j=i-m2+1; j<=i; j++) { //j=22 to 25  (j=i-m2+1 to i)=(j=25-4+1 to 25)=(j=22 to 25)
      sum_temp=sum_temp+RawHMA2[j]*wgt_count;  //權重分別=1,2,3,4
      wgt_count=wgt_count+1;                   //權重計數;
    }
    ZeroLagHMA[i]=sum_temp/sum_wgt3;   //第1個 ZeroLagHMA[25]=[first_HMA_is+day2+m2-2]
  }  // if day1=10 and day2=10, then m1=4=m2, ZeroLagHMA[]=25 to 2000
  return { K_close, HMA, eHMA, ZeroLagHMA};
  //drawing the STK_close[], HMA[], eHMA[], ZeroLagHMA[] figures in the small windows.
  //Normally drawing the STK_close[], HMA[], eHMA[], ZeroLagHMA[] figures in the K-Line area.
  //eg:day=10, half_day=5, m=4, esp=9
  //STK_close[]=1,2,...2000 
  //HMA[], eHMA[]= 13 to 2000, ZeroLagHMA[]=25 to 2000
}
window.ZeroLagHullMA = ZeroLagHullMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-April-30==========================
// Stochastic Momentum Index (SMI隨機動量指標) <No.118>
// Midpoint=(Hn-Ln)/2, n日內最高與最低價。 Dif=C-Midpoint, Range=(Hn-Ln)/2, 
// double EMA, deDif=EMA(EMA(Dif,r),s), deRange=EMA(EMA(Range,r),s)
// SMI=(deDif/deRange)*100%, Single Line=EMA(SMI,n)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)自創
function StochasticSMI(K_high, K_low, K_close, day, rr, ss, esp) {
  // Menu Name: StochasticSMI    //Key Parameters:
  // day=13: The period used to find the highest/lowest price.
  // rr=25: The first EMA smoothing period.
  // ss=2: The second EMA smoothing period.
  // esp=9: The EMA period of the signal line.
  let Midpoint;     //Midpoint=(Hn-Ln)/2
  const Dif=[];     //Dif=C-Midpoint
  const Range=[];   //Range=(Hn-Ln)/2, half of the price range.
  let max_High, min_Low;
  //calculate the midpoint of the price range over the chosen period (day). =Midpoint
  //Calculate the difference between the price and the midpoint. =Dif[]
  //Calculate half of the price range. =Range[]
  for(let i=day; i<K_high.length; i++) { //i=9 to 2000
    max_High=K_high[i-day+1];   //令第1筆為最大
    min_Low=K_low[i-day+1];     //令第1筆為最小
    for(let j=i-day+1; j<=i; j++) {  //j=1 to 9, j=2 to 10, ...
      if(K_high[j]>max_High) {  //找最大
        max_High=K_high[j];  }
      if(K_high[j]<min_Low) {   //找最小
        min_Low=K_low[j];  }
    }
    Midpoint=(max_High+min_Low)/2;
    Dif[i]=K_close[i]-Midpoint;     //i=9 to 2000
    Range[i]=(max_High-min_Low)/2;  //i=9 to 2000.有除以2,所以計算SMI時只要乘以100%,不是200%.
  }
  //if day=9 then Dif[], Range[]=9 to 2000.
  //Double exponential smoothing of Dif and Range (usually using EMA)
  //---第1次做EMA, eDif[],eRange[]=9 to 2000---exponential smoothing---
  // rr=25, ss=2
  const eDif=[];      //第1次做EMA, eDif=EMA(Dif,rr),     =9 to 2000
  const eRange=[];    //第1次做EMA, eRange=EMA(Range,rr), =9 to 2000
  eDif[day]=Dif[day];       //第1次第1個EMA初值, =9 to 2000
  eRange[day]=Range[day];   //第1次第1個EMA初值, =9 to 2000
  for(let i=day+1; i<K_high.length; i++) {     //i=9+1 to 2000
    eDif[i]=(rr-1)/(rr+1)*eDif[i-1]+2/(rr+1)*Dif[i];
    eRange[i]=(rr-1)/(rr+1)*eRange[i-1]+2/(rr+1)*Range[i];
  }
  //---第2次做EMA, deDif[],deRange[]=9 to 2000---double exponential smoothing---
  // Final SMI calculation, SMI=deDif/deRange*100%, 與deDif[],deRange[]一起計算
  // ss=2
  const deDif=[];    //第2次做EMA, deDif=EMA(eDif,ss),     =9 to 2000
  const deRange=[];  //第2次做EMA, deRange=EMA(eRange,ss), =9 to 2000
  const SMI=[];      //Stochastic Momentum Index(SMI隨機動量指標), =9 to 2000
  deDif[day]=eDif[day];                  //第2次第1個EMA初值, =9 to 2000
  deRange[day]=eRange[day];              //第2次第1個EMA初值, =9 to 2000
  SMI[day]=deDif[day]/deRange[day]*100;  //第1個EMA初值, =9 to 2000
  for(let i=day+1; i<K_high.length; i++) {     //i=9+1 to 2000
    deDif[i]=(ss-1)/(ss+1)*deDif[i-1]+2/(ss+1)*eDif[i];
    deRange[i]=(ss-1)/(ss+1)*deRange[i-1]+2/(ss+1)*eRange[i];
    SMI[i]=deDif[i]/deRange[i]*100;
  }
  //---實際上,第1次與第2次做EMA,可以合併在同一個Loop裡---但為避免混淆,所以分開2個Loop.
  // Signal Line=EMA(SMI,esp)
  const SignalLine=[];           //Signal Line=EMA(SMI,esp)
  SignalLine[day]=SMI[day];      //第1個EMA初值, =9 to 2000
  for(let i=day+1; i<K_high.length; i++) {     //i=9+1 to 2000  
    SignalLine[i]=(esp-1)/(esp+1)*SignalLine[i-1]+2/(esp+1)*SMI[i];
  }
  return { SMI, SignalLine };
  //drawing the SMI[] and SignalLine[] figures in the small windows.
  //if day=9, then SMI[], SignalLine[]=9,10,...,2000, 
  //如果繪圖deDif[], deRange[] 會如何?
}
window.StochasticSMI = StochasticSMI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-02======================
// Pretty Good Oscillator (PGO)良好震盪指標	<No.116>
// calculate: simpleMA, Average True Range(ATR)
// TR=max[(H-L), abs(H-昨C), abs(L-昨C)]. ATR=sum(TR of n_day)/n
// PGO=(Close-simpleMA)/ATR
//指數平滑移動平均的參數:exponential smoothing parameter(esp),自創新
function PGO(K_high, K_low, K_close, ma_day, n_period, esp) {
  // Menu Name: PGO  //ma_day=5, 10, 14..., n_period=14..., esp=9
  // calculate simpleMA, from (ma_day=14) to 2000
  const simpleMA=[];
  let sum=0;
  for(let i=1; i<ma_day; i++) {  //i=1 to 5, or //i=1 to 14
    sum=sum+K_close[i];
  }
  simpleMA[ma_day]=sum/ma_day;  //first =5, 10, 14
  for(let i=ma_day+1; i<K_close.length; i++) {  //i=5+1 to 2000
    sum=sum-K_close[i-ma_day+1]+K_close[i];      //減舊加新
    simpleMA[i]=sum/ma_day;     //second =5+1, 10+1, 14+1
  }
  // calculate Average True Range(ATR) and TR, from (n_period+1=14+1) to 2000
  // calculate PGO=(Close-simpleMA)/ATR
  const TR=[], ATR=[];
  const PGO=[], ePGO=[];  //ePGO[]=自創新
  sum=0;
  for(let i=2; i<n_period+1; i++) {  //i=2 to 14+1
    TR[i]=Math.max((K_high[i]-K_low[i]),Math.abs(K_high[i]-K_close[i-1]),Math.abs(K_low[i]-K_close[i-1]));
    sum=sum+TR[i];    //sum from i=2 to 14+1
  }
  let tp=n_period+1;      //tp=14+1
  ATR[tp]=sum/n_period;   //first ATR[14+1]
  PGO[tp]=(K_close[tp]-simpleMA[tp])/ATR[tp];   //first PGO[14+1]
  ePGO[tp]=PGO[tp];       //first ePGO[14+1]=自創新
  //Calculate the rest of TR[], ATR[], PGO[]. from 14+2 to 2000
  for(let i=n_period+2; i<K_close.length; i++) {  //i=14+2 to 2000
    TR[i]=Math.max((K_high[i]-K_low[i]),Math.abs(K_high[i]-K_close[i-1]),Math.abs(K_low[i]-K_close[i-1]));
    //first smoothing method: ATR=((n-1)/n)*ATR昨+(1/n)*TR今
    ATR[i]=((n_period-1)/n_period)*ATR[i-1] + (1/n_period)*TR[i];    //second=14+2
    //second smoothing method: ATR=((n-1)/(n+1))*ATR昨+(2/(n+1))*TR今
    //ATR[i]=((n_period-1)/(n_period+1))*ATR[i-1] + (2/(n_period+1))*TR[i];  //second=14+2
    // ======= FAMI 2026-05-02=====================
    // adding new PGO formula, PGO=(Close-simpleMA)/ATR because there is no division by zero problem, because ATR is not zero.
    // if its deleted the data will be null, and the chart will not be drawn.
    PGO[i] = ATR[i] === 0 ? null : (K_close[i] - simpleMA[i]) / ATR[i];
  // =======================================
    ePGO[i]=(esp-1)/(esp+1)*ePGO[i-1] + 2/(esp+1)*PGO[i];  //自創新
  }
  return { PGO, ePGO };
  //drawing the PGO[] and ePGO[] figures in the small windows.
  //if ma_day=10, then simpleMA[]= 10 to 2000.
  //TR[]= 2 to 2000.
  //if n_period=14, then ATR[]= 14+1 to 2000.
  //if n_period=14, then PGO[], ePGO[]= 14+1 to 2000.
}
window.PGO = PGO;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-02======================
// Kairi Relative Index，Kairi相對指數(KRI) <No.113>
// calculate: simpleMA,  // KairiRI=[(Close-simpleMA)/simpleMA]*100
//指數平滑移動平均的參數:exponential smoothing parameter(esp),自創新
function KairiRI(K_close, ma_day, esp) {
  // Menu Name: KairiRI_KRI  //ma_day=5, 10,..., esp=9
  // calculate simpleMA, from (ma_day) to 2000
  const simpleMA=[];
  let sum=0;
  for(let i=1; i<ma_day; i++) {  //i=1 to 5, or //i=1 to 10
    sum=sum+K_close[i];
  }

  simpleMA[ma_day]=sum/ma_day;  //first =5, 10
  for(let i=ma_day+1; i<K_close.length; i++) {  //i=5+1 to 2000
    sum=sum-K_close[i-ma_day+1]+K_close[i];      //減舊加新
    simpleMA[i]=sum/ma_day;     //second =5+1, 10+1, 14+1
  }
  // calculate KRI=[(Close-simpleMA)/simpleMA]*100
  const KRI=[]
  const eKRI=[];  //eKRI[]=自創新, =5 to 2000.
  for(let i=ma_day; i<K_close.length; i++) {  //i=5 to 2000

    // ======================= made by FAMI, 2026-05-02 =======================
    //  changing [ma_day] into [i] because it [ma_day] will cause the KRI[] to be only one value, and the chart will not be drawn.
    // old // KRI[ma_day]=(K_close[ma_day]-simpleMA[ma_day])/simpleMA[ma_day]*100;
    KRI[i]=(K_close[i]-simpleMA[i])/simpleMA[i]*100;  //new
    if(i===ma_day) {
      eKRI[i]=KRI[i]; }   //自創新, first eKRI[]
    else {
      eKRI[i]=(esp-1)/(esp+1)*eKRI[i-1] + 2/(esp+1)*KRI[i];  //自創新
    }
  }
  return { KRI, eKRI };
  //drawing the KRI[] and eKRI[] figures in the small windows.
  //if ma_day=10, then simpleMA[], KRI[], eKRI[]= 10 to 2000.
}
window.KairiRI = KairiRI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-05======================
// Gaussian Filter <No.112>  // Calculate the price of Gaussian filtering
// calculate: GaussianMA=sum(w*p)/sum(w)
//指數平滑移動平均的參數:exponential smoothing parameter(esp),自創新
function Gaussian(K_close, day, sigma, esp) {
  // Menu Name: Gaussian Filter  //day=5, 10,..., esp=9, sigma=2~5.
  const GaussianMA=[]
  const eGaussianMA=[];   //自創新
  let sum_wgt=0;        //=w1+w2+...+wn,權重加總,放分母Normalization Factor
  let sum_wgt_price=0;  //=sum(wgt*price), 加總,放分子
  let weight=0;         //weight=exp(-x^2/(2*sigma^2))
  // Calculate Gaussian weights
  for(let i=1; i<day; i++) {  //i=1 to 5, or //i=1 to 10
    weight=Math.exp(-(i-1)*(i-1)/(2*sigma*sigma));
    sum_wgt=sum_wgt + weight;
    sum_wgt_price=sum_wgt_price + weight*K_close[i];
  }
  GaussianMA[day]=sum_wgt_price/sum_wgt;   //first GaussianMA[]=5  to 2000
  eGaussianMA[day]=GaussianMA[day];        //自創新, eGaussianMA[]=5 to 2000
  // Calculate the price of Gaussian filtering, from (day) to 2000
  let count=1;
  for(let i=day+1; i<K_close.length; i++) {  //i=5+1 to 2000
    sum_wgt_price=0;
    count=1;
    for(let j=i-day+1; j<=i; j++) {  //j=2 to 6
      weight=Math.exp(-(count-1)*(count-1)/(2*sigma*sigma));
      sum_wgt_price=sum_wgt_price + weight*K_close[j];
      count=count+1;
    }
    GaussianMA[i]=sum_wgt_price/sum_wgt;   //second GaussianMA[]=6  to 2000
    eGaussianMA[i]=(esp-1)/(esp+1)*eGaussianMA[i-1]+2/(esp+1)*GaussianMA[i]; //自創新
  }
  return { K_close, GaussianMA, eGaussianMA };
  //drawing the K_close[], GaussianMA[] and eGaussianMA[] figures in the small windows.
  //Normally drawing these two indicators in the K_Line area.
  //if ma_day=10, then GaussianMA[], eGaussianMA[]= 10 to 2000.
}
window.Gaussian = Gaussian;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-05======================
// David Varadi Oscillator(DVO)  <No.110>  //
// Ratio=C/((H+L)/2), Smooth Ratio=SMA(Ratio,n), Rr=Ratio/(Smooth Ratio)
// L=ln(Rr), DVO=PercentileRank(L,m)*100.
function DVO(K_high, K_low, K_close, smooth_day, m) {
  // Menu Name: DVO    //smooth_day=5, 10,..., m=50, 100, 200, 250
  // m is parameter for the data rangking ( user can chose data range ? ) 
  const DVO=[];        //DVO=PercentileRank(L,m)*100.
  const Ratio=[];      //Ratio=C/((H+L)/2)
  // Calculate Ratio[], =1 TO 2000
  for(let i=1; i<K_close.length; i++) {
    Ratio[i]=K_close[i]/((K_high[i]+K_low[i])/2);  //Ratio=C/((H+L)/2)
  }  // Ratio[]=1 to 2000
  // Smooth Ratio=SMA(RAtio,n)   //Rr=Ratio/(Smooth Ratio)
  // Transform to Log Space. To normalize the data and ensure symmetry, 
  // the natural logarithm of the ratio is taken.
  const smooth_Ratio=[];  // =smooth_day to 2000 =5 to 2000
  const Rr=[];            // =smooth_day to 2000 =5 to 2000
  const LL=[];            // L=ln(Rr).   // = 5 to 2000
  let sum=0;
  for(let i=1; i<smooth_day; i++) {  //i=1 to 5
    sum=sum+Ratio[i];
  }
  smooth_Ratio[smooth_day]=sum/smooth_day;  //first =[5]
  Rr[smooth_day]=Ratio[smooth_day]/smooth_Ratio[smooth_day];  //first =[5] 
  //在 JavaScript 裡，自然對數（ln）是用內建的 Math.log() 函式來計算的
  LL[smooth_day]=Math.log(Rr[smooth_day]);            //first =[5]
  for(let i=smooth_day+1; i<K_close.length; i++ ) {  // 6 to 2000
    sum = sum-Ratio[i- smooth_day+1]+Ratio[i];  //減舊加新
    smooth_Ratio[i] = sum/smooth_day;  //second =[6] to 2000
    Rr[i] = Ratio[i]/smooth_Ratio[i];  //second =[6] to 2000
    LL[i] = Math.log(Rr[i]);           //second =[6] to 2000
  }  //smooth_Ratio[], Rr[], LL[]= 5 to 2000
  // Calculate DVO=PercentileRank(L,m)*100.
  // The final DVO value is the percentile rank of the current value 
  // of L relative to its values over a lookback period (usually m = 252 days 
  // for a yearly lookback, or shorter for more active trading).
  const PercentileRank=[];
  let count;
  for(let i=(smooth_day+m-1); i<K_close.length; i++) {  //i=5+100-1 to 2000.
    //第104(5+100-1)個陣列元素,往前看100筆資料內,有幾個比它小的,即從第5個比較到第103個。
    //例如有60個比它小,則Percentile Rank=(60/100)*100=60.
    count=0;
    for(let j=(i-m+1); j<=(i-1); j++) {  //j=5 to 103
      if(LL[i]>LL[j]) {
        count = count + 1; }
    }
    PercentileRank[i] = count/m*100;  // smooth_day+m-1=104 to 2000
  }
  return { PercentileRank };
  //drawing the PercentileRank[] figure in the small windows.
  //if smooth_day=5, m=100, then PercentileRank[]= 5+100-1 to 2000.
}
window.DVO = DVO;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-08======================
// Vortex Indicator(渦流指標)	(No.107)
// VM+: Positive Vortex Movement. =abs(Ht-Lt-1)
// VM-: Negative Vortex Movement. =abs(Lt-Ht-1)
// VI+=sum(VM+)/sum(TR)   // VI-=sum(VM-)/sum(TR)
function Vortex(K_high, K_low, K_close, day) {
  // Menu Name: Vortex    //day=10, 14,...
  const pVM=[]; //Positive Vortex Movement=VM+
  const nVM=[]; //Negative Vortex Movement=VM-
  const TR=[];  //TR=真實波幅(True Range)
  let temp1, temp2, temp3;
  //Calculate VM+, VM-, TR
  for(let i=2; i<K_close.length; i++) {    //i=2 to 2000
    pVM[i]=Math.abs(K_high[i]-K_low[i-1]);  //今高-昨低, =2 to 2000
    nVM[i]=Math.abs(K_low[i]-K_high[i-1]);  //今低-昨高, =2 to 2000
    temp1 = K_high[i] - K_low[i];
    temp2 = Math.abs(K_high[i] - K_close[i-1]);
    temp3 = Math.abs(K_low[i] - K_close[i-1]);
    TR[i] = Math.max(temp1, temp2, temp3);  // 2 to 2000
  }  
  //Calculate first values, =2 to 11(2+10-1=2+day-1)
  const pVI=[]
  const nVI=[];
  // ========made by FAMI, 2026-05-08======================
  // let sum_pVM, sum_nVM, sum_TR;   //加總用 old 
  let sum_pVM = 0, sum_nVM = 0, sum_TR = 0;  // new
  for(let i=2; i<day+1; i++) {   // i=2 to 11
    sum_pVM=sum_pVM+pVM[i];
    sum_nVM=sum_nVM+nVM[i];
    sum_TR=sum_TR+TR[i];
  }
  pVI[day+1]=sum_pVM/sum_TR;  //first pVI[11]
  nVI[day+1]=sum_nVM/sum_TR;  //first nVI[11]
  //Calculate the rest values, =12 to 2000
  for(let i=day+2; i<K_close.length; i++) {  // i=12 to 2000
    //先減舊,再加新
    sum_pVM=sum_pVM-pVM[i-day]+pVM[i];
    sum_nVM=sum_nVM-nVM[i-day]+nVM[i];
    sum_TR=sum_TR-TR[i-day]+TR[i];
    pVI[i]=sum_pVM/sum_TR;  //second pVI[12]
    nVI[i]=sum_nVM/sum_TR;  //second nVI[12]
  }
  return { pVI, nVI };
  //drawing the pVI[], nVI[] figures in the small windows.
  //if day=10, then pVI[], nVI[]= 11 to 2000.
}
window.Vortex = Vortex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-09======================
// Traders Dynamic Index(TDI,交易者動態指標)  <No.106>
// Calculate 13-day RSI, Price Line(綠線)=PL=EMA(RSI,2)
// Signal Line(紅線)=SL=EMA(PL,7), 
// 較長週期平滑=Market Base Line(黃線)=MBL=SMA(RSI,34)=>中線Mid
// Volatility Bands(藍色波動帶),將 Bollinger Bands 套在 RSI 上
// 中線=Mid=SMA(RSI,34), 標準差=Sigma=StaDev(RSI,34)
// 上軌=Upper=Mid+1.6185*Sigma, 下軌=Mid-1.6185*Sigma
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function TDI(K_close, RSI_day) {
  //Menu Name= TDI     //RSI_day=5,10,15,...
  // First calculate RSI
  const RSI=[];
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<K_close.length; i++) {
    dif[i]=K_close[i]-K_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
  }
  //==========以上程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  // if RSI_day=10 then RSI[]=11,12,...,2000.
  //對RSI做短期平滑, Price Line(綠線)=PL=EMA(RSI,2)
  const PriceLine=[];  //Price Line(綠線)=PL=EMA(RSI,2)
  PriceLine[RSI_day+1]=RSI[RSI_day+1]; //first=[11], set the same values
  let esp=3;
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    PriceLine[i]=(esp-1)/(esp+1)*PriceLine[i-1]+2/(esp+1)*RSI[i]; //second=[12]
  }
  //Calculate Signal Line(紅線), Signal Line(紅線)=SL=EMA(PriceLine,7)
  const SignalLine=[];  //Signal Line(紅線)=SL=EMA(PriceLine,7)
  SignalLine[RSI_day+1]=PriceLine[RSI_day+1]; //first=[11], set the same values
  esp=7;
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    SignalLine[i]=(esp-1)/(esp+1)*SignalLine[i-1]+2/(esp+1)*PriceLine[i]; //second=[12]
  } 
  // 較長週期平滑=Market Base Line(黃線)=MBL=SMA(RSI,34) 
  // if RSI_day=10 then RSI[]=11,12,...,2000.
  let N20=20;    //Market Base Line(黃線)=MBL=SMA(RSI,34), 此處取=20
  // 20 number or 20 data ?? 
  let sum=0;
  const MBL=[]; //Market Base Line(黃線)=MBL=SMA(RSI,34)=>中線Mid=SMA(RSI,34)
  const Mu=[];  //Population Mean母體平均數, =30 to 2000
  for(let i=RSI_day+1; i<RSI_day+N20; i++) { //i=11 to 30
    sum=sum+RSI[i];  //累加, from 11 to 30
  }
  MBL[RSI_day+N20]=sum/N20;   //first MBL=[30], 30 to 2000, MBL[]=Mid[]
  Mu[RSI_day+N20]=sum/N20;    //first Population Mean母體平均數, =30 to 2000
  //Calculate the rest MBL[]=31 to 2000
  for(i=RSI_day+N20+1; i<K_close.length; i++) {  // i=31 to 2000
    //先減舊的,再加新的
    sum=sum-RSI[i-N20]+RSI[i];  //舊的=RSI[11],新的=RSI[31]
    MBL[i]=sum/N20;             //second MBL=[31], 31 to 2000, MBL[]=Mid[]
    Mu[i]=sum/N20;              //second Mu=[31], 31 to 2000
  }
  //Calculate Sigma=StdDev, 母體標準差(Population Standard Deviation)
  //不能用此思考設計程式-----------------先減舊的,再加新的
  const Sigma=[];  //母體標準差(Population Standard Deviation), =30 to 2000
  const Upper=[], Lower=[]; //上軌=Upper=Mid+1.6185*Sigma,下軌=Mid-1.6185*Sigma
  for(let i=RSI_day+N20; i<K_close.length; i++) { //i=10+20 to 2000
    sum=0;
    for(let j=i-N20+1; j<=i; j++) {  // j=(30-20+1)=11 to 30
      sum=sum+(RSI[j]-Mui[i])**2;    //累加, from 11 to 30
    }
    Sigma[i]=Math.sqrt(sum/N20);      //first Sigma=[30], 30 to 2000
    Upper[i]= MBL[i]+1.6185*Sigma[i]; //上軌
    Lower[i]= MBL[i]-1.6185*Sigma[i]; //下軌
  }
  return { RSI, MBL, Upper, Lower }; // for small windows, only return RSI, MBL, Upper, Lower
  // return { RSI, PriceLine, SignalLine, MBL, Upper, Lower }; // for K_Line area, return all indicators
  //if RSI_day=10 then RSI[], PriceLine[], SignalLine[]=11,12,...,2000.
  //if RSI_day=10, N20=20 then MBL[], Mu[], Upper[], Lower[]=30,...,2000.
  //Normally drawing these figures in the K_Line area.
  //drawing these figures in the small windows.
  // 
}
window.TDI = TDI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-14================================
// Klinger Oscillator <No.103>
function KlingerOsc(K_high, K_low, K_close, K_vol, day1, day2, day3) {
  //Menu Name= KlingerOsc     //day1=10, day2=20, day3=13
  //1.Typical Prices, 2.Trend Direction, 3.Daily Measurement(DM) 4.Volume Force(VF) 
  const TP=[];     //Typical Price=TP=(High+Low+Close)/3
  const Trend=[];  //Trend Direction=Trend=TP[i]-TP[i-1]
  const DM=[];     //Daily Measurement(DM), DM=High[i]-Low[i]
  const VF=[];     //Volume Force(VF), VF=DVolume*Trend*abs(2(DM/sum_DM-1)*100
  let sum_DM=0;    //DM_sum
  for(let i=1; i<K_close.length; i++) {
    TP[i]=(K_high[i]+K_low[i]+K_close[i])/3;  // TP[]=1,2,...,2000
    DM[i]=K_high[i]-K_low[i];                 // DM[]=1,2,...,2000
    if(i>1) {    //i>=2, then can compute Trend[] and VF[]
      if(TP[i] > TP[i-1]) {  //Trend[]=2,3,...,2000
        Trend[i]=1; } 
      else {
        Trend[i]=-1; }
      //if DM>DM_prev,then update DM_sum
      if(DM[i] > DM[i-1]) {
        sum_DM = sum_DM + DM[i]; }  //要用此式嗎？--> DM[i]-DM[i-1];
      if(sum_DM > 0) {
        VF[i]=K_vol[i]*Trend[i]*Math.abs(2*(DM[i]/sum_DM-1))*100; }//VF[]=2,3,...,2000
      else { VF[i]=0;  //當sum_DM=0時，VF[i]設為0，避免除以零的錯誤  
      }
    }
  }
  //5.Calculate Klinger Oscillator (KO), KO=EMA(VF,day1)-EMA(VF,day2)
  const EMA_day1=[];   //EMA(VF,day1), day1=10, EMA_day1[]=2,...,2000
  const EMA_day2=[];   //EMA(VF,day2), day2=20, EMA_day2[]=2,...,2000
  const KO=[];         //Klinger Oscillator (KO), KO=EMA(VF,day1)-EMA(VF,day2)
  const SignalLine=[]; //6. Signal Line,Signal Line=EMA(KO,day3), day3=13
  //Ensure day1 < day2
  let temp;
  if(day1 > day2) {
    temp=day1; day1=day2; day2=temp;
  }
  EMA_day1[2]=VF[2];  //first=[2], set the same values
  EMA_day2[2]=VF[2];  //first=[2], set the same values
  KO[2]=EMA_day1[2]-EMA_day2[2]; //=0; //first=[2], set the same values
  SignalLine[2]=KO[2]; //first=[2], set the same values
  for(let i=3; i<K_close.length; i++) {  // i=3 to 2000
    EMA_day1[i]=(day1-1)/(day1+1)*EMA_day1[i-1]+2/(day1+1)*VF[i]; //second=[3]
    EMA_day2[i]=(day2-1)/(day2+1)*EMA_day2[i-1]+2/(day2+1)*VF[i]; //second=[3]
    KO[i]=EMA_day1[i]-EMA_day2[i];    //KO[]=3,4,...,2000
    //Signal Line=EMA(KO,day3), day3=13
    SignalLine[i]=(day3-1)/(day3+1)*SignalLine[i-1]+2/(day3+1)*KO[i]; //=3,4,...,2000
  }
  return { KO, SignalLine };
  //drawing these figures in the small windows.
  //Original parameters: day1=34, day2=55, day3=13
  //This program: day1=10, day2=20, day3=13
  //KO[], SignalLine[], VF[], EMA_day1[], EMA_day2[]=2,...,2000
}
window.KlingerOsc = KlingerOsc; //將函數KlingerOsc賦值給window對象，使其成為全局可訪問的函數
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-14==============================
//Candlestick Body Average燭身平均。
//類似Qstick量化陰陽線(Quantitative Candle Stick, Qstick)
//例如:N=10, avg[abs(Close-Open, 10)]=sum(abs[Close-Open], 1 to 10)/10
//用以衡量一段期間內蠟燭圖實體（開盤價與收盤價之間的距離）的平均大小。
//它有助於判斷市場波動性與趨勢強度，並作為其他交易策略的基礎參數。
//eQstick=(n-1)/(n+1)*eQstick昨+2/(n+1)*Qstick今,  <自創>
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function QstickBodyAvg(K_open, K_close, day, esp) {   //QstickBodyAvg
  // Menu Name: QstickBodyAvg       // day=10, 20, ..., esp=9
  // K_close=STK_close, K_open=STK_open
  const QstickBodyAvg = [];    //例如:N=10, QstickBodyAvg=10 to 2000
  const eQstickBodyAvg = [];   //例如:N=10, eQstickBodyAvg=10 to 2000
  //compute first Qstick[]=10, 例如:N=10, Qstick[10]
  let sum=0;  //加總N日內(C-O)總和
  for(let i=1; i<day; i++) {   //i=1 to 10, 例如:N=10}
    sum=sum+Math.abs((K_close[i]-K_open[i]));  //例如:N=10
  }
  QstickBodyAvg[day]=sum/day;  //例如:N=10, first QstickBodyAvg[10]
  eQstickBodyAvg[day]=QstickBodyAvg[day];  //<自創>,令eQstickBodyAvg初值=QstickBodyAvg初值
  //compute QstickBodyAvg[]=11 to 2000, 例如:N=10, i=day+1 to 2000
  for(let i=day+1; i<K_close.length; i++) {   //i=11 to 2000
    sum=sum-Math.abs((K_close[i-day]-K_open[i-day]))+Math.abs((K_close[i]-K_open[i]));  
    //例如:N=10, sum=sum-(C[1]-O[1])+(C[11]-O[11]), 減去N日前的C-O, 加上今天的C-O
    QstickBodyAvg[i]=sum/day;  //例如:N=10, second QstickBodyAvg[11]
    eQstickBodyAvg[i]=(esp-1)/(esp+1)*eQstickBodyAvg[i-1]+2/(esp+1)*QstickBodyAvg[i]; 
    //second eQstickBodyAvg[11]
  }
  return { QstickBodyAvg, eQstickBodyAvg };
  //drawing the QstickBodyAvg and eQstickBodyAvg figures in the small windows.
  //if day=10, then QstickBodyAvg[], eQstickBodyAvg[]=10,11,...,2000.
}
window.QstickBodyAvg = QstickBodyAvg;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-15===========================
//OBOS超買超賣指標(OBOS, Over Buy/Over Sell)
//OBOS: Over Bought Over Sold, 以N日內上漲天數總和減去N日內下跌天數總和來衡量買賣力道
//改為個股，則是OBOS=N日內上漲天數總和-N日內下跌天數總和
//指數平滑移動平均的參數:exponential smoothing parameter(esp),<自創>
function OBOS(K_close, day, esp) {   //OBOS
  // Menu Name: OBOS       // day=10, 20, ..., esp=9
  const OBOS = [];    //例如:N=10, OBOS=10 to 2000
  const eOBOS = [];   //例如:N=10, eOBOS=10 to 2000
  //compute first OBOS[]=10, 例如:N=10, OBOS[10]
  let sum_up=0;       //加總N日內(C-Cprev)總和,上漲天數總和
  let sum_down=0;     //加總N日內(C-Cprev)總和,下跌天數總和 
  for(let i=2; i<day+1; i++) {   //i=2 to 11, 例如:N=10
    if(K_close[i] > K_close[i-1]) {       //上漲天數總和
      sum_up=sum_up+(K_close[i]-K_close[i-1]); }
    else if(K_close[i] < K_close[i-1]) {  //下跌天數總和
      sum_down=sum_down+(K_close[i-1]-K_close[i]);
    }
  }
  OBOS[day+1]=sum_up-sum_down;  //例如:N=10, first OBOS[11]
  eOBOS[day+1]=OBOS[day+1];     //<自創>,令eOBOS初值=OBOS初值
  //compute OBOS[]=12 to 2000, 例如:N=10, i=day+2 to 2000
  for(let i=day+2; i<K_close.length; i++) {   //i=12 to 2000
    //先減去N日前的K_close[i-day-1],再加上當天的K_close[i],以更新sum_up和sum_down
    if(K_close[i-day] > K_close[i-day-1]) {       //N日前的K_close[i-day-1]對sum_up的貢獻
      sum_up=sum_up-(K_close[i-day]-K_close[i-day-1]); }
    else if(K_close[i-day] < K_close[i-day-1]) {  //N日前的K_close[i-day-1]對sum_down的貢獻
      sum_down=sum_down-(K_close[i-day-1]-K_close[i-day]);
    } 
    //再加上當天的K_close[i]對sum_up或sum_down的貢獻
    if(K_close[i] > K_close[i-1]) {       //上漲天數總和
      sum_up=sum_up+(K_close[i]-K_close[i-1]); }
    else if(K_close[i] < K_close[i-1]) {  //下跌天數總和
      sum_down=sum_down+(K_close[i-1]-K_close[i]);
    }  
    OBOS[i]=sum_up-sum_down;  //例如:N=10, second OBOS[12]
    eOBOS[i]=(esp-1)/(esp+1)*eOBOS[i-1]+2/(esp+1)*OBOS[i]; 
    //second eOBOS[12]
  }
  return { OBOS, eOBOS };
  //drawing the OBOS and eOBOS figures in the small windows.
  //if day=10, then OBOS[], eOBOS[]=11,12,...,2000.
}
window.OBOS = OBOS;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-16===========================
//McClellan Oscillator(麥克萊倫震盪指標)	(No.101)
//類似：OBOS: Over Bought Over Sold, 以N日內上漲天數總和減去N日內下跌天數總和來衡量買賣力道
//改為個股，則是OBOS=N日內上漲天數總和-N日內下跌天數總和
//McClellan Summation Index（麥克萊倫總和指數）
//McClellan Summation Index（SI）是 McClellan Oscillator 的累積值。
//指數平滑移動平均的參數:exponential smoothing parameter(esp),<自創>
function McClellanOSC(K_close, day, esp1, esp2) {   //McClellanOSC
  // Menu Name: McClellanOSC  // day=10,20,...,esp1=10, 20, ..., esp2=20,30,...
  // ensure esp1<esp2, 例如: esp1=10, esp2=20
  let temp;
  if(esp1>=esp2) {
    temp=esp1; esp1=esp2; esp2=temp;
  }
  const ANA=[];  //Net Advances Adjusted(ANA), 例如:N=10, ANA=11 to 2000
  const EMA19=[], EMA39=[]; //指數平滑移動平均
  const McClellanOSC=[];    //McClellan Oscillator, 例如:N=10, McClellanOSC=11 to 2000
  const SI=[];              //McClellan Summation Index, 例如:N=10, SI=11 to 2000
  //Net Advances Adjusted(ANA): 
  //(N日內上漲天數總和-N日內下跌天數總和)/(N日內上漲天數總和+N日內下跌天數總和)
  //compute first ANA[]=11, 例如:N=10, ANA[11]
  let sum_up=0;       //加總N日內(C-Cprev)總和,上漲天數總和
  let sum_down=0;     //加總N日內(C-Cprev)總和,下跌天數總和 
  for(let i=2; i<day+1; i++) {   //i=2 to 11, 例如:N=10
    if(K_close[i] > K_close[i-1]) {       //上漲天數總和
      sum_up=sum_up+(K_close[i]-K_close[i-1]); }
    else if(K_close[i] < K_close[i-1]) {  //下跌天數總和
      sum_down=sum_down+(K_close[i-1]-K_close[i]);
    }
  }
  ANA[day+1]=(sum_up-sum_down)/(sum_up+sum_down);  //例如:N=10, first ANA[11]
  EMA19[day+1]=ANA[day+1];     //令EMA19初值=ANA初值, first EMA19[11]
  EMA39[day+1]=ANA[day+1];     //令EMA39初值=ANA初值, first EMA39[11]
  McClellanOSC[day+1]=EMA19[day+1]/EMA39[day+1];     //first McClellanOSC[11]
  SI[day+1]=McClellanOSC[day+1];     //first SI[11]
  //compute ANA[]=12 to 2000, 例如:N=10, i=day+2 to 2000
  for(let i=day+2; i<K_close.length; i++) {   //i=12 to 2000
    //先減去N日前的K_close[i-day-1],再加上當天的K_close[i],以更新sum_up和sum_down
    if(K_close[i-day] > K_close[i-day-1]) {       //N日前的K_close[i-day-1]對sum_up的貢獻
      sum_up=sum_up-(K_close[i-day]-K_close[i-day-1]); }
    else if(K_close[i-day] < K_close[i-day-1]) {  //N日前的K_close[i-day-1]對sum_down的貢獻
      sum_down=sum_down-(K_close[i-day-1]-K_close[i-day]);
    } 
    //再加上當天的K_close[i]對sum_up或sum_down的貢獻
    if(K_close[i] > K_close[i-1]) {       //上漲天數總和
      sum_up=sum_up+(K_close[i]-K_close[i-1]); }
    else if(K_close[i] < K_close[i-1]) {  //下跌天數總和
      sum_down=sum_down+(K_close[i-1]-K_close[i]);
    }
    ANA[i]=(sum_up-sum_down)/(sum_up+sum_down);  //例如:N=10, second ANA[12]
    EMA19[i]=(esp1-1)/(esp1+1)*EMA19[i-1]+(2)/(esp1+1)*ANA[i];  //例如:N=10, second EMA19[12]
    EMA39[i]=(esp2-1)/(esp2+1)*EMA39[i-1]+(2)/(esp2+1)*ANA[i];  //例如:N=10, second EMA39[12]
    McClellanOSC[i]=EMA19[i]/EMA39[i];  //例如:N=10, second McClellanOSC[12]
    SI[i]=SI[i-1]+McClellanOSC[i];      //例如:N=10, second SI[12]
  }
  return { McClellanOSC, SI };
  //drawing the McClellanOSC[] and SI[] figures in the small windows.
  //if day=10, then McClellanOSC[]=11,12,...,2000 and SI[]=11,12,...,2000. 可以加eMcClellanOSC[]和SI[]
}
window.McClellanOSC = McClellanOSC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-27====================================
//Average Directional Index(ADX)是Directional Movement Index(DMI)系統的一部分
//ATR均幅指標(ATR, Average True Range) indicator.
//ATR[]=TR的指數平滑移動平均
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ADX_DMI(STK_high, STK_low, STK_close, esp) {
  // Menu Name: ADX_DMI     // esp=14
  // 1.Calculate Directional Movement(DM)
  //DM+ =當日最高價-前一日最高價,如果當日最高價-前一日最高價>前一日最低價-當日最低價,
  // 且當日最高價-前一日最高價>0,則DM+ = 當日最高價-前一日最高價,否則DM+ = 0.
  const DM_plus=[];
  const eDM_plus=[];    // =2 to 2000
  //DM- =前一日最低價-當日最低價,如果前一日最低價-當日最低價>當日最高價-前一日最高價,
  // 且前一日最低價-當日最低價>0,則DM- = 前一日最低價-當日最低價,否則DM- = 0.
  const DM_minus=[], eDM_minus=[];  // =2 to 2000
  for(let i=2; i<STK_close.length; i++) {    //i=2 to 2000
    if((STK_high[i]-STK_high[i-1])>(STK_low[i-1]-STK_low[i]) && (STK_high[i]-STK_high[i-1])>0) {  
      //當日最高價-前一日最高價>前一日最低價-當日最低價,且當日最高價-前一日最高價>0
      DM_plus[i]=STK_high[i]-STK_high[i-1]; }  //DM+ = 當日最高價-前一日最高價
    else {
      DM_plus[i] = 0;  //DM+ = 0
    }
    if((STK_low[i-1]-STK_low[i])>(STK_high[i]-STK_high[i-1]) && (STK_low[i-1]-STK_low[i])>0) {
      //前一日最低價-當日最低價>當日最高價-前一日最高價,且前一日最低價-當日最低價>0
      DM_minus[i]=STK_low[i-1]-STK_low[i]; }  //DM- = 前一日最低價-當日最低價
    else {
      DM_minus[i] = 0;  //DM- = 0
    } 
    //Wilder smoothing method: eDM_plus[i]=(esp-1)/esp*eDM_plus[i-1]+1/esp*DM_plus[i];
    if(i===2) {
      eDM_plus[2]=DM_plus[2];     //eDM_plus[2]=DM_plus,因為i=2才開始計算DM_plus,所以eDM_plus[2]=DM_plus.
      eDM_minus[2]=DM_minus[2]; } //eDM_minus[2]=DM_minus,因為i=2才開始計算DM_minus,所以eDM_minus[2]=DM_minus.
    else {
      eDM_plus[i]=(esp-1)/esp*eDM_plus[i-1]+1/esp*DM_plus[i];
      eDM_minus[i]=(esp-1)/esp*eDM_minus[i-1]+1/esp*DM_minus[i];
    }
  }
  // 2.Calculate True Range(TR)
  const ATR=[]; //ATR[]=TR的指數平滑移動平均
  const TR=[];  //TR=真實波幅(True Range),TR是陣列不是變數. =2 to 2000
  let temp1, temp2, temp3;
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR[i] = Math.max(temp1, temp2, temp3);
    if(i===2) {
      ATR[2]=TR[2]; }  //ATR[2]=TR,因為i=2才開始計算TR,所以ATR[2]=TR.
    else {
      //Wilder smoothing method: ATR[i]=(esp-1)/esp*ATR[i-1]+1/esp*TR[i];
      ATR[i]=(esp-1)/esp*ATR[i-1]+1/esp*TR[i];
    }
  }
  //4.Calculate +DI and -DI (DI, Directional Indicator)
  const DI_plus=[], DI_minus=[];            //=2 to 2000
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    DI_plus[i] = 100 * eDM_plus[i] / ATR[i];
    DI_minus[i] = 100 * eDM_minus[i] / ATR[i];
  } 
  //5.Calculate Directional Index (DX)
  const DX=[];  //=2 to 2000
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    DX[i] = 100*Math.abs(DI_plus[i]-DI_minus[i])/(DI_plus[i]+DI_minus[i]);
  } 
  // 6.Calculate Average Directional Index (ADX)
  const ADX=[];     //=2 to 2000
  ADX[2] = DX[2];   //ADX[2]=DX,因為i=2才開始計算DX,所以ADX[2]=DX.
  for(let i=3; i<STK_close.length; i++) {  //i=3 to 2000
    ADX[i] = (esp-1)/esp*ADX[i-1]+1/esp*DX[i];
  }
  return { DI_plus, DI_minus, ADX };
  // drawing these figures in the small windows.
  // DI_plus[], DI_minus[], ADX[]=2,3,...,2000.
}
window.ADX_DMI = ADX_DMI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-29====================
//Adaptive Moving Average(Adaptive MA)自適應移動平均線
//通常指KAMA，由Perry Kaufman 開發)，是一種根據市場波動性調整其平滑程度的移動平均線。
//Adaptive MA的主要特點是它能夠在市場趨勢明確時提供更平滑的線條，
//而在市場波動較大時提供更敏感的反應。
//計算效率比率(Efficiency Ratio, ER)，ER衡量價格變動的效率，計算方法為：
//ER=(當前價格-N期前價格)/(N期內的價格波動總和)，其中N是一個預定的時間週期。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function AdaptiveMA(STK_high, STK_low, STK_close, day) {
  // Menu Name: AdaptiveMA       // day=10, 20,...
  // Calculate Price[]=(H+L+2*C)/4
  const Price = [];   //Price[]=1,...,2000
  for(let i=1; i<STK_close.length; i++) {  //i=1 to 2000
    Price[i] = (STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  // 1:計算效率比率(Efficiency Ratio, ER)
  const ER = [];    //ER[]=11,...,2000=day+1 to 2000
  for(let i=day+1; i<STK_close.length; i++) { //i=11 to 2000
    const priceChange = Price[i]-Price[i-day]; //P11-P1=當前價格-N期前價格
    let volatility = 0;  //分母=N期內的價格波動總和
    for(let j=i-day+1; j<=i; j++) {  //j=2 to 11
      volatility += Math.abs(Price[j]-Price[j-1]);
    }
    ER[i] = priceChange/volatility;  //ER[]=11 to 2000  
  }
  // 2:計算平滑常數(Smoothing Constant, SC)
  const SC = [];  //SC[]=11,...,2000,平滑常數(Smoothing Constant,SC)
  const FastSC = 2/(2+1);    //=2/(day+1);  
  const SlowSC = 2/(30+1);   //30是常用的慢速週期
  for(let i=day+1; i<STK_close.length; i++) { //i=11 to 2000
    SC[i] = (ER[i]*(FastSC-SlowSC)+SlowSC)**2; //SC[]=11 to 2000,平方
  }
  // 3:計算KAMA最終值，計算Adaptive MA
  const AdaptiveMA = [];  //AdaptiveMA[]=11,...,2000
  //變通：初始值=AdaptiveMA[11]=(Price[10]+Price[11])/2,
  AdaptiveMA[day+1] = (Price[day]+Price[day+1])/2; 
  for(let i=day+2; i<STK_close.length; i++) { //i=12 to 2000
    AdaptiveMA[i] = AdaptiveMA[i-1]+SC[i]*(Price[i]-AdaptiveMA[i-1]); 
    //AdaptiveMA[]=11,12 to 2000 
  }
  //看AdaptiveMA[]圖形後在決定是否要算eAdaptiveMA[]
  return { AdaptiveMA };
  // Normally drwing AdaptiveMA[] figures in the K_Line area.
  // drawing AdaptiveMA[] figures in the small windows.
  // AdaptiveMA[]=11,12,...,2000.  =day+1,...,2000
}
window.AdaptiveMA = AdaptiveMA;  
//將AdaptiveMA函數掛載到全局window對象上，使其在其他地方可用
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-May-30====================
//DeMarker Indicator (DeM) is a technical analysis oscillator 
// developed by Tom DeMark. 	<No.95>
function DeMarker(STK_high, STK_low, STK_close, day) {
  // Menu Name: DeMarker      // day=14,...
  // Calculate Calculate DeMax[] and DeMin[]
  const DeMax = [];
  const DeMin = [];     //DeMax[], DeMin[]=2,...,2000
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    if(STK_high[i]>STK_high[i-1]) {
      DeMax[i] = STK_high[i]-STK_high[i-1]; }
    else {
      DeMax[i] = 0;
    }
    if(STK_low[i-1]>STK_low[i]) {
      DeMin[i] = STK_low[i-1]-STK_low[i]; }
    else {
      DeMin[i] = 0;
    }
  }
  // Calculate Simple Moving Average(SMA), the DeMarker Indicator
  let sumDeMax = 0;  let sumDeMin = 0;
  let avgDeMax = 0;  let avgDeMin = 0;
  for(let i=2; i<day+1; i++) {  //i=2 to 15(=day+1)
    sumDeMax = sumDeMax+DeMax[i];
    sumDeMin = sumDeMin+DeMin[i];
  }
  avgDeMax = sumDeMax / day;  //求得前day(=14)天的DeMax平均值,分子
  avgDeMin = sumDeMin / day;  //求得前day(=14)天的DeMin平均值
  const DeMarker = [];        //first DeMarker[]=15,...,2000
  DeMarker[day+1] = avgDeMax/(avgDeMax + avgDeMin);  //first DeMarker[15]
  for(let i=day+2; i<STK_close.length; i++) {  //i=16 to 2000
    sumDeMax = sumDeMax-DeMax[i-day]+DeMax[i];  //先減舊的再加新的
    sumDeMin = sumDeMin-DeMin[i-day]+DeMin[i];  //先減舊的再加新的
    avgDeMax = sumDeMax / day;  //求得前day(=14)天的DeMax平均值,分子
    avgDeMin = sumDeMin / day;  //求得前day(=14)天的DeMin平均值
    DeMarker[i] = avgDeMax/(avgDeMax + avgDeMin);  //DeMarker[16],...,2000    
  }   
  return { DeMarker };
  // drwing DeMarker[] figures in the small window.
  // if day=14, then DeMarker[]=15,16,...,2000.
}
window.DeMarker = DeMarker;  
//將DeMarker函數掛載到全局window對象上，使其在其他地方可用
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-01======================
//Larry Williams Volatility Channel	<No.93>
//ATR均幅指標(ATR, Average True Range) indicator.
//ATR[]=TR的指數平滑移動平均,The ATR is a measure of volatility,
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function WilliamsVolatilityChannel(STK_high, STK_low, STK_close, day, esp) {
  // Menu Name: WilliamVoltyChl   // day=10,15,20,...  esp=9 
  // Calculate ATR[]=TR的指數平滑移動平均, ATR[]=2 to 2000
  const ATR=[]; //ATR[]=TR的指數平滑移動平均, ATR[]=2 to 2000
  let TR;       //TR=真實波幅(True Range),TR改為變數,不是陣列
  let temp1, temp2, temp3;
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR = Math.max(temp1, temp2, temp3);
    if(i===2) {
      ATR[2]=TR; }  //ATR[2]=TR,因為i=2才開始計算TR,所以ATR[2]=TR.
    else {
      ATR[i]=(esp-1)/(esp+1)*ATR[i-1]+2/(esp+1)*TR;
    }
  }
  // Calculate the Middle Line, =SMA(Close,N), Close=Price=(H+L+2*C)/4
  const MiddleLine=[];  //Middle Line, =SMA(Close, N)=10,11,...,2000
  // applying Price=(H+L+2C)/4 instead of Close.
  const Price=[];       //Price=(H+L+2C)/4, =1,2,...,2000
  for(let i=1; i<STK_close.length; i++) {  //i=1 to 2000
    Price[i]=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  let sum=0;
  for(let i=1; i<day; i++) {   //i=1 to day, day=10,15,20,...
    sum = sum + Price[i];
  } 
  MiddleLine[day] = sum/day;  //first MiddleLine[day]=[10]
  for(let i=day+1; i<STK_close.length; i++) {  //i=day+1 to 2000
    sum = sum + Price[i] - Price[i-day];        //加新減舊
    MiddleLine[i] = sum/day;  //second=11
  } 
  // Calculate the Upper Line, =Middle Line + ATR*Multiplier
  // Calculate the Lower Line, =Middle Line - ATR*Multiplier
  const UpperLine = [];  //UpperLine=MiddleLine+ATR*Multiplier
  const LowerLine = [];  //LowerLine=MiddleLine-ATR*Multiplier
  let Multiplier = 2;    //volatility multiplier(commonly 1.5, 2, or 2.5) 
  // Multiplier determines how wide the channel is around the Middle Line.
  for(let i=day; i<STK_close.length; i++) {  //i=10(day) to 2000
    UpperLine[i] = MiddleLine[i] + ATR[i] * Multiplier;
    LowerLine[i] = MiddleLine[i] - ATR[i] * Multiplier;
  }
  return { MiddleLine, UpperLine, LowerLine };
  // Normally drawing the these figures in the K_Line area.
  // ATR[]=2,3,...,2000.
  // MiddleLine[], UpperLine[], LowerLine[]=10(day),11,...,2000.
}
window.WilliamsVolatilityChannel = WilliamsVolatilityChannel;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-02======================
//Volume Zone Oscillator(VZO)  	<No.92>
// VZO is a momentum indicator that analyzes volume changes 
// to identify extended price zones where potential reversals may occur
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function VolumeZoneOsc( STK_close, STK_vol, esp) {
  // Menu Name: VolZoneOsc      // esp=9, 10,...
  // 1.Determine Signed Volume, SignedVol[]=2 to 2000
  const SignedVol=[];     //SignedVol[]=2 to 2000
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    if(STK_close[i] > STK_close[i-1]) {
      SignedVol[i] = STK_vol[i]; }  //當日成交量為正值 
    else if(STK_close[i] < STK_close[i-1]) {
      SignedVol[i] = -STK_vol[i]; } //當日成交量為負值
    else {
      SignedVol[i] = 0;             //當日成交量為零
    }
  }
  // 2.Calculate the EMA of signed volume(SignedVol)
  // 2.Calculate the EMA of total volume
  // 3.Calculate the Volume Zone Oscillator
  const EMA_SignedVol=[];  //EMA of signed volume, =2 to 2000
  const EMA_TotalVol=[];   //EMA of total volume,  =2 to 2000
  const VolZoneOsc=[];     //Volume Zone Oscillator, =2 to 2000
  EMA_SignedVol[2] = SignedVol[2];  //initial value of EMA_SignedVol[2]
  EMA_TotalVol[2] = STK_vol[2];     //initial value of EMA_TotalVol[2]
  VolZoneOsc[2] = 100*EMA_SignedVol[2]/EMA_TotalVol[2];  //initial value
  for(let i=3; i<STK_close.length; i++) {  //i=3 to 2000
    EMA_SignedVol[i] = (esp-1)/(esp+1)*EMA_SignedVol[i-1]+2/(esp+1)*SignedVol[i];
    EMA_TotalVol[i] = (esp-1)/(esp+1)*EMA_TotalVol[i-1]+2/(esp+1)*STK_vol[i];
    VolZoneOsc[i] = 100*EMA_SignedVol[i]/EMA_TotalVol[i];
  } 
  return { VolZoneOsc };
  // drawing the VolZoneOsc[] figures in the small windows.
  // VolZoneOsc[]=2,3,...,2000.
}
window.VolumeZoneOsc = VolumeZoneOsc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-04=======================
// Dynamic Zone RSI動態區域相對強弱指標 	<No.85>
// RSI相對強弱指標(RSI, Relative Strength Index)
// eRSI完全自創指標,completely self-created indicators. 
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function DynamicZoneRSI(K_close, RSI_day, esp) {
  // Menu Name: Dynamic Zone RSI   //RSI_day=10,15,...,  //esp=9
  // First calculate RSI
  const RSI=[], eRSI=[];  //if RSI_day=10, RSI[],eRSI[]=11,12,...,2000
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<K_close.length; i++) {
    dif[i]=K_close[i]-K_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI[]. if day=10, RSI[]=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  eRSI[RSI_day+1]=RSI[RSI_day+1]   //eRSI的初值=eRSI[11]
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<K_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];
    //eRSI新=(n-1)/(n+1)*eRSI舊+2/(n+1)*RSI新
  }
  //==========以上程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  // if RSI_day=10 then RSI[], eRSI[]=11,12,...,2000.
  //計算RSI的移動平均,MA可以是：SMA, EMA, Wilder MA. 此處以EMA為例.
  // 3.計算RSI的標準差,SD=standard deviation of RSI. 此處的時間長度以N=RSI_day替代.
  //Calculate the SD=standard deviation of RSI. 
  // The length of time here is replaced by N=RSI_day=10.
  // 4.計算RSI的動態區域上限和下限,upper limit and lower limit of dynamic zone of RSI.
  const DZ_upper=[];  //RSI的動態區域上限, Dynamic Zone RSI's upper limit
  const DZ_lower=[];  //RSI的動態區域下限, Dynamic Zone RSI's lower limit
  const DZ_mid=[];    //RSI的動態區域中線, Dynamic Zone RSI's mid line=eRSI[].
  let K=1.3185;    //K值是RSI動態區域的寬度參數，K=1.3185是經過實證分析後的最佳值.
  let sum_RSI = 0; //RSI的總和
  let avg_RSI = 0; //RSI的平均值=DZ_mid=[],可以用eRSI[]替代,但此處為了清晰起見,仍然使用avg_RSI[]來表示RSI的平均值.
  let avgRSI2 = 0; //RSI的平均值2,用於保存前一個RSI的平均值avg_RSI.
  let SD_RSI = 0;  //RSI的標準差
  for(let i=RSI_day+1; i<RSI_day+RSI_day; i++) {  //11 t0 20
    sum_RSI = sum_RSI + RSI[i];  //第1個_RSI的總和
  }
  avg_RSI = sum_RSI/RSI_day;          //第1個_RSI的平均值
  DZ_mid[RSI_day+RSI_day] = avg_RSI;  //第1個_RSI的動態區域中線=[20]=[10+10]
  avgRSI2 = avg_RSI;   //保存第1個_RSI的平均值,用於計算第2個_RSI的標準差.
  let sum_squared_diff = 0;  
  for(let i=RSI_day+1; i<RSI_day+RSI_day; i++) {  //11 to 20
    sum_squared_diff = sum_squared_diff+Math.pow(RSI[i]-avg_RSI,2);
  }
  SD_RSI = Math.sqrt(sum_squared_diff/RSI_day);  //第1個_RSI的標準差
  DZ_upper[RSI_day+RSI_day] = avg_RSI+K*SD_RSI;  //第1個_RSI的動態區域上限
  DZ_lower[RSI_day+RSI_day] = avg_RSI-K*SD_RSI;  //第1個_RSI的動態區域下限
  //計算其餘的值.
  for(let i=RSI_day+RSI_day+1; i<K_close.length; i++) {  //21 to 2000
    //計算第2個_RSI的平均值,標準差,動態區域上限和下限. if RSI_day=10 then second RSI value=RSI[12]
    sum_RSI = sum_RSI + RSI[i] - RSI[i-RSI_day];  //第2個_RSI的總和,加新減舊=+[21]-[11]
    avg_RSI = sum_RSI/RSI_day;       //第2個_RSI的平均值,RSI的平均值=DZ_mid=[],可以用eRSI[]替代
    DZ_mid[i] = avg_RSI;   //第2個_RSI的動態區域中線=eRSI[]
    sum_squared_diff = sum_squared_diff+Math.pow(RSI[i]-avg_RSI,2)-Math.pow(RSI[i-RSI_day]-avgRSI2,2);
    avgRSI2 = avg_RSI;     //保存前RSI的平均值,用於計算下一輪的值.
    SD_RSI = Math.sqrt(sum_squared_diff/RSI_day);  //第2個_RSI的標準差
    DZ_upper[i] = avg_RSI+K*SD_RSI;  //第2個_RSI的動態區域上限
    DZ_lower[i] = avg_RSI-K*SD_RSI;  //第2個_RSI的動態區域下限
  } 
  //DZ_mid=[],RSI的動態區域中線,可以用eRSI[]替代,但此處為了清晰起見,仍然使用avg_RSI[]來表示RSI的平均值.
  return { RSI, DZ_upper, DZ_mid, DZ_lower };
  // if RSI_day=10 then RSI[]=11,12,...,2000.
  // DZ_upper[], DZ_mid[], DZ_lower[]= 10*2, 21, ...,2000.
  //drawing these figures in the small windows.
}
window.DynamicZoneRSI = DynamicZoneRSI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-05====================================
//Chande Kroll Stop(CKS)是由Tushar Chande與Stanley Kroll提出的趨勢追蹤停損指標，
// 利用 Average True Range (ATR) 計算動態停損位置。
//ATR均幅指標(ATR, Average True Range). ATR[]=TR的指數平滑移動平均.
//指數平滑移動平均的參數:exponential smoothing parameter(esp=num)
function CKstop(STK_high, STK_low, STK_close, num) {
  // Menu Name: Chande Kroll Stop      // num=10
  const ATR=[]; //ATR[]=TR的指數平滑移動平均, ATR[]=2,3,...,2000.
  let TR; //TR=真實波幅(True Range)是變數,以前設為陣列,現改為變數,因TR只需當前的值,不需儲存過去的值.
  let temp1, temp2, temp3;
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR = Math.max(temp1, temp2, temp3);
    if(i===2) {
      ATR[2]=TR; }  //ATR[2]=TR,因為i=2才開始計算TR,所以ATR[2]=TR.
    else {
      ATR[i]=(num-1)/(num+1)*ATR[i-1]+2/(num+1)*TR;
      //Wilder平滑：ATR[i]=(num-1)/num*ATR[i-1]+1/num*TR;
    }
  }
  //上述程式是完整的ATR[]程式設計,ATR[]=2,3,...,2000.
  //Calculate: Long Stop基礎值, Short Stop基礎值.
  const LongStop = [];    //=11(num+1) to 2000
  const ShortStop = [];   //=11(num+1) to 2000
  let max_High;  //num=10內的最高價
  let min_Low;   //num=10內的最低價
  let xx=1.5;    //CKS的參數,可調整,預設為1.5
  for(let i=num+1; i<STK_close.length; i++) {  //i=11 to 2000
    //在2到11共10天中找最高價與最低價.
    max_High = STK_high[i-num+1];    //max_High=STK_high[2].
    min_Low = STK_low[i-num+1];      //min_Low=STK_low[2].
    for(let j=i-num+2; j<=i; j++) {  //j=3 to 11
      if(STK_high[j]>max_High)  {
        max_High = STK_high[j]; } //最近num=10期最高價
      if(STK_low[j]<min_Low)  {
        min_Low = STK_low[j]; }   //最近num=10期最低價
    }
    LongStop[i] = max_High - xx*ATR[i];  //=11 to 2000
    ShortStop[i] = min_Low + xx*ATR[i];  //=11 to 2000
  } 
  //Chande Kroll Stop(CKS),再以M期平滑(通常M=9)
  const CKS_Long = [];   //=19(num+M) to 2000
  const CKS_Short = [];  //=19(num+M) to 2000
  let M=9;   //CKS的平滑參數,可調整,預設為9
  let max_Long, min_Short;  //M期內的最高LongStop與最低ShortStop
  for(let i=num+M; i<STK_close.length; i++) {  //i=19(10+9) to 2000
    //首輪：在11到19共9天中找最高LongStop與最低ShortStop.
    max_Long = LongStop[i-M+1];    //max_Long=LongStop[11]
    min_Short = ShortStop[i-M+1];  //min_Short=ShortStop[11]
    for(let j=i-M+2; j<=i; j++) {  //j=11+1 to 19
      if(LongStop[j]>max_Long)  {
        max_Long = LongStop[j]; }    //最近M=9期的最高LongStop
      if(ShortStop[j]<min_Short)  {
        min_Short = ShortStop[j]; }  //最近M=9期的最低ShortStop
    }
    CKS_Long[i] = max_Long;    //=19 to 2000,
    CKS_Short[i] = min_Short;  //=19 to 2000
  }
  return { CKS_Long, CKS_Short };  
  // Normally drawing the CKS_Long[] and CKS_Short[] figures in the K_Line area.
  // CKS_Long[], CKS_Short[]=19,20,...,2000. <i.e. num=10, M=9, num+M=19.>
  // LongStop[], ShortStop[]=11,12,...,2000. <i.e. num=10, num+1=11.>
}
window.CKstop = CKstop;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-05====================================
// Donchian Channel唐奇安通道。是由Richard Donchian在1950年代開發的一種技術分析工具，
// 用於識別趨勢和潛在的反轉點。它由三條線組成：上軌線、中軌線和下軌線。上軌線是過去N天的最高價，
// 下軌線是過去N天的最低價，而中軌線則是上軌線和下軌線的平均值。
//指數平滑移動平均的參數:exponential smoothing parameter(esp=num)
function DonchianChannel(STK_high, STK_low, num) {
  // Menu Name: Donchian Channel      // num=10, 20,...
  // 1.上軌(Upper Channel)=過去num=10天的最高價.
  // 2.下軌(Lower Channel)=過去num=10天的最低價, 
  // 3.中軌(Middle Channel)=(上軌+下軌)/2.
  // 4.百分比寬度=(上軌-下軌)/中軌*100%
  const UpperChannel = [];  //=num=10 to 2000, 上軌(Upper Channel)
  const LowerChannel = [];  //=num=10 to 2000, 下軌(Lower Channel)
  const MiddleChannel = []; //=num=10 to 2000, 中軌(Middle Channel)
  const ChannelWidth = [];  //=num=10 to 2000, 百分比寬度=(上軌-下軌)/中軌*100%
  let max_High, min_Low;    //num=10內的最高價和最低價
  //edited by fami 2026-06-05, using STK_high instead of STK_close 
  // for(let i=num; i<STK_close.length; i++) 
  for(let i=num; i<STK_high.length; i++) {  //i=10 to 2000 // 
    //在1到10共10天中找最高價與最低價.
    max_High = STK_high[i-num+1];     //max_High=STK_high[1]
    min_Low = STK_low[i-num+1];       //min_Low=STK_low[1]
    for(let j=i-num+2; j<=i; j++) {   //j=2 to 10
      if(STK_high[j]>max_High)  {
        max_High = STK_high[j]; } 
      if(STK_low[j]<min_Low)  {
        min_Low = STK_low[j]; }     
    } 
    UpperChannel[i] = max_High;
    LowerChannel[i] = min_Low;
    MiddleChannel[i] = (max_High + min_Low) / 2;
    //ChannelWidth[i] =MiddleChannel[i] !== 0 ? (UpperChannel[i]-LowerChannel[i])/MiddleChannel[i]*100:0;
    //Visual Studio Code的建議寫法如上,但我習慣用if else寫法,所以改回if else寫法.
    if(MiddleChannel[i] !== 0) {
      ChannelWidth[i] = (UpperChannel[i]-LowerChannel[i])/MiddleChannel[i]*100; }
    else {
       ChannelWidth[i] = 0; //避免除以零的情況
    }
  } 
  return { UpperChannel, LowerChannel, MiddleChannel, ChannelWidth };  
  // Normally drawing these figures in the K_Line area.
  // These Four array indicators=10,11,...,2000.  <i.e. num=10 .>
}
window.DonchianChannel = DonchianChannel;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-06====================================
//Chandelier Exit Strategy(吊燈停損策略)  <No.83> ------與Chande Kroll Stop(CKS)很像！
//Chandelier Exit是由 Charles Le Beau 提出的趨勢追蹤停損方法，
//利用 Average True Range(ATR) 計算動態停損點，讓停損位隨價格趨勢移動。
//ATR均幅指標(ATR, Average True Range). ATR[]=TR的指數平滑移動平均.
//指數平滑移動平均的參數:exponential smoothing parameter(esp=num)
function ChandelierExit(STK_high, STK_low, STK_close, num) {
  // Menu Name: Chandelier Exit      // num=20
  //此程式計算ATR[]與之前設計不同.先計算TR,再以Wilder平滑法計算ATR[].
  const ATR=[]; //ATR[]=TR的指數平滑移動平均, ATR[]=20,...,2000.
  let TR=0; //TR=真實波幅(True Range)是變數,以前設為陣列,現改為變數,因TR只需當前的值,不需儲存過去的值.
  let temp1, temp2, temp3;
  for(let i=2; i<num+1; i++) {  //i=2 to 21,因為i=2才開始計算TR,所以i=2 to num+1.
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR = TR + Math.max(temp1, temp2, temp3);  //加總前20筆TR的值
  }
  ATR[num+1]=TR/num;   //第1個ATR[]=ATR[21],所以ATR[]=21,...,2000.
  //計算其餘的ATR[]=22,...,2000.
  //ATR[i]=(num-1)/(num+1)*ATR[i-1]+2/(num+1)*TR;
  //Wilder平滑：ATR[i]=(num-1)/num*ATR[i-1]+1/num*TR;
  for(let i=num+2; i<STK_close.length; i++) {  //i=22 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]); 
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR = Math.max(temp1, temp2, temp3);
    ATR[i]=(num-1)/num*ATR[i-1]+1/num*TR;   //Wilder平滑
  }
  //上述程式是完整的ATR[]程式設計,ATR[]=21(num+1),...,2000.
  //Calculate: Long Chandelier Exit, Short Chandelier Exit.
  const Long_ChandelierExit = [];    //=21(num+1) to 2000
  const Short_ChandelierExit = [];   //=21(num+1) to 2000
  let max_High;  //num=20內的最高價
  let min_Low;   //num=20內的最低價
  let kk=3;      //CKS的參數,可調整,預設為3
  for(let i=num+1; i<STK_close.length; i++) {  //i=21 to 2000
    //在2到21共20天中找最高價與最低價.
    max_High = STK_high[i-num+1];    //max_High=STK_high[2].
    min_Low = STK_low[i-num+1];      //min_Low=STK_low[2].
    for(let j=i-num+2; j<=i; j++) {  //j=3 to 21
      if(STK_high[j]>max_High)  {
        max_High = STK_high[j]; } //最近num=20期最高價
      if(STK_low[j]<min_Low)  {
        min_Low = STK_low[j]; }   //最近num=20期最低價
    }
    Long_ChandelierExit[i] = max_High - kk*ATR[i];  //=21 to 2000
    Short_ChandelierExit[i] = min_Low + kk*ATR[i];  //=21 to 2000
  } 
  return { Long_ChandelierExit, Short_ChandelierExit };  
  // Normally drawing these two figures in the K_Line area.
  // Long_ChandelierExit[], Short_ChandelierExit[]=21,...,2000. 
  // <i.e. num=20, num+1=21.>
}
window.ChandelierExit = ChandelierExit;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-07====================================
//Volume Flow Indicator(VFI)成交量流量指標  <No.81>
//是由 Markos Katsanos 提出的成交量動能指標，用於改進傳統的 On-Balance Volume(OBV)。
// VFI 不僅考慮成交量方向，也納入價格波動與成交量過濾機制，以減少雜訊。
//指數平滑移動平均的參數:exponential smoothing parameter(esp=num)
function VolumeFlowIndicator(STK_high, STK_low, STK_close,STK_vol, num) {
  // Menu Name: VolFlowIndicator     // num=20
  // 1.Calculate Typical Price典型價格
  const TypicalPrice = [];  //1 to 2000
  for(let i=1; i<STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i] = (STK_high[i] + STK_low[i] + 2 * STK_close[i]) / 4;
  }
  // 2.對數價格變化(Logarithmic Price Change)
  const LogPriceChange = [];  //=Rt, =2 to 2000
  for(let i=2; i<STK_close.length; i++) {  //i=2 to 2000
    LogPriceChange[i] = Math.log(TypicalPrice[i] / TypicalPrice[i-1]);
  } 
  // 3.Calculate波動率估計(Volatility),num=20,計算最近N期對數報酬標準差
  const StdDev=[];  //Sigma,標準差, =21(num+1) to 2000
  let sum=0; 
  let mu=0;  //mu=x_bar
  let sum_square=0;
  for(let i=2; i<num+1; i++) {  //i=2 to 21
    sum=sum+LogPriceChange[i];
  }
  mu=sum/num;  //calculate average of LogPriceChange[]
  for(let i=2; i<num+1; i++) {  //i=2 to 21
    sum_square=sum_square+(LogPriceChange[i]-mu)**2;
  }
  StdDev[num+1]=Math.sqrt(sum_square/num);  //第1個標準差StdDev[21]
  //計算其餘的標準差StdDev[]=22 to 2000
  for(let i=num+2; i<STK_close.length; i++) {  //i=22 to 2000
    sum=sum-LogPriceChange[i-num]+LogPriceChange[i]; //先減舊=2,再加新=22
    mu=sum/num;   //平均數mu=x_bar
    sum_square=0; //歸零
    for(let j=i-num+1; j<=i; j++) {  //j=3 to 22
      sum_square=sum_square+(LogPriceChange[j]-mu)**2;
    }
    StdDev[i]=Math.sqrt(sum_square/num);  //第2個標準差StdDev[22]
  }
  // 4.波動門檻(Volatility Cutoff)=Cut_off[]=21(num+1) to 2000
  let Coefficient=0.2;
  const Cut_off=[];   //波動門檻, =21(num+1) to 2000
  for(i=num+1; i<STK_close.length; i++) {  //i=21 to 2000
    Cut_off[i]=Coefficient*StdDev[i]*STK_close[i];
  }
  // 5.平均成交量Average Volume,通常N=130,此處仍然取num=20
  const avg_Vol=[];  //平均成交量, =20(num) to 2000
  sum=0;
  for(let i=1; i<num; i++) {  //i=1 to 20(num)
    sum=sum+STK_vol[i];
  }
  avg_Vol[num]=sum/num;  //第1個平均成交量avg_Vol[]=20
  //計算其餘的平均成交量, =21,22,...,2000
  for(i=num+1; i<STK_close.length; i++) {
    sum=sum-STK_vol[i-num]+STK_vol[i];   //先減舊=1,再加新=21
    avg_Vol[i]=sum/num;  //第2個平均成交量avg_Vol[]=21
  }
  // 6.成交量上限(Volume Cap)
  // 7.Money Flow價格變動. MF[t]=TP[t]-TP[t-1]
  // 8.Volume Flow（VF）
  let Vol_Coefficient=2.5;
  let Vol_Cap;         //成交量上限(Volume Cap)
  const Vol_star=[];   //Actual transaction volume實際使用成交量,=20 to 2000
  let MoneyFlow;       //MF[t]=TP[t]-TP[t-1]
  const Vol_Flow=[];   //=21 to 2000
  for(let i=num+1; i<STK_close.length; i++) { //i=21(num+1) to 2000
    Vol_Cap=avg_Vol[i]*Vol_Coefficient;
    Vol_star[i]=Math.min(STK_vol[i], Vol_Cap);
    MoneyFlow=TypicalPrice[i]-TypicalPrice[i-1];   //例如:[20]-[19]
    if(MoneyFlow>Cut_off[i]) {
      Vol_Flow[i]=(+1)*Vol_star[i]; }
    else if(MoneyFlow < -Cut_off[i]) {
      Vol_Flow[i]=(-1)*Vol_star[i]; }
    else {
      Vol_Flow[i]=0;
    }
  }
  // 9.VFI 主公式(Main VFI Formula), //=40(num+num) to 2000
  const VolFlowIndicator=[];   //=40(num+num) to 2000
  sum=0;
  //Vol_Flow=[]=40(num+num) to 2000
  for(let i=num+1; i<num+num; i++) { //i=21 to 40
    sum=sum+Vol_Flow[i];
  }
  VolFlowIndicator[num+num]=sum/avg_Vol[num+num];  //first value=[40]=[num+num]
  //計算其餘的值,=41,42,...,2000
  for(let i=2*num+1; i<STK_close.length; i++) {  //i=41 to 2000
    sum=sum-Vol_Flow[i-num]+Vol_Flow[i] ;  //先減舊=21,再加新=41
    VolFlowIndicator[i]=sum/avg_Vol[i];    //second=[41]
  }
  // 10.平滑版VFI(Smoothed VFI), MM=3
  const eVolFlowIndicator=[];   //[]=40 to 2000
  let MM=3;
  eVolFlowIndicator[2*num]=VolFlowIndicator[2*num];  //first value
  for(let i=2*num+1; i<STK_close.length; i++) {  //i=41 to 2000
    eVolFlowIndicator[i]=(MM-1)/MM*eVolFlowIndicator[i-1]+1/MM*VolFlowIndicator[i];
    //Wilder Smoothed MA
  }
  return { VolFlowIndicator, eVolFlowIndicator };  
  // Drawing these two figures in the small windows.
  // VolFlowIndicator[], eVolFlowIndicator[]=40,...,2000. // <i.e. num=20.>
}
window.VolumeFlowIndicator = VolumeFlowIndicator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-09====================================
//Fractal Dimension Index(FDI,分形維度指數)  <No.76>
//是用來衡量市場價格走勢是偏向「趨勢(Trend)」還是「隨機(Random)」的一種技術指標。
// 其理論基礎來自於 Benoit Mandelbrot 的分形幾何(Fractal Geometry)
//指數平滑移動平均的參數:exponential smoothing parameter(esp=num)
function FractalDimensionIndex(STK_high, STK_low, STK_close, num) {
  // Menu Name: Fractal Dim     // num=20, 30, ...
  // 1.Calculate Typical Price典型價格, 以此替代收盤價.
  const TypicalPrice = [];  //1 to 2000. =TP
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i] = (STK_high[i] + STK_low[i] + 2 * STK_close[i]) / 4;
  }
  // 2.求價格區間
  // 3.計算價格路徑長度Length
  // 4.計算分形維度Fractal Dimension Index (FDI)
  const FDI=[];
  let Range;  // Range=max(TP)-min(TP)
  let Length;
  let max_TP, min_TP;
  for(let i=num; i<=STK_close.length; i++) {  //i=20(num) to 2000
    Length=0;
    max_TP=TypicalPrice[i-num+1];    //let first=max
    min_TP=TypicalPrice[i-num+1];    //let first=min
    for(let j=i-num+2; j<=i; j++) {  //j=2 to 20
      if(TypicalPrice[j]>max_TP) {   //find the max
         max_TP=TypicalPrice[j];
      }
      if(TypicalPrice[j]<min_TP) {   //find the min
         min_TP=TypicalPrice[j];
      }
      Length=Length+Math.abs(TypicalPrice[j]-TypicalPrice[j-1]);
    }
    Range=max_TP-min_TP;
    FDI[i]=1+Math.log(Length/Range)/Math.log(2*(num-1));  //20(num) to 2000
  }  
  return { FDI };  
  // Drawing FDI[] figures in the small windows.
  // if num=20, FDI[]=20,...,2000.
}
window.FractalDimensionIndex = FractalDimensionIndex;

//===designed by Prof Wang, 2026-June-10====================
//Efficiency Ratio效率比率.將給定時間段內的收盤價變動除以該時間段內所有單筆價格變動的總和.
//是：「Adaptive Moving Average(Adaptive MA)自適應移動平均線」的前半段程式。
//計算效率比率(Efficiency Ratio, ER)，ER衡量價格變動的效率，計算方法為：
//ER=(當前價格-N期前價格)/(N期內的價格波動總和)，其中N是一個預定的時間週期。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function EfficiencyRatio(STK_high, STK_low, STK_close, day, esp) {
  // Menu Name: Efficiency Ratio     // day=10, 20,... // esp=9,10,...
  // Calculate Price[]=(H+L+2*C)/4
  const Price = [];   //Price[]=1,...,2000
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    Price[i] = (STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  // 計算效率比率(Efficiency Ratio, ER)
  const ER=[], eER=[];    //ER[],eER[]=11,...,2000=day+1 to 2000
  let PriceChange;        //P11-P1=當前價格-N期前價格
  let Volatility;         //分母=N期內的價格波動總和
  for(let i=day+1; i<=STK_close.length; i++) { //i=11 to 2000
    PriceChange = Math.abs(Price[i]-Price[i-day]); //P11-P1=當前價格-N期前價格
    Volatility = 0;  //分母=N期內的價格波動總和
    for(let j=i-day+1; j<=i; j++) {  //j=2 to 11
      Volatility += Math.abs(Price[j]-Price[j-1]);
    }
    ER[i] = PriceChange/Volatility;  //ER[]=11 to 2000 
    if(i===day+1) {    //i=11
      eER[i]=ER[i]; }  //first eER[11]
    else {
      eER[i]=(esp-1)/(esp+1)*eER[i-1]+2/(esp+1)*ER[i];  //自創新
    }
  }
  return { ER, eER };
  // drwing ER[], eER[] figures in the small windows.
  // if day=10, ER[], eER[]=11,12,...,2000.
}
window.EfficiencyRatio = EfficiencyRatio;  
//將EfficiencyRatio函數掛載到全局window對象上，使其在其他地方可用
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-10====================
//「移動平均效率比率」MA Efficiency Ratio(MAER),本人仿自Efficiency Ratio效率比率修改，
//此指標以MAt取代Pt,而MA則以Price[]=(H+L+2*C)/4取代收盤價.
//計算效率比率(Efficiency Ratio, ER)，ER衡量價格變動的效率，計算方法為：
//原來：ER=(當前價格-N期前價格)/(N期內的價格波動總和)，其中N是一個預定的時間週期。
//創新：MA_ER=(當前MA-N期前MA)/(N期內的MA波動總和)，其中N是一個預定的時間週期。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function MAEfficiencyRatio(STK_high, STK_low, STK_close, MA_day, ER_day) {
  // Menu Name: MA Efficiency Ratio   // MA_day=10, 20,... ER_day=10,15,20,...
  // Calculate Price[]=(H+L+2*C)/4
  const Price = [];   //Price[]=1,...,2000
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    Price[i] = (STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  //Calculate MA[], 以Price=(H+L+2*C)/4取代收盤價計算MA.
  let sum=0;
  const MA=[];    //=10(MA_day) to 2000
  for(let i=1; i<=MA_day; i++) {  //i=1 to 10
    sum=sum+Price[i];
  }
  MA[MA_day]=sum/MA_day;   //first MA[10]
  //Valculate the rest MA[]=11(MA_day+1) to 2000
  for(let i=MA_day+1; i<=STK_close.length; i++) {  //i=11 to 2000
    sum=sum-Price[i-MA_day]+Price[i];  //減舊加新
    MA[i]=sum/MA_day;   //second MA[11]
  }
  // Calculate「移動平均效率比率」(MA Efficiency Ratio, MA_ER)
  let esp=9;  //指數平滑移動平均的參數:exponential smoothing parameter(esp)
  const MA_ER=[], eMA_ER=[];  //MA_ER[],eMA_ER[]=11,...,2000=day+1 to 2000
  let MA_Change;        //P11-P1=當前MA(價格)-N期前MA(價格)
  let Volatility;       //分母=N期內的MA(價格)波動總和
  for(let i=MA_day+ER_day; i<=STK_close.length; i++) { //i=(10+12) to 2000
    MA_Change = Math.abs(MA[i]-MA[i-ER_day]); //MA22-MA10=當前MA(價格)-N期前MA(價格)
    Volatility = 0;  //分母=N期內的MA(價格)波動總和
    for(let j=i-ER_day+1; j<=i; j++) {  //j=11 to 22(10+12). MA_day=10, ER_day=12
      Volatility += Math.abs(MA[j]-MA[j-1]);
    }
    MA_ER[i] = MA_Change/Volatility;  //ER[]=22 to 2000 
    if(i===MA_day+ER_day) {  //i=22
      eMA_ER[i]=MA_ER[i]; }  //first eMA_ER[22]
    else {
      eMA_ER[i]=(esp-1)/(esp+1)*eMA_ER[i-1]+2/(esp+1)*MA_ER[i];  //自創新
    }
  }
  return { MA_ER, eMA_ER };
  // drwing MA_ER[], eMA_ER[] figures in the small windows.
  // if day=10, MA_ER[], eMA_ER[]=11,12,...,2000.
}
window.MAEfficiencyRatio = MAEfficiencyRatio;  
//將MAEfficiencyRatio函數掛載到全局window對象上，使其在其他地方可用
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-10=========================
//Percentage Price Oscillator(PPO)百分比價格擺動指標。
// 與右相似：OSCP(Price Oscillator,價格擺動指標)
//OSCP今=(短期MA今－長期MA今)/短期MA今*100%
//PPO今=(短期EMA今－長期EMA今)/長期EMA今*100%
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
function PctPriceOSC(STK_close, short_day, long_day) {
  //Menu Name: Pct Price Osc    // esp=9 
  let esp=9;
  const PPO=[], ePPO=[];
  if(short_day > long_day) {  //例如: 10>5, 將二者對調,確保short_day比較小。
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
  }
  //Calculate shortEMA[] ================================
  const shortEMA =[];   //=10 to 2000
  //First EMA value is SMA
  let sum=0;
  for(let i=1; i<=short_day; i++) {     //例如: i=1 to 10
    sum=sum+STK_close[i]; 
  }
  shortEMA[short_day]=sum/short_day;    //shortEMA(10)=sum/10
  //Subsequent shortEMA[]
  for(let i=short_day+1; i<=STK_close.length; i++) {  //i=11 to 2000
    shortEMA[i]=(short_day-1)/(short_day+1)*shortEMA[i-1]+2/(short_day+1)*STK_close[i];
    //EMA今=(n-1)/(n+1)*EMA昨+2/(n+1)*MA今
  }
//Calculate longEMA[] ================================
  const longEMA=[];    //=20 to 2000
  // const PPO=[];        //=20 to 2000,百分比價格擺動指標
  // const ePPO=[];       //=20 to 2000,ePPO[]=Signal[]
  const Histogram=[];  //柱狀圖=PPO[]-ePPO[]=PPO[]-Signal[]
  //First EMA value is SMA
  sum=0;
  for(let i=1; i<=long_day; i++) {     //例如: i=1 to 20
    sum=sum+STK_close[i]; 
  }
  longEMA[long_day]=sum/long_day;    //longEMA(20)=sum/20
  PPO[long_day]=(shortEMA[long_day]-longEMA[long_day])/longEMA[long_day]*100;
  ePPO[long_day]=PPO[long_day];      //first ePPO[]=Signal[]
  //Subsequent longEMA[]
  for(let i=long_day+1; i<=STK_close.length; i++) {  //i=21 to 2000
    longEMA[i]=(long_day-1)/(long_day+1)*longEMA[i-1]+2/(long_day+1)*STK_close[i];
    PPO[i]=(shortEMA[i]-longEMA[i])/longEMA[i]*100;
    ePPO[i]=(esp-1)/(esp+1)*ePPO[i-1]+2/(esp+1)*PPO[i];  //ePPO[]=Signal[]
    Histogram[i]=PPO[i]-ePPO[i]; //Histogram(柱狀圖)=PPO[]-ePPO[]=PPO[]-Signal[]
  }
  return { PPO, ePPO } ;
  //drawing the PPO[] and ePPO[] figures in the small windows.
  //if long_day=20 then PPO[], ePPO[]=20,21,...,2000.
}
window.PctPriceOSC = PctPriceOSC;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-11=========================
//Accumulation Distribution Line(ADL) (累積/派發線)是由
// Marc Chaikin提出的成交量指標，用來衡量資金流入(Accumulation)與流出(Distribution)的強弱。
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
function AccuDistLine(STK_high, STK_low, STK_close, STK_vol, esp) {
  //Menu Name: AccuDistLine     // esp=9,10,...
  //Money Flow Multiplier(MFM)=(2C-H-L)/(H-L)
  //Money Flow Volume(MFV)=MFM*Vol
  //Accumulation Distribution Line(ADL)=ADL為MFV的累積和
  let MoneyFlowVol;  //Money Flow Volume(MFV)=MFM*Vol
  const AccuDistLine=[];
  const eAccuDistLine=[];  //自創新
  AccuDistLine[1]=0;   //initial value=0
  eAccuDistLine[1]=AccuDistLine[1];
  for(let i=2; i<=STK_close.length; i++) {  //i=2 to 2000
    if(STK_high[i]===STK_low[i]) {
      MoneyFlowVol=STK_vol[i]; }
    else {
      MoneyFlowVol=(2*STK_close[i]-STK_high[i]-STK_low[i])/(STK_high[i]-STK_low[i])*STK_vol[i];
    }
    AccuDistLine[i]=AccuDistLine[i-1]+MoneyFlowVol;
    eAccuDistLine[i]=(esp-1)/(esp+1)*eAccuDistLine[i-1]+2/(esp+1)*AccuDistLine[i];
  }
  return { AccuDistLine, eAccuDistLine } ;
  //drawing the AccuDistLine[] and eAccuDistLine[] figures in the small windows.
  //AccuDistLine[], eAccuDistLine[]=1,2...,2000.
}
window.AccuDistLine = AccuDistLine;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-14===在廈門參加兩岸論壇======
//Rainbow Moving Average是由連續多次平滑的SMA(Simple Moving Average)組成.
//將多條不同平滑程度的移動平均線疊加，形成如彩虹般的帶狀結構.
//首先定義n期簡單移動平均,本例第二層之後採用EMA計算.
//中心Rainbow MA將最終 Rainbow MA 定義為所有層平均.
//指數平滑移動平均的參數: exponential smoothing parameter(num=esp)
function RainbowMA(STK_high, STK_low, STK_close, num) {
  //Menu Name: Rainbow MA     // num=esp=9,10,...
  //基本移動平均SMA
  const SMA1=[];  //基本移動平均SMA,第1條MA
  const SMA2=[];   const SMA3=[];
  const SMA4=[];   const SMA5=[];
  const RMA=[];   //中心Rainbow MA=所有層平均
  let sum=0;
  let Price=0;
  for(let i=1; i<=num; i++) {  //i=1 to 10(num)
    sum=sum+(STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  SMA1[num]=sum/num;  //first Simple MA=SMA1[10]
  SMA2[num]=sum/num; SMA3[num]=sum/num; 
  SMA4[num]=sum/num; SMA5[num]=sum/num; 
  RMA[num]=sum/num;
  for(let i=num+1; i<=STK_close.length; i++) {  //i=11 to 2000
    Price=(STK_high[i-num]+STK_low[i-num]+2*STK_close[i-num])/4;  //舊的
    sum=sum-Price;    //先減舊的
    Price=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;  //新的
    sum=sum+Price;    //再加新的
    SMA1[i]=sum/num;  //second=SMA[11]
    SMA2[i]=(num-1)/(num+1)*SMA2[i-1]+2/(num+1)*SMA1[i];
    SMA3[i]=(num-1)/(num+1)*SMA3[i-1]+2/(num+1)*SMA2[i];
    SMA4[i]=(num-1)/(num+1)*SMA4[i-1]+2/(num+1)*SMA3[i];
    SMA5[i]=(num-1)/(num+1)*SMA5[i-1]+2/(num+1)*SMA4[i];
    RMA[i]=(SMA1[i]+SMA2[i]+SMA3[i]+SMA4[i]+SMA5[i])/5; //中心Rainbow MA=所有層平均
  }
  return { SMA1, SMA2, SMA3, SMA4, SMA5, RMA } ;
  //drawing these six figures in the K_Line area.
  //if num=10 then SMA1[],...,SMA5[], RMA[]=10,11...,2000.
}
window.RainbowMA = RainbowMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-15===在廈門參加兩岸論壇======
//Guppy Multiple Moving Average是由澳洲交易員兼分析師 Daryl Guppy所提出的一種趨勢分析方法
//GMMA本質上是由12條指數移動平均線(EMA)組成，這是與Rainbow Moving Average之差異.
//Rainbow Moving Average是由連續多次平滑的SMA(Simple Moving Average)組成.
//以此指標Guppy Multiple Moving Average取代Moving Average Ribbon！
//指數平滑移動平均的參數: exponential smoothing parameter(num=esp)
function GuppyMA(STK_high, STK_low, STK_close, num) {
  //Menu Name: Guppy MA     // num=esp=5,...
  //基本移動平均SMA,之後採用指數移動平均線(EMA)
  const EMA1=[];  //基本移動平均SMA,第1條MA
  const EMA2=[];  const EMA3=[];  const EMA4=[];  const EMA5=[]; 
  const EMA6=[];  const EMA7=[];  const EMA8=[];  const EMA9=[];
  const EMA10=[];
  const short_EMA=[]; const long_EMA=[];  //短期群組平均, //長期群組平均
  const Spread=[];   //群組間距, (short_EMA[]-long_EMA[])/long_EMA[]*100
  //EMA1[],...EMA5[] =短期交易者群組  //EMA6[],...EMA10[] =長期交易者群組
  //const RMA=[];   //中心Rainbow MA=所有層平均
  let n2,n3,n4,n5,n6,n7,n8,n9,n10;
  let sum=0;
  let Price=0;
  for(let i=1; i<=num; i++) {  //i=1 to 10(num)
    sum=sum+(STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  EMA1[num]=sum/num;  //first Simple MA=EMA1[10]
  EMA2[num]=sum/num; EMA3[num]=sum/num; EMA4[num]=sum/num; EMA5[num]=sum/num; 
  EMA6[num]=sum/num; EMA7[num]=sum/num; EMA8[num]=sum/num; EMA9[num]=sum/num; 
  EMA10[num]=sum/num;
  short_EMA[num]=(EMA1[num]+EMA2[num]+EMA3[num]+EMA4[num]+EMA5[num])/5; //
  long_EMA[num]=(EMA6[num]+EMA7[num]+EMA8[num]+EMA9[num]+EMA10[num])/5; //自創新
  for(let i=num+1; i<=STK_close.length; i++) {  //i=5+1 to 2000
    Price=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;    //新的
    EMA1[i]=(num-1)/(num+1)*EMA1[i-1]+2/(num+1)*Price;  //num=5
    n2=num+3;  //=8
      EMA2[i]=(n2-1)/(n2+1)*EMA2[i-1]+2/(n2+1)*Price;
    n3=n2+2;  //=10
      EMA3[i]=(n3-1)/(n3+1)*EMA3[i-1]+2/(n3+1)*Price;
    n4=n3+2;  //=12
      EMA4[i]=(n4-1)/(n4+1)*EMA4[i-1]+2/(n4+1)*Price;
    n5=n4+3;  //=15
      EMA5[i]=(n5-1)/(n5+1)*EMA5[i-1]+2/(n5+1)*Price;
    n6=num+25;  //=30
      EMA6[i]=(n6-1)/(n6+1)*EMA6[i-1]+2/(n6+1)*Price;
    n7=n6+5;  //=35
      EMA7[i]=(n7-1)/(n7+1)*EMA7[i-1]+2/(n7+1)*Price;
    n8=n7+5;  //=40
      EMA8[i]=(n8-1)/(n8+1)*EMA8[i-1]+2/(n8+1)*Price;
    n9=n8+5;  //=45
      EMA9[i]=(n9-1)/(n9+1)*EMA9[i-1]+2/(n9+1)*Price;
    n10=n9+5  //=50
      EMA10[i]=(n10-1)/(n10+1)*EMA10[i-1]+2/(n10+1)*Price;
    short_EMA[i]=(EMA1[i]+EMA2[i]+EMA3[i]+EMA4[i]+EMA5[i])/5;  //短期交易_平均
    long_EMA[i]=(EMA6[i]+EMA7[i]+EMA8[i]+EMA9[i]+EMA10[i])/5;  //長期交易_平均
    Spread[i]=(short_EMA[i]-long_EMA[i])/long_EMA[i]*100;      //群組間距
  }
  return { EMA1, EMA2, EMA3, EMA4, EMA5, EMA6, EMA7, EMA8, EMA9, EMA10, short_EMA, long_EMA, Spread };
  //drawing Spread[] in the the small windows
  //drawing these 10+2 figures in the K_Line area.
  //if num=5 then EMA1[],...,EMA10[],short_EMA[],long_EMA[] =5,6...,2000.
}
window.GuppyMA = GuppyMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-16========================
//Elder Force Index(EFI,艾德力度指標)是由Alexander Elder提出的技術分析指標，
// 用來衡量市場中多頭或空頭力量的強弱，結合了價格變動與成交量兩項因素。
//EFI=(Ct-Ct-1)/(Ct-1)*Vol，本人修改以Typical Price替代Close
//指數平滑移動平均的參數: exponential smoothing parameter(num=esp)
function ElderForce(STK_high, STK_low, STK_close, STK_vol, esp) {
  //Menu Name: Elder Force Index     // esp=10,...
  const EFI=[];   //Elder Force Index(EFI), =2 to 2000
  const EFI2=[];  //本人修改以Typical Price替代Close
  const eEFI=[];  const eEFI2=[];  //指數平滑移動平均
  let TypicalPrice1=(STK_high[1]+STK_low[1]+2*STK_close[1])/4;
  let TypicalPrice2;
  for(let i=2; i<=STK_close.length; i++) {    //i=2 to 2000
    TypicalPrice2=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;
    EFI[i]=(STK_close[i]-STK_close[i-1])*STK_vol[i];
    EFI2[i]=(TypicalPrice2-TypicalPrice1)*STK_vol[i]; //今-昨
    TypicalPrice1=TypicalPrice2;
    if(i===2){
      eEFI[i]=EFI[i];
      eEFI2[i]=EFI2[i]; }
    else {
      eEFI[i]=(esp-1)/(esp+1)*eEFI[i-1]+2/(esp+1)*EFI[i];
      eEFI2[i]=(esp-1)/(esp+1)*eEFI2[i-1]+2/(esp+1)*EFI2[i];
    }
  }
  return { EFI, eEFI, EFI2, eEFI2};
  //drawing these figures in the small windows.
  //EFI[], eEFI[], EFI2[], eEFI2[]=2,3...,2000.
}
window.ElderForce = ElderForce;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-16=============完全創新=====
//Elder Force Index(EFI,艾德力度指標)是由Alexander Elder提出的技術分析指標，
// 用來衡量市場中多頭或空頭力量的強弱，結合了價格變動與成交量兩項因素。
//EFI=(Ct-Ct-1)/(Ct-1)*Vol，本人修改以Typical Price替代Close。完全創新
//指數平滑移動平均的參數: exponential smoothing parameter(num=esp)
function NewElderForce(STK_high, STK_low, STK_close, STK_vol, esp) {
  //Menu Name: New Elder Force     // esp=10,...
  const NewEFI=[];   //Elder Force Index(EFI), =2 to 2000
  const NewEFI2=[];  //本人修改以Typical Price替代Close
  const eNewEFI=[];  const eNewEFI2=[];  //指數平滑移動平均
  let TypicalPrice1=(STK_high[1]+STK_low[1]+2*STK_close[1])/4;
  let TypicalPrice2;
  for(let i=2; i<=STK_close.length; i++) {    //i=2 to 2000
    TypicalPrice2=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;  //今
    NewEFI[i]=(STK_close[i]-STK_close[i-1])/STK_close[i-1]*STK_vol[i];
    NewEFI2[i]=(TypicalPrice2-TypicalPrice1)/TypicalPrice1*STK_vol[i]; //今-昨
    TypicalPrice1=TypicalPrice2;
    if(i===2){
      eNewEFI[i]=NewEFI[i];
      eNewEFI2[i]=NewEFI2[i]; }
    else {
      eNewEFI[i]=(esp-1)/(esp+1)*eNewEFI[i-1]+2/(esp+1)*NewEFI[i];
      eNewEFI2[i]=(esp-1)/(esp+1)*eNewEFI2[i-1]+2/(esp+1)*NewEFI2[i];
    }
  }
  return { NewEFI, eNewEFI, NewEFI2, eNewEFI2};
  //drawing these figures in the small windows.
  //NewEFI[], eNewEFI[], NewEFI2[], eNewEFI2[]=2,3...,2000.
}
window.NewElderForce = NewElderForce;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-17=================================
//Elder Impulse System(艾德脈衝系統)是由Alexander Elder提出的交易系統，
// 用來結合趨勢方向(Trend)與動能變化(Momentum)
// 12,26日指數移動平均線(EMA), MACD=EMA(12)-EMA(26), Signal=EMA(MACD,9)
// Histogram=H=MACD-Signal, EMA斜率=EMA(t)-EMA(t-1), Histogram斜率=H(t)-H(t-1)
function ElderImpulse(STK_high, STK_low, STK_close, n12, n26, n9) {
  //Menu Name: Elder Impulse   //n12=12, n26=26, n9=9
  let temp;
  if(n26<n12) {                   //JavaScript指令：[n12, n26]=[n26, n12]
    temp=n26; n26=n12; n12=temp;  //ensure n26>n12
  }
  //Calculate 12(26)-period EMA of Typical Price(=DI=close price)
  const EMA12=[]; const EMA26=[];    // =1 to 2000.
  const MACD=[];     // MACD[]=EMA12[]-EMA26[], =1 to 2000.
  const Signal=[];   // Signal[]=EMA(MACD,9), =1 to 2000.
  const Histogram=[] // Histogram[]=MACD[]-Signal[], =1 to 2000.
  let Color="";
  let TypicalPrice=(STK_high[1]+STK_low[1]+2*STK_close[1])/4;  //Demand Index(DI)
  EMA12[1]=TypicalPrice;          // EMA12初值
  EMA26[1]=TypicalPrice;          // EMA26初值
  MACD[1]=EMA12[1]-EMA26[1];      // MACD初值, MACD Line
  Signal[1]=MACD[1];              // Signal初值, Signal Line
  Histogram[i]=MACD[1]-Signal[1]; // Histogram初值,
  for(let i=2; i<=K_close.length; i++) {   // i=2 to 2000
    TypicalPrice=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;
    EMA12[i]=(n12-1)/(n12+1)*EMA12[i-1]+2/(n12+1)*TypicalPrice;
    EMA26[i]=(n26-1)/(n26+1)*EMA26[i-1]+2/(n26+1)*TypicalPrice;
    MACD[i]=EMA12[i]-EMA26[i];          //2條EMA的差值
    Signal[i]=(n9-1)/(n9+1)*Signal[i-1]+2/(n9+1)*MACD[i];  //Signal Line
    Histogram[i]=MACD[i]-Signal[i];    //直方圖=柱狀圖
    if(i>=3) {
      if(EMA26[i]>EMA[i-1] || Histogram[i]>Histogram[i-1]) {
        Color="Green" }   //綠色,Bullish Impulse,表示趨勢與動能同時上升
      else if(EMA26[i]<EMA[i-1] || Histogram[i]<Histogram[i-1]) {
        Color="Red" }     //紅色,Bearish Impulse,表示趨勢與動能同時下降
      else {
        Color="Blue"      //藍色,Neutral Impulse,其餘所有情況
      }
    }
  }
  return { MACD, Signal };
  //drawing the MACD[] and Signal[] figures in the small windows.
  //=1,2,...,2000. 要如何顯示 Color 變數內容??
}
window.ElderImpulse = ElderImpulse;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Jan-19=================================
//Moving Average(Simple Moving Average),新設計MA,取名KingMA
function KingMA(values, ma_day) { 
  //ma_day=5,10,20 etc. values is an array of closing prices
  const MA = [];  //MA[]=10,11,...,2000
  let sum=0;
  for(let i=1; i<=ma_day; i++) {      // Calculate first MA value
    sum += values[i];                 // Sum of first Ma_day values
  }
  //first MA is MA(ma_day), for example MA(10) is the first 10 days average
  MA[ma_day]=sum/ma_day;    //first MA(10). if ma_day=10
  //Start from ma_day+1 day to the end of the record, for example i=11 to 2000
  for(let i=ma_day+1; i<=values.length; i++) {    //i=11 to 2000
     //MA(i)==(MA(i-1)*ma_day-values[i-ma_day-1]+values[i-1])/ma_day;  //錯誤
     sum=sum-values[i-ma_day]+values[i];   //先減前10天的值,再加今天的值
     MA[i]=sum/ma_day;
  }
  return MA;
  //Drawing the MA[] figure in the K_Line area.
  //if ma_day=10, then MA[]=10,11,...,2000
}
window.KingMA = KingMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-Feb-01====modified on 2026-June-20===
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//只繪圖KD指標的K、D線。KD_K[]、KD_D[]。
//esp=9,指數平滑移動平均參數exponential smoothing parameter(esp)
function KingKD_K(K_high, K_low, K_close, KD_day) {
  // Menu Name: KD_KD        //原創：KD_day=9, esp=9,10,...
  //K_high=STK_high, K_low=STK_low, K_close=STK_close
  const KD_K=[], KD_D=[];
  for(let i=KD_day; i<=K_close.length; i++) {   // i=9 to 2000
    let maxHigh=K_high[i-KD_day+1];   //令第一筆K_high[1]為最大
    let minLow=K_low[i-KD_day+1];     //令第一筆K_low[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, K_high[j]);
      minLow = Math.min(minLow, K_low[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((K_close[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, KD初值
      KD_K[i] = 50;
      KD_D[i] = 50; }
      //KD_K2[i] = 50;      //i=9, KD_K2初值
      //KD_D2[i] = 50; }    //i=9, KD_D2初值
    else {
      KD_K[i] = (2/3)*KD_K[i-1] + (1/3)*rsv;       //第一筆KD_K[9]
      KD_D[i] = (2/3)*KD_D[i-1] + (1/3)*KD_K[i];   //第一筆KD_D[9]
      //KD_K2[i]=(esp-1)/(esp+1)*KD_K2[i-1] +2/(esp+1)*KD_K[i];
      //KD_D2[i]=(esp-1)/(esp+1)*KD_D2[i-1] +2/(esp+1)*KD_D[i];
    }
  }
  return { KD_K };   //只傳回KD中的K[]陣列
  //return { KD_K, KD_D };
  //drawing the KD_K[] and KD_D[] figures in the small windows.
  //if KD_day=9, KD_K[], KD_D[]=9,10,...,2000.
}
window.KingKD_K = KingKD_K;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-20==========================
//Zero-Lag Stochastics  (No.64)
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//指數平滑移動平均參數exponential smoothing parameter(esp)
function ZeroLagStochastics(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: Zero Lag Stochastics  //原創：KD_day=9, esp=9,10,...
  // 1_Calculate K1[], if KD_day=9, K1[]=9 to 2000
  const K1 = KingKD_K(K_high, K_low, K_close, KD_day);
  // Calculate exponential MA
  const SK1=[];  // KD_day=9 to 2000
  SK1[KD_day]=K1[KD_day];  //first SK1[9]=k1[9]
  for(let i=KD_day+1; i<=K_close.length; i++) {  //i=9+1 to 2000
    SK1[i]=(esp-1)/(esp+1)*SK1[i-1]+2/(esp+1)*K1[i];
  }
  // 2_Calculate K2[], if KD_day=9, K2[]=9+4 to 2000
  let Gap=4;
  let num=KD_day+Gap*1;  // num=9+4=13
  const K2 = KingKD_K(K_high, K_low, K_close, num);
  const SK2=[];      // KD_day=9+4 to 2000
  SK2[num]=K2[num];  // first SK2[9+4]=k2[9+4]
  for(let i=num+1; i<=K_close.length; i++) {  //i=9+8+1 to 2000
    SK2[i]=(esp-1)/(esp+1)*SK2[i-1]+2/(esp+1)*K2[i];
  }
  // 3_Calculate K3[], if KD_day=9, K3[]=9 to 2000
  num=KD_day+Gap*2;  // num=9+8=17
  const K3 = KingKD_K(K_high, K_low, K_close, num);;
  const SK3=[];      // KD_day=9+8 to 2000
  SK3[num]=K3[num];  // first SK3[9+8]=k3[9+8]
  for(let i=num+1; i<=K_close.length; i++) {  //i=9+8+1 to 2000
    SK3[i]=(esp-1)/(esp+1)*SK3[i-1]+2/(esp+1)*K3[i];
  }
  // 4_Calculate K4[], if KD_day=9, K4[]=9 to 2000
  num=KD_day+Gap*3;  // num=9+12=21
  const K4 = KingKD_K(K_high, K_low, K_close, num);;
  const SK4=[];      // KD_day=9+12 to 2000
  SK4[num]=K4[num];  // first SK4[9+12]=k3[9+12]
  for(let i=num+1; i<=K_close.length; i++) {  //i=9+12+1 to 2000
    SK4[i]=(esp-1)/(esp+1)*SK4[i-1]+2/(esp+1)*K4[i];
  }
  // 5_Calculate K5[], if KD_day=9, K5[]=9 to 2000
  num=KD_day+Gap*4;  // num=9+16=25
  const K5 = KingKD_K(K_high, K_low, K_close, num);
  const SK5=[];      // KD_day=9+16 to 2000
  SK5[num]=K5[num];  // first SK5[9+16]=k3[9+16]
  for(let i=num+1; i<=K_close.length; i++) {  //i=9+16+1 to 2000
    SK5[i]=(esp-1)/(esp+1)*SK5[i-1]+2/(esp+1)*K5[i];
  }
  // 6_Calculate final K=(5*SK1+4*3*SK2+SK3+2*SK4+1*SK5)/Sum(5 to 1)
  const finalK=[];  // KD_day=9 to 2000
  // i=9 to 12  //只有SK1[]一個值
  for(let i=KD_day; i<=KD_day+Gap-1; i++) {  //i=9 to 12(=9+4-1)
    finalK[i]=SK1[i];  //只有SK1[]一個值.  i=9 to 12
  }
  // i=13 to 16  //SK1[]*2+SK2[]*1 , 二個值
  for(let i=KD_day+Gap; i<=KD_day+2*Gap-1; i++) { //i=13 to 16(9+2*4-1)
    finalK[i]=(SK1[i]*2+SK2[i])/(2+1);  //weight=2 and 1
  }
  // i=17 to 20  //SK1[]*3+SK2[]*2+SK3[]*1 , 三個值
  for(let i=KD_day+2*Gap; i<=KD_day+3*Gap-1; i++) { //i=17 to 20(9+3*4-1)
    finalK[i]=(SK1[i]*3+SK2[i]*2+SK3[i]*1)/(3+2+1);  //weight=3,2,1
  }
  // i=21 to 24  //SK1[]*4+SK2[]*3+SK3[]*2+SK4[]*1, 四個值
  for(let i=KD_day+3*Gap; i<=KD_day+4*Gap-1; i++) { //i=21 to 24(9+4*4-1)
    finalK[i]=(SK1[i]*4+SK2[i]*3+SK3[i]*2+SK4[i]*1)/(4+3+2+1);  //weight=4,3,2,1
  }
  // i=25 to 2000  //SK1[]*5+SK2[]*4+SK3[]*3+SK4[]*2+SK5[]*1, 五個值
  for(let i=KD_day+4*Gap; i<=K_close.length; i++) { //i=25 to 2000
    finalK[i]=(SK1[i]*5+SK2[i]*4+SK3[i]*3+SK4[i]*2+SK5[i])/(5+4+3+2+1);  //weight=5,4,3,2,1
  }
  // Calculate D線是對計算出來的零滯後K值進行指數移動平均(EMA)平滑處理
  const finalD=[];  // KD_day=9 to 2000
  finalD[KD_day]=finalK[KD_day];  //initial value finalD[9], KD_day=9
  for(let i=KD_day+1; i<=K_close.length; i++) { //i=10 to 2000
    finalD[i]=(esp-1)/esp*finalD[i-1]+1/esp*finalK[i];  //Wilder EMA
  }
  return { finalK, finalD };
  //drawing the finalK[] and finalD[] figures in the small windows.
  //if KD_day=9, finalK[], finalD[]=9,10,...,2000.
}
window.ZeroLagStochastics = ZeroLagStochastics;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-20=======創新取名=======
//創新取名Zero-Lag KD Indicator.
//參考下列指標修改：「64. Zero-Lag Stochastics」,2026-06-20
//Typical Price 替代H,L,C,做為創新的指標
//KD隨機指標(Stochastic Indicator)。  0<=K,D<=100.
//指數平滑移動平均參數exponential smoothing parameter(esp)
function ZeroLag_KD(K_high, K_low, K_close, KD_day, esp) {
  // Menu Name: Zero Lag KD      //KD_day=9, esp=9,10,...
  //K_high=STK_high, K_low=STK_low, K_close=STK_close
  //Calculate TP[]=Typical Price,替代H,L,C,做為創新的指標
  const TP=[];  //=1 to 2000
  for(let i=1; i<=K_close.length; i++) {  //i=1 to 2000
    TP[i]=(K_high[i]+K_low[i]+2*K_close[i])/4;
  }
  //Calculate fast_K[], ema1_K[]=EMA(fast_K,esp),ema2_K[]=EMA(ema1_K,esp)
  //ZeroLag_K[]
  const fast_K=[];  //首先計算Fast %K. // KD_day=9 to 2000
  const ema1_K=[];  //對fast_K[]做EMA, // KD_day=9 to 2000
  const ema2_K=[];  //對ema1_K[]做EMA, // KD_day=9 to 2000
  const ZeroLag_K=[]; //=2*EMA1-EMA2.  // KD_day=9 to 2000
  for(let i=KD_day; i<=K_close.length; i++) {   // i=9 to 2000
    let maxHigh=TP[i-KD_day+1];    //令第一筆TP[1]為最大
    let minLow=TP[i-KD_day+1];     //令第一筆TP[1]為最小
    for(let j=i-KD_day+2; j<=i; j++) {         // j=2 to 9
      maxHigh = Math.max(maxHigh, TP[j]);
      minLow = Math.min(minLow, TP[j]);
    }
    let rsv;
    if(maxHigh === minLow) {
      rsv = 100; } 
    else {
      rsv=((TP[i]-minLow)/(maxHigh-minLow))*100;
    }
    if(i === KD_day) {   //i=9, fast_K初值
      fast_K[i] = 50;
      ema1_K[i]=fast_K[i];  //first EMA(fast_K, esp)
      ema2_K[i]=ema1_K[i];  //first EMA(ema1_K, esp)
      ZeroLag_K[i]=2*ema1_K[i]-ema2_K[i]; }  //first =2*EMA1-EMA2
    else {
      fast_K[i]=(2/3)*fast_K[i-1] + (1/3)*rsv; //第1筆fast_K[9]
      ema1_K[i]=(esp-1)/(esp+1)*ema1_K[i-1]+2/(esp+1)*fast_K[i];
      ema2_K[i]=(esp-1)/(esp+1)*ema2_K[i-1]+2/(esp+1)*ema1_K[i];
      ZeroLag_K[i]=2*ema1_K[i]-ema2_K[i];
    }
  }
  //Calculate ZeroLag_D[]=2EMA(ZeroLag_K)-EMA(EMA(ZeroLag_K)). = 9 to 2000
  const ZeroLag_D=[];   //KD_day=9  to 2000
  const ema3=[];  //=EMA(ZeroLag_K, esp). //KD_day=9  to 2000
  const ema4=[];  //=EMA(ema3, esp).      //KD_day=9  to 2000
  for(let i=KD_day; i<=K_close.length; i++) {   // i=9 to 2000
    if(i === KD_day) {
      ema3[i]=ZeroLag_K[i];  //first value
      ema4[i]=ema3[i];       //first value
      ZeroLag_D[i]=2*ema3[i]-ema4[i]; }
    else {
      ema3[i]=(esp-1)/(esp+1)*ema3[i-1]+2/(esp+1)*ZeroLag_K[i];
      ema4[i]=(esp-1)/(esp+1)*ema4[i-1]+2/(esp+1)*ema3[i];
      ZeroLag_D[i]=2*ema3[i]-ema4[i];
    }
  }
  return { ZeroLag_K, ZeroLag_D };
  //drawing the ZeroLag_K[] and ZeroLag_D[] figures in the small windows.
  //if KD_day=9, ZeroLag_K[], ZeroLag_D[]=9,10,...,2000.
}
window.ZeroLag_KD = ZeroLag_KD;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-22===越南旅次===========
//Williams Vix Fix是由 Larry Williams 設計的波動率指標，   (No.62)
// 用來模擬 CBOE Volatility Index (VIX) 
// 在沒有選擇權資料的市場（例如個股、期貨、外匯）中的效果。
//W_VixFix[]=(Hn-Lt)/Hn*100, 
//指數平滑移動平均參數exponential smoothing parameter(esp)
function WilliamsVixFix(K_high, K_low, day_ago, esp) {
  // Menu Name: W_VixFix     //day_ago=20,... esp=9,10,...
  //K_high=STK_high, K_low=STK_low, K_close=STK_close
  //Calculate Williams Vix Fix, 找day_ago天內最大值
  const W_VixFix=[];   // =20 to 2000, if day_ago=20
  const eW_VixFix=[];  // =20 to 2000, if day_ago=20, 自創新
  for(let i=day_ago; i<=K_high.length; i++) {   // i=20 to 2000
    let maxHigh=K_high[i-day_ago+1];      //令第一筆為最大
    for(let j=i-day_ago+2; j<=i; j++) {   // j=2 to 20
      maxHigh = Math.max(maxHigh, K_high[j]);
    }
    W_VixFix[i]=(maxHigh-K_low[i])/maxHigh*100;  //20 to 2000
    //原式=SMA(W_VixFix,esp), 此處改為=EMA(W_VixFix,esp)
    if(i===day_ago) {
      eW_VixFix[i]=W_VixFix[i]; }  // initial value, =[20]
    else {
      eW_VixFix[i]=(esp-1)/(esp+1)*eW_VixFix[i-1]+2/(esp+1)*W_VixFix[i];
    }  
  }
  //Calculate WVF標準差, sigma=sqrt(sum[(WVF-mu)^2]/m)
  const Upper=[], Lower=[];  //上軌,下軌
  let m=10;  //WVF標準差的時間長度= m
  let sum=0;
  let k=2;   //上軌,下軌的倍數
  for(let i=day_ago+m-1; i<=K_high.length; i++) {  //20+10-1=29  to 2000
    sum=0;
    for(let j=i-m+1; j<=i; j++) {   //j=29-10+1=20  to 29
      sum=sum+(W_VixFix[j]-W_VixFix[i])**2;  //sum from 20 to 29
    }
    Sigma=sqrt(sum/m);             //WVF標準差
    Upper[i]=W_VixFix[i]+k*Sigma;  //上軌, = 29 to 2000
    Lower[i]=W_VixFix[i]-k*Sigma;  //下軌, = 29 to 2000
  }
  return { W_VixFix, eW_VixFix, Upper, Lower };
  //drawing these figures in the small windows.
  //if day_ago=20, m=10, W_VixFix[], eW_VixFix[]= 20 to 2000.
  //if day_ago=20, m=10, Upper[],Lower[]= 29 to 2000. //day_ago+m-1=29.
}
window.WilliamsVixFix = WilliamsVixFix;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-22===越南旅次==完全自創新=======
//完全自創新。修改自Williams Vix Fix是由 Larry Williams 設計的波動率指標， (No.62)
// 用來模擬 CBOE Volatility Index (VIX) 
// 在沒有選擇權資料的市場（例如個股、期貨、外匯）中的效果。
//W_VixFix[]=(Hn-Lt)/Hn*100, 用Typical Price替代Hn,Lt
//指數平滑移動平均參數exponential smoothing parameter(esp)
function NewVixFix(K_high, K_low, K_close, day_ago, esp) {
  // Menu Name: New Vix Fix     //day_ago=20,... esp=9,10,...
  //K_high=STK_high, K_low=STK_low, K_close=STK_close
  //Calculate TP[]=Typical Price,替代H,L,C,做為創新的指標
  const TP=[];  //=1 to 2000
  for(let i=1; i<=K_close.length; i++) {  //i=1 to 2000
    TP[i]=(K_high[i]+K_low[i]+2*K_close[i])/4;
  }
  //Calculate New Williams Vix Fix, 找day_ago天內最大值
  const New_VixFix=[];   // =20 to 2000, if day_ago=20
  const eNew_VixFix=[];  // =20 to 2000, if day_ago=20, 自創新
  for(let i=day_ago; i<=K_high.length; i++) {   // i=20 to 2000
    let maxHigh=TP[i-day_ago+1];      //令第一筆為最大
    for(let j=i-day_ago+2; j<=i; j++) {   // j=2 to 20
      maxHigh = Math.max(maxHigh, TP[j]);
    }
    New_VixFix[i]=(maxHigh-TP[i])/maxHigh*100;  //20 to 2000
    //原式=SMA(W_VixFix,esp), 此處改為=EMA(W_VixFix,esp)
    if(i===day_ago) {
      eNew_VixFix[i]=New_VixFix[i]; }  // initial value, =[20]
    else {
      eNew_VixFix[i]=(esp-1)/(esp+1)*eNew_VixFix[i-1]+2/(esp+1)*New_VixFix[i];
    }  
  }
  //Calculate WVF標準差, sigma=sqrt(sum[(WVF-mu)^2]/m)
  const Upper=[], Lower=[];  //上軌,下軌
  let m=10;  //WVF標準差的時間長度= m
  let sum=0;
  let k=2;   //上軌,下軌的倍數
  for(let i=day_ago+m-1; i<=K_high.length; i++) {  //20+10-1=29  to 2000
    sum=0;
    for(let j=i-m+1; j<=i; j++) {   //j=29-10+1=20  to 29
      sum=sum+(New_VixFix[j]-New_VixFix[i])**2;  //sum from 20 to 29
    }
    Sigma=sqrt(sum/m);             //WVF標準差
    Upper[i]=New_VixFix[i]+k*Sigma;  //上軌, = 29 to 2000
    Lower[i]=New_VixFix[i]-k*Sigma;  //下軌, = 29 to 2000
  }
  return { New_VixFix, eNew_VixFix, Upper, Lower };
  //drawing these figures in the small windows.
  //if day_ago=20, m=10, New_VixFix[], eNew_VixFix[]= 20 to 2000.
  //if day_ago=20, m=10, Upper[],Lower[]= 29 to 2000. //day_ago+m-1=29.
}
window.NewVixFix = NewVixFix;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-23===越南旅次==============
//Wave Volume Indicator(WVI)並沒有像RSI、MACD那樣有單一公認的標準公式。
// 不同交易平台或分析師對 WVI 的定義略有不同。   (No.62)
// WVI=sum(+Volume, Ct>Ct-1)+sum(-Volume, Ct<Ct-1)
function WaveVolume(STK_close, STK_vol) {
  // Menu Name: Wave Volume
  //Calculate 累積Wave Volume Indicator
  const WaveVolume=[];  //= 1 to 2000
  WaveVolume[1]=0;      //initial value
  for(let i=2; i<=STK_close.length; i++) {   //i=2 to 2000
    if(STK_close[i]>STK_close[i-1]) {        //上漲
      WaveVolume[i]=WaveVolume[i-1]+STK_vol[i]; }
    else if(STK_close[i]<STK_close[i-1]) {   //下跌
       WaveVolume[i]=WaveVolume[i-1]-STK_vol[i]; }
    else {
      WaveVolume[i]=WaveVolume[i-1]+0;       //平盤
    }
  }
  return { WaveVolume };
  //drawing these figures in the small windows.
  //WaveVolume[]= 1 to 2000.
}
window.WaveVolume = WaveVolume;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-24===越南旅次==============
//Ergodic Oscillator(遍歷振盪器)通常是指由William Blau提出  (No.60)
// 的True Strength Index(TSI)的振盪形式。在許多交易平台
// (如 TC2000、TradingView、MetaStock）中，Ergodic Oscillator 
// 與 TSI 的計算方式相同或極為接近。
function ErgodicOsc(STK_close, STK_vol) {
  // Menu Name: Ergodic Oscillator
  //Calculate Momentum=Ct-Ct-1
  const Mtm=[];     //= 2 to 2000. Mtm=Momentum
  const absMtm=[];  //= 2 to 2000. Mtm=Momentum
  //Momentum的雙重EMA(Double Smoothed Momentum)
  //絕對Momentum的雙重EMA(Double Smoothed Absolute Momentum)
  let Long=25;   //長週期Long cycle=25
  let Short=13;  //短週期Short cycle=13
  let Num=7;     //Ergodic Oscillator通常再加一條EMA訊號線,Signal=EMA(ErgodicOsc,7)
  const EMA1_Mtm=[];     //SingleEMA to Momentum[].    =2 to 2000.
  const EMA1_absMtm=[];  //SingleEMA to absMomentum[]. =2 to 2000.
  const EMA2_Mtm=[];     //DoubleEMA to Momentum[].    =2 to 2000.
  const EMA2_absMtm=[];  //DoubleEMA to absMomentum[]. =2 to 2000.
  const ErgodicOsc=[];   //3.Ergodic Oscillator=EMA2_Mtm/EMA2_absMtm*100
  const Signal=[];       //5.Signal Line(訊號線),Signal=EMA(ErgodicOsc,7)
  const Histogram=[];    //6.Ergodic Histogram(柱狀圖), Histogram=ErgodicOsc-Signal
  for(let i=2; i<=STK_close.length; i++) {   //i=2 to 2000
    Mtm[i]=STK_close[i]-STK_close[i-1];
    absMtm[i]=Math.abs(Mtm[i]);
    if(i===2) {
      EMA1_Mtm[i]=Mtm[i];        //初值=SingleEMA to Mtm
      EMA1_absMtm[i]=absMtm[i];  //初值=SingleEMA to absMtm
      //------Double EMD-----------------------------------
      EMA2_Mtm[i]=EMA1_Mtm[i];          //初值=DoubleEMA to Mtm
      EMA2_absMtm[i]=EMA1_absMtm[i];    //初值=DoubleEMA to absMtm
      //------ErgodicOsc=EMA2_Mtm/EMA2_absMtm*100
      if(EMA2_Mtm[i]===EMA2_absMtm[i]) {  //避免分母=0
        ErgodicOsc[i]=100; }
      else {
        ErgodicOsc[i]=EMA2_Mtm[i]/EMA2_absMtm[i]*100; //初值
      }
      //-----------Signal=EMA(ErgodicOsc,7). Histogram=ErgodicOsc-Signal
      Signal[i]=ErgodicOsc[i];               //初值
      Histogram[i]=ErgodicOsc[i]-Signal[i];  //初值
    }
    else {
      EMA1_Mtm[i]=(Long-1)/(Long+1)*EMA1_Mtm[i-1]+2/(Long+1)*Mtm[i];
      EMA1_absMtm[i]=(Long-1)/(Long+1)*EMA1_absMtm[i-1]+2/(Long+1)*absMtm[i];
      //------Double EMD-----------------------------------
      EMA2_Mtm[i]=(short-1)/(Short+1)*EMA2_Mtm[i-1]+2/(Short+1)*EMA1_Mtm[i];
      EMA2_absMtm[i]=(short-1)/(Short+1)*EMA2_absMtm[i-1]+2/(Short+1)*EMA1_absMtm[i];
      //------ErgodicOsc=EMA2_Mtm/EMA2_absMtm*100
      if(EMA2_Mtm[i]===EMA2_absMtm[i]) {  //避免分母=0
        ErgodicOsc[i]=100; }
      else {
        ErgodicOsc[i]=EMA2_Mtm[i]/EMA2_absMtm[i]*100;
      }
      //-----------Signal=EMA(ErgodicOsc,7). Histogram=ErgodicOsc-Signal
      Signal[i]=(Num-1)/(Num+1)*Signal[i-1]+2/(Num+1)*ErgodicOsc[i];
      Histogram[i]=ErgodicOsc[i]-Signal[i];
    }
  }
  return { ErgodicOsc, Signal, Histogram };
  //drawing these figures in the small windows.
  //these indicators[]= 2 to 2000.
}
window.ErgodicOsc = ErgodicOsc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-25===越南旅次=======
//Twiggs Money Flow是由澳洲技術分析師Colin Twiggs所發展的資金流量指標 (No.59)
//由澳洲技術分析師 Colin Twiggs 所發展的資金流量指標，用來衡量資金流入與流出的強度。
// 它與 Chaikin Money Flow 類似，但修正了價格跳空(gap)造成的失真問題。
//指數平滑(EMA), esp
function TwiggsMoneyFw(STK_high, STK_low, STK_close, STK_vol, esp) {
  // Menu Name: Twiggs Money Flow    // esp=20
  const TMFV=[];   //3.Twiggs Money Flow Volume(TMFV),將成交量納入. =2 to 2000
  const Vol_ema=[];   //成交量EMA.   =2 to 2000
  const TMFV_ema=[];  //資金流量EMA. =2 to 2000
  const TwiggsMoneyFlow=[];  //5.Twiggs Money Flow (TMF)
  for(let i=2; i<=STK_close.length; i++) {   //i=2 to 2000
    // 1.True High與True Low
    let TrueHigh=Math.max(STK_high[i], STK_close[i-1]);
    let TrueLow=Math.min(STK_low[i], STK_close[i-1]);
    // 2.Twiggs Money Flow Multiplier(TMFM)
    if(TrueHigh===TrueLow) {  //避免分母=0
      let TMFM=1; }
    else {
      let TMFM=(2*STK_close[i]-TrueHigh-TrueLow)/(TrueHigh-TrueLow);
    }
    // 3.Twiggs Money Flow Volume(TMFV),將成交量納入
    TMFV[i]=TMFM*STK_vol[i];    // =2 to 2000
    // 4.指數平滑(EMA)
    // 5.Twiggs Money Flow(TMF)
    if(i===2) {                //初值
      Vol_ema[i]=STK_vol[i];   //初值
      TMFV_ema[i]=TMFV[i];     //初值
      TwiggsMoneyFlow[i]= TMFV_ema[i]/Vol_ema[i]*100; }  //初值
    else {
      Vol_ema[i]=(esp-1)/(esp+1)*Vol_ema[i-1] + 2/(esp+1)*STK_vol[i];
      TMFV_ema[i]=(esp-1)/(esp+1)*TMFV_ema[i-1] + 2/(esp+1)*TMFV[i];
      TwiggsMoneyFlow[i]=TMFV_ema[i]/Vol_ema[i]*100;
    }
  }
  return { TwiggsMoneyFlow };
  //drawing these figures in the small windows.
  //TwiggsMoneyFlow[]= 2 to 2000.
}
window.TwiggsMoneyFw = TwiggsMoneyFw;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-25===越南旅次==========
//Volume Oscillator(成交量震盪指標)用來衡量短期成交量平均與長期成交量平均之間的差異，
// 以判斷成交量是增加還是減少。
//OSCVol(Volume Oscillator,成交量擺動指標)。OSCVol今=(短期MA今－長期MA今)/短期MA今*100%
//上述採用 MA(Vol,n)，此處改用EMA(Vol,n)。
//許多交易平台(如 TradingView)使用EMA.
//指數平滑移動平均的參數: exponential smoothing parameter(esp)
function VolumeOSC_EMA(STK_vol, short_day, long_day, esp) {  //改用EMA(Vol,n)
  // Menu Name: Volume Osc(EMA)   //short_day=10, long_day=20, esp=9 自創
  if(short_day>long_day) {  //例如: 10>5, 將二者對調,確保short_day比較小。
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
  }
  const shortEMA_Vol=[];  //短期EMA(Vol,n), n=10
  const longEMA_Vol=[];   //長期EMA(Vol,n), n=20
  const Vol_OSC_EMA=[];   //=[EMA(Vol,short)-EMA(Vol,long)]/EMA(Vol,long)
  const eVol_OSC_EMA=[];  //esp=9 自創
  for(let i=1; i<=STK_close.length; i++) {     //i=1 to 2000
    if(i===1) {      //初值
      shortEMA_Vol[i]=STK_vol[i]; 
      longEMA_Vol[i]=STK_vol[i];
      Vol_OSC_EMA[i]=(shortEMA_Vol[i]-longEMA_Vol[i])/longEMA_Vol[i]*100;
      eVol_OSC_EMA[i]=Vol_OSC_EMA[i]; }  //初值
    else {   // i>1
      shortEMA_Vol[i]=(short_day-1)/(short_day+1)*shortEMA_Vol[i]+2/(short_day+1)*STK_vol[i];
      longEMA_Vol[i]=(long_day-1)/(long_day+1)*longEMA_Vol[i]+2/(long_day+1)*STK_vol[i];
      Vol_OSC_EMA[i]=(shortEMA_Vol[i]-longEMA_Vol[i])/longEMA_Vol[i]*100;
      eVol_OSC_EMA[i]=(esp-1)/(esp+1)*eVol_OSC_EMA[i-1]+2/(esp+1)*Vol_OSC_EMA[i]; //自創新
    }
  }
  return { Vol_OSC_EMA, eVol_OSC_EMA };
  //drawing these figures in the small windows.
  //Vol_OSC_EMA[], eVol_OSC_EMA[]=1,2,...,2000.
}
window.VolumeOSC_EMA = VolumeOSC_EMA;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-28===越南旅次===========
//Linear Regression Indicator(線性回歸指標, LRI) 是以**最小平方法
// (Least Squares Method)**對最近 N根K線的價格進行線性回歸  (No.56)
function LinearRegression(STK_close, N, K) {
  // Menu Name: Linear Regression(Close)  //Miniman N=10. K=1, 2, 3
  //Y_hat=a+bX, a=[sum(Yi)-b*sum(Xi)]/N
  //b={N*[sum(Xi*Yi)]-[sum(Xi)]*[sum(Yi)]}/{N*sum(Xi^2)-[sum(Xi)]^2}
  let sum_Xi=(N*(N-1))/2;          //sum_Xi=N(N-1)/2. 放在分母
  let sum_Xi2=(N*(N-1)*(2*N-1))/6; //sum(Xi^2). 放在分母
  let aa;  //截距Intercept. a=(sum(Yi)-b*sum(Xi))/N
  let bb;  //斜率Slope
  let sum_XiYi;   //放在分子
  let sum_Yi;     //放在分子
  const LRI=[];   //Y_hat=Linear Regression Indicator=a+b(N-1)
  const LRI_upper=[];  //上軌=Y_hat+K*Sigma, k=1, 2, 3
  const LRI_lower=[];  //下軌=Y_hat-K*Sigma, k=1, 2, 3
  for(let i=N; i<=STK_close.length; i++) {  //i=10 to 2000
     sum_XiYi=0;   //放在分子
     sum_Yi=0;     //放在分子
    for(let j=1; j<=N; j++) {  //if N=10, 永遠是：j=1 to 10.
      sum_XiYi=sum_XiYi+(j-1)*STK_close[i-N+j]; //自變數Xi第1天=0
      sum_Yi=sum_Yi+STK_close[i-N+j];
    }
    bb=(N*sum_XiYi-sum_Xi*sum_Yi)/(N*sum_Xi2-sum_Xi**2); //斜率Slope
    aa=(sum_Yi-bb*sum_Xi)/N;  //截距Intercept
    // first Y_hat[]=10 to 2000
    LRI[i]=aa+bb*(N-1);  //Y_hat=Linear Regression Indicator=a+b(N-1)
    //Calculate Sigma=殘差標準差(Residual SD)
    let sum_Residual2=0;  // sum(殘差平方)=殘差平方和
    let Sigma=0;
    //殘差(Residual)=Ei=Yi-Yi_hat.  //Sigma=sqrt(殘差平方和/N)
    for(let j=1; j<=N; j++) {  //j=1 to 10
      sum_Residual2=sum_Residual2+(STK_close[i-N+j]-(aa+bb*(j-1)))**2;
    }
    Sigma=Math.sqrt(sum_Residual2/N);
    LRI_upper[i]=LRI[i]+K*Sigma;  //=Y_hat+kSigma, K=1, 2, 3
    LRI_lower[i]=LRI[i]-K*Sigma;  //=Y_hat-kSigma, K=1, 2, 3
  }
  return { LRI, LRI_upper, LRI_lower };
  //drawing these figures in the K_Line area.
  //if Miniman N=10, LRI[],LRI_upper[],LRI_lower[]= 10 to 2000.
}
window.LinearRegression = LinearRegression;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-28===越南旅次===========
//Linear Regression Indicator(線性回歸指標, LRI) 是以**最小平方法
// (Least Squares Method)**對最近 N根K線的價格進行線性回歸  (No.56)
//取用Typical Price替代Close收盤價. Typical Price=(H+L+2C)/4
function LinearRegressionTP(STK_high, STK_low, STK_close, N, K) {
  // Menu Name: Linear Regression(Typical)  //Miniman N=10. K=1, 2, 3
  //Y_hat=a+bX, a=[sum(Yi)-b*sum(Xi)]/N
  //b={N*[sum(Xi*Yi)]-[sum(Xi)]*[sum(Yi)]}/{N*sum(Xi^2)-[sum(Xi)]^2}
  const TypicalPrice=[]; //取用Typical Price=(H+L+2C)/4
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+2*STK_close[i])/4;
  }
  let sum_Xi=(N*(N-1))/2;          //sum_Xi=N(N-1)/2. 放在分母
  let sum_Xi2=(N*(N-1)*(2*N-1))/6; //sum(Xi^2). 放在分母
  let aa;  //截距Intercept. a=(sum(Yi)-b*sum(Xi))/N
  let bb;  //斜率Slope
  let sum_XiYi;   //放在分子
  let sum_Yi;     //放在分子
  const LRI=[];   //Y_hat=Linear Regression Indicator=a+b(N-1)
  const LRI_upper=[];  //上軌=Y_hat+K*Sigma, k=1, 2, 3
  const LRI_lower=[];  //下軌=Y_hat-K*Sigma, k=1, 2, 3
  for(let i=N; i<=STK_close.length; i++) {  //i=10 to 2000
     sum_XiYi=0;   //放在分子
     sum_Yi=0;     //放在分子
    for(let j=1; j<=N; j++) {  //if N=10, 永遠是：j=1 to 10.
      sum_XiYi=sum_XiYi+(j-1)*TypicalPrice[i-N+j]; //自變數Xi第1天=0
      sum_Yi=sum_Yi+TypicalPrice[i-N+j];
    }
    bb=(N*sum_XiYi-sum_Xi*sum_Yi)/(N*sum_Xi2-sum_Xi**2); //斜率Slope
    aa=(sum_Yi-bb*sum_Xi)/N;  //截距Intercept
    // first Y_hat[]=10 to 2000
    LRI[i]=aa+bb*(N-1);  //Y_hat=Linear Regression Indicator=a+b(N-1)
    //Calculate Sigma=殘差標準差(Residual SD)
    let sum_Residual2=0;  // sum(殘差平方)=殘差平方和
    let Sigma=0;
    //殘差(Residual)=Ei=Yi-Yi_hat.  //Sigma=sqrt(殘差平方和/N)
    for(let j=1; j<=N; j++) {  //j=1 to 10
      sum_Residual2=sum_Residual2+(TypicalPrice[i-N+j]-(aa+bb*(j-1)))**2;
    }
    Sigma=Math.sqrt(sum_Residual2/N);
    LRI_upper[i]=LRI[i]+K*Sigma;  //=Y_hat+kSigma, K=1, 2, 3
    LRI_lower[i]=LRI[i]-K*Sigma;  //=Y_hat-kSigma, K=1, 2, 3
  }
  return { LRI, LRI_upper, LRI_lower };
  //drawing these figures in the K_Line area.
  //if Miniman N=10, LRI[],LRI_upper[],LRI_lower[]= 10 to 2000.
}
window.LinearRegressionTP = LinearRegressionTP;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-June-29===越南旅次===========
//Disparity Index差異指標     (No.54)
// (乖離率,DI) 是一種衡量目前價格偏離移動平均線程度的技術指標。
// 它反映目前價格相對於平均價格的百分比差異.
//DI=(C-MAt)/MAt*100.  用EMA替代MA.
//取用Typical Price替代Close收盤價. Typical Price=(H+L+4C)/6
//指數平滑移動平均參數exponential smoothing parameter(esp)
function DisparityIndex(STK_high, STK_low, STK_close, ma_day, esp) {
  // Menu Name: Disparity Index(Typical)  //ma_day=10. esp=9,10,...
  const TypicalPrice=[]; //取用Typical Price=(H+L+4C)/6
  const Disparity=[];    //Disparity Index  =10 to 2000
  const eDisparity=[];   //eDisparity Index  =10 to 2000, 自創新
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;
  }
  //Calculate EMA, ma_day=10
  let sum=0;
  for(let i=1; i<=ma_day; i++) {  //i=1 to 10(ma_day)
    sum=sum+TypicalPrice[i];
  }
  EMA[ma_day]=sum/ma_day;   //first EMA[10]=sum/10
  Disparity[ma_day]=(TypicalPrice[ma_day]/EMA[ma_day]-1)*100;
  eDisparity[ma_day]=Disparity[ma_day];  //first value, =10 to 2000
  for(i=ma_day+1; i<=STK_close.length; i++) {  //11 to 2000
    EMA[i]=(esp-1)/(esp+1)*EMA[i-1]+2/(esp+1)*TypicalPrice[i];
    Disparity[i]=(TypicalPrice[i]-EMA[i])/EMA[i]*100;
    eDisparity[i]=(esp-1)/(esp+1)*eDisparity[i-1]+2/(esp+1)*Disparity[i];
  }
  return { Disparity, eDisparity };
  //drawing these figures in the small windows.
  //if ma_day=10, Disparity[], eDisparity[]= 10 to 2000.
}
window.DisparityIndex = DisparityIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-01===越南旅次===========
//Adaptive Laguerre Filter     (No.53)
//取用Typical Price替代Close收盤價. Typical Price=(H+L+4C)/6
function AdaptiveLaguerreFilter(STK_high, STK_low, STK_close, day) {
  // Menu Name: Adaptive Laguerre  //day=10, 15, 20, 
  const TypicalPrice=[]; //取用Typical Price=(H+L+4C)/6
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;
  }
  //Calculate Standard Deviation(SD), Sigma=sqrt(sum(Xi-mu)^2/N), day=10
  let sum;
  let mu;   //Population Mean=mu
  const Sigma=[];  //Standard Deviation(SD), =10(day) to 2000
  for(let i=day; i<=STK_close.length; i++) {  //=10 to 2000
    sum=0; mu=0;
    //Calculate mu
    for(let j=i-day+1; j<=i; j++) {  //=1 to 10
      sum=sum+TypicalPrice[j];
    }
    mu=sum/day;  //first mu=sum/10
    sum=0;
    for(let j=i-day+1; j<=i; j++) {  //=1 to 10
      sum=sum+(TypicalPrice[j]-mu)**2;
    }
    Sigma[i]=Math.sqrt(sum/day);  //first SD=Sigma[]=10=day
  }
  //Calculate Gamma, Gamma_t=[1-Sigma_t/max(Sigma)]
  const Gamma=[];  //day+day-1=19 to 2000
  let max_Sigma;
  for(let i=day+day-1; i<=STK_close.length; i++) {  //i=19 to 2000
    max_Sigma=Sigma[i-day+1];  //set Sigma[10] is max
    for(let j=i-day+2; j<=i; j++) {  //11 to 19, find max(Sigma)
      if(Sigma[j]>max_Sigma) {
        max_Sigma=Sigma[j];  }
    }
    Gamma[i]=(1-Sigma[i]/max_Sigma);  //=19 to 2000
  }
  //Calculate L0,L1,L2,L3.  firstly set their initial values
  const L0=[], L1=[], L2=[], L3=[];   //=10+10-2=18 to 2000
  const AdaptiveLaguerre=[];   //(L0+2L1+2L2+L3)/6, =18 to 2000
  let tp=day+day-2;   //tp=10+10-2=18
  L0[tp]=TypicalPrice[tp];  L1[tp]=TypicalPrice[tp];  //18 to 2000
  L2[tp]=TypicalPrice[tp];  L3[tp]=TypicalPrice[tp];  //18 to 2000
  AdaptiveLaguerre[tp]=TypicalPrice[tp];              //18 to 2000
  for(let i=day+day-1; i<=STK_close.length; i++) {    //i=19 to 2000
    L0[i]=(1-Gamma[i])*TypicalPrice[i]+Gamma[i]*L0[i-1];
    L1[i]=(-Gamma[i])*L0[i]+L0[i-1]+Gamma[i]*L1[i-1];
    L2[i]=(-Gamma[i])*L1[i]+L1[i-1]+Gamma[i]*L2[i-1];
    L3[i]=(-Gamma[i])*L2[i]+L2[i-1]+Gamma[i]*L3[i-1];
    AdaptiveLaguerre[i]=(L0[i]+2*L1[i]+2*L2[i]+L3[i])/6;
  } 
  return { AdaptiveLaguerre };
  //drawing these figures in the K_Line area.
  //if day=10, AdaptiveLaguerre[]=18 to 2000. //day+day-2=18
}
window.AdaptiveLaguerreFilter = AdaptiveLaguerreFilter;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-01===越南旅次===========
//Prime Number Bands (PNB)     (No.52)
//質數帶, PNB是一種較少見的技術分析指標，最初由Modulus Financial Engineering提出
// ，部分交易平台(如 MetaStock)曾提供此指標。它的概念並非像Bollinger Bands
// 那樣以標準差建立通道，而是利用距離目前價格最近的質數作為動態支撐與壓力帶。
//取用Typical Price替代Close收盤價. Typical Price=(H+L+4C)/6
function PrimeNumberBands(STK_high, STK_low, STK_close) {
  // Menu Name: Prime Number Bands 
  const TypicalPrice=[];    //取用Typical Price=(H+L+4C)/6
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;
  }
  //Calculate the upper, lower, and middle Prime Number Bands
  const upper_PNB=[];  //大於Typical Price的最小質數
  const lower_PNB=[];  //小於Typical Price的最大質數
  const middle_PNB=[]; //小於Typical Price的最大質數與大於Typical Price的最小質數的平均值
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    lower_PNB[i] = lowerPrime(Math.floor(TypicalPrice[i])); //取小於Typical Price的最大質數
    upper_PNB[i] = upperPrime(Math.ceil(TypicalPrice[i]));  //取大於Typical Price的最小質數
    middle_PNB[i] = (lower_PNB[i] + upper_PNB[i] ) / 2;  
    //取小於Typical Price的最大質數與大於Typical Price的最小質數的平均值
  }
  return { upper_PNB, lower_PNB, middle_PNB };
  //drawing these figures in the K_Line area.
  //these indicators[]=1 to 2000.
}
window.PrimeNumberBands = PrimeNumberBands;
//--------------------------------------------------------
function lowerPrime(n) {  
  //Find the nearest prime number which is smaller than n 
  let num = n - 1;
  while (true) {  
    if (isPrime(num)) {
      return num;  }
    num--;
  }
}
window.lowerPrime = lowerPrime;
//--------------------------------------------------------
function upperPrime(n) {  
  //Find the nearest prime number which is larger than n
  let num = n + 1;
  while (true) {  
    if (isPrime(num)) {
      return num;  }
    num++;
  }
}
window.upperPrime = upperPrime;
//--------------------------------------------------------
//Check if a number is prime------------------------------
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}
window.isPrime = isPrime;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-02===越南旅次===========
//High Low Bands     (No.51)
//英文版內容與中文版GPT的內容差異大！本人重新定義.
//取用Typical Price替代Close收盤價. Typical Price=(H+L+4C)/6, 自創。
function HighLowBands(STK_high, STK_low, STK_close, day, esp) {
  // Menu Name: HighLowBands(Wang)  //day=5, 10, 15, 20, ... //esp=5, 10, 15, 20, ...
  //Calculate the Typical Price[]=1 to 2000.
  const TypicalPrice=[];    //取用Typical Price=(H+L+4C)/6, 自創。
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;
  }
  //Calculate the sum of Typical Price for the specified number of days.
  let sum=0;
  for(let i=1; i<=day; i++) {  //i=1 to day=1 to 10
    sum+=TypicalPrice[i];
  }
  const EMA1=[];  //EMA1=Typical Price的day日指數移動平均. =10 to 2000
  const EMA2=[], EMA3=[];  //EMA2,EMA3=Typical Price的esp日指數移動平均. =10 to 2000
  const EMA4=[], EMA5=[];  //EMA4,EMA5=Typical Price的day日指數移動平均. =10 to 2000
  const TriangularEMA=[];  //TriangularEMA=average(EMA1,...,EMA5). =10 to 2000
  const HighBand=[], LowBand=[];  //TriangularEMA的上下軌道. =10 to 2000
  EMA1[day]=sum/day;                      //first value
  EMA2[day]=sum/day;  EMA3[day]=sum/day;  //first value
  EMA4[day]=sum/day;  EMA5[day]=sum/day;  //first value
  let tp;
  for(let i=day+1; i<=STK_close.length; i++) {  //i=day+1 to 2000=11 to 2000
    tp=esp+0;  EMA1[i]=(tp-1)/(tp+1)*EMA1[i-1]+2/(tp+1)*TypicalPrice[i];
    tp=esp+5;  EMA2[i]=(tp-1)/(tp+1)*EMA2[i-1]+2/(tp+1)*TypicalPrice[i];
    tp=esp+10; EMA3[i]=(tp-1)/(tp+1)*EMA3[i-1]+2/(tp+1)*TypicalPrice[i]; 
    tp=esp+15; EMA4[i]=(tp-1)/(tp+1)*EMA4[i-1]+2/(tp+1)*TypicalPrice[i];
    tp=esp+20; EMA5[i]=(tp-1)/(tp+1)*EMA5[i-1]+2/(tp+1)*TypicalPrice[i];
    TriangularEMA[i]=(EMA1[i]+EMA2[i]+EMA3[i]+EMA4[i]+EMA5[i])/5;
    HighBand[i]=(1+0.05)*TriangularEMA[i];  
    LowBand[i]=(1-0.05)*TriangularEMA[i];
  }
  return { TriangularEMA, HighBand, LowBand };
  //drawing these figures in the K_Line area.
  //these indicators[]=day to 2000=10 to 2000.
}
window.HighLowBands = HighLowBands;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-02===越南旅次===========
//Time Segmented Volume(TSV)時間分段成交量。 <採用收盤價>     (No.49)
//時間分段成交量)是由Worden Brothers的Don Worden提出的成交量動能指標，
// 目的是衡量成交量是否支持價格趨勢。它可視為將「價格變動」與「成交量」
// 結合後，再進行累積或移動平均處理。       <類似移動平均>
function TimeSegmentedVol(STK_close, STK_vol, day) {
  // Menu Name: TimeSegVol  //day=5, 10, 15, 20, ...
  // 可以採用Typical Price取代STK_close收盤價,再設計程式
  const TimeSegVol = [];  //=11 to 2000
  let sum=0;
  for (let i=2; i<=day+1; i++) {  //從第2天開始，因用到前一天的收盤價,=2 to 11
    sum = sum+STK_vol[i]*(STK_close[i]-STK_close[i-1]);
  }
  TimeSegVol[day+1] = sum;   //first TimeSegVol[11]
  for (let i=day+2; i<=STK_close.length; i++) {  //從第12天開始，因用到前一天收盤價,=12 to 2000
    sum = sum+STK_vol[i]*(STK_close[i]-STK_close[i-1]);              //加新的
    sum = sum-STK_vol[i-day]*(STK_close[i-day]-STK_close[i-day-1]);  //減舊的
    TimeSegVol[i] = sum;
  }
  return { TimeSegVol };
  //drawing these figures in the small windows.
  //if day=10, TimeSegVol[]=day+1 to 2000=11 to 2000.
}
window.TimeSegmentedVol = TimeSegmentedVol;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-02===越南旅次===========
//Time Segmented Volume(TSV)時間分段成交量。<採用Typical Price取代收盤價> (No.49)
//時間分段成交量)是由Worden Brothers的Don Worden提出的成交量動能指標，
// 目的是衡量成交量是否支持價格趨勢。它可視為將「價格變動」與「成交量」
// 結合後，再進行累積或移動平均處理。       <類似移動平均>
function TimeSegmentedVol_TP(STK_high, STK_low, STK_close, STK_vol, day) {
  // Menu Name: TimeSegVol_TP  //day=5, 10, 15, 20, ...
  // 此程式採用Typical Price取代STK_close收盤價
  // Calculate the Typical Price[]=1 to 2000.
  const TypicalPrice=[];    //取用Typical Price=(H+L+4C)/6, 自創。
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;
  }
  //Calculate the Time Segmented Volume(TSV) using Typical Price and Volume.
  const TimeSegVol_TP = [];  //=11 to 2000
  let sum=0;
  for (let i=2; i<=day+1; i++) {  //從第2天開始，因用到前一天的收盤價,=2 to 11
    sum = sum+STK_vol[i]*(TypicalPrice[i]-TypicalPrice[i-1]);
  }
  TimeSegVol_TP[day+1] = sum;   //first TimeSegVol_TP[11]
  for (let i=day+2; i<=STK_close.length; i++) {  //從第12天開始，因用到前一天收盤價,=12 to 2000
    sum = sum+STK_vol[i]*(TypicalPrice[i]-TypicalPrice[i-1]);              //加新的
    sum = sum-STK_vol[i-day]*(TypicalPrice[i-day]-TypicalPrice[i-day-1]);  //減舊的
    TimeSegVol_TP[i] = sum;
  }
  return { TimeSegVol_TP };
  //drawing these figures in the small windows.
  //if day=10, TimeSegVol_TP[]=day+1 to 2000=11 to 2000.
}
window.TimeSegmentedVol_TP = TimeSegmentedVol_TP;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-03===越南旅次===========
//Stoller Average Range Channels(STARC)  (No.48)
//ATR均幅指標(ATR, Average True Range)indicator.
//ATR[]=TR的指數平滑移動平均
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function StollerAverageRangeChannels(STK_high, STK_low, STK_close, day, esp) {
  // Menu Name: Stoller Avg Rng Chnl    // esp=9 
  const ATR=[]; //ATR[]=TR的指數平滑移動平均, =2 to 2000
  ATR[1]=0;     //ATR[1]=0,因為i=2才開始計算TR,所以ATR[1]=0.
  let TR;       //TR=真實波幅(True Range),TR改為變數不是陣列
  let temp1, temp2, temp3;
  for(let i=2; i<=STK_close.length; i++) {  //i=2 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR = Math.max(temp1, temp2, temp3);
    if(i===2) {
      ATR[2]=TR; }  //ATR[2]=TR,因為i=2才開始計算TR,所以ATR[2]=TR.
    else {
      //ATR[i]=(esp-1)/(esp+1)*ATR[i-1]+2/(esp+1)*TR[i]; //原來的
      ATR[i]=((esp-1)*ATR[i-1]+TR)/esp;  //Wiler Smoothing, 新的
    }
  }
  //Calculate EMA[] //也有部分軟體使用EMA
  const EMA=[]; //EMA[]=收盤價的指數平滑移動平均, =10 to 2000
  let sum=0;
  for(let i=1; i<=day; i++) {  //i=1 to day=10
    sum = sum + STK_close[i];
  }
  EMA[day] = sum / day;   //first EMA[10]=收盤價的前10天平均
  for(let i=day+1; i<=STK_close.length; i++) {  //i=11 to 2000
    EMA[i] = (esp-1)/(esp+1)*EMA[i-1]+2/(esp+1)*STK_close[i];
  }
  //Calculate the Stoller Average Range Channels(STARC) using ATR and EMA.
  //STARC上軌[]=EMA[]+k*ATR[], STARC下軌[]=EMA[]-k*ATR[]
  const k=1.5;           //k=1.5, 2, 2.5, 3, ...
  const upper_STARC=[];  //STARC上軌[]=EMA[]+k*ATR[], =10 to 2000
  const lower_STARC=[];  //STARC下軌[]=EMA[]-k*ATR[], =10 to 2000
  for(let i=day; i<=STK_close.length; i++) {  //i=10 to 2000
    upper_STARC[i] = EMA[i] + k*ATR[i];  //STARC上軌[]=EMA[]+k*ATR[]
    lower_STARC[i] = EMA[i] - k*ATR[i];  //STARC下軌[]=EMA[]-k*ATR[]
  }
  return { EMA, upper_STARC, lower_STARC };
  // drawing these figures in the K_Line area.
  // if day=10, these indicators =10 to 2000.
}
window.StollerAverageRangeChannels = StollerAverageRangeChannels;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-04===越南旅次===========
// RSI相對強弱指標(RSI, Relative Strength Index)
// Rolling Cumulative RSI,移動的固定期間累積RSI
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function RSI_Rolling_Cumulative(STK_close, RSI_day, period) {
  // Menu Name: RSI RollingCumulative    // RSI_day=5,10,15,...,
  // period=5,10,15,...,移動的固定期間累積RSI
  // First calculate RSI
  const RSI=[];   // eRSI=[]; 此處不計算eRSI,因為eRSI是RSI的指數平滑移動平均
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<=STK_close.length; i++) {
    dif[i]=STK_close[i]-STK_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<=RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);  //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //eRSI[RSI_day+1]=RSI[RSI_day+1]   //eRSI的初值=eRSI[11]  //此處不計算eRSI
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    //eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];  //此處不計算eRSI
  }
  //==========此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  //if RSI_day=10 then RSI[]=11,12,...,2000.
  //Rolling Cumulative RSI,移動的固定期間累積RSI
  const RSI_Rolling_Cumulative=[];  //RSI_Rolling_Cumulative[]=15 to 2000
  let sum_RSI=0;
  for(let i=RSI_day+1; i<=RSI_day+period; i++) {  //i=11 to 15
    sum_RSI=sum_RSI+RSI[i];  //sum_RSI=RSI[11]+RSI[12]+...+RSI[20]
  }
  //if RSI_day=10, period=5 then first RSI_Rolling_Cumulative[15]
  RSI_Rolling_Cumulative[RSI_day+period]=sum_RSI;  //=[15]
  for(let i=RSI_day+period+1; i<=STK_close.length; i++) {  //i=16 to 2000
    sum_RSI=sum_RSI+RSI[i]-RSI[i-period];  //加新的RSI值，扣除舊的RSI值
    RSI_Rolling_Cumulative[i]=sum_RSI;
  }
  return { RSI, RSI_Rolling_Cumulative };
  //drawing these figures in the small windows.
  // if RSI_day=10, period=5, then RSI[]=10 to 2000
  // and RSI_Rolling_Cumulative[]=15,16,...,2000.
}
window.RSI_Rolling_Cumulative = RSI_Rolling_Cumulative;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-05===昨天自河內回台灣======
// RSI相對強弱指標(RSI, Relative Strength Index)
// RSI動能(RSI Momentum)=RSI(t)-RSI(t-1)      	<非自創指標>
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function RSI_Momentum(STK_close, RSI_day) {
  // Menu Name: RSI Momentum    // RSI_day=5,10,15,...,
  // First calculate RSI
  const RSI=[];   // eRSI=[]; 此處不計算eRSI,因為eRSI是RSI的指數平滑移動平均
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<=STK_close.length; i++) {
    dif[i]=STK_close[i]-STK_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<=RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);  //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //eRSI[RSI_day+1]=RSI[RSI_day+1]   //eRSI的初值=eRSI[11]  //此處不計算eRSI
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    //eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];  //此處不計算eRSI
  }
  //==========此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  //if RSI_day=10 then RSI[]=11,12,...,2000.
  //RSI動能(RSI Momentum)=RSI(t)-RSI(t-1)      	<非自創指標>
  const RSI_Momentum=[];  //if RSI_day=10 then RSI[]=11 to 2000, RSI_Momentum[]=12 to 2000
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  //i=12 to 2000
    RSI_Momentum[i]=RSI[i]-RSI[i-1];  //RSI_Momentum[12]=RSI[12]-RSI[11]
  }
  return { RSI, RSI_Momentum };
  //drawing these figures in the small windows.
  // if RSI_day=10, then RSI[]=11 to 2000 and RSI_Momentum[]=12,13,...,2000.
}
window.RSI_Momentum = RSI_Momentum;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-05===昨天自河內回台灣======
// RSI相對強弱指標(RSI, Relative Strength Index)
// RSI動能(RSI Momentum)=RSI(t)-RSI(t-1)   	<非自創指標>
// Cumulative RSI Momentum(累積RSI動量)     <非自創指標>
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function RSI_CumulativeMomentum(STK_close, RSI_day) {
  // Menu Name: RSI CumulativeMomentum    // RSI_day=5,10,15,...,
  // First calculate RSI
  const RSI=[];   // eRSI=[]; 此處不計算eRSI,因為eRSI是RSI的指數平滑移動平均
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<=STK_close.length; i++) {
    dif[i]=STK_close[i]-STK_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<=RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);  //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //eRSI[RSI_day+1]=RSI[RSI_day+1]   //eRSI的初值=eRSI[11]  //此處不計算eRSI
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    //eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];  //此處不計算eRSI
  }
  //==========此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  //if RSI_day=10 then RSI[]=11,12,...,2000.
  //RSI動能(RSI Momentum)=RSI(t)-RSI(t-1)      	<非自創指標>
  const RSI_CumulMomet=[]; //if RSI_day=10 then RSI[], RSI_CumulMomet[]=11 to 2000
  RSI_CumulMomet[RSI_day+1]=0;  //RSI_CumulMomet[11]=0
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  //i=12 to 2000
    RSI_CumulMomet[i]=RSI_CumulMomet[i-1]+(RSI[i]-RSI[i-1]); //累積RSI動量
  }
  return { RSI, RSI_CumulMomet };
  //drawing these figures in the small windows.
  // if RSI_day=10, then RSI[], RSI_CumulMomet[]=11 to 2000.
}
window.RSI_CumulativeMomentum = RSI_CumulativeMomentum;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-06===二天前自河內回台灣======
// RSI相對強弱指標(RSI, Relative Strength Index)
// Centered Cumulative RSI(累積RSI偏離值)  <非自創指標>
// =CenteredCumul_RSI=sum(RSI(t)-50)
// 此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
function RSI_CenteredCumulative(STK_close, RSI_day) {
  // Menu Name: RSI CenteredCumula    // RSI_day=5,10,15,...,
  // First calculate RSI
  const RSI=[];   // eRSI=[]; 此處不計算eRSI,因為eRSI是RSI的指數平滑移動平均
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<=STK_close.length; i++) {
    dif[i]=STK_close[i]-STK_close[i-1];   // dif[]=2,3,...,2000
  }
  //compute the first RSI(). if day=10, RSI()=11,12,...,2000.
  let sum_Up = 0;   //最近 n 日收盤價漲幅之和
  let sum_Dn = 0;   //最近 n 日收盤價跌幅之和
  for(let i=2; i<=RSI_day+1; i++) {  //if RSI_day=10 then i=2 to 11
    if(dif[i] > 0) {
      sum_Up = sum_Up + dif[i]; }   //收盤價漲幅之和
    else {
      //sum_Dn = sum_Dn - dif[i];  //此式是正確的，一定要用負號
      sum_Dn=sum_Dn+Math.abs(dif[i]);  //收盤價跌幅之和
    }
  }
  //if RSI_day=10 then first RSI value=RSI[11]
  if((sum_Up+sum_Dn) === 0) {
    RSI[RSI_day+1]=100; }
  else {
    RSI[RSI_day+1]=sum_Up/(sum_Up+sum_Dn)*100;
  }
  //eRSI[RSI_day+1]=RSI[RSI_day+1]   //eRSI的初值=eRSI[11]  //此處不計算eRSI
  //下述程式是計算第2筆之後的RSI值。if RSI_day=10 則第2筆RSI值=RSI[12]
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  // i=12 to 2000
    // 先加新的收盤價差值！
    if(dif[i] > 0) {
      sum_Up=sum_Up+dif[i]; }           //收盤價漲幅之和
    else {
      sum_Dn=sum_Dn+Math.abs(dif[i]);   //收盤價跌幅之和
    }
    // 再扣除10日前的累加值
    if (dif[i-RSI_day] > 0) {
      sum_Up=sum_Up-dif[i-RSI_day]; }
    else {
      //sum_Dn=sum_Dn+dif[i-RSI_day];  //此式是正確的，一定要用加號
      sum_Dn=sum_Dn-Math.abs(dif[i-RSI_day]);
    }
    //if RSI_day=10 then second RSI value=RSI[12]
    if((sum_Up+sum_Dn) === 0) {  
      RSI[i]=100; }
    else {
       RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    //eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];  //此處不計算eRSI
  }
  //==========此程式是完整的RSI設計，以此為主。  <2026-Feb-24>
  //if RSI_day=10 then RSI[]=11,12,...,2000.
  //Centered Cumulative RSI(累積RSI偏離值)      	<非自創指標>
  const CenteredCumul_RSI=[]; //if RSI_day=10 then RSI[], RSI_CumulMomet[]=11 to 2000
  CenteredCumul_RSI[RSI_day+1]=0;  //CenteredCumul_RSI[11]=0
  for(let i=RSI_day+2; i<=STK_close.length; i++) {  //i=12 to 2000
    CenteredCumul_RSI[i]=CenteredCumul_RSI[i-1]+(RSI[i]-50); //累積RSI偏離值
  }
  return { CenteredCumul_RSI };
  //drawing these figures in the small windows.
  // if RSI_day=10, then RSI[], CenteredCumul_RSI[]=11 to 2000.
}
window.RSI_CenteredCumulative = RSI_CenteredCumulative;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-08======================
//Schaff Trend Cycle (STC)     (No.46)
//是由Doug Schaff所提出的技術分析指標，目的是結合MACD與
// Stochastic Oscillator的優點，使趨勢轉折比MACD更快被偵測到.
//取用TP=Typical Price替代Close收盤價. Typical Price=(H+L+4C)/6, 自創。
function SchaffTrend(STK_high, STK_low, STK_close, short_day, long_day, kd_day) {
  // Menu Name: Schaff Trend   //short_day=10,... long_day=20,... kd_day=9,10...
  if(short_day>long_day) {  //確保short_day<long_day
    let temp=short_day;
    short_day=long_day;
    long_day=temp;
  }
  //Calculate the TP=Typical Price[]=1 to 2000. short EMA, long EMA.
  let TP;              //取用TP=Typical Price=(H+L+4C)/6, 自創。用變數,不用陣列
  const EMA_short=[];  //EMA of TP for short_day. =1 to 2000
  const EMA_long=[];   //EMA of TP for long_day.  =1 to 2000
  const MACD=[];       //MACD=EMA_short-EMA_long. =1 to 2000
  for(let i=1; i<=STK_close.length; i++) {  //i=1 to 2000
    TP=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;  //TP=Typical Price=(H+L+4C)/6
    if(i===1) {
      EMA_short[i]=TP;
      EMA_long[i]=TP; }
    else {
      EMA_short[i]=EMA_short[i-1]*(short_day-1)/(short_day+1)+TP*(2/(short_day+1));
      EMA_long[i]=EMA_long[i-1]*(long_day-1)/(long_day+1)+TP*(2/(long_day+1));
    }
    MACD[i]=EMA_short[i]-EMA_long[i];  //=1 to 2000. 例:MACD[]=EMA(10)-EMA(20)
  }
  //第一層Stochastic, 先求最近kd_day根MACD最高&最低,kd_day=9,10...
  const K1=[];    //K1[]=10 to 2000, Stochastic of MACD, 0~100
  const D1=[];    //D1[]=10 to 2000, EMA of K1[], 0~100
  for(let i=kd_day; i<=STK_close.length; i++) {  //i=10 to 2000
    let max=MACD[i-kd_day+1], min=MACD[i-kd_day+1];  //先假設第1根MACD最高&最低
    for(let j=i-kd_day+2; j<=i; j++) {  //j=2 to i(=10)
      if(MACD[j]>max) max=MACD[j];
      if(MACD[j]<min) min=MACD[j];
    }
    //第一層隨機值
    if(max===min) {
      K1[i]=100; }   //避免除以0,若最高=最低,則K1=100
    else {
      K1[i]=(MACD[i]-min)/(max-min)*100;   //Stochastic of MACD, 0~100
    }
    //第一次平滑,對K[]做EMA, 以kd_day為週期, 產生D1[]
    if(i===kd_day) {   //i=10,第1個D1[]值=第1個K[]值
      D1[i]=K1[i]; }   //第1個D1[]值=第1個K[]值
    else {
      D1[i]=(kd_day-1)/(kd_day+1)*D1[i-1]+(2/(kd_day+1))*K1[i];  //i>=11
    }
  }
  //上述是第一層Stochastic, 產生D1[]值, 
  // 接下來是第二層Stochastic, 先求最近kd_day根D1最高&最低,kd_day=9,10...
  // STC=Schaff Trend Cycle, 好像STC[]=D2[]
  const K2=[];   //K2[]=19 to 2000, Stochastic of D1[], 0~100
  const STC=[];  //STC[]=19 to 2000, Stochastic of K2[], 0~100. 好像STC[]=D2[]
  for(let i=kd_day*2-1; i<=STK_close.length; i++) {  //i=19 to 2000
    let max=D1[i-kd_day+1], min=D1[i-kd_day+1];  //先假設第1根D1最高&最低,D1[]=10
    for(let j=i-kd_day+2; j<=i; j++) {  //j=11 to i(=19)
      if(D1[j]>max) max=D1[j];
      if(D1[j]<min) min=D1[j];
    }
    if(max===min) {
      K2[i]=100; }   //避免除以0,若最高=最低,則K2=100
    else {
      K2[i]=(D1[i]-min)/(max-min)*100;   //Stochastic of D1[], 0~100
    }
    if(i===kd_day*2-1) {   //i=19,第1個STC[]值=第1個K2[]值
      STC[i]=K2[i]; }       //第1個STC[]值=第1個K2[]值, STC[]=19
    else {
      STC[i]=(kd_day-1)/(kd_day+1)*STC[i-1]+(2/(kd_day+1))*K2[i];  //i>=20
    }

  }
  return { STC };  //STC[]=19 to 2000, Stochastic of K2[], 0~100 
  //drawing these figures in the small windows.
  //if kd_day=10, then STC[]=19 to  2000.  (19=kd_day*2-1)
}
window.SchaffTrend = SchaffTrend;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-09===重新設計======
// BOLL寶林帶(Bollinger Bands)   (No.44)
// upperBand=MA+2SD, middleBand=MA, lowerBand=MA-2SD
// SD=sqrt[sum(C-MA)/n]
// upperBand-lowerBand=4SD <不用>
// percentB=(C-lowerBand)/(upperBand-lowerBand)*100
// Bandwith=(upperBand-lowerBand)/middleBand*100
function BollingerBandsNew(STK_close, ma_day) {
  // Menu Name: BollingerBands New     // ma_day=10
  const MA=[];         // =middleBand[], =10 to 2000
  const upperBand=[];  // =MA+2SD, =10 to 2000
  const lowerBand=[];  // =MA-2SD, =10 to 2000
  const SD=[];         // SD(Standard Deviation), =10 to 2000
  //const upperBand_lowerBand=[];  //upperBand-lowerBand=4SD
  const percentB=[]; // current price position in the Bollinger Bands
  const Bandwith=[]; // Bollinger Bandwidth 
  let sum=0;
  //compute MA[], MA_day=10, MA[]=10,11,...,2000
  for(let i=1; i<=ma_day; i++) {   //i=1 to 10
    sum=sum+STK_close[i];
  }
  MA[ma_day]=sum/ma_day;    //first MA[10]=sum/10
  for(let i=ma_day+1; i<=STK_close.length; i++) {  //i=11 to 2000
    sum=sum-STK_close[i-ma_day]+STK_close[i];   //先扣除舊的，再加新的
    MA[i]=sum/ma_day;       //second MA[11]=sum/10
  }
  //compute first SD(Standard Deviation), SD[]=10 to 2000
  const k=2;   // Standard deviation multiplier (typically 2)
  let sum_SD=0;
  for(let i=1; i<=ma_day; i++) {  //i=1 to 10
    sum_SD=sum_SD+(STK_close[i]-MA[i])**2; //平方=x**2，或=Math.pow(x,2)
  }
  SD[ma_day]=Math.sqrt(sum_SD/ma_day);  //first SD[10],開根號=Math.sqrt()
  //Calculate upperBand and lowerBand for the first time
  upperBand[ma_day]=MA[ma_day]+k*SD[ma_day];  //first upperBand[10]
  lowerBand[ma_day]=MA[ma_day]-k*SD[ma_day];  //first lowerBand[10]
  //======================以上計算是所有指標的第1個數值。
  //======以下計算所有指標的其餘數值  SD[]=11,12,...2000
  for(let i=ma_day+1; i<=STK_close.length; i++) {  //i=11 to 2000
    sum_SD=0;   //SD[]=11,...,2000都要重新計算
    for(let j=i-ma_day+1; j<=i; j++) {  //j=2 to 11
      sum_SD=sum_SD+(STK_close[j]-MA[i])**2;  //平方=x**2，或=Math.pow(x,2)
    }
    SD[i]=Math.sqrt(sum_SD/ma_day);   //second SD[11]
    upperBand[i]=MA[i]+k*SD[i];       //second upperBand[11]
    lowerBand[i]=MA[i]-k*SD[i];       //second lowerBand[11]
    percentB[i]=(STK_close[i]-lowerBand[i])/(upperBand[i]-lowerBand[i])*100; 
    Bandwith[i]=(upperBand[i]-lowerBand[i])/MA[i]*100; //second Bandwith[11]
  }
  return { upperBand, MA, lowerBand, percentB, Bandwith };
  //Normally drawing the upperBand, MA, lowerBand figures in the K_Line area.
  //drawing the percentB[], Bandwith[] figures in the small window.
  //if ma_day=10,these Indicators[]=10 to 2000.
}
window.BollingerBandsNew = BollingerBandsNew;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-10======================
//Fisher Transform Indicator     (No.42)
// Fisher Transform(費雪轉換) 是由John Ehlers提出的技術分析指標，
// 其目的是將價格資料轉換成接近常態分布(Gaussian Distribution)，
// 使價格的轉折點(Turning Points)更加明顯，便於判斷買賣時機。
function FisherTransform(STK_high, STK_low, STK_close, Fisher_day, esp) {
  // Menu Name: Fisher    //Fisher_day=10, 20,...  //esp=9, 10, ...
  let Xt=0;  //Xt=0~1,價格正規化=將收盤價映射至0～1之間
  const Yt = [];    //Yt=-1~+1 =2*Xt-1, =10 to 2000
  const Fisher=[];  //Fisher Transform, =10 to 2000
  const Signal=[];  //使用EMA平滑Fisher值作為訊號線, =10 to 2000
  for(let i=Fisher_day; i<=STK_close.length; i++) {  //i=10 to 2000
    let max_High=STK_high[i-Fisher_day+1]; //先假設第1根K線最高&最低
    let min_Low=STK_low[i-Fisher_day+1];   //先假設第1根K線最高&最低
    for(let j=i-Fisher_day+2; j<=i; j++) {  //j=2 to i(=10)
      if(STK_high[j]>max_High) max_High=STK_high[j];
      if(STK_low[j]<min_Low) min_Low=STK_low[j];
      //這裡只算第1個Yt[9]的值
      if(j==(Fisher_day-1)) {  //j=10-1=9
        if(max_High==min_Low) {  //避免除以0
          Xt=1;}
        else {
          Xt=(STK_close[Fisher_day-1]-min_Low)/(max_High-min_Low); //Xt=0~1,第1個
        }
        Yt[Fisher_day-1]=2*Xt-1;     //這裡只算Yt[9]的值,初值
      }
    }
    //價格正規化(Normalization)到0~1之間
    if(max_High==min_Low) {  //避免除以0
      Xt=1;}
    else {
      Xt=(STK_close[i]-min_Low)/(max_High-min_Low); //Xt=0~1,第1個
    }
    //轉換為 -1～+1,Yt=2*Xt-1;  //Yt=-1~+1
    //平滑化(John Ehlers原始公式),John Ehlers建議先對輸入值進行遞迴平滑
    Yt[i]=0.33*(2*Xt-1)+0.67*Yt[i-1];     //first Yt[]= 10 to 2000
    //為避免分母為零或自然對數無定義，需將輸入值限制在 -0.999<=YYt<=0.999
    let YYt=Math.min(0.999, Math.max(-0.999, Yt[i])); //+1取0.999, -1取-0.999
    Fisher[i]=(0.5)*Math.log((1+YYt)/(1-YYt));  //Fisher Transform核心公式
    //有些平台則使用EMA平滑Fisher值作為訊號線。
    if(i===Fisher_day) {      //i=10
      Signal[i]=Fisher[i]; }  //Signal[10]初值
    else {
      Signal[i]=(esp-1)/(esp+1)*Signal[i-1]+(2/(esp+1))*Fisher[i];
    }
  }
  return { Fisher, Signal }; 
  //drawing these figures in the small windows.
  //if Fisher_day=10, then Fisher[], Signal[]=10 to 2000.
}
window.FisherTransform = FisherTransform;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-11=================
// Average Moving Envelope(MA Envelope，移動平均包絡線)是一種  (No.41)
// 以移動平均線(Moving Average)為中心，向上與向下各偏移固定百分比
// 所形成的通道型技術指標。其主要用途是判斷價格是否偏離平均值過遠，
// 以及識別可能的支撐、阻力與超買、超賣區域。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function MA_Envelope(STK_close, esp, kk) {
  // Menu Name: MA Envelope(EMA)    // esp=9,10,...,  kk=3,4,5%,...
  const EMA=[];   //中軌(Middle Band),以EMA取代MA=Replace MA with EMA
  const upper=[]; //Upper Envelope(上包絡線)=EMA*(1+k), =10 to 2000
  const lower=[]; //Lower Envelope(下包絡線)=EMA*(1-k), =10 to 2000
  let sum=0;
  for(let i=1; i<=esp; i++) {  //i=1 to 10
    sum=sum+STK_close[i];
  }
  EMA[esp]=sum/esp;                //first EMA[]=10
  upper[esp]=(1+kk/100)*EMA[esp];  //first value[]=10
  lower[esp]=(1-kk/100)*EMA[esp];  //first value[]=10
  for(let i=esp+1; i<=STK_close.length; i++) {  //i=11 to 2000
    EMA[i]=(esp-1)/(esp+1)*EMA[i-1]+2/(esp+1)*STK_close[i];
    upper[i]=(1+kk/100)*EMA[i];
    lower[i]=(1-kk/100)*EMA[i];
  }
  return { EMA, upper, lower };
  //Normally drawing these figures in the K_Line area.
  //if esp=10,these Indicators[]=10 to 2000.
}
window.MA_Envelope = MA_Envelope;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-12==================================
// Rainbow Oscillator  (No.41)  <比較Rainbow Moving Average彩虹移動平均	(No.71)>
// Rainbow Oscillator(彩虹振盪器,RO)是由Mel Widner於1997年提出的技術分析指標，
// 利用多層移動平均線(Rainbow MAs)衡量價格偏離程度，以判斷市場動能及超買/超賣狀態。
function RainbowOsc(STK_high, STK_low, STK_close, ma_day) {
  // Menu Name: Rainbow Osc     // ma_day=10,...
  const MA1=[];  //基本移動平均MA,第1條MA, =10 to 2000
  const MA2=[], MA3=[], MA4=[], MA5=[];
  const MA6=[], MA7=[], MA8=[], MA9=[];
  const Rainbow=[];   //=Close-avg(MA1+MA2+...+MA9), =10 to 2000
  let sum=0;
  for(let i=1; i<=ma_day; i++) {  //i=1 to 10(ma_day)
    sum=sum+(STK_high[i]+STK_low[i]+4*STK_close[i])/6; //此式取代Close
  }
  MA1[ma_day]=sum/ma_day;  //first MA1[]=10
  MA2[ma_day]=MA1[ma_day]; MA3[ma_day]=MA1[ma_day];
  MA4[ma_day]=MA1[ma_day]; MA5[ma_day]=MA1[ma_day];
  MA6[ma_day]=MA1[ma_day]; MA7[ma_day]=MA1[ma_day];
  MA8[ma_day]=MA1[ma_day]; MA9[ma_day]=MA1[ma_day];
  let TypicalPrice=0;  let Avg=0; let N=ma_day;
  TypicalPrice=(STK_high[N]+STK_low[N]+4*STK_close[N])/6;
  Avg=(MA1[N]+MA2[N]+MA3[N]+MA4[N]+MA5[N]+MA6[N]+MA7[N]+MA8[N]+MA9[N])/9;
  Rainbow[ma_day]=TypicalPrice-Avg;
  for(let i=ma_day+1; i<=STK_close.length; i++) {  //i=11 to 2000
    sum=sum-(STK_high[i-N]+STK_low[i-N]+4*STK_close[i-N])/6; //先減舊
    sum=sum+(STK_high[i]+STK_low[i]+4*STK_close[i])/6;       //再加新
    MA1[i]=sum/ma_day;   //second MA1[]=11
    MA2[i]=(MA1[i]+MA1[i-1])/2;   MA3[i]=(MA2[i]+MA2[i-1])/2;
    MA4[i]=(MA3[i]+MA3[i-1])/2;   MA5[i]=(MA4[i]+MA4[i-1])/2;
    MA6[i]=(MA5[i]+MA5[i-1])/2;   MA7[i]=(MA6[i]+MA6[i-1])/2;
    MA8[i]=(MA7[i]+MA7[i-1])/2;   MA9[i]=(MA8[i]+MA8[i-1])/2;
    TypicalPrice=(STK_high[i]+STK_low[i]+4*STK_close[i])/6;
    Avg=(MA1[i]+MA2[i]+MA3[i]+MA4[i]+MA5[i]+MA6[i]+MA7[i]+MA8[i]+MA9[i])/9;
    Rainbow[i]=TypicalPrice-Avg;
  }
  return { Rainbow, MA1,MA2,MA3,MA4,MA5,MA6,MA7,MA8,MA9 };
  //This case, drawing these figures in the small windows.
  //Normally drawing these figures in the K_Line area.
  //if ma_day=10,these Indicators[]=10 to 2000.
}
window.RainbowOsc = RainbowOsc;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-12==================================
// Bill Williams Awesome Oscillator  (No.36)
// Bill Williams Awesome Oscillator(AO,驚奇振盪器)是由Bill Williams提出的動量指標，
// 用於衡量短期動能與長期動能之間差異。它以中間價格(Median Price)為基礎，而非收盤價。
function AwesomeOscillator(STK_high, STK_low, day1, day2) {
  // Menu Name: Awesome Osc     // day1=5,...  day2=34,...
  let temp;
  if(day1>day2) {  // Ensure day1 < day2
    temp=day1; day1=day2; day2=temp;
  }
  const SMA1=[];    //Simple MA, SMA1[]=day1 to 2000
  const SMA2=[];    //Simple MA, SMA2[]=day2 to 2000
  const AwesomeOsc=[]; //=SMA5-SMA34
  //Calculate SMA1[]=day1 to 2000
  let sum1=0;   //for SMA1[]
  for(let i=1; i<=day1; i++) {  //i=1 to 5(day1)
    sum1=sum1+(STK_high[i]+STK_low[i])/2; //此式取代Close
  }
  SMA1[day1]=sum1/day1;   //first SMA1[]=[day1]
  //Calculate SMA2[]=day2 to 2000
  let sum2=0;   //for SMA2[]
  for(let i=1; i<=day2; i++) {  //i=1 to 34(day2)
    sum2=sum2+(STK_high[i]+STK_low[i])/2; //此式取代Close
  }
  SMA2[day2]=sum2/day2;   //first SMA2[]=[34]
  //一起計算SMA1[],SMA2[],AwesomeOsc[]
  for(let i=day1+1; i<=STK_high.length; i++) {  //i=5+1 to 2000
    sum1=sum1-(STK_high[i-day1]+STK_low[i-day1])/2; //減舊
    sum1=sum1+(STK_high[i]+STK_low[i])/2;           //加新
    SMA1[i]=sum1/day1;
    if(i===day2) {  //i=34, first value=AwesomeOsc[34]
      AwesomeOsc[i]=SMA1[i]-SMA2[day2]; //=SMA1[34]-SMA2[34]
    }
    if(i>=day2+1) {  //i>=34+1   //Calculate SMA2[]
      sum2=sum2-(STK_high[i-day2]+STK_low[i-day2])/2; //減舊
      sum2=sum2+(STK_high[i]+STK_low[i])/2;           //加新
      SMA2[i]=sum2/day2;
      AwesomeOsc[i]=SMA1[i]-SMA2[i]; //=SMA1[35]-SMA2[35]
    }
  }
  return { AwesomeOsc };
  //drawing these figures in the small windows.
  //if day1=5, day2=34, then AwesomeOsc[]=34 to 2000.
}
window.AwesomeOscillator = AwesomeOscillator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-13==================================
//Choppiness Index    (No.32)
//Choppiness Index(CI,震盪指數)是由澳洲交易員E.W. Dreiss提出的技術分析指標，
// 用於衡量市場是處於盤整(Choppy)還是趨勢(Trending)狀態。CI不判斷趨勢方向，
// 只衡量市場的「混亂程度」。
//ATR[]=TR的指數平滑移動平均,ATR均幅指標(ATR, Average True Range)
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function ChoppinessIndex(STK_high, STK_low, STK_close, num) {
  // Menu Name: Choppiness     // num=9, 10, ...
  const TR=[];  //TR=真實波幅(True Range),TR是陣列不是變數
  let temp1, temp2, temp3;
  //只計算TR[]=2 to 2000
  for(let i=2; i<=STK_close.length; i++) {  //i=2 to 2000
    temp1 = STK_high[i] - STK_low[i];
    temp2 = Math.abs(STK_high[i] - STK_close[i-1]);
    temp3 = Math.abs(STK_low[i] - STK_close[i-1]);
    TR[i] = Math.max(temp1, temp2, temp3);
  }
  //Calculate Choppiness Index
  const Choppiness=[];   //if num=10, then Choppiness[]=11 to 2000.
  let max_High, min_Low;
  let sum_TR=0;   //sum(TR[])
  for(let i=num+1; i<=STK_close.length; i++) {  //i=11 to 2000
    max_High=STK_high[i-num+1];  //[2]
    min_Low=STK_low[i-num+1];    //[2]
    sum_TR=TR[i-num+1];             //[2]
    for(j=(i-num+2); j<=i; j++) {  //3 to 11
      if(STK_high[j]>max_High) {
        max_High=STK_high[j];  }
      if(min_Low>STK_low[j]) {
        min_Low=STK_low[j];  }
      sum_TR=sum_TR+TR[j];    //sum from TR[3] to TR[11]
    }
    if(max_High===min_Low) {
      Choppiness[i]=100;   }
    else {  //[11], first value
      Choppiness[i]=100*(Math.log10(sum_TR)-Math.log10(max_High-min_Low))/Math.log10(num);
    }
  }
  return { Choppiness };
  // drawing these figures in the small windows.
  // if num=10, then Choppiness[]=11 to 2000.
}
window.ChoppinessIndex = ChoppinessIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-13==================================
//True Strength Index(TSI)    (No.31)
//True Strength Index(TSI, 真實強弱指標)是由 William Blau 提出的動量指標，
// 利用價格變動(Price Change, PC)進行兩次指數移動平均(EMA)平滑，
// 再與價格變動絕對值的兩次EMA相除，以衡量市場動能。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function TrueStrengthIndex(STK_close, esp1, esp2, m) {
  // Menu Name: TSI     // esp1=25, esp2=13, m=7,8,9,...訊號線(Signal Line)
  // 1.計算價格變動(Price Change), 2.計算價格變動的絕對值
  const PC=[]; //PC[]=PriceChange=[]; //價格變動(Price Change), =2 to 2000
  const abs_PC=[];  //價格變動的絕對值, =2 to 2000
  for(let i=2; i<=STK_close.length; i++) {  //i=2 to 2000
    PC[i]=STK_close[i]-STK_close[i-1];
    abs_PC[i]=Math.abs(STK_close[i]-STK_close[i-1]);
  }
  //3.第一次EMA平滑, 對PC[]=PriceChange[]做第一次EMA, esp1=25
  const EMA_PC=[];          //=2 to 2000
  const EMA_abs_PC=[];      //=2 to 2000
  EMA_PC[2]=PC[2];         //initial value
  EMA_abs_PC[2]=abs_PC[2]; //initial value
  for(let i=3; i<=STK_close.length; i++) {  //i=3 to 2000
    EMA_PC[i]=(esp1-1)/(esp1+1)*EMA_PC[i-1]+2/(esp1+1)*PC[i];
    EMA_abs_PC[i]=(esp1-1)/(esp1+1)*EMA_abs_PC[i-1]+2/(esp1+1)*abs_PC[i];
  }
  //4.第二次EMA平滑,再對第一次EMA做第二次EMA, esp2=13. //5.True Strength Index(TSI)
  const EMA2_PC=[];     //=2 to 2000
  const EMA2_abs_PC=[]; //=2 to 2000
  const TSI=[];                 //=2 to 2000
  const Signal=[];              //=2 to 2000, 訊號線(Signal Line),m=7,8,9,...
  EMA2_PC[2]=EMA_PC[2];         //initial value
  EMA2_abs_PC[2]=EMA_abs_PC[2]; //initial value
  TSI[2]=100*(EMA2_PC[2]/EMA2_abs_PC[2]); //initial value
  Signal[2]=TSI[2];  //initial value
  for(let i=3; i<=STK_close.length; i++) {  //i=3 to 2000
    EMA2_PC[i]=(esp2-1)/(esp2+1)*EMA2_PC[i-1]+2/(esp2+1)*EMA_PC[i];
    EMA2_abs_PC[i]=(esp2-1)/(esp2+1)*EMA2_abs_PC[i-1]+2/(esp2+1)*EMA_abs_PC[i];
    TSI[i]=100*(EMA2_PC[i]/EMA2_abs_PC[i]);
    Signal[i]=(m-1)/(m+1)*Signal[i-1]+2/(m+1)*TSI[i];
  } 
  return { TSI, Signal };
  // drawing these figures in the small windows.
  // these indicators[]=2 to 2000.
}
window.TrueStrengthIndex = TrueStrengthIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-14==================================
//Relative Volatility Index(RVI)    (No.29)
//由Donald Dorsey提出的技術指標，其概念與RSI(Relative Strength Index)相似，
// 但RSI使用價格變動幅度，而RVI使用標準差(Standard Deviation)來衡量波動性的強弱。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function RelativeVolatilityIndex(STK_close, SD_num, esp) {
  // Menu Name: Relative Volati     //SD_num=10, esp=14
  const MA=[];  //Moving Average, =10 to 2000
  //Calculate MA[]= 10 to 2000
  let sum=0;
  for(let i=1; i<=SD_num; i++) {
    sum=sum+STK_close[i];
  }
  MA[SD_num]=sum/SD_num;   //first average MA[10]
  for(let i=SD_num+1; i<=STK_close.length; i++) {  //=11 to 2000
    sum=sum-STK_close[i-SD_num]+STK_close[i]; //減舊加新
    MA[i]=sum/SD_num;  //MA[11] to 2000
  }
  //1.Calculate Standard Deviation(SD), SD_num=10
  //2.區分上漲與下跌波動. 3.計算平滑平均. 4.計算Relative Volatility Index (RVI)
  const SD=[];       //Standard Deviation(SD), SD_num=10, =10 to 2000
  const Upper_SD=[]; //if C(t)>C(t-1), Upper_SD[]=SD[], =10 to 2000
  const Down_SD=[];  //if C(t)<C(t-1), Down_SD[]=SD[], =10 to 2000
  const EMA_Upper_SD=[];  //Upper_SD[]的EMA, =10 to 2000
  const EMA_Down_SD=[];   //Down_SD[]的EMA,  =10 to 2000
  const RVI=[], eRVI=[];  //=100*(EMA_Upper_SD)/(EMA_Upper_SD+EMA_Down_SD)
  for(let i=SD_num; i<=STK_close.length; i++) {  //=10 to 2000
    sum=0;
    for(let j=i-SD_num+1; j<=i; j++){  //j=1 to 10
      sum=sum+(STK_close[j]-MA[i])**2;
    }
    SD[i]=Math.sqrt(sum/SD_num); //SD[]=10 to 2000
    switch (true) {
      case(STK_close[i]>STK_close[i-1]):  //上漲
        Upper_SD[i]=SD[i];
        Down_SD[i]=0;
        break;
      case(STK_close[i]<STK_close[i-1]):  //下跌
        Upper_SD[i]=0;
        Down_SD[i]=SD[i];
        break;
      default:                            //平盤
        Upper_SD[i]=0;
        Down_SD[i]=0;
    }
    if(i===SD_num) {
      EMA_Upper_SD[i]=Upper_SD[i];  //initial value=[10]
      EMA_Down_SD[i]=Down_SD[i]; }  //initial value=[10]
    else {
      EMA_Upper_SD[i]=(esp-1)/(esp+1)*EMA_Upper_SD[i-1]+2/(esp+1)*Upper_SD[i];
      EMA_Down_SD[i]=(esp-1)/(esp+1)*EMA_Down_SD[i-1]+2/(esp+1)*Down_SD[i];
    }
    if((EMA_Upper_SD[i]+EMA_Down_SD[i])===0) {
      RVI[i]=100; }
    else {
      RVI[i]=100*EMA_Upper_SD[i]/(EMA_Upper_SD[i]+EMA_Down_SD[i]);
    }
    if(i===SD_num) {  //initial value eRVI[10]
      eRVI[SD_num]=RVI[SD_num]; }
    else {
      eRVI[i]=(esp-1)/(esp+1)*eRVI[i-1]+2/(esp+1)*RVI[i];  //自創新
    }
  }
  return { RVI, eRVI };
  // drawing these figures in the small windows.
  // if SD_num=10, then these indicators[]=10 to 2000.
}
window.RelativeVolatilityIndex = RelativeVolatilityIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-15==================================
//Range Expansion Index(REI)    (No.28)
//Range Expansion Index (REI,區間擴張指標)是由Thomas DeMark所提出的動能指標，
// 用來衡量價格是否處於超買或超賣狀態，並辨識市場是否可能反轉。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function RangeExpansionIndex(STK_high, STK_low, REI_length, esp) {
  // Menu Name: REI        //REI_length=8,  esp=9,...
  // 1.計算每一期的價格變化Xt[]=3 to 2000
  const Xt=[];   //=3 to 2000
  for(let i=3; i<=STK_high.length; i++) {  //i=3 to 2000
    Xt[i]=(STK_high[i]-STK_high[i-2])+(STK_low[i]-STK_low[i-2]);
  }
  // 2.Qualification(資格條件),只有符合下列其中一組條件，才令Qt=Xt
  // JavaScript邏輯OR(或)運算子：||  。 邏輯AND(且)運算子：&&
  const Qt=[];  // =7 to 2000
  for(let i=7; i<=STK_high.length; i++) {  //i=7 to 2000
    if((STK_high[i]>=STK_low[i-5] && STK_high[i-1]>=STK_low[i-6]) || (STK_low[i]<=STK_high[i-5] && STK_low[i-1]<=STK_high[i-6])) {
      Qt[i]=Xt[i]; }
    else {
      Qt[i]=0;
    }
  }
  //以上是計算Qt[]=7 to 2000
  //5.Range Expansion Index (REI,區間擴張指標)
  let sum_N;     //3.分子(Numerator)：通常採用最近8根K棒。第1個Qt[]=[7]
  let sum_D;     //4.分母(Denominator)：取同樣期間價格變動絕對值
  const REI=[];  //=14 to 2000, 第1個Qt[7],而REI_length=8,所以第1個REI=[14]
  const eREI=[]; //自創新Signal Line, =14 to 2000
  for(let i=7+REI_length-1; i<=STK_high.length; i++) { //i=14(7+8-1) to 2000
    sum_N=0;  //3.分子(Numerator)：通常採用最近8根K棒。第1個Qt[]=[7]
    sum_D=0;  //4.分母(Denominator)：取同樣期間價格變動絕對值.
    for(let j=i-7; j<=i; j++) {  //第1次=7 to 14
      sum_N=sum_N+Qt[j];    //第1個Qt[]=[7]
      sum_D=sum_D+Math.abs(STK_high[j]-STK_high[j-2])+Math.abs(STK_low[j]-STK_low[j-2]);
    }
    if(sum_D===0) {
      REI[i]=100; }  //避免分母=0. //第1個REI[14]
    else {
      REI[i]=100*(sum_N/sum_D);   //=分子/分母
    }
    if(i===(7+REI_length-1)) {   //first eREI[]=[14]
      eREI[7+REI_length-1]=REI[7+REI_length-1]; } //自創新Signal Line, =14 to 2000
    else {
      eREI[i]=(esp-1)/(esp+1)*eREI[i-1]+2/(esp+1)*REI[i]; //自創新Signal Line
    }
  }
  return { REI, eREI };
  // drawing these figures in the small windows.
  // if REI_length=8, these indicators[]=14(7+8-1) to 2000.
}
window.RangeExpansionIndex = RangeExpansionIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-16==================================
//Polarized Fractal Efficiency(PFE)極化分形效率    (No.27)
//Polarized Fractal Efficiency (PFE)是由Hans Hannula提出的技術分析指標，
// 用來衡量價格走勢的效率(Efficiency)，並結合方向性(Polarized)。它是根據
// Fractal Geometry(分形幾何)的概念建立。PFE的值介於-100到+100 左右
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function PolarizedFractalEfficiency(STK_close, num, esp) {
  // Menu Name: Polarized(PFE)        //num=PFE_length=10,  esp=9,...
  // 1.計算起點與終點的直線距離 D_straight[]=11 to 2000
  // 2.計算實際走過的路徑長度
  const PFE=[], ePFE=[];  //極化分形效率, =11 to 2000. ePFE[]=Signal Line
  const D_straight=[];    //1.計算起點與終點的直線距離, =11 to 2000
  const D_path=[]         //2.計算實際走過的路徑長度, =11 to 2000
  let Efficiency;         //=上述二者相除, 0<=Efficiency<=1
  let sum=0;
  for(let i=num+1; i<=STK_close.length; i++) {  //i=10+1 to 2000
    D_straight[i]=Math.sqrt(STK_close[i]-STK_close[i-num]**2+num**2);
    sum=0;
    for(let j=i-num+1; j<=i; j++) {  //j=2 to 11
      sum=sum+Math.sqrt((STK_close[j]-STK_close[j-1])**2+1);
    }
    D_path[i]=sum;   //first value D_path[]=[11]
    // 3.效率值Efficiency
    Efficiency=D_straight[i]/D_path[i];
    switch (true) {
      case STK_close[i]>STK_close[i-num]:
        PFE[i]=100*Efficiency;
        break;
      case STK_close[i]<STK_close[i-num]:
        PFE[i]=-100*Efficiency;
        break;
      default:
        PFE[i]=0;
    }
    if(i===num+1) {     //first value =[11]
      ePFE[i]=PFE[i]; }
    else {
       ePFE[i]=(esp-1)/(esp+1)*ePFE[i-1]+2/(esp+1)*PFE[i];
    }
  }
  return { PFE, ePFE };
  // drawing these figures in the small windows.
  // if num=PFE_length=10, these indicators[]=11 to 2000.
}
window.PolarizedFractalEfficiency = PolarizedFractalEfficiency;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-17==================================
//Relative Vigor Index(RVI)相對活力指標    (No.24)
//是由 John Ehlers 提出的技術分析指標，用於衡量價格趨勢的強弱。其基本理念是：
//在上升趨勢中，收盤價通常接近最高價；在下降趨勢中，收盤價通常接近最低價。
//RVI的計算方式與Stochastic Oscillator類似，但它利用收盤價與開盤價之差 
//(Close-Open)，並以最高價與最低價之差(High-Low)作為標準化基準。
function RelativeVigorIndex(STK_open,STK_high,STK_low,STK_close,RVI_day) {
  // Menu Name: RVI        // RVI_day=10,...
  // 1.計算每日分子與分母,分子N(t)=C(t)-O(t),分母D(t)=H(t)-L(t),=4 to 2000
  // 2.四期加權移動平均,RVI使用 1-2-2-1 的加權方式平滑分子與分母。
  const smoothing_Nt=[];  //分子平滑(numerator smoothing), =4 to 2000
  const smoothing_Dt=[];  //分母平滑(numerator smoothing), =4 to 2000
  let t1, t2, t3, t4;
  for(let i=4; i<=STK_close.length; i++) {  //i=4 to 2000
    //計算：分子N(t)=C(t)-O(t),=4 to 2000
    t1=STK_close[i]-STK_open[i];     t2=STK_close[i-1]-STK_open[i-1];
    t3=STK_close[i-2]-STK_open[i-2]; t4=STK_close[i-3]-STK_open[i-3];
    smoothing_Nt[i]=(t1+2*t2+2*t3+t4)/6; //分子平滑=4 to 2000
    //計算：分母D(t)=H(t)-L(t),=4 to 2000
    t1=STK_high[i]-STK_low[i];     t2=STK_high[i-1]-STK_low[i-1];
    t3=STK_high[i-2]-STK_low[i-2]; t4=STK_high[i-3]-STK_low[i-3];
    smoothing_Dt[i]=(t1+2*t2+2*t3+t4)/6; //分母平滑=4 to 2000
  }
  // 3.計算RVI. 一般使用N日SMA(通常為10日).
  const RVI=[];   //分子平滑除以分母平滑,=smoothing_Nt/smoothing_Dt
  let sum1=0; let sum2=0;
  for(let i=3+RVI_day; i<=STK_close.length; i++) { //=13(4+10-1) to 2000
    sum1=0; sum2=0;
    for(let j=i-RVI_day+1; j<=i; j++) {  // j=4 to 13
      sum1=sum1+smoothing_Nt[j];  //分子平滑
      sum2=sum2+smoothing_Dt[j];  //分母平滑
    }
    RVI[i]=sum1/sum2;  //first value RVI[]=[13]
  }
  // 4.Signal Line. RVI的訊號線也是採用 1-2-2-1 加權平均.
  const Signal=[];  //=16 to 2000.  <RVI_day+3+3=16>
  for(let i=6+RVI_day; i<=STK_close.length; i++) { //=16(6+10) to 2000
    Signal[i]=(RVI[i]+2*RVI[i-1]+2*RVI[i-2]+RVI[i-3])/6;
  }
  return { RVI, Signal };
  // drawing these figures in the small windows.
  // if RVI_day=10, RVI[]=13 to 2000. Signal[]=16 to 2000.
}
window.RelativeVigorIndex = RelativeVigorIndex;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-17==================================
//Aroon Oscillator(AO)阿隆震盪指標    (No.21)
//Aroon Oscillator是由Tushar Chande於1995 年提出的技術分析指標，
// 用來衡量市場趨勢的強弱與方向。它是由Aroon Up與Aroon Down兩個指標相減而得。
function AroonOscillator(STK_high, STK_low, Aroon_day) {
  // Menu Name: Aroon Osc        //Aroon_day=25,...
  const AroonOsc=[];  //Aroon Oscillator(AO)阿隆震盪指標, =25 to 2000
  let max_High; let min_Low;   //設最高價、最低價
  let days_High; let days_Low  //標記25天內第幾天是最高價、最低價
  let count=0;   //計數25天內的迴圈,是第幾圈
  for(let i=Aroon_day; i<=STK_high.length; i++) {  //i=25 to 2000
    max_High=STK_high[i-Aroon_day+1];  //設第1筆=最高價
    min_Low=STK_low[i-Aroon_day+1];    //設第1筆=最低價
    count=1;  //迴圈外先設=1
    days_High=count;  //=1
    days_Low=count;   //=1
    for(let j=i-Aroon_day+2; j<=i; j++) {  //j=1+1 to 25
      count=count+1;   //=2
      if(max_High<STK_high[j]) {
        max_High=STK_high[j];
        days_High=count;     //標記25天內第幾天是最高價
      }
      if(min_Low>STK_low[j]) {
        min_Low=STK_low[j];
        days_Low=count;      //標記25天內第幾天是最低價
      }
    }
    //Aroon Oscillator=100*(DaysLow-DaysHigh)/N
    AroonOsc[i]=100*((Aroon_day-days_Low)-(Aroon_day-days_High))/Aroon_day;
    //上式化簡=100*(days_High-days_Low)/Aroon_day
  }
  return { AroonOsc };
  // drawing these figures in the small windows.
  // if Aroon_day=25, AroonOsc[]=25 to 2000.
}
window.AroonOscillator = AroonOscillator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-17==================================
//Standard Deviation Indicator(STD)標準差指標    (No.20)
//標準差指標，STD或Standard Deviation，是一種衡量價格波動程度(Volatility)
// 的技術指標。它直接計算指定期間內價格的標準差(Standard Deviation)，
// 數值越大表示波動越劇烈，數值越小表示市場較平穩。
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function StandardDeviationIndicator(STK_close, SD_num, esp) {
  // Menu Name: STD     //SD_num=10, esp=9,10,...//自創新
  const MA=[];  //Moving Average, =10 to 2000
  //Calculate MA[]= 10 to 2000
  let sum=0;
  for(let i=1; i<=SD_num; i++) {  //i=1 to 10(=SD_num)
    sum=sum+STK_close[i];
  }
  MA[SD_num]=sum/SD_num;   //first average MA[10]
  for(let i=SD_num+1; i<=STK_close.length; i++) {  //=11 to 2000
    sum=sum-STK_close[i-SD_num]+STK_close[i]; //減舊加新
    MA[i]=sum/SD_num;  //MA[11] to 2000
  }
  //1.Calculate Standard Deviation(SD), SD_num=10
  const SD=[], eSD=[];  //Standard Deviation(SD), SD_num=10, =10 to 2000
  for(let i=SD_num; i<=STK_close.length; i++) {  //=10 to 2000
    sum=0;
    for(let j=i-SD_num+1; j<=i; j++){  //j=1 to 10
      sum=sum+(STK_close[j]-MA[i])**2;
    }
    SD[i]=Math.sqrt(sum/SD_num); //SD[]=10 to 2000
    if(i===SD_num) {             //initial value eSD[10]
      eSD[SD_num]=SD[SD_num]; }
    else {
      eSD[i]=(esp-1)/(esp+1)*eSD[i-1]+2/(esp+1)*SD[i];  //自創新
    }
  }
  return { SD, eSD };
  // drawing these figures in the small windows.
  // if SD_num=10, then these indicators[]=10 to 2000.
}
window.StandardDeviationIndicator = StandardDeviationIndicator;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-18==================================
//Internal Bar Strength (IBS), IBS=(C-L)/(H-L)   (No.14)
//IBS是一種非常簡單但實用的價格位置指標，用來衡量收盤價位於當日最高價與最低價區間中的
//相對位置。它最早由Larry Connors等量化交易研究者廣泛應用於均值回歸(Mean Reversion)策略。
function InternalBarStrength(STK_high, STK_low, STK_close, esp) {
  // Menu Name: IBS        //esp=9,...
  const IBS=[], eIBS=[];   //=1 to 2000
  for(let i=1; i<=STK_high.length; i++) {  //i=1 to 2000
    if(STK_high[i]===STK_low[i]) { 
       IBS=[i]=1; }  //or =0.5
    else {
      IBS[i]=(STK_close[i]-STK_low[i])/(STK_high[i]-STK_low[i]);
    }
    if(i===1) { 
      eIBS[i]=IBS[i]; }
    else {
      eIBS[i]=(esp-1)/(esp+1)*eIBS[i-1]+2/(esp+1)*IBS[i]; //自創新
    }
  }
  return { IBS, eIBS };
  // drawing these figures in the small windows.
  // IBS[], eIBS[]=1 to 2000.
}
window.InternalBarStrength = InternalBarStrength;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-19==================================
//Williams %R(Williams Percent Range，簡稱 Williams %R 或 WPR)是由Larry Williams
// 提出的動能震盪指標，用來衡量目前收盤價在最近 N個交易期間價格區間中的相對位置。
//%R=-100*(Hn-C)/(Hn-Ln)   (No.7)
function WilliamsPercentRange(STK_high, STK_low, STK_close, WPR_day) {
  // Menu Name: WilliamsPctRange    //WPR_day=10,...
  const WilliamsPctRange=[];    //10(=WPR_day) to 2000.
  let max_High; let min_Low;
  for(let i=WPR_day; i<=STK_high.length; i++) {  //i=10 to 2000
    max_High=STK_high[i-WPR_day+1];  //=[1]
    min_Low=STK_low[i-WPR_day+1];    //=[1]
    for(let j=i-WPR_day+2; j<=i; j++) {  //=2 to 10
      if(STK_high[j]>max_High) {
        max_High=STK_high[j];  }
      if(STK_low[j]<min_Low) {
        min_Low=STK_low[j];  }
    }
    if(max_High===min_Low) {
      WilliamsPctRange[i]=0; }
    else {
      WilliamsPctRange[i]=(-100)*(max_High-STK_close[i])/(max_High-min_Low);
    }
  }
  return { WilliamsPctRange };
  // drawing these figures in the small windows.
  // if WPR_day=10, then WilliamsPctRange[]=10 to 2000.
}
window.WilliamsPercentRange = WilliamsPercentRange;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-18==================================
//Follow-The-Way Strategy,完全自行創新投資哲學 
function AlphaBetaMA(STK_high, STK_low, STK_close, ma_day, alpha, beta) {
  // Menu Name: AlphaBetaMA     //ma_day=10,..., alpha=3%, beta=5%
  const TypicalPrice=[];    //=1 to 2000
  for(let i=1; i<=STK_high.length; i++) {  //i=1 to 2000
    TypicalPrice[i]=(STK_high[i]+STK_low[i]+6*STK_close[i])/8;
  }
  //Calculate MA[] of TypicalPrice
  const MA=[];   //=10 to 2000
  let sum=0;
  for(let i=ma_day; i<=STK_high.length; i++) {  //i=10 to 2000
    sum=0;
    for(j=i-ma_day+1; j<=i; j++) {  //j=1 to 10
      sum=sum+TypicalPrice[j];
    }
    MA[i]=sum/ma_day;  //first value MA[]=[10], =10 to 2000
  }
  let BuyPrice=0; let SellPrice=0; 
  let ROI=0;     //Return On Investment=ROI
  let sum_ROI=0; //Cumulative ROI
  let sum_Buy_Sell_times=0;  //Cumulative number of transations
  for(let i=ma_day+2; i<=STK_high.length; i++) {  //i=12 to 2000
    //買點：(前天MA大),(昨天MA小),(今天MA大), 而且今天MA大於昨天MA有alpha%,例如3%
    if((MA[i-1]<MA[i-2] && MA[i-1]<MA[i]) && (MA[i]>(1+alpha/100)*MA[i-1])) { //大,小,大
      BuyPrice=STK_close[i]; }
    //賣點：(前天MA小),(昨天MA大),(今天MA小), 而且今天MA小於昨天MA有beta%,例如4%
    else if((MA[i-1]>MA[i-2] && MA[i-1]>MA[i]) && (MA[i]<(1-beta/100)*MA[i-1])) { //小,大,小
      SellPrice=STK_close[i];
      if(BuyPrice!=0) {
        ROI=(SellPrice-BuyPrice)/BuyPrice*100;   //Return On Investment=ROI
        sum_ROI=sum_ROI+ROI;                     //Cumulative ROI
        sum_Buy_Sell_times=sum_Buy_Sell_times+1; //Cumulative number of transations
      }
    }
  }

  console.log( "sum buy sell : ", sum_Buy_Sell_times,"sum_ROI:", sum_ROI)
  return { MA, STK_close };
  // drawing these figures in the small windows.
  // TypicalPrice[]=1 to 2000, if ma_day=10, then MA[]=10 to 2000.
}
window.AlphaBetaMA = AlphaBetaMA;
//----------------------------------------------------------------------

//===designed by Prof Wang,原2026-March-30設計==新設計2026-July-21===
//Laguerre RSI = Laguerre Relative Strength Index,   <No.132>
//由Laguerre filter設計的RSI, 由Prof Wang設計, 2026-March-30. 
//指數平滑移動平均的參數:exponential smoothing parameter(esp)
function LaguerreRSI(STK_close, Gamma_value, esp) {
  // Menu Name: Laguerre RSI   //esp=9,10,...
  // gamma=0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99
  // Laguerre filter的四個變數L0, L1, L2, L3的前一個值
  if(Gamma_value>=10) { Gamma_value=9.9; } //控制在 0.5<=Gamma<=0.99
  if(Gamma_value<=5)  { Gamma_value=5;   }
  let Gamma=Gamma_value/10;
  let cum_Up=0; let cum_Down=0;    //計算上漲/下跌動能
  let L0; let L1; let L2; let L3;
  let L0prev; let L1prev; let L2prev; let L3prev;
  L0prev=STK_close[1]; L1prev=STK_close[1];  //Laguerre filter的第一個變數L0=0 
  L2prev=STK_close[1]; L3prev=STK_close[1];  //Laguerre filter的第四個變數L3=0
  const LaguerreRSI=[];     //Laguerre RSI=2 to 2000
  const eLaguerreRSI=[];    //自創, =2 to 2000
  for(let i=2; i<=STK_close.length; i++) {   //i=2 to 2000 
    L0=(1-Gamma)*STK_close[i]+Gamma*L0prev;  //Laguerre filter的第一個變數L0
    L1=-Gamma*L0+L0prev+Gamma*L1prev;        //Laguerre filter的第二個變數L1
    L2=-Gamma*L1+L1prev+Gamma*L2prev;        //Laguerre filter的第三個變數L2
    L3=-Gamma*L2+L2prev+Gamma*L3prev;        //Laguerre filter的第四個變數L3
    // 計算上漲/下跌動能。下列二式簡潔扼要！
    cum_Up=Math.max(L0-L1,0)+Math.max(L1-L2,0)+Math.max(L2-L3,0);
    cum_Down=Math.max(L1-L0,0)+Math.max(L2-L1,0)+Math.max(L3-L2,0);
    // Calculate Laguerre RSI
    if((cum_Up+cum_Down)===0) {
      LaguerreRSI[i]=0; }
    else {
      LaguerreRSI[i]=cum_Up/(cum_Up+cum_Down)*100;
    }
    if(i===2) {                          //自創的eLaguerreRSI[], =2 to 2000
      eLaguerreRSI[i]=LaguerreRSI[i]; }  // initial value
    else {
      eLaguerreRSI[i]=(esp-1)/(esp+1)*eLaguerreRSI[i-1]+2/(esp+1)*LaguerreRSI[i];
    }
    //在second time: 設定Laguerre filter的四個變數L0, L1, L2, L3的前一個值
    L0prev=L0; L1prev=L1; L2prev=L2; L3prev=L3;
  }
  return { LaguerreRSI, eLaguerreRSI };
  //Plot these indicator figures in a small window.
  //LaguerreRSI[], eLaguerreRSI[]=2 to 2000.
}
window.LaguerreRSI = LaguerreRSI;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-21==================================
//Instantaneous Trendline瞬時趨勢線。自行找資料設計。
//Instantaneous Trendline(瞬時趨勢線，簡稱 ITrend)是由John F. Ehlers提出的低延遲趨勢濾波器。
//比Moving Average更低lag、即時估計市場趨勢、減少phase delay、更快偵測轉折、同時保持平滑 
function InstantaneousTrendline(STK_high, STK_low, STK_close, Alpha_value) {
  // Menu Name: Inst Trend     //alpha= 0.05~0.2
  //以TP=TypicalPrice替代MedianPrice=(H+L)/2.
  const TP=[];      //TypicalPrice=[]; //=1 to 2000
  for(let i=1; i<STK_high.length; i++) {  //i=1 to 2000
    TP[i]=(STK_high[i]+STK_low[i]+6*STK_close[i])/8;
  }
  if(Alpha_value<=5)  { Alpha_value=5; }  //控制alpha= 0.05~0.2
  if(Alpha_value>=20) { Alpha_value=20; }
  let Alpha=Alpha_value/100;  //alpha= 0.05~0.2
  let A=Alpha;   //因為Alpha太長了,以A替代
  //Calculate IT[]=InstTrend[]
  const IT=[];       //InstTrend=[]; //=1 to 2000
  const Trigger=[];  //Trigger Line交易訊號。Trigger(k)=2*IT(k)-IT(k-2)
  IT[1]=TP[1];   IT[2]=TP[2];  //initial values
  for(let i=3; i<STK_high.length; i++) {    //i=3 to 2000
    IT[i]=(A-A*A/4)*TP[i]+0.5*(A*A)*TP[i-1]-(A-0.75*A*A)*TP[i-2]+2*(1-A)*IT[i-1]-((1-A)**2)*IT[i-2];
    Trigger[i]=2*IT[i]-IT[i-2];
  }
  return { IT, Trigger };
  // drawing these figures in the small windows.
  // IT[]=1 to 2000.  Trigger[]=3 to 2000
}
window.InstantaneousTrendline = InstantaneousTrendline;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-23==================================
//傳統RSI(Relative Strength Index)
//此程式是完整的RSI設計，2026-Feb-24原設計以收盤價為主，
// 2026-07-23改版以Typical Price取代收盤價。程式設計理念也改變。
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
function RSI_TP(STK_high, STK_low, STK_close, RSI_day, esp) {
  // Menu Name: RSI(Typical Price)     //RSI_day=10,..., esp=9,...
  const TP=[]; //TP[]=TypicalPrice=[]; //=1 to 2000,以TypicalPrice取代Close
  for(let i=1; i<=STK_high.length; i++) {  //i=1 to 2000
    TP[i]=(STK_high[i]+STK_low[i]+6*STK_close[i])/8;
  }
  // First calculate RSI
  const RSI=[], eRSI=[];
  const dif=[];   //dif=今收盤-昨收盤
  for(let i=2; i<=STK_close.length; i++) {  //i=2 to 2000
    dif[i]=TP[i]-TP[i-1];                   //dif[]=2 to 2000
  }
  //compute the first RSI[]. if day=10, RSI[]=11 to 2000.
  let sum_Up;   //最近 n 日收盤價漲幅之和
  let sum_Dn;   //最近 n 日收盤價跌幅之和
  for(let i=RSI_day+1; i<=STK_close.length; i++) {  //=11 to 2000
    sum_Up=0;  sum_Dn=0;   //每一輪都要歸0.
    for(let j=i-RSI_day+1; j<=i; j++) {  //j=2 to 11
      if(dif[j] > 0) {
        sum_Up = sum_Up + dif[j]; }   //收盤價漲幅之和
      else {
        //sum_Dn = sum_Dn - dif[j];  //此式是正確的，一定要用負號
        sum_Dn=sum_Dn+Math.abs(dif[j]);   //收盤價跌幅之和
      }
    }
    if((sum_Up+sum_Dn) === 0) {  //if RSI_day=10 then first =RSI[11]
      RSI[i]=100; }
    else {
      RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    if(i===RSI_day+1) {
      eRSI[RSI_day+1]=RSI[RSI_day+1] }  //eRSI的初值=eRSI[11]
    else {
      eRSI[i]=(esp-1)/(esp+1)*eRSI[i-1]+2/(esp+1)*RSI[i];
    }
  }
  return { RSI, eRSI };
  // if RSI_day=10 then RSI[], eRSI[]=11,12,...,2000.
  // drawing the RSI[], eRSI[] figures in the small windows.
}
window.RSI_TP = RSI_TP;
//----------------------------------------------------------------------

//===designed by Prof Wang, 2026-July-24==================================
// Adaptive RSI(自適應相對強弱指數)是將傳統RSI(Relative Strength Index)
// 與Adaptive Cycle Detection(自適應週期偵測)結合的指標。
//RSI的計算週期不固定，而是隨市場的主循環(Dominant Cycle)自動調整。
//Adaptive RSI並沒有唯一的標準公式，不同作者(如John Ehlers、TradingView社群
// 、MetaStock等}有不同實作方式
// 指數平滑移動平均的參數:exponential smoothing parameter(esp)
function AdaptiveRSI(STK_high, STK_low, STK_close, esp) {
  // Menu Name: Adaptive RSI   //esp=3, 5.   RSI_day是動態的,沒有固定的值.
  const TP=[];  //TP[]=TypicalPrice=[]; //=1 to 2000, 以TypicalPrice取代Close
  for(let i=1; i<=STK_high.length; i++) {  //i=1 to 2000
    TP[i]=(STK_high[i]+STK_low[i]+6*STK_close[i])/8;
  }
  // First 計算價格變化, dif=P(t)-P(t-1)
  const dif=[];   //dif=今收盤-昨收盤=今TP-昨TP
  for(let i=2; i<=STK_close.length; i++) {  //i=2 to 2000
    dif[i]=TP[i]-TP[i-1];                   //dif[]=2 to 2000
  }
  //Calculate Q(t)
  const Q=[];  //Quadrature, Q[]=7 to 2000
  for(let i=7; i<=STK_close.length; i++) { //i=7 to 2000
    Q[i]=0.0962*TP[i]+0.5769*TP[i-2]-0.5769*TP[i-4]-0.0962*TP[i-6];
  }
  //Calculate Re[], Im[], 相位差=atan(Im[]/Re[]), I(t)=TP(t-3)
  //Re[]=I(t)*I(t-1)+Q(t)*Q(t-1),  Im[]=I(t)*Q(t-1)-Q(t)*I(t-1)
  const Re=[], Im=[], dif_phase=[];  //=8 to 2000
  const DC=[]; //主循環週期:Dominant Cycle(DC), DC(t)=360/dif_phase
  const Period=[]; //Adaptive RSI週期: Period=DC/2,每一天都重新決定RSI長度(週期)
  for(let i=8; i<=STK_close.length; i++) {  //i=8 to 2000
    Re[i]=TP[i-3]*TP[i-4]+Q[i]*Q[i-1];    //=I(t)*I(t-1)+Q(t)*Q(t-1)
    Im[i]=TP[i-3]*Q[i-1]-Q[i]*TP[i-4];    //=I(t)*Q(t-1)-Q(t)*I(t-1)
    dif_phase[i]=Math.atan(Im[i]/Re[i]);  //相位差=atan(Im[]/Re[])
    //主循環週期:Dominant Cycle(DC), DC(t)=360/dif_phase, 10≤DC(t)≤48
    DC[i]=360/dif_phase[i];
    if(DC[i]<10) { DC[i]=10; }  //10≤DC(t)≤48
    if(DC[i]>48) { DC[i]=48; }  //10≤DC(t)≤48
    // 5.Adaptive RSI週期: Period[]=DC[]/2, 每一天都重新決定RSI長度(週期)
    Period[i]=Math.round(DC[i]/2);  //四捨五入. =8 to 2000
  }
  //Calculate Adaptive RSI, 通常再加EMA
  //because 10≤DC(t)≤48, so i=48 to 2000
  const Adaptive_RSI=[], eAdaptive_RSI=[]; //Adaptive RSI通常再加EMA.=48 to 2000
  let sum_Up;      //最近 n 日收盤價漲幅之和
  let sum_Dn;      //最近 n 日收盤價跌幅之和
  let RSI_Period;  //要計算RSI的時間長度,例如10天。
  for(let i=48; i<=STK_close.length; i++) {  //i=48 to 2000
    RSI_Period=Period[i];  //ex. RSI_Period=Period[48]=10
    sum_Up=0;  sum_Dn=0;   //每一輪都要歸0.
    for(let j=i-RSI_Period+1; j<=i; j++) { //j=48-10+1=39 to 48
      if(dif[j] > 0) {
        sum_Up = sum_Up + dif[j]; }   //收盤價漲幅之和
      else {
        sum_Dn=sum_Dn+Math.abs(dif[j]);   //收盤價跌幅之和
      }
    }
    if((sum_Up+sum_Dn) === 0) {
      Adaptive_RSI[i]=100; }
    else {
      Adaptive_RSI[i]=sum_Up/(sum_Up+sum_Dn)*100;
    }
    if(i===48) {
      eAdaptive_RSI[i]=Adaptive_RSI[i] } //eAdaptive_RSI的初值=Adaptive_RSI[48]
    else {
      eAdaptive_RSI[i]=(esp-1)/(esp+1)*eAdaptive_RSI[i-1]+2/(esp+1)*Adaptive_RSI[i];
    }
  }
  return { Adaptive_RSI, eAdaptive_RSI };
  // drawing these figures in the small windows.
  // these indicators[]=48 to 2000.
}
window.AdaptiveRSI = AdaptiveRSI;
//----------------------------------------------------------------------



//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------


//===designed by Prof Wang, 2026-Jan-19====Redesigned on 2026-Feb-22
//Exponential Moving Average,重新設計EMA,取名KingEMA
//指數平滑的天數: exponential smoothing parameter(esp)
function KingEMA(values, esp) {
  //values=STK_close, esp=ema_n=9,10,...
  const completeEMA=[], simpleEMA=[];
  //First EMA value is SMA
  let sum=0;
  for(let i=1; i<esp; i++) {  //例如: i=1 to 10
    sum=sum+values[i]; }
  EMA[esp]=sum/esp;      //EMA(10)=sum/10
  //Subsequent EMA values
  for(let i=esp+1; i<values.length; i++) {  //i=11 to 2000
    completeEMA[i]=(esp-1)/(esp+1)*completeEMA[i-1]+2/(esp+1)*values[i];
    //EMA今=(n-1)/(n+1)*EMA昨+2/(n+1)*MA今
  }
  //simpleEMA, the first simpleEMA[1]=values[1]
  simpleEMA[1]=values[1];
  //simpleEMA[]=1,2,...,2000
  for(let i=2; i<values.length; i++) {  
    simpleEMA[i]=(esp-1)/(esp+1)*simpleEMA[i-1]+2/(esp+1)*values[i];
  }
  return { completeEMA, simpleEMA };
  // 傳回完整的EMA與simpleEMA數列
  // drawing the completeEMA[],simpleEMA[] figure in the K_Line area window.
  // if esp=10, then completeEMA[]=10,11,...,2000
  // simpleEMA[]=1,2,...,2000
  // 如上程式設計比較簡單,在前幾十筆的結果會有一點差異,之後沒什差異
}
window.KingEMA = KingEMA;
//----------------------------------------------------------------------

//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------
//----------------------------------------------------------------------


// Export functions for global use
if (typeof window !== 'undefined') {
  if (typeof computeADO === 'function') window.computeADO = computeADO;
  if (typeof computeVAO === 'function') window.computeVAO = computeVAO;
}

//----------------------------------------------------------------------

//----------------------------------------------------------------------





// Williams %R
function computeWilliamsR_OLD(highs, lows, closes, period = 14) {
  const williamsR = [];
  
  for (let i = period - 1; i < closes.length; i++) {
    const currentClose = closes[i];
    
    let highestHigh = highs[i];
    let lowestLow = lows[i];
    
    for (let j = 0; j < period; j++) {
      highestHigh = Math.max(highestHigh, highs[i - j]);
      lowestLow = Math.min(lowestLow, lows[i - j]);
    }
    
    const wr = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
    williamsR.push(wr);
  }
  
  return williamsR;
}

// CCI (Commodity Channel Index)
function computeCCI_OLD(highs, lows, closes, period = 20) {
  const typicalPrices = [];
  const cci = [];
  
  // Calculate Typical Price (TP)
  for (let i = 0; i < closes.length; i++) {
    typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  
  // Calculate CCI
  for (let i = period - 1; i < typicalPrices.length; i++) {
    // Simple Moving Average of TP
    let smaTP = 0;
    for (let j = 0; j < period; j++) {
      smaTP += typicalPrices[i - j];
    }
    smaTP /= period;
    
    // Mean Deviation
    let meanDeviation = 0;
    for (let j = 0; j < period; j++) {
      meanDeviation += Math.abs(typicalPrices[i - j] - smaTP);
    }
    meanDeviation /= period;
    
    // CCI = (TP - SMA of TP) / (0.015 * Mean Deviation)
    const cciValue = (typicalPrices[i] - smaTP) / (0.015 * meanDeviation);
    cci.push(cciValue);
  }
  
  return cci;
}

// ADX (Average Directional Index)
function computeADX(highs, lows, closes, period = 14) {
  const trueRanges = [];
  const plusDMs = [];
  const minusDMs = [];
  
  // Calculate True Range, +DM, and -DM
  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    const prevClose = closes[i - 1];
    
    // True Range
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    trueRanges.push(Math.max(tr1, tr2, tr3));
    
    // Directional Movement
    const highDiff = high - prevHigh;
    const lowDiff = prevLow - low;
    
    const plusDM = (highDiff > lowDiff && highDiff > 0) ? highDiff : 0;
    const minusDM = (lowDiff > highDiff && lowDiff > 0) ? lowDiff : 0;
    
    plusDMs.push(plusDM);
    minusDMs.push(minusDM);
  }
  
  // Calculate smoothed values
  const smoothedTRs = computeSmoothedAverage(trueRanges, period);
  const smoothedPlusDMs = computeSmoothedAverage(plusDMs, period);
  const smoothedMinusDMs = computeSmoothedAverage(minusDMs, period);
  
  // Calculate DI+ and DI-
  const plusDI = [];
  const minusDI = [];
  const dx = [];
  
  for (let i = 0; i < smoothedTRs.length; i++) {
    const plusDIValue = (smoothedPlusDMs[i] / smoothedTRs[i]) * 100;
    const minusDIValue = (smoothedMinusDMs[i] / smoothedTRs[i]) * 100;
    
    plusDI.push(plusDIValue);
    minusDI.push(minusDIValue);
    
    // DX
    const diSum = plusDIValue + minusDIValue;
    const diDiff = Math.abs(plusDIValue - minusDIValue);
    dx.push(diSum !== 0 ? (diDiff / diSum) * 100 : 0);
  }
  
  // ADX is smoothed average of DX
  const adx = computeSmoothedAverage(dx, period);
  
  return {
    adx: adx,
    plusDI: plusDI.slice(plusDI.length - adx.length),
    minusDI: minusDI.slice(minusDI.length - adx.length)
  };
}

// Helper function for smoothed average (Wilder's smoothing)
function computeSmoothedAverage_OLD(values, period) {
  const smoothed = [];
  
  // First value is SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  smoothed.push(sum / period);
  
  // Subsequent values use Wilder's smoothing
  for (let i = period; i < values.length; i++) {
    const prevSmoothed = smoothed[smoothed.length - 1];
    const newSmoothed = (prevSmoothed * (period - 1) + values[i]) / period;
    smoothed.push(newSmoothed);
  }
  
  return smoothed;
}

/* This is old Bollinger Bands //
// Bollinger Bands
function computeBollingerBands(values, period = 20, stdDev = 2) {
  //const sma = computeMA(values, period);
  const sma = KingMA(values, period);
  const upperBand = [];
  const lowerBand = [];
  for (let i = period - 1; i < values.length; i++) {
    const smaValue = sma[i - (period - 1)];
    // Calculate standard deviation
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(values[i - j] - smaValue, 2);
    }
    const standardDeviation = Math.sqrt(variance / period);
    upperBand.push(smaValue + (stdDev * standardDeviation));
    lowerBand.push(smaValue - (stdDev * standardDeviation));
  }
  return {
    middle: sma,
    upper: upperBand,
    lower: lowerBand
  };
}
*/

//===designed by Prof Wang, 2026-Feb-28==================
// BOLL寶林帶(Bollinger Bands)
// upperBand=MA+2SD, middleBand=MA, lowerBand=MA-2SD
// SD=sqrt[sum(C-MA)/n]
// upperBand-lowerBand=4SD
// percentB=(C-lowerBand)/(upperBand-lowerBand)*100
// Bandwith=(upperBand-lowerBand)/middleBand*100
function BollingerBands(K_close, MA_day, SD_day) {
  // Menu Name: BollingerBands   // MA_day=10, SD_day=20, for example
  const MA=[];         // =middleBand[]
  const upperBand=[];  // =MA+2SD
  const lowerBand=[];  // =MA-2SD
  const SD=[];         // SD(Standard Deviation)
  const upperBand_lowerBand=[];  //upperBand-lowerBand=4SD
  const percentB=[];   // B percent布林極限％B
  const Bandwith=[];   // wide the Bollinger Bands 
  let sum=0;
  //compute MA[], MA_day=10, MA[]=10,11,...,2000
  for(let i=1; i<MA_day; i++) {   //i=1 to 10
    sum=sum+K_close[i];
  }
  MA[MA_day]=sum/MA_day;     //first MA[10]=sum/10
  for(let i=MA_day+1; i<K_close.length; i++) {  //i=11 to 2000
    sum=sum-K_close[i-MA_day]+K_close[i];   //先扣除舊的，再加新的
    MA[i]=sum/MA_day;       //second MA[11]=sum/10
  }
  //compute SD(Standard Deviation), SD[]=29,30,...,2000
  let sum_SD=0;
  for(let i=MA_day; i<MA_day+SD_day-1; i++) {  //i=10 to 29(=10+20-1)
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
  for(let i=MA_day+SD_day; i<K_close.length; i++) {  //i=30(10+20) to 2000
    //sum_SD先扣除舊的，再加新的
    sum_SD=sum_SD-(K_close[i-SD_day]-MA[i-SD_day])**2+(K_close[i]-MA[i])**2;
    SD[i]=Math.sqrt(sum_SD/SD_day);   //second SD[30]
    upperBand[i]=MA[i]+2*SD[i];       //first=[29]
    lowerBand[i]=MA[i]-2*SD[i];
    upperBand_lowerBand[i]=4*SD[i];   //second =[30]
    percentB[i]=(K_close[i]-lowerBand[i])/(upperBand[i]-lowerBand[i])*100;
    Bandwith[i]=(upperBand[i]-lowerBand[i])/MA[tp]*100;
  }
  return { upperBand, MA, lowerBand };
  //return { upperBand, MA, lowerBand, percentB, Bandwith };
  //return upperBand_lowerBand, percentB, Bandwith;
  //Normally drawing the upperBand, MA, lowerBand figures in the K_Line area.
  //MA_day=10, SD_day=20, THREE Indicators[]=29,30,...,2000.
  //drawing the upperBand_lowerBand, percentB, Bandwith figures in the small window.
}
window.BollingerBands = BollingerBands;
//----------------------------------------------------------------------

// Average True Range (ATR)
function computeATR_OLD(highs, lows, closes, period = 14) {
  const trueRanges = [];
  
  for (let i = 1; i < closes.length; i++) {
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }
  
  return computeSmoothedAverage(trueRanges, period);
}

// Parabolic SAR
function computeParabolicSAR(highs, lows, acceleration = 0.02, maximum = 0.2) {
  const sar = [];
  const trends = []; // true for uptrend, false for downtrend
  
  if (highs.length < 2) return sar;
  
  // Initialize
  let trend = highs[1] > highs[0]; // Initial trend
  let af = acceleration;
  let ep = trend ? highs[1] : lows[1]; // Extreme point
  let sarValue = trend ? lows[0] : highs[0];
  
  sar.push(sarValue);
  trends.push(trend);
  
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    
    // Calculate SAR
    sarValue = sarValue + af * (ep - sarValue);
    
    // Check for trend reversal
    const reversal = trend ? low <= sarValue : high >= sarValue;
    
    if (reversal) {
      // Trend reversal
      trend = !trend;
      sarValue = ep;
      af = acceleration;
      ep = trend ? high : low;
    } else {
      // Continue current trend
      if (trend) {
        if (high > ep) {
          ep = high;
          af = Math.min(af + acceleration, maximum);
        }
        // SAR cannot be above previous or current low
        sarValue = Math.min(sarValue, low, i > 0 ? lows[i - 1] : low);
      } else {
        if (low < ep) {
          ep = low;
          af = Math.min(af + acceleration, maximum);
        }
        // SAR cannot be below previous or current high
        sarValue = Math.max(sarValue, high, i > 0 ? highs[i - 1] : high);
      }
    }
    
    sar.push(sarValue);
    trends.push(trend);
  }
  
  return { sar, trends };
}

// Ichimoku Cloud
function computeIchimoku(highs, lows, closes, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) {
  const tenkanSen = [];
  const kijunSen = [];
  const chikouSpan = [];
  const senkouA = [];
  const senkouB = [];
  
  // Helper function to calculate midpoint of high/low over period
  const calculateMidpoint = (startIdx, period) => {
    let high = highs[startIdx];
    let low = lows[startIdx];
    
    for (let j = 1; j < period && startIdx - j >= 0; j++) {
      high = Math.max(high, highs[startIdx - j]);
      low = Math.min(low, lows[startIdx - j]);
    }
    
    return (high + low) / 2;
  };
  
  for (let i = Math.max(tenkanPeriod, kijunPeriod) - 1; i < highs.length; i++) {
    // Tenkan-sen (Conversion Line)
    if (i >= tenkanPeriod - 1) {
      tenkanSen.push(calculateMidpoint(i, tenkanPeriod));
    }
    
    // Kijun-sen (Base Line)
    if (i >= kijunPeriod - 1) {
      kijunSen.push(calculateMidpoint(i, kijunPeriod));
    }
    
    // Chikou Span (Lagging Span) - current close displaced backwards
    chikouSpan.push(closes[i]);
  }
  
  // Senkou A (Leading Span A) - average of Tenkan and Kijun displaced forward
  for (let i = 0; i < Math.min(tenkanSen.length, kijunSen.length); i++) {
    senkouA.push((tenkanSen[i] + kijunSen[i]) / 2);
  }
  
  // Senkou B (Leading Span B) - midpoint of 52-period high/low displaced forward
  for (let i = senkouBPeriod - 1; i < highs.length; i++) {
    senkouB.push(calculateMidpoint(i, senkouBPeriod));
  }
  
  return {
    tenkanSen,
    kijunSen,
    chikouSpan,
    senkouA,
    senkouB
  };
}

//===designed by Prof Wang, adapted 2026-July-19============================
// Bollinger Bands with 4SD output (upperBand-lowerBand, percentB, Bandwith)
// MA_day=10, SD_day=20 → output arrays are 1-based, first value at [MA_day+SD_day-1]
function computeBollinger4SD(K_close, MA_day, SD_day) {
  const MA=[], upperBand=[], lowerBand=[], SD=[];
  const upperBand_lowerBand=[], percentB=[], Bandwith=[];
  let sum=0;
  for(let i=1; i<=MA_day; i++) { sum=sum+K_close[i]; }
  MA[MA_day]=sum/MA_day;
  for(let i=MA_day+1; i<=K_close.length; i++) {
    sum=sum-K_close[i-MA_day]+K_close[i];
    MA[i]=sum/MA_day;
  }
  let sum_SD=0;
  for(let i=MA_day; i<=MA_day+SD_day-1; i++) {
    sum_SD=sum_SD+(K_close[i]-MA[i])**2;
  }
  let tp=MA_day+SD_day-1;
  SD[tp]=Math.sqrt(sum_SD/SD_day);
  upperBand[tp]=MA[tp]+2*SD[tp];
  lowerBand[tp]=MA[tp]-2*SD[tp];
  upperBand_lowerBand[tp]=4*SD[tp];
  percentB[tp]=(K_close[tp]-lowerBand[tp])/(upperBand[tp]-lowerBand[tp])*100;
  Bandwith[tp]=(upperBand[tp]-lowerBand[tp])/MA[tp]*100;
  for(let i=MA_day+SD_day; i<=K_close.length; i++) {
    sum_SD=sum_SD-(K_close[i-SD_day]-MA[i-SD_day])**2+(K_close[i]-MA[i])**2;
    SD[i]=Math.sqrt(sum_SD/SD_day);
    upperBand[i]=MA[i]+2*SD[i];
    lowerBand[i]=MA[i]-2*SD[i];
    upperBand_lowerBand[i]=4*SD[i];
    percentB[i]=(K_close[i]-lowerBand[i])/(upperBand[i]-lowerBand[i])*100;
    Bandwith[i]=(upperBand[i]-lowerBand[i])/MA[tp]*100;
  }
  return { upperBand_lowerBand, percentB, Bandwith };
}
window.computeBollinger4SD = computeBollinger4SD;
//----------------------------------------------------------------------

//===designed by Prof Wang, adapted 2026-July-19============================
// Sliding-window RSI: 0-based input/output array.  No esp smoothing.
// Returns array same length as closes; null until index [period].
function slidingWindowRSI(closes, period) {
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
window.slidingWindowRSI = slidingWindowRSI;
//----------------------------------------------------------------------

// Export functions for global use
if (typeof window !== 'undefined') {
  window.computeEMA = computeEMA;
  window.computeMA = computeMA;
  window.computeMACD = computeMACD;
  window.computeRSI = computeRSI;
  // window.computeKD = computeKD;
  // window.computeWilliamsR = computeWilliamsR;
  // window.computeCCI = computeCCI;
  window.computeADX = computeADX;
  window.computeSmoothedAverage = computeSmoothedAverage;
  // window.computeBollingerBands = computeBollingerBands;
  // window.computeATR = computeATR;
  window.computeParabolicSAR = computeParabolicSAR;
  window.computeIchimoku = computeIchimoku;
  // window.computeDMA = computeDMA;
  // window.computeK2D2 = computeK2D2;
  // window.computeCoppockCurve = computeCoppockCurve;
  // window.computeVolMA = computeVolMA;
  // window.computeTRIX = computeTRIX;
  // window.computeASI = computeASI;
  // window.computeMFI = computeMFI;
  // window.computeOBV = computeOBV;
  // window.computeROC = computeROC;
  // window.computeADI = computeADI;
}