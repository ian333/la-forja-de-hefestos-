#!/usr/bin/env python3
"""
precompute-silicio-particulas.py — EL SILICIO DOPADO, EN PARTÍCULAS. (El motor.)

Copia EXACTA del pipeline del O₂ viral (`precompute-bond-abinitio.py`), aplicado
a un cristal. Ian lo dijo directo: "o2 y los demás átomos vienen con su código,
y si no estoy mal debes de precomputar los valores, ¿no?" — sí. Así funciona:

    PySCF calcula el campo  →  se MUESTREA en partículas  →  .bin
                                                          →  R3F dibuja (additive)

Nada de isosuperficies (mi desvío): la serie usa NUBES DE PARTÍCULAS muestreadas
del campo por inverse-CDF. Por eso se ven vivas.

LAS 3 NUBES (mismos roles y colores que el O₂ — la firma de la serie):
  · acumulación → ORO #ffb03a → ÁMBAR, corazón del enlace ORO BLANCO.
    Es Δρ>0 = la carga que SE MOVIÓ al puente entre átomos. ESO es el enlace.
  · vaciado     → AZUL PROFUNDO [0.18, 0.42, 0.95]. De dónde salió la carga.
    (El código del O₂ avisa: "el teal 0.55-verde daba tinte verdoso" — no tocar.)
  · espín       → VIOLETA [0.80, 0.34, 1.0]. En el O₂ son los 2 e⁻ π* que lo
    hacen imán; AQUÍ es EL ELECTRÓN DEL DOPANTE: el que sobra, el que conduce.
    En el Si puro esta nube estaría VACÍA (todo apareado). Existe por el fósforo.

Salida: public/precomputed/silicio-particulas.bin
  int32 N_acc, N_dep, N_spin · float32 escala(Å)
  uint8[N_acc*3] accColor · float32[N_acc*3] accPos · float32[N_dep*3] depPos
  float32[N_spin*3] spinPos

Uso: python3 scripts/precompute-silicio-particulas.py [quick]
"""
import sys, os, struct
import numpy as np

QUICK = 'quick' in sys.argv
A_SI = 5.431
BOHR = 0.529177210903
NG = 64 if QUICK else 88            # malla del campo
N_ACC  = 40000 if QUICK else 90000  # partículas por nube (el O₂ usa decenas de miles)
N_DEP  = 26000 if QUICK else 60000
N_SPIN = 20000 if QUICK else 46000
SEED = 20260716
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'silicio-particulas.bin')

from pyscf.pbc import gto as pgto, dft as pdft
from pyscf.pbc.dft import numint as pnumint
from pyscf import gto as mgto, dft as mdft

print("=" * 68)
print("  SILICIO DOPADO EN PARTÍCULAS — el pipeline del O₂ viral")
print("=" * 68)

# ── la supercelda: 16 átomos, uno es FÓSFORO ──
NS = 2
prim = np.array([[0.0, A_SI/2, A_SI/2], [A_SI/2, 0.0, A_SI/2], [A_SI/2, A_SI/2, 0.0]])
def build(dopado):
    sc = pgto.Cell(); sc.a = prim * NS
    base = [np.zeros(3), np.array([A_SI/4]*3)]
    atoms = []
    for i in range(NS):
        for j in range(NS):
            for k in range(NS):
                sh = i*prim[0] + j*prim[1] + k*prim[2]
                for b in base: atoms.append(['Si', tuple(b + sh)])
    if dopado: atoms[0][0] = 'P'
    sc.atom = atoms; sc.basis = 'gth-szv'; sc.pseudo = 'gth-pade'
    sc.unit = 'A'; sc.spin = 1 if dopado else 0; sc.verbose = 0
    sc.build(); return sc

print("\n[1] SCF (16 át, Γ) — puro y dopado…")
sc_pu, sc_dp = build(False), build(True)
mf_pu = pdft.RKS(sc_pu); mf_pu.xc='pbe'; mf_pu.max_cycle=80; e_pu = mf_pu.kernel()
mf_dp = pdft.UKS(sc_dp); mf_dp.xc='pbe'; mf_dp.max_cycle=120; e_dp = mf_dp.kernel()
assert mf_pu.converged and mf_dp.converged, "SCF no convergió — no escribir nada"
print(f"  puro {e_pu:.4f} Ha ✓ · dopado {e_dp:.4f} Ha ✓  ({sc_dp.nelectron} vs {sc_pu.nelectron} e⁻)")

