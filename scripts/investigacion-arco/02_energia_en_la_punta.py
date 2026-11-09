#!/usr/bin/env python3
"""
02 · ENERGIA EN LA PUNTA — que mecanismos reales concentran energia en la punta del alambre / el arco
con NUESTRO hardware (buck 48 V, 41 uH, PWM 20-100 kHz, LRS-1200-48, E71T-GS 0.8 mm tubular).

Texto plano, telemetria cruda. Reproduce TODOS los numeros de docs/investigacion-arco/02-energia-en-la-punta.md.

A. Lo que la HF hace en el arco: <I^2>, literatura y lo que nuestro buck puede dar
B. ngspice: el buck con arco a 20 / 50 / 100 kHz (rizo, perdidas) -- mismos modelos que scripts/la-pluma
C. Efecto piel en el alambre: mu incremental, delta, R_ac/R_dc (Bessel exacto, solido y tubo), frio vs caliente
D. El alambre libre como precalentador: modelo de transito (tubo acero+fundente), calibrado con Lincoln NR-211-MP
E. Balance de energia a 40 A: a donde se va la potencia y que perilla sube la fraccion a la gota
F. Campo axial: bobina alrededor de la boquilla (B, NI, potencia) vs el campo propio del arco
G. Tanque LC / descarga de capacitor vs el buck; presupuesto de la LRS-1200-48
H. "Resonancia de campos": longitudes de onda y donde SI hay resonancia
I. Prediccion del experimento decisivo (el arco como sensor de quemado)

Supuestos marcados SUPUESTO. Propiedades del acero = mismas tablas que operador-revision-impresora-2026-10-31.py.
ngspice: variable NGSPICE (por defecto el wrapper del scratchpad). Si no esta, B se salta y lo dice.
"""
import math, os, shutil, subprocess, tempfile, textwrap
import numpy as np
from scipy.special import jv, yv
from scipy.optimize import brentq

MU0 = 4e-7 * math.pi
SIG = 5.670e-8
NGSPICE = os.environ.get("NGSPICE", "/tmp/claude-1000/-home-ian-neuron-asm-RIAN/cfc903cc-a179-4f90-826c-2fc0f81542b2/scratchpad/ngspice.sh")

def hdr(t):
    print("\n" + "=" * 100); print(t); print("=" * 100)

# ---------------- acero bajo carbono (tablas del canon / revision 2026-10-31, +-15 %) ----------------
T_tab   = np.array([20, 100, 200, 300, 400, 500, 600, 700, 750, 770, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500])
rho_tab = np.array([0.142, 0.190, 0.262, 0.346, 0.444, 0.557, 0.688, 0.846, 0.94, 0.98, 1.03, 1.10, 1.13, 1.15, 1.18, 1.20, 1.22, 1.25]) * 1e-6
c_tab   = np.array([450, 480, 520, 560, 600, 660, 750, 900, 1250, 1500, 900, 650, 640, 650, 660, 670, 690, 700.0])
RHO_M, T_SOL, T_LIQ, L_FUS, L_AG = 7850.0, 1480.0, 1520.0, 270e3, 16e3
T_CURIE = 770.0
Tg = np.linspace(20, T_SOL, 3000)
cg = np.interp(Tg, T_tab, c_tab) + L_AG * np.exp(-0.5 * ((Tg - 900) / 15) ** 2) / (15 * math.sqrt(2 * math.pi))
hg = np.concatenate([[0], np.cumsum(0.5 * (cg[1:] + cg[:-1]) * np.diff(Tg))])
H_SOL = hg[-1]; H_LIQ = H_SOL + L_FUS + 700 * (T_LIQ - T_SOL)
C_LIQ = 820.0                       # J/kg/K acero liquido (aprox)
T_DROP = 2400.0                     # C, gota; Watkins 1990: 2400-3100 K (2130-2830 C) -> SUPUESTO punto medio-bajo
H_DROP = H_LIQ + C_LIQ * (T_DROP - T_LIQ)
def rho_e(T): return np.interp(T, T_tab, rho_tab)
def h_s(T):   return np.interp(T, Tg, hg)
def c_s(T):   return np.interp(T, Tg, cg)

# ---------------- alambre E71T-GS 0.8 mm tubular (SUPUESTO geometria) ----------------
B_OUT = 0.40e-3                     # radio exterior
A_IN_08 = 0.25e-3                   # radio del nucleo de fundente -> pared 0.15 mm (SUPUESTO; no hay dato del fabricante)
RHO_F, C_F = 3000.0, 1000.0         # fundente: densidad aparente de polvo compactado, cp (SUPUESTO)
H_F = C_F * (1500 - 20) + 400e3     # J/kg para llevar el fundente a escoria liquida (SUPUESTO)

def geom(b, a):
    As = math.pi * (b * b - a * a); Af = math.pi * a * a
    return As, Af

# =====================================================================================================
hdr("A. LA HF EN EL ARCO: <I^2>, LO QUE REPORTA LA LITERATURA Y LO QUE NUESTRO BUCK PUEDE DAR")
# =====================================================================================================
VB, L1 = 48.0, 41e-6
R_LOOP = 0.022 + 0.004 + 0.025 + 0.020   # choque + cable + stickout + pendiente del arco (ohm)
print("  A1. Rizo del buck (triangulo) con arco a I_media = 40 A:  dI_pp = (Vbus - Vo) * D / (L f),  D = Vo/Vbus")
print("      Vo = V_arco + 40 A * %.0f mOhm (choque+cable+stickout+arco)" % (R_LOOP * 1e3))
print("   V_arco  Vo     D     |  dI_pp @20k  @40k  @50k  @100k [A] |  I_ac_rms@20k  <I^2>/<I>^2-1 @20k   @100k")
for Va in (14.0, 16.0, 19.0, 24.0):
    Vo = Va + 40 * R_LOOP; D = Vo / VB
    dI = [(VB - Vo) * D / (L1 * f) for f in (20e3, 40e3, 50e3, 100e3)]
    irms20 = dI[0] / (2 * math.sqrt(3)); irms100 = dI[3] / (2 * math.sqrt(3))
    print(f"   {Va:5.1f} {Vo:5.2f} {D:6.3f}  |  {dI[0]:9.2f} {dI[1]:5.2f} {dI[2]:5.2f} {dI[3]:6.2f}      |  {irms20:8.2f}       {100*(irms20/40)**2:8.2f} %        {100*(irms100/40)**2:6.3f} %")
