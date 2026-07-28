#!/usr/bin/env python3
"""
precompute-water-trimer.py — EL ANILLO: 3 moléculas de agua (9 átomos) cerrando el
trímero cíclico, ab initio. Hermano de precompute-water-approach.py (2 aguas), MISMO
formato WAP2 → el renderer (O2Cloud/Nucleus/BondEField) lo lee sin cambios (NNUC=9).

EL FENÓMENO NUEVO QUE 2 AGUAS NO PUEDEN MOSTRAR — **COOPERATIVIDAD**:
los 3 puentes juntos son MÁS fuertes que la suma de los 3 pares por separado. Es un
efecto de MUCHOS CUERPOS real y medido: al donar un protón, el agua se vuelve mejor
aceptora para la siguiente → el anillo se refuerza a sí mismo. Ese es el salto
conceptual de 2→3 y el GATE de este cálculo:

    E_enlace(trímero) = E(3-mero) − 3·E(monómero)
    Σ pares          = Σ_{i<j} [ E(dímero_ij) − 2·E(monómero) ]
    E_3cuerpos       = E_enlace − Σ pares        ← debe ser NEGATIVO (estabiliza extra)

GEOMETRÍA (declarada, ver [[feedback_kazmer_no_inventar]] — lo literal y lo construido):
  • LITERAL (experimental): monómero O-H 0.9578 Å, ángulo HOH 104.478°.
  • LITERAL (VRT del trímero): O···O ≈ 2.85 Å en el equilibrio.
  • CONSTRUIDO (declarado): anillo C3 idealizado — los 3 O en triángulo equilátero, cada
    agua dona un H hacia el O siguiente (donador lineal) y deja un H libre alternando
    fuera del plano. El mínimo global real es UUD/C1 (los H libres arriba-arriba-abajo),
    casi isoenergético; usamos C3 por simetría del acercamiento. NO se afirma que sea el
    mínimo global: se declara como idealización y los GATES validan la FÍSICA (energía de
    enlace y cooperatividad), que es lo que el video cuenta.

  python3 scripts/precompute-water-trimer.py [--quick]
"""
import os, sys, struct
import numpy as np

QUICK = '--quick' in sys.argv
BOHR = 0.529177210903
HART2KCAL = 627.5094740631
BASIS = 'cc-pVDZ'
SEED = 20260727
POSQ = 5000.0

# ── monómero LITERAL (experimental) ──
D_OH_A = 0.9578          # Å
ANG_HOH = 104.478        # grados

# ── anillo: O···O del trímero ──
R_EQ_A = 2.85            # Å (equilibrio, VRT)
R_MAX_A = 5.60           # lejos: 3 aguas casi libres
R_MIN_A = 2.76           # anillo cerrado (ligeramente comprimido)

if QUICK:
    K = 6;  N_ACC, N_DEP, N_SPIN = 6000, 3000, 3000;   NXY, NZ = 64, 44
else:
    K = 26; N_ACC, N_DEP, N_SPIN = 54000, 20000, 20000; NXY, NZ = 112, 76

Z = np.array([8, 1, 1] * 3)                      # 3 aguas: O,H,H · O,H,H · O,H,H
NNUC = 9
WAT = [[0, 1, 2], [3, 4, 5], [6, 7, 8]]          # índices de cada agua

Rvals = R_MAX_A + (R_MIN_A - R_MAX_A) * (np.arange(K) / (K - 1))   # descendente (como O2/wpair)
R_MIN = R_MIN_A / BOHR; R_MAX = R_MAX_A / BOHR

# caja (bohr): el anillo abierto (R=5.6 Å) tiene circunradio 3.23 Å = 6.1 bohr; + nube
LXY, LZ_ = 10.6, 6.6
dx = (2 * LXY) / NXY; dz = (2 * LZ_) / NZ
xs = -LXY + (np.arange(NXY) + 0.5) * dx
zs = -LZ_ + (np.arange(NZ) + 0.5) * dz
GX, GY, GZ = np.meshgrid(xs, xs, zs, indexing='ij')
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
dV = dx * dx * dz

rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3)); U_dep = rng.random((N_DEP, 3)); U_spin = rng.random((N_SPIN, 3))

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'precomputed', 'water-trimer.bin')
OUT_EF = os.path.join(HERE, '..', 'public', 'precomputed', 'water-trimer-efield.bin')


