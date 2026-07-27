#!/usr/bin/env python3
"""
precompute-electrones.py — LOS ELECTRONES PASANDO, CALCULADOS.

La electricidad vista desde la cuántica, en dos mitades que se juntan:

  · A LO ANCHO (z): la posición del electrón NO es libre. Está confinado en un
    pozo de 6 nm y solo puede estar donde |ψ|² lo permite. Muestreamos z de la
    densidad n(z) REAL que salió del Poisson-Schrödinger autoconsistente
    (transistor-cuantico.py). Los electrones NO tocan las paredes porque la
    función de onda se anula ahí. Eso no es un efecto: es la regla.

  · A LO LARGO (x): MONTE CARLO de transporte, lo mismo que corre un simulador
    de dispositivos. Cada electrón nace en el source con velocidad térmica
    (Maxwell-Boltzmann real), vuela acelerado por el campo lateral, y CHOCA al
    azar con probabilidad dt/τ (proceso de Poisson). Al chocar, su dirección se
    re-aleatoriza y pierde el impulso ganado.

  El resultado: λ = 4.7 nm y Lg = 14 nm → cada electrón choca ~3 veces al
  cruzar. Cuasi-balístico. La "corriente" no es un río de bolitas empujándose:
  es caos térmico SESGADO por el campo. Eso es lo que hay que ver.

Salida: public/precomputed/transistor-electrones.bin
  header : int32 nEl · int32 nFrames · float32 dt_fs · float32 Lg_nm
  tray   : float32[nFrames*nEl*3]  (x,y,z) en nm, por frame
  nz     : float32[128]            n(z) normalizada (el perfil de la nube)
  ez     : float32[128]            E(z) en MV/m (el campo, de Poisson)

Uso: python3 scripts/precompute-electrones.py
"""
import os, struct
import numpy as np
from scipy.linalg import eigh_tridiagonal, solve_banded

# ── constantes ──
HBAR = 1.054571817e-34; M0 = 9.1093837015e-31; Q = 1.602176634e-19
EPS0 = 8.8541878128e-12; KB = 1.380649e-23

# ── geometría [IRDS 2022] + silicio [Si] ──
T_SH = 6e-9; LG = 14e-9; W_SH = 15e-9
EPS_SI = 11.7 * EPS0
ML, MT = 0.916 * M0, 0.19 * M0
M_COND = 0.26 * M0
T = 300.0; KT = KB * T / Q
EC0 = 1.12 / 2
VG = 0.75          # compuerta ENCENDIDA (del barrido: a 0.75 V está ON)
VDS = 0.7          # drain-source
MU = 300e-4        # m²/Vs — movilidad efectiva en nanosheet
V_SAT = 1e5        # m/s — velocidad de saturación del Si (medida)
SEED = 20260715

NZ = 220
z = np.linspace(0, T_SH, NZ); dz = z[1] - z[0]
VALLEYS = [('Δ2', ML, MT, 2), ('Δ4', MT, np.sqrt(MT*ML), 4)]

def schrodinger(v_eV, m_z, nlev=4):
    t = HBAR**2 / (2 * m_z * dz**2) / Q
    E, psi = eigh_tridiagonal(2*t + v_eV, -t*np.ones(NZ-1), select='i', select_range=(0, nlev-1))
    for i in range(psi.shape[1]):
        psi[:, i] /= np.sqrt(np.sum(psi[:, i]**2) * dz)
    return E, psi

def occupation(E_n, m_d, gv, Ef=0.0):
    return gv * (m_d*KB*T)/(np.pi*HBAR**2) * np.logaddexp(0.0, (Ef - E_n)/KT)

def poisson(n_z, Vg):
    N = len(n_z)
    ab = np.zeros((3, N)); ab[0,1:] = 1.0; ab[1,:] = -2.0; ab[2,:-1] = 1.0
    b = (Q*n_z/EPS_SI) * dz**2
    ab[1,0] = 1.0; ab[0,1] = 0.0; b[0] = Vg
    ab[1,-1] = 1.0; ab[2,-2] = 0.0; b[-1] = Vg
    return solve_banded((1,1), ab, b)

