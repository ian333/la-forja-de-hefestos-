#!/usr/bin/env python3
"""
03 · ¿Los gases salen ionizados y podemos hacer nuestra propia atmósfera con campos?
Investigación del arco, La Forja, 2026-11-05.  Alambre: Truper MICRO-1 E71T-GS 0.8 mm, sin gas, DCEN.

Reproduce TODOS los números del reporte docs/investigacion-arco/03-atmosfera-con-campos.md.
Corre en la laptop (numpy 2.2): python3 scripts/investigacion-arco/03_atmosfera_con_campos.py > ...out

Secciones
  1. Saha: fracción ionizada vs T para aire, aire+NO, vapor de Fe, nube de fundente; perfil radial.
  2. Recombinación / captura: tiempos a 1 atm vs tiempo de tránsito.
  3. Parámetro de Hall (electrones, iones), conductividad, número de Stuart: ¿confinar o empujar con B?
  4. Viento iónico (EHD): presión máx ½ε0E², velocidad, potencia, longitud de Debye.
  5. Bomba de Maecker: calibración con Mendez 2000, chorro a 20–130 A, arrastre de la columna,
     nube de fundente G, envolvente de protección L_max(I), formas de onda, constante de tiempo de la nube.
  6. Sieverts: nitrógeno de equilibrio vs fracción de aire.
  7. Campos sobre el arco: desvío por B transversal, campo propio, número de giro (swirl) con B axial.
  8. Gota: piel de difusión de N (lado).
  9. Capa sobre capa: Al acumulado por dilución.

Valores marcados [MEM] son de memoria (libro de texto), no verificados en línea; [SUP] son supuestos.
"""
import numpy as np

# ---------------------------------------------------------------- constantes
kB = 1.380649e-23
e = 1.602176634e-19
me = 9.1093837e-31
amu = 1.66053907e-27
eps0 = 8.8541878128e-12
mu0 = 4e-7 * np.pi
h = 6.62607015e-34
P_ATM = 101325.0
SAHA_C = (2 * np.pi * me * kB / h**2) ** 1.5   # 2.4147e21 m^-3 K^-3/2

def hr(t):
    print("\n" + "=" * 100 + "\n" + t + "\n" + "=" * 100)

# ======================================================================================
# 1. SAHA
# ======================================================================================
# (potencial de ionización eV, 2·U+/U0 aproximado [MEM: pesos del estado base / tablas de partición], masa amu)
ESP = {
    "N":  (14.534, 2 * 9 / 4, 14.0),
    "O":  (13.618, 2 * 4 / 9, 16.0),
    "NO": (9.264, 2 * 1 / 4, 30.0),     # molécula; razón de partición rotacional ~1 [SUP]
    "Fe": (7.902, 2 * 45 / 30, 55.85),  # U(FeI)~30, U(FeII)~45 a 6000–10000 K [MEM]
    "Mn": (7.434, 2 * 7 / 6, 54.94),
    "Mg": (7.646, 2 * 2 / 1, 24.31),
    "Al": (5.986, 2 * 1 / 6, 26.98),
    "Ca": (6.113, 2 * 2 / 1, 40.08),
    "Ba": (5.212, 2 * 2 / 1, 137.3),
    "Li": (5.392, 2 * 1 / 2, 6.94),
    "K":  (4.341, 2 * 1 / 2, 39.10),
    "F":  (17.423, 2 * 9 / 6, 19.0),
}

def x_NO_equilibrio(T):
    """N2 + O2 <-> 2 NO, K = 20·exp(-21700/T) (ΔH = 180.6 kJ/mol, ΔS ≈ 24.8 J/mol/K) [MEM]."""
    K = 20.0 * np.exp(-21700.0 / T)
    return np.sqrt(K * 0.79 * 0.21)

def saha_ne(T, comp, p=P_ATM):
    """Ionización simple, LTE, neutralidad n_e = Σ n_s+. comp = {especie: fracción molar de pesados}.
    Devuelve (n_e [m^-3], x_e = n_e / n_pesados, fracciones ionizadas por especie)."""
    ntot = p / (kB * T)
    S = {s: ESP[s][1] * SAHA_C * T**1.5 * np.exp(-ESP[s][0] * e / (kB * T)) for s in comp}
    lo, hi = 1.0, ntot
    for _ in range(200):                      # bisección en log
        ne = np.sqrt(lo * hi)
        nh = ntot - ne
        suma = sum(comp[s] * nh * S[s] / (S[s] + ne) for s in comp)
        if suma > ne:
            lo = ne
        else:
            hi = ne
    ne = np.sqrt(lo * hi)
    nh = ntot - ne
    alfa = {s: S[s] / (S[s] + ne) for s in comp}
    return ne, ne / nh, alfa

