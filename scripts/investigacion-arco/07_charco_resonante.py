#!/usr/bin/env python3
"""
07 · EL CHARCO COMO SEGUNDA CAMPANA  (investigacion-arco, 2026-11-05)

Pregunta: el charco tambien oscila (literatura GTAW/GMAW: Kotecki 1972, Renwick & Richardson 1983,
Xiao & den Ouden 1990/1993, Hermans & den Ouden 1999, Maruo & Hirata 1993, Ebrahimi 2021).
Para NUESTRO proceso (0.8 mm E71T-GS, 40-60 A, gotas 0.46 mm a 50-80/s, placa 3 mm y pared de una gota):
  A. anclas de la literatura (las formulas contra sus propios datos)
  B. tamano del charco (Rosenthal con imagenes en placa de 3 mm; Rosenthal 2D en la pared)
  C. modos, frecuencias, Q, cuanto voltaje dan con 10 V/mm
  D. cuanto lo patea cada gota (impulso + volumen) y cuanto el sobre de I^2
  E. sincronizar la llegada de la gota con la fase del charco (salpicadura, cortos, cordon)
  F. el charco como sensor (ancho, temperatura, penetracion)
  G. dos campanas en el mismo cable: (G1) el oido del canon con el charco sonando, con y sin pasa-altos;
     (G2) estimar f del charco gota por gota con la gota sonando encima; (G3) mezcla por I^2
  H. el experimento barato: punto fijo en la placa de 3 mm, prediccion f(t), penetracion
Todo lo que dice el reporte 07-charco-resonante.md sale de aqui. Semillas fijas.
"""
import math
import numpy as np
from scipy import special, signal, linalg

# ---------------- canon ----------------
SIG, RHO, MU = 1.5, 7000.0, 6e-3          # N/m, kg/m3, Pa s (canon)
NU = MU / RHO
ICRIT = 194.0
KV = 10.0                                  # V por mm (ian)
KV_LIT = 1.5                               # V por mm tipico de literatura (GTA Ar ~1, He ~0.8; supuesto GMAW ~1-2)
G = 9.81
AW = math.pi * (0.4e-3) ** 2
A_GOTA = 0.46e-3
MU0 = 4e-7 * math.pi
# termico (acero, promedios de alta temperatura; supuestos)
K_TH, RHOC = 30.0, 7800.0 * 680.0
ALPHA = K_TH / RHOC
TM = 1500.0                                # C, fusion acero dulce (supuesto)
RHO_S = 7850.0

def hdr(t):
    print(); print("=" * 100); print(t); print("=" * 100)

def f2_gota(a):
    return math.sqrt(8 * SIG / (RHO * a ** 3)) / (2 * math.pi)

# ---- formulas de la literatura ----
# Xiao & den Ouden 1990 (WJ 69:289s) ec. 6 y 1993 (WJ 72:428s) ec. 5-6: charco PARCIAL, onda capilar, k = c/D
#   f = (1/2pi) sqrt(gam k^3 / rho)  ->  modo 1 (c=11.04): f = 5.84 sqrt(gam/(rho D^3)) ; modo 2 (c=7.66): 3.374 sqrt(...)
# Xiao & den Ouden 1990 ec. 10 / 1993 ec. 7 (= Maruo & Hirata 1993, Ebrahimi 2021 ec. 30-31): charco TOTAL, membrana de 2 caras
#   f = 1.08 sqrt(gam/(rho_s H)) / Deq
def f_modo1(D, gam=SIG, rho=RHO): return 5.84 * math.sqrt(gam / (rho * D ** 3))
def f_modo2(D, gam=SIG, rho=RHO): return 3.374 * math.sqrt(gam / (rho * D ** 3))
def f_modo3(Deq, H, gam=SIG, rho_s=RHO_S): return 1.08 * math.sqrt(gam / (rho_s * H)) / Deq
def f_capgrav(k, h, gam=SIG, rho=RHO):  # dispersion completa con gravedad y fondo
    return math.sqrt((G * k + gam * k ** 3 / rho) * math.tanh(k * h)) / (2 * math.pi)
def f_sesil_l2(R, gam=SIG, rho=RHO):    # casquete hemisferico con linea de contacto libre = modo l=2 de Rayleigh
    return math.sqrt(8 * gam / (rho * R ** 3)) / (2 * math.pi)
def D_de_f_modo1(f, gam=SIG, rho=RHO):  # inversa
    return (5.84 ** 2 * gam / (rho * f * f)) ** (1 / 3)

# =====================================================================================
hdr("A. ANCLAS: las formulas contra los datos medidos de la literatura")
print("  A1. Xiao & den Ouden 1990, Fe 360, charco PARCIAL estacionario (GTA): 330 Hz a D=3.7 mm, 80 Hz a D=9.9 mm")
for D, fm in ((3.7e-3, 330.0), (9.9e-3, 80.0)):
    g_eff = (fm / (5.84 * (D ** -1.5))) ** 2 * RHO
    print(f"      D={D*1e3:4.1f} mm  medido {fm:5.0f} Hz | modo1 gam=1.0: {f_modo1(D,1.0):5.0f} Hz  gam=1.5 (canon): {f_modo1(D,1.5):5.0f} Hz | gam efectiva que lo clava: {g_eff:.2f} N/m")
print("  A2. Renwick & Richardson 1983, GTA He, PARCIAL: 130-393 Hz para anchos 3.73-7.21 mm (sin parear)")
for D in (3.73e-3, 7.21e-3):
    print(f"      D={D*1e3:4.2f} mm  modo1 gam=1.0: {f_modo1(D,1.0):5.0f} Hz   gam=1.5: {f_modo1(D,1.5):5.0f} Hz")
