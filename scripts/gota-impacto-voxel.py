#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LA GOTA A FONDO: espectro de modos + impacto/mojado → el VÓXEL del diseño.
El píxel de la pieza NO es la gota en vuelo, es su HUELLA al impactar y mojar.
Cadena: desprende (modo l) → vuela (balística) → impacta (We,Re) → se esparce
(mojado, ángulo de contacto θ) → solidifica → VÓXEL. Ese vóxel (tamaño variable
a demanda) es el primitivo del diseño GENERATIVO.
"""
import numpy as np
gamma=1.5; rho=7000.; mu=5e-3; g=9.81

# ===== A) LA GOTA ES UN TAMBOR: espectro de modos de Rayleigh =====
print("="*66)
print("A) ESPECTRO DE MODOS (la gota es un tambor): ω_l²=l(l-1)(l+2)·γ/(ρa³)")
print("="*66)
def fl(l,a): return np.sqrt(l*(l-1)*(l+2)*gamma/(rho*a**3))/(2*np.pi)
a=0.10e-3   # gota de 0.2mm
print(f"  gota d=0.20mm (a={a*1e3:.2f}mm):  modo l | f_l[Hz] | forma (P_l)")
formas={2:"prolato/oblato (PINCHA)",3:"pera",4:"cuadrilóbulo",5:"pentalóbulo"}
for l in [2,3,4,5]:
    print(f"     l={l}  | {fl(l,a):6.0f} | {formas[l]}")
print("  → l=2 es el modo de desprendimiento; los altos esculpen la forma.")
print("    el ordeño excita l=2; modos altos = palanca extra de control de forma.")

# ===== B) IMPACTO: ¿salpica o se esparce limpio? =====
print("\n"+"="*66)
print("B) IMPACTO — We=ρv²d/γ, Re=ρvd/μ; salpica si K=√We·Re^¼ > ~57")
print("="*66)
h=1e-3; vz0=0.3                              # gap 1mm, eyección 0.3 m/s
def vimp(h,vz0,vhead):
    vz=np.sqrt(vz0*vz0+2*g*h); return np.sqrt(vz*vz+vhead*vhead)
print("  d_gota[mm] | v_impacto | We     | Re   | K   | régimen")
for dmm in [0.14,0.20,0.27]:
    d=dmm*1e-3; v=vimp(h,vz0,0.06)
    We=rho*v*v*d/gamma; Re=rho*v*d/mu; K=np.sqrt(We)*Re**0.25
    reg="SALPICA" if K>57 else "deposita limpio"
    print(f"    {dmm:4.2f}    |  {v:4.2f} m/s | {We:5.3f} | {Re:4.0f} | {K:3.1f} | {reg}")
print("  → We<<1: NO hay energía de impacto para esparcir/salpicar → MOJADO manda.")

# ===== C) EL VÓXEL: huella por MOJADO (casquete esférico, ángulo θ) =====
print("\n"+"="*66)
print("C) EL VÓXEL = huella de mojado.  D_huella/d = 2 sinθ·[1/(2(1-cosθ)²(2+cosθ))]^⅓")
print("="*66)
def spread(theta):
    c=np.cos(theta); s=np.sin(theta)
    return 2*s*(1/(2*(1-c)**2*(2+c)))**(1/3)
print("  ángulo θ | D_huella/d | (mojado: θ chico=esparce, θ grande=bolita)")
for thd in [30,50,70,90]:
    print(f"    {thd:3d}°   |   {spread(np.radians(thd)):4.2f}×")
print("\n  RESOLUCIÓN real (vóxel) por tamaño de gota, θ=50° (acero moja bien):")
print("  d_gota[mm] | vóxel D[mm] | altura[mm]")
xi=spread(np.radians(50))
for dmm in [0.14,0.20,0.27,0.40]:
    D=dmm*xi; hgt=(dmm**3)/(1.5*D**2)        # vol cap ~ esfera → altura aprox
    print(f"    {dmm:4.2f}    |   {D:4.2f}     |  {hgt:4.3f}")
print(f"  → vóxel ≈ {xi:.1f}× la gota. Gotas 0.14-0.40mm → VÓXELES 0.25-0.7mm controlables.")

# ===== D) DISEÑO GENERATIVO: el vóxel variable como primitivo =====
print("\n"+"="*66)
print("D) DISEÑO GENERATIVO — por qué el vóxel VARIABLE es el match perfecto")
print("="*66)
print("  • El vóxel es CONTROLABLE a demanda (gota→f_disparo) y COLOCABLE (balística).")
print("  • Resolución VARIABLE en el espacio: vóxel grande en el bulto, chico en")
print("    superficie/detalle → menos capas y menos overhead donde no importa el detalle.")
print("  • Depósito = solo se ADITIVA lo necesario (generativo quita masa → cero desperdicio).")
print("  • Freeform/lattices: la balística coloca vóxeles en 3D, sin moldes ni CNC.")
print("\n  Vóxel adaptativo vs fijo-fino (overhead de capas para un muro de 10mm de alto):")
print("  estrategia        | altura capa | nº capas | overhead relativo")
for nm,hcap in [("fino (gota 0.14)",0.10),("medio (0.20)",0.15),("bulto (0.40)",0.30)]:
    nl=10/hcap; print(f"  {nm:17s} |  {hcap:4.2f}mm    |  {nl:4.0f}   | {nl/(10/0.30):4.1f}×")
print("  → el bulto con gotas grandes = 3× menos capas = 3× menos arranques/Z/cornering.")
print("    La tasa de FUNDIDO es la misma (potencia), pero el OVERHEAD baja fuerte.")
print("\n"+"="*66)
print("LECTURA: la gota es un tambor (modos l); al caer NO salpica (We<<1) → moja y")
print("deja un VÓXEL ~1.7× su diámetro (0.25-0.7mm, a demanda). Ese vóxel variable +")
print("colocable es el primitivo ideal del DISEÑO GENERATIVO: fino donde hay detalle,")
print("grueso en el bulto, solo lo necesario, freeform — en una máquina barata. EL BOOM.")
print("="*66)
