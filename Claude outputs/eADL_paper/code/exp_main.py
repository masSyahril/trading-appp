import numpy as np,pandas as pd,pickle
from load import load,SYMS
from ind import all_ind
from bt import *
rows=[];IND={};EQ={}
for s in SYMS:
    df=load(s); o=all_ind(df,s); IND[s]=(df,o)
    for name,(k,d) in STRATS.items():
        r=backtest(df,o[k].values,o[d].values,s); EQ[(s,name)]=r.pop('eq'); rows.append(dict(sym=s,strat=name,**r))
    r=bh(df,s); EQ[(s,'Buy & Hold')]=r.pop('eq'); rows.append(dict(sym=s,strat='Buy & Hold',**r))
R=pd.DataFrame(rows); R.to_csv('res_main.csv',index=False)
pickle.dump((IND,EQ),open('ind.pkl','wb'))
pd.set_option('display.width',200)
print(R.groupby('strat')[['CAGR','Sharpe','MDD','TradesPerYr','Win','Exposure']].mean().round(3))
print(R.pivot(index='sym',columns='strat',values='Sharpe').round(2))