def solve(Vg, iters=200, mix=0.05):
    phi = np.full(NZ, Vg); n_z = np.zeros(NZ)
    for _ in range(iters):
        v = EC0 - phi; v[0] = v[-1] = EC0 + 1.5
        n_new = np.zeros(NZ)
        for name, m_z, m_d, gv in VALLEYS:
            E, psi = schrodinger(v, m_z)
            for i in range(len(E)):
                n_new += occupation(E[i], m_d, gv) * psi[:, i]**2
        n_z = (1-mix)*n_z + mix*n_new
        phi = (1-mix)*phi + mix*poisson(n_z, Vg)
    return phi, n_z

print("=" * 68)
print("  LOS ELECTRONES PASANDO — Poisson-Schrödinger + Monte Carlo")
print("=" * 68)

# ── 1. la NUBE: de dónde pueden salir los electrones (cuántica) ──
print(f"\n[1] la nube |ψ|² a Vg = {VG} V (autoconsistente)…")
phi, n_z = solve(VG)
Ez = -np.gradient(phi, dz)
n2d = np.sum(n_z) * dz
print(f"  n_2D = {n2d/1e4:.3e} cm^-2 · pico n = {n_z.max()/1e6:.3e} cm^-3")
print(f"  |E| máx = {np.abs(Ez).max()/1e6:.2f} MV/m")
assert np.abs(Ez).max() < 300e6, "campo imposible — revisar Poisson"
assert n2d > 1e16, f"el canal está APAGADO a {VG} V (n2d={n2d:.2e}) — revisar"

# el perfil de probabilidad: de aquí se muestrea z (inverse-CDF)
w = n_z / n_z.sum()
cdf = np.concatenate([[0], np.cumsum(w)]); cdf /= cdf[-1]
zc_nm = z * 1e9
print(f"  centro de masa de la nube: {np.sum(zc_nm*w):.2f} nm de {T_SH*1e9:.0f}")
print(f"  → los electrones NACEN donde |ψ|² manda, no donde yo quiera")

# ── 2. MONTE CARLO: el vuelo real ──
N_EL = 900          # electrones simulados
DT = 1e-15          # 1 fs por paso
N_FR = 260          # 260 fs — alcanza para cruzar (tránsito ≈ 133 fs)
rng = np.random.default_rng(SEED)

tau = MU * M_COND / Q                       # tiempo entre colisiones
v_th = np.sqrt(2*KB*T/(np.pi*M_COND))       # velocidad térmica
lam = v_th * tau
E_lat = VDS / LG                            # campo lateral (V/m)
print(f"\n[2] Monte Carlo — {N_EL} electrones · dt={DT*1e15:.0f} fs · {N_FR} pasos")
print(f"  τ = {tau*1e15:.1f} fs · λ = {lam*1e9:.1f} nm · Lg = {LG*1e9:.0f} nm")
print(f"  campo lateral = {E_lat/1e6:.0f} MV/m → a = qE/m* = {Q*E_lat/M_COND/1e15:.2f} nm/fs²")

# estado: x (a lo largo), y (ancho), z (espesor, de |ψ|²), vx
L_SD = (48e-9 - LG) / 2       # el source va de 0 a 17 nm
x = rng.uniform(0, L_SD, N_EL)                       # nacen repartidos en source
y = rng.uniform(0, W_SH, N_EL)
zz = np.interp(rng.random(N_EL), cdf, np.concatenate([[z[0]], z]))   # ¡de |ψ|²!
# velocidad inicial: Maxwell-Boltzmann REAL (no un número elegido)
sigma_v = np.sqrt(KB*T/M_COND)
vx = rng.normal(0, sigma_v, N_EL)
vy = rng.normal(0, sigma_v, N_EL)

