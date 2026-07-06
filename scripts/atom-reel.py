#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-reel.py — arma el REEL final de un átomo: recorta su narración al silencio
más cercano al target (corte limpio), genera karaoke (karaoke-ass.py, estilo
caja suave) y lo quema sobre el render con la voz. Cero TTS.

  python3 scripts/atom-reel.py --video render.mp4 --mp3 narr.mp3 \
     --text "Oxígeno. ..." --out reel.mp4 --target 16 [--skiphead 0]
"""
import argparse, json, os, re, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RB = os.path.join(ROOT, "scripts", "fonts")   # Outfit (masterclass) — fontsdir para libass

def dur(p):
    o = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=noprint_wrappers=1:nokey=1", p], capture_output=True, text=True)
    return float(o.stdout.strip())

def silences(p, noise="-32dB", d=0.45):
    o = subprocess.run(["ffmpeg","-hide_banner","-i",p,"-af",
        f"silencedetect=noise={noise}:d={d}","-f","null","-"],
        capture_output=True, text=True)
    starts, ends = [], []
    for ln in o.stderr.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", ln)
        if m: starts.append(float(m.group(1)))
        m = re.search(r"silence_end: ([\d.]+)", ln)
        if m: ends.append(float(m.group(1)))
    return starts, ends

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True); ap.add_argument("--mp3", required=True)
    ap.add_argument("--text", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--target", type=float, default=16.0)
    ap.add_argument("--skiphead", type=float, default=0.0)  # saltar la palabra-nombre seca
    ap.add_argument("--y", type=int, default=1420); ap.add_argument("--size", type=int, default=48)
    a = ap.parse_args()

    full = dur(a.mp3)
    # corte limpio: el silence_start más cercano al target (en [target-4, target+5])
    starts, _ = silences(a.mp3)
    cands = [s for s in starts if a.target - 4 <= s <= a.target + 5]
    cut = min(cands, key=lambda s: abs(s - a.target)) if cands else min(a.target, full)
    cut = min(cut, full)
    # inicio: tras skiphead, alinear al primer fin-de-silencio (arranca en habla)
    start = a.skiphead

    tmp = tempfile.mkdtemp()
    narr = os.path.join(tmp, "narr.mp3")
    subprocess.run(["ffmpeg","-y","-v","error","-ss",f"{start:.2f}","-to",f"{cut:.2f}",
        "-i", a.mp3, "-c","copy", narr], check=True)
    ndur = dur(narr)

    # texto de la ventana: fracción de palabras ∝ duración usada
    words = a.text.replace("\n"," ").split()
    frac = min(1.0, (cut - start) / max(0.1, full))
    win_words = words[:max(1, round(frac * len(words)))]
    # FRASES rodantes estilo masterclass: cortar en límites NATURALES (frase/cláusula),
    # no a 8 palabras secas. Reagrupar a ≤12 palabras por línea y limpiar bordes.
    raw = " ".join(win_words).strip()
    parts = [p.strip() for p in re.split(r'(?<=[.,;:])\s+', raw) if p.strip()]
    chunks, cur = [], []
    for p in parts:
        pw = p.split()
        if cur and len(cur) + len(pw) > 12:
            chunks.append(" ".join(cur)); cur = []
        cur += pw
    if cur:
        chunks.append(" ".join(cur))
    texts = [c.strip(" .,;:¿?¡!\"()").strip() for c in chunks]
    texts = [t for t in texts if t]
    t0s, t1s = 0.45, max(1.2, ndur - 0.35)
    span = t1s - t0s
    total = max(1, sum(len(t.split()) for t in texts))
    segs, acc = [], t0s
    for t in texts:
        d = span * len(t.split()) / total
        segs.append({"text": t, "start": round(acc, 2), "end": round(acc + d - 0.04, 2)})
        acc += d
    segs_p = os.path.join(tmp, "segs.json"); json.dump(segs, open(segs_p,"w"), ensure_ascii=False)

    ass = os.path.join(tmp, "k.ass")
    # estilo MASTERCLASS: Outfit, chico, abajo, frase completa, sombra suave (sin caja)
    # IG/TikTok vertical: más GRANDE y MÁS ARRIBA (el UI tapa el bottom ~25%).
    # marginv 420 ≈ baseline a ~bottom 22% (sobre botones/caption). size 50 legible.
    subprocess.run(["python3", os.path.join(ROOT,"scripts","karaoke-ass.py"),
        segs_p, ass, "--w","1080","--h","1920","--phrase","--font","Outfit Thin SemiBold",
        "--bold","0","--size","48","--align","2","--marginv","560","--border","1",
        "--pad","2","--spacing","1.0","--blur","5"], check=True)

    # quemar subs + mux narración
    subprocess.run(["ffmpeg","-y","-v","error","-i", a.video, "-i", narr,
        "-filter_complex", f"[0:v]subtitles={ass}:fontsdir={RB}[v]",
        "-map","[v]","-map","1:a","-c:v","h264_nvenc","-preset","p5","-cq","20",
        "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart", a.out],
        check=True)
    print(f"  ✓ {os.path.basename(a.out)}  narr {ndur:.1f}s (corte {cut:.1f}s) · {len(win_words)} palabras")

if __name__ == "__main__":
    main()
