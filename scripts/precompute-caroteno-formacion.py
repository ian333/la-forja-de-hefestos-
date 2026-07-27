#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-caroteno-formacion.py — LA FORMACIÓN de la cadena, CALCULADA (honesto).

Modelo de O₂ generalizado (SIN SCF estirado, que RHF rompe):
  · Cada átomo de C tiene su densidad ATÓMICA real (PySCF, átomo libre) = el INDIVIDUAL.
  · La cadena en EQUILIBRIO tiene su densidad molecular real → Δρ = ρ_molécula − Σρ_átomos
    = la DEFORMACIÓN de enlace: dónde la carga se ACUMULA (enlaces C–C + cinturón π
    arriba/abajo del plano) y de dónde se VACÍA. Es el enlace DESNUDO, calculado.
  · Formación = los átomos se TRASLADAN de separados (×S) a sus posiciones enlazadas;
    sus nubes atómicas viajan con ellos y, al llegar a distancia de enlace, el Δρ
    (acumulación real) ENCIENDE entre vecinos → se ve nacer el enlace y deslocalizarse π.

Todo lo cuántico se calcula en geometrías que SÍ convergen (átomo libre + equilibrio).
La única "trayectoria" es el acercamiento geométrico (como el Morse R(t) de O₂).

Salida: public/precomputed/caroteno-formacion.bin
  int32 A(átomos) Nacc Ndep Natom
  float32[A*4] átomos(x,y,z,Z equilibrio, bohr)
  int16[Nacc*3] accPos(nube de ACUMULACIÓN Δρ>0 = enlaces+π, bohr×2000) · uint8[Nacc*3] accColor
  int16[Ndep*3] depPos(VACIADO Δρ<0)
  int16[Natom*3] atomProto(nube de UN átomo de C libre, centrada; se instancia por átomo)
  float32 dCCeq(distancia media de enlace, bohr, para el umbral de "encendido")
