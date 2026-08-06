#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-cadena.py — MOTOR de la cadena LA FORMA MANDA (docs/CADENA-LA-FORMA-MANDA.md).

PIEZA 1, "El codo": dos grasas con los MISMOS 18 carbonos y el MISMO grupo ácido en la punta.
La única diferencia es un enlace doble.

    esteárico  C18H36O2   saturado, cero dobles   → la grasa de la mantequilla (sólida)
    oleico     C18H34O2   UN doble cis en C9      → la grasa del aceite de oliva (líquida)

Eso lo vuelve un EXPERIMENTO CONTROLADO: si el comportamiento cambia, no puede ser por otra
cosa. Y lo que cambia es la FORMA — el doble enlace no gira, así que la torcedura se queda.

⚠ EL GATE DE FORMA NO ES OPCIONAL. En el prisma del hexámero la ENERGÍA salió correcta sobre
una geometría desarmada (6 puentes en vez de 9, O-O hasta 9 Å) y estuve a nada de reportar un
resultado falso. La energía no avisa cuando la forma se rompió. El ÁNGULO sí. Como este video
entero es "mira el codo", el codo se MIDE en grados antes de gastar un render.

Sin RDKit en iangpu: las cadenas se construyen aquí con geometría interna estándar (NeRF), que
además deja el control explícito de qué diedro es cis y cuál anti.

  python3 scripts/precompute-cadena.py            las dos, con gate
  python3 scripts/precompute-cadena.py --rapido   base mínima (para iterar)
