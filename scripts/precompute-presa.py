#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LA PRESA — el dinero como AGUA, para la serie «la economía de tu negocio» (sonda, 2026-09-17).

Por qué (ian, 2026-09-17): «NO ME GUSTA PARA NADA EL ASPECTO VISUAL NI LAS ANIMACIONES… no hay
dinamismo, no hay movimiento, se ve feo… se debe enseñar economía de una manera elegante,
majestuosa, divina, como lo demás, que el guion sea un poema al crecimiento y la abundancia».

EL DIAGNÓSTICO MEDIDO: los videos que sí se ven divinos (el puente, el hexágono) son UNA nube
densa de ~34,000 puntos que llena el cuadro. El guardadito son 24 puntitos en una rejilla sobre
negro (0.4-3 % de la pantalla con luz). No es el motor: es la MATERIA. Aquí se le da materia.

LA LECTURA (licencia visual DECLARADA; los números son reales): el dinero de un negocio es agua.
  · el guardadito     = el NIVEL de la presa (sale de caja[k] de la simulación de econ-guardadito)
  · las ventas        = el CAUDAL que cae desde arriba
  · los gastos        = la FUGA que nunca deja de salir por abajo
  · el mes malo       = la SEQUÍA: deja de caer caudal y el nivel baja
  · cerrar            = quedarse seco
El nivel NO es decorativo: es la caja real, mes con mes, de la misma pareja del capítulo 1.

Salida: public/precomputed/economia-presa.bin (+ -efield.bin vacío + .json).
  python3 scripts/precompute-presa.py [--n 26000] [--sub 8] [--meses 12]
