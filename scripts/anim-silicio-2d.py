#!/usr/bin/env python3
"""
anim-silicio-2d.py — ANIMACIÓN 2D de los campos REALES del silicio dopado.

Nada de esto se dibuja: son CORTES de los campos que PySCF calculó en 3D.
El plano de corte VIAJA a través del cristal → ves la estructura tridimensional
real revelándose capa por capa. Los enlaces nacen, forman el tetraedro y mueren
al cruzar el hueco. Eso no es un efecto: es cómo está hecho el silicio.

  Panel 1 — ρ(r) del cristal        : el enlace covalente (carga entre átomos)
  Panel 2 — Δρ = ρ(P) − ρ(Si)       : la nube del donor (el e⁻ que sobra)
  Panel 3 — densidad de espín        : el electrón desapareado, el que conduce

Salida: dist-video/silicio-2d/silicio-campos-2d.mp4 (+ frames)

Uso: python3 scripts/anim-silicio-2d.py [quick]
"""
import sys, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

QUICK = 'quick' in sys.argv
A_SI = 5.431
BOHR = 0.529177210903
NG = 70 if QUICK else 100          # resolución del plano
NFRAMES = 60 if QUICK else 120     # cortes a lo largo del viaje
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'silicio-2d')

from pyscf.pbc import gto as pgto, dft as pdft
from pyscf.pbc.dft import numint as pnumint

print("=" * 66)
print("  ANIMACIÓN 2D — los campos REALES del silicio (cortes de PySCF)")
print("=" * 66)

# ── la supercelda: 16 átomos, uno de ellos FÓSFORO ──
NS = 2
prim = np.array([[0.0, A_SI/2, A_SI/2],
                 [A_SI/2, 0.0, A_SI/2],
                 [A_SI/2, A_SI/2, 0.0]])
def build(dopado):
    sc = pgto.Cell()
    sc.a = prim * NS
    base = [np.zeros(3), np.array([A_SI/4]*3)]
    atoms = []
    for i in range(NS):
        for j in range(NS):
            for k in range(NS):
                sh = i*prim[0] + j*prim[1] + k*prim[2]
                for b in base:
                    atoms.append(['Si', tuple(b + sh)])
    if dopado:
        atoms[0][0] = 'P'
    sc.atom = atoms; sc.basis = 'gth-szv'; sc.pseudo = 'gth-pade'
    sc.unit = 'A'; sc.spin = 1 if dopado else 0; sc.verbose = 0
    sc.build()
    return sc

print(f"\n[1] SCF de la supercelda (16 át, Γ) — puro y dopado…")
sc_pu, sc_dp = build(False), build(True)
mf_pu = pdft.RKS(sc_pu); mf_pu.xc = 'pbe'; mf_pu.max_cycle = 80; e_pu = mf_pu.kernel()
mf_dp = pdft.UKS(sc_dp); mf_dp.xc = 'pbe'; mf_dp.max_cycle = 120; e_dp = mf_dp.kernel()
assert mf_pu.converged and mf_dp.converged, "SCF no convergió — no animar nada"
print(f"  puro   : {e_pu:.4f} Ha ✓")
print(f"  dopado : {e_dp:.4f} Ha ✓   (el P mete 1 e⁻ de más: {sc_dp.nelectron} vs {sc_pu.nelectron})")

# ── el plano que viaja: CONTIENE [111] y se desliza de lado ──
# ⚠️ El enlace Si-Si apunta a lo largo de [111]. Un plano PERPENDICULAR a [111]
# (mi 1ª versión) mira los enlaces DE PUNTA: se ve la red hexagonal, pero los
# puentes apuntan hacia la cámara y NO se ven. Para ver el enlace de PERFIL el
# plano tiene que CONTENER [111] — que es justo el plano (110), el clásico de
# los libros de estructura del diamante. El viaje va por la normal [11-2].
d1 = np.array([1.0, 1.0, 1.0]); d1 /= np.linalg.norm(d1)       # a lo largo del enlace
d2 = np.array([1.0, -1.0, 0.0]); d2 /= np.linalg.norm(d2)      # perpendicular en el plano
n_hat = np.cross(d1, d2)                                        # [11-2]: por aquí viaja
n_hat /= np.linalg.norm(n_hat)
span = A_SI * 1.45
u = np.linspace(-span/2, span/2, NG)
UU, VV = np.meshgrid(u, u, indexing='ij')

# el viaje: deslizarse por [11-2] a través de la celda → los puentes de enlace
# NACEN, se forman y MUEREN al pasar entre planos atómicos
travel = np.linspace(-A_SI*0.42, A_SI*0.42, NFRAMES)
dm_pu = mf_pu.make_rdm1()
dm_dp = mf_dp.make_rdm1()

print(f"\n[2] {NFRAMES} cortes a {NG}×{NG} en el plano (110) — el enlace DE PERFIL…")
rho_f, drho_f, spin_f = [], [], []
for i, s in enumerate(travel):
    origin = np.array([A_SI/8]*3) + s * n_hat
    pts = origin[None,:] + UU.ravel()[:,None]*d1[None,:] + VV.ravel()[:,None]*d2[None,:]
    pb = pts / BOHR
    ao_pu = pnumint.eval_ao(sc_pu, pb)
    ao_dp = pnumint.eval_ao(sc_dp, pb)
    r_pu = np.einsum('pi,ij,pj->p', ao_pu, dm_pu, ao_pu)
    r_a = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[0], ao_dp)
    r_b = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[1], ao_dp)
    rho_f.append(r_pu.reshape(NG,NG))
    drho_f.append(((r_a + r_b) - r_pu).reshape(NG,NG))
    spin_f.append((r_a - r_b).reshape(NG,NG))
    if i % 15 == 0: print(f"    corte {i+1}/{NFRAMES}  (s = {s:.2f} Å)")
