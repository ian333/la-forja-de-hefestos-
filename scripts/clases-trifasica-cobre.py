#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CLASES CON NUMEROS (pedido del user 2026-06-07):
 1) 3 cables y n cables: el truco de las FASES = potencia constante (identidad)
 2) cobre / aluminio / acero: valores EXACTOS + por que el cobre es el villano
 3) calibres AWG exactos (d, area, R/m)
 4) voltaje/corriente para fundir cobre (es problema de CORRIENTE, no voltaje)
 5) el truco de 2-3 FRECUENCIAS para el CALENTAMIENTO (skin effect)
Solo numeros. Todo verificable.
"""
import numpy as np
PI = np.pi; MU0 = 4*PI*1e-7

# ============================================================ MATERIALES (exactos)
MAT = {
 # nombre        rho_e[Ohm·m] alpha[/K]  k[W/mK]  Tm[C]  dens   cp     Hf[J/kg]
 'Acero E71T':  (1.40e-7,    0.0050,    45.,    1500., 7850., 600.,  270e3),
 'Cobre':       (1.68e-8,    0.00393,   401.,   1085., 8960., 385.,  209e3),
 'Aluminio':    (2.65e-8,    0.0039,    237.,    660., 2700., 900.,  397e3),
}
def E_kg(m):
    rho_e,al,k,Tm,d,cp,Hf = MAT[m]
    return cp*(Tm-25)+Hf

print("="*74)
print(" CLASE 1 — 3 CABLES y n CABLES: el truco de las FASES (potencia constante)")
print("="*74)
t = np.linspace(0, 1, 20000)            # un periodo
for n in [1,2,3,6]:
    # n fases desfasadas 2pi/n, potencia instantanea = suma de cuadrados
    P = sum(np.cos(2*PI*t - 2*PI*k/n)**2 for k in range(n))
    rizo = (P.max()-P.min())/P.mean()*100
    print(f"  n={n} fase(s): P_inst = {P.mean():.3f} ± rizo {rizo:5.1f}%  "
          f"(min {P.min():.3f}  max {P.max():.3f})")
print("  IDENTIDAD:  Σ cos²(ωt − 2πk/n) = n/2  (constante para n≥2)")
print("  -> 1 fase: el calor PULSA 0↔2P a 2ω (la gota se enfria entre medios ciclos).")
print("     3 fases (120°): calor PLANO, rizo 0% -> gota liquida ESTABLE. Esto es")
print("     lo que el cobre necesita (k alta = se enfria rapido, no perdona rizo).")
print("  Mismo truco que el circulo: 2 ondas en cuadratura -> cos²+sin²=1 = plano.")

print("\n"+"="*74)
print(" CLASE 2 — COBRE vs ALUMINIO vs ACERO (valores exactos + el villano)")
print("="*74)
print(f"  {'material':<12}{'rho_e[nΩm]':>11}{'k[W/mK]':>9}{'Tm[C]':>7}{'E_fus[MJ/kg]':>13}{'k/rho_e':>11}")
for m in MAT:
    rho_e,al,k,Tm,d,cp,Hf = MAT[m]
    print(f"  {m:<12}{rho_e*1e9:>11.1f}{k:>9.0f}{Tm:>7.0f}{E_kg(m)/1e6:>13.3f}{k/rho_e:>11.2e}")
print("  E_fus(cobre)=0.62 MJ/kg < acero 1.17 -> fundir cobre cuesta MENOS energia/kg.")
print("  PERO k/rho_e (dificultad) cobre 2.4e10 vs acero 3.2e8 = 75× PEOR:")
print("     k alta = pierde calor 9× mas rapido  +  rho_e baja = NO se auto-calienta.")
print("  El cobre no es duro de FUNDIR, es duro de MANTENER caliente. Por eso necesita")
print("  POTENCIA alta y CONSTANTE (la trifasica) y/o calentar la PIEL (frecuencia).")

print("\n"+"="*74)
print(" CLASE 3 — CALIBRES AWG exactos (d, area, R por metro)")
print("="*74)
def awg_d_mm(n): return 0.127*92**((36-n)/39)
print(f"  {'AWG':>4}{'d[mm]':>8}{'area[mm²]':>10}{'R/m Cu[Ω]':>11}{'R/m Al[Ω]':>11}")
for awg in [12,14,16,18,20,22,24]:
    d = awg_d_mm(awg)/1e3; A = PI/4*d*d
    Rcu = MAT['Cobre'][0]/A; Ral = MAT['Aluminio'][0]/A
    print(f"  {awg:>4}{d*1e3:>8.3f}{A*1e6:>10.4f}{Rcu:>11.4f}{Ral:>11.4f}")
print("  El alambre de deposicion ~0.8mm = AWG 20. R de cobre RIDICULAMENTE baja")
print("  (33 mΩ/m) -> en 1mm de junta son ~33 µΩ. Por eso P=I²R pide I enorme.")

print("\n"+"="*74)
print(" CLASE 4 — VOLTAJE / CORRIENTE para fundir cobre (es problema de CORRIENTE)")
print("="*74)
Lth = 1e-3   # longitud termica de la junta
for m in ['Acero E71T','Cobre','Aluminio']:
    rho_e,al,k,Tm,dens,cp,Hf = MAT[m]
    d = awg_d_mm(20)/1e3; A = PI/4*d*d
    Pmelt = k*A*(Tm-25)/Lth                     # potencia para sostener liquido (conduccion)
    rho_hot = rho_e*(1+al*(Tm-25))              # resistividad a Tm (lineal)
    Rj = rho_hot*Lth/A                          # R de la junta caliente
    I = np.sqrt(Pmelt/Rj)                       # corriente para esa potencia
    Vj = I*Rj                                   # caida en la junta
    print(f"  {m:<12} P_sostén={Pmelt:6.1f} W | R_junta={Rj*1e6:7.1f} µΩ | "
          f"I={I:6.0f} A | V_junta={Vj:.3f} V")
print("  COBRE: ~220 W, ~1100 A, pero solo ~0.19 V EN LA JUNTA (R chica).")
print("  -> el voltaje de la junta es minusculo; el VOLTAJE de fuente sirve para")
print("     (a) vencer la R del lazo (cables+contacto) y (b) empujar di/dt=V/L rapido.")
print("  -> 1100 A es brutal para 1 cable. AQUI entra la TRIFASICA:")
I3 = 1100/np.sqrt(3) if True else 0
print(f"     3 fases reparten -> {1100/3:.0f} A/cable (suma) o {1100/np.sqrt(3):.0f} A_linea,")
print("     ademas con calor CONSTANTE (clase 1). Cobre = corriente repartida + sin rizo.")

print("\n"+"="*74)
print(" CLASE 5 — el TRUCO de 2-3 FRECUENCIAS para el CALOR (skin effect)")
print("="*74)
print("  La frecuencia decide DONDE entra el calor: profundidad de piel")
print("     δ = √(ρ_e / (π·f·μ0))   (cobre, μr=1)")
rho_cu = MAT['Cobre'][0]
print(f"  {'f':>9}{'δ cobre':>11}   ¿que calienta? (radio alambre AWG20 = 0.41mm)")
for f in [60, 1e3, 1e4, 1e5, 1e6, 1e7]:
    d_skin = np.sqrt(rho_cu/(PI*f*MU0))
    r = awg_d_mm(20)/2/1e3
    que = "TODO el alambre (cuerpo)" if d_skin>r else "solo la PIEL (la junta/punta)"
    fl = f"{f/1e3:.0f} kHz" if f>=1e3 else f"{f:.0f} Hz"
    print(f"  {fl:>9}{d_skin*1e3:>9.3f}mm   {que}")
print("  -> EL TRUCO (la respuesta del calentamiento TAMBIEN esta en las frecuencias):")
print("     f_baja  (~1 kHz, δ>r): calienta el CUERPO -> precalienta, vence la k alta")
print("     f_alta  (~100kHz-1MHz, δ<r): calienta la PIEL -> funde SOLO la junta, barato")
print("     f_reson (~kHz Rayleigh): suelta la GOTA (modo l=2)")
print("  i(t)=I1·sin(2πf1 t)+I2·sin(2πf2 t)+I3·sin(2πf3 t) -> 3 trabajos en UN cable:")
print("     precalentar / fundir-la-punta / soltar.  Mismo Operador 𝔄 que la gota:")
print("     antes la frecuencia diagonalizaba la FORMA (modos Y_lm); aqui diagonaliza")
print("     la PENETRACION del calor (eigenmodos de difusion). La frecuencia = la cara-i.")

print("\n"+"="*74)
print(" SEGURIDAD (regla dura)")
print("="*74)
print("  Queremos la TOPOLOGIA trifasica (calor plano) a BAJO VOLTAJE generada por")
print("  NUESTRO inversor desde DC ~48V — NO enchufarse a la red trifasica 220/380V")
print("  (MORTAL). El truco de las fases funciona igual a 48V que a 380V: es el")
print("  DESFASE lo que da el calor constante, no el voltaje. 3 fases bajas + opto.")
print("="*74)
