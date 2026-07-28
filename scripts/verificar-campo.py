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

def proyecciones(P, out, etiqueta, nuc=None):
    """Proyecciones 2D XY / XZ / YZ CON AYUDAS VISUALES — el campo se juzga A OJO.
    Ayudas: núcleos marcados con su signo (O = δ−, H = δ+), el anillo dibujado, escala en
    bohr, y las líneas CON PICOS resaltadas en ROJO (para ver DÓNDE está el problema)."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from matplotlib.lines import Line2D
    except ImportError:
        print("  (matplotlib no está: sin PNG)"); return
    os.makedirs(out, exist_ok=True)
    # clasificar cada línea: ¿tiene picos?
    v = np.diff(P, axis=1); n = np.linalg.norm(v, axis=2, keepdims=True); u = v / np.maximum(n, 1e-9)
    ang = np.degrees(np.arccos(np.clip((u[:, :-1] * u[:, 1:]).sum(axis=2), -1, 1)))
    largo = np.linalg.norm(np.diff(P, axis=1), axis=2).sum(axis=1)
    viva = largo >= 0.35
    conpico = (ang > 35).any(axis=1)
    planos = [(0, 1, 'XY  (plano del anillo)'), (0, 2, 'XZ  (de canto)'), (1, 2, 'YZ  (de canto)')]
    fig, axes = plt.subplots(1, 3, figsize=(19, 6.4), facecolor='#08080c')
    for ax, (a, b, nom) in zip(axes, planos):
        for i, ln in enumerate(P):
            if not viva[i]: continue
            mal = conpico[i]
            ax.plot(ln[:, a], ln[:, b], lw=1.0 if mal else 0.35,
                    color='#ff3b30' if mal else '#4a9eff', alpha=0.85 if mal else 0.45, zorder=3 if mal else 2)
        if nuc is not None:
            for j, q in enumerate(nuc):
                esO = j % 3 == 0
                ax.scatter([q[a]], [q[b]], s=210 if esO else 90, zorder=5,
                           c='#7fd4ff' if esO else '#ffb03a', edgecolors='white', linewidths=0.8)
                ax.annotate('O δ−' if esO else 'H δ+', (q[a], q[b]), color='white', fontsize=8,
                            xytext=(6, 5), textcoords='offset points', zorder=6)
            Os = [nuc[3 * k] for k in range(len(nuc) // 3)]
            if len(Os) >= 3:
                cyc = Os + [Os[0]]
                ax.plot([o[a] for o in cyc], [o[b] for o in cyc], '--', lw=0.9, color='#00e0a0', alpha=0.75, zorder=4)
                C = np.mean(Os, axis=0)
                ax.scatter([C[a]], [C[b]], marker='x', s=140, c='#00e0a0', zorder=6, linewidths=1.6)
                ax.annotate('centro (campo ≈ 0)', (C[a], C[b]), color='#00e0a0', fontsize=8,
                            xytext=(7, -12), textcoords='offset points', zorder=6)
        ax.set_facecolor('#08080c'); ax.set_title(f'{etiqueta}\n{nom}', color='white', fontsize=11)
        ax.set_aspect('equal'); ax.tick_params(colors='#777', labelsize=8)
        ax.grid(alpha=0.10, color='white'); ax.set_xlabel('bohr', color='#777', fontsize=8)
        for sp in ax.spines.values(): sp.set_color('#333')
    fig.legend(handles=[Line2D([], [], color='#4a9eff', lw=2, label='línea limpia'),
                        Line2D([], [], color='#ff3b30', lw=2, label='línea CON PICOS (>35°)'),
                        Line2D([], [], color='#00e0a0', ls='--', lw=2, label='anillo O–O–O')],
               loc='lower center', ncol=3, facecolor='#08080c', labelcolor='white', edgecolor='#333', fontsize=9)
    plt.tight_layout(rect=[0, 0.05, 1, 1])
    f = os.path.join(out, f'campo-{etiqueta}.png')
    plt.savefig(f, dpi=115, facecolor='#08080c'); plt.close()
    print(f"  → {f}   (rojo = líneas con picos)")

K, NL, LP, R, L = leer(RUTA)
m = metricas(K, NL, LP, R, L, os.path.basename(RUTA))
def _nucleos(binruta):
    """Lee los núcleos del .bin de nubes hermano (…-efield.bin → ….bin) para marcarlos."""
    cand = binruta.replace('-efield.bin', '.bin')
    if not os.path.exists(cand): return None
    try:
        with open(cand, 'rb') as fp:
            fp.read(4)
            Nacc, Ndep, Nspin, Kb, NNUC, NLb, LPb = struct.unpack('<7i', fp.read(28))
            POSQ = struct.unpack('<3f', fp.read(12))[0]
            fp.read(Kb * 4 * 2 + Nacc * 3 + NNUC * 2)
            fp.read((Kb * Nacc * 3 + Kb * Ndep * 3 + Kb * Nspin * 3) * 2)
            nz = np.frombuffer(fp.read(Kb * NNUC * 3 * 2), dtype='<i2').astype(float) / POSQ
        return nz.reshape(Kb, NNUC, 3)[Kb - 1]
    except Exception:
        return None

if PNGDIR: proyecciones(L[K - 1], PNGDIR, os.path.basename(RUTA).replace('.bin', ''), _nucleos(RUTA))

if REF:
    print()
    Kr, NLr, LPr, Rr, Lr = leer(REF)
    mr = metricas(Kr, NLr, LPr, Rr, Lr, f"REFERENCIA {os.path.basename(REF)}")
    if PNGDIR: proyecciones(Lr[Kr - 1], PNGDIR, os.path.basename(REF).replace('.bin', ''), _nucleos(REF))
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
