#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""LA CASETA DE NOCHE — conos JA-VAZ #7, sobre el lenguaje de «La ciudad de noche».

Por qué (ian, 2026-10-15: «son más importantes los videos de los conos… va dale»). Beats de la sesión
de polinización (conos/escenas/07-caseta-noche.json) con la dirección acordada: calles REALES como campo
frío, autos como chispas, la torre de color como la ÚNICA luz con color, cero figuras humanas.

LO REAL:
  · CALLES: OpenStreetMap (Overpass, way["highway"]) de Juriquilla, Querétaro, bajadas 2026-10-15
    (public/precomputed/osm-juriquilla-calles.json). Los condominios que compran torres están sobre todo
    en Querétaro (CP 76xxx, ANALISIS-CONOS). Sin nombre de privado ni de cliente.
  · LA PLUMA: nodo OSM 8636180821 (barrier=lift_gate, 20.6969826 N, −100.4402306) = el origen de la
    escena. La otra pluma real (8367089324, 42 m al norte) también se dibuja. La caseta y su lámpara
    van JUNTO a la pluma: ubicación ILUSTRATIVA (OSM no trae la caseta).
  · LA TORRE: plano TORR-1340PX3 (ATLAS): alto 11.8 cm sin pestaña, pestaña de 21.4 cm por lado, pirámide
    de 3 caras con hueco de 2 cm. El «16.00 cm» del plano no cuadra con un equilátero de 21.4 (sería 18.5):
    se marca dudoso. Base del cuerpo 15 cm (entre los 14.5 y 16 del plano) y tapa de 3.5 cm (foto).
    Va EN EL TOLDO (ficha del producto).
  · LA LUZ: la torre NO es reflejante (no hay dato de que lo sea). Su color existe sólo donde la toca la
    lámpara de la caseta: iluminancia de una fuente puntual a altura h sobre un plano horizontal,
    E ∝ (h−z)/(d²+(h−z)²)^{3/2} (ley del inverso del cuadrado × coseno). Los faros alumbran hacia
    adelante y abajo (la mancha en el piso cae como 1/d²): deslumbran, pero no alumbran el toldo.
  · LOS COLORES: medidos de las fotos reales de ATLAS (conos-paleta-torres.json, polinización), cruzados
    con mi medición del 15-oct (±10 por canal). Cara iluminada = hex_cara_iluminada; sombra = hex_dominante.
  · LOS AUTOS: viajes al azar sobre la red real (Dijkstra), velocidad por tipo de calle; los héroes hacen
    fila con frenado real (≤3 m/s²) y paran en la línea de alto hasta que la pluma sube.

LICENCIAS DECLARADAS: el tráfico de fondo es una muestra ilustrativa (no hay aforo de Juriquilla a las 11 pm);
qué significa cada color, el número de casa y la regla «sin torre, se pregunta» son EJEMPLO (rotulado).

Salida: public/precomputed/conos-caseta.bin (WAP2) + conos-caseta-efield.bin + conos-caseta.json (incluye
el RELOJ video→cuadro que se pega en CinematicMolecule.tsx).
  python3 scripts/precompute-caseta.py
