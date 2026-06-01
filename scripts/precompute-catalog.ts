/**
 * precompute-catalog.ts — Construye la densidad electrónica de CUALQUIER molécula
 * del catálogo (scripts/catalog.json, specs verificadas: átomos en Å + enlaces +
 * pares libres + conjugación) con orbitales LOCALIZADOS honestos:
 *   · σ por enlace (lóbulo prolato) — C–C teal, X–H ámbar, X–Y teal.
 *   · π por enlace de orden ≥2 (lóbulos perpendiculares) — violeta.
 *   · pares libres (lóbulos apuntando lejos de los enlaces) — rosa (zonas reactivas).
 *
 * Salida: mismo formato .bin (lo lee parseBin) → public/precomputed/catalog-<key>.bin
 * Uso: tsx --tsconfig tsconfig.lesson.json scripts/precompute-catalog.ts etanol 110000
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ANG2BOHR = 1.8897259886;

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// rota v alrededor del eje k (unitario) un ángulo th (Rodrigues)
function rot(v: V3, k: V3, th: number): V3 {
  const c = Math.cos(th), s = Math.sin(th);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(R: () => number) { const u = Math.max(1e-9, R()), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function perpAxis(u: V3): V3 { const t: V3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; return norm(cross(u, t)); }

const SIGMA_CC: V3 = [0.26, 0.86, 0.96];   // σ C–C / X–Y teal
const SIGMA_XH: V3 = [1.0, 0.60, 0.26];    // σ X–H ámbar
const PI: V3 = [0.78, 0.40, 1.0];          // π violeta
const LP: V3 = [1.0, 0.38, 0.64];          // par libre rosa (zonas reactivas)

function colHot(base: V3, density: number): V3 {
  const hot = Math.min(1, density * density * 0.5);
  const r = base[0] * (1 - hot) + 1.0 * hot, g = base[1] * (1 - hot) + 0.96 * hot, b = base[2] * (1 - hot) + 0.86 * hot;
  const bright = 0.24 + 0.55 * density;
  return [r * bright, g * bright, b * bright];
}

interface Atom { el: string; Z: number; x: number; y: number; z: number; }
interface Bond { i: number; j: number; order: number; }
interface Spec { key: string; atoms: Atom[]; bonds: Bond[]; lonePairs?: { atom: number; count: number }[]; conjugated?: boolean; }

const key = (process.argv[2] || 'etanol').toLowerCase();
const N = parseInt(process.argv[3] || '110000', 10);
const catalog: Spec[] = JSON.parse(readFileSync(resolve(ROOT, 'scripts', 'catalog.json'), 'utf8'));
const spec = catalog.find(s => s.key === key);
if (!spec) { console.error(`molécula desconocida: ${key}. Hay: ${catalog.map(s => s.key).join(', ')}`); process.exit(1); }

// posiciones en Å, centradas en el centroide
const P: V3[] = spec.atoms.map(a => [a.x, a.y, a.z]);
const cen = mul(P.reduce((a, p) => add(a, p), [0, 0, 0] as V3), 1 / P.length);
const pos0 = P.map(p => sub(p, cen));
const Zof = spec.atoms.map(a => a.Z);
const neighbors: number[][] = spec.atoms.map(() => []);
for (const b of spec.bonds) { neighbors[b.i].push(b.j); neighbors[b.j].push(b.i); }

const R = rng(20260531);
const out: { p: V3; c: V3; s: number; g: number }[] = [];
const emit = (p: V3, c: V3, s: number, g: number) => out.push({ p, c, s, g });

// presupuesto de puntos
const piUnits = spec.bonds.reduce((a, b) => a + Math.max(0, b.order - 1), 0);
const nLP = (spec.lonePairs || []).reduce((a, l) => a + l.count, 0);
const wS = spec.bonds.length, wP = piUnits * 2.2, wL = nLP * 1.4;
const tot = wS + wP + wL || 1;
const nSig = Math.round(N * wS / tot), nPi = Math.round(N * wP / tot), nLp = N - nSig - nPi;

// ── σ: lóbulo prolato centrado en cada enlace ──
for (let s = 0; s < nSig; s++) {
  const b = spec.bonds[Math.floor(R() * spec.bonds.length)];
  const A = pos0[b.i], B = pos0[b.j], axis = sub(B, A), u = norm(axis);
  const e1 = perpAxis(u), e2 = norm(cross(u, e1));
  const t = Math.min(1, Math.max(0, 0.5 + gauss(R) * 0.2));
  const rad = Math.abs(gauss(R)) * (b.order >= 2 ? 0.30 : 0.26), ph = R() * 2 * Math.PI;
  const p = add(add(A, mul(axis, t)), add(mul(e1, Math.cos(ph) * rad), mul(e2, Math.sin(ph) * rad)));
  const isXH = Zof[b.i] === 1 || Zof[b.j] === 1;
  const dens = Math.exp(-((t - 0.5) ** 2) / 0.10) * Math.exp(-(rad * rad) / 0.10);
  emit(p, colHot(isXH ? SIGMA_XH : SIGMA_CC, 0.45 + 0.55 * dens), 0.028 + 0.08 * dens, 1);
}

// ── π: lóbulos perpendiculares al enlace, en la cara del sistema π ──
const piBonds = spec.bonds.filter(b => b.order >= 2);
for (let s = 0; s < nPi && piBonds.length; s++) {
  const b = piBonds[Math.floor(R() * piBonds.length)];
  const A = pos0[b.i], B = pos0[b.j], u = norm(sub(B, A));
  // normal del plano π: usar un vecino de i (o j) para definir el plano
  let k = neighbors[b.i].find(n => n !== b.j); if (k === undefined) k = neighbors[b.j].find(n => n !== b.i);
  const nrm = k !== undefined ? norm(cross(u, sub(pos0[k], A))) : perpAxis(u);
  const t = R(), base = add(A, mul(sub(B, A), t));
  const side = R() < 0.5 ? 1 : -1, off = 0.5 + Math.abs(gauss(R)) * 0.22;
  const along = mul(u, gauss(R) * 0.34), wob = mul(norm(cross(nrm, u)), gauss(R) * 0.22);
  const p = add(add(base, mul(nrm, side * off)), add(along, wob));
  const dens = Math.exp(-((off - 0.55) ** 2) / 0.16);
  emit(p, colHot(PI, 0.5 + 0.5 * dens), 0.032 + 0.085 * dens, 2);
}

// ── pares libres: lóbulos apuntando LEJOS de los enlaces (VSEPR aprox) ──
const lpSlots: { atom: number; dir: V3 }[] = [];
for (const l of spec.lonePairs || []) {
  const a = l.atom; const bd = neighbors[a].map(n => norm(sub(pos0[n], pos0[a])));
  const sumB = bd.reduce((s, d) => add(s, d), [0, 0, 0] as V3);
  const base = norm(mul(sumB, -1));                       // lejos de los enlaces
  const ax = bd.length ? norm(cross(base, bd[0])) : perpAxis(base);
  let dirs: V3[];
  if (l.count <= 1) dirs = [base];
  else if (l.count === 2) dirs = [rot(base, ax, 0.96), rot(base, ax, -0.96)]; // ~±55°
  else dirs = [0, 1, 2].map(kk => rot(base, base, kk * 2.094)); // 3 a 120°
  for (const d of dirs.slice(0, l.count)) lpSlots.push({ atom: a, dir: norm(d) });
}
for (let s = 0; s < nLp && lpSlots.length; s++) {
  const sl = lpSlots[Math.floor(R() * lpSlots.length)];
  const o = pos0[sl.atom], u = sl.dir, e1 = perpAxis(u), e2 = norm(cross(u, e1));
  const d = 0.55 + Math.abs(gauss(R)) * 0.32, rad = Math.abs(gauss(R)) * 0.26, ph = R() * 2 * Math.PI;
  const p = add(add(o, mul(u, d)), add(mul(e1, Math.cos(ph) * rad), mul(e2, Math.sin(ph) * rad)));
  const dens = Math.exp(-((d - 0.7) ** 2) / 0.18);
  emit(p, colHot(LP, 0.5 + 0.5 * dens), 0.034 + 0.085 * dens, 2);
}

// ── ensamblar .bin ──
const M = out.length, K = spec.atoms.length;
let maxR = 0;
const positions = new Float32Array(M * 3), colors = new Float32Array(M * 3), sizes = new Float32Array(M), shl = new Float32Array(M);
for (let i = 0; i < M; i++) {
  const o = out[i]; const pb: V3 = [o.p[0] * ANG2BOHR, o.p[1] * ANG2BOHR, o.p[2] * ANG2BOHR];
  positions[i * 3] = pb[0]; positions[i * 3 + 1] = pb[1]; positions[i * 3 + 2] = pb[2];
  colors[i * 3] = o.c[0]; colors[i * 3 + 1] = o.c[1]; colors[i * 3 + 2] = o.c[2];
  sizes[i] = o.s; shl[i] = o.g; const rr = len(pb); if (rr > maxR) maxR = rr;
}
const extent = maxR * 1.06;
const headerFloats = 1 + K * 4;
const totalBytes = 8 + headerFloats * 4 + (M * 3 + M * 3 + M + M) * 4;
const buf = Buffer.alloc(totalBytes);
let off = 0;
buf.writeInt32LE(M, off); off += 4; buf.writeInt32LE(K, off); off += 4; buf.writeFloatLE(extent, off); off += 4;
for (let i = 0; i < K; i++) {
  buf.writeFloatLE(pos0[i][0] * ANG2BOHR, off); off += 4;
  buf.writeFloatLE(pos0[i][1] * ANG2BOHR, off); off += 4;
  buf.writeFloatLE(pos0[i][2] * ANG2BOHR, off); off += 4;
  buf.writeFloatLE(Zof[i], off); off += 4;
}
const wf = (arr: Float32Array) => { for (let i = 0; i < arr.length; i++) { buf.writeFloatLE(arr[i], off); off += 4; } };
wf(positions); wf(colors); wf(sizes); wf(shl);

const outDir = resolve(ROOT, 'public', 'precomputed');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `catalog-${key}.bin`);
writeFileSync(outFile, buf);
console.log(`✓ ${outFile} · ${(totalBytes / 1024 / 1024).toFixed(2)} MB · ${M} pts · ${K} átomos · ${piUnits}π ${nLP}LP · ${spec.conjugated ? 'conjugado' : ''} · extent=${extent.toFixed(2)} bohr`);
