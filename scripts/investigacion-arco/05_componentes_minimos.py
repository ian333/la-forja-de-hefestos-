#!/usr/bin/env python3
"""
INVESTIGACION DEL ARCO 05 -- reducir el numero de componentes y aumentar el control.

Banco nuevo: LRS-1200-48 + La Pluma + alimentador de la SOMI (motor DC, rodillo, brazo, punta)
atornillado con M8 a una base minima.

Secciones (todas imprimen telemetria cruda; el .out es la salida de este script):
  1. Lista de materiales actual (La Pluma + banco), con conteo.
  2. Cuentas de quitar/fusionar: choque contra cables/barras, observador volt-segundo, Hall contra shunt.
  3. ngspice: circuito BASE (La Pluma de hoy) contra MIN (circuito minimo) y variantes:
       regulacion (escalon 20->40 A, rizo, Vds, perdidas, corrientes de los capacitores),
       arranque (toque + retraccion vs toque a corriente plena), corto durante el arco,
       apagado (PARO/SD y arco que se apaga a 40 A), onda 40+30 A a 668 Hz (Hall vs shunt),
       y el reductor LADO BAJO (sin IR2110) para ver que pierde.
  4. Motor del alimentador (modelo con parametros SUPUESTOS): retraccion, fuerza contraelectromotriz,
     holgura del forro, sincronia con las gotas.
  5. Base: inductancia del lazo (cables vs barras) y campo B en el arco por trazado (Laplace en la placa
     + Biot-Savart).
  6. Tabla antes -> despues.

ngspice 36: exporta NGSPICE apuntando al wrapper (ver scripts/la-pluma/README.md).
Los .cir/.raw se escriben en un directorio temporal y se borran; no deja archivos en el repo.
"""
import os, sys, subprocess, tempfile, textwrap, math, shutil
from concurrent.futures import ThreadPoolExecutor
import numpy as np

NGSPICE = os.environ.get("NGSPICE", "ngspice")
WORK = tempfile.mkdtemp(prefix="inv05_")
MU0 = 4e-7 * math.pi

def hr(t):
    print("\n" + "=" * 110); print(t); print("=" * 110)

# =====================================================================================================
# 3. ngspice
# =====================================================================================================
MODELS = """
.model IRFB4227 VDMOS(Vto=4.0 Kp=40 Rd=22m Rs=3m Rg=1.2 Cgdmax=3n Cgdmin=70p A=1 Cgs=4.5n Cjo=1.6n M=0.5 Vj=0.8 Is=5p N=1.1 Rb=5m Tt=150n)
.model MBR40 D(Is=4e-8 N=1.1 Rs=4m Cjo=2n M=0.5 Vj=0.6 BV=100 Ibv=1m)
.model DBS D(Is=1e-9 N=1.8 Rs=0.1 Cjo=10p Tt=30n BV=200)
.model DZ15 D(Is=1e-12 N=1 Rs=5 BV=15 Ibv=10m Cjo=50p)
.model DTVS D(Is=1e-12 N=1 Rs=1.5 BV=68 Ibv=1m Cjo=1n)
.model DCL D(Is=1e-9 N=1.5 Rs=20m Cjo=40p Tt=30n BV=400 Ibv=1u)
"""

# circuito de hoy (la_pluma.py / canon_corriente.py) y circuito minimo
BASE20 = dict(name="BASE20", FSW=20e3, LLOOP=30e-9, CF=4.7e-6, RGON=10, RGOFF=33, ZBS=1, ZG=1, SNUB=1, TVS=1,
              LCH=41e-6, RCH=0.022, COUT=10e-6, RBL=1e3, LCAB=0.5e-6, RCAB=4e-3, LRET=1e-12, RSH=1e-6,
              SENSOR="hall", CFW=31.8e-9, KP=0.005, KI=9.0, FF=0, RFF=0.03, DMAX=0.75, DOCV=0.04)
BASE100 = dict(BASE20, name="BASE100", FSW=100e3, CFW=6.4e-9, KP=0.05, KI=600.0, FF=1)
MIN = dict(name="MIN", FSW=100e3, LLOOP=15e-9, LBC=30e-9, CF=4.7e-6, RGON=22, RGOFF=22, ZBS=0, ZG=0, SNUB=0, TVS=0,
           LCH=15e-6, RCH=0.011, COUT=1e-6, RBL=16e3, CLAMP=1, VBUSMEAS=0, LCAB=0.12e-6, RCAB=1.5e-3, LRET=0.03e-6, RSH=0.5e-3,
           SENSOR="shunt", CFW=6.4e-9, KP=0.05 * 15 / 41, KI=600.0 * 15 / 41, FF=1, RFF=0.02, DMAX=0.75, DOCV=0.05)
MIN_L41 = dict(MIN, name="MIN_L41", LCH=41e-6, RCH=0.022, KP=0.05, KI=600.0)
MIN_C10 = dict(MIN, name="MIN_C10sinD2", COUT=10e-6, CLAMP=0)
MIN_RG10 = dict(MIN, name="MIN_rg10", RGON=10, RGOFF=10)
MIN_RG10S = dict(MIN, name="MIN_rg10_snub", RGON=10, RGOFF=10, SNUB=1)
MIN_BUS150 = dict(MIN, name="MIN_bus150", LBC=150e-9)
MIN_LAZO30 = dict(MIN, name="MIN_lazo30", LLOOP=30e-9)
MIN_LAZO60 = dict(MIN, name="MIN_lazo60", LLOOP=60e-9)
MIN_HALL = dict(MIN, name="MIN_hall", SENSOR="hall")
REG_SET = (BASE20, BASE100, MIN, MIN_RG10, MIN_RG10S, MIN_BUS150, MIN_LAZO30, MIN_LAZO60, MIN_L41, MIN_C10, MIN_HALL)


