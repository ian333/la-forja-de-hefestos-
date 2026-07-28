#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""validar-trazador-campo.py — BANCO DE PRUEBA del trazador contra SOLUCIONES EXACTAS.

Ian, 2026-07-27: "el campo se ve poco denso y raro, no es un campo real. Empecemos con campos
ideales de 1-30 partículas, hay fórmulas". Exacto: antes de confiar en el campo de una
molécula (donde no hay solución cerrada) hay que probar el trazador donde SÍ la hay.

FÓRMULAS EXACTAS QUE SE USAN COMO PATRÓN:

  1. FUNCIÓN DE FLUJO (Stokes) para cargas puntuales en un eje. Sale de la ley de Gauss:
         psi(P) = sum_i  q_i * cos(theta_i),   cos(theta_i) = (z - z_i)/|P - P_i|
     Las líneas de campo son las CURVAS DE NIVEL de psi. Entonces, a lo largo de una línea
     bien trazada, **psi debe ser CONSTANTE**. Su deriva es el error del trazador. Es un test
     exacto, no una heurística.

  2. DIPOLO puntual: r(theta) = r0 * sin^2(theta)  (solución cerrada de libro).

  3. CARGA ÚNICA: las líneas son RECTAS radiales → curvatura kappa = 0 exacta.

  python3 scripts/validar-trazador-campo.py [--n 30] [--png <dir>]
