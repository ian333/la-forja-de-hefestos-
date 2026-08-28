import numpy as np, math, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
# ---- netlist con piezas AG ----
L,DCR = 41e-6,0.020
R_cab,R_stick = 0.080,0.382
Rds = 0.0197          # IRFB4227PBF (AG $59) — verificado en datasheet
Vh,Vf = 0.55,0.84     # Holm + MBR40100CT
C,Vset,Icc = 11e-3,48.0,25.0   # LRS-1200-48 (25A nominal, 37.5A pico 5s)
I0,HB = 18.0,2.0
F_ACS = 120e3         # ancho de banda ACS724 (polo simple)
def corre(HB, lag_comp, tmax=0.35e-3, dt=0.02e-6):
    n=int(tmax/dt); I=np.zeros(n); Im=np.zeros(n); on=np.zeros(n,bool)
    i,im,q=0.0,0.0,True
    a=1-math.exp(-2*math.pi*F_ACS*dt)      # filtro del sensor
    for k in range(n):
        di=((Vset-Vh-i*(R_stick+R_cab+DCR+Rds))/L) if q else ((-Vh-Vf-i*(R_stick+R_cab+DCR))/L)
        i=max(i+di*dt,0.0); im+=a*(i-im)   # lo que el ADC VE (con retardo)
        iest=im+ (di*lag_comp if lag_comp else 0.0)   # compensacion predictiva
        if q and iest>=I0+HB: q=False
        if (not q) and iest<=I0-HB: q=True
        I[k],Im[k],on[k]=i,im,q
    w=slice(int(n*0.4),n)
    return I,Im,on,I[w].max(),I[w].min()
tau=1/(2*3.141592653589793*F_ACS)  # constante del polo del sensor = la compensacion CORRECTA
lag=tau
casos=[("banda ±2A, sin compensar",2.0,0.0),("banda ±2A, COMPENSADA",2.0,lag),
       ("banda ±4A, sin compensar",4.0,0.0),("banda ±2A, comp. 2x (de mas)",2.0,2*tau)]
print(f"polo del ACS724 (BW {F_ACS/1e3:.0f} kHz): tau = {lag*1e6:.2f} us;  di/dt ON = {(Vset-Vh-18*0.502)/L/1e6:.2f} A/us")
print(f"{'caso':32s} {'I pico':>8s} {'I valle':>8s} {'rizo real':>10s} {'pedido':>8s}")
res={}
for nom,hb,lc in casos:
    I,Im,on,mx,mn=corre(hb,lc); res[nom]=(I,Im)
    print(f"{nom:32s} {mx:7.1f}A {mn:7.1f}A {mx-mn:9.1f}A {2*hb:7.1f}A")
I1,Im1=res["banda ±2A, sin compensar"]; I2,Im2=res["banda ±2A, COMPENSADA"]
t=np.arange(len(I1))*0.02e-6*1e6
fig,ax=plt.subplots(2,1,figsize=(11,6),constrained_layout=True)
for a_,(Ir,Imd,ti) in zip(ax,[(I1,Im1,"SIN compensar: el retardo del Hall infla la banda"),
                              (I2,Im2,"CON compensación predictiva (el RP2350 sabe di/dt=V/L)")]):
    z=(t>200)&(t<300)
    a_.plot(t[z],Ir[z],lw=1.1,color='#c33',label='I real del choke')
    a_.plot(t[z],Imd[z],lw=1.0,ls='--',color='#36c',label='I que VE el ACS724')
    a_.axhline(20,ls=':',c='k',lw=0.8); a_.axhline(16,ls=':',c='k',lw=0.8)
    a_.set_title(ti); a_.set_ylabel('I [A]'); a_.legend(fontsize=8,loc='upper right')
ax[1].set_xlabel('t [µs]')
plt.savefig('ondas-ag.png',dpi=110); print("plot -> ondas-ag.png")
