#!/usr/bin/env python3
"""
previews-materia.py — un PREVIEW en video (10 s, 720×1280, corte viajando) por
cada material/cadena cosechado. Para revisar EN MOVIMIENTO (la mecánica vive del
movimiento; un still no basta).

v2: SIN multiprocessing.Pool. La v1 usaba una función anidada como worker →
`Can't pickle local object 'render_uno.<locals>.frame'` mató TODOS los previews.
A 720p cada frame es barato (~40 ms); 240 frames × 17 sistemas ≈ 3 min en un
hilo, sin riesgo de pickle. Simple y robusto le gana a rápido y roto.
"""
import os, glob, subprocess, traceback
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'materia-farm')
PREV = os.path.join(OUT, 'previews'); os.makedirs(PREV, exist_ok=True)
TMPF = '/tmp/prev-frames'
FPS, DUR = 24, 10
W_PX, H_PX = 720, 1280

hxc = lambda h: [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
stops = [(0.0,hxc('7ce8ff')),(0.22,hxc('1c6a8c')),(0.5,hxc('000000')),
         (0.68,hxc('c8791a')),(0.88,hxc('ffb03a')),(1.0,hxc('fff4d0'))]
xs = np.array([s[0] for s in stops]); cs = np.array([s[1] for s in stops])
LUT = np.stack([np.interp(np.linspace(0,1,512), xs, cs[:,k]) for k in range(3)], 1)

def render_uno(npz_path):
    name = os.path.basename(npz_path).replace('.npz','')
    out_mp4 = f'{PREV}/{name}.mp4'
    if os.path.exists(out_mp4):
        print(f"[{name}] ✓ ya existe", flush=True); return
    d = np.load(npz_path)
    key = 'bond' if 'bond' in d else ('drho2' if 'drho2' in d else None)
    if key is None:
        print(f"[{name}] sin campo — salto", flush=True); return
    F = d[key]; NVr = F.shape[0]
    periodic = 'L' in d
    L = float(d['L']) if periodic else (float(d['span']) if 'span' in d else
        (float(d['ext'][1]-d['ext'][0]) if 'ext' in d else 12.0))
    vmax = np.percentile(np.abs(F), 99.5) or 1
    d1 = np.array([1,1,1.0]); d1/=np.linalg.norm(d1)
    d2 = np.array([1,-1,0.0]); d2/=np.linalg.norm(d2)
    nh = np.cross(d1, d2)
    if name.startswith('cadena-'):    # la cadena vive en x → vertical, corte en z
        d1, d2, nh = np.array([1,0,0.]), np.array([0,1,0.]), np.array([0,0,1.])
    H_A = L * (1.35 if periodic else 0.92)
    W_A = H_A * 9/16
    S = L * (0.28 if periodic else 0.16)
    u = np.linspace(-W_A/2, W_A/2, W_PX); v = np.linspace(H_A/2, -H_A/2, H_PX)
    UU, VV = np.meshgrid(u, v, indexing='xy')
    os.makedirs(TMPF, exist_ok=True)
    for f in glob.glob(f'{TMPF}/*.png'): os.remove(f)
    NFR = FPS*DUR
    for i in range(NFR):
        s = S*np.sin(2*np.pi * i/NFR)
        P = UU[...,None]*d2 + VV[...,None]*d1 + s*nh
        idx = (P + L/2)/L * (NVr if periodic else NVr-1)
        c = map_coordinates(F, [idx[...,0].ravel(), idx[...,1].ravel(), idx[...,2].ravel()],
                            order=1, mode='grid-wrap' if periodic else 'nearest').reshape(H_PX, W_PX)
        tt = np.clip(c/vmax, -1, 1); tt = np.sign(tt)*np.abs(tt)**1.45
        img = LUT[np.clip(((tt*0.5+0.5)*511),0,511).astype(int)]
        Image.fromarray(np.clip(img*255,0,255).astype(np.uint8),'RGB').save(
            f'{TMPF}/f{i:04d}.png', compress_level=1)
    r = subprocess.run(f"ffmpeg -v error -framerate {FPS} -i {TMPF}/f%04d.png "
        f"-c:v h264_nvenc -preset p4 -cq 24 -pix_fmt yuv420p -y {out_mp4}", shell=True)
    print(f"[{name}] {'✓ preview' if r.returncode==0 else '✗ encode falló'}", flush=True)

for npz in sorted(glob.glob(f'{OUT}/*.npz')):
    try: render_uno(npz)
    except Exception:
        print(f"✗ {os.path.basename(npz)}", flush=True); traceback.print_exc()
print("PREVIEWS_LISTOS", flush=True)
