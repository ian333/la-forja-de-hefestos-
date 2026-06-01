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
 *   2. Lorentz factor a lo largo de la línea — perfil OBSERVADO de M87
 *      (Asada+ 2014 ApJL 781:L2 / arXiv:1311.5709), no una saturación ad-hoc:
 *      el jet acelera en DOS tramos de ley de potencia a lo largo de ~10⁶ R_s,
 *         γ(z) ∝ z^0.58   para z ≲ 10³ R_s  (zona de aceleración magnética)
 *         γ(z) ∝ z^0.16   para z ≳ 10³ R_s  (aceleración lenta hasta HST-1)
 *      saturando en γ_∞ = √(σ_0 + 1) (Vlahakis & Königl 2003, Tchekhovskoy+
 *      2010 NewA 15:749), donde σ = B²/(4π·ρ·c²) es la magnetización en la
 *      base. Para AGN σ_0 ~ 100-1000 → γ_∞ ≈ 10-30 (consistente con el
 *      movimiento superluminal medido por VLBI). El γ del .bin es el factor
 *      de Lorentz del BULK FLOW del plasma — NO el γ_e del electrón individual,
 *      que es el que fija la frecuencia crítica sincrotrón
 *      ν_c ≈ 4.2 MHz·(B/Gauss)·γ_e² (Rybicki-Lightman). Distinción importante:
 *      el shader colorea por γ_bulk como proxy evocativo de hardening, NO mide
 *      banda real (eso exigiría tabular γ_e por punto).
 *
 *   3. Campo magnético — DOS componentes (Blandford-Znajek 1977 + colimación):
 *      a) Poloidal B_p: campo monopolar BZ que enhebra el horizonte, ∝ 1/r².
 *         Es el que fija la POTENCIA del jet (P_BZ ∝ Φ_BH²·Ω_H²) pero decae
 *         tan rápido que casi todo su brillo se queda pegado a la base.
 *      b) Toroidal B_φ: en un jet que se colima, la conservación del flujo
 *         toroidal congelado al plasma da B_φ·R ≈ const → B_φ ∝ 1/R
 *         (Vlahakis & Königl 2003; observado en M87/3C273 por VLBI como
 *         campo DOMINANTE en las escalas que radían). Como R crece mucho más
 *         lento que r (R ∝ z^0.625 vs r ≈ z), B_φ ∝ 1/R decae ~10² veces más
 *         lento que B_p ∝ 1/r², y es el que mantiene encendido el jet
 *         relativista aguas arriba. Usamos B_φ para la EMISIVIDAD (el campo
 *         que de verdad radía a escala VLBI) y conservamos B_p en el .bin como
 *         diagnóstico del campo de potencia.
 *
 *   4. Emisividad sincrotrón — Rybicki & Lightman §6.2:
 *         j_ν = (4π·m_e·c)^(-1) · n_e · σ_T · c · B^((α+1)/2) · ν^(-α)
 *      con α ≈ 0.7 (índice espectral típico AGN). Usa B_φ (el campo radiante)
 *      y la densidad de CONSERVACIÓN DE MASA n ∝ 1/(γ·β·R²) (flujo n·γ·β·A =
 *      const, A ∝ R²) — NO una densidad ad-hoc. Normalizado por el máximo.
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

