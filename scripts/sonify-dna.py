#!/usr/bin/env python3
"""
sonify-dna.py — El CÁNTICO del ADN. No es el sonido de moléculas: es propio.

Dos capas honestas:
  1) MELODÍA = la SECUENCIA REAL de bases mapeada a una escala pentatónica
     (música de ADN de verdad: cada letra A/T/G/C → una nota, leída 5'→3').
  2) PAD CORAL = voces sostenidas tipo coro (vocal "ahh" con formantes + vibrato
     + detune de coro) sobre un acorde — lo sacro, "esto eres tú".

El reverb/echo lo pone la cadena de audio de render-local (queda catedralicio).

Uso:  python3 sonify-dna.py <key> <salida.wav> [duración_s]
"""
import sys
import numpy as np
from scipy.io import wavfile

SR = 48000

# Secuencias reales (mismas 18 bp que renderiza precompute-dna.ts)
SEQS = {
    'brca1':    'ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAA',      # 36 bp del gen supresor de tumores
    'telomero': 'TTAGGGTTAGGGTTAGGGTTAGGGTTAGGGTTAGGG',      # TTAGGG×6 (extremo de los cromosomas)
    'tata':     'CGGATATAAAACGGCTAGCGGATATAAAACGGCTAG',      # caja TATA ×2 (promotor)
}

# Bases → pentatónica mayor de Do (consonante, tranquila)
NOTE = {'A': 261.63, 'T': 293.66, 'G': 329.63, 'C': 392.00}   # C4 D4 E4 G4


def voice(freq, t, vibrato=4.5, vdepth=0.004):
    """Una voz tipo coro CÁLIDA: redonda, pocos armónicos (no estridente)."""
    vib = 1.0 + vdepth * np.sin(2 * np.pi * vibrato * t)
    f = freq * vib
    # vocal "ooh/ahh" suave — armónicos altos muy bajos para que NO suene fantasmal
    h = (1.00 * np.sin(2 * np.pi * f * t)
         + 0.32 * np.sin(2 * np.pi * 2 * f * t)
         + 0.12 * np.sin(2 * np.pi * 3 * f * t)
         + 0.04 * np.sin(2 * np.pi * 4 * f * t))
    return h


def choir(freq, t):
    """Coro = 3 voces con detune APRETADO (cálido, no eerie)."""
    return (voice(freq, t, 4.2, 0.004)
            + voice(freq * 1.002, t, 4.7, 0.005)
            + voice(freq * 0.998, t, 3.8, 0.004)) / 3.0


def main():
    key = (sys.argv[1] if len(sys.argv) > 1 else 'brca1').lower()
    out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/dna.wav'
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 26.0
    seq = SEQS.get(key, SEQS['brca1'])

    n = int(SR * dur)
    t = np.arange(n) / SR
    mix = np.zeros(n, dtype=np.float64)

    # ── PAD CORAL: Do mayor en registro MEDIO (Do3-Sol3-Do4-Mi4) — cálido y
    # luminoso, sin el rumble grave que daba miedo. Swell lento. ──
    pad = np.zeros(n)
    for f in (130.81, 196.00, 261.63, 329.63):
        pad += choir(f, t)
    pad /= 4.0
    swell = 0.5 - 0.5 * np.cos(2 * np.pi * t / dur)          # entra y sale suave
    swell = 0.35 + 0.65 * swell
    mix += pad * 0.55 * swell

    # ── MELODÍA: la secuencia, una nota por base, voz de coro más clara ──
    nb = len(seq)
    step = dur / nb
    for i, b in enumerate(seq):
        f = NOTE.get(b, 261.63) * 1.5                        # una quinta arriba (canta encima, sin chillar)
        t0, t1 = i * step, (i + 1) * step
        s0, s1 = int(t0 * SR), int(min(t1, dur) * SR)
        seg_t = t[s0:s1] - t0
        if len(seg_t) == 0:
            continue
        # envolvente de nota cantada (ataque suave, caída larga, legato)
        env = np.minimum(1.0, seg_t / 0.18) * np.exp(-seg_t / (step * 0.9))
        mix[s0:s1] += choir(f, seg_t) * env * 0.32

    # normaliza + fade de entrada/salida
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = (mix / peak * 0.82)
    fade = int(SR * 0.6)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)

    wavfile.write(out, SR, mix.astype(np.float32))
    print(f"wrote {out}  ({dur}s)  cántico ADN · secuencia={seq}")


if __name__ == '__main__':
    main()
