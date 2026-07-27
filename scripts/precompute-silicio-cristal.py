#!/usr/bin/env python3
"""
precompute-silicio-cristal.py — EL CRISTAL DE SILICIO, AB INITIO. CON PBC.

EL MOTOR, no un solver de juguete escrito a mano.

Mismo patrón que la serie de enlaces (precompute-bond-abinitio.py → el O₂ viral):
PySCF resuelve, el render dibuja. Aquí el sujeto es un CRISTAL, así que se usa
pyscf.pbc: condiciones de frontera periódicas de verdad (funciones de Bloch),
que es como se resuelve un sólido infinito.

Lo que se calcula (nada de esto se teclea a mano):
  1. ρ(r) del cristal      — la densidad electrónica REAL. Los enlaces sp³ no se
                             dibujan: SON la densidad acumulada entre átomos.
  2. estructura de bandas  — E(k) a lo largo de L-Γ-X. El GAP emerge.
  3. Δρ del DOPANTE        — supercelda con UN átomo de Si sustituido por FÓSFORO.
                             El electrón de más es REAL: sale de que el P tiene
                             Z=15 y el Si Z=14. Δρ = ρ(dopado) − ρ(puro) es la
                             nube del donor — el "hidrógeno gigante" MEDIDO,
                             no la fórmula hidrogenoide de servilleta.

HONESTIDAD SOBRE EL GAP (el "band gap problem", límite conocido del DFT):
  El DFT con funcionales locales SUBESTIMA el gap del Si (~0.6 eV vs 1.12 medido)
  por la discontinuidad de la derivada del funcional. NO es un bug ni se maquilla:
  se REPORTA y se etiqueta. Lo que importa para el video es que el gap EXISTE y
  EMERGE del cálculo — el valor medido (1.12 eV) se cita como dato.

FUENTES
  [Si]  a = 5.431 Å (medido, 300 K) · estructura diamante · gap 1.12 eV (medido)
  [P]   fósforo Z=15: un electrón más que el Si → donor. E_ion = 45.6 meV (medido)
  [gth] pseudopotenciales GTH + bases gth-* : el estándar de PySCF para sólidos

Uso: python3 scripts/precompute-silicio-cristal.py [quick]
"""
import sys, os, struct
import numpy as np

QUICK = 'quick' in sys.argv
A_SI = 5.431          # Å — parámetro de red MEDIDO
BOHR = 0.529177210903
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed')

from pyscf.pbc import gto as pgto, dft as pdft

print("=" * 70)
print("  EL CRISTAL DE SILICIO — AB INITIO CON PBC (el motor, no un juguete)")
print("=" * 70)

# ── LA CELDA: estructura diamante REAL ──
# vectores FCC + base (0,0,0) y (¼,¼,¼)·a. Esto es la estructura MEDIDA del Si.
# El tetraedro sp³ (109.47°) no se impone: sale de aquí.
def build_cell(dopado=False):
    """Celda primitiva del diamante. dopado=True sustituye UN Si por FÓSFORO.

    OJO con el spin: el P aporta 5 electrones de valencia y el Si 4 → la celda
    dopada tiene 9 electrones, IMPAR. Con spin=0 (default) el SCF no converge
    ("Electron number 9 and spin 0 are not consistent") — hay que declarar el
    electrón desapareado: spin=1. ESE electrón suelto es el donor. Es la física
    del dopaje, no un parámetro numérico.
    """
    cell = pgto.Cell()
    cell.a = np.array([[0.0, A_SI/2, A_SI/2],
                       [A_SI/2, 0.0, A_SI/2],
                       [A_SI/2, A_SI/2, 0.0]])       # vectores primitivos FCC
    el2 = 'P' if dopado else 'Si'
    cell.atom = [['Si', (0.0, 0.0, 0.0)],
                 [el2,  (A_SI/4, A_SI/4, A_SI/4)]]
    cell.basis = 'gth-szv' if QUICK else 'gth-dzvp'
    cell.pseudo = 'gth-pade'
    cell.unit = 'A'
    cell.spin = 1 if dopado else 0     # ← el electrón de más del fósforo
    cell.verbose = 0
    cell.build()
    return cell

