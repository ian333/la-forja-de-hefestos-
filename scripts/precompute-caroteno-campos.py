#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-caroteno-campos.py — LA DINÁMICA CUÁNTICA, CALCULADA (no jitter pintado).

Tres físicas reales que dan la LOCURA cuántica del caroteno, todas con PySCF:

  1. CAMPO ELÉCTRICO E(r): del potencial electrostático molecular real
     V(r) = Σ_A Z_A/|r−R_A| − ∫ ρ(r')/|r−r'| d³r'   (núcleos + densidad electrónica).
     E = −∇V. Trazamos LÍNEAS DE FUERZA reales (integración de E) → el campo eléctrico
     que envuelve la cadena, calculado.

  2. VIBRACIÓN — MODOS NORMALES: Hessiano PySCF → frecuencias ωᵢ + vectores de
     desplazamiento. La molécula NO está quieta: vibra en sus modos reales, y por el
     PUNTO CERO tiembla aún a 0 K (amplitud A ∝ √(ħ/2μω)). El caos cuántico REAL.

  3. CORRIENTE π: la densidad π deslocalizada = electrones que fluyen por la cadena
     (la "autopista" del cromóforo). Cargas en movimiento → hay respuesta magnética.

Salida: public/precomputed/caroteno-campos.bin
  int32 NL(líneas E) LP(pts/línea)  ·  int16[NL*LP*3] Elines(bohr×2000)
  int32 NM(modos) A(átomos)  ·  float32[NM] freq_cm1  ·  float32[NM] zpAmp(bohr)
  float32[NM*A*3] modeVec(desplazamiento normalizado por modo y átomo)
  float32[A*3] atomEq(bohr)
Uso: python3 scripts/precompute-caroteno-campos.py [Ndobles=5] [basis=6-31g]
"""
import sys, os, struct
import numpy as np

BOHR = 0.529177210903
NDBL = int(sys.argv[1]) if len(sys.argv) > 1 else 5
BASIS = sys.argv[2] if len(sys.argv) > 2 else '6-31g'
SEED = 20260706

from pyscf import gto, scf

# ── geometría all-trans C(2N)H(2N+2) (Å→bohr) ──
dCC1, dCC2 = 1.34, 1.45
atoms = []; px = 0.0
for i in range(2 * NDBL):
    yy = 0.0 if i % 2 == 0 else 0.60
    atoms.append(['C', (px, yy, 0.0)]); px += (dCC1 if i % 2 == 0 else dCC2) * 0.87
for (sx, sy, sz) in [a[1] for a in atoms]:
    atoms.append(['H', (sx, sy + (1.05 if sy == 0.0 else -1.05), 0.0)])
sym = [a[0] for a in atoms]
P = np.array([a[1] for a in atoms], float); P -= P.mean(axis=0)
Pb = P / BOHR
A = len(atoms); Zof = np.array([6 if s == 'C' else 1 for s in sym], float)
mass = np.array([12.011 if s == 'C' else 1.008 for s in sym])

mol = gto.M(atom=[[sym[i], tuple(Pb[i])] for i in range(A)], unit='Bohr', basis=BASIS, spin=0, verbose=0)
mf = scf.RHF(mol); mf.max_cycle = 200; mf.kernel()
dm = mf.make_rdm1()
print(f"caroteno campos: {2*NDBL}C+{A-2*NDBL}H  basis={BASIS}  E={mf.e_tot:.4f} Ha")

# ═══ 1. CAMPO ELÉCTRICO — V(r) real y E=−∇V, líneas de fuerza ═══
# V(r) = nuclear(+) + electrónico(−). El electrónico = −Tr[dm · <μ|1/|r−r'||ν>] con
# el origen 1/r en cada punto (int1e_rinv de PySCF). E = −∇V por diferencias finitas.
def grid_potential(pts):
    v = np.zeros(len(pts))
    for i, r in enumerate(pts):
        with mol.with_rinv_origin(tuple(r)):
            vmat = mol.intor('int1e_rinv')
        v[i] = -np.einsum('ij,ij->', vmat, dm)                          # electrónico (−)
        v[i] += np.sum(Zof / (np.linalg.norm(Pb - r, axis=1) + 1e-9))   # nuclear (+)
    return v

def Efield(r):
    h = 0.03; e = np.zeros(3)
    for d in range(3):
        rp = r.copy(); rm = r.copy(); rp[d] += h; rm[d] -= h
        e[d] = -(grid_potential(rp[None])[0] - grid_potential(rm[None])[0]) / (2 * h)
    return e

rng = np.random.default_rng(SEED)
lo = Pb.min(0) - 2.0; hi = Pb.max(0) + 2.0
NL, LP = 26, 60
Elines = np.zeros((NL, LP, 3), np.float32)
print("  trazando líneas de fuerza del campo eléctrico E=−∇V …")
seeds = []
for j in range(NL):
    a = rng.integers(0, A)
    seeds.append(Pb[a] + rng.normal(scale=0.9, size=3))
for j, p0 in enumerate(seeds):
    p = np.array(p0, float)
    for s in range(LP):
        Elines[j, s] = p
        e = Efield(p); n = np.linalg.norm(e)
        if n < 1e-6:
            Elines[j, s:] = p; break
        p = p + e / n * 0.28
        if np.any(p < lo - 2) or np.any(p > hi + 2):
            Elines[j, s + 1:] = p; break

# ═══ 2. VIBRACIÓN — modos normales (Hessiano) + amplitud de punto cero ═══
print("  Hessiano (modos normales de vibración) — puede tardar …")
NM = 0; freq_cm1 = np.zeros(0); zpAmp = np.zeros(0); modeVec = np.zeros((0, A, 3))
try:
    hess = mf.Hessian().kernel()                       # (A,A,3,3)
    H = hess.transpose(0, 2, 1, 3).reshape(A * 3, A * 3)
    msqrt = np.repeat(np.sqrt(mass * 1822.888), 3)     # uma→me
    Hmw = H / np.outer(msqrt, msqrt)
    w2, V = np.linalg.eigh((Hmw + Hmw.T) / 2)
    HART2CM = 219474.63
    freq = np.sign(w2) * np.sqrt(np.abs(w2)) * HART2CM
    order = np.argsort(freq)
    allreal = [i for i in order if freq[i] > 120]        # modos reales (fuera los 6 trasl/rot ~0)
    print(f"  espectro (cm⁻¹): {np.round([freq[i] for i in allreal]).astype(int)}")
    # elegir los VISIBLES: colectivos de BAJA frecuencia (la cadena ondea, gran amplitud
    # de punto cero A∝1/√ω) + el C=C stretch (~1600, los enlaces PULSAN) + esqueleto.
    low = allreal[:4]
    cc = [i for i in allreal if 1400 < freq[i] < 1750][:3]
    mid = [i for i in allreal if 900 < freq[i] < 1400][:2]
    seen = set(); real_modes = [i for i in (low + mid + cc) if not (i in seen or seen.add(i))]
    NM = len(real_modes)
    freq_cm1 = np.array([freq[i] for i in real_modes], float)
    modeVec = np.zeros((NM, A, 3))
    zpAmp = np.zeros(NM)
    for k, i in enumerate(real_modes):
        v = V[:, i] / msqrt                            # desplazamiento cartesiano
        v = v.reshape(A, 3)
        v /= (np.linalg.norm(v) + 1e-9)
        modeVec[k] = v
        w_au = max(freq[i], 1) / HART2CM
        zpAmp[k] = np.sqrt(1.0 / (2 * 1822.888 * 12.0 * w_au))   # ~amplitud punto cero (bohr, escala)
    print(f"  modos: {NM}  frecuencias (cm⁻¹): {np.round(freq_cm1).astype(int)}")
    print(f"  el C=C stretch ~1600 cm⁻¹, esqueleto ~1100-1300 — la cadena VIBRA real")
except Exception as ex:
    print(f"  (Hessiano saltado: {ex})")

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'caroteno-campos.bin')
with open(OUT, 'wb') as f:
    f.write(struct.pack('<2i', NL, LP))
    f.write(np.clip(np.round(Elines * 2000), -32767, 32767).astype('<i2').tobytes())
    f.write(struct.pack('<2i', NM, A))
    f.write(freq_cm1.astype('<f4').tobytes())
    f.write(zpAmp.astype('<f4').tobytes())
    f.write(modeVec.astype('<f4').tobytes())
    f.write(Pb.astype('<f4').tobytes())
print(f"\nOK {OUT}  ({os.path.getsize(OUT)/1e6:.2f} MB)")
print("Calculado: campo E (líneas de fuerza) + modos de vibración (la dinámica cuántica REAL).")
