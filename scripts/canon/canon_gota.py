#!/usr/bin/env python3
"""
El canon de gotas: dos ondas en el cable (DC que calienta + AC que hace bailar la gota).
Base: modelo de junio (scripts/gota-oscilador-resonante.py): modo l=2 de Rayleigh,
  q'' + g q' + w2^2 q = w2^2 (I/Icrit)^2 ,  desprende cuando q >= 1.
Nuevo aqui:
  (1) tabla por tamano de gota: f2, Q, tiempo de carga (ring-up), corriente AC para soltar en N ciclos,
      con el Q ideal (Lamb) y con un Q realista mas bajo (la gota pegada al alambre + arco amortigua mas).
  (2) el OIDO: el voltaje del arco cambia con la distancia (V = 14 + 10 V/mm * gap, medido por ian);
      la gota que oscila mueve su punta -> el voltaje lleva la oscilacion. Cuantos volts y cuanta precision
      de tamano da medir la frecuencia de "campana" (ping: un toque de corriente y escuchar el timbre).
  (3) una gota completa, paso a paso: crece -> ping -> oye su frecuencia -> calcula su tamano ->
      dispara a SU frecuencia cuando llega al tamano pedido. Contra disparar a ciegas con avance +-10 %.
"""
import numpy as np
SIG, RHO, MU = 1.5, 7000.0, 6e-3
NU = MU / RHO
ICRIT = 194.0
AW = np.pi * (0.4e-3) ** 2           # alambre 0.8 mm
KV = 10.0                            # V por mm de gap (ian: V_arco = 14 + 10*gap)

def w2(a): return np.sqrt(8 * SIG / (RHO * a ** 3))
def q_lamb(a): return w2(a) * a * a / (10 * NU)          # Q = w2 / (2/tau), tau = a^2/(5 nu)
def a_from_f(f): return (8 * SIG / (RHO * (2 * np.pi * f) ** 2)) ** (1 / 3)

def ringup_cycles(a, Q, I0, I1, nmax=400, dt_frac=1 / 200):
    """ciclos de forzado a resonancia hasta q>=1 (None si no llega)."""
    W = w2(a); g = W / Q; dt = (2 * np.pi / W) * dt_frac
    q = v = 0.0; ph = 0.0
    for k in range(int(nmax / dt_frac)):
        I = I0 + I1 * np.cos(ph)
        acc = W * W * (I / ICRIT) ** 2 - g * v - W * W * q
        v += acc * dt; q += v * dt; ph += W * dt
        if q >= 1.0:
            return ph / (2 * np.pi)
    return None

def i1_for_cycles(a, Q, I0, N):
    lo, hi = 0.0, 200.0
    if ringup_cycles(a, Q, I0, hi, nmax=N) is None: return float("nan")
    for _ in range(30):
        mid = 0.5 * (lo + hi)
        if ringup_cycles(a, Q, I0, mid, nmax=N) is None: lo = mid
        else: hi = mid
    return hi

print("=" * 92)
print("(1) LA GOTA COMO CAMPANA: frecuencia, Q, tiempo de carga y onda AC para soltarla (base I0 = 30 A)")
print("=" * 92)
print(f"  {'a mm':>5} {'f2 Hz':>7} {'Q Lamb':>7} {'carga ms':>9} | {'I_AC para soltar en 10 ciclos':>30} | {'en 20 ciclos':>14}")
print(f"  {'':>5} {'':>7} {'':>7} {'(Q ideal)':>9} | {'Q ideal':>9} {'Q=30':>9} {'Q=10':>9} | {'Q ideal':>6} {'Q=30':>6}")
for a_mm in (0.30, 0.38, 0.46, 0.55):
    a = a_mm * 1e-3; W = w2(a); Ql = q_lamb(a)
    r = [i1_for_cycles(a, Q, 30.0, N) for (Q, N) in ((Ql, 10), (30, 10), (10, 10), (Ql, 20), (30, 20))]
    print(f"  {a_mm:5.2f} {W/2/np.pi:7.0f} {Ql:7.0f} {2*Ql/W*1e3:9.1f} | {r[0]:7.1f} A {r[1]:7.1f} A {r[2]:7.1f} A | {r[3]:5.1f} A {r[4]:5.1f} A")
print("  pinch estatico (sin resonancia): 194 A. La resonancia cambia 194 A por ~10-25 A de onda.")

print()
print("=" * 92)
print("(2) EL OIDO: el voltaje del arco escucha la gota")
print("=" * 92)
for a_mm in (0.30, 0.46):
    a = a_mm * 1e-3
    for qa in (0.05, 0.1, 0.2):
        dv = KV * qa * a_mm
        print(f"  gota {a_mm:.2f} mm oscilando a q={qa:.2f} (punta se mueve {qa*a_mm*1000:4.0f} um): el arco cambia {dv*1000:5.0f} mV "
              f"= {dv/16/3.3*4096:4.0f} cuentas del ADC (divisor /16)")
print("  la frecuencia que se oye da el tamano: a = (8 sigma / (rho w^2))^(1/3)  ->  error de tamano = (2/3) error de frecuencia")
for f_res_hz, T_ms in ((5, 5), (2, 10), (1, 20)):
    print(f"  oir {T_ms:2d} ms de campana con resolucion {f_res_hz} Hz a 668 Hz -> tamano a +-{(2/3)*f_res_hz/668*100:.2f} % (+-{(2/3)*f_res_hz/668*460:.1f} um)")

print()
print("=" * 92)
print("(3) UNA GOTA COMPLETA, CON OIDO vs A CIEGAS (Monte Carlo 60 gotas por caso, avance +-10 %, ruido 10 mV en el voltaje; base 40 A + onda 30 A: nunca baja de 10 A)")
print("=" * 92)
rng = np.random.default_rng(7)
import math

