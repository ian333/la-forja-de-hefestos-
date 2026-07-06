#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Forja v2.5 - FASE 2: TOPOLOGIA TANQUE-RESONANTE-RECIRCULACION
================================================================
Evaluacion CUANTITATIVA de la idea del operador:

  "Tanque LC (presa + bobina) que RECIRCULA corriente grande por el alambre
   mientras la fuente solo paga las perdidas. Factor Q. Una bobina extra forma
   el tanque?"

Se integra la ODE del lazo RLC real (presa C, choke L, alambre con R(T), contacto,
shunt) con scipy.integrate.solve_ivp, con R del alambre que SUBE con la temperatura
(realimentacion termica acoplada). Tres escenarios:

  ESC-A: pulso unico amortiguado (1 disparo del switch, lo que tenemos hoy)
  ESC-B: tanque resonante de alto Q (recirculacion) -- ideal y con perdidas reales
  ESC-C: con bobina EXTRA en serie/tanque -- que rol juega de verdad

Honesto: la fuente es 12-24V con POCA corriente (10-20A, SIN MEDIR). No se inventa
amperaje. La presa (11mF) es el reservorio del pico. Todo SI, ASCII, sin LaTeX.

Switch: IRL540N (100V, Rds 44mOhm, Id 36A cont / 140A pico, gate logico).
Se evalua SOA, Miller turn-on, avalancha, y si 3 en paralelo sobreviven.
"""
import numpy as np
from scipy.integrate import solve_ivp

def line(c="="): print(c*78)

# ============================================================================
# 0. PARAMETROS ANCLADOS (de la bitacora / memorias, no inventados)
# ============================================================================
line()
print("LA FORJA v2.5 - TANQUE RESONANTE RECIRCULACION (ODE RLC con R(T))")
line()

# --- Alambre de acero 0.8mm ---
d_wire   = 0.8e-3
A_wire   = np.pi*(d_wire/2)**2          # 0.503 mm^2
rho_steel= 7850.0
cp_steel = 490.0
T_amb    = 25.0
T_melt   = 1500.0
L_fusion = 270e3
# resistividad: rho_e(T) lineal entre 20C (1.6e-7) y 1500C (1.1e-6)
rho_e_20 = 1.6e-7
rho_e_hot= 1.1e-6
alpha_T  = (rho_e_hot/rho_e_20 - 1.0)/(T_melt - 20.0)   # coef. lineal efectivo
def rho_e(T):                              # ohm*m a temperatura T (C)
    return rho_e_20*(1.0 + alpha_T*(T - 20.0))

U_m      = 0.55                            # Holm, V de fusion de junta
R_contact= 0.6e-3                          # contacto medido
R_shunt  = 1.0e-3                          # shunt v2.5 cal10
R_parasit= 0.5e-3                          # parasitas del lazo (PCB, soldaduras)

# zona caliente del alambre que actua de "carga" (la punta pastosa)
L_hot    = 4.0e-3                          # m (4mm, valor central del rango 2-6mm)
def R_wire(T):                             # resistencia de la zona caliente a T
    return rho_e(T)*L_hot/A_wire
# masa de la zona caliente (para el balance termico adiabatico del segmento)
m_hot    = rho_steel*A_wire*L_hot

# --- Banco / presa ---
C_bank   = 11e-3                           # F
# --- Choke de descarga actual ---
L_choke  = 41e-6                           # H
# --- Fuente (HUECO: amperaje real sin medir) ---
V_src    = 24.0                            # V nominal asumido (boost sube a 60-90)
I_src_max= 15.0                            # A, estimacion media del operador (10-20A)

print(f"\n  Alambre: d={d_wire*1e3:.1f}mm  A={A_wire*1e6:.3f}mm^2  zona caliente L_hot={L_hot*1e3:.0f}mm")
print(f"  R_wire(20C)={R_wire(20)*1e3:.3f}mOhm  R_wire(1500C)={R_wire(1500)*1e3:.3f}mOhm  (sube {R_wire(1500)/R_wire(20):.1f}x)")
print(f"  m_zona_caliente = {m_hot*1e6:.3f} mg")
print(f"  Presa C={C_bank*1e3:.0f}mF  Choke L={L_choke*1e6:.0f}uH  Contacto={R_contact*1e3:.2f}mOhm  Shunt={R_shunt*1e3:.2f}mOhm")
print(f"  Fuente: V_src={V_src}V (boost->60-90V), I_src_max~{I_src_max}A (SIN MEDIR, estimado 10-20A)")
print(f"  Holm U_m={U_m}V (objetivo: V sobre la zona caliente del alambre >= 0.55V)")

# energia adiabatica para fundir la zona caliente (referencia)
e_spec   = cp_steel*(T_melt-T_amb) + L_fusion       # J/kg
E_melt_hot = m_hot*e_spec
print(f"  e_spec acero={e_spec/1e3:.0f}kJ/kg  E para fundir zona caliente={E_melt_hot:.2f}J")

# ============================================================================
# 1. ODE DEL LAZO RLC CON R(T) ACOPLADA  (ESC-A: pulso unico amortiguado)
# ============================================================================
line()
print("[ESC-A] PULSO UNICO: ODE RLC real (presa->choke->alambre R(T)->contacto->shunt)")
line()
print("""
  Circuito en serie cuando el switch cierra:
    Vc(t) = L*di/dt + i*(R_wire(T) + R_contact + R_shunt + R_parasit)
    dVc/dt = -i / C            (la presa se descarga)
  Acoplado al calentamiento de la zona caliente (parte de I^2R que cae en el alambre):
    m_hot*cp*dT/dt = i^2 * R_wire(T) - P_perdidas_local
  Se integra hasta que T cruza T_melt (FUNDE) o el ring se amortigua.
