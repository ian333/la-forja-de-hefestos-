#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
musica-viaje.py — pieza de piano (JSON de notas en segundos) → MIDI → fluidsynth
(FluidR3_GM, piano de cola) → master cálido (lowpass + reverb conv + fades) →
MEZCLA con la narración con DUCKING por ventanas de voz (segs.json).

Uso:
  python3 scripts/musica-viaje.py midi   <notas.json> <out.mid>
  python3 scripts/musica-viaje.py master <raw.wav> <bed.wav> [dur]
  python3 scripts/musica-viaje.py mix    <narracion.(mp3|wav)> <bed.wav> <segs.json> <out.wav> [dur]

(midi corre donde sea; el render fluidsynth va en iangpu:
  fluidsynth -ni -F raw.wav -r 48000 /usr/share/sounds/sf2/FluidR3_GM.sf2 out.mid)
"""
import sys, json, struct, subprocess
import numpy as np

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
    def prog(self, t, p, ch=0): self._add(t, 0, [0xC0 | ch, p])
    def cc(self, t, c, v, ch=0): self._add(t, 0, [0xB0 | ch, c, v])
    def note(self, t, dur, n, vel, ch=0):
        self._add(t, 1, [0x90 | ch, n, vel]); self._add(t + max(1, dur), 0, [0x80 | ch, n, 0])
    def write(self, path, bpm=60):
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


def cmd_midi(notes_json, out_mid):
    piece = json.load(open(notes_json))
    tpq = 480  # a 60 bpm: 1 beat = 1 s → ticks = segundos*480 (exacto y simple)
    m = MIDI(tpq); m.prog(0, 0)
    for p in piece.get('pedal', []):
        m.cc(int(p['t'] * tpq), 64, 127 if p['down'] else 0)
    for n in piece['notes']:
        m.note(int(n['t'] * tpq), int(n['d'] * tpq), int(n['n']), max(1, min(127, int(n['v']))))
    m.write(out_mid, bpm=60)
    print(f"midi ok: {out_mid}  notas={len(piece['notes'])}  título={piece.get('title','?')}")


def _read_wav(path):
    from scipy.io import wavfile
    sr, x = wavfile.read(path)
    if x.dtype == np.int16: x = x.astype(np.float32) / 32768.0
    elif x.dtype == np.int32: x = x.astype(np.float32) / 2147483648.0
    else: x = x.astype(np.float32)
    if x.ndim == 1: x = np.stack([x, x], axis=1)
    if sr != SR:
        n2 = int(round(x.shape[0] * SR / sr))
        idx = np.linspace(0, x.shape[0] - 1, n2)
        x = np.stack([np.interp(idx, np.arange(x.shape[0]), x[:, c]) for c in range(2)], axis=1).astype(np.float32)
    return x


def _write_wav(path, x):
    from scipy.io import wavfile
    wavfile.write(path, SR, np.clip(x, -1, 1).astype(np.float32))


def cmd_master(raw_wav, out_wav, dur=78.0):
    from scipy.signal import butter, sosfilt, fftconvolve
    x = _read_wav(raw_wav)
    n = int(dur * SR)
    x = x[:n] if x.shape[0] >= n else np.vstack([x, np.zeros((n - x.shape[0], 2), np.float32)])
    sos = butter(2, 7500, 'low', fs=SR, output='sos')          # calor (lima brillo digital)
    x = sosfilt(sos, x, axis=0).astype(np.float32)
    rng = np.random.default_rng(7)
    ir_n = int(2.6 * SR)                                        # reverb sala grande, cola oscura
    t = np.arange(ir_n) / SR
    ir = (rng.standard_normal((ir_n, 2)) * np.exp(-t / 0.9)[:, None]).astype(np.float32)
    ir = sosfilt(butter(2, 3800, 'low', fs=SR, output='sos'), ir, axis=0).astype(np.float32)
    ir *= 0.05 / (np.abs(ir).max() + 1e-9)
    wet = fftconvolve(x, ir, mode='full', axes=0)[:n].astype(np.float32)
    y = x + wet * 0.9
    fade = int(0.8 * SR); tail = int(3.0 * SR)
    y[:fade] *= np.linspace(0, 1, fade)[:, None]
    y[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 1.5
    y *= 0.5 / (np.abs(y).max() + 1e-9)                        # headroom
    _write_wav(out_wav, y)
    print(f"master ok: {out_wav}  dur={dur}s")


def cmd_mix(narr_path, bed_wav, segs_json, out_wav, dur=78.0):
    n = int(dur * SR)
    if not narr_path.endswith('.wav'):
        subprocess.run(['ffmpeg', '-y', '-i', narr_path, '-ar', str(SR), '/tmp/_narr48.wav'],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        narr_path = '/tmp/_narr48.wav'
    narr = _read_wav(narr_path); bed = _read_wav(bed_wav)
    pad = lambda a: a[:n] if a.shape[0] >= n else np.vstack([a, np.zeros((n - a.shape[0], 2), np.float32)])
    narr, bed = pad(narr), pad(bed)
    # DUCKING por ventanas de voz reales: piano 0.16 bajo la voz, 0.30 en los huecos
    segs = json.load(open(segs_json))
    env = np.full(n, 0.30, np.float32)
    for s in segs:
        a, b = int(s['start'] * SR), int(s['end'] * SR)
        env[max(0, a):min(n, b)] = 0.16
    k = int(0.35 * SR)                                          # rampas suaves 0.35s
    env = np.convolve(env, np.ones(k, np.float32) / k, mode='same')
    y = narr + bed * env[:, None]
    peak = np.abs(y).max()
    if peak > 0.97: y *= 0.97 / peak
    _write_wav(out_wav, y)
    print(f"mix ok: {out_wav}  peak={peak:.2f}")


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'midi': cmd_midi(sys.argv[2], sys.argv[3])
    elif cmd == 'master': cmd_master(sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 78.0)
    elif cmd == 'mix': cmd_mix(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], float(sys.argv[6]) if len(sys.argv) > 6 else 78.0)
    else: sys.exit('cmd: midi|master|mix')