dImax20 = VB / (4 * L1 * 20e3)
print(f"  maximo rizo posible (D=0.5, Vo=24 V): {dImax20:.1f} A_pp @20 kHz, {VB/(4*L1*50e3):.1f} @50 kHz, {VB/(4*L1*100e3):.1f} @100 kHz")

print("\n  A2. Pendientes (el buck es un integrador: di/dt = V_L / L)")
for Va in (16.0, 19.0, 24.0):
    up = (VB - Va) / L1 * 1e-6; dn = (Va + 0.55) / L1 * 1e-6
    print(f"   V_arco {Va:4.1f} V: subida {up:5.2f} A/us   bajada (por D1) {dn:5.2f} A/us   escalon 40->80 A sube en {40/up:5.1f} us")
L_need = (VB - 19.0) / 50e6
print(f"  Literatura UHFP (Li 2020, Qi/Yang): flancos de 50 A/us -> con nuestro bus necesitarias L = (48-19)/50e6 = {L_need*1e6:.2f} uH")
print(f"  Nuestro 41 uH: {(VB-19)/L1*1e-6:.2f} A/us -> {50/((VB-19)/L1*1e-6):.0f}x mas lento que esos flancos")

print("\n  A3. La forma de onda de la literatura contra el promedio cuadratico (la fuerza magnetica va con I^2)")
Ib, Ip = 40.0, 80.0; Im = 0.5 * (Ib + Ip); I2 = 0.5 * (Ib**2 + Ip**2)
print(f"   Li et al. 2020 (Ti-6Al-4V, UHFP-GTAW): Ib={Ib:.0f} A, Ip={Ip:.0f} A, 50 %, Im={Im:.0f} A, flancos 50 A/us")
print(f"     <I^2>/Im^2 = {I2/Im**2:.3f}  -> si la fuerza siguiera solo a <I^2>: +{100*(I2/Im**2-1):.1f} %")
print("     medido: fuerza de arco +30 % (20 kHz) ... +80.6 % (40 kHz);  presion calculada 193.4 -> 253.1 -> 277.2 Pa (+30.9 %, +43.3 %)")
print("     nucleo del arco / area total: 38.9 -> 39.8 -> 40.6 %  (60 A) ; D_I 4.24 -> 4.69 -> 4.76 mm (el nucleo CRECE)")
print("     area fundida del cordon (80 A medios): 6.01 -> 7.89 -> 9.68 mm^2 ; penetracion 1.87 -> 2.13 -> 2.40 mm")
print(f"   => el efecto medido ({30}-{81} %) es 3-7x mayor que el de <I^2> ({100*(I2/Im**2-1):.0f} %): no es solo pellizco promedio;")
print("      la literatura lo atribuye al chorro de plasma con flancos rapidos. Mecanismo no cerrado -> lo tratamos como INCIERTO.")
irms20 = (VB - 19.8) * (19.8 / VB) / (L1 * 20e3) / (2 * math.sqrt(3))
print(f"   Nuestro buck a 20 kHz, arco 19 V: triangulo de {(VB-19.8)*(19.8/VB)/(L1*20e3):.1f} A_pp -> <I^2>/<I>^2 - 1 = {100*(irms20/40)**2:.2f} %")

print("\n  A4. Escala del pellizco y de la presion de Maecker a 40 A (p_eje ~ mu0 I^2 / (4 pi^2 R^2), columna uniforme)")
for I in (40.0, 60.0, 80.0, 194.0):
    F = MU0 * I * I / (4 * math.pi)
    ps = [MU0 * I * I / (4 * math.pi**2 * R * R) for R in (0.5e-3, 1.0e-3, 1.5e-3)]
    print(f"   I={I:5.0f} A: mu0 I^2/4pi = {F*1e3:6.3f} mN  ({100*F/(2*math.pi*0.4e-3*1.5):5.1f} % de 2 pi r_w sigma = 3.77 mN)  p_Maecker R=0.5/1/1.5 mm: {ps[0]:6.0f} {ps[1]:6.0f} {ps[2]:6.0f} Pa")

# =====================================================================================================
hdr("B. NGSPICE: EL BUCK CON ARCO (18 V + 20 mOhm, stickout 25 mOhm) A 20 / 50 / 100 kHz, LAZO ABIERTO, I_media ~ 40 A")
# =====================================================================================================
MODELS = """
.model IRFB4227 VDMOS(Vto=4.0 Kp=40 Rd=22m Rs=3m Rg=1.2 Cgdmax=3n Cgdmin=70p A=1 Cgs=4.5n Cjo=1.6n M=0.5 Vj=0.8 Is=5p N=1.1 Rb=5m Tt=150n)
.model MBR40 D(Is=4e-8 N=1.1 Rs=4m Cjo=2n M=0.5 Vj=0.6 BV=100 Ibv=1m)
.model DBS D(Is=1e-9 N=1.8 Rs=0.1 Cjo=10p Tt=30n BV=200)
.model DZ15 D(Is=1e-12 N=1 Rs=5 BV=15 Ibv=10m Cjo=50p)
.model SWU SW(Ron=17 Roff=1e9 Vt=0.5 Vh=0)
.model SWD SW(Ron=38 Roff=1e9 Vt=0.5 Vh=0)
"""
def buck_net(F, D, VARC=18.0, TEND=3e-3, LCH=41e-6):
    T = 1.0 / F
    return textwrap.dedent(f"""\
    * buck HF -- arco como fuente de voltaje + pendiente
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
    Vpwm pwm 0 PULSE(0 1 0 5n 5n {D*T-5e-9:.6e} {T:.6e})
    Bpwmn pwmn 0 V = 1 - v(pwm)
    Rdp1 pwmn 0 1meg
    Sup vb gq pwm 0 SWU
    Sdn gq sw pwmn 0 SWD
    Rgs gq sw 10k
    Dz sw gq DZ15
    Rsn sw sn1 3.3
    Csn sn1 0 10n
    Lch sw n1 {LCH} IC=40
    Rch n1 n2 22m
    Cpar sw n2 50p
    Vsns n2 out 0
    Cout out co1 10u
    Rco co1 0 5m
    Lcab out pen1 0.5u IC=40
    Rcab pen1 pen 4m
    Vld pen pl 0
    Barc pl 0 I = max(0, (v(pl) - {VARC}) / 0.045)
    {MODELS}
    .options method=gear reltol=2e-3 abstol=1e-6 vntol=1e-4 itl4=200
    .tran 5n {TEND} 0 10n uic
    .control
    set wr_singlescale
    set wr_vecnames
    run
    wrdata {{OUT}} i(Vsns) v(dr) v(sw) i(Vq1) v(da) i(Vd1) v(sn1) v(s0) i(Vsup) v(pl) i(Vld)
    quit
    .endc
    .end
    """)

