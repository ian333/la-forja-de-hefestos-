#!/usr/bin/env python3
"""
precompute-atom-cloud.py — la nube electrónica del ÁTOMO AISLADO (real, PySCF).

Para el acto 1 de la serie de enlaces: ver a los átomos como INDIVIDUOS (cada uno
con su nube) antes de que se entrelacen. Muestrea la densidad radial REAL del átomo
(UHF/cc-pVTZ, estado base) con inverse-CDF sobre P(r) ∝ ρ(r)·r² + direcciones
aleatorias isotrópicas (semilla fija). El render pone DOS copias, una por núcleo,
siguiendo drawPos — al acercarse, las nubes se traslapan = "se funden" LITERAL.

Salida: public/precomputed/<mol>-atomcloud.bin
  int32 M · int16[M*3] pos (bohr ×5000)

Uso: python3 scripts/precompute-atom-cloud.py <mol>   (mol = n2|o2|f2|h2)
"""
import sys, os, struct
import numpy as np

ATOMS = {  # elemento y espín del átomo AISLADO (regla de Hund, estado base real)
    'h2': ('H', 1), 'n2': ('N', 3), 'o2': ('O', 2), 'f2': ('F', 1), 'c2': ('C', 2),
}
MOL = (sys.argv[1] if len(sys.argv) > 1 else 'n2').lower()
EL, SPIN = ATOMS[MOL]
M = 9000
SEED = 20260701
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', f'{MOL}-atomcloud.bin')

from pyscf import gto, scf
mol = gto.M(atom=[[EL, (0, 0, 0)]], basis='cc-pvtz', spin=SPIN, verbose=0)
mf = scf.UHF(mol); mf.kernel()
dm = mf.make_rdm1(); dm_tot = dm[0] + dm[1]

# densidad radial en malla log (0.01 → 6 bohr)
rs = np.geomspace(0.01, 6.0, 600)
pts = np.stack([rs, np.zeros_like(rs), np.zeros_like(rs)], axis=1)
ao = mol.eval_gto('GTOval', pts)
rho = np.einsum('pi,pi->p', ao @ dm_tot, ao)          # ρ(r) esférica (estado base UHF)
P = rho * rs**2                                        # P(r) ∝ ρ·r² (distribución radial REAL)
cdf = np.concatenate([[0.0], np.cumsum(0.5 * (P[1:] + P[:-1]) * np.diff(rs))])
cdf /= cdf[-1]

rng = np.random.default_rng(SEED)
r = np.interp(rng.random(M), cdf, rs)                  # inverse-CDF → radios reales
u = rng.normal(size=(M, 3)); u /= np.linalg.norm(u, axis=1, keepdims=True)
pos = r[:, None] * u

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as fp:
    fp.write(struct.pack('<i', M))
    fp.write(np.clip(np.round(pos * 5000), -32767, 32767).astype('<i2').tobytes())
print(f"OK {OUT}  M={M}  E={mf.e_tot:.4f} Ha  <r>={r.mean():.2f} bohr  r90={np.quantile(r,0.9):.2f}")
try:
    import shutil
    shutil.copyfile(OUT, OUT.replace('public/precomputed', 'dist/precomputed'))
except Exception:
    pass
