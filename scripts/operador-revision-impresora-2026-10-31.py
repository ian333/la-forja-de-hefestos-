#!/usr/bin/env python3
"""
Revision desde el operador: impresora de metal (alambre 0.6 mm ER70S-6, La Fuente).
Todo texto plano. Propiedades del acero bajo carbono = tablas aproximadas (+-15%).

A. Propiedades y la integral de accion K(T) = rho_m * int c/rho_e dT
B. El alambre en transito (coordenada x del alambre, no t): donde funde
C. Escalera de tiempos (eigenvalores) -> que esta separado y que choca
D. El ciclo de trabajo como sensor (balance volt-segundo del inductor), 48 V vs 12 V
E. La ruptura: energia de la bobina y voltaje del bus vs arco
F. El limite de velocidad lo pone la pieza (eigenvalor termico mas lento)
G. Precision: masa = conteo, altura = toque
"""
import math
import numpy as np

SIG = 5.670e-8
# ---------------- A. acero bajo carbono (aprox) ----------------
T_tab   = np.array([20, 100, 200, 300, 400, 500, 600, 700, 750, 770, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500])
rho_tab = np.array([0.142, 0.190, 0.262, 0.346, 0.444, 0.557, 0.688, 0.846, 0.94, 0.98, 1.03, 1.10, 1.13, 1.15, 1.18, 1.20, 1.22, 1.25]) * 1e-6
c_tab   = np.array([450, 480, 520, 560, 600, 660, 750, 900, 1250, 1500, 900, 650, 640, 650, 660, 670, 690, 700.0])
RHO_M = 7850.0
T_SOL, T_LIQ = 1480.0, 1520.0
L_FUS = 270e3          # J/kg
L_AG = 16e3            # J/kg alfa->gamma ~900 C
RHO_LIQ = 1.36e-6

Tg = np.linspace(20, T_SOL, 3000)
rho_e = np.interp(Tg, T_tab, rho_tab)
c = np.interp(Tg, T_tab, c_tab)
c = c + L_AG * np.exp(-0.5 * ((Tg - 900) / 15) ** 2) / (15 * math.sqrt(2 * math.pi))
h = np.concatenate([[0], np.cumsum(0.5 * (c[1:] + c[:-1]) * np.diff(Tg))])        # J/kg desde 20 C
K = RHO_M * np.concatenate([[0], np.cumsum(0.5 * (c[1:] / rho_e[1:] + c[:-1] / rho_e[:-1]) * np.diff(Tg))])
h_sol = h[-1]
h_liq = h_sol + L_FUS + 700 * (T_LIQ - T_SOL)
K_liq = K[-1] + RHO_M * (L_FUS + 700 * (T_LIQ - T_SOL)) / (0.5 * (rho_tab[-1] + RHO_LIQ))

print("=" * 78)
print("A. ACERO: entalpia y accion (tablas aprox, +-15%)")
print("=" * 78)
print(f"  h(20->{T_SOL:.0f} C solido) = {h_sol/1e3:7.0f} kJ/kg   h(liquido {T_LIQ:.0f} C) = {h_liq/1e3:7.0f} kJ/kg")
print(f"  energia para fundir por volumen        = {h_liq*RHO_M/1e9:6.2f} J/mm^3")
print(f"  K(solidus) = {K[-1]:.3e} A^2 s/m^4    K(liquido) = {K_liq:.3e} A^2 s/m^4")

d = 0.6e-3
A = math.pi * d * d / 4
P = math.pi * d
I2t_liq = K_liq * A * A
print(f"  alambre 0.6 mm: A = {A*1e6:.4f} mm^2,  I^2 t para fundir (adiabatico) = {I2t_liq:.0f} A^2 s")
for I in (20, 30, 40, 50, 70):
    print(f"     a {I:3d} A el alambre funde en {I2t_liq/I**2*1e3:7.0f} ms (sin importar el largo)")

