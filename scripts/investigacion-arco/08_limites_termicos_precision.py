#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
08 · LIMITES TERMICOS Y DE PRECISION (La Forja, investigacion del arco, 2026-11-05)

Pregunta: que precision, velocidad y calidad son fisicamente alcanzables imprimiendo gota a gota con el
alambre Truper MICRO-1 E71T-GS 0.030" (0.8 mm), tubular, SIN gas, a 40-60 A.

Reproduce TODOS los numeros de docs/investigacion-arco/08-limites-termicos-precision.md
Correr:   python3 08_limites_termicos_precision.py > 08_limites_termicos_precision.out
          (numpy >= 2.0, scipy >= 1.11; las paredes van en paralelo con multiprocessing; ~5-10 min en 16 nucleos)

Secciones
  A. El alambre real (fichas): metal por mm, quemada vs corriente, "impuesto del arco" J/mm3, ley I ~ v_f^n
  B. Calor por gota y por mm
  C. Rosenthal en la placa de 3 mm (punto con imagenes, base adiabatica = loseta), espesor de Adams, t8/5
  D. Rosenthal en la pared delgada (linea movil en el borde de una placa de espesor w)
  E. El punto de gota (fuente quieta mientras se forma la gota): placa y pared
  F. La placa de prueba 100x50x3 sobre la loseta: se calienta toda (modelo concentrado)
  G. Pared 50x50 por diferencias finitas: temperatura entre capas y espera adaptativa (telemetria capa por capa)
  H. Geometria: ancho/alto vs avance, ondulacion, resolucion (gota 0.46 vs globular 1.63)
  I. Tasa de deposito y tiempos de construccion (cubo 20, pared 50x50, engrane chico)
  J. LA ESCORIA: volumen por gota y por capa, flotacion (Stokes) vs vida del charco, capas entre cepillados
  K. Esfuerzos residuales y deformacion (fuerza de tendon)
  L. Comparacion con CMT-WAAM y con la impresora abierta de Pearce (MOST)
"""
import math
import sys
import time
from multiprocessing import Pool

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla
from scipy.special import erfc, exp1, k0

np.set_printoptions(linewidth=160)

# ----------------------------------------------------------------------------------------------------------
# constantes
# ----------------------------------------------------------------------------------------------------------
T0 = 25.0                       # C ambiente
RHO = 7850.0                    # kg/m3 acero
SB = 5.670e-8                   # Stefan-Boltzmann
TSOL, TLIQ = 1460.0, 1520.0     # C solidus / liquidus aprox. del deposito
LAT = 270e3                     # J/kg calor latente
TM_R = 1490.0                   # isoterma de fusion para Rosenthal
K_R, C_R = 30.0, 650.0          # Rosenthal: propiedades promedio a alta T
ALPHA_R = K_R / (RHO * C_R)     # m2/s
K_ACTION = 1.483e16             # A2 s/m4, integral de accion hasta liquido (operador-revision 2026-10-31, seccion A)
ETA = 0.80                      # eficiencia de arco a la pieza (DuPont-Marder: 0.84 para electrodo consumible)
V_GOTA = 4.0 / 3.0 * math.pi * 0.46 ** 3      # mm3, gota del campanazo (radio 0.46 mm)
V_GLOB = 4.0 / 3.0 * math.pi * 1.63 ** 3      # mm3, gota globular CC 60 A del canon (radio 1.63 mm)


def hr(t):
    print("=" * 110)
    print(t)
    print("=" * 110)


# ----------------------------------------------------------------------------------------------------------
# propiedades dependientes de T (para la simulacion de pared)
# ----------------------------------------------------------------------------------------------------------
K_MARANGONI = 3.0              # conductividad efectiva del liquido (conveccion de Marangoni), practica comun en modelos de WAAM
T_ACT = 2100.0                  # C, el metal nuevo nace como gota sobrecalentada (2350-2700 en la literatura de GMAW)
T_CAP = 2700.0                  # C, tope fisico (evaporacion); la energia recortada se reporta


def k_T(T):
    k = np.maximum(27.0, 52.0 - 0.032 * T)
    return k * (1.0 + (K_MARANGONI - 1.0) * np.clip((T - TSOL) / (TLIQ - TSOL), 0.0, 1.0))


def c_T(T):
    c = np.minimum(450.0 + 0.30 * T, 660.0)
    return c + np.where((T >= TSOL) & (T <= TLIQ), LAT / (TLIQ - TSOL), 0.0)


def H_of(T):
    Ts = np.linspace(T0, T, 4001)
    return float(np.trapezoid(c_T(Ts), Ts))      # J/kg desde T0


# ==========================================================================================================
# A. EL ALAMBRE REAL
# ==========================================================================================================
D030 = 0.030 * 25.4                              # mm, diametro real del MICRO-1 (ficha Truper 13751: 0.030")
M_LIN = 453.59237 / (450.0 * 0.3048)             # g/m (McMaster: E71T-11 0.030" ~450 ft/lb)
EF_C, EF_LO, EF_HI = 0.80, 0.75, 0.82            # eficiencia de deposito (Lincoln: 75-81 %, 1.22 kg/kg = 82 %)
QMM = M_LIN * EF_C / 7.85                        # mm3 de metal depositado por mm de alambre
# fichas (fuente, diametro mm, I A, V, wfs m/min, eficiencia o None)
FICHAS = [
    ("Lincoln NR-211-MP 0.030in (E71T-11)", 0.762, 30, 13.5, 1.27, 0.81),
    ("Lincoln NR-211-MP 0.030in (E71T-11)", 0.762, 60, 14.0, 2.54, 0.75),
    ("Blue Demon 0.030in (E71T-GS)", 0.762, 50, 15.0, 80 * 0.0254, None),
    ("Blue Demon 0.030in (E71T-GS)", 0.762, 100, 16.0, 225 * 0.0254, None),
    ("Blue Demon 0.030in (E71T-GS)", 0.762, 150, 17.0, 375 * 0.0254, None),
    ("Lincoln NR-211-MP EU 0.9mm", 0.9, 30, 14.0, 1.25, 0.82),
    ("Lincoln NR-211-MP EU 0.9mm", 0.9, 90, 16.0, 2.30, 0.82),
    ("Lincoln NR-211-MP EU 0.9mm", 0.9, 120, 16.5, 2.80, 0.82),
]


def wfs_de_I(I):
    """ajuste v = a*I con los tres puntos 0.030" de baja corriente (30, 50, 60 A)."""
    pts = [(30, 1.27), (60, 2.54), (50, 80 * 0.0254)]
    a = sum(v * i for i, v in pts) / sum(i * i for i, v in pts)
    return a * I, a


def V_de_I(I):
    return 14.5 + 0.05 * (I - 40)                # V, fichas 13.5-16 V entre 30 y 90 A