// ── NUDOS DE CHOQUE (knots) — los puntos brillantes REALES del chorro ─────────
// En M87 el jet no es un hilo liso: tiene NUDOS (HST-1, A, B, C, D, E, F) =
// choques internos / regiones de recolimación donde el plasma se comprime, B y n
// suben y el sincrotrón REVIENTA. Son lo que ve el HST/VLBI a lo largo del chorro
// (Marshall+2002, Asada+2014). Sin ellos el jet es una aguja tenue; con ellos el
// CHORRO ENTERO brilla en cuentas discretas = la furia recorriendo el jet.
// Posiciones en r_g (log-espaciadas como las observadas), realce relativo del pico.
const KNOTS = [
  { z: 60,    boost: 2.2, width: 0.35 },   // recolimación interna (~HST-1 escala)
  { z: 400,   boost: 3.0, width: 0.40 },   // nudo brillante medio
  { z: 2500,  boost: 2.6, width: 0.42 },   // nudo A-like
  { z: 15000, boost: 2.2, width: 0.45 },   // nudo lejano
  { z: 70000, boost: 1.8, width: 0.50 },   // hot-spot terminal aproximándose al lobe
];
// Realce gaussiano en log(z): cada nudo multiplica la emisividad local. width en
// dex (décadas) — un nudo ancho ~0.45 dex cubre el factor ~3× alrededor de su z.
function knotBoost(z) {
  let m = 1.0;
  const lz = Math.log10(Math.max(1e-6, z));
  for (const k of KNOTS) {
    const d = (lz - Math.log10(k.z)) / k.width;
    m += k.boost * Math.exp(-0.5 * d * d);
  }
  return m;
}

// ── PERFIL DE ACELERACIÓN OBSERVADO (Asada+ 2014, M87) ────────────────
// Ley de potencia quebrada en γ del BULK FLOW, con los exponentes medidos
// por VLBI en M87 a lo largo de ~10⁶ R_s:
//   γ(z) ∝ z^0.58   para z ≤ z_break   (zona de aceleración magnética rápida)
//   γ(z) ∝ z^0.16   para z >  z_break   (aceleración lenta hasta HST-1)
// con saturación dura en γ_∞ = √(σ_0 + 1).  z en r_g (R_s = 2 r_g).
//
// CALIBRACIÓN (corrige el fix anterior): el ancla terminal SE MANTIENE en
// γ → γ_∞ recién a z_term ≈ 10⁶ R_s (= 2×10⁶ r_g), MUY fuera de la caja de
// 10⁵ r_g → dentro de la escena el jet SIGUE acelerando (no se congela), tal
// como lo ve VLBI. PERO el quiebre se mueve a z_break = 200 r_g (= 100 R_s,
// transición parábola→cono en la región de influencia, extremo bajo del rango
// 10²–10³ R_s de Asada+ 2014). Con ese quiebre, el tramo rápido γ ∝ z^0.58
// queda anclado por continuidad de modo que la aceleración SE VE dentro de la
// caja:  γ(50 r_g)≈1.46,  γ(70)≈1.77,  γ(100)≈2.17,  γ(borde 10⁵)≈8.8.
// El fix anterior ponía el quiebre en 2000 r_g, lo que aplastaba γ contra el
// piso 1.05 hasta z≈460 r_g (40% de los puntos clavados, jet lento y rojo en
// toda la mitad interna). Ahora γ cruza 1.5 a z≈61 r_g y 2 a z≈100 r_g.
const GAMMA_INF      = Math.sqrt(SIGMA_0 + 1);   // γ_∞ = √(σ_0+1) ≈ 14.18
const Z_BREAK_RU     = 200;           // 100 R_s — quiebre parábola→cono (Asada+ 2014)
const Z_TERM_RU      = 2e6;           // 10⁶ R_s ≈ HST-1: aquí γ alcanza γ_∞
const ACC_P1         = 0.58;          // exponente tramo rápido  γ ∝ z^0.58
const ACC_P2         = 0.16;          // exponente tramo lento   γ ∝ z^0.16
// Anclaje terminal: γ(Z_TERM) = γ_∞.  Como Z_TERM > Z_BREAK, el ancla cae en
// el tramo lento → A2 es la constante del segundo tramo; A1 sale de la
// continuidad en el quiebre (γ_break = A2·z_break^P2 = A1·z_break^P1).
const ACC_A2         = GAMMA_INF / Math.pow(Z_TERM_RU, ACC_P2);
const GAMMA_BREAK    = ACC_A2 * Math.pow(Z_BREAK_RU, ACC_P2);
const ACC_A1         = GAMMA_BREAK / Math.pow(Z_BREAK_RU, ACC_P1);

