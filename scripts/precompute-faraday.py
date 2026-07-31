#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-faraday.py — LA JAULA DE FARADAY, resuelta de verdad.

NO se dibuja "el campo se detiene". Se RESUELVE el problema de contorno y el
apantallamiento EMERGE del cálculo:

  Una carga externa se acerca a una jaula CONDUCTORA (barras de un cubo, CON
  huecos — que es lo que la hace interesante: funciona aunque no sea una caja
  cerrada). Los electrones libres del conductor se reacomodan hasta que TODO el
  conductor queda a un mismo potencial. Ese reacomodo es el que cancela el campo
  adentro.

MÉTODO (elementos de contorno / método de momentos, unidades atómicas):
  Se discretiza la jaula en M elementos con carga q_i desconocida. Dos
  condiciones, ambas físicas:
    1) el potencial es el MISMO en todos los elementos (es un conductor):
         Σ_j A_ij q_j + V_ext(r_i) = V0     con A_ij = 1/|r_i-r_j|
    2) la jaula está AISLADA y neutra:  Σ_i q_i = 0
  Son M+1 ecuaciones con M+1 incógnitas (q_1..q_M, V0). Se resuelve exacto.
  El término propio A_ii = 1/a  (a = radio del elemento): un disco/esfera de
  radio a visto desde su centro. Sin esto la matriz es singular.

  Después, E(r) = E_carga_externa(r) + Σ_i q_i (r-r_i)/|r-r_i|³.

LA AFIRMACIÓN QUE SE VERIFICA (gate duro, como en cargas-gauss):
  |E| DENTRO de la jaula cae por un factor grande contra |E| en el mismo punto
  SIN jaula. Ese factor se mide y se imprime; si no apantalla, el script FALLA.
  No se publica un video que diga "apantalla" si el número dice otra cosa.

Salida: mismo formato .bin que cargas-gauss (lo come parseBondEField/BondEField
sin tocar el motor) + un .json con la geometría de la jaula y los factores.
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from campo_lineas import trazar, intensidad_u8            # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'precomputed')

# ── LA JAULA ─────────────────────────────────────────────────────────────────
L = 6.0                    # arista del cubo (bohr)
POR_ARISTA = int(os.environ.get('POR_ARISTA', '14'))   # elementos a lo largo de cada alambre
A_HILO = 0.08              # RADIO FÍSICO del alambre (bohr). El término propio ya NO es un
                           # 1/a inventado: es el potencial EXACTO en el centro de un tramo
                           # recto de longitud dl y radio a, uniformemente cargado:
                           #     V_propio = (2/dl)·asinh(dl/2a)
                           # Tiene que crecer cuando dl se achica, o el vecino acaba pesando
                           # MÁS que uno mismo (con dl=0.12 el vecino daba 8.3 contra 3.3 del
                           # propio fijo): la matriz pierde la dominancia diagonal y el
                           # resultado es RUIDO. Se veía en el estudio de convergencia:
                           # 65x → 57x → 199x → 25x → 15x al refinar. No convergía: oscilaba.

# ── LA CARGA QUE SE ACERCA (el "rayo") ───────────────────────────────────────
Q_EXT = 12.0               # carga externa (grande: es un rayo, no un electrón)
D_LEJOS = 26.0             # dónde empieza (bohr desde el centro)
D_CERCA = 5.6              # a dónde llega (pegada a la cara, sin tocarla)

K = 66                     # cuadros
POR_ETAPA = K
NL = 220                   # líneas de campo dibujadas
LP = 80                    # puntos por línea
R0 = 0.22                  # radio de siembra alrededor de la carga externa
R_DIBUJO = 34.0            # el .bin guarda hasta aquí (int16 bohr×900)
ESC = 900.0

TRAZA = dict(tol=1e-9, hmax=25.0, hmin=5e-4, r_core=R0 * 0.9, r_caja=400.0,
             s_max=260.0, e_min=1e-7, max_pasos=4000, max_muestras=2000)


