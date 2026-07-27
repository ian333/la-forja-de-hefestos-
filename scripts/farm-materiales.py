#!/usr/bin/env python3
"""
farm-materiales.py — GRANJA NOCTURNA: los campos ab initio de la serie MATERIA.

Ian (2026-07-16): "deja toda la noche preparando moléculas... computando los
números de los videos... farmearemos seguidores con ciencia hermosa".

Cola de materiales para la mecánica ganadora (el corte que viaja, la del
silicio publicado hoy). Cada sistema produce su checkpoint campos-*.npz (el
mismo formato que consume silicio-corte-4k.py) + una HOJA DE CONTACTO PNG
(3 cortes por campo) para revisar en la mañana A OJO antes de producir.

RESUMABLE: si el npz de un sistema existe, se salta (doctrina iangpu-nunca-
ocioso). Los seguros van primero; los metales (SCF con smearing, más frágil)
al final. Un try/except por sistema: si uno falla, el siguiente sigue.

Sistemas (parámetros de red MEDIDOS, nada inventado):
  si-boro    Si₁₅B  diamante a=5.431  — EL HUECO (tipo-p, espejo del donor)
  c-diamante C₁₆    diamante a=3.5668 — el enlace más denso (por qué es duro)
  nacl       Na₄Cl₄ rocksalt a=5.6402 — el enlace IÓNICO (el robo de carga)
  mgo        Mg₄O₄  rocksalt a=4.212  — iónico II (el aislante)
  na-metal   Na₁₆   bcc a=4.2906      — EL MAR DE ELECTRONES (smearing Fermi)

Uso: python3 scripts/farm-materiales.py [quick]
"""
import sys, os, traceback
import numpy as np

QUICK = 'quick' in sys.argv
BOHR = 0.529177210903
NV = 84 if QUICK else 128
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'materia-farm')
os.makedirs(OUT, exist_ok=True)

from pyscf.pbc import gto as pgto, dft as pdft
from pyscf import gto as mgto, dft as mdft
from pyscf.pbc.dft import numint as pnumint
from PIL import Image

# spin del átomo AISLADO (regla de Hund) para las promoléculas
SPIN_AT = {'Si': 2, 'B': 1, 'C': 2, 'Na': 1, 'Cl': 1, 'Mg': 0, 'O': 2, 'P': 1}

def fcc_conv(a, el_a, el_b=None, base_b=(0.5, 0.0, 0.0)):
    """celda convencional FCC/rocksalt (cubo a): 4 sitios FCC de el_a
    (+4 de el_b desplazados si rocksalt)."""
    FCC = [(0,0,0), (0,.5,.5), (.5,0,.5), (.5,.5,0)]
    atoms = [[el_a, tuple(np.array(p)*a)] for p in FCC]
    if el_b:
        atoms += [[el_b, tuple((np.array(p) + np.array(base_b)) % 1.0 * a)] for p in FCC]
    return atoms

def diamante(a, el, n=2, sub=None):
    """supercelda n×n×n de la primitiva FCC del diamante (2 át/prim)."""
    prim = np.array([[0,a/2,a/2],[a/2,0,a/2],[a/2,a/2,0]])
    base = [np.zeros(3), np.array([a/4]*3)]
    atoms = []
    for i in range(n):
        for j in range(n):
            for k in range(n):
                sh = i*prim[0]+j*prim[1]+k*prim[2]
                for b in base: atoms.append([el, tuple(b+sh)])
    if sub: atoms[0][0] = sub
    return atoms, prim*n

def bcc_super(a, el, n=2):
    """supercelda n³ de la convencional BCC (2 át/celda cúbica)."""
    atoms = []
    for i in range(n):
        for j in range(n):
            for k in range(n):
                o = np.array([i,j,k])*a
                atoms.append([el, tuple(o)])
                atoms.append([el, tuple(o + a/2)])
    return atoms, np.eye(3)*a*n

SYSTEMS = [
    # nombre, builder → (atoms, cell_a, cubo_período, spin, dopado_vs_puro, smearing)
    ('si-boro',    lambda: diamante(5.431, 'Si', 2, sub='B'), 2*5.431,  1, ('Si', lambda: diamante(5.431,'Si',2)), False),
    ('c-diamante', lambda: diamante(3.5668, 'C', 2),          2*3.5668, 0, None, False),
    ('nacl',       lambda: (fcc_conv(5.6402,'Na','Cl'), np.eye(3)*5.6402), 5.6402, 0, None, False),
    ('mgo',        lambda: (fcc_conv(4.212,'Mg','O'),  np.eye(3)*4.212),  4.212,  0, None, False),
    ('na-metal',   lambda: bcc_super(4.2906,'Na',2),          2*4.2906, 0, None, True),
]

