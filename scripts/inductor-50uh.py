#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CHOQUE de ~50 µH para el buck de fusión (debe aguantar 80-130 A SIN saturar).
Dos rutas: (A) medir el choque rescatado de la SOMI; (B) bobinar uno en núcleo
de hierro CON ENTREHIERRO (el hierro almacena energía denso → núcleo chico).
Regla dura: B_pico = I·√(μ0·L/(A·g)) < B_sat. Bobina de cobre gruesa (I_rms).
"""
import numpy as np
mu0 = 4*np.pi*1e-7

# ---- objetivo ----
L = 50e-6; Ipk = 130.0; duty = 0.2; Bsat = 1.2   # hierro/silicio ~1.2-1.5 T

print("="*64)
print("A) MEDIR el choque de la SOMI (no lo bobines, mídelo)")
print("="*64)
print("  • LCR meter: directo.")
print("  • Resonancia: en paralelo con un C conocido, excita y mide f →")
print("     L = 1/((2πf)²·C). Con C=1 µF:")
for Lt in [20e-6,50e-6,100e-6]:
    C=1e-6; f=1/(2*np.pi*np.sqrt(Lt*C))
    print(f"     L={Lt*1e6:3.0f} µH  → f_resonante ≈ {f/1e3:5.1f} kHz")
print("  • Escalón V=L·di/dt: mete un escalón de V con la fuente limitada en")
print("     corriente y mide la pendiente di/dt en el osc → L = V/(di/dt).")
print("  • NOTA: L exacto NO importa (el firmware sensa R y cronometra el corte).")

print("\n"+"="*64)
print("B) BOBINAR en núcleo de HIERRO con ENTREHIERRO (E-I salvado / MOT)")
print("   L ≈ μ0·N²·A/g  ·  N=√(L·g/(μ0·A))  ·  B_pico=μ0·N·I/g")
print("="*64)
print("  A_núcleo[cm²] | gap[mm] | N vueltas | B_pico[T] | ¿OK<%.1fT?" % Bsat)
for Acm2 in [4,6,10]:
    for gmm in [1.0,2.0,3.0]:
        A=Acm2*1e-4; g=gmm*1e-3
        N=np.sqrt(L*g/(mu0*A))
        B=mu0*N*Ipk/g
        ok = "saturado" if B>Bsat else "OK"
        print(f"      {Acm2:4d}      |  {gmm:3.1f}   |   {N:4.1f}    |  {B:4.2f}   | {ok}")
# mínimo producto A·g (volumen de gap) para no saturar
AgMin = mu0*L/( (Bsat/Ipk)**2 )
print(f"  → mín A·g (volumen de gap) p/no saturar a {Ipk:.0f}A: {AgMin*1e6:.2f} cm³")
print("  (más gap o más núcleo = menos B; el hierro guarda la energía en el gap)")

print("\n"+"="*64)
print("C) ALAMBRE de la bobina (corriente RMS, no el pico)")
print("="*64)
Irms = Ipk*np.sqrt(duty)
print(f"  I_pico={Ipk:.0f}A, duty≈{duty:.0%} → I_rms ≈ {Irms:.0f} A")
print("  AWG | Ø[mm] | sección[mm²] | I @5A/mm² (conservador, pulsado aguanta más)")
for awg,d in [(6,4.11),(8,3.26),(10,2.59),(12,2.05)]:
    s=np.pi/4*d*d; print(f"   {awg:2d} | {d:4.2f}  |   {s:5.1f}     |  {s*5:4.0f} A")
print(f"  → para {Irms:.0f}A RMS: AWG 8 (o 2× AWG 10 en paralelo). El pulsado ayuda.")

print("\n"+"="*64)
print("RECETA RÁPIDA (núcleo E-I de un trafo viejo, A≈6 cm²):")
A=6e-4; g=2e-3; N=np.sqrt(L*g/(mu0*A)); B=mu0*N*Ipk/g
print(f"  {N:.0f} vueltas de AWG 8 · entrehierro {g*1e3:.0f} mm · A={A*1e4:.0f} cm²")
print(f"  → L≈{L*1e6:.0f} µH · B_pico={B:.2f} T (<{Bsat}T) · ½LI²={0.5*L*Ipk**2*1e3:.0f} mJ")
print("  Entrehierro = pon cartón/kapton entre las mitades del núcleo (1-2 mm).")
print("  PERO: primero MIDE el de la SOMI — seguro ya sirve y te ahorras esto.")
print("="*64)
