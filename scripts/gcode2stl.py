#!/usr/bin/env python3
"""Reconstruye STL desde G-code (Creality Print / Orca):
perímetros exteriores por capa -> relleno par-impar (preserva barrenos)
-> dilata media línea -> voxel -> marching cubes -> STL binario."""
import re, sys, struct
import numpy as np
from scipy import ndimage
from skimage import measure

GCODE = sys.argv[1]
OUTDIR = sys.argv[2]
RES = 0.1          # mm/px XY
DZ = 0.08          # mm voxel Z
LINE_W = 0.42
HALF_W_PX = 2      # 0.2mm ~ media línea
CLOSE_TOL = 1.2    # mm para cerrar loop
ARC_STEP = 0.15    # mm cuerda máx al teselar G2/G3

BOUNDARY_TYPES = {'Outer wall', 'Overhang wall'}

def tessellate_arc(x0, y0, x1, y1, i, j, cw):
    cx, cy = x0 + i, y0 + j
    r = np.hypot(x0 - cx, y0 - cy)
    a0 = np.arctan2(y0 - cy, x0 - cx)
    a1 = np.arctan2(y1 - cy, x1 - cx)
    if cw:
        if a1 >= a0: a1 -= 2 * np.pi
    else:
        if a1 <= a0: a1 += 2 * np.pi
    n = max(2, int(abs(a1 - a0) * r / ARC_STEP) + 1)
    aa = np.linspace(a0, a1, n)
    return np.column_stack([cx + r * np.cos(aa), cy + r * np.sin(aa)])

# ---------- parse ----------
re_obj_start = re.compile(r'^; printing object .* id:(\d+)')
re_move = re.compile(r'^G([123]) ')
re_word = re.compile(r'([XYZEIJ])(-?[\d.]+)')

loops = {}      # (obj, layer_idx) -> list of Nx2 arrays
zs = []         # z por layer_idx
dropped = 0
cur_obj = None; cur_layer = -1; cur_z = 0.0
x = y = 0.0
boundary = False
poly = []       # puntos del polilinea actual

def flush():
    global poly, dropped
    if len(poly) >= 3:
        p = np.array(poly)
        if np.hypot(*(p[0] - p[-1])) <= CLOSE_TOL:
            key = (cur_obj, cur_layer)
            loops.setdefault(key, []).append(p)
        else:
            dropped += 1
    poly = []

with open(GCODE, errors='ignore') as f:
    for line in f:
        if line.startswith(';'):
            s = line.strip()
            if s.startswith(';TYPE:'):
                new_b = s[6:] in BOUNDARY_TYPES
                if new_b != boundary: flush()
                boundary = new_b
            elif s == ';LAYER_CHANGE':
                flush(); cur_layer += 1
            elif s.startswith(';Z:') and cur_layer >= 0:
                z = float(s[3:])
                if cur_layer == len(zs): zs.append(z)
            elif re_obj_start.match(s):
                flush(); cur_obj = int(re_obj_start.match(s).group(1))
            elif s.startswith('; stop printing object'):
                flush(); cur_obj = None
            continue
        m = re_move.match(line)
        if not m: continue
        w = dict(re_word.findall(line))
        nx = float(w.get('X', x)); ny = float(w.get('Y', y))
        e = float(w.get('E', 0))
        gtype = m.group(1)
        extruding = e > 0 and ('X' in w or 'Y' in w)
        if extruding and boundary and cur_obj is not None and cur_layer >= 0:
            if not poly: poly.append((x, y))
            if gtype in '23' and 'I' in w or 'J' in w and gtype in '23':
                pts = tessellate_arc(x, y, nx, ny,
                                     float(w.get('I', 0)), float(w.get('J', 0)),
                                     gtype == '2')
                poly.extend(map(tuple, pts[1:]))
            else:
                poly.append((nx, ny))
        else:
            if 'X' in w or 'Y' in w: flush()
        x, y = nx, ny
flush()

objs = sorted({k[0] for k in loops})
print(f"objetos: {objs}, capas: {len(zs)}, loops: {sum(len(v) for v in loops.values())}, abiertos descartados: {dropped}")