def netlist(p, sc, raw):
    """p = circuito, sc = escenario. Buck lado alto, carga referida a tierra (alambre DCEN a GND)."""
    I0, V0 = 0.0, 0.0          # el circuito arranca descargado (uic consistente); la meta va en itgt
    xi0 = sc.get("XI0", 0.0)
    rsc = " ".join(f"{t:.6g} {r:.6g}" for t, r in sc["rsc"])
    gap = " ".join(f"{t:.6g} {g:.6g}" for t, g in sc["gap"])
    hall = p["SENSOR"] == "hall"
    sensor = (f"""
    * sensor Hall ACS758: 120 kHz + 1 us de propagacion (hoja de datos: respuesta 4 us)
    Bacs acs0 0 V = i(Vsns)
    Racs acs0 acs1 1k
    Cacs acs1 0 1.33n IC={I0}
    Bt1 t1in 0 V = 2*v(acs1)
    Rt1 t1in t1a 50
    T1 t1a 0 t1b 0 Z0=50 TD=1u
    Rt2 t1b 0 50
    Rim t1b im 1k""" if hall else f"""
    * shunt en el retorno + INA240 (400 kHz, sin retardo)
    Bsh shs 0 V = i(Vsh)
    Rsh1 shs sh1 1k
    Csh1 sh1 0 398p IC={I0}
    Rim sh1 im 1k""")
    return textwrap.dedent(f"""\
    * inv05 {p['name']} / {sc['name']}
    .param FSW={p['FSW']} DMAX={p['DMAX']} KP={p['KP']} KI={p['KI']} FF={p['FF']} RFF={p['RFF']}
    .param DOCV={p['DOCV']} VOCV={sc.get('VOCV', 6.0)} ITOUCH={sc.get('ITOUCH', 0.5)} CM0={sc.get('CM0', 0)}
    .param TKILL={sc.get('TKILL', 1.0)} KILLV={sc.get('KILLV', 1e3)} SHORTCTL={sc.get('SHORTCTL', 0)}
    .param SRU={sc.get('SRU', 8e4)} SRD={sc.get('SRD', 1e9)} TFAST={sc.get('TFAST', 0.25e-3)} IMIN=1.0 GRACE={sc.get('GRACE', 50e-6)}
    * ---- LRS-1200-48 + bus ----
    Vsup s0 0 DC 48
    Rsup s0 sup 15m
    Vce sup ce0 0
    Ce1 ce0 ce1 4400u IC=48
    Rce1 ce1 ce1b 30m
    Lce1 ce1b 0 20n
    Lbc sup busp {p.get('LBC', 150e-9)}
    Rbc busp busp2 3m
    Vcf busp2 cf0 0
    Cf cf0 cf1 {p['CF']} IC=48
    Rcf cf1 cf2 5m
    Lcf cf2 0 5n
    * ---- lazo caliente: pelicula -> Q1 -> SW -> D1 -> tierra ----
    Lh1 busp2 dq {p['LLOOP']/2}
    Vq1 dq dr 0
    M1 dr gq sw IRFB4227
    D1 da sw MBR40
    Lh2 0 da0 {p['LLOOP']/2}
    Vd1 da0 da 0
    * ---- IR2110 HO con bootstrap (VCC 12 V del DC-DC) ----
    V12 v12 0 DC 12
    Rbs v12 v12b 4.7
    Dbs v12b vb DBS
    Cbs vb sw 1u IC=11.3
    {'Dzbs sw vb DZ15' if p['ZBS'] else '* sin zener de bootstrap'}
    Bgu vb gq I = v(vb,gq) * v(pwm) / RONU
    Bgd gq sw I = v(gq,sw) * v(pwmn) / ROND
    Rgs gq sw 10k
    {'Dz sw gq DZ15' if p['ZG'] else '* sin zener de compuerta'}
    {'Rsn sw sn1 3.3' if p['SNUB'] else '* sin snubber'}
    {'Csn sn1 0 10n' if p['SNUB'] else ''}
    {'Dtvs sw dtv DTVS' if p['TVS'] else '* sin TVS'}
    {'Vtv dtv dr 0' if p['TVS'] else ''}
    * ---- choque ----
    Lch sw n1 {p['LCH']} IC={I0}
    Rch n1 n2 {p['RCH']}
    Cpar sw n2 50p
    Vsns n2 out 0
    Cout out co1 {p['COUT']} IC={V0}
    Rco co1 0 5m
    Rbl out 0 {p['RBL']}
    {'D2 out d2a DCL' if p.get('CLAMP', 0) else '* sin diodo de pinza a la salida'}
    {'Vd2 d2a busp2 0' if p.get('CLAMP', 0) else ''}
    * ---- ida a la pieza (cable o barra) ----
    Lcab out pen1 {p['LCAB']} IC={I0}
    Rcab pen1 pen {p['RCAB']}
    * ---- carga: contacto/puente (escenario) + arco V = 14 + 10*gap[mm] + 20 mOhm ----
    Vrs rsc 0 PWL({rsc})
    Vgp gap 0 PWL({gap})
    Bload pen ret I = v(pen,ret) * ((v(rsc) < 10) ? 1/v(rsc) : 0)
    Bvarc varc 0 V = 14 + 10*v(gap)
    Biarcv iarcv 0 V = v(alive) * max(0, (v(pen,ret) - v(varc)) / 0.02)
    Barc pen ret I = v(iarcv)
    Rd1 varc 0 1meg
    Rd2 iarcv 0 1meg
    * tiempo desde que se abrio el contacto; el arco muere si I < IMIN pasado GRACE; renace en cada contacto
    Btop 0 topen I = (v(rsc) > 10) ? 1e-6 : -v(topen)*1e-1
    Ctop topen 0 1u IC=0
    Bdead 0 dead I = ((v(rsc) > 10) && (((v(topen) > GRACE) && (v(iarcv) < IMIN)) || (v(dead) > 0.5))) ? (1 - v(dead))*1e-2 : -v(dead)*1e-2
    Cdead dead 0 1n IC=0
    Balive alive 0 V = ((v(rsc) > 10) && (v(dead) < 0.5)) ? 1 : 0
    Rd3 alive 0 1meg
    * ---- retorno: barra + shunt a la estrella ----
    Lret ret ret1 {p['LRET']} IC={I0}
    Vsh ret1 ret2 0
    Rshunt ret2 0 {p['RSH']}
    {sensor}
    Cim im 0 {p['CFW']} IC={I0}
    Rvm out vm 1k
    Cvm vm 0 {p['CFW']} IC={V0}
    Rvb busp2 vbm 1k
    Cvb vbm 0 {p['CFW']} IC=48
    * ---- firmware (equivalente analogico) ----
    Bcm 0 cm I = ((CM0 > 0.5) || ((time > 50u) && (v(im) > ITOUCH)) || (v(cm) > 0.5)) ? (1 - v(cm))*1e-2 : -v(cm)*1e-2
    Ccm cm 0 1n IC={sc.get('CM0', 0)}
    Btt 0 tt I = v(cm) * 1e-6
    Ctt tt 0 1u IC=0
    Bkill 0 kill I = ((time > TKILL) || (v(vm) > KILLV) || (v(kill) > 0.5)) ? (1 - v(kill))*1e-2 : -v(kill)*1e-2
    Ckill kill 0 1n IC=0
    Bsc 0 scl I = ((SHORTCTL > 0.5) && (v(cm) > 0.5) && ((v(vm) < 8) || ((v(scl) > 0.5) && (v(vm) < 13)))) ? (1 - v(scl))*1e-2 : -v(scl)*1e-2
    Csc scl 0 1n IC=0
    Bitg itgt 0 V = {sc['itgt']}
    Rd4 itgt 0 1meg
    Birf 0 irf I = 1e-6*max(-SRD, min(((time < TFAST) ? 1e9 : SRU), (v(itgt) - v(irf))*1e6))
    Cirf irf 0 1u IC=0
    Be e 0 V = v(irf) - v(im)
    Rd5 e 0 1meg
    Bxi 0 xi I = ((v(cm) < 0.5) || (v(kill) > 0.5)) ? -v(xi)*1e3 : ((((v(xi) >= DMAX - v(ff)) && (v(e) > 0)) || ((v(xi) <= -0.3) && (v(e) < 0))) ? 0 : KI*v(e))
    Cxi xi 0 1 IC={xi0}
    Bff ff 0 V = FF*(v(vm) + v(irf)*RFF + 0.6)/({'max(v(vbm), 20)' if p.get('VBUSMEAS', 1) else '48'})
    Rd6 ff 0 1meg
    Bu u 0 V = (v(kill) > 0.5) ? 0 : ((v(cm) > 0.5) ? max(0, min(DMAX, v(ff) + v(xi) + KP*v(e))) : (((v(vm) < VOCV) && (time > 20u)) ? DOCV : 0))
    Rd7 u 0 1meg
    Vsaw saw 0 PULSE(0 1 0 {{1/FSW - 20n}} 20n 0 {{1/FSW}})
    Bpwm pwm 0 V = 0.5*(1 + tanh((v(u) - v(saw) - 0.002)*400))
    Bpwmn pwmn 0 V = 1 - v(pwm)
    Rd8 pwm 0 1meg
    Rd9 pwmn 0 1meg
    {MODELS}
    .param RONU={7 + p['RGON']} ROND={5 + p['RGOFF']}
    .options method=gear reltol=2e-3 abstol=1e-6 vntol=1e-4 itl4=200
    .tran 10n {sc['TEND']} 0 {sc.get('TMAX', '10n')} uic
    .control
    set filetype=binary
    run
    write {raw} i(Vsns) i(Vsh) v(out) v(pen) v(ret) v(sw) v(dr) v(da) v(gq) v(vb) i(Vq1) i(Vd1) i(Vce) i(Vcf) i(Vsup) v(u) v(im) v(vm) v(irf) v(iarcv) v(rsc) v(cm) v(scl) v(kill) v(busp2){' i(Vd2)' if p.get('CLAMP', 0) else ''}
    quit
    .endc
    .end
    """)


def netlist_inv(p, sc, raw):
    """Reductor LADO BAJO (sin IR2110): pieza en +48 (bus), Q1 con fuente a tierra, D1 de SW al bus.
    Corriente con shunt alto + INA240 (modo comun 48 V). Solo regimen permanente."""
    I0, V0 = 0.0, 0.0          # arranque desde cero (uic consistente)
    return textwrap.dedent(f"""\
    * inv05 reductor lado bajo
    Vsup s0 0 DC 48
    Rsup s0 sup 15m
    Vce sup ce0 0
    Ce1 ce0 ce1 4400u IC=48
    Rce1 ce1 ce1b 30m
    Lce1 ce1b 0 20n
    Lbc sup busp {p.get('LBC', 150e-9)}
    Rbc busp busp2 3m
    Vcf busp2 cf0 0
    Cf cf0 cf1 {p['CF']} IC=48
    Rcf cf1 cf2 5m
    Lcf cf2 0 5n
    * lazo caliente: pelicula -> D1 -> SW -> Q1 -> tierra
    Lh1 busp2 dk {p['LLOOP']/2}
    Vd1 sw da 0
    D1 da dk MBR40
    Vq1 sw dr 0
    M1 dr gq src IRFB4227
    Lh2 src 0 {p['LLOOP']/2}
    * manejador lado bajo referido a tierra (tipo UCC27511), sin bootstrap
    V12 v12 0 DC 12
    Bgu v12 gq I = v(v12,gq) * v(pwm) / RONU
    Bgd gq 0 I = v(gq) * v(pwmn) / ROND
    Rgs gq 0 10k
    * salida: Cout entre bus y la salida del choque
    Lch out n1 {p['LCH']} IC={I0}
    Rch n1 sw {p['RCH']}
    Cout busp2 co1 {p['COUT']} IC={V0}
    Rco co1 out 5m
    Rbl busp2 out {p['RBL']}
    * pieza = bus+ por shunt alto y barra; antorcha = salida del choque por barra
    Vsh busp2 sh1 0
    Rshunt sh1 sh2 {p['RSH']}
    Lret sh2 wp {p['LRET']} IC={I0}
    Lcab out pen1 {p['LCAB']} IC={-I0}
    Rcab pen1 pen {p['RCAB']}
    Barc wp pen I = max(0, (v(wp,pen) - 24) / 0.02)
    * medicion: INA240 sobre el shunt; V_arco = V(pieza) - V(antorcha) con dos canales del ADC
    Bsh shs 0 V = i(Vsh)
    Rsh1 shs sh1f 1k
    Csh1 sh1f 0 398p IC={I0}
    Rim sh1f im 1k
    Cim im 0 {p['CFW']} IC={I0}
    Bvm vmr 0 V = v(busp2) - v(out)
    Rvm vmr vm 1k
    Cvm vm 0 {p['CFW']} IC={V0}
    Be e 0 V = 40 - v(im)
    Bxi 0 xi I = KI*v(e)
    Cxi xi 0 1 IC=0
    Bu u 0 V = max(0, min(0.75, (v(vm) + 40*0.02 + 0.6)/48 + v(xi) + KP*v(e)))
    Rd7 u 0 1meg
    Vsaw saw 0 PULSE(0 1 0 {{1/{p['FSW']} - 20n}} 20n 0 {{1/{p['FSW']}}})
    Bpwm pwm 0 V = 0.5*(1 + tanh((v(u) - v(saw) - 0.002)*400))
    Bpwmn pwmn 0 V = 1 - v(pwm)
    Rd8 pwm 0 1meg
    Rd9 pwmn 0 1meg
    .param KP={p['KP']} KI={p['KI']}
    {MODELS}
    .param RONU={7 + p['RGON']} ROND={5 + p['RGOFF']}
    .options method=gear reltol=2e-3 abstol=1e-6 vntol=1e-4 itl4=200
    .tran 10n {sc['TEND']} 0 10n uic
    .control
    set filetype=binary
    run
    write {raw} i(Vsh) i(Vd1) i(Vq1) i(Vce) i(Vcf) i(Vsup) v(busp2) v(wp) v(pen) v(out) v(sw) v(dr) v(src) v(da) v(dk) v(gq) v(u) v(im)
    quit
    .endc
    .end
    """)


def read_raw(path):
    with open(path, "rb") as f:
        data = f.read()
    k = data.index(b"Binary:\n")
    head = data[:k].decode("latin-1").splitlines()
    nv = int([l for l in head if l.startswith("No. Variables")][0].split(":")[1])
    npnt = int([l for l in head if l.startswith("No. Points")][0].split(":")[1])
    i0 = head.index("Variables:")
    names = [head[i0 + 1 + j].split()[1].lower() for j in range(nv)]
    arr = np.frombuffer(data[k + 8:k + 8 + 8 * nv * npnt], dtype=np.float64).reshape(npnt, nv)
    keep = np.concatenate([np.diff(arr[:, 0]) > 0, [True]])   # quita pasos con dt = 0
    arr = arr[keep]
    return {n: (arr[:, j].copy() if j == 0 else arr[:, j].astype(np.float32)) for j, n in enumerate(names)}


