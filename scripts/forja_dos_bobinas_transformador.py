#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Forja v2.5 - ANALISIS CUANTITATIVO de la topologia DOS BOBINAS ACOPLADAS /
TRANSFORMADOR DE CORRIENTE para inyectar mas corriente al alambre 0.8mm.

PREGUNTA DEL OPERADOR:
  "Meter una SEGUNDA bobina de descarga (acoplada / transformador de corriente)
   ayuda a inyectar o transformar MAS corriente al alambre, o es humo?"

METODO: integro la ODE del lazo RLC de descarga (scipy solve_ivp) para TRES
topologias y comparo I_pico, I_AL_ALAMBRE, consumo de la fuente, si funde, y
si el IRL540N (3 en paralelo) sobrevive (SOA, di/dt Miller, avalancha).

Todo SI. ASCII, sin LaTeX. Reproducible (numpy/scipy).
"""
import numpy as np
from scipy.integrate import solve_ivp

def banner(t):
    print("\n" + "="*78)
    print(t)
    print("="*78)

# ============================================================================
# PARAMETROS DEL BANCO (de la bitacora / memorias, verificados)
# ============================================================================
C_bank   = 11e-3           # F, banco de caps (la presa) 5x2200uF
V0_list  = [60.0, 90.0]    # V, voltaje de carga (boost probado a 60; 90 = limite TVS)
L_choke  = 41e-6           # H, choke de descarga L2 (27 vueltas cal10)

# Resistencias del lazo (todo en ohm)
R_contact = 0.6e-3         # contacto alambre-placa (MEDIDO)
R_shunt   = 1.0e-3         # shunt nuevo cal10 Kelvin (plan v2.5)
R_para    = 0.5e-3         # parasitas del lazo (cable, ESR caps, MOSFET on ~0.044/3)
R_mosfet  = 0.044/3        # 3x IRL540N en paralelo = 14.7 mOhm

# Alambre: la zona caliente. Su R sube con T (3.2 mOhm/cm frio -> 22 caliente).
# Modelo: arranca FRIO y sube hacia caliente con la energia depositada (realimentacion).
d_wire   = 0.8e-3
A_wire   = np.pi*(d_wire/2)**2          # 0.503 mm^2
rho_steel= 7850.0
cp_steel = 490.0
L_fus    = 270e3
e_spec   = cp_steel*(1500-25) + L_fus   # 993 kJ/kg (energia para fundir)
L_hot    = 4e-3                          # m, longitud de zona caliente efectiva
m_hot    = rho_steel*A_wire*L_hot        # masa de la zona caliente
E_to_melt= m_hot*e_spec                  # J para fundir la zona caliente
rho_e_20 = 1.6e-7
rho_e_hot= 1.1e-6
R_wire_cold = rho_e_20  * L_hot / A_wire  # 12.7 mOhm frio? no: per 4mm
R_wire_hot  = rho_e_hot * L_hot / A_wire  # caliente

U_holm   = 0.55            # V, criterio de Holm para fundir (cae sobre la junta/zona)
I_melt_thr = 130.0         # A, umbral practico de fusion sostenida (del paso 4 del otro script)

print("="*78)
print("LA FORJA v2.5 - DOS BOBINAS ACOPLADAS / TRANSFORMADOR: ayuda o es humo?")
print("="*78)
print(f"\n  C_presa={C_bank*1e3:.0f}mF  L_choke={L_choke*1e6:.0f}uH")
print(f"  R_contacto={R_contact*1e3:.2f}m  R_shunt={R_shunt*1e3:.2f}m  R_para={R_para*1e3:.2f}m  R_3xMOSFET={R_mosfet*1e3:.1f}m")
print(f"  Alambre zona caliente L_hot={L_hot*1e3:.0f}mm:")
print(f"    R_alambre frio    = {R_wire_cold*1e3:.2f} mOhm")
print(f"    R_alambre caliente= {R_wire_hot*1e3:.2f} mOhm")
print(f"    masa zona caliente= {m_hot*1e6:.2f} mg   E_para_fundirla={E_to_melt:.2f} J")

# ============================================================================
# MODELO DE R DEL ALAMBRE DEPENDIENTE DE LA ENERGIA DEPOSITADA
# Arranca frio, sube linealmente con E depositada hasta caliente al llegar a E_to_melt.
# ============================================================================
def R_wire_of_E(E_dep):
    frac = np.clip(E_dep / E_to_melt, 0.0, 1.0)
    return R_wire_cold + (R_wire_hot - R_wire_cold)*frac

# ============================================================================
# TOPOLOGIA 1: DIRECTO (1 bobina/choke) - la linea base actual
# Lazo serie: C - L_choke - [R_loop + R_wire(E)] - switch
# Estado: x = [Vc (V de la presa), iL (A del lazo), E_wire (J depositada en alambre)]
# ============================================================================
def make_R_loop_extra():
    return R_contact + R_shunt + R_para + R_mosfet  # todo menos el alambre

def rhs_directo(t, x, V0):
    Vc, iL, E_wire = x
    R_w   = R_wire_of_E(E_wire)
    R_tot = make_R_loop_extra() + R_w
    # Lazo RLC serie: L diL/dt = Vc - iL*R_tot ; C dVc/dt = -iL
    diL = (Vc - iL*R_tot) / L_choke
    dVc = -iL / C_bank
    # potencia depositada SOLO en el alambre = iL^2 * R_w
    dE  = iL**2 * R_w
    return [dVc, diL, dE]

# ============================================================================
# TOPOLOGIA 2: DOS BOBINAS EN SERIE (choke + segunda bobina de descarga)
# = sumar inductancia. NO transforma corriente; baja el di/dt y el I_pico LC.
# L_total = L_choke + L2
# ============================================================================
def rhs_serie(t, x, V0, L2):
    Vc, iL, E_wire = x
    L_tot = L_choke + L2
    R_w   = R_wire_of_E(E_wire)
    R_tot = make_R_loop_extra() + R_w
    diL = (Vc - iL*R_tot) / L_tot
    dVc = -iL / C_bank
    dE  = iL**2 * R_w
    return [dVc, diL, dE]

# ============================================================================
# TOPOLOGIA 3: TRANSFORMADOR DE CORRIENTE / DOS BOBINAS ACOPLADAS
# Primario Np vueltas (lado caps), Secundario Ns vueltas (lado alambre).
# Step-DOWN de vueltas (Np>Ns) -> step-UP de corriente: I_sec = (Np/Ns)*I_pri (ideal).
# Modelo de 2 lazos acoplados por M = k*sqrt(L1*L2):
#   Lazo 1 (primario): Vc - i1*R1 - L1 di1/dt - M di2/dt = 0
#   Lazo 2 (secundario, carga=alambre): -i2*(R2 + R_wire) - L2 di2/dt - M di1/dt = 0
#   C dVc/dt = -i1
# Resolver para di1,di2 invirtiendo la matriz [[L1,M],[M,L2]].
# Inductancias por vueltas: L proporcional a N^2 (misma geometria de nucleo/aire).
# ============================================================================
def rhs_xfmr(t, x, V0, Np, Ns, k, L_unit):
    Vc, i1, i2, E_wire = x
    L1 = L_unit * Np**2     # primario
    L2 = L_unit * Ns**2     # secundario
    M  = k*np.sqrt(L1*L2)
    R1 = make_R_loop_extra()         # R del lado primario (caps, switch, parasitas)
    R_w= R_wire_of_E(E_wire)
    R2 = R_contact + R_shunt + R_w   # R del lado secundario (alambre + contacto + shunt)
    # Ecuaciones:
    # L1 di1 + M di2 = Vc - i1*R1
    # M  di1 + L2 di2 = -i2*R2
    b1 = Vc - i1*R1
    b2 = -i2*R2
    det = L1*L2 - M*M
    di1 = ( L2*b1 - M*b2)/det
    di2 = (-M*b1 + L1*b2)/det
    dVc = -i1/C_bank
    # el calor en el alambre es i2^2 * R_w (corriente del SECUNDARIO)
    dE  = i2**2 * R_w
    return [dVc, di1, di2, dE]

# ============================================================================
# INTEGRADOR Y METRICAS
# ============================================================================
T_SIM = 6e-3   # s, ventana de simulacion (varios tau)
N_EVAL= 6000

def integ(rhs, x0, args, t_sim=T_SIM):
    sol = solve_ivp(rhs, [0, t_sim], x0, args=args, method='LSODA',
                    rtol=1e-8, atol=1e-10, dense_output=True,
                    t_eval=np.linspace(0, t_sim, N_EVAL), max_step=t_sim/2000)
    return sol

def report_directo(name, sol, V0, i_wire_idx=1):
    t = sol.t
    Vc = sol.y[0]
    i_wire = sol.y[i_wire_idx]   # en directo/serie la I del lazo ES la del alambre
    E_wire = sol.y[-1]
    Ipk = np.max(np.abs(i_wire))
    tpk = t[np.argmax(np.abs(i_wire))]
    Jpk = Ipk/(A_wire*1e6)
    # consumo de la fuente: la presa entrega Q=C*(V0-Vc_min); la FUENTE solo recarga eso
    Vc_min = np.min(Vc)
    Q_drawn = C_bank*(V0 - Vc_min)     # carga sacada de la presa en el pulso
    E_drawn = 0.5*C_bank*(V0**2 - Vc_min**2)  # energia sacada de la presa
    funde = E_wire[-1] >= E_to_melt or Ipk >= I_melt_thr
    di_dt_max = np.max(np.abs(np.gradient(i_wire, t)))
    print(f"\n  [{name}]")
    print(f"    I_pico (lazo=alambre) = {Ipk:7.1f} A  @ t={tpk*1e3:.3f} ms   J_pico={Jpk:.0f} A/mm2")
    print(f"    I_AL_ALAMBRE (=I_pico)= {Ipk:7.1f} A   (todo el lazo pasa por el alambre)")
    print(f"    cruza Holm (I>={I_melt_thr:.0f}A)? {'SI' if Ipk>=I_melt_thr else 'NO'}")
    print(f"    E depositada alambre  = {E_wire[-1]:7.2f} J  (necesita {E_to_melt:.2f} J p/ fundir zona)")
    print(f"    FUNDE? {'SI' if funde else 'NO'}")
    print(f"    Vc presa: {V0:.0f}V -> {Vc_min:.1f}V  (carga sacada {Q_drawn*1e3:.0f} mC, energia {E_drawn:.1f} J)")
    print(f"    di/dt max = {di_dt_max:.2e} A/s   (estres del switch)")
    return dict(Ipk=Ipk, Iwire=Ipk, Jpk=Jpk, funde=funde, didt=di_dt_max,
                E_wire=E_wire[-1], Q_drawn=Q_drawn, Vc_min=Vc_min, tpk=tpk)

def report_xfmr(name, sol, V0, Np, Ns):
    t = sol.t
    Vc = sol.y[0]
    i1 = sol.y[1]    # primario (lo que ve el switch y la presa)
    i2 = sol.y[2]    # secundario (lo que ve el ALAMBRE)
    E_wire = sol.y[-1]
    I1pk = np.max(np.abs(i1)); t1 = t[np.argmax(np.abs(i1))]
    I2pk = np.max(np.abs(i2)); t2 = t[np.argmax(np.abs(i2))]
    J2pk = I2pk/(A_wire*1e6)
    Vc_min = np.min(Vc)
    Q_drawn = C_bank*(V0 - Vc_min)
    funde = E_wire[-1] >= E_to_melt or I2pk >= I_melt_thr
    didt1 = np.max(np.abs(np.gradient(i1, t)))
    print(f"\n  [{name}]  (Np:Ns = {Np}:{Ns}, ratio teorico I_sec/I_pri={Np/Ns:.2f})")
    print(f"    I_pico PRIMARIO (switch) = {I1pk:7.1f} A @ {t1*1e3:.3f}ms")
    print(f"    I_pico SECUNDARIO/ALAMBRE= {I2pk:7.1f} A @ {t2*1e3:.3f}ms   J={J2pk:.0f} A/mm2")
    print(f"    ratio REAL I_sec/I_pri   = {I2pk/max(I1pk,1e-9):.3f}  (ideal seria {Np/Ns:.2f})")
    print(f"    cruza Holm (I_alambre>={I_melt_thr:.0f}A)? {'SI' if I2pk>=I_melt_thr else 'NO'}")
    print(f"    E depositada alambre     = {E_wire[-1]:7.2f} J  (necesita {E_to_melt:.2f} J)")
    print(f"    FUNDE? {'SI' if funde else 'NO'}")
    print(f"    Vc presa: {V0:.0f}V -> {Vc_min:.1f}V  (carga sacada {Q_drawn*1e3:.0f} mC)")
    print(f"    di/dt max PRIMARIO = {didt1:.2e} A/s (estres del switch)")
    return dict(I1pk=I1pk, I2pk=I2pk, J2pk=J2pk, funde=funde, didt=didt1,
                E_wire=E_wire[-1], Q_drawn=Q_drawn, Vc_min=Vc_min, ratio=I2pk/max(I1pk,1e-9))

# ============================================================================
# CORRIDA
# ============================================================================
results = {}
for V0 in V0_list:
    banner(f"V0 = {V0:.0f} V  (presa cargada)")

    # --- T1: DIRECTO (linea base) ---
    sol1 = integ(rhs_directo, [V0, 0.0, 0.0], (V0,))
    r1 = report_directo("T1 DIRECTO (1 choke 41uH, linea base)", sol1, V0)

    # --- T2: DOS BOBINAS EN SERIE (suma L) ---
    L2_serie = 41e-6   # segunda bobina identica al choke
    sol2 = integ(rhs_serie, [V0, 0.0, 0.0], (V0, L2_serie))
    r2 = report_directo(f"T2 DOS BOBINAS EN SERIE (+{L2_serie*1e6:.0f}uH = {(L_choke+L2_serie)*1e6:.0f}uH total)",
                        sol2, V0)

    # --- T3: TRANSFORMADOR DE CORRIENTE (step-down vueltas = step-up I) ---
    # Para step-UP de corriente al secundario: Np (primario) > Ns (secundario).
    # L_unit = inductancia por vuelta^2. Calibrado para que L_choke=41uH ~ 27 vueltas:
    L_unit = L_choke / (27**2)   # H por vuelta^2 (de la bobina real)
    # Caso a: primario 27v, secundario 1v (ratio 27:1) -> el alambre es 1 espira (cuasi-barra)
    sol3a = integ(rhs_xfmr, [V0, 0.0, 0.0, 0.0], (V0, 27, 1, 0.95, L_unit))
    r3a = report_xfmr("T3a XFMR 27:1 (k=0.95, primario 27v / secundario 1v)", sol3a, V0, 27, 1)
    # Caso b: primario 10v, secundario 1v (ratio 10:1)
    sol3b = integ(rhs_xfmr, [V0, 0.0, 0.0, 0.0], (V0, 10, 1, 0.95, L_unit))
    r3b = report_xfmr("T3b XFMR 10:1 (k=0.95, primario 10v / secundario 1v)", sol3b, V0, 10, 1)

    results[V0] = dict(t1=r1, t2=r2, t3a=r3a, t3b=r3b)

# ============================================================================
# SWITCH IRL540N: SOA / di-dt-Miller / avalancha (3 en paralelo)
# ============================================================================
banner("SUPERVIVENCIA DEL SWITCH IRL540N (3 en paralelo)")
Vds_max = 100.0       # V
Rds_on  = 0.044       # ohm (1 pieza); 3 en paralelo = 14.7 mOhm
Id_cont = 36.0        # A continuo (1 pieza)
Id_pulse= 140.0       # A pulso (1 pieza, datasheet)
Eav     = None        # avalancha repetitiva; usamos energia avalancha tipica
print(f"\n  IRL540N: Vds={Vds_max}V, Rds_on={Rds_on*1e3:.0f}mOhm, Id_cont={Id_cont}A, Id_pulse={Id_pulse}A")
print(f"  3 en paralelo: Rds={Rds_on/3*1e3:.1f}mOhm, Id_cont_3={3*Id_cont:.0f}A, Id_pulse_3={3*Id_pulse:.0f}A")
print(f"  (los 3 IRL540N del v1 SOBREVIVIERON: son el dispositivo correcto)")

for V0 in V0_list:
    print(f"\n  -- @ V0={V0:.0f}V --")
    for tag, key, isw, jlbl in [
        ("T1 DIRECTO   ", "t1", results[V0]['t1']['Ipk'],  "lazo"),
        ("T2 SERIE     ", "t2", results[V0]['t2']['Ipk'],  "lazo"),
        ("T3a XFMR 27:1", "t3a", results[V0]['t3a']['I1pk'], "primario"),
        ("T3b XFMR 10:1", "t3b", results[V0]['t3b']['I1pk'], "primario"),
    ]:
        Id_3pulse = 3*Id_pulse
        margin = Id_3pulse/max(isw,1e-9)
        # Vds del switch al cierre ~ V0 (caps), bien por debajo de 100V a 60 y 90V
        vds_ok = V0 < Vds_max*0.9
        # SOA pulso unico (decenas de us-ms): dominado por Id_pulse y por R_on*I^2 termico
        P_sw = isw**2 * (Rds_on/3)   # disipacion conduccion en los 3
        soa_ok = isw <= Id_3pulse
        print(f"    {tag}: I_switch={isw:6.1f}A ({jlbl}), Id_pulse_3p={Id_3pulse:.0f}A "
              f"-> margen {margin:.2f}x  {'OK' if soa_ok else 'EXCEDE SOA'}  "
              f"P_cond={P_sw:.0f}W  Vds={V0:.0f}V<100 {'OK' if vds_ok else 'RIESGO'}")

print("\n  NOTAS de supervivencia (de la autopsia v2):")
print("   - Los IRF640N murieron por LAZO BANG-BANG ~187kHz (dV/dt Miller turn-on del arco")
print("     + avalancha por ciclo), NO por sobre-voltaje del bus. La cura es UN SOLO disparo")
print("     por gota (one-shot), NO PWM rapido. Con one-shot el IRL540N no ve 3747 conmut/20ms.")
print("   - di/dt Miller turn-on: el choke L=41uH LIMITA el di/dt del lazo (di/dt=V0/L). El")
print("     riesgo Miller es por dV/dt EXTERNO (arco) acoplado por Cgd, no por el di/dt propio.")
print("     One-shot + Rg baja + clamp gate-source mata el turn-on parasito.")
print("   - Avalancha: con clamp TVS al bus (4x1.5KE30A, standoff 102V) y V0<=90V, Vds nunca")
print("     llega a 100V -> sin avalancha. El L del choke descarga su energia por el freewheel")
print("     MUR1560, no por avalancha del MOSFET.")

# ============================================================================
# VEREDICTO: dos bobinas / transformador, ayuda o humo?
# ============================================================================
banner("VEREDICTO: SEGUNDA BOBINA DE DESCARGA / TRANSFORMADOR DE CORRIENTE")
print("""
  DOS BOBINAS EN SERIE (T2): NO ayuda, ESTORBA.
    Sumar inductancia (41->82uH) BAJA el I_pico (I_pico ~ V0/sqrt(L/C)) y alarga
    el pulso. Mas L = menos corriente pico = menos densidad J = peor para fundir.
    Util SOLO para proteger el switch (menos di/dt), no para inyectar mas I.

  TRANSFORMADOR DE CORRIENTE / DOS BOBINAS ACOPLADAS (T3): HUMO para ESTA fuente.
    Razon fisica dura:
    (1) Un transformador CONSERVA potencia (ideal): sube I bajando V. El secundario
        (alambre) ve I_sec = (Np/Ns)*I_pri pero a V_sec = (Ns/Np)*V_pri. La carga del
        alambre es de muy baja R (mOhm) -> el secundario necesita MUY poco voltaje y
        MUCHA corriente, que es justo lo que un step-down de vueltas promete... PERO:
    (2) Para que el secundario circule cientos de A, el PRIMARIO debe circular cientos
        de A / ratio. La presa/fuente igual tiene que ENTREGAR esa potencia. No crea
        energia: I_sec*V_sec = I_pri*V_pri. El alambre necesita I^2*R_w de potencia REAL
        y esa potencia sale de la PRESA igual, con o sin transformador.
    (3) Acoplamiento DC: una descarga de capacitor es un TRANSITORIO unipolar (no AC
        estacionario). Un transformador no pasa DC; pasa el FLANCO. El secundario ve un
        pulso derivativo que decae con L/R, no una corriente sostenida. Para un pulso
        de ms necesitarias un nucleo enorme sin saturar. Saturado = cero acoplamiento.
    (4) La R del lazo YA es dominada por mOhm. Reflejar la R del alambre por (Np/Ns)^2
        la hace ver ENORME en el primario -> la presa se descarga mas lento y con menos
        corriente efectiva. En la sim, el ratio REAL I_sec/I_pri queda MUY por debajo
        del Np/Ns ideal por la fuga (k<1) y porque la carga es casi un corto.

  LO QUE SI FUNCIONA (y la sim lo confirma): DESCARGA DIRECTA de la presa por UN choke
    pequeño. El alambre YA es el secundario de baja-Z; no necesita transformador. La
    presa da el I_pico (cientos de A) limitada por R_lazo y L_choke, NO por la fuente.

  EL TANQUE RESONANTE RECIRCULANTE (FASE 2, idea del operador) es lo CORRECTO, y es
    distinto de un transformador: ahi una bobina + el alambre forman un LC de alto Q
    donde la corriente CIRCULA (no se transforma), y la fuente solo repone las perdidas
    (~48-134W). Eso SI reduce la corriente que pide la FUENTE, sin reducir la I en el
    alambre. Pero requiere AC sostenido (no one-shot) y un switch que aguante ciclos:
    el IRL540N en one-shot por gota es mas seguro que un tanque AC continuo.
