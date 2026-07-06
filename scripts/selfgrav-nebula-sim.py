#!/usr/bin/env python3
"""
selfgrav-nebula-sim.py — nebulosa con AUTO-GRAVEDAD REAL + turbulencia, usando el
Operador Ian COMPLETO: cada operador lineal en su CARA DIAGONAL (cara-i / Fourier).

"Las formas son gravedad" (Ian). Aquí la gravedad SÍ está, resuelta exacta y barata:
  · GRAVEDAD (Particle-Mesh): Poisson ∇²ψ = 4πGρ es DIAGONAL en Fourier →
    ψ_k = −4πG·ρ_k/k²  (un solo cociente por modo). Fuerza F = −∇ψ → F_k = −i k ψ_k.
    Esto es O(N log N), EXACTO. (El método PM de cosmología = la cara-i de la gravedad.)
  · TURBULENCIA (forzamiento): campo incompresible (Kolmogorov, div-free) en cara-i.
  · La materia COLAPSA y se FRAGMENTA por su propia gravedad → filamentos + núcleos densos
    (el mecanismo REAL de las nebulosas: turbulencia + gravedad; Herschel ve filamentos por doquier).
Partículas lagrangianas (sin difusión) → nitidez = compresión gravitacional real.

Salida: x,y,z,bright float32. Uso: python3 scripts/selfgrav-nebula-sim.py [Ngrid] [Mpart] [steps] [out]
"""
import sys, numpy as np
from scipy.ndimage import map_coordinates

NG    = int(sys.argv[1]) if len(sys.argv) > 1 else 128
M     = int(sys.argv[2]) if len(sys.argv) > 2 else 3_000_000
STEPS = int(sys.argv[3]) if len(sys.argv) > 3 else 40
OUT   = sys.argv[4] if len(sys.argv) > 4 else "docs/pulsar-code/turb-nebula"
rng = np.random.default_rng(11)
L = 1.0

# ── cara-i: malla de ondas (compartida por gravedad y turbulencia) ──────
k1 = np.fft.fftfreq(NG, d=2*L/NG) * 2*np.pi
KX, KY, KZ = np.meshgrid(k1, k1, k1, indexing='ij')
K2 = KX**2 + KY**2 + KZ**2; K2[0,0,0] = 1.0
Kmag = np.sqrt(K2)

# campo turbulento incompresible (forzamiento), pequeña/mediana escala
def cfield(amp):
    return (rng.standard_normal((NG,NG,NG)) + 1j*rng.standard_normal((NG,NG,NG))) * amp
amp = (Kmag+1e-6)**(-11.0/6.0); amp[Kmag>NG/3.0]=0.0; amp[Kmag<2.5]=0.0
vx, vy, vz = cfield(amp), cfield(amp), cfield(amp)
kdv = (KX*vx+KY*vy+KZ*vz)/K2; vx-=KX*kdv; vy-=KY*kdv; vz-=KZ*kdv
Tx = np.fft.ifftn(vx).real; Ty = np.fft.ifftn(vy).real; Tz = np.fft.ifftn(vz).real
rmsT = np.sqrt((Tx**2+Ty**2+Tz**2).mean())+1e-9; Tx/=rmsT; Ty/=rmsT; Tz/=rmsT
print(f"[sg] incompresibilidad turb max|∇·v| = {np.abs(np.fft.ifftn(1j*(KX*np.fft.fftn(Tx)+KY*np.fft.fftn(Ty)+KZ*np.fft.fftn(Tz))).real).max():.2e}")

# ── AUTO-GRAVEDAD por Particle-Mesh (la CARA-I de la gravedad) ──────────
def gravity(pos):
    cc = (pos + L)/(2*L) * NG
    ci = np.clip(cc.astype(int), 0, NG-1)
    rho = np.zeros((NG, NG, NG), np.float64)
    np.add.at(rho, (ci[:,0], ci[:,1], ci[:,2]), 1.0)
    rho = rho - rho.mean()                          # Poisson periódico → quitar modo medio
    rhok = np.fft.fftn(rho)
    psik = -rhok / K2; psik[0,0,0] = 0.0            # ψ_k = −ρ_k/k²  (DIAGONAL; 4πG en GG)
    Fx = np.fft.ifftn(-1j*KX*psik).real             # F = −∇ψ → F_k = −i k ψ_k
    Fy = np.fft.ifftn(-1j*KY*psik).real
    Fz = np.fft.ifftn(-1j*KZ*psik).real
    cct = cc.T
    return (map_coordinates(Fx, cct, order=1, mode='wrap'),
            map_coordinates(Fy, cct, order=1, mode='wrap'),
            map_coordinates(Fz, cct, order=1, mode='wrap'))
def samp(F, pos):
    return map_coordinates(F, ((pos+L)/(2*L)*NG).T, order=1, mode='wrap')

# ── estado: cascarón de eyecta + velocidad de expansión + kick turbulento ─
u = rng.uniform(-1,1,M); ph = rng.uniform(0,2*np.pi,M); s = np.sqrt(np.maximum(0,1-u*u))
dirs = np.stack([s*np.cos(ph), u, s*np.sin(ph)], 1)
r0 = 0.62 + 0.05*rng.standard_normal(M)
pos = dirs * r0[:, None]
vel = dirs * 0.28                                   # expansión base

dt = 0.025
GG   = 9.0      # fuerza de auto-gravedad (colapso/fragmentación)
ATB  = 0.9      # forzamiento turbulento
DAMP = 0.99

for step in range(STEPS):
    gx, gy, gz = gravity(pos)                        # auto-gravedad (cara-i)
    tx = samp(Tx, pos); ty = samp(Ty, pos); tz = samp(Tz, pos)
    acc = GG*np.stack([gx,gy,gz],1) + ATB*np.stack([tx,ty,tz],1)
    vel += acc*dt
    vel *= DAMP
    pos += vel*dt

# brillo = densidad local (compresión GRAVITACIONAL = nitidez)
nb = 150; mn = pos.min(0); span = (pos.max(0)-mn).max()+1e-6
idx = np.clip(((pos-mn)/span*nb).astype(int), 0, nb-1)
flat = (idx[:,0]*nb + idx[:,1])*nb + idx[:,2]
dens = np.bincount(flat, minlength=nb**3)[flat]
bright = np.clip(dens/(np.percentile(dens,99.3)+1e-9), 0, 1) ** 0.5

import os
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
arr = np.concatenate([pos.astype(np.float32), bright.astype(np.float32)[:,None]], 1)
arr.astype(np.float32).tofile(OUT + ".bin")
print(f"[sg] {M} part · {STEPS} pasos (AUTO-GRAVEDAD PM + turbulencia, cara-i) → {OUT}.bin ({arr.nbytes//1024//1024} MB)")

def project(p,b,W=600):
    img=np.zeros((W,W),np.float32); q=p[:,:2]; q=(q-q.min(0))/((q.max(0)-q.min(0)).max()+1e-9)
    ij=np.clip((q*(W-1)).astype(int),0,W-1); np.add.at(img,(W-1-ij[:,1],ij[:,0]),b)
    img=np.log1p(img); img/=img.max()+1e-9; return (np.clip(img,0,1)*255).astype(np.uint8)
try:
    from PIL import Image; Image.fromarray(project(pos,bright)).save(OUT+"_proj.png")
    print(f"[sg] proyección → {OUT}_proj.png")
except Exception as e: print(f"[sg] sin PIL ({e})")
