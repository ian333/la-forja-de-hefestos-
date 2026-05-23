#!/usr/bin/env python3
"""
Estabilidad de λ_Solow bajo distintas ventanas + países con misma ventana.

Pregunta: ¿el ratio USA 1950-2024 = 5.04 fue local o se mantiene
si normalizo ventana para todos los países?
"""

import csv, math, json
import numpy as np

PI  = math.pi
PHI = (1+math.sqrt(5))/2
DATA = "/tmp/operator-data"

def load_fred(path):
    dates, vals = [], []
    with open(path, newline="") as f:
        r = csv.reader(f); next(r)
        for row in r:
            if not row or len(row)<2: continue
            d, v = row[0], row[1]
            if v in ("",".") : continue
            try:
                vals.append(float(v)); dates.append(d)
            except ValueError: continue
    return dates, np.array(vals)

def date_yr(s):
    y, m, _ = s.split("-")
    return int(y) + (int(m)-1)/12.0

def fit_lambda_window(gdp_csv, year_min, year_max, dt=0.25):
    dates, gdp = load_fred(gdp_csv)
    t = np.array([date_yr(d) for d in dates])
    mask = (t>=year_min) & (t<=year_max) & (gdp>0)
    g_ = gdp[mask]; t_ = t[mask]
    if len(g_) < 30: return None
    log_y = np.log(g_)
    A = np.column_stack([np.ones_like(t_), t_])
    c, *_ = np.linalg.lstsq(A, log_y, rcond=None)
    gap = log_y - (c[0] + c[1]*t_)
    rho = float(np.sum(gap[:-1]*gap[1:]) / np.sum(gap[:-1]**2))
    if 0 < rho < 1:
        lam = -math.log(rho)/dt
        return {"n": len(g_), "rho": rho, "lambda": lam, "tau": 1/lam, "g_trend": float(c[1])}
    return None

# Estabilidad temporal USA: ventanas crecientes
print("=" * 70)
print("ESTABILIDAD TEMPORAL — λ_Solow USA bajo distintas ventanas")
print("=" * 70)
windows = [(1947,2024),(1950,2024),(1960,2024),(1970,2024),(1980,2024),
           (1990,2024),(1995,2024),(2000,2024),(1950,1990),(1990,2024),(2000,2020)]
print(f"{'Ventana':<15s} {'n':>6s} {'g(%/año)':>10s} {'ρ':>8s} {'λ(/año)':>10s} {'τ(años)':>10s}")
print("-"*60)
for y0, y1 in windows:
    r = fit_lambda_window(f"{DATA}/GDPC1.csv", y0, y1)
    if r:
        print(f"{y0}-{y1:>4d}    {r['n']:>6d} {r['g_trend']*100:>10.2f} {r['rho']:>8.4f} {r['lambda']:>10.4f} {r['tau']:>10.2f}")

# Cross-country con MISMA ventana 1990-2020
print("\n" + "=" * 70)
print("CROSS-COUNTRY — misma ventana 1990-2020 para los 4 países")
print("=" * 70)
countries = [
    ("USA", "GDPC1.csv", "SP500.csv", "fred"),
    ("UK",  "CLVMNACSCAB1GQUK.csv", "FTSE100.json", "yahoo"),
    ("JPN", "JPNRGDPEXP.csv", "NIKKEI225.csv", "fred"),
    ("DEU", "CLVMNACSCAB1GQDE.csv", "DAX.json", "yahoo"),
]

def fit_sigma2_fred(path):
    _, px = load_fred(f"{DATA}/{path}")
    px = px[px>0]; r = np.diff(np.log(px))
    return float(np.var(r)*252), len(px)

def fit_sigma2_yahoo(path):
    with open(f"{DATA}/{path}") as f:
        d = json.load(f)
    r0 = d['chart']['result'][0]
    cl = r0['indicators']['quote'][0]['close']
    cl = np.array([c for c in cl if c is not None])
    r = np.diff(np.log(cl))
    return float(np.var(r)*252), len(cl)

# SP500 y FTSE y DAX están limitados a 2016-2026 / 2015-2025
# Solo NIKKEI225 tiene historia larga. Pero la ventana 1990-2020 de Solow se cruza
# con la disponibilidad de cada stock. Si stock data 2016-2026 no traslapa con
# Solow 1990-2020, es un problema. Pero σ² supuestamente es invariante temporal
# así que reportamos σ² del periodo disponible y λ_Solow de 1990-2020.

print(f"{'País':6s} {'λ_Solow':>10s} {'τ_Solow':>10s} {'σ²_BS':>10s} {'τ_BS':>10s} {'τ_BS/τ_Solow':>15s} {'log':>8s} {'err vs e^φ':>12s}")
print("-"*100)

rows = []
for code, gdp_f, stk_f, kind in countries:
    s = fit_lambda_window(f"{DATA}/{gdp_f}", 1990, 2020)
    if s is None: continue
    if kind == "fred":
        s2, nd = fit_sigma2_fred(stk_f)
    else:
        s2, nd = fit_sigma2_yahoo(stk_f)
    tau_b = 1/s2
    ratio = tau_b / s['tau']
    lr = math.log(ratio)
    err = (ratio/math.exp(PHI)-1)*100
    print(f"{code:6s} {s['lambda']:10.4f} {s['tau']:10.3f} {s2:10.5f} {tau_b:10.3f} {ratio:15.4f} {lr:8.4f} {err:+11.2f}%")
    rows.append((code, s, s2, ratio, lr, err))

# Estabilidad std cross-country
print(f"\nlog(ratio) media: {np.mean([r[4] for r in rows]):.4f}")
print(f"log(ratio) std:   {np.std([r[4] for r in rows]):.4f}")
print(f"φ:                {PHI:.4f}")
print()
print("Hipótesis: si log(ratio) varía con std > 0.3 entre países, ")
print("           NO hay invariante e^φ. Sí < 0.1, hay invariante.")
