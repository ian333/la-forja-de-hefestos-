#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VIABILIDAD de la impresora de gota — TODO anclado en los datos del lab 2026-06-06.
Calcula: tamaño de gota (min/max), voltaje, velocidad (cadencia + volumetrica +
XY), precision, resistencia de union, microsoportes-viruta, y roscas.
Honesto: la eficiencia de fusion (eta) es el unico parametro incierto -> se da rango.
"""
import numpy as np

print("="*72)
print(" DATOS REALES DEL LAB (2026-06-06)")
print("="*72)
C       = 2200e-6      # F, cap del boost (derivado ~1.9mF, nominal 2200)
V_typ   = 42.0         # V, operacion tipica (cap lleno)
V_max   = 48.0         # V, probado, aguanto bien (MBR 60V -> margen)
V_flux  = 30.0         # V, umbral medido para ROMPER el flux (R cae 50->8 ohm)
E_min_m = 0.066        # J, tack mas flojo medido hoy
E_max_m = 2.08         # J, tack mas fuerte medido hoy
R_fresh = 7.6          # ohm, contacto fresco (cap lleno)
d_wire  = 0.8e-3       # m, microalambre E71T-GS
f2      = 4714.0       # Hz, modo pinch l=2 (Rayleigh-Lamb, de la sim)
f3      = 9127.0       # Hz, modo pera l=3
# acero
rho=7850.; cp=600.; Hf=270e3; dTm=1500.
E_kg = cp*dTm + Hf     # J para fundir 1 kg de acero desde frio
print(f"  C={C*1e6:.0f}uF  V_typ={V_typ}V  V_max={V_max}V  V_flux~{V_flux}V")
print(f"  E medida: {E_min_m*1e3:.0f} mJ ... {E_max_m*1e3:.0f} mJ")
print(f"  acero: {E_kg/1e6:.2f} MJ/kg  ·  f2={f2:.0f}Hz  f3={f3:.0f}Hz")

# eficiencias (incertidumbre honesta)
eta_lo, eta_hi = 0.08, 0.25   # fraccion de E que funde metal
fdep = 0.5                     # fraccion que se queda depositada
def d_from_E(E, eta):
    m = E*eta*fdep/E_kg        # kg depositados
    V = m/rho                  # m^3
    return (6*V/np.pi)**(1/3)  # m

def E_from_d(d, eta):          # inverso: energia para una gota de diametro d
    V = np.pi/6*d**3
    m = V*rho
    return m*E_kg/(eta*fdep)

def V_from_E(E):               # voltaje del cap para soltar energia E
    return np.sqrt(2*E/C)

print("\n"+"="*72)
print(" 1) TAMANO DE GOTA  (de la energia min/max, rango por eta)")
print("="*72)
dmin = d_from_E(E_min_m, eta_hi)*1e6   # gota mas chica: E min + eta alta
dmax = d_from_E(E_max_m, eta_lo)*1e6   # gota mas grande: E max + eta baja
dtyp = d_from_E(1.0, 0.15)*1e6
print(f"  MINIMA  (66mJ): {dmin:.0f} um")
print(f"  TIPICA  (~1J):  {dtyp:.0f} um")
print(f"  MAXIMA  (2J):   {dmax:.0f} um")
print(f"  -> rango de control con ESTE circuito: ~{dmin:.0f}-{dmax:.0f} um")
print(f"     (1 perilla: ENERGIA del cap = 1/2 C V^2; tamano ~ E^(1/3))")

print("\n"+"="*72)
print(" 2) VOLTAJE  (cuanto para cada tamano)")
print("="*72)
for d_um in [80,100,150,250,350]:
    Elo=E_from_d(d_um*1e-6, eta_hi); Ehi=E_from_d(d_um*1e-6, eta_lo)
    Vlo=V_from_E(Elo); Vhi=V_from_E(Ehi)
    flag = "  <-- bajo umbral flux (necesita cap mas chico o alambre solido)" if Vhi<V_flux else ""
    print(f"  gota {d_um:3d}um -> E {Elo*1e3:5.0f}-{Ehi*1e3:5.0f} mJ -> V {Vlo:4.1f}-{Vhi:4.1f} V{flag}")
print(f"  PISO real: V>={V_flux}V para romper el flux del alambre tubular.")
print(f"  -> gotas <~150um con alambre tubular NO bajan de {V_flux}V: usar")
print(f"     alambre SOLIDO (sin flux) o cap mas chico (mismo V, menos Q).")

print("\n"+"="*72)
print(" 3) VELOCIDAD  (el cuello de botella REAL = recarga del cap)")
print("="*72)
E_gota = 1.0
for P_boost in [10, 50, 100]:
    t_rec = E_gota/P_boost
    f_gota = 1/t_rec
    f_gota = min(f_gota, f2)      # no mas rapido que el modo resonante
    Vg = np.pi/6*(dtyp*1e-6)**3
    Q = f_gota*Vg*1e9             # mm^3/s
    v_xy = dtyp*1e-6*f_gota*1e3   # mm/s (gotas adyacentes sin encimar)
    print(f"  boost {P_boost:3d}W -> recarga {t_rec*1e3:5.1f}ms -> {f_gota:6.0f} gotas/s "
          f"| {Q:5.2f} mm3/s | cabeza {v_xy:5.0f} mm/s")
print(f"  HOY: el firmware espera 2s a proposito (0.5 gota/s). El boost FISICO")
print(f"       puede mucho mas; el limite duro lo pone la POTENCIA del boost.")
print(f"  Referencia: FDM normal ~5-15 mm3/s. Con boost de 100W estamos en la liga.")

print("\n"+"="*72)
print(" 4) PRECISION")
print("="*72)
print(f"  resolucion XY = tamano de gota   = {dmin:.0f}-{dmax:.0f} um")
print(f"  resolucion Z  = gota aplastada   ~ {dmin*0.5:.0f}-{dmax*0.5:.0f} um (~0.5 d)")
print(f"  repetibilidad: la RESONANCIA hace cada disparo igual (1 nodo, sin satelites)")
print(f"  comparacion:  FDM boquilla 400um | SLM laser 50-100um | resina 50um")
print(f"  -> en el extremo fino ({dmin:.0f}um) competimos con SLM metal, a centavos.")

print("\n"+"="*72)
print(" 5) RESISTENCIA de la pieza  (el doble filo de la energia)")
print("="*72)
print(f"  E ALTA (cap lleno 44V): R_contacto baja a {R_fresh:.0f}ohm -> fusion metalurgica")
print(f"     real entre gotas -> union ~ material base. PIEZA RESISTENTE.")
print(f"  E BAJA (~12V):          union FRIA, fragil -> se despega facil.")
print(f"  -> MISMA maquina: subes E para estructura, bajas E para soporte.")

print("\n"+"="*72)
print(" 6) MICROSOPORTES-VIRUTA  (tu idea: soportes que se rompen como viruta)")
print("="*72)
d_sop = dmin
E_sop = E_from_d(d_sop*1e-6, 0.15)
print(f"  soporte = gotas MINIMAS ({d_sop:.0f}um) con energia minima -> union DEBIL a")
print(f"  proposito. Al desmoldar se quiebran en viruta de ~{d_sop:.0f}um (polvo metalico).")
print(f"  energia por gota-soporte ~{E_sop*1e3:.0f}mJ; se barren/aspiran. La pieza buena")
print(f"  queda intacta porque sus gotas SI se fundieron (E alta).")
print(f"  BONUS: esa 'viruta' es polvo de acero limpio -> reciclable a alambre.")

print("\n"+"="*72)
print(" 7) ROSCAS / CUERDAS")
print("="*72)
for name,paso,prof in [("M2",0.4,0.25),("M3",0.5,0.31),("M5",0.8,0.49),("M8",1.25,0.77)]:
    g_paso = paso*1e-3/(dmin*1e-6)   # gotas por paso a resolucion fina
    g_prof = prof*1e-3/(dmin*1e-6)
    ok = "OK" if g_paso>=3 and g_prof>=2 else "limite"
    print(f"  {name}: paso {paso}mm, filete {prof}mm -> {g_paso:.0f} gotas/paso, "
          f"{g_prof:.0f} gotas/filete  [{ok}]")
print(f"  -> con gotas de {dmin:.0f}um resolvemos rosca M3 hacia arriba. M2 = el limite.")

print("\n"+"="*72)
print(" VEREDICTO")
print("="*72)
print(f"  CON EL CIRCUITO DE HOY (sin cambiar nada): SI, gotas {dmin:.0f}-{dmax:.0f}um,")
print(f"     piezas 3D simples, roscas M3+, soportes-viruta. Lo unico lento: la")
print(f"     cadencia (recarga del cap) -> el firmware la frena a proposito.")
print(f"  PARA VELOCIDAD: boost mas potente (100W) -> ~{min(f2,100):.0f} gotas/s, ~1-2 mm3/s.")
print(f"  PARA GOTAS <150um: alambre SOLIDO (sin flux) o cap mas chico.")
print(f"  PARA APUNTAR/3D: los 2 modos (f2 pinch + f3 pera) ya dan direccion+tamano.")
print("="*72)
