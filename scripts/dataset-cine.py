#!/usr/bin/env python3
"""
dataset-cine.py — UNA fila por reel publicado: sus RASGOS controlables + sus RESULTADOS.

Para que ian pueda hacer machine learning después ("cada uno llevará sus características y
métricas"). Regla de honestidad: NUNCA se inventa un valor; lo que no se sabe va en null, y cada
fila registra CÓMO se unió con cada fuente (join_ig / join_yt / join_rasgos).

    python3 scripts/dataset-cine.py          → escribe public/comando/dataset.json e imprime resumen
    python3 scripts/dataset-cine.py --check  → exit 0 si el JSON existe y n_con_ig >= 10, si no exit 1

FUENTES (todas locales, ninguna llamada a red):
  videos/*.json (sin CRONOGRAMA.json)   → rasgos declarados: ritmo.brazo, ritmo.cortes_por_min,
                                          ritmo.silabas_por_seg, formato.dur, audio.vel (default 1.0
                                          SOLO cuando hay manifiesto), publicar.copy.{marco,activacion,
                                          valor_propio,titulo}, guion.archivo → palabras del guion,
                                          publicar.subidas.{yt,ig,yt16x9}, publicar.programar.
  public/comando/rasgos-reels.json      → rasgos de PÍXEL medidos sobre el archivo que IG publicó
                                          (saturacion, calido, frio, magenta, variedad_color, luma,
                                          contraste, quemado, movimiento, lleno, dur). Llave: id de medio IG.
  public/comando/analisis-ig.json       → RESULTADOS por reel de IG (vistas, alcance, skip3s, seg_vistos,
                                          guardados, compartidos, g_por_mil, c_por_mil, horas_atencion).
                                          Llave: id de medio IG; url = permalink.
  public/comando/curvas-dia.json        → RESULTADOS por video de YouTube (total, pico_dia, corte_dia,
                                          vida_util_dias, cola_pct). Llave: id de YT.
  public/comando/horarios.json          → NO es por video; se ignora.

REGLAS DE UNIÓN (en este orden, y se registra cuál ganó):
  1. IG ↔ manifiesto:  publicar.subidas.ig.id == analisis-ig/rasgos .id      → join_ig = "id"
                       si no, permalink igual                                  → join_ig = "url"
                       si no, y SOLO si el manifiesto NO trae ig.id, parecido de título
                       (minúsculas, sin acentos ni puntuación ni #hashtags, primeros 40
                       caracteres, difflib ≥ 0.90) con guardia de duración
                       (|dur_manifiesto − dur_reel| ≤ 20 %)                    → join_ig = "titulo"
                       si nada                                                 → join_ig = null
     Si el manifiesto trae ig.id pero el id NO está en las fuentes (reel más nuevo que el último
     análisis), NO se intenta el título: el id manda, y los resultados quedan en null hasta que
     analisis-ig se regenere.
  2. YT ↔ manifiesto:  publicar.subidas.yt.id == curvas-dia .id (el id se saca de la url si
                       hiciera falta)                                          → join_yt = "id"
                       si no, y SOLO si no trae yt.id, parecido de título + guardia de duración
                                                                               → join_yt = "titulo"
     curvas-dia trae títulos DUPLICADOS (la subida 9:16 y la 16:9): por título se toma la de
     más vistas y NO se adivina cuál es la 16:9.
  3. rasgos-reels ↔ fila: por id de medio IG (misma llave que analisis-ig)     → join_rasgos = "id"
                       si no, por permalink                                    → "url"
                       si no                                                   → null
  4. Reels de IG SIN manifiesto (era pre-manifiesto: O₂, el puente, agua v2, átomos…) TAMBIÉN son
     fila, con id_manifiesto = null, rasgos declarados en null, rasgos de píxel los que dé
     rasgos-reels, resultados llenos. Para ellos el YT se busca por título (regla 2) entre los
     videos de YT que ningún manifiesto reclamó por id.
  5. Un reel de IG o un video de YT solo puede pertenecer a UNA fila (primero llega, primero
     reclama; los ids se reclaman antes que cualquier título).
  6. Un manifiesto sin ninguna subida y sin unión queda como fila SIN métricas (n_sin_metricas):
     son las piezas listas por publicar; sus métricas entran cuando `video.sh <id> cosechar`
     escriba subidas.ig.id y se regenere analisis-ig.

RESULTADOS de IG: analisis-ig manda; si el reel solo está en rasgos-reels (más nuevo), se toman de
ahí vistas/alcance/guardados/compartidos/g_por_mil/c_por_mil (skip3s y seg_vistos quedan null).
La columna fuente_ig dice cuál fue.

hora_ig / dia_ig salen de publicar.subidas.ig.fecha (hora local TAL COMO ESTÁ guardada, sin huso);
para reels sin manifiesto solo hay fecha (sin hora) → hora_ig = null.
"""
import datetime
import difflib
import glob
import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_VIDEOS = os.path.join(RAIZ, "videos")
DIR_COMANDO = os.path.join(RAIZ, "public", "comando")
SALIDA = os.path.join(DIR_COMANDO, "dataset.json")