def scf_cell(atoms, cell_a, spin, smear):
    sc = pgto.Cell()
    sc.a = cell_a; sc.atom = atoms
    sc.basis = 'gth-szv'; sc.pseudo = 'gth-pade'; sc.unit = 'A'
    sc.spin = spin; sc.verbose = 0
    # ⚠️ ke_cutoff explícito: Na/Cl/Mg son pseudos más DUROS que Si/C. Con la
    # malla FFT por defecto, get_j reventaba con "buffer is too small for
    # requested array" (nacl/mgo murieron así en la 1ª noche; Si/C pasaron con
    # el mismo código porque son blandos). 200 Ry da malla holgada.
    sc.ke_cutoff = 200
    sc.build()
    mf = pdft.UKS(sc) if spin else pdft.RKS(sc)
    mf.xc = 'pbe'; mf.max_cycle = 120
    # GDF (densidad ajustada gaussiana): robusto para iónicos/metales donde el
    # FFTDF por defecto se queda corto. Más lento pero NO revienta.
    from pyscf.pbc.df import GDF
    mf.with_df = GDF(sc); mf.with_df.build()
    if smear:
        from pyscf.pbc.scf.addons import smearing_
        mf = smearing_(mf, sigma=0.01, method='fermi')
    mf.kernel()
    return sc, mf

def dens_on(sc, mf, pts):
    dm = mf.make_rdm1()
    unrestricted = isinstance(dm, (tuple, list)) or (getattr(dm, 'ndim', 2) == 3)
    ra = np.zeros(len(pts)); rb = np.zeros(len(pts))
    CH = 24000
    for i0 in range(0, len(pts), CH):
        sl = slice(i0, min(i0+CH, len(pts)))
        ao = pnumint.eval_ao(sc, pts[sl]/BOHR)
        if unrestricted:
            ra[sl] = ((ao @ dm[0]) * ao).sum(axis=1)
            rb[sl] = ((ao @ dm[1]) * ao).sum(axis=1)
        else:
            ra[sl] = ((ao @ dm) * ao).sum(axis=1) / 2
            rb[sl] = ra[sl]
    return ra, rb

def perfil_radial(el):
    at = mgto.M(atom=[[el,(0,0,0)]], basis='gth-szv', pseudo='gth-pade',
                spin=SPIN_AT[el], verbose=0)
    m = mdft.UKS(at); m.xc='pbe'; m.max_cycle=90; m.kernel()
    dmt = m.make_rdm1(); dmt = dmt[0] + dmt[1]
    rr = np.geomspace(0.02, 9.0, 500)
    dirs = np.array([[1,0,0],[0,1,0],[0,0,1],
                     [1,1,1]/np.sqrt(3),[1,-1,0]/np.sqrt(2)])
    prof = np.zeros_like(rr)
    for dv in dirs:
        ao = mgto.eval_gto(at, 'GTOval', rr[:,None]*dv[None,:]/BOHR)
        prof += ((ao @ dmt) * ao).sum(axis=1)
    return rr, prof/len(dirs), m.converged

def hoja_contacto(name, fields, L):
    """3 cortes (s=-0.25L, 0, +0.25L) × campos → PNG para revisar a ojo."""
    from scipy.ndimage import map_coordinates
    def hxc(h): return [int(h[i:i+2],16)/255 for i in (0,2,4)]
    stops = [(0.0,hxc('7ce8ff')),(0.22,hxc('1c6a8c')),(0.5,hxc('000000')),
             (0.68,hxc('c8791a')),(0.88,hxc('ffb03a')),(1.0,hxc('fff4d0'))]
    xs = np.array([s[0] for s in stops]); cs = np.array([s[1] for s in stops])
    lut = np.stack([np.interp(np.linspace(0,1,512), xs, cs[:,k]) for k in range(3)], 1)
    d1 = np.array([1,1,1.0]); d1/=np.linalg.norm(d1)
    d2 = np.array([1,-1,0.0]); d2/=np.linalg.norm(d2)
    nh = np.cross(d1,d2)
    NP = 300
    u = np.linspace(-L*0.65, L*0.65, NP)
    UU, VV = np.meshgrid(u, u, indexing='xy')
    tiles = []
    for fname, f in fields.items():
        vmax = np.percentile(np.abs(f), 99.5) or 1
        row = []
        for sfrac in (-0.25, 0.0, 0.25):
            P = UU[...,None]*d2 + VV[...,None]*d1 + sfrac*L*nh
            idx = (P + L/2)/L * f.shape[0]
            c = map_coordinates(f, [idx[...,0].ravel(), idx[...,1].ravel(), idx[...,2].ravel()],
                                order=1, mode='grid-wrap').reshape(NP,NP)
            tt = np.clip(c/vmax, -1, 1); tt = np.sign(tt)*np.abs(tt)**1.45
            row.append(lut[np.clip(((tt*0.5+0.5)*511),0,511).astype(int)])
        tiles.append(np.concatenate(row, axis=1))
    img = np.clip(np.concatenate(tiles, axis=0)*255, 0, 255).astype(np.uint8)
    Image.fromarray(img,'RGB').save(f'{OUT}/{name}-contacto.png')

