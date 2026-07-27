#!/usr/bin/env python3
"""
precompute-bond-abinitio.py — LA FORMACION DE UN ENLACE, DESDE LA CUANTICA REAL.
Version PARAMETRIZADA (parte del "proceso ordenado" de la serie de enlaces).

PySCF resuelve la Schrodinger electronica de una DIATOMICA a cada separacion R y
guarda la DENSIDAD DE DEFORMACION  Delta-rho(r;R) = rho(mol) - rho(promolecula)
muestreada en particulas LAGRANGIANAS advectadas (semillas fijas -> la carga FLUYE
al enlace). 3 nubes: acumulacion (oro sigma -> ambar pi), vaciado (azul), espin
(violeta = e- desapareados, el iman; VACIA si la molecula es singlete).

Singlete (spin=0, ej. N2/F2/H2): RHF, sin espin (no magnetico).
Triplete (spin=2, ej. O2): UHF, con espin (paramagnetico).

Salida .bin (identico formato para todos):  <mol>-abinitio.bin
  int32 N_acc,N_dep,N_spin,K · float32 R_min,R_max · float32[K] Rvals,accMass,
  depMass,spinMass,bondMass · uint8[N_acc*3] accColor · int16[K*N*3] acc/dep/spin Pos

Uso:  python3 scripts/precompute-bond-abinitio.py <mol> [quick]
      <mol> = n2 | o2 | f2 | h2      (eje de enlace = x)
"""
import sys, os, struct
import numpy as np

BOHR = 0.529177210903          # A por bohr

