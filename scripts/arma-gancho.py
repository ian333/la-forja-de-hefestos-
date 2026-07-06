#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
arma-gancho.py — COLD-OPEN cutter (ffmpeg, NVENC, sin GPU-render, sin re-build).

Toma un video YA renderizado y le antepone su CUADRO-PICO (el momento de mayor
fuerza de gancho, leído de peaks.json) como apertura en frío:

    [ ~0.9s del PICO ]  --corte seco--  [ video COMPLETO original ]

Por qué: el detector probó que casi todos los videos abren con campo-estelar
VACÍO; el objeto (núcleo / hélice) llega a los ~10s, DESPUÉS de la ventana de
captura (~150 ms). El cold-open pone ese clímax en el cuadro 0 -> el ojo
(vía magnocelular: movimiento + contraste) engancha en el primer instante, y
el "pico al inicio + pico otra vez en su lugar" = dispara el instinto 2 veces
(lazo abierto / Zeigarnik), justo lo que hacen los reels que retienen.

UN solo comando ffmpeg por video (concat FILTER, sin temporales), audio incluido,
encode NVENC h264 (instantáneo en 4K). NO re-renderiza la escena 3D.

Uso:
  python3 scripts/arma-gancho.py --peaks _hoy_peaks/peaks.json \
      --src-root dist-video --out dist-video/HOY --hook 0.9
  # o un solo video:
  python3 scripts/arma-gancho.py --video dist-video/all-118/018-Ar.mp4 \
      --peak 10.42 --out dist-video/HOY
"""
import argparse
import json
import os
import subprocess
import sys


def strongest_peak(rec):
    """Pico de mayor z (no el primero en el tiempo)."""
    if not rec.get("peaks"):
        return None
    return max(rec["peaks"], key=lambda x: x["z"])["t"]


def _run(cmd, timeout):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except Exception as e:
        return False, f"excepción: {e}"
    if r.returncode != 0:
        tail = r.stderr.strip().splitlines()[-1] if r.stderr else "ffmpeg falló"
        return False, tail
    return True, "ok"


def cold_open(src, out_path, peak_t, hook_len, encoder, crf, fade, tmpdir):
    """[hook centrado en peak_t]  +  [video COMPLETO original].

    Método en 2 pasos (rápido y robusto, NO re-codifica el cuerpo 4K):
      1) extrae SOLO el hook (~0.9s) re-codificado a NVENC, alineando timebase
         y fps al original para que el concat por demuxer empate sin glitch.
      2) concatena hook + original con `-c copy` (stream copy = instantáneo,
         sin pérdida, sin segundo decode del 4K completo).

    El cuelgue anterior venía de usar [0:v] dos veces en filter_complex, que
    obliga a decodificar y re-encodear los 22s de 4K. Esto lo evita."""
    half = hook_len / 2.0
    h0 = max(0.0, peak_t - half)

    # timebase/fps del original -> el hook debe empatar para concat -c copy
    dims = _probe(src)
    if dims is None:
        return False, "ffprobe falló"
    fps, vts, acodec, asr = dims

    if encoder == "h264_nvenc":
        venc = ["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr",
                "-cq", str(crf), "-b:v", "0", "-pix_fmt", "yuv420p"]
    else:
        venc = ["-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
                "-pix_fmt", "yuv420p"]
    fade_v = ["-vf", f"fade=t=in:st=0:d={fade}"] if fade > 0 else []

    hook = os.path.join(tmpdir, f"_hook_{os.getpid()}_{abs(hash(out_path))%99999}.mp4")
    # -ss antes de -i = seek rápido por keyframe; -t limita a hook_len
    cmd1 = ["ffmpeg", "-y", "-v", "error", "-ss", f"{h0:.3f}", "-t",
            f"{hook_len:.3f}", "-i", src, *fade_v, *venc,
            "-r", str(fps), "-video_track_timescale", str(vts),
            "-c:a", "aac", "-b:a", "192k", "-ar", str(asr), hook]
    ok, msg = _run(cmd1, 180)
    if not ok:
        return False, f"hook: {msg}"

    listf = os.path.join(tmpdir, f"_cc_{os.getpid()}_{abs(hash(out_path))%99999}.txt")
    with open(listf, "w") as f:
        f.write(f"file '{os.path.abspath(hook)}'\n")
        f.write(f"file '{os.path.abspath(src)}'\n")
    cmd2 = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
            "-i", listf, "-c", "copy", "-movflags", "+faststart", out_path]
    ok, msg = _run(cmd2, 120)
    for tmp in (hook, listf):
        try:
            os.remove(tmp)
        except OSError:
            pass
    if not ok:
        return False, f"concat: {msg}"
    return True, "ok"


def _probe(src):
    """(fps_int, video_track_timescale, audio_codec, audio_sr) del original."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate,time_base",
             "-of", "default=noprint_wrappers=1:nokey=1", src],
            capture_output=True, text=True, timeout=30)
        lines = r.stdout.strip().splitlines()
        rate = lines[0] if lines else "30/1"
        num, den = rate.split("/")
        fps = int(round(float(num) / float(den))) if float(den) else 30
        # timescale = denominador del time_base (p.ej. 1/15360 -> 15360)
        tb = lines[1] if len(lines) > 1 else "1/15360"
        vts = int(tb.split("/")[1]) if "/" in tb else 15360
        ra = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a:0",
             "-show_entries", "stream=codec_name,sample_rate",
             "-of", "default=noprint_wrappers=1:nokey=1", src],
            capture_output=True, text=True, timeout=30)
        al = ra.stdout.strip().splitlines()
        acodec = al[0] if al else "aac"
        asr = int(al[1]) if len(al) > 1 else 48000
        return fps, vts, acodec, asr
    except Exception:
        return None



