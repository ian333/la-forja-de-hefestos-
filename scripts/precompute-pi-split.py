#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-pi-split.py — ¿a cuál de los DOS enlaces π pertenece cada partícula?

Los dos π de un triple enlace son ORBITALES SEPARADOS y perpendiculares (p_y y
p_z respecto al eje x). Para cada partícula de la nube π (posiciones kEq del
<mol>-abinitio.bin) evaluamos ρ_π1 y ρ_π2 REALES y guardamos la fracción
f = ρ_π1/(ρ_π1+ρ_π2) → el render colorea cada π distinto (violeta/rosa).

Sale: public/precomputed/<mol>-pisplit.bin  (int32 Nspin · uint8[Nspin] f×255)
Uso:  python3 scripts/precompute-pi-split.py n2
"""
import sys, os, struct
import numpy as np

BOHR = 0.529177210903
MOLS = {'n2': ('N', 0, 1.09769), 'o2': ('O', 2, 1.20752), 'c2': ('C', 0, 1.2425)}
MOL = (sys.argv[1] if len(sys.argv) > 1 else 'n2').lower()
EL, SPIN, RE_A = MOLS[MOL]
RE = RE_A / BOHR
BASE = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed')

# posiciones kEq de la nube π desde el bin existente
with open(os.path.join(BASE, f'{MOL}-abinitio.bin'), 'rb') as f:
    Nacc, Ndep, Nspin, K = struct.unpack('<4i', f.read(16))
    Rmin, Rmax = struct.unpack('<2f', f.read(8))
    Rvals = np.frombuffer(f.read(4 * K), '<f4')
    f.read(4 * K * 4)                       # masas + bondMass
    f.read(Nacc * 3)                        # accColor
    f.read(2 * K * Nacc * 3)                # accPos
    f.read(2 * K * Ndep * 3)                # depPos
    spinPos = np.frombuffer(f.read(2 * K * Nspin * 3), '<i2').reshape(K, Nspin, 3).astype(float) / 5000.0
kEq = int(np.argmin(np.abs(Rvals - RE)))
pts = spinPos[kEq]
Req = float(Rvals[kEq])

from pyscf import gto, scf
mol = gto.M(atom=[[EL, (-Req / 2, 0, 0)], [EL, (Req / 2, 0, 0)]], basis='cc-pvtz', spin=SPIN, unit='Bohr', verbose=0)
mf = (scf.RHF(mol) if SPIN == 0 else scf.UHF(mol))
mf.level_shift = 0.1; mf.max_cycle = 200; mf.kernel()
C = mf.mo_coeff; occ = mf.mo_occ
if SPIN != 0:
    C = np.hstack([C[0], C[1]]); occ = np.concatenate([occ[0], occ[1]])

# clasificar MOs π por armónico azimutal (igual que el precompute principal)
occ_idx = np.where(occ > 1e-6)[0]
xs_s = np.linspace(-1.4, 1.4, 15); rs_s = np.array([0.25, 0.5, 0.8, 1.1, 1.5])
phis = np.linspace(0, 2 * np.pi, 24, endpoint=False)
grid = np.array([[x, r * np.cos(p), r * np.sin(p)] for x in xs_s for r in rs_s for p in phis])
ao = mol.eval_gto('GTOval', grid)
mo = (ao @ C[:, occ_idx]).reshape(len(xs_s), len(rs_s), len(phis), -1)
a1 = (mo * np.cos(phis)[None, None, :, None]).mean(axis=2)
b1 = (mo * np.sin(phis)[None, None, :, None]).mean(axis=2)
a0 = mo.mean(axis=2)
a2 = (mo * np.cos(2 * phis)[None, None, :, None]).mean(axis=2)
b2 = (mo * np.sin(2 * phis)[None, None, :, None]).mean(axis=2)
w = np.broadcast_to(rs_s[None, :, None], a0.shape)
p_sig = (w * a0 ** 2).sum(axis=(0, 1)); p_pi = (w * (a1 ** 2 + b1 ** 2)).sum(axis=(0, 1))
p_del = (w * (a2 ** 2 + b2 ** 2)).sum(axis=(0, 1))
lab = np.argmax(np.stack([p_sig, p_pi, p_del], axis=1), axis=1)
pim = occ_idx[lab == 1]
assert len(pim) >= 2, f"esperaba 2 MOs π, hay {len(pim)}"
pi1, pi2 = pim[0], pim[1]

# densidad de CADA π en las posiciones reales de las partículas
ao_p = mol.eval_gto('GTOval', pts)
psi1 = ao_p @ C[:, pi1]; psi2 = ao_p @ C[:, pi2]
r1 = occ[pi1] * psi1 ** 2; r2 = occ[pi2] * psi2 ** 2
frac = r1 / (r1 + r2 + 1e-12)
OUT = os.path.join(BASE, f'{MOL}-pisplit.bin')
with open(OUT, 'wb') as fp:
    fp.write(struct.pack('<i', Nspin))
    fp.write(np.clip(np.round(frac * 255), 0, 255).astype(np.uint8).tobytes())
n1 = int((frac > 0.5).sum())
print(f"OK {OUT}  Nspin={Nspin}  π1={n1}  π2={Nspin - n1}  (MOs {pi1},{pi2})")
