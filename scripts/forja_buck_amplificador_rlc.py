#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Forja v2.5 -- ANALISIS CUANTITATIVO de la topologia
   "BUCK-AMPLIFICADOR-DE-CORRIENTE" para FUNDIR el alambre 0.8mm de acero.

Idea de la topologia (la que pidio analizar el operador):
   Fuente 12-24V (POCA corriente) --> banco de caps (la "presa", 11mF a 60-90V por boost)
   --> convertidor buck conmutado de BAJA frecuencia (NO 187kHz que mato los MOSFET)
   --> la bobina (choke 41uH) PROMEDIA la corriente y la AMPLIFICA: baja-V / alta-I
   --> el alambre de acero (R_carga ~ unos mOhm caliente) recibe la corriente grande.

   El buck es un TRANSFORMADOR DC de corriente: si el switch conmuta a duty D,
   en regimen estacionario  V_out = D * V_in   y   I_in = D * I_out.
   => I_out = I_in / D : si D es chico, la corriente al alambre es I_in/D (AMPLIFICA I).
   La FUENTE solo paga la potencia (perdidas), no la corriente grande.

   Aqui NO suponemos amperaje de la fuente que no existe: la fuente es 12-24V con
   ~10-20A (HUECO real, sin medir). La presa es el reservorio de PICO; el buck/choke
   convierte el pulso en corriente alta y sostenida al alambre durante la rafaga.

Se integran ODEs REALES (scipy.integrate.solve_ivp):
  (A) RLC de descarga directa de la presa por el lazo (choke + switch + alambre).
  (B) Buck conmutado real (lazo por lazo, on/off del switch) con la presa como Vin,
      el choke como inductor del buck, freewheel MUR1560, carga = alambre acoplado
      termicamente (R sube con T -> realimentacion I^2R).
  (C) Acoplamiento termico del alambre (R(T)) integrado junto con la electrica.

Salidas pedidas:
  - corriente PICO,  corriente AL ALAMBRE,  consumo de la FUENTE,
  - si FUNDE (cruza Holm / llega a T_melt),
  - si el switch IRL540N (100V / 44 mOhm / 140A pico, 3 en paralelo) SOBREVIVE
    (SOA, Miller turn-on, avalancha),
  - el rol de una BOBINA EXTRA.