print("      -> rango calculado 114-306 (gam=1) / 140-375 (gam=1.5) contra 130-393 medido: gam_eff ~1.3-1.6")
print("  A3. Xiao & den Ouden 1993, GTA en movimiento, placa 4 mm: parcial 336->204 Hz, cae de golpe, total 100->37 Hz;")
print("      transicion cuando el ancho del fondo W_b ~ 2 mm (~H/2). Amplitud en V: parcial ~100 mV, total ~250 mV con E~1 V/mm")
print("  A4. Kotecki et al. 1972, hierro Armco, lamina 1.27 mm, TOTAL (pelicula alta velocidad tras apagar el arco)")
for nom, rt, rb, T in (("F-2", 3.73, 3.05, 14.5e-3), ("F-4", 5.00, 4.72, 21.9e-3)):
    Deq = (rt + rb) * 1e-3
    print(f"      {nom}: r_arriba {rt} mm r_abajo {rb} mm  medido {1/T:5.1f} Hz | modo3 gam=1.0: {f_modo3(Deq,1.27e-3,1.0):5.1f}  gam=1.5: {f_modo3(Deq,1.27e-3,1.5):5.1f}  gam=1.8 (Fe puro): {f_modo3(Deq,1.27e-3,1.8):5.1f} Hz")
print("  A5. Hermans & den Ouden 1999, GMAW corto circuito 1.0 mm: estabilidad maxima cuando f_corto = f_charco (gam=0.9);")
for fs in (100.0, 150.0):
    print(f"      f_corto = {fs:.0f} Hz  ->  ancho de charco implicado (modo1, gam=0.9): {D_de_f_modo1(fs,0.9)*1e3:4.1f} mm")
print("  A6. Ebrahimi et al. 2021 (simulacion GTA, total): 22-73 Hz; De=7.5 mm -> ~41 Hz; acuerdo con Yudodibroto <=10 %")
print("  VEREDICTO A: las formulas reproducen los datos dentro de ~10-25 %; gam_eff 1.0-1.6 N/m. Se usan las dos (1.0 y 1.5).")

# =====================================================================================
hdr("B. TAMANO DEL CHARCO EN NUESTRO PROCESO (Rosenthal, fuente puntual; supuestos: k=30 W/mK, alfa=5.7e-6, Tf=1500 C, eta=0.8, V=18 V)")

def charco_placa(P, v, T0, H=3e-3, nimg=6):
    """Rosenthal 3D en placa de espesor H, caras adiabaticas (loseta abajo) por imagenes. Devuelve L, W, prof, total?, W_fondo."""
    xi = np.arange(-20e-3, 5e-3, 0.05e-3); y = np.arange(0, 7e-3, 0.05e-3)
    def T(X, Y, Z):
        s = np.zeros(np.broadcast(X, Y, Z).shape)
        for n in range(-nimg, nimg + 1):
            R = np.sqrt(X * X + Y * Y + (Z - 2 * n * H) ** 2) + 1e-9
            s += np.exp(-v * (X + R) / (2 * ALPHA)) / R
        return T0 + P / (2 * math.pi * K_TH) * s
    X, Y = np.meshgrid(xi, y, indexing="ij")
    top = T(X, Y, 0.0) >= TM
    if not top.any(): return None
    L = (xi[top.any(1)].max() - xi[top.any(1)].min()); W = 2 * y[top.any(0)].max()
    z = np.arange(0, H + 1e-9, 0.025e-3); Xz, Zz = np.meshgrid(xi, z, indexing="ij")
    side = T(Xz, 0.0, Zz) >= TM
    prof = z[side.any(0)].max()
    bot = T(X, Y, H) >= TM
    Wb = 2 * y[bot.any(0)].max() if bot.any() else 0.0
    return L, W, prof, bot.any(), Wb

def charco_pared(P, v, T0, w):
    """Rosenthal 2D en semiplano (pared delgada de espesor w, borde de arriba adiabatico). Devuelve L, prof, adelante."""
    xi = np.arange(-60e-3, 6e-3, 0.05e-3); z = np.arange(0, 8e-3, 0.025e-3)
    X, Z = np.meshgrid(xi, z, indexing="ij")
    r = np.sqrt(X * X + Z * Z) + 1e-9
    T = T0 + P / (math.pi * K_TH * w) * np.exp(-v * X / (2 * ALPHA)) * special.k0(v * r / (2 * ALPHA))
    m = T >= TM
    if not m.any(): return None
    xs = xi[m.any(1)]
    return xs.max() - xs.min(), z[m.any(0)].max(), xs.max()

print("  B1. PLACA de 3 mm sobre loseta: largo L, ancho W, profundidad, penetracion total, ancho del fondo")
print(f"  {'I A':>4} {'v mm/s':>6} {'T0 C':>5} | {'P W':>5} {'L mm':>5} {'W mm':>5} {'prof mm':>7} {'TOTAL':>5} {'Wfondo':>6} | {'f modo1 g1.0':>12} {'g1.5':>5} {'f modo3':>7}")
placa = {}
for I in (40, 50, 60):
    for v in (3e-3, 6e-3, 10e-3):
        for T0 in (25.0, 200.0, 400.0):
            P = 0.8 * 18.0 * I
            r = charco_placa(P, v, T0)
            if r is None:
                print(f"  {I:4d} {v*1e3:6.0f} {T0:5.0f} | {P:5.0f}  sin charco"); continue
            L, W, prof, tot, Wb = r; placa[(I, v, T0)] = r
            Deq = math.sqrt(L * W)
            f1a, f1b = f_modo1(W, 1.0), f_modo1(W, 1.5)
            f3 = f_modo3(Deq, 3e-3, 1.0) if tot else float("nan")
            print(f"  {I:4d} {v*1e3:6.0f} {T0:5.0f} | {P:5.0f} {L*1e3:5.1f} {W*1e3:5.2f} {prof*1e3:7.2f} {'SI' if tot else 'no':>5} {Wb*1e3:6.2f} | {f1a:12.0f} {f1b:5.0f} {f3:7.0f}")
print("  (f modo1 con D = ancho W, como Hermans 1999; si TOTAL, el charco suena en modo 3 ~3-6x mas bajo y 2.5x mas fuerte)")

