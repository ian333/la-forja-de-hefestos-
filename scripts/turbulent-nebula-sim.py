#!/usr/bin/env python3
"""
turbulent-nebula-sim.py — nebulosa de viento de púlsar por TURBULENCIA real, con el
truco del OPERADOR IAN (cara-i) para domar la exponencial, y PARTÍCULAS lagrangianas
para que los filamentos salgan NÍTIDOS (sin difusión numérica de malla).

Física:
  · Campo de velocidad turbulento INCOMPRESIBLE generado en la cara-i (Fourier): espectro
    de Kolmogorov + proyección divergence-free (k·v=0). El operador lineal es DIAGONAL ahí
    → O(N log N), exacto. (Antes creíamos "supercomputadora"; con la cara correcta: 4 s.)
  · Se advectan MILLONES de partículas por ese flujo (Lagrangiano = sin difusión). La
    turbulencia las ESTIRA y PLIEGA (caos lagrangiano) → filamentos finos CONECTADOS = la
    red lacy del Cangrejo. La nitidez = compresión real (partículas apiladas en los pliegues).
  · + flotabilidad Rayleigh-Taylor radial (lo pesado se hunde = dedos) + expansión del remanente.
NO es noise pintado: es el FLUJO el que esculpe; la forma EMERGE.

Salida: <out>.bin (float32 x,y,z,bright por partícula) + <out>_proj.png (verificación).
Uso: python3 scripts/turbulent-nebula-sim.py [Ngrid] [Mpart] [steps] [out]
"""
import sys, numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter

NG    = int(sys.argv[1]) if len(sys.argv) > 1 else 128          # malla del campo de velocidad
M     = int(sys.argv[2]) if len(sys.argv) > 2 else 900_000      # partículas
STEPS = int(sys.argv[3]) if len(sys.argv) > 3 else 38
OUT   = sys.argv[4] if len(sys.argv) > 4 else "docs/pulsar-code/turb-nebula"
rng = np.random.default_rng(11)
L = 1.0

# ── cara-i: campo de velocidad turbulento INCOMPRESIBLE (Kolmogorov, div-free) ──
k1 = np.fft.fftfreq(NG, d=2*L/NG) * 2*np.pi
KX, KY, KZ = np.meshgrid(k1, k1, k1, indexing='ij')
K2 = KX**2 + KY**2 + KZ**2; K2[0,0,0] = 1.0
Kmag = np.sqrt(K2)
def cfield(amp):
    return (rng.standard_normal((NG,NG,NG)) + 1j*rng.standard_normal((NG,NG,NG))) * amp
amp = (Kmag + 1e-6)**(-11.0/6.0); amp[Kmag > NG/3.0] = 0.0      # E(k)~k^-5/3 + dealias
amp[Kmag < 2.5] = 0.0    # quita modos de GRAN ESCALA → sin deriva en bloque (sin penacho);
                         # solo el plegado fino → nebulosa contenida y simétrica, filamentos finos
vx, vy, vz = cfield(amp), cfield(amp), cfield(amp)
kdv = (KX*vx + KY*vy + KZ*vz) / K2                              # proyección div-free
vx -= KX*kdv; vy -= KY*kdv; vz -= KZ*kdv
Vx = np.fft.ifftn(vx).real; Vy = np.fft.ifftn(vy).real; Vz = np.fft.ifftn(vz).real
rms = np.sqrt((Vx**2+Vy**2+Vz**2).mean()) + 1e-9
Vx, Vy, Vz = Vx/rms, Vy/rms, Vz/rms

