#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-caroteno-gemelos.py — LOS GEMELOS: β-caroteno (zanahoria) contra licopeno (jitomate),
calculados de primeros principios. Misma fórmula C40H56, mismos 11 dobles enlaces conjugados,
otro color. Y el CONTROL: el β-caroteno con los anillos aplanados a la fuerza.

Por qué existe (2026-10-09). El caroteno viejo tenía geometría a mano (valencia rota), un λ que
era una recta ajustada y un «incoloro» rosa salmón (punto blanco E sin adaptar). Ver
dist-video/_caroteno-investigacion/04-caroteno-viejo.md §1.3. Aquí todo sale del cálculo:

  geom  <mol>   Geometría: DFT PBE-D3(BJ)/def2-SVP (pre-opt barata) → B3LYP-D3(BJ)/def2-SVP
                (geomeTRIC). Arranque: β = PubChem CID 5280489 (3D OEChem/MMFF94); licopeno =
                SMILES isomérico de PubChem CID 446925 → RDKit ETKDG+MMFF94 con la cadena s-trans
                (PubChem no publica 3D del licopeno). `plano` = el β optimizado con los dos
                diedros C5=C6–C7=C8 girados a 180° (s-trans) y CONGELADOS en la optimización.
  td    <mol>   TD-DFT (RPA) CAM-B3LYP/def2-SVP (FUNC=… para otro funcional), NSTATES estados.
                La transición brillante (tipo 1¹Bu⁺) = la de mayor fuerza de oscilador.
  nubes <mol>   Nubes en formato WAP2 (el de la serie: parseWAP2 de CinematicMolecule.tsx):
                  caroteno-gemelos-<mol>.bin      acc = Δρ>0 (ρ_mol − promolécula), dep = Δρ<0,
                                                  spin = ρ_π (todos los MOs π ocupados)
                  caroteno-gemelos-<mol>-orb.bin  acc = |HOMO|², dep = |LUMO|²,
                                                  spin = Δρ_exc>0 de la transición brillante
                                                  (adonde LLEGA la carga cuando entra la luz)
                  <bin>-puntas.bin                1 byte por punto: 1 = cae en una PUNTA (anillo
                                                  β, o el extremo ψ equivalente del licopeno)
                Densidad electrónica = la del funcional de TD (CAM-B3LYP) en la geometría B3LYP.
                Muestreo lagrangiano de la casa (inversa de la CDF, semillas FIJAS e iguales en las
                tres moléculas). posq adaptativo (bin-gate.py). K=2 cuadros idénticos (estático).
  color         Espectro de cada molécula → transmitancia → CIE 1931 2° bajo D65 → sRGB (D65
                nativo: el blanco sale BLANCO). Principal: la banda MEDIDA del β en hexano
                (PhotochemCAD) movida el ΔE calculado de cada molécula, a 4 concentraciones.
                Secundario: las transiciones calculadas ensanchadas (crudo / calibrado en 1 punto).
                caroteno-gemelos-color.json + el GATE del orden β < plano < licopeno.

GPU (2026-10-13, GPU=1): geometría con gpu4pyscf + DF (~1.3 min/paso contra ~10 en CPU; el CPU
tronó el 10-09 con EIO escribiendo h5 de 3.5 GB en /mnt/e); TD con J/K directos (el DF no cabe en
12 GB). Necesita LD_LIBRARY_PATH=/usr/lib/wsl/lib. Corredor: $CARO_WORK/correr-gpu.sh (flock gpu.lock).

Marco de los .bin: eje X = eje largo de la cadena, plano π ≈ XY (los lóbulos π salen en ±Z),
origen = centroide de los carbonos. Unidades: bohr. La escena pone la cadena VERTICAL (roll).

Uso (arranque en la laptop con RDKit; lo demás en iangpu, CPU; registro en $CARO_WORK/registro.log):
  CARO_WORK=… python3 scripts/precompute-caroteno-gemelos.py arranque     # .xyz de partida
  OMP_NUM_THREADS=12 python3 scripts/precompute-caroteno-gemelos.py geom beta
  …                                                             td beta | nubes beta | color
Env: CARO_WORK (/mnt/e/forja-calc/caroteno-gemelos) · MAXMEM (MB, 15000) · FUNC (camb3lyp)
     NSTATES (10) · GPU=1 (mf.to_gpu() si gpu4pyscf y la VRAM están libres) · PASO (Å, 0.15)
