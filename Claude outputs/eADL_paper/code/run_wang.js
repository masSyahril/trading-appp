const W=require('./wang.js');const fs=require('fs');
const [,,inF,outF,esp,kd]=process.argv;
const rows=fs.readFileSync(inF,'utf8').trim().split('\n').slice(1).map(l=>l.split(',').map(Number));
const H=[null],L=[null],C=[null],V=[null];
for(const r of rows){H.push(r[0]);L.push(r[1]);C.push(r[2]);V.push(r[3]);}
const a=W.AccuDistLine_eADL_Stochastic(H,L,C,V,+esp,+kd);
const b=W.AccuDistLine_Stochastic(H,L,C,V,+esp,+kd);
let out='eK,eD,aK,aD\n';
for(let i=1;i<=rows.length;i++){const f=x=>x===undefined||x===null?'':x;out+=[f(a.eADL_KD_K[i]),f(a.eADL_KD_D[i]),f(b.ADL_KD_K[i]),f(b.ADL_KD_D[i])].join(',')+'\n';}
fs.writeFileSync(outF,out);
