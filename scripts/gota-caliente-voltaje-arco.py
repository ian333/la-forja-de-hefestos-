#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GOTA CALIENTE — los regimenes que FALTABAN (critica correcta del user, 2026-06-06):
el modelo de Holm solo vale TOCANDO; pero "la gota no siempre tiene que estar
tocando" y "siempre tiene que estar caliente para controlarla". Aqui se agregan:
  (A) regimen CONTACTO (gap=0): Holm, funde si V_junta>=0.55V.
  (B) regimen GAP/ARCO (sin tocar): un arco sostiene calor SOLO si el voltaje
      alcanza para el arco (~14-20V) -> a 12V IMPOSIBLE, a 24V+ SI.
  (C) BALANCE TERMICO de la gota colgante: pierde calor por conduccion arriba del
      alambre (+radiacion) -> hay que reponer ~W para que NO se solidifique.
  (D) el VOLTAJE como palanca maestra (sube V_junta Y enciende el arco).
  (E) la pregunta del user: mas cable / doble bobina?
"""
import numpy as np

# ---- fisica del contacto (Holm) y del acero ----
L_WF=2.44e-8; T0=300.0; Tm=1811.0
U_melt=np.sqrt(4*L_WF*(Tm**2-T0**2))           # ~0.56 V (funde tocando)
k_st=45.0; rho=7850.0; cp=600.0; Hf=270e3; eps=0.4; sigma=5.67e-8
d_w=0.8e-3; A_w=np.pi/4*d_w**2

# ---- lazo electrico real (de hoy) ----
Rds=0.044; Rchoke=0.020; Rcable=0.010; rho_st=1.5e-7
def R_wire(stick_cm): return rho_st*(stick_cm*1e-2)/A_w
Rj=0.006                                        # R_junta inferida hoy (~6mO, contacto bueno)

print("="*70)
print("(A) CONTACTO: cuanto VOLTAJE de fuente para que V_junta llegue a 0.55V")
print("="*70)
print(f"   U_melt (Holm, acero) = {U_melt:.2f} V a traves de la junta")
print("   Vsrc | I [A] | V_junta | funde?   (1 MOSFET, stickout 3cm, R_junta=6mO)")
Rrest=Rds+Rchoke+Rcable+R_wire(3.0)
for Vs in [12,24,36,48]:
    I=Vs/(Rrest+Rj); Vj=I*Rj
    print(f"   {Vs:3d}V | {I:5.0f} | {Vj:5.2f}V  | {'SI' if Vj>=U_melt else 'no'}")
Vneed=U_melt*(Rrest+Rj)/Rj
print(f"   -> con SOLO subir voltaje (mismo 1 IRL): funde desde ~{Vneed:.0f}V")

print("\n"+"="*70)
print("(B) GAP/ARCO: sin tocar, el arco solo VIVE si el voltaje alcanza")
print("="*70)
# arco corto: V_arco ~= caida catodo+anodo (~14V) + gradiente (~10 V/mm)*gap
Vcd=14.0; grad=10.0   # V/mm
print("   un arco corto pide  V_arco ~= 14V + 10V/mm * gap")
print("   gap   | V_arco | sostiene a 12V? | a 24V? | a 36V?")
for gap in [0.05,0.1,0.3,0.5]:
    Varc=Vcd+grad*gap
    s12 = "si" if 12>=Varc else "NO"
    s24 = "si" if 24>=Varc else "NO"
    s36 = "si" if 36>=Varc else "NO"
    print(f"   {gap:.2f}mm| {Varc:5.1f}V |      {s12:3s}        |  {s24:3s}  |  {s36:3s}")
print("   -> a 12V el arco NO se sostiene (por eso la chispa era solo el flash")
print("      de la patada del choque ~18mJ). A 24V+ el arco VIVE = calor continuo.")

print("\n"+"="*70)
print("(C) BALANCE TERMICO de la gota COLGANTE: cuanto W para NO solidificar")
print("="*70)
# perdida por conduccion arriba del alambre (la grande) + radiacion de la gota
dx=4e-3                                          # zona de gradiente termico (mm)
P_cond=k_st*A_w*(Tm-T0)/dx
a_drop=0.4e-3; A_drop=4*np.pi*(a_drop/2)**2
P_rad=eps*sigma*A_drop*(Tm**4-T0**4)
P_keep=P_cond+P_rad
print(f"   conduccion arriba del alambre  ~ {P_cond:5.1f} W   (la dominante)")
print(f"   radiacion de la gota (0.4mm)   ~ {P_rad:5.2f} W")
print(f"   -> para MANTENERLA liquida hay que reponer ~ {P_keep:.0f} W CONTINUOS")
print("   En contacto (0.55V x ~100A = 55W) sobra. En arco (14V x pocos A) tambien.")
print("   SIN tocar y SIN arco (12V): 0 W -> se solidifica en cuanto levantas. <-- el problema de hoy")

# tiempo que aguanta liquida una gota DESPRENDIDA en vuelo (solo radiacion)
m=rho*(4/3)*np.pi*(a_drop/2)**3
E_freeze=m*Hf                                    # energia hasta empezar a solidificar
t_flight_ok=E_freeze/P_rad
print(f"\n   Gota DESPRENDIDA en vuelo: masa {m*1e6:.2f} mg, pierde {P_rad:.2f}W por radiacion")
print(f"   -> aguanta liquida ~{t_flight_ok*1e3:.0f} ms en el aire (vuelo es ~ms) = LLEGA liquida OK")
print("   => el problema NO es el vuelo; es mantenerla liquida MIENTRAS cuelga (conduccion).")

print("\n"+"="*70)
print("(D) VEREDICTO + (E) mas cable / doble bobina?")
print("="*70)
print(f"""   PALANCA MAESTRA = SUBIR EL VOLTAJE:
     - sube V_junta (divisor) -> funde tocando desde ~{Vneed:.0f}V con 1 IRL
     - enciende el ARCO (>~14V) -> mantiene la gota caliente SIN tocar = CONTROLABLE
     -> resuelve los DOS problemas de un jalon (tu intuicion correcta).

   DOBLE BOBINA / mas inductancia:
     + mas energia de arco por ruptura (1/2 L I^2) -> chispa mas gorda al cortar
     + suaviza la corriente
     - PERO frena el di/dt y NO sube la potencia media -> NO es la palanca real.
     => util de apoyo para el latigazo, no para fundir. El voltaje manda.

   MAS CABLE (de potencia): solo si es GORDO/CORTO para bajar R parasita.
     cable largo/flaco = mas R parasita = roba mas de los 12V (lo contrario).

   CUIDADO al subir voltaje (limites de tus piezas):
     - caps de 1000uF/25V -> a 24V van justos; consigue de 35-50V.
     - IRL540N = 100V Vds -> OK hasta ~50-60V de fuente (con margen del flyback).
     - MBR360G = 60V -> OK hasta ~50V.
     - la potencia escala con V^2 -> a 24V la corriente ~2x, vigila el MOSFET.
   Sugerencia: salta a ~24-36V con caps de 50V + (2 IRL por margen termico).""")
print("="*70)
