#!/usr/bin/env python3
"""
sonify-dna.py — La MÚSICA del ADN. Cálida y de ASOMBRO, no de terror.

Dos capas honestas:
  1) MELODÍA = la SECUENCIA REAL de bases, una nota por letra (A/T/G/C → nota de
     una escala pentatónica), en timbre de CAJA DE MÚSICA / celesta (brillante,
     tierno) — música de ADN de verdad.
  2) PAD cálido suave por debajo (cuerdas tenues, mayor) — solo calor, sin coro
     embrujado ni rumble grave.

Uso:  python3 sonify-dna.py <key> <salida.wav> [duración_s]
"""
import sys
import numpy as np
from scipy.io import wavfile

SR = 48000

# Secuencias reales (mismas 36 bp que renderiza precompute-dna.ts)
SEQS = {
    'brca1':    'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAA',      # gen supresor de tumores
    'telomero': 'TTAGGGTTAGGGTTAGGGTTAGGGTTAGGGTTAGGG',      # extremo de los cromosomas
    'tata':     'CGGATATAAAACGGCTAGCGGATATAAAACGGCTAG',      # caja TATA (promotor)
}

# Bases → pentatónica mayor de Do (consonante, dulce)
NOTE = {'A': 523.25, 'T': 587.33, 'G': 659.25, 'C': 783.99}   # C5 D5 E5 G5 (registro de caja de música)


def music_box(freq, t):
    """Timbre de caja de música / celesta: fundamental brillante + campana."""
    return (1.00 * np.sin(2 * np.pi * freq * t)
            + 0.50 * np.sin(2 * np.pi * 2.0 * freq * t)
            + 0.22 * np.sin(2 * np.pi * 3.0 * freq * t)
            + 0.10 * np.sin(2 * np.pi * 4.2 * freq * t))   # inarmónico leve = "ding"


def pad(freq, t):
    """Pad cálido suave (cuerdas tenues), sin formantes de coro."""
    return (np.sin(2 * np.pi * freq * t)
            + 0.30 * np.sin(2 * np.pi * 2 * freq * t)
            + 0.10 * np.sin(2 * np.pi * 3 * freq * t))


def main():
    key = (sys.argv[1] if len(sys.argv) > 1 else 'brca1').lower()
    out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/dna.wav'
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 26.0
    seq = SEQS.get(key, SEQS['brca1'])

    n = int(SR * dur)
    t = np.arange(n) / SR
    mix = np.zeros(n, dtype=np.float64)

    # ── PAD cálido: Do mayor abierto (Do4-Sol4-Do5), tenue y estable ──
    p = pad(261.63, t) + pad(392.00, t) + 0.6 * pad(523.25, t)
    swell = 0.55 + 0.45 * (0.5 - 0.5 * np.cos(2 * np.pi * t / dur))
    mix += p * 0.16 * swell

    # ── MELODÍA caja de música: la secuencia, una nota por base, brillante y tierna ──
    nb = len(seq)
    step = dur / nb
    for i, b in enumerate(seq):
        f = NOTE.get(b, 523.25)
        t0 = i * step
        s0, s1 = int(t0 * SR), int(min(t0 + step * 2.0, dur) * SR)   # cola que se solapa (legato dulce)
        seg = t[s0:s1] - t0
        if len(seg) == 0:
            continue
        # envolvente de caja de música: ataque casi instantáneo, decaimiento de campana
        env = np.minimum(1.0, seg / 0.004) * np.exp(-seg / (step * 0.75))
        mix[s0:s1] += music_box(f, seg) * env * 0.40

    # normaliza + fade
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = mix / peak * 0.80
    fade = int(SR * 0.5)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)

    wavfile.write(out, SR, mix.astype(np.float32))
    print(f"wrote {out}  ({dur}s)  música ADN (caja de música) · secuencia={seq}")


if __name__ == '__main__':
    main()
