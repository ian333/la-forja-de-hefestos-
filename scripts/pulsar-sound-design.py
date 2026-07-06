#!/usr/bin/env python3
"""
pulsar-sound-design.py — Diseño sonoro determinista del comercial "EL FARO"
(estrella de neutrones, J0030 / Crab / Vela), para GAIA Prime + redes.

Hermano de scripts/bh-sound-design.py, pero la PIEZA es OTRA y debe SONAR distinta:
  · El BH es Do MENOR, contemplativo-trágico, dominado por el SILENCIO (el vacío
    no suena). Aquí la estrella SÍ habla: late. El PULSO es el protagonista.
  · Modo LIDIO en RE (D Lydian: D E F# G# A B C#) — la 4ª aumentada (G#) es el
    color del "asombro / faro celestial" del cine; flota y NO resuelve a tierra.
    Distinto del Do menor del BH → dos piezas de la misma familia, no la misma.

──────────────────────────────────────────────────────────────────────────────
EL PULSO = EL PROTAGONISTA (homenaje a Jocelyn Bell, 1967)
──────────────────────────────────────────────────────────────────────────────
Bell vio un "bit of scruff" en el papel del radiotelescopio: un BEEP regular cada
1.337 s (PSR B1919+21). Eso es el corazón de esta pieza. El beep se sonifica
leyendo la MISMA función align(t) que usa el shader (CinematicPulsar.tsx) para
encender los polos — no una curva inventada: la GEOMETRÍA del faro decide cuándo
suena.

    poleAxis(t) = Ry(2π t/P) · Rx(tilt) · ŷ
                = ( sin(rot)·sin(tilt),  cos(tilt),  cos(rot)·sin(tilt) ),  rot=2π t/P
    toCam(t)    = normalize( spherical(azim(t), incl, dist) )   [cámara de la escena]
    align(t)    = | poleAxis(t) · toCam(t) |        → 1 cuando el haz APUNTA a la cámara
    pulse(t)    = clamp((align - 0.6)/0.4, 0, 1)^2.4   [misma curva que el shader]

Cuando pulse(t) cruza un umbral subiendo → DISPARA un beep brillante (el haz cruzó
nuestra línea de visión). Dos polos (±ŷ) ⇒ puede haber doble cruce por giro
(interpulso, como el Crab: P1 fuerte + P2 secundario). Todo cae donde el shader
enciende los casquetes → IMAGEN y SONIDO laten EN FASE, frame a frame.

──────────────────────────────────────────────────────────────────────────────
UNA CAPA DE SONIDO DISTINTA POR LENTE (el concepto "5 lentes")
──────────────────────────────────────────────────────────────────────────────
El MISMO objeto, cada longitud de onda con su firma sonora (etiquetadas; lo
evocativo se marca como tal — regla dura del proyecto):
  L1 SUPERFICIE/visible : cuerpo negro ~10^6 K = blanco-azul. Pad LIDIO cálido-frío
                          + shimmer de cristal en el limbo lensado (luz que se enrosca).
  L2 MAGNÉTICA          : zumbido del DIPOLO en el cilindro de luz (R_LC=cP/2π).
                          Un drone que "gira" (AM a la frecuencia de rotación) +
                          armónicos de la espiral de Arquímedes de las líneas abiertas.
  L3 RAYOS X            : toro + jets del Crab (Chandra). Un SWELL áspero, metálico,
                          con ruido filtrado en banda (sincrotrón) sobre el EJE DE
                          ROTACIÓN (no el magnético).
  L4 GAMMA              : viento de pares e± más allá del cilindro de luz. DOBLE
                          PICO P1/P2 del Crab → dos transientes cristalinos agudos,
                          el segundo más débil, separados por la fase real.
  L5 RADIO              : el BEEP de Bell — el pulso que domina. Tono brillante por
                          cada cruce del haz magnético. ES la firma de la pieza.

──────────────────────────────────────────────────────────────────────────────
REGLA DE PIPELINE (dura, heredada del BH)
──────────────────────────────────────────────────────────────────────────────
TODO es función PURA de t, sintetizado OFFLINE. SEED fija → mismo código = mismo
WAV = cache hit. 48 kHz estéreo, pico ~-6 dBFS (HEADROOM; la ganancia estática
sube después en ffmpeg). NADA de loudnorm sobre el track. El reverb se corta en
SECO en los cambios de lente (su cola no debe sangrar al siguiente capítulo).

Uso:
  python3 pulsar-sound-design.py <salida.wav>                  # arco completo (5 lentes)
  python3 pulsar-sound-design.py <salida.wav> --lens L5        # una sola lente
  python3 pulsar-sound-design.py <salida.wav> --P 1.4 --tilt 35 --incl 52
  python3 pulsar-sound-design.py <salida.wav> --object crab    # preset Crab (33ms, doble pico)
  python3 pulsar-sound-design.py <salida.wav> --dur 24
"""
import sys
import numpy as np
from scipy.io import wavfile

