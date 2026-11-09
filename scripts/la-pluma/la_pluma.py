#!/usr/bin/env python3
"""
LA PLUMA -- simulacion de circuito (ngspice) del reductor de 48 V para depositar metal a mano.

Topologia: buck lado alto (pieza a TIERRA, pluma a pocos volts).
  LRS 48V -> electroliticos 2x2200uF -> pelicula 4.7uF -> Q1 IRFB4227 (IR2110 HO, bootstrap) -> SW
  SW -> choke 41uH (22 mOhm) -> sensor corriente -> SALIDA (10uF pelicula + 1k + Q3 crowbar opcional)
  SALIDA -> cable 0.5uH/4mOhm -> PLUMA -> contacto/puente/arco -> PIEZA = tierra
  D1 MBR40100CT de tierra a SW (rueda libre).
Control (equivalente analogico del firmware): PWM 20 kHz, PI de corriente con tope de duty,
  tension en vacio con duty fijo, deteccion de toque, deteccion de cuello (R sube sobre su minimo)
  y deteccion de arco (V_pluma alta) -> KILL (duty 0, y Q3 encendido si existe).
El contacto/puente/arco es un ESCENARIO (los datos del banco), el circuito es fisica de ngspice.
"""
import os, subprocess, sys, textwrap
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
NGSPICE = os.environ.get("NGSPICE", "ngspice")   # ngspice 36 (sin sudo: apt-get download ngspice; dpkg -x)

BASE = dict(VBUS=48, FSW=20e3, DMAX=0.22, DOCV=0.04, VOCV=5.0, ISET=40.0, LLOOP=30e-9, LCH=41e-6, RCH=0.022,
            KP=0.005, KI=9.0, TRAMP=0.4e-3, DRKILL=0.008, VKILL=8.0, USEQ3=0, DETECT=1, TEND=6.0e-3,
            RGON=10, RGOFF=33, RSN=3.3, CSN=10e-9, TVS=1)

# escenario de una "gota a mano": R de contacto+stickout (ohm) vs tiempo (s); 1e6 = abierto
DOT = [(0, 1e6), (0.999e-3, 1e6), (1.0e-3, 0.017), (1.2e-3, 0.010), (1.6e-3, 0.0045),
       (3.0e-3, 0.0060), (4.0e-3, 0.0075),            # se calienta el alambre
       (4.1e-3, 0.0090), (4.2e-3, 0.0135), (4.3e-3, 0.0210), (4.4e-3, 0.0315),   # la mano levanta: cuello
       (4.402e-3, 1e6), (1.0, 1e6)]                   # revienta
T_RUPT = 4.4e-3
CONT = [(0, 1e6), (0.999e-3, 1e6), (1.0e-3, 0.020), (1.3e-3, 0.040), (2.0e-3, 0.050), (1.0, 0.051)]  # cordon continuo, stickout 20mm

