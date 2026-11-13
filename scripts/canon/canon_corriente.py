#!/usr/bin/env python3
"""
Dos ondas en el cable: el circuito puede dibujar I(t) = 40 A + 30 A cos(2 pi f t) sobre un ARCO?
Etapa de potencia identica a la_pluma.py (48 V, Q1 IRFB4227 lado alto con IR2110, D1, snubber, TVS,
choke 41 uH, sensor ACS), carga = arco (18 V + 20 mOhm) despues del cable de 0.5 uH.
Casos: hoy (20 kHz, PI lento)  vs  perfecto (100 kHz, PI rapido + alimentacion anticipada con V medido).
"""
import os, subprocess, sys, textwrap
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
NGSPICE = os.environ.get("NGSPICE", "ngspice")   # ngspice 36 (ver scripts/la-pluma/README.md)

def netlist(p, out):
    return textwrap.dedent(f"""\
    * dos ondas en el arco
    .param FSW={p['FSW']} DMAX={p['DMAX']} KP={p['KP']} KI={p['KI']} FF={p['FF']} I0=40 I1=30 FR={p['F']}
    Vsup s0 0 DC 48
    Rsup s0 sup 15m
    Ce1 sup ce1 4400u IC=48
    Rce1 ce1 ce1b 30m
    Lce1 ce1b 0 20n
    Lbc sup busp 150n
    Rbc busp busp2 3m
    Cf busp2 cf1 4.7u IC=48
    Rcf cf1 cf2 5m
    Lcf cf2 0 5n
    Lh1 busp2 dq 15n
    Vq1 dq dr 0
    M1 dr gq sw IRFB4227
    D1 da sw MBR40
    Lh2 0 da0 15n
    Vd1 da0 da 0
    V12 v12 0 DC 12
    Rbs v12 v12b 4.7
    Dbs v12b vb DBS
    Cbs vb sw 1u IC=11.3
    Dzbs sw vb DZ15
    Sup vb gq pwm 0 SWU
    Sdn gq sw pwmn 0 SWD
    Rgs gq sw 10k
    Dz sw gq DZ15
    Rsn sw sn1 3.3
    Csn sn1 0 10n
    Dtvs sw dtv DTVS
    Rtvsx dtv dr 1m
    Lch sw n1 41u
    Rch n1 n2 22m
    Cpar sw n2 50p
    Vsns n2 out 0
    Cout out co1 1u
    Rco co1 0 1
    Rbl out 0 1k
    Lcab out pen1 0.5u
    Rcab pen1 pen 4m
    * el arco: 18 V + 20 mOhm (corriente solo hacia la pieza)
    Barc pen 0 I = max(0, (v(pen) - 18) / 0.02)
    * sensor ACS (120 kHz + 2 us) y filtro del firmware
    Bacs acs0 0 V = i(Vsns)
    Racs acs0 acs1 1k
    Cacs acs1 0 1.33n
    Bt1 t1in 0 V = 2*v(acs1)
    Rt1 t1in t1a 50
    T1 t1a 0 t1b 0 Z0=50 TD=2u
    Rt2 t1b 0 50
    Rim t1b im 1k
    Cim im 0 {p['CIM']}
    Rvm out vm 1k
    Cvm vm 0 {p['CIM']}
    * referencia: rampa a 40 A en 1 ms, 40 A fijos hasta 4 ms, despues 40 + 30 cos
    Bref ref 0 V = (time < 1m) ? I0*time/1m : ((time < 4m) ? I0 : I0 + I1*cos(6.283185307*FR*(time - 4m)))
    Rdum0 ref 0 1meg
    Be e 0 V = v(ref) - v(im)
    Rdum1 e 0 1meg
    Bxi 0 xi I = (((v(xi) >= DMAX) && (v(e) > 0)) || ((v(xi) <= -0.3) && (v(e) < 0))) ? 0 : KI*v(e)
    Cxi xi 0 1 IC=0
    Bff ff 0 V = FF * (v(vm) + v(ref)*0.026 + 0.7) / 48.7
    Rdum2 ff 0 1meg
    Bu u 0 V = max(0, min(DMAX, v(ff) + v(xi) + KP*v(e)))
    Rdum3 u 0 1meg
    Vsaw saw 0 PULSE(0 1 0 {{1/FSW - 20n}} 20n 0 {{1/FSW}})
    Bpwm pwm 0 V = 0.5*(1 + tanh((v(u) - v(saw) - 0.002)*400))
    Bpwmn pwmn 0 V = 1 - v(pwm)
    Rdum4 pwm 0 1meg
    Rdum5 pwmn 0 1meg
    .model IRFB4227 VDMOS(Vto=4.0 Kp=40 Rd=22m Rs=3m Rg=1.2 Cgdmax=3n Cgdmin=70p A=1 Cgs=4.5n Cjo=1.6n M=0.5 Vj=0.8 Is=5p N=1.1 Rb=5m Tt=150n)
    .model MBR40 D(Is=4e-8 N=1.1 Rs=4m Cjo=2n M=0.5 Vj=0.6 BV=100 Ibv=1m)
    .model DBS D(Is=1e-9 N=1.8 Rs=0.1 Cjo=10p Tt=30n BV=200)
    .model DZ15 D(Is=1e-12 N=1 Rs=5 BV=15 Ibv=10m Cjo=50p)
    .model SWU SW(Ron=17 Roff=1e9 Vt=0.5 Vh=0)
    .model SWD SW(Ron=38 Roff=1e9 Vt=0.5 Vh=0)
    .model DTVS D(Is=1e-12 N=1 Rs=1.5 BV=68 Ibv=1m Cjo=1n)
    .options method=gear reltol=2e-3 abstol=1e-6 vntol=1e-4 itl4=200
    .tran 10n {p['TEND']} 0 {p['TMAX']} uic
    .control
    set wr_singlescale
    set wr_vecnames
    run
    wrdata {out} i(Vsns) v(pen) v(ref) v(u) v(dr) v(sw)
    quit
    .endc
    .end
    """)

