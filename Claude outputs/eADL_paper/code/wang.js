function AccuDistLine_Stochastic(STK_high, STK_low, STK_close, STK_vol, esp, KD_num) {
  // Menu Name: AccuDistLine(ADL) Stochastic    //esp=9,...KD_num=9,...   
  // AccuDistLine=ADL, most people use ADL, but I use AccuDistLine,
  // because it is more intuitive and easier to understand. //原名：ADL, ADLine
  const ADL=[];   //原程式取名:AccuDistLine=[], 本程式取名:ADL[]
  ADL[1]=0;       //初值,第1個AccuDistLine值(1)=0。避免除以0的錯誤 
  const eADL=[];  //自創新 
  eADL[1]=ADL[1]; //initial value=0
  //計算第2個AccuDistLine值(2)
  if(STK_high[2]-STK_low[2]==0) {  //分母為0,避免除以0的錯誤
    ADL[2]=(STK_close[2]/STK_close[1]-1)*STK_vol[2]+ADL[1]; } //((Ct/Ct-1)-1)*Volt
  else {
    ADL[2]=(2*STK_close[2]-STK_high[2]-STK_low[2])/(STK_high[2]-STK_low[2])*STK_vol[2]+ADL[1];
  }
  eADL[2]=(esp-1)/(esp+1)*eADL[1]+2/(esp+1)*ADL[2];
  //計算i=3 to 2000
  for(let i=3; i<=STK_close.length; i++) {   //i=3 to 2000
    if(STK_high[i]-STK_low[i]==0) {          //分母為0,避免除以0的錯誤
      ADL[i]=(STK_close[i]/STK_close[i-1]-1)*STK_vol[i]+ADL[i-1]; }
    else {
      ADL[i]=(2*STK_close[i]-STK_high[i]-STK_low[i])/(STK_high[i]-STK_low[i])*STK_vol[i]+ADL[i-1];
    } 
    eADL[i]=(esp-1)/(esp+1)*eADL[i-1]+2/(esp+1)*ADL[i];
  }
  //return { ADL, eADL };
  //==========================Calculate _K[i] and _D[i]=============
  let N=esp;
  //Calculate _K[i] and _D[i], =8 to 2000, if KD_num=9 
  //RSV=100*(X[i]-min)/(max-min)
  const ADL_KD_K=[];  //_K[]=8 to 2000, if KD_num=9
  const ADL_KD_D=[];  //_D[]=同上
  ADL_KD_K[KD_num-1]=50;  //初值[8]=50,if KD_num=9
  ADL_KD_D[KD_num-1]=50;  //同上
  let RSV=0;  //RSV=100*(X[i]-min)/(max-min)
  let max=0;  //max=Max([1]-->[9]), if KD_num=9
  let min=0;  //同上
  for(let i=KD_num; i<=STK_close.length; i++) { //i=9 to 2000
    max=ADL[i-KD_num+1];  //max=Max([1]-->[9])
    min=ADL[i-KD_num+1];  //min=Min(同上)
    for(let j=i-KD_num+2; j<=i; j++) {  //j=2 to 9, if KD_num=9
      max=Math.max(max, ADL[j]);
      min=Math.min(min, ADL[j]);
    }
    if(max===min) { RSV=50; }  //避免分母為0, RSV=50
    else {
      RSV=(ADL[i]-min)/(max-min)*100;  //first turn=[18]
    }
    let Alpha=(N-1)/(N+1);  // (1-Alpha)=2/(N+1)  //let N=esp;
    //ADL_KD_K[i]=(2/3)*ADL_KD_K[i-1]+(1/3)*RSV; //可再做一次平滑化
    //ADL_KD_D[i]=(2/3)*ADL_KD_D[i-1]+(1/3)*ADL_KD_K[i];
    //上述2列程式是舊的：(2/3, 1/3)。  下述2列程式是新的：(n-1)/(n+1), 2/(n+1) 。
    ADL_KD_K[i]=Alpha*ADL_KD_K[i-1]+(1-Alpha)*RSV; //可再做一次平滑化
    ADL_KD_D[i]=Alpha*ADL_KD_D[i-1]+(1-Alpha)*ADL_KD_K[i];
    //再做一次平滑化。<2026-Sept-20完全自行創新>
    ADL_KD_K[i]=Alpha*ADL_KD_K[i-1]+(1-Alpha)*ADL_KD_K[i];
    //ADL_KD_D[i]=Alpha*ADL_KD_D[i-1]+(1-Alpha)*ADL_KD_K[i]; //此處的再平滑,改用下式！
    //上述__KD_D[]的方程式3個權重,可以改為: (n-3)/(n+1), 2/(n+1), 2/(n+1)。 //let N=esp;
    ADL_KD_D[i]=(N-3)/(N+1)*ADL_KD_D[i-1]+2/(N+1)*ADL_KD_K[i]+2/(N+1)*ADL_KD_D[i];
  }
  return { ADL_KD_K, ADL_KD_D };
  //drawing these figures in the small windows.
  //if KD_num=9, then ADL_KD_K[],ADL_KD_D[]=8 to 2000
  // but initial values ADL_KD_K[8]=50, ADL_KD_D[8]=50.
  //ADL[], eADL[]=1,2,...,2000.
}
function AccuDistLine_eADL_Stochastic(STK_high, STK_low, STK_close, STK_vol, esp, KD_num) {
  // Menu Name: AccuDistLine(eADL) Stochastic    //esp=9,...KD_num=9,...   
  // AccuDistLine=ADL, most people use ADL, but I use AccuDistLine,
  // because it is more intuitive and easier to understand. //原名：ADL, ADLine
  const ADL=[];   //原程式取名:AccuDistLine=[], 本程式取名:ADL[]
  ADL[1]=0;       //初值,第1個AccuDistLine值(1)=0。避免除以0的錯誤 
  const eADL=[];  //自創新 
  eADL[1]=ADL[1]; //initial value=0
  //計算第2個AccuDistLine值(2)
  if(STK_high[2]-STK_low[2]==0) {  //分母為0,避免除以0的錯誤
    ADL[2]=(STK_close[2]/STK_close[1]-1)*STK_vol[2]+ADL[1]; } //((Ct/Ct-1)-1)*Volt
  else {
    ADL[2]=(2*STK_close[2]-STK_high[2]-STK_low[2])/(STK_high[2]-STK_low[2])*STK_vol[2]+ADL[1];
  }
  eADL[2]=(esp-1)/(esp+1)*eADL[1]+2/(esp+1)*ADL[2];
  //計算i=3 to 2000
  for(let i=3; i<=STK_close.length; i++) {   //i=3 to 2000
    if(STK_high[i]-STK_low[i]==0) {          //分母為0,避免除以0的錯誤
      ADL[i]=(STK_close[i]/STK_close[i-1]-1)*STK_vol[i]+ADL[i-1]; }
    else {
      ADL[i]=(2*STK_close[i]-STK_high[i]-STK_low[i])/(STK_high[i]-STK_low[i])*STK_vol[i]+ADL[i-1];
    } 
    eADL[i]=(esp-1)/(esp+1)*eADL[i-1]+2/(esp+1)*ADL[i];
  }
  //return { ADL, eADL };
  //==========================Calculate _K[i] and _D[i]=============
  let N=esp;
  //Calculate _K[i] and _D[i], =8 to 2000, if KD_num=9 
  //RSV=100*(X[i]-min)/(max-min)
  const eADL_KD_K=[];  //_K[]=8 to 2000, if KD_num=9
  const eADL_KD_D=[];  //_D[]=同上
  eADL_KD_K[KD_num-1]=50;  //初值[8]=50,if KD_num=9
  eADL_KD_D[KD_num-1]=50;  //同上
  let RSV=0;  //RSV=100*(X[i]-min)/(max-min)
  let max=0;  //max=Max([1]-->[9]), if KD_num=9
  let min=0;  //同上
  for(let i=KD_num; i<=STK_close.length; i++) { //i=9 to 2000
    max=eADL[i-KD_num+1];  //max=Max([1]-->[9])
    min=eADL[i-KD_num+1];  //min=Min(同上)
    for(let j=i-KD_num+2; j<=i; j++) {  //j=2 to 9, if KD_num=9
      max=Math.max(max, eADL[j]);
      min=Math.min(min, eADL[j]);
    }
    if(max===min) { RSV=50; }  //避免分母為0, RSV=50
    else {
      RSV=(eADL[i]-min)/(max-min)*100;  //first turn=[18]
    }
    let Alpha=(N-1)/(N+1);  // (1-Alpha)=2/(N+1)  //let N=esp;
    //eADL_KD_K[i]=(2/3)*eADL_KD_K[i-1]+(1/3)*RSV; //可再做一次平滑化
    //eADL_KD_D[i]=(2/3)*eADL_KD_D[i-1]+(1/3)*eADL_KD_K[i];
    //上述2列程式是舊的：(2/3, 1/3)。  下述2列程式是新的：(n-1)/(n+1), 2/(n+1) 。
    eADL_KD_K[i]=Alpha*eADL_KD_K[i-1]+(1-Alpha)*RSV; //可再做一次平滑化
    eADL_KD_D[i]=Alpha*eADL_KD_D[i-1]+(1-Alpha)*eADL_KD_K[i];
    //再做一次平滑化。<2026-Sept-20完全自行創新>
    eADL_KD_K[i]=Alpha*eADL_KD_K[i-1]+(1-Alpha)*eADL_KD_K[i];
    //eADL_KD_D[i]=Alpha*eADL_KD_D[i-1]+(1-Alpha)*eADL_KD_K[i]; //此處的再平滑,改用下式！
    //上述__KD_D[]的方程式3個權重,可以改為: (n-3)/(n+1), 2/(n+1), 2/(n+1)。 //let N=esp;
    eADL_KD_D[i]=(N-3)/(N+1)*eADL_KD_D[i-1]+2/(N+1)*eADL_KD_K[i]+2/(N+1)*eADL_KD_D[i];
  }
  return { eADL_KD_K, eADL_KD_D };
  //drawing these figures in the small windows.
  //if KD_num=9, then eADL_KD_K[],eADL_KD_D[]=8 to 2000
  // but initial values eADL_KD_K[8]=50, eADL_KD_D[8]=50.
  //ADL[], eADL[]=1,2,...,2000.
}
module.exports={AccuDistLine_Stochastic,AccuDistLine_eADL_Stochastic};
