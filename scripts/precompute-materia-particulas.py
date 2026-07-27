#!/usr/bin/env python3
"""
precompute-materia-particulas.py — TODA la cosecha de la granja → nubes 3D
estilo O₂ (Ian: "hazlos 3d como o2 n2 h2, li2 c2 — ya tienes los cálculos,
así mismo se hizo con o2"). Exacto: el O₂ muestrea sus campos ab initio en
partículas por inverse-CDF con semillas FIJAS y el render solo dibuja.

Para cada .npz de dist-video/materia-farm/ produce
public/precomputed/materia/<name>-particulas.bin (formato de silicio-particulas):
  int32 nAcc, nDep, nSpin · float32 escala
  uint8[nAcc*3] accColor · f32[nAcc*3] accPos · f32[nDep*3] depPos · f32[nSpin*3] spinPos

Nubes por ROL físico (colores EXACTOS del O₂ viral):
  acc  = campo>0 (carga acumulada)  oro→ámbar, top 12% ORO BLANCO (por valor)
  dep  = campo<0 (vaciado)          azul profundo [0.18,0.42,0.95] (en el render)
  spin = densidad de espín>0        violeta [0.80,0.34,1.0] (en el render)
         (si-boro la tiene = EL HUECO; los cerrados van con nSpin=0)

Todo se centra y escala a tamaño estándar (dimensión mayor → 7.2 u) para que
UNA escena genérica los renderice todos por ?sys=<name>.

Uso: python3 scripts/precompute-materia-particulas.py
"""
import os, glob, struct, traceback
import numpy as np

FARM = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'materia-farm')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'materia')
os.makedirs(OUT, exist_ok=True)
SEED = 20260717
N_ACC, N_DEP, N_SPIN = 60000, 40000, 30000
TARGET = 7.2                      # unidades de escena para la dimensión mayor

GOLD  = np.array([1.00, 0.84, 0.36])
AMBER = np.array([1.00, 0.36, 0.10])
WGOLD = np.array([1.00, 0.96, 0.74])

def sample_field(field, U):
    """inverse-CDF 3D encadenado (el método EXACTO del O₂): semillas fijas ⇒
    partículas lagrangianas. Devuelve índices fraccionales (i,j,k)."""
    NX, NY, NZ = field.shape
    f = np.maximum(field, 0.0)
    M = U.shape[0]
    slab = f.sum(axis=(1,2)); Cx = np.concatenate([[0.0], np.cumsum(slab)])
    if Cx[-1] <= 0: return None
    tgt = U[:,0]*Cx[-1]
    ix = np.clip(np.searchsorted(Cx, tgt, side='right')-1, 0, NX-1)
    fx = ix + (tgt-Cx[ix])/np.maximum(Cx[ix+1]-Cx[ix], 1e-30)
    colm = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((NX,1)), np.cumsum(colm, axis=1)], axis=1)
    Cyr = Cy[ix]; tg = U[:,1]*Cyr[:,-1]
    iy = np.clip((Cyr[:,:-1] <= tg[:,None]).sum(axis=1)-1, 0, NY-1)
    c0 = Cyr[np.arange(M),iy]; c1 = Cyr[np.arange(M),iy+1]
    fy = iy + (tg-c0)/np.maximum(c1-c0, 1e-30)
    Cz = np.concatenate([np.zeros((NX,NY,1)), np.cumsum(f, axis=2)], axis=2)
    Czr = Cz[ix, iy]; tgz = U[:,2]*Czr[:,-1]
    iz = np.clip((Czr[:,:-1] <= tgz[:,None]).sum(axis=1)-1, 0, NZ-1)
    z0 = Czr[np.arange(M),iz]; z1 = Czr[np.arange(M),iz+1]
    fz = iz + (tgz-z0)/np.maximum(z1-z0, 1e-30)
    return np.stack([fx, fy, fz], axis=1)

def extents(d, name):
    """(ex, ey, ez) en Å por eje según el tipo de npz."""
    if 'L' in d:                                  # cristal: cubo periódico
        L = float(d['L']); return L, L, L
    if 'ext' in d:                                # cadena: x = ext, y/z = 6.4
        e = d['ext']; return float(e[1]-e[0]), 6.4, 6.4
    if 'span' in d:                               # capacitor: cubo span
        s = float(d['span']); return s, s, s
    return 10.0, 10.0, 10.0

def convert(npz_path):
    name = os.path.basename(npz_path).replace('.npz','').replace('campos-','').replace('-128','')
    out = f'{OUT}/{name}-particulas.bin'
    if os.path.exists(out):
        print(f"[{name}] ✓ ya existe", flush=True); return
    d = np.load(npz_path)
    F = d['bond'] if 'bond' in d else (d['drho2'] if 'drho2' in d else None)
    if F is None:
        print(f"[{name}] sin campo volumétrico — salto", flush=True); return
    SP = d['spin'] if 'spin' in d else None
    ex, ey, ez = extents(d, name)
    NV = F.shape[0]
    rng = np.random.default_rng(SEED)

    def to_scene(idx):
        """índices fraccionales → coords centradas y escaladas (isotrópico)."""
        if idx is None: return np.zeros((0,3), np.float32)
        p = idx / (NV-1) - 0.5                    # [-0.5, 0.5] por eje
        p *= np.array([ex, ey, ez])[None,:]       # Å reales por eje
        p *= TARGET / max(ex, ey, ez)             # escala estándar
        return p.astype(np.float32)

    idx_acc = sample_field(F, rng.random((N_ACC,3)))
    idx_dep = sample_field(-F, rng.random((N_DEP,3)))
    accPos, depPos = to_scene(idx_acc), to_scene(idx_dep)
    spinPos = np.zeros((0,3), np.float32)
    if SP is not None and float(np.abs(SP).max()) > 1e-5:
        spinPos = to_scene(sample_field(SP, rng.random((N_SPIN,3))))
    # color del acc POR VALOR del campo (top 12% = oro blanco; resto oro→ámbar)
    col = np.tile(GOLD, (len(accPos),1))
    if len(accPos):
        ii = np.clip(np.round(idx_acc).astype(int), 0, NV-1)
        val = F[ii[:,0], ii[:,1], ii[:,2]]
        hi = np.percentile(val, 88)
        t = np.clip(val/np.maximum(hi,1e-12), 0, 1)[:,None]
        col = AMBER[None,:]*(1-t) + GOLD[None,:]*t
        col[val >= hi] = WGOLD
    accColor = np.clip(col*255, 0, 255).astype(np.uint8)

    with open(out, 'wb') as f:
        f.write(struct.pack('<iiif', len(accPos), len(depPos), len(spinPos), 1.0))
        f.write(accColor.tobytes())
        f.write(accPos.tobytes()); f.write(depPos.tobytes()); f.write(spinPos.tobytes())
    print(f"[{name}] acc {len(accPos):,} · dep {len(depPos):,} · spin {len(spinPos):,} → {os.path.getsize(out)/1e6:.1f} MB", flush=True)

for npz in sorted(glob.glob(f'{FARM}/*.npz')):
    try: convert(npz)
    except Exception:
        print(f"✗ {os.path.basename(npz)}", flush=True); traceback.print_exc()
# copiar a dist para el server de render
import shutil
dd = OUT.replace('public/precomputed', 'dist/precomputed')
os.makedirs(dd, exist_ok=True)
for b in glob.glob(f'{OUT}/*.bin'): shutil.copy(b, dd)
print("PARTICULAS_LISTAS", flush=True)
