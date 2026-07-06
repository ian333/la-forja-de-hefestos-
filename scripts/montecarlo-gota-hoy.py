#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MONTE CARLO de la GOTA de HOY (idea del user 2026-06-06): tirar datos sobre las
energías REALES medidas hoy y armar una teoría del TAMAÑO de gota. El ángulo NO se
midió hoy -> se MODELA aparte (teórico, etiquetado). Honesto: tamaño anclado en
datos; ángulo = predicción.
"""
import numpy as np
rng = np.random.default_rng(2026)
N = 300_000

# ===================== DATOS REALES de hoy (energías por tack, mJ) ===========
# de los lotes medidos: descargas reales 66..2072 mJ, los fuertes ~2J (cap lleno 44V)
E_reales_mJ = [66,140,297,945,1219,1219,1712,2003,2039,2047,2049,2055,2072,2079,838,364,225,438,638]
E_mean = np.mean(E_reales_mJ); E_std = np.std(E_reales_mJ)
print("="*70)
print(f"DATOS REALES de hoy: {len(E_reales_mJ)} tacks · energía {E_mean:.0f}±{E_std:.0f} mJ "
      f"(rango {min(E_reales_mJ)}-{max(E_reales_mJ)})")
print("="*70)

# ===================== FÍSICA del acero =====================================
rho=7850.; cp=600.; Hf=270e3; dT=1500.   # acero: dens, calor esp, calor fusión, salto T
E_por_kg = cp*dT + Hf                       # J para fundir 1 kg desde frío
print(f"Energía para fundir acero: {E_por_kg/1e6:.2f} MJ/kg")

# ===================== MONTE CARLO del TAMAÑO ===============================
# incertidumbres REALES (no medidas, se propagan):
E   = rng.choice(E_reales_mJ, N)*1e-3 * (1+rng.normal(0,0.05,N))   # energía soltada [J]
eta = rng.uniform(0.05, 0.30, N)           # eficiencia de fusión (cuánta E funde metal)
fdep= rng.uniform(0.30, 0.70, N)           # fracción que se DEPOSITA (resto: spatter/vuelve)
m_fund = E*eta / E_por_kg                   # masa fundida [kg]
m_dep  = m_fund * fdep                       # masa depositada [kg]
V = m_dep/rho                                # volumen [m³]
d_mm = (6*V/np.pi)**(1/3)*1e3                # diámetro de la gota [mm]

print("\n"+"="*70)
print("TEORÍA del TAMAÑO de la gota de hoy (MC, anclado en datos reales)")
print("="*70)
print(f"   diámetro de gota:  {np.mean(d_mm):.3f} mm  (mediana {np.median(d_mm):.3f})")
print(f"   rango 5%-95%:      {np.percentile(d_mm,5):.3f} - {np.percentile(d_mm,95):.3f} mm")
print(f"   masa por gota:     {np.mean(m_dep)*1e6:.3f} mg")
print(f"   en micras:         {np.mean(d_mm)*1000:.0f} µm")
print(f"   -> NO son 0.01mm (10µm); la física + los datos dan ~{np.mean(d_mm)*1000:.0f} µm")
print(f"      (10µm exigiría eficiencia ~0.0003% = absurdo con 2J). Las 'micro-gotas")
print(f"      ultra pequeñas' que viste son ~{np.percentile(d_mm,5)*1000:.0f}-{np.percentile(d_mm,95)*1000:.0f} µm = visibles pero diminutas. CUADRA.")

# ¿qué domina la incertidumbre del tamaño?
import numpy as _np
def corr(x): return _np.corrcoef(x, d_mm)[0,1]
print(f"\n   sensibilidad (qué controla el tamaño):")
print(f"     energía:   corr {corr(E):+.2f}")
print(f"     eficiencia:corr {corr(eta):+.2f}")
print(f"     f_depós.:  corr {corr(fdep):+.2f}")
print("   -> los 3 importan; el tamaño se controla con la ENERGÍA (la perilla que ya dominas).")

# ===================== MODELO del ÁNGULO (TEÓRICO, no medido) ===============
print("\n"+"="*70)
print("ÁNGULO de eyección — MODELO TEÓRICO (no se midió hoy; predicción)")
print("="*70)
# la gota se eyecta por el pinch (axial al alambre) + la asimetría del arco la desvía
# + gravedad durante el vuelo. Modelo: desviación del eje ~ asimetría del punto de arco.
theta_axial = 0.0                            # eyección ideal: a lo largo del alambre
asim = rng.normal(0, 8.0, N)                 # desviación por asimetría del arco/contacto [°] (supuesto)
# si el alambre está vertical y la gota se eyecta hacia abajo, la gravedad no cambia el ángulo de salida
theta = theta_axial + asim
print(f"   SI la eyección sigue el eje del alambre + asimetría del arco ~±8°:")
print(f"     ángulo de salida: {np.mean(theta):.1f}° ± {np.std(theta):.1f}°  (respecto al eje del alambre)")
print(f"   Tu hipótesis de '15° del arco' ES PLAUSIBLE si la asimetría del arco")
print(f"   (siempre del mismo lado por la geometría del contacto) sesga la eyección.")
print(f"   -> PERO esto es MODELO, no dato. Para confirmarlo: medir con cámara/regla")
print(f"      el punto de caída vs el eje. Si SIEMPRE cae al mismo ángulo = teoría correcta.")

print("\n"+"="*70)
print("LA TEORÍA (honesta):")
print(f"  TAMAÑO (de datos): gota ~{np.mean(d_mm)*1000:.0f}µm ({np.mean(d_mm):.2f}mm), controlable por energía. ✓ anclado")
print(f"  ÁNGULO (modelo):   ~asimetría del arco; plausible un ángulo FIJO si la")
print(f"                     geometría del contacto es constante. ✗ falta medirlo")
print(f"  SIGUIENTE para el ángulo: una foto/video del disparo + regla -> lo cuantificamos.")
print("="*70)
