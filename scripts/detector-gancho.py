#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
detector-gancho.py — PORTERO de GANCHO (los primeros ~15 cuadros).
=============================================================================
Hermano de critic-gate.cjs / critic-eye.cjs, pero en vez de cazar DEFECTOS,
mide si el ARRANQUE de un video CAPTURA al ojo en los primeros ~0.5 s.

Por qué los primeros cuadros: el cerebro extrae el "gist" de una imagen en
~13 ms (Potter, MIT 2014), detecta "¿hay algo aquí?" en ~150 ms (Thorpe 1996),
y el primer saccade tarda ~200 ms. ANTES de eso, la vía MAGNOCELULAR (rápida,
gruesa, CIEGA AL COLOR) decide la captura usando solo MOVIMIENTO y CONTRASTE
DE LUMINANCIA. El color (vía PARVOcelular) llega ~200 ms DESPUÉS: confirma,
no captura. => este detector pondera fuerte el contraste/saliencia/movimiento
y CASTIGA depender del color.

Mide, sobre la ventana de captura (primeros N cuadros), métricas REALES y
citables (cero curvas inventadas, mandato del proyecto):

  1) RMS contrast (Peli 1990)        sigma(L)/mean(L)  — punch de luminancia.
  2) Michelson robusto               (p99-p1)/(p99+p1) — rango claro/oscuro.
  3) Saliencia espectral (Hou&Zhang  spectral residual -> mapa de saliencia;
     CVPR 2007) + CONCENTRACIÓN      fracción de saliencia en el 5% top de
                                     pixeles = "1 objeto" (tu doctrina de cine).
  4) Dominancia de BAJA frecuencia   FFT radial: energía en freqs bajas =
     espacial (Field; nat. img stat) forma GRANDE y simple, legible en periferia.
  5) Onset de movimiento             media|L[t]-L[t-1]| — transiente que dispara
                                     captura involuntaria (colículo superior).
  6) Looming (proxy)                 ¿el contenido se EXPANDE hacia la cámara?
                                     (circuito de amenaza/aproximación).
  7) Saturación de color             se MIDE pero pesa NEGATIVO: el color
                                     confirma, no captura (lección de neurocine).

Cada métrica se z-score-a SOBRE EL LOTE (es comparativo: "feo vs bueno" es
relativo a tus otros videos). Score compuesto = suma ponderada (pesos en
CONFIG, fáciles de recalibrar). Salida:
  - <out>/scores.json   métricas completas por video
  - <out>/scores.csv    tabla plana para análisis
  - <out>/ranking.txt   ordenado PEOR -> MEJOR con etiqueta FEO/MEDIO/BUENO
  - <out>/contact-sheet.png  miniatura por video ordenada peor->mejor, con
                             score y veredicto QUEMADOS — para que tu OJO
                             confirme si el detector tiene tu mismo gusto.

Uso:
  python3 scripts/detector-gancho.py \
      --videos "dist-video/chains/*.mp4" "dist-video/showcase/Au*.mp4" \
               "_out_bh_master.mp4" "dist-video/dna/*.mp4" \
      --out _gancho_out

  python3 scripts/detector-gancho.py --all          # escanea todo dist-video