SR = 48000
SEED = 20260602                      # fija (= fecha de hoy); JAMÁS random()
HEADROOM_PEAK = 10 ** (-6.0 / 20.0)  # pico objetivo ~-6 dBFS

# ── Tónica: RE LIDIO (D Lydian). A4=440. D4 = MIDI 62. ──────────────────────
A4 = 440.0
TONIC_MIDI = 62                      # D4
# D Lydian relativo a la tónica (semitonos): D(0) E(2) F#(4) G#(6) A(7) B(9) C#(11)
LYDIAN = [0, 2, 4, 6, 7, 9, 11]


# ── Parámetros físicos del púlsar de la TOMA (deben coincidir con el shader) ─
# La toma cinematográfica usa P LENTO (~1.4 s) para que el barrido del faro SE VEA
# (honesto: la NS real gira en ms; eso se etiqueta y se sonifica aparte abajo).
class Pulsar:
    def __init__(self, P=1.4, tilt_deg=35.0, incl_deg=52.0, az0=-0.6, az_sweep=1.4,
                 dur=24.0, P_real_ms=4.87, double_peak=False, T_surf=1.0e6):
        self.P = P                              # periodo de la TOMA (s) — barrido visible
        self.tilt = np.radians(tilt_deg)        # eje magnético vs rotación
        self.incl = np.radians(incl_deg)        # elevación de la órbita de cámara
        self.az0 = az0                          # azimut base de la cámara (rad)
        self.az_sweep = az_sweep                # barrido de azimut en el plano (rad)
        self.dur = dur
        self.P_real_ms = P_real_ms              # periodo REAL (ms) — buzz etiquetado
        self.double_peak = double_peak          # interpulso (Crab): polo opuesto también pega
        self.T_surf = T_surf                    # temperatura superficial (K) → timbre

# Presets de objetos reales (datos del brief).
OBJECTS = {
    # J0030+0451: P=4.87ms, NICER (Riley 2019). Toma a P=1.4s para ver el barrido.
    'j0030': dict(P=1.4, tilt_deg=35.0, incl_deg=52.0, P_real_ms=4.87, double_peak=False, T_surf=1.0e6),
    # Crab: P=33ms, B=3.3e12 G, doble pico P1/P2, SN1054 (toro+jets Chandra).
    # El doble pico EMERGE de la geometría: rotador casi ORTOGONAL (tilt alto)
    # visto casi de canto (incl baja) → la línea de visión pasa cerca de AMBOS
    # polos magnéticos y signed_dot cruza +0.6 (P1) y −0.6 (P2). Verificado:
    # tilt=70°/incl=20° da dot∈[−0.78,+1.00] ⇒ interpulso real. (La TOMA debe usar
    # estos mismos tilt/incl para que imagen y sonido muestren el mismo P1/P2.)
    'crab':  dict(P=1.1, tilt_deg=70.0, incl_deg=20.0, P_real_ms=33.0, double_peak=True, T_surf=1.6e6),
    # Vela: P=89ms, T≈1.5e6 K, R_LC≈4250 km. También near-orthogonal con interpulso.
    'vela':  dict(P=1.6, tilt_deg=75.0, incl_deg=22.0, P_real_ms=89.0, double_peak=True, T_surf=1.5e6),
}


# ──────────────────────────────────────────────────────────────────────────
# Utilidades puras en t (mismas que el BH para coherencia de la familia)
# ──────────────────────────────────────────────────────────────────────────
def midi_to_hz(m):
    return A4 * 2.0 ** ((m - 69) / 12.0)