def run_spice(net, TEND=3e-3, win=0.5e-3):
    with tempfile.TemporaryDirectory() as td:
        p = os.path.join(td, "b.cir"); out = os.path.join(td, "b.dat")
        open(p, "w").write(net.replace("{OUT}", out))
        r = subprocess.run([NGSPICE, "-b", p], capture_output=True, text=True, timeout=1800)
        if not os.path.exists(out):
            print(r.stdout[-1500:], r.stderr[-1500:]); return {}
        hd = open(out).readline().split()
        d = np.loadtxt(out, skiprows=1)
    keep = np.concatenate([np.diff(d[:, 0]) > 0, [True]]); d = d[keep]
    v = {k.lower(): d[:, i] for i, k in enumerate(hd)}
    t = v["time"]; m = t > TEND - win
    def avg(y): return np.trapezoid(np.where(m, y, 0), t) / win
    i = v["i(vsns)"]
    return dict(iavg=avg(i), imax=i[m].max(), imin=i[m].min(),
                pq1=avg((v["v(dr)"] - v["v(sw)"]) * v["i(vq1)"]),
                pd1=avg((v["v(da)"] - v["v(sw)"]) * v["i(vd1)"]),
                pl=avg(i * i * 0.022),
                psn=avg((v["v(sw)"] - v["v(sn1)"]) ** 2 / 3.3),
                pin=avg(-v["v(s0)"] * v["i(vsup)"]),
                parc=avg(v["v(pl)"] * v["i(vld)"]),
                vdsmax=(v["v(dr)"] - v["v(sw)"])[m].max())

have_ng = os.path.exists(NGSPICE) or shutil.which(NGSPICE) is not None
SPICE = {}
if not have_ng:
    print(f"  ngspice no encontrado en {NGSPICE}: seccion B saltada (los numeros del reporte salen de aqui).")
else:
    print("  f[kHz]   D      I_media  I_max  I_min  rizo_pp | P_Q1   P_D1   P_choque P_snub | P_arco  P_entrada  efic  | Vds_max")
    for F in (20e3, 50e3, 100e3):
        D = 0.425
        for it in range(3):
            o = run_spice(buck_net(F, D))
            if "iavg" not in o: break
            D += (40.0 - o["iavg"]) * 0.115 / 48.0       # correccion ~ R_total / Vbus
            if abs(o["iavg"] - 40.0) < 0.6: break
        if "iavg" not in o:
            print(f"  {F/1e3:5.0f}  sin resultado de ngspice"); continue
        SPICE[F] = o
        eff = o["parc"] / o["pin"] if o.get("pin") else float("nan")
        Dused = D - (40.0 - o["iavg"]) * 0.115 / 48.0
        print(f"  {F/1e3:5.0f}  {Dused:6.4f}  {o['iavg']:6.2f}  {o['imax']:6.2f} {o['imin']:6.2f}  {o['imax']-o['imin']:6.2f}  | {o['pq1']:5.1f}  {o['pd1']:5.1f}  {o['pl']:6.1f}  {o['psn']:6.2f} | {o['parc']:6.1f}  {o['pin']:7.1f}   {eff:5.3f} | {o['vdsmax']:6.1f}")
    if 20e3 in SPICE and 100e3 in SPICE:
        d = (SPICE[100e3]["pq1"] + SPICE[100e3]["psn"]) - (SPICE[20e3]["pq1"] + SPICE[20e3]["psn"])
        print(f"  costo de pasar de 20 a 100 kHz (Q1 + snubber): +{d:.1f} W  (de una potencia de arco de ~{SPICE[100e3]['parc']:.0f} W)")
    print("  nota: P_Q1 incluye conduccion (Rd+Rs+Rb del modelo) + conmutacion con Rg_on 17 ohm / Rg_off 38 ohm del IR2110.")

# =====================================================================================================
hdr("C. EFECTO PIEL EN EL ALAMBRE DE 0.8 mm: mu INCREMENTAL, delta Y R_ac/R_dc (frio vs caliente)")
# =====================================================================================================
def mu_r_of_B(B):   # ajuste de foro COMSOL a acero 1010 (Fermilab TD-01-067) -- aproximado, NO verificado
    return 1.0 + 2500.0 * (1.0 - np.tanh(2.7 * B) ** 450)
Bg = np.linspace(1e-4, 2.4, 24000)
Hg = Bg / (MU0 * mu_r_of_B(Bg))
def B_of_H(H): return np.interp(H, Hg, Bg)
def mu_inc(H, dH=200.0): return (B_of_H(H + dH) - B_of_H(max(H - dH, 0))) / (min(2 * dH, H + dH)) / MU0
print("  C1. Curva B-H de acero bajo carbono (ajuste 1010) y permeabilidad INCREMENTAL (la que ve el rizo montado en la DC)")
print("     H [kA/m]   B [T]   mu_amplitud   mu_incremental")
for H in (0.2e3, 1e3, 2e3, 5e3, 10e3, 15.9e3, 25e3):
    print(f"     {H/1e3:7.1f}   {B_of_H(H):5.2f}   {B_of_H(H)/(MU0*H):9.0f}     {mu_inc(H):9.1f}")
for I in (10.0, 20.0, 40.0, 70.0):
    Hs = I / (2 * math.pi * B_OUT)
    print(f"   I_dc={I:4.0f} A -> H en la superficie = {Hs/1e3:5.1f} kA/m -> mu_incremental ~ {mu_inc(Hs):6.1f}")
g_seam, lpath = 10e-6, 2 * math.pi * 0.33e-3
for mu in (100.0, 1000.0):
    print(f"   costura del tubo (entrehierro SUPUESTO 10 um en camino de {lpath*1e3:.2f} mm): mu={mu:5.0f} -> mu_efectiva {mu/(1+mu*g_seam/lpath):5.0f}")

def z_int(f, rho, mur, b, a=0.0):
    """impedancia interna por metro (ohm/m), Bessel exacto. a>0: tubo con nucleo no conductor."""
    if f <= 0: return complex(rho / (math.pi * (b * b - a * a)), 0)
    k = np.sqrt(-1j * 2 * math.pi * f * MU0 * mur / rho)
    if a <= 0:
        return k * rho / (2 * math.pi * b) * jv(0, k * b) / jv(1, k * b)
    num = jv(0, k * b) * yv(1, k * a) - yv(0, k * b) * jv(1, k * a)
    den = jv(1, k * b) * yv(1, k * a) - yv(1, k * b) * jv(1, k * a)
    return k * rho / (2 * math.pi * b) * num / den

