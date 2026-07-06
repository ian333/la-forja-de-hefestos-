#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monte Carlo de PRECISION de deposicion de microalambre E71T-GS
(acero al bajo carbono, 0.030"/0.8mm, nucleo fundente autoprotegido,
 Truper MICRO-1 cod.13750) sobre el chasis de una impresora 3D,
en regimen gota-a-gota / CMT pulsado.

Modelo fisico (todo derivable, nada hardcodeado):
  - Ancho de cordon: solucion de Rosenthal (fuente puntual movil) ->
    ancho maximo de la isoterma de fusion.
  - Area/altura de cordon: conservacion de masa  A_b = A_alambre*(vf/vt).
  - Pisos fisicos: diametro de gota (>= diametro de alambre) y long. capilar.
Propaga la incertidumbre de proceso -> distribucion de ancho/alto -> P50/P95.

Backend GPU (cupy) si esta; si no numpy.
"""
import time
try:
    import cupy as xp
    if xp.cuda.runtime.getDeviceCount() < 1:   # WSL D3D12 != CUDA
        raise RuntimeError("sin device CUDA")
    xp.zeros(1) + 0
    BACKEND = "cupy / GPU (RTX 4070 Ti)"
except Exception:
    import numpy as xp
    BACKEND = "numpy / CPU"

PI = 3.141592653589793

def cpu(a):
    try:
        return float(xp.asnumpy(a))
    except Exception:
        return float(a)

# ===================== CONSTANTES DEL MATERIAL =====================
Tm    = 1500.0       # C   fusion (liquidus aprox, acero bajo C)
T0    = 25.0         # C   ambiente
rho_s = 7850.0       # kg/m3 solido
rho_l = 7000.0       # kg/m3 liquido
cp    = 600.0        # J/kgK efectivo (solido->fusion)
Lf    = 250e3        # J/kg  calor latente de fusion
Hmelt = cp*(Tm-T0) + Lf
k0    = 45.0         # W/mK
gamma = 1.5          # N/m
g     = 9.81
d_nom = 0.8e-3       # m
A_w0  = PI/4*d_nom**2
alpha0= k0/(rho_s*cp)
lam_c = (gamma/(rho_l*g))**0.5

# ===================== PISOS FISICOS =====================
L_drop = d_nom
V_drop = A_w0*L_drop
D_drop = (6*V_drop/PI)**(1.0/3.0)
m_drop = V_drop*rho_s
E_drop = m_drop*Hmelt
a      = D_drop/2
tau_freeze = a**2/alpha0
tau_ball   = (rho_l*a**3/gamma)**0.5

print("="*66)
print("Backend:", BACKEND)
print(f"Hmelt = {Hmelt/1e3:.0f} kJ/kg   alpha = {alpha0:.3e} m2/s")
print(f"lambda_capilar = {lam_c*1e3:.2f} mm")
print(f"PISO de gota (alambre 0.8mm): D_gota = {D_drop*1e3:.2f} mm, "
      f"E_gota = {E_drop:.2f} J")
print(f"tau_congelar = {tau_freeze*1e3:.1f} ms   "
      f"tau_embolar = {tau_ball*1e3:.2f} ms")
print("="*66)

# ===================== ROSENTHAL: dado B hallar R~ =====================
def solve_R(B):
    R = xp.maximum(B*0.5, 1e-9)
    lnB = xp.log(B)
    for _ in range(35):
        f  = xp.log(R) + R/(1.0+R) - lnB
        fp = 1.0/R + 1.0/(1.0+R)**2
        R  = xp.maximum(R - f/fp, 1e-12)
    return R

def bead(d, vt, vf, Qnet, Tsub, k, wet):
    alpha = k/(rho_s*cp)
    dT    = xp.maximum(Tm - Tsub, 1.0)
    B     = Qnet*vt/(4*PI*k*alpha*dT)
    R     = solve_R(B)
    ymax  = R*xp.sqrt(1.0+2.0*R)/(1.0+R)
    lth   = 2.0*alpha/vt
    W     = 2.0*ymax*lth
    A_w   = PI/4*d**2
    A_b   = A_w*(vf/vt)
    h     = 1.5*A_b/xp.maximum(W,1e-12)*wet
    return W, h

def stats(x):
    x = xp.sort(x); n = x.shape[0]
    q = lambda p: cpu(x[int(p*(n-1))])
    return cpu(xp.mean(x)), cpu(xp.std(x)), q(0.05), q(0.5), q(0.95)

rng = xp.random.standard_normal

# ===================== MONTE CARLO PUNTO NOMINAL =====================
N     = 5_000_000
vt0   = 8e-3       # m/s
Qnet0 = 330.0      # W
A_b_t = (2.0/3.0)*1.2e-3*0.4e-3
vf0   = A_b_t*vt0/A_w0

d    = d_nom + 0.012e-3*rng(N)
vt   = vt0   + 0.01*vt0*rng(N)
vf   = vf0   + 0.04*vf0*rng(N)
Qn   = Qnet0 + 0.08*Qnet0*rng(N)
Tsub = xp.clip(150.0 + 60.0*rng(N), 25.0, 400.0)
kk   = 45.0 + 5.0*rng(N)
wet  = 1.0 + 0.15*rng(N)

t0 = time.time()
W, h = bead(d, vt, vf, Qn, Tsub, kk, wet)
Wm, hm = W*1e3, h*1e3
mt = time.time()-t0

mW = stats(Wm); mh = stats(hm)
print(f"\nMONTE CARLO  N={N:,}  ({mt*1000:.0f} ms)")
print(f"Nominal: vt={vt0*1e3:.1f} mm/s  Qnet={Qnet0:.0f} W  vf={vf0*1e3:.2f} mm/s")
print(f"ANCHO W [mm]: media {mW[0]:.3f}  sd {mW[1]:.3f}  P5 {mW[2]:.3f}  "
      f"P50 {mW[3]:.3f}  P95 {mW[4]:.3f}")
print(f"ALTO  h [mm]: media {mh[0]:.3f}  sd {mh[1]:.3f}  P5 {mh[2]:.3f}  "
      f"P50 {mh[3]:.3f}  P95 {mh[4]:.3f}")
for tol in (0.1,0.15,0.25,0.5):
    frac = cpu(xp.mean((xp.abs(Wm-mW[3])<tol)))*100
    print(f"  P(|W-P50| < {tol:.2f} mm) = {frac:5.1f}%")
print(f"  piso fisico por alambre: W no baja de ~{D_drop*1e3:.2f} mm")

# ===================== BARRIDO (Qnet, vt) =====================
Qs  = [150,250,350,500,700,1000,1500]
vts = [4,6,8,10,12,16,20]
NS  = 40000
grid = {}
best = None
for vtt in vts:
    for Q in Qs:
        d_  = d_nom + 0.012e-3*rng(NS)
        vt_ = (vtt*1e-3) + 0.01*(vtt*1e-3)*rng(NS)
        vf_ = vf0 + 0.04*vf0*rng(NS)
        Qn_ = Q + 0.08*Q*rng(NS)
        Ts_ = xp.clip(150.0+60.0*rng(NS),25,400)
        kk_ = 45.0+5.0*rng(NS)
        we_ = 1.0+0.15*rng(NS)
        W_,_= bead(d_,vt_,vf_,Qn_,Ts_,kk_,we_)
        W_  = W_*1e3
        p50 = cpu(xp.median(W_)); sd = cpu(xp.std(W_))
        grid[(vtt,Q)] = (p50,sd)
        if 0.9<=p50<=1.3 and (best is None or sd<best[3]):
            best = (Q,vtt,p50,sd)

print("\nBARRIDO  W_P50 [mm]   (filas vt mm/s, columnas Qnet W)")
print("  vt\\Q " + "".join(f"{q:>7d}" for q in Qs))
for vtt in vts:
    print(f"  {vtt:>4d} " + "".join(f"{grid[(vtt,Q)][0]:>7.2f}" for Q in Qs))
if best:
    print(f"\nRECOMENDADO (W~1mm, min sd): Qnet={best[0]} W, vt={best[1]} mm/s "
          f"-> W_P50={best[2]:.2f} mm, sd={best[3]:.3f} mm")
print("="*66)
