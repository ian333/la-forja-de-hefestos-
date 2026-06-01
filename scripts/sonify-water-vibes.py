#!/usr/bin/env python3
"""
sonify-water-vibes.py — Música compuesta de los 3 modos vibracionales del agua.

Pedagógico: cada modo suena SOLO en su ventana (sincronizado con la animación
de la molécula doblándose/estirándose), con su frecuencia REAL mapeada a audible.
Así "se entiende qué vibra con qué": ves el modo y oyes su tono.

Modos del agua (cm⁻¹): ν₂ flexión 1595 · ν₁ str. simétrico 3657 · ν₃ str. asimétrico 3756.
Frecuencia óptica ν = c·ν̃ ; bajamos 38 octavas → rango audible (razones preservadas).

Estructura (alineada con modeAmps de CinematicMolecule.tsx):
  0.0–3.5  intro (dron suave)
  3.5–6.4  FLEXIÓN  (grave)
  6.4–9.3  SIMÉTRICO
  9.3–12.2 ASIMÉTRICO (bate con el simétrico — están a un semitono)
  12.5–end LOS TRES JUNTOS (acorde del agua)

Uso: python3 sonify-water-vibes.py <salida.wav> [dur]
"""
import sys
import numpy as np
from scipy.io import wavfile

C_LIGHT = 2.99792458e8
SR = 48000
OCTAVES_DOWN = 38

# (nombre, wavenumber cm⁻¹, [t0, t1] ventana)
MODES = [
    ('flexion',   1595.0, 3.5, 6.4),
    ('simetrico', 3657.0, 6.4, 9.3),
    ('asimetrico',3756.0, 9.3, 12.2),
]
ALL_START = 12.5


def wavenum_to_hz(wn_cm):
    nu = C_LIGHT * (wn_cm * 100.0)   # Hz óptico (cm⁻¹ → m⁻¹ → Hz)
    return nu / (2.0 ** OCTAVES_DOWN)


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def voice(t, f, amp_env, warmth=0.12):
    """Tono suave: senoide + armónico leve + 2 sub-voces detune (calidez)."""
    out = np.zeros_like(t)
    for cents in (-3.0, 3.0):
        fk = f * 2.0 ** (cents / 1200.0)
        w = np.sin(2 * np.pi * fk * t) + warmth * np.sin(2 * np.pi * 2 * fk * t)
        out += w * 0.5
    # vibrato sutil (la molécula "respira")
    vib = 1.0 + 0.015 * np.sin(2 * np.pi * 5.0 * t)
    return out * amp_env * vib


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/water-vibes.wav'
    dur = float(sys.argv[2]) if len(sys.argv) > 2 else 18.0
    n = int(SR * dur)
    t = np.arange(n) / SR
    mix = np.zeros(n)

    freqs = {name: wavenum_to_hz(wn) for name, wn, _, _ in MODES}
    print('Frecuencias audibles:')
    for name, wn, _, _ in MODES:
        print(f'  {name:>11}: {wn:.0f} cm⁻¹ → {freqs[name]:6.1f} Hz')

    # Cada modo en su ventana
    for name, wn, t0, t1 in MODES:
        f = freqs[name]
        env = smoothstep((t - t0) / 0.5) * (1 - smoothstep((t - (t1 - 0.5)) / 0.5))
        mix += voice(t, f, env, warmth=0.10 if f < 250 else 0.05)

    # Los tres juntos al final (el "acorde" real del agua)
    allenv = smoothstep((t - ALL_START) / 0.6) * smoothstep((dur - t) / 1.2)
    for name, wn, _, _ in MODES:
        mix += voice(t, freqs[name], allenv * 0.6)

    # Dron de base muy suave durante toda la pieza (sostén contemplativo)
    base = wavenum_to_hz(1595.0) / 2.0   # una octava bajo la flexión
    drone = np.sin(2 * np.pi * base * t) * (0.18 * smoothstep(t / 2.0) * smoothstep((dur - t) / 1.5))
    mix += drone

    peak = np.max(np.abs(mix)) or 1.0
    audio = (mix / peak * 0.8).astype(np.float32)
    wavfile.write(out, SR, audio)
    print(f'✓ {out}  ({dur}s)')


if __name__ == '__main__':
    main()