# ---- catalogo de enlaces (Re MEDIDO en A, spin=2e- desapareados, scan R en bohr) ----
# 'pi' = color del anillo pi (fuera del eje). Da riqueza cromatica: nucleo sigma
# calido + anillo pi frio. N2 (triple, pi fuerte) -> cian brillante = su firma.
MOLS = {
    'h2': {'el': 'H', 'spin': 0, 'Re': 0.7414,  'Rmin': 1.05, 'Rmax': 3.60},
    'n2': {'el': 'N', 'spin': 0, 'Re': 1.09769, 'Rmin': 1.75, 'Rmax': 4.60, 'pi': [0.24, 0.82, 1.0]},
    'o2': {'el': 'O', 'spin': 2, 'Re': 1.20752, 'Rmin': 1.90, 'Rmax': 4.80},
    'f2': {'el': 'F', 'spin': 0, 'Re': 1.41193, 'Rmin': 2.20, 'Rmax': 5.20},
    'c2': {'el': 'C', 'spin': 0, 'Re': 1.2425,  'Rmin': 1.85, 'Rmax': 4.90, 'pi': [0.45, 0.75, 1.0]},
    # 2ª fila débil: Li₂ enlace σ real pero LARGO y DIFUSO (orden 1) → caja grande.
    'li2': {'el': 'Li', 'spin': 0, 'Re': 2.6729, 'Rmin': 4.2, 'Rmax': 10.6, 'LX': 6.8, 'LR': 4.2},
    # Be₂ FANTASMA: orden 0 (HF no enlaza). 'ghost' → acc = σ2g enlazante, 3ª nube =
    # σ2u* antienlazante (el gemelo que CANCELA). El centro sale OSCURO = la historia.
    'be2': {'el': 'Be', 'spin': 0, 'Re': 2.4536, 'Rmin': 3.8, 'Rmax': 9.4, 'LX': 6.5, 'LR': 4.0,
            'ghost': True, 'pi': [0.32, 0.80, 1.0]},
    # ── PRIMER PAR HETERONUCLEAR de la serie: EL ROBO DEL ELECTRÓN ──
    # NaCl gas (diatómica REAL): Re = 2.3609 Å medido (Huber-Herzberg), singlete.
    # El drama: Δρ vs promolécula (átomos NEUTROS) muestra la carga ACUMULÁNDOSE
    # en el Cl (acc, oro = lo robado) y VACIÁNDOSE del Na (dep, azul = lo perdido)
    # conforme se acercan. Verificable: μ(Re) experimental = 9.00 D.
    # HONESTIDAD DEL MÉTODO: RHF sesga a iónico a R grande (límite conocido; el
    # salto del "arpón" exacto pediría multireferencia) — se ETIQUETA, el robo a
    # distancias químicas es real. Caja GRANDE: el Cl⁻ es gordo y el scan llega
    # a 13 bohr (núcleos a ±6.5).
    # npart: la caja de NaCl es ~2.4× el VOLUMEN de las homonucleares (scan a 13
    # bohr + Cl⁻ gordo); con el presupuesto estándar la nube salía RALA (feedback
    # de Ian: "hay muy pocas partículas"). Presupuesto ∝ volumen.
    'nacl': {'els': ('Na', 'Cl'), 'spin': 0, 'Re': 2.3609, 'Rmin': 3.6, 'Rmax': 13.0,
             'LX': 10.5, 'LR': 5.2, 'npart': 2.6},
    # ── HF: EL TIRANO — polar covalente (el contraste con el robo de NaCl) ──
    # El flúor tiene la electronegatividad MÁXIMA de la tabla (3.98)… y aun así
    # NO le roba el electrón al hidrógeno: lo comparte TORCIDO. El Δρ muestra el
    # puente desplazado hacia el F = el jaloneo desigual. Re = 0.9168 Å medido
    # (Huber-Herzberg). Verificable: μ(Re) experimental = 1.826 D. Caja chica
    # (el F es compacto y el H diminuto).
    'hf': {'els': ('H', 'F'), 'spin': 0, 'Re': 0.9168, 'Rmin': 1.15, 'Rmax': 4.6},
    # ── CO: EL ABRAZO ASESINO — el enlace MÁS FUERTE de la naturaleza ──
    # 1072 kJ/mol (triple enlace, isoelectrónico con N₂). Re = 1.1283 Å medido
    # (Huber-Herzberg). Caja como N₂ (mismo conteo electrónico, enlace compacto).
    # HONESTIDAD DEL MÉTODO: RHF INVIERTE el signo de μ en CO (caso de libro:
    # exp +0.122 D con polaridad C⁻O⁺; RHF da ~−0.3 D). El gate de verificación
    # aquí es Re (1.128 Å), NO μ — y la paradoja se cuenta como parte del guion.
    'co': {'els': ('C', 'O'), 'spin': 0, 'Re': 1.1283, 'Rmin': 1.75, 'Rmax': 4.60,
           'pi': [0.24, 0.82, 1.0]},
    # ── NO: EL MENSAJERO — radical de capa abierta, orden de enlace 2.5 ──
    # UN electrón desapareado (spin=1): por eso es un RADICAL, y por eso tu cuerpo
    # lo usa para señalizar (Nobel de Medicina 1998: relaja el músculo de las
    # arterias). Ese electrón solitario vive en un π* ANTIENLAZANTE — media unión
    # deshecha → orden 2.5, no 3. Re = 1.1508 Å medido (Huber-Herzberg).
    # La nube de ESPÍN (como en O₂) es la protagonista: es el electrón suelto.
    'no': {'els': ('N', 'O'), 'spin': 1, 'Re': 1.1508, 'Rmin': 1.80, 'Rmax': 4.70},
    # ── HCl: EL ÁCIDO — polar covalente, gancho visceral (está en tu estómago) ──
    # El cloro jala el electrón del hidrógeno (como el flúor en HF, menos violento):
    # q(H) ≈ +0.2, enlace covalente POLAR. Re = 1.2746 Å medido (Huber-Herzberg).
    # AQUÍ μ SÍ sirve de gate: medido 1.08 D (RHF lo da cerca; no hay inversión como
    # en CO ni exageración iónica como en NaCl a R grande). Caja: H diminuto, Cl gordo.
    'hcl': {'els': ('H', 'Cl'), 'spin': 0, 'Re': 1.2746, 'Rmin': 1.9, 'Rmax': 5.2},
}