def chord_hz(degrees, octave_shift=0):
    """Acorde lidio: lista de grados (índices en LYDIAN) → Hz. octave_shift en octavas."""
    return [midi_to_hz(TONIC_MIDI + LYDIAN[d % 7] + 12 * (d // 7 + octave_shift)) for d in degrees]


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def smootherstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)


def db(x):
    return 10.0 ** (x / 20.0)


# ──────────────────────────────────────────────────────────────────────────
# FÍSICA DEL FARO — align(t) replicado EXACTO del shader (CinematicPulsar.tsx)
# ──────────────────────────────────────────────────────────────────────────
# poleAxis(t) verificado contra la matemática de quaterniones de three.js
# (Ry(rot)·Rx(tilt)·ŷ): forma cerrada exacta, no aproximación.

def pole_axis(t, ps):
    """Eje magnético (norte) en mundo, función pura de t. (sin·sin, cos, cos·sin)."""
    rot = 2.0 * np.pi * t / ps.P
    st = np.sin(ps.tilt)
    return np.stack([np.sin(rot) * st,
                     np.full_like(t, np.cos(ps.tilt)),
                     np.cos(rot) * st], axis=-1)


def to_cam_dir(t, ps):
    """Dirección a la cámara (unitaria), réplica de spherical(azim, incl, dist).
    dist se cancela al normalizar; azim barre como en cameraProgram de la escena."""
    p = t / ps.dur
    azim = ps.az0 + p * ps.az_sweep                  # cameraProgram: -0.6 + p*1.4
    cp = np.cos(ps.incl)
    v = np.stack([cp * np.sin(azim),
                  np.full_like(t, np.sin(ps.incl)),
                  cp * np.cos(azim)], axis=-1)
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def signed_dot(t, ps):
    """poleAxis(t)·toCam(t) CON SIGNO. +1 ⇒ el polo NORTE apunta a la cámara;
    −1 ⇒ el polo SUR apunta a la cámara (el haz opuesto). El shader usa |·|, así
    que enciende los casquetes en AMBOS casos; el signo nos deja distinguir el
    pulso principal (norte) del INTERPULSO (sur) — el doble pico P1/P2 del Crab."""
    return np.sum(pole_axis(t, ps) * to_cam_dir(t, ps), axis=-1)


def align_curve(t, ps, pole_sign=+1):
    """align del polo pedido = max(0, pole_sign·dot). align del NORTE solo cuenta
    cuando el dot es POSITIVO (norte hacia cámara); el del SUR solo cuando es
    NEGATIVO. Reproduce el |·| del shader como la SUMA de los dos (uno u otro está
    activo en cada cruce), pero separables para darles timbre distinto."""
    d = signed_dot(t, ps)
    return np.clip(pole_sign * d, 0.0, 1.0)


def pulse_curve(t, ps, pole_sign=+1):
    """pulse(t) = clamp((align-0.6)/0.4,0,1)^2.4 — MISMA curva/umbral que el shader."""
    a = align_curve(t, ps, pole_sign)
    return np.clip((a - 0.6) / 0.4, 0.0, 1.0) ** 2.4


def find_pulse_onsets(t, ps, pole_sign=+1, thresh=0.12):
    """Índices de muestra donde pulse(t) CRUZA thresh subiendo = inicio de un beep.
    (El borde de subida, no el pico: el ataque del beep coincide con el encendido
    del casquete, igual que el ojo lo ve.) Con pole_sign=-1 detecta el INTERPULSO
    (cruce del polo sur); si la geometría no lo produce, devuelve 0 onsets — honesto:
    no inventa un interpulso que el faro no haría."""
    pc = pulse_curve(t, ps, pole_sign)
    above = pc >= thresh
    onsets = np.where(np.diff(above.astype(np.int8)) > 0)[0] + 1
    return onsets, pc


# ──────────────────────────────────────────────────────────────────────────
# STEMS — cada uno función pura de t, mono float64
# ──────────────────────────────────────────────────────────────────────────
def stem_pad_lydian(t, rng, degrees, gain_env, breath_rate=0.18, octave=0, detune_cents=4.0):
    """L1 SUPERFICIE: pad LIDIO cálido-frío (cuerpo negro ~10^6 K = blanco-azul).
    Parciales pares+impares suaves (no tubo de órgano frío del BH; aquí es más
    'coro de cristal'). Respiración lenta = la estrella que palpita."""
    out = np.zeros_like(t)
    breath = 0.82 + 0.18 * np.sin(2.0 * np.pi * breath_rate * t + rng.uniform(0, 6.28))
    for f in chord_hz(degrees, octave):
        for cents in (-detune_cents, 0.0, detune_cents):
            fk = f * 2.0 ** (cents / 1200.0)
            ph = rng.uniform(0, 6.28)
            voice = (np.sin(2 * np.pi * fk * t + ph)
                     + 0.30 * np.sin(2 * np.pi * 2 * fk * t + ph)   # 2º (color cálido)
                     + 0.20 * np.sin(2 * np.pi * 3 * fk * t + ph)
                     + 0.10 * np.sin(2 * np.pi * 5 * fk * t + ph))  # brillo Rayleigh-Jeans
            out += voice / 3.0
    out /= max(len(degrees), 1)
    return out * breath * gain_env


def stem_crystal_limb(t, rng, gain_env, density=0.55):
    """L1 (luz lensada en el limbo): destellos de cristal en notas lidias altas
    (G#, B, C#) = la lente gravitacional enroscando los hot spots en el limbo que
    BRILLA. Granos cortos, fase aleatoria determinista (semilla)."""
    out = np.zeros_like(t)
    n = len(t)
    notes = chord_hz([4, 6, 7, 9, 11], octave_shift=1)  # F#? -> usa grados altos lidios
    # disparar granos espaciados por t (deterministas)
    klen = int(0.9 * SR)
    karg = np.arange(klen) / SR
    n_grains = int(density * (n / SR) * 3.0)
    for g in range(n_grains):
        ti = rng.integers(0, max(1, n - klen))
        f = notes[rng.integers(0, len(notes))]
        env = np.exp(-karg / 0.32) * (1.0 - np.exp(-karg / 0.004))
        grain = np.sin(2 * np.pi * f * karg + rng.uniform(0, 6.28)) * env
        out[ti:ti + klen] += 0.22 * grain
    return out * gain_env


def stem_magnetic_drone(t, rng, ps, gain_env, f0=58.0):
    """L2 MAGNÉTICA: zumbido del DIPOLO. Drone grave con AM a la frecuencia de
    ROTACIÓN (1/P) = el campo 'girando' (las líneas abiertas barriendo). Un
    armónico añadido a la 'frecuencia del cilindro de luz' relativa = textura.
    Etiqueta: el cilindro de luz R_LC=cP/2π es un radio espacial, no una frecuencia
    audible; lo mapeamos a un AM evocativo de la rotación (marcado)."""
    spin_f = 1.0 / ps.P
    am = 0.65 + 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * spin_f * t))   # gira con la rotación
    body = (np.sin(2 * np.pi * f0 * t)
            + 0.4 * np.sin(2 * np.pi * 2 * f0 * t + 0.7)
            + 0.18 * np.sin(2 * np.pi * 3 * f0 * t + 1.9))
    sub = 0.5 * np.sin(2 * np.pi * 0.5 * f0 * t)
    # espiral de Arquímedes: barrido lento de un parcial agudo (líneas que se retuercen)
    spiral_f = 320.0 + 180.0 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t))
    spiral = 0.08 * np.sin(2 * np.pi * np.cumsum(spiral_f) / SR)
    return (body * am + sub + spiral) * gain_env


