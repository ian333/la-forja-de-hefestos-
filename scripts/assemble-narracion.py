#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
assemble-narracion.py — une las frases (wav por linea) en un audio con aire + fades
suaves (sin cortes), y escribe segs.json ({text,start,end}) para los subtitulos.
Parametrizado por molecula (parte del proceso ordenado de la serie de enlaces).

Lee:  dist-video/<mol>-narracion/<mol>_l01.wav ...   +   scripts/guiones/<mol>.txt
Sale: dist-video/<mol>-narracion/<mol>-narracion.mp3  +  .../segs.json

Uso:  python3 scripts/assemble-narracion.py <mol> [--gap 0.40] [--lead 0.40]
"""
import subprocess, json, os, sys, glob

MOL = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'n2').lower()
def _opt(name, d):
    return float(sys.argv[sys.argv.index(name) + 1]) if name in sys.argv else d
GAP = _opt('--gap', 0.40)
LEAD = _opt('--lead', 0.40)
# PAUSAS DRAMÁTICAS declaradas (2026-09-10, econ-colchon): `--pausa 6:7.0` = después de la línea 6
# (1-based) se dejan 7.0 s de silencio ADEMÁS del gap. Nace con «Mira.» + 7 s de reloj sin voz: la
# toma larga que el canon pide poner en la escena, no en la puntuación — pero el silencio tiene que
# existir en el AUDIO para que segs.json y los subtítulos lo respeten. Varias: "6:7.0,9:1.5".
PAUSAS = {}
if '--pausa' in sys.argv:
    for par in sys.argv[sys.argv.index('--pausa') + 1].split(','):
        n, s = par.split(':'); PAUSAS[int(n)] = float(s)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAR = os.path.join(ROOT, 'dist-video', f'{MOL}-narracion')
GUION = os.path.join(ROOT, 'scripts', 'guiones', f'{MOL}.txt')
lines = [l.strip() for l in open(GUION, encoding='utf-8') if l.strip()]
wavs = sorted(glob.glob(os.path.join(NAR, f'{MOL}_l*.wav')))
assert len(wavs) == len(lines), f"wavs({len(wavs)}) != lineas({len(lines)})"


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                          '-of', 'default=nk=1:nw=1', f]).decode().strip())


segs, t, inputs, filt = [], LEAD, [], []
for i, (w, text) in enumerate(zip(wavs, lines)):
    d = dur(w)
    segs.append({'text': text, 'start': round(t, 3), 'end': round(t + d, 3)})
    inputs += ['-i', w]
    extra = PAUSAS.get(i + 1, 0.0)
    filt.append(f'[{i}]afade=t=in:st=0:d=0.035,afade=t=out:st={max(0,d-0.10):.3f}:d=0.10,apad=pad_dur={GAP + extra:.3f}[a{i}]')
    t += d + GAP + extra

concat = ''.join(f'[a{i}]' for i in range(len(wavs)))
ms = int(LEAD * 1000)
filt_all = ';'.join(filt) + f';{concat}concat=n={len(wavs)}:v=0:a=1[cat];[cat]adelay={ms}|{ms}[out]'
out_mp3 = os.path.join(NAR, f'{MOL}-narracion.mp3')
subprocess.run(['ffmpeg', '-y'] + inputs + ['-filter_complex', filt_all, '-map', '[out]',
                '-c:a', 'libmp3lame', '-b:a', '192k', out_mp3], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
json.dump(segs, open(os.path.join(NAR, 'segs.json'), 'w'), ensure_ascii=False, indent=1)
print(f'{MOL}: audio {out_mp3}  ·  total {t:.2f}s  ·  {len(segs)} cues')
