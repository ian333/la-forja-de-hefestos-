#!/usr/bin/env python3
"""
silicio-corte-final.py — narración → timing.json → encode final con voz.

Dos modos:
  timing : mide los wavs de Matilda (dist-video/silicio-corte-narracion/) y
           escribe timing.json — la IMAGEN obedece a la voz (beats desde
           duraciones reales + aire ~0.7 s, doctrina de la serie). Los cortes
           de acto caen en las palabras que los nombran:
             · donor  → a mitad de "vamos a cambiar un solo átomo…"
             · espín  → en "Y aquí está: el electrón libre"
             · regreso→ en "Y con esto… se hace cada chip"
  encode : subtítulos ASS (wrap + estilo de la serie, Inter) + voz (adelay+amix)
           + NVENC hevc10 master y h264 entrega. Frames desde /mnt/e.

Uso (iangpu):  python3 scripts/silicio-corte-final.py timing
               python3 scripts/silicio-corte-final.py encode
"""
import sys, os, json, subprocess, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'dist-video', 'silicio-corte')
NARR = os.path.join(ROOT, 'dist-video', 'silicio-corte-narracion')
FRAMES = '/mnt/e/forja-renders/silicio-corte-frames' if os.path.isdir('/mnt/e') else OUT
TIMING = os.path.join(OUT, 'timing.json')
GUION = os.path.join(ROOT, 'scripts', 'guiones', 'silicio-corte.txt')
FPS = 24
AIR = 0.7          # s entre líneas (narración con aire)
LEAD = 1.3         # s antes de la primera línea
TAIL = 2.6         # s después de la última

def dur(p):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries',
        'format=duration','-of','default=nk=1:nw=1', p]).decode().strip())

MODE = sys.argv[1] if len(sys.argv) > 1 else 'timing'
lines = [l.strip() for l in open(GUION, encoding='utf-8') if l.strip()]
wavs = sorted(glob.glob(os.path.join(NARR, '*.wav')))
assert len(wavs) == len(lines), f"{len(wavs)} wavs vs {len(lines)} líneas"

if MODE == 'timing':
    t = LEAD; L = []
    for w, txt in zip(wavs, lines):
        d = dur(w)
        L.append({'text': txt, 'start': round(t, 2), 'dur': round(d, 2), 'wav': w})
        t += d + AIR
    total = round(t - AIR + TAIL, 2)
    # actos clavados a las palabras (índices 0-based del guion):
    don_at  = round(L[4]['start'] + 0.55 * L[4]['dur'], 2)   # "…cambiar un solo átomo"
    spin_at = round(L[6]['start'] + 0.20, 2)                  # "Y aquí está…"
    loop_at = round(L[8]['start'], 2)                         # "Y con esto…"
    json.dump({'dur': total, 'don_at': don_at, 'spin_at': spin_at,
               'loop_at': loop_at, 'lines': L}, open(TIMING, 'w'), indent=1)
    print(f"DUR={total}s · don@{don_at} · spin@{spin_at} · loop@{loop_at}")
    for l in L: print(f"  {l['start']:6.2f}s +{l['dur']:.2f}  {l['text'][:58]}")
    sys.exit(0)

# ── encode ──
tj = json.load(open(TIMING))
DUR = tj['dur']; L = tj['lines']

def ass_time(s):
    h = int(s//3600); m = int(s%3600//60); ss = s % 60
    return f"{h}:{m:02d}:{ss:05.2f}"

ass = os.path.join('/tmp', 'silicio-corte.ass')
with open(ass, 'w', encoding='utf-8') as f:
    f.write("""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter,52,&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,0,0,0,0,100,100,0,0,1,0,2,2,90,90,470,1
Style: Brand,Inter,110,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-1,0,1,0,3,1,64,64,190,1
Style: BrandSub,Inter,44,&H00FFE87C,&H00FFE87C,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,2,1,66,64,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""")
    f.write(f"Dialogue: 0,{ass_time(2.4)},{ass_time(DUR-0.6)},Brand,,0,0,0,,El silicio\n")
    f.write(f"Dialogue: 0,{ass_time(2.4)},{ass_time(DUR-0.6)},BrandSub,,0,0,0,,dopado · calculado átomo por átomo\n")
    for i, l in enumerate(L):
        t0 = l['start'] - 0.15
        t1 = L[i+1]['start'] - 0.35 if i+1 < len(L) else min(l['start']+l['dur']+1.2, DUR-0.4)
        f.write(f"Dialogue: 0,{ass_time(t0)},{ass_time(t1)},Sub,,0,0,0,,{l['text']}\n")
print(f"✓ {ass}")

# audio: cada wav en su beat (adelay) → mezcla → limiter
ins = ''.join(f"-i {l['wav']} " for l in L)
chains = ''.join(
    f"[{i+1}:a]adelay={int(l['start']*1000)}:all=1,aresample=48000[a{i}];" for i, l in enumerate(L))
mix = ''.join(f"[a{i}]" for i in range(len(L)))
afilt = f"{chains}{mix}amix=inputs={len(L)}:duration=longest:normalize=0,alimiter=limit=0.92,apad=whole_dur={DUR}[voz]"

for codec, px, name in (('hevc_nvenc', 'yuv420p10le', 'silicio-corte-916-4k-hevc10.mp4'),
                        ('h264_nvenc', 'yuv420p', 'silicio-corte-916-4k.mp4')):
    cmd = (f"ffmpeg -v error -framerate {FPS} -i {FRAMES}/f%05d.png {ins}"
           f"-filter_complex \"[0:v]subtitles={ass}[v];{afilt}\" "
           f"-map \"[v]\" -map \"[voz]\" -c:v {codec} -preset p5 -rc vbr -cq 19 -b:v 0 "
           f"-pix_fmt {px} -c:a aac -b:a 192k -t {DUR} -y {OUT}/{name}")
    print(f"→ {name}", flush=True)
    subprocess.run(cmd, shell=True, check=True)
    sz = os.path.getsize(f"{OUT}/{name}")
    print(f"  {sz/1e6:.1f} MB")
print("ENCODE_OK")
