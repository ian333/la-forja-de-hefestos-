#!/usr/bin/env python3
"""Full decomposition of 827-9999-904 rev C for Fusion 360 recreation."""
import json, math

d = json.load(open('public/viz-data/827-9999-904_rev_c.json'))

def fmt_centroid(c):
    if isinstance(c, dict): return f"({c['x']:.2f}, {c['y']:.2f})"
    if isinstance(c, list): return f"({c[0]:.2f}, {c[1]:.2f})"
    return str(c)

bb = d['boundingBox']
W = bb['max'][0] - bb['min'][0]
H = bb['max'][1] - bb['min'][1]
D = bb['max'][2] - bb['min'][2]

print('╔══════════════════════════════════════════════════════╗')
print('║  827-9999-904 REV C — DECOMPOSICIÓN COMPLETA        ║')
print('║  Para recrear en Fusion 360                         ║')
print('╚══════════════════════════════════════════════════════╝')
print()
print(f'Bounding Box:  {W:.2f} x {H:.2f} x {D:.2f} mm')
print(f'Diagonal: {d["diagonal"]:.2f}mm')
print()

base = d.get('base', {})
print(f'Base: {base.get("label","?")}  area={base.get("area",0):.1f}mm²')
print()

for dd in d.get('directions', []):
    n = dd['normal']
    print(f'Direction: {dd["label"]:4s}  normal=[{n[0]:.1f},{n[1]:.1f},{n[2]:.1f}]  offsetRange={dd.get("offsetRange",[])}')
print()

print('=== PROFILES (15) ===')
for i, p in enumerate(d['profiles']):
    ents = p.get('entities', [])
    print(f'')
    print(f'--- P{i}: {p["type"]:8s} {"[HOLE]" if p.get("isHole") else ""}---')
    print(f'  Plane: {p.get("planeLabel","?")}  offset={p.get("offset",0):.3f}mm')
    print(f'  Area: {p.get("area",0):.2f}mm²  Centroid: {fmt_centroid(p.get("centroid","?"))}')
    if p.get('radius'): print(f'  Radius: {p["radius"]:.3f}mm  (ø{p["radius"]*2:.3f}mm)')
    
    for j, e in enumerate(ents):
        if e['type'] == 'circle':
            print(f'    CIRCLE  center=({e["center"][0]:.2f}, {e["center"][1]:.2f})  R={e["radius"]:.3f}  ø={e["radius"]*2:.3f}')
        elif e['type'] == 'arc':
            print(f'    ARC     center=({e["center"][0]:.2f}, {e["center"][1]:.2f})  R={e["radius"]:.3f}  span={e.get("spanDeg",0):.1f}°')
        elif e['type'] == 'line':
            dx = e['end'][0]-e['start'][0]; dy = e['end'][1]-e['start'][1]
            L = math.sqrt(dx*dx+dy*dy)
            print(f'    LINE    ({e["start"][0]:.2f},{e["start"][1]:.2f})->({e["end"][0]:.2f},{e["end"][1]:.2f})  L={L:.2f}mm')

print()
print('=== FEATURES (7) — LA RECETA PARA FUSION ===')
for i, f in enumerate(d['features']):
    print(f'')
    print(f'  F{i}: {f["label"]}')
    for k,v in sorted(f.items()):
        if k != 'label':
            if isinstance(v, float): print(f'      {k}: {v:.3f}')
            else: print(f'      {k}: {v}')

# Summary for Fusion
print()
print('╔══════════════════════════════════════════════════════╗')
print('║  RECETA FUSION 360 (paso a paso)                    ║')
print('╚══════════════════════════════════════════════════════╝')
print("""
PASO 1: Sketch en plano XY (Top)
  - Rectángulo 102.54 x 69.55 mm centrado en origen

PASO 2: Extrude 19.50 mm (hacia -Z o simétrico)

PASO 3: 5 slots lineales (Pattern)
  - Cada slot: pocket 60.6 x 1.3 mm
  - Patrón lineal x5

PASO 4: 4 holes en patrón circular
  - ø4.75mm through-all
  - Bolt circle pattern x4

PASO 5: Pocket rectangular
  - 8.9 x 69.5 mm

PASO 6: 2x Hole ø9.50mm

PASO 7: 1x Hole ø3.81mm

PASO 8: 1x Hole ø4.75mm (individual, fuera del patrón)

Entidades en Fusion: ~12-15 features en el timeline
  (1 extrude + 1 pattern-pocket + 1 pattern-hole + 1 pocket + 3 holes = 7-8 features)
""")
