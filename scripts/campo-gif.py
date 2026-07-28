#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""campo-gif.py — el campo en 2D, FRAME POR FRAME + GIF. Para VER (no solo medir).

  python3 scripts/campo-gif.py <campo.bin> --out <dir> [--gif]
"""
import sys, os, struct
import numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

RUTA = sys.argv[1]
OUT = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else '/tmp/campo-frames'
os.makedirs(OUT, exist_ok=True)

with open(RUTA, 'rb') as fp:
    K, NL, LP = struct.unpack('<3i', fp.read(12))
    R = np.frombuffer(fp.read(K * 4), dtype='<f4')
    L = np.frombuffer(fp.read(K * NL * LP * 3 * 2), dtype='<i2').astype(float) / 2000.0
    cola = fp.read()                      # bloque OPCIONAL: uint8 |E| por punto (escala log)
L = L.reshape(K, NL, LP, 3)
INT = (np.frombuffer(cola[:K * NL * LP], dtype=np.uint8).astype(float).reshape(K, NL, LP) / 255.0
       if len(cola) >= K * NL * LP else None)
print(f"  {NL} líneas × {LP} pts × {K} cuadros" + ("  · CON brillo |E|" if INT is not None else "  · sin |E| (bin viejo)"))

def nucleos(p):
    c = p.replace('-efield.bin', '.bin')
    if not os.path.exists(c): return None
    with open(c, 'rb') as fp:
        fp.read(4); Na, Nd, Ns, Kb, NN, _, _ = struct.unpack('<7i', fp.read(28))
        POSQ = struct.unpack('<3f', fp.read(12))[0]
        fp.read(Kb * 4 * 2 + Na * 3 + NN * 2)
        fp.read((Kb * Na * 3 + Kb * Nd * 3 + Kb * Ns * 3) * 2)
        nz = np.frombuffer(fp.read(Kb * NN * 3 * 2), dtype='<i2').astype(float) / POSQ
    return nz.reshape(Kb, NN, 3)
NUC = nucleos(RUTA)

BOHR = 0.529177
# rampa NEGRO → azul profundo → cian → blanco (la del video: additive sobre negro)
from matplotlib.colors import LinearSegmentedColormap
RAMPA = LinearSegmentedColormap.from_list('campo', [
    (0.00, '#000000'), (0.28, '#04122e'), (0.50, '#0b4a9c'),
    (0.72, '#3aa0ff'), (0.88, '#9fd8ff'), (1.00, '#ffffff')])

# ENCUADRE FIJO para TODOS los cuadros: si los límites cambian por cuadro, el GIF "respira"
# y el ojo lee ese zoom como si el campo creciera. Y se mide sobre el radio PONDERADO POR
# BRILLO: de nada sirve encuadrar para incluir cola que se ve negra — deja la molécula chiquita.
_lg = np.linalg.norm(np.diff(L, axis=2), axis=3).sum(axis=2)
_vv = _lg >= 0.35
_rr = np.linalg.norm(L[_vv].reshape(-1, 3), axis=1)
if INT is not None:
    _w = INT[_vv].reshape(-1)
    _o = np.argsort(_rr); _c = np.cumsum(_w[_o])
    LIM = float(np.ceil(_rr[_o][np.searchsorted(_c, 0.985 * _c[-1])]))
    print(f"  encuadre fijo ±{LIM:.0f} bohr (98.5% del BRILLO, no del largo)")
else:
    LIM = float(np.ceil(np.percentile(_rr, 99.5)))
    print(f"  encuadre fijo ±{LIM:.0f} bohr (p99.5 del radio)")

for k in range(K):
    P = L[k]; largo = np.linalg.norm(np.diff(P, axis=1), axis=2).sum(axis=1); viva = largo >= 0.35
    nuc = NUC[k] if NUC is not None else None
    fig, axes = plt.subplots(1, 3, figsize=(16.5, 5.8), facecolor='#08080c')
    for ax, (a, b, nom) in zip(axes, [(0,1,'XY'), (0,2,'XZ'), (1,2,'YZ')]):
        if INT is not None:
            # EL BRILLO ES |E| — lo mismo que hace el shader del video. Sin esto la línea se
            # acaba de golpe y se lee "despeinada"; con esto se apaga sola donde el campo ya
            # no importa. Mismo criterio que scripts/campo-escalera.py.
            # OJO: se apaga por COLOR (rampa que llega a NEGRO), no por alfa. Con alfa sobre
            # 1100 líneas todo se suma y satura a una mancha azul sólida (probado). Negro
            # sobre negro desaparece de verdad, y de paso da el glow.
            from matplotlib.collections import LineCollection
            Q = P[viva]
            segs = np.stack([Q[:, :-1, [a, b]], Q[:, 1:, [a, b]]], axis=2).reshape(-1, 2, 2)
            w = (0.5 * (INT[k][viva][:, :-1] + INT[k][viva][:, 1:])).reshape(-1)
            ax.add_collection(LineCollection(segs, colors=RAMPA(np.clip(w, 0, 1)), linewidths=0.5))
        else:
            for ln in P[viva]:
                ax.plot(ln[:, a], ln[:, b], lw=0.30, color='#4fa3ff', alpha=0.40)
        if nuc is not None:
            for j, q in enumerate(nuc):
                esO = j % 3 == 0
                ax.scatter([q[a]], [q[b]], s=150 if esO else 60, zorder=5,
                           c='#8fd8ff' if esO else '#ffb03a', edgecolors='white', linewidths=0.7)
            Os = [nuc[3*i] for i in range(len(nuc)//3)]
            cyc = Os + [Os[0]]
            ax.plot([o[a] for o in cyc], [o[b] for o in cyc], '--', lw=1.0, color='#00e0a0', alpha=0.8)
        ax.set_xlim(-LIM, LIM); ax.set_ylim(-LIM, LIM); ax.set_aspect('equal')
        ax.set_facecolor('#08080c'); ax.set_title(nom, color='white', fontsize=11)
        ax.tick_params(colors='#666', labelsize=7); ax.grid(alpha=0.08, color='white')
        for sp in ax.spines.values(): sp.set_color('#333')
    fig.suptitle(f'CAMPO ELÉCTRICO DEL TRÍMERO · cuadro {k+1}/{K} · O–O = {R[k]*BOHR:.2f} Å · '
                 f'{int(viva.sum())} líneas, cada una con el MISMO flujo',
                 color='white', fontsize=13)
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    plt.savefig(os.path.join(OUT, f'campo_{k:02d}.png'), dpi=90, facecolor='#08080c'); plt.close()
    print(f"  frame {k+1}/{K}  O-O {R[k]*BOHR:.2f} A  {int(viva.sum())} lineas", flush=True)
print(f"OK  {K} frames en {OUT}")