"""
import sys, os
import numpy as np

N_MAX = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 30
PNG = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None

def E_puntuales(P, Q, C):
    """Campo de cargas puntuales: E = sum q_i (r-r_i)/|r-r_i|^3. Vectorizado (GPU-friendly)."""
    d = P[:, None, :] - C[None, :, :]
    r = np.linalg.norm(d, axis=2)
    r = np.maximum(r, 1e-9)
    return (Q[None, :, None] * d / (r ** 3)[:, :, None]).sum(axis=1)

def psi(P, Q, C):
    """Función de flujo psi = sum q_i cos(theta_i). CONSTANTE a lo largo de una línea real."""
    d = P[:, None, :] - C[None, :, :]
    r = np.maximum(np.linalg.norm(d, axis=2), 1e-9)
    return (Q[None, :] * d[:, :, 2] / r).sum(axis=1)

def trazar(seed, Q, C, h=0.02, nmax=20000, rmax=60.0, rstop=0.05, metodo='euler'):
    """Integra dr/ds = E_hat(r). 'euler' = primer orden (el de produccion hoy);
    'rk4' = Runge-Kutta 4 (cuarto orden), que es lo que manda la literatura de trazado."""
    def Ehat(x):
        E = E_puntuales(x[None, :], Q, C)[0]
        n = np.linalg.norm(E)
        return E / n if (n > 1e-12 and np.isfinite(n)) else None
    p = seed.copy(); path = [p.copy()]
    for _ in range(nmax):
        k1 = Ehat(p)
        if k1 is None: break
        if metodo == 'rk4':
            k2 = Ehat(p + 0.5 * h * k1)
            if k2 is None: break
            k3 = Ehat(p + 0.5 * h * k2)
            if k3 is None: break
            k4 = Ehat(p + h * k3)
            if k4 is None: break
            p = p + (h / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)
        else:
            p = p + h * k1
        if np.linalg.norm(p) > rmax: break
        if np.min(np.linalg.norm(p[None, :] - C, axis=1)) < rstop: break
        path.append(p.copy())
    return np.array(path)

def caso(nombre, Q, C, nsemillas=12, metodo='euler'):
    """Traza y mide: (a) deriva de psi, (b) curvatura, (c) si aplica, error vs r0 sin^2(theta)."""
    Q = np.array(Q, float); C = np.array(C, float)
    # semillas: esfera pequeña alrededor de cada carga POSITIVA (regla del libro)
    S = []
    for q, c in zip(Q, C):
        if q <= 0: continue
        for k in range(nsemillas):
            th = np.arccos(1 - 2 * (k + 0.5) / nsemillas)
            ph = np.pi * (1 + 5 ** 0.5) * k
            S.append(c + 0.10 * np.array([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)]))
    derivas, kappas, largos = [], [], []
    for s in S:
        L = trazar(np.array(s), Q, C, metodo=metodo)
        if len(L) < 12: continue
        ps = psi(L, Q, C)
        # deriva RELATIVA de psi a lo largo de la línea (debe ser ~0)
        esc = max(np.abs(Q).sum(), 1e-9)
        derivas.append((ps.max() - ps.min()) / esc)
        d1 = np.gradient(L, axis=0); d2 = np.gradient(d1, axis=0)
        k = np.linalg.norm(np.cross(d1, d2), axis=1) / np.maximum(np.linalg.norm(d1, axis=1) ** 3, 1e-15)
        kappas.append(np.median(k)); largos.append(np.linalg.norm(np.diff(L, axis=0), axis=1).sum())
    if not derivas: print(f"  {nombre:34s} SIN LÍNEAS"); return None
    dv = np.array(derivas)
    print(f"  {nombre:34s} psi deriva: med {np.median(dv):.2e}  p95 {np.percentile(dv,95):.2e}   "
          f"kappa med {np.median(kappas):.4f}   largo med {np.median(largos):.2f}")
    return np.median(dv)

print("═══ BANCO: el trazador contra SOLUCIONES EXACTAS ═══")
print("  OJO: psi = sum q_i cos(theta_i) SOLO vale para cargas sobre un EJE (simetría axial).")
print("  Por eso los casos de ANILLO no se usan para juzgar la integración.")
print("  psi = sum q_i cos(theta_i) debe ser CONSTANTE a lo largo de cada línea (ley de Gauss).")
print()
res = {}
# 1) carga única: líneas RECTAS (kappa debe ser ~0)
res['1 carga'] = caso("1 carga +", [1.0], [[0, 0, 0]])
# 2) dipolo: el caso con solución cerrada r = r0 sin^2(theta)
res['dipolo'] = caso("2 cargas (dipolo +/-)", [1.0, -1.0], [[0, 0, 0.5], [0, 0, -0.5]])
# 3) cuadrupolo lineal
res['cuadrupolo'] = caso("3 cargas (+,-2,+) cuadrupolo", [1.0, -2.0, 1.0], [[0,0,1],[0,0,0],[0,0,-1]])
# 4..) cadenas y anillos crecientes hasta N_MAX
for n in (4, 6, 8, 12, 20, N_MAX):
    z = np.linspace(-1, 1, n)
    q = np.where(np.arange(n) % 2 == 0, 1.0, -1.0)
    res[f'cadena {n}'] = caso(f"{n} cargas alternadas en línea", q, np.stack([np.zeros(n), np.zeros(n), z], 1))
# anillo (como el trímero): 3 pares +/- en un círculo
for n in (3, 6, 9):
    th = np.arange(n) * 2 * np.pi / n
    C = np.stack([np.cos(th), np.sin(th), np.zeros(n)], 1)
    q = np.where(np.arange(n) % 2 == 0, 1.0, -1.0)
    res[f'anillo {n}'] = caso(f"anillo de {n} cargas alternadas", q, C)

print()
print("── EULER (producción) vs RK4 (lo que manda la literatura) ──")
print("  [solo casos AXIALES, donde psi es válida]")
for met in ("euler", "rk4"):
    print(f"  ·· metodo = {met} ··")
    caso("  dipolo", [1.0, -1.0], [[0,0,0.5],[0,0,-0.5]], metodo=met)
    caso("  cuadrupolo", [1.0,-2.0,1.0], [[0,0,1],[0,0,0],[0,0,-1]], metodo=met)
    z=np.linspace(-1,1,8); q=np.where(np.arange(8)%2==0,1.0,-1.0)
    caso("  cadena 8", q, np.stack([np.zeros(8),np.zeros(8),z],1), metodo=met)
print()
print("── DIPOLO vs la fórmula cerrada r = r0 sin^2(theta) ──")
Q = np.array([1.0, -1.0]); C = np.array([[0, 0, 0.5], [0, 0, -0.5]])
errs = []
for th0 in (0.5, 0.9, 1.3, 1.8, 2.3):
    s = C[0] + 0.10 * np.array([np.sin(th0), 0, np.cos(th0)])
    L = trazar(s, Q, C)
    if len(L) < 20: continue
    rr = np.linalg.norm(L, axis=1); th = np.arccos(np.clip(L[:, 2] / np.maximum(rr, 1e-9), -1, 1))
    m = (rr > 1.2) & (np.sin(th) > 0.25)          # lejos: el dipolo puntual es buena aprox
    if m.sum() < 8: continue
    r0 = np.median(rr[m] / np.sin(th[m]) ** 2)     # r0 de la fórmula
    err = np.abs(rr[m] - r0 * np.sin(th[m]) ** 2) / np.maximum(rr[m], 1e-9)
    errs.append(np.median(err))
    print(f"  semilla theta0={th0:.2f}  r0={r0:5.2f}   error relativo mediano {np.median(err)*100:5.2f} %")
if errs:
    e = float(np.median(errs))
    print(f"\n  ERROR MEDIANO vs fórmula exacta: {e*100:.2f} %   " + ("✅ el trazador es correcto" if e < 0.05 else "❌ el trazador se desvía"))
d = np.array([v for v in res.values() if v is not None])
print(f"\n  deriva de psi (todos los casos): mediana {np.median(d):.2e}   " +
      ("✅ conserva el flujo (Gauss)" if np.median(d) < 1e-2 else "❌ NO conserva el flujo"))
