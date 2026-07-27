#!/usr/bin/env python3
"""
verificador-ojo.py — VERIFICADOR v3: el gate que SÍ VE. (2026-07-17)

El dato de Ian que motiva esto: "cuando lo usábamos empezaron a subir los
likes; cuando lo dejamos de usar cayeron en picada. El verificador es el que
debemos mejorar: no ve imágenes, hace análisis de contraste — ¿para qué? Para
excitar el ojo humano, el cerebro lento y el rápido."

Diagnóstico del v2 (probado con el lote MATERIA): el perfil 'empirico' de
detector-gancho premió un cuadro CASI NEGRO (MgO, contraste 0.018, score
+3.80) y reprobó los cuadros más impactantes del lote — Goodhart: los números
sin ojo se dejan engañar, y un perfil calibrado en una serie NO transfiere a
otra. (Ya estaba grabado: "los gates miden ojo, no verdad".)

ARQUITECTURA v3 (patrón critic-eye.cjs — el agente VE):
  1. `strips`: por video extrae la TIRA DE GANCHO (t=0/0.3/0.6/1.0 + 2 cuadros
     de actos) → un PNG horizontal etiquetado + montajes de 5 videos para que
     un agente CON VISIÓN los recorra.
  2. El agente (Claude) mira cada tira y la CALIFICA con la rúbrica de la
     investigación (NEUROCIENCIA-DEL-GANCHO.md — las palancas del cuadro 0-15):
       R1 ESTALLIDO   objeto grande y simple, contraste de LUMINANCIA sobre
                      negro, legible en visión borrosa (vía magnocelular)
       R2 UN-FOCO     UN punto focal que ARDE (jerarquía, no uniformidad)
       R3 ESTRUCTURA  orden nítido que emerge (anillos/mancuernas/red) vs blob
       R4 ANOMALÍA    "¿qué chingados es eso?" — brecha de curiosidad
       R5 MOVIMIENTO  entre los cuadros de la tira SE VE cambio (no estático)
     → escribe veredicto-ojo.json {video: {r1..r5, nota}}
  3. `merge`: score final = 0.65·z(ojo) + 0.35·z(métricas empirico) — el OJO
     manda; los números asisten. Salida: ranking-final.txt + json.

Uso:
  python3 scripts/verificador-ojo.py strips --videos "<glob>" --out <dir>
  (el agente califica → escribe <dir>/veredicto-ojo.json)
  python3 scripts/verificador-ojo.py merge --out <dir> [--gancho <scores.json>]
"""
import sys, os, json, glob, subprocess, argparse
import numpy as np
from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('modo', choices=['strips', 'merge'])
ap.add_argument('--videos', nargs='*', default=[])
ap.add_argument('--out', default='/tmp/verificador-ojo')
ap.add_argument('--gancho', default=None, help='scores.json de detector-gancho (métricas duras)')
A = ap.parse_args()
os.makedirs(A.out, exist_ok=True)

TS = [0.0, 0.3, 0.6, 1.0, 4.0, 8.0]     # gancho (4) + actos (2)

def extrae_tira(video, out_png):
    tmp = []
    for i, t in enumerate(TS):
        f = f'{A.out}/_f{i}.png'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', video,
                        '-frames:v', '1', '-vf', 'scale=200:-2', f], check=False)
        tmp.append(f if os.path.exists(f) else None)
    imgs = [Image.open(f) for f in tmp if f]
    if not imgs: return False
    h = max(im.height for im in imgs)
    strip = Image.new('RGB', (sum(im.width for im in imgs) + 4*len(imgs), h + 26), (8, 8, 8))
    x = 2
    d = ImageDraw.Draw(strip)
    for i, im in enumerate(imgs):
        strip.paste(im, (x, 26))
        d.text((x + 4, 6), f't={TS[i]}s', fill=(200, 200, 160))
        x += im.width + 4
    strip.save(out_png)
    for f in tmp:
        if f and os.path.exists(f): os.remove(f)
    return True

if A.modo == 'strips':
    vids = sorted(sum([glob.glob(g) for g in A.videos], []))
    names = []
    for v in vids:
        n = os.path.basename(v).replace('.mp4', '')
        if extrae_tira(v, f'{A.out}/tira-{n}.png'):
            names.append(n); print(f'✓ tira {n}', flush=True)
    # montajes de 5 tiras (para que el agente los recorra con pocas lecturas)
    tiras = [Image.open(f'{A.out}/tira-{n}.png') for n in names]
    for gi in range(0, len(tiras), 5):
        grupo = tiras[gi:gi+5]
        W = max(t.width for t in grupo)
        H = sum(t.height + 30 for t in grupo)
        m = Image.new('RGB', (W, H), (0, 0, 0))
        d = ImageDraw.Draw(m); y = 0
        for j, t in enumerate(grupo):
            d.text((6, y + 4), names[gi + j], fill=(120, 220, 255))
            m.paste(t, (0, y + 24)); y += t.height + 30
        m.save(f'{A.out}/montaje-{gi//5:02d}.png')
    json.dump(names, open(f'{A.out}/nombres.json', 'w'))
    print(f'{len(names)} tiras · {(len(tiras)+4)//5} montajes en {A.out}')
    print('→ el agente CALIFICA cada tira (R1..R5, 0-10) y escribe veredicto-ojo.json')
    sys.exit(0)

# ── merge: ojo (65%) + métricas duras (35%) ──
ojo = json.load(open(f'{A.out}/veredicto-ojo.json'))
def z(xs):
    xs = np.array(xs, float); s = xs.std() or 1.0
    return (xs - xs.mean()) / s
names = list(ojo.keys())
ojo_tot = [sum(ojo[n][k] for k in ('r1','r2','r3','r4','r5')) for n in names]
zo = z(ojo_tot)
zm = np.zeros(len(names))
if A.gancho and os.path.exists(A.gancho):
    g = json.load(open(A.gancho))
    # formato real de detector-gancho: {weights, window_s, capture_n, videos:[{name, score,…}]}
    vids = g.get('videos', []) if isinstance(g, dict) else g
    gmap = {v['name'].replace('.mp4', ''): v.get('score', 0.0) for v in vids if isinstance(v, dict)}
    zm = z([gmap.get(n, 0.0) for n in names])
final = 0.65*zo + 0.35*zm
orden = np.argsort(-final)
lines = [f"{'#':>3} {'FINAL':>7} {'ojo':>4} {'zmet':>6}  {'R1':>2} {'R2':>2} {'R3':>2} {'R4':>2} {'R5':>2}  nombre"]
res = {}
for r, i in enumerate(orden):
    n = names[i]; o = ojo[n]
    lines.append(f"{r+1:>3} {final[i]:>+7.2f} {ojo_tot[i]:>4} {zm[i]:>+6.2f}  "
                 f"{o['r1']:>2} {o['r2']:>2} {o['r3']:>2} {o['r4']:>2} {o['r5']:>2}  {n}")
    res[n] = {'final': round(float(final[i]), 3), 'ojo': int(ojo_tot[i]), **o}
open(f'{A.out}/ranking-final.txt', 'w').write('\n'.join(lines))
json.dump(res, open(f'{A.out}/ranking-final.json', 'w'), indent=1)
print('\n'.join(lines))