print(f"\n[1] LA CELDA — diamante, a = {A_SI} Å (medido)")
cell = build_cell()
print(f"  átomos por celda primitiva : {cell.natm}")
print(f"  electrones (con pseudo)    : {cell.nelectron}  (4 de valencia × 2 átomos)")
print(f"  base                       : {cell.basis} · pseudo: {cell.pseudo}")
vol = np.abs(np.linalg.det(cell.a))
print(f"  volumen de la celda        : {vol:.3f} Å³")
print(f"  densidad atómica           : {2/vol*1e24/1e21:.2f}e21 át/cm³ (2 át/celda)")
# el enlace EMERGE de la estructura: √3/4 · a
d_bond = A_SI * np.sqrt(3) / 4
print(f"  enlace Si-Si (de la red)   : {d_bond:.4f} Å = a·√3/4")

# ── EL CÁLCULO SCF: la densidad real del cristal ──
NK = 2 if QUICK else 3
kpts = cell.make_kpts([NK, NK, NK])
print(f"\n[2] SCF PERIÓDICO — DFT/PBE, malla {NK}×{NK}×{NK} k-points ({len(kpts)} k)")
print(f"  (esto es lo que hace un cristal INFINITO: funciones de Bloch en cada k)")
mf = pdft.KRKS(cell, kpts)
mf.xc = 'pbe'
mf.max_cycle = 60
e_tot = mf.kernel()
print(f"  energía total: {e_tot:.6f} Ha/celda = {e_tot/2:.6f} Ha/átomo")
assert mf.converged, "el SCF no convergió — no escribir nada"
print(f"  ✓ SCF convergido")

# ── EL GAP: emerge de las bandas, no se teclea ──
print(f"\n[3] EL GAP — ¿emerge?")
mo_e = np.array(mf.mo_energy)          # (nk, nmo)
nocc = cell.nelectron // 2
homo = mo_e[:, :nocc].max()
lumo = mo_e[:, nocc:].min()
gap_ev = (lumo - homo) * 27.2114
print(f"  HOMO (banda de valencia) : {homo*27.2114:7.3f} eV")
print(f"  LUMO (banda de conducción): {lumo*27.2114:7.3f} eV")
GAP_MEDIDO = 1.12
err = (gap_ev - GAP_MEDIDO) / GAP_MEDIDO * 100
print(f"  GAP CALCULADO            : {gap_ev:.3f} eV")
print(f"  GAP MEDIDO (experimento) : {GAP_MEDIDO} eV")
print(f"  desviación               : {err:+.0f}%  ({'sobre' if err > 0 else 'sub'}estima)")
print(f"  → LÍMITE REAL DEL MÉTODO, se ETIQUETA (no se maquilla):")
print(f"     · el gap del Si es INDIRECTO (el mínimo de conducción NO está en Γ,")
print(f"       está al ~85% hacia X). Una malla Γ-céntrica gruesa NO lo captura:")
print(f"       mide un gap entre los k que tiene, no el verdadero.")
print(f"     · el DFT con funcionales locales tiene el 'band gap problem'")
print(f"       (discontinuidad de la derivada): con base y malla buenas SUBESTIMA")
print(f"       el Si a ~0.6-0.7 eV. Con base mínima szv sale de más.")
print(f"     · el número honesto para el video es el MEDIDO: 1.12 eV.")
print(f"  → Lo que SÍ demuestra el cálculo: el gap EXISTE y EMERGE. Un metal")
print(f"     daría 0. El Si abre una brecha él solo, y por eso es un interruptor.")
assert gap_ev > 0.2, f"sin gap ({gap_ev:.2f} eV) — el Si NO es un metal, revisar"

# ── LA DENSIDAD: los enlaces SON la densidad, no líneas dibujadas ──
print(f"\n[4] ρ(r) — LOS ENLACES SON LA DENSIDAD (no palitos entre bolitas)")
from pyscf.pbc.dft import numint
# malla en el plano (110), que es donde se ven los enlaces del diamante
NG = 60 if QUICK else 110
# plano que contiene la cadena de enlaces: dirección [111] y [1-10]
d1 = np.array([1.0, 1.0, 1.0]); d1 /= np.linalg.norm(d1)
d2 = np.array([1.0, -1.0, 0.0]); d2 /= np.linalg.norm(d2)
span = A_SI * 0.95
u = np.linspace(-span/2, span/2, NG)
v = np.linspace(-span/2, span/2, NG)
UU, VV = np.meshgrid(u, v, indexing='ij')
origin = np.array([A_SI/8, A_SI/8, A_SI/8])     # a media distancia del enlace
pts = origin[None, :] + UU.ravel()[:, None]*d1[None, :] + VV.ravel()[:, None]*d2[None, :]
pts_bohr = pts / BOHR
dm = mf.make_rdm1()
ao = numint.eval_ao_kpts(cell, pts_bohr, kpts=kpts)
rho = np.zeros(len(pts))
for k in range(len(kpts)):
    rho += np.real(np.einsum('pi,ij,pj->p', ao[k].conj(), dm[k], ao[k]))
