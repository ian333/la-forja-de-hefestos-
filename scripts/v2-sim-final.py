#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v2 SIM FINAL — con el BOM REAL del pedido AG (2026-06-09).
IRF640N (200V, Rds 0.15) + MUR1560G (Vf~1.05) + shunt fase RA-.1E (0.1)
+ bobina aire 10uH a mano (21 vueltas AWG14, DCR+skin) + banco 3x2200uF/200V
+ fuente 24V/14.6A. Pregunta central: ¿LLEGAMOS A LA GOTA? (umbral fusion 34W
medido en v1; muro de Holm R_contacto 15-18 ohm).
"""
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

print("="*76)
print(" v2 FINAL — simulacion con componentes REALES del pedido AG")
print("="*76)

# ---------------- BOM real ----------------
VIN, IIN_MAX = 24.0, 14.6
L, FSW, NPH = 10e-6, 100e3, 3
RDS = 0.15            # IRF640N a 25C (0.18 caliente)
RSH = 0.10            # RA-.1E en el source (solo conduce en ON)
VF  = 1.05            # MUR1560G
CBUS = 3*2200e-6      # 3 del banco (quedan 2 de repuesto)
VBUS = 120.0
RJ_HOLM = 15.6        # muro de Holm medido en v1 (15-18)
P_MELT = 34.0         # umbral de fusion medido (W)

# bobina de aire a mano: DCR + skin a 100kHz
l_wire = 21*np.pi*0.03                 # 1.98 m
DCR = l_wire*8.286e-3                  # AWG14: 8.286 mOhm/m
delta = 0.066/np.sqrt(FSW)             # piel Cu [m] ~0.21mm @100k
r_w = 1.628e-3/2
Rac = DCR*max(1.0, r_w/(2*delta)+0.26) # factor AC alambre redondo
print(f"\n BOBINA A MANO: 21 vueltas, {l_wire:.2f}m AWG14 · DCR={DCR*1e3:.1f}mΩ · "
      f"Rac@100kHz={Rac*1e3:.1f}mΩ (piel {delta*1e3:.2f}mm)")

# ---------------- 1) BOOST DCM con perdidas reales ----------------
print("\n"+"="*76); print(" 1) BOOST — una fase, con TODAS las perdidas"); print("="*76)
R_on = RDS+RSH+Rac           # camino de carga (FET+shunt+bobina)
def fase(D):
    t_on = D/FSW
    tau = L/R_on
    Ipk = (VIN/R_on)*(1-np.exp(-t_on/tau))      # rampa RL real
    didt_off = (VBUS+VF-VIN)/L
    t2 = Ipk/didt_off; D2 = t2*FSW
    Iout = 0.5*Ipk*D2                            # media al bus
    Iin  = 0.5*Ipk*(D+D2)
    Po   = VBUS*Iout
    # perdidas
    P_fet = Ipk**2*D/3*RDS
    P_sh  = Ipk**2*D/3*RSH
    P_L   = Ipk**2*(D+D2)/3*Rac
    P_d   = VF*Iout
    return Ipk, D2, Iin, Po, P_fet, P_sh, P_L, P_d

D = 0.55
Ipk, D2, Iin1, Po1, Pf, Ps, Pl, Pd = fase(D)
print(f"  D={D} · Ipk={Ipk:.1f}A (lineal daria 13.2 — la R lo dobla apenas) · D2={D2:.3f} · DCM={'OK' if D+D2<1 else 'NO'}")
print(f"  por fase: Pout={Po1:.0f}W · perdidas FET {Pf:.1f}W + shunt {Ps:.1f}W + bobina {Pl:.1f}W + diodo {Pd:.1f}W")
Pin_tot = 3*VIN*Iin1
Po_tot = 3*Po1
eta = Po_tot/(Po_tot+3*(Pf+Ps+Pl+Pd))
print(f"  3 FASES: Pout={Po_tot:.0f}W · Iin={3*Iin1:.1f}A ({'OK<14.6' if 3*Iin1<IIN_MAX else 'EXCEDE FUENTE!'}) · eficiencia ~{eta*100:.0f}%")
print(f"  IRF640N: Ipk {Ipk:.1f}A < 18A continuo ✓, <72A pulsado ✓ · Vds max 120+ring < 200V (snubber+TVS 150V) ✓")
print(f"  MUR1560: {Po1/VBUS:.1f}A medio < 15A ✓")

# ---------------- 2) CARGA DEL BUS ----------------
print("\n"+"="*76); print(" 2) CARGA DEL BUS (3x2200uF a 120V)"); print("="*76)
E_bank = 0.5*CBUS*VBUS**2
t_charge = E_bank/ (Po_tot*0.9)
print(f"  E banco = ½CV² = {E_bank:.1f} J · con {Po_tot*0.9:.0f}W neto → carga 24→120V en ~{t_charge*1e3:.0f} ms")

# ---------------- 3) ¿LLEGAMOS A LA GOTA? el muro de Holm a 120V ----------------
print("\n"+"="*76); print(" 3) EL MURO DE HOLM vs 120V — la pregunta central"); print("="*76)
Rc = np.logspace(0, 3, 400)
P_at = VBUS**2/Rc
R_max_melt = VBUS**2/P_MELT
print(f"  P en la junta = V²/R:")
for r in [1, 5, RJ_HOLM, 40, 100, 400]:
    p = VBUS**2/r
    print(f"    R={r:6.1f}Ω → {p:7.0f} W  {'>>FUNDE' if p>P_MELT else 'no'}")
print(f"  → FUNDE hasta R_contacto = {R_max_melt:.0f}Ω. El muro de Holm (15-18Ω) da {VBUS**2/RJ_HOLM:.0f}W = {VBUS**2/RJ_HOLM/P_MELT:.0f}x el umbral.")
print(f"  (v1 a 51V: limite era {51**2/P_MELT:.0f}Ω — el contacto de 15-18Ω quedaba JUSTO en el filo, 33W~34W)")
print(f"  V_arco=14+10·gap → a 120V sostienes arco hasta gap ~{(VBUS-14)/10:.0f}mm (v1: {(51-14)/10:.1f}mm)")

# ---------------- 4) ENERGIA POR GOTA + RITMO ----------------
print("\n"+"="*76); print(" 4) GOTA: energia y ritmo sostenible"); print("="*76)
d_gota = 0.92e-3
m = 7850*(4/3)*np.pi*(d_gota/2)**3
E_gota = m*1135e3*1.0           # entalpia total fusion acero 1135 kJ/kg
E_real = 2*E_gota               # x2: la mitad se conduce/pierde (medido duro en v1)
P_junta = VBUS**2/RJ_HOLM
t_pulso = E_real/P_junta
I_d = VBUS/RJ_HOLM
sag = I_d*t_pulso/CBUS
print(f"  gota Ø{d_gota*1e3:.2f}mm = {m*1e6:.1f}mg → E_fusion={E_gota:.1f}J · con perdidas x2 = {E_real:.1f}J")
print(f"  a {P_junta:.0f}W el pulso dura {t_pulso*1e3:.1f} ms · I={I_d:.1f}A · el bus cae {sag:.1f}V de 120 ({sag/VBUS*100:.1f}%)")
print(f"  ← v1 colapsaba 42→12V; ahora el banco de {CBUS*1e6:.0f}uF aguanta TIESO")
drops_s = Po_tot*0.9/E_real
print(f"  ritmo: el boost repone {Po_tot*0.9:.0f}W → {drops_s:.0f} gotas/s sostenidas (necesitamos 10-15) ✓✓")
duty_max = (Po_tot*0.9)/P_junta
print(f"  duty max de descarga = {duty_max*100:.0f}% (ej. pulsos de {t_pulso*1e3:.1f}ms a {duty_max/t_pulso:.0f} Hz)")

# ---------------- 5) FALLA: junta funde a corto (R→1Ω) ----------------
print("\n"+"="*76); print(" 5) FALLA — el corto liquido (R_j→1Ω) y el CHOQUE de descarga"); print("="*76)
L_wire_only = 1.5e-6
for Lz, nombre in [(L_wire_only,'SIN choke (solo cableado 1.5uH)'), (50e-6,'CON choke 50uH (47 vueltas a mano)')]:
    didt = VBUS/Lz
    i_2us = min(didt*2e-6, 120)   # lo que ve el ADC en su 1a muestra (2us @500kS/s)
    t_60A = 60/didt
    print(f"  {nombre}: di/dt={didt/1e6:.1f}A/us → a 2us ya hay {i_2us:.0f}A · llega a 60A en {t_60A*1e6:.1f}us")
print(f"  IRF640N pulsado max 72A → SIN choke el corto lo MATA antes de la 1a lectura.")
print(f"  CON choke: banda histeresis 40-60A controlable a ~30-60kHz (IR2110 lo hace dormido).")
N50 = np.sqrt(50e-6*0.04/(4*np.pi*1e-7*np.pi*0.015**2))
print(f"  CHOKE = otra bobina TUYA: {N50:.0f} vueltas mismo tubo Ø3cm/4cm = 50uH · {N50*np.pi*0.03:.1f}m de alambre")

# ---------------- 6) ALAMBRE TOTAL ----------------
l_tot = 3*l_wire + N50*np.pi*0.03 + 2.0
print(f"\n  ALAMBRE MAGNETO AWG14 TOTAL: 3 boost ({3*l_wire:.1f}m) + choke ({N50*np.pi*0.03:.1f}m) + colas ≈ {l_tot:.0f} m  (~{l_tot*18.5:.0f} g → pide 400g)")

# ---------------- PLOTS ----------------
fig, ax = plt.subplots(2, 2, figsize=(12, 8.5), facecolor='#0b0f17')
for a in ax.flat:
    a.set_facecolor('#0e1726'); a.tick_params(colors='#94a3b8')
    [s.set_color('#1e293b') for s in a.spines.values()]

# (a) potencia vs duty
duties = np.linspace(0.1, 0.78, 80)
P_curve = [3*fase(d)[3] for d in duties]
Iin_c = [3*fase(d)[2] for d in duties]
ax[0,0].plot(duties, P_curve, color='#4ade80', lw=2)
ok = np.array(Iin_c) < IIN_MAX
ax[0,0].fill_between(duties, 0, P_curve, where=~ok, color='#f87171', alpha=0.25, label='fuente excedida')
ax[0,0].axhline(P_MELT, color='#f87171', ls='--', lw=1, label='umbral fusion 34W')
ax[0,0].set_title('P_out vs duty (3 fases, perdidas reales)', color='#fbbf24')
ax[0,0].set_xlabel('duty', color='#94a3b8'); ax[0,0].set_ylabel('W', color='#94a3b8')
ax[0,0].legend(facecolor='#0e1726', labelcolor='#cbd5e1', fontsize=8)

# (b) muro de Holm
ax[0,1].loglog(Rc, P_at, color='#fb923c', lw=2.5, label='P=V²/R a 120V')
ax[0,1].loglog(Rc, 51**2/Rc, color='#64748b', lw=1.5, ls='--', label='v1 (51V)')
ax[0,1].axhline(P_MELT, color='#f87171', ls='--', lw=1.2)
ax[0,1].axvspan(15, 18, color='#38bdf8', alpha=0.3, label='muro de Holm 15-18Ω')
ax[0,1].text(16, 1500, f'{VBUS**2/RJ_HOLM:.0f}W\n27x umbral', color='#eaf6ff', fontsize=9, ha='center')
ax[0,1].set_title('EL MURO CAE: funde hasta R=424Ω', color='#fbbf24')
ax[0,1].set_xlabel('R contacto [Ω]', color='#94a3b8'); ax[0,1].set_ylabel('W en la junta', color='#94a3b8')
ax[0,1].legend(facecolor='#0e1726', labelcolor='#cbd5e1', fontsize=8)

# (c) tren de gotas: Vbus(t)
tt = np.linspace(0, 0.5, 5000); dt = tt[1]-tt[0]
v = np.zeros_like(tt); v[0] = VBUS
f_drop, t_p = 20.0, t_pulso
for i in range(1, len(tt)):
    ph = (tt[i]*f_drop) % 1.0
    on = ph < t_p*f_drop
    i_out = v[i-1]/RJ_HOLM if on else 0.0
    i_in = min(Po_tot*0.9/max(v[i-1],1), 5.0)
    v[i] = v[i-1] + (i_in - i_out)/CBUS*dt
ax[1,0].plot(tt*1e3, v, color='#fb923c', lw=1.5)
ax[1,0].axhline(VBUS, color='#1e293b', lw=0.8)
ax[1,0].set_ylim(100, 125)
ax[1,0].set_title(f'Vbus con 20 gotas/s ({t_p*1e3:.1f}ms c/u): cae {sag:.1f}V y se repone', color='#fbbf24')
ax[1,0].set_xlabel('ms', color='#94a3b8'); ax[1,0].set_ylabel('V', color='#94a3b8')

# (d) falla con/sin choke
t_us = np.linspace(0, 30, 600)
for Lz, c, lbl in [(1.5e-6, '#f87171', 'sin choke: 80A/µs'), (50e-6, '#4ade80', 'con choke 50µH: 2.4A/µs')]:
    i_t = np.minimum(VBUS/Lz*t_us*1e-6, 130)
    ax[1,1].plot(t_us, i_t, color=c, lw=2, label=lbl)
ax[1,1].axhline(72, color='#f87171', ls='--', lw=1, label='IRF640 muere (72A)')
ax[1,1].axhspan(40, 60, color='#38bdf8', alpha=0.2, label='banda de control 40-60A')
ax[1,1].axvline(2, color='#64748b', ls=':', lw=1)
ax[1,1].text(2.3, 100, '1a lectura ADC (2µs)', color='#94a3b8', fontsize=8)
ax[1,1].set_ylim(0, 135)
ax[1,1].set_title('Corto liquido: el choke (TU bobina #4) salva al MOSFET', color='#fbbf24')
ax[1,1].set_xlabel('µs', color='#94a3b8'); ax[1,1].set_ylabel('A', color='#94a3b8')
ax[1,1].legend(facecolor='#0e1726', labelcolor='#cbd5e1', fontsize=8)

plt.tight_layout()
plt.savefig('/tmp/v2-final-sim.png', dpi=115, facecolor='#0b0f17')
print("\n  → grafica: /tmp/v2-final-sim.png")
print("="*76)
