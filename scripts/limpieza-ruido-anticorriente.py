#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LIMPIEZA DEL RUIDO + CORRIENTE ANTIPARASITA (idea del user 2026-06-06:
"reducir ruido, meter corriente antiparasita que limpie, calcular la corriente
parasita, hacer el inverso").

INSIGHT CLAVE (lo que el user intuyo): hay DOS tipos de 'sucio' y se atacan
distinto:
  - PARASITA DETERMINISTA (ground bounce = I*R_b): NO es ruido, es una SENAL
    correlacionada -> se CALCULA y se RESTA (el inverso). << su idea exacta
  - RUIDO ALEATORIO (ADC, termico): no se puede restar -> se PROMEDIA (/sqrt(N)).
  - ACOPLE de conmutacion (transitorio rapido): se CANCELA (anti-fase) o se SALTA.
"""
import numpy as np
rng=np.random.default_rng(11)
N=200_000

# ---- las cosas reales ----
I_real=45.0; Rsh=1e-3                 # senal verdadera = 45mV
Rb=18e-3                              # ground bounce (correlacionado con I)
sig = I_real*Rsh                      # 45 mV  (lo que QUEREMOS)
Vb  = I_real*Rb                       # 810 mV (la parasita determinista)
coupling = rng.normal(0,0.20,N)      # +-200mV picos de conmutacion (semi-aleatorio)
adc_noise= rng.normal(0,1.6e-3,N)    # +-1.6mV (2 cuentas)

def err_A(resid_mV_std):             # error equivalente en AMPERES
    return resid_mV_std/Rsh

print("="*72)
print("LA SENAL que buscamos: I_real*Rsh = 45 mV. Lo que la ensucia:")
print(f"   ground bounce  = I*Rb = {Vb*1e3:.0f} mV  (18x la senal!) <- DETERMINISTA")
print(f"   acople conmut. = +-{0.20*1e3:.0f} mV          <- semi-aleatorio")
print(f"   ruido ADC      = +-{1.6:.1f} mV          <- aleatorio")
print("="*72)

# ---------- 0) CRUDO single-ended: ve TODO ----------
raw = sig + Vb + coupling + adc_noise
print(f"\n0) CRUDO (1 punto):     lee {np.mean(raw)/Rsh:6.0f} A  (real 45) -> MENTIRA por el bounce")

# ---------- 1) DIFERENCIAL: el bounce es COMUN a las 2 patas -> se cancela ----------
# ambas patas ven el bounce + ~90% del acople (comun); la resta los quita
common = Vb + 0.9*coupling
padA = sig + common + rng.normal(0,1.6e-3,N)
padB =       common + rng.normal(0,1.6e-3,N)
diff = padA - padB
print(f"1) DIFERENCIAL (2 patas):lee {np.mean(diff)/Rsh:6.1f} A +-{np.std(diff)/Rsh:4.1f}A -> mata el bounce comun")

# ---------- 2) TU IDEA: calcular la parasita y RESTARLA (el inverso) ----------
# el bounce es DETERMINISTA: V_b = I*Rb. Calibras Rb UNA vez, luego restas I_est*Rb.
Rb_cal = Rb*(1+rng.normal(0,0.02))           # calibrado +-2%
I_est  = (raw)/ (Rsh+Rb)                       # primera estimacion
clean2 = raw - I_est*Rb_cal                    # resta la parasita calculada
print(f"2) CALCULAR+RESTAR (tu inverso): lee {np.mean(clean2)/Rsh:6.1f} A +-{np.std(clean2)/Rsh:4.1f}A")
print("   -> el bounce NO es ruido, es senal correlacionada: se DESPEJA y se resta.")

# ---------- 3) CANAL DE REFERENCIA (sensor 'mudo' que solo ve la parasita) ----------
# un cable de sense que NO carga corriente ve solo bounce+acople -> lo restas
ref = Vb + coupling + rng.normal(0,1.6e-3,N)   # mismo parasito, sin senal
clean3 = raw - ref
print(f"3) CANAL REFERENCIA (mudo): lee {np.mean(clean3)/Rsh:6.1f} A +-{np.std(clean3)/Rsh:4.1f}A -> resta el parasito MEDIDO")

# ---------- 4) CORRIENTE ANTIPARASITA (inyeccion anti-fase, hardware) ----------
# un cap desde un nodo en ANTI-FASE inyecta un pico opuesto -> cancela el acople.
# (feedforward; sintonizable. Aqui ~85% de cancelacion del acople)
anti = -0.85*coupling
clean4 = sig + Vb + (coupling+anti) + adc_noise
# (todavia trae el bounce; combinar con el diferencial)
print(f"4) ANTI-FASE (tu 'corriente que limpia'): cancela ~85% del acople de conmutacion")
print(f"   acople solo: antes +-{np.std(coupling)*1e3:.0f}mV -> despues +-{np.std(coupling+anti)*1e3:.0f}mV")

# ---------- 5) LOCK-IN / promedio sincronico (el 𝔄: pesca la senal del ruido) ----------
# promedias M pulsos EN FASE -> lo aleatorio cae /sqrt(M), la senal coherente queda
for M in [1,16,256]:
    noise_avg = np.std(coupling+adc_noise)/np.sqrt(M)
    print(f"5) PROMEDIO SINCRONICO x{M:3d}: ruido residual +-{noise_avg*1e3:5.2f}mV = +-{err_A(noise_avg):5.1f}A")

# ---------- 6) COMBINADO: diferencial + calcular-restar + promedio ----------
combo_noise = (np.std(diff - I_est*0)/Rsh)    # diferencial ya quito bounce
# diferencial (mata bounce) + promedio x256 (mata aleatorio)
final = np.std(diff)/np.sqrt(256)/Rsh
print(f"\n6) COMBINADO (diferencial + promedio x256): error final +- {final:.2f} A")
print(f"   de {abs(np.mean(raw)/Rsh-45):.0f}A de mentira (crudo) a +-{final:.2f}A (limpio) = {(abs(np.mean(raw)/Rsh-45)/max(final,0.01)):.0f}x mejor")

print("\n"+"="*72)
print("RESUMEN — 2 tipos de sucio, 2 estrategias (lo que intuiste):")
print("  PARASITA DETERMINISTA (bounce=I*Rb): se CALCULA y se RESTA (tu 'inverso').")
print("     -> diferencial (resta comun) o canal mudo o calcular Rb y restar I*Rb.")
print("  RUIDO ALEATORIO (ADC/termico): se PROMEDIA sincronico (/sqrt(N), el 𝔄).")
print("  ACOPLE rapido: 'corriente antiparasita' = inyeccion ANTI-FASE (hardware).")
print("  La parasita NO se pelea: se MIDE y se DESPEJA. Por eso 'ya la tenemos'.")
print("="*72)
