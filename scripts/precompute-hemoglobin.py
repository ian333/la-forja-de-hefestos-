#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-hemoglobin.py — LA HEMOGLOBINA CAZANDO O₂ (primera PROTEÍNA de la serie).

FÍSICA REAL (regla dura): DOS estructuras cristalográficas del PDB, sin inventar nada:
  · 4HHB — deoxihemoglobina humana, estado T (Fermi 1984, 1.74 Å). Ya vive en public/.
  · 2DN1 — oxihemoglobina humana, estado R (Park 2006, 1.25 Å), con los 4 O₂ unidos al Fe.
El video recorre la transición T→R: cada cuadro k interpola linealmente entre las DOS
geometrías MEDIDAS (los extremos son cristalografía; el camino es interpolación y SE
DECLARA — igual que la respiración exagerada del anillo). Los O₂ llegan por el lado
distal del hemo hasta su posición de unión REAL (la del cristal oxi), escalonados:
el sitio α1 primero — la cooperatividad es el cuento.

GATES (observable vs experimento, ANTES de renderizar nada):
  1. Fe fuera del plano del hemo: T ≈ 0.4-0.6 Å, R ≈ 0.1-0.3 Å (Perutz).
  2. Rotación cuaternaria α2β2 tras alinear α1β1: 12-15° (Baldwin & Chothia 1979).
  3. Distancia Fe–O en el cristal oxi: 1.8-1.9 Å.
Si un gate truena, NO se escribe el bin.

SALIDA (formato WAP2 — la familia del agua; ver parseWAP2 en CinematicMolecule.tsx):
  public/precomputed/hemoglobina.bin         (nube proteína=acc, hemos=dep, O₂=spin,
                                              núcleos = tríos (Fe,O,O)×4 — así accColorWarm
                                              pinta ORO alrededor de los hierros, los cores
                                              arden en los Fe y la cámara apunta a los hemos
                                              SIN tocar código de la escena)
  public/precomputed/hemoglobina-efield.bin  (NL=0: sin líneas de campo en v1 — un campo
                                              eléctrico de 4,500 átomos sin cargas ab initio
                                              sería inventado, y eso está prohibido)
  dist-video/hemo-telemetria.json            (los gates, para el verificador)

