#!/usr/bin/env python3
"""10 · Estado del arte y seguridad: cálculos que respaldan docs/investigacion-arco/10-estado-del-arte-seguridad.md

Todo lo de aquí es aritmética con supuestos declarados. Fuentes de cada número de entrada: ver el reporte §8.
Corre con: python3 scripts/investigacion-arco/10_estado_del_arte_seguridad.py > scripts/investigacion-arco/10_estado_del_arte_seguridad.out
"""
import math

pi = math.pi
print("=" * 78)
print("10 · ESTADO DEL ARTE + SEGURIDAD — números")
print("=" * 78)

# ---------------------------------------------------------------------------
# 1. Cuánto metal se funde (alambre Truper MICRO-1 E71T-GS 0.8 mm)
# ---------------------------------------------------------------------------
d_w = 0.8e-3            # m
rho = 7000.0            # kg/m^3 (canon; el alambre tubular real es algo menos denso: supuesto)
v_f = 3.0 / 60.0        # m/s (3 m/min, canon campanazo)
A_w = pi * (d_w / 2) ** 2
Qv = A_w * v_f          # m^3/s
mdot = Qv * rho         # kg/s
print("\n[1] Fusión de alambre a 3 m/min")
print(f"  área alambre           = {A_w*1e6:.4f} mm²")
print(f"  volumen                = {Qv*1e9:.2f} mm³/s")
print(f"  masa                   = {mdot*1e3:.3f} g/s = {mdot*3600:.3f} kg/h (arco encendido continuo)")
a_drop = 0.4526e-3
V_drop = 4 / 3 * pi * a_drop ** 3
print(f"  gota canon a=0.4526 mm: V = {V_drop*1e9:.4f} mm³; 75 gotas/s = {75*V_drop*1e9:.2f} mm³/s (cuadra con el alambre ±16 %)")

# ---------------------------------------------------------------------------
# 2. Humo: escenarios (FCAW-S es el proceso de arco con MÁS humo por kg)
# ---------------------------------------------------------------------------
# FFR = fracción de la masa de alambre que sale como humo. Literatura: FCAW-S hasta 97 mg/s a corriente alta
# (Moisa/Rau, U. Oradea) vs MAG sólido 2-12 mg/s; ranking TWI: FCAW-S es el mayor emisor. Sin dato g/kg verificado
# para E71T-GS a 40-70 A -> se barre 0.5-3 %.
# Mn en el humo: 1.75 % (autoprotegido, Aerosol Sci. Technol. 2009) ... 9.1 % (otros FCAW) -> se barre 2/5/10 %.
# F en el humo: sin dato para E71T-GS; el alambre trae CaF2 < 6 % (SDS Forney E71T-GS) -> se barre 5/10/15 %.
lim_Mn = {"ACGIH TLV resp 0.02": 0.02, "ACGIH TLV inhal 0.1": 0.1, "NOM-010 VLE-PPT 0.2": 0.2,
          "NIOSH REL 1.0": 1.0, "OSHA PEL techo 5": 5.0}
lim_F = 2.5  # mg/m3 como F (OSHA PEL, ACGIH TLV)
print("\n[2] Humo y caudal de DILUCIÓN necesario para estar en el límite (arco continuo, todo el humo al cuarto)")
print("  FFR  Mn%  fume mg/s  Mn mg/h | Q (m³/h) para: " + " | ".join(lim_Mn.keys()))
rows = []
for ffr in (0.005, 0.01, 0.02, 0.03):
    G_fume = mdot * ffr * 1e6  # mg/s
    for mn in (0.02, 0.05, 0.10):
        G_mn_h = G_fume * mn * 3600  # mg/h
        Qs = [G_mn_h / L for L in lim_Mn.values()]
        rows.append((ffr, mn, G_fume, G_mn_h, Qs))
        print(f"  {ffr*100:3.1f}% {mn*100:4.1f}  {G_fume:8.2f}  {G_mn_h:8.1f} | " + " | ".join(f"{q:10.0f}" for q in Qs))
