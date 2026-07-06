#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
¿LA GOTA ESTÁ SIEMPRE EN CONTACTO? — el GAP manda el régimen.
La gota crece en la punta; cuelga ~su diámetro. Hay una CARRERA:
  • si crece hasta TOCAR la superficie (d ≥ gap) ANTES de soltarse → PUENTE
    (corto-circuito, latigazo): transferencia POR CONTACTO, tiro = 0, precisa.
  • si el ordeño la suelta (a d_objetivo) ANTES de tocar → VUELO LIBRE: tiro
    balístico = v_cabezal·t_caída.
El gap crítico = el tamaño de gota del ordeño. CON GAP CHICO la gota SIEMPRE
está en contacto y el gap FIJA su tamaño → control total. El RP2350 SENSA el
puente por R=V/I (cae de golpe al tocar) y servocontrola el gap. controlemos las gotas.
"""
import numpy as np
rho=7000.; Aw=np.pi/4*(0.8e-3)**2; g=9.81; Rcont=20e-3; Varc=18.0
def d_ordeno(f,vf): return (6*Aw*vf/(np.pi*f))**(1/3)          # tamaño si VUELA (ordeño)
def cad_contacto(gap,vf): return 6*Aw*vf/(np.pi*gap**3)        # cadencia si toca a d=gap
def tfall(h,vz0=0.3): return (-vz0+np.sqrt(vz0*vz0+2*g*h))/g

vf=4e-3; f=600.; dt=d_ordeno(f,vf)
print("="*68)
print(f"Ordeño: v_f={vf*1e3:.0f}mm/s, f_disparo={f:.0f}Hz → si VUELA, d={dt*1e3:.3f}mm")
print(f"GAP CRÍTICO = {dt*1e3:.3f}mm  →  gap menor = CONTACTO ; gap mayor = VUELO")
print("="*68)
print("  gap[mm] | régimen  | d_gota[mm] | cadencia[Hz] | tiro@60mm/s | precisión")
for gmm in [0.05,0.10,0.15,0.186,0.30,0.50]:
    gap=gmm*1e-3
    if gap < dt:   # toca antes de soltarse → CONTACTO; el gap fija el tamaño
        d=gap; cad=cad_contacto(gap,vf); tiro=0.0
        reg="CONTACTO"; prec="exacta (=paso motor ~0.01mm)"
    else:          # vuela
        d=dt; cad=f; tiro=60e-3*tfall(gap)*1e3
        reg="VUELO  "; prec=f"±{60e-3*abs(((0.3/np.sqrt(0.3**2+2*g*gap))-1)/g)*0.1*1e3:.3f}mm (disp.)"
    print(f"   {gmm:4.2f}  | {reg} |   {d*1e3:5.3f}   |   {cad:6.0f}    |   {tiro:4.2f}mm   | {prec}")

print("\n"+"="*68)
print("LA SEÑAL DE CONTACTO (R=V/I) — el RP2350 ve el puente como un ESCALÓN")
print("="*68)
print("  estado            | corriente | R medido  | qué decide el RP2350")
print(f"  gap abierto (arco)| baja      | ~{Varc:.0f}V/i = ALTA | aún no toca → sigue creciendo")
print(f"  PUENTE (toca)     | sube      | ~{Rcont*1e3:.0f} mΩ (BAJA)| ¡contacto! → dispara pinch (transfiere)")
print("  tras soltar       | →0        | →∞         | gota colocada → retrae/avanza, repite")
print("  → el salto R alto→bajo→alto = un latido por gota. Servar el gap = control total.")

print("\n"+"="*68)
print("CONTROL DE GAP (el RP2350 lo mantiene con el sensado R) — el gap MANDA:")
print("="*68)
print("  • gap CHICO (<0.1mm): gotas chiquitas EN CONTACTO, alta cadencia, tiro 0,")
print("    precisión = paso del motor (~0.01mm). MODO FINO / superficie.")
print("  • gap MEDIO (~d_ordeño): frontera; mezcla.")
print("  • gap GRANDE (>d_ordeño): VUELO libre → más rápido para rellenar/puentear,")
print("    pero paga tiro balístico (compensable con lead). MODO RELLENO / overhang.")
print("\n  RESPUESTA: NO está siempre en contacto — DEPENDE DEL GAP. Pero TÚ eliges:")
print("  con gap chico la mantienes SIEMPRE en contacto → el gap fija tamaño Y posición")
print("  → el modo MÁS PRECISO. El RP2350 servocontrola el gap por R=V/I. controlemos las gotas. ✅")
print("="*68)