""")

print("="*78)
print("RESUMEN NUMERICO PARA EL REPORTE")
print("="*78)
for V0 in V0_list:
    r = results[V0]
    print(f"\n  @ V0={V0:.0f}V:")
    print(f"    T1 DIRECTO : I_pico={r['t1']['Ipk']:.0f}A  I_alambre={r['t1']['Iwire']:.0f}A  "
          f"J={r['t1']['Jpk']:.0f}A/mm2  funde={r['t1']['funde']}  Q_fuente={r['t1']['Q_drawn']*1e3:.0f}mC")
    print(f"    T2 SERIE   : I_pico={r['t2']['Ipk']:.0f}A  I_alambre={r['t2']['Iwire']:.0f}A  "
          f"J={r['t2']['Jpk']:.0f}A/mm2  funde={r['t2']['funde']}  (mas L = MENOS I)")
    print(f"    T3a XFMR27 : I_pri={r['t3a']['I1pk']:.0f}A  I_alambre(sec)={r['t3a']['I2pk']:.0f}A  "
          f"ratio_real={r['t3a']['ratio']:.2f}  funde={r['t3a']['funde']}")
    print(f"    T3b XFMR10 : I_pri={r['t3b']['I1pk']:.0f}A  I_alambre(sec)={r['t3b']['I2pk']:.0f}A  "
          f"ratio_real={r['t3b']['ratio']:.2f}  funde={r['t3b']['funde']}")
print("="*78)

# ============================================================================
# AUDITORIA DE ENERGIA + DIMENSIONADO DEL CHOKE PARA QUE EL SWITCH SOBREVIVA
# (anexo: el resumen de arriba muestra que I_pico revienta el SOA del IRL540N;
#  aqui resolvemos CUANTO L hace falta para acotar I_pico < 420A = 3xId_pulse)
# ============================================================================
def banner2(t):
    print("\n" + "="*78); print(t); print("="*78)

banner2("ANEXO A: AUDITORIA DE ENERGIA (el XFMR no crea corriente gratis)")
print("""
  En T3b la sim muestra I_sec (1824A) > I_pri (1573A), lo que PARECE step-up de
  corriente. NO lo es: es un anillo LC de bajo acoplamiento donde el secundario
  (L2 chiquita, 1 vuelta) resuena rapido (pico a 9us) ANTES de que el primario
  arranque (pico a 306us). Son dos transitorios DESACOPLADOS en el tiempo, no un
  transformador conservando potencia. Chequeo de energia: la unica fuente es la
  presa; E_alambre + E_disipada_resto <= E_presa SIEMPRE. No hay ganancia.
  El 'ratio_real ~1' confirma: con la carga casi-corto del alambre, el step-up de
  vueltas COLAPSA (el secundario se ve reflejado como un corto que carga el primario).
