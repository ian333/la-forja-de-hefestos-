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
REFS = [
    "/home/ian/mat_048eaee5ef6a8a43439fd57ca0f9d255.mp3",
    "/home/ian/mat_7a8ee26aba0546a34e5fe200b7c1d45e.mp3",
    "/home/ian/mat_93f350ea97ee0873117d6a23fcd60580.mp3",
    "/home/ian/mat_f205feda7e04b50d3eab555e742caea9.mp3",
]
lines = [l.strip() for l in open(GUION, encoding="utf-8") if l.strip()]
os.makedirs(OUT, exist_ok=True)
print(f"{MOL}: {len(lines)} frases -> {OUT}", flush=True)

import torch
from TTS.api import TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cuda" if torch.cuda.is_available() else "cpu")


def _dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "default=nk=1:nw=1", p]).decode().strip())


def gen_trim(text, final):
    raw = final[:-4] + "_raw.wav"
    # XTTS LEE la puntuacion en voz alta ("punto" en puntos A MITAD de frase,
    # "punto punto" con "..."). Limpiar TODO lo que se le MANDA: elipsis/dos
    # puntos/puntos internos -> coma; punto final -> fuera. El guion/subtitulos
    # conservan el original.
    tts_text = (text.replace('...', ', ').replace('…', ', ').replace(':', ','))
    tts_text = tts_text.replace('enlace', 'enláce').replace('Enlace', 'Enláce')
    tts_text = tts_text.strip()
    if tts_text.endswith('.'):
        tts_text = tts_text[:-1]
    tts_text = tts_text.replace('. ', ', ')
    tts_text = ' '.join(tts_text.split())
    tts.tts_to_file(text=tts_text, language="es", speaker_wav=REFS, file_path=raw)
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
    args = ["ffmpeg", "-y", "-v", "error", "-i", raw] + (["-t", f"{cut:.3f}"] if cut else []) + [final]
    subprocess.run(args, check=True)
    os.remove(raw)
    return _dur(final), bool(cut)


# OJO: en zsh "LINES" es variable especial ENTERA (alto del terminal) — asignarle
# "7,8,9" la evalua como aritmetica (operador coma) y queda solo el ULTIMO numero.
# Usar LINEAS; LINES se mantiene por compatibilidad para valores de un solo numero.
ONLY = os.environ.get('LINEAS') or os.environ.get('LINES')   # "4" o "4,7": regenerar SOLO esas lineas
TAKES = int(os.environ.get('TAKES', '1'))  # >1: genera N tomas y se queda con la MAS CORTA
                                            # (la vocal alargada de XTTS = duracion extra)
TARGET = float(os.environ.get('TARGET', '0'))  # >0: elegir la toma mas CERCANA a esta duracion
                                                # (para no mover el timing de un video ya rendido)
TARGETS = os.environ.get('TARGETS')     # "4.86,3.28,...": target POR LINEA (indice 1..n; 0 = sin target)
_tgts = [float(x) for x in TARGETS.split(',')] if TARGETS else None
for i, text in enumerate(lines, 1):
    if ONLY and str(i) not in ONLY.split(','):
        continue
    tgt = (_tgts[i - 1] if _tgts and i <= len(_tgts) else TARGET)
    f = os.path.join(OUT, f"{MOL}_l{i:02d}.wav")
    best = None
    for tk in range(TAKES):
        cand = f[:-4] + f"_take{tk}.wav" if TAKES > 1 else f
        d, trimmed = gen_trim(text, cand)
        score = abs(d - tgt) if tgt > 0 else d
        if best is None or score < best[3]:
            best = (d, cand, trimmed, score)
        print(f"  l{i:02d}.t{tk} {d:5.2f}s {'(recortado)' if trimmed else ''}  {text[:40]}", flush=True)
    if TAKES > 1:
        import shutil
        shutil.copyfile(best[1], f)
        for tk in range(TAKES):
            c = f[:-4] + f"_take{tk}.wav"
            if os.path.exists(c):
                os.remove(c)
        print(f"  l{i:02d} ELEGIDA: {best[0]:5.2f}s", flush=True)
print("LISTO", flush=True)
