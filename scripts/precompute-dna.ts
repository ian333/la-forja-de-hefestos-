/**
 * precompute-dna.ts — Doble hélice B-form REAL → .bin renderizable.
 *
 * Usa el motor existente src/lib/bio/dna.ts (buildDuplex: parámetros Arnott-Hukins
 * 1972 reales — rise 3.4 Å, twist 34.29°, surcos por el offset 155°). No inventa
 * geometría: es B-form de libro. Genera densidad electrónica honesta:
 *   · backbone σ: tubo helicoidal fosfato→fosfato (los dos esqueletos antiparalelos)
 *   · bases: parche aromático con π APILADO a lo largo del eje (el π-stacking que
 *     de verdad sostiene el ADN — el mismo motor π del β-caroteno, ahora en escalera)
 *   · puentes de hidrógeno: 2 (A–T) / 3 (G–C) líneas brillantes al centro
 *   · color por base (dna.ts BASE_COLOR): A verde, T rojo, G ámbar, C cian
 *
 * La hélice es alargada → la cámara TRAVERSAL de CinematicMolecule vuela por el eje.
 * Salida: public/precomputed/dna-<key>.bin (mismo formato que parseBin).
 *
 * Uso: tsx --tsconfig tsconfig.lesson.json scripts/precompute-dna.ts brca1 220000
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildDuplex, BASE_COLOR, hbondsFor, isPurine, B_DNA,
  BRCA1_FRAGMENT, HUMAN_TELOMERE_REPEAT, TATA_CONTEXT, type Base } from '../src/lib/bio/dna';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(R: () => number) { const u = Math.max(1e-9, R()), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function hex(h: string): V3 { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

// brillo HDR para el bloom (picos blanco-caliente)
function colHot(base: V3, density: number, boost = 1): V3 {
  const hot = Math.min(1, density * density * 0.55);
  const r = base[0] * (1 - hot) + 1.0 * hot, g = base[1] * (1 - hot) + 0.96 * hot, b = base[2] * (1 - hot) + 0.86 * hot;
  const bright = (0.18 + 0.45 * density) * boost;
  return [r * bright, g * bright, b * bright];
}
const TEAL: V3 = [0.26, 0.78, 0.92];   // backbone fosfato

const SEQS: Record<string, string> = {
  brca1: BRCA1_FRAGMENT,                         // gen supresor tumoral humano REAL
  telomero: HUMAN_TELOMERE_REPEAT.repeat(6),     // TTAGGG × 6 (extremo de tus cromosomas)
  tata: TATA_CONTEXT.repeat(2),                  // caja TATA (promotor)
};

const key = (process.argv[2] || 'brca1').toLowerCase();
const N = parseInt(process.argv[3] || '600000', 10);   // MÁS denso: nunca se ve vacío
const seq = (SEQS[key] || BRCA1_FRAGMENT).slice(0, 36);   // ~36 bp = 3.4 vueltas → hélice ALTA (gigante)
const duplex = buildDuplex(seq);
const { atoms, frames } = duplex;

// ── centrar en el eje y a media altura; trabajamos en Å, escalamos al final ──
const zMid = (frames.length - 1) * B_DNA.rise / 2;
const center: V3 = [0, 0, zMid];
const R = rng(424242);
const out: { p: V3; c: V3; s: number; g: number }[] = [];
const emit = (pAng: V3, c: V3, s: number, g: number) => out.push({ p: sub(pAng, center), c, s, g });

// presupuesto: backbone, bases (π apilado), puentes H
const nBack = Math.round(N * 0.34), nBase = Math.round(N * 0.54), nHb = N - nBack - nBase;

// ── BACKBONE σ: tubo entre fosfatos consecutivos de cada hebra + brazo al azúcar ──
const byStrand = (st: 1 | 2) => atoms.filter(a => a.strand === st).sort((a, b) => a.i - b.i);
const s1 = byStrand(1), s2 = byStrand(2);
function backboneStrand(list: typeof s1, count: number) {
  for (let k = 0; k < count; k++) {
    const j = Math.floor(R() * (list.length - 1));
    const a = list[j], b = list[j + 1];
    const seg = R();
    if (seg < 0.7) {                                  // P(i) → P(i+1): el esqueleto helicoidal
      const t = R(); const base = add(a.p, mul(sub(b.p, a.p), t));
      const u = norm(sub(b.p, a.p)); let t1: V3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const e1 = norm(cross(u, t1)), e2 = norm(cross(u, e1));
      const rad = Math.abs(gauss(R)) * 0.7, ph = R() * 6.283;
      const p = add(base, add(mul(e1, Math.cos(ph) * rad), mul(e2, Math.sin(ph) * rad)));
      emit(p, colHot(TEAL, 0.42), 0.22 + 0.12 * (1 - rad), 1);
    } else {                                          // brazo P → C1' (azúcar) del nucleótido
      const t = R(); const p = add(a.p, mul(sub(a.c1, a.p), t));
      emit(p, colHot(TEAL, 0.38), 0.20, 1);
    }
  }
}
backboneStrand(s1, Math.round(nBack / 2));
backboneStrand(s2, nBack - Math.round(nBack / 2));

// ── BASES: parche aromático con π APILADO a lo largo del eje (el π-stacking) ──
// Cada base ocupa de baseEdge (r≈3.5) hacia el eje; el plano de la base es ~⊥ al
// eje z, así que el π se apila en ±z (cara a cara con las bases vecinas).
for (let k = 0; k < nBase; k++) {
  const a = (R() < 0.5 ? s1 : s2)[Math.floor(R() * s1.length)];
  if (!a) continue;
  const theta = Math.atan2(a.baseEdge[1], a.baseEdge[0]);
  const rIn = 1.0 + R() * (B_DNA.rBaseEdge - 1.0);     // de ~1 (centro) a 3.5 (borde)
  const dth = gauss(R) * 0.42;                          // ancho angular de la base
  const inPlane: V3 = [rIn * Math.cos(theta + dth), rIn * Math.sin(theta + dth), a.baseEdge[2]];
  const zoff = gauss(R) * 0.95;                         // π apilado: densidad ±z (cara a cara)
  const p: V3 = [inPlane[0], inPlane[1], inPlane[2] + zoff];
  const dens = Math.exp(-(zoff * zoff) / 1.1) * (0.5 + 0.5 * (rIn / B_DNA.rBaseEdge));
  const purineBoost = isPurine(a.base) ? 1.0 : 0.92;
  emit(p, colHot(hex(BASE_COLOR[a.base as Base]), 0.45 + 0.5 * dens, purineBoost), 0.16 + 0.12 * dens, 2);
}

// ── PUENTES DE HIDRÓGENO: 2 (A–T) / 3 (G–C) hilos blanco-caliente al centro ──
for (let k = 0; k < nHb; k++) {
  const f = frames[Math.floor(R() * frames.length)];
  const nb = hbondsFor(f.base1);                        // 2 o 3
  const which = Math.floor(R() * nb);
  // los hilos cruzan cerca del eje, repartidos en r pequeño y un leve fan en z
  const r0 = 0.35 + which * 0.6;                        // separa los 2-3 hilos
  const ang = f.theta + (B_DNA.grooveOffsetDeg * Math.PI / 180) * 0.5;  // a media vía entre hebras
  const along = (R() - 0.5) * 1.6;                      // recorre el hilo de un lado a otro del centro
  const p: V3 = [r0 * Math.cos(ang) + along * Math.cos(ang + 1.57) * 0.3,
                 r0 * Math.sin(ang) + along * Math.sin(ang + 1.57) * 0.3, f.z + gauss(R) * 0.18];
  emit(p, [0.95, 0.9, 0.78], 0.11, 2);                 // blanco-cálido tenue
}

// ── ÁTOMOS VISIBLES: marcadores brillantes en cada azúcar (C1') y cada base
// (N9/N1) → se ven CIENTOS de átomos, no un backbone difuso. Más un halo de
// densidad alrededor de cada uno para que tengan cuerpo. ──
for (const a of atoms) {
  for (let s = 0; s < 6; s++) {                          // halo de densidad por átomo
    const j: V3 = [gauss(R) * 0.45, gauss(R) * 0.45, gauss(R) * 0.45];
    emit(add(a.c1, j), colHot(TEAL, 0.85), 0.20, 1);                       // azúcar (C1')
    const j2: V3 = [gauss(R) * 0.5, gauss(R) * 0.5, gauss(R) * 0.5];
    emit(add(a.baseEdge, j2), colHot(hex(BASE_COLOR[a.base as Base]), 0.9), 0.22, 2); // base (color por base)
  }
  emit(a.c1, colHot(TEAL, 1.0), 0.34, 1);                                  // núcleo del átomo
  emit(a.baseEdge, colHot(hex(BASE_COLOR[a.base as Base]), 1.0), 0.36, 2);
}

// ── NÚCLEOS: fosfatos (P) de ambas hebras — los puntos dorados del esqueleto ──
const nuclei: { Z: number; pos: V3 }[] = [];
for (const a of atoms) nuclei.push({ Z: 15, pos: sub(a.p, center) });   // P

// ── escala de render: Å → unidades cómodas (la hélice queda ~24 u de largo) ──
// La medida REAL (3.4 Å/escalón) se cuenta en el placard; aquí solo encuadramos.
let maxPerp = 0;
for (const o of out) { const rp = Math.hypot(o.p[0], o.p[1]); if (rp > maxPerp) maxPerp = rp; }
const RENDER = 5 / Math.max(maxPerp, 1);               // radio de la hélice → ~5 u; el LARGO crece a lo alto
const M = out.length, K = nuclei.length;
const positions = new Float32Array(M * 3), colors = new Float32Array(M * 3), sizes = new Float32Array(M), shl = new Float32Array(M);
let extent = 0;
for (let i = 0; i < M; i++) {
  const o = out[i];
  positions[i * 3] = o.p[0] * RENDER; positions[i * 3 + 1] = o.p[1] * RENDER; positions[i * 3 + 2] = o.p[2] * RENDER;
  colors[i * 3] = o.c[0]; colors[i * 3 + 1] = o.c[1]; colors[i * 3 + 2] = o.c[2];
  sizes[i] = o.s; shl[i] = o.g;
  const rr = len([positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]); if (rr > extent) extent = rr;
}
extent *= 1.04;

const headerFloats = 1 + K * 4;
const totalBytes = 8 + headerFloats * 4 + (M * 3 + M * 3 + M + M) * 4;
const buf = Buffer.alloc(totalBytes);
let off = 0;
buf.writeInt32LE(M, off); off += 4; buf.writeInt32LE(K, off); off += 4; buf.writeFloatLE(extent, off); off += 4;
for (const n of nuclei) { buf.writeFloatLE(n.pos[0] * RENDER, off); off += 4; buf.writeFloatLE(n.pos[1] * RENDER, off); off += 4; buf.writeFloatLE(n.pos[2] * RENDER, off); off += 4; buf.writeFloatLE(n.Z, off); off += 4; }
const wf = (arr: Float32Array) => { for (let i = 0; i < arr.length; i++) { buf.writeFloatLE(arr[i], off); off += 4; } };
wf(positions); wf(colors); wf(sizes); wf(shl);

const outDir = resolve(ROOT, 'public', 'precomputed');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `dna-${key}.bin`);
writeFileSync(outFile, buf);
console.log(`✓ ${outFile} · ${(totalBytes / 1024 / 1024).toFixed(2)} MB · ${M} pts · ${K} fosfatos · ${seq.length} bp (${seq}) · ${duplex.turns.toFixed(1)} vueltas · extent=${extent.toFixed(2)}`);
