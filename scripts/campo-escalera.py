#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""campo-escalera.py — LA ESCALERA: 2, 3, 4, 5, 6 cargas. El campo desde abajo.

Ian, 2026-07-28: "no se si seria mejor regresar y hacer campos simples de 2 particulas luego
de 3... nunca habia visto tantos campos me vuela la cabeza. No me gustan los picos, pero si,
ve como se unen las lineas de un campo a otro, eso se ve chingon. Pero las lineas que
desaparecen en el aire se ven despeinadas."

Ese diagnóstico A OJO es CORRECTO y tiene nombre. Las líneas que se desvanecen en el aire son
las que SALEN Y NO REGRESAN, y eso solo puede pasar si hay CARGA NETA:

    ∮E·dA = 4π·Q_encerrada        (Gauss)

  · Q = 0  ⇒ el flujo neto por el infinito es CERO ⇒ toda línea que sale, regresa.
             Cada línea nace en una carga + y muere en una carga −. Cero pelambre.
  · Q ≠ 0  ⇒ sobra flujo que TIENE que irse al infinito ⇒ hay líneas que se van y no
             vuelven. Eso es el "despeinado", y no es un defecto del dibujo: es la carga.

Por eso el último panel es el experimento controlado: la MISMA configuración, una neutra y
otra con carga neta +1. La diferencia se ve de un vistazo.

  python3 scripts/campo-escalera.py [--out <dir>]