"""
import os, sys, json, struct, math, heapq
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = os.path.join(ROOT, 'public', 'precomputed')
OUT = os.path.join(PRE, 'conos-caseta.bin'); OUT_EF = OUT.replace('.bin', '-efield.bin'); OUT_JSON = OUT.replace('.bin', '.json')
CALLES = os.path.join(PRE, 'osm-juriquilla-calles.json')
PALETA = os.path.join(PRE, 'conos-paleta-torres.json')
SEMILLA = 7
rng = np.random.default_rng(SEMILLA)

LAT0, LON0 = 20.6969826, -100.4402306          # la pluma (nodo OSM 8636180821) = origen
GATE_NODE, GATE2_NODE = 8636180821, 8367089324
M_POR_UNIDAD = 400.0                            # 1 unidad de escena = 400 m (plano general ≈ 1.3 km de alto)
MITAD_N, MITAD_E = 1300.0, 760.0                # caja 9:16 (m) alrededor de la pluma
CENTINELA = -32768
DT_OUT = 0.5                                    # s de simulación por cuadro del bin
DT = 0.1                                        # paso de integración
VEL = {'trunk': 17.0, 'trunk_link': 11.0, 'primary': 14.0, 'primary_link': 10.0, 'secondary': 13.0, 'secondary_link': 9.0,
       'tertiary': 11.0, 'tertiary_link': 8.0, 'unclassified': 9.0, 'residential': 7.0, 'living_street': 4.0, 'service': 5.0}
JER = {'trunk': 1.0, 'trunk_link': 0.8, 'primary': 1.0, 'primary_link': 0.8, 'secondary': 0.9, 'secondary_link': 0.7,
       'tertiary': 0.7, 'tertiary_link': 0.6, 'unclassified': 0.45, 'residential': 0.42, 'living_street': 0.4, 'service': 0.25}
N_FONDO = 140                                   # autos de fondo simultáneos (ilustrativo: noche de entre semana)
H_LAMP = 5.0                                    # altura de la lámpara de la caseta (m)


def proy(lat, lon):
    return ((lat - LAT0) * 110540.0, (lon - LON0) * 111320.0 * math.cos(math.radians(LAT0)))   # (norte, este) en m


# ───────────────────────── la red real ─────────────────────────
def cargar():
    d = json.load(open(CALLES, encoding='utf-8'))
    nodos, aristas = {}, []
    for w in d['elements']:
        if w['type'] != 'way': continue
        hw = w.get('tags', {}).get('highway')
        if hw not in VEL: continue
        for nid, g in zip(w['nodes'], w['geometry']):
            nodos.setdefault(nid, proy(g['lat'], g['lon']))
        for a, b in zip(w['nodes'], w['nodes'][1:]):
            (xa, ya), (xb, yb) = nodos[a], nodos[b]
            dentro = lambda x, y: abs(x) <= MITAD_N * 1.15 and abs(y) <= MITAD_E * 1.15
            if not (dentro(xa, ya) or dentro(xb, yb)): continue
            aristas.append((a, b, math.hypot(xa - xb, ya - yb), hw, w['id']))
    return nodos, aristas


def dijkstra(ady, s, t, prohibidas=frozenset()):
    dist, prev, pq = {s: 0.0}, {}, [(0.0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t: break
        if d > dist.get(u, 1e18): continue
        for v, w, wid in ady.get(u, []):
            if wid in prohibidas: continue
            nd = d + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(pq, (nd, v))
    if t != s and t not in prev: return None
    r = [t]
    while r[-1] != s: r.append(prev[r[-1]])
    return r[::-1]


class Ruta:
    """polilínea en metros con velocidad por tramo; pos(s) y rumbo(s) por longitud de arco."""
    def __init__(self, xy, v=None):
        self.xy = np.asarray(xy, dtype=np.float64)
        seg = np.hypot(*np.diff(self.xy, axis=0).T)
        keep = np.concatenate([[True], seg > 1e-6]); self.xy = self.xy[keep]
        seg = np.hypot(*np.diff(self.xy, axis=0).T)
        self.acum = np.concatenate([[0.0], np.cumsum(seg)]); self.L = self.acum[-1]
        self.v = np.asarray(v if v is not None else np.full(len(seg), 7.0))[: len(seg)] if len(seg) else np.array([7.0])

    def _i(self, s):
        return max(1, min(int(np.searchsorted(self.acum, s)), len(self.acum) - 1))

    def pos(self, s):
        s = min(max(s, 0.0), self.L); i = self._i(s)
        u = (s - self.acum[i - 1]) / max(self.acum[i] - self.acum[i - 1], 1e-9)
        return self.xy[i - 1] + (self.xy[i] - self.xy[i - 1]) * u

    def rumbo(self, s):
        i = self._i(min(max(s, 0.0), self.L)); d = self.xy[i] - self.xy[i - 1]
        return d / max(np.hypot(*d), 1e-9)

    def vmax(self, s):
        return float(self.v[min(self._i(s) - 1, len(self.v) - 1)])


# ───────────────────────── la torre (plano TORR-1340PX3) ─────────────────────────
def torre_superficie(n, rng_):
    """puntos (m) sobre la torre: eje = +a (alto), base en el plano (b, c). Devuelve pts, cara (0,1,2 = laterales,
    3 = pestaña), (u, v) de la cara para el número. Medidas del plano: alto 0.118, base del cuerpo 0.15,
    tapa 0.035, pestaña 0.214 por lado, 2 mm de espesor."""
    H, B, T, F = 0.118, 0.150, 0.035, 0.214
    rb, rt, rf = B / math.sqrt(3), T / math.sqrt(3), F / math.sqrt(3)          # circunradios
    ang = [math.radians(90 + 120 * i) for i in range(3)]
    vb = [np.array([rb * math.cos(a), rb * math.sin(a)]) for a in ang]
    vt = [np.array([rt * math.cos(a), rt * math.sin(a)]) for a in ang]
    vf = [np.array([rf * math.cos(a), rf * math.sin(a)]) for a in ang]
    # área por cara lateral (trapecio) y pestaña (triángulo grande − base)
    alt_inc = math.hypot(H, (rb - rt) * 0.5)
    a_lat = 0.5 * (B + T) * alt_inc
    a_pes = (math.sqrt(3) / 4) * (F ** 2 - B ** 2)
    w = np.array([a_lat] * 3 + [a_pes]); w /= w.sum()
    caras = rng_.choice(4, size=n, p=w)
    pts = np.zeros((n, 3)); uv = np.zeros((n, 2))
    for i in range(n):
        c = caras[i]
        if c < 3:
            j, k = c, (c + 1) % 3
            # muestreo uniforme en área del trapecio: la anchura decrece lineal con la altura
            wb, wt = B, T
            v = (wb - math.sqrt(wb * wb - rng_.random() * (wb * wb - wt * wt))) / (wb - wt)
            u = rng_.random()
            p0 = vb[j] + (vt[j] - vb[j]) * v; p1 = vb[k] + (vt[k] - vb[k]) * v
            q = p0 + (p1 - p0) * u
            pts[i] = (H * v, q[0], q[1]); uv[i] = (u, v)
        else:
            while True:                                                      # anillo de la pestaña
                r1, r2 = rng_.random(), rng_.random()
                if r1 + r2 > 1: r1, r2 = 1 - r1, 1 - r2
                q = vf[0] + (vf[1] - vf[0]) * r1 + (vf[2] - vf[0]) * r2
                # ¿fuera del triángulo del cuerpo? (baricéntricas contra vb)
                M = np.array([vb[1] - vb[0], vb[2] - vb[0]]).T; l = np.linalg.solve(M, q - vb[0])
                if l[0] < 0 or l[1] < 0 or l[0] + l[1] > 1: break
            pts[i] = (0.002, q[0], q[1]); uv[i] = (-1, -1)
    return pts, caras, uv


def normales_caras():
    H, B, T = 0.118, 0.150, 0.035
    rb, rt = B / math.sqrt(3), T / math.sqrt(3)
    ang = [math.radians(90 + 120 * i) for i in range(3)]
    out = []
    for j in range(3):
        k = (j + 1) % 3
        P = lambda r, a, h: np.array([h, r * math.cos(a), r * math.sin(a)])
        A, Bp, C = P(rb, ang[j], 0), P(rb, ang[k], 0), P(rt, ang[j], H)
        n = np.cross(Bp - A, C - A); n /= np.linalg.norm(n)
        cen = (A + Bp) / 2; n = n if np.dot(n, np.array([0, cen[1], cen[2]])) > 0 else -n
        out.append(n)
    out.append(np.array([1.0, 0, 0]))
    return out


def mascara_digito(texto):
    """máscara 2D del número (u, v ∈ [0,1]) rasterizada con la tipografía del sistema."""
    from PIL import Image, ImageDraw, ImageFont
    W = 256; im = Image.new('L', (W, W), 0); dr = ImageDraw.Draw(im)
    fuente = None
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']:
        if os.path.exists(f): fuente = ImageFont.truetype(f, 150); break
    fuente = fuente or ImageFont.load_default()
    bb = dr.textbbox((0, 0), texto, font=fuente); tw, th = bb[2] - bb[0], bb[3] - bb[1]
    dr.text(((W - tw) / 2 - bb[0], (W - th) / 2 - bb[1]), texto, fill=255, font=fuente)
    return np.asarray(im) > 128


def colores_torre(caras, uv, sku, paleta, luz, digito=None, ilum_min=0.0):
    """color por punto: Lambert con la luz `luz` entre la sombra medida (dominante ×0.55) y la cara iluminada medida."""
    p = paleta[sku]; hx = lambda h: np.array([int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)], dtype=np.float64)
    lit, dom = hx(p['hex_cara_iluminada']), hx(p['hex'])
    ns = normales_caras(); col = np.zeros((len(caras), 3))
    for i, c in enumerate(caras):
        lam = max(ilum_min, float(np.dot(ns[c], luz)))
        col[i] = dom * 0.55 + (lit - dom * 0.55) * min(1.0, lam / 0.85)
    if digito is not None:
        mask, oscuro = digito
        for i, c in enumerate(caras):
            if c not in (0, 2) or uv[i, 0] < 0: continue                      # el número va en las 2 caras de frente (normales a 150° y 30°; la 1 mira atrás)
            u, v = uv[i]
            # el número ocupa el centro de la cara: v 0.12-0.80, u 0.2-0.8 (como en las fotos)
            uu, vv = (u - 0.18) / 0.64, (v - 0.10) / 0.70
            if 0 <= uu < 1 and 0 <= vv < 1:
                if mask[int((1 - vv) * 255), int(uu * 255)]:
                    col[i] = (24, 22, 26) if oscuro else (236, 236, 232)
    # COMPENSACIÓN DE DISPLAY (medida 2026-10-16): el motor (salida lineal + postFX + grade) eleva las razones de
    # color a ≈1.8 — la torre naranja #D65826 (G/R 0.41) salía en pantalla con G/R 0.19 (rojo). Se pre-compensa con
    # el inverso para que lo que se VE mida el hex de la foto. No cambia el color medido: cambia cómo se le entrega al motor.
    # exponente interpolado entre tres mediciones (1.0 → G/R 0.19 · 0.72 → 0.54 · 0.556 → 0.66; meta 0.41 → 0.80)
    col = 255.0 * (np.clip(col, 0, 255) / 255.0) ** 0.80
    return np.clip(col, 0, 255).astype(np.uint8)


# los números: negro sobre colores claros, blanco sobre oscuros (como vienen en las fotos de ATLAS)
DIGITO_OSCURO = {'TORR-AC': True, 'TORR-AM': True, 'TORR-NA': True, 'TORR-RS': True, 'TORR-VL': True, 'TORR-BL': True,
                 'TORR-AZ': False, 'TORR-CA': False, 'TORR-GR': False, 'TORR-MO': False, 'TORR-NE': False, 'TORR-RO': False, 'TORR-VE': False}


def main():
    paleta = json.load(open(PALETA, encoding='utf-8'))
    nodos, aristas = cargar()
    ady = {}
    for a, b, d, hw, wid in aristas:
        ady.setdefault(a, []).append((b, d, wid)); ady.setdefault(b, []).append((a, d, wid))
    hwde = {}
    for a, b, d, hw, wid in aristas: hwde[(a, b)] = hw; hwde[(b, a)] = hw
    g = nodos[GATE_NODE]; print(f'▶ LA CASETA · {len(nodos)} nodos · {len(aristas)} tramos · pluma en {g}')

    # el camino de la pluma: el tramo de servicio que la contiene (way 931538429) queda SOLO para los héroes
    via_pluma = {wid for a, b, d, hw, wid in aristas if GATE_NODE in (a, b)}
    print(f'   vía de la pluma: {via_pluma}')

    # ── LA RUTA DE LOS HÉROES: desde la avenida (≈450 m al sur, sobre trunk/secondary) hasta la pluma y adentro.
    def cerca(x, y, tipos):
        best = None
        for a, b, d, hw, wid in aristas:
            if hw not in tipos: continue
            for n in (a, b):
                xn, yn = nodos[n]; dd = math.hypot(xn - x, yn - y)
                if best is None or dd < best[0]: best = (dd, n)
        return best[1]
    w_pluma = [w for w in json.load(open(CALLES, encoding='utf-8'))['elements'] if w['type'] == 'way' and w['id'] in via_pluma][0]
    ns_pl = w_pluma['nodes']
    # orientación: entrar desde el extremo pegado a la avenida (el más al este)
    if nodos[ns_pl[0]][1] < nodos[ns_pl[-1]][1]: ns_pl = ns_pl[::-1]
    entrada, salida = ns_pl[0], ns_pl[-1]
    ini = cerca(-1150.0, nodos[entrada][1] + 30.0, ('trunk', 'trunk_link', 'secondary', 'primary'))
    r1 = dijkstra(ady, ini, entrada, prohibidas=frozenset(via_pluma))
    # OSM CORTA la vía de la pluma 25 m después del brazo (nodo 8636180819 sin conexión: mapeo incompleto).
    # Se une en línea recta a la calle residencial más cercana (declarado en el .json).
    union = cerca(nodos[salida][0], nodos[salida][1], ('residential',))
    dentro_obj = cerca(nodos[salida][0] + 60.0, nodos[salida][1] - 260.0, ('residential',))
    r3 = [salida] + dijkstra(ady, union, dentro_obj, prohibidas=frozenset(via_pluma))
    print(f'   unión recta: {math.hypot(*(np.array(nodos[union]) - np.array(nodos[salida]))):.0f} m hasta la residencial {union}')
    ruta_ids = r1 + ns_pl[1:] + r3[1:]
    xy = [nodos[n] for n in ruta_ids]
    vv = [VEL.get(hwde.get((a, b), 'service'), 6.0) for a, b in zip(ruta_ids, ruta_ids[1:])]
    RH = Ruta(xy, vv)
    s_pluma = RH.acum[ruta_ids.index(GATE_NODE)]
    rumbo_pluma = RH.rumbo(s_pluma)
    perp = np.array([-rumbo_pluma[1], rumbo_pluma[0]])
    print(f'   ruta héroe: {RH.L:.0f} m · la pluma a {s_pluma:.0f} m · rumbo {rumbo_pluma}')
    # caseta: 4.5 m al lado izquierdo de la pluma (del lado del brazo), lámpara a 5 m de alto
    CASETA = np.array(g) + perp * 4.5
    S_ALTO = s_pluma - 3.0                       # la defensa del auto para aquí (3 m antes del brazo)

    # ── TIEMPOS (s de simulación). El reloj del video los recorre: 0-56 s rápido (plano general y bajada),
    # 56-80 s a tiempo real en la pluma (video 10-27 y 33-42). Ver RELOJ abajo.
    T_SIM = 80.0
    K_A = int(round(73.0 / DT_OUT)) + 1          # cuadros 0..146 = sim 0..73
    HEROES = [  # sku, llegada deseada a la línea de alto (s), sale cuando la pluma sube (s)
        {'sku': 'TORR-NA', 'llega': 57.0, 'sube': 62.5},
        {'sku': 'TORR-AZ', 'llega': 65.0, 'sube': 67.5},
        {'sku': 'TORR-VE', 'llega': 69.5, 'sube': 73.2},
        {'sku': None,      'llega': 76.0, 'sube': 1e9},     # sin torre: se detiene y parpadea (EJEMPLO)
    ]
    # LA PLUMA: ángulo (rad) en el tiempo. Sube en 1.4 s, espera, baja en 1.6 s detrás de cada auto.
    def pluma_ang(t):
        a = 0.0
        for h in HEROES:
            if h['sube'] > 1e8: continue
            t0 = h['sube']
            if t0 <= t < t0 + 1.4: a = max(a, (t - t0) / 1.4)
            elif t0 + 1.4 <= t < t0 + 3.6: a = 1.0
            elif t0 + 3.6 <= t < t0 + 5.2: a = max(a, 1 - (t - t0 - 3.6) / 1.6)
        return a * math.radians(82)

    # ── HÉROES: fila con frenado real. Cada auto: s(t) de su defensa delantera.
    LARGO = 4.5; GAP = 2.5; A_MAX, B_MAX = 2.2, 3.0
    nT = int(T_SIM / DT) + 1
    s_h = np.zeros((len(HEROES), nT)); v_h = np.zeros(len(HEROES))
    # arranque: el punto de salida de cada auto se busca (bisección) para que, solo y a velocidad de vía,
    # llegue a la línea de alto en su segundo 'llega'. Luego la fila real (el de adelante manda) corre encima.
    def llegada_solo(s0):
        s, v = s0, RH.vmax(s0) * 0.9
        for it in range(1, nT):
            vdes = RH.vmax(s) * (0.55 if abs(s - s_pluma) < 60 else 1.0)
            v_freno = math.sqrt(max(0.0, 2 * B_MAX * max(S_ALTO - s - 0.3, 0.0)))
            v = max(0.0, v + max(-B_MAX * 1.6 * DT, min(A_MAX * DT, min(vdes, v_freno) - v)))
            s += v * DT
            if s >= S_ALTO - 0.6: return it * DT
        return 1e9
    for i, h in enumerate(HEROES):
        lo, hi = -2000.0, S_ALTO - 5.0
        for _ in range(40):
            mid_ = (lo + hi) / 2
            if llegada_solo(mid_) > h['llega']: lo = mid_
            else: hi = mid_
        s_h[i, 0] = hi; v_h[i] = RH.vmax(max(hi, 0.0)) * 0.9
    for it in range(1, nT):
        t = it * DT
        for i, h in enumerate(HEROES):
            s = s_h[i, it - 1]; v = v_h[i]
            limite = 1e9
            if t < h['sube'] + 0.6: limite = S_ALTO                                  # pluma abajo: alto
            if i > 0: limite = min(limite, s_h[i - 1, it - 1] - LARGO - GAP)        # el de adelante
            # no llegar antes de tiempo: la velocidad deseada se ajusta para llegar a 'llega'
            vdes = RH.vmax(s) * (0.55 if abs(s - s_pluma) < 60 else 1.0)
            d_lim = limite - s
            v_freno = math.sqrt(max(0.0, 2 * B_MAX * max(d_lim - 0.3, 0.0)))
            vobj = min(vdes, v_freno)
            dv = vobj - v
            v = v + max(-B_MAX * 1.6 * DT, min(A_MAX * DT, dv))
            v = max(0.0, v)
            s = min(s + v * DT, max(s, limite)) if d_lim > 0 else s
            s_h[i, it] = s; v_h[i] = v
    it_dbg = int(57.5 / DT)
    print(f'   DEBUG sim 57.5: caseta {CASETA.round(1)} · pluma {np.array(g)} · ' + ' · '.join(f"{h['sku']}: centro {RH.pos(s_h[i, it_dbg] - LARGO / 2).round(1)}" for i, h in enumerate(HEROES)))
    for i, h in enumerate(HEROES):
        k_alto = int(np.argmax(s_h[i] >= S_ALTO - 1.0))
        print(f'   héroe {h["sku"] or "SIN TORRE"}: en la línea de alto a los {k_alto * DT:.1f} s · s final {s_h[i, -1]:.0f}/{RH.L:.0f} m')

    # ── FONDO: viajes al azar sobre la red real (sin la vía de la pluma).
    mayores = [n for a, b, d, hw, wid in aristas if hw in ('trunk', 'secondary', 'tertiary', 'primary', 'trunk_link') for n in (a, b)]
    todos = [n for a, b, d, hw, wid in aristas if wid not in via_pluma for n in (a, b)]
    def viaje():
        for _ in range(40):
            s = int(rng.choice(mayores if rng.random() < 0.7 else todos)); t = int(rng.choice(mayores if rng.random() < 0.6 else todos))
            if s == t: continue
            r = dijkstra(ady, s, t, prohibidas=frozenset(via_pluma))
            if r and len(r) > 3:
                return Ruta([nodos[n] for n in r], [VEL.get(hwde.get((a, b), 'service'), 6.0) for a, b in zip(r, r[1:])])
        return None
    fondo = []
    for _ in range(N_FONDO):
        R = viaje(); fondo.append([R, rng.random() * R.L])                         # arranque en régimen: cuadro 0 ya poblado
    K_SIM = int(T_SIM / DT_OUT) + 1
    pf = np.full((K_SIM, N_FONDO, 2), np.nan); hf = np.zeros((K_SIM, N_FONDO, 2))
    sub = int(round(DT_OUT / DT))
    for it in range(int(T_SIM / DT) + 1):
        if it % sub == 0:
            k = it // sub
            for c, (R, s) in enumerate(fondo):
                pf[k, c] = R.pos(s); hf[k, c] = R.rumbo(s)
        for c in range(N_FONDO):
            R, s = fondo[c]; s += R.vmax(s) * (0.8 + 0.2 * math.sin(c)) * DT
            if s >= R.L: R = viaje(); s = 0.0
            fondo[c] = [R, s]

    # ── LA LUZ DE LA LÁMPARA
    def E(xy, z):  # iluminancia relativa sobre plano horizontal a altura z
        d2 = float(np.sum((np.asarray(xy) - CASETA) ** 2)); hh = H_LAMP - z
        return hh / (d2 + hh * hh) ** 1.5
    pos_alto = RH.pos(S_ALTO - LARGO * 0.45)
    E_REF = E(pos_alto, 1.55)                     # la torre de un auto parado en la línea de alto = luz plena
    OFF = np.asarray(pos_alto, dtype=np.float64)   # el teleobjetivo mira AQUÍ (el auto), no a la pluma

    # ────────────────── LAS PARTÍCULAS (en metros; el eje X = norte = vertical del cuadro) ──────────────────
    grupos = []   # (nombre, n, color(n,3) uint8)
    def grupo(nombre, n, col):
        col = np.asarray(col, dtype=np.uint8)
        if col.ndim == 1: col = np.tile(col, (n, 1))
        grupos.append((nombre, n, col)); return sum(g_[1] for g_ in grupos) - n

    # fondo: 2 faros (8 c/u), mancha de los faros (30), calaveras (2×4), estela de faros (3 fantasmas × 16)
    FH, FB, FT, EST = 8, 30, 4, 3
    o_ff = grupo('fondo-faros', N_FONDO * 2 * FH, (255, 246, 228))
    o_fb = grupo('fondo-mancha', N_FONDO * FB, (96, 90, 78))
    o_ft = grupo('fondo-calaveras', N_FONDO * 2 * FT, (210, 26, 18))
    o_fe = [grupo(f'fondo-estela{e}', N_FONDO * 2 * FH, tuple(int(c * 0.5 ** e) for c in (255, 236, 200))) for e in range(1, EST + 1)]
    # héroes: faros 2×40, mancha 220, calaveras 2×14, carrocería 260 (sólo bajo la lámpara), torre 260
    HH, HB, HT, HC, HTO = 40, 220, 14, 260, 700
    o_h = []
    luz_toldo = np.array([0.55, -0.25, 0.80]); luz_toldo /= np.linalg.norm(luz_toldo)   # la lámpara, vista desde la fila
    for i, h in enumerate(HEROES):
        d = {}
        d['faros'] = grupo(f'h{i}-faros', 2 * HH, (255, 248, 232))
        d['mancha'] = grupo(f'h{i}-mancha', HB, (110, 103, 90))
        d['cal'] = grupo(f'h{i}-calaveras', 2 * HT, (225, 30, 20))
        d['carro'] = grupo(f'h{i}-carroceria', HC, (78, 80, 86))
        if h['sku']:
            tp, tc, tuv = torre_superficie(HTO, rng)
            d['torre_pts'] = tp
            d['torre'] = grupo(f'h{i}-torre', HTO, colores_torre(tc, tuv, h['sku'], paleta, luz_toldo, ilum_min=0.25))
            d['orden_torre'] = rng.permutation(HTO)
        d['orden_carro'] = rng.permutation(HC)
        o_h.append(d)
    # la caseta y su luz
    NPOOL, NBULB, NCAS, NPL = 9000, 60, 260, 70
    o_pool = grupo('lampara-piso', NPOOL, (50, 40, 27))           # tenue y denso: la mancha se lee continua (v1 = confeti dorado)
    o_bulb = grupo('lampara', NBULB, (255, 226, 170))
    o_cas = grupo('caseta', NCAS, (92, 88, 82))
    pl_col = np.array([(225, 40, 32) if (j // 7) % 2 == 0 else (235, 232, 226) for j in range(NPL)])
    o_pl1 = grupo('pluma', NPL, pl_col); o_pl2 = grupo('pluma-norte', NPL, pl_col)
    # la vitrina: torre grande (25-33 s y cierre), abanico de 13 colores (42-50 s), rejilla de 100 (50-56 s)
    NBIG = 22000
    bt, bc, buv = torre_superficie(NBIG, rng)
    luz_vit = np.array([0.45, -0.55, 0.70]); luz_vit /= np.linalg.norm(luz_vit)
    # 22 mil puntos (el número se lee) ×0.42 con el color compensado (el rojo de v4-v7 era el display, no la suma): con 22 mil puntos en cuadro lleno la suma aditiva quemaba el naranja a rojo-amarillo (stills v1)
    o_big = grupo('vitrina-torre-NA', NBIG, (colores_torre(bc, buv, 'TORR-NA', paleta, luz_vit, digito=(mascara_digito('12'), True), ilum_min=0.08) * 0.42).astype(np.uint8))
    SKUS = ['TORR-AM', 'TORR-VE', 'TORR-AZ', 'TORR-RO', 'TORR-NA', 'TORR-BL', 'TORR-NE', 'TORR-VL', 'TORR-AC', 'TORR-RS', 'TORR-MO', 'TORR-CA', 'TORR-GR']
    NFAN = 900
    o_fan = []
    fan_pts = []
    for j, sku in enumerate(SKUS):
        tp, tc, tuv = torre_superficie(NFAN, rng)
        o_fan.append(grupo(f'abanico-{sku}', NFAN, colores_torre(tc, tuv, sku, paleta, luz_vit, digito=(mascara_digito(str(j + 1)), DIGITO_OSCURO[sku]), ilum_min=0.10)))
        fan_pts.append(tp)
    NGR = 110
    gr_pts, gr_c, gr_uv = torre_superficie(NGR, rng)
    orden_col = [SKUS[(j * 5) % 13] for j in range(100)]                             # colores ILUSTRATIVOS
    o_grid = [grupo(f'rejilla-{j}', NGR, colores_torre(gr_c, gr_uv, orden_col[j], paleta, luz_vit, ilum_min=0.15)) for j in range(100)]
    NT = sum(g_[1] for g_ in grupos)
    col = np.concatenate([g_[2] for g_ in grupos]).astype(np.uint8)
    print(f'   {NT} partículas: ' + ' · '.join(f'{n}:{c}' for n, c, _ in grupos[:4]) + ' …')

    # ────────────────── LOS CUADROS ──────────────────
    U = 1.0 / M_POR_UNIDAD
    frames = []          # cada uno: (pos (NT,3) en unidades, vivo (NT,), brillo_calles escalar, nombre)

    # puntos fijos del entorno (en metros)
    # inversa de la CDF de E(r)·2πr con E ∝ h/(r²+h²)^1.5: la densidad de puntos en el piso ES la iluminancia
    q_ = 1.0 / H_LAMP - rng.random(NPOOL) * (1.0 / H_LAMP - 1.0 / math.hypot(18.0, H_LAMP))
    rr = np.sqrt(np.maximum(0.0, 1.0 / q_ ** 2 - H_LAMP ** 2))
    th = rng.random(NPOOL) * 2 * math.pi
    pool = np.stack([CASETA[0] + rr * np.cos(th), CASETA[1] + rr * np.sin(th), np.zeros(NPOOL)], 1)
    bulb = np.concatenate([CASETA + rng.normal(0, 0.12, (NBULB, 2)), np.full((NBULB, 1), H_LAMP)], 1)
    lado = np.linspace(-1.25, 1.25, NCAS // 4)
    cas2 = np.concatenate([np.stack([lado, np.full_like(lado, s)], 1) for s in (-1.25, 1.25)] + [np.stack([np.full_like(lado, s), lado], 1) for s in (-1.25, 1.25)])
    cas = np.concatenate([CASETA + cas2[:, [0, 1]] @ np.array([rumbo_pluma, perp]), np.full((len(cas2), 1), 2.4)], 1)
    def pluma_pts(nodo, ang):
        piv = np.array(nodos[nodo]) + perp * 3.6            # pivote del lado de la caseta; el brazo cruza el carril
        l = np.linspace(0.2, 3.8, NPL)
        xy = piv[None] - perp[None] * (l * math.cos(ang))[:, None]
        return np.concatenate([xy, (1.05 + l * math.sin(ang))[:, None]], 1)

    def auto_pts(c_xy, rumbo, n_f, n_b, n_t, beam_rng, largo=4.5, ancho=1.75):
        lat = np.array([-rumbo[1], rumbo[0]])
        frente = c_xy + rumbo * largo / 2; atras = c_xy - rumbo * largo / 2
        f = np.concatenate([frente[None] + lat[None] * sg * ancho * 0.42 + beam_rng['f'][j] for j, sg in enumerate((-1, 1))])
        # mancha de los faros: 1/d² entre 3 y 30 m adelante, abre con la distancia
        dd = beam_rng['d']; aa = beam_rng['a']
        b = frente[None] + rumbo[None] * dd[:, None] + lat[None] * (aa * (0.9 + 0.13 * dd))[:, None]
        t = np.concatenate([atras[None] + lat[None] * s * ancho * 0.42 + beam_rng['t'][(0 if s < 0 else 1)] for s in (-1, 1)])
        return f, b, t

    def beam_sample(n_f, n_b, n_t):
        u = rng.random(n_b); d0, d1 = 3.0, 30.0
        d = 1.0 / (1.0 / d0 - u * (1.0 / d0 - 1.0 / d1))                         # p(d) ∝ 1/d²
        return {'f': [rng.normal(0, 0.10, (n_f, 2)) for _ in range(2)], 'd': d, 'a': rng.uniform(-1, 1, n_b),
                'b': None, 't': [rng.normal(0, 0.07, (n_t, 2)) for _ in range(2)]}
    rb_fondo = [beam_sample(FH, FB, FT) for _ in range(N_FONDO)]
    rb_h = [beam_sample(HH, HB, HT) for _ in HEROES]
    carro_local = np.stack([rng.uniform(-2.25, 2.25, HC), rng.uniform(-0.88, 0.88, HC)], 1)

    def cuadro_ciudad(k_sim):
        t = k_sim * DT_OUT
        P = np.zeros((NT, 3)); V = np.zeros(NT, dtype=bool)
        it = min(int(round(t / DT)), nT - 1)
        # fondo
        for c in range(N_FONDO):
            if np.isnan(pf[k_sim, c, 0]): continue
            f, b, tt = auto_pts(pf[k_sim, c], hf[k_sim, c], FH, FB, FT, rb_fondo[c])
            P[o_ff + c * 2 * FH:o_ff + (c + 1) * 2 * FH, :2] = f; V[o_ff + c * 2 * FH:o_ff + (c + 1) * 2 * FH] = True
            P[o_fb + c * FB:o_fb + (c + 1) * FB, :2] = b; V[o_fb + c * FB:o_fb + (c + 1) * FB] = True
            P[o_ft + c * 2 * FT:o_ft + (c + 1) * 2 * FT, :2] = tt; V[o_ft + c * 2 * FT:o_ft + (c + 1) * 2 * FT] = True
            for e in range(1, EST + 1):
                ke = k_sim - e
                if ke < 0 or np.isnan(pf[ke, c, 0]) or np.hypot(*(pf[ke, c] - pf[k_sim, c])) > 60: continue
                fe, _, _ = auto_pts(pf[ke, c], hf[ke, c], FH, FB, FT, rb_fondo[c])
                o = o_fe[e - 1] + c * 2 * FH; P[o:o + 2 * FH, :2] = fe; V[o:o + 2 * FH] = True
        # héroes
        for i, h in enumerate(HEROES):
            s = s_h[i, it]
            if s <= 1.0 or s >= RH.L - 1: continue
            cen = RH.pos(s - LARGO / 2); rum = RH.rumbo(s - LARGO / 2)
            f, b, tt = auto_pts(cen, rum, HH, HB, HT, rb_h[i])
            d = o_h[i]
            parado = h['sku'] is None and s >= S_ALTO - 0.5 and t > h['llega']
            # SIN TORRE: parpadea esperando (intermitentes a 1.5 Hz), EJEMPLO
            on = not parado or (math.floor(t * 3.0) % 2 == 0)
            P[d['faros']:d['faros'] + 2 * HH, :2] = f; V[d['faros']:d['faros'] + 2 * HH] = on
            P[d['mancha']:d['mancha'] + HB, :2] = b; V[d['mancha']:d['mancha'] + HB] = True
            P[d['cal']:d['cal'] + 2 * HT, :2] = tt; V[d['cal']:d['cal'] + 2 * HT] = on
            lat = np.array([-rum[1], rum[0]])
            frac_c = min(1.0, E(cen, 1.2) / E_REF)
            nc = int(round(HC * frac_c))
            cx = cen[None] + rum[None] * carro_local[:, :1] + lat[None] * carro_local[:, 1:]
            P[d['carro']:d['carro'] + HC, :2] = cx; P[d['carro']:d['carro'] + HC, 2] = 1.2
            vv_ = np.zeros(HC, dtype=bool); vv_[d['orden_carro'][:nc]] = True; V[d['carro']:d['carro'] + HC] = vv_
            if h['sku']:
                frac_t = min(1.0, E(cen, 1.55) / E_REF)
                nt = int(round(HTO * frac_t ** 0.8))
                tp = d['torre_pts']                                               # (alto, b, c) en m → al toldo
                M = np.array([rum, lat])
                xy_t = cen[None] + tp[:, 1:] @ M
                P[d['torre']:d['torre'] + HTO, :2] = xy_t; P[d['torre']:d['torre'] + HTO, 2] = 1.45 + tp[:, 0]
                vt = np.zeros(HTO, dtype=bool); vt[d['orden_torre'][:nt]] = True; V[d['torre']:d['torre'] + HTO] = vt
        # entorno
        P[o_pool:o_pool + NPOOL] = pool; V[o_pool:o_pool + NPOOL] = True
        P[o_bulb:o_bulb + NBULB] = bulb; V[o_bulb:o_bulb + NBULB] = True
        P[o_cas:o_cas + NCAS] = cas[:NCAS]; V[o_cas:o_cas + len(cas)] = True
        P[o_pl1:o_pl1 + NPL] = pluma_pts(GATE_NODE, pluma_ang(t)); V[o_pl1:o_pl1 + NPL] = True
        P[o_pl2:o_pl2 + NPL] = pluma_pts(GATE2_NODE, 0.0); V[o_pl2:o_pl2 + NPL] = True
        P[:, :2] -= OFF                                                   # el origen = el centro del auto parado en la línea de alto
        return P * U, V

    # vitrina (las torres miden de verdad: la escala de la vitrina es 1 unidad = 12 cm de torre)
    SV = 1.0 / 0.118
    SUBE = 0.32        # la vitrina sube: el subtítulo de la serie vive en el tercio de abajo (preview v4: lo pisaba)
    def cuadro_vitrina(cuales, n_grid=0):
        P = np.zeros((NT, 3)); V = np.zeros(NT, dtype=bool)
        if 'big' in cuales:
            p = bt * SV; P[o_big:o_big + NBIG] = np.stack([p[:, 0] - 0.5 + SUBE, p[:, 1], p[:, 2]], 1); V[o_big:o_big + NBIG] = True
        if 'fan' in cuales:
            filas = [3, 2, 3, 2, 3]; j = 0; esc = 0.30
            for fi, nf in enumerate(filas):
                for cj in range(nf):
                    yy = (cj - (nf - 1) / 2) * 0.56; xx = (2 - fi) * 0.50 + SUBE + 0.22
                    p = fan_pts[j] * SV * esc
                    P[o_fan[j]:o_fan[j] + NFAN] = np.stack([xx + p[:, 0] - 0.5 * esc, yy + p[:, 1], p[:, 2]], 1); V[o_fan[j]:o_fan[j] + NFAN] = True
                    j += 1
        if 'grid' in cuales:
            esc = 0.115
            for j in range(100):
                r_, c_ = divmod(j, 10)
                xx = (4.5 - r_) * 0.21 + SUBE; yy = (c_ - 4.5) * 0.172
                p = gr_pts * SV * esc
                P[o_grid[j]:o_grid[j] + NGR] = np.stack([xx + p[:, 0] - 0.5 * esc, yy + p[:, 1], p[:, 2]], 1)
                V[o_grid[j]:o_grid[j] + NGR] = j < n_grid
        return P, V

    # ── LA SECUENCIA DE CUADROS. Cada tramo lleva un cuadro DUPLICADO al principio y al final: el motor
    # oculta un punto si CUALQUIERA de los dos cuadros del intervalo trae el centinela, así que un reloj que
    # cae 1e-4 fuera del tramo no debe mezclar la ciudad con la vitrina (cuadro negro o torre fantasma).
    seq = []; tramos = {}
    def tramo(nombre, lista):
        a = len(seq) + 1
        seq.append(lista[0]); seq.extend(lista); seq.append(lista[-1])
        tramos[nombre] = (a, a + len(lista) - 1)
    ciudadA = [('ciudad', k) for k in range(0, K_A)]
    ciudadB = [('ciudad', k) for k in range(K_A - 1, int(round(80.0 / DT_OUT)) + 1)]
    tramo('A', ciudadA)
    tramo('T', [('vit', ('big',), 0)] * 2)
    tramo('B', ciudadB)
    tramo('F', [('vit', ('fan',), 0)] * 2)
    tramo('G', [('vit', ('grid',), n) for n in list(range(4, 101, 4)) + [100]])   # arranca con 4 (con 0 el cuadro es VACÍO)
    tramo('Z', [('vit', ('big',), 0)] * 2)
    K = len(seq)
    print(f'   {K} cuadros · tramos {tramos}')

    pos = np.zeros((K, NT, 3), dtype=np.float32); viv = np.zeros((K, NT), dtype=bool)
    cache = {}
    for k, s in enumerate(seq):
        key = s if s[0] == 'ciudad' else (s[0], s[1], s[2])
        if key not in cache:
            cache[key] = cuadro_ciudad(s[1]) if s[0] == 'ciudad' else cuadro_vitrina(s[1], s[2])
        P, V = cache[key]; pos[k] = P; viv[k] = V
    # los ejes: X = norte (vertical), Y = este (horizontal), Z = arriba (hacia la cámara)
    ext = float(np.abs(pos[viv]).max()) * 1.02
    posq = 32767.0 / ext
    qz = np.clip(np.round(pos * posq), -32767, 32767).astype('<i2'); qz[~viv] = CENTINELA
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4s7i', b'WAP2', NT, 0, 0, K, 0, 0, 0))
        fp.write(struct.pack('<3f', float(posq), 0.0, 1.0))
        fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())
        fp.write(np.ones(K, dtype='<f4').tobytes())
        fp.write(col.tobytes()); fp.write(qz.tobytes())
    print(f'OK  {OUT}  {os.path.getsize(OUT)/1024/1024:.1f} MB · ext {ext:.2f} u · posq {posq:.0f}')

    # ── LAS CALLES (campo frío): base por jerarquía + lo que pasa por ellas (autos de fondo cerca).
    LP = 4; lin, jer = [], []
    for a, b, d, hw, wid in aristas:
        (xa, ya), (xb, yb) = nodos[a], nodos[b]
        if max(abs(xa), abs(xb)) > MITAD_N * 1.1 or max(abs(ya), abs(yb)) > MITAD_E * 1.1: continue
        tt = np.linspace(0, 1, LP)
        lin.append(np.stack([xa - OFF[0] + (xb - xa) * tt, ya - OFF[1] + (yb - ya) * tt, np.zeros(LP)], 1) * U); jer.append(JER[hw])
    lin = np.array(lin, dtype=np.float32); jer = np.array(jer, dtype=np.float32); NL = len(lin)
    mid = lin[:, LP // 2, :2] / U + OFF[None]
    from scipy.spatial import cKDTree
    arbol = cKDTree(mid)
    traf = np.zeros((K_SIM, NL), dtype=np.float32)
    for k in range(K_SIM):
        ok = ~np.isnan(pf[k, :, 0])
        for idx in arbol.query_ball_point(pf[k, ok], r=45.0):
            traf[k, idx] += 1.0
    suave = np.zeros_like(traf); acc = traf[:20].mean(0) / (1 - 0.8)
    for k in range(K_SIM): acc = 0.8 * acc + traf[k]; suave[k] = acc
    ref = np.percentile(suave[suave > 0], 92) if (suave > 0).any() else 1.0
    flujo = np.clip(suave / ref, 0, 1) ** 0.7
    br_sim = np.clip(255 * (0.34 * jer[None] + 0.66 * flujo * (0.45 + 0.55 * jer[None])), 0, 255).astype(np.uint8)
    q16 = np.clip(np.round(lin * 2000), -32767, 32767).astype('<i2')
    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL, LP)); fp.write(np.linspace(1, 0, K).astype('<f4').tobytes())
        for _ in range(K): fp.write(q16.tobytes())
        for s in seq:
            b_ = br_sim[min(s[1], K_SIM - 1)] if s[0] == 'ciudad' else np.zeros(NL, dtype=np.uint8)
            fp.write(np.repeat(b_[:, None], LP, 1).tobytes())
    print(f'OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.1f} MB · {NL} tramos')

    # ── EL RELOJ (segundo del video → cuadro del bin), para CinematicMolecule.tsx (ECASETA_RELOJ)
    A, Tt, Bt, Ft, Gt, Zt = (tramos[n] for n in 'ATBFGZ')
    kA = lambda sim: A[0] + sim / DT_OUT
    kB = lambda sim: Bt[0] + (sim - 73.0) / DT_OUT
    eps = 1e-3
    # el salto de tramo va JUSTO ANTES del corte de cámara (t − eps): el cuadro del segundo exacto del
    # corte ya es del tramo nuevo (preview v3: en 33.0 s la cámara de la pluma veía la vitrina → negro)
    reloj = [(0, kA(0)), (4, kA(32)), (10, kA(56)), (27 - eps, kA(73)),
             (27, Tt[0]), (33 - eps, Tt[1]),
             (33, kB(73)), (42 - eps, kB(80)),
             (42, Ft[0]), (50 - eps, Ft[1]),
             (50, Gt[0]), (54, Gt[1]), (56 - eps, Gt[1]),
             (56, Zt[0]), (60, Zt[1])]
    reloj = [(round(a, 3), round(float(b), 3)) for a, b in reloj]
    print('   RELOJ (video s → cuadro):', reloj)
    json.dump({'lectura': 'LA CASETA DE NOCHE (conos JA-VAZ #7): calles reales de Juriquilla (OSM), la pluma real 8636180821, '
                          'autos como chispas, la torre de color sólo donde la toca la lámpara (no reflejante); vitrina con las medidas del plano TORR-1340PX3',
               'K': K, 'NT': NT, 'tramos': tramos, 'reloj': reloj, 'm_por_unidad': M_POR_UNIDAD, 'dt_bin_s': DT_OUT,
               'origen': {'nodo_osm_pluma': GATE_NODE, 'lat': LAT0, 'lon': LON0, 'desplazado_m': OFF.tolist(), 'nota': 'el origen de la escena es el auto parado en la línea de alto (3 m antes del brazo)'}, 'caseta_m': CASETA.tolist(), 'caseta_nota': 'ubicación ILUSTRATIVA junto a la pluma real',
               'lampara': {'h_m': H_LAMP, 'ley': 'E ∝ (h−z)/(d²+(h−z)²)^1.5'},
               'torre_m': {'alto': 0.118, 'base_cuerpo': 0.150, 'tapa': 0.035, 'pestana': 0.214, 'dudoso': '16.00 cm del plano'},
               'heroes': [{'sku': h['sku'], 'llega_s': h['llega'], 'sube_s': h['sube']} for h in HEROES],
               'fondo': {'autos': N_FONDO, 'nota': 'ilustrativo: no hay aforo de Juriquilla a las 11 pm'},
               'rejilla': '100 = conteo real de condominios (ANALISIS-CONOS §3); colores de la rejilla ILUSTRATIVOS',
               'grupos': [(n, c) for n, c, _ in grupos[:12]],
               'fuente_calles': 'OpenStreetMap contributors (ODbL) vía Overpass API, 2026-10-15'},
              open(OUT_JSON, 'w'), indent=1, ensure_ascii=False)
    print(f'OK  {OUT_JSON}')


if __name__ == '__main__':
    main()