def stem_xray_swell(t, rng, gain_env):
    """L3 RAYOS X: toro + jets del Crab (Chandra) sobre el EJE DE ROTACIÓN.
    Sincrotrón = ruido de banda áspero + un swell metálico (parciales inarmónicos).
    Frío y duro, distinto del pad cálido de L1."""
    n = len(t)
    # ruido filtrado en banda (síntesis de sincrotrón): ruido * media móvil (pasabajos)
    noise = rng.standard_normal(n)
    noise = np.convolve(noise, np.ones(20) / 20, mode='same')          # banda media
    noise -= np.convolve(noise, np.ones(220) / 220, mode='same')       # quita los graves (banda)
    # cuerpo metálico inarmónico (campanas de rayos X)
    metal = np.zeros(n)
    for f, w in [(523.25, 1.0), (784.0, 0.6), (1108.7, 0.4), (1480.0, 0.25)]:
        metal += w * np.sin(2 * np.pi * f * 2 ** ((SEED % 7 - 3) / 50.0) * t)  # leve inarmonía
    metal /= 2.3
    return (0.55 * noise + 0.45 * metal) * gain_env


def stem_gamma_doublepeak(t, ps, gain_env, gain=0.7):
    """L4 GAMMA: viento de pares e± → DOBLE PICO P1/P2 del Crab. Dos transientes
    cristalinos AGUDOS por giro (P1 fuerte = polo norte, P2 débil = polo sur),
    cayendo en la fase REAL leída de align(t) con cada signo de polo. El más
    energético del show (gamma = más energía)."""
    n = len(t)
    out = np.zeros(n)
    klen = int(0.35 * SR)
    karg = np.arange(klen) / SR
    # transiente cristalino muy agudo (FM corta) — luz dura
    def ping(f, amp):
        car = np.sin(2 * np.pi * f * karg + 3.0 * np.exp(-karg / 0.02) * np.sin(2 * np.pi * 2.7 * f * karg))
        env = np.exp(-karg / 0.05) * (1.0 - np.exp(-karg / 0.0015))
        return amp * car * env
    P1 = ping(midi_to_hz(TONIC_MIDI + LYDIAN[4] + 24), 1.0)    # F#, alto = pico fuerte
    P2 = ping(midi_to_hz(TONIC_MIDI + LYDIAN[6] + 24), 0.55)   # G# (4ª aum), más débil
    on_n, _ = find_pulse_onsets(t, ps, pole_sign=+1)
    for i in on_n:
        e = min(i + klen, n); out[i:e] += gain * P1[: e - i]
    if ps.double_peak:
        on_s, _ = find_pulse_onsets(t, ps, pole_sign=-1)
        for i in on_s:
            e = min(i + klen, n); out[i:e] += gain * P2[: e - i]
    return out * gain_env


