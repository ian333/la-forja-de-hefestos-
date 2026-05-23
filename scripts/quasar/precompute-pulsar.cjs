#!/usr/bin/env node
/**
 * precompute-pulsar — Operador 𝔄 aplicado al pulsar.
 *
 * SIMETRÍAS:
 *   • φ → φ + Ω·t   (rotación rígida + period P) → cara-i temporal
 *   • E → λE         (espectro power-law E^(-Γ)) → cara-Mellin espectral
 *   • paridad N-S    polos magnéticos simétricos
 *
 * Tres caras conmutan → tensor j[componente, log_E, fase] sobre rejilla
 * (Mellin × i_t). Cada slice de banda muestra el pulse profile de esa banda.
 *
 * Output: /public/precomputed/pulsar.bin
 *   Layout (LE):
 *     [N_E (u32), N_PHASE (u32), N_C (u32), _pad (u32)]
 *     [log_E_min, log_E_max, phase_min=0, phase_max=1]   × Float32
 *     [N_C nombres 16 bytes ASCII zero-padded]
 *     [tensor: N_C × N_E × N_PHASE Float32 LE]
 *
 * COMPONENTES (Crab pulsar baseline):
 *   1. radio_beam      — curvature radiation: power-law cutoff, pulse agudo (FWHM ~5%)
 *   2. polar_cap_X     — blackbody térmico kT=100 eV, pulse sinusoidal amplio
 *   3. outer_gap_γ     — cutoff power-law E_cut=2 GeV, DOUBLE peak (Crab signature)
 *   4. bridge_emission — smooth power-law entre los 2 peaks gamma
 *   5. nebula_sync     — sincrotrón de la nebulosa, NO pulsante (background)
 *
 * Refs:
 *   - Kuiper+ 2001 ApJ 567:680 (Crab multi-wavelength)
 *   - Abdo+ 2010 ApJ 708:1254 (Fermi-LAT Crab pulse profiles)
 *   - Lyne & Graham-Smith 2012 textbook ch.4 (emission mechanisms)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

// ── Pulsar parameters (Crab-like) ────────────────────────────────────
const P_ms       = 33.4;       // período en ms
const B_surf_G   = 7.5e12;     // campo magnético superficial Gauss
const kT_eV      = 100;        // temperatura polar cap
const Gamma_X    = 1.7;        // photon index X
const Gamma_γ    = 1.95;       // photon index gamma (Abdo+ 2010)
const E_cut_GeV  = 2.5;        // cutoff exponential gamma

console.log(`precompute-pulsar — Operador 𝔄 → tensor j[c, log_E, fase]`);
console.log(`  P = ${P_ms} ms  (ω = ${(2*Math.PI/P_ms*1000).toFixed(2)} rad/s)`);
console.log(`  B_surf = ${B_surf_G.toExponential(2)} G`);
console.log(`  kT polar = ${kT_eV} eV`);
console.log(`  Γ_X = ${Gamma_X}, Γ_γ = ${Gamma_γ}, E_cut_γ = ${E_cut_GeV} GeV`);

// ── Rejilla ──────────────────────────────────────────────────────────
const N_E     = 64;
const N_PHASE = 128;
const N_C     = 5;

// log_E rango: 10⁻⁹ eV (radio FM-ish, ν~250 MHz) hasta 10⁴ eV nope mucho mejor:
// Radio: ν = 1 GHz → E = h·ν = 4.1e-6 eV. Vamos de log10(E/eV) = -7 a 12 (19 décadas)
const LOG_E_MIN = -7;   // 10⁻⁷ eV = 25 MHz radio
const LOG_E_MAX = 12;   // 10¹² eV = 1 TeV gamma muy alto
const dlogE     = (LOG_E_MAX - LOG_E_MIN) / (N_E - 1);

const components = [
  'radio_beam',
  'polar_cap_X',
  'outer_gap_g',
  'bridge_emis',
  'nebula_sync',
];

const tensor = new Float32Array(N_C * N_E * N_PHASE);

/* ─── Componente 1: RADIO BEAM (curvature radiation) ─────────────────
 *   Spectrum: ν^(-α_R) con α_R≈1.5, cortado abajo de 100 MHz, arriba de ~10 GHz
 *   Pulse:    gaussiano agudo centrado en fase 0.5, FWHM ≈ 0.04 (4% período)
 *             — los pulsares de radio tienen profile MUY estrecho.
 */
