#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-reel-final.py — ensambla el reel 4K final: render 4K + audio YA REORDENADO
(gancho-primero, de atom-audio-reorder.py) + subtítulos masterclass quemados,
cronometrados a los segmentos reales del audio reordenado.

El video se mantiene a su largo completo: si el audio (~16s) es más corto que el
render (~19.5s), los últimos segundos quedan en SILENCIO contemplativo (doctrina:
el silencio es recurso dramático → curiosidad → ir a GAIA).

  python3 scripts/atom-reel-final.py --video r.mp4 --mp3 reel.mp3 \
     --text "Helio. ..." --out final.mp4 [--w 2160 --h 3840]
"""
import argparse, importlib.util, json, os, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RB = os.path.join(ROOT, "scripts", "fonts")   # Outfit (masterclass)

spec = importlib.util.spec_from_file_location("aar", os.path.join(ROOT, "scripts", "atom-audio-reorder.py"))
aar = importlib.util.module_from_spec(spec); spec.loader.exec_module(aar)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--mp3", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--w", type=int, default=2160)
    ap.add_argument("--h", type=int, default=3840)
    a = ap.parse_args()

    # escala de subtítulos: valores base a 1080 → ×(w/1080) para 4K real
    sc = a.w / 1080.0
    size = round(48 * sc); marginv = round(560 * sc)
    border = max(1, round(1 * sc)); pad = round(2 * sc); blur = round(5 * sc)

    sents = aar.split_sentences(a.text)
    # cronometrar cada oración a su segmento real en el audio reordenado
    segs, _, total = aar.sentence_segments(a.mp3, sents)
    if segs is None:
        # fallback: repartir uniforme por nº de palabras
        words = [len(s.split()) for s in sents]; tot = sum(words) or 1
        segs, acc = [], 0.0
        for w in words:
            d = total * w / tot; segs.append((acc, acc + d)); acc += d

    # construir cues (frase completa por oración). Fusiona el nombre seco (<0.9s)
    # con la oración-gancho que le sigue para que no parpadee.
    cues = []
    i = 0
    while i < len(sents):
        s0, e0 = segs[i]
        txt = sents[i].strip()
        if (e0 - s0) < 0.9 and i + 1 < len(sents):
            s1, e1 = segs[i + 1]
            cues.append({"text": (txt + " " + sents[i + 1].strip()).strip(), "start": s0, "end": e1})
            i += 2
        else:
            cues.append({"text": txt, "start": s0, "end": e0})
            i += 1
    # pequeño aire: arrancar cue 0.12s antes del habla, cerrar 0.06s antes del fin
    segs_out = []
    for c in cues:
        st = max(0.0, c["start"] - 0.10)
        en = max(st + 0.6, c["end"] - 0.06)
        segs_out.append({"text": c["text"].strip(" .,;:¿?¡!\"()"), "start": round(st, 2), "end": round(en, 2)})

    tmp = tempfile.mkdtemp()
    segs_p = os.path.join(tmp, "segs.json")
    json.dump(segs_out, open(segs_p, "w"), ensure_ascii=False)
    ass = os.path.join(tmp, "k.ass")
    subprocess.run(["python3", os.path.join(ROOT, "scripts", "karaoke-ass.py"),
        segs_p, ass, "--w", str(a.w), "--h", str(a.h), "--phrase",
        "--font", "Outfit Thin SemiBold", "--bold", "0", "--size", str(size),
        "--align", "2", "--marginv", str(marginv), "--border", str(border),
        "--pad", str(pad), "--spacing", "1.0", "--blur", str(blur)], check=True)

    # quemar subs + mux audio reordenado. apad rellena el audio con SILENCIO y
    # -t {vdur} corta EXACTO al largo del VIDEO (incluye outro GAIA + contemplación
    # final): el video manda la duración, la voz acaba y queda cola contemplativa +
    # CTA. (-shortest con apad infinito es frágil; -t es a prueba de balas.)
    vdur = aar.dur(a.video)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a.video, "-i", a.mp3,
        "-filter_complex", f"[0:v]subtitles={ass}:fontsdir={RB}[v];[1:a]apad[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{vdur:.3f}",
        # 10-bit HEVC para preservar el máster 4K/60fps/10-bit al quemar subs.
        "-c:v", "hevc_nvenc", "-preset", "p5", "-profile:v", "main10",
        "-pix_fmt", "yuv420p10le", "-cq", "23",
        "-maxrate", "50M", "-bufsize", "100M", "-spatial_aq", "1",
        "-tag:v", "hvc1", "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart", a.out], check=True)
    print(f"  ✓ {os.path.basename(a.out)}  {aar.dur(a.out):.1f}s (voz {total:.1f}s + cola) · {len(segs_out)} cues")


if __name__ == "__main__":
    main()