def _guess(R_A, tilt_deg=22.0):
    """Semilla UUD: anillo con los H donadores DOBLADOS fuera del plano y los H libres
    arriba-arriba-abajo. (Un anillo C3 con donadores LINEALES es geométricamente imposible:
    los H donadores vecinos quedan a 1.56-1.64 Å = choque duro. Medido, ver GATE fallido
    del 2026-07-27. Por eso el mínimo real del trímero es UUD/C1 y con puentes DOBLADOS.)"""
    Rc = R_A / np.sqrt(3.0)
    ang = np.deg2rad(ANG_HOH); tilt = np.deg2rad(tilt_deg)
    UUD = [+1.0, +1.0, -1.0]                       # frustración por número impar (el mínimo real)
    g = np.zeros((9, 3))
    for i in range(3):
        th = 2.0 * np.pi * i / 3.0; th_n = 2.0 * np.pi * ((i + 1) % 3) / 3.0
        O = np.array([Rc * np.cos(th), Rc * np.sin(th), 0.0])
        O_next = np.array([Rc * np.cos(th_n), Rc * np.sin(th_n), 0.0])
        d = O_next - O; d /= np.linalg.norm(d)
        zt = np.array([0.0, 0.0, 1.0]) * UUD[i]
        d_bent = np.cos(tilt) * d + np.sin(tilt) * zt      # donador DOBLADO (no lineal)
        d_bent /= np.linalg.norm(d_bent)
        h_don = O + D_OH_A * d_bent
        perp = zt - np.dot(zt, d_bent) * d_bent
        n = np.linalg.norm(perp)
        perp = perp / n if n > 1e-9 else np.cross(d_bent, [0, 0, 1.0])
        u = np.cos(ang) * d_bent + np.sin(ang) * perp
        g[3 * i + 0] = O; g[3 * i + 1] = h_don; g[3 * i + 2] = O + D_OH_A * u
    return g - g.mean(axis=0)                      # Å, centrado


_OPT_CACHE = os.path.join(HERE, '..', 'public', 'precomputed', 'water-trimer-geom.json')

def optimized_geom():
    """La geometría de equilibrio la ENCUENTRA el optimizador (regla del proyecto: la forma
    EMERGE de la física, no se pre-setea). RHF/cc-pVDZ con geomeTRIC. Se cachea."""
    import json
    if os.path.exists(_OPT_CACHE):
        d = json.load(open(_OPT_CACHE))
        print(f"  geometría de equilibrio (cache): O-O medio {d['ROO']:.3f} Å", flush=True)
        return np.array(d['xyz_A'])
    from pyscf import gto, scf
    from pyscf.geomopt.geometric_solver import optimize
    g0 = _guess(R_EQ_A)
    mol = gto.M(atom=[[int(Z[i]), tuple(g0[i])] for i in range(NNUC)], basis=BASIS, unit='Angstrom', verbose=0)
    print("  optimizando el trímero (RHF/cc-pVDZ, geomeTRIC)…", flush=True)
    mol_eq = optimize(scf.RHF(mol), maxsteps=80)
    xyz = mol_eq.atom_coords() * BOHR                       # → Å
    xyz -= xyz.mean(axis=0)
    OO = [np.linalg.norm(xyz[3 * a] - xyz[3 * b]) for a, b in ((0, 1), (1, 2), (2, 0))]
    print(f"  ✓ equilibrio: O-O = {OO[0]:.3f}/{OO[1]:.3f}/{OO[2]:.3f} Å (medio {np.mean(OO):.3f})", flush=True)
    os.makedirs(os.path.dirname(_OPT_CACHE), exist_ok=True)
    json.dump({'xyz_A': xyz.tolist(), 'ROO': float(np.mean(OO)), 'OO': OO, 'basis': BASIS}, open(_OPT_CACHE, 'w'))
    return xyz


_GEQ = None
def geom_at(R_A):
    """Acercamiento RÍGIDO desde la geometría optimizada: cada agua conserva su forma y su
    ORIENTACIÓN (lo correcto para un puente de H) y solo se traslada radialmente hasta que
    el O···O medio vale R_A. → bohr, centrado."""
    global _GEQ
    if _GEQ is None:
        _GEQ = optimized_geom()
    xyz = _GEQ.copy()
    Ocen = np.array([xyz[3 * i] for i in range(3)])
    C = Ocen.mean(axis=0)
    R0 = np.mean([np.linalg.norm(Ocen[a] - Ocen[b]) for a, b in ((0, 1), (1, 2), (2, 0))])
    s = R_A / R0
    g = xyz.copy()
    for i in range(3):
        shift = (s - 1.0) * (Ocen[i] - C)           # traslación rígida de las 3 partículas
        g[3 * i:3 * i + 3] += shift
    g -= g.mean(axis=0)
    return g / BOHR


