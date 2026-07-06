#!/usr/bin/env python3
"""
dna-field-sim.py — EL CAMPO ELÉCTRICO DEL ADN formado desde la FÍSICA, con el Operador Ian
(cara-i / Fourier). Igual que la nebulosa v7: las formas son la FUERZA, las partículas la dibujan.

Física REAL:
  · El ADN B-form tiene su esqueleto de FOSFATOS fuertemente NEGATIVO (−1 e por fosfato).
    Geometría exacta (src/lib/bio/dna.ts): r_fosfato=9.4 Å, twist=34.29°/bp, rise=3.40 Å/bp,
    offset de surco 155° (la asimetría surco mayor/menor = firma del B-DNA).
  · Su CAMPO ELÉCTRICO = Poisson ∇²φ = −ρ/ε, que es DIAGONAL en la cara-i (Fourier):
        φ_k = ρ_k / k²        (un cociente por modo; la MISMA cara que la gravedad PM)
        E   = −∇φ  →  E_k = −i k φ_k
    O(N log N), exacto. (Idéntico a selfgrav-nebula: gravedad y electrostática comparten cara.)
  · PARTÍCULAS lagrangianas: CONTRAIONES (+, Na⁺) advectados por +E → caen al esqueleto y se
    CONDENSAN sobre él (condensación de Manning, fenómeno REAL del ADN) + TRAZADORES que fluyen
    por las líneas de campo. La nitidez = la concentración real (condensación), no noise.

Caja periódica en z = nº ENTERO de vueltas (42 bp = 4 vueltas) → la periodicidad del FFT
coincide con la periodicidad helicoidal del ADN (correcto, no artefacto).

Salida: <out>.bin float32 [x,y,z,bright] (Å) + <out>_proj.png. Determinista.
Uso: python3 scripts/dna-field-sim.py [Mpart] [steps] [out]
"""
import sys, numpy as np
from scipy.ndimage import map_coordinates

M     = int(sys.argv[1]) if len(sys.argv) > 1 else 3_000_000
STEPS = int(sys.argv[2]) if len(sys.argv) > 2 else 36
OUT   = sys.argv[3] if len(sys.argv) > 3 else "docs/pulsar-code/dna-field"
rng = np.random.default_rng(7)

# ── geometría B-form (exacta, src/lib/bio/dna.ts) ───────────────────────
RISE   = 3.40
TWIST  = np.radians(34.29)
RP     = 9.4
OFFS   = np.radians(155.0)
NBP    = 42                       # 4 vueltas exactas (42/10.5) → z periódico
LZ     = NBP * RISE               # 142.8 Å (periódico)
LXY    = 76.0                     # caja transversal (DNA r=9.4 + volumen de campo)

# fosfatos: 2 por par de base (una hebra cada uno), carga −1
ii = np.arange(NBP)
th1 = ii * TWIST
P1 = np.stack([RP*np.cos(th1), RP*np.sin(th1), ii*RISE], 1)
P2 = np.stack([RP*np.cos(th1+OFFS), RP*np.sin(th1+OFFS), ii*RISE], 1)
charges = np.concatenate([P1, P2], 0)          # (2N,3)
q = -np.ones(len(charges))                     # −1 e por fosfato

# ── cara-i: malla de ondas (anisótropa: xy vs z) ────────────────────────
NGX = NGY = 96; NGZ = 192
kx = np.fft.fftfreq(NGX, d=LXY/NGX) * 2*np.pi
ky = np.fft.fftfreq(NGY, d=LXY/NGY) * 2*np.pi
kz = np.fft.fftfreq(NGZ, d=LZ /NGZ) * 2*np.pi
KX, KY, KZ = np.meshgrid(kx, ky, kz, indexing='ij')
K2 = KX**2 + KY**2 + KZ**2; K2[0,0,0] = 1.0

def to_grid(p):
    """posiciones físicas → índices de malla (x,y centrados en LXY; z periódico [0,LZ))."""
    gx = (p[:,0] + LXY/2) / LXY * NGX
    gy = (p[:,1] + LXY/2) / LXY * NGY
    gz = (p[:,2] % LZ)    / LZ  * NGZ
    return gx, gy, gz

# ── densidad de carga ρ + Poisson en la cara-i ──────────────────────────
gx, gy, gz = to_grid(charges)
rho = np.zeros((NGX, NGY, NGZ))
np.add.at(rho, (np.clip(gx.astype(int),0,NGX-1), np.clip(gy.astype(int),0,NGY-1), np.clip(gz.astype(int),0,NGZ-1)), q)
rho -= rho.mean()                              # fondo neutralizante (BC periódica)
rhok = np.fft.fftn(rho)
phik = rhok / K2; phik[0,0,0] = 0.0            # φ_k = ρ_k/k²  (DIAGONAL — la cara-i)
Ex = np.fft.ifftn(-1j*KX*phik).real            # E = −∇φ → E_k = −i k φ_k  (signo: φ de ρ/k²)
Ey = np.fft.ifftn(-1j*KY*phik).real
Ez = np.fft.ifftn(-1j*KZ*phik).real
# E apunta DESDE − HACIA +; los contraiones (+) sienten F=+qE... el esqueleto es −, así que
# el campo apunta HACIA el esqueleto; los + caen por +E. (φ aquí = −φ_físico, signos consistentes.)
divE = np.fft.ifftn(1j*(KX*np.fft.fftn(Ex)+KY*np.fft.fftn(Ey)+KZ*np.fft.fftn(Ez))).real
print(f"[dna] Gauss: max|∇·E − ρ| = {np.abs(divE - rho).max():.2e}  (debe ~0: el campo ES la carga)")

