#!/usr/bin/env python3
"""
precompute-water-ring.py — EL ANILLO CÍCLICO DE N AGUAS, ab initio. N es un DATO
(env `NWAT`), no código: 3 = el trímero ("El anillo", ya entregado), 4 = el tetrámero,
5/6 = los que siguen. Hermano de precompute-water-approach.py (2 aguas), MISMO formato
WAP2 → el renderer (O2Cloud/Nucleus/BondEField) lo lee sin cambios (NNUC = 3N).

    NWAT=4 python3 scripts/precompute-water-ring.py          # tetrámero
    NWAT=3 python3 scripts/precompute-water-ring.py --quick  # el trímero de siempre

EL FENÓMENO QUE 2 AGUAS NO PUEDEN MOSTRAR — **COOPERATIVIDAD**:
los N puentes juntos son MÁS fuertes que la suma de los pares por separado. Es un
efecto de MUCHOS CUERPOS real y medido: al donar un protón, el agua se vuelve mejor
aceptora para la siguiente → el anillo se refuerza a sí mismo. Ese es el GATE:

    E_enlace(N-mero) = E(N-mero) − N·E(monómero)
    Σ pares          = Σ_{i<j} [ E(dímero_ij) − 2·E(monómero) ]     ← TODOS los pares
    E_muchos_cuerpos = E_enlace − Σ pares        ← debe ser NEGATIVO (estabiliza extra)

⚠ EL PAR DIAGONAL (bug cazado al generalizar, 2026-07-31): la versión de 3 aguas restaba
solo los pares VECINOS (i, i+1). En el trímero da igual — con 3 nodos todo par ES vecino —
pero desde N=4 hay pares diagonales (0-2, 1-3) y omitirlos INFLA la cooperatividad, porque
su interacción (real, aunque débil y repulsiva) se cuela en el término de muchos cuerpos.
Aquí se suman TODOS los i<j, como dice la fórmula de arriba. Para N=3 el resultado es
idéntico al publicado, así que el trímero entregado sigue siendo válido.

LA PARIDAD ES LA HISTORIA (y EMERGE, no se impone): los H libres alternan arriba/abajo con
`(-1)^i`. Con N IMPAR el ciclo no cierra — dos vecinos quedan del mismo lado y una agua se
voltea: eso es la FRUSTRACIÓN del trímero, su firma en video. Con N PAR alterna perfecto
(el tetrámero es S₄, plano y con los 4 puentes equivalentes) y la cooperatividad sube.

GEOMETRÍA (declarada, ver [[feedback_kazmer_no_inventar]] — lo literal y lo construido):
  • LITERAL (experimental): monómero O-H 0.9578 Å, ángulo HOH 104.478°.
  • LITERAL (VRT): O···O ≈ 2.85 Å (trímero), ≈ 2.79 Å (tetrámero) en el equilibrio.
  • CONSTRUIDO (declarado): SEMILLA de anillo regular con los donadores doblados — los N O
    en polígono regular, cada agua dona un H hacia el O siguiente y deja el H libre fuera
    del plano según (-1)^i. Es SOLO el punto de partida: la geometría de equilibrio la
    ENCUENTRA el optimizador (RHF/cc-pVDZ + geomeTRIC), no se impone. Los GATES validan la
    FÍSICA (energía de enlace y cooperatividad), que es lo que el video cuenta.
"""
import os, sys, struct
import numpy as np

QUICK = '--quick' in sys.argv
BOHR = 0.529177210903
HART2KCAL = 627.5094740631
BASIS = 'cc-pVDZ'
SEED = 20260727
# POSQ = escala de cuantización a int16: bohr = valor/POSQ, y el techo es 32767/POSQ.
# Con 5000 el techo era 6.5534 bohr POR EJE y la nube se RECORTABA ahí: medido en el anillo
# abierto, 9.56 % de las partículas aplastadas contra x=±6.5534 y 4.93 % contra y — un CUBO
# de caras planas, y justo en los cuadros del gancho (`ringWide`/`ringFaceOn` miran de frente
# a esa cara). Con 2000 el techo sube a 16.38 bohr y el paso sigue siendo 0.0005 bohr.
# El renderer LEE este número del encabezado (siempre estuvo escrito ahí), así que los .bin
# viejos con 5000 se siguen viendo igual.
POSQ = 2000.0