def run_case(args):
    p, sc, kind = args
    tag = f"{p['name']}__{sc['name']}"
    cir = os.path.join(WORK, tag + ".cir"); raw = os.path.join(WORK, tag + ".raw")
    txt = (netlist_inv if kind == "inv" else netlist)(p, sc, raw)
    with open(cir, "w") as f:
        f.write(txt)
    r = subprocess.run([NGSPICE, "-b", cir], capture_output=True, text=True)
    if not os.path.exists(raw):
        return tag, None, r.stdout[-2500:] + r.stderr[-2500:]
    d = read_raw(raw)
    os.remove(raw)
    return tag, d, ""




# ---------------------------------------------------------------------------------------------------
# escenarios
# ---------------------------------------------------------------------------------------------------
OPEN = [(0, 1e6), (1, 1e6)]

def v_out0(p, gap, I):
    return 14 + 10 * gap + 0.02 * I + I * (p["RCAB"] + p["RSH"])

def sc_reg(p):
    I0 = 20.0; V0 = v_out0(p, 1.0, I0)
    xi0 = 0.0 if p["FF"] else (V0 + I0 * p["RCH"] + 0.25) / 48
    return dict(name="reg", I0=I0, V0=V0, CM0=1, XI0=xi0, TEND=3.4e-3, SRU=1e9,
                itgt="(time < 1.0m) ? 20 : 40", rsc=OPEN, gap=[(0, 1.0), (1, 1.0)])

def sc_wave(p):
    I0 = 40.0
    return dict(name="onda668", I0=I0, V0=v_out0(p, 1.0, I0), CM0=1, TEND=0.5e-3 + 4 / 668.0, SRU=1e9,
                itgt="(time < 0.5m) ? 40 : 40 + 30*cos(6.283185307*668*(time - 0.5m))", rsc=OPEN, gap=[(0, 1.0), (1, 1.0)])

T_FILM, T_BREAK, T_OPEN_ST = 0.5e-3, 0.6e-3, 1.6502e-3
def sc_start(p, lift=True):
    rsc = [(0, 1e6), (0.4999e-3, 1e6), (T_FILM, 30.0), (0.5998e-3, 30.0), (T_BREAK, 0.020), (1.5e-3, 0.020),
           (1.55e-3, 0.024), (1.6e-3, 0.032), (1.63e-3, 0.040), (1.65e-3, 0.050), (T_OPEN_ST, 1e6), (1, 1e6)]
    gap = [(0, 5.0), (0.4999e-3, 5.0), (T_FILM, 0.0), (T_OPEN_ST, 0.0), (3.65e-3, 1.0), (1, 1.0)]
    itgt = "(v(cm) < 0.5) ? 0 : ((time < 2.65m) ? 15 : 40)" if lift else "(v(cm) < 0.5) ? 0 : 40"
    return dict(name="arranque_retraccion" if lift else "arranque_clasico", I0=0.0, V0=0.0, CM0=0, VOCV=30.0,
                ITOUCH=0.5, TEND=4.2e-3, SRU=8e4, itgt=itgt, rsc=rsc, gap=gap)

T_BRIDGE, T_OPEN_SH = 0.8e-3, 1.9002e-3
def sc_short(p, ctl):
    I0 = 40.0
    rsc = [(0, 0.02), (0.2e-3, 0.02), (0.2001e-3, 1e6), (0.7999e-3, 1e6), (T_BRIDGE, 0.010), (1.6e-3, 0.010), (1.65e-3, 0.013), (1.7e-3, 0.018),
           (1.75e-3, 0.025), (1.8e-3, 0.033), (1.85e-3, 0.042), (1.9e-3, 0.050), (T_OPEN_SH, 1e6), (1, 1e6)]
    gap = [(0, 1.0), (0.8e-3, 1.0), (0.8001e-3, 0.2), (T_OPEN_SH, 0.2), (2.9e-3, 1.0), (1, 1.0)]
    return dict(name="corto_bajar10A" if ctl else "corto_CC40A", I0=I0, V0=v_out0(p, 1.0, I0), CM0=1, TEND=3.6e-3,
                SRU=8e4, SHORTCTL=1 if ctl else 0, itgt="(v(scl) > 0.5) ? 10 : 40" if ctl else "40", rsc=rsc, gap=gap)

T_EV = 0.8e-3
def sc_off(p, kind):
    I0 = 40.0
    xi0 = 0.0 if p["FF"] else (v_out0(p, 1.0, I0) + I0 * p["RCH"] + 0.25) / 48
    tev = T_EV if p["FF"] else 2.5e-3          # BASE20 (PI lento, sin anticipada) necesita mas tiempo para llegar a 40 A
    base = dict(I0=I0, V0=v_out0(p, 1.0, I0), CM0=1, XI0=xi0, TEV=tev, TEND=tev + 0.5e-3, itgt="40",
                rsc=[(0, 0.02), (0.2e-3, 0.02), (0.2001e-3, 1e6), (1, 1e6)])     # toque de 0.2 ms: el arco nace a 40 A
    if kind == "sd":
        return dict(base, name="apagado_PARO", TKILL=tev, gap=[(0, 1.0), (1, 1.0)])
    return dict(base, name="arco_se_apaga_40A", KILLV=40.0, gap=[(0, 1.0), (tev, 1.0), (tev + 5e-6, 10.0), (1, 10.0)])

# ---------------------------------------------------------------------------------------------------
# medicion sobre las formas de onda
# ---------------------------------------------------------------------------------------------------
def win(d, t0, t1):
    t = d["time"]; return (t >= t0) & (t <= t1)

def tavg(d, y, t0, t1):
    m = win(d, t0, t1); t = d["time"][m]
    return np.trapezoid(y[m], t) / (t[-1] - t[0])

def acrms(d, y, t0, t1):
    mu = tavg(d, y, t0, t1); return math.sqrt(max(tavg(d, (y - mu) ** 2, t0, t1), 0))

def at(d, y, tt):
    return float(np.interp(tt, d["time"], y))

def integ(d, y, t0, t1):
    m = win(d, t0, t1); return float(np.trapezoid(y[m], d["time"][m]))

def peravg(d, key_or_y, t0, t1, fsw):
    """promedio por periodo de conmutacion (lo que ve el arco a escala de la gota)"""
    tu = np.arange(t0, t1, 10e-9)
    y = d[key_or_y] if isinstance(key_or_y, str) else key_or_y
    yu = np.interp(tu, d["time"], y)
    n = int(round(1 / fsw / 10e-9))
    ya = np.convolve(yu, np.ones(n) / n, "same")
    return tu[n:-n], ya[n:-n], yu[n:-n], n

def ripple_pp(d, key, t0, t1, fsw):
    tu = np.arange(t0, t1, 10e-9); yu = np.interp(tu, d["time"], d[key])
    n = int(round(1 / fsw / 10e-9)); k = len(yu) // n
    return float(np.median(np.ptp(yu[:k * n].reshape(k, n), axis=1)))

def stress(d, t0=0.3e-3, t1=1.0):
    m = win(d, t0, t1)
    vds = (d["v(dr)"] - d["v(sw)"])[m]
    return dict(vds=vds.max(), vd1=(d["v(sw)"] - d["v(da)"])[m].max(), vs0=d["v(sw)"][m].min(),
                vsk=(d["v(sw)"] - d["v(da)"])[m].min(), vbs=(d["v(vb)"] - d["v(sw)"])[m].max(),
                vgs=(d["v(gq)"] - d["v(sw)"])[m].max())

def losses(p, d, t0, t1):
    il, ish = d["i(vsns)"], d["i(vsh)"]
    vload = d["v(pen)"] - d["v(ret)"]
    r = dict(Q1=tavg(d, (d["v(dr)"] - d["v(sw)"]) * d["i(vq1)"], t0, t1),
             D1=tavg(d, (d["v(da)"] - d["v(sw)"]) * d["i(vd1)"], t0, t1),
             L=p["RCH"] * tavg(d, il ** 2, t0, t1), shunt=p["RSH"] * tavg(d, ish ** 2, t0, t1),
             cable=p["RCAB"] * tavg(d, ish ** 2, t0, t1), arco=tavg(d, vload * ish, t0, t1),
             entrada=tavg(d, 48 * (-d["i(vsup)"]), t0, t1))
    if p["SNUB"]:
        pass
    r["eficiencia"] = r["arco"] / r["entrada"]
    return r

def m_reg(p, d):
    fsw = p["FSW"]; t0, t1 = 2.6e-3, 3.4e-3
    st = stress(d)
    lo = losses(p, d, t0, t1)
    tu, ya, yu, n = peravg(d, "i(vsh)", 0.9e-3, 2.2e-3, fsw)
    post = tu > 1.0e-3
    t10 = tu[post][np.argmax(ya[post] >= 22)] - 1.0e-3
    t90 = tu[post][np.argmax(ya[post] >= 38)] - 1.0e-3
    over = ya[post].max() - 40
    bad = np.where(np.abs(ya[post] - 40) > 1.0)[0]
    settle = (tu[post][bad[-1]] - 1.0e-3) if len(bad) else 0.0
    return dict(I=tavg(d, d["i(vsh)"], t0, t1), IL_pp=ripple_pp(d, "i(vsns)", t0, t1, fsw),
                Iarc_pp=ripple_pp(d, "i(vsh)", t0, t1, fsw), duty=tavg(d, d["v(u)"], t0, t1),
                Vout=tavg(d, d["v(out)"], t0, t1), Vout_pp=ripple_pp(d, "v(out)", t0, t1, fsw),
                bus_pp=ripple_pp(d, "v(busp2)", t0, t1, fsw),
                Ce_rms=acrms(d, d["i(vce)"], t0, t1), Cf_rms=acrms(d, d["i(vcf)"], t0, t1),
                t10=t10, t90=t90, over=over, settle=settle, **st, P=lo)

def fit(t, y, f):
    w = 2 * np.pi * f
    A = np.vstack([np.ones_like(t), np.cos(w * t), np.sin(w * t)]).T
    c, *_ = np.linalg.lstsq(A, y, rcond=None)
    return c[0], math.hypot(c[1], c[2]), math.degrees(math.atan2(c[2], c[1]))

def m_wave(p, d):
    f = 668.0; t = d["time"]; m = t > 0.5e-3 + 1.0 / f
    tt = t[m] - 0.5e-3
    dc, amp, ph = fit(tt, d["i(vsh)"][m], f)
    _, ramp, rph = fit(tt, d["v(irf)"][m], f)
    res = d["i(vsh)"][m] - (dc + amp * np.cos(2 * np.pi * f * tt - math.radians(ph)))
    return dict(dc=dc, amp=amp, lag=ph - rph, rizo95=float(np.percentile(np.abs(res), 95)), **stress(d))