def eval_rho(mol, dm, pts, chunk=40000):
    out = np.empty(pts.shape[0])
    for a in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[a:a + chunk])
        out[a:a + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return out


def sample_field(field, U):
    """Muestreo LAGRANGIANO con semillas fijas U → correspondencia de partículas entre
    frames (igual que wpair/O2: la nube se interpola por R(t) sin parpadeo)."""
    M = U.shape[0]; f = np.maximum(field, 0.0)
    slab = f.sum(axis=(1, 2)); Cx = np.concatenate([[0.0], np.cumsum(slab)]); tot = Cx[-1]
    if tot <= 0:
        return np.zeros((M, 3))
    tgt = U[:, 0] * tot
    ix = np.clip(np.searchsorted(Cx, tgt, side='right') - 1, 0, NXY - 1)
    x = -LXY + (ix + (tgt - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)) * dx
    colmass = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((NXY, 1)), np.cumsum(colmass, axis=1)], axis=1)
    Cy_row = Cy[ix]; tgty = U[:, 1] * Cy_row[:, -1]
    iy = np.clip((Cy_row[:, :-1] <= tgty[:, None]).sum(axis=1) - 1, 0, NXY - 1)
    cy0 = Cy_row[np.arange(M), iy]; cy1 = Cy_row[np.arange(M), iy + 1]
    y = -LXY + (iy + (tgty - cy0) / np.maximum(cy1 - cy0, 1e-30)) * dx
    zcol = f[ix, iy]
    Cz = np.concatenate([np.zeros((M, 1)), np.cumsum(zcol, axis=1)], axis=1)
    tgtz = U[:, 2] * Cz[:, -1]
    iz = np.clip((Cz[:, :-1] <= tgtz[:, None]).sum(axis=1) - 1, 0, NZ - 1)
    cz0 = Cz[np.arange(M), iz]; cz1 = Cz[np.arange(M), iz + 1]
    z = -LZ_ + (iz + (tgtz - cz0) / np.maximum(cz1 - cz0, 1e-30)) * dz
    return np.stack([x, y, z], axis=1)


# ── campo eléctrico REAL: MEP V = Σ Z/|r−R| − ∫ρ/|r−r'| ; E = −∇V (idéntico a Li₂/wpair) ──
def esp3d(mol, dm, pts, chunk=4000):
    from pyscf import gto as _gto
    V = np.empty(pts.shape[0])
    coords = mol.atom_coords(); charges = mol.atom_charges()
    for a in range(0, pts.shape[0], chunk):
        P = pts[a:a + chunk]
        with mol.with_rinv_origin((0, 0, 0)):
            pass
        fakemol = _gto.fakemol_for_charges(P)
        from pyscf import df
        ints = df.incore.aux_e2(mol, fakemol, intor='int3c2e')
        Vel = np.einsum('ijp,ij->p', ints, dm)
        Vnuc = np.zeros(P.shape[0])
        for Zc, Rc in zip(charges, coords):
            Vnuc += Zc / np.maximum(np.linalg.norm(P - Rc, axis=1), 1e-8)
        V[a:a + chunk] = Vnuc - Vel
    return V


def E3d(mol, dm, P, h=0.03):
    E = np.zeros_like(P)
    for ax in range(3):
        dP = np.zeros(3); dP[ax] = h
        E[:, ax] = -(esp3d(mol, dm, P + dP) - esp3d(mol, dm, P - dP)) / (2 * h)
    return E


