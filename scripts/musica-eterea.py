#!/usr/bin/env python3
"""
musica-eterea.py — Música ETÉREA / ANGELICAL determinista para cine de agujero
negro (cama celestial, NO el piano íntimo ni el drama Interstellar).

INVESTIGACIÓN MUSICAL aplicada:
  · MODO LIDIO (C Lydian: C D E F# G A B). La 4ª AUMENTADA (F#) es el color del
    "asombro/lo celestial" en el scoring de cine — flota, no resuelve a tierra.
  · Voces de CORO (aah) como cuerpo angelical + PAD cálido + SHIMMER de cristal en
    las notas lidias altas (F#, A, D, E) = luz. DRONE grave (C1/C2) que ancla
    (lo "profundo" que pediste) bajo voces que flotan arriba.
  · SWELLS por expresión (CC11) = respiración angelical (cresc/decresc lentos).
  · Reverb de CATEDRAL por convolución (cola larga, con aire) = espacio infinito.

Modos:
  compose <out.mid> [total_s]   -> compone la pieza (multi-canal GM).
  master  <raw.wav> <bed.wav>   -> reverb catedral + brillo/aire + graves + swell + norm.
Render real (MIDI->WAV) lo hace fluidsynth con FluidR3_GM. Todo DETERMINISTA.
"""
import sys, struct
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000

def _vlq(n):
    b = bytearray([n & 0x7F]); n >>= 7
    while n:
        b.append((n & 0x7F) | 0x80); n >>= 7
    b.reverse(); return bytes(b)

class MIDI:
    def __init__(self, tpq=480):
        self.tpq = tpq; self.ev = []
    def _add(self, t, order, data): self.ev.append((int(t), order, bytes(data)))
    def prog(self, t, p, ch): self._add(t, 0, [0xC0 | ch, p])
    def cc(self, t, c, v, ch): self._add(t, 0, [0xB0 | ch, c, int(max(0, min(127, v)))])
    def ramp(self, c, t0, t1, v0, v1, ch, steps=24):
        for i in range(steps + 1):
            f = i / steps
            self.cc(int(t0 + f * (t1 - t0)), c, v0 + f * (v1 - v0), ch)
    def note(self, t, dur, n, vel, ch):
        self._add(t, 1, [0x90 | ch, n, vel]); self._add(t + dur, 0, [0x80 | ch, n, 0])
    def write(self, path, bpm):
        tempo = int(60_000_000 / bpm); trk = bytearray()
        trk += _vlq(0) + bytes([0xFF, 0x51, 0x03]) + struct.pack(">I", tempo)[1:]
        prev = 0
        for t, order, data in sorted(self.ev, key=lambda e: (e[0], e[1])):
            trk += _vlq(t - prev) + data; prev = t
        trk += _vlq(0) + bytes([0xFF, 0x2F, 0x00])
        with open(path, 'wb') as f:
            f.write(b'MThd' + struct.pack(">IHHH", 6, 0, 1, self.tpq))
            f.write(b'MTrk' + struct.pack(">I", len(trk)) + trk)

# canales
CHOIR, PADW, CRYS, DRONE = 0, 1, 2, 3

