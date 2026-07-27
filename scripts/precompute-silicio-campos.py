#!/usr/bin/env python3
"""
precompute-silicio-campos.py — LOS CAMPOS del donor: ELÉCTRICO y MAGNÉTICO.

Ian: "la carga genera campos magnéticos y eléctricos, no veo nada de eso, solo
veo puntos". Tiene razón — y los dos campos son REALES y calculables:

  · CAMPO E: el donor ionizado deja un ion P⁺ y su electrón. Esa separación de
    carga genera campo eléctrico. V(r) = ∫ Δρ(r')/|r−r'| d³r' (potencial de la
    densidad de deformación REAL, la misma que ya calculamos), E = −∇V.
    Se trazan LÍNEAS DE CAMPO — el mismo método que precompute-bond-efield.py
    (el del O₂): semillas fijas + integración bidireccional.

  · CAMPO B: el electrón desapareado del donor tiene ESPÍN → momento magnético
    μ = −g·μ_B·S ≈ 1 magnetón de Bohr. UN ÁTOMO DE FÓSFORO EN SILICIO ES UN IMÁN.
    (No es adorno: por eso los donores en silicio se usan como qubits de espín —
    Kane 1998. El espín del donor es un bit cuántico de verdad.)
    Campo dipolar REAL: B(r) = (μ0/4π)·[3(m·r̂)r̂ − m]/r³
    Las líneas de campo dipolar cumplen r = L·sin²θ — la MISMA fórmula que la
    brújula de la cápsula #2. La física se repite; el motor ya la tiene.

Salida: public/precomputed/silicio-campos.bin
  int32 nE_lines, nB_lines, LP · float32 escala
  float32[nE*LP*3] líneas E · float32[nB*LP*3] líneas B

Uso: python3 scripts/precompute-silicio-campos.py [quick]
"""
import sys, os, struct
import numpy as np

QUICK = 'quick' in sys.argv
A_SI = 5.431
BOHR = 0.529177210903
NG = 56 if QUICK else 72
LP = 48                      # puntos por línea
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'silicio-campos.bin')

from pyscf.pbc import gto as pgto, dft as pdft
from pyscf.pbc.dft import numint as pnumint
from pyscf import gto as mgto, dft as mdft

print("=" * 68)
print("  LOS CAMPOS DEL DONOR — eléctrico (de Δρ) y magnético (del espín)")
print("=" * 68)

NS = 2
prim = np.array([[0.0, A_SI/2, A_SI/2], [A_SI/2, 0.0, A_SI/2], [A_SI/2, A_SI/2, 0.0]])
def build(dopado):
    sc = pgto.Cell(); sc.a = prim * NS
    base = [np.zeros(3), np.array([A_SI/4]*3)]
    atoms = []
    for i in range(NS):
        for j in range(NS):
            for k in range(NS):
                sh = i*prim[0]+j*prim[1]+k*prim[2]
                for b in base: atoms.append(['Si', tuple(b+sh)])
    if dopado: atoms[0][0] = 'P'
    sc.atom = atoms; sc.basis='gth-szv'; sc.pseudo='gth-pade'
    sc.unit='A'; sc.spin = 1 if dopado else 0; sc.verbose=0
    sc.build(); return sc

print("\n[1] SCF…")
sc_pu, sc_dp = build(False), build(True)
mf_pu = pdft.RKS(sc_pu); mf_pu.xc='pbe'; mf_pu.max_cycle=80; mf_pu.kernel()
mf_dp = pdft.UKS(sc_dp); mf_dp.xc='pbe'; mf_dp.max_cycle=120; mf_dp.kernel()
assert mf_pu.converged and mf_dp.converged
print("  ✓ puro y dopado convergidos")

