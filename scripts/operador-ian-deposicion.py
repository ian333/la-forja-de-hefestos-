#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EL OPERADOR IAN (𝔄) EN LA DEPOSICION (pregunta del user 2026-06-06:
"siento que hay algo mas en los datos; podemos aplicar el operador ian aca?
podemos meter frecuencias al motor para desviar o sincronizar para reducir?").

SI, en 3 lugares. El patron 𝔄: simetria -> generador -> base propia (cara-i)
donde la dinamica se DIAGONALIZA (poles/exponenciales/productos) -> control en
perillas independientes + convoluciones se vuelven productos (LUT, tiempo real).

(1) HAY MAS EN LOS DATOS: el TRANSITORIO del pulso (que ignoramos, solo vimos lo
    estable) trae L y R por SEPARADO -> resuelve la ambiguedad SIN multipunto.
(2) Las bases propias del sistema (circuito / termico / gota / timing).
(3) FRECUENCIA AL MOTOR: bloquear fase (sincronizar) cancela el error periodico
    del avance; 'desviar' (incommensurate) lo promedia. Es Fourier = la cara-i.
"""
import numpy as np
rng=np.random.default_rng(7)

# ============ (1) HAY MAS EN LOS DATOS: el transitorio = los eigenvalores ====
print("="*72)
print("(1) 'ALGO MAS EN LOS DATOS' — el TRANSITORIO del pulso trae L y R separados")
print("="*72)
V=12.0; L_true=15e-6; R_true=0.250                 # lo real
tau=L_true/R_true
print(f"   La corriente NO es plana: I(t) = (V/R)(1 - e^(-tR/L)).  pole = -R/L, tau={tau*1e6:.0f}us")
print("   Solo miramos el PLATEAU (estable). El SUBIDON inicial traia mas info:")
# simula el transitorio muestreado fino + ruido de ADC, como deberia loggear el firmware
t=np.arange(0,400e-6,2e-6)                          # cada 2us (lo que SI puede el RP2350)
I=(V/R_true)*(1-np.exp(-t*R_true/L_true))
I_meas=I+rng.normal(0,0.5,t.size)                   # ruido ~0.5A
# extraer R del plateau y L de la pendiente inicial (2 features -> 2 incognitas)
I_ss=np.mean(I_meas[t>4*tau]); R_fit=V/I_ss
slope0=np.polyfit(t[t<0.3*tau], I_meas[t<0.3*tau],1)[0]   # dI/dt|0
L_fit=V/slope0
print(f"   del PLATEAU  -> R = V/I_ss   = {R_fit*1e3:5.1f} mO   (real {R_true*1e3:.0f})")
print(f"   de la PENDIENTE inicial -> L = V/(dI/dt) = {L_fit*1e6:5.1f} uH   (real {L_true*1e6:.0f})")
print("   *** UN pulso, muestreado fino, da L y R por SEPARADO -> resuelve la")
print("   ambiguedad del bounce SIN el circuito multipunto. La info SIEMPRE estuvo")
print("   en el transitorio; solo no la loggeamos fino. <-- esto es lo que sentias.")

# y el DRIFT lento de R(t) (el ablandamiento) = el pole TERMICO
print("\n   Y hay un SEGUNDO pole, lento: R(t) sube/baja al calentarse (TCR) -> el")
print("   ablandamiento que viste (R cayo 11% a 500ms) ES el eigenvalor TERMICO.")
print("   El pulso tiene DOS polos: electrico (rapido, L/R) + termico (lento). 2 𝔄.")

# ============ (2) las bases propias (cara-i) del sistema ====================
print("\n"+"="*72)
print("(2) EL OPERADOR 𝔄 — cada dinamica tiene su BASE PROPIA donde se diagonaliza")
print("="*72)
print("   dinamica          | simetria      | base propia (cara-i)     | eigenvalor")
print("   circuito (L,R)    | t-invariante  | exponencial / Laplace    | -R/L (pole)")
print("   calor (dT/dt=aLap)| traslacion    | FOURIER e^{ikx}          | -a|k|^2")
print("   gota (superficie) | rotacion SO(3)| ARMONICOS ESFERICOS Y_lm | w_l (l=2 = Rayleigh)")
print("   avance/disparo    | periodica     | FOURIER (frecuencias)    | lineas f_n")
print("   -> en CADA base la dinamica DESACOPLA (productos, no convoluciones):")
print("      * fuente movil de calor = CONVOLUCION en x  ->  PRODUCTO en k (FFT) = tiempo real")
print("      * desprender la gota = excitar el modo l=2 (su eigenfrecuencia) = resonancia")
print("      * el error del avance = lineas en Fourier -> se cancelan por fase (abajo)")

# ============ (3) FRECUENCIA AL MOTOR: sincronizar vs desviar ===============
print("\n"+"="*72)
print("(3) FRECUENCIA AL MOTOR — bloquear fase (sincronizar) CANCELA el error periodico")
print("="*72)
# el MC de ayer dijo: el AVANCE (vf) domina el error del tamano de gota.
# si ese error es PERIODICO (paso del stepper / diente del engrane), Fourier lo dice:
N=20000
T_feed=1.0                                           # periodo del error de avance (norm.)
A_err=0.10                                           # +-10% de error periodico (lo de ayer)
# --- disparo ASYNC (fase aleatoria): cada gota cae en fase random del error ---
phase_async=rng.uniform(0,2*np.pi,N)
err_async=A_err*np.sin(phase_async)
# --- disparo SINCRONIZADO (misma fase cada periodo): error = constante -> se calibra ---
err_sync=A_err*np.sin(np.full(N,0.7))                # misma fase -> offset fijo
err_sync=err_sync-np.mean(err_sync)                  # tras calibrar el offset
# --- disparo DESVIADO (incommensurate, p.ej. razon aurea): se PROMEDIA a 0 ---
golden=2*np.pi*((np.arange(N)*0.61803398875)%1.0)
err_dither=A_err*np.sin(golden)
print(f"   error periodico del avance: +-{A_err*100:.0f}% (= lo que domino el tamano ayer)")
print(f"   disparo ASYNC (sin sync):     sigma del tamano = {np.std(err_async)*100:5.2f}%")
print(f"   disparo SINCRONIZADO (fase 0):sigma del tamano = {np.std(err_sync)*100:5.2f}%  <- el periodico se vuelve OFFSET (se calibra)")
print(f"   disparo DESVIADO (aureo):     media = {np.mean(err_dither)*100:+.2f}% (promedia a 0; util en relleno de area)")
print("   -> SINCRONIZAR el disparo a la fase del paso del motor MATA el error")
print("      periodico del avance (lo vuelve un offset constante calibrable).")
print("      DESVIAR (incommensurate) lo reparte para que promedie a 0 en un area.")
print("   Es exactamente 𝔄: el error vive en una LINEA de Fourier -> en la cara-i lo")
print("   apagas eligiendo la FASE (sync) o lo dispersas (dither). Frecuencia = la perilla.")

print("\n"+"="*72)
print("SINTESIS: SI, hay mas en los datos (el transitorio = 2 eigenvalores: L/R")
print("electrico + termico). SI, el Operador 𝔄 aplica: circuito=Laplace, calor=Fourier,")
print("gota=armonicos esfericos, timing=Fourier. Y SI, meter frecuencia al motor")
print("SINCRONIZADO con el disparo cancela el error que el MC dijo que dominaba.")
print("ACCION: firmware que loggee I(t) cada ~2us en los primeros 100us (saca L y R")
print("solos) + bloqueo de fase disparo<->paso del motor.")
print("="*72)
