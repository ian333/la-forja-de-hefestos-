#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Modelo ACOPLADO electro-termico-mecanico de UNA gota (acero E71T-GS 0.8mm).
El MISMO I(t)=I0+I_ac*cos(phase) hace las dos cosas:
  - TERMICO:  m*cp_eff*dT/dt = I^2*R(T) - Ploss(conduccion+radiacion+alambre frio)
              control de I0 (termostato bang-then-hold por TCR) acotado al presupuesto
  - MECANICO: q'' + g(T)*q' + w2(a)^2*q = w2^2*(I/Icrit)^2 * fL   (solo si liquido)
Acoplamiento: la oscilacion solo crece si la gota esta LIQUIDA (fL>0); si el
calor no alcanza, T cae, fL->0, se congela y NO desprende.
Pregunta: con presupuesto 30 A (peak), que R de contacto hace que SI funcione,
y cual es el I0/I_ac/tiempo exactos.
"""
import numpy as np

# ---- material ----
gamma_st=1.5; rho=7000.0; rho_s=7850.0; nu=(6e-3)/7000.0
cp=600.0; Lf=250e3
Tsol=1450.0; Tliq=1520.0; Tset=1540.0; T0=25.0; T0k=298.0
Icrit=194.0; alphaR=0.005
Aw=5.027e-7
sigma=5.67e-8; emis=0.4
kcond=45.0; Lth=1.0e-3        # conduccion pendiente arriba del alambre (long termica)

def w2_of(a): return np.sqrt(8*gamma_st/(rho*a**3))
def tau_of(a): return a*a/(5*nu)

def integ(R_op, I_ac, budget, vf, a0=0.30e-3, Tmax_t=0.120, dt=1e-5):
    Imax_dc = budget - I_ac
    a=a0; V=4/3*np.pi*a**3
    T=T0; q=0.0; qd=0.0; ph=0.0
    Tpeak=T; t_reach=None
    nst=int(Tmax_t/dt)
    for i in range(nst):
        t=i*dt
        fL=min(max((T-Tsol)/(Tliq-Tsol),0.0),1.0)
        w2=w2_of(a); m=rho*V
        R=R_op                       # resistencia CALIENTE de operacion (constante)
        Tk=T+273.0
        Pcond=kcond*Aw*(T-T0)/Lth
        Prad =emis*sigma*(4*np.pi*a*a)*(Tk**4-T0k**4)
        Pwire=rho_s*Aw*vf*(cp*(T-T0)+Lf)
        Ploss=Pcond+Prad+Pwire
        if T<Tset:
            I0=Imax_dc
        else:                        # termostato: resta el calor del ripple AC
            I0=min(np.sqrt(max(Ploss/R - I_ac*I_ac/2.0, 0.0)), Imax_dc)
        I=I0+I_ac*np.cos(ph)
        Pin=I*I*R
        cpeff=cp+(Lf/(Tliq-Tsol) if (Tsol<T<Tliq) else 0.0)
        T=T+(Pin-Ploss)/(m*cpeff)*dt
        Tpeak=max(Tpeak,T)
        if T>2860.0:                 # vaporiza -> corriente demasiado alta
            return dict(det=False,vapor=True,t=t,a=a,Tpk=Tpeak,treach=t_reach,I0=I0,fL=fL,qmax=q)
        if t_reach is None and T>=Tliq: t_reach=t
        # mecanico (solo liquido)
        if fL>0.05:
            g=(2.0/tau_of(a))/max(fL,0.05); w2sq=w2*w2
            F=w2sq*(I/Icrit)**2*fL
            k1q=qd;          k1v=F-g*qd-w2sq*q
            k2q=qd+dt/2*k1v; k2v=F-g*(qd+dt/2*k1v)-w2sq*(q+dt/2*k1q)
            k3q=qd+dt/2*k2v; k3v=F-g*(qd+dt/2*k2v)-w2sq*(q+dt/2*k2q)
            k4q=qd+dt*k3v;   k4v=F-g*(qd+dt*k3v)-w2sq*(q+dt*k3q)
            q=q+dt/6*(k1q+2*k2q+2*k3q+k4q)
            qd=qd+dt/6*(k1v+2*k2v+2*k3v+k4v)
            ph=ph+w2*dt
            if q>=1.0 and fL>0.5:
                return dict(det=True,t=t,a=a,Tpk=Tpeak,treach=t_reach,I0=I0,fL=fL,qmax=q)
        else:
            qd=0.0
        V=V+Aw*vf*dt; a=(3*V/(4*np.pi))**(1/3)
    return dict(det=False,t=Tmax_t,a=a,Tpk=Tpeak,treach=t_reach,I0=I0,fL=fL,qmax=q)

def min_iac(R_op, budget, vf):
    for I_ac in np.arange(3.0,16.01,0.5):
        r=integ(R_op,I_ac,budget,vf)
        if r['det']:
            return I_ac, r
    return None, integ(R_op,12.0,budget,vf)

print("="*70)
print("GOTA ACOPLADA (termico+mecanico)  acero E71T-GS 0.8mm, vf=3 mm/s")
print(f"liquidus {Tliq}C, Icrit {Icrit}A, conduccion Lth={Lth*1e3:.1f}mm")
print("="*70)

vf=3e-3
print("\nPRESUPUESTO 30 A (peak):")
print(" R_op[mohm] | desprende? | I_ac min | I0_hold | peak | t[ms] | a_det[mm] | Tpico[C]")
for R in [0.015,0.030,0.060,0.100,0.120,0.150]:
    iac,r=min_iac(R,30.0,vf)
    if iac is not None:
        print(f"    {R*1e3:4.0f}    |    SI      |  {iac:4.1f} A  | {r['I0']:5.1f} A | "
              f"{r['I0']+iac:4.1f} | {r['t']*1e3:5.1f} |   {r['a']*1e3:4.2f}    |  {r['Tpk']:5.0f}")
    else:
        print(f"    {R*1e3:4.0f}    | NO (Tpico {r['Tpk']:.0f}C, fL {r['fL']:.2f}) -> "
              f"{'no funde/no sostiene' if r['Tpk']<Tliq else 'no desprende en 30A'}")

print("\nCON BOOST LC (presupuesto 60 A peak), R_op=30 mohm:")
iac,r=min_iac(0.030,60.0,vf)
if iac is not None:
    print(f"  desprende: I_ac={iac:.1f}A, I0_hold={r['I0']:.1f}A, peak={r['I0']+iac:.1f}A, "
          f"t={r['t']*1e3:.1f}ms, a={r['a']*1e3:.2f}mm, Tpico={r['Tpk']:.0f}C")

# traza detallada del mejor caso a 30A
print("\nTRAZA del caso 30A R_op=150mohm, I_ac=12A (T y q en el tiempo):")
def trace(R_op,I_ac,budget,vf,dt=1e-5):
    a=0.30e-3; V=4/3*np.pi*a**3; T=T0; q=0.0; qd=0.0; ph=0.0
    Imax_dc=budget-I_ac; out=[]
    for i in range(int(0.120/dt)):
        t=i*dt; fL=min(max((T-Tsol)/(Tliq-Tsol),0.0),1.0); w2=w2_of(a); m=rho*V
        R=R_op; Tk=T+273.0
        Ploss=kcond*Aw*(T-T0)/Lth+emis*sigma*(4*np.pi*a*a)*(Tk**4-T0k**4)+rho_s*Aw*vf*(cp*(T-T0)+Lf)
        I0=Imax_dc if T<Tset else min(np.sqrt(max(Ploss/R-I_ac*I_ac/2.0,0.0)),Imax_dc)
        I=I0+I_ac*np.cos(ph); Pin=I*I*R
        cpeff=cp+(Lf/(Tliq-Tsol) if Tsol<T<Tliq else 0.0)
        T=T+(Pin-Ploss)/(m*cpeff)*dt
        if fL>0.05:
            g=(2/tau_of(a))/max(fL,0.05); w2sq=w2*w2; F=w2sq*(I/Icrit)**2*fL
            qd=qd+(F-g*qd-w2sq*q)*dt; q=q+qd*dt; ph=ph+w2*dt
        else: qd=0.0
        V=V+Aw*vf*dt; a=(3*V/(4*np.pi))**(1/3)
        if i%1500==0: out.append((t*1e3,T,fL,q,I0))
        if q>=1 and fL>0.5: out.append((t*1e3,T,fL,q,I0)); break
    return out
for (tt,T,fL,q,I0) in trace(0.150,12.0,30.0,vf):
    print(f"  t={tt:5.1f}ms  T={T:5.0f}C  fL={fL:4.2f}  q={q:5.2f}  I0={I0:4.1f}A")
print("="*70)
