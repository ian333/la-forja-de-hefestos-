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


# Whisper ESCRIBE en cifras lo que se DIJO en letra ("2.82", "12%", "H2"). Eso no es un
# error de pronunciación, es formato — y si el gate lo reporta como falla, cría lobos y en
# tres corridas nadie lo lee. Se normaliza a palabras ANTES de comparar.
UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
ESP = {10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
       16: 'dieciseis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve', 20: 'veinte',
       21: 'veintiuno', 22: 'veintidos', 23: 'veintitres', 24: 'veinticuatro',
       25: 'veinticinco', 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta',
       60: 'sesenta', 70: 'setenta', 80: 'ochenta', 90: 'noventa', 100: 'cien'}


def _num(tok):
    """'2.82' → 'dos punto ocho dos' · '25' → 'veinticinco' (como lo LEE una persona)."""
    if '.' in tok or ',' in tok:
        ent, _, dec = tok.replace(',', '.').partition('.')
        return ' '.join([_num(ent), 'punto'] + [UNI[int(d)] for d in dec if d.isdigit()])
    n = int(tok)
    if n < 10: return UNI[n]
    if n in ESP: return ESP[n]
    if n < 100: return f'{ESP[n // 10 * 10]} y {UNI[n % 10]}'
    # CENTENAS: sin esto el gate gritaba por "179" (Whisper) contra "ciento setenta y nueve"
    # (guion) — un falso positivo por FORMATO, que es justo lo que hace que nadie lea un gate.
    if n < 1000:
        c, r = n // 100, n % 100
        cab = 'cien' if n == 100 else ('ciento' if c == 1 else
              {5: 'quinientos', 7: 'setecientos', 9: 'novecientos'}.get(c, UNI[c] + 'cientos'))
        return cab if r == 0 else f'{cab} {_num(str(r))}'
    return tok


def norm(s):
    """minúsculas, sin acentos, cifras a palabras — comparamos FONÉTICA, no ortografía."""
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('%', ' por ciento ')
    s = re.sub(r'\bh2\b', 'h dos', s)                      # Whisper escribe la fórmula
    s = re.sub(r'[^a-zñ0-9 .,]', ' ', s)
    # GÉNERO de las centenas: Whisper escribe '943' en CIFRAS y `_num` sólo sabe expandir en
    # masculino, así que 'novecientas kilocalorías' (femenino, correcto) salía marcado como
    # error de voz. El defecto era del gate, no del TTS. Se canoniza a masculino de los dos
    # lados: la distinción no es pronunciación, es concordancia.
    s = s.replace('cientas', 'cientos')
    out = []
    for t in s.split():
        t = t.strip('.,')
        if not t: continue
        out.extend(_num(t).split() if re.fullmatch(r'\d+(?:[.,]\d+)?', t) else [t])
    return out

from faster_whisper import WhisperModel
model = WhisperModel('large-v3', device='cuda', compute_type='float16')

fallos = 0
print(f'{MOL}: {len(wavs)} líneas · modelo large-v3 · comparando contra el guion\n')
for i, (w, texto) in enumerate(zip(wavs, lines), 1):
    segs, _ = model.transcribe(w, language='es', beam_size=5)
    oido = ' '.join(s.text for s in segs).strip()
    a, b = norm(texto), norm(oido)
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
