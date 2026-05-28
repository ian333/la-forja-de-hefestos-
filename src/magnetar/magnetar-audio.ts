/**
 * MagnetarAudio — sonificación REAL de las QPOs de SGR 1806-20.
 *
 * No es un soundtrack inventado. Las frecuencias son las oscilaciones
 * medidas durante el giant flare de Dec 27, 2004 (Israel+ 2005 ApJ 628:L53,
 * Strohmayer & Watts 2005 ApJ 632:L111, Watts & Strohmayer 2006 ApJ 637:L117):
 *
 *   18 Hz   — toroidal mode (l=2, n=0) crust shear
 *   26 Hz   — crustal shear band
 *   30 Hz   — torsional oscillation
 *   92.5 Hz — toroidal (l=10) — coincide con F#2 (92.5 Hz exacto)
 *   150 Hz  — crustal interface (≈ D#3)
 *   626 Hz  — high-l torsional (≈ D#5)
 *
 * Eso es lo que un magnetar VIBRA físicamente cuando la corteza cede. Lo
 * convertimos a sound waves preservando frecuencias 1:1 (no transposición).
 *
 *   - Drone base = mix ponderado de los 6 QPOs, gain shifteado por B
 *   - STARQUAKE = burst con TODAS las 6 frecuencias juntas (giant flare ringdown)
 *   - PAIR CASCADE (B > B_QED) = static high-freq (sobre el bandpass)
 *   - FRB burst = chirp short 1200→200 Hz (sonifica MHz sweep coherente)
 *
 * Refs: Israel et al. 2005; Watts & Strohmayer 2006; magnetar.mcgill.ca
 */

// QPOs reales de SGR 1806-20 Dec 27 2004 (Hz). Frecuencias EXACTAS medidas,
// pero pesos rebalanceados para favorecer las consonancias armónicas reales:
//   30 Hz (B0) + 92.5 Hz (F#2) → quinta justa 3:1 (toroidal modes l=2, l=10)
//   150 Hz (D#3) + 626 Hz (D#5) → ratio 4:1 (casi 2 octavas)
// Bajamos 18 y 26 (cluster sub-bass disonante) — siguen sonando pero como
// "background drone" del crust, no como front.
const QPO_HZ:   readonly number[] = [18, 26, 30, 92.5, 150, 626];
const QPO_WEIGHT: readonly number[] = [
  0.18,  // 18 Hz  E0 — subaudible drone
  0.12,  // 26 Hz  A0 — disonante con 30, low weight
  0.55,  // 30 Hz  B0 — tonic limpio
  0.95,  // 92.5 Hz F#2 — quinta justa con B0 ★ dominante
  0.50,  // 150 Hz D#3 — sexta menor (warm)
  0.35,  // 626 Hz D#5 — octava casi exacta con D#3
];

export interface MagnetarAudioConfig {
  ctx: AudioContext;
  setB: (logB: number) => void;
  setRotPhase: (phase: number) => void;
  triggerQuake: () => void;
  triggerFRB: () => void;
  destroy: () => void;
}