def delta(f, rho, mur): return math.sqrt(rho / (math.pi * f * MU0 * mur))

As08, Af08 = geom(B_OUT, A_IN_08)
print(f"\n  C2. Geometria SUPUESTA del 0.8 mm tubular: pared {1e3*(B_OUT-A_IN_08):.2f} mm, acero {As08*1e6:.3f} mm^2 ({100*As08/(math.pi*B_OUT**2):.0f} % del area),"
      f" fundente {Af08*1e6:.3f} mm^2 -> llenado en masa {100*Af08*RHO_F/(Af08*RHO_F+As08*RHO_M):.1f} %")
print(f"     masa por metro: acero {As08*RHO_M*1e3:.2f} g/m + fundente {Af08*RHO_F*1e3:.2f} g/m = {(As08*RHO_M+Af08*RHO_F)*1e3:.2f} g/m  (macizo 0.8 mm: {math.pi*B_OUT**2*RHO_M*1e3:.2f} g/m)")
print("     chequeo DC del Bessel: tubo 20 C a 1 Hz: R = %.2f mOhm/mm  vs  rho/A = %.2f mOhm/mm" % (
    z_int(1.0, rho_e(20), 1.0, B_OUT, A_IN_08).real * 1e3 * 1e-3, rho_e(20) / As08 * 1e3 * 1e-3))

print("\n  C3. delta y R_ac/R_dc.  frio = 20 C (rho 0.142 uOhm m), tibio = 600 C (0.688), caliente = 900 C (1.10, mu=1 arriba de Curie 770 C)")
print("   estado      mu_r   f[kHz] | delta[mm]  | R_ac/R_dc solido 0.8 | R_ac/R_dc tubo pared 0.15 | R_ac [mOhm/mm] tubo")
cases = [("frio", 20.0, 1.0), ("frio", 20.0, 7.0), ("frio", 20.0, 30.0), ("frio", 20.0, 100.0), ("frio", 20.0, 300.0),
         ("tibio", 600.0, 7.0), ("tibio", 600.0, 100.0), ("caliente", 900.0, 1.0)]
for name, T, mu in cases:
    rr = rho_e(T)
    for f in (1e3, 20e3, 100e3):
        zs = z_int(f, rr, mu, B_OUT); zt = z_int(f, rr, mu, B_OUT, A_IN_08)
        print(f"   {name:8s} {mu:6.0f}  {f/1e3:6.0f} | {delta(f, rr, mu)*1e3:8.3f}  |  {zs.real/(rr/(math.pi*B_OUT**2)):8.2f}            |  {zt.real/(rr/As08):8.2f}                 | {zt.real*1e-3*1e3:7.3f}")
print(f"   R_dc tubo: frio {rho_e(20)/As08*1e-3*1e3:.3f}, 600 C {rho_e(600)/As08*1e-3*1e3:.3f}, 900 C {rho_e(900)/As08*1e-3*1e3:.3f} mOhm/mm  (caliente/frio = {rho_e(900)/rho_e(20):.1f}x)")

print("\n  C4. Calentamiento por INDUCCION (bobina alrededor del alambre libre) -- regla d/delta >= 2.5 para acoplar bien")
for name, T, mu in (("frio mu=100", 20.0, 100.0), ("tibio mu=50", 600.0, 50.0), ("arriba de Curie mu=1", 900.0, 1.0)):
    dneed = 2 * B_OUT / 2.5
    fneed = rho_e(T) / (math.pi * MU0 * mu * dneed ** 2)
    print(f"   {name:22s}: necesita delta <= {dneed*1e3:.2f} mm -> f >= {fneed/1e3:9.1f} kHz")

# =====================================================================================================
hdr("D. EL ALAMBRE LIBRE COMO PRECALENTADOR (transito en la coordenada del alambre; acero conduce, fundente solo absorbe)")
# =====================================================================================================
EPS = 0.5
def transit(I_dc, Lst, vf, b, a, I_ac=0.0, f_ac=20e3, mu_cold=7.0, T0=20.0, n=600):
    """marcha t -> x. Devuelve (T_punta, P_joule_total, P_joule_ac, fundio_en_stickout)."""
    As, Af = geom(b, a)
    tt = Lst / vf; dt = tt / n; T = T0; Pj = 0.0; Pac = 0.0
    # tabla de R_ac por temperatura para el rizo
    for i in range(n):
        re = rho_e(T)
        qdc = I_dc * I_dc * re / As
        if I_ac > 0:
            mu = mu_cold if T < T_CURIE else 1.0
            qac = I_ac * I_ac * z_int(f_ac, re, mu, b, a).real
        else:
            qac = 0.0
        qrad = EPS * SIG * ((T + 273) ** 4 - 293 ** 4) * 2 * math.pi * b
        Cp = RHO_M * c_s(T) * As + RHO_F * C_F * Af
        T += (qdc + qac - qrad) / Cp * dt
        Pj += (qdc + qac) * vf * dt; Pac += qac * vf * dt
        if T >= T_SOL:
            return T_SOL, Pj, Pac, True
    return T, Pj, Pac, False

def tip_need(vf, Ttip, b, a):
    As, Af = geom(b, a)
    return vf * (As * RHO_M * (H_DROP - h_s(Ttip)) + Af * RHO_F * max(H_F - C_F * (Ttip - 20), 0.0))

print(f"  enthalpias: acero 20->{T_DROP:.0f} C = {H_DROP/1e3:.0f} kJ/kg  (solido a 770 C: {h_s(770)/1e3:.0f} kJ/kg = {100*h_s(770)/H_DROP:.0f} %;"
      f" a 1200 C: {h_s(1200)/1e3:.0f} kJ/kg = {100*h_s(1200)/H_DROP:.0f} %);  fundente {H_F/1e3:.0f} kJ/kg (SUPUESTO)")