print("  Fluoruros (como F), límite 2.5 mg/m³:")
for ffr in (0.01, 0.03):
    G_fume = mdot * ffr * 1e6
    for fF in (0.05, 0.10, 0.15):
        G_F_h = G_fume * fF * 3600
        print(f"   FFR {ffr*100:.0f}%  F {fF*100:4.1f}% -> {G_F_h:7.1f} mg/h -> Q = {G_F_h/lim_F:7.1f} m³/h")

# escenario central
ffr_c, mn_c = 0.01, 0.05
G_fume_c = mdot * ffr_c * 1e6
G_mn_c = G_fume_c * mn_c * 3600
print(f"\n  ESCENARIO CENTRAL: FFR 1 %, Mn 5 % -> humo {G_fume_c:.2f} mg/s ({G_fume_c*3.6:.1f} g/h), Mn {G_mn_c:.0f} mg/h")
print(f"   dilución para ACGIH resp 0.02: {G_mn_c/0.02:,.0f} m³/h ; para NOM 0.2: {G_mn_c/0.2:,.0f} m³/h")

# Cuarto cerrado: concentración en estado estacionario y TWA de 8 h con poco arco
print("\n[3] Cuarto de 3×3×2.5 m = 22.5 m³, solo ventilación general (escenario central)")
Vroom = 22.5
for ach in (0.5, 2, 10, 20):
    Q = ach * Vroom
    C = G_mn_c / Q
    tau = Vroom / Q * 60
    print(f"  {ach:4.1f} renov/h (Q={Q:5.0f} m³/h): C_Mn estacionaria = {C:7.3f} mg/m³ = {C/0.02:6.1f}× ACGIH, {C/0.2:5.2f}× NOM ; τ = {tau:5.1f} min")
print("  TWA 8 h si el arco está encendido solo t_on min/día (C·t_on/480), con 2 renov/h:")
C2 = G_mn_c / (2 * Vroom)
for ton in (5, 15, 30, 60):
    print(f"   t_on {ton:3d} min -> TWA = {C2*ton/480:6.3f} mg/m³ = {C2*ton/480/0.02:5.1f}× ACGIH resp")

# Eficiencia de captura necesaria
print("\n[4] Captura en la fuente: fracción que escapa (1-η) que el cuarto aguanta")
for Qroom in (45, 300):
    for L, name in ((0.02, "ACGIH 0.02"), (0.2, "NOM 0.2")):
        frac = Qroom * L / G_mn_c
        print(f"  cuarto Q={Qroom:3d} m³/h, límite {name}: escape permitido = {min(frac,1)*100:6.2f} % -> η ≥ {max(0,1-frac)*100:6.2f} %")

# ---------------------------------------------------------------------------
# 5. Campana (Dalla Valle, ACGIH) vs caja con extracción
# ---------------------------------------------------------------------------
print("\n[5] Campana redonda Ø100 mm, Q = V·(10X²+A) (plana); con brida ×0.75")
D = 0.10
A = pi * D ** 2 / 4
for V in (0.5, 1.0):
    for X in (0.05, 0.10, 0.15, 0.20):
        Q = V * (10 * X ** 2 + A)
        print(f"  V={V:.1f} m/s X={X*100:4.0f} cm: Q = {Q*3600:6.0f} m³/h (plana) / {0.75*Q*3600:6.0f} m³/h (con brida)")
print("  -> la captura cae con X²: a 20 cm hace falta 10× el caudal que a 5 cm; y una campana abierta captura ~50-90 %, no 99 %.")

print("\n[6] CAJA cerrada sobre el banco (60×40×40 cm) con entradas de aire pequeñas")
Vbox = 0.6 * 0.4 * 0.4
for A_open_cm2, v_face in ((100, 1.0), (150, 1.0), (300, 0.5)):
    Aop = A_open_cm2 * 1e-4
    Q = Aop * v_face
    print(f"  entradas {A_open_cm2:3d} cm² a {v_face} m/s -> Q = {Q*3600:5.0f} m³/h ; recambio de la caja cada {Vbox/Q:4.1f} s")
Qfan = 150 / 3600
print(f"  ventilador 150 m³/h: recambio de la caja cada {Vbox/Qfan:4.1f} s")
for A_open_cm2 in (100, 150):
    print(f"  E2: 150 m³/h por {A_open_cm2} cm² de entradas -> v = {Qfan/(A_open_cm2*1e-4):4.1f} m/s (predicción de la prueba de humo)")
