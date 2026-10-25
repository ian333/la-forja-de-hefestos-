#!/usr/bin/env python3
"""LA PELÍCULA DEL CAMINO — monta los cuadros filmados por La Forja (60 fps, 4K) con la voz de Matilda anclada a sus tomas.
Nada se edita: la imagen es la de la app. Solo se suma la voz, los subtítulos (con la tipografía de la piel) y, si la última frase
termina después del último cuadro, se sostiene ese cuadro.
uso: python3 scripts/monta-pelicula.py <dir_filmacion> <dir_voz_trabajo> <salida_sin_extension>
     GUION=scripts/guiones/pelicula-camino.json (default) · la voz: <dir_voz_trabajo>/voz/peli_lNN.wav (narracion-gen.py) · fuentes en <dir_voz_trabajo>/fuentes
     el subtítulo vive en su carril: caja de vidrio al 75 %, abajo al centro (y 1680–1860 a 4K), fijo — nunca brinca (crítica 2026-10-23)"""
import json, os, subprocess, sys, wave

FILM, W, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
T = json.load(open(os.path.join(FILM, 'tomas.json')))
G = json.load(open(os.environ.get('GUION', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'guiones', 'pelicula-camino.json'))))
FPS = T['fps']
n = len(os.listdir(os.path.join(FILM, 'cuadros')))
dur_film = n / FPS
FONTDIR = os.path.join(W, 'fuentes')

def dur(p):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout.strip())

pistas, subs, t_fin = [], [], 0.0
for k, g in enumerate(G):
    toma = next((t for t in T['tomas'] if t['nombre'].startswith(g['toma'])), None)
    if not toma: print('⚠ sin toma para', g['toma']); continue
    t0 = toma['desde'] + g['en']
    wav = os.path.join(W, 'voz', f'peli_l{k + 1:02d}.wav'); d = dur(wav)
    if pistas and t0 < pistas[-1][2]: t0 = pistas[-1][2] + 0.25          # nunca se enciman dos frases
    pistas.append((t0, wav, t0 + d)); subs.append((t0, t0 + d + 0.3, g['sub'])); t_fin = max(t_fin, t0 + d)
    print(f'{t0:6.2f}–{t0 + d:6.2f} s  [{toma["nombre"]}]  {g["sub"]}')
total = max(dur_film, t_fin + 1.2)
hold = total - dur_film
print(f'película {dur_film:.1f} s · voz termina en {t_fin:.1f} s · sostener último cuadro {hold:.1f} s')

SR = 24000
buf = bytearray(int((total + 1) * SR) * 2)
for (t0, wav, _) in pistas:
    with wave.open(wav) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, wav
        pcm = w.readframes(w.getnframes())
    o = int(t0 * SR) * 2; buf[o:o + len(pcm)] = pcm[: max(0, len(buf) - o)]
voz = os.path.join(W, 'voz-pelicula.wav')
with wave.open(voz, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(buf))

def ts(x):
    return f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}'
# subtítulos a 4K con la piel: Barlow semibold, caja de vidrio azul marino, abajo al centro (sobre la tira de lentes)
ass = ['[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 3840', 'PlayResY: 2160', '', '[V4+ Styles]',
       'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
       'Style: S,Barlow SemiBold,92,&H00F6F1E6,&H00F6F1E6,&H400B0703,&H400B0703,0,0,0,0,100,100,0,0,3,26,0,2,420,420,300,1', '',
       '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
for (a, b, txt) in subs:
    ass.append(f'Dialogue: 0,{ts(a)},{ts(b)},S,,0,0,0,,{txt}')
open(os.path.join(W, 'subs-pelicula.ass'), 'w').write('\n'.join(ass) + '\n')

entrada = ['-framerate', str(FPS), '-i', os.path.join(FILM, 'cuadros', '%06d.jpg')]
vf_hold = f'tpad=stop_mode=clone:stop_duration={hold:.3f}' if hold > 0.01 else 'null'
subtit = f"subtitles={os.path.join(W, 'subs-pelicula.ass')}:fontsdir={FONTDIR}"
# entrega: H.264 4K60 con subtítulos y voz · master: HEVC 10-bit 4K60 sin subtítulos (para re-editar)
subprocess.run(['ffmpeg', '-v', 'error', '-y', *entrada, '-i', voz, '-vf', f'{vf_hold},{subtit},format=yuv420p', '-r', str(FPS),
                '-c:v', 'h264_nvenc', '-preset', 'p6', '-cq', '19', '-c:a', 'aac', '-b:a', '192k', '-t', f'{total:.3f}', OUT + '-4k60.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', *entrada, '-i', voz, '-vf', f'{vf_hold},format=yuv420p10le', '-r', str(FPS),
                '-c:v', 'hevc_nvenc', '-preset', 'p6', '-cq', '17', '-tag:v', 'hvc1', '-c:a', 'aac', '-b:a', '192k', '-t', f'{total:.3f}', OUT + '-master-10bit.mp4'], check=True)
print('LISTO', OUT, f'{total:.1f} s')