print()
print("  B2. PARED de una gota (ancho w), Rosenthal 2D, P = 0.8*18*50 = 720 W, v = 6 mm/s: largo, profundidad, y los modos posibles")
print(f"  {'w mm':>5} {'T0 C':>5} | {'L mm':>5} {'prof':>5} | {'m1 D=w':>7} {'m1 Deq':>7} {'m2 Deq':>7} {'slosh L':>8} {'sesil l2':>8}   (Hz, gam=1.5; Deq=sqrt(w L))")
pared = {}
for w in (2.5e-3, 3e-3, 4e-3):
    for T0 in (25.0, 200.0, 400.0, 600.0):
        r = charco_pared(720.0, 6e-3, T0, w)
        L, prof, adel = r; pared[(w, T0)] = r
        Deq = math.sqrt(w * L)
        kL = math.pi / L
        print(f"  {w*1e3:5.1f} {T0:5.0f} | {L*1e3:5.1f} {prof*1e3:5.2f} | {f_modo1(w):7.0f} {f_modo1(Deq):7.0f} {f_modo2(Deq):7.0f} {f_capgrav(kL, prof):8.0f} {f_sesil_l2(w/2):8.0f}")
print("  -> la pared NO tiene una sola frecuencia candidata: 15-500 Hz segun que modo se excite (INCIERTO; lo decide la medicion)")

# =====================================================================================
hdr("C. MODOS DEL CHARCO vs TAMANO: frecuencia, Q (cota fisica), timbre, voltaje")
print(f"  {'D mm':>5} | {'m1 g1.0':>7} {'m1 g1.5':>7} {'m2 g1.5':>7} {'m3 H=3':>7} | {'Q Lamb':>6} {'Q pared':>7} {'Q cota':>6} {'tau ms (Q=10)':>13}")
for Dmm in (2, 3, 4, 5, 6, 8):
    D = Dmm * 1e-3
    f1 = f_modo1(D); w = 2 * math.pi * f1; k = 11.04 / D
    g_b = 2 * NU * k * k                       # Lamb, superficie libre
    g_w = math.sqrt(NU * w / 2) / (D / 2)      # capa limite en la pared del recipiente (orden de magnitud)
    Ql, Qw = w / (2 * g_b), w / (2 * g_w)
    Qc = w / (2 * (g_b + g_w))
    print(f"  {Dmm:5d} | {f_modo1(D,1.0):7.0f} {f1:7.0f} {f_modo2(D):7.0f} {f_modo3(D,3e-3):7.0f} | {Ql:6.0f} {Qw:7.0f} {Qc:6.0f} {10/(math.pi*f1)*1e3:13.1f}")
print("  Q cota = solo viscosidad (superficie + paredes). Lo real es MENOR: zona pastosa, Marangoni, escoria del fundente,")
print("  linea de contacto. Kotecki: 'cada perturbacion deja unas pocas ondas antes de apagarse'. Se usa Q=10 (rango 3-30). SUPUESTO.")
print("  Voltaje por amplitud de superficie A (bajo la punta):")
for A in (10e-6, 30e-6, 100e-6, 300e-6):
    print(f"      A = {A*1e6:4.0f} um  ->  {KV*A*1e3*1000:6.0f} mV con 10 V/mm (canon)   {KV_LIT*A*1e3*1000:5.0f} mV con 1.5 V/mm   = {KV*A*1e3/16/3.3*4096:5.1f} cuentas ADC (/16)")

# =====================================================================================
hdr("D. CUANTO PATEA CADA GOTA AL CHARCO (cordon en placa, 50 A, 6 mm/s, T0 25 C)")
L, W, prof, tot, Wb = placa[(50, 6e-3, 25.0)]
S = math.pi * W * L / 4
fp = f_modo1(W); wp = 2 * math.pi * fp; kp = 11.04 / W
PSI2 = 0.25                               # <psi^2> de la forma del modo (supuesto)
m_eff = RHO * PSI2 * S / kp               # masa modal de onda capilar profunda: rho <psi^2> S / k
k_eff = m_eff * wp * wp
m_d = RHO * 4 / 3 * math.pi * A_GOTA ** 3
Vd = 4 / 3 * math.pi * A_GOTA ** 3
print(f"  charco: L={L*1e3:.1f} mm W={W*1e3:.2f} mm area={S*1e6:.1f} mm2  f_modo1={fp:.0f} Hz  m_eff={m_eff*1e6:.1f} mg  k_eff={k_eff:.1f} N/m")
print(f"  gota: a=0.46 mm  masa {m_d*1e6:.2f} mg  volumen {Vd*1e9:.3f} mm3 (= {m_d/m_eff*100:.0f} % de la masa modal)")
A_vol = Vd / (PSI2 * S)
print(f"  (a) volumen nuevo proyectado en el modo (cota superior): {A_vol*1e6:5.0f} um")
for vd in (0.3, 0.6, 1.0):
    p = m_d * vd
    A_mom = p / (m_eff * wp)
    We = RHO * vd * vd * 2 * A_GOTA / SIG; Re = RHO * vd * 2 * A_GOTA / MU
    Ks = math.sqrt(We) * Re ** 0.25
    print(f"  (b) impacto a {vd:.1f} m/s: impulso {p*1e6:.2f} mg m/s -> {A_mom*1e6:5.0f} um = {KV*A_mom*1e6:5.0f} mV   | We={We:4.1f} Re={Re:4.0f} K=We^.5 Re^.25={Ks:4.1f}")
for I0, I1 in ((40.0, 30.0), (50.0, 30.0)):
    F0 = MU0 * I0 ** 2 / (8 * math.pi)
    dF = MU0 * (I1 ** 2 / 2) / (8 * math.pi)
    print(f"  (c) sobre de I^2 en la rafaga ({I0:.0f} A + {I1:.0f} A ac): fuerza del arco {F0*1e6:.0f} uN, escalon {dF*1e6:.0f} uN"
          f" -> hundimiento estatico {dF/k_eff*1e6:.1f} um (x Q si cae en resonancia)")
print(f"  comparacion: flujo de momento de las gotas a 75/s y 0.6 m/s = {m_d*0.6*75*1e6:.0f} uN promedio, en golpes")
print("  -> salpicadura por IMPACTO: K~3-8 << ~2000 (umbral de corona/salpicadura en charco, dato de memoria) -> NO hay")
A1_NOM = 60e-6
print(f"  -> amplitud por gota que se usa abajo: {A1_NOM*1e6:.0f} um (rango 20-200 um; el modelo lineal se rompe: la gota es ~70 % de la masa modal)")
print(f"     = {KV*A1_NOM*1e6:.0f} mV con 10 V/mm, {KV_LIT*A1_NOM*1e6:.0f} mV con 1.5 V/mm. Literatura: ~100 um tras pulsos fuertes (Xiao), ~0.4 mm p-p (Renwick)")