AIRE_AT = {"N": 0.79, "O": 0.21}
def aire_mol(T):
    return {"NO": x_NO_equilibrio(T), "N": 1e-12, "O": 1e-12}   # N2/O2 no ionizan a T<6000 K
FE = {"Fe": 1.0}
AIRE_FE = {"N": 0.78, "O": 0.21, "Fe": 0.01}
AIRE_K = {"N": 0.78, "O": 0.21, "K": 0.01}
# nube del fundente [SUP]: Fe + Mn del fleje, Mg/Al/Li/Ca del núcleo, F de los fluoruros
NUBE = {"Fe": 0.55, "Mn": 0.02, "Mg": 0.12, "Al": 0.04, "Li": 0.03, "Ca": 0.04, "F": 0.20}

hr("1. SAHA a 1 atm: fracción ionizada x_e = n_e/n_pesados (LTE, ionización simple)")
Ts = [2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000]
print(f"{'T [K]':>7} | {'aire atómico':>13} | {'aire mol+NO':>12} | {'x_NO eq':>8} | {'vapor Fe':>10} | "
      f"{'aire+1%Fe':>10} | {'aire+1%K':>10} | {'nube fundente':>13} | {'n_e nube [m^-3]':>15}")
for T in Ts:
    xa = saha_ne(T, AIRE_AT)[1]
    xm = saha_ne(T, aire_mol(T))[1] if T <= 5000 else float("nan")
    xf = saha_ne(T, FE)[1]
    xaf = saha_ne(T, AIRE_FE)[1]
    xak = saha_ne(T, AIRE_K)[1]
    ne_n, xn, _ = saha_ne(T, NUBE)
    print(f"{T:7d} | {xa:13.2e} | {xm:12.2e} | {x_NO_equilibrio(T):8.4f} | {xf:10.2e} | {xaf:10.2e} | "
          f"{xak:10.2e} | {xn:13.2e} | {ne_n:15.2e}")
print("nota: la nube ignora la captura de electrones por F (afinidad 3.4 eV), que BAJA n_e aún más.")

# perfil radial supuesto alrededor de un arco de ~40–60 A (no medido) [SUP]
hr("1b. Perfil radial supuesto T(r) y electrones disponibles fuera del canal conductor")
def T_perfil(r_mm, T0, w_mm, Tb, wb_mm):
    """núcleo gaussiano + halo exponencial (gas caliente que sale del arco)."""
    return 300 + (T0 - 300 - Tb) * np.exp(-(r_mm / w_mm) ** 2) + Tb * np.exp(-r_mm / wb_mm)

ESCENARIOS = {
    "estrecho (T0 9000 K, w 1.0 mm, halo 1500 K/2 mm)": (9000, 1.0, 1500, 2.0),
    "ancho    (T0 10000 K, w 1.5 mm, halo 2500 K/3 mm)": (10000, 1.5, 2500, 3.0),
}
r = np.linspace(0, 8, 1601)          # mm
dr = (r[1] - r[0]) * 1e-3
for nombre, par in ESCENARIOS.items():
    T = T_perfil(r, *par)
    ne = np.array([saha_ne(t, NUBE)[0] if t > 1200 else 0.0 for t in T])
    xe = np.array([saha_ne(t, NUBE)[1] if t > 1200 else 0.0 for t in T])
    print(f"\n  {nombre}")
    print(f"  {'r [mm]':>7} | {'T [K]':>7} | {'n_e [m^-3]':>11} | {'x_e':>9}")
    for rr in [0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0]:
        i = int(round(rr / 8 * 1600))
        print(f"  {rr:7.1f} | {T[i]:7.0f} | {ne[i]:11.2e} | {xe[i]:9.2e}")
    # canal conductor: x_e > 1e-3 (σ ~ 10^3 S/m)
    rc = r[np.where(xe > 1e-3)[0][-1]] if np.any(xe > 1e-3) else 0.0
    Nin = np.sum(ne[r <= rc] * 2 * np.pi * r[r <= rc] * 1e-3 * dr)
    Nout = np.sum(ne[r > rc] * 2 * np.pi * r[r > rc] * 1e-3 * dr)
    N3 = np.sum(ne[r > 3.0] * 2 * np.pi * r[r > 3.0] * 1e-3 * dr)
    print(f"  radio del canal conductor (x_e>1e-3): {rc:.2f} mm")
    print(f"  electrones por metro de columna: dentro {Nin:.2e} | fuera {Nout:.2e} | fuera de 3 mm {N3:.2e}")
    print(f"  fracción de los electrones que está FUERA del canal: {Nout/(Nin+Nout):.2e}; fuera de 3 mm: {N3/(Nin+Nout):.2e}")

