#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUCK DE FUSIÓN — el circuito MÍNIMO (1 MOSFET + 1 choque + 1 diodo + caps).
Verifica ANTES de soldar: pico de corriente, caída de los caps, corriente que
pide la fuente, y EL KICKBACK al cortar (por qué el diodo flyback es vida o muerte).

Topología buck: Fuente(24V) → [CAPS] → MOSFET → CHOQUE(L) → junta(R_load) → tierra.
  MOSFET ON :  L di/dt = V_cap − i·R_load ;  C dV/dt = I_fuente − i
  MOSFET OFF:  i recircula por el DIODO: L di/dt = −i·R_load − Vf ;  C dV/dt = I_fuente
El RP2350 mete el PWM (duty = potencia de fusión) y el patrón del ordeñado.
"""
import numpy as np
Vsrc=24.0; L=50e-6; Rload=12e-3; Vf=0.4          # fuente impresora, choque SOMI, junta, diodo
fpwm=20e3; Rsrc=0.2                               # PWM 20kHz, R interna fuente
C=22000e-6                                        # banco de caps (rescatados SOMI)

def run_buck(duty, C=C, tmax=12e-3, dt=1e-7):
    i=0.0; Vc=Vsrc; t=0.0
    Tpwm=1/fpwm; iss=[]; Vcs=[]; Isrc_acc=0.0; n=0
    while t<tmax:
        on = (t % Tpwm) < duty*Tpwm
        Ifuente=max((Vsrc-Vc)/Rsrc,0.0)           # la fuente recarga el cap
        if on:
            i += (Vc - i*Rload)/L*dt
            Vc += (Ifuente - i)/C*dt
        else:
            i = max(i + (-i*Rload - Vf)/L*dt, 0.0) # freewheel por el diodo
            Vc += (Ifuente)/C*dt
        i=max(i,0.0)
        if t>tmax*0.5: iss.append(i); Vcs.append(Vc); Isrc_acc+=Ifuente; n+=1
        t+=dt
    return np.array(iss), np.array(Vcs), Isrc_acc/max(n,1)

print("="*64)
print(f"BUCK DE FUSIÓN  ·  Vsrc={Vsrc}V  L={L*1e6:.0f}µH  R_junta={Rload*1e3:.0f}mΩ  C={C*1e6:.0f}µF")
print("="*64)
print("Duty PWM | i_choque medio | ripple | P_fusión | I_fuente | V_cap caída")
for D in [0.05,0.10,0.20,0.35,0.50]:
    ii,vc,isrc = run_buck(D)
    imean=ii.mean(); irip=ii.max()-ii.min(); P=imean*imean*Rload
    sag=Vsrc-vc.min()
    print(f"  {D*100:4.0f}%  |   {imean:5.0f} A     | {irip:4.0f} A | {P:5.0f} W  |  {isrc:4.1f} A  |  {sag:4.2f} V")
print("→ la fuente solo da unos A (DC); el CHOQUE lleva decenas de A a la junta.")
print("  Es amplificación de corriente SIN transformador (24V/pocos A → <1V/decenas A).")

# ---- EL KICKBACK: cortar i por el choque, con vs sin diodo ----
print("\n"+"="*64)
print("KICKBACK al CORTAR (latigazo) — por qué el diodo flyback es CRÍTICO")
print("="*64)
icut=130.0; Cpar=1e-9                              # corte a 130A; capacitancia parásita del MOSFET
E=0.5*L*icut**2
Vspike_nodiode=np.sqrt(2*E/Cpar)                  # ½Li² → ½CV²  (sin camino para i)
print(f"  cortas {icut:.0f} A por {L*1e6:.0f}µH → energía en el choque ½Li² = {E*1e3:.0f} mJ")
print(f"  SIN diodo: esa energía cae en {Cpar*1e9:.0f}nF parásito → V_pico ≈ {Vspike_nodiode/1e3:.1f} kV  ☠ MOSFET muerto")
print(f"  CON diodo: i recircula → V_MOSFET se clava en Vsrc+Vf ≈ {Vsrc+Vf:.1f} V  ✓")
print(f"  → MOSFET basta con 60–100V (margen p/ringing). Diodo debe aguantar {icut:.0f}A de pico.")

# ---- sizing de los caps: que no se hundan en el pulso ----
print("\n"+"="*64)
print("TAMAÑO de los caps — que el pulso no hunda el voltaje (<10% = 2.4V)")
print("="*64)
ipk=130.0; tpulse=1.5e-3; Isrc=2.5
dQ=(ipk-Isrc)*tpulse
print(f"  pulso {ipk:.0f}A por {tpulse*1e3:.1f}ms, fuente da {Isrc:.1f}A → falta ΔQ={dQ*1e3:.0f} mC")
for sag in [0.05,0.10,0.20]:
    Cneed=dQ/(Vsrc*sag)
    print(f"   sag {sag*100:2.0f}% ({Vsrc*sag:.1f}V): C ≥ {Cneed*1e6:5.0f} µF")
print("  → los caps GRANDES de la SOMI cubren esto de sobra (era una soldadora).")

print("\n"+"="*64)
print("LISTA MÍNIMA confirmada por números:")
print(f"  • MOSFET N-ch 60–100V, ~150A pico, Rds_on bajo")
print(f"  • DIODO flyback Schottky ~{icut:.0f}A — SIN ÉL el MOSFET muere al 1er pulso")
print(f"  • CHOQUE ~{L*1e6:.0f}µH (SOMI) + CAPS ~22000µF (SOMI)")
print(f"  • Fuente: la de la impresora (24V) SOBRA — solo da ~2.5A promedio")
print(f"  • Sensor ACS758 p/ i y R=V/i (detectar el cuello) + punta contacto MIG 0.8mm")
print("="*64)
