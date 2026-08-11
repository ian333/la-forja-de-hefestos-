#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verificar-orbitales.py — ¿EL .bin TIENE ORBITALES, O SON BOLAS?

Existe porque el defecto que Ian cazó el 2026-08-11 ("son simples puntos en una nube
circular, no hay orbitales") era INVISIBLE para todos los gates que había: el archivo
estaba bien formado, el SCF convergía, las energías eran correctas y el render no tenía
cuadros negros. Lo único que estaba mal era la FORMA — y ningún número la miraba.

Mide la ANISOTROPÍA de cada canal: <|x|/r>, <|y|/r>, <|z|/r> sobre sus puntos.
  · una nube esférica  → los tres valores iguales (~0.50) ⇒ razón ~1.0
  · una mancuerna p    → UNO alto (~0.7-0.9) y dos bajos  ⇒ razón >> 1
  · un trébol d        → dos altos y uno bajo, o el patrón propio de cada m

CONTROL: los canales s DEBEN salir isótropos (razón ~1.0). Si un s sale anisótropo, el
muestreo está sesgado y no hay que creerle a los p/d tampoco.

    python3 scripts/verificar-orbitales.py public/precomputed/atoms/z010-v3.bin
"""
import struct, sys
import numpy as np

ETI = {0: ['s'], 1: ['px', 'py', 'pz'],
       2: ['dxy', 'dyz', 'dz2', 'dxz', 'dx2-y2'],
       3: ['f1', 'f2', 'f3', 'fz3', 'f5', 'f6', 'f7']}


def lee(ruta):
    b = open(ruta, 'rb').read()
    magia = b[:4]
    if magia not in (b'ATM2', b'ATM3'):
        raise SystemExit(f'firma inesperada: {magia!r}')
    orb = magia == b'ATM3'
    o = 4
    Z, M, S, _ = struct.unpack_from('<4i', b, o); o += 16
    POSQ, L = struct.unpack_from('<2f', b, o); o += 8
    canales = []
    for _ in range(S):
        if orb:
            n, l, ne, m = struct.unpack_from('<4i', b, o); o += 16
        else:
            n, l, ne = struct.unpack_from('<3i', b, o); o += 12; m = -1
        canales.append((n, l, ne, m))
    pos = np.frombuffer(b, dtype='<i2', count=M * 3, offset=o).reshape(M, 3) / POSQ
    o += M * 6
    sidx = np.frombuffer(b, dtype=np.uint8, count=M, offset=o)
    return Z, L, canales, pos, sidx, orb


def main():
    Z, L, canales, pos, sidx, orb = lee(sys.argv[1])
    print(f'Z={Z}  canales={len(canales)}  puntos={len(pos)}  formato={"ATM3 (por ORBITAL)" if orb else "ATM2 (por SUBCAPA)"}')
    print(f'{"canal":10s} {"pts":>7} {"e-":>3}   {"<|x|/r>":>8}{"<|y|/r>":>8}{"<|z|/r>":>8}   razon  veredicto')
    malos = 0
    for i, (n, l, ne, m) in enumerate(canales):
        P = pos[sidx == i]
        r = np.linalg.norm(P, axis=1)
        k = r > 1e-6
        P, r = P[k], r[k]
        if len(P) == 0:
            continue
        mu = (np.abs(P) / r[:, None]).mean(axis=0)
        razon = mu.max() / max(mu.min(), 1e-9)
        nm = f'{n}{ETI.get(l, ["?"] * 9)[m] if m >= 0 else "spdfg"[l]}'
        # un s DEBE ser isótropo; un p/d con m declarado DEBE tener forma
        if l == 0:
            ok = razon < 1.15
            ver = 'esferico OK' if ok else 'SESGO en un s'
        elif m >= 0:
            ok = razon > 1.5
            ver = 'CON FORMA' if ok else 'SIN FORMA (bola)'
        else:
            ok = True
            ver = 'subcapa (sin m)'
        if not ok:
            malos += 1
        print(f'{nm:10s} {len(P):>7} {ne:>3}   {mu[0]:8.3f}{mu[1]:8.3f}{mu[2]:8.3f}   {razon:5.2f}x  {ver}')
    if malos:
        print(f'\n✗ {malos} canal(es) no pasan')
        return 1
    print('\n✓ los canales angulares tienen forma y los s son isótropos')
    return 0


if __name__ == '__main__':
    sys.exit(main())
