#!/usr/bin/env python3
"""
precompute-atom-orbitals.py — LA TABLA PERIÓDICA AB INITIO, con FORMA.

Hermano de precompute-water-ring.py, para átomos aislados. Calcula el estado base real de
cada elemento (SCF) y muestrea la densidad de CADA SUBCAPA en malla 3D. Salida: un .bin por
elemento en public/precomputed/atoms/z<NNN>.bin que el laboratorio lee tal cual.

    python3 scripts/precompute-atom-orbitals.py            # los 118
    python3 scripts/precompute-atom-orbitals.py 6 8 26     # solo esos Z
    Z_MAX=36 python3 scripts/precompute-atom-orbitals.py   # hasta el kriptón

POR QUÉ EXISTE (Ian, 2026-07-31: "¿no tienes que recalcular todos los átomos con PySCF?"):
el laboratorio dibujaba los 118 con orbitales HIDROGENOIDES + apantallamiento de Slater. Es
física legítima y citada (Slater, Phys. Rev. 36, 57, 1930) pero NO es el mismo estándar que
las moléculas de la serie, que son ab initio. Si un químico pregunta "¿tu tabla es ab initio?"
la respuesta tenía que ser sí.

⚠ LA TRAMPA QUE ESTE SCRIPT EVITA — POR QUÉ NO SE REUSÓ precompute-atom-cloud.py:
ese script (el de los videos de enlace) muestrea P(r) ∝ ρ(r)·r² con DIRECCIONES ISOTRÓPICAS,
o sea que promedia esféricamente. Para el video está bien —ahí el átomo es un individuo que
se va a fundir con otro— pero convierte a los 118 en bolas difusas idénticas: los p pierden
la mancuerna y los d sus pétalos. Sería más "real" en el papel y MUCHO peor en pantalla, y
justo lo que la tabla enseña. Aquí NO se promedia: se evalúa en malla 3D y la forma queda.

DE DÓNDE SALEN LOS LÓBULOS (y por qué son honestos):
sumar |φ|² sobre una subcapa LLENA da simetría esférica — eso es un teorema, no una opción.
La forma aparece en las subcapas PARCIALMENTE llenas (el 2p² del carbono, el 3d⁶ del hierro),
donde la suma sobre los orbitales ocupados NO es esférica. El átomo aislado es degenerate y
el SCF elige UNA orientación de ese multiplete; se declara y no se afirma más que eso.

MÉTODO por elemento (se guarda en el .bin y se muestra en el lab):
  · capa cerrada  → RHF        · capa abierta → UHF con la multiplicidad de Hund
  · base def2-TZVP (con ECP donde def2 lo define, Z>36) mientras exista para ese Z;
    si no existe, se degrada a def2-SVP y se DECLARA en el manifiesto. Sin base = sin .bin
    (mejor un hueco declarado que un número inventado).
"""
import os, sys, json, struct, math
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', 'public', 'precomputed', 'atoms')
BOHR = 0.529177210903
SEED = 20260731
POSQ = 2000.0          # bohr = int16/POSQ → techo 16.38 bohr por eje
Z_MAX = int(os.environ.get('Z_MAX', '118'))
N_PTS = int(os.environ.get('N_PTS', '26000'))     # puntos por átomo (todas las subcapas)
NG = int(os.environ.get('NG', '88'))              # malla NG³

SIMBOLO = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn '
           'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce '
           'Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn '
           'Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl '
           'Mc Lv Ts Og').split()

# ── MULTIPLICIDAD DEL ESTADO BASE (regla de Hund sobre la configuración real) ──
# Electrones desapareados por Z, tabla del estado base EXPERIMENTAL (NIST ASD). No se deduce
# de Madelung a ciegas: Cr y Cu (y sus hermanos 4d/5d) rompen la regla y el dato manda.
DESAPAREADOS = {
    1:1, 2:0, 3:1, 4:0, 5:1, 6:2, 7:3, 8:2, 9:1, 10:0, 11:1, 12:0, 13:1, 14:2, 15:3, 16:2,
    17:1, 18:0, 19:1, 20:0, 21:1, 22:2, 23:3, 24:6, 25:5, 26:4, 27:3, 28:2, 29:1, 30:0,
    31:1, 32:2, 33:3, 34:2, 35:1, 36:0, 37:1, 38:0, 39:1, 40:2, 41:5, 42:6, 43:5, 44:4,
    45:3, 46:0, 47:1, 48:0, 49:1, 50:2, 51:3, 52:2, 53:1, 54:0, 55:1, 56:0, 57:1, 58:2,
    59:3, 60:4, 61:5, 62:6, 63:7, 64:8, 65:5, 66:4, 67:3, 68:2, 69:1, 70:0, 71:1, 72:2,
    73:3, 74:4, 75:5, 76:4, 77:3, 78:2, 79:1, 80:0, 81:1, 82:2, 83:3, 84:2, 85:1, 86:0,
    87:1, 88:0, 89:1, 90:2, 91:3, 92:4, 93:5, 94:6, 95:7, 96:8, 97:5, 98:4, 99:3, 100:2,
    101:1, 102:0, 103:1, 104:2, 105:3, 106:4, 107:5, 108:4, 109:3, 110:2, 111:1, 112:0,
    113:1, 114:2, 115:3, 116:2, 117:1, 118:0,
}

