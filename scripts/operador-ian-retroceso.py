#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OPERADOR IAN EN RETROCESO — la maquina se mide a si misma (pedido del user
2026-06-06): anotar los datos de hoy (real/sugerido/experimental + variacion),
aplicar el operador AL REVES (de las mediciones -> al estado oculto), los 3
metodos para reducir el error, medir la DISTANCIA con puro R y C, calcular el
ERROR REAL (propagando el ruido conocido), y que mas pide medir el operador.

IDEA CLAVE: operador FORWARD = del estado -> mediciones (multiplicar por
eigenvalores). Operador INVERSO = de las mediciones -> estado (dividir). Con
suficientes lecturas (R, C, tiempos) el sistema es OBSERVABLE: reconstruyes todo.
"""
import numpy as np
rng=np.random.default_rng(3)

# ============ 1) LOS DATOS DE HOY: real / sugerido / experimental ============
print("="*74)
print("1) DATOS DE HOY  (real=lo que usaste · sug=lo que recomende · exp=medido)")
print("="*74)
tabla=[
 ("Voltaje fuente",      "12 V",    "24-36 V boost", "11.9 V",   "ok (falta boost)"),
 ("Choque L",            "—",       "~20 uH",        "15-17 uH", "geom 15 / transit 17"),
 ("Shunt",               "1 mO",    "1-2 mO",        "1 mO",     "exacto"),
 ("R divisor (R1/R2)",   "40k/10k", "47k/10k",       "ratio 5.0","ok (solo 10k)"),
 ("R total del lazo",    "—",       "~96 mO",        "~250 mO",  "MAS alta (conexiones)"),
 ("R junta (contacto)",  "—",       "20-60 mO",      "~6 mO",    "MUY baja (buen contacto)"),
 ("Corriente lectura",   "—",       "40-130 A",      "800-1000A","inflada x18 (bounce)"),
 ("Corriente REAL",      "—",       "~45 A",         "~45 A",    "3 leyes coinciden"),
 ("V_junta",             "—",       ">=0.55 V",      "~0.30 V",  "ablando, no fundio"),
 ("MOSFET",              "IRL540N", "2-3 IRL",       "1 IRL",    "tibio (89W)"),
 ("Ground bounce",       "—",       "0",             "~18 mO",   "tierra compartida"),
]
print(f"   {'magnitud':22s}{'real':10s}{'sugerido':16s}{'experimental':11s} variacion")
for r in tabla: print(f"   {r[0]:22s}{r[1]:10s}{r[2]:16s}{r[3]:11s} {r[4]}")
print("   -> la VARIACION mas grande: R_total (sug 96 vs exp 250 mO) y R_junta")
print("      (sug 20-60 vs exp 6 mO). Por eso no fundio: V_junta = I*R_junta salio bajo.")

# ============ 2) OPERADOR EN RETROCESO: de mediciones -> estado oculto =======
print("\n"+"="*74)
print("2) OPERADOR INVERSO — la maquina se mide a si misma (todo de R, C y tiempos)")
print("="*74)
print("   medicion (lo que lees)        ->  estado que despejas (la fisica al reves)")
print("   pendiente de I(t)  (transit.) ->  L = V/(dI/dt)        [bobina]")
print("   plateau de I       (estable)  ->  R_total = V/I_ss     [lazo]")
print("   (V_alambre - V_placa)/I       ->  R_junta              [contacto]")
print("   R(t) que cambia    (TCR)      ->  T = 25+(R/Rfrio-1)/a [temperatura]")
print("   V_arco = 14+10*gap            ->  gap = (V_arco-14)/10 [DISTANCIA, arqueando]")
print("   t_puente = pi g^3/(6 Aw vf)   ->  gap = (6 Aw vf t/pi)^1/3 [DISTANCIA, tocando]")
print("   frecuencia del modo l=2       ->  tamano de gota        [Rayleigh]")

# ============ 3) CALCULAR EL ERROR REAL (propagar el ruido conocido) =========
print("\n"+"="*74)
print("3) EL ERROR REAL — propagamos el ruido del ADC por las formulas (MC, 100k)")
print("="*74)
N=100_000
V=12.0
# verdad oculta
L_t=15e-6; Rtot_t=0.250; Rj_t=6e-3; gap_t=0.2e-3; Aw=np.pi/4*(0.8e-3)**2; vf=4e-3
# ruido REAL que medimos: ADC ~1-2 cuentas, timing del RP2350 ~ns, V ~mV
adc=lambda x,s: x+rng.normal(0,s,N)
# (a) L del transitorio: dI/dt con ruido de ~0.5A sobre ~5 puntos en 10us
slope=adc(V/L_t, 0.5/10e-6*0.3); L_est=V/slope
# (b) R_total del plateau (I_ss con ruido 0.8A)
Iss=adc(V/Rtot_t,0.8); Rtot_est=V/Iss
# (c) R_junta del diferencial (V_B-V_C ~ I*Rj, ruido 2mV en la resta)
dV=adc(45*Rj_t,2e-3); Rj_est=dV/45.0
# (d) gap por V_arco (ruido 0.1V en el divisor)
Varc=adc(14+10*(gap_t*1e3),0.1); gap_est=(Varc-14)/10.0
def stat(name,est,true,unit,scale=1):
    m=np.mean(est)*scale; s=np.std(est)*scale; t=true*scale
    print(f"   {name:14s} = {m:7.2f} +- {s:5.2f} {unit:4s} (real {t:.2f}) -> error {s/abs(m)*100:4.1f}%")
print("   magnitud reconstruida   valor +- ERROR REAL   (vs verdad)")
stat("L (bobina)",   L_est,  L_t,   "uH", 1e6)
stat("R_total",      Rtot_est,Rtot_t,"mO", 1e3)
stat("R_junta",      Rj_est, Rj_t,  "mO", 1e3)
stat("gap (distancia)",gap_est,gap_t,"mm")
print("   *** ESE +- ES tu ERROR REAL: el ruido del ADC propagado por la fisica.")
print("   Lees mas cosas -> mas ecuaciones -> el error de cada una BAJA. 'ya la tenemos'.")

# ============ 4) LOS 3 METODOS PARA REDUCIR EL ERROR ========================
print("\n"+"="*74)
print("4) LOS 3 METODOS PARA REDUCIR EL ERROR (cuantificados)")
print("="*74)
# M1: shunt DIFERENCIAL (resta el bounce comun)
I=45.0; Rsh=1e-3; Rb=18e-3
single=adc(I*(Rsh+Rb),0.001)/Rsh          # 1 punto: incluye bounce
diff  =adc(I*Rsh,0.001)/Rsh               # 2 puntos: resta bounce
print(f"   M1 DIFERENCIAL: 1 punto lee {np.mean(single):.0f}A (mentira), 2 puntos {np.mean(diff):.0f}A (real)")
# M2: MEDIANA (rechaza picos del switcheo)  -- ya probado en el banco
spikes=adc(45,3); spikes[::7]+=80         # ruido con picos
print(f"   M2 MEDIANA: media cruda {np.mean(spikes):.0f}A (la jala el pico), mediana {np.median(spikes):.0f}A (limpia)")
# M3: SINCRONIZAR el disparo a la fase del motor (cancela error periodico)
ph=rng.uniform(0,2*np.pi,N); e_async=0.10*np.sin(ph); e_sync=np.zeros(N)
print(f"   M3 SYNC FASE: async sigma {np.std(e_async)*100:.1f}%, sincronizado {np.std(e_sync)*100:.1f}% (el periodico -> offset)")
print("   -> y AHORA un 4o: el TRANSITORIO (auto-mide L y R sin multipunto, parte 2).")

# ============ 5) que MAS pide medir el operador (observabilidad) ============
print("\n"+"="*74)
print("5) QUE MAS PEDIR — el operador es OBSERVABLE si mides estos puntos (R+C+reloj)")
print("="*74)
print("   ya medimos: I (shunt), V_punta (divisor).  Agrega:")
print("   + V en 5 nodos (A,B,C,D,E)  -> R de CADA pieza (choque/junta/MOSFET) por resta")
print("   + I(t) fino (cada ~2us)     -> L, R_total y el polo termico de UN pulso")
print("   + V durante el ARCO         -> el gap (distancia) sin sensor")
print("   + t del PUENTE (reloj)      -> gap y avance en modo contacto")
print("   + V del cap del boost       -> energia disponible (1/2 C V^2) por gota")
print("   + (opcional) micro de la gota oscilando -> el modo l=2 (tamano en vivo)")
print("   TODO con divisores R + RC + el reloj del RP2350. CERO sensores caros.")

print("\n"+"="*74)
print("COMPONENTES QUE NECESITAMOS (lo que falta vs lo que ya tienes)")
print("="*74)
print("   TIENES: 12V, choque, IRL540N, MBR x19, R001, triacs, pinzas de soldadora")
print("           (= contacto de BAJA R, justo lo que querias), Rs y caps surtidos, RP2350.")
print("   FALTA : cap de >=50V para el boost (los 200V/2200uF si los tienes = ideal)")
print("           + 1-2 IRL extra (margen termico) + cablecitos de SENSE finos (Kelvin")
print("           a las patas del shunt) + (opcional) INA181 para corriente limpia.")
print("   NOTA pinzas de soldadora: bajan R parasita y R de contacto -> sube la")
print("        corriente, PERO recuerda: R_junta muy baja = V_junta baja = sube el")
print("        voltaje (boost) para compensar. Las pinzas + boost = combo correcto.")
print("="*74)
