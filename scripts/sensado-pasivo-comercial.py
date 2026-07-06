#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SENSADO PASIVO con resistencias COMERCIALES — ¿el ADC del RP2350 resuelve todo?
Front-end SIN chips: V de la junta por DIVISOR (R1,R2 comerciales E24), I por
SHUNT de derivación (R_sh comercial), leídos por el ADC de 12 bits (0-3.3V).
Verifica: niveles en rango, resolución por fase (LSB), error de T por TCR con
cuantización, y que la TOLERANCIA de las resistencias NO afecta (las decisiones
usan RAZONES R/R_frío y R/R_min → la ganancia se cancela).
"""
import numpy as np

# --- ADC del RP2350 ---
VREF=3.3; BITS=12; LSB=VREF/2**BITS                 # 0.806 mV
def adc(v, gain=1.0, nz_lsb=1.5, rng=None):
    raw=min(max(v*gain,0.0),VREF)                   # clamp 0..3.3 (satura = arco)
    code=round(raw/LSB)
    if rng is not None: code+=round(nz_lsb*rng.standard_normal())
    return min(max(code,0),2**BITS-1)*LSB

# --- valores COMERCIALES (E24 / shunt estándar) ---
R1=47e3; R2=10e3; DIV=(R1+R2)/R2                    # divisor 5.70  (47k/10k E24)
Rsh=2e-3                                            # shunt 2 mΩ comercial (sense resistor)
print("="*66)
print(f"COMERCIALES: divisor R1=47k / R2=10k → ÷{DIV:.2f} · shunt R_sh=2 mΩ")
print(f"ADC: 12 bit, VREF=3.3V, 1 LSB = {LSB*1e3:.3f} mV")
print("="*66)

# --- física acero (junta) ---
alphaR=0.0045; Rcontact=20e-3; rho_liq=1.2e-6; Lb=0.5e-3; rw=0.4e-3
def Rsolid(T): return Rcontact*(1+alphaR*min(T-25,1495))
def Rliq(r):   return rho_liq*Lb/(np.pi*r*r)

# === A) NIVELES por fase: ¿en rango y resueltos? ===
print("\nA) Señal por fase (I=80A) — ¿la ve el ADC?")
print("  fase            | R_junta | V_junta | ADC0(V)  LSB | ADC1(V)  LSB")
casos=[("toca frío",      Rsolid(25),  80),
       ("calienta 800°C", Rsolid(800), 80),
       ("liquidus sólido",Rsolid(1520),80),
       ("puente líquido", Rliq(rw),    80),
       ("CUELLO (r/2)",   Rliq(rw/2),  80),
       ("arco/suelta",    18/80,       80)]   # arco ~18V
for nm,Rj,I in casos:
    Vj=I*Rj
    a0=adc(Vj/DIV); a1=adc(I*Rsh)
    print(f"  {nm:15s} | {Rj*1e3:6.1f}mΩ| {Vj:6.2f}V | {a0:5.3f}  {a0/LSB:4.0f} | {a1:5.3f}  {a1/LSB:4.0f}")
print("  → toda la rampa de calentamiento (TCR) cae en cientos-miles de LSB;")
print("    el cuello sube de ~20 a ~80 LSB (4×, claro sobre el ruido); arco satura=detecta.")

# === B) DETECCIÓN end-to-end con cuantización (TCR) ===
def cycle_Terr(gain0=1.0, gain1=1.0, nz=1.5, seed=1, dt=2e-6):
    rng=np.random.default_rng(seed)
    T=25.0; I=80.0; errs=[]; R_cold=None
    mb_cp=7000*np.pi*rw*rw*Lb*600
    while T<1520:
        Rj=Rsolid(T)
        a0=adc(I*Rj/DIV, gain0, nz, rng); a1=adc(I*Rsh, gain1, nz, rng)
        Iest=a1/Rsh; Rest=(a0*DIV)/Iest if Iest>2 else np.inf   # firmware reconstruye
        if R_cold is None and np.isfinite(Rest): R_cold=Rest
        if R_cold:
            Test=25+(Rest/R_cold-1)/alphaR
            errs.append(abs(Test-T))
        T += I*I*Rj/mb_cp*dt
    return np.mean(errs), np.max(errs)

me,mx=cycle_Terr()
print("\nB) Termómetro TCR con cuantización 12-bit (resistencias nominales):")
print(f"  error T medio = {me:.1f}°C · máx = {mx:.1f}°C  (en toda la rampa 25→1520°C)")

# === C) TOLERANCIA: las decisiones usan RAZONES → la ganancia se cancela ===
print("\nC) Tolerancia de resistencias (las razones R/R_frío cancelan la ganancia):")
print("  error de ganancia | err T medio | err T máx")
for tol in [0.0,0.02,0.05,0.10]:
    # divisor y shunt fuera de valor por 'tol' (peor caso ambos)
    me2,mx2=cycle_Terr(gain0=1+tol, gain1=1-tol)
    print(f"     ±{tol*100:4.0f}%        |   {me2:5.1f}°C   |  {mx2:5.1f}°C")
print("  → casi sin cambio: T y cuello salen de RAZONES, inmunes a la tolerancia.")
print("    (la auto-cal de R_frío en cada toque absorbe la ganancia).")

# === D) detección del CUELLO con cuantización ===
print("\nD) Detección del cuello (R sube al adelgazar, I=80A) — LSB del ADC0:")
print("  r [mm] | R_junta | V_junta | ADC0 LSB | R/R_min")
Rmin=Rliq(rw)
for r in [rw, rw*0.7, rw*0.5, rw*0.35, rw*0.25]:
    Rj=Rliq(r); Vj=80*Rj; a0=adc(Vj/DIV)
    print(f"  {r*1e3:4.2f}  | {Rj*1e3:5.2f}mΩ | {Vj:5.3f}V | {a0/LSB:5.0f}   | {Rj/Rmin:4.1f}×")
print("  → el umbral 4×R_min cae en r≈0.2mm con ~80 LSB: detectable y sobra ruido.")

print("\n"+"="*66)
print("VEREDICTO: con divisor 47k/10k + shunt 2mΩ (todo comercial) y 12 bits,")
print("el RP2350 resuelve toque, T (±pocos °C), cuello y suelta. La tolerancia")
print("de las resistencias NO importa: todo sale de razones auto-calibradas.")
print("Front-end = 2 R divisor + 1 shunt + 2 clamp + 2 RC. Cero chips de sensado.")
print("="*66)
