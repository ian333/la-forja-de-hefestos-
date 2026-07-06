#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tanque resonante con el FILAMENTO como R(T) variable.
La fuente solo paga las pérdidas (la reactiva recircula). El sistema busca su
T de EQUILIBRIO: m·cp·dT/dt = P_in(T) − P_loss(T).

Dos modos de entrega:
  CONDUCTIVO (corriente por el alambre, voltaje constante): P_in = V²/R(T).
     R sube con T (TCR) → P_in BAJA → AUTORREGULA (equilibrio estable).
  INDUCTIVO (corrientes de Foucault, acero ferromagnético): P_in ∝ √μ(T).
     Arriba de CURIE (770°C) μ→1 → el calentamiento se DESPLOMA → se ATORA en Curie.

Pregunta: ¿dónde se asienta cada uno? ¿cuánto para fundir (1540°C)?
"""
import numpy as np

d = 0.8e-3; L = 0.012                 # alambre 0.8mm, stickout 12mm
Aw = np.pi/4*d*d; Asurf = np.pi*d*L
rho_s = 7850; cp = 600; mcp = rho_s*Aw*L*cp
rho_e0 = 1.6e-7; alphaR = 0.0045
k = 45; eps = 0.4; sig = 5.67e-8
T0 = 25; T0k = 298.0; TCURIE = 770; TMELT = 1540
Rcond = 4*k*Aw/L                      # conducción a las dos mordazas [W/K]

def rho_e(T):
    # acero: sube fuerte hasta Curie, luego pendiente menor
    base = rho_e0*(1 + alphaR*np.minimum(T-25, TCURIE-25))
    extra = np.where(T > TCURIE, rho_e0*alphaR/3*(T-TCURIE), 0.0)
    return base + extra
def Rwire(T): return rho_e(T)*L/Aw
def Ploss(T):
    Tk = T+273.0
    return Rcond*(T-T0) + eps*sig*Asurf*(Tk**4 - T0k**4)
def mu_eff(T): return 1.0 + 199.0/(1.0 + np.exp((T-TCURIE)/25.0))   # ~200 frío, ~1 sobre Curie
def g_ind(T): return np.sqrt(mu_eff(T))

def equilibrium(Pin_fn, drives, T_seed=25.0, T_sim=12.0, dt=2e-4):
    T = np.full(len(drives), T_seed)
    for _ in range(int(T_sim/dt)):
        T = T + (Pin_fn(T, drives) - Ploss(T))/mcp*dt
        T = np.clip(T, T0, 2860)
    return T

print("="*64)
print(f"Alambre 0.8mm, stickout 12mm | R(25C)={Rwire(25)*1e3:.2f} mΩ  R(1540)={Rwire(1540)*1e3:.1f} mΩ")
print(f"Pérdidas @1540C = {Ploss(1540):.1f} W | masa·cp = {mcp*1e3:.1f} mJ/K | Curie {TCURIE}C")
print("="*64)

# --- CONDUCTIVO: voltaje constante por el stickout ---
print("\nCONDUCTIVO (V cte por el alambre, P=V²/R, R sube con T → autolimita):")
print("  V[V] | I@eq[A] | T_eq[C] | estado")
Vs = np.array([0.30, 0.45, 0.55, 0.62, 0.70, 0.90])
def Pin_cond(T, V): return V*V/Rwire(T)
Teq = equilibrium(Pin_cond, Vs)
for V, T in zip(Vs, Teq):
    I = V/Rwire(T)
    st = "FUNDE" if T >= TMELT else ("liquidus!" if T > 1450 else "sólido caliente")
    print(f"  {V:4.2f} |  {I:5.0f}  |  {T:5.0f}  | {st}")
print("  => autorregulación estable: dP_in/dT<0 + dP_loss/dT>0 → un solo equilibrio.")

# --- INDUCTIVO: el Curie lo atora ---
print("\nINDUCTIVO (Foucault, P∝√μ; el acero pierde μ en Curie → se ATORA):")
print("  P_frío[W] | T_eq[C] | ¿pasó Curie?")
Pd = np.array([15, 30, 60, 120, 250, 500])
def Pin_ind(T, P): return P * g_ind(T)/g_ind(25.0)
Teq2 = equilibrium(Pin_ind, Pd)
for P, T in zip(Pd, Teq2):
    print(f"   {P:5.0f}    |  {T:5.0f}  | {'SÍ' if T > TCURIE else 'NO (atorado ~Curie)'}")
print(f"  => la inducción se FRENA SOLA cerca de {TCURIE}C (μ→1). Termostato GRATIS.")

print("\n"+"="*64)
print("LECTURA (el circuito óptimo):")
print(" • INDUCCIÓN local = termostato natural en ~Curie (770C): mantiene el FRENTE")
print("   caliente para la adhesión SIN poder fundir de más ni recalentar el cuerpo.")
print(" • CONDUCTIVO (filamento=R, V cte) = autolimita y SÍ llega a fundir (~0.6V/33A)")
print("   en la PUNTA, + el ripple resonante de 668Hz suelta la gota.")
print(" • La fuente solo paga las pérdidas; la reactiva recircula (alto Q).")
print("="*64)