P_arc = 800.0  # W (40 A × 20 V), todo a la caja como peor caso
dT = P_arc / (1.2 * 1005 * Qfan)
print(f"  ventilador 150 m³/h: ΔT aire de salida con {P_arc:.0f} W = {dT:.1f} K")
for Dd in (0.075, 0.100):
    v = Qfan / (pi * Dd ** 2 / 4)
    print(f"  ducto Ø{Dd*1000:.0f} mm a 150 m³/h: {v:4.1f} m/s (ACGIH sugiere ~10 m/s para humo de soldadura)")

# ---------------------------------------------------------------------------
# 7. Eléctrico
# ---------------------------------------------------------------------------
print("\n[7] Eléctrico")
for Vdc in (48, 56, 67):
    for R, tag in ((1000, "mano mojada ~1 kΩ"), (2625, "seco ~2.6 kΩ")):
        print(f"  {Vdc:2d} V DC, {tag:18s}: I = {Vdc/R*1000:5.1f} mA")
print("  (48-56 V = rango de ajuste LRS-1200-48; 57-67 V = disparo de su OVP: una falla PUEDE pasar de 60 V)")
for C in (1e-3, 4.7e-3, 10e-3):
    print(f"  banco de capacitores {C*1e3:4.1f} mF a 56 V: E = {0.5*C*56**2:6.1f} J")
L = 41e-6
for I in (40, 70):
    print(f"  choque 41 µH a {I} A: E = {0.5*L*I**2*1000:6.1f} mJ")
P_out = 1200
eff = 0.94
for Vac in (220, 230):
    print(f"  entrada LRS a {Vac} VAC, 1200 W, η 94 %, FP 0.95: I_AC ≈ {P_out/eff/0.95/Vac:4.2f} A (datasheet: 7 A típ. a 230 V); arranque 60 A")
print(f"  corto en la salida: la LRS limita a 150 % = {1.5*25:.1f} A y se apaga a los 5 s (re-encender para recuperar)")

# ---------------------------------------------------------------------------
# 8. UV
# ---------------------------------------------------------------------------
print("\n[8] UV: tiempo permitido por día (Nakashima 2016: 0.23-5.9 s/día a 0.5 m, GMAW acero) escalado con 1/r²")
for r in (0.5, 1.0, 2.0, 3.0):
    k = (r / 0.5) ** 2
    print(f"  a {r:3.1f} m: {0.23*k:6.1f} - {5.9*k:6.1f} s/día de mirar el arco SIN protección")
I_peak = 40 + 30
print(f"  corriente pico del campanazo = {I_peak} A -> fila AWS F2.2 '60-160 A': sombra mínima 10, sugerida 11")

# ---------------------------------------------------------------------------
# 9. Referencia de frecuencias: Rayleigh l=2 (gota libre) contra lo que usaron otros
# ---------------------------------------------------------------------------
sigma = 1.5
def f2(a):
    return math.sqrt(8 * sigma / (rho * a ** 3)) / (2 * pi)
def a_of_f(f):
    return (8 * sigma / (rho * (2 * pi * f) ** 2)) ** (1 / 3)
print("\n[9] Rayleigh l=2 de gota LIBRE (canon) vs frecuencias usadas en la literatura")
for a_mm in (0.3, 0.46, 0.6, 0.8, 1.0, 1.5, 2.0):
    print(f"  a = {a_mm:4.2f} mm -> f2 = {f2(a_mm*1e-3):6.0f} Hz")
for f, who in ((60, "Harbin 2020 (vibración mecánica)"), (85, "Wu & Kovacevic 2002 (mejor)"), (668, "canon La Pluma")):
    a = a_of_f(f)
    print(f"  {f:4d} Hz ({who}): radio de gota libre que resuena = {a*1e3:5.2f} mm (D = {2*a*1e3:4.2f} mm)")
print("  -> si 60 Hz resonara en una gota de ~2.5-4 mm de diámetro (globular a 33 A) cuadra; pero NO está probado que el")
print("     modo que ve el voltaje sea el l=2 libre: la literatura usa un rebote axial masa-resorte de gota COLGADA.")
print("\nFIN")
