#!/usr/bin/env python3
"""
SÍNTESIS — comparar los tres fits y buscar invariantes del operador.

Tres tiempos característicos:
    τ_Phillips = 1/(ζω₀)    [tiempo de amortiguamiento del oscilador inflación]
    τ_Solow    = 1/λ_Solow  [tiempo de retorno del PIB-gap a tendencia]
    τ_BS       = 1/σ²       [tiempo de Heisenberg análogo de mercado, mov.1]

Hipótesis del marco (paper 0 "three clocks"): los tiempos están en
progresión geométrica con razones trascendentales del operador.
"""

import math

# Resultados de los tres fits previos
fits = {
    "Phillips_FULL_1955_2024":          {"zeta_omega0": 6.19801, "ventana": "1955-2024"},
    "Phillips_PostVolcker_1985_2024":   {"zeta_omega0": 3.80350, "ventana": "1985-2024"},
    "Phillips_GreatMod_1985_2007":      {"zeta_omega0": 3.92163, "ventana": "1985-2007"},
}

lam_solow      = 0.16495    # /año
sigma2_BS_full = 0.03279    # /año (vol histórica)
sigma2_BS_MAD  = 0.01241    # /año (vol MAD-robusta sin outliers)

# Constantes trascendentales del operador
PI   = math.pi
PHI  = (1 + math.sqrt(5))/2
E_PI = math.exp(PI)        # ≈ 23.1407, Gelfond
E_PHI = math.exp(PHI)      # ≈ 5.0427
E_PI_PHI = math.exp(PI+PHI)  # ≈ 116.65
LN_2 = math.log(2)

print("=" * 70)
print("SÍNTESIS: TRES TIEMPOS CARACTERÍSTICOS USA")
print("=" * 70)

for label, p in fits.items():
    zw = p["zeta_omega0"]
    tau_p = 1.0/zw
    tau_s = 1.0/lam_solow
    tau_b_full = 1.0/sigma2_BS_full
    tau_b_mad  = 1.0/sigma2_BS_MAD

    print(f"\n--- Phillips: {label} ({p['ventana']}) ---")
    print(f"  τ_Phillips = 1/{zw:.4f}   = {tau_p:.5f} años  (={tau_p*365.25:.1f} días)")
    print(f"  τ_Solow    = 1/{lam_solow:.4f}   = {tau_s:.4f} años")
    print(f"  τ_BS_full  = 1/{sigma2_BS_full:.4f}   = {tau_b_full:.3f} años")
    print(f"  τ_BS_MAD   = 1/{sigma2_BS_MAD:.4f}   = {tau_b_mad:.3f} años")

    r_SP = tau_s / tau_p
    r_BS = tau_b_full / tau_s
    r_BP = tau_b_full / tau_p
    r_BS_mad = tau_b_mad / tau_s
    r_BP_mad = tau_b_mad / tau_p

    def near(x, target, name):
        rel = (x/target - 1)*100
        flag = "★★★" if abs(rel) < 1 else ("★★" if abs(rel) < 3 else ("★" if abs(rel) < 7 else " "))
        return f"{name:>10}: {x:8.4f}  vs {target:8.4f}  ({rel:+5.2f}%)  {flag}"

    print(f"\n  τ_Solow / τ_Phillips = {r_SP:.4f}")
    print(f"      {near(r_SP, E_PI, 'e^π')}")
    print(f"      {near(r_SP, 4*PI**2, '4π²')}")
    print(f"      {near(r_SP, PI**3, 'π³')}")
    print(f"      {near(r_SP, 2*E_PI/PHI, '2e^π/φ')}")

    print(f"\n  τ_BS_full / τ_Solow = {r_BS:.4f}")
    print(f"      {near(r_BS, E_PHI, 'e^φ')}")
    print(f"      {near(r_BS, PI + PHI, 'π+φ')}")
    print(f"      {near(r_BS, 5.0, '5')}")
    print(f"      {near(r_BS, math.exp(LN_2*math.pi), 'e^(π ln2)')}")

    print(f"  τ_BS_MAD  / τ_Solow = {r_BS_mad:.4f}")
    print(f"      {near(r_BS_mad, 4*PI, '4π')}")
    print(f"      {near(r_BS_mad, PHI**5, 'φ⁵')}")
    print(f"      {near(r_BS_mad, 8*PHI, '8φ')}")

    print(f"\n  τ_BS_full / τ_Phillips = {r_BP:.4f}")
    print(f"      {near(r_BP, E_PI_PHI, 'e^(π+φ)')}")
    print(f"      {near(r_BP, E_PI * E_PHI, 'e^π·e^φ')}")
    print(f"      {near(r_BP, PI**4, 'π⁴')}")

# Combinación adimensional invariante
print("\n" + "=" * 70)
print("INVARIANTES ADIMENSIONALES")
print("=" * 70)

for label, p in fits.items():
    zw = p["zeta_omega0"]
    # Invariante I = (ζω₀ · σ²_BS) / λ²
    I_full = (zw * sigma2_BS_full) / lam_solow**2
    I_mad  = (zw * sigma2_BS_MAD ) / lam_solow**2
    # Logs en base e^π — si todo es exp(combinación π,φ)
    log_p = math.log(zw)
    log_s = math.log(lam_solow)
    log_b = math.log(sigma2_BS_full)
    print(f"\n--- {label} ---")
    print(f"  I_full = (ζω₀ · σ²_BS) / λ²  = {I_full:.4f}")
    print(f"           candidatos: e=2.718,  π=3.14,  φ²+2={PHI**2+2:.3f},  e^φ/φ={E_PHI/PHI:.3f}")
    print(f"  I_mad                       = {I_mad:.4f}")
    print(f"  log(ζω₀)/log(λ⁻¹) = {log_p/(-log_s):+.4f}")
    print(f"  log(ζω₀ · λ⁻¹) = {log_p - log_s:.4f}  vs π = {PI:.4f}")
    print(f"  log(λ · σ²⁻¹)  = {log_s - log_b:.4f}  vs φ = {PHI:.4f}")

# Reporte final
print("\n" + "=" * 70)
print("RESUMEN: BUSCAMOS QUE log(τ_X / τ_Y) sea combinación de π, φ, e")
print("=" * 70)
print(f"  e^π = {E_PI:.5f}     (constante de Gelfond)")
print(f"  e^φ = {E_PHI:.5f}")
print(f"  π·φ = {PI*PHI:.5f}")
print(f"  π+φ = {PI+PHI:.5f}")
print(f"  φ·π/e = {PHI*PI/math.e:.5f}")
