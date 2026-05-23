#!/usr/bin/env python3
"""
FIT 3 — Black-Scholes σ (volatilidad anualizada) y "masa" 1/σ² (movimiento 1).

Modelo (GBM):
    dS/S = μ dt + σ dW
⇒  log-retornos diarios r_d = log(S_t/S_{t-1}) tienen Var = σ²·Δt
⇒  σ_anual = std(r_d) · √252  (252 días de trading)

Pero hay heteroscedasticidad (GARCH). Reportamos:
  - σ histórica ventana completa
  - σ histórica por décadas
  - σ implícita "robust" via MAD

También reportamos:
  - m_BS = 1/σ² (movimiento 1: masa de Schrödinger imaginario)
  - λ_DB = 2π·σ²/E[|Δlog S|] (longitud de coherencia)
  - τ_BS = 1/σ² (tiempo de Heisenberg análogo)

USAGE: python3 fit_blackscholes.py
"""

import csv
import math
import numpy as np

SP500_PATH = "/tmp/operator-data/SP500.csv"

def load_fred_csv(path):
    dates, vals = [], []
    with open(path, newline="") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            if not row or len(row) < 2: continue
            d, v = row[0], row[1]
            if v in ("", "."): continue
            try:
                vals.append(float(v)); dates.append(d)
            except ValueError:
                continue
    return dates, np.array(vals, dtype=float)

def main():
    dates, px = load_fred_csv(SP500_PATH)
    print(f"SP500: {len(px)} días, {dates[0]} → {dates[-1]}")
    if len(px) < 100:
        print("ERROR: muy pocos datos")
        return

    # Log-retornos diarios
    r = np.diff(np.log(px))
    dates_r = dates[1:]
    print(f"Log-returns diarios: {len(r)} obs, "
          f"media diaria = {r.mean()*100:.4f}%, std diaria = {r.std()*100:.4f}%")

    # Volatilidad anualizada (Black-Scholes σ)
    sigma_annual = r.std() * math.sqrt(252)
    print(f"\n  σ_BS (histórica anualizada, ventana completa) = {sigma_annual:.5f}")
    print(f"      = {sigma_annual*100:.2f}% / año")

    # Subventanas por año para ver volatility-of-volatility
    years = np.array([int(d.split("-")[0]) for d in dates_r])
    print(f"\nVol por año:")
    for y in sorted(set(years)):
        ri = r[years == y]
        if len(ri) > 50:
            s = ri.std() * math.sqrt(252)
            print(f"  {y}: σ = {s*100:5.2f}%  (n={len(ri)})")

    # Masa Black-Scholes (movimiento 1): m = 1/σ²
    m_BS = 1.0 / (sigma_annual**2)
    print(f"\n>>> BS_SIGMA   = {sigma_annual:.5f} /año^(1/2)")
    print(f">>> BS_MASS    = 1/σ² = {m_BS:.4f}")
    print(f">>> BS_TAU     = 1/σ² = {m_BS:.4f} años")
    print(f">>> BS_RATE    = σ²    = {sigma_annual**2:.5f} /año")

    # MAD-robust sigma (descontando outliers)
    mad = np.median(np.abs(r - np.median(r)))
    sigma_robust = mad * 1.4826 * math.sqrt(252)
    print(f">>> BS_SIGMA_ROBUST (MAD)   = {sigma_robust:.5f} /año^(1/2)")
    print(f">>> BS_RATE_ROBUST = σ²_rob = {sigma_robust**2:.5f} /año")

if __name__ == "__main__":
    main()
