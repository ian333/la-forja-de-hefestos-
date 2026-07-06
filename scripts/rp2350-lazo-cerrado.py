#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LAZO CERRADO del RP2350 — automatización por DETECCIÓN (R=V/I), todo de números.
Simula la física de la junta + corre la MÁQUINA DE ESTADOS del firmware sobre la
señal SENSADA (Kelvin, con ruido de ADC). Control de corriente bang-bang a una
corriente blanco; el "corte" abre el gate y el arco baja la corriente (gota suave).

Compara RP2350 ADAPTATIVO (sensa toque/T-por-TCR/cuello) vs control CIEGO (tiempos
fijos, sin sensar) bajo PERTURBACIÓN (punta de contacto que se desgasta cada gota).
"""
import numpy as np
gamma=1.5; mu0=4*np.pi*1e-7; rho_liq=1.2e-6; rho=7000.; cp=600.; Tliq=1520.; T_touch=25.
d=0.8e-3; rw=d/2; Aw=np.pi*rw*rw; Lb=0.5e-3; mb=rho*Aw*Lb
L=50e-6; Rfix=10e-3; Vsrc=24.0; Varc=18.0
alphaR=0.0045; Krate=0.35; Ksurf=0.08; rmin=0.05e-3; Itarget=80.0; Ibg=20.0
def icrit(r): return np.sqrt(8*np.pi*np.pi*r*gamma/mu0)
def rho_ratio(T): return 1+alphaR*min(T-25,Tliq-25)

def run(mode='rp2350', noise=0.02, wear=0.4, dt=1e-6, tmax=120e-3, seed=1):
    rng=np.random.default_rng(seed)
    phase='toca'; i=5.0; T=T_touch; r=rw; t=0.0; arct=0.0; cyc=0
    Rc=20e-3*(1+wear*np.sin(cyc))            # R contacto (se desgasta por gota)
    st='SEARCH'; R_cold=None; R_min=np.inf; cut=False; t_touch=0.0
    res=[]; Terr=[]
    while t<tmax:
        # --- R físico de la junta ---
        if phase in ('toca','calienta'): Rj=Rc*rho_ratio(T)
        elif phase=='funde':             Rj=rho_liq*Lb/(np.pi*r*r)
        else:                            Rj=Varc/max(i,1)        # arco
        # --- corriente: bang-bang; al CORTAR baja el blanco a Ibg (CMT suave), no a 0 ---
        Icmd = Ibg if (cut or st=='CUT') else Itarget
        if i < Icmd:          i += (Vsrc - i*(Rfix+Rj))/L*dt
        else:                 i += (-i*Rfix)/L*dt                # freewheel (diodo) decae a Icmd
        i=max(i,0.0)
        # --- evolución física ---
        if phase in ('toca','calienta'):
            phase='calienta'; T += i*i*Rj/(mb*cp)*dt
            if T>=Tliq: phase='funde'; r=rw
        elif phase=='funde':
            ic=icrit(r); r-=((Krate*(1-(ic/max(i,1))**2) if i>ic else 0)+Ksurf)*dt
            if r<=rmin:
                res.append(('gota', i)); phase='done'
        # arco/cierre de ciclo: re-toca con alambre FRÍO y punta desgastada
        if phase in ('arco','done','stub'):
            arct+=dt
            if arct>1.2e-3:
                if phase=='stub': res.append(('STUB', i))
                cyc+=1; Rc=20e-3*(1+wear*np.sin(cyc))
                phase='toca'; i=5.0; T=T_touch; r=rw; cut=False; arct=0.0
                st='SEARCH'; R_cold=None; R_min=np.inf
        # --- SENSADO (ADC con ruido) ---
        Vm=max(i*Rj,0)*(1+noise*rng.standard_normal())
        Im=max(i,1e-3)*(1+noise*rng.standard_normal())
        Rm=Vm/Im if Im>2.0 else np.inf
        # --- FIRMWARE ---
        if mode=='rp2350':
            if st=='SEARCH' and np.isfinite(Rm) and Rm<60e-3:
                R_cold=Rm; st='HEAT'
            elif st=='HEAT' and R_cold:
                ratio=Rm/R_cold
                if np.isfinite(ratio) and ratio>0.5:
                    Terr.append(abs((25+(ratio-1)/alphaR)-T))
                    if ratio>6.0: st='MOLTEN'; R_min=np.inf
            elif st=='MOLTEN':
                R_min=min(R_min,Rm)
                if R_min<5e-3 and Rm>4.0*R_min: cut=True; st='CUT'
            elif st=='CUT' and (not np.isfinite(Rm) or Rm>1.0):
                st='SEARCH'; R_cold=None
        else:  # CIEGO: detecta toque, pero CALIENTA un tiempo FIJO y corta (sin sensar T ni cuello)
            if st=='SEARCH' and np.isfinite(Rm) and Rm<60e-3: st='HEAT'; t_touch=t
            elif st=='HEAT' and (t-t_touch)>11e-3: cut=True; st='CUT'   # tiempo fijo calibrado al caso nominal
            elif st=='CUT' and (not np.isfinite(Rm) or Rm>1.0): st='SEARCH'
        # marca stub: si cortó pero seguía sólido (no fundió)
        if cut and phase=='calienta' and st=='CUT': phase='stub'
        t+=dt
    gotas=[i for k,i in res if k=='gota']; stubs=[1 for k,_ in res if k=='STUB']
    clean=[x for x in gotas if x<140]; spat=[x for x in gotas if x>=140]
    return dict(n=len(res), clean=len(clean), spat=len(spat), stub=len(stubs),
                Icut=(np.mean(gotas) if gotas else 0), Terr=(np.mean(Terr) if Terr else np.nan))

print("="*64)
print("RP2350 ADAPTATIVO vs CIEGO — bajo desgaste de punta (±40%), ruido ADC 2%")
print("="*64)
print("  control   | ciclos | LIMPIAS | spatter | stubs | I_corte | errT(TCR)")
for mode,lab in [('rp2350','RP2350 '),('blind ','CIEGO  ')]:
    r=run(mode=mode.strip())
    et=f"{r['Terr']:4.0f}°C" if mode.strip()=='rp2350' else "  —"
    print(f"  {lab}    |   {r['n']:2d}   |   {r['clean']:2d}    |   {r['spat']:2d}    |  {r['stub']:2d}   | {r['Icut']:5.0f} A | {et}")

print("-"*64)
print("ROBUSTEZ del RP2350 al ruido del ADC (I_corte, limpias/total):")
for nz in [0.0,0.02,0.05,0.10]:
    r=run(mode='rp2350',noise=nz)
    print(f"  ruido {nz*100:2.0f}% : corta a {r['Icut']:5.0f} A · {r['clean']}/{r['n']} limpias · errT {r['Terr']:3.0f}°C")
print("="*64)
print("LECTURA (honesta): el RP2350 detecta toque/T/cuello/suelta SOLO de R=V/I,")
print("estima T por TCR (±16°C @2% ruido, se degrada suave), auto-calibra R_frío")
print("cada toque (inmune al desgaste de punta), y corta SUAVE (~54A vs 80A sin")
print("control = ~2× menos energía de spatter ∝i²). En este modelo benigno el ciego")
print("NO hace stubs (la capilaridad desprende sola); el stub/spatter aparece con el")
print("crecimiento por avance — eso ya lo controla el modo ORDEÑO (tamaño de gota).")
print("Cero sensores extra: el contacto ES el sensor. 1 lazo + 2 ADC.")
print("="*64)
