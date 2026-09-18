#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LA CIUDAD DE NOCHE — la economía de una colonia REAL, para la serie «la economía de tu negocio».

Por qué (ian, 2026-09-17, tras tirar la presa): «busca referencias de calidad cine con economía y
dale recio». Referencias vistas: Koblin (Flight Patterns), Butler (amistades de Facebook), las
ciudades de noche desde la ISS (NASA), Anadol, Ikeda. Todas comparten: ESTRUCTURA FRACTAL REAL
(calles, rutas), DOS MUNDOS DE COLOR (la red fría, el flujo cálido), VASTEDAD (una ciudad entera)
y FLUJO con estela. Ver docs/QUE-EXCITA-EL-OJO.md §5 (candidato A).

LO REAL:
  · Las CALLES son las de OpenStreetMap (Overpass, way["highway"]) de Chimalhuacán, Edo. de México:
    el municipio del Manifiesto de GAIA. Cada cinta de luz es una calle que existe.
  · Los NEGOCIOS se reparten sobre las calles residenciales y terciarias en proporción a su largo
    (OSM sólo trae 16 con coordenada; INEGI-DENUE da el conteo, pendiente de conectar).
  · El DINERO son partículas que viajan por las calles del que paga al que cobra, por el camino
    más corto sobre la red real (Dijkstra). Cada negocio gasta cada mes lo que le toca en otros
    negocios cercanos (comercio local, distancia-decaído) y cobra lo que le llega.
  · La CAJA de cada negocio = lo que cobró − lo que gastó, mes con mes (la misma ruina del jugador
    del capítulo 1: margen esperado cero, calibrado a INEGI). Sin caja, cierra: se apaga, deja de
    gastar, y los vecinos que le vendían pierden esas ventas. El contagio NO se programa: emerge.
  · El MES MALO es una sequía de demanda que entra por un lado de la colonia y avanza.

LO QUE SE VE (licencia declarada): cada negocio es un cúmulo de luz cálida cuyo tamaño es su caja;
las calles, cintas frías; el dinero, chispas doradas con estela que corren por las calles.

Salida: public/precomputed/economia-ciudad.bin (nube: negocios + dinero) y economia-ciudad-efield.bin
(las calles, formato BondEField: int32 K,NL,LP · float32 Rvals[K] · int16 ×2000 · uint8 brillo).
  python3 scripts/precompute-ciudad.py --calles <overpass.json> [--negocios 1200] [--pesos 14000] [--meses 12] [--sub 10]
