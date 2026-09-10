#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ticks-reloj.py — EL RELOJ: un tic por unidad de tiempo simulado, mezclado sobre la música de la pieza.

Nace en econ-colchon (2026-09-10): durante «Mira» corren 5 años en ~9 s. Cada MES es un tic seco
y cada AÑO un pulso grave (ian: «lo del tic me mama, me recuerda a Interstellar»). Es diseño de
sonido DETERMINISTA: los tics caen exactamente en los cuadros de la simulación (mismo reloj que
`apertura`), así que el oído y el ojo cuentan lo mismo.

  python3 scripts/ticks-reloj.py --musica in.wav --salida out.wav --inicio 18.0 --dur 9.0 \
      --unidades 60 --por-pulso 12 [--nivel 0.55] [--pulso 0.7] [--duck 0.45] [--total 44]

  --inicio/--dur   ventana del reloj en segundos de VIDEO (de segs.json: donde acaba «Mira.»)
  --unidades       tics en la ventana (60 meses)  · --por-pulso  cada cuántos tics va el pulso (12)
  --duck           a cuánto baja la música durante la ventana (0.45 = -7 dB); vuelve con rampa
Salida: wav 48 kHz estéreo, del largo de --total (o de la música si es más larga).
"""
import sys, argparse, wave, struct
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('--musica', required=True); ap.add_argument('--salida', required=True)
ap.add_argument('--inicio', type=float, required=True); ap.add_argument('--dur', type=float, required=True)
ap.add_argument('--unidades', type=int, default=60); ap.add_argument('--por-pulso', type=int, default=12)
ap.add_argument('--nivel', type=float, default=0.55); ap.add_argument('--pulso', type=float, default=0.7)
ap.add_argument('--duck', type=float, default=0.45); ap.add_argument('--total', type=float, default=0)
ap.add_argument('--primer-mes', type=int, default=0, help='mes simulado del primer tic (los pulsos caen en múltiplos de --por-pulso)')
a = ap.parse_args()

SR = 48000
w = wave.open(a.musica, 'rb'); ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
raw = w.readframes(n); w.close()
assert sw == 2, 'espero PCM 16-bit'
mus = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
mus = mus.reshape(-1, ch) if ch > 1 else np.stack([mus, mus], 1)
if sr != SR:   # remuestreo lineal (la música ganadora ya viene a 48 k; esto es red de seguridad)
    t_old = np.arange(len(mus)) / sr; t_new = np.arange(int(len(mus) * SR / sr)) / SR
    mus = np.stack([np.interp(t_new, t_old, mus[:, c]) for c in range(2)], 1)
total = max(a.total, len(mus) / SR)
N = int(total * SR)
out = np.zeros((N, 2), np.float32); out[:min(N, len(mus))] = mus[:N]

# ── ducking: la música baja en la ventana del reloj, con rampas de 0.6 s (el mismo borde que las capas)
env = np.ones(N, np.float32); t = np.arange(N) / SR
r = 0.6
env = np.where((t >= a.inicio) & (t <= a.inicio + a.dur), a.duck, 1.0).astype(np.float32)
for edge, up in ((a.inicio, False), (a.inicio + a.dur, True)):
    m = (t >= edge - r) & (t < edge) if not up else (t >= edge) & (t < edge + r)
    k = (t[m] - (edge - r)) / r if not up else (t[m] - edge) / r
    env[m] = (1.0 + (a.duck - 1.0) * k) if not up else (a.duck + (1.0 - a.duck) * k)
out *= env[:, None]

# ── el tic: golpe seco (ruido filtrado 4 ms) · el pulso: seno grave 55 Hz con cola de 0.35 s
rng = np.random.default_rng(3)
def tic():
    L = int(0.004 * SR); x = rng.standard_normal(L).astype(np.float32)
    x = np.convolve(x, np.ones(6) / 6, 'same')                       # quita el siseo agudo
    return x * np.exp(-np.arange(L) / (0.0012 * SR)) * 0.9
def pulso():
    L = int(0.35 * SR); tt = np.arange(L) / SR
    return (np.sin(2 * np.pi * 55 * tt) * np.exp(-tt / 0.09)).astype(np.float32)
paso = a.dur / a.unidades
for i in range(a.unidades + 1):                       # el tic 0 abre la ventana; el 60 la cierra
    t0 = a.inicio + i * paso; s0 = int(t0 * SR)
    if s0 >= N: break
    g = tic() * a.nivel; e = min(N, s0 + len(g)); out[s0:e] += g[:e - s0, None]
    mes = a.primer_mes + i
    if mes > 0 and mes % a.por_pulso == 0:
        p = pulso() * a.pulso; e = min(N, s0 + len(p)); out[s0:e] += p[:e - s0, None]

out = np.clip(out, -0.98, 0.98)
w = wave.open(a.salida, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out * 32767).astype('<i2').tobytes()); w.close()
print(f'✓ {a.salida}: {total:.1f} s · {a.unidades} tics de {a.inicio:.2f} a {a.inicio + a.dur:.2f} s · pulso cada {a.por_pulso} · duck {a.duck}')