# ======================================================================================
# 2. RECOMBINACIÓN Y CAPTURA A 1 ATM
# ======================================================================================
hr("2. Tiempos de vida de la carga a 1 atm (vs tránsito del gas)")
# tres cuerpos e-e-ion (NRL Plasma Formulary): 8.75e-27 Te^-4.5 cm^6/s = 8.75e-39 m^6/s
# radiativa: 2.7e-13 Te^-1/2 cm^3/s [MEM NRL]; disociativa NO+/O2+/N2+: ~4e-7 (300/T)^0.5 cm^3/s [MEM]
# captura por O2 en aire frío: 0.76e8 s^-1 (Dogariu, Shneider, Miles; Princeton); ion-ion: ~2e-6 cm^3/s [MEM]
def tau_3b(ne, T):
    TeV = kB * T / e
    return 1.0 / (8.75e-39 * TeV**-4.5 * ne**2)
def tau_rr(ne, T):
    TeV = kB * T / e
    return 1.0 / (2.7e-19 * TeV**-0.5 * ne)
def tau_dr(ne, T):
    return 1.0 / (4e-13 * np.sqrt(300.0 / T) * ne)

print(f"{'T [K]':>7} | {'n_e [m^-3]':>10} | {'τ 3cuerpos':>11} | {'τ radiativa':>11} | {'τ disociativa*':>14}")
for T in [10000, 7000, 5000, 3000, 2000]:
    for ne in [1e22, 1e20, 1e18, 1e16]:
        print(f"{T:7d} | {ne:10.0e} | {tau_3b(ne,T):11.2e} | {tau_rr(ne,T):11.2e} | {tau_dr(ne,T):14.2e}")
print("  * disociativa solo donde hay iones moleculares (NO+, O2+, N2+, aire < ~5000 K).")
print(f"  captura e + O2 en aire a 300 K: τ = 1/0.76e8 = {1/0.76e8*1e9:.1f} ns")
for ni in [1e16, 1e14, 1e12]:
    print(f"  recombinación ion-ion (β=2e-12 m^3/s) a n={ni:.0e} m^-3: τ = {1/(2e-12*ni):.2e} s")
for v in [10, 50]:
    for d in [1e-3, 3e-3]:
        print(f"  tránsito del gas: {d*1e3:.0f} mm a {v} m/s = {d/v*1e6:.0f} µs")
# densidad congelada: si sólo actuara 3 cuerpos (cota alta), τ_3b = τ_tr  ->  n_e*
for T in [5000, 3000]:
    for ttr in [20e-6, 300e-6]:
        TeV = kB * T / e
        ne_star = np.sqrt(1.0 / (8.75e-39 * TeV**-4.5 * ttr))
        print(f"  cota alta de ionización 'congelada' (solo 3 cuerpos) a {T} K, tránsito {ttr*1e6:.0f} µs: n_e* = {ne_star:.1e} m^-3"
              f"  -> con disociativa: τ = {tau_dr(ne_star,T)*1e9:.1f} ns")

# ======================================================================================
# 3. HALL, CONDUCTIVIDAD, STUART
# ======================================================================================
hr("3. Parámetro de Hall ω_c·τ a 1 atm, conductividad y B necesario para magnetizar")
sig_en = 1e-19      # m^2, sección eficaz e-neutro de transferencia de momento [MEM, orden]
sig_in = 7e-19      # m^2, ion-neutro (polarización + intercambio de carga) [MEM, orden]
def lnLambda(ne, T):
    TeV = kB * T / e
    return max(2.0, 23.0 - np.log(np.sqrt(ne * 1e-6) * TeV**-1.5))   # NRL, mínimo 2 en plasma denso
def nu_e(ne, T):
    nn = P_ATM / (kB * T) - ne
    vth = np.sqrt(8 * kB * T / (np.pi * me))
    nu_en = nn * sig_en * vth
    nu_ei = 2.91e-12 * ne * lnLambda(ne, T) * (kB * T / e) ** -1.5
    return nu_en, nu_ei