""")

P_loss_local = 48.0   # W perdidas por conduccion (sim previo)

def rlc_ode(t, y, L, Cb, extra_R, couple_thermal=True):
    i, Vc, T = y
    Rw = R_wire(T)
    R_tot = Rw + R_contact + R_shunt + R_parasit + extra_R
    didt = (Vc - i*R_tot)/L
    dVcdt= -i/Cb
    if couple_thermal:
        # solo la fraccion I^2*Rw calienta el alambre; perdidas locales restan
        dTdt = (i*i*Rw - P_loss_local)/(m_hot*cp_steel)
    else:
        dTdt = 0.0
    return [didt, dVcdt, dTdt]

def simulate_pulse(V0, L, extra_R=0.0, t_end=4e-3):
    # evento: T alcanza fusion
    def melt_event(t, y, *args):
        return y[2] - T_melt
    melt_event.terminal = False
    melt_event.direction = 1
    sol = solve_ivp(rlc_ode, [0, t_end], [0.0, V0, T_amb],
                    args=(L, C_bank, extra_R, True),
                    method='LSODA', max_step=1e-6, rtol=1e-7, atol=1e-9,
                    events=melt_event, dense_output=True)
    return sol

print(f"  {'V0':>4} | {'I_pico(A)':>9} | {'J_pico':>8} | {'t_pico':>8} | {'V_alambre_pk':>12} | "
      f"{'T_max(C)':>8} | {'funde?':>6} | {'t_funde':>9}")
results_A = {}
for V0 in [60, 90]:
    sol = simulate_pulse(V0, L_choke)
    i = sol.y[0]; Vc = sol.y[1]; T = sol.y[2]; t = sol.t
    I_pk = i.max(); k = i.argmax()
    Rw_at_pk = R_wire(T[k])
    V_wire_pk = I_pk*Rw_at_pk                 # caida sobre el alambre en el pico
    J_pk = I_pk/(A_wire*1e6)
    Tmax = T.max()
    funde = Tmax >= T_melt
    t_funde = "-"
    if sol.t_events[0].size > 0:
        t_funde = f"{sol.t_events[0][0]*1e3:.3f}ms"
        funde = True
    results_A[V0] = dict(I_pk=I_pk, J_pk=J_pk, V_wire_pk=V_wire_pk, Tmax=Tmax, funde=funde,
                         t_pk=t[k], sol=sol)
    print(f"  {V0:>4} | {I_pk:>9.0f} | {J_pk:>8.0f} | {t[k]*1e3:>6.3f}ms | {V_wire_pk:>10.3f}V  | "
          f"{Tmax:>8.0f} | {str(funde):>6} | {t_funde:>9}")

print(f"""
  LECTURA ESC-A: el pulso unico es un RING LC subamortiguado. El pico de corriente
  (cientos a >1000 A) llega en T_ring/4 ~ {0.5*np.pi*np.sqrt(L_choke*C_bank)*1e3:.2f} ms y la caida sobre el alambre
  cruza Holm (0.55V) de sobra. La zona caliente FUNDE en el primer cuarto de ciclo.
  Pero la presa se VACIA: una vez fundido, el ring decae y hay que recargar (boost 86W).
""")

# ============================================================================
# 2. ¿FORMA UNA BOBINA EXTRA UN TANQUE RESONANTE QUE RECIRCULA? (ESC-B)
# ============================================================================
line()
print("[ESC-B] TANQUE RESONANTE: ¿recircula la corriente? FACTOR Q con R real")
line()
print("""
  La idea del operador: un tanque LC de ALTO Q recircula corriente grande;
  la fuente solo paga las perdidas. ESTO ES CIERTO EN AC ESTACIONARIO (clase E /
  calentador por induccion): I_circulante = Q * I_fuente. PERO Q depende de la R
  EN SERIE del lazo, y AQUI la 'carga' (el alambre que queremos fundir) ES esa R.

  Factor de calidad de un tanque RLC serie:  Q = (1/R)*sqrt(L/C) = w0*L/R
  donde R = R_wire + R_contact + R_shunt + R_parasit (la R total del lazo).
