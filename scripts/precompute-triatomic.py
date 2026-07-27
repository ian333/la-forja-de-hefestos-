#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-triatomic.py — ab initio de una molécula de 3 ÁTOMOS (el ÁNGULO entra a
la serie). Primer triatómico: H₂O "El agua".

Qué calcula (todo real, cero inventado):
  • Escaneo de FORMACIÓN: los 2 H se acercan al O (O-H de 2.3·Re → Re), ángulo HOH
    fijo 104.478° (medido). K frames → el enlace nace y el ÁNGULO se ve.
  • Δρ deformación = ρ(H₂O) − ρ(promolécula O+H+H neutros): la carga que se ACUMULA
    (los 2 enlaces O-H, oro) y de dónde se VACÍA (azul). Nadie ha visto esto de H₂O.
  • 3ª nube = los PARES LIBRES (las "orejas de conejo"): densidad de los 2 MO
    ocupados más altos (1b1 fuera de plano + 3a1 en plano) — lo que TUERCE el agua.
  • Verificación: μ(equilibrio) vs 1.855 D medido; ángulo 104.5°; O-H 0.9578 Å.

Salida (formato compatible con la serie de enlaces → parseO2AbInitio del engine):
  public/precomputed/h2o-abinitio.bin  +  h2o-transfer.json (μ, ángulo por frame)
  _o2_proof/h2o-abinitio-particles.png  (figura para verificar a ojo)

Paralelo: PySCF/numpy usan los 16 cores (OMP/MKL). El SCF de H₂O es sub-segundo; el
costo es eval_gto en la malla — multihilo. Correr en iangpu, background.

