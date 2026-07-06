#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
La GOTA como oscilador 𝔄 forzado (modo l=2 de Rayleigh).

ODE:  q'' + g*q' + w2^2*q = w2^2*(I(t)/Icrit)^2      (q normalizado)
  - q = elongacion del modo l=2 ; detach cuando q >= 1
  - referencia: el pinch ESTATICO (DC) a Icrit=194 A da q=1
  - drive unipolar optimo: I(t) = I1*(1+cos(phase))  -> Ipico = 2*I1
  - g = 2/tau_l (amortiguamiento viscoso de Lamb)

Salidas:
  (1) corriente AC minima vs FRECUENCIA  -> la curva de resonancia
  (2) I_min vs CICLOS disponibles (on-resonance)
  (3) receta con chirp (seguimiento) + crecimiento de gota + presupuesto 30 A
"""
import numpy as np, time

gamma_st = 1.5            # N/m  tension superficial
rho      = 7000.0         # kg/m3 liquido
nu       = (6e-3)/7000.0  # m2/s viscosidad cinematica
Icrit    = 194.0          # A  pinch estatico (referencia)
Aw       = 5.027e-7       # m2 area del alambre 0.8mm

def w2_of(a):  return np.sqrt(8*gamma_st/(rho*a**3))
def tau_of(a): return a*a/(5*nu)

a0  = 0.46e-3
W2  = w2_of(a0); G = 2.0/tau_of(a0)
f2  = W2/(2*np.pi); Q = W2/G
print("="*66)
print(f"Gota a={a0*1e3:.2f}mm:  f2={f2:.0f} Hz   Q={Q:.0f}   tau_visc={tau_of(a0)*1e3:.0f} ms")
print(f"Pinch ESTATICO (DC): Icrit={Icrit:.0f} A  -> referencia q=1")
print("="*66)

def run_grid(fd, I1, T, a=a0, dt=8e-6):
    FD, II = np.meshgrid(fd, I1, indexing='ij')
    w2 = w2_of(a); g = 2.0/tau_of(a); w2sq = w2*w2
    wd = 2*np.pi*FD
    q = np.zeros_like(FD); v = np.zeros_like(FD); ph = np.zeros_like(FD)
    qmax = np.zeros_like(FD); tdet = np.full_like(FD, np.nan)
    def force(phase):
        I = II*(1.0+np.cos(phase));  return w2sq*(I/Icrit)**2
    nst = int(T/dt)
    for i in range(nst):
        F0=force(ph); Fh=force(ph+wd*dt/2); F1=force(ph+wd*dt)
        k1q=v;          k1v=F0-g*v-w2sq*q
        k2q=v+dt/2*k1v; k2v=Fh-g*(v+dt/2*k1v)-w2sq*(q+dt/2*k1q)
        k3q=v+dt/2*k2v; k3v=Fh-g*(v+dt/2*k2v)-w2sq*(q+dt/2*k2q)
        k4q=v+dt*k3v;   k4v=F1-g*(v+dt*k3v)-w2sq*(q+dt*k3q)
        q=q+dt/6*(k1q+2*k2q+2*k3q+k4q)
        v=v+dt/6*(k1v+2*k2v+2*k3v+k4v)
        ph=ph+wd*dt
        qmax=np.maximum(qmax,q)
        newly=np.isnan(tdet)&(q>=1.0); tdet[newly]=(i+1)*dt
    return qmax, tdet

def run_tracked(I1, T, vf, dt=8e-6):
    q=v=ph=0.0; a=a0; V=4/3*np.pi*a**3
    nst=int(T/dt)
    for i in range(nst):
        w2=w2_of(a); g=2.0/tau_of(a); w2sq=w2*w2; wd=w2   # <- SEGUIMIENTO
        def F(p): I=I1*(1.0+np.cos(p)); return w2sq*(I/Icrit)**2
        F0=F(ph); Fh=F(ph+wd*dt/2); F1=F(ph+wd*dt)
        k1q=v;          k1v=F0-g*v-w2sq*q
        k2q=v+dt/2*k1v; k2v=Fh-g*(v+dt/2*k1v)-w2sq*(q+dt/2*k1q)
        k3q=v+dt/2*k2v; k3v=Fh-g*(v+dt/2*k2v)-w2sq*(q+dt/2*k2q)
        k4q=v+dt*k3v;   k4v=F1-g*(v+dt*k3v)-w2sq*(q+dt*k3q)
        q=q+dt/6*(k1q+2*k2q+2*k3q+k4q)
        v=v+dt/6*(k1v+2*k2v+2*k3v+k4v)
        ph+=wd*dt
        V+=Aw*vf*dt; a=(3*V/(4*np.pi))**(1/3)
        if q>=1.0: return True,(i+1)*dt,a
    return False,T,a

t0=time.time()

# ---------- (1) curva de resonancia: I_min vs frecuencia ----------
fd = np.linspace(300,1200,60)
I1 = np.linspace(2,45,90)
qm, td = run_grid(fd, I1, 0.040)        # 40 ms de bombeo
det = ~np.isnan(td)
print("\n(1) CURVA DE RESONANCIA  (bombeo 40 ms):")
print("  f_d[Hz] | I1_min[A] | Ipico=2*I1 [A]")
best=(None,1e9)
for i in range(0,60,6):
    idx=np.where(det[i])[0]
    im = I1[idx[0]] if len(idx) else np.nan
    print(f"   {fd[i]:5.0f}  |   {im:5.1f}   |    {2*im:5.1f}")
# minimo global
for i in range(60):
    idx=np.where(det[i])[0]
    if len(idx) and I1[idx[0]]<best[1]: best=(fd[i],I1[idx[0]])
print(f"  -> MINIMO en f_d={best[0]:.0f} Hz (cerca de f2={f2:.0f}): "
      f"I1={best[1]:.1f} A, Ipico={2*best[1]:.1f} A")

# ---------- (2) I_min vs ciclos disponibles (on-resonance) ----------
qm2, td2 = run_grid(np.array([f2]), np.linspace(2,45,300), 0.150)
td2=td2[0]; I1f=np.linspace(2,45,300)
print("\n(2) ON-RESONANCE: corriente minima vs CICLOS disponibles:")
print("  ciclos | I1_min[A] | Ipico[A]")
for nc in [5,10,20,40,80,150]:
    tlim=nc/f2
    ok=np.where((~np.isnan(td2))&(td2<=tlim))[0]
    im=I1f[ok[0]] if len(ok) else np.nan
    print(f"   {nc:4d}  |   {im:5.1f}   |  {2*im:5.1f}")

# ---------- (3) receta tracked + crecimiento + 30 A ----------
print("\n(3) RECETA con SEGUIMIENTO de frecuencia + gota creciendo (vf=6mm/s):")
print("  I1[A] | Ipico[A] | detach? | t[ms] | a_final[mm] | f_ini->f_fin [Hz]")
for I1v in [7,8,9,10,11,12,13,15]:
    okd,tdd,af = run_tracked(I1v, 0.120, 6e-3)
    fini=f2; ffin=w2_of(af)/(2*np.pi)
    print(f"   {I1v:4.1f} |  {2*I1v:5.1f}  |  {'SI ' if okd else 'no '}    |"
          f" {tdd*1e3:5.1f} |    {af*1e3:4.2f}     | {fini:4.0f}->{ffin:4.0f}")

print("\n"+"="*66)
print(f"corrida total: {time.time()-t0:.1f} s")
print(f"COMPARA: pinch bruto estatico = {Icrit:.0f} A  vs  resonante (arriba)")
print("="*66)
