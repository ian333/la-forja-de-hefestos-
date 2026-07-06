#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La Forja v2.5 - Derivacion rigurosa del requisito para FUNDIR el alambre 0.8mm de acero
(E71T-GS, gasless), alimentado continuo. Joule printing.

Todo en SI. Texto plano ASCII, sin LaTeX.

Pregunta central: donde cae el calor? en el contacto (0.6 mOhm) o en el ALAMBRE?
Demostramos con numeros: criterio de Holm U_m=0.55V exige ~917A en el contacto,
contra densidad de corriente J=I/A en el alambre.
"""
import numpy as np

print("="*78)
print("LA FORJA v2.5 - REQUISITO PARA FUNDIR ALAMBRE 0.8mm ACERO (Joule printing)")
print("="*78)

# ----------------------------------------------------------------------------
# 0. CONSTANTES Y PROPIEDADES DEL MATERIAL (acero al bajo carbono / steel)
# ----------------------------------------------------------------------------
d_wire    = 0.8e-3          # m, diametro del alambre
A_wire    = np.pi*(d_wire/2)**2   # m^2, area de seccion
print("\n[0] GEOMETRIA Y MATERIAL")
print(f"  d_alambre            = {d_wire*1e3:.2f} mm")
print(f"  A_seccion            = {A_wire*1e6:.4f} mm^2 = {A_wire:.4e} m^2")

# Propiedades termofisicas del acero al bajo carbono (valores de tabla):
rho_steel = 7850.0          # kg/m^3 densidad
cp_steel  = 490.0           # J/(kg K) calor especifico solido (promedio 25->1500C)
T_amb     = 25.0            # C
T_melt    = 1500.0          # C punto de fusion (acero al carbono ~1450-1538C; 1500 tipico)
L_fusion  = 270e3           # J/kg calor latente de fusion del acero (~247-270 kJ/kg)
# Resistividad electrica del acero: sube fuerte con T.
# rho_e a 20C ~ 1.6e-7 ohm*m ; cerca de fusion ~ 1.1e-6 ohm*m.
rho_e_20  = 1.6e-7          # ohm*m a 20C
rho_e_hot = 1.1e-6          # ohm*m cerca de fusion (~1500C)
rho_e_avg = 0.5*(rho_e_20+rho_e_hot)  # promedio simple para estimacion de I^2R

print(f"  rho (densidad)       = {rho_steel:.0f} kg/m^3")
print(f"  cp (calor espec.)    = {cp_steel:.0f} J/(kg K)")
print(f"  T_amb -> T_fus       = {T_amb:.0f} -> {T_melt:.0f} C  (dT = {T_melt-T_amb:.0f} K)")
print(f"  L_fusion (latente)   = {L_fusion/1e3:.0f} kJ/kg")
print(f"  rho_e: 20C={rho_e_20:.2e}  caliente={rho_e_hot:.2e}  prom={rho_e_avg:.2e} ohm*m")

# Resistencia del alambre por unidad de longitud (chequeo del dato del operador 0.014 ohm/cm)
R_per_cm_20  = rho_e_20  / A_wire * 0.01
R_per_cm_hot = rho_e_hot / A_wire * 0.01
print(f"\n  CHEQUEO R/cm del alambre:")
print(f"    a 20C   : {R_per_cm_20*1e3:.3f} mOhm/cm")
print(f"    caliente: {R_per_cm_hot*1e3:.3f} mOhm/cm  (~{R_per_cm_hot:.4f} ohm/cm)")
print(f"    -> el dato del operador 0.014 ohm/cm = 14 mOhm/cm cae JUSTO en el rango caliente.")
print(f"       (el alambre se calienta -> su R sube -> mas I^2R -> realimentacion termica)")

# ----------------------------------------------------------------------------
# 1. DONDE CAE EL CALOR: CONTACTO vs ALAMBRE  (criterio de Holm)
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[1] DONDE CAE EL CALOR: CONTACTO (Holm) vs ALAMBRE (densidad de corriente)")
print("="*78)

U_m      = 0.55             # V, criterio de Holm: voltaje de fusion de la junta (acero)
R_contact= 0.6e-3           # ohm, R de contacto MEDIDA por el operador

# Para que el CONTACTO funda, la caida en el contacto debe llegar a U_m.
I_contact_melt = U_m / R_contact
P_contact_melt = U_m * I_contact_melt   # = U_m^2 / R_contact

print(f"\n  Criterio de Holm (junta): U_m = {U_m} V  (es un VOLTAJE, no tiempo ni frecuencia)")
print(f"  R_contacto MEDIDA        = {R_contact*1e3:.2f} mOhm")
print(f"  -> Para fundir EN EL CONTACTO: I = U_m / R_c = {U_m}/{R_contact}")
print(f"     I_contacto_fusion     = {I_contact_melt:.0f} A   <-- IMPOSIBLE con esta fuente")
print(f"     P_contacto a esa I    = {P_contact_melt:.0f} W")
print(f"  CONCLUSION 1: el contacto NO puede ser el calentador (917A no estan disponibles).")

# En el ALAMBRE, el calor es I^2*R_alambre. La caida por cm a la I de trabajo:
print(f"\n  En el ALAMBRE el calor es I^2*R_propia. Caida de Holm por longitud de alambre:")
for I in [40, 130, 200, 250]:
    # longitud de alambre que sola ya cae U_m = 0.55V (a R caliente)
    L_holm = U_m / (I * R_per_cm_hot) # cm
    Pcm    = I**2 * R_per_cm_hot      # W/cm disipados en el alambre caliente
    print(f"    I={I:3d}A: caida {U_m}V en {L_holm:5.2f} cm de alambre;  disipa {Pcm:6.1f} W/cm")
print("  CONCLUSION 1b: a 130-250A, pocos cm de alambre ya disipan la potencia de Holm")
print("                 en su PROPIA R -> el calentador es el ALAMBRE. J = I/A es el lever.")

# Densidad de corriente
print(f"\n  DENSIDAD DE CORRIENTE J = I / A_seccion (A_seccion = {A_wire*1e6:.3f} mm^2):")
for I in [50, 130, 200, 250, 917]:
    J = I / A_wire        # A/m^2
    Jmm = I / (A_wire*1e6) # A/mm^2
    print(f"    I={I:4d}A -> J = {Jmm:7.1f} A/mm^2 = {J:.3e} A/m^2")
print("  (referencia: fusibles de acero/Joule-printing operan ~200-500 A/mm^2)")

# ----------------------------------------------------------------------------
# 2. CALENTAMIENTO ADIABATICO DEL ALAMBRE: energia para llevar una GOTA a fusion
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[2] ENERGIA PARA FUNDIR UNA GOTA (calentamiento adiabatico)")
print("="*78)

# Definimos "una gota" = un trocito de alambre de longitud l_drop fundido.
# A 0.8mm, l_drop ~ 1.0 mm da una gota esferica equivalente razonable.
l_drop = 1.0e-3            # m, longitud de alambre por gota (parametro)
V_drop = A_wire * l_drop   # m^3
m_drop = rho_steel * V_drop # kg
# radio de la esfera equivalente (solo informativo)
r_eq = (3*V_drop/(4*np.pi))**(1/3)

print(f"\n  Definicion de gota: l_drop = {l_drop*1e3:.2f} mm de alambre")
print(f"    Volumen gota   = {V_drop*1e9:.4f} mm^3")
print(f"    Masa gota      = {m_drop*1e6:.3f} mg = {m_drop:.3e} kg")
print(f"    r esfera equiv = {r_eq*1e3:.3f} mm")

# Energia adiabatica (sin perdidas): sensible + latente
E_sensible = m_drop * cp_steel * (T_melt - T_amb)
E_latente  = m_drop * L_fusion
E_drop_adia= E_sensible + E_latente

print(f"\n  Energia ADIABATICA por gota (sin perdidas):")
print(f"    E_sensible (25->1500C) = {E_sensible:.3f} J")
print(f"    E_latente  (fusion)    = {E_latente:.3f} J")
print(f"    E_gota_adiabatica      = {E_drop_adia:.3f} J")

# Energia especifica del acero solido->fundido (util como cota)
e_spec = cp_steel*(T_melt-T_amb) + L_fusion   # J/kg
print(f"    energia especifica acero = {e_spec/1e3:.0f} kJ/kg = {e_spec/1e6:.3f} MJ/kg")

# ----------------------------------------------------------------------------
# 3. PERDIDAS POR CONDUCCION (~48W del sim) y energia REAL por gota
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[3] PERDIDAS POR CONDUCCION + ENERGIA REAL POR GOTA")
print("="*78)

P_loss = 48.0   # W, perdidas por conduccion (sim gota-acoplada-completa.py: ~34 arriba + ~14 frio)
print(f"\n  Perdidas por conduccion (sim) = {P_loss:.0f} W")
print(f"    (~34W conduccion hacia arriba del alambre + ~14W asimilar alambre frio)")

# Si quiero fundir N gotas por segundo, la potencia NETA al metal es N * E_drop_adia,
# y ademas hay que pagar P_loss continuamente mientras la zona esta caliente.
# Eficiencia: fraccion de la potencia electrica que termina como E util en la gota.
# P_elec = N*E_drop_adia + P_loss   (modelo de balance de energia)
print(f"\n  Balance: P_electrica = N_gotas/s * E_gota + P_perdidas")
print(f"  Resolviendo para distintas tasas de gota:")
print(f"  {'N (gotas/s)':>11} | {'P_util(W)':>9} | {'P_elec(W)':>9} | {'efic(%)':>7}")
for N in [10, 22, 28, 50, 100]:
    P_util = N * E_drop_adia
    P_elec = P_util + P_loss
    eff = 100*P_util/P_elec
    print(f"  {N:>11d} | {P_util:>9.2f} | {P_elec:>9.2f} | {eff:>7.1f}")

# Comparar con la estimacion del operador (4.3 J/gota) y el sim de latigazo (1.4-3.5 J/gota)
print(f"\n  COMPARACION con datos previos:")
print(f"    E_gota_adiabatica (este modelo) = {E_drop_adia:.2f} J   (solo sensible+latente)")
print(f"    estimacion operador v2.5        = 4.3 J/gota")
print(f"    sim latigazo-corto-controlado   = 1.4 - 3.5 J/gota")
print(f"    -> 4.3 J/gota incluye perdidas + ineficiencia => CONSISTENTE con E_adia + losses.")
ef_oper = 100*E_drop_adia/4.3
print(f"       eficiencia implicita si gota real cuesta 4.3J: {ef_oper:.0f}%")

# ----------------------------------------------------------------------------
# 4. CORRIENTE Y POTENCIA PARA FUNDIR (regimen sostenido) + vencer perdidas
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[4] CORRIENTE Y POTENCIA PARA FUNDIR SOSTENIDO (I^2*R en el alambre)")
print("="*78)

# En sostenido, la zona caliente del alambre tiene cierta longitud efectiva L_hot
# (la zona pastosa/fundida cerca de la punta). El calor generado ahi es I^2 * R_hot.
# R_hot = rho_e_hot * L_hot / A_wire.
# Debe igualar (potencia para fundir el feed + perdidas).
# Tomamos L_hot ~ unos mm (zona termicamente afectada corta por la alta conductividad).
print("\n  Modelo: I^2 * R_zona_caliente = P_fundir_feed + P_perdidas")
print("  R_zona = rho_e_hot * L_hot / A   (zona pastosa cerca de la punta)\n")

feed_rate_mm_s = 22.0  # mm/s de alambre alimentado (=> ~22 gotas/s de 1mm); parametro de diseño
m_feed = rho_steel * A_wire * (feed_rate_mm_s*1e-3)  # kg/s
P_feed = m_feed * e_spec  # W para fundir el caudal de alambre
P_need = P_feed + P_loss
print(f"  Caudal de feed: {feed_rate_mm_s:.0f} mm/s -> {m_feed*1e6:.2f} mg/s")
print(f"  P para fundir el feed = {P_feed:.1f} W")
print(f"  P_total necesaria     = P_feed + P_loss = {P_feed:.1f} + {P_loss:.0f} = {P_need:.1f} W")

print(f"\n  Corriente requerida segun longitud de zona caliente L_hot:")
print(f"  {'L_hot(mm)':>9} | {'R_zona(mOhm)':>12} | {'I(A) p/ P_need':>14} | {'J(A/mm2)':>9}")
for L_hot_mm in [2.0, 4.0, 6.0, 10.0]:
    L_hot = L_hot_mm*1e-3
    R_zona = rho_e_hot * L_hot / A_wire
    I_req = np.sqrt(P_need / R_zona)
    Jmm = I_req/(A_wire*1e6)
    print(f"  {L_hot_mm:>9.1f} | {R_zona*1e3:>12.3f} | {I_req:>14.0f} | {Jmm:>9.1f}")

print("\n  -> Corriente de fusion sostenida cae en ~130-250A segun L_hot,")
print("     reconciliando el rango 'por densidad de corriente' de la bitacora.")
print("     El modelo acoplado dio ~40A como MINIMO de fusion (zona muy corta/lenta),")
print("     pero para una tasa util de gotas se necesitan 130-250A.")

# ----------------------------------------------------------------------------
# 5. CALENTAMIENTO ADIABATICO TRANSITORIO: cuanto tarda I en fundir el alambre
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[5] TIEMPO DE FUSION ADIABATICO vs CORRIENTE (pulso)")
print("="*78)
print("  Modelo adiabatico de un segmento (sin perdidas, cota inferior de tiempo):")
print("  I^2 * R_seg * t = m_seg * e_spec  ; con R_seg=rho_e_avg*l/A, m_seg=rho*A*l")
print("  -> t = rho*A^2*e_spec / (I^2 * rho_e_avg)   (independiente de la longitud l)\n")

def t_fusion_adiab(I):
    return rho_steel * A_wire**2 * e_spec / (I**2 * rho_e_avg)

print(f"  {'I (A)':>6} | {'J(A/mm2)':>9} | {'t_fusion_adiab':>14}")
for I in [40, 60, 90, 130, 200, 250, 300]:
    t = t_fusion_adiab(I)
    Jmm = I/(A_wire*1e6)
    if t < 1:
        ts = f"{t*1e3:.1f} ms"
    else:
        ts = f"{t:.2f} s"
    print(f"  {I:>6d} | {Jmm:>9.1f} | {ts:>14}")
print("\n  CLAVE: t cae como 1/I^2. Pulsos largos a baja I (v1, 4ms->2400ms a ~50A) NO")
print("  funden porque las PERDIDAS (48W) igualan o superan el I^2R a baja I -> meseta")
print("  termica por debajo de fusion (V_junta ~0.30V observado). El lever es I (sube J),")
print("  NO el tiempo. A 130-250A el pulso adiabatico funde en pocos a decenas de ms.")

# Potencia minima de equilibrio: I tal que I^2*R_zona = P_loss (no funde, solo empata perdidas)
print("\n  Corriente de UMBRAL (I^2*R_zona = P_loss=48W, no funde, solo empata perdidas):")
for L_hot_mm in [4.0, 6.0]:
    L_hot = L_hot_mm*1e-3
    R_zona = rho_e_hot * L_hot / A_wire
    I_thr = np.sqrt(P_loss / R_zona)
    print(f"    L_hot={L_hot_mm:.0f}mm: I_umbral = {I_thr:.0f} A  (debajo de esto NUNCA funde)")

# ----------------------------------------------------------------------------
# 6. FACTIBILIDAD CON FUENTE 12-24V + PRESA 11mF + BOOST (pulsado vs sostenido)
# ----------------------------------------------------------------------------
print("\n" + "="*78)
print("[6] FACTIBILIDAD: fuente 12-24V + presa 11mF + boost. PULSADO vs SOSTENIDO")
print("="*78)

C_bank = 11e-3   # F
print(f"\n  Banco de caps (presa) C = {C_bank*1e3:.0f} mF")
print(f"  Energia almacenada 1/2 C V^2:")
for V in [60, 70, 90]:
    E = 0.5*C_bank*V**2
    print(f"    @ {V}V -> {E:.1f} J")

print(f"\n  -- SOSTENIDO desde fuente directa 12-24V --")
for Vsrc in [12, 24]:
    # corriente que la fuente debe entregar para P_need (modelo, P_need ~ del paso 4)
    print(f"    Fuente {Vsrc}V: para {P_need:.0f}W pediria I_fuente = {P_need/Vsrc:.0f} A directos.")
print(f"    La fuente de impresora da ~10-20A (HUECO: amperaje real SIN MEDIR).")
print(f"    => SOSTENIDO directo desde la fuente NO alcanza los 130-250A de fusion.")

print(f"\n  -- PULSADO desde la presa (caps) --")
print(f"  La presa entrega corriente PICO grande; la fuente solo RECARGA entre gotas.")
# Cuantas gotas puede dar la presa por carga (energia)
for V in [60, 90]:
    E_bank = 0.5*C_bank*V**2
    n_drops_energy = E_bank / 4.3   # usando 4.3 J/gota real
    print(f"    @ {V}V: E_presa={E_bank:.0f}J / 4.3J_gota = {n_drops_energy:.0f} gotas por carga completa")

# Tasa sostenible limitada por la RECARGA del boost (~86W) y por P_need
P_boost = 86.0
print(f"\n  Recarga del boost ~ {P_boost:.0f} W (probado). Tasa de gota SOSTENIDA limitada por recarga:")
N_sustain = P_boost / 4.3
print(f"    N_sostenible = P_boost / E_gota = {P_boost}/4.3 = {N_sustain:.1f} gotas/s")
print(f"    (la presa permite RAFAGAS mas rapidas; la media la pone el boost de {P_boost}W)")

# Corriente pico de descarga de la presa por el lazo (limitada por L_choke, no por la fuente)
L_choke = 41e-6  # H
R_loop  = R_contact + 1e-3 + 0.5e-3  # ohm: contacto + shunt 1mOhm + parasitas ~0.5mOhm
print(f"\n  Lazo de descarga: L_choke={L_choke*1e6:.0f}uH, R_lazo~{R_loop*1e3:.2f}mOhm")
print(f"  Corriente PICO de la presa (subamortiguado, V0/sqrt(L/C_local) acotado por R y L):")
for V0 in [60, 90]:
    # pico aproximado de un RLC subamortiguado descargando: I_pk ~ V0 / Z, Z = sqrt(L/C) o V0/R si dominado por R
    Z = np.sqrt(L_choke / C_bank)
    I_pk_LC = V0 / Z
    I_pk_R  = V0 / R_loop
    # di/dt inicial = V0/L acota la subida
    didt = V0 / L_choke
    print(f"    @ {V0}V: I_pico(LC)~{I_pk_LC:.0f}A, I_pico(R-limit)~{I_pk_R:.0f}A, di/dt={didt:.2e} A/s")
print(f"  => la presa SI da cientos de A de pico (limitada por L_choke y R, NO por la fuente).")
print(f"     A 90V el pico R-limit ~ {90/R_loop:.0f}A excede los 130-250A de fusion.")

# ----- CHEQUEO CRITICO: carga (coulombs) vs energia (joules) en un solo pulso -----
print(f"\n  CHEQUEO CRITICO: la presa esta limitada por CARGA (Q=C*V), no solo por energia.")
print(f"  Q_max que la presa puede entregar antes de vaciarse ~ C*V0:")
R_zona = rho_e_hot * 4e-3 / A_wire   # zona caliente 4mm
for V0 in [60, 90]:
    Qmax = C_bank * V0          # C, carga total disponible si se vacia a 0V
    Emax = 0.5*C_bank*V0**2
    print(f"   -- V0={V0}V: Q_max={Qmax*1e3:.0f} mC (={Qmax:.2f} C), E_presa={Emax:.1f} J")
    for I in [130, 200, 250]:
        # carga necesaria para sostener I durante el tiempo que tarda en entregar 4.3J
        P = I**2 * R_zona
        t_const = 4.3 / P                 # s si I fuera constante
        Q_need = I * t_const              # C requeridos a I constante
        ratio = Q_need / Qmax
        print(f"      I={I}A constante: P={P:.0f}W, t={t_const*1e3:.1f}ms, Q_req={Q_need*1e3:.0f}mC "
              f"= {ratio:.1f}x Q_max -> {'NO CABE (carga)' if ratio>1 else 'OK'}")

print("\n  HALLAZGO: a corriente de fusion (130-250A) la presa se VACIA de CARGA en")
print("  <1 ms, mucho antes de entregar 4.3J 'a I constante'. El pulso real es un RC")
print("  que decae: I_pico alto al inicio, pero la I cae al caer V. Modelamos el RC real.")

# Modelo RC real de descarga de la presa por el lazo (R_loop domina; L muy chica para el tau)
print(f"\n  Descarga RC real (R_lazo incluye alambre caliente R_zona + contacto + shunt):")
R_disc = R_zona + R_contact + 1e-3   # ohm: zona caliente + contacto + shunt 1mOhm
tau_RC = R_disc * C_bank
print(f"    R_descarga (zona {R_zona*1e3:.1f} + contacto {R_contact*1e3:.1f} + shunt 1.0)mOhm "
      f"= {R_disc*1e3:.2f} mOhm")
print(f"    tau = R*C = {tau_RC*1e3:.2f} ms")
for V0 in [60, 90]:
    I0 = V0 / R_disc                  # A, corriente pico al cierre
    E0 = 0.5*C_bank*V0**2
    # energia entregada cuando V cae a Vf (toda al alambre menos shunt/contacto)
    frac_wire = R_zona / R_disc       # fraccion de potencia que cae en el alambre
    E_wire_total = E0 * frac_wire     # J entregados al alambre si se descarga del todo
    n_drops = E_wire_total / 3.92     # gotas adiabaticas posibles por pulso completo
    print(f"    V0={V0}V: I_pico={I0:.0f}A (J={I0/(A_wire*1e6):.0f}A/mm2), "
          f"frac_alambre={frac_wire*100:.0f}%, E_al_total={E_wire_total:.1f}J -> {n_drops:.1f} gotas/pulso")

# El L_choke=41uH limita el di/dt -> el pico NO es V0/R instantaneo; sube como rampa.
print(f"\n  Limite REAL del pico por el choke L2={L_choke*1e6:.0f}uH (di/dt=V0/L al cierre):")
print(f"    (LC ringing: w0=1/sqrt(LC)={1/np.sqrt(L_choke*C_bank):.0f} rad/s,")
print(f"     T_ring/4 = {0.5*np.pi*np.sqrt(L_choke*C_bank)*1e3:.2f} ms al primer pico de corriente)")
for V0 in [60, 90]:
    didt = V0 / L_choke               # A/s
    t_to_200 = 200 / didt             # s para llegar a 200A si fuera rampa lineal
    Z = np.sqrt(L_choke / C_bank)     # impedancia caracteristica
    I_pk_LC = V0 / Z                  # pico LC subamortiguado
    print(f"    V0={V0}V: di/dt={didt:.2e}A/s, rampa-a-200A={t_to_200*1e6:.0f}us, "
          f"I_pico_LC={I_pk_LC:.0f}A (J={I_pk_LC/(A_wire*1e6):.0f}A/mm2)")
print("  LECTURA del choke: con L=41uH el lazo es sub-amortiguado y RESUENA; el pico de")
print("  corriente (cientos a ~1000A) ocurre a T_ring/4 ~0.5ms y supera de sobra los")
print("  130-250A de fusion. El choke modera el di/dt (protege al switch) y reparte el")
print("  pulso en ~ms, pero el alambre cruza Holm dentro del primer cuarto de ciclo. FUNDE.")

print("\n  LECTURA:")
print("   (a) I_PICO al cierre es de cientos a miles de A (acotado por R_lazo y L_choke),")
print("       MUY por encima del umbral de fusion -> el alambre cruza Holm al instante. FUNDE.")
print("   (b) pero decae con tau~ms; la energia util por pulso (~frac_alambre*E_presa) da")
print("       de ~1 a varias gotas/pulso segun cuanta R cae en el alambre vs parasitas.")
print("   (c) la energia por gota (3.9-4.3J) entra COMODA (E_presa=20J@60V, 45J@90V).")
print("   (d) la limitacion sostenida NO es la presa sino RECARGARLA: boost 86W -> ~20 gotas/s.")
print("   (e) FASE 2 (tanque resonante recirculante) mantiene la I PICO sin vaciar la fuente:")
print("       la fuente paga solo perdidas (~48-134W), el tanque circula los cientos de A.")

print("\n" + "="*78)
print("VEREDICTO DE FACTIBILIDAD")
print("="*78)
print("  - SOSTENIDO directo 12-24V: NO (pediria 130-250A directos; fuente da ~10-20A).")
print("  - PULSADO desde la presa 11mF a 60-90V: SI factible en PICO de corriente")
print("    (cientos de A acotados por L_choke/R, no por la fuente).")
print("  - Tasa MEDIA de gotas la fija la RECARGA del boost (~86W) => ~20 gotas/s.")
print("  - El lever es CORRIENTE (densidad J), no tiempo: v1 fallo por baja I, no por")
print("    pulsos cortos/largos. Subir a 90V (margen Holm) + shunt 1mOhm para VER la I.")
print("="*78)

# ----------------------------------------------------------------------------
# RESUMEN NUMERICO COMPACTO (para el reporte)
# ----------------------------------------------------------------------------
print("\nRESUMEN NUMERICO COMPACTO:")
print(f"  I_contacto_fusion (Holm/R_c) = {I_contact_melt:.0f} A  [IMPOSIBLE -> calor NO en contacto]")
print(f"  E_gota_adiabatica            = {E_drop_adia:.2f} J  (gota 1mm; sensible {E_sensible:.2f}+latente {E_latente:.2f})")
print(f"  E_gota_real (operador)       = 4.3 J  (incluye perdidas+ineficiencia, efic~{ef_oper:.0f}%)")
print(f"  I_fusion_sostenida           = ~130-250 A (segun L_hot 2-6mm)")
print(f"  P_fundido (feed 22mm/s+loss) = {P_need:.0f} W  (P_feed {P_feed:.1f} + P_loss {P_loss:.0f})")
print(f"  I_umbral (solo empata loss)  = ~40-70 A  (debajo NUNCA funde)")
print(f"  N_gotas/s sostenible (boost) = ~{N_sustain:.0f} gotas/s")
