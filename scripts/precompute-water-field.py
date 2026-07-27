#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-water-field.py — el AGUA que INTERACTÚA: campo eléctrico REAL + puente
de hidrógeno entre moléculas. Es la propiedad que define al agua (por qué se pega
a sí misma, por qué hay mares, por qué el hielo flota).

Modos:
  single — UNA molécula de agua + su campo eléctrico (dipolo: líneas del δ+ H al δ− O)
  dimer  — DOS moléculas unidas por PUENTE DE HIDRÓGENO: el δ+ H de una jala al δ− O
           de la otra. Δρ de interacción = la carga que se REACOMODA al pegarse (el
           puente naciendo). Campo eléctrico que CONECTA las dos.

Verificación (dimer): energía de enlace del puente ≈ −5 kcal/mol (experimental
−3.2 a −5.4; RHF da ~−4 a −6 sin corrección). Geometría del dímero: literatura.

Salida:  public/precomputed/water-<modo>.bin  (partículas ρ + líneas de campo)
         _o2_proof/water-<modo>.png  (figura para verificar a ojo)

Paralelo: OMP a los cores. Correr en iangpu, background.
Uso:  OMP_NUM_THREADS=16 python3 scripts/precompute-water-field.py dimer [quick]
"""
import os, sys, struct
import numpy as np

BOHR = 0.52917721067
HART2KCAL = 627.509

MODE = (sys.argv[1] if len(sys.argv) > 1 else 'dimer').lower()
QUICK = 'quick' in sys.argv
BASIS = 'cc-pvtz'

# ── geometrías (Å) ───────────────────────────────────────────────────────────
# monómero estándar: O-H 0.9578 Å, HOH 104.478°
def water_monomer():
    d = 0.9578; a = np.radians(104.478 / 2)
    return [['O', (0.0, 0.0, 0.0)],
            ['H', (d * np.sin(a),  d * np.cos(a), 0.0)],
            ['H', (-d * np.sin(a), d * np.cos(a), 0.0)]]

# dímero de agua (Cs, geometría de literatura MP2/aug-cc-pVTZ, Å). O···O ≈ 2.91 Å.
# donante = molécula 1 (un H apunta al O aceptor); aceptor = molécula 2.
DIMER = [
    ['O', (-1.551007, -0.114520,  0.000000)],   # O donante
    ['H', (-1.934259,  0.762503,  0.000000)],   # H libre del donante
    ['H', (-0.599677,  0.040712,  0.000000)],   # H del PUENTE → apunta al O aceptor
    ['O', ( 1.350625,  0.111469,  0.000000)],   # O aceptor (recibe el puente en su par libre)
    ['H', ( 1.680398, -0.373741, -0.758561)],
    ['H', ( 1.680398, -0.373741,  0.758561)],
]

# hexámero CÍCLICO (6 aguas en anillo, homodromo: cada O dona 1 puente a la siguiente
# y acepta de la anterior). ES por qué el hielo es HEXAGONAL y el copo tiene 6 puntas.
def water_hexamer():
    dOH = 0.9578; roo = 2.80; ang = np.radians(104.478)
    P = [np.array([roo * np.cos(i * np.pi / 3), roo * np.sin(i * np.pi / 3), 0.0]) for i in range(6)]
    atoms = []
    for i in range(6):
        Pi = P[i]; Pn = P[(i + 1) % 6]
        b = (Pn - Pi); b = b / np.linalg.norm(b)                 # dirección del puente O_i→O_{i+1}
        Hb = Pi + dOH * b                                        # H puente (apunta al O vecino)
        n = np.array([0., 0., 1.]) - np.dot([0., 0., 1.], b) * b; n = n / np.linalg.norm(n)
        f = np.cos(ang) * b + np.sin(ang) * n                    # H libre a 104.5°, hacia arriba
        Hf = Pi + dOH * f
        atoms += [['O', tuple(Pi)], ['H', tuple(Hb)], ['H', tuple(Hf)]]
    return atoms

if MODE == 'single':
    ATOMS = water_monomer(); NW = 1
elif MODE == 'dimer':
    ATOMS = DIMER; NW = 2
elif MODE == 'hexamer':
    ATOMS = water_hexamer(); NW = 6; BASIS = 'cc-pvdz'          # 6 aguas: base más ligera (viz)
else:
    sys.exit(f"modo desconocido: {MODE} (single|dimer|hexamer)")

# ── caja de muestreo (bohr) que cubre la(s) molécula(s) ──────────────────────
coords_bohr = np.array([np.array(a[1]) / BOHR for a in ATOMS])
cen = coords_bohr.mean(axis=0)
span = (coords_bohr.max(axis=0) - coords_bohr.min(axis=0))
L = np.array([max(4.5, span[0] / 2 + 4.0), max(4.5, span[1] / 2 + 4.0), max(4.0, span[2] / 2 + 3.5)])
NG = 48 if QUICK else 72
N_DENS = 8000 if QUICK else 30000
POSQ = 2000
SEED = 20260722

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', f'water-{MODE}.bin')


def make_grid(NG, L, cen):
    axes = [np.linspace(cen[i] - L[i], cen[i] + L[i], NG) for i in range(3)]
    GX, GY, GZ = np.meshgrid(axes[0], axes[1], axes[2], indexing='ij')
    pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
    d = [(axes[i][1] - axes[i][0]) for i in range(3)]
    return pts, axes, d


def eval_rho(mol, dm, pts, chunk=40000):
    out = np.empty(pts.shape[0])
    for a in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[a:a + chunk])
        out[a:a + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return out


def esp(mol, dm, pts, chunk=2000):
    """Potencial electrostático V(r) = Σ Z/|r-R| − ∫ρ/|r-r'|  (MEP real).
    Nuclear analítico + electrónico via int1e_grids (como precompute-bond-efield)."""
    Zs = mol.atom_charges(); R = mol.atom_coords()
    V = np.zeros(pts.shape[0])
    for a in range(0, pts.shape[0], chunk):
        p = pts[a:a + chunk]
        # nuclear
        diff = p[:, None, :] - R[None, :, :]
        dist = np.linalg.norm(diff, axis=2) + 1e-12
        Vn = (Zs[None, :] / dist).sum(axis=1)
        # electrónico: -Σ_ij D_ij ∫ φ_i φ_j /|r-r'|
        fakemol = mol.copy()
        Vel = np.einsum('ij,gij->g', dm, mol.intor('int1e_grids', grids=p))
        V[a:a + chunk] = Vn + Vel
    return V


def trace_field(mol, dm, seeds, axes, d, L, cen, nsteps=220, h=0.10):
    """Traza líneas de campo E = -∇V por RK2, del + al − (bidireccional). El campo
    se evalúa por diferencias finitas del MEP en cada punto. Para en núcleos/bordes."""
    R = mol.atom_coords(); Zs = mol.atom_charges()

    def field(P):  # E = -grad V, por diferencias centradas
        eps = 0.06
        E = np.zeros_like(P)
        for ax in range(3):
            dp = np.zeros(3); dp[ax] = eps
            Vp = esp(mol, dm, P + dp); Vm = esp(mol, dm, P - dp)
            E[:, ax] = -(Vp - Vm) / (2 * eps)
        return E

    lines = []
    lo = cen - L; hi = cen + L
    for s in seeds:
        for direction in (1.0, -1.0):
            path = [s.copy()]; P = s.copy().reshape(1, 3)
            for _ in range(nsteps):
                E = field(P)[0]; n = np.linalg.norm(E)
                if n < 1e-6: break
                step = direction * h * E / n
                P = P + step
                pt = P[0]
                if np.any(pt < lo) or np.any(pt > hi): break
                if np.min(np.linalg.norm(R - pt, axis=1)) < 0.25: break   # llegó a un núcleo
                path.append(pt.copy())
            if len(path) > 6:
                lines.append(np.array(path))
    return lines


def resample(path, LP):
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
    if d[-1] < 1e-9: return np.tile(path[0], (LP, 1))
    u = np.linspace(0, d[-1], LP)
    return np.stack([np.interp(u, d, path[:, i]) for i in range(3)], axis=1)


def main():
    from pyscf import gto, scf
    print(f"=== AGUA {MODE.upper()} ({NW} molécula(s))  {BASIS}  malla {NG}³ ===", flush=True)
    mol = gto.M(atom=ATOMS, basis=BASIS, verbose=0)
    mf = scf.RHF(mol); mf.level_shift = 0.1; mf.max_cycle = 200; mf.kernel()
    if not mf.converged:
        mf = scf.newton(scf.RHF(mol)); mf.kernel()
    dm = mf.make_rdm1()
    print(f"E(total) = {mf.e_tot:.6f} Ha", flush=True)

    # energía del PUENTE (dimer): E(dímero) − 2·E(monómero aislado a su geometría)
    if MODE == 'dimer':
        m1 = gto.M(atom=ATOMS[:3], basis=BASIS, verbose=0); e1 = scf.RHF(m1).kernel()
        m2 = gto.M(atom=ATOMS[3:], basis=BASIS, verbose=0); e2 = scf.RHF(m2).kernel()
        ebind = (mf.e_tot - e1 - e2) * HART2KCAL
        print(f"── PUENTE DE HIDRÓGENO ──", flush=True)
        print(f"  E_enlace = {ebind:.2f} kcal/mol  ·  experimental ≈ −5 kcal/mol", flush=True)
        gate = -8.0 < ebind < -2.0
        print("  GATE_OK" if gate else "  GATE_FAIL", flush=True)

    pts, axes, d = make_grid(NG, L, cen)

    # densidad para partículas: dimer → Δρ de INTERACCIÓN (el puente); single → ρ total tenue
    rho = eval_rho(mol, dm, pts).reshape(NG, NG, NG)
    # NUBE = densidad TOTAL (dos moléculas de agua LLENAS y densas que se extienden al
    # centro y lo LLENAN — el gancho hermoso, sin hueco muerto). El puente sutil (Δρ de
    # interacción) va como HIGHLIGHT azul encima. rho^0.8 comprime el pico nuclear.
    rng = np.random.default_rng(SEED)
    acc = np.power(np.maximum(rho, 0), 0.8)
    if MODE == 'dimer':
        rho1 = eval_rho(m1, m1.RHF().run(verbose=0).make_rdm1(), pts).reshape(NG, NG, NG)
        rho2 = eval_rho(m2, m2.RHF().run(verbose=0).make_rdm1(), pts).reshape(NG, NG, NG)
        dep = np.maximum(-(rho - rho1 - rho2), 0)   # Δρ neg = la interacción del puente (highlight)
    else:
        dep = np.zeros_like(rho)

    def sample(fld, n):
        f = fld.ravel(); tot = f.sum()
        if tot <= 0: return np.zeros((n, 3))
        idx = rng.choice(len(f), size=n, p=f / tot)
        ijk = np.array(np.unravel_index(idx, (NG, NG, NG))).T
        jit = (rng.random((n, 3)) - 0.5)
        return np.stack([axes[a][ijk[:, a]] + jit[:, a] * d[a] for a in range(3)], axis=1)

    accPos = sample(acc, N_DENS)
    depPos = sample(dep, N_DENS // 2) if MODE == 'dimer' else np.zeros((0, 3))

    # ── CAMPO ELÉCTRICO: seeds en los H PUENTE (δ+, apuntan al O vecino) → la línea
    # traza del δ+ al δ− vecino = el PUENTE. En el hexámero eso da la RED hexagonal
    # limpia (no el fan caótico de todos los H). Puente = 1er H de cada agua (idx%3==1).
    R = mol.atom_coords()
    if MODE == 'hexamer':
        H_idx = [i for i in range(len(ATOMS)) if i % 3 == 1]     # solo los H puente
        rings, phis = (0.30, 0.48), np.linspace(0, 2 * np.pi, 8, endpoint=False)
    else:
        H_idx = [i for i, a in enumerate(ATOMS) if a[0] == 'H']
        rings, phis = (0.5, 1.2), np.linspace(0, 2 * np.pi, 6, endpoint=False)
    seeds = []
    for i in H_idx:
        c = R[i]
        for th in phis:
            for ph in rings:
                seeds.append(c + 0.45 * np.array([np.sin(ph) * np.cos(th), np.sin(ph) * np.sin(th), np.cos(ph)]))
    seeds = np.array(seeds)
    print(f"trazando {len(seeds)*2} líneas de campo…", flush=True)
    LP = 48
    lines = trace_field(mol, dm, seeds, axes, d, L, cen)
    print(f"  {len(lines)} líneas trazadas", flush=True)
    field_lines = np.array([resample(ln - cen, LP) for ln in lines]) if lines else np.zeros((0, LP, 3))

    # ── escribir bin ──
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    NL = field_lines.shape[0]
    NA = len(ATOMS)
    # núcleos: Z (int16) + xyz relativo a cen (int16 ×POSQ) — el engine los dibuja
    nucZ = np.array([1 if a[0] == 'H' else 8 for a in ATOMS], dtype='<i2')
    nucXYZ = np.clip(np.round((coords_bohr - cen) * POSQ), -32767, 32767).astype('<i2')
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<5i', accPos.shape[0], depPos.shape[0], NL, LP, NA))
        fp.write(np.clip(np.round((accPos - cen) * POSQ), -32767, 32767).astype('<i2').tobytes())
        if depPos.shape[0]:
            fp.write(np.clip(np.round((depPos - cen) * POSQ), -32767, 32767).astype('<i2').tobytes())
        if NL:
            fp.write(np.clip(np.round(field_lines * POSQ), -32767, 32767).astype('<i2').tobytes())
        fp.write(nucZ.tobytes()); fp.write(nucXYZ.tobytes())
    print(f"OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB  ({accPos.shape[0]} acc, {depPos.shape[0]} dep, {NL} líneas, {NA} núcleos)", flush=True)

    # ── figura de prueba (plano XY) ──
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(9, 7), facecolor='black'); ax.set_facecolor('black')
        if depPos.shape[0]:
            ax.scatter(depPos[:, 0] - cen[0], depPos[:, 1] - cen[1], s=1, c='#5aa0ff', alpha=0.25)
        ax.scatter(accPos[:, 0] - cen[0], accPos[:, 1] - cen[1], s=1, c='#ffb43c', alpha=0.35)
        for ln in field_lines[:400]:
            ax.plot(ln[:, 0], ln[:, 1], c='#4ff0dc', alpha=0.35, lw=0.7)
        for a in ATOMS:
            p = np.array(a[1]) / BOHR - cen
            ax.scatter([p[0]], [p[1]], s=90 if a[0] == 'O' else 45, c='#3affa0', zorder=5)
        ax.set_aspect('equal'); ax.set_title(f"AGUA {MODE} — Δρ + campo E (plano XY)", color='white')
        fig.tight_layout()
        fp = os.path.join(os.path.dirname(__file__), '..', '_o2_proof', f'water-{MODE}.png')
        os.makedirs(os.path.dirname(fp), exist_ok=True); fig.savefig(fp, dpi=100, facecolor='black')
        print(f"figura: {fp}", flush=True)
    except Exception as e:
        print("fig falló:", e, flush=True)
    print(f"WATER_{MODE.upper()}_LISTO", flush=True)


if __name__ == '__main__':
    main()
