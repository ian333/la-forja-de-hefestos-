#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-heme-approach.py — LA CAZADORA, bien hecha: el SITIO ACTIVO de la hemoglobina
capturando O₂, ab initio, CALCADO de precompute-water-approach.py (el ganador).

La lección que paga este archivo (Ian, 2026-08-18: "no entiendo qué estoy viendo — las
líneas azules son el CAMPO en la serie"): la gramática de la serie es sagrada. Cada capa
vuelve a significar LO QUE SIGNIFICA en el puente:
  acc   = ρ total REAL del sitio activo (los electrones, oro)
  dep   = Δρ<0 (azul): de dónde SALEN los electrones al unirse el O₂
  spin  = Δρ>0 (morado glow): a dónde LLEGAN — el enlace Fe–O₂ naciendo
  líneas= el CAMPO ELÉCTRICO real (motor campo_lineas.py, siembra por flujo, gates Gauss)
  bondMass = ∫Δρ>0 → el hemo se ENCIENDE al capturar

MODELO (estándar de QM de hemoproteínas, todo DECLARADO):
  · Núcleo de Fe-porfina tomado del CRISTAL 2DN1 (oxi, 1.25 Å): Fe + 4N + 20C, los
    sustituyentes truncados a H (práctica común; la geometría del anillo es la medida).
  · El O₂ en su posición de unión REAL del cristal (Fe–O 1.796 Å, gate vs Shaanan) y
    retirado rígidamente a lo largo del eje Fe–O hasta 4.6 Å: escaneo rígido.
  · RKS B3LYP/def2-SVP (el complejo oxi-hemo es DIAMAGNÉTICO — Pauling 1936 — la capa
    cerrada es el estado real del complejo). Superficie de espín bajo, declarada.
  · Promolécula: FeP (RKS singlete, superficie del complejo) + O₂ (UKS triplete, SU estado
    real). Mezcla declarada: el Δρ incluye el apareamiento del espín — que ES la historia
    (el imán del O₂ se apaga al caer en la trampa).
  · Factibilidad medida 2026-08-18: 51 átomos / 455 nbf convergen en 464 s (4070 Ti).

Convención de escena: Fe en el ORIGEN, el O₂ llega por +X (el "enlace sobre X" del motor).
Núcleos del bin = UN trío (Fe, O, O) — el patrón (O,H,H) del agua: cores/cámara gratis.
Salida: hemoglobina.bin (WAP2) + hemoglobina-efield.bin (BondEField) — REEMPLAZAN a los
del intento estructural v1-v9 (aquél mostraba ÁTOMOS vestidos de electrones).

Uso (iangpu, venv GPU):
  LD_LIBRARY_PATH=/usr/lib/wsl/lib /home/ian/gpu4pyscf-venv/bin/python \
    scripts/precompute-heme-approach.py [quick]
"""
import os
import struct
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BOHR = 0.52917721067
HART2KCAL = 627.509
QUICK = 'quick' in sys.argv
SEED = 20260818
POSQ = 2400                    # bohr → int16 (±13.6 bohr: sitio + imidazol + viaje)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDB = os.path.join(ROOT, 'public', '2DN1.pdb')
OUT = os.path.join(ROOT, 'public', 'precomputed', 'hemoglobina.bin')
OUT_EF = os.path.join(ROOT, 'public', 'precomputed', 'hemoglobina-efield.bin')
PROOF = os.path.join(ROOT, '_o2_proof')

D_MIN_A = 1.796                # Fe–O del cristal (gate: Shaanan 1.8-1.9)
D_MAX_A = 4.60                 # arranque del escaneo (interacción ~cero)

if QUICK:
    K = 3;  N_ACC, N_DEP, N_SPIN = 8000, 4000, 4000;  NX, NY, NZ = 72, 64, 64; NL, LP = 120, 60
else:
    K = 8;  N_ACC, N_DEP, N_SPIN = 48000, 18000, 17000; NX, NY, NZ = 120, 100, 100; NL, LP = 420, 72

# ── geometría del sitio activo desde el CRISTAL (mismo builder que el test de factibilidad) ──
CORE_C = (['CHA', 'CHB', 'CHC', 'CHD'] +
          [f'C{i}{s}' for s in 'ABCD' for i in (1, 2, 3, 4)])
CORE_N = ['NA', 'NB', 'NC', 'ND']
SUST = {'C2A': 'CAA', 'C3A': 'CMA', 'C2B': 'CMB', 'C3B': 'CAB',
        'C2C': 'CMC', 'C3C': 'CAC', 'C2D': 'CMD', 'C3D': 'CAD'}
MESO = {'CHA', 'CHB', 'CHC', 'CHD'}


def cargar_sitio():
    hem, oxy, his = {}, [], {}
    for line in open(PDB, encoding='utf-8', errors='replace'):
        rec = line[:6]
        if rec not in ('HETATM', 'ATOM  '):
            continue
        res, ch, name = line[17:20].strip(), line[21], line[12:16].strip()
        if ch != 'A':
            continue
        xyz = np.array([float(line[30:38]), float(line[38:46]), float(line[46:54])])
        if rec == 'HETATM' and res == 'HEM':
            hem[name] = xyz
        elif rec == 'HETATM' and res == 'OXY':
            oxy.append(xyz)
        elif rec == 'ATOM  ' and res == 'HIS' and int(line[22:26]) == 87:
            his[name] = xyz          # His87 = la HISTIDINA PROXIMAL (F8), NE2–Fe = 2.071 Å
    fe = hem['FE']
    els, pos = ['Fe'], [fe]
    for n in CORE_N:
        els.append('N'); pos.append(hem[n])
    for c in CORE_C:
        p = hem[c]
        els.append('C'); pos.append(p)
        if c in SUST and SUST[c] in hem:
            d = hem[SUST[c]] - p
        elif c in MESO:
            d = p - fe
        else:
            continue
        els.append('H'); pos.append(p + d / np.linalg.norm(d) * 1.08)
    # ── LA HISTIDINA PROXIMAL (His87 F8) como IMIDAZOL ──────────────────────────
    # Por qué entra al modelo (quick v5 lo gritó con números): sin ella el Fe queda
    # 4-coordinado, su estado base es triplete y el complejo con O₂ es singulete → el
    # Ebind salía **+73 kcal** (repulsivo) porque medía el COSTO DEL CAMBIO DE ESPÍN, no
    # el enlace. Con el imidazol el Fe es 5-coordinado y el aducto 6-coordinado
    # diamagnético: el estado REAL (Pauling 1936). Y además ES el mecanismo — el Fe jala
    # a esta histidina, la histidina jala la hélice F: la palanca de Perutz en persona.
    # Anillo del cristal (CG, ND1, CD2, CE1, NE2) + H construidos en el plano (radial al
    # centroide, C–H 1.08 Å / N–H 1.01 Å) y el enlace CG–CB truncado a H.
    anillo = ['CG', 'ND1', 'CD2', 'CE1', 'NE2']
    if all(n in his for n in anillo):
        cen = np.mean([his[n] for n in anillo], axis=0)
        for n in anillo:
            els.append('N' if n.startswith('N') else 'C'); pos.append(his[n])
        for n, largo in (('CD2', 1.08), ('CE1', 1.08), ('ND1', 1.01)):
            d = his[n] - cen; d /= np.linalg.norm(d)
            els.append('H'); pos.append(his[n] + d * largo)
        d = his['CG'] - his['CB'] if 'CB' in his else his['CG'] - cen
        els.append('H'); pos.append(his['CG'] - d / np.linalg.norm(d) * 1.08)
    else:
        raise SystemExit(f'✗ His87 incompleta en el cristal: {sorted(his)}')
    o1, o2 = oxy[0], oxy[1]
    if np.linalg.norm(o2 - fe) < np.linalg.norm(o1 - fe):
        o1, o2 = o2, o1
    return els, np.array(pos), np.array([o1, o2]), fe


ELS_FEP, POS_FEP_A, O2_A, FE_A = cargar_sitio()
# rotar: eje Fe→O1 sobre +X, Fe al origen (convención "el enlace sobre X" del motor)
ux = (O2_A[0] - FE_A); ux /= np.linalg.norm(ux)
tmp = np.array([0.0, 0.0, 1.0])
if abs(np.dot(tmp, ux)) > 0.9:
    tmp = np.array([0.0, 1.0, 0.0])
uy = np.cross(tmp, ux); uy /= np.linalg.norm(uy)
uz = np.cross(ux, uy)
ROT = np.stack([ux, uy, uz])
FEP_B = ((POS_FEP_A - FE_A) @ ROT.T) / BOHR          # bohr, Fe en el origen
O2_B0 = ((O2_A - FE_A) @ ROT.T) / BOHR               # O₂ del cristal (d = 1.796 Å)
O2_INT = O2_B0 - O2_B0[0]                            # geometría interna del O₂ (O1 en 0)
D_CRIS = float(np.linalg.norm(O2_B0[0]))             # bohr


def o2_en(d_A):
    """El O₂ retirado rígidamente: O1 a d_A del Fe sobre el eje del cristal."""
    base = O2_B0[0] / np.linalg.norm(O2_B0[0]) * (d_A / BOHR)
    return base[None, :] + O2_INT

# escaneo denso cerca del equilibrio (como el agua: descendente, lejos→unido)
# Espaciado GRANDE a propósito (full v1: con pasos de 0.06 Å el SCF se atoraba en el cruce
# de estados de espín cerca del equilibrio, mientras que los saltos de 0.7 Å del quick
# convergieron los tres). Menos puntos, más sanos; la escena interpola entre ellos.
Dvals_A = np.array([4.60, 3.70, 3.10, 2.65, 2.30, 2.05, 1.90, D_MIN_A][:K]) \
    if not QUICK else np.array([4.60, 2.55, D_MIN_A])
Rvals = Dvals_A / BOHR                               # la coordenada del formato (bohr, desc.)

rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3)); U_dep = rng.random((N_DEP, 3)); U_spin = rng.random((N_SPIN, 3))

# caja de muestreo (bohr): el anillo (~±7.5) + el viaje del O₂ (+X hasta ~10.4)
LXm, LXp, LR = 11.0, 10.8, 8.6   # -X aloja el IMIDAZOL (His proximal), +X el viaje del O₂
dx = (LXm + LXp) / NX; dy = (2 * LR) / NY; dz = (2 * LR) / NZ
xs = -LXm + (np.arange(NX) + 0.5) * dx
ys = -LR + (np.arange(NY) + 0.5) * dy
zs = -LR + (np.arange(NZ) + 0.5) * dz
GX, GY, GZ = np.meshgrid(xs, ys, zs, indexing='ij')
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
dV = dx * dy * dz


def eval_rho(mol, dm, pts, chunk=30000):
    out = np.empty(pts.shape[0])
    for a in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[a:a + chunk])
        out[a:a + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return out


def sample_field(field, U):
    """Inverse-CDF 3D con U fija (Lagrangiano) — VERBATIM del ganador."""
    M = U.shape[0]; f = np.maximum(field, 0.0)
    slab = f.sum(axis=(1, 2)); Cx = np.concatenate([[0.0], np.cumsum(slab)]); tot = Cx[-1]
    if tot <= 0:
        return np.zeros((M, 3))
    tgt = U[:, 0] * tot
    ix = np.clip(np.searchsorted(Cx, tgt, side='right') - 1, 0, NX - 1)
    x = -LXm + (ix + (tgt - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)) * dx
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
    from pyscf import gto
    try:
        from gpu4pyscf import dft as gdft
        motor = 'gpu4pyscf'
    except Exception:
        from pyscf import dft as gdft
        motor = 'pyscf-cpu'
    from campo_lineas import (CampoMEP, superficie_molecular, sembrar_por_flujo,
                              superficie_en_rayos, trazar_bidireccional, E_PUENTE)

    def rks(atoms, dm0=None, spin=0, shift=0.25, cycles=150):
        mol = gto.M(atom=atoms, basis='def2-svp', unit='Bohr', charge=0, spin=spin, verbose=0)
        mf = gdft.RKS(mol) if spin == 0 else gdft.UKS(mol)
        mf.xc = 'b3lyp'; mf.max_cycle = cycles; mf.level_shift = shift; mf.conv_tol = 1e-7
        mf.kernel(dm0=dm0) if dm0 is not None else mf.kernel()
        if not mf.converged:
            raise RuntimeError('no convergió')
        dm = mf.make_rdm1()
        dm = np.asarray(dm.get() if hasattr(dm, 'get') else dm)
        return mol, dm, float(mf.e_tot)

    def scf_escalera(atoms, intentos, etiqueta):
        """Fe(II) es terco: se intenta el estado REAL primero y se escala el shift."""
        for spin, shift in intentos:
            t0 = time.time()
            try:
                mol, dm, e = rks(atoms, spin=spin, shift=shift, cycles=200)
                print(f'  {etiqueta}: convergió con spin={spin} shift={shift} · '
                      f'E={e:.5f} · {time.time()-t0:.0f}s', flush=True)
                return mol, dm, e, spin
            except RuntimeError:
                print(f'  {etiqueta}: spin={spin} shift={shift} NO convergió '
                      f'({time.time()-t0:.0f}s) — siguiente peldaño', flush=True)
        raise SystemExit(f'✗ {etiqueta}: ningún peldaño convergió')

    # ══ SCF CON CACHÉ EN DISCO (full v2: los 8 puntos costaron ~3 h y se PERDIERON porque
    # la referencia tronó DESPUÉS). Cada densidad convergida se guarda; al relanzar, lo ya
    # hecho se lee del disco. La `mol` se reconstruye gratis — lo caro es el `dm`. ══
    CACHE_DIR = os.path.join(ROOT, 'dist-video', '.heme-scf-cache')
    os.makedirs(CACHE_DIR, exist_ok=True)

    def scf_punto(atoms, tag, dm_prev=None):
        """Devuelve (mol, dm, e) o (None, None, None). Cachea; escalera de 4 peldaños —
        el 'guess limpio' es el que saca al SCF del punto de silla en el cruce de espín."""
        cp = os.path.join(CACHE_DIR, f'{tag}.npz')
        mol = gto.M(atom=atoms, basis='def2-svp', unit='Bohr', charge=0, spin=0, verbose=0)
        if os.path.exists(cp):
            z = np.load(cp)
            print(f'   ✓ CACHÉ {tag} (E={float(z["e"]):.5f})', flush=True)
            return mol, z['dm'], float(z['e'])
        for etq, kw in (('guess encadenado', dict(dm0=dm_prev)),
                        ('shift 0.6', dict(dm0=dm_prev, shift=0.6, cycles=200)),
                        ('shift 1.2', dict(dm0=dm_prev, shift=1.2, cycles=250)),
                        ('guess limpio', dict(shift=0.6, cycles=250))):
            try:
                _, dm, e = rks(atoms, **kw)
                np.savez_compressed(cp, dm=dm, e=e)
                return mol, dm, e
            except RuntimeError:
                print(f'   ({etq} no cerró)', flush=True)
        return None, None, None

    at_fep = [[e, tuple(p)] for e, p in zip(ELS_FEP, FEP_B)]
    print(f'=== LA CAZADORA · sitio activo {len(at_fep)+2} átomos · {motor} · K={K} · '
          f'malla {NX}×{NY}×{NZ} · {NL} líneas ===', flush=True)

    # fragmentos (promolécula) — UNA vez; la densidad del O₂ se evalúa en su marco y viaja
    # FeP sola: su estado base REAL es espín intermedio S=1 (triplete) — se intenta ese
    # primero; capa cerrada era pelear contra la física (no convergía). DECLARADO: la
    # promolécula usa los fragmentos en SUS estados reales (FeP S=1, O₂ S=1) y el complejo
    # es capa cerrada (diamagnético, Pauling 1936): el Δρ INCLUYE el apagado de los imanes.
    # DOS juegos de fragmentos, y el porqué lo cazó el GATE (quick v3): con la promolécula
    # en los estados REALES (tripletes) y el complejo en capa cerrada, el Δρ a 4.6 Å daba
    # 1.32 e⁻ — medía el CAMBIO DE SUPERFICIE DE ESPÍN, no la interacción, y ahogaba al
    # enlace. Regla: **el Δρ se mide en UNA superficie** (fragmentos capa cerrada, la del
    # complejo) y el apagado de los imanes (Pauling 1936) SE CUENTA en la voz, no se dibuja.
    # Las ENERGÍAS de enlace sí van contra los fragmentos en sus estados reales.
    # SIN FRAGMENTOS AISLADOS (v7, dos horas de GPU lo enseñaron): el sitio 5-coordinado
    # con His NO converge suelto — ni triplete ni quintuplete, ~30 min por intento. Y NO
    # HACE FALTA: **la referencia a 8 Å da todo**, con física más honesta:
    #   · energía   = E(d) − E(8 Å)  → la curva de captura RELATIVA (sin el sesgo del
    #     cambio de superficie de espín que contaminaba el +73 kcal del quick v5)
    #   · densidad  = partición atómica de esa MISMA referencia (ρ_FeP y ρ_O2 del bloque)
    # Un fragmento que no converge no es un obstáculo: era una pregunta que no había que
    # hacer. (El estado alto espín S=2 de la deoxi sigue siendo cierto y es MATERIAL DEL
    # GUION — se cuenta con el dato del cristal, no con un SCF que no cierra.)
    # PROMOLÉCULA (quick v4 enseñó que la FeP singulete AISLADA no converge — no existe
    # cómoda en esa superficie): la referencia es EL PROPIO COMPLEJO llevado a 8 Å, donde
    # los fragmentos ya no se tocan. Su densidad en la caja = FeP en la superficie del
    # complejo; su densidad alrededor del O₂ lejano (trasladada) = el O₂ en esa superficie.
    # Auto-consistente por construcción: Δρ(lejos) ≈ 0 sin pelear con SCFs imposibles.
    # (Se calcula al FINAL de la cadena de guess, partiendo del de 4.6 Å.)

    accPos = np.zeros((K, N_ACC, 3)); depPos = np.zeros((K, N_DEP, 3)); spinPos = np.zeros((K, N_SPIN, 3))
    bondMass = np.zeros(K); nucPos = np.zeros((K, 3, 3)); efield = None
    dms, mols = [None] * K, [None] * K
    print('k   d(Å)    E(Ha)          t(s)', flush=True)
    dm_prev = None
    energias = np.zeros(K); rhos = [None] * K; o2ks = [None] * K
    for k in range(K - 1, -1, -1):                 # del UNIDO hacia afuera (guess encadenado)
        t0 = time.time()
        o2k = o2_en(Dvals_A[k])
        atoms = at_fep + [['O', tuple(o2k[0])], ['O', tuple(o2k[1])]]
        # ESCALERA + SALTO (full v1 murió a las 2 h porque UN punto no cerró): cerca del
        # equilibrio hay un cruce de estados de espín y el SCF oscila. Se intenta con
        # guess encadenado, con shift alto, y con guess LIMPIO (a veces el guess demasiado
        # bueno cae en un punto de silla). Si aun así no cierra, el punto SE SALTA y el
        # bin se arma con los que sí convergieron — un punto terco no tira la corrida.
        mol, dm, e = scf_punto(atoms, f'd{Dvals_A[k]:.3f}', dm_prev)
        if mol is None:
            print(f'   ⚠ d={Dvals_A[k]:.2f} Å SE SALTA (no converge en ningún peldaño)', flush=True)
            continue
        dm_prev = dm
        mols[k], dms[k] = mol, dm
        energias[k] = e
        rhos[k] = eval_rho(mol, dm, GRID)
        o2ks[k] = o2k
        print(f'{k:2d}  {Dvals_A[k]:5.2f}  {e:12.5f}  {time.time()-t0:.0f}', flush=True)

    # COMPACTAR a los puntos que sí cerraron (K real). Todo lo de abajo usa estos índices.
    vivos = [k for k in range(K) if mols[k] is not None]
    if len(vivos) < 4:
        raise SystemExit(f'✗ solo {len(vivos)} puntos convergieron — muy pocos para el bin')
    if len(vivos) < K:
        print(f'  ⚠ {K - len(vivos)} punto(s) saltado(s); el bin llevará K={len(vivos)}', flush=True)
        globals()['K'] = len(vivos)
        Dvals_A_v = Dvals_A[vivos]
        globals()['Rvals'] = Dvals_A_v / BOHR
        globals()['Dvals_A'] = Dvals_A_v
        mols = [mols[k] for k in vivos]; dms = [dms[k] for k in vivos]
        energias = energias[vivos]; rhos = [rhos[k] for k in vivos]; o2ks = [o2ks[k] for k in vivos]
        accPos = accPos[vivos]; depPos = depPos[vivos]; spinPos = spinPos[vivos]
        bondMass = bondMass[vivos]; nucPos = nucPos[vivos]
        K_ = len(vivos)
    else:
        K_ = K

    # LA REFERENCIA ES EL PUNTO MÁS LEJANO DEL ESCANEO (4.60 Å), no uno a 8 Å (full v3 pasó
    # 3 h de SCF y murió ahí): a 8 Å el aducto de capa cerrada ya NO es el estado cómodo
    # — el fundamental es FeP-His alto espín + O₂ triplete — y forzarlo no converge, igual
    # que el fragmento aislado. Y NO hace falta: a 4.60 Å la interacción ya es despreciable
    # (medido en el quick contra 8 Å: ∫Δρ = 0.022 e⁻ = 3 % del valor unido). Se declara que
    # el Δρ y la energía son RELATIVOS a 4.60 Å, que es exactamente lo que el video muestra.
    m_ref, dm_ref, e_ref = mols[0], dms[0], energias[0]
    o2ref = o2ks[0]
    D_REF_A = float(Dvals_A[0])
    print(f'  referencia = el punto más lejano del escaneo ({D_REF_A:.2f} Å, ya cacheado): '
          f'E={e_ref:.5f}', flush=True)
    ebinds = (energias - e_ref) * HART2KCAL        # curva RELATIVA: negativo = atrae
    print('  curva de captura (kcal/mol vs 8 Å):', flush=True)
    for k in range(K):
        print(f'    d={Dvals_A[k]:5.2f} Å → {ebinds[k]:+8.2f}', flush=True)
    if not (ebinds[K - 1] < -3.0):
        raise SystemExit(f'✗ GATE_ENERGIA_FAIL: unido debería ATRAER, dio {ebinds[K-1]:+.2f} kcal')
    print(f'  GATE_ENERGIA_OK: el O₂ unido está {ebinds[K-1]:.1f} kcal por DEBAJO de lejos', flush=True)
    # PARTICIÓN ATÓMICA de la densidad de referencia (lo cazó la FIGURA del quick v5: una
    # PARED azul plana pegada al borde -X de la caja). Causa: yo evaluaba el complejo
    # ENTERO desplazado como si fuera "el O₂", así que restaba la FeP dos veces — una en su
    # sitio y otra corrida ~11 bohr a la izquierda, cuya cola caía justo en el borde.
    # Fix: cada fragmento es su BLOQUE de la matriz de densidad (ρ_A = Σ_{μν∈A} P_μν φ_μφ_ν).
    # A 8 Å los términos cruzados son ~0, así que ρ_FeP + ρ_O2 ≈ ρ_ref por construcción.
    sl = m_ref.aoslice_by_atom()
    nO2 = 2                                        # los 2 oxígenos son los últimos átomos
    i0 = sl[-nO2][2]                               # primer AO del O₂
    P_fep = dm_ref.copy(); P_fep[i0:, :] = 0; P_fep[:, i0:] = 0
    P_o2 = dm_ref[i0:, i0:].copy()
    rho_fep = eval_rho(m_ref, P_fep, GRID)
    m_o2f = gto.M(atom=[['O', tuple(O2_INT[0])], ['O', tuple(O2_INT[1])]],
                  basis='def2-svp', unit='Bohr', verbose=0)
    assert m_o2f.nao_nr() == P_o2.shape[0], 'bloque del O₂ no calza con su base'

    print('k   ∫Δρ>0', flush=True)
    for k in range(K):
        o2k = o2ks[k]
        rho_o2 = eval_rho(m_o2f, P_o2, GRID - o2k[0][None, :])
        drho = (rhos[k] - rho_fep - rho_o2).reshape(NX, NY, NZ)
        rho3 = rhos[k].reshape(NX, NY, NZ)
        acc_field = np.power(np.maximum(rho3, 0), 0.8)
        bondMass[k] = float(np.maximum(drho, 0).sum() * dV)
        accPos[k] = sample_field(acc_field, U_acc)
        depPos[k] = sample_field(np.maximum(-drho, 0), U_dep)
        spinPos[k] = sample_field(np.maximum(drho, 0), U_spin)
        nucPos[k] = np.stack([np.zeros(3), o2k[0], o2k[1]])       # el trío (Fe, O, O)
        print(f'{k:2d}  {bondMass[k]:7.4f}', flush=True)

    # ── CAMPO REAL con el motor de la serie (siembra por flujo en el frame UNIDO) ──
    cr = CampoMEP(mols[K - 1], dms[K - 1])
    sup = superficie_molecular(cr, n_dir=900 if not QUICK else 300)
    idx, Phi0, info = sembrar_por_flujo(cr, sup, NL)
    ia_r, id_r = sup['ray'][0][idx], sup['ray'][1][idx]
    print(f'  siembra por flujo: {len(idx)} líneas · Φ₀={Phi0:.3e} · '
          f'∮E·n̂dA={info["flujo_neto"]:+.3f}', flush=True)
    TZ = dict(tol=1e-8, r_core=0.25, r_caja=13.0, s_max=26.0, e_min=1e-4,
              max_pasos=1400, max_muestras=900)
    efield = np.zeros((K, len(ia_r), LP, 3))
    for k in range(K):
        t0 = time.time()
        c = CampoMEP(mols[k], dms[k])
        S, hay, _ = superficie_en_rayos(c, ia_r, id_r, 900 if not QUICK else 300)
        L, largo, viva, _, _, _ = trazar_bidireccional(c, S, LP=LP, e_dibujo=E_PUENTE, **TZ)
        efield[k] = L
        print(f'  campo {k+1}/{K}: {int(viva.sum())}/{len(ia_r)} vivas · '
              f'{time.time()-t0:.0f}s', flush=True)

    # accColor en el frame de equilibrio: ORO del ganador + morado pegado al par Fe–O₂
    P = accPos[K - 1]
    dfeo = np.minimum(np.linalg.norm(P, axis=1), np.linalg.norm(P - nucPos[K - 1, 1], axis=1))
    pw = np.clip(1.0 - dfeo / 1.6, 0, 1)
    gold = np.array([1.0, 0.72, 0.30]); purple = np.array([0.82, 0.28, 1.0])
    accColor = np.clip((gold[None] * (1 - pw[:, None]) + purple[None] * pw[:, None]) * 255,
                       0, 255).astype(np.uint8)

    # GATES
    print(f'── GATE: ∫Δρ>0 {bondMass[0]:.4f} (lejos) → {bondMass[K-1]:.4f} (unido) · '
          f'razón={bondMass[K-1]/max(bondMass[0],1e-9):.1f}×', flush=True)
    # control POSITIVO: crece fuerte al unirse; control NEGATIVO: lejos ≈ nada (la
    # promolécula calza con el complejo en la misma superficie)
    if not (bondMass[K - 1] > bondMass[0] * 3.0):
        raise SystemExit('✗ GATE_APPROACH_FAIL (no crece)')
    # control NEGATIVO: bondMass[0] es 0 por construcción (la referencia es ese punto), así
    # que el que prueba algo es el SEGUNDO más lejano — ahí el enlace aún no existe.
    if not (bondMass[1] < 0.30 * bondMass[K - 1]):
        raise SystemExit(f'✗ GATE_APPROACH_FAIL (Δρ a {Dvals_A[1]:.2f} Å = {bondMass[1]:.3f}, '
                         f'no es chico vs {bondMass[K-1]:.3f} — referencia mal puesta)')
    print('  GATE_APPROACH_OK', flush=True)
    return accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, len(ia_r)


def write_bins(accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, NL_EF):
    q = lambda a: np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
    Z3 = np.array([26, 8, 8], dtype='<i2')
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', N_ACC, N_DEP, N_SPIN, K, 3, 0, 0))
        fp.write(struct.pack('<3f', float(POSQ), float(Rvals[-1]), float(Rvals[0])))
        fp.write(Rvals.astype('<f4').tobytes())
        fp.write(bondMass.astype('<f4').tobytes())
        fp.write(accColor.astype(np.uint8).tobytes())
        fp.write(Z3.tobytes())
        for a in (accPos, depPos, spinPos):
            fp.write(q(a).tobytes())
        fp.write(q(nucPos).tobytes())
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1e6:.1f} MB', flush=True)
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL_EF, LP))
        fp.write(Rvals.astype('<f4').tobytes())
        fp.write(np.clip(np.round(efield * 2000), -32767, 32767).astype('<i2').tobytes())
    print(f'OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1e6:.1f} MB ({NL_EF} líneas×{LP})', flush=True)


def proof(accPos, spinPos, nucPos, efield):
    try:
        import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
        ks = [0, K // 2, K - 1]
        fig, axs = plt.subplots(1, 3, figsize=(18, 6.5), facecolor='black')
        for ax, k in zip(axs, ks):
            ax.set_facecolor('black')
            for ln in efield[k][::max(1, len(efield[k]) // 160)]:
                ax.plot(ln[:, 0], ln[:, 1], c='#7ac8ff', alpha=0.45, lw=0.7)
            ax.scatter(accPos[k, :, 0], accPos[k, :, 1], s=1, c='#ffb43c', alpha=0.20)
            ax.scatter(spinPos[k, :, 0], spinPos[k, :, 1], s=2, c='#b04cff', alpha=0.55)
            ax.scatter(nucPos[k, :, 0], nucPos[k, :, 1], s=[90, 50, 50],
                       c=['#fff0c0', '#ffd27a', '#ffd27a'], zorder=5)
            ax.set_aspect('equal'); ax.set_xlim(-7, 11); ax.set_ylim(-8.5, 8.5); ax.axis('off')
            ax.set_title(f'd = {Dvals_A[k]:.2f} Å', color='white')
        fig.suptitle('LA CAZADORA — hemo + O₂: ρ (oro), Δρ>0 (morado), CAMPO real (cian)', color='white')
        fig.tight_layout(); os.makedirs(PROOF, exist_ok=True)
        f = os.path.join(PROOF, 'heme-approach.png')
        fig.savefig(f, dpi=95, facecolor='black'); plt.close(fig)
        print('figura:', f, flush=True)
    except Exception as e:
        print('fig falló:', e, flush=True)


if __name__ == '__main__':
    accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, NL_EF = build()
    write_bins(accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, NL_EF)
    proof(accPos, spinPos, nucPos, efield)
    print('HEME_APPROACH_LISTO', flush=True)