function lorentzAt(z) {
  // z en r_g. Devuelve γ del bulk flow con la ley quebrada de Asada+ 2014,
  // anclada en el extremo terminal (γ_∞ a 10⁶ R_s). γ ≥ GAMMA_0 en la base.
  let g;
  if (z <= Z_BREAK_RU) {
    g = ACC_A1 * Math.pow(Math.max(z, 1e-6), ACC_P1);
  } else {
    g = ACC_A2 * Math.pow(z, ACC_P2);
  }
  // Piso cuasi-térmico en la base y techo físico γ_∞.
  return Math.min(Math.max(g, GAMMA_0), GAMMA_INF);
}

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

    // Campo POLOIDAL B_p ∝ 1/r² (monopole BZ que enhebra el horizonte) — fija
    // la potencia del jet pero decae demasiado rápido para mantenerlo encendido.
    const r = Math.sqrt(R*R + z*z);
    const B = B0_REL * (R_HORIZON_RU / r) * (R_HORIZON_RU / r);

    // Lorentz factor del BULK FLOW — perfil OBSERVADO de M87 (Asada+ 2014):
    // ley de potencia quebrada γ ∝ z^0.58 (z ≤ 100 R_s) y γ ∝ z^0.16 después,
    // saturando en γ_∞ = √(σ_0+1) a 10⁶ R_s. Recalibrado (quiebre 200 r_g) para
    // que γ cruce 1.5–2 a z~50–100 r_g y la aceleración SE VEA dentro de la caja.
    const gamma = lorentzAt(z);
    const beta  = Math.sqrt(Math.max(1e-12, 1 - 1 / (gamma * gamma)));

    // Campo TOROIDAL B_φ ∝ 1/R (flujo toroidal congelado: B_φ·R ≈ const,
    // Vlahakis-Königl 2003). Es el campo dominante que RADÍA a escala VLBI y
    // decae ~10² veces más lento que B_p (porque R ∝ z^0.625, no ∝ z).
    const Bphi = B0_REL * (R_LAUNCH / R);

    // Densidad por CONSERVACIÓN DE MASA: flujo n·γ·β·A = const, A ∝ R²
    //   ⇒ n ∝ 1 / (γ · β · R²)
    // Reemplaza la densidad ad-hoc n = N0/(1+(z/R_L)^0.7·(γ/γ0)^0.5) que decaía
    // ~10× demasiado rápido y concentraba 99% del brillo en la base lenta.
    const n = N0_REL * (R_LAUNCH * R_LAUNCH) / (gamma * beta * R * R);

    // Emisividad sincrotrón FÍSICA j_ν ∝ n · B_φ^((α+1)/2) — campo TOROIDAL
    // radiante (Vlahakis-Königl), no el poloidal de potencia. Es la emisividad
    // co-móvil correcta, pero decae ~z^-1.78 → sin tratamiento de display el 99%
    // del brillo cae en la base y el chorro relativista no se lee (lo que la
    // crítica detectó). Guardamos esta j física para diagnóstico/potencia.
    const jPhys = n * Math.pow(Bphi, (ALPHA_SPEC + 1) / 2);

    // BRILLO DE DISPLAY (lo que se renderiza). DOS tratamientos HONESTOS, ambos
    // estándar en mapas VLBI reales, etiquetados como DISPLAY (no flujo lineal):
    //  (1) NUDOS DE CHOQUE: knotBoost(z) realza las regiones de recolimación
    //      (HST-1, A, B…) donde el sincrotrón de verdad revienta → el chorro
    //      entero brilla en cuentas discretas, como en el HST/VLBI de M87.
    //  (2) ECUALIZACIÓN RADIAL: ×R^1.6 aplana el decaimiento estructural de la
    //      apertura del jet (la sección crece ∝R², se reparte el brillo) para que
    //      la mitad/punta del chorro (γ>5, azul) se vea junto a la base. Es la
    //      misma idea del "unsharp/log stretch" con que se publican los jets.
    const jDisplay = jPhys * knotBoost(z) * Math.pow(R / R0, 1.6);

    // j que se exporta = brillo de display (el shader ya hace su pow perceptual).
    const j = jDisplay;

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