def nu_i(T, m_amu):
    nn = P_ATM / (kB * T)
    vrel = np.sqrt(8 * kB * T / (np.pi * m_amu * amu / 2))
    return nn * sig_in * vrel

print(f"{'T [K]':>6} | {'n_e (nube)':>10} | {'ν_en':>8} | {'ν_ei':>8} | {'σ [S/m]':>8} | "
      f"{'B(ωτ_e=1) [T]':>13} | {'B(ωτ_i=1) N+ [T]':>16} | {'B(ωτ_i=1) Fe+ [T]':>17}")
tabla3 = {}
for T in [2000, 3000, 4000, 6000, 8000, 10000]:
    ne = saha_ne(T, NUBE)[0]
    nen, nei = nu_e(ne, T)
    nue = nen + nei
    sigma = ne * e**2 / (me * nue)
    Be = nue * me / e
    Bi_N = nu_i(T, 14) * 14 * amu / e
    Bi_Fe = nu_i(T, 56) * 56 * amu / e
    tabla3[T] = (ne, sigma)
    print(f"{T:6d} | {ne:10.2e} | {nen:8.1e} | {nei:8.1e} | {sigma:8.2e} | {Be:13.3f} | {Bi_N:16.0f} | {Bi_Fe:17.0f}")
print("\n  ω_c·τ con imanes reales (electrones / iones Fe+), T = 6000 K:")
for B in [0.003, 0.03, 0.3, 1.0]:
    ne = saha_ne(6000, NUBE)[0]
    nue = sum(nu_e(ne, 6000))
    print(f"    B = {B:6.3f} T: ω_ce·τ = {e*B/me/nue:8.3f} | ω_ci·τ (Fe+) = {e*B/(56*amu)/nu_i(6000,56):.1e}")
print("\n  Número de Stuart N = σ B² L/(ρ u) para frenar con B el gas que entra (L 3 mm, u 5 m/s):")
for T, rho in [(2000, 0.17), (3000, 0.12), (4000, 0.09)]:
    ne, sigma = tabla3[T]
    for B in [0.1, 1.0]:
        N = sigma * B**2 * 3e-3 / (rho * 5)
        print(f"    T={T} K σ={sigma:.2e} S/m ρ={rho} kg/m³  B={B} T -> N = {N:.1e}  (hace falta N≳1)")
# fuerza de Lorentz dentro del propio arco con su campo propio, 40 A, R 1 mm
I, R = 40.0, 1e-3
jarc = I / (np.pi * R**2); Bself = mu0 * I / (2 * np.pi * R)
print(f"\n  arco 40 A, R=1 mm: j = {jarc:.2e} A/m², B propio en el borde = {Bself*1e3:.1f} mT, j·B = {jarc*Bself:.2e} N/m³")

# ======================================================================================
# 4. VIENTO IÓNICO (EHD)
# ======================================================================================
hr("4. Viento iónico: presión máxima ½ε0E² y velocidad; Debye")
rho_air = 1.2
print(f"{'E [MV/m]':>9} | {'p_EHD [Pa]':>10} | {'v_max [m/s]':>11}")
for E in [0.5, 1.0, 2.0, 3.0]:
    pE = 0.5 * eps0 * (E * 1e6) ** 2
    print(f"{E:9.1f} | {pE:10.2f} | {np.sqrt(2*pE/rho_air):11.2f}")
print("  (3 MV/m = ruptura del aire; corona real 1–5 m/s, eficiencia ~1 %; positivo más rápido, negativo ~10x más ozono)")
A_cort, v_cort = 30e-3 * 10e-3, 2.0
Pk = 0.5 * rho_air * v_cort**3 * A_cort
print(f"  cortina 30x10 mm a {v_cort} m/s: potencia cinética {Pk*1e3:.2f} mW -> eléctrica a 1 %: {Pk/0.01*1e3:.0f} mW")
print("  presión de la bomba propia del arco (sección 5): 40–400 Pa a 40 A -> la cortina (1–40 Pa) pierde por 10–100x")
for y in [10, 50]:
    print(f"  ozono de la corona [MEM: rendimiento {y} g/kWh] a {Pk/0.01*1e3:.0f} mW: {y*Pk/0.01/1000*1000:.1f} mg/h")
m_w = 0.85 * 7800 * np.pi * 0.4e-3**2 * 0.05
for fr in [0.01, 0.02]:
    print(f"  humo del propio alambre [MEM: FCAW-S genera ~{fr*100:.0f} % de la masa]: {m_w*fr*1e6:.1f} mg/s = {m_w*fr*3600*1e3:.1f} g/h  <- el riesgo real")