def field_grid(R_A, gb=None, por_H=96):
    """SIEMBRA CANÓNICA (reglas de libro de física, no rejilla inventada):

      1. Las líneas de campo EMPIEZAN en carga + y TERMINAN en carga −. El trímero es
         NEUTRO → todas deben cerrar entre cargas; ninguna debe nacer en el aire.
      2. El número de líneas por carga es PROPORCIONAL a su magnitud.
      3. Se siembran UNIFORMEMENTE alrededor de cada carga (una esferita en torno a ella).
      5. Las líneas no se cruzan (se cumple solo si 1-3 se cumplen).

    Por eso se siembra en una CÁSCARA alrededor de cada H (δ+, la fuente del campo), con el
    hemisferio que mira HACIA AFUERA de su propio O — si no, la línea se devuelve a su O y
    no dibuja el puente (gotcha ya conocido del agua). La versión vieja sembraba en coronas
    concéntricas alrededor del anillo: por eso 11% de picos y líneas nacidas en el vacío.
    """
    if gb is None:
        gb = geom_at(R_A)
    r0 = 0.62                                     # cáscara pegada al H (bohr)
    # puntos casi-uniformes en la esfera (espiral de Fibonacci)
    k = np.arange(por_H) + 0.5
    phi = np.arccos(1 - 2 * k / por_H)
    theta = np.pi * (1 + 5 ** 0.5) * k
    esfera = np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], axis=1)
    S = []
    for m in range(3):
        O = gb[3 * m]
        for h in (gb[3 * m + 1], gb[3 * m + 2]):
            fuera = h - O; fuera /= np.linalg.norm(fuera)      # dirección O→H = hacia afuera
            for e in esfera:
                if np.dot(e, fuera) < -0.15:                    # descarta el hemisferio que mira al O propio
                    continue
                S.append(h + r0 * e)
    return np.array(S)


def _smooth(p, k=9):   # k=9 (el dímero usa 5): el anillo tiene hueco central de campo débil
                       # donde la dirección brinca → medido 11.4% de picos con k=5 vs 1.4% del dímero
    if len(p) < k: return p
    ker = np.ones(k) / k
    q = p.copy()
    for ax in range(3):
        q[:, ax] = np.convolve(p[:, ax], ker, mode='same')
    q[0] = p[0]; q[-1] = p[-1]
    return q