def simulate(mode, Q_fixed, n=60, a_seed=0.30e-3, a_target=0.46e-3, vf0=0.010, I0=40.0, I1=30.0, ncyc=8,
             noise_v=0.010, dt=5e-6, trace=False):
    """Una gota por corrida. La onda de disparo SIGUE a la gota (chirp) segun un modelo de crecimiento V(t).
       ciegas: V(t) = V_seed + Aw*vf0*t  (avance nominal; el real varia +-10 %).
       oido  : cada 4 ms un golpecito de 10 A por 0.8 ms; despues se escucha 3 ms: el voltaje del arco se
               demodula contra la onda del modelo (lock-in) y la velocidad de giro de su fase da
               w_real - w_modelo -> frecuencia real -> tamano -> volumen. Regresion V(t) con lo oido."""
    sizes, traces = [], []
    V_seed = 4/3*math.pi*a_seed**3; V_tgt = 4/3*math.pi*a_target**3
    tau_li = 0.0006
    for k in range(n):
        vf = vf0*(1 + 0.10*rng.standard_normal())
        Vol = V_seed; q = v = 0.0; t = 0.0; ph = 0.0
        firing = False
        ping_t0 = 0.002; ping_end = ping_t0 + 0.0008; listen_end = ping_end + 0.0032
        X = Y = 0.0; phs = []; obs = []
        fitV0, fitR = V_seed, Aw_nom*vf0
        rec = []
        while t < 0.12:
            a = (3*Vol/(4*math.pi))**(1/3)
            W = math.sqrt(8*SIG/(RHO*a**3)); Q = (W*a*a/(10*NU)) if Q_fixed is None else Q_fixed; g = W/Q
            Vmod = fitV0 + fitR*t
            amod = (3*max(Vmod, V_seed*0.5)/(4*math.pi))**(1/3)
            Wmod = math.sqrt(8*SIG/(RHO*amod**3))
            I = I0
            if not firing:
                T_fire = ncyc*2*math.pi/Wmod
                if fitV0 + fitR*(t + 0.6*T_fire) >= V_tgt and (mode == "ciegas" or len(obs) >= 3):
                    firing = True
                if mode == "oido" and ping_t0 <= t < ping_end:
                    I = I0 + 10.0*math.cos(ph)
            if firing:
                I = I0 + I1*math.cos(ph)
            ph += Wmod*dt
            acc = W*W*((I/ICRIT)**2 - (I0/ICRIT)**2) - g*v - W*W*q
            v += acc*dt; q += v*dt
            Vol += Aw_nom*vf*dt; t += dt
            if mode == "oido" and not firing:
                y = KV*q*a*1e3 + noise_v*rng.standard_normal()
                X += (y*math.cos(ph) - X)*dt/tau_li; Y += (y*math.sin(ph) - Y)*dt/tau_li
                if ping_end + 0.0004 <= t < listen_end:
                    phs.append((t, math.atan2(Y, X)))
                elif t >= listen_end and phs:
                    tt = np.array([p[0] for p in phs]); pp = np.unwrap(np.array([p[1] for p in phs]))
                    slope = np.polyfit(tt, pp, 1)[0]            # = w_modelo - w_real (la fase de referencia corre con w_modelo)
                    tm = tt.mean(); Vm = fitV0 + fitR*tm
                    am = (3*Vm/(4*math.pi))**(1/3); Wm = math.sqrt(8*SIG/(RHO*am**3))
                    W_est = Wm - slope
                    a_e = (8*SIG/(RHO*W_est**2))**(1/3)
                    obs.append((tm, 4/3*math.pi*a_e**3)); phs = []
                    if len(obs) >= 3:
                        o = np.array(obs[-8:]); sol = np.polyfit(o[:, 0], o[:, 1], 1)
                        fitR, fitV0 = float(max(sol[0], 1e-13)), float(sol[1])
                    ping_t0 = t + 0.0002; ping_end = ping_t0 + 0.0008; listen_end = ping_end + 0.0032
            if trace and k == 0 and int(round(t/dt)) % 400 == 0:
                rec.append((t, a*1e3, (3*max(fitV0+fitR*t,1e-15)/(4*math.pi))**(1/3)*1e3, q, I, firing))
            if q >= 1.0:
                sizes.append(a); break
        else:
            sizes.append(float("nan"))
        if trace and k == 0: traces = rec
    return np.array(sizes), traces

Aw_nom = AW
for Q_fixed in (None, 30):
    for mode in ("ciegas", "oido"):
        r, _ = simulate(mode, Q_fixed)
        ok = np.isfinite(r); rr = r[ok]*1e3
        lab = "Q ideal" if Q_fixed is None else f"Q={Q_fixed}"
        if ok.any():
            print(f"  {lab:8s} {mode:7s}: sueltan {ok.mean()*100:5.1f} %   tamano {rr.mean():.3f} mm   dispersion {rr.std()*1000:5.1f} um ({rr.std()/rr.mean()*100:4.1f} %)   error vs 0.460: {(rr.mean()-0.46)*1000:+5.1f} um")
        else:
            print(f"  {lab:8s} {mode:7s}: ninguna gota se suelta")

print()
print("  traza cruda de UNA gota con oido (Q=30): t ms | tamano real | tamano que oye el modelo | q | corriente | disparando")
_, tr = simulate("oido", 30, n=1, trace=True)
for row in tr[::3]:
    print(f"   {row[0]*1e3:6.2f} | {row[1]:.3f} mm | {row[2]:.3f} mm | {row[3]:+.3f} | {row[4]:5.1f} A | {'SI' if row[5] else '--'}")