print("  longitud de Debye λ_D = 7430·sqrt(T_eV/n) m:")
for T, n in [(3000, 1e18), (3000, 1e16), (2000, 1e14), (2000, 1e12)]:
    print(f"    T={T} K n={n:.0e} m^-3 -> λ_D = {7430*np.sqrt(kB*T/e/n)*1e6:.1f} µm")

# ======================================================================================
# 5. BOMBA DE MAECKER Y ENVOLVENTE DE PROTECCIÓN
# ======================================================================================
hr("5. Bomba de Maecker: Δp = µ0·I·J/(4π), v = sqrt(2Δp/ρ), ṁ = c·ρ·v·πR²")
# calibración con Mendez (2000), Tabla 3: argón, cátodo W, 200 A, J_C = 6.5e7, ρ = 1.12e-2, V_ZS = 256 m/s
I_c, J_c, rho_c, v_num = 200.0, 6.5e7, 1.12e-2, 256.0
v_maecker = np.sqrt(mu0 * I_c * J_c / (2 * np.pi * rho_c))
CV = v_num / v_maecker
for (Ii, vv) in [(300.0, 353.0)]:
    v2 = np.sqrt(mu0 * Ii * J_c / (2 * np.pi * 9.97e-3))
print(f"  Mendez 200 A Ar: Maecker {v_maecker:.0f} m/s vs numérico 256 m/s -> factor c_v = {CV:.2f};"
      f" 300 A: Maecker {v2:.0f} vs 353 -> {353/v2:.2f}")

def maecker(I, J, rho):
    dp = mu0 * I * J / (4 * np.pi)
    v = CV * np.sqrt(2 * dp / rho)
    Rr = np.sqrt(I / (np.pi * J))
    mdot = rho * v * np.pi * Rr**2
    return dp, v, Rr, mdot

rho_pl = 0.04   # kg/m^3, plasma de vapor metálico + aire ~7000–9000 K [SUP] (Fe a 8000 K: 0.085; aire a 10000 K: 0.018)
mu_pl = 2e-4    # Pa·s [MEM orden]
print(f"\n  ρ_plasma = {rho_pl} kg/m³ [SUP], µ = {mu_pl} Pa·s; c_v = {CV:.2f}")
print(f"{'I [A]':>6} | {'J [A/m²]':>8} | {'R_raíz [mm]':>11} | {'Δp [Pa]':>8} | {'v [m/s]':>8} | {'ṁ_raíz [mg/s]':>13} | {'Re':>5} | {'t_resp [µs]':>11}")
for I in [20, 40, 60, 70, 100, 130]:
    for J in [1e7, 3e7, 1e8]:
        dp, v, Rr, md = maecker(I, J, rho_pl)
        Re = rho_pl * v * 2 * Rr / mu_pl
        print(f"{I:6d} | {J:8.0e} | {Rr*1e3:11.2f} | {dp:8.0f} | {v:8.1f} | {md*1e6:13.2f} | {Re:5.0f} | {Rr/v*1e6*2:11.1f}")
print("  (Re << 2000: chorro laminar; t_resp = 2R/v: el chorro sigue a la corriente hasta ~10 kHz)")

# arrastre lateral de la columna (chorro redondo laminar, Schlichting: ṁ(x) = 8π µ x)
hr("5b. Arrastre de la columna (chorro laminar: ṁ = 8π·µ_borde·L) y nube del fundente G")
for mu_e in [5e-5, 7e-5, 1e-4]:
    print(f"  µ_borde = {mu_e:.0e} Pa·s -> {8*np.pi*mu_e*1e-3*1e6:.2f} mg/s por mm de arco")
# nube de fundente: alambre 0.8 mm a 3 m/min con 40 A medios (canon)
d_w, vf0, I0 = 0.8e-3, 3.0 / 60, 40.0
A_w = np.pi * (d_w / 2) ** 2
m_wire = 0.85 * 7800 * A_w * vf0     # tubular: densidad efectiva ~85 % del acero [SUP]
print(f"  alambre: {A_w*vf0*1e9:.1f} mm³/s, masa {m_wire*1e3:.3f} g/s a 3 m/min (40 A medios)")
CASOS_G = {"bajo  (relleno 15 %, volátil 10 %)": (0.15, 0.10),
           "medio (relleno 20 %, volátil 20 %)": (0.20, 0.20),
           "alto  (relleno 25 %, volátil 30 %)": (0.25, 0.30)}