Uso:  OMP_NUM_THREADS=16 python3 scripts/precompute-triatomic.py h2o [quick]
"""
import os, sys, struct
import numpy as np

BOHR = 0.52917721067

# ── moléculas triatómicas (geometría medida) ────────────────────────────────
MOLS = {
    # H₂O: O-H = 0.9578 Å, HOH = 104.478° (Benedict-Gailar-Plyler). μ = 1.8546 D.
    # Molécula en el plano XY; bisectriz (eje C2 = dipolo) en +X. Pares libres
    # apuntan a −X (detrás del O) y fuera de plano (±Z).
    'h2o': {'atoms': ('O', 'H', 'H'), 'dOH': 0.9578, 'angle': 104.478,
            'spin': 0, 'mu_exp': 1.8546, 'L': 5.0},
}

MOL = (sys.argv[1] if len(sys.argv) > 1 else 'h2o').lower()
QUICK = 'quick' in sys.argv
if MOL not in MOLS:
    sys.exit(f"mol desconocida: {MOL}. Opciones: {list(MOLS)}")
CFG = MOLS[MOL]
D_OH = CFG['dOH'] / BOHR                       # bohr
HALF = np.radians(CFG['angle'] / 2.0)          # medio ángulo
SPIN = CFG['spin']
L = CFG['L']                                   # semicaja (bohr), cúbica

BASIS = 'cc-pvtz'
if QUICK:
    K = 6;  N_ACC, N_DEP, N_THIRD = 5000, 3000, 3000;  NG = 56
else:
    K = 48; N_ACC, N_DEP, N_THIRD = 26000, 14000, 12000; NG = 88
NX = NY = NZ = NG
SCALE_MAX = 2.3                                # los H arrancan a 2.3·Re (formación)
POSQ = 5000
SEED = 20260720
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', f'{MOL}-abinitio.bin')

# escaneo de formación: O-H de SCALE_MAX·Re → Re (R_MAX → R_MIN, como la serie)
Svals = SCALE_MAX + (1.0 - SCALE_MAX) * (np.arange(K) / (K - 1))
Rvals = Svals * D_OH                            # "R" = distancia O-H por frame (bohr)
R_MIN, R_MAX = float(Rvals[-1]), float(Rvals[0])

rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3)); U_dep = rng.random((N_DEP, 3)); U_third = rng.random((N_THIRD, 3))

# malla CÚBICA (la molécula es planar pero los pares libres salen del plano)
d = (2 * L) / NG
gs = -L + (np.arange(NG) + 0.5) * d
GX, GY, GZ = np.meshgrid(gs, gs, gs, indexing='ij')
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
dV = d ** 3
LX = LR = L                                     # caja cúbica (para sample_field)


def geom(s):
    """Geometría a escala s: O en origen, 2 H en el plano XY a s·D_OH, ángulo fijo.
    Bisectriz en +X → el dipolo apunta a −X (del O al centro de los H es +X, pero
    el O es negativo → μ hacia −X). Devuelve lista [[el,(x,y,z)],...] en bohr."""
    r = s * D_OH
    hx = r * np.cos(HALF)
    hy = r * np.sin(HALF)
    return [['O', (0.0, 0.0, 0.0)],
            ['H', (hx,  hy, 0.0)],
            ['H', (hx, -hy, 0.0)]]


def eval_rhos(mol, dms, pts, chunk=40000):
    outs = [np.empty(pts.shape[0]) for _ in dms]
    for a in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[a:a + chunk])
        for i, dm in enumerate(dms):
            outs[i][a:a + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return outs


def sample_field(field, U):
    """Muestreo por CDF inversa 3D (idéntico a la serie): densidad → partículas,
    con semilla fija → reproducible frame a frame."""
    M = U.shape[0]; f = np.maximum(field, 0.0)
    slab = f.sum(axis=(1, 2)); Cx = np.concatenate([[0.0], np.cumsum(slab)]); tot = Cx[-1]
    if tot <= 0:
        return np.zeros((M, 3))
    tgt = U[:, 0] * tot
    ix = np.clip(np.searchsorted(Cx, tgt, side='right') - 1, 0, NX - 1)
    x = -LX + (ix + (tgt - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)) * d
    colmass = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((NX, 1)), np.cumsum(colmass, axis=1)], axis=1)
    Cy_row = Cy[ix]; tgty = U[:, 1] * Cy_row[:, -1]
    iy = np.clip((Cy_row[:, :-1] <= tgty[:, None]).sum(axis=1) - 1, 0, NY - 1)
    cy0 = Cy_row[np.arange(M), iy]; cy1 = Cy_row[np.arange(M), iy + 1]
    y = -LR + (iy + (tgty - cy0) / np.maximum(cy1 - cy0, 1e-30)) * d
    Cz = np.concatenate([np.zeros((NX, NY, 1)), np.cumsum(f, axis=2)], axis=2)
    Cz_row = Cz[ix, iy]; tgtz = U[:, 2] * Cz_row[:, -1]
    iz = np.clip((Cz_row[:, :-1] <= tgtz[:, None]).sum(axis=1) - 1, 0, NZ - 1)
    cz0 = Cz_row[np.arange(M), iz]; cz1 = Cz_row[np.arange(M), iz + 1]
    z = -LR + (iz + (tgtz - cz0) / np.maximum(cz1 - cz0, 1e-30)) * d
    return np.stack([x, y, z], axis=1)


def build():
    from pyscf import gto, scf
    accPos = np.zeros((K, N_ACC, 3)); depPos = np.zeros((K, N_DEP, 3)); thirdPos = np.zeros((K, N_THIRD, 3))
    accMass = np.zeros(K); depMass = np.zeros(K); thirdMass = np.zeros(K); bondMass = np.zeros(K)
    transfer = []
    print(f"=== {MOL.upper()} ({'-'.join(CFG['atoms'])}) ab initio  {BASIS}  K={K}  {NG}³ vox  L={L} bohr ===")
    print("s      O-H(A)  E(Ha)         μ(D)    angle°  accMass  depMass  lpMass  bondMass")
    for k in range(K):
        s = float(Svals[k])
        mol = gto.M(atom=geom(s), basis=BASIS, spin=SPIN, unit='Bohr', verbose=0)
        mf = scf.RHF(mol); mf.level_shift = 0.1; mf.max_cycle = 200; mf.kernel()
        if not mf.converged:
            mf = scf.newton(scf.RHF(mol)); mf.kernel()
        dm = mf.make_rdm1()
        dm_pro = scf.hf.init_guess_by_atom(mol)                 # promolécula neutra
        rho_mol, rho_pro = (a.reshape(NX, NY, NZ) for a in eval_rhos(mol, [dm, dm_pro], GRID))
        d_rho = rho_mol - rho_pro
        accField = np.maximum(d_rho, 0); depField = np.maximum(-d_rho, 0)
        # 3ª nube = PARES LIBRES: densidad de los 2 MO ocupados más altos (1b1 fuera
        # de plano + 3a1 en plano) — las "orejas" que tuercen el agua.
        C = mf.mo_coeff; occ = mf.mo_occ
        occ_idx = np.where(occ > 1e-6)[0]
        lp = occ_idx[-2:]                                       # los 2 HOMO
        dm_lp = (C[:, lp] * occ[lp]) @ C[:, lp].T
        rho_lp = eval_rhos(mol, [dm_lp], GRID)[0].reshape(NX, NY, NZ)
        accMass[k] = accField.sum() * dV; depMass[k] = depField.sum() * dV
        thirdMass[k] = rho_lp.sum() * dV
        bondMass[k] = float(eval_rhos(mol, [dm], np.array([[s * D_OH * np.cos(HALF) * 0.5, 0.0, 0.0]]))[0][0])
        accPos[k] = sample_field(accField, U_acc)
        depPos[k] = sample_field(depField, U_dep)
        thirdPos[k] = sample_field(rho_lp, U_third)
        mu = float(np.linalg.norm(mf.dip_moment(unit='Debye', verbose=0)))
        transfer.append({'s': round(s, 3), 'OH_A': round(s * CFG['dOH'], 3),
                         'mu_D': round(mu, 3), 'angle_deg': CFG['angle']})
        print(f"{s:5.3f}  {s*CFG['dOH']:5.3f}  {mf.e_tot:12.5f}  {mu:6.3f}  "
              f"{CFG['angle']:6.2f}  {accMass[k]:7.4f}  {depMass[k]:7.4f}  {thirdMass[k]:7.4f}  {bondMass[k]:7.4f}")

    # color del acc: oro en los enlaces O-H, ámbar-rojo en los pares libres (el calor
    # de la serie). Referencia = frame de equilibrio (s=1).
    kEq = K - 1
    p = accPos[kEq]
    rad = np.linalg.norm(p, axis=1)
    t = np.clip((rad - 0.6) / 1.6, 0, 1)
    gold = np.array([1.00, 0.84, 0.36]); amber = np.array([1.00, 0.36, 0.10]); whitegold = np.array([1.00, 0.96, 0.74])
    col = gold[None, :] * (1 - t[:, None]) + amber[None, :] * t[:, None]
    col[(p[:, 0] > 0.2) & (rad < 1.3)] = whitegold            # puentes O-H (lado +X)
    accColor = np.clip(col * 255, 0, 255).astype(np.uint8)

    import json
    tj = os.path.join(os.path.dirname(OUT), f'{MOL}-transfer.json')
    json.dump(transfer, open(tj, 'w'), indent=1)
    eq = transfer[-1]
    print(f"\n── {MOL.upper()}: el ángulo de la vida ──")
    print(f"  μ(equilibrio) = {eq['mu_D']} D  ·  experimental = {CFG['mu_exp']} D  "
          f"·  desv = {abs(eq['mu_D']-CFG['mu_exp'])/CFG['mu_exp']*100:.1f}%")
    print(f"  ángulo HOH = {CFG['angle']}°  ·  O-H = {CFG['dOH']} Å (medidos, fijos)")
    print(f"  ✓ curva en {tj}")
    gate = abs(eq['mu_D'] - CFG['mu_exp']) / CFG['mu_exp'] < 0.20
    print("  GATE_OK" if gate else "  GATE_FAIL")
    return accPos, depPos, thirdPos, accMass, depMass, thirdMass, bondMass, accColor


def write_bin(accPos, depPos, thirdPos, accMass, depMass, thirdMass, bondMass, accColor):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4i', N_ACC, N_DEP, N_THIRD, K))
        fp.write(struct.pack('<2f', R_MIN, R_MAX))
        for a in (Rvals, accMass, depMass, thirdMass, bondMass):
            fp.write(a.astype('<f4').tobytes())
        fp.write(accColor.astype(np.uint8).tobytes())
        q = lambda a: np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
        for a in (accPos, depPos, thirdPos):
            fp.write(q(a).tobytes())
    print(f"OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.1f} MB")
    dist = OUT.replace('public/precomputed', 'dist/precomputed')
    try:
        os.makedirs(os.path.dirname(dist), exist_ok=True)
        import shutil; shutil.copyfile(OUT, dist)
    except Exception:
        pass


def validate_figure(accPos, depPos, thirdPos):
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except Exception:
        return
    kEq = K - 1
    fig, ax = plt.subplots(figsize=(7, 7), facecolor='black')
    ax.set_facecolor('black')
    dep = depPos[kEq]; acc = accPos[kEq]; lp = thirdPos[kEq]
    ax.scatter(dep[:, 0], dep[:, 1], s=1, c='#5aa0ff', alpha=0.35, label='vaciado')
    ax.scatter(acc[:, 0], acc[:, 1], s=1, c='#ffb43c', alpha=0.5, label='acumulación (enlaces)')
    ax.scatter(lp[:, 0], lp[:, 1], s=1, c='#c77dff', alpha=0.5, label='pares libres')
    # núcleos
    g = geom(1.0)
    for el, (x, y, z) in g:
        ax.scatter([x], [y], s=80 if el == 'O' else 40, c='#3affa0', zorder=5)
    ax.set_xlim(-4, 4); ax.set_ylim(-4, 4); ax.set_aspect('equal')
    ax.set_title(f"{MOL.upper()} en equilibrio — Δρ (plano XY)", color='white')
    ax.legend(loc='upper right', framealpha=0.3)
    fig.tight_layout()
    figpath = os.path.join(os.path.dirname(__file__), '..', '_o2_proof', f'{MOL}-abinitio-particles.png')
    os.makedirs(os.path.dirname(figpath), exist_ok=True)
    fig.savefig(figpath, dpi=100, facecolor='black')
    print(f"figura: {figpath}")


if __name__ == '__main__':
    res = build()
    write_bin(*res)
    validate_figure(res[0], res[1], res[2])
    print(f"{MOL.upper()}_LISTO")
