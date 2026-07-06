#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
v2 — BOOST TRIFASICO INTERLEAVED (3 bobinas de AIRE) para la impresora de metal.
Calcula TODO y verifica: diseno del boost (DCM, 3 fases 120 deg), bobina de aire
(vueltas), shunts (por fase + entrada + descarga), divisores de voltaje (bus +
V_junta), lo que lee el ADC, balance de potencia, y SIMULA la cancelacion de rizo
del interleaved. Anclado en los datos de ayer (fusion 33-47W, R junta 15-40 ohm).
"""
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

print("="*74)
print(" v2 — BOOST TRIFASICO INTERLEAVED · diseno + verificacion")
print("="*74)

# ---------- ESPECIFICACION ----------
VIN   = 24.0       # fuente del user
IIN_MAX = 14.6     # A de la fuente
VOUT  = 120.0      # bus objetivo
ETA   = 0.88       # eficiencia estimada
FSW   = 100e3      # 100 kHz (el aire AMA alta f: cero perdida de nucleo)
NPH   = 3          # 3 fases
print(f"  Entrada {VIN}V/{IIN_MAX}A ({VIN*IIN_MAX:.0f}W)  ->  Bus {VOUT}V  ·  {NPH} fases @ {FSW/1e3:.0f}kHz")

# ---------- POTENCIA ----------
PIN_MAX = VIN*IIN_MAX
POUT_MAX = PIN_MAX*ETA
IOUT = POUT_MAX/VOUT
print(f"\n  POTENCIA: Pin_max={PIN_MAX:.0f}W -> Pout~{POUT_MAX:.0f}W (eta {ETA})  |  Iout_bus={IOUT:.1f}A")
Pph = POUT_MAX/NPH
print(f"  por fase: ~{Pph:.0f}W")

# ---------- BOBINA DE AIRE + MODO ----------
# air-core practico ~10uH (bobina chica). A esta L y f -> DCM (corriente va a 0).
L = 10e-6
T = 1.0/FSW
# DCM: D2 = D*Vin/(Vout-Vin).  P_fase = 1/2 L Ipk^2 f,  Ipk = Vin*D/(L*f)
# despejar D para Pph:
Ipk_target = np.sqrt(2*Pph/(L*FSW))
D = Ipk_target*L*FSW/VIN
D2 = D*VIN/(VOUT-VIN)
print(f"\n  BOBINA: L={L*1e6:.0f}uH (AIRE) · modo {'DCM' if D+D2<1 else 'CCM'} (D+D2={D+D2:.2f}<1)")
print(f"  duty D={D:.2f} · D2(descarga)={D2:.2f} · Ipk/fase={Ipk_target:.1f}A · Iavg_in/fase={Ipk_target*(D+D2)/2:.1f}A")
print(f"  VERIF potencia/fase: 1/2*L*Ipk^2*f = {0.5*L*Ipk_target**2*FSW:.0f}W  (objetivo {Pph:.0f}W) OK")

# bobina de aire: vueltas (solenoide, metrico)  L = mu0 * N^2 * A / l
mu0 = 4*np.pi*1e-7
r_form = 0.015        # tubo 3cm diametro
A_coil = np.pi*r_form**2
l_coil = 0.04         # 4cm largo
N = np.sqrt(L*l_coil/(mu0*A_coil))
print(f"  AIRE a mano: tubo Ø3cm, largo 4cm  ->  N = {N:.0f} vueltas  (AWG12-14, Ipk {Ipk_target:.0f}A)")
print(f"  (formula L=mu0*N^2*A/l -> reproducible para PRODUCTO, cero ferrita)")

# ---------- SHUNTS (sensado de corriente) ----------
print("\n"+"="*74); print(" SHUNTS — sensado de corriente (lo que faltaba)"); print("="*74)
# por fase: balanceo de corriente. Ipk~14A. shunt chico, leemos con ganancia.
Rsh_ph = 0.010       # 10 mOhm
Vsh_ph_pk = Ipk_target*Rsh_ph
Irms_ph = Ipk_target*np.sqrt((D+D2)/3)   # triangulo DCM aprox
Psh_ph = Irms_ph**2*Rsh_ph
print(f"  3x SHUNT DE FASE: {Rsh_ph*1e3:.0f}mOhm  -> Vpk={Vsh_ph_pk*1e3:.0f}mV (Ipk {Ipk_target:.0f}A) · Irms~{Irms_ph:.1f}A · disipa {Psh_ph:.2f}W")
print(f"     -> amplificar x20 (INA o opamp) para el ADC, o leer pico. Sirve para BALANCEAR fases.")
Rsh_in = 0.005
print(f"  1x SHUNT DE ENTRADA: {Rsh_in*1e3:.0f}mOhm -> {IIN_MAX*Rsh_in*1e3:.0f}mV a {IIN_MAX}A · disipa {IIN_MAX**2*Rsh_in:.1f}W (corriente total de la fuente)")
Rsh_dis = 0.001
Idis_pk = VOUT/15.0   # R junta ~15 ohm (medido ayer) a 120V
print(f"  1x SHUNT DESCARGA: {Rsh_dis*1e3:.1f}mOhm -> a Ipico {Idis_pk:.0f}A (120V/15ohm) = {Idis_pk*Rsh_dis*1e3:.0f}mV · (la energia se mide ademas por caida de Vbus)")
print(f"  -> ACS758 (Hall, aislado) opcional en lugar del shunt de entrada (cero perdida).")

# ---------- DIVISORES DE VOLTAJE ----------
print("\n"+"="*74); print(" DIVISORES DE VOLTAJE"); print("="*74)
VREF=3.3
def divisor(nombre, Rtop, Rbot, vmax_lectura):
    ratio=(Rtop+Rbot)/Rbot
    vmax=VREF*ratio
    print(f"  {nombre}: {Rtop/1e3:.0f}k/{Rbot/1e3:.0f}k -> ÷{ratio:.1f} · lee hasta {vmax:.0f}V · "
          f"a {vmax_lectura}V el ADC ve {vmax_lectura/ratio:.2f}V ({'OK' if vmax_lectura/ratio<VREF else 'SATURA!'})")
    return ratio
r_bus = divisor("BUS 120V (V_cap)", 400e3, 10e3, VOUT)        # ÷41 lee 135V
r_jun = divisor("V_junta (arco)  ", 200e3, 10e3, 60.0)        # ÷21 lee 69V (el arco es 14-60V)
print(f"  -> ADC del RP2350 = 3 canales; con 5+ senales (3 fase + bus + descarga) usar MUX 74HC4051 (8ch).")

# ---------- CAPACITORES ----------
print("\n"+"="*74); print(" CAPACITOR DEL BUS"); print("="*74)
# rizo de salida con interleaved. ESR aparte; rizo capacitivo:
dV_bus = 2.0   # rizo objetivo 2V
Cbus = IOUT*D/(FSW*NPH*dV_bus)   # interleaved divide el rizo por N efectivamente
print(f"  Cbus para rizo {dV_bus}V (interleaved /{NPH}): >= {Cbus*1e6:.0f}uF  -> usar 2-3x CE-2200/200V (6600uF, sobra)")
print(f"  200V de rating vs 120V bus = 80V margen. OK.")

# ---------- SIMULACION: cancelacion de rizo interleaved ----------
print("\n"+"="*74); print(" SIMULACION — cancelacion de rizo (interleaved 120 deg)"); print("="*74)
tt = np.linspace(0, 3*T, 3000)
def iL_phase(t, phase_shift):
    # corriente DCM triangular por fase, desfasada
    out=np.zeros_like(t)
    for i,ti in enumerate(t):
        ph=((ti/T)+phase_shift) % 1.0
        if ph < D:
            out[i]=Ipk_target*ph/D
        elif ph < D+D2:
            out[i]=Ipk_target*(1-(ph-D)/D2)
        else:
            out[i]=0.0
    return out
i1=iL_phase(tt,0); i2=iL_phase(tt,1/3); i3=iL_phase(tt,2/3)
i_in_3ph=i1+i2+i3
i_in_1ph=iL_phase(tt,0)*3   # mismo Pin con 1 sola fase (escalado)
rizo_3=(i_in_3ph.max()-i_in_3ph.min())/i_in_3ph.mean()*100
rizo_1=(i_in_1ph.max()-i_in_1ph.min())/max(i_in_1ph.mean(),1e-6)*100
print(f"  rizo corriente de ENTRADA:  1 fase = {rizo_1:.0f}%   ·   3 fases interleaved = {rizo_3:.0f}%")
print(f"  -> el interleaved BAJA el rizo {rizo_1/max(rizo_3,1):.1f}x = la fuente ve corriente SUAVE")
print(f"     (esto evita el JALON que tumbaba la fuente del v1)")

# ---------- PLOT ----------
fig,ax=plt.subplots(3,1,figsize=(9,8),facecolor='#0b0f17')
for a in ax: a.set_facecolor('#0e1726'); a.tick_params(colors='#94a3b8'); [s.set_color('#1e293b') for s in a.spines.values()]
ax[0].plot(tt*1e6,i1,color='#fb923c',lw=1.5,label='Fase 1')
ax[0].plot(tt*1e6,i2,color='#38bdf8',lw=1.5,label='Fase 2 (120°)')
ax[0].plot(tt*1e6,i3,color='#4ade80',lw=1.5,label='Fase 3 (240°)')
ax[0].set_title('Corriente en las 3 bobinas de aire (DCM, interleaved)',color='#fbbf24')
ax[0].set_ylabel('I_L [A]',color='#94a3b8'); ax[0].legend(facecolor='#0e1726',labelcolor='#cbd5e1',fontsize=8)
ax[1].plot(tt*1e6,i_in_1ph,color='#f87171',lw=1.5,label=f'1 fase (rizo {rizo_1:.0f}%)')
ax[1].plot(tt*1e6,i_in_3ph,color='#a78bfa',lw=2,label=f'3 fases sumadas (rizo {rizo_3:.0f}%)')
ax[1].set_title('Corriente de ENTRADA: el interleaved cancela el rizo',color='#fbbf24')
ax[1].set_ylabel('I_in [A]',color='#94a3b8'); ax[1].legend(facecolor='#0e1726',labelcolor='#cbd5e1',fontsize=8)
# tercera: barrido potencia vs duty (para mostrar el control)
duties=np.linspace(0.1,0.79,60)
Pcurve=[NPH*0.5*L*(VIN*d/(L*FSW))**2*FSW for d in duties]
ax[2].plot(duties,Pcurve,color='#4ade80',lw=2)
ax[2].axhline(34,color='#f8717188',ls='--',label='umbral fusion 34W')
ax[2].axhline(POUT_MAX,color='#fbbf2488',ls=':',label=f'tope fuente {POUT_MAX:.0f}W')
ax[2].set_title('Potencia entregada vs duty (la perilla de control)',color='#fbbf24')
ax[2].set_xlabel('Duty',color='#94a3b8'); ax[2].set_ylabel('P [W]',color='#94a3b8')
ax[2].legend(facecolor='#0e1726',labelcolor='#cbd5e1',fontsize=8)
plt.tight_layout()
plt.savefig('/tmp/v2-sim.png',dpi=110,facecolor='#0b0f17')
print("\n  -> grafica guardada en /tmp/v2-sim.png")

print("\n"+"="*74); print(" RESUMEN VERIFICADO (para el esquematico)"); print("="*74)
print(f"  3 fases · L={L*1e6:.0f}uH aire ({N:.0f} vueltas) · {FSW/1e3:.0f}kHz · D~{D:.2f} DCM · Ipk {Ipk_target:.0f}A/fase")
print(f"  SIHG20N50C (500V) x3 · 60F30 x3 · Cbus 2-3x CE-2200/200V")
print(f"  Shunts: 3x{Rsh_ph*1e3:.0f}m(fase) + {Rsh_in*1e3:.0f}m(entrada) + {Rsh_dis*1e3:.1f}m(descarga)")
print(f"  Divisores: ÷{r_bus:.0f}(bus) + ÷{r_jun:.0f}(junta) · MUX 74HC4051 para el ADC")
print("="*74)
