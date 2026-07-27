#!/usr/bin/env python3
"""
farm-cadenas.py — APILAR ÁTOMOS UNO POR UNO: el nacimiento del metal.

Ian: "apila más átomos, no solo 2… cadenas simples, no te compliques".

La historia que estos números cuentan (y que será video): ¿cuántos átomos
necesitas para hacer un metal? Con 2 átomos hay UN enlace y un salto enorme
entre HOMO y LUMO. Apila 4, 6, 8, 10… y el salto SE CIERRA: los niveles se
apretujan hasta volverse una BANDA. El metal no es un material: es un número
suficiente de átomos. Eso EMERGE del cálculo, no se dibuja.

Cadenas (geometrías con valores medidos/estándar, molecular PySCF, PBE/6-31G):
  · H_N   N=2,4,6,8,10   d=0.95 Å  — la cadena que quiere ser metal
  · Li_N  N=2,4,6,8      d=3.00 Å  — el metal alcalino naciendo
  · poliinos H-(C≡C)n-H  n=1..4    — C≡C 1.207 / C−C 1.370 / C−H 1.060 Å
                                      (los alambres de carbono REALES)

Por cadena: SCF → gap HOMO-LUMO + Δρ (vs promolécula radial) en volumen NV³
→ campos-<cadena>.npz (formato del corte) + hoja de contacto. Y un
cadenas-gaps.json con la curva gap-vs-N: EL dato del video.

Uso: python3 scripts/farm-cadenas.py
"""
import os, json, traceback
import numpy as np

BOHR = 0.529177210903
NV = 96
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'materia-farm')
os.makedirs(OUT, exist_ok=True)

from pyscf import gto, dft
from PIL import Image
from scipy.ndimage import map_coordinates

SPIN_AT = {'H': 1, 'Li': 1, 'C': 2}

def cadena_H(n, d=0.95):
    return [['H', (i*d, 0, 0)] for i in range(n)], f'h{n}'
def cadena_Li(n, d=3.00):
    return [['Li', (i*d, 0, 0)] for i in range(n)], f'li{n}'
def poliino(n):
    # H-(C≡C)n-H: triple 1.207, sencillo 1.370, C-H 1.060 (valores reales)
    xs = [0.0]
    for i in range(n):
        xs.append(xs[-1] + 1.207)
        if i < n-1: xs.append(xs[-1] + 1.370)
    atoms = [['C', (x, 0, 0)] for x in xs]
    atoms = [['H', (-1.060, 0, 0)]] + atoms + [['H', (xs[-1]+1.060, 0, 0)]]
    return atoms, f'poliino{n}'

QUEUE = ([cadena_H(n) for n in (2,4,6,8,10)] +
         [cadena_Li(n) for n in (2,4,6,8)] +
         [poliino(n) for n in (1,2,3,4)])

def perfil(el):
    at = gto.M(atom=[[el,(0,0,0)]], basis='6-31g', spin=SPIN_AT[el], verbose=0)
    m = dft.UKS(at); m.xc='pbe'; m.max_cycle=90; m.kernel()
    dmt = m.make_rdm1(); dmt = dmt[0]+dmt[1]
    rr = np.geomspace(0.02, 9.0, 480)
    dirs = np.array([[1,0,0],[0,1,0],[0,0,1],[1,1,1]/np.sqrt(3)])
    pr = np.zeros_like(rr)
    for dv in dirs:
        ao = gto.eval_gto(at, 'GTOval', rr[:,None]*dv[None,:]/BOHR)
        pr += ((ao @ dmt)*ao).sum(1)
    return rr, pr/len(dirs)

PROFS = {}
def get_prof(el):
    if el not in PROFS: PROFS[el] = perfil(el)
    return PROFS[el]

def contacto(name, F, ext):
    hxc = lambda h: [int(h[i:i+2],16)/255 for i in (0,2,4)]
    stops = [(0.0,hxc('7ce8ff')),(0.22,hxc('1c6a8c')),(0.5,hxc('000000')),
             (0.68,hxc('c8791a')),(0.88,hxc('ffb03a')),(1.0,hxc('fff4d0'))]
    xs = np.array([s[0] for s in stops]); cs = np.array([s[1] for s in stops])
    lut = np.stack([np.interp(np.linspace(0,1,512), xs, cs[:,k]) for k in range(3)],1)
    vmax = np.percentile(np.abs(F), 99.5) or 1
    # corte por el plano de la cadena (z=0) — la cadena vive en el eje x
    NPX = 720; NPY = 240
    ux = np.linspace(ext[0], ext[1], NPX); uy = np.linspace(-3.2, 3.2, NPY)
    XX, YY = np.meshgrid(ux, uy, indexing='xy')
    Lx, Ly, Lz = ext[1]-ext[0], 6.4, 6.4
    ix = (XX-ext[0])/Lx*(F.shape[0]-1); iy = (YY+3.2)/Ly*(F.shape[1]-1)
    iz = np.full_like(ix, (F.shape[2]-1)/2)
    c = map_coordinates(F, [ix.ravel(), iy.ravel(), iz.ravel()], order=1,
                        mode='nearest').reshape(NPY, NPX)
    tt = np.clip(c/vmax, -1, 1); tt = np.sign(tt)*np.abs(tt)**1.45
    img = lut[np.clip(((tt*0.5+0.5)*511),0,511).astype(int)]
    Image.fromarray(np.clip(img*255,0,255).astype(np.uint8),'RGB').save(f'{OUT}/{name}-contacto.png')

