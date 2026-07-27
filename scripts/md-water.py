#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
md-water.py — DINÁMICA MOLECULAR REAL del agua. Tiro 10 moléculas al azar en el
vacío, les doy fuerzas REALES, e integro Newton. La forma (puentes, anillos) EMERGE
sola de la física. NADA pre-seteado — ese es el mandato de la serie.

Fuerzas (todas reales, ninguna inventada):
  INTRA (cada molécula vibra):
    - 2 resortes O-H:   U = ½ k_r (r-r0)²      k_r calibrado a ν(stretch)=3657/3756 cm⁻¹
    - 1 resorte ángulo: U = ½ k_θ (θ-θ0)²      k_θ calibrado a ν(bend)=1595 cm⁻¹
    → salen los 3 modos: sym-stretch 3657, bend 1595, asym-stretch 3756 (los 2 stretch
      = "las 2 vibraciones de los H que no se ven"). El split sym/asym EMERGE del
      acoplamiento por el O compartido, no se mete a mano.
  INTER (por qué se pegan = el campo eléctrico):
    - Coulomb entre cargas parciales:  q_O=-0.82e, q_H=+0.41e (Mulliken ab initio del agua)
      U = k_e q_i q_j / r    → el δ+ H jala al δ− O vecino = PUENTE DE HIDRÓGENO
    - Lennard-Jones O-O (van der Waals): U = 4ε[(σ/r)¹²-(σ/r)⁶]  σ=3.166Å ε=0.1553  (SPC/E)
      → pared repulsiva: no colapsan; equilibrio ~2.8 Å (por qué el puente mide eso)

Perilla: TEMPERATURA (no presión: en vacío sin caja no hay presión). Velocidades
Maxwell-Boltzmann a T; recocido (annealing) tibio→frío para que el orden EMERJA limpio.

Integrador: velocity Verlet, dt=0.5 fs (≥15 pasos por vibración, energía conservada).

GATES (corren antes de escribir nada):
  1. frecuencias  → FFT de una molécula excitada: 3657/1595/3756 ±5%
  2. energía      → NVE sin termostato: deriva de E_total < 1%
  3. puente       → tras el recocido: pares O···O a ~2.8 Å (el puente se formó SOLO)
  4. temperatura  → T(t) medida sigue el recocido

Salida:
  public/precomputed/water-md.bin   — trayectoria (átomos/frame) + campo/frame + nube
  _o2_proof/md-*.png                — el VIAJE, el espectro, la energía (verificar a ojo)

