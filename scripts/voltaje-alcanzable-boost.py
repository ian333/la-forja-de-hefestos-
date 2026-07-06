#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VOLTAJE ALCANZABLE de manera inteligente (idea del user, 2026-06-06):
"es frecuencia, podemos recircular?" -> SI. No compras 24V: los GENERAS de los
12V con un convertidor BOOST (choque + MOSFET + diodo + cap, que YA tienes).
La FRECUENCIA/duty es la perilla del voltaje. Tambien analizo la recirculacion
resonante (tanque LC, gain=Q) y la trifasica (interleaved).
"""
import numpy as np

Vin=12.0; L=15e-6; C=7e-3          # tus piezas reales
Vds_mosfet=100.0; Vd_diode=60.0    # IRL540N=100V, MBR360G=60V (limites)

print("="*70)
print("1) BOOST: V_out = Vin/(1-D)  — la FRECUENCIA/duty SUBE el voltaje")
print("="*70)
print("   (conmutas el choque a tierra con duty D; al abrir, el choque 'patea'")
print("    hacia el cap de salida por el diodo -> se acumula voltaje)")
print("   duty D | V_out | I_out/I_in | nota")
for D in [0.0,0.33,0.5,0.66,0.75,0.85]:
    Vout=Vin/(1-D) if D<1 else 9999
    ratio=(1-D)
    nota=""
    if Vout>Vd_diode*0.9: nota="(MBR 60V al limite)"
    if Vout>Vds_mosfet*0.8: nota="(IRL 100V al limite!)"
    print(f"   {D:4.2f}  | {Vout:5.1f}V |   {ratio:4.2f}     | {nota}")
print("   -> con SOLO cambiar el duty pasas de 12V a 24/36/48V. La fuente igual.")
print(f"   LIMITES de tus piezas: MBR360G 60V -> V_out util <= ~{Vd_diode*0.8:.0f}V")
print("   OJO: boost CAMBIA corriente por voltaje (potencia se conserva):")
print("        I_out = I_in*(1-D). A 36V (D=0.66) la I de salida es ~1/3 de la de entrada.")

print("\n"+"="*70)
print("2) LA JUGADA INTELIGENTE: cargar el CAP a alto V y DESCARGARLO (punetazo)")
print("="*70)
# boost carga el cap LENTO (poca corriente), el cap GUARDA energia, y la sueltas
# de golpe en la junta/arco (alta potencia breve). Energia = 1/2 C V^2.
E_melt=2.3   # J para fundir una gotita (peor caso; el spot funde con mucho menos)
print(f"   energia para fundir una gota ~ {E_melt:.1f} J (spot real: mucho menos)")
print("   V_cap | energia 1/2 C V^2 | gotas que alcanza | I_pico al soltar (loop 0.1O, arco 14V)")
for Vc in [12,24,36,48]:
    E=0.5*C*Vc**2
    Ipk=max(0.0,(Vc-14.0))/0.1     # corriente de descarga contra la caida de arco
    print(f"   {Vc:3d}V | {E:5.1f} J          |   {E/E_melt:4.1f}x        | {Ipk:5.0f} A")
print("   -> a 36V el cap guarda ~4.5J = de sobra para fundir, y suelta ~220A de")
print("      punetazo. El boost lo recarga LENTO entre gotas (la fuente no sufre).")
# tiempo de recarga del cap por el boost
Pin=12*5.0   # fuente dando ~5A a 12V = 60W
for Vc in [24,36]:
    E=0.5*C*Vc**2; t=E/Pin
    print(f"      recargar a {Vc}V (a 60W de entrada): ~{t*1e3:.0f} ms -> ~{1/t:.0f} gotas/s")

print("\n"+"="*70)
print("3) RECIRCULACION RESONANTE (tu idea 'recircular'): gain = Q")
print("="*70)
# tanque LC: la energia recircula L<->C a alto Q, la fuente solo paga perdidas;
# el voltaje sube por Q.  Z0=sqrt(L/C), Q=Z0/R, f0=1/(2pi sqrt(LC)), V_pico~Q*Vin
f0=1/(2*np.pi*np.sqrt(L*C)); Z0=np.sqrt(L/C)
print(f"   con TU L=15uH y C=7mF:  f0={f0:.0f} Hz, Z0={Z0*1e3:.0f} mO")
for R in [0.1,0.046,0.01]:
    Q=Z0/R
    print(f"      R_carga={R*1e3:4.0f}mO -> Q={Q:4.1f} -> gain de voltaje ~{Q:.1f}x  {'(sin gain, cap muy grande)' if Q<1 else ''}")
print("   -> con el cap GRANDE (7mF) Z0 es chico -> Q<1 -> NO hay gain resonante.")
print("   Para gain resonante necesitas un cap CHICO (sube Z0):")
for Cs in [1e-6,0.1e-6]:
    Z0s=np.sqrt(L/Cs); f0s=1/(2*np.pi*np.sqrt(L*Cs)); Q=Z0s/0.1
    print(f"      C={Cs*1e6:5.2f}uF -> Z0={Z0s:5.1f}O, f0={f0s/1e3:.0f}kHz, Q@0.1O={Q:.0f} -> V_pico~{Q*Vin:.0f}V (pero poca energia)")
print("   => RESONANTE = mucho VOLTAJE para ENCENDER el arco (chispa de ignicion),")
print("      poca energia. BOOST+cap grande = VOLTAJE + ENERGIA para fundir.")
print("      Combo ideal: resonante enciende el arco, boost/cap lo sostiene.")

print("\n"+"="*70)
print("4) TRIFASICA / multi-fase (tu pregunta)")
print("="*70)
print("""   Dos lecturas:
   a) Si tienes 3-FASES de RED: rectificada da ~variable alto (peligroso/overkill
      para esto). Mejor un trafo+rectificador a 24-48V si quieres mas potencia.
   b) BOOST INTERLEAVED (3 fases de boost desfasadas 120 deg): 3 choques + 3 MOSFET
      conmutando alternados -> corriente de salida 3x mas suave, menos ripple,
      reparte el calor entre 3 MOSFET. Es ESCALAR el boost, no genera mas voltaje.
   -> No lo necesitas para arrancar. Empieza con 1 fase de boost a 24-36V.""")

print("\n"+"="*70)
print("VEREDICTO: tu intuicion es correcta. Voltaje alcanzable SIN comprar fuente:")
print("  * BOOST con tu choque+MOSFET+diodo: 12V -> hasta ~48V (limite MBR 60V).")
print("  * Carga el cap a ~36V (4.5J) y DESCARGALO en la junta = punetazo de ~220A.")
print("  * La FRECUENCIA/duty es la perilla; la fuente solo repone perdidas (recircula).")
print("  FALTA HW: caps de >=50V para la salida (los de 25V NO; tus 200V/2200uF SI),")
print("  y el RP2350 ya puede generar el PWM del boost. Es el 'buck de fusion' al reves.")
print("="*70)
