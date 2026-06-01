#!/usr/bin/env python3
"""
bh-sound-design.py — Diseño sonoro determinista del comercial "EL FOTÓN QUE CAE".

Estilo heredado de scripts/atom-sonify.py y scripts/sonify-water-vibes.py
(numpy + scipy.io.wavfile, RNG con semilla fija, smoothstep, voces cálidas con
sub-voces detuneadas), pero aquí la pieza está COMPUESTA para drama de cine —
paleta Interstellar mínima y FÍSICA, no contemplativa.

──────────────────────────────────────────────────────────────────────────────
REGLA DE PIPELINE (dura, del brief)
──────────────────────────────────────────────────────────────────────────────
TODO el sonido es función PURA de t y se sintetiza aquí, OFFLINE. Mismo t → mismo
sample. Nada de reloj del sistema ni aleatoriedad en runtime: la semilla SEED es
fija para que el cache de beats valga (mismo código → mismo WAV → cache hit).

El SILENCIO se hornea como SAMPLES casi-cero reales (no solo "bajar volumen"):
es una automation de volumen pura en t. ATENCIÓN al mezclar en ffmpeg:
  · NO uses loudnorm sobre el track entero: ni con linear=true garantiza ser
    lineal (puede caer a modo 'Dynamic' y levantar el silencio). Usa GANANCIA
    ESTÁTICA (volume=NdB) sobre este WAV, que ya trae headroom. Ver SUGERENCIA.
  · El reverb (aecho) NO debe correr sobre el tramo de silencio: su cola lo
    llenaría. Aplica el reverb SOLO a [0, 30) y concatena seco el silencio+cola.
  · Salida con HEADROOM (pico ~-6 dBFS, no normalizada a tope): la ganancia fija
    levanta después; aquí dejamos aire para que no clippee.

──────────────────────────────────────────────────────────────────────────────
STEMS REUTILIZABLES (recombinables por beat)
──────────────────────────────────────────────────────────────────────────────
  (1) DRONE     sub-bass ~30–60 Hz — la cama del vacío. ENTRA DE GOLPE (Nolan:
                el espacio no suena, el silencio es física honesta).
  (2) ÓRGANO    tubo que "respira" — la voz de la gravedad (mueve aire, se SIENTE).
  (3) TICK      60 BPM tipo lápices sobre cuerdas — un reloj literal (1 tick=1 s).
                Su intervalo se ESTIRA por slow = sqrt(1 - rs/r(t)): dilatación
                temporal AUDIBLE, mismo factor que frena la imagen.
  (4) SHEPARD   riser acotado que NO resuelve — ascenso infinito (caer sin fin).
  (5) IMPACTO   whoosh grave SOLO en los cortes/match-cuts.
  (6) SILENCIO  gate de audio (samples ~0) — el golpe emocional a lo docking.
  (+) POV       doppler subjetivo + oído interno (sangre/presión) — "ser un fotón".

──────────────────────────────────────────────────────────────────────────────
MAPEO A BEATS (brief.beatLibrary / brief.commercialChain)
──────────────────────────────────────────────────────────────────────────────
B1_DESCENSO_ORBITAL (15s) — drone DE GOLPE + órgano que sube lento + Shepard que
    no resuelve; el TICK entra a media caída (~7.5 s). PICO de órgano + brillo
    cuando el anillo revienta (~14 s) = setup del match-cut. Whoosh grave SOLO en
    el corte final.
B2_FOTON_POV (15s) — POV: drone+órgano+Shepard + capa SUBJETIVA (oído interno:
    pulso de sangre + doppler subjetivo del campo que pasa). Swell de órgano al
    cruzar la photon sphere (1.5·rs, ~mitad del beat).
B3_SLOWDOWN_DILATACION (15s) — CORAZÓN: el tick se ESTIRA, intervalo =
    base / sqrt(1 - rs/r(t)) con la MISMA r que frena la imagen. El pitch del
    drone baja con slow. Órgano+Shepard suben al PICO (~70%) = setup del silencio.
B4_ABISMO_ZOOMOUT (15s) — EN EL CORTE: caída a -inf dB INSTANTÁNEA = silencio
    absoluto, hold ~3 s (la imagen colosal carga sola). Tras el hold: re-crescendo
    LENTÍSIMO de un swell de órgano grave + sub-drone que vuelve → entrega al outro.

CADENA COMERCIAL (≈30 s + outro): se sintetiza por defecto B1 completo + cola de
B4 con el silencio, mezclando B2/B3 recortados. Cada beat es CACHEABLE por separado
(--beat B1) o se genera el arco completo (--chain commercial, por defecto).

Uso:
  python3 bh-sound-design.py <salida.wav>                 # cadena comercial (~33 s)
  python3 bh-sound-design.py <salida.wav> --beat B1       # un solo beat (15 s)
  python3 bh-sound-design.py <salida.wav> --chain commercial
  python3 bh-sound-design.py <salida.wav> --outro-tail 3  # cola extra sobre el outro
"""
import sys
import numpy as np
from scipy.io import wavfile

