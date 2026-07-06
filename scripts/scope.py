#!/usr/bin/env python3
"""
scope.py — SCOPES estilo DaVinci para juzgar un frame OBJETIVAMENTE (no a ojo).
El ojo de un modelo no detecta saturaciones finas; los NÚMEROS sí. Esta es la
herramienta para ver si el color está REPARTIDO, si los negros son negros, los
blancos blancos, sin aplastar (crush) ni quemar (clip), y si ocupa la pantalla.

  python3 scripts/scope.py <imagen.png|jpg> [imagen2 ...]

Reporta por imagen:
  · HISTOGRAMA de luma (16 bins, barras) — ¿usa todo el rango o se amontona?
  · CLIP blanco  : % de píxeles quemados (luma>=250 y blanco-puro RGB>=252)
  · CRUSH negro  : % de píxeles aplastados (luma<=4)
  · RANGO útil   : percentil 1–99 de luma (¿llega a 0 y a 255 sin amontonar?)
  · OCUPACIÓN    : % del cuadro con contenido (luma>12) — cero void muerto
  · BALANCE RGB  : media por canal (¿tinte? ¿un canal saturado?)
  · FOCO CENTRO  : luma del tercio central vs el cuadro (la atención al centro)
  · VEREDICTO    : repartido / clip / crush / void / centro-débil / tinte
"""
import sys
import numpy as np
from PIL import Image

# umbrales (calibrables): qué cuenta como "demasiado"
CLIP_BAD = 1.2     # % de blanco quemado tolerable antes de marcar SATURADO
CRUSH_BAD = 55.0   # % de negro: arriba de esto es void muerto (no "negros negros")
OCC_LOW = 35.0     # % ocupación mínima deseable (llenar pantalla)


def bar(pct, width=40):
    n = int(round(pct / 100.0 * width))
    return "█" * n + "·" * (width - n)


def clip_zones_pct(luma, block=12, thresh=0.45):
    """% de píxeles quemados que forman ZONAS grandes (nube/objeto = clip MALO),
    descartando los puntos-estrella aislados (blancos OK). Por bloques NxN: un
    bloque cuenta solo si está mayormente quemado; una estrella no llena un bloque."""
    m = (luma >= 248).astype(np.float32)
    h, w = m.shape
    hb, wb = h // block, w // block
    if hb == 0 or wb == 0:
        return float(m.mean() * 100.0)
    mb = m[:hb * block, :wb * block].reshape(hb, block, wb, block).mean(axis=(1, 3))
    return float((mb > thresh).sum() * block * block / (h * w) * 100.0)


def analyze(path):
    try:
        im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    except Exception as e:
        print(f"  ✗ no se pudo abrir {path}: {e}")
        return
    h, w, _ = im.shape
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    luma = 0.2126 * R + 0.7152 * G + 0.0722 * B

    clip_white = (luma >= 250).mean() * 100.0
    clip_pure = ((R >= 252) & (G >= 252) & (B >= 252)).mean() * 100.0
    clip_z = clip_zones_pct(luma)                 # clip de ZONAS (nube/objeto, el malo)
    crush = (luma <= 4).mean() * 100.0
    occ = (luma > 12).mean() * 100.0
    p1, p50, p99 = np.percentile(luma, [1, 50, 99])
    rgb = [float(R.mean()), float(G.mean()), float(B.mean())]

    cy, cx = h // 2, w // 2
    chh, cww = h // 6, w // 6                      # tercio central (1/3 lado → 1/6 a cada lado)
    center = float(luma[cy - chh:cy + chh, cx - cww:cx + cww].mean())
    whole = float(luma.mean())
    focus = center / (whole + 1e-6)                # >1 = centro más brillante (bien)

    # histograma 16 bins
    hist, edges = np.histogram(luma, bins=16, range=(0, 256))
    hp = hist / hist.sum() * 100.0

    print(f"\n=== {path}  ({w}×{h}) ===")
    print(" HISTOGRAMA luma (0→255), % de píxeles por bin:")
    for i in range(16):
        lo = int(edges[i])
        mark = ""
        if i == 0 and hp[i] > CRUSH_BAD:
            mark = "  <- amontonado en NEGRO (void/crush)"
        if i == 15 and hp[i] > CLIP_BAD:
            mark = "  <- amontonado en BLANCO (clip)"
        print(f"  {lo:3d} |{bar(hp[i])}| {hp[i]:5.1f}%{mark}")

    print(f" CLIP total  : {clip_white:5.2f}% (incluye estrellas-OK)")
    print(f" CLIP ZONAS  : {clip_z:5.2f}% (nube/objeto quemado)   {'⚠ SATURA' if clip_z > CLIP_BAD else 'ok'}")
    print(f" CRUSH negro : {crush:5.1f}%   {'⚠ VOID muerto' if crush > CRUSH_BAD else 'ok'}")
    print(f" RANGO útil  : p1={p1:.0f}  med={p50:.0f}  p99={p99:.0f}   {'(usa todo el rango)' if p1 < 8 and p99 > 230 else '(no llega a extremos)'}")
    print(f" OCUPACIÓN   : {occ:5.1f}%   {'⚠ poco lleno' if occ < OCC_LOW else 'ok (lleno)'}")
    print(f" BALANCE RGB : R{rgb[0]:.0f} G{rgb[1]:.0f} B{rgb[2]:.0f}")
    print(f" FOCO centro : {focus:.2f}× el promedio   {'(centro manda ✓)' if focus > 1.05 else '(centro NO destaca ⚠)'}")

    # veredicto (usa clip de ZONAS, no las estrellas)
    v = []
    if clip_z > CLIP_BAD:
        v.append(f"SE SATURA en zonas ({clip_z:.1f}% nube/objeto quemado) → baja brillo de picos / oro más profundo")
    if crush > CRUSH_BAD:
        v.append(f"VOID muerto ({crush:.0f}% negro) → más nube/ocupación")
    if occ < OCC_LOW:
        v.append(f"poco lleno ({occ:.0f}%) → acercar cámara / agrandar nube")
    if focus <= 1.05:
        v.append("centro no destaca → subir el objeto central / bajar bordes")
    mx = max(rgb)
    if mx > 0 and (mx - min(rgb)) / mx > 0.55:
        v.append("tinte fuerte (un canal domina)")
    print(f" VEREDICTO   : {'  •  '.join(v) if v else '✅ repartido, sin saturar, lleno, centro manda'}")


def analyze_short(path, label=None):
    """Una línea por imagen — para mapear un video entero."""
    try:
        im = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    except Exception:
        print(f"  {label or path}: (no abre)"); return
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    luma = 0.2126 * R + 0.7152 * G + 0.0722 * B
    clip = (luma >= 250).mean() * 100.0
    clip_z = clip_zones_pct(luma)
    crush = (luma <= 4).mean() * 100.0
    occ = (luma > 12).mean() * 100.0
    flag = "⚠SATURA-zona" if clip_z > CLIP_BAD else ("·void" if crush > CRUSH_BAD else ("·vacío" if occ < OCC_LOW else "ok"))
    print(f"  {label or path:>10}  clipZONA {clip_z:5.2f}%  (tot {clip:4.1f}%)  crush {crush:4.1f}%  occ {occ:4.0f}%  {flag}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--short"]
    short = "--short" in sys.argv
    if not args:
        print("uso: python3 scripts/scope.py [--short] <img> [img2 ...]")
        sys.exit(1)
    for p in args:
        (analyze_short if short else analyze)(p)
