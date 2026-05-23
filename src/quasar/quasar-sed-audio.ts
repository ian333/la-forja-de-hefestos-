/**
 * QuasarSedAudio — sonificación del SED del cuásar via Web Audio API.
 *
 * Cada componente físico tiene un timbre que evoca su mecanismo radiativo:
 *
 *   • disco       — drone pulsante (orbital QPOs transposed ×10⁶), 220 Hz fundamental
 *   • corona      — filtered noise + chaos (Compton up-scattering = stochastic)
 *   • reflection  — ringing tone (Fe-Kα fluorescence "rings" en la corona)
 *   • torus       — sub-bass drone (cold thermal IR, low frequency feel)
 *   • BLR         — bells discretas en 6 pitches (líneas Lyα/Hα/Hβ/MgII/CIV/CIII])
 *   • jet sync    — filtered noise (relativistic plasma, white-ish)
 *   • jet IC      — square wave bursts (Compton up-scattered photons)
 *
 * Volumen de cada canal = bandIntensity(component, log_ν_actual) — la misma
 * función que controla el brillo visual. Cuando deslizas el slider OYES el
 * cuásar transformarse.
 *
 * Knot bursts (cada 1.6s en la viz): kick drum filtrado, solo audible cuando
 * la banda radio/sub-mm domina (sincrotrón emite en esa zona).
 *
 * GW chirp (toggle separado): emula GW150914-like binary BH merger, freq
 * rising desde 30 Hz hasta 250 Hz en ~0.4s + ringdown a 100 Hz.
 *
 * Requiere user gesture para iniciar (Web Audio policy).
 */

export interface SedAudioConfig {
  ctx: AudioContext;
  masterGain: GainNode;
  setIntensity: (componentIdx: number, intensity: number) => void;
  triggerKnotBurst: () => void;
  triggerGWChirp: () => void;
  destroy: () => void;
}