UMBRAL_TITULO = 0.90     # parecido mínimo (difflib ratio sobre los primeros 40 chars normalizados)
LARGO_MIN_TITULO = 14    # menos de esto no se compara (títulos genéricos)
TOL_DUR = 0.20           # guardia de duración para uniones por título
GENERICOS = ("sin caption", "university gaiaprim", "https university", "http")
DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]


# ---------------------------------------------------------------- utilidades
def leer_json(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def norm_titulo(t):
    """minúsculas, sin acentos, sin puntuación, sin #hashtags, primeros 40 caracteres."""
    if not t:
        return ""
    t = unicodedata.normalize("NFKD", str(t))
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r"#\w+", " ", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:40]


def es_generico(n):
    return len(n) < LARGO_MIN_TITULO or any(n.startswith(g) for g in GENERICOS)


def parecido(a, b):
    """0..1; 0 si alguno es genérico o demasiado corto. Se compara sobre el largo del más corto."""
    a, b = norm_titulo(a), norm_titulo(b)
    if es_generico(a) or es_generico(b):
        return 0.0
    L = min(len(a), len(b))
    if L < LARGO_MIN_TITULO:
        return 0.0
    return difflib.SequenceMatcher(None, a[:L], b[:L]).ratio()


def dur_compatible(d1, d2):
    """True si no se puede comprobar (algún null) o si difieren ≤ TOL_DUR."""
    if d1 is None or d2 is None:
        return True
    m = max(float(d1), float(d2))
    return m == 0 or abs(float(d1) - float(d2)) / m <= TOL_DUR


def dur_iso(s):
    """PT1M11S → 71.0; None si no se entiende."""
    if not s:
        return None
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", s)
    if not m:
        return None
    h, mi, se = (int(x) if x else 0 for x in m.groups())
    return float(h * 3600 + mi * 60 + se)


def yt_id_de(sub):
    """id de un bloque subidas.yt; si no trae id, lo saca de la url."""
    if not sub:
        return None
    if sub.get("id"):
        return sub["id"]
    m = re.search(r"(?:youtu\.be/|v=|shorts/)([A-Za-z0-9_-]{11})", sub.get("url") or "")
    return m.group(1) if m else None


def hora_y_dia(fecha):
    """'2026-08-28T16:53' → ('16:53', 16.88, 3, 'jue'); '2026-08-28' → (None, None, 3, 'jue')."""
    if not fecha:
        return None, None, None, None
    try:
        d = datetime.date.fromisoformat(fecha[:10])
    except ValueError:
        return None, None, None, None
    dia = d.weekday()
    m = re.match(r"\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})", fecha)
    if not m:
        return None, None, dia, DIAS[dia]
    hh, mm = int(m.group(1)), int(m.group(2))
    return f"{hh:02d}:{mm:02d}", round(hh + mm / 60, 2), dia, DIAS[dia]


def palabras_guion(rel):
    """cuenta palabras del guion (líneas de diálogo; se saltan vacías y las que empiezan con #)."""
    if not rel:
        return None
    ruta = rel if os.path.isabs(rel) else os.path.join(RAIZ, rel)
    if not os.path.exists(ruta):
        return None
    n = 0
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            s = linea.strip()
            if not s or s.startswith("#"):
                continue
            n += len(s.split())
    return n