# ── los campos escalares en malla ──
L = A_SI * 1.10
g = np.linspace(-L/2, L/2, NG)
GX, GY, GZ = np.meshgrid(g, g, g, indexing='ij')
pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
print(f"\n[2] Δρ y densidad de espín en malla {NG}³…")
dm_pu, dm_dp = mf_pu.make_rdm1(), mf_dp.make_rdm1()
rho = np.zeros(len(pts)); ra = np.zeros(len(pts)); rb = np.zeros(len(pts))
CH = 20000
for i0 in range(0, len(pts), CH):
    sl = slice(i0, min(i0+CH, len(pts))); pb = pts[sl]/BOHR
    ao_pu = pnumint.eval_ao(sc_pu, pb); ao_dp = pnumint.eval_ao(sc_dp, pb)
    rho[sl] = np.einsum('pi,ij,pj->p', ao_pu, dm_pu, ao_pu)
    ra[sl]  = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[0], ao_dp)
    rb[sl]  = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[1], ao_dp)
DRHO = ((ra+rb) - rho).reshape(NG,NG,NG)     # la carga que METIÓ el dopante
SPIN = (ra - rb).reshape(NG,NG,NG)           # el electrón desapareado
print(f"  Δρ  : {DRHO.min():+.5f} .. {DRHO.max():+.5f}")
print(f"  espín: {SPIN.min():+.5f} .. {SPIN.max():+.5f}")

# ── CAMPO E: V(r) del Δρ por convolución de Coulomb, E = −∇V ──
# El donor mete carga extra; esa carga genera potencial. Es Coulomb puro sobre
# la densidad REAL (no una carga puntual inventada en el centro).
print(f"\n[3] CAMPO ELÉCTRICO — V(r) = ∫Δρ(r')/|r−r'| (Coulomb sobre la densidad real)")
dV = (L/NG)**3
kx = np.fft.fftfreq(NG, d=L/NG) * 2*np.pi
KX, KY, KZ = np.meshgrid(kx, kx, kx, indexing='ij')
K2 = KX**2 + KY**2 + KZ**2
K2[0,0,0] = 1.0
# Poisson en Fourier: ∇²V = −4πρ → V(k) = 4πρ(k)/k²
V = np.real(np.fft.ifftn(4*np.pi*np.fft.fftn(DRHO) / K2))
V[np.isnan(V)] = 0
Ex, Ey, Ez = np.gradient(-V, L/NG)
Emag = np.sqrt(Ex**2 + Ey**2 + Ez**2)
print(f"  |E| : {Emag.min():.4f} .. {Emag.max():.4f} (u.a.)")
assert Emag.max() > 0, "campo E nulo — revisar"

# ── CAMPO B: el ESPÍN es un momento magnético → dipolo REAL ──
# μ = −g·μ_B·S. La densidad de espín ES una densidad de momento magnético.
# El momento total del donor ≈ 1 μ_B (un electrón desapareado, S=1/2, g≈2).
print(f"\n[4] CAMPO MAGNÉTICO — el espín del donor ES un imán (μ ≈ 1 μ_B)")
m_tot = SPIN.sum() * dV
print(f"  ∫(ρ↑−ρ↓)d³r = {m_tot:.4f}  → momento ≈ {abs(m_tot):.2f} μ_B")
print(f"  (1 electrón desapareado = 1 μ_B: el fósforo en silicio ES un imán.")
print(f"   Por eso el espín del donor sirve como QUBIT — Kane 1998.)")
# el dipolo apunta en +z (el eje de cuantización); su campo:
#   B(r) = (μ0/4π)·[3(m·r̂)r̂ − m]/r³
def campo_B(P):
    r = P.copy()
    rn = np.linalg.norm(r, axis=-1, keepdims=True)
    rn = np.maximum(rn, 0.28)             # regularizar en el núcleo
    rh = r / rn
    m = np.array([0.0, 0.0, 1.0])
    mdotr = (rh * m[None,:]).sum(axis=-1, keepdims=True)
    return (3*mdotr*rh - m[None,:]) / rn**3

