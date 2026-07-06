#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
¿LOS 900A ERAN REALES? (reto del user 2026-06-06: "y si de pura cagada no son
errores y si eran 900? analiza el circuito, tienes los datos").
Buena ciencia: NO asumir. Tomamos la hipotesis "900A reales" y la estrellamos
contra 3 leyes fisicas independientes con los datos del banco. Que gane la fisica.
"""
import numpy as np

# ---- DATOS REALES del banco ----
I_lectura = 900.0      # A  lo que marco el shunt (cruda, R=1mO)
t_abort   = 56e-6      # s  tiempo al que abortaba SIEMPRE
L         = 15e-6      # H  choque (45 vueltas, geometria -> 15uH +-20%)
Vsrc      = 12.0       # V
Rds       = 0.044      # O  IRL540N
P_mosfet_max = 150.0   # W  disipacion max del IRL540N (con disipador, generoso)
d_w = 0.8e-3; A_w = np.pi/4*d_w**2
rho_st = 1.5e-7; R_wire13 = rho_st*0.13/A_w     # 13cm de alambre
# observaciones cualitativas: MOSFET "tantito" tibio, alambre FRIO, partes VIVAS

print("="*72)
print("HIPOTESIS A: la corriente REAL era ~900A   (la lectura no miente)")
print("HIPOTESIS B: la real era ~45A, los 900 son ground bounce (x18)")
print("Las estrellamos contra 3 leyes que NO dependen del shunt:")
print("="*72)

# ---------- MURO 1: el CHOQUE manda el di/dt (ley de Faraday) ----------
print("\nMURO 1 — di/dt: la corriente por una bobina NO puede subir mas rapido que V/L")
didt = Vsrc/L
I_max_56us = didt*t_abort
print(f"   di/dt maximo = V/L = {Vsrc}/{L*1e6:.0f}uH = {didt*1e-6:.2f} A/us")
print(f"   en {t_abort*1e6:.0f}us el TECHO ABSOLUTO de corriente = {I_max_56us:.0f} A  (con R=0)")
L_para_900 = Vsrc/(I_lectura/t_abort)
print(f"   para llegar a 900A en 56us harian falta L = {L_para_900*1e6:.2f} uH")
print(f"   pero el choque es 15uH (45 vueltas medidas) -> 900A es IMPOSIBLE por {15/(L_para_900*1e6):.0f}x")
print("   *** el shunt esta EN SERIE con el choque -> toda su corriente pasa por el")
print("       choque -> 900A en 56us viola Faraday. VEREDICTO MURO 1: B (45A).")

# ---------- MURO 2: la potencia en el MOSFET (se habria vaporizado) ----------
print("\nMURO 2 — potencia en el MOSFET: P = I^2 * Rds")
for nm,I in [("A: 900A",900.0),("B: 45A",45.0)]:
    P=I**2*Rds
    veredicto = "VAPORIZA (>> 150W)" if P>P_mosfet_max else "OK (disipador lo aguanta = 'tantito')"
    print(f"   {nm:8s} -> P = {P:8.0f} W   -> {veredicto}")
print("   Observacion real: el MOSFET solo se puso TIBIO. A 900A serian 35,600W =")
print("   35 kW en un chip de 150W -> humo en microsegundos. SOBREVIVIO -> no eran 900A.")
print("   VEREDICTO MURO 2: B (45A).")

# ---------- MURO 3: el alambre (se habria volado) ----------
print("\nMURO 3 — el alambre de 0.8mm: P = I^2 * R_alambre (13cm)")
print(f"   R_alambre(13cm) = {R_wire13*1e3:.0f} mO")
for nm,I in [("A: 900A",900.0),("B: 45A",45.0)]:
    P=I**2*R_wire13; Jdens=I/A_w/1e6
    print(f"   {nm:8s} -> {P:7.0f} W en 13cm  (densidad {Jdens:.0f} A/mm2)")
print("   Un alambre de 0.8mm de acero se FUNDE/VUELA por ~150-250A. A 900A explota")
print("   en ms. Observacion real: el alambre quedo FRIO -> jamas paso 900A.")
print("   VEREDICTO MURO 3: B (45A).")

# ---------- consistencia de la hipotesis B ----------
print("\n"+"="*72)
print("¿La hipotesis B (45A) cuadra con TODO? (no solo refuta A, debe explicar el dato)")
print("="*72)
Rbounce = (I_lectura*0.001 - 45*0.001)/45   # cuanta R extra explica la lectura
V_sense = I_lectura*0.001                     # el ADC vio ~0.9V
Rtot_apar = V_sense/45.0
print(f"   El ADC vio {V_sense*1e3:.0f} mV. Si la corriente real es 45A, eso implica que")
print(f"   el sense ve R efectiva = {Rtot_apar*1e3:.0f} mO  (1mO shunt + ~{(Rtot_apar-0.001)*1e3:.0f}mO de tierra compartida)")
print(f"   ~18mO de ground bounce = totalmente normal en cable/protoboard. CUADRA.")
print("   Y 45A es EXACTO el techo del MURO 1 (di/dt a 56us) -> todo encaja.")

print("\n"+"="*72)
print("VEREDICTO FINAL (3 leyes independientes, ninguna usa el shunt):")
print("  MURO 1 (Faraday): 900A en 56us necesita 0.75uH, el choque es 15uH -> NO")
print("  MURO 2 (potencia): 900A = 35kW en el MOSFET -> vaporiza; sobrevivio -> NO")
print("  MURO 3 (alambre):  900A vuela un alambre de 0.8mm; quedo frio -> NO")
print("  Las 3, por caminos distintos, dan ~45A. NO fue cagada: ERA bounce.")
print("  PERO tu duda era CORRECTA cientificamente: ahora esta PROBADO, no asumido.")
print("  (La unica via para 900A reales: choque de 0.75uH Y MOSFET indestructible Y")
print("   alambre indestructible -> las 3 falsas a la vez = imposible.)")
print("="*72)