def m_start(p, d):
    ish = d["i(vsh)"]; vl = d["v(pen)"] - d["v(ret)"]
    tcm = d["time"][np.argmax(d["v(cm)"] > 0.5)] if (d["v(cm)"] > 0.5).any() else float("nan")
    vbefore = at(d, d["v(out)"], T_BREAK - 0.3e-6)
    m = win(d, T_BREAK, T_BREAK + 30e-6)
    tb = T_OPEN_ST - 0.5e-6
    tu, ya, _, _ = peravg(d, "i(vsh)", 0.5e-3, 4.15e-3, p["FSW"])
    arc_at = lambda tq: float(np.interp(tq, tu, ya))
    alive = at(d, d["v(iarcv)"], T_OPEN_ST + 100e-6) > 1.0
    return dict(OCV=tavg(d, d["v(out)"], 0.3e-3, 0.5e-3), t_detect=(tcm - T_FILM) * 1e6, V_ruptura_pelicula=vbefore,
                E_cap_teoria=0.5 * p["COUT"] * vbefore ** 2, I_pico_pelicula=ish[m].max(),
                E_pelicula_30us=integ(d, vl * ish, T_BREAK - 1e-6, T_BREAK + 30e-6),
                I_max_toque=ish[win(d, T_BREAK, 1.5e-3)].max(), I_ruptura=at(d, ish, tb),
                E_cuello_50us=integ(d, ish ** 2 * np.where(d["v(rsc)"] < 10, d["v(rsc)"], 0), T_OPEN_ST - 50e-6, T_OPEN_ST),
                arco_prende=alive, V_pico_ruptura=vl[win(d, T_OPEN_ST, T_OPEN_ST + 50e-6)].max(),
                I_2_5ms=arc_at(2.5e-3), I_4ms=arc_at(4.1e-3),
                E_arco_1er_ms=integ(d, vl * d["v(iarcv)"], T_OPEN_ST, T_OPEN_ST + 1e-3), **stress(d))

def m_short(p, d):
    ish = d["i(vsh)"]; rs = np.where(d["v(rsc)"] < 10, d["v(rsc)"], 0)
    tu, ya, _, _ = peravg(d, "i(vsh)", 0.5e-3, 3.55e-3, p["FSW"])
    after = tu > T_OPEN_SH
    bad = np.where(np.abs(ya[after] - 40) > 2.0)[0]
    rec = (tu[after][bad[-1]] - T_OPEN_SH) if len(bad) else 0.0
    return dict(I_pico_puente=ish[win(d, T_BRIDGE, T_BRIDGE + 100e-6)].max(),
                I_200us=float(np.interp(T_BRIDGE + 200e-6, tu, ya)), I_ruptura=at(d, ish, T_OPEN_SH - 0.5e-6),
                E_puente=integ(d, ish ** 2 * rs, T_BRIDGE, T_OPEN_SH), E_cuello_50us=integ(d, ish ** 2 * rs, T_OPEN_SH - 50e-6, T_OPEN_SH),
                reenciende=at(d, d["v(iarcv)"], T_OPEN_SH + 100e-6) > 1.0,
                V_pico_reencendido=(d["v(pen)"] - d["v(ret)"])[win(d, T_OPEN_SH, T_OPEN_SH + 50e-6)].max(),
                recupera_us=rec * 1e6, **stress(d))

def m_off(p, d, T_EV=T_EV):
    ish = d["i(vsh)"]; t = d["time"]
    tk = t[np.argmax(d["v(kill)"] > 0.5)] if (d["v(kill)"] > 0.5).any() else float("nan")
    post = t > T_EV
    idx = np.where(post & (np.abs(d["i(vsns)"]) < 1.0))[0]
    t_cero = (t[idx[0]] - T_EV) if len(idx) else float("nan")
    r = dict(t_kill_us=(tk - T_EV) * 1e6, t_IL_a_cero_us=t_cero * 1e6,
             E_arco_despues=integ(d, (d["v(pen)"] - d["v(ret)"]) * ish, T_EV, T_EV + 0.5e-3) * 1e3,
             Vout_max=d["v(out)"][post].max(), Vpluma_max=(d["v(pen)"] - d["v(ret)"])[post].max(),
             I_antes=tavg(d, ish, T_EV - 0.1e-3, T_EV), **stress(d))
    r["I_D2_max"] = d["i(vd2)"].max() if "i(vd2)" in d else 0.0
    return r

def m_inv(p, d):
    t0, t1 = 0.6e-3, 1.0e-3
    vds = d["v(dr)"] - d["v(src)"]; m = d["time"] > 0.3e-3
    tt = np.arange(t0, t1 - 3e-6, 1e-6)
    A_ = np.interp(tt, d["time"], d["v(wp)"]); B_ = np.interp(tt + 2e-6, d["time"], d["v(pen)"]); Bt = np.interp(tt, d["time"], d["v(pen)"])
    err = (A_ - B_) - (A_ - Bt)
    return dict(I=tavg(d, d["i(vsh)"], t0, t1), vds=vds[m].max(), vd1=(d["v(dk)"] - d["v(da)"])[m].max(),
                src_min=d["v(src)"][m].min(), src_max=d["v(src)"][m].max(),
                PQ1=tavg(d, vds * d["i(vq1)"], t0, t1), PD1=tavg(d, (d["v(da)"] - d["v(dk)"]) * d["i(vd1)"], t0, t1),
                v_pieza=tavg(d, d["v(wp)"], t0, t1), v_antorcha=tavg(d, d["v(pen)"], t0, t1),
                err_rms=float(err.std()), err_max=float(np.abs(err).max()), ruido_pieza=acrms(d, d["v(wp)"], t0, t1))


def trace(d, t0, t1, n, title):
    t = d["time"]
    print(f"\n  traza cruda: {title}  ({t0*1e3:.3f}-{t1*1e3:.3f} ms)")
    print(f"   {'t ms':>7} {'I_choque':>8} {'I_carga':>8} {'V_salida':>8} {'V_pluma':>8} {'R_cont':>9} {'I_arco':>7} {'duty':>6} {'I_med':>6} {'I_pedida':>8} {'modo':>5}")
    for tt in np.linspace(t0, t1, n):
        k = np.searchsorted(t, tt); k = min(k, len(t) - 1)
        r = d["v(rsc)"][k]; rs = "abierto" if r > 10 else f"{r*1e3:7.1f}m" if r < 1 else f"{r:6.1f}"
        modo = "KILL" if d["v(kill)"][k] > 0.5 else ("CORT" if d["v(scl)"][k] > 0.5 else ("I" if d["v(cm)"][k] > 0.5 else "OCV"))
        print(f"   {t[k]*1e3:7.4f} {d['i(vsns)'][k]:8.2f} {d['i(vsh)'][k]:8.2f} {d['v(out)'][k]:8.2f} {d['v(pen)'][k]-d['v(ret)'][k]:8.2f} "
              f"{rs:>9} {d['v(iarcv)'][k]:7.2f} {d['v(u)'][k]:6.3f} {d['v(im)'][k]:6.2f} {d['v(irf)'][k]:8.2f} {modo:>5}")


# =====================================================================================================
# 1. lista de materiales
# =====================================================================================================
# (bloque, pieza, cantidad, canal / funcion)
BOM_ANTES = [
    ("potencia", "LRS-1200-48", 1, "energia"),
    ("potencia", "F1 fusible + portafusible", 2, "seguridad"),
    ("potencia", "Ce electroliticos 2200 uF 63 V", 2, "bus"),
    ("potencia", "Cf pelicula 4.7 uF", 1, "bus HF"),
    ("potencia", "Q1 IRFB4227", 1, "actuador de corriente"),
    ("potencia", "D1 MBR40100CT", 1, "rueda libre"),
    ("potencia", "choque 41 uH aire cal 10 (40 vueltas)", 1, "almacen"),
    ("potencia", "Hall ACS758", 1, "sensor I"),
    ("potencia", "Cout pelicula 10 uF", 1, "salida"),
    ("potencia", "Rbl 1 k sangrado", 1, "descarga"),
    ("potencia", "Q3 IRFB4227 atajo (crowbar)", 1, "matar chispa"),
    ("potencia", "snubber 3.3 ohm + 10 nF", 2, "amortiguar SW"),
    ("potencia", "TVS 1.5KE68A (->100 V)", 1, "pinza Vds"),
    ("potencia", "disipador + 3 micas (Q1, D1, Q3)", 4, "termico"),
    ("potencia", "P1/P2 LRS->caja cal 10, 15 cm", 2, "cable"),
    ("potencia", "P3/P4 salida->antorcha / pinza cal 8, 2 m", 2, "cable"),
    ("potencia", "P5-P8 tramos internos", 4, "cable"),
    ("potencia", "pinza de tierra", 1, "contacto pieza"),
    ("manejo", "IR2110", 1, "manejo Q1 (HO) + Q3 (LO)"),
    ("manejo", "bootstrap: Rbs 4.7, Dbs, Cbs 1 uF, zener 15 V", 4, "flotante HO"),
    ("manejo", "compuerta Q1: Rg_on 10, Rg_off 33 + diodo, Rgs 10 k, zener 15 V", 5, "compuerta"),
    ("manejo", "compuerta Q3: Rg 4.7, Rgs 10 k", 2, "compuerta"),
    ("manejo", "desacoplo VCC/VDD", 2, "desacoplo"),
    ("medicion", "Pico 2", 1, "cerebro"),
    ("medicion", "divisor V_salida /16 + C", 3, "sensor V"),
    ("medicion", "divisor V_bus /21 + C", 3, "sensor V_bus"),
    ("medicion", "NTC de D1 + R (en GP29 = VSYS/3 en la tarjeta!)", 2, "sensor T"),
    ("medicion", "salida Hall: divisor 5->3.3 V + desacoplo", 3, "adaptar"),
    ("medicion", "riel 5 V del Hall", 1, "riel"),
    ("auxiliar", "DC-DC 48->12 V", 1, "riel 12 V"),
    ("auxiliar", "ventilador 12 V", 1, "termico"),
    ("auxiliar", "driver del motor (A3)", 1, "motor"),
    ("auxiliar", "GX12 macho+hembra (gatillo, motor)", 2, "conector"),
    ("auxiliar", "PARO (S2 -> SD)", 1, "seguridad"),
    ("auxiliar", "zumbador", 1, "aviso"),
]
BOM_DESPUES = [
    ("potencia", "LRS-1200-48 (+RS/-RS a los capacitores)", 1, "energia; bus regulado en el punto de uso"),
    ("potencia", "F1 fusible + portafusible", 2, "seguridad (se queda)"),
    ("potencia", "Ce electroliticos 2200 uF 63 V", 2, "bus"),
    ("potencia", "Cf pelicula 4.7 uF x2 (llevan ~15 A rms a 100 kHz)", 2, "bus HF"),
    ("potencia", "Q1 IRFB4227", 1, "ACTUADOR 1: corriente (l=0 volumen + l=2 soltar)"),
    ("potencia", "D1 MBR40100CT", 1, "rueda libre"),
    ("potencia", "choque 15 uH (el mismo, 18 vueltas)", 1, "almacen"),
    ("potencia", "shunt 0.5 mOhm en el retorno", 1, "SENSOR 1: corriente"),
    ("potencia", "Cout pelicula 1 uF", 1, "salida HF"),
    ("potencia", "D2 pinza salida->bus (p.ej. 1N5408)", 1, "a donde va la bobina si el arco muere"),
    ("potencia", "disipador + 2 micas (Q1, D1)", 3, "termico"),
    ("potencia", "P1/P2 LRS->caja cal 10, 15 cm", 2, "cable"),
    ("potencia", "par de barras laminadas (ida a la mesa / vuelta del alimentador)", 2, "barra"),
    ("potencia", "tramos internos", 4, "barra"),
    ("manejo", "IR2110 (HO = Q1; LO libre)", 1, "manejo Q1"),
    ("manejo", "bootstrap: Rbs, Dbs, Cbs", 3, "flotante HO"),
    ("manejo", "compuerta Q1: UNA Rg 22, Rgs 10 k", 2, "compuerta"),
    ("manejo", "pull-up del lazo SD (falla segura)", 1, "seguridad"),
    ("manejo", "desacoplo VCC/VDD", 2, "desacoplo"),
    ("medicion", "Pico 2", 1, "cerebro"),
    ("medicion", "INA240A2 + desacoplo", 2, "SENSOR 1: corriente (GP26)"),
    ("medicion", "divisor V_salida /16 + C (es tambien el sangrado; mide V_bus en reposo)", 3, "SENSOR 2: voltaje (GP27)"),
    ("medicion", "termostato KSD301 NC 80 C en el lazo SD/PARO", 1, "proteccion termica en hardware"),
    ("auxiliar", "DC-DC 48->12 V", 1, "riel 12 V (IR2110, motor, ventilador)"),
    ("auxiliar", "ventilador 12 V", 1, "termico (INCIERTO quitar)"),
    ("auxiliar", "puente H del motor (DRV8871 o BTS7960)", 1, "ACTUADOR 2: alambre (adelante/atras)"),
    ("auxiliar", "divisor de la terminal B + pull-down en A", 3, "SENSOR 3: velocidad por fcem (GP28)"),
    ("auxiliar", "PARO de 2 contactos (corta AC de la LRS + SD)", 1, "seguridad (se queda)"),
]