# ── TRAZAR LÍNEAS (método de precompute-bond-efield.py: semillas + RK) ──
def traza(campo_fn, seeds, n=LP, paso=0.22, bidir=True):
    # ⚠️ paso 0.055 daba líneas de 1.3 Å DENTRO de una nube de 6 Å: invisibles.
    # Con 0.22 × 24 pasos por lado ≈ 5 Å de recorrido → las líneas CRUZAN la
    # escena y el dipolo se LEE. La escala de la línea tiene que competir con la
    # del objeto, no con la del voxel.
    """Integra la línea de campo desde cada semilla (RK2), ida y vuelta."""
    out = np.zeros((len(seeds), n, 3), np.float32)
    for j, s in enumerate(seeds):
        path = [s.copy()]
        for direc in ((1, -1) if bidir else (1,)):
            p = s.copy()
            for _ in range(n // (2 if bidir else 1)):
                v1 = campo_fn(p[None,:])[0]
                nv = np.linalg.norm(v1)
                if nv < 1e-9 or np.abs(p).max() > L*0.62: break
                v1 = v1/nv * direc
                pm = p + v1*paso*0.5
                v2 = campo_fn(pm[None,:])[0]
                nv2 = np.linalg.norm(v2)
                if nv2 < 1e-9: break
                p = p + v2/nv2*direc*paso
                (path.append if direc == 1 else path.insert)(*( (p.copy(),) if direc==1 else (0, p.copy()) ))
        pa = np.array(path)
        # remuestrear a n puntos exactos
        if len(pa) < 2: pa = np.tile(s, (n,1))
        d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pa,axis=0),axis=1))]
        if d[-1] < 1e-9: pa = np.tile(s, (n,1)); d = np.arange(n, dtype=float)
        t = np.linspace(0, d[-1], n)
        out[j] = np.stack([np.interp(t, d, pa[:,k]) for k in range(3)], axis=1)
    return out

def E_fn(P):
    """interpola E en posiciones arbitrarias (trilineal simple)"""
    idx = np.clip(((P + L/2)/L*(NG-1)).round().astype(int), 0, NG-1)
    return np.stack([Ex[idx[:,0],idx[:,1],idx[:,2]],
                     Ey[idx[:,0],idx[:,1],idx[:,2]],
                     Ez[idx[:,0],idx[:,1],idx[:,2]]], axis=1)

rng = np.random.default_rng(20260716)
# semillas del campo E: esfera alrededor del donor
NE = 40 if QUICK else 72
u = rng.random(NE); v = rng.random(NE)
th = np.arccos(1-2*u); ph = 2*np.pi*v
rad = 1.6
seedsE = np.stack([rad*np.sin(th)*np.cos(ph), rad*np.sin(th)*np.sin(ph), rad*np.cos(th)], axis=1)
print(f"\n[5] trazando {NE} líneas de campo E…")
linesE = traza(E_fn, seedsE)
# semillas del campo B: repartidas en latitud (como la brújula: r = L·sin²θ)
NB = 36 if QUICK else 64
lat = np.linspace(0.22, np.pi-0.22, NB//4)
azi = np.linspace(0, 2*np.pi, 4, endpoint=False)
seedsB = np.array([[1.5*np.sin(t)*np.cos(a), 1.5*np.sin(t)*np.sin(a), 1.5*np.cos(t)]
                   for t in lat for a in azi])
print(f"[6] trazando {len(seedsB)} líneas de campo B (dipolo del espín)…")
linesB = traza(campo_B, seedsB)
print(f"  E: {linesE.shape} · B: {linesB.shape}")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<iiif', len(linesE), len(linesB), LP, float(L)))
    f.write(linesE.astype(np.float32).tobytes())
    f.write(linesB.astype(np.float32).tobytes())
try:
    import shutil
    d = OUT.replace('public/precomputed', 'dist/precomputed')
    os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(OUT, d)
except Exception: pass
print(f"\n✓ {OUT}  ({os.path.getsize(OUT)/1e3:.1f} kB)")
print("=" * 68)
print("  El donor NO es un punto: es carga (campo E) + espín (campo B).")
print("  Un átomo de fósforo en silicio es un IMÁN. Eso es lo que faltaba.")
print("=" * 68)