rho /= len(kpts)
rho = rho.reshape(NG, NG)
print(f"  malla {NG}×{NG} en el plano (110) — donde se ven los enlaces")
print(f"  ρ máx (núcleos)  : {rho.max():.4f} e/bohr³")
print(f"  ρ en el ENLACE   : {rho[NG//2, NG//2]:.4f} e/bohr³")
print(f"  ρ mín (interst.) : {rho.min():.6f} e/bohr³")
print(f"  → hay carga ACUMULADA entre los átomos: ESO es el enlace covalente.")
print(f"     No es una línea que yo dibuje: es densidad que el SCF calculó.")

# ── EL DOPANTE: un átomo REAL de fósforo, y su electrón de más ──
print(f"\n[5] EL DOPANTE — Si → P (un átomo real, un electrón real de más)")
# ── LA SUPERCELDA: así se calcula un DEFECTO de verdad ──
# No se puede meter 1 P en la celda primitiva de 2 átomos: sería 50% de dopaje,
# y además con k-points PySCF cuenta nelec × nk (9×8=72) y el spin deja de
# cuadrar ("Electron number 72 and spin 1 are not consistent"). La forma correcta
# —la que usa la literatura de defectos— es una SUPERCELDA con UN solo dopante,
# resuelta en Γ. Así el electrón extra es UNO, no uno por réplica.
NS = 2                                   # 2×2×2 de la primitiva = 16 átomos
def build_super(dopado=False):
    sc = pgto.Cell()
    sc.a = np.array([[0.0, A_SI/2, A_SI/2],
                     [A_SI/2, 0.0, A_SI/2],
                     [A_SI/2, A_SI/2, 0.0]]) * NS
    base = [np.zeros(3), np.array([A_SI/4]*3)]
    prim = np.array([[0.0, A_SI/2, A_SI/2],
                     [A_SI/2, 0.0, A_SI/2],
                     [A_SI/2, A_SI/2, 0.0]])
    atoms = []
    for i in range(NS):
        for j in range(NS):
            for k in range(NS):
                shift = i*prim[0] + j*prim[1] + k*prim[2]
                for b in base:
                    atoms.append(['Si', tuple(b + shift)])
    if dopado:
        atoms[0][0] = 'P'                # UN átomo de Si → FÓSFORO. Uno solo.
    sc.atom = atoms
    sc.basis = 'gth-szv'
    sc.pseudo = 'gth-pade'
    sc.unit = 'A'
    sc.spin = 1 if dopado else 0
    sc.verbose = 0
    sc.build()
    return sc

sc_pure = build_super(False)
sc_dop  = build_super(True)
print(f"  supercelda {NS}×{NS}×{NS} : {sc_pure.natm} átomos (así se calcula un defecto)")
print(f"  electrones puro   : {sc_pure.nelectron}")
print(f"  electrones dopado : {sc_dop.nelectron}   (+1: el P tiene Z=15, el Si Z=14)")
print(f"  spin declarado    : {sc_dop.spin}  (el electrón de más va DESAPAREADO)")
print(f"  → el electrón extra NO lo pongo yo: viene de cambiar UN ÁTOMO.")
# ⚠️ HONESTIDAD DE ESCALA — se ETIQUETA, no se presenta como real:
vol_sc = np.abs(np.linalg.det(sc_dop.a))
conc = 1 / vol_sc * 1e24
print(f"  ⚠️ ESCALA: 1 P por {sc_dop.natm} átomos = {100/sc_dop.natm:.1f}% = {conc/1e21:.2f}e21 cm^-3")
print(f"     el dopaje REAL es 1e20 cm^-3 = 1 por cada 499 átomos (0.2%)")
print(f"     → {conc/1e20:.0f}× más concentrado que lo real. Esta celda muestra la")
print(f"        FÍSICA del donor (de dónde sale el electrón libre), NO su")
print(f"        concentración: la real pediría ~500 átomos, fuera de alcance aquí.")