print("\n  D1. Calibracion de V_e (calor por amper en la punta) con Lincoln Innershield NR-211-MP 0.9 mm, DC-, stick-out electrico 10 mm")
b09 = 0.45e-3; a09 = b09 * math.sqrt(A_IN_08**2 / B_OUT**2)     # misma fraccion de acero que el 0.8 (SUPUESTO)
lincoln = [(30.0, 125.0, 14.0), (65.0, 180.0, 15.0), (90.0, 230.0, 16.0), (120.0, 280.0, 16.5)]
print("    I[A]  v_f[mm/s]  V_arco | T_punta[C]  P_stickout[W]  P_punta=I*V_e [W]  V_e[V]   P_gota/P_arco")
Ve_list = []
for I, wfs, V in lincoln:
    vf = wfs / 60.0 * 10.0 * 1e-3
    Tt, Pj, _, melted = transit(I, 10e-3, vf, b09, a09)
    need = tip_need(vf, Tt, b09, a09)
    Ve = need / I; Ve_list.append(Ve)
    print(f"    {I:4.0f}  {vf*1e3:7.1f}    {V:5.1f}  | {Tt:8.0f}{' (FUNDE)' if melted else ''}    {Pj:7.1f}        {need:7.1f}          {Ve:5.2f}    {(need+Pj)/(I*V+Pj):5.2f}")
VE_DCEN = float(np.mean(Ve_list[:2]))      # puntos de corriente baja, los relevantes a 40 A
print(f"    V_e(DC-, autoprotegido) usado = promedio de los 2 puntos bajos = {VE_DCEN:.2f} V  (rango de los 4 puntos {min(Ve_list):.2f}-{max(Ve_list):.2f} V)")
print("    referencia: Watkins 1990 (resumen OSTI), GMAW 0.89 mm acero Ar-2%O2: componente de la gota = 40 % del calor del arco; total 85 %")

print("\n  D2. Prediccion para el 0.8 mm E71T-GS a corriente fija: velocidad de alambre que se quema (v_f de equilibrio)")
print("    I[A]  stickout | v_f[mm/s] (m/min) | T_punta[C]  P_stick[W]  P_punta[W] | caudal acero [mm^3/s]")
def vf_equil(I, Lst, Ve, I_ac=0.0, f_ac=20e3, mu_cold=7.0):
    def F(vf):
        Tt, Pj, _, melted = transit(I, Lst, vf, B_OUT, A_IN_08, I_ac, f_ac, mu_cold)
        if melted: return 1e3   # funde en el stickout: sobra calor, hay que alimentar mas rapido
        return I * Ve - tip_need(vf, Tt, B_OUT, A_IN_08)
    return brentq(F, 2e-3, 0.5, xtol=1e-6)
D2 = {}
for I in (30.0, 40.0, 50.0, 70.0):
    for Lst in (10e-3, 15e-3, 20e-3):
        vf = vf_equil(I, Lst, VE_DCEN)
        Tt, Pj, _, _ = transit(I, Lst, vf, B_OUT, A_IN_08)
        D2[(I, Lst)] = (vf, Tt, Pj)
        print(f"    {I:4.0f}  {Lst*1e3:4.0f} mm  | {vf*1e3:7.1f} ({vf*60:4.2f})      | {Tt:7.0f}     {Pj:7.1f}     {I*VE_DCEN:7.1f}   | {vf*As08*1e9:6.2f}")

print("\n  D3. Polaridad: DCEN funde +29 % (Ar+18CO2, Souza/Scotti) a +40-50 % (Puhl, 100-400 A) sobre DCEP -> V_e(DCEP) = V_e/1.29 .. /1.5")
for fac in (1.29, 1.5):
    vf = vf_equil(40.0, 15e-3, VE_DCEN / fac)
    print(f"    40 A, stickout 15 mm, DCEP (V_e={VE_DCEN/fac:.2f} V): v_f = {vf*1e3:.1f} mm/s  vs DCEN {D2[(40.0, 15e-3)][0]*1e3:.1f} mm/s")

print("\n  D4. El rizo de 20 kHz como precalentador: Joule extra en el stickout (40 A, 15 mm, DCEN)")
vf0 = D2[(40.0, 15e-3)][0]
for f_ac, label in ((20e3, "20 kHz"), (100e3, "100 kHz")):
    Vo = 19.0 + 40 * R_LOOP; Dd = Vo / VB
    Ipp = (VB - Vo) * Dd / (L1 * f_ac); Iac = Ipp / (2 * math.sqrt(3))
    for mu in (7.0, 100.0):
        Tt, Pj, Pac, _ = transit(40.0, 15e-3, vf0, B_OUT, A_IN_08, Iac, f_ac, mu)
        print(f"    {label:7s} rizo {Ipp:5.2f} A_pp (I_ac,rms {Iac:4.2f} A) mu_frio={mu:5.0f}: P_stick = {Pj:6.2f} W de los cuales rizo {Pac:5.3f} W ({100*Pac/Pj:5.2f} %)")

print("\n  D5. Precalentar EN SERIO: cuanto cuesta llevar el alambre a 700 C antes de la punta (40 A, v_f de 15 mm)")
vfp = D2[(40.0, 15e-3)][0]
Pneed700 = vfp * (As08 * RHO_M * h_s(700.0) + Af08 * RHO_F * C_F * 680.0)
gain = (As08 * RHO_M * h_s(700.0) + Af08 * RHO_F * C_F * 680.0) / (As08 * RHO_M * H_DROP + Af08 * RHO_F * H_F)
print(f"    potencia para 20->700 C a {vfp*1e3:.1f} mm/s: {Pneed700:5.1f} W ; recorta {100*gain:4.1f} % de la energia que pide la punta -> +{100*(1/(1-gain)-1):.0f} % de deposito a la misma I")
print(f"    por induccion (bobina sobre el alambre libre, 100-300 kHz): se auto-limita en Curie 770 C (mu->1, f_necesaria salta a ~2.7 MHz)")
def T_tip_of_L(Lst):
    return transit(40.0, Lst, vfp, B_OUT, A_IN_08)[0]
L700 = brentq(lambda L: T_tip_of_L(L) - 700.0, 5e-3, 60e-3)
print(f"    con la MISMA corriente de 40 A (Joule DC, gratis): T_punta = 700 C con stickout = {L700*1e3:.1f} mm (hoy 15 mm -> {T_tip_of_L(15e-3):.0f} C)")

