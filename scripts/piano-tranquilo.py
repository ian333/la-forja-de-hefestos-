#!/usr/bin/env python3
"""
piano-tranquilo.py — PIANO PROFUNDO y TRANQUILO determinista para los reels de
agujero negro (cama musical contemplativa, NO el drama Interstellar del comercial).

Dos modos:
  compose <out.mid>          -> compone la pieza: progresión modal lenta (vi-IV-I-V
                                en Do), registro GRAVE (bajos en octava 2 = profundo),
                                pedal de resonancia legato, dinámica suave, mucho
                                espacio entre notas = tranquilidad.
  master  <raw.wav> <bed.wav> -> post: calor (lowpass + realce de graves) + reverb de
                                sala grande por CONVOLUCIÓN (cola oscura) + fades +
                                normalización con headroom.

El render real (MIDI -> WAV) lo hace fluidsynth con FluidR3_GM (piano de cola), entre
los dos modos. Todo DETERMINISTA (semilla fija) — fiel a la doctrina del proyecto.
"""
import sys, struct
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000

# ---------------- escritor MIDI mínimo (sin deps) ----------------
def _vlq(n):
    b = bytearray([n & 0x7F]); n >>= 7
    while n:
        b.append((n & 0x7F) | 0x80); n >>= 7
    b.reverse(); return bytes(b)

class MIDI:
    def __init__(self, tpq=480):
        self.tpq = tpq; self.ev = []
    def _add(self, t, order, data): self.ev.append((int(t), order, bytes(data)))
    def prog(self, t, p, ch=0): self._add(t, 0, [0xC0 | ch, p])
    def cc(self, t, c, v, ch=0): self._add(t, 0, [0xB0 | ch, c, v])
    def note(self, t, dur, n, vel, ch=0):
        self._add(t, 1, [0x90 | ch, n, vel]); self._add(t + dur, 0, [0x80 | ch, n, 0])
    def write(self, path, bpm):
        tempo = int(60_000_000 / bpm)
        trk = bytearray()
        trk += _vlq(0) + bytes([0xFF, 0x51, 0x03]) + struct.pack(">I", tempo)[1:]
        prev = 0
        for t, order, data in sorted(self.ev, key=lambda e: (e[0], e[1])):
            trk += _vlq(t - prev) + data; prev = t
        trk += _vlq(0) + bytes([0xFF, 0x2F, 0x00])
        with open(path, 'wb') as f:
            f.write(b'MThd' + struct.pack(">IHHH", 6, 0, 1, self.tpq))
            f.write(b'MTrk' + struct.pack(">I", len(trk)) + trk)

def compose(path):
    tpq = 480; m = MIDI(tpq); bar = tpq * 4
    m.prog(0, 0)  # 0 = Acoustic Grand Piano
    # Am7 - Fmaj7 - Cmaj7 - G6  (vi-IV-I-V en Do): consonante, contemplativo.
    # (bajo octava 2 = PROFUNDO; acorde octava 3-4; melodía dispersa octava 4-5)
    PROG = [
        (45, [57, 60, 64, 67], [(2.0, 76, 1.6), (3.2, 72, 1.2)]),   # Am7
        (41, [53, 57, 60, 65], [(2.0, 72, 1.6), (3.4, 69, 1.0)]),   # Fmaj7
        (36, [48, 52, 55, 59], [(1.6, 67, 1.6), (3.0, 76, 1.2)]),   # Cmaj7
        (43, [50, 55, 59, 64], [(2.0, 74, 1.6), (3.2, 71, 1.0)]),   # G6
    ]
    nbars = 8; t = 0
    for i in range(nbars):
        bass, chord, mel = PROG[i % 4]
        vel = 42 + (2 if i % 2 else 0)
        if i > 0: m.cc(t - 3, 64, 0)        # suelta pedal justo antes del cambio
        m.cc(t, 64, 127)                    # re-pedaleo legato en el tiempo fuerte
        m.note(t, bar - 4, bass, min(60, vel + 8))
        if i % 2 == 0: m.note(t, bar - 4, bass - 12, vel)   # sub-octava = más cuerpo
        for k, n in enumerate(chord):       # acorde ligeramente roto (más natural)
            m.note(t + int(tpq * 0.03 * k), bar - int(tpq * 0.12), n, vel)
        for off, n, dur in mel:             # melodía dispersa (espacio = calma)
            m.note(t + int(off * tpq), int(dur * tpq), n, vel + 9)
        t += bar
    # resolución tranquila a Do (acorde largo + sub grave)
    m.cc(t - 3, 64, 0); m.cc(t, 64, 127)
    for n in (36, 48, 52, 55, 60): m.note(t, bar * 2, n, 40)
    m.note(t, bar * 2, 24, 36)
    m.cc(t + bar * 2, 64, 0)
    m.write(path, bpm=52)
    print(f"[compose] {path} · 52bpm · {nbars + 2} bars (~{(nbars+2)*4*60/52:.0f}s)")

