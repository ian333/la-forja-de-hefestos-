#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""recalibrar-beats.py — clava las TOMAS y las CAPAS a los segundos REALES de la voz.

El paso que el CANON marca como obligatorio (§sincronía): "cada regen de voz cambia TODAS
las duraciones → recalibrar SIEMPRE". Antes se hacía a mano; aquí sale del manifiesto:

  videos/<id>.json → guion.mapa_linea_toma  (qué líneas van con qué toma)
  dist-video/<mol>-narracion/segs.json      (cuándo suena cada línea, MEDIDO)
        ↓
  duraciones de las tomas + ventanas de las capas, en segundos reales.

  python3 scripts/recalibrar-beats.py <id> [--aplicar]

Sin --aplicar solo IMPRIME (para revisar). Con --aplicar escribe el manifiesto.
"""
import sys, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ID = sys.argv[1]
APLICAR = '--aplicar' in sys.argv

MF = os.path.join(ROOT, 'videos', f'{ID}.json')
man = json.load(open(MF, encoding='utf-8'))
mol = re.search(r'm=([a-z0-9]+)', man['escena']['query']).group(1)
SEGS = os.path.join(ROOT, 'dist-video', f'{mol}-narracion', 'segs.json')
segs = json.load(open(SEGS, encoding='utf-8'))

print(f"═══ {ID} · {len(segs)} líneas de voz · total {segs[-1]['end']:.2f}s ═══\n")

def rango(spec):
    """'13-20' o '26' → (primera, última) en base 0."""
    if '-' in spec:
        a, b = spec.split('-'); return int(a) - 1, int(b) - 1
    n = int(spec) - 1; return n, n

filas = []
for e in man['guion']['mapa_linea_toma']:
    a, b = rango(e['lineas'])
    if a >= len(segs):
        print(f"⚠ el mapa cita la línea {a+1} pero la voz tiene {len(segs)} — revisar"); continue
    b = min(b, len(segs) - 1)
    ini, fin = segs[a]['start'], segs[b]['end']
    filas.append({'toma': e['toma'], 'lineas': e['lineas'], 'ini': ini, 'fin': fin,
                  'dur': fin - ini, 'muestra': e['muestra']})

# la última toma se estira hasta el final del video (cola en silencio)
DUR_VIDEO = round(segs[-1]['end'] + 3.0, 1)
if filas: filas[-1]['fin'] = DUR_VIDEO; filas[-1]['dur'] = DUR_VIDEO - filas[-1]['ini']
# y la primera arranca en 0 (el frame 1 es el pico, no hay fade tímido)
if filas: filas[0]['ini'] = 0.0; filas[0]['dur'] = filas[0]['fin']

print("toma                 líneas   inicio    fin    dur   muestra")
for f in filas:
    print(f"{f['toma']:20s} {f['lineas']:>6s}  {f['ini']:6.2f} {f['fin']:6.2f} {f['dur']:6.2f}   {f['muestra'][:44]}")
print(f"\nDURACIÓN DEL VIDEO: {DUR_VIDEO}s  (voz {segs[-1]['end']:.1f}s + 3s de cola)")

print("\n── ShotEntry para CAMERA_SHOTS (pegar las dur) ──")
print("   " + "  ".join(f"{f['dur']:.1f}" for f in filas))

# CAPAS: las ventanas salen de las tomas cuyo propósito lo pide (busca palabras clave)
def win_de(clave):
    return [[round(f['ini'], 1), round(f['fin'], 1)] for f in filas if clave in f['muestra'].lower()]
capas = {
  'nubes':    {'base': 1,    'mods': [{'wins': win_de('canto'), 'a': -0.30, 'label': 'de canto: baja la nube para LEER el pucker'}]},
  'campo':    {'base': 1,    'mods': [{'wins': win_de('electrones') + win_de('carga'), 'a': -0.85, 'label': 'campo baja cuando hablo de electrones/carga'}]},
  'parpadeo': {'base': 0.42, 'mods': [{'wins': win_de('electrones'), 'a': 0.42, 'label': 'parpadeo en "esta nube son sus electrones"'}]},
  'spin':     {'base': 1,    'mods': [{'wins': win_de('cooperatividad') + win_de('puente'), 'a': 0.9, 'label': 'Δρ ARDE: los puentes y la cooperatividad'}]},
  'acc':      {'base': 1,    'mods': [{'wins': win_de('una molécula') + win_de('legibilidad'), 'a': 0.5, 'label': 'ORO del oxígeno en "un oxígeno y dos hidrógenos"'}]},
}
capas = {k: {'base': v['base'], 'mods': [m for m in v['mods'] if m['wins']]} for k, v in capas.items()}
print("\n── CAPAS (capas.ts) derivadas de la voz ──")
print(json.dumps(capas, ensure_ascii=False, indent=1))

if APLICAR:
    man['formato']['dur'] = DUR_VIDEO
    man['tomas']['lista'] = [{'t': [round(f['ini'], 2), round(f['fin'], 2)], 'toma': f['toma'], 'muestra': f['muestra']} for f in filas]
    man['tomas']['duraciones_shotentry'] = [round(f['dur'], 1) for f in filas]
    man['tomas'].pop('pendiente', None)
    man['capas'] = {'spec': capas, 'origen': 'derivadas de segs.json por recalibrar-beats.py'}
    json.dump(man, open(MF, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f"\n✓ manifiesto actualizado: {MF}")
else:
    print("\n(dry-run — usa --aplicar para escribir el manifiesto)")