SR = 48000
SEED = 20260531                      # fija (= fecha del beat); JAMÁS random()
RS = 1.0                             # mismo Schwarzschild radius que CinematicGargantua
HEADROOM_PEAK = 10 ** (-6.0 / 20.0)  # pico objetivo ~-6 dBFS (loudnorm sube después)

# Tónica Interstellar: registro grave y frío. Órgano sobre un Do/Sol modal.
A4 = 440.0
TONIC_MIDI = 36                      # C2 ≈ 65.41 Hz


# ──────────────────────────────────────────────────────────────────────────
# Utilidades (puras en t)
# ──────────────────────────────────────────────────────────────────────────
def midi_to_hz(m):
    return A4 * 2.0 ** ((m - 69) / 12.0)


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def smootherstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)


def ease_exp(x, k):
    """Mismo easeExp del CinematicCamera: interpola exponencial. k<0 frena al final."""
    x = np.clip(x, 0.0, 1.0)
    if abs(k) < 1e-6:
        return x
    return (np.exp(k * x) - 1.0) / (np.exp(k) - 1.0)


def db(x):
    return 10.0 ** (x / 20.0)


# ──────────────────────────────────────────────────────────────────────────
# FÍSICA: r(t) por beat → slow = sqrt(1 - rs/r) (dilatación temporal real)
# ──────────────────────────────────────────────────────────────────────────
# Replica las trayectorias de cámara del brief para que el sonido herede la
# MISMA física que la imagen. r SIEMPRE en unidades de rs; r > rs siempre.

def r_of_p_B1(p):
    """B1: caída orbital 130·rs → 8·rs, easeExp(smootherstep, -2.2) (freno=masa)."""
    d0, d1 = 130.0, 8.0
    e = ease_exp(smootherstep(p), -2.2)
    return d0 * (d1 / d0) ** e * RS


def r_of_p_pov(p):
    """B2/B3: POV espiral cerrándose 30·rs → ~1.05·rs, acelera al caer (k>0)."""
    d0, d1 = 30.0, 1.05
    e = ease_exp(smootherstep(p), 2.4)
    return d0 * (d1 / d0) ** e * RS


def r_of_p_B4(p):
    """B4: dolly-back 1.05·rs → 120·rs, sale rápido y FRENA al final (abismo)."""
    d0, d1 = 1.05, 120.0
    e = ease_exp(smootherstep(p), -2.0)
    return d0 * (d1 / d0) ** e * RS


def slow_of_r(r):
    """Dilatación temporal gravitacional: dt_propio/dt_inf = sqrt(1 - rs/r).
    FÍSICA REAL (no etiqueta): mismo factor que el zFactor per-pixel del shader,
    recomputado en JS/numpy sobre la r de la trayectoria (pura en t)."""
    return np.sqrt(np.clip(1.0 - RS / np.maximum(r, RS * 1.0000001), 0.0, 1.0))


