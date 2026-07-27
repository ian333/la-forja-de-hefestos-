#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-bond-efield.py — CAMPO E REAL de una diatómica, IDÉNTICO al streamplot (panel 3):
malla de semillas + trazado BIDIRECCIONAL (del + al −, líneas completas) → el cuadrupolo real,
revolucionado alrededor del eje. V=Σ Z/|r−R| − ∫ρ/|r−r'| [int1e_grids, densidad SCF completa].
Semillas FIJAS (mismas para todo R) → línea j interpolable por R(t).
Salida: <mol>-efield.bin  int32 K,NL,LP · float32[K] Rvals · int16[K*NL*LP*3] líneas(bohr×2000)
"""
import sys, os, struct
import numpy as np
BOHR=0.529177210903
MOLS={'li2':('Li',2.6729),'be2':('Be',2.4536),
      # NaCl IÓNICO: el campo es EL fenómeno — las líneas nacen en el Na⁺
      # y mueren en el Cl⁻ = el DIPOLO naciendo. Re medido 2.3609 Å.
      'nacl':(('Na','Cl'),2.3609)}
MOL=(sys.argv[1] if len(sys.argv)>1 else 'li2').lower()
EL,RE_A=MOLS[MOL]; BASIS='cc-pvtz'
EL_A,EL_B=EL if isinstance(EL,tuple) else (EL,EL)
K=12; N_AZ=6; LP=64; HALF=50
R_MAX,R_MIN=(18.0,3.6) if MOL=='nacl' else (20.0,4.0)
Rvals=R_MAX+(R_MIN-R_MAX)*(np.arange(K)/(K-1))
from pyscf import gto, scf
gx=np.arange(-14.0,14.01,2.0); gy=np.arange(0.7,10.01,1.9)
SEEDS2D=np.array([[x,y] for x in gx for y in gy]); NS=len(SEEDS2D); NL=NS*N_AZ
azis=np.linspace(0,2*np.pi,N_AZ,endpoint=False)

def resample(path,LP):
    if len(path)<2: return np.tile(path[0] if len(path) else np.zeros(2),(LP,1))
    d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))]
    if d[-1]<1e-6: return np.tile(path[0],(LP,1))
    t=np.linspace(0,d[-1],LP)
    return np.stack([np.interp(t,d,path[:,0]),np.interp(t,d,path[:,1])],1)

lines=np.zeros((K,NL,LP,3),np.float32)
for ki in range(K):
    R=float(Rvals[ki])
    mol=gto.M(atom=[[EL_A,(-R/2,0,0)],[EL_B,(R/2,0,0)]],basis=BASIS,spin=0,unit='Bohr',verbose=0)
    mf=scf.RHF(mol); mf.level_shift=0.1; mf.max_cycle=200; mf.kernel(); dm=mf.make_rdm1()
    Z=np.array([mol.atom_charge(i) for i in range(mol.natm)],float)
    Rn=np.array([mol.atom_coord(i)[:2] for i in range(mol.natm)])
    Rn3=np.c_[Rn,np.zeros(len(Rn))]
    def E2d(P):
        Q=np.zeros((len(P),3)); Q[:,:2]=P; h=0.03
        def Vb(pts):
            Vm=mol.intor('int1e_grids',grids=np.ascontiguousarray(pts))
            ve=-np.einsum('gij,ij->g',Vm,dm)
            d=np.linalg.norm(pts[:,None,:]-Rn3[None],axis=2)+1e-9
            return ve+(Z[None,:]/d).sum(1)
        Ex=-(Vb(Q+[h,0,0])-Vb(Q-[h,0,0]))/(2*h); Ey=-(Vb(Q+[0,h,0])-Vb(Q-[0,h,0]))/(2*h)
        return np.stack([Ex,Ey],1)
    def leg(sign):
        P=SEEDS2D.copy().astype(float); paths=np.zeros((NS,HALF,2)); dead=np.full(NS,HALF); alive=np.ones(NS,bool)
        for st in range(HALF):
            paths[:,st]=P
            E=E2d(P); n=np.linalg.norm(E,axis=1,keepdims=True)
            u=np.where(n>1e-6, sign*E/np.maximum(n,1e-9),0.0)
            newP=P+u*0.19
            near=np.zeros(NS,bool)
            for rn in Rn: near|=(np.hypot(newP[:,0]-rn[0],newP[:,1]-rn[1])<0.42)
            far=(np.abs(newP[:,0])>R/2+9.5)|(newP[:,1]>9.5)|(newP[:,1]<-0.15)
            stop=(n[:,0]<=1e-6)|far|near
            jd=alive&stop; dead[jd]=np.minimum(dead[jd],st+1); alive&=~stop
            P=np.where(alive[:,None],newP,P)
        return paths,dead
    pf,df=leg(+1); pb,db=leg(-1)
    for i in range(NS):
        fwd=pf[i,:max(1,df[i])]; bwd=pb[i,:max(1,db[i])]
        full=np.vstack([bwd[::-1],fwd[1:]]) if len(bwd)>1 else fwd
        rs=resample(full,LP)
        for a,az in enumerate(azis):
            j=i*N_AZ+a
            lines[ki,j,:,0]=rs[:,0]; lines[ki,j,:,1]=rs[:,1]*np.cos(az); lines[ki,j,:,2]=rs[:,1]*np.sin(az)
    print(f"  R={R:5.2f} E={mf.e_tot:.4f}")

OUT=os.path.join(os.path.dirname(__file__),'..','public','precomputed',f'{MOL}-efield.bin')
with open(OUT,'wb') as f:
    f.write(struct.pack('<3i',K,NL,LP)); f.write(Rvals.astype('<f4').tobytes())
    f.write(np.clip(np.round(lines*2000),-32767,32767).astype('<i2').tobytes())
try:
    import shutil; shutil.copyfile(OUT,OUT.replace('public/precomputed','dist/precomputed'))
except Exception: pass
print(f"OK {OUT} (K={K}×NL={NL}×LP={LP})")
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig,ax=plt.subplots(1,2,figsize=(13,5.2),facecolor='black')
for c,ki in [(0,2),(1,K-1)]:
    a=ax[c]; a.set_facecolor('black')
    for i in range(NS):
        j=i*N_AZ; a.plot(lines[ki,j,:,0],lines[ki,j,:,1],color='#ffd8a0',lw=0.7,alpha=0.85)
        a.plot(lines[ki,j,:,0],-lines[ki,j,:,1],color='#ffd8a0',lw=0.7,alpha=0.85)
    a.plot([-Rvals[ki]/2,Rvals[ki]/2],[0,0],'+',color='#ff5a5a',ms=15,mew=2)
    a.set_xlim(-10,10); a.set_ylim(-8,8); a.set_aspect('equal'); a.tick_params(colors='white')
    a.set_title(f'R={Rvals[ki]:.1f} ({"separados" if c==0 else "enlazados"})',color='white')
p=os.path.join(os.path.dirname(__file__),'..','_o2_proof',f'{MOL}-efield-verify.png')
plt.savefig(p,dpi=115,facecolor='black',bbox_inches='tight'); print("verificación:",p)