def seccion_A():
    hr("A. EL ALAMBRE REAL: Truper MICRO-1 E71T-GS 0.030\" (fichas de alambres equivalentes)")
    Ageo = math.pi / 4 * D030 ** 2
    print(f"  diametro real 0.030\" = {D030:.3f} mm (el canon usa 0.800); area geometrica {Ageo:.3f} mm2 (0.8 mm: 0.503)")
    print(f"  masa lineal (McMaster 450 ft/lb) = {M_LIN:.3f} g/m ; macizo de ese diametro = {Ageo * 7.85:.3f} g/m")
    for ef in (EF_LO, EF_C, EF_HI):
        q = M_LIN * ef / 7.85
        print(f"  eficiencia {ef:.2f}: metal depositado = {q:.3f} mm3 por mm de alambre  (= {q / Ageo * 100:.0f} % del area geometrica)")
    print(f"  -> se usa {QMM:.3f} mm3/mm. El canon (TS) usa 0.503 mm2: sobreestima el metal x{0.503 / QMM:.2f}")
    print()
    print("  fichas  (P = V*I, q_neto = 0.8 P, J = q_neto / caudal de metal = calor a la pieza por mm3 depositado)")
    print(f"  {'fuente':38s} {'I A':>5} {'V':>5} {'wfs m/min':>9} {'Qm mm3/s':>9} {'kg/h':>6} {'P W':>6} {'J J/mm3':>8}")
    for f, d, I, V, w, ef in FICHAS:
        ml = M_LIN * (d / 0.762) ** 2
        e = ef if ef else EF_C
        Qm = w * 1000 / 60 * ml * e / 7.85
        P = V * I
        print(f"  {f:38s} {I:5.0f} {V:5.1f} {w:9.2f} {Qm:9.2f} {Qm * 7.85e-3 * 3.6:6.2f} {P:6.0f} {ETA * P / Qm:8.1f}")
    print("  (J del metal solo: fundir 10.3 J/mm3; gota a 2100-2400 C: 14.0-15.9 J/mm3; ver B)")
    print()
    print("  LEY DEL OPERADOR I ~ v_f^n  (Joule puro en el stickout -> n = 0.5)")
    pares = [("Lincoln 0.030 30->60 A", 30, 1.27, 60, 2.54), ("Blue Demon 50->100 A", 50, 2.032, 100, 5.715),
             ("Blue Demon 100->150 A", 100, 5.715, 150, 9.525), ("Lincoln 0.9 30->90 A", 30, 1.25, 90, 2.30),
             ("Lincoln 0.9 90->120 A", 90, 2.30, 120, 2.80)]
    for nm, I1, v1, I2, v2 in pares:
        print(f"    {nm:26s} n = {math.log(I2 / I1) / math.log(v2 / v1):5.2f}")
    a = wfs_de_I(1)[1]
    print(f"  ajuste de quemada (0.030\", 30-60 A): v_f = {a:.4f} m/min por A  (n = 1)")
    print()
    print("  Fraccion de la fusion que pone el Joule del stickout (adiabatico, K = 1.483e16 A2s/m4, funda de A_s, +15 % por el fundente)")
    print(f"  {'caso':34s} {'L mm':>5} {'I A':>5} {'v_f m/min':>9} | {'A_s=0.25':>8} {'0.28':>6} {'0.32':>6} mm2")
    casos = [("ficha 30 A (CTWD 1/2\")", 13, 30, 1.27), ("ficha 60 A (CTWD 1/2\")", 13, 60, 2.54),
             ("40 A, stickout 13", 13, 40, wfs_de_I(40)[0]), ("40 A, stickout 25", 25, 40, wfs_de_I(40)[0])]
    for nm, L, I, v in casos:
        fr = [I * I * (L / 1000) / (v / 60) / (K_ACTION * (As * 1e-6) ** 2 * 1.15) for As in (0.25, 0.28, 0.32)]
        print(f"  {nm:34s} {L:5.0f} {I:5.0f} {v:9.2f} | {fr[0] * 100:7.0f}% {fr[1] * 100:5.0f}% {fr[2] * 100:5.0f}%")
    print("  stickout para fundir TODO por Joule (A_s = 0.28 mm2):")
    for I, v in ((40, wfs_de_I(40)[0]), (50, wfs_de_I(50)[0]), (60, wfs_de_I(60)[0]), (45.3, 3.0)):
        L = K_ACTION * (0.28e-6) ** 2 * 1.15 * (v / 60) / (I * I) * 1000
        print(f"    I = {I:5.1f} A rms, v_f = {v:4.2f} m/min -> L = {L:5.1f} mm")
    I_rms = math.sqrt(40 ** 2 + 30 ** 2 / 2)
    print(f"  CANON: campanazo 40 A + 30 A AC (I_rms {I_rms:.1f} A) a 3 m/min; las fichas dan {wfs_de_I(I_rms)[0]:.2f} m/min a esa corriente"
          f" (x{3.0 / wfs_de_I(I_rms)[0]:.2f})")
    print(f"         con el metal real: 3 m/min -> {50 * QMM:.1f} mm3/s -> {50 * QMM / (V_GOTA):.0f} gotas/s de r=0.46 (el TS reporta 75)")


# ==========================================================================================================
# B. CALOR POR GOTA Y POR MM
# ==========================================================================================================
def h_gota(Td):
    """J/kg de 25 C a gota liquida a Td (tabla del operador: 1308 kJ/kg liquido a 1520 C; c_liq 0.82 kJ/kgK)."""
    return 1308e3 + 820.0 * (Td - 1520.0)


def puntos_operacion():
    out = []
    for I in (40, 50, 60):
        v, _ = wfs_de_I(I)
        Qm = v * 1000 / 60 * QMM
        V = V_de_I(I)
        P = V * I
        q = ETA * P
        out.append(dict(I=I, wfs=v, Qm=Qm, V=V, P=P, q=q, J=q / Qm))
    return out


def seccion_B():
    hr("B. CALOR POR GOTA Y POR MM  (eta = 0.80; V de fichas; gota r = 0.46 mm = 0.408 mm3 = 3.20 mg)")
    m_g = V_GOTA * 7.85e-6                                   # kg (volumen solido equivalente)
    print(f"  gota: V = {V_GOTA:.4f} mm3, masa {m_g * 1e6:.2f} mg; entalpia propia a 2100 C = {m_g * h_gota(2100):.2f} J, a 2400 C = {m_g * h_gota(2400):.2f} J")
    print(f"  gota globular CC 60 A (r 1.63): V = {V_GLOB:.1f} mm3 = {V_GLOB / V_GOTA:.0f} gotas chicas")
    print()
    print(f"  {'I A':>4} {'wfs':>5} {'Qm mm3/s':>8} {'kg/h':>5} {'V':>5} {'P W':>5} {'q_neto':>6} {'J/mm3':>6} {'gotas/s':>7} {'J/gota':>6} {'en gota':>7} {'t_forma ms':>10}")
    for o in puntos_operacion():
        gps = o["Qm"] / V_GOTA
        print(f"  {o['I']:4.0f} {o['wfs']:5.2f} {o['Qm']:8.2f} {o['Qm'] * 7.85e-3 * 3.6:5.2f} {o['V']:5.1f} {o['P']:5.0f} {o['q']:6.0f}"
              f" {o['J']:6.1f} {gps:7.1f} {o['J'] * V_GOTA:6.1f} {m_g * h_gota(2250):7.2f} {1000 / gps:10.1f}")
    print("  (sensibilidad V = 14 + 10 V/mm * L de ian con L = 0.3 mm: 17 V -> q_neto x1.17 a 40 A)")
    print()
    print("  calor por mm de avance (J/mm) = q_neto / v")
    vs = (2.8, 5, 10, 16, 32, 40)
    print("  I A  " + "".join(f"{v:>9.1f}" for v in vs) + "   mm/s")
    for o in puntos_operacion():
        print(f"  {o['I']:3.0f}  " + "".join(f"{o['q'] / v:9.1f}" for v in vs))