# ---------- rasteriza + voxel + STL ----------
def fill_layer(polys, x0, y0, nxp, nyp):
    """relleno par-impar scanline de todos los loops juntos"""
    mask = np.zeros((nyp, nxp), bool)
    ex0 = []; ey0 = []; ex1 = []; ey1 = []
    for p in polys:
        q = np.vstack([p, p[:1]])
        ex0.append(q[:-1, 0]); ey0.append(q[:-1, 1])
        ex1.append(q[1:, 0]);  ey1.append(q[1:, 1])
    ex0 = np.concatenate(ex0); ey0 = np.concatenate(ey0)
    ex1 = np.concatenate(ex1); ey1 = np.concatenate(ey1)
    ymin = np.minimum(ey0, ey1); ymax = np.maximum(ey0, ey1)
    r0 = max(0, int(np.floor((ymin.min() - y0) / RES)))
    r1 = min(nyp - 1, int(np.ceil((ymax.max() - y0) / RES)))
    for r in range(r0, r1 + 1):
        yc = y0 + r * RES
        sel = (ymin <= yc) & (yc < ymax)
        if not sel.any(): continue
        t = (yc - ey0[sel]) / (ey1[sel] - ey0[sel])
        xs = np.sort(ex0[sel] + t * (ex1[sel] - ex0[sel]))
        for k in range(0, len(xs) - 1, 2):
            c0 = int(np.ceil((xs[k] - x0) / RES))
            c1 = int(np.floor((xs[k + 1] - x0) / RES))
            if c1 >= c0: mask[r, max(0, c0):min(nxp, c1 + 1)] = True
    return mask

disk = np.zeros((2 * HALF_W_PX + 1,) * 2, bool)
yy, xx = np.mgrid[-HALF_W_PX:HALF_W_PX + 1, -HALF_W_PX:HALF_W_PX + 1]
disk[yy**2 + xx**2 <= HALF_W_PX**2] = True

def write_stl(fn, verts, faces):
    tri = verts[faces]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True); ln[ln == 0] = 1
    n /= ln
    with open(fn, 'wb') as f:
        f.write(b'\0' * 80); f.write(struct.pack('<I', len(faces)))
        rec = np.zeros(len(faces), dtype=[('n', '<3f4'), ('v', '<9f4'), ('a', '<u2')])
        rec['n'] = n; rec['v'] = tri.reshape(-1, 9)
        f.write(rec.tobytes())

zs = np.array(zs)
stats = {}
for ob in objs:
    pts = np.vstack([p for (o, l), v in loops.items() if o == ob for p in v])
    x0, y0 = pts.min(0) - 1.0; x1, y1 = pts.max(0) + 1.0
    nxp = int((x1 - x0) / RES) + 1; nyp = int((y1 - y0) / RES) + 1
    nz = int(np.ceil(zs.max() / DZ))
    vol = np.zeros((nz, nyp, nxp), bool)
    nlay = 0
    for li, ztop in enumerate(zs):
        polys = loops.get((ob, li))
        if not polys: continue
        nlay += 1
        m = fill_layer(polys, x0, y0, nxp, nyp)
        m = ndimage.binary_dilation(m, disk)
        zbot = zs[li - 1] if li > 0 else 0.0
        s0 = int(np.floor(zbot / DZ + 1e-6)); s1 = max(s0 + 1, int(np.round(ztop / DZ)))
        vol[s0:s1] = vol[s0:s1] | m
    vmm3 = vol.sum() * RES * RES * DZ
    volf = ndimage.gaussian_filter(vol.astype(np.float32), sigma=(0.5, 0.8, 0.8))
    volf = np.pad(volf, 1)
    verts, faces, _, _ = measure.marching_cubes(volf, 0.5, spacing=(DZ, RES, RES))
    verts = verts[:, ::-1]  # z,y,x -> x,y,z
    verts[:, 0] += x0 - RES; verts[:, 1] += y0 - RES; verts[:, 2] -= DZ
    fn = f"{OUTDIR}/Body2_id{ob}.stl"
    write_stl(fn, verts, faces)
    zmax = verts[:, 2].max()
    stats[ob] = (vmm3, nlay, zmax, len(faces))
    print(f"obj {ob}: {nlay} capas, vol={vmm3:.0f} mm3, alto={zmax:.2f} mm, "
          f"XY {x1-x0-2:.2f}x{y1-y0-2:.2f}, {len(faces)} tris -> {fn}")
