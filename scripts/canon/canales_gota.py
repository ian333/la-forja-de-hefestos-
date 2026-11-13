#!/usr/bin/env python3
"""
La gota en la cara-i: canales y actuadores (exploracion).
Modelo base (junio): q'' + (w/Q) q' + w^2 q = w^2 s(t),  s = (I/Icrit)^2,  suelta si q >= 1.
Nuevo:
  (A) el pellizco tambien AFLOJA la rigidez (el cuello delgado lleva mas densidad de corriente):
        q'' + (w/Q) q' + w^2 [1 - beta s(t)] q = w^2 s(t)
      beta = 0 es el modelo de junio. Con beta > 0, s(t) a 2w bombea parametrico (Mathieu).
      Barrido de la frecuencia de la onda: lengua en w (aditiva) y lengua en 2w (parametrica).
  (B) dos tonos: I = I0 + I1 cos(wt) + I2 cos(2wt + psi): el 2w amplifica al w si la fase es buena.
  (C) apuntar: modo l=1 (mecerse de lado) movido por un campo B cruzado con la corriente del arco.
      dos bobinas en cuadratura -> la gota gira; se suelta en la fase elegida -> cae donde se pide.
Todo normalizado a la gota de 0.46 mm (f2 = 668 Hz) del modelo de junio.
"""
import numpy as np, math
SIG, RHO, MU = 1.5, 7000.0, 6e-3
ICRIT = 194.0
a = 0.46e-3
W2 = math.sqrt(8 * SIG / (RHO * a ** 3)); F2 = W2 / 2 / math.pi
rng = np.random.default_rng(3)

def detach_cycles(r, Q, beta, I0, I1, I2=0.0, psi=0.0, ncyc_max=40, spp=300, seed_q=0.02):
    """r: arreglo de (frecuencia de la onda / f2). Devuelve ciclos de gota hasta soltar (nan si no)."""
    r = np.atleast_1d(np.asarray(r, float))
    dt = 2 * math.pi / spp
    s0 = (I0 / ICRIT) ** 2
    q = np.full_like(r, s0 / (1 - beta * s0) + seed_q); v = np.zeros_like(r)
    out = np.full_like(r, np.nan)
    for k in range(int(ncyc_max * spp)):
        t = k * dt
        I = I0 + I1 * np.cos(r * t) + I2 * np.cos(2 * r * t + psi)
        s = (np.maximum(I, 0.0) / ICRIT) ** 2
        acc = s - v / Q - (1 - beta * s) * q
        v = v + acc * dt; q = q + v * dt
        hit = np.isnan(out) & (q >= 1.0)
        out[hit] = t / (2 * math.pi)
        if not np.isnan(out).any(): break
    return out

def tongue(r, c):
    ok = np.isfinite(c)
    if not ok.any(): return "—"
    return f"{r[ok].min():.2f}–{r[ok].max():.2f}  (mín {np.nanmin(c):.0f} ciclos)"

print("=" * 96)
print(f"(A) LENGUAS: con que frecuencias de onda se suelta la gota (0.46 mm, f2 = {F2:.0f} Hz), base 40 A + onda 30 A, max 40 ciclos")
print("=" * 96)
r = np.round(np.arange(0.40, 2.40001, 0.01), 3)
for Q in (30, 100):
    for beta in (0.0, 1.0, 2.0):
        c = detach_cycles(r, Q, beta, 40.0, 30.0)
        m1 = (r > 0.6) & (r < 1.5); m2 = (r >= 1.5)
        print(f"  Q={Q:3d} beta={beta:.1f} | lengua en w: {tongue(r[m1], c[m1]):32s} | lengua en 2w: {tongue(r[m2], c[m2])}")
print("  ancho de la lengua = cuanto puede desafinarse la onda (la gota que crece) sin dejar de soltarla")

