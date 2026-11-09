#!/usr/bin/env python3
"""
04 · SENSADO SIN SENSORES (investigacion del arco, 2026-11-05)
Contacto, distancia, temperatura y tamano de gota usando SOLO V e I (+ ADC del Pico 2).

Reproduce TODOS los numeros de docs/investigacion-arco/04-sensado-sin-sensores.md.
Correr:  python3 scripts/investigacion-arco/04_sensado_sin_sensores.py > scripts/investigacion-arco/04_sensado_sin_sensores.out

Cadena de medida modelada (la del banco minimo, plan §10-§14):
  V_out de la Torre -> divisor /16 -> RC 50 kHz -> GP27 (ADC)
  I por ACS758-050B (en la caja, 3.3 V, 26.4 mV/A) -> GP26 (ADC)
  ADC: 12 bits, 500 kS/s TOTAL, round-robin I,V -> 250 kS/s por canal (un par cada 4 us)
  ENOB 9 (minimo de la tabla 1685 del datasheet RP2350; tipico 9.5)
Supuestos marcados con [S]; datos de fuente con [F]; derivados aqui con [D].
"""
import math
import numpy as np
from scipy.signal import lfilter

rng = np.random.default_rng(404)
np.set_printoptions(linewidth=140)

# ----------------------------------------------------------------------------------------------
# 0. CONSTANTES
# ----------------------------------------------------------------------------------------------
SIG, RHO_L, MU = 1.5, 7000.0, 6e-3          # canon: tension sup., densidad liquido, viscosidad
NU = MU / RHO_L
ICRIT = 194.0
R_W = 0.4e-3                                 # radio del alambre 0.8 mm
A_W = math.pi * R_W**2                       # 0.503 mm^2 (seccion total)
F_SHEATH = 0.65                              # [S] fraccion de area que es fleje de acero (tubular E71T-GS)
A_S = F_SHEATH * A_W                         # area conductora
A_F = A_W - A_S                              # area del fundente
V0_ARC = 14.0                                # canon: V = 14 + E*L
E_CANON = 10.0                               # V/mm (medido por ian)
E_LIT = 1.1                                  # V/mm, columna de arco GMAW-P acero (Zhang et al. 2019, J.Phys.D 52 085202) [F]

FS_ADC = 500e3
FS_CH = FS_ADC / 2                           # 250 kS/s por canal (I,V)
DT_CH = 1 / FS_CH
DIV_V = 16.0
VREF = 3.3
ENOB = 9.0
SIG_V_ADC = VREF / (2**ENOB * math.sqrt(12)) * DIV_V      # ruido equivalente por muestra en V_out
LSB_V = VREF / 4096 * DIV_V
HALL_S = 0.040 * 3.3 / 5.0                   # V/A (ratiometrico a 3.3 V) [S]
SIG_I = 0.25                                 # A rms por muestra (Hall + ADC) [S: ~10 mV de ruido del ACS758 a 5 V, no verificado]
R_CIRC = 0.020                               # ohm: 2 m + 2 m cal 8 (8.2 mOhm) + antorcha SOMI (~10 mOhm) + uniones [S]
L_CIRC = 3.0e-6                              # H, lazo de cables separados [S]
L_CHOKE = 41e-6
VBUS = 48.0
F_PWM = 100e3

print("=" * 100)
print("0. LA CADENA DE MEDIDA (lo que el Pico 2 realmente ve)")
print("=" * 100)
print(f"  ADC: 12 bit, 500 kS/s total -> 2 canales (I,V) a {FS_CH/1e3:.0f} kS/s c/u, un par cada {DT_CH*1e6:.0f} us")
print(f"  V_out /16: fondo {VREF*DIV_V:.1f} V, LSB {LSB_V*1e3:.1f} mV, ruido ENOB {ENOB} = {SIG_V_ADC*1e3:.1f} mV rms por muestra "
      f"(ENOB 9.5 -> {VREF/(2**9.5*math.sqrt(12))*DIV_V*1e3:.1f} mV)")
print(f"  I Hall ACS758-050B a 3.3 V: {HALL_S*1e3:.1f} mV/A, LSB = {VREF/4096/HALL_S*1e3:.0f} mA, ruido supuesto {SIG_I:.2f} A rms")
print(f"  Offset del ADC del Pico 2 (datasheet Pico 2 §5.3): ~30 mV en la pata -> x16 = {0.030*16:.2f} V en V_out (se mide con la salida apagada)")
print(f"  Solo GP26, GP27, GP28 llegan al conector: GP29 = VSYS/3 interno (datasheet Pico 2) -> el 'NTC de D1 en GP29' del plan NO se puede")
print(f"  alambre tubular 0.8 mm: area total {A_W*1e6:.3f} mm^2, fleje {A_S*1e6:.3f} mm^2 (fraccion {F_SHEATH} [S])")

# ----------------------------------------------------------------------------------------------
# utilidades de la cadena
# ----------------------------------------------------------------------------------------------
DT_SIM = 0.2e-6


def rc_filter(x, fc, dt=DT_SIM):
    a = math.exp(-2 * math.pi * fc * dt)
    return lfilter([1 - a], [1, -a], x)


def pwm_ripple(t, Iavg, Vout, f=F_PWM, L=L_CHOKE, Vb=VBUS):
    """rizo triangular de la bobina y su dI/dt promediado EXACTO sobre cada paso de simulacion
       (asi el balance volt-segundo se cumple aunque el tiempo ON sea mas corto que el paso)."""
    D = float(np.clip(Vout / Vb, 0.005, 0.95))
    T = 1 / f
    ph = (t * f) % 1.0
    up = (Vb - Vout) / L
    dn = -Vout / L
    dI = up * D * T
    ripple = np.where(ph < D, -dI / 2 + up * ph * T, dI / 2 + dn * (ph - D) * T)
    dph = (t[1] - t[0]) * f if len(t) > 1 else 0.0
    a0, a1 = ph, ph + dph
    on = np.clip(np.minimum(a1, D) - a0, 0, None) + np.clip(np.minimum(a1, 1 + D) - np.maximum(a0, 1.0), 0, None)
    f_on = on / dph
    didt = up * f_on + dn * (1 - f_on)
    return ripple, didt


def adc_sample(t, v_true, i_true, fc_v=50e3, hall_delay=2e-6, hall_fc=120e3, sig_arc=0.0, heavy=False):
    """filtra (RC en V, Hall con retardo) y muestrea: I en t=4k us, V en t=4k+2 us. Devuelve (tI, I, tV, V)."""
    vf = rc_filter(v_true, fc_v)
    nd = int(round(hall_delay / DT_SIM))
    i_d = np.concatenate([np.full(nd, i_true[0]), i_true[:-nd]]) if nd > 0 else i_true
    i_f = rc_filter(i_d, hall_fc)
    step = int(round(DT_CH / DT_SIM))
    off = step // 2
    idx_i = np.arange(0, len(t) - step, step)
    idx_v = idx_i + off
    n = len(idx_i)
    I = i_f[idx_i] + SIG_I * rng.standard_normal(n)
    if heavy:
        arc_n = sig_arc * rng.standard_t(3, n) / math.sqrt(3.0)
    else:
        arc_n = sig_arc * rng.standard_normal(n)
    V = vf[idx_v] + SIG_V_ADC * rng.standard_normal(n) + arc_n
    V = np.round(V / LSB_V) * LSB_V
    I = np.round(I * HALL_S / (VREF / 4096)) * (VREF / 4096) / HALL_S
    return t[idx_i], I, t[idx_v], V


def first_run(mask, k):
    """indice de la primera posicion donde mask es True k veces seguidas (o None)."""
    if k == 1:
        w = np.flatnonzero(mask)
        return int(w[0]) if len(w) else None
    c = np.convolve(mask.astype(int), np.ones(k, int), mode="valid")
    w = np.flatnonzero(c == k)
    return int(w[0] + k - 1) if len(w) else None


# ----------------------------------------------------------------------------------------------
# 0b. MODELO TERMICO DEL ALAMBRE (se usa en 1, 2 y 3)
# ----------------------------------------------------------------------------------------------
# resistividad de acero bajo carbono (AISI 1008/1010). Ancla a 20 C: 0.143 uOhm m (hoja Elgin 1010) [F].
# Forma vs T: reconstruida de memoria de ASM Handbook (aceros al carbono); NO verificada en linea [S]. Curie ~770 C [F].
T_tab = np.array([20, 100, 200, 300, 400, 500, 600, 700, 750, 770, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1530])
rho_tab = np.array([0.143, 0.190, 0.263, 0.349, 0.458, 0.580, 0.733, 0.895, 0.980, 1.020, 1.076, 1.121, 1.160, 1.191, 1.217, 1.240, 1.260, 1.280, 1.380]) * 1e-6
def rho_e(T):
    return np.interp(T, T_tab, rho_tab)

# entalpia del acero: cp base + pico magnetico (Curie) + alfa->gamma; escalada a H(1480)-H(20) = 1010 kJ/kg (revision 31-oct)
Tg = np.linspace(20, 1530, 3022)
cp_base = np.where(Tg < 900, 460 + 0.30 * (Tg - 20), 650.0)
cp_mag = 45e3 * np.exp(-0.5 * ((Tg - 750) / 25) ** 2) / (25 * math.sqrt(2 * math.pi))
cp_ag = 20e3 * np.exp(-0.5 * ((Tg - 840) / 40) ** 2) / (40 * math.sqrt(2 * math.pi))
cp = cp_base + cp_mag + cp_ag
H = np.concatenate([[0], np.cumsum(0.5 * (cp[1:] + cp[:-1]) * np.diff(Tg))])
scale = 1010e3 / np.interp(1480, Tg, H)
cp *= scale
H *= scale
def cp_s(T):
    return np.interp(T, Tg, cp)