rho_f, drho_f, spin_f = np.array(rho_f), np.array(drho_f), np.array(spin_f)
print(f"  ρ    : {rho_f.min():.5f} .. {rho_f.max():.5f} e/bohr³")
print(f"  Δρ   : {drho_f.min():+.5f} .. {drho_f.max():+.5f}")
print(f"  espín: {spin_f.min():+.5f} .. {spin_f.max():+.5f}")

# ── COLORMAPS CON EL CERO EN NEGRO ──
# La 1ª versión usó RdBu_r/PuOr_r: tienen BLANCO en el cero → sobre fondo blanco
# los paneles del donor y del espín salieron casi invisibles. Doctrina del
# proyecto (que yo mismo ignoré): FONDO NEGRO REAL, el color EMERGE.
# Firma de color por ROL FÍSICO: cálido = carga que se ACUMULA · frío = VACIADO.
from matplotlib.colors import LinearSegmentedColormap
CM_RHO = LinearSegmentedColormap.from_list('rho', [
    (0.00, '#000000'), (0.18, '#1a0630'), (0.38, '#7d1b4a'),
    (0.60, '#e0562a'), (0.80, '#ffb03a'), (1.00, '#fff4d0')])
# divergente sobre NEGRO: cian ← negro → oro
CM_DIV = LinearSegmentedColormap.from_list('div', [
    (0.00, '#7ce8ff'), (0.28, '#1c6a8c'), (0.50, '#000000'),
    (0.72, '#c8791a'), (1.00, '#ffe9a8')])
# espín: violeta ← negro → naranja (el e⁻ desapareado ARDE)
CM_SPIN = LinearSegmentedColormap.from_list('spin', [
    (0.00, '#9a7cff'), (0.30, '#3a2a70'), (0.50, '#000000'),
    (0.70, '#ff8a1e'), (1.00, '#fff0c0')])

# ── los frames ──
os.makedirs(OUT, exist_ok=True)
# escalas por PERCENTIL (no por el máximo): el máximo vive en un pico puntual y
# aplasta todo lo demás a negro. El percentil deja ver la ESTRUCTURA.
vr = np.percentile(rho_f, 99.5)
vd = np.percentile(np.abs(drho_f), 99.0)
vs = np.percentile(np.abs(spin_f), 99.2)
print(f"  escalas: rho≤{vr:.4f} · |drho|≤{vd:.5f} · |espin|≤{vs:.5f} (percentiles)")
ext = [-span/2, span/2, -span/2, span/2]
print(f"\n[3] escribiendo {NFRAMES} frames…")
for i in range(NFRAMES):
    fig, ax = plt.subplots(1, 3, figsize=(15, 5.6), facecolor='#050505')
    for a in ax:
        a.set_facecolor('#000'); a.set_xticks([]); a.set_yticks([])
        for sp in a.spines.values(): sp.set_color('#333')
    # LINEAL (gamma 1.0), no 0.55: la densidad de valencia con pseudopotenciales
    # es bastante plana (0.0007..0.075) y cualquier gamma<1 la quema toda a
    # blanco — se perdía justo el contraste del enlace, que es lo único que
    # importa aquí. En lineal: átomo≈0 (negro), enlace≈vmax (arde).
    ax[0].imshow(rho_f[i].T, origin='lower', cmap=CM_RHO, extent=ext,
                 vmin=0, vmax=vr, interpolation='bilinear')
    ax[0].set_title('EL ENLACE\nrho(r) — carga entre los atomos', color='#ffd9a0', fontsize=11, pad=10)
    ax[1].imshow(drho_f[i].T, origin='lower', cmap=CM_DIV, extent=ext,
                 vmin=-vd, vmax=vd, interpolation='bilinear')
    ax[1].set_title('LA NUBE DEL DONOR\nrho(P) - rho(Si) = el e- que sobra', color='#ffc07a', fontsize=11, pad=10)
    ax[2].imshow(spin_f[i].T, origin='lower', cmap=CM_SPIN, extent=ext,
                 vmin=-vs, vmax=vs, interpolation='bilinear')
    ax[2].set_title('EL ELECTRON LIBRE\ndensidad de espin — el que conduce', color='#ffc98a', fontsize=11, pad=10)
    fig.suptitle(f'SILICIO DOPADO — ab initio (PySCF/PBC, PBE)   ·   corte deslizando por [11-2] (plano 110): {travel[i]:.2f} A',
                 color='#dddddd', fontsize=12, y=0.045)
    plt.tight_layout(rect=[0, 0.06, 1, 1])
    plt.savefig(f'{OUT}/f{i:04d}.png', dpi=100, facecolor='#050505')
    plt.close(fig)
    if i % 20 == 0: print(f"    frame {i+1}/{NFRAMES}")

print(f"\n✓ {NFRAMES} frames en {OUT}")
print("=" * 66)
print("  Cada píxel es un campo que PySCF calculó. Cero dibujo.")
print("=" * 66)
