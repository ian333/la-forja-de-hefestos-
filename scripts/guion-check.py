#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""guion-check.py — portero del GUION, antes de gastar voz y render.

Revisa los gotchas que YA pagamos (docs/CANON-VIDEO.md §voz y §subtítulos):
  · línea > 46 caracteres → desborda el subtítulo a 4K (caso CO)
  · "..." / ":" / puntos internos → XTTS los LEE ("punto punto")
  · voseo (el proyecto es español MEXICANO)
  · doble sentido / albur (caso real: "míralos correrse" en El puente)
  · palabra ambigua al final de frase (zona de riesgo prosódico del TTS)
  · duración estimada (~0.38 s/palabra) vs la duración objetivo del manifiesto

  python3 scripts/guion-check.py scripts/guiones/<mol>.txt [--dur 77]
"""
import sys, re

RUTA = sys.argv[1]
DUR = float(sys.argv[sys.argv.index('--dur') + 1]) if '--dur' in sys.argv else None
MAXCH = 46
SEG_POR_PALABRA = 0.38

VOSEO = re.compile(r'\b(vos|tenés|podés|querés|sabés|elevás|mirá|andá|vení|hacés|decís)\b')  # SOLO acentuadas: 'mira/anda/ven' es el tú mexicano correcto
# albures/doble sentido que ya nos mordieron o son riesgo conocido en MX
ALBUR = re.compile(r'\b(correrse|se corren|correte|venirse|se vienen|meterla|metela|c[oó]gel[oa]|palo|huevos)\b', re.I)
AMBIGUAS = {'tomas', 'come', 'pico', 'cola', 'palo', 'mama', 'papa', 'polla'}

lineas = [l.rstrip('\n') for l in open(RUTA, encoding='utf-8') if l.strip()]
print(f"═══ {RUTA} — {len(lineas)} líneas ═══\n")
avisos = 0
palabras_tot = 0

for i, L in enumerate(lineas, 1):
    p = len(L.split()); palabras_tot += p
    msgs = []
    if len(L) > MAXCH:
        msgs.append(f"LARGA {len(L)} chars (>{MAXCH}) — video-subs.py la PARTE en 2 renglones; ok si la frase lo aguanta")
    if '...' in L or '…' in L:
        msgs.append('"..." → XTTS lo LEE como "punto punto"')
    if ':' in L:
        msgs.append('":" → limpiar antes del TTS (narracion-gen lo hace, verificar)')
    if VOSEO.search(L):
        msgs.append(f"VOSEO ({VOSEO.search(L).group()}) — el proyecto es español MEXICANO")
    if ALBUR.search(L):
        msgs.append(f"⚠ DOBLE SENTIDO ({ALBUR.search(L).group()}) — pasó con 'míralos correrse'")
    ult = re.sub(r'[^\wáéíóúñ]', '', L.split()[-1].lower()) if L.split() else ''
    if ult in AMBIGUAS:
        msgs.append(f"palabra ambigua al FINAL ('{ult}') — zona de riesgo prosódico")
    marca = "  ⚠ " if msgs else "    "
    print(f"{i:2d}{marca}{L}")
    for m in msgs:
        print(f"      └─ {m}"); avisos += 1

est = palabras_tot * SEG_POR_PALABRA + len(lineas) * 0.5   # + aire entre líneas
print(f"\npalabras {palabras_tot} · duración estimada ≈ {est:.1f}s")
if DUR:
    d = est - DUR
    print(f"objetivo {DUR:.0f}s → diferencia {d:+.1f}s "
          + ("(cabe)" if abs(d) <= DUR * 0.12 else "⚠ AJUSTAR el guion o la duración"))
print(f"\n{'✅ guion limpio' if avisos == 0 else f'⚠ {avisos} aviso(s) — revisar antes de la voz'}")
sys.exit(0)
