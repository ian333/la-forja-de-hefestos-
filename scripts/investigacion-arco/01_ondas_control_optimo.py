#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INVESTIGACIÓN DEL ARCO · 01 · «millones de ondas»
¿Qué FORMA de fuerza suelta mejor la gota y qué gana el control con retroalimentación (el oído)?

Modelo de la gota (el del canon: scripts/canon/canon_gota.py y canales_gota.py):
    q'' + (w/Q) q' + w^2 [1 - beta s] q = w^2 s ,   s = (I/Icrit)^2 ,   suelta cuando q >= 1
    w^2 = (1+eps)^2 * 8 sigma / (rho a^3)   (eps = cuánto se equivoca el modelo en la f2 real)
    la gota crece con el alambre: dV/dt = A_w * v_f        beta = 1 (hallazgo del canon)
Actuador (ajustado a scripts/canon/canon_corriente.out): primer orden tau_c + pendiente limitada
    hoy  (20 kHz, PI lento):            tau_c = 150 us
    meta (100 kHz, PI rápido + anticip.): tau_c = 5 us, manda la pendiente
    pendiente: subir (0.75*48 - 18.8 V)/41 uH = 0.42 A/us ; bajar (18.8 + 0.6 V)/41 uH = 0.47 A/us
Oído: V_arco = 14 + 10 V/mm * gap (ian) -> y = -10 V/mm * a[mm] * q  - 2*10 V/mm*a[mm] (la gota crece)
      + dR*(I - I0) (resto de restar R*I, 1 mOhm) + ruido del arco + ruido del ADC del Pico.
      El Pico estima la gota con un filtro de Kalman extendido de 6 estados [q, q'/w, ln w, d ln w/dt, b, b'].

Uso:  python3 01_ondas_control_optimo.py              (todo; ~3 min con 16 procesos en iangpu)
      python3 01_ondas_control_optimo.py --rapido     (N chico, solo para probar)
      python3 01_ondas_control_optimo.py --procs 16