def netlist(p, scen, t_rupt):
    pwl = " ".join(f"{t:.6g} {r:.6g}" for t, r in scen)
    return textwrap.dedent(f"""\
    * LA PLUMA buck 48V lado alto
    .param VBUS={p['VBUS']} FSW={p['FSW']} DMAX={p['DMAX']} DOCV={p['DOCV']} ISET={p['ISET']}
    .param VOCV={p['VOCV']} TRAMP={p['TRAMP']}
    .param KP={p['KP']} KI={p['KI']} DRKILL={p['DRKILL']} VKILL={p['VKILL']} USEQ3={p['USEQ3']} DETECT={p['DETECT']}
    .param TR={t_rupt}
    * ---- fuente LRS-1200-48 + bus ----
    Vsup s0 0 DC {{VBUS}}
    Rsup s0 sup 15m
    Ce1 sup ce1 4400u IC={{VBUS}}
    Rce1 ce1 ce1b 30m
    Lce1 ce1b 0 20n
    Lbc sup busp 150n
    Rbc busp busp2 3m
    Cf busp2 cf1 4.7u IC={{VBUS}}
    Rcf cf1 cf2 5m
    Lcf cf2 0 5n
    * ---- lazo caliente: pelicula -> Q1 -> SW -> D1 -> tierra ----
    Lh1 busp2 dq {p['LLOOP']/2}
    Vq1 dq dr 0
    M1 dr gq sw IRFB4227
    D1 da sw MBR40
    Lh2 0 da0 {p['LLOOP']/2}
    Vd1 da0 da 0
    * ---- IR2110 lado alto con bootstrap (VCC 12V de la fuente de PC) ----
    V12 v12 0 DC 12
    Rbs v12 v12b 4.7
    Dbs v12b vb DBS
    Cbs vb sw 1u IC=11.3
    Dzbs sw vb DZ15
    Sup vb gq pwm 0 SWU
    Sdn gq sw pwmn 0 SWD
    Rgs gq sw 10k
    Dz sw gq DZ15
    * snubber RC sobre D1 y TVS 1.5KE68A sobre Q1
    Rsn sw sn1 {p['RSN']}
    Csn sn1 0 {p['CSN']}
    Dtvs sw dtv DTVS
    Rtvsx dtv dtv2 {'1m' if p['TVS'] else '1g'}
    Vtv dtv2 dr 0
    * ---- choke + sensor + salida ----
    Lch sw n1 {p['LCH']}
    Rch n1 n2 {p['RCH']}
    Cpar sw n2 50p
    Vsns n2 out 0
    Cout out co1 10u
    Rco co1 0 5m
    Rbl out 0 1k
    * ---- Q3 crowbar (opcional) manejado por IR2110 LO ----
    Vq3 out dq3 0
    M3 dq3 gq3 0 IRFB4227
    Blo loi 0 V = 12 * v(cb)
    Rg3 loi gq3 4.7
    Rgs3 gq3 0 10k
    * ---- cable a la pluma ----
    Lcab out pen1 0.5u
    Rcab pen1 pen 4m
    * ---- carga: contacto/stickout/puente (escenario) + arco ----
    Vrs rsc 0 PWL({pwl})
    Bload pen 0 I = v(pen) * ((v(rsc) < 10) ? 1/v(rsc) : 0)
    Bvarc varc 0 V = 13 + 500*max(0, time - TR)
    Biarcv iarcv 0 V = v(alive) * max(0, (v(pen) - v(varc)) / 0.02)
    Barc pen 0 I = v(iarcv)
    Rdum1 varc 0 1meg
    Rdum2 iarcv 0 1meg
    * vivo = despues de la ruptura y no muerto; muere si I_arco < 0.3A pasados 10us (no reenciende)
    Bdead 0 dead I = (((time > TR + 10u) && (v(iarcv) < 0.3)) || (v(dead) > 0.5)) ? (1 - v(dead))*1e-2 : -v(dead)*1e-2
    Cdead dead 0 1n IC=0
    Balive alive 0 V = ((time > TR) && (v(dead) < 0.5)) ? 1 : 0
    Rdum3 alive 0 1meg
    * ---- sensor ACS: 120kHz + 2us de retardo; promedio del firmware 5kHz ----
    Bacs acs0 0 V = i(Vsns)
    Racs acs0 acs1 1k
    Cacs acs1 0 1.33n
    Bt1 t1in 0 V = 2*v(acs1)
    Rt1 t1in t1a 50
    T1 t1a 0 t1b 0 Z0=50 TD=2u
    Rt2 t1b 0 50
    Rim t1b im 1k
    Cim im 0 31.8n
    Rvm out vm 1k
    Cvm vm 0 31.8n
    * ---- logica del firmware ----
    Brest rest 0 V = v(vm) / max(v(im), 1)
    Btouch 0 touch I = (((time > 0.1m) && (v(im) > 3)) || (v(touch) > 0.5)) ? (1 - v(touch))*1e-2 : -v(touch)*1e-2
    Ctouch touch 0 1n IC=0
    Btt 0 tt I = v(touch) * 1e-6
    Ctt tt 0 1u IC=0
    Brmin 0 rmin I = (v(touch) < 0.5 || v(tt) < 0.3m) ? (v(rest) - v(rmin))*0.05 : ((v(rest) < v(rmin)) ? (v(rest) - v(rmin))*0.05 : (v(rest) - v(rmin))*2e-4)
    Crmin rmin 0 1u IC=1
    Bkill 0 kill I = (((DETECT > 0.5) && (v(touch) > 0.5) && (v(tt) > 0.5m) && (((v(rest) - v(rmin)) > DRKILL) || (v(vm) > VKILL))) || (v(kill) > 0.5)) ? (1 - v(kill))*1e-2 : -v(kill)*1e-2
    Ckill kill 0 1n IC=0
    Bcb cb 0 V = ((USEQ3 > 0.5) && (v(kill) > 0.5)) ? 1 : 0
    Rdum4 cb 0 1meg
    * PI con anti-windup; antes del toque sigue a DOCV; despues del KILL va a 0
    Be e 0 V = ISET*min(1, v(tt)/TRAMP) - v(im)
    Rdum5 e 0 1meg
    Bxi 0 xi I = (v(kill) > 0.5) ? -v(xi)*1e4 : ((v(touch) < 0.5) ? (((v(vm) < VOCV) ? DOCV : 0) - v(xi))*1e5 : (((v(xi) >= DMAX) && (v(e) > 0)) || ((v(xi) <= 0) && (v(e) < 0)) ? 0 : KI*v(e)))
    Cxi xi 0 1 IC={p['DOCV']}
    Bu u 0 V = (v(kill) > 0.5) ? 0 : ((v(touch) < 0.5) ? (((v(vm) < VOCV) && (time > 0.1m)) ? DOCV : 0) : max(0, min(DMAX, v(xi) + KP*v(e))))
    Rdum6 u 0 1meg
    Vsaw saw 0 PULSE(0 1 0 {{1/FSW - 20n}} 20n 0 {{1/FSW}})
    Bpwm pwm 0 V = 0.5*(1 + tanh((v(u) - v(saw) - 0.002)*400))
    Bpwmn pwmn 0 V = 1 - v(pwm)
    Rdum7 pwm 0 1meg
    Rdum8 pwmn 0 1meg
    * ---- modelos ----
    .model IRFB4227 VDMOS(Vto=4.0 Kp=40 Rd=22m Rs=3m Rg=1.2 Cgdmax=3n Cgdmin=70p A=1 Cgs=4.5n Cjo=1.6n M=0.5 Vj=0.8 Is=5p N=1.1 Rb=5m Tt=150n)
    .model MBR40 D(Is=4e-8 N=1.1 Rs=4m Cjo=2n M=0.5 Vj=0.6 BV=100 Ibv=1m)
    .model DBS D(Is=1e-9 N=1.8 Rs=0.1 Cjo=10p Tt=30n BV=200)
    .model DZ15 D(Is=1e-12 N=1 Rs=5 BV=15 Ibv=10m Cjo=50p)
    .model SWU SW(Ron={7+p['RGON']} Roff=1e9 Vt=0.5 Vh=0)
    .model SWD SW(Ron={5+p['RGOFF']} Roff=1e9 Vt=0.5 Vh=0)
    .model DTVS D(Is=1e-12 N=1 Rs=1.5 BV=68 Ibv=1m Cjo=1n)
    .options method=gear reltol=2e-3 abstol=1e-6 vntol=1e-4 itl4=200
    .tran 10n {p['TEND']} 0 20n uic
    .control
    set wr_singlescale
    set wr_vecnames
    run
    wrdata {{OUT}} i(Vsns) v(pen) v(out) v(sw) v(dr) v(gq) i(Vq1) i(Vd1) i(Vq3) v(rsc) v(iarcv) v(u) v(im) v(rest) v(rmin) v(touch) v(kill) v(vb) i(Vsup) v(busp2) i(Vtv) v(sn1)
    quit
    .endc
    .end
    """)