# ==========================================================================================================
# C. ROSENTHAL EN LA PLACA DE 3 MM
# ==========================================================================================================
def T_punto_imagenes(q, v, xi, y, z, d, N=8):
    """fuente puntual movil en la superficie de una placa de espesor d con caras adiabaticas (imagenes)."""
    s = np.zeros(np.broadcast(xi, y, z).shape)
    nn = range(-N, N + 1) if d is not None else [0]
    for n in nn:
        zz = z - 2 * n * (d if d is not None else 0.0)
        R = np.sqrt(xi ** 2 + y ** 2 + zz ** 2) + 1e-9
        s = s + np.exp(-v * (xi + R) / (2 * ALPHA_R)) / R
    return T0 + q / (2 * math.pi * K_R) * s


def T_linea(q, v, xi, y, d):
    r = np.sqrt(xi ** 2 + y ** 2) + 1e-9
    return T0 + q / (2 * math.pi * K_R * d) * np.exp(-v * xi / (2 * ALPHA_R)) * k0(v * r / (2 * ALPHA_R))


def charco_superficie(fT, xs=None, ys=None):
    xs = np.linspace(-30e-3, 4e-3, 1701) if xs is None else xs
    ys = np.linspace(0, 8e-3, 401) if ys is None else ys
    X, Y = np.meshgrid(xs, ys, indexing="ij")
    T = fT(X, Y)
    m = T >= TM_R
    if not m.any():
        return 0.0, 0.0, float(T.max())
    w = 2 * Y[m].max()
    L = X[m].max() - X[m].min()
    return w * 1e3, L * 1e3, float(T.max())


def prof_charco(q, v, d):
    zs = np.linspace(0, d if d else 6e-3, 301)
    xs = np.linspace(-20e-3, 3e-3, 1151)
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    T = T_punto_imagenes(q, v, X, 0.0 * X, Z, d)
    m = T >= TM_R
    return (Z[m].max() * 1e3) if m.any() else 0.0


def seccion_C():
    hr(f"C. ROSENTHAL EN LA PLACA DE 3 MM  (k = {K_R} W/mK, alfa = {ALPHA_R * 1e6:.2f} mm2/s, isoterma {TM_R:.0f} C; base adiabatica = loseta)")
    d = 3e-3
    print("  espesor relativo de Adams tau = d*sqrt(rho c (Tc-T0) v / q), Tc = 550 C: grueso > 0.9, delgado < 0.6")
    print(f"  {'I A':>4} {'q W':>5} {'v mm/s':>7} {'tau':>5} | {'ancho/largo mm':>16} {'prof mm':>8} {'(punto, placa 3mm)':>20} | {'grueso':>13} | {'delgado (linea)':>16} | {'t8/5 s grueso/delgado':>22}")
    for o in puntos_operacion():
        q = o["q"]
        for v_mm in (2.8, 5, 10, 20, 40):
            v = v_mm * 1e-3
            tau = d * math.sqrt(RHO * C_R * (550 - T0) * v / q)
            w1, L1, _ = charco_superficie(lambda X, Y: T_punto_imagenes(q, v, X, Y, 0 * X, d))
            p1 = prof_charco(q, v, d)
            w2, L2, _ = charco_superficie(lambda X, Y: T_punto_imagenes(q, v, X, Y, 0 * X, None))
            w3, L3, _ = charco_superficie(lambda X, Y: T_linea(q, v, X, Y, d))
            Ql = q / v
            t85g = Ql / (2 * math.pi * K_R) * (1 / (500 - T0) - 1 / (800 - T0))
            t85d = Ql ** 2 / (4 * math.pi * K_R * RHO * C_R * d ** 2) * (1 / (500 - T0) ** 2 - 1 / (800 - T0) ** 2)
            print(f"  {o['I']:4.0f} {q:5.0f} {v_mm:7.1f} {tau:5.2f} | {w1:7.2f} / {L1:6.2f} {p1:8.2f} {'':>20} | {w2:5.2f} / {L2:5.2f} | {w3:6.2f} / {L3:6.2f} | {t85g:9.2f} / {t85d:9.2f}")
    print()
    print("  potencia a la pieza para que el charco en placa 3 mm mida 1.2 mm de ancho (= mancha de una gota):")
    for v_mm in (4, 10, 20, 40):
        v = v_mm * 1e-3
        lo, hi = 1.0, 2000.0
        for _ in range(28):
            mid = 0.5 * (lo + hi)
            w, _, _ = charco_superficie(lambda X, Y: T_punto_imagenes(mid, v, X, Y, 0 * X, d),
                                        xs=np.linspace(-8e-3, 1.5e-3, 951), ys=np.linspace(0, 1.5e-3, 301))
            if w > 1.2:
                hi = mid
            else:
                lo = mid
        print(f"    v = {v_mm:4.0f} mm/s -> q <= {lo:5.0f} W   (a 40 A hay {puntos_operacion()[0]['q']:.0f} W)")


# ==========================================================================================================
# D. ROSENTHAL EN LA PARED DELGADA (fuente en el borde de una placa de espesor w; flujo 2D en el plano de la pared)
# ==========================================================================================================
def T_pared(q, v, xi, z, w):
    r = np.sqrt(xi ** 2 + z ** 2) + 1e-9
    return T0 + q / (math.pi * K_R * w) * np.exp(-v * xi / (2 * ALPHA_R)) * k0(v * r / (2 * ALPHA_R))


def charco_pared(q, v, w, xmin=-80e-3, nx=4151, nz=601):
    xs = np.linspace(xmin, 3e-3, nx)
    zs = np.linspace(0, 12e-3, nz)
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    T = T_pared(q, v, X, Z, w)
    m = T >= TM_R
    if not m.any():
        return 0.0, 0.0
    return (X[m].max() - X[m].min()) * 1e3, Z[m].max() * 1e3


def seccion_D():
    hr("D. ROSENTHAL EN LA PARED DELGADA (linea movil en el borde de la pared de espesor w; sin perdidas laterales)")
    print("  largo del charco sobre la pared / profundidad de fusion bajo la superficie (mm). Liquido mas largo que ~pi*w = pared que se escurre")
    print(f"  {'w mm':>5} {'q W':>5} | " + " | ".join(f"v={v:>4.1f}" for v in (2.8, 8, 16, 32, 64)) + "   mm/s")
    for w_mm in (1.2, 3.5):
        for o in puntos_operacion():
            q = o["q"]
            cells = []
            for v_mm in (2.8, 8, 16, 32, 64):
                L, p = charco_pared(q, v_mm * 1e-3, w_mm * 1e-3)
                cells.append(f"{L:5.1f}/{p:4.1f}" if L < 82.0 else f"  >80/{p:4.1f}")
            print(f"  {w_mm:5.1f} {q:5.0f} | " + " | ".join(cells))
    print()
    print("  potencia maxima para que el charco en pared de 1.2 mm sea <= 3.8 mm de largo (pi*w):")
    for v_mm in (4, 8, 16, 32, 64):
        lo, hi = 1.0, 3000.0
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            L, _ = charco_pared(mid, v_mm * 1e-3, 1.2e-3, xmin=-8e-3, nx=1101, nz=201)
            if L > 3.8:
                hi = mid
            else:
                lo = mid
        print(f"    v = {v_mm:4.0f} mm/s -> q <= {lo:5.0f} W")