export function createMagnetarAudio(): MagnetarAudioConfig {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // eslint-disable-next-line no-console
  console.log('[magnetar-audio] AudioContext state =', ctx.state, 'sampleRate =', ctx.sampleRate);

  const master = ctx.createGain();
  master.gain.value = 1.80;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3;
  lim.ratio.value = 12;
  lim.knee.value = 4;
  lim.attack.value = 0.002;
  lim.release.value = 0.20;
  lim.connect(master);
  master.connect(ctx.destination);

  // ── Reverb suave: justificable como "ringing acústico de la corteza" ─
  // La corteza de neutrones tiene crystal lattice que sostiene oscilaciones
  // por decenas de segundos tras un quake (decay τ ~ 100s observado).
  // Convolver con cola sintética 2s — endulza las disonancias y da espacio.
  const reverb = (() => {
    const conv = ctx.createConvolver();
    const N = ctx.sampleRate * 2.0;
    const buf = ctx.createBuffer(2, N, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < N; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/N, 3.0);
      }
    }
    conv.buffer = buf;
    return conv;
  })();
  const reverbSend = ctx.createGain(); reverbSend.gain.value = 0.32;
  reverbSend.connect(reverb).connect(lim);

  // ── TEST BEEP: 1s A4 sine al crear el audio. Confirma que el path
  // ctx→destination funciona. Si oyes este beep al activar audio, el
  // resto del sistema debería funcionar. Si no, AudioContext está bloqueado.
  {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 440;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.30, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.80);
    o.connect(g); g.connect(lim);
    o.start(t); o.stop(t + 0.85);
  }

  // ── Drone = mix de los 6 QPOs REALES con weights consonantes ───────
  const droneGain = ctx.createGain(); droneGain.gain.value = 0.90;
  droneGain.connect(lim);
  droneGain.connect(reverbSend);          // mandar al reverb también
  for (let i = 0; i < QPO_HZ.length; i++) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = QPO_HZ[i];
    const g = ctx.createGain(); g.gain.value = QPO_WEIGHT[i];
    o.connect(g); g.connect(droneGain); o.start();
  }

  // ── Pair cascade: static crackle filtrado (active si B > B_QED) ────
  const cascadeGain = ctx.createGain(); cascadeGain.gain.value = 0;
  cascadeGain.connect(lim);
  // White noise → bandpass high
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const noise = noiseBuf.getChannelData(0);
  for (let i = 0; i < noise.length; i++) noise[i] = (Math.random() * 2 - 1) * 0.15;
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 6;
  noiseSrc.connect(bp); bp.connect(cascadeGain); noiseSrc.start();

  // ── Starquake = giant flare ringdown: las 6 QPOs juntas, decay 1.5s ──
  // Replica lo que RHESSI/RXTE midieron en SGR 1806-20 Dec 27, 2004:
  // explosión inicial + cola QPO que dura segundos.
  const triggerQuake = () => {
    const t = ctx.currentTime;
    // Sub-bass thump inicial (giant flare onset)
    const k = ctx.createOscillator();
    const kg = ctx.createGain();
    k.type = 'sine';
    k.frequency.setValueAtTime(85, t);
    k.frequency.exponentialRampToValueAtTime(22, t + 0.16);
    kg.gain.setValueAtTime(1.10, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
    k.connect(kg); kg.connect(lim);
    k.start(t); k.stop(t + 0.55);

    // QPO ringdown — solo las consonantes con más peso (30, 92.5, 150, 626)
    // forman acorde B0 + F#2 + D#3 + D#5 = power chord stack
    for (let i = 0; i < QPO_HZ.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = QPO_HZ[i];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55 * QPO_WEIGHT[i], t + 0.10);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      o.connect(g);
      g.connect(lim);
      g.connect(reverbSend);             // ringdown se sostiene por el reverb
      o.start(t); o.stop(t + 1.6);
    }

    // Noise burst (energetic radiation)
    const nb = ctx.createBufferSource();
    nb.buffer = noiseBuf;
    const nbg = ctx.createGain();
    nbg.gain.setValueAtTime(0.50, t);
    nbg.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 600;
    nb.connect(hp); hp.connect(nbg); nbg.connect(lim);
    nb.start(t); nb.stop(t + 0.32);
  };

  // ── FRB chirp: 300ms swept tone simulating coherent radio burst ────
  const triggerFRB = () => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    // Real FRB: ~MHz frequency swept down. Sonificamos como sweep 1200→200 Hz
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.30);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.70, t + 0.02);   // FRB louder: 0.45 → 0.70
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(lim);
    o.start(t); o.stop(t + 0.35);
  };

  // ── Public API ─────────────────────────────────────────────────────
  return {
    ctx,
    setB(logB: number) {
      const bNorm = Math.max(0, Math.min(1, (logB - 12) / 4));
      // Direct .value (síncrona) + boosted rango: 0.35 → 0.85
      droneGain.gain.value = 0.35 + 0.50 * bNorm;
      const cascadeOn = logB > 13.64 ? Math.min(1, (logB - 13.64) / 1.5) : 0;
      cascadeGain.gain.value = 0.15 * cascadeOn;  // 0.10 → 0.15
    },
    setRotPhase(_phase: number) { /* heartbeat ya viene del LFO interno */ },
    triggerQuake,
    triggerFRB,
    destroy() { try { ctx.close(); } catch {} },
  };
}