for k, (ff, fv) in CASOS_G.items():
    print(f"  G {k}: {m_wire*ff*fv*1e6:.2f} mg/s")

def G_flux(I_mean, ff=0.20, fv=0.20):
    return m_wire * (I_mean / I0) * ff * fv          # fusión ∝ corriente media [SUP: sin término I²R]

def toma_aire(I_t, L_mm, J=3e7, mu_e=7e-5, f_raiz=0.5):
    """aire que entra = f_raiz · <ṁ_raíz(I)> + ṁ_columna(L).  f_raiz = fracción de aire en la zona
    de succión de la raíz (junto a la punta del alambre, donde nace la nube) [SUP]."""
    md = np.mean([maecker(max(i, 1e-3), J, rho_pl)[3] for i in I_t])
    return f_raiz * md + 8 * np.pi * mu_e * L_mm * 1e-3, md

hr("5c. Envolvente de protección: toma de aire < G  ->  L_max(I)  (DC)")
print(f"{'I [A]':>6} | {'G medio [mg/s]':>14} | {'ṁ_raíz [mg/s]':>13} | {'L_max f=0.5 [mm]':>16} | {'L_max f=1 [mm]':>14} | "
      f"{'rango L_max (G bajo..alto, f 0.5) [mm]':>38}")
for I in [20, 30, 40, 50, 60, 80, 100]:
    G = G_flux(I)
    md = maecker(I, 3e7, rho_pl)[3]
    col = 8 * np.pi * 7e-5 * 1e-3
    L05 = (G - 0.5 * md) / col
    L1 = (G - md) / col
    Glo = G_flux(I, 0.15, 0.10); Ghi = G_flux(I, 0.25, 0.30)
    print(f"{I:6d} | {G*1e6:14.2f} | {md*1e6:13.2f} | {L05:16.2f} | {L1:14.2f} | "
          f"{(Glo-0.5*md)/col:17.2f} .. {(Ghi-0.5*md)/col:6.2f}")
# corriente de cruce I*: ṁ_raíz(I) = G(I)  (raíz ∝ I^1.5, G ∝ I)
Igrid = np.linspace(5, 400, 4000)
for ff, fv, nm in [(0.15, 0.10, "bajo"), (0.20, 0.20, "medio"), (0.25, 0.30, "alto")]:
    diff = np.array([maecker(i, 3e7, rho_pl)[3] - G_flux(i, ff, fv) for i in Igrid])
    idx = np.where(diff > 0)[0]
    Is = Igrid[idx[0]] if len(idx) else float("nan")
    print(f"  corriente de cruce I* (la raíz sola bombea más que lo que el fundente produce), G {nm}: {Is:.0f} A")
print("  voltaje según la ley de ian V = 14 + 10·L: L 0.5/1/2/3 mm = 19/24/34/44 V (si el gradiente real fuera ~2 V/mm: 15/16/18/20 V)")

hr("5d. Formas de onda con la MISMA corriente media (40 A, misma fusión, misma G)")
t = np.linspace(0, 1, 20000, endpoint=False)
ONDAS = {
    "DC 40 A":                         40 + 0 * t,
    "campanazo 40 + 30·sen (668 Hz)":  40 + 30 * np.sin(2 * np.pi * t),
    "pulso 70/10 A, 50 %":             np.where(t < 0.5, 70, 10),
    "pulso 130/10 A, 25 %":            np.where(t < 0.25, 130, 10),
    "pulso 190/10 A, 16.7 %":          np.where(t < 1 / 6, 190, 10),
    "DC 40 + 3 A de rizo (100 kHz)":   40 + 3 * np.sin(2 * np.pi * 50 * t),
}
base = None
print(f"{'onda':>32} | {'<I>':>5} | {'I_rms':>6} | {'<I²>/DC':>8} | {'<I^1.5>/DC':>10} | {'ṁ_raíz [mg/s]':>13} | "
      f"{'aire L=1 mm':>11} | {'aire L=2 mm':>11} | {'G/aire L=2':>10} | {'pico: aire/G L=2':>16}")
for k, It in ONDAS.items():
    a1, md = toma_aire(It, 1.0)
    a2, _ = toma_aire(It, 2.0)
    I15 = np.mean(np.abs(It) ** 1.5)
    if base is None:
        base = (np.mean(It**2), I15)
    G = G_flux(np.mean(It))
    print(f"{k:>32} | {np.mean(It):5.1f} | {np.sqrt(np.mean(It**2)):6.1f} | {np.mean(It**2)/base[0]:8.3f} | "
          f"{I15/base[1]:10.3f} | {md*1e6:13.2f} | {a1*1e6:11.2f} | {a2*1e6:11.2f} | {G/a2:10.2f} | "
          f"{toma_aire([np.max(It)], 2.0)[0]/G:16.2f}")
