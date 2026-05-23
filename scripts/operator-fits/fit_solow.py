#!/usr/bin/env python3
"""
FIT 2 — Solow convergence rate λ.

Modelo (movimiento 5 del operador):
    k(t) - k* = (k_0 - k*) · e^(-λt)
    log[k(t) - k*] = log[k_0 - k*] - λt

Pero sin medir k* directamente, usamos crecimiento del producto por trabajador
y(t) = Y/L. En estado estacionario y crece a tasa g (frontera).
Desviación del estado estacionario decae a tasa λ:
    log y(t) = log y* + g·t + (log y_0 - log y* - g·t_0)·e^(-λt)

Más simple (Mankiw-Romer-Weil): regresión de growth-on-level:
    Δlog y_t = c - λ · log y_{t-1} + (otros controles)
    pendiente NEGATIVA de log y_{t-1} ⇒ convergencia con tasa λ.

Pero USA es economía-frontera, no se acerca a un estado estacionario más alto.
Usamos en cambio la TASA DE RECUPERACIÓN tras recesiones:
    medir cuánto tarda Y/L en volver a la tendencia tras desviación.

Estrategia simple y robusta:
1. Tomar log(Y/L) = log(GDPC1 / PAYEMS).
2. Ajustar tendencia lineal y_trend(t) = a + g·t.
3. Definir gap_t = log y_t - y_trend(t).
4. AR(1) sobre gap: gap_t = ρ · gap_{t-1} + ε
   Entonces λ = -ln(ρ) / Δt
   Para datos TRIMESTRALES, Δt = 0.25 año.

Salida: g (tasa frontera anual), λ_Solow (tasa convergencia anual),
        τ_solow = 1/λ (tiempo característico).

USAGE: python3 fit_solow.py
"""

import os
import csv
import math
import numpy as np

GDP_PATH    = "/tmp/operator-data/GDPC1.csv"     # real GDP, trimestral
PAYEMS_PATH = "/tmp/operator-data/PAYEMS.csv"    # empleo total, mensual

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

def date_to_year_q(d):
    """'1985-04-01' -> año decimal."""
    y, m, _ = d.split("-")
    return int(y) + (int(m)-1)/12.0

def main():
    dgdp, gdp = load_fred_csv(GDP_PATH)
    dpay, pay = load_fred_csv(PAYEMS_PATH)
    print(f"GDPC1  : {len(gdp)} trimestres, {dgdp[0]} → {dgdp[-1]}")
    print(f"PAYEMS : {len(pay)} meses, {dpay[0]} → {dpay[-1]}")

    # PAYEMS es mensual. Submuestrear al primer mes de cada trimestre
    # que coincida con GDPC1 (cuyas fechas son inicio de trimestre).
    pay_by_date = dict(zip(dpay, pay))

    yp, dp, gp = [], [], []
    for d, g in zip(dgdp, gdp):
        if d in pay_by_date:
            l = pay_by_date[d]   # miles de empleados
            if l > 0 and g > 0:
                y = g / l        # GDP per emp (unidades cualesquiera)
                yp.append(y); dp.append(d); gp.append(g)
    yp = np.array(yp); gp = np.array(gp)
    t  = np.array([date_to_year_q(d) for d in dp])
    print(f"\nAlineados (Y/L trimestral): {len(yp)} obs, {dp[0]} → {dp[-1]}")

    # Filtrar 1950-2024 (pre-1950 datos PAYEMS más ruidosos)
    mask = (t >= 1950) & (t <= 2024)
    yp = yp[mask]; t = t[mask]; dp = [d for d,m in zip(dp, mask) if m]
    print(f"Filtrado 1950-2024: {len(yp)} trimestres")

    log_y = np.log(yp)

    # Ajustar tendencia lineal por OLS
    A = np.column_stack([np.ones_like(t), t])
    coef, *_ = np.linalg.lstsq(A, log_y, rcond=None)
    a, g = coef[0], coef[1]   # log y = a + g·t  → g es tasa anual de frontera
    log_trend = a + g*t
    gap = log_y - log_trend
    print(f"\nTendencia lineal de log(Y/L):")
    print(f"  intercepto a = {a:.5f}")
    print(f"  pendiente  g = {g:.5f}/año  ← TASA FRONTERA (productividad)")
    print(f"  std(gap)     = {gap.std():.5f}")

    # AR(1) sobre el gap
    y_ar = gap[1:]; x_ar = gap[:-1]
    rho = float(np.sum(x_ar*y_ar) / np.sum(x_ar*x_ar))
    print(f"\nAR(1) sobre gap_t = ρ·gap_{{t-1}} + ε:")
    print(f"  ρ = {rho:.5f}")

    DT = 0.25  # años por paso (trimestral)
    if 0 < rho < 1:
        lam_solow = -math.log(rho) / DT
        tau_solow = 1.0 / lam_solow
        print(f"\n  λ_Solow   = {lam_solow:.5f} /año")
        print(f"  τ_Solow   = {tau_solow:.2f} años")
        print(f"\n  >>> SOLOW_RATE  = {lam_solow:.5f} /año")
        print(f"  >>> SOLOW_TAU   = {tau_solow:.4f} años")
        print(f"  >>> FRONTIER_g  = {g:.5f} /año")
    else:
        print(f"  ρ fuera de (0,1): convergencia no estándar")

if __name__ == "__main__":
    main()
