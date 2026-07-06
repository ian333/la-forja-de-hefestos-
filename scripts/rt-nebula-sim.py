#!/usr/bin/env python3
"""
rt-nebula-sim.py — NEBULOSA DE VIENTO DE PÚLSAR formada desde la FÍSICA (no noise()).

Simula la inestabilidad de RAYLEIGH-TAYLOR que esculpe los filamentos del Cangrejo:
el viento del púlsar (fluido LIGERO, presión desde el centro) empuja la eyecta de la
supernova (fluido PESADO) que se desacelera al barrer material. La desaceleración =
GRAVEDAD EFECTIVA → el pesado se hunde en DEDOS, el ligero sube en BURBUJAS. Donde la
materia se COMPRIME (paredes de los dedos) = filamento brillante y NÍTIDO.

Modelo (partículas, tratable, física real simplificada):
  · Cascarón de eyecta a R0, semilla turbulenta de densidad w_i (perturbación RT).
  · Radial: a = P_viento/w_i - g_efectiva  → RT (pesado se rezaga = spike, ligero = bubble).
  · Lateral: auto-atracción por gradiente de densidad angular (grid O(N)) → la materia
    se COLECTA en paredes coherentes = la RED lacy (no grano).
  · Amortiguamiento → las paredes se quedan finas (compresión = nitidez).
La estructura EMERGE; el ruido solo siembra. Salida: posiciones + brillo(densidad) para R3F.

Uso:  python3 scripts/rt-nebula-sim.py [N] [steps] [out_prefix]
Salida: <out>.bin (float32: x,y,z,bright por partícula) + <out>_proj.png (verificación).
"""
import sys, numpy as np

N      = int(sys.argv[1]) if len(sys.argv) > 1 else 350_000
STEPS  = int(sys.argv[2]) if len(sys.argv) > 2 else 150
OUT    = sys.argv[3] if len(sys.argv) > 3 else "docs/pulsar-code/rt-nebula"
rng = np.random.default_rng(7)

# ── direcciones uniformes en la esfera ──────────────────────────────────
u  = rng.uniform(-1, 1, N); ph = rng.uniform(0, 2*np.pi, N)
s  = np.sqrt(np.maximum(0.0, 1 - u*u))
dirs = np.stack([s*np.cos(ph), u, s*np.sin(ph)], 1)            # (N,3) unitario

# ── semilla turbulenta de densidad (banda limitada, suma de ondas planas) ─
def turb(p, n_waves=70, base_k=2.2, oct=4):
    v = np.zeros(len(p)); f = 1.0; a = 1.0
    for _ in range(oct):
        K   = rng.normal(0, 1, (n_waves, 3)) * base_k * f
        phs = rng.uniform(0, 2*np.pi, n_waves)
        v  += a * np.sin(p @ K.T + phs).sum(1)
        f *= 2.0; a *= 0.5
    return v
seed = turb(dirs)
seed = (seed - seed.mean()) / (seed.std() + 1e-9)
w = 1.0 + 0.20*np.tanh(seed)                                   # spread CHICO = RT gentil, cascarón delgado

# ── estado inicial: cascarón delgado a R0=1, EXPANSIÓN FUERTE (la supernova) ─
r0  = 1.0 + 0.03*rng.standard_normal(N)
pos = dirs * r0[:, None]
vel = dirs * 1.0                                               # expansión base fuerte → coasting (no colapso)

# ── grid angular para densidad lateral (mapa equirectangular) ───────────
GH, GW = 192, 384
def ang_density(p):
    d = p / (np.linalg.norm(p, axis=1, keepdims=True) + 1e-9)
    th = np.arccos(np.clip(d[:,1], -1, 1))                     # 0..pi
    az = np.arctan2(d[:,2], d[:,0]) + np.pi                    # 0..2pi
    iy = np.clip((th/np.pi*GH).astype(int), 0, GH-1)
    ix = np.clip((az/(2*np.pi)*GW).astype(int), 0, GW-1)
    grid = np.zeros((GH, GW), np.float32)
    np.add.at(grid, (iy, ix), w)                              # densidad ponderada
    # suavizado separable (caja x3)
    for _ in range(3):
        grid = (grid + np.roll(grid,1,0)+np.roll(grid,-1,0)+np.roll(grid,1,1)+np.roll(grid,-1,1))/5.0
    return grid, iy, ix

