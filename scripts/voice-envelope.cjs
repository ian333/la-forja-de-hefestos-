#!/usr/bin/env node
/**
 * voice-envelope.cjs — extrae la ENVOLVENTE de amplitud (RMS) de una narración
 * y la guarda como JSON. Así las escenas pulsan al ritmo de la VOZ real (no un
 * sin() inventado), de forma DETERMINISTA (indexada por t → cacheable en render).
 *
 *   node scripts/voice-envelope.cjs public/audio/clase-coase/narration.mp3
 *   → escribe public/audio/clase-coase/envelope.json  { fps, dur, env:[0..1,...] }
 *
 * El envelope se suaviza (ataque rápido, caída lenta) para que el pulso se sienta
 * orgánico y no tiemble por sílaba. Lo lee dynamics.tsx (VoiceDriver).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) { console.error('uso: node voice-envelope.cjs <narration.mp3>'); process.exit(1); }

const FPS = 30;          // muestras de envelope por segundo
const SR = 8000;         // resample a 8 kHz mono (suficiente para amplitud)
const WIN = Math.round(SR / FPS);

// PCM crudo float32 mono
const raw = execSync(`ffmpeg -v error -i "${input}" -ac 1 -ar ${SR} -f f32le -`, { maxBuffer: 256 * 1024 * 1024 });
const n = Math.floor(raw.length / 4);
const samples = new Float32Array(raw.buffer, raw.byteOffset, n);

// RMS por ventana
const rms = [];
for (let i = 0; i < n; i += WIN) {
  let s = 0; const end = Math.min(i + WIN, n);
  for (let j = i; j < end; j++) s += samples[j] * samples[j];
  rms.push(Math.sqrt(s / Math.max(1, end - i)));
}

// normaliza por el percentil 95 (robusto a picos)
const sorted = [...rms].sort((a, b) => a - b);
const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1e-6;
let env = rms.map(v => Math.min(1, v / p95));

// suaviza: ataque rápido (0.5), caída lenta (0.12) → pulso orgánico
const out = new Array(env.length);
let prev = 0;
for (let i = 0; i < env.length; i++) {
  const x = env[i];
  prev = x > prev ? prev + (x - prev) * 0.5 : prev + (x - prev) * 0.12;
  out[i] = Math.round(prev * 1000) / 1000;
}

const dur = n / SR;
const dst = path.join(path.dirname(input), 'envelope.json');
fs.writeFileSync(dst, JSON.stringify({ fps: FPS, dur: Math.round(dur * 100) / 100, env: out }));
console.log(`✓ ${dst}  (${out.length} muestras, ${dur.toFixed(1)}s, max ${Math.max(...out).toFixed(2)})`);