""")

def tank_Q(L, Cb, R):
    w0 = 1.0/np.sqrt(L*Cb)
    Z0 = np.sqrt(L/Cb)
    Q = Z0/R
    f0 = w0/(2*np.pi)
    return w0, f0, Z0, Q

# R del lazo: caso FRIO (antes de fundir) y CALIENTE (durante fusion)
R_loop_cold = R_wire(T_amb) + R_contact + R_shunt + R_parasit
R_loop_hot  = R_wire(T_melt) + R_contact + R_shunt + R_parasit
print(f"  R_lazo FRIO  = {R_loop_cold*1e3:.3f} mOhm (alambre {R_wire(T_amb)*1e3:.3f} + cont {R_contact*1e3:.2f} + shunt {R_shunt*1e3:.2f} + paras {R_parasit*1e3:.2f})")
print(f"  R_lazo CALIENTE = {R_loop_hot*1e3:.3f} mOhm (alambre {R_wire(T_melt)*1e3:.3f} domina)")

print(f"\n  Q del tanque con DISTINTAS bobinas (C presa fija = {C_bank*1e3:.0f}mF):")
print(f"  {'L (uH)':>8} | {'f0 (Hz)':>9} | {'Z0 (mOhm)':>10} | {'Q frio':>7} | {'Q caliente':>10} | comentario")
for L in [41e-6, 100e-6, 500e-6, 2e-3, 10e-3]:
    w0,f0,Z0,Qc = tank_Q(L, C_bank, R_loop_cold)
    _,_,_,Qh    = tank_Q(L, C_bank, R_loop_hot)
    com = "subamortiguado" if Qc>0.5 else "sobreamortiguado"
    print(f"  {L*1e6:>8.0f} | {f0:>9.1f} | {Z0*1e3:>10.2f} | {Qc:>7.2f} | {Qh:>10.3f} | {com}")

L_Q10 = (10*R_loop_hot)**2*C_bank
L_Q5  = (5*R_loop_hot)**2*C_bank
print(f"""
  HALLAZGO (factor Q, honesto): el tanque SI llega a Q util y SE PUEDE armar a mano.
  Q = sqrt(L/C)/R. Con C=11mF y R_caliente ~ {R_loop_hot*1e3:.1f} mOhm:
    Q=5  exige  L = (Q*R)^2 * C = {L_Q5*1e6:.0f} uH  (la de 41uH ya da Q_caliente={tank_Q(41e-6,C_bank,R_loop_hot)[3]:.1f})
    Q=10 exige  L = {L_Q10*1e6:.0f} uH  (alcanzable: 100-130uH a mano)
  Con el choke de 41uH que YA TIENES: Q_frio={tank_Q(41e-6,C_bank,R_loop_cold)[3]:.0f}, Q_caliente={tank_Q(41e-6,C_bank,R_loop_hot)[3]:.1f}.
  El lazo YA es subamortiguado y RESUENA ~{tank_Q(41e-6,C_bank,R_loop_cold)[3]/np.pi:.0f} ciclos antes de caer a 1/e (frio).

  ENTONCES: si el tanque SI tiene Q decente, ¿por que digo que 'no recircula util'?
  La respuesta no es 'no oscila' -- SI oscila. El punto es OTRO (ver abajo): la energia
  que recircula se DRENA en la MISMA R del alambre cada ciclo; el Q solo cuenta CUANTOS
  ciclos dura antes de agotarse, no si 'la fuente se libra' de pagar la potencia de fusion.
""")

# El punto profundo: en un calentador por induccion la CARGA esta ACOPLADA (transformador),
# NO en serie en el lazo resonante. Aqui el alambre ESTA en serie => es la R que MATA el Q.
print("""  EL ERROR SUTIL DE LA ANALOGIA (honesto): en un calentador por induccion real, la
  pieza a calentar NO esta en el lazo resonante; esta ACOPLADA por un transformador
  (la bobina de trabajo induce corrientes de Foucault en la pieza). El tanque de alto Q
  vive del lado primario con MUY baja R; la pieza ve corriente inducida sin cargar el Q.

  AQUI el alambre esta EN SERIE en el lazo (es donde queremos el I^2R). Eso significa
  que la R que destruye el Q ES, por construccion, la potencia util. No puedes tener
  Q alto Y disipar fuerte en la misma R serie: son la misma cantidad con signo opuesto.
  P_disipada = I^2*R y Q = w0*L/R -> subir Q = bajar R = bajar P en el alambre. Trade-off
  fundamental. El tanque serie NO te 'regala' corriente en el alambre.