# ──────────────────────────────────────────────────────────────────────────
# STEMS — cada uno función pura de t, devuelve mono float64
# ──────────────────────────────────────────────────────────────────────────
def stem_drone(t, rng, f0=42.0, pitch_curve=None, gain_env=None):
    """(1) DRONE sub-bass ~30-60 Hz. La cama del vacío. ENTRA DE GOLPE (lo decide
    gain_env). pitch_curve (mult de frecuencia, p.ej. slow) baja el tono cuando el
    tiempo se frena. Triángulo suave + sub senoidal + leve batido = aire vivo."""
    n = len(t)
    if pitch_curve is None:
        pitch_curve = np.ones(n)
    # fase integrada (frecuencia variable en el tiempo, sin clicks)
    inst_f = f0 * pitch_curve
    phase = 2.0 * np.pi * np.cumsum(inst_f) / SR
    body = np.sin(phase) + 0.30 * np.sin(2.0 * phase) + 0.12 * np.sin(3.0 * phase)
    sub = 0.55 * np.sin(0.5 * phase)                       # una octava abajo (cuerpo)
    beat = 0.08 * np.sin(2.0 * np.pi * 0.18 * t + rng.uniform(0, 6.28))  # batido lento
    out = (body * (0.9 + beat) + sub)
    if gain_env is not None:
        out = out * gain_env
    return out


def stem_organ(t, rng, midis, gain_env, breath_rate=0.22, detune_cents=4.0):
    """(2) ÓRGANO de tubo que respira. Suma de parciales impares (timbre de tubo)
    sobre un acorde modal (midis). Respiración = LFO de amplitud lento (mueve aire)."""
    out = np.zeros_like(t)
    breath = 0.80 + 0.20 * np.sin(2.0 * np.pi * breath_rate * t + rng.uniform(0, 6.28))
    for mi in midis:
        f = midi_to_hz(mi)
        for cents in (-detune_cents, 0.0, detune_cents):
            fk = f * 2.0 ** (cents / 1200.0)
            ph = rng.uniform(0, 6.28)
            # parciales impares decrecientes = tubo de órgano
            voice = (np.sin(2 * np.pi * fk * t + ph)
                     + 0.45 * np.sin(2 * np.pi * 3 * fk * t + ph)
                     + 0.22 * np.sin(2 * np.pi * 5 * fk * t + ph)
                     + 0.10 * np.sin(2 * np.pi * 7 * fk * t + ph))
            out += voice / 3.0
    out /= max(len(midis), 1)
    return out * breath * gain_env


def stem_tick(t, dur, beat_t0, base_bpm, slow_curve=None, gain=0.5):
    """(3) TICK ~60 BPM = reloj literal (1 tick = 1 s). El intervalo se ESTIRA por
    slow_curve = sqrt(1 - rs/r(t)): cuando el tiempo propio se frena, los ticks se
    separan hasta el silencio. Determinista: integramos la fase del reloj en t.

    fase_reloj(t) = ∫ (bpm/60) · slow(t') dt'   →  un tick cada vez que cruza un entero.
    Cada tick = pluck percusivo (ruido filtrado + tono corto), tipo lápiz sobre cuerda."""
    n = len(t)
    out = np.zeros(n)
    if slow_curve is None:
        slow_curve = np.ones(n)
    rate = (base_bpm / 60.0) * slow_curve            # ticks por segundo, dilatados
    clock_phase = np.cumsum(rate) / SR               # fase del reloj (entero = tick)
    i0 = int(beat_t0 * SR)
    # detecta cruces de entero en la fase del reloj a partir de beat_t0
    phase_floor = np.floor(clock_phase)
    crossings = np.where(np.diff(phase_floor) > 0)[0] + 1
    crossings = crossings[crossings >= i0]
    tau = 0.16                                        # decay corto y seco
    klen = int(0.5 * SR)
    karg = np.arange(klen) / SR
    # pluck base: tono medio-agudo + transitorio de "madera"
    f_tick = 1180.0
    pluck = (np.sin(2 * np.pi * f_tick * karg) + 0.5 * np.sin(2 * np.pi * 2.02 * f_tick * karg))
    env = np.exp(-karg / tau) * (1.0 - np.exp(-karg / 0.002))
    pluck = pluck * env
    for ci in crossings:
        if ci >= n:
            break
        end = min(ci + klen, n)
        out[ci:end] += gain * pluck[: end - ci]
    return out


