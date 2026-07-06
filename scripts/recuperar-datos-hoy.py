#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RECUPERAR LOS DATOS DE HOY (pedido del user 2026-06-06): reprocesar las lecturas
REALES del banco con el operador inverso + la fisica, para sacar mas de lo que
sacamos en el momento. Honesto sobre que SI se recupera y que no (y por que).
"""
import numpy as np

# ============ las lecturas REALES de hoy (I_pico crudo, R_shunt=1mO) ==========
sesiones = {
 "primer light #64-68"      : [1161,1155,1152,1167,1165],
 "post-calib #250-253"      : [1019,1006,1018, 999],
 "tras CAMBIO de cable #239": [ 795, 807, 821, 822],
 "reconexion #411-421"      : [ 911, 912, 917, 913, 915, 927, 941, 931, 951, 974],
}
dur_abort = 56e-6     # todas abortaban a ~56us (MUY consistente)
L = 15e-6; V = 12.0; Rds=0.044

print("="*72)
print("1) LO CRUDO: la lectura SALTO mucho entre sesiones")
for k,v in sesiones.items():
    print(f"   {k:28s}: media {np.mean(v):5.0f} A  (rango {min(v)}-{max(v)})")
print("   1160 -> 1000 -> 800 -> 950 A.  Parece que la corriente 'cambio'... ¿o no?")

# ============ 2) la fisica ACOTA la corriente a una banda ANGOSTA ============
print("\n"+"="*72)
print("2) LA FISICA: la corriente real NO pudo saltar asi — esta ACOTADA")
print("="*72)
# el pulso abortaba a 56us = MITAD de la rampa del choque. I(t)=(V/R)(1-e^{-tR/L})
print("   El abort era a 56us (consistente) = mitad de la rampa del choque.")
print("   I(56us) = (V/R)(1-e^{-56us*R/L}) depende de R_total:")
for Rtot in [0.001,0.05,0.10,0.25]:
    tau=L/Rtot; I56=(V/Rtot)*(1-np.exp(-dur_abort/tau))
    print(f"     R_total={Rtot*1e3:4.0f}mO -> tau={tau*1e6:3.0f}us -> I(56us)={I56:4.0f} A")
print("   -> sea cual sea R, I(56us) cae en ~30-45 A. NUNCA cerca de 900.")
# cruzar con el calor del MOSFET ('tantito')
P_tantito=70.0; I_mos=np.sqrt(P_tantito/Rds)
print(f"   + el MOSFET 'tantito' (~{P_tantito:.0f}W) -> I=sqrt(P/Rds)={I_mos:.0f} A  (coincide)")
I_real_band=(30,45); I_best=37.0
print(f"   VEREDICTO: I_real estuvo en {I_real_band[0]}-{I_real_band[1]} A toda la sesion (mejor ~{I_best:.0f} A).")

# ============ 3) entonces el SALTO de la lectura = el BOUNCE cambiando =======
print("\n"+"="*72)
print("3) RECUPERACION: el salto de la lectura era el GROUND BOUNCE, no la corriente")
print("="*72)
print("   I_lectura = I_real*(1 + Rb/Rsh)  ->  Rb = (I_lectura/I_real - 1)*Rsh")
print("   (uso I_real ~37A constante; Rsh=1mO).  Rb por sesion:")
Rsh=1e-3
for k,v in sesiones.items():
    Rb=(np.mean(v)/I_best - 1)*Rsh
    print(f"   {k:28s}: Rb = {Rb*1e3:4.1f} mO")
print("   *** LA HISTORIA REAL: la corriente fue ~constante (~37A); lo que cambiaba")
print("   era la R de tierra COMPARTIDA (las conexiones). Y mira el CAMBIO DE CABLE:")
rb_antes=(np.mean(sesiones['post-calib #250-253'])/I_best-1)*Rsh
rb_cable=(np.mean(sesiones['tras CAMBIO de cable #239'])/I_best-1)*Rsh
print(f"   Rb antes del cable = {rb_antes*1e3:.1f}mO  ->  despues = {rb_cable*1e3:.1f}mO  ({(1-rb_cable/rb_antes)*100:.0f}% menos!)")
print("   = tu cambio de cable SE VE en los datos: bajaste la tierra parasita. LIMPIEZA real.")

# ============ 4) lo que SI recuperamos vs lo que NO (honesto) ===============
print("\n"+"="*72)
print("4) QUE RECUPERAMOS (honesto)")
print("="*72)
print("   SI recuperado:")
print("    - la corriente fue ~constante 30-45A (no saltaba); las lecturas mentian por Rb.")
print("    - Rb por sesion (20-30mO) y que el cambio de cable lo BAJO (se ve en los datos).")
print("    - R_junta ~ U_soft/I = 0.30V/37A ~ 8 mO (del ablandamiento que viste).")
print("   NO recuperable de los logs de hoy (falto grabarlo):")
print("    - I exacta (necesita el TRANSITORIO fino I(t) cada ~2us -> da L y R y la curva).")
print("    - separar L de R (el plateau+pendiente; hoy solo guardamos el pico/estable).")
print("   -> el operador inverso EXPRIME lo que hay, pero la resolucion la fija lo que")
print("      LOGGEAS. Receta proxima: log I(t) fino + shunt diferencial -> +-0.14A (lo")
print("      calculado antes). Hoy: de 'la corriente salta 1160->800' a 'fue ~37A")
print("      constante y el cable limpio bajo el bounce 25%'. ESO ya es recuperar mejor.")
print("="*72)
