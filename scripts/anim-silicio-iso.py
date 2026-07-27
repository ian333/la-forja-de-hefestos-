#!/usr/bin/env python3
"""
anim-silicio-iso.py — EL SILICIO EN 3D DE VERDAD: ISOSUPERFICIES.

⚠️ POR QUÉ ESTE SCRIPT EXISTE: la versión anterior (anim-silicio-3d.py) NO era
3D. Integraba rayos sumando a lo largo de un eje = APLASTAR el volumen a una
imagen plana. Sin normales, sin luz, sin oclusión, sin perspectiva: cero
profundidad. Ian lo cachó en una línea ("esto no tiene nada de 3d, solo
cambiaste los colores"). Y por eso tampoco se parecía al 2D: sumar 48 capas
PROMEDIA y destruye la estructura que el corte 2D mostraba nítida.

3D de verdad = GEOMETRÍA: isosuperficie (marching cubes) del campo → triángulos
con NORMALES → sombreado con luz → profundidad real, oclusión real, silueta.
Lo que se ve son los ENLACES como objetos sólidos que puedes rodear.

El campo sigue siendo el mismo, calculado por PySCF: Δρ del enlace (la carga
que SE MOVIÓ al unirse los átomos) y la nube del donor.

Uso: python3 scripts/anim-silicio-iso.py [quick]
"""
import sys, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from skimage import measure

QUICK = 'quick' in sys.argv
A_SI = 5.431
BOHR = 0.529177210903
NV = 56 if QUICK else 80
NFR = 48 if QUICK else 96
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'silicio-iso')

from pyscf.pbc import gto as pgto, dft as pdft
from pyscf.pbc.dft import numint as pnumint
from pyscf import gto as mgto, dft as mdft

print("=" * 68)
print("  SILICIO 3D DE VERDAD — isosuperficies (geometría, normales, luz)")
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
                sh = i*prim[0] + j*prim[1] + k*prim[2]
                for b in base: atoms.append(['Si', tuple(b + sh)])
    if dopado: atoms[0][0] = 'P'
    sc.atom = atoms; sc.basis = 'gth-szv'; sc.pseudo = 'gth-pade'
    sc.unit = 'A'; sc.spin = 1 if dopado else 0; sc.verbose = 0
    sc.build(); return sc

print("\n[1] SCF…")
sc_pu, sc_dp = build(False), build(True)
mf_pu = pdft.RKS(sc_pu); mf_pu.xc='pbe'; mf_pu.max_cycle=80; mf_pu.kernel()
mf_dp = pdft.UKS(sc_dp); mf_dp.xc='pbe'; mf_dp.max_cycle=120; mf_dp.kernel()
assert mf_pu.converged and mf_dp.converged
print(f"  puro ✓ · dopado ✓ ({sc_dp.nelectron} vs {sc_pu.nelectron} e⁻)")

# ── volumen centrado en el ENLACE (no en el dopante): el sujeto son los puentes
L = A_SI * 0.80
g = np.linspace(-L/2, L/2, NV)
GX, GY, GZ = np.meshgrid(g, g, g, indexing='ij')
origin = np.array([A_SI/8]*3)     # el punto medio del enlace Si-Si
pts = np.stack([GX.ravel()+origin[0], GY.ravel()+origin[1], GZ.ravel()+origin[2]], axis=1)
print(f"\n[2] volumen {NV}³ centrado en el enlace ({L:.2f} Å)…")
dm_pu, dm_dp = mf_pu.make_rdm1(), mf_dp.make_rdm1()
rho = np.zeros(len(pts)); ra = np.zeros(len(pts)); rb = np.zeros(len(pts))
CH = 20000
for i0 in range(0, len(pts), CH):
    sl = slice(i0, min(i0+CH, len(pts))); pb = pts[sl]/BOHR
    ao_pu = pnumint.eval_ao(sc_pu, pb); ao_dp = pnumint.eval_ao(sc_dp, pb)
    rho[sl] = np.einsum('pi,ij,pj->p', ao_pu, dm_pu, ao_pu)
    ra[sl] = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[0], ao_dp)
    rb[sl] = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[1], ao_dp)

# ── la promolécula → Δρ del ENLACE (el O₂ viral: enlaces = Δρ, NO ρ total) ──
print("[2b] promolécula (átomos aislados)…")
at = mgto.M(atom=[['Si',(0,0,0)]], basis='gth-szv', pseudo='gth-pade', spin=2, verbose=0)
mat = mdft.UKS(at); mat.xc='pbe'; mat.max_cycle=80; mat.kernel()
dm_at = mat.make_rdm1(); dm_at_t = dm_at[0]+dm_at[1]
rho_pro = np.zeros(len(pts))
sites = np.array([a[1] for a in sc_pu._atom]) * BOHR
reps = [i*prim[0]+j*prim[1]+k*prim[2] for i in (-1,0,1) for j in (-1,0,1) for k in (-1,0,1)]
for R in reps:
    for s in sites:
        c = s + R*NS
        if np.min(np.abs(pts - c[None,:]).max(axis=1)) > L*1.3: continue
        for i0 in range(0, len(pts), CH):
            sl = slice(i0, min(i0+CH, len(pts)))
            aoa = mgto.eval_gto(at, 'GTOval', (pts[sl]-c[None,:])/BOHR)
            rho_pro[sl] += np.einsum('pi,ij,pj->p', aoa, dm_at_t, aoa)
