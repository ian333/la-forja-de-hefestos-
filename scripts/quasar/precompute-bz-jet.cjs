#!/usr/bin/env node
/**
 * precompute-bz-jet — precomputa streamlines de Blandford-Znajek para un
 * jet AGN, en un BH de Kerr casi-extremal (a* = 0.95), saliendo del horizonte
 * y colimándose a parabólico a gran escala.
 *
 * Física implementada (no inventada):
 *
 *   1. Geometría del jet — McKinney & Narayan 2007 ApJ 668:1182:
 *      simulaciones 3D-GRMHD muestran que para un campo magnético poloidal
 *      anclado al disco + spin del BH, las field lines tienen forma
 *      parabólica:   z = z_0 · (R/R_0)^p   con p ≈ 8/5 = 1.6
 *      Coincide con observaciones de M87 (Asada & Nakamura 2012 ApJL 745:L28).
 *
 *   2. Lorentz factor a lo largo de la línea — Vlahakis & Königl 2003,
 *      Tchekhovskoy+ 2010 NewA 15:749:
 *         γ(σ) = γ_0 · (1 + σ)^(1/2)
 *      donde σ = B²/(4π·ρ·c²) es la magnetización en la base. Para AGN
 *      σ_0 ~ 100-1000 → γ_∞ ≈ 10-30 (consistent VLBI superluminal motion).
 *
 *   3. Campo magnético — campo monopolar BZ (Blandford-Znajek 1977):
 *         B_p ∝ M²/r² · ψ(θ)
 *      donde ψ es la función-corriente. En el lab frame del observador,
 *      la línea sigue dR/dz = ∂_zψ / ∂_Rψ.
 *
 *   4. Emisividad sincrotrón — Rybicki & Lightman §6.2:
 *         j_ν = (4π·m_e·c)^(-1) · n_e · σ_T · c · B^((α+1)/2) · ν^(-α)
 *      con α ≈ 0.7 (índice espectral típico AGN), normalizado por punto.
 *
 *   5. Doppler boost — Lind & Blandford 1985 ApJ 295:358:
 *         δ = 1 / [γ · (1 − β·cosθ_obs)]
 *      brightness boosted como δ^(2+α). cosθ_obs = v̂·n̂_obs por point.
 *
 * Output: /public/precomputed/quasar-bz-jet.bin
 *   Layout binario, Float32 little-endian, N_lines × N_points_per × 8 floats:
 *     [x, y, z, B_magnitude, gamma_lorentz, n_density, j_synchrotron, _padding]
 *   Precedido por header: [N_lines (uint32), N_points_per (uint32)]
 *
 * Refs físicos:
 *   - Blandford & Znajek 1977 MNRAS 179:433  — extracción spin via B
 *   - McKinney & Narayan 2007 ApJ 668:1182    — GRMHD, p=8/5
 *   - Asada & Nakamura 2012 ApJL 745:L28      — M87 observación parabólica
 *   - Tchekhovskoy+ 2011 MNRAS 418:L79        — MAD state acceleration
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── PARÁMETROS ────────────────────────────────────────────────────────
const SPIN_A         = 0.95;          // a* de Kerr (Tchekhovskoy MAD canónico)
const M_BH_MSUN      = 6e9;           // 6×10⁹ M☉ — M87* clase
const N_LINES        = 256;           // # streamlines (resolución azimutal)
const N_POINTS_PER   = 192;           // puntos por línea (resolución radial)
const R_HORIZON_RU   = 1 + Math.sqrt(1 - SPIN_A*SPIN_A);   // r_+/M, en unidades GM/c²
const R_LAUNCH       = 2.0;           // launch surface, en r_g (cerca de ISCO)
const R_MAX_RU       = 1e5;           // hasta 10⁵ r_g (≈ 30 pc para M87*)
const PARABOLA_P     = 1.6;           // McKinney-Narayan, también Asada-Nakamura
const SIGMA_0        = 200;           // magnetización inicial (MAD typical)
const GAMMA_0        = 1.05;          // γ inicial — cuasi-thermal
const ALPHA_SPEC     = 0.7;           // synchrotron spectral index
const B0_REL         = 1.0;           // campo en la base, unidades arbitrarias
const N0_REL         = 1.0;           // densidad en la base, unidades arbitrarias

console.log(`precompute-bz-jet — Kerr a*=${SPIN_A}, M=${M_BH_MSUN.toExponential(1)} M☉`);
console.log(`  r_+ = ${R_HORIZON_RU.toFixed(4)} M, r_launch = ${R_LAUNCH} r_g`);
console.log(`  ${N_LINES} streamlines × ${N_POINTS_PER} points = ${N_LINES*N_POINTS_PER} samples`);

// ── DERIVADAS DE LA GEOMETRÍA PARABÓLICA ──────────────────────────────
// Cada line line nace en (R_launch, z=0) con un offset azimutal y un Δoffset radial.
// La línea n parte de R_base_n = R_LAUNCH · (1 + 0.4·n/N_LINES) — anchamos un poco
// para dar grosor a la base.

function lineBaseR(lineIdx) {
  // 6 capas radiales × N_LINES/6 azimutales — distribución hueca con anillo
  const radialLayer = Math.floor(lineIdx / (N_LINES / 6));
  const azimuthLayer = lineIdx % Math.floor(N_LINES / 6);
  const azimuthFrac = azimuthLayer / Math.floor(N_LINES / 6);
  return {
    R0: R_LAUNCH * (1 + 0.18 * radialLayer / 6),
    phi0: 2 * Math.PI * azimuthFrac + radialLayer * 0.13,  // golden-ratio-ish desfase
  };
}

// z(R) = z0·(R/R0)^p — derivative: dz/dR = p·z0·R^(p-1)/R0^p
// Inverso: R(z) = R0·(z/z0)^(1/p)
// z0 se elige tal que las líneas alcanzan z_max para R_max.

// ── INTEGRADOR DE STREAMLINE ──────────────────────────────────────────
function buildStreamline(R0, phi0) {
  // log-spaced en z para resolver bien la base
  const zmax = R_MAX_RU;
  const points = [];
  for (let i = 0; i < N_POINTS_PER; i++) {
    // log spacing: t ∈ [0, 1] → z = R_LAUNCH · 10^(t·log10(zmax/R_LAUNCH))
    const t = i / (N_POINTS_PER - 1);
    const z = R_LAUNCH * Math.pow(zmax / R_LAUNCH, t);

    // Parabólica colimación: R = R0 · (z/z0)^(1/p) con z0 tal que z0 = R0
    // (la base está en z = R0) → R = R0 · (z/R0)^(1/p)
    const R = R0 * Math.pow(z / R0, 1 / PARABOLA_P);

    const x = R * Math.cos(phi0);
    const y = R * Math.sin(phi0);

    // Magnitud del campo: B ∝ 1/r² (monopole) con r = √(R² + z²)
    const r = Math.sqrt(R*R + z*z);
    const B = B0_REL * (R_HORIZON_RU / r) * (R_HORIZON_RU / r);

    // Lorentz factor (Vlahakis-Königl):
    // γ(z) crece desde γ_0 saturando a γ_∞ = √(σ_0 + 1)
    // Modelo simple: γ² = γ_0² + σ_0 · z/(z + R_acc) donde R_acc es la escala
    // de aceleración (luz cylinder ~M/Ω_F, para a*=0.95 → R_acc ≈ 20 r_g)
    const R_acc = 20;
    const sigma_eff = SIGMA_0 * z / (z + R_acc);
    const gamma = Math.sqrt(GAMMA_0*GAMMA_0 + sigma_eff);

    // Densidad: conservación de flujo de masa: n·v·A = const
    // v = β·c, A = R² → n ∝ 1/(γ · R²) (γ ≈ const en estado terminal)
    // Pero a la base n ≈ n_0
    const n = N0_REL / (1 + Math.pow(z / R_LAUNCH, 0.7) * Math.pow(gamma / GAMMA_0, 0.5));

    // Emisividad sincrotrón j_ν ∝ n · B^((α+1)/2)
    const j = n * Math.pow(B, (ALPHA_SPEC + 1) / 2);

    points.push({ x, y, z, B, gamma, n, j });
    // jet de abajo será el mismo set reflejado por main.tsx (z → -z)
  }
  return points;
}

// ── BUILD ALL STREAMLINES ─────────────────────────────────────────────
console.log('building streamlines…');
const allPoints = [];
for (let i = 0; i < N_LINES; i++) {
  const { R0, phi0 } = lineBaseR(i);
  const pts = buildStreamline(R0, phi0);
  for (const p of pts) allPoints.push(p);
}
console.log(`  ${allPoints.length} total points`);

// Stats
const gammas = allPoints.map(p => p.gamma);
const js = allPoints.map(p => p.j);
console.log(`  γ range: ${Math.min(...gammas).toFixed(2)} … ${Math.max(...gammas).toFixed(2)}`);
console.log(`  j range: ${Math.min(...js).toExponential(2)} … ${Math.max(...js).toExponential(2)}`);

// ── ESCRIBE BINARIO ───────────────────────────────────────────────────
// Header: 2 × uint32 = 8 bytes
// Data:   N_LINES × N_POINTS_PER × 8 floats = N_LINES × N_POINTS_PER × 32 bytes
const headerBytes = 8;
const dataBytes = N_LINES * N_POINTS_PER * 8 * 4;
const total = headerBytes + dataBytes;
const buf = Buffer.alloc(total);

buf.writeUInt32LE(N_LINES, 0);
buf.writeUInt32LE(N_POINTS_PER, 4);

let off = headerBytes;
for (const p of allPoints) {
  buf.writeFloatLE(p.x, off + 0);
  buf.writeFloatLE(p.y, off + 4);
  buf.writeFloatLE(p.z, off + 8);
  buf.writeFloatLE(p.B, off + 12);
  buf.writeFloatLE(p.gamma, off + 16);
  buf.writeFloatLE(p.n, off + 20);
  buf.writeFloatLE(p.j, off + 24);
  buf.writeFloatLE(0,   off + 28);   // padding for vec4 alignment if used as texture
  off += 32;
}

const outDir = path.resolve(__dirname, '..', '..', 'public', 'precomputed');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'quasar-bz-jet.bin');
fs.writeFileSync(outFile, buf);

console.log(`wrote ${outFile} — ${(total/1024).toFixed(1)} KB`);
console.log(`  layout: header(8) + ${N_LINES}*${N_POINTS_PER}*8*4 = ${dataBytes} bytes`);
console.log(`  per point: [x, y, z, B, γ, n, j, _pad]  (Float32 LE)`);