# ── monómero LITERAL (experimental) ──
D_OH_A = 0.9578          # Å
ANG_HOH = 104.478        # grados

# ── N: EL ÚNICO parámetro que cambia entre piezas de esta familia ──
NW = int(os.environ.get('NWAT', '3'))
if NW < 3:
    raise SystemExit('NWAT >= 3 (con 2 aguas usa precompute-water-approach.py — es el dímero)')
NOMBRE = {3: 'trimer', 4: 'tetramer', 5: 'pentamer', 6: 'hexamer'}.get(NW, f'{NW}mer')
ES_PAR = (NW % 2 == 0)

# ── anillo: O···O de equilibrio, SEMILLA del optimizador (LITERAL, espectroscopía VRT) ──
# El anillo se APRIETA al crecer N (más cooperatividad = puente más corto): trímero 2.85,
# tetrámero 2.79, pentámero 2.76, hexámero-anillo 2.75 Å. Son semillas: la geometría final
# la encuentra geomeTRIC. Para N no tabulado se extrapola al límite del hielo (2.74 Å).
R_EQ_A = {3: 2.85, 4: 2.79, 5: 2.76, 6: 2.75}.get(NW, 2.74)
R_MAX_A = 5.60           # lejos: las N aguas casi libres
R_MIN_A = R_EQ_A - 0.09  # anillo cerrado (ligeramente comprimido)

if QUICK:
    K = 6;  N_ACC, N_DEP, N_SPIN = 6000, 3000, 3000;   NXY, NZ = 64, 44
else:
    K = 26; N_ACC, N_DEP, N_SPIN = 54000, 20000, 20000; NXY, NZ = 112, 76
# Las nubes escalan con el NÚMERO DE ÁTOMOS: si N crece y el conteo no, la nube se RALEA
# (el mismo polvo repartido en un anillo más grande) y se pierde el "dorado" denso de O₂.
_ESC_N = NW / 3.0
N_ACC, N_DEP, N_SPIN = (int(round(n * _ESC_N)) for n in (N_ACC, N_DEP, N_SPIN))

Z = np.array([8, 1, 1] * NW)                     # N aguas: (O,H,H) × N
NNUC = 3 * NW
WAT = [[3 * i, 3 * i + 1, 3 * i + 2] for i in range(NW)]   # índices de cada agua
VEC = [(i, (i + 1) % NW) for i in range(NW)]               # pares VECINOS (los puentes)
PARES = [(a, b) for a in range(NW) for b in range(a + 1, NW)]   # TODOS los pares (muchos cuerpos)

Rvals = R_MAX_A + (R_MIN_A - R_MAX_A) * (np.arange(K) / (K - 1))   # descendente (como O2/wpair)
R_MIN = R_MIN_A / BOHR; R_MAX = R_MAX_A / BOHR

# caja (bohr): SALE DE LA GEOMETRÍA, no de un número a mano — el circunradio de un polígono
# regular de N lados con lado R es R/(2·sin(π/N)), y la nube se extiende ~4.5 bohr más.
# (Para N=3 y R_MAX=5.6 Å esto da 6.11+4.5 = 10.6 bohr = EXACTO el valor que estaba escrito
#  a mano, así que el trímero no cambia ni un pixel.)
_RC_MAX = (R_MAX_A / (2.0 * np.sin(np.pi / NW))) / BOHR
LXY = round(_RC_MAX + 4.5, 1)
LZ_ = 8.4              # el pucker fuera del plano no crece con N: el anillo se aplana
NXY = int(round(NXY * LXY / 10.6 / 8)) * 8      # dx CONSTANTE al crecer la caja (múltiplo de 8)
dx = (2 * LXY) / NXY; dz = (2 * LZ_) / NZ
xs = -LXY + (np.arange(NXY) + 0.5) * dx
zs = -LZ_ + (np.arange(NZ) + 0.5) * dz
GX, GY, GZ = np.meshgrid(xs, xs, zs, indexing='ij')
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
dV = dx * dx * dz

rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3)); U_dep = rng.random((N_DEP, 3)); U_spin = rng.random((N_SPIN, 3))

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'precomputed', f'water-{NOMBRE}.bin')
OUT_EF = os.path.join(HERE, '..', 'public', 'precomputed', f'water-{NOMBRE}-efield.bin')


