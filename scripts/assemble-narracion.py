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
    filt.append(f'[{i}]afade=t=in:st=0:d=0.035,afade=t=out:st={max(0,d-0.10):.3f}:d=0.10,apad=pad_dur={GAP}[a{i}]')
    t += d + GAP

concat = ''.join(f'[a{i}]' for i in range(len(wavs)))
ms = int(LEAD * 1000)
filt_all = ';'.join(filt) + f';{concat}concat=n={len(wavs)}:v=0:a=1[cat];[cat]adelay={ms}|{ms}[out]'
out_mp3 = os.path.join(NAR, f'{MOL}-narracion.mp3')
subprocess.run(['ffmpeg', '-y'] + inputs + ['-filter_complex', filt_all, '-map', '[out]',
                '-c:a', 'libmp3lame', '-b:a', '192k', out_mp3], check=True,
               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
json.dump(segs, open(os.path.join(NAR, 'segs.json'), 'w'), ensure_ascii=False, indent=1)
print(f'{MOL}: audio {out_mp3}  ·  total {t:.2f}s  ·  {len(segs)} cues')
