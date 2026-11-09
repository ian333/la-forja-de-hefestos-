#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
06 · CONTROL ABSOLUTO desde el Operador Ian: el proceso completo como canales, con teoria de control.
La Forja, investigacion del arco, 2026-11-05. Corre en la laptop (numpy + scipy), ~1-2 min.

MODELO (SI). Estado x (14):
   0 ls   alambre solido fuera de la punta de contacto (stickout) [m]
   1 Vd   volumen de la gota = canal l=0 [m^3]
   2 h    entalpia de la punta del alambre que llega a la gota = "temperatura del alambre libre" [J/m^3]
   3 q2   4 p2    modo l=2 (soltar). q normalizada como el canon: se suelta en q >= 1
   5 q3   6 p3    modo l=3
   7 x1   8 px1   9 y1  10 py1   modo l=1 (mecerse de lado) en x y en y [m, desplazamiento del centro]
  11 z   12 pz    modo (0,1) del charco: hundimiento del centro bajo el arco [m]
  13 H   distancia punta de contacto -> superficie del charco (perturbacion constante) [m]
Entradas u (4): 0 I [A] (la corriente: EL cable), 1 vf [m/s] motor del alimentador, 2 Bx, 3 By [T] campo transversal.
Salida: V(t) (I(t) se mide y es conocida).

Ecuaciones (fisica estandar; [S] = SUPUESTO sin medir):
  fusion (balance de energia en la punta, da Lesnewich en estado estacionario):
      vm = Veq*I / (Aw*(Hv - h))                        Veq calibrado al canon (3 m/min a 40 A + 30 A)
      dls/dt = vf - vm ;   dVd/dt = Aw*vm
      dh/dt  = rho_e(h)*I^2/(Ac*Aw) - h*vf/ls           (Joule en la vaina; lavado por transito; CSTR)
      rho_e(h) = rho20 + kap*h/2                         (resistividad media del stickout, perfil lineal)
  gota (canon): q2'' + (w2/Q)q2' + w2^2(1 - beta*s)q2 = w2^2 (s + gG) ,  s = (I/Icrit)^2 ,  gG = rho g Vd / (2 pi rw sigma)
                q3'' + (w3/Q)q3' + w3^2(1 - beta*s)q3 = w3^2 g3 s        g3 = proyeccion del pellizco sobre l=3 [S]
                x1'' + (w1/Q1)x1' + w1^2 x1 = 2a I By / m_d ;  y1 igual con -Bx      (canon: w1 = 0.5 w2 [S])
  charco:       z'' + (wp/Qp) z' + wp^2 z = ka I^2 / mp        (fuerza del arco Maecker [S], Qp [S])
  arco:         La = H - ls - a(2 + q2 + q3) + (x1^2 + y1^2)/(2a) + z   (la gota, esfera colgada del cuello a distancia a, sube al mecerse)
                V  = 14 + 10 V/mm * La + (rc + rL*La + ls*rho_e/Ac) * I
