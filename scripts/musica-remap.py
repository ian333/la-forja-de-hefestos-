#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
musica-remap.py — re-ancla la pieza compuesta ("Casi vacío — arpegios de agua",
compuesta sobre la narración de n2v2) a la narración de OTRA molécula.

Warp piecewise-linear del tiempo: ancla i = inicio de línea i de n2v2 → inicio de
línea i del mol destino (+ 0→0 y fin→DUR). Onsets warpeados; duraciones escaladas
por la pendiente local del segmento; velocidades intactas. Clamp a DUR (70s).

Uso: python3 scripts/musica-remap.py <mol> [dur=70]
Lee  dist-video/n2v2-narracion/{musica.json,segs.json} + dist-video/<mol>-narracion/segs.json
Sale dist-video/<mol>-narracion/musica-fit.json
"""
import json, os, sys

MOL = sys.argv[1]
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 70.0
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAR = os.path.join(ROOT, 'dist-video')

piece = json.load(open(os.path.join(NAR, 'n2v2-narracion', 'musica.json')))
src = json.load(open(os.path.join(NAR, 'n2v2-narracion', 'segs.json')))
dst = json.load(open(os.path.join(NAR, f'{MOL}-narracion', 'segs.json')))
n = min(len(src), len(dst))
xs = [0.0] + [s['start'] for s in src[:n]] + [max(78.0, src[-1]['end'] + 4)]
ys = [0.0] + [d['start'] for d in dst[:n]] + [DUR]

def warp(t):
    for i in range(len(xs) - 1):
        if t <= xs[i + 1] or i == len(xs) - 2:
            k = (t - xs[i]) / max(1e-6, xs[i + 1] - xs[i])
            return ys[i] + k * (ys[i + 1] - ys[i])
    return ys[-1]

def slope(t):
    for i in range(len(xs) - 1):
        if t <= xs[i + 1] or i == len(xs) - 2:
            return (ys[i + 1] - ys[i]) / max(1e-6, xs[i + 1] - xs[i])
    return 1.0

out = {**piece, 'title': piece.get('title', '') + f' → {MOL}'}
out['notes'] = []
for nt in piece['notes']:
    t2 = warp(nt['t'])
    d2 = max(0.15, nt['d'] * slope(nt['t']))
    if t2 >= DUR - 0.3:
        continue
    d2 = min(d2, DUR - t2)
    out['notes'].append({**nt, 't': round(t2, 3), 'd': round(d2, 3)})
if 'pedal' in piece:
    out['pedal'] = [{**p, 't': round(min(warp(p['t']), DUR), 3)} for p in piece['pedal']]
dst_path = os.path.join(NAR, f'{MOL}-narracion', 'musica-fit.json')
json.dump(out, open(dst_path, 'w'), ensure_ascii=False)
print(f"ok {dst_path}  notas={len(out['notes'])}  tmax={max(nn['t']+nn['d'] for nn in out['notes']):.1f}")