# ---------------------------------------------------------------- columnas
COLUMNAS = [
    ("id_manifiesto", "id del manifiesto videos/<id>.json; null = reel de la era pre-manifiesto"),
    ("titulo", "publicar.copy.titulo; si no, titulo del manifiesto; si no, caption de IG; si no, título de YT"),
    ("fecha_ig", "fecha de publicación en IG tal como está guardada (manifiesto con hora local; analisis-ig solo fecha)"),
    ("hora_ig", "hora local de la publicación en IG 'HH:MM' (solo si el manifiesto la guarda)"),
    ("hora_ig_num", "misma hora en decimal (16:53 → 16.88) para regresión"),
    ("dia_ig", "día de la semana de la publicación en IG: 0=lun … 6=dom"),
    ("dia_ig_nombre", "lun|mar|mie|jue|vie|sab|dom"),
    ("dur_s", "duración en s: formato.dur del manifiesto; si no, dur del archivo publicado en IG (rasgos-reels); si no, dur de YT"),
    ("brazo", "ritmo.brazo del manifiesto (A = ritmo de siempre, B = rápido); null si no está declarado"),
    ("cortes_min", "ritmo.cortes_por_min (cortes de cámara por minuto)"),
    ("sil_s", "ritmo.silabas_por_seg (sílabas por segundo de la voz)"),
    ("vel", "audio.vel (velocidad de la voz); 1.0 por default SOLO cuando hay manifiesto"),
    ("marco", "publicar.copy.marco: explicacion | revelacion | …"),
    ("activacion", "publicar.copy.activacion (texto tal cual, null si no hay)"),
    ("valor_propio", "publicar.copy.valor_propio (texto tal cual, null si no hay)"),
    ("palabras_guion", "palabras del guion scripts/guiones/<archivo> (líneas de diálogo)"),
    ("guion", "guion.archivo del manifiesto"),
    ("programar", "publicar.programar (hora ISO con huso) si la pieza está programada"),
    ("ig_id", "id de medio de Instagram"),
    ("ig_url", "permalink del reel"),
    ("saturacion", "rasgos-reels: saturación media (píxeles con señal)"),
    ("calido", "rasgos-reels: fracción cálida"),
    ("frio", "rasgos-reels: fracción fría"),
    ("magenta", "rasgos-reels: fracción magenta"),
    ("variedad_color", "rasgos-reels: variedad de color"),
    ("luma", "rasgos-reels: luma media"),
    ("contraste", "rasgos-reels: contraste"),
    ("quemado", "rasgos-reels: fracción quemada (clip)"),
    ("movimiento", "rasgos-reels: movimiento entre cuadros"),
    ("lleno", "rasgos-reels: fracción del cuadro ocupada"),
    ("ig_vistas", "IG: vistas"),
    ("ig_alcance", "IG: alcance (cuentas)"),
    ("ig_skip3s", "IG: % que se fue antes de 3 s (solo analisis-ig)"),
    ("ig_seg_vistos", "IG: segundos vistos promedio (solo analisis-ig)"),
    ("ig_guardados", "IG: guardados"),
    ("ig_compartidos", "IG: compartidos"),
    ("ig_c_por_mil", "IG: compartidos por mil de alcance"),
    ("ig_g_por_mil", "IG: guardados por mil de alcance"),
    ("ig_horas_atencion", "IG: horas de atención totales (solo analisis-ig)"),
    ("fuente_ig", "de dónde salieron los resultados de IG: analisis-ig | rasgos-reels | null"),
    ("yt_id", "id del video 9:16 en YouTube"),
    ("yt_url", "url de YouTube"),
    ("fecha_yt", "fecha de subida a YT (manifiesto) o de publicación (curvas-dia)"),
    ("yt_publish_at", "publicar.subidas.yt.publishAt (vacío = se publicó al instante)"),
    ("yt16x9_id", "id de la versión 16:9 en YouTube (manifiesto)"),
    ("yt_vistas", "YT: vistas totales (curvas-dia.total)"),
    ("yt_pico_dia", "YT: día del pico (0 = el día de publicación)"),
    ("yt_corte_dia", "YT: primer día tras el pico con < 20 % del pico"),
    ("yt_vida_util", "YT: días para juntar el 80 % de las vistas (vida_util_dias)"),
    ("yt_cola_pct", "YT: % de vistas después del corte"),
    ("join_ig", "cómo se unió el reel de IG: id | url | titulo | null"),
    ("join_ig_score", "parecido de título cuando join_ig = titulo (1.0 = idéntico en 40 chars)"),
    ("join_yt", "cómo se unió el video de YT: id | titulo | null"),
    ("join_yt_score", "parecido de título cuando join_yt = titulo"),
    ("join_rasgos", "cómo se unió rasgos-reels: id | url | null"),
]
LLAVES = [c for c, _ in COLUMNAS]

