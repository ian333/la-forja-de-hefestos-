#!/usr/bin/env python3
"""
bh-disk-sim.py — DISCO DE ACRECIÓN de agujero negro formado desde la FÍSICA, con el
mismo motor del púlsar (Operador Ian / cara-i + partículas lagrangianas).

Física del disco:
  · ROTACIÓN KEPLERIANA DIFERENCIAL: Ω(r) = √(GM/r³) ∝ r^−3/2. El interior gira MUCHO
    más rápido → CIZALLA que enrolla cualquier perturbación en ESPIRALES apretadas (así
    se ve la estructura de un disco real).
  · TURBULENCIA MRI (magnetorrotacional): campo de velocidad turbulento incompresible
    generado en la cara-i (Fourier, diagonal → barato), advecta las partículas → rompe
    los anillos lisos en grumos/filamentos espirales. La nitidez = compresión real.
  · INSPIRAL: la materia cae lento hacia adentro (acreción).
Salida: x,y,z,bright por partícula (disco en plano XZ, y=grosor). El render colorea por
radio (T∝r^−¾ Shakura-Sunyaev) + beaming Doppler. NO es noise: el FLUJO esculpe.

Uso: python3 scripts/bh-disk-sim.py [Mpart] [steps] [out]
"""
import sys, numpy as np
from scipy.ndimage import map_coordinates

M     = int(sys.argv[1]) if len(sys.argv) > 1 else 5_000_000
STEPS = int(sys.argv[2]) if len(sys.argv) > 2 else 60
OUT   = sys.argv[3] if len(sys.argv) > 3 else "docs/pulsar-code/bh-disk"
rng = np.random.default_rng(5)
NG, L = 128, 1.6

# ── cara-i: campo turbulento incompresible PEQUEÑA ESCALA (MRI) ─────────
k1 = np.fft.fftfreq(NG, d=2*L/NG) * 2*np.pi
KX, KY, KZ = np.meshgrid(k1, k1, k1, indexing='ij')
K2 = KX**2 + KY**2 + KZ**2; K2[0,0,0] = 1.0
Kmag = np.sqrt(K2)
def cfield(amp):
    return (rng.standard_normal((NG,NG,NG)) + 1j*rng.standard_normal((NG,NG,NG))) * amp
amp = (Kmag + 1e-6)**(-11.0/6.0); amp[Kmag > NG/3.0] = 0.0; amp[Kmag < 3.0] = 0.0  # solo pequeña escala
vx, vy, vz = cfield(amp), cfield(amp), cfield(amp)
kdv = (KX*vx + KY*vy + KZ*vz) / K2
vx -= KX*kdv; vy -= KY*kdv; vz -= KZ*kdv
Vx = np.fft.ifftn(vx).real; Vy = np.fft.ifftn(vy).real; Vz = np.fft.ifftn(vz).real
rms = np.sqrt((Vx**2+Vy**2+Vz**2).mean()) + 1e-9
Vx, Vy, Vz = Vx/rms, Vy/rms, Vz/rms
print(f"[bh] incompresibilidad max|∇·v| = {np.abs(np.fft.ifftn(1j*(KX*np.fft.fftn(Vx)+KY*np.fft.fftn(Vy)+KZ*np.fft.fftn(Vz))).real).max():.2e}")
def sample_v(px, py, pz):
    cc = [((px+L)/(2*L)*NG), ((py+L)/(2*L)*NG), ((pz+L)/(2*L)*NG)]
    return (map_coordinates(Vx, cc, order=1, mode='wrap'),
            map_coordinates(Vy, cc, order=1, mode='wrap'),
            map_coordinates(Vz, cc, order=1, mode='wrap'))

# ── partículas en ANILLO (área uniforme), disco delgado en plano XZ ─────
rIn, rOut = 0.30, 1.0
aa = rng.uniform(0, 1, M)
r  = np.sqrt(rIn**2 + aa*(rOut**2 - rIn**2))
phi = rng.uniform(0, 2*np.pi, M)
px = r*np.cos(phi); pz = r*np.sin(phi); py = 0.018*r*rng.standard_normal(M)   # grosor ∝ r

dt = 0.02
KWIND = 5.0     # cizalla Kepleriana (enrolla en espirales; menos = los brazos no se borran en anillos)
ATURB = 0.24    # turbulencia MRI FUERTE (clusteriza en filamentos/brazos, no dona lisa)
ACCR  = 0.018   # inspiral (acreción)

for step in range(STEPS):
    rr = np.sqrt(px*px + pz*pz) + 1e-6
    Om = rr**(-1.5)
    ang = Om * dt * KWIND
    c, s = np.cos(ang), np.sin(ang)
    px, pz = c*px - s*pz, s*px + c*pz                 # rotación diferencial → espirales
    vxp, vyp, vzp = sample_v(px, py, pz)
    px += ATURB*vxp*dt; py += ATURB*vyp*dt*0.4; pz += ATURB*vzp*dt
    f = (1.0 - ACCR*dt)
    px *= f; pz *= f; py *= 0.985                      # inspiral + se mantiene delgado

pos = np.stack([px, py, pz], 1)
# brillo = densidad local (compresión en brazos espirales = nitidez)
nb = 150
mn = pos.min(0); span = (pos.max(0)-mn).max()+1e-6
idx = np.clip(((pos-mn)/span*nb).astype(int), 0, nb-1)
flat = (idx[:,0]*nb + idx[:,1])*nb + idx[:,2]
cnt = np.bincount(flat, minlength=nb**3); dens = cnt[flat]
bright = np.clip(dens/(np.percentile(dens,99.0)+1e-9), 0, 1) ** 0.5

import os
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
arr = np.concatenate([pos.astype(np.float32), bright.astype(np.float32)[:,None]], 1)
arr.astype(np.float32).tofile(OUT + ".bin")
print(f"[bh] {M} part · {STEPS} pasos (Kepler + MRI cara-i) → {OUT}.bin ({arr.nbytes//1024//1024} MB)")

# verificación: proyección cara (plano XZ, vista de frente del disco)
def project(p, b, W=600, ax=(0,2)):
    img = np.zeros((W, W), np.float32)
    q = p[:, list(ax)]; q = (q-q.min(0))/((q.max(0)-q.min(0)).max()+1e-9)
    ij = np.clip((q*(W-1)).astype(int), 0, W-1)
    np.add.at(img, (W-1-ij[:,1], ij[:,0]), b)
    img = np.log1p(img); img /= img.max()+1e-9
    return (np.clip(img,0,1)*255).astype(np.uint8)
try:
    from PIL import Image
    Image.fromarray(project(pos, bright)).save(OUT + "_proj.png")
    print(f"[bh] proyección (cara) → {OUT}_proj.png")
except Exception as e:
    print(f"[bh] sin PIL ({e})")
