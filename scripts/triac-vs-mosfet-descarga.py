#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TRIAC vs MOSFET para la DESCARGA (pregunta del user 2026-06-06: "que triacs o
IRL usar, cual tiene menos resistencia"). Comparamos para el switch de descarga
del cap (el punetazo a la junta) y para el switch del BOOST.
"""
import numpy as np

print("="*72)
print("DOS switches DISTINTOS en la maquina — piden cosas distintas:")
print("="*72)
print("  BOOST  : conmuta ~50kHz, debe APAGAR a voluntad y rapido -> MOSFET (triac NO).")
print("  DESCARGA: suelta el cap de golpe en la junta -> triac O mosfet (analizamos).")

# --- modelos de caida ---
# MOSFET: V = I*Rds (resistivo puro). TRIAC/SCR: V = Von + I*Rdyn (codo + dinamica).
print("\n"+"="*72)
print("1) CAIDA y PERDIDA al pasar el punetazo (I de descarga)")
print("="*72)
disp = {
 "IRL540N (1)":    ("mosfet", 0.044),
 "IRL540N (x3)":   ("mosfet", 0.044/3),
 "IRLB3034 (bajo)":("mosfet", 0.0017),     # ejemplo de mosfet ultra-bajo Rds
 "Triac BTA41":    ("triac", 1.3, 0.010),  # Von~1.3V, Rdyn~10mO
 "Triac BT136":    ("triac", 1.5, 0.030),
 "SCR generico":   ("scr",   1.2, 0.012),
}
print("   dispositivo      | a 100A: Vdrop | P_disip | a 220A: Vdrop | P_disip")
for nm,d in disp.items():
    if d[0]=="mosfet":
        f=lambda I: (I*d[1], I*I*d[1])
    else:
        f=lambda I: (d[1]+I*d[2], (d[1]+I*d[2])*I)
    v1,p1=f(100); v2,p2=f(220)
    print(f"   {nm:16s} | {v1:5.2f}V {p1:6.0f}W | {v2:5.2f}V {p2:6.0f}W")
print("   -> MOSFET de bajo Rds: caida ~lineal, casi 0 a baja I. TRIAC: codo FIJO")
print("      ~1.2-1.5V que NO baja -> a la junta le ROBA ~1.3V (de tus 36V) siempre.")

# --- impacto en V_junta (lo que importa para fundir, Holm 0.55V) ---
print("\n"+"="*72)
print("2) IMPACTO en V_junta (el codo del triac se COME parte del voltaje de fusion)")
print("="*72)
Vcap=36.0; Rloop=0.060; Rj=0.010   # cap 36V, lazo 60mO, junta 10mO
print("   switch        | V que llega a la junta tras el switch | comentario")
for nm,d in disp.items():
    if d[0]=="mosfet":
        Rsw=d[1]; Vsw_drop=0.0
    else:
        Rsw=d[2]; Vsw_drop=d[1]
    I=(Vcap-Vsw_drop)/(Rsw+Rloop+Rj)
    Vj=I*Rj
    print(f"   {nm:16s} | I={I:4.0f}A  V_junta={Vj:.2f}V {'(funde)' if Vj>=0.55 else '(NO)'} | drop switch {Vsw_drop:.1f}V")
print("   -> con 36V el triac AUN funde (el codo de 1.3V es chico vs 36V). A 12V el")
print("      codo del triac SI dolía. Conclusion: a alto voltaje el triac SIRVE.")

# --- veredicto practico ---
print("\n"+"="*72)
print("3) VEREDICTO — que usar y por que")
print("="*72)
print("""   BOOST (50kHz): MOSFET, sin discusion. El IRL540N que tienes SIRVE
      (logic-level, 100V). Si consigues uno de Rds bajo (IRLB3034, IRL7833,
      IRFZ44 ~17mO) calienta menos. El triac NO puede (no apaga en DC rapido).

   DESCARGA (punetazo a la junta) — 2 opciones validas:
     * TRIAC/SCR (BTA41, BT151, TYN): MAS SIMPLE. Se dispara y se APAGA SOLO
       cuando el pulso decae. Aguanta surge enorme (BTA41=420A). Caida fija
       ~1.3V (despreciable a 36V). IDEAL para empezar / cap-dump. << recomendado p/arrancar
     * MOSFET de bajo Rds: si quieres CONTROLAR la forma del pulso (modular el
       tamano de gota, cortar a media descarga = latigazo fino). Menos perdida,
       pero TU lo apagas (mas firmware). << para el control fino despues

   'CUAL TIENE MENOS RESISTENCIA': el MOSFET de bajo Rds (mΩ) gana en resistencia
   pura; el triac tiene un CODO fijo (~1.3V) que a alta I es como ~6-13mΩ
   equivalente a 100-220A. A 36V ambos funden; el triac es mas simple y robusto.

   REGLA: para el primer punetazo usa TRIAC (simple, robusto, se auto-apaga).
   Para modular la gota despues, pasa a MOSFET en la descarga.""")

print("\n"+"="*72)
print("QUE BUSCAR en tu caja (orden de preferencia):")
print("="*72)
print("  BOOST:     MOSFET N-ch logic-level, Vds>=60V, Rds bajo. (IRL540N ya sirve;")
print("             mejor IRLB3034/IRL7833/IRLZ44 si aparecen).")
print("  DESCARGA:  TRIAC/SCR de alto surge: BTA41, BTA24, BT151, TYN612, 2N6509.")
print("             (cualquiera >=400V/>=12A RMS aguanta el cap-dump de ms).")
print("  Si solo hay triacs chicos (BT136): sirven para gotas chicas (menos surge).")
print("="*72)
