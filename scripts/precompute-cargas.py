#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-cargas.py — EL VIDEO DE CARGAS: la ley de Gauss, MOSTRADA.

Ian, 2026-07-28: "me gustaría hacer un video de cargas para no quedarnos solo en la química".

LA IDEA, y por qué se cuenta sola: se van agregando cargas de una en una, ALTERNANDO SIGNO,
sobre un hexágono. Entonces la carga total va

        1 carga → Q=+1     2 → Q=0     3 → Q=+1     4 → Q=0     5 → Q=+1     6 → Q=0

y por la ley de Gauss  ∮E·dA = 4πQ  las líneas que se escapan al infinito TIENEN que aparecer
y desaparecer con cada carga que sumas. No hay que decirlo: se ve. Cuando Q=0 toda línea que
sale regresa y el dibujo CIERRA; cuando Q=+1 sobran líneas que se van y no vuelven.

    "el número de líneas que se escapan te dice EXACTAMENTE cuánta carga hay adentro"

Y el segundo hallazgo, el que a Ian le voló la cabeza en el trímero de agua: en cuanto hay 3+
cargas aparecen PUNTOS DONDE EL CAMPO ES EXACTAMENTE CERO. Una carga puesta ahí no se mueve.
No se ven, no tienen marca, y están ahí. Se calculan y se guardan para que la escena los marque.

SIEMBRA (la del libro, la misma que usa scripts/campo-escalera.py):
  · N líneas por carga ∝ |q|, uniformes en ángulo, sobre una cascarita.
  · Todo es coplanar ⇒ una línea que nace en el plano SE QUEDA en el plano: el corte es exacto.
  · Correspondencia lagrangiana: la ranura (carga, dirección) es FIJA en todos los cuadros, así
    que la línea j es siempre la misma y se desliza suave. Las ranuras de una carga que todavía
    no "enciende" quedan degeneradas (un punto) y no se dibujan.

Formato: el de BondEField (K,NL,LP · Rvals · int16 bohr×2000) + el bloque uint8 de |E| al final,
igual que el trímero → la escena lo dibuja con el MISMO componente, sin renderer nuevo.
Las cargas van en un JSON hermano (datos, no código).

  python3 scripts/precompute-cargas.py [--quick]