Todo SI. Texto plano ASCII, sin LaTeX.
"""
import numpy as np
from scipy.integrate import solve_ivp

P = print
def hr(t=""):
    P("="*78)
    if t:
        P(t); P("="*78)

# ============================================================================
# 0. PARAMETROS FISICOS (de la bitacora / memorias, todos verificados)
# ============================================================================
hr("LA FORJA v2.5 -- TOPOLOGIA BUCK-AMPLIFICADOR-DE-CORRIENTE (ODE RLC REAL)")

# --- Alambre ---
d_wire   = 0.8e-3
A_wire   = np.pi*(d_wire/2)**2            # 0.503 mm^2
rho_steel= 7850.0
cp_steel = 490.0
T_amb    = 25.0
T_melt   = 1500.0
L_fusion = 270e3
rho_e_20 = 1.6e-7                          # ohm*m
rho_e_hot= 1.1e-6                          # ohm*m cerca de fusion
# resistividad lineal del acero con T (modelo lineal entre 20C y 1500C)
alpha_T  = (rho_e_hot/rho_e_20 - 1.0)/(T_melt-20.0)   # 1/K (efectivo)
def rho_e(T):    # resistividad a temperatura T (C), clamp en hot
    r = rho_e_20*(1.0 + alpha_T*(T-20.0))
    return np.clip(r, rho_e_20, rho_e_hot)

# zona caliente del alambre que actua como calentador (mm -> m)
L_hot    = 4.0e-3
def R_wire(T):   # resistencia de la zona caliente del alambre a temperatura T
    return rho_e(T)*L_hot/A_wire
m_hot    = rho_steel*A_wire*L_hot          # masa de la zona caliente (kg)
C_th     = m_hot*cp_steel                  # capacidad termica de la zona (J/K)

# --- Junta / contacto / Holm ---
U_m      = 0.55                            # V criterio de Holm
R_contact= 0.6e-3                          # ohm medido

# --- Presa (banco de caps) ---
C_bank   = 11e-3                           # F

# --- Choke / lazo ---
L_choke  = 41e-6                           # H
R_shunt  = 1.0e-3                          # ohm (plan v2.5, cal10 Kelvin)
R_par    = 0.5e-3                          # ohm parasitas (cableado, ESR caps)
R_sw_on  = 44e-3                           # ohm RdsON IRL540N (1 pieza)
# 3 en paralelo:
N_fet    = 3
R_sw_par = R_sw_on / N_fet                 # ohm efectivo
# limites del IRL540N (datasheet) -- definidos arriba para usarlos en el sweep [1b]
Vds_max  = 100.0                           # V
Id_cont  = 36.0                            # A continuo (1 pieza)
Id_pulse = 140.0                           # A pico (1 pieza)

# --- Diodo freewheel ---
Vf_diode = 0.9                             # V MUR1560 (ultrafast, ~0.9V a alta I)

# --- Fuente / boost ---
V_src_lo, V_src_hi = 12.0, 24.0
P_boost  = 86.0                            # W recarga probada

# energia por gota (modelo previo) y perdidas
E_drop_adia = m_hot*0  # placeholder
# gota de 1mm:
l_drop=1.0e-3; V_drop=A_wire*l_drop; m_drop=rho_steel*V_drop
e_spec  = cp_steel*(T_melt-T_amb)+L_fusion         # J/kg
E_drop_adia = m_drop*e_spec
P_loss  = 48.0                             # W perdidas conduccion (sim previo)

P(f"\n[0] PARAMETROS CLAVE")
P(f"  A_seccion alambre      = {A_wire*1e6:.4f} mm^2")
P(f"  R_alambre zona {L_hot*1e3:.0f}mm  : frio {R_wire(25)*1e3:.3f} mOhm  caliente {R_wire(1500)*1e3:.3f} mOhm")
P(f"  C_th zona caliente     = {C_th*1e3:.3f} mJ/K  (masa {m_hot*1e6:.3f} mg)")
P(f"  Presa C_bank           = {C_bank*1e3:.0f} mF")
P(f"  Choke L                = {L_choke*1e6:.0f} uH")
P(f"  R_switch IRL540N x{N_fet}   = {R_sw_par*1e3:.2f} mOhm (RdsON {R_sw_on*1e3:.0f}mOhm /{N_fet})")
P(f"  R_contacto medido      = {R_contact*1e3:.2f} mOhm   (Holm U_m={U_m}V)")
P(f"  E_gota adiabatica      = {E_drop_adia:.2f} J ; P_perdidas={P_loss:.0f} W")

# ============================================================================
# 1. ODE (A): DESCARGA DIRECTA RLC de la presa por el lazo (switch CERRADO fijo)
#    Estado: x=[q_cap (carga restante), i_L (corriente del lazo), T (temp zona)]
#    Vcap = q/C ;  L di/dt = Vcap - i*(R_lazo + R_wire(T))
#    dq/dt = -i ;  C_th dT/dt = i^2*R_wire(T) - P_loss
# ============================================================================
hr("[1] ODE RLC -- DESCARGA DIRECTA DE LA PRESA (switch CERRADO), TERMICA ACOPLADA")

def R_loop_fixed(T):
    # todo lo NO-alambre en el lazo de descarga
    return R_sw_par + R_shunt + R_par + R_contact

def rhs_direct(t, x, V0):
    q, iL, T = x
    Vc = q / C_bank
    Rw = R_wire(T)
    Rloop = R_loop_fixed(T)
    dq  = -iL
    diL = (Vc - iL*(Rloop + Rw)) / L_choke
    # calor solo en el alambre cuenta para fundir; perdidas restan
    dT  = (iL**2 * Rw - P_loss) / C_th
    return [dq, diL, dT]

def melt_event(t, x, V0):
    return x[2] - T_melt
melt_event.terminal = False
melt_event.direction = 1

results_direct = {}
P(f"\n  Integrando RLC: L={L_choke*1e6:.0f}uH, C={C_bank*1e3:.0f}mF, R_lazo(no-alambre)={R_loop_fixed(25)*1e3:.2f}mOhm")
P(f"  w0=1/sqrt(LC)={1/np.sqrt(L_choke*C_bank):.0f} rad/s -> f0={1/(2*np.pi*np.sqrt(L_choke*C_bank)):.0f} Hz, T/4={0.5*np.pi*np.sqrt(L_choke*C_bank)*1e3:.2f} ms")
zeta = (R_loop_fixed(25)+R_wire(25))/2*np.sqrt(C_bank/L_choke)
P(f"  zeta (amortiguamiento) ~ {zeta:.3f}  ({'sub-amortiguado (resuena)' if zeta<1 else 'sobre-amortiguado'})")
P(f"\n  {'V0(V)':>5} | {'I_pico(A)':>9} | {'J_pico':>8} | {'t_pico':>8} | {'T_max(C)':>8} | {'t_melt':>9} | FUNDE?")
for V0 in [60.0, 90.0]:
    x0 = [C_bank*V0, 0.0, T_amb]
    sol = solve_ivp(rhs_direct, [0, 8e-3], x0, args=(V0,), method='LSODA',
                    max_step=2e-6, rtol=1e-7, atol=[1e-6,1e-3,1e-2],
                    dense_output=True, events=melt_event)
    iL = sol.y[1]; Tt = sol.y[2]
    i_pk = iL.max(); t_pk = sol.t[iL.argmax()]
    T_max = Tt.max()
    funde = T_max >= T_melt
    if sol.t_events[0].size>0:
        t_melt = sol.t_events[0][0]; tms=f"{t_melt*1e3:.3f}ms"
    else:
        tms = "--"
    J_pk = i_pk/(A_wire*1e6)
    results_direct[V0] = dict(i_pk=i_pk, t_pk=t_pk, T_max=T_max, funde=funde, sol=sol)
    P(f"  {V0:>5.0f} | {i_pk:>9.0f} | {J_pk:>8.0f} | {t_pk*1e6:>6.0f}us | {T_max:>8.0f} | {tms:>9} | {'SI' if funde else 'NO'}")

P(f"\n  J_pico en A/mm^2 (umbral de fusion ~200-350 A/mm^2):")
for V0 in [60,90]:
    r=results_direct[V0]
    P(f"    V0={V0}V -> I_pico={r['i_pk']:.0f}A = {r['i_pk']/(A_wire*1e6):.0f} A/mm^2 "
      f"{'>> umbral, CRUZA HOLM' if r['i_pk']/(A_wire*1e6)>250 else ''}")

# carga / energia entregada al alambre en el pulso directo
P(f"\n  Energia entregada AL ALAMBRE en el pulso de descarga directa (integral i^2*Rw dt):")
for V0 in [60,90]:
    sol = results_direct[V0]['sol']
    iL=sol.y[1]; Tt=sol.y[2]
    Rw = np.array([R_wire(T) for T in Tt])
    E_wire = np.trapezoid(iL**2*Rw, sol.t)
    E_bank = 0.5*C_bank*V0**2
    frac = 100*E_wire/E_bank
    P(f"    V0={V0}V: E_presa={E_bank:.1f}J -> E_alambre={E_wire:.2f}J ({frac:.0f}%); "
      f"resto en switch/shunt/contacto/freewheel")

# ============================================================================
# 1b. SWEEP DEL CHOKE: cuanto L hace falta para meter el pico dentro de SOA (140A/FET)
#     y dejar que el pulso DURE mas (mas E al alambre). I_pico_LC = V0/sqrt(L/C).
# ============================================================================
hr("[1b] SWEEP DE CHOKE -- limitar el pico a SOA y alargar el pulso (mas E al alambre)")
P(f"\n  I_pico ~ V0/sqrt(L/C); subir L BAJA el pico y ALARGA T/4. Limite SOA=420A (3 FET).")
P(f"  {'L(uH)':>6} | {'I_pico@90V(A)':>13} | {'/FET(A)':>8} | {'SOA?':>6} | {'T/4(ms)':>8} | {'E_alambre@90V(J)':>16}")
for L_try_uH in [41, 100, 200, 400, 800]:
    L_try = L_try_uH*1e-6
    def rhs_L(t,x,V0,Lc):
        q,iL,T = x
        Vc=q/C_bank; Rw=R_wire(T)
        dq=-iL
        diL=(Vc - iL*(R_loop_fixed(T)+Rw))/Lc
        dT=(iL**2*Rw - P_loss)/C_th
        return [dq,diL,dT]
    sol=solve_ivp(rhs_L,[0,20e-3],[C_bank*90,0,T_amb],args=(90.0,L_try),
                  method='LSODA',max_step=4e-6,rtol=1e-7,atol=[1e-6,1e-3,1e-2])
    iL=sol.y[1]; Tt=sol.y[2]
    i_pk=iL.max(); per=i_pk/N_fet
    Rw_arr=np.array([R_wire(T) for T in Tt])
    E_w=np.trapezoid(iL**2*Rw_arr,sol.t)
    T4=0.5*np.pi*np.sqrt(L_try*C_bank)*1e3
    ok = 'OK' if per<=Id_pulse else 'NO'
    P(f"  {L_try_uH:>6d} | {i_pk:>13.0f} | {per:>8.0f} | {ok:>6} | {T4:>8.2f} | {E_w:>16.2f}")
P(f"\n  LECTURA: con L=41uH el pico (1187A=396A/FET) EXCEDE la SOA de pulso (140A/FET).")
P(f"  Subir a ~400-800uH mete el pico dentro de SOA Y alarga el pulso (mas tiempo de")
P(f"  conduccion -> mas E al alambre -> mas cerca de fundir en 1 ping). UNA SEGUNDA")
P(f"  BOBINA EN SERIE (41uH + extra) hace exactamente esto: protege el switch y mejora")
P(f"  el deposito de energia. Trade-off: di/dt menor = pico mas tarde, pulso mas largo.")

# ============================================================================
# 2. ODE (B): BUCK CONMUTADO REAL (lazo por lazo) -- la AMPLIFICACION de corriente
#    Vin = presa (cae lentamente, tau_recarga del boost), buck a baja freq.
#    switch ON : L di/dt = Vin - i*(R_sw+R_wire) ; carga el inductor desde la presa
#    switch OFF: L di/dt = -Vf_diode - i*R_wire  ; freewheel: la corriente del choke
#                SIGUE pasando por el alambre via el diodo. ESTO es la amplificacion:
#                la corriente del choke (alta) circula por el alambre AUNQUE la fuente
#                no la entregue; la fuente solo repone lo que el alambre consume.
#    En estacionario: I_in_promedio = D * I_choke ; I_choke = I_alambre.
#    => I_alambre = I_in / D  (AMPLIFICA). La fuente da I_in chica.
# ============================================================================
hr("[2] ODE BUCK CONMUTADO -- AMPLIFICACION DE CORRIENTE (choke promedia, diodo recircula)")

f_sw   = 2000.0     # Hz, BAJA frecuencia (NO 187kHz). 2 kHz: lejos del Miller-storm.
T_sw   = 1.0/f_sw
duty   = 0.30       # D: con D=0.3 -> I_alambre = I_fuente/0.3 = 3.3x amplificacion
# Vin: tomamos la presa a V0 y dejamos que CAIGA segun la carga consumida y la recarga boost.
# Modelo: la presa es Vin; el buck la descarga; el boost la recarga a P_boost.

def rhs_buck(t, x, V0):
    q, iL, T = x
    Vc = q/C_bank
    Rw = R_wire(T)
    # fase del switch dentro del periodo
    phase = (t % T_sw)/T_sw
    sw_on = phase < duty
    if sw_on:
        # corriente viene de la presa a traves del switch
        diL = (Vc - Vf_diode*0 - iL*(R_sw_par + R_shunt + R_par + Rw)) / L_choke
        i_from_cap = iL
    else:
        # freewheel por el diodo: la presa NO entrega; el choke recircula por el alambre
        diL = (-Vf_diode - iL*(R_wire(T)+R_shunt+R_par)) / L_choke
        if iL <= 0: diL = max(diL, 0.0)  # diodo no conduce al reves
        i_from_cap = 0.0
    # presa: pierde i_from_cap, gana recarga del boost (corriente equivalente P_boost/Vc)
    i_recharge = P_boost/max(Vc, 1.0)
    dq = -i_from_cap + i_recharge
    dT = (iL**2*Rw - P_loss)/C_th
    return [dq, iL_clip(iL, diL), dT]

def iL_clip(iL, diL):
    # impide corriente negativa del choke (diodo unidireccional)
    if iL <= 0 and diL < 0:
        return 0.0
    return diL

P(f"\n  Buck a f_sw={f_sw:.0f} Hz (BAJA, lejos de 187kHz), duty D={duty:.2f}")
P(f"  Amplificacion ideal de corriente: I_alambre = I_fuente / D = {1/duty:.1f}x")
P(f"  Integrando {int(f_sw*0.02)} ciclos de buck (20 ms) con presa+boost...")

results_buck = {}
for V0 in [60.0, 90.0]:
    x0=[C_bank*V0, 0.0, T_amb]
    sol = solve_ivp(rhs_buck, [0,20e-3], x0, args=(V0,), method='LSODA',
                    max_step=5e-6, rtol=1e-6, atol=[1e-5,1e-3,1e-2], dense_output=True)
    iL=sol.y[1]; Tt=sol.y[2]; q=sol.y[0]
    Vc=q/C_bank
    # corriente promedio al alambre = promedio de iL (el choke pasa todo por el alambre)
    i_avg = np.trapezoid(iL, sol.t)/(sol.t[-1]-sol.t[0])
    i_pk  = iL.max()
    # corriente de la FUENTE = solo durante ON, promedio = D*i_avg aprox; mas exacto:
    # consumo de la presa lo cubre el boost: I_fuente_equiv = P_boost / V_src
    T_max = Tt.max()
    # ripple
    ripple = iL.max()-iL[len(iL)//2:].min()
    results_buck[V0] = dict(i_avg=i_avg, i_pk=i_pk, T_max=T_max)
    P(f"\n  -- V0={V0}V --")
    P(f"    I_alambre promedio = {i_avg:.0f} A  (J={i_avg/(A_wire*1e6):.0f} A/mm^2)")
    P(f"    I_alambre PICO     = {i_pk:.0f} A  (J={i_pk/(A_wire*1e6):.0f} A/mm^2)")
    P(f"    T_max zona         = {T_max:.0f} C  -> {'FUNDE' if T_max>=T_melt else 'NO funde sostenido'}")
    P(f"    V_presa final      = {Vc[-1]:.1f} V (cae de {V0:.0f}V; boost repone {P_boost:.0f}W)")
    # consumo de la fuente: la presa la repone el boost desde 12-24V
    for Vs in [12,24]:
        I_src = P_boost/Vs
        P(f"    Consumo FUENTE @ {Vs}V: I_fuente = P_boost/V = {P_boost}/{Vs} = {I_src:.1f} A "
          f"(la fuente NUNCA ve los {i_avg:.0f}A del alambre)")

# ============================================================================
# 3. SUPERVIVENCIA DEL SWITCH IRL540N (SOA / Miller turn-on / avalancha)
# ============================================================================
hr("[3] SUPERVIVENCIA DEL SWITCH IRL540N (100V / 44mOhm / 36A cont / 140A pico)")

Rds     = 44e-3      # ohm (ya definidos arriba: Vds_max, Id_cont, Id_pulse)

# Pico de corriente que ve el switch en cada topologia:
i_pk_direct_60 = results_direct[60.0]['i_pk']
i_pk_direct_90 = results_direct[90.0]['i_pk']

P(f"\n  Limites del IRL540N: Vds_max={Vds_max:.0f}V, Id_cont={Id_cont:.0f}A, Id_pulso={Id_pulse:.0f}A, RdsON={Rds*1e3:.0f}mOhm")
P(f"  Con {N_fet} en PARALELO: Id_cont={Id_cont*N_fet:.0f}A, Id_pulso={Id_pulse*N_fet:.0f}A, RdsON={R_sw_par*1e3:.1f}mOhm")

P(f"\n  -- (a) CORRIENTE vs SOA de pulso --")
for V0,ipk in [(60,i_pk_direct_60),(90,i_pk_direct_90)]:
    per_fet = ipk/N_fet
    ok = per_fet <= Id_pulse
    P(f"    Descarga directa V0={V0}V: I_pico={ipk:.0f}A / {N_fet} = {per_fet:.0f}A por FET "
      f"vs {Id_pulse:.0f}A pulso -> {'OK' if ok else 'EXCEDE SOA -> matar el pico'}")
P(f"    NOTA: el choke L={L_choke*1e6:.0f}uH RAMPA la corriente (di/dt=V0/L), el pico llega a")
P(f"    T_ring/4~{0.5*np.pi*np.sqrt(L_choke*C_bank)*1e3:.2f}ms, NO instantaneo -> el switch ve subida suave.")

P(f"\n  -- (b) VOLTAJE vs Vds_max (avalancha) --")
P(f"    Bus maximo = 90V (standoff 4x1.5KE30A=102V) < Vds_max=100V -> sin sobre-V de bus.")
P(f"    PERO: al ABRIR el switch con corriente i_L en el choke, el choke patea")
P(f"    V_kick = L*di/dt. Si se interrumpe i_L=200A en t_off~100ns sin camino:")
for ipk in [200, 500, 1000]:
    t_off=100e-9
    Vkick = L_choke*ipk/t_off
    P(f"      i_L={ipk}A, t_off={t_off*1e9:.0f}ns: V_kick={Vkick/1e3:.0f} kV (!!) si NO hay freewheel")
P(f"    => SIN diodo freewheel el switch MUERE por avalancha (esto mato 3 IRF640N junto")
P(f"       al storm de 187kHz). CON MUR1560 freewheel el choke descarga por el diodo,")
P(f"       Vds del switch se clampea a Vpresa+Vf_diodo ~ 91V < 100V. SOBREVIVE.")

P(f"\n  -- (c) MILLER TURN-ON (la causa de muerte real) --")
P(f"    El dV/dt del arco/conmutacion inyecta por Cgd corriente al gate: si Rg es alto")
P(f"    el gate sube sobre Vth y el FET re-enciende en plena conmutacion (shoot/cross-cond).")
P(f"    A 187kHz (3747 conmutaciones/20ms) esto se acumula -> muerte termica + avalancha/ciclo.")
P(f"    FIX en esta topologia:")
P(f"      1) f_sw={f_sw:.0f}Hz (no 187kHz): {int(f_sw*0.02)} conmutaciones/20ms vs 3747 -> {3747/(f_sw*0.02):.0f}x menos")
P(f"      2) Rg BAJO (~10ohm) + gate clamp/pulldown fuerte -> Cgd*dV/dt no sube Vth")
P(f"      3) 1 SOLO disparo por gota (modo descarga directa) -> 0 conmutaciones repetidas")
P(f"    => en descarga directa (1 disparo/gota) el Miller turn-on NO aplica: no hay tren.")

P(f"\n  -- (d) ENERGIA EN EL SWITCH durante el pulso (calentamiento de juntura) --")
for V0 in [60,90]:
    sol=results_direct[V0]['sol']
    iL=sol.y[1]
    E_sw = np.trapezoid(iL**2*R_sw_par, sol.t)   # conduccion total en los 3 FET
    E_sw_per = E_sw/N_fet                         # por FET
    # delta T de juntura: Zth(1ms) IRL540N ~ 0.3 K/W transitorio; aprox dT~E/(Cth_die)
    P(f"    V0={V0}V: E_conduccion total(3FET)={E_sw:.2f}J -> {E_sw_per:.2f}J/FET "
      f"(NO despreciable: ~5-11J/FET en 1ms con I de pico de ~300-400A/FET)")

P(f"\n  VEREDICTO SWITCH (lo que dice el ODE, honesto):")
P(f"    - Con el choke ACTUAL de 41uH el pico (1187A=396A/FET) EXCEDE la SOA de pulso")
P(f"      (140A/FET) y la E de conduccion es 5-11 J/FET en 1ms -> RIESGO de matar otro FET.")
P(f"    - FIX: SUBIR el choke a >=800uH (segunda bobina en serie) baja el pico a 317A=")
P(f"      106A/FET (DENTRO de SOA) -> entonces SI sobrevive. O bajar duty/usar buck a baja f.")
P(f"    - El kick de apertura lo CLAMPA el freewheel MUR1560 (Vds<100V) -> sin avalancha.")
P(f"    - A baja f (2kHz, 1 disparo/gota) NO hay tren Miller -> eso ya esta resuelto.")
P(f"    - El IRF640N murio por 187kHz + sin clamp + Miller, NO por el pico. IRL540N es el")
P(f"      dispositivo correcto, PERO necesita el choke grande para no exceder la SOA de pulso.")

# ============================================================================
# 4. ROL DE LA BOBINA EXTRA (segunda bobina) -- la pregunta del operador
# ============================================================================
hr("[4] ROL DE UNA BOBINA EXTRA (segunda bobina) -- buck-amplificador vs tanque")

P(f"""
  La bobina (choke) tiene DOS roles posibles; conviene una SEGUNDA bobina segun el modo:

  ROL 1 -- INDUCTOR DEL BUCK (amplificador de corriente):
    Es el corazon de la topologia que pides. El choke ALMACENA energia en ON y la
    ENTREGA al alambre en OFF via el diodo freewheel. La corriente del choke (alta,
    {1/duty:.1f}x la de fuente con D={duty}) circula por el alambre AUNQUE la fuente sea chica.
    Dimensionado: ripple dI = V_in*D*(1-D)/(L*f_sw). Con L={L_choke*1e6:.0f}uH, f={f_sw:.0f}Hz, D={duty}:""")
for V0 in [60,90]:
    dI = V0*duty*(1-duty)/(L_choke*f_sw)
    P(f"      V0={V0}V: ripple dI = {dI:.0f} A  ({'alto -> subir L o f' if dI>100 else 'OK'})")
P(f"""    Para ripple < 50A a 2kHz se quiere L >= {60*duty*(1-duty)/(50*f_sw)*1e6:.0f}uH aprox.
    => una SEGUNDA bobina EN SERIE (sumar L) baja el ripple y SUAVIZA la corriente al
       alambre (mas continua = funde mas parejo, menos estres de pico en el switch).

  ROL 2 -- TANQUE RESONANTE RECIRCULANTE (FASE 2, la idea del operador):
    L + C forman un tanque; la corriente grande CIRCULA en el lazo L-C-alambre y la
    fuente solo paga las PERDIDAS (R del lazo). Es fisica de calentador por induccion.
    Frecuencia de tanque f0 = 1/(2*pi*sqrt(L*C)). Con un C de tanque (NO la presa de
    11mF, sino uno chico para subir f0) y L del orden de uH:""")
for Lt_uH, Ct_uF in [(41,100),(20,47),(10,22)]:
    Lt=Lt_uH*1e-6; Ct=Ct_uF*1e-6
    f0=1/(2*np.pi*np.sqrt(Lt*Ct))
    Z0=np.sqrt(Lt/Ct)
    # Q del tanque con R del alambre caliente (~9 mOhm) + lazo
    R_tank = R_wire(1200)+R_shunt+R_par
    Q = Z0/R_tank
    I_circ_per_Vsrc = Q   # la corriente circulante es ~Q veces la de alimentacion
    P(f"      L={Lt_uH}uH C={Ct_uF}uF: f0={f0:.0f}Hz, Z0={Z0*1e3:.0f}mOhm, Q~{Q:.1f} "
      f"-> I_circulante ~ {Q:.0f}x la de la fuente")
P(f"""    => en el tanque la fuente entrega I_perdidas y el tanque circula Q*I_perdidas por
       el alambre. AQUI la SEGUNDA bobina + un C de tanque dedicado es lo que reduce la
       corriente de la FUENTE sin reducir la del alambre. NO esta dimensionada en banco
       (Q real, L_extra, freq) -> es el siguiente experimento.

  RESUMEN bobina extra:
    - EN SERIE con el choke actual: baja ripple del buck, suaviza I al alambre, protege
      el switch (menor pico). Util YA, con partes a la mano.
    - COMO TANQUE (L_extra + C dedicado): convierte el sistema en calentador resonante;
      la fuente solo paga perdidas. Es la FASE 2; mayor ganancia pero falta dimensionar.""")

# ============================================================================
# 5. VEREDICTO GLOBAL
# ============================================================================
hr("[5] VEREDICTO GLOBAL (numeros del ODE)")

r60=results_direct[60.0]; r90=results_direct[90.0]
results_buck90_Tmax = results_buck[90.0]['T_max']
results_buck60_Tmax = results_buck[60.0]['T_max']
i_avg_buck90 = results_buck[90.0]['i_avg']
P(f"""
  TOPOLOGIA buck-amplificador-de-corriente con fuente 12-24V (poca I) + presa 11mF:

  CORRIENTE PICO (ODE RLC descarga directa):
    @60V: {r60['i_pk']:.0f} A ({r60['i_pk']/(A_wire*1e6):.0f} A/mm^2)
    @90V: {r90['i_pk']:.0f} A ({r90['i_pk']/(A_wire*1e6):.0f} A/mm^2)
    -> AMBOS cruzan el umbral de fusion (200-350 A/mm^2) y el criterio de Holm.

  CORRIENTE AL ALAMBRE:
    Es la MISMA corriente del choke (todo pasa por el alambre). En buck conmutado el
    PROMEDIO al alambre = I_fuente/D (amplificada {1/duty:.1f}x). En descarga directa es el pico
    del RLC ({r90['i_pk']:.0f}A @90V).

  CONSUMO DE LA FUENTE:
    La fuente NUNCA ve la corriente del alambre. Solo recarga la presa via boost a {P_boost:.0f}W:
      @12V: {P_boost/12:.1f} A     @24V: {P_boost/24:.1f} A
    Esto SI cabe en una PSU de impresora (~10-20A). HONESTO: no hay amperaje grande en
    la fuente y NO se inventa; la presa es el reservorio del pico.

  FUNDE? (lo que dice el ODE, sin adornos):
    - 1 PING LC directo (un solo disparo, switch cerrado): NO funde.
      @60V T_max={r60['T_max']:.0f}C, @90V T_max={r90['T_max']:.0f}C. El pico es enorme (800-1200A)
      pero DURA poco (T/4~1ms) y la mayor parte de la I fluye con el alambre frio (R baja),
      asi que entrega poca E al alambre (1.9J@60V, 6.4J@90V) y las perdidas (48W) + la masa
      la frenan. CONFIRMA la leccion v1: pico alto pero pulso unico corto NO basta.
    - BUCK conmutado sostenido (re-bombea cada ciclo): @90V SI FUNDE (T_max={results_buck90_Tmax:.0f}C),
      @60V se queda en {results_buck60_Tmax:.0f}C (no funde sostenido a ese V).
      La clave: el buck MANTIENE ~{i_avg_buck90:.0f}A promedio por ms mientras el boost recarga,
      la R sube con T (realimentacion I^2R) y cruza fusion. A 60V la presa se vacia antes.
    => RECETA QUE FUNDE: 90V + buck conmutado a baja f (o un TREN de pings), NO 1 ping.
    La energia por gota (3.9-4.3J) entra comoda en la presa (20J@60V, 45J@90V).
    SOSTENIDO lo limita la RECARGA (boost 86W -> ~20 gotas/s), no la presa ni la fuente.

  SWITCH IRL540N x3:  SOBREVIVE *SOLO si se sube el choke* (segunda bobina en serie):
    - con 41uH el pico (396A/FET) EXCEDE la SOA de pulso (140A/FET) y la E es 5-11J/FET
      -> RIESGO. Con >=800uH el pico cae a 106A/FET (dentro de SOA) -> sobrevive.
    - freewheel MUR1560 clampa el kick del choke (Vds < 100V) -> sin avalancha (esto SI)
    - a baja f (1 disparo/gota o 2kHz) -> sin tren Miller (lo que mato los IRF640N) (esto SI)

  BOBINA EXTRA:
    - en SERIE: baja el ripple del buck, suaviza I al alambre, protege el switch (YA).
    - como TANQUE (FASE 2): calentador resonante, la fuente paga solo perdidas (PENDIENTE
      dimensionar Q/L/C).

  ADVERTENCIA HONESTA (huecos NO medidos):
    - Amperaje real de la fuente: SIN MEDIR (estimado 10-20A). Aqui no se invento.
    - R del alambre 0.014 ohm/cm: de tabla, no medida en banco -> el modelo usa R(T).
    - 'La gota' real aun NO existe (solo tack-weld de contacto 30V/~0.7J); estos numeros
      son del ODE, hay que confirmarlos con el shunt de 1mOhm (el de 0.1ohm cegaba a 33A).
""")
hr()