# ---------------- reverb de sala + master ----------------
def make_ir(seconds=3.4, decay=4.0, predelay_ms=18):
    rng = np.random.default_rng(7)
    n = int(SR * seconds); t = np.arange(n) / SR
    env = np.exp(-decay * t)
    L = rng.standard_normal(n) * env; R = rng.standard_normal(n) * env
    sos = butter(2, 4500 / (SR / 2), btype='low', output='sos')   # cola cálida/oscura
    L = sosfilt(sos, L); R = sosfilt(sos, R)
    pd = int(SR * predelay_ms / 1000)
    L = np.concatenate([np.zeros(pd), L]); R = np.concatenate([np.zeros(pd), R])
    ir = np.stack([L, R], axis=1); ir /= np.max(np.abs(ir)) + 1e-9
    return ir

def _load(path):
    sr, x = wavfile.read(path)
    if x.dtype == np.int16: x = x.astype(np.float64) / 32768.0
    elif x.dtype == np.int32: x = x.astype(np.float64) / 2147483648.0
    else: x = x.astype(np.float64)
    if x.ndim == 1: x = np.stack([x, x], axis=1)
    return sr, x

def master(raw_path, out_path, wet=0.42):
    sr, x = _load(raw_path)
    lp = butter(2, 7000 / (sr / 2), btype='low', output='sos')        # calor
    x = np.stack([sosfilt(lp, x[:, 0]), sosfilt(lp, x[:, 1])], axis=1)
    bs = butter(2, 160 / (sr / 2), btype='low', output='sos')          # realce graves
    low = np.stack([sosfilt(bs, x[:, 0]), sosfilt(bs, x[:, 1])], axis=1)
    x = x + 0.5 * low                                                  # PROFUNDO
    ir = make_ir()
    w = np.stack([fftconvolve(x[:, 0], ir[:, 0])[:len(x)],
                  fftconvolve(x[:, 1], ir[:, 1])[:len(x)]], axis=1)
    w /= np.max(np.abs(w)) + 1e-9
    y = (1 - wet) * x + wet * w
    fi = int(sr * 0.05); fo = int(sr * 0.9)
    env = np.ones(len(y))
    env[:fi] = np.linspace(0, 1, fi); env[-fo:] = np.linspace(1, 0, fo)
    y *= env[:, None]
    y *= (10 ** (-3 / 20)) / (np.max(np.abs(y)) + 1e-9)                # -3 dBFS headroom
    wavfile.write(out_path, sr, (y * 32767).astype(np.int16))
    print(f"[master] {out_path} · {len(y)/sr:.1f}s · wet={wet}")

if __name__ == '__main__':
    if sys.argv[1] == 'compose': compose(sys.argv[2])
    elif sys.argv[1] == 'master': master(sys.argv[2], sys.argv[3])
    else: print("uso: piano-tranquilo.py compose <mid> | master <raw.wav> <bed.wav>")