print()
print("=" * 96)
print("(B) DOS TONOS w + 2w con el mismo pico de corriente (40 A de base, picos <= 70 A), Q = 30")
print("=" * 96)
for beta in (0.0, 1.0, 2.0):
    base = detach_cycles([1.0], 30, beta, 40.0, 30.0)[0]
    best = (None, 1e9)
    row = []
    for psi_deg in range(0, 360, 30):
        c = detach_cycles([1.0], 30, beta, 40.0, 18.0, 12.0, math.radians(psi_deg))[0]
        row.append(c)
        if np.isfinite(c) and c < best[1]: best = (psi_deg, c)
    print(f"  beta={beta:.1f}: un tono (30 A @ w) suelta en {base:5.1f} ciclos | dos tonos (18 A @ w + 12 A @ 2w): "
          + " ".join("—" if not np.isfinite(x) else f"{x:4.1f}" for x in row) + f"   (psi 0..330 cada 30)  mejor psi={best[0]}")
# tolerancia a desafinar con dos tonos vs uno
print("  tolerancia a desafinar (rango de f/f2 que suelta en <= 40 ciclos), beta = 1, Q = 30:")
r2 = np.round(np.arange(0.80, 1.2001, 0.005), 3)
c1 = detach_cycles(r2, 30, 1.0, 40.0, 30.0)
c2 = detach_cycles(r2, 30, 1.0, 40.0, 18.0, 12.0, math.radians(0))
print(f"     un tono : {tongue(r2, c1)}")
print(f"     dos tonos (psi 0): {tongue(r2, c2)}")

print()
print("=" * 96)
print("(C) APUNTAR LA GOTA: modo l=1 (mecerse) con dos bobinas en cuadratura")
print("=" * 96)
m = RHO * 4 / 3 * math.pi * a ** 3
ell = 2 * a                       # largo de corriente a traves de la gota
I0 = 40.0
f1 = 0.5 * F2                     # SUPUESTO: el mecerse va a ~la mitad de la frecuencia de estirar
W1 = 2 * math.pi * f1
Q1 = 30.0
acc_per_mT = I0 * ell * 1e-3 / m
print(f"  gota {a*1e3:.2f} mm: masa {m*1e9:.2f} mg; fuerza por mT = {I0*ell*1e-3*1e6:.1f} uN -> aceleracion {acc_per_mT:.1f} m/s^2 por mT")
print(f"  mecerse a f1 = {f1:.0f} Hz (supuesto 0.5 f2), Q1 = {Q1:.0f}: desplazamiento estatico {acc_per_mT/W1**2*1e6:.2f} um/mT, "
      f"en resonancia {acc_per_mT/W1**2*Q1*1e6:.0f} um/mT; carga en {2*Q1/W1*1e3:.0f} ms")
gap, v_down = 2.0e-3, 0.7
t_f = gap / v_down
print(f"  vuelo: separacion {gap*1e3:.1f} mm, bajada {v_down} m/s -> {t_f*1e3:.1f} ms; w1*t_f = {W1*t_f:.2f}")
print(f"  si se suelta girando en un circulo de radio R, cae a R*sqrt(1+(w1 t_f)^2) = {math.sqrt(1+(W1*t_f)**2):.2f} R del centro")