RASGOS_PIXEL = ["saturacion", "calido", "frio", "magenta", "variedad_color", "luma",
                "contraste", "quemado", "movimiento", "lleno"]


def fila_vacia():
    return {k: None for k in LLAVES}


# ---------------------------------------------------------------- carga
def cargar_fuentes():
    ig = leer_json(os.path.join(DIR_COMANDO, "analisis-ig.json"))
    rs = leer_json(os.path.join(DIR_COMANDO, "rasgos-reels.json"))
    yt = leer_json(os.path.join(DIR_COMANDO, "curvas-dia.json"))
    manifiestos = []
    for ruta in sorted(glob.glob(os.path.join(DIR_VIDEOS, "*.json"))):
        if os.path.basename(ruta) == "CRONOGRAMA.json":
            continue
        m = leer_json(ruta)
        m.setdefault("id", os.path.basename(ruta)[:-5])
        manifiestos.append(m)
    return ig, rs, yt, manifiestos


# ---------------------------------------------------------------- llenado
def poner_ig(fila, v):
    """resultados desde analisis-ig."""
    fila["ig_id"] = v["id"]
    fila["ig_url"] = v.get("url")
    fila["fecha_ig"] = fila["fecha_ig"] or v.get("fecha")
    for k in ("vistas", "alcance", "skip3s", "seg_vistos", "guardados", "compartidos",
              "c_por_mil", "g_por_mil", "horas_atencion"):
        fila["ig_" + k] = v.get(k)
    fila["fuente_ig"] = "analisis-ig"


def poner_ig_desde_rasgos(fila, r):
    """resultados desde rasgos-reels (cuando el reel es más nuevo que analisis-ig)."""
    fila["ig_id"] = r["id"]
    fila["ig_url"] = r.get("url")
    fila["fecha_ig"] = fila["fecha_ig"] or r.get("fecha")
    for k in ("vistas", "alcance", "guardados", "compartidos", "c_por_mil", "g_por_mil"):
        fila["ig_" + k] = r.get(k)
    fila["fuente_ig"] = "rasgos-reels"


def poner_rasgos(fila, r, como):
    for k in RASGOS_PIXEL:
        fila[k] = r.get(k)
    if fila["dur_s"] is None:
        fila["dur_s"] = r.get("dur")
    fila["join_rasgos"] = como


def poner_yt(fila, v, como, score=None):
    fila["yt_id"] = v["id"]
    fila["yt_url"] = fila["yt_url"] or v.get("url")
    fila["fecha_yt"] = fila["fecha_yt"] or v.get("publicado")
    fila["yt_vistas"] = v.get("total")
    fila["yt_pico_dia"] = v.get("pico_dia")
    fila["yt_corte_dia"] = v.get("corte_dia")
    fila["yt_vida_util"] = v.get("vida_util_dias")
    fila["yt_cola_pct"] = v.get("cola_pct")
    if fila["dur_s"] is None:
        fila["dur_s"] = dur_iso(v.get("dur"))
    fila["join_yt"] = como
    fila["join_yt_score"] = score


def mejor_por_titulo(titulo, dur, candidatos, dur_de, rechazados, quien, prefer):
    """el candidato con mejor parecido ≥ UMBRAL y duración compatible. prefer desempata."""
    mejor, mejor_s = None, 0.0
    for c in candidatos:
        s = parecido(titulo, c.get("titulo"))
        if s < UMBRAL_TITULO:
            continue
        if not dur_compatible(dur, dur_de(c)):
            rechazados.append({"quien": quien, "candidato": c["id"], "titulo": (c.get("titulo") or "")[:60],
                               "score": round(s, 3), "dur_fila": dur, "dur_candidato": dur_de(c)})
            continue
        if s > mejor_s or (s == mejor_s and mejor is not None and prefer(c) > prefer(mejor)):
            mejor, mejor_s = c, s
    return mejor, round(mejor_s, 3) if mejor else None