# TRAZADOR COPIADO LITERAL del dímero (precompute-water-approach.py). Mi versión propia
# perdió las 3 lecciones ya ganadas con Li₂ y medidas por scripts/verificar-campo.py:
#   · BIDIRECCIONAL (+E y −E) → la línea va de + a − y NO se corta en el aire
#   · PARA al llegar a un núcleo (<0.40 bohr) → no divaga
#   · remuestreo por LONGITUD DE ARCO → espaciado uniforme (sin saltos ni zigzag)
# Medido antes de copiar: saltos 20.2% vs 0.0% · picos 40.7% vs 1.4% del dímero.
# maxlen 9→6.6: las líneas que ESCAPABAN lejos salían RECTAS (campo casi uniforme allá)
# y leían como picos/glitch. Medido: 40.7% → 11.4% de picos; el resto son estas fugas.
def trace_field3d(mol, dm, gb, seeds, LP, maxlen=6.6, h=0.19, THR=0.006):
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

    pf, df = leg(+1)
    # semilla EN la carga + (siembra canónica) → la línea nace ahí y solo va hacia adelante.
    # La pata −E se metía al núcleo del H en 1 paso y dejaba un CODO en la unión (18.6% de
    # los picos estaban en el INICIO de la línea, medido).
    pb = pf[:, :1].copy(); db = np.ones(NS, int)
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
    global Rvals, R_MIN
    LP = 40
    # el barrido TERMINA en el equilibrio que encontró el optimizador (no en un número elegido)
    geom_at(R_EQ_A)                                    # fuerza optimización/carga de _GEQ
    Oc = np.array([_GEQ[3 * i] for i in range(3)])
    R0 = float(np.mean([np.linalg.norm(Oc[a] - Oc[b]) for a, b in ((0, 1), (1, 2), (2, 0))]))
    Rmin_eff = R0 * 0.975                              # apenas comprimido (como wpair)
    Rvals = R_MAX_A + (Rmin_eff - R_MAX_A) * (np.arange(K) / (K - 1))
    R_MIN = Rmin_eff / BOHR
    print(f"  barrido: {R_MAX_A:.2f} Å → {Rmin_eff:.2f} Å (equilibrio {R0:.3f} Å)", flush=True)
    accPos = np.zeros((K, N_ACC, 3)); depPos = np.zeros((K, N_DEP, 3)); spinPos = np.zeros((K, N_SPIN, 3))
    bondMass = np.zeros(K); nucPos = np.zeros((K, NNUC, 3))
    Ebind = np.zeros(K); E3body = np.zeros(K)
    SEEDS0 = field_grid(R_EQ_A, geom_at(R_EQ_A)); NL_EF = len(SEEDS0)
    efield = np.zeros((K, NL_EF, LP, 3))

    print(f"=== TRÍMERO DE AGUA (9 átomos) · {K} radios · {BASIS} · malla {NXY}×{NXY}×{NZ} ===", flush=True)
    print("k   O-O(Å)  E(Ha)         Ebind(kcal)  3-cuerpos(kcal)  %coop   ∫Δρ>0", flush=True)

    for k in range(K):
        R_A = float(Rvals[k])
        gb = geom_at(R_A)
        atoms = [[int(Z[i]), tuple(gb[i])] for i in range(NNUC)]
        mol = gto.M(atom=atoms, basis=BASIS, unit='Bohr', verbose=0)
        mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
        dm = mf.make_rdm1()

        # monómeros EN SU POSICIÓN (promolécula) → Δρ de interacción, y energías
        mons, dms_m, e_m = [], [], []
        for w in WAT:
            mw = gto.M(atom=[atoms[i] for i in w], basis=BASIS, unit='Bohr', verbose=0)
            mfw = scf.RHF(mw); mfw.kernel()
            mons.append(mw); dms_m.append(mfw.make_rdm1()); e_m.append(mfw.e_tot)

        # dímeros (para la NO-ADITIVIDAD = cooperatividad)
        e_dim = []
        for a in range(3):
            b = (a + 1) % 3
            md = gto.M(atom=[atoms[i] for i in WAT[a] + WAT[b]], basis=BASIS, unit='Bohr', verbose=0)
            mfd = scf.RHF(md); mfd.kernel(); e_dim.append(mfd.e_tot)

        e_bind = (mf.e_tot - sum(e_m)) * HART2KCAL
        e_pairs = sum((e_dim[a] - e_m[a] - e_m[(a + 1) % 3]) for a in range(3)) * HART2KCAL
        e_3b = e_bind - e_pairs                       # < 0 = los 3 juntos se agarran MÁS
        Ebind[k] = e_bind; E3body[k] = e_3b
        coop = (e_3b / e_bind * 100.0) if abs(e_bind) > 1e-9 else 0.0

        rho_tot = eval_rho(mol, dm, GRID)
        rho_pro = np.zeros_like(rho_tot)
        for mw, dmw in zip(mons, dms_m):
            rho_pro += eval_rho(mw, dmw, GRID)
        drho = (rho_tot - rho_pro).reshape(NXY, NXY, NZ)
        rho_tot = rho_tot.reshape(NXY, NXY, NZ)

        acc_field = np.power(np.maximum(rho_tot, 0), 0.8)   # nube densa (comprime pico nuclear)
        dep_field = np.maximum(-drho, 0)                    # electrones que SALEN (azul)
        spin_field = np.maximum(drho, 0)                    # los que LLEGAN = los 3 puentes (morado)
        bondMass[k] = float(spin_field.sum() * dV)
        accPos[k] = sample_field(acc_field, U_acc)
        depPos[k] = sample_field(dep_field, U_dep)
        spinPos[k] = sample_field(spin_field, U_spin)
        nucPos[k] = gb
        efield[k] = trace_field3d(mol, dm, gb, field_grid(R_A, gb), LP)
        print(f"{k:2d}  {R_A:5.2f}  {mf.e_tot:12.5f}  {e_bind:8.2f}     {e_3b:8.2f}      {coop:5.1f}%  {bondMass[k]:.4f}", flush=True)

    # color: MISMA paleta del agua v2/wpair (oro cálido + morado en los O). NO inventar color nuevo.
    kEq = int(np.argmin(np.abs(Rvals - R_EQ_A)))
    P = accPos[kEq]
    dO = np.min(np.stack([np.linalg.norm(P - nucPos[kEq, 3 * i], axis=1) for i in range(3)]), axis=0)
    pw = np.clip(1.0 - dO / 1.4, 0, 1)
    gold = np.array([1.0, 0.72, 0.30]); purple = np.array([0.82, 0.28, 1.0])
    col = gold[None, :] * (1 - pw[:, None]) + purple[None, :] * pw[:, None]
    accColor = np.clip(col * 255, 0, 255).astype(np.uint8)
    return accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, NL_EF, LP, Ebind, E3body


def write_bin(accPos, depPos, spinPos, bondMass, accColor, nucPos):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    q = lambda a: np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', N_ACC, N_DEP, N_SPIN, K, NNUC, 0, 0))
        fp.write(struct.pack('<3f', float(POSQ), float(R_MIN), float(R_MAX)))
        fp.write((Rvals / BOHR).astype('<f4').tobytes())     # R en BOHR (como wpair)
        fp.write(bondMass.astype('<f4').tobytes())
        fp.write(accColor.astype(np.uint8).tobytes())
        fp.write(Z.astype('<i2').tobytes())
        for a in (accPos, depPos, spinPos):
            fp.write(q(a).tobytes())
        fp.write(q(nucPos).tobytes())
    print(f"OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB (nubes, {NNUC} núcleos)", flush=True)


