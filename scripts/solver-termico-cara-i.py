#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PARTE B — Solver TERMICO ESPECTRAL (cara-i) de acumulacion de calor en WAAM
de acero, via Operador A.

Ec. de calor:  dT/dt = alpha*lap(T) + S/(rho*cp) - beta*(T-T0)
  - simetria traslacion -> cara-i = Fourier -> el Laplaciano es DIAGONAL
  - autovalores: LAM_k = alpha*|k|^2 + beta   (enfriamiento Newton suma a TODOS)
  - evolucion exacta del termino lineal por ETD (LUTs precomputadas):
        T_hat(t+dt) = E1*T_hat + E2*S_hat ,  E1=exp(-LAM*dt), E2=(1-E1)/LAM
  - la FUENTE QUE SE MUEVE = traslacion = FASE en la cara-i (Fourier-shift):
        S_hat(xc) = S_hat0 * exp(-i*(KX*xc+KZ*zc))   -> sin FFT por paso

Deposita una pared capa por capa, mide la T inter-pasada y predice la DERIVA
del ancho de cordon (Rosenthal con dTm = Tm - Tsub). Compara sin/con dwell.
"""
import time
import numpy as np
from numpy.fft import fft2, ifft2, fftfreq

# ---------- material acero ----------
alpha = 9.554e-6            # m2/s
rho, cp, kcond = 7850.0, 600.0, 45.0
Tm, T0 = 1500.0, 25.0

# ---------- dominio 2D (corte vertical de la pared) ----------
Lx, Lz = 0.060, 0.040      # m
Nx, Nz = 256, 160
dx, dz = Lx/Nx, Lz/Nz
t_y    = 1.0e-3            # espesor fuera de plano (~ancho de pared) [m]

kx = 2*np.pi*fftfreq(Nx, d=dx)
kz = 2*np.pi*fftfreq(Nz, d=dz)
KX, KZ = np.meshgrid(kx, kz, indexing='ij')
K2 = KX**2 + KZ**2

# ---------- enfriamiento Newton (sigue diagonal) ----------
tau_cool = 4.0             # s
beta = 1.0/tau_cool
LAM = alpha*K2 + beta      # <-- LOS AUTOVALORES (cara-i diagonal)

# ---------- LUTs del ETD (UNA vez) ----------
dt = 1.5e-3
E1 = np.exp(-LAM*dt)
E2 = np.where(LAM > 1e-30, (1.0 - E1)/LAM, dt)

# ---------- fuente gaussiana de referencia (centrada) y su FT ----------
X = (np.arange(Nx)[:, None])*dx
Z = (np.arange(Nz)[None, :])*dz
Q     = 250.0             # W netos
vt    = 16e-3            # m/s
sig   = 0.5e-3          # m
xr, zr = Lx/2, Lz/2
g0 = np.exp(-(((X-xr)**2 + (Z-zr)**2)/(2*sig**2)))
g0 /= (g0.sum()*dx*dz)                 # integra a 1 [1/m2]
S0  = (Q/t_y)*g0/(rho*cp)              # [K/s]
S0h = fft2(S0)

# ---------- parametros de deposito ----------
x0, x1 = 0.010, 0.050
z_base = 0.006
layer_h = 0.0009          # 0.9 mm
n_layers = 12
t_bead = (x1-x0)/vt
nstep  = int(t_bead/dt)
dxstep = (x1-x0)/nstep

def W_of_Tsub(Tsub):
    dT = max(Tm - Tsub, 1.0)
    B  = Q*vt/(4*np.pi*kcond*alpha*dT)
    R  = max(B*0.5, 1e-6); lnB = np.log(B)
    for _ in range(60):
        f = np.log(R)+R/(1+R)-lnB; fp = 1/R+1/(1+R)**2; R = max(R-f/fp, 1e-9)
    ymax = R*np.sqrt(1+2*R)/(1+R)
    return 2*ymax*(2*alpha/vt)*1e3     # mm

def run(dwell):
    That = np.zeros((Nx, Nz), dtype=complex)
    E1d = np.exp(-LAM*dwell) if dwell > 0 else None
    probeT, tmax = [], []
    for b in range(n_layers):
        zc = z_base + b*layer_h
        # T que VE esta capa (sustrato bajo el nuevo cordon)
        T = T0 + np.real(ifft2(That))
        probeT.append(T[Nx//2, int(zc/dz)])
        # depositar: la fuente barre x  (fase = traslacion en la cara-i)
        Sh = S0h*np.exp(-1j*(KX*(x0-xr) + KZ*(zc-zr)))
        pstep = np.exp(-1j*KX*dxstep)
        for s in range(nstep):
            That = E1*That + E2*Sh
            Sh = Sh*pstep
        T = T0 + np.real(ifft2(That))
        tmax.append(T.max())
        if dwell > 0:
            That = E1d*That
    return np.array(probeT), np.array(tmax)

t0 = time.time()
pT_no, tm_no = run(0.0)
pT_dw, tm_dw = run(3.0)
el = time.time()-t0

print("="*66)
print(f"Solver espectral cara-i (Fourier diagonal + ETD)")
print(f"malla {Nx}x{Nz}, {n_layers} capas x2 corridas  ->  {el:.2f} s TOTAL")
print("="*66)
print("Capa |  T inter-pasada [C]  |  ancho W predicho [mm]")
print("     | sin dwell | dwell 3s | sin dwell | dwell 3s")
for b in range(n_layers):
    print(f" {b+1:>3} |  {pT_no[b]:7.0f}  | {pT_dw[b]:7.0f}  |"
          f"  {W_of_Tsub(pT_no[b]):5.2f}    |  {W_of_Tsub(pT_dw[b]):5.2f}")
print("-"*66)
print(f"DERIVA ancho sin dwell: {W_of_Tsub(pT_no[0]):.2f} -> {W_of_Tsub(pT_no[-1]):.2f} mm "
      f"(+{W_of_Tsub(pT_no[-1])-W_of_Tsub(pT_no[0]):.2f})")
print(f"DERIVA ancho con dwell: {W_of_Tsub(pT_dw[0]):.2f} -> {W_of_Tsub(pT_dw[-1]):.2f} mm "
      f"(+{W_of_Tsub(pT_dw[-1])-W_of_Tsub(pT_dw[0]):.2f})")
print(f"T_max pico: sin dwell {tm_no.max():.0f} C | dwell {tm_dw.max():.0f} C  (ref fusion 1500)")
print("="*66)
