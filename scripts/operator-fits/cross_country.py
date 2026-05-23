#!/usr/bin/env python3
"""
Cross-country test: ¿es τ_BS/τ_Solow = e^φ universal o local USA?

Para USA, UK, Japón, Alemania:
  1. λ_Solow desde AR(1) sobre gap log(GDP real)
  2. σ²_BS desde vol histórica anualizada del índice nacional

Países:
  USA: GDPC1 + SP500
  UK : CLVMNACSCAB1GQUK + FTSE100
  JPN: JPNRGDPEXP + NIKKEI225
  DEU: CLVMNACSCAB1GQDE + DAX
"""

import csv, json, math, os
import numpy as np

PI  = math.pi
PHI = (1 + math.sqrt(5))/2
DATA = "/tmp/operator-data"

def load_fred_csv(path):
    dates, vals = [], []
    with open(path, newline="") as f:
        r = csv.reader(f); next(r)
        for row in r:
            if not row or len(row)<2: continue
            d, v = row[0], row[1]
            if v in ("", "."): continue
            try:
                vals.append(float(v)); dates.append(d)
            except ValueError: continue
    return dates, np.array(vals)

def load_yahoo_json(path):
    """Devuelve (timestamps, close_prices) filtrando Nones."""
    with open(path) as f:
        d = json.load(f)
    r = d['chart']['result'][0]
    ts = r['timestamp']
    cl = r['indicators']['quote'][0]['close']
    out_ts, out_cl = [], []
    for t, c in zip(ts, cl):
        if c is not None:
            out_ts.append(t); out_cl.append(c)
    return np.array(out_ts), np.array(out_cl)

def date_yr(s):
    y, m, _ = s.split("-")
    return int(y) + (int(m)-1)/12.0

def fit_lambda(log_y, t, dt):
    """AR(1) sobre gap log(GDP) detrended linealmente."""
    A = np.column_stack([np.ones_like(t), t])
    coef, *_ = np.linalg.lstsq(A, log_y, rcond=None)
    a, g = float(coef[0]), float(coef[1])
    gap = log_y - (a + g*t)
    rho = float(np.sum(gap[:-1]*gap[1:]) / np.sum(gap[:-1]**2))
    if 0 < rho < 1:
        return -math.log(rho)/dt, g, rho
    return float('nan'), g, rho

def fit_sigma2_fred(close, dt_days=1):
    """Vol anual desde precios FRED diarios."""
    px = close[close > 0]
    r = np.diff(np.log(px))
    return float(np.var(r) * 252)

def country_solow(gdp_csv, country, dt_q=0.25, year_min=1970, year_max=2024):
    dates, gdp = load_fred_csv(gdp_csv)
    t = np.array([date_yr(d) for d in dates])
    mask = (t >= year_min) & (t <= year_max) & (gdp > 0)
    gdp = gdp[mask]; t = t[mask]
    if len(gdp) < 30:
        return None
    log_y = np.log(gdp)
    lam, g, rho = fit_lambda(log_y, t, dt_q)
    return {"country": country, "n_q": len(gdp), "year_min": int(t.min()), "year_max": int(t.max()),
            "g_annual": g, "rho": rho, "lambda_solow": lam, "tau_solow": 1/lam if lam>0 else float('nan')}

def country_bs_yahoo(json_path, country):
    ts, cl = load_yahoo_json(json_path)
    cl = cl[cl > 0]
    r = np.diff(np.log(cl))
    s2 = float(np.var(r)*252)
    return {"country": country, "n_d": len(cl), "sigma2_BS": s2, "tau_BS": 1/s2}

def country_bs_fred(csv_path, country):
    dates, px = load_fred_csv(csv_path)
    px = px[px > 0]
    r = np.diff(np.log(px))
    s2 = float(np.var(r)*252)
    return {"country": country, "n_d": len(px), "sigma2_BS": s2, "tau_BS": 1/s2}

# ===== Run all =====
print("=" * 70)
print("CROSS-COUNTRY TEST — ¿τ_BS / τ_Solow = e^φ universal?")
print("=" * 70)

# USA
usa_solow = country_solow(f"{DATA}/GDPC1.csv", "USA")
usa_bs    = country_bs_fred(f"{DATA}/SP500.csv", "USA")

# UK
uk_solow  = country_solow(f"{DATA}/CLVMNACSCAB1GQUK.csv", "UK")
uk_bs     = country_bs_yahoo(f"{DATA}/FTSE100.json", "UK")

# JPN
jpn_solow = country_solow(f"{DATA}/JPNRGDPEXP.csv", "JPN")
jpn_bs    = country_bs_fred(f"{DATA}/NIKKEI225.csv", "JPN")

# DEU
deu_solow = country_solow(f"{DATA}/CLVMNACSCAB1GQDE.csv", "DEU")
deu_bs    = country_bs_yahoo(f"{DATA}/DAX.json", "DEU")

results = []
for s, b in [(usa_solow, usa_bs), (uk_solow, uk_bs), (jpn_solow, jpn_bs), (deu_solow, deu_bs)]:
    if s is None: continue
    c = s['country']
    ratio = b['tau_BS'] / s['tau_solow']
    log_ratio = math.log(ratio)
    err_pct = (ratio / math.exp(PHI) - 1) * 100
    results.append((c, s, b, ratio, log_ratio, err_pct))

    print(f"\n--- {c} ---")
    print(f"  Solow:")
    print(f"    GDP gap-AR(1): {s['year_min']}-{s['year_max']}, n_q={s['n_q']}")
    print(f"    g_frontier  = {s['g_annual']*100:5.2f}%/año")
    print(f"    ρ           = {s['rho']:.5f}")
    print(f"    λ_Solow     = {s['lambda_solow']:.5f}/año")
    print(f"    τ_Solow     = {s['tau_solow']:.3f} años")
    print(f"  Black-Scholes:")
    print(f"    n_dias      = {b['n_d']}")
    print(f"    σ²_BS       = {b['sigma2_BS']:.5f}/año  (σ={math.sqrt(b['sigma2_BS'])*100:.1f}%)")
    print(f"    τ_BS        = {b['tau_BS']:.3f} años")
    print(f"  >>> τ_BS / τ_Solow = {ratio:.5f}")
    print(f"  >>> log(ratio)     = {log_ratio:.5f}  vs  φ = {PHI:.5f}  (Δ = {log_ratio-PHI:+.5f})")
    print(f"  >>> error vs e^φ   = {err_pct:+.3f}%")

# Resumen
print("\n" + "=" * 70)
print("RESUMEN CROSS-COUNTRY")
print("=" * 70)
print(f"{'País':6s} {'λ_Solow':>10s} {'σ²_BS':>10s} {'τ_BS/τ_Solow':>15s} {'log(ratio)':>12s} {'vs φ':>10s}")
print("-"*70)
for c, s, b, ratio, log_ratio, err in results:
    print(f"{c:6s} {s['lambda_solow']:10.5f} {b['sigma2_BS']:10.5f} {ratio:15.4f} {log_ratio:12.5f} {err:+9.2f}%")

# Estadísticos
log_ratios = np.array([r[4] for r in results])
print(f"\nlog(τ_BS/τ_Solow) media   = {log_ratios.mean():.5f}")
print(f"log(τ_BS/τ_Solow) std     = {log_ratios.std():.5f}")
print(f"                  φ       = {PHI:.5f}")
print(f"                  desv    = {log_ratios.mean()-PHI:+.5f}  ({(log_ratios.mean()-PHI)/PHI*100:+.2f}%)")
