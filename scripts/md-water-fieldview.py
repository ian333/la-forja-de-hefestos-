#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
md-water-fieldview.py — lee public/precomputed/water-md.bin y dibuja el CAMPO
ELÉCTRICO prominente en 3 momentos del viaje (disperso → buscándose → pegadas).
Verifica que el .bin parsea (referencia del formato para el renderer R3F).

Formato water-md.bin (little-endian):
  '<4s6i'  magic='MDW2', NFR, NMOL, NL, LP, NCLD, NAT
  '<3f'    POSQ, T_hi, T_lo
  int16[NCLD*3]   nube (marco molecular, rel O)  ·  x=raw/POSQ
  int8 [NCLD]     ancla por punto (0=O,1=H1,2=H2)
  int16[NFR*NAT*3]      trayectoria (átomos: O,H1,H2 por molécula)
  int16[NFR*NL*LP*3]    campo eléctrico por frame (una línea por H)
"""
import os, struct
import numpy as np

BIN = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'water-md.bin')


def load():
    with open(BIN, 'rb') as fp:
        magic, NFR, NMOL, NL, LP, NCLD, NAT = struct.unpack('<4s6i', fp.read(4 + 24))
        assert magic == b'MDW2', magic
        POSQ, T_hi, T_lo = struct.unpack('<3f', fp.read(12))
        cloud = np.frombuffer(fp.read(NCLD * 3 * 2), '<i2').reshape(NCLD, 3) / POSQ
        anchor = np.frombuffer(fp.read(NCLD), '<i1')
        traj = np.frombuffer(fp.read(NFR * NAT * 3 * 2), '<i2').reshape(NFR, NAT, 3) / POSQ
        fields = np.frombuffer(fp.read(NFR * NL * LP * 3 * 2), '<i2').reshape(NFR, NL, LP, 3) / POSQ
    return dict(NFR=NFR, NMOL=NMOL, NL=NL, LP=LP, NCLD=NCLD, NAT=NAT,
                POSQ=POSQ, T_hi=T_hi, T_lo=T_lo, cloud=cloud, anchor=anchor,
                traj=traj, fields=fields)


def main():
    d = load()
    print(f"MDW2 OK · {d['NFR']} frames · {d['NMOL']} moléculas · {d['NAT']} átomos · "
          f"{d['NL']} líneas×{d['LP']} · nube {d['NCLD']}  ·  recocido {d['T_hi']:.0f}→{d['T_lo']:.0f}K")
    traj, fields = d['traj'], d['fields']
    is_O = np.tile([True, False, False], d['NMOL'])

    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    picks = [int(d['NFR'] * f) for f in (0.05, 0.45, 0.99)]
    labs = ['dispersas', 'buscándose', 'pegadas (puentes)']
    fig, axs = plt.subplots(1, 3, figsize=(18, 6.5), facecolor='black')
    for ax, fi, lab in zip(axs, picks, labs):
        ax.set_facecolor('black')
        r = traj[fi]
        # campo eléctrico prominente (morado→cian por longitud, como estela del δ+ al δ−)
        for ln in fields[fi]:
            ax.plot(ln[:, 0], ln[:, 1], c='#8a6cff', alpha=0.55, lw=1.1)
            ax.scatter(ln[0, 0], ln[0, 1], s=6, c='#ffd27a', zorder=4)   # nace en el H (δ+)
        Op, Hp = r[is_O], r[~is_O]
        ax.scatter(Hp[:, 0], Hp[:, 1], s=22, c='#ffb43c', zorder=5)
        ax.scatter(Op[:, 0], Op[:, 1], s=95, c='#b04cff', zorder=6, edgecolors='#e0c0ff', linewidths=0.4)
        ax.set_aspect('equal'); ax.set_xlim(-14, 14); ax.set_ylim(-14, 14); ax.axis('off')
        ax.set_title(f"{lab}  ·  frame {fi}", color='white', fontsize=13)
    fig.suptitle("CAMPO ELÉCTRICO DINÁMICO — el δ+ H jala al δ− O vecino = el puente naciendo",
                 color='white', fontsize=15)
    fig.tight_layout()
    out = os.path.join(os.path.dirname(__file__), '..', '_o2_proof', 'md-field.png')
    fig.savefig(out, dpi=95, facecolor='black'); plt.close(fig)
    print("figura campo:", out)


if __name__ == '__main__':
    main()