def bom_print(rows, title):
    print(f"\n  {title}")
    print(f"   {'bloque':9s} {'pieza':72s} {'n':>3s}  canal")
    tot = 0; per = {}
    for b, pz, n, c in rows:
        print(f"   {b:9s} {pz:72s} {n:3d}  {c}")
        tot += n; per[b] = per.get(b, 0) + n
    print(f"   {'TOTAL':9s} {'':72s} {tot:3d}   " + "  ".join(f"{k}={v}" for k, v in per.items()))
    return tot, per


# =====================================================================================================
# 4. motor del alimentador (parametros SUPUESTOS: el motor de la SOMI no esta medido)
# =====================================================================================================
MOT = dict(V=12.0, R=1.2, L=1.2e-3, K=0.021, J=8e-6, Tf=4e-3, N=40, r=0.015, eta=0.6, F=6.0)

def motor_sim(profile, t_end, dt=10e-6, x0=0.0, w0=0.0, i0=0.0, ilim=None):
    """profile(t, w, x, i) -> V aplicado (puente H; |V| <= MOT V). Devuelve trazas.
    Carga: arrastre del alambre F (opuesto al movimiento) + friccion de Coulomb."""
    m = MOT; n = int(t_end / dt)
    i = i0; w = w0; x = x0; out = []
    for k in range(n):
        t = k * dt
        V = profile(t, w, x, i)
        if ilim is not None and V is not None and abs(i) >= ilim and np.sign(V - MOT["K"] * w) == np.sign(i):
            V = 0.0            # limite de corriente del puente: decaimiento lento (ambos bajos encendidos)
        if V is None:          # rueda libre (puente abierto): la corriente se descarga por los diodos
            Vt = -math.copysign(m["V"] + 1.4, i) if abs(i) > 1e-3 else m["K"] * w
            di = (Vt - m["K"] * w - m["R"] * i) / m["L"] if abs(i) > 1e-3 else -i / dt
            Vterm = Vt
        else:
            di = (V - m["K"] * w - m["R"] * i) / m["L"]; Vterm = V
        i_new = i + di * dt
        if V is None and abs(i) > 1e-3 and np.sign(i_new) != np.sign(i):
            i_new = 0.0
        i = i_new
        Tload = (m["F"] * m["r"] / (m["N"] * m["eta"]) + m["Tf"])
        Tm = m["K"] * i
        if abs(w) < 1e-3 and abs(Tm) <= Tload:
            w = 0.0
        else:
            w += (Tm - math.copysign(Tload, w if abs(w) > 1e-3 else Tm)) / m["J"] * dt
        x += w / m["N"] * m["r"] * dt
        out.append((t, V if V is not None else float("nan"), i, w, x, Vterm))
    return np.array(out)


# =====================================================================================================
# 5. base: campo en el arco (Laplace en la placa + Biot-Savart)
# =====================================================================================================
def bs(A, B, I, P):
    """Biot-Savart exacto de segmentos rectos A->B con corriente I (A), en el punto P. Unidades SI."""
    A = np.atleast_2d(A); B = np.atleast_2d(B); I = np.atleast_1d(I)
    r1 = P - A; r2 = P - B
    c = np.cross(r1, r2); c2 = (c ** 2).sum(1)
    n1 = np.linalg.norm(r1, axis=1); n2 = np.linalg.norm(r2, axis=1)
    L = B - A
    ok = c2 > 1e-18
    fac = np.zeros(len(A))
    fac[ok] = (L[ok] * (r1[ok] / n1[ok, None] - r2[ok] / n2[ok, None])).sum(1) / c2[ok]
    return (MU0 / (4 * math.pi) * (I * fac)[:, None] * c).sum(0)