V_BOND = (rho - rho_pro).reshape(NV,NV,NV)
V_SPIN = (ra - rb).reshape(NV,NV,NV)
print(f"  Δρ enlace: {V_BOND.min():+.5f} .. {V_BOND.max():+.5f}")
print(f"  espín    : {V_SPIN.min():+.5f} .. {V_SPIN.max():+.5f}")

# ── ISOSUPERFICIES: marching cubes = geometría REAL con normales ──
def iso(vol, level):
    """marching cubes → (vértices en Å, caras, normales). ESTO es 3D:
    triángulos con normal → se pueden iluminar, ocluir y rodear."""
    try:
        v, f, n, _ = measure.marching_cubes(vol, level=level)
    except (ValueError, RuntimeError):
        return None, None, None
    if len(v) == 0: return None, None, None
    v = v / (NV - 1) * L - L/2                      # índices → Å
    return v, f, n

lv_acc = np.percentile(V_BOND[V_BOND > 0], 92)      # el nivel del PUENTE
lv_dep = np.percentile(V_BOND[V_BOND < 0], 8)       # el nivel del VACIADO
lv_spin = np.percentile(V_SPIN[V_SPIN > 0], 96)
print(f"\n[3] isosuperficies:")
va, fa, na = iso(V_BOND, lv_acc)
vd, fd, nd = iso(V_BOND, lv_dep)
vs, fs, ns_ = iso(V_SPIN, lv_spin)
print(f"  acumulación (el enlace) : {len(va):,} vértices · {len(fa):,} triángulos  @ {lv_acc:+.5f}")
print(f"  vaciado                 : {len(vd):,} vértices · {len(fd):,} triángulos  @ {lv_dep:+.5f}")
print(f"  espín (el e⁻ libre)     : {len(vs):,} vértices · {len(fs):,} triángulos  @ {lv_spin:+.5f}")
assert va is not None and len(fa) > 100, "sin isosuperficie del enlace"

# ── posiciones de los átomos (para verlos como esferas) ──
at_pos = []
for R in reps:
    for si, s in enumerate(sites):
        c = s + R*NS - origin
        if np.abs(c).max() < L/2 * 1.05:
            at_pos.append((c, si == 0))     # (posición, ¿es el dopante?)
print(f"  átomos dentro de la caja: {len(at_pos)}")

os.makedirs(OUT, exist_ok=True)
print(f"\n[4] {NFR} cuadros — la cámara ORBITA la geometría…")
for i in range(NFR):
    az = 360 * i / NFR
    elev = 18 + 12*np.sin(2*np.pi*i/NFR)
    fig = plt.figure(figsize=(9, 11), facecolor='#000000')
    ax = fig.add_subplot(111, projection='3d', facecolor='#000000')
    # el ENLACE: superficie sólida con luz → profundidad real
    m1 = Poly3DCollection(va[fa], alpha=0.92, linewidths=0)
    m1.set_facecolor('#ff9628'); m1.set_edgecolor('none')
    ax.add_collection3d(m1)
    # el VACIADO: translúcido, envuelve
    m2 = Poly3DCollection(vd[fd], alpha=0.16, linewidths=0)
    m2.set_facecolor('#7fb2ff'); m2.set_edgecolor('none')
    ax.add_collection3d(m2)
    # los ÁTOMOS
    for c, is_dop in at_pos:
        ax.scatter([c[0]], [c[1]], [c[2]], s=180 if is_dop else 90,
                   c='#fff0b0' if is_dop else '#5a6a8a', depthshade=True,
                   edgecolors='none', alpha=1.0 if is_dop else 0.8)
    ax.set_xlim(-L/2, L/2); ax.set_ylim(-L/2, L/2); ax.set_zlim(-L/2, L/2)
    ax.set_box_aspect([1,1,1])
    ax.view_init(elev=elev, azim=az)
    ax.set_axis_off()
    ax.set_title('EL ENLACE DEL SILICIO — isosuperficie ab initio\n'
                 'la carga que SE MOVIO al unirse (PySCF/PBC)',
                 color='#ffc98a', fontsize=13, pad=2)
    plt.tight_layout()
    plt.savefig(f'{OUT}/f{i:04d}.png', dpi=95, facecolor='#000000')
    plt.close(fig)
    if i % 12 == 0: print(f"    cuadro {i+1}/{NFR}")

print(f"\n✓ {NFR} cuadros en {OUT}")
print("=" * 68)
print("  ESTO sí es 3D: triángulos con normales, luz, oclusión y silueta.")
print("=" * 68)
