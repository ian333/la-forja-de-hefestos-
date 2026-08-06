#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bin-variante.py — remuestrea un .bin YA CALCULADO a otro presupuesto de puntos / tamaño.

Por qué existe (2026-08-05): "El codo" salió como una pared de luz. La causa medida es
DENSIDAD PROYECTADA, no física: 600k puntos a d=65 con sprites de 0.034–0.094 caen TODOS
contra el piso de 1.2 px del shader (CinematicAtom.tsx:428) → un mat uniforme sin estructura,
12× más denso que el precedente que sí funciona (octano: 0.058 puntos/px).

Barrer eso recalculando ρ cuesta minutos por variante y NO cambia la física: el muestreo ya
está hecho. Esto sólo tira puntos (submuestreo uniforme = sigue siendo ∝ρ, insesgado) y escala
el tamaño. Sirve para ENCONTRAR el punto de operación con stills; el ganador se hornea después
en precompute-cadena.py para que la cápsula siga siendo reproducible desde la física.

  python3 scripts/bin-variante.py chain-codo.bin salida.bin --pts 120000 --size-k 5.0
"""
import sys, os, argparse
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--pts', type=int, default=0, help='0 = deja los que hay')
ap.add_argument('--size-k', type=float, default=1.0)
ap.add_argument('--semilla', type=int, default=1337)
a = ap.parse_args()

RAIZ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'precomputed')
src = a.src if os.path.sep in a.src else os.path.join(RAIZ, a.src)
dst = a.dst if os.path.sep in a.dst else os.path.join(RAIZ, a.dst)

buf = open(src, 'rb').read()
N, K = np.frombuffer(buf, '<i4', 2, 0)
ext = np.frombuffer(buf, '<f4', 1, 8)[0]
off = 12
nuc = np.frombuffer(buf, '<f4', K * 4, off).reshape(K, 4); off += K * 16
pos = np.frombuffer(buf, '<f4', N * 3, off).reshape(N, 3); off += N * 12
col = np.frombuffer(buf, '<f4', N * 3, off).reshape(N, 3); off += N * 12
siz = np.frombuffer(buf, '<f4', N, off); off += N * 4
shl = np.frombuffer(buf, '<f4', N, off)

n = a.pts if a.pts and a.pts < N else N
if n < N:
    # submuestreo UNIFORME sin reemplazo: cada punto ya venía sorteado con p∝ρ, así que
    # quedarse con un subconjunto al azar conserva la distribución. No re-pondera nada.
    idx = np.random.default_rng(a.semilla).choice(N, size=n, replace=False)
    idx.sort()
    pos, col, siz, shl = pos[idx], col[idx], siz[idx], shl[idx]
siz = (siz * a.size_k).astype('<f4')

with open(dst, 'wb') as f:
    f.write(np.array([n, K], '<i4').tobytes())
    f.write(np.array([ext], '<f4').tobytes())
    f.write(np.ascontiguousarray(nuc, '<f4').tobytes())
    for arr in (pos, col):
        f.write(np.ascontiguousarray(arr, '<f4').tobytes())
    for arr in (siz, shl):
        f.write(np.ascontiguousarray(arr, '<f4').tobytes())
print(f'   {os.path.basename(dst)}  {n} pts (de {N})  tamaño ×{a.size_k}  '
      f'[{siz.min():.3f}–{siz.max():.3f}]  {os.path.getsize(dst)/1024/1024:.2f} MB')
