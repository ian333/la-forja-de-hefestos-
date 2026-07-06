#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EL LATIGAZO: ciclo de corto-circuito CONTROLADO (transferencia tipo CMT).
Fases: CORTO (funde) → CUELLO (pinch) → REVIENTA (gota) → ARCO → re-toca.
  L di/dt = V_drive − i·(R_fijo + R_puente)     (el CHOQUE L hace el pulso de ms)
  R_puente líquido = ρ_liq·L_b/(π r²)  → SUBE al adelgazar el cuello (la SEÑAL)
  pinch: i > i_crit(r)=√(8π² r γ/μ0) estrangula; abajo, la tensión superficial remata
CONTROL: el RP2350 sensa R=V/i; al primer indicio de cuello CORTA y deja que el
arco baje la corriente → revienta a BAJA i (gota limpia). Sin control revienta alto = spatter.
"""
import numpy as np
gamma=1.5; mu0=4*np.pi*1e-7; rho_liq=1.2e-6; rho=7000.0; cp=600.0; Tliq=1520.0
d=0.8e-3; rw=d/2; Aw=np.pi*rw*rw; Lb=0.5e-3; mb=rho*Aw*Lb
L=50e-6; Rfix=10e-3; Vsrc=22.0; Varc=18.0; Rcontact=20e-3
Krate=0.35; Ksurf=0.08; rmin=0.05e-3
def icrit(r): return np.sqrt(8*np.pi*np.pi*r*gamma/mu0)

def run(control, Rcut=2e-3, dt=2e-6, tmax=30e-3):
    i=60.0; phase='corto'; r=rw; T=600.0; E=0.0; arct=0.0
    W=[]; rupt=[]; t=0.0; lastr=0.0; per=[]
    while t<tmax:
        if phase in ('corto','cuello'):
            liq = (phase=='cuello')
            Rb = (rho_liq*Lb/(np.pi*r*r)) if liq else Rcontact
            cut = control and liq and (Rb>Rcut)
            if cut: i += (-Varc - i*Rfix)/L*dt           # arco baja la corriente
            else:   i += (Vsrc - i*(Rfix+Rb))/L*dt
            i=max(i,0.0); Vp=i*Rb; E+=Vp*i*dt
            if not liq:
                T += i*i*Rb/(mb*cp)*dt
                if T>=Tliq: phase='cuello'; r=rw
            else:
                ic=icrit(r)
                dr = (Krate*(1-(ic/max(i,1))**2) if i>ic else 0.0) + Ksurf
                r -= dr*dt
                if r<=rmin:
                    rupt.append((i,E*1e3)); per.append(t-lastr); lastr=t
                    phase='arco'; arct=0.0; E=0.0
        else:  # arco
            i += (-Varc - i*Rfix)/L*dt; i=max(i,0.0); Vp=Varc
            arct+=dt
            if arct>1.2e-3: phase='corto'; r=rw; T=600.0; E=0.0
        if control and t<3.6e-3 and (int(t/2e-4)!=int((t-dt)/2e-4)):
            W.append((t*1e3, phase, i, Vp, (Vp/i*1e3 if i>1 else 0)))
        t+=dt
    Irup=np.mean([x[0] for x in rupt]) if rupt else 0
    Erup=np.mean([x[1] for x in rupt]) if rupt else 0
    rate=len(rupt)/tmax
    return W, Irup, Erup, rate

print("="*60)
print(f"i_crit(0.4mm)={icrit(rw):.0f}A · choque L={L*1e6:.0f}µH · Vsrc={Vsrc}V Varc={Varc}V")
print("="*60)

W,Ir,Er,rt = run(control=True)
print(f"\nCON CONTROL — corta al sentir el cuello (R>2mΩ):")
print("  t[ms] | fase   |  i[A] | Vpuente[V] | R[mΩ]")
for (t,f,i,Vp,R) in W:
    print(f"  {t:5.2f} | {f:6s} | {i:5.0f} |   {Vp:5.2f}    | {R:5.1f}")
print(f"  → revienta a {Ir:.0f} A · {Er:.2f} mJ/gota · {rt:.0f} gotas/s")

_,Ir2,Er2,rt2 = run(control=False)
print(f"\nSIN CONTROL — deja reventar:")
print(f"  → revienta a {Ir2:.0f} A · {Er2:.2f} mJ/gota · {rt2:.0f} gotas/s")

print(f"\n  CORRIENTE DE REVENTÓN:  con control {Ir:.0f} A  vs  sin control {Ir2:.0f} A")
print(f"  (menos corriente al reventar = menos spatter = gota limpia)")
print("="*60)
print("LECTURA: el choque hace el pulso de ms; R=V/i sube al formarse el cuello;")
print("cortar ahí (RP2350) revienta suave → cada latigazo = 1 gota controlada.")
print("="*60)