# =====================================================================================================
hdr("E. BALANCE DE ENERGIA A 40 A: A DONDE SE VA LA POTENCIA Y QUE PERILLA SUBE LA FRACCION A LA GOTA")
# =====================================================================================================
print("  V_arco = 14 + 10 V/mm * L_arco (medido por ian).  P_punta = I*V_e (calibrado DC-).  P_stick = Joule del transito (D).")
print("  La columna + caida de la pieza = I*(V_arco - V_e) -> placa + radiacion; NO a la gota.")
print("  stickout L_arco | V_arco  P_arco | P_stick  P_punta  P_gota | %gota de lo electrico | columna+pieza [W]")
EB = {}
for Lst in (10e-3, 20e-3):
    vf, Tt, Pj = D2[(40.0, Lst)]
    for La in (0.5, 1.0, 2.0, 3.0):
        Va = 14.0 + 10.0 * La; Pa = 40.0 * Va; Pt = 40.0 * VE_DCEN
        frac = (Pt + Pj) / (Pa + Pj)
        EB[(Lst, La)] = frac
        print(f"   {Lst*1e3:4.0f} mm  {La:4.1f} mm | {Va:5.1f}  {Pa:6.0f} | {Pj:6.1f}   {Pt:6.1f}  {Pt+Pj:6.1f} |   {100*frac:5.1f} %              | {Pa-Pt:6.0f}")
print("  perillas (derivadas a 40 A, stickout 15 mm, L_arco 1 mm):")
vfa = D2[(40.0, 15e-3)][0]; Pj15 = D2[(40.0, 15e-3)][2]; base = (40 * VE_DCEN + Pj15) / (40 * 24.0 + Pj15)
print(f"   base: {100*base:.1f} % a la gota")
print(f"   L_arco 1 -> 0.5 mm: {100*(40*VE_DCEN + Pj15)/(40*19.0 + Pj15):.1f} %   (cada mm de arco = 10 V x 40 A = 400 W a la columna)")
print(f"   stickout 10 -> 20 mm: v_f {D2[(40.0,10e-3)][0]*1e3:.1f} -> {D2[(40.0,20e-3)][0]*1e3:.1f} mm/s (+{100*(D2[(40.0,20e-3)][0]/D2[(40.0,10e-3)][0]-1):.0f} % de deposito a la misma corriente)")
print(f"   DCEN vs DCEP: +29..50 % de fusion (fuente, no calculo)")
print(f"   rizo 20 kHz vs 100 kHz: +{100*((14/ (2*math.sqrt(3)))/40)**2:.1f} % en el termino Joule = <0.3 % de la potencia a la gota")

# =====================================================================================================
hdr("F. CAMPO AXIAL: BOBINA ALREDEDOR DE LA BOQUILLA vs EL CAMPO PROPIO")
# =====================================================================================================
for I, r in ((40.0, 0.4e-3), (40.0, 1.0e-3), (40.0, 2.0e-3)):
    print(f"  campo propio B_theta = mu0 I/(2 pi r) a I={I:.0f} A, r={r*1e3:.1f} mm: {MU0*I/(2*math.pi*r)*1e3:5.1f} mT")
def B_axis_per_NI(z, r1, r2, l, nr=40, nz=40):
    """campo en el eje a distancia z bajo la cara inferior de un solenoide grueso, por amper-vuelta"""
    s = 0.0
    for r in np.linspace(r1, r2, nr):
        for zz in np.linspace(0, l, nz):
            d = z + zz
            s += MU0 * r * r / (2 * (r * r + d * d) ** 1.5)
    return s / (nr * nz)
r1, r2, lc, k_fill, rho_cu = 12e-3, 20e-3, 20e-3, 0.6, 2.0e-8
print(f"  bobina: Ø int {2*r1*1e3:.0f} mm, Ø ext {2*r2*1e3:.0f} mm, largo {lc*1e3:.0f} mm, llenado {k_fill}, cobre a ~60 C; arco a z bajo la cara")
for z in (5e-3, 10e-3, 15e-3):
    bpn = B_axis_per_NI(z, r1, r2, lc)
    row = []
    for Bt in (2e-3, 5e-3, 10e-3):
        NI = Bt / bpn
        J = NI / ((r2 - r1) * lc)
        P = rho_cu * J * J * math.pi * (r2 * r2 - r1 * r1) * lc / k_fill
        row.append(f"{Bt*1e3:3.0f} mT: NI={NI:6.0f} A-v P={P:6.1f} W")
    print(f"   z={z*1e3:4.0f} mm ({bpn*1e6:5.2f} uT/A-v) | " + " | ".join(row))
for N in (5, 10):
    R = 20e-3
    for z in (0.0, 15e-3):
        print(f"  gratis: {N} vueltas del cable de la antorcha (R=20 mm) a 40 A -> B_z(z={z*1e3:.0f} mm) = {MU0*N*40*R*R/(2*(R*R+z*z)**1.5)*1e3:5.2f} mT (proporcional a I, sin perilla propia)")
print("  literatura: CO2 2 mT -> transferencia globular suave; 3-4 mT -> repelida rotatoria (Materials 2025);")
print("              metal-cored 320 A con 6 mT: frecuencia de gotas casi igual, penetracion 3.7 -> 4.2 mm (IJAMT 2025);")
print("              TIG axial (modelo): arco hueco, presion central NEGATIVA (de +97 Pa a -3038 Pa a 150 mT) (Micromachines 2025)")

# =====================================================================================================
hdr("G. TANQUE LC / DESCARGA DE CAPACITOR CONTRA EL BUCK; PRESUPUESTO DE LA LRS-1200-48")
# =====================================================================================================
print("  LRS-1200-48 (hoja Mean Well): 25 A nominal; PICO 37.5 A / 1800 W por <= 5 s con ciclo <= 35 % y promedio <= 1200 W;")
print("  sobrecarga >105 % por >5 s -> APAGA y hay que re-energizar. Bulk 2x2200 uF (La Pluma).")
f2 = 668.0
C_t = 1.0 / ((2 * math.pi * f2) ** 2 * L1)
for Rl in (0.05, 0.10):
    Qt = math.sqrt(L1 / C_t) / Rl
    print(f"  tanque serie a f2={f2:.0f} Hz con L=41 uH: C = {C_t*1e3:.2f} mF; R_lazo {Rl*1e3:.0f} mOhm -> Q_tanque = {Qt:.1f}  (la gota: Q supuesto 30)")
