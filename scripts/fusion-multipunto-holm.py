#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FUSION MULTIPUNTO + HOLM — la simulacion actualizada con las variables REALES del
banco (2026-06-05) y la fisica que faltaba: la TEORIA DE CONTACTOS DE HOLM.

QUE APRENDIMOS EN FIERRO (variables nuevas):
  - Choque real L ~= 15 uH (45 vueltas AWG10, tubo 40.8mm, 23cm).
  - A ~50A SOSTENIDOS la punta NO funde, llega a estado ESTACIONARIO tibio.
  - El MOSFET se calienta, el alambre NO -> el calor NO se concentra en la junta.
  - A 500ms la R bajo ~11% (267->237mO) = el contacto SE ABLANDO (no fundio).
  - El shunt de 1mO + tierra compartida = ground bounce -> lectura inflada (no
    se puede separar I real de la caida del cable de tierra con 1 solo punto).

LA FISICA QUE FALTABA (Holm): un contacto electrico funde cuando el VOLTAJE a
traves de el llega al "voltaje de fusion" U_m, INDEPENDIENTE de corriente o tiempo:
        U_m = sqrt( 4 * L * (T_m^2 - T_0^2) )        (L = Wiedemann-Franz)
Esto YA incluye la conduccion de calor al plato (es la T de equilibrio del
estrangulamiento). El criterio de fundir es SIMPLE:  V_junta >= U_m (~0.55V acero).
"""
import numpy as np

# ============================ 1) HOLM: voltajes umbral =====================
L_WF = 2.44e-8        # V^2/K^2  (numero de Lorenz, Wiedemann-Franz)
T0   = 300.0          # K  ambiente
Tm   = 1811.0         # K  fusion del acero (1538 C)
Tsoft= 1000.0         # K  ablandamiento (~700 C)

def U_holm(T_hot, T_cold=T0):
    return np.sqrt(4*L_WF*(T_hot**2 - T_cold**2))

U_melt = U_holm(Tm)
U_soft = U_holm(Tsoft)

print("="*70)
print("1) TEORIA DE HOLM — un contacto funde por VOLTAJE, no por corriente/tiempo")
print("="*70)
print(f"   Voltaje de ABLANDAMIENTO (acero ~700C): U_s = {U_soft:.2f} V")
print(f"   Voltaje de FUSION        (acero 1538C): U_m = {U_melt:.2f} V")
print("   -> Para FUNDIR la junta hay que poner ~0.55 V A TRAVES de ella.")
print("   -> Esto ya incluye que el plato roba calor (es la T de equilibrio).")

# ============================ 2) por que NO fundio =========================
# En el banco vimos ABLANDAMIENTO (R bajo 11% a 500ms) pero NO fusion.
# => V_junta llego a ~U_s (~0.3V) pero no a U_m (~0.55V).  Con I~50A:
I_obs = 50.0
Rj_obs = U_soft / I_obs        # R de la junta inferida del ablandamiento
print("\n"+"="*70)
print("2) POR QUE NO FUNDIO HOY (cuadra con el banco)")
print("="*70)
print(f"   Vimos ABLANDAMIENTO (R cayo ~11% a 500ms) = V_junta llego a ~U_s={U_soft:.2f}V")
print(f"   Con I~{I_obs:.0f}A  ->  R_junta ~= U_s/I = {Rj_obs*1e3:.1f} mO  (contacto MUY bueno/bajo)")
print(f"   Para fundir falta llegar a U_m={U_melt:.2f}V: con esa misma R_junta de {Rj_obs*1e3:.1f}mO")
print(f"   se necesitan  I = U_m/R_junta = {U_melt/Rj_obs:.0f} A   (vamos en {I_obs:.0f}A)")
print("   -> CUADRA con la sim vieja que pedia ~130A. El contacto es demasiado")
print("      bueno (R baja) -> V_junta < U_m -> calienta pero no funde.")

# ============================ 3) circuito real + palancas ==================
# Modelo del lazo:  Vsrc / (R_parasita + R_alambre + R_junta) = I
Vsrc   = 12.0
Rds1   = 0.044                 # IRL540N (uno)
Rchoke = 0.020                 # DCR del choque de aire (AWG10)
Rcable = 0.010                 # cables + conexiones
rho_st = 1.5e-7               # resistividad acero (Ohm*m)
d_w    = 0.8e-3; A_w = np.pi/4*d_w**2
def R_wire(stick_cm): return rho_st*(stick_cm*1e-2)/A_w   # R del alambre por stickout

print("\n"+"="*70)
print("3) PALANCAS para llegar a U_m=0.55V  (V_junta = I * R_junta)")
print("="*70)
print(f"   R_alambre(0.8mm acero) = {R_wire(1)*1e3:.0f} mO/cm  -> stickout corto importa")
print("\n   N_MOSFET | stickout | R_lazo | I [A] | V_junta | estado")
for Nmos in [1, 2, 3]:
    for stick in [10.0, 3.0]:
        Rpar = Rds1/Nmos + Rchoke + Rcable + R_wire(stick)
        Rj   = Rj_obs                       # mismo contacto (~6mO)
        I    = Vsrc/(Rpar + Rj)
        Vj   = I*Rj
        est  = "FUNDE" if Vj>=U_melt else ("ablanda" if Vj>=U_soft else "tibio")
        print(f"     {Nmos}     | {stick:4.0f}cm  | {(Rpar+Rj)*1e3:5.0f}mO | {I:5.0f} | {Vj:5.2f}V  | {est}")

print("\n   + La otra palanca: contacto MAS CHICO -> R_junta sube -> V_junta sube")
print("   N_MOSFET=3, stickout=3cm, variando R_junta (tamano de contacto):")
Rpar3 = Rds1/3 + Rchoke + Rcable + R_wire(3.0)
for Rj_m in [6, 10, 15, 20]:
    Rj = Rj_m*1e-3
    I  = Vsrc/(Rpar3+Rj); Vj=I*Rj
    est="FUNDE" if Vj>=U_melt else ("ablanda" if Vj>=U_soft else "tibio")
    print(f"      R_junta={Rj_m:2d}mO -> I={I:4.0f}A  V_junta={Vj:.2f}V  {est}")

# ============================ 4) sensado MULTIPUNTO ========================
# El problema: 1 shunt single-ended + tierra compartida = no separas I de bounce.
# La solucion: medir VARIOS nodos, todos vs la MISMA tierra, y RESTAR.
print("\n"+"="*70)
print("4) CIRCUITO DE SENSADO MULTIPUNTO — resuelve el error del shunt")
print("="*70)
print("""   Nodos a medir (todos por divisor, ref. UNICA = pata de abajo del shunt):
     A = riel +12 (despues de caps)
     B = salida del choque  (= lado alambre de la junta)
     C = placa/drain        (= lado placa de la junta)   <-- NUEVO
     D = source del MOSFET  (= pata ARRIBA del shunt)
     E = pata ABAJO del shunt = TIERRA estrella (referencia)

   Lo que sale por RESTA (cancela el bounce, que es comun a todos):
     I_real   = (D - E) / R_shunt          <- shunt DIFERENCIAL (2 patas) = I VERDADERA
     V_junta  = (B - C)                     <- directo a traves del contacto  *** la joya ***
     V_choque = (A - B)                     <- caida del choque (L di/dt + DCR)
     V_mosfet = (C - D)                     <- Rds*I (verifica el MOSFET)
     R_junta  = V_junta / I_real            <- y AHORA sabes si V_junta >= U_m

   ASI, en vivo, comparas V_junta contra los 0.55V y sabes EXACTO si va a fundir.""")

# demo numerica del bounce: por que 1 punto miente y 2 puntos no
I_real = 50.0; Rsh = 0.001; Rbounce = 0.018
V_top = I_real*(Rsh) + I_real*Rbounce     # lo que ve un ADC single-ended (top vs su tierra lejana)
V_diff = I_real*Rsh                        # lo que ve el shunt diferencial (2 patas)
print("   DEMO numerica (I_real=50A, R_shunt=1mO, R_bounce=18mO):")
print(f"     1 punto (single-ended)  lee {V_top/Rsh:6.0f} A  <- MENTIRA (incluye bounce)")
print(f"     2 puntos (diferencial)  lee {V_diff/Rsh:6.0f} A  <- VERDAD (resta el bounce)")
print(f"     -> el bounce ({Rbounce*1e3:.0f}mO) se cancela porque es COMUN a las 2 patas")

print("\n   Canales del RP2350: GP26/27/28 = ADC0/1/2 (3 libres). Para 5 nodos:")
print("     opcion barata: MUX analogico 74HC4051 (1 ADC -> 8 nodos) o")
print("     opcion limpia: 1 amp de corriente INA181/INA240 en el shunt (rechaza")
print("       el bounce por hardware + amplifica el mV del 1mO -> sin ruido).")

print("\n"+"="*70)
print("RESUMEN: fundir = V_junta>=0.55V (Holm). Hoy llegamos a ~0.3V (ablando).")
print("Subir V_junta = mas corriente (MOSFETs en paralelo + stickout corto) Y/O")
print("contacto mas chico (R_junta mayor). El sensado multipunto MIDE V_junta")
print("directo -> sabras en vivo cuando cruzas los 0.55V y suelta la gota.")
print("="*70)
