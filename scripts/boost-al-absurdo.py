#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BOOST AL ABSURDO (idea del user 2026-06-06: "llevalo al maximo, al absurdo,
siempre es buena prueba"). Empujamos voltaje-con-frecuencia hasta que ALGO se
rompe -> eso revela el TECHO REAL y por que la arquitectura cap-dump es la correcta.
Todo el sensado = R + caps + ADC (minimo, como dijo el user).
"""
import numpy as np

Vin=12.0; L=15e-6
Rds=0.044; Rdcr=0.020; R_L=Rds+Rdcr      # parasita del lazo del boost (64mO)
Ciss=1700e-12                            # IRL540N gate cap
Rpull=470.0                              # pull-up del driver KSP2222A

print("="*72)
print("1) IDEAL vs REAL — el ideal dice INFINITO, la parasita lo COLAPSA")
print("="*72)
print("   V_out/Vin ideal = 1/(1-D).  REAL = (1/(1-D)) / (1 + R_L/((1-D)^2 R_carga))")
print("   Empujamos el duty AL ABSURDO con R_carga=1 ohm (tipo arco):")
Rload=1.0
print("   duty  | ideal  | REAL   | que pasa")
for D in [0.5,0.75,0.9,0.95,0.99,0.999]:
    x=1-D
    Mi=1/x
    Mr=(1/x)/(1+R_L/(x**2*Rload))
    nota="sube" if D<0.8 else ("PICO" if abs(Mr- (0.5*np.sqrt(Rload/R_L)))<0.3 else "COLAPSA (la parasita gana)")
    print(f"   {D:5.3f} | {Mi*Vin:6.0f}V| {Mr*Vin:6.1f}V | {nota}")
Dmax=1-np.sqrt(R_L/Rload); Mmax=0.5*np.sqrt(Rload/R_L)
print(f"   -> el REAL hace PICO en D={Dmax:.2f} y luego SE DESPLOMA. Ganancia max = {Mmax:.1f}x")
print(f"      = 1/2*sqrt(R_carga/R_L). MAS duty NO da mas voltaje: lo MATA. <-- el absurdo revela el techo")

print("\n"+"="*72)
print("2) EL ABSURDO UTIL: no puedes boostear a una carga BAJA (la junta directa)")
print("="*72)
print("   Ganancia maxima posible segun la carga (M_max = 0.5*sqrt(R_carga/R_L)):")
for nm,Rc in [("junta directa",0.006),("arco",1.0),("cargando un CAP (ligera)",10.0),("cap casi lleno",100.0)]:
    Mm=0.5*np.sqrt(Rc/R_L); Vm=Mm*Vin
    ok = "NO boostea (carga < parasita)" if Mm<1 else f"hasta ~{Vm:.0f}V"
    print(f"   {nm:24s} R={Rc*1e3:6.0f}mO -> M_max={Mm:4.1f}x -> {ok}")
print("   *** REVELACION: a la junta (6mO) el boost NO LLEGA (carga demasiado baja).")
print("   PERO a un CAP (carga ligera) SI sube a decenas de V. -> por eso la")
print("   arquitectura correcta es BOOST->CARGA EL CAP->DESCARGA (triac) en la junta.")

print("\n"+"="*72)
print("3) RESONANTE AL ABSURDO — kilovoltios y donde se rompe el AIRE")
print("="*72)
print("   tanque LC con cap CHICO: V_pico ~ Q*Vin = (Z0/R)*Vin, Z0=sqrt(L/C)")
air_break=3e6   # V/m  rigidez dielectrica del aire (~3kV/mm)
for C in [1e-6,1e-7,1e-8,1e-9]:
    Z0=np.sqrt(L/C); Q=Z0/0.1; Vpk=Q*Vin
    gap_break=Vpk/air_break*1e3
    print(f"   C={C*1e9:6.1f}nF -> Z0={Z0:6.1f}O Q={Q:5.0f} -> V_pico~{Vpk:7.0f}V (arquea {gap_break:.2f}mm de aire)")
print("   -> al absurdo el resonante hace MILES de V, pero: (a) se ARQUEA solo en el")
print("      aire/aislamiento, (b) el IRL540N MUERE arriba de 100V. El absurdo dice:")
print("      el resonante sirve para la CHISPA de ignicion (alto V, micro-energia),")
print("      NO para sostener (sin energia + revienta todo).")

print("\n"+"="*72)
print("4) FRECUENCIA AL ABSURDO — ripple vs perdidas vs el driver lento")
print("="*72)
print("   ripple de corriente en el choque: dI = Vin*D/(L*f).  D=0.5")
print("   y el driver KSP2222A+470O sube el gate en  t_rise ~ R*Ciss")
t_rise=Rpull*Ciss
print(f"   t_rise del gate (470O*1700pF) = {t_rise*1e6:.2f} us  <-- el cuello de botella")
print("   freq    | ripple dI | periodo | t_rise/periodo | veredicto")
for f in [1e3,1e4,5e4,1e5,5e5,2e6]:
    dI=Vin*0.5/(L*f); T=1/f; frac=t_rise/T
    if f<5e3: vd="ripple ENORME (choque chico)"
    elif frac>0.3: vd="driver MUY LENTO (perdidas, no conmuta limpio)"
    elif frac>0.1: vd="al limite del driver KSP"
    else: vd="OK"
    print(f"   {f/1e3:6.0f}kHz| {dI:6.1f}A  | {T*1e6:5.1f}us| {frac*100:5.0f}%        | {vd}")
print(f"   -> banda practica con TU driver: ~30-100kHz. Para mas, gate driver real")
print("      (pull-up bajo). Al absurdo (MHz) el KSP no alcanza = puro calor.")

print("\n"+"="*72)
print("5) ORDEN EN QUE SE ROMPEN LAS COSAS al subir el voltaje (el absurdo fisico)")
print("="*72)
limites=[("diodo MBR360G",60),("MOSFET IRL540N Vds",100),("caps 25V (los baratos)",25),
         ("caps 200V (los buenos)",200),("arqueo en aire ~1mm",3000)]
for nm,v in sorted(limites,key=lambda z:z[1]):
    print(f"   {v:5d} V  <- se rompe: {nm}")
print("   -> el PRIMER limite real es el cap de 25V, luego el MBR (60V). Con caps de")
print("      200V + cuidando el MBR, el techo practico es ~50V. Mas alla, MOSFET muere.")

print("\n"+"="*72)
print("VEREDICTO DEL ABSURDO:")
print(" * El boost NO da voltaje infinito: la parasita hace PICO y colapsa (M~2x a carga baja).")
print(" * NO se puede boostear directo a la junta (6mO) -> hay que CARGAR UN CAP y descargarlo.")
print(" * Resonante = kV para la CHISPA (ignicion), no para fundir (se arquea/revienta).")
print(" * Frecuencia practica ~30-100kHz (el driver KSP es el limite).")
print(" * Techo de voltaje practico ~50V (cap 200V + MBR 60V; el IRL aguanta 100).")
print(" SWEET SPOT: boost a ~36V sobre cap de 200V, ~50kHz, descarga por triac. Todo")
print(" el control/sensado = divisores R + RC + ADC. Minimo absoluto de piezas.")
print("="*72)
