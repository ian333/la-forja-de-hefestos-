#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atencion-verify.py — verificador de ECONOMÍA DE ATENCIÓN (v2 del verificador).

Mide lo que la ciencia dice que retiene (docs/ECONOMIA-ATENCION.md, citada):
  1. Movimiento por segundo (Itti-Koch: el cambio visual recaptura la mente)
     → valles muertos = fuga predicha
  2. Colorfulness Hasler-Süsstrunk 2003 (95.3% correlación con humanos)
  3. Color figura-fondo (Palmer & Schloss 2011): matiz centro vs periferia
     + "firma O₂" (cluster cálido Y frío simultáneos = ambos ejes oponentes)
  4. Sincronía audio-visual (binding bimodal: onsets de audio vs movimiento)
  5. Gancho 0-5s aparte (el acantilado) + loop (frame 1 vs último) + quemado
  → curva de interés por segundo + retención PREDICHA (v0 heurística;
    se calibra con métricas reales de IG/YT — el ciclo completo)

Uso:  python3 scripts/atencion-verify.py <video.mp4> [--json out.json]
Deps: ffmpeg/ffprobe + numpy + PIL (sin scipy, sin GPU).
"""
import sys, os, json, subprocess, tempfile, shutil, math
import numpy as np
from PIL import Image

VIDEO = sys.argv[1]
OUT_JSON = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
FPS = 3                      # muestreo de análisis (3 fps basta para curvas por segundo)
W_AN = 270                   # ancho de análisis (barato y suficiente)

def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

dur = float(sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                '-of', 'default=nk=1:nw=1', VIDEO]).stdout.strip())

tmp = tempfile.mkdtemp(prefix='atencion-')
try:
    # ── frames ──
    sh(['ffmpeg', '-y', '-v', 'error', '-i', VIDEO, '-vf', f'fps={FPS},scale={W_AN}:-2',
        os.path.join(tmp, 'f%05d.png')])
    files = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    frames = [np.asarray(Image.open(os.path.join(tmp, f)).convert('RGB'), dtype=np.float32) for f in files]
    N = len(frames)
    t_of = lambda i: i / FPS

    # ── audio: PCM mono 16k para envolvente ──
    apath = os.path.join(tmp, 'a.pcm')
    sh(['ffmpeg', '-y', '-v', 'error', '-i', VIDEO, '-ac', '1', '-ar', '16000',
        '-f', 's16le', apath])
    audio = np.frombuffer(open(apath, 'rb').read(), dtype=np.int16).astype(np.float32) / 32768.0 \
        if os.path.exists(apath) and os.path.getsize(apath) > 0 else np.zeros(1)

    # ═══ 1. MOVIMIENTO por muestra — SOLO sobre píxeles ENCENDIDOS ═══
    # El fondo negro es el ADN de la serie (1 objeto sobre negro): un frame-diff
    # global lo castiga (90% de píxeles negros diluyen al sujeto). Medimos el
    # cambio de lo VISIBLE: mean |Δ| sobre píxeles con luz en cualquiera de los
    # dos frames. Así "objeto brillante moviéndose sobre negro" = movimiento ALTO
    # (que es exactamente lo que Itti-Koch predice como máxima saliencia).
    lum = [f.mean(axis=2) for f in frames]
    motion = [0.0]
    for i in range(1, N):
        lit = np.maximum(lum[i], lum[i - 1]) > 18.0          # umbral ~7% de luz
        if lit.sum() < 50:
            motion.append(0.0); continue
        motion.append(float(np.abs(frames[i] - frames[i - 1]).mean(axis=2)[lit].mean() / 255.0))
    motion = np.array(motion); motion[0] = motion[1] if N > 1 else 0

    # ═══ 2. COLORFULNESS Hasler-Süsstrunk por muestra ═══
    def colorfulness(im):
        R, G, B = im[..., 0], im[..., 1], im[..., 2]
        rg = R - G; yb = 0.5 * (R + G) - B
        return float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))
    colorf = np.array([colorfulness(f) for f in frames])

    # ═══ 3. COLOR figura-fondo (Palmer-Schloss) + firma O₂ + quemado ═══
    def hue_stats(im):
        hsv = np.asarray(Image.fromarray(im.astype(np.uint8)).convert('HSV'), dtype=np.float32)
        H, S, V = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        vivid = (S > 0.25) & (V > 0.12)          # solo píxeles con color real
        h, w = H.shape
        cy, cx = h // 2, w // 2; ry, rx = h // 4, w // 4
        cen = np.zeros_like(vivid); cen[cy - ry:cy + ry, cx - rx:cx + rx] = True
        def circ_mean(mask):
            hh = H[mask & vivid]
            if hh.size < 40: return None
            a = np.deg2rad(hh)
            return float(np.rad2deg(np.arctan2(np.sin(a).mean(), np.cos(a).mean())) % 360)
        hc, hp = circ_mean(cen), circ_mean(~cen)
        fg = None
        if hc is not None and hp is not None:
            d = abs(hc - hp); fg = min(d, 360 - d)   # distancia circular de matiz
        hh = H[vivid]
        warm = float(((hh > 15) & (hh < 70)).mean()) if hh.size else 0.0
        cool = float(((hh > 190) & (hh < 300)).mean()) if hh.size else 0.0
        burn = float((V > 240 / 255).mean())
        return fg, warm, cool, burn
    fgs, warms, cools, burns = [], [], [], []
    for f in frames:
        fg, wa, co, bu = hue_stats(f)
        fgs.append(fg); warms.append(wa); cools.append(co); burns.append(bu)
    fg_valid = [x for x in fgs if x is not None]
    fig_fondo = float(np.mean(fg_valid)) if fg_valid else 0.0
    # firma O₂: fracción de muestras con AMBOS clusters (cálido>10% y frío>10%)
    firma_o2 = float(np.mean([(w > 0.10 and c > 0.10) for w, c in zip(warms, cools)]))
    burn_max = float(np.max(burns)); burn_mean = float(np.mean(burns))

    # ═══ 4. SINCRONÍA AV: envolvente de onsets de audio vs movimiento ═══
    av_sync = 0.0; audio_sil = []
    if audio.size > 16000:
        hop = 16000 // FPS
        n_a = min(N, audio.size // hop)
        rms = np.array([float(np.sqrt((audio[i * hop:(i + 1) * hop] ** 2).mean())) for i in range(n_a)])
        onset = np.maximum(0, np.diff(rms, prepend=rms[0]))    # subidas de energía
        m = motion[:n_a] - motion[:n_a].mean(); o = onset - onset.mean()
        if m.std() > 1e-6 and o.std() > 1e-6:
            # correlación en lags -1..+1 muestras (±0.33s = ventana de binding)
            av_sync = max(float(np.corrcoef(np.roll(m, k), o)[0, 1]) for k in (-1, 0, 1))
        # silencios largos (>2.0s con RMS ~0) — el aire de 0.6s entre frases es normal
        sil = rms < 0.004
        run = 0
        for i, s in enumerate(sil):
            run = run + 1 if s else 0
            if run == 2 * FPS: audio_sil.append(round(t_of(i - run + 1), 1))

    # ═══ 5. CURVA DE INTERÉS + valles + gancho + loop ═══
    # ESCALAS ABSOLUTAS (comparables ENTRE videos — la norma por-video mentía:
    # estiraba el ruido de un video plano hasta parecer acción). Constantes
    # ancladas al corpus: motion_lit 0.02=apenas, 0.06=vivo, 0.12+=intenso;
    # colorfulness Hasler: 15=grisáceo, 33=colorido, 55+=muy colorido.
    m_n = np.clip(motion / 0.11, 0, 1) ** 0.8
    c_n = np.clip(colorf / 55.0, 0, 1)
    novelty = np.clip(np.abs(np.diff(m_n, prepend=m_n[0])) / 0.35, 0, 1)   # pattern interrupts
    interes = 0.5 * m_n + 0.3 * c_n + 0.2 * novelty
    # por segundo
    secs = int(math.floor(N / FPS))
    i_sec = [float(interes[s * FPS:(s + 1) * FPS].mean()) for s in range(secs)]
    # valles muertos: interés <0.18 sostenido ≥2.5s (Itti-Koch: sin cambio no hay recaptura)
    valles = []
    run = 0
    for s, v in enumerate(i_sec):
        run = run + 1 if v < 0.18 else 0
        if run == 3: valles.append(s - 2)
    # gancho 0-5s (el acantilado del user + death valley de la literatura)
    g_mot = float(m_n[:5 * FPS].mean()); g_col = float(c_n[:5 * FPS].mean())
    g_first_peak = float(t_of(int(np.argmax(m_n[:5 * FPS] > 0.55))) if (m_n[:5 * FPS] > 0.55).any() else 5.0)
    gancho = 100 * (0.45 * g_mot + 0.30 * g_col + 0.25 * max(0, 1 - g_first_peak / 5))
    # loop: similitud primer vs último frame (histograma RGB)
    def hist(im):
        h, _ = np.histogramdd(im.reshape(-1, 3), bins=(8, 8, 8), range=((0, 255),) * 3)
        return h.ravel() / h.sum()
    h1, h2 = hist(frames[0]), hist(frames[-1])
    loop = float(1 - 0.5 * np.abs(h1 - h2).sum())
    # retención PREDICHA (v0): hazard base + castigo donde el interés cae
    haz = 0.006 + 0.028 * (1 - np.array(i_sec))
    ret = np.exp(-np.cumsum(haz))
    ret_final = float(ret[-1]) if secs else 0.0
    # quemado SOSTENIDO: segundos con >15% de píxeles reventados (un flash de
    # 1 muestra es el SNAP intencional del enlace — eso NO se castiga)
    burns_sec = [float(np.mean(burns[s * FPS:(s + 1) * FPS])) for s in range(secs)]
    burn_secs = sum(1 for b in burns_sec if b > 0.15)
    # score total (v0 — pesos por calibrar con métricas reales)
    score = round(0.30 * gancho
                  + 25 * float(np.mean(i_sec))
                  + 12 * firma_o2
                  + 8 * min(1, fig_fondo / 120)
                  + 10 * max(0, av_sync)
                  + 10 * loop
                  - 8 * len(valles)
                  - min(25, 6 * burn_secs), 1)

    rep = {
        'video': os.path.basename(VIDEO), 'dur': round(dur, 1), 'score_v0': score,
        'gancho_0_5s': round(gancho, 1),
        'interes_medio': round(float(np.mean(i_sec)), 3),
        'valles_muertos_en_s': valles,
        'colorfulness_media': round(float(colorf.mean()), 1),
        'firma_o2_calido_y_frio': round(firma_o2, 2),
        'contraste_figura_fondo_deg': round(fig_fondo, 1),
        'sincronia_av': round(av_sync, 3),
        'loop_frame1_vs_final': round(loop, 3),
        'quemado_max': round(burn_max, 3), 'quemado_medio': round(burn_mean, 4),
        'quemado_segundos_sostenido': burn_secs,
        'silencios_largos_en_s': audio_sil,
        'retencion_predicha_final': round(ret_final, 2),
        'curva_interes_por_s': [round(v, 2) for v in i_sec],
    }
    if OUT_JSON:
        json.dump(rep, open(OUT_JSON, 'w'), ensure_ascii=False, indent=1)
    # ── reporte legible + sparkline ASCII de la curva ──
    blocks = ' ▁▂▃▄▅▆▇█'
    spark = ''.join(blocks[min(8, int(v * 8.999))] for v in i_sec)
    print(f"═══ {rep['video']}  ({rep['dur']}s)  SCORE v0: {score} ═══")
    print(f"  gancho 0-5s: {rep['gancho_0_5s']}/100 · interés medio: {rep['interes_medio']} · retención predicha: {int(ret_final*100)}%")
    print(f"  color: M̄={rep['colorfulness_media']} · firma-O₂(cálido+frío): {int(firma_o2*100)}% · figura-fondo: {rep['contraste_figura_fondo_deg']}°")
    print(f"  sync A/V: {rep['sincronia_av']} · loop: {rep['loop_frame1_vs_final']} · quemado máx: {rep['quemado_max']}")
    if valles: print(f"  ⚠ VALLES MUERTOS (≥2.5s sin cambio) en: {valles} s")
    if audio_sil: print(f"  ⚠ silencios >2s en: {audio_sil} s")
    print(f"  interés/s: {spark}")
finally:
    shutil.rmtree(tmp, ignore_errors=True)