function radioBeam(logE_eV, phase) {
  const E = Math.pow(10, logE_eV);
  // Banda radio: E ∈ [4e-8, 4e-4] eV (10 MHz a 100 GHz)
  if (E < 4e-8 || E > 4e-4) return 0;
  const nu_GHz = E / 4.1e-6;
  // Power-law en luminosidad: L_ν ∝ ν^(-1.5), normalizado en 1 GHz
  const Lnu = Math.pow(nu_GHz, -1.5);
  // Pulse profile: gaussiano agudo
  const dPhase = Math.min(Math.abs(phase - 0.5), Math.abs(phase - 0.5 + 1), Math.abs(phase - 0.5 - 1));
  const pulse = Math.exp(-Math.pow(dPhase / 0.020, 2));    // σ=2%, FWHM=4.7%
  return Lnu * pulse * 12;
}

/* ─── Componente 2: POLAR CAP (X-ray térmico) ──────────────────────────
 *   Spectrum: blackbody kT=100 eV (peak en ~250 eV)
 *   Pulse:    sinusoidal amplio (cosθ del polo respecto al observador)
 *             — el polar cap es ~1 km, emite suavemente en función de la fase.
 */
function polarCapX(logE_eV, phase) {
  const E = Math.pow(10, logE_eV);
  // Banda X térmica: E ∈ [10 eV, 5 keV]
  if (E < 10 || E > 5000) return 0;
  // Blackbody en E (no en ν): B_E ∝ E³ / (exp(E/kT) - 1)
  const x = E / kT_eV;
  let bb = 0;
  if (x > 700) bb = 0;
  else if (x < 1e-4) bb = E * E * kT_eV;
  else bb = (E * E * E) / (Math.exp(x) - 1);
  // Pulse: sinusoidal, dos polos (N+S), pero N-S simétricos
  const pulse = 0.5 + 0.5 * Math.cos(2 * Math.PI * (phase - 0.50));
  const pulse2 = 0.5 + 0.5 * Math.cos(2 * Math.PI * (phase - 0.00));
  const total = (pulse + 0.6 * pulse2) / 1.6;  // dos polos pero asimétrico
  return bb * total * 8e-4;
}

/* ─── Componente 3: OUTER GAP (gamma cutoff power-law) ─────────────────
 *   Spectrum: dN/dE ∝ E^(-Γ) · exp(-E/E_cut)
 *   Pulse:    DOUBLE peak característico Crab (P1=0.0, P2=0.4)
 *             — emisión en el outer gap genera 2 peaks separados ~0.4 fase.
 */
function outerGapGamma(logE_eV, phase) {
  const E = Math.pow(10, logE_eV);
  // Banda gamma: E ∈ [100 keV, 1 TeV]
  if (E < 1e5 || E > 1e12) return 0;
  const E_cut = E_cut_GeV * 1e9;  // eV
  const spec = Math.pow(E, -Gamma_γ + 1) * Math.exp(-E / E_cut);   // νF_ν = E²·dN/dE
  // Pulse: dos gaussianas
  const dP1 = Math.min(Math.abs(phase - 0.00), Math.abs(phase - 1.00));
  const dP2 = Math.abs(phase - 0.40);
  const p1 = Math.exp(-Math.pow(dP1 / 0.050, 2));
  const p2 = 0.85 * Math.exp(-Math.pow(dP2 / 0.060, 2));
  return spec * (p1 + p2) * 0.6;
}