a0, a1 = 0.40e-3, 0.46e-3
print(f"  la gota crece de a={a0*1e3:.2f} a {a1*1e3:.2f} mm: f2 baja {(1-(a0/a1)**1.5)*100:.0f} % (f ~ a^-1.5) -> un tanque fijo no la sigue; el buck (100 kHz, PI+anticipada) ya da 30 A a 668-1268 Hz con -1.7 grados (canon)")
print(f"  energia en el tanque a 30 A de amplitud: 1/2 L I^2 = {0.5*L1*30**2*1e3:.1f} mJ por ciclo; en la bobina del buck a 40 A: {0.5*L1*40**2*1e3:.1f} mJ")
print("\n  Pulso de desprendimiento con el MISMO buck (subida por (48-V)/L, bajada por D1 a V/L):")
print("   I_pico | t_subida  t_bajada | E_pulso 1 ms @25 V | I_entrada pico | caida bulk/pulso | P_media (40 A base + 75 pulsos/s) | D1 prom")
for Ipk in (70.0, 100.0, 150.0, 200.0):
    tr = (Ipk - 40.0) / ((VB - 25.0) / L1); tf = (Ipk - 40.0) / ((25.0 + 0.55) / L1)
    E = Ipk * 25.0 * 1e-3
    Iin = Ipk * 25.0 / 48.0 / 0.93
    dV = max(Iin - 37.5, 0) * 1e-3 / 4.4e-3
    Pavg = (40.0 * 25.0 + (Ipk - 40.0) * 25.0 * 1e-3 * 75) / 0.93
    Iout_avg = 40.0 + (Ipk - 40.0) * 1e-3 * 75
    print(f"   {Ipk:5.0f}  | {tr*1e6:6.1f} us {tf*1e6:6.1f} us |   {E:5.2f} J           | {Iin:6.1f} A       | {dV:5.2f} V          | {Pavg:6.0f} W {'(> 1200 W NOMINAL)' if Pavg > 1200 else '(ok)'}            | {(1-25/48)*Iout_avg:4.1f} A")
print("   limites: IRFB4227 65 A cont / 260 A pulsado; MBR40100CT 2x20 A prom, IFSM 250-300 A (8.3 ms); ACS758: depende de la variante (50/100/150/200 A)")
print("  Descarga de capacitor (CD) directa a la punta: C a 48 V por lazo de 1 uH / 30 mOhm contra arco de 20 V")
for C in (100e-6, 1000e-6):
    Lc, Rc, V0 = 1e-6, 0.03, 48.0 - 20.0
    w0 = 1 / math.sqrt(Lc * C); alpha = Rc / (2 * Lc)
    if alpha < w0:
        wd = math.sqrt(w0 * w0 - alpha * alpha); tpk = math.atan(wd / alpha) / wd
        Ipk = V0 / (wd * Lc) * math.exp(-alpha * tpk) * math.sin(wd * tpk)
    else:
        s1 = -alpha + math.sqrt(alpha * alpha - w0 * w0); s2 = -alpha - math.sqrt(alpha * alpha - w0 * w0)
        tpk = math.log(s2 / s1) / (s1 - s2)
        Ipk = V0 / (Lc * (s1 - s2)) * (math.exp(s1 * tpk) - math.exp(s2 * tpk))
    m = RHO_M * 4 / 3 * math.pi * (0.46e-3) ** 3
    imp = MU0 * Ipk * Ipk / (4 * math.pi) * tpk     # orden de magnitud: fuerza de pellizco x tiempo al pico
    print(f"   C={C*1e6:6.0f} uF: E={0.5*C*48**2:5.2f} J, I_pico ~ {Ipk:6.0f} A a t={tpk*1e6:5.1f} us (pellizco al pico {MU0*Ipk*Ipk/(4*math.pi)*1e3:5.1f} mN = {MU0*Ipk*Ipk/(4*math.pi)/3.77e-3:4.1f}x tension);"
          f" impulso ~{imp*1e9:6.1f} nN s -> dv gota 0.46 mm (m={m*1e6:.2f} mg) ~ {imp/m:5.2f} m/s; espectro plano hasta ~{1/(2*tpk)/1e3:.0f} kHz: golpea TODOS los modos")

# =====================================================================================================
hdr("H. 'RESONANCIA DE CAMPOS': LONGITUDES DE ONDA Y DONDE SI HAY RESONANCIA")
# =====================================================================================================
c0 = 2.998e8
for f in (668.0, 20e3, 100e3):
    print(f"  f = {f/1e3:8.3f} kHz -> lambda = {c0/f/1e3:10.1f} km   (la pluma mide 0.02-0.5 m: todo es cuasi-estatico)")
for Lx, name in ((20e-3, "stickout 20 mm"), (2e-3, "arco 2 mm"), (0.46e-3, "gota 0.46 mm")):
    print(f"  resonancia electromagnetica de media onda en {name:14s}: f = {c0/(2*Lx)/1e9:8.1f} GHz")
for ne in (1e22, 1e23):
    print(f"  frecuencia de plasma del arco n_e={ne:.0e} m^-3: {8.98*math.sqrt(ne)/1e12:5.2f} THz")
print("  resonancias REALES al alcance: (1) mecanica de la gota l=2 a 668 Hz (Q~30 supuesto);")
print("  (2) termica-magnetica: Curie 770 C (mu 100->1) cambia R_ac del rizo y corta la induccion; (3) LC concentrado (choque+C).")

# =====================================================================================================
hdr("I. AUTORREGULACION Y PREDICCION DEL EXPERIMENTO DECISIVO: QUEMADO LIBRE (alimentador parado, 40 A fijos)")
# =====================================================================================================
print("  I1. CC + alimentacion fija: el arco casi no se autorregula (el canal Joule es debil a 40 A en 0.8 mm tubular)")
dMRdL = (D2[(40.0, 20e-3)][0] - D2[(40.0, 10e-3)][0]) / 10e-3
v15 = D2[(40.0, 15e-3)][0]
print(f"    dMR/dL_stickout = {dMRdL:.3f} 1/s  -> constante de tiempo del stickout tau = {1/dMRdL:.1f} s")
print(f"    1 % de error de alimentacion ({0.01*v15*1e3:.2f} mm/s) mueve el arco {0.01*v15/dMRdL*1e3:.2f} mm = {10*0.01*v15/dMRdL*1e3:.1f} V  -> el firmware DEBE cerrar el largo de arco (CV o servo de alimentacion)")
dMRdI = (D2[(50.0, 15e-3)][0] - D2[(30.0, 15e-3)][0]) / 20.0
print(f"    en cambio dMR/dI = {dMRdI*1e3:.2f} mm/s por A: con CV, 1 % de alimentacion se corrige con {0.01*v15/dMRdI:.2f} A")