"""
import math
import numpy as np
from numpy.linalg import eig, svd, solve, pinv, inv

np.set_printoptions(linewidth=160, precision=4, suppress=False)
rng = np.random.default_rng(6)

# =====================================================================================================
# A. PARAMETROS (canon + acero)
# =====================================================================================================
SIG, RHO, MU = 1.5, 7000.0, 6e-3
IC = 194.0
RW = 0.4e-3
AW = math.pi * RW ** 2
AC = 0.75 * AW                    # [S] vaina del alambre tubular E71T-GS: 75 % de la seccion conduce
RHO_S = 7850.0
GRAV = 9.81
FT = 2 * math.pi * RW * SIG        # 3.77 mN
EA, V0 = 1.0e4, 14.0               # V/m (10 V/mm, ian) y V a largo 0
RC, RL = 0.020, 0.0                # resistencia incremental del arco (canon spice) y su dependencia del largo [S]
RHO20, DRHO = 0.142e-6, 1.035e-9   # acero: 0.142 uOhm m a 20 C, pendiente hasta ~700 C
CVOL = RHO_S * 600.0               # J/(m^3 K)
KAP = DRHO / CVOL
HV = RHO_S * (1.2e6 + 800 * 500)   # J/m^3: fundir + sobrecalentar la gota ~500 K
Q2 = Q3 = Q4 = Q1 = 30.0           # canon (SIN medir)
BETA = 1.0                         # hallazgo del canon: la corriente afloja la gota
G3, G4 = 0.3, 0.2                  # [S] proyeccion del pellizco sobre l=3, l=4
F1R = 0.5                          # [S] canon: f1 = 0.5 f2
RP, DP, QP = 2.0e-3, 0.6e-3, 5.0   # [S] charco: radio, profundidad, Q
KP = 3.8317 / RP                   # primer cero de J0'
WP = math.sqrt(SIG / RHO * KP ** 3 * math.tanh(KP * DP))
MP = RHO * math.pi * RP ** 2 * DP / 3
KA = 1e-7 * (0.5 + math.log(3.0))  # N/A^2: fuerza del arco mu0 I^2/4pi (1/2 + ln Ra/Rc), Ra/Rc = 3 [S]
P_MAX = 1200.0
I_MIN, I_MAX = 10.0, 70.0          # canon: el arco nunca baja de 10 A; pico ~70 A


def rho_e(h):
    return RHO20 + KAP * h / 2


def h_estacionario(m2, ls, vf):
    c = m2 * ls / (AC * AW * vf)
    return RHO20 * c / (1 - KAP * c / 2)


# calibrar Veq al canon: <I> = 40, <I^2> = 40^2 + 30^2/2 = 2050, ls = 10 mm, vf = 3 m/min
_hc = h_estacionario(2050.0, 0.010, 0.050)
VEQ = 0.050 * AW * (HV - _hc) / 40.0
ALPHA = VEQ / (AW * HV)

N, NU_ = 14, 4
NOMBRES = ["ls", "Vd", "h", "q2", "p2", "q3", "p3", "x1", "px1", "y1", "py1", "z", "pz", "H"]
GRUPOS = {"alambre ls": [0], "l=0 volumen": [1], "T alambre h": [2], "l=2": [3, 4], "l=3": [5, 6],
          "l=1": [7, 8, 9, 10], "charco": [11, 12], "altura H": [13]}


def radio(Vd):
    return (3 * Vd / (4 * math.pi)) ** (1 / 3)


def F(x, u):
    """campo vectorial; x (...,14), u (...,4); acepta complejos (paso complejo) y lotes."""
    ls, Vd, h, q2, p2, q3, p3, x1, px1, y1, py1, z, pz, H = [x[..., k] for k in range(N)]
    I, vf, Bx, By = [u[..., k] for k in range(NU_)]
    a = (3 * Vd / (4 * math.pi)) ** (1 / 3)
    s = (I / IC) ** 2
    vm = VEQ * I / (AW * (HV - h))
    w2sq = 8 * SIG / (RHO * a ** 3)
    w3sq = 30 * SIG / (RHO * a ** 3)
    w1sq = F1R ** 2 * w2sq
    gG = RHO * GRAV * Vd / FT
    md = RHO * Vd
    d = [vf - vm,
         AW * vm,
         rho_e(h) * I ** 2 / (AC * AW) - h * vf / ls,
         p2,
         -np.sqrt(w2sq) / Q2 * p2 - w2sq * (1 - BETA * s) * q2 + w2sq * (s + gG),
         p3,
         -np.sqrt(w3sq) / Q3 * p3 - w3sq * (1 - BETA * s) * q3 + w3sq * G3 * s,
         px1,
         -np.sqrt(w1sq) / Q1 * px1 - w1sq * x1 + 2 * a * I * By / md,
         py1,
         -np.sqrt(w1sq) / Q1 * py1 - w1sq * y1 - 2 * a * I * Bx / md,
         pz,
         -WP / QP * pz - WP ** 2 * z + KA * I ** 2 / MP,
         0 * H]
    return np.stack(d, axis=-1)


def largo(x):
    ls, Vd, q2, q3, x1, y1, z, H = (x[..., 0], x[..., 1], x[..., 3], x[..., 5], x[..., 7], x[..., 9], x[..., 11], x[..., 13])
    a = (3 * Vd / (4 * math.pi)) ** (1 / 3)
    return H - ls - a * (2 + q2 + q3) + (x1 ** 2 + y1 ** 2) / (2 * a) + z


def Rinc(x):
    """resistencia incremental dV/dI (lo que ve una sonda de corriente)."""
    return RC + RL * largo(x) + x[..., 0] * rho_e(x[..., 2]) / AC


def Vout(x, u):
    return V0 + EA * largo(x) + Rinc(x) * u[..., 0]


def punto(I0, a0=0.40e-3, ls0=0.010, La0=1.0e-3, By0=0.0, m2=None):
    """punto de operacion congelado (la gota crece: es un punto de una trayectoria, no un equilibrio)."""
    m2 = I0 ** 2 if m2 is None else m2
    vf = 0.05
    for _ in range(300):
        h = h_estacionario(m2, ls0, vf)
        vf = VEQ * I0 / (AW * (HV - h))
    Vd = 4 / 3 * math.pi * a0 ** 3
    s0 = (I0 / IC) ** 2
    gG = RHO * GRAV * Vd / FT
    q2 = (s0 + gG) / (1 - BETA * s0)
    q3 = G3 * s0 / (1 - BETA * s0)
    z = KA * I0 ** 2 / (MP * WP ** 2)
    w1sq = F1R ** 2 * 8 * SIG / (RHO * a0 ** 3)
    x1 = 2 * a0 * I0 * By0 / (RHO * Vd * w1sq)
    H = La0 + ls0 + a0 * (2 + q2 + q3) - x1 ** 2 / (2 * a0) - z
    x = np.array([ls0, Vd, h, q2, 0, q3, 0, x1, 0, 0, 0, z, 0, H], float)
    u = np.array([I0, vf, 0.0, By0], float)
    return x, u


def jac(fun, x, u, wrt):
    """Jacobiano por paso complejo (exacto a precision de maquina)."""
    base = x if wrt == "x" else u
    out0 = np.atleast_1d(fun(x, u))
    J = np.zeros((out0.size, base.size))
    for j in range(base.size):
        hj = 1e-30 * max(abs(base[j]), 1e-12)
        xc, uc = x.astype(complex), u.astype(complex)
        if wrt == "x":
            xc[j] += 1j * hj
        else:
            uc[j] += 1j * hj
        J[:, j] = np.atleast_1d(fun(xc, uc)).imag / hj
    return J


def escalas(x, u):
    a = radio(x[1])
    w2 = math.sqrt(8 * SIG / (RHO * a ** 3)); w3 = math.sqrt(30 * SIG / (RHO * a ** 3)); w1 = F1R * w2
    S = np.array([1e-4, 0.01 * x[1], 5 * CVOL, 0.01, 0.01 * w2, 0.01, 0.01 * w3, 1e-5, 1e-5 * w1, 1e-5, 1e-5 * w1,
                  1e-6, 1e-6 * WP, 1e-4])
    Tu = np.array([1.0, 1e-3, 1e-4, 1e-4])   # 1 A, 1 mm/s, 0.1 mT, 0.1 mT
    return S, Tu


SIG_R_EQ = 0.01 * math.sqrt(2 / 100) / 3.0 * math.sqrt(100)   # 10 mV, sonda 3 A, 100 muestras/periodo -> 4.7 mOhm por muestra


def linealizar(x, u, sensores=("V",), Xref=50e-6):
    A = jac(F, x, u, "x"); B = jac(F, x, u, "u")
    Cs, Ds, Ty = [], [], []
    a = radio(x[1])
    for s in sensores:
        if s == "V":
            Cs.append(jac(Vout, x, u, "x")[0]); Ds.append(jac(Vout, x, u, "u")[0]); Ty.append(0.01)      # 10 mV
        elif s == "R":
            Cs.append(jac(lambda xx, uu: Rinc(xx), x, u, "x")[0]); Ds.append(np.zeros(NU_)); Ty.append(SIG_R_EQ)  # R por muestra equivalente
        elif s == "homx":   # V demodulada en 2f1 contra una referencia lateral conocida en x (homodino): EA Xref x1 / (2a)
            c = np.zeros(N); c[7] = EA * Xref / (2 * a); Cs.append(c); Ds.append(np.zeros(NU_)); Ty.append(0.01)
        elif s == "homy":
            c = np.zeros(N); c[9] = EA * Xref / (2 * a); Cs.append(c); Ds.append(np.zeros(NU_)); Ty.append(0.01)
    return A, B, np.array(Cs), np.array(Ds), np.array(Ty)


def escalar(A, B, C, D, S, Tu, Ty):
    Si = 1 / S
    return (Si[:, None] * A * S[None, :], Si[:, None] * B * Tu[None, :], (1 / Ty)[:, None] * C * S[None, :],
            (1 / Ty)[:, None] * D * Tu[None, :])




def nombre_canal(L0, v):
    """etiqueta fisica de un valor propio por su vector (escalado)."""
    if abs(L0) < 1e-6:
        return "l=0 vol + H"
    if abs(L0.imag) < 1e-9:
        w = np.abs(v) ** 2
        if w.ndim > 1:
            w = w.sum(axis=1)
        return "alambre ls,h" + (" (ls)" if w[0] > w[2] else " (h)")
    w = np.abs(v) ** 2
    if w.ndim > 1:
        w = w.sum(axis=1)
    pes = {g: w[idx].sum() for g, idx in GRUPOS.items() if g not in ("l=0 volumen", "altura H", "alambre ls", "T alambre h")}
    return max(pes, key=pes.get)


def racimos(lam, tol=1e-6):
    used = np.zeros(len(lam), bool); out = []
    for i in range(len(lam)):
        if used[i]:
            continue
        idx = [j for j in range(len(lam)) if not used[j] and abs(lam[j] - lam[i]) <= tol * max(1, abs(lam[i]))]
        for j in idx:
            used[j] = True
        out.append(idx)
    return out


def pbh(As, Bs, Cs, cols_u, filas_y):
    """por cada valor propio (racimo): defecto de controlabilidad / observabilidad y los dos sigma mas chicos.
       En lambda = 0 se descuenta H (estado-perturbacion: nunca se controla)."""
    lam, V = eig(As)
    res = []
    for idx in racimos(lam):
        L0 = lam[idx[0]]
        if L0.imag < -1e-9:
            continue
        g = nombre_canal(L0, V[:, idx])
        M1 = np.hstack([As - L0 * np.eye(N), Bs[:, cols_u]])
        M2 = np.vstack([As - L0 * np.eye(N), Cs[filas_y, :]])
        s1 = svd(M1, compute_uv=False); s2 = svd(M2, compute_uv=False)
        nc = int(np.sum(s1 < 1e-9 * s1[0])); no = int(np.sum(s2 < 1e-9 * s2[0]))
        if g == "l=0 vol + H":
            nc -= 1   # H
        vivos_c = s1[s1 >= 1e-9 * s1[0]]; vivos_o = s2[s2 >= 1e-9 * s2[0]]
        res.append(dict(lam=L0, mult=len(idx), grupo=g, nc=nc, no=no, mc=vivos_c[-1], mo=vivos_o[-1],
                        dup=2 if abs(L0.imag) > 1e-9 else 1))
    res.sort(key=lambda r: abs(r["lam"].imag) + 1e-3 * abs(r["lam"].real))
    return res


def gramiano(As, Bs, T):
    """W(T) = int_0^T e^{At} B B^T e^{A^T t} dt, por eigen-descomposicion (estable con modos rapidos)."""
    lam, V = eig(As)
    Vi = inv(V)
    G = Vi @ Bs
    GG = G @ G.conj().T
    S_ = lam[:, None] + lam.conj()[None, :]
    with np.errstate(divide="ignore", invalid="ignore"):
        Mx = np.where(np.abs(S_) < 1e-12, T, (np.exp(S_ * T) - 1) / S_)
    W = V @ (GG * Mx) @ V.conj().T
    return np.real((W + W.conj().T) / 2)


def etiqueta_vec(v, idx=None):
    w = v ** 2
    pesos = {g: w[ix].sum() for g, ix in GRUPOS.items()}
    top = sorted(pesos.items(), key=lambda kv: -kv[1])[:2]
    return " + ".join(f"{g} {p / w.sum() * 100:.0f}%" for g, p in top)


def Z_de_f(A, B, C, D, f, col=0, fila=0):
    out = []
    for fi in np.atleast_1d(f):
        s_ = 2j * math.pi * fi
        out.append(C[fila] @ solve(s_ * np.eye(N) - A, B[:, col]) + D[fila, col])
    return np.array(out)


def rk4(x, ufun, t0, dt, nsteps, rec=None):
    t = t0
    for k in range(nsteps):
        u1 = ufun(t); u2 = ufun(t + dt / 2); u4 = ufun(t + dt)
        k1 = F(x, u1); k2 = F(x + dt / 2 * k1, u2); k3 = F(x + dt / 2 * k2, u2); k4 = F(x + dt * k3, u4)
        x = x + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        t += dt
        if rec is not None:
            rec(k, t, x, u4)
    return x


def f2_de(a, I=0.0):
    return math.sqrt(8 * SIG / (RHO * a ** 3) * (1 - BETA * (I / IC) ** 2)) / (2 * math.pi)


L = "=" * 112
print(L)
print("06 · CONTROL ABSOLUTO: el proceso completo como canales (Operador Ian + teoria de control)")
print(L)
print(f"  calibracion: Veq = {VEQ:.2f} V (calor del arco que entra al alambre por amper), alfa = {ALPHA*1e3:.3f} mm/(A s); "
      f"Hv = {HV/1e9:.2f} J/mm^3")
print(f"  charco R = {RP*1e3:.1f} mm, prof {DP*1e3:.1f} mm: f_p = {WP/2/math.pi:.0f} Hz (modo (0,1), capilar), "
      f"masa modal {MP*1e6:.1f} mg, Qp = {QP:.0f} [S]; fuerza del arco {KA*1e7:.2f}e-7 N/A^2 [S]")

# =====================================================================================================
# B. PUNTOS DE OPERACION Y PRESUPUESTO (la fuente de 1200 W manda)
# =====================================================================================================
print()
print(L)
print("B. PUNTOS DE OPERACION 40-60 A: potencia, largo de arco permitido, alimentacion, temperatura del alambre")
print(L)
print(f"  {'I0 A':>5} {'vf mm/s':>8} {'vf m/min':>8} {'T punta C':>9} {'R_st mOhm':>9} {'V@La=1mm':>9} {'P W':>6} "
      f"{'La max mm @1200W':>17} {'f2(0.40) Hz':>11} {'s0':>6}")
OPS = {}
for I0 in (40.0, 50.0, 60.0):
    x0, u0 = punto(I0)
    OPS[I0] = (x0, u0)
    V = float(Vout(x0, u0)); P = V * I0
    R = float(Rinc(x0))
    Lmax = (P_MAX / I0 - V0 - R * I0) / EA * 1e3
    OPS[I0] = (x0, u0, Lmax)
    print(f"  {I0:5.0f} {u0[1]*1e3:8.1f} {u0[1]*60:8.2f} {20+x0[2]/CVOL:9.0f} {(R-RC)*1e3:9.1f} {V:9.2f} {P:6.0f} "
          f"{Lmax:17.2f} {f2_de(0.40e-3, I0):11.0f} {(I0/IC)**2:6.3f}")
print(f"  gota libre de 0.46 mm al soltarse (q=1, estirada x1.5) ocupa 2a*1.5 = 1.38 mm bajo la punta del alambre:")
print(f"  -> con 10 V/mm y 1200 W el arco medio puede ser {OPS[40.0][2]:.2f} mm a 40 A, {OPS[50.0][2]:.2f} mm a 50 A, "
      f"{OPS[60.0][2]:.2f} mm a 60 A. A 60 A no cabe la gota libre (corto); la ventana real es 40-45 A.")
for ls in (0.005, 0.010, 0.020, 0.030):
    x0, u0 = punto(40.0, ls0=ls)
    print(f"  stickout {ls*1e3:4.0f} mm a 40 A: T de la punta del alambre {20+x0[2]/CVOL:5.0f} C  "
          f"(Joule {rho_e(x0[2])*1600/AC*ls:5.1f} W, R_st {ls*rho_e(x0[2])/AC*1e3:5.1f} mOhm, vf {u0[1]*1e3:5.1f} mm/s)")

# =====================================================================================================
# C. LINEALIZACION: los canales (valores propios) a 40 A
# =====================================================================================================
print()
print(L)
print("C. LOS CANALES = VALORES PROPIOS del modelo linealizado (40 A, gota a = 0.40 mm, stickout 10 mm, arco 1.0 mm)")
print(L)
x0, u0, _ = OPS[40.0]
A, B, C, D, Ty = linealizar(x0, u0, ("V", "R"))
S, Tu = escalas(x0, u0)
As, Bs, Cs, Ds = escalar(A, B, C, D, S, Tu, Ty)
lam, Vv = eig(As)
print(f"  {'canal':18s} {'lambda (1/s)':>26s} {'f Hz':>8s} {'Q o tau':>14s}")
for idx in sorted(racimos(lam), key=lambda ix: abs(lam[ix[0]].imag) + 1e-3 * abs(lam[ix[0]].real)):
    L0 = lam[idx[0]]
    if L0.imag < -1e-9:
        continue
    g = nombre_canal(L0, Vv[:, idx])
    f = abs(L0.imag) / 2 / math.pi
    qt = (f"Q = {abs(L0)/(2*abs(L0.real)):.1f}" if f > 0.01 else (f"tau = {1/abs(L0.real):.3f} s" if abs(L0.real) > 1e-6 else "integrador"))
    print(f"  {g:18s} {L0.real:12.3f} {L0.imag:+12.1f}j {f:8.1f} {qt:>14s}   multiplicidad {len(idx)}")
print("  l=1: x e y comparten valor propio (multiplicidad geometrica 2) -> con UN actuador o UN sensor, uno queda fuera (PBH).")
print("  lambda = 0 doble: volumen de la gota y altura H -> con UNA salida una combinacion queda ciega (PBH).")
print("  los dos modos lentos del alambre (ls, h) son la autorregulacion en corriente constante: tau de segundos.")

# =====================================================================================================
# D. CONTROLABILIDAD Y OBSERVABILIDAD (PBH por canal) PARA CADA CONJUNTO
# =====================================================================================================
print()
print(L)
print("D. PBH POR CANAL. NC = modos NO controlables en ese lambda; NO = no observables; margen = sigma vivo mas chico de")
print("   [A-lI, B] o [A-lI; C] en unidades de resolucion (ls 0.1 mm, Vd 1 %, h 5 K, q 0.01, l=1 10 um, charco 1 um, H 0.1 mm;")
print("   I 1 A, vf 1 mm/s, B 0.1 mT; V 10 mV/muestra, R sonda 3 A a 5 kHz). En lambda=0 se descuenta H (perturbacion).")
print(L)
CONJ_U = [("A1 I", [0], 0.0), ("A2 I+vf", [0, 1], 0.0), ("A3 I+vf+By", [0, 1, 3], 0.0),
          ("A4 I+vf+Bx+By", [0, 1, 2, 3], 0.0), ("A5 I+vf, By0=0.8 mT fijo (pinza)", [0, 1], 0.8e-3)]
CONJ_Y = [("S1 V", ["V"]), ("S2 V+R(sonda)", ["V", "R"]), ("S3 V+R+homodino x,y", ["V", "R", "homx", "homy"])]


def tabla_pbh(g3=None):
    global G3
    g3_old = G3
    if g3 is not None:
        G3 = g3
    T_ = {}
    for nomu, cols, By0 in CONJ_U:
        x0, u0 = punto(40.0, By0=By0)
        for nomy, sens in CONJ_Y:
            A, B, C, D, Ty = linealizar(x0, u0, tuple(sens))
            S, Tu = escalas(x0, u0)
            As, Bs, Cs, Ds = escalar(A, B, C, D, S, Tu, Ty)
            T_[(nomu, nomy)] = pbh(As, Bs, Cs, cols, list(range(len(sens))))
    G3 = g3_old
    return T_


TABLA = tabla_pbh()
RANGOS = {}
for nomu, cols, By0 in CONJ_U:
    r = TABLA[(nomu, "S1 V")]
    nctot = sum(e["nc"] * e["dup"] for e in r)
    RANGOS[nomu] = N - 1 - nctot
    print(f"  {nomu}:  rango de Kalman (sin H) = {N-1-nctot} de {N-1}")
    print("     " + " | ".join(f"{e['grupo']} {abs(e['lam'].imag)/2/math.pi:.0f} Hz: "
                              f"{'ok' if e['nc']==0 else 'NC '+str(e['nc'])+('(M)' if e['grupo']=='l=0 vol + H' else '')}"
                              f" m={e['mc']:.3g}" for e in r))
print()
print("  OBSERVABILIDAD (rango de 14, H incluida):")
RANGOS_O = {}
for nomy, sens in CONJ_Y:
    for nomu in ("A2 I+vf", "A5 I+vf, By0=0.8 mT fijo (pinza)"):
        r = TABLA[(nomu, nomy)]
        notot = sum(e["no"] * e["dup"] for e in r)
        RANGOS_O[(nomu, nomy)] = N - notot
        print(f"   {nomy:21s} con {nomu[:2]}: rango obs = {N-notot:2d}/14 | " +
              "  ".join(f"{e['grupo']}:{'ok' if e['no']==0 else 'CIEGO'+str(e['no'])}({e['mo']:.2g})" for e in r))
print("  sensibilidad: si el pellizco NO proyecta sobre l=3 (g3 = 0):")
T0 = tabla_pbh(g3=0.0)
for nomu in ("A1 I", "A4 I+vf+Bx+By"):
    e3 = [e for e in T0[(nomu, "S1 V")] if e["grupo"] == "l=3"][0]
    print(f"     {nomu}: l=3 NC = {e3['nc']}  -> l=3 {'NO se controla con nada de lo que hay' if e3['nc'] else 'controlable'}")

# =====================================================================================================
# E. GRAMIANOS: cuanto cuesta mover / ver cada canal (1 gota = 12 ms, y 1 s)
# =====================================================================================================
print()
print(L)
print("E. GRAMIANOS (escalados). rango = autovalores > 1e-10 max; cond y direccion mas dificil SOBRE LA PARTE VIVA")
print(L)
x0, u0, _ = OPS[40.0]
for T in (0.012, 1.0):
    for nomu, cols, By0 in CONJ_U[:4]:
        A, B, C, D, Ty = linealizar(x0, u0, ("V",))
        S, Tu = escalas(x0, u0)
        As, Bs, Cs, Ds = escalar(A, B, C, D, S, Tu, Ty)
        keep = list(range(N - 1))
        W = gramiano(As[np.ix_(keep, keep)], Bs[keep][:, cols], T)
        ev, evec = np.linalg.eigh(W)
        viv = ev > 1e-10 * ev[-1]
        i0 = int(np.argmax(viv))
        vmin = np.zeros(N); vmin[keep] = evec[:, i0]
        print(f"  ctrl T={T*1e3:5.0f} ms {nomu:15s}: rango {viv.sum():2d}/13  lam_max {ev[-1]:8.3g}  lam_min_vivo {ev[i0]:8.3g}  "
              f"cond {ev[-1]/ev[i0]:8.2g}  mas dificil: {etiqueta_vec(vmin)}")
    for nomy, sens in CONJ_Y:
        A, B, C, D, Ty = linealizar(x0, u0, tuple(sens))
        S, Tu = escalas(x0, u0)
        As, Bs, Cs, Ds = escalar(A, B, C, D, S, Tu, Ty)
        Wo = gramiano(As.T, Cs.T, T)
        ev, evec = np.linalg.eigh(Wo)
        viv = ev > 1e-10 * ev[-1]
        i0 = int(np.argmax(viv))
        print(f"  obs  T={T*1e3:5.0f} ms {nomy:21s}: rango {viv.sum():2d}/14  lam_max {ev[-1]:8.3g}  lam_min_vivo {ev[i0]:8.3g}  "
              f"cond {ev[-1]/ev[i0]:8.2g}  mas ciega viva: {etiqueta_vec(evec[:, i0])}")
print("  (no se da CRB lineal a 1 s: el integrador de la gota sin desprendimiento lo infla; ver K para lo que da V en 4 ms)")

# =====================================================================================================
# F. EL MAPA VISTO POR EL CABLE: Z(f) = dV/dI
# =====================================================================================================
print()
print(L)
print("F. EL MAPA VISTO POR EL CABLE: impedancia incremental Z(f) = dV/dI del proceso completo (40 A)")
print(L)
print("  (1) baja frecuencia, promedio por gota (sin la rampa de crecimiento de cada gota): la corriente quema el alambre")
x0, u0, _ = OPS[40.0]
A, B, C, D, Ty = linealizar(x0, u0, ("V",))
Cprom = C.copy(); Cprom[0, 1] = 0.0
for f in (0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0):
    z = Z_de_f(A, B, Cprom, D, [f])[0]
    print(f"     f = {f:6.2f} Hz: |Z| = {abs(z):8.3f} V/A  fase {math.degrees(np.angle(z)):6.1f} grados")
print(f"     -> 1 A de mas acorta el stickout {ALPHA*1e3:.2f} mm/s: en CC con avance fijo el largo de arco DERIVA (tau 6.5 s): "
      f"necesita lazo V -> I o V -> vf")
print("  (2) dentro de una gota (lo que oye el oido):")
fs = np.array([100, 150, 200, 300, 400, 500, 600, 700, 800, 1000, 1300, 1600, 2000, 3000])
for a0 in (0.30e-3, 0.40e-3, 0.46e-3):
    x0, u0 = punto(40.0, a0=a0)
    A, B, C, D, Ty = linealizar(x0, u0, ("V",))
    Z = Z_de_f(A, B, C, D, fs)
    lam_ = eig(A)[0]
    fm = sorted(set(round(abs(l.imag) / 2 / math.pi) for l in lam_ if abs(l.imag) > 1))
    print(f"  gota a = {a0*1e3:.2f} mm (modos: " + ", ".join(f"{x}" for x in fm) + " Hz):")
    print("     f Hz :   " + " ".join(f"{v:6.0f}" for v in fs))
    print("   |Z| mV/A: " + " ".join(f"{abs(v)*1e3:6.1f}" for v in Z))
    ff = np.geomspace(60, 6000, 6000)
    Zf = np.abs(Z_de_f(A, B, C, D, ff))
    pk = [i for i in range(1, len(ff) - 1) if Zf[i] > Zf[i - 1] and Zf[i] > Zf[i + 1]]
    out = []
    for i in pk:
        cerca = [x for x in fm if abs(x - ff[i]) / x < 0.05]
        if cerca:
            out.append(f"{ff[i]:.0f} Hz {Zf[i]*1e3:.0f} mV/A")
    print("   picos con modo: " + " | ".join(out) + f"   | piso resistivo D = {D[0,0]*1e3:.1f} mV/A")
x0, u0 = punto(40.0, a0=0.40e-3)
print(f"  pico l=2 analitico |Z2| = EA a Q 2 I0/Icrit^2 = {EA*0.40e-3*30*80/IC**2*1e3:.0f} mV/A (a 0.40 mm, Q 30; Q 10: "
      f"{EA*0.40e-3*10*80/IC**2*1e3:.0f})")
for By0 in (0.0, 0.8e-3, 3e-3):
    x0, u0 = punto(40.0, By0=By0)
    A, B, C, D, Ty = linealizar(x0, u0, ("V",))
    f1 = F1R * f2_de(0.40e-3, 0)
    zz = Z_de_f(A, B, C, D, [f1])[0]
    # parte que viene de l=1: quitar l=1 del modelo de salida
    C2 = C.copy(); C2[0, 7:11] = 0
    z0 = Z_de_f(A, B, C2, D, [f1])[0]
    print(f"  l=1 en V con campo fijo By0 = {By0*1e3:.1f} mT (pinza de tierra / soplo): aporte de l=1 a Z(f1) = "
          f"{abs(zz - z0)*1e6:8.3f} uV/A  (desvio estatico {x0[7]*1e6:.2f} um)")

# =====================================================================================================
# G. NO LINEAL 1: corchetes de Lie e invariantes exactos
# =====================================================================================================
print()
print(L)
print("G. NO LINEAL: corchetes de Lie (F es CUADRATICA en I: F = F0 + I F1 + I^2 F2) e invariantes exactos")
print(L)
x0, u0, _ = OPS[40.0]
S, Tu = escalas(x0, u0)


def FI(x, I):
    u = np.array(u0, dtype=complex if np.iscomplexobj(x) else float); u[0] = I
    return F(x, u)


def g1(x, d=1.0):
    return (FI(x, u0[0] + d) - FI(x, u0[0] - d)) / (2 * d)


def g2(x, d=1.0):
    return (FI(x, u0[0] + d) - 2 * FI(x, u0[0]) + FI(x, u0[0] - d)) / d ** 2


def Jc(fun, x):
    J = np.zeros((N, N))
    for j in range(N):
        hj = 1e-30 * max(abs(x[j]), 1e-12)
        xc = x.astype(complex); xc[j] += 1j * hj
        J[:, j] = fun(xc).imag / hj
    return J


def corchete(fa, fb, x):
    return Jc(fb, x) @ fa(x) - Jc(fa, x) @ fb(x)


Fx = lambda x: FI(x, u0[0])
campos = {"g1 = dF/dI": g1(x0), "g2 = d2F/dI2": g2(x0), "[F,g1]": corchete(Fx, g1, x0),
          "[F,g2]": corchete(Fx, g2, x0), "[g1,g2]": corchete(g1, g2, x0)}
wM = np.zeros(N); wM[0] = AW; wM[1] = 1.0
print(f"  {'campo':14s} {'|campo|':>10s} {'comp. M':>10s} {'comp. l=1':>10s}   dominante (unidades de resolucion)")
for k, v in campos.items():
    vs = v / S
    print(f"  {k:14s} {np.linalg.norm(vs):10.3g} {abs(wM @ v)/(AW*S[0]):10.2g} {np.linalg.norm(vs[7:11]):10.2g}   {etiqueta_vec(vs)}")
v1, v2 = campos["g1 = dF/dI"] / S, campos["g2 = d2F/dI2"] / S
cosang = abs(v1 @ v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
sl_ = [0, 2]
cos_lento = abs(v1[sl_] @ v2[sl_]) / (np.linalg.norm(v1[sl_]) * np.linalg.norm(v2[sl_]))
print(f"  angulo g1 vs g2: {math.degrees(math.acos(min(1,cosang))):.1f} grados en todo el estado (ambos los domina el pellizco "
      f"sobre l=2); {math.degrees(math.acos(min(1,cos_lento))):.1f} grados en el plano lento (ls, h)")
_A, _B, _C, _D, _Ty = linealizar(x0, u0, ("V",))
_As = escalar(_A, _B, _C, _D, S, Tu, _Ty)[0]
Kl = np.column_stack([v1, _As @ v1])
Knl = np.column_stack([campos[k] / S for k in campos])
print(f"  rango a profundidad 1: lineal span(b, Ab) = {np.linalg.matrix_rank(Kl, 1e-9*np.abs(Kl).max())};  "
      f"no lineal span(g1, g2, [F,g1], [F,g2], [g1,g2]) = {np.linalg.matrix_rank(Knl, 1e-9*np.abs(Knl).max())}")
print("  simulacion 10 ms (RK4 2 us) con dos I(t) aleatorias 10-70 A, B = 0, semilla lateral lineal a 30 grados:")
for semilla in (1, 2):
    r2 = np.random.default_rng(semilla)
    knots = r2.uniform(10, 70, 200)
    x = x0.copy(); x[7] = 5e-6 * math.cos(math.radians(30)); x[9] = 5e-6 * math.sin(math.radians(30))
    M0 = AW * x[0] + x[1]
    def ufun(t, knots=knots):
        u = u0.copy(); u[0] = np.interp(t, np.linspace(0, 0.010, 200), knots); return u
    angs = []; amps = []
    def rec(k, t, xx, uu):
        if k % 250 == 0:
            r = math.hypot(xx[7], xx[9])
            if r > 1e-9:
                angs.append(math.degrees(math.atan2(xx[9], xx[7])) % 180)
            amps.append(r)
    xf = rk4(x, ufun, 0.0, 2e-6, 5000, rec)
    M1 = AW * xf[0] + xf[1]
    print(f"    I(t) #{semilla}: (M_final - M_inicial - Aw vf t)/M = {(M1-M0-AW*u0[1]*0.010)/M0:+.1e} | angulo del plano de mecerse "
          f"{min(angs):.6f}..{max(angs):.6f} grados | |r| max {max(amps)*1e6:.2f} um")
x = x0.copy(); x[7] = 5e-6; x[10] = 3e-6 * F1R * 2 * math.pi * f2_de(0.40e-3)
Lz0 = x[7] * x[10] - x[9] * x[8]
for semilla in (3, 4):
    r2 = np.random.default_rng(semilla); knots = r2.uniform(10, 70, 200)
    def ufun(t, knots=knots):
        u = u0.copy(); u[0] = np.interp(t, np.linspace(0, 0.010, 200), knots); return u
    Vs = []
    xf = rk4(x.copy(), ufun, 0.0, 2e-6, 2500)
    Lz1 = xf[7] * xf[10] - xf[9] * xf[8]
    print(f"    giro lateral: L_z(5 ms)/L_z(0) = {Lz1/Lz0:+.4f} con I(t) #{semilla}  (dLz/dt = -(w1/Q1) Lz: el signo nunca cambia)")

# =====================================================================================================
# H. BALANCE ARMONICO: los mandos DC de un cable
# =====================================================================================================
print()
print(L)
print("H. BALANCE ARMONICO: sostener consignas lentas. <I> funde (arco), <I^2> calienta (Joule) y pellizca; vf pone el metal")
print(L)
print(f"  promedio: vf = Veq<I>/(Aw(Hv-h)) ;  h = rho(h)<I^2> ls/(Ac Aw vf).  Factible: <I>^2 <= <I^2> <= (Imin+Imax)<I> - Imin Imax"
      f"  (Imin {I_MIN:.0f}, Imax {I_MAX:.0f} A)")
vf = 0.050
print(f"  vf = {vf*1e3:.0f} mm/s fijo: temperatura de punta SOSTENIBLE a cada stickout")
print(f"  {'ls mm':>6} {'<I> A':>7} {'T solo DC':>9} {'senoide (I1 <= <I>-10)':>24} {'pulso 10/70':>16} {'<I^2> DC..pulso':>18}")
for ls in (0.005, 0.010, 0.015, 0.020, 0.025):
    def resolver(modo):
        h = 0.0
        for _ in range(300):
            m1 = vf * AW * (HV - h) / VEQ
            m2 = {"dc": m1 ** 2, "sen": m1 ** 2 + (m1 - I_MIN) ** 2 / 2, "pul": (I_MIN + I_MAX) * m1 - I_MIN * I_MAX}[modo]
            c = m2 * ls / (AC * AW * vf)
            if KAP * c / 2 >= 0.95:
                return m1, m2, float("nan")
            h = RHO20 * c / (1 - KAP * c / 2)
        return m1, m2, h
    m1d, m2d, hd = resolver("dc"); m1s, m2s, hs = resolver("sen"); m1p, m2p, hp = resolver("pul")
    Tt = lambda hh: 20 + hh / CVOL
    print(f"  {ls*1e3:6.0f} {m1d:7.1f} {Tt(hd):9.0f} {Tt(hd):12.0f} .. {Tt(hs):5.0f} C {Tt(hd):7.0f} .. {Tt(hp):5.0f} C "
          f"{m2d:9.0f}..{m2p:5.0f}")
print("  (sobre ~770 C la resistividad satura (Curie) y el modelo lineal rho(T) sobrestima)")


def estac(m1, m2, vf_):
    h = HV - VEQ * m1 / (AW * vf_)
    ls = h * AC * AW * vf_ / (rho_e(h) * m2)
    return ls, h


m10, m20 = 40.0, 2050.0
vf0 = VEQ * m10 / (AW * (HV - h_estacionario(m20, 0.010, 0.05)))
base = np.array(estac(m10, m20, vf0) + (AW * vf0,))
Gm = np.zeros((3, 3)); dd = [0.5, 20.0, 0.5e-3]
for j in range(3):
    pp = [m10, m20, vf0]; pp[j] += dd[j]
    Gm[:, j] = (np.array(estac(*pp) + (AW * pp[2],)) - base) / dd[j]
Gs = np.diag([1 / 1e-4, 1 / (5 * CVOL), 1 / (0.01 * AW * vf0)]) @ Gm @ np.diag([1.0, 100.0, 1e-3])
sv = svd(Gs, compute_uv=False)
print("  ganancia estacionaria (ls [0.1 mm], T punta [5 K], flujo de metal [1 %]) <- (<I> [1 A], <I^2> [100 A^2], vf [1 mm/s]):")
for i, nm in enumerate(["ls", "T", "flujo"]):
    print(f"     {nm:6s}: " + "  ".join(f"{Gs[i,j]:+9.3g}" for j in range(3)))
print(f"  valores singulares {np.array2string(sv, precision=3)} -> rango 3, cond {sv[0]/sv[-1]:.3g}: (ls, T, flujo) se sostienen a la vez.")
print("  solo DC (<I^2> = <I>^2): 2 mandos para 3 consignas -> rango 2: una queda esclava de las otras.")
print("  verificacion: subsistema lento (ls, h) simulado 40 s con la I(t) real vs la prediccion promedio (vf 50 mm/s):")
for (Ib, I1) in ((40.0, 0.0), (40.0, 30.0)):
    ls, h = 0.010, 4e8
    dt = 2e-5
    ph = 0.0
    for k in range(int(40.0 / dt)):
        I = Ib + I1 * math.cos(ph); ph += 2 * math.pi * 668 * dt
        vm = VEQ * I / (AW * (HV - h))
        ls += (0.050 - vm) * dt
        h += (rho_e(h) * I * I / (AC * AW) - h * 0.050 / ls) * dt
    hp_ = HV - VEQ * Ib / (AW * 0.050); lsp = hp_ * AC * AW * 0.050 / (rho_e(hp_) * (Ib ** 2 + I1 ** 2 / 2))
    print(f"    I = {Ib:.0f} + {I1:.0f} cos(668 Hz): simulado ls {ls*1e3:6.2f} mm, T {20+h/CVOL:5.1f} C | promedio ls {lsp*1e3:6.2f} mm, "
          f"T {20+hp_/CVOL:5.1f} C")
print("  -> misma <I> (misma T de punta), distinta <I^2>: el stickout se mueve ~2.8 mm. <I^2> es el mando del largo a T fija.")

# =====================================================================================================
# I. MEZCLA DE FRECUENCIAS
# =====================================================================================================
print()
print(L)
print("I. MEZCLA DE FRECUENCIAS: I^2 pone lineas en 0, f, 2f, f+-g; coincidencias estructurales de Rayleigh")
print(L)
r3 = math.sqrt(30 / 8); r4 = math.sqrt(4 * 3 * 6 / 8); r5 = math.sqrt(5 * 4 * 7 / 8)
print(f"  f3/f2 = {r3:.4f} -> 2 f2 = {2/r3:.4f} f3 (a {(2/r3-1)*100:.1f} % de l=3, para CUALQUIER tamano de gota; Q=30 -> ancho +-1.7 %)")
print(f"  f4/f2 = {r4:.4f} EXACTO -> f2 + 2f2 = 3 f2 = f4 exacto; y el 3er armonico de un pulso cuadrado a f2 cae EXACTO en l=4")
print(f"  f5/f2 = {r5:.4f}; si f1 = 0.5 f2 (supuesto del canon) -> 2 f1 = f2 exacto")
a = 0.46e-3
f2 = f2_de(a)
fch = {"l=1": F1R * f2, "l=2": f2, "l=3": r3 * f2, "l=4": r4 * f2, "charco": WP / 2 / math.pi}
Qch = {"l=1": Q1, "l=2": Q2, "l=3": Q3, "l=4": Q4, "charco": QP}
ph = np.linspace(0, 2 * math.pi, 4096, endpoint=False)


def lineas(I_ph, kmax=8):
    s_ = (I_ph / IC) ** 2
    c = np.fft.rfft(s_) / len(s_)
    return np.array([abs(c[0])] + [2 * abs(c[k]) for k in range(1, kmax + 1)])


def resp(lin, canal):
    k = np.arange(1, len(lin))
    r = k * f2 / fch[canal]
    return float(np.sum(lin[1:] / np.abs(1 - r ** 2 + 1j * r / Qch[canal])))


wave = {"W1 canon 40+30cos(f2)": 40 + 30 * np.cos(ph),
        "W2 raiz: I=sqrt(2050+1950cos)": np.sqrt(2050 + 1950 * np.cos(ph)),
        "W3 40+18cos(f2)+12cos(2f2)": 40 + 18 * np.cos(ph) + 12 * np.cos(2 * ph),
        "W4 pulso cuadrado 10/70 A a f2": np.where(np.cos(ph) >= 0, 70.0, 10.0)}
print(f"  gota 0.46 mm: f1 {fch['l=1']:.0f} [S], f2 {f2:.0f}, f3 {fch['l=3']:.0f}, f4 {fch['l=4']:.0f}, charco {fch['charco']:.0f} Hz; g3 {G3}, g4 {G4} [S]")
print(f"  {'forma de onda':32s} {'<I>':>5s} {'<I^2>':>6s} {'q2':>7s} {'q3':>7s} {'q4':>7s} {'charco':>7s}   lineas de I^2 en k f2 (A^2): k=0..5")
for nm, I_ph in wave.items():
    lin = lineas(I_ph)
    q2r = resp(lin, "l=2"); q3r = G3 * resp(lin, "l=3"); q4r = G4 * resp(lin, "l=4")
    zc = resp(lin, "charco") * IC ** 2 * KA / (MP * WP ** 2) * 1e6
    print(f"  {nm:32s} {I_ph.mean():5.1f} {np.mean(I_ph**2):6.0f} {q2r:7.3f} {q3r:7.4f} {q4r:7.4f} {zc:6.2f}um   "
          + " ".join(f"{x*IC**2:6.0f}" for x in lin[:6]))
print("  (amplitud estacionaria, cota: suma de lineas; q en unidades del canon, q2 >= 1 suelta; la gota se suelta antes)")
md = RHO * 4 / 3 * math.pi * a ** 3
w1 = 2 * math.pi * fch["l=1"]
print("  APUNTAR l=1 (necesita B): fuerza lateral = 2a I B / m_d. Dos maneras de poner fuerza en f1:")
for nm, Bdc, Bac, Idc, Iac in (("B 1 mT a f1, I = 40 A fija", 0.0, 1e-3, 40.0, 0.0),
                               ("B 1 mT fijo, I = 40 + 10 cos(f1)", 1e-3, 0.0, 40.0, 10.0),
                               ("B 1 mT fijo, I = 40 + 30 cos(f1)", 1e-3, 0.0, 40.0, 30.0)):
    Fl = 2 * a * (Idc * Bac + Iac * Bdc) / md
    xres = Fl / w1 ** 2 * Q1
    s1_ = 2 * Idc * Iac / IC ** 2; s2_ = Iac ** 2 / 2 / IC ** 2
    q2_side = s1_ / abs(1 - 0.25 + 1j * 0.5 / Q2) + s2_ * Q2
    print(f"    {nm:34s}: l=1 en resonancia {xres*1e6:6.1f} um | l=2 de rebote q2 = {q2_side:.3f} "
          f"(I^2 en f1: {s1_*IC**2:.0f} A^2, en 2f1 = f2: {s2_*IC**2:.0f} A^2)")
for vf_ in (0.030, 0.050):
    Vdrop = 4 / 3 * math.pi * (0.46e-3 ** 3 - (0.6 * RW) ** 3)
    fd = AW * vf_ / Vdrop
    arm = [k * fd for k in range(1, 6)]
    cerca = [f"{x_:.0f}" + ("*" if abs(x_ - fch['charco']) / fch['charco'] < 0.15 else "") for x_ in arm]
    print(f"  gotas de 0.46 mm a vf {vf_*1e3:.0f} mm/s: {fd:.0f} gotas/s; armonicos de los impactos {', '.join(cerca)} Hz "
          f"(* = a <15 % del charco {fch['charco']:.0f} Hz)")
for Rp in (1.5e-3, 2.0e-3, 3.0e-3):
    k_ = 3.8317 / Rp; k1 = 1.8412 / Rp
    print(f"  charco R {Rp*1e3:.1f} mm (prof 0.6 mm): (0,1) = {math.sqrt(SIG/RHO*k_**3*math.tanh(k_*DP))/2/math.pi:4.0f} Hz; "
          f"chapoteo (1,1) = {math.sqrt(SIG/RHO*k1**3*math.tanh(k1*DP))/2/math.pi:4.0f} Hz")
print("  campanazo en el tiempo (gota 0.46 mm congelada, Q 30, beta 1) hasta q2 >= 1: cuanto se lleva l=3")


def campanazo(I_of_phase, g3=G3, ncyc=40):
    W2 = 2 * math.pi * f2; W3 = W2 * r3
    dt = 1 / (f2 * 400); t = 0.0; q3max = 0.0
    s0 = (40.0 / IC) ** 2
    q2 = s0 / (1 - BETA * s0); v2 = 0.0; q3 = g3 * s0 / (1 - BETA * s0); v3 = 0.0
    for k in range(int(ncyc * 400)):
        I = I_of_phase(W2 * t)
        s_ = (max(I, 0) / IC) ** 2
        a2 = W2 ** 2 * (s_ - (1 - BETA * s_) * q2) - W2 / Q2 * v2
        a3 = W3 ** 2 * (g3 * s_ - (1 - BETA * s_) * q3) - W3 / Q3 * v3
        v2 += a2 * dt; q2 += v2 * dt; v3 += a3 * dt; q3 += v3 * dt; t += dt
        q3max = max(q3max, abs(q3 - g3 * s0 / (1 - BETA * s0)))
        if q2 >= 1:
            return t * f2, q3max
    return float("nan"), q3max


for nm, fn in (("W1 canon 40+30cos", lambda p: 40 + 30 * math.cos(p)),
               ("W2 raiz (sin linea en 2f2)", lambda p: math.sqrt(2050 + 1950 * math.cos(p))),
               ("W1' canon - 5.6 A a 2f2 (cancela 2f2)", lambda p: 40 + 30 * math.cos(p) - 5.625 * math.cos(2 * p))):
    c, q3m = campanazo(fn)
    print(f"    {nm:40s}: suelta en {c:5.1f} ciclos; |q3| max {q3m:.4f} (g3 = {G3})")

# =====================================================================================================
# J. RIESGO PARAMETRICO
# =====================================================================================================
print()
print(L)
print("J. RIESGO PARAMETRICO l=2 -> l=1 (f1 ~ f2/2): semilla lateral de 5 um durante el campanazo canonico (40+30 A a f2)")
print("   x1'' + (w1/Q1) x1' + w1^2 (1 + eps (q2 - q2s)) x1 = 0 ;  eps ~ 0.5 si la gota es un pendulo que se alarga [S]")
print(L)


def param(f1r, eps):
    W2 = 2 * math.pi * f2; W1 = f1r * W2
    s0 = (40 / IC) ** 2; q2s = s0 / (1 - BETA * s0)
    q2 = q2s; v2 = 0.0; xx = 5e-6; vx = 0.0; dt = 1 / (f2 * 800); t = 0.0; xm = 5e-6
    for k in range(40 * 800):
        I = 40 + 30 * math.cos(W2 * t); s_ = (I / IC) ** 2
        a2 = W2 ** 2 * (s_ - (1 - BETA * s_) * q2) - W2 / Q2 * v2
        ax = -W1 / Q1 * vx - W1 ** 2 * (1 + eps * (q2 - q2s)) * xx
        v2 += a2 * dt; q2 += v2 * dt; vx += ax * dt; xx += vx * dt; t += dt
        xm = max(xm, abs(xx))
        if q2 >= 1:
            return xm / 5e-6, t * f2
    return xm / 5e-6, float("nan")


RAT = (0.40, 0.45, 0.48, 0.50, 0.52, 0.55, 0.60)
print("   amplificacion de la semilla al soltar (max |x1| / 5 um)")
print("   f1/f2 :  " + " ".join(f"{r:6.2f}" for r in RAT))
for eps in (0.25, 0.5, 1.0):
    row = [param(r, eps) for r in RAT]
    print(f"   eps {eps:4.2f}: " + " ".join(f"{g:6.2f}" for g, c in row) + f"   (suelta en {row[3][1]:.1f} ciclos de f2)")
print("   crece la AMPLITUD; la DIRECCION la pone la semilla (ruido, soplo del arco): bombeo sin brujula.")

# =====================================================================================================
# K. OBSERVABILIDAD NO LINEAL
# =====================================================================================================
print()
print(L)
print("K. OBSERVABILIDAD NO LINEAL")
print(L)
a = 0.46e-3
print("  (1) l=1 en V: la gota (esfera colgada del cuello a distancia a) sube al mecerse: dLa = (x^2 + y^2)/(2a) [S]")
for X in (10e-6, 30e-6, 88e-6):
    print(f"      mecerse LINEAL {X*1e6:4.0f} um: linea en 2 f1 de {EA*X**2/(4*a)*1e3:7.2f} mV | en CIRCULO radio {X*1e6:4.0f} um: "
          f"0 en AC ({EA*X**2/(2*a)*1e3:6.2f} mV de DC, revueltos con el largo)")
for Xr, Xu in ((50e-6, 10e-6), (50e-6, 3e-6), (88e-6, 10e-6)):
    A_h = EA * Xr * Xu / (2 * a)
    tt_ = []
    for sig in (0.01, 0.3):
        tt_.append(2 * (3 * sig / A_h) ** 2 / 500e3)
    print(f"      homodino: referencia {Xr*1e6:3.0f} um x desconocido {Xu*1e6:3.0f} um -> linea cruzada en 2f1 de {A_h*1e3:5.2f} mV, "
          f"LINEAL y con signo; SNR 3 en {tt_[0]*1e3:7.3f} ms (ruido 10 mV) / {tt_[1]*1e3:7.1f} ms (0.3 V)")
print("      lo perpendicular a la referencia no da termino cruzado: hace falta referencia en x Y en y (2 bobinas).")
print("  (2) INFORMACION DE FISHER de V(t) a 500 kS/s, ventana 4 ms, gota 0.36 mm, 40 A, segun lo que se inyecta en el MISMO cable")
x0, u0 = punto(40.0, a0=0.36e-3)
S, Tu = escalas(x0, u0)
estados = [13, 0, 1, 2, 3, 5, 11, 7]
f2a = f2_de(0.36e-3, 40.0)
disenos = {
    "a) DC 40 A": lambda t: 0.0,
    "b) + sonda 3 A a 5 kHz": lambda t: 3.0 * np.cos(2 * math.pi * 5000 * t),
    "c) + golpecito 10 A x 0.8 ms a f2": lambda t: (10.0 * np.cos(2 * math.pi * f2a * t) if t < 0.8e-3 else 0.0),
    "d) sonda + golpecito": lambda t: 3.0 * np.cos(2 * math.pi * 5000 * t) + (10.0 * np.cos(2 * math.pi * f2a * t) if t < 0.8e-3 else 0.0),
}
cL = jac(lambda xx, uu: largo(xx), x0, u0, "x")[0] * S
cLs = cL[estados]
dt = 2e-6; nst = 2000
FISH = {}
for nm, extra in disenos.items():
    X = np.repeat(x0[None, :], 2 * len(estados), axis=0)
    for k, j in enumerate(estados):
        X[2 * k, j] += S[j]; X[2 * k + 1, j] -= S[j]
    Ys = np.zeros((nst, X.shape[0]))
    def ufun(t, extra=extra):
        u = u0.copy(); u[0] = 40.0 + extra(t); return np.repeat(u[None, :], X.shape[0], axis=0)
    def rec(k, t, xx, uu):
        Ys[k] = Vout(xx, uu)
    rk4(X, ufun, 0.0, dt, nst, rec)
    Sens = np.stack([(Ys[:, 2 * k] - Ys[:, 2 * k + 1]) / 2 for k in range(len(estados))], axis=1)
    FIM = Sens.T @ Sens                      # ruido 1 V por muestra
    FIM_r = FIM + 1e-14 * np.max(np.linalg.eigvalsh(FIM)) * np.eye(len(estados))
    Ci = inv(FIM_r)
    FISH[nm] = (Ci, FIM)
    for sig in (0.3, 0.01):
        sd = np.sqrt(np.diag(Ci)) * sig
        sLa = math.sqrt(cLs @ Ci @ cLs) * sig
        def fmt(v, unidad, tope):
            return "ciega" if v > tope else f"{v:.3g} {unidad}"
        print(f"    {nm:34s} ruido {sig*1e3:4.0f} mV: La {sLa*1e6:7.3f} um | H {fmt(sd[0]*S[13]*1e3,'mm',50)} | ls {fmt(sd[1]*S[0]*1e3,'mm',50)}"
              f" | a {fmt(sd[2]*S[1]/(4*math.pi*radio(x0[1])**2)*1e6,'um',1e3)} | T {fmt(sd[3]*5,'K',5e3)} | q2 {sd[4]*0.01:.2g}"
              f" | l=1 {fmt(sd[7]*10,'um',1e3)}")
print("    (cota de Cramer-Rao: lo mejor que cualquier estimador puede hacer con ese diseno; supone el modelo correcto)")

# =====================================================================================================
# L. EL EXPERIMENTO
# =====================================================================================================
print()
print(L)
print("L. EL EXPERIMENTO MAS BARATO: golpecitos de 10 A x 0.8 ms sobre 40 A y escuchar V 3 ms (lo que ya hace el canon)")
print(L)
print(f"  invariante de Rayleigh f2 a^1.5 = {math.sqrt(8*SIG/RHO)/(2*math.pi)*1e3**1.5:.1f} Hz mm^1.5 (sin corriente); "
      f"a 40 A con beta = 1: {math.sqrt(8*SIG/RHO*(1-(40/IC)**2))/(2*math.pi)*1e3**1.5:.1f}. Despejando sigma de lo medido: "
      f"sigma = rho (2 pi f2 a^1.5)^2 / 8")
print(f"  {'a mm':>5} {'f2 Hz':>6} {'f3 Hz':>6} {'f1 [S]':>6} {'q2 golpe':>8} {'V ring mV':>9} {'|Z2| Q30':>9} {'|Z2| Q10':>9} {'piso':>6} "
      f"{'sig_f 0.3V':>10} {'sig_f 10mV':>10}")
for a0 in (0.30e-3, 0.36e-3, 0.40e-3, 0.46e-3):
    x0, u0 = punto(40.0, a0=a0)
    A, B, C, D, Ty = linealizar(x0, u0, ("V",))
    fz = f2_de(a0, 40.0)
    z30 = abs(Z_de_f(A, B, C, D, [fz])[0])
    W2 = 2 * math.pi * fz; q = v = 0.0; dt_ = 1 / (fz * 400); t = 0.0; qm = 0.0
    while t < 0.8e-3 + 2 / fz:
        I = 40 + (10 * math.cos(W2 * t) if t < 0.8e-3 else 0.0)
        acc = W2 ** 2 * ((I / IC) ** 2 - (40 / IC) ** 2 - q) - W2 / 30 * v
        v += acc * dt_; q += v * dt_; t += dt_
        if t > 0.8e-3:
            qm = max(qm, abs(q))
    Aring = EA * a0 * qm
    # CRB de frecuencia de una senoide real (Rife-Boorstyn), 3 ms a 500 kS/s, amortiguada con Q 30 (amplitud efectiva media)
    Nn = 1500; tau = 30 / (math.pi * fz); Aeff = Aring * math.sqrt(tau / (2 * 3e-3) * (1 - math.exp(-2 * 3e-3 / tau)))
    sf = [math.sqrt(24 * s_ ** 2 / (Aeff ** 2 * (2e-6) ** 2 * Nn ** 3)) / (2 * math.pi) for s_ in (0.3, 0.01)]
    z10 = EA * a0 * 10 * 80 / IC ** 2
    print(f"  {a0*1e3:5.2f} {fz:6.0f} {fz*r3:6.0f} {F1R*f2_de(a0):6.0f} {qm:8.3f} {Aring*1e3:9.0f} {z30*1e3:7.0f}mV {z10*1e3:7.0f}mV "
          f"{D[0,0]*1e3:5.1f} {sf[0]:8.1f}Hz {sf[1]:8.2f}Hz")
print("  SI el mapa es cierto: linea que BAJA con la gota con f2 a^1.5 = 204 +- 20 % Hz mm^1.5, caida con Q >= 25,")
print("  linea en 1.94 f2 si g3 != 0, NADA en ~f2/2 (l=1 ciego; < 1 mV) y un bulto fijo del charco (~100-300 Hz).")

# =====================================================================================================
# M. TABLA DE CANALES Y CONJUNTO MINIMO
# =====================================================================================================
print()
print(L)
print("M. TABLA DE CANALES (40 A, gota 0.40 mm) Y CONJUNTO MINIMO")
print(L)
x0, u0, _ = OPS[40.0]
a0 = radio(x0[1])
dvm_dI = VEQ / (AW * (HV - x0[2]))
fz = f2_de(a0, 40.0)
filas = [
    ("l=0 volumen", "DC/rampa", f"I: {AW*dvm_dI*1e9:.2f} mm3/s por A; soltar (hibrido)",
     f"V: -{2*EA*1e-6*1e3:.0f} mV/um (DC) | oido: {1.5*fz/a0*1e-6:.1f} Hz/um", "si (I)", "si; separa de H solo con oido"),
    ("metal M=Aw ls+Vd", "integrador", f"vf: {AW*1e-3*1e9:.2f} mm3/s por mm/s. I: NADA", "V (via La)", "SOLO vf", "si"),
    ("alambre ls", "tau 0.26 y 6.5 s", f"I: -{dvm_dI*1e3:.2f} mm/s por A; vf: +1; <I^2>", "V -10 mV/um (=H); R +0.5 mOhm/mm", "si", "si; ls vs H solo con R"),
    ("T alambre h", "tau 0.26 y 6.5 s", "<I^2> Joule (a <I> fijo), <I>/vf", f"R: {10e-3*DRHO/(2*AC)*1e6:.1f} uOhm/K", "si", "si, lento (1 s)"),
    ("l=2 soltar", f"{fz:.0f} Hz Q30", f"I@f2: {Q2*80/IC**2:.3f} q/A", f"V: {EA*a0*0.01*1e3:.0f} mV por 0.01 q", "si", "si"),
    ("l=3", f"{fz*r3:.0f} Hz", f"I@f3 (g3 {G3} [S]) y 2f2 (a 3.3 %)", f"V: {EA*a0*0.01*1e3:.0f} mV por 0.01 q", "si si g3!=0", "si"),
    ("l=1 apuntar", f"{F1R*fz:.0f} Hz [S]", "B (88 um/mT en resonancia); B0*I", "V: solo |r|^2 en 2f1; homodino con B", "NO con I; 1 eje por bobina", "NO lineal; si con homodino"),
    ("charco (0,1)", f"{WP/2/math.pi:.0f} Hz Q5 [S]", f"I: {2*KA*40/(MP*WP**2)*1e6*QP:.1f} um/A en resonancia; impactos", "V: 10 mV/um", "si", "si"),
    ("altura H", "cte", "eje Z (no hay)", "V (=ls); separa con R", "NO (perturbacion)", "si con R"),
]
print(f"  {'canal':17s} {'frecuencia':15s} {'actuador y ganancia':48s} {'sensor y ganancia':40s} {'controlable':22s} observable")
for f_ in filas:
    print(f"  {f_[0]:17s} {f_[1]:15s} {f_[2]:48s} {f_[3]:40s} {f_[4]:22s} {f_[5]}")
print()
print("  rangos lineales (sin H): " + " | ".join(f"{k}: {v}/13" for k, v in RANGOS.items()))
print("  observabilidad: " + " | ".join(f"{k[1]}+{k[0][:2]}: {v}/14" for k, v in RANGOS_O.items()))
print("  CONJUNTO MINIMO para que todo canal sea controlable y observable (lineal + oido + homodino):")
print("     actuadores: I(t) con forma de onda libre (<I>, <I^2>, tonos) + motor vf + 2 bobinas (Bx, By)")
print("     sensores:   V(t) e I(t) rapidos (>= 250 kS/s) con demoduladores: nada mas (las bobinas son la referencia del homodino)")
print("     sin apuntar: I(t) + vf con V, I basta para l=0, l=2, l=3 (si g3 != 0), alambre, T, charco, M")
print("FIN")