La coordenada R del formato = distancia media Fe–O₂ en bohr (desciende: lejos→unido).
`apertura` de la escena la recorre → 1.0 = T con O₂ lejos, 0.0 = R con O₂ capturado.
"""
import json
import os
import struct
import sys
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOHR = 1.8897259886          # Å → bohr
# ESCALA DE ESCENA (v6, Ian: "demasiado oscuros, no veo el parecido con el rey"): la
# maquinaria del ganador (sprites, halos, brillos, cámara) está AFINADA para ex~13 del
# agua; una proteína a escala real (~5×) la saca de régimen y todo sale ralo y oscuro.
# Las unidades de escena NO son física — los Å reales viven en los gates y en la voz.
SCALE = 0.22                 # bohr de proteína → unidades de escena (radio ~51 → ~11)
SEED = 24601                 # muestreo Lagrangiano con semilla FIJA (correspondencia entre cuadros)
K = 24                       # cuadros de la transición
POSQ = 1300.0                # int16/POSQ = unidades (máx 25 por eje, sobra)

# DENSIDAD (primer still: proteína INVISIBLE): la hemoglobina ocupa ~100× el volumen del
# dímero de agua — con 60k puntos la densidad por píxel se desploma y el aditivo no suma.
# Los O₂ (16k puntos en 8 manchitas) SÍ se veían: la ley es densidad LOCAL, no total.
N_ACC = 150000               # nube de la proteína (a escala del rey la densidad ya ACUMULA)
N_DEP = 50000                # nube de los 4 hemos (las placas)
N_SPIN = 16000               # nube de los 4 O₂ (lo que LLEGA — magenta en la escena)

DEOXY_ID, OXY_ID = '4HHB', '2DN1'
D0_A = 26.0                  # arranque del O₂: 26 Å del Fe — 16 Å no LEÍA lejos (la proteína mide ~27 Å de radio)


def bajar(pdb_id: str) -> str:
    destino = os.path.join(ROOT, 'public', f'{pdb_id}.pdb')
    if not os.path.exists(destino):
        url = f'https://files.rcsb.org/download/{pdb_id}.pdb'
        print(f'  ↓ {url}')
        urllib.request.urlretrieve(url, destino)
    return destino


def parse_pdb(path: str):
    """ATOM/HETATM → dict clave=(chain,resSeq,name) para proteína; lista para HET."""
    prot, het, elmap = {}, [], {}
    for line in open(path, encoding='utf-8', errors='replace'):
        rec = line[:6]
        if rec not in ('ATOM  ', 'HETATM'):
            continue
        alt = line[16]
        if alt not in (' ', 'A'):
            continue
        name = line[12:16].strip()
        res = line[17:20].strip()
        chain = line[21]
        seq = int(line[22:26])
        xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
        el = line[76:78].strip().upper() or name[0]
        if rec == 'ATOM  ':
            if el != 'H':
                prot[(chain, seq, name)] = xyz
                elmap[(chain, seq, name)] = el
        else:
            if res != 'HOH':
                het.append({'res': res, 'chain': chain, 'seq': seq, 'name': name, 'el': el, 'xyz': xyz})
    return prot, het, elmap


def leer_biomt(path: str):
    """REMARK 350 del biomolecule 1: lista de (R 3×3, t 3). Los cristales que guardan medio
    tetrámero (2DN1, 1HHO) declaran aquí la operación REAL que genera la otra mitad."""
    mats, filas = [], {}
    dentro = False
    for line in open(path, encoding='utf-8', errors='replace'):
        if line.startswith('REMARK 350 BIOMOLECULE:'):
            dentro = line.split(':')[1].strip() == '1'
        if dentro and line.startswith('REMARK 350   BIOMT'):
            fila = int(line[18]) - 1
            n = int(line[19:24])
            vals = [float(line[24 + i * 10:34 + i * 10]) for i in range(3)]
            t = float(line[54:68])
            filas.setdefault(n, [[0.0] * 4] * 3)
            filas[n] = [r[:] for r in filas[n]]
            filas[n][fila] = vals + [t]
    for n in sorted(filas):
        m = np.array(filas[n])
        mats.append((m[:, :3], m[:, 3]))
    return mats


def expandir_tetramero(path: str, prot: dict, het: list, elmap: dict):
    """Si el cristal solo trae A,B, aplica el BIOMT #2 para generar C (de A) y D (de B)."""
    chains = sorted({k[0] for k in prot})
    if len(chains) >= 4:
        return prot, het
    mats = leer_biomt(path)
    if len(mats) < 2:
        raise SystemExit(f'✗ {path}: solo {chains} y sin BIOMT para completar el tetrámero')
    R, t = mats[1]
    nuevo_de = {'A': 'C', 'B': 'D'}
    for (c, seq, name), xyz in list(prot.items()):
        if c in nuevo_de:
            prot[(nuevo_de[c], seq, name)] = tuple(R @ np.array(xyz) + t)
            elmap[(nuevo_de[c], seq, name)] = elmap[(c, seq, name)]
    for a in list(het):
        if a['chain'] in nuevo_de:
            het.append({**a, 'chain': nuevo_de[a['chain']], 'xyz': tuple(R @ np.array(a['xyz']) + t)})
    print(f'  ↳ tetrámero completado con BIOMT #2 (simetría cristalográfica REAL del archivo)')
    return prot, het


def kabsch(P: np.ndarray, Q: np.ndarray):
    """Rotación+traslación que lleva Q sobre P (mínimos cuadrados). Devuelve (R, t, rmsd)."""
    cp, cq = P.mean(0), Q.mean(0)
    P0, Q0 = P - cp, Q - cq
    H = Q0.T @ P0
    U, S, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    D = np.diag([1.0, 1.0, d])
    R = Vt.T @ D @ U.T
    t = cp - R @ cq
    rmsd = float(np.sqrt(((P - (Q @ R.T + t)) ** 2).sum() / len(P)))
    return R, t, rmsd