def stem_shepard(t, gain_env, base_midi=24, n_octaves=7, sweep_rate=0.10, rng=None):
    """(4) RISER SHEPARD acotado: ilusión de ascenso infinito que NO resuelve.
    Octavas equiespaciadas con envolvente gaussiana en log-frecuencia que se
    desliza hacia arriba y reaparece por abajo. sweep_rate = octavas por segundo."""
    out = np.zeros_like(t)
    if rng is not None:
        ph0 = rng.uniform(0, 6.28)
    else:
        ph0 = 0.0
    # posición del barrido en octavas (sube y envuelve)
    sweep = (sweep_rate * t) % 1.0
    center = n_octaves / 2.0
    sigma = n_octaves / 3.2
    for k in range(n_octaves):
        # cada parcial sube de octava continuamente y reaparece (Shepard)
        oct_pos = (k + sweep)
        f = midi_to_hz(base_midi) * 2.0 ** oct_pos
        # peso gaussiano centrado → graves y agudos se desvanecen = "infinito"
        w = np.exp(-((oct_pos % n_octaves - center) ** 2) / (2 * sigma ** 2))
        out += w * np.sin(2 * np.pi * f * t + ph0 + k)
    out /= n_octaves
    return out * gain_env


def stem_impact(t, at_s, gain=0.9, decay=0.9):
    """(5) IMPACTO/WHOOSH grave SOLO en los cortes. Sub-boom + barrido descendente
    de ruido (whoosh). Centrado en at_s. Determinista (forma fija)."""
    n = len(t)
    out = np.zeros(n)
    i0 = int(at_s * SR)
    if i0 >= n:
        return out
    local = t[i0:] - at_s
    # sub-boom: seno que cae en pitch (808-style) + cuerpo
    f_boom = 90.0 * np.exp(-local / 0.5) + 32.0
    phase = 2.0 * np.pi * np.cumsum(f_boom) / SR
    boom = np.sin(phase) * np.exp(-local / decay)
    # whoosh: ruido pasa-bajos cuyo corte cae (lo simulamos con AM de ruido suave)
    rng_local = np.random.default_rng(SEED ^ 0x5757)
    noise = rng_local.standard_normal(len(local))
    # suavizado por media móvil = pasa-bajos barato (corte cae con env)
    win = 64
    kernel = np.ones(win) / win
    noise_lp = np.convolve(noise, kernel, mode='same')
    whoosh = noise_lp * np.exp(-local / 0.35) * 0.4
    out[i0:] += gain * (boom + whoosh)
    return out


def stem_pov_subjective(t, rng, slow_curve, gain_env):
    """(+) POV "ser un fotón": oído interno + doppler subjetivo. NO es un sonido del
    exterior (el vacío no transmite) — es lo que el observador SIENTE:
      · pulso de sangre/presión (latido sub-grave ~1.1 Hz que se ralentiza con slow)
      · doppler subjetivo: un tono que barre (campo estelar pasando) y se enrojece
        (baja de pitch) conforme cae = redshift subjetivo, atado a slow_curve.
    Etiquetado como SUBJETIVO/evocativo en el caption del beat (regla dura)."""
    n = len(t)
    # latido: doble golpe (lub-dub) a ~66 bpm que se frena con slow
    rate = 1.1 * slow_curve
    hphase = np.cumsum(rate) / SR
    pf = np.floor(hphase)
    beats = np.where(np.diff(pf) > 0)[0] + 1
    heart = np.zeros(n)
    klen = int(0.45 * SR)
    karg = np.arange(klen) / SR
    thump = np.sin(2 * np.pi * 48.0 * karg) * np.exp(-karg / 0.10)
    for bi in beats:
        end = min(bi + klen, n)
        heart[bi:end] += 0.5 * thump[: end - bi]          # lub
        d = bi + int(0.18 * SR)                            # dub
        if d < n:
            end2 = min(d + klen, n)
            heart[d:end2] += 0.32 * thump[: end2 - d]
    # doppler subjetivo: tono que cae en pitch con slow (redshift que SIENTES)
    f_dop = 220.0 * (0.5 + 0.5 * slow_curve)               # baja al frenar
    dphase = 2.0 * np.pi * np.cumsum(f_dop) / SR
    doppler = (0.25 * np.sin(dphase) + 0.12 * np.sin(2 * dphase))
    # silbido de presión (aire en el oído) muy suave, filtrado
    rng_n = np.random.default_rng(SEED ^ 0xA17)
    hiss = rng_n.standard_normal(n)
    hiss = np.convolve(hiss, np.ones(48) / 48, mode='same') * 0.06
    return (heart + doppler + hiss) * gain_env


