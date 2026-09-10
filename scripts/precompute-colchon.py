#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EL COLCHÓN — por qué mueren los negocios (ruina del jugador con ventas ruidosas), en el .bin de nubes.

Pieza: econ-colchon («Un negocio no muere de vender poco. Muere el día que no sabía cuánto le quedaba»).
Guion: scripts/guiones/econ-colchon.txt. Ian, 2026-09-10: «me late… quiero ver los stills».

EL MODELO (honesto y chico): cada negocio vende cada mes V = max(0, 1 + σ·η) con costos fijos 1
(unidades de un mes de costos). Utilidad esperada = 0: para reproducir la mortalidad de INEGI
(q(0)=0.3092 en el primer año, q(4)=0.6432 antes de cinco) el margen esperado tuvo que ser CERO
(calibrado 2026-09-10: σ=0.35, margen 0 → 32 % al año, 66 % a 5 años). Muere quien queda con
caja < 0. DOS GRUPOS con EXACTAMENTE la misma suerte (misma η, agente por agente): los DORADOS
empiezan con 1 mes de caja, los AZULES con 3. Lo único que cambia es el colchón.
Resultado medido: a 5 años mueren 2.8× más dorados que azules (casi al triple); al año, 32 % vs 1 %.

LA LECTURA VISUAL (licencia declarada, como en economia-grupos): un DISCO delgado; la CAJA de cada
negocio es su cercanía al centro (caja 0 = la orilla, 6 meses = el centro). Al morir, el punto se
APAGA: se escribe el CENTINELA (-32768,-32768,-32768), que el motor descarta (O2Cloud pone NaN en
esa posición → el vértice no se rasteriza). Sin centinela no hay forma de quitar un punto de una
nube de color estático: el color por punto es fijo en WAP2.

Salida: public/precomputed/economia-colchon.bin (+ -efield.bin vacío + .json con las cifras).
  python3 scripts/precompute-colchon.py [--n 40000] [--meses 60] [--sigma 0.35]
