/**
 * precompute-molecule.ts — Muestrea la densidad electrónica REAL (LCAO) de una
 * molécula canónica y la guarda como .bin para que el cliente solo cargue datos.
 *
 * Usa sampleMolecule (Monte Carlo por rechazo sobre ρ = Σ nᵢ|ψᵢ|²) con los
 * orbitales moleculares ya definidos en canonical-molecules.ts (Slater Zeff,
 * geometría VSEPR real). El color sale de la simetría del MO dominante:
 *   bonding   → cian  (enlaces σ O–H)
 *   nonbonding→ rosa  (pares libres — los que causan el ángulo 104.5°)
 *
 * Salida: public/precomputed/mol-<key>.bin
 *   Int32  N
 *   Int32  K (núcleos)
 *   Float32 extent
 *   Float32[K*4]  núcleos (x,y,z,Z)
 *   Float32[N*3]  positions
 *   Float32[N*3]  colors
 *   Float32[N]    sizes
 *   Float32[N]    shellIdx   (grupo de revelado: 0 core, 1 enlaces, 2 pares libres)
 *
 * Uso: tsx --tsconfig tsconfig.lesson.json scripts/precompute-molecule.ts h2o 120000
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { H2O, CH4, NH3, CO2, C2H4, C2H2, HCl, NaCl, C6H6 } from '../src/lib/chem/quantum/canonical-molecules';
import { H2, HE_H_CATION, LI2, BE2, N2, O2, F2, C2, HF, CO, NO, sampleMolecule, type Molecule3D } from '../src/lib/chem/quantum/molecular-orbitals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MOLS: Record<string, Molecule3D> = {
  h2o: H2O, ch4: CH4, nh3: NH3, co2: CO2, c2h4: C2H4, c2h2: C2H2, hcl: HCl, nacl: NaCl, c6h6: C6H6,
  h2: H2, hehp: HE_H_CATION, li2: LI2, be2: BE2, n2: N2, o2: O2, f2: F2, c2: C2, hf: HF, co: CO,
  no: NO,
};

const key = (process.argv[2] || 'h2o').toLowerCase();
const N = parseInt(process.argv[3] || '140000', 10);
const mol = MOLS[key] ?? H2O;

// Color = INFORMACIÓN (paleta tipo NASA/Hubble: cada color es un dato real del
// orbital) + GLOW blanco-caliente en los picos de densidad, donde los electrones
// se acumulan = el enlace, que brilla como el núcleo de una nebulosa.
//   core 2s  → índigo profundo (capa interna inerte)
//   σ enlace → cian luminoso (densidad compartida entre núcleos)
//   π enlace → violeta (densidad arriba/abajo del eje)
//   par libre→ rosa cálido (electrones "disponibles", causan la geometría)
function colorForMO(mo: { symmetry: string; name: string } | undefined, density: number): [number, number, number] {
  const name = (mo?.name ?? '').toLowerCase();
  const sym = mo?.symmetry ?? 'bonding';
  let base: [number, number, number];
  if (sym === 'nonbonding' && name.includes('2s')) base = [0.34, 0.30, 0.92];
  else if (sym === 'nonbonding') base = [1.0, 0.38, 0.64];
  else if (name.includes('π') || name.includes('pi')) base = [0.74, 0.42, 1.0];
  else if (sym === 'antibonding') base = [0.62, 0.66, 0.72];
  else base = [0.36, 0.86, 1.0];
  // picos de densidad → blanco-caliente (HDR >1 para que el bloom lo derrame)
  const hot = Math.min(1, density * density * 1.7);
  const r = base[0] * (1 - hot) + 1.0 * hot;
  const g = base[1] * (1 - hot) + 0.96 * hot;
  const b = base[2] * (1 - hot) + 0.86 * hot;
  const bright = 0.42 + 1.15 * density;          // rango dinámico de nebulosa
  return [r * bright, g * bright, b * bright];
}

// Grupo de revelado por simetría: 0 = core/2s, 1 = enlaces, 2 = pares libres
function revealGroup(mo: { symmetry: string; name: string }): number {
  if (mo.symmetry === 'bonding') return 1;
  if (mo.symmetry === 'nonbonding') return mo.name.includes('2s') ? 0 : 2;
  return 1;
}

console.log(`⚛ Muestreando ${mol.name} (${mol.formula}) — objetivo ${N} puntos LCAO...`);
const t0 = Date.now();
// El rejection sampling tiene baja aceptación (picos nucleares dominan rhoMax),
// así que acumulamos lotes con semillas distintas hasta alcanzar el objetivo.
const samples: ReturnType<typeof sampleMolecule> = [];
let seed = 7;
while (samples.length < N && seed < 7 + 16) {
  const batch = sampleMolecule(mol, 200000, seed);
  for (const _s of batch) samples.push(_s);   // push(...huge) revienta el call stack (H2)
  console.log(`  lote seed=${seed}: +${batch.length} → ${samples.length}/${N}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  seed++;
}
samples.length = Math.min(samples.length, N);
console.log(`  TOTAL ${samples.length} puntos en ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const M = samples.length;
const positions = new Float32Array(M * 3);
const colors = new Float32Array(M * 3);
const sizes = new Float32Array(M);
const shellIdx = new Float32Array(M);
let maxR = 0;

for (let i = 0; i < M; i++) {
  const s = samples[i];
  positions[i * 3] = s.x; positions[i * 3 + 1] = s.y; positions[i * 3 + 2] = s.z;
  const mo = mol.mos[s.dominantMOIndex];
  const [r, g, b] = colorForMO(mo, s.density);
  colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  sizes[i] = 0.04 + 0.13 * s.density;
  shellIdx[i] = revealGroup(mo ?? { symmetry: 'bonding', name: '' });
  const rr = Math.hypot(s.x, s.y, s.z);
  if (rr > maxR) maxR = rr;
}

const K = mol.atoms.length;
const extent = maxR * 1.05;

// Ensamblar .bin
const headerFloats = 1 + K * 4; // extent + nuclei(x,y,z,Z)
const totalBytes = 8 /* 2 int32 */ + headerFloats * 4 + (M * 3 + M * 3 + M + M) * 4;
const buf = Buffer.alloc(totalBytes);
let off = 0;
buf.writeInt32LE(M, off); off += 4;
buf.writeInt32LE(K, off); off += 4;
buf.writeFloatLE(extent, off); off += 4;
for (const a of mol.atoms) {
  buf.writeFloatLE(a.position[0], off); off += 4;
  buf.writeFloatLE(a.position[1], off); off += 4;
  buf.writeFloatLE(a.position[2], off); off += 4;
  buf.writeFloatLE(a.Z, off); off += 4;
}
function writeF32(arr: Float32Array) {
  for (let i = 0; i < arr.length; i++) { buf.writeFloatLE(arr[i], off); off += 4; }
}
writeF32(positions); writeF32(colors); writeF32(sizes); writeF32(shellIdx);

const outDir = resolve(ROOT, 'public', 'precomputed');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `mol-${key}.bin`);
writeFileSync(outFile, buf);
console.log(`✓ ${outFile}  ·  ${(totalBytes / 1024 / 1024).toFixed(2)} MB  ·  ${M} pts · extent=${extent.toFixed(2)} bohr · ${K} núcleos`);