# ──────────────────────────────────────────────────────────────────────────
# BEATS — cada uno devuelve un mix mono float64 de su duración, función pura de t
# ──────────────────────────────────────────────────────────────────────────
# Acorde modal frío (Do menor abierto, voz de la gravedad). Grados sobre TONIC.
ORGAN_CHORD = [TONIC_MIDI, TONIC_MIDI + 7, TONIC_MIDI + 12, TONIC_MIDI + 15]


def beat_B1(dur=15.0):
    """B1_DESCENSO_ORBITAL — hook caliente. Drone de golpe, órgano sube, Shepard,
    tick a media caída, PICO + brillo cuando el anillo revienta, whoosh en el corte."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    p = t / dur
    rng = np.random.default_rng(SEED ^ 0xB1)
    r = r_of_p_B1(p)
    slow = slow_of_r(r)

    # DRONE entra DE GOLPE (ataque de 80 ms, NO fade lento) y sostiene
    drone_env = smoothstep(t / 0.08) * (0.85 + 0.15 * smoothstep(p))
    drone = stem_drone(t, rng, f0=44.0, pitch_curve=0.9 + 0.1 * slow, gain_env=drone_env)

    # ÓRGANO sube lento; PICO al final (anillo revienta ~14 s)
    organ_rise = smoothstep((p - 0.05) / 0.6)
    peak = np.exp(-((t - 14.0) ** 2) / (2 * 0.7 ** 2))     # brillo del anillo
    organ_env = 0.55 * organ_rise + 0.9 * peak
    organ = stem_organ(t, rng, ORGAN_CHORD, organ_env, breath_rate=0.20)

    # SHEPARD que NO resuelve (sube todo el beat, acotado)
    shep_env = 0.30 * smoothstep((p - 0.1) / 0.5) + 0.25 * peak
    shep = stem_shepard(t, shep_env, sweep_rate=0.085, rng=rng)

    # TICK entra a media caída (~7.5 s), reloj literal con leve dilatación
    tick = stem_tick(t, dur, beat_t0=7.5, base_bpm=60.0, slow_curve=slow, gain=0.42)

    # WHOOSH grave SOLO en el corte final (último frame = match-cut)
    whoosh = stem_impact(t, at_s=dur - 0.35, gain=0.7, decay=0.7)

    mix = 0.9 * drone + 0.8 * organ + 0.5 * shep + tick + whoosh
    return mix


def beat_B2(dur=15.0):
    """B2_FOTON_POV — POV foton. drone+órgano+Shepard + capa SUBJETIVA (oído interno
    + doppler). Swell de órgano al cruzar la photon sphere (~mitad)."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    p = t / dur
    rng = np.random.default_rng(SEED ^ 0xB2)
    r = r_of_p_pov(p)
    slow = slow_of_r(r)

    drone = stem_drone(t, rng, f0=40.0, pitch_curve=0.85 + 0.15 * slow,
                       gain_env=smoothstep(t / 0.3) * 0.9)

    # cruce de la photon sphere (1.5·rs): swell de órgano centrado donde r≈1.5
    cross_p = float(p[np.argmin(np.abs(r - 1.5 * RS))]) if np.any(r <= 1.5 * RS) else 0.55
    swell = np.exp(-((p - cross_p) ** 2) / (2 * 0.10 ** 2))
    organ_env = 0.45 * smoothstep((p - 0.05) / 0.5) + 0.7 * swell
    organ = stem_organ(t, rng, ORGAN_CHORD, organ_env, breath_rate=0.24)

    shep = stem_shepard(t, 0.28 * smoothstep((p - 0.05) / 0.4) + 0.3 * swell,
                        sweep_rate=0.10, rng=rng)

    # capa subjetiva: oído interno + doppler (etiqueta 'subjetivo/evocación')
    pov = stem_pov_subjective(t, rng, slow, gain_env=0.6 * smoothstep(t / 0.4))

    mix = 0.85 * drone + 0.75 * organ + 0.45 * shep + 0.8 * pov
    return mix