def aim_sim(targets, n_rep=25, jitter_t=20e-6, sd_vdown=0.10, sd_kick=0.02, sd_f1=0.03, drop_life=0.05, calibrated=True):
    """Para cada blanco (dx,dy) elige B0 y la fase de soltar con el modelo; simula el ODE 2D de l=1 con
       errores (fase de soltar, velocidad de bajada, empujones del arco, f1 real vs supuesta)."""
    res = []
    dt = 1 / (f1 * 200)
    for (dx, dy) in targets:
        L = math.hypot(dx, dy); ang = math.atan2(dy, dx)
        R = L / math.sqrt(1 + (W1 * t_f) ** 2)
        phi = ang - math.atan(W1 * t_f)
        # B0 para radio R en estado estacionario (resonancia); ring-up 1 - exp(-t/tau) a drop_life
        ring = 1 - math.exp(-drop_life * W1 / (2 * Q1))
        B0 = R / (acc_per_mT / W1 ** 2 * Q1 * ring) if L > 0 else 0.0
        for k in range(n_rep):
            w1r = W1 * (1 + sd_f1 * rng.standard_normal()) if calibrated else W1 * (1 + 0.15 * rng.standard_normal())
            x = y = vx = vy = 0.0; t = 0.0
            # se suelta en la fase phi del giro despues de drop_life (+ jitter)
            n_turn = math.floor(W1 * drop_life / (2 * math.pi))
            t_rel = (n_turn * 2 * math.pi + (phi % (2 * math.pi)) + math.pi / 2) / W1  # la respuesta en resonancia va 90 grados atras de la fuerza
            t_rel += jitter_t * rng.standard_normal()
            while t < t_rel:
                ax = acc_per_mT * B0 * math.cos(W1 * t) - w1r / Q1 * vx - w1r ** 2 * x
                ay = acc_per_mT * B0 * math.sin(W1 * t) - w1r / Q1 * vy - w1r ** 2 * y
                vx += ax * dt; vy += ay * dt; x += vx * dt; y += vy * dt; t += dt
            tf = t_f * (1 + sd_vdown * rng.standard_normal())
            kx, ky = sd_kick * rng.standard_normal(), sd_kick * rng.standard_normal()
            res.append((dx, dy, x + (vx + kx) * tf, y + (vy + ky) * tf, B0))
    return np.array(res)

# patron hexagonal de 19 puntos con paso 0.25 mm dentro de 0.5 mm, cabeza QUIETA
pts = [(0.0, 0.0)]
for ring_i in (1, 2):
    for k in range(6 * ring_i):
        ang = 2 * math.pi * k / (6 * ring_i)
        pts.append((ring_i * 0.25e-3 * math.cos(ang), ring_i * 0.25e-3 * math.sin(ang)))
res = aim_sim(pts)
err = np.hypot(res[:, 2] - res[:, 0], res[:, 3] - res[:, 1])
print(f"\n  19 blancos en un hexagono de 1 mm, cabeza QUIETA, 25 gotas por blanco:")
print(f"   error de caida: mediana {np.median(err)*1e6:.0f} um, 90 % < {np.percentile(err,90)*1e6:.0f} um; campo maximo usado {res[:,4].max():.2f} mT")
for (dx, dy) in pts[:1] + pts[1:7:2] + pts[7::4]:
    sel = (np.abs(res[:, 0] - dx) < 1e-9) & (np.abs(res[:, 1] - dy) < 1e-9)
    e = np.hypot(res[sel, 2] - dx, res[sel, 3] - dy)
    print(f"   blanco ({dx*1e3:+.2f}, {dy*1e3:+.2f}) mm -> cae en ({res[sel,2].mean()*1e3:+.3f}, {res[sel,3].mean()*1e3:+.3f}) mm  dispersion {e.std()*1e6:4.0f} um  campo {res[sel,4][0]:.2f} mT")
print("\n  presupuesto de error (una fuente a la vez, blanco a 0.5 mm):")
for lab, kw in [("solo fase de soltar (20 us)", dict(sd_vdown=0, sd_kick=0, sd_f1=0)),
                ("solo bajada +-10 %", dict(jitter_t=0, sd_kick=0, sd_f1=0)),
                ("solo empujones del arco 0.02 m/s", dict(jitter_t=0, sd_vdown=0, sd_f1=0)),
                ("solo f1 mal calibrada 3 %", dict(jitter_t=0, sd_vdown=0, sd_kick=0)),
                ("todo junto", dict())]:
    rr = aim_sim([(0.5e-3, 0.0)], n_rep=200, **kw)
    e = np.hypot(rr[:, 2] - 0.5e-3, rr[:, 3])
    print(f"   {lab:36s}: error medio {e.mean()*1e6:5.0f} um")
