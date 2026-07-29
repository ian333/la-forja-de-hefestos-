#!/usr/bin/env python3
"""video-subs.py — SUBTÍTULOS CANÓNICOS DE LA SERIE (única fuente de verdad).

El estilo NO se inventa por video: se calca del ganador `_o2_proof/narracion/o2-phrase-4k.ass`
(O₂/N₂/C₂/H₂O). FRASE completa abajo, Outfit Thin SemiBold, fad+blur. NUNCA karaoke por
palabra ni MAYÚSCULAS a media pantalla (eso rompió "El puente" y hubo que re-ensamblar).
Ver docs/CANON-VIDEO.md (Regla #0 y §subtítulos).

  python3 scripts/video-subs.py <segs.json> <salida.ass> [--w 2160 --h 3840]

9:16 (2160×3840): fuente 96, MarginV 1120   ·   16:9 (3840×2160): fuente 64, MarginV 130
"""
import json, sys, argparse

# Estilo EXACTO de la serie (no tocar sin ver el ASS del último ganador).
ESTILO = {
    "vertical":   {"size": 96, "marginv": 1120},   # 9:16 reels
    "horizontal": {"size": 64, "marginv": 130},    # 16:9 youtube
}

def ts(x):
    h = int(x // 3600); m = int((x % 3600) // 60); s = x % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("segs"); ap.add_argument("out")
    ap.add_argument("--w", type=int, default=2160); ap.add_argument("--h", type=int, default=3840)
    a = ap.parse_args()

    st = ESTILO["vertical" if a.h >= a.w else "horizontal"]
    segs = json.load(open(a.segs))

    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {a.w}
PlayResY: {a.h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: K,Outfit Thin SemiBold,{st['size']},&H00FFFFFF,&H00FFFFFF,&H8C0A0A0A,&H00000000,0,0,0,0,100,100,1.0,0,2,4.0,0,2,120,120,{st['marginv']},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""

    def partir(t, lim=46):
        """Parte en DOS renglones equilibrados si se pasa del límite (gotcha CO: >46 chars
        desborda a 4K). Antes esto solo AVISABA, y el aviso obligaba a escribir el guion
        contra la herramienta — o a entregar un subtítulo desbordado. Se parte por el espacio
        más cercano al centro, que es donde menos se nota el salto."""
        if len(t) <= lim:
            return t
        mid = len(t) // 2
        esp = [i for i, ch in enumerate(t) if ch == ' ']
        if not esp:
            return t
        i = min(esp, key=lambda k: abs(k - mid))
        return t[:i] + r"\N" + t[i + 1:]

    lines = [head]
    largas = []
    for s in segs:
        txt = s["text"].strip()
        if len(txt) > 46:
            largas.append(txt)
        txt = partir(txt)
        lines.append(f"Dialogue: 0,{ts(s['start'])},{ts(s['end'])},K,,0,0,0,,{{\\fad(180,180)\\blur10.0}}{txt}")

    open(a.out, "w").write("\n".join(lines) + "\n")
    print(f"✓ {a.out} — {len(segs)} frases · estilo SERIE {'9:16' if a.h>=a.w else '16:9'} "
          f"(Outfit Thin SemiBold {st['size']}, abajo, MarginV {st['marginv']})")
    for t in largas:
        print(f"  ↩ partida en 2 renglones ({len(t)} chars): {t[:60]}…")

if __name__ == "__main__":
    main()