def sampleE(p):
    gx, gy, gz = to_grid(p)
    c = np.stack([gx, gy, gz], 0)
    return (map_coordinates(Ex, c, order=1, mode='wrap'),
            map_coordinates(Ey, c, order=1, mode='wrap'),
            map_coordinates(Ez, c, order=1, mode='wrap'))

# ── partículas: 3 poblaciones ──────────────────────────────────────────
#  (A) ESQUELETO: las dos hebras de fosfatos como hilos BRILLANTES (la hélice icónica)
#  (B) CONTRAIONES: + que CAEN al esqueleto y se condensan (Manning) — cerca, helicoidal
#  (C) TRAZADORES: fluyen por las líneas de campo → el "aura" eléctrica alrededor
NA = int(M*0.34); NB = int(M*0.36); NCt = M - NA - NB
# (A) esqueleto: repartir partículas sobre los fosfatos + dispersión gaussiana fina
pick = rng.integers(0, len(charges), NA)
back = charges[pick] + rng.normal(0, 1.1, (NA, 3))
back[:,2] %= LZ
# (B) contraiones: cáscara CERCANA (r 10–18 Å) donde el campo helicoidal aún se siente
rb = np.sqrt(rng.uniform(10**2, 18**2, NB)); ab = rng.uniform(0, 2*np.pi, NB)
ions = np.stack([rb*np.cos(ab), rb*np.sin(ab), rng.uniform(0, LZ, NB)], 1)
# (C) trazadores: aura amplia (r 10–40 Å)
rt = np.sqrt(rng.uniform(10**2, 40**2, NCt)); at = rng.uniform(0, 2*np.pi, NCt)
trac = np.stack([rt*np.cos(at), rt*np.sin(at), rng.uniform(0, LZ, NCt)], 1)
pos = np.concatenate([back, ions, trac], 0)
kind = np.concatenate([np.full(NA, 0), np.full(NB, 1), np.full(NCt, 2)])  # 0=esqueleto 1=ion 2=traza
move = kind > 0                                                            # el esqueleto NO se mueve

vel = np.zeros_like(pos)
dt = 0.05
AC = 42.0     # contraiones caen (condensación moderada, NO colapso a cilindro)
AT = 20.0     # trazadores fluyen el campo
DAMP = 0.84
for step in range(STEPS):
    ex, ey, ez = sampleE(pos)
    E = np.stack([ex, ey, ez], 1)
    amp = np.where(kind == 1, AC, AT)[:, None]
    acc = amp * E
    vel = (vel + acc*dt) * DAMP
    vel[~move] = 0.0
    pos += vel*dt
    pos[:,2] %= LZ

# brillo = densidad local (condensación = nitidez); el ESQUELETO realzado (la hélice)
nb = 160
mn = pos.min(0); span = (pos.max(0)-mn).max() + 1e-6
idx = np.clip(((pos-mn)/span*nb).astype(int), 0, nb-1)
flat = (idx[:,0]*nb + idx[:,1])*nb + idx[:,2]
dens = np.bincount(flat, minlength=nb**3)[flat]
bright = np.clip(dens/(np.percentile(dens, 99.4)+1e-9), 0, 1) ** 0.55
bright = np.where(kind == 0, np.maximum(bright, 0.85), bright)   # esqueleto SIEMPRE brillante

import os
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
arr = np.concatenate([pos.astype(np.float32), bright.astype(np.float32)[:,None]], 1)
arr.astype(np.float32).tofile(OUT + ".bin")
print(f"[dna] {M} part · {STEPS} pasos (campo eléctrico cara-i + condensación) → {OUT}.bin ({arr.nbytes//1024//1024} MB)")

def project(p, b, W=600):
    img = np.zeros((W, W), np.float32)
    q2 = p[:, [0, 2]]                                  # vista lateral (x,z) — se ve la hélice
    q2 = (q2 - q2.min(0)) / ((q2.max(0)-q2.min(0)).max()+1e-9)
    ij = np.clip((q2*(W-1)).astype(int), 0, W-1)
    np.add.at(img, (W-1-ij[:,1], ij[:,0]), b)
    img = np.log1p(img); img /= img.max()+1e-9
    return (np.clip(img,0,1)*255).astype(np.uint8)
try:
    from PIL import Image; Image.fromarray(project(pos, bright)).save(OUT+"_proj.png")
    print(f"[dna] proyección → {OUT}_proj.png")
except Exception as e:
    print(f"[dna] sin PIL ({e})")