"""
import math, sys, time
import numpy as np
from multiprocessing import Pool

# ----------------------------------------------------------------------------------------------
# Constantes del canon
# ----------------------------------------------------------------------------------------------
SIG, RHO, MU = 1.5, 7000.0, 6e-3
NU = MU / RHO
ICRIT = 194.0
RW = 0.4e-3
AW = math.pi * RW ** 2
KV = 10.0                       # V por mm de gap
A_TGT, A_SEED = 0.46e-3, 0.30e-3
def vol(a): return 4.0 / 3.0 * math.pi * a ** 3
V_TGT, V_SEED = vol(A_TGT), vol(A_SEED)
I0, IMIN = 40.0, 10.0
BETA = 1.0
DT = 5e-6
S_UP = (0.75 * 48 - 18.8) / 41e-6       # A/s
S_DN = (18.8 + 0.6) / 41e-6
LOOPS = {
    "20k":  dict(fc=20e3,  tau=150e-6, lead=160e-6),
    "100k": dict(fc=100e3, tau=5e-6,   lead=75e-6),
}
KW = math.sqrt(32 * math.pi * SIG / (3 * RHO))      # w = KW * V^(-1/2)
ADC_RAW = 52.8 / 2 ** 9 / math.sqrt(12)              # V de arco rms por muestra cruda (ENOB 9, divisor /16)
HOLD_DEF = (25.0, 55.0)                                  # banda de escucha (piloto) alrededor de 40 A
A_PILOT_DEF = 0.15                                       # amplitud del piloto (la campana suena bajito)
KAPPA = 0.7                                          # autoridad usada por la referencia de bb_z


def w_nom(a):
    return np.sqrt(8 * SIG / (RHO * a ** 3))


def a_of_w(w):
    return (8 * SIG / (RHO * w ** 2)) ** (1.0 / 3.0)


def sq(I):
    return (I / ICRIT) ** 2


def qeq(s):
    return s / (1 - BETA * s)


def life_nom(vf):
    return (V_TGT - V_SEED) / (AW * vf)


def multitone_set(K):
    d = np.linspace(-0.05, 0.05, K)
    psi = np.array([-math.pi * k * (k - 1) / K for k in range(K)])
    tt = np.linspace(0, 60 * 2 * math.pi, 200000)
    tot = np.zeros_like(tt)
    for dk, pk in zip(d, psi):
        tot += np.cos((1 + dk) * tt + pk)
    return d, psi, 1.0 / np.abs(tot).max()


MT = {3: multitone_set(3), 5: multitone_set(5)}
OL = ("tono", "multi3", "multi5", "chirp", "chirp_raiz")
FB = ("chirp_oido", "w2_fb", "bb_v", "bb_z")


# ----------------------------------------------------------------------------------------------
# Simulador vectorizado: N gotas en paralelo, todas con t = 0 en la semilla de 0.30 mm
# ----------------------------------------------------------------------------------------------
def run_cfg(cfg):
    rng = np.random.default_rng(cfg["seed"])
    beta = cfg.get("beta", BETA)
    qeq_l = lambda s_: s_ / (1 - beta * s_)
    N = cfg["N"]; strat = cfg["strat"]; Q = cfg["Q"]; vf_nom = cfg["vf"]; imax = cfg["imax"]
    loop = LOOPS[cfg.get("loop", "20k")]
    nc = int(round(1 / (loop["fc"] * DT)))
    dtc = nc * DT
    alpha_c = 1 - math.exp(-DT / loop["tau"])
    world = cfg["world"]
    noise_v = cfg.get("noise", 0.010)
    Qh = Q * cfg.get("qhat_mult", 1.0)
    lead = loop["lead"]
    perr = math.radians(cfg.get("perr", 0.0))
    A_PILOT = cfg.get("apil", A_PILOT_DEF)
    HOLD = cfg.get("hold", HOLD_DEF)
    # ---- el mundo (lo que el controlador no sabe) ----
    if world == "nom":
        eps = np.zeros(N); vfm = np.ones(N); r0 = np.zeros(N); dR = np.zeros(N)
    else:
        eps = 0.01 * rng.standard_normal(N) if world == "cal" else rng.uniform(-0.05, 0.05, N)
        vfm = np.clip(1 + 0.10 * rng.standard_normal(N), 0.6, 1.4)
        r0 = rng.uniform(0, 0.3, N)
        dR = cfg.get("dR", 1e-3) * rng.standard_normal(N)
    ph0 = rng.uniform(0, 2 * math.pi, N)
    vf = vf_nom * vfm
    eps_hat = 0.0
    # ---- estado físico ----
    Vol = np.full(N, V_SEED)
    s0 = sq(I0)
    W0 = (1 + eps) * w_nom(A_SEED)
    weff0 = W0 * math.sqrt(1 - beta * s0)
    q = qeq_l(s0) + r0 * np.cos(ph0)
    v = -r0 * weff0 * np.sin(ph0)
    I = np.full(N, I0)
    active = np.ones(N, bool)
    a_rel = np.full(N, np.nan); t_rel = np.full(N, np.nan)
    E2 = np.zeros(N); E1 = np.zeros(N)
    cyc = np.zeros(N)              # ciclos de la gota desde que se dispara
    fired = np.zeros(N, bool); t_fire = np.full(N, np.nan)
    tstar_rel = np.full(N, np.nan)  # lo que el controlador creía (t*) al soltarse
    Imid = 0.5 * (imax + IMIN); Aamp = 0.5 * (imax - IMIN)
    smin, smax = sq(IMIN), sq(imax)
    sbar_full = 0.5 * (smin + smax); qc_full = qeq_l(sbar_full)
    sbar_hold = 0.5 * (sq(HOLD[0]) + sq(HOLD[1])); qc_hold = qeq_l(sbar_hold)
    tl = life_nom(vf_nom)
    tmax = cfg.get("tmax", 1.5 * tl + 8e-3)
    ton = np.asarray(cfg.get("ton", np.full(N, np.inf)), float) * np.ones(N)
    # frecuencias del modelo nominal (lo que sabe el controlador a ciegas)
    if strat in ("tono", "multi3", "multi5"):
        sb = sbar_full if strat == "tono" else qc_full * 0 + 0.5 * (smin + smax)
        w_tgt = (1 + eps_hat) * w_nom(A_TGT) * math.sqrt(1 - beta * sb)
    if strat.startswith("multi"):
        dk, psik, msc = MT[int(strat[-1])]
    if strat in ("chirp", "chirp_raiz"):
        corr = math.sqrt(1 - beta * sbar_full) * (1 + eps_hat)
        def Phi_nom(tt):
            Vn = V_SEED + AW * vf_nom * tt
            return corr * 2 * KW * np.sqrt(Vn) / (AW * vf_nom)
        Phi_on = Phi_nom(np.where(np.isfinite(ton), ton, 0.0))
    # ---- el oído: EKF de 6 estados ----
    use_ekf = strat in FB
    if use_ekf:
        sig_tick = math.sqrt((noise_v * math.sqrt(loop["fc"] / 20e3)) ** 2 + (ADC_RAW / math.sqrt(500e3 / loop["fc"])) ** 2)
        R_meas = sig_tick ** 2
        X = np.zeros((N, 6))
        X[:, 0] = qeq_l(s0)
        X[:, 2] = math.log((1 + eps_hat) * w_nom(A_SEED))
        X[:, 3] = 1.0                                  # m: avance real / nominal (el oído lo aprende)
        amm0 = A_SEED * 1e3
        X[:, 4] = -2 * KV * amm0
        X[:, 5] = -2 * KV * 1e3 * AW * vf_nom / (4 * math.pi * A_SEED ** 2)
        P = np.zeros((N, 6, 6))
        for k, sd in enumerate((0.3, 0.3, 0.06, 0.12, 0.5, 0.5 * abs(X[0, 5]))):
            P[:, k, k] = sd ** 2
        Qd = np.diag([1e-8, (cfg.get("sp", 2e-4)) ** 2, (cfg.get("sth", 0.005) ** 2) * dtc, (0.02 ** 2) * dtc / tl,
                      (0.05 ** 2) * dtc, (0.5 * abs(X[0, 5])) ** 2 * dtc / tl])
        Phi_hat = np.zeros(N)
        Phi_fire = np.zeros(N)
        s_ema = np.full(N, s0)                       # promedio lento de s (centro de la oscilación)
        Id6 = np.eye(6)
    trace = [] if cfg.get("trace") else None
    Iref = np.full(N, I0)
    nsteps = int(tmax / DT)
    rec_every = max(1, int(5e-4 / DT))
    for k in range(nsteps):
        t = k * DT
        # =================== controlador (cada tick del lazo) ===================
        if k % nc == 0:
            a_true = (3 * Vol / (4 * math.pi)) ** (1 / 3)
            if strat in OL:
                on = t >= ton
                if strat == "tono":
                    Iw = Imid + Aamp * np.cos(w_tgt * (t - ton))
                elif strat.startswith("multi"):
                    acc_ = np.zeros(N)
                    for d_, p_ in zip(dk, psik):
                        acc_ += np.cos(w_tgt * (1 + d_) * (t - ton) + p_)
                    Iw = Imid + Aamp * msc * acc_
                elif strat == "chirp":
                    Iw = Imid + Aamp * np.cos(Phi_nom(t) - Phi_on)
                else:  # chirp_raiz: fuerza senoidal pura (I = Icrit*sqrt(s))
                    ss = 0.5 * (smin + smax) + 0.5 * (smax - smin) * np.cos(Phi_nom(t) - Phi_on)
                    Iw = ICRIT * np.sqrt(ss)
                newly = on & ~fired
                fired |= on; t_fire = np.where(newly, t, t_fire)
                Iref = np.where(on, Iw, I0)
            else:
                # ---------- oído: medir y actualizar el EKF ----------
                amm = a_true * 1e3
                y = -KV * amm * q - 2 * KV * amm + dR * (I - I0) + sig_tick * rng.standard_normal(N)
                wh = np.exp(X[:, 2])
                sm = sq(I)
                Am = np.zeros((N, 6, 6))
                one_bs = 1 - beta * sm
                Am[:, 0, 1] = wh; Am[:, 0, 2] = wh * X[:, 1]
                Am[:, 1, 0] = -wh * one_bs; Am[:, 1, 1] = -wh / Qh
                Am[:, 1, 2] = -wh * one_bs * X[:, 0] + wh * sm - wh / Qh * X[:, 1]
                Vh_t = 4 / 3 * math.pi * a_of_w(wh / (1 + eps_hat)) ** 3
                thdot = -0.5 * X[:, 3] * AW * vf_nom / Vh_t        # d ln w/dt = -V'/(2V)
                Am[:, 2, 2] = 2 * thdot; Am[:, 2, 3] = -0.5 * AW * vf_nom / Vh_t; Am[:, 4, 5] = 1.0
                Ad = Am * dtc
                Ad2 = Ad @ Ad
                F = Id6 + Ad + 0.5 * Ad2 + Ad2 @ Ad / 6.0
                P = F @ P @ np.transpose(F, (0, 2, 1)) + Qd
                ahm = 1e3 * a_of_w(wh / (1 + eps_hat))
                H = np.zeros((N, 6))
                H[:, 0] = -KV * ahm; H[:, 2] = (2 / 3) * KV * ahm * X[:, 0]; H[:, 4] = 1.0
                hx = -KV * ahm * X[:, 0] + X[:, 4]
                PHt = np.einsum("nij,nj->ni", P, H)
                S = np.einsum("ni,ni->n", H, PHt) + R_meas
                K = PHt / S[:, None]
                X += K * (y - hx)[:, None]
                P -= np.einsum("ni,nj->nij", K, PHt)
                P = 0.5 * (P + np.transpose(P, (0, 2, 1)))
                X[:, 2] = np.clip(X[:, 2], math.log(2 * math.pi * 150), math.log(2 * math.pi * 3000))
                # ---------- lo que el Pico cree de la gota ----------
                wh = np.exp(X[:, 2])
                xq, xp = X[:, 0], X[:, 1]
                ah = a_of_w(wh / (1 + eps_hat))
                Vh = 4 / 3 * math.pi * ah ** 3
                Vdot = np.maximum(X[:, 3], 0.5) * AW * vf_nom
                thdot = -0.5 * X[:, 3] * AW * vf_nom / Vh
                if cfg.get("oracle"):       # oído perfecto: el controlador ve la gota real
                    Wt = (1 + eps) * w_nom(a_true)
                    wh = Wt; xq = q.copy(); xp = v / Wt
                    ah = a_true; Vh = Vol.copy(); Vdot = AW * vf
                tstar = t + (V_TGT - Vh) / Vdot
                conf = (P[:, 2, 2] < 0.008 ** 2) & (t > 1e-3) | bool(cfg.get("oracle"))
                emerg = t > 1.3 * tl
                sb_now = np.where(fired, sbar_full, sbar_hold)
                qc_now = qeq_l(s_ema)                     # centro medido (no supuesto): evita que el piloto se sesgue
                weh = wh * np.sqrt(1 - beta * sb_now)
                zr = xq - qc_now; zi = xp
                cl, sl = np.cos(weh * lead + perr), np.sin(weh * lead + perr)   # perr: fase mal calibrada del oído
                zpr = zr * cl + zi * sl          # z * exp(-i w lead)
                zpi = zi * cl - zr * sl
                Ahat = np.hypot(zr, zi) + 1e-9
                # constantes de la carga máxima (cuadrada filtrada por el lazo)
                g_act = 1 / np.sqrt(1 + (wh * loop["tau"]) ** 2)
                F1 = (2 / math.pi) * (smax - smin) * g_act
                Ass = Qh * F1 / np.sqrt(1 - beta * sbar_full)
                Aend = 1 - qc_full
                wef = wh * math.sqrt(1 - beta * sbar_full)
                if strat == "chirp_oido":
                    want = conf & (t + cfg["tring"] >= tstar) | emerg   # tring: lo que tarda en sonar (gemelo)
                    newly = want & ~fired & active
                    Phi_fire = np.where(newly, Phi_hat, Phi_fire)
                    fired |= newly; t_fire = np.where(newly, t, t_fire)
                    ping = ((t % 4e-3) >= 2e-3) & ((t % 4e-3) < 2.8e-3)
                    Iref = np.where(fired, Imid + Aamp * np.cos(Phi_hat - Phi_fire),
                                    np.where(ping, I0 + 10 * np.cos(Phi_hat), I0))
                elif strat in ("bb_v", "w2_fb"):
                    ok = Ass > Aend + 0.01
                    Tbb = np.where(ok, (2 * Qh / wef) * np.log(np.maximum(Ass - Ahat, 1e-6) / np.maximum(Ass - Aend, 1e-6)),
                                   12 * 2 * math.pi / wef)
                    Tbb = np.minimum(Tbb, 15 * 2 * math.pi / wef)
                    want = conf & (t + Tbb >= tstar) | emerg
                    newly = want & ~fired & active
                    fired |= newly; t_fire = np.where(newly, t, t_fire)
                    # piloto: mantener |z| = A_PILOT con la banda chica
                    pil = np.where((Ahat < A_PILOT), zpi, -zpi) > 0
                    if strat == "bb_v":
                        full = zpi > 0
                    else:   # bombeo paramétrico puro: empujar cuando la gota se ALEJA del centro (q~ * v > 0): conmuta a 2w
                        full = zpr * zpi > 0
                    Iref = np.where(fired, np.where(full, imax, IMIN), np.where(pil, HOLD[1], HOLD[0]))
                else:  # bb_z: el lente A en sus dos ejes: el piloto (amplitud chica, mucha autoridad de fase) gira la
                    # fase de la gota para que, después de cargar a tope en fase con v, el pico que la suelta caiga en t*
                    ok = Ass > Aend + 0.01
                    Tbb = np.where(ok, (2 * Qh / wef) * np.log(np.maximum(Ass - A_PILOT, 1e-6) / np.maximum(Ass - Aend, 1e-6)),
                                   12 * 2 * math.pi / wef)
                    Tbb = np.minimum(Tbb, 15 * 2 * math.pi / wef)
                    t_plan = tstar - Tbb - cfg.get("margen", 0.3) * 2 * math.pi / wef
                    Vs = np.sqrt(V_TGT); Vhs = np.sqrt(Vh)
                    base = np.where(Vh < V_TGT, 2 * wh * Vhs * (Vs - Vhs) / Vdot, wh * (tstar - t))
                    fh = np.clip((t_plan - t) / np.maximum(tstar - t, 1e-6), 0, 1)
                    ch, cf = math.sqrt(1 - beta * sbar_hold), math.sqrt(1 - beta * sbar_full)
                    dPhi = base * (fh * ch + (1 - fh) * cf)
                    want = conf & (t >= t_plan) | emerg
                    newly = want & ~fired & active
                    fired |= newly; t_fire = np.where(newly, t, t_fire)
                    zref_i = A_PILOT * np.sin(dPhi - weh * lead)       # piloto con la fase que aterriza el pico en t*
                    pil = (zref_i - zpi) > 0
                    Iref = np.where(fired, np.where(zpi > 0, imax, IMIN), np.where(pil, HOLD[1], HOLD[0]))
                tstar_now = tstar
            Iref = np.clip(Iref, IMIN, imax)
        # =================== física (cada DT) ===================
        a_true = (3 * Vol / (4 * math.pi)) ** (1 / 3)
        W = (1 + eps) * np.sqrt(8 * SIG / (RHO * a_true ** 3))
        s = sq(I)
        acc = W * W * (s - (1 - beta * s) * q) - (W / Q) * v
        v = v + acc * DT
        q = q + v * DT
        Vol = Vol + AW * vf * DT
        E2 += np.where(active, I * I, 0.0) * DT
        E1 += np.where(active, I, 0.0) * DT
        cyc += np.where(active & fired, W, 0.0) * DT / (2 * math.pi)
        if use_ekf:
            wh_ = np.exp(X[:, 2])
            X[:, 1] = X[:, 1] + DT * (-wh_ * (1 - beta * s) * X[:, 0] + wh_ * s - wh_ / Qh * X[:, 1])
            X[:, 0] = X[:, 0] + DT * wh_ * X[:, 1]
            X[:, 2] = X[:, 2] + DT * thdot
            X[:, 4] = X[:, 4] + DT * X[:, 5]
            s_ema = s_ema + (s - s_ema) * DT / 4e-3
            sb_ = np.where(fired, sbar_full, sbar_hold)
            Phi_hat = Phi_hat + wh_ * np.sqrt(1 - beta * sb_) * DT
        Itg = I + (Iref - I) * alpha_c
        I = I + np.clip(Itg - I, -S_DN * DT, S_UP * DT)
        hit = active & (q >= 1.0)
        if hit.any():
            a_rel[hit] = a_true[hit]; t_rel[hit] = t
            if use_ekf:
                tstar_rel[hit] = tstar_now[hit]
            active &= ~hit
        if trace is not None and k % rec_every == 0:
            trace.append((t, a_true[0], (ah[0] if use_ekf else np.nan), q[0],
                          (Ahat[0] if use_ekf else np.nan), I[0], bool(fired[0]),
                          (tstar_now[0] if use_ekf else np.nan),
                          (math.sqrt(P[0, 2, 2]) if use_ekf else np.nan), (X[0, 3] if use_ekf else np.nan)))
        if not active.any():
            break
    return dict(cfg=cfg, a_rel=a_rel, t_rel=t_rel, E2=E2, E1=E1, cyc=cyc, t_fire=t_fire,
                tstar_rel=tstar_rel, trace=trace, eps=eps, vfm=vfm)


# ----------------------------------------------------------------------------------------------
# Gemelo: el instante de arranque (lazo abierto) que suelta la gota nominal en 0.460 mm
# ----------------------------------------------------------------------------------------------
def twin(strat, Q, vf, imax, loop="20k"):
    tl = life_nom(vf)
    cand = np.linspace(0.0, 1.2 * tl, 241)
    r = run_cfg(dict(strat=strat, Q=Q, vf=vf, imax=imax, loop=loop, world="nom", N=len(cand), seed=1, ton=cand))
    ok = np.isfinite(r["a_rel"])
    if not ok.any():
        return dict(ton=np.nan, a=np.nan, cyc=np.nan, trel=np.nan)
    err = np.where(ok, np.abs(r["a_rel"] - A_TGT), np.inf)
    near = np.where(err <= err.min() + 1.5e-6)[0]
    j = int(near.max())                     # entre los casi-mejores, el que arranca más tarde (menos ciclos)
    return dict(ton=cand[j], a=r["a_rel"][j], cyc=r["cyc"][j], trel=r["t_rel"][j])


def summarize(r, t_plan=None):
    a = r["a_rel"]; ok = np.isfinite(a)
    out = dict(pct=100 * ok.mean())
    if ok.any():
        e = (a[ok] - A_TGT) * 1e6
        out.update(err=e.mean(), sd=e.std(), p95=np.percentile(np.abs(e), 95),
                   cyc=np.nanmean(r["cyc"][ok]), E2=np.mean(r["E2"][ok]) * 1e3,
                   E2x=np.mean(r["E2"][ok] - I0 ** 2 * r["t_rel"][ok]) * 1e3,
                   Imean=np.mean(r["E1"][ok] / r["t_rel"][ok]))
        if np.isfinite(r["tstar_rel"][ok]).any():
            dtr = (r["t_rel"][ok] - r["tstar_rel"][ok]) * 1e6
            out["sdt"] = np.nanstd(dtr)
        elif t_plan is not None and np.isfinite(t_plan):
            out["sdt"] = np.std((r["t_rel"][ok] - t_plan) * 1e6)
        else:
            out["sdt"] = np.nan
    else:
        out.update(err=np.nan, sd=np.nan, p95=np.nan, cyc=np.nan, E2=np.nan, E2x=np.nan, Imean=np.nan, sdt=np.nan)
    return out




# ----------------------------------------------------------------------------------------------
# Utilidades de modos superiores
# ----------------------------------------------------------------------------------------------
def f_ratio(l):
    return math.sqrt(l * (l - 1) * (l + 2) / 8.0)


def lamb_Q_ratio(l):
    """Q_l/Q_2 con amortiguamiento viscoso de Lamb: tasa ∝ (l-1)(2l+1), frecuencia ∝ sqrt(l(l-1)(l+2))."""
    return f_ratio(l) * 5.0 / ((l - 1) * (2 * l + 1))


def loop_wave(Iref_fun, loopname, T, nper=12, dt=1e-6):
    """corriente real (lazo de primer orden + pendiente) para una referencia periódica; regresa el último periodo"""
    lp = LOOPS[loopname]
    alpha = 1 - math.exp(-dt / lp["tau"])
    n = int(nper * T / dt); I = I0; out = []
    nT = int(round(T / dt))
    for k in range(n):
        t = k * dt
        Ir = Iref_fun(t + lp["lead"])          # la referencia ya va adelantada (compensación de retraso)
        It = I + (Ir - I) * alpha
        I = I + min(max(It - I, -S_DN * dt), S_UP * dt)
        if k >= n - nT:
            out.append(I)
    return np.array(out)


# ----------------------------------------------------------------------------------------------
# PARTE 1b · LA FORMA de la fuerza: carga en fase con v, gota de tamaño fijo, actuador ideal
# ----------------------------------------------------------------------------------------------
def parte_forma():
    print("=" * 110)
    print("PARTE 1b · LA FORMA DE LA FUERZA (gota fija de 0.46 mm, la onda va en fase con la velocidad de la gota, actuador ideal, beta = 1)")
    print("  Como s = I^2/Icrit^2, la energia int I^2 dt = Icrit^2 int s dt es LINEAL en s: el optimo (Pontryagin) es bang-bang en s.")
    print("  F1 = componente de s a la frecuencia de la gota (lo unico que la gota oye). ⟨I⟩ = lo que derrite (canal de volumen).")
    print("=" * 110)
    W = w_nom(A_TGT)
    print(f"  {'Q':>3} {'Imax':>5} | {'forma':34s} | {'F1':>6} | {'ciclos':>6} | {'<I> A':>6} | {'<I2>/40^2':>9} | {'int(I2-40^2) A2ms':>17}")
    for Q in (10, 30):
        for imax in (70, 100):
            smin, smax = sq(IMIN), sq(imax)
            Imid, Aamp = 0.5 * (imax + IMIN), 0.5 * (imax - IMIN)
            var = [("tono en I (Imid ± A, senoidal)", "tono"), ("seno en s  (I = Icrit*sqrt(s))", "raiz")]
            var += [(f"ventana {w:3d}° en Imax (resto Imin)", w) for w in (60, 90, 120, 180, 240)]
            N = len(var)
            F1 = []; sbar = []
            for _, kind in var:
                if kind == "tono":
                    F1.append(2 * Imid * Aamp / ICRIT ** 2); sbar.append((Imid ** 2 + Aamp ** 2 / 2) / ICRIT ** 2)
                elif kind == "raiz":
                    F1.append(0.5 * (smax - smin)); sbar.append(0.5 * (smax + smin))
                else:
                    th = math.radians(kind)
                    F1.append((smax - smin) * (2 / math.pi) * math.sin(th / 2)); sbar.append(smin + (smax - smin) * th / (2 * math.pi))
            sbar = np.array(sbar); qc = qeq(sbar)
            weff = W * np.sqrt(1 - BETA * sbar)
            q = qc + 0.01; v = np.zeros(N)
            dt = 2 * math.pi / W / 400
            done = np.zeros(N, bool); cyc = np.full(N, np.nan); EI2 = np.zeros(N); EI = np.zeros(N); tt = np.zeros(N)
            for k in range(int(60 * 400)):
                zr = q - qc; zi = v / weff
                x = zi / (np.hypot(zr, zi) + 1e-12)
                I = np.empty(N)
                for j, (_, kind) in enumerate(var):
                    if kind == "tono":
                        I[j] = Imid + Aamp * x[j]
                    elif kind == "raiz":
                        I[j] = ICRIT * math.sqrt(0.5 * (smin + smax) + 0.5 * (smax - smin) * x[j])
                    else:
                        I[j] = imax if x[j] > math.cos(math.radians(kind) / 2) else IMIN
                s = sq(I)
                acc = W * W * (s - (1 - BETA * s) * q) - (W / Q) * v
                v = v + acc * dt; q = q + v * dt
                live = ~done
                EI2 += np.where(live, I * I, 0) * dt; EI += np.where(live, I, 0) * dt; tt += np.where(live, dt, 0)
                hit = live & (q >= 1)
                cyc[hit] = (k + 1) * dt * W / (2 * math.pi); done |= hit
                if done.all():
                    break
            for j, (lab, _) in enumerate(var):
                if np.isfinite(cyc[j]):
                    print(f"  {Q:3d} {imax:5.0f} | {lab:34s} | {F1[j]:6.4f} | {cyc[j]:6.2f} | {EI[j]/tt[j]:6.1f} | {EI2[j]/tt[j]/1600:9.2f} | {(EI2[j]-1600*tt[j])*1e3:17.0f}")
                else:
                    print(f"  {Q:3d} {imax:5.0f} | {lab:34s} | {F1[j]:6.4f} | {'nunca':>6} | {EI[j]/tt[j]:6.1f} | {EI2[j]/tt[j]/1600:9.2f} |   (no se suelta en 60 ciclos)")
            print("  " + "-" * 104)


# ----------------------------------------------------------------------------------------------
# PARTE 2 · MULTIMODO con UNA corriente (+ campo transversal para l=1)
# ----------------------------------------------------------------------------------------------
def parte_armonicos():
    print("=" * 110)
    print("PARTE 2a · CANALES QUE SE MEZCLAN: armónicos de s = I^2/Icrit^2 y cuánto se llevan los modos l=3 (1.94 f2) y l=4 (3.00 f2)")
    print("  supuestos: acople c_l = 1 para todos los modos (cota alta), Q_l escalado con Lamb desde Q2 = 30 (Q3 = 0.69 Q2, Q4 = 0.56 Q2)")
    print("=" * 110)
    sbar_full = 0.5 * (sq(IMIN) + sq(70.0))
    f2e = w_nom(A_TGT) * math.sqrt(1 - BETA * sbar_full) / (2 * math.pi)
    T = 1 / f2e
    nper = 2000
    ph = np.linspace(0, 2 * math.pi, nper, endpoint=False)
    smin, smax = sq(IMIN), sq(70.0)
    waves = {
        "tono en I 40±30": 40 + 30 * np.cos(ph),
        "seno en s (raiz)": ICRIT * np.sqrt(0.5 * (smin + smax) + 0.5 * (smax - smin) * np.cos(ph)),
        "cuadrada ideal 10/70": np.where(np.cos(ph) > 0, 70.0, 10.0),
        "ventana 120° 10/70": np.where(np.cos(ph) > 0.5, 70.0, 10.0),
    }
    for ln in ("20k", "100k"):
        Iw = loop_wave(lambda t: 70.0 if math.cos(2 * math.pi * f2e * t) > 0 else 10.0, ln, T)
        Iw = np.interp(np.linspace(0, len(Iw) - 1, nper), np.arange(len(Iw)), Iw)
        waves[f"cuadrada real lazo {ln}"] = Iw
    Q2 = 30.0
    Q3, Q4 = Q2 * lamb_Q_ratio(3), Q2 * lamb_Q_ratio(4)
    print(f"  f2 efectiva {f2e:.0f} Hz; f3 = {f_ratio(3):.3f} f2 (el 2º armónico cae a {100*(2/f_ratio(3)-1):+.1f} % de f3); f4 = {f_ratio(4):.3f} f2 (el 3º armónico cae EXACTO)")
    print(f"  {'forma':26s} | {'<I>':>5} {'<I2>':>6} | {'s1':>6} | {'s2/s1':>6} {'s3/s1':>6} {'s4/s1':>6} {'s5/s1':>6} | {'q3/q2 (2w)':>10} {'q4/q2 (3w)':>10}")
    for lab, I in waves.items():
        s = sq(I)
        c = np.fft.rfft(s) / nper
        c1 = 2 * abs(c[1])
        r = [2 * abs(c[n]) / c1 for n in (2, 3, 4, 5)]
        x3 = 2 / f_ratio(3); G3 = 1 / math.sqrt((1 - x3 ** 2) ** 2 + (x3 / Q3) ** 2)
        x4 = 3 / f_ratio(4); G4 = 1 / math.sqrt((1 - x4 ** 2) ** 2 + (x4 / Q4) ** 2)
        print(f"  {lab:26s} | {I.mean():5.1f} {np.mean(I*I):6.0f} | {c1:6.4f} | {r[0]:6.3f} {r[1]:6.3f} {r[2]:6.3f} {r[3]:6.3f} | {r[0]*G3/Q2:10.3f} {r[1]*G4/Q2:10.3f}")
    print("  q_l/q2 = respuesta estacionaria del modo l al armónico que le cae cerca, relativa a la de l=2 en resonancia (c_l = 1).")


def parte_apuntar(sdt_table):
    print("=" * 110)
    print("PARTE 2b · APUNTAR (l=1, campo B transversal x corriente) MIENTRAS se suelta (l=2): la corriente que hace sonar l=2 multiplica al campo")
    print("  modelo de scripts/canon/apuntar2.py: f1 = 0.5 f2 (SUPUESTO), Q1 = 30, 12.9 m/s^2 por mT a 40 A, vuelo 2.9 ms, blanco a 0.5 mm, patada de 3 ciclos de f1")
    print("=" * 110)
    a = A_TGT; m = RHO * vol(a); ell = 2 * a
    acc_mT_A = ell * 1e-3 / m                 # m/s^2 por mT por A
    F2 = w_nom(a) / (2 * math.pi); f1 = 0.5 * F2; W1 = 2 * math.pi * f1; Q1 = 30.0
    t_f = 2.0e-3 / 0.7
    sbar_full = 0.5 * (sq(IMIN) + sq(70.0))
    f2e = F2 * math.sqrt(1 - BETA * sbar_full)
    dt = 1 / (f1 * 400)
    t_rel = 0.05
    Tring = 5 / f2e
    def land(Bc, Ifun, kick_end, ncyc=3):
        """Bc: B0*exp(i psi) complejo (mT). Campo giratorio solo en los ncyc ciclos de f1 antes de kick_end."""
        x = 0j; vv = 0j; t = 0.0
        t0 = kick_end - ncyc / f1
        while t < t_rel:
            B = Bc * np.exp(1j * W1 * t) if (t0 <= t < kick_end) else 0j
            F = acc_mT_A * Ifun(t) * B
            ax = F - W1 / Q1 * vv - W1 * W1 * x
            vv += ax * dt; x += vv * dt; t += dt
        return x + vv * t_f
    tgt = 0.5e-3
    I_const = lambda t: I0
    G0 = land(1.0, I_const, t_rel)
    Bc = tgt / G0
    print(f"  plan con I = 40 A fija: B0 = {abs(Bc):.2f} mT; con la patada al final cae en {abs(land(Bc, I_const, t_rel))*1e3:.3f} mm")
    rng = np.random.default_rng(21)
    errs_sim = []
    for k in range(60):
        ph2 = rng.uniform(0, 2 * math.pi); ratio = 1 + 0.05 * rng.uniform(-1, 1)
        fq = f2e * ratio
        Ifun = lambda t, ph2=ph2, fq=fq: (70.0 if math.cos(2 * math.pi * fq * t + ph2) > 0 else 10.0) if t >= t_rel - Tring else I0
        errs_sim.append(abs(land(Bc, Ifun, t_rel) - tgt))
    errs_sim = np.array(errs_sim) * 1e6
    G_seq = land(1.0, I_const, t_rel - Tring)
    Bc_seq = tgt / G_seq
    errs_seq = []
    for k in range(20):
        ph2 = rng.uniform(0, 2 * math.pi)
        Ifun = lambda t, ph2=ph2: (70.0 if math.cos(2 * math.pi * f2e * t + ph2) > 0 else 10.0) if t >= t_rel - Tring else I0
        errs_seq.append(abs(land(Bc_seq, Ifun, t_rel - Tring) - tgt))
    errs_seq = np.array(errs_seq) * 1e6
    print(f"  (i)  SIMULTÁNEO sin compensar (l=2 suena 10/70 A durante los últimos 5 ciclos de f2 = {Tring*1e3:.1f} ms): error medio {errs_sim.mean():5.0f} um, 90 % < {np.percentile(errs_sim,90):5.0f} um")
    print(f"  (ii) SIMULTÁNEO compensado B(t) = B_plan(t)*40/I(t): error de cruce 0 um por construcción; pide B pico {abs(Bc)*40/IMIN:.2f} mT (x4) y bobina que siga ~{3*f2e/1000:.1f} kHz")
    print(f"  (iii) SECUENCIAL (patada antes de disparar l=2, B = 0 mientras suena): B0 = {abs(Bc_seq):.2f} mT, error de cruce medio {errs_seq.mean():.1f} um (la corriente no toca a l=1 si B = 0)")
    # sensibilidad al instante de soltar
    def land_at(trel_shift):
        x = 0j; vv = 0j; t = 0.0; t0 = t_rel - 3 / f1
        while t < t_rel + trel_shift:
            B = Bc * np.exp(1j * W1 * t) if (t0 <= t < t_rel) else 0j
            ax = acc_mT_A * I0 * B - W1 / Q1 * vv - W1 * W1 * x
            vv += ax * dt; x += vv * dt; t += dt
        return x + vv * t_f
    sens = abs(land_at(20e-6) - land_at(-20e-6)) / 40e-6 * 1e-6     # m por us
    print(f"  sensibilidad: soltar 1 us tarde mueve la caída {sens*1e6:.2f} um  ->  para errar < 100 um a 0.5 mm, el instante de soltar debe saberse a < {100/ (sens*1e6):.0f} us")
    print("  incertidumbre del instante de soltar (sigma de t_suelta - t* del controlador) en el Monte Carlo, Q = 30, mundo calibrado, Imax 70 A:")
    for k, vsd in sdt_table.items():
        print(f"     {k:40s}: {vsd:6.0f} us  -> error de apuntar ~{vsd*sens*1e6:5.0f} um")


def parte_cuello():
    print("=" * 110)
    print("PARTE 2c · ¿EL MODO l=3 (estrangular el cuello) ayuda a soltar?  QUÉ PASARÍA SI el desprendimiento fuera q2 + kappa*q3 >= 1")
    print("  (kappa y el acople c3 NO se conocen: el modelo del canon solo tiene q2 >= 1. Gota fija 0.46 mm, Q2 = 30, Q3 = 0.69 Q2, 10/70 A, actuador ideal)")
    print("  ley A: bang-bang en fase con v2 (solo l=2).  ley B: bang-bang en el signo de sum_l kappa_l c_l w_l p_l/A_l (Pontryagin miope, los dos modos).")
    print("  ley C: tono 40±30 A a la frecuencia de l=3 (lengua en f3) en lazo abierto.  Ciclos contados en periodos de l=2.")
    print("=" * 110)
    W2 = w_nom(A_TGT); W3 = W2 * f_ratio(3); Q2 = 30.0; Q3 = Q2 * lamb_Q_ratio(3)
    smin, smax = sq(IMIN), sq(70.0)
    print(f"  {'c3':>4} {'kappa':>5} | {'ley A ciclos':>12} | {'ley B ciclos':>12} | {'ley C (tono en f3)':>18}")
    for c3 in (0.5, 1.0):
        for kap in (0.0, 0.25, 0.5, 1.0):
            res = []
            for law in "ABC":
                q2 = qeq(sq(I0)) + 0.01; v2 = 0.0; q3 = c3 * sq(I0) + 0.005; v3 = 0.0
                dt = 2 * math.pi / W2 / 400; out = float("nan")
                sb = 0.5 * (smin + smax)
                for k in range(60 * 400):
                    t = k * dt
                    z2r = q2 - qeq(sb); z2i = v2 / W2; A2 = math.hypot(z2r, z2i) + 1e-12
                    z3r = q3 - c3 * sb; z3i = v3 / W3; A3 = math.hypot(z3r, z3i) + 1e-12
                    if law == "A":
                        I = 70.0 if z2i > 0 else IMIN
                    elif law == "B":
                        I = 70.0 if (W2 * z2i / A2 + kap * c3 * W3 * z3i / A3) > 0 else IMIN
                    else:
                        I = 40 + 30 * math.cos(W3 * math.sqrt(1 - 0.0) * t)
                    s = sq(I)
                    a2 = W2 * W2 * (s - (1 - BETA * s) * q2) - W2 / Q2 * v2
                    a3 = W3 * W3 * (c3 * s - q3) - W3 / Q3 * v3
                    v2 += a2 * dt; q2 += v2 * dt; v3 += a3 * dt; q3 += v3 * dt
                    if q2 + kap * q3 >= 1:
                        out = (k + 1) * dt * W2 / (2 * math.pi); break
                res.append(out)
            f = lambda x: f"{x:12.2f}" if np.isfinite(x) else f"{'nunca':>12}"
            print(f"  {c3:4.1f} {kap:5.2f} | {f(res[0])} | {f(res[1])} | {f(res[2]):>18}")


# ----------------------------------------------------------------------------------------------
# PARTE 3 · ¿QUÉ COMPRAN «MILLONES DE ONDAS»?  grados de libertad útiles
# ----------------------------------------------------------------------------------------------
def parte_gdl():
    print("=" * 110)
    print("PARTE 3 · CUÁNTOS GRADOS DE LIBERTAD DE LA ONDA LLEGAN A LA GOTA (gota de 0.46 mm, base 40 A, beta = 1)")
    print("  amplitud máx. de corriente a f: min(30 A, pendiente/(2 pi f)) x |H_lazo(f)|;  q_l,max = c_l Q_l (2*40*dI/Icrit^2)(1 - e^{-T/tau_l})")
    print("  ruido del oído por modo: sigma_q = sigma_y/(10 V/mm * a) * sqrt(2/(fs*min(tau_l, T))), fs = 20 kS/s")
    print("=" * 110)
    a_mm = A_TGT * 1e3
    f2 = w_nom(A_TGT) / (2 * math.pi)
    S = min(S_UP, S_DN)
    for Q2 in (10.0, 30.0):
        for T, lab in ((life_nom(0.05), "3 m/min"), (life_nom(0.010), "0.6 m/min")):
            print(f"  -- Q2 = {Q2:.0f}, vida de la gota T = {T*1e3:.1f} ms ({lab}); c_l = 1 (cota alta) --")
            print(f"  {'l':>3} {'f_l Hz':>7} {'Q_l':>5} {'tau ms':>6} | {'dI 20k':>6} {'q 20k':>6} | {'dI 100k':>7} {'q 100k':>6} | {'sig_q 10mV':>10} {'sig_q 0.3V':>10} {'sig_q 1V':>9}")
            useful = {}
            for l in range(2, 31):
                fl = f2 * f_ratio(l); wl = 2 * math.pi * fl; Ql = Q2 * lamb_Q_ratio(l); taul = 2 * Ql / wl
                row = []
                for ln in ("20k", "100k"):
                    H = 1 / math.sqrt(1 + (wl * LOOPS[ln]["tau"]) ** 2)
                    dI = min(30.0, S / wl) * H
                    qmax = Ql * 2 * I0 * dI / ICRIT ** 2 * (1 - math.exp(-T / taul))
                    row += [dI, qmax]
                sig = []
                for nv in (0.010, 0.3, 1.0):
                    sy = math.sqrt(nv ** 2 + (ADC_RAW / 5) ** 2)
                    sig.append(sy / (KV * a_mm) * math.sqrt(2 / (20e3 * min(taul, T))))
                for k, ln in enumerate(("20k", "100k")):
                    for j, nv in enumerate(("10mV", "0.3V", "1V")):
                        key = (ln, nv)
                        if row[2 * k + 1] >= 0.1 and row[2 * k + 1] / sig[j] >= 10:
                            useful[key] = useful.get(key, 0) + 1
                if l <= 10 or l in (15, 20, 30):
                    print(f"  {l:3d} {fl:7.0f} {Ql:5.1f} {taul*1e3:6.2f} | {row[0]:6.1f} {row[1]:6.3f} | {row[2]:7.1f} {row[3]:6.3f} | {sig[0]:10.5f} {sig[1]:10.5f} {sig[2]:9.5f}")
            print("  modos útiles (q_max >= 0.1 y señal/ruido >= 10): " +
                  ", ".join(f"{ln}/{nv}: {useful.get((ln, nv), 0)}" for ln in ("20k", "100k") for nv in ("10mV", "0.3V", "1V")))
    # SVD de la alcanzabilidad: cuántas direcciones independientes del estado modal se alcanzan con >= 0.1
    from scipy.linalg import expm
    print()
    print("  ALCANZABILIDAD (SVD): estado final de los modos l=2..30 contra la forma de onda (rms <= 21 A, = tono de 30 A), lazo lineal")
    for Q2 in (10.0, 30.0):
        for ln in ("20k", "100k"):
            for cdec, clab in ((0.0, "c_l = 1"), (0.5, "c_l = e^{-(l-2)/2}")):
                for T in (life_nom(0.05), life_nom(0.010)):
                    ls = list(range(2, 31)); M = len(ls)
                    n = 1 + 2 * M
                    A = np.zeros((n, n)); B = np.zeros(n)
                    tauc = LOOPS[ln]["tau"]
                    A[0, 0] = -1 / tauc; B[0] = 1 / tauc
                    g = 2 * I0 / ICRIT ** 2
                    for i, l in enumerate(ls):
                        wl = w_nom(A_TGT) * f_ratio(l); Ql = Q2 * lamb_Q_ratio(l); cl = math.exp(-cdec * (l - 2))
                        iq, ip = 1 + 2 * i, 2 + 2 * i
                        A[iq, ip] = wl; A[ip, iq] = -wl; A[ip, ip] = -wl / Ql; A[ip, 0] = wl * cl * g
                    dtu = 10e-6
                    Md = expm(np.block([[A * dtu, B[:, None] * dtu], [np.zeros((1, n + 1))]]))
                    Ad, Bd = Md[:n, :n], Md[:n, n]
                    nk = int(T / dtu)
                    cols = np.zeros((n, nk)); x = Bd.copy()
                    for k in range(nk):
                        cols[:, nk - 1 - k] = x
                        x = Ad @ x
                    E = (21.2 ** 2) * T
                    sv = np.linalg.svd(cols[1:, :], compute_uv=False) * math.sqrt(E / dtu)
                    print(f"   Q2={Q2:3.0f} lazo {ln:4s} {clab:18s} T={T*1e3:5.1f} ms: semiejes >= 0.1: {int((sv >= 0.1).sum()):2d}, >= 0.3: {int((sv >= 0.3).sum()):2d}, >= 1: {int((sv >= 1).sum()):2d}  (mayores: {', '.join(f'{x:.2f}' for x in sv[:6])})")
    print()
    print("  GRADOS DE LIBERTAD DE LA ONDA: 2*B*T muestras independientes por gota")
    for ln, B in (("20k (tau 150 us)", 1 / (2 * math.pi * 150e-6)), ("100k chica señal (tau 5 us, Nyquist 50 kHz)", min(1 / (2 * math.pi * 5e-6), 50e3)),
                  ("100k a plena escala (pendiente/(2 pi 30 A))", S / (2 * math.pi * 30))):
        for T, lab in ((life_nom(0.05), "3 m/min"), (life_nom(0.010), "0.6 m/min")):
            print(f"   {ln:46s} B = {B/1e3:6.2f} kHz, {lab:9s}: 2BT = {2*B*T:7.0f} números por gota")
    print(f"   PWM a 100 kHz = 1e5 ciclos de trabajo por segundo; a 75 gotas/s = {1e5/75:.0f} por gota.")


# ----------------------------------------------------------------------------------------------
# Corredor de la malla Monte Carlo
# ----------------------------------------------------------------------------------------------
NOMBRE = {
    "tono": "tono único (campanazo f fija)", "multi3": "multitono 3 (±5 %)", "multi5": "multitono 5 (±5 %)",
    "chirp": "chirp a ciegas (canon)", "chirp_raiz": "chirp, seno en s (raíz)", "chirp_oido": "chirp + oído (canon)",
    "w2_fb": "bombeo 2w CON retroalim.", "bb_v": "bang-bang en fase con v", "bb_z": "bang-bang + fase (lente A)",
    "bb_v*": "bang-bang v, oído perfecto", "bb_z*": "bang-bang+fase, oído perf.",
}


def key(c):
    st = c["strat"] + ("*" if c.get("oracle") else "")
    return (st, c["Q"], c["world"], c["vf"], c["imax"], c.get("loop", "20k"), c.get("noise", 0.010),
            c.get("qhat_mult", 1.0), c.get("beta", BETA), c.get("perr", 0.0))


def job(c):
    r = run_cfg(c)
    return key(c), summarize(r, c.get("tplan"))


def twin_job(args):
    return args, twin(*args)


def fmt_row(lab, s):
    if s is None or not np.isfinite(s.get("pct", np.nan)) or s["pct"] == 0:
        return f"  {lab:30s} | {('0.0' if s is not None else '—'):>6} | {'nunca se suelta (o el gemelo no halla arranque)':s}"
    return (f"  {lab:30s} | {s['pct']:6.1f} | {s['cyc']:6.2f} | {s['err']:+6.1f} | {s['sd']:6.1f} | {s['p95']:6.1f} | "
            f"{s['E2x']:8.0f} | {s['Imean']:5.1f} | {s['sdt']:6.0f}")


HDR = (f"  {'estrategia':30s} | {'%suel':>6} | {'ciclos':>6} | {'err um':>6} | {'sig um':>6} | {'P95 um':>6} | "
       f"{'∫(I²-40²)':>8} | {'<I> A':>5} | {'sig_t us':>6}")


def actuator_check():
    print("  actuador (modelo de primer orden + pendiente) contra scripts/canon/canon_corriente.out, referencia 40 + 30 cos(2 pi f t):")
    canon = {("20k", 668): (26.2, 31.8), ("20k", 1268): (20.3, 51.7), ("100k", 668): (30.7, -1.7), ("100k", 1268): (32.0, -1.7)}
    for ln in ("20k", "100k"):
        lp = LOOPS[ln]
        for f in (668, 1268):
            dt = 1e-6; alpha = 1 - math.exp(-dt / lp["tau"]); I = I0; ts = []; Is = []
            for k in range(int(10 / f / dt)):
                t = k * dt
                Ir = 40 + 30 * math.cos(2 * math.pi * f * t)
                It = I + (Ir - I) * alpha
                I = I + min(max(It - I, -S_DN * dt), S_UP * dt)
                if t > 5 / f:
                    ts.append(t); Is.append(I)
            ts = np.array(ts); Is = np.array(Is); w = 2 * math.pi * f
            Am = np.vstack([np.ones_like(ts), np.cos(w * ts), np.sin(w * ts)]).T
            c, *_ = np.linalg.lstsq(Am, Is, rcond=None)
            amp = math.hypot(c[1], c[2]); lag = math.degrees(math.atan2(c[2], c[1]))
            ca, cl = canon[(ln, f)]
            print(f"     lazo {ln:4s} f = {f:4d} Hz: modelo {amp:5.1f} A, retraso {lag:5.1f}° | ngspice (canon) {ca:5.1f} A, {cl:5.1f}°")


if __name__ == "__main__":
    rapido = "--rapido" in sys.argv
    procs = int(sys.argv[sys.argv.index("--procs") + 1]) if "--procs" in sys.argv else 1
    N = 40 if rapido else 300
    T0 = time.time()
    print("#" * 110)
    print("# 01 · MILLONES DE ONDAS: forma de fuerza óptima y control con retroalimentación (oído)   N =", N, "gotas por caso")
    print("#" * 110)
    print(f"  gota: semilla {A_SEED*1e3:.2f} mm -> pedida {A_TGT*1e3:.2f} mm; f2(0.46) = {w_nom(A_TGT)/2/math.pi:.0f} Hz (sin carga), "
          f"{w_nom(A_TGT)*math.sqrt(1-BETA*0.5*(sq(10)+sq(70)))/2/math.pi:.0f} Hz con beta = 1 y 10/70 A")
    print(f"  vida de la gota: {life_nom(0.010)*1e3:.1f} ms a 0.6 m/min, {life_nom(0.05)*1e3:.1f} ms a 3 m/min (alambre 0.8 mm)")
    print(f"  pendiente: sube {S_UP/1e6:.2f} A/us, baja {S_DN/1e6:.2f} A/us; ADC: {ADC_RAW*1e3:.1f} mV rms por muestra cruda (ENOB 9, /16)")
    print(f"  mundos: nom = todo nominal | cal = f2 real con 1 % de jitter por gota, avance ±10 %, residuo q0 hasta 0.3, dR 1 mOhm | sin = igual pero f2 ±5 % por gota")
    actuator_check()
    print()
    parte_forma()
    print(f"  [{time.time()-T0:.0f} s]")
    QS = (5.0, 10.0, 30.0); VFS = (0.010, 0.05); IMAXS = (70.0, 100.0); WORLDS = ("nom", "cal", "sin")
    if rapido:
        QS = (10.0, 30.0); VFS = (0.010, 0.05); IMAXS = (70.0,); WORLDS = ("cal", "sin")
    twin_args = [(st, Q, vf, im, "20k") for st in OL for Q in QS for vf in VFS for im in IMAXS]
    twin_args += [(st, Q, vf, 70.0, "100k") for st in ("tono", "chirp") for Q in (10.0, 30.0) for vf in VFS]
    twin_args = list(dict.fromkeys(twin_args))
    with Pool(procs) as pool:
        TW = dict(pool.map(twin_job, twin_args))
    print()
    print("=" * 110)
    print("GEMELO (lazo abierto): instante de arranque que suelta la gota NOMINAL en 0.460 mm")
    print("=" * 110)
    for k, v in TW.items():
        if np.isfinite(v["ton"]):
            print(f"  {NOMBRE[k[0]]:28s} Q={k[1]:4.0f} {k[2]*60:3.1f} m/min Imax {k[3]:3.0f} lazo {k[4]:4s}: arranca {v['ton']*1e3:6.2f} ms, suelta {v['trel']*1e3:6.2f} ms en {v['a']*1e3:.4f} mm tras {v['cyc']:5.2f} ciclos")
        else:
            print(f"  {NOMBRE[k[0]]:28s} Q={k[1]:4.0f} {k[2]*60:3.1f} m/min Imax {k[3]:3.0f} lazo {k[4]:4s}: NINGÚN arranque la suelta")
    cfgs = []
    blk = 0
    def add(c, seed):
        c = dict(c); c["seed"] = seed; c["N"] = N
        st = c["strat"]; ln = c.get("loop", "20k")
        if st in OL:
            tw = TW.get((st, c["Q"], c["vf"], c["imax"], ln))
            if tw is None or not np.isfinite(tw["ton"]):
                return
            c["ton"] = tw["ton"]; c["tplan"] = tw["trel"]
        if st == "chirp_oido":
            tw = TW.get(("chirp", c["Q"], c["vf"], c["imax"], ln))
            c["tring"] = (tw["trel"] - tw["ton"]) if (tw is not None and np.isfinite(tw["ton"])) else 8e-3
        cfgs.append(c)
    for vf in VFS:
        for im in IMAXS:
            for Q in QS:
                for w in WORLDS:
                    blk += 1
                    for st in OL + FB:
                        add(dict(strat=st, Q=Q, world=w, vf=vf, imax=im), 1000 + blk)
                    if w != "nom":
                        for st in ("bb_v", "bb_z"):
                            add(dict(strat=st, Q=Q, world=w, vf=vf, imax=im, oracle=True), 1000 + blk)
    side = []
    for vf in VFS:
        for Q in ((10.0, 30.0) if not rapido else (30.0,)):
            for st in ("tono", "chirp", "chirp_oido", "bb_v", "bb_z"):
                add(dict(strat=st, Q=Q, world="cal", vf=vf, imax=70.0, loop="100k"), 5000 + int(Q) + int(vf * 1000))
        for nz in (0.1, 0.3, 1.0):
            for st in ("chirp_oido", "bb_v", "bb_z"):
                add(dict(strat=st, Q=30.0, world="cal", vf=vf, imax=70.0, noise=nz), 6000 + int(vf * 1000))
        for qm in (0.67, 1.5):
            for st in ("bb_v", "bb_z"):
                add(dict(strat=st, Q=30.0, world="cal", vf=vf, imax=70.0, qhat_mult=qm), 7000 + int(vf * 1000))
        for st in ("w2_fb", "bb_v"):
            for Q in (10.0, 30.0):
                add(dict(strat=st, Q=Q, world="cal", vf=vf, imax=70.0, beta=2.0), 8000 + int(Q) + int(vf * 1000))
        for pe in (30.0, 60.0, 90.0):
            for st in ("bb_v", "bb_z"):
                add(dict(strat=st, Q=30.0, world="cal", vf=vf, imax=70.0, perr=pe), 9000 + int(vf * 1000))
    print(f"\n  corriendo {len(cfgs)} casos x {N} gotas en {procs} procesos ... [{time.time()-T0:.0f} s]")
    with Pool(procs) as pool:
        RES = dict(pool.map(job, cfgs, chunksize=1))
    print(f"  listo [{time.time()-T0:.0f} s]")
    # ------------------------------------------------------------------ tablas
    print()
    print("=" * 110)
    print("PARTE 1 · SOLTAR UNA GOTA DE 0.460 mm: Monte Carlo por estrategia (lazo de corriente de HOY: 20 kHz, PI lento)")
    print("  err/sig/P95 = error del tamaño al soltarse (um); ciclos = ciclos de la gota desde que arranca la onda hasta que se suelta;")
    print("  ∫(I²-40²) = energía de pellizco EXTRA sobre 40 A fijos en toda la vida de la gota (A²·ms); sig_t = dispersión del instante de soltar")
    print("  contra lo planeado (us; lo que importa para apuntar). '*' = el controlador ve la gota real (cota: oído perfecto)")
    print("=" * 110)
    order = list(OL) + list(FB) + ["bb_v*", "bb_z*"]
    for vf in VFS:
        for im in IMAXS:
            for Q in QS:
                for w in WORLDS:
                    print(f"\n  >> {vf*60:.1f} m/min | Imax {im:.0f} A | Q = {Q:.0f} | mundo {w}")
                    print(HDR)
                    for st in order:
                        k = (st, Q, w, vf, im, "20k", 0.010, 1.0, BETA, 0.0)
                        if st.endswith("*") and w == "nom":
                            continue
                        print(fmt_row(NOMBRE[st], RES.get(k)))
    # matriz compacta
    print()
    print("=" * 110)
    print("RESUMEN · % que se suelta / sigma del tamaño (um), lazo 20 kHz")
    print("=" * 110)
    for vf in VFS:
        for im in IMAXS:
            cols = [(Q, w) for Q in QS for w in WORLDS]
            print(f"\n  {vf*60:.1f} m/min, Imax {im:.0f} A   " + " ".join(f"{'Q'+str(int(Q))+' '+w:>12s}" for Q, w in cols))
            for st in order:
                cells = []
                for Q, w in cols:
                    s = RES.get((st, Q, w, vf, im, "20k", 0.010, 1.0, BETA, 0.0))
                    if st.endswith("*") and w == "nom":
                        cells.append(f"{'':>12s}")
                    elif s is None or s["pct"] == 0:
                        cells.append(f"{'0 %':>12s}")
                    else:
                        cells.append(f"{s['pct']:5.0f}%/{s['sd']:5.1f}")
                print(f"  {NOMBRE[st]:30s} " + " ".join(cells))
    print()
    print("=" * 110)
    print("PARTE 1c · LAZO DE 100 kHz (meta) contra 20 kHz (hoy), mundo cal, Imax 70 A")
    print("=" * 110)
    for vf in VFS:
        for Q in ((10.0, 30.0) if not rapido else (30.0,)):
            print(f"\n  >> {vf*60:.1f} m/min | Q = {Q:.0f}")
            print(HDR)
            for st in ("tono", "chirp", "chirp_oido", "bb_v", "bb_z"):
                for ln in ("20k", "100k"):
                    print(fmt_row(f"{NOMBRE[st][:23]} {ln}", RES.get((st, Q, "cal", vf, 70.0, ln, 0.010, 1.0, BETA, 0.0))))
    print()
    print("=" * 110)
    print("PARTE 1d · RUIDO DEL OÍDO (rms a 20 kS/s): 10 mV, 0.1, 0.3, 1 V; Q = 30, mundo cal, Imax 70 A, lazo 20 kHz")
    print("=" * 110)
    for vf in VFS:
        print(f"\n  >> {vf*60:.1f} m/min")
        print(HDR)
        for st in ("chirp_oido", "bb_v", "bb_z"):
            for nz in (0.010, 0.1, 0.3, 1.0):
                print(fmt_row(f"{NOMBRE[st][:22]} {nz*1e3:4.0f} mV", RES.get((st, 30.0, "cal", vf, 70.0, "20k", nz, 1.0, BETA, 0.0))))
        print("  (referencia sin oído: chirp a ciegas)")
        print(fmt_row(NOMBRE["chirp"], RES.get(("chirp", 30.0, "cal", vf, 70.0, "20k", 0.010, 1.0, BETA, 0.0))))
    print()
    print("=" * 110)
    print("PARTE 1e · Q MAL CALIBRADO en el controlador (Q real 30, el Pico cree 20 o 45), mundo cal, 70 A")
    print("=" * 110)
    for vf in VFS:
        print(f"\n  >> {vf*60:.1f} m/min")
        print(HDR)
        for st in ("bb_v", "bb_z"):
            for qm in (0.67, 1.0, 1.5):
                print(fmt_row(f"{NOMBRE[st][:22]} Q̂={30*qm:.0f}", RES.get((st, 30.0, "cal", vf, 70.0, "20k", 0.010, qm, BETA, 0.0))))
    print()
    print("=" * 110)
    print("PARTE 1f · BOMBEO 2w CON RETROALIMENTACIÓN si la gota se afloja más (beta = 2), mundo cal, 70 A")
    print("=" * 110)
    for vf in VFS:
        print(f"\n  >> {vf*60:.1f} m/min")
        print(HDR)
        for st in ("w2_fb", "bb_v"):
            for Q in (10.0, 30.0):
                for b in (1.0, 2.0):
                    print(fmt_row(f"{NOMBRE[st][:20]} Q{Q:.0f} b={b:.0f}", RES.get((st, Q, "cal", vf, 70.0, "20k", 0.010, 1.0, b, 0.0))))
    print()
    print("=" * 110)
    print("PARTE 1g · FASE DEL OÍDO MAL CALIBRADA (el voltaje no sigue a q en fase: error de 30, 60, 90 grados), Q = 30, mundo cal, 70 A")
    print("=" * 110)
    for vf in VFS:
        print(f"\n  >> {vf*60:.1f} m/min")
        print(HDR)
        for st in ("bb_v", "bb_z"):
            for pe in (0.0, 30.0, 60.0, 90.0):
                print(fmt_row(f"{NOMBRE[st][:22]} {pe:3.0f}°", RES.get((st, 30.0, "cal", vf, 70.0, "20k", 0.010, 1.0, BETA, pe))))
    print(f"\n  [{time.time()-T0:.0f} s]")
    # ------------------------------------------------------------------ parte 2 y 3
    print()
    parte_armonicos()
    print()
    sdt = {}
    for st in ("tono", "chirp", "chirp_oido", "bb_v", "bb_z", "bb_z*"):
        for vf in VFS:
            for ln in ("20k", "100k"):
                s = RES.get((st, 30.0, "cal", vf, 70.0, ln, 0.010, 1.0, BETA, 0.0))
                if s is not None and s["pct"] > 0:
                    sdt[f"{NOMBRE[st][:26]} {vf*60:.1f} m/min {ln}"] = s["sdt"]
    parte_apuntar(sdt)
    print()
    parte_cuello()
    print()
    parte_gdl()
    # ------------------------------------------------------------------ telemetría cruda
    print()
    print("=" * 110)
    print("TELEMETRÍA CRUDA: una gota, paso a paso (cada 0.5 ms). a real | a que oye el Pico | q | |z| estimado | I | disparó | t* estimado")
    print("=" * 110)
    for st, vf, ln, Q in (("bb_z", 0.05, "20k", 30.0), ("tono", 0.010, "20k", 30.0)):
        c = dict(strat=st, Q=Q, vf=vf, imax=70.0, world="cal", N=1, seed=4242, trace=True, loop=ln)
        if st in OL:
            tw = TW[(st, Q, vf, 70.0, ln)]; c["ton"] = tw["ton"]
        r = run_cfg(c)
        print(f"\n  {NOMBRE[st]}, {vf*60:.1f} m/min, Q {Q:.0f}, lazo {ln}: suelta en {r['t_rel'][0]*1e3:.2f} ms con {r['a_rel'][0]*1e3:.4f} mm "
              f"(eps {r['eps'][0]*100:+.2f} %, avance x{r['vfm'][0]:.3f})")
        step = 1 if vf > 0.02 else 4
        for row in r["trace"][::step]:
            print(f"   t {row[0]*1e3:6.2f} ms | a {row[1]*1e3:.4f} | oye {row[2]*1e3:.4f} | q {row[3]:+.3f} | |z| {row[4]:.3f} | I {row[5]:5.1f} A | {'SI' if row[6] else '--'} | t* {row[7]*1e3:6.2f}")
    print(f"\n  [total {time.time()-T0:.0f} s]")
