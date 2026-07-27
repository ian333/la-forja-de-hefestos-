#!/usr/bin/env python3
"""
farm-dispositivos.py — MOSFET y DIODO: los datos de los videos de dispositivos.

Ian: "haz un mosfet, haz un diodo… capacitores".

MOSFET — el solver Poisson-Schrödinger VALIDADO de transistor-cuantico.py (el
que reprodujo los 59.6 mV/década de Boltzmann sin que se lo pidiéramos, con
guardarraíl de campo < ruptura). Aquí se mapea COMPLETO:
  · n2D(Vg) fino (curva de encendido) + n(z,Vg) (la nube acercándose al óxido)
  · familia Id(Vg,Vd) por aproximación de canal gradual sobre Qn(V) del solver
  · subthreshold swing medido del barrido — DEBE dar ≥ 59.6 mV/dec (física)
DIODO — unión p-n en aproximación de agotamiento (modelo CLÁSICO de libro,
ETIQUETADO como tal — no ab initio): Vbi, W(V), E(x), bandas vs bias, Shockley.
Los números para el video "por qué el diodo solo deja pasar para un lado".

Salida: dist-video/materia-farm/mosfet-mapa.npz · diodo-datos.json
"""
import os, json
import numpy as np
from scipy.linalg import eigh_tridiagonal, solve_banded

OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'materia-farm')
os.makedirs(OUT, exist_ok=True)

# ── constantes + geometría [IRDS 2 nm] (las mismas del transistor validado) ──
HBAR=1.054571817e-34; M0=9.1093837015e-31; Q=1.602176634e-19
EPS0=8.8541878128e-12; KB=1.380649e-23
T_SH=6e-9; LG=14e-9; EPS_SI=11.7*EPS0
ML, MT = 0.916*M0, 0.19*M0
T=300.0; KT=KB*T/Q; EC0=1.12/2
NZ=200
z=np.linspace(0,T_SH,NZ); dz=z[1]-z[0]
VALLEYS=[('D2',ML,MT,2),('D4',MT,np.sqrt(MT*ML),4)]

def schrod(v,mz,n=4):
    t=HBAR**2/(2*mz*dz**2)/Q
    E,psi=eigh_tridiagonal(2*t+v,-t*np.ones(NZ-1),select='i',select_range=(0,n-1))
    for i in range(psi.shape[1]): psi[:,i]/=np.sqrt((psi[:,i]**2).sum()*dz)
    return E,psi
def occup(En,md,gv,Ef=0.0):
    return gv*(md*KB*T)/(np.pi*HBAR**2)*np.logaddexp(0.0,(Ef-En)/KT)
def poisson(nz_,Vg):
    N=len(nz_); ab=np.zeros((3,N)); ab[0,1:]=1; ab[1,:]=-2; ab[2,:-1]=1
    b=(Q*nz_/EPS_SI)*dz**2
    ab[1,0]=1; ab[0,1]=0; b[0]=Vg; ab[1,-1]=1; ab[2,-2]=0; b[-1]=Vg
    return solve_banded((1,1),ab,b)
def solve(Vg,iters=170,mix=0.05):
    phi=np.full(NZ,Vg); nz_=np.zeros(NZ)
    for _ in range(iters):
        v=EC0-phi; v[0]=v[-1]=EC0+1.5
        nn=np.zeros(NZ)
        for _,mz,md,gv in VALLEYS:
            E,psi=schrod(v,mz)
            for i in range(len(E)): nn+=occup(E[i],md,gv)*psi[:,i]**2
        nz_=(1-mix)*nz_+mix*nn; phi=(1-mix)*phi+mix*poisson(nz_,Vg)
    return phi,nz_

print("[MOSFET] barrido fino de compuerta…", flush=True)
VGS=np.linspace(0.0,0.9,25)
n2d=[]; nz_map=[]
for Vg in VGS:
    phi,nz_=solve(float(Vg))
    # guardarraíl (la lección del campo imposible)
    Ez=np.abs(np.gradient(phi,dz)).max()
    assert Ez < 10*30e6, f"campo imposible a Vg={Vg}"
    n2d.append(nz_.sum()*dz); nz_map.append(nz_)
n2d=np.array(n2d); nz_map=np.array(nz_map)
# subthreshold swing MEDIDO del propio barrido (débil inversión)
mask=(n2d>1e8)&(n2d<1e15)
ss=np.diff(VGS[mask])/np.diff(np.log10(n2d[mask]))
SS=float(np.median(ss))*1000
print(f"  SS medido = {SS:.1f} mV/dec (límite Boltzmann = {KT*np.log(10)*1000:.1f})", flush=True)
assert SS >= KT*np.log(10)*1000*0.98, "SS bajo el límite de Boltzmann — imposible"

# familia Id(Vg,Vd) — canal gradual sobre Qn(V) del solver cuántico
print("[MOSFET] familia Id(Vg,Vd)…", flush=True)
MU=300e-4; W_L=1.0
Qn=Q*n2d                                     # C/m²  vs Vg
VDS=np.linspace(0.0,0.8,17)
ID=np.zeros((len(VGS),len(VDS)))
for i,Vg in enumerate(VGS):
    for j,Vd in enumerate(VDS):
        vv=np.linspace(0,Vd,60)
        qn=np.interp(Vg-vv, VGS, Qn, left=0.0)  # Qn(Vg−V(x))
        ID[i,j]=W_L*MU*np.trapezoid(qn,vv)
np.savez_compressed(f'{OUT}/mosfet-mapa.npz', VGS=VGS, VDS=VDS, n2d=n2d,
                    nz_map=nz_map.astype(np.float32), z=z, ID=ID, SS_mVdec=SS)
print(f"  ✓ mosfet-mapa.npz — Id máx {ID.max()*1e3:.3f} mA/µm·(W/L)", flush=True)

# ── DIODO (modelo clásico de agotamiento — ETIQUETADO, no ab initio) ──
print("[DIODO] unión p-n, aproximación de agotamiento…", flush=True)
NI=1.0e10*1e6; NA=1e17*1e6; ND=1e17*1e6
VBI=KT*np.log(NA*ND/NI**2)
def W_dep(V): return np.sqrt(2*EPS_SI*max(VBI-V,1e-3)*(NA+ND)/(Q*NA*ND))
VB=np.linspace(-2.0,0.7,55)
dio={'Vbi_V':round(VBI,4),
     'W_nm':[round(W_dep(v)*1e9,3) for v in VB],
     'Emax_MV_m':[round(Q*NA*(W_dep(v)*ND/(NA+ND))/EPS_SI/1e6,3) for v in VB],
     'V':[round(v,3) for v in VB],
     'I_rel':[round(float(np.exp(v/KT)-1),6) if v<0.65 else None for v in VB],
     'modelo':'agotamiento clásico + Shockley — ETIQUETAR: no ab initio',
     'Na_cm3':1e17,'Nd_cm3':1e17}
json.dump(dio, open(f'{OUT}/diodo-datos.json','w'), indent=1)
print(f"  ✓ diodo-datos.json — Vbi = {VBI:.3f} V · W(0) = {W_dep(0)*1e9:.1f} nm", flush=True)
print("DISPOSITIVOS_LISTOS", flush=True)