"""
import argparse
import csv
import glob
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy import ndimage
from scipy.signal import find_peaks
from PIL import Image, ImageDraw, ImageFont

# --------------------------------------------------------------------------
# CONFIG — pesos que CODIFICAN la neurociencia. Recalíbralos aquí.
#   + captura (canal magno: contraste, saliencia, forma grande, movimiento)
#   - color   (parvo: confirma, no captura -> castiga depender de él)
# --------------------------------------------------------------------------
WEIGHTS = {
    "rms_contrast":        0.8,   # punch de luminancia (std de L normalizada)
    "michelson":           0.6,   # rango dinámico claro/oscuro
    "saliency_conc":       1.5,   # 1 objeto dominante (señal MÁS honesta aquí)
    "lowfreq_dom":         0.8,   # forma grande/simple legible en periferia
    "motion_onset":        0.2,   # bajo: cine lento -> casi 0, premia intros
    "looming":             0.0,   # proxy poco confiable en v1 -> sin peso
    "saturation":         -0.4,   # color: confirma, NO captura -> penaliza
}

Z_CLIP = 2.5  # winsoriza el z-score: 1 métrica casi-constante no debe dominar

WINDOW_S   = 1.0     # segundos analizados desde el inicio (captura ~0.5s + margen)
CAPTURE_N  = 15      # "los 15 cuadros": ventana dura de captura para métricas
THUMB_W    = 256     # ancho de decodificación (barato; suficiente p/ métricas)
SAL_W      = 64      # ancho para el modelo de saliencia (como en Hou&Zhang)
LOWFREQ_CUT = 0.125  # radio (fracción de Nyquist) que cuenta como "baja freq"
SHEET_COLS = 6       # columnas del contact sheet
SHEET_THUMB = (216, 384)  # tamaño de cada miniatura en la hoja (9:16)

# Modo --peaks (escaneo del TIMELINE COMPLETO para cazar picos/intervalos):
SCAN_FPS   = 12      # remuestreo del video completo (83ms/cuadro; < ventana captura)
SCAN_W     = 160     # ancho de decodificación para el escaneo (barato)
HOOK_LENS  = [0.5, 1.0]   # longitudes de ventana-gancho a localizar (segundos)
PEAK_TOPK  = 5       # cuántos picos reportar por video

# Pesos del modo --peaks: CODIFICAN el ranking de la neurociencia de la atención
# (docs/NEUROCIENCIA-DEL-GANCHO.md). El cerebro asigna su recurso escaso (atención)
# por ERROR DE PREDICCIÓN resoluble, NO por brillo. Orden medido:
#   sorpresa (Itti&Baldi 2009: gana a saliencia con p<1e-100)  >>
#   looming (Schiff 1962: lever subcortical más potente, innato) >
#   1-objeto (saliencia concentrada) > contraste magno > forma grande > movimiento.
PEAK_WEIGHTS = {
    "surprise": 2.0,   # sorpresa bayesiana temporal — el predictor #1
    "looming":  1.2,   # expansión hacia la cámara — captura subcortical
    "sal":      1.0,   # 1 objeto dominante (doctrina de cine)
    "rms":      0.8,   # punch de luminancia (canal magnocelular)
    "low":      0.5,   # forma grande y simple (legible en periferia)
    "motion":   0.5,   # movimiento crudo (más débil que la sorpresa)
}
SURPRISE_GRID_W = 32    # rejilla gruesa = resolución magnocelular (baja-freq)
SURPRISE_ALPHA  = 0.35  # olvido del "modelo neuronal" (Sokolov): ~3 cuadros


# --------------------------------------------------------------------------
# ffmpeg / decodificación
# --------------------------------------------------------------------------
def probe_dims(path):
    """Devuelve (w, h, fps) del primer stream de video, o None si falla."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height,r_frame_rate",
             "-of", "csv=p=0:s=x", path],
            capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            return None
        w, h, rate = out.stdout.strip().split("x")
        num, den = rate.split("/")
        fps = float(num) / float(den) if float(den) else 30.0
        return int(w), int(h), fps
    except Exception:
        return None


def extract_frames(path, window_s, thumb_w):
    """Decodifica los primeros window_s segundos a un array (T,H,W,3) uint8,
    escalado a thumb_w de ancho. Pipe rawvideo: cero archivos temporales."""
    dims = probe_dims(path)
    if dims is None:
        return None, None
    sw, sh, fps = dims
    tw = thumb_w
    th = int(round(thumb_w * sh / sw))
    th += th % 2  # alto par (requisito de varios filtros/escalas)
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-t", f"{window_s:.3f}",
           "-vf", f"scale={tw}:{th}", "-pix_fmt", "rgb24",
           "-f", "rawvideo", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=120)
    except Exception:
        return None, None
    buf = out.stdout
    frame_bytes = tw * th * 3
    if frame_bytes == 0 or len(buf) < frame_bytes:
        return None, None
    n = len(buf) // frame_bytes
    arr = np.frombuffer(buf[: n * frame_bytes], dtype=np.uint8)
    arr = arr.reshape(n, th, tw, 3)
    return arr, fps


# --------------------------------------------------------------------------
# Métricas espaciales (sobre un cuadro)  — todas en luminancia salvo color
# --------------------------------------------------------------------------
def luminance(frame):
    """L = 0.299R + 0.587G + 0.114B (Rec.601), float [0,255]."""
    f = frame.astype(np.float64)
    return 0.299 * f[..., 0] + 0.587 * f[..., 1] + 0.114 * f[..., 2]


def rms_contrast(L):
    """RMS contrast = desviación estándar de la luminancia normalizada a [0,1].
    (NO se divide por la media: std/media explota en cuadros casi-negros y
    terminaría midiendo 'qué tan negro es el fondo', no el punch real.)"""
    return float((L / 255.0).std())


def michelson(L):
    """Rango claro/oscuro robusto vía percentiles (evita 1 pixel atípico)."""
    lo, hi = np.percentile(L, 1), np.percentile(L, 99)
    s = hi + lo
    return float((hi - lo) / s) if s > 1e-6 else 0.0