def _guess(R_A, tilt_deg=22.0):
    """Semilla del anillo: los H donadores DOBLADOS fuera del plano y los H libres alternando
    con (-1)^i. (Un anillo con donadores LINEALES es geométricamente imposible en el trímero:
    los H donadores vecinos quedan a 1.56-1.64 Å = choque duro. Medido, ver GATE fallido
    del 2026-07-27. Por eso el mínimo real del trímero es UUD/C1 y con puentes DOBLADOS.)

    LA FRUSTRACIÓN NO SE IMPONE, SALE DE LA PARIDAD: con (-1)^i y N impar el ciclo no cierra
    (el último y el primero quedan del mismo lado) → UUD, una agua volteada = el trímero. Con
    N par alterna perfecto → S₄ en el tetrámero. Un solo renglón describe ambos casos."""
    Rc = R_A / (2.0 * np.sin(np.pi / NW))          # circunradio del polígono regular de lado R_A
    ang = np.deg2rad(ANG_HOH); tilt = np.deg2rad(tilt_deg)
    UUD = [(-1.0) ** i for i in range(NW)]         # impar ⇒ frustrado; par ⇒ alternancia perfecta
    g = np.zeros((NNUC, 3))
    for i in range(NW):
        th = 2.0 * np.pi * i / NW; th_n = 2.0 * np.pi * ((i + 1) % NW) / NW
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


_OPT_CACHE = os.path.join(HERE, '..', 'public', 'precomputed', f'water-{NOMBRE}-geom.json')

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
    print(f"  optimizando el {NOMBRE} ({NW} aguas, RHF/cc-pVDZ, geomeTRIC)…", flush=True)
    mol_eq = optimize(scf.RHF(mol), maxsteps=80)
    xyz = mol_eq.atom_coords() * BOHR                       # → Å
    xyz -= xyz.mean(axis=0)
    OO = [np.linalg.norm(xyz[3 * a] - xyz[3 * b]) for a, b in VEC]
    print(f"  ✓ equilibrio: O-O = {'/'.join(f'{x:.3f}' for x in OO)} Å (medio {np.mean(OO):.3f})", flush=True)
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
    Ocen = np.array([xyz[3 * i] for i in range(NW)])
    C = Ocen.mean(axis=0)
    R0 = np.mean([np.linalg.norm(Ocen[a] - Ocen[b]) for a, b in VEC])
    s = R_A / R0
    g = xyz.copy()
    for i in range(NW):
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


# NOTA: aquí vivían esp3d/E3d, que calculaban E = −∇V por DIFERENCIAS FINITAS del potencial
# (h=0.03 bohr, 6 evaluaciones de ESP por punto). Se borraron a propósito: metían hasta 0.77 %
# de error en E (medido contra el analítico) y costaban 1.7× más. El campo ahora sale de
# campo_lineas.CampoMEP, que deriva las integrales ANALÍTICAMENTE. No las revivas.


# ══════════════════ CAMPO ELÉCTRICO — motor scripts/campo_lineas.py ══════════════════
# La versión vieja de este bloque (siembra propia + RK4 de paso fijo + media móvil) tenía
# TRES fallas medidas el 2026-07-27, ver la autopsia en campo_lineas.py:
#   · amputaba toda línea en una esfera de |r|=6.6 bohr (el radio MÁXIMO de todo punto del
#     .bin era 6.60 exacto: no era un campo, era un peinado);
#   · sembraba 210 líneas por cada H y CERO en los O, violando la regla que el propio
#     comentario citaba ("líneas ∝ magnitud de la carga") — y el O es Z=+8;
#   · borraba la curvatura con un boxcar de k=9 sobre líneas de 40 puntos (el 22%).
# Ahora: E analítico exacto, Cash–Karp adaptativo, siembra por FLUJO sobre la superficie
# molecular ρ=0.002, sin suavizado y sin cortes por radio. Gates: scripts/campo-gate.py.
sys.path.insert(0, HERE)
from campo_lineas import (CampoMEP, superficie_molecular, sembrar_por_flujo,      # noqa: E402
                          superficie_en_rayos, trazar_bidireccional, intensidad_u8,
                          E_PUENTE, E_TERMICO, MOTIVO)

