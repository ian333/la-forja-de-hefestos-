#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""campo-gate.py — BANCO DE PRUEBAS del motor de campo (scripts/campo_lineas.py).

No mide si el campo se ve bonito: mide si CUMPLE LAS LEYES. Seis gates, de más barato a
más caro, todos con un número esperado que sale de la física (no de mi gusto):

  G1  E EXACTO             analítico vs diferencias finitas ultra-finas       → ~1e-7
  G2  GAUSS EN LOS NÚCLEOS ∮E·dA = 4π·Q_enc en esferitas alrededor de cada núcleo
  G3  NEUTRALIDAD          ∮E·dA en una esfera grande = 0 (la molécula es neutra)
  G4  TRAZADOR             ψ = Σqᵢcosθᵢ (invariante exacto de cargas en un eje) —
                           Euler paso fijo vs RK4 paso fijo vs Cash–Karp adaptativo
  G5  TUBO DE FLUJO        dΦ/ds = −4πρ_e A  sobre la molécula REAL  ← el que decide
  G6  SIEMBRA              ∮_Σ E·n̂ dA por mi cuadratura de rayos  vs  4π·Q_enc(Σ)
                           con Q_enc de una cuadratura molecular independiente (Becke)

  python3 scripts/campo-gate.py [--png <dir>]
