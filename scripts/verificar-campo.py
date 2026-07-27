#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verificar-campo.py — PORTERO DE LOS CAMPOS (eléctrico HOY, magnético mañana).

Por qué existe (Ian, 2026-07-27): "el campo del trímero está mal y ES OTRA VEZ UN RETROCESO,
porque el dilitio y el dímero YA lo tenían bien: no es continuo y no es denso como el dímero.
Hace falta verificación del campo en el pipeline, porque habrá otros con campo magnético".

Mide lo que define un campo BIEN DIBUJADO (las reglas ya ganadas con Li₂, ver
reference_serie_enlaces_pipeline): las líneas de fuerza son CONTINUAS (no se cortan en el
aire), SUAVES (sin picos ni zigzag), DENSAS (llenan el volumen) y VIVAS (no semillas muertas).

  python3 scripts/verificar-campo.py <campo.bin> [--ref <referencia.bin>] [--png <dir>]

Formato (BondEField, el de Li₂/dímero/trímero): int32 K,NL,LP · float32[K] Rvals ·
int16 líneas (bohr×2000) de forma [K][NL][LP][3].
"""
import sys, os, struct
import numpy as np

RUTA = sys.argv[1]
REF = sys.argv[sys.argv.index('--ref') + 1] if '--ref' in sys.argv else None
PNGDIR = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None

def leer(p):
    with open(p, 'rb') as fp:
        K, NL, LP = struct.unpack('<3i', fp.read(12))
        R = np.frombuffer(fp.read(K * 4), dtype='<f4')
        L = np.frombuffer(fp.read(K * NL * LP * 3 * 2), dtype='<i2').astype(np.float64) / 2000.0
    return K, NL, LP, R, L.reshape(K, NL, LP, 3)

def metricas(K, NL, LP, R, L, etiqueta):
    """Todo se mide en el frame de EQUILIBRIO (el último, anillo/enlace cerrado)."""
    P = L[K - 1]                                   # (NL, LP, 3)
    d = np.linalg.norm(np.diff(P, axis=1), axis=2) # (NL, LP-1) paso entre puntos
    largo = d.sum(axis=1)                          # largo de cada línea
    # 1) SEMILLAS MUERTAS: la línea no avanzó (se resamplea a LP puntos → sale una RECTA)
    muertas = (largo < 0.35).mean() * 100
    # 2) CONTINUIDAD: el paso debe ser casi constante (h fijo). Saltos = línea cortada.
    paso_med = np.median(d[d > 1e-6]) if (d > 1e-6).any() else 0.0
    salto = (d > max(paso_med * 3.0, 1e-6)).mean() * 100
    # 3) SUAVIDAD: ángulo entre segmentos consecutivos. Picos = zigzag/artefacto poligonal.
    v = np.diff(P, axis=1)
    n = np.linalg.norm(v, axis=2, keepdims=True)
    u = v / np.maximum(n, 1e-9)
    cos = np.clip((u[:, :-1] * u[:, 1:]).sum(axis=2), -1, 1)
    ang = np.degrees(np.arccos(cos))
    vivas = largo >= 0.35
    picos = (ang[vivas] > 35).mean() * 100 if vivas.any() else 0.0
    ang_med = np.median(ang[vivas]) if vivas.any() else 0.0
    # 4) DENSIDAD: fracción de celdas de una rejilla 24³ que alguna línea toca
    pts = P[vivas].reshape(-1, 3)
    if len(pts):
        lo, hi = pts.min(0), pts.max(0)
        rng = np.maximum(hi - lo, 1e-6)
        idx = np.clip(((pts - lo) / rng * 23).astype(int), 0, 23)
        ocup = len(set(map(tuple, idx))) / (24 ** 3) * 100
    else:
        ocup = 0.0
    print(f"── {etiqueta} ──")
    print(f"  líneas {NL} × {LP} puntos · {K} frames")
    print(f"  1) semillas MUERTAS (salen rectas):  {muertas:5.1f} %   [bien: <10]")
    print(f"  2) saltos (línea CORTADA):           {salto:5.2f} %   [bien: <0.5]")
    print(f"  3) picos >35° (zigzag/poligonal):    {picos:5.1f} %   [bien: <5]  · ángulo mediano {ang_med:.1f}°")
    print(f"  4) densidad (celdas ocupadas 24³):   {ocup:5.1f} %   [más = mejor]")
    print(f"  largo mediano de línea: {np.median(largo[vivas]) if vivas.any() else 0:.2f} bohr")
    return dict(muertas=muertas, salto=salto, picos=picos, ocup=ocup, NL=NL)

def proyecciones(P, out, etiqueta):
    """Proyecciones 2D XY / XZ / YZ — el campo se JUZGA A OJO, no solo por número."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print("  (matplotlib no está: sin PNG)"); return
    os.makedirs(out, exist_ok=True)
    planos = [(0, 1, 'XY'), (0, 2, 'XZ'), (1, 2, 'YZ')]
    fig, axes = plt.subplots(1, 3, figsize=(16, 5.4), facecolor='black')
    for ax, (a, b, nom) in zip(axes, planos):
        for ln in P:
            if np.linalg.norm(np.diff(ln, axis=0), axis=1).sum() < 0.35: continue
            ax.plot(ln[:, a], ln[:, b], lw=0.35, color='#5aa0ff', alpha=0.55)
        ax.set_facecolor('black'); ax.set_title(f'{etiqueta} · {nom}', color='white')
        ax.set_aspect('equal'); ax.tick_params(colors='#888')
    plt.tight_layout()
    f = os.path.join(out, f'campo-{etiqueta}.png')
    plt.savefig(f, dpi=110, facecolor='black'); plt.close()
    print(f"  → {f}")

K, NL, LP, R, L = leer(RUTA)
m = metricas(K, NL, LP, R, L, os.path.basename(RUTA))
if PNGDIR: proyecciones(L[K - 1], PNGDIR, os.path.basename(RUTA).replace('.bin', ''))

if REF:
    print()
    Kr, NLr, LPr, Rr, Lr = leer(REF)
    mr = metricas(Kr, NLr, LPr, Rr, Lr, f"REFERENCIA {os.path.basename(REF)}")
    if PNGDIR: proyecciones(Lr[Kr - 1], PNGDIR, os.path.basename(REF).replace('.bin', ''))
    print("\n── VEREDICTO (contra la referencia que ya funcionó) ──")
    ok = True
    for k, nom, peor_es in (('muertas', 'semillas muertas', 'mayor'), ('salto', 'saltos', 'mayor'),
                            ('picos', 'picos/zigzag', 'mayor'), ('ocup', 'densidad', 'menor')):
        a, b = m[k], mr[k]
        mal = (a > b * 1.5 + 1) if peor_es == 'mayor' else (a < b * 0.7)
        ok &= not mal
        print(f"  {nom:20s} {a:6.2f}  vs  {b:6.2f} (ref)   {'✗ PEOR' if mal else '✓'}")
    print("\n" + ("✅ CAMPO OK — a la altura de la referencia" if ok else
                  "❌ CAMPO PEOR QUE LA REFERENCIA — no renderizar así"))
    sys.exit(0 if ok else 1)