# ==========================================================================================================
# E. EL PUNTO DE GOTA: fuente quieta durante la formacion de UNA gota
# ==========================================================================================================
def seccion_E():
    hr("E. EL PUNTO DE GOTA: el arco quieto mientras se forma una gota (radio fundido al terminar)")
    print("  placa gruesa: T = q/(2 pi k r) erfc(r / 2 sqrt(a t)) ;  borde de pared w: T = q/(2 pi k w) E1(r^2 / 4 a t)")
    print(f"  {'I A':>4} {'q W':>5} {'t_forma ms':>10} | {'radio fundido placa mm':>22} | {'pared 1.2: radio mm':>19}")
    for o in puntos_operacion():
        t = V_GOTA / o["Qm"]
        rs = np.linspace(1e-6, 5e-3, 50001)
        Tp = T0 + o["q"] / (2 * math.pi * K_R * rs) * erfc(rs / (2 * math.sqrt(ALPHA_R * t)))
        Tw = T0 + o["q"] / (2 * math.pi * K_R * 1.2e-3) * exp1(rs ** 2 / (4 * ALPHA_R * t))
        rp = rs[Tp >= TM_R].max() * 1e3
        rw = rs[Tw >= TM_R].max() * 1e3
        print(f"  {o['I']:4.0f} {o['q']:5.0f} {t * 1e3:10.1f} | {rp:22.2f} | {rw:19.2f}")
    print("  -> UNA gota sola funde una mancha de ~1.3 mm en placa y en pared (en 30-45 ms el calor viaja sqrt(a t) ~ 0.5 mm,")
    print("     menos que la media pared): el punto de gota SI es posible localmente. Lo que lo rompe es la SUMA de gotas (seccion D y G).")


# ==========================================================================================================
# F. LA PLACA 100x50x3 SOBRE LA LOSETA: se calienta toda
# ==========================================================================================================
def perdidas(T, A_rad, eps=0.7, h=10.0, Gbot=0.0):
    Tk, T0k = T + 273.15, T0 + 273.15
    return eps * SB * A_rad * (Tk ** 4 - T0k ** 4) + h * A_rad * (T - T0) + Gbot * (T - T0)


def seccion_F():
    hr("F. LA PLACA DE PRUEBA 100x50x3 mm SOBRE LA LOSETA (concentrada; eps 0.7, h 10 W/m2K, loseta ~10 W/m2K)")
    m = 100 * 50 * 3 * 7.85e-3 / 1000                       # kg
    A_rad = 2 * (0.1 * 0.05) * 0.5 + 0.1 * 0.05 * 0.5 * 0 + 2 * (0.1 + 0.05) * 0.003   # cara de arriba + cantos
    A_rad = 0.1 * 0.05 + 2 * (0.1 + 0.05) * 0.003
    Gbot = 10.0 * 0.1 * 0.05
    print(f"  masa {m * 1000:.0f} g; area que irradia {A_rad * 1e4:.0f} cm2; conductancia a la loseta {Gbot:.2f} W/K")
    for o in puntos_operacion():
        q = o["q"]
        T, t, dt = T0, 0.0, 0.05
        hits = {}
        while t < 1200:
            c = float(np.mean(c_T(np.array([T]))))
            T += dt * (q - perdidas(T, A_rad, Gbot=Gbot)) / (m * c)
            t += dt
            for Tt in (200, 400, 600):
                if T >= Tt and Tt not in hits:
                    hits[Tt] = t
        lo, hi = T0, 2000.0
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            if perdidas(mid, A_rad, Gbot=Gbot) > q:
                hi = mid
            else:
                lo = mid
        s = ", ".join(f"{k} C en {v:5.1f} s" for k, v in hits.items())
        print(f"  {o['I']:3.0f} A ({q:4.0f} W) arco continuo: {s}; estacionario {lo:5.0f} C")
    for Tt in (250, 400):
        print(f"  potencia que la placa sola tira a {Tt} C: {perdidas(Tt, A_rad, Gbot=Gbot):5.1f} W  -> ciclo de arco a 40 A <= "
              f"{perdidas(Tt, A_rad, Gbot=Gbot) / puntos_operacion()[0]['q'] * 100:4.1f} %")


