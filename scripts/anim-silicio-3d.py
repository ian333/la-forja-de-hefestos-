#!/usr/bin/env python3
"""
anim-silicio-3d.py — EL SILICIO DOPADO EN 3D. VOLUMEN REAL, GIRANDO.

Los campos de PySCF calculados en un VOLUMEN (no un plano) y renderizados por
integración a lo largo de rayos (emisión aditiva pura, el mismo modelo que usa
la serie de átomos). La cámara gira → ves la estructura tridimensional entera.

COLOR — según `docs/DOCTRINA-COLOR.md` y `docs/NEUROCIENCIA-DEL-GANCHO.md`
(la investigación, no mi gusto):

  · A4 FALSO COLOR: la densidad electrónica NO tiene color, igual que los rayos X.
    → se ETIQUETA "falso color" y se usa VOID OSCURO (crush de negros ≈0.14),
      que es lo que hacen NASA/Chandra por fidelidad.
  · "Caliente = blanco-azul PÁLIDO (#94b1ff), NUNCA cobalto": los picos revientan
    a BLANCO por luminancia, no a color saturado. (Mi 1ª paleta usaba cian
    #7ce8ff saturado: violaba esto.)
  · SATURACIÓN BAJA — el color es capa SECUNDARIA.
  · Ley 1 de la neurociencia: el canal rápido (magnocelular, 16-24 ms) es CIEGO
    AL COLOR y solo ve LUMINANCIA. "NO mandes más luz, más color, más
    información. Manda MÁS DIFERENCIA: un objeto brillante sobre negro puro.
    El negro no es vacío — es el telón que hace que el pico REVIENTE."
    → la rampa se diseña por LUMINANCIA (negro→blanco); el hue va encima.
  · Ley 3: VARIACIÓN cada 3-5 s contra la habituación → la cámara gira y el
    campo cambia de capa.

  Signo = ROL FÍSICO (firma de la serie, ya establecida en el O₂):
    CÁLIDO = carga que se ACUMULA · FRÍO = vaciado.

Uso: python3 scripts/anim-silicio-3d.py [quick]
"""
import sys, os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

QUICK = 'quick' in sys.argv
A_SI = 5.431
BOHR = 0.529177210903
NV = 48 if QUICK else 72          # lado del volumen (NV³ puntos)
NFR = 60 if QUICK else 120        # cuadros de la vuelta
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'silicio-3d')

from pyscf.pbc import gto as pgto, dft as pdft
from pyscf.pbc.dft import numint as pnumint
from scipy.ndimage import map_coordinates

print("=" * 68)
print("  SILICIO DOPADO EN 3D — volumen ab initio + color por DOCTRINA")
print("=" * 68)

NS = 2
prim = np.array([[0.0, A_SI/2, A_SI/2],
                 [A_SI/2, 0.0, A_SI/2],
                 [A_SI/2, A_SI/2, 0.0]])
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

print(f"\n[1] SCF (16 át, Γ)…")
sc_pu, sc_dp = build(False), build(True)
mf_pu = pdft.RKS(sc_pu); mf_pu.xc='pbe'; mf_pu.max_cycle=80; e_pu = mf_pu.kernel()
mf_dp = pdft.UKS(sc_dp); mf_dp.xc='pbe'; mf_dp.max_cycle=120; e_dp = mf_dp.kernel()
assert mf_pu.converged and mf_dp.converged, "SCF no convergió — no renderizar nada"
print(f"  puro {e_pu:.4f} Ha ✓ · dopado {e_dp:.4f} Ha ✓ ({sc_dp.nelectron} vs {sc_pu.nelectron} e⁻)")

# ── EL VOLUMEN: los campos en 3D ──
L = A_SI * 1.05                    # lado de la caja (Å) centrada en el dopante
g = np.linspace(-L/2, L/2, NV)
GX, GY, GZ = np.meshgrid(g, g, g, indexing='ij')
# CENTRAR EN EL DOPANTE (está en el sitio 0 = el origen de la red). Con el
# centro entre átomos (A_SI/8) la nube del donor se salía del cuadro por la
# periodicidad — se veía cortada arriba. El sujeto es el dopante: va al centro.
origin = np.array([0.0, 0.0, 0.0])
pts = np.stack([GX.ravel()+origin[0], GY.ravel()+origin[1], GZ.ravel()+origin[2]], axis=1)
print(f"\n[2] VOLUMEN {NV}³ = {NV**3:,} puntos ({L:.2f} Å de lado)…")
dm_pu, dm_dp = mf_pu.make_rdm1(), mf_dp.make_rdm1()
rho = np.zeros(len(pts)); rho_a = np.zeros(len(pts)); rho_b = np.zeros(len(pts))
CH = 20000
for i0 in range(0, len(pts), CH):
    sl = slice(i0, min(i0+CH, len(pts)))
    pb = pts[sl] / BOHR
    ao_pu = pnumint.eval_ao(sc_pu, pb)
    ao_dp = pnumint.eval_ao(sc_dp, pb)
    rho[sl]   = np.einsum('pi,ij,pj->p', ao_pu, dm_pu, ao_pu)
    rho_a[sl] = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[0], ao_dp)
    rho_b[sl] = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[1], ao_dp)
    if i0 % (CH*4) == 0: print(f"    {i0/len(pts)*100:.0f}%")