def stem_radio_beep(t, ps, gain_env, gain=0.9):
    """L5 RADIO — EL BEEP DE BELL (1967). El protagonista. Por cada cruce del haz
    (onset de pulse) suena un beep BRILLANTE: tono senoidal limpio (como el chart
    recorder / la sonificación clásica de Bell) con un pelín de 2º armónico y un
    'click' de ataque (el lápiz golpeando el papel). Doble pico si double_peak."""
    n = len(t)
    out = np.zeros(n)
    klen = int(0.42 * SR)
    karg = np.arange(klen) / SR

    def beep(f, amp, tau=0.14):
        body = np.sin(2 * np.pi * f * karg) + 0.18 * np.sin(2 * np.pi * 2 * f * karg)
        env = np.exp(-karg / tau) * (1.0 - np.exp(-karg / 0.0015))
        click = 0.4 * np.exp(-karg / 0.004) * np.sin(2 * np.pi * 2600 * karg)  # lápiz
        return amp * (body * env + click)

    # tono lidio brillante (A5 = 5ª justa de la tónica, estable y luminosa)
    fN = midi_to_hz(TONIC_MIDI + LYDIAN[4] + 12)   # F#5 — el faro
    fS = midi_to_hz(TONIC_MIDI + LYDIAN[0] + 12)   # D5  — interpulso (más grave, secundario)
    on_n, _ = find_pulse_onsets(t, ps, pole_sign=+1)
    bN = beep(fN, 1.0)
    for i in on_n:
        e = min(i + klen, n); out[i:e] += gain * bN[: e - i]
    if ps.double_peak:
        on_s, _ = find_pulse_onsets(t, ps, pole_sign=-1)
        bS = beep(fS, 0.5)
        for i in on_s:
            e = min(i + klen, n); out[i:e] += gain * bS[: e - i]
    return out * gain_env


def stem_real_rate_buzz(t, ps, gain_env, gain=0.18):
    """CAMEO ETIQUETADO 'escala real': el púlsar real NO hace beep, hace un ZUMBIDO
    — a P_real_ms (J0030=4.87ms → 205 Hz; Crab=33ms → 30 Hz; Vela=89ms → 11 Hz). Un
    tren de pulsos a la frecuencia REAL = el sonido que un humano oiría si pudiera
    'escuchar' el pulso a su ritmo verdadero (lo que la toma ralentiza para verse).
    Se mezcla MUY bajo, como revelación final. Determinista."""
    n = len(t)
    f_real = 1000.0 / ps.P_real_ms                  # Hz reales del pulso
    # tren de pulsos: fase del reloj real, pulso corto en cada periodo
    phase = (f_real * t) % 1.0
    pulse_train = np.exp(-((phase) ** 2) / (2 * 0.05 ** 2))      # pico angosto por periodo
    pulse_train += np.exp(-(((phase - 1.0)) ** 2) / (2 * 0.05 ** 2))  # wrap
    carrier = np.sin(2 * np.pi * (f_real * 3.0) * t)             # timbre del buzz
    return pulse_train * carrier * gain * gain_env


# ──────────────────────────────────────────────────────────────────────────
# LENTES (capítulos) — cada una un mix mono float64, función pura de t.
# Cada lente = una FIRMA sonora distinta + el PULSO de fondo presente (es la
# misma estrella). El pad lidio (cama etérea) une todo el arco.
# ──────────────────────────────────────────────────────────────────────────
# Acordes lidios (grados en LYDIAN): Dmaj add9 #11 ≈ [0(D) 4(F#) 7(A) 9(B) 4+? ]
PAD_LO = [0, 4, 7]             # D F# A — tríada lidia base
PAD_HI = [0, 4, 7, 9, 11]     # + B C# = maj9 lidio abierto (asombro)


def _bed(t, rng, ps, level=1.0, hi=False):
    """Cama etérea común a todo el arco: pad lidio + drone grave estable."""
    pad = stem_pad_lydian(t, rng, PAD_HI if hi else PAD_LO,
                          gain_env=np.full_like(t, level), breath_rate=0.16, octave=0)
    sub = stem_pad_lydian(t, rng, [0], gain_env=np.full_like(t, 0.5 * level),
                          breath_rate=0.10, octave=-2)   # drone D1/D2 (ancla)
    return 0.8 * pad + sub


