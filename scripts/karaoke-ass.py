#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
karaoke-ass.py — subtítulos KARAOKE palabra-por-palabra estilo TikTok, en ASS.

Lee segmentos {text, start, end} (s) y reparte el tiempo por palabra (ponderado
por nº de caracteres → palabras largas duran más). Agrupa en cues cortos (1-2
palabras) que POPEAN (fade + escala) centrados, fuente premium, coords en
PÍXELES REALES (PlayRes = tamaño del video → sin el lío de escala de libass).

Si hay timing exacto por palabra (ElevenLabs forced-alignment) pásalo como
words=[{w,t,end}] en el JSON y se usa tal cual.

  python3 scripts/karaoke-ass.py segs.json out.ass [--w 1080 --h 1920 --y 1280
     --font "Roboto Black" --size 66 --group 2 --hi 06B6FF]
segs.json = [{"text": "...", "start": 0.4, "end": 6.3}, ...]
"""
import argparse, json, sys

def ass_time(t):
    t = max(0, t)
    h = int(t // 3600); m = int((t % 3600) // 60); s = t % 60
    return f"{h:d}:{m:02d}:{s:05.2f}"

def split_words(text):
    return [w for w in text.replace("\n", " ").split(" ") if w]

def word_times(seg):
    """Devuelve [(w, t0, t1)] repartiendo [start,end] por largo de palabra."""
    ws = split_words(seg["text"])
    if not ws:
        return []
    s, e = float(seg["start"]), float(seg["end"])
    dur = max(0.1, e - s)
    lens = [max(1, len(w)) for w in ws]
    total = sum(lens)
    out, acc = [], s
    for w, ln in zip(ws, lens):
        d = dur * ln / total
        out.append((w, acc, acc + d))
        acc += d
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("segs"); ap.add_argument("out")
    ap.add_argument("--w", type=int, default=1080); ap.add_argument("--h", type=int, default=1920)
    ap.add_argument("--y", type=int, default=1280)
    ap.add_argument("--font", default="Roboto Black"); ap.add_argument("--size", type=int, default=66)
    ap.add_argument("--group", type=int, default=2)   # palabras por cue
    ap.add_argument("--hi", default="06B6FF")          # color highlight RRGGBB (cian)
    ap.add_argument("--spacing", type=float, default=0.5)  # letter-spacing (px) — elegancia
    ap.add_argument("--nocaps", action="store_true")  # respetar mayúsc/minúsc del texto
    # estilo del fondo: border=3 = CAJA suave (no silueta dura); pad = padding/grosor
    ap.add_argument("--border", type=int, default=3)       # 1=outline duro, 3=caja
    ap.add_argument("--pad", type=float, default=8.0)      # padding de la caja (px)
    ap.add_argument("--boxcol", default="&H8C0A0A0A")      # caja: ASS &HAABBGGRR (AA=transp)
    ap.add_argument("--blur", type=float, default=0.0)     # suaviza el borde/sombra (halo suave)
    ap.add_argument("--phrase", action="store_true")       # modo MASTERCLASS: frase completa abajo
    ap.add_argument("--align", type=int, default=5)        # 5=centro, 2=abajo-centro
    ap.add_argument("--marginv", type=int, default=0)      # margen vertical (px) para align=2
    ap.add_argument("--bold", type=int, default=-1)        # -1=bold; 0=usar peso propio (fuentes pre-pesadas)
    a = ap.parse_args()

    segs = json.load(open(a.segs))
    # color ASS = &HAABBGGRR (orden invertido); convertimos RRGGBB
    rr, gg, bb = a.hi[0:2], a.hi[2:4], a.hi[4:6]
    hi = f"&H00{bb}{gg}{rr}".upper()

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {a.w}
PlayResY: {a.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: K,{a.font},{a.size},&H00FFFFFF,&H00FFFFFF,{a.boxcol},&H00000000,{a.bold},0,0,0,100,100,{a.spacing},0,{a.border},{a.pad},0,{a.align},120,120,{a.marginv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = [header]
    # MODO FRASE (masterclass): una cue por segmento, frase completa, abajo,
    # fundido suave, halo difuso (sin caja). Sentence-case (respeta el texto).
    if a.phrase:
        blur = f"\\blur{a.blur}" if a.blur > 0 else "\\blur4"
        for seg in segs:
            t0, t1 = float(seg["start"]), float(seg["end"])
            txt = seg["text"].strip()
            if not a.nocaps:
                txt = txt
            eff = f"{{\\fad(180,180){blur}}}"
            lines.append(f"Dialogue: 0,{ass_time(t0)},{ass_time(t1)},K,,0,0,0,,{eff}{txt}")
        open(a.out, "w").write("\n".join(lines) + "\n")
        print(f"ok (frase): {a.out} ({len(segs)} cues)")
        return
    for seg in segs:
        wt = seg.get("words")
        if wt:
            wt = [(d["w"], float(d["t"]), float(d.get("end", d["t"] + 0.3))) for d in wt]
        else:
            wt = word_times(seg)
        # agrupar en cues de `group` palabras
        for i in range(0, len(wt), a.group):
            grp = wt[i:i + a.group]
            t0 = grp[0][1]
            # cortar un pelín antes del siguiente cue → sin fantasma de palabra anterior
            t1 = max(t0 + 0.12, grp[-1][2] - 0.06)
            # limpia puntuación de los bordes (,.;:¿?¡!"()) para que no salga ",VEZ"
            clean = [w.strip(".,;:¿?¡!\"()") for w, _, _ in grp]
            txt = " ".join(c for c in clean if c)
            if not a.nocaps:
                txt = txt.upper()
            # pop: aparece con fade + escala 118→100, centrado en (w/2, y)
            blur = f"\\blur{a.blur}" if a.blur > 0 else ""
            eff = (f"{{\\an5\\pos({a.w//2},{a.y})\\fad(70,45){blur}"
                   f"\\t(0,120,\\fscx107\\fscy107)\\t(120,210,\\fscx100\\fscy100)}}")
            lines.append(f"Dialogue: 0,{ass_time(t0)},{ass_time(t1)},K,,0,0,0,,{eff}{txt}")
    open(a.out, "w").write("\n".join(lines) + "\n")
    print(f"ok: {a.out} ({sum(len(split_words(s['text'])) for s in segs)} palabras)")

if __name__ == "__main__":
    main()
