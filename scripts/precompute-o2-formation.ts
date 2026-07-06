/**
 * precompute-o2-formation.ts — LA FORMACIÓN DEL ENLACE DE O₂, CALCULADA Y FLUIDA.
 *
 * Partículas LAGRANGIANAS que FLUYEN con la densidad real (no nube fija con brillo).
 * Para cada separación R: se colocan M partículas según ρ(r;R) por INVERSA DE CDF
 * con las MISMAS semillas u_i → al cambiar R cada partícula se desplaza SUAVE
 * (advección): la densidad fluye, la carga FLUYE al enlace. NADA pintado.
 *
 * ρ(r;R) = Σ occ·|ψ_MO(r)|²  (electronDensity de los MOs reales; O2 con setBondLength).
 *
 * Muestreo por inversa de CDF condicional (x → y|x → z|x,y) sobre una rejilla, con
 * interpolación lineal → posiciones CONTINUAS en R (advección sin saltos).
 *
 * Formato .bin (little-endian):
 *   int32   M, K, Z0, Z1
 *   float32 R0, R1
 *   float32[K]      Rvals           (bohr, descendente Rmax→Rmin)
 *   float32[M*3]    colors          (color por MO dominante en el equilibrio)
 *   int16[K*M*3]    posQ            (posiciones por R, cuantizadas: bohr = posQ/POSQ)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { O2, setBondLength, electronDensity, psiMO, type Molecule3D } from '../src/lib/chem/quantum/molecular-orbitals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'precomputed', 'o2-formation.bin');

const M = 90_000;                  // partículas
const K = 56;                      // separaciones R
const R_MIN = 2.0, R_MAX = 4.8;    // bohr (overshoot 2.05 → lejos 4.56)
const POSQ = 6000;                 // cuantización int16: bohr = posQ/6000 (±5.4 bohr)
const NX = 96, NY = 64, NZ = 64;   // rejilla para la CDF
const LX = 5.2, LR = 4.0;          // medio-caja (bohr)

const Rvals: number[] = [];
for (let k = 0; k < K; k++) Rvals.push(R_MAX + (R_MIN - R_MAX) * (k / (K - 1)));   // lejos → cerca

// semillas FIJAS u_i ∈ [0,1]³ (las mismas en todo R → advección coherente)
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const seedRand = rng(20260630);
const U = new Float32Array(M * 3);
for (let i = 0; i < M * 3; i++) U[i] = seedRand();

// color por MO dominante (la física tiñe): enlazante = oro; π* = violeta (imán); σ* = azul
function moColor(mo: Molecule3D['mos'][number]): [number, number, number] {
  const isPi = mo.name.includes('π');
  if (mo.symmetry === 'antibonding' && isPi) return [0.70, 0.34, 1.0];   // π* = imán (violeta)
  if (mo.symmetry === 'antibonding') return [0.34, 0.52, 1.0];           // σ* (azul)
  if (isPi) return [1.0, 0.66, 0.20];                                    // π enlazante (ámbar)
  return [1.0, 0.84, 0.34];                                             // σ enlazante (oro)
}
function dominantMO(x: number, y: number, z: number, mol: Molecule3D): number {
  let bi = 0, bv = -1;
  for (let m = 0; m < mol.mos.length; m++) { const mo = mol.mos[m]; if (mo.occupancy === 0) continue; const p = psiMO(x, y, z, mo, mol.atoms); const d = mo.occupancy * p * p; if (d > bv) { bv = d; bi = m; } }
  return bi;
}

// invCDF: cumulativo C[0..N] (C[0]=0), u∈[0,1] → índice continuo ∈[0,N]
function invCDF(C: Float32Array, N: number, u: number): number {
  const total = C[N]; if (total <= 0) return u * N;
  const target = u * total;
  let lo = 0, hi = N;
  while (lo < hi) { const m = (lo + hi) >> 1; if (C[m + 1] <= target) lo = m + 1; else hi = m; }
  const j = Math.min(lo, N - 1);
  const seg = C[j + 1] - C[j];
  return j + (seg > 0 ? (target - C[j]) / seg : 0.5);
}

const dx = (2 * LX) / NX, dy = (2 * LR) / NY, dz = (2 * LR) / NZ;
const posQ = new Int16Array(K * M * 3);

// reusables por R
const rho = new Float32Array(NX * NY * NZ);
const Cx = new Float32Array(NX + 1);
const Cy = new Float32Array(NX * (NY + 1));   // CDF y|x por cada ix
const Cz = new Float32Array(NX * NY * (NZ + 1)); // CDF z|x,y

console.log('=== DIAGNÓSTICO: ρ del enlace (centro) vs R — debe CRECER al bajar R ===');
for (let k = 0; k < K; k++) {
  const R = Rvals[k];
  const mol = setBondLength(O2, R);
  // 1) ρ en la rejilla + CDFs
  let pmax = 0;
  for (let ix = 0; ix < NX; ix++) {
    const x = -LX + (ix + 0.5) * dx;
    for (let iy = 0; iy < NY; iy++) {
      const y = -LR + (iy + 0.5) * dy;
      const base = (ix * NY + iy) * NZ;
      const czBase = (ix * NY + iy) * (NZ + 1);
      let czAcc = 0; Cz[czBase] = 0;
      for (let iz = 0; iz < NZ; iz++) {
        const z = -LR + (iz + 0.5) * dz;
        const r = electronDensity(x, y, z, mol);
        rho[base + iz] = r; if (r > pmax) pmax = r;
        czAcc += r; Cz[czBase + iz + 1] = czAcc;
      }
    }
  }
  // CDF y|x  y  CDF x
  Cx[0] = 0;
  for (let ix = 0; ix < NX; ix++) {
    const cyBase = ix * (NY + 1);
    let cyAcc = 0; Cy[cyBase] = 0;
    for (let iy = 0; iy < NY; iy++) {
      const czBase = (ix * NY + iy) * (NZ + 1);
      cyAcc += Cz[czBase + NZ];               // masa total de la columna z
      Cy[cyBase + iy + 1] = cyAcc;
    }
    Cx[ix + 1] = Cx[ix] + cyAcc;              // masa total del slab x
  }
  // 2) colocar M partículas por inversa de CDF condicional
  for (let i = 0; i < M; i++) {
    const ux = U[i * 3], uy = U[i * 3 + 1], uz = U[i * 3 + 2];
    const fx = invCDF(Cx, NX, ux);                       // índice continuo x
    const ix = Math.min(NX - 1, Math.max(0, Math.floor(fx)));
    const x = -LX + fx * dx;
    const cyBase = ix * (NY + 1);
    const fy = invCDF(Cy.subarray(cyBase, cyBase + NY + 1) as Float32Array, NY, uy);
    const iy = Math.min(NY - 1, Math.max(0, Math.floor(fy)));
    const y = -LR + fy * dy;
    const czBase = (ix * NY + iy) * (NZ + 1);
    const fz = invCDF(Cz.subarray(czBase, czBase + NZ + 1) as Float32Array, NZ, uz);
    const z = -LR + fz * dz;
    const o = (k * M + i) * 3;
    posQ[o] = Math.max(-32767, Math.min(32767, Math.round(x * POSQ)));
    posQ[o + 1] = Math.max(-32767, Math.min(32767, Math.round(y * POSQ)));
    posQ[o + 2] = Math.max(-32767, Math.min(32767, Math.round(z * POSQ)));
  }
  if (k % 8 === 0 || k === K - 1) {
    const rhoMid = electronDensity(0, 0, 0, mol), rhoAtom = electronDensity(-R / 2, 0, 0, mol);
    console.log(`  R=${R.toFixed(2)} bohr (${(R * 0.529).toFixed(2)} Å)  ρ_enlace(0)=${rhoMid.toExponential(2)}  ratio=${(rhoMid / rhoAtom).toFixed(3)}`);
  }
}

// color por MO dominante en el equilibrio, en la posición de cada partícula a Re
const colors = new Float32Array(M * 3);
const molEq = setBondLength(O2, 2.28);
const kEq = Rvals.reduce((best, r, idx) => Math.abs(r - 2.28) < Math.abs(Rvals[best] - 2.28) ? idx : best, 0);
for (let i = 0; i < M; i++) {
  const o = (kEq * M + i) * 3;
  const x = posQ[o] / POSQ, y = posQ[o + 1] / POSQ, z = posQ[o + 2] / POSQ;
  const c = moColor(molEq.mos[dominantMO(x, y, z, molEq)]);
  colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
}

// escribir bin
const header = 16 + 8 + K * 4;
const buf = Buffer.alloc(header + M * 3 * 4 + K * M * 3 * 2);
let off = 0;
buf.writeInt32LE(M, off); off += 4; buf.writeInt32LE(K, off); off += 4;
buf.writeInt32LE(8, off); off += 4; buf.writeInt32LE(8, off); off += 4;
buf.writeFloatLE(R_MIN, off); off += 4; buf.writeFloatLE(R_MAX, off); off += 4;
for (let k = 0; k < K; k++) { buf.writeFloatLE(Rvals[k], off); off += 4; }
for (let i = 0; i < M * 3; i++) { buf.writeFloatLE(colors[i], off); off += 4; }
for (let i = 0; i < K * M * 3; i++) { buf.writeInt16LE(posQ[i], off); off += 2; }
fs.writeFileSync(OUT, buf.subarray(0, off));
const distOut = path.join(__dirname, '..', 'dist', 'precomputed', 'o2-formation.bin');
try { fs.mkdirSync(path.dirname(distOut), { recursive: true }); fs.copyFileSync(OUT, distOut); } catch { /* dist puede no existir */ }
console.log(`✓ ${OUT}  ·  ${(off / 1024 / 1024).toFixed(1)} MB  ·  ${M} partículas LAGRANGIANAS × ${K} separaciones (advección)`);