def run(name, p):
    cir = os.path.join(HERE, name + ".cir"); out = os.path.join(HERE, name + ".dat")
    open(cir, "w").write(netlist(p, out))
    r = subprocess.run([NGSPICE, "-b", cir], capture_output=True, text=True)
    if not os.path.exists(out):
        print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(1)
    hdr = [h.lower() for h in open(out).readline().split()]
    d = np.loadtxt(out, skiprows=1)
    keep = np.concatenate([np.diff(d[:, 0]) > 0, [True]]); d = d[keep]
    os.remove(out)
    return {k: d[:, i] for i, k in enumerate(hdr)}

def fit(t, y, f):
    w = 2 * np.pi * f
    A = np.vstack([np.ones_like(t), np.cos(w * t), np.sin(w * t)]).T
    c, *_ = np.linalg.lstsq(A, y, rcond=None)
    return c[0], np.hypot(c[1], c[2]), np.degrees(np.arctan2(c[2], c[1]))

CASES = {
    "hoy (20 kHz, PI lento)": dict(FSW=20e3, DMAX=0.75, KP=0.005, KI=9.0, FF=0, CIM="31.8n", TMAX="20n"),
    "perfecto (100 kHz, PI rapido + anticipada)": dict(FSW=100e3, DMAX=0.75, KP=0.05, KI=600.0, FF=1, CIM="6.4n", TMAX="10n"),
}
print("=" * 100)
print("DOS ONDAS SOBRE EL ARCO: referencia 40 A + 30 A cos(2 pi f t); arco 18 V + 20 mOhm; choke 41 uH; bus 48 V")
print("=" * 100)
for f in (668.0, 1268.0):
    ncyc = 4
    for name, p in CASES.items():
        p = dict(p); p["F"] = f; p["TEND"] = 4e-3 + (ncyc + 1) / f
        d = run("canon_" + str(int(f)) + "_" + str(int(p["FSW"] / 1e3)), p)
        t = d["time"]; m = t > 4e-3 + 1.0 / f
        tt = t[m] - 4e-3
        dc, amp, ph = fit(tt, d["i(vsns)"][m], f)
        rdc, ramp, rph = fit(tt, d["v(ref)"][m], f)
        resid = d["i(vsns)"][m] - (dc + amp * np.cos(2 * np.pi * f * tt - np.radians(ph)))
        print(f"  f = {f:6.0f} Hz | {name:42s} | DC {dc:5.1f} A (pedido 40) | onda {amp:5.1f} A (pedido 30) | "
              f"retraso {(ph - rph):6.1f} grados | rizo +-{np.percentile(np.abs(resid), 95):4.1f} A | Vds max {(d['v(dr)'] - d['v(sw)']).max():5.1f} V")
        # traza cruda corta del caso perfecto
        if "perfecto" in name and f == 668.0:
            trace = [(tt_, i_, r_, u_) for tt_, i_, r_, u_ in zip(tt, d["i(vsns)"][m], d["v(ref)"][m], d["v(u)"][m])]
            idx = np.linspace(0, len(trace) - 1, 13).astype(int)
            print("     traza cruda (perfecto, 668 Hz): t ms | pedida | real | duty")
            for k in idx:
                print(f"       {trace[k][0]*1e3:6.3f} | {trace[k][2]:6.1f} | {trace[k][1]:6.1f} | {trace[k][3]:.3f}")