MOL = (sys.argv[1] if len(sys.argv) > 1 else 'n2').lower()
QUICK = 'quick' in sys.argv
if MOL not in MOLS:
    sys.exit(f"mol desconocida: {MOL}. Opciones: {list(MOLS)}")
CFG = MOLS[MOL]
# heteronuclear: 'els' = (izquierdo, derecho); homonuclear sigue con 'el'
EL_A, EL_B = CFG['els'] if 'els' in CFG else (CFG['el'], CFG['el'])
EL, SPIN = EL_A, CFG['spin']
RE = CFG['Re'] / BOHR
R_MIN, R_MAX = CFG['Rmin'], CFG['Rmax']

BASIS = 'cc-pvtz'
if QUICK:
    K = 6;  N_ACC, N_DEP, N_SPIN = 4000, 2500, 2000;  NX, NY, NZ = 64, 44, 44
else:
    K = 48; N_ACC, N_DEP, N_SPIN = 24000, 13000, 9000; NX, NY, NZ = 104, 76, 76
# cajas grandes → más partículas (misma DENSIDAD visual que la serie)
_NP = CFG.get('npart', 1.0)
N_ACC = int(N_ACC * _NP); N_DEP = int(N_DEP * _NP); N_SPIN = int(N_SPIN * _NP)

LX, LR = CFG.get('LX', 5.2), CFG.get('LR', 3.7)   # caja de muestreo (bohr); grande p/ Li/Be difusos
POSQ = 5000
SEED = 20260630
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', f'{MOL}-abinitio.bin')

Rvals = R_MAX + (R_MIN - R_MAX) * (np.arange(K) / (K - 1))
rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3)); U_dep = rng.random((N_DEP, 3)); U_spin = rng.random((N_SPIN, 3))

dx = (2 * LX) / NX; dy = (2 * LR) / NY; dz = (2 * LR) / NZ
xs = -LX + (np.arange(NX) + 0.5) * dx
ys = -LR + (np.arange(NY) + 0.5) * dy
zs = -LR + (np.arange(NZ) + 0.5) * dz
GX, GY, GZ = np.meshgrid(xs, ys, zs, indexing='ij')
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
NV = GRID.shape[0]; dV = dx * dy * dz