def beat_B3(dur=15.0):
    """B3_SLOWDOWN_DILATACION — corazón. El TICK se estira por slow=sqrt(1-rs/r) (la
    MISMA r que frena la imagen). Pitch del drone baja con slow. Órgano+Shepard al
    PICO (~70%) = setup del silencio del B4. SIN etiqueta: es física exacta."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    p = t / dur
    rng = np.random.default_rng(SEED ^ 0xB3)
    # POV continuo cerrándose más cerca del horizonte (slow → 0 al final)
    d0, d1 = 4.0, 1.02
    e = ease_exp(smootherstep(p), 1.8)
    r = d0 * (d1 / d0) ** e * RS
    slow = slow_of_r(r)

    # drone: pitch CAE con slow (dilatación audible del propio drone)
    drone = stem_drone(t, rng, f0=46.0, pitch_curve=0.55 + 0.45 * slow,
                       gain_env=smoothstep(t / 0.3) * (0.95 - 0.25 * (1 - slow)))

    # PICO de órgano+Shepard a ~70% (climax que setupea el silencio)
    peak = np.exp(-((p - 0.70) ** 2) / (2 * 0.10 ** 2))
    organ_env = 0.4 * smoothstep((p - 0.02) / 0.4) + 1.0 * peak
    organ = stem_organ(t, rng, ORGAN_CHORD, organ_env, breath_rate=0.16)
    shep = stem_shepard(t, 0.25 + 0.4 * peak, sweep_rate=0.07, rng=rng)

    # TICK que se ESTIRA hacia el silencio: intervalo = base / slow → ticks se separan
    tick = stem_tick(t, dur, beat_t0=0.0, base_bpm=60.0, slow_curve=slow, gain=0.5)

    # subjetivo: latido que se frena (acompaña el slow)
    pov = stem_pov_subjective(t, rng, slow, gain_env=0.5 * smoothstep(t / 0.3))

    mix = 0.9 * drone + 0.8 * organ + 0.45 * shep + tick + 0.55 * pov
    return mix


def beat_B4(dur=15.0, silence_hold=3.0):
    """B4_ABISMO_ZOOMOUT — EN EL CORTE: caída a -inf dB INSTANTÁNEA (silencio absoluto,
    SAMPLES ~0), hold ~3 s. Tras el hold: re-crescendo LENTÍSIMO de un swell de
    órgano grave + sub-drone → entrega al outro GAIA Prime. El silencio HEREDA la
    energía del pico de B3 (modelo docking: pico → drop, nunca drone plano cortado)."""
    n = int(SR * dur)
    t = np.arange(n) / SR
    p = t / dur
    rng = np.random.default_rng(SEED ^ 0xB4)

    # gate de silencio: 0 desde el corte hasta silence_hold, luego re-crescendo
    # (automation de volumen PURA en t — samples casi-cero reales, no atenuación)
    gate = smoothstep((t - silence_hold) / 4.5)            # sube lentísimo tras el hold

    # re-crescendo: sub-drone que vuelve + UN swell de órgano grave (nunca brass)
    drone = stem_drone(t, rng, f0=38.0, pitch_curve=np.ones(n),
                       gain_env=gate * 0.8)
    organ = stem_organ(t, rng, [TONIC_MIDI, TONIC_MIDI + 7, TONIC_MIDI + 12],
                       gain_env=gate * 0.7, breath_rate=0.12)

    mix = 0.9 * drone + 0.7 * organ
    # garantiza silencio DURO en el hold (samples exactamente 0, mata cola numérica)
    mix[t < silence_hold] = 0.0
    return mix


BEATS = {
    'B1': beat_B1,
    'B2': beat_B2,
    'B3': beat_B3,
    'B4': beat_B4,
}


# ──────────────────────────────────────────────────────────────────────────
# CADENA COMERCIAL — B1 completo + B2/B3 recortados + cola de silencio B4
# ──────────────────────────────────────────────────────────────────────────
# VENTANAS DE BEAT (deben COINCIDIR EXACTO con los cortes del video; el .cjs corta
# el video en estos mismos límites, sin crossfade):
#     B1 : [ 0 , 15)   →  duración 15.0 s
#     B2 : slice ~7 s  →  [15 , 22)
#     B3 : slice ~8 s  →  [22 , 30)
#     CORTE A SILENCIO EXACTO en t = 30.0
#     B4 : cola ~4 s de silencio+crescendo  →  [30 , 34) + outro_tail sobre el logo
# El audio se sintetiza por sample (sin crossfades que corran el tiempo): cada beat
# ocupa EXACTAMENTE su número de samples, así el corte al silencio cae en t=30.0000.
B1_DUR = 20.0     # B1 completo (caída más larga). comercial = B1 + cola B4
SILENCE_CUT_S = B1_DUR                           # = 20.0 — el corte al silencio (B1→B4)
SILENCE_HOLD = 4.0                               # hold de silencio absoluto tras el corte (más silencio)


def hard_concat(*chunks):
    """Concatena mixes mono SIN crossfade: un corte motivado de cine NO se
    crossfadea, y cualquier fade correría el tiempo y desincronizaría con el video
    (que corta seco en B1/B2/B3/B4). Cada chunk conserva su largo exacto en samples
    → la línea de tiempo del audio queda muestra-a-muestra alineada con la del video.
    Los whoosh/impactos internos de cada beat ya hacen el 'pegamento' del corte."""
    return np.concatenate(chunks)


def build_commercial(outro_tail=3.0):
    """COMERCIAL v1 — cadena B1 + B4 (los 2 beats que salen CINE). Línea de tiempo
    IDÉNTICA a la del video (DEFAULT_CHAIN en CinematicBHReel.tsx):
       B1[0,15) → CORTE A SILENCIO en t=15 + cola B4 (revelado del abismo).
    El descenso construye tensión (drone + órgano + riser Shepard) hasta que el
    anillo revienta al final de B1; ahí CORTA SECO a silencio absoluto mientras el
    zoom-out revela Gargantua entero (el golpe Interstellar). Luego re-crescendo de
    órgano grave resuelve sobre el outro GAIA. Sin crossfades: cada beat ocupa su
    número exacto de samples → el corte al silencio cae en t=15.0000."""
    b1 = beat_B1(B1_DUR)

    # cola B4: silencio DURO en el corte (SILENCE_HOLD) + re-crescendo sobre el
    # outro. Empieza EXACTO en t=20. Dura 15s de revelado/silencio + outro_tail.
    b4 = beat_B4(dur=15.0 + outro_tail, silence_hold=SILENCE_HOLD)

    # CONCATENACIÓN SECA (sin crossfade → sin corrimiento). El corte al silencio cae
    # en len(b1) = 15.0 s exactos, sincronizado con el corte del video B1→B4.
    chain = hard_concat(b1, b4)
    return chain


# ──────────────────────────────────────────────────────────────────────────
# Render → estéreo con headroom
# ──────────────────────────────────────────────────────────────────────────
def to_stereo(mono):
    """Mono → estéreo con una imagen muy sutil (Haas/decorrelación leve) para
    amplitud sin perder el mono-compatibilidad (IG/TikTok colapsan a veces a mono).
    El sub queda CENTRADO; solo los agudos se abren un pelín."""
    n = len(mono)
    # decorrelación leve: micro-delay (Haas, ~0.4 ms) solo en el canal derecho
    d = int(0.0004 * SR)
    right = np.zeros(n)
    right[d:] = mono[: n - d]
    left = mono
    # mezcla 90% directo / 10% decorrelado en cada lado (imagen sutil)
    L = 0.96 * left + 0.04 * right
    R = 0.96 * right + 0.04 * left
    return np.stack([L, R], axis=1)


def finalize(mix):
    """Normaliza a HEADROOM (pico ~-6 dBFS) — la ganancia estática sube después en
    ffmpeg. NO normaliza a tope: deja aire para que el silencio siga siendo silencio
    y el pico no clippee tras la nivelación."""
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * HEADROOM_PEAK
    stereo = to_stereo(mix)
    # PRESERVAR EL SILENCIO DURO: el micro-delay Haas de to_stereo copia ~0.4 ms del
    # canal izquierdo al derecho y eso sangraría unos samples del pre-corte dentro
    # del silencio del docking. Donde el mono es exactamente 0 (gate horneado),
    # forzamos AMBOS canales a 0 → el silencio cae a -inf dB REAL, sin cola.
    silent = (mix == 0.0)
    stereo[silent, :] = 0.0
    # clip de seguridad (no debería tocar nada con el headroom)
    stereo = np.clip(stereo, -1.0, 1.0)
    return stereo.astype(np.float32)


def parse_args(argv):
    out = argv[1] if len(argv) > 1 and not argv[1].startswith('--') else '/tmp/bh-sound.wav'
    beat = None
    chain = 'commercial'
    outro_tail = 3.0
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == '--beat' and i + 1 < len(argv):
            beat = argv[i + 1].upper(); i += 2
        elif a == '--chain' and i + 1 < len(argv):
            chain = argv[i + 1]; i += 2
        elif a == '--outro-tail' and i + 1 < len(argv):
            outro_tail = float(argv[i + 1]); i += 2
        elif not a.startswith('--'):
            i += 1
        else:
            i += 1
    return out, beat, chain, outro_tail


SUGERENCIA_FFMPEG = r"""
SUGERENCIA DE MEZCLA EN FFMPEG (al integrar en el render del comercial)
─────────────────────────────────────────────────────────────────────
El gate de silencio ya está horneado en samples ~0. DOS problemas a evitar:

  (P1) loudnorm (cualquier modo) puede APLASTAR la dinámica y, peor, levantar el
       tramo silencioso: ni siquiera `linear=true` lo garantiza — si el análisis
       no cabe en el rango lineal, loudnorm cae a modo 'Dynamic' (compresión por
       ventana) y el silencio deja de ser silencio. NO dependas de loudnorm para
       el silencio.
  (P2) el reverb (aecho) deja COLA: si corre sobre TODO el track, la cola del
       reverb de B3 se derrama en el silencio del corte (t=30) y lo llena.