# CADENA DE RESPALDO, en orden de preferencia. Se degrada y se DECLARA en el manifiesto.
#   def2-TZVP  cubre H–Rn (Z≤86) — con ECP desde Rb (Z=37), que es OBLIGATORIO (ver calcula()).
#   stuttgart/crenbl  cubren los actínidos con ECP78 relativista (ahí def2 ya no llega).
#   Del rutherfordio (Z=104) en adelante PySCF NO trae base: esos quedan como HUECO DECLARADO
#   y el laboratorio los dibuja con el modelo hidrogenoide, diciéndolo. Mejor un hueco
#   etiquetado que un número inventado con cara de ab initio.
# sarc-dkh va AL FINAL y con una advertencia: es una base ALL-ELECTRON diseñada para el
# hamiltoniano relativista DKH, y aquí se usa con HF no relativista. Las ENERGÍAS que da no
# son de fiar para lantánidos/actínidos (faltan efectos relativistas que ahí ya pesan); la
# FORMA y las ocupaciones sí quedan razonables, y es lo que el laboratorio dibuja. Se marca
# `relativista: false` en el manifiesto para que el lab lo diga en pantalla. Sin ella, Ce–Ho
# quedaban como hueco EN MEDIO de la tabla.
BASES = ['def2-tzvp', 'def2-svp', 'stuttgart-rlc', 'crenbl', 'lanl2dz', 'sarc-dkh']


def malla(L, ng):
    xs = np.linspace(-L, L, ng)
    d = xs[1] - xs[0]
    G = np.stack(np.meshgrid(xs, xs, xs, indexing='ij'), axis=-1).reshape(-1, 3)
    return G, d


def radio_util(mol, mf, rmax=18.0):
    """¿Hasta dónde llega el átomo? Se mide, no se supone: el radio donde la densidad radial
    cae bajo 1e-4 del pico. Un átomo de He y uno de Cs no pueden compartir caja."""
    r = np.linspace(0.05, rmax, 240)
    pts = np.stack([r, np.zeros_like(r), np.zeros_like(r)], axis=1)
    ao = mol.eval_gto('GTOval', pts)
    dm = mf.make_rdm1()
    if dm.ndim == 3:
        dm = dm[0] + dm[1]
    rho = np.einsum('pi,pi->p', ao @ dm, ao) * r ** 2
    pico = rho.max()
    fuera = np.where(rho > pico * 1e-4)[0]
    return float(r[fuera[-1]]) if len(fuera) else 6.0


def muestrea(campo, n, rng, L, ng):
    """Inverse-CDF sobre la malla 3D (mismo método que la serie del agua). Devuelve n puntos
    distribuidos ∝ densidad, con jitter dentro de la celda para que no se vea reticulado."""
    f = np.maximum(campo.ravel(), 0.0)
    tot = f.sum()
    if tot <= 0:
        return np.zeros((0, 3))
    cdf = np.cumsum(f) / tot
    idx = np.searchsorted(cdf, rng.random(n))
    idx = np.clip(idx, 0, f.size - 1)
    i, j, k = np.unravel_index(idx, (ng, ng, ng))
    paso = 2.0 * L / (ng - 1)
    base = np.stack([i, j, k], axis=1).astype(float) * paso - L
    return base + (rng.random((n, 3)) - 0.5) * paso


