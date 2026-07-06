#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ORDEÑADO RESONANTE — modular el TAMAÑO de la gota (drop-on-demand).
Fix vs v1: el forzado lleva DC de sostén I0 + ripple I_ac. El término que RESUENA
es el CRUZADO (I0+I_ac sin)² ⊃ 2·I0·I_ac·sin(ωt). Sin I0 no hay resonancia (bug v1).

TRES verdades:
 A) RESONANCIA real: |q|(f) es Lorentziana con pico en f2 (amplificación ×Q).
    A resonancia basta un ripple chico para llevar q→1 (pinch) en pocos ciclos.
 B) MODULACIÓN del tamaño (la clave): cada disparo suelta el metal ACUMULADO
    desde el disparo anterior → V_gota = (A_w·v_f)/f_disparo. Dos perillas:
    frecuencia de disparo y avance de alambre. d = (6·A_w·v_f/(π·f))^(1/3).
 C) Límite: disparar más rápido que f2(a) no deja reformar la gota; y bajo
    Oh→ piso de satélites. Gota chica ⇒ f2 sube (∝a^-1.5) ⇒ SE PUEDE disparar
    más rápido (auto-consistente). Piso práctico ~0.2 mm para alambre 0.8 mm.
"""
import numpy as np
rho=7000.; gamma=1.5; mu=5e-3; mu0=4*np.pi*1e-7
nu=mu/rho; rw=0.4e-3; Aw=np.pi*rw*rw
def icrit(r): return np.sqrt(8*np.pi*np.pi*r*gamma/mu0)
def a_of(V): return (3*V/(4*np.pi))**(1/3)
def f2_of(a): return np.sqrt(8*gamma/(rho*a**3))/(2*np.pi)
def Q_of(a):  return f2_of(a)*2*np.pi/(2*5*nu/a**2)   # Lamb l=2: β=5ν/a²

# ============ A) RESONANCIA: |q|(f) Lorentziana (analítica, validada) ============
print("="*68)
print("A) RESONANCIA — respuesta |q|(f) con DC I0=60A + ripple I_ac=8A")
print("="*68)
a0=a_of(np.pi/6*(0.30e-3)**3); w2=2*np.pi*f2_of(a0); Q=Q_of(a0); ic=icrit(a0)
Fac=w2*w2*(2*60.*8.0/ic**2)                          # amplitud del término cruzado
def qamp(f):
    w=2*np.pi*f
    return Fac/np.sqrt((w2*w2-w*w)**2+(w2*w/Q)**2)
f2=f2_of(a0)
print(f"  gota 0.30mm: f2={f2:.0f} Hz · Q={Q:.0f} · i_crit={ic:.0f} A")
print("  f/f2 | |q| (pinch si ≥1)")
for fr in [0.5,0.8,0.95,1.0,1.05,1.2,1.5]:
    q=qamp(f2*fr); print(f"  {fr:4.2f} | {q:5.2f}  {'← PINCH' if q>=1 else ''}")
print(f"  → pico agudo en f2 (×Q). Fuera de tono q se desploma. Ripple 8A basta.")

# ============ B) MODULACIÓN del tamaño: V = A_w·v_f / f_disparo ============
print("\n"+"="*68)
print("B) MODULAR EL TAMAÑO — d_gota = (6·A_w·v_f/(π·f_disparo))^(1/3)")
print("="*68)
print("  perilla 1 — FRECUENCIA de disparo (avance fijo v_f=20 mm/s):")
print("   f_disp[Hz] | V_gota[nL] | d_gota[mm] | ¿f≤f2(d)? (reforma a tiempo)")
for fdisp in [60,120,250,500,800,1200,2000]:
    V=Aw*20e-3/fdisp; d=(6*V/np.pi)**(1/3); a=a_of(V); ok=fdisp<=f2_of(a)
    print(f"     {fdisp:5d}   |   {V*1e12:6.2f}  |   {d*1e3:5.3f}   |  f2={f2_of(a):5.0f}Hz {'OK' if ok else 'DEMASIADO RÁPIDO'}")

print("\n  perilla 2 — AVANCE de alambre (frecuencia fija f_disp=500 Hz):")
print("   v_f[mm/s] | V_gota[nL] | d_gota[mm]")
for vfmm in [5,10,20,40,80]:
    V=Aw*(vfmm*1e-3)/500; d=(6*V/np.pi)**(1/3)
    print(f"     {vfmm:4d}    |   {V*1e12:6.2f}  |   {d*1e3:5.3f}")

# ============ C) auto-consistente: disparar a f2(a)=f_disparo ============
print("\n"+"="*68)
print("C) PUNTO AUTO-CONSISTENTE — disparar EXACTAMENTE a la resonancia f2(a)")
print("="*68)
print("  (a la gota que el avance forma en 1/f2 le toca su propia f2 → ordeño limpio)")
print("   v_f[mm/s] | d_gota[mm] | f2=f_disp[Hz] | ripple p/pinch I_ac[A]")
for vfmm in [5,10,20,40]:
    vfa=vfmm*1e-3
    # resolver f tal que f = f2( a(A_w·v_f/f) )  → iterar
    f=500.
    for _ in range(60):
        a=a_of(Aw*vfa/f); f=f2_of(a)
    a=a_of(Aw*vfa/f); d=2*a; icc=icrit(a); Qa=Q_of(a)
    Iac=icc*icc/(2*Qa*60.)                          # ripple mínimo: q=Q·2I0Iac/ic²=1
    print(f"     {vfmm:4d}    |   {d*1e3:5.3f}   |    {f:6.0f}     |   {Iac:5.1f}")

print("\n"+"="*68)
print("LECTURA: SÍ se modula el tamaño, con DOS perillas independientes —")
print("  • frecuencia de disparo  • avance de alambre  (V=A_w·v_f/f).")
print("La resonancia hace cada disparo LIMPIO (1 nodo, ripple ~pocos A).")
print("Gota chica → f2 más alta → puedes disparar más rápido (se retroalimenta).")
print("Piso real ~0.2mm (alambre 0.8mm, Oh bajo); para menos, alambre más fino.")
print("="*68)