def run(name, p, scen, t_rupt):
    cir = os.path.join(HERE, f"{name}.cir")
    out = os.path.join(HERE, f"{name}.dat")
    with open(cir, "w") as f:
        f.write(netlist(p, scen, t_rupt).replace("{OUT}", out))
    r = subprocess.run([NGSPICE, "-b", cir], capture_output=True, text=True)
    if not os.path.exists(out):
        print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit(1)
    with open(out) as f:
        hdr = f.readline().split()
    d = np.loadtxt(out, skiprows=1)
    keep = np.concatenate([np.diff(d[:, 0]) > 0, [True]])   # quita iteraciones con dt=0 (fallas del solver)
    d = d[keep]
    return {k.lower(): d[:, i] for i, k in enumerate(hdr)}

def integ(t, y, mask=None):
    if mask is not None:
        y = np.where(mask, y, 0)
    return np.trapezoid(y, t)

def report(name, d, t_rupt, rows):
    t = d["time"]
    ich = d["i(vsns)"]; vpen = d["v(pen)"]; rsc = d["v(rsc)"]
    iload = np.where(rsc < 10, vpen / np.maximum(rsc, 1e-9), 0)
    iarc = d["v(iarcv)"]
    e_gota = integ(t, vpen * iload)
    e_arco = integ(t, vpen * iarc)
    vds = d["v(dr)"] - d["v(sw)"]
    t_touch = t[np.argmax(d["v(touch)"] > 0.5)] if (d["v(touch)"] > 0.5).any() else float("nan")
    t_kill = t[np.argmax(d["v(kill)"] > 0.5)] if (d["v(kill)"] > 0.5).any() else float("nan")
    k_r = np.searchsorted(t, t_rupt)
    i_bridge_rupt = iload[max(k_r - 5, 0)]
    arc_on = iarc > 0.3
    t_arc = (t[arc_on][-1] - t[arc_on][0]) if arc_on.any() else 0.0
    m_ss = (t > 2.6e-3) & (t < 3.4e-3)
    p_q1 = integ(t, vds * d["i(vq1)"], m_ss) / 0.8e-3
    p_d1 = integ(t, -d["v(sw)"] * d["i(vd1)"], m_ss) / 0.8e-3
    p_pen = integ(t, vpen * iload, m_ss) / 0.8e-3
    p_in = integ(t, 48 * (-d["i(vsup)"]), m_ss) / 0.8e-3
    pre = (t > 0.5e-3) & (t < 0.95e-3)
    ocv = vpen[pre].mean()
    after_touch = (t > 1.0e-3) & (t < 2.0e-3)
    rows.append((name, ocv, ich[after_touch].max(), np.mean(ich[m_ss]), np.ptp(ich[m_ss]), np.mean(d["v(u)"][m_ss]),
                 vds.max(), d["v(sw)"].min(), t_touch, t_kill, i_bridge_rupt, e_gota, e_arco, t_arc,
                 p_q1, p_d1, p_pen, p_in, np.abs(d["i(vq3)"]).max()))
    return t, ich, vpen, iload, iarc