# ---------------- B. el alambre en transito ----------------
def transit(I, vf, ell, eps=0.5, n=4000):
    """Integra la entalpia de un elemento de alambre en su viaje por el stickout (coordenada lagrangiana).
    Devuelve x donde llega a liquido (o None), T en la punta, R del stickout, potencia radiada."""
    t_end = ell / vf
    dt = t_end / n
    hh = 0.0
    x_melt = None
    R = 0.0
    Prad = 0.0
    j2 = (I / A) ** 2
    for k in range(n):
        if hh < h_sol:
            T = np.interp(hh, h, Tg); re = np.interp(T, T_tab, rho_tab)
        elif hh < h_liq:
            T = T_SOL + (T_LIQ - T_SOL) * (hh - h_sol) / (h_liq - h_sol); re = 0.5 * (rho_tab[-1] + RHO_LIQ)
        else:
            T = T_LIQ; re = RHO_LIQ
        q_rad = eps * SIG * ((T + 273) ** 4 - 293 ** 4) * 4 / d          # W/m^3
        hh += (re * j2 - q_rad) / RHO_M * dt
        R += re / A * vf * dt
        Prad += q_rad * A * vf * dt
        if x_melt is None and hh >= h_liq:
            x_melt = (k + 1) * dt * vf
    return x_melt, T, R, Prad

def I_for_melt_at(ell, vf, eps=0.5):
    lo, hi = 5.0, 200.0
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        xm, *_ = transit(mid, vf, ell, eps, n=1500)
        if xm is None or xm > ell * 0.999:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)

print()
print("=" * 78)
print("B. EL ALAMBRE EN TRANSITO: corriente para que funda justo al llegar a la pieza")
print("   (coordenada del alambre; incluye radiacion eps=0.5)")
print("=" * 78)
print(f"  {'Q mm3/s':>8} {'v_f mm/s':>9} {'stickout':>9} {'I [A]':>7} {'R_st mOhm':>10} {'V_st':>6} {'P_st W':>7} {'P_rad W':>8} {'P_teor W':>9}")
rows = []
for Q in (2, 5, 10, 15):
    vf = Q * 1e-9 / A
    for ell in (0.010, 0.020, 0.030):
        I = I_for_melt_at(ell, vf)
        xm, Tt, R, Prad = transit(I, vf, ell)
        Pteo = Q * 1e-9 * RHO_M * h_liq
        rows.append((Q, vf, ell, I, R))
        print(f"  {Q:8.0f} {vf*1e3:9.1f} {ell*1e3:7.0f}mm {I:7.1f} {R*1e3:10.1f} {I*R:6.2f} {I*I*R:7.1f} {Prad:8.2f} {Pteo:9.1f}")

print()
print("  LEY DEL OPERADOR (cambio de variable t -> x): si I^2 sigue a v_f, cada pedazo de alambre")
print("  recibe la misma integral j^2 dt = (j^2/v_f) dx  -> el punto de fusion NO se mueve.")
vf0 = 10e-9 / A
ell = 0.020
I0 = I_for_melt_at(ell, vf0)
print(f"  base: v_f={vf0*1e3:.1f} mm/s, I={I0:.1f} A, funde en x={transit(I0, vf0, ell)[0]*1e3:.2f} mm")
for f in (0.5, 0.25, 1.5):
    vf = vf0 * f
    xm_const, Tt_const, *_ = transit(I0, vf, 2 * ell)
    Is = I0 * math.sqrt(f)
    xm_law, *_ = transit(Is, vf, 2 * ell)
    s_const = f"funde en {xm_const*1e3:5.2f} mm" if xm_const else f"NO funde (punta {Tt_const:.0f} C)"
    s_law = f"funde en {xm_law*1e3:5.2f} mm" if xm_law else "NO funde"
    print(f"   v_f x{f:<4}: I fija {I0:5.1f} A -> {s_const:26s} | I = I0*sqrt(v/v0) = {Is:5.1f} A -> {s_law}")