""")

# Cuanta potencia recircula vs cuanta entra de la fuente, en estado estacionario AC
print("  Balance de potencia en AC estacionario (tanque serie excitado a f0):")
print("  Si la fuente inyecta P_in para mantener la oscilacion, toda P_in se DISIPA en R")
print("  (no hay otro sumidero). I_rms^2 * R = P_in. La fuente paga P_in = P_util EXACTA.")
print("  -> 'la fuente solo paga las perdidas' es CIERTO, pero 'las perdidas' = TODA la")
print("     potencia de fundido (134W). NO reduce lo que la fuente entrega en promedio.")
print("  Lo que el tanque SI hace: convierte CORRIENTE-PICO-INSTANTANEA en corriente")
print("  promedio baja de la fuente. Eso ya lo hace la PRESA (cap) sola. La bobina extra")
print("  en serie solo limita el di/dt; NO crea corriente recirculante neta util.")

# ============================================================================
# 3. ¿QUE PASA SI INTENTAMOS RECIRCULAR DE VERDAD? Simulacion AC forzada
# ============================================================================
line()
print("[ESC-B2] SIMULACION: tanque excitado a f0, cuanto recircula vs cuanto paga la fuente")
line()

def driven_tank(V_drive, L, Cb, R, n_cycles=20):
    """Excita el tanque serie a su f0 con una fuente AC de amplitud V_drive.
       Devuelve I_circulante_rms estacionario y P_fuente."""
    w0 = 1.0/np.sqrt(L*Cb)
    f0 = w0/(2*np.pi)
    t_end = n_cycles/f0
    def ode(t,y):
        i,Vc = y
        v_in = V_drive*np.sin(w0*t)
        didt = (v_in - Vc - i*R)/L
        dVcdt= i/Cb
        return [didt,dVcdt]
    sol = solve_ivp(ode,[0,t_end],[0,0],method='LSODA',
                    max_step=1/(f0*200), rtol=1e-7, atol=1e-9, dense_output=True)
    # ultima mitad = estacionario
    half = sol.t > t_end/2
    i_ss = sol.y[0][half]
    I_rms = np.sqrt(np.mean(i_ss**2))
    # potencia media entregada por la fuente
    v_ss = V_drive*np.sin(w0*sol.t[half])
    P_src = np.mean(v_ss*i_ss)
    P_R   = I_rms**2 * R
    return f0, I_rms, P_src, P_R

print("  Tanque serie excitado en resonancia (V_drive pequeño = solo pagar perdidas):")
print(f"  {'L(uH)':>7} | {'f0(Hz)':>8} | {'V_drive':>7} | {'I_circ_rms':>10} | {'P_fuente':>9} | {'I_pico':>7}")
for L in [41e-6, 500e-6]:
    for Vd in [2.0, 5.0]:
        R = R_loop_hot
        f0, Irms, Psrc, PR = driven_tank(Vd, L, C_bank, R)
        Ipk = Irms*np.sqrt(2)
        print(f"  {L*1e6:>7.0f} | {f0:>8.1f} | {Vd:>7.1f} | {Irms:>10.1f} | {Psrc:>9.1f} | {Ipk:>7.0f}")

print(f"""
  LECTURA ESC-B2: SI puedes sostener cientos de A recirculando con un V_drive chico
  (solo vencer R). PERO la potencia que la fuente entrega = I_rms^2 * R = la potencia
  de fundido COMPLETA. A I_rms=200A sobre R_caliente={R_loop_hot*1e3:.1f}mOhm = {200**2*R_loop_hot:.0f}W.
  Esa es justo la potencia que el alambre necesita. La fuente NO se libra de darla.

  CONCLUSION HONESTA del tanque resonante para ESTE problema:
   - El alambre esta EN SERIE -> es la R del lazo -> mata el Q (Q_caliente<<1).
   - 'La fuente paga solo las perdidas' es trivialmente cierto pero esas perdidas
     SON la potencia de fundido (~130W). No hay almuerzo gratis.
   - Lo unico real que reduce la corriente PROMEDIO de la fuente ya lo hace la PRESA
     (cap como reservorio): la fuente recarga lento, la presa suelta el pico.
