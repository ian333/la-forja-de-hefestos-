#!/usr/bin/env python3
"""UNE las tomas de varias filmaciones en una sola película (enlaces simbólicos renumerados + tomas.json con los tiempos corridos).
uso: python3 une-tomas.py <salida> <dir>:<prefijos,coma> [<dir>:<prefijos> ...]   p.ej.  pelicula1:01,02,03,04,05 pelicula2a:06 pelicula2b:07 pelicula1-final:08,09"""
import json, os, sys
OUT = sys.argv[1]; os.makedirs(os.path.join(OUT, 'cuadros'), exist_ok=True)
for f in os.listdir(os.path.join(OUT, 'cuadros')): os.unlink(os.path.join(OUT, 'cuadros', f))
n = 0; tomas = []; fps = None
for arg in sys.argv[2:]:
    d, pre = arg.split(':'); pre = pre.split(',')
    T = json.load(open(os.path.join(d, 'tomas.json'))); fps = fps or T['fps']; assert T['fps'] == fps
    for t in T['tomas']:
        if not any(t['nombre'].startswith(p) for p in pre): continue
        a, b = round(t['desde'] * fps), round(t['hasta'] * fps); k0 = n
        for k in range(a, b):
            os.symlink(os.path.abspath(os.path.join(d, 'cuadros', f'{k:06d}.jpg')), os.path.join(OUT, 'cuadros', f'{n:06d}.jpg')); n += 1
        tomas.append({'nombre': t['nombre'], 'desde': k0 / fps, 'hasta': n / fps, 'de': d})
        print(f'{t["nombre"]:34s} {b - a:5d} cuadros  ← {d}   → {k0 / fps:6.2f}–{n / fps:6.2f} s')
json.dump({'fps': fps, 'tomas': tomas}, open(os.path.join(OUT, 'tomas.json'), 'w'), ensure_ascii=False, indent=1)
print(f'{n} cuadros = {n / fps:.1f} s')
