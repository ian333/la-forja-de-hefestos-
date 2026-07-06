#!/usr/bin/env python3
"""
intro-rotate.py — Genera la intro "Gira tu teléfono" (9:16) para IG/TikTok: un
ícono de teléfono que rota de vertical a horizontal + flecha curva + texto. Saca
frames PNG que ffmpeg encodea y concatena antes del comercial (rotado 90° para
llenar el 9:16). Resolución parametrizable (1080x1920 o 2160x3840 = 4K vertical).

uso: intro-rotate.py <dir_frames> [dur_s] [fps] [W] [H]
"""
import sys, os, math
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1]
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 2.6
FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 30
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
H = int(sys.argv[5]) if len(sys.argv) > 5 else 1920
SC = W / 1080.0                      # escala respecto al diseño base 1080
N = int(FPS * DUR)
os.makedirs(OUT, exist_ok=True)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font_big = ImageFont.truetype(FONT, int(64 * SC))
font_sm = ImageFont.truetype(FONT, int(38 * SC))

def px(v): return int(round(v * SC))

def make_phone(aa=3):
    s = aa
    pw, ph = int(300 * SC * s), int(580 * SC * s)
    pad = int(70 * SC * s)
    layer = Image.new("RGBA", (pw + 2 * pad, ph + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = pad, pad, pad + pw, pad + ph
    col = (255, 255, 255, 255)
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(58 * SC * s), outline=col, width=int(15 * SC * s))
    cx = (x0 + x1) / 2
    sw = int(80 * SC * s)
    d.rounded_rectangle([cx - sw / 2, y0 + 34 * SC * s, cx + sw / 2, y0 + 34 * SC * s + 12 * SC * s],
                        radius=int(8 * SC * s), fill=col)
    cr = int(9 * SC * s)
    d.ellipse([cx - cr, y0 + 72 * SC * s - cr, cx + cr, y0 + 72 * SC * s + cr], fill=col)
    hw = int(130 * SC * s)
    d.rounded_rectangle([cx - hw / 2, y1 - 42 * SC * s, cx + hw / 2, y1 - 42 * SC * s + 12 * SC * s],
                        radius=int(8 * SC * s), fill=col)
    return layer.resize((layer.width // s, layer.height // s), Image.LANCZOS)

PHONE = make_phone()

def ease(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

def draw_arc_arrow(d, cx, cy, r):
    col = (120, 170, 255)
    d.arc([cx - r, cy - r, cx + r, cy + r], start=210, end=345, fill=col, width=px(10))
    a = math.radians(345); ex, ey = cx + r * math.cos(a), cy + r * math.sin(a); s = px(22)
    d.polygon([(ex + s, ey - 2), (ex - s * 0.5, ey - s), (ex - s * 0.3, ey + s)], fill=col)

def ctext(d, txt, y, font, fill=(255, 255, 255)):
    bb = d.textbbox((0, 0), txt, font=font); tw = bb[2] - bb[0]
    d.text(((W - tw) // 2, y), txt, font=font, fill=fill)

for i in range(N):
    t = i / FPS
    img = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W // 2, int(H * 0.40)
    draw_arc_arrow(d, cx, cy, px(240))
    if t < 0.5: ang = 0.0
    elif t < 1.6: ang = 90.0 * ease((t - 0.5) / 1.1)
    else: ang = 90.0
    ph = PHONE.rotate(-ang, expand=True, resample=Image.BICUBIC)
    img.paste(ph, (cx - ph.width // 2, cy - ph.height // 2), ph)
    ctext(d, "Gira tu teléfono", int(H * 0.58), font_big)
    ctext(d, "mejor en horizontal", int(H * 0.58) + px(88), font_sm, (175, 175, 182))
    img.save(os.path.join(OUT, f"f{i:04d}.png"))
print(f"[intro] {N} frames @ {FPS}fps ({DUR}s) {W}x{H} -> {OUT}")
