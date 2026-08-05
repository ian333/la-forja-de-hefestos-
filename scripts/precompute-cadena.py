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


def optimiza(at, nombre):
    from pyscf import gto, scf
    from pyscf.geomopt.geometric_solver import optimize
    mol = gto.M(atom=a_texto(at), basis=BASE_OPT, unit='Angstrom', verbose=0)
    print(f'   {nombre}: {mol.natm} átomos · {mol.nao} funciones de base · base {BASE_OPT}', flush=True)
    mf = scf.RHF(mol)
    mf.max_cycle = 200
    eq = optimize(mf, maxsteps=120)
    return eq


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
        resultados[nombre] = dict(ang=ang, largo=largo, xyz=xyz, simb=simb, nC=len(Cs))
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
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