"""
import os, sys, json, struct
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
SALIDA = arg('--salida', 'economia-presa')
OUT = os.path.join(ROOT, 'public', 'precomputed', f'{SALIDA}.bin')
OUT_JSON = OUT.replace('.bin', '.json')
CAJA_JSON = os.path.join(ROOT, 'public', 'precomputed', 'economia-guardadito.json')

N = arg('--n', 26000)          # gotas totales (cuerpo + caudal + fuga)
SUB = arg('--sub', 8)          # cuadros por mes (el motor interpola; esto da movimiento continuo)
MESES = arg('--meses', 12)     # hasta el mes en que Doña Lupe cierra
SEMILLA = 11
R = 0.52                       # radio de la presa (v2: más angosta que alta, como pide el 9:16)
H = 1.70                       # altura de la presa
NIVEL_MAX = 1.5                # meses de gastos que caben en la presa llena
CENTINELA = -32768


def caja_de_lupe():
    """La caja REAL del capítulo 1, mes a mes, en meses de gastos (None = ya cerró)."""
    d = json.load(open(CAJA_JSON, encoding='utf-8'))
    return d['billetes']['caja_heroe_meses']['oro']


def main():
    rng = np.random.default_rng(SEMILLA)
    caja = caja_de_lupe()[:MESES + 1]
    K = MESES * SUB + 1
    # nivel interpolado entre meses (lineal); tras cerrar, seco
    niv_mes = np.array([0.0 if c is None else min(1.0, c / NIVEL_MAX) for c in caja], dtype=np.float32)
    t_mes = np.arange(len(niv_mes), dtype=np.float32)
    nivel = np.interp(np.linspace(0, len(niv_mes) - 1, K), t_mes, niv_mes).astype(np.float32)
    # la SEQUÍA: los dos últimos meses no entra caudal (es el «mes malo» del guion)
    caudal_on = np.ones(K, dtype=np.float32)
    caudal_on[int((MESES - 2) * SUB):] = np.linspace(1, 0, K - int((MESES - 2) * SUB))

    n_cuerpo = int(N * 0.80); n_caudal = int(N * 0.08); n_fuga = int(N * 0.06); n_vaso = N - n_cuerpo - n_caudal - n_fuga
    print(f'▶ LA PRESA · {N} gotas ({n_cuerpo} cuerpo · {n_caudal} caudal · {n_fuga} fuga · {n_vaso} vaso) · {K} cuadros ({MESES} meses × {SUB})')
    print(f'   nivel (meses de gastos): ' + ' '.join(f'{c:.2f}' if c is not None else 'seco' for c in caja))

    pos = np.zeros((K, N, 3), dtype=np.float32)
    vivo = np.ones((K, N), dtype=bool)

    # ── EL CUERPO: gotas repartidas por VOLUMEN; cada una guarda su profundidad (q) y se ve
    # mientras el nivel no baje de ella. La presa se vacía de arriba hacia abajo, como el agua.
    q = rng.random(n_cuerpo)                                   # 0 = fondo, 1 = borde
    rad = R * np.sqrt(rng.random(n_cuerpo)) * (0.55 + 0.45 * np.sqrt(q))   # la presa se abre hacia arriba
    th0 = rng.random(n_cuerpo) * 2 * np.pi
    giro = (0.10 + 0.22 * (1 - rad / R)) * rng.normal(1.0, 0.12, n_cuerpo)  # el centro gira más rápido
    bob = rng.random(n_cuerpo) * 2 * np.pi
    for k in range(K):
        th = th0 + giro * (k / SUB) * 0.55
        h = q * H * (0.985 + 0.015 * np.sin(bob + k * 0.35))    # la superficie respira
        pos[k, :n_cuerpo, 0] = h - H * 0.5                      # X = vertical en pantalla (roll π/2)
        pos[k, :n_cuerpo, 1] = rad * np.cos(th)
        pos[k, :n_cuerpo, 2] = rad * np.sin(th) * 0.55          # disco aplanado: se ve el volumen sin llenar de ruido
        vivo[k, :n_cuerpo] = q < nivel[k]

    # ── EL CAUDAL: lo que entra por ventas. Chorro que cae desde arriba y desaparece al tocar
    # la superficie. Cada gota lleva su fase, así que el chorro es continuo entre cuadros.
    a, b = n_cuerpo, n_cuerpo + n_caudal
    fase = rng.random(n_caudal); rc = 0.16 * np.sqrt(rng.random(n_caudal)); tc = rng.random(n_caudal) * 2 * np.pi
    for k in range(K):
        p = (fase + k * 0.085) % 1.0                            # 0 = arriba del todo, 1 = superficie
        h = H * 0.62 - p * (H * 0.62 - (nivel[k] * H - H * 0.5) - 0.02)
        pos[k, a:b, 0] = h
        pos[k, a:b, 1] = rc * np.cos(tc) * (0.4 + 0.6 * p)
        pos[k, a:b, 2] = rc * np.sin(tc) * (0.4 + 0.6 * p) * 0.55
        vivo[k, a:b] = (rng.random(n_caudal) < caudal_on[k]) & (nivel[k] > 0.01)

    # ── LA FUGA: los gastos, que no paran nunca. Sale por el fondo y cae fuera del cuadro.
    c0 = b; v0 = c0 + n_fuga
    fase2 = rng.random(n_fuga); rf = 0.12 * np.sqrt(rng.random(n_fuga)); tf = rng.random(n_fuga) * 2 * np.pi
    for k in range(K):
        p = (fase2 + k * 0.11) % 1.0
        pos[k, c0:v0, 0] = -H * 0.5 - p * H * 0.55
        pos[k, c0:v0, 1] = rf * np.cos(tf) * (1 + 0.8 * p)
        pos[k, c0:v0, 2] = rf * np.sin(tf) * (1 + 0.8 * p) * 0.55
        vivo[k, c0:v0] = nivel[k] > 0.01

    # ── EL VASO: la pared de la presa. Nunca se apaga, así que al final queda el recipiente VACÍO
    # en vez de un cuadro negro — y desde el primer cuadro se entiende que el agua está CONTENIDA.
    tv = rng.random(n_vaso) * 2 * np.pi; hv = rng.random(n_vaso)
    rv = R * (0.55 + 0.45 * np.sqrt(hv)) * rng.normal(1.0, 0.012, n_vaso)
    for k in range(K):
        pos[k, v0:, 0] = hv * H - H * 0.5
        pos[k, v0:, 1] = rv * np.cos(tv)
        pos[k, v0:, 2] = rv * np.sin(tv) * 0.55
    vivo[:, v0:] = True

    # ── COLOR: oro. El fondo, ámbar hondo; la superficie, oro claro; el caudal, casi blanco.
    col = np.zeros((N, 3), dtype=np.uint8)
    hondo = np.array([255, 150, 40], dtype=float); arriba = np.array([255, 224, 150], dtype=float)
    col[:n_cuerpo] = (hondo[None] + (arriba - hondo)[None] * q[:, None]).astype(np.uint8)
    col[a:b] = [255, 245, 210]
    col[c0:v0] = [210, 140, 55]
    col[v0:] = [120, 78, 34]                     # el vaso, apagado: es el recipiente, no el dinero

    posq = 32767 / (max(R, H) * 1.35)
    qz = np.clip(np.round(pos * posq), -32767, 32767).astype('<i2')
    qz[~vivo] = CENTINELA
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', N, 0, 0, K, 0, 0, 0))
        fp.write(struct.pack('<3f', float(posq), 0.0, 1.0))
        fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())     # R alto = cuadro 0
        fp.write(vivo.mean(axis=1).astype('<f4').tobytes())         # bondMass = fracción de agua viva
        fp.write(col.tobytes())
        fp.write(qz.tobytes())
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB')
    ef = OUT.replace('.bin', '-efield.bin')
    with open(ef, 'wb') as fp:
        fp.write(struct.pack('<3i', K, 0, 0)); fp.write(np.linspace(0, 1, K).astype('<f4').tobytes())
    json.dump({'lectura': 'EL DINERO ES AGUA (licencia visual declarada): nivel = caja real de Doña Lupe (capítulo 1), caudal = ventas, fuga = gastos, sequía = el mes malo',
               'fuente_numeros': 'public/precomputed/economia-guardadito.json → billetes.caja_heroe_meses.oro (ruina del jugador calibrada a INEGI 1989-2019)',
               'gotas': {'total': N, 'cuerpo': n_cuerpo, 'caudal': n_caudal, 'fuga': n_fuga, 'vaso': n_vaso},
               'nivel_max_meses': NIVEL_MAX, 'meses': MESES, 'sub_cuadros_por_mes': SUB, 'K': K,
               'nivel_por_mes': [None if c is None else round(c, 3) for c in caja],
               'semilla': SEMILLA, 'R': R, 'H': H}, open(OUT_JSON, 'w'), indent=1, ensure_ascii=False)
    print(f'OK  {ef} (campo vacío) · {OUT_JSON}')


if __name__ == '__main__':
    main()