def lens_L1_surface(ps, dur):
    """L1 SUPERFICIE/visible (NICER J0030). Pad cálido-frío + cristal del limbo
    lensado. El pulso TÉRMICO entra suave (el barrido del hot spot por el limbo)."""
    n = int(SR * dur); t = np.arange(n) / SR; p = t / dur
    rng = np.random.default_rng(SEED ^ 0x511)
    env = smoothstep(t / 1.2) * (1.0 - 0.3 * smoothstep((p - 0.7) / 0.3))
    bed = _bed(t, rng, ps, level=0.9)
    crystal = stem_crystal_limb(t, rng, gain_env=0.7 * smoothstep((p - 0.15) / 0.4))
    # pulso térmico tenue (el hot spot apareciendo por el limbo): beep suave, grave
    beep = stem_radio_beep(t, ps, gain_env=0.25 * smoothstep(t / 1.0), gain=0.4)
    return (0.9 * bed + 0.5 * crystal + 0.5 * beep) * env


def lens_L2_magnetic(ps, dur):
    """L2 MAGNÉTICA: dipolo + cilindro de luz. Zumbido que gira + espiral. El pulso
    empieza a definirse (el haz magnético tomando forma)."""
    n = int(SR * dur); t = np.arange(n) / SR; p = t / dur
    rng = np.random.default_rng(SEED ^ 0x522)
    env = smoothstep(t / 0.8)
    bed = _bed(t, rng, ps, level=0.7)
    mag = stem_magnetic_drone(t, rng, ps, gain_env=0.75 * smoothstep((p - 0.1) / 0.4))
    beep = stem_radio_beep(t, ps, gain_env=0.4 * smoothstep((p - 0.2) / 0.4), gain=0.55)
    return (0.7 * bed + 0.85 * mag + 0.7 * beep) * env


def lens_L3_xray(ps, dur):
    """L3 RAYOS X: toro + jets del Crab sobre el EJE DE ROTACIÓN. Swell áspero
    metálico (sincrotrón). El pulso sigue presente, ahora más duro."""
    n = int(SR * dur); t = np.arange(n) / SR; p = t / dur
    rng = np.random.default_rng(SEED ^ 0x533)
    env = smoothstep(t / 0.6)
    bed = _bed(t, rng, ps, level=0.55)
    swell = np.exp(-((p - 0.55) ** 2) / (2 * 0.22 ** 2))     # swell central
    xray = stem_xray_swell(t, rng, gain_env=0.5 * smoothstep((p - 0.05) / 0.3) + 0.6 * swell)
    beep = stem_radio_beep(t, ps, gain_env=0.5 * smoothstep((p - 0.1) / 0.3), gain=0.7)
    return (0.6 * bed + 0.8 * xray + 0.85 * beep) * env


def lens_L4_gamma(ps, dur):
    """L4 GAMMA: viento de pares e±, DOBLE PICO P1/P2. El más energético. Pad alto
    (maj9 lidio = asombro) + transientes cristalinos del doble pico."""
    n = int(SR * dur); t = np.arange(n) / SR; p = t / dur
    rng = np.random.default_rng(SEED ^ 0x544)
    env = smoothstep(t / 0.5)
    bed = _bed(t, rng, ps, level=0.65, hi=True)
    gamma = stem_gamma_doublepeak(t, ps, gain_env=0.8 * smoothstep((p - 0.05) / 0.25), gain=0.8)
    beep = stem_radio_beep(t, ps, gain_env=0.5 * smoothstep((p - 0.05) / 0.25), gain=0.7)
    return (0.7 * bed + 0.95 * gamma + 0.7 * beep) * env


def lens_L5_radio(ps, dur):
    """L5 RADIO — clímax: EL PULSO domina (Bell 1967). Cama lidia mínima para que
    el beep RESPIRE; al final, el cameo del buzz a frecuencia REAL como revelación.
    Termina abierto (lidio no resuelve) = entrega al outro GAIA."""
    n = int(SR * dur); t = np.arange(n) / SR; p = t / dur
    rng = np.random.default_rng(SEED ^ 0x555)
    env = smoothstep(t / 0.5) * (1.0 - 0.4 * smoothstep((p - 0.75) / 0.25))
    bed = _bed(t, rng, ps, level=0.5, hi=True)
    beep = stem_radio_beep(t, ps, gain_env=np.full_like(t, 1.0), gain=1.0)   # el protagonista
    # cameo: el buzz a la frecuencia REAL del púlsar entra en el último tercio
    buzz = stem_real_rate_buzz(t, ps, gain_env=smoothstep((p - 0.62) / 0.25), gain=0.2)
    return (0.55 * bed + 1.0 * beep + buzz) * env