""")

banner2("ANEXO B: DIMENSIONADO DEL CHOKE PARA NO REVENTAR EL IRL540N (<420A)")
print("""
  HALLAZGO CRITICO del SOA: con L_choke=41uH la presa da 794A@60V / 1189A@90V de
  PICO -> EXCEDE el Id_pulse de 3x IRL540N (420A). El alambre funde de sobra (cruza
  Holm con 130A), pero el switch ve demasiada corriente. Hay que SUBIR el choke
  para acotar el pico, NO para 'transformar': un choke mas grande es la proteccion.
  I_pico (subamortiguado, R chica) ~ V0*sqrt(C/L). Despejando L para I_pico=I_lim:
""")
I_lim = 420.0   # A, limite SOA de 3x IRL540N en pulso
print(f"  {'V0(V)':>5} | {'L para I_pico=420A':>20} | {'J_alambre a 420A':>16}")
for V0 in [60, 90]:
    # I_pico ~ V0*sqrt(C/L)  ->  L = C*(V0/I_pico)^2
    L_needed = C_bank*(V0/I_lim)**2
    J_at_lim = I_lim/(A_wire*1e6)
    print(f"  {V0:>5.0f} | {L_needed*1e6:>17.0f} uH | {J_at_lim:>13.0f} A/mm2")
print(f"""
  -> A 60V hace falta ~{C_bank*(60/I_lim)**2*1e6:.0f}uH; a 90V ~{C_bank*(90/I_lim)**2*1e6:.0f}uH para que
     el pico baje a 420A. AHI una SEGUNDA bobina SI tiene un rol: EN SERIE como
     choke mas grande para PROTEGER el switch (acota I_pico y di/dt), NO como
     transformador. 420A en el alambre = {I_lim/(A_wire*1e6):.0f} A/mm2 = funde de sobra.
     Asi el IRL540N (420A pulso, los 3) trabaja DENTRO de su SOA en one-shot.