RECETA CANÓNICA (la que usa el .cjs):
  1) Ganancia ESTÁTICA, no loudnorm: el WAV ya trae el arco y el headroom (-6 dBFS
     pico). Una sola `volume=NdB` preserva el silencio (0·gain = 0) y la dinámica.
       -af "highpass=f=24, <reverb>, lowpass=f=4200, volume=8dB"
  2) Reverb SOLO sobre la señal (B1..B3), cortado EN SECO en el match-cut (t=30):
     separa el track con atrim en t=30, aplica el reverb al tramo [0,30), y
     concatena CRUDO (sin reverb) el tramo [30, fin) (silencio + crescendo final).
     Así la cola del reverb muere en el corte y el silencio cae a ~-inf dB real.
       asplit → [0,30)=atrim+reverb ; [30,fin)=atrim seco ; concat
  3) Si de plano quieres medir loudness, hazlo SOLO sobre [0,30) (con señal) y
     deja el tramo silencioso intacto.

Reverb de catedral robada tal cual de la receta de marca. Lowpass más abierto
(4200) porque el órgano grave aquí necesita más cuerpo que la sonificación atómica.
"""


def main():
    out, beat, chain, outro_tail = parse_args(sys.argv)
    np.random.seed(SEED)  # belt-and-suspenders (cada stem usa su propio rng seedeado)

    if beat:
        if beat not in BEATS:
            print(f"beat desconocido: {beat}. Opciones: {', '.join(BEATS)}")
            sys.exit(1)
        mono = BEATS[beat](15.0)
        label = f"beat {beat} (15 s)"
    else:
        mono = build_commercial(outro_tail=outro_tail)
        label = f"cadena '{chain}' (~{len(mono)/SR:.1f} s)"

    audio = finalize(mono)
    wavfile.write(out, SR, audio)
    dur_s = len(audio) / SR
    print(f"✓ {out}  ·  {label}  ·  {dur_s:.2f}s  ·  48kHz estéreo  ·  pico -6 dBFS (headroom)")
    print(f"  semilla fija SEED={SEED} → determinista (mismo código → mismo WAV → cache).")
    print(SUGERENCIA_FFMPEG)


if __name__ == '__main__':
    main()
