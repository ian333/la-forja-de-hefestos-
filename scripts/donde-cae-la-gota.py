#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
¿DÓNDE CAE LA GOTA? — balística del depósito en vuelo (ordeño).
La gota se desprende de un cabezal que se MUEVE → hereda su v horizontal y cae
ADELANTE: tiro = v_cabezal · t_caída. t_caída del gap y la v de eyección.
  h = v_z0·t + ½ g t²  →  t = (−v_z0 + √(v_z0²+2gh))/g
El RP2350 conoce v_cabezal (planner) y h (lo SENSA por R=V/I) → calcula el tiro y
DISPARA ADELANTADO (lead) para que caiga en el blanco. Residual = dispersión por
variación de la v de eyección gota a gota = el PISO de precisión a esa velocidad.
"""
import numpy as np
g=9.81
def tfall(h, vz0): return (-vz0+np.sqrt(vz0*vz0+2*g*h))/g

print("="*64)
print("A) TIEMPO DE CAÍDA t (gap h, v de eyección v_z0)")
print("="*64)
print("  gap[mm] | v_z0=0 (cae solo) | v_z0=0.3 m/s | v_z0=0.6 m/s")
for hmm in [0.5,1.0,2.0]:
    h=hmm*1e-3
    print(f"   {hmm:4.1f}   |     {tfall(h,0)*1e3:5.1f} ms      |   {tfall(h,0.3)*1e3:4.1f} ms    |   {tfall(h,0.6)*1e3:4.1f} ms")

print("\n"+"="*64)
print("B) TIRO = v_cabezal · t_caída  (gap 1mm) — error SIN compensar")
print("="*64)
h=1e-3
print("  v_cabezal[mm/s] | tiro v_z0=0 | tiro v_z0=0.3 | ¿>1mm objetivo?")
for v in [20,40,60,100]:
    t0=tfall(h,0); t3=tfall(h,0.3)
    d0=v*1e-3*t0*1e3; d3=v*1e-3*t3*1e3
    flag="¡SÍ, arruina!" if d0>0.3 else "chico"
    print(f"     {v:4d}       |  {d0:4.2f} mm  |   {d3:4.2f} mm   | {flag}")
print("  → el tiro es de DÉCIMAS de mm: del orden de tu precisión. HAY que compensar.")

print("\n"+"="*64)
print("C) COMPENSACIÓN: disparar ADELANTADO (lead = v·t). Residual = dispersión")
print("="*64)
def dtdv(h,vz0): S=np.sqrt(vz0*vz0+2*g*h); return abs((vz0/S-1)/g)   # dt/dv_z0
sig_vz0=0.1     # la v de eyección varía ±0.1 m/s gota a gota
print(f"  (la v de eyección dispersa ±{sig_vz0} m/s → t_caída dispersa → aterrizaje dispersa)")
print("  v_cabezal[mm/s] | tiro medio | LEAD que mete el RP2350 | residual σ (piso)")
for v in [20,40,60,100]:
    t3=tfall(h,0.3); lead=v*1e-3*t3*1e3
    sig_land=v*1e-3*dtdv(h,0.3)*sig_vz0*1e3
    print(f"     {v:4d}       |  {lead:4.2f} mm  |     {lead:4.2f} mm          |   ±{sig_land:4.3f} mm")
print("  → tras compensar, el ERROR MEDIO → 0; queda solo ±0.05mm a 60mm/s (bajo 1mm).")
print("  → menos gap = menos tiro y menos dispersión; latigazo (contacto)=tiro casi 0.")

print("\n"+"="*64)
print("D) ¿Lo puede el RP2350? — sí, es UNA fórmula por gota")
print("="*64)
print("  t = (−v_z0+√(v_z0²+2gh))/g ;  lead = v_cabezal·t  →  dispara en (blanco − lead)")
print("  • v_cabezal: del planner (ya lo tiene)")
print("  • h (gap): lo SENSA por R=V/I (la misma medición del contacto)")
print("  • costo: 1 mult + 1 sqrt (~µs en M33 a 150MHz, o LUT). Trivial.")
print("="*64)
print("LECTURA: SÍ se calcula dónde cae (X,Y) — es balística determinista. El tiro")
print("es de décimas de mm (del tamaño de tu objetivo) → el RP2350 dispara ADELANTADO")
print("con lead=v·t (v del planner, h del sensado). Residual ±0.05mm @60mm/s. Para lo")
print("más fino: gap chico o transferencia por contacto (latigazo, tiro~0).")
print("="*64)