"""
import os, sys, json, struct, math, heapq
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arg = lambda k, d: type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
SALIDA = arg('--salida', 'economia-ciudad')
OUT = os.path.join(ROOT, 'public', 'precomputed', f'{SALIDA}.bin')
OUT_EF = OUT.replace('.bin', '-efield.bin')
OUT_JSON = OUT.replace('.bin', '.json')
CALLES = arg('--calles', os.path.join(ROOT, 'public', 'precomputed', 'osm-chimalhuacan-calles.json'))

M = arg('--negocios', 1200)        # negocios sobre las calles
P = arg('--pesos', 9000)           # partículas de dinero (cada una lleva 3 fantasmas de estela)
MESES = arg('--meses', 12)
SUB = arg('--sub', 8)              # cuadros por mes
GLOW = 26                          # puntos de luz por negocio a caja llena (1 mes de gastos = 22 luces)
ESTELA = 3                         # fantasmas por peso: sus posiciones de los 2 cuadros anteriores (la estela del Wind Map)
# SEMILLA 28 (elegida 2026-09-18 entre 14-45, declarado): la única pareja en la que Doña Lupe cierra
# DESPUÉS de que la sequía llega a su calle (mes 9) y Don Beto aguanta los 12 — la historia del guion.
# Es elegir CUÁL corrida real contar, no cambiar el modelo: la colonia da lo mismo en todas (41-46 % vs 73-78 %).
SEMILLA = arg('--semilla', 28)
HERO_DX = arg('--hero-dx', 0.0)   # corre el sitio de la pareja hacia el sur (+) o el norte (−), en unidades
# sub-caja 9:16 dentro de lo bajado (2.3 km de ancho × 3.9 km de alto), norte arriba
LON0, LON1, LAT0, LAT1 = -98.966, -98.944, 19.405, 19.440
M_POR_UNIDAD = 450.0               # 1 unidad de escena = 450 m
CENTINELA = -32768
TRANSITABLE = {'primary': 1.0, 'secondary': 0.9, 'tertiary': 0.7, 'residential': 0.42, 'unclassified': 0.42, 'living_street': 0.4, 'service': 0.25}
SIGMA = 0.35                       # ruido de ventas (calibrado a INEGI en el capítulo 1)
COLCHON = arg('--colchon', 1.0)    # meses de gastos con los que abre cada negocio (Doña Lupe)
VEL = 95.0                         # metros por cuadro que recorre un peso


def proyectar(lon, lat):
    lat_m = math.radians((LAT0 + LAT1) / 2)
    x = (lat - (LAT0 + LAT1) / 2) * 110540 / M_POR_UNIDAD              # norte → +X (vertical en pantalla)
    y = (lon - (LON0 + LON1) / 2) * 111320 * math.cos(lat_m) / M_POR_UNIDAD   # este → +Y (horizontal)
    return x, y


def cargar_calles():
    c = json.load(open(CALLES, encoding='utf-8'))
    nodos, aristas, lineas = {}, [], []
    for w in c['elements']:
        if w['type'] != 'way': continue
        hw = w.get('tags', {}).get('highway')
        if hw not in TRANSITABLE: continue
        g = w['geometry']; ids = w['nodes']
        pts = []
        for nid, p in zip(ids, g):
            if not (LON0 <= p['lon'] <= LON1 and LAT0 <= p['lat'] <= LAT1): pts.append(None); continue
            nodos.setdefault(nid, proyectar(p['lon'], p['lat'])); pts.append(nid)
        for a, b in zip(pts, pts[1:]):
            if a is None or b is None: continue
            (xa, ya), (xb, yb) = nodos[a], nodos[b]
            d = math.hypot(xa - xb, ya - yb) * M_POR_UNIDAD
            aristas.append((a, b, d, hw))
    return nodos, aristas


def main():
    rng = np.random.default_rng(SEMILLA)
    nodos, aristas = cargar_calles()
    ady = {}
    for a, b, d, hw in aristas:
        ady.setdefault(a, []).append((b, d)); ady.setdefault(b, []).append((a, d))
    print(f'▶ LA CIUDAD · {len(nodos)} cruces · {len(aristas)} tramos de calle · {sum(d for _,_,d,_ in aristas)/1000:.1f} km')

    # ── LAS CALLES como líneas de campo: cada tramo es una línea de LP=4 puntos, con brillo por jerarquía.
    LP = 4
    lineas, brillo = [], []
    for a, b, d, hw in aristas:
        (xa, ya), (xb, yb) = nodos[a], nodos[b]
        t = np.linspace(0, 1, LP)
        lineas.append(np.stack([xa + (xb - xa) * t, ya + (yb - ya) * t, np.zeros(LP)], 1))
        brillo.append(np.full(LP, int(255 * TRANSITABLE[hw])))
    lineas = np.array(lineas, dtype=np.float32); brillo = np.array(brillo, dtype=np.uint8)
    NL = len(lineas)
    tramo_de = {}
    for e, (a, b, d, hw) in enumerate(aristas): tramo_de[(a, b)] = e; tramo_de[(b, a)] = e
    jerarquia = np.array([TRANSITABLE[hw] for _, _, _, hw in aristas], dtype=np.float32)

    # ── LOS NEGOCIOS: sobre las calles residenciales/terciarias, en proporción al largo del tramo.
    cand = [(i, d) for i, (a, b, d, hw) in enumerate(aristas) if hw in ('residential', 'tertiary', 'unclassified', 'living_street')]
    pesos_tramo = np.array([d for _, d in cand]); pesos_tramo /= pesos_tramo.sum()
    elegidos = rng.choice(len(cand), size=M, p=pesos_tramo)
    neg_xy = np.zeros((M, 2), dtype=np.float32); neg_nodo = np.zeros(M, dtype=np.int64)
    ids_nodo = list(nodos.keys())
    for j, e in enumerate(elegidos):
        a, b, d, hw = aristas[cand[e][0]]
        u = rng.random(); (xa, ya), (xb, yb) = nodos[a], nodos[b]
        neg_xy[j] = (xa + (xb - xa) * u, ya + (yb - ya) * u)
        neg_nodo[j] = a if u < 0.5 else b                       # el cruce por el que entra y sale su dinero

    # ── LA PAREJA DEL CAPÍTULO 1 (índices 0 y 1): Doña Lupe (1 mes) y Don Beto (3 meses), en el tramo
    # residencial de ≥40 m más cerca del centro de la colonia, a 40 % y 60 % de su largo (~27 m entre ellos).
    cx0 = np.mean([x for x, y in nodos.values()]); cy0 = np.mean([y for x, y in nodos.values()])
    mejor = None
    for i_c, d in cand:
        if d < 40: continue
        a, b, _, _ = aristas[i_c]; (xa, ya), (xb, yb) = nodos[a], nodos[b]
        dd = math.hypot((xa + xb) / 2 - cx0 + HERO_DX, (ya + yb) / 2 - cy0)
        if mejor is None or dd < mejor[0]: mejor = (dd, a, b)
    _, a, b = mejor; (xa, ya), (xb, yb) = nodos[a], nodos[b]
    neg_xy[0] = (xa + (xb - xa) * 0.4, ya + (yb - ya) * 0.4); neg_nodo[0] = a
    neg_xy[1] = (xa + (xb - xa) * 0.6, ya + (yb - ya) * 0.6); neg_nodo[1] = b
    HERO_C = ((neg_xy[0] + neg_xy[1]) / 2).copy()

    # ── A QUIÉN LE COMPRA cada negocio: vecinos cercanos, probabilidad ∝ exp(−d/450 m).
    dxy = neg_xy[:, None, :] - neg_xy[None, :, :]
    dist = np.hypot(dxy[..., 0], dxy[..., 1]) * M_POR_UNIDAD
    afin = np.exp(-dist / 450.0); np.fill_diagonal(afin, 0.0)

    # ── CAMINOS por la red real (Dijkstra acotado) — se cachean por (cruce origen, cruce destino).
    cache = {}
    def camino(s, t):
        if s == t: return [s]
        key = (s, t)
        if key in cache: return cache[key]
        dist_s, prev, pq = {s: 0.0}, {}, [(0.0, s)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == t: break
            if d > dist_s.get(u, 1e18) or d > 2500: continue
            for v, w in ady.get(u, []):
                nd = d + w
                if nd < dist_s.get(v, 1e18): dist_s[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
        if t not in prev: cache[key] = None; return None
        ruta = [t]
        while ruta[-1] != s: ruta.append(prev[ruta[-1]])
        ruta.reverse(); cache[key] = ruta; return ruta

    # ── LA ECONOMÍA, mes a mes. Cada negocio gasta 1 mes de gastos repartido en ~12 pagos a
    # vecinos; sus ventas son lo que le llega. La sequía entra por el sur (X bajo) en el mes 6 y
    # avanza hacia el norte: los negocios en la zona seca gastan la mitad.
    K = MESES * SUB + 1
    caja = np.full(M, COLCHON, dtype=np.float32); vivo = np.ones(M, dtype=bool)
    # --mezcla F: una fracción F de los negocios abre con 3 meses (para medir si el guardadito del
    # VECINO te protege a ti: se compara la supervivencia de los de 1 mes con y sin vecinos ricos)
    MEZCLA = arg('--mezcla', 0.5)
    ricos = rng.random(M) < MEZCLA; ricos[0] = False; ricos[1] = True; caja[ricos] = 3.0

    caja_k = np.zeros((K, M), dtype=np.float32); vivo_k = np.ones((K, M), dtype=bool)
    caja_k[0] = caja
    # partículas: cada una es un pago en viaje. Estado: ruta (lista de cruces), progreso en metros.
    pos = np.full((K, P, 3), np.nan, dtype=np.float32)
    libres = list(range(P)); en_viaje = {}                     # p → (ruta_xy (n,2), acum (n,), avance, destino j)
    PAGOS_MES = 10; monto = 1.0 / PAGOS_MES          # un mes de gastos = 1, guardes lo que guardes
    xs = neg_xy[:, 0]; x_min, x_max = xs.min(), xs.max()
    frente = lambda k: x_min + (x_max - x_min) * max(0.0, (k / SUB - 6.0) / 4.0)   # dónde va la sequía
    ventas_mes = np.zeros(M, dtype=np.float32); gasto_mes = np.zeros(M, dtype=np.float32)
    # EL TRÁFICO: cuántos pagos pasan por cada calle en cada cuadro. La calle brilla por lo que
    # REALMENTE corre por ella (principio del Wind Map): la sequía y los cierres la apagan solos.
    trafico = np.zeros((K, NL), dtype=np.float32)
    for k in range(K):
        # avanzar los pagos en viaje
        llegados = []
        for p, (rxy, acum, avance, j) in list(en_viaje.items()):
            avance += VEL; en_viaje[p] = (rxy, acum, avance, j)
            if avance >= acum[-1]:
                llegados.append(p); continue
            i = int(np.searchsorted(acum, avance)); i = max(1, min(i, len(acum) - 1))
            u = (avance - acum[i - 1]) / max(acum[i] - acum[i - 1], 1e-6)
            pos[k, p, :2] = rxy[i - 1] + (rxy[i] - rxy[i - 1]) * u
        for p in llegados: del en_viaje[p]; libres.append(p)
        # emitir pagos nuevos (cada negocio vivo manda PAGOS_MES pagos por mes, repartidos en los SUB cuadros)
        seco = xs < frente(k)
        emisores = np.where(vivo)[0]
        for i in emisores:
            n_pagos = rng.poisson(PAGOS_MES / SUB * (0.5 if seco[i] else 1.0))
            for _ in range(n_pagos):
                if not libres: break
                pa = afin[i] * vivo; s = pa.sum()
                if s <= 0: break
                j = int(rng.choice(M, p=pa / s))
                ruta = camino(int(neg_nodo[i]), int(neg_nodo[j]))
                if ruta is None: continue
                rxy = np.array([nodos[n] for n in ruta], dtype=np.float32)
                rxy = np.vstack([neg_xy[i], rxy, neg_xy[j]])
                acum = np.concatenate([[0.0], np.cumsum(np.hypot(np.diff(rxy[:, 0]), np.diff(rxy[:, 1])) * M_POR_UNIDAD)])
                p = libres.pop(); en_viaje[p] = (rxy, acum, 0.0, j)
                for sgi in range(1, len(ruta)):                  # cada tramo se enciende mientras la chispa lo cruza
                    e = tramo_de.get((ruta[sgi - 1], ruta[sgi]))
                    if e is None: continue
                    k0 = k + int(acum[sgi] // VEL); k1 = min(K, k + int(math.ceil(acum[sgi + 1] / VEL)) + 1)
                    if k0 < K: trafico[k0:k1, e] += 1.0
                gasto_mes[i] += monto; ventas_mes[j] += monto; pos[k, p, :2] = neg_xy[i]
        # cierre de mes: la caja
        if k % SUB == 0 and k > 0:
            ruido = 1.0 + SIGMA * rng.standard_normal(M)
            # REGLA DE LOS GEMELOS (declarada): mientras los dos vivan, Doña Lupe y Don Beto venden lo mismo,
            # gastan lo mismo y les toca la misma suerte. Lo ÚNICO distinto es lo que guardaron.
            if vivo[0] and vivo[1]:
                v = (ventas_mes[0] + ventas_mes[1]) / 2; g = (gasto_mes[0] + gasto_mes[1]) / 2
                ventas_mes[0] = ventas_mes[1] = v; gasto_mes[0] = gasto_mes[1] = g; ruido[1] = ruido[0]
            caja = caja + ventas_mes * np.maximum(0.0, ruido) - gasto_mes
            muertos = vivo & (caja < 0); vivo &= ~muertos; caja[~vivo] = np.nan
            ventas_mes[:] = 0; gasto_mes[:] = 0
            print(f'   mes {k // SUB:2d}: vivos {int(vivo.sum()):4d}/{M} · caja mediana {np.nanmedian(caja):.2f} · en viaje {len(en_viaje)}'
                  + (f' · de 1 mes vivos {100*vivo[~ricos].mean():.1f} % · de 3 meses {100*vivo[ricos].mean():.1f} %' if ricos.any() else ''))
        caja_k[k] = caja; vivo_k[k] = vivo
    mes_muere = lambda j: next((m for m in range(MESES + 1) if not vivo_k[m * SUB, j]), None)
    print(f'   PAREJA: Doña Lupe (1 mes) cierra en el mes {mes_muere(0)} · Don Beto (3 meses) {"cierra en el mes " + str(mes_muere(1)) if mes_muere(1) else "aguanta los 12"}')
    print(f'   COLONIA al mes 12: de 1 mes sobreviven {100*vivo_k[-1][~ricos].mean():.0f} % · de 3 meses {100*vivo_k[-1][ricos].mean():.0f} %')

    # ── LA NUBE: negocios (cúmulos ∝ caja) + dinero en viaje.
    nb = M * GLOW
    q = np.arange(GLOW)
    offs = rng.normal(0, 0.042, (GLOW, 3)).astype(np.float32); offs[:, 2] *= 0.2   # ~19 m: un negocio se lee como una mancha de luz
    NT = nb + P * (1 + ESTELA)
    posN = np.zeros((K, NT, 3), dtype=np.float32); vivoN = np.zeros((K, NT), dtype=bool)
    for k in range(K):
        n_luz = np.clip(np.nan_to_num(np.round(caja_k[k] * GLOW)), 0, GLOW * 3).astype(int)   # 1 mes guardado = GLOW luces
        base = np.repeat(np.concatenate([neg_xy, np.zeros((M, 1), dtype=np.float32)], 1), GLOW, 0) + np.tile(offs, (M, 1))
        posN[k, :nb] = base
        vivoN[k, :nb] = (np.tile(q, M) < np.repeat(n_luz, GLOW)) & np.repeat(vivo_k[k], GLOW)
        posN[k, nb:nb + P] = np.nan_to_num(pos[k], nan=0.0); vivoN[k, nb:nb + P] = ~np.isnan(pos[k, :, 0])
        for e in range(1, ESTELA + 1):                          # la estela: dónde estaba el peso hace e cuadros
            kk = max(0, k - e); a0 = nb + P * e
            posN[k, a0:a0 + P] = np.nan_to_num(pos[kk], nan=0.0)
            vivoN[k, a0:a0 + P] = ~np.isnan(pos[kk, :, 0]) & ~np.isnan(pos[k, :, 0])
    col = np.zeros((NT, 3), dtype=np.uint8)
    col[:nb] = np.repeat(np.where(ricos[:, None], np.array([[205, 228, 255]]), np.array([[255, 196, 96]])), GLOW, 0)   # 1 mes = oro · 3 meses = hielo
    col[nb:nb + P] = [255, 200, 90]
    for e in range(1, ESTELA + 1): col[nb + P * e:nb + P * (e + 1)] = [int(255 * (0.55 ** e)), int(170 * (0.55 ** e)), int(50 * (0.55 ** e))]
    posN[..., 0] -= HERO_C[0]; posN[..., 1] -= HERO_C[1]; lineas[..., 0] -= HERO_C[0]; lineas[..., 1] -= HERO_C[1]
    ext = max(abs(posN[..., :2]).max(), abs(lineas[..., :2]).max()) * 1.02
    posq = 32767 / ext
    qz = np.clip(np.round(posN * posq), -32767, 32767).astype('<i2'); qz[~vivoN] = CENTINELA
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', NT, 0, 0, K, 0, 0, 0))
        fp.write(struct.pack('<3f', float(posq), 0.0, 1.0))
        fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())
        fp.write(vivo_k.mean(axis=1).astype('<f4').tobytes())
        fp.write(col.tobytes()); fp.write(qz.tobytes())
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.2f} MB · {nb} luces de negocio + {P} pesos × (1+{ESTELA}) · {K} cuadros')
    # las calles: K cuadros (mismo reloj que la nube). Posición fija; BRILLO = la base de la
    # jerarquía (la ciudad siempre se lee) + el tráfico real suavizado (se enciende y se apaga lento).
    # arranque en régimen: la colonia ya existía antes del primer cuadro, así que la estela de las
    # calles empieza con el tráfico típico del mes 1 (si no, el cuadro 0 —el gancho— sale apagado).
    suave = np.zeros_like(trafico); acc_t = trafico[SUB:2 * SUB].mean(axis=0) / (1 - 0.78)
    for k in range(K): acc_t = 0.78 * acc_t + trafico[k]; suave[k] = acc_t
    ref = np.percentile(suave[suave > 0], 92) if (suave > 0).any() else 1.0
    flujo = np.clip(suave / ref, 0, 1) ** 0.7
    brillo_k = np.clip(255 * (0.16 * jerarquia[None] + 0.84 * flujo * (0.45 + 0.55 * jerarquia[None])), 0, 255).astype(np.uint8)
    q16 = np.clip(np.round(lineas * 2000), -32767, 32767).astype('<i2')
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL, LP)); fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())
        for _ in range(K): fp.write(q16.tobytes())
        for k in range(K): fp.write(np.repeat(brillo_k[k][:, None], LP, 1).tobytes())
    enc = [(brillo_k[m * SUB] > 90).mean() for m in range(MESES + 1)]
    print(f'OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB · {NL} tramos · calles encendidas por mes: ' + ' '.join(f'{100*e:.0f}%' for e in enc))
    json.dump({'lectura': 'LA CIUDAD DE NOCHE: calles reales (OSM, Chimalhuacán), negocios sobre las calles, dinero que viaja del que paga al que cobra por el camino más corto; caja = cobrado − gastado (ruina del jugador, margen 0); el contagio emerge',
               'caja_bbox': [LON0, LAT0, LON1, LAT1], 'm_por_unidad': M_POR_UNIDAD, 'cruces': len(nodos), 'tramos': NL, 'negocios': M, 'pesos': P,
               'meses': MESES, 'sub': SUB, 'K': K, 'sigma': SIGMA, 'colchon': COLCHON, 'sequia': 'entra por el sur en el mes 6 y cruza la colonia en 4 meses; gasto a la mitad en la zona seca',
               'vivos_por_mes': [int(vivo_k[m * SUB].sum()) for m in range(MESES + 1)], 'semilla': SEMILLA,
               'mezcla': MEZCLA, 'sobreviven_12m': {'1_mes': round(float(vivo_k[-1][~ricos].mean()), 3), '3_meses': round(float(vivo_k[-1][ricos].mean()), 3)},
               'pareja': {'lupe_mes_cierre': mes_muere(0), 'beto_mes_cierre': mes_muere(1), 'centro_escena': [float(HERO_C[0]), float(HERO_C[1])], 'regla': 'gemelos: mismas ventas, gastos y suerte mientras vivan los dos'},
               'fuente_calles': 'OpenStreetMap contributors (ODbL) vía Overpass API, 2026-09-17'}, open(OUT_JSON, 'w'), indent=1, ensure_ascii=False)
    print(f'OK  {OUT_JSON}')


if __name__ == '__main__':
    main()
