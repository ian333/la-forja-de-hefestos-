#!/usr/bin/env python3
"""
Bootstrap (block bootstrap para series temporales) para los tres fits.
Reporta intervalos de confianza al 95% para los ratios.
"""

import csv
import math
import numpy as np

PI  = math.pi
PHI = (1 + math.sqrt(5))/2
N_BOOT = 1000
BLOCK = 24       # tamaño de bloque (meses) — preserva autocorrelación
SEED = 42

rng = np.random.default_rng(SEED)

def load(path):
    dates, vals = [], []
    with open(path, newline="") as f:
        r = csv.reader(f); next(r)
        for row in r:
            if not row or len(row) < 2: continue
            d, v = row[0], row[1]
            if v in ("", "."): continue
            try:
                vals.append(float(v)); dates.append(d)
            except ValueError:
                continue
    return dates, np.array(vals)

def block_bootstrap_idx(n, block, n_out=None):
    """Generate indices for circular block bootstrap."""
    if n_out is None: n_out = n
    n_blocks = int(np.ceil(n_out / block))
    starts = rng.integers(0, n, size=n_blocks)
    idx = []
    for s in starts:
        for i in range(block):
            idx.append((s+i) % n)
    return np.array(idx[:n_out])

def fit_phillips_zw0(pi_series, dt=1/12):
    """Devuelve ζω₀ del AR(2) si raíces complejas, else nan."""
    pi_c = pi_series - pi_series.mean()
    y  = pi_c[2:]; X1 = pi_c[1:-1]; X2 = pi_c[:-2]
    X = np.column_stack([X1, X2])
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    a, b = float(coef[0]), float(coef[1])
    disc = a*a + 4*b
    if disc < 0:
        r = math.sqrt(-b)
        return -math.log(r) / dt
    else:
        # sobreamortiguado
        r1 = (a + math.sqrt(disc))/2
        r2 = (a - math.sqrt(disc))/2
        if r1 > 0 and r2 > 0:
            return (-math.log(r1) - math.log(r2)) / (2*dt)
        return float('nan')

def fit_solow_lambda(log_y, t, dt=0.25):
    """λ del gap-AR(1)."""
    A = np.column_stack([np.ones_like(t), t])
    coef, *_ = np.linalg.lstsq(A, log_y, rcond=None)
    a, g = float(coef[0]), float(coef[1])
    gap = log_y - (a + g*t)
    y_ar = gap[1:]; x_ar = gap[:-1]
    rho = float(np.sum(x_ar*y_ar) / np.sum(x_ar*x_ar))
    if 0 < rho < 1:
        return -math.log(rho) / dt
    return float('nan')

def fit_bs_sigma2(log_returns):
    return float(np.var(log_returns) * 252)

# ===== Cargar datos =====
print("Cargando datos...")
_, cpi = load("/tmp/operator-data/CPIAUCSL.csv")
dgdp, gdp = load("/tmp/operator-data/GDPC1.csv")
dpay, pay = load("/tmp/operator-data/PAYEMS.csv")
dsp, sp = load("/tmp/operator-data/SP500.csv")

# Phillips: inflación mensual anualizada post-Volcker
pi_monthly = 1200 * np.log(cpi[1:]/cpi[:-1])
pi_monthly = np.convolve(pi_monthly, np.ones(3)/3, mode='valid')
# slice 1985-2024 — empieza al mes 12·(1985-1947)+ish. Mejor por índice aprox:
# CPI starts 1947-01. 1985 ≈ mes 12·38 = 456. 2024 end ≈ mes 12·77 = 924
pi_pv = pi_monthly[456:925]
print(f"  Phillips post-Volcker: {len(pi_pv)} meses")

# Solow: log(GDP/Empleo) alineado trimestral
pay_d = dict(zip(dpay, pay))
yp, tp = [], []
for d, g in zip(dgdp, gdp):
    if d in pay_d:
        l = pay_d[d]
        if l > 0 and g > 0:
            y_int, m_int, _ = d.split("-")
            yr = int(y_int) + (int(m_int)-1)/12.0
            if 1950 <= yr <= 2024:
                yp.append(g/l); tp.append(yr)
yp = np.array(yp); tp = np.array(tp)
log_y = np.log(yp)
print(f"  Solow: {len(yp)} trimestres")

