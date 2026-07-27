#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
assemble-offsets.py — coloca cada wav de narración en un TIEMPO ABSOLUTO del
video (beats visuales), no en cadena con gap uniforme (para eso está
assemble-narracion.py). Pensado para cápsulas donde la línea debe caer sobre
su beat: impresión, copia, amanecer…

Uso:
  python3 scripts/assemble-offsets.py <mol> --times "0.5,4.2,9.2,…" \
      [--out ruta.mp3] [--end 30]

Lee dist-video/<mol>-narracion/<mol>_l*.wav (orden = orden de --times),
avisa si una línea pisa a la siguiente o se pasa de --end.
"""
import subprocess, os, sys, glob

MOL = sys.argv[1].lower()
def _opt(name, d=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else d
TIMES = [float(x) for x in _opt('--times').split(',')]
END = float(_opt('--end', '30'))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAR = os.path.join(ROOT, 'dist-video', f'{MOL}-narracion')
OUT = _opt('--out', os.path.join(NAR, f'{MOL}-narracion-beats.mp3'))
wavs = sorted(glob.glob(os.path.join(NAR, f'{MOL}_l*.wav')))
assert len(wavs) == len(TIMES), f"wavs({len(wavs)}) != times({len(TIMES)})"


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                                          'format=duration', '-of', 'default=nk=1:nw=1', f]).decode().strip())


inputs, filt, labels = [], [], []
prev_end = 0.0
for i, (w, t0) in enumerate(zip(wavs, TIMES)):
    d = dur(w)
    if t0 < prev_end:
        print(f'  ⚠ l{i+1:02d} arranca {t0:.2f} pero la anterior acaba {prev_end:.2f} (pisa)')
    prev_end = t0 + d
    ms = int(t0 * 1000)
    inputs += ['-i', w]
    filt.append(f'[{i}]afade=t=in:st=0:d=0.03,afade=t=out:st={max(0, d-0.10):.3f}:d=0.10,'
                f'adelay={ms}|{ms}[a{i}]')
    labels.append(f'[a{i}]')
    print(f'  l{i+1:02d} @{t0:5.2f}s  dur {d:5.2f}s  → acaba {t0+d:5.2f}s')
if prev_end > END - 0.1:
    print(f'  ⚠ la última acaba {prev_end:.2f}s (>{END-0.1:.2f}) — se corta en el encode')

filt_all = ';'.join(filt) + (f';{"".join(labels)}amix=inputs={len(wavs)}:normalize=0[mix];'
                             f'[mix]apad=whole_dur={END}[out]')
subprocess.run(['ffmpeg', '-y', '-v', 'error'] + inputs +
               ['-filter_complex', filt_all, '-map', '[out]', '-t', str(END),
                '-c:a', 'libmp3lame', '-b:a', '192k', OUT], check=True)
print(f'✓ {OUT}')