LENSES = {
    'L1': lens_L1_surface,
    'L2': lens_L2_magnetic,
    'L3': lens_L3_xray,
    'L4': lens_L4_gamma,
    'L5': lens_L5_radio,
}

# Orden del arco completo (los 5 capítulos) y duración por defecto de cada uno.
ARC = ['L1', 'L2', 'L3', 'L4', 'L5']


# ──────────────────────────────────────────────────────────────────────────
# ENSAMBLE — concat SECO de las lentes (corte motivado, sin crossfade que corra
# el tiempo y desincronice con el video que también corta seco entre lentes).
# ──────────────────────────────────────────────────────────────────────────
def hard_concat(*chunks):
    return np.concatenate(chunks)


def build_arc(ps, lens_dur):
    """Arco completo: L1..L5 concatenadas SECO. Cada lente ocupa exactamente
    lens_dur segundos → los cortes caen en múltiplos exactos = sincronizan con los
    cortes del video entre lentes. (El video debe cortar en los mismos límites.)"""
    chunks = [LENSES[name](ps, lens_dur) for name in ARC]
    return hard_concat(*chunks)


# ──────────────────────────────────────────────────────────────────────────
# Render → estéreo con headroom (mismo finalize que el BH; sin silencio horneado:
# aquí no hay gate de silencio absoluto, la estrella late todo el tiempo).
# ──────────────────────────────────────────────────────────────────────────
def to_stereo(mono):
    """Mono → estéreo con imagen sutil (Haas ~0.4 ms en R). Mono-compatible (IG/TT).
    El sub queda CENTRADO; solo los agudos se abren un pelín. El BEEP, por ser
    transitorio brillante, se beneficia: gana 'aire' sin perder el centro."""
    n = len(mono)
    d = int(0.0004 * SR)
    right = np.zeros(n); right[d:] = mono[: n - d]
    left = mono
    L = 0.96 * left + 0.04 * right
    R = 0.96 * right + 0.04 * left
    return np.stack([L, R], axis=1)


def finalize(mix):
    """Normaliza a HEADROOM (pico ~-6 dBFS). NO a tope: la ganancia estática sube
    después en ffmpeg y deja aire para que el beep no clippee."""
    peak = np.max(np.abs(mix)) or 1.0
    mix = mix / peak * HEADROOM_PEAK
    stereo = to_stereo(mix)
    stereo = np.clip(stereo, -1.0, 1.0)
    return stereo.astype(np.float32)


def parse_args(argv):
    out = argv[1] if len(argv) > 1 and not argv[1].startswith('--') else '/tmp/pulsar-sound.wav'
    lens = None
    obj = 'j0030'
    P = tilt = incl = dur = None
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == '--lens' and i + 1 < len(argv):
            lens = argv[i + 1].upper(); i += 2
        elif a == '--object' and i + 1 < len(argv):
            obj = argv[i + 1].lower(); i += 2
        elif a == '--P' and i + 1 < len(argv):
            P = float(argv[i + 1]); i += 2
        elif a == '--tilt' and i + 1 < len(argv):
            tilt = float(argv[i + 1]); i += 2
        elif a == '--incl' and i + 1 < len(argv):
            incl = float(argv[i + 1]); i += 2
        elif a == '--dur' and i + 1 < len(argv):
            dur = float(argv[i + 1]); i += 2
        else:
            i += 1
    return out, lens, obj, P, tilt, incl, dur


