import math, numpy as np, io, contextlib
src = open("canales_gota.py").read()
src = src[:src.index('print("=" * 96)\nprint(f"(A)')]
ns = {}
exec(compile(src, "c", "exec"), ns)
SIG, RHO, a, F2 = ns["SIG"], ns["RHO"], ns["a"], ns["F2"]
rng = np.random.default_rng(11)
m = RHO * 4/3*math.pi*a**3; ell = 2*a; I0 = 40.0
f1 = 0.5*F2; W1 = 2*math.pi*f1; Q1 = 30.0
accmT = I0*ell*1e-3/m
gap, v_down = 2.0e-3, 0.7; t_f = gap/v_down
dt = 1/(f1*200)

def run(Bfun, w1, T, kick=(0.0, 0.0)):
    x = y = vx = vy = 0.0; t = 0.0
    while t < T:
        bx, by = Bfun(t)
        ax = accmT*bx - w1/Q1*vx - w1*w1*x
        ay = accmT*by - w1/Q1*vy - w1*w1*y
        vx += ax*dt; vy += ay*dt; x += vx*dt; y += vy*dt; t += dt
    return x, y, vx, vy

def land(st, tf, kick=(0.0, 0.0)):
    x, y, vx, vy = st
    return x + (vx + kick[0])*tf, y + (vy + kick[1])*tf

def plan(target, mode, ncyc_burst=3, drop_life=0.05):
    """gemelo digital: con f1 y Q1 NOMINALES busca el instante de soltar (barrido fino) y escala B0 (lineal)."""
    L = math.hypot(*target); ang = math.atan2(target[1], target[0])
    if L == 0: return 0.0, drop_life
    if mode == "giro":
        t0 = 0.0
        Bf = lambda t, B=1.0: (B*math.cos(W1*t), B*math.sin(W1*t))
    else:  # patada: solo los ultimos n ciclos, en la direccion pedida
        t0 = drop_life - ncyc_burst/f1
        Bf = lambda t, B=1.0: ((B*math.cos(W1*t), B*math.sin(W1*t)) if t >= t0 else (0.0, 0.0))
    # busca el tiempo de soltar en la ultima vuelta que da el angulo pedido (con B=1 mT)
    best = None
    st = None
    x = y = vx = vy = 0.0; t = 0.0
    traj = []
    Tend = drop_life + 1.0/f1
    while t < Tend:
        bx, by = Bf(t)
        ax = accmT*bx - W1/Q1*vx - W1*W1*x
        ay = accmT*by - W1/Q1*vy - W1*W1*y
        vx += ax*dt; vy += ay*dt; x += vx*dt; y += vy*dt; t += dt
        if t >= drop_life:
            lx, ly = x + vx*t_f, y + vy*t_f
            d = abs((math.atan2(ly, lx) - ang + math.pi) % (2*math.pi) - math.pi)
            if best is None or d < best[0]: best = (d, t, math.hypot(lx, ly))
    _, t_rel, mag1 = best
    return L/mag1, t_rel     # B0 en mT, instante de soltar

def trial(target, mode, sd_f1, jitter=20e-6, sd_vd=0.10, sd_kick=0.02, n=60):
    B0, t_rel = plan(target, mode)
    errs = []
    t0 = 0.05 - 3/f1
    for _ in range(n):
        w1r = W1*(1 + sd_f1*rng.standard_normal())
        if mode == "giro":
            Bf = lambda t: (B0*math.cos(W1*t), B0*math.sin(W1*t))
        else:
            Bf = lambda t: ((B0*math.cos(W1*t), B0*math.sin(W1*t)) if t >= t0 else (0.0, 0.0))
        st = run(Bf, w1r, t_rel + jitter*rng.standard_normal())
        lx, ly = land(st, t_f*(1 + sd_vd*rng.standard_normal()), (sd_kick*rng.standard_normal(), sd_kick*rng.standard_normal()))
        errs.append(math.hypot(lx - target[0], ly - target[1]))
    return np.array(errs), B0

print("APUNTAR con gemelo digital (el Pico simula la gota con f1/Q1 nominales antes de soltar)")
print(" blanco a 0.5 mm | errores: soltar 20 us, bajada +-10 %, empujones 0.02 m/s, f1 real vs nominal")
for mode in ("giro", "patada"):
    for sd in (0.03, 0.01, 0.005, 0.0):
        e, B0 = trial((0.5e-3, 0.0), mode, sd)
        print(f"  {mode:7s} f1 calibrada a {sd*100:4.1f} %: error medio {e.mean()*1e6:5.0f} um, 90 % < {np.percentile(e,90)*1e6:5.0f} um, campo {B0:.2f} mT")
print()
print("PATRON: 19 blancos (hexagono 1 mm, paso 0.25 mm), cabeza quieta, f1 calibrada a 1 %, patada de 3 ciclos")
pts = [(0.0, 0.0)]
for ring_i in (1, 2):
    for k in range(6*ring_i):
        ang = 2*math.pi*k/(6*ring_i)
        pts.append((ring_i*0.25e-3*math.cos(ang), ring_i*0.25e-3*math.sin(ang)))
allE = []
for p in pts:
    e, B0 = trial(p, "patada", 0.01, n=30)
    allE.append(e)
allE = np.concatenate(allE)
print(f"  error de caida: mediana {np.median(allE)*1e6:.0f} um, 90 % < {np.percentile(allE,90)*1e6:.0f} um (paso entre blancos 250 um)")
print()
print("SIN APUNTAR (campo apagado): dispersion por empujones del arco y bajada: ", end="")
e, _ = trial((0.0, 0.0), "patada", 0.0, n=400)
print(f"mediana {np.median(e)*1e6:.0f} um")