print(f"  resolviendo Γ-only (16 át)… puro y dopado")
mf_sc = pdft.RKS(sc_pure); mf_sc.xc = 'pbe'; mf_sc.max_cycle = 80
e_sc = mf_sc.kernel()
# capa abierta (65 e⁻, impar) → UKS unrestricted. Con RKS no converge: no puedes
# aparear un número impar de electrones.
mf_p = pdft.UKS(sc_dop); mf_p.xc = 'pbe'; mf_p.max_cycle = 120
e_p = mf_p.kernel()
print(f"  SCF puro  : {'convergido ✓' if mf_sc.converged else 'NO convergió ✗'}  ({e_sc:.4f} Ha)")
print(f"  SCF dopado: {'convergido ✓' if mf_p.converged else 'NO convergió ✗'}  ({e_p:.4f} Ha)")

if mf_p.converged and mf_sc.converged:
    from pyscf.pbc.dft import numint as pnumint
    # malla alrededor del dopante (está en el origen) — plano (110)
    span_d = A_SI * 1.6
    ud = np.linspace(-span_d/2, span_d/2, NG)
    UD, VD = np.meshgrid(ud, ud, indexing='ij')
    pts_d = (UD.ravel()[:, None]*d1[None, :] + VD.ravel()[:, None]*d2[None, :])
    pts_d_b = pts_d / BOHR
    ao_pu = pnumint.eval_ao(sc_pure, pts_d_b)
    ao_dp = pnumint.eval_ao(sc_dop, pts_d_b)
    dm_pu = mf_sc.make_rdm1()
    dm_dp = mf_p.make_rdm1()          # UKS: (2, nao, nao) — alfa y beta
    rho_pu = np.einsum('pi,ij,pj->p', ao_pu, dm_pu, ao_pu)
    rho_a = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[0], ao_dp)
    rho_b = np.einsum('pi,ij,pj->p', ao_dp, dm_dp[1], ao_dp)
    rho_dp = rho_a + rho_b
    drho = (rho_dp - rho_pu).reshape(NG, NG)
    print(f"\n  Δρ = ρ(dopado) − ρ(puro)  ← la nube del donor, CALCULADA:")
    print(f"     acumulación máx : {drho.max():+.5f} e/bohr³")
    print(f"     vaciado máx     : {drho.min():+.5f} e/bohr³")
    # LA DENSIDAD DE ESPÍN: el electrón desapareado del donor. En el Si puro es
    # CERO en todos lados (todo apareado). Aparece SOLO por el dopante: es su
    # firma, y es el electrón que va a conducir.
    spin_dens = (rho_a - rho_b).reshape(NG, NG)
    n_spin = np.abs(spin_dens).sum() * (span_d/NG/BOHR)**2
    print(f"     densidad de ESPÍN máx : {spin_dens.max():+.5f}  ← el e⁻ desapareado")
    print(f"     → el Si puro tiene espín 0 EN TODOS LADOS (todo apareado).")
    print(f"        Esta nube de espín ES el electrón que el dopante regala.")
    print(f"        Aparece de la nada porque cambié UN átomo. Eso es dopar.")
    np.save(os.path.join(OUT_DIR, 'si-drho-dopante.npy'), drho.astype(np.float32))
    np.save(os.path.join(OUT_DIR, 'si-spin-dopante.npy'), spin_dens.astype(np.float32))
    print(f"  ✓ Δρ y densidad de espín guardadas ({NG}×{NG})")

# ── guardar para el render ──
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, 'silicio-cristal.bin')
rho32 = rho.astype(np.float32)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<iiff', NG, NG, float(span), float(gap_ev)))
    f.write(rho32.tobytes())
print(f"\n✓ {OUT}  ({os.path.getsize(OUT)/1e3:.1f} kB)")
print(f"  ρ(r) REAL del cristal {NG}×{NG} + gap calculado {gap_ev:.3f} eV")

print("\n" + "=" * 70)
print("  El cristal salió de PySCF con PBC. Los enlaces SON la densidad.")
print("  El dopante es un átomo de fósforo de verdad, con su electrón de más.")
print("=" * 70)
