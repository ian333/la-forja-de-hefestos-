#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUCK DE FUSIÓN con TUS PIEZAS REALES — valida el circuito de armado.
Vsrc=12V (PC), C=7mF (7x1000µF), L=20µH (bobina de aire), Q1=IRL540N (Rds=44mΩ),
flyback 19x MBR360G, shunt 2mΩ. Low-side. Acero E71T-GS 0.8mm.
"""
import numpy as np
Vsrc=12.0; C=7e-3; L=20e-6
Rds=0.044; Rcoil=0.020; Rsh=0.002; Rfix=0.010      # IRL540N, bobina aire, shunt, cables
Rfixed=Rds+Rcoil+Rsh+Rfix
Vf=0.6; N_mbr=19; Imbr=N_mbr*2.0                    # 19 MBR ~2A útil c/u ≈ 38A
# acero
rho=7000.; cp=600.; Lf=250e3; Tliq=1520.; d=0.8e-3; Aw=np.pi/4*d*d; Lb=0.5e-3; mb=rho*Aw*Lb
Rj_cont=0.020; Rj_liq_sol=0.154; Rj_liquid=0.0012   # junta: contacto, sólido@liquidus(TCR), líquido

print("="*66)
print(f"TUS PIEZAS: 12V · 7mF · 20µH(aire) · IRL540N(Rds={Rds*1e3:.0f}mΩ) · 19×MBR · shunt2mΩ")
print(f"R fija del lazo = {Rfixed*1e3:.0f} mΩ (Rds+bobina+shunt+cables)")
print("="*66)

print("\n1) PUNTO DE OPERACIÓN a 12V (corriente limitada por las R):  I=Vsrc/(Rfija+Rjunta)")
print("   estado junta | R_junta | I [A] | P_junta=I²Rj [W]")
for nm,Rj in [("contacto frío",Rj_cont),("sólido caliente",0.08),("sólido@liquidus",Rj_liq_sol),("líquido",Rj_liquid)]:
    I=Vsrc/(Rfixed+Rj); P=I*I*Rj
    print(f"   {nm:15s}| {Rj*1e3:5.0f}mΩ | {I:5.0f} | {P:5.0f}")
print("   → a 12V SÍ hay corriente de sobra para fundir (decenas-cientos de A).")

print("\n2) ¿FUNDE? rampa del choque + calentamiento")
print(f"   di/dt = Vsrc/L = {Vsrc/L*1e-6:.2f} A/µs (sube rápido con bobina chica)")
for I in [40,60,80]:
    # calienta en contacto sólido (Rj sube con T; uso un Rj medio ~0.06)
    Pj=I*I*0.06; dTdt=Pj/(mb*cp); t_melt=(Tliq-25)/dTdt
    print(f"   a {I} A: P≈{Pj:.0f}W en la junta → funde en ~{t_melt*1e3:.2f} ms")
print("   → funde en milisegundos. El 12V alcanza.")

print("\n3) CAÍDA del banco (7mF) por pulso  (dV=I·t/C)")
print("   I_pico | 0.2ms | 0.5ms | 1.0ms")
for I in [40,60,80]:
    print(f"   {I:4d}A | {I*0.2e-3/C:4.1f}V | {I*0.5e-3/C:4.1f}V | {I*1e-3/C:5.1f}V")
print("   → pulsos CORTOS (≤0.5ms) mantienen el voltaje. Largos lo hunden (agrega caps).")

print("\n4) CALOR del IRL540N (P=I²·Rds·duty)  — el cuello de botella térmico")
print("   I | duty | 1 MOSFET | 2 en paralelo")
for I in [40,60]:
    for D in [0.1,0.3]:
        P1=I*I*Rds*D; print(f"  {I}A | {int(D*100):2d}% | {P1:5.0f} W  | {P1/2:5.0f} W")
print("   → 1 IRL para primer light (baja corriente/duty); 2-3 para sostenido.")

print("\n5) FLYBACK (19× MBR360G ≈ 38A útil)")
for I in [40,60]:
    Ifb=I*0.8  # promedio aprox (conduce ~80% del tiempo)
    ok="OK" if Ifb<=Imbr else "AL LÍMITE → suma diodos"
    print(f"   choque {I}A → flyback ~{Ifb:.0f}A promedio  | {ok}")

print("\n6) KICKBACK al cortar → clavado por el flyback")
print(f"   V_MOSFET ≈ Vsrc+Vf = {Vsrc+Vf:.1f} V  ·  IRL540N aguanta 100V → margen {100/(Vsrc+Vf):.0f}×  ✓")

print("\n"+"="*66)
print("VEREDICTO: el circuito con TUS piezas FUNCIONA a 12V para primer light y")
print("deposición gentil (≤~40A): funde en ms, flyback OK, MOSFET seguro (100V).")
print("LÍMITES: pulsos cortos (7mF) · 1 IRL solo a baja corriente/duty (Rds 44mΩ")
print("calienta) → 2-3 en paralelo para sostener · más caps para pulsos largos.")
print("="*66)