RHO_S, RHO_F, CP_F = 7850.0, 3000.0, 900.0     # fleje, fundente compactado [S], cp fundente [S]
EPS = 0.6
SB = 5.67e-8


def stickout(I, vf, L, T_in=150.0, chi=1.0, nx=400):
    """perfil estacionario en el stickout (marco del alambre): v * C_l(T) dT/dx = I^2 rho/A_s - radiacion.
       chi=1 el fundente sigue al fleje; chi=0 el fundente no se calienta (cota)."""
    dx = L / nx
    T = T_in
    R = 0.0
    xs, Ts = [0.0], [T]
    def f(T):
        C = A_S * RHO_S * cp_s(T) + chi * A_F * RHO_F * CP_F
        q = I * I * rho_e(T) / A_S - 2 * math.pi * R_W * EPS * SB * ((T + 273) ** 4 - 293.0 ** 4)
        return q / (vf * C)
    for k in range(nx):          # RK2 (Heun) en x
        k1 = f(T)
        k2 = f(T + k1 * dx)
        Tn = T + 0.5 * (k1 + k2) * dx
        R += 0.5 * (rho_e(T) + rho_e(Tn)) / A_S * dx
        T = min(Tn, 1530.0)
        xs.append((k + 1) * dx); Ts.append(T)
    return T, R, np.array(xs), np.array(Ts)

I_REF, VF_REF, LST_REF, TIN_REF = 40.0, 50e-3, 12e-3, 150.0     # punto de trabajo de referencia [S]
R_ST_HOT = stickout(I_REF, VF_REF, LST_REF, TIN_REF)[1]
print(f"  stickout de referencia {LST_REF*1e3:.0f} mm a {I_REF:.0f} A, {VF_REF*1e3:.0f} mm/s, entra a {TIN_REF:.0f} C: R_st = {R_ST_HOT*1e3:.1f} mOhm (frio {0.143e-6*LST_REF/A_S*1e3:.1f}), V_st = {I_REF*R_ST_HOT:.2f} V")


# ----------------------------------------------------------------------------------------------
# 1. CONTACTO: toque, corto, cuello, arco apagado, gota que se suelta
# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("1. CONTACTO: firmas, umbrales y tiempos de deteccion (Monte Carlo con la cadena completa)")
print("=" * 100)


def r_bridge(t_rel, t_b, r0=30e-6, rmax=0.35e-3, tau_w=100e-6, pinch_speed=1.0, rho_liq=1.38e-6, k=1.5):
    """puente liquido: moja (r0 -> rmax) y despues pellizca r = 0.717 (sig/rho)^(1/3) (t_b - t)^(2/3) (Day-Hinch-Lister).
       R ~ k*rho/(pi r). pinch_speed>1 = el pellizco magnetico acelera el cierre."""
    r_w = rmax - (rmax - r0) * np.exp(-np.maximum(t_rel, 0) / tau_w)
    tau = np.maximum(t_b - t_rel, 1e-9) * pinch_speed
    r_p = 0.717 * (SIG / RHO_L) ** (1 / 3) * tau ** (2 / 3)
    r = np.minimum(r_w, r_p)
    return k * rho_liq / (math.pi * r), r


V_TIP = 0.30         # V, contacto deslizante punta-alambre (NIST: ~0.5 V a 200-450 A) [F/S]


def ev_toque(n=400, V_ocv=24.0, I_lim=5.0, slew=0.8e6):
    lat_c, lat_e, miss = [], [], 0
    for _ in range(n):
        T = 400e-6
        t = np.arange(0, T, DT_SIM)
        t0 = rng.uniform(100e-6, 140e-6)
        Rc0 = 10 ** rng.uniform(np.log10(0.5), np.log10(50))     # oxido/escoria: 0.5-50 ohm
        tau_c = rng.uniform(5e-6, 50e-6)
        Rc = Rc0 * np.exp(-np.maximum(t - t0, 0) / tau_c) + 3e-3
        Rtot = R_CIRC + 0.004 + Rc
        Iramp = np.clip(slew * (t - t0), 0, I_lim)
        V = np.where(t < t0, V_ocv, np.minimum(V_ocv, Iramp * Rtot))
        I = np.where(t < t0, 0.0, np.minimum(Iramp, V_ocv / Rtot))
        tI, Is, tV, Vs = adc_sample(t, V, I)
        k = first_run((Vs < 0.5 * V_ocv) & (Is > 1.0), 2)
        # instante electrico: cuando I_lim*Rtot < V_ocv/2 y la corriente ya paso 1 A
        ok = (t >= t0) & (Iramp * Rtot < 0.5 * V_ocv) & (Iramp > 1.0)
        te = t[np.flatnonzero(ok)[0]] if ok.any() else None
        if k is None or te is None:
            miss += 1
            continue
        lat_c.append(tV[k] - t0)
        lat_e.append(tV[k] - te)
    lat_c, lat_e = np.array(lat_c) * 1e6, np.array(lat_e) * 1e6
    print(f"  TOQUE desde OCV {V_ocv:.0f} V (limite {I_lim:.0f} A, rampa 0.8 A/us; contacto 0.5-50 ohm que se 'frita' en 5-50 us):")
    print(f"     regla: V < {0.5*V_ocv:.0f} V  e  I > 1 A, 2 pares seguidos")
    print(f"     latencia desde que toca:            mediana {np.median(lat_c):6.1f} us  p95 {np.percentile(lat_c,95):6.1f} us  max {lat_c.max():6.1f} us")
    print(f"     latencia desde que es electrico:    mediana {np.median(lat_e):6.1f} us  p95 {np.percentile(lat_e,95):6.1f} us  (cadena: RC 3.2 us + par 4 us + confirmar 4 us)")
    print(f"     no detectados: {miss}/{n}")


def ev_corto(n=400, E=E_CANON, sig_arc=1.0, heavy=True, I0=40.0, L_arc_mm=None):
    if L_arc_mm is None:
        L_arc_mm = 6.0 / E          # arco de ~20 V
    lat1, lat2 = [], []
    fa1 = fa2 = 0
    n_arc_samples = 0
    for _ in range(n):
        T = 1.2e-3
        t = np.arange(0, T, DT_SIM)
        t0 = rng.uniform(0.8e-3, 0.9e-3)
        tb = t0 + 3e-3
        Rb, _ = r_bridge(t - t0, tb - t0)
        Varc = V0_ARC + E * L_arc_mm
        rip, didt = pwm_ripple(t, I0, 20.0)
        I = I0 + rip
        V = np.where(t < t0, Varc + V_TIP + I * (R_CIRC + R_ST_HOT),
                     V_TIP + I * (R_CIRC + R_ST_HOT + Rb)) + L_CIRC * didt
        tI, Is, tV, Vs = adc_sample(t, V, I, sig_arc=0.0)
        arcn = sig_arc * (rng.standard_t(3, len(Vs)) / math.sqrt(3) if heavy else rng.standard_normal(len(Vs)))
        Vs = Vs + np.where(tV < t0, arcn, 0.0)
        pre = tV < t0
        n_arc_samples += pre.sum()
        m = Vs < 8.0
        fa1 += int(m[pre].sum())
        fa2 += int(((m[1:] & m[:-1])[pre[1:]]).sum())
        post = np.flatnonzero(~pre)[0]
        k1 = first_run(m[post:], 1)
        k2 = first_run(m[post:], 2)
        lat1.append(tV[post + k1] - t0)
        lat2.append(tV[post + k2] - t0)
    lat1, lat2 = np.array(lat1) * 1e6, np.array(lat2) * 1e6
    secs = n_arc_samples * DT_CH
    print(f"  CORTO en arco (E={E:g} V/mm, arco {V0_ARC+E*L_arc_mm:.0f} V, ruido del arco {sig_arc:.1f} V/muestra {'colas t3' if heavy else 'gauss'}):")
    print(f"     regla V < 8 V (1 muestra):  latencia mediana {np.median(lat1):5.1f} us p95 {np.percentile(lat1,95):5.1f} us | falsas en arco: {fa1} en {secs:.2f} s = {fa1/secs:.0f}/s")
    print(f"     regla V < 8 V (2 muestras): latencia mediana {np.median(lat2):5.1f} us p95 {np.percentile(lat2,95):5.1f} us | falsas en arco: {fa2} en {secs:.2f} s = {fa2/secs:.1f}/s")