def malla_del_cubo(hilos):
    """MALLA sobre las 6 caras del cubo. `hilos` = alambres por dirección y cara.

    hilos=0 → solo los 12 FILOS (un marco, no una jaula: las caras quedan
    abiertas de par en par). Sirve como CONTRASTE medible: el cálculo dice que
    un marco NO apantalla, y ese es justo el beat que hace interesante la pieza.
    """
    h = L / 2.0
    pts, dirs = [], []
    t = (np.arange(POR_ARISTA) + 0.5) / POR_ARISTA
    def eje_unit(e):
        v = np.zeros(3); v[e] = 1.0; return np.tile(v, (POR_ARISTA, 1))
    if hilos <= 0:
        for eje in range(3):
            for s1 in (-h, h):
                for s2 in (-h, h):
                    p = np.zeros((POR_ARISTA, 3))
                    p[:, eje] = -h + t * L
                    p[:, (eje + 1) % 3] = s1
                    p[:, (eje + 2) % 3] = s2
                    pts.append(p); dirs.append(eje_unit(eje))
        return np.concatenate(pts, axis=0), np.concatenate(dirs, axis=0)
    # alambres tejidos en cada cara: `hilos` en una dirección y `hilos` en la otra
    w = (np.arange(hilos) + 0.5) / hilos
    for eje in range(3):                       # eje = normal de la cara
        for lado in (-h, h):
            a, b = (eje + 1) % 3, (eje + 2) % 3
            for wv in w:
                p = np.zeros((POR_ARISTA, 3))
                p[:, eje] = lado
                p[:, a] = -h + t * L
                p[:, b] = -h + wv * L
                pts.append(p); dirs.append(eje_unit(a))
                p2 = np.zeros((POR_ARISTA, 3))
                p2[:, eje] = lado
                p2[:, b] = -h + t * L
                p2[:, a] = -h + wv * L
                pts.append(p2); dirs.append(eje_unit(b))
    P = np.concatenate(pts, axis=0)
    D = np.concatenate(dirs, axis=0)
    # DEDUPE OBLIGATORIO: los alambres de las dos direcciones se CRUZAN, y en cada
    # cruce quedaban dos elementos en el MISMO punto → distancia 0 → 1/R = inf y la
    # matriz del conductor sale envenenada. Se veía en el resultado: la malla 3x3
    # apantallaba MÁS que la 5x5, que es físicamente imposible.
    llave = np.round(P / 1e-6).astype(np.int64)
    _, idx = np.unique(llave, axis=0, return_index=True)
    idx = np.sort(idx)
    return P[idx], D[idx]


HILOS = int(os.environ.get('HILOS', '5'))     # alambres por dirección y cara


JAULA, THILO = malla_del_cubo(HILOS)
M = len(JAULA)
DL = L / POR_ARISTA          # longitud del tramo que representa cada elemento


def _pot_tramo(P, C, T, dl, a):
    """Potencial en P de un tramo RECTO de longitud dl, radio a, con carga UNITARIA
    repartida uniforme. Forma CERRADA, exacta a precisión de máquina:

        V = (1/dl)·[ asinh(u2/ρ) − asinh(u1/ρ) ]

    con ρ = distancia perpendicular al eje del tramo y u1,u2 las coordenadas de sus
    extremos medidas desde P a lo largo del eje. La forma con asinh (en vez de
    ln(u+√(u²+ρ²))) evita la cancelación catastrófica cuando u es grande y negativo.

    Esto sustituye la colocación PUNTO-A-PUNTO (1/r entre centros), que es la
    aproximación más burda posible: trata un alambre como un collar de cuentas y el
    campo se cuela entre cuenta y cuenta. Con la integral exacta el término propio
    ya no es un parche — sale de la MISMA fórmula con ρ=a y u=∓dl/2.
    """
    d = P[:, None, :] - C[None, :, :]                 # (NP, M, 3)
    sfw = np.einsum('pmc,mc->pm', d, T)               # proyección sobre el eje
    perp2 = np.maximum((d * d).sum(axis=2) - sfw * sfw, 0.0)
    rho = np.sqrt(np.maximum(perp2, a * a))           # nunca dentro del alambre
    u1 = -dl / 2.0 - sfw
    u2 = dl / 2.0 - sfw
    return (np.arcsinh(u2 / rho) - np.arcsinh(u1 / rho)) / dl


def resolver_jaula(rq):
    """Carga inducida en cada elemento para una carga Q_EXT en `rq`.
    Devuelve (q_i, V0). Conductor AISLADO y neutro."""
    A = _pot_tramo(JAULA, JAULA, THILO, DL, A_HILO)
    vext = Q_EXT / np.maximum(np.linalg.norm(JAULA - rq, axis=1), 1e-9)
    # [A  -1] [q ]   [-vext]
    # [1   0] [V0] = [  0  ]
    S = np.zeros((M + 1, M + 1))
    S[:M, :M] = A
    S[:M, M] = -1.0
    S[M, :M] = 1.0
    b = np.concatenate([-vext, [0.0]])
    sol = np.linalg.solve(S, b)
    return sol[:M], sol[M]


class CampoJaula:
    """E(r) = carga externa + las cargas inducidas en la jaula. Puro, vectorizado."""

    def __init__(self, rq, q_ind):
        self.rq = np.asarray(rq, float)
        self.q = np.asarray(q_ind, float)
        self.n_eval = 0

    def _e_de(self, P, cen, car):
        d = P[:, None, :] - cen[None, :, :]
        r = np.linalg.norm(d, axis=2)
        r = np.maximum(r, A_HILO)                  # el campo no se evalúa dentro del alambre
        return (car[None, :, None] * d / r[:, :, None] ** 3).sum(axis=1)

    def __call__(self, P):
        P = np.asarray(P, float).reshape(-1, 3)
        self.n_eval += len(P)
        e = self._e_de(P, self.rq[None, :], np.array([Q_EXT]))
        e += self._e_de(P, JAULA, self.q)
        return e

    def solo_externa(self, P):
        P = np.asarray(P, float).reshape(-1, 3)
        return self._e_de(P, self.rq[None, :], np.array([Q_EXT]))


