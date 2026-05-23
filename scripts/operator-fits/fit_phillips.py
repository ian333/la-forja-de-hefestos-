#!/usr/bin/env python3
"""
FIT 1 — Phillips curve como oscilador armónico amortiguado.

Modelo (movimiento 4 del operador):
    π̈ + 2ζω₀ π̇ + ω₀² π = noise

Discretización AR(2) sobre la inflación mensual:
    π_t = a·π_{t-1} + b·π_{t-2} + ε

Mapeo (Δt = 1/12 año, exacto en frecuencia angular):
    Característica del AR(2): φ(z) = z² − a z − b
    Raíces:                    z = (a ± √(a²+4b))/2
    Si raíces complejas r·e^(±iθ):
        r        = √(−b)             ← magnitud
        θ        = arccos(a/(2r))    ← frecuencia (rad/paso)
        ζω₀·Δt   = −ln(r)            ← amortiguamiento por paso
        ω_d·Δt   = θ                 ← frecuencia damped
        ω₀       = (1/Δt)·√[ln(r)² + θ²]
        ζ        = −ln(r) / √[ln(r)² + θ²]

Construyo π_t a partir de CPIAUCSL (índice de precios mensual):
    π_t = 1200 · ln(CPI_t / CPI_{t-12})   [inflación interanual % anualizada]

Estimación OLS de a, b:
    matriz X = [[π_{t-1}, π_{t-2}, 1]] regresión sobre π_t

Salida: r, θ, ω₀ (rad/año), ω_d, ζ, período T = 2π/ω_d (años), τ_decay = 1/(ζω₀) (años).

USAGE: python3 fit_phillips.py
"""

import os
import csv
import math
import numpy as np

CSV_PATH = "/tmp/operator-data/CPIAUCSL.csv"

