#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-reel-batch.py — pull renders de iangpu + arma el reel (atom-reel.py) para
una lista de átomos. Oxígeno (8) se omite: ya tiene su versión reordenada (v8).

  python3 scripts/atom-reel-batch.py            # los 9 default
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IANGPU = "ian@100.65.173.85"
RREPO = "/home/ian/Orkesta/la-forja"
OUT = os.path.join(ROOT, "_reels10"); os.makedirs(OUT, exist_ok=True)
DL = "/mnt/c/Users/sebas/Downloads/reels10"

# (Z, símbolo, id-audio, rango-script). Oxígeno omitido (usa v8).
ATOMS = [
    (1,  "H",  "01-hidrogeno", "01-30"),
    (6,  "C",  "06-carbono",   "01-30"),
    (7,  "N",  "07-nitrogeno", "01-30"),
    (10, "Ne", "10-neon",      "01-30"),
    (14, "Si", "14-silicio",   "01-30"),
    (16, "S",  "16-azufre",    "01-30"),
    (17, "Cl", "17-cloro",     "01-30"),
    (26, "Fe", "26-hierro",    "01-30"),
    (79, "Au", "79-oro",       "61-90"),
]

def text_for(audio_id, rng):
    d = json.load(open(os.path.join(ROOT, "scripts/voice-gaia", f"script-tabla-periodica-{rng}.json")))
    for s in d["scenes"]:
        if s["id"] == audio_id:
            return s["text"]
    raise SystemExit(f"no text for {audio_id}")

def main():
    os.makedirs(DL, exist_ok=True)
    only = set(sys.argv[1:])  # filtra por símbolo: python3 ... H C N Ne Si
    atoms = [a for a in ATOMS if not only or a[1] in only]
    ok = 0
    for z, sym, aid, rng in atoms:
        vid_remote = f"{RREPO}/dist-video/atoms-vertical/atom-{z:03d}-{sym}.mp4"
        vid_local = os.path.join(OUT, f"render-{sym}.mp4")
        # reusar render local si ya existe (re-burn de subs sin re-scp = rápido); SKIPSCP=1 lo fuerza
        if not (os.environ.get("SKIPSCP") and os.path.exists(vid_local)):
            r = subprocess.run(["scp", "-o", "ConnectTimeout=10", f"{IANGPU}:{vid_remote}", vid_local],
                               capture_output=True, text=True)
            if r.returncode != 0 or not os.path.exists(vid_local):
                print(f"  ✗ {sym}: no render ({r.stderr.strip()[:80]})"); continue
        mp3 = os.path.join(ROOT, "public/audio/tabla-periodica", f"{aid}.mp3")
        out = os.path.join(OUT, f"reel-{z:03d}-{sym}.mp4")
        text = text_for(aid, rng)
        rr = subprocess.run(["python3", os.path.join(ROOT, "scripts/atom-reel.py"),
            "--video", vid_local, "--mp3", mp3, "--text", text, "--out", out, "--target", "16"],
            capture_output=True, text=True)
        if rr.returncode != 0:
            print(f"  ✗ {sym}: reel falló\n{rr.stderr[-300:]}"); continue
        print(rr.stdout.strip())
        try:
            subprocess.run(["cp", out, os.path.join(DL, f"reel-{z:03d}-{sym}.mp4")], check=False)
        except Exception:
            pass
        ok += 1
    print(f"\n{ok}/{len(atoms)} reels en {OUT} (+ Downloads/reels10)")

if __name__ == "__main__":
    main()