# Black-Scholes: log-returns diarios SP500
sp_returns = np.diff(np.log(sp))
print(f"  Black-Scholes: {len(sp_returns)} días")

# ===== Bootstrap =====
print(f"\nCorriendo bootstrap con N={N_BOOT}, bloques={BLOCK}...")

zw_samples = []
lam_samples = []
sig_samples = []

for b in range(N_BOOT):
    # Phillips block bootstrap (block=24 meses)
    idx_p = block_bootstrap_idx(len(pi_pv), BLOCK)
    zw = fit_phillips_zw0(pi_pv[idx_p])
    if not math.isnan(zw): zw_samples.append(zw)

    # Solow block bootstrap (block=8 trimestres = 2 años)
    n_q = len(log_y)
    idx_s = block_bootstrap_idx(n_q, 8)
    # ordenar por t para mantener consistencia
    log_y_b = log_y[idx_s]; tp_b = tp[idx_s]
    order = np.argsort(tp_b)
    lam = fit_solow_lambda(log_y_b[order], tp_b[order])
    if not math.isnan(lam): lam_samples.append(lam)

    # BS block bootstrap (block=20 días ≈ mes)
    idx_b = block_bootstrap_idx(len(sp_returns), 20)
    sig = fit_bs_sigma2(sp_returns[idx_b])
    sig_samples.append(sig)

zw_samples = np.array(zw_samples)
lam_samples = np.array(lam_samples)
sig_samples = np.array(sig_samples)

def stats(x, label):
    m, s = x.mean(), x.std()
    q025, q500, q975 = np.percentile(x, [2.5, 50, 97.5])
    print(f"  {label:20s}: mean={m:.5f}, median={q500:.5f}, std={s:.5f}")
    print(f"  {'95%CI':>20s}: [{q025:.5f}, {q975:.5f}]")
    return m, s, q025, q500, q975

print(f"\n--- Distribuciones bootstrap (n={N_BOOT}) ---")
zw_stats = stats(zw_samples, "ζω₀_Phillips")
lam_stats = stats(lam_samples, "λ_Solow")
sig_stats = stats(sig_samples, "σ²_BS")

# Ratios
r1_samples = lam_samples[:min(len(lam_samples), len(zw_samples))] / zw_samples[:min(len(lam_samples), len(zw_samples))]
r1_samples = 1/r1_samples  # τ_Solow/τ_Phillips = (1/λ)/(1/ζω₀) = ζω₀/λ
# Mejor: emparejar primero
n_min = min(len(zw_samples), len(lam_samples), len(sig_samples))
zw = zw_samples[:n_min]; lam = lam_samples[:n_min]; sig = sig_samples[:n_min]

r_SP_b = zw / lam               # τ_S/τ_P = ζω₀/λ
r_BS_b = lam / sig              # τ_B/τ_S = λ/σ²
r_BP_b = zw / sig               # τ_B/τ_P = ζω₀/σ²
I_b    = (zw * sig) / lam**2    # invariante

def report_ratio(label, samples, target_val, target_name):
    q025, q500, q975 = np.percentile(samples, [2.5, 50, 97.5])
    err_low  = (q025/target_val - 1)*100
    err_med  = (q500/target_val - 1)*100
    err_high = (q975/target_val - 1)*100
    in_ci = q025 <= target_val <= q975
    flag = "✓ DENTRO 95%CI" if in_ci else "✗ FUERA"
    print(f"\n  {label}")
    print(f"    bootstrap median = {q500:.4f}, 95%CI=[{q025:.4f}, {q975:.4f}]")
    print(f"    predicción {target_name:>10} = {target_val:.4f}")
    print(f"    error mediano = {err_med:+.2f}%, banda 95% = [{err_low:+.1f}%, {err_high:+.1f}%]")
    print(f"    {flag}")

print(f"\n--- RATIOS Y PREDICCIONES ---")
report_ratio("τ_Solow / τ_Phillips", r_SP_b, math.exp(PI),       "e^π")
report_ratio("τ_BS    / τ_Solow",    r_BS_b, math.exp(PHI),      "e^φ")
report_ratio("τ_BS    / τ_Phillips", r_BP_b, math.exp(PI+PHI),   "e^(π+φ)")
report_ratio("I = (ζω₀·σ²)/λ²",       I_b,   math.exp(PI-PHI),   "e^(π−φ)")
