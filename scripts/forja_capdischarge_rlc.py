#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Forja v2.5 - TOPOLOGIA cap-discharge-simple (SIN recircular)
================================================================
La presa (11 mF) se descarga por: choke L + 1-3 IRL540N (fully ON) + shunt 1 mOhm
+ contacto + ALAMBRE (acero 0.8mm, R no-lineal por temperatura). UN PULSO POR GOTA.

Esto NO es la formula cerrada de un RLC LINEAL: la R del alambre SUBE con la
temperatura (3.2 mOhm/cm frio -> 22 mOhm/cm caliente) y eso cambia el
amortiguamiento DURANTE el pulso. Por eso INTEGRAMOS la ODE con scipy.

Estados:
  q   = carga en la presa (C)          -> V_cap = q / C
  i   = corriente del lazo (A)
  T   = temperatura de la zona caliente del alambre (K), adiabatica local

ODE del lazo serie (KVL):
  L di/dt = V_cap - i*R_fija - i*R_alambre(T) - V_mos(i)
  dq/dt   = -i
  donde R_fija = R_choke_DC + R_shunt + R_contacto + R_mos_paralelo
  R_alambre(T) = rho_e(T) * L_hot / A     (zona caliente de longitud L_hot)
  V_mos = i * Rds_on_total  (incluido en R_fija; los MOSFET fully-ON son resistivos)

Balance termico local de la zona caliente (adiabatico durante el pulso de ~ms;
la conduccion 48W es despreciable frente a kW instantaneos):
  m_hot*cp dT/dt = i^2 * R_alambre(T)  - (perdida_conduccion, pequena)
  al cruzar T_melt se absorbe el latente (entalpia).