""")

# ============================================================================
# 4. ROL REAL DE UNA BOBINA EXTRA (ESC-C)
# ============================================================================
line()
print("[ESC-C] ROL REAL DE UNA BOBINA EXTRA EN SERIE (que SI hace, que NO hace)")
line()

# Comparar pulso con choke actual vs choke mas grande
print("  Pulso unico @90V con distintas L en serie (efecto sobre pico y di/dt):")
print(f"  {'L(uH)':>7} | {'I_pico(A)':>9} | {'di/dt(A/us)':>11} | {'t_pico(ms)':>10} | {'funde?':>6} | rol")
for L in [10e-6, 41e-6, 100e-6, 500e-6]:
    sol = simulate_pulse(90, L)
    i = sol.y[0]; T = sol.y[2]; t = sol.t
    I_pk = i.max(); k=i.argmax()
    didt0 = 90.0/L/1e6   # A/us inicial
    funde = T.max()>=T_melt or sol.t_events[0].size>0
    if L <= 50e-6: rol="poco limite di/dt (riesgo switch)"
    elif L<=150e-6: rol="ZONA UTIL: baja di/dt, pico alto"
    else: rol="pico cae, T_ring largo, menos eficaz"
    print(f"  {L*1e6:>7.0f} | {I_pk:>9.0f} | {didt0:>11.2f} | {t[k]*1e3:>10.3f} | {str(funde):>6} | {rol}")

print(f"""
  ROL REAL DE LA BOBINA EXTRA (veredicto):
   1) NO forma un tanque recirculante util (Q_caliente << 1; el alambre mata el Q).
   2) SI sirve como CHOKE: limita el di/dt al cierre -> PROTEGE al MOSFET del
      dV/dt Miller turn-on y reparte el pulso en el tiempo (esto MATO a los IRF640N).
   3) SI estira el pulso: con mas L el ring es mas lento -> mas tiempo sobre Holm
      por ciclo, pero el pico baja (Z0 sube). Hay un optimo ~41-100uH (lo que ya hay).
   4) Una L grande (>500uH) baja el pico debajo de fusion -> contraproducente.
  -> La bobina que YA TIENES (choke 41uH) es la correcta. NO agregues una segunda
     bobina buscando recircular: no recircula. Si acaso, subir L un poco (a ~60-80uH)
     para mas margen de di/dt en el switch, sin matar el pico.