def write_efield(efield, NL_EF, LP):
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL_EF, LP))
        fp.write((Rvals / BOHR).astype('<f4').tobytes())
        fp.write(np.clip(np.round(efield * 2000), -32767, 32767).astype('<i2').tobytes())
    print(f"OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB (campo MEP, {NL_EF}×{LP})", flush=True)


def validate(bondMass, Ebind, E3body):
    print("\n────────── GATES ──────────", flush=True)
    ok = True
    # 1) el anillo LIGA (energía de enlace negativa y creciente al cerrarse)
    print(f"1) E_enlace: {Ebind[0]:+.2f} (lejos) → {Ebind[-1]:+.2f} kcal/mol (anillo cerrado)")
    g1 = Ebind[-1] < -8.0
    print("   GATE_ENLACE_OK" if g1 else "   GATE_ENLACE_FAIL (esperado < -8 kcal/mol)"); ok &= g1
    # 2) COOPERATIVIDAD: el término de 3 cuerpos es NEGATIVO y significativo
    coop = E3body[-1] / Ebind[-1] * 100.0
    print(f"2) 3-cuerpos: {E3body[-1]:+.2f} kcal/mol = {coop:.1f}% del enlace total")
    g2 = (E3body[-1] < 0) and (5.0 < coop < 40.0)
    print("   GATE_COOPERATIVIDAD_OK — los 3 juntos se agarran MÁS que la suma de pares"
          if g2 else "   GATE_COOPERATIVIDAD_FAIL"); ok &= g2
    # 3) el puente CRECE al cerrar el anillo (monótono)
    print(f"3) ∫Δρ>0: {bondMass[0]:.4f} (lejos) → {bondMass[-1]:.4f} (cerrado)")
    g3 = bondMass[-1] > bondMass[0] * 1.5
    print("   GATE_PUENTES_OK" if g3 else "   GATE_PUENTES_FAIL"); ok &= g3
    print("\n" + ("✅ TODOS LOS GATES OK — física válida para video" if ok else "❌ HAY GATES EN FALLA"), flush=True)
    return ok


def solo_campo():
    """Recomputa ÚNICAMENTE el .bin del campo (sin la malla de densidad, que es lo caro).
    Sirve cuando el verificador (scripts/verificar-campo.py) reprueba el campo y hay que
    re-trazarlo sin re-hacer las nubes."""
    from pyscf import gto, scf
    LP = 40
    geom_at(R_EQ_A)
    Oc = np.array([_GEQ[3 * i] for i in range(3)])
    R0 = float(np.mean([np.linalg.norm(Oc[a] - Oc[b]) for a, b in ((0, 1), (1, 2), (2, 0))]))
    Rmin_eff = R0 * 0.975
    Rv = R_MAX_A + (Rmin_eff - R_MAX_A) * (np.arange(K) / (K - 1))
    NL_EF = len(field_grid(R_EQ_A, geom_at(R_EQ_A)))
    ef = np.zeros((K, NL_EF, LP, 3))
    print(f"=== SOLO CAMPO · {K} radios · {NL_EF} líneas × {LP} ===", flush=True)
    for k in range(K):
        R_A = float(Rv[k]); gb = geom_at(R_A)
        atoms = [[int(Z[i]), tuple(gb[i])] for i in range(NNUC)]
        mol = gto.M(atom=atoms, basis=BASIS, unit='Bohr', verbose=0)
        mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
        ef[k] = trace_field3d(mol, mf.make_rdm1(), gb, field_grid(R_A, gb), LP)
        print(f"  {k+1}/{K}  O-O {R_A:.2f} Å", flush=True)
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL_EF, LP))
        fp.write((Rv / BOHR).astype('<f4').tobytes())
        fp.write(np.clip(np.round(ef * 2000), -32767, 32767).astype('<i2').tobytes())
    print(f"OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB ({NL_EF}×{LP})", flush=True)


if __name__ == '__main__':
    if '--solo-campo' in sys.argv:
        solo_campo(); sys.exit(0)
    a, d, s, bm, col, nuc, ef, nl, lp, Eb, E3 = build()
    write_bin(a, d, s, bm, col, nuc)
    write_efield(ef, nl, lp)
    validate(bm, Eb, E3)