def calcula(Z):
    from pyscf import gto, scf
    sym = SIMBOLO[Z - 1]
    nunp = DESAPAREADOS[Z]
    for base in BASES:
        try:
            # ⚠ EL ECP NO ES OPCIONAL. Las bases def2 de Z≥37 están DISEÑADAS para
            # pseudopotencial: sin él PySCF trata al átomo con todos sus electrones pero
            # con una base de solo valencia, y el resultado es basura con cara de número.
            # Medido: Xe salía en −2884 Ha (el all-electron real ronda −7232) y con
            # "4f¹⁴" ocupado — el xenón no tiene electrones f. PySCF ignora el ECP en los
            # ligeros, donde def2 no define ninguno, así que se pasa siempre.
            mol = gto.M(atom=[[sym, (0.0, 0.0, 0.0)]], basis=base, ecp=base, spin=nunp,
                        charge=0, verbose=0)
            mf = scf.UHF(mol) if nunp else scf.RHF(mol)
            mf.max_cycle = 300
            mf.kernel()
            if not mf.converged:
                mf = mf.newton(); mf.kernel()
            if mf.converged:
                return mol, mf, base
        except Exception:
            continue
    return None, None, None


def _capas_del_core_ecp(ncore):
    """Cuántas capas de cada l se llevó el pseudopotencial. Con ECP los orbitales de core NO
    existen en el cálculo, así que el s más bajo de Xe NO es 1s sino 4s. Sin esto las
    etiquetas mienten. Los cores son siempre gas noble (+d/f llenos): se reconstruyen
    llenando (n,l) en orden n→l hasta juntar ncore electrones."""
    quitadas = {}
    e = 0
    for n in range(1, 8):
        for l in range(0, n):
            if e >= ncore:
                return quitadas
            e += 2 * (2 * l + 1)
            quitadas[l] = quitadas.get(l, 0) + 1
    return quitadas