# ==========================================================================================================
# G. PARED 50x50 POR DIFERENCIAS FINITAS (x a lo largo de la pared, z hacia arriba; espesor fuera del plano b)
# ==========================================================================================================
def simular_pared(cfg):
    t_ini = time.time()
    nombre = cfg["nombre"]
    w, h, I = cfg["w"], cfg["h"], cfg["I"]
    o = [p for p in puntos_operacion() if p["I"] == I][0]
    Qm, q_net = o["Qm"], o["q"]
    n_capas = cfg["capas"]
    dz = cfg.get("dz", h) * 1e-3
    dx = 1.0e-3
    h_conv = cfg.get("h_conv", 10.0)
    h_bot = cfg.get("h_bot", 10.0)
    eps = 0.7
    T_obj = cfg.get("T_obj", 400.0)
    espera_fija = cfg.get("espera_fija", None)
    Lw, Lp, bp, dp = 50.0, 100.0, 50.0, 3.0
    nrz = int(round(h * 1e-3 / dz))
    n_p = int(round(dp * 1e-3 / dz))
    nz = n_p + n_capas * nrz
    nx = int(round(Lp * 1e-3 / dx))
    xc = (np.arange(nx) + 0.5) * dx
    x_ini, x_fin = (Lp - Lw) / 2 * 1e-3, (Lp + Lw) / 2 * 1e-3
    enx = (xc > x_ini) & (xc < x_fin)
    jw = np.where(enx)[0]
    b = np.zeros((nz, nx))
    b[:n_p, :] = bp * 1e-3
    b[n_p:, enx] = w * 1e-3
    act = np.zeros((nz, nx), bool)
    act[:n_p, :] = True
    T = np.full((nz, nx), T0)
    top = np.full(nx, n_p - 1)
    v = Qm * 1e-9 / (w * 1e-3 * h * 1e-3)
    q_metal = Qm * 1e-9 * RHO * H_of(T_ACT)
    q_src = q_net - q_metal
    am = max(52.0 / (RHO * 450.0), 27.0 * K_MARANGONI / (RHO * 660.0))
    dt = 0.8 / (2 * am * (1 / dx ** 2 + 1 / dz ** 2))
    T0k = T0 + 273.15
    sig = 1.0e-3

    def areas(act):
        A = np.zeros((nz, nx))
        wall = act.copy()
        wall[:n_p] = False
        A[wall] += 2 * dx * dz                                     # dos caras de la pared
        arriba = np.zeros_like(act)
        arriba[:-1] = ~act[1:]
        arriba[-1] = True
        A[wall & arriba] += (w * 1e-3) * dx                         # tapa expuesta
        izq = np.zeros_like(act)
        izq[:, 1:] = ~act[:, :-1]
        izq[:, 0] = True
        der = np.zeros_like(act)
        der[:, :-1] = ~act[:, 1:]
        der[:, -1] = True
        A[wall & izq] += (w * 1e-3) * dz
        A[wall & der] += (w * 1e-3) * dz
        A[:n_p, :] += 2 * dx * dz                                   # cantos largos de la placa
        A[:n_p, 0] += bp * 1e-3 * dz
        A[:n_p, -1] += bp * 1e-3 * dz
        fp = n_p - 1
        A[fp, :] += (bp * 1e-3 - np.where(act[n_p] if n_p < nz else False, w * 1e-3, 0.0)) * dx
        return A

    Abot = np.zeros((nz, nx))
    Abot[0, :] = bp * 1e-3 * dx

    def conductancias(T, act):
        k = k_T(T)
        bx = act[:, :-1] & act[:, 1:]
        kx = 2 * k[:, :-1] * k[:, 1:] / (k[:, :-1] + k[:, 1:])
        Gx = np.where(bx, kx * np.minimum(b[:, :-1], b[:, 1:]) * dz / dx, 0.0)
        bz = act[:-1, :] & act[1:, :]
        kz = 2 * k[:-1] * k[1:] / (k[:-1] + k[1:])
        Gz = np.where(bz, kz * np.minimum(b[:-1], b[1:]) * dx / dz, 0.0)
        return Gx, Gz

    def heff(T):
        Tk = T + 273.15
        return h_conv + eps * SB * (Tk ** 2 + T0k ** 2) * (Tk + T0k)

    def paso_exp(T, act, A, src):
        Gx, Gz = conductancias(T, act)
        dQ = np.zeros_like(T)
        fx = Gx * (T[:, 1:] - T[:, :-1])
        dQ[:, :-1] += fx
        dQ[:, 1:] -= fx
        fz = Gz * (T[1:] - T[:-1])
        dQ[:-1] += fz
        dQ[1:] -= fz
        dQ -= heff(T) * A * (T - T0) + h_bot * Abot * (T - T0)
        dQ += src
        C = RHO * c_T(T) * np.where(act, b, 1.0) * dx * dz
        return np.where(act, T + dt * dQ / C, T)

    def paso_imp(T, act, A, dti):
        idx = -np.ones((nz, nx), int)
        N = int(act.sum())
        idx[act] = np.arange(N)
        Gx, Gz = conductancias(T, act)
        C = RHO * c_T(T) * b * dx * dz
        Gl = heff(T) * A + h_bot * Abot
        diag = np.zeros((nz, nx))
        diag += np.where(act, C / dti + Gl, 0.0)
        diag[:, :-1] += Gx
        diag[:, 1:] += Gx
        diag[:-1] += Gz
        diag[1:] += Gz
        rows, cols, vals = [idx[act]], [idx[act]], [diag[act]]
        mx = Gx > 0
        ia, ib = idx[:, :-1][mx], idx[:, 1:][mx]
        g = Gx[mx]
        rows += [ia, ib]
        cols += [ib, ia]
        vals += [-g, -g]
        mz = Gz > 0
        ia, ib = idx[:-1][mz], idx[1:][mz]
        g = Gz[mz]
        rows += [ia, ib]
        cols += [ib, ia]
        vals += [-g, -g]
        M = sp.csc_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(N, N))
        rhs = (C / dti * T + Gl * T0)[act]
        Tn = T.copy()
        Tn[act] = spla.spsolve(M, rhs)
        return Tn

    reg = []
    t_total = 0.0
    t_arco = 0.0
    q_recortado = 0.0
    corrida = "ok"
    for cap in range(n_capas):
        r0 = n_p + cap * nrz
        r1 = r0 + nrz
        if cap == 0:
            T_entre = float(T[n_p - 1, enx].max())
            T_entre_med = float(T[n_p - 1, enx].mean())
        else:
            T_entre = float(T[r0 - nrz:r0][:, enx].max())
            T_entre_med = float(T[r0 - nrz:r0][:, enx].mean())
        if T_entre_med > 1300:
            corrida = f"se detiene antes de la capa {cap + 1}: la capa anterior sigue en {T_entre_med:.0f} C de promedio (pared blanda)"
            break
        deep = np.full(nx, 10 ** 6)
        w0 = max(0, r0 - 40)
        d = 1 if cap % 2 == 0 else -1
        x_start = x_ini if d > 0 else x_fin
        n_steps = int(math.ceil((Lw * 1e-3) / (v * dt)))
        A = areas(act)
        snap = None
        Tmax = 0.0
        for s in range(n_steps + 1):
            xt = x_start + d * v * s * dt
            nuevo = (xc <= xt + 0.5 * dx) if d > 0 else (xc >= xt - 0.5 * dx)
            nuevo = nuevo & enx & ~act[r0, :]
            if nuevo.any():
                js = np.where(nuevo)[0]
                act[r0:r1, js] = True
                T[r0:r1, js] = T_ACT
                top[js] = r1 - 1
                A = areas(act)
            g = np.exp(-((xc[jw] - xt) ** 2) / (2 * sig ** 2))
            g = g / g.sum()
            src = np.zeros((nz, nx))
            src[top[jw], jw] = q_src * g
            T = paso_exp(T, act, A, src)
            sobre = T > T_CAP
            if sobre.any():
                q_recortado += float((RHO * 660.0 * b * dx * dz * (T - T_CAP))[sobre].sum())
                T = np.where(sobre, T_CAP, T)
            Tmax = max(Tmax, float(T.max()))
            liqw = (T[w0:r1] >= TSOL) & act[w0:r1]
            hay = liqw.any(axis=0)
            primero = np.argmax(liqw, axis=0) + w0
            deep = np.where(hay, np.minimum(deep, primero), deep)
            if s == n_steps // 2:
                jt = int(np.argmin(np.abs(xc - xt)))
                liq = act & (T >= TSOL)
                cols = liq[:, enx].any(axis=0)
                Lpool = cols.sum() * dx * 1e3
                colm = liq[:, jt]
                prof = 0
                for r in range(top[jt], -1, -1):
                    if colm[r]:
                        prof += 1
                    else:
                        break
                snap = (Lpool, prof * dz * 1e3, prof * dz * 1e3 - h)
        t_pase = n_steps * dt
        t_total += t_pase
        t_arco += t_pase
        espera = 0.0
        sup = lambda TT: float(TT[r0:r1][:, enx].max())
        if espera_fija is not None:
            objetivo = espera_fija
            dts = []
            while sum(dts) < objetivo - 1e-9:
                dts.append(min(2.0, objetivo - sum(dts), 0.25 * 2 ** (len(dts) // 2)))
            for dti in dts:
                A = areas(act)
                T = paso_imp(T, act, A, dti)
                espera += dti
        elif cap < n_capas - 1:
            k = 0
            while sup(T) > T_obj and espera < cfg.get("espera_max", 1200.0):
                dti = min(2.0 if espera < 30 else (5.0 if espera < 120 else 10.0), 0.25 * 2 ** (k // 2))
                A = areas(act)
                T = paso_imp(T, act, A, dti)
                espera += dti
                k += 1
        t_total += espera
        Tplaca = float(T[:n_p].mean())
        dj = deep[jw]
        ref = np.where(dj < 10 ** 6, (r0 - dj) * dz * 1e3, -h)
        ref_c = ref[3:-3] if ref.size > 8 else ref
        reg.append((cap + 1, t_total, T_entre, T_entre_med, espera, snap[0], snap[1], float(np.median(ref_c)), float(ref_c.min()), Tplaca, Tmax))
    return dict(nombre=nombre, cfg=cfg, reg=reg, t_total=t_total, t_arco=t_arco, v=v, Qm=Qm, q_net=q_net, q_recortado=q_recortado,
                q_src=q_src, q_metal=q_metal, dt=dt, corrida=corrida, seg=time.time() - t_ini,
                vol=Lw * w * h * len(reg))


CASOS_PARED = [
    dict(nombre="G1 gota  w1.2 h0.5 40A loseta      T<=400", w=1.2, h=0.5, dz=0.25, I=40, capas=100, h_bot=10.0, h_conv=10.0, T_obj=400.0),
    dict(nombre="G2 gota  w1.2 h0.5 40A disipador   T<=400", w=1.2, h=0.5, dz=0.25, I=40, capas=100, h_bot=3000.0, h_conv=10.0, T_obj=400.0),
    dict(nombre="G3 gota  w1.2 h0.5 40A disip+aire  T<=400", w=1.2, h=0.5, dz=0.25, I=40, capas=100, h_bot=3000.0, h_conv=80.0, T_obj=400.0),
    dict(nombre="G4 gota  w1.2 h0.5 40A disip+aire  T<=250", w=1.2, h=0.5, dz=0.25, I=40, capas=100, h_bot=3000.0, h_conv=80.0, T_obj=250.0),
    dict(nombre="G5 gota  w1.2 h0.5 40A loseta  SIN espera", w=1.2, h=0.5, dz=0.25, I=40, capas=100, h_bot=10.0, h_conv=10.0, espera_fija=0.0),
    dict(nombre="G6 gota  w1.2 h0.25 40A disipador  T<=400", w=1.2, h=0.25, dz=0.25, I=40, capas=20, h_bot=3000.0, h_conv=10.0, T_obj=400.0),
    dict(nombre="C1 cont. w3.5 h1.0 40A loseta      T<=400", w=3.5, h=1.0, dz=0.5, I=40, capas=50, h_bot=10.0, h_conv=10.0, T_obj=400.0),
    dict(nombre="C2 cont. w3.5 h1.0 40A disipador   T<=400", w=3.5, h=1.0, dz=0.5, I=40, capas=50, h_bot=3000.0, h_conv=10.0, T_obj=400.0),
    dict(nombre="C3 cont. w3.5 h1.0 40A disip+aire  T<=400", w=3.5, h=1.0, dz=0.5, I=40, capas=50, h_bot=3000.0, h_conv=80.0, T_obj=400.0),
    dict(nombre="C4 cont. w4.0 h1.0 60A disip+aire  T<=400", w=4.0, h=1.0, dz=0.5, I=60, capas=50, h_bot=3000.0, h_conv=80.0, T_obj=400.0),
]


def imprimir_pared(r):
    c = r["cfg"]
    print(f"--- {r['nombre']}   (v = {r['v'] * 1e3:.2f} mm/s, Qm = {r['Qm']:.2f} mm3/s, q_neto {r['q_net']:.0f} W = metal a {T_ACT:.0f} C {r['q_metal']:.0f} W + arco a la superficie {r['q_src']:.0f} W;"
          f" h_bot {c.get('h_bot')} h_conv {c.get('h_conv')}; dt {r['dt'] * 1e3:.2f} ms; {r['seg']:.0f} s de CPU)")
    print(f"    {'capa':>4} {'t min':>7} {'T entre max/medio C':>19} {'espera s':>8} {'charco mm':>9} {'fusion mm':>9} {'refunde mediana/min mm':>22} {'T placa':>7} {'Tmax':>6}")
    reg = r["reg"]
    n = len(reg)
    sel = sorted(set([1, 2, 3, 5, 10, 20, 30, 40, 50, 60, 75, 90, n] + ([n - 1] if n > 1 else [])))
    for cap, t, Te, Tem, es, Lp, pr, re, rmin, Tp, Tm in reg:
        if cap in sel:
            print(f"    {cap:4d} {t / 60:7.2f} {Te:9.0f} / {Tem:7.0f} {es:8.1f} {Lp:9.1f} {pr:9.2f} {re:12.2f} / {rmin:7.2f} {Tp:7.0f} {Tm:6.0f}")
    alto = n * c["h"]
    print(f"    TOTAL: {n} capas = {alto:.1f} mm de alto, {r['vol']:.0f} mm3 ({r['vol'] * 7.85e-3:.1f} g) en {r['t_total'] / 60:.1f} min"
          f" (arco {r['t_arco'] / 60:.1f} min = {r['t_arco'] / r['t_total'] * 100:.0f} %); promedio {r['vol'] / r['t_total']:.2f} mm3/s"
          f" = {r['vol'] * 7.85e-3 / r['t_total'] * 3600:.0f} g/h; energia recortada en {T_CAP:.0f} C = {r['q_recortado'] / (r['q_net'] * r['t_arco']) * 100:.1f} % del arco;"
          f" {r['corrida']}")
    esperas = [x[4] for x in reg[:-1]]
    if esperas:
        print(f"    espera entre capas: min {min(esperas):.0f} s, mediana {float(np.median(esperas)):.0f} s, max {max(esperas):.0f} s;"
              f" charco mediano {float(np.median([x[5] for x in reg])):.1f} mm; refusion mediana {float(np.median([x[7] for x in reg[1:]] or [0])):.2f} mm,"
              f" peor columna {min([x[8] for x in reg[1:]] or [0]):.2f} mm")


# ==========================================================================================================
# H. GEOMETRIA Y RESOLUCION
# ==========================================================================================================
def seccion_H():
    hr("H. GEOMETRIA: seccion por pasada A = Qm / v; pared de ancho w -> capa h = A / w; ondulacion lateral ~ (0.13-0.30) h")
    o40 = puntos_operacion()[0]
    print(f"  40 A, Qm = {o40['Qm']:.2f} mm3/s")
    print(f"  {'v mm/s':>7} {'A mm2':>6} | {'h si w=1.2':>10} {'h si w=2.5':>10} {'h si w=3.5':>10} | {'gotas por mm':>12} {'paso entre gotas mm':>19}")
    for v in (2, 2.8, 4, 8, 16, 32, 40):
        A = o40["Qm"] / v
        gpm = o40["Qm"] / V_GOTA / v
        print(f"  {v:7.1f} {A:6.2f} | {A / 1.2:10.2f} {A / 2.5:10.2f} {A / 3.5:10.2f} | {gpm:12.2f} {1 / gpm:19.2f}")
    print()
    print("  referencia medida (Prado-Cerqueira 2018, CMT, ER70S-6 0.8 mm, 2.5 m/min, 6.67 mm/s): A = "
          f"{2.5 * 1000 / 60 * 0.5027 / 6.667:.2f} mm2 -> pared 3.1-3.8 mm, capa 0.90-1.02 mm (A/(w h) = "
          f"{2.5 * 1000 / 60 * 0.5027 / 6.667 / (3.1 * 1.02):.2f}-{2.5 * 1000 / 60 * 0.5027 / 6.667 / (3.8 * 0.90):.2f})")
    print()
    print("  RESOLUCION (lo que pone cada limite)")
    filas = [
        ("gota r=0.46 (campanazo) en placa", 0.92, "1.2-1.4", "0.25-0.5", 0.13 * 0.25, 0.30 * 0.5),
        ("gota r=0.46 en pared, arco continuo", 0.92, "2.5-4 (charco)", "0.5-1.0", 0.13 * 0.5, 0.30 * 1.0),
        ("cortocircuito / charco 40-60 A", 0.92, "3-4.5", "0.8-1.2", 0.13 * 0.8, 0.30 * 1.2),
        ("globular CC 60 A r=1.63", 3.26, ">= 4-5", "1.5-2.0", 0.13 * 1.5, 0.30 * 2.0),
    ]
    print(f"  {'modo':38s} {'gota mm':>7} {'pared min mm':>14} {'capa mm':>9} {'ondulacion por lado um':>24}")
    for nm, dg, wm, hc, a, b_ in filas:
        print(f"  {nm:38s} {dg:7.2f} {wm:>14s} {hc:>9s} {a * 1e3:10.0f} - {b_ * 1e3:4.0f}")
    print(f"  cuantizacion de volumen: 1 gota chica = {V_GOTA:.3f} mm3 = {V_GOTA / (1.2 * 0.5):.2f} mm de pared de 1.2x0.5; 1 gota globular = {V_GLOB:.1f} mm3")
    print("  altura por el voltaje del arco (10 V/mm de ian, ruido 0.3 V): +-30 um por lectura; tamano de gota con oido: +-1.5 um (canon)")
    print("  apuntar la gota (canon, apuntar2): 80-90 um a 0.5 mm, sin arc blow modelado")


# ==========================================================================================================
# I. TASAS Y TIEMPOS
# ==========================================================================================================
def P_permitida(T_obj, R_parte, A_rad, Gbot, h=10.0):
    """potencia media que la pieza+placa tira con la cima a T_obj (placa a Tp = T_obj - P R_parte)."""
    lo, hi = T0, T_obj
    for _ in range(80):
        Tp = 0.5 * (lo + hi)
        P = perdidas(Tp, A_rad, h=h, Gbot=Gbot)
        if Tp + P * R_parte > T_obj:
            hi = Tp
        else:
            lo = Tp
    return perdidas(lo, A_rad, h=h, Gbot=Gbot), lo


def seccion_I(paredes):
    hr("I. TASA DE DEPOSITO Y TIEMPOS DE CONSTRUCCION")
    print("  tasa con el arco prendido (fichas, eficiencia 0.80):")
    for o in puntos_operacion():
        print(f"    {o['I']:3.0f} A: {o['Qm']:5.2f} mm3/s = {o['Qm'] * 3.6:5.1f} cm3/h = {o['Qm'] * 7.85e-3 * 3.6:.3f} kg/h"
              f"  (J = {o['J']:.0f} J/mm3 a la pieza)")
    print()
    print("  modelo concentrado por rebanadas: a la altura z la cima tolera P(z) con R(z) = z/(k A), k = 35; placa 100x50x3; eps 0.7;")
    print("  los costados de la pieza irradian a la temperatura de la placa (pesimista para paredes; ver G para la pared real)")
    piezas = [
        ("cubo 20 mm macizo", 8000.0, 0.020, 4e-4, 0.002),
        ("engrane m1.5 z16 cara 6 (barreno 6)", math.pi / 4 * (24 ** 2 - 6 ** 2) * 6, 0.006, math.pi / 4 * (24 ** 2 - 6 ** 2) * 1e-6,
         math.pi * 24 * 6 * 1e-6 + math.pi / 4 * 24 ** 2 * 1e-6),
        ("pared 50x50x1.2 (concentrado)", 50 * 50 * 1.2, 0.050, 50 * 1.2e-6, 2 * 50 * 50 * 1e-6),
        ("pared 50x50x3.5 (concentrado)", 50 * 50 * 3.5, 0.050, 50 * 3.5e-6, 2 * 50 * 50 * 1e-6),
    ]
    A_placa = 0.1 * 0.05 + 2 * (0.1 + 0.05) * 0.003
    m_placa = 0.1 * 0.05 * 0.003 * RHO
    montajes = [("loseta", 10.0 * 0.005, 10.0), ("disipador", 3000.0 * 0.005, 10.0), ("disipador+aire", 3000.0 * 0.005, 80.0)]
    print(f"  {'pieza':38s} {'V mm3':>7} {'g':>5} {'montaje':>15} {'T_obj':>5} {'P_perm W':>8} {'ciclo':>6} {'t 40 A min':>10} {'t 60 A min':>10}")
    NS = 50
    for nm, V, H, Asec, Alat in piezas:
        for mn, Gbot, hcv in montajes:
            for T_obj in (250.0, 400.0):
                ts = []
                Pfin = None
                for o in (puntos_operacion()[0], puntos_operacion()[2]):
                    t = 0.0
                    for i in range(NS):
                        z = (i + 0.5) / NS * H
                        P, Tp = P_permitida(T_obj, z / (35.0 * Asec), A_placa + Alat * (i + 0.5) / NS, Gbot, h=hcv)
                        dV = V / NS
                        t += max(dV / o["Qm"], dV * o["J"] / P)
                        if i == NS - 1:
                            Pfin = P
                    ts.append(t)
                print(f"  {nm:38s} {V:7.0f} {V * 7.85e-3:5.1f} {mn:>15s} {T_obj:5.0f} {Pfin:8.0f} {min(1, Pfin / puntos_operacion()[0]['q']) * 100:5.0f}%"
                      f" {ts[0] / 60:10.1f} {ts[1] / 60:10.1f}")
    print("  (P_perm y ciclo: los de la ultima rebanada, la pieza ya completa)")
    print()
    print("  pared 50x50 por diferencias finitas (seccion G):")
    for r in paredes:
        print(f"    {r['nombre']}: {len(r['reg']) * r['cfg']['h']:.1f} mm en {r['t_total'] / 60:6.1f} min, promedio {r['vol'] / r['t_total']:.2f} mm3/s")


# ==========================================================================================================
# J. LA ESCORIA
# ==========================================================================================================
def seccion_J(paredes):
    hr("J. LA ESCORIA (E71T-GS autoprotegido: el fundente ES la proteccion)")
    print("  fundente ~20.75 % del alambre (patente US11648630, FCAW-S): fluoruros 9.5-10 % + oxidos 4.5 % + Al 2.0 % + Mg 1.8 % del alambre")
    print("  metal que no llega al deposito: 18-25 % (Lincoln: 1.22 kg alambre/kg metal; 75-81 %); de eso, humo ~1-2 % y chisporroteo ~2-4 %")
    print(f"  {'escoria % alambre':>18} {'rho escoria':>11} | {'V_esc/V_metal':>13} | {'por gota mm3':>12} {'pelicula en gota um':>19} | {'por capa h=0.5 um':>17} {'h=1.0 um':>9}")
    for fs in (0.10, 0.14, 0.17):
        for rs in (3.0, 3.6, 4.2):
            r = fs / EF_C * 7.85 / rs
            Vs = r * V_GOTA
            film = Vs / (4 * math.pi * 0.46 ** 2) * 1000
            print(f"  {fs * 100:18.0f} {rs:11.1f} | {r:13.2f} | {Vs:12.3f} {film:19.0f} | {r * 0.5 * 1000:17.0f} {r * 1000:9.0f}")
    rC = 0.14 / EF_C * 7.85 / 3.6
    print(f"  central: V_escoria = {rC:.2f} x V_metal  -> {rC * 0.5 * 1000:.0f} um de costra por capa de 0.5 mm; {rC * 1000:.0f} um por capa de 1 mm")
    print()
    print("  FLOTACION: velocidad de Stokes v = 2 (rho_m - rho_e) g r^2 / (9 mu), mu = 6e-3 Pa s, drho = 4000 kg/m3")
    vida = [("gota sola en vuelo/aterrizaje (solidifica)", 1.4e-3), ("punto de gota en placa", 0.07),
            ("charco continuo 40 A en pared (FD mediano)", None)]
    Lc = None
    for r in paredes:
        if r["nombre"].startswith("C2"):
            Lc = float(np.median([x[5] for x in r["reg"]])) / (r["v"] * 1e3)
    print(f"  {'radio de la particula':>22} {'v mm/s':>8} | " + " | ".join(f"{nm[:24]:>24}" for nm, _ in vida))
    for rp in (5e-6, 20e-6, 50e-6, 100e-6):
        vs = 2 * 4000 * 9.81 * rp ** 2 / (9 * 6e-3)
        cells = []
        for nm, tv in vida:
            tv = tv if tv is not None else (Lc if Lc else 2.0)
            cells.append(f"{vs * tv * 1e6:21.0f} um")
        print(f"  {rp * 1e6:19.0f} um {vs * 1e3:8.2f} | " + " | ".join(cells))
    if Lc:
        print(f"  (vida del charco continuo = largo mediano / v = {Lc:.1f} s)")
    print("  Marangoni en charcos de arco: 0.1-0.5 m/s -> en 1-10 ms arrastra la escoria 0.1-5 mm hacia la superficie libre:")
    print("  la escoria SIEMPRE termina en la cara libre... y en impresion cada cara libre se vuelve la interfaz de la siguiente capa.")
    print()
    print("  capas entre cepillados si la escoria flota y se acumula arriba (N = refusion / (2 x costra por capa)):")
    for r in paredes:
        ref = float(np.median([x[7] for x in r["reg"][1:]] or [0]))
        h = r["cfg"]["h"]
        if ref > 0:
            N = ref / (2 * rC * h)
            print(f"    {r['nombre']}: refusion mediana {ref:.2f} mm, costra {rC * h * 1000:.0f} um/capa -> N = {N:.1f}")
        else:
            print(f"    {r['nombre']}: refusion mediana {ref:.2f} mm -> NO refunde: cada capa queda sobre su costra")
    print()
    print("  cepillo rotativo en la cabeza: una pasada de 50 mm a 25 mm/s = 2 s; la espera termica por capa (seccion G) es mayor:")
    for r in paredes:
        es = [x[4] for x in r["reg"][:-1]]
        if es and r["cfg"].get("espera_fija") is None:
            print(f"    {r['nombre']}: espera mediana {float(np.median(es)):5.0f} s, ultimas 10 capas {float(np.median(es[-10:])):5.0f} s vs cepillo 2 s"
                  f" -> el cepillo {'cabe en la espera' if float(np.median(es)) >= 2 else 'AGREGA tiempo en las capas bajas'}")


# ==========================================================================================================
# K. ESFUERZOS RESIDUALES Y DEFORMACION
# ==========================================================================================================
def seccion_K():
    hr("K. ESFUERZOS Y DEFORMACION (fuerza de tendon F_T = 0.2 Q_neto, F en kN con Q en J/mm; tope sigma_y * A)")
    E = 200e3
    b, t = 50.0, 3.0
    Ib = b * t ** 3 / 12
    for o in puntos_operacion():
        for v in (2.8, 16.0):
            Q = o["q"] / v
            F = 0.2 * Q * 1e3                        # N
            F = min(F, 235.0 * b * t)
            kap = F * (t / 2) / (E * Ib)             # 1/mm
            dl = kap * 100 ** 2 / 8
            print(f"  {o['I']:3.0f} A, v {v:4.1f} mm/s: Q = {Q:6.1f} J/mm -> F_T = {F / 1e3:5.1f} kN; placa 50x3 libre: curvatura {kap * 1e3:.2f} 1/m,"
                  f" flecha en 100 mm = {dl:.2f} mm (una pasada)")
    print("  tope fisico de la placa: sigma_y 235 MPa x 150 mm2 = 35 kN; esfuerzo longitudinal residual en la pared ~ sigma_y del deposito (~450 MPa)")


# ==========================================================================================================
# L. COMPARACION
# ==========================================================================================================
def seccion_L():
    hr(f"L. COMPARACION (numeros de las fuentes; J = {ETA:.2f} P / Qm para todos)")
    cmtQ = 2.5 * 1000 / 60 * 0.5027
    rows = [
        ("CMT ER70S-6 0.8, 85Ar/15CO2, 50 A 9.2 V (Prado-Cerqueira 2018)", cmtQ, 50 * 9.2, "3.1-3.8", "0.9-1.0", "6.7"),
        ("MOST v2 (Pearce) ER70S-6 0.030, C25, wfs 25 mm/s, 7 mm/s, >=60 s/capa", 25 * math.pi / 4 * 0.762 ** 2, None, "~1 (slicer)", "2 (slicer)", "7"),
        ("u-WAAM (Oliveira 2022) alambre 0.25 mm, 16 A, ~35 W", 90 * math.pi / 4 * 0.25 ** 2, 35.0, "?", "?", "7-10"),
        ("CMT industrial (Tabernero 2018): hasta 5 kg/h inox; WAAM tipico 1-4 kg/h", 5.0 / 3.6 / 7.85e-3, None, "-", "-", "-"),
        ("ESTE: E71T-GS 0.030 sin gas 40 A (fichas)", puntos_operacion()[0]["Qm"], puntos_operacion()[0]["P"], "1.2 (gota) / 3.5", "0.25-1.0", "2.8-32"),
        ("ESTE: E71T-GS 0.030 sin gas 60 A (fichas)", puntos_operacion()[2]["Qm"], puntos_operacion()[2]["P"], "4", "1.0", "3.6"),
    ]
    print(f"  {'proceso':74s} {'Qm mm3/s':>8} {'kg/h':>6} {'J J/mm3':>8} {'pared mm':>16} {'capa mm':>9} {'v mm/s':>7}")
    for nm, Q, P, w, hh, v in rows:
        J = f"{ETA * P / Q:8.1f}" if P else f"{'-':>8}"
        print(f"  {nm:74s} {Q:8.2f} {Q * 7.85e-3 * 3.6:6.2f} {J} {w:>16s} {hh:>9s} {v:>7s}")
    print("  (CMT con su propia eta = 0.52: 35.9 J/mm a 6.67 mm/s = 239 W -> 11.4 J/mm3; u-WAAM: 35 W / 4.4 mm3/s = 8 J/mm3 < entalpia: el 35 W no es toda la potencia)")


# ==========================================================================================================
def main():
    t0 = time.time()
    print("08 · LIMITES TERMICOS Y DE PRECISION · E71T-GS 0.030\" sin gas a 40-60 A · La Forja 2026-11-05")
    print(f"numpy {np.__version__}")
    seccion_A()
    seccion_B()
    seccion_C()
    seccion_D()
    seccion_E()
    seccion_F()
    hr("G. PARED 50x50 POR DIFERENCIAS FINITAS (2D x-z, espesor fuera del plano; placa 100x50x3 abajo; k(T), c(T) con latente,"
       f" liquido k x{K_MARANGONI:.0f} (Marangoni), radiacion eps 0.7; capa nueva nace a {T_ACT:.0f} C; tope {T_CAP:.0f} C;"
       " espera = hasta que la cara de arriba baje de T_obj; la geometria NO se escurre: charcos largos = pared que en la realidad se cae)")
    nproc = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    with Pool(nproc) as pool:
        paredes = pool.map(simular_pared, CASOS_PARED)
    for r in paredes:
        imprimir_pared(r)
    seccion_H()
    seccion_I(paredes)
    seccion_J(paredes)
    seccion_K()
    seccion_L()
    print()
    print(f"[fin en {time.time() - t0:.0f} s]")


if __name__ == "__main__":
    main()
