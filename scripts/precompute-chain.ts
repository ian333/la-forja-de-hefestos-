/**
 * precompute-chain.ts — CADENAS moleculares con densidad electrónica localizada
 * (física honesta). La cámara las ATRAVIESA (modo traversal en CinematicMolecule).
 *
 * No usamos LCAO canónico (intratable a mano para 8–22 átomos): usamos la imagen
 * de ORBITALES DE ENLACE LOCALIZADOS, que es físicamente equivalente al conjunto
 * canónico por una transformación unitaria (localización de Foster–Boys):
 *   · esqueleto σ: geometría REAL (longitudes y ángulos de enlace medidos) y una
 *     densidad por enlace (lóbulo prolato centrado en el enlace).
 *   · sistema π (cadenas conjugadas): densidad DESLOCALIZADA en dos cintas
 *     arriba/abajo del plano, recorriendo toda la cadena — los electrones que
 *     "viajan por la cadena". Es el cromóforo real (lo que da color al β-caroteno).
 *
 * Salida: mismo formato .bin que precompute-molecule.ts (lo lee parseBin igual).
 *   Int32 N · Int32 K · Float32 extent · Float32[K*4] núcleos(x,y,z,Z)
 *   Float32[N*3] positions · Float32[N*3] colors · Float32[N] sizes · Float32[N] shellIdx
 *
 * Uso: tsx --tsconfig tsconfig.lesson.json scripts/precompute-chain.ts octane 130000
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── mini-álgebra vectorial (Å, luego pasamos a bohr) ──────────────────────────
type V3 = [number, number, number];
const ANG2BOHR = 1.8897259886;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// RNG determinista (mulberry32) — reproducible entre corridas.
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// gaussiana N(0,1) por Box–Muller
function gauss(R: () => number) { const u = Math.max(1e-9, R()), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

interface Atom { Z: number; pos: V3; }            // posiciones en Å
interface Bond { i: number; j: number; order: number; }  // order 1/2/3
interface Chain { atoms: Atom[]; bonds: Bond[]; conjugated: boolean; }

// ── ALCANO lineal CnH(2n+2): zig-zag anti tetraédrico (109.47°), C–C 1.54, C–H 1.09 ──
function alkane(n: number): Chain {
  const dCC = 1.54, dCH = 1.09;
  const delta = (35.26) * Math.PI / 180;          // medio del suplemento del ángulo tetraédrico
  const dx = dCC * Math.cos(delta), dy = dCC * Math.sin(delta);
  const atoms: Atom[] = [], bonds: Bond[] = [];
  const C: number[] = [];
  for (let i = 0; i < n; i++) { atoms.push({ Z: 6, pos: [i * dx, (i % 2) * dy, 0] }); C.push(i); }
  for (let i = 0; i < n - 1; i++) bonds.push({ i: C[i], j: C[i + 1], order: 1 });
  // Hidrógenos: completar el tetraedro en cada carbono.
  for (let i = 0; i < n; i++) {
    const p = atoms[C[i]].pos;
    const nb: V3[] = [];
    if (i > 0) nb.push(norm(sub(atoms[C[i - 1]].pos, p)));
    if (i < n - 1) nb.push(norm(sub(atoms[C[i + 1]].pos, p)));
    const dirs = completeTetra(nb);
    for (const d of dirs) { const hpos = add(p, mul(d, dCH)); const idx = atoms.length; atoms.push({ Z: 1, pos: hpos }); bonds.push({ i: C[i], j: idx, order: 1 }); }
  }
  return { atoms, bonds, conjugated: false };
}

// ── POLIENO conjugado lineal (todo-trans): sp², 120°, alterna C=C 1.34 / C–C 1.45 ──
// CnH(n+2). El sistema π corre por toda la cadena (deslocalizado).
function polyene(n: number): Chain {
  const dd = 1.34, ds = 1.45, dCH = 1.09;
  const ang = 120 * Math.PI / 180;                // sp²
  const atoms: Atom[] = [], bonds: Bond[] = [];
  // construir la cadena en el plano xy, alternando giros ±(180-120)
  let p: V3 = [0, 0, 0];
  let dir: V3 = norm([Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0]);
  const C: number[] = [];
  for (let i = 0; i < n; i++) {
    atoms.push({ Z: 6, pos: p }); C.push(i);
    const d = (i % 2 === 0) ? dd : ds;            // empieza con doble
    if (i < n - 1) {
      const turn = (i % 2 === 0 ? 1 : -1) * (Math.PI - ang);
      const nd: V3 = [dir[0] * Math.cos(turn) - dir[1] * Math.sin(turn), dir[0] * Math.sin(turn) + dir[1] * Math.cos(turn), 0];
      p = add(p, mul(norm(dir), d)); dir = norm(nd);
    }
  }
  for (let i = 0; i < n - 1; i++) bonds.push({ i: C[i], j: C[i + 1], order: (i % 2 === 0) ? 2 : 1 });
  // H's en el plano (cada C sp²: 1 H hacia afuera, salvo donde no cabe en internos → todos llevan 1)
  for (let i = 0; i < n; i++) {
    const p0 = atoms[C[i]].pos; const nb: V3[] = [];
    if (i > 0) nb.push(norm(sub(atoms[C[i - 1]].pos, p0)));
    if (i < n - 1) nb.push(norm(sub(atoms[C[i + 1]].pos, p0)));
    // H en el plano, bisectriz externa
    let hdir: V3;
    if (nb.length === 2) hdir = norm(mul(add(nb[0], nb[1]), -1));
    else hdir = norm([-(nb[0]?.[0] ?? 1), -(nb[0]?.[1] ?? 0), 0]);
    if (len(hdir) < 1e-3) hdir = [0, 1, 0];
    atoms.push({ Z: 1, pos: add(p0, mul(hdir, dCH)) }); bonds.push({ i: C[i], j: atoms.length - 1, order: 1 });
    // los carbonos terminales llevan un H extra (CH2 terminal)
    if (i === 0 || i === n - 1) {
      const perp: V3 = norm(cross(nb[0] ?? [1, 0, 0], [0, 0, 1]));
      atoms.push({ Z: 1, pos: add(p0, mul(perp, dCH)) }); bonds.push({ i: C[i], j: atoms.length - 1, order: 1 });
    }
  }
  return { atoms, bonds, conjugated: true };
}

// dadas 1–2 direcciones de enlace ya ocupadas, devuelve las direcciones sp³ restantes
function completeTetra(occupied: V3[]): V3[] {
  if (occupied.length === 0) return [[0, 0, 1]];
  if (occupied.length === 1) {
    // 3 direcciones a 109.47° del eje, separadas 120°
    const a = occupied[0];
    let t: V3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(a, t)), v = norm(cross(a, u));
    const cosT = Math.cos(109.47 * Math.PI / 180), sinT = Math.sin(109.47 * Math.PI / 180);
    const out: V3[] = [];
    for (let k = 0; k < 3; k++) { const ph = k * 2 * Math.PI / 3; out.push(norm(add(mul(a, cosT), mul(add(mul(u, Math.cos(ph)), mul(v, Math.sin(ph))), sinT)))); }
    return out;
  }
  // 2 ocupadas → 2 restantes en el plano perpendicular a la bisectriz
  const b = norm(mul(add(occupied[0], occupied[1]), -1));   // bisectriz externa
  const n = norm(cross(occupied[0], occupied[1]));          // perpendicular al plano de enlaces
  const half = 54.75 * Math.PI / 180;
  return [norm(add(mul(b, Math.cos(half)), mul(n, Math.sin(half)))), norm(add(mul(b, Math.cos(half)), mul(n, -Math.sin(half))))];
}

// ── catálogo de cadenas ──────────────────────────────────────────────────────
const CHAINS: Record<string, () => Chain> = {
  butane: () => alkane(4),
  pentane: () => alkane(5),
  hexane: () => alkane(6),
  heptane: () => alkane(7),
  octane: () => alkane(8),
  nonane: () => alkane(9),
  decane: () => alkane(10),
  dodecane: () => alkane(12),
  pentadecane: () => alkane(15),
  hexadecane: () => alkane(16),
  heptadecane: () => alkane(17),
  eicosane: () => alkane(20),
  hexatriene: () => polyene(6),
  octatetraene: () => polyene(8),
  decapentaene: () => polyene(10),
  dodecahexaene: () => polyene(12),
  tetradecaheptaene: () => polyene(14),
  hexadecaoctaene: () => polyene(16),
  caroteno: () => polyene(22),     // el cromóforo poliénico del β-caroteno (lo que da el naranja y deja VER)
};

// ── color (mismas convenciones que precompute-molecule) ──────────────────────
// La cámara ATRAVIESA la cadena → la suma aditiva de puntos solapados se va a
// BLANCO si brillan mucho. Mantenemos el TONO (cian σ / violeta π) bajando el
// blanco-caliente y el brillo: el color es información, no el blowout.
function colHot(base: V3, density: number): V3 {
  const hot = Math.min(1, density * density * 0.5);   // poco blanco → conserva el tono
  const r = base[0] * (1 - hot) + 1.0 * hot, g = base[1] * (1 - hot) + 0.96 * hot, b = base[2] * (1 - hot) + 0.86 * hot;
  const bright = 0.24 + 0.55 * density;                // tenue: aditivo ya no satura a blanco
  return [r * bright, g * bright, b * bright];
}
const SIGMA: V3 = [0.26, 0.86, 0.96];   // σ C–C teal
const SIGMA_CH: V3 = [1.0, 0.60, 0.26]; // σ C–H ámbar cálido (color = info: distingue C–H de C–C)
const PI: V3 = [0.78, 0.40, 1.0];       // π violeta

// ─────────────────────────────────────────────────────────────────────────────
const key = (process.argv[2] || 'octane').toLowerCase();
const N = parseInt(process.argv[3] || '130000', 10);
const make = CHAINS[key];
if (!make) { console.error(`cadena desconocida: ${key}. Opciones: ${Object.keys(CHAINS).join(', ')}`); process.exit(1); }
const chain = make();
const R = rng(1337);

// centrar la molécula en su centroide (en Å)
const cen = chain.atoms.reduce((a, at) => add(a, at.pos), [0, 0, 0] as V3);
const centroid = mul(cen, 1 / chain.atoms.length);
chain.atoms.forEach(a => { a.pos = sub(a.pos, centroid); });

// presupuesto de puntos: cada enlace σ ~2e⁻, cada enlace π ~2e⁻ extra; el π pesa
// más visualmente (es el protagonista de la conjugación).
const sigmaBonds = chain.bonds;
const piBonds = chain.bonds.filter(b => b.order >= 2);
const wSigma = sigmaBonds.length, wPi = piBonds.length * 2.4;
const totW = wSigma + wPi || 1;
const nSigma = Math.round(N * wSigma / totW);
const nPi = N - nSigma;

const pos: number[] = [], col: number[] = [], siz: number[] = [], shl: number[] = [];
let maxR = 0;
const push = (p: V3, c: V3, s: number, group: number) => {
  const pb: V3 = [p[0] * ANG2BOHR, p[1] * ANG2BOHR, p[2] * ANG2BOHR];
  pos.push(pb[0], pb[1], pb[2]); col.push(c[0], c[1], c[2]); siz.push(s); shl.push(group);
  const rr = len(pb); if (rr > maxR) maxR = rr;
};

// σ: lóbulo prolato centrado en el enlace (denso entre núcleos, fino a los lados)
for (let s = 0; s < nSigma; s++) {
  const b = sigmaBonds[Math.floor(R() * sigmaBonds.length)];
  const A = chain.atoms[b.i].pos, B = chain.atoms[b.j].pos;
  const axis = sub(B, A), L = len(axis), u = norm(axis);
  let t1: V3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = norm(cross(u, t1)), e2 = norm(cross(u, e1));
  const t = Math.min(1, Math.max(0, 0.5 + gauss(R) * 0.20));   // pico al centro del enlace
  const rad = Math.abs(gauss(R)) * (b.order >= 2 ? 0.30 : 0.26); // doble enlace un poco más gordo
  const ph = R() * 2 * Math.PI;
  const p = add(add(A, mul(axis, t)), add(mul(e1, Math.cos(ph) * rad), mul(e2, Math.sin(ph) * rad)));
  const isCH = chain.atoms[b.i].Z === 1 || chain.atoms[b.j].Z === 1;
  const dens = Math.exp(-((t - 0.5) * (t - 0.5)) / 0.10) * Math.exp(-(rad * rad) / 0.10);
  push(p, colHot(isCH ? SIGMA_CH : SIGMA, 0.45 + 0.55 * dens), 0.028 + 0.08 * dens, 1);
  void L;
}

// π: densidad DESLOCALIZADA a lo largo de toda la subcadena conjugada, en dos
// cintas ±perpendicular al plano. Si no hay π (alcano), repartimos esos puntos
// como densidad σ extra del esqueleto para que la cadena se vea llena y viva.
if (piBonds.length > 0) {
  // plano de la molécula a partir de 3 carbonos
  const carbs = chain.atoms.filter(a => a.Z === 6).map(a => a.pos);
  const planeN = norm(cross(sub(carbs[1], carbs[0]), sub(carbs[2] ?? carbs[0], carbs[0])));
  // cadena conjugada = secuencia de carbonos; muestreamos a lo largo de los enlaces π
  for (let s = 0; s < nPi; s++) {
    const b = piBonds[Math.floor(R() * piBonds.length)];
    const A = chain.atoms[b.i].pos, B = chain.atoms[b.j].pos;
    const t = R();
    const base = add(A, mul(sub(B, A), t));
    const side = R() < 0.5 ? 1 : -1;
    const off = 0.50 + Math.abs(gauss(R)) * 0.22;          // separación de la cinta π del plano
    const inPlane = mul(norm(cross(planeN, sub(B, A))), gauss(R) * 0.30);
    const along = mul(norm(sub(B, A)), gauss(R) * 0.34);   // ensancha a lo largo → continuo
    const p = add(add(base, mul(planeN, side * off)), add(inPlane, along));
    const dens = Math.exp(-((off - 0.55) * (off - 0.55)) / 0.16);
    push(p, colHot(PI, 0.5 + 0.5 * dens), 0.032 + 0.085 * dens, 2);
  }
} else {
  // alcano: densidad σ adicional repartida por TODO el esqueleto C–C (más cuerpo)
  const cc = chain.bonds.filter(b => chain.atoms[b.i].Z === 6 && chain.atoms[b.j].Z === 6);
  for (let s = 0; s < nPi; s++) {
    const b = cc[Math.floor(R() * cc.length)] || chain.bonds[0];
    const A = chain.atoms[b.i].pos, B = chain.atoms[b.j].pos;
    const axis = sub(B, A), u = norm(axis);
    let t1: V3 = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = norm(cross(u, t1)), e2 = norm(cross(u, e1));
    const t = Math.min(1, Math.max(0, 0.5 + gauss(R) * 0.24));
    const rad = Math.abs(gauss(R)) * 0.30, ph = R() * 2 * Math.PI;
    const p = add(add(A, mul(axis, t)), add(mul(e1, Math.cos(ph) * rad), mul(e2, Math.sin(ph) * rad)));
    const dens = Math.exp(-((t - 0.5) * (t - 0.5)) / 0.12) * Math.exp(-(rad * rad) / 0.12);
    push(p, colHot(SIGMA, 0.42 + 0.5 * dens), 0.028 + 0.075 * dens, 1);
  }
}

// ── ensamblar .bin (idéntico a precompute-molecule) ──────────────────────────
const M = siz.length;
const K = chain.atoms.length;
const extent = maxR * 1.06;
const headerFloats = 1 + K * 4;
const totalBytes = 8 + headerFloats * 4 + (M * 3 + M * 3 + M + M) * 4;
const buf = Buffer.alloc(totalBytes);
let off = 0;
buf.writeInt32LE(M, off); off += 4;
buf.writeInt32LE(K, off); off += 4;
buf.writeFloatLE(extent, off); off += 4;
for (const a of chain.atoms) {
  buf.writeFloatLE(a.pos[0] * ANG2BOHR, off); off += 4;
  buf.writeFloatLE(a.pos[1] * ANG2BOHR, off); off += 4;
  buf.writeFloatLE(a.pos[2] * ANG2BOHR, off); off += 4;
  buf.writeFloatLE(a.Z, off); off += 4;
}
const writeArr = (arr: number[]) => { for (let i = 0; i < arr.length; i++) { buf.writeFloatLE(arr[i], off); off += 4; } };
writeArr(pos); writeArr(col); writeArr(siz); writeArr(shl);

const outDir = resolve(ROOT, 'public', 'precomputed');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `chain-${key}.bin`);
writeFileSync(outFile, buf);
console.log(`✓ ${outFile} · ${(totalBytes / 1024 / 1024).toFixed(2)} MB · ${M} pts · ${K} átomos · extent=${extent.toFixed(2)} bohr · ${chain.conjugated ? 'π conjugado' : 'σ alcano'}`);