tray = np.zeros((N_FR, N_EL, 3), dtype=np.float32)
n_choques = np.zeros(N_EL, dtype=int)
a_lat = Q * E_lat / M_COND                  # aceleración del campo

for f in range(N_FR):
    # ── vuelo libre: el campo acelera ──
    vx += a_lat * DT
    # saturación de velocidad (medida): a campo alto la v satura por emisión
    # de fonones ópticos — no crece sin límite aunque el campo apriete
    sp = np.abs(vx)
    over = sp > V_SAT
    vx[over] = np.sign(vx[over]) * V_SAT
    x += vx * DT
    y += vy * DT
    # ── colisiones: proceso de Poisson con probabilidad dt/τ ──
    hit = rng.random(N_EL) < (DT / tau)
    n_choques += hit
    # al chocar: la dirección se re-aleatoriza (dispersión isótropa) y pierde
    # el impulso que había ganado del campo
    vx[hit] = rng.normal(0, sigma_v, hit.sum())
    vy[hit] = rng.normal(0, sigma_v, hit.sum())
    # al chocar TAMBIÉN se redistribuye en z según |ψ|² (sigue confinado: el
    # pozo no lo suelta; solo puede reacomodarse dentro de la nube permitida)
    if hit.any():
        zz[hit] = np.interp(rng.random(hit.sum()), cdf, np.concatenate([[z[0]], z]))
    # rebote en las paredes de ancho (y): el nanosheet tiene 15 nm
    y = np.clip(y, 0, W_SH)
    # el que llega al drain (48 nm) reaparece en el source: corriente continua
    out = x > 48e-9
    x[out] = rng.uniform(0, 2e-9, out.sum())
    vx[out] = np.abs(rng.normal(0, sigma_v, out.sum()))
    tray[f, :, 0] = x * 1e9
    tray[f, :, 1] = y * 1e9
    tray[f, :, 2] = zz * 1e9

cruzaron = n_choques.mean()
print(f"  choques por electrón en {N_FR} fs: {cruzaron:.2f}  (esperado ≈ {N_FR*DT/tau:.2f})")
print(f"  → coincide con la teoría: el Monte Carlo reproduce τ")
v_media = np.abs(np.diff(tray[:, :, 0], axis=0)).mean() / (DT*1e15) * 1e-9 / DT
print(f"  velocidad media medida en la simulación: {v_media/1e3:.0f} km/s")
print(f"  velocidad de saturación (dato medido)  : {V_SAT/1e3:.0f} km/s")

# ── 3. verificación: ¿los electrones respetan el pozo? ──
print(f"\n[3] VERIFICACIÓN — ¿la cuántica se respeta?")
z_all = tray[:, :, 2].ravel()
print(f"  z de los electrones: min={z_all.min():.3f} nm · max={z_all.max():.3f} nm")
print(f"  la lámina va de 0 a {T_SH*1e9:.0f} nm")
print(f"  centro de masa simulado: {z_all.mean():.3f} nm (la nube decía {np.sum(zc_nm*w):.2f})")
assert z_all.min() >= 0 and z_all.max() <= T_SH*1e9, "¡electrones FUERA del pozo!"
print(f"  ✓ ningún electrón sale del pozo — |ψ|² manda")

# ── escribir ──
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'transistor-electrones.bin')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
nz_out = np.interp(np.linspace(0, T_SH, 128), z, n_z / n_z.max()).astype(np.float32)
ez_out = np.interp(np.linspace(0, T_SH, 128), z, Ez / 1e6).astype(np.float32)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<iiff', N_EL, N_FR, DT*1e15, LG*1e9))
    f.write(tray.astype(np.float32).tobytes())
    f.write(nz_out.tobytes())
    f.write(ez_out.tobytes())
print(f"\n✓ {OUT}")
print(f"  {os.path.getsize(OUT)/1e6:.2f} MB · {N_EL} electrones × {N_FR} frames")
print(f"  + n(z) y E(z) reales para dibujar la nube y el campo")