def _fibonacci_esfera(n):
    i = np.arange(n) + 0.5
    th = np.arccos(1 - 2 * i / n)
    ph = np.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], axis=1)


DIRS = _fibonacci_esfera(NL)

# Sonda interior: puntos DENTRO de la jaula donde se mide el apantallamiento.
SONDA = _fibonacci_esfera(60) * (L / 2 * 0.55)


def main():
    frames = np.zeros((K, NL, LP, 3), np.float32)
    inten = np.zeros((K, NL, LP), np.uint8)
    meta = []
    print(f"jaula: cubo de {L} bohr · HILOS={HILOS} · {M} elementos · carga externa Q={Q_EXT}")
    print(f"{'k':>3} {'d_carga':>8} {'|E| sin jaula':>14} {'|E| dentro':>12} "
          f"{'apantalla':>11}  {'Σq':>9}")
    peor = 1e9
    for k in range(K):
        u = k / (K - 1)
        d = D_LEJOS + (D_CERCA - D_LEJOS) * (u * u * (3 - 2 * u))    # suave en t
        rq = np.array([d, 0.0, 0.0])
        q_ind, V0 = resolver_jaula(rq)
        cp = CampoJaula(rq, q_ind)

        e_con = np.linalg.norm(cp(SONDA), axis=1).mean()
        e_sin = np.linalg.norm(cp.solo_externa(SONDA), axis=1).mean()
        fac = e_sin / max(e_con, 1e-30)
        peor = min(peor, fac)

        S = rq[None, :] + R0 * DIRS
        SP, SS, nm, mot = trazar(cp, S, sentido=+1, nucleos=np.vstack([JAULA, rq[None, :]]),
                                 **TRAZA)
        for j in range(NL):
            n_j = max(int(nm[j]), 1)
            cam = SP[j, :n_j]
            dentro = np.linalg.norm(cam, axis=1) <= R_DIBUJO
            if n_j < 3 or not dentro.any():
                frames[k, j] = rq
                continue
            cam = cam[dentro]
            idx = np.linspace(0, len(cam) - 1, LP)
            frames[k, j] = np.stack([np.interp(idx, np.arange(len(cam)), cam[:, c])
                                     for c in range(3)], axis=1)
            ee = np.linalg.norm(cp(frames[k, j]), axis=1)
            inten[k, j] = intensidad_u8(ee)

        meta.append(dict(k=k, d=float(d), rq=rq.tolist(), V0=float(V0),
                         q_sum=float(q_ind.sum()), apantalla=float(fac),
                         e_dentro=float(e_con), e_sin=float(e_sin)))
        if k % 8 == 0 or k == K - 1:
            print(f"{k:3d} {d:8.2f} {e_sin:14.3e} {e_con:12.3e} {fac:10.1f}x "
                  f"{q_ind.sum():9.1e}")

    # ── GATE: si no apantalla, NO hay pieza ──────────────────────────────────
    print(f"\napantallamiento MÍNIMO en toda la pasada: {peor:.1f}x")
    if peor < 20.0:
        raise SystemExit(f"X  la jaula NO apantalla (factor mínimo {peor:.1f}x < 20). "
                         "No se publica una pieza que afirme lo que el cálculo desmiente.")
    print("OK la jaula apantalla en TODOS los cuadros")

    os.makedirs(OUT, exist_ok=True)
    Rv = np.array([K - i for i in range(K)], np.float32)      # descendente, como cargas
    q16 = np.clip(np.round(frames * ESC), -32767, 32767).astype(np.int16)
    with open(os.path.join(OUT, 'faraday-jaula-efield.bin'), 'wb') as f:
        np.array([K, NL, LP], np.int32).tofile(f)
        Rv.tofile(f)
        q16.tofile(f)
        inten.tofile(f)
    json.dump(dict(K=K, NL=NL, LP=LP, L=L, jaula=JAULA.tolist(),
                   apantalla_min=float(peor), cuadros=meta),
              open(os.path.join(OUT, 'faraday-jaula.json'), 'w'))
    mb = os.path.getsize(os.path.join(OUT, 'faraday-jaula-efield.bin')) / 1048576
    print(f"OK  faraday-jaula-efield.bin  {mb:.2f} MB ({K}×{NL}×{LP})")


if __name__ == '__main__':
    main()