"""
import os, sys, json, struct
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from campo_lineas import CampoPuntual, trazar, intensidad_u8

QUICK = '--quick' in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_EF = os.path.join(HERE, '..', 'public', 'precomputed', 'cargas-gauss-efield.bin')
OUT_JS = os.path.join(HERE, '..', 'public', 'precomputed', 'cargas-gauss.json')

RAD = 1.55                 # radio del hexágono (bohr) — compacto: la caja de trazado le queda 10×
POR_CARGA = 30             # líneas por unidad de carga (regla del libro: N ∝ |q|)
R0 = 0.05                  # cascarita de siembra
LP = 80
ETAPAS = 6                 # 1..6 cargas
FR_ETAPA = 4 if QUICK else 11
K = ETAPAS * FR_ETAPA
NL = ETAPAS * POR_CARGA    # ranuras fijas (6 cargas × 30) — la ranura j es SIEMPRE la misma línea

# hexágono, signos alternados: al encender de una en una, Q alterna +1, 0, +1, 0, …
TH = 2 * np.pi * np.arange(6) / 6
POS = np.stack([RAD * np.cos(TH), RAD * np.sin(TH), np.zeros(6)], axis=1)
SIGNO = np.array([+1.0, -1.0, +1.0, -1.0, +1.0, -1.0])

TRAZA = dict(tol=1e-9, hmax=25.0, hmin=5e-4, r_core=R0 * 0.9, r_caja=3000.0,
             s_max=9000.0, e_min=1e-18, max_pasos=6000, max_muestras=2600)
R_DIBUJO = 15.0            # el .bin guarda hasta aquí (int16 bohr×2000 topa en 16.38)


def cargas_en(k):
    """q de cada ranura en el cuadro k: la carga n se ENCIENDE (0→1) durante su etapa."""
    q = np.zeros(6)
    for n in range(6):
        ini = n * FR_ETAPA
        # +1 en el numerador: en k=0 la PRIMERA carga ya vale algo. Sin eso el cuadro 0 se
        # queda sin ninguna carga y el trazador revienta con un array vacío.
        t = (k - ini + 1) / max(FR_ETAPA * 0.55, 1e-9)      # rampa suave dentro de su etapa
        q[n] = SIGNO[n] * float(np.clip(t, 0.0, 1.0))
    return q


def ceros_del_campo(cp, n=121):
    """Los puntos donde E = 0 EXACTAMENTE. Ahí una carga de prueba no se mueve.

    Primero una rejilla VECTORIZADA (una sola llamada al campo) para localizar los mínimos
    locales de |E|; solo esos poquitos se refinan con Nelder-Mead. La versión ingenua lanzaba
    400 minimizaciones por cuadro y se comía el presupuesto entero.
    """
    from scipy.optimize import minimize
    if len(cp.q) < 2:
        return []
    g = np.linspace(-3.0, 3.0, n)
    X, Y = np.meshgrid(g, g, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), np.zeros(X.size)], axis=1)
    E = np.linalg.norm(cp(P), axis=1).reshape(n, n)
    dmin = np.linalg.norm(P[:, None, :] - cp.R[None], axis=2).min(axis=1).reshape(n, n)
    E = np.where(dmin < 0.30, np.inf, E)                       # ignora el pico junto a cada carga
    c = E[1:-1, 1:-1]
    esmin = np.ones_like(c, bool)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx or dy:
                esmin &= c <= E[1 + dx:n - 1 + dx, 1 + dy:n - 1 + dy]
    ii, jj = np.nonzero(esmin & np.isfinite(c))
    hallados = []
    for a, b in zip(ii + 1, jj + 1):
        r = minimize(lambda p: float(np.linalg.norm(cp(np.r_[p, 0.0][None])[0])),
                     np.array([g[a], g[b]]), method='Nelder-Mead',
                     options=dict(xatol=1e-9, fatol=1e-18, maxiter=800))
        if r.fun > 1e-7:
            continue
        x = np.r_[r.x, 0.0]
        if np.min(np.linalg.norm(x[None] - cp.R, axis=1)) < 0.25 or np.linalg.norm(x) > 6.0:
            continue
        if all(np.linalg.norm(x - h) > 0.10 for h in hallados):
            hallados.append(x)
    return hallados


def main():
    ef = np.zeros((K, NL, LP, 3), dtype=np.float32)
    ei = np.zeros((K, NL, LP), dtype=np.uint8)
    meta = []
    print(f"=== CARGAS · {K} cuadros · {NL} ranuras × {LP} pts · hexágono R={RAD} bohr ===", flush=True)
    print("k   n  Q total   líneas  se ESCAPAN   ceros del campo", flush=True)
    for k in range(K):
        q = cargas_en(k)
        act = np.abs(q) > 1e-6
        cp = CampoPuntual(q[act], POS[act])
        # semillas: ranura (carga n, dirección i) FIJA → correspondencia entre cuadros.
        # OJO: la ranura de una carga APAGADA no se traza. Sembrarla en la posición de esa
        # carga (que no está en cp) la convertía en una línea de campo REAL de las demás —
        # 150 líneas fantasma en el cuadro 2, contadas como fugas y además DIBUJADAS.
        S = np.zeros((NL, 3)); activa = np.zeros(NL, bool)
        for n in range(6):
            a = 2 * np.pi * (np.arange(POR_CARGA) + 0.5) / POR_CARGA
            nlin = int(round(POR_CARGA * q[n])) if q[n] > 1e-6 else 0   # solo las + nacen líneas
            for i in range(POR_CARGA):
                j = n * POR_CARGA + i
                S[j] = POS[n]
                if i < nlin:
                    S[j] = POS[n] + R0 * np.array([np.cos(a[i]), np.sin(a[i]), 0.0])
                    activa[j] = True
        idx_a = np.flatnonzero(activa)
        ef[k] = S[:, None, :]                          # por defecto: degenerada (invisible)
        escapan = 0
        if len(idx_a):
            SP, SS, nm, mot = trazar(cp, S[idx_a], sentido=+1, nucleos=cp.R, **TRAZA)
            for t, j in enumerate(idx_a):
                n_j = int(nm[t])
                cam = SP[t, :max(n_j, 1)]
                dentro = np.linalg.norm(cam, axis=1) <= R_DIBUJO
                if n_j < 3 or not dentro.any():
                    continue
                if mot[t] == 3:
                    escapan += 1
                corte = int(np.argmax(~dentro)) if (~dentro).any() else len(cam)
                cam = cam[:max(corte, 2)]
                seg = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(cam, axis=0), axis=1))]
                u = np.linspace(0, seg[-1], LP)
                pts = np.stack([np.interp(u, seg, cam[:, c]) for c in range(3)], axis=1)
                ef[k, j] = pts
                ei[k, j] = intensidad_u8(np.linalg.norm(cp(pts), axis=1), e_lo=2e-4, e_hi=40.0)
        nulos = ceros_del_campo(cp)
        Q = float(q.sum())
        meta.append(dict(k=k, q=q.tolist(), pos=POS.tolist(), Q=Q,
                         n_activas=int(act.sum()), escapan=escapan,
                         ceros=[list(map(float, x)) for x in nulos]))
        # LA PREDICCIÓN DURA: por Gauss, el flujo que se va al infinito es 4πQ, y cada línea
        # carga 4π/POR_CARGA. Entonces las fugas TIENEN que ser POR_CARGA × Q. Si esto no
        # cuadra, el video estaría afirmando algo que su propia simulación no cumple.
        esp = POR_CARGA * Q
        err = abs(escapan - esp)
        print(f"{k:2d}  {int(act.sum())}  {Q:+6.2f}   {int(activa.sum()):5d}"
              f"      {escapan:4d}   esperado {esp:5.1f}  {'OK ' if err <= 1.5 else 'X  '}   {len(nulos)}", flush=True)

    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL, LP))
        fp.write(np.arange(K, 0, -1, dtype='<f4').tobytes())     # Rvals: solo el índice de cuadro
        fp.write(np.clip(np.round(ef * 2000), -32767, 32767).astype('<i2').tobytes())
        fp.write(ei.tobytes())
    json.dump(dict(K=K, NL=NL, LP=LP, radio=RAD, por_carga=POR_CARGA, cuadros=meta),
              open(OUT_JS, 'w'), separators=(',', ':'))
    print(f"OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB ({NL}×{LP}×{K})", flush=True)
    print(f"OK  {OUT_JS}  {os.path.getsize(OUT_JS)/1024:.0f} KB (cargas + ceros por cuadro)", flush=True)


if __name__ == '__main__':
    main()
