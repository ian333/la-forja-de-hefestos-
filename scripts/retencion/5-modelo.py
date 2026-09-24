# Riesgo de abandono por segundo  ×  lo que se ve, se oye y se dice en ese segundo.
import json,re,numpy as np
from scipy.optimize import curve_fit
import os,sys; S_=(sys.argv[1] if len(sys.argv)>1 else 'dist-video/retencion').rstrip('/')+'/'
cur=json.load(open(S_+'yt-curvas.json')); ras=json.load(open(S_+'rasgos.json')); pal=json.load(open(S_+'palabras.json'))
def dur(s):
    m=re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?',s); h,mi,se=[int(x or 0) for x in m.groups()]; return h*3600+mi*60+se
NUM=re.compile(r'\d|cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|mil|millon|por ?ciento|grados|veces|pesos',re.I)
TU=re.compile(r'^(tú|tu|te|ti|tienes|eres|estás|sientes|traes|respiras|tus)$',re.I)
DT=0.5; LAG=(-2.0,0.0)   # la gente se va 0-2 s DESPUÉS de lo que vio
filas=[]; picos=[]
lomax=lambda t,a,b:(1+t/b)**(-a)
for vid,v in cur.items():
    c=v.get('curva')
    if not c or vid not in ras or vid not in pal: continue
    D=dur(v['dur']); t=np.array([r[0] for r in c])*D; y=np.array([r[1] for r in c]); S=y/y[0]
    ok=t<0.95*D
    p,_=curve_fit(lomax,t[ok],S[ok],p0=[1,20],bounds=(1e-4,np.inf),maxfev=20000)
    g=np.arange(0,0.95*D-DT,DT)
    Sg=np.interp(g,t,S); Sg2=np.interp(g+DT,t,S)
    h=-(np.log(np.clip(Sg2,1e-3,None))-np.log(np.clip(Sg,1e-3,None)))/DT       # riesgo observado /s
    h0=p[0]/(p[1]+g+DT/2)                                                        # riesgo del modelo del propio video
    r=ras[vid]; fps=r['fps']; W=pal[vid]
    def ven(arr,a,b):
        i0=max(0,int((a)*fps)); i1=max(i0+1,int(b*fps)); x=arr[i0:i1]; return float(np.mean(x)) if len(x) else np.nan
    for k,tt in enumerate(g):
        a,b=tt+LAG[0],tt+DT
        ws=[w for w in W if a<=w[0]<b]; txt=' '.join(w[2] for w in ws)
        f=dict(vid=vid,t=tt,D=D,h=h[k],h0=h0[k],ex=h[k]-h0[k],w=v['vistas']*Sg[k],
          mov=ven(r['mov'],a,b),corte=max(r['corte'][max(0,int(a*fps)):max(1,int(b*fps))] or [0]),brillo=ven(r['brillo'],a,b),
          sat=ven(r['sat'],a,b),detalle=ven(r['detalle'],a,b),db=ven(r['db'],a,b),flujo=ven(r['flujo'],a,b),cent=ven(r['centroide'],a,b),
          pal_s=len(ws)/(b-a),silencio=float(len(ws)==0),num=float(bool(NUM.search(txt))),tu=float(any(TU.match(w[2].strip('¿?¡!.,')) for w in ws)),
          preg=float('?' in txt),txt=txt)
        filas.append(f)
    # los 3 peores acantilados del video (exceso sobre su propia curva), con lo que se decía
    ex=h-h0; o=np.argsort(-ex)[:3]
    for k in o:
        tt=g[k]; txt=' '.join(w[2] for w in W if tt-2.5<=w[0]<tt+DT)
        picos.append(dict(vid=vid,titulo=v['titulo'][:50],vistas=v['vistas'],t=round(tt,1),D=D,ex=round(ex[k]*100,1),dicho=txt))
json.dump(dict(filas=filas,picos=picos),open(S_+'modelo-datos.json','w'),ensure_ascii=False)
F=['mov','corte','brillo','sat','detalle','db','flujo','cent','pal_s','silencio','num','tu','preg']
X=np.array([[f[k] for k in F] for f in filas],float); Y=np.array([f['ex'] for f in filas]); Wt=np.array([f['w'] for f in filas])
m=~np.isnan(X).any(1)&np.isfinite(Y); X,Y,Wt=X[m],Y[m],Wt[m]; vids=np.array([f['vid'] for f in filas])[m]
mu,sd=X.mean(0),X.std(0)+1e-9; Z=(X-mu)/sd
def ajuste(Z,Y,Wt,lam=5.0):
    A=np.c_[np.ones(len(Z)),Z]; Wd=np.sqrt(Wt/Wt.mean())
    Aw=A*Wd[:,None]; Yw=Y*Wd; R=lam*np.eye(A.shape[1]); R[0,0]=0
    return np.linalg.solve(Aw.T@Aw+R,Aw.T@Yw)
b=ajuste(Z,Y,Wt)
U=np.unique(vids); rng=np.random.default_rng(0); B=[]
for _ in range(400):
    s=rng.choice(U,len(U)); idx=np.concatenate([np.where(vids==u)[0] for u in s]); B.append(ajuste(Z[idx],Y[idx],Wt[idx]))
B=np.array(B); lo,hi=np.percentile(B,[5,95],axis=0)
print(f'n filas={len(Y)} videos={len(U)}  exceso medio={np.average(Y,weights=Wt)*100:.2f} %/s')
print('rasgo      efecto(pp de riesgo/s por 1 desv.est.)   IC90 (bootstrap por video)')
for i,k in enumerate(F):
    sig='  ***' if lo[i+1]>0 or hi[i+1]<0 else ''
    print(f'{k:9s} {b[i+1]*100:+6.2f}   [{lo[i+1]*100:+.2f}, {hi[i+1]*100:+.2f}]{sig}')
