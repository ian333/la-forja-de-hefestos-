import numpy as np, math, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
L,DCR,R_cab,R_stick,Rds = 41e-6,0.020,0.080,0.382,0.0197
Vh,Vf,Vbus = 0.55,0.84,48.0
I0,HB,F_ACS = 18.0,2.0,120e3
TAU=1/(2*math.pi*F_ACS)
dt,T = 0.02e-6, 0.60e-3
n=int(T/dt); t=np.arange(n)*dt

def Rjunta(tk):
    """el ciclo REAL de una gota: contacto frio (Holm) -> funde -> puente -> se rompe"""
    if tk < 0.20e-3:  return 15.0                     # contacto frio: constriccion de Holm
    if tk < 0.22e-3:  return 15.0*math.exp(-(tk-0.20e-3)/4e-6)+0.005   # FUNDE: colapsa
    if tk < 0.50e-3:  return 0.005                    # puente liquido
    return 60.0                                        # se rompe el cuello -> arco/abierto

def corre(modo):
    I=np.zeros(n); Rj=np.zeros(n); est=np.zeros(n); on=np.zeros(n,bool)
    i,im,ie,q = 0.0,0.0,0.0,True
    a=1-math.exp(-dt/TAU)
    R_sup=0.5   # lo que el MODELO supone del lazo (no sabe la junta real)
    for k in range(n):
        tk=t[k]; rj=Rjunta(tk)
        Rl=R_stick+R_cab+DCR+(Rds if q else 0.0)+rj
        di=((Vbus-Vh-i*Rl)/L) if q else ((-Vh-Vf-i*Rl)/L)
        i=max(i+di*dt,0.0)
        im+=a*(i-im)                                   # lo que ve el Hall (con su polo)
        if modo=="sin sensor":                         # estimador ciego: integra el modelo
            die=((Vbus-Vh-ie*R_sup)/L) if q else ((-Vh-Vf-ie*R_sup)/L)
            ie=max(ie+die*dt,0.0); señal=ie
        else:                                          # sensor + compensacion predictiva
            ie=im+di*TAU; señal=ie
        if q and señal>=I0+HB: q=False
        if (not q) and señal<=I0-HB: q=True
        I[k],Rj[k],est[k],on[k]=i,rj,ie,q
    return I,Rj,est

Ia,Rj,Ea = corre("sin sensor")
Ib,_ ,Eb = corre("con sensor")
def resumen(nom,I,E):
    f=(t>0.25e-3)&(t<0.45e-3)          # ventana de puente liquido = imprimiendo
    print(f"{nom:14s} puente: I={I[f].mean():6.1f}A (pide 18)  pico={I.max():7.1f}A  "
          f"error del estimador={np.abs(E[f]-I[f]).mean():6.1f}A")
    c=(t<0.20e-3)
    print(f"{'':14s} contacto frio: I real={I[c].max():.2f}A -> V_junta={I[c].max()*15:.1f}V "
          f"(Holm pide >0.55V para fundir)")
print("EL CICLO: contacto frio 15Ohm -> FUNDE (colapsa a 5mOhm) -> puente -> se rompe\n")
resumen("SIN SENSOR",Ia,Ea); print(); resumen("CON SENSOR",Ib,Eb)
print(f"\nresolucion de medida: ACS724 40A a 40mV/A, ADC 12-bit/3.3V -> {3.3/4096/0.040*1000:.0f} mA por cuenta")
print(f"R=V/I: la junta cambia 15 Ohm -> 0.005 Ohm = 3000x. Sin I no hay R, sin R no hay proceso.")

fig,ax=plt.subplots(3,1,figsize=(11,8),constrained_layout=True,sharex=True)
ax[0].semilogy(t*1e3,Rj,color='#555'); ax[0].set_ylabel('R junta [$\\Omega$]')
ax[0].set_title('LA JUNTA REAL: contacto frío (Holm 15 Ω) → FUNDE → puente líquido (5 mΩ) → se rompe')
ax[1].plot(t*1e3,Ia,lw=0.7,color='#c33',label='corriente REAL')
ax[1].plot(t*1e3,Ea,lw=0.9,ls='--',color='#999',label='lo que CREE el estimador ciego')
ax[1].set_title('SIN SENSOR (solo modelo): el estimador vive en otra realidad'); ax[1].legend(fontsize=8)
ax[1].set_ylabel('I [A]')
ax[2].plot(t*1e3,Ib,lw=0.7,color='#c33',label='corriente REAL')
ax[2].axhline(20,ls=':',c='k',lw=0.8); ax[2].axhline(16,ls=':',c='k',lw=0.8)
ax[2].set_title('CON SENSOR + compensación: la banda se respeta pase lo que pase con la junta')
ax[2].set_ylabel('I [A]'); ax[2].set_xlabel('t [ms]'); ax[2].legend(fontsize=8)
plt.savefig('sensor-si-o-no.png',dpi=110); print("plot -> sensor-si-o-no.png")
