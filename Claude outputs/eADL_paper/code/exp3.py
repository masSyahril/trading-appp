import numpy as np,pandas as pd,pickle,json
from scipy import stats
from load import load,SYMS
from ind import *
from bt import *
IND,EQ=pickle.load(open('ind.pkl','rb'))
res={}
# 1) sensitivity
g=[]
for esp in [5,9,14,21]:
    for kd in [9,14,21]:
        sh=[]
        for s in SYMS:
            df,_=IND[s]; w=wang(df,esp,kd,s); sh.append(backtest(df,w.eK.values,w.eD.values,s)['Sharpe'])
        g.append(dict(esp=esp,KD_num=kd,Sharpe=np.mean(sh),beatBH=None))
G=pd.DataFrame(g); print(G.pivot(index='esp',columns='KD_num',values='Sharpe').round(3)); G.to_csv('sens.csv',index=False)
# 2) subperiods
sub=[]
for s in SYMS:
    df,o=IND[s]; mid=len(df)//2
    for per,(lo,hi) in {'P1':(WARM,mid),'P2':(mid,len(df))}.items():
        for name,(k,d) in list(STRATS.items()):
            r=backtest(df,o[k].values,o[d].values,s,lo,hi); sub.append(dict(sym=s,per=per,strat=name,Sharpe=r['Sharpe']))
        rp=rsv(df.close.values,9,df.high.values,df.low.values);K,D=closed_form(rp,8,9)
        sub.append(dict(sym=s,per=per,strat='KD price + Wang smoothing',Sharpe=backtest(df,K,D,s,lo,hi)['Sharpe']))
        sub.append(dict(sym=s,per=per,strat='Buy & Hold',Sharpe=bh(df,s,lo,hi)['Sharpe']))
S=pd.DataFrame(sub); print(S.groupby(['strat','per']).Sharpe.mean().unstack().round(3)); S.to_csv('sub.csv',index=False)
print('split dates', IND['2330.TW'][0].date.iloc[len(IND['2330.TW'][0])//2])
# 3) event study: 10-day forward return after golden cross, excess over unconditional
ev=[]
for name,(k,d) in STRATS.items():
    ex=[]
    for s in SYMS:
        df,o=IND[s]; c=df.close.values; K=o[k].values; D=o[d].values
        fr=pd.Series(c).shift(-10).values/c-1; base=np.nanmean(fr[WARM:])
        gc=np.where((K[1:]>D[1:])&(K[:-1]<=D[:-1]))[0]+1; gc=gc[(gc>=WARM)&(gc<len(c)-10)]
        ex+=list(fr[gc]-base)
    ex=np.array(ex); t=stats.ttest_1samp(ex,0)
    ev.append(dict(strat=name,N=len(ex),mean_excess_pct=100*ex.mean(),hit=np.mean(ex>0),t=t.statistic,p=t.pvalue))
E=pd.DataFrame(ev); print(E.round(4)); E.to_csv('event.csv',index=False)
# 4) H=L frequency
hl={s:int((IND[s][0].high==IND[s][0].low).sum()) for s in SYMS}; nn={s:len(IND[s][0]) for s in SYMS}
print('H=L total',sum(hl.values()),'of',sum(nn.values())); json.dump(dict(hl=hl,n=nn),open('hl.json','w'))
# 5) fallback impact: compare Wang K vs version with CLV=0 when H=L
d=[]
for s in SYMS:
    df,o=IND[s]
    if hl[s]==0: continue
    h,l,c,v=[df[x].values for x in('high','low','close','volume')]
    a=np.zeros(len(c))
    for i in range(1,len(c)): a[i]=a[i-1]+(0 if h[i]==l[i] else (2*c[i]-h[i]-l[i])/(h[i]-l[i])*v[i])
    K,D=closed_form(rsv(ema(a,0.2),9),8,9); d.append(np.nanmax(abs(K-o.W_eK.values)))
print('max |K diff| fallback vs CLV=0 per affected asset', np.round(d,2))