def eval_rhos(mol, dms, pts, chunk=40000):
    outs = [np.empty(pts.shape[0]) for _ in dms]
    for s in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[s:s + chunk])
        for d, dm in enumerate(dms):
            outs[d][s:s + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return outs


def classify_sigma_pi(mol, C, occ):
    """Etiqueta cada MO ocupado como sigma/pi/delta por su armonico azimutal REAL
    alrededor del eje de enlace (x): sigma=|m|0, pi=|m|1, delta=|m|2. Es la DEFINICION
    fisica de sigma/pi (proyeccion del momento angular sobre el eje), no un proxy.
    Devuelve (idx_sigma, idx_pi, idx_delta) sobre los MO ocupados."""
    occ_idx = np.where(occ > 1e-6)[0]
    xs_s = np.linspace(-1.4, 1.4, 15)
    rs_s = np.array([0.25, 0.5, 0.8, 1.1, 1.5])
    phis = np.linspace(0, 2 * np.pi, 24, endpoint=False)
    pts = np.array([[x, r * np.cos(p), r * np.sin(p)]
                    for x in xs_s for r in rs_s for p in phis])
    ao = mol.eval_gto('GTOval', pts)
    mo = (ao @ C[:, occ_idx]).reshape(len(xs_s), len(rs_s), len(phis), -1)
    a0 = mo.mean(axis=2)                                             # componente m=0 (sigma)
    a1 = (mo * np.cos(phis)[None, None, :, None]).mean(axis=2)
    b1 = (mo * np.sin(phis)[None, None, :, None]).mean(axis=2)       # componente |m|=1 (pi)
    a2 = (mo * np.cos(2 * phis)[None, None, :, None]).mean(axis=2)
    b2 = (mo * np.sin(2 * phis)[None, None, :, None]).mean(axis=2)   # componente |m|=2 (delta)
    w = np.broadcast_to(rs_s[None, :, None], a0.shape)               # peso cilindrico r dr
    p_sig = (w * a0 ** 2).sum(axis=(0, 1))
    p_pi = (w * (a1 ** 2 + b1 ** 2)).sum(axis=(0, 1))
    p_del = (w * (a2 ** 2 + b2 ** 2)).sum(axis=(0, 1))
    lab = np.argmax(np.stack([p_sig, p_pi, p_del], axis=1), axis=1)
    return occ_idx[lab == 0], occ_idx[lab == 1], occ_idx[lab == 2]


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


def build():
    from pyscf import gto, scf
    accPos = np.zeros((K, N_ACC, 3)); depPos = np.zeros((K, N_DEP, 3)); spinPos = np.zeros((K, N_SPIN, 3))
    accMass = np.zeros(K); depMass = np.zeros(K); spinMass = np.zeros(K); bondMass = np.zeros(K)
    print(f"=== {MOL.upper()} ({EL_A}-{EL_B}, spin={SPIN}) ab initio  {BASIS}  K={K}  {NX}x{NY}x{NZ} vox ===")
    print("R(bohr)  R(A)     E(Ha)        <S^2>   accMass  depMass  spinMass  bondMass")
    transfer = []          # heteronuclear: q(Na) Mulliken + μ por R — los DATOS del robo
    for k in range(K):
        R = float(Rvals[k])
        mol = gto.M(atom=[[EL_A, (-R / 2, 0, 0)], [EL_B, (R / 2, 0, 0)]],
                    basis=BASIS, spin=SPIN, unit='Bohr', verbose=0)
        mf = (scf.RHF(mol) if SPIN == 0 else scf.UHF(mol))
        mf.level_shift = 0.1; mf.max_cycle = 200; mf.kernel()
        if not mf.converged:
            mf = scf.newton(scf.RHF(mol) if SPIN == 0 else scf.UHF(mol)); mf.kernel()
        dm = mf.make_rdm1()
        if EL_A != EL_B:
            # el ROBO medido: carga Mulliken del átomo izquierdo + dipolo (Debye)
            pop = mf.mulliken_pop(verbose=0)
            qA = float(pop[1][0])
            mu = mf.dip_moment(unit='Debye', verbose=0)
            transfer.append({'R_bohr': round(R, 3), 'R_A': round(R * BOHR, 3),
                             'q_' + EL_A: round(qA, 3), 'mu_D': round(float(np.linalg.norm(mu)), 3)})
        dm_pro = scf.hf.init_guess_by_atom(mol)
        if SPIN == 0:
            dm_tot = dm
            rho_mol, rho_pro = (a.reshape(NX, NY, NZ) for a in eval_rhos(mol, [dm_tot, dm_pro], GRID))
            rho_s = np.zeros((NX, NY, NZ))
        else:
            dm_tot = dm[0] + dm[1]; dm_spin = dm[0] - dm[1]
            rho_mol, rho_pro, rho_s = (a.reshape(NX, NY, NZ) for a in eval_rhos(mol, [dm_tot, dm_pro, dm_spin], GRID))
        d_rho = rho_mol - rho_pro
        # 3a nube: espin (violeta = e- desapareados = el iman) en tripletes. En singletes
        # con 'pi' ese slot esta VACIO -> lo reusamos como la nube pi REAL: rho de los
        # orbitales pi (|m|=1 respecto al eje) = las dos pi del enlace multiple, un anillo
        # DENSO alrededor del eje que fluye al formarse el enlace. Ambos son fisica real.
        if CFG.get('ghost'):
            # Be₂ FANTASMA (orden 0): acc = σ2g ENLAZANTE (junta carga) · 3ª nube = σ2u*
            # ANTIENLAZANTE (el gemelo que CANCELA). Los 2 σ de valencia = los 2 MO
            # ocupados de mayor energía; el enlazante tiene densidad en el plano medio
            # (x=0), el antienlazante tiene NODO ahí (simetría ungerade). El centro sale
            # oscuro (dep neto ≈ 0) = "y sin embargo, apenas se enlaza". Física real.
            C = mf.mo_coeff; occ = mf.mo_occ
            val = np.where(occ > 1e-6)[0][-2:]
            midpts = np.array([[0.0, y, z] for y in (-0.4, 0.0, 0.4) for z in (-0.4, 0.0, 0.4)])
            dmid = ((mol.eval_gto('GTOval', midpts) @ C[:, val]) ** 2).sum(axis=0)
            bond_i = int(val[np.argmax(dmid)]); anti_i = int(val[val != bond_i][0])
            dm_b = 2.0 * np.outer(C[:, bond_i], C[:, bond_i])
            dm_a = 2.0 * np.outer(C[:, anti_i], C[:, anti_i])
            rho_bond, rho_anti = (a.reshape(NX, NY, NZ) for a in eval_rhos(mol, [dm_b, dm_a], GRID))
            rho_third = rho_anti
            accField = rho_bond; depField = np.maximum(-d_rho, 0)
        elif 'pi' in CFG:
            C = mf.mo_coeff; occ = mf.mo_occ
            if SPIN != 0:
                C = np.hstack([C[0], C[1]]); occ = np.concatenate([occ[0], occ[1]])
            _, pim, _ = classify_sigma_pi(mol, C, occ)
            dm_pi = (C[:, pim] * occ[pim]) @ C[:, pim].T
            rho_third = eval_rhos(mol, [dm_pi], GRID)[0].reshape(NX, NY, NZ)
            accField = np.maximum(d_rho, 0); depField = np.maximum(-d_rho, 0)
        else:
            rho_third = np.abs(rho_s)
            accField = np.maximum(d_rho, 0); depField = np.maximum(-d_rho, 0)
        accMass[k] = accField.sum() * dV
        depMass[k] = depField.sum() * dV
        spinMass[k] = rho_third.sum() * dV
        bondMass[k] = float(eval_rhos(mol, [dm_tot], np.array([[0.0, 0.0, 0.0]]))[0][0])
        accPos[k] = sample_field(accField, U_acc)
        depPos[k] = sample_field(depField, U_dep)
        spinPos[k] = sample_field(rho_third, U_spin)
        ss = mf.spin_square()[0] if SPIN else 0.0
        print(f"{R:6.3f}  {R*BOHR:5.3f}  {mf.e_tot:12.5f}  {ss:5.2f}  "
              f"{accMass[k]:7.4f}  {depMass[k]:7.4f}  {spinMass[k]:7.4f}  {bondMass[k]:7.4f}")
    # color del acc = el enlace CALIDO (oro sigma en el eje -> ambar afuera, puente blanco,
    # pares libres tenues). El caracter pi (frio) lo lleva la nube pi DEDICADA de arriba,
    # que es densa y coherente -> anillo. Asi: acc = "carga que se junta", pi = "las 2 pi".
    kEq = int(np.argmin(np.abs(Rvals - RE)))
    xeq = accPos[kEq, :, 0]; perp = np.hypot(accPos[kEq, :, 1], accPos[kEq, :, 2]); Rhalf = Rvals[kEq] / 2
    t = np.clip(perp / 1.3, 0, 1)
    # ambar ROJO (no naranja): la mezcla dorado+rojos+morados es la firma hipnotica
    # de la serie (feedback O2); el rojo profundo en pares libres da el calor
    gold = np.array([1.00, 0.84, 0.36]); amber = np.array([1.00, 0.36, 0.10]); whitegold = np.array([1.00, 0.96, 0.74])
    col = gold[None, :] * (1 - t[:, None]) + amber[None, :] * t[:, None]
    col[(np.abs(xeq) < Rhalf * 0.92) & (perp < 0.75)] = whitegold
    col[np.abs(xeq) > Rhalf * 1.08] = amber[None, :] * 0.62
    accColor = np.clip(col * 255, 0, 255).astype(np.uint8)
    # heteronuclear: la CURVA DEL ROBO (q y μ por R) — los números del guion.
    # Verificación dura: μ(Re) del NaCl medido = 9.00 D; si no anda cerca, algo
    # está mal y NO se produce video con estos datos.
    if EL_A != EL_B and transfer:
        import json
        tj = os.path.join(os.path.dirname(OUT), f'{MOL}-transfer.json')
        json.dump(transfer, open(tj, 'w'), indent=1)
        eq = min(transfer, key=lambda x: abs(x['R_bohr'] - RE))
        print(f"\n── EL ROBO ({EL_A}→{EL_B}) ──")
        for x in transfer:
            print(f"  R={x['R_A']:6.3f} Å  q_{EL_A}={x['q_' + EL_A]:+.3f}  μ={x['mu_D']:7.3f} D")
        MU_EXP = {'nacl': 9.001, 'hf': 1.826, 'co': 0.110, 'lih': 5.884, 'kcl': 10.269,
                  'no': 0.159, 'hcl': 1.080}
        exp = MU_EXP.get(MOL)
        print(f"  μ(Re={eq['R_A']} Å) = {eq['mu_D']} D" + (f"  ·  experimental {MOL.upper()} = {exp} D" if exp else ""))
        print(f"  ✓ curva en {tj}")
    return accPos, depPos, spinPos, accMass, depMass, spinMass, bondMass, accColor


def write_bin(accPos, depPos, spinPos, accMass, depMass, spinMass, bondMass, accColor):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4i', N_ACC, N_DEP, N_SPIN, K))
        fp.write(struct.pack('<2f', R_MIN, R_MAX))
        for a in (Rvals, accMass, depMass, spinMass, bondMass):
            fp.write(a.astype('<f4').tobytes())
        fp.write(accColor.astype(np.uint8).tobytes())
        q = lambda a: np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
        for a in (accPos, depPos, spinPos):
            fp.write(q(a).tobytes())
    print(f"OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.1f} MB")
    dist = OUT.replace('public/precomputed', 'dist/precomputed')
    try:
        os.makedirs(os.path.dirname(dist), exist_ok=True)
        import shutil; shutil.copyfile(OUT, dist)
    except Exception:
        pass


def validate_figure(accPos, depPos, spinPos):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    kEq = int(np.argmin(np.abs(Rvals - RE)))
    fig, ax = plt.subplots(figsize=(7, 5), facecolor='black'); ax.set_facecolor('black')
    ax.scatter(depPos[kEq, :, 0], depPos[kEq, :, 1], s=1, c='#3aa0d0', alpha=0.30, label='vaciado')
    ax.scatter(accPos[kEq, :, 0], accPos[kEq, :, 1], s=1, c='#ffc24a', alpha=0.55, label='acumulacion (enlace)')
    if SPIN:
        ax.scatter(spinPos[kEq, :, 0], spinPos[kEq, :, 1], s=1, c='#c060ff', alpha=0.45, label='espin (iman)')
    ax.plot([-RE / 2, RE / 2], [0, 0], 'o', color='#00ff88', ms=7)
    ax.set_aspect('equal'); ax.set_xlim(-4, 4); ax.set_ylim(-3, 3)
    ax.set_title(f'{MOL.upper()} en equilibrio (R={Rvals[kEq]*BOHR:.2f} A) — Delta-rho', color='white')
    ax.legend(loc='upper right', framealpha=0.2, labelcolor='white', fontsize=8); ax.tick_params(colors='white')
    p = os.path.join(os.path.dirname(__file__), '..', '_o2_proof', f'{MOL}-abinitio-particles.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    plt.savefig(p, dpi=120, facecolor='black', bbox_inches='tight'); print(f"figura: {p}")


if __name__ == '__main__':
    data = build(); write_bin(*data); validate_figure(data[0], data[1], data[2])
