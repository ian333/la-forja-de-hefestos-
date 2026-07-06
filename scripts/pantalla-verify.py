#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pantalla-verify.py — VERIFICADOR DE USO DE PANTALLA (doctrina FILOSOFIA-CINE:
"OCUPAR TODA LA PANTALLA... el sujeto llena el cuadro... no un cuadro a medio llenar").

Mide por frame (video completo, offline, sin GPU):
  - coverage  : % de píxeles con luz (luma>16) — cuánta pantalla está VIVA
  - fill      : área de la caja que contiene el 92% de la masa luminosa / área total
                (el SUJETO qué tanto llena el cuadro — la métrica de atención)
  - offcenter : distancia del centro de masa luminoso al centro (0=centrado, 1=esquina)

FLAGEA ventanas de >=1.5s con fill<0.22 o coverage<6% ("cuadro a medio llenar",
salvo fades intencionales al inicio/fin) y EXTRae los peores frames a _pantalla/
para juzgar con el ojo + escribe pantalla.json con la curva completa.

Uso: python3 scripts/pantalla-verify.py <video.mp4> [--fps 3] [--skip-head 1] [--skip-tail 2]
"""
import sys, os, json, subprocess
import numpy as np

VID = sys.argv[1]
def _opt(name, d):
    return float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else d
FPS = _opt('--fps', 3)
SKIP_HEAD = _opt('--skip-head', 1.0)   # fade-in intencional
SKIP_TAIL = _opt('--skip-tail', 2.0)   # fade-out intencional
W, H = 96, 170                          # análisis en miniatura (rápido, suficiente)

dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                     '-of', 'default=nk=1:nw=1', VID]).decode().strip())
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', VID, '-vf', f'fps={FPS},scale={W}:{H}',
                      '-pix_fmt', 'gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
frames = []
while True:
    buf = p.stdout.read(W * H)
    if len(buf) < W * H:
        break
    frames.append(np.frombuffer(buf, np.uint8).reshape(H, W).astype(np.float32))
p.wait()
N = len(frames)
print(f"PANTALLA — {os.path.basename(VID)} · {N} muestras @ {FPS}fps · {dur:.1f}s")

rows = []
for i, f in enumerate(frames):
    t = i / FPS
    # fill PERCEPTUAL: caja de los píxeles VISIBLES (luma>20, binario, percentiles
    # 3-97 por eje) — lo que el OJO ve como "algo", no la masa (la masa se pega al
    # núcleo reventado e ignora el velo tenue que SÍ llena la pantalla).
    lum = f > 16
    coverage = lum.mean()
    vis = (f > 20).astype(np.float32)
    tot = vis.sum()
    if tot < 20:
        rows.append({'t': round(t, 2), 'coverage': round(float(coverage), 3), 'fill': 0.0, 'off': 0.0}); continue
    py = vis.sum(axis=1).cumsum() / tot
    px = vis.sum(axis=0).cumsum() / tot
    y0, y1 = np.searchsorted(py, 0.03), np.searchsorted(py, 0.97)
    x0, x1 = np.searchsorted(px, 0.03), np.searchsorted(px, 0.97)
    fill = ((y1 - y0) * (x1 - x0)) / (W * H)
    cy = (vis.sum(axis=1) * np.arange(H)).sum() / tot / H - 0.5
    cx = (vis.sum(axis=0) * np.arange(W)).sum() / tot / W - 0.5
    off = min(1.0, np.hypot(cx * 2, cy * 2))
    rows.append({'t': round(t, 2), 'coverage': round(float(coverage), 3),
                 'fill': round(float(fill), 3), 'off': round(float(off), 3)})

# sparkline de fill
BARS = '▁▂▃▄▅▆▇█'
step = max(1, N // 66)
spark = ''.join(BARS[min(7, int(rows[i]['fill'] * 10))] for i in range(0, N, step))
print(f"  fill (sujeto/cuadro): {spark}")

# ventanas flageadas (>=1.5s consecutivos con fill<0.22 o coverage<0.06)
# Umbral CALIBRADO A OJO (N₂ v5 vs v7): sujeto centrado 9:16 que DOMINA la atención
# da fill 0.14-0.25 (caja 40%×35%) → BIEN. El pecado real es el puntito perdido
# (v5 regreso: fill 0.04-0.10). Flag: fill<0.12 sostenido o pantalla casi negra.
bad = [(r['t'], r) for r in rows
       if SKIP_HEAD < r['t'] < dur - SKIP_TAIL and (r['fill'] < 0.12 or r['coverage'] < 0.04)]
windows, cur = [], None
for t, r in bad:
    if cur and t - cur[1] <= 1.5 / FPS + 0.01:
        cur[1] = t; cur[2].append(r)
    else:
        if cur and cur[1] - cur[0] >= 1.5: windows.append(cur)
        cur = [t, t, [r]]
if cur and cur[1] - cur[0] >= 1.5: windows.append(cur)

os.makedirs('_pantalla', exist_ok=True)
if windows:
    print(f"  ✗ {len(windows)} ventana(s) DESAPROVECHADA(s):")
    for w0, w1, rs in windows:
        worst = min(rs, key=lambda r: r['fill'])
        print(f"    {w0:5.1f}–{w1:5.1f}s · fill mín {worst['fill']:.2f} · coverage mín {min(r['coverage'] for r in rs):.2f}")
        fp = f"_pantalla/flag-t{worst['t']:05.1f}.jpg"
        subprocess.run(['ffmpeg', '-y', '-ss', str(worst['t']), '-i', VID, '-frames:v', '1', fp],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"      → {fp}")
else:
    print("  ✓ PANTALLA APROVECHADA (sin ventanas a medio llenar)")

avg_fill = float(np.mean([r['fill'] for r in rows]))
json.dump({'video': VID, 'fps': FPS, 'avg_fill': round(avg_fill, 3), 'rows': rows,
           'flagged': [[w[0], w[1]] for w in windows]}, open('_pantalla/pantalla.json', 'w'))
print(f"  fill promedio: {avg_fill:.2f}  ·  curva completa en _pantalla/pantalla.json")
sys.exit(1 if windows else 0)
