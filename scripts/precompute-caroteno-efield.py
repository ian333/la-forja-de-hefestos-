#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Campo eléctrico E(r) de la cadena COMPLETA (N=11) — líneas de fuerza reales
# (V = núcleos + densidad PySCF, E=-∇V). Sin Hessiano → rápido. Mismo N que la formación.
import sys, os, struct
import numpy as np
BOHR = 0.529177210903; NDBL = 11; BASIS = '6-31g'; SEED = 20260706
from pyscf import gto, scf
dCC1, dCC2 = 1.34, 1.45
atoms = []; px = 0.0
for i in range(2*NDBL):
    yy = 0.0 if i%2==0 else 0.60
    atoms.append(['C',(px,yy,0.0)]); px += (dCC1 if i%2==0 else dCC2)*0.87
for (sx,sy,sz) in [a[1] for a in atoms]:
    atoms.append(['H',(sx, sy+(1.05 if sy==0.0 else -1.05), 0.0)])
sym=[a[0] for a in atoms]; P=np.array([a[1] for a in atoms],float); P-=P.mean(0); Pb=P/BOHR
A=len(atoms); Zof=np.array([6 if s=='C' else 1 for s in sym],float)
mol=gto.M(atom=[[sym[i],tuple(Pb[i])] for i in range(A)],unit='Bohr',basis=BASIS,spin=0,verbose=0)
mf=scf.RHF(mol); mf.max_cycle=200; mf.kernel(); dm=mf.make_rdm1()
print(f"E-field N={NDBL} {2*NDBL}C  E={mf.e_tot:.3f} Ha")
def Vp(pts):
    v=np.zeros(len(pts))
    for i,r in enumerate(pts):
        with mol.with_rinv_origin(tuple(r)): vm=mol.intor('int1e_rinv')
        v[i]=-np.einsum('ij,ij->',vm,dm)+np.sum(Zof/(np.linalg.norm(Pb-r,axis=1)+1e-9))
    return v
def Ef(r):
    h=0.03; e=np.zeros(3)
    for d in range(3):
        rp=r.copy(); rm=r.copy(); rp[d]+=h; rm[d]-=h
        e[d]=-(Vp(rp[None])[0]-Vp(rm[None])[0])/(2*h)
    return e
rng=np.random.default_rng(SEED); NL,LP=30,55
El=np.zeros((NL,LP,3),np.float32)
print("  trazando lineas de fuerza E ...")
for j in range(NL):
    a=rng.integers(0,A); p=Pb[a]+rng.normal(scale=0.9,size=3)
    for s in range(LP):
        El[j,s]=p; e=Ef(p); n=np.linalg.norm(e)
        if n<1e-6: El[j,s:]=p; break
        p=p+e/n*0.30
        if np.linalg.norm(p)>np.linalg.norm(Pb).max()+6: El[j,s+1:]=p; break
OUT=os.path.join(os.path.dirname(__file__),'..','public','precomputed','caroteno-efield.bin')
with open(OUT,'wb') as f:
    f.write(struct.pack('<2i',NL,LP)); f.write(np.clip(np.round(El*2000),-32767,32767).astype('<i2').tobytes())
print(f"OK {OUT} ({os.path.getsize(OUT)} bytes)")
