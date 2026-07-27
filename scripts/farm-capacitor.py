#!/usr/bin/env python3
"""
farm-capacitor.py — LA MATERIA DENTRO DE UN CAPACITOR, ab initio.

Ian: "capacitores". Lo que le pasa a la materia entre las placas: el campo E
ESTIRA la nube electrónica. Δρ_pol = ρ(E) − ρ(0) es la polarización REAL —
de dónde sale la ε del dieléctrico y por qué el capacitor guarda energía.

Método estándar de campo finito (receta oficial de PySCF, examples/scf/40):
H' = H₀ + E·r. Se calcula μ(E) y α = dμ/dE — VERIFICABLE contra literatura
(H₂O: α ≈ 9.8 bohr³ experimental; si sale otra cosa, algo está mal).

Sistemas: H₂O (el dieléctrico universal) · diacetileno H-C≡C-C≡C-H (el alambre
polarizable). Campos 0 / 0.005 / 0.010 u.a. a lo largo del eje.

Salida: capacitor-<sys>.npz (rho0 + drho por campo) + capacitor-alfas.json
"""
import os, json, traceback
import numpy as np

BOHR = 0.529177210903
NV = 96
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'materia-farm')
os.makedirs(OUT, exist_ok=True)
from pyscf import gto, dft

SISTEMAS = {
    'h2o': [['O',(0,0,0)],['H',(0.7572,0.5865,0)],['H',(-0.7572,0.5865,0)]],   # exp geom
    'diacetileno': [['H',(-1.060,0,0)],['C',(0,0,0)],['C',(1.207,0,0)],
                    ['C',(2.577,0,0)],['C',(3.784,0,0)],['H',(4.844,0,0)]],
}
EJE = {'h2o': 1, 'diacetileno': 0}      # y para el agua (su dipolo), x para la cadena
CAMPOS = [0.0, 0.005, 0.010]            # u.a. (1 u.a. = 51.4 V/Å — brutal pero finito)

def run(atoms, F, eje):
    mol = gto.M(atom=atoms, basis='6-31g', verbose=0)
    mf = dft.RKS(mol); mf.xc = 'pbe'; mf.max_cycle = 160
    if F != 0.0:
        mol.set_common_orig([0, 0, 0])
        Evec = np.zeros(3); Evec[eje] = F
        h = (mol.intor('int1e_kin') + mol.intor('int1e_nuc')
             + np.einsum('x,xij->ij', Evec, mol.intor('int1e_r', comp=3)))
        mf.get_hcore = lambda *args: h
    e = mf.kernel()
    assert mf.converged, f"SCF no convergió (F={F})"
    dip = mf.dip_moment(unit='AU', verbose=0)
    return mol, mf, e, dip

alfas = []
for name, atoms in SISTEMAS.items():
    npz = f'{OUT}/capacitor-{name}.npz'
    if os.path.exists(npz):
        print(f"[{name}] ✓ ya existe", flush=True); continue
    print(f"[{name}] campo finito…", flush=True)
    try:
        eje = EJE[name]
        rhos = {}; dips = []
        xs = [a[1][0] for a in atoms]; ys = [a[1][1] for a in atoms]
        cx = (min(xs)+max(xs))/2; cy = (min(ys)+max(ys))/2
        span = max(max(xs)-min(xs), max(ys)-min(ys)) + 6.5
        g = np.linspace(-span/2, span/2, NV)
        GX, GY, GZ = np.meshgrid(g+cx, g+cy, g, indexing='ij')
        pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], 1)
        for F in CAMPOS:
            mol, mf, e, dip = run(atoms, F, eje)
            dips.append(dip[eje])
            dm = mf.make_rdm1()
            rho = np.zeros(len(pts)); CH = 30000
            for i0 in range(0, len(pts), CH):
                sl = slice(i0, min(i0+CH, len(pts)))
                ao = gto.eval_gto(mol, 'GTOval', pts[sl]/BOHR)
                rho[sl] = ((ao @ dm)*ao).sum(1)
            rhos[F] = rho.reshape(NV,NV,NV).astype(np.float32)
            print(f"  F={F:.3f} → E={e:.5f} Ha · μ_{'xyz'[eje]}={dip[eje]:+.4f} au", flush=True)
        # α = dμ/dE (diferencias finitas) — el número VERIFICABLE
        alfa = (dips[2]-dips[0]) / (CAMPOS[2]-CAMPOS[0])
        alfas.append({'sys': name, 'alfa_bohr3': round(float(alfa),2),
                      'ref': 'H2O exp ≈ 9.8 bohr³' if name=='h2o' else 'cadena: α crece con el largo'})
        np.savez_compressed(npz, rho0=rhos[0.0],
                            drho1=rhos[0.005]-rhos[0.0], drho2=rhos[0.010]-rhos[0.0],
                            span=span, alfa=alfa, campos=np.array(CAMPOS))
        print(f"  α = {alfa:.2f} bohr³ ✓", flush=True)
    except Exception:
        print(f"  ✗ FALLÓ {name}", flush=True); traceback.print_exc(); continue

json.dump(alfas, open(f'{OUT}/capacitor-alfas.json','w'), indent=1)
print("CAPACITOR_LISTO", flush=True)