Uso:  python3 scripts/md-water.py [quick]
"""
import os, sys, struct
import numpy as np

# ── constantes físicas (unidades: Å, uma, kcal/mol, fs) ──────────────────────
KE     = 332.0637          # Coulomb: U=KE·q_i q_j/r  [kcal·Å/(mol·e²)]
KB     = 0.001987204       # Boltzmann [kcal/(mol·K)]
ACCFAC = 4.184000e-4       # a[Å/fs²] = ACCFAC · F[kcal/mol/Å] / m[uma]  (1 t.u.=48.888 fs)
MASS_O = 15.999
MASS_H = 1.008

# geometría real del agua (gas): O-H 0.9578 Å, H-O-H 104.478°
R0_OH  = 0.9578
TH0    = np.radians(104.478)

# resortes calibrados a las frecuencias MEDIDAS (se afinan por el gate de frecuencia)
KR     = 1079.0            # kcal/mol/Å²  (≈750 N/m → sym-stretch ~3657 cm⁻¹)
KTH    = 98.0             # kcal/mol/rad² (→ bend ~1595 cm⁻¹)

# cargas parciales (Mulliken ab initio del agua ≈ SPC) y Lennard-Jones O-O (SPC/E)
Q_O, Q_H = -0.82, +0.41
LJ_SIG   = 3.166
LJ_EPS   = 0.1553

QUICK = 'quick' in sys.argv
NMOL  = 6 if QUICK else 10
SEED  = 20260723
DT    = 0.5               # fs
OUT   = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'water-md.bin')
PROOF = os.path.join(os.path.dirname(__file__), '..', '_o2_proof')

# masa por átomo dentro de una molécula (O, H, H)
MOL_MASS = np.array([MASS_O, MASS_H, MASS_H])


# ── una molécula rígida en su marco canónico (O en origen, bisectriz +Y) ─────
def water_template():
    a = TH0 / 2
    O  = np.array([0.0, 0.0, 0.0])
    H1 = np.array([ R0_OH * np.sin(a), R0_OH * np.cos(a), 0.0])
    H2 = np.array([-R0_OH * np.sin(a), R0_OH * np.cos(a), 0.0])
    return np.array([O, H1, H2])


def rand_rotation(rng):
    # cuaternión uniforme → matriz de rotación (Shoemake)
    u1, u2, u3 = rng.random(3)
    q = np.array([np.sqrt(1 - u1) * np.sin(2 * np.pi * u2),
                  np.sqrt(1 - u1) * np.cos(2 * np.pi * u2),
                  np.sqrt(u1) * np.sin(2 * np.pi * u3),
                  np.sqrt(u1) * np.cos(2 * np.pi * u3)])
    w, x, y, z = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


# ── condiciones iniciales: N moléculas al azar en una esfera, sin traslape ────
def init_state(rng):
    tmpl = water_template()
    R0 = 6.0 if not QUICK else 5.2       # radio de la nube inicial (Å) — parten sueltas, condensan
    centers = []
    tries = 0
    while len(centers) < NMOL and tries < 100000:
        tries += 1
        p = rng.normal(size=3); p = p / np.linalg.norm(p) * (R0 * rng.random() ** (1 / 3))
        if all(np.linalg.norm(p - c) > 3.2 for c in centers):
            centers.append(p)
    centers = np.array(centers)
    r = np.zeros((NMOL * 3, 3))
    for m in range(NMOL):
        Rm = rand_rotation(rng)
        r[3 * m:3 * m + 3] = centers[m] + tmpl @ Rm.T
    return r


# ── índices de enlaces / ángulos / no-enlazados (una vez) ────────────────────
def build_topology(N):
    bonds = []   # (i, j) = (O, H)
    angles = []  # (O, H1, H2)
    for m in range(N):
        o, h1, h2 = 3 * m, 3 * m + 1, 3 * m + 2
        bonds += [(o, h1), (o, h2)]
        angles.append((o, h1, h2))
    bonds = np.array(bonds)
    angles = np.array(angles)
    # cargas por átomo
    q = np.tile([Q_O, Q_H, Q_H], N)
    is_O = np.tile([True, False, False], N)
    # pares NO-enlazados: átomos en moléculas DISTINTAS
    ii, jj = np.triu_indices(3 * N, k=1)
    diff_mol = (ii // 3) != (jj // 3)
    ii, jj = ii[diff_mol], jj[diff_mol]
    qq = q[ii] * q[jj]
    oo = is_O[ii] & is_O[jj]
    return bonds, angles, q, is_O, ii, jj, qq, oo


def forces(r, m_arr, topo, intra_only=False):
    bonds, angles, q, is_O, ii, jj, qq, oo = topo
    F = np.zeros_like(r)
    U = 0.0
    # ── enlaces O-H ──
    d = r[bonds[:, 0]] - r[bonds[:, 1]]
    rr = np.linalg.norm(d, axis=1)
    dr = rr - R0_OH
    U += 0.5 * KR * np.sum(dr ** 2)
    fmag = -KR * dr / rr
    fv = fmag[:, None] * d
    np.add.at(F, bonds[:, 0], fv)
    np.add.at(F, bonds[:, 1], -fv)
    # ── ángulos H-O-H ──
    O, H1, H2 = angles[:, 0], angles[:, 1], angles[:, 2]
    a = r[H1] - r[O]; b = r[H2] - r[O]
    na = np.linalg.norm(a, axis=1); nb = np.linalg.norm(b, axis=1)
    ah = a / na[:, None]; bh = b / nb[:, None]
    c = np.clip(np.sum(ah * bh, axis=1), -1, 1)
    th = np.arccos(c); s = np.sqrt(np.maximum(1 - c ** 2, 1e-12))
    U += 0.5 * KTH * np.sum((th - TH0) ** 2)
    dUdth = KTH * (th - TH0)
    coef = dUdth / s
    dc_H1 = (bh - c[:, None] * ah) / na[:, None]
    dc_H2 = (ah - c[:, None] * bh) / nb[:, None]
    dc_O = -(dc_H1 + dc_H2)
    np.add.at(F, H1, coef[:, None] * dc_H1)
    np.add.at(F, H2, coef[:, None] * dc_H2)
    np.add.at(F, O, coef[:, None] * dc_O)
    # ── no-enlazados: Coulomb + Lennard-Jones ──
    if not intra_only:
        d2 = r[ii] - r[jj]
        r2 = np.sum(d2 ** 2, axis=1)
        rn = np.sqrt(r2)
        # Coulomb
        U += KE * np.sum(qq / rn)
        fc = KE * qq / (r2 * rn)
        # LJ (solo O-O)
        sr6 = np.where(oo, (LJ_SIG ** 2 / r2) ** 3, 0.0)
        U += np.sum(np.where(oo, 4 * LJ_EPS * (sr6 ** 2 - sr6), 0.0))
        flj = 24 * LJ_EPS * (2 * sr6 ** 2 - sr6) / r2
        ftot = (fc + flj)[:, None] * d2
        np.add.at(F, ii, ftot)
        np.add.at(F, jj, -ftot)
    return F, U


def kinetic(v, m_arr):
    return 0.5 * np.sum(m_arr[:, None] * v ** 2) / ACCFAC   # kcal/mol


def temperature(v, m_arr, ndof):
    return 2 * kinetic(v, m_arr) / (ndof * KB)


def maxwell(rng, m_arr, T):
    # equipartición: ½m σ²/ACCFAC = ½kT  →  σ = sqrt(kT·ACCFAC/m)  [Å/fs]
    sig = np.sqrt(KB * T * ACCFAC / m_arr[:, None])
    return rng.normal(size=(len(m_arr), 3)) * sig


def remove_com_and_spin(r, v, m_arr):
    M = m_arr.sum()
    vcom = (m_arr[:, None] * v).sum(0) / M
    v = v - vcom
    com = (m_arr[:, None] * r).sum(0) / M
    rc = r - com
    L = (m_arr[:, None] * np.cross(rc, v)).sum(0)
    I = np.zeros((3, 3))
    for k in range(len(r)):
        x = rc[k]; I += m_arr[k] * (np.dot(x, x) * np.eye(3) - np.outer(x, x))
    try:
        omega = np.linalg.solve(I, L)
        v = v - np.cross(omega[None, :], rc)
    except np.linalg.LinAlgError:
        pass
    return v


# ═══════════════════ GATE 1: frecuencias de una molécula ═════════════════════
def gate_frequencies():
    print("── GATE 1: frecuencias vibracionales (una molécula, NVE) ──", flush=True)
    m_arr = MOL_MASS.copy()
    topo = build_topology(1)
    r = water_template().copy()
    # excitar los 3 modos: estirar ambos O-H (asimétrico r1≠r2 + simétrico) Y abrir
    # el ángulo (bend) rotando los H en el plano ±5° sobre z
    r[1] *= 1.05; r[2] *= 1.02
    ca, sa = np.cos(np.radians(5)), np.sin(np.radians(5))
    Rz = np.array([[ca, -sa, 0], [sa, ca, 0], [0, 0, 1]])
    r[1] = Rz @ r[1]; r[2] = Rz.T @ r[2]      # abre el ángulo H-O-H
    dt = 0.25                            # fs, fino para el FFT
    nst = 16000
    v = np.zeros_like(r)
    F, _ = forces(r, m_arr, topo, intra_only=True)
    r1t = np.empty(nst); r2t = np.empty(nst); tht = np.empty(nst)
    for k in range(nst):
        v += 0.5 * ACCFAC * F / m_arr[:, None] * dt
        r += v * dt
        F, _ = forces(r, m_arr, topo, intra_only=True)
        v += 0.5 * ACCFAC * F / m_arr[:, None] * dt
        a = r[1] - r[0]; b = r[2] - r[0]
        r1t[k] = np.linalg.norm(a); r2t[k] = np.linalg.norm(b)
        tht[k] = np.arccos(np.clip(np.dot(a, b) / (r1t[k] * r2t[k]), -1, 1))

    def peak_cm(sig, fmin, fmax):
        sig = sig - sig.mean()
        sig = sig * np.hanning(len(sig))
        S = np.abs(np.fft.rfft(sig))
        cm = np.fft.rfftfreq(len(sig), d=dt * 1e-15) / 2.99792458e10   # cm⁻¹
        band = (cm >= fmin) & (cm <= fmax)
        return cm[band][np.argmax(S[band])]

    sym = peak_cm(r1t + r2t, 2800, 4200)      # stretch simétrico
    asym = peak_cm(r1t - r2t, 2800, 4200)     # stretch asimétrico
    bend = peak_cm(tht, 800, 2400)            # flexión (ventana propia)
    print(f"  sym-stretch  = {sym:6.0f} cm⁻¹   (real 3657)", flush=True)
    print(f"  asym-stretch = {asym:6.0f} cm⁻¹   (real 3756)", flush=True)
    print(f"  bend         = {bend:6.0f} cm⁻¹   (real 1595)", flush=True)
    ok = abs(sym - 3657) < 250 and abs(asym - 3756) < 300 and abs(bend - 1595) < 200
    print("  GATE_FREQ_OK" if ok else "  GATE_FREQ_FAIL"
          f"   (afina: KR×{(3657/max(sym,1))**2:.3f}, KTH×{(1595/max(bend,1))**2:.3f})", flush=True)
    return ok, (sym, asym, bend), (r1t, r2t, tht, dt)


# ═══════════════════ GATE 2: conservación de energía (NVE) ═══════════════════
def gate_energy(rng):
    print("── GATE 2: conservación de energía (NVE, sin termostato) ──", flush=True)
    m_arr = np.tile(MOL_MASS, NMOL)
    topo = build_topology(NMOL)
    r = init_state(rng)
    ndof = 3 * len(r) - 6
    v = maxwell(rng, m_arr, 200.0)
    v = remove_com_and_spin(r, v, m_arr)
    F, U = forces(r, m_arr, topo)
    E0 = U + kinetic(v, m_arr)
    Emax = 0.0
    nst = 4000
    for k in range(nst):
        v += 0.5 * ACCFAC * F / m_arr[:, None] * DT
        r += v * DT
        F, U = forces(r, m_arr, topo)
        v += 0.5 * ACCFAC * F / m_arr[:, None] * DT
        E = U + kinetic(v, m_arr)
        Emax = max(Emax, abs(E - E0))
    drift = Emax / abs(E0)
    print(f"  E0 = {E0:.2f} kcal/mol   deriva máx = {drift*100:.3f} %", flush=True)
    ok = drift < 0.02
    print("  GATE_ENERGY_OK" if ok else "  GATE_ENERGY_FAIL", flush=True)
    return ok


# ═══════════════════ campo eléctrico de cargas puntuales ═════════════════════
def efield(P, r, q):
    """E(P)=KE·Σ q_k (P-r_k)/|P-r_k|³  (P:(M,3))  →  (M,3)."""
    d = P[:, None, :] - r[None, :, :]
    d2 = np.sum(d ** 2, axis=2) + 1e-9
    inv = q[None, :] / d2 ** 1.5
    return KE * np.einsum('mk,mkc->mc', inv, d)


def trace_lines(r, q, is_O, LP, maxlen=3.5, h=0.14):
    """Una línea por cada H (δ+). Semilla AFUERA del H (dirección O_propio→H extendida)
    para que la línea alcance el O del VECINO (el puente), no su propio O covalente.
    Arco capado a maxlen: los H con puente terminan en el O aceptor; los colgantes
    quedan como muñón corto (el dipolo asomándose). Orden estable (línea i = H i)."""
    Hs = np.where(~is_O)[0]
    Os = r[is_O]
    lines = np.zeros((len(Hs), LP, 3), dtype=np.float32)
    for li, hi in enumerate(Hs):
        Oown = r[(hi // 3) * 3]
        od = r[hi] - Oown; od = od / (np.linalg.norm(od) + 1e-9)
        P = (r[hi] + 0.35 * od).reshape(1, 3)
        path = [P[0].copy()]; L = 0.0
        for _ in range(LP * 4):
            E = efield(P, r, q)[0]; n = np.linalg.norm(E)
            if n < 1e-6:
                break
            P = P + (h * E / n).reshape(1, 3); L += h
            pt = P[0]
            path.append(pt.copy())
            if np.min(np.linalg.norm(Os - pt, axis=1)) < 0.45:
                break
            if L > maxlen:
                break
        path = np.array(path)
        # remuestrear a LP puntos por longitud de arco
        seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))]
        if seg[-1] < 1e-6:
            lines[li] = np.tile(path[0], (LP, 1))
        else:
            u = np.linspace(0, seg[-1], LP)
            lines[li] = np.stack([np.interp(u, seg, path[:, c]) for c in range(3)], axis=1)
    return lines


# ═══════════════════ nube de densidad ab initio (1 molécula) ═════════════════
def density_cloud(ncloud, rng):
    print("── nube: densidad electrónica ab initio de 1 agua (PySCF) ──", flush=True)
    from pyscf import gto, scf
    BOHR = 0.52917721067
    tmpl = water_template()
    atoms = [['O', tuple(tmpl[0])], ['H', tuple(tmpl[1])], ['H', tuple(tmpl[2])]]
    mol = gto.M(atom=atoms, basis='cc-pvdz', verbose=0)
    mf = scf.RHF(mol); mf.kernel()
    dm = mf.make_rdm1()
    # malla alrededor de la molécula (Å → bohr para PySCF)
    NG = 56
    lo = tmpl.min(0) - 2.6; hi = tmpl.max(0) + 2.6
    ax = [np.linspace(lo[i], hi[i], NG) for i in range(3)]
    GX, GY, GZ = np.meshgrid(ax[0], ax[1], ax[2], indexing='ij')
    pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], 1)
    ao = mol.eval_gto('GTOval', pts / BOHR)
    rho = np.einsum('pi,pi->p', ao @ dm, ao).reshape(NG, NG, NG)
    acc = np.power(np.maximum(rho, 0), 0.8)
    f = acc.ravel(); f = f / f.sum()
    idx = rng.choice(len(f), size=ncloud, p=f)
    ijk = np.array(np.unravel_index(idx, (NG, NG, NG))).T
    d = [ax[i][1] - ax[i][0] for i in range(3)]
    jit = (rng.random((ncloud, 3)) - 0.5)
    pos = np.stack([ax[a][ijk[:, a]] + jit[:, a] * d[a] for a in range(3)], 1)  # marco molecular, rel O
    # anclar cada punto al átomo más cercano (O=0, H1=1, H2=2) → vibra con él
    anchor = np.argmin(np.linalg.norm(pos[:, None, :] - tmpl[None, :, :], axis=2), axis=1).astype(np.int8)
    print(f"  {ncloud} puntos de nube (cc-pVDZ), anclados a O/H1/H2", flush=True)
    return pos.astype(np.float32), anchor


# confinación ESFÉRICA suave (isotrópica → NO le da forma; solo mantiene la gota junta
# para que el blob 3D emerja en vez de una hoja 2D). Fuerza cero dentro de Rcage; afuera,
# empuja al O de vuelta al centro. Representa la cohesión que tendría una gota más grande.
def confine_force(r, is_O, Rcage, kc):
    Fc = np.zeros_like(r)
    Oi = np.where(is_O)[0]
    ro = r[Oi]; d = np.linalg.norm(ro, axis=1) + 1e-9
    mag = np.where(d > Rcage, -kc * (d - Rcage) / d, 0.0)
    Fc[Oi] = mag[:, None] * ro
    return Fc


# ═══════════════════ producción: el VIAJE con recocido ═══════════════════════
def run_production(rng, NFR, stride, T_hi, T_lo, Rcage=4.8, kc=5.0):
    print(f"── PRODUCCIÓN: {NMOL} aguas, recocido {T_hi:.0f}→{T_lo:.0f} K, "
          f"gota R={Rcage:.1f}Å, {NFR} frames × {stride} pasos ──", flush=True)
    m_arr = np.tile(MOL_MASS, NMOL)
    topo = build_topology(NMOL)
    _, _, q, is_O, *_ = topo
    r = init_state(rng)
    ndof = 3 * len(r) - 6
    v = maxwell(rng, m_arr, T_hi)
    v = remove_com_and_spin(r, v, m_arr)
    F, U = forces(r, m_arr, topo); F = F + confine_force(r, is_O, Rcage, kc)

    LP = 40
    NL = int((~is_O).sum())      # una línea por H
    traj = np.zeros((NFR, len(r), 3), dtype=np.float32)
    fields = np.zeros((NFR, NL, LP, 3), dtype=np.float32)
    Tlog = np.zeros(NFR)

    total = NFR * stride
    SOAK = 0.42                                        # 42% tibio (se buscan + reacomodan en 3D) → enfría
    for step in range(total):
        frac = step / total
        Ttarget = T_hi if frac < SOAK else T_hi + (T_lo - T_hi) * (frac - SOAK) / (1 - SOAK)
        v += 0.5 * ACCFAC * F / m_arr[:, None] * DT
        r += v * DT
        F, U = forces(r, m_arr, topo); F = F + confine_force(r, is_O, Rcage, kc)
        v += 0.5 * ACCFAC * F / m_arr[:, None] * DT
        # termostato Berendsen suave hacia el recocido
        if step % 10 == 0:
            Tnow = temperature(v, m_arr, ndof)
            if Tnow > 1:
                lam = np.sqrt(1 + 0.08 * (Ttarget / Tnow - 1))
                v *= lam
            v = remove_com_and_spin(r, v, m_arr)
        if step % stride == 0:
            fi = step // stride
            if fi < NFR:
                traj[fi] = r
                fields[fi] = trace_lines(r, q, is_O, LP)
                Tlog[fi] = temperature(v, m_arr, ndof)
                if fi % max(1, NFR // 20) == 0:
                    print(f"  frame {fi:4d}/{NFR}  T={Tlog[fi]:6.1f}K  U={U:8.1f}", flush=True)
    return traj, fields, Tlog, (q, is_O, LP, NL)


# ═══════════════════ GATE 3: el puente se formó SOLO ═════════════════════════
def gate_bridges(r, is_O):
    Os = r[is_O]
    n = len(Os)
    D = np.linalg.norm(Os[:, None, :] - Os[None, :, :], axis=2)
    np.fill_diagonal(D, np.inf)
    iu = np.triu_indices(n, 1)
    dists = D[iu]
    bridges = int(np.sum((dists > 2.5) & (dists < 3.3)))
    nn = D.min(axis=1)                                    # vecino O-O más cercano de cada molécula
    frac_bonded = np.mean(nn < 3.3)                       # fracción con un puente
    # achatamiento 3D: núcleo del cluster (excluye evaporadas) — eje menor/mayor
    c = Os.mean(0); dc = np.linalg.norm(Os - c, axis=1); core = Os[dc < 1.6 * np.median(dc)]
    cc = core - core.mean(0); sig = np.sqrt(np.sort(np.linalg.eigvalsh(np.cov(cc.T)))[::-1])
    flat = sig[2] / sig[0]
    print("── GATE 3: puentes + VOLUMEN 3D (emergentes) ──", flush=True)
    print(f"  pares O···O en 2.5–3.3 Å = {bridges}   ·   1er vecino O-O: mediana {np.median(nn):.2f} Å"
          f"  ·  {frac_bonded*100:.0f}% con puente", flush=True)
    print(f"  achatamiento 3D del núcleo = {flat:.2f}  (1=esfera, 0=hoja plana; queremos ≥0.45)", flush=True)
    ok = bridges >= max(3, NMOL - 3) and frac_bonded >= 0.7 and np.median(nn) < 3.2 and flat >= 0.45
    print("  GATE_BRIDGE_OK" if ok else "  GATE_BRIDGE_FAIL", flush=True)
    return ok


# ═══════════════════ escritura del .bin ══════════════════════════════════════
POSQ = 1000.0
def write_bin(traj, fields, cloud, anchor, meta, T_hi, T_lo):
    q, is_O, LP, NL = meta
    NFR = traj.shape[0]; NAT = traj.shape[1]; NCLD = cloud.shape[0]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    def qi16(a):
        return np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s6i', b'MDW2', NFR, NMOL, NL, LP, NCLD, NAT))
        fp.write(struct.pack('<3f', POSQ, T_hi, T_lo))
        fp.write(qi16(cloud).tobytes())              # nube: NCLD×3 (marco molecular, rel O)
        fp.write(anchor.astype('<i1').tobytes())     # ancla por punto (0=O,1=H1,2=H2)
        fp.write(qi16(traj).tobytes())               # NFR×NAT×3
        fp.write(qi16(fields).tobytes())             # NFR×NL×LP×3
    print(f"OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB  "
          f"({NFR} frames, {NAT} átomos, {NL} líneas×{LP}, {NCLD} nube)", flush=True)


# ═══════════════════ figuras de prueba (ver el viaje) ════════════════════════
def proof_figures(traj, fields, Tlog, is_O, freq_data):
    os.makedirs(PROOF, exist_ok=True)
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        NFR = traj.shape[0]
        # el VIAJE: 6 instantáneas
        picks = np.linspace(0, NFR - 1, 6).astype(int)
        fig, axs = plt.subplots(2, 3, figsize=(15, 10), facecolor='black')
        for ax, fi in zip(axs.ravel(), picks):
            ax.set_facecolor('black')
            r = traj[fi]
            for ln in fields[fi]:
                ax.plot(ln[:, 0], ln[:, 1], c='#7d5cff', alpha=0.30, lw=0.7)
            Op = r[is_O]; Hp = r[~is_O]
            ax.scatter(Hp[:, 0], Hp[:, 1], s=14, c='#ffb43c', zorder=5)
            ax.scatter(Op[:, 0], Op[:, 1], s=60, c='#b04cff', zorder=6, edgecolors='none')
            ax.set_aspect('equal'); ax.set_xlim(-16, 16); ax.set_ylim(-16, 16)
            ax.set_title(f"t={fi} · T={Tlog[fi]:.0f}K", color='white', fontsize=11)
            ax.axis('off')
        fig.suptitle("EL VIAJE — 10 aguas se buscan y se pegan SOLAS (nada pre-seteado)",
                     color='white', fontsize=15)
        fig.tight_layout(); fp = os.path.join(PROOF, 'md-journey.png')
        fig.savefig(fp, dpi=90, facecolor='black'); plt.close(fig)
        print(f"figura viaje:   {fp}", flush=True)

        # espectro de frecuencias
        r1t, r2t, tht, dt = freq_data
        fig, ax = plt.subplots(figsize=(11, 5), facecolor='white')
        for sig, lab, col in [(r1t + r2t, 'sym-stretch', '#c0392b'),
                              (r1t - r2t, 'asym-stretch', '#2980b9'),
                              (tht * 30, 'bend (×30)', '#27ae60')]:
            s = (sig - sig.mean()) * np.hanning(len(sig))
            S = np.abs(np.fft.rfft(s))
            f = np.fft.rfftfreq(len(s), d=dt * 1e-15) / 2.99792458e10
            ax.plot(f, S / S.max(), label=lab, color=col, lw=1.2)
        for real, lab in [(3657, 'ν1'), (1595, 'ν2'), (3756, 'ν3')]:
            ax.axvline(real, ls='--', c='k', alpha=0.4)
            ax.text(real, 1.02, f"{lab}={real}", fontsize=8, ha='center')
        ax.set_xlim(0, 4200); ax.set_xlabel('cm⁻¹'); ax.set_ylabel('|FFT| norm')
        ax.set_title('GATE frecuencias — vibraciones del agua (medidas vs reales)')
        ax.legend(); fig.tight_layout()
        fp = os.path.join(PROOF, 'md-spectrum.png'); fig.savefig(fp, dpi=90); plt.close(fig)
        print(f"figura espectro:{fp}", flush=True)

        # temperatura (recocido)
        fig, ax = plt.subplots(figsize=(11, 4), facecolor='white')
        ax.plot(Tlog, color='#e67e22'); ax.set_xlabel('frame'); ax.set_ylabel('T (K)')
        ax.set_title('Recocido: temperatura vs tiempo (la perilla)')
        fig.tight_layout(); fp = os.path.join(PROOF, 'md-temperature.png')
        fig.savefig(fp, dpi=90); plt.close(fig)
        print(f"figura T:       {fp}", flush=True)
    except Exception as e:
        print("figuras fallaron:", e, flush=True)


def main():
    rng = np.random.default_rng(SEED)
    print(f"════ MD AGUA · {NMOL} moléculas · dt={DT} fs · seed={SEED} ════", flush=True)

    ok_f, freqs, freq_data = gate_frequencies()
    ok_e = gate_energy(np.random.default_rng(SEED + 1))

    NFR    = 220 if QUICK else 600
    stride = 55 if QUICK else 85
    T_hi, T_lo = 250.0, 50.0
    Rcage = 4.6 if QUICK else 4.8
    traj, fields, Tlog, meta = run_production(np.random.default_rng(SEED + 2),
                                              NFR, stride, T_hi, T_lo, Rcage=Rcage, kc=5.0)
    q, is_O, LP, NL = meta
    ok_b = gate_bridges(traj[-1], is_O)

    ncloud = 2600 if QUICK else 3400
    cloud, anchor = density_cloud(ncloud, np.random.default_rng(SEED + 3))

    write_bin(traj, fields, cloud, anchor, meta, T_hi, T_lo)
    proof_figures(traj, fields, Tlog, is_O, freq_data)

    print("\n════ RESUMEN GATES ════", flush=True)
    print(f"  frecuencias: {'OK' if ok_f else 'FAIL'}  {freqs}", flush=True)
    print(f"  energía:     {'OK' if ok_e else 'FAIL'}", flush=True)
    print(f"  puentes:     {'OK' if ok_b else 'FAIL'}", flush=True)
    print("MD_WATER_LISTO" if (ok_f and ok_e and ok_b) else "MD_WATER_GATES_FALLARON", flush=True)


if __name__ == '__main__':
    main()