"""
import os, sys, json
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from campo_lineas import (CampoMEP, trazar, trazar_bidireccional, superficie_molecular,
                          sembrar_por_flujo, flujo_esfera, carga_encerrada, tubo_de_flujo,
                          _fibonacci, RHO_SUP, MOTIVO)

PNG = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else '/tmp/campo-gate'
HERE = os.path.dirname(os.path.abspath(__file__))
GEOM = os.path.join(HERE, '..', 'public', 'precomputed', 'water-trimer-geom.json')
os.makedirs(PNG, exist_ok=True)
OK = True


def titulo(t):
    print("\n" + "═" * 78); print(t); print("═" * 78, flush=True)


def veredicto(nombre, cond, detalle=""):
    global OK
    OK &= bool(cond)
    print(f"   {'✅' if cond else '❌'} {nombre}  {detalle}", flush=True)


# ═════════════════════════════ molécula de prueba ═════════════════════════════
from pyscf import gto, scf
G = np.array(json.load(open(GEOM))['xyz_A'])
Zs = [8, 1, 1] * 3
mol = gto.M(atom=[[Zs[i], tuple(G[i])] for i in range(9)], basis='cc-pvdz', unit='Angstrom', verbose=0)
mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
campo = CampoMEP(mol, mf.make_rdm1())
print(f"trímero de agua · cc-pVDZ · {mol.nao} funciones · E = {mf.e_tot:.6f} Ha")

# ═════════════════════════════ G1 · campo exacto ═════════════════════════════
titulo("G1 · ¿EL CAMPO ES EXACTO?   (analítico vs diferencias finitas)")
rng = np.random.default_rng(11)
P = rng.normal(0, 3.2, (300, 3))
Ea = campo(P)
for h in (0.03, 2e-4):
    Efd = np.zeros_like(P)
    for ax in range(3):
        d = np.zeros(3); d[ax] = h
        Efd[:, ax] = -(campo.potencial(P + d) - campo.potencial(P - d)) / (2 * h)
    e = np.linalg.norm(Ea - Efd, axis=1) / np.maximum(np.linalg.norm(Ea, axis=1), 1e-12)
    print(f"   dif.finitas h={h:<7g} → error rel. mediana {np.median(e):.2e}  p95 {np.percentile(e,95):.2e}  max {e.max():.2e}")
    if h == 2e-4:
        veredicto("campo analítico EXACTO", e.max() < 1e-5, f"(max {e.max():.1e}; el residuo es error de LAS DIFERENCIAS)")
    else:
        print(f"      ↑ esto es lo que metía el código viejo: hasta {e.max()*100:.2f}% de error en cada paso")

# ═════════════════════════════ G2 · Gauss en los núcleos ═════════════════════════════
titulo("G2 · LEY DE GAUSS EN CADA NÚCLEO   ∮E·dA / 4π  =  Q encerrada")
print("   núcleo   radio    ∮E·dA/4π      Z−∫ρ (indep.)    error")
peor = 0.0
for A in (0, 1, 3, 4):
    a = 0.55
    F = flujo_esfera(campo, campo.R[A], a, n_dir=3000) / (4 * np.pi)
    Q, Zin, Ne = carga_encerrada(campo, campo.R[A], a)
    err = abs(F - Q) / max(abs(Q), 1e-9); peor = max(peor, err)
    print(f"   {'O' if A % 3 == 0 else 'H'}{A:<6d} {a:.2f}   {F:+10.5f}    {Q:+10.5f}       {err:.2e}")
veredicto("Gauss se cumple en los núcleos", peor < 5e-3, f"(peor error {peor:.1e})")

# ═════════════════════════════ G3 · neutralidad ═════════════════════════════
titulo("G3 · NEUTRALIDAD   ∮E·dA en una esfera grande = 0  ⇒  NINGUNA línea escapa")
for Rb in (12.0, 16.0):
    F = flujo_esfera(campo, [0, 0, 0], Rb, n_dir=4000) / (4 * np.pi)
    Q, _, Ne = carga_encerrada(campo, [0, 0, 0], Rb, n_rad=90, n_dir=1200)
    print(f"   R={Rb:4.1f} bohr → ∮E·dA/4π = {F:+.5f}   (Z−∫ρ = {Q:+.5f}, electrones dentro {Ne:.4f}/30)")
veredicto("la molécula es neutra vista de lejos", abs(F) < 0.05,
          f"(flujo {F:+.4f} ⇒ toda línea que sale, regresa)")

# ═════════════════════════════ G4 · trazador ═════════════════════════════
titulo("G4 · EL TRAZADOR   ψ = Σqᵢcosθᵢ es EXACTAMENTE constante sobre una línea")
print("   (invariante válido para cargas puntuales SOBRE UN EJE — Euler vs RK4 vs adaptativo)")


class CampoPuntual:
    def __init__(self, q, c):
        self.q = np.asarray(q, float); self.R = np.asarray(c, float); self.Z = self.q
        self.n_eval = 0
    def __call__(self, P):
        P = np.asarray(P, float).reshape(-1, 3); self.n_eval += len(P)
        d = P[:, None, :] - self.R[None]
        r = np.maximum(np.linalg.norm(d, axis=2), 1e-12)
        return (self.q[None, :, None] * d / (r ** 3)[:, :, None]).sum(axis=1)
    def psi(self, P):
        d = np.asarray(P, float).reshape(-1, 3)[:, None, :] - self.R[None]
        r = np.maximum(np.linalg.norm(d, axis=2), 1e-12)
        return (self.q[None, :] * d[:, :, 2] / r).sum(axis=1)


def fijo(cp, seed, h, orden, n=4000, rstop=0.06, rmax=30.0):
    def u(x):
        E = cp(x[None])[0]; nn = np.linalg.norm(E)
        return E / nn if nn > 1e-13 else None
    p = seed.copy(); path = [p.copy()]
    for _ in range(n):
        k1 = u(p)
        if k1 is None: break
        if orden == 4:
            k2 = u(p + .5 * h * k1); k3 = u(p + .5 * h * k2) if k2 is not None else None
            k4 = u(p + h * k3) if k3 is not None else None
            if k2 is None or k3 is None or k4 is None: break
            p = p + (h / 6.) * (k1 + 2 * k2 + 2 * k3 + k4)
        else:
            p = p + h * k1
        if np.linalg.norm(p) > rmax: break
        if np.min(np.linalg.norm(p[None] - cp.R, axis=1)) < rstop: break
        path.append(p.copy())
    return np.array(path)


casos = {
    'dipolo':     ([1., -1.], [[0, 0, .5], [0, 0, -.5]]),
    'cuadrupolo': ([1., -2., 1.], [[0, 0, 1.], [0, 0, 0.], [0, 0, -1.]]),
    'cadena 8':   (list(np.where(np.arange(8) % 2, -1., 1.)), [[0, 0, i * .55 - 1.9] for i in range(8)]),
}
print(f"\n   {'caso':<12} {'Euler h=.02':>12} {'RK4 h=.02':>12} {'ADAPTATIVO':>12}   {'evals ad.':>10}")
peor_ad = 0.0
for nom, (q, c) in casos.items():
    cp = CampoPuntual(q, c)
    derivas = {}
    for etq in ('euler', 'rk4', 'adap'):
        dd = []
        for th0 in (0.35, 0.7, 1.05, 1.4, 1.75, 2.1):
            s = cp.R[0] + 0.10 * np.array([np.sin(th0), 0, np.cos(th0)])
            if etq == 'adap':
                cp.n_eval = 0
                SP, SS, nm, mot = trazar(cp, s[None], sentido=+1, tol=3e-4, hmax=0.55,
                                         r_core=0.06, r_caja=30.0, s_max=60.0,
                                         e_min=1e-9, nucleos=cp.R, max_pasos=900)
                L = SP[0, :int(nm[0])]
                ev = cp.n_eval
            else:
                L = fijo(cp, s, 0.02, 4 if etq == 'rk4' else 1)
            if len(L) < 5: continue
            ps = cp.psi(L)
            dd.append(np.abs(ps - ps[0]).max())
        derivas[etq] = max(dd) if dd else np.nan
    peor_ad = max(peor_ad, derivas['adap'])
    print(f"   {nom:<12} {derivas['euler']:12.2e} {derivas['rk4']:12.2e} {derivas['adap']:12.2e}   {ev:10d}")
veredicto("el trazador adaptativo conserva el flujo", peor_ad < 1e-5, f"(peor deriva {peor_ad:.1e})")

# ═════════════════════════════ G5 · TUBO DE FLUJO ═════════════════════════════
titulo("G5 · TUBO DE FLUJO SOBRE LA MOLÉCULA REAL   ← EL GATE QUE DECIDE")
print("   Tres líneas vecinas forman un tubo. Gauss obliga:  dΦ/ds = −4π ρ_e A")
print("   ⇒  Φ(s) + 4π∫ρ_e A ds'  debe ser CONSTANTE. El tubo se encoge EXACTAMENTE en la")
print("   carga electrónica que se traga. Un dibujo bonito no cumple esto.\n")
Hs = [1, 2, 4, 5, 7, 8]
tubos = []
for hidx in Hs[:4]:
    Rh = campo.R[hidx]; Ro = campo.R[3 * (hidx // 3)]
    dirs = Rh - Ro; dirs /= np.linalg.norm(dirs)
    x0 = Rh + 1.05 * dirs
    t = tubo_de_flujo(campo, x0, eps=0.02, tol=1e-4, hmax=0.35, r_core=0.22,
                      r_caja=15.0, s_max=22.0, e_min=3e-4, max_pasos=700)
    if t is None: continue
    tubos.append((hidx, t))
    print(f"   tubo desde H{hidx}: largo {t['s'][-1]:5.2f} bohr · Φ cae {t['caida']*100:5.1f} % "
          f"(se traga {t['carga'][-1]:.4f} e⁻) · residuo del invariante {t['residuo']:.2e}  [{MOTIVO[t['motivo']]}]")
peor_t = max(t['residuo'] for _, t in tubos) if tubos else 1.0
veredicto("el tubo obedece a Gauss", peor_t < 0.05, f"(peor residuo {peor_t*100:.2f} %)")

# ═════════════════════════════ G6 · siembra por flujo ═════════════════════════════
titulo("G6 · LA SIEMBRA CARGA FLUJO IGUAL   ∮_Σ E·n̂ dA (mis rayos) vs 4π·Q_enc(Σ)")
sup = superficie_molecular(campo, n_dir=1200)
idx, Phi0, info = sembrar_por_flujo(campo, sup, 1100)
print(f"   superficie ρ={RHO_SUP} u.a.: {len(sup['x'])} rayos tocan la envolvente "
      f"(rayos rasantes recortados: {sup['clamp']*100:.1f} %)")
print(f"   área total Σ w·dA = {(sup['dA']*sup['w']).sum():.1f} bohr²")
# carga encerrada por Σ con una cuadratura molecular INDEPENDIENTE (Becke, PySCF)
from pyscf import dft
gr = dft.gen_grid.Grids(mol); gr.level = 5; gr.build()
rho_g = campo.rho(gr.coords)
Ne_in = float((gr.weights * rho_g * (rho_g >= RHO_SUP)).sum())
Ne_tot = float((gr.weights * rho_g).sum())
Q_sigma = float(campo.Z.sum()) - Ne_in
print(f"   electrones: {Ne_tot:.4f} en total (deben ser 30) · {Ne_in:.4f} dentro de Σ "
      f"⇒ Q_enc(Σ) = {Q_sigma:+.4f} e")
esperado = 4 * np.pi * Q_sigma
print(f"   ∮_Σ E·n̂ dA  = {info['flujo_neto']:+.4f}     (Gauss dice 4π·Q_enc = {esperado:+.4f})")
err6 = abs(info['flujo_neto'] - esperado) / max(abs(esperado), 1e-9)
print(f"   flujo BRUTO ∮|E·n̂| dA = {info['flujo_bruto']:.4f}  ⇒  Φ₀ = {Phi0:.3e} por línea")
print(f"   semillas elegidas: {len(idx)} · duplicadas: {info['duplicados']}")
veredicto("la cuadratura de siembra respeta Gauss", err6 < 0.20, f"(error {err6*100:.1f} %)")

# ═════════════════════════════ figuras ═════════════════════════════
try:
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, 3, figsize=(16.5, 5.2), facecolor='#0a0a0e')
    ax = axes[0]
    for hidx, t in tubos:
        ax.plot(t['s'], t['Phi'] / t['Phi'][0], lw=1.8, label=f'H{hidx}')
        ax.plot(t['s'], t['invariante'] / t['invariante'][0], '--', lw=1.2, color='#00e0a0')
    ax.set_title('TUBO DE FLUJO\nsólido: Φ(s)/Φ(0) cae — verde: Φ+4π∫ρA es CONSTANTE',
                 color='white', fontsize=10)
    ax.set_xlabel('arco s (bohr)', color='#888'); ax.legend(fontsize=7, labelcolor='white',
                  facecolor='#0a0a0e', edgecolor='#333')
    ax = axes[1]
    for hidx, t in tubos:
        ax.semilogy(t['s'], np.maximum(np.abs(t['invariante'] / t['invariante'][0] - 1), 1e-12), lw=1.5)
    ax.axhline(0.05, color='#ff3b30', ls=':', lw=1.2)
    ax.set_title('residuo del invariante de Gauss\n(línea roja = 5 %)', color='white', fontsize=10)
    ax.set_xlabel('arco s (bohr)', color='#888')
    ax = axes[2]
    En = info['En']
    sc = ax.scatter(sup['x'][:, 0], sup['x'][:, 1], c=np.clip(En, -0.12, 0.12), s=3,
                    cmap='coolwarm_r')
    ax.scatter(sup['x'][idx, 0], sup['x'][idx, 1], s=1.2, c='#00e0a0', alpha=0.5)
    ax.set_aspect('equal')
    ax.set_title('superficie molecular ρ=0.002 · color = E·n̂\nverde = las 1100 semillas por flujo',
                 color='white', fontsize=10)
    plt.colorbar(sc, ax=ax, fraction=0.04)
    for a in axes:
        a.set_facecolor('#0a0a0e'); a.tick_params(colors='#777', labelsize=7); a.grid(alpha=0.10, color='white')
        for sp in a.spines.values(): sp.set_color('#333')
    plt.tight_layout()
    f = os.path.join(PNG, 'GATES-campo.png')
    plt.savefig(f, dpi=125, facecolor='#0a0a0e'); plt.close()
    print(f"\n   → {f}")
except Exception as e:
    print("  (sin figuras:", e, ")")

print("\n" + "═" * 78)
print("✅ TODOS LOS GATES OK — el campo cumple las leyes" if OK else "❌ HAY GATES EN FALLA")
print("═" * 78)
sys.exit(0 if OK else 1)