def spectral_residual_saliency(L):
    """Hou & Zhang (CVPR 2007): mapa de saliencia desde el residual del
    log-espectro. Sin entrenamiento, sin modelo externo: FFT pura."""
    h, w = L.shape
    sw = SAL_W
    sh = max(1, int(round(sw * h / w)))
    small = np.array(Image.fromarray(L.astype(np.uint8)).resize((sw, sh)),
                     dtype=np.float64)
    F = np.fft.fft2(small)
    amp = np.abs(F)
    phase = np.angle(F)
    logamp = np.log(amp + 1e-8)
    smooth = ndimage.uniform_filter(logamp, size=3)
    residual = logamp - smooth
    recon = np.fft.ifft2(np.exp(residual + 1j * phase))
    sal = np.abs(recon) ** 2
    sal = ndimage.gaussian_filter(sal, sigma=2.0)
    mx = sal.max()
    return sal / mx if mx > 1e-12 else sal


def saliency_concentration(sal, top_frac=0.05):
    """Fracción de la saliencia total que cae en el top `top_frac` de pixeles.
    Alto = 1 foco dominante (tu doctrina '1 objeto'). Bajo = disperso."""
    flat = np.sort(sal.ravel())[::-1]
    k = max(1, int(len(flat) * top_frac))
    total = flat.sum()
    return float(flat[:k].sum() / total) if total > 1e-12 else 0.0


def lowfreq_dominance(L):
    """Fracción de energía espectral en bajas frecuencias = forma grande y
    simple (legible en periferia / al scroll). FFT radial."""
    Lz = L - L.mean()
    F = np.fft.fftshift(np.fft.fft2(Lz))
    P = np.abs(F) ** 2
    h, w = L.shape
    cy, cx = h / 2.0, w / 2.0
    yy, xx = np.ogrid[:h, :w]
    r = np.sqrt(((yy - cy) / cy) ** 2 + ((xx - cx) / cx) ** 2)  # 0..~1.41
    total = P.sum()
    if total <= 1e-12:
        return 0.0
    low = P[r < LOWFREQ_CUT].sum()
    return float(low / total)


def saturation(frame):
    """Saturación media HSV (S = (max-min)/max). El color que 'confirma'."""
    f = frame.astype(np.float64)
    mx = f.max(axis=-1)
    mn = f.min(axis=-1)
    s = np.divide(mx - mn, mx, out=np.zeros_like(mx), where=mx > 1e-6)
    return float(s.mean())


# --------------------------------------------------------------------------
# Métricas temporales (sobre la ventana de captura)
# --------------------------------------------------------------------------
def motion_onset(Ls):
    """Media de |L[t]-L[t-1]| normalizada — transiente de movimiento que
    dispara atención exógena (involuntaria)."""
    if len(Ls) < 2:
        return 0.0
    diffs = [np.abs(Ls[t] - Ls[t - 1]).mean() for t in range(1, len(Ls))]
    return float(np.mean(diffs) / 255.0)


def looming_proxy(Ls):
    """¿El contenido se EXPANDE hacia la cámara? Compara cada cuadro con el
    anterior ESCALADO 1.06x: si el zoom mejora el parecido, hay aproximación
    (looming). Proxy honesto v1 (sin flujo óptico denso; mejorable con opencv)."""
    if len(Ls) < 2:
        return 0.0
    gains = []
    for t in range(1, len(Ls)):
        prev, cur = Ls[t - 1], Ls[t]
        z = ndimage.zoom(prev, 1.06, order=1)
        # recorte centrado al tamaño de cur
        zy, zx = z.shape
        oy, ox = (zy - prev.shape[0]) // 2, (zx - prev.shape[1]) // 2
        zc = z[oy:oy + prev.shape[0], ox:ox + prev.shape[1]]
        c_id = _ncc(prev, cur)
        c_zoom = _ncc(zc, cur)
        gains.append(max(0.0, c_zoom - c_id))
    return float(np.mean(gains)) if gains else 0.0


def _ncc(a, b):
    """Correlación cruzada normalizada entre dos imágenes del mismo shape."""
    a = a.ravel() - a.mean()
    b = b.ravel() - b.mean()
    da, db = np.linalg.norm(a), np.linalg.norm(b)
    return float(np.dot(a, b) / (da * db)) if da > 1e-9 and db > 1e-9 else 0.0