"""
import os, sys, json, time, math, struct
import numpy as np

BOHR = 0.529177210903
HA_EV = 27.211386245988
EV_NM = 1239.841984
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = os.environ.get('CARO_PRE', os.path.join(RAIZ, 'public', 'precomputed'))
BASIS = os.environ.get('BASIS', 'def2-svp')        # solo para PRUEBAS de humo (sto-3g)
WORK = os.environ.get('CARO_WORK', '/mnt/e/forja-calc/caroteno-gemelos')
MAXMEM = int(os.environ.get('MAXMEM', '15000'))
FUNC = os.environ.get('FUNC', 'camb3lyp')
NSTATES = int(os.environ.get('NSTATES', '10'))
GPU = os.environ.get('GPU') == '1'
RAPIDO_TD = os.environ.get('RAPIDO_TD', '1') == '1'     # K de respuesta en base MO (KRapida)
NIVEL_FXC = int(os.environ.get('NIVEL_FXC', '1'))        # malla del kernel XC de la respuesta
PASO = float(os.environ.get('PASO', '0.15'))            # Å entre nodos de la malla de nubes
MARGEN = 3.2                                             # Å de aire alrededor de los núcleos
SEED = 20261009
N_MAIN = (160000, 60000, 120000)                         # acc Δρ>0, dep Δρ<0, spin ρ_π
N_ORB = (100000, 100000, 80000)                          # HOMO, LUMO, Δρ_exc>0
MEDIDO_NM = {'beta': 450.0, 'licopeno': 470.0}           # λmax en hexano (05-ciencia §1.2)
MOLS = ('beta', 'licopeno', 'plano')
NOMBRE = {'beta': 'β-caroteno (anillos torcidos, como en la zanahoria)',
          'licopeno': 'licopeno (cadena abierta, como en el jitomate)',
          'plano': 'β-caroteno con los anillos APLANADOS (control: diedro C5=C6–C7=C8 = 180°)'}
os.makedirs(WORK, exist_ok=True)


def log(msg):
    linea = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(linea, flush=True)
    with open(os.path.join(WORK, 'registro.log'), 'a') as f:
        f.write(linea + '\n')


def leer_xyz(path):
    L = open(path).read().splitlines()
    n = int(L[0]); simb, X = [], []
    for l in L[2:2 + n]:
        p = l.split(); simb.append(p[0]); X.append([float(v) for v in p[1:4]])
    return simb, np.array(X)


def escribir_xyz(path, simb, X, comentario=''):
    with open(path, 'w') as f:
        f.write(f"{len(simb)}\n{comentario}\n")
        for s, p in zip(simb, X):
            f.write(f"{s} {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}\n")


# ── TOPOLOGÍA: quién es quién en la cadena (numeración de carotenoides) ─────────────────────
def vecinos(simb, X):
    n = len(simb); nb = [[] for _ in range(n)]
    D = np.sqrt(((X[:, None] - X[None]) ** 2).sum(-1))
    for i in range(n):
        for j in range(i + 1, n):
            cut = 1.75 if (simb[i] == 'C' and simb[j] == 'C') else (1.25 if 'H' in (simb[i], simb[j]) else 0)
            if simb[i] == 'H' and simb[j] == 'H':
                cut = 0
            if D[i, j] < cut:
                nb[i].append(j); nb[j].append(i)
    return nb


def topologia(simb, X):
    """Las dos PUNTAS de la molécula y su diedro anillo-cadena. Regla única para β y licopeno:
    C5 = carbono sp2 con un CH3 y un CH2 de vecinos (en las dos moléculas es el C5/C5′);
    C6 = su vecino sp2; C7 = el otro vecino sp2 de C6; C8 = el siguiente. La PUNTA es todo lo
    que queda del lado de C6 al cortar el enlace C6–C7 (anillo β + metilos, o el extremo ψ)."""
    nb = vecinos(simb, X)
    nH = [sum(simb[j] == 'H' for j in nb[i]) for i in range(len(simb))]
    sp2 = {i for i in range(len(simb)) if simb[i] == 'C' and len(nb[i]) == 3}
    metilo = {i for i in range(len(simb)) if simb[i] == 'C' and nH[i] == 3}
    ch2 = {i for i in range(len(simb)) if simb[i] == 'C' and nH[i] == 2 and len(nb[i]) == 4}
    puntas = []
    for c5 in sorted(sp2):
        if not (any(j in metilo for j in nb[c5]) and any(j in ch2 for j in nb[c5])):
            continue
        c6 = [j for j in nb[c5] if j in sp2][0]
        c7 = [j for j in nb[c6] if j in sp2 and j != c5][0]
        c8 = [j for j in nb[c7] if j in sp2 and j != c6][0]
        lado, pila = {c6}, [c6]
        while pila:
            a = pila.pop()
            for b in nb[a]:
                if b not in lado and not (a == c6 and b == c7):
                    lado.add(b); pila.append(b)
        puntas.append({'C5': c5, 'C6': c6, 'C7': c7, 'C8': c8, 'atomos': sorted(lado)})
    assert len(puntas) == 2, f"esperaba 2 puntas, hay {len(puntas)}"
    # cadena conjugada C5…C5′ (camino más corto por carbonos sp2)
    a0, a1 = puntas[0]['C5'], puntas[1]['C5']
    prev = {a0: None}; cola = [a0]
    while cola:
        a = cola.pop(0)
        for b in nb[a]:
            if b in sp2 and b not in prev:
                prev[b] = a; cola.append(b)
    camino = [a1]
    while prev[camino[-1]] is not None:
        camino.append(prev[camino[-1]])
    return {'nb': nb, 'sp2': sorted(sp2), 'puntas': puntas, 'cadena': camino[::-1]}


def diedro(X, a, b, c, d):
    b0, b1, b2 = X[a] - X[b], X[c] - X[b], X[d] - X[c]
    b1n = b1 / np.linalg.norm(b1)
    v = b0 - np.dot(b0, b1n) * b1n; w = b2 - np.dot(b2, b1n) * b1n
    x = np.dot(v, w); y = np.dot(np.cross(b1n, v), w)
    return math.degrees(math.atan2(y, x))


def bla(X, cadena):
    """Alternancia de enlaces (simple − doble) a lo largo de C5…C5′: lo que abre la brecha."""
    d = np.array([np.linalg.norm(X[cadena[i]] - X[cadena[i + 1]]) for i in range(len(cadena) - 1)])
    dobles, simples = d[0::2], d[1::2]
    return d, float(simples.mean() - dobles.mean())


def resumen_geom(simb, X):
    t = topologia(simb, X)
    d, b = bla(X, t['cadena'])
    die = [diedro(X, p['C5'], p['C6'], p['C7'], p['C8']) for p in t['puntas']]
    nc = len(t['cadena'])
    # 7 enlaces centrales; la PARIDAD se toma del índice global (par = doble) — el corte
    # [len//2−3 : len//2+4] arranca en un índice impar y antes salía con el signo volteado
    c0 = len(d) // 2 - 3; ic = np.arange(c0, c0 + 7)
    blac = float(d[ic[ic % 2 == 1]].mean() - d[ic[ic % 2 == 0]].mean())
    return {'diedros_C5C6C7C8_deg': [round(v, 2) for v in die],
            'cadena_conjugada_atomos': nc, 'enlaces_C5_a_C5p_A': [round(v, 4) for v in d],
            'BLA_A': round(b, 4),
            'BLA_centro_A': round(blac, 4),
            'largo_C5_C5p_A': round(float(np.linalg.norm(X[t['cadena'][0]] - X[t['cadena'][-1]])), 3)}


# ── GEOMETRÍA ───────────────────────────────────────────────────────────────────────────
def _mol(simb, X, basis=None, verbose=3):
    from pyscf import gto
    return gto.M(atom=[[s, tuple(p)] for s, p in zip(simb, X)], basis=basis or BASIS, unit='Angstrom',
                 max_memory=MAXMEM, verbose=verbose)


def _np(a):
    """cupy → numpy (gpu4pyscf devuelve arreglos de la GPU); numpy/escalares pasan igual."""
    return np.asarray(a.get() if hasattr(a, 'get') else a)


def _rks_gpu(mol, xc, df):
    """RKS de gpu4pyscf (2026-10-13). `xc` acepta el sufijo de dispersión de la casa
    ('b3lyp-d3bj' → xc b3lyp + disp d3bj). df=True: ajuste de densidad (SCF+gradiente de la
    optimización: ~1.5 min/paso contra ~10 en CPU, y sin los h5 temporales de 3.5 GB que
    tronaron con EIO en /mnt/e el 10-09). df=False: J/K directos (Rys) — el TD-DFT con DF NO
    cabe en 12 GB (assert dm_batch_size > 0 en df_jk), el directo sí.
    GATE medido: B3LYP-D3(BJ)/def2-SVP malla 2 en geom-beta-xtb: GPU −1556.9645271219 Ha vs
    CPU −1556.9645271197 (ΔE 2.2e-9 Ha, del orden del conv_tol)."""
    from gpu4pyscf import dft as gdft
    base, disp = (xc.split('-', 1) + [None])[:2] if xc.endswith(('-d3bj', '-d3', '-d4')) else (xc, None)
    mf = gdft.RKS(mol, xc=base)
    if disp:
        mf.disp = disp
    return mf.density_fit() if df else mf


def optimiza(simb, X, xc, grid, tag, restricciones=None, maxsteps=150):
    from pyscf import dft
    from pyscf.geomopt.geometric_solver import kernel as geom_kernel
    traj = os.path.join(WORK, f'traj-{tag}.xyz')
    if os.path.exists(traj):                       # REANUDAR: arranca del último paso guardado
        bloques = open(traj).read().split('\n')
        n = len(simb); paso = n + 2
        nfr = len([l for l in bloques if l.strip() == str(n)])
        if nfr:
            ult = bloques[(nfr - 1) * paso:(nfr - 1) * paso + paso]
            X = np.array([[float(v) for v in l.split()[1:4]] for l in ult[2:2 + n]])
            log(f'   {tag}: reanudo desde el paso {nfr} de {traj}')
    mol = _mol(simb, X)
    if GPU:
        mf = _rks_gpu(mol, xc, df=True); grid = max(grid, 3)   # en GPU la malla 3 sale casi gratis
    else:
        mf = dft.RKS(mol, xc=xc).density_fit()
    mf.grids.level = grid; mf.conv_tol = 1e-8; mf.max_cycle = 100
    t0 = time.time(); estado = {'n': 0}

    def cb(env):
        try:
            m = env.get('mol'); e = env.get('energy')
            if m is None:
                return
            estado['n'] += 1
            with open(traj, 'a') as f:
                f.write(f"{len(simb)}\n{tag} paso {estado['n']} E={e}\n")
                for s, p in zip(simb, m.atom_coords() * BOHR):
                    f.write(f"{s} {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}\n")
            log(f"   {tag} paso {estado['n']:3d}  E={e:.8f} Ha  ({(time.time()-t0)/60:.1f} min)")
        except Exception as ex:                    # el registro jamás tumba la optimización
            print('cb', ex)

    kw = {'maxsteps': maxsteps, 'callback': cb}
    if xc.startswith('pbe'):
        # la pre-opt PBE es solo para llegar CERCA: criterios GAU_LOOSE de geomeTRIC. El
        # refinamiento B3LYP usa los criterios normales (GAU), que son los que valen.
        kw['convergence_set'] = 'GAU_LOOSE'
    if restricciones:
        fn = os.path.join(WORK, f'restricciones-{tag}.txt')
        open(fn, 'w').write(restricciones); kw['constraints'] = fn
    conv, mol_eq = geom_kernel(mf, **kw)
    Xeq = mol_eq.atom_coords() * BOHR
    return Xeq, bool(conv), (time.time() - t0) / 60


def girar_puntas(simb, X, objetivo=180.0):
    """Gira cada PUNTA alrededor del enlace C6–C7 hasta que C5=C6–C7=C8 = objetivo."""
    X = X.copy(); t = topologia(simb, X)
    for p in t['puntas']:
        c5, c6, c7, c8 = p['C5'], p['C6'], p['C7'], p['C8']
        eje = X[c6] - X[c7]; eje /= np.linalg.norm(eje)
        idx = [i for i in p['atomos'] if i != c6]
        def rot(th):
            K = np.array([[0, -eje[2], eje[1]], [eje[2], 0, -eje[0]], [-eje[1], eje[0], 0]])
            R = np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K
            Y = X.copy(); Y[idx] = (X[idx] - X[c7]) @ R.T + X[c7]; return Y
        phi = diedro(X, c5, c6, c7, c8)
        for s in (+1, -1):
            Y = rot(math.radians(s * (objetivo - phi)))
            if abs(((diedro(Y, c5, c6, c7, c8) - objetivo) + 180) % 360 - 180) < 0.5:
                X = Y; break
        else:
            raise RuntimeError('no pude girar la punta')
    D = np.sqrt(((X[:, None] - X[None]) ** 2).sum(-1)) + np.eye(len(X)) * 9
    nb = vecinos(simb, X)
    for i in range(len(X)):
        for j in nb[i]:
            D[i, j] = 9
    log(f'   plano: puntas giradas a {objetivo}°; distancia NO enlazada mínima = {D.min():.2f} Å')
    return X


def etapa_geom(nombre):
    log(f'═══ GEOM {nombre}: {NOMBRE[nombre]} ═══')
    final = os.path.join(WORK, f'geom-{nombre}.xyz')
    if nombre == 'plano':
        # arranque = el β de PubChem con las puntas giradas a 180° (girar_puntas) y relajado con
        # MMFF94 con esos diedros congelados: el giro rígido deja un choque H···H de 1.20 Å que
        # MMFF abre a ≥1.99 Å (plano-mmff.xyz, hecho con RDKit). Luego el MISMO camino que β,
        # con los dos diedros C5=C6–C7=C8 CONGELADOS en 180° en las dos etapas DFT.
        simb, X = leer_xyz(os.path.join(WORK, 'plano-mmff.xyz'))
        t = topologia(simb, X)
        rs = '$set\n' + ''.join(f"dihedral {p['C5']+1} {p['C6']+1} {p['C7']+1} {p['C8']+1} 180.0\n"
                                for p in t['puntas'])
        etapas = [('pbe-d3bj', 2, 'plano-pbe', rs), ('b3lyp-d3bj', 2, 'plano-b3lyp', rs)]
    else:
        ini = {'beta': 'beta-pubchem.xyz', 'licopeno': 'licopeno-mmff.xyz'}[nombre]
        simb, X = leer_xyz(os.path.join(WORK, ini))
        rs = None
        etapas = [('pbe-d3bj', 2, f'{nombre}-pbe', None), ('b3lyp-d3bj', 2, f'{nombre}-b3lyp', None)]
    pre = os.path.join(WORK, f'geom-{nombre}-xtb.xyz')
    if os.path.exists(pre):
        # con la pre-opt GFN2-xTB hecha (etapa xtb), la PBE sobra: directo a B3LYP
        simb, X = leer_xyz(pre); etapas = [e for e in etapas if not e[0].startswith('pbe')]
        log(f'   arranque desde la pre-opt xTB ({pre})')
    log(f'   arranque: {resumen_geom(simb, X)["diedros_C5C6C7C8_deg"]} (diedros C5=C6–C7=C8)')
    info = {'molecula': NOMBRE[nombre], 'etapas': []}
    # SOLO=pbe → solo la pre-opt barata (cabe en paralelo: ~2.5 GB c/u); SOLO=b3lyp → solo el
    # refinamiento (11.3 GB de tensor DF en memoria: de UNO en UNO).
    solo = os.environ.get('SOLO')
    for xc, grid, tag, rs in etapas:
        hecho = os.path.join(WORK, f'geom-{tag}.xyz')
        if os.path.exists(hecho):
            simb, X = leer_xyz(hecho); log(f'   {tag}: ya estaba ({hecho})')
            info['etapas'].append({'tag': tag, 'xc': xc, **resumen_geom(simb, X)}); continue
        if solo and not xc.startswith(solo):
            log(f'   {tag}: se salta (SOLO={solo})'); return
        log(f'   {tag}: optimizando {len(simb)} átomos, {xc}/def2-SVP (DF), malla {grid}'
            f'{" CON restricciones" if rs else ""}…')
        X, conv, mins = optimiza(simb, X, xc, grid, tag, rs)
        escribir_xyz(hecho, simb, X, f'{tag} convergió={conv} {mins:.1f} min')
        r = resumen_geom(simb, X)
        log(f'   {tag}: convergió={conv} en {mins:.1f} min · diedros {r["diedros_C5C6C7C8_deg"]} · BLA {r["BLA_A"]} Å')
        info['etapas'].append({'tag': tag, 'xc': xc, 'convergio': conv, 'min': round(mins, 1), **r})
    escribir_xyz(final, simb, X, f'{nombre} B3LYP-D3(BJ)/def2-SVP')
    # energía final (para comparar β vs plano: el COSTO de aplanar)
    from pyscf import dft
    if GPU:
        mf = _rks_gpu(_mol(simb, X, verbose=0), 'b3lyp-d3bj', df=True)
    else:
        mf = dft.RKS(_mol(simb, X, verbose=0), xc='b3lyp-d3bj').density_fit()
    mf.grids.level = 3
    info['E_b3lyp_d3bj_Ha'] = float(mf.kernel())
    info.update(resumen_geom(simb, X))
    json.dump(info, open(os.path.join(WORK, f'geom-{nombre}.json'), 'w'), indent=1, ensure_ascii=False)
    log(f'   OK {final}  E={info["E_b3lyp_d3bj_Ha"]:.6f} Ha')


# ── ARRANQUE (laptop, con RDKit; corre UNA vez y deja los .xyz de partida en WORK) ──────────
SMILES_LICOPENO = ("CC(=CCC/C(=C/C=C/C(=C/C=C/C(=C/C=C/C=C(/C=C/C=C(/C=C/C=C(/CCC=C(C)C)\\C)\\C)"
                   "\\C)/C)/C)/C)C")   # PubChem CID 446925, SMILES isomérico (todo-trans)


def etapa_arranque():
    """beta-pubchem.xyz: bajarlo a mano de PubChem (no se ejecuta nada descargado):
         curl 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/5280489/record/SDF?record_type=3d'
       y pasar el bloque de átomos del SDF a .xyz.
    licopeno-mmff.xyz: PubChem NO publica 3D del licopeno (demasiado flexible) → SMILES isomérico
       → RDKit ETKDG (40 confórmeros, semilla fija) → MMFF94 con los 10 enlaces simples
       conjugados C=C–C=C forzados s-trans (180°) → MMFF libre → el de menor energía.
    plano-mmff.xyz: el β de PubChem con las dos puntas giradas a 180° → MMFF94 con esos diedros
       congelados (abre el choque H···H de 1.20 Å del giro rígido)."""
    from rdkit import Chem
    from rdkit.Chem import AllChem, rdDetermineBonds, rdMolTransforms as T
    m = Chem.AddHs(Chem.MolFromSmiles(SMILES_LICOPENO))
    cids = AllChem.EmbedMultipleConfs(m, numConfs=40, randomSeed=SEED)
    AllChem.MMFFOptimizeMoleculeConfs(m, maxIters=4000)
    dihs = m.GetSubstructMatches(Chem.MolFromSmarts('[CX3]=[CX3]-[CX3]=[CX3]'))
    mp = AllChem.MMFFGetMoleculeProperties(m); mejor = None
    for cid in cids:
        conf = m.GetConformer(cid)
        for q in dihs:
            T.SetDihedralDeg(conf, *q, 180.0)
        ff = AllChem.MMFFGetMoleculeForceField(m, mp, confId=cid)
        for q in dihs:
            ff.MMFFAddTorsionConstraint(*q, False, 179.0, 181.0, 100.0)
        ff.Minimize(maxIts=5000)
        ff2 = AllChem.MMFFGetMoleculeForceField(m, mp, confId=cid); ff2.Minimize(maxIts=5000)
        if mejor is None or ff2.CalcEnergy() < mejor[0]:
            mejor = (ff2.CalcEnergy(), cid)
    escribir_xyz(os.path.join(WORK, 'licopeno-mmff.xyz'), [a.GetSymbol() for a in m.GetAtoms()],
                 m.GetConformer(mejor[1]).GetPositions(), 'licopeno RDKit ETKDG+MMFF94, cadena s-trans')
    src = os.path.join(WORK, 'beta-pubchem.xyz')
    s, X = leer_xyz(src); t = topologia(s, X); Y = girar_puntas(s, X, 180.0)
    mb = Chem.MolFromXYZBlock(open(src).read()); rdDetermineBonds.DetermineBonds(mb, charge=0)
    cf = mb.GetConformer()
    for i, p in enumerate(Y):
        cf.SetAtomPosition(i, p.tolist())
    ff = AllChem.MMFFGetMoleculeForceField(mb, AllChem.MMFFGetMoleculeProperties(mb))
    for p in t['puntas']:
        ff.MMFFAddTorsionConstraint(p['C5'], p['C6'], p['C7'], p['C8'], False, 179.5, 180.5, 500.0)
    ff.Minimize(maxIts=20000)
    escribir_xyz(os.path.join(WORK, 'plano-mmff.xyz'), s, mb.GetConformer().GetPositions(),
                 'beta con puntas s-trans 180 (giro rigido + MMFF94 con diedros congelados)')
    log('   arranque: licopeno-mmff.xyz + plano-mmff.xyz')


def etapa_xtb(nombre):
    """PRE-OPT GFN2-xTB (tblite + ASE, en la laptop: segundos por paso). Sustituye a la pre-opt
    PBE, que en iangpu compartido costaba ~9 min por paso. Es SOLO para llegar cerca: la
    geometría que vale es la B3LYP-D3(BJ)/def2-SVP que sigue. `plano` congela sus dos diedros."""
    from ase import Atoms
    from ase.optimize import BFGS
    from ase.constraints import FixInternals
    from tblite.ase import TBLite
    ini = {'beta': 'beta-pubchem.xyz', 'licopeno': 'licopeno-mmff.xyz', 'plano': 'plano-mmff.xyz'}[nombre]
    simb, X = leer_xyz(os.path.join(WORK, ini))
    at = Atoms(symbols=simb, positions=X)
    if nombre == 'plano':
        t = topologia(simb, X)
        at.set_constraint(FixInternals(dihedrals_deg=[[180.0, [p['C5'], p['C6'], p['C7'], p['C8']]]
                                                      for p in t['puntas']]))
    at.calc = TBLite(method='GFN2-xTB', verbosity=0)
    opt = BFGS(at, logfile=os.path.join(WORK, f'xtb-{nombre}.log'))
    conv = opt.run(fmax=0.01, steps=2000)
    Y = at.get_positions()
    escribir_xyz(os.path.join(WORK, f'geom-{nombre}-xtb.xyz'), simb, Y,
                 f'{nombre} GFN2-xTB pre-opt (tblite/ASE BFGS fmax 0.01 eV/A) conv={conv}')
    r = resumen_geom(simb, Y)
    log(f"   xtb {nombre}: conv={conv} en {opt.nsteps} pasos · diedros {r['diedros_C5C6C7C8_deg']} · BLA {r['BLA_A']} Å")


# ── TD-DFT ──────────────────────────────────────────────────────────────────────────────
class KRapida:
    """J y K de la RESPUESTA TD-DFT en base MO, para densidades de prueba ocupado-virtual.

    Por qué existe (2026-10-09). El TD-DFT de PySCF arma, en cada vector de Davidson, una matriz
    densidad AO genérica y le aplica el K de ajuste de densidad genérico: 2·naux·nao³ por vector
    (4008·840³ ≈ 4.7e12 flop) y otra vez para el rango largo de CAM-B3LYP. Medido en iangpu
    compartido: el TD de prueba en STO-3G llevaba >1.5 h sin terminar; en def2-SVP serían días.
    Pero la densidad de prueba NO es genérica: es D = C_o X C_vᵀ + C_v Y C_oᵀ, y el TD solo lee los
    bloques ov y vo de la respuesta. Con los factores DF ya transformados a MO
    (B_oo, B_ov, B_vv por función auxiliar P, en float32):
        K_ov = Σ_P B_oo X B_vv + B_ov Y B_ov        K_voᵀ = Σ_P B_oo Yᵀ B_vv + B_ov Xᵀ B_ov
        J_ov = Σ_P c_P B_ov,  c_P = Σ_ia B_ov[P,ia] (X + Yᵀ)_ia
    ≈ 5× menos flops y GEMMs grandes. Es ÁLGEBRA EXACTA del mismo DF (no es otra aproximación):
    se valida contra el get_jk de PySCF (prueba_k) y contra su TD completo en STO-3G.
    La matriz AO que se devuelve reproduce SOLO los bloques ov/vo (los únicos que el TD lee)."""

    def __init__(self, mf, blk=48):
        from pyscf import lib
        self.lib = lib
        C = np.asarray(mf.mo_coeff); occ = np.asarray(mf.mo_occ)
        self.nocc = no = int((occ > 0).sum()); self.nvir = C.shape[1] - no
        S = mf.get_ovlp()
        self.SCo, self.SCv = S @ C[:, :no], S @ C[:, no:]
        self.omega, self.alpha, self.hyb = mf._numint.rsh_and_hybrid_coeff(mf.xc, mf.mol.spin)
        t0 = time.time()
        self.B = {0.0: self._transforma(mf.with_df, C, blk)}
        mf.with_df._cderi = None                       # libera los 11 GB del tensor AO
        import gc; gc.collect()
        if self.omega:
            with mf.with_df.range_coulomb(self.omega) as rsh:
                self.B[self.omega] = self._transforma(rsh, C, blk)
        log(f'   K rápida: factores DF en MO listos ({(time.time()-t0)/60:.1f} min, '
            f'{sum(b[k].nbytes for b in self.B.values() for k in b)/1e9:.1f} GB float32)')

    def _transforma(self, df, C, blk):
        lib, no, nv = self.lib, self.nocc, self.nvir
        naux = df.get_naoaux()
        Boo = np.empty((naux, no, no), np.float32); Bov = np.empty((naux, no, nv), np.float32)
        Bvv = np.empty((naux, nv * (nv + 1) // 2), np.float32)
        p0 = 0
        for eri1 in df.loop(blk):
            L = lib.unpack_tril(eri1)
            M = np.matmul(C.T, np.matmul(L, C)); del L
            p1 = p0 + M.shape[0]
            Boo[p0:p1] = M[:, :no, :no]; Bov[p0:p1] = M[:, :no, no:]
            Bvv[p0:p1] = lib.pack_tril(np.ascontiguousarray(M[:, no:, no:])); p0 = p1
        assert p0 == naux
        return {'oo': Boo, 'ov': Bov, 'vv': Bvv}

    def _k(self, B, Z, W, cJ=None):
        """Σ_P B_oo Z B_vv + B_ov W B_ov para cada (Z: o×v, W: v×o). cJ: además J con (Z+Wᵀ)."""
        lib, no, nv = self.lib, self.nocc, self.nvir
        n = Z.shape[0]; Z = Z.astype(np.float32); W = W.astype(np.float32)
        K = np.zeros((n, no, nv)); J = np.zeros((n, no, nv)) if cJ is not None else None
        naux = B['oo'].shape[0]
        b = max(1, min(64, int(3.0e8 / (n * no * nv * 4))))
        for p0 in range(0, naux, b):
            p1 = min(naux, p0 + b); bb = p1 - p0
            Boo, Bov = B['oo'][p0:p1], B['ov'][p0:p1]
            Bvv = lib.unpack_tril(B['vv'][p0:p1])
            T = np.matmul(Boo[:, None], Z[None])                       # (b,n,o,v)
            K += (T.transpose(1, 2, 0, 3).reshape(n * no, bb * nv) @ Bvv.reshape(bb * nv, nv)).reshape(n, no, nv)
            U = np.matmul(Bov[:, None], W[None])                       # (b,n,o,o)
            K += (U.transpose(1, 2, 0, 3).reshape(n * no, bb * no) @ Bov.reshape(bb * no, nv)).reshape(n, no, nv)
            if cJ is not None:
                c = np.einsum('poa,noa->pn', Bov, cJ)
                J += np.einsum('pn,poa->noa', c, Bov)
        return K, J

    def _ov(self, dm):
        dm = np.asarray(dm); uno = dm.ndim == 2
        D = dm[None] if uno else dm
        X = np.einsum('pi,npq,qa->nia', self.SCo, D, self.SCv)       # (n,o,v)
        Yvo = np.einsum('pa,npq,qi->nai', self.SCv, D, self.SCo)     # (n,v,o)
        return X, Yvo, uno

    def _ao(self, Mov, Mvo_T, uno):
        A = np.einsum('pi,nia,qa->npq', self.SCo, Mov, self.SCv)
        A += np.einsum('qi,nia,pa->npq', self.SCo, Mvo_T, self.SCv)  # bloque vo = (Mvo_T)ᵀ
        return A[0] if uno else A

    def _jk(self, dm, omega_key, with_j):
        X, Yvo, uno = self._ov(dm)
        n = X.shape[0]
        Z = np.concatenate([X, Yvo.transpose(0, 2, 1)]); W = np.concatenate([Yvo, X.transpose(0, 2, 1)])
        cJ = np.concatenate([X + Yvo.transpose(0, 2, 1)] * 2) if with_j else None
        K, J = self._k(self.B[omega_key], Z, W, cJ)
        k = self._ao(K[:n], K[n:], uno)
        j = self._ao(J[:n], J[:n], uno) if with_j else None
        return j, k

    # interfaz de PySCF (la que llama _gen_rhf_response)
    def get_jk(self, mol=None, dm=None, hermi=0, with_j=True, with_k=True, omega=None, **kw):
        j, k = self._jk(dm, float(omega or 0.0), True)
        return j, k

    def get_k(self, mol=None, dm=None, hermi=0, omega=None, **kw):
        return self._jk(dm, float(omega or 0.0), False)[1]

    def get_j(self, mol=None, dm=None, hermi=0, omega=None, **kw):
        return self._jk(dm, 0.0, True)[0]


def respuesta_rapida(mf, kr, nivel_fxc):
    """La función de respuesta de PySCF (_gen_rhf_response, singlete) con dos cambios declarados:
    J/K de KRapida (álgebra exacta del mismo DF) y el kernel XC f_xc en una malla de nivel
    `nivel_fxc` (la SCF usa nivel 3). El costo del f_xc genérico es ngrid·nao² por vector."""
    from pyscf import dft
    from pyscf.scf._response_functions import _gen_rhf_response
    mf2 = mf.copy()
    if nivel_fxc is not None and nivel_fxc != mf.grids.level:
        g = dft.gen_grid.Grids(mf.mol); g.level = nivel_fxc; g.build(); mf2.grids = g
    mf2.get_jk, mf2.get_k, mf2.get_j = kr.get_jk, kr.get_k, kr.get_j
    reloj = {'llamadas': 0, 'vectores': 0, 't_total': 0.0, 't_k': 0.0}
    _jk = kr._jk

    def _jk_medido(*a, **k):
        t = time.time(); r = _jk(*a, **k); reloj['t_k'] += time.time() - t; return r
    kr._jk = _jk_medido

    def gen(singlet=True, hermi=0, max_memory=None):
        v = _gen_rhf_response(mf2, singlet=singlet, hermi=hermi, max_memory=max_memory)

        def vresp(dm1):
            t = time.time(); r = v(dm1)
            reloj['llamadas'] += 1; reloj['vectores'] += (1 if np.ndim(dm1) == 2 else len(dm1))
            reloj['t_total'] += time.time() - t
            log(f"      respuesta #{reloj['llamadas']}: {np.shape(dm1)[0] if np.ndim(dm1) == 3 else 1} vectores · "
                f"acumulado {reloj['t_total']/60:.1f} min (J/K {reloj['t_k']/60:.1f} · f_xc {(reloj['t_total']-reloj['t_k'])/60:.1f})")
            return r
        return vresp
    return gen


def etapa_td(nombre):
    from pyscf import dft
    log(f'═══ TD {nombre}: TD-DFT {FUNC}/def2-SVP, {NSTATES} estados ═══')
    simb, X = leer_xyz(os.path.join(WORK, f'geom-{nombre}.xyz'))
    mol = _mol(simb, X, verbose=4)
    if GPU:
        # J/K DIRECTOS en GPU: el TD con DF no cabe en 12 GB. Medido 10-13 (geom xTB del β):
        # SCF 1.5 min + 6 estados en 16 min, todos convergidos.
        mf = _rks_gpu(mol, FUNC, df=False)
    else:
        mf = dft.RKS(mol, xc=FUNC).density_fit()
    mf.grids.level = 3; mf.conv_tol = 1e-9
    t0 = time.time(); e0 = float(mf.kernel())
    log(f'   SCF {FUNC}: E={e0:.8f} Ha ({(time.time()-t0)/60:.1f} min)')
    mo_c, mo_o, mo_e = _np(mf.mo_coeff), _np(mf.mo_occ), _np(mf.mo_energy)
    np.savez(os.path.join(WORK, f'gs-{nombre}-{FUNC}.npz'), mo_coeff=mo_c, mo_occ=mo_o, mo_energy=mo_e, e=e0)
    td = mf.TDDFT(); td.nstates = NSTATES; td.max_cycle = 200; td.verbose = 5   # 5 = una línea por iteración de Davidson
    t1 = time.time()
    if RAPIDO_TD and not GPU:
        kr = KRapida(mf)
        td.gen_response = respuesta_rapida(mf, kr, NIVEL_FXC)
        log(f'   TD con K rápida (MO) y f_xc en malla nivel {NIVEL_FXC}')
    td.kernel()
    if not np.all(td.converged):
        log(f'   ⚠ TDDFT: estados sin converger {list(np.where(~np.asarray(td.converged))[0])}')
    e = _np(td.e); f = _np(td.oscillator_strength(gauge='length'))
    mu = _np(td.transition_dipole())
    Xs = np.array([_np(x) for x, y in td.xy])
    Ys = np.array([_np(y) if not np.isscalar(y) else np.zeros_like(_np(x)) for x, y in td.xy])
    np.savez(os.path.join(WORK, f'td-{nombre}-{FUNC}.npz'), e=e, f=f, mu=mu, X=Xs, Y=Ys)
    nocc = int((mo_o > 0).sum()); homo = nocc - 1
    estados = []
    for k in range(len(e)):
        w = Xs[k] ** 2 - Ys[k] ** 2
        orden = np.argsort(-np.abs(w).ravel())[:3]
        trans = []
        for o in orden:
            i, a = divmod(int(o), w.shape[1])
            trans.append({'de': ('HOMO' if i == homo else f'HOMO-{homo-i}'),
                          'a': ('LUMO' if a == 0 else f'LUMO+{a}'), 'peso': round(float(2 * w.ravel()[o]), 3)})
        estados.append({'n': k + 1, 'E_eV': round(float(e[k] * HA_EV), 4),
                        'lambda_nm': round(EV_NM / float(e[k] * HA_EV), 1), 'f': round(float(f[k]), 4),
                        'mu_au': [round(float(v), 3) for v in mu[k]], 'excitaciones': trans})
    kb = int(np.argmax(f))
    out = {'molecula': NOMBRE[nombre], 'metodo': f'TD-DFT (RPA) {FUNC}/def2-SVP (DF) // B3LYP-D3(BJ)/def2-SVP',
           'E0_Ha': float(e0), 'gap_HOMO_LUMO_eV': round(float((mo_e[nocc] - mo_e[homo]) * HA_EV), 4),
           'estados': estados, 'brillante': estados[kb],
           'min_SCF': round((t1 - t0) / 60, 1), 'min_TD': round((time.time() - t1) / 60, 1)}
    json.dump(out, open(os.path.join(WORK, f'td-{nombre}-{FUNC}.json'), 'w'), indent=1, ensure_ascii=False)
    for s in estados:
        log(f"   S{s['n']:2d}  {s['E_eV']:.3f} eV  {s['lambda_nm']:6.1f} nm  f={s['f']:.3f}  "
            + ' + '.join(f"{t['de']}→{t['a']}({t['peso']})" for t in s['excitaciones'][:2]))
    log(f"   BRILLANTE {nombre}: S{estados[kb]['n']}  {estados[kb]['lambda_nm']} nm  f={estados[kb]['f']}")


# ── NUBES ───────────────────────────────────────────────────────────────────────────────
def sample_field(f, U, lo, paso):
    """Muestreador LAGRANGIANO de la casa (copiado LITERAL de precompute-grasa.py)."""
    nx, ny, nz = f.shape
    M = U.shape[0]
    f = np.maximum(f, 0.0)
    Cx = np.concatenate([[0.0], np.cumsum(f.sum(axis=(1, 2)))])
    if Cx[-1] <= 0:
        return np.zeros((M, 3))
    t = U[:, 0] * Cx[-1]
    ix = np.clip(np.searchsorted(Cx, t, side='right') - 1, 0, nx - 1)
    x = lo[0] + (ix + (t - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)) * paso
    cm = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((nx, 1)), np.cumsum(cm, axis=1)], axis=1)[ix]
    ty = U[:, 1] * Cy[:, -1]
    iy = np.clip((Cy[:, :-1] <= ty[:, None]).sum(axis=1) - 1, 0, ny - 1)
    c0, c1 = Cy[np.arange(M), iy], Cy[np.arange(M), iy + 1]
    y = lo[1] + (iy + (ty - c0) / np.maximum(c1 - c0, 1e-30)) * paso
    zc = f[ix, iy]
    Cz = np.concatenate([np.zeros((M, 1)), np.cumsum(zc, axis=1)], axis=1)
    tz = U[:, 2] * Cz[:, -1]
    iz = np.clip((Cz[:, :-1] <= tz[:, None]).sum(axis=1) - 1, 0, nz - 1)
    d0, d1 = Cz[np.arange(M), iz], Cz[np.arange(M), iz + 1]
    z = lo[2] + (iz + (tz - d0) / np.maximum(d1 - d0, 1e-30)) * paso
    return np.stack([x, y, z], axis=1)


def posq_para(*arrays):
    """POSQ ADAPTATIVO (copiado de precompute-water-approach.py): cabe el punto más lejano con
    2 % de aire. Una cadena de ~30 Å pasa de ±6.55 bohr: con 5000 fijo se aplastaría."""
    m = max(float(np.abs(a).max()) for a in arrays if a.size)
    return min(5000.0, 32767.0 / max(m * 1.02, 1e-6))


def escribe_wap2(path, chans, accColor, Z, nuc, bond):
    """WAP2 literal (el de precompute-grasa.py): K=2 cuadros IDÉNTICOS = la molécula quieta."""
    K = 2
    posq = posq_para(*chans, nuc)
    q = lambda a: np.clip(np.round(np.asarray(a) * posq), -32767, 32767).astype('<i2')
    Rv = np.array([1.0, 0.0], '<f4')
    with open(path, 'wb') as f:
        f.write(struct.pack('<4s7i', b'WAP2', len(chans[0]), len(chans[1]), len(chans[2]), K, len(Z), 0, 0))
        f.write(struct.pack('<3f', posq, float(Rv[-1]), float(Rv[0])))
        f.write(Rv.tobytes())
        f.write(np.full(K, bond, '<f4').tobytes())
        f.write(np.clip(np.asarray(accColor) * 255, 0, 255).astype(np.uint8).tobytes())
        f.write(np.asarray(Z).astype('<i2').tobytes())
        for c in chans:
            f.write(q(np.stack([c] * K)).tobytes())
        f.write(q(np.stack([nuc] * K)).tobytes())
    return posq


def marco(simb, X, t):
    """Eje X = eje largo de los carbonos conjugados, Z = normal al plano π, origen = centroide C."""
    C = np.array([i for i, s in enumerate(simb) if s == 'C'])
    c0 = X[C].mean(0)
    cad = X[t['cadena']] - X[t['cadena']].mean(0)
    _, _, V = np.linalg.svd(cad)
    ex = V[0]; ez = V[2]
    ez = ez - ex * np.dot(ez, ex); ez /= np.linalg.norm(ez)
    ey = np.cross(ez, ex)
    R = np.stack([ex, ey, ez])                    # filas = ejes nuevos
    if (X[t['puntas'][0]['C5']] - c0) @ ex > 0:  # punta 0 siempre en −X
        R[0] *= -1; R[1] *= -1
    return R, c0


def clasifica_pi(mol, simb, X, t, C, S, idx):
    """Fracción π de cada MO: peso Löwdin en las funciones p de cada carbono sp2 proyectadas
    sobre la NORMAL LOCAL de su plano (cross de sus tres vecinos). Con normales locales el
    anillo torcido se clasifica bien aunque no sea coplanar con la cadena."""
    from scipy.linalg import sqrtm
    Sh = np.real(sqrtm(S)); Co = Sh @ C[:, idx]
    labels = mol.ao_labels(fmt=False)
    frac = np.zeros(len(idx))
    for a in t['sp2']:
        v = [X[j] for j in t['nb'][a]]
        n = np.cross(v[1] - v[0], v[2] - v[0]); n /= np.linalg.norm(n)
        # funciones p de este átomo, agrupadas por capa: en esférico PySCF el orden es px,py,pz
        ps = [k for k, l in enumerate(labels) if l[0] == a and l[2].endswith('p')]
        for g in range(0, len(ps), 3):
            trio = ps[g:g + 3]
            comp = {labels[k][3]: k for k in trio}
            proy = n[0] * Co[comp['x']] + n[1] * Co[comp['y']] + n[2] * Co[comp['z']]
            frac += proy ** 2
    return frac


def etapa_nubes(nombre):
    from pyscf import scf
    from scipy.spatial import cKDTree
    log(f'═══ NUBES {nombre} ═══')
    simb, X = leer_xyz(os.path.join(WORK, f'geom-{nombre}.xyz'))
    t = topologia(simb, X)
    mol = _mol(simb, X, verbose=0)
    gs = np.load(os.path.join(WORK, f'gs-{nombre}-{FUNC}.npz'))
    td = np.load(os.path.join(WORK, f'td-{nombre}-{FUNC}.npz'))
    C, occ = gs['mo_coeff'], gs['mo_occ']
    nocc = int((occ > 0).sum()); homo, lumo = nocc - 1, nocc
    S = mol.intor('int1e_ovlp')
    fo = clasifica_pi(mol, simb, X, t, C, S, list(range(nocc)))
    pi_occ = [i for i in range(nocc) if fo[i] > 0.4]
    fv = clasifica_pi(mol, simb, X, t, C, S, [homo, lumo])
    log(f'   MOs π ocupados: {len(pi_occ)} ({2*len(pi_occ)} e⁻ π) · fracción π HOMO={fv[0]:.2f} LUMO={fv[1]:.2f}'
        f' · siguiente σ más π-like = {sorted(fo[[i for i in range(nocc) if i not in pi_occ]])[-1]:.2f}')
    dm = (C * occ) @ C.T
    dm_pro = scf.hf.init_guess_by_atom(mol)
    Cpi = C[:, pi_occ]; dm_pi = 2 * Cpi @ Cpi.T
    kb = int(np.argmax(td['f'])); Xb, Yb = td['X'][kb], td['Y'][kb]
    Too = Xb @ Xb.T + Yb @ Yb.T; Tvv = Xb.T @ Xb + Yb.T @ Yb
    Too /= np.trace(Too); Tvv /= np.trace(Tvv)               # 1 electrón que se mueve
    Co, Cv = C[:, :nocc], C[:, nocc:]
    dm_det = Co @ Too @ Co.T; dm_att = Cv @ Tvv @ Cv.T

    R, c0 = marco(simb, X, t)
    Xal = (X - c0) @ R.T                                       # Å, marco de la escena
    lo = Xal.min(0) - MARGEN; hi = Xal.max(0) + MARGEN
    ns = [int(math.ceil((hi[k] - lo[k]) / PASO)) for k in range(3)]
    ijk = np.stack(np.meshgrid(*[np.arange(n) for n in ns], indexing='ij'), -1).reshape(-1, 3)
    Gal = lo + ijk * PASO
    Gor = (Gal @ R + c0) / BOHR                                # bohr, marco de la molécula
    log(f'   malla {ns[0]}×{ns[1]}×{ns[2]} = {len(Gal)/1e6:.2f} M nodos · paso {PASO} Å')
    campos = {k: np.empty(len(Gal)) for k in ('mol', 'pro', 'pi', 'homo', 'lumo', 'att', 'det')}
    t0 = time.time()
    for a0 in range(0, len(Gal), 20000):
        sl = slice(a0, a0 + 20000)
        ao = mol.eval_gto('GTOval_sph', Gor[sl])
        for k, d in (('mol', dm), ('pro', dm_pro), ('pi', dm_pi), ('att', dm_att), ('det', dm_det)):
            campos[k][sl] = np.einsum('pi,pi->p', ao @ d, ao)
        campos['homo'][sl] = (ao @ C[:, homo]) ** 2
        campos['lumo'][sl] = (ao @ C[:, lumo]) ** 2
    log(f'   campos evaluados ({(time.time()-t0)/60:.1f} min)')
    dV = (PASO / BOHR) ** 3
    drho = campos['mol'] - campos['pro']
    dexc = campos['att'] - campos['det']
    integ = {k: float(v.sum() * dV) for k, v in campos.items()}
    log(f"   ∫ρ={integ['mol']:.2f} (296 e⁻) · ∫ρ_π={integ['pi']:.2f} · ∫HOMO²={integ['homo']:.3f} · ∫LUMO²={integ['lumo']:.3f}")

    # ── LAS PUNTAS: qué fracción de cada densidad vive en los anillos/extremos ──
    arbol = cKDTree(Xal)
    _, cerca = arbol.query(Gal)
    en_punta = np.zeros(len(simb), bool)
    for p in t['puntas']:
        en_punta[p['atomos']] = True
    g_punta = en_punta[cerca]
    frac_punta = {k: float(campos[k][g_punta].sum() / max(campos[k].sum(), 1e-30))
                  for k in ('pi', 'homo', 'lumo', 'att', 'det')}
    # carga que la luz MUEVE: ∫|Δρ_exc|/2 y cuánto de eso cae en las puntas
    frac_punta['exc_movida'] = float(np.abs(dexc)[g_punta].sum() / np.abs(dexc).sum())
    log('   fracción en las PUNTAS: ' + ' · '.join(f'{k} {100*v:.1f}%' for k, v in frac_punta.items()))

    # carga de ENLACE: Δρ>0 en bolas de 0.40 Å en los puntos medios (gotcha de la serie)
    pares = [(i, j) for i in range(len(simb)) for j in t['nb'][i] if j > i]
    mid = np.array([(Xal[i] + Xal[j]) / 2 for i, j in pares])
    dist_m, _ = cKDTree(mid).query(Gal, distance_upper_bound=0.40)
    bond = float(np.maximum(drho, 0)[np.isfinite(dist_m)].sum() * dV)

    rng = np.random.default_rng(SEED)                          # MISMAS semillas para las 3
    U = [rng.random((n, 3)) for n in N_MAIN + N_ORB]
    sh = lambda a: a.reshape(ns)
    loB, pasoB = lo / BOHR, PASO / BOHR
    acc = sample_field(sh(np.maximum(drho, 0)), U[0], loB, pasoB)
    dep = sample_field(sh(np.maximum(-drho, 0)), U[1], loB, pasoB)
    spn = sample_field(sh(campos['pi']), U[2], loB, pasoB)
    oh = sample_field(sh(campos['homo']), U[3], loB, pasoB)
    ol = sample_field(sh(campos['lumo']), U[4], loB, pasoB)
    oe = sample_field(sh(np.maximum(dexc, 0)), U[5], loB, pasoB)
    nuc = Xal / BOHR
    Z = np.array([6 if s == 'C' else 1 for s in simb])

    # color de la nube acc (solo si la escena declara binColors): mundo FRÍO de la serie
    # (C₂ hielo/azul). σ en el plano = hielo pálido, cinturón π fuera del plano = azul.
    def frio(p):
        c = np.zeros((len(p), 3)); pi = np.abs(p[:, 2]) > 0.45      # bohr, como formación
        c[:] = [0.62, 0.82, 1.00]; c[pi] = [0.32, 0.55, 1.00]; return c
    pm = escribe_wap2(os.path.join(PRE, f'caroteno-gemelos-{nombre}.bin'), (acc, dep, spn), frio(acc), Z, nuc, bond)
    po = escribe_wap2(os.path.join(PRE, f'caroteno-gemelos-{nombre}-orb.bin'), (oh, ol, oe),
                      np.tile([0.40, 0.62, 1.0], (len(oh), 1)), Z, nuc, bond)
    # sidecar de PUNTAS: int32 Nacc Ndep Nspin + uint8 por punto (1 = cae en una punta)
    arbolB = cKDTree(nuc)
    for suf, ch in (('', (acc, dep, spn)), ('-orb', (oh, ol, oe))):
        with open(os.path.join(PRE, f'caroteno-gemelos-{nombre}{suf}-puntas.bin'), 'wb') as f:
            f.write(struct.pack('<3i', *[len(c) for c in ch]))
            for c in ch:
                f.write(en_punta[arbolB.query(c)[1]].astype(np.uint8).tobytes())
    info = {'molecula': NOMBRE[nombre], 'funcional_densidad': FUNC, 'marco': 'X=eje largo, Z=normal π, bohr',
            'malla': {'nodos': ns, 'paso_A': PASO}, 'posq': {'main': pm, 'orb': po},
            'canales_main': {'acc': 'Δρ>0', 'dep': 'Δρ<0', 'spin': 'ρ_π (MOs π ocupados)'},
            'canales_orb': {'acc': '|HOMO|²', 'dep': '|LUMO|²', 'spin': 'Δρ_exc>0 (transición brillante)'},
            'N': {'main': N_MAIN, 'orb': N_ORB}, 'mos_pi_ocupados': len(pi_occ),
            'fraccion_pi_HOMO_LUMO': [round(float(v), 3) for v in fv],
            'integrales': {k: round(v, 4) for k, v in integ.items()},
            'carga_de_enlace_dRho_bolas': round(bond, 3),
            'fraccion_en_puntas': {k: round(v, 4) for k, v in frac_punta.items()},
            'atomos_en_puntas': int(en_punta.sum()),
            'puntas_x_bohr': [round(float(nuc[p['C6'], 0]), 2) for p in t['puntas']],
            'extension_bohr': [round(float(v), 2) for v in np.abs(nuc).max(0)]}
    json.dump(info, open(os.path.join(WORK, f'nubes-{nombre}.json'), 'w'), indent=1, ensure_ascii=False)
    log(f'   OK caroteno-gemelos-{nombre}.bin (posq {pm:.0f}) + -orb.bin (posq {po:.0f}) + puntas')


# ── COLOR (CIE 1931 2° × D65, tablas oficiales CIE a 5 nm vía colour-science 0.4.7) ────────
CIE = np.array([
    (380,49.9755,0.001368,0.000039,0.006450), (385,52.3118,0.002236,0.000064,0.010550), (390,54.6482,0.004243,0.000120,0.020050),
    (395,68.7015,0.007650,0.000217,0.036210), (400,82.7549,0.014310,0.000396,0.067850), (405,87.1204,0.023190,0.000640,0.110200),
    (410,91.4860,0.043510,0.001210,0.207400), (415,92.4589,0.077630,0.002180,0.371300), (420,93.4318,0.134380,0.004000,0.645600),
    (425,90.0570,0.214770,0.007300,1.039050), (430,86.6823,0.283900,0.011600,1.385600), (435,95.7736,0.328500,0.016840,1.622960),
    (440,104.8650,0.348280,0.023000,1.747060), (445,110.9360,0.348060,0.029800,1.782600), (450,117.0080,0.336200,0.038000,1.772110),
    (455,117.4100,0.318700,0.048000,1.744100), (460,117.8120,0.290800,0.060000,1.669200), (465,116.3360,0.251100,0.073900,1.528100),
    (470,114.8610,0.195360,0.090980,1.287640), (475,115.3920,0.142100,0.112600,1.041900), (480,115.9230,0.095640,0.139020,0.812950),
    (485,112.3670,0.057950,0.169300,0.616200), (490,108.8110,0.032010,0.208020,0.465180), (495,109.0820,0.014700,0.258600,0.353300),
    (500,109.3540,0.004900,0.323000,0.272000), (505,108.5780,0.002400,0.407300,0.212300), (510,107.8020,0.009300,0.503000,0.158200),
    (515,106.2960,0.029100,0.608200,0.111700), (520,104.7900,0.063270,0.710000,0.078250), (525,106.2390,0.109600,0.793200,0.057250),
    (530,107.6890,0.165500,0.862000,0.042160), (535,106.0470,0.225750,0.914850,0.029840), (540,104.4050,0.290400,0.954000,0.020300),
    (545,104.2250,0.359700,0.980300,0.013400), (550,104.0460,0.433450,0.994950,0.008750), (555,102.0230,0.512050,1.000000,0.005750),
    (560,100.0000,0.594500,0.995000,0.003900), (565,98.1671,0.678400,0.978600,0.002750), (570,96.3342,0.762100,0.952000,0.002100),
    (575,96.0611,0.842500,0.915400,0.001800), (580,95.7880,0.916300,0.870000,0.001650), (585,92.2368,0.978600,0.816300,0.001400),
    (590,88.6856,1.026300,0.757000,0.001100), (595,89.3459,1.056700,0.694900,0.001000), (600,90.0062,1.062200,0.631000,0.000800),
    (605,89.8026,1.045600,0.566800,0.000600), (610,89.5991,1.002600,0.503000,0.000340), (615,88.6489,0.938400,0.441200,0.000240),
    (620,87.6987,0.854450,0.381000,0.000190), (625,85.4936,0.751400,0.321000,0.000100), (630,83.2886,0.642400,0.265000,0.000050),
    (635,83.4939,0.541900,0.217000,0.000030), (640,83.6992,0.447900,0.175000,0.000020), (645,81.8630,0.360800,0.138200,0.000010),
    (650,80.0268,0.283500,0.107000,0.000000), (655,80.1207,0.218700,0.081600,0.000000), (660,80.2146,0.164900,0.061000,0.000000),
    (665,81.2462,0.121200,0.044580,0.000000), (670,82.2778,0.087400,0.032000,0.000000), (675,80.2810,0.063600,0.023200,0.000000),
    (680,78.2842,0.046770,0.017000,0.000000), (685,74.0027,0.032900,0.011920,0.000000), (690,69.7213,0.022700,0.008210,0.000000),
    (695,70.6652,0.015840,0.005723,0.000000), (700,71.6091,0.011359,0.004102,0.000000), (705,72.9790,0.008111,0.002929,0.000000),
    (710,74.3490,0.005790,0.002091,0.000000), (715,67.9765,0.004109,0.001484,0.000000), (720,61.6040,0.002899,0.001047,0.000000),
    (725,65.7448,0.002049,0.000740,0.000000), (730,69.8856,0.001440,0.000520,0.000000), (735,72.4863,0.001000,0.000361,0.000000),
    (740,75.0870,0.000690,0.000249,0.000000), (745,69.3398,0.000476,0.000172,0.000000), (750,63.5927,0.000332,0.000120,0.000000),
    (755,55.0054,0.000235,0.000085,0.000000), (760,46.4182,0.000166,0.000060,0.000000), (765,56.6118,0.000117,0.000042,0.000000),
    (770,66.8054,0.000083,0.000030,0.000000), (775,65.0941,0.000059,0.000021,0.000000), (780,63.3828,0.000042,0.000015,0.000000),
])
M_XYZ_SRGB = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])


def srgb_de_espectro(A):
    """A(λ) en la rejilla CIE → color de la luz D65 TRANSMITIDA, en sRGB (gamma) y hex."""
    lam, D, xb, yb, zb = CIE.T
    T = 10.0 ** (-A)
    k = 1.0 / (D * yb).sum()
    XYZ = k * np.array([(D * T * xb).sum(), (D * T * yb).sum(), (D * T * zb).sum()])
    lin = M_XYZ_SRGB @ XYZ
    fuera = bool((lin < -1e-3).any() or (lin > 1 + 1e-3).any())
    lin = np.clip(lin, 0, 1)
    g = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * lin ** (1 / 2.4) - 0.055)
    rgb = [int(round(v * 255)) for v in g]
    return {'XYZ': [round(float(v), 4) for v in XYZ], 'srgb_lineal': [round(float(v), 4) for v in lin],
            'srgb': rgb, 'hex': '#%02x%02x%02x' % tuple(rgb), 'fuera_de_gama': fuera}


def espectro(E_eV, f, desplaza=0.0, fwhm=0.50, Amax=1.0):
    """Absorbancia en la rejilla CIE: suma de gaussianas EN ENERGÍA, una por estado, ∝ f.
    fwhm 0.50 eV = la envolvente medida del β-caroteno en hexano (~410–495 nm a media altura,
    triplete vibrónico 425/450/478 incluido): es un ANCHO DE BANDA prestado, no calculado.
    Se normaliza a Amax en el máximo del VISIBLE (380–780 nm)."""
    lam = CIE[:, 0]; Eg = EV_NM / lam; s = fwhm / 2.3548
    A = sum(fi * np.exp(-0.5 * ((Eg - (Ei + desplaza)) / s) ** 2) for Ei, fi in zip(E_eV, f))
    return A / A.max() * Amax if A.max() > 0 else A


# ESPECTRO MEDIDO del β-caroteno en hexano (PhotochemCAD #041, R.-C. A. Fuh 1995, Cary 3, escalado a
# ε=139,500 M⁻¹cm⁻¹ en 451 nm, Zechmeister 1943; bajado de omlc.org/spectra/PhotochemCAD/data/041-abs.txt
# el 2026-10-13). Remuestreado a 2 nm de 330 a 560 nm, normalizado a ε(451), negativos de ruido → 0;
# más allá de 560 nm es ruido de línea base (±0.01) y se toma 0. Es la FORMA de banda real (triplete
# vibrónico 425/451/478 incluido): el cálculo solo la MUEVE en energía (ΔE calculado entre moléculas).
MEDIDO_L0, MEDIDO_DL = 330.0, 2.0
BETA_HEXANO = np.array([
    0.1034, 0.1068, 0.0980, 0.0977, 0.0932, 0.0989, 0.0987, 0.1009, 0.1066, 0.1113, 0.1132, 0.1166,
    0.0995, 0.1103, 0.1135, 0.1106, 0.1197, 0.1203, 0.1404, 0.1338, 0.1548, 0.1696, 0.1815, 0.1897,
    0.2048, 0.2140, 0.2232, 0.2499, 0.2557, 0.2760, 0.3001, 0.3287, 0.3650, 0.3708, 0.4047, 0.4186,
    0.4463, 0.4566, 0.4776, 0.4897, 0.5247, 0.5498, 0.5772, 0.6194, 0.6573, 0.6981, 0.7202, 0.7409,
    0.7606, 0.7659, 0.7659, 0.7814, 0.7886, 0.8113, 0.8327, 0.8671, 0.9081, 0.9356, 0.9686, 0.9772,
    0.9943, 0.9851, 0.9717, 0.9392, 0.9087, 0.8682, 0.8331, 0.8049, 0.7897, 0.7771, 0.7774, 0.7828,
    0.7984, 0.8012, 0.8054, 0.7939, 0.7650, 0.7179, 0.6814, 0.6097, 0.5452, 0.4790, 0.4189, 0.3575,
    0.2903, 0.2340, 0.1879, 0.1480, 0.1209, 0.0952, 0.0786, 0.0574, 0.0511, 0.0355, 0.0314, 0.0243,
    0.0295, 0.0119, 0.0130, 0.0142, 0.0159, 0.0126, 0.0042, 0.0081, 0.0000, 0.0149, 0.0082, 0.0043,
    0.0065, 0.0091, 0.0099, 0.0000, 0.0016, 0.0004, 0.0032, 0.0000])
CONCENTRACIONES = (0.3, 1.0, 3.0, 10.0)      # absorbancia en el pico visible (A=1 → 10 % pasa)


def espectro_medido(dE=0.0, Amax=1.0):
    """La banda MEDIDA del β en hexano, corrida dE eV (dE<0 = hacia el rojo), en la rejilla CIE."""
    lm = MEDIDO_L0 + MEDIDO_DL * np.arange(len(BETA_HEXANO))
    Em = EV_NM / lm; o = np.argsort(Em)
    E = EV_NM / CIE[:, 0]
    A = np.interp(E - dE, Em[o], BETA_HEXANO[o], left=0.0, right=0.0)
    return A / A.max() * Amax


def matiz(rgb):
    import colorsys
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in rgb])
    return round(h * 360, 1)


def etapa_color():
    log(f'═══ COLOR + GATE ({FUNC}) ═══')
    R = {}
    for m in MOLS:
        j = json.load(open(os.path.join(WORK, f'td-{m}-{FUNC}.json')))
        R[m] = {'E': np.array([s['E_eV'] for s in j['estados']]), 'f': np.array([s['f'] for s in j['estados']]),
                'b': j['brillante']}
    lb = {m: R[m]['b']['lambda_nm'] for m in MOLS}
    orden_ok = lb['beta'] < lb['plano'] < lb['licopeno']
    Eb = {m: R[m]['b']['E_eV'] for m in MOLS}
    E_med = {m: EV_NM / v for m, v in MEDIDO_NM.items()}
    dE_calc = Eb['beta'] - Eb['licopeno']; dE_med = E_med['beta'] - E_med['licopeno']
    dl_calc = lb['licopeno'] - lb['beta']; dl_med = MEDIDO_NM['licopeno'] - MEDIDO_NM['beta']
    rel_calc = dl_calc / lb['beta']; rel_med = dl_med / MEDIDO_NM['beta']
    # calibración EN UN SOLO PUNTO: el β-caroteno a su λ medida; licopeno y plano = predicción
    delta = E_med['beta'] - Eb['beta']
    pred = {m: EV_NM / (Eb[m] + delta) for m in MOLS}
    colores = {}
    for m in MOLS:
        colores[m] = {
            'crudo_A1': srgb_de_espectro(espectro(R[m]['E'], R[m]['f'])),
            'calibrado_A1': srgb_de_espectro(espectro(R[m]['E'], R[m]['f'], desplaza=delta)),
            'calibrado_por_concentracion': {f'A{a}': srgb_de_espectro(espectro(R[m]['E'], R[m]['f'], delta, Amax=a))['hex']
                                            for a in (0.3, 1.0, 3.0)},
        }
    # FORMA MEDIDA + CORRIMIENTO CALCULADO (la principal, 2026-10-13): el β es su espectro medido
    # tal cual; licopeno y plano = ese mismo espectro movido ΔE_calc = E_m − E_β. Ninguna banda
    # inventada: la forma es la medida y el corrimiento es el del TD-DFT.
    for m in MOLS:
        dEm = Eb[m] - Eb['beta']
        colores[m]['forma_medida'] = {
            'dE_vs_beta_eV': round(float(dEm), 4),
            'lambda_max_nm': round(float(CIE[np.argmax(espectro_medido(dEm)), 0]), 1),
            'por_A': {f'A{a:g}': (lambda c: {**c, 'matiz_deg': matiz(c['srgb'])})(srgb_de_espectro(espectro_medido(dEm, a)))
                      for a in CONCENTRACIONES}}
    ref = {m: srgb_de_espectro(espectro([E_med[m]], [1.0])) for m in MEDIDO_NM}
    ref['beta_espectro_medido_A1'] = srgb_de_espectro(espectro_medido(0.0, 1.0))
    blanco = srgb_de_espectro(np.zeros(len(CIE)))
    out = {
        'metodo': f'TD-DFT (RPA) {FUNC}/def2-SVP // B3LYP-D3(BJ)/def2-SVP, vacío',
        'lambda_brillante_nm': lb, 'f_brillante': {m: R[m]['b']['f'] for m in MOLS},
        'estado_brillante': {m: R[m]['b']['n'] for m in MOLS},
        'medido_nm_hexano': MEDIDO_NM,
        'GATE_orden_beta_lt_plano_lt_licopeno': orden_ok,
        'corrimiento': {'calc_nm': round(dl_calc, 1), 'medido_nm': dl_med,
                        'calc_rel': round(rel_calc, 4), 'medido_rel': round(rel_med, 4),
                        'calc_eV': round(dE_calc, 4), 'medido_eV': round(dE_med, 4),
                        'razon_calc_sobre_medido_eV': round(dE_calc / dE_med, 3),
                        'plano_menos_beta_nm': round(lb['plano'] - lb['beta'], 1),
                        'fraccion_del_hueco_beta_licopeno_que_cierra_aplanar':
                            round((Eb['beta'] - Eb['plano']) / dE_calc, 3) if dE_calc else None},
        'calibracion_un_punto': {'desplazamiento_eV': round(delta, 4),
                                 'prediccion_nm': {m: round(v, 1) for m, v in pred.items()},
                                 'licopeno_predicho_vs_medido_nm': round(pred['licopeno'] - MEDIDO_NM['licopeno'], 1)},
        'color_D65': colores, 'color_D65_referencia_medida': ref, 'blanco_D65_sin_absorber': blanco,
        'notas': ['forma_medida (LA PRINCIPAL) = espectro MEDIDO del β en hexano (PhotochemCAD #041) movido el ΔE '
                  'calculado de cada molécula; por_A = absorbancia en el pico (0.3 diluido … 10 denso)',
                  'el color de una SOLUCIÓN depende de la concentración; el de la zanahoria/jitomate además lleva '
                  'agregados/cristales en los cromoplastos y la geometría de la reflexión difusa: NO modelados',
                  'crudo = espectro calculado tal cual (vertical, vacío): sale corrido al rojo',
                  'calibrado = TODAS las bandas corridas el mismo δ para que el β caiga en 450 nm; el licopeno y el plano son predicción',
                  'fwhm 0.50 eV y A=1 en el pico (10 % de transmitancia) son elecciones declaradas, no cálculo',
                  'sRGB con primarios y blanco D65: sin adaptación cromática; el blanco sale (255,255,255)'],
    }
    json.dump(out, open(os.path.join(PRE, 'caroteno-gemelos-color.json'), 'w'), indent=1, ensure_ascii=False)
    log(f"   λ brillante: β {lb['beta']} · plano {lb['plano']} · licopeno {lb['licopeno']} nm  "
        f"→ GATE orden {'✔ SALE' if orden_ok else '✗ NO SALE'}")
    log(f"   corrimiento β→licopeno: calc {dl_calc:.1f} nm ({100*rel_calc:.1f} %) vs medido {dl_med:.0f} nm ({100*rel_med:.1f} %)")
    for m in MOLS:
        fm = colores[m]['forma_medida']
        log(f"   color {m}: crudo {colores[m]['crudo_A1']['hex']} · calibrado {colores[m]['calibrado_A1']['hex']} · "
            f"forma medida (λmax {fm['lambda_max_nm']}) " +
            ' '.join(f"{k} {v['hex']} ({v['matiz_deg']}°)" for k, v in fm['por_A'].items()))
    log(f"   blanco D65 = {blanco['hex']} (debe ser #ffffff)")
    return 0 if orden_ok else 1


def lee_wap2(path):
    b = open(path, 'rb').read(); o = 0
    mg, NA, ND, NS, K, NN, NL, LP = struct.unpack_from('<4s7i', b, o); o += 32
    posq, _, _ = struct.unpack_from('<3f', b, o); o += 12 + 8 * K
    o += NA * 3; Z = np.frombuffer(b, '<i2', NN, o); o += NN * 2
    out = []
    for n in (NA, ND, NS, NN):
        a = np.frombuffer(b, '<i2', K * n * 3, o).reshape(K, n, 3)[0] / posq; o += K * n * 3 * 2
        out.append(a)
    return out, Z


def etapa_figura(destino):
    """Hoja de VERIFICACIÓN para el ojo (no es arte): las 3 moléculas con sus nubes (vista de
    frente XY y de canto XZ), HOMO/LUMO/Δρ_exc, y el espectro con su color D65."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    col = json.load(open(os.path.join(PRE, 'caroteno-gemelos-color.json')))
    fig, ax = plt.subplots(6, 2, figsize=(16, 22), facecolor='black',
                           gridspec_kw={'width_ratios': [3, 1]})
    for r, m in enumerate(MOLS):
        (acc, dep, spn, nuc), Z = lee_wap2(os.path.join(PRE, f'caroteno-gemelos-{m}.bin'))
        (oh, ol, oe, _), _ = lee_wap2(os.path.join(PRE, f'caroteno-gemelos-{m}-orb.bin'))
        for c, (i, j) in enumerate(((0, 1), (0, 2))):
            a = ax[2 * r, 0] if c == 0 else ax[2 * r, 1]
            a.set_facecolor('black')
            a.scatter(dep[::3, i], dep[::3, j], s=0.15, c='#3d7bff', alpha=0.35, lw=0)
            a.scatter(acc[::4, i], acc[::4, j], s=0.15, c='#ffc860', alpha=0.35, lw=0)
            a.scatter(spn[::3, i], spn[::3, j], s=0.15, c='#d070ff', alpha=0.35, lw=0)
            a.scatter(nuc[:, i], nuc[:, j], s=[8 if z == 6 else 2 for z in Z], c='#3affa0', lw=0)
            a.set_aspect('equal'); a.set_xticks([]); a.set_yticks([])
            if c == 0:
                lb = col['lambda_brillante_nm'][m]
                a.set_title(f"{NOMBRE[m]}  ·  λ={lb} nm  ·  oro Δρ>0, azul Δρ<0, morado ρπ  (XY)",
                            color='white', fontsize=10)
            else:
                a.set_title('de canto (XZ)', color='white', fontsize=9)
        a = ax[2 * r + 1, 0]; a.set_facecolor('black')
        a.scatter(oh[::2, 0], oh[::2, 1] + 6, s=0.15, c='#4fa3ff', alpha=0.4, lw=0)
        a.scatter(ol[::2, 0], ol[::2, 1], s=0.15, c='#ff7a4f', alpha=0.4, lw=0)
        a.scatter(oe[::2, 0], oe[::2, 1] - 6, s=0.15, c='#ffffff', alpha=0.4, lw=0)
        a.scatter(nuc[:, 0], nuc[:, 1] - 6, s=1, c='#3affa0', lw=0)
        a.set_aspect('equal'); a.set_xticks([]); a.set_yticks([])
        a.set_title('arriba |HOMO|²  ·  centro |LUMO|²  ·  abajo Δρ_exc>0 (adonde llega la carga con la luz)',
                    color='white', fontsize=9)
        a = ax[2 * r + 1, 1]; a.set_facecolor('black')
        j = json.load(open(os.path.join(WORK, f'td-{m}-{FUNC}.json')))
        E = [s_['E_eV'] for s_ in j['estados']]; f = [s_['f'] for s_ in j['estados']]
        lam = CIE[:, 0]
        for clave, ls in (('crudo_A1', '-'), ('calibrado_A1', '--')):
            d = col['color_D65'][m][clave]
            A = espectro(E, f, desplaza=(0 if clave == 'crudo_A1' else col['calibracion_un_punto']['desplazamiento_eV']))
            a.plot(lam, A, ls, color=d['hex'], lw=2, label=f"{clave.split('_')[0]} {d['hex']}")
        a.set_ylim(0, 1.1); a.tick_params(colors='white', labelsize=7)
        a.legend(fontsize=7, facecolor='black', labelcolor='white')
        a.set_title('absorbancia (nm) y color D65', color='white', fontsize=9)
    fig.tight_layout()
    fig.savefig(destino, dpi=110, facecolor='black')
    log(f'   figura: {destino}')


if __name__ == '__main__':
    etapa, *resto = sys.argv[1:] or ['?']
    if etapa == 'arranque':
        etapa_arranque()
    elif etapa == 'xtb':
        etapa_xtb(resto[0])
    elif etapa == 'geom':
        etapa_geom(resto[0])
    elif etapa == 'td':
        etapa_td(resto[0])
    elif etapa == 'nubes':
        etapa_nubes(resto[0])
    elif etapa == 'figura':
        etapa_figura(resto[0])
    elif etapa == 'color':
        sys.exit(etapa_color())
    else:
        sys.exit(__doc__)
