//===designed by Prof Wang, 2026-Feb-28==================
// BOLL寶林帶(Bollinger Bands)
// upperBand=MA+2SD, middleBand=MA, lowerBand=MA-2SD
// SD=sqrt[sum(C-MA)/n]
// upperBand-lowerBand=4SD
// percentB=(C-lowerBand)/(upperBand-lowerBand)*100
// Bandwith=(upperBand-lowerBand)/middleBand*100
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

window.computeBollinger4SD = computeBollinger4SD;