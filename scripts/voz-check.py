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

  /home/ian/ytdlp-venv/bin/python scripts/voz-check.py <mol> [<mol2> <mol3>…]
  ... --palabras copo,seis        solo vigila esas palabras (más rápido de leer)

VARIOS MOLS EN UNA CORRIDA (2026-08-17): el modelo large-v3 tarda ~15 s en cargar y el
lote de 5 átomos lo cargaba 5 veces (75 s de puro arranque). Con N argumentos carga UNA
vez y verifica todos; sale 1 si CUALQUIERA falla.

Sale 1 si alguna línea no coincide → sirve como gate en un pipeline.
"""
import os, sys, re, glob, unicodedata

MOLS = [a.lower() for a in sys.argv[1:] if not a.startswith('-')] or ['whex6']
VIGILA = []
if '--palabras' in sys.argv:
    VIGILA = [w.strip().lower() for w in sys.argv[sys.argv.index('--palabras') + 1].split(',') if w.strip()]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# Whisper ESCRIBE en cifras lo que se DIJO en letra ("2.82", "12%", "H2"). Eso no es un
# error de pronunciación, es formato — y si el gate lo reporta como falla, cría lobos y en
# tres corridas nadie lo lee. Se normaliza a palabras ANTES de comparar.
UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
ESP = {10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
       16: 'dieciseis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve', 20: 'veinte',
       # LOS VEINTI- VAN COMPLETOS HASTA EL 29. Faltaban 26-29 y el 26-29 caía al caso
       # genérico `veinte y nueve`, así que el gate reprobó a atomo-cu por decir
       # "veintinueve" —que es lo correcto en español— contra el "29" que escribe Whisper.
       # Un falso positivo por FORMATO es justo lo que hace que nadie lea un gate.
       21: 'veintiuno', 22: 'veintidos', 23: 'veintitres', 24: 'veinticuatro',
       25: 'veinticinco', 26: 'veintiseis', 27: 'veintisiete', 28: 'veintiocho',
       29: 'veintinueve', 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta',
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
    # MILES: mismo falso positivo por FORMATO que ya mordió con el 29 y con el 179, ahora con
    # los AÑOS. Whisper escribe "1977" y el guion dice "mil novecientos setenta y siete";
    # sin esta rama el gate reprobaba una voz que decía exactamente lo correcto.
    if n < 1000000:
        m, r = n // 1000, n % 1000
        cab = 'mil' if m == 1 else f'{_num(str(m))} mil'
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
    # LA MARCA SE CANONIZA. El TTS dice "gaia práim" (respelado en narracion-gen) y Whisper
    # lo escribe como quiere: prime, praim, preime, gaya, daya… Todas son la MISMA marca bien
    # dicha — compararlas letra a letra cría falsos positivos justo en la línea que más se
    # repite de toda la serie.
    CANON = {'praim': 'prime', 'preime': 'prime', 'prim': 'prime',
             'gaya': 'gaia', 'daya': 'gaia', 'gaia': 'gaia'}
    return [CANON.get(t, t) for t in out]


def iguales(a, b):
    """Iguales como LISTA o como CADENA PEGADA. El español ELIDE: "es carbono" suena
    "escarbono" y "necesita a nadie" suena "necesita nadie" — Whisper escribe lo segundo y
    la comparación por tokens reprobaba pronunciaciones PERFECTAS (medido 2026-08-14, 2 de
    5 fallas del lote eran esto). Pegar todo y quitar la 'a' de elisión compara FONÉTICA."""
    if a == b:
        return True
    ja, jb = ''.join(a), ''.join(b)
    if ja == jb:
        return True
    # elisión de la preposición 'a' entre vocales: quítala de ambos lados y compara
    ea = ''.join(x for x in a if x != 'a')
    eb = ''.join(x for x in b if x != 'a')
    return ea == eb

from faster_whisper import WhisperModel
model = WhisperModel('large-v3', device='cuda', compute_type='float16')

fallos_total = 0
for MOL in MOLS:
  NAR = os.path.join(ROOT, 'dist-video', f'{MOL}-narracion')
  GUION = os.path.join(ROOT, 'scripts', 'guiones', f'{MOL}.txt')
  lines = [l.strip() for l in open(GUION, encoding='utf-8') if l.strip()]
  wavs = sorted(glob.glob(os.path.join(NAR, f'{MOL}_l*.wav')))
  if len(wavs) != len(lines):
    print(f'✗ {MOL}: {len(wavs)} wavs vs {len(lines)} líneas del guion')
    fallos_total += 1
    continue
  fallos = 0
  print(f'{MOL}: {len(wavs)} líneas · modelo large-v3 · comparando contra el guion\n')
  for i, (w, texto) in enumerate(zip(wavs, lines), 1):
    segs, _ = model.transcribe(w, language='es', beam_size=5)
    oido = ' '.join(s.text for s in segs).strip()
    a, b = norm(texto), norm(oido)
    if iguales(a, b):
        estado = 'ok'
    else:
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
  print(f'{MOL}: ' + ('✓ la voz DICE el guion' if not fallos else f'✗ {fallos} líneas no coinciden') + '\n')
  fallos_total += fallos

sys.exit(1 if fallos_total else 0)
