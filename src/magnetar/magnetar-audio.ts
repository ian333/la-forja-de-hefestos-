/**
 * MagnetarAudio — sonificación del magnetar.
 *
 * Diseño:
 *   - DRONE base: sub-bass que cambia con B (más B = más grave + más fuerte)
 *     · sine A1 (55 Hz) + sub octava abajo si B muy alto
 *   - PULSACIÓN rotacional: P~6s real → 0.16 Hz (subaudible). Usamos un LFO
 *     que modula el drone amplitude (heartbeat tipo whale)
 *   - STARQUAKE: percusión drum (kick + noise burst) cuando se dispara
 *   - PAIR CASCADE (B > B_QED): static crackle high freq
 *   - FRB burst (botón): chirp short 500ms (Fast Radio Burst from SGR 1935)
 *
 * Refs: SGR 1935+2154 FRB 200428 fue audible-equivalent loudest natural radio
 *       evento en MW; magnetares producen ondas de fuerza tan extrema que
 *       deformarían el cuerpo a 10⁵ km de distancia.
 */

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
  master.gain.value = 0.60;   // subido de 0.30 → 0.60 para audible default
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -6;
  lim.ratio.value = 10;
  lim.attack.value = 0.003;
  lim.release.value = 0.18;
  lim.connect(master);
  master.connect(ctx.destination);

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

  // ── Drone base: sine 55 Hz (A1) + sub octave 110 Hz (A2) ───────────
  // SIMPLIFICADO: gain hardcoded audible. Sin LFO modulation (puede llegar
  // a 0 al inicio). Sin setTargetAtTime async — usar .value directo.
  const droneGain = ctx.createGain(); droneGain.gain.value = 0.35;
  droneGain.connect(lim);
  const drone1 = ctx.createOscillator();
  drone1.type = 'sine'; drone1.frequency.value = 55;          // A1
  drone1.connect(droneGain); drone1.start();

  const drone2 = ctx.createOscillator();
  drone2.type = 'sine'; drone2.frequency.value = 110;         // A2
  const d2g = ctx.createGain(); d2g.gain.value = 0.55;
  drone2.connect(d2g); d2g.connect(droneGain); drone2.start();

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

  // ── Starquake: kick + noise burst ──────────────────────────────────
  const triggerQuake = () => {
    const t = ctx.currentTime;
    const k = ctx.createOscillator();
    const kg = ctx.createGain();
    k.type = 'sine';
    k.frequency.setValueAtTime(80, t);
    k.frequency.exponentialRampToValueAtTime(28, t + 0.12);
    kg.gain.setValueAtTime(0.55, t);
    kg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    k.connect(kg); kg.connect(lim);
    k.start(t); k.stop(t + 0.40);
    // noise burst
    const nb = ctx.createBufferSource();
    nb.buffer = noiseBuf;
    const nbg = ctx.createGain();
    nbg.gain.setValueAtTime(0.25, t);
    nbg.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 600;
    nb.connect(hp); hp.connect(nbg); nbg.connect(lim);
    nb.start(t); nb.stop(t + 0.22);
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
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(lim);
    o.start(t); o.stop(t + 0.35);
  };

  // ── Public API ─────────────────────────────────────────────────────
  return {
    ctx,
    setB(logB: number) {
      const bNorm = Math.max(0, Math.min(1, (logB - 12) / 4));
      // Direct .value asignación (síncrona, no async)
      droneGain.gain.value = 0.20 + 0.35 * bNorm;
      const cascadeOn = logB > 13.64 ? Math.min(1, (logB - 13.64) / 1.5) : 0;
      cascadeGain.gain.value = 0.10 * cascadeOn;
    },
    setRotPhase(_phase: number) { /* heartbeat ya viene del LFO interno */ },
    triggerQuake,
    triggerFRB,
    destroy() { try { ctx.close(); } catch {} },
  };
}