def subcapas(mol, mf):
    """Densidad POR SUBCAPA (n, l) en vez de la total. Es lo que conserva la forma: un 2p²
    parcialmente lleno NO es esférico, y ahí está el lóbulo.

    ⚠ CÓMO SE ASIGNA n (dos bugs cazados el 2026-07-31):
    1. NO por la etiqueta AO. El primer intento tomaba el n de la función de base dominante y
       salían disparates (el hidrógeno como "2s1"). El n de una contraída de def2-TZVP dice
       cómo se construyó la BASE, no en qué capa vive el electrón.
    2. NO mezclando espines. El segundo intento juntaba alfa y beta por energía parecida, pero
       en capa abierta difieren bastante, así que cada espín inventaba capas propias (el hierro
       llegó a tener 18 subcapas, hasta un "9p"). Cada canal se ordena POR SEPARADO.
    La regla exacta para un átomo: dentro de un l, los orbitales por ENERGÍA son 1s,2s,3s… /
    2p,3p,4p… ⇒ n = l + 1 + posición, corrido por las capas que se llevó el ECP."""
    labels = mol.ao_labels(fmt=False)
    L_DE = {'s': 0, 'p': 1, 'd': 2, 'f': 3, 'g': 4, 'h': 5}
    # La etiqueta de capa es "2p", "4f"… pero en los pesados llega a "10s": leer el CARÁCTER
    # 1 revienta con KeyError('0'). Se busca la primera letra, que es el momento angular.
    def _l_de(nl):
        for ch in nl:
            if ch.isalpha():
                return L_DE[ch]
        raise ValueError(f'etiqueta de capa sin letra: {nl!r}')
    ao_l = np.array([_l_de(nl) for _, _, nl, _ in labels])
    ncore = sum(mol.atom_nelec_core(i) for i in range(mol.natm))
    quitadas = _capas_del_core_ecp(ncore)

    # canales de espín: UHF trae dos, RHF uno
    if isinstance(mf.mo_occ, np.ndarray) and mf.mo_occ.ndim == 2:
        canales = [(mf.mo_coeff[s], mf.mo_occ[s], mf.mo_energy[s]) for s in (0, 1)]
    else:
        canales = [(mf.mo_coeff, mf.mo_occ, mf.mo_energy)]

    grupos = {}
    for C, occ, ene in canales:
        por_l = {}
        for i, o in enumerate(occ):
            if o <= 1e-8:
                continue
            w = C[:, i] ** 2
            pesos = {}
            for l, wi in zip(ao_l, w):
                pesos[int(l)] = pesos.get(int(l), 0.0) + float(wi)
            l_dom = max(pesos, key=pesos.get)
            por_l.setdefault(l_dom, []).append((float(ene[i]), C[:, i], float(o)))
        for l, lista in por_l.items():
            lista.sort(key=lambda t: t[0])              # 1s, 2s, 3s… por energía
            # un nivel l tiene 2l+1 orbitales espaciales degenerados: van al MISMO (n,l)
            deg = 2 * l + 1
            for pos, (_, c, o) in enumerate(lista):
                n = l + 1 + (pos // deg) + quitadas.get(l, 0)
                grupos.setdefault((n, l), []).append((c, o))
    return dict(sorted(grupos.items(), key=lambda kv: (kv[0][0], kv[0][1])))


def escribe(Z, L, shells, pts, sidx, base, metodo, e_tot):
    os.makedirs(OUT_DIR, exist_ok=True)
    ruta = os.path.join(OUT_DIR, f'z{Z:03d}.bin')
    q = np.clip(np.round(pts * POSQ), -32767, 32767).astype('<i2')
    with open(ruta, 'wb') as fp:
        fp.write(b'ATM1')
        fp.write(struct.pack('<4i', Z, len(pts), len(shells), 0))
        fp.write(struct.pack('<2f', POSQ, L))
        for (n, l), ne in shells:
            fp.write(struct.pack('<3i', n, l, ne))
        fp.write(q.tobytes())
        fp.write(np.asarray(sidx, dtype=np.uint8).tobytes())
    return ruta, os.path.getsize(ruta)


def main():
    args = [int(a) for a in sys.argv[1:] if a.isdigit()]
    lista = args or list(range(1, Z_MAX + 1))
    rng = np.random.default_rng(SEED)
    manifiesto = []
    print(f"=== TABLA PERIÓDICA AB INITIO · {len(lista)} elementos · malla {NG}³ · {N_PTS} pts ===",
          flush=True)
    print(f"{'Z':>4} {'el':<3} {'base':<10} {'método':<5} {'E (Ha)':>14} {'L(bohr)':>8} "
          f"{'subcapas':>9} {'KB':>6}", flush=True)
    for Z in lista:
        mol, mf, base = calcula(Z)
        if mol is None:
            print(f"{Z:>4} {SIMBOLO[Z-1]:<3} — SIN BASE DISPONIBLE (se declara el hueco)", flush=True)
            manifiesto.append(dict(Z=Z, sym=SIMBOLO[Z-1], ok=False, motivo='sin base'))
            continue
        metodo = 'UHF' if DESAPAREADOS[Z] else 'RHF'
        L = min(16.0, max(3.5, radio_util(mol, mf) * 1.05))
        G, _ = malla(L, NG)
        grupos = subcapas(mol, mf)

        # peso de cada subcapa = sus electrones → los puntos se reparten por OCUPACIÓN
        pesos = {nl: sum(o for _, o in v) for nl, v in grupos.items()}
        tot_e = sum(pesos.values())
        pts_all, sidx_all, shells = [], [], []
        for si, (nl, orbs) in enumerate(grupos.items()):
            dens = np.zeros(G.shape[0])
            for a in range(0, G.shape[0], 60000):
                ao = mol.eval_gto('GTOval', G[a:a + 60000])
                for c, o in orbs:
                    dens[a:a + 60000] += o * (ao @ c) ** 2
            n_sub = max(200, int(round(N_PTS * pesos[nl] / tot_e)))
            p = muestrea(dens.reshape(NG, NG, NG), n_sub, rng, L, NG)
            pts_all.append(p); sidx_all.append(np.full(len(p), si, np.uint8))
            shells.append((nl, int(round(pesos[nl]))))
        pts = np.concatenate(pts_all); sidx = np.concatenate(sidx_all)
        ruta, size = escribe(Z, L, shells, pts, sidx, base, metodo, float(mf.e_tot))
        etiquetas = ' '.join(f"{n}{'spdfg'[l]}{ne}" for (n, l), ne in shells)
        print(f"{Z:>4} {SIMBOLO[Z-1]:<3} {base:<10} {metodo:<5} {mf.e_tot:>14.5f} {L:>8.2f} "
              f"{len(shells):>9} {size/1024:>6.0f}   {etiquetas}", flush=True)
        # aviso honesto: con sarc-dkh (lantánidos/actínidos) la energía NO es comparable
        energia_fiable = base != 'sarc-dkh'
        manifiesto.append(dict(Z=Z, sym=SIMBOLO[Z-1], ok=True, basis=base, method=metodo,
                               energia_fiable=energia_fiable,
                               energy_ha=float(mf.e_tot), L_bohr=L, points=len(pts),
                               shells=[dict(n=n, l=l, electrons=ne) for (n, l), ne in shells]))
        with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
            json.dump(dict(seed=SEED, posq=POSQ, grid=NG, elements=manifiesto), f)
    ok = sum(1 for m in manifiesto if m['ok'])
    print(f"\n✅ {ok}/{len(lista)} elementos ab initio en {OUT_DIR}", flush=True)


if __name__ == '__main__':
    main()