def trace(name, d, t0, t1, n=14):
    t = d["time"]
    print(f"\n  traza cruda {name}  ({t0*1e3:.2f}-{t1*1e3:.2f} ms)")
    print(f"   {'t ms':>7} {'I_choke':>8} {'V_pluma':>8} {'R_contacto':>10} {'I_arco':>7} {'duty':>6} {'R_est':>7} {'R_min':>7} {'kill':>5}")
    for tt in np.linspace(t0, t1, n):
        k = np.searchsorted(t, tt)
        r = d["v(rsc)"][k]
        rs = "abierto" if r > 10 else f"{r*1e3:7.1f}m"
        print(f"   {t[k]*1e3:7.3f} {d['i(vsns)'][k]:8.2f} {d['v(pen)'][k]:8.3f} {rs:>10} {d['v(iarcv)'][k]:7.2f} {d['v(u)'][k]:6.3f} {d['v(rest)'][k]*1e3:6.1f}m {d['v(rmin)'][k]*1e3:6.1f}m {d['v(kill)'][k]:5.1f}")

if __name__ == "__main__":
    cases = [
        ("A_48V_sin_tope",      dict(DMAX=0.95, DETECT=0, USEQ3=0)),
        ("B_tope_0.22",         dict(DMAX=0.22, DETECT=0, USEQ3=0)),
        ("C_tope_y_deteccion",  dict(DMAX=0.22, DETECT=1, USEQ3=0)),
        ("D_tope_det_Q3",       dict(DMAX=0.22, DETECT=1, USEQ3=1)),
    ]
    rows = []
    data = {}
    for name, over in cases:
        p = dict(BASE); p.update(over)
        d = run(name, p, DOT, T_RUPT)
        data[name] = d
        report(name, d, T_RUPT, rows)
        print(f"  ok {name}: {len(d['time'])} puntos", flush=True)
    for name, over in [("E_continuo_lazo30nH", dict(DETECT=0, ISET=46.0, TEND=4e-3)),
                       ("F_continuo_lazo150nH", dict(DETECT=0, ISET=46.0, TEND=4e-3, LLOOP=150e-9))]:
        p = dict(BASE); p.update(over)
        d = run(name, p, CONT, 1.0)
        data[name] = d
        report(name, d, 1.0, rows)
        print(f"  ok {name}: {len(d['time'])} puntos", flush=True)

    print("\n" + "=" * 100)
    print("RESUMEN (gota a mano: toque 1.0 ms, la mano levanta 4.0 ms, revienta 4.4 ms)")
    print("=" * 100)
    hdr = ["caso", "OCV V", "Ipico toque", "I prom", "rizo pp", "duty", "Vds max", "SW min", "toque ms", "kill ms",
           "I puente@ruptura", "E gota mJ", "E arco mJ", "arco us", "P_Q1 W", "P_D1 W", "P_pluma W", "P_entrada W", "I_Q3 max"]
    for r in rows:
        print(f"\n  {r[0]}")
        vals = r[1:]
        fmt = ["{:.2f}", "{:.1f}", "{:.1f}", "{:.1f}", "{:.3f}", "{:.1f}", "{:.1f}", "{:.3f}", "{:.3f}",
               "{:.1f}", "{:.1f}", "{:.1f}", "{:.0f}", "{:.1f}", "{:.1f}", "{:.1f}", "{:.1f}", "{:.1f}"]
        for h, v, f in zip(hdr[1:], vals, fmt):
            if h in ("E gota mJ", "E arco mJ"):
                v = v * 1e3
            if h in ("toque ms", "kill ms"):
                v = v * 1e3
            if h == "arco us":
                v = v * 1e6
            print(f"     {h:18s} {f.format(v)}")
    for name in ("B_tope_0.22", "C_tope_y_deteccion", "D_tope_det_Q3"):
        trace(name, data[name], 3.95e-3, 4.75e-3, 17)
    trace("D_tope_det_Q3 (toque)", data["D_tope_det_Q3"], 0.9e-3, 1.8e-3, 10)
