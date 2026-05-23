#!/usr/bin/env node
/**
 * precompute-sed — aplicación del Operador 𝔄 al problema multi-wavelength
 * del quásar.
 *
 * SIMETRÍAS IDENTIFICADAS:
 *
 *   • φ → φ + a    (axisimetría) → cara-i azimutal (e^imφ)
 *   • r → λr       (escala radial: T(r) ∝ r^(-3/4)) → cara-Mellin radial
 *   • ν → λν       (escala espectral: synchrotron ν^(-α)) → cara-Mellin ν
 *   • ν → δν       (Doppler) → translation en log ν = mult. Mellin
 *
 * Las 4 caras conmutan → factorización tensor producto. Cada cara se computa
 * UNA VEZ como LUT 1D. Runtime: 4 lookups + producto por pixel.
 *
 * Output: /public/precomputed/quasar-sed.bin
 *   Layout:
 *     [N_nu (u32), N_r (u32), N_components (u32), _pad (u32)]
 *     [log_nu_min, log_nu_max, log_r_min, log_r_max]    × Float32
 *     [N_components componentes nombre 16 bytes c/u]    × ASCII (zero-padded)
 *     [emissivity tensor: N_components × N_nu × N_r]    × Float32 LE
 *
 *   Conceptualmente: el campo j(component, log ν, log r) sobre rejilla Mellin
 *   doble. Cada componente físico (disco, corona, torus, jet, BLR) es un
 *   slice de la 3-tensor.
 *
 * COMPONENTES MODELADOS (cada uno con física real, ref en QUASAR-PHYSICS-REFERENCE.md):
 *
 *   1. Disco Shakura-Sunyaev (Big Blue Bump, peak UV)
 *   2. Corona Comptonization (hard X-ray, ν^(-α_X) con cutoff)
 *   3. Reflection Compton hump + Fe-Kα
 *   4. Dusty torus multi-T (mid/far-IR)
 *   5. BLR emission lines (Lyα, Hβ, MgII, CIV — discrete spikes)
 *   6. Jet synchrotron self-absorbed (radio rising, then ν^(-0.7))
 *   7. Jet IC SSC + EC (gamma-ray)
 *
 * BH baseline: M = 10⁹ M☉, Ṁ = 0.1·Ṁ_Edd, a* = 0.9, viewing angle θ = 30°.
 *
 * Refs físicos: ver docs/QUASAR-PHYSICS-REFERENCE.md
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Constantes físicas (CGS) ──────────────────────────────────────────
const c          = 2.998e10;            // cm/s
const G          = 6.674e-8;            // cgs
const h          = 6.626e-27;           // erg·s
const k_B        = 1.381e-16;           // erg/K
const sigma_SB   = 5.670e-5;            // erg·cm⁻²·s⁻¹·K⁻⁴
const m_p        = 1.673e-24;           // g
const sigma_T    = 6.652e-25;           // cm² (Thomson cross-section)
const M_sun      = 1.989e33;            // g
const L_sun      = 3.828e33;            // erg/s
const pc         = 3.086e18;            // cm
const eV         = 1.602e-12;           // erg

// ── Parámetros del cuásar baseline ────────────────────────────────────
const M_BH    = 1e9 * M_sun;            // 10⁹ M☉
const m_dot   = 0.1;                    // Ṁ/Ṁ_Edd
const aStar   = 0.9;                    // Kerr spin
const inclDeg = 30;                     // viewing angle (jet half-axis = 0°)
const incl    = inclDeg * Math.PI / 180;

const r_g     = G * M_BH / (c*c);                               // cm
const L_Edd   = 4 * Math.PI * G * M_BH * m_p * c / sigma_T;     // erg/s
const eta     = 0.15;                                            // efficiency (Kerr ~ 0.15-0.42)
const L_bol   = m_dot * L_Edd;                                  // erg/s
const Mdot    = L_bol / (eta * c * c);                          // g/s
const r_ISCO  = (function() {
  const Z1 = 1 + Math.cbrt(1-aStar*aStar) * (Math.cbrt(1+aStar) + Math.cbrt(1-aStar));
  const Z2 = Math.sqrt(3*aStar*aStar + Z1*Z1);
  return 3 + Z2 - Math.sign(aStar) * Math.sqrt((3-Z1)*(3+Z1+2*Z2));
})();   // in units of r_g

console.log(`precompute-sed — Operador 𝔄 aplicado al cuásar`);
console.log(`  M_BH    = ${(M_BH/M_sun).toExponential(2)} M☉`);
console.log(`  L_Edd   = ${L_Edd.toExponential(2)} erg/s`);
console.log(`  L_bol   = ${L_bol.toExponential(2)} erg/s (Ṁ/Ṁ_Edd = ${m_dot})`);
console.log(`  Ṁ       = ${Mdot.toExponential(2)} g/s = ${(Mdot/M_sun*3.15e7).toExponential(2)} M☉/yr`);
console.log(`  r_g     = ${r_g.toExponential(2)} cm = ${(r_g/pc).toExponential(2)} pc`);
console.log(`  r_ISCO  = ${r_ISCO.toFixed(3)} r_g (a*=${aStar})`);

// ── Rejilla Mellin doble ──────────────────────────────────────────────
const N_NU   = 256;
const N_R    = 128;

// Frecuencia: 10⁷ Hz (radio FM-ish) → 10²⁵ Hz (GeV gamma), 18 décadas
const LOG_NU_MIN = 7;
const LOG_NU_MAX = 25;
const dlog_nu    = (LOG_NU_MAX - LOG_NU_MIN) / (N_NU - 1);

// Radio: 0.5 r_g (DENTRO del horizonte para mostrar la sombra) → 10⁹ r_g (NLR, ~kpc)
const LOG_R_MIN = -0.3;   // log₁₀(0.5)
const LOG_R_MAX = 9;
const dlog_r    = (LOG_R_MAX - LOG_R_MIN) / (N_R - 1);

// ── Helpers físicos ───────────────────────────────────────────────────

function planck_Bnu(nu_Hz, T_K) {
  // Planck function B_ν(T) en erg·cm⁻²·s⁻¹·Hz⁻¹·sr⁻¹
  const x = h * nu_Hz / (k_B * T_K);
  if (x > 700) return 0;                         // overflow
  if (x < 1e-4) return (2 * h * nu_Hz**3 / (c*c)) / x;    // Rayleigh-Jeans
  return (2 * h * nu_Hz**3 / (c*c)) / (Math.exp(x) - 1);
}

// 1. DISCO Shakura-Sunyaev: T(r) ∝ r^(-3/4) con factor de boundary
function disk_T(r_in_rg) {
  // Skip si dentro de ISCO
  if (r_in_rg < r_ISCO) return 0;
  const r = r_in_rg * r_g;
  const r_in = r_ISCO * r_g;
  const T_inner = 3 * G * M_BH * Mdot / (8 * Math.PI * sigma_SB * r**3);
  const boundary = Math.max(0, 1 - Math.sqrt(r_in / r));
  return Math.pow(T_inner * boundary, 0.25);
}

function disk_emissivity(nu_Hz, r_in_rg) {
  const T = disk_T(r_in_rg);
  if (T <= 0) return 0;
  // ν·F_ν surface brightness = π·B_ν · area-weight. Aquí guardamos el
  // monochromatic surface brightness (será integrado angularmente en runtime)
  return Math.PI * planck_Bnu(nu_Hz, T) * 2 * Math.PI * (r_in_rg * r_g);
}

// 2. CORONA Comptonization: power law con cutoff
function corona_emissivity(nu_Hz, r_in_rg) {
  // Corona compacta, 3-30 r_g
  if (r_in_rg < 3 || r_in_rg > 30) return 0;
  const Gamma = 1.9;                          // photon index
  const E_cut_keV = 150;
  const E_keV = h * nu_Hz / eV / 1000;
  if (E_keV < 0.05) return 0;                 // soft cutoff at very low E
  const norm = L_bol * 0.1 / (4 * Math.PI * (r_g * 10)**2);   // crude L_X/L_bol = 0.1
  // dN/dE ∝ E^(-Γ) · exp(-E/E_cut), convertir a F_ν: F_ν ∝ ν·dN/dν ∝ E·E^(-Γ)·e^(-E/E_cut)
  const fν = norm * Math.pow(E_keV, 1 - Gamma) * Math.exp(-E_keV / E_cut_keV);
  // Distribución radial Gaussiana centrada en 10 r_g
  const radial = Math.exp(-Math.pow((r_in_rg - 10)/(8), 2));
  return fν * radial;
}

// 3. REFLECTION + Fe-Kα: Compton hump 20-30 keV + 6.4 keV line
function reflection_emissivity(nu_Hz, r_in_rg) {
  if (r_in_rg < r_ISCO || r_in_rg > 30) return 0;
  const E_keV = h * nu_Hz / eV / 1000;
  // Compton hump
  const hump = 0.3 * Math.exp(-Math.pow((E_keV - 25)/(15), 2));
  // Fe Kα (broadened by GR + Doppler convolution — usamos un Gaussian ancho)
  const fe = 1.5 * Math.exp(-Math.pow((E_keV - 6.4)/(0.7), 2));
  const total = (hump + fe) * 0.3 * corona_emissivity(nu_Hz, r_in_rg) /
                Math.max(1e-30, corona_emissivity(nu_Hz, 10));
  return total;
}

// 4. TORUS de polvo: multi-T BB, T_sub a r_sub, decae r^(-0.5)
function torus_T(r_in_rg) {
  const L_UV_45 = L_bol / 1e45;
  // Barvainis 1987: r_sub ≈ 0.4 pc · (L/10⁴⁵)^(1/2)
  const r_sub_pc = 0.4 * Math.sqrt(L_UV_45);
  const r_sub_rg = r_sub_pc * pc / r_g;
  if (r_in_rg < r_sub_rg) return 0;
  // T ∝ r^(-0.5) (gray dust)
  return 1500 * Math.pow(r_sub_rg / r_in_rg, 0.5);
}

function torus_emissivity(nu_Hz, r_in_rg) {
  const T = torus_T(r_in_rg);
  if (T <= 0 || T < 30) return 0;       // floor a 30 K
  return Math.PI * planck_Bnu(nu_Hz, T) * 2 * Math.PI * (r_in_rg * r_g) * 0.4;
}

// 5. BLR líneas: spikes en frecuencias específicas
function blr_emissivity(nu_Hz, r_in_rg) {
  // BLR a R-L: r_BLR ≈ 17 lt-days · sqrt(L_5100/1e44)
  // Para L=1e46: r_BLR ≈ 17·10 = 170 lt-days = 170·c·86400 s
  const L_5100_44 = L_bol / 5 / 1e44;       // crude
  const r_BLR_cm = 170 * 86400 * c * Math.sqrt(L_5100_44);
  const r_BLR_rg = r_BLR_cm / r_g;
  const sigma_r = 0.3 * r_BLR_rg;           // grosor logarítmico
  const radial = Math.exp(-Math.pow(Math.log10(r_in_rg / r_BLR_rg), 2) / 0.5);

  // Líneas (rest-frame, no incluimos broadening para mostrar peaks discretos)
  const lines = [
    { lambda_A: 1216, name: 'Lyα',  amp: 1.2 },
    { lambda_A: 1549, name: 'CIV',  amp: 0.7 },
    { lambda_A: 1909, name: 'CIII]',amp: 0.3 },
    { lambda_A: 2798, name: 'MgII', amp: 0.5 },
    { lambda_A: 4861, name: 'Hβ',   amp: 0.4 },
    { lambda_A: 6563, name: 'Hα',   amp: 1.0 },
    { lambda_A: 5007, name: '[OIII]', amp: 0.6 },  // técnicamente NLR
  ];
  let lineSum = 0;
  for (const l of lines) {
    const nu0 = c / (l.lambda_A * 1e-8);    // Hz
    const dlog = Math.log10(nu_Hz / nu0);
    // FWHM en log: ~5000 km/s → dlog ≈ 5000/c·log10(e) ≈ 0.0072
    const broaden = 0.008;
    lineSum += l.amp * Math.exp(-Math.pow(dlog/broaden, 2));
  }
  return lineSum * radial * L_bol * 1e-4 / (4 * Math.PI * r_BLR_cm**2);
}

// 6. JET synchrotron: self-absorbed below ν_SSA, power-law above
function jet_emissivity(nu_Hz, r_in_rg) {
  // Jet extiende r > 100 r_g, máximo a ~10⁵ r_g
  if (r_in_rg < 50) return 0;
  if (r_in_rg > 1e7) return 0;

  const alpha = 0.7;                        // spectral index
  // Self-absorption frequency varía con r: ν_SSA ∝ B^(α+5/2)/r^(α+1)
  // crudely: ν_SSA(r) = 10¹¹ · (r/10⁴)^(-0.3) Hz
  const nu_SSA = 1e11 * Math.pow(r_in_rg / 1e4, -0.3);

  let fν;
  if (nu_Hz < nu_SSA) {
    // Rising: F_ν ∝ ν^(5/2)
    fν = Math.pow(nu_Hz / nu_SSA, 5/2);
  } else {
    fν = Math.pow(nu_Hz / nu_SSA, -alpha);
  }
  // Decay con r — surface brightness cae
  const radial = Math.pow(r_in_rg / 100, -0.6);

  return fν * radial * 1e-2;
}

// 7. JET IC (SSC + EC) — peak en gamma, 10⁷ × frecuencia synchrotron peak
function jetIC_emissivity(nu_Hz, r_in_rg) {
  if (r_in_rg < 50) return 0;
  if (r_in_rg > 1e6) return 0;
  // Peak IC en ν_IC ≈ 4·γ²·ν_sync_peak. Para γ=10, ν_sync~1e13 (IR jet),
  // ν_IC ~ 10²·1e13 = 10¹⁵ — no es lo que queremos. Para BL Lac TeV:
  // γ ~ 10⁴ → ν_IC ~ 10²¹ Hz (gamma)
  const nu_IC_peak = 1e22;
  const alpha_IC = 0.6;
  let fν;
  // Distribución log-parabólica simple alrededor del peak
  const dlog = Math.log10(nu_Hz / nu_IC_peak);
  fν = Math.exp(-Math.pow(dlog/1.0, 2)) * 0.6;
  // Below peak: power-law rising
  if (nu_Hz < nu_IC_peak) {
    fν *= Math.pow(nu_Hz / nu_IC_peak, 0.5);
  } else {
    fν *= Math.pow(nu_Hz / nu_IC_peak, -alpha_IC);
  }
  const radial = Math.exp(-Math.pow(Math.log10(r_in_rg / 1000), 2) / 2);
  return fν * radial * 5e-3;
}

// ── Componentes ────────────────────────────────────────────────────────
const COMPONENTS = [
  { name: 'disk      ', fn: disk_emissivity },
  { name: 'corona    ', fn: corona_emissivity },
  { name: 'reflection', fn: reflection_emissivity },
  { name: 'torus     ', fn: torus_emissivity },
  { name: 'blr       ', fn: blr_emissivity },
  { name: 'jet_sync  ', fn: jet_emissivity },
  { name: 'jet_ic    ', fn: jetIC_emissivity },
];
const N_C = COMPONENTS.length;

// ── Build tensor ──────────────────────────────────────────────────────
console.log(`\nbuilding 3-tensor j[component, log_ν, log_r] = ${N_C} × ${N_NU} × ${N_R}…`);
const tensor = new Float32Array(N_C * N_NU * N_R);
let maxJ = 0;
for (let ic = 0; ic < N_C; ic++) {
  for (let iν = 0; iν < N_NU; iν++) {
    const log_ν = LOG_NU_MIN + iν * dlog_nu;
    const nu = Math.pow(10, log_ν);
    for (let ir = 0; ir < N_R; ir++) {
      const log_r = LOG_R_MIN + ir * dlog_r;
      const r = Math.pow(10, log_r);
      const j = COMPONENTS[ic].fn(nu, r);
      tensor[ic * N_NU * N_R + iν * N_R + ir] = isFinite(j) ? j : 0;
      if (isFinite(j) && j > maxJ) maxJ = j;
    }
  }
  // Stats per component
  let sum = 0, peak_ν = LOG_NU_MIN, peak_r = LOG_R_MIN, peakV = -Infinity;
  for (let iν = 0; iν < N_NU; iν++) {
    for (let ir = 0; ir < N_R; ir++) {
      const v = tensor[ic * N_NU * N_R + iν * N_R + ir];
      sum += v;
      if (v > peakV) { peakV = v; peak_ν = LOG_NU_MIN + iν*dlog_nu; peak_r = LOG_R_MIN + ir*dlog_r; }
    }
  }
  console.log(`  ${COMPONENTS[ic].name}  Σ=${sum.toExponential(2)}  peak@(log_ν=${peak_ν.toFixed(1)}, log_r=${peak_r.toFixed(1)})`);
}
console.log(`  max j = ${maxJ.toExponential(2)}`);

// ── Normaliza por máximo global ───────────────────────────────────────
for (let i = 0; i < tensor.length; i++) tensor[i] /= maxJ;

// ── Escribe binario ───────────────────────────────────────────────────
const headerBytes  = 16;                              // 4 u32
const axisBytes    = 4 * 4;                           // 4 f32 (log mins/maxes)
const namesBytes   = N_C * 16;                        // 16 bytes per name
const dataBytes    = N_C * N_NU * N_R * 4;            // tensor Float32
const total        = headerBytes + axisBytes + namesBytes + dataBytes;
const buf          = Buffer.alloc(total);

let off = 0;
buf.writeUInt32LE(N_NU, off); off += 4;
buf.writeUInt32LE(N_R,  off); off += 4;
buf.writeUInt32LE(N_C,  off); off += 4;
buf.writeUInt32LE(0,    off); off += 4;   // pad
buf.writeFloatLE(LOG_NU_MIN, off); off += 4;
buf.writeFloatLE(LOG_NU_MAX, off); off += 4;
buf.writeFloatLE(LOG_R_MIN,  off); off += 4;
buf.writeFloatLE(LOG_R_MAX,  off); off += 4;
for (const c of COMPONENTS) {
  const nameBuf = Buffer.alloc(16);
  nameBuf.write(c.name.trim(), 'ascii');
  nameBuf.copy(buf, off);
  off += 16;
}
for (let i = 0; i < tensor.length; i++) {
  buf.writeFloatLE(tensor[i], off);
  off += 4;
}

const outDir = path.resolve(__dirname, '..', '..', 'public', 'precomputed');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'quasar-sed.bin');
fs.writeFileSync(outFile, buf);

console.log(`\nwrote ${outFile} — ${(total/1024).toFixed(1)} KB`);
console.log(`  layout: header(16) + axis(16) + names(${N_C*16}) + tensor(${dataBytes})`);
console.log(`  log_ν ∈ [${LOG_NU_MIN}, ${LOG_NU_MAX}], log_r ∈ [${LOG_R_MIN}, ${LOG_R_MAX}]`);
console.log(`\nOperador 𝔄 aplicado:`);
console.log(`  • cara-Mellin radial:    r → log r → grid lineal en cara`);
console.log(`  • cara-Mellin espectral: ν → log ν → grid lineal en cara`);
console.log(`  • Producto separable: j(c, log_ν, log_r) — 3-tensor cacheable`);
console.log(`  • Runtime: 1 lookup 3D + Doppler shift (trans. en log_ν)`);
console.log(`  • Para slice por banda: fijar log_ν → vector j(c, r) en O(N_C·N_R)`);
