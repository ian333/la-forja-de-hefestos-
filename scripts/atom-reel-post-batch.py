#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-reel-post-batch.py — POST de los reels de átomo (corre en iangpu, donde
viven los renders 4K). Para cada átomo en atom-reorderings.json:
  1) VERIFICA que el render 4K decodifique completo (detecta la juntura NAL rota
     del outro concatenado con -c copy). Si falla → lo lista para re-render limpio.
  2) reordena la narración a gancho-primero (atom-audio-reorder.py).
  3) ensambla el reel 4K final (atom-reel-final.py): subs masterclass + audio.

  python3 scripts/atom-reel-post-batch.py            # los 20
  python3 scripts/atom-reel-post-batch.py 02-helio   # filtra por aid
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORD = os.path.join(ROOT, "scripts", "voice-gaia", "atom-reorderings.json")
RENDERS = os.path.join(ROOT, "dist-video", "atoms-vertical")
AUDIO = os.path.join(ROOT, "public", "audio", "tabla-periodica")
OUT = os.path.join(ROOT, "dist-video", "atom-reels")
os.makedirs(OUT, exist_ok=True)

# narraciones por id
_DB = {}
for f in ["01-30", "31-60", "61-90", "91-118"]:
    d = json.load(open(os.path.join(ROOT, "scripts/voice-gaia", f"script-tabla-periodica-{f}.json")))
    for s in d["scenes"]:
        _DB[s["id"]] = s["text"]


def decodes_ok(p):
    """True si el video decodifica completo sin error (juntura NAL sana)."""
    if not os.path.exists(p):
        return False
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "null", "-"],
                       capture_output=True, text=True)
    return r.returncode == 0 and "NAL" not in r.stderr and "Invalid data" not in r.stderr


def main():
    arr = json.load(open(ORD))
    only = set(sys.argv[1:])
    if only:
        arr = [a for a in arr if a["aid"] in only]
    bad, ok = [], 0
    for a in arr:
        aid = a["aid"]; z = int(aid.split("-")[0]); order = a["order"]
        render = os.path.join(RENDERS, f"atom-{z:03d}.mp4")
        if not decodes_ok(render):
            print(f"  ⚠ {aid}: render ausente o juntura rota → RE-RENDER")
            bad.append(z); continue
        text = _DB[aid]
        tmp = tempfile.mkdtemp()
        reel_mp3 = os.path.join(tmp, "reel.mp3"); reel_txt = os.path.join(tmp, "reel.txt")
        r = subprocess.run(["python3", os.path.join(ROOT, "scripts", "atom-audio-reorder.py"),
            "--mp3", os.path.join(AUDIO, f"{aid}.mp3"), "--text", text,
            "--order", ",".join(str(i) for i in order),
            "--out", reel_mp3, "--outtext", reel_txt, "--gap", "0.30"],
            capture_output=True, text=True)
        if r.returncode != 0:
            print(f"  ✗ {aid}: reorder audio falló\n{r.stderr[-200:]}"); bad.append(z); continue
        out = os.path.join(OUT, f"reel-{z:03d}.mp4")
        rr = subprocess.run(["python3", os.path.join(ROOT, "scripts", "atom-reel-final.py"),
            "--video", render, "--mp3", reel_mp3, "--text", open(reel_txt).read(),
            "--out", out, "--w", "2160", "--h", "3840"],
            capture_output=True, text=True)
        if rr.returncode != 0:
            print(f"  ✗ {aid}: ensamble falló\n{rr.stderr[-300:]}"); continue
        print(rr.stdout.strip() + f"   [{aid}]")
        ok += 1
    print(f"\n{ok}/{len(arr)} reels en {OUT}")
    if bad:
        print(f"RE-RENDER (juntura rota): ZS=\"{' '.join(str(z) for z in sorted(set(bad)))}\"")


if __name__ == "__main__":
    main()
