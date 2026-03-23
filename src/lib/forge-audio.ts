/**
 * ⚒️ La Forja — Audio Feedback System
 * =====================================
 * Micro-sounds using Web Audio API — no external files needed.
 * Synthesized metallic/crystalline tones for divine tactile feedback.
 *
 * Design principle: sounds are FELT more than HEARD.
 * Master volume ~15%. Very short durations. Metallic character.
 */

let _ctx: AudioContext | null = null;
let _enabled = true;
let _masterGain: GainNode | null = null;

const MASTER_VOLUME = 0.12; // Very quiet — felt, not heard

function getCtx(): AudioContext | null {
  if (!_enabled) return null;
  if (!_ctx) {
    try {
      _ctx = new AudioContext();
      _masterGain = _ctx.createGain();
      _masterGain.gain.value = MASTER_VOLUME;
      _masterGain.connect(_ctx.destination);
    } catch {
      _enabled = false;
      return null;
    }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function master(): GainNode | null {
  getCtx();
  return _masterGain;
}

// ── Synthesized sounds ──

/** Click — short titanium tap (~35ms) */
export function playClick() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(3200, t);
  osc.frequency.exponentialRampToValueAtTime(1800, t + 0.035);

  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.05);
}

/** Hover tick — barely perceptible (~15ms) */
export function playTick() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 4500;

  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.025);
}

/** Add primitive — whoosh ascending (~100ms) */
export function playCreate() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;

  // Tone sweep
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(1600, t + 0.1);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.setValueAtTime(0.4, t + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.15);

  // Shimmer overtone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(2400, t);
  osc2.frequency.exponentialRampToValueAtTime(3800, t + 0.08);
  gain2.gain.setValueAtTime(0.12, t + 0.02);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc2.connect(gain2).connect(out);
  osc2.start(t);
  osc2.stop(t + 0.12);
}

/** Boolean / complete operation — crystalline ping (~180ms) */
export function playComplete() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;

  // Base ping
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.18);
  gain.gain.setValueAtTime(0.45, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.25);

  // Harmonic shimmer
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 2400;
  gain2.gain.setValueAtTime(0.15, t);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc2.connect(gain2).connect(out);
  osc2.start(t);
  osc2.stop(t + 0.2);

  // Top sparkle
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.value = 4800;
  gain3.gain.setValueAtTime(0.06, t + 0.03);
  gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc3.connect(gain3).connect(out);
  osc3.start(t);
  osc3.stop(t + 0.15);
}

/** Delete — low buzz (~60ms) */
export function playDelete() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.08);
}

/** Error — brief buzzy dissonance (~50ms) */
export function playError() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;

  [150, 157].forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain).connect(out!);
    osc.start(t);
    osc.stop(t + 0.07);
  });
}

/** Undo/Redo — quick phase shift (~40ms) */
export function playUndo() {
  const ctx = getCtx();
  const out = master();
  if (!ctx || !out) return;

  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1600, t);
  osc.frequency.exponentialRampToValueAtTime(800, t + 0.04);

  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.06);
}

// ── Control ──

export function setAudioEnabled(val: boolean) {
  _enabled = val;
  if (!val && _ctx) {
    _ctx.close();
    _ctx = null;
    _masterGain = null;
  }
}

export function isAudioEnabled() { return _enabled; }