# ── PRUEBAS (validación del método pseudoespectral / cara-i) ─────────────
# (1) Incompresibilidad: ∇·v debe ser ≈0 (proyección div-free correcta).
div = np.fft.ifftn(1j*(KX*np.fft.fftn(Vx)+KY*np.fft.fftn(Vy)+KZ*np.fft.fftn(Vz))).real
print(f"[prueba] incompresibilidad  max|∇·v|/rms(v) = {np.abs(div).max():.2e}  (debe ~0)")
# (2) Espectro de energía E(k): debe seguir Kolmogorov k^-5/3 en el rango inercial.
Ek = 0.5*(np.abs(np.fft.fftn(Vx))**2+np.abs(np.fft.fftn(Vy))**2+np.abs(np.fft.fftn(Vz))**2)
kbin = Kmag.astype(int).ravel(); Ef = Ek.ravel()
nbk = np.bincount(kbin, minlength=NG); Esum = np.bincount(kbin, weights=Ef, minlength=NG)
kk = np.arange(1, NG//3); Esh = (Esum[1:NG//3]/np.maximum(nbk[1:NG//3],1)) * (4*np.pi*kk**2)
m = (kk>3)&(kk<NG//4)
slope = np.polyfit(np.log(kk[m]), np.log(Esh[m]+1e-30), 1)[0]
print(f"[prueba] espectro E(k) ~ k^{slope:.2f}   (Kolmogorov teórico = -1.67)")

def sample_v(p):                                               # trilinear en posiciones
    c = ((p + L)/(2*L) * NG).T                                 # (3,M) en índices
    cc = [c[0], c[1], c[2]]
    return (map_coordinates(Vx, cc, order=1, mode='wrap'),
            map_coordinates(Vy, cc, order=1, mode='wrap'),
            map_coordinates(Vz, cc, order=1, mode='wrap'))

# ── partículas: CASCARÓN de eyecta + semilla de peso (RT) ───────────────
u  = rng.uniform(-1, 1, M); ph = rng.uniform(0, 2*np.pi, M)
s  = np.sqrt(np.maximum(0, 1-u*u))
dirs = np.stack([s*np.cos(ph), u, s*np.sin(ph)], 1)
r0 = 0.60 + 0.05*rng.standard_normal(M)
pos = dirs * r0[:, None]
# peso/densidad por partícula (semilla turbulenta) → RT
seedv = np.fft.ifftn(np.fft.fftn(rng.standard_normal((NG,NG,NG)))*(Kmag+1e-6)**-2.0).real
w = 1.0 + 0.4*np.tanh(2.0*map_coordinates(
        (seedv-seedv.mean())/(seedv.std()+1e-9),
        ((pos+L)/(2*L)*NG).T, order=1, mode='wrap'))

dt = 0.045
A_TURB = 1.1     # pliegue turbulento (estira → filamentos finos)  [v7]
A_RT   = 0.18    # flotabilidad RT radial (dedos, suave → no penacho denso)  [v7]
A_EXP  = 0.28    # expansión del remanente  [v7]

for step in range(STEPS):
    vxp, vyp, vzp = sample_v(pos)
    rn = np.linalg.norm(pos, axis=1, keepdims=True) + 1e-9
    rhat = pos / rn
    a_rad = (A_EXP - (w-1.0)*A_RT)[:, None]                    # expansión − (pesado se hunde)
    vel = A_TURB*np.stack([vxp, vyp, vzp], 1) + rhat*a_rad
    pos += vel*dt

# ── brillo = densidad local (compresión = nitidez) por histograma 3D ────  [v7]
nb = 150
mn = pos.min(0); span = (pos.max(0)-mn).max() + 1e-6
idx = np.clip(((pos-mn)/span*nb).astype(int), 0, nb-1)
flat = (idx[:,0]*nb + idx[:,1])*nb + idx[:,2]
cnt = np.bincount(flat, weights=w, minlength=nb**3)
dens = cnt[flat]
bright = np.clip(dens/(np.percentile(dens,99.5)+1e-9), 0, 1) ** 0.55   # [v7]

# ── VOLUMEN DE DENSIDAD 3D (EL GRIAL: densidad física → raymarcher con umbral nítido) ──
# Depósito CIC + suavizado mínimo → campo CONTINUO; la NITIDEZ la talla el raymarcher
# con un umbral duro (smoothstep) sobre este campo (iso-render) = hilos filosos REALES.
VG = 192
S  = np.abs(pos).max() * 1.03 + 1e-6
gc = (pos + S)/(2*S) * (VG-1)                       # coords en [0,VG-1]
gi = np.clip(gc.astype(int), 0, VG-1)
vol = np.zeros((VG,VG,VG), np.float32)
np.add.at(vol, (gi[:,0], gi[:,1], gi[:,2]), w)      # depósito ponderado (densidad)
vol = gaussian_filter(vol, 0.5)                     # suavizado MÍNIMO → la lámina queda DELGADA (hilos)
vol = vol / (np.percentile(vol, 99.4) + 1e-9)
vol = np.clip(vol, 0.0, 1.0) ** 0.80
(vol*255.0).astype(np.uint8).tofile(OUT + "-vol.bin")
print(f"[vol] densidad {VG}³ uint8 (S={S:.3f}) → {OUT}-vol.bin ({VG**3//1024//1024} MB)")

import os
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
arr = np.concatenate([pos.astype(np.float32), bright.astype(np.float32)[:,None]], 1)
arr.astype(np.float32).tofile(OUT + ".bin")
print(f"[turb] {M} part · grid {NG}³ · {STEPS} pasos (cara-i + advección lagrangiana) → {OUT}.bin ({arr.nbytes//1024//1024} MB)")

def project(p, b, W=600):
    img = np.zeros((W, W), np.float32)
    q = p[:, :2]; q = (q-q.min(0))/((q.max(0)-q.min(0)).max()+1e-9)
    ij = np.clip((q*(W-1)).astype(int), 0, W-1)
    np.add.at(img, (W-1-ij[:,1], ij[:,0]), b)
    img = np.log1p(img); img /= img.max()+1e-9
    return (np.clip(img,0,1)*255).astype(np.uint8)
try:
    from PIL import Image
    Image.fromarray(project(pos, bright)).save(OUT + "_proj.png")
    print(f"[turb] proyección → {OUT}_proj.png")
except Exception as e:
    print(f"[turb] sin PIL ({e})")
