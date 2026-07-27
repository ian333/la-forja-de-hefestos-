#!/usr/bin/env python3
"""
transistor-sound.py — cama + diseño sonoro DETERMINISTA de la cápsula #3
(EL TRANSISTOR). Binding bimodal (lección de la autopsia O₂): cada evento
visual tiene su golpe de audio, clavado a los MISMOS beats del shader.

Capas (60 s, 48 kHz, estéreo):
  · DRONE C2+G2 con swell (sube al acto 2, pico en el awe, SILENCIO dramático
    antes de la tesis, regreso suave al loop)
  · RÍO: ruido pasabanda 600–3000 Hz cuya amplitud ES gate(t) — el río se OYE
    correr exactamente cuando se ve correr (ataque 60 ms, release 150 ms)
  · CLICS: transiente (thump 55 Hz + tick 1.8 kHz) en cada FLANCO de subida
    de la compuerta — el clic del sí/no
  · SHIMMER: arpegio alto que se densifica tras el acto 2 (la multiplicación
    se oye: más y más chispas)

Salida: WAV estéreo listo para mezclar bajo la narración.
Uso: python3 scripts/transistor-sound.py out.wav
"""
import sys
import numpy as np

SR = 48000
DUR = 60.0
N = int(SR * DUR)
t = np.arange(N) / SR

# ── beats (== TransistorCristal.tsx) ──
T_CLICK1, T_CIERRA = 20.45, 22.35
T_V2A, T_V2B = 23.1, 23.8
T_RAPIDO, T_ACTO2 = 25.2, 29.6
T_AWE, T_REGRESO, T_FIN = 38.4, 50.0, 60.0

def ss(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)

def gate_curve(tt):
    g = np.zeros_like(tt)
    for a, b in [(T_CLICK1, T_CIERRA), (T_V2A, T_V2B)]:
        g = np.maximum(g, ss((tt - a) / 0.09) * (1 - ss((tt - b) / 0.09)))
    m = (tt >= T_RAPIDO) & (tt < T_ACTO2)
    u = tt - T_RAPIDO
    D = T_ACTO2 - T_RAPIDO
    phase = 1.25 * u + (3.6 - 1.25) * u * u / (2 * D)
    g = np.where(m & ((phase % 1) < 0.5), 1.0, g)
    m2 = tt >= T_ACTO2
    g = np.where(m2 & (((tt * 2) % 1) < 0.55), 1.0, g)
    return g

gate = gate_curve(t)

# flancos de subida (para los clics), muestreados a 1 kHz
tg = np.arange(0, DUR, 0.001)
gg = gate_curve(tg)
edges = tg[1:][(gg[1:] > 0.5) & (gg[:-1] <= 0.5)]
# clics audibles: los dos del guion + metralleta; tras el acto2 solo 3 s más, y el del loop
edges = [e for e in edges if e < T_ACTO2 + 3.0]
edges.append(59.2)

rng = np.random.default_rng(1947)

# ── DRONE (cálido, con arco dramático) ──
def env_points(pts):
    """interpola lineal (t, valor) → curva N muestras"""
    xs = np.array([p[0] for p in pts]); ys = np.array([p[1] for p in pts])
    return np.interp(t, xs, ys)

drone_env = env_points([(0, 0.0), (3, 0.30), (10, 0.34), (T_ACTO2, 0.36),
                        (T_ACTO2 + 3, 0.5), (T_AWE, 0.62), (45, 0.58), (52.4, 0.5),
                        (53.6, 0.06), (54.4, 0.05), (56.5, 0.3), (60, 0.22)])
vib = 1 + 0.006 * np.sin(2 * np.pi * 0.13 * t)
drone = (np.sin(2 * np.pi * 65.41 * t * vib) * 0.5
         + np.sin(2 * np.pi * 98.0 * t * vib + 0.7) * 0.3
         + np.sin(2 * np.pi * 130.81 * t * vib + 1.3) * 0.16)