V_DRHO = ((rho_a + rho_b) - rho).reshape(NV,NV,NV)
V_SPIN = (rho_a - rho_b).reshape(NV,NV,NV)

# ── EL ENLACE = DENSIDAD DE DEFORMACIÓN, no ρ total ──
# ⚠️ ρ TOTAL integrada por rayos = BLOB NARANJA saturado: la carga llena TODO el
# espacio, así que sumar 48 voxels satura en todos lados. Lo dice la memoria del
# proyecto (el O₂ viral): "enlaces = campo Δρ REAL, no ρ total".
#   Δρ_enlace = ρ(cristal) − Σ ρ(átomos AISLADOS en los mismos sitios)
# Eso deja SOLO la carga que SE MOVIÓ al formarse el enlace: se acumula en el
# puente (cálido) y se vacía de los átomos (frío). Sobre negro. Ese es el enlace.
print(f"\n[2b] la PROMOLÉCULA (átomos aislados) para Δρ del enlace…")
from pyscf import gto as mgto, dft as mdft
at = mgto.M(atom=[['Si', (0, 0, 0)]], basis='gth-szv', pseudo='gth-pade',
            spin=2, verbose=0)     # Si aislado: 3s²3p², estado base ³P (Hund)
mat = mdft.UKS(at); mat.xc = 'pbe'; mat.max_cycle = 80; mat.kernel()
dm_at = mat.make_rdm1()
dm_at_tot = dm_at[0] + dm_at[1]
print(f"  Si aislado: {'convergido ✓' if mat.converged else '✗'} ({mat.e_tot:.4f} Ha)")

# superponer el átomo aislado en cada sitio de la red (incluidas las réplicas
# vecinas: el cristal es periódico y los átomos de al lado también aportan)
rho_pro = np.zeros(len(pts))
sites = np.array([a[1] for a in sc_pu._atom]) * BOHR   # sitios en Å
reps = [i*prim[0] + j*prim[1] + k*prim[2]
        for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)]
n_sit = 0
for R in reps:
    for s in sites:
        c = s + R * NS
        d = pts - c[None, :]
        if np.min(np.abs(d).max(axis=1)) > L * 1.2:   # muy lejos: no aporta
            continue
        n_sit += 1
        for i0 in range(0, len(pts), CH):
            sl = slice(i0, min(i0+CH, len(pts)))
            aoa = mgto.eval_gto(at, 'GTOval', (pts[sl] - c[None, :]) / BOHR)
            rho_pro[sl] += np.einsum('pi,ij,pj->p', aoa, dm_at_tot, aoa)
print(f"  {n_sit} átomos superpuestos (celda + réplicas vecinas)")
V_BOND = (rho - rho_pro).reshape(NV, NV, NV)     # ← EL ENLACE
V_RHO = rho.reshape(NV, NV, NV)
print(f"  ρ total   : {V_RHO.min():.5f} .. {V_RHO.max():.5f}  (el blob)")
print(f"  Δρ ENLACE : {V_BOND.min():+.5f} .. {V_BOND.max():+.5f}  ← la carga que SE MOVIÓ")
print(f"  Δρ donor  : {V_DRHO.min():+.5f} .. {V_DRHO.max():+.5f}")
print(f"  espín     : {V_SPIN.min():+.5f} .. {V_SPIN.max():+.5f}")
assert V_BOND.max() > 0, "sin acumulación en el enlace — revisar la promolécula"

# ── PALETA POR DOCTRINA (falso color etiquetado, luminancia primero) ──
# Rampa de LUMINANCIA (lo que ve el canal rápido) con hue encima. El pico NO se
# satura de color: revienta a BLANCO. Void = NEGRO PURO (crush 0.14).
CRUSH = 0.14
def crush(x):
    """Crush de negros ≈0.14 — lo que hacen NASA/Chandra por fidelidad al void."""
    return np.clip((x - CRUSH) / (1 - CRUSH), 0, 1)

def ramp_calido(t):
    """ACUMULACIÓN: negro → ámbar → blanco. Sat baja, revienta a blanco."""
    t = crush(np.clip(t, 0, 1))
    r = np.clip(t*2.3, 0, 1)
    gg = np.clip(t*1.55 - 0.20, 0, 1)
    b = np.clip(t*2.1 - 1.05, 0, 1)          # el azul entra AL FINAL → blanco
    return np.stack([r, gg, b], -1)

