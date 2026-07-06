#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EXPLORACION de TODAS las variables del proceso de deposicion por microalambre
(acero E71T-GS 0.8mm). Barre cada perilla sobre los modelos fisicos ya validados
y reporta su efecto en 4 resultados:
  [F] fundir/sostener   [W] ancho de cordon (precision)
  [D] desprendimiento (resonancia)   [A] acumulacion de calor
Todo analitico -> instantaneo.
"""
import numpy as np

# ===== material acero =====
g_st=1.5; rho_l=7000.; rho_s=7850.; cp=600.; Lf=250e3
mu=6e-3; nu=mu/rho_l; k=45.; alpha=k/(rho_s*cp)
Tm=1500.; T0=25.; Icrit=194.
def Aw(d): return np.pi/4*d**2

# ===== modelos =====
def w_l(a,l=2): return np.sqrt(l*(l-1)*(l+2)*g_st/(rho_l*a**3))
def tau_l(a): return a*a/(5*nu)
def Qmech(a,l=2): return w_l(a,l)*tau_l(a)/2
def lam_cap(): return np.sqrt(g_st/(rho_l*9.81))

def solveR(B):
    R=max(B*0.5,1e-9); lnB=np.log(B)
    for _ in range(80):
        f=np.log(R)+R/(1+R)-lnB; fp=1/R+1/(1+R)**2; R=max(R-f/fp,1e-12)
    return R
def beadW(Qnet,vt,dT,kk=k):
    al=kk/(rho_s*cp); B=Qnet*vt/(4*np.pi*kk*al*dT); R=solveR(B)
    ymax=R*np.sqrt(1+2*R)/(1+R); return 2*ymax*(2*al/vt)*1e3   # mm

def Ploss(vf,Tamb=T0,Lth=1e-3,kk=k,d=0.8e-3):
    Pc=kk*Aw(d)*(Tm-Tamb)/Lth
    Pw=rho_s*Aw(d)*vf*(cp*(Tm-Tamb)+Lf)
    return Pc+Pw
def I0hold(R,Pl,Iac): return np.sqrt(max(Pl/R-Iac*Iac/2,0.))
def Iac_detach(I0,a,l=2): return Icrit**2/(2*I0*Qmech(a,l))   # on-resonance, estado estable
def dropletD(d,Lmelt=None):
    L=Lmelt if Lmelt else d; V=Aw(d)*L; return (6*V/np.pi)**(1/3)
def Edrop(d,Lmelt=None):
    L=Lmelt if Lmelt else d; m=rho_s*Aw(d)*L; return m*(cp*(Tm-T0)+Lf)

# ===== BASELINE =====
d0=0.8e-3; a0=0.46e-3; Qnet0=250.; vt0=16e-3; vf0=3e-3; R0=0.12; I0_0=40.
def line(): print("-"*70)
print("="*70)
print("BASELINE: d=0.8mm, a_gota=0.46mm, Qnet=250W, vt=16mm/s, vf=3mm/s,")
print(f"          R_op=120mohm, I0=40A | f2={w_l(a0)/2/np.pi:.0f}Hz Q_mec={Qmech(a0):.0f}")
print(f"          lambda_cap={lam_cap()*1e3:.2f}mm  W={beadW(Qnet0,vt0,Tm-T0):.2f}mm  Edrop={Edrop(d0):.2f}J")
print("="*70)

# =================================================================
print("\n### 1. ELECTRICAS ###")
line()
print("[1a] R_op (resistencia de contacto, CALIENTE) -> fundir/sostener")
print("  R_op[mohm] | I0_hold[A] | cabe 30A? | cabe 45A(boost)?")
Pl=Ploss(vf0)
for R in [0.015,0.03,0.06,0.10,0.15,0.20]:
    ih=I0hold(R,Pl,6.); print(f"    {R*1e3:5.0f}   |   {ih:5.1f}    |   {'si' if ih+6<=30 else 'NO':2}      |   {'si' if ih+6<=45 else 'NO'}")
print("  => clave: R baja = imposible a 30A. Necesitas R alta (contacto fino) O boost.")
line()
print("[1b] Corriente disponible en la junta (boost LC) -> fundir")
print("  junta[A] | sostiene (R=60mohm)?")
for Ib in [30,45,60,90]:
    print(f"    {Ib:4d}   |  {'SI' if I0hold(0.06,Pl,6)+6<=Ib else 'no'}  (I0_hold={I0hold(0.06,Pl,6):.0f}A)")
print("  => el boost mueve TODO; 45A ya sostiene con R modesta.")
line()
print("[1c] I_ac (ripple) -> desprendimiento (I0=40A, on-resonance)")
print("  I_ac[A] | q_resonante | desprende?")
for Iac in [2,4,6,8,10]:
    qr=2*Qmech(a0)*I0_0*Iac/Icrit**2; print(f"    {Iac:4.1f}  |    {qr:5.2f}    |  {'SI' if qr>=1 else 'no'}")
print(f"  => I_ac minimo = Icrit^2/(2 Q I0) = {Iac_detach(I0_0,a0):.1f}A. Diminuto.")
line()
print("[1d] FRECUENCIA de drive -> curva de resonancia (I_ac min para desprender)")
f2=w_l(a0)/2/np.pi; gd=2/tau_l(a0)
print("  f_d[Hz] | I_ac_min[A]   (I0=40A)")
for fd in [400,550,640,f2,700,800,1000]:
    wd=2*np.pi*fd
    A1=np.sqrt((w_l(a0)**2-wd**2)**2+(gd*wd)**2)   # 1/(ganancia)
    Iac=Icrit**2*A1/(w_l(a0)**2*2*I0_0)
    print(f"   {fd:5.0f}  |   {Iac:6.1f}{'   <-- pico' if abs(fd-f2)<5 else ''}")
print(f"  => agudisima (ancho {f2/Qmech(a0):.1f}Hz). Fuera de pico, la corriente explota.")
line()
print("[1e] I0 (corriente base/calentar) -> baja el ripple de desprendimiento")
print("  I0[A] | I_ac_min[A] | nota")
for I0v in [15,25,40,60,90]:
    print(f"   {I0v:4d} |   {Iac_detach(I0v,a0):5.1f}    | mas DC = menos ripple (2 I0 I_ac)")
print("  => subir I0 (calentar) ABARATA el desprendimiento. Doble uso.")
line()
print("[1f] L (inductancia del lazo) -> suaviza la corriente (filtro electrico)")
print("  L[uH] | tau=L/R[us] | f_esquina[kHz] | regimen")
for L in [0.1,0.5,1.0,2.0]:
    tau=L*1e-6/R0; fc=1/(2*np.pi*tau)
    reg="pulsos finos" if fc>20 else ("PWM->DC suave" if fc<5 else "intermedio")
    print(f"  {L:4.1f}  |   {tau*1e6:5.1f}    |    {fc/1e3:5.1f}      | {reg}")
print("  => L grande = la corriente 'pasa' como promedio (tu observacion). L chica = pulsos.")
line()
print("[1g] Polaridad DCEN/DCEP -> reparto de calor (cualitativo)")
print("  DCEN: ~ mas calor al ALAMBRE (funde mas alambre, menos penetracion)")
print("  DCEP: ~ mas calor a la PIEZA (mas penetracion/fusion del sustrato)")
print("  AC  : balancea. -> palanca de penetracion vs tasa de deposito.")

# =================================================================
print("\n### 2. GEOMETRICAS ###")
line()
print("[2a] DIAMETRO de alambre -> piso de feature, energia, frecuencia")
print("  d[mm] | D_gota[mm] | E_gota[J] | f2_gota[Hz] | nota")
for d in [0.45,0.6,0.8,1.0]:
    dd=d*1e-3; ad=dropletD(dd)/2
    print(f"  {d:4.2f}  |   {dropletD(dd)*1e3:4.2f}    |  {Edrop(dd):5.2f}   |   {w_l(ad)/2/np.pi:5.0f}     | mas fino=mejor precision")
print("  => 0.8->0.6mm baja el piso a ~0.7mm y sube f2; menos energia/gota.")
line()
print("[2b] v_t (velocidad de traslacion) -> ANCHO de cordon (Rosenthal)")
print("  vt[mm/s] | W[mm]")
for vt in [5,10,16,25,40]:
    print(f"    {vt:4d}   | {beadW(Qnet0,vt*1e-3,Tm-T0):4.2f}")
print("  => mas rapido = cordon mas fino (a Q fijo). 'Precision por velocidad'.")
line()
print("[2c] v_f (alimentacion) -> carga de fusion (alambre frio) + altura")
print("  vf[mm/s] | P_alambre[W] | nota")
for vf in [1,3,6,10]:
    Pw=rho_s*Aw(d0)*vf*1e-3*(cp*(Tm-T0)+Lf)
    print(f"    {vf:4d}   |    {Pw:5.1f}     | mas feed = mas carga termica + cordon mas alto")
print("  => v_f es throttle: bajarlo facilita fundir con poca corriente (ir lento).")
line()
print("[2d] DWELL entre capas -> acumulacion de calor (T inter-pasada, lumped)")
print("  dwell[s] | T_interpasada estimada[C] | deriva de W")
# lumped: balance deposito vs enfriamiento Newton; T_ss ~ aporte*tau/(m cp), normalizado
Edep=Edrop(d0);
for dw in [0,1,3,5]:
    # modelo simple: cada capa mete calor; enfria exp con tau_cool=4s en el dwell
    Tacc=T0+(320-T0)*np.exp(-dw/4.0)   # interpola de la corrida cara-i (318C sin dwell)
    print(f"   {dw:4d}    |        {Tacc:5.0f}             | W={beadW(Qnet0,vt0,Tm-Tacc):.2f}mm")
print("  => dwell de 3-5s tumba la deriva (consistente con el solver cara-i).")
line()
print("[2e] STAND-OFF (gap alambre-sustrato) -> capacitancia (sensor) y modo")
print("  gap[mm] | C_gap[pF]   (gota 0.9mm)")
Ad=np.pi*(0.45e-3)**2
for gp in [0.1,0.3,0.5,1.0]:
    C=8.854e-12*Ad/(gp*1e-3)*1e12
    print(f"   {gp:4.1f}   |  {C:6.3f}")
print("  => el gap cambia C -> lo lees por corrimiento de frecuencia = tamano/proximidad.")

# =================================================================
print("\n### 3. TERMICAS ###")
line()
print("[3a] PRECALENTAMIENTO del sustrato -> ancho W (sube) y costo de fundir (baja)")
print("  T_sub[C] | W[mm] | P_loss[W] | I0_hold(R=60m)[A]")
for Ts in [25,150,300,450]:
    Pl_s=Ploss(vf0,Tamb=Ts)
    print(f"   {Ts:4d}    | {beadW(Qnet0,vt0,Tm-Ts):4.2f}  |   {Pl_s:5.1f}   |   {I0hold(0.06,Pl_s,6):4.1f}")
print("  => precalentar AYUDA a fundir (menos perdida) pero ENGORDA el cordon. Compromiso.")
line()
print("[3b] tau_cool entre pasadas -> T de acumulacion en estado estable")
print("  tau_cool[s] | T_acc[C] (sin dwell)")
for tc in [1,2,4,8]:
    Tacc=T0+(320-T0)*(tc/(tc+1.5))   # mas lento enfria = mas calor
    print(f"     {tc:3d}      |   {Tacc:5.0f}")
print("  => sustrato/disipador que enfria rapido (tau chico) = menos acumulacion.")
line()
print("[3c] MATERIAL del sustrato (k) -> velocidad de enfriamiento")
print("  sustrato     | k[W/mK] | enfria")
for nm,kk in [("cobre",400),("acero",45),("inox",15)]:
    print(f"  {nm:10s}   |   {kk:4d}  | {'rapidisimo (gota congela ya)' if kk>200 else ('moderado' if kk>30 else 'lento (acumula)')}")
print("  => cobre como base = gota congela en ~0.1ms (anti-embolado); inox acumula.")

# =================================================================
print("\n### 4. MATERIAL (de la gota) ###")
line()
print("[4a] gamma (tension superficial) -> f2, lambda_cap, pinch, Q")
print("  gamma[N/m] | f2[Hz] | lambda_cap[mm] | I_crit_pinch[A]")
for gg in [1.0,1.5,2.0]:
    f2g=np.sqrt(8*gg/(rho_l*a0**3))/2/np.pi
    lc=np.sqrt(gg/(rho_l*9.81))*1e3
    Icr=np.sqrt(8*np.pi**2*(d0/2)*gg/(4*np.pi*1e-7))
    print(f"    {gg:4.1f}   |  {f2g:5.0f} |     {lc:4.2f}      |   {Icr:4.0f}")
print("  => mas gamma = mas frecuencia, mas dificil de pinchar, gotas mas redondas.")
line()
print("[4b] mu (viscosidad) -> Q de la resonancia (agudeza) -> ripple de desprendimiento")
print("  mu[mPa.s] | Q_mec | ancho Df[Hz] | I_ac_min[A]")
for mm in [3e-3,6e-3,12e-3]:
    nuu=mm/rho_l; tau=a0*a0/(5*nuu); Qm=w_l(a0)*tau/2
    Iac=Icrit**2/(2*I0_0*Qm)
    print(f"    {mm*1e3:4.0f}    |  {Qm:4.0f} |    {w_l(a0)/2/np.pi/Qm:4.1f}      |   {Iac:4.1f}")
print("  => menos viscoso = Q alto = resonancia mas aguda = desprende con MENOS ripple.")

# =================================================================
print("\n### 5. RESONANCIA PROFUNDA (tu consentida) ###")
line()
print("[5a] MODOS de la gota (l) -> espectro anarmonico (a=0.46mm)")
print("  l | f_l[Hz] | f_l/f2 | Q_l | comportamiento")
comp={2:"prolato-oblato (DESPRENDER)",3:"triangular",4:"cuadrado",5:"fino"}
for l in [2,3,4,5]:
    print(f"  {l} |  {w_l(a0,l)/2/np.pi:5.0f} |  {w_l(a0,l)/w_l(a0,2):4.2f}  | {Qmech(a0,l):3.0f} | {comp[l]}")
print("  => NO son armonicos puros; eliges el modo segun lo que quieras hacerle a la gota.")
line()
print("[5b] ARMONICOS por la no-linealidad I^2 (drive a f, fuerza en f y 2f)")
print("  drive a f2/2=%.0fHz -> el 2f cae en f2=%.0fHz (excitacion parametrica)"%(f2/2,f2))
print("  drive a f2  =%.0fHz -> el 2f cae en %.0fHz ~ cerca de f3=%.0fHz (excita 2 modos)"%(f2,2*f2,w_l(a0,3)/2/np.pi))
line()
print("[5c] La frecuencia BARRE mientras la gota crece (hay que seguirla)")
print("  a[mm] | f2[Hz]  (la gota crece -> f2 baja -> chirp del drive)")
for am in [0.30,0.40,0.46,0.55,0.70]:
    print(f"  {am:4.2f}  | {w_l(am*1e-3)/2/np.pi:5.0f}")
print("  => sensor capacitivo da a(t) -> fija f2(t). Lazo cerrado por resonancia.")

# =================================================================
print("\n### SINTESIS: que perilla manda para cada meta ###")
line()
print("  FUNDIR/SOSTENER : R_op(contacto) y BOOST >> v_f > precalentar   [el cuello real]")
print("  PRECISION (W)   : v_t y Q_net dominan; d(alambre)=piso; T_sub deriva")
print("  DESPRENDER (D)  : RESONANCIA (f) + I0 alto -> ripple ~3-6A; mu/gamma fijan Q")
print("  ACUMULACION (A) : DWELL y sustrato(k) mandan; v_f aporta calor")
print("  >> La FRECUENCIA es la unica perilla que casi no cuesta energia y separa la gota.")
print("="*70)