"""
import os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from campo_lineas import CampoPuntual, trazar

OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '/tmp/campo-escalera'
os.makedirs(OUT, exist_ok=True)

# ── LA ESCALERA. Todas NEUTRAS salvo la última, que es el experimento controlado. ──
def anillo(n, r=1.0, q=None):
    th = 2 * np.pi * np.arange(n) / n
    C = np.stack([r * np.cos(th), r * np.sin(th), np.zeros(n)], axis=1)
    return (q if q is not None else [(-1.) ** i for i in range(n)]), C


CASOS = [
    ("2 · DIPOLO", [1., -1.], [[-0.9, 0, 0], [0.9, 0, 0]], True),
    ("3 · CUADRUPOLO LINEAL", [1., -2., 1.], [[-1.1, 0, 0], [0, 0, 0], [1.1, 0, 0]], True),
    ("4 · CUADRADO ALTERNADO", *anillo(4, 1.15), True),
    # OJO con la orientación: con las + AFUERA y la −4 al centro, 26 de 104 líneas parecían
    # escaparse con caja de 3000 bohr… y con caja de 60000 bajan a 2. Era el RODEO, no un
    # escape. Con la fuente ADENTRO y los sumideros alrededor, cierran de inmediato (0).
    ("5 · UNA +4 AL CENTRO, CUATRO − ALREDEDOR", [4., -1., -1., -1., -1.],
     [[0, 0, 0], [1.3, 0, 0], [0, 1.3, 0], [-1.3, 0, 0], [0, -1.3, 0]], True),
    ("6 · HEXÁGONO ALTERNADO", *anillo(6, 1.35), True),
    ("3 · CON CARGA NETA +1  ← el despeinado", [1., -1., 1.], [[-1.1, 0, 0], [0, 0, 0], [1.1, 0, 0]], False),
]

POR_CARGA = 26          # líneas por unidad de carga +  (regla del libro: N ∝ |q|)
R0 = 0.045              # cascarita de siembra: ahí el campo ya es el de la carga sola


def lineas_de(cp):
    """Siembra CANÓNICA en el plano: alrededor de cada carga POSITIVA, uniforme en ángulo y
    con N ∝ q. Como todo es coplanar, una línea que nace en el plano SE QUEDA en el plano:
    el corte 2D es exacto, no es una proyección aplastada."""
    S = []
    for q, c in zip(cp.q, cp.R):
        if q <= 0:
            continue
        n = max(6, int(round(POR_CARGA * q)))
        a = 2 * np.pi * (np.arange(n) + 0.5) / n
        S.append(c[None, :] + R0 * np.stack([np.cos(a), np.sin(a), np.zeros(n)], axis=1))
    S = np.vstack(S)
    # LA CAJA TIENE QUE SER ENORME, y esto es física, no capricho. Con r_caja=14 el dipolo
    # NEUTRO reportaba 4 líneas "escapando", lo cual es IMPOSIBLE con Q=0. Son las que salen
    # casi exactamente por el EJE: ahí ψ→0 (la separatriz), y el radio máximo del rodeo va
    # como r ≈ p/ψ. Con 26 direcciones, la más cercana al eje tiene ψ≈0.0073 y necesita dar
    # la vuelta a ~250 bohr antes de volver. Si la caja las corta, el dibujo MIENTE y parece
    # que se escapan. hmax grande para que el tramo lejano (donde el campo casi no gira)
    # cueste poco; cerca de las cargas el tope f_nuc·d sigue mandando y el paso se encoge solo.
    SP, SS, nm, mot = trazar(cp, S, sentido=+1, tol=1e-9, hmax=25.0, hmin=5e-4,
                             r_core=R0 * 0.9, r_caja=3000.0, s_max=14000.0, e_min=1e-20,
                             nucleos=cp.R, max_pasos=20000, max_muestras=6000)
    return [SP[i, :int(nm[i])] for i in range(len(S))], mot


import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.colors import LogNorm

fig, axes = plt.subplots(2, 3, figsize=(17.4, 11.6), facecolor='#07070b')
NORM = LogNorm(vmin=0.02, vmax=6.0)
CM = plt.get_cmap('inferno')

for ax, (nom, q, C, neutro) in zip(axes.ravel(), CASOS):
    cp = CampoPuntual(q, C)
    L, mot = lineas_de(cp)
    escapan = int((mot == 3).sum())
    segs, cols = [], []
    for ln in L:
        if len(ln) < 2:
            continue
        E = np.linalg.norm(cp(ln), axis=1)
        p = ln[:, :2]
        segs.append(np.stack([p[:-1], p[1:]], axis=1))
        cols.append(0.5 * (E[:-1] + E[1:]))
    segs = np.concatenate(segs); cols = np.concatenate(cols)
    ax.add_collection(LineCollection(segs, colors=CM(NORM(cols)), linewidths=0.85, alpha=0.95))
    for qq, cc in zip(cp.q, cp.R):
        pos = qq > 0
        ax.scatter([cc[0]], [cc[1]], s=90 + 130 * abs(qq) / max(abs(cp.q)), zorder=6,
                   c='#ffd27f' if pos else '#7fc9ff', edgecolors='white', linewidths=1.1)
        ax.annotate(f'{qq:+.0f}', (cc[0], cc[1]), color='white', fontsize=9, zorder=7,
                    ha='center', va='center')
    Q = float(np.sum(cp.q))
    ax.set_xlim(-4.2, 4.2); ax.set_ylim(-4.2, 4.2); ax.set_aspect('equal')
    ax.set_facecolor('#07070b')
    ax.set_title(f'{nom}\nQ total = {Q:+.0f}   ·   líneas que se van al infinito: {escapan}',
                 color='#e8e8f0' if neutro else '#ff9a6a', fontsize=10.5, pad=8)
    ax.set_xticks([]); ax.set_yticks([])
    for sp in ax.spines.values():
        sp.set_color('#ff6a3a' if not neutro else '#2a2a34')
        sp.set_linewidth(1.8 if not neutro else 1.0)
    print(f"  {nom:<42} Q={Q:+.0f}  {len(L)} líneas  escapan {escapan}", flush=True)

sm = plt.cm.ScalarMappable(norm=NORM, cmap=CM); sm.set_array([])
cb = fig.colorbar(sm, ax=axes, fraction=0.016, pad=0.015)
cb.set_label('|E|  (u.a.) — el color ES la intensidad', color='#bbb', fontsize=9)
cb.ax.tick_params(colors='#888', labelsize=8)
fig.suptitle('LA ESCALERA DEL CAMPO · toda línea nace en + y muere en −  ·  si Q=0, NINGUNA se escapa\n'
             'el panel naranja es el mismo caso con carga neta: ahí sí hay líneas que se van y no vuelven',
             color='white', fontsize=13.5)
f = os.path.join(OUT, 'ESCALERA.png')
plt.savefig(f, dpi=115, facecolor='#07070b', bbox_inches='tight'); plt.close()
print(f"\n→ {f}")
