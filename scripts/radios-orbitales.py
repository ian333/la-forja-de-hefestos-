#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
radios-orbitales.py — el RADIO de cada canal de un .bin, y cuánto lo infla el monótono.

Existe porque el encuadre del barrido usa el p90 del radio de cada canal, y ese número
decide a qué distancia se pone la cámara. Si un canal queda con un radio mucho mayor que
su nube real, la cámara se aleja y el orbital sale como manchita al centro — que es
exactamente lo que se vio en el 3p del cromo (2026-08-11).

    python3 scripts/radios-orbitales.py public/precomputed/atoms/z024-v3.bin
"""
import struct, sys
import numpy as np

ETI = {0: ['s'], 1: ['px', 'py', 'pz'],
       2: ['dxy', 'dyz', 'dz2', 'dxz', 'dx2-y2'],
       3: ['f1', 'f2', 'f3', 'fz3', 'f5', 'f6', 'f7']}


def main():
    b = open(sys.argv[1], 'rb').read()
    orb = b[:4] == b'ATM3'
    o = 4
    Z, M, S, _ = struct.unpack_from('<4i', b, o); o += 16
    POSQ, L = struct.unpack_from('<2f', b, o); o += 8
    ch = []
    for _ in range(S):
        if orb:
            n, l, ne, m = struct.unpack_from('<4i', b, o); o += 16
        else:
            n, l, ne = struct.unpack_from('<3i', b, o); o += 12; m = -1
        ch.append((n, l, ne, m))
    pos = np.frombuffer(b, dtype='<i2', count=M * 3, offset=o).reshape(M, 3) / POSQ
    o += M * 6
    sid = np.frombuffer(b, dtype=np.uint8, count=M, offset=o)

    p90, p50 = [], []
    for i in range(len(ch)):
        r = np.linalg.norm(pos[sid == i], axis=1)
        p90.append(float(np.percentile(r, 90)) if len(r) else 0.0)
        p50.append(float(np.percentile(r, 50)) if len(r) else 0.0)
    mono = np.maximum.accumulate(p90)

    print(f'Z={Z}  canales={len(ch)}  L={L:.2f} bohr')
    print(f'{"canal":9s} {"p50":>7} {"p90":>7} {"monotono":>9} {"inflado":>8}')
    peor = 1.0
    for i, (n, l, ne, m) in enumerate(ch):
        nm = f'{n}{ETI.get(l, ["?"] * 9)[m] if m >= 0 else "spdfg"[l]}'
        inf = mono[i] / max(p90[i], 1e-9)
        peor = max(peor, inf)
        marca = '  <<< la camara se aleja' if inf > 1.3 else ''
        print(f'{nm:9s} {p50[i]:7.3f} {p90[i]:7.3f} {mono[i]:9.3f} {inf:7.2f}x{marca}')
    print(f'\ninflado maximo: {peor:.2f}x')
    return 0


if __name__ == '__main__':
    sys.exit(main())
