#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
narracion-gen.py — genera la narracion de un video con la voz Matilda clonada
(Coqui XTTS v2, CUDA), UNA FRASE POR WAV (las frases largas se traban en XTTS),
con auto-recorte del balbuceo que XTTS alucina tras frases cortas.

Lee el guion de scripts/guiones/<mol>.txt (una frase por linea) y escribe
dist-video/<mol>-narracion/<mol>_l01.wav ... (para sincronizar al video).

CORRER EN IANGPU con el venv de TTS:
  /home/ian/tts-venv/bin/python scripts/narracion-gen.py <mol>
(torch/TTS NO estan en el python del sistema; ver reference_xtts_matilda_iangpu)
"""
import os, sys, re, subprocess
os.environ["COQUI_TOS_AGREED"] = "1"

MOL = (sys.argv[1] if len(sys.argv) > 1 else 'n2').lower()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUION = os.path.join(ROOT, "scripts", "guiones", f"{MOL}.txt")
OUT = os.path.join(ROOT, "dist-video", f"{MOL}-narracion")
# VOCES DE REFERENCIA (el timbre y el ACENTO salen de aquí, no del texto: XTTS solo habla
# "es" genérico y clona lo que le des). Override: REFS=/ruta/a.mp3,/ruta/b.mp3
# ⚠ 2026-08-04: TRES de las cuatro `mat_*.mp3` DESAPARECIERON del home de iangpu. Si faltan,
# XTTS clona con menos condicionamiento y la voz CAMBIA sin avisar — por eso ahora se filtra
# lo que existe y se GRITA lo que falta, en vez de fallar en silencio.
REFS = [r for r in (os.environ.get("REFS", "").split(",") if os.environ.get("REFS") else [
    "/home/ian/mat_048eaee5ef6a8a43439fd57ca0f9d255.mp3",
    "/home/ian/mat_7a8ee26aba0546a34e5fe200b7c1d45e.mp3",
    "/home/ian/mat_93f350ea97ee0873117d6a23fcd60580.mp3",
    "/home/ian/mat_f205feda7e04b50d3eab555e742caea9.mp3",
]) if r.strip()]
_faltan = [r for r in REFS if not os.path.exists(r)]
REFS = [r for r in REFS if os.path.exists(r)]
if _faltan:
    print(f"⚠ FALTAN {len(_faltan)} voces de referencia (la voz NO sonará igual que antes):", flush=True)
    for r in _faltan: print(f"    {r}", flush=True)
if not REFS:
    raise SystemExit("✗ cero voces de referencia — XTTS no puede clonar")
print(f"voces de referencia en uso ({len(REFS)}): {[os.path.basename(r) for r in REFS]}", flush=True)
lines = [l.strip() for l in open(GUION, encoding="utf-8") if l.strip()]
os.makedirs(OUT, exist_ok=True)
print(f"{MOL}: {len(lines)} frases -> {OUT}", flush=True)

import torch
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda" if torch.cuda.is_available() else "cpu")


def _dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "default=nk=1:nw=1", p]).decode().strip())


# ── PARTIR FRASES LARGAS ──────────────────────────────────────────────────
# REGLA DURA (reference_xtts_matilda_iangpu): XTTS se TRABA / arrastra las
# vocales / pierde energia en frases largas (>~15 palabras) → "se oye lenta y
# rara". Las narraciones que sonaron chingonas (enlaces) tenian ~10 pal/linea;
# las de la escuela venian de 20-39 palabras → por eso sonaban lentas. Aqui
# cada linea larga se PARTE en clausulas cortas, se genera cada una limpia y se
# concatena en el MISMO wav por linea (el timing de aguas abajo no cambia).
MAX_WORDS = int(os.environ.get('MAXPAL', '16'))   # umbral: solo ORACIONES muy largas se parten
GAP_CLAUSE = float(os.environ.get('GAPCLAUS', '0.26'))  # respiro NATURAL entre oraciones (tras recortar silencios)

# ── VOZ DULCE (EQ) ─────────────────────────────────────────────────────────
# user: "ecualiza la voz, mas dulce, quita el siseo y frecuencias [duras]".
# Cadena TONAL sin estado (segura por-clausula; la compresion/loudnorm van en el
# ensamble). Apagar con SWEET=0.
# GENTIL y CORRECTIVO (el user: sonaba "en una caja" = over-procesado; oídos
# sensibles a los agudos). SIN denoise ni compresión (eso cierra/encaja el sonido),
# SIN boost de calidez (agrega caja). Solo: quita rumble, corta la caja (low-mid),
# de-ess suave y un low-pass que borra los agudos innecesarios. SWEET=0 apaga.
_SWEET = ("highpass=f=85,"                                  # quita rumble/plosivas
          "equalizer=f=360:width_type=q:w=1.3:g=-2,"        # QUITA la 'caja' (corta low-mid, NO la sube)
          "equalizer=f=7000:width_type=q:w=2.6:g=-2.5,"     # de-ess suave (sibilancia)
          "lowpass=f=11000")                                # borra agudos innecesarios (aire áspero)
SWEET = os.environ.get('SWEET', '1') != '0'


def _wc(s):
    return len(s.split())


def _hard_split(p, mx):
    w = p.split()
    return [' '.join(w[i:i + mx]) for i in range(0, len(w), mx)]


def _split_clause(s, mx):
    # parte por raya/; / : / , respetando el orden; agrupa a <= mx palabras
    parts = [p.strip() for p in re.split(r'\s*[—–;:]\s*|,\s*', s) if p.strip()]
    out, buf = [], ''
    for p in parts:
        cand = (buf + ', ' + p) if buf else p
        if _wc(cand) <= mx:
            buf = cand
        else:
            if buf:
                out.append(buf); buf = ''
            if _wc(p) > mx:            # clausula larga SIN comas -> corte duro
                out.extend(_hard_split(p, mx))
            else:
                buf = p
    if buf:
        out.append(buf)
    return out


def _merge_tiny(chunks, mn=4, mx=MAX_WORDS):
    # fusiona fragmentos diminutos (<mn palabras) con el vecino previo
    out = []
    for c in chunks:
        if out and (_wc(c) < mn or _wc(out[-1]) < mn) and _wc(out[-1]) + _wc(c) <= mx + 4:
            out[-1] = out[-1] + ', ' + c
        else:
            out.append(c)
    return out


def split_line(text, mx=MAX_WORDS):
    text = ' '.join(text.split())
    if _wc(text) <= mx:
        return [text]
    chunks = []
    for s in re.split(r'(?<=[.!?])\s+', text):   # 1) por oracion
        s = s.strip()
        if not s:
            continue
        chunks.extend([s] if _wc(s) <= mx else _split_clause(s, mx))  # 2) por clausula
    return _merge_tiny(chunks)                    # 3) sin fragmentos huerfanos


def gen_trim(text, final):
    raw = final[:-4] + "_raw.wav"
    # XTTS LEE la puntuacion en voz alta ("punto" en puntos A MITAD de frase,
    # "punto punto" con "..."). Limpiar TODO lo que se le MANDA: elipsis/dos
    # puntos/puntos internos -> coma; punto final -> fuera. El guion/subtitulos
    # conservan el original.
    tts_text = (text.replace('...', ', ').replace('…', ', ').replace(':', ','))
    tts_text = tts_text.replace('enlace', 'enláce').replace('Enlace', 'Enláce')
    # LA MARCA SE PRONUNCIA "gaia práim", SIEMPRE. XTTS en "es" lee "Prime" a la española y
    # sale cualquier cosa — medido 2026-08-14 en 3 de 4 tomas del cierre de los cuentos:
    # "Preime", "Gaia I", "Daya Prime". Es LA línea de recuerdo de marca: o suena idéntica
    # en todas las piezas o no sirve. Respelado SOLO para el TTS; el guion y los subtítulos
    # conservan "GAIA Prime".
    tts_text = tts_text.replace('GAIA Prime', 'Gaia Práim').replace('Gaia Prime', 'Gaia Práim')
# ⚠ Si tocas los respelados de arriba, SUBE PREPRO_V (invalida el caché de líneas).
    tts_text = tts_text.strip()
    if tts_text.endswith('.'):
        tts_text = tts_text[:-1]
    tts_text = tts_text.replace('. ', ', ')
    tts_text = ' '.join(tts_text.split())
    # VELOCIDAD (env VEL, default 1.0 = como siempre). XTTS habla parejo y en frases largas
    # arrastra; Ian, 2026-08-10: "suena raro, un poco lento también". 1.0 deja INTACTAS las
    # piezas ya entregadas — sólo la que lo pida cambia.
    tts.tts_to_file(text=tts_text, language="es", speaker_wav=REFS, file_path=raw, speed=VEL)
    dur_raw = _dur(raw)
    # duracion ESPERADA del habla (~0.38s/palabra). Solo cortamos si el clip salio
    # ANOMALAMENTE largo (probable balbuceo de XTTS), y en la pausa CERCA/DESPUES del
    # fin esperado -> NO corta las pausas internas de frases de dos clausulas.
    words = max(1, len(text.split()))
    expected = words * 0.38 + 0.5
    cut = None
    if dur_raw > expected * 1.30:
        o = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af",
                            "silencedetect=noise=-32dB:d=0.18", "-f", "null", "-"],
                           capture_output=True, text=True)
        for ln in o.stderr.splitlines():
            m = re.search(r"silence_start: ([\d.]+)", ln)
            if m and float(m.group(1)) > expected * 0.70:
                cut = float(m.group(1)) + 0.12
                break
        if cut is None:
            cut = expected + 0.6                 # fallback: corta en el fin esperado
    af = (["-af", _SWEET] if SWEET else [])   # EQ dulce (length-preserving -> cut sigue valido)
    args = ["ffmpeg", "-y", "-v", "error", "-i", raw] + (["-t", f"{cut:.3f}"] if cut else []) + af + [final]
    subprocess.run(args, check=True)
    os.remove(raw)
    return _dur(final), bool(cut)


def _trim_sil(wav):
    """Recorta el silencio de ENTRADA y SALIDA de un clip (XTTS mete lead-in y
    cola). Conserva ~20/60ms para que no suene cortado. Evita que el aire se
    ACUMULE al concatenar muchas clausulas (si no, la narracion se alarga y
    'se oye lenta')."""
    tmp = wav[:-4] + "_t.wav"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", wav, "-af",
                        "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-40dB,"
                        "areverse,"
                        "silenceremove=start_periods=1:start_silence=0.06:start_threshold=-40dB,"
                        "areverse", tmp])
    if r.returncode == 0 and os.path.exists(tmp) and _dur(tmp) > 0.15:
        os.replace(tmp, wav)
    elif os.path.exists(tmp):
        os.remove(tmp)


def gen_line(text, final):
    """Una LINEA -> un wav. Si es larga, la parte en clausulas cortas (XTTS
    limpio), genera cada una y las concatena con un respiro. Mapeo linea->wav
    intacto para el timing de aguas abajo."""
    chunks = split_line(text)
    if len(chunks) == 1:
        return gen_trim(text, final)
    tmps, any_trim = [], False
    for j, ch in enumerate(chunks):
        t = final[:-4] + f"_p{j}.wav"
        _d, tr = gen_trim(ch, t)
        _trim_sil(t)          # recorta el silencio de entrada/salida de CADA clausula:
        tmps.append(t); any_trim = any_trim or tr   # asi el aire NO se ACUMULA al concatenar
    sil = final[:-4] + "_sil.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                    "anullsrc=r=24000:cl=mono", "-t", f"{GAP_CLAUSE}", "-c:a", "pcm_s16le", sil], check=True)
    seq = []
    for j, t in enumerate(tmps):
        if j:
            seq.append(sil)
        seq.append(t)
    lst = final[:-4] + "_list.txt"
    with open(lst, "w") as fh:
        for c in seq:
            fh.write(f"file '{os.path.abspath(c)}'\n")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
                    "-i", lst, "-c", "copy", final], check=True)
    for c in tmps + [sil, lst]:
        try:
            os.remove(c)
        except OSError:
            pass
    print(f"    (partida en {len(chunks)} clausulas)", flush=True)
    return _dur(final), any_trim


# OJO: en zsh "LINES" es variable especial ENTERA (alto del terminal) — asignarle
# "7,8,9" la evalua como aritmetica (operador coma) y queda solo el ULTIMO numero.
# Usar LINEAS; LINES se mantiene por compatibilidad para valores de un solo numero.
PREPRO_V = '3'   # versión del preprocesado TTS (enláce=2, +Práim=3)
ONLY = os.environ.get('LINEAS') or os.environ.get('LINES')   # "4" o "4,7": regenerar SOLO esas lineas
VEL = float(os.environ.get('VEL', '1.0'))
TAKES = int(os.environ.get('TAKES', '1'))  # >1: genera N tomas y se queda con la MEDIANA.
# ANTES se quedaba con la MAS CORTA, con la idea de que la vocal alargada de XTTS mete
# duracion de mas. Pero eso selecciona SIEMPRE la toma mas apurada: regenere las 25 lineas
# del anillo con TAKES=3 y el resultado fue 'se escuchan raras' (Ian, 2026-07-28) — cada
# frase era la version atropellada de tres. La MEDIANA evita los dos extremos: ni la
# arrastrada ni la comida. Con TARGET/TARGETS sigue mandando la cercania al objetivo.
TARGET = float(os.environ.get('TARGET', '0'))  # >0: elegir la toma mas CERCANA a esta duracion
                                                # (para no mover el timing de un video ya rendido)
TARGETS = os.environ.get('TARGETS')     # "4.86,3.28,...": target POR LINEA (indice 1..n; 0 = sin target)
_tgts = [float(x) for x in TARGETS.split(',')] if TARGETS else None

# ── HUÉRFANOS FUERA (fix de raíz, 2026-08-17). Este script escribe l01..l0N pero nunca
# borraba los sobrantes de un guion anterior más largo: un l09.wav huérfano contaminó el
# conteo del gate Y el ensamble (4/4 cuentos reprobados el 2026-08-14). El fix vivía en un
# script scratch que se borró — ahora vive donde debe: en la herramienta.
import glob as _glob, hashlib as _hashlib
for _w in _glob.glob(os.path.join(OUT, f"{MOL}_l*.wav")):
    _m = re.search(r'_l(\d+)\.wav$', _w)
    if _m and int(_m.group(1)) > len(lines):
        os.remove(_w)
        print(f"  (huérfano fuera: {os.path.basename(_w)})", flush=True)

# ── CACHÉ POR LÍNEA: si el texto, la velocidad, las tomas, el target, las voces de
# referencia y la versión del preprocesado no cambiaron, el wav existente se REUSA.
# Medido: el fix del silicio regeneró 8 líneas para 1 cambio (~8× de TTS tirado).
# CACHE=0 lo apaga.
_CACHE = os.environ.get('CACHE', '1') != '0'
def _firma(texto, tgt):
    base = '|'.join([texto, str(VEL), str(TAKES), str(tgt), PREPRO_V] + [os.path.basename(r) for r in REFS])
    return _hashlib.md5(base.encode('utf-8')).hexdigest()[:16]

for i, text in enumerate(lines, 1):
    if ONLY and str(i) not in ONLY.split(','):
        continue
    tgt = (_tgts[i - 1] if _tgts and i <= len(_tgts) else TARGET)
    f = os.path.join(OUT, f"{MOL}_l{i:02d}.wav")
    _sf = f[:-4] + '.firma'
    # LEGADO = CONGELADO (2026-08-17): un wav SIN .firma es anterior al sistema de caché —
    # la voz de un GANADOR. Tratarlo como MISS lo regeneraba con una toma nueva de XTTS
    # (pasó: la corrida total sobrescribió las 25+27+31 líneas de anillo/cuarteto/hexámero;
    # se restauraron de las cápsulas de PRIME). Sin firma = se CONSERVA, salvo FORCE=1.
    if os.path.exists(f) and not os.path.exists(_sf) and os.environ.get('FORCE') != '1':
        print(f"  l{i:02d} LEGADO congelado ({_dur(f):5.2f}s) — se conserva (FORCE=1 regenera)  {text[:40]}", flush=True)
        continue
    if _CACHE and not ONLY and os.path.exists(f) and os.path.exists(_sf) \
            and open(_sf).read().strip() == _firma(text, tgt):
        print(f"  l{i:02d} CACHÉ ({_dur(f):5.2f}s)  {text[:40]}", flush=True)
        continue
    best = None; tomas = []
    for tk in range(TAKES):
        cand = f[:-4] + f"_take{tk}.wav" if TAKES > 1 else f
        d, trimmed = gen_line(text, cand)
        score = abs(d - tgt) if tgt > 0 else d
        tomas.append((d, cand, trimmed, score))
        if tgt > 0 and (best is None or score < best[3]):
            best = (d, cand, trimmed, score)
        print(f"  l{i:02d}.t{tk} {d:5.2f}s {'(recortado)' if trimmed else ''}  {text[:40]}", flush=True)
    if TAKES > 1:
        import shutil
        if tgt <= 0:                      # sin objetivo: la MEDIANA, no la mas corta
            tomas.sort(key=lambda t: t[0])
            best = tomas[len(tomas) // 2]
        shutil.copyfile(best[1], f)
        for tk in range(TAKES):
            c = f[:-4] + f"_take{tk}.wav"
            if os.path.exists(c):
                os.remove(c)
        print(f"  l{i:02d} ELEGIDA: {best[0]:5.2f}s", flush=True)
    with open(_sf, 'w') as _fh:
        _fh.write(_firma(text, tgt))
print("LISTO", flush=True)