def ramp_frio(t):
    """VACIADO: negro → azul PÁLIDO #94b1ff → blanco. NUNCA cobalto (doctrina)."""
    t = crush(np.clip(t, 0, 1))
    r = np.clip(t*1.75 - 0.52, 0, 1)
    gg = np.clip(t*1.85 - 0.28, 0, 1)
    b = np.clip(t*2.25, 0, 1)
    return np.stack([r, gg, b], -1)

def proyecta(vol, ang, elev=0.42):
    """Integración a lo largo de rayos = emisión aditiva pura (modelo de la serie).
    Rota el volumen y suma por el eje de profundidad. Sin absorción: el mismo
    additive blending que usan los 118 átomos."""
    c, s = np.cos(ang), np.sin(ang)
    ce, se = np.cos(elev), np.sin(elev)
    # malla de salida
    n = NV
    ii, jj, kk = np.meshgrid(np.arange(n), np.arange(n), np.arange(n), indexing='ij')
    x = ii - (n-1)/2; y = jj - (n-1)/2; z = kk - (n-1)/2
    # rotar: yaw (ang) + pitch (elev)
    xr = c*x + s*z
    zr = -s*x + c*z
    yr = ce*y - se*zr
    zr2 = se*y + ce*zr
    coords = np.stack([xr + (n-1)/2, yr + (n-1)/2, zr2 + (n-1)/2])
    rot = map_coordinates(vol, coords, order=1, mode='grid-wrap')
    return rot.sum(axis=2)          # integrar por el eje de la cámara

os.makedirs(OUT, exist_ok=True)
print(f"\n[3] {NFR} cuadros — la cámara gira (Ley 3: variación vs habituación)…")
# escalas por percentil sobre una proyección de muestra
S_BD = np.percentile(np.abs(proyecta(np.abs(V_BOND), 0.0)), 99.4)
S_DR = np.percentile(np.abs(proyecta(np.abs(V_DRHO), 0.0)), 99.4)
S_SP = np.percentile(np.abs(proyecta(np.abs(V_SPIN), 0.0)), 99.4)

for i in range(NFR):
    ang = 2*np.pi * i / NFR
    el = 0.34 + 0.26*np.sin(2*np.pi*i/NFR)      # el pitch respira: variación
    pb_ = proyecta(V_BOND, ang, el) / S_BD      # EL ENLACE (deformación)
    pd = proyecta(V_DRHO, ang, el) / S_DR
    ps = proyecta(V_SPIN, ang, el) / S_SP
    # falso color por SIGNO = rol físico (cálido acumula · frío vacía)
    img_rho = np.where((pb_ > 0)[..., None], ramp_calido(np.abs(pb_)), ramp_frio(np.abs(pb_)))
    img_dr  = np.where((pd > 0)[..., None], ramp_calido(np.abs(pd)), ramp_frio(np.abs(pd)))
    img_sp  = np.where((ps > 0)[..., None], ramp_calido(np.abs(ps)), ramp_frio(np.abs(ps)))

    fig, ax = plt.subplots(1, 3, figsize=(15.4, 5.8), facecolor='#000000')
    for a in ax:
        a.set_facecolor('#000'); a.set_xticks([]); a.set_yticks([])
        for sp in a.spines.values(): sp.set_visible(False)
    ax[0].imshow(np.transpose(img_rho, (1,0,2)), origin='lower', interpolation='bilinear')
    ax[0].set_title('EL ENLACE\ncarga que SE MOVIO al unirse', color='#ffc98a', fontsize=11, pad=9)
    ax[1].imshow(np.transpose(img_dr, (1,0,2)), origin='lower', interpolation='bilinear')
    ax[1].set_title('LA NUBE DEL DONOR\nrho(P) - rho(Si) = el e- que sobra', color='#ffc98a', fontsize=11, pad=9)
    ax[2].imshow(np.transpose(img_sp, (1,0,2)), origin='lower', interpolation='bilinear')
    ax[2].set_title('EL ELECTRON LIBRE\ndensidad de espin — el que conduce', color='#ffc98a', fontsize=11, pad=9)
    fig.text(0.5, 0.028, 'SILICIO DOPADO — volumen ab initio (PySCF/PBC, PBE) · falso color '
             '(la densidad no tiene color, como los rayos X) · calido = se acumula, frio = se vacia',
             color='#8a8a8a', fontsize=8.5, ha='center')
    plt.tight_layout(rect=[0, 0.045, 1, 1])
    plt.savefig(f'{OUT}/f{i:04d}.png', dpi=100, facecolor='#000000')
    plt.close(fig)
    if i % 15 == 0: print(f"    cuadro {i+1}/{NFR}")

print(f"\n✓ {NFR} cuadros en {OUT}")
print("=" * 68)
print("  Volumen REAL girando. Color por DOCTRINA (falso color etiquetado,")
print("  luminancia primero, void negro, picos a blanco — nunca cobalto).")
print("=" * 68)