def ev_cuello(n=300, deltas=(0.003, 0.005, 0.008), pinch_speed=1.0, I0=40.0, win=5):
    """lead time: cuanto ANTES de reventar el puente se dispara la regla R - R_min > delta (2 pares seguidos,
       R promediada en 'win' pares). Falsas: disparos antes del pellizco real (r_pinch > r_wet)."""
    res = {d: [] for d in deltas}
    false = {d: 0 for d in deltas}
    for _ in range(n):
        dur = rng.uniform(1.0e-3, 4.0e-3)
        T = dur + 0.1e-3
        t = np.arange(0, T, DT_SIM)
        Rb, r = r_bridge(t, dur, pinch_speed=pinch_speed)
        rip, didt = pwm_ripple(t, I0, 3.0)
        I = I0 + rip
        V = V_TIP + I * (R_CIRC + R_ST_HOT + Rb) + L_CIRC * didt
        V = np.where(t < dur, V, 20.0)           # revienta -> arco
        I = np.where(t < dur, I, I0)
        tI, Is, tV, Vs = adc_sample(t, V, I)
        Vs = Vs[2:]; Is = Is[2:]; tV = tV[2:]          # descarta el arranque del filtro RC
        # el firmware conoce V_tip+R_circ (calibrado); R estimada por par, sin la caida de punta
        Rhat = (Vs - V_TIP) / np.maximum(Is, 5.0)
        ker = np.ones(win) / win
        Rs = np.convolve(Rhat, ker, mode="full")[:len(Rhat)]
        Rs[:win] = Rs[win]
        valid = tV < dur
        Rmin = np.minimum.accumulate(np.where(valid, Rs, np.inf))
        # el pellizco "real" empieza cuando r_pinch < r_wet (en tiempo continuo)
        r_w = 0.35e-3 - (0.35e-3 - 30e-6) * np.exp(-tV / 100e-6)
        r_p = 0.717 * (SIG / RHO_L) ** (1 / 3) * (np.maximum(dur - tV, 1e-9) * pinch_speed) ** (2 / 3)
        t_pinch_start = tV[np.flatnonzero(r_p < r_w)[0]] if (r_p < r_w).any() else dur
        for d in deltas:
            m = (Rs - Rmin > d) & valid
            m[: int(150e-6 / DT_CH)] = False            # ignora el mojado inicial (R baja)
            k = first_run(m, 2)
            if k is None:
                res[d].append(0.0)
                continue
            if tV[k] < t_pinch_start - 100e-6:
                false[d] += 1
            res[d].append(dur - tV[k])
    print(f"  CUELLO (puente liquido, pellizco Day-Hinch-Lister x{pinch_speed:g}; R por par promediada en {win} pares = {win*4} us; 2 pares sobre umbral):")
    for d in deltas:
        a = np.array(res[d]) * 1e6
        # R(r) - R(r_max) = delta  ->  1/r = 1/r_max + delta*pi/(k rho)
        r_at = 1.0 / (1.0 / 0.35e-3 + d * math.pi / (1.5 * 1.38e-6))
        tau_at = (r_at / (0.717 * (SIG / RHO_L) ** (1 / 3))) ** 1.5 / pinch_speed
        print(f"     delta {d*1e3:4.1f} mOhm (cuello r={r_at*1e6:4.0f} um, teorico {tau_at*1e6:5.0f} us antes): aviso mediano {np.median(a):6.1f} us antes de reventar,"
              f" p5 {np.percentile(a,5):6.1f} us; falsas (antes del pellizco) {false[d]}/{n}")
    return res


def ev_apagado(n=300, E=E_CANON, I0=40.0):
    lat = []
    fa = 0
    for _ in range(n):
        T = 0.6e-3
        t = np.arange(0, T, DT_SIM)
        t0 = rng.uniform(0.3e-3, 0.35e-3)
        Varc = V0_ARC + 6.0
        rip, didt = pwm_ripple(t, I0, 20.0)
        I = np.where(t < t0, I0 + rip, I0 * np.exp(-(t - t0) / 15e-6))
        Vx = np.minimum(68.0, (Varc + V_TIP + I0 * (R_CIRC + R_ST_HOT)) * np.exp(np.maximum(t - t0, 0) / 20e-6))
        V = np.where(t < t0, Varc + V_TIP + I * (R_CIRC + R_ST_HOT) + L_CIRC * didt, Vx)
        tI, Is, tV, Vs = adc_sample(t, V, I)
        arcn = 1.0 * rng.standard_t(3, len(Vs)) / math.sqrt(3)
        Vs = Vs + np.where(tV < t0, arcn, 0.0)
        m = (Vs > 40.0) | ((Is < 3.0) & (Vs > 25.0))
        pre = tV < t0
        fa += int((m[1:] & m[:-1])[pre[1:]].sum())
        k = first_run(m & ~pre, 2)
        lat.append(tV[k] - t0)
    lat = np.array(lat) * 1e6
    print(f"  ARCO APAGADO (I cae con tau 15 us, V sube al TVS de 68 V): regla V > 40 V  o  (I < 3 A y V > 25 V), 2 pares:")
    print(f"     latencia mediana {np.median(lat):5.1f} us p95 {np.percentile(lat,95):5.1f} us; falsas en arco (ruido 1 V colas t3): {fa}")