"""
import os, sys, math
import numpy as np

RAPIDO = '--rapido' in sys.argv
BASE_OPT = 'sto-3g' if RAPIDO else '3-21g'     # relajar la geometría hecha a mano
BOHR = 0.529177210903

# ── longitudes y ángulos ESTÁNDAR (Å / grados) — no inventados ────────────────────────────
R_CC, R_CD = 1.530, 1.330      # C–C simple · C=C doble
R_CH, R_CO, R_COH, R_OH = 1.095, 1.215, 1.345, 0.975
A_CCC, A_CCH, A_HCH = 112.0, 109.5, 107.0
A_CCD = 124.0                  # ángulo en un carbono sp2 (el del doble enlace)


def nerf(a, b, c, r, theta, phi):
    """Coloca un átomo nuevo a distancia r de `c`, con ángulo theta sobre b-c y diedro phi
    respecto al plano a-b-c. Es la forma estándar de armar una molécula por coordenadas
    internas — la misma que usa cualquier Z-matriz, escrita explícita."""
    th, ph = math.radians(theta), math.radians(phi)
    bc = c - b; bc /= np.linalg.norm(bc)
    n = np.cross(b - a, bc)
    nn = np.linalg.norm(n)
    n = np.array([0.0, 0.0, 1.0]) if nn < 1e-8 else n / nn
    m = np.cross(n, bc)
    d = np.array([-r * math.cos(th), r * math.sin(th) * math.cos(ph), r * math.sin(th) * math.sin(ph)])
    return c + d[0] * bc + d[1] * m + d[2] * n


def cadena_grasa(doble_en=None):
    """Ácido graso de 18 carbonos. `doble_en=9` mete un doble CIS entre C9 y C10.

    C1 es el carbono del ácido (–COOH); C18 es el metilo del final. Todos los diedros de la
    cadena van ANTI (180°) = zigzag estirado, que es la forma de mínima energía de una cadena
    saturada. El único diedro CIS (0°) es el del doble enlace, y ESE es el codo.
    """
    at = []          # (símbolo, xyz)
    C = []           # posiciones de los carbonos, en orden

    C.append(np.array([0.0, 0.0, 0.0]))                       # C1
    C.append(np.array([R_CC, 0.0, 0.0]))                      # C2
    ang = math.radians(180.0 - A_CCC)
    C.append(C[1] + R_CC * np.array([math.cos(ang), math.sin(ang), 0.0]))   # C3

    for i in range(3, 18):
        doble_previo = (doble_en is not None and i == doble_en)       # C(i) es el 2o del doble
        r = R_CD if doble_previo else R_CC
        # el ángulo se abre en los carbonos sp2 del doble enlace
        th = A_CCD if (doble_en is not None and i in (doble_en, doble_en + 1)) else A_CCC
        # DIEDRO: anti (180°) en toda la cadena; CIS (0°) al cruzar el doble enlace = EL CODO
        ph = 0.0 if (doble_en is not None and i == doble_en + 1) else 180.0
        C.append(nerf(C[i - 3], C[i - 2], C[i - 1], r, th, ph))
    for p in C:
        at.append(('C', p))

    # ── grupo ácido en C1: =O y –O–H ──
    o1 = nerf(C[2], C[1], C[0], R_CO, 120.0, 0.0)
    o2 = nerf(C[2], C[1], C[0], R_COH, 120.0, 180.0)
    at.append(('O', o1)); at.append(('O', o2))
    at.append(('H', nerf(C[1], C[0], o2, R_OH, 108.0, 0.0)))

    # ── hidrógenos ──
    for i in range(1, 18):
        sp2 = doble_en is not None and i in (doble_en, doble_en + 1)
        vecino_prev, vecino_sig = C[i - 1], (C[i + 1] if i < 17 else None)
        if vecino_sig is None:                                  # C18: metilo, 3 H
            for ph in (60.0, 180.0, 300.0):
                at.append(('H', nerf(C[i - 2], C[i - 1], C[i], R_CH, A_CCH, ph)))
            continue
        if sp2:                                                 # sp2: UN solo H, en el plano
            at.append(('H', nerf(vecino_sig, vecino_prev, C[i], R_CH, 118.0, 180.0)))
        else:                                                   # sp3: dos H, arriba y abajo
            for ph in (120.0, 240.0):
                at.append(('H', nerf(vecino_prev, vecino_sig, C[i], R_CH, A_CCH, ph)))
    return at, len(C)


def a_texto(at):
    return '\n'.join(f'{s} {p[0]:.6f} {p[1]:.6f} {p[2]:.6f}' for s, p in at)


def angulo_del_codo(coords_C):
    """EL GATE. Ángulo del codo en grados: el que forman la primera mitad de la cadena y la
    segunda, con el vértice en el doble enlace. Recto ≈ 180°, doblado ≈ 120°.

    Se mide sobre los CARBONOS de la cadena, que es lo que el ojo sigue en el video."""
    a, v, b = coords_C[0], (coords_C[8] + coords_C[9]) / 2.0, coords_C[-1]
    u, w = a - v, b - v
    cos = np.dot(u, w) / (np.linalg.norm(u) * np.linalg.norm(w))
    return math.degrees(math.acos(np.clip(cos, -1.0, 1.0)))


def _cache(nombre):
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public',
                        'precomputed', f'geom-{nombre}-{BASE_OPT}.npz')


def optimiza(at, nombre):
    """Optimiza la geometría, con CACHÉ. Cada optimización son ~3 min y el resultado es
    determinista, así que re-correr el script para ajustar la NUBE no tiene por qué volver a
    pagarlas. Borrar el .npz fuerza recalcular."""
    from pyscf import gto, scf
    from pyscf.geomopt.geometric_solver import optimize
    ruta = _cache(nombre)
    if os.path.exists(ruta):
        d = np.load(ruta, allow_pickle=True)
        eq = gto.M(atom=[[str(s_), tuple(p)] for s_, p in zip(d['simb'], d['xyz'])],
                   basis=BASE_OPT, unit='Angstrom', verbose=0)
        print(f'   {nombre}: geometría en caché ({os.path.basename(ruta)}) — no se re-optimiza', flush=True)
        return eq
    mol = gto.M(atom=a_texto(at), basis=BASE_OPT, unit='Angstrom', verbose=0)
    print(f'   {nombre}: {mol.natm} átomos · {mol.nao} funciones de base · base {BASE_OPT}', flush=True)
    mf = scf.RHF(mol)
    mf.max_cycle = 200
    eq = optimize(mf, maxsteps=120)
    np.savez(ruta, xyz=eq.atom_coords() * BOHR,
             simb=np.array([eq.atom_symbol(i) for i in range(eq.natm)]))
    return eq


# ══ NUBE ELECTRÓNICA Y .bin ═══════════════════════════════════════════════════════════════
# Formato IDÉNTICO al de precompute-chain.ts, así que `parseBin` de la escena lo lee sin
# tocar una línea del renderer:
#   int32 N · int32 K · float32 extent · float32[K*4] núcleos(x,y,z,Z)
#   float32[N*3] pos · float32[N*3] color · float32[N] size · float32[N] shell
#
# La diferencia con precompute-chain.ts es HONESTIDAD, no formato: ese arma la nube con
# orbitales de enlace localizados y longitudes de libro (bien justificado, pero dibujado).
# Aquí la geometría la OPTIMIZÓ el cálculo y la densidad es |ψ|² de verdad, muestreada. Es el
# estándar de la serie del agua y es lo que sostiene el "nada está inventado" del copy.
# La GEOMETRÍA y la NUBE se pueden pedir a calidades distintas: la forma ya pasó su gate con
# una base mínima (179.9° / 125.5°, y es determinista), así que subir la nube NO tiene por qué
# volver a pagar los ~3 min de optimización. RHO=6-31g PTS=130000 sube solo lo que se ve.
BASE_RHO = os.environ.get('RHO', 'sto-3g' if RAPIDO else '6-31g')
N_PTS = int(os.environ.get('PTS', '40000' if RAPIDO else '130000'))
# Paleta de las cadenas (precompute-chain.ts): NO se inventa color nuevo — pieza hermana,
# misma paleta ([[feedback_extender_reusa_paleta]]).
COL_C = np.array([0.26, 0.86, 0.96])    # esqueleto de carbono, teal
COL_H = np.array([1.00, 0.60, 0.26])    # C–H, ámbar cálido
COL_O = np.array([1.00, 0.78, 0.30])    # el oxígeno del ácido, ORO (como en toda la serie)


def nube(mol, dm, xyz, Zs, n_pts, semilla=1337):
    """Muestrea n_pts puntos con probabilidad ∝ ρ(r).

    ⚠ NO se inventa muestreador: este es EL MISMO de precompute-caroteno-formacion.py
    (`rng.choice` sobre la malla con p ∝ densidad, más una sacudida gaussiana), que es el
    precedente de CADENA LARGA de la casa. La otra familia de la serie —`sample_field` en
    water-ring/o2/bond— es para nubes ANIMADAS: mantiene la correspondencia de partículas
    entre frames para que no parpadeen. Aquí la molécula es estática, así que esa maquinaria
    sobra. Cuando la pieza necesite animar (p.ej. la cadena intentando enderezarse contra la
    barrera del doble enlace), se usa `sample_field`, no un tercero nuevo."""
    rng = np.random.default_rng(semilla)
    lo, hi = xyz.min(axis=0) - 2.4, xyz.max(axis=0) + 2.4
    paso = 0.22                                        # Å — fino frente a un enlace de 1.5
    ejes = [np.arange(lo[k], hi[k] + paso, paso) for k in range(3)]
    G = np.stack(np.meshgrid(*ejes, indexing='ij'), axis=-1).reshape(-1, 3)
    print(f'      malla {len(ejes[0])}x{len(ejes[1])}x{len(ejes[2])} = {len(G)} celdas', flush=True)
    w = eval_rho_pts(mol, dm, G)
    idx = rng.choice(len(G), size=n_pts, p=w / w.sum())
    pos = G[idx] + rng.normal(scale=paso * 0.55, size=(n_pts, 3))
    d = eval_rho_pts(mol, dm, pos)
    d = np.clip(d / (np.percentile(d, 99) + 1e-12), 0, 1)
    # color por el átomo MÁS CERCANO: el ojo lee el esqueleto y distingue el ácido
    cerca = np.argmin(((pos[:, None, :] - xyz[None, :, :]) ** 2).sum(axis=2), axis=1)
    Zc = Zs[cerca][:, None]
    base = np.where(Zc == 8, COL_O, np.where(Zc == 6, COL_C, COL_H))
    hot = np.clip(d * d * 0.5, 0, 1)[:, None]
    bright = (0.24 + 0.55 * d)[:, None]
    col = (base * (1 - hot) + np.array([1.0, 0.96, 0.86]) * hot) * bright
    # TAMAÑO: la fórmula del agua (0.030+0.055·d) está calibrada para una molécula de ~6 Å.
    # Una cadena de 22 Å ocupa ~14× más volumen, así que la MISMA cantidad de puntos del mismo
    # tamaño se ve como polvo suelto — medido en stills: esqueleto de palitos, no la nube densa
    # que es la firma de la serie. Se compensa con el tamaño, no subiendo el brillo (más luz no
    # es más color: [[feedback_mas_luz_no_es_color]]).
    # TAMAÑO. ⚠ Se probó duplicarlo (0.075+0.130) para que la nube leyera con la cámara cerca
    # de UNA molécula; con las dos juntas y la cámara a ~65 unidades esos sprites se suman en
    # aditivo hasta SATURAR: a rMul 4.25 el cuadro es una pared de luz y a 4.60 casi negro, sin
    # punto medio. El tamaño se queda en el de la casa y la densidad se sube con PUNTOS, que es
    # lo que no revienta el blend.
    size = (0.034 + 0.060 * d).astype('<f4')
    return pos.astype('<f4'), col.astype('<f4'), size, d.astype('<f4')


def eval_rho_pts(mol, dm, pts, chunk=40000):
    out = np.empty(pts.shape[0])
    for a in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[a:a + chunk] / BOHR)   # PySCF quiere BOHR
        out[a:a + chunk] = np.einsum('pi,pi->p', ao @ dm, ao)
    return np.maximum(out, 0.0)


def escribe_bin(ruta, xyz, Zs, pos, col, size, shell):
    import struct
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    cen = xyz.mean(axis=0)
    xyz = xyz - cen; pos = pos - cen
    extent = float(np.abs(np.concatenate([xyz, pos])).max())
    with open(ruta, 'wb') as fp:
        fp.write(struct.pack('<2i', len(pos), len(xyz)))
        fp.write(struct.pack('<f', extent))
        for i in range(len(xyz)):
            fp.write(struct.pack('<4f', *xyz[i], float(Zs[i])))
        for a in (pos, col):
            fp.write(np.ascontiguousarray(a, dtype='<f4').tobytes())
        for a in (size, shell):
            fp.write(np.ascontiguousarray(a, dtype='<f4').tobytes())
    print(f'   OK  {os.path.basename(ruta)}  {os.path.getsize(ruta)/1024/1024:.2f} MB '
          f'({len(pos)} pts, {len(xyz)} núcleos, extent {extent:.1f} Å)', flush=True)


def densidad_y_bin(eq, nombre):
    from pyscf import gto, scf
    xyz = eq.atom_coords() * BOHR
    Zs = np.array([eq.atom_charge(i) for i in range(eq.natm)])
    mol = gto.M(atom=[[eq.atom_symbol(i), tuple(xyz[i])] for i in range(eq.natm)],
                basis=BASE_RHO, unit='Angstrom', verbose=0)
    print(f'   densidad {nombre}: base {BASE_RHO} · {mol.nao} funciones', flush=True)
    mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
    dm = mf.make_rdm1()
    pos, col, size, shell = nube(mol, dm, xyz, Zs, N_PTS)
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public',
                        'precomputed', f'chain-{nombre}.bin')
    escribe_bin(ruta, xyz, Zs, pos, col, size, shell)
    return dict(xyz=xyz, Z=Zs, pos=pos, col=col, size=size, shell=shell)


def main():
    print('═══ CADENA "LA FORMA MANDA" · pieza 1: EL CODO ═══\n', flush=True)
    resultados = {}
    for nombre, doble in (('estearico', None), ('oleico', 9)):
        at, nC = cadena_grasa(doble)
        print(f'── {nombre} ── construido: {len(at)} átomos ({nC} carbonos)', flush=True)
        crudo = np.array([p for _, p in at[:nC]])
        print(f'   codo ANTES de optimizar: {angulo_del_codo(crudo):6.1f}°', flush=True)
        eq = optimiza(at, nombre)
        xyz = eq.atom_coords() * BOHR
        simb = [eq.atom_symbol(i) for i in range(eq.natm)]
        Cs = np.array([xyz[i] for i in range(eq.natm) if simb[i] == 'C'])
        ang = angulo_del_codo(Cs)
        largo = float(np.linalg.norm(Cs[0] - Cs[-1]))
        print(f'   codo OPTIMIZADO:         {ang:6.1f}°   ·  C1→C18 {largo:5.2f} Å', flush=True)
        resultados[nombre] = dict(ang=ang, largo=largo, xyz=xyz, simb=simb, nC=len(Cs), eq=eq)
        np.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public',
                             'precomputed', f'geom-{nombre}.npy'), xyz)

    print('\n────────── GATE DE FORMA ──────────', flush=True)
    e, o = resultados['estearico'], resultados['oleico']
    ok = True
    if e['ang'] < 150:
        print(f"✗ el esteárico NO salió recto: {e['ang']:.1f}° (se esperaba >150°)"); ok = False
    else:
        print(f"✓ esteárico RECTO      {e['ang']:6.1f}°  (>150 esperado)")
    if not (100 <= o['ang'] <= 145):
        print(f"✗ el oleico NO tiene codo: {o['ang']:.1f}° (se esperaba 100-145°)"); ok = False
    else:
        print(f"✓ oleico DOBLADO       {o['ang']:6.1f}°  (100-145 esperado)")
    d = e['largo'] - o['largo']
    print(f"  largo de punta a punta: recto {e['largo']:.2f} Å · doblado {o['largo']:.2f} Å  →  el codo acorta {d:.2f} Å")
    if d < 1.5:
        print('✗ el codo no acorta la cadena lo suficiente para verse'); ok = False

    print('\n' + ('✅ GATE DE FORMA OK — hay pieza' if ok else '❌ GATE DE FORMA REPROBADO — NO hay video'), flush=True)
    if not ok:
        return 1
    # La nube SOLO se calcula si la forma pasó: no tiene caso muestrear electrones de una
    # geometría que no cuenta la historia.
    print('\n────────── NUBE ELECTRÓNICA ──────────', flush=True)
    guardado = {}
    for nombre in ('estearico', 'oleico'):
        guardado[nombre] = densidad_y_bin(resultados[nombre]['eq'], nombre)

    # ── LAS DOS JUNTAS, que es LA PIEZA ────────────────────────────────────────────────
    # El video compara dos moléculas y la escena carga UNA. La salida limpia no es un script
    # por video (Regla #0.5 lo prohíbe) sino un tercer .bin con las dos lado a lado: mismo
    # formato, una sola clave `codo`, y la comparación queda DENTRO del cuadro.
    #
    # Honestidad: son DOS cálculos independientes, no un sistema de dos moléculas. Se separan
    # 14 Å —más de 4 veces el alcance de cualquier interacción de dispersión relevante— así que
    # ponerlas juntas es un MONTAJE para comparar, y no finge una interacción que no calculamos.
    print('\n────────── LAS DOS JUNTAS (la pieza) ──────────', flush=True)
    juntas(guardado)
    return 0


def juntas(g, sep=14.0):
    import struct
    izq, der = g['estearico'], g['oleico']
    def centra(d, dx):
        xyz = d['xyz'] - d['xyz'].mean(axis=0); pos = d['pos'] - d['xyz'].mean(axis=0)
        off = np.array([0.0, dx, 0.0])
        return xyz + off, pos + off
    # ejes: la cadena es larga en X, así que se separan en Y — quedan una AL LADO de la otra
    xyzA, posA = centra(izq, +sep / 2); xyzB, posB = centra(der, -sep / 2)
    xyz = np.vstack([xyzA, xyzB]); Zs = np.concatenate([izq['Z'], der['Z']])
    pos = np.vstack([posA, posB])
    col = np.vstack([izq['col'], der['col']]); size = np.concatenate([izq['size'], der['size']])
    shell = np.concatenate([izq['shell'], der['shell']])
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public',
                        'precomputed', 'chain-codo.bin')
    escribe_bin(ruta, xyz, Zs, pos, col, size, shell)
    print(f'      arriba: esteárico RECTO · abajo: oleico CON CODO · separadas {sep} Å', flush=True)


if __name__ == '__main__':
    sys.exit(main())
