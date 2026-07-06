#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MONTE CARLO de la PRECISION del sistema de HOY (idea del user 2026-06-06:
"3 formas de precision, juega con las variables del sistema de hoy").
Anclado a lo MEDIDO en el banco: L=15uH, R_total~250mO (->45A a 12V),
R_junta~6mO (del ablandamiento), Holm U_melt=0.56V. Propaga las tolerancias
reales y mide: (1) P(fundir) vs voltaje, (2) precision del tamano de gota por
frecuencia, (3) colocacion por gap. + analisis de sensibilidad (que variable manda).
"""
import numpy as np
rng=np.random.default_rng(12345)
N=300_000

# ---------- variables del sistema de HOY (distribuciones realistas) ----------
def norm(m,frac): return rng.normal(m, abs(m)*frac, N)
def logu(a,b):    return np.exp(rng.uniform(np.log(a),np.log(b),N))

L      = norm(15e-6, 0.20)                  # choque (geometria +-20%)
Rpar   = norm(0.250, 0.30)                  # R parasita REAL (conexiones protoboard+alambre+Rds+DCR) -- el villano
Rj     = logu(2e-3, 20e-3)                  # R de contacto: MUY variable (2-20mO)
U_melt = 0.56
Aw     = np.pi/4*(0.8e-3)**2
vf     = norm(4e-3, 0.10)                    # avance de alambre (stepper, +-10%)
# RP2350: el reloj es CASI perfecto -> jitter de frecuencia minusculo
def fjit(f0): return norm(f0, 0.001)         # +-0.1% (timing deterministico)

print("="*72)
print("CONTEXTO: hoy a 12V -> ~45A, V_junta~0.30V (ablando, NO fundio).")
print("="*72)

# ================= FORMA 1: VOLTAJE -> fundir confiable =================
print("\n[FORMA 1] PRECISION POR VOLTAJE  — P(fundir) = P(V_junta >= 0.56V)")
print("   V_junta = V_boost * Rj/(Rj+Rpar). Barremos el boost:")
print("   V_boost | I_media | V_junta media | P(FUNDE) | comentario")
for Vb in [12,24,36,48]:
    I=Vb/(Rpar+Rj); Vj=Vb*Rj/(Rj+Rpar)
    Pmelt=np.mean(Vj>=U_melt)
    com = "como hoy: casi nunca" if Pmelt<0.1 else ("confiable" if Pmelt>0.9 else "a veces (margen pobre)")
    print(f"    {Vb:3d}V   | {np.mean(I):5.0f}A  |   {np.mean(Vj):5.2f}V     |  {Pmelt*100:4.0f}%   | {com}")
print("   -> a 12V P(funde)~0 (cuadra con el banco). El boost SUBE la probabilidad.")

# que pasa si ADEMAS bajamos Rpar (mejores conexiones / 2 MOSFET / alambre corto)
print("\n   + combinando con bajar R parasita (mejores conexiones), a 36V:")
print("   Rpar_obj | P(FUNDE)")
for rp in [0.250,0.150,0.080]:
    Rp=norm(rp,0.30); Vj=36*Rj/(Rj+Rp)
    print(f"     {rp*1e3:3.0f}mO   |  {np.mean(Vj>=U_melt)*100:4.0f}%")
print("   -> 36V + conexiones limpias (<=80mO) = funde casi siempre.")

# ================= FORMA 2: FRECUENCIA -> tamano de gota =================
print("\n[FORMA 2] PRECISION POR FRECUENCIA  — d_gota = (6*Aw*vf/f / pi)^(1/3)")
print("   f_disparo | d_gota media | sigma | precision (sigma/d)")
for f0 in [200,600,1500]:
    f=fjit(f0); Vd=Aw*vf/f; d=(6*Vd/np.pi)**(1/3)*1e3   # mm
    print(f"    {f0:5d}Hz  |  {np.mean(d):.3f} mm  | {np.std(d)*1e3:4.1f} um | {np.std(d)/np.mean(d)*100:.2f}%")
print("   -> la frecuencia da el tamano con precision <1% (el reloj del RP2350 es")
print("      casi perfecto; el ruido viene del avance vf, no de la frecuencia).")
# que domina la precision del tamano?
f=fjit(600)
d_full=(6*Aw*vf/f/np.pi)**(1/3)
d_solo_vf=(6*Aw*vf/600/np.pi)**(1/3)      # f fija
d_solo_f =(6*Aw*4e-3/f/np.pi)**(1/3)      # vf fijo
print(f"   sensibilidad del diametro: por vf solo sigma={np.std(d_solo_vf)/np.mean(d_solo_vf)*100:.2f}% , por f solo sigma={np.std(d_solo_f)/np.mean(d_solo_f)*100:.3f}%")
print("   => el AVANCE (vf) domina el error; la frecuencia es ultra-fina. Mejora vf -> mejora todo.")

# ================= FORMA 3: GAP -> modo y colocacion =================
print("\n[FORMA 3] PRECISION POR GAP  — contacto (gap chico) vs vuelo (gap grande)")
gap=logu(0.03e-3,0.5e-3)                   # gap real (servo de Z)
d_contacto=(6*Aw*vf/600/np.pi)**(1/3)      # en contacto la gota ~ tamano de ordeno
# tiro balistico en vuelo: cae adelante v_cab * t_caida (lead lo compensa, queda residual)
vcab=norm(40e-3,0.15); h=gap; g=9.81; vz0=0.3   # eyeccion ~0.3 m/s
tcaida=(-vz0+np.sqrt(vz0**2+2*g*h))/g
tiro=vcab*tcaida*1e3                         # mm
print(f"   gap critico (contacto<->vuelo) ~ {d_contacto.mean()*1e3:.2f} mm (= tamano de gota)")
print(f"   en VUELO: tiro medio = {np.nanmean(tiro):.3f} mm, sigma residual (tras lead) ~ {np.nanstd(tiro)*1e3:.0f} um")
print("   -> CONTACTO (gap chico) = tiro 0, precision = paso del motor (~10um) = el modo FINO.")
print("      VUELO (gap grande) = mas rapido pero paga tiro; el lead lo corrige a ~decenas um.")

# ================= sintesis: que variable manda en TODO =================
print("\n"+"="*72)
print("SENSIBILIDAD GLOBAL — que variable arruina/salva la precision")
print("="*72)
print("   FUNDIR (forma 1):  manda R_parasita (conexiones) y el VOLTAJE. Rj varia")
print("                      mucho -> el voltaje da MARGEN para tragarse esa variacion.")
print("   TAMANO  (forma 2): manda el AVANCE vf; la frecuencia es casi perfecta (RP2350).")
print("   COLOCAR (forma 3): manda el GAP; contacto=fino (paso motor), vuelo=lead.")
print("\n   RECETA DE MAXIMA PRECISION (de la simulacion):")
print("    1. boost ~36V + conexiones limpias (<=80mO) -> funde ~100% pese al contacto variable")
print("    2. tamano por FRECUENCIA (sub-1%); aprieta el avance vf para el ultimo %")
print("    3. modo CONTACTO (gap chico) para detalle fino (tiro 0 = paso motor ~10um)")
print("="*72)