# ---------------- C. escalera de tiempos ----------------
print()
print("=" * 78)
print("C. ESCALERA DE TIEMPOS (eigenvalores del proceso)  -- separados = control diagonal")
print("=" * 78)
alpha_hot = 6e-6      # m^2/s acero caliente
sigma = 1.8           # N/m acero liquido
L1 = 41e-6
Rch = 0.022
I = 40.0
a_spot = 30e-6
r_drop = 0.3e-3
ladder = []
ladder.append(("punto a de Holm (a^2/alpha)", a_spot ** 2 / alpha_hot))
ladder.append(("retardo del ACS758", 4e-6))
for Vb in (48, 12):
    Vl = 4.5
    t_on = L1 * 4 / (Vb - Vl); t_off = L1 * 4 / (Vl + 0.7)
    ladder.append((f"periodo bang-bang +-2A, bus {Vb} V", t_on + t_off))
t_cap = math.sqrt(RHO_M * r_drop ** 3 / sigma)
ladder.append(("cuello capilar (Rayleigh-Plateau) r=0.3mm", t_cap))
w2 = 8 * sigma / (RHO_M * r_drop ** 3)
ladder.append(("oscilacion l=2 de la gota (periodo)", 2 * math.pi / math.sqrt(w2)))
ladder.append(("decaimiento de la bobina por el diodo (L*I/V)", L1 * I / (4.5 + 0.7)))
ladder.append(("tau electrica L/R (R~0.1 Ohm)", L1 / 0.1))
t_sol = RHO_M * (L_FUS) * (0.2e-3) ** 2 / (2 * 30 * 1000)
ladder.append(("solidificacion de gota/cordon 0.4mm", t_sol))
ladder.append(("enfriamiento local de un punto 0.4mm (r^2/alpha)", (0.2e-3) ** 2 / alpha_hot * 4))
ladder.append(("transito del alambre por stickout 20mm @35mm/s", 0.020 / (10e-9 / A)))
ladder.append(("calentar alambre a fundir @40A (I^2t/I^2)", I2t_liq / 1600))
ladder.append(("modo termico global pieza 20mm cubo", RHO_M * 600 * 8e-6 / (40 * 2.4e-3 + 30 * 2.4e-3)))
for name, t in sorted(ladder, key=lambda z: z[1]):
    print(f"  {t*1e6:12.1f} us   {name}")
print("  CHOQUES: cuello capilar ~{:.0f} us vs decaimiento de la bobina ~{:.0f} us -> no puedes".format(t_cap*1e6, L1*I/5.2*1e6))
print("           bajar la corriente antes de que reviente el puente (sin camino rapido).")

# ---------------- D. el ciclo de trabajo como sensor ----------------
print()
print("=" * 78)
print("D. EL CICLO DE TRABAJO ES EL SENSOR (balance volt-segundo: integral de L di/dt = 0)")
print("   sim: dt=10ns, ACS758 retardo 4us, banda 38-42A, Vbus ruido 1%, reloj PIO 6.67ns")
print("=" * 78)
rng = np.random.default_rng(1)

def R_load_true(t):
    # stickout se calienta 45->57 mOhm, toque a 0.3 ms; puente liquido; cuello al final
    Rst = 0.045 + 0.012 * (1 - math.exp(-t / 1.5e-3))
    if t < 0.3e-3:
        Rb = 0.020            # contacto firme frio
    elif t < 2.2e-3:
        Rb = 0.020 * math.exp(-(t - 0.3e-3) / 0.3e-3) + 0.0015   # se vuelve puente liquido
    else:
        Rb = 0.0015 + 0.024 * min(1.0, (t - 2.2e-3) / 0.4e-3) ** 2  # cuello (sube a 26 mOhm)
    return Rst + Rb

