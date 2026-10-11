import json,glob,os,pandas as pd
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data')
def load(sym):
    j=json.load(open(os.path.join(DATA,f'{sym}.json')))['chart']['result'][0]
    q=j['indicators']['quote'][0]
    df=pd.DataFrame({'date':pd.to_datetime(j['timestamp'],unit='s'),'open':q['open'],'high':q['high'],'low':q['low'],'close':q['close'],'volume':q['volume']})
    df=df.dropna().reset_index(drop=True)
    df=df[df.volume>0].reset_index(drop=True)
    return df
SYMS=[os.path.basename(f)[:-5] for f in sorted(glob.glob(os.path.join(DATA,'*.json')))]