for name, builder, L_PER, spin, dop_ref, smear in SYSTEMS:
    npz = f'{OUT}/campos-{name}-{NV}.npz'
    if os.path.exists(npz):
        print(f"[{name}] ✓ ya existe — salto", flush=True); continue
    print(f"\n[{name}] ══════════ SCF…", flush=True)
    try:
        atoms, cell_a = builder()
        sc, mf = scf_cell(atoms, cell_a, spin, smear)
        conv = getattr(mf, 'converged', False)
        print(f"  {len(atoms)} át · E={mf.e_tot:.4f} Ha · {'✓ conv' if conv else '✗ NO CONV'}", flush=True)
        if not conv: raise RuntimeError("SCF no convergió")
        # malla del cubo periódico [−L/2, L/2)
        g = -L_PER/2 + np.arange(NV) * (L_PER / NV)
        GX, GY, GZ = np.meshgrid(g, g, g, indexing='ij')
        pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
        print(f"  densidades en {NV}³…", flush=True)
        ra, rb = dens_on(sc, mf, pts)
        rho = ra + rb
        # promolécula por perfiles radiales (por elemento)
        print("  promolécula…", flush=True)
        els = sorted(set(a[0] for a in atoms))
        profs = {}
        for el in els:
            rr, pr, ok = perfil_radial(el)
            profs[el] = (rr, pr)
            print(f"    átomo {el} {'✓' if ok else '✗'}", flush=True)
        # sitios: traslaciones del supercubo que alcanzan la caja
        rho_pro = np.zeros(len(pts))
        n_sit = 0
        for i in (-1,0,1):
            for j in (-1,0,1):
                for k in (-1,0,1):
                    T = np.array([i,j,k], float) * L_PER
                    for el, pos in atoms:
                        c = np.array(pos) + T
                        if np.any(np.abs(c) > L_PER/2 + 7.5): continue
                        n_sit += 1
                        d = np.linalg.norm(pts - c[None,:], axis=1)
                        rr, pr = profs[el]
                        rho_pro += np.interp(d, rr, pr, right=0.0)
        print(f"  {n_sit} sitios", flush=True)
        fields = {
            'bond': (rho - rho_pro).reshape(NV,NV,NV).astype(np.float32),
            'spin': (ra - rb).reshape(NV,NV,NV).astype(np.float32),
        }
        # dopado vs puro (el HUECO del boro = Δρ negativa donde falta el e⁻)
        if dop_ref:
            el_ref, ref_builder = dop_ref
            print("  referencia pura (para Δρ del dopante)…", flush=True)
            atoms_p, cell_p = ref_builder()
            sc_p, mf_p = scf_cell(atoms_p, cell_p, 0, smear)
            if getattr(mf_p, 'converged', False):
                ra_p, rb_p = dens_on(sc_p, mf_p, pts)
                fields['don'] = (rho - (ra_p+rb_p)).reshape(NV,NV,NV).astype(np.float32)
                print("  Δρ dopante ✓", flush=True)
        np.savez_compressed(npz, L=L_PER, **fields)
        for k, f in fields.items():
            print(f"  {k}: {f.min():+.5f} .. {f.max():+.5f}", flush=True)
        hoja_contacto(name, fields, L_PER)
        print(f"  ✓ {npz} + hoja de contacto", flush=True)
    except Exception:
        print(f"  ✗ FALLÓ {name}:", flush=True)
        traceback.print_exc()
        continue

print("\nFARM_LISTA", flush=True)
