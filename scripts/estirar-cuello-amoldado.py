#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ESTIRAR EL CUELLO ("amoldar" la gota) — idea del operador Ian.
En vez de reventar por pinch de Lorentz (necesita i>i_crit≈194A, gota gorda y
violenta), BAJAMOS la corriente y ESTIRAMOS el cuello: la CAPILARIDAD lo adelgaza
y rompe a bajo radio (Rayleigh-Plateau). Más suave, gota más chica.

MODELO (de números, integrado):
  cuello = puente líquido de radio r y largo L.
  dL/dt = v_pull                      (retracción mecánica del cabezal)
  dr/dt = − r·v_pull/(2L)             (adelgaza por estirón, vol cuello ~cte)
          − K_cap                     (drenaje capilar, Rayleigh)
          − K_L·max(0,1−(i_crit(r)/i)²)   (pinch Lorentz, sólo si i>i_crit)
  T del cuello: enfría por conducción al alambre + radiación; I²R lo calienta.
     si T<T_liq ANTES de romper → STUBBING (se congela, el alambre se clava).
  Rompe cuando r≤r_min. La gota = volumen de alambre fundido durante el ciclo
     (alimentación v_f·A_w·t_detach) → detach más rápido = gota más chica.
  SATÉLITES: el cuello estirado (cuasi-cilindro r_mid, largo L_break) es
     Rayleigh-Plateau inestable a λ>2πr → nº trozos ≈ L_break/(2π·r_mid).
"""
import numpy as np

# --- acero líquido (bajo carbono ~1600°C) ---
rho=7000.; gamma=1.5; mu=5e-3; cp=800.; k=30.; rho_e=1.2e-6
T_liq=1520.; T0=1600.; Tamb=300.; eps=0.4; sig=5.67e-8; mu0=4*np.pi*1e-7
rw=0.4e-3; Aw=np.pi*rw*rw; L0=0.1e-3; rmin=0.03e-3; Lcond=5e-3
vf=20e-3                              # avance de alambre 20 mm/s
Kcap=0.04                            # drenaje capilar [m/s]
KL=0.35                              # tasa pinch Lorentz [m/s]
def icrit(r): return np.sqrt(8*np.pi*np.pi*r*gamma/mu0)

# números adimensionales / tiempos
Oh = mu/np.sqrt(rho*gamma*rw)
tau_cap = np.sqrt(rho*rw**3/gamma)
f_ray = 1/(2*np.pi*np.sqrt(rho*(0.46e-3)**3/(8*gamma)))  # modo l=2 gota 0.46mm
print("="*66)
print(f"acero líquido: Oh={Oh:.4f} (bajo→INERCIAL, propenso a satélites)")
print(f"τ_cap(r_w)={tau_cap*1e3:.2f} ms · i_crit(0.4mm)={icrit(rw):.0f} A · f_Rayleigh={f_ray:.0f} Hz")
print("="*66)

def cycle(v_pull, i_hold, dt=2e-6, tmax=20e-3):
    r=rw; L=L0; T=T0; t=0.
    while t<tmax and r>rmin:
        ic=icrit(r)
        dr = -(r*v_pull/(2*L)) - Kcap - (KL*(1-(ic/max(i_hold,1))**2) if i_hold>ic else 0.0)
        r=max(r+dr*dt, 1e-9); L+=v_pull*dt
        Vn=np.pi*r*r*L; Rn=rho_e*L/(np.pi*r*r)
        Pj=i_hold*i_hold*Rn
        Pcond=k*np.pi*r*r*(T-T_liq)/Lcond
        Prad=eps*sig*(2*np.pi*r*L)*((T+273)**4-(Tamb+273)**4)
        T += (Pj-Pcond-Prad)/(rho*cp*Vn)*dt
        t+=dt
        if T<T_liq:                                  # se congeló antes de romper
            return dict(reg='STUB', t=t, L=L, r=r, d=np.nan, sat=0, T=T)
    if r>rmin:
        return dict(reg='no-rompe', t=t, L=L, r=r, d=np.nan, sat=0, T=T)
    Vdrop=Aw*vf*t                                    # alambre fundido este ciclo
    d=(6*Vdrop/np.pi)**(1/3)
    rmid=(rw+rmin)/2
    sat=int(L/(2*np.pi*rmid))                        # trozos por Plateau
    reg = 'SATÉLITES' if sat>=1 else 'LIMPIA'
    return dict(reg=reg, t=t, L=L, r=r, d=d, sat=sat, T=T)

# --- BARRIDO v_pull a corriente BAJA (suave, i<i_crit) ---
print("\nESTIRADO a i_hold=60 A (suave, <i_crit) — barrido de velocidad de estirón:")
print("  v_pull[m/s] | t_detach[ms] | d_gota[mm] | L_cuello[mm] | sat | régimen")
for vp in [0.0,0.05,0.10,0.15,0.20,0.30,0.45,0.65,1.0]:
    c=cycle(vp, 60.)
    d = f"{c['d']*1e3:5.2f}" if not np.isnan(c['d']) else "  —  "
    print(f"   {vp:5.2f}     |   {c['t']*1e3:6.2f}    |   {d}    |    {c['L']*1e3:5.2f}     |  {c['sat']}  | {c['reg']}")

# --- comparación: latigazo clásico (sin estirón, corriente ALTA) ---
print("\nREFERENCIA — latigazo clásico (v_pull=0, i alta para pinch Lorentz):")
print("  i_hold[A] | t_detach[ms] | d_gota[mm] | régimen")
for ih in [194, 250, 350]:
    c=cycle(0.0, float(ih))
    d = f"{c['d']*1e3:5.2f}" if not np.isnan(c['d']) else "  —  "
    print(f"    {ih:4d}   |   {c['t']*1e3:6.2f}    |   {d}    | {c['reg']}")

# --- ventana óptima: barrido fino para el mínimo LIMPIO ---
best=None
for vp in np.linspace(0.02,0.9,200):
    c=cycle(vp,60.)
    if c['reg']=='LIMPIA' and (best is None or c['d']<best['d']):
        best=dict(vp=vp, **c)
print("\n"+"="*66)
if best:
    print(f"ÓPTIMO LIMPIO: v_pull≈{best['vp']:.2f} m/s → gota {best['d']*1e3:.2f} mm "
          f"en {best['t']*1e3:.2f} ms (i sólo 60 A, cuello {best['L']*1e3:.2f} mm)")
# umbral de satélites
vp_sat=None
for vp in np.linspace(0.02,1.5,400):
    if cycle(vp,60.)['sat']>=1: vp_sat=vp; break
vp_stub=None
for vp in np.linspace(0.9,0.0,200):
    if cycle(vp,60.)['reg']=='STUB': vp_stub=vp; break
print(f"VENTANA: estira más lento que ~{vp_sat:.2f} m/s = satélites · "
      f"más lento que ~{(vp_stub or 0):.2f} m/s = STUB (se congela)")
print("="*66)
print("LECTURA: estirar a corriente BAJA suelta gotas más chicas y SUAVES")
print("(i 60A vs 194-350A) que el pinch clásico, PERO el acero (Oh bajo) limita:")
print("rápido→satélites, lento→se congela. El amoldado vive en la ventana de en medio.")
print("Latente de fusión (~247 kJ/kg) ENSANCHA la ventana anti-stub ~1.5×.")
print("="*66)
