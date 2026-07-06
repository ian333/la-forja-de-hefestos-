#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INDUCTOR DE AIRE para el buck — NO SE SATURA (no hay núcleo). Bobina sobre un
tubo NO metálico (PVC, madera, botella). Wheeler (1 capa):
  L[µH] = 0.3937·r²·N² / (9r + 10·len)   (r, len en cm)
con len = N·paso. AWG10 con plástico ≈ 0.45 cm/vuelta. R_cobre AWG10 ≈ 3.3 mΩ/m.
No necesitas 50 µH exactos: el firmware se adapta. 15-20 µH sobra.
"""
import numpy as np
PASO = 0.45        # cm por vuelta (AWG10 con aislante)
RPM  = 3.277e-3    # Ω/m del AWG10

def turns_for(L_uH, d_cm):
    r = d_cm/2
    # resolver L = 0.3937 r² N² /(9r+10·PASO·N)  →  a N² - b N - c = 0
    a = 0.3937*r*r; b = 10*PASO*L_uH; c = 9*r*L_uH
    N = (b + np.sqrt(b*b + 4*a*c))/(2*a)
    N = int(np.ceil(N))
    length = N*PASO                         # largo de la bobina [cm]
    wire = N*np.pi*d_cm/100                 # cobre necesario [m]
    R = wire*RPM*1e3                        # resistencia [mΩ]
    return N, length, wire, R

print("="*66)
print("BOBINA DE AIRE con AWG10 — sobre tubo NO metálico (PVC/madera)")
print("="*66)
print(" L objetivo | tubo Ø | vueltas | largo bobina | cobre | R bobina")
for L in [10,20,50]:
    for d in [3.0, 5.0, 6.3]:
        N,ln,w,R = turns_for(L,d)
        print(f"   {L:3d} µH   | {d:4.1f}cm |   {N:3d}    |   {ln:5.1f} cm   | {w:4.1f} m | {R:4.1f} mΩ")
    print("  "+"-"*60)

print("RECETA RECOMENDADA (fácil y compacta):")
N,ln,w,R = turns_for(18, 5.0)
print(f"  {N} vueltas de AWG10 sobre tubo PVC de 5 cm Ø → ~18 µH")
print(f"  largo {ln:.0f} cm · {w:.1f} m de cobre · R≈{R:.0f} mΩ")
print("="*66)
print("CLAVES:")
print(" • El tubo debe ser NO metálico (PVC, madera, botella). NADA de fierro.")
print(" • Vueltas apretadas, en una sola capa, bien sujetas (cinta/bridas).")
print(" • NO se satura nunca (ventaja enorme a 130 A).")
print(" • Calor: a corriente alta sostenida la bobina calienta (I²R); para el")
print("   latigazo full usa AWG7 o 2×AWG10 en paralelo. Para primer light, AWG10 ok.")
print(" • Mantenla ~10 cm lejos de la Pico y de masas metálicas (su campo irradia).")
print("="*66)