def sim(Vb, t_end=2.6e-3, dt=10e-9, delay=4e-6):
    Rch, Rcab, Ron = 0.022, 0.010, 0.025
    nd = int(delay / dt)
    buf = [0.0] * (nd + 1)
    i = 40.0; on = True
    t = 0.0
    edges = []   # (t, tipo)
    integ_I = 0.0
    out = []
    last_on = None
    acc_I = 0.0; acc_n = 0
    t_on_start = 0.0; t_off_start = None
    while t < t_end:
        Rl = R_load_true(t)
        Vd = 0.50 + 0.006 * i
        if on:
            di = (Vb - i * (Rch + Rcab + Rl + Ron)) / L1
        else:
            di = (-Vd - i * (Rch + Rcab + Rl)) / L1
        i += di * dt
        buf.append(i); sensed = buf.pop(0)
        acc_I += i; acc_n += 1
        if on and sensed >= 42.0:
            on = False; t_off_start = t
        elif (not on) and sensed <= 38.0:
            # periodo completo: [t_on_start, t)
            T = t - t_on_start
            ton = t_off_start - t_on_start
            q = 6.667e-9
            ton_m = round(ton / q) * q; T_m = round(T / q) * q
            Iavg = acc_I / acc_n
            Iavg_m = Iavg + rng.normal(0, 0.15)
            Vb_m = Vb * (1 + rng.normal(0, 0.01))
            D = ton_m / T_m
            Vd_assumed = 0.74
            R_est = (Vb_m * D - Vd_assumed * (1 - D) - Iavg_m * Ron * D) / Iavg_m - Rch - Rcab
            out.append((t_on_start, T, D, Iavg, R_est, R_load_true(t_on_start + T / 2)))
            acc_I = 0.0; acc_n = 0
            on = True; t_on_start = t
        t += dt
    return out