drone *= drone_env * 0.42

# ── RÍO (ruido pasabanda ≈ cascada de electrones) — FIR simple determinista ──
noise = rng.standard_normal(N).astype(np.float64)
# pasabanda por diferencia de medias móviles (barato y suficiente)
def smooth(x, w):
    k = int(w); c = np.cumsum(np.concatenate(([0.0], x)))
    y = (c[k:] - c[:-k]) / k
    return np.concatenate((np.full(k - 1, y[0]), y))
lp_hi = smooth(noise, SR // 3000)   # quita >3 kHz
lp_lo = smooth(noise, SR // 600)    # quita >600 Hz
rio_raw = lp_hi - lp_lo
rio_raw /= (np.abs(rio_raw).max() + 1e-9)
# envolvente del gate con ataque 60 ms / release 150 ms (one-pole asimétrico)
env = np.empty(N); e = 0.0
ka = 1 - np.exp(-1 / (SR * 0.06)); kr = 1 - np.exp(-1 / (SR * 0.15))
gN = np.interp(t, tg, gg)
for i in range(N):
    target = gN[i]
    e += (ka if target > e else kr) * (target - e)
    env[i] = e
rio = rio_raw * env * 0.30
# el río también se desvanece con el héroe en el acto 2 (se vuelve estrella)
rio *= env_points([(0, 1), (T_ACTO2 + 4, 1), (T_ACTO2 + 10, 0.15), (T_REGRESO, 0.15), (T_REGRESO + 4, 0.9), (60, 0.9)])

# ── CLICS (thump + tick por flanco) ──
clicks = np.zeros(N)
for e0 in edges:
    i0 = int(e0 * SR)
    n1 = int(0.14 * SR)
    seg = np.arange(n1) / SR
    thump = np.sin(2 * np.pi * 55 * seg) * np.exp(-seg / 0.045) * 0.8
    n2 = int(0.012 * SR)
    seg2 = np.arange(n2) / SR
    tick = np.sin(2 * np.pi * 1800 * seg2) * np.exp(-seg2 / 0.003) * 0.5
    end1 = min(N, i0 + n1); clicks[i0:end1] += thump[:end1 - i0]
    end2 = min(N, i0 + n2); clicks[i0:end2] += tick[:end2 - i0]

# ── SHIMMER (la multiplicación se oye: chispas pentatónicas densificándose) ──
shimmer = np.zeros(N)
freqs = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0]   # C6 D6 E6 G6 A6
t0s = T_ACTO2 + 0.5
n_sparks = 260
for k in range(n_sparks):
    frac = k / n_sparks
    tk = t0s + (T_REGRESO + 3 - t0s) * (frac ** 0.62)   # se densifica
    fk = freqs[int(rng.integers(0, len(freqs)))] * (2 if rng.random() < 0.25 else 1)
    dur = 0.35
    i0 = int(tk * SR); n1 = int(dur * SR)
    if i0 + n1 >= N: continue
    seg = np.arange(n1) / SR
    amp = 0.05 + 0.05 * min(1.0, (tk - t0s) / 10)
    shimmer[i0:i0 + n1] += np.sin(2 * np.pi * fk * seg) * np.exp(-seg / 0.09) * amp

# ── mezcla estéreo (río ancho, drone centro, clics centro, shimmer ancho) ──
L = drone + rio * 1.0 + clicks + shimmer * 1.0
R = drone + np.roll(rio, int(0.011 * SR)) * 1.0 + clicks + np.roll(shimmer, int(0.017 * SR))
mix = np.stack([L, R], axis=1)
peak = np.abs(mix).max()
mix = mix / peak * 0.82          # headroom para la voz
mix16 = (mix * 32767).astype(np.int16)

import wave
out = sys.argv[1] if len(sys.argv) > 1 else 'transistor-bed.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(mix16.tobytes())
print(f'✓ {out} ({DUR:.0f}s, {len(edges)} clics, pico {peak:.2f})')
