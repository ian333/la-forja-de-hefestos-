#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-audio-reorder.py — reordena la NARRACIÓN existente de un átomo para poner
el GANCHO primero, SIN gastar TTS. Corta el mp3 en sus frases (en los silencios
inter-oración) y las reensambla en el orden pedido, con aire uniforme entre ellas.

El truco: una narración TTS tiene pausas LARGAS entre oraciones y cortas entre
comas. Tomamos las (N-1) pausas más largas como fronteras de oración → N trozos
de habla limpios (sin la pausa). Reensamblamos según --order con un gap fijo.

  # diagnóstico: ¿cuántas oraciones vs silencios? ¿alineará?
  python3 scripts/atom-audio-reorder.py --mp3 a.mp3 --text "..." --diagnose

  # reorden real:
  python3 scripts/atom-audio-reorder.py --mp3 a.mp3 --text "..." \
     --order 0,1,4,6,7 --out reel.mp3 --outtext reel.txt --gap 0.30
"""
import argparse, os, re, subprocess, sys, tempfile


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def dur(p):
    o = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", p])
    return float(o.stdout.strip())


def split_sentences(text):
    """Divide en oraciones por . ! ? (conserva 'Helio.' como su propia oración)."""
    t = " ".join(text.replace("\n", " ").split())
    # corta tras .!? seguido de espacio + mayúscula/número
    parts = re.split(r'(?<=[.!?])\s+', t)
    return [p.strip() for p in parts if p.strip()]


def detect_silences(p, noise="-30dB", d=0.30):
    """Devuelve lista de (start, end, dur) de cada silencio."""
    o = run(["ffmpeg", "-hide_banner", "-i", p, "-af",
             f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"])
    sils, cur = [], None
    for ln in o.stderr.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", ln)
        if m:
            cur = float(m.group(1))
        m = re.search(r"silence_end: ([\d.]+)", ln)
        if m and cur is not None:
            e = float(m.group(1))
            sils.append((cur, e, e - cur))
            cur = None
    return sils


def sentence_segments(mp3, sents, noise="-30dB", d=0.22):
    """Mapea las oraciones `sents` → un segmento de habla [a,b] limpio cada una.

    Las fronteras de oración NO siempre son las pausas más largas: una oración
    larga con dos puntos o comas puede tener pausas internas tan largas como las
    inter-oración (caso oro). Por eso ALINEAMOS: cada frontera esperada (por
    proporción de caracteres del texto) se empareja con el silencio detectado más
    cercano, en orden y sin reutilizar → robusto ante pausas internas."""
    if isinstance(sents, int):           # compat: si pasan n, sin texto, cae a "más largas"
        sents = None; n_sent = sents_n = None
    total = dur(mp3)
    sils = detect_silences(mp3, noise, d)
    inner = [s for s in sils if s[0] > 0.15 and s[1] < total - 0.15]
    n = len(sents)
    need = n - 1
    if need <= 0:
        return [(0.0, total)], [], total
    if len(inner) < need:
        return None, inner, total
    # posiciones esperadas de frontera (fin de oración i) por proporción de chars
    chars = [max(1, len(s)) for s in sents]
    tot = sum(chars)
    cum = 0.0; expected = []
    for i in range(n - 1):
        cum += chars[i]
        expected.append(total * cum / tot)
    # emparejar cada esperada con el silencio más cercano (monótono, sin repetir)
    mids = [((s[0] + s[1]) / 2.0, s) for s in inner]
    used = [False] * len(mids)
    chosen, last_t = [], 0.0
    for e in expected:
        best, bestd = -1, 1e9
        for j, (mt, s) in enumerate(mids):
            if used[j] or mt <= last_t:
                continue
            dd = abs(mt - e)
            if dd < bestd:
                bestd, best = dd, j
        if best < 0:
            return None, inner, total
        used[best] = True
        chosen.append(mids[best][1])
        last_t = mids[best][0]
    segs, prev_end = [], 0.0
    for (ss, se, _) in chosen:
        segs.append((prev_end, ss))   # habla hasta el inicio de la pausa
        prev_end = se                 # próxima oración arranca al fin de la pausa
    segs.append((prev_end, total))
    return segs, chosen, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mp3", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--order", default="")           # "0,1,4,6,7"
    ap.add_argument("--out", default="")
    ap.add_argument("--outtext", default="")
    ap.add_argument("--gap", type=float, default=0.30)
    ap.add_argument("--noise", default="-30dB")
    ap.add_argument("--sild", type=float, default=0.30)
    ap.add_argument("--diagnose", action="store_true")
    a = ap.parse_args()

    sents = split_sentences(a.text)
    n = len(sents)
    segs, chosen, total = sentence_segments(a.mp3, sents, a.noise, a.sild)

    if a.diagnose:
        print(f"  archivo {os.path.basename(a.mp3)}  total={total:.2f}s  oraciones={n}")
        sils_all = detect_silences(a.mp3, a.noise, a.sild)
        print(f"  silencios detectados (d={a.sild}, noise={a.noise}): {len(sils_all)}")
        if segs is None:
            print(f"  ⚠ FRONTERAS INSUFICIENTES: necesito {n-1}, hay {len(chosen)} internas")
        else:
            for i, (s, e) in enumerate(segs):
                head = sents[i][:54]
                print(f"   [{i}] {s:6.2f}–{e:6.2f}  ({e-s:4.2f}s)  {head}")
        return

    if not a.order or not a.out:
        sys.exit("faltan --order y --out")
    if segs is None:
        sys.exit(f"no alinea: {n-1} fronteras necesarias, {len(chosen)} disponibles")

    order = [int(x) for x in a.order.split(",") if x.strip() != ""]
    tmp = tempfile.mkdtemp()
    pieces = []
    for k, idx in enumerate(order):
        s, e = segs[idx]
        piece = os.path.join(tmp, f"p{k:02d}.wav")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{s:.3f}", "-to", f"{e:.3f}",
             "-i", a.mp3, "-ac", "1", "-ar", "44100", piece])
        pieces.append(piece)

    # concat con gap de silencio entre piezas
    gapf = os.path.join(tmp, "gap.wav")
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-t", f"{a.gap:.3f}",
         "-i", "anullsrc=r=44100:cl=mono", gapf])
    listf = os.path.join(tmp, "list.txt")
    with open(listf, "w") as f:
        for i, p in enumerate(pieces):
            if i:
                f.write(f"file '{gapf}'\n")
            f.write(f"file '{p}'\n")
    out_wav = os.path.join(tmp, "out.wav")
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0",
         "-i", listf, "-c", "copy", out_wav])
    run(["ffmpeg", "-y", "-v", "error", "-i", out_wav,
         "-c:a", "libmp3lame", "-q:a", "2", a.out])

    new_text = " ".join(sents[i] for i in order)
    if a.outtext:
        open(a.outtext, "w").write(new_text)
    print(f"  ✓ {os.path.basename(a.out)}  {dur(a.out):.1f}s  orden={order}")
    print(f"    {new_text[:90]}")


if __name__ == "__main__":
    main()