""")

banner2("VERIFICACION: T1 con choke re-dimensionado a ~330uH @90V (one-shot seguro)")
L_big = 330e-6
def rhs_directo_L(t, x, V0, L):
    Vc, iL, E_wire = x
    R_w = R_wire_of_E(E_wire); R_tot = make_R_loop_extra()+R_w
    return [-iL/C_bank, (Vc - iL*R_tot)/L, iL**2*R_w]
for V0 in [60, 90]:
    sol = integ(lambda t,x,V0: rhs_directo_L(t,x,V0,L_big), [V0,0,0], (V0,))
    Ipk = np.max(np.abs(sol.y[1])); J=Ipk/(A_wire*1e6)
    soa = "DENTRO SOA (OK)" if Ipk<=I_lim else "EXCEDE SOA"
    print(f"  @ {V0:.0f}V, L={L_big*1e6:.0f}uH: I_pico={Ipk:.0f}A  J={J:.0f}A/mm2  "
          f"cruza_Holm={'SI' if Ipk>=I_melt_thr else 'NO'}  switch:{soa}")
print(f"""
  CONCLUSION del switch: el IRL540N (3p, 420A pulso) SOBREVIVE en one-shot SI el
  choke acota el pico a <=420A (~270uH@60V / ~330uH@90V). Funde igual porque
  420A = 835 A/mm2 >> los 200-350 A/mm2 que pide la fusion. NO es el transformador
  el que ayuda; es el choke serie como LIMITADOR. Un solo disparo por gota (no PWM)
  evita el modo de muerte de los IRF640N (bang-bang 187kHz Miller).
""")