def plate_links(sinks, Lx=100, Wy=50, h=1.0, zmid=-1.5e-3, src_dx=0):
    """placa centrada en el origen; el arco entra en (0,0); 'sinks' = lista de nodos a potencial 0.
    Devuelve segmentos (A, B, I) con I por unidad de corriente, del arco hacia los contactos."""
    from scipy.sparse import lil_matrix
    from scipy.sparse.linalg import spsolve
    nx, ny = int(Lx / h) + 1, int(Wy / h) + 1
    idx = lambda i, j: i * ny + j
    xs = (np.arange(nx) - (nx - 1) / 2) * h * 1e-3; ys = (np.arange(ny) - (ny - 1) / 2) * h * 1e-3
    sink = np.zeros((nx, ny), bool)
    for (i, j) in sinks(nx, ny): sink[i, j] = True
    N = nx * ny; A = lil_matrix((N, N)); b = np.zeros(N)
    for i in range(nx):
        for j in range(ny):
            k = idx(i, j)
            if sink[i, j]:
                A[k, k] = 1.0; continue
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ii, jj = i + di, j + dj
                if 0 <= ii < nx and 0 <= jj < ny:
                    A[k, k] += 1.0; A[k, idx(ii, jj)] -= 1.0
    b[idx((nx - 1) // 2 + src_dx, (ny - 1) // 2)] = 1.0
    phi = spsolve(A.tocsr(), b).reshape(nx, ny)
    Aa, Bb, II = [], [], []
    for i in range(nx):
        for j in range(ny):
            for di, dj in ((1, 0), (0, 1)):
                ii, jj = i + di, j + dj
                if ii < nx and jj < ny:
                    Aa.append((xs[i], ys[j], zmid)); Bb.append((xs[ii], ys[jj], zmid)); II.append(phi[i, j] - phi[ii, jj])
    return np.array(Aa), np.array(Bb), np.array(II)

def poly(pts):
    P = np.array(pts, float) * 1e-3
    return P[:-1], P[1:]


# =====================================================================================================
# MAIN
# =====================================================================================================
def main():
    np.set_printoptions(linewidth=140)
    # -------------------------------------------------------------------------------- 1
    hr("1. LISTA DE MATERIALES ACTUAL: La Pluma (contexto par.2, la_pluma.py) + banco (plan par.10-14)")
    n_antes, per_antes = bom_print(BOM_ANTES, "ANTES")
    print("   mecanica: torre (1a caja, 1b tapa, 1c falda), garra, mesa (azulejo + clips), ojo, calibre, clips = 6 piezas impresas + alimentador SOMI")
    print("   OJO: en la tarjeta Pico 2 GP29 = ADC3 esta cableado a VSYS/3 (y GP24/25/23 internos): solo GP26-28 son ADC libres.")
    print("        El plan (par.10) pone la NTC en GP29: no hay 4o canal analogico sin modificar la tarjeta.")

    # -------------------------------------------------------------------------------- 2
    hr("2. CUENTAS DE QUITAR / FUSIONAR (antes de simular)")
    print("\n  2a. EL CHOQUE: ¿basta la inductancia de los cables o barras?  rizo pp = Vbus*D*(1-D)/(f*L), D = 0.5")
    def wheeler(N, D=60.0, pitch=2.8):
        r = D / 2 / 25.4; l = N * pitch / 25.4
        return r * r * N * N / (9 * r + 10 * l) * 1e-6
    def rcoil(N, D=60.0):
        return N * math.pi * D * 1e-3 * 3.28e-3          # cal 10 = 3.28 mOhm/m
    r8 = 3.26e-3 / 2
    loops = [
        ("2 cables cal 8 de 2 m, separados 10 cm (hoy)", MU0 * 2 / math.pi * (math.log(0.10 / r8) + 0.25)),
        ("2 cables cal 8 de 2 m, juntos (2 cm)", MU0 * 2 / math.pi * (math.log(0.02 / r8) + 0.25)),
        ("antorcha SOMI 2 m sobre la barra (h=15 mm, r=6 mm)", MU0 * 2 / (2 * math.pi) * math.log(2 * 0.015 / 0.006) + MU0 * 2 / (8 * math.pi)),
        ("antorcha recortada a 0.4 m sobre la barra", MU0 * 0.4 / (2 * math.pi) * math.log(2 * 0.015 / 0.006) + MU0 * 0.4 / (8 * math.pi)),
        ("par de barras laminadas 25.4x3.2 mm, 0.5 mm aislante, 0.35 m", MU0 * 0.35 * (0.5e-3 + 3.2e-3) / 25.4e-3),
        ("choque de hoy, 40 vueltas (Wheeler)", wheeler(40)),
        ("choque propuesto, 18 vueltas (Wheeler)", wheeler(18)),
    ]
    print(f"   {'trayecto':62s} {'L uH':>7s} {'E@40A mJ':>9s} {'pp@20k':>8s} {'pp@100k':>8s} {'pp@300k':>8s}")
    for name, L in loops:
        pp = [48 * 0.25 / (f * L) for f in (20e3, 100e3, 300e3)]
        print(f"   {name:62s} {L*1e6:7.3f} {0.5*L*1600*1e3:9.3f} {pp[0]:8.0f} {pp[1]:8.1f} {pp[2]:8.1f}")
    print(f"   L minima para 10 A pp a 100 kHz = {48*0.25/(1e5*10)*1e6:.1f} uH;  para 10 A pp a 300 kHz = {48*0.25/(3e5*10)*1e6:.1f} uH")
    print("   bobina de aire D=60 mm, paso 2.8 mm (cal 10): vueltas -> L, R, perdida a 40 A, energia, pendiente (48-24)/L")
    for N in (40, 30, 24, 18, 14):
        L = wheeler(N); R = rcoil(N)
        print(f"     N={N:2d}  L={L*1e6:5.1f} uH  R={R*1e3:5.1f} mOhm  P={R*1600:5.1f} W  E={0.5*L*1600*1e3:5.1f} mJ  pendiente={24/L/1e6:4.2f} A/us  rizo@100k={48*0.25/(1e5*L):4.1f} A pp")
    B_coil = lambda N, r: MU0 * N * 40 * math.pi * 0.03 ** 2 / (2 * math.pi * r ** 3)
    print(f"   campo dipolar del choque en su eje a 40 A (18 vueltas): 15 cm {B_coil(18,0.15)*1e3:.3f} mT, 25 cm {B_coil(18,0.25)*1e3:.3f} mT, 40 cm {B_coil(18,0.40)*1e3:.4f} mT")

    print("\n  2b. OBSERVADOR DE CORRIENTE por volt-segundo (L conocida) en vez de sensor:")
    print("      dI/dt = (D*Vbus - (1-D)*Vf - V_salida - I*R)/L  ->  error en regimen = error_de_voltaje / R_lazo (no se cancela)")
    Rl = 0.011 + 0.0015 + 0.0005 + 0.02
    errs = [("Vf de D1 con 60 K de calentamiento (-1.5 mV/K)", 0.09), ("borde de PWM 20 ns a 100 kHz (0.2 % de 48 V)", 48 * 20e-9 * 1e5),
            ("divisor de V_salida 0.5 %", 0.005 * 24), ("Rds(on) de Q1 sube 60 % en caliente (22->35 mOhm, D=0.5, 40 A)", 0.5 * 0.013 * 40)]
    for nm, dv in errs:
        print(f"      {nm:62s} dV={dv*1e3:6.1f} mV  ->  error de I = {dv/Rl:5.1f} A   (R_lazo = {Rl*1e3:.1f} mOhm)")
    print(f"      tiempo de olvido del observador L/R = {15e-6/Rl*1e6:.0f} us: sirve para PREDECIR dentro de un periodo, no como medida absoluta")

    print("\n  2c. HALL ACS758 contra SHUNT + INA240 (hojas de datos)")
    print("      ACS758: respuesta 4 us (1 us propagacion + 3 us subida), 120 kHz, 5 V, ruido 10.03 mVpp/40 mV/A = 0.25 App (050B),")
    print("              3.84 mVpp/10 mV/A = 0.38 App (200B); salida 0.5*Vcc -> divisor a 3.3 V; aislado (no le importa el modo comun)")
    print("      INA240A2: 400 kHz, ganancia 50, offset max 25 uV (= 50 mA con 0.5 mOhm), error de ganancia 0.2 %, 2.7-5.5 V (corre con 3.3 V del Pico),")
    print("              modo comun -4..80 V; shunt 0.5 mOhm: 25 mV/A -> 40 A = 1.0 V en el ADC; perdida 0.8 W a 40 A, 4 W a 90 A")
    for f in (668.0, 1268.0, 10e3):
        ph_h = 360 * f * 1e-6 + math.degrees(math.atan(f / 120e3)); ph_s = math.degrees(math.atan(f / 400e3))
        print(f"      retraso de fase a {f:7.0f} Hz: Hall {ph_h:5.2f} grados, INA240 {ph_s:5.2f} grados (filtro del firmware 25 kHz: {math.degrees(math.atan(f/25e3)):5.2f})")

    # -------------------------------------------------------------------------------- 3
    hr("3. NGSPICE: BASE (La Pluma de hoy) contra MIN (circuito minimo)")
    print("   BASE20 = la_pluma.py: 20 kHz, 41 uH, Hall, TVS, snubber, 2 zeners, Rg_off 33, lazo caliente 30 nH, Cout 10 uF + 1 k, cable 0.5 uH/4 mOhm")
    print("   MIN    = 100 kHz, 15 uH (18 vueltas, 11 mOhm), shunt 0.5 mOhm + INA240 en el retorno, SIN TVS/snubber/zeners/Q3, UNA Rg de 22 ohm,")
    print("            lazo caliente 15 nH (Q1-D1-Cf en un disipador), electroliticos a 30 nH (sobre el disipador; BASE: 150 nH),")
    print("            Cout 1 uF + D2 salida->bus, barras 0.15 uH/1.5 mOhm, V_bus constante 48 V en la alimentacion anticipada (sin canal)")
    print("   arco: V = 14 + 10*gap[mm] + 0.02*I (medido por ian + 20 mOhm); muere si I < 1 A pasados 50 us; renace en cada contacto")
    for P in REG_SET:
        print(f"   {P['name']:13s} " + " ".join(f"{k}={P[k]}" for k in ("FSW", "LCH", "RCH", "COUT", "LLOOP", "RGON", "RGOFF", "SENSOR", "TVS", "SNUB", "ZBS", "KP", "KI")) + f" LBC={P.get('LBC', 150e-9)}")
    jobs = []
    for P in REG_SET:
        jobs.append((P, sc_reg(P), "buck"))
    for P in (MIN, MIN_HALL):
        jobs.append((P, sc_wave(P), "buck"))
    MIN_C10s = dict(MIN_C10, DOCV=0.12)
    jobs += [(MIN, sc_start(MIN, True), "buck"), (MIN, sc_start(MIN, False), "buck"), (MIN_C10s, sc_start(MIN_C10s, True), "buck")]
    jobs += [(MIN, sc_short(MIN, False), "buck"), (MIN, sc_short(MIN, True), "buck"), (MIN_L41, sc_short(MIN_L41, True), "buck")]
    jobs += [(MIN, sc_off(MIN, "sd"), "buck"), (MIN, sc_off(MIN, "arcout"), "buck"), (MIN_C10, sc_off(MIN_C10, "arcout"), "buck"),
             (BASE20, sc_off(BASE20, "arcout"), "buck")]
    INV = dict(MIN, name="INV_lado_bajo")
    jobs.append((INV, dict(name="reg40", I0=40.0, V0=24.9, TEND=1.0e-3), "inv"))
    nproc = int(os.environ.get("INV05_PROCS", "6"))
    KEEP = {"MIN__arranque_retraccion", "MIN__arranque_clasico", "MIN__corto_CC40A", "MIN__corto_bajar10A",
            "MIN__arco_se_apaga_40A", "MIN_C10sinD2__arco_se_apaga_40A", "INV_lado_bajo__reg40"}
    D, MET = {}, {}
    with ThreadPoolExecutor(nproc) as ex:
        for (P, sc, kind), (tag, d, err) in zip(jobs, ex.map(run_case, jobs)):
            if d is None:
                print("  FALLA", tag, err); continue
            n = sc["name"]
            if kind == "inv": MET[tag] = m_inv(P, d)
            elif n == "reg": MET[tag] = m_reg(P, d)
            elif n.startswith("onda"): MET[tag] = m_wave(P, d)
            elif n.startswith("arranque"): MET[tag] = m_start(P, d)
            elif n.startswith("corto"): MET[tag] = m_short(P, d)
            else: MET[tag] = m_off(P, d, sc.get("TEV", T_EV))
            if tag == "MIN__reg":
                MET[tag]["ruido_vout_rms"] = acrms(d, d["v(out)"], 2.6e-3, 3.4e-3)
                MET[tag]["v_pieza"] = tavg(d, d["v(pen)"], 2.6e-3, 3.4e-3)
            if tag in KEEP: D[tag] = (P, sc, d)
            print(f"   ok {tag:44s} {len(d['time']):7d} puntos  (llega a {d['time'][-1]*1e3:.3f} ms de {sc['TEND']*1e3:.3f})", flush=True)
            del d

    # ---- 3.1 regulacion
    print("\n  3.1 REGULACION: arco 1 mm, 20 A -> escalon a 40 A en 1.0 ms; ventana de regimen 2.6-3.4 ms; esfuerzos despues de 0.3 ms")
    hdr = ("caso", "I prom", "IL pp", "Iarco pp", "duty", "Vout pp", "bus pp", "Ce rms", "Cf rms", "t10-90 us", "sobrepaso", "asienta us",
           "Vds max", "VD1 max", "SW min(0)", "SW-D1 min", "VBS max", "Vgs max")
    print("   " + " ".join(f"{h:>10s}" for h in hdr))
    REG = {}
    for P in REG_SET:
        tag = f"{P['name']}__reg"
        if tag not in MET: continue
        r = MET[tag]; REG[P["name"]] = r
        vals = (P["name"], r["I"], r["IL_pp"], r["Iarc_pp"], r["duty"], r["Vout_pp"], r["bus_pp"], r["Ce_rms"], r["Cf_rms"],
                (r["t90"] - r["t10"]) * 1e6, r["over"], r["settle"] * 1e6, r["vds"], r["vd1"], r["vs0"], r["vsk"], r["vbs"], r["vgs"])
        print("   " + f"{vals[0]:>13s}" + " ".join(f"{v:10.2f}" for v in vals[1:]))
    print("   (VD1 = inversa en D1, MBR40100CT de 100 V; SW-D1 = VS medido contra el anodo de D1 = COM Kelvin del IR2110; SW min(0) = contra la estrella)")
    print("\n   perdidas en regimen (W): Q1, D1, choque, shunt, cable/barra -> arco, entrada, eficiencia")
    for nm, r in REG.items():
        P_ = r["P"]
        print(f"   {nm:13s} Q1 {P_['Q1']:5.1f}  D1 {P_['D1']:5.1f}  L {P_['L']:5.1f}  shunt {P_['shunt']:4.2f}  cable {P_['cable']:4.1f}  "
              f"arco {P_['arco']:6.1f}  entrada {P_['entrada']:6.1f}  eta {P_['eficiencia']*100:5.1f} %  perdidas {P_['entrada']-P_['arco']:5.1f}")

    # ---- 3.2 onda
    print("\n  3.2 ONDA 40 A + 30 A a 668 Hz sobre el arco (canal l=2), 100 kHz, MIN: shunt contra Hall")
    for P in (MIN, MIN_HALL):
        tag = f"{P['name']}__onda668"
        if tag in MET:
            r = MET[tag]
            print(f"   {P['name']:10s} DC {r['dc']:5.1f} A (40) | onda {r['amp']:5.1f} A (30) | retraso {r['lag']:6.2f} grados | rizo95 +-{r['rizo95']:4.1f} A | Vds max {r['vds']:5.1f} V | VD1 max {r['vd1']:5.1f} V")

    # ---- 3.3 arranque
    print("\n  3.3 ARRANQUE: OCV 30 V; toque a 0.5 ms (pelicula de fundente 30 ohm), se perfora a 0.6 ms (20 mOhm);")
    print("      la punta se separa 1.50-1.65 ms (cuello 20->50 mOhm) y abre; gap 0->1 mm en 2 ms (tiempo mecanico COMPRIMIDO 10x; el lazo")
    print("      electrico es >100x mas rapido, no cambia los picos). retraccion: 15 A en el toque y la separacion, rampa a 40 A en 2.65 ms.")
    print("      clasico: 40 A desde el toque (la separacion la hace la fusion). MIN_C10sinD2: Cout 10 uF sin D2.")
    keys = ("OCV", "t_detect", "V_ruptura_pelicula", "E_cap_teoria", "I_pico_pelicula", "E_pelicula_30us", "I_max_toque", "I_ruptura",
            "E_cuello_50us", "arco_prende", "V_pico_ruptura", "I_2_5ms", "I_4ms", "E_arco_1er_ms", "vds", "vd1")
    START = {t: MET[t] for t in ("MIN__arranque_retraccion", "MIN__arranque_clasico", "MIN_C10sinD2__arranque_retraccion") if t in MET}
    print("   " + f"{'medida':22s}" + "".join(f"{t:>36s}" for t in START))
    units = dict(OCV="V", t_detect="us", V_ruptura_pelicula="V", E_cap_teoria="J", I_pico_pelicula="A", E_pelicula_30us="J", I_max_toque="A",
                 I_ruptura="A", E_cuello_50us="J", V_pico_ruptura="V", I_2_5ms="A", I_4ms="A", E_arco_1er_ms="J", vds="V", vd1="V")
    for k in keys:
        row = []
        for tag, r in START.items():
            v = r[k]
            row.append(f"{str(v):>36s}" if isinstance(v, (bool, np.bool_)) else (f"{v*1e3:33.3f} mJ" if units.get(k) == "J" else f"{v:33.2f} {units.get(k,''):>2s}"))
        print("   " + f"{k:22s}" + "".join(row))
    for tag in ("MIN__arranque_retraccion", "MIN__arranque_clasico"):
        if tag in D:
            d = D[tag][2]
            trace(d, 0.49e-3, 0.66e-3, 12, tag + " (toque y perforacion)")
            trace(d, 1.60e-3, 1.75e-3, 10, tag + " (separacion)")
            trace(d, 2.5e-3, 4.1e-3, 7, tag + " (arco)")

    # ---- 3.4 corto
    print("\n  3.4 CORTO DURANTE EL ARCO: arco 1 mm a 40 A; una gota toca a 0.8 ms (10 mOhm); cuello 1.6-1.9 ms (10->50 mOhm); abre 1.9 ms")
    print("      CC40A: el lazo sostiene 40 A.  bajar10A: si V < 8 V pide 10 A hasta que V > 13 V (arco de vuelta), luego rampa 0.375 ms")
    SH = {t: MET[t] for t in ("MIN__corto_CC40A", "MIN__corto_bajar10A", "MIN_L41__corto_bajar10A") if t in MET}
    print("   " + f"{'':20s}" + "".join(f"{t:>30s}" for t in SH))
    for k in ("I_pico_puente", "I_200us", "I_ruptura", "E_puente", "E_cuello_50us", "reenciende", "V_pico_reencendido", "recupera_us", "vds", "vd1"):
        row = []
        for tag, r in SH.items():
            v = r[k]
            row.append(f"{str(v):>30s}" if isinstance(v, (bool, np.bool_)) else (f"{v*1e3:27.2f} mJ" if k.startswith("E_") else f"{v:30.2f}"))
        print("   " + f"{k:20s}" + "".join(row))
    for tag in ("MIN__corto_CC40A", "MIN__corto_bajar10A"):
        if tag in D:
            trace(D[tag][2], 0.78e-3, 1.10e-3, 9, tag + " (la gota toca)")
            trace(D[tag][2], 1.80e-3, 2.40e-3, 10, tag + " (ruptura y reencendido)")

    # ---- 3.5 apagado
    print(f"\n  3.5 APAGADO a {T_EV*1e3:.1f} ms con arco de 1 mm a 40 A. PARO = SD (duty 0). arco_se_apaga = el gap salta a 10 mm (V_arco 114 V),")
    print("      el firmware mata cuando V_salida > 40 V")
    for tag in ("MIN__apagado_PARO", "MIN__arco_se_apaga_40A", "MIN_C10sinD2__arco_se_apaga_40A", "BASE20__arco_se_apaga_40A"):
        if tag in MET:
            r = MET[tag]
            print(f"   {tag:36s} I antes {r['I_antes']:5.1f} | kill +{r['t_kill_us']:6.1f} us | I_bobina<1A en {r['t_IL_a_cero_us']:6.1f} us | E al arco despues {r['E_arco_despues']:6.2f} mJ | "
                  f"V_salida max {r['Vout_max']:6.1f} V | V_pluma max {r['Vpluma_max']:6.1f} | I_D2 max {r['I_D2_max']:5.1f} A | Vds max {r['vds']:5.1f} | VD1 max {r['vd1']:5.1f}")
    for tag in ("MIN__arco_se_apaga_40A", "MIN_C10sinD2__arco_se_apaga_40A"):
        if tag in D:
            trace(D[tag][2], T_EV - 5e-6, T_EV + 0.12e-3, 10, tag)

    # ---- 3.6 lado bajo
    print("\n  3.6 REDUCTOR LADO BAJO (sin IR2110 ni bootstrap): pieza en el +48 del bus, Q1 con fuente a tierra, D1 de SW al bus")
    tag = "INV_lado_bajo__reg40"
    if tag in MET:
        r = MET[tag]
        print(f"   I {r['I']:5.1f} A | Vds max {r['vds']:6.1f} V | D1 inversa max {r['vd1']:6.1f} V | rebote de la fuente de Q1 {r['src_min']:6.2f}/{r['src_max']:6.2f} V | "
              f"P_Q1 {r['PQ1']:5.1f} W | P_D1 {r['PD1']:5.1f} W")
        print(f"   potenciales contra la tierra del Pico/USB: pieza (mesa) {r['v_pieza']:5.1f} V, antorcha/alimentador {r['v_antorcha']:5.1f} V")
        print(f"   V_arco = V(pieza) - V(antorcha) muestreados con 2 us de diferencia: error crudo rms {r['err_rms']*1e3:6.1f} mV, pico {r['err_max']*1e3:6.1f} mV")
        print(f"   ruido crudo por muestra de V(pieza) sola (rizo del bus) rms {r['ruido_pieza']*1e3:6.1f} mV")
    if "MIN__reg" in MET:
        r = MET["MIN__reg"]
        print(f"   MIN (lado alto, carga a tierra): V_salida en UN canal, ruido crudo por muestra rms {r['ruido_vout_rms']*1e3:6.1f} mV; pieza {r['v_pieza']:5.1f} V, antorcha 0 V")

    # -------------------------------------------------------------------------------- 4
    hr("4. MOTOR DEL ALIMENTADOR (parametros SUPUESTOS, motor SOMI sin medir): " + ", ".join(f"{k}={v}" for k, v in MOT.items()))
    m = MOT
    w_noload = m["V"] / m["K"]; vmax = w_noload / m["N"] * m["r"]
    tau_m = m["J"] * m["R"] / m["K"] ** 2; Tl = m["F"] * m["r"] / (m["N"] * m["eta"]) + m["Tf"]
    print(f"   sin carga {w_noload*60/2/math.pi:6.0f} rpm -> alambre {vmax*60:5.1f} m/min; tau mecanica {tau_m*1e3:5.1f} ms; tau electrica {m['L']/m['R']*1e3:4.2f} ms;"
          f" par de carga {Tl*1e3:4.1f} mN m = {Tl/m['K']:4.2f} A")
    def V_for(vf):
        w = vf / m["r"] * m["N"]; return m["K"] * w + m["R"] * Tl / m["K"]
    for vf_mmin in (1, 3, 5):
        print(f"   {vf_mmin} m/min necesita {V_for(vf_mmin/60):5.2f} V (duty {V_for(vf_mmin/60)/m['V']:.2f} de 12 V)")
    # (a) escalon 0 -> 3 m/min en lazo abierto
    V3 = V_for(0.05)
    tr = motor_sim(lambda t, w, x, i: V3, 0.15)
    v_wire = tr[:, 3] / m["N"] * m["r"]
    t90 = tr[np.argmax(v_wire >= 0.9 * 0.05), 0]
    print(f"   (a) escalon a 3 m/min: llega al 90 % en {t90*1e3:5.1f} ms  -> ancho de banda util del avance ~{1/(2*math.pi*tau_m):4.1f} Hz (lazo abierto)")
    # (b) toque + retraccion: lazo de posicion PD sobre la posicion contada por fcem (V = Kp*(x_meta - x) - Kd*v)
    w_runin = (1 / 60) / m["r"] * m["N"]; i_runin = Tl / m["K"]
    KPX, KDX = 40000.0, 240.0
    def retraer(xt, t_end=0.15, ilim=None):
        def prof(t, w, x, i):
            return float(np.clip(KPX * (xt - x) - KDX * w / m["N"] * m["r"], -m["V"], m["V"]))
        return motor_sim(prof, t_end, w0=w_runin, i0=i_runin, ilim=ilim)
    for nm_l, il in (("sin limite (BTS7960)", None), ("limite 3.6 A (DRV8871)", 3.6)):
        tr = retraer(-1.5e-3, ilim=il); x = tr[:, 4]; t = tr[:, 0]
        k = np.argmax(np.abs(x + 1.5e-3) < 0.05e-3)
        print(f"   (b) toque a 1 m/min, lazo PD (Kp {KPX:.0f} V/m, Kd {KDX:.0f} V/(m/s)) a -1.5 mm, {nm_l}: el rodillo avanza {x.max()*1e3:5.3f} mm mas,"
              f" llega a -1.5+-0.05 mm en {t[k]*1e3:5.1f} ms, minimo {x.min()*1e3:6.3f} mm, final {x[-1]*1e3:6.3f} mm, I pico {np.abs(tr[:,2]).max():4.1f} A")
    print("       (con reversa a -12 V y freno pasivo el rodillo se pasa a ~-3.9 mm: hace falta el lazo de posicion, y la posicion sale de integrar la fcem)")
    print("       holgura del forro (alambre 0.8 en forro de 1.5 mm, SUPUESTO): juego = (1.5-0.8) mm x angulo total de curvas")
    for nm, ang in (("antorcha recortada 0.4 m casi recta (0.5 rad)", 0.5), ("antorcha 2 m en una U amplia (pi+0.5)", math.pi + 0.5),
                    ("antorcha 2 m con una vuelta completa (2pi+0.5)", 2 * math.pi + 0.5)):
        bl = 0.7e-3 * ang
        xt = -(bl + 1.0e-3)
        trb = retraer(xt, 0.25); xb = trb[:, 4]
        kb = np.argmax(np.abs(xb - xt) < 0.05e-3)
        print(f"       {nm:48s} juego {bl*1e3:4.2f} mm -> el rodillo recoge {-xt*1e3:4.2f} mm para levantar la PUNTA 1.0 mm: {trb[kb,0]*1e3:5.1f} ms")
    # (c) ventana de fuerza contraelectromotriz
    w3 = 0.05 / m["r"] * m["N"]; i3 = Tl / m["K"]
    tr = motor_sim(lambda t, w, x, i: None if t < 0.5e-3 else V3, 2e-3, w0=w3, i0=i3)
    k03 = np.argmax(tr[:, 0] >= 0.3e-3)
    t_i0 = tr[np.argmax(np.abs(tr[:, 2]) < 1e-3), 0]
    print(f"   (c) fcem: a 3 m/min se abre el puente 0.5 ms: la corriente ({i3:.2f} A) se descarga por los diodos en {t_i0*1e6:5.0f} us;"
          f" a 0.3 ms la terminal marca {tr[k03,5]:5.3f} V = K*w {m['K']*tr[k03,3]:5.3f} V; la velocidad cae {100*(1-tr[k03,3]/w3):4.2f} %")
    lsb = 3.3 / 2 ** 9 * 5
    print(f"       ADC (ENOB ~9, divisor /5): {lsb*1e3:4.1f} mV por paso -> {lsb/m['K']/m['N']*m['r']*1e3:4.2f} mm/s de alambre por muestra"
          f" ({lsb/m['K']/w3*100:4.2f} % a 3 m/min); deriva del iman de ferrita ~-0.2 %/K -> -4 % con 20 K: calibrar con 1 m de alambre medido")
    # (d) sincronia con las gotas
    print("   (d) sincronia con las gotas: gotas/s = v_f * pi r_w^2 / (4/3 pi a^3), r_w = 0.4 mm")
    for vf in (2, 3, 5):
        for a in (0.4526e-3, 1.63e-3 / 2, 1.63e-3):
            fd = vf / 60 * math.pi * 0.4e-3 ** 2 / (4 / 3 * math.pi * a ** 3)
            print(f"       v_f {vf} m/min, gota radio {a*1e3:5.3f} mm -> {fd:7.1f} gotas/s  (avance por gota {vf/60/fd*1e3:5.2f} mm)")
    print(f"       ancho de banda del motor ~{1/(2*math.pi*tau_m):4.1f} Hz vs gotas 10-90 /s: el motor NO puede seguir gota a gota;"
          " sincroniza el PROMEDIO (volumen) y el arco pone el reloj de la gota")

    # -------------------------------------------------------------------------------- 5
    hr("5. BASE: campo B en el arco por trazado (placa 100x50x3 resuelta por Laplace + Biot-Savart), I = 40 A, DCEN")
    print("   arco en el centro de la placa; antorcha vertical hasta 150 mm y luego horizontal hacia el alimentador (x = -300 mm);")
    print("   retorno del alimentador a la caja bajo la base, 150 mm atras (y = -150, z = -45); caja en x = +300 mm. SUPUESTOS de geometria.")
    I = 40.0
    def ends(nx, ny, which, jaw=None):
        out = []
        cols = {"-": [0], "+": [nx - 1], "+-": [0, nx - 1]}[which]
        for i in cols:
            for j in range(ny):
                if jaw is None or abs(j - (ny - 1) // 2) <= jaw:
                    out.append((i, j))
        return out
    torch_pts = [(0, 0, 0), (0, 0, 150), (-300, 0, 150), (-300, 0, 20), (-300, 0, -45), (-300, -150, -45), (300, -150, -45), (300, 0, -45)]
    layouts = {
        "A pinza en un extremo + cable a nivel de mesa": (lambda nx, ny: ends(nx, ny, "+", jaw=5), [[(300, 0, -45), (300, 0, 0), (50, 0, 0)]], [1.0]),
        "B barra integrada en un extremo, barra bajo la mesa (-30 mm)": (lambda nx, ny: ends(nx, ny, "+"), [[(300, 0, -45), (300, 0, -30), (50, 0, -30), (50, 0, 0)]], [1.0]),
        "C dos mordazas simetricas, barra partida alimentada al centro (-60 mm)": (lambda nx, ny: ends(nx, ny, "+-"),
            [[(300, 0, -45), (300, 0, -60), (0, 0, -60), (0, 0, -30)], [(0, 0, -30), (50, 0, -30), (50, 0, 0)], [(0, 0, -30), (-50, 0, -30), (-50, 0, 0)]], [1.0, 0.5, 0.5]),
        "E como C, alimentacion a -150 mm (simetria de punto con la antorcha)": (lambda nx, ny: ends(nx, ny, "+-"),
            [[(300, 0, -45), (300, 0, -150), (0, 0, -150), (0, 0, -30)], [(0, 0, -30), (50, 0, -30), (50, 0, 0)], [(0, 0, -30), (-50, 0, -30), (-50, 0, 0)]], [1.0, 0.5, 0.5]),
        "F compacto: mango horizontal a +60 mm, alimentacion a -60 mm (simetria)": (lambda nx, ny: ends(nx, ny, "+-"),
            [[(300, 0, -45), (300, 0, -60), (0, 0, -60), (0, 0, -30)], [(0, 0, -30), (50, 0, -30), (50, 0, 0)], [(0, 0, -30), (-50, 0, -30), (-50, 0, 0)]], [1.0, 0.5, 0.5], 60),
    }
    print(f"   {'trazado':72s} {'pie':>6s} {'|B| 0.5mm':>9s} {'|B| 1mm':>8s} {'|B| 2mm':>8s}   (mT)  partes a 1 mm: placa / ida / antorcha+retorno")
    for nm, spec in layouts.items():
        sinkf, feeds, fr = spec[:3]; ht = spec[3] if len(spec) > 3 else 150
        for dx in (0, 25):
            Aa, Bb, II = plate_links(sinkf, src_dx=dx)
            foot = np.array([dx * 1e-3, 0, 0])
            II = -II * I                     # DCEN: la corriente entra por los contactos y sube por el arco
            res = []
            for h in (0.5e-3, 1e-3, 2e-3):
                Pt = foot + np.array([0, 0, h])
                Bp = bs(Aa, Bb, II, Pt)
                Bf = np.zeros(3)
                for pts, frac in zip(feeds, fr):
                    a, b = poly(pts); Bf += bs(a, b, np.full(len(a), I * frac), Pt)
                tp = [(dx, 0, 0), (dx, 0, ht), (-300, 0, ht)] + torch_pts[3:]
                a, b = poly(tp); Bt = bs(a, b, np.full(len(a), I), Pt)
                res.append((np.linalg.norm(Bp + Bf + Bt), np.linalg.norm(Bp), np.linalg.norm(Bf), np.linalg.norm(Bt)))
            print(f"   {nm:72s} {dx:4d}mm {res[0][0]*1e3:9.3f} {res[1][0]*1e3:8.3f} {res[2][0]*1e3:8.3f}        {res[1][1]*1e3:6.3f} / {res[1][2]*1e3:6.3f} / {res[1][3]*1e3:6.3f}")
    print("   referencias: patada de apuntar del canon 3 mT; plan par.11: pinza como bobina gratis 0.8 mT a 1 cm del arco")

    # -------------------------------------------------------------------------------- 6
    hr("6. ANTES -> DESPUES")
    n_desp, per_desp = bom_print(BOM_DESPUES, "DESPUES (circuito minimo validado arriba)")
    print(f"\n   piezas electricas: {n_antes} -> {n_desp}  ({n_desp - n_antes:+d}, {100*(n_desp-n_antes)/n_antes:+.0f} %)")
    for k in per_antes:
        print(f"     {k:9s} {per_antes[k]:3d} -> {per_desp.get(k, 0):3d}")
    print("   canales que quedan (ADC de la tarjeta = 3):  GP26 corriente (INA240) | GP27 V_salida (+V_bus en reposo) | GP28 fcem del motor")
    print("   actuadores: Q1 (PWM 100 kHz: corriente, 0-10 kHz) | puente H del motor (0-7 Hz: volumen y retraccion) ; sin Q3")
    print("   seguridad en hardware: PARO (AC de la LRS + SD) | termostato en SD | fusible | LRS: sobrecarga >105 % 5 s -> se apaga")
    shutil.rmtree(WORK, ignore_errors=True)


if __name__ == "__main__":
    main()