# ── el campo en una malla (centrada en el DOPANTE, que está en el origen) ──
L = A_SI * 1.02
g = np.linspace(-L/2, L/2, NG)
GX, GY, GZ = np.meshgrid(g, g, g, indexing='ij')
pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
print(f"\n[2] campo en malla {NG}³ ({L:.2f} Å de lado, centrada en el dopante)…")
dm_pu, dm_dp = mf_pu.make_rdm1(), mf_dp.make_rdm1()
rho = np.zeros(len(pts)); ra = np.zeros(len(pts)); rb = np.zeros(len(pts))
CH = 20000
for i0 in range(0, len(pts), CH):
    sl = slice(i0, min(i0+CH, len(pts))); pb = pts[sl]/BOHR
    ao_pu = pnumint.eval_ao(sc_pu, pb); ao_dp = pnumint.eval_ao(sc_dp, pb)
    rho[sl] = np.einsum('pi,ij,pj->p', ao_pu, dm_pu, ao_pu)
    ra[sl]  = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[0], ao_dp)
    rb[sl]  = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[1], ao_dp)

# ── la PROMOLÉCULA → Δρ = el ENLACE (la lección del O₂: Δρ, no ρ total) ──
print("[2b] promolécula (átomos aislados superpuestos)…")
at = mgto.M(atom=[['Si',(0,0,0)]], basis='gth-szv', pseudo='gth-pade', spin=2, verbose=0)
mat = mdft.UKS(at); mat.xc='pbe'; mat.max_cycle=80; mat.kernel()
dm_at = mat.make_rdm1(); dm_at_t = dm_at[0] + dm_at[1]
rho_pro = np.zeros(len(pts))
sites = np.array([a[1] for a in sc_pu._atom]) * BOHR
reps = [i*prim[0]+j*prim[1]+k*prim[2] for i in (-1,0,1) for j in (-1,0,1) for k in (-1,0,1)]
for R in reps:
    for s in sites:
        c = s + R*NS
        if np.min(np.abs(pts - c[None,:]).max(axis=1)) > L*1.25: continue
        for i0 in range(0, len(pts), CH):
            sl = slice(i0, min(i0+CH, len(pts)))
            aoa = mgto.eval_gto(at, 'GTOval', (pts[sl]-c[None,:])/BOHR)
            rho_pro[sl] += np.einsum('pi,ij,pj->p', aoa, dm_at_t, aoa)

F_BOND = (rho - rho_pro).reshape(NG,NG,NG)     # Δρ del enlace
F_SPIN = (ra - rb).reshape(NG,NG,NG)           # el e⁻ del dopante
print(f"  Δρ enlace: {F_BOND.min():+.5f} .. {F_BOND.max():+.5f}")
print(f"  espín    : {F_SPIN.min():+.5f} .. {F_SPIN.max():+.5f}")
assert F_BOND.max() > 0 and F_SPIN.max() > 0, "campos vacíos — no escribir nada"

# ── MUESTREO por inverse-CDF 3D (el `sample_field` del O₂, semillas FIJAS) ──
def sample_field(field, U):
    """Muestrea M partículas ∝ field(x,y,z)≥0 por inverse-CDF encadenado:
    marginal en x → condicional y|x → condicional z|x,y. Semillas U FIJAS ⇒ la
    partícula j es la MISMA siempre (lagrangiana): así la carga FLUYE al
    interpolar, en vez de parpadear. Es el método exacto del O₂."""
    M = U.shape[0]; f = np.maximum(field, 0.0)
    slab = f.sum(axis=(1,2)); Cx = np.concatenate([[0.0], np.cumsum(slab)]); tot = Cx[-1]
    if tot <= 0: return np.zeros((M,3))
    tgt = U[:,0]*tot
    ix = np.clip(np.searchsorted(Cx, tgt, side='right')-1, 0, NG-1)
    x = -L/2 + (ix + (tgt-Cx[ix])/np.maximum(Cx[ix+1]-Cx[ix],1e-30)) * (L/NG)
    colmass = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((NG,1)), np.cumsum(colmass, axis=1)], axis=1)
    Cy_row = Cy[ix]; tgty = U[:,1]*Cy_row[:,-1]
    iy = np.clip((Cy_row[:,:-1] <= tgty[:,None]).sum(axis=1)-1, 0, NG-1)
    cy0 = Cy_row[np.arange(M), iy]; cy1 = Cy_row[np.arange(M), iy+1]
    y = -L/2 + (iy + (tgty-cy0)/np.maximum(cy1-cy0,1e-30)) * (L/NG)
    Cz = np.concatenate([np.zeros((NG,NG,1)), np.cumsum(f, axis=2)], axis=2)
    Cz_row = Cz[ix, iy]; tgtz = U[:,2]*Cz_row[:,-1]
    iz = np.clip((Cz_row[:,:-1] <= tgtz[:,None]).sum(axis=1)-1, 0, NG-1)
    cz0 = Cz_row[np.arange(M), iz]; cz1 = Cz_row[np.arange(M), iz+1]
    z = -L/2 + (iz + (tgtz-cz0)/np.maximum(cz1-cz0,1e-30)) * (L/NG)
    return np.stack([x,y,z], axis=1)