# =====================================================================================
hdr("E. SINCRONIZAR LA GOTA CON LA FASE DEL CHARCO")
print("  E1. tren de golpes iguales: amplitud estacionaria tras cada golpe = A1/|1 - r e^{i theta}|, r=exp(-pi fp/(Q fd)), theta=2pi fp/fd")
print(f"  {'fp/fd':>6} | {'Q=3':>6} {'Q=10':>6} {'Q=30':>6}   (en unidades de A1, la patada de una gota)")
for ratio in (2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 4.0, 4.5):
    row = []
    for Q in (3, 10, 30):
        rr = math.exp(-math.pi * ratio / Q)
        row.append(1 / abs(1 - rr * complex(math.cos(2 * math.pi * ratio), math.sin(2 * math.pi * ratio))))
    print(f"  {ratio:6.2f} | {row[0]:6.2f} {row[1]:6.2f} {row[2]:6.2f}")
print("  -> entero = bombeo (como Hermans en corto circuito, donde SI lo quieren); entero+1/2 = cada gota frena al charco")

def sim_sincronia(fp, Qp, fd, modo, A1=A1_NOM, t_f=1.0e-3, ndrop=300, sig_t=0.1e-3, seed=1):
    """oscilador del charco z (m, + = hacia el alambre). Golpe hacia abajo de Delta v = A1*wp al aterrizar.
       modo 'libre': soltar cada 1/fd. modo 'fase': soltar dentro de +-Tp/2 del nominal donde el charco esta en VALLE
       (z minimo previsto), aterriza t_f despues. Devuelve RMS de z, cresta en el instante de soltar, dispersion de volumen."""
    rng = np.random.default_rng(seed)
    wp = 2 * math.pi * fp; g = wp / (2 * Qp); wd = math.sqrt(wp * wp - g * g)
    def evol(z, v, t):
        e = math.exp(-g * t); c, s = math.cos(wd * t), math.sin(wd * t)
        z2 = e * (z * c + (v + g * z) / wd * s)
        v2 = e * (v * c - (wp * wp * z + g * v) / wd * s)
        return z2, v2
    z = v = 0.0; t = 0.0; Td = 1 / fd; Tp = 1 / fp
    crest, vols, zs = [], [], []
    t_last = 0.0
    for k in range(ndrop):
        t_nom = t_last + Td
        if modo == "fase":
            cand = np.linspace(t_nom - Tp / 2, t_nom + Tp / 2, 81)
            zc = [evol(z, v, tc - t)[0] for tc in cand]
            t_rel = cand[int(np.argmin(zc))]
        else:
            t_rel = t_nom
        t_rel += sig_t * rng.standard_normal()
        # muestreo de z entre t y t_rel para RMS
        for tt in np.linspace(t, t_rel, 12, endpoint=False):
            zs.append(evol(z, v, tt - t)[0])
        zr, vr = evol(z, v, t_rel - t)
        crest.append(zr)                         # altura del charco cuando la gota se suelta (mas alto = menos hueco)
        vols.append(t_rel - t_last); t_last = t_rel
        z, v = evol(zr, vr, t_f)                 # vuelo
        v -= A1 * wp                             # aterriza: patada hacia abajo
        t = t_rel + t_f
    zs = np.array(zs[len(zs) // 3:]); crest = np.array(crest[ndrop // 3:]); vols = np.array(vols[ndrop // 3:])
    return zs.std(), crest.max(), crest.mean(), vols.std() / vols.mean()

print()
print("  E2. simulacion: charco Q=10, A1=60 um, vuelo 1 ms, jitter de disparo 0.1 ms. 'cresta al soltar' = cuanto sube el charco")
print("      hacia la gota colgada justo cuando la gota esta mas estirada (q=1, punta 0.46 mm abajo): eso se come el hueco del arco.")
print(f"  {'fp Hz':>5} {'fd /s':>5} {'fp/fd':>5} {'modo':>6} | {'RMS z um':>8} {'cresta max um':>13} {'cresta media':>12} | {'disp. volumen gota':>18}")
for fp_, fd_ in ((225.0, 75.0), (262.5, 75.0), (300.0, 75.0), (187.5, 75.0), (150.0, 60.0)):
    for modo in ("libre", "fase"):
        rms, cmax, cmean, dv = sim_sincronia(fp_, 10.0, fd_, modo)
        print(f"  {fp_:5.1f} {fd_:5.0f} {fp_/fd_:5.2f} {modo:>6} | {rms*1e6:8.1f} {cmax*1e6:13.1f} {cmean*1e6:12.1f} | {dv*100:16.1f} %")
for Qp in (3.0, 30.0):
    for modo in ("libre", "fase"):
        rms, cmax, cmean, dv = sim_sincronia(225.0, Qp, 75.0, modo)
        print(f"  Q={Qp:2.0f} fp 225 fd 75 {modo:>6} | RMS {rms*1e6:6.1f} um  cresta max {cmax*1e6:6.1f} um  media {cmean*1e6:6.1f} um | vol {dv*100:4.1f} %")
print()
print("  E3. hueco del arco que hace falta para NO hacer corto en el instante de soltar: L0 > q*a + cresta")
for cm in (0.0, 20e-6, 60e-6, 120e-6):
    L0 = 0.46e-3 + cm
    print(f"      cresta {cm*1e6:4.0f} um -> L0 > {L0*1e3:.2f} mm -> V_arco > {14+KV*L0*1e3:4.1f} V (con 10 V/mm)")
print("  -> soltar en el VALLE gana 2*A de hueco; aterrizar ~1/4 de periodo despues = cuando el charco SUBE = la gota lo frena.")

# =====================================================================================
hdr("F. EL CHARCO COMO SENSOR")
print("  F1. ancho: parcial f ~ D^-3/2 -> dD/D = -(2/3) df/f ; total f ~ Deq^-1 -> dDeq/Deq = -df/f")
print("      gam desconocida +-20 % -> D absoluto +-7 % (hay que calibrar con un cordon medido); la TENDENCIA no depende de gam")
print("  F2. temperatura de la pieza T0 (Rosenthal) -> f del charco")
print(f"  {'caso':>34} | {'T0=25':>6} {'200':>6} {'400':>6} | {'%/100K':>7}")
for (I, v) in ((50, 6e-3), (40, 6e-3)):
    fs = []
    for T0 in (25.0, 200.0, 400.0):
        L, W, prof, tot, Wb = placa[(I, v, T0)]
        fs.append(f_modo3(math.sqrt(L * W), 3e-3) if tot else f_modo1(W))
    print(f"  {'placa 3mm '+str(I)+' A 6 mm/s (W, modo1/3)':>34} | {fs[0]:6.0f} {fs[1]:6.0f} {fs[2]:6.0f} | {(fs[1]/fs[0]-1)/1.75*100:7.1f}")
for w in (3e-3,):
    for etiqueta, fun in (("pared 3mm modo1 Deq", lambda L: f_modo1(math.sqrt(w * L))), ("pared 3mm slosh largo", lambda L: f_capgrav(math.pi / L, 1.4e-3))):
        fs = [fun(pared[(w, T0)][0]) for T0 in (25.0, 200.0, 400.0)]
        print(f"  {etiqueta:>34} | {fs[0]:6.0f} {fs[1]:6.0f} {fs[2]:6.0f} | {(fs[1]/fs[0]-1)/1.75*100:7.1f}")
print("      (pared: L crece mucho con T0 -> la f del charco es un termometro de entrecapa; confusor: gam(T) ~ -0.4 mN/m/K de memoria)")
print("  F3. penetracion: parcial->total cae la f 3-5x y la amplitud sube ~2.5x (Xiao 1990/1993). Es una bandera, no una medida fina.")
print("  F4. altura de capa: la da el DC del arco (10 V/mm -> 0.1 mm = 1 V), NO la f del charco. La f da ancho -> altura por balance")
print("      de masa h = Vdot/(v w).  Ej: 25 mm3/s, 6 mm/s, w=3.0 mm -> h = %.2f mm; si w se lee 3.0+-0.06 mm -> h +-%.0f um" %
      (25e-9 / (6e-3 * 3e-3) * 1e3, 25e-9 / (6e-3 * 3e-3) * 0.02 * 1e6))

# =====================================================================================
hdr("G. DOS CAMPANAS EN EL MISMO CABLE")
# ---------- G3 primero (es tabla) ----------
print("  G3. el actuador I^2 mezcla: I = I0 + I1 cos(w2 t) + Ip cos(wp t)  (I0 40 A, I1 30 A a f2=668 Hz, Ip 5 A a fp=250 Hz)")
I0, I1, Ip = 40.0, 30.0, 5.0
f2n, fpn, Q2, Qpn = f2_gota(A_GOTA), 250.0, 30.0, 10.0
def gan(f, f0, Q):
    x = f / f0
    return 1 / math.sqrt((1 - x * x) ** 2 + (x / Q) ** 2)
terms = [("DC", 0.0, I0 ** 2 + I1 ** 2 / 2 + Ip ** 2 / 2), ("2 I0 I1 @f2", f2n, 2 * I0 * I1), ("2 I0 Ip @fp", fpn, 2 * I0 * Ip),
         ("I1^2/2 @2f2", 2 * f2n, I1 ** 2 / 2), ("Ip^2/2 @2fp", 2 * fpn, Ip ** 2 / 2), ("I1 Ip @f2-fp", f2n - fpn, I1 * Ip), ("I1 Ip @f2+fp", f2n + fpn, I1 * Ip)]
print(f"  {'termino':>14} {'f Hz':>7} {'A^2':>7} | {'gota (x Q2=30)':>14} {'charco (x Qp=10)':>16}")
for nm, f, amp in terms:
    print(f"  {nm:>14} {f:7.0f} {amp:7.0f} | {amp*gan(f,f2n,Q2):14.0f} {amp*gan(f,fpn,Qpn):16.0f}")
print("  -> cada campana tiene su canal en el actuador: 2 I0 I1 solo la gota, 2 I0 Ip solo el charco; los cruces caen fuera de resonancia")
dFp = MU0 * (2 * I0 * Ip) / (8 * math.pi)
print(f"  vaiven propio para el charco (Ip=5 A a fp, I0=40 A): fuerza {dFp*1e6:.0f} uN -> {dFp/k_eff*1e6:.2f} um estatico x Q=10 = {dFp/k_eff*10*1e6:.1f} um"
      f"  vs patada de una gota {A1_NOM*1e6:.0f} um -> no hace falta: la gota es el martillo")

# ---------- G1: el oido del canon con el charco sonando ----------
def simulate_oido(Q_fixed, pool_mm, f_pool, hp_sos, n, seed, veto_hz=None, a_seed=0.30e-3, a_target=0.46e-3, vf0=0.010, I0=40.0, I1=30.0,
                  ncyc=8, noise_v=0.010, dt=5e-6):
    """COPIA del modo 'oido' de scripts/canon/canon_gota.py (misma logica) + un tono del charco en el voltaje
       y opcionalmente un pasa-altos causal (secciones biquad) ANTES del lock-in."""
    rng = np.random.default_rng(seed)
    sizes = []
    V_seed = 4 / 3 * math.pi * a_seed ** 3; V_tgt = 4 / 3 * math.pi * a_target ** 3
    tau_li = 0.0006
    for k in range(n):
        vf = vf0 * (1 + 0.10 * rng.standard_normal())
        ph_pool = rng.uniform(0, 2 * math.pi)
        Vol = V_seed; q = v = 0.0; t = 0.0; ph = 0.0; firing = False
        ping_t0 = 0.002; ping_end = ping_t0 + 0.0008; listen_end = ping_end + 0.0032
        X = Y = 0.0; phs = []; obs = []
        fitV0, fitR = V_seed, AW * vf0
        zi = None if hp_sos is None else [[0.0, 0.0] for _ in range(len(hp_sos))]
        while t < 0.12:
            a = (3 * Vol / (4 * math.pi)) ** (1 / 3)
            W = math.sqrt(8 * SIG / (RHO * a ** 3)); Q = (W * a * a / (10 * NU)) if Q_fixed is None else Q_fixed; g = W / Q
            Vmod = fitV0 + fitR * t
            amod = (3 * max(Vmod, V_seed * 0.5) / (4 * math.pi)) ** (1 / 3)
            Wmod = math.sqrt(8 * SIG / (RHO * amod ** 3))
            I = I0
            if not firing:
                T_fire = ncyc * 2 * math.pi / Wmod
                if fitV0 + fitR * (t + 0.6 * T_fire) >= V_tgt and len(obs) >= 3:
                    firing = True
                if ping_t0 <= t < ping_end:
                    I = I0 + 10.0 * math.cos(ph)
            if firing:
                I = I0 + I1 * math.cos(ph)
            ph += Wmod * dt
            acc = W * W * ((I / ICRIT) ** 2 - (I0 / ICRIT) ** 2) - g * v - W * W * q
            v += acc * dt; q += v * dt
            Vol += AW * vf * dt; t += dt
            if not firing:
                y = KV * q * a * 1e3 + KV * pool_mm * math.cos(2 * math.pi * f_pool * t + ph_pool) + noise_v * rng.standard_normal()
                if hp_sos is not None:
                    for si, sec in enumerate(hp_sos):
                        b0, b1, b2, _, a1, a2 = sec; s = zi[si]
                        out = b0 * y + s[0]
                        s[0] = b1 * y - a1 * out + s[1]
                        s[1] = b2 * y - a2 * out
                        y = out
                X += (y * math.cos(ph) - X) * dt / tau_li; Y += (y * math.sin(ph) - Y) * dt / tau_li
                if ping_end + 0.0004 <= t < listen_end:
                    phs.append((t, math.atan2(Y, X)))
                elif t >= listen_end and phs:
                    tt = np.array([p[0] for p in phs]); pp = np.unwrap(np.array([p[1] for p in phs]))
                    slope = np.polyfit(tt, pp, 1)[0]
                    tm = tt.mean(); Vm = fitV0 + fitR * tm
                    am = (3 * Vm / (4 * math.pi)) ** (1 / 3); Wm = math.sqrt(8 * SIG / (RHO * am ** 3))
                    W_est = Wm - slope
                    if W_est <= 0: W_est = Wm
                    a_e = (8 * SIG / (RHO * W_est ** 2)) ** (1 / 3)
                    if veto_hz is None or abs(Wm / (2 * math.pi) - f_pool) >= veto_hz:
                        obs.append((tm, 4 / 3 * math.pi * a_e ** 3))
                    phs = []
                    if len(obs) >= 3:
                        o = np.array(obs[-8:]); sol = np.polyfit(o[:, 0], o[:, 1], 1)
                        fitR, fitV0 = float(max(sol[0], 1e-13)), float(sol[1])
                    ping_t0 = t + 0.0002; ping_end = ping_t0 + 0.0008; listen_end = ping_end + 0.0032
            if q >= 1.0:
                sizes.append(a); break
        else:
            sizes.append(float("nan"))
    return np.array(sizes)

print()
print("  G1. el OIDO del canon (lock-in tau 0.6 ms, ping 10 A) con el charco sonando a 250 Hz en el mismo voltaje. Q gota = 30,")
print("      ruido 10 mV, 40 gotas por caso. 'HP' = pasa-altos Butterworth 4o orden a 450 Hz, causal, antes del lock-in.")
hp = signal.butter(4, 450.0, btype="highpass", fs=1 / 5e-6, output="sos")
w_, h_ = signal.sosfreqz(hp, worN=[250.0, 450.0, 668.0, 1268.0], fs=1 / 5e-6)
print("      ganancia del HP: " + "  ".join(f"{ff:.0f} Hz {abs(hh):.3f}" for ff, hh in zip(w_, h_)))
print(f"  {'charco':>22} {'filtro':>9} | {'sueltan':>7} {'tamano mm':>9} {'disp um':>7} {'error um':>8}")
casos = [(0.0, 250.0, None, None, "--"), (0.03, 250.0, None, None, "--"), (0.03, 250.0, hp, None, "HP"),
         (0.10, 250.0, None, None, "--"), (0.10, 250.0, hp, None, "HP"),
         (0.03, 550.0, hp, None, "HP"), (0.03, 550.0, hp, 200.0, "HP+veto"), (0.10, 550.0, hp, 200.0, "HP+veto"),
         (0.010, 550.0, hp, None, "HP"), (0.003, 550.0, hp, None, "HP")]
for pool_mm, fpool, filt, veto, nomf in casos:
    r = simulate_oido(30, pool_mm, fpool, filt, n=40, seed=11, veto_hz=veto)
    ok = np.isfinite(r); rr = r[ok] * 1e3
    lab = f"{pool_mm*1e3:3.0f} um {KV*pool_mm*1e3:4.0f} mV @{fpool:3.0f} Hz"
    if ok.any():
        print(f"  {lab:>22} {nomf:>9} | {ok.mean()*100:6.1f}% {rr.mean():9.3f} {rr.std()*1000:7.1f} {(rr.mean()-0.46)*1000:+8.1f}")
    else:
        print(f"  {lab:>22} {nomf:>9} | ninguna se suelta")
print("  veto = el oido descarta las ventanas donde la f del modelo de la gota esta a <200 Hz de la f del charco (la conoce por G2)")
print("  10 um y 3 um @550 = lo que queda si se RESTA el charco con el modelo de G2 (error de f ~1 % y de amplitud ~10 % -> ~10-15 %")
print("  del tono). Limite de fondo: ventana de escucha de 3 ms -> no separa tonos a menos de ~1/3ms = 330 Hz (df*T >= 1).")

# ---------- G2: estimar f del charco con la gota sonando encima ----------
FS2 = 20000.0
DEC = 5                                   # se ajusta a 4 kS/s tras el pasa-bajos
LPF2 = signal.butter(4, 800.0, fs=FS2, output="sos")
SENS_T0 = 0.00078                         # 1/K, de F2 (placa 50 A 6 mm/s): -7.8 % por 100 K

def sintetico(fp, Qp, fd, noise, A1=A1_NOM, ncyc=17, seed=0, a_s=0.25e-3, a_t=0.46e-3, t_f=1.0e-3, z_burst=-1e-6):
    """V(t) = 14 + KV*hueco. El hueco baja cuando la gota crece (2 da), cuando su punta baja (q a) y cuando el charco sube (z).
       Ciclo k = [k Td, (k+1) Td): la gota crece a caudal constante de 0.25 a 0.46 mm; rafaga de 6 ciclos a f2 propia
       (envolvente que sube, fase que deriva 0.3 rad); se suelta en (k+1) Td, vuela t_f, golpea el charco (Delta v = -A1 wp,
       la patada exacta varia +-20 % gota a gota). La gota nueva timbra a f2(0.25 mm)=1.66 kHz (q0 0.15, Q 30): NO va en el
       estimador. Rafaga = escalon de presion (z_burst estatico). Ruido blanco."""
    rng = np.random.default_rng(seed)
    Td = 1 / fd; n = int(ncyc * Td * FS2); t = np.arange(n) / FS2
    Vs, Vt = 4 / 3 * math.pi * a_s ** 3, 4 / 3 * math.pi * a_t ** 3
    tc = t % Td
    a = ((Vs + (Vt - Vs) * tc / Td) * 3 / (4 * math.pi)) ** (1 / 3)
    f2 = np.sqrt(8 * SIG / (RHO * a ** 3)) / (2 * math.pi)
    Tfire = 6 / f2_gota(a_t); t_f0 = Td - Tfire
    ph = 2 * math.pi * np.cumsum(f2) / FS2               # fase del excitador: el firmware la conoce
    firing = tc >= t_f0
    env = np.where(firing, (tc - t_f0) / Tfire, 0.0)
    q = env * np.cos(ph + 0.3 * env)
    w0 = 2 * math.pi * f2_gota(a_s)
    q = q + 0.15 * np.exp(-w0 * tc / (2 * 30)) * np.cos(w0 * tc)
    wp = 2 * math.pi * fp; gq = wp / (2 * Qp)
    Am = np.array([[0, 1], [-wp * wp, -2 * gq]]); Ph = linalg.expm(Am / FS2)
    Bm = np.linalg.solve(Am, (Ph - np.eye(2)) @ np.array([0.0, 1.0]))
    imp = {int(round(((k + 1) * Td + t_f) * FS2)): A1 * (1 + 0.2 * rng.standard_normal()) for k in range(ncyc)}
    st = np.zeros(2); z = np.zeros(n)
    for i in range(n):
        if i in imp: st[1] -= imp[i] * wp
        u = wp * wp * z_burst if firing[i] else 0.0
        st = Ph @ st + Bm * u
        z[i] = st[0]
    hueco = -2 * (a - a_s) - q * a - z
    V = 14 + KV * 1e3 * (0.5e-3 + hueco) + noise * rng.standard_normal(n)
    return t, V, z, dict(Td=Td, t_f0=t_f0, t_f=t_f, ph=ph, firing=firing)

def estimar_fp(t, V, info, k0, NW=5, fgrid=np.arange(80.0, 800.0, 5.0), Qs=(5.0, 10.0, 20.0)):
    """Ventana de NW ciclos de gota. Modelo lineal en amplitudes: por ciclo, diente de sierra (poly 3) + portadora del
       excitador (cos/sin de la fase CONOCIDA x poly 2, solo en rafaga); charco = oscilador (f, Q) con estado inicial libre,
       una patada de tamano libre en cada aterrizaje (instantes conocidos) y un escalon por rafaga. Todas las columnas pasan
       por el MISMO pasa-bajos causal que la senal (800 Hz, 4o orden), se descartan 3 ms y se decima a 4 kS/s.
       (f, Q) por rejilla + afinado; amplitudes por minimos cuadrados (proyeccion)."""
    Td, t_f0, t_f = info["Td"], info["t_f0"], info["t_f"]
    ts = k0 * Td; te = (k0 + NW) * Td
    sel = (t >= ts) & (t < te); tt = t[sel] - ts
    yfull = signal.sosfilt(LPF2, V)[sel]
    keep = np.zeros(tt.size, bool); keep[int(3e-3 * FS2)::DEC] = True
    y = yfull[keep]
    ph = info["ph"][sel]; fir = info["firing"][sel].astype(float)
    cols = []
    for j in range(NW):
        m = ((tt >= j * Td) & (tt < (j + 1) * Td)).astype(float); tau = tt - j * Td
        cols += [m * tau ** p for p in range(4)]
        cols += [m * fir * np.cos(ph) * tau ** p for p in range(3)] + [m * fir * np.sin(ph) * tau ** p for p in range(3)]
    B0 = signal.sosfilt(LPF2, np.array(cols).T, axis=0)[keep]
    Qf, _ = np.linalg.qr(B0)
    yp = y - Qf @ (Qf.T @ y)
    t_imp = [(j + 1) * Td + t_f - Td for j in range(NW)]          # aterrizajes dentro de la ventana (relativo a ts)
    t_imp = [x for x in t_imp if 0 < x < te - ts]
    t_b = [j * Td + t_f0 for j in range(NW)]; t_e = [(j + 1) * Td for j in range(NW)]
    def cols_charco(f, Q):
        w = 2 * math.pi * f; g = w / (2 * Q); wd = math.sqrt(max(w * w - g * g, 1.0))
        c = [np.exp(-g * tt) * np.cos(wd * tt), np.exp(-g * tt) * np.sin(wd * tt)]
        for ti in t_imp:
            d = np.clip(tt - ti, 0, None); c.append((tt >= ti) * np.exp(-g * d) * np.sin(wd * d))
        def paso(t0):
            d = np.clip(tt - t0, 0, None)
            return (tt >= t0) * (1 - np.exp(-g * d) * (np.cos(wd * d) + g / wd * np.sin(wd * d)))
        for tb, tend in zip(t_b, t_e):
            c.append(paso(tb) - paso(tend))
        P = signal.sosfilt(LPF2, np.array(c).T, axis=0)[keep]
        return P - Qf @ (Qf.T @ P)
    def resid(f, Q):
        P = cols_charco(f, Q)
        cc, *_ = np.linalg.lstsq(P, yp, rcond=None)
        return float(np.sum((yp - P @ cc) ** 2))
    best = min((resid(f, Q), f, Q) for f in fgrid for Q in Qs)
    fine = np.arange(best[1] - 3.0, best[1] + 3.0, 0.2)
    b2 = min((resid(f, best[2]), f) for f in fine)
    return b2[1], best[2]

print()
print("  G2. leer f del charco CON la gota sonando encima: rafagas de hasta 4.6 V a ~668-700 Hz, diente de sierra 4.2 V a 75/s,")
print("      gota nueva timbrando a 1.66 kHz. Charco Q=10, patada media 60 um (+-20 %). Ventanas de 5 gotas (67 ms).")
fd2 = 75.0
t_, V_, z_, inf_ = sintetico(250.0, 10.0, fd2, 0.03, seed=3)
fr, Pxx = signal.periodogram(V_ - V_.mean(), fs=FS2, scaling="spectrum")
print("      espectro crudo de V(t) con charco a 250 Hz (amplitud pico por banda, V):")
for lo, hi, nm in ((60, 90, "fd=75"), (140, 160, "2fd"), (215, 235, "3fd"), (240, 260, "charco 250"), (290, 310, "4fd"),
                   (600, 760, "gota f2 (rafaga)"), (1500, 1800, "gota nueva")):
    m = (fr >= lo) & (fr <= hi)
    print(f"        {nm:>18} {lo:5d}-{hi:<5d} Hz : {math.sqrt(2*Pxx[m].max()):.3f} V")
print(f"      el charco en el registro: {np.abs(z_).max()*1e6:.0f} um pico = {KV*np.abs(z_).max()*1e3:.2f} V; en el espectro apenas asoma")
print("      (el charco re-golpeado cada 13 ms NO es un tono: su energia se reparte en el peine de fd -> FFT ciega; Hermans 1999 tenia razon")
print("       para el voltaje crudo. Lo que lo salva: los instantes de golpe y la fase de la rafaga los pone el firmware.)")
print(f"  {'fp Hz':>5} {'ruido':>6} | {'n':>3} {'sesgo Hz':>8} {'disp Hz':>8} {'Q elegido':>9} | {'D +- um':>8} {'T0 +- K':>8}")
for fp_ in (150.0, 250.0, 400.0, 550.0):
    for nz in (0.03, 0.3):
        errs, qs = [], []
        for s in range(2):
            t_, V_, z_, inf_ = sintetico(fp_, 10.0, fd2, nz, seed=100 + s)
            for k0 in (1, 6, 11):
                fe, qe = estimar_fp(t_, V_, inf_, k0)
                errs.append(fe - fp_); qs.append(qe)
        errs = np.array(errs); sd = errs.std(); bias = np.median(errs)
        D = D_de_f_modo1(fp_)
        dD = (2 / 3) * math.hypot(sd, bias) / fp_ * D
        dT = (math.hypot(sd, bias) / fp_) / SENS_T0
        print(f"  {fp_:5.0f} {nz*1e3:4.0f}mV | {errs.size:3d} {bias:+8.2f} {sd:8.2f} {np.median(qs):9.0f} | {dD*1e6:8.1f} {dT:8.1f}")
print("      (D +- um con gam fija, modo 1; T0 +- K con 0.078 %/K de F2; error = raiz(sesgo^2 + disp^2) por ventana de 67 ms)")

# =====================================================================================
hdr("H. EL EXPERIMENTO BARATO: punto fijo en la placa de 3 mm sobre loseta, arco quieto, prediccion vs tiempo")
def punto(P, t, T0=25.0, H=3e-3, nimg=8):
    r = np.arange(0, 8e-3, 0.02e-3)
    def T(rr, z):
        s = 0.0
        for nn in range(-nimg, nimg + 1):
            R = np.sqrt(rr * rr + (z - 2 * nn * H) ** 2) + 1e-9
            s = s + special.erfc(R / math.sqrt(4 * ALPHA * t)) / R
        return T0 + P / (2 * math.pi * K_TH) * s
    top = T(r, 0.0) >= TM; bot = T(r, H) >= TM
    D_top = 2 * r[top].max() if top.any() else 0.0
    D_bot = 2 * r[bot].max() if bot.any() else 0.0
    zz = np.arange(0, H + 1e-9, 0.02e-3); dep = zz[T(0.0, zz) >= TM].max() if (T(0.0, zz) >= TM).any() else 0.0
    return D_top, dep, D_bot
print(f"  {'I A':>4} {'t s':>5} | {'D arriba mm':>11} {'prof mm':>7} {'D fondo mm':>10} | {'modo':>5} {'f g1.0 Hz':>9} {'f g1.5 Hz':>9} {'V pico (A=60um)':>15}")
for I in (40, 50):
    P = 0.8 * 18.0 * I
    for tt in (0.25, 0.5, 1.0, 2.0, 3.0, 4.0, 6.0):
        Dt, dep, Db = punto(P, tt)
        if Dt == 0: print(f"  {I:4d} {tt:5.2f} | sin charco"); continue
        if Db > 0.5 * 3e-3:     # Xiao 1993: cambio de modo cuando el fondo ~ H/2
            modo = "3"; fa, fb = f_modo3(0.5 * (Dt + Db), 3e-3, 1.0), f_modo3(0.5 * (Dt + Db), 3e-3, 1.5); amp = 2.5
        else:
            modo = "1"; fa, fb = f_modo1(Dt, 1.0), f_modo1(Dt, 1.5); amp = 1.0
        print(f"  {I:4d} {tt:5.2f} | {Dt*1e3:11.2f} {dep*1e3:7.2f} {Db*1e3:10.2f} | {modo:>5} {fa:9.0f} {fb:9.0f} {KV*A1_NOM*1e3*amp:12.2f} V")
print("  (amplitud del modo 3 x2.5 como en Xiao 1990; Rosenthal sobreestima cerca de la fuente: tiempos +-30 %)")
print()
print("FIN")
