/**
 * QuasarSedAudio — sonificación musical del SED.
 *
 * Diseño armónico (en vez de freq arbitrarias):
 *
 *  Master tonic: A2 = 110 Hz (root)
 *  Scale: A minor pentatonic (consonante, sin half-steps disonantes)
 *    A2  110.00     A3  220.00     A4  440.00     A5  880.00
 *    C3  130.81     C4  261.63     C5  523.25     C6  1046.50
 *    D3  146.83     D4  293.66     D5  587.33     D6  1174.66
 *    E3  164.81     E4  329.63     E5  659.25     E6  1318.51
 *    G3  196.00     G4  392.00     G5  783.99     G6  1567.98
 *
 *  Cada componente físico tiene su acorde dentro del scale:
 *
 *   • disco       — A2 + A3 + E4 (root power + 5th harmonic)
 *   • corona      — E5 + G5 + B5 (high bright triad)
 *   • reflection  — A5 ringing (high Q resonance)
 *   • torus       — A1 + E2 (sub-bass open 5th)
 *   • BLR         — pentatonic 5-bell C4 D4 E4 G4 A4 (líneas espectrales)
 *   • jet sync    — A2 + E3 sub drone (warm bass)
 *   • jet IC      — D5 + A5 + D6 bell shimmer (high)
 *
 *  El volumen de cada canal sigue bandIntensity(c, log_ν).
 *
 *  Spectrum scanner: un tono adicional cuyo PITCH = log_ν del slider
 *  mapeado log → musical. log_ν ∈ [7, 25] → A2 ↔ A6 (4 octavas).
 *  Cuando barres el slider, oyes una sweep continua del registro.
 *
 *  Refs: Helmholtz On the Sensations of Tone 1863, Sethares Tuning Timbre 2005.
 */

export interface SedAudioConfig {
  ctx: AudioContext;
  masterGain: GainNode;
  setIntensity: (componentIdx: number, intensity: number) => void;
  setLogNu: (logNu: number) => void;
  triggerKnotBurst: () => void;
  triggerGWChirp: () => void;
  destroy: () => void;
}

// ── Escala (Hz) ────────────────────────────────────────────────────
const HZ = {
  A1: 55,    E2: 82.41,
  A2: 110,   C3: 130.81, D3: 146.83, E3: 164.81, G3: 196,
  A3: 220,   C4: 261.63, D4: 293.66, E4: 329.63, G4: 392,
  A4: 440,   C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, B5: 987.77,
  A5: 880,   D6: 1174.66, A6: 1760,
};