SUGERENCIA_FFMPEG = r"""
RECETA DE MEZCLA EN FFMPEG (al integrar en el render del comercial del púlsar)
─────────────────────────────────────────────────────────────────────────────
Hermana de la del BH, con UNA diferencia clave: aquí NO hay gate de silencio
absoluto (la estrella late todo el tiempo); el cuidado va en que el reverb NO
arrastre su cola de una LENTE a la siguiente (cada lente es un capítulo seco).

REGLAS (duras):
  (P1) NO loudnorm sobre el track entero (puede caer a 'Dynamic' y bombear el
       beep). El WAV ya trae el arco + headroom (-6 dBFS pico). Una GANANCIA
       ESTÁTICA volume=NdB preserva la dinámica del pulso (el beep debe PEGAR).
  (P2) Reverb (catedral) CORTADO EN SECO en cada cambio de lente: la cola del pad
       de L1 no debe sangrar dentro del zumbido de L2, etc. Igual que el BH cortaba
       el reverb en el match-cut, aquí se corta en CADA límite de lente.
  (P3) El BEEP es un transitorio: NO lo aplastes con compresión fuerte ni lo
       ahogues en reverb. Reverb wet BAJO (~0.22) y lowpass abierto para que el
       'click' del lápiz (homenaje al chart recorder de Bell) sobreviva.

RECETA CANÓNICA (los límites de lente = múltiplos de lens_dur; aquí ejemplo a
lens_dur=4.8s → cortes en 4.8, 9.6, 14.4, 19.2):
  1) Ganancia ESTÁTICA + filtros de banda:
       -af "highpass=f=28, lowpass=f=15000, volume=8dB"
     (lowpass MÁS ABIERTO que el BH: el beep y el cristal del limbo viven en agudos;
      el BH lo cerraba a 4200 porque era órgano grave. Aquí queremos el brillo.)
  2) Reverb por-lente con cola cortada en cada límite (asplit + atrim por tramo):
     para 5 lentes de duración D cada una, separa el track en 5 tramos
     [k·D,(k+1)·D), aplica el reverb a CADA tramo por separado, re-recorta a D
     DESPUÉS del reverb (mata la cola que se derrama), y concat seco:
       asplit=5[a0][a1][a2][a3][a4];
       [a0]atrim=0:D,asetpts=N/SR/TB,<reverb>,atrim=0:D,asetpts=N/SR/TB[r0];
       [a1]atrim=D:2D,asetpts=N/SR/TB,<reverb>,atrim=0:D,asetpts=N/SR/TB[r1];
       ... (igual para a2,a3,a4) ...
       [r0][r1][r2][r3][r4]concat=n=5:v=0:a=1[acat];
       [acat]volume=8dB,apad,atrim=end=<dur_video>,asetpts=N/SR/TB[aout]
     Reverb de catedral (más corto que el BH; el beep necesita aire seco):
       <reverb> = aecho=0.8:0.85:71|113|173:0.32|0.22|0.14, aecho=0.85:0.9:281:0.10
  3) Si quieres medir loudness, hazlo por-lente sobre cada tramo CON señal y
     concatena; nunca un loudnorm global (descuadra el pulso).

NOTA de SYNC: el video y el audio DEBEN cortar en los MISMOS límites de lente.
El audio se sintetiza por sample (sin crossfade) → cada lente ocupa exactamente
lens_dur·SR muestras y el corte cae en el sample exacto. Pasa al .py el MISMO
--dur que el plano y usa lens_dur = dur_video / 5.
"""


def main():
    out, lens, obj, P, tilt, incl, dur = parse_args(sys.argv)
    np.random.seed(SEED)  # belt-and-suspenders (cada stem usa su rng seedeado)

    base = OBJECTS.get(obj, OBJECTS['j0030']).copy()
    if P is not None:    base['P'] = P
    if tilt is not None: base['tilt_deg'] = tilt
    if incl is not None: base['incl_deg'] = incl
    total_dur = dur if dur is not None else 24.0
    base['dur'] = total_dur
    ps = Pulsar(**base)

    if lens:
        if lens not in LENSES:
            print(f"lente desconocida: {lens}. Opciones: {', '.join(LENSES)}")
            sys.exit(1)
        mono = LENSES[lens](ps, total_dur)
        label = f"lente {lens}"
    else:
        lens_dur = total_dur / len(ARC)
        mono = build_arc(ps, lens_dur)
        label = f"arco 5 lentes ({obj}, {len(ARC)}×{lens_dur:.2f}s)"

    audio = finalize(mono)
    dur_s = len(audio) / SR
    wavfile.write(out, SR, audio)
    print(f"✓ {out}  ·  {label}  ·  {dur_s:.2f}s  ·  48kHz estéreo  ·  pico -6 dBFS (headroom)")
    print(f"  púlsar: P={ps.P}s tilt={np.degrees(ps.tilt):.0f}° incl={np.degrees(ps.incl):.0f}° "
          f"P_real={ps.P_real_ms}ms doble_pico={ps.double_peak}")
    # diagnóstico: cuántos beeps caen (sync con el shader)
    t = np.arange(len(audio)) / SR
    on_n, _ = find_pulse_onsets(t, ps, +1)
    print(f"  beeps polo N: {len(on_n)}  (cruces del haz = pulsos de Bell)")
    print(f"  semilla fija SEED={SEED} → determinista (mismo código → mismo WAV → cache).")
    print(SUGERENCIA_FFMPEG)


if __name__ == '__main__':
    main()