print("\n  I2. Quemado libre: arco a 40 A con alimentacion corriendo; se PARA el alimentador; el alambre se quema hacia atras;")
print("      V = 14 + 10*L_arco sube a la velocidad de fusion: dV/dt = 10 V/mm * MR. Se corta a 38 V (L_arco 2.4 mm).")
def burnback(Ve, I_ac=0.0, f_ac=20e3, mu_cold=7.0, Lst0=15e-3, CTWD=16e-3, n=300):
    vf = vf_equil(40.0, Lst0, VE_DCEN)              # el regimen previo con alimentacion (DCEN) fija el perfil
    xs = np.linspace(0, Lst0, n)                    # x desde la punta de contacto
    T = np.array([transit(40.0, x, vf, B_OUT, A_IN_08)[0] if x > 0 else 20.0 for x in xs])
    As, Af = geom(B_OUT, A_IN_08)
    L = Lst0; t = 0.0; dt = 2e-5; out = []
    while True:
        La = CTWD - L; V = 14 + 10 * La * 1e3
        out.append((t, V, L))
        if V >= 38.0 or t > 0.3: break
        re = rho_e(T)
        q = 40.0 ** 2 * re / As
        if I_ac > 0:
            q = q + np.array([I_ac ** 2 * z_int(f_ac, r_, (mu_cold if Ti < T_CURIE else 1.0), B_OUT, A_IN_08).real for r_, Ti in zip(re, T)])
        Cp = RHO_M * np.interp(T, Tg, cg) * As + RHO_F * C_F * Af
        T = T + q / Cp * dt
        Ttip = float(np.interp(L, xs, T))
        need_per_len = As * RHO_M * (H_DROP - h_s(Ttip)) + Af * RHO_F * max(H_F - C_F * (Ttip - 20), 0)
        L -= 40.0 * Ve / need_per_len * dt
        t += dt
    o = np.array(out)
    m = (o[:, 1] >= 26.0) & (o[:, 1] <= 36.0)
    slope = np.polyfit(o[m, 0], o[m, 1], 1)[0]
    return slope, o
PB = {}
rows = [("DCEN, PWM 100 kHz", VE_DCEN, 100e3), ("DCEN, PWM 20 kHz", VE_DCEN, 20e3),
        ("DCEP (-29 %), 100 kHz", VE_DCEN / 1.29, 100e3), ("DCEP (-50 %), 100 kHz", VE_DCEN / 1.5, 100e3),
        ("DCEN V_e=3.0 V", 3.0, 100e3), ("DCEN V_e=5.1 V", 5.13, 100e3)]
print("    caso                    | dV/dt [V/s]  MR [mm/s]  | t de 24 a 38 V [ms]")
for name, Ve, fac in rows:
    Vo = 19.0 + 40 * R_LOOP; Dd = Vo / VB
    Iac = (VB - Vo) * Dd / (L1 * fac) / (2 * math.sqrt(3))
    sl, o = burnback(Ve, Iac, fac, 7.0)
    PB[name] = sl
    print(f"    {name:23s} | {sl:8.1f}    {sl/10:7.2f}     | {o[-1,0]*1e3:6.1f}")
print(f"    => 20 kHz vs 100 kHz: {100*(PB['DCEN, PWM 20 kHz']/PB['DCEN, PWM 100 kHz']-1):+.2f} %   DCEP/DCEN: {PB['DCEP (-29 %), 100 kHz']/PB['DCEN, PWM 100 kHz']:.2f} .. {PB['DCEP (-50 %), 100 kHz']/PB['DCEN, PWM 100 kHz']:.2f}")
print("    traza cruda (DCEN, 100 kHz): t[ms]  V[V]  stickout[mm]")
sl, o = burnback(VE_DCEN, 0.0)
for k in range(0, len(o), max(1, len(o) // 12)):
    print(f"      {o[k,0]*1e3:6.1f}  {o[k,1]:6.2f}  {o[k,2]*1e3:6.2f}")
print(f"      {o[-1,0]*1e3:6.1f}  {o[-1,1]:6.2f}  {o[-1,2]*1e3:6.2f}")
print("  Lectura: V media por ciclo de trabajo (D*Vbus - I*R); ruido ~0.93 mOhm/periodo * 40 A = 37 mV; las gotas (~75/s) meten escalones de ~1-3 V:")
print("  con 10 tiros por caso y ajuste lineal en 26-36 V se espera +-3-5 % por caso (estimado, no medido).")
# =====================================================================================================
hdr("J. CHEQUEO DEL CANON: 'campanazo 40 A base + 30 A a f2, alambre a 3 m/min, 75 gotas/s de 0.4526 mm'")
# =====================================================================================================
vcanon = 3.0 / 60.0
ad = 0.4526e-3; Vd = 4 / 3 * math.pi * ad ** 3
print(f"  canon: v_f = {vcanon*1e3:.0f} mm/s; 75 gotas/s x {Vd*1e9:.3f} mm^3 = {75*Vd*1e9:.1f} mm^3/s de gota")
print(f"  alambre 0.8 a 50 mm/s: volumen total {vcanon*math.pi*B_OUT**2*1e9:.1f} mm^3/s (acero {vcanon*As08*1e9:.1f} + fundente {vcanon*Af08*1e9:.1f})")
print("  la onda de 30 A (media cero, I nunca < 10 A) NO agrega calor a la punta (canal lineal); Joule sube por I_rms^2 = 40^2 + 30^2/2:")
Irms2 = 40.0 ** 2 + 30.0 ** 2 / 2
print(f"    I_rms = {math.sqrt(Irms2):.1f} A -> Joule x{Irms2/1600:.2f}")
for Ve in (3.0, VE_DCEN, 5.13):
    v40 = vf_equil(40.0, 15e-3, Ve)
    Ineed = brentq(lambda I: vf_equil(I, 15e-3, Ve) - vcanon, 30.0, 150.0, xtol=0.05)
    print(f"    V_e={Ve:4.2f} V: 40 A DC funde {v40*1e3:5.1f} mm/s ({v40*60:4.2f} m/min) -> acero {v40*As08*1e9:5.2f} mm^3/s = {v40*As08/Vd:5.1f} gotas/s de 0.4526 mm;"
          f"  para 3 m/min hace falta I_media = {Ineed:5.1f} A")
print("  Lincoln NR-211-MP 0.9 mm DC- (stick-out 10 mm) escalado a 0.8 mm por area (x 1/0.79), misma corriente:")
for I, wfs, V in lincoln:
    print(f"    {I:4.0f} A: 0.9 mm {wfs/100:4.2f} m/min -> 0.8 mm ~{wfs/100/(0.8/0.9)**2:4.2f} m/min")
ii = np.array([l[0] for l in lincoln]); ww = np.array([l[1] / 100 / (0.8 / 0.9) ** 2 for l in lincoln])
print(f"    interpolado: 40 A -> {np.interp(40, ii, ww):4.2f} m/min ; 3 m/min -> {np.interp(3.0, ww, ii):5.1f} A")

print("\nFIN")
