#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VELOCIDAD DE DEPOSICIÓN + INERCIA DEL CABEZAL.
1) Envolvente de depósito: Q=A_w·v_f; sección del cordón A_b=Q/v_travel (masa);
   techo por POTENCIA de fusión y por la cadencia de gotas (cordón continuo).
2) Inercia: el cabezal (carro+antorcha+CABLES de alta corriente) tiene masa M;
   los pasos dan a_max acotada por RINGING (resonancia correa-masa f=√(k/M)/2π).
   En las esquinas el cabezal FRENA (v_junction) → si el depósito es constante,
   se hace un PEGOTE (A=Q/v sube). El RP2350, al controlar v_f y f_disparo
   electrónicamente, ESCLAVIZA el depósito a la velocidad real → cordón parejo.
"""
import numpy as np
rho=7000.; cp=600.; Lf=250e3; dW=0.8e-3; Aw=np.pi/4*dW*dW
Evol=rho*(cp*1495+Lf)                       # energía para fundir 1 m³ de acero [J/m³]

# ===== 1) ENVOLVENTE DE DEPÓSITO =====
print("="*66)
print("1) ENVOLVENTE — Q=A_w·v_f ; sección cordón A_b=Q/v_travel")
print("="*66)
print(f"  energía p/fundir acero = {Evol/1e9:.1f} GJ/m³ · A_alambre={Aw*1e6:.3f} mm²")
print("  v_f[mm/s] | Q[mm³/s] | masa[g/h] | P_fusión[W] | cordón 1mm×0.5 → v_travel")
for vf in [5,10,20,40,60]:
    Q=Aw*(vf*1e-3); P=Q*Evol; mdot=Q*rho*3.6e6
    Ab=0.5e-6                                # 1.0mm ancho × 0.5mm alto ≈ 0.5 mm²
    vtr=Q/Ab
    print(f"   {vf:4d}    |  {Q*1e9:5.1f}  |  {mdot:5.0f}  |   {P:5.0f}    |  {vtr*1e3:4.0f} mm/s")
Pmax=250.0; vf_pwr=Pmax/Evol/Aw*1e3
print(f"  → techo por potencia (P≤{Pmax:.0f}W): v_f ≤ {vf_pwr:.0f} mm/s (≈{Pmax/Evol*1e9:.1f} mm³/s).")

# cordón continuo: gotas deben solaparse → v_travel ≤ f_disparo·d_gota
print("\n  cordón CONTINUO: v_travel ≤ f_disparo · d_gota (gotas solapadas)")
print("  f_disparo[Hz] | d_gota[mm] | v_travel_máx[mm/s]")
for f,dg in [(300,0.34),(600,0.27),(1200,0.21)]:
    print(f"     {f:4d}      |   {dg:4.2f}    |    {f*dg:4.0f}")
print("  → a 600Hz/0.27mm puedes correr hasta ~160 mm/s sin huecos.")

# ===== 2) INERCIA DEL CABEZAL =====
print("\n"+"="*66)
print("2) INERCIA — masa del cabezal, ringing y frenado en esquinas")
print("="*66)
kbelt=2.0e4                                  # rigidez correa GT2 ~20 N/mm
print("  M_cabezal[g] | f_resonancia[Hz] | amplitud ringing rel. (∝1/f²)")
for parts in [("antorcha sola",0.35),("+cables AWG8 (1m)",0.60),("+buck a bordo",1.6)]:
    nm,M=parts; f=np.sqrt(kbelt/M)/(2*np.pi)
    print(f"   {M*1e3:4.0f}  {nm:18s}|     {f:4.1f}        | {1/f**2/ (1/ (np.sqrt(kbelt/0.35)/(2*np.pi))**2):4.2f}×")
print("  → los CABLES de alta corriente son inercia escondida: bajan f_res y")
print("    DUPLICAN el ringing. Buck FIJO (no a bordo) + cable flexible de muchos hilos.")

amax=1200.0; delta=0.05e-3                   # accel práctica [mm/s²]→ y junction deviation 0.05mm
def vj(a,d): return np.sqrt(a*d*1e3)         # vel de esquina ~√(a·δ)  [mm/s]
print(f"\n  con a_max={amax:.0f} mm/s², junction δ={delta*1e3:.2f} mm → v_esquina={vj(amax,delta):.1f} mm/s")

# ===== 3) EL PEGOTE en la esquina, y el FIX (esclavizar depósito a v) =====
print("\n"+"="*66)
print("3) CUADRADO 20mm — cordón con depósito CONSTANTE vs ESCLAVIZADO a v(t)")
print("="*66)
Lside=20e-3; vmax=60e-3; a=amax*1e-3; vjc=vj(amax,delta)*1e-3
# perfil v(s) a lo largo del perímetro (planner fwd/bwd, esquinas a vjc)
N=4000; per=4*Lside; s=np.linspace(0,per,N); ds=per/N
corners=[0,Lside,2*Lside,3*Lside,4*Lside]
v=np.full(N,vmax)
for c in corners:                            # rampas de accel desde cada esquina
    d=np.abs(((s-c+per/2)%per)-per/2)        # distancia al corner (periódica)
    v=np.minimum(v,np.sqrt(vjc**2+2*a*d))
Q=Aw*20e-3                                    # feed nominal a 20 mm/s de alambre
Ab_const=Q/v                                 # depósito CONSTANTE → sección varía
Ab_nom=Q/vmax
blob=Ab_const.max()/Ab_nom
# velocidad-esclavizado: Q(t)=Ab_target·v(t) → sección constante
Ab_slaved=np.full(N,Ab_nom)
excess=np.sum((Ab_const-Ab_nom).clip(min=0))*ds   # volumen extra (pegotes) [m³]
print(f"  v_max={vmax*1e3:.0f} mm/s, esquinas a {vjc*1e3:.1f} mm/s (inercia)")
print(f"  DEPÓSITO CONSTANTE: el cordón en la esquina es {blob:.1f}× más grueso (PEGOTE)")
print(f"     volumen extra acumulado en las 4 esquinas = {excess*1e9:.2f} mm³ (defecto de precisión)")
print(f"  DEPÓSITO ESCLAVIZADO a v(t) (RP2350 escala v_f y f_disparo): sección CONSTANTE")
print(f"     pegote = 1.0× · el control electrónico convierte la inercia en NO-problema")
print("\n"+"="*66)
print("LECTURA: la inercia obliga a FRENAR en esquinas (v_esquina≈%.0f mm/s); con un"%(vjc*1e3))
print("extrusor mecánico eso = pegotes de %.1f×. Como AQUÍ el depósito es ELECTRÓNICO"%blob)
print("(v_f + f_disparo), el RP2350 lo esclaviza a la velocidad real → cordón parejo a")
print("cualquier velocidad. Techo de depósito ~%.0f mm/s (potencia); el ringing pide"%vf_pwr)
print("buck FIJO + cable flexible. La inercia fija el PERFIL; el depósito lo sigue.")
print("="*66)
