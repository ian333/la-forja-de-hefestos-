#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
¿CÓMO CONTROLA LA DISTANCIA (gap)?  — sin sensor de distancia, por TIEMPO.
En contacto, la gota crece y cuelga ~su diámetro; TOCA cuando d = gap. El RP2350
ve el PUENTE por R=V/I (R cae) y CRONOMETRA cuánto creció: t_b = π·gap³/(6·A_w·v_f).
→ gap = (6·A_w·v_f·t_b/π)^(1/3).  El mismo sensor R da la distancia, por timing.
Luego TRIMEA Z (servo) para mantener el gap objetivo mientras la pieza CRECE.
Sin servo: la superficie sube por capa → el gap se cierra → la punta SE ESTRELLA.
"""
import numpy as np
Aw=np.pi/4*(0.8e-3)**2; vf=4e-3
d_of_t=lambda t:(6*Aw*vf*t/np.pi)**(1/3)
t_of_gap=lambda g: np.pi*g**3/(6*Aw*vf)
gap_tgt=0.10e-3; crit=0.186e-3

print("="*64)
print("A) El gap se MIDE por el tiempo de puente (R=V/I detecta el toque)")
print("="*64)
print("  gap[mm] | t_puente[ms] | cadencia[Hz] | (más gap = crece más = tarda más)")
for gmm in [0.05,0.10,0.15,0.20,0.30]:
    tb=t_of_gap(gmm*1e-3); print(f"   {gmm:4.2f}  |   {tb*1e3:5.2f}    |   {1/tb:6.0f}")
print("  → el RP2350 cronometra t_puente → gap = (6 A_w v_f t_b/π)^(1/3). Sin sensor.")

# B) SERVO de Z: mantener el gap mientras la pieza crece + superficie ondulada
def run(servo, n=600, Kp=0.6, seed=1):
    rng=np.random.default_rng(seed)
    Z=gap_tgt; Hs=0.0; hbead=0.04e-3            # cada gota sube la superficie ~0.04mm
    gaps=[]; crash=False
    for i in range(n):
        # superficie real bajo la punta: sube por deposición + onda + un escalón
        wob=0.03e-3*np.sin(i/25.0) + (0.06e-3 if i>300 else 0.0)
        Hs_loc=Hs+wob
        gap=Z-Hs_loc
        if gap<=0: crash=True; gap=0.0
        gaps.append(gap)
        # el RP2350 mide el gap por timing del puente (con ruido de reloj/ADC)
        if gap>1e-6:
            tb=t_of_gap(gap)*(1+0.04*rng.standard_normal())
            gmeas=d_of_t(max(tb,1e-9))
        else: gmeas=0.0
        if servo:                                # trim de Z hacia el objetivo
            Z += -Kp*(gmeas-gap_tgt)
        # depositó una gota → la superficie local sube
        Hs += hbead* (1.0/ max(1, n) ) * 30      # sube gradual (capas)
    g=np.array(gaps)*1e3
    return g, crash

print("\n"+"="*64)
print("B) SERVO de Z (trim por R=V/I) vs SIN servo, mientras la pieza CRECE")
print("="*64)
gs, cs = run(servo=True); gn, cn = run(servo=False)
print(f"  CON servo : gap = {gs.mean():.3f} ± {gs.std():.3f} mm  · crash={cs} · régimen estable={'contacto' if gs.mean()<crit*1e3 else 'vuelo'}")
print(f"  SIN servo : gap = {gn.mean():.3f} ± {gn.std():.3f} mm  · crash={cn} (la superficie sube y la punta se estrella)")
print(f"  → el servo mantiene el gap fijo (±{gs.std():.3f}mm); sin él, deriva y choca.")

# C) ¿quién hace qué?
print("\n"+"="*64)
print("C) REPARTO — RP2350 (Pico) vs Raspberry Pi (Linux)")
print("="*64)
print("  RP2350 (µs, determinista):  sensa R=V/I · detecta puente · CRONOMETRA gap")
print("     · trim de Z (servo de distancia) · dispara latigazo/ordeño · steps")
print("  Raspberry Pi (ms, Linux):   rebana la pieza generativa · trayectoria XY")
print("     · gap OBJETIVO por zona (contacto fino / vuelo relleno) · Z nominal por")
print("       capa · UI/registro.  NO el lazo rápido (jitter de Linux lo rompería).")
print("="*64)
print("RESPUESTA: la distancia NO se mide con sensor — el RP2350 cronometra el puente")
print("(R=V/I) → infiere el gap → trimea Z. El Pi solo manda el gap objetivo y el plan.")
print("="*64)