print("  'pico: aire/G' = toma de aire instantánea en el pico / producción media de la nube; >1 = en el pico entra aire")
print("\n  límites de la nube (G media vs G instantánea ∝ I del momento) y L máximo en el pico:")
print(f"  {'onda':>32} | {'pico/G_media L=2':>16} | {'pico/G_inst L=2':>15} | {'L_max pico, G media [mm]':>24} | {'L_max promedio [mm]':>19}")
col = 8 * np.pi * 7e-5 * 1e-3
for k, It in ONDAS.items():
    Ipk = np.max(It); G = G_flux(np.mean(It)); Gi = G_flux(Ipk)
    ap = toma_aire([Ipk], 2.0)[0]
    mdp = maecker(Ipk, 3e7, rho_pl)[3]
    mdm = np.mean([maecker(i, 3e7, rho_pl)[3] for i in It])
    Lpk = (G - 0.5 * mdp) / col
    Lav = (G - 0.5 * mdm) / col
    print(f"  {k:>32} | {ap/G:16.2f} | {ap/Gi:15.2f} | {Lpk:24.2f} | {Lav:19.2f}")
print("  la fusión de la punta (y su vapor) responde en ~ms (la punta avanza 0.05 mm/ms a 3 m/min, zona caliente ~0.4 mm"
      f" -> ~{0.4/0.05:.0f} ms) [SUP]; la bomba en ~10–100 µs. Entre los dos límites decide el banco.")
print("  (si la onda es más lenta que la nube, f << f_c de 5e, manda el pico; si es más rápida, manda el promedio)")

# la nube como filtro pasa-bajos
hr("5e. La nube del fundente como canal con su propia constante de tiempo")
V_nube = (3e-3) ** 3              # m^3, ~3 mm de lado [SUP]
for M_g, Tn in [(30, 2000), (30, 3000)]:
    rho_n = P_ATM * M_g * 1e-3 / (8.314 * Tn)
    for G in [G_flux(40, 0.15, 0.10), G_flux(40), G_flux(40, 0.25, 0.30)]:
        Q = G / rho_n
        tau = V_nube / Q
        print(f"  nube {M_g} g/mol a {Tn} K (ρ={rho_n:.3f}), G={G*1e6:.2f} mg/s: caudal {Q*6e4:.2f} L/min caliente, "
              f"τ_nube = {tau*1e3:.2f} ms -> f_c = {1/(2*np.pi*tau):.0f} Hz")
print("  regla: f_pulso >> f_c -> la nube promedia (importa <I^1.5>); f_pulso << f_c -> la nube 'respira' (aire en cada pico)")

# ======================================================================================
# 6. SIEVERTS
# ======================================================================================
hr("6. Nitrógeno de equilibrio en hierro líquido: [N] = 0.045 %·sqrt(p_N2/atm) (1600 °C)")
print(f"{'aire en la atmósfera del arco':>30} | {'p_N2 [atm]':>10} | {'[N] eq [% peso]':>15} | {'[N] eq [ppm]':>12}")
for xa in [1.0, 0.5, 0.25, 0.10, 0.05, 0.01]:
    pN2 = 0.79 * xa
    N = 0.045 * np.sqrt(pN2)
    print(f"{xa*100:29.0f}% | {pN2:10.3f} | {N:15.4f} | {N*1e4:12.0f}")
print("  Lincoln (US8759715, Fig. 29, NR-233): de 0.020 % (fondo de la curva) a 0.036 % ('inaceptable') solo con forma de onda/voltaje")
xa_max = (0.020 / 0.045) ** 2 / 0.79
print(f"  para [N]eq < 0.020 % sin ayuda química: aire < {xa_max*100:.0f} % (raíz cuadrada: diluir 10x baja [N] solo {np.sqrt(10):.2f}x)")
print("  ojo: N monoatómico del arco disuelve POR ENCIMA de Sieverts -> por eso el alambre trae Al/Mg/Li (química, no solo gas)")

