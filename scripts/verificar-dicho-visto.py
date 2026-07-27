#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verificar-dicho-visto.py — ¿lo que se DICE tiene que ver con lo que se VE?

El hueco que ningún verificador cubría: `atencion-verify.py` mide la IMAGEN (movimiento,
color, quemado) y `guion-check.py` mide el TEXTO, pero nadie comprobaba la CORRESPONDENCIA.
Ian, 2026-07-27: "lo que se dice no tiene nada que ver con lo que se ve… pon agentes a que
juzguen lo que aparece en pantalla con lo que se dice; si una frase tarda 10 segundos que
revise 20 frames de esos 10 segundos".

Extrae ~2 frames/segundo POR FRASE del guion y arma un manifiesto que los agentes abren con
Read y califican. Salida: dist-video/<id>-dichovisto/ (una carpeta por frase + INDICE.md).

  python3 scripts/verificar-dicho-visto.py <id> [--fps 2] [--fuente video|frames]
"""
import sys, os, json, subprocess, math

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ID = sys.argv[1]
FPS_MUESTRA = float(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else 2.0
FUENTE = sys.argv[sys.argv.index('--fuente') + 1] if '--fuente' in sys.argv else 'video'
VIDEO_OVR = sys.argv[sys.argv.index('--video') + 1] if '--video' in sys.argv else None

man = json.load(open(os.path.join(ROOT, 'videos', f'{ID}.json'), encoding='utf-8'))
adir = os.path.join(ROOT, man['audio']['dir'])
segs = json.load(open(os.path.join(adir, man['audio']['segs']), encoding='utf-8'))
tomas = man.get('tomas', {}).get('lista', [])
video = VIDEO_OVR or os.path.join(man['salida']['dir'], man['salida']['h264'])
FRAMES_DIR = sys.argv[sys.argv.index('--framesdir') + 1] if '--framesdir' in sys.argv else os.path.join(ROOT, man['render']['frames'])
FPS_VIDEO = man['formato']['fps']
SUF = sys.argv[sys.argv.index('--suf') + 1] if '--suf' in sys.argv else ''
OUT = os.path.join(ROOT, 'dist-video', f'{ID}-dichovisto{SUF}')
os.makedirs(OUT, exist_ok=True)

def toma_en(t):
    for e in tomas:
        if e['t'][0] <= t < e['t'][1]:
            return e
    return {'toma': '?', 'muestra': '?'}

print(f"═══ {ID} · {len(segs)} frases · {FPS_MUESTRA} frames/s ═══")
idx = []
for i, s in enumerate(segs, 1):
    dur = s['end'] - s['start']
    n = max(3, min(24, int(round(dur * FPS_MUESTRA))))     # 3..24 frames por frase
    d = os.path.join(OUT, f"f{i:02d}")
    os.makedirs(d, exist_ok=True)
    ts = [s['start'] + dur * (k + 0.5) / n for k in range(n)]
    for k, t in enumerate(ts):
        out = os.path.join(d, f"{k:02d}_t{t:05.1f}.png")
        if os.path.exists(out): continue
        if FUENTE == 'frames':
            # DIRECTO de los PNG del render: sin compresión y sin esperar al ensamble.
            src = os.path.join(FRAMES_DIR, f"{int(round(t * FPS_VIDEO)):05d}.png")
            if os.path.exists(src):
                subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vf', 'scale=520:-1', out], check=False)
        else:
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{t:.2f}', '-i', video,
                            '-frames:v', '1', '-vf', 'scale=520:-1', out], check=False)
    tm = toma_en((s['start'] + s['end']) / 2)
    idx.append({'n': i, 'texto': s['text'], 'ini': round(s['start'], 2), 'fin': round(s['end'], 2),
                'dur': round(dur, 2), 'frames': n, 'carpeta': d, 'toma': tm['toma'], 'debe_mostrar': tm['muestra']})
    print(f"  f{i:02d} [{s['start']:6.2f}-{s['end']:6.2f}] {n:2d} frames · {tm['toma']:18s} · {s['text'][:44]}")

with open(os.path.join(OUT, 'INDICE.md'), 'w', encoding='utf-8') as fp:
    fp.write(f"# {ID} — ¿lo dicho coincide con lo visto?\n\n")
    fp.write("Cada frase trae sus frames (≈2/s). Ábrelos con Read y juzga **si lo que se ve\n"
             "corresponde con lo que se dice**. NO juzgues si es bonito: juzga CORRESPONDENCIA.\n\n")
    for e in idx:
        fp.write(f"## f{e['n']:02d} · {e['ini']}-{e['fin']}s ({e['dur']}s, {e['frames']} frames)\n")
        fp.write(f"- **SE DICE:** «{e['texto']}»\n")
        fp.write(f"- **TOMA:** `{e['toma']}` — debería mostrar: {e['debe_mostrar']}\n")
        fp.write(f"- **FRAMES:** `{e['carpeta']}/`\n\n")
json.dump(idx, open(os.path.join(OUT, 'indice.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
tot = sum(e['frames'] for e in idx)
print(f"\n✓ {tot} frames en {len(idx)} frases → {OUT}")
print(f"  índice: {OUT}/INDICE.md")