N_DIR_SUP = 1200          # direcciones de rayo por núcleo (la malla de la superficie)
# CUÁNTAS LÍNEAS es decisión de LEGIBILIDAD, no de física: en todas ellas cada línea carga
# el mismo Φ₀, solo cambia cuánto vale ese flujo. Elegido a ojo por Ian (2026-07-28) sobre la
# comparación 1100/550/275/138: con 1100 el campo se lee como PELO y se pierden los arcos que
# van de una molécula a otra, que es justo lo que el video tiene que enseñar.
NL_CAMPO = int(round(550 * NW / 3.0))   # ESCALA CON N: 550 lo eligió Ian a ojo sobre el
                          # trímero; mantener el número fijo en un anillo más grande baja la
                          # densidad de líneas en pantalla (mismo Φ₀ total repartido en más área).
                          # líneas; cada una carga el MISMO flujo Φ₀ (275 se leía VACÍO
                          # en el video: la comparación 2D las muestra todas de golpe, pero con
                          # la cámara cerrada y las moléculas separadas caen poquísimas en cuadro)
LP_CAMPO = 80             # puntos por línea (antes 40: la línea se veía a cuentas)
# ρ DE LA SUPERFICIE DE SIEMBRA — no es la convención, es un criterio FÍSICO (Ian, 2026-07-28:
# "las lineas que desaparecen en el aire se ven despeinadas"). Una línea se va y no vuelve solo
# si hay CARGA NETA (Gauss). Si Σ deja carga afuera, la molécula VISTA DESDE Σ parece cargada y
# esa fracción de líneas se despeina. Medido sobre el trímero:
#     ρ_c=0.002 (Bader) → deja +0.238 e afuera → 50 % de las líneas se van y no vuelven
#     ρ_c=0.0005        → +0.066 e            → 22 %
#     ρ_c=0.0002        → +0.030 e            → 12 %   ← se usa esta (99.9 % de la carga adentro)
# La convención de Bader (0.001-0.002) define el VOLUMEN molecular; aquí no queremos el
# volumen, queremos una superficie que encierre la carga para que el dibujo CIERRE.
RHO_SIEMBRA = 0.0002
R_FIN_RAYO = 14.0         # los rayos deben llegar más lejos: esta superficie es más grande
# NO se recorta la línea por |E| (`e_dibujo`). Recortar era lo que la dejaba terminando en
# el aire: el pedazo débil se borraba de golpe. Ahora la línea va COMPLETA hasta la escala
# TÉRMICA (kT/bohr a 300 K, donde el campo ya pierde contra el ruido) y el BRILLO la apaga —
# igual que en scripts/campo-escalera.py, que es el que sí se ve bien.
TRAZA = dict(tol=1e-8, r_core=0.25, r_caja=16.0, s_max=34.0, e_min=E_TERMICO,
             max_pasos=1800, max_muestras=1100)


def elegir_rayos(mol_ref, dm_ref):
    """UNA sola vez, en el anillo CERRADO: qué rayos de la superficie molecular se quedan.
    Se reusan en todos los cuadros (correspondencia lagrangiana → cero parpadeo)."""
    c = CampoMEP(mol_ref, dm_ref)
    sup = superficie_molecular(c, n_dir=N_DIR_SUP, rho_c=RHO_SIEMBRA, r_fin=R_FIN_RAYO)
    idx, Phi0, info = sembrar_por_flujo(c, sup, NL_CAMPO)
    ia, id_ = sup['ray']
    print(f"  siembra por flujo: {len(idx)} líneas · Φ₀ = {Phi0:.3e} · duplicadas {info['duplicados']}"
          f" · ∮E·n̂dA = {info['flujo_neto']:+.3f}", flush=True)
    return ia[idx], id_[idx]


def campo_frame(mol, dm, ia, id_):
    """Las líneas de UN cuadro. Devuelve (NL, LP, 3) en bohr + diagnóstico."""
    c = CampoMEP(mol, dm)
    S, hay, _ = superficie_en_rayos(c, ia, id_, N_DIR_SUP, rho_c=RHO_SIEMBRA, r_fin=R_FIN_RAYO)
    L, largo, viva, nE, mf_, mb_ = trazar_bidireccional(c, S, LP=LP_CAMPO, **TRAZA)
    rr = np.linalg.norm(L[viva].reshape(-1, 3), axis=1) if viva.any() else np.zeros(1)
    return L, intensidad_u8(nE), dict(viva=int(viva.sum()), sin_rayo=int((~hay).sum()),
                   largo=float(np.median(largo[viva])) if viva.any() else 0.0,
                   r95=float(np.percentile(rr, 95)), rmax=float(rr.max()),
                   caja=float((mf_ == 3).mean() * 100))