export function createSedAudio(): SedAudioConfig {
  const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
  const master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.15;
  limiter.connect(master);

  // Reverb leve via convolver (impulse sintético, cola corta)
  const reverb = (() => {
    const conv = ctx.createConvolver();
    const N = ctx.sampleRate * 1.4;
    const buf = ctx.createBuffer(2, N, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < N; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/N, 3.5);
      }
    }
    conv.buffer = buf;
    return conv;
  })();
  const reverbSend = ctx.createGain(); reverbSend.gain.value = 0.18;
  reverbSend.connect(reverb).connect(limiter);

  // Pink noise para texturas
  const pinkBuf = (() => {
    const N = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, N, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < N; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179;
      b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520;
      b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522;
      b5 = -0.7616*b5 - w*0.0168980;
      data[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  })();
  const noiseSource = () => {
    const s = ctx.createBufferSource();
    s.buffer = pinkBuf; s.loop = true; s.start();
    return s;
  };

  // Helper: sumar muchos osciladores en una cadena con gain común
  const mkOsc = (type: OscillatorType, freq: number, amp: number, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = ctx.createGain(); g.gain.value = amp;
    o.connect(g); o.start();
    return g;
  };

  // ── 1. DISCO — power chord A2 + A3 + E4 ────────────────────────────
  const disk = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const a2 = mkOsc('sine', HZ.A2, 0.18);
    const a3 = mkOsc('sine', HZ.A3, 0.22);
    const e4 = mkOsc('triangle', HZ.E4, 0.16, -3);
    // LFO pulsing (orbital ~ 1.4 Hz, slow heartbeat)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.4;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.35;
    lfo.connect(lfoG); lfoG.connect(out.gain);
    a2.connect(out); a3.connect(out); e4.connect(out);
    out.connect(limiter);
    out.connect(reverbSend);
    lfo.start();
    return out;
  })();

  // ── 2. CORONA — bright high triad E5 + G5 + B5 ─────────────────────
  const corona = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const e5 = mkOsc('triangle', HZ.E5, 0.12);
    const g5 = mkOsc('triangle', HZ.G5, 0.10, +4);
    const b5 = mkOsc('sine',     HZ.B5, 0.08, -3);
    // Touch of high noise for "chaos" but very quiet
    const n = noiseSource();
    const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 2400; nbp.Q.value = 4;
    const ng = ctx.createGain(); ng.gain.value = 0.025;
    n.connect(nbp).connect(ng).connect(out);
    e5.connect(out); g5.connect(out); b5.connect(out);
    out.connect(limiter);
    out.connect(reverbSend);
    return out;
  })();

  // ── 3. REFLECTION — high ringing tone A5 ──────────────────────────
  const reflection = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const a5 = mkOsc('sine', HZ.A5, 0.18);
    const e6 = mkOsc('triangle', HZ.E5 * 2, 0.08, +5);
    // High-Q ring on noise for the "Fe-Kα fluorescence" texture
    const n = noiseSource();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = HZ.A5; bp.Q.value = 28;
    const ng = ctx.createGain(); ng.gain.value = 0.10;
    n.connect(bp).connect(ng).connect(out);
    a5.connect(out); e6.connect(out);
    out.connect(limiter);
    out.connect(reverbSend);
    return out;
  })();

  // ── 4. TORUS — sub-bass A1 + E2 (open 5th) ────────────────────────
  const torus = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const a1 = mkOsc('sine', HZ.A1, 0.35);
    const e2 = mkOsc('sine', HZ.E2, 0.28);
    // Slow LFO for "breathing" warm pad
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.Q.value = 0.6;
    a1.connect(lp); e2.connect(lp); lp.connect(out);
    out.connect(limiter);
    return out;
  })();

  // ── 5. BLR — 5 bells pentatonic C4 D4 E4 G4 A4 (líneas espectrales) ──
  const blr = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const pitches = [HZ.C4, HZ.D4, HZ.E4, HZ.G4, HZ.A4];
    pitches.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.2 + i * 0.08;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.05;
      lfo.connect(lfoG);
      const og = ctx.createGain(); og.gain.value = 0.10;
      lfoG.connect(og.gain);
      o.connect(og).connect(out);
      o.start(); lfo.start();
    });
    out.connect(limiter);
    out.connect(reverbSend);
    return out;
  })();

  // ── 6. JET SYNC — warm bass A2 + E3 + low pink noise ──────────────
  const jetSync = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const a2 = mkOsc('sine', HZ.A2, 0.22);
    const e3 = mkOsc('sine', HZ.E3, 0.16, +3);
    // Low noise component for plasma "whoosh"
    const n = noiseSource();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.3;
    const lfoG = ctx.createGain(); lfoG.gain.value = 150;
    lfo.connect(lfoG).connect(lp.frequency);
    const ng = ctx.createGain(); ng.gain.value = 0.18;
    n.connect(lp).connect(ng).connect(out);
    a2.connect(out); e3.connect(out);
    out.connect(limiter);
    out.connect(reverbSend);
    lfo.start();
    return out;
  })();

  // ── 7. JET IC — bell shimmer D5 + A5 + D6 ─────────────────────────
  const jetIC = (() => {
    const out = ctx.createGain(); out.gain.value = 0;
    const d5 = mkOsc('triangle', HZ.D5, 0.12);
    const a5 = mkOsc('sine',     HZ.A5, 0.10, -7);
    const d6 = mkOsc('triangle', HZ.D6, 0.07, +5);
    // Slight detune LFO for shimmer
    const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 4.2;
    const lfoG = ctx.createGain(); lfoG.gain.value = 8;
    lfo.connect(lfoG); lfoG.connect(d5.gain);
    d5.connect(out); a5.connect(out); d6.connect(out);
    out.connect(limiter);
    out.connect(reverbSend);
    lfo.start();
    return out;
  })();

  const channelGains = [disk, corona, reflection, torus, blr, jetSync, jetIC];

  // ── Spectrum scanner — pitch sigue log_ν del slider ───────────────
  // log_ν ∈ [7, 25] → log2 mapping to musical pitch
  // freq = A2 · 2^((logNu - 7) / 4.5)  → 4 octavas
  const scanner = (() => {
    const out = ctx.createGain(); out.gain.value = 0.12;
    const sine = ctx.createOscillator(); sine.type = 'sine'; sine.frequency.value = HZ.A3;
    const tri  = ctx.createOscillator(); tri.type = 'triangle'; tri.frequency.value = HZ.A3 * 2; tri.detune.value = -3;
    const g1 = ctx.createGain(); g1.gain.value = 0.55;
    const g2 = ctx.createGain(); g2.gain.value = 0.18;
    sine.connect(g1).connect(out); tri.connect(g2).connect(out);
    out.connect(limiter); out.connect(reverbSend);
    sine.start(); tri.start();
    return { out, sine, tri };
  })();

  const setLogNu = (logNu: number) => {
    // Cuantizar a la escala A minor pentatonic más cercana para que
    // siempre suene "in tune".
    const u = (logNu - 7) / (25 - 7);             // 0..1
    const semitone_continuous = u * 48;            // 0 a 48 semitones (4 octavas)
    // A natural minor scale steps (semitones from A): 0, 2, 3, 5, 7, 8, 10, 12
    // Pentatonic subset (no half-steps): 0, 3, 5, 7, 10 (en cada octava)
    const PENT = [0, 3, 5, 7, 10];
    const oct = Math.floor(semitone_continuous / 12);
    const semInOct = semitone_continuous - oct * 12;
    // Snap to nearest pentatonic step
    let best = PENT[0], bestDist = Math.abs(semInOct - PENT[0]);
    for (const p of PENT) {
      const d = Math.abs(semInOct - p);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    const snapped_sem = oct * 12 + best;
    const freq = HZ.A2 * Math.pow(2, snapped_sem / 12);
    const t = ctx.currentTime;
    scanner.sine.frequency.cancelScheduledValues(t);
    scanner.sine.frequency.linearRampToValueAtTime(freq, t + 0.15);
    scanner.tri.frequency.cancelScheduledValues(t);
    scanner.tri.frequency.linearRampToValueAtTime(freq * 2, t + 0.15);
  };

  // ── Knot burst kick (musical, in key) ─────────────────────────────
  const triggerKnotBurst = () => {
    const t = ctx.currentTime;
    // Kick: A1 → very low decay (tonic root reinforce)
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(HZ.A2, t);
    osc.frequency.exponentialRampToValueAtTime(HZ.A1 * 0.7, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    osc.connect(g).connect(limiter);
    osc.start(t); osc.stop(t + 0.35);
    // Click HP-filtered noise burst
    const n = noiseSource();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.20, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    n.connect(hp).connect(ng).connect(limiter);
    setTimeout(() => { try { n.stop(); } catch (_) {} }, 80);
  };

  // ── GW chirp (musical: ends en A4 = tonic ringdown) ───────────────
  const triggerGWChirp = () => {
    const t = ctx.currentTime;
    // Inspiral: from A2 (110) to E5 (659) exponentially (≈2.6 octavas)
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(HZ.A2, t);
    osc.frequency.exponentialRampToValueAtTime(HZ.E5, t + 0.42);
    // Ringdown: A4 tonic decay (the BH "sings" in the QNM ≈ tonic)
    osc.frequency.exponentialRampToValueAtTime(HZ.A4, t + 0.48);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.65, t + 0.05);
    g.gain.linearRampToValueAtTime(0.45, t + 0.42);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(g).connect(limiter);
    osc.connect(reverbSend);
    osc.start(t); osc.stop(t + 1.5);
  };

  const setIntensity = (idx: number, intensity: number) => {
    if (idx < 0 || idx >= channelGains.length) return;
    const g = channelGains[idx].gain;
    const target = Math.min(0.6, Math.pow(intensity, 0.7) * 0.48);
    g.cancelScheduledValues(ctx.currentTime);
    g.linearRampToValueAtTime(target, ctx.currentTime + 0.14);
  };

  const destroy = () => {
    try { ctx.close(); } catch (_) { /* ignore */ }
  };

  return { ctx, masterGain: master, setIntensity, setLogNu, triggerKnotBurst, triggerGWChirp, destroy };
}
