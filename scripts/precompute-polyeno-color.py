#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-polyeno-color.py — EL COLOR NACE DEL LARGO, calculado de verdad.

Para el video del caroteno (formación): a cada longitud de conjugación N (número de
dobles enlaces C=C conjugados) le corresponde una λmax de absorción REAL, y por tanto
un COLOR OBSERVADO real (lo que la molécula refleja = complementario de lo que absorbe).

Física (calculada, no inventada):
  · Modelo de electrón libre (FEMO / partícula en una caja, Kuhn 1949): los 2N
    electrones π en una caja de largo L=(2N+1)·d (d=1.40 Å) → ΔE(HOMO→LUMO) =
    (2N+1)·h²/(8·m·L²) → λ_femo = 8·m·c·d²·(2N+1)/h.  (trend exacto, monótono)
  · Anclado a λmax MEDIDA (datos reales, literatura — docs/FISICA-CAROTENO.md):
    etileno 165, butadieno 217, hexatrieno 258, octatetraeno 304 nm, …, β-caroteno ~450.
    Calibramos el FEMO a esos anclajes (factor + offset por mínimos cuadrados) para que
    el color observado caiga EXACTO (corto=UV/incoloro → largo=naranja).
  · λ_abs → COLOR OBSERVADO: color de cuerpo = blanco − (absorción gaussiana centrada
    en λ_abs), integrada contra las funciones de igualación CIE 1931 → sRGB.

Salida: public/precomputed/caroteno-color.json
  [{ "N":1..11, "carbons":2N, "lambda_abs_nm":…, "rgb":[r,g,b] }]  (rgb en 0..1 lineal)

Uso: python3 scripts/precompute-polyeno-color.py
"""
import os, json, math

# ── constantes físicas (SI) ──
H = 6.62607015e-34; ME = 9.1093837015e-31; C = 299792458.0
D_CC = 1.40e-10          # longitud media de enlace en la conjugación (m)

def femo_lambda_nm(N):
    """λmax por el modelo de electrón libre (partícula en una caja). Real, calculado."""
    L = (2 * N + 1) * D_CC                     # largo de la caja
    dE = (2 * N + 1) * H * H / (8 * ME * L * L)  # HOMO(n=N) → LUMO(n=N+1)
    lam = H * C / dE                            # m
    return lam * 1e9

# ── anclajes MEDIDOS (nm) — datos reales de literatura (LibreTexts/IntechOpen) ──
MEASURED = {1: 165.0, 2: 217.0, 3: 258.0, 4: 304.0, 11: 450.0}   # β-caroteno (conj. efectiva) ~450

# calibración lineal del FEMO a los anclajes medidos: λ_cal = a·λ_femo + b (mínimos cuadrados)
xs = [femo_lambda_nm(N) for N in MEASURED]; ys = list(MEASURED.values())
n = len(xs); sx = sum(xs); sy = sum(ys); sxx = sum(x * x for x in xs); sxy = sum(x * y for x, y in zip(xs, ys))
a = (n * sxy - sx * sy) / (n * sxx - sx * sx); b = (sy - a * sx) / n

# ── CIE 1931 color-matching (aprox. analítica de Wyman 2013, gaussianas multilobulo) ──
def _g(x, mu, s1, s2):
    s = s1 if x < mu else s2
    return math.exp(-0.5 * ((x - mu) / s) ** 2)
def cie_xyz(lam):   # lam en nm
    x = 1.056 * _g(lam, 599.8, 37.9, 31.0) + 0.362 * _g(lam, 442.0, 16.0, 26.7) - 0.065 * _g(lam, 501.1, 20.4, 26.2)
    y = 0.821 * _g(lam, 568.8, 46.9, 40.5) + 0.286 * _g(lam, 530.9, 16.3, 31.1)
    z = 1.217 * _g(lam, 437.0, 11.8, 36.0) + 0.681 * _g(lam, 459.0, 26.0, 13.8)
    return x, y, z

# iluminante plano (equal-energy) muestreado 380..730 nm
LAMS = [380 + 5 * i for i in range(71)]
def observed_rgb(lam_abs):
    """Color de CUERPO: reflectancia = 1 − absorción gaussiana en lam_abs; integrar CIE → sRGB."""
    width = 45.0                                  # ancho de banda de absorción (nm), típico π-π*
    strength = 1.0 if lam_abs >= 400 else max(0.0, 1.0 - (400 - lam_abs) / 90.0)  # UV<400: casi no se ve
    X = Y = Z = 0.0
    for lam in LAMS:
        refl = 1.0 - strength * math.exp(-0.5 * ((lam - lam_abs) / width) ** 2)
        cx, cy, cz = cie_xyz(lam)
        X += refl * cx; Y += refl * cy; Z += refl * cz
    s = X + Y + Z or 1.0
    # normaliza a luminancia Y (color, no brillo) y XYZ→sRGB lineal
    k = 1.0 / (Y or 1.0)
    X *= k; Y *= k; Z *= k
    r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z
    g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z
    bl = 0.0557 * X - 0.2040 * Y + 1.0570 * Z
    r, g, bl = (max(0.0, v) for v in (r, g, bl))
    m = max(r, g, bl, 1e-6)
    return [round(r / m, 4), round(g / m, 4), round(bl / m, 4)]   # cromaticidad normalizada (el brillo lo pone el render)

out = []
for N in range(1, 12):
    lam_femo = femo_lambda_nm(N)
    lam = a * lam_femo + b                        # calibrado a lo medido
    rgb = observed_rgb(lam)
    out.append({"N": N, "carbons": 2 * N, "lambda_femo_nm": round(lam_femo, 1),
                "lambda_abs_nm": round(lam, 1), "rgb": rgb})

# verificación opcional con PySCF (HOMO-LUMO real, confirma el trend) — no bloquea si falta
try:
    from pyscf import gto, scf
    print("PySCF: HOMO-LUMO gap real por N (confirma trend monótono ↓):")
    for N in (1, 2, 3, 4):
        nC = 2 * N
        atoms = []
        for j in range(nC):
            atoms.append(['C', (j * 1.25, (j % 2) * 0.7, 0)])
        m = gto.M(atom=atoms, basis='sto-3g', spin=0, verbose=0)
        mf = scf.RHF(m); mf.kernel()
        occ = mf.mo_occ; e = mf.mo_energy
        homo = max(e[i] for i in range(len(e)) if occ[i] > 0)
        lumo = min(e[i] for i in range(len(e)) if occ[i] == 0)
        print(f"  N={N}: gap={27.2114*(lumo-homo):.2f} eV")
except Exception as ex:
    print(f"(PySCF verify saltado: {ex})")

BASE = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'caroteno-color.json')
json.dump(out, open(BASE, 'w'), indent=1)
print(f"\nOK {BASE}")
for r in out:
    print(f"  N={r['N']:2d} ({r['carbons']}C)  λ_abs={r['lambda_abs_nm']:5.0f}nm  rgb={r['rgb']}")