Todo SI, ASCII, sin LaTeX.
"""
import numpy as np
from scipy.integrate import solve_ivp

print("="*78)
print("LA FORJA v2.5 - cap-discharge-simple : INTEGRACION ODE DEL LAZO RLC NO-LINEAL")
print("="*78)

# ----------------------------------------------------------------------------
# PARAMETROS FISICOS (de la bitacora + memorias)
# ----------------------------------------------------------------------------
# -- Alambre acero 0.8mm
d_wire   = 0.8e-3
A_wire   = np.pi*(d_wire/2)**2          # m^2
rho_st   = 7850.0                        # kg/m^3
cp_st    = 490.0                         # J/kgK
T_amb    = 298.0                         # K (25C)
T_melt   = 1773.0                        # K (1500C)
L_fus    = 270e3                         # J/kg latente
# resistividad del acero vs T (modelo lineal entre puntos medidos de tabla)
rho_e_20  = 1.6e-7                        # ohm*m  @ ~293K
rho_e_hot = 1.1e-6                        # ohm*m  @ ~1773K
def rho_e(T):
    # interpolacion lineal acotada (no baja de la de 20C)
    r = rho_e_20 + (rho_e_hot - rho_e_20)*(T - 293.0)/(1773.0 - 293.0)
    return np.clip(r, rho_e_20, rho_e_hot*1.3)

# -- Zona caliente del alambre (el calentador). Longitud efectiva de la punta.
L_hot   = 4.0e-3                          # m (4 mm; barremos 2/4/6 abajo)

# -- Banco / presa
C_bank  = 11e-3                           # F

# -- Choke de descarga (L2 actual) y su R_DC (27 vueltas cal10)
L_choke = 41e-6                           # H
R_choke = 1.5e-3                          # ohm, R_DC del cal10 ~ estimado (0.0033 ohm/m * ~0.5m)

# -- Shunt v2.5
R_shunt = 1.0e-3                          # ohm

# -- Contacto alambre-placa (MEDIDO)
R_contact = 0.6e-3                        # ohm

# -- Parasitas del lazo (cableado, ESR caps en serie del banco)
R_par   = 0.8e-3                          # ohm (ESR efectiva 5x2200uF en paralelo + cables)

# -- MOSFET IRL540N (del v1, SOBREVIVIERON)
Rds_one = 44e-3                           # ohm Rds(on) tipico
Vds_max = 100.0                           # V
Id_pulse= 140.0                           # A pico (datasheet, single pulse)
Id_cont = 36.0                            # A continuo

# Criterio de Holm
U_m = 0.55                                 # V

print(f"\n[PARAMS] A_wire={A_wire*1e6:.4f} mm^2  L_hot={L_hot*1e3:.1f} mm  C={C_bank*1e3:.0f} mF")
print(f"         L_choke={L_choke*1e6:.0f} uH  R_choke={R_choke*1e3:.2f} mOhm  "
      f"R_shunt={R_shunt*1e3:.2f}  R_contact={R_contact*1e3:.2f}  R_par={R_par*1e3:.2f} mOhm")

# ----------------------------------------------------------------------------
# Funcion: integra UN pulso de descarga para V0 y N_mos MOSFETs en paralelo
# ----------------------------------------------------------------------------
def simular_pulso(V0, N_mos=1, L_hot=L_hot, t_max=8e-3, latente=True, L_loop=L_choke):
    Rds = Rds_one / N_mos                  # MOSFETs en paralelo
    R_fixed = R_choke + R_shunt + R_contact + R_par + Rds
    m_hot = rho_st * A_wire * L_hot        # masa de la zona caliente
    # energia para llevar la zona caliente a fusion (sensible) y latente
    E_sens_zone = m_hot * cp_st * (T_melt - T_amb)
    E_lat_zone  = m_hot * L_fus
    # perdida por conduccion local (pequena vs pulso) - la metemos como fuga
    P_cond = 48.0  # W (del sim acoplado); fuga termica de la zona caliente

    # estado: [q, i, H]  donde H = entalpia acumulada de la zona (J) sobre T_amb
    def Rwire_of_H(H):
        # convierte entalpia -> temperatura (con meseta de fusion)
        if H <= E_sens_zone:
            T = T_amb + H/(m_hot*cp_st)
            frac_liq = 0.0
        elif H <= E_sens_zone + E_lat_zone:
            T = T_melt
            frac_liq = (H - E_sens_zone)/E_lat_zone
        else:
            T = T_melt + (H - E_sens_zone - E_lat_zone)/(m_hot*cp_st)
            frac_liq = 1.0
        Rw = rho_e(T) * L_hot / A_wire
        return Rw, T, frac_liq

    def deriv(t, y):
        q, i, H = y
        Vc = q / C_bank
        Rw, T, _ = Rwire_of_H(H)
        R_tot = R_fixed + Rw
        # el lazo no conduce en reversa (MOSFET + sin recircular): clamp i>=0
        di = (Vc - i*R_tot) / L_loop
        if i <= 0 and di < 0:
            di = 0.0
            i = 0.0
        dq = -max(i, 0.0)
        # calor SOLO en el alambre va a la entalpia de la zona; resta conduccion
        P_wire = max(i,0.0)**2 * Rw
        dH = P_wire - (P_cond if H > 0 else 0.0)
        if H <= 0 and dH < 0:
            dH = 0.0
        return [dq, di, dH]

    # evento: corriente cruza a 0 (fin del primer semiciclo; sin recircular se apaga)
    def cross_zero(t, y):
        return y[1] - 1e-3
    cross_zero.terminal = True
    cross_zero.direction = -1

    y0 = [C_bank*V0, 0.0, 0.0]
    sol = solve_ivp(deriv, [0, t_max], y0, method='LSODA',
                    rtol=1e-8, atol=[1e-9,1e-4,1e-6], max_step=2e-6,
                    events=cross_zero, dense_output=True)

    t = sol.t
    q = sol.y[0]; i = sol.y[1]; H = sol.y[2]
    Vc = q / C_bank
    # reconstruye R_wire, T, frac y potencias punto a punto
    Rw = np.zeros_like(t); T = np.zeros_like(t); fl = np.zeros_like(t)
    for k in range(len(t)):
        Rw[k], T[k], fl[k] = Rwire_of_H(H[k])
    P_wire = i**2 * Rw
    P_mos  = i**2 * Rds
    P_fix  = i**2 * R_fixed
    V_wire = i * Rw                          # caida en el alambre (vs Holm 0.55V)

    # integrales de energia (trapecio)
    E_wire = np.trapezoid(P_wire, t)
    E_mos  = np.trapezoid(P_mos, t)
    E_fix  = np.trapezoid(P_fix, t)
    E_src0 = 0.5*C_bank*V0**2
    E_left = 0.5*C_bank*Vc[-1]**2

    i_pk   = i.max()
    k_pk   = i.argmax()
    didt0  = (i[1]-i[0])/(t[1]-t[0]) if len(t)>1 else 0.0
    Vmax_mos = i_pk * Rds                    # caida sobre el MOSFET en pico (drain-source ON)
    H_final = H[-1]
    # cuanta zona se fundio: fraccion de la entalpia que supero sensible
    melted = H_final >= E_sens_zone
    frac_lat = np.clip((H_final - E_sens_zone)/E_lat_zone, 0, 1) if H_final>E_sens_zone else 0.0
    Vw_max = V_wire.max()
    crosses_holm = Vw_max >= U_m

    return dict(t=t, i=i, Vc=Vc, Rw=Rw, T=T, fl=fl, P_wire=P_wire, P_mos=P_mos,
                V_wire=V_wire, i_pk=i_pk, t_pk=t[k_pk], didt0=didt0,
                E_wire=E_wire, E_mos=E_mos, E_fix=E_fix, E_src0=E_src0, E_left=E_left,
                Vmax_mos=Vmax_mos, H_final=H_final, E_sens_zone=E_sens_zone,
                E_lat_zone=E_lat_zone, melted=melted, frac_lat=frac_lat,
                Vw_max=Vw_max, crosses_holm=crosses_holm, t_end=t[-1],
                R_fixed=R_fixed, Rds=Rds, m_hot=m_hot,
                Tmax=T.max(), V0=V0, N_mos=N_mos, L_hot=L_hot)

# ----------------------------------------------------------------------------
# BARRIDO 1: V0 = 60 / 90 V, con 1, 2, 3 IRL540N en paralelo, L_hot=4mm
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[A] PULSO DE DESCARGA INTEGRADO (ODE) - L_hot=4mm, sin recircular")
print("="*78)
print(f"{'V0':>4} {'Nmos':>5} {'i_pico':>8} {'t_pico':>8} {'Vw_max':>7} {'Holm?':>6} "
      f"{'Ewire':>7} {'Emos':>6} {'Tmax':>7} {'fundio?':>8}")
print(f"{'(V)':>4} {'':>5} {'(A)':>8} {'(us)':>8} {'(V)':>7} {'':>6} "
      f"{'(J)':>7} {'(J)':>6} {'(C)':>7} {'':>8}")
results = {}
for V0 in [60, 90]:
    for N_mos in [1, 2, 3]:
        r = simular_pulso(V0, N_mos)
        results[(V0,N_mos)] = r
        print(f"{V0:>4} {N_mos:>5} {r['i_pk']:>8.0f} {r['t_pk']*1e6:>8.0f} "
              f"{r['Vw_max']:>7.2f} {'SI' if r['crosses_holm'] else 'no':>6} "
              f"{r['E_wire']:>7.2f} {r['E_mos']:>6.2f} {r['Tmax']-273:>7.0f} "
              f"{('SI' if r['melted'] else 'no')+(' x%.0f'%(r['frac_lat']*100) if r['melted'] else ''):>8}")

# ----------------------------------------------------------------------------
# CONSUMO DE LA FUENTE (lo que de verdad paga la PSU 12-24V)
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[B] CONSUMO DE LA FUENTE 12-24V (recarga de la presa entre gotas)")
print("="*78)
P_boost = 86.0
eta_boost = 0.80
for V0 in [60, 90]:
    r = results[(V0,1)]
    dE_pulse = r['E_src0'] - r['E_left']     # energia que SALE de la presa por pulso
    print(f"\n  V0={V0}V: energia gastada de la presa por pulso = {dE_pulse:.2f} J "
          f"(quedan {r['E_left']:.2f} J, V_final={r['Vc'][-1]:.1f} V)")
    # la fuente debe reponer dE_pulse via el boost
    for Vsrc in [12, 24]:
        # corriente MEDIA de la fuente para sostener N gotas/s
        for N_drops in [5, 10, 20]:
            P_recarga = N_drops * dE_pulse / eta_boost   # W que debe entregar la fuente
            I_src = P_recarga / Vsrc
            tag = "" if I_src <= 20 else "  <-- excede ~10-20A de la PSU"
            print(f"    {N_drops:>2} gotas/s, fuente {Vsrc}V: P_recarga={P_recarga:6.1f}W "
                  f"-> I_fuente={I_src:5.1f} A{tag}")
    # tasa sostenible limitada por el boost
    N_sust = P_boost / dE_pulse
    print(f"    => recarga real boost {P_boost}W -> sostenible {N_sust:.1f} gotas/s "
          f"(la fuente NUNCA ve el pico de cientos de A; lo da la presa)")

# ----------------------------------------------------------------------------
# SUPERVIVENCIA DEL SWITCH IRL540N (SOA, Miller, avalancha)
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[C] SUPERVIVENCIA DEL SWITCH IRL540N (100V / 44mOhm / 140A pico)")
print("="*78)
print("\n  Datasheet: Vds_max=100V, Id_cont=36A, Id_pulso(single)=140A, Rds_on=44mOhm")
print("  Esta topologia (cap-discharge) NO conmuta a 187kHz como el v2 que mato los IRF640N.")
print("  Es UN disparo por gota, fully-ON, sin recircular -> sin dV/dt Miller del arco.\n")
for V0 in [60, 90]:
    for N_mos in [1, 2, 3]:
        r = results[(V0,N_mos)]
        i_each = r['i_pk']/N_mos                 # corriente por MOSFET si reparten parejo
        # 1) Vds en bloqueo (antes de disparar) = V0 de la presa
        ok_vds = V0 < Vds_max
        # 2) corriente pico por dispositivo vs Id_pulse
        ok_ipk = i_each < Id_pulse
        # 3) energia disipada por MOSFET y subida de T de juncion (Rth_jc ~0.9 C/W IRL540N,
        #    pero el pulso es ms: usamos Zth transitorio ~ 0.05 C/W a 1ms single pulse)
        E_mos_each = r['E_mos']/N_mos
        Zth_1ms = 0.05                            # C/W transitorio ~1ms (datasheet curva Zth)
        # potencia pico por device:
        P_mos_pk_each = (i_each**2)*r['Rds']      # ojo Rds ya es paralelo; pico por device:
        P_pk_each = (i_each**2)*Rds_one
        dTj = P_pk_each * Zth_1ms                 # subida transitoria aproximada
        ok_tj = dTj < 100                         # margen amplio a Tjmax=175C
        # 4) avalancha: NO hay, porque sin recircular la i va a 0 por el evento (semiciclo).
        #    Si el choke intentara invertir, el body diode del MOSFET clampa (no avalancha de Vds).
        verdict = "SOBREVIVE" if (ok_vds and ok_ipk and ok_tj) else "RIESGO"
        print(f"  V0={V0}V N={N_mos}: i_pico/dev={i_each:5.0f}A "
              f"(<{Id_pulse:.0f}? {'si' if ok_ipk else 'NO'}), "
              f"Vds_block={V0}V (<100? {'si' if ok_vds else 'NO'}), "
              f"E/dev={E_mos_each:.2f}J, P_pk/dev={P_pk_each:.0f}W, "
              f"dTj~{dTj:.0f}C -> {verdict}")

print("\n  AVALANCHA: en cap-discharge SIN recircular el MOSFET se apaga cuando la I ya")
print("  cruzo cero (evento del semiciclo LC). NO se interrumpe corriente alta a la fuerza,")
print("  asi que NO hay pico inductivo L*di/dt de apagado -> NO hay avalancha (lo opuesto al")
print("  v2 que mato los IRF640N por apagar bajo corriente en el lazo bang-bang).")
print("  MILLER turn-on: no aplica; UN disparo, gate fijo en ON; no hay arco que meta dV/dt.")

# ----------------------------------------------------------------------------
# ROL DE LA BOBINA EXTRA (segunda bobina de descarga)
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[D] ROL DE UNA BOBINA EXTRA en cap-discharge-simple (sin recircular)")
print("="*78)
# Comparar pico e energia al alambre con L_choke=41uH vs valores mas chicos/grandes
print(f"\n  Barrido de L_choke (V0=90V, 1 MOSFET, L_hot=4mm):")
print(f"  {'L(uH)':>7} {'i_pico':>8} {'t_pico':>8} {'Vw_max':>7} {'Ewire':>7} {'i^2t(A2s)':>10}")
def i2t(r):
    return np.trapezoid(r['i']**2, r['t'])
for Luh in [10, 20, 41, 80, 160]:
    Ls = Luh*1e-6
    r = simular_pulso(90, 1, L_loop=Ls)
    print(f"  {Luh:>7} {r['i_pk']:>8.0f} {r['t_pk']*1e6:>8.0f} {r['Vw_max']:>7.2f} "
          f"{r['E_wire']:>7.2f} {i2t(r):>10.4f}")

print("\n  LECTURA del barrido de L:")
print("   - MENOS L (10-20uH): pico mas alto, mas corto -> mas estres de di/dt en el switch,")
print("     mismo i^2t aprox (la energia es la misma); cruza Holm mas violento.")
print("   - MAS L (80-160uH): pico mas bajo y ANCHO -> pulso mas largo, mas suave al switch,")
print("     reparte el i^2t en mas tiempo. En cap-discharge SIMPLE la L NO recircula nada:")
print("     solo MODELA la forma del pulso (sube ti de subida, baja el pico, alarga el ring).")
print("   - El choke NO reduce el consumo de la fuente (eso lo haria el TANQUE recirculante,")
print("     que es OTRA topologia, FASE 2). Aqui la bobina extra solo cambia pico vs ancho.")
print("   RECOMENDACION: en cap-discharge una L de 40-80uH es buen punto: pico suficiente")
print("   (>300A, cruza Holm de sobra) con di/dt manejable para el IRL540N. Mas L = innecesario;")
print("   menos L = pico brutal que no necesitas (ya fundes) y mas estres de switching.")

# ----------------------------------------------------------------------------
# VEREDICTO + FORMA DE ONDA RESUMIDA (un pulso 90V/1mos)
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[E] FORMA DE ONDA - un pulso a 90V, 1 IRL540N, L_hot=4mm")
print("="*78)
r = results[(90,1)]
# muestrear la forma de onda
idx = np.linspace(0, len(r['t'])-1, 12).astype(int)
print(f"  {'t(us)':>8} {'i(A)':>8} {'Vcap(V)':>8} {'Vwire(V)':>9} {'Twire(C)':>9} {'Pwire(W)':>9}")
for k in idx:
    print(f"  {r['t'][k]*1e6:>8.1f} {r['i'][k]:>8.0f} {r['Vc'][k]:>8.1f} "
          f"{r['V_wire'][k]:>9.3f} {r['T'][k]-273:>9.0f} {r['P_wire'][k]:>9.0f}")

print(f"\n  pico de corriente   = {r['i_pk']:.0f} A  (J = {r['i_pk']/(A_wire*1e6):.0f} A/mm^2) "
      f"a t={r['t_pk']*1e6:.0f} us")
print(f"  Vwire max           = {r['Vw_max']:.2f} V  (Holm=0.55V -> {'CRUZA' if r['crosses_holm'] else 'NO cruza'})")
print(f"  T zona caliente max = {r['Tmax']-273:.0f} C  (fusion=1500C -> "
      f"{'FUNDE' if r['Tmax']>=T_melt else 'NO funde'})")
print(f"  E al alambre        = {r['E_wire']:.2f} J  | E a MOSFET = {r['E_mos']:.2f} J "
      f"| E a fija(shunt+contacto+choke+par) = {r['E_fix']:.2f} J")
print(f"  duracion del pulso  = {r['t_end']*1e6:.0f} us (semiciclo LC; se apaga en cruce por 0)")
print(f"  V_cap final         = {r['Vc'][-1]:.1f} V (de {r['V0']}V) -> "
      f"gasto {r['E_src0']-r['E_left']:.2f} J/pulso")
print("="*78)