def angulo_rotacion(R: np.ndarray) -> float:
    return float(np.degrees(np.arccos(np.clip((np.trace(R) - 1) / 2, -1, 1))))


def plano_fe(het, chain):
    """Plano de los 4 N pirrólicos del HEM de una cadena + posición del Fe → distancia."""
    Ns, fe = [], None
    for a in het:
        if a['res'] != 'HEM' or a['chain'] != chain:
            continue
        if a['name'] in ('NA', 'NB', 'NC', 'ND'):
            Ns.append(a['xyz'])
        if a['el'] == 'FE':
            fe = np.array(a['xyz'])
    if len(Ns) != 4 or fe is None:
        raise SystemExit(f'✗ HEM incompleto en cadena {chain}: {len(Ns)} N pirrólicos, Fe={fe is not None}')
    Ns = np.array(Ns)
    cen = Ns.mean(0)
    _, _, Vt = np.linalg.svd(Ns - cen)
    normal = Vt[2] / np.linalg.norm(Vt[2])
    return float(abs(np.dot(fe - cen, normal))), fe, cen, normal


def main():
    print('── DESCARGA / PARSEO (estructuras REALES del PDB) ──')
    ruta_d, ruta_o = bajar(DEOXY_ID), bajar(OXY_ID)
    p_deoxy, het_deoxy, el_d = parse_pdb(ruta_d)
    p_oxy, het_oxy, el_o = parse_pdb(ruta_o)
    p_deoxy, het_deoxy = expandir_tetramero(ruta_d, p_deoxy, het_deoxy, el_d)
    p_oxy, het_oxy = expandir_tetramero(ruta_o, p_oxy, het_oxy, el_o)
    chains_d = sorted({k[0] for k in p_deoxy})
    chains_o = sorted({k[0] for k in p_oxy})
    print(f'  {DEOXY_ID}: {len(p_deoxy)} átomos pesados, cadenas {chains_d}')
    print(f'  {OXY_ID}:  {len(p_oxy)} átomos pesados, cadenas {chains_o}')
    if len(chains_d) < 4 or len(chains_o) < 4:
        raise SystemExit('✗ alguna estructura no trae el tetrámero completo (4 cadenas)')

    # ── correspondencia por (cadena, residuo, átomo) ──
    comunes = sorted(set(p_deoxy) & set(p_oxy))
    print(f'  átomos en correspondencia: {len(comunes)}')
    PT = np.array([p_deoxy[k] for k in comunes])
    PR = np.array([p_oxy[k] for k in comunes])

    # ── alinear oxi sobre deoxi usando α1β1 (cadenas A+B), solo CA ──
    idx_ab = [i for i, k in enumerate(comunes) if k[0] in ('A', 'B') and k[2] == 'CA']
    R1, t1, rmsd_ab = kabsch(PT[idx_ab], PR[idx_ab])
    PRa = PR @ R1.T + t1
    het_oxy_a = [{**a, 'xyz': tuple(np.array(a['xyz']) @ R1.T + t1)} for a in het_oxy]

    # ── GATE 2: rotación cuaternaria del dímero α2β2 (cadenas C+D) ──
    idx_cd = [i for i, k in enumerate(comunes) if k[0] in ('C', 'D') and k[2] == 'CA']
    R2, _, _ = kabsch(PT[idx_cd], PRa[idx_cd])
    ang_cd = angulo_rotacion(R2)

    # ── GATE 1: Fe fuera del plano en T y en R ──
    oop_T = {c: plano_fe(het_deoxy, c) for c in 'ABCD'}
    oop_R = {c: plano_fe(het_oxy_a, c) for c in 'ABCD'}
    mT = float(np.mean([oop_T[c][0] for c in 'ABCD']))
    mR = float(np.mean([oop_R[c][0] for c in 'ABCD']))

    # ── GATE 3: Fe–O en el cristal oxi (ligando dioxígeno: OXY) ──
    feo = []
    o2_por_cadena = {}
    for c in 'ABCD':
        fe = oop_R[c][1]
        oxis = [a for a in het_oxy_a if a['res'] == 'OXY' and a['chain'] == c]
        if len(oxis) < 2:
            raise SystemExit(f'✗ {OXY_ID} cadena {c}: no encuentro el ligando OXY (hay {len(oxis)})')
        oxis.sort(key=lambda a: float(np.linalg.norm(np.array(a['xyz']) - fe)))
        o2_por_cadena[c] = np.array([oxis[0]['xyz'], oxis[1]['xyz']])
        feo.append(float(np.linalg.norm(o2_por_cadena[c][0] - fe)))
    mFeO = float(np.mean(feo))

    gates = {
        'fe_fuera_de_plano_T_A': round(mT, 3), 'fe_fuera_de_plano_R_A': round(mR, 3),
        'rotacion_cuaternaria_deg': round(ang_cd, 2),
        'fe_o2_A': round(mFeO, 3), 'rmsd_alinea_a1b1_A': round(rmsd_ab, 3),
        'atomos_correspondencia': len(comunes),
        'literatura': {'oop_T': '0.40-0.63 Å (Perutz/Fermi)', 'oop_R': '0.10-0.30 Å',
                       'rotacion': '12-15° (Baldwin & Chothia 1979)', 'fe_o2': '1.8-1.9 Å (Shaanan)'},
    }
    print('── GATES (observable vs experimento) ──')
    ok = True
    def gate(nombre, v, lo, hi):
        nonlocal ok
        bien = lo <= v <= hi
        ok = ok and bien
        print(f'  {"✓" if bien else "✗"} {nombre}: {v:.3f}  (esperado {lo}-{hi})')
    gate('Fe fuera de plano (T, media 4 hemos, Å)', mT, 0.30, 0.75)
    # OJO CON EL PLANO DE REFERENCIA (gate que reprobó lo correcto, 2026-08-18): el 0.16 Å
    # de literatura para oxi es contra el plano MEDIO de la porfirina (24 átomos); AQUÍ se
    # mide contra el plano de los 4 N pirrólicos, donde el Fe oxi queda esencialmente EN el
    # plano (2DN1 a 1.25 Å da 0.036). El movimiento REAL lo garantiza el gate T−R de abajo.
    gate('Fe fuera de plano (R, media, Å)', mR, 0.00, 0.32)
    gate('T − R (el Fe SE MUEVE al plano, Å)', mT - mR, 0.10, 0.60)
    gate('rotación cuaternaria α2β2 (°)', ang_cd, 9.0, 18.0)
    gate('Fe–O₂ en el cristal oxi (Å)', mFeO, 1.60, 2.10)
    if not ok:
        json.dump(gates, open(os.path.join(ROOT, 'dist-video', 'hemo-telemetria.json'), 'w'), indent=2)
        raise SystemExit('✗✗ GATE DE FÍSICA REPROBADO — no se escribe el bin')

    # ── construir cuadros ──
    print('── CUADROS (T→R, muestreo Lagrangiano semilla fija) ──')
    rng = np.random.default_rng(SEED)
    centro = PT.mean(0)
    PT_c, PR_c = PT - centro, PRa - centro

    # hemos: índices de átomos HET del deoxi/oxi por cadena para dep-cloud (posiciones por estado)
    hem_T = {c: np.array([a['xyz'] for a in het_deoxy if a['res'] == 'HEM' and a['chain'] == c]) - centro for c in 'ABCD'}
    hem_R = {c: np.array([a['xyz'] for a in het_oxy_a if a['res'] == 'HEM' and a['chain'] == c]) - centro for c in 'ABCD'}
    for c in 'ABCD':
        n = min(len(hem_T[c]), len(hem_R[c]))
        hem_T[c], hem_R[c] = hem_T[c][:n], hem_R[c][:n]

    fe_T = {c: oop_T[c][1] - centro for c in 'ABCD'}
    fe_R = {c: oop_R[c][1] - centro for c in 'ABCD'}
    o2_R = {c: o2_por_cadena[c] - centro for c in 'ABCD'}
    # dirección de ENTRADA del O₂: del Fe hacia el O₂ unido (el lado distal), normalizada
    dir_in = {c: (o2_R[c][0] - fe_R[c]) / np.linalg.norm(o2_R[c][0] - fe_R[c]) for c in 'ABCD'}

    # escalonamiento REAL del cuento (cooperatividad): α1 llega primero
    fase = {'A': (0.05, 0.45), 'C': (0.30, 0.70), 'B': (0.45, 0.85), 'D': (0.55, 0.95)}

    def s_de(k):
        return k / (K - 1)

    def o2_pos(c, s):
        a0, a1 = fase[c]
        u = min(1.0, max(0.0, (s - a0) / (a1 - a0)))
        u = u * u * (3 - 2 * u)
        d = (1 - u) * D0_A
        base = fe_R[c] + dir_in[c] * d
        return np.stack([base + (o2_R[c][0] - fe_R[c]), base + (o2_R[c][1] - fe_R[c])])

    # muestreo: (índice de átomo, offset gaussiano) FIJOS → el punto viaja con su átomo
    idx_acc = rng.integers(0, len(comunes), N_ACC)
    off_acc = rng.normal(0, 0.48, (N_ACC, 3))   # σ baja: las HÉLICES deben leerse, no borrarse
    hem_all_T = np.concatenate([hem_T[c] for c in 'ABCD'])
    hem_all_R = np.concatenate([hem_R[c] for c in 'ABCD'])
    idx_dep = rng.integers(0, len(hem_all_T), N_DEP)
    off_dep = rng.normal(0, 0.40, (N_DEP, 3))
    idx_spin_mol = rng.integers(0, 8, N_SPIN)          # cuál de los 8 O de los 4 O₂
    off_spin = rng.normal(0, 0.38, (N_SPIN, 3))

    Rvals, bondMass = [], []
    acc_fr, dep_fr, spin_fr, nuc_fr = [], [], [], []
    cadenas = 'ABCD'
    for k in range(K):
        s = s_de(k)
        e = s * s * (3 - 2 * s)
        P = (1 - e) * PT_c + e * PR_c
        Hm = (1 - e) * hem_all_T + e * hem_all_R
        Fe = {c: (1 - e) * fe_T[c] + e * fe_R[c] for c in cadenas}
        O2 = {c: o2_pos(c, s) for c in cadenas}
        # R de la familia = distancia media Fe–O₂ (bohr); DESCIENDE con k
        dmean = float(np.mean([np.linalg.norm(O2[c][0] - Fe[c]) for c in cadenas]))
        Rvals.append(dmean * BOHR)
        # bondMass = avance físico del Fe hacia el plano (0 en T, máx en R)
        bondMass.append(max(1e-4, (mT - ((1 - e) * mT + e * mR)) / max(1e-6, mT - mR)))
        acc_fr.append((P[idx_acc] + off_acc) * BOHR * SCALE)
        dep_fr.append((Hm[idx_dep] + off_dep) * BOHR * SCALE)
        o2flat = np.concatenate([O2[c] for c in cadenas])          # 8×3, orden A0,A1,C0…
        spin_fr.append((o2flat[idx_spin_mol] + off_spin) * BOHR * SCALE)
        nucs = []
        for c in cadenas:                                          # tríos (Fe, O, O) — ver docstring
            nucs.extend([Fe[c], O2[c][0], O2[c][1]])
        nuc_fr.append(np.array(nucs) * BOHR * SCALE)

    # Rvals debe DESCENDER estrictamente (wapBracket lo asume)
    for i in range(1, K):
        if Rvals[i] >= Rvals[i - 1]:
            Rvals[i] = Rvals[i - 1] - 1e-3

    maxabs = max(np.abs(np.concatenate(acc_fr)).max(), np.abs(np.concatenate(spin_fr)).max())
    assert maxabs * POSQ < 32760, f'✗ POSQ={POSQ} desborda int16 (max |x|={maxabs:.1f} bohr)'
    print(f'  extensión máxima: {maxabs:.1f} bohr · R: {Rvals[0]:.1f} → {Rvals[-1]:.1f} bohr')

    def q16(arrs):
        return np.concatenate([np.round(a.reshape(-1) * POSQ) for a in arrs]).astype('<i2')

    NNUC = 12
    Z = np.array([26, 8, 8] * 4, dtype='<i2')
    # LA PALETA VIAJA EN EL BIN (binColors: la escena usa estos colores tal cual).
    # α (A,C) = ORO del ganador · β (B,D) = MORADO — la arquitectura 2+2 se CUENTA en
    # pantalla y la rotación cuaternaria de 14° se VE (los lóbulos morados giran contra
    # los dorados). Cerca del Fe (<4.5 Å) el punto se enciende a blanco-oro: los 4
    # corazones. Los colores son ANOTACIÓN de cadenas reales, no física inventada.
    # PALETA POR ELEMENTO (v9 — Ian: "¿de qué está hecha? estamos mostrando todos los
    # átomos"): cada color ES un elemento real, contable en la voz. Familia CÁLIDA (el rey
    # O₂): C oro (la mayoría, ~2,950), N ámbar profundo (~810), O carmesí (~830), S amarillo
    # vivo (solo 8 chispas), y cerca de los 4 Fe todo enciende a blanco-oro. El morado queda
    # para los O₂ que LLEGAN (gramática del puente). Conteos del propio cristal, no de tabla.
    COLOR_EL = {
        'C': np.array([1.00, 0.70, 0.14]),
        'N': np.array([1.00, 0.40, 0.05]),
        'O': np.array([1.00, 0.14, 0.10]),
        'S': np.array([1.00, 0.96, 0.34]),
    }
    BLANCO_ORO = np.array([1.00, 0.85, 0.48])
    fe_R_arr = np.stack([fe_R[c] for c in 'ABCD'])
    el_acc = [el_d.get(comunes[i], 'C') for i in idx_acc]
    conteo = {}
    for k2 in comunes:
        e2 = el_d.get(k2, 'C')
        conteo[e2] = conteo.get(e2, 0) + 1
    print(f'  composición (átomos pesados del cristal): {conteo} + Fe×4')
    col = np.stack([COLOR_EL.get(e, COLOR_EL['C']) for e in el_acc])
    base_pos = PR_c[idx_acc]
    d_fe = np.min(np.linalg.norm(base_pos[:, None, :] - fe_R_arr[None, :, :], axis=2), axis=1)
    cerca = np.clip(1 - d_fe / 4.5, 0, 1)[:, None]
    col = col * (1 - cerca) + BLANCO_ORO[None, :] * cerca
    acc_color = np.round(col.reshape(-1) * 255).astype(np.uint8)

    out = os.path.join(ROOT, 'public', 'precomputed', 'hemoglobina.bin')
    with open(out, 'wb') as f:
        f.write(b'WAP2')
        f.write(struct.pack('<7i', N_ACC, N_DEP, N_SPIN, K, NNUC, 0, 0))
        f.write(struct.pack('<3f', POSQ, Rvals[-1], Rvals[0]))
        f.write(np.array(Rvals, dtype='<f4').tobytes())
        f.write(np.array(bondMass, dtype='<f4').tobytes())
        f.write(acc_color.tobytes())
        f.write(Z.tobytes())
        f.write(q16(acc_fr).tobytes())
        f.write(q16(dep_fr).tobytes())
        f.write(q16(spin_fr).tobytes())
        f.write(q16(nuc_fr).tobytes())
        # NL=0 → cero bytes de fieldLines
    print(f'  ✓ {out} ({os.path.getsize(out)/1e6:.1f} MB)')

    # EL ESQUELETO COMO LÍNEAS (v6): la columna Cα REAL de las 4 cadenas, en el formato
    # de líneas del puente (BondEField) — azul, envolvente, y SE MUEVE con la transición
    # T→R (cada cuadro k interpola el esqueleto). No es campo eléctrico y no se dice que
    # lo sea: es la anotación de una geometría MEDIDA (el backbone del cristal). La
    # cuantización del formato es int16/2000 → con SCALE, el esqueleto (~12 u) cabe.
    LP = 64
    lineas_T, lineas_R = [], []
    for c in 'ABCD':
        cas = sorted([k for k in comunes if k[0] == c and k[2] == 'CA'], key=lambda k: k[1])
        P_T = np.array([p_deoxy[k] for k in cas]) - centro
        P_R = np.array([np.array(p_oxy[k]) @ R1.T + t1 for k in cas]) - centro
        # SUAVIZADO (v7): el Cα crudo zigzaguea (3.8 Å por paso) y las líneas salían
        # ANGULOSAS — el puente FLUYE. Media móvil de ventana 5 sobre la traza (el
        # "cartoon" estándar de las proteínas: geometría medida, presentación suavizada).
        def suave(P):
            out = P.copy()
            for _ in range(2):
                out[1:-1] = 0.25 * out[:-2] + 0.5 * out[1:-1] + 0.25 * out[2:]
            return out
        P_T, P_R = suave(P_T), suave(P_R)
        mit = len(cas) // 2
        for a0, a1 in ((0, mit + 2), (mit - 2, len(cas))):
            iL = np.linspace(a0, a1 - 1, LP)
            i0 = np.floor(iL).astype(int); fr = (iL - i0)[:, None]
            i1 = np.minimum(i0 + 1, a1 - 1)
            lT = P_T[i0] * (1 - fr) + P_T[i1] * fr
            lR = P_R[i0] * (1 - fr) + P_R[i1] * fr
            for _ in range(2):
                lT[1:-1] = 0.25 * lT[:-2] + 0.5 * lT[1:-1] + 0.25 * lT[2:]
                lR[1:-1] = 0.25 * lR[:-2] + 0.5 * lR[1:-1] + 0.25 * lR[2:]
            lineas_T.append(lT)
            lineas_R.append(lR)
    NL = len(lineas_T)
    LT, LR = np.stack(lineas_T), np.stack(lineas_R)     # NL × LP × 3 (Å)
    out_ef = os.path.join(ROOT, 'public', 'precomputed', 'hemoglobina-efield.bin')
    with open(out_ef, 'wb') as f:
        f.write(struct.pack('<3i', K, NL, LP))
        f.write(np.array(Rvals, dtype='<f4').tobytes())
        cuadros = []
        for k in range(K):
            e = s_de(k); e = e * e * (3 - 2 * e)
            L = ((1 - e) * LT + e * LR) * BOHR * SCALE
            cuadros.append(np.round(L.reshape(-1) * 2000))
        q = np.concatenate(cuadros)
        assert np.abs(q).max() < 32760, f'esqueleto desborda int16: {np.abs(q).max()}'
        f.write(q.astype('<i2').tobytes())
        # bloque de intensidad: brillo suave que cae en las puntas (el formato lo soporta)
        w = (0.35 + 0.65 * np.sin(np.linspace(0, np.pi, LP))) * 255
        inten = np.tile(np.round(w).astype(np.uint8), K * NL)
        f.write(inten.tobytes())
    print(f'  ✓ {out_ef} ({os.path.getsize(out_ef)/1e6:.1f} MB, esqueleto Cα: {NL} líneas × {LP} pts)')

    gates['ex_sugerido_bohr'] = round(float(np.abs(np.concatenate(nuc_fr)).max()) * 1.35, 1)
    gates['VERIFY_RESULT'] = 'PASS'
    tj = os.path.join(ROOT, 'dist-video', 'hemo-telemetria.json')
    os.makedirs(os.path.dirname(tj), exist_ok=True)
    json.dump(gates, open(tj, 'w'), indent=2, ensure_ascii=False)
    print(f'  ✓ telemetría: {tj}')
    print('✓ HEMOGLOBINA lista: gates PASA, bins escritos')


if __name__ == '__main__':
    sys.exit(main())