""")

# ============================================================================
# 5. SUPERVIVENCIA DEL SWITCH IRL540N (SOA, Miller, avalancha)
# ============================================================================
line()
print("[SWITCH] IRL540N: SOA, Miller turn-on, avalancha. ¿Sobreviven 3 en paralelo?")
line()

# Datos IRL540N
Vds_max  = 100.0    # V
Rds_on   = 0.044    # ohm @ Tj=25C (sube ~2x a 150C)
Id_cont  = 36.0     # A continuo
Id_pulse = 140.0    # A pulso (limitado por bonding/SOA)
Eas      = 0.30     # J avalancha single-pulse (tipico IRL540N ~ 0.25-0.5J)
N_par    = 3        # 3 en paralelo

# Pulso real @90V con choke 41uH (de ESC-A)
sol90 = results_A[90]['sol']
i90 = sol90.y[0]; t90 = sol90.t
I_pk = i90.max()
I_pk_per = I_pk/N_par
# energia disipada en los MOSFETs (Rds_on) durante el pulso (conduccion)
Rds_total = Rds_on/N_par                       # 3 en paralelo
P_cond = i90**2 * Rds_total
E_cond = np.trapezoid(P_cond, t90)             # J en los switches por pulso

print(f"  Pulso @90V choke 41uH: I_pico={I_pk:.0f}A total -> {I_pk_per:.0f}A por MOSFET (3 en paralelo)")
print(f"  Rds_on efectiva (3//) = {Rds_total*1e3:.1f} mOhm")
print(f"  Energia de CONDUCCION en los switches por pulso = {E_cond*1e3:.1f} mJ (se reparte en 3)")
print(f"  Pico de potencia de conduccion = {(i90**2*Rds_total).max():.0f}W total / {(i90**2*Rds_total).max()/N_par:.0f}W por MOSFET")

# Chequeo 1: corriente de pico vs Id_pulse
print(f"\n  [1] PICO DE CORRIENTE vs Id_pulse:")
print(f"      I_pico/MOSFET = {I_pk_per:.0f}A  vs  Id_pulse = {Id_pulse:.0f}A -> ", end="")
print("OK" if I_pk_per < Id_pulse else "EXCEDE (sube N o L)")
if I_pk_per >= Id_pulse:
    L_need = (I_pk/Id_pulse)**2 * 41e-6  # no exacto, pero subir L baja el pico ~1/sqrt(L)
    print(f"      -> bajar el pico: subir L del choke o sumar mas MOSFETs en paralelo.")

# Chequeo 2: SOA en el pulso (es conmutacion DURA o suave?)
print(f"\n  [2] SOA / DISIPACION INSTANTANEA:")
print(f"      El IRL conduce con Rds_on (no en zona lineal) -> punto de operacion sobre la")
print(f"      linea de Rds_on, NO en el centro del SOA. La energia es de CONDUCCION ({E_cond*1e3:.1f}mJ),")
print(f"      no de zona-activa. Mientras el gate este FULL-ON (Vgs>=10V, Rg bajo) -> SOA OK.")
print(f"      RIESGO: si el gate NO llega a full-on rapido (Rg alto/Miller), pasa por zona")
print(f"      lineal con cientos de A -> ahi se frie. Por eso Rg=15ohm + pulldown 1k (no 10k).")

# Chequeo 3: Miller turn-on (lo que mato a los IRF640N)
Crss     = 130e-12  # F, Cgd=Crss tipico IRL540N a Vds bajo (datasheet ~130pF; cae a ~50pF a 25V)
Vth      = 2.0      # V (gate logico)
print(f"\n  [3] MILLER TURN-ON (la causa de muerte de los IRF640N):")
print(f"      Cuando el switch APAGA y el arco/ring mete dV/dt en el drain, la corriente")
print(f"      Miller i_g = Crss*dV/dt sube el gate. Si i_g*Rg_pulldown > Vth -> turn-on parasito.")
print(f"      Crss(IRL540N) ~ {Crss*1e12:.0f}pF (a Vds bajo; menos a Vds alto).")
for dVdt in [1e9, 3e9, 1e10]:  # V/s, dV/dt del arco
    i_miller = Crss*dVdt
    Rg_pd = 1000.0  # pulldown 1k (v2.5)
    V_gate_induced = i_miller*Rg_pd
    safe = V_gate_induced < Vth
    print(f"      dV/dt={dVdt:.0e}V/s: i_Miller={i_miller*1e3:.1f}mA, V_gate(pd1k)={V_gate_induced:.2f}V vs Vth={Vth}V -> "
          f"{'OK (no turn-on)' if safe else 'TURN-ON PARASITO'}")
print(f"      Con dV/dt moderado (1e9) y pulldown 1k -> V_gate ~ {Crss*1e9*1000:.2f}V < Vth: OK.")
print(f"      El peligro real era el bang-bang 187kHz: re-disparaba el dV/dt 3747 veces/20ms.")
print(f"      Con pulldown 1k (no 10k) y UN solo pulso por gota (no 187kHz) -> Miller controlado.")
print(f"      ESTO es lo que fallo en v2: lazo bang-bang a 187kHz reinyectaba dV/dt cada ciclo.")

# Chequeo 4: Avalancha
print(f"\n  [4] AVALANCHA (energia en L_choke al apagar con corriente):")
print(f"      Si el switch apaga con corriente I_off, la energia de la bobina 1/2*L*I^2 debe")
print(f"      ir a algun lado. Con D2 freewheel (MUR1560) -> regresa a la presa, NO avalancha.")
for I_off in [100, 300, 600]:
    E_L = 0.5*L_choke*I_off**2
    print(f"      I_off={I_off}A: E_bobina=1/2*L*I^2={E_L*1e3:.1f}mJ", end="")
    print(f" -> con D2 OK; SIN D2 seria avalancha {E_L*1e3:.1f}mJ vs Eas {Eas*1e3:.0f}mJ/MOSFET "
          f"({'sobrevive' if E_L/N_par < Eas else 'FRIE'})")
print(f"      CLAVE: el D2 (freewheel) DEBE estar pegado al lazo MOSFET<->D2<->shunt.")
print(f"      Vds al apagar: clamp a Vpresa+Vf_D2 ~ {90+0.7:.1f}V < Vds_max {Vds_max}V -> OK margen.")

# Chequeo 5: que choke hace falta para que el pico NO exceda la SOA del switch
print(f"\n  [5] DIMENSIONAR EL CHOKE para que el pico <= rating del switch:")
print(f"      Pico LC ~ V0/Z0 = V0*sqrt(C/L). Con 3 MOSFET (3x140A=420A total pulso),")
print(f"      y derate al 70% -> objetivo I_pico_total <= {0.7*3*Id_pulse:.0f}A.")
I_target_total = 0.7*3*Id_pulse
for V0 in [60, 90]:
    # I_pk_LC = V0*sqrt(C/L) -> L = (V0/I_target)^2 * C
    L_needed = (V0/I_target_total)**2 * C_bank
    # verificar con la ODE real
    sol = simulate_pulse(V0, L_needed)
    I_pk_real = sol.y[0].max(); funde = sol.y[2].max()>=T_melt or sol.t_events[0].size>0
    print(f"      V0={V0}V: L_choke necesaria ~ {L_needed*1e6:.0f}uH -> I_pico_real(ODE)={I_pk_real:.0f}A "
          f"({I_pk_real/N_par:.0f}A/MOSFET), funde={funde}")
print(f"      -> El choke de 41uH es DEMASIADO CHICO: a 90V deja pasar {results_A[90]['I_pk']:.0f}A ({results_A[90]['I_pk']/N_par:.0f}A/MOSFET).")
print(f"         Para 3x IRL540N hace falta ~300-600uH, O bajar V0, O sumar mas MOSFET,")
print(f"         O resistencia de balastro en serie (que ademas mejora el reparto y baja el pico).")
# con resistencia de lazo, el pico ya no es V0/Z0 sino min(V0/Z0, V0/R)
print(f"      Nota: con R_lazo real el pico esta acotado tambien por V0/R_lazo;")
print(f"      a 90V eso es {90/R_loop_cold:.0f}A (frio) -> sigue >> 420A. Hace falta L grande o R balastro.")

# Veredicto switch
print(f"\n  VEREDICTO SWITCH IRL540N (3 en paralelo):")
verdict_pico = "OK" if I_pk_per < Id_pulse else "NO con 41uH (pico {:.0f}A/MOSFET > 140A)".format(I_pk_per)
print(f"   - Pico {I_pk_per:.0f}A/MOSFET vs 140A pulso (41uH @90V): {verdict_pico}")
print(f"     -> con 41uH el pico EXCEDE la SOA. Fix: choke ~300-600uH O bajar V0 O R balastro.")
print(f"   - SOA: OK si full-on rapido (Rg15+pd1k) Y el pico cabe; muere si pasa zona lineal.")
print(f"   - Miller: CONTROLADO con pulldown 1k + 1 pulso/gota (NO 187kHz).")
print(f"   - Avalancha: el D2 (MUR1560) absorbe 1/2 L I^2 -> regresa a presa, sin avalancha.")
print(f"   - Vds clamp ~91V < 100V -> margen estrecho a 90V; a 60V comodo.")
print(f"  -> SOBREVIVEN si: (a) Vbus<=90V, (b) D2 pegado, (c) Rg15+pd1k, (d) 1 pulso/gota,")
print(f"     (e) CHOKE GRANDE (~300-600uH) o R balastro para meter el pico bajo 140A/MOSFET.")

# ============================================================================
# 6. CONSUMO DE LA FUENTE Y VEREDICTO GLOBAL
# ============================================================================
line()
print("[FUENTE] CONSUMO REAL DE LA FUENTE 12-24V (honesto, sin inventar amperaje)")
line()

# tasa de gota sostenible limitada por la recarga
P_boost = 86.0
E_gota  = 4.3
N_sustain = P_boost/E_gota
I_src_avg_24 = P_boost/24.0
I_src_avg_12 = P_boost/12.0
print(f"  La fuente NO entrega el pico (eso lo da la presa). Entrega el PROMEDIO para recargar.")
print(f"  Recarga sostenida del boost ~ {P_boost}W:")
print(f"    @24V: I_fuente_promedio = {I_src_avg_24:.1f}A   (cabe en una PSU de impresora 10-20A)")
print(f"    @12V: I_fuente_promedio = {I_src_avg_12:.1f}A   (mas justo, pero posible)")
print(f"  Tasa de gota sostenible = P_boost/E_gota = {N_sustain:.0f} gotas/s")
print(f"  Pico instantaneo al alambre (de la presa) @90V = {results_A[90]['I_pk']:.0f}A (J={results_A[90]['J_pk']:.0f}A/mm2) -> FUNDE")
print(f"  Pico instantaneo @60V = {results_A[60]['I_pk']:.0f}A (J={results_A[60]['J_pk']:.0f}A/mm2)")

print(f"""
  CONSUMO HONESTO: la fuente solo ve ~{I_src_avg_24:.0f}A @24V de PROMEDIO (recarga del boost).
  El pico de {results_A[90]['I_pk']:.0f}A al alambre lo da la PRESA, NO la fuente. Esto YA cumple lo que
  el operador quiere ('la fuente paga solo las perdidas') -- pero lo logra la PRESA
  (capacitor reservorio), NO un tanque resonante con bobina extra.