# ---------------------------------------------------------------- construcción
def construir():
    ig, rs, yt, manifiestos = cargar_fuentes()
    IG = {v["id"]: v for v in ig["videos"]}
    IG_URL = {v["url"]: v for v in ig["videos"] if v.get("url")}
    RS = {v["id"]: v for v in rs["videos"]}
    RS_URL = {v["url"]: v for v in rs["videos"] if v.get("url")}
    YT = {v["id"]: v for v in yt["videos"]}
    # universo de reels de IG = analisis-ig ∪ rasgos-reels (rasgos puede traer reels más nuevos)
    universo_ig = dict(IG)
    for k, v in RS.items():
        universo_ig.setdefault(k, {"id": k, "url": v.get("url"), "fecha": v.get("fecha"),
                                   "titulo": v.get("titulo"), "_solo_rasgos": True})

    ig_tomados, yt_tomados = set(), set()
    filas, rechazados = [], []
    dur_ig = lambda c: (RS.get(c["id"]) or {}).get("dur")
    dur_yt = lambda c: dur_iso(c.get("dur"))
    ig_vistas_de = lambda c: (c.get("vistas") or (RS.get(c["id"]) or {}).get("vistas") or 0)
    yt_vistas_de = lambda c: c.get("total") or 0

    def rasgos_de(fila):
        """rasgos de píxel por id, si no por url."""
        if fila["ig_id"] in RS:
            poner_rasgos(fila, RS[fila["ig_id"]], "id")
        elif fila["ig_url"] in RS_URL:
            poner_rasgos(fila, RS_URL[fila["ig_url"]], "url")

    def resultados_ig(fila, reel_id, como, score=None):
        """llena resultados de IG desde analisis-ig o, si el reel es más nuevo, desde rasgos-reels."""
        if reel_id in IG:
            poner_ig(fila, IG[reel_id])
        elif reel_id in RS:
            poner_ig_desde_rasgos(fila, RS[reel_id])
        fila["join_ig"] = como
        fila["join_ig_score"] = score
        ig_tomados.add(reel_id)

    # ---- filas con manifiesto: rasgos declarados + uniones por id
    filas_manifiesto = []
    for m in manifiestos:
        f = fila_vacia()
        pub = m.get("publicar") or {}
        copy = pub.get("copy") or {}
        sub = pub.get("subidas") or {}
        ritmo = m.get("ritmo") or {}
        f["id_manifiesto"] = m["id"]
        f["titulo"] = copy.get("titulo") or m.get("titulo")
        f["dur_s"] = (m.get("formato") or {}).get("dur")
        f["brazo"] = ritmo.get("brazo")
        f["cortes_min"] = ritmo.get("cortes_por_min")
        f["sil_s"] = ritmo.get("silabas_por_seg")
        f["vel"] = (m.get("audio") or {}).get("vel", 1.0)
        f["marco"] = copy.get("marco")
        f["activacion"] = copy.get("activacion")
        f["valor_propio"] = copy.get("valor_propio")
        f["guion"] = (m.get("guion") or {}).get("archivo")
        f["palabras_guion"] = palabras_guion(f["guion"])
        f["programar"] = pub.get("programar") or None
        sig = sub.get("ig") or {}
        syt = sub.get("yt") or {}
        s169 = sub.get("yt16x9") or {}
        f["ig_id"] = sig.get("id")
        f["ig_url"] = sig.get("url")
        f["fecha_ig"] = sig.get("fecha")
        f["yt_id"] = yt_id_de(syt)
        f["yt_url"] = syt.get("url")
        f["fecha_yt"] = syt.get("fecha")
        f["yt_publish_at"] = syt.get("publishAt") if syt else None
        f["yt16x9_id"] = yt_id_de(s169)
        # unión IG por id / url
        if f["ig_id"] and f["ig_id"] in universo_ig:
            resultados_ig(f, f["ig_id"], "id")
        elif f["ig_url"] and (f["ig_url"] in IG_URL or f["ig_url"] in RS_URL):
            reel = (IG_URL.get(f["ig_url"]) or RS_URL.get(f["ig_url"]))["id"]
            resultados_ig(f, reel, "url")
        # unión YT por id
        if f["yt_id"] and f["yt_id"] in YT:
            poner_yt(f, YT[f["yt_id"]], "id")
            yt_tomados.add(f["yt_id"])
        f["_tiene_ig_id"] = bool(f["ig_id"])
        f["_tiene_yt_id"] = bool(f["yt_id"])
        filas_manifiesto.append(f)

    # ---- segunda pasada: uniones por título SOLO para manifiestos sin id declarado
    for f in filas_manifiesto:
        if not f["_tiene_ig_id"]:
            cands = [c for k, c in universo_ig.items() if k not in ig_tomados]
            c, s = mejor_por_titulo(f["titulo"], f["dur_s"], cands, dur_ig, rechazados,
                                    f["id_manifiesto"], ig_vistas_de)
            if c:
                resultados_ig(f, c["id"], "titulo", s)
        if not f["_tiene_yt_id"]:
            cands = [c for k, c in YT.items() if k not in yt_tomados]
            c, s = mejor_por_titulo(f["titulo"], f["dur_s"], cands, dur_yt, rechazados,
                                    f["id_manifiesto"], yt_vistas_de)
            if c:
                poner_yt(f, c, "titulo", s)
                yt_tomados.add(c["id"])
        rasgos_de(f)
        hora, hnum, dia, dnom = hora_y_dia(f["fecha_ig"])
        f["hora_ig"], f["hora_ig_num"], f["dia_ig"], f["dia_ig_nombre"] = hora, hnum, dia, dnom
        del f["_tiene_ig_id"], f["_tiene_yt_id"]
        filas.append(f)

    # ---- reels de IG sin manifiesto (la era pre-manifiesto)
    for reel_id, reel in universo_ig.items():
        if reel_id in ig_tomados:
            continue
        f = fila_vacia()
        resultados_ig(f, reel_id, "id")
        f["titulo"] = reel.get("titulo")
        rasgos_de(f)
        cands = [c for k, c in YT.items() if k not in yt_tomados]
        c, s = mejor_por_titulo(f["titulo"], f["dur_s"], cands, dur_yt, rechazados,
                                "ig:" + reel_id, yt_vistas_de)
        if c:
            poner_yt(f, c, "titulo", s)
            yt_tomados.add(c["id"])
        hora, hnum, dia, dnom = hora_y_dia(f["fecha_ig"])
        f["hora_ig"], f["hora_ig_num"], f["dia_ig"], f["dia_ig_nombre"] = hora, hnum, dia, dnom
        filas.append(f)

    # ---- orden: ig_vistas desc (null al final), luego yt_vistas desc
    filas.sort(key=lambda f: (f["ig_vistas"] is None, -(f["ig_vistas"] or 0), -(f["yt_vistas"] or 0)))
    filas = [{k: f[k] for k in LLAVES} for f in filas]

    def cuenta(col, valores):
        return {v: sum(1 for f in filas if f[col] == v) for v in valores}

    con_manif = [f for f in filas if f["id_manifiesto"]]
    resumen = {
        "generado": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "n_filas": len(filas),
        "n_con_manifiesto": len(con_manif),
        "n_con_ig": sum(1 for f in filas if f["ig_vistas"] is not None),
        "n_con_yt": sum(1 for f in filas if f["yt_vistas"] is not None),
        "n_sin_metricas": sum(1 for f in filas if f["ig_vistas"] is None and f["yt_vistas"] is None),
        "n_con_rasgos_pixel": sum(1 for f in filas if f["saturacion"] is not None),
        "n_con_ritmo_declarado": sum(1 for f in filas if f["brazo"] is not None),
        "uniones": {
            "ig": {"id": sum(1 for f in con_manif if f["join_ig"] == "id"),
                   "url": sum(1 for f in con_manif if f["join_ig"] == "url"),
                   "titulo": sum(1 for f in con_manif if f["join_ig"] == "titulo"),
                   "sin_union": sum(1 for f in con_manif if f["join_ig"] is None),
                   "reels_sin_manifiesto": len(filas) - len(con_manif)},
            "yt": cuenta("join_yt", ["id", "titulo", None]),
            "rasgos": cuenta("join_rasgos", ["id", "url", None]),
        },
        "sin_union": {
            "manifiestos_con_ig_id_pero_sin_resultados": [f["id_manifiesto"] for f in con_manif
                                                          if f["ig_id"] and f["join_ig"] is None],
            "manifiestos_sin_ig": [f["id_manifiesto"] for f in con_manif if f["join_ig"] is None],
            "manifiestos_sin_yt": [f["id_manifiesto"] for f in con_manif if f["join_yt"] is None],
            "yt_sin_fila": len(YT) - len(yt_tomados),
            "rechazados_por_duracion": rechazados,
        },
        "fuentes": {
            "manifiestos": len(manifiestos),
            "analisis-ig": {"generado": ig.get("generado"), "n": len(IG)},
            "rasgos-reels": {"generado": rs.get("generado"), "n": len(RS)},
            "curvas-dia": {"generado": yt.get("generado"), "n": len(YT)},
        },
        "reglas": {"umbral_titulo": UMBRAL_TITULO, "largo_min_titulo": LARGO_MIN_TITULO,
                   "tolerancia_dur": TOL_DUR, "hora_ig": "hora local tal como la guarda el manifiesto"},
        "columnas": [{"col": c, "desc": d} for c, d in COLUMNAS],
        "filas": filas,
    }
    return resumen