gaps = []
for atoms, name in QUEUE:
    npz = f'{OUT}/cadena-{name}.npz'
    if os.path.exists(npz):
        print(f"[{name}] ✓ ya existe", flush=True)
        d = np.load(npz); gaps.append({'name': name, 'n_at': len(atoms),
            'gap_eV': float(d['gap_eV']), 'e_tot': float(d['e_tot'])})
        continue
    print(f"[{name}] {len(atoms)} átomos…", flush=True)
    try:
        nelec = sum({'H':1,'Li':3,'C':6}[a[0]] for a in atoms)
        spin = nelec % 2
        mol = gto.M(atom=atoms, basis='6-31g', spin=spin, verbose=0)
        mf = (dft.UKS(mol) if spin else dft.RKS(mol)); mf.xc='pbe'; mf.max_cycle=140
        e = mf.kernel()
        assert mf.converged, "SCF no convergió"
        # gap HOMO-LUMO (el dato del video: se CIERRA al apilar)
        if spin:
            occ = np.concatenate([mf.mo_energy[0][mf.mo_occ[0]>0], mf.mo_energy[1][mf.mo_occ[1]>0]])
            vir = np.concatenate([mf.mo_energy[0][mf.mo_occ[0]==0], mf.mo_energy[1][mf.mo_occ[1]==0]])
        else:
            occ = mf.mo_energy[mf.mo_occ>0]; vir = mf.mo_energy[mf.mo_occ==0]
        gap = (vir.min() - occ.max()) * 27.2114
        # volumen alrededor de la cadena
        xs_at = [a[1][0] for a in atoms]
        x0, x1 = min(xs_at)-3.2, max(xs_at)+3.2
        gx = np.linspace(x0, x1, NV)
        gy = np.linspace(-3.2, 3.2, NV); gz = gy
        GX, GY, GZ = np.meshgrid(gx, gy, gz, indexing='ij')
        pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], 1)
        dm = mf.make_rdm1()
        dmt = (dm[0]+dm[1]) if spin else dm
        rho = np.zeros(len(pts)); CH = 30000
        for i0 in range(0, len(pts), CH):
            sl = slice(i0, min(i0+CH, len(pts)))
            ao = gto.eval_gto(mol, 'GTOval', pts[sl]/BOHR)
            rho[sl] = ((ao @ dmt)*ao).sum(1)
        rho_pro = np.zeros(len(pts))
        for el, pos in atoms:
            rr, pr = get_prof(el)
            dd = np.linalg.norm(pts - np.array(pos)[None,:], axis=1)
            rho_pro += np.interp(dd, rr, pr, right=0.0)
        F = (rho - rho_pro).reshape(NV,NV,NV).astype(np.float32)
        np.savez_compressed(npz, bond=F, gap_eV=gap, e_tot=e,
                            ext=np.array([x0,x1]), n_at=len(atoms))
        contacto(f'cadena-{name}', F, (x0,x1))
        gaps.append({'name': name, 'n_at': len(atoms), 'gap_eV': round(gap,3), 'e_tot': round(e,5)})
        print(f"  E={e:.4f} Ha · GAP={gap:.2f} eV · Δρ {F.min():+.4f}..{F.max():+.4f} ✓", flush=True)
    except Exception:
        print(f"  ✗ FALLÓ {name}", flush=True); traceback.print_exc(); continue

json.dump(gaps, open(f'{OUT}/cadenas-gaps.json','w'), indent=1)
print("\n── LA CURVA (el video: el gap se cierra al apilar) ──", flush=True)
for g in gaps: print(f"  {g['name']:>10}  {g['n_at']:2d} át → gap {g['gap_eV']:6.2f} eV", flush=True)
print("CADENAS_LISTAS", flush=True)