"""
import os, sys, json, struct
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'precomputed', 'economia-colchon.bin')
OUT_JSON = OUT.replace('.bin', '.json')
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
N = arg('--n', 40000)            # negocios (mitad dorados, mitad azules; pares con la misma suerte)
MESES = arg('--meses', 60)       # 5 años
SIGMA = arg('--sigma', 0.35)     # ruido de ventas (calibrado contra INEGI)
MARGEN = arg('--margen', 0.0)    # utilidad esperada por mes (0 = viven en tablas)
COLCHON = (1.0, 3.0)             # meses de costos guardados: dorados, azules
CAJA_MAX = 6.0                   # 6 meses de caja = el centro del disco
SEMILLA = 7
CAJA = 5.0; GROSOR = 0.55        # el mismo disco que economia-grupos
CENTINELA = -32768               # «este punto no existe» para el motor
K = MESES + 1                    # un cuadro por mes (el motor interpola entre cuadros)


def main():
    rng = np.random.default_rng(SEMILLA)
    M = N // 2
    eta = rng.standard_normal((MESES, M))                       # LA MISMA SUERTE para los dos grupos
    costo = 1.0 - MARGEN
    caja = np.empty((K, N), dtype=np.float32)
    vivo = np.ones((K, N), dtype=bool)
    caja[0, :M] = COLCHON[0] * costo; caja[0, M:] = COLCHON[1] * costo
    for m in range(MESES):
        ventas = np.maximum(0.0, 1.0 + SIGMA * eta[m])
        c = caja[m].copy()
        c[:M] += ventas - costo; c[M:] += ventas - costo          # misma η, agente i ↔ agente M+i
        muerto_antes = ~vivo[m]
        vivo[m + 1] = vivo[m] & (c >= 0)
        c[~vivo[m + 1]] = np.nan
        c[muerto_antes] = np.nan
        caja[m + 1] = c
    mueren = lambda g, mes: 1 - vivo[mes, g].mean()
    d, a = slice(0, M), slice(M, N)
    print(f'▶ EL COLCHÓN · N={N} ({M}+{M}) · σ={SIGMA} · margen={MARGEN} · {MESES} meses')
    print(f'   dorados (1 mes): mueren año1 {mueren(d,12):.1%} · año2 {mueren(d,24):.1%} · año5 {mueren(d,60):.1%}')
    print(f'   azules  (3 meses): mueren año1 {mueren(a,12):.1%} · año2 {mueren(a,24):.1%} · año5 {mueren(a,60):.1%}')
    razon5 = mueren(d, 60) / max(mueren(a, 60), 1e-9); razon1 = mueren(d, 12) / max(mueren(a, 12), 1e-9)
    print(f'   RAZÓN dorados/azules: año5 {razon5:.2f}× · año1 {razon1:.1f}×   (INEGI: 31 % al año, 64 % a 5 años)')

    # ── posiciones: EL GRUPO ES EL LUGAR, y el lugar NO cambia; muerto → centinela.
    # PRIMERA TANDA DE STILLS (2026-09-10): con «caja → cercanía al centro» la caja de los vivos
    # hace paseo aleatorio y a los cinco años los dos anillos se DISUELVEN en una nube pareja
    # con un núcleo azul brillante: la orilla que se apaga no se veía, se veía «todo se esparce».
    # La historia es «la misma suerte, distinto colchón» y eso pide que cada negocio se quede
    # DONDE EMPEZÓ y que morir sea desaparecer AHÍ: la banda de oro se ralea a un tercio junto a
    # una de azul que casi no se ralea. La comparación vive en el lugar, no en el movimiento.
    #   AZULES (3 meses): DISCO lleno r ∈ [0, 0.60]·R (uniforme en área) — sin hoyo en el centro
    #   DORADOS (1 mes):  ANILLO exterior r ∈ [0.75, 1.0]·R (uniforme en área, ≈ misma densidad)
    # Un temblor radial chico por mes (±2 % de R, con la η de cada negocio) para que la nube
    # viva mientras corre el reloj; los pares comparten η, así que tiemblan igual.
    # VERSIÓN 2 — GEMELOS (ian, 2026-09-10, tras ver el video 1: «no se mueve nada… son tantos puntos
    # que los que se mueren no se notan… no entendí nada»). Anillo-y-disco enseñaba dos GRUPOS; la
    # historia es una PAREJA con la misma suerte. Cada negocio i es un par pegado: oro (1 mes) y azul
    # (3 meses) a ±d del centro del par, con la MISMA η → tiemblan idéntico (misma suerte, VISIBLE
    # en acercamiento) y morir es que uno de los dos desaparezca junto a su gemelo. De lejos el disco
    # es una mezcla oro+azul que se vuelve azul conforme mueren los dorados.
    # EL HÉROE: la pareja del guion («estos dos negocios») vive en el CENTRO, en una zona limpia, con
    # más separación, y se elige la pareja cuyo dorado muere en el mes que la voz dice «el mes malo»
    # (--hero-mes) y cuyo azul llega vivo a los cinco años. Volver a ella al final = el cierre.
    HERO_MES = arg('--hero-mes', 51)
    ZONA = 0.12 * CAJA; D_PAR = 0.035 * CAJA; D_HERO = 0.06 * CAJA
    u = rng.random(M); th = rng.random(M)
    rc = CAJA * np.sqrt(u * (1.0 - (ZONA / CAJA) ** 2) + (ZONA / CAJA) ** 2)   # centros de par, uniforme en área, fuera de la zona
    th = th * 2 * np.pi
    pcx, pcy = rc * np.cos(th), rc * np.sin(th)
    phi = rng.random(M) * 2 * np.pi; ux, uy = np.cos(phi), np.sin(phi)         # orientación del par
    psi = rng.random(M) * 2 * np.pi; sx, sy = np.cos(psi), np.sin(psi)         # dirección del temblor del par
    zc = rng.normal(0, GROSOR, M)
    # el héroe: dorado muere en HERO_MES (o el más cercano), azul vivo a los 60 meses
    mes_muerte_oro = np.where(vivo[MESES, :M], 10 ** 6, np.argmin(vivo[:, :M], axis=0))   # primer cuadro muerto
    cand = np.where(vivo[MESES, M:])[0]
    hero = int(cand[np.argmin(np.abs(mes_muerte_oro[cand] - HERO_MES))])
    print(f'   héroe: par #{hero} · su dorado muere en el mes {int(mes_muerte_oro[hero])} (pedido {HERO_MES}) · su azul vive los 60')
    pcx[hero] = pcy[hero] = 0.0; zc[hero] = 0.0; ux[hero], uy[hero] = 1.0, 0.0; sx[hero], sy[hero] = 0.0, 1.0
    dsep = np.full(M, D_PAR, dtype=np.float32); dsep[hero] = D_HERO
    pos = np.zeros((K, N, 3), dtype=np.float32)
    for k in range(K):
        e = eta[min(k, MESES - 1)] * 0.02 * CAJA                             # la MISMA η para el par (i, M+i)
        tx, ty = e * sx, e * sy
        pos[k, :M, 0] = pcx - dsep * ux + tx; pos[k, :M, 1] = pcy - dsep * uy + ty; pos[k, :M, 2] = zc      # oro
        pos[k, M:, 0] = pcx + dsep * ux + tx; pos[k, M:, 1] = pcy + dsep * uy + ty; pos[k, M:, 2] = zc      # azul
    posq = 32767 / (CAJA * 1.25)
    q = np.clip(np.round(pos * posq), -32767, 32767).astype('<i2')
    q[~vivo] = CENTINELA                                        # (K,N) → las 3 coordenadas del muerto
    ORO, AZUL = [255, 195, 80], [60, 120, 255]
    color = np.array([ORO] * M + [AZUL] * M, dtype=np.uint8)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', N, 0, 0, K, 0, 0, 0))     # sin núcleos
        fp.write(struct.pack('<3f', float(posq), 0.0, 1.0))               # R_MIN=0 (fin) · R_MAX=1 (inicio)
        fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())            # Rvals DESCENDENTE: R alto = cuadro 0
        fp.write(vivo.mean(axis=1).astype('<f4').tobytes())               # bondMass: fracción viva por cuadro
        fp.write(color.tobytes())                                          # accColor: oro / azul
        fp.write(q.tobytes())                                              # acc = todos
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB  ·  {N} negocios × {K} cuadros')
    ef = OUT.replace('.bin', '-efield.bin')
    with open(ef, 'wb') as fp:
        fp.write(struct.pack('<3i', K, 0, 0)); fp.write(np.linspace(0, 1, K).astype('<f4').tobytes())
    json.dump({'modelo': 'ruina del jugador con ventas multiplicativas (Gibrat) y costos fijos; dos grupos con la MISMA secuencia de suerte y distinto colchón inicial',
               'calibracion': 'INEGI, Nota sobre los indicadores de la Demografía de los Negocios (tabla 1989-2019): q(0)=0.3092, q(4)=0.6432, E(0)=8.4 años',
               'N': N, 'meses': MESES, 'sigma': SIGMA, 'margen': MARGEN, 'colchon_meses': COLCHON, 'semilla': SEMILLA,
               'mueren_dorados': {'ano1': round(mueren(d, 12), 4), 'ano2': round(mueren(d, 24), 4), 'ano5': round(mueren(d, 60), 4)},
               'mueren_azules': {'ano1': round(mueren(a, 12), 4), 'ano2': round(mueren(a, 24), 4), 'ano5': round(mueren(a, 60), 4)},
               'razon_ano5': round(razon5, 3), 'razon_ano1': round(razon1, 2),
               'heroe': {'par': hero, 'mes_muere_dorado': int(mes_muerte_oro[hero]), 'pedido': HERO_MES, 'posicion': 'origen, zona limpia de radio 0.12·CAJA, separación 0.06·CAJA'},
               'licencia_visual': 'el grupo es el LUGAR y no cambia: azules = disco lleno r<0.60R, dorados = anillo exterior 0.75R-R (misma densidad). Morir = desaparecer ahí (centinela (-32768)³ que el motor descarta). Temblor radial ±2 % de R con la η del mes (los pares comparten η).',
               'cuadro_por_mes': 1, 'K': K}, open(OUT_JSON, 'w'), indent=1, ensure_ascii=False)
    print(f'OK  {ef} (campo vacío) · {OUT_JSON}')


if __name__ == '__main__':
    main()
