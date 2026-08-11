#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verificar-orbitales.py — ¿EL .bin TIENE ORBITALES, O SON BOLAS?

Existe porque el defecto que Ian cazó el 2026-08-11 ("son simples puntos en una nube
circular, no hay orbitales") era INVISIBLE para todos los gates que había: el archivo
estaba bien formado, el SCF convergía, las energías eran correctas y el render no tenía
cuadros negros. Lo único que estaba mal era la FORMA — y ningún número la miraba.

Mide si la densidad ESTÁ REPARTIDA PAREJO SOBRE LA ESFERA o tiene lóbulos.

⚠ NO SE MIDE POR EJES. El primer intento comparaba <|x|/r>, <|y|/r>, <|z|/r> y reprobó al
`4f_xyz` del europio (0.544/0.550/0.542, razón 1.02 = "bola"). No era bola: f_xyz tiene OCHO
lóbulos apuntando a las esquinas de un cubo, y esa forma es SIMÉTRICA al permutar x,y,z, así
que sus tres promedios son iguales por construcción. La métrica no podía verla. Igual el
`f_z(x²−y²)`. Un gate que reprueba lo correcto se termina ignorando.

Lo que sí funciona: repartir las direcciones en celdas de área igual, contar puntos por celda
y medir el COEFICIENTE DE VARIACIÓN. Una nube esférica sólo tiene ruido de Poisson (CV ≈
1/√n_por_celda); cualquier orbital con lóbulos concentra puntos y dispara el CV. No depende
de ejes, así que ve igual la mancuerna p que el cubo de ocho lóbulos del f.

CONTROL: los canales s DEBEN dar CV al nivel de Poisson. Si un s sale estructurado, el
muestreo está sesgado y no hay que creerle a los p/d/f tampoco.

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


def celdas_fibonacci(ncel):
    """Direcciones casi equiespaciadas: cada una define una celda de área ~igual."""
    i = np.arange(ncel) + 0.5
    phi = np.arccos(1 - 2 * i / ncel)
    th = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], axis=1)


def estructura(P, celdas):
    """Coeficiente de variación de los conteos por celda, ya descontado el ruido de Poisson.
    0 ⇒ indistinguible de una esfera. >1 ⇒ la densidad se concentra en lóbulos."""
    u = P / np.linalg.norm(P, axis=1)[:, None]
    cual = np.argmax(u @ celdas.T, axis=1)          # celda más cercana
    cnt = np.bincount(cual, minlength=len(celdas)).astype(float)
    mu = cnt.mean()
    if mu <= 0:
        return 0.0
    cv2 = cnt.var() / (mu * mu)
    poisson2 = 1.0 / mu                              # varianza de Poisson = media
    return float(np.sqrt(max(cv2 - poisson2, 0.0)))


def main():
    Z, L, canales, pos, sidx, orb = lee(sys.argv[1])
    celdas = celdas_fibonacci(96)
    print(f'Z={Z}  canales={len(canales)}  puntos={len(pos)}  formato={"ATM3 (por ORBITAL)" if orb else "ATM2 (por SUBCAPA)"}')
    print(f'{"canal":10s} {"pts":>7} {"e-":>3}   {"estructura":>10}   veredicto')
    malos = 0
    for i, (n, l, ne, m) in enumerate(canales):
        P = pos[sidx == i]
        r = np.linalg.norm(P, axis=1)
        P = P[r > 1e-6]
        if len(P) < 200:
            continue
        s = estructura(P, celdas)
        nm = f'{n}{ETI.get(l, ["?"] * 9)[m] if m >= 0 else "spdfg"[l]}'
        # un s DEBE ser plano; un orbital con m declarado DEBE tener estructura
        if l == 0:
            ok, ver = s < 0.25, ('plano OK (control)' if s < 0.25 else 'SESGO en un s')
        elif m >= 0:
            ok, ver = s > 0.40, ('CON FORMA' if s > 0.40 else 'SIN FORMA (bola)')
        else:
            ok, ver = True, 'subcapa (sin m)'
        if not ok:
            malos += 1
        print(f'{nm:10s} {len(P):>7} {ne:>3}   {s:10.3f}   {ver}')
    if malos:
        print(f'\n✗ {malos} canal(es) no pasan')
        return 1
    print('\n✓ los canales angulares tienen estructura y los s salen planos')
    return 0


if __name__ == '__main__':
    sys.exit(main())