def _rayos_de_referencia(gto, scf, R_ref):
    """El cuadro de REFERENCIA para la siembra es el anillo CERRADO (el que cuenta la
    historia). Ahí se decide qué rayos llevan el flujo; los demás cuadros reusan esos."""
    gbr = geom_at(R_ref)
    mr = gto.M(atom=[[int(Z[i]), tuple(gbr[i])] for i in range(NNUC)], basis=BASIS, unit='Bohr', verbose=0)
    fr = scf.RHF(mr); fr.max_cycle = 200; fr.kernel()
    return elegir_rayos(mr, fr.make_rdm1())


def build():
    from pyscf import gto, scf
    global Rvals, R_MIN
    LP = LP_CAMPO
    # el barrido TERMINA en el equilibrio que encontró el optimizador (no en un número elegido)
    geom_at(R_EQ_A)                                    # fuerza optimización/carga de _GEQ
    Oc = np.array([_GEQ[3 * i] for i in range(NW)])
    R0 = float(np.mean([np.linalg.norm(Oc[a] - Oc[b]) for a, b in VEC]))
    Rmin_eff = R0 * 0.975                              # apenas comprimido (como wpair)
    Rvals = R_MAX_A + (Rmin_eff - R_MAX_A) * (np.arange(K) / (K - 1))
    R_MIN = Rmin_eff / BOHR
    print(f"  barrido: {R_MAX_A:.2f} Å → {Rmin_eff:.2f} Å (equilibrio {R0:.3f} Å)", flush=True)
    accPos = np.zeros((K, N_ACC, 3)); depPos = np.zeros((K, N_DEP, 3)); spinPos = np.zeros((K, N_SPIN, 3))
    bondMass = np.zeros(K); nucPos = np.zeros((K, NNUC, 3))
    Ebind = np.zeros(K); E3body = np.zeros(K)
    ia_r, id_r = _rayos_de_referencia(gto, scf, float(Rvals[-1]))
    NL_EF = len(ia_r)
    efield = np.zeros((K, NL_EF, LP, 3)); eint = np.zeros((K, NL_EF, LP), np.uint8)

    print(f"=== ANILLO DE {NW} AGUAS ({NNUC} átomos, {NOMBRE}) · {K} radios · {BASIS} · "
          f"malla {NXY}×{NXY}×{NZ} · caja ±{LXY} bohr ===", flush=True)
    print(f"    paridad: {'PAR → alternancia perfecta' if ES_PAR else 'IMPAR → frustrado (una volteada)'}"
          f" · {len(PARES)} pares ({NW} vecinos + {len(PARES)-NW} diagonales)", flush=True)
    print("k   O-O(Å)  E(Ha)         Ebind(kcal)  muchos-cuerpos  %coop   ∫Δρ>0", flush=True)

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

        # dímeros — TODOS los pares i<j, no solo los vecinos (ver ⚠ del encabezado: desde N=4
        # los diagonales existen y omitirlos infla la cooperatividad).
        e_dim = {}
        for (a, b) in PARES:
            md = gto.M(atom=[atoms[i] for i in WAT[a] + WAT[b]], basis=BASIS, unit='Bohr', verbose=0)
            mfd = scf.RHF(md); mfd.kernel(); e_dim[(a, b)] = mfd.e_tot

        e_bind = (mf.e_tot - sum(e_m)) * HART2KCAL
        e_pairs = sum((e_dim[(a, b)] - e_m[a] - e_m[b]) for (a, b) in PARES) * HART2KCAL
        e_3b = e_bind - e_pairs                       # < 0 = las N juntas se agarran MÁS
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
        efield[k], eint[k], dg = campo_frame(mol, dm, ia_r, id_r)
        print(f"{k:2d}  {R_A:5.2f}  {mf.e_tot:12.5f}  {e_bind:8.2f}     {e_3b:8.2f}      {coop:5.1f}%  {bondMass[k]:.4f}"
              f"   campo: {dg['viva']}/{NL_EF} vivas, largo {dg['largo']:.1f}, r95 {dg['r95']:.1f} bohr", flush=True)

    # color: MISMA paleta del agua v2/wpair (oro cálido + morado en los O). NO inventar color nuevo.
    kEq = int(np.argmin(np.abs(Rvals - R_EQ_A)))
    P = accPos[kEq]
    dO = np.min(np.stack([np.linalg.norm(P - nucPos[kEq, 3 * i], axis=1) for i in range(NW)]), axis=0)
    pw = np.clip(1.0 - dO / 1.4, 0, 1)
    gold = np.array([1.0, 0.72, 0.30]); purple = np.array([0.82, 0.28, 1.0])
    col = gold[None, :] * (1 - pw[:, None]) + purple[None, :] * pw[:, None]
    accColor = np.clip(col * 255, 0, 255).astype(np.uint8)
    return accPos, depPos, spinPos, bondMass, accColor, nucPos, efield, eint, NL_EF, LP, Ebind, E3body


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