rng = np.random.default_rng(SEED)
print(f"\n[3] muestreo lagrangiano (inverse-CDF, semillas fijas)…")
accPos  = sample_field(F_BOND,  rng.random((N_ACC, 3)))     # Δρ>0: el enlace
depPos  = sample_field(-F_BOND, rng.random((N_DEP, 3)))     # Δρ<0: el vaciado
spinPos = sample_field(F_SPIN,  rng.random((N_SPIN, 3)))    # el e⁻ del dopante
print(f"  acumulación (el enlace) : {N_ACC:,} partículas")
print(f"  vaciado                 : {N_DEP:,}")
print(f"  espín (e⁻ del dopante)  : {N_SPIN:,}")

# ── COLOR: los MISMOS del O₂, asignados por ROL FÍSICO (no por gusto) ──
# En el O₂ el corazón σ (entre los núcleos) va ORO BLANCO y las colas ÁMBAR.
# Aquí el mismo criterio: la partícula que está en el PUENTE entre dos átomos
# (el corazón del enlace) arde en oro blanco; la que está lejos, ámbar.
gold      = np.array([1.00, 0.84, 0.36])
amber     = np.array([1.00, 0.36, 0.10])
whitegold = np.array([1.00, 0.96, 0.74])
# distancia de cada partícula al átomo más cercano de la celda
sitios = []
for R in reps:
    for s in sites:
        c = s + R*NS
        if np.abs(c).max() < L*0.9: sitios.append(c)
sitios = np.array(sitios)
d_at = np.linalg.norm(accPos[:,None,:] - sitios[None,:,:], axis=2).min(axis=1)
d_bond = A_SI*np.sqrt(3)/4                      # 2.3517 Å = el enlace
t = np.clip(d_at / (d_bond*0.5), 0, 1)          # 0 = pegado al átomo, 1 = en medio
col = gold[None,:]*(1-t[:,None]) + amber[None,:]*t[:,None]

# EL CORAZÓN = donde el campo es MÁS INTENSO, medido — no un radio que yo elija.
# 1er intento: `|d_at - d_bond/2| < d_bond*0.18` → 92% de las partículas salían
# oro blanco (obvio en retrospectiva: Δρ>0 VIVE en el puente, así que casi todas
# están a media distancia). Un blob blanco uniforme, cero gradiente. Ahora el
# color lo decide el VALOR del campo en cada partícula: el top 12% arde.
idx = np.clip(((accPos + L/2) / L * (NG-1)).round().astype(int), 0, NG-1)
f_at_p = F_BOND[idx[:,0], idx[:,1], idx[:,2]]
umbral = np.percentile(f_at_p, 88)
corazon = f_at_p >= umbral
col[corazon] = whitegold
accColor = np.clip(col*255, 0, 255).astype(np.uint8)
print(f"  color por ROL FÍSICO (el valor del campo manda):")
print(f"     corazón (top 12% de Δρ) = ORO BLANCO : {int(corazon.sum()):,} partículas")
print(f"     resto: lerp oro→ámbar por distancia al átomo (igual que el O₂)")

# ── escribir (float32: la geometría es chica y cabe) ──
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<iiif', N_ACC, N_DEP, N_SPIN, float(L)))
    f.write(accColor.tobytes())
    f.write(accPos.astype(np.float32).tobytes())
    f.write(depPos.astype(np.float32).tobytes())
    f.write(spinPos.astype(np.float32).tobytes())
# copiar a dist/ (el patrón del O₂: el render lo sirve de ahí)
try:
    import shutil
    d = OUT.replace('public/precomputed', 'dist/precomputed')
    os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copyfile(OUT, d)
    print(f"  + copia en dist/precomputed/")
except Exception: pass
print(f"\n✓ {OUT}  ({os.path.getsize(OUT)/1e6:.2f} MB)")
print("=" * 68)
print("  3 nubes muestreadas del campo REAL. Colores del O₂, por rol físico.")
print("  El render solo las DIBUJA — igual que la serie de enlaces.")
print("=" * 68)