def ev_suelta(n=300, E=E_CANON, sig_arc=1.0, jump_mm=0.8, nwin=25, k_sig=6.0):
    """la gota se suelta: el arco crece de golpe ~ diametro de gota -> escalon de E*jump."""
    step_v = E * jump_mm
    sig_eff = math.sqrt(sig_arc**2 + SIG_V_ADC**2)
    thr = k_sig * sig_eff * math.sqrt(2.0 / nwin)
    det, lat = 0, []
    n_fa, secs = 0, 0.0
    for _ in range(n):
        N = 2000
        tt = np.arange(N) * DT_CH
        i0 = 1000
        rise = 50e-6
        v = V0_ARC + 6 + np.clip((tt - tt[i0]) / rise, 0, 1) * step_v
        v = v + sig_arc * rng.standard_t(3, N) / math.sqrt(3) + SIG_V_ADC * rng.standard_normal(N)
        cs = np.concatenate([[0], np.cumsum(v)])
        idx = np.arange(nwin, N - nwin)
        d = (cs[idx + nwin] - cs[idx]) / nwin - (cs[idx] - cs[idx - nwin]) / nwin
        hit = np.flatnonzero(d > thr)
        pre_hits = hit[idx[hit] < i0 - nwin]
        n_fa += len(np.unique(pre_hits // nwin)) if len(pre_hits) else 0
        secs += (i0 - nwin) * DT_CH
        post = hit[(idx[hit] >= i0 - nwin)]
        if len(post):
            det += 1
            lat.append((idx[post[0]] + nwin - i0) * DT_CH)
    lat = np.array(lat) * 1e6 if lat else np.array([np.nan])
    print(f"  GOTA SE SUELTA  E={E:4.1f} V/mm: escalon {step_v:5.2f} V; detector de escalon (medias de {nwin} pares = {nwin*4} us), umbral {thr:5.2f} V:"
          f" detecta {det}/{n} ({det/n*100:5.1f} %), latencia ~{np.nanmedian(lat):5.0f} us, falsas {n_fa/secs:6.1f}/s  (ruido {sig_arc:.1f} V t3)")


ev_toque()
print(f"     escoria en la punta (>1 kOhm, no se frita con 24 V): el toque NO aparece -> regla: si el avance ya recorrio")
print(f"     (stickout + hueco) y sigue en OCV, es escoria: parar y cortar la punta (a 50 mm/s, 15 mm = 300 ms)")
ev_corto(E=E_CANON, sig_arc=1.0, heavy=True)
ev_corto(E=E_CANON, sig_arc=2.0, heavy=True)
ev_cuello(pinch_speed=1.0)
ev_cuello(pinch_speed=2.0)
ev_apagado()
for E in (E_CANON, E_LIT):
    for s in (0.3, 1.0):
        ev_suelta(E=E, sig_arc=s)
for nw in (100, 250):
    ev_suelta(E=E_LIT, sig_arc=1.0, nwin=nw)
# tiempo para quitar la corriente sin Q3: decaimiento por D1 con el puente en corto
for Vsh in (2.0, 4.0):
    print(f"  sin Q3: la corriente de 40 A baja por D1 a dI/dt = -(V_corto {Vsh:.0f} V + 0.7 V)/41 uH -> tarda {40/((Vsh+0.7)/L_CHOKE)*1e6:5.0f} us en llegar a 0")
print(f"  con Q3 (crowbar en la salida): < 2 us. El aviso del cuello (arriba) es de ~100-300 us -> SOLO alcanza con Q3 o con un camino de bajada activo.")

# comparador de 1 bit con un GPIO normal (Schmitt) para el corto (PIO lo ve en ns)
VIL, VIH = 0.8, 2.0     # RP2350 tabla 1683, IOVDD 3.3 V [F]
k_lo, k_hi = 13.0 / VIH, 5.0 / VIL
print(f"  COMPARADOR DE 1 BIT sin ADC: divisor V_out/k a un GPIO 0-25 (tolera 5.5 V con IOVDD encendido). VIL<=0.8 V, VIH>=2.0 V ->")
print(f"     para 'bajo' seguro con V_out<5 V y 'alto' seguro con V_out>13 V hace falta {k_hi:.2f} <= k <= {k_lo:.2f}: k = 6.4 (p.ej. 54k/10k);")
print(f"     con OCV 48 V la pata ve {48/6.4:.1f} V -> diodo a 3.3 V (BAT54) o Zener 3.3 V. PIO lo muestrea cada 6.7 ns: corto visto en < 0.1 us.")

# tabla de firmas
print()
print("  FIRMAS (lo que distingue cada estado con solo V e I):")
print("     estado            V_out                      I                 R=V/I              dR/dt                contexto")
print("     abierto/OCV       = OCV (24 V)               ~0                 inf                -                    antes de tocar")
print("     toque             < 0.5 OCV, cae en us       sube 0.8 A/us      0.03-5 ohm, BAJA   negativa (fritting)  venia de OCV")
print("     arco              13-35 V (V0 + E L)         la pedida          0.3-0.9 ohm        ruido                -")
print("     corto (puente)    1-4 V                      la pedida          R_circ+R_st+1-3 mO baja (moja) luego sube venia de ARCO")
print("     cuello            1-4 V subiendo             la pedida          R_min + 3..10 mO   > 0, acelera ~tau^-5/3 dentro de un corto")
print("     arco apagado      > 40 V (TVS) o > OCV       < 3 A, cae         -> inf             -                    venia de ARCO")
print("     gota se suelta    escalon +E*0.8 mm          igual              escalon            -                    dentro de ARCO")


# ----------------------------------------------------------------------------------------------
# 2. DISTANCIA: largo de arco y CTWD con 'Kelvin por software'
# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("2. DISTANCIA: V_arco = V_out - I*R_circ - V_punta - I*R_st ;  L = (V_arco - V0)/E")
print("=" * 100)

# 2a. calibracion Kelvin por software: punta de contacto apretada contra la placa (Fronius 'r', EWM 'rL')
print("  2a. CALIBRACION 'KELVIN POR SOFTWARE': la punta de cobre apretada contra la placa, 3 corrientes x 20 ms")
nrep = 500
Rc_est = []
for _ in range(nrep):
    Is_all, Vs_all = [], []
    Rcont = rng.uniform(0.2e-3, 1.0e-3)           # contacto cobre-acero apretado
    for Iset in (10.0, 20.0, 30.0):
        T = 2e-3      # 2 ms por nivel en simulacion (escalamos el ruido a 20 ms abajo)
        t = np.arange(0, T, DT_SIM)
        Vo = Iset * (R_CIRC + Rcont)
        rip, didt = pwm_ripple(t, Iset, max(Vo, 0.5))
        I = Iset + rip
        V = I * (R_CIRC + Rcont) + L_CIRC * didt
        tI, Is, tV, Vs = adc_sample(t, V, I)
        Is_all.append(Is[5:]); Vs_all.append(Vs[5:])
    # pendiente V vs I sobre los promedios por nivel (el rizo se cancela al promediar periodos enteros)
    Im = np.array([x.mean() for x in Is_all]); Vm = np.array([x.mean() for x in Vs_all])
    p = np.polyfit(Im, Vm, 1)
    Rc_est.append(p[0])
Rc_est = np.array(Rc_est)
# escala a 20 ms por nivel (10x mas muestras -> /sqrt(10))
sR = Rc_est.std() / math.sqrt(10)
print(f"     R_circ+R_contacto verdadera {R_CIRC*1e3:.1f} + (0.2..1.0) mOhm; estimada: sesgo {np.mean(Rc_est - R_CIRC - 0.6e-3)*1e3:+.3f} mOhm (el contacto queda dentro),"
      f" ruido {sR*1e3:.3f} mOhm con 20 ms por nivel")
print(f"     -> a 40 A el error de I*R_circ es {sR*40*1e3:.1f} mV (ruido) + el contacto cobre-placa (0.2-1 mOhm) = {0.4e-3*40*1e3:.0f} mV (1 sigma, uniforme)")
# L_circ con el rizo: diferencia de V entre fase ON y OFF = L_circ*(Vbus/L_choke) (despues de corregir el RC)
dV_LC = L_CIRC * VBUS / L_CHOKE
print(f"     L_circ sale del rizo: salto de V entre ON y OFF = L_circ*Vbus/L_choke = {dV_LC:.2f} V (L_circ 3 uH) -> se ve sin esfuerzo")

# 2b. presupuesto de error (1 sigma) en V_arco, y su traduccion a mm
print()
print("  2b. PRESUPUESTO DE ERROR (1 sigma) del largo de arco a 40 A")
tw = 13.3e-3   # ventana = 1 periodo de gota (75 gotas/s)
nwin = tw * FS_CH
rho_ar = math.exp(-DT_CH / 40e-6)                 # ruido del arco correlado ~40 us (AR1)
neff = nwin * (1 - rho_ar) / (1 + rho_ar)
# sensibilidades del stickout (modelo de 0b) en el punto de referencia
Rref = R_ST_HOT
dV_Tin = I_REF * (stickout(I_REF, VF_REF, LST_REF, TIN_REF + 100)[1] - Rref)       # T de entrada +100 K
dV_L = I_REF * (stickout(I_REF, VF_REF, LST_REF + 1e-3, TIN_REF)[1] - Rref)        # stickout +1 mm
dV_vf = I_REF * (stickout(I_REF, VF_REF * 0.9, LST_REF, TIN_REF)[1] - Rref)        # avance -10 %
sig_model = math.sqrt(dV_Tin**2 + dV_L**2 + dV_vf**2)
print(f"     stickout {LST_REF*1e3:.0f} mm a {I_REF:.0f} A: V_st = {I_REF*Rref:.2f} V; T_entrada +100 K -> {dV_Tin*1e3:+.0f} mV, L_st +1 mm -> {dV_L*1e3:+.0f} mV,"
      f" v_f -10 % -> {dV_vf*1e3:+.0f} mV; modelo sin medir: +-{sig_model*1e3:.0f} mV")
src = [
    # nombre, sigma absoluto [V], sigma del CAMBIO en ~10 s dentro del mismo cordon [V], nota
    ("ADC ruido blanco (ventana 13.3 ms)", SIG_V_ADC / math.sqrt(nwin), SIG_V_ADC / math.sqrt(nwin), "ENOB 9, 3325 muestras"),
    ("ADC offset (cero con salida apagada)", 0.016, 0.0, "1 mV en la pata x16; +20 uA*200 ohm al muestrear"),
    ("ganancia ADC+divisor (cal. 1 vez, deriva 0.2 %)", 0.002 * 20.0, 0.002 * 2.0, "3.3 V del SMPS; con LM4040 10x menos"),
    ("R_circ (toque de punta) ruido + contacto", math.hypot(sR * 40, 0.4e-3 * 40), 0.0, "ver 2a"),
    ("R_circ deriva por calentamiento del cobre", 0.30 * 0.0039 * 15 * R_CIRC * 40, 0.30 * 0.0039 * 15 * R_CIRC * 40, "+15 K; modelo I^2t deja 30 %"),
    ("V_punta: contacto deslizante (media)", 0.15, 0.0, "NIST ~0.5 V; el toque de punta no lo ve"),
    ("V_punta: brincos (contacto que salta)", 0.05, 0.05, "[S] brincos de +-0.1 V"),
    ("I*R_st por MODELO (T_ent +-100 K, L +-1 mm, v_f +-10 %)", sig_model, 0.5 * dV_Tin, "en 10 s la punta se calienta ~+50 K [S]"),
    ("I*R_st MEDIDA en cortos (+-1 mOhm) [alternativa]", 0.0, 0.0, f"seria +-{1e-3*I_REF*1e3:.0f} mV abs (no sumado)"),
    ("V0 (caidas de anodo/catodo) a 40 A", 0.5, 0.05, "[S] sin dato para E71T-GS a 40 A"),
    ("ruido del arco 1 V/muestra (13.3 ms)", 1.0 / math.sqrt(neff), 1.0 / math.sqrt(neff), f"AR1 40 us -> N_ef = {neff:.0f}"),
    ("diente de sierra de la gota (si no se sincroniza)", 0.0, 0.0, "se promedia 1 periodo exacto de gota"),
]
tot_abs = math.sqrt(sum(s[1] ** 2 for s in src))
tot_rel = math.sqrt(sum(s[2] ** 2 for s in src))
print(f"     {'fuente':52s} {'abs mV':>8s} {'cambio mV':>9s} | {'abs um E=10':>11s} {'abs um E=1.1':>12s} | {'cambio um E=10':>14s} {'E=1.1':>7s}  nota")
for nm, sa, sr, nt in src:
    print(f"     {nm:52s} {sa*1e3:8.1f} {sr*1e3:9.1f} | {sa/E_CANON*1e3:11.1f} {sa/E_LIT*1e3:12.0f} | {sr/E_CANON*1e3:14.1f} {sr/E_LIT*1e3:7.0f}  {nt}")
print(f"     {'TOTAL (suma cuadratica)':52s} {tot_abs*1e3:8.1f} {tot_rel*1e3:9.1f} | {tot_abs/E_CANON*1e3:11.1f} {tot_abs/E_LIT*1e3:12.0f} | {tot_rel/E_CANON*1e3:14.1f} {tot_rel/E_LIT*1e3:7.0f}")
print(f"     -> con E = 10 V/mm (canon): largo absoluto +-{tot_abs/E_CANON*1e3:.0f} um, cambios +-{tot_rel/E_CANON*1e3:.0f} um.  Con E = 1.1 V/mm (literatura): +-{tot_abs/E_LIT*1e3:.0f} um y +-{tot_rel/E_LIT*1e3:.0f} um.")

# 2c. Monte Carlo: diente de sierra de la gota + ruido; ventana sincronizada vs ventana fija
print()
print("  2c. MONTE CARLO: el largo de arco con la gota creciendo (75 gotas/s, a 0.30->0.46 mm) y ruido del arco")
fdrop = 75.0
for E in (E_CANON, E_LIT):
    for sig_arc in (0.3, 1.0, 2.0):
        errs_sync, errs_1ms = [], []
        for trial in range(60):
            N = int(0.2 * FS_CH)
            tt = np.arange(N) * DT_CH
            ph = (tt * fdrop + rng.uniform()) % 1.0
            vol = (4 / 3 * math.pi) * ((0.30e-3) ** 3 + ph * ((0.46e-3) ** 3 - (0.30e-3) ** 3))
            a = (3 * vol / (4 * math.pi)) ** (1 / 3) * 1e3        # mm
            L0 = 6.0 / E + 0.92                                  # con gota chica
            L = L0 - 2 * (a - 0.30)                              # el arco se acorta mientras crece la gota
            # ruido del arco correlado ~40 us (AR1)
            w = rng.standard_normal(N)
            al = math.exp(-DT_CH / 40e-6)
            arcn = lfilter([math.sqrt(1 - al**2)], [1, -al], w) * sig_arc
            V = V0_ARC + E * L + arcn + SIG_V_ADC * rng.standard_normal(N)
            Lhat = (V - V0_ARC) / E
            # ventana sincronizada: un periodo de gota exacto (entre dos 'suelta')
            n_per = int(round(FS_CH / fdrop))
            starts = np.flatnonzero(np.diff(ph) < 0)[:3] + 1
            for s in starts:
                if s + n_per <= N:
                    errs_sync.append(Lhat[s:s + n_per].mean() - L[s:s + n_per].mean())
            n1 = int(1e-3 * FS_CH)
            for s in range(0, N - n1, n1 * 20):
                errs_1ms.append(Lhat[s:s + n1].mean() - L[s:s + n1].mean())
        es, e1 = np.array(errs_sync) * 1e3, np.array(errs_1ms) * 1e3
        print(f"     E={E:4.1f} V/mm ruido {sig_arc:.1f} V: ventana = 1 gota (13.3 ms) sigma {es.std():6.1f} um | ventana 1 ms sigma {e1.std():6.1f} um"
              f" | diente de sierra de la gota pico-pico {2*(0.46-0.30)*1e3:.0f} um = {E*2*(0.46-0.30):.2f} V")

# fuga del diente de sierra si la ventana es FIJA y el periodo de gota varia +-10 %
per = 1 / fdrop * (1 + 0.10 * rng.standard_normal(400))
per = np.clip(per, 0.6 / fdrop, 1.6 / fdrop)
edges = np.concatenate([[0], np.cumsum(per)])
tt = np.arange(0, edges[-1], DT_CH)
cyc = np.searchsorted(edges, tt, side="right") - 1
phase = (tt - edges[cyc]) / per[cyc]
vol = (4 / 3 * math.pi) * ((0.30e-3) ** 3 + phase * ((0.46e-3) ** 3 - (0.30e-3) ** 3))
Lsaw = -2 * ((3 * vol / (4 * math.pi)) ** (1 / 3) * 1e3 - 0.30)
leak = []
nfix = int(round(FS_CH / fdrop))
for c in range(1, 390):
    i0 = np.searchsorted(tt, edges[c])
    i1 = np.searchsorted(tt, edges[c + 1])
    leak.append(Lsaw[i0:i0 + nfix].mean() - Lsaw[i0:i1].mean())
print(f"     ventana FIJA de 13.3 ms con periodo de gota +-10 %: fuga del diente de sierra sigma {np.std(leak)*1e3:.1f} um"
      f" (no depende de E) -> la ventana se cierra en cada SUELTA detectada, no por reloj")

# 2d. CTWD = stickout + gota + arco; en corriente constante dCTWD = dL_arco (1:1)
print()
print("  2d. CTWD = stickout + diametro de gota + largo de arco")
print("     En CORRIENTE CONSTANTE (el lazo PI de La Pluma) el derretido no depende del largo del arco: si la placa sube 1 mm,")
print("     el stickout no cambia en el corto plazo y el arco se acorta 1 mm -> dV = -E*1 mm (= -10 V canon / -1.1 V literatura).")
print("     El stickout lo fija el balance de derretido v_f = alfa*I + beta*L_st*I^2 (Lesnewich) -> se calibra una vez por (I, v_f).")

# 2e. experimento decisivo de E: la quema (burn-back) con avance detenido
print()
print("  2e. LA QUEMA: con I fija, se detiene el avance; el arco crece a la velocidad de derretido (= v_f de antes) -> dV/dt = E*v_f")
for vf in (35.0, 50.0):
    for E in (E_CANON, 3.0, E_LIT):
        print(f"     v_f {vf:4.0f} mm/s, E {E:4.1f} V/mm: rampa {E*vf:6.0f} V/s = {E*vf*0.05:5.2f} V en 50 ms (arco +{vf*0.05:.2f} mm)")
# resolucion de la pendiente con ruido de 1 V en 50 ms
n50 = int(0.05 * FS_CH)
tt = np.arange(n50) * DT_CH
sl = []
for _ in range(400):
    v = 350.0 * tt + 1.0 * rng.standard_normal(n50)
    sl.append(np.polyfit(tt, v, 1)[0])
sl = np.array(sl)
print(f"     pendiente con ruido 1 V/muestra en 50 ms: +-{sl.std():.1f} V/s (1 sigma) -> E a +-{sl.std()/35:.2f} V/mm con v_f=35 mm/s"
      f" (la incertidumbre real es v_f: +-10 % -> E +-10 %)")


# ----------------------------------------------------------------------------------------------
# 3. TEMPERATURA
# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("3a. EL ALAMBRE COMO TERMOMETRO: resistividad del acero vs T (codo de Curie) y perfil Joule en el stickout")
print("=" * 100)
print("     T C    rho uOhm.m   rho/rho20   pendiente (uOhm.m/100 K)")
for i, T in enumerate(T_tab[:-1]):
    sl = (rho_tab[i + 1] - rho_tab[i]) / (T_tab[i + 1] - T_tab[i]) * 100 * 1e6
    print(f"     {T:5.0f}  {rho_tab[i]*1e6:9.3f}   {rho_tab[i]/rho_tab[0]:8.2f}    {sl:6.3f}")
s_below = (rho_e(770) - rho_e(700)) / 70
s_above = (rho_e(900) - rho_e(800)) / 100
print(f"     codo de Curie: pendiente 700-770 C = {s_below*1e6*100:.3f}, 800-900 C = {s_above*1e6*100:.3f} uOhm.m/100K -> cae {s_below/s_above:.1f}x")
print(f"     entalpia del acero escalada x{scale:.3f}: H(770)={np.interp(770,Tg,H)/1e3:.0f} kJ/kg, H(1480)={np.interp(1480,Tg,H)/1e3:.0f} kJ/kg; pico cp en Curie {cp.max():.0f} J/kgK")


alpha_th = 30 / (7850 * 600)
print(f"     Peclet del stickout: v*L/alfa = 0.05*0.01/{alpha_th:.1e} = {0.05*0.01/alpha_th:.0f} -> conduccion despreciable salvo {alpha_th/0.05*1e3:.2f} mm junto a la gota")
print()
print("     I A  v_f mm/s  L_st mm  T_entra C | T_punta C  R_st mOhm  R_frio mOhm  R/R_frio  V_st V  (fundente sigue / fundente no)")
rows = []
for I in (30.0, 45.0, 60.0):
    for vf in (35e-3, 50e-3):
        for L in (5e-3, 10e-3, 15e-3, 20e-3):
            T1, R1, _, _ = stickout(I, vf, L, 150.0, 1.0)
            T0_, R0_, _, _ = stickout(I, vf, L, 150.0, 0.0)
            Rc = rho_e(20) * L / A_S
            rows.append((I, vf, L, T1, R1, Rc))
            print(f"     {I:4.0f}  {vf*1e3:6.0f}   {L*1e3:5.0f}     150   | {T1:6.0f}/{T0_:5.0f}  {R1*1e3:6.1f}/{R0_*1e3:5.1f}  {Rc*1e3:8.2f}   {R1/Rc:6.2f}   {I*R1:5.2f}/{I*R0_:4.2f}")
# sensibilidades en el punto de referencia (40 A, 50 mm/s, 12 mm, entra a 150 C)
I, vf, L = I_REF, VF_REF, LST_REF
Tb, Rb_, xs_b, Ts_b = stickout(I, vf, L, TIN_REF)
Tt, Rt, _, _ = stickout(I, vf, L, TIN_REF + 200)
TL, RL, _, _ = stickout(I, vf, L + 1e-3, TIN_REF)
Tv, Rv, _, _ = stickout(I, vf * 0.9, L, TIN_REF)
print()
print(f"     referencia {I:.0f} A, {vf*1e3:.0f} mm/s, {L*1e3:.0f} mm, entra a {TIN_REF:.0f} C: T al final {Tb:.0f} C, R_st {Rb_*1e3:.1f} mOhm (frio {rho_e(20)*L/A_S*1e3:.1f}), V_st {I*Rb_:.2f} V")
print("       perfil T(x): " + "  ".join(f"{xs_b[j]*1e3:4.1f} mm {Ts_b[j]:4.0f} C" for j in range(0, len(xs_b), 80)))
print(f"       T de entrada +200 C (punta de contacto caliente): dV_st = {I*(Rt-Rb_)*1e3:+.0f} mV  = {I*(Rt-Rb_)/E_CANON*1e3:+.0f} um (E=10) / {I*(Rt-Rb_)/E_LIT*1e3:+.0f} um (E=1.1) de arco falso; T final {Tt:.0f} C")
print(f"       stickout +1 mm:                           dV_st = {I*(RL-Rb_)*1e3:+.0f} mV")
print(f"       v_f -10 %:                                dV_st = {I*(Rv-Rb_)*1e3:+.0f} mV")

# cuando se puede medir R_st
print()
print("     CUANDO SE PUEDE LEER R_st (el arco tapa todo: su V/I = 0.5 ohm >> R_st y su caracteristica dinamica es desconocida):")
Rst = Rb_
for nm, sR, cond in (
        ("en un CORTO (puente liquido, 1-3 ms)", math.hypot(1.0e-3, 1.0e-3 / math.sqrt(25)), "R_puente 1-3 mOhm desconocido (+-1)"),
        ("en el TOQUE de arranque (frio)", math.hypot(3.0e-3, 0.06e-3), "contacto de Holm +-3 mOhm (a=20 um, 2 N)"),
        ("RE-TOQUE <0.2 s tras apagar (caliente)", math.hypot(3.0e-3, 0.06e-3), "se enfria ~60 K/s por radiacion; Holm +-3 mOhm"),
        ("entre pulsos de un arco pulsado", float("inf"), "sigue habiendo arco: NO")):
    if math.isinf(sR):
        print(f"       {nm:42s}: no")
        continue
    # sensibilidad dR/dT_medio aprox: R = rho(Tm) L/A_s
    Tm = np.interp(Rst * A_S / L, rho_tab, T_tab)
    dRdT = (rho_e(Tm + 10) - rho_e(Tm - 10)) / 20 * L / A_S
    print(f"       {nm:42s}: sigma R {sR*1e3:4.1f} mOhm de {Rst*1e3:4.1f} -> T media del stickout {Tm:4.0f} C +-{sR/dRdT:4.0f} K  ({cond})")
print(f"       enfriamiento por radiacion del alambre a 800 C: {EPS*SB*((1073)**4-293**4)*2*math.pi*R_W/(A_S*RHO_S*600+A_F*RHO_F*CP_F):.0f} K/s")

# fusible: R(t) con alambre quieto entre pinzas -> el codo de Curie como calibracion
print()
print("     FUSIBLE (alambre quieto, 30 mm, corriente fija; sin perdidas a las pinzas): R(t) y el codo de Curie")
for I in (30.0, 40.0):
    T = 20.0
    t = 0.0
    dt = 1e-4
    R_hist = []
    while T < 1500 and t < 5.0:
        C = A_S * RHO_S * cp_s(T) + A_F * RHO_F * CP_F
        q = I * I * rho_e(T) / A_S - 2 * math.pi * R_W * EPS * SB * ((T + 273) ** 4 - 293.0 ** 4)
        T += q / C * dt
        t += dt
        R_hist.append((t, T, rho_e(T) * 0.030 / A_S))
    R_hist = np.array(R_hist)
    tc = R_hist[np.flatnonzero(R_hist[:, 1] >= 770)[0], 0]
    tend = R_hist[-1, 0]
    dRdt = np.gradient(R_hist[:, 2], R_hist[:, 0])
    print(f"       {I:3.0f} A: R {R_hist[0,2]*1e3:5.1f} -> {R_hist[-1,2]*1e3:5.1f} mOhm, pasa Curie (770 C) a t={tc*1e3:5.0f} ms, funde a ~{tend*1e3:5.0f} ms")
    print(f"          T C     t ms    R mOhm   dR/dt mOhm/s")
    for Tq in (300, 500, 650, 720, 750, 770, 790, 850, 1000, 1300):
        j = np.flatnonzero(R_hist[:, 1] >= Tq)[0]
        print(f"          {Tq:5d}  {R_hist[j,0]*1e3:7.0f}  {R_hist[j,2]*1e3:7.1f}   {dRdt[j]*1e3:8.1f}")
    jb = np.flatnonzero(R_hist[:, 1] >= 720)[0]; ja = np.flatnonzero(R_hist[:, 1] >= 850)[0]
    print(f"          -> dR/dt cae {dRdt[jb]/dRdt[ja]:.1f}x entre 720 C y 850 C: el CODO de Curie en la curva R(t)")
print(f"     ruido de R por par a 30 A: {SIG_V_ADC/30*1e3:.2f} mOhm; en 10 ms (2500 pares): {SIG_V_ADC/30/50*1e3:.3f} mOhm -> el codo se ve con >100 sigmas")

# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("3b. EL CHARCO Y LA PLACA DESDE V(t)")
print("=" * 100)


def f_pool(r, h, j=3.832):
    k = j / r
    w2 = (SIG * k**3 / RHO_L + 9.81 * k) * math.tanh(k * h)
    return math.sqrt(w2) / (2 * math.pi)


print("     modos capilares del charco (disco de radio r, hondo h): f = (1/2pi) sqrt(sigma k^3/rho * tanh(k h)), k = j/r")
print("     r mm   h mm   f(0,1) Hz axial   f(1,1) Hz chapoteo   f(0,2) Hz")
for r in (1.0, 1.5, 2.0, 2.5, 3.0):
    h = 0.5 * r
    print(f"     {r:4.1f}  {h*1:5.2f}   {f_pool(r*1e-3,h*1e-3):10.0f}        {f_pool(r*1e-3,h*1e-3,1.841):10.0f}          {f_pool(r*1e-3,h*1e-3,7.016):8.0f}")
# charco vs precalentamiento (Rosenthal, fuente puntual en placa gruesa): r_m = eta V I / (2 pi k (Tm - T0))
eta, Va, Ia, kth, Tm = 0.8, 20.0, 40.0, 30.0, 1500.0
print(f"     radio del charco (Rosenthal, placa gruesa, fuente quieta): r = eta V I / (2 pi k (Tm - T0)), eta {eta}, {Va:.0f} V, {Ia:.0f} A, k {kth:.0f} W/mK")
for T0 in (20, 200, 400, 600):
    r = eta * Va * Ia / (2 * math.pi * kth * (Tm - T0))
    print(f"       placa a {T0:4d} C: r = {r*1e3:4.2f} mm -> f(0,1) = {f_pool(r, 0.5*r):5.0f} Hz")
print(f"     sensibilidad: d ln f / d T0 = -1.5/(Tm - T0) = {-1.5/(Tm-20)*100:.3f} %/K a 20 C -> 1 % de f = {1/(1.5/(Tm-20)*100):.0f} K")
# amplitud: patada de cada gota
mdrop = RHO_L * 4 / 3 * math.pi * (0.46e-3) ** 3
for r_p in (1.5e-3, 2.0e-3):
    mpool = RHO_L * 2 / 3 * math.pi * r_p**3
    vimp = 1.0
    fpp = f_pool(r_p, 0.5 * r_p)
    A_imp = mdrop * vimp / (0.3 * mpool) / (2 * math.pi * fpp)
    print(f"     patada de una gota de 0.46 mm a {vimp} m/s en charco r={r_p*1e3:.1f} mm (masa modal 30 %): amplitud ~{A_imp*1e6:4.0f} um"
          f" -> {E_CANON*A_imp*1e3:5.2f} V (E=10) / {E_LIT*A_imp*1e3:5.3f} V (E=1.1)   [orden de magnitud, factor 3]")


def crlb_ring(A, f, Qr, sig, T, fs=FS_CH, N_avg=1):
    """cota de Cramer-Rao para la frecuencia de un timbre amortiguado A e^{-t/tau} cos(2 pi f t + phi) en ruido blanco."""
    tau = Qr / (math.pi * f)
    t = np.arange(int(T * fs)) / fs
    env = A * np.exp(-t / tau)
    s = sig / math.sqrt(N_avg)
    # parametros: amplitud a (lineal) -> usar fase/cuadratura: s(t) = env*(c cos + d sin); FIM de (c, d, w)
    w = 2 * math.pi * f
    c, d = 1.0, 0.0
    ds_dc = env * np.cos(w * t)
    ds_dd = env * np.sin(w * t)
    ds_dw = env * (-c * t * np.sin(w * t) + d * t * np.cos(w * t))
    J = np.array([ds_dc, ds_dd, ds_dw])
    F = J @ J.T / s**2
    C = np.linalg.inv(F)
    return math.sqrt(C[2, 2]) / (2 * math.pi)


print("     oir el charco promediando N patadas sincronizadas con la suelta (Q del charco 10 [S], f 250 Hz, ventana 10 ms):")
print("        E V/mm  ruido V   amplitud V   N gotas   sigma f Hz   sigma f %    -> sigma T0 K")
for E in (E_CANON, E_LIT):
    A = E * 50e-3
    for sig in (0.3, 1.0):
        for N in (1, 10, 75, 750):
            sf = crlb_ring(A, 250.0, 10.0, sig, 10e-3, N_avg=N)
            print(f"        {E:5.1f}   {sig:5.1f}    {A:7.3f}     {N:5d}    {sf:8.2f}    {sf/250*100:7.2f}     {sf/250/(1.5/(Tm-20)):7.0f}")

# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("4. TAMANO DE GOTA POR f2 (EL OIDO) con lock-in: resolucion contra ruido y tiempo")
print("=" * 100)
QV = 25e-9          # m^3/s de metal (canon: 3 m/min x 0.503 mm^2 -> 75 gotas/s de 0.45 mm) ; con fleje 65 % -> 16 mm^3/s


def a_of_t(a_c, t, qv=QV):
    vol = 4 / 3 * math.pi * a_c**3 + qv * t
    return (3 * vol / (4 * math.pi)) ** (1 / 3)


def w_of_a(a):
    return np.sqrt(8 * SIG / (RHO_L * a**3))


f2_ref = w_of_a(0.46e-3) / (2 * math.pi)
print(f"     f2(0.46 mm) = {f2_ref:.0f} Hz; la gota crece {QV*1e9:.0f} mm^3/s -> d ln f/dt = -0.5 dV/V dt = {-0.5*QV/(4/3*math.pi*(0.46e-3)**3):.1f} /s"
      f" ({-0.5*QV/(4/3*math.pi*(0.46e-3)**3)*1e-3*100:.1f} % por ms): la campana es un CHIRP, no un tono")
print(f"     tiempo de timbre tau = Q/(pi f): Q=30 -> {30/(math.pi*f2_ref)*1e3:.1f} ms ; Q=10 -> {10/(math.pi*f2_ref)*1e3:.1f} ms")
# ping del canon: 10 A sobre 40 A durante 0.8 ms -> q
for (I0, I1, tp) in ((40.0, 10.0, 0.8e-3), (40.0, 20.0, 1.2e-3)):
    F = 2 * I0 * I1 / ICRIT**2
    q0 = F * w_of_a(0.46e-3) * tp / 2
    print(f"     ping {I1:.0f} A x {tp*1e3:.1f} ms sobre {I0:.0f} A: q0 ~ {q0:.3f} -> punta se mueve {q0*0.46*1e3:4.1f} um -> {E_CANON*q0*0.46:5.3f} V (E=10) / {E_LIT*q0*0.46:5.3f} V (E=1.1)")


def mc_oido(E, sig, T, q0, Qd, ntr=300, a_c=0.46e-3, prior=0.05, guard=0.3e-3):
    """La gota tiene a(t_c) = a_c en el centro de la ventana de escucha. El firmware conoce el ritmo de crecimiento
       con +-10 % (avance) y un tamano previo con +-prior. Dos estimadores:
       ML  = rejilla sobre a_c con fase/amplitud lineales (lo mejor posible),
       LI  = lock-in contra la referencia del modelo, filtro de 1 periodo, pendiente de fase (barato, firmware)."""
    N = int(T * FS_CH)
    t = (np.arange(N) - N / 2) / FS_CH                   # centrado en t_c
    tau = Qd / (math.pi * f2_ref)
    # verdad (por ensayo): fase acumulada con a(t) creciendo al ritmo real
    rate = QV * (1 + 0.10 * rng.standard_normal(ntr))
    a_true = a_c * (1 + 0.0 * rng.standard_normal(ntr))
    tt = t[None, :]
    vol = 4 / 3 * np.pi * a_true[:, None] ** 3 + rate[:, None] * tt
    a_t = (3 * vol / (4 * np.pi)) ** (1 / 3)
    w_t = w_of_a(a_t)
    ph = np.cumsum(w_t, axis=1) / FS_CH
    ph -= ph[:, N // 2][:, None]
    phi0 = rng.uniform(0, 2 * np.pi, ntr)
    t_since_ping = t - t[0] + guard
    env = q0 * np.exp(-t_since_ping / tau)
    sig_v = E * a_t * 1e3 * env * np.cos(ph + phi0[:, None])
    noise = sig * rng.standard_normal((ntr, N)) + SIG_V_ADC * rng.standard_normal((ntr, N))
    y = sig_v + noise
    # --- ML en rejilla (crecimiento nominal) ---
    grid = a_c * (1 + np.linspace(-0.08, 0.08, 321))
    est_ml = np.empty(ntr)
    best = np.full(ntr, -np.inf)
    vol_g = 4 / 3 * np.pi * grid[:, None] ** 3 + QV * t[None, :]
    a_g = (3 * vol_g / (4 * np.pi)) ** (1 / 3)
    ph_g = np.cumsum(w_of_a(a_g), axis=1) / FS_CH
    ph_g -= ph_g[:, N // 2][:, None]
    envg = np.exp(-t_since_ping / tau)[None, :]
    Cb = envg * np.cos(ph_g)
    Sb = envg * np.sin(ph_g)
    yc = y @ Cb.T
    ys = y @ Sb.T
    cc = (Cb * Cb).sum(1); ss = (Sb * Sb).sum(1); cs = (Cb * Sb).sum(1)
    det = cc * ss - cs**2
    P = (ss[None, :] * yc**2 - 2 * cs[None, :] * yc * ys + cc[None, :] * ys**2) / det[None, :]
    k = P.argmax(1)
    k = np.clip(k, 1, len(grid) - 2)
    p0, p1, p2 = P[np.arange(ntr), k - 1], P[np.arange(ntr), k], P[np.arange(ntr), k + 1]
    dk = 0.5 * (p0 - p2) / np.where(p0 - 2 * p1 + p2 == 0, -1e-30, p0 - 2 * p1 + p2)
    est_ml = grid[k] + dk * (grid[1] - grid[0])
    # --- lock-in barato: referencia = modelo con tamano previo (error +-prior) ---
    a_prior = a_c * (1 + prior * rng.standard_normal(ntr))
    volp = 4 / 3 * np.pi * a_prior[:, None] ** 3 + QV * tt
    a_p = (3 * volp / (4 * np.pi)) ** (1 / 3)
    w_p = w_of_a(a_p)
    ph_p = np.cumsum(w_p, axis=1) / FS_CH
    ph_p -= ph_p[:, N // 2][:, None]
    z = y * np.exp(-1j * ph_p)
    nbox = int(round(FS_CH / f2_ref))
    cz = np.cumsum(z, axis=1)
    zf = (cz[:, nbox:] - cz[:, :-nbox]) / nbox
    tz = t[nbox:] - nbox / (2 * FS_CH)
    dec = max(1, nbox // 4)
    zf = zf[:, ::dec]; tz = tz[::dec]
    phs = np.unwrap(np.angle(zf), axis=1)
    wts = np.abs(zf) ** 2
    tm = (wts * tz).sum(1) / wts.sum(1)
    slope = ((wts * (tz - tm[:, None]) * (phs - (wts * phs).sum(1)[:, None] / wts.sum(1)[:, None])).sum(1)
             / (wts * (tz - tm[:, None]) ** 2).sum(1))
    # pendiente = w_real - w_ref en tm ; w_ref(tm)
    vref = 4 / 3 * np.pi * a_prior**3 + QV * tm
    a_ref_tm = (3 * vref / (4 * np.pi)) ** (1 / 3)
    w_est = w_of_a(a_ref_tm) + slope
    a_est_tm = (8 * SIG / (RHO_L * w_est**2)) ** (1 / 3)
    vol_c = 4 / 3 * np.pi * a_est_tm**3 - QV * tm
    est_li = (3 * np.maximum(vol_c, 1e-15) / (4 * np.pi)) ** (1 / 3)
    e_ml = (est_ml - a_true) / a_true
    e_li = (est_li - a_true) / a_true
    # CRLB aproximada (tono estacionario a f2_ref, misma envolvente)
    A = E * a_c * 1e3 * q0 * math.exp(-guard / tau)
    sf = crlb_ring(A, f2_ref, Qd, math.hypot(sig, SIG_V_ADC), T)
    crlb_a = (2 / 3) * sf / f2_ref
    rob = lambda e: 1.4826 * np.median(np.abs(e - np.median(e)))
    return rob(e_ml), np.mean(np.abs(e_ml) > 0.03), rob(e_li), np.mean(np.abs(e_li) > 0.03), crlb_a, A


print()
print("     Monte Carlo (300 gotas por renglon; escucha centrada en el tamano 0.46 mm; guarda de 0.3 ms tras el ping;")
print("     ritmo de crecimiento con +-10 %; lock-in con tamano previo +-5 %). sigma robusta del tamano y fraccion de errores > 3 %:")
print("      E V/mm  ruido V/m  T ms   q0     Q  | senal V | CRLB %  | ML sigma %  ML >3%  | lock-in sigma %  >3%  | lock-in um")
for E in (E_CANON, E_LIT):
    for sig in (0.1, 0.3, 1.0):
        for T in (2e-3, 5e-3):
            for q0, Qd in ((0.036, 30.0), (0.11, 30.0), (0.11, 10.0)):
                s_ml, o_ml, s_li, o_li, cr, A = mc_oido(E, sig, T, q0, Qd)
                print(f"      {E:5.1f}  {sig:6.1f}    {T*1e3:3.0f}   {q0:5.3f} {Qd:4.0f} | {A:6.3f}  | {cr*100:6.2f}  |  {s_ml*100:7.2f}   {o_ml*100:5.1f}  |  {s_li*100:9.2f}    {o_li*100:5.1f} | {s_li*460:7.1f}")
print("     sistematicos que el ruido no ve: la corriente base afloja la gota (f -2 % con beta=1 a 40 A, canales_gota) -> tamano +1.3 % = 6 um")
print("     si no se corrige; se corrige oyendo a dos corrientes base. Q (amortiguamiento) corre f en 1/(8Q^2): Q=10 -> 0.13 %.")

# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("5. PRESUPUESTO DEL PICO 2 (RP2350, 150 MHz, 2 nucleos M33, 3 PIO x 4 SM, ADC 500 kS/s)")
print("=" * 100)
cyc_pair = 150e6 / FS_CH
tasks = [
    ("convertir I,V (escala + offset)", 8),
    ("R = V/I (FDIV M33 ~14 ciclos) + min corriendo", 22),
    ("maquina de estados (toque/corto/apagado/cuello)", 30),
    ("detector de escalon (sumas corridas)", 12),
    ("acumuladores volt-segundo + ventanas por gota", 12),
    ("lock-in (2 MAC + caja de 1 periodo, tabla seno)", 20),
    ("bufer circular para registro (copia 4 bytes)", 6),
]
tot = sum(c for _, c in tasks)
print(f"     ADC round-robin I,V: {FS_CH/1e3:.0f} k pares/s, DMA a anillo en RAM: {FS_ADC*2/1e6:.1f} MB/s; nucleo 1 tiene {cyc_pair:.0f} ciclos por par")
for nm, c in tasks:
    print(f"       {nm:52s} {c:4d} ciclos  ({c/cyc_pair*100:4.1f} %)")
print(f"       {'TOTAL nucleo 1 (estimado, sin medir)':52s} {tot:4d} ciclos  ({tot/cyc_pair*100:4.1f} %)")
print(f"     PWM 100 kHz = {150e6/100e3:.0f} ciclos de sys; clk_adc 48 MHz del PLL USB, mismo cristal de 12 MHz -> fase fija: 5 muestras por periodo")
print(f"     (2 periodos = 5 pares: el promedio sobre 20 us cae en 5 fases uniformes -> el rizo y L dI/dt se cancelan salvo el 5o armonico)")
# residual del 5o armonico de un triangulo +-1.5 A y de una cuadrada L dI/dt +-1.76 V
tri5 = 8 / math.pi**2 / 25 * 1.5
sq5 = 4 / math.pi / 5 * L_CIRC * (VBUS - 20) / L_CHOKE
h1 = 1 / math.sqrt(1 + (500e3 / 50e3) ** 2)
h2 = 1 / (1 + (500e3 / 30e3) ** 2)
print(f"     residuo de aliasing (5o armonico = 500 kHz cae en DC): triangulo +-1.5 A -> {tri5*1e3:.0f} mA; cuadrada L_circ dI/dt +-{L_CIRC*(VBUS-20)/L_CHOKE:.2f} V -> {sq5*1e3:.0f} mV")
print(f"        tras RC 1 polo 50 kHz: {sq5*h1*1e3:.0f} mV de SESGO fijo (depende de D: se calibra con el toque) ; tras RC 2 polos 30 kHz: {sq5*h2*1e3:.1f} mV")
print(f"        (el RC de 2 polos agrega ~{2/(2*math.pi*30e3)*1e6:.0f} us a la deteccion por ADC; el corto lo ve el comparador de 1 bit en < 0.1 us)")
print(f"     V_bus (GP28) no necesita 250 kS/s: se lee 1 vez por ms cambiando la mascara del round-robin (pierde 0.4 % de pares)")
print(f"     RAM 520 kB: el anillo crudo de I,V (4 B por par) guarda {520e3*0.6/4/FS_CH*1e3:.0f} ms si se le da el 60 % de la RAM;")
print(f"     USB FS (12 Mbit/s, CDC real ~0.5-0.8 MB/s) NO saca 1 MB/s crudo: se registra decimado (10 kS/s = 40 kB/s) + rafagas crudas de eventos")
print("     PIO (3 bloques x 4 maquinas):")
print("       PIO0 SM0  PWM de Q1 (HIN): periodo fijo 1500 ciclos, ancho desde el FIFO, IRQ al centro de ON y de OFF")
print("       PIO0 SM1  comparador de 1 bit (GPIO con divisor /6.4): si V_out < ~5-13 V en ARCO -> IRQ y bandera en ~50 ns")
print("       PIO0 SM2  PARO/limite: si la bandera de corto + 'cuello' del nucleo 1 -> HIN abajo sin esperar al nucleo")
print("       PIO1 SM0  PWM del motor del avance + conteo de tiempo (el avance es el reloj de la masa)")
print("       PIO1 SM1  LED de sincronia con la camara (marca cada suelta de gota)")
print("     Nucleo 1: lazo de muestras (tabla de arriba). Nucleo 0: PI de corriente a 100 kHz (~150 ciclos = 10 %), estimadores lentos")
print("     (ventanas por gota, ajuste del oido, R_st, mapas), USB y registro.")

# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("6. LENTE DEL OPERADOR: el ciclo de trabajo como voltimetro (balance volt-segundo) y el segundo voltimetro")
print("=" * 100)
T = 1 / F_PWM
Np = 300000                                      # 3 s a 100 kHz
Iset = 40.0
Ik = Iset
Ds = np.empty(Np); Vb_true = np.empty(Np); Vo_true = np.empty(Np); Iks = np.empty(Np); Tj = np.empty(Np)
integ = 0.0
kp, ki = 0.02, 0.002
I_meas_prev = Iset
vb_noise = 0.08 * rng.standard_normal(Np)
arc_noise = 0.63 * rng.standard_normal(Np)        # 1 V/muestra blanco -> promedio de un periodo (2.5 muestras)
hall_noise = SIG_I * rng.standard_normal(Np)
for k in range(Np):
    tj = 25 + 60 * min(1.0, k / (Np * 2 / 3))     # D1 se calienta 60 K en 2 s y se queda
    vb = VBUS + vb_noise[k] + 0.10 * math.sin(2 * math.pi * 120 * k * T)
    vo = V0_ARC + 6 + Iset * (R_CIRC + R_ST_HOT) + V_TIP + arc_noise[k]   # promedio del periodo
    vf = 0.55 + 0.006 * Ik - 0.002 * (tj - 25)    # V_F del MBR40100CT [S]: -2 mV/K
    err = Iset - I_meas_prev
    integ += ki * err
    D = min(max((vo + 0.7) / VBUS + kp * err + integ, 0.0), 0.95)
    Inew = Ik + (D * (vb - Ik * 0.022) - (1 - D) * vf - Ik * 0.005 - vo) * T / L_CHOKE
    I_meas_prev = Ik + hall_noise[k]
    Ds[k] = D; Vb_true[k] = vb; Vo_true[k] = vo; Iks[k] = Ik; Tj[k] = tj
    Ik = Inew
W = 1000      # ventanas de 10 ms
nb = Np // W
# V_bus por ADC (/21) una vez por ms: 10 lecturas por ventana, cada una con ruido ENOB
sig_vb = VREF / (2**ENOB * math.sqrt(12)) * 21
vb_meas = Vb_true.reshape(nb, W).mean(1) + sig_vb / math.sqrt(10) * rng.standard_normal(nb)
vfn = 0.55 + 0.006 * Iks
est_vs = (Ds.reshape(nb, W) * vb_meas[:, None]).mean(1) - ((1 - Ds) * vfn).reshape(nb, W).mean(1) \
    - (Iks * 0.022 * Ds + Iks * 0.005).reshape(nb, W).mean(1)
Iw = Iks.reshape(nb, W)
est_vs -= L_CHOKE * ((Iw[:, -1] + SIG_I * rng.standard_normal(nb)) - (Iw[:, 0] + SIG_I * rng.standard_normal(nb))) / (W * T)
true_v = Vo_true.reshape(nb, W).mean(1)
adc_v = true_v + SIG_V_ADC / math.sqrt(2500) * rng.standard_normal(nb)
diff = est_vs - adc_v
tjb = Tj.reshape(nb, W).mean(1)
X = np.vstack([tjb, np.ones(nb)]).T
coef, res_, _, _ = np.linalg.lstsq(X, diff, rcond=None)
resid = diff - X @ coef
se = resid.std() / math.sqrt(((tjb - tjb.mean()) ** 2).sum())
print(f"     simulacion 3 s a 100 kHz, arco ~{true_v.mean():.1f} V, D medio {Ds.mean():.3f}; D1 sube 60 K en 2 s; ventanas de 10 ms")
print(f"     voltimetro 1 (sin ADC en V_out: D*V_bus - (1-D)*V_F - I*R - L*(I_fin - I_ini)/T_ventana, V_F nominal a 25 C):")
print(f"        error vs verdad: media {np.mean(est_vs-true_v)*1e3:+.0f} mV, sigma {np.std(est_vs-true_v)*1e3:.1f} mV por ventana")
print(f"     voltimetro 2 (ADC directo, 2500 muestras/ventana): sigma {np.std(adc_v-true_v)*1e3:.1f} mV")
print(f"     DESACUERDO (1 - 2) contra T de D1: pendiente {coef[0]*1e3:+.2f} +- {se*1e3:.2f} mV/K (teorico -(1-D)*2 mV/K = {-(1-Ds.mean())*2:.2f}),"
      f" residuo {resid.std()*1e3:.1f} mV por ventana")
print(f"     -> el desacuerdo es un termometro de D1: +-{resid.std()/abs(coef[0]):.0f} K por 10 ms, +-{resid.std()/abs(coef[0])/math.sqrt(10):.1f} K por 100 ms"
      f" (sustituye al NTC en GP29, que en la Pico 2 no existe)")
print(f"     ruido del voltimetro 1 por periodo sin telescopar: L*sigma_I*sqrt2/T = {L_CHOKE*SIG_I*math.sqrt(2)/T:.2f} V;"
      f" telescopado en 10 ms: {L_CHOKE*SIG_I*math.sqrt(2)/(W*T)*1e3:.1f} mV  (la bobina devuelve todo lo que presta)")
print(f"     sistematicos del voltimetro 1 que NO son D1: retardos del IR2110 (~25 ns de 10 us = 0.25 % de D -> {0.0025*VBUS*1e3:.0f} mV), R_ds(T);")
print(f"     se calibran a T ambiente contra el voltimetro 2 (por eso hacen falta los DOS: acuerdo o silencio)")

# ----------------------------------------------------------------------------------------------
print()
print("=" * 100)
print("7. MAPA DE CANALES (postulado de canal aplicado al SENSADO): cada cantidad con su banda/ventana, o se diluye")
print("=" * 100)
print("     cantidad              canal (banda / ventana / estado)              actuador propio?      choca con")
print("     contacto              amplitud de V, us, estado OCV->toque            si (OCV)              -")
print("     corto / cuello        R=V/I en estado CORTO, 4-40 us                   no (lo hace la gota)  ruido ADC (1 mOhm/par)")
print("     largo de arco         DC < 75 Hz, ventana = 1 periodo de gota          I y avance (lento)    V_punta, I*R_st, V0, R_circ")
print("     suelta de gota        escalon E*0.8 mm, 100 us                         la onda a f2          ruido del arco")
print("     tamano de gota        chirp 600-1300 Hz tras un ping                   la onda a f2          modo (0,2) del charco ~600 Hz")
print("     charco (tamano/T0)    100-400 Hz, sincronizado con la suelta           NO (lo patea la gota) desprendimientos, f2")
print("     T del stickout        R en CORTO o TOQUE (ventana de estado)           NO (I^2 lo mezcla)    R_puente, Holm")
print("     T de D1               desacuerdo voltimetro D vs voltimetro ADC        NO                    errores de ganancia (cal.)")
print("     R_circ, L_circ        toque de punta; salto de V ON/OFF del PWM        si (corriente)        contacto cobre-placa")