def write_efield(efield, NL_EF, LP, eint=None):
    """Formato BondEField + un BLOQUE NUEVO AL FINAL: uint8 |E| por punto (escala log).
    Va al final a propósito: el parser de JS lee la geometría con longitudes explícitas, así
    que un .bin con intensidad lo lee igual un renderer viejo (solo ignora la cola)."""
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL_EF, LP))
        fp.write((Rvals / BOHR).astype('<f4').tobytes())
        fp.write(np.clip(np.round(efield * 2000), -32767, 32767).astype('<i2').tobytes())
        if eint is not None:
            fp.write(np.ascontiguousarray(eint, dtype=np.uint8).tobytes())
    print(f"OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB (campo MEP, {NL_EF}×{LP})", flush=True)


def validate(bondMass, Ebind, E3body):
    print("\n────────── GATES ──────────", flush=True)
    ok = True
    # 1) el anillo LIGA. Umbral POR AGUA (-2.7 kcal/mol c/u), no un número fijo: con N=3 vale
    #    -8.1 (el umbral de siempre) y escala solo al crecer el anillo.
    umbral = -2.7 * NW
    print(f"1) E_enlace: {Ebind[0]:+.2f} (lejos) → {Ebind[-1]:+.2f} kcal/mol (anillo cerrado)"
          f" = {Ebind[-1]/NW:+.2f} por agua")
    g1 = Ebind[-1] < umbral
    print("   GATE_ENLACE_OK" if g1 else f"   GATE_ENLACE_FAIL (esperado < {umbral:.1f} kcal/mol)"); ok &= g1
    # 2) COOPERATIVIDAD: el término de muchos cuerpos es NEGATIVO y significativo
    coop = E3body[-1] / Ebind[-1] * 100.0
    print(f"2) muchos-cuerpos: {E3body[-1]:+.2f} kcal/mol = {coop:.1f}% del enlace total")
    g2 = (E3body[-1] < 0) and (5.0 < coop < 45.0)
    print(f"   GATE_COOPERATIVIDAD_OK — las {NW} juntas se agarran MÁS que la suma de pares"
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
    import time
    LP = LP_CAMPO
    geom_at(R_EQ_A)
    Oc = np.array([_GEQ[3 * i] for i in range(NW)])
    R0 = float(np.mean([np.linalg.norm(Oc[a] - Oc[b]) for a, b in VEC]))
    Rmin_eff = R0 * 0.975
    Rv = R_MAX_A + (Rmin_eff - R_MAX_A) * (np.arange(K) / (K - 1))
    ia_r, id_r = _rayos_de_referencia(gto, scf, float(Rv[-1]))
    NL_EF = len(ia_r)
    ef = np.zeros((K, NL_EF, LP, 3)); eint = np.zeros((K, NL_EF, LP), np.uint8)
    print(f"=== SOLO CAMPO · {K} radios · {NL_EF} líneas × {LP} pts · SIN recorte, brillo=|E| ===", flush=True)
    for k in range(K):
        t0 = time.time()
        R_A = float(Rv[k]); gb = geom_at(R_A)
        atoms = [[int(Z[i]), tuple(gb[i])] for i in range(NNUC)]
        mol = gto.M(atom=atoms, basis=BASIS, unit='Bohr', verbose=0)
        mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
        ef[k], eint[k], dg = campo_frame(mol, mf.make_rdm1(), ia_r, id_r)
        print(f"  {k+1}/{K}  O-O {R_A:.2f} Å · {dg['viva']}/{NL_EF} vivas · largo mediano "
              f"{dg['largo']:.2f} · r95 {dg['r95']:.1f} rmax {dg['rmax']:.1f} bohr · "
              f"caja {dg['caja']:.0f}% · {time.time()-t0:.0f} s", flush=True)
    global Rvals
    Rvals = Rv
    write_efield(ef, NL_EF, LP, eint)


def ceros_del_campo():
    """LOS PUNTOS DONDE EL CAMPO VALE CERO — uno por puente, calculados cuadro a cuadro.

    Ian, 2026-07-28: "sé que los campos se cancelan, MUÉSTRAMELO ENTONCES". Aquí está: entre
    cada oxígeno y el hidrógeno que le donan hay un punto donde E = 0 EXACTO (medido: |E| ~ 1e-12,
    cero a precisión de máquina). No es un artefacto ni una convención de dibujo: es donde el
    jalón del H vecino queda cancelado por el propio núcleo del oxígeno, y es la razón de que
    las líneas de campo "desaparezcan en el aire" — no desaparecen, LLEGAN AHÍ y se acaban.
    Una carga de prueba puesta en ese punto no se mueve.

    En el equilibrio cae al 53 % del camino O···H (1.92 bohr del O, 1.80 del H). El tercer
    puente lo tiene al 84 % y fuera del eje: es la frustración del número impar — la molécula
    volteada — apareciendo también en los ceros del campo.

      NWAT=4 python3 scripts/precompute-water-ring.py --ceros
    """
    from pyscf import gto, scf
    from scipy.optimize import minimize
    import json as _json
    geom_at(R_EQ_A)
    Oc = np.array([_GEQ[3 * i] for i in range(NW)])
    R0 = float(np.mean([np.linalg.norm(Oc[a] - Oc[b]) for a, b in VEC]))
    Rv = R_MAX_A + (R0 * 0.975 - R_MAX_A) * (np.arange(K) / (K - 1))
    out = []
    print(f"=== CEROS DEL CAMPO · {K} cuadros ===", flush=True)
    for k in range(K):
        gb = geom_at(float(Rv[k]))
        mol = gto.M(atom=[[int(Z[i]), tuple(gb[i])] for i in range(NNUC)], basis=BASIS, unit='Bohr', verbose=0)
        mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
        c = CampoMEP(mol, mf.make_rdm1()); N = c.R
        Hs = [N[i] for i in range(NNUC) if i % 3]
        ceros = []
        for m in range(NW):
            o = N[3 * m]
            d = [np.linalg.norm(h - o) for h in Hs]
            hdon = Hs[int(np.argmin([x if x > 1.9 else 99 for x in d]))]   # el H de OTRA agua
            u = (hdon - o) / np.linalg.norm(hdon - o)
            best = None
            for r0 in (1.6, 1.9, 2.2, 2.6, 3.0):
                r = minimize(lambda q: float(np.linalg.norm(c(q[None])[0])), o + r0 * u,
                             method='Nelder-Mead', options=dict(xatol=1e-7, fatol=1e-14, maxiter=3000))
                if best is None or r.fun < best.fun: best = r
            if best.fun < 1e-6:
                ceros.append([float(x) for x in best.x])
        out.append(dict(k=k, R=float(Rv[k]), ceros=ceros))
        print(f"  {k+1}/{K}  O-O {Rv[k]:.2f} A  ->  {len(ceros)} ceros  |E|min {best.fun:.1e}", flush=True)
    f = os.path.join(HERE, '..', 'public', 'precomputed', f'water-{NOMBRE}-ceros.json')
    _json.dump(dict(K=K, Rvals=[float(x / BOHR) for x in Rv], cuadros=out), open(f, 'w'))
    print(f"OK  {f}", flush=True)


if __name__ == '__main__':
    if '--ceros' in sys.argv:
        ceros_del_campo(); sys.exit(0)
    if '--solo-campo' in sys.argv:
        solo_campo(); sys.exit(0)
    a, d, s, bm, col, nuc, ef, ei, nl, lp, Eb, E3 = build()
    write_bin(a, d, s, bm, col, nuc)
    write_efield(ef, nl, lp, ei)
    validate(bm, Eb, E3)