def load_cpi(path):
    """FRED CSV: DATE, value-col. Devuelve (dates_str, values_float)."""
    dates, vals = [], []
    with open(path, newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if not row or len(row) < 2: continue
            d, v = row[0], row[1]
            if v in ("", "."): continue
            try:
                vals.append(float(v)); dates.append(d)
            except ValueError:
                continue
    return dates, np.array(vals, dtype=float)

def main():
    dates, cpi = load_cpi(CSV_PATH)
    print(f"CPIAUCSL cargado: {len(cpi)} observaciones, {dates[0]} → {dates[-1]}")

    # Inflación mensual anualizada — sin auto-correlación espuria por 12-lag
    # π_t = 1200 · ln(CPI_t / CPI_{t-1})    [%/año]
    if len(cpi) < 200:
        print("ERROR: serie demasiado corta")
        return
    pi = 1200.0 * np.log(cpi[1:] / cpi[:-1])
    pi_dates = dates[1:]

    # Aplicar suavizado 3-meses (rolling mean) para reducir ruido medición mes a mes
    win = 3
    pi_smooth = np.convolve(pi, np.ones(win)/win, mode='valid')
    pi_dates_smooth = pi_dates[win-1:]
    pi = pi_smooth; pi_dates = pi_dates_smooth

    def to_year(s):
        try: return int(s.split("-")[0])
        except: return 0
    years = np.array([to_year(d) for d in pi_dates])

    # Dos ventanas: ALL (1955-2024) y POST-VOLCKER (1985-2024 — Great Moderation)
    for label, ymin, ymax in [("FULL 1955-2024", 1955, 2024),
                              ("POST-VOLCKER 1985-2024", 1985, 2024),
                              ("GREAT MODERATION 1985-2007", 1985, 2007)]:
        mask = (years >= ymin) & (years <= ymax)
        p = pi[mask]
        print(f"\n========== Ventana: {label} ==========")
        print(f"  n={len(p)} meses, media={p.mean():.2f}%/año, std={p.std():.2f}%")
        if len(p) < 50:
            continue
        fit_ar2(p)

def fit_ar2(pi):

    # AR(2): π_t = a·π_{t-1} + b·π_{t-2} + c + ε  (centrar elimina c)
    pi_c = pi - pi.mean()
    y  = pi_c[2:]
    X1 = pi_c[1:-1]
    X2 = pi_c[:-2]
    X  = np.column_stack([X1, X2])
    # OLS
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    a, b = coef[0], coef[1]
    print(f"  AR(2) coeficientes (datos centrados):")
    print(f"    a (lag-1) = {a:+.5f}")
    print(f"    b (lag-2) = {b:+.5f}")

    # Raíces del polinomio característico z² − a z − b = 0
    disc = a*a + 4*b
    DT = 1.0/12.0
    if disc < 0:
        # raíces complejas conjugadas r·e^(±iθ)
        r = math.sqrt(-b)
        theta = math.acos(a/(2*r)) if abs(a/(2*r)) <= 1 else float('nan')
        print(f"  Raíces complejas (oscilatorio):")
        print(f"    r = {r:.5f}, θ = {theta:.5f} rad/mes ({math.degrees(theta):.2f}°/mes)")
        ln_r = math.log(r)
        ln_r2_p_th2 = ln_r*ln_r + theta*theta
        omega0    = math.sqrt(ln_r2_p_th2) / DT
        omega_d   = theta / DT
        zeta      = -ln_r / math.sqrt(ln_r2_p_th2)
        zeta_omega0 = -ln_r / DT
        T_cycle   = 2*math.pi/omega_d if omega_d > 0 else float('inf')
        tau_decay = 1.0/zeta_omega0 if zeta_omega0 > 0 else float('inf')
        print(f"  Oscilador armónico amortiguado:")
        print(f"    ω₀     = {omega0:.4f} rad/año     (período natural = {2*math.pi/omega0:.2f} años)")
        print(f"    ω_d    = {omega_d:.4f} rad/año     (período damped = {T_cycle:.2f} años)")
        print(f"    ζ      = {zeta:.4f}                   {'(SUB' if zeta<1 else '(SOBRE'}amortiguado)")
        print(f"    ζω₀    = {zeta_omega0:.4f} /año       ← TASA DE AMORTIGUAMIENTO")
        print(f"    τ_dec  = {tau_decay:.2f} años")
        print(f"  PHILLIPS_DAMPING_RATE = {zeta_omega0:.5f} /año")
    else:
        r1 = (a + math.sqrt(disc))/2
        r2 = (a - math.sqrt(disc))/2
        print(f"  Raíces reales (sobreamortiguado):")
        print(f"    z1 = {r1:.5f},  z2 = {r2:.5f}")
        # Para sobreamortiguado, ζω₀ = -ln(max|z|)/Δt y ω₀² = -ln(z1)·-ln(z2)/Δt²
        rmax = max(abs(r1), abs(r2))
        rmin = min(abs(r1), abs(r2))
        if rmax > 0 and rmin > 0:
            l1 = -math.log(rmax)/DT     # decay slow mode
            l2 = -math.log(rmin)/DT     # decay fast mode
            print(f"    decay slow = {l1:.5f}/año (τ_slow = {1/l1:.2f} años)")
            print(f"    decay fast = {l2:.5f}/año (τ_fast = {1/l2:.2f} años)")
            # Mapeo a oscilador con ζ>=1:
            # raíces reales z1,z2 ⇒ tasas r1=-ln(z1)/Δt, r2=-ln(z2)/Δt
            # oscilador amortiguado: tasas = ζω₀ ± ω₀√(ζ²-1)
            #   ⇒ ζω₀ = (r1+r2)/2,  ω₀² = r1·r2
            zeta_omega0 = (l1+l2)/2
            omega0 = math.sqrt(l1*l2)
            zeta = zeta_omega0/omega0 if omega0 > 0 else float('inf')
            print(f"  Oscilador equivalente:")
            print(f"    ω₀     = {omega0:.4f} rad/año     (período natural = {2*math.pi/omega0:.2f} años)")
            print(f"    ζ      = {zeta:.4f}     (≥ 1: sobreamortiguado real)")
            print(f"    ζω₀    = {zeta_omega0:.4f} /año       ← TASA DE AMORTIGUAMIENTO PROMEDIO")
            print(f"  PHILLIPS_DAMPING_RATE = {zeta_omega0:.5f} /año")

if __name__ == "__main__":
    main()