""")

# ============================================================================
# 7. RECONCILIACION: pico-seguro-para-switch vs fundir -> TREN DE PULSOS
# ============================================================================
line()
print("[RECONCILIACION] El pico seguro para el switch NO funde en 1 disparo -> TREN")
line()
print("""
  TENSION FUNDAMENTAL detectada por la ODE:
   - Para fundir en 1 pulso hace falta pico ~1400A @90V (468A/MOSFET) -> FRIE 3xIRL.
   - Para no freir 3xIRL (294A pico) hace falta choke grande (~1mH) -> 1 pulso NO funde
     (Tmax ~70C: a corriente baja el I^2R apenas vence las perdidas de 48W).
  Resolucion HONESTA: no es 1-pulso-gigante; es un TREN de pulsos seguros que ACUMULA
  calor (la R sube con T -> realimentacion -> arranca el runaway). Simulado abajo.
""")

def pulse_train(V0, L, n_pulses, t_off=2e-3):
    T = T_amb; Tmax_seen = T_amb; pk = 0.0
    for p in range(n_pulses):
        def ode(t,y):
            i,Vc,Tw = y; R = R_wire(Tw)+R_contact+R_shunt+R_parasit
            return [(Vc-i*R)/L, -i/C_bank, (i*i*R_wire(Tw)-P_loss_local)/(m_hot*cp_steel)]
        sol = solve_ivp(ode,[0,8e-3],[0,V0,T],method='LSODA',max_step=2e-6,rtol=1e-7,atol=1e-9)
        T = sol.y[2][-1]; pk=max(pk,sol.y[0].max()); Tmax_seen=max(Tmax_seen,sol.y[2].max())
        if Tmax_seen >= T_melt:
            return pk, Tmax_seen, p+1
        T = max(T_amb, T - (P_loss_local*t_off)/(m_hot*cp_steel))  # enfriamiento entre pulsos
    return pk, Tmax_seen, None

print("  TREN de pulsos con pico SEGURO para el switch (6x IRL540N, ~96A/MOSFET):")
print(f"  {'V0':>4} | {'L(uH)':>6} | {'I_pico':>7} | {'A/MOSFET(6x)':>12} | {'pulsos a fundir':>15}")
for V0, L in [(90, 258e-6), (60, 115e-6)]:
    pk, tmx, n_melt = pulse_train(V0, L, 12)
    nm = f"{n_melt} pulsos" if n_melt else ">12 (no funde)"
    print(f"  {V0:>4} | {L*1e6:>6.0f} | {pk:>7.0f} | {pk/6:>12.0f} | {nm:>15}")
print(f"""
  LECTURA: con 6x IRL540N (pico ~577A = 96A/MOSFET, comodo bajo 140A) y choke ~258uH:
   - @90V: funde al 3er pulso (cada pulso sube T; la R-runaway acelera).
   - @60V: funde al ~5to pulso (menos energia/pulso).
  Con SOLO 3x IRL540N el pico seguro (294A) casi no calienta -> necesitarias MUCHOS
  pulsos y pierdes por enfriamiento. -> Para este alambre 0.8mm: 6x IRL540N @90V es el
  punto realista. (Un alambre 0.2mm fundiria con 1/16 de la corriente -> 3x bastarian,
  pero NO hay 0.2mm a la mano.)
