  //===designed by Prof Wang, 2025-Nov-08===modify on 2026-March-14====
//DEMA指標(Double Exponential Moving Average)
//DEMA＝2*N日EMA－N日EMA的EMA。即：DEMA=2*EMA-EMA(EMA).
//function computeDEMA(EMA, DEMA, esp)
function computeDEMA(STK_close, esp) {
  const EMA=[];
  const DEMA=[];
  //esp指數平滑移動平均參數esp=9
  //計算第一個EMA(),DEMA()
  let yesterday_doubleEMA; //昨天的doubleEMA
  let today_doubleEMA;     //今天的doubleEMA
  let sum=0;
  for(let i=1; i<=esp; i++) {     //例如：let i=1 to 20
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
  //drawing the DEMA() and EMA() figures in the small windows.
  //例參數esp=20, DEMA()=EMA()=20,21,...,2000.
}
window.computeDEMA = computeDEMA;