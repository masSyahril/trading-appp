import numpy as np,pandas as pd,pickle,matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from ind import *
plt.rcParams.update({'font.family':'serif','font.size':8,'axes.linewidth':0.6,'axes.grid':True,'grid.color':'#dddddd','grid.linewidth':0.4,
 'axes.spines.top':False,'axes.spines.right':False,'legend.frameon':False,'lines.linewidth':1.2,'savefig.bbox':'tight','savefig.dpi':300})
C=['#2a78d6','#eb6834','#1baf7a','#eda100','#e87ba4','#008300','#555555']
IND,EQ=pickle.load(open('ind.pkl','rb'))
# Fig1 frequency response
w=np.linspace(1e-3,np.pi,800); z=np.exp(1j*w)
def H_ema(g): return g/(1-(1-g)*z**-1)
g=0.2
fig,ax=plt.subplots(figsize=(3.4,2.2))
for lab,H,c,ls in [('Classic KD smoothing, $\\gamma=1/3$',H_ema(1/3),C[0],'-'),('Single EMA, $\\gamma=2/(N{+}1)=0.2$',H_ema(g),C[1],'--'),
                   ('True cascade EMA$\\circ$EMA, $\\gamma=0.2$',H_ema(g)**2,C[2],'-.'),('Wang re-smoothed $K$, $\\gamma^2=0.04$',H_ema(g*g),C[6],'-')]:
    ax.plot(w/(2*np.pi),20*np.log10(abs(H)),color=c,ls=ls,label=lab)
ax.set_xscale('log');ax.set_xlabel('Normalized frequency (cycles/bar)');ax.set_ylabel('|H| (dB)');ax.set_ylim(-40,2);ax.legend(fontsize=6.5,loc='lower left')
fig.savefig('fig/freq.pdf')
# Fig2 example 2330.TW last 500 bars
df,o=IND['2330.TW']; sl=slice(len(df)-500,len(df)); d=df.date[sl]
fig,ax=plt.subplots(3,1,figsize=(3.45,4.0),sharex=True,gridspec_kw={'height_ratios':[1.2,1,1]})
ax[0].plot(d,df.close[sl],color='#333333',lw=0.9);ax[0].set_ylabel('Close (TWD)')
ax[1].plot(d,o.W_eK[sl],color=C[0],label='$K$ (Wang)');ax[1].plot(d,o.W_eD[sl],color=C[1],ls='--',label='$D$ (Wang)');ax[1].set_ylabel('eADL-KD');ax[1].legend(fontsize=6.5,ncol=2,loc='lower center',bbox_to_anchor=(0.5,0.97),borderaxespad=0);ax[1].set_ylim(0,100)
ax[2].plot(d,o.KD_K[sl],color=C[0],lw=0.8,label='$K$');ax[2].plot(d,o.KD_D[sl],color=C[1],ls='--',lw=0.8,label='$D$');ax[2].set_ylabel('KD(9,3,3)');ax[2].legend(fontsize=6.5,ncol=2,loc='lower center',bbox_to_anchor=(0.5,0.97),borderaxespad=0);ax[2].set_ylim(0,100)
import matplotlib.dates as md; ax[2].xaxis.set_major_locator(md.MonthLocator(interval=6)); ax[2].xaxis.set_major_formatter(md.DateFormatter('%Y-%m')); fig.autofmt_xdate(); fig.tight_layout(h_pad=1.2); fig.savefig('fig/example.pdf')
# Fig3 Sharpe bars
R=pd.read_csv('res_all.csv'); m=R.groupby('strat').Sharpe.agg(['mean','std','count']).sort_values('mean')
fig,ax=plt.subplots(figsize=(3.4,2.4))
cols=['#7a7a7a' if s not in('eADL-KD (Wang)',) else C[0] for s in m.index]
cols=[C[1] if 'Wang smoothing' in s else c for s,c in zip(m.index,cols)]
ax.barh(range(len(m)),m['mean'],xerr=m['std']/np.sqrt(m['count']),color=cols,height=0.6,error_kw=dict(lw=0.6,capsize=1.5))
ax.set_yticks(range(len(m)));ax.set_yticklabels(m.index,fontsize=7);ax.axvline(0,color='k',lw=0.5);ax.set_xlabel('Mean annualized Sharpe ratio (15 assets, $\\pm$1 s.e.)')
fig.savefig('fig/sharpe.pdf')
# Fig4 sensitivity heatmap
G=pd.read_csv('sens.csv').pivot(index='esp',columns='KD_num',values='Sharpe')
fig,ax=plt.subplots(figsize=(2.6,2.0)); im=ax.imshow(G.values,cmap='Blues',vmin=0,vmax=0.5,origin='lower');ax.grid(False)
ax.set_xticks(range(3));ax.set_xticklabels(G.columns);ax.set_yticks(range(4));ax.set_yticklabels(G.index);ax.set_xlabel('KD_num');ax.set_ylabel('esp ($N$)')
for i in range(4):
    for j in range(3): v=G.values[i,j];ax.text(j,i,f'{v:.2f}',ha='center',va='center',color='white' if v>0.3 else 'black',fontsize=7)
plt.colorbar(im,ax=ax,fraction=0.046,label='Mean Sharpe');fig.savefig('fig/sens.pdf')
# Fig5 equity TWII
fig,ax=plt.subplots(figsize=(3.4,2.2)); df,_=IND['^TWII']; dd=df.date.values[60:]
for (lab,c,ls) in [('Buy & Hold','#333333','-'),('eADL-KD (Wang)',C[0],'-'),('KD(9,3,3) price',C[1],'--'),('Chaikin Osc.',C[2],'-.'),('StochRSI',C[3],':')]:
    e=EQ[('^TWII',lab)]; ax.plot(dd[-len(e):],e,color=c,ls=ls,label=lab,lw=1)
ax.set_yscale('log');from matplotlib.ticker import FixedLocator,FormatStrFormatter;ax.yaxis.set_major_locator(FixedLocator([0.5,1,2,4]));ax.yaxis.set_major_formatter(FormatStrFormatter('%g'));ax.yaxis.set_minor_formatter(plt.NullFormatter());ax.set_ylabel('Growth of 1 (log scale)');ax.legend(fontsize=6.5);import matplotlib.dates as md;ax.xaxis.set_major_locator(md.YearLocator(2));ax.xaxis.set_major_formatter(md.DateFormatter("%Y"));fig.savefig("fig/equity.pdf")
# impulse response centroid lags
n=2000;imp=np.zeros(n);imp[0]=1
def run(r):
    K=np.zeros(n);D=np.zeros(n);K1=np.zeros(n)
    for i in range(n):
        Kp=K[i-1] if i else 0;Dp=D[i-1] if i else 0
        K1[i]=(1-g)*Kp+g*r[i];K[i]=(1-g*g)*Kp+g*g*r[i];D[i]=(1-g-g*g)*Dp+g*K[i]+g*g*K1[i]
    return K,D
K,D=run(imp);t=np.arange(n)
print('lag K',(t*K).sum()/K.sum(),'lag D',(t*D).sum()/D.sum(),'sums',K.sum(),D.sum())