# ---------------------------------------------------------------- salida
def fmt(v, ancho, dec=2):
    if v is None:
        s = "—"
    elif isinstance(v, float):
        s = f"{v:.{dec}f}"
    else:
        s = str(v)
    return s[:ancho].ljust(ancho)


def imprimir_resumen(r):
    u = r["uniones"]
    print(f"dataset.json: {r['n_filas']} filas · {r['n_con_manifiesto']} con manifiesto · "
          f"{r['n_con_ig']} con IG · {r['n_con_yt']} con YT · {r['n_sin_metricas']} sin métricas · "
          f"{r['n_con_rasgos_pixel']} con rasgos de píxel · {r['n_con_ritmo_declarado']} con ritmo declarado")
    print(f"uniones IG (manifiestos): id={u['ig']['id']} url={u['ig']['url']} titulo={u['ig']['titulo']} "
          f"sin={u['ig']['sin_union']} · reels sin manifiesto={u['ig']['reels_sin_manifiesto']}")
    print(f"uniones YT (todas las filas): id={u['yt']['id']} titulo={u['yt']['titulo']} sin={u['yt'][None]} "
          f"· videos YT sin fila={r['sin_union']['yt_sin_fila']}")
    print(f"uniones rasgos: id={u['rasgos']['id']} url={u['rasgos']['url']} sin={u['rasgos'][None]}")
    s = r["sin_union"]
    print("manifiestos con ig.id pero sin resultados aún:", s["manifiestos_con_ig_id_pero_sin_resultados"])
    print("manifiestos sin IG:", s["manifiestos_sin_ig"])
    print("manifiestos sin YT:", s["manifiestos_sin_yt"])
    if s["rechazados_por_duracion"]:
        print("rechazados por duración:", json.dumps(s["rechazados_por_duracion"], ensure_ascii=False))
    print()
    print(fmt("titulo", 48), fmt("brazo", 6), fmt("cortes", 7), fmt("sil/s", 6), fmt("marco", 12),
          fmt("ig_vistas", 10), fmt("c/mil", 6), fmt("join_ig", 8), fmt("manifiesto", 24))
    for f in r["filas"][:8]:
        print(fmt(f["titulo"], 48), fmt(f["brazo"], 6), fmt(f["cortes_min"], 7), fmt(f["sil_s"], 6),
              fmt(f["marco"], 12), fmt(f["ig_vistas"], 10), fmt(f["ig_c_por_mil"], 6),
              fmt(f["join_ig"], 8), fmt(f["id_manifiesto"], 24))


def check():
    if not os.path.exists(SALIDA):
        print(f"FALTA {SALIDA}")
        return 1
    r = leer_json(SALIDA)
    n_ig = r.get("n_con_ig", 0)
    ok = n_ig >= 10
    print(f"{'OK' if ok else 'FALLA'} dataset.json · {r.get('n_filas')} filas · {n_ig} con IG · "
          f"{r.get('n_con_yt')} con YT · {r.get('n_con_manifiesto')} con manifiesto · generado {r.get('generado')}")
    return 0 if ok else 1


def main(argv):
    if "--check" in argv:
        return check()
    r = construir()
    os.makedirs(DIR_COMANDO, exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(r, f, ensure_ascii=False, indent=1)
        f.write("\n")
    imprimir_resumen(r)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