export function createSedAudio(): SedAudioConfig {
  const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
  const master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);

  // Smooth limiter para no clipear
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  limiter.connect(master);

  // ── Componente helpers ────────────────────────────────────────────
  const createNoise = (color: 'white' | 'pink') => {
    const N = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, N, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (color === 'white') {
      for (let i = 0; i < N; i++) data[i] = Math.random() * 2 - 1;
    } else {
      // Pink: filtered random walk (Voss-McCartney approx)
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for (let i = 0; i < N; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  };
  const whiteBuf = createNoise('white');
  const pinkBuf  = createNoise('pink');

  const noiseSource = (buf: AudioBuffer) => {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start();
    return s;
  };

  // ── 1. DISCO — drone orbital pulsante ─────────────────────────────
  // Para BH de 10⁹ M☉, orbital freq en ISCO ≈ c³/(2π·G·M·6^1.5) ≈ 0.45 mHz
  // Transposed ×500000 → 225 Hz fundamental (audio).
  const disk = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const fund = ctx.createOscillator(); fund.type = 'sine'; fund.frequency.value = 220;
    const fifth = ctx.createOscillator(); fifth.type = 'sine'; fifth.frequency.value = 330;
    const oct = ctx.createOscillator(); oct.type = 'triangle'; oct.frequency.value = 440;
    // LFO para pulsar (orbital coherence ≈ 1-2 Hz transposed)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.4;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain).connect(gain.gain);
    // Sumar las 3 oscilaciones via gainStage
    const sumG = ctx.createGain(); sumG.gain.value = 0.25;
    fund.connect(sumG); fifth.connect(sumG); oct.connect(sumG);
    sumG.connect(gain).connect(limiter);
    fund.start(); fifth.start(); oct.start(); lfo.start();
    return gain;
  })();

  // ── 2. CORONA — bandpass-filtered white noise ─────────────────────
  const corona = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const noise = noiseSource(whiteBuf);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.5;
    // Modulate frequency for "chaos" feel
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 7;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 600;
    lfo.connect(lfoGain).connect(bp.frequency);
    noise.connect(bp).connect(gain).connect(limiter);
    lfo.start();
    return gain;
  })();

  // ── 3. REFLECTION — high-Q ringing tone (Fe-Kα fluorescence) ──────
  const reflection = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const noise = noiseSource(whiteBuf);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 28;     // very ringy
    noise.connect(bp).connect(gain).connect(limiter);
    return gain;
  })();

  // ── 4. TORUS — sub-bass drone (cold thermal) ──────────────────────
  const torus = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 55;     // A1
    const sub2 = ctx.createOscillator(); sub2.type = 'sine'; sub2.frequency.value = 82.4; // E2
    const subG = ctx.createGain(); subG.gain.value = 0.4;
    sub.connect(subG); sub2.connect(subG);
    // LP filter para tone cálido
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7;
    subG.connect(lp).connect(gain).connect(limiter);
    sub.start(); sub2.start();
    return gain;
  })();

  // ── 5. BLR — bell tones en pitches de las líneas ──────────────────
  // Líneas: Lyα 1216 / CIV 1549 / CIII] 1909 / MgII 2798 / Hβ 4861 / Hα 6563
  // Mapeamos a pitches musicales (D minor scale-ish)
  const blr = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const pitches = [293.66, 349.23, 440, 523.25, 587.33, 659.25];   // D4-F4-A4-C5-D5-E5
    for (const f of pitches) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.2 + Math.random() * 0.4;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.07;
      lfo.connect(lfoG);
      const og = ctx.createGain(); og.gain.value = 0.12;
      lfoG.connect(og.gain);
      o.connect(og).connect(gain);
      o.start(); lfo.start();
    }
    gain.connect(limiter);
    return gain;
  })();

  // ── 6. JET SYNC — pink noise filtered (relativistic plasma whoosh) ─
  const jetSync = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const noise = noiseSource(pinkBuf);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 400; hp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 4500; lp.Q.value = 0.5;
    // Slow LFO on filter (jet variability)
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.3;
    const lfoG = ctx.createGain(); lfoG.gain.value = 800;
    lfo.connect(lfoG).connect(lp.frequency);
    noise.connect(hp).connect(lp).connect(gain).connect(limiter);
    lfo.start();
    return gain;
  })();

  // ── 7. JET IC — square wave glitches en alta frecuencia ───────────
  const jetIC = (() => {
    const gain = ctx.createGain(); gain.gain.value = 0;
    const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.value = 880;
    const sq2 = ctx.createOscillator(); sq2.type = 'square'; sq2.frequency.value = 1318.5;
    // detune slightly for shimmer
    const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 4.2;
    const lfoG = ctx.createGain(); lfoG.gain.value = 25;
    lfo.connect(lfoG).connect(sq.detune);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    const subG = ctx.createGain(); subG.gain.value = 0.08;
    sq.connect(subG); sq2.connect(subG);
    subG.connect(lp).connect(gain).connect(limiter);
    sq.start(); sq2.start(); lfo.start();
    return gain;
  })();

  const channelGains = [disk, corona, reflection, torus, blr, jetSync, jetIC];

  // ── Knot burst kick drum ──────────────────────────────────────────
  const triggerKnotBurst = () => {
    const t = ctx.currentTime;
    // Synth kick: sine sweep 120 Hz → 40 Hz over 0.15s
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.6, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    osc.connect(g).connect(limiter);
    osc.start(t); osc.stop(t + 0.35);
    // Add click (white noise burst HP filtered)
    const n = noiseSource(whiteBuf);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    n.connect(hp).connect(ng).connect(limiter);
    setTimeout(() => { try { n.stop(); } catch (_) {} }, 80);
  };

  // ── GW chirp (binary BH inspiral + ringdown) ──────────────────────
  const triggerGWChirp = () => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    // Inspiral: 30 Hz → 250 Hz exponential (GW150914-like)
    osc.frequency.setValueAtTime(30, t);
    osc.frequency.exponentialRampToValueAtTime(250, t + 0.4);
    // Ringdown: 250 → 220 Hz fast decay
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.05);
    g.gain.linearRampToValueAtTime(0.5, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(g).connect(limiter);
    osc.start(t); osc.stop(t + 1.3);
  };

  const setIntensity = (idx: number, intensity: number) => {
    if (idx < 0 || idx >= channelGains.length) return;
    const g = channelGains[idx].gain;
    const target = Math.min(0.7, Math.pow(intensity, 0.7) * 0.5);
    g.cancelScheduledValues(ctx.currentTime);
    g.linearRampToValueAtTime(target, ctx.currentTime + 0.12);
  };

  const destroy = () => {
    try { ctx.close(); } catch (_) { /* ignore */ }
  };

  return { ctx, masterGain: master, setIntensity, triggerKnotBurst, triggerGWChirp, destroy };
}