def compose(path, total_s=38.0):
    bpm = 50; tpq = 480; m = MIDI(tpq)
    sec = lambda s: int(s / (60.0 / bpm) * tpq)   # segundos -> ticks
    T = sec(total_s)
    m.prog(0, 52, CHOIR)   # Choir Aahs
    m.prog(0, 89, PADW)    # Pad 2 (warm)
    m.prog(0, 98, CRYS)    # FX 3 (crystal) — shimmer
    m.prog(0, 88, DRONE)   # Pad 1 (new age) — drone grave
    for ch in (CHOIR, PADW, CRYS, DRONE):
        m.cc(0, 91, 115, ch)   # reverb send alto
        m.cc(0, 93, 64, ch)    # chorus (ancho)
        m.cc(0, 7, 100, ch)    # volumen base
        m.cc(0, 11, 0, ch)     # expresión arranca en 0 (entra por swell)

    # DRONE grave: C1 + C2 sostenido toda la pieza (ancla profunda)
    m.note(0, T, 24, 70, DRONE); m.note(0, T, 36, 64, DRONE)
    m.ramp(11, 0, sec(6), 0, 95, DRONE); m.ramp(11, sec(total_s-4), T, 95, 70, DRONE)

    # FASE 1 (0..~0.52T) — la caída: Cmaj lidio que entra suave
    p1 = int(T * 0.52)
    for n, v in [(60, 70), (64, 66), (67, 64)]:            # C4 E4 G4
        m.note(0, p1, n, v, CHOIR)
    for n in (48, 55, 64):                                  # pad cálido medio
        m.note(0, p1, n, 60, PADW)
    m.ramp(11, 0, sec(8), 0, 100, CHOIR)
    m.ramp(11, 0, sec(8), 0, 85, PADW)
    # cristal: destellos lidios dispersos (F#5, A5) — luz que titila
    for ts, n in [(3.5, 78), (6.0, 81), (9.0, 78), (12.0, 86)]:
        m.note(sec(ts), sec(3.0), n, 72, CRYS)
    m.cc(0, 11, 70, CRYS)

    # FASE 2 (~0.52T..~0.78T) — zoom-out / SWELL: se abre el acorde maj9#11 lidio
    p2 = int(T * 0.78)
    for n, v in [(60, 74), (64, 70), (67, 68), (71, 66), (74, 64), (78, 60)]:  # +B4 D5 F#5
        m.note(p1, p2 - p1, n, v, CHOIR)
    for n in (48, 55, 62, 66):
        m.note(p1, p2 - p1, n, 60, PADW)
    m.ramp(11, p1, int(T * 0.66), 100, 127, CHOIR)         # gran swell (grandeza)
    m.ramp(11, int(T * 0.66), p2, 127, 92, CHOIR)
    m.ramp(11, p1, p2, 70, 120, CRYS)
    for ts, n in [(20.5, 86), (22.0, 88), (24.0, 83), (26.0, 90), (28.0, 81)]:  # shimmer denso
        m.note(sec(ts), sec(3.5), n, 78, CRYS)

    # FASE 3 (~0.78T..fin) — flota y resuelve: Cmaj9 alto, etéreo, que se desvanece
    for n, v in [(72, 64), (76, 60), (79, 58), (74, 56), (67, 54)]:  # C5 E5 G5 D5 G4
        m.note(p2, T - p2, n, v, CHOIR)
    for n in (48, 55, 64, 67):
        m.note(p2, T - p2, n, 54, PADW)
    m.ramp(11, p2, int(T * 0.9), 92, 84, CHOIR); m.ramp(11, int(T * 0.9), T, 84, 40, CHOIR)
    m.ramp(11, p2, T, 120, 30, CRYS)
    for ts, n in [(30.5, 88), (33.0, 86), (35.5, 91)]:
        m.note(sec(ts), sec(3.0), n, 64, CRYS)

    m.write(path, bpm=bpm)
    print(f"[compose] {path} · C Lydian · {total_s:.0f}s · coro+pad+cristal+drone")

# ---------------- master: catedral + aire + graves ----------------
def make_ir(seconds=5.0, decay=2.6, predelay_ms=24, cutoff=7000):
    rng = np.random.default_rng(11)
    n = int(SR * seconds); t = np.arange(n) / SR
    env = np.exp(-decay * t)
    L = rng.standard_normal(n) * env; R = rng.standard_normal(n) * env
    sos = butter(2, cutoff / (SR / 2), btype='low', output='sos')   # con AIRE (no oscura)
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

def master(raw_path, out_path, wet=0.5):
    sr, x = _load(raw_path)
    # realce de graves para el drone (PROFUNDO) sin enturbiar
    bs = butter(2, 130 / (sr / 2), btype='low', output='sos')
    low = np.stack([sosfilt(bs, x[:, 0]), sosfilt(bs, x[:, 1])], axis=1)
    x = x + 0.45 * low
    # brillo/aire (high-shelf casero): suma banda alta para el shimmer angelical
    hs = butter(2, 6000 / (sr / 2), btype='high', output='sos')
    hi = np.stack([sosfilt(hs, x[:, 0]), sosfilt(hs, x[:, 1])], axis=1)
    x = x + 0.18 * hi
    ir = make_ir()
    w = np.stack([fftconvolve(x[:, 0], ir[:, 0])[:len(x)],
                  fftconvolve(x[:, 1], ir[:, 1])[:len(x)]], axis=1)
    w /= np.max(np.abs(w)) + 1e-9
    y = (1 - wet) * x + wet * w
    fi = int(sr * 1.2); fo = int(sr * 2.6)
    env = np.ones(len(y)); env[:fi] = np.linspace(0, 1, fi); env[-fo:] = np.linspace(1, 0, fo)
    y *= env[:, None]
    y *= (10 ** (-3 / 20)) / (np.max(np.abs(y)) + 1e-9)
    wavfile.write(out_path, sr, (y * 32767).astype(np.int16))
    print(f"[master] {out_path} · {len(y)/sr:.1f}s · wet={wet} (catedral)")

if __name__ == '__main__':
    if sys.argv[1] == 'compose':
        compose(sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 38.0)
    elif sys.argv[1] == 'master':
        master(sys.argv[2], sys.argv[3])
    else:
        print("uso: musica-eterea.py compose <mid> [seg] | master <raw.wav> <bed.wav>")
