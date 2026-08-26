#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-water-approach.py — EL PUENTE, bien hecho. DOS moléculas de agua que se
acercan a lo largo del eje del puente de hidrógeno, calculadas ab initio a K separaciones.
El render (O2Cloud de V1) interpola por R(t) → se ve el ACERCAMIENTO y, sobre todo, cómo
el campo eléctrico de una MODIFICA los electrones de la otra:

  acc   = ρ_total (las DOS nubes densas, oro/ámbar) — la maquinaria densa de V1
  dep   = Δρ<0  (azul): de dónde SALEN los electrones al acercarse
  spin  = Δρ>0  (morado, GLOW): a dónde LLEGAN — el puente naciendo = el campo jalando
          los electrones al lugar EXACTO que dice la cuántica (Δρ = ρ_dímero − ρ_promolécula)
  bondMass[k] = ∫Δρ>0  → el puente se ENCIENDE al acercarse

Correspondencia Lagrangiana (semilla U fija) → cada partícula se MUEVE suave entre frames.
Formato WAP2 (bohr, POSQ=5000, compatible con O2Cloud). Incluye núcleos y líneas de campo/frame.

Verificación: E_enlace(Re) ≈ −5 kcal/mol; ∫Δρ>0 crece monótono al acercarse.
Uso:  OMP_NUM_THREADS=16 python3 scripts/precompute-water-approach.py [quick]
"""
import os, sys, struct
import numpy as np

BOHR = 0.52917721067
HART2KCAL = 627.509
QUICK = 'quick' in sys.argv
BASIS = 'cc-pvdz'
SEED = 20260723
POSQ = 5000                    # bohr → int16 (igual que O2AI_POSQ)
KE = 332.0637 / HART2KCAL      # no usado (campo por cargas parciales abajo)

# ── geometría del dímero de equilibrio (Cs, literatura; Å) — donante 0-2, aceptor 3-5 ──
DIMER_A = np.array([
    [-1.551007, -0.114520,  0.000000],   # 0 O donante
    [-1.934259,  0.762503,  0.000000],   # 1 H libre del donante
    [-0.599677,  0.040712,  0.000000],   # 2 H del PUENTE (apunta al O aceptor)
    [ 1.350625,  0.111469,  0.000000],   # 3 O aceptor
    [ 1.680398, -0.373741, -0.758561],   # 4 H aceptor
    [ 1.680398, -0.373741,  0.758561],   # 5 H aceptor
])
Z = np.array([8, 1, 1, 8, 1, 1])
Q_PARTIAL = np.array([-0.82, 0.41, 0.41, -0.82, 0.41, 0.41])   # Mulliken ≈ SPC (campo)

DON = [0, 1, 2]; ACC = [3, 4, 5]
O_don0, O_acc0 = DIMER_A[0], DIMER_A[3]
AXIS = (O_don0 - O_acc0); RE_A = np.linalg.norm(AXIS); AXIS = AXIS / RE_A   # eje O···O
MID0 = 0.5 * (O_don0 + O_acc0)

R_MAX_A = 5.6      # lejos (interacción débil)
R_MIN_A = 2.78     # pegadas (puente formado, ligeramente comprimido)

# ── EL PAR (2026-08-26): la misma máquina para AGUA + X. Default = agua-agua (EL REY, bit-idéntico:
# ninguna rama de abajo toca el camino original). PAR=na → LA SAL: Na⁺ + H₂O. Gate ab initio
# medido antes de escribir esto: RHF/aug-cc-pVDZ da −24.0 kcal/mol a 2.25 Å; experimento
# (Dzidic & Kebarle 1970) −24.0 kcal/mol, 2.2–2.3 Å. Ion–dipolo = electrostática: RHF lo clava.
# (El aceite NO: su −0.5 kcal/mol es dispersión, que RHF no tiene → otro motor, no este.)
PAR = os.environ.get('PAR', 'agua')
CHARGE = 0; CHARGE_DON = 0; CHARGE_ACC = 0
NOMBRE = 'AGUA-AGUA'; BIN_ID = 'water-approach'
O_IDX = [0, 3]                      # oxígenos (color morado de pares / figura)
H_IDX = [1, 2, 4, 5]
if PAR == 'na':
    # Na⁺ (fragmento DON, carga +1) sobre −x; agua (ACC) con el O apuntándole: los H hacia +x.
    # Agua experimental: O–H 0.9578 Å, HOH 104.478°. Acercamiento simétrico al centro, como el rey.
    _a = np.deg2rad(104.478 / 2.0); _r = 0.9578
    DIMER_A = np.array([
        [-1.125, 0.0, 0.0],                                  # 0 Na⁺
        [ 1.125, 0.0, 0.0],                                  # 1 O
        [ 1.125 + _r * np.cos(_a),  _r * np.sin(_a), 0.0],   # 2 H
        [ 1.125 + _r * np.cos(_a), -_r * np.sin(_a), 0.0],   # 3 H
    ])
    Z = np.array([11, 8, 1, 1])
    DON = [0]; ACC = [1, 2, 3]
    O_don0, O_acc0 = DIMER_A[0], DIMER_A[1]                  # "eje" = Na···O
    AXIS = (O_don0 - O_acc0); RE_A = np.linalg.norm(AXIS); AXIS = AXIS / RE_A
    MID0 = 0.5 * (O_don0 + O_acc0)
    R_MAX_A = 7.0      # lejos: el campo del ion ya se siente, el agua casi no se deforma
    R_MIN_A = 2.25     # el mínimo ab initio = el experimento
    CHARGE = 1; CHARGE_DON = 1; CHARGE_ACC = 0
    NOMBRE = 'LA SAL · Na⁺ + H₂O'; BIN_ID = 'water-sodium'
    O_IDX = [1]; H_IDX = [2, 3]
    # Base con difusas para el ION: cc-pVDZ sobre-liga −29 kcal/mol (BSSE); aug-cc-pVDZ da −24.0 = experimento.
    BASIS = 'aug-cc-pvdz'
NNUC = len(Z)

if QUICK:
    K = 8;  N_ACC, N_DEP, N_SPIN = 6000, 3000, 3000;  NX, NY, NZ = 80, 56, 56
else:
    K = 30; N_ACC, N_DEP, N_SPIN = 48000, 18000, 17000; NX, NY, NZ = 132, 92, 92

# caja de muestreo (bohr), centrada en MID0 (el punto medio O-O es fijo por el acercamiento simétrico)
LX, LR = 9.6, 6.2
RE = RE_A / BOHR
R_MIN = R_MIN_A / BOHR; R_MAX = R_MAX_A / BOHR
Rvals = R_MAX + (R_MIN - R_MAX) * (np.arange(K) / (K - 1))    # descendente Rmax→Rmin (como O2)

rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3)); U_dep = rng.random((N_DEP, 3)); U_spin = rng.random((N_SPIN, 3))

dx = (2 * LX) / NX; dy = (2 * LR) / NY; dz = (2 * LR) / NZ
xs = -LX + (np.arange(NX) + 0.5) * dx
ys = -LR + (np.arange(NY) + 0.5) * dy
zs = -LR + (np.arange(NZ) + 0.5) * dz
GX, GY, GZ = np.meshgrid(xs, ys, zs, indexing='ij')
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)   # bohr
dV = dx * dy * dz

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', f'{BIN_ID}.bin')
PROOF = os.path.join(os.path.dirname(__file__), '..', '_o2_proof')


def geom_at(R_A):
    """Geometría (bohr) a separación O-O = R_A (Å), acercamiento SIMÉTRICO al centro."""
    shift = AXIS * (R_A - RE_A) / 2.0
    g = DIMER_A.copy()
    g[DON] += shift; g[ACC] -= shift
    g = g - MID0                     # centrar el punto medio O-O en el origen
    return g / BOHR                  # → bohr


def eval_rhos(mol, dms, pts, chunk=40000):
    outs = [np.empty(pts.shape[0]) for _ in dms]
    for a in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[a:a + chunk])
        for i, dm in enumerate(dms):
            outs[i][a:a + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return outs


def sample_field(field, U):
    M = U.shape[0]; f = np.maximum(field, 0.0)
    slab = f.sum(axis=(1, 2)); Cx = np.concatenate([[0.0], np.cumsum(slab)]); tot = Cx[-1]
    if tot <= 0:
        return np.zeros((M, 3))
    tgt = U[:, 0] * tot
    ix = np.clip(np.searchsorted(Cx, tgt, side='right') - 1, 0, NX - 1)
    x = -LX + (ix + (tgt - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)) * dx
    colmass = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((NX, 1)), np.cumsum(colmass, axis=1)], axis=1)
    Cy_row = Cy[ix]; tgty = U[:, 1] * Cy_row[:, -1]
    iy = np.clip((Cy_row[:, :-1] <= tgty[:, None]).sum(axis=1) - 1, 0, NY - 1)
    cy0 = Cy_row[np.arange(M), iy]; cy1 = Cy_row[np.arange(M), iy + 1]
    y = -LR + (iy + (tgty - cy0) / np.maximum(cy1 - cy0, 1e-30)) * dy
    Cz = np.concatenate([np.zeros((NX, NY, 1)), np.cumsum(f, axis=2)], axis=2)
    Cz_row = Cz[ix, iy]; tgtz = U[:, 2] * Cz_row[:, -1]
    iz = np.clip((Cz_row[:, :-1] <= tgtz[:, None]).sum(axis=1) - 1, 0, NZ - 1)
    cz0 = Cz_row[np.arange(M), iz]; cz1 = Cz_row[np.arange(M), iz + 1]
    z = -LR + (iz + (tgtz - cz0) / np.maximum(cz1 - cz0, 1e-30)) * dz
    return np.stack([x, y, z], axis=1)


# ── CAMPO ELÉCTRICO del MEP REAL (como Li₂): V = Σ Z/|r−R| − ∫ρ/|r−r'|, E = −∇V.
# Muchas líneas 3D que brotan de los H (δ+) y se CONECTAN al O vecino al acercarse.
def esp3d(mol, dm, pts, chunk=4000):
    Zs = mol.atom_charges(); Rn = mol.atom_coords()
    V = np.empty(len(pts))
    for a in range(0, len(pts), chunk):
        p = np.ascontiguousarray(pts[a:a + chunk])
        Vm = mol.intor('int1e_grids', grids=p)
        ve = -np.einsum('gij,ij->g', Vm, dm)               # electrónico (negativo)
        d = np.linalg.norm(p[:, None, :] - Rn[None], axis=2) + 1e-9
        V[a:a + chunk] = ve + (Zs[None, :] / d).sum(1)      # + nuclear
    return V


def E3d(mol, dm, P, h=0.03):
    off = np.array([[h, 0, 0], [-h, 0, 0], [0, h, 0], [0, -h, 0], [0, 0, h], [0, 0, -h]])
    V = esp3d(mol, dm, (P[:, None, :] + off[None, :, :]).reshape(-1, 3)).reshape(len(P), 6)
    return np.stack([-(V[:, 0] - V[:, 1]), -(V[:, 2] - V[:, 3]), -(V[:, 4] - V[:, 5])], 1) / (2 * h)


# REJILLA de semillas (como Li₂ SEEDS2D, pero 3D) → streamplot denso del campo en TODO
# el espacio. Concentrada donde el campo es fuerte (alrededor del par, eje O-O = X).
def field_grid():                                          # MÁS densa (más líneas)
    gx = np.arange(-8.0, 8.01, 1.35); gy = np.arange(-5.0, 5.01, 1.45); gz = np.arange(-3.6, 3.61, 1.65)
    return np.array([[x, y, z] for x in gx for y in gy for z in gz], float)


def _smooth(p, k=5):                                        # media móvil → línea CONTINUA (sin picos)
    for _ in range(k):
        if len(p) < 3:
            return p
        q = p.copy(); q[1:-1] = 0.25 * p[:-2] + 0.5 * p[1:-1] + 0.25 * p[2:]; p = q
    return p


def trace_field3d(mol, dm, gb, seeds, LP, maxlen=9.0, h=0.19, THR=0.003):
    Rn = gb                                                # los 6 núcleos (sumideros/fuentes)
    NS = len(seeds); HALF = LP

    def leg(sign):
        P = seeds.copy(); paths = np.zeros((NS, HALF, 3)); dead = np.full(NS, HALF); alive = np.ones(NS, bool)
        for st in range(HALF):
            paths[:, st] = P
            E = E3d(mol, dm, P); n = np.linalg.norm(E, axis=1, keepdims=True)
            u = np.where(n > THR, sign * E / np.maximum(n, 1e-9), 0.0)
            newP = P + u * h
            near = np.zeros(NS, bool)
            for rn in Rn:
                near |= np.linalg.norm(newP - rn, axis=1) < 0.40
            far = np.linalg.norm(newP, axis=1) > maxlen
            stop = (n[:, 0] <= THR) | near | far          # PARA en campo débil (no divaga → sin zigzag)
            jd = alive & stop; dead[jd] = np.minimum(dead[jd], st + 1); alive &= ~stop
            P = np.where(alive[:, None], newP, P)
        return paths, dead

    pf, df = leg(+1); pb, db = leg(-1)
    out = np.zeros((NS, LP, 3))
    for i in range(NS):
        full = _smooth(np.vstack([pb[i, :max(1, db[i])][::-1], pf[i, 1:max(1, df[i])]]))
        seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(full, axis=0), axis=1))]
        if seg[-1] < 1e-6:
            out[i] = np.tile(full[0], (LP, 1))
        else:
            uu = np.linspace(0, seg[-1], LP)
            out[i] = np.stack([np.interp(uu, seg, full[:, c]) for c in range(3)], axis=1)
    return out


def build():
    from pyscf import gto, scf
    LP = 40; SEEDS = field_grid(); NL_EF = len(SEEDS)       # campo MEP: REJILLA densa (como Li₂)
    accPos = np.zeros((K, N_ACC, 3)); depPos = np.zeros((K, N_DEP, 3)); spinPos = np.zeros((K, N_SPIN, 3))
    bondMass = np.zeros(K)
    nucPos = np.zeros((K, NNUC, 3)); efield = np.zeros((K, NL_EF, LP, 3))
    print(f"=== ACERCAMIENTO {NOMBRE} · {K} separaciones · {BASIS} · malla {NX}×{NY}×{NZ} ===", flush=True)
    print("k   R(Å)    E(Ha)        Ebind(kcal)  ∫Δρ>0", flush=True)
    for k in range(K):
        R = float(Rvals[k]); R_A = R * BOHR
        gb = geom_at(R_A)                                  # bohr, centrada
        atoms = [[int(Z[i]), tuple(gb[i])] for i in range(NNUC)]
        mol = gto.M(atom=atoms, basis=BASIS, unit='Bohr', verbose=0, charge=CHARGE)
        mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
        dm = mf.make_rdm1()
        # monómeros aislados a SU posición (promolécula) → Δρ de interacción
        md = gto.M(atom=[atoms[i] for i in DON], basis=BASIS, unit='Bohr', verbose=0, charge=CHARGE_DON)
        ma = gto.M(atom=[atoms[i] for i in ACC], basis=BASIS, unit='Bohr', verbose=0, charge=CHARGE_ACC)
        ed = scf.RHF(md).kernel(); ea = scf.RHF(ma).kernel()
        ebind = (mf.e_tot - ed - ea) * HART2KCAL
        dm_d = md.RHF().run(verbose=0).make_rdm1(); dm_a = ma.RHF().run(verbose=0).make_rdm1()
        rho_tot = eval_rhos(mol, [dm], GRID)[0]
        rho_d = eval_rhos(md, [dm_d], GRID)[0]; rho_a = eval_rhos(ma, [dm_a], GRID)[0]
        drho = (rho_tot - rho_d - rho_a).reshape(NX, NY, NZ)
        rho_tot = rho_tot.reshape(NX, NY, NZ)
        acc_field = np.power(np.maximum(rho_tot, 0), 0.8)    # nube densa (comprime pico nuclear)
        dep_field = np.maximum(-drho, 0)                     # electrones que SALEN (azul)
        spin_field = np.maximum(drho, 0)                     # electrones que LLEGAN = el puente (morado glow)
        bondMass[k] = float(spin_field.sum() * dV)
        accPos[k] = sample_field(acc_field, U_acc)
        depPos[k] = sample_field(dep_field, U_dep)
        spinPos[k] = sample_field(spin_field, U_spin)
        nucPos[k] = gb
        efield[k] = trace_field3d(mol, dm, gb, SEEDS, LP)      # campo MEP real (rejilla, Li₂-style)
        print(f"{k:2d}  {R_A:5.2f}  {mf.e_tot:11.5f}  {ebind:8.2f}    {bondMass[k]:.4f}", flush=True)

    # accColor: gradiente ORO→ÁMBAR por densidad radial (como V1), morado cerca de los O (pares).
    # Se fija en el frame de EQUILIBRIO (kEq), como O2. Oro cálido de base + tinte morado en los O.
    kEq = int(np.argmin(np.abs(Rvals - RE)))
    P = accPos[kEq]
    dO = np.min(np.stack([np.linalg.norm(P - nucPos[kEq, i], axis=1) for i in O_IDX]), axis=0)
    pw = np.clip(1.0 - dO / 1.4, 0, 1)                    # 1 pegado a un O (morado) → 0 lejos (oro)
    gold = np.array([1.0, 0.72, 0.30]); purple = np.array([0.82, 0.28, 1.0])
    col = gold[None, :] * (1 - pw[:, None]) + purple[None, :] * pw[:, None]
    accColor = np.clip(col * 255, 0, 255).astype(np.uint8)
    return accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, NL_EF, LP


OUT_EF = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', f'{BIN_ID}-efield.bin')
def write_bin(accPos, depPos, spinPos, bondMass, accColor, nucPos):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    q = lambda a: np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
    with open(OUT, 'wb') as fp:                              # WAP2: nubes + núcleos (SIN campo, NL=0)
        fp.write(struct.pack('<4s7i', b'WAP2', N_ACC, N_DEP, N_SPIN, K, NNUC, 0, 0))
        fp.write(struct.pack('<3f', float(POSQ), float(R_MIN), float(R_MAX)))
        fp.write(Rvals.astype('<f4').tobytes())
        fp.write(bondMass.astype('<f4').tobytes())
        fp.write(accColor.astype(np.uint8).tobytes())
        fp.write(Z.astype('<i2').tobytes())
        for a in (accPos, depPos, spinPos):
            fp.write(q(a).tobytes())
        fp.write(q(nucPos).tobytes())
    print(f"OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB (nubes)", flush=True)


def write_efield(efield, NL_EF, LP):
    # formato de BondEField (Li₂): int32 K,NL,LP · float32[K] Rvals · int16 líneas(bohr×2000)
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL_EF, LP))
        fp.write(Rvals.astype('<f4').tobytes())
        fp.write(np.clip(np.round(efield * 2000), -32767, 32767).astype('<i2').tobytes())
    print(f"OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB (campo MEP, {NL_EF} líneas×{LP})", flush=True)


def validate(accPos, depPos, spinPos, bondMass, nucPos, efield):
    # GATE: ∫Δρ>0 crece monótono al acercarse (el puente se forma solo)
    mono = np.all(np.diff(bondMass) >= -1e-4)
    print(f"── GATE acercamiento: ∫Δρ>0 de {bondMass[0]:.4f} (lejos) → {bondMass[-1]:.4f} (pegadas)"
          f"  ·  monótono creciente = {mono}", flush=True)
    print("  GATE_APPROACH_OK" if bondMass[-1] > bondMass[0] * 1.5 else "  GATE_APPROACH_FAIL", flush=True)
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        fig, axs = plt.subplots(1, 3, figsize=(18, 6.5), facecolor='black')
        for ax, k, lab in zip(axs, [0, K // 2, K - 1], ['lejos', 'acercándose', 'puente']):
            ax.set_facecolor('black')
            for ln in efield[k]:
                ax.plot(ln[:, 0], ln[:, 1], c='#7ac8ff', alpha=0.5, lw=0.8)   # campo MEP (cian, Li₂)
            ax.scatter(accPos[k, :, 0], accPos[k, :, 1], s=1, c='#ffb43c', alpha=0.22)
            ax.scatter(spinPos[k, :, 0], spinPos[k, :, 1], s=2, c='#b04cff', alpha=0.5)
            ax.scatter(nucPos[k, O_IDX, 0], nucPos[k, O_IDX, 1], s=80, c='#e0c0ff', zorder=5)
            ax.scatter(nucPos[k, H_IDX, 0], nucPos[k, H_IDX, 1], s=40, c='#ffd27a', zorder=5)
            if PAR == 'na': ax.scatter(nucPos[k, 0, 0], nucPos[k, 0, 1], s=140, c='#ffe08a', zorder=6)
            ax.set_aspect('equal'); ax.set_xlim(-9, 9); ax.set_ylim(-6, 6); ax.axis('off')
            ax.set_title(f"{lab}  R={Rvals[k]*BOHR:.2f}Å", color='white')
        fig.suptitle("EL PUENTE — nube (oro/morado=Δρ) + CAMPO MEP real (cian, como Li₂, se conecta)", color='white')
        fig.tight_layout(); os.makedirs(PROOF, exist_ok=True)
        f = os.path.join(PROOF, f'{BIN_ID}.png'); fig.savefig(f, dpi=95, facecolor='black'); plt.close(fig)
        print("figura:", f, flush=True)
    except Exception as e:
        print("fig falló:", e, flush=True)


# ══════════════ CAMPO SOLO — motor scripts/campo_lineas.py (mismo que el trímero) ══════════════
# El campo de ESTE archivo tenía el mismo defecto que el del trímero, y peor: sembraba en una
# REJILLA RECTANGULAR (`field_grid`, líneas cada 1.35 bohr), que no tiene NADA que ver con el
# flujo — así que la densidad de líneas no significaba la intensidad del campo. Más: Euler de
# paso fijo (1er orden), media móvil ×5, y corte por radio en |r|=9. Se recalcula con el motor
# nuevo, que sí cumple Gauss (gates en scripts/campo-gate.py).
def solo_campo():
    from pyscf import gto, scf
    import time
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from campo_lineas import (CampoMEP, superficie_molecular, sembrar_por_flujo,
                              superficie_en_rayos, trazar_bidireccional, E_PUENTE)
    N_DIR, NL, LP = 1200, 900, 80
    TZ = dict(tol=1e-8, r_core=0.25, r_caja=16.0, s_max=30.0, e_min=1e-4,
              max_pasos=1500, max_muestras=900)

    def mol_en(R_A):
        gb = geom_at(R_A)
        m = gto.M(atom=[[int(Z[i]), tuple(gb[i])] for i in range(NNUC)], basis=BASIS, unit='Bohr', verbose=0, charge=CHARGE)
        f = scf.RHF(m); f.max_cycle = 200; f.kernel()
        return m, f.make_rdm1()

    # referencia = el dímero PEGADO (el puente formado), igual que en el trímero
    mr, dmr = mol_en(float(Rvals[-1]) * BOHR)
    cr = CampoMEP(mr, dmr)
    sup = superficie_molecular(cr, n_dir=N_DIR)
    idx, Phi0, info = sembrar_por_flujo(cr, sup, NL)
    ia_r, id_r = sup['ray'][0][idx], sup['ray'][1][idx]
    print(f"  siembra por flujo: {len(idx)} líneas · Φ₀ = {Phi0:.3e} · ∮E·n̂dA = {info['flujo_neto']:+.3f}", flush=True)
    ef = np.zeros((K, len(ia_r), LP, 3))
    print(f"=== DÍMERO SOLO CAMPO · {K} radios · {len(ia_r)} líneas × {LP} pts · corte |E|≥{E_PUENTE} ===", flush=True)
    for k in range(K):
        t0 = time.time()
        R_A = float(Rvals[k]) * BOHR
        m, dm = mol_en(R_A)
        c = CampoMEP(m, dm)
        S, hay, _ = superficie_en_rayos(c, ia_r, id_r, N_DIR)
        L, largo, viva, _nE, mf_, mb_ = trazar_bidireccional(c, S, LP=LP, e_dibujo=E_PUENTE, **TZ)   # firma actual (6 valores)
        ef[k] = L
        rr = np.linalg.norm(L[viva].reshape(-1, 3), axis=1)
        print(f"  {k+1}/{K}  R {R_A:.2f} Å · {int(viva.sum())}/{len(ia_r)} vivas · largo mediano "
              f"{np.median(largo[viva]):.2f} · r95 {np.percentile(rr,95):.1f} bohr · {time.time()-t0:.0f} s", flush=True)
    write_efield(ef, len(ia_r), LP)


if __name__ == '__main__':
    if '--solo-campo' in sys.argv:
        solo_campo(); sys.exit(0)
    accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, NL_EF, LP = build()
    write_bin(accPos, depPos, spinPos, bondMass, accColor, nucPos)
    write_efield(efield, NL_EF, LP)
    validate(accPos, depPos, spinPos, bondMass, nucPos, efield)
    print("WATER_APPROACH_LISTO", flush=True)