/* ─── Componente 4: BRIDGE emission ───────────────────────────────────
 *   Spectrum: power-law suave entre X y gamma
 *   Pulse:    emisión amplia entre P1 y P2 (interpulso)
 */
function bridge(logE_eV, phase) {
  const E = Math.pow(10, logE_eV);
  if (E < 1e3 || E > 1e9) return 0;
  const spec = Math.pow(E, -1.5);
  // Pulse: amplio entre P1 y P2, con peak en 0.2
  const dP = Math.abs(phase - 0.20);
  const pulse = Math.exp(-Math.pow(dP / 0.15, 2));
  return spec * pulse * 1e-3;
}

/* ─── Componente 5: NEBULA sincrotrón (NO pulsante, background) ──────
 *   Crab nebula: sincrotrón broad, sin pulsation, eficiente bajo TeV
 */
function nebulaSync(logE_eV, _phase) {
  const E = Math.pow(10, logE_eV);
  if (E < 1e-6 || E > 1e12) return 0;
  // Power-law con curvatura suave
  return Math.pow(E, -1.0) * Math.exp(-Math.pow(Math.log10(E) - 4, 2) / 30) * 0.05;
}

// ── Build tensor ─────────────────────────────────────────────────────
const fns = [radioBeam, polarCapX, outerGapGamma, bridge, nebulaSync];
for (let c = 0; c < N_C; c++) {
  for (let iE = 0; iE < N_E; iE++) {
    const logE = LOG_E_MIN + iE * dlogE;
    for (let ip = 0; ip < N_PHASE; ip++) {
      const phase = ip / N_PHASE;
      const v = fns[c](logE, phase);
      tensor[c * N_E * N_PHASE + iE * N_PHASE + ip] = Math.max(0, v);
    }
  }
}

// Normalize per-component to bring all on similar scale
for (let c = 0; c < N_C; c++) {
  let max = 0;
  for (let iE = 0; iE < N_E; iE++) {
    for (let ip = 0; ip < N_PHASE; ip++) {
      const v = tensor[c * N_E * N_PHASE + iE * N_PHASE + ip];
      if (v > max) max = v;
    }
  }
  if (max > 0) {
    for (let iE = 0; iE < N_E; iE++) {
      for (let ip = 0; ip < N_PHASE; ip++) {
        tensor[c * N_E * N_PHASE + iE * N_PHASE + ip] /= max;
      }
    }
  }
  console.log(`  ${components[c].padEnd(15)} max raw = ${max.toExponential(2)} → normalized`);
}

// ── Pack binary ──────────────────────────────────────────────────────
const headerSize = 16 + 16 + 16 * N_C;
const totalSize  = headerSize + tensor.byteLength;
const buf = Buffer.alloc(totalSize);
let off = 0;
buf.writeUInt32LE(N_E,     off); off += 4;
buf.writeUInt32LE(N_PHASE, off); off += 4;
buf.writeUInt32LE(N_C,     off); off += 4;
buf.writeUInt32LE(0,       off); off += 4;
buf.writeFloatLE(LOG_E_MIN, off); off += 4;
buf.writeFloatLE(LOG_E_MAX, off); off += 4;
buf.writeFloatLE(0,         off); off += 4;
buf.writeFloatLE(1,         off); off += 4;
for (const name of components) {
  const slot = Buffer.alloc(16);
  Buffer.from(name).copy(slot);
  slot.copy(buf, off); off += 16;
}
Buffer.from(tensor.buffer).copy(buf, off);

const out = path.join(__dirname, '..', '..', 'public', 'precomputed', 'pulsar.bin');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buf);
console.log(`✓ wrote ${out} (${(buf.length / 1024).toFixed(1)} KB)`);
console.log(`  tensor shape: [${N_C}, ${N_E}, ${N_PHASE}]`);
console.log(`  log_E ∈ [${LOG_E_MIN}, ${LOG_E_MAX}] eV (radio → TeV gamma)`);
console.log(`  phase ∈ [0, 1] (1 período = ${P_ms} ms)`);