# --------------------------------------------------------------------------
# Escaneo del TIMELINE COMPLETO — caza picos e intervalos (modo --peaks)
#   El gancho no tiene por qué ser el primer cuadro del archivo: es el MEJOR
#   cuadro del video. Este modo recorre TODO el video, arma una curva de
#   "fuerza de gancho" en el tiempo, y localiza (a) los picos individuales y
#   (b) las mejores ventanas contiguas de 0.5s/1s = el material para recortar
#   una apertura con ffmpeg (cold-open) SIN renderear nada nuevo.
# --------------------------------------------------------------------------
def extract_timeline(path, fps, thumb_w):
    """Decodifica el video COMPLETO remuestreado a `fps`, (T,H,W,3) uint8."""
    dims = probe_dims(path)
    if dims is None:
        return None
    sw, sh, _ = dims
    tw = thumb_w
    th = int(round(thumb_w * sh / sw)); th += th % 2
    cmd = ["ffmpeg", "-v", "error", "-i", path,
           "-vf", f"fps={fps},scale={tw}:{th}",
           "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=300)
    except Exception:
        return None
    buf = out.stdout
    fb = tw * th * 3
    if fb == 0 or len(buf) < fb:
        return None
    n = len(buf) // fb
    return np.frombuffer(buf[: n * fb], dtype=np.uint8).reshape(n, th, tw, 3)


def _z(a):
    sd = a.std()
    return (a - a.mean()) / sd if sd > 1e-9 else a * 0.0


def temporal_surprise(Ls):
    """SORPRESA BAYESIANA TEMPORAL (aprox. de Itti & Baldi 2009, Vision Research).
    El predictor #1 de adónde va el ojo: 72-84% de las saccades van a lo
    SORPRENDENTE, no a lo brillante (gana a la saliencia con p<1e-100).

    Modela cada celda de una rejilla gruesa con una Gaussiana (media, varianza)
    que se OLVIDA exponencialmente = el 'modelo neuronal' de Sokolov (1963). La
    sorpresa del cuadro t = energía del error de predicción NORMALIZADO por la
    varianza local (distancia de Mahalanobis robusta, z² → log1p).

    CLAVE (lo que la distingue de 'movimiento'): una región que SIEMPRE cambia
    NO sorprende (su varianza es alta → z bajo). Lo que sorprende es lo que VIOLA
    el modelo aprendido — exactamente lo que retiene al cerebro (Summerfield 2008:
    la respuesta plena se reserva para lo NO predicho). No es la KL exacta; es la
    aproximación error-normalizado, honesta y citable."""
    n = len(Ls)
    if n < 2:
        return np.zeros(n)
    gw = SURPRISE_GRID_W
    grids = []
    for L in Ls:
        h, w = L.shape
        gh = max(1, int(round(gw * h / w)))
        g = np.array(Image.fromarray(L.astype(np.uint8)).resize((gw, gh)),
                     dtype=np.float64) / 255.0
        grids.append(g)
    a = SURPRISE_ALPHA
    m = grids[0].copy()              # media: el prior que se adapta
    v = np.full_like(m, 1e-3)        # varianza: incertidumbre del modelo
    surp = np.zeros(n)
    for t in range(1, n):
        e = grids[t] - m            # error de predicción
        z2 = (e * e) / (v + 1e-4)   # ¿cuán raro es, dado el modelo?
        surp[t] = float(np.mean(np.log1p(z2)))
        m = m + a * e               # actualiza el modelo neuronal (olvido exp.)
        v = (1 - a) * (v + a * e * e)
    surp[0] = surp[1]
    return surp


def looming_curve(Ls):
    """Señal de LOOMING/expansión a lo largo del tiempo. Para cada par de cuadros,
    cuánto MEJORA el parecido si el cuadro previo se ESCALA hacia afuera (zoom
    desde el centro) = el contenido se ACERCA a la cámara. La palanca subcortical
    más potente e innata (Schiff 1962: primates de 2 semanas retroceden; funciona
    en ceguera cortical). Proxy numpy-only (sin flujo óptico denso)."""
    n = len(Ls)
    out = np.zeros(n)
    for t in range(1, n):
        prev, cur = Ls[t - 1], Ls[t]
        z = ndimage.zoom(prev, 1.08, order=1)
        zy, zx = z.shape
        oy, ox = (zy - prev.shape[0]) // 2, (zx - prev.shape[1]) // 2
        zc = z[oy:oy + prev.shape[0], ox:ox + prev.shape[1]]
        out[t] = max(0.0, _ncc(zc, cur) - _ncc(prev, cur))
    if n > 1:
        out[0] = out[1]
    return out


def strength_curve(frames):
    """Curva de fuerza de gancho NEUROCIENTÍFICA a lo largo del video.
    Pondera por cómo el cerebro asigna atención (PEAK_WEIGHTS): SORPRESA (el
    predictor #1) >> looming > 1-objeto > contraste magno > forma > movimiento.
    Cada componente se z-score-a DENTRO del video (los picos son relativos a su
    propio timeline). Devuelve (curva, componentes_crudos)."""
    Ls = [luminance(f) for f in frames]
    n = len(Ls)
    rms = np.array([rms_contrast(L) for L in Ls])
    sal = np.array([saliency_concentration(spectral_residual_saliency(L))
                    for L in Ls])
    low = np.array([lowfreq_dominance(L) for L in Ls])
    motion = np.zeros(n)
    for t in range(1, n):
        motion[t] = np.abs(Ls[t] - Ls[t - 1]).mean() / 255.0
    if n > 1:
        motion[0] = motion[1]
    surprise = temporal_surprise(Ls)
    looming = looming_curve(Ls)
    comp = {"surprise": surprise, "looming": looming, "sal": sal,
            "rms": rms, "low": low, "motion": motion}
    s = sum(PEAK_WEIGHTS[k] * _z(comp[k]) for k in PEAK_WEIGHTS)
    s = ndimage.gaussian_filter1d(s, sigma=1.0)
    return s, comp


def best_window(s, fps, length_s):
    """Mejor ventana contigua de `length_s`: máxima fuerza media. Devuelve
    (start_s, end_s, avg_z)."""
    w = max(1, int(round(length_s * fps)))
    if len(s) <= w:
        return 0.0, len(s) / fps, float(s.mean())
    avg = np.convolve(s, np.ones(w) / w, mode="valid")
    start = int(np.argmax(avg))
    return start / fps, (start + w) / fps, float(avg[start])


def topk_windows(s, fps, length_s, k):
    """Top-k ventanas contiguas NO TRASLAPADAS de `length_s`, por fuerza media.
    El material para una intro multi-beat: la #1 = cold-open (el momento más
    fuerte al frame 0); las siguientes = re-enganches (pattern interrupt cada
    3-5s, doctrina de retención). Suprime traslape para que no devuelva 5 veces
    el mismo pico."""
    w = max(1, int(round(length_s * fps)))
    if len(s) <= w:
        return [(0.0, len(s) / fps, float(s.mean()))]
    avg = np.convolve(s, np.ones(w) / w, mode="valid").copy()
    out = []
    for _ in range(k):
        i = int(np.argmax(avg))
        if avg[i] <= -1e8:
            break
        out.append((i / fps, (i + w) / fps, float(avg[i])))
        lo = max(0, i - w + 1)
        hi = min(len(avg), i + w)
        avg[lo:hi] = -1e9   # zona muerta = sin traslape con la ventana elegida
    return out


def find_peak_times(s, fps, topk):
    """Máximos locales de la curva (separados ≥0.8s), ordenados por fuerza."""
    dist = max(1, int(round(fps * 0.8)))
    idx, _ = find_peaks(s, distance=dist, prominence=0.4)
    if len(idx) == 0:
        idx = np.array([int(np.argmax(s))])
    idx = sorted(idx, key=lambda i: s[i], reverse=True)[:topk]
    idx = sorted(idx)  # orden temporal para reportar
    return [(i / fps, float(s[i])) for i in idx]


def plot_curve(s, fps, peaks, windows, out_png, title, comp=None):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    t = np.arange(len(s)) / fps
    fig, ax = plt.subplots(figsize=(10, 3.2), dpi=110)
    ax.plot(t, s, color="#3399cc", lw=1.8, label="fuerza de gancho")
    ax.fill_between(t, s, s.min(), color="#3399cc", alpha=0.12)
    # superpone la SORPRESA (el componente #1) para ver de dónde viene la fuerza
    if comp is not None and "surprise" in comp:
        ax.plot(t, _z(comp["surprise"]), color="#ee5599", lw=1.0, alpha=0.7,
                label="sorpresa (z)")
    for pt, _ in peaks:
        ax.axvline(pt, color="#ee8855", lw=1.0, alpha=0.85)
        ax.text(pt, s.max(), f"{pt:.1f}s", color="#ee8855", fontsize=8,
                ha="center", va="bottom")
    for (a, b, _), col in zip(windows, ["#55cc55", "#ffcc44"]):
        ax.axvspan(a, b, color=col, alpha=0.18)
    ax.set_title(title, fontsize=10)
    ax.set_xlabel("tiempo (s)"); ax.set_ylabel("z")
    ax.legend(loc="upper right", fontsize=7, framealpha=0.3)
    ax.margins(x=0); fig.tight_layout()
    fig.savefig(out_png); plt.close(fig)


def build_peak_strip(frames, fps, peaks, out_png, title):
    """Tira con los mejores cuadros del video (los picos), con su timestamp."""
    cw, ch, pad, lab, top = 200, 356, 8, 24, 34
    n = max(1, len(peaks))
    W = n * (cw + pad) + pad
    H = ch + lab + pad + top
    img = Image.new("RGB", (W, H), (12, 12, 14))
    d = ImageDraw.Draw(img)
    d.text((pad, 8), title, font=_font(18), fill=(230, 230, 235))
    for i, (pt, ps) in enumerate(peaks):
        fi = min(len(frames) - 1, int(round(pt * fps)))
        thumb = Image.fromarray(frames[fi]).resize((cw, ch))
        x = pad + i * (cw + pad); y = top
        img.paste(thumb, (x, y))
        d.rectangle([x, y + ch, x + cw, y + ch + lab], fill=(24, 24, 28))
        d.text((x + 4, y + ch + 4), f"#{i+1}  t={pt:.2f}s  z={ps:+.2f}",
               font=_font(13), fill=(200, 200, 205))
    img.save(out_png)


def run_peaks(paths, out):
    os.makedirs(out, exist_ok=True)
    print(f"[peaks] escaneando timeline COMPLETO de {len(paths)} videos "
          f"@ {SCAN_FPS}fps (caza de picos + ventanas-gancho)...\n")
    summary = []
    for p in paths:
        name = os.path.basename(p)
        frames = extract_timeline(p, SCAN_FPS, SCAN_W)
        if frames is None or len(frames) < 2:
            print(f"  [skip] {name}")
            continue
        s, comp = strength_curve(frames)
        peaks = find_peak_times(s, SCAN_FPS, PEAK_TOPK)
        # TODOS los picos (no solo top-5) → el JUEZ mide cadencia de pattern-interrupt
        _spk, _ = find_peaks(s, distance=max(1, int(round(SCAN_FPS * 0.8))),
                             prominence=0.4)
        if len(_spk) == 0:
            _spk = [int(np.argmax(s))]
        spikes = [{"t": round(float(i) / SCAN_FPS, 2), "z": round(float(s[i]), 3)}
                  for i in sorted(_spk)]
        # LOOP: NCC de luminancia 1er vs último cuadro → 1.0 = costura invisible (rewatch)
        loop_ncc = round(float(_ncc(luminance(frames[0]), luminance(frames[-1]))), 3)
        windows = [best_window(s, SCAN_FPS, L) for L in HOOK_LENS]
        # ventanas-INTRO: top-K NO traslapadas de 1s = beats para el montaje
        intro_len = HOOK_LENS[1] if len(HOOK_LENS) > 1 else HOOK_LENS[0]
        intro_wins = topk_windows(s, SCAN_FPS, intro_len, PEAK_TOPK)
        stem = os.path.splitext(name)[0]
        plot_curve(s, SCAN_FPS, peaks, windows,
                   os.path.join(out, f"{stem}.curve.png"), name, comp)
        build_peak_strip(frames, SCAN_FPS, peaks,
                         os.path.join(out, f"{stem}.peaks.png"), name)
        rec = {
            "name": name, "path": p, "fps": SCAN_FPS,
            "duration_s": round(len(frames) / SCAN_FPS, 2),
            "peaks": [{"t": round(pt, 2), "z": round(ps, 3)} for pt, ps in peaks],
            "best_window": {f"{L}s": {"start": round(a, 2), "end": round(b, 2),
                                      "avg_z": round(v, 3)}
                            for L, (a, b, v) in zip(HOOK_LENS, windows)},
            # beats listos para arma-gancho.py: cold-open (#1) + re-enganches
            "intro_beats": [{"start": round(a, 2), "end": round(b, 2),
                             "avg_z": round(v, 3)} for a, b, v in intro_wins],
            # picos completos + cierre de loop → el JUEZ mide cadencia y rewatch
            "spikes": spikes,
            "loop_ncc": loop_ncc,
            # CURVA completa (fuerza de gancho por cuadro @ fps) — para que el JUEZ
            # mida pico@frame0, cadencia de huecos y peak-end (atom-judge.py).
            "curve": [round(float(v), 3) for v in s],
        }
        summary.append(rec)
        ptxt = ", ".join(f"{pt:.2f}s(z{ps:+.1f})" for pt, ps in peaks)
        w0 = rec["best_window"][f"{HOOK_LENS[0]}s"]
        cold = intro_wins[0]
        print(f"  {name:30} dur {rec['duration_s']:5}s | picos: {ptxt}")
        print(f"  {'':30} mejor {HOOK_LENS[0]}s = {w0['start']:.2f}-{w0['end']:.2f}s "
              f"(z {w0['avg_z']:+.2f})  ·  cold-open = {cold[0]:.2f}s")
    with open(os.path.join(out, "peaks.json"), "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\n  -> {out}/<video>.curve.png   fuerza de gancho + SORPRESA + picos")
    print(f"  -> {out}/<video>.peaks.png   los {PEAK_TOPK} mejores cuadros (cold-open)")
    print(f"  -> {out}/peaks.json          picos + intro_beats (montaje multi-beat)")
    return summary


# --------------------------------------------------------------------------
# Análisis por video
# --------------------------------------------------------------------------
def analyze(path):
    frames, fps = extract_frames(path, WINDOW_S, THUMB_W)
    if frames is None:
        return None
    cap = frames[:CAPTURE_N] if len(frames) >= CAPTURE_N else frames
    Ls = [luminance(f) for f in cap]

    # métricas espaciales: promedio sobre la ventana de captura
    rms = float(np.mean([rms_contrast(L) for L in Ls]))
    mich = float(np.mean([michelson(L) for L in Ls]))
    sals = [spectral_residual_saliency(L) for L in Ls]
    sal_conc = float(np.mean([saliency_concentration(s) for s in sals]))
    lowf = float(np.mean([lowfreq_dominance(L) for L in Ls]))
    sat = float(np.mean([saturation(f) for f in cap]))

    # temporales
    motion = motion_onset(Ls)
    loom = looming_proxy(Ls)

    # cuadro representativo para el contact sheet: el de mayor "fuerza" en la
    # ventana de captura (contraste x concentración de saliencia) = el mejor
    # disparo que tiene el video para enganchar al scroller.
    strength = [rms_contrast(Ls[i]) * saliency_concentration(sals[i])
                for i in range(len(Ls))]
    rep_idx = int(np.argmax(strength)) if strength else 0

    return {
        "path": path,
        "name": os.path.basename(path),
        "fps": round(fps, 2),
        "rms_contrast": rms,
        "michelson": mich,
        "saliency_conc": sal_conc,
        "lowfreq_dom": lowf,
        "motion_onset": motion,
        "looming": loom,
        "saturation": sat,
        "_rep_frame": cap[rep_idx].copy(),  # se quita antes de serializar JSON
    }


# --------------------------------------------------------------------------
# Z-score + score compuesto
# --------------------------------------------------------------------------
def zscore_and_score(rows):
    keys = list(WEIGHTS.keys())
    stats = {}
    for k in keys:
        vals = np.array([r[k] for r in rows], dtype=np.float64)
        mu, sd = vals.mean(), vals.std()
        stats[k] = (mu, sd if sd > 1e-9 else 1.0)
    for r in rows:
        z = {}
        score = 0.0
        for k in keys:
            mu, sd = stats[k]
            zk = (r[k] - mu) / sd
            zk = max(-Z_CLIP, min(Z_CLIP, zk))  # winsoriza: anti-outlier
            z[k] = zk
            score += WEIGHTS[k] * zk
        r["z"] = z
        r["score"] = float(score)
    return rows, stats


def label_for(rank_frac):
    """rank_frac en [0,1): 0 = peor. Terciles -> FEO / MEDIO / BUENO."""
    if rank_frac < 1 / 3:
        return "FEO"
    if rank_frac < 2 / 3:
        return "MEDIO"
    return "BUENO"


# --------------------------------------------------------------------------
# Contact sheet (Pillow)
# --------------------------------------------------------------------------
def _font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def build_contact_sheet(rows, out_png):
    """Miniaturas ordenadas PEOR->MEJOR, con score+veredicto quemados."""
    tw, thh = SHEET_THUMB
    cols = SHEET_COLS
    pad, label_h = 8, 46
    rows_n = math.ceil(len(rows) / cols)
    cell_w = tw + pad
    cell_h = thh + label_h + pad
    W = cols * cell_w + pad
    H = rows_n * cell_h + pad + 40
    sheet = Image.new("RGB", (W, H), (12, 12, 14))
    draw = ImageDraw.Draw(sheet)
    f_title = _font(22)
    f_lab = _font(15)
    f_small = _font(12)
    draw.text((pad, 8),
              "DETECTOR DE GANCHO  ·  peor (izq/arriba) -> mejor (der/abajo)  ·  score = z-suma ponderada (magno + / color -)",
              font=f_title, fill=(230, 230, 235))
    col_lab = {"FEO": (235, 80, 80), "MEDIO": (220, 200, 90), "BUENO": (90, 220, 120)}
    for i, r in enumerate(rows):
        cx = pad + (i % cols) * cell_w
        cy = 40 + pad + (i // cols) * cell_h
        thumb = Image.fromarray(r["_rep_frame"]).resize((tw, thh))
        sheet.paste(thumb, (cx, cy))
        lab = r["label"]
        draw.rectangle([cx, cy + thh, cx + tw, cy + thh + label_h],
                       fill=(24, 24, 28))
        draw.text((cx + 4, cy + thh + 2), r["name"][:30], font=f_small,
                  fill=(200, 200, 205))
        draw.text((cx + 4, cy + thh + 18), f"{lab}",
                  font=f_lab, fill=col_lab.get(lab, (200, 200, 200)))
        draw.text((cx + 70, cy + thh + 18), f"score {r['score']:+.2f}",
                  font=f_lab, fill=(180, 180, 190))
        # barra de score
        bw = int(min(1.0, abs(r["score"]) / 4.0) * (tw - 8))
        by = cy + thh + label_h - 6
        bcol = (90, 220, 120) if r["score"] >= 0 else (235, 80, 80)
        draw.rectangle([cx + 4, by, cx + 4 + bw, by + 3], fill=bcol)
    sheet.save(out_png)


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------
def gather_paths(tokens, scan_all):
    paths = []
    if scan_all:
        tokens = list(tokens) + ["dist-video/**/*.mp4"]
    for t in tokens:
        if any(ch in t for ch in "*?["):
            paths.extend(sorted(glob.glob(t, recursive=True)))
        elif os.path.isdir(t):
            paths.extend(sorted(glob.glob(os.path.join(t, "**/*.mp4"),
                                          recursive=True)))
        elif os.path.exists(t):
            paths.append(t)
    # dedup conservando orden
    seen, uniq = set(), []
    for p in paths:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    return uniq


def main():
    ap = argparse.ArgumentParser(description="Detector de gancho (primeros ~15 cuadros).")
    ap.add_argument("--videos", nargs="*", default=[],
                    help="rutas o globs de .mp4 a analizar")
    ap.add_argument("--all", action="store_true",
                    help="escanea todo dist-video/**/*.mp4")
    ap.add_argument("--out", default="_gancho_out")
    ap.add_argument("--limit", type=int, default=0, help="máx. de videos (0=todos)")
    ap.add_argument("--peaks", action="store_true",
                    help="escanea el timeline COMPLETO y caza picos/intervalos "
                         "(en vez de rankear solo el primer 0.5s)")
    args = ap.parse_args()

    paths = gather_paths(args.videos, args.all)
    if args.limit > 0:
        paths = paths[: args.limit]
    if not paths:
        print("No hay videos. Usa --videos <glob...> o --all", file=sys.stderr)
        sys.exit(2)

    os.makedirs(args.out, exist_ok=True)

    if args.peaks:
        run_peaks(paths, args.out)
        return

    print(f"[gancho] analizando {len(paths)} videos (ventana {WINDOW_S}s, "
          f"captura {CAPTURE_N} cuadros)...\n")

    rows = []
    for i, p in enumerate(paths):
        sys.stdout.write(f"\r  [{i+1}/{len(paths)}] {os.path.basename(p)[:42]:42}")
        sys.stdout.flush()
        r = analyze(p)
        if r is not None:
            rows.append(r)
    print()

    if not rows:
        print("Ningún video se pudo analizar.", file=sys.stderr)
        sys.exit(1)

    rows, stats = zscore_and_score(rows)
    rows.sort(key=lambda r: r["score"])  # peor -> mejor
    n = len(rows)
    for i, r in enumerate(rows):
        r["label"] = label_for(i / n)

    # contact sheet
    sheet_png = os.path.join(args.out, "contact-sheet.png")
    build_contact_sheet(rows, sheet_png)

    # JSON / CSV (sin el frame numpy)
    json_rows = []
    for r in rows:
        d = {k: v for k, v in r.items() if k != "_rep_frame"}
        json_rows.append(d)
    with open(os.path.join(args.out, "scores.json"), "w") as f:
        json.dump({"weights": WEIGHTS, "window_s": WINDOW_S,
                   "capture_n": CAPTURE_N, "videos": json_rows}, f, indent=2)
    metric_keys = list(WEIGHTS.keys())
    with open(os.path.join(args.out, "scores.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["name", "label", "score"] + metric_keys)
        for r in rows:
            w.writerow([r["name"], r["label"], f"{r['score']:.3f}"]
                       + [f"{r[k]:.4f}" for k in metric_keys])

    # ranking.txt + consola
    lines = []
    lines.append(f"{'#':>3}  {'veredicto':8} {'score':>7}  {'contraste':>9} "
                 f"{'salienc':>7} {'mov':>6} {'loom':>6} {'satur':>6}  nombre")
    lines.append("-" * 92)
    for i, r in enumerate(rows):
        lines.append(
            f"{i+1:>3}  {r['label']:8} {r['score']:>+7.2f}  "
            f"{r['rms_contrast']:>9.3f} {r['saliency_conc']:>7.3f} "
            f"{r['motion_onset']:>6.3f} {r['looming']:>6.3f} {r['saturation']:>6.3f}  "
            f"{r['name']}")
    text = "\n".join(lines)
    with open(os.path.join(args.out, "ranking.txt"), "w") as f:
        f.write(text + "\n")
    print("\n" + text)
    print(f"\n  -> {sheet_png}")
    print(f"  -> {os.path.join(args.out, 'ranking.txt')} / scores.json / scores.csv")
    print(f"\n  FEOS (revisa el arranque): " +
          ", ".join(r["name"] for r in rows[:5]))
    print(f"  BUENOS (copia su patrón):   " +
          ", ".join(r["name"] for r in rows[-5:][::-1]))


if __name__ == "__main__":
    main()