# ======================================================================================
# 7. CAMPOS SOBRE EL ARCO
# ======================================================================================
hr("7. Campos sobre el arco: desvío transversal y giro axial")
for I in [40, 70]:
    dp, v, Rr, md = maecker(I, 3e7, rho_pl)
    M = md * v                       # flujo de momento del chorro
    print(f"  I={I} A: chorro ṁ={md*1e6:.2f} mg/s, v={v:.0f} m/s, momento {M*1e6:.1f} µN; B propio a 1 mm = {mu0*I/(2*np.pi*1e-3)*1e3:.1f} mT")
    for B in [0.0008, 0.003, 0.010]:
        for L in [1e-3, 2e-3]:
            F = I * B * L
            print(f"     B⊥ = {B*1e3:4.1f} mT, L = {L*1e3:.0f} mm: F = {F*1e6:6.1f} µN, F/momento = {F/M:5.2f}, desvío ~ {np.degrees(np.arctan(F/M)):4.0f}°")
print("  giro con B axial: par T = I·B_z·R²/2 (corriente que se abre radial en la raíz/charco), swirl S = T/(R·ṁ·v)")
for I in [40, 70]:
    dp, v, Rr, md = maecker(I, 3e7, rho_pl)
    Rs = 2e-3
    for Bz in [0.001, 0.003, 0.010, 0.030]:
        T_ = I * Bz * Rs**2 / 2
        S = T_ / (Rs * md * v)
        print(f"     I={I} A B_z={Bz*1e3:4.0f} mT: par {T_*1e9:7.1f} nN·m  S = {S:6.2f}  {'(>0.6: rompe el vórtice, recircula y ARRASTRA más)' if S > 0.6 else ''}")
print("  ¿y el B que frenaría el gas (sección 3, ~1 T)? sobre la corriente del arco:")
for B in [0.1, 0.3, 1.0]:
    dp, v, Rr, md = maecker(40, 3e7, rho_pl)
    print(f"     B⊥ = {B:.1f} T, 40 A, 2 mm: F = {40*B*2e-3*1e3:.1f} mN = {40*B*2e-3/(md*v):.0f}x el momento del chorro -> el arco se va")
# bobina en serie con el arco: el choque de 41 µH (40 vueltas, 112 mm)
Nch, lch = 40, 0.112
print(f"  choque 41 µH en serie (40 v, 112 mm) a 40 A: B dentro = {mu0*Nch*40/lch*1e3:.1f} mT, en la boca ≈ {mu0*Nch*40/lch/2*1e3:.1f} mT")
print(f"  bobina axial dedicada 12 vueltas en 30 mm a 40 A: {mu0*12*40/0.03*1e3:.1f} mT; L ≈ {mu0*144*np.pi*0.02**2/0.03*1e6:.1f} µH")

# ======================================================================================
# 8. GOTA: PIEL DE DIFUSIÓN DE N
# ======================================================================================
hr("8. Gota: piel de difusión de N (D ~ 1e-8 m²/s en Fe líquido [MEM]; sin convección interna = cota baja)")
D_N = 1e-8
for nombre, dgota, tcol in [("campanazo 0.45 mm, 75/s", 0.4526e-3, 1 / 75), ("globular 1.63 mm (CC 60 A)", 1.63e-3, None)]:
    a = dgota / 2
    if tcol is None:
        vol_g = 4 / 3 * np.pi * a**3
        vol_c = 4 / 3 * np.pi * (0.4526e-3 / 2) ** 3
        tcol = (1 / 75) * vol_g / vol_c
    delta = np.sqrt(D_N * tcol)
    frac = 1 - (1 - delta / a) ** 3
    t_vuelo = 2e-3 / 0.8
    print(f"  {nombre}: cuelga {tcol*1e3:.1f} ms -> piel {delta*1e6:.1f} µm = {frac*100:.0f} % del volumen; vuelo 2 mm a 0.8 m/s = {t_vuelo*1e3:.1f} ms")

# ======================================================================================
# 9. CAPA SOBRE CAPA: Al
# ======================================================================================
hr("9. Imprimir capa sobre capa con un alambre de UNA pasada: Al del depósito por dilución")
Al_dep = 1.8   # % máx. E71T-GS (tabla de composición, materialwelding.com)
for D in [0.2, 0.3, 0.5]:
    Al = 0.0
    fila = []
    for n in range(1, 7):
        Al = (1 - D) * Al_dep + D * Al
        fila.append(Al)
    print(f"  dilución {D:.1f}: capas 1..6 -> " + "  ".join(f"{x:.2f}" for x in fila) + "  % Al  (tope 1.8)")
print("  sobre placa sin Al la primera capa se diluye; desde la 3a capa el depósito es ~alambre puro.")
print("\nFIN")
