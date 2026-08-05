#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
voz-check.py — EL PORTERO DE LA VOZ: transcribe lo que XTTS de verdad DIJO y lo compara
con el guion, palabra por palabra.

Por qué existe (2026-08-04): en "El hexágono" la palabra **copo** salió sonando **popo**.
Nadie lo cachó hasta que el video estaba renderizado, ensamblado y PUBLICADO — porque toda
la cadena verifica píxeles (cuadros negros, quemado, corrupción) y NADA verificaba el audio.
Un video de química que dice "popo de nieve" no es un defecto menor: es el video entero.

XTTS confunde plosivas (k/p/t) sobre todo en palabras cortas y aisladas. La única forma
honesta de saberlo sin oídos es TRANSCRIBIR y comparar.

  /home/ian/ytdlp-venv/bin/python scripts/voz-check.py <mol>
  ... --palabras copo,seis        solo vigila esas palabras (más rápido de leer)

Sale 1 si alguna línea no coincide → sirve como gate en un pipeline.
"""
import os, sys, re, glob, unicodedata

MOL = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'whex6').lower()
VIGILA = []
if '--palabras' in sys.argv:
    VIGILA = [w.strip().lower() for w in sys.argv[sys.argv.index('--palabras') + 1].split(',') if w.strip()]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAR = os.path.join(ROOT, 'dist-video', f'{MOL}-narracion')
GUION = os.path.join(ROOT, 'scripts', 'guiones', f'{MOL}.txt')

lines = [l.strip() for l in open(GUION, encoding='utf-8') if l.strip()]
wavs = sorted(glob.glob(os.path.join(NAR, f'{MOL}_l*.wav')))
if len(wavs) != len(lines):
    sys.exit(f'✗ {len(wavs)} wavs vs {len(lines)} líneas del guion')


def norm(s):
    """minúsculas, sin acentos ni puntuación — comparamos FONÉTICA, no ortografía."""
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-zñ0-9 ]', ' ', s).split()


# números que el guion escribe con letra y Whisper suele devolver como dígito
CIFRAS = {'0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro', '5': 'cinco',
          '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve', '10': 'diez', '12': 'doce',
          '18': 'dieciocho', '19': 'diecinueve', '25': 'veinticinco'}

from faster_whisper import WhisperModel
model = WhisperModel('large-v3', device='cuda', compute_type='float16')

fallos = 0
print(f'{MOL}: {len(wavs)} líneas · modelo large-v3 · comparando contra el guion\n')
for i, (w, texto) in enumerate(zip(wavs, lines), 1):
    segs, _ = model.transcribe(w, language='es', beam_size=5)
    oido = ' '.join(s.text for s in segs).strip()
    a, b = norm(texto), [CIFRAS.get(x, x) for x in norm(oido)]
    if a == b:
        estado = 'ok'
    else:
        # ¿qué palabras se perdieron o cambiaron?
        difA = [x for x in a if x not in b]
        difB = [x for x in b if x not in a]
        interesa = (not VIGILA) or any(v in ' '.join(difA + [' '.join(a)]) for v in VIGILA)
        estado = f'DIFIERE  guion→{difA}  oído→{difB}' if interesa else 'ok (dif menor)'
        if interesa:
            fallos += 1
    if estado.startswith('DIFIERE'):
        print(f'  l{i:02d}  ✗ {estado}')
        print(f'        guion: {texto}')
        print(f'        oído : {oido}')
    else:
        print(f'  l{i:02d}  ✓ {texto[:58]}')

print(f'\n{"✓ la voz DICE el guion" if not fallos else f"✗ {fallos} líneas no coinciden"}')
sys.exit(1 if fallos else 0)