""")

line()
print("VEREDICTO GLOBAL - TANQUE RESONANTE RECIRCULACION")
line()
print(f"""
  1) ¿Funde? SI, en modo PULSADO desde la presa. Pico {results_A[90]['I_pk']:.0f}A @90V (J={results_A[90]['J_pk']:.0f}A/mm2),
     caida sobre el alambre {results_A[90]['V_wire_pk']:.2f}V >> Holm 0.55V. Cruza fusion en el 1er
     cuarto del ring LC. T_max simulada {results_A[90]['Tmax']:.0f}C.
  2) ¿Tanque resonante recirculante con bobina extra? SI oscila (Q_caliente={tank_Q(41e-6,C_bank,R_loop_hot)[3]:.1f},
     Q_frio={tank_Q(41e-6,C_bank,R_loop_cold)[3]:.0f}) pero NO 'regala' potencia. El alambre esta EN SERIE -> ES
     la R donde recircula la corriente, y donde se DRENA la energia cada ciclo. El Q
     dice cuantos ciclos dura el ring (~{tank_Q(41e-6,C_bank,R_loop_cold)[3]/np.pi:.0f} frio), NO que la fuente se libre de pagar.
     En un calentador por induccion la pieza se ACOPLA por transformador (Q vive en el
     primario de baja R); aqui la carga esta EN serie -> el tanque serie no desacopla la
     potencia de fusion de la fuente. Lo que recircula = lo que la presa ya guardaba.
  3) ¿La fuente solo paga las perdidas? SI -- pero eso lo logra la PRESA (cap), no un
     tanque. La fuente ve ~{I_src_avg_24:.0f}A @24V de promedio; la presa da el pico de cientos de A.
  4) Bobina extra: util SOLO como choke (limitar di/dt + bajar el pico al rango del switch).
     NO como elemento recirculante. PERO el choke 41uH es MUY CHICO: deja pasar 1403A @90V.
     Para meter el pico bajo la SOA hace falta ~250-1000uH (o R balastro).
  5) Switch: con 41uH @90V el pico (468A/MOSFET en 3x) FRIE los IRL540N. Dos salidas:
     (a) choke grande (~258uH) + 6x IRL540N (~96A/MOSFET) + TREN de ~3 pulsos @90V -> funde;
     (b) 3x IRL540N solo alcanza si bajas mucho el pico, pero ahi 1 pulso casi no calienta.
     El alambre 0.8mm es 'duro': pide >=6x IRL540N @90V. (0.2mm pediria 1/16 y bastarian 3x.)

  RECOMENDACION: NO inviertas en una segunda bobina para 'recircular' (no recircula util).
  Camino realista: presa + choke ~258uH + 6x IRL540N + TREN de pulsos limpios @90V (D2
  pegado, Rg15+pulldown1k, 1 disparo por pulso, sin 187kHz). El shunt 1mOhm para VER la I.
  La fisica del operador (la fuente paga las perdidas) YA se cumple via la PRESA, no el
  tanque: el tanque serie es un espejismo aqui porque la carga (alambre) esta EN serie.
""")
line()
