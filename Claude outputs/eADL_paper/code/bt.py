import numpy as np,pandas as pd
from load import load,SYMS
from ind import all_ind
WARM=60
STRATS={'eADL-KD (Wang)':('W_eK','W_eD'),'ADL-KD (Wang)':('W_aK','W_aD'),'eADL-KD single 1/3':('eKD13_K','eKD13_D'),
        'KD(9,3,3) price':('KD_K','KD_D'),'StochRSI':('SR_K','SR_D'),'Chaikin Osc.':('CHO','ZERO')}
def costs(sym):
    if sym.endswith('.TW') or sym=='^TWII':
        sell=0.001425+(0.001 if sym=='0050.TW' or sym=='^TWII' else 0.003); return 0.001425,sell
    return 0.0005,0.0005
def backtest(df,K,D,sym,lo=WARM,hi=None):
    hi=hi or len(df)
    c=df.close.values; r=np.r_[0,c[1:]/c[:-1]-1]
    sig=(K>D).astype(float); sig[np.isnan(K)|np.isnan(D)]=0
    pos=np.r_[0,sig[:-1]]  # trade at close of signal day, earn next day
    pos=pos[lo:hi]; rr=r[lo:hi]
    b,s=costs(sym)
    ch=np.diff(np.r_[0,pos]); cost=np.where(ch>0,b,0)+np.where(ch<0,s,0)
    net=pos*rr-cost
    eq=np.cumprod(1+net); yrs=len(net)/252
    cagr=eq[-1]**(1/yrs)-1; sh=np.sqrt(252)*net.mean()/net.std() if net.std()>0 else 0
    mdd=(1-eq/np.maximum.accumulate(eq)).max()
    # trades
    ent=np.where(ch>0)[0]; ext=np.where(ch<0)[0]; wins=[];
    for e in ent:
        x=ext[ext>e]; x=x[0] if len(x) else len(pos)
        wins.append(np.prod(1+net[e:x])-1>0)
    return dict(CAGR=cagr,Sharpe=sh,MDD=mdd,Trades=len(ent),TradesPerYr=len(ent)/yrs,Win=np.mean(wins) if wins else np.nan,Exposure=pos.mean(),eq=eq)
def bh(df,sym,lo=WARM,hi=None):
    hi=hi or len(df); c=df.close.values[lo-1:hi]; net=c[1:]/c[:-1]-1; eq=np.cumprod(1+net); yrs=len(net)/252
    return dict(CAGR=eq[-1]**(1/yrs)-1,Sharpe=np.sqrt(252)*net.mean()/net.std(),MDD=(1-eq/np.maximum.accumulate(eq)).max(),Trades=1,TradesPerYr=1/yrs,Win=np.nan,Exposure=1.0,eq=eq)