P_WIND = 0.9          # presión del viento del púlsar (empuje afuera)
# gravedad efectiva BALANCEADA al promedio → el cascarón COASTING (expande), y la
# variación de P/w_i es la perturbación RT (pesado se rezaga, ligero adelanta).
G_EFF  = P_WIND * float(np.mean(1.0 / w))
LAT    = 0.11         # colección lateral FUERTE → paredes coherentes = la RED lacy (no spikes)
DAMP   = 0.985        # amortiguamiento → paredes finas (compresión = nitidez)
RDAMP  = 0.055        # amortiguamiento EXTRA de la velocidad radial → cascarón DELGADO (no fuegos artificiales)
dt     = 0.02

for step in range(STEPS):
    r = np.linalg.norm(pos, axis=1, keepdims=True) + 1e-9
    rhat = pos / r
    # ── RADIAL: Rayleigh-Taylor (a depende del peso) ──
    a_rad = (P_WIND / w) - G_EFF                              # (N,)
    # ── LATERAL: colección hacia paredes densas (gradiente de densidad angular) ──
    grid, iy, ix = ang_density(pos)
    gy = (np.roll(grid,-1,0) - np.roll(grid,1,0))            # d/dtheta
    gx = (np.roll(grid,-1,1) - np.roll(grid,1,1))            # d/dphi
    # vectores tangentes (theta-hat, phi-hat) en cada partícula
    d  = rhat
    th = np.arccos(np.clip(d[:,1], -1, 1))
    sinth = np.sqrt(np.maximum(1e-4, 1 - d[:,1]**2))
    phi_hat = np.stack([-d[:,2], np.zeros(N), d[:,0]], 1) / sinth[:,None]
    th_hat  = np.stack([d[:,0]*d[:,1], -(sinth**2), d[:,2]*d[:,1]], 1) / sinth[:,None]
    f_lat = (gy[iy,ix][:,None]*th_hat + gx[iy,ix][:,None]*phi_hat) * LAT   # hacia + denso
    vel += rhat*a_rad[:,None]*dt + f_lat*dt
    vel *= DAMP
    # amortigua EXTRA la componente radial → el cascarón se queda delgado (la red lacy,
    # no dedos radiales largos): la materia se concentra en paredes tangenciales.
    vr = np.sum(vel*rhat, axis=1, keepdims=True)
    vel -= rhat * vr * RDAMP
    pos += vel*dt

# ── brillo = densidad local 3D (compresión = nitidez) ───────────────────
# voxelizar para densidad local
def local_density(p, nb=160):
    mn = p.min(0); mx = p.max(0); span = (mx-mn).max()+1e-6
    idx = np.clip(((p-mn)/span*nb).astype(int), 0, nb-1)
    flat = (idx[:,0]*nb + idx[:,1])*nb + idx[:,2]
    cnt = np.bincount(flat, weights=w, minlength=nb**3)
    return cnt[flat]
dens = local_density(pos)
bright = (dens / (np.percentile(dens, 99.5)+1e-9))
bright = np.clip(bright, 0, 1) ** 0.6

# ── salida binaria para R3F: x,y,z,bright (float32) ─────────────────────
import os
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
arr = np.concatenate([pos.astype(np.float32), bright.astype(np.float32)[:,None]], 1)
arr.astype(np.float32).tofile(OUT + ".bin")
print(f"[sim] {N} part · {STEPS} pasos → {OUT}.bin  ({arr.nbytes//1024//1024} MB)")

# ── verificación: proyección de densidad a PNG ──────────────────────────
def project(p, b, W=600, axis=(0,1)):
    img = np.zeros((W, W), np.float32)
    q = p[:, list(axis)]
    q = (q - q.min(0)) / ((q.max(0)-q.min(0)).max()+1e-9)
    ij = np.clip((q*(W-1)).astype(int), 0, W-1)
    np.add.at(img, (W-1-ij[:,1], ij[:,0]), b)
    img = np.log1p(img); img /= img.max()+1e-9
    return (np.clip(img,0,1)*255).astype(np.uint8)
try:
    from PIL import Image
    Image.fromarray(project(pos, bright)).save(OUT + "_proj.png")
    print(f"[sim] proyección → {OUT}_proj.png")
except Exception as e:
    np.save(OUT + "_proj.npy", project(pos, bright))
    print(f"[sim] sin PIL ({e}); guardé _proj.npy")