def pick_encoder():
    try:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"],
                             capture_output=True, text=True, timeout=30)
        return "h264_nvenc" if "h264_nvenc" in out.stdout else "libx264"
    except Exception:
        return "libx264"


def main():
    ap = argparse.ArgumentParser(description="Cold-open cutter (gancho al inicio).")
    ap.add_argument("--peaks", help="peaks.json del detector (lote)")
    ap.add_argument("--src-root", default="dist-video",
                    help="raíz donde resolver el campo 'path'/'name' del peaks.json")
    ap.add_argument("--video", help="un solo video (en vez de --peaks)")
    ap.add_argument("--peak", type=float, help="segundo del pico (con --video)")
    ap.add_argument("--out", default="dist-video/HOY")
    ap.add_argument("--hook", type=float, default=0.9, help="duración del cold-open (s)")
    ap.add_argument("--fade", type=float, default=0.0,
                    help="fade-in del hook en s (0 = corte seco, recomendado)")
    ap.add_argument("--crf", type=int, default=19)
    ap.add_argument("--suffix", default="-hook", help="sufijo del archivo de salida")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    enc = pick_encoder()
    print(f"[gancho] encoder = {enc} · hook = {args.hook}s · "
          f"{'fade '+str(args.fade)+'s' if args.fade else 'corte seco'}\n")

    jobs = []
    if args.video:
        if args.peak is None:
            print("Con --video debes dar --peak <segundos>", file=sys.stderr)
            sys.exit(2)
        jobs.append((args.video, args.peak))
    elif args.peaks:
        with open(args.peaks) as f:
            data = json.load(f)
        for rec in data:
            src = rec.get("path") or os.path.join(args.src_root, rec["name"])
            pt = strongest_peak(rec)
            if pt is None or not os.path.exists(src):
                print(f"  [skip] {rec.get('name')} (sin pico o sin archivo)")
                continue
            jobs.append((src, pt))
    else:
        print("Da --peaks <json> o --video <mp4> --peak <s>", file=sys.stderr)
        sys.exit(2)

    if args.limit > 0:
        jobs = jobs[: args.limit]

    tmpdir = args.out
    ok = 0
    for i, (src, pt) in enumerate(jobs, 1):
        stem = os.path.splitext(os.path.basename(src))[0]
        out_path = os.path.join(args.out, f"{stem}{args.suffix}.mp4")
        sys.stdout.write(f"  [{i}/{len(jobs)}] {stem:22} pico {pt:6.2f}s -> ")
        sys.stdout.flush()
        good, msg = cold_open(src, out_path, pt, args.hook, enc, args.crf,
                              args.fade, tmpdir)
        print("✓" if good else f"✗ {msg}")
        ok += int(good)
    print(f"\n  {ok}/{len(jobs)} listos en {args.out}")


if __name__ == "__main__":
    main()