for Vb in (48, 12):
    res = sim(Vb)
    arr = np.array([(r[4] - r[5]) * 1e3 for r in res[1:]])   # sin el periodo de arranque
    print(f"\n  BUS {Vb} V: {len(res)} periodos en 2.6 ms, f = {1/np.mean([r[1] for r in res])/1e3:.1f} kHz, D = {np.mean([r[2] for r in res]):.3f}")
    print(f"   {'t [us]':>8} {'T [us]':>7} {'D':>6} {'I_avg':>6} {'R_est mOhm':>11} {'R_real':>7}")
    idx = list(range(0, len(res), max(1, len(res) // 12)))
    for k in idx:
        r = res[k]
        print(f"   {r[0]*1e6:8.1f} {r[1]*1e6:7.2f} {r[2]:6.3f} {r[3]:6.2f} {r[4]*1e3:11.2f} {r[5]*1e3:7.2f}")
    print(f"   error por periodo (sin arranque): sesgo {arr.mean():+.2f} mOhm, ruido {arr.std():.2f} mOhm, peor {np.abs(arr).max():.2f}")
    Ibar = np.mean([r[3] for r in res[1:]])
    print(f"   corriente media real {Ibar:.2f} A con banda pedida 38-42 (centro 40): sesgo {Ibar-40:+.2f} A -> I^2 {((Ibar/40)**2-1)*100:+.1f}% -> la fusion se corre {((Ibar/40)**2-1)*20:+.1f} mm")
    # cuello: subida de R en ventana
    print(f"   senal del cuello: +24 mOhm  ->  {24/arr.std():.0f} sigmas por periodo")
    # sobrepaso de la corriente por el retardo
    Vl = 4.5
    print(f"   sobrepaso por retardo ACS (4us): subida {4e-6*(Vb-Vl)/L1:.2f} A, bajada {4e-6*(Vl+0.7)/L1:.2f} A")

# ---------------- E. la ruptura ----------------
print()
print("=" * 78)
print("E. LA RUPTURA: energia guardada en la bobina y si el bus puede sostener un arco")
print("=" * 78)
U_m = math.sqrt(4 * 2.45e-8 * ((T_SOL + 273) ** 2 - 293 ** 2))
print(f"  Holm, voltaje de fusion (Wiedemann-Franz): U_m = {U_m:.3f} V")
print(f"  Holm, voltaje minimo de arco del hierro: ~13 V (arco que se apaga solo por debajo)")
for I in (40, 70, 5):
    print(f"  1/2 L I^2 a {I:2d} A = {0.5*L1*I*I*1e3:6.1f} mJ   (gota/cordon de 0.4mm pide ~{RHO_M*h_liq*math.pi/6*(0.4e-3)**3*1e3:.0f} mJ)")
for Vb in (48, 24, 12):
    comp = Vb - 40 * (0.022 + 0.010 + 0.057 + 0.025)
    sustain = "SI sostiene arco de ~15-20V a 40A (= una soldadora MIG)" if comp > 15 else "NO puede sostener arco (< ~13 V)"
    print(f"  bus {Vb:2d} V: compliancia libre a 40A ~ {comp:5.1f} V -> {sustain}")
print(f"  bus 48 V con lazo de corriente: si el puente revienta, el lazo empuja 40 A por el arco: {40*17:.0f} W de arco")
print(f"  hasta que el firmware lo note. Cada 100 us de retraso = {40*17*100e-6*1e3:.0f} mJ de arco extra.")

# ---------------- F. el limite de velocidad es la pieza ----------------
print()
print("=" * 78)
print("F. LA VELOCIDAD MAXIMA LA PONE LA PIEZA (calor que entra = Q * h_liq * rho)")
print("=" * 78)
e_v = h_liq * RHO_M / 1e9      # J/mm^3
dT = 400.0                     # K de sobre-temperatura permitida en la capa (precision)
k = 30.0
def fin_R(t_w, W, h_eff):
    Ac = t_w * W; Pp = 2 * W
    return 1 / math.sqrt(h_eff * Pp * k * Ac)
cases = [
    ("cubo macizo 20mm sobre placa gruesa", 0.02 / (k * 4e-4) + 0.3),
    ("pared 0.6mm x 20mm, aire quieto (h~40)", fin_R(0.6e-3, 0.02, 40)),
    ("pared 0.6mm x 20mm, chorro de gas (h~400)", fin_R(0.6e-3, 0.02, 400)),
    ("pared 0.6mm x 20mm, casi-inmersion (h~5000)", fin_R(0.6e-3, 0.02, 5000)),
    ("perno 1mm diametro, aire quieto", 1 / math.sqrt(40 * math.pi * 1e-3 * k * math.pi * 0.25e-6)),
]
print(f"  energia que deja cada mm^3 en la pieza ~ {e_v:.1f} J;  sobre-temperatura permitida {dT:.0f} K")
for name, R in cases:
    Pmax = dT / R
    print(f"  {name:46s} R_th={R:7.2f} K/W  P_max={Pmax:7.1f} W  Q_max={Pmax/e_v:6.2f} mm^3/s ({Pmax/e_v*3.6*RHO_M/1e3:6.0f} g/h)")

# ---------------- G. precision ----------------
print()
print("=" * 78)
print("G. PRECISION: masa = conteo de pasos, altura = el toque")
print("=" * 78)
r_roll = 5e-3; usteps = 200 * 16
step = 2 * math.pi * r_roll / usteps
print(f"  avance por micropaso (rodillo r=5mm, 3200 upasos) = {step*1e6:.1f} um de alambre = {step*A*1e9:.4f} mm^3")
print(f"  sin chispas (sin masa que sale), volumen depositado = volumen alimentado: error = error del rodillo (~0.5-1%)")
for v in (0.035, 0.1, 0.38):
    print(f"  altura por el toque a v={v*1e3:5.0f} mm/s y periodo de lectura 50 us: resolucion {v*50e-6*1e6:5.1f} um")
