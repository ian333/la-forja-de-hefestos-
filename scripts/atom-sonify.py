#!/usr/bin/env python3
"""
atom-sonify.py — Sonificación del espectro real de cada elemento, hecha hermosa.

El espectro de emisión medido (líneas en nm) decide QUÉ notas suenan: bajamos
ν=c/λ por octavas hasta el rango audible. Pero en vez de dejar las razones
crudas (que dan clusters disonantes = terror), las CUANTIZAMOS a una escala
pentatónica mayor — sin semitonos ni tritonos, imposible que suene tenebrosa.

Resultado: cada átomo elige un patrón de notas distinto según su física, pero
todo cae en una paleta consonante y cálida. Curiosidad + tranquilidad.

Capas:
  · pad-drone   : tónica + quinta + octava cálidas, sostenidas (el lecho tranquilo)
  · voces espectrales: las líneas del átomo, cuantizadas, en pad suave
  · campanas    : las líneas agudas como destellos espaciados (curiosidad)
  · sub         : una octava bajo la tónica, suave (cuerpo)

Uso:  python3 atom-sonify.py <símbolo> <salida.wav> [duración_s]
"""
import sys
import numpy as np
from scipy.io import wavfile

C_LIGHT = 2.99792458e8
SR = 48000

# Líneas de emisión reales (NIST, líneas fuertes) en nm + peso de intensidad.
# Líneas de emisión reales (NIST, líneas fuertes) en nm + peso de intensidad.
# IR (nm grande) → graves/drone · UV (nm chico) → campanas agudas.
SPECTRA = {
    'H': [   # las tres series icónicas del hidrógeno
        (1875.1, 0.60), (1281.8, 0.50),                      # Paschen (IR)
        (656.279, 0.90), (486.135, 0.70), (434.047, 0.50),   # Balmer (visible, la rosa)
        (121.567, 1.00), (102.572, 0.60),                    # Lyman (UV)
    ],
    'He': [  # He I
        (1083.0, 0.85),                                      # IR, la más fuerte
        (706.5, 0.55), (667.8, 0.65), (587.6, 0.90),         # D3 amarilla
        (501.6, 0.50), (447.1, 0.55), (388.9, 0.60),         # UV-violeta
    ],
    'Li': [  # Li I
        (812.6, 0.55),                                       # IR
        (670.8, 1.0), (610.4, 0.55),                         # roja icónica (doblete)
        (460.3, 0.45), (323.3, 0.50),                        # UV
    ],
    'Be': [  # Be I
        (457.3, 0.55), (332.1, 0.70), (313.0, 0.50), (234.9, 0.90),   # 234.9 UV fuerte
    ],
    'B': [   # B I
        (412.2, 0.45), (249.7, 1.0), (249.8, 0.8), (208.9, 0.55),     # doblete UV 249
    ],
    'C': [
        (909.5, 0.70), (906.2, 0.65), (833.5, 0.75),
        (247.856, 1.0), (193.091, 0.55), (165.693, 0.45), (156.144, 0.4),
    ],
    'N': [   # N I
        (868.3, 0.70), (821.6, 0.75), (746.8, 0.80),         # triplete IR
        (410.0, 0.45), (120.0, 1.0),                         # UV resonancia
    ],
    'O': [   # O I
        (844.6, 0.80), (777.4, 1.0),                         # triplete IR (el característico)
        (615.8, 0.50), (436.8, 0.45), (130.2, 0.90),         # UV resonancia
    ],
    'F': [   # F I
        (775.5, 0.55), (739.9, 0.70), (703.7, 0.75), (685.6, 0.80),   # rojo-IR
        (95.5, 0.85),                                        # UV lejano
    ],
    'Ne': [  # Ne I — el del letrero rojo-naranja
        (1152.3, 0.55), (743.9, 0.65), (703.2, 0.60),        # IR-rojo
        (640.2, 1.0), (614.3, 0.70), (585.2, 0.65), (540.0, 0.50),    # rojo-amarillo
    ],
    # ── Metales famosos por su forma ──
    'Fe': [  # Fe I — espectro densísimo (calibración estelar)
        (527.04, 0.65), (516.75, 0.80), (438.35, 0.70),
        (404.58, 0.90), (385.99, 0.80), (374.56, 0.70), (248.33, 0.60),
    ],
    'Cu': [  # Cu I — verde de la llama de cobre + doblete UV
        (578.21, 0.50), (521.82, 0.70), (515.32, 0.60), (510.55, 0.65),
        (327.40, 0.85), (324.75, 1.0),
    ],
    'Ag': [  # Ag I
        (827.35, 0.50), (768.78, 0.55), (546.55, 0.60), (520.91, 0.65),
        (338.29, 0.85), (328.07, 1.0),
    ],
    'Au': [  # Au I
        (627.8, 0.50), (583.7, 0.55), (479.3, 0.60),
        (406.5, 0.70), (312.3, 0.80), (267.6, 1.0),
    ],
}

