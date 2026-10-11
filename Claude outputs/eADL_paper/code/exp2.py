import numpy as np,pandas as pd,pickle
from scipy import stats
from load import load,SYMS
from ind import *
from bt import *
IND,EQ=pickle.load(open('ind.pkl','rb'))
R=pd.read_csv('res_main.csv')
out={}
# A) control: price KD with Wang's smoothing (closed form), and eADL-KD control
rows=[]
for s in SYMS:
    df,o=IND[s]
    rp=rsv(df.close.values,9,df.high.values,df.low.values)
    K,D=closed_form(rp,8,9); rows.append(dict(sym=s,strat='KD price + Wang smoothing',**{k:v for k,v in backtest(df,K,D,s).items() if k!='eq'}))
    # OBV-based with Wang smoothing (alternative volume line)
    obv=np.r_[0,np.cumsum(np.sign(np.diff(df.close.values))*df.volume.values[1:])]
    r=rsv(ema(obv,0.2),9); K,D=closed_form(r,8,9); rows.append(dict(sym=s,strat='eOBV + Wang smoothing',**{k:v for k,v in backtest(df,K,D,s).items() if k!='eq'}))
C=pd.DataFrame(rows); R2=pd.concat([R,C]); R2.to_csv('res_all.csv',index=False)
print(R2.groupby('strat')[['CAGR','Sharpe','MDD','TradesPerYr','Win']].mean().round(3).sort_values('Sharpe'))
# paired Wilcoxon Sharpe: Wang vs others
P=R2.pivot(index='sym',columns='strat',values='Sharpe')
print('\nWilcoxon (Wang eADL-KD minus X), n=15')
for c in P.columns:
    if c=='eADL-KD (Wang)':continue
    d=P['eADL-KD (Wang)']-P[c]; w=stats.wilcoxon(d)
    print(f'{c:28s} mean diff {d.mean():+.3f}  wins {int((d>0).sum())}/15  p={w.pvalue:.4f}')
P.round(3).to_csv('sharpe_pivot.csv')