Uso:  python3 scripts/precompute-caroteno-formacion.py [Ndobles=7] [basis=6-31g]
"""
import sys, os, struct
import numpy as np

BOHR = 0.529177210903
NDBL = int(sys.argv[1]) if len(sys.argv) > 1 else 7
BASIS = sys.argv[2] if len(sys.argv) > 2 else '6-31g'
SEED = 20260706
# DENSIDAD DE CINE: la cadena es ~10× más larga que una diatómica → necesita ~10× más
# partículas para verse DENSA como el O₂ (no dispersa). Δρ 160k + proto 9k/carbono.
NACC, NDEP, NATOM = 160000, 44000, 9000

from pyscf import gto, scf, dft

# ── geometría all-trans del polieno C(2N)H(2N+2) (Å) → bohr ──
dCC1, dCC2 = 1.34, 1.45
atoms = []
px = 0.0
for i in range(2 * NDBL):
    yy = 0.0 if i % 2 == 0 else 0.60
    atoms.append(['C', (px, yy, 0.0)])
    d = dCC1 if i % 2 == 0 else dCC2
    px += d * 0.87
skeleton = [a[1] for a in atoms]
for (sx, sy, sz) in skeleton:
    atoms.append(['H', (sx, sy + (1.05 if sy == 0.0 else -1.05), 0.0)])
sym = [a[0] for a in atoms]
P = np.array([a[1] for a in atoms], float)
P -= P.mean(axis=0)
Pb = P / BOHR
A = len(atoms); nC = 2 * NDBL
Zof = np.array([6 if s == 'C' else 1 for s in sym])
# distancia media C–C de equilibrio (bohr)
cc = [np.linalg.norm(Pb[i] - Pb[i + 1]) for i in range(nC - 1)]
dCCeq = float(np.mean(cc))

# ── densidad MOLECULAR de equilibrio (converge bien) ──
mol = gto.M(atom=[[sym[i], tuple(Pb[i])] for i in range(A)], unit='Bohr', basis=BASIS, spin=0, verbose=0)
mf = scf.RHF(mol); mf.max_cycle = 200; Emol = mf.kernel()
dm_mol = mf.make_rdm1()
occ = mf.mo_occ; mo = mf.mo_energy
homo = max(mo[i] for i in range(len(mo)) if occ[i] > 0)
lumo = min(mo[i] for i in range(len(mo)) if occ[i] == 0)
gap = 27.2114 * (lumo - homo)
print(f"cadena {nC}C+{A-nC}H (N={NDBL} dobles) basis={BASIS}")
print(f"  E_molécula = {Emol:.4f} Ha · gap HOMO-LUMO = {gap:.2f} eV · dCC_eq = {dCCeq*BOHR:.3f} Å")

# dm de cada elemento libre UNA vez (C y H) — se reusa por átomo (no re-SCF)
def elem_dm(elem):
    a = gto.M(atom=[[elem, (0, 0, 0)]], basis=BASIS, spin=(2 if elem == 'C' else 1), verbose=0)
    amf = scf.UHF(a); amf.max_cycle = 200; amf.kernel()
    d = amf.make_rdm1(); return a, (d[0] + d[1])
molC, dmC = elem_dm('C'); molH, dmH = elem_dm('H')

# malla MC alrededor de la molécula; Δρ = ρ_mol − Σρ_átomo, POR LOTES (memoria baja)
rng = np.random.default_rng(SEED)
lo = Pb.min(axis=0) - 3.0; hi = Pb.max(axis=0) + 3.0
M = 320000
grid = rng.uniform(lo, hi, size=(M, 3))
drho = np.zeros(M)
CH = 40000
print("  Δρ = ρ_mol − Σρ_átomos (por lotes)…")
for b0 in range(0, M, CH):
    g = grid[b0:b0 + CH]
    ao = mol.eval_gto('GTOval', g)
    rm = np.einsum('pi,pi->p', ao @ dm_mol, ao)
    ra = np.zeros(len(g))
    for i in range(A):
        am, dmi = (molC, dmC) if sym[i] == 'C' else (molH, dmH)
        aoa = am.eval_gto('GTOval', g - Pb[i])
        ra += np.einsum('pi,pi->p', aoa @ dmi, aoa)
    drho[b0:b0 + CH] = rm - ra

# ── muestrear ACUMULACIÓN (Δρ>0 = enlaces+π) y VACIADO (Δρ<0) ∝ |Δρ| ──
def sample(mask, npts):
    w = np.clip(np.abs(drho) * mask, 0, None)
    if w.sum() <= 0: return np.zeros((npts, 3), np.float32)
    idx = rng.choice(M, size=npts, p=w / w.sum())
    return (grid[idx] + rng.normal(scale=0.12, size=(npts, 3))).astype(np.float32)
accPos = sample(drho > 0, NACC)
depPos = sample(drho < 0, NDEP)
# color de la acumulación: cinturón π (|z|>0.4 bohr fuera del plano) = ámbar/π ; puente σ = oro
accColor = np.zeros((NACC, 3), np.uint8)
zabs = np.abs(accPos[:, 2])
ispi = zabs > 0.45
accColor[ispi] = [255, 150, 40]      # π (cinturón fuera del plano) — ámbar
accColor[~ispi] = [255, 205, 120]    # σ (puente en el plano) — oro pálido
accP = float(drho[drho > 0].sum() * (np.prod(hi - lo) / M))
print(f"  Δρ: acumulación total ≈ {accP:.2f} e⁻ (carga que se junta al formar enlaces+π)")

# ── prototipo: nube de UN átomo de C libre (los INDIVIDUALES antes de juntarse) ──
gA = rng.normal(scale=1.6, size=(NATOM * 3, 3))
aC = gto.M(atom=[['C', (0, 0, 0)]], basis=BASIS, spin=2, verbose=0)
amf = scf.UHF(aC); amf.kernel(); dmC = amf.make_rdm1(); dmC = dmC[0] + dmC[1]
aoC = aC.eval_gto('GTOval', gA); rhoC = np.einsum('pi,pi->p', aoC @ dmC, aoC)
idxC = rng.choice(len(gA), size=NATOM, p=rhoC / rhoC.sum())
atomProto = gA[idxC].astype(np.float32)

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'caroteno-formacion.bin')
with open(OUT, 'wb') as f:
    f.write(struct.pack('<4i', A, NACC, NDEP, NATOM))
    atom4 = np.concatenate([Pb, Zof[:, None]], axis=1).astype('<f4')
    f.write(atom4.tobytes())
    f.write(np.clip(np.round(accPos * 2000), -32767, 32767).astype('<i2').tobytes())
    f.write(accColor.tobytes())
    f.write(np.clip(np.round(depPos * 2000), -32767, 32767).astype('<i2').tobytes())
    f.write(np.clip(np.round(atomProto * 2000), -32767, 32767).astype('<i2').tobytes())
    f.write(struct.pack('<f', dCCeq))
print(f"\nOK {OUT}  ({os.path.getsize(OUT)/1e6:.1f} MB)")
print("Calculado: nube atómica (individuales) + Δρ REAL (enlaces σ + cinturón π). Listo para el render de FORMACIÓN.")
