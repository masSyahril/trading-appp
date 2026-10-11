import numpy as np,pandas as pd,subprocess,os
from load import load
def wang(df,esp=9,kd=9,sym='x'):
    os.makedirs('tmp',exist_ok=True)
    f=f'tmp/{sym}_in.csv';o=f'tmp/{sym}_{esp}_{kd}.csv'
    df[['high','low','close','volume']].to_csv(f,index=False)
    subprocess.run(['node','run_wang.js',f,o,str(esp),str(kd)],check=True)
    r=pd.read_csv(o); r.index=df.index; return r
def adl(df):
    h,l,c,v=[df[k].values for k in('high','low','close','volume')]
    a=np.zeros(len(c))
    for i in range(1,len(c)):
        a[i]=a[i-1]+((c[i]/c[i-1]-1)*v[i] if h[i]==l[i] else (2*c[i]-h[i]-l[i])/(h[i]-l[i])*v[i])
    return a
def ema(x,g,init=None):
    y=np.empty(len(x)); y[0]=x[0] if init is None else init
    for i in range(1,len(x)): y[i]=(1-g)*y[i-1]+g*x[i]
    return y
def rsv(x,n,hi=None,lo=None):
    s=pd.Series(x); hh=(pd.Series(hi) if hi is not None else s).rolling(n).max(); ll=(pd.Series(lo) if lo is not None else s).rolling(n).min()
    r=100*(s-ll)/(hh-ll); r[(hh-ll)==0]=50; return r.values
def kd_classic(r,start,g=1/3):
    K=np.full(len(r),np.nan);D=K.copy();K[start-1]=D[start-1]=50
    for i in range(start,len(r)):
        K[i]=(1-g)*K[i-1]+g*r[i]; D[i]=(1-g)*D[i-1]+g*K[i]
    return K,D
def closed_form(r,start,N):
    """Proposition: Wang K,D in closed form"""
    g=2/(N+1); K=np.full(len(r),np.nan);D=K.copy();K1=K.copy();K[start-1]=D[start-1]=50
    for i in range(start,len(r)):
        K1[i]=(1-g)*K[i-1]+g*r[i]
        K[i]=(1-g*g)*K[i-1]+g*g*r[i]
        D[i]=(1-g-g*g)*D[i-1]+g*K[i]+g*g*K1[i]
    return K,D
def all_ind(df,sym,esp=9,kd=9):
    out=pd.DataFrame(index=df.index)
    w=wang(df,esp,kd,sym)
    # Wang 1-based: bar 1 = df row 0. outputs at index i correspond to row i-1 -> we wrote i=1..n so aligned
    out['W_eK'],out['W_eD'],out['W_aK'],out['W_aD']=w.eK,w.eD,w.aK,w.aD
    A=adl(df); eA=ema(A,2/(esp+1))
    out['ADL']=A; out['eADL']=eA
    r=rsv(eA,kd); out['RSV_e']=r
    s=kd-1  # 0-based seed row for Wang seed at 1-based index kd-1
    s0=kd-2
    K,D=closed_form(r,s0+1,esp); out['CF_K'],out['CF_D']=K,D
    K,D=kd_classic(r,s0+1); out['eKD13_K'],out['eKD13_D']=K,D   # eADL KD w/ classic 1/3 single smoothing
    rp=rsv(df.close.values,9,df.high.values,df.low.values); K,D=kd_classic(rp,8); out['KD_K'],out['KD_D']=K,D  # Taiwan KD(9,3,3)
    # StochRSI 14,14,3,3 (Wilder RSI)
    d=df.close.diff(); up=d.clip(lower=0).ewm(alpha=1/14,adjust=False).mean(); dn=(-d.clip(upper=0)).ewm(alpha=1/14,adjust=False).mean()
    rsi=100-100/(1+up/dn); st=100*(rsi-rsi.rolling(14).min())/(rsi.rolling(14).max()-rsi.rolling(14).min())
    k=st.rolling(3).mean(); out['SR_K']=k; out['SR_D']=k.rolling(3).mean()
    # Chaikin oscillator EMA3-EMA10 of ADL (std EMA, adjust=False)
    a=pd.Series(A); out['CHO']=a.ewm(span=3,adjust=False).mean()-a.ewm(span=10,adjust=False).mean(); out['ZERO']=0.0
    return out