OCTAVES_DOWN = 42

# ── Fallback: espectro DERIVADO de la estructura electrónica real ──
# Para elementos sin líneas NIST tabuladas, derivamos un conjunto de líneas a
# partir de los niveles de energía del átomo: ocupación Aufbau + carga efectiva
# de Slater → E(n,l) = -13.6·Zeff²/n² → transiciones permitidas (Δl=±1) → λ.
# No son las líneas medidas exactas, pero SÍ vienen de la física del átomo, así
# que cada elemento suena distinto por su propia estructura.
_AUFBAU = [(1,0),(2,0),(2,1),(3,0),(3,1),(4,0),(3,2),(4,1),(5,0),(4,2),
           (5,1),(6,0),(4,3),(5,2),(6,1),(7,0),(5,3),(6,2),(7,1)]

def _fill_aufbau(Z):
    occ, rem = [], Z
    for (n, l) in _AUFBAU:
        cap = 2 * (2 * l + 1)
        c = min(cap, rem)
        if c > 0:
            occ.append((n, l, c))
        rem -= c
        if rem <= 0:
            break
    return occ

def _seqpos(n, l):
    return n + (0.0 if l < 2 else (0.3 if l == 2 else 0.6))

def _zeff(Z, occ, n, l):
    mypos = _seqpos(n, l)
    sigma = 0.0
    for (nn, ll, cnt) in occ:
        if nn == n and ll == l:
            per = 0.30 if (n == 1 and l == 0) else 0.35
            sigma += per * (cnt - 1)
        elif l < 2:  # apantallamiento para s, p
            if nn == n and ll < 2:      sigma += 0.35 * cnt
            elif nn == n - 1:           sigma += 0.85 * cnt
            elif nn <= n - 2:           sigma += 1.00 * cnt
        else:        # d, f: todo lo interno apantalla 1.0
            if _seqpos(nn, ll) < mypos: sigma += 1.00 * cnt
    return max(Z - sigma, 0.5)

def derive_spectrum(Z):
    occ = _fill_aufbau(Z)
    levels = [(n, l, -13.6056 * _zeff(Z, occ, n, l) ** 2 / (n * n), c) for (n, l, c) in occ]
    lines = []
    for (n1, l1, e1, c1) in levels:
        for (n2, l2, e2, c2) in levels:
            if abs(l1 - l2) == 1 and e1 > e2:        # emisión: nivel alto → bajo
                dE = e1 - e2
                if dE < 0.05:
                    continue
                nm = 1239.84 / dE
                if nm < 30 or nm > 4000:
                    continue
                w = (c1 * c2) ** 0.25 / (1 + abs(n1 - n2))
                lines.append((nm, w))
    lines.sort(key=lambda x: x[0])
    if not lines:
        lines = [(1000.0, 0.6), (500.0, 1.0), (250.0, 0.5)]
    if len(lines) > 8:                                # variedad: graves..agudos
        idx = sorted(set(round(k * (len(lines) - 1) / 7) for k in range(8)))
        lines = [lines[k] for k in idx]
    mx = max(w for _, w in lines) or 1.0
    return [(nm, w / mx) for (nm, w) in lines]

# Pentatónica mayor (clases de altura relativas a la tónica), tónica C.
PENTA = [0, 2, 4, 7, 9]
TONIC_MIDI = 36          # C2 ≈ 65.41 Hz — registro cálido y grave
A4 = 440.0


def midi_to_hz(m):
    return A4 * 2.0 ** ((m - 69) / 12.0)


def hz_to_midi(f):
    return 69 + 12 * np.log2(f / A4)


