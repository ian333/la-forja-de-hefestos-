/**
 * QuasarPulsarAudio — sonificación del pulsar.
 *
 * Las ondas EM no son sonoras, pero su modulación temporal (pulsación
 * rotacional + componentes per-banda) se mapea a frecuencias audibles
 * preservando proporciones físicas reales.
 *
 * Mapeos:
 *   - Pulsation rate ω_spin → kick drum a 2·ω (audible, sub-bass)
 *     · Crab P=33.4 ms → ω/2π = 30 Hz · escalamos a 0.3 Hz para visible
 *     · audio: 60 Hz (2nd harmonic, justo audible) = "thumping heartbeat"
 *   - Cada componente físico = un timbre + nota en escala armónica
 *   - Brightness en banda actual = volumen del componente
 *   - GW (quadrupole 2Ω) → bell tone que pulsa al doble del kick
 *
 * Diseño armónico (escala A pentatonic, igual que SED):
 *   - radio_beam      A2 (110 Hz) sine — bass warm drone
 *   - polar_cap_X     A4 (440 Hz) triangle — brillante medio
 *   - outer_gap_γ     E5+G5+B5 sawtooth detuned — disonancia high (gamma intensa)
 *   - bridge          C4 (261 Hz) sine — pad medio
 *   - nebula_sync     A1 (55 Hz) sub — drone permanente
 *
 * Refs musicales: Helmholtz On the Sensations of Tone 1863.
 * Refs físicos: Crab pulse profiles Kuiper+ 2001, GW de pulsares Riles 2017.
 */

export interface PulsarAudioConfig {
  ctx: AudioContext;
  setIntensity: (componentIdx: number, intensity: number) => void;
  setSpinPhase: (phase: number) => void;  // 0..1 — para kick drum trigger
  triggerGW: () => void;                  // chirp como evento puntual
  destroy: () => void;
}

const HZ = {
  A1: 55,  E2: 82.41,
  A2: 110, C3: 130.81, E3: 164.81, G3: 196,
  A3: 220, C4: 261.63, E4: 329.63, G4: 392,
  A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, B5: 987.77,
  A5: 880, D6: 1174.66, A6: 1760,
};

export function createPulsarAudio(): PulsarAudioConfig {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const master = ctx.createGain();
  master.gain.value = 0.30;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.15;
  limiter.connect(master);
  master.connect(ctx.destination);

  // Cada componente: gainNode controlable + osc(s)
  const compGains: GainNode[] = [];

  // ── 0. radio_beam: A2 sine drone con leve vibrato ──────────────────
  const radioGain = ctx.createGain(); radioGain.gain.value = 0;
  radioGain.connect(limiter);
  const radioOsc = ctx.createOscillator();
  radioOsc.type = 'sine'; radioOsc.frequency.value = HZ.A2;
  const radioVibLfo = ctx.createOscillator();
  radioVibLfo.type = 'sine'; radioVibLfo.frequency.value = 0.4;
  const radioVibGain = ctx.createGain(); radioVibGain.gain.value = 2;
  radioVibLfo.connect(radioVibGain); radioVibGain.connect(radioOsc.frequency);
  radioOsc.connect(radioGain); radioOsc.start(); radioVibLfo.start();
  compGains.push(radioGain);

  // ── 1. polar_cap_X: A4 triangle warm ───────────────────────────────
  const polarGain = ctx.createGain(); polarGain.gain.value = 0;
  polarGain.connect(limiter);
  const polarOsc = ctx.createOscillator();
  polarOsc.type = 'triangle'; polarOsc.frequency.value = HZ.A4;
  polarOsc.connect(polarGain); polarOsc.start();
  compGains.push(polarGain);

  // ── 2. outer_gap_γ: triple sawtooth detuned (E5+G5+B5) — alta tensión ─
  const gapGain = ctx.createGain(); gapGain.gain.value = 0;
  gapGain.connect(limiter);
  for (const f of [HZ.E5, HZ.G5, HZ.B5]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.005);
    const g = ctx.createGain(); g.gain.value = 0.30;
    o.connect(g); g.connect(gapGain); o.start();
  }
  compGains.push(gapGain);

  // ── 3. bridge: C4 sine pad ─────────────────────────────────────────
  const bridgeGain = ctx.createGain(); bridgeGain.gain.value = 0;
  bridgeGain.connect(limiter);
  const bridgeOsc = ctx.createOscillator();
  bridgeOsc.type = 'sine'; bridgeOsc.frequency.value = HZ.C4;
  bridgeOsc.connect(bridgeGain); bridgeOsc.start();
  compGains.push(bridgeGain);

  // ── 4. nebula_sync: A1 sub-bass drone ──────────────────────────────
  const nebGain = ctx.createGain(); nebGain.gain.value = 0;
  nebGain.connect(limiter);
  const nebOsc = ctx.createOscillator();
  nebOsc.type = 'sine'; nebOsc.frequency.value = HZ.A1;
  nebOsc.connect(nebGain); nebOsc.start();
  compGains.push(nebGain);

  // ── Kick drum: dispara cuando la fase cruza 0 (pulsation period) ───
  let lastPhase = 0;
  const triggerKick = () => {
    const t = ctx.currentTime;
    const k = ctx.createOscillator();
    const kg = ctx.createGain();
    k.type = 'sine';
    k.frequency.setValueAtTime(120, t);
    k.frequency.exponentialRampToValueAtTime(40, t + 0.05);
    kg.gain.setValueAtTime(0.35, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    k.connect(kg); kg.connect(limiter);
    k.start(t); k.stop(t + 0.20);
  };

  // ── Gravitational wave chirp (binary NS merger, ~150 ms long) ─────
  const triggerGW = () => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(35, t);                          // start LIGO band
    o.frequency.exponentialRampToValueAtTime(450, t + 0.5);     // chirp up
    o.frequency.exponentialRampToValueAtTime(180, t + 0.7);     // ringdown
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g); g.connect(limiter);
    o.start(t); o.stop(t + 0.80);
  };

  // ── Public API ─────────────────────────────────────────────────────
  return {
    ctx,
    setIntensity(idx: number, intensity: number) {
      const g = compGains[idx];
      if (!g) return;
      const target = Math.max(0, Math.min(1, intensity)) * 0.18;  // cap per channel
      g.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
    },
    setSpinPhase(phase: number) {
      // Trigger kick cuando cruzamos fase 0 o 0.5 (P1 y P2 del Crab gamma)
      if ((lastPhase > 0.85 && phase < 0.15) || (lastPhase < 0.40 && phase >= 0.40)) {
        triggerKick();
      }
      lastPhase = phase;
    },
    triggerGW,
    destroy() {
      try { ctx.close(); } catch {}
    },
  };
}