def snap_penta(f):
    """Frecuencia → nota pentatónica mayor (de C) más cercana, cualquier octava."""
    m = hz_to_midi(f)
    best, bestd = None, 1e9
    for octv in range(0, 9):
        for pc in PENTA:
            cand = TONIC_MIDI % 12 + pc + 12 * octv + (TONIC_MIDI // 12) * 12
            d = abs(cand - m)
            if d < bestd:
                bestd, best = d, cand
    return midi_to_hz(best), best


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def soft_voice(t, f, rng, warmth):
    """Una voz cálida: senoide + leve 2º armónico, 3 sub-voces detuneadas."""
    out = np.zeros_like(t)
    for cents in (-3.0, 0.0, 4.0):
        fk = f * 2.0 ** (cents / 1200.0)
        ph = rng.uniform(0, 6.28)
        w = np.sin(2 * np.pi * fk * t + ph) + warmth * np.sin(2 * np.pi * 2 * fk * t + ph)
        lfo = 0.74 + 0.26 * np.sin(2 * np.pi * rng.uniform(0.03, 0.07) * t + rng.uniform(0, 6.28))
        out += w * lfo / 3.0
    return out


def synth(symbol, dur, Z=None):
    # líneas NIST reales si existen; si no, espectro derivado de la estructura
    lines = SPECTRA.get(symbol)
    if lines is None:
        if Z is None:
            raise ValueError(f"sin espectro para {symbol} y sin Z para derivar")
        lines = derive_spectrum(Z)
    n = int(SR * dur)
    t = np.arange(n) / SR
    rng = np.random.default_rng((hash(symbol) ^ ((Z or 0) * 2654435761)) & 0xffffffff)

    # Mapear líneas → Hz audible → cuantizar a pentatónica
    factor = 2.0 ** OCTAVES_DOWN
    notes = []
    for nm, w in lines:
        f_raw = (C_LIGHT / (nm * 1e-9)) / factor
        f_snap, midi = snap_penta(f_raw)
        notes.append((f_snap, midi, w))

    mix = np.zeros(n, dtype=np.float64)

    # ── 1) Pad-drone: tónica + quinta + octava (el corazón tranquilo) ──
    f_tonic = midi_to_hz(TONIC_MIDI)
    for mid, gain in ((TONIC_MIDI, 0.55), (TONIC_MIDI + 7, 0.32), (TONIC_MIDI + 12, 0.26)):
        mix += gain * soft_voice(t, midi_to_hz(mid), rng, warmth=0.16)

    # ── 2) Voces espectrales graves/medias como pad suave ──
    for f_snap, midi, w in notes:
        if midi <= TONIC_MIDI + 16:               # graves-medias → sostenidas
            mix += 0.22 * w * soft_voice(t, f_snap, rng, warmth=0.10)

    # ── 3) Campanas de curiosidad: líneas agudas como destellos espaciados ──
    highs = sorted({round(midi) for f_snap, midi, w in notes if midi > TONIC_MIDI + 16})
    high_hz = [midi_to_hz(m) for m in highs] or [midi_to_hz(TONIC_MIDI + 19)]
    # eventos no-rítmicos: empiezan tras el reveal, espaciados con jitter
    tau = 2.6                                      # decay largo, contemplativo
    tk = 5.5
    while tk < dur - 1.0:
        f = high_hz[rng.integers(0, len(high_hz))]
        i0 = int(tk * SR)
        local = t[i0:] - tk
        env = np.exp(-local / tau) * (1 - np.exp(-local / 0.03))  # pluck suave
        bell = (np.sin(2 * np.pi * f * local) + 0.25 * np.sin(2 * np.pi * 2 * f * local))
        mix[i0:] += 0.20 * env * bell
        tk += rng.uniform(3.0, 5.5)

    # ── 4) Sub limpio bajo la tónica ──
    mix += 0.30 * np.sin(2 * np.pi * (f_tonic / 2) * t) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.05 * t))

    # ── Envolvente contemplativa ──
    fade_in = smoothstep(t / 4.0)
    fade_out = smoothstep((dur - t) / 1.8)
    swell = 1.0 + 0.10 * np.exp(-((t - 15.0) ** 2) / (2 * 1.5 ** 2))   # entrada del outro
    mix *= fade_in * fade_out * swell

    peak = np.max(np.abs(mix)) or 1.0
    return (mix / peak * 0.80).astype(np.float32)


def main():
    symbol = sys.argv[1] if len(sys.argv) > 1 else 'C'
    out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/atom.wav'
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 22.0
    Z = int(sys.argv[4]) if len(sys.argv) > 4 else None
    audio = synth(symbol, dur, Z)
    wavfile.write(out, SR, audio)
    src = 'NIST' if symbol in SPECTRA else f'derivado(Z={Z})'
    print(f"wrote {out}  ({dur}s)  fuente={src}")


if __name__ == '__main__':
    main()
