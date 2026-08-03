/**
 * AUTOMATIZAR EL MOLDE desde un STEP CUALQUIERA (bajado de internet):
 *   STEP → importa al kernel → MIDE (bbox, volumen, superficie, pared estimada)
 *   → MachineSpec → lo empuja a la sesión viva (mold-live) → La Forja arma el molde.
 * Uso: node --import tsx scripts/mold-from-step.cjs <archivo.stp> "<nombre>" [push]
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { execSync } = require('child_process');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

(async () => {
  const file = process.argv[2], name = process.argv[3] || path.basename(file, path.extname(file));
  const push = process.argv[4] === 'push';
  if (!file || !existsSync(file)) { console.log('uso: mold-from-step.cjs <archivo.stp> "<nombre>" [push]'); process.exit(1); }
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);

  const t0 = Date.now();
  const shape = K.importSTEP(oc, readFileSync(file, 'utf8'));
  const vol = K.volume(oc, shape);
  const area = K.surfaceArea(oc, shape);
  const m = K.tessellate(oc, shape, 0.5, 0.6);
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], m.positions[i + k]); mx[k] = Math.max(mx[k], m.positions[i + k]);
  }
  const size = mx.map((v, k) => +(v - mn[k]).toFixed(1)).sort((a, b) => b - a);   // L≥W≥H
  // pared estimada de cascarón: t ≈ 2·V/A (placa delgada), acotada a lo moldeable
  const wall = Math.min(4, Math.max(1, +(2 * vol / area).toFixed(2)));
  console.log(`pieza: ${name}`);
  console.log(`  bbox ${size[0]}×${size[1]}×${size[2]} mm · vol ${(vol / 1000).toFixed(1)} cm³ · sup ${(area / 100).toFixed(0)} cm² · pared est ${wall} mm · ${m.triangleCount} △ · ${Date.now() - t0} ms`);
  const spec = {
    name, Lmm: size[0], Wmm: size[1], Hmm: size[2],
    surfaceMm2: Math.round(area), volumeMm3: Math.round(vol), wallMm: wall,
    annualVolume: 500000, plastic: 'ABS', finish: 'SPI B-3',
  };
  console.log('  MachineSpec:', JSON.stringify(spec));

  // ── permutar ejes: mayor→X (igual que el spec Lmm≥Wmm≥Hmm), con QUIRALIDAD
  // corregida (permutación impropia espejea la pieza → negar Y) y min en 0.
  const ext2 = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const order = [0, 1, 2].sort((a, b) => ext2[b] - ext2[a]);
  const perm = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (order[r] === c ? 1 : 0)));
  const det = perm[0][0] * (perm[1][1] * perm[2][2] - perm[1][2] * perm[2][1]) - perm[0][1] * (perm[1][0] * perm[2][2] - perm[1][2] * perm[2][0]) + perm[0][2] * (perm[1][0] * perm[2][1] - perm[1][1] * perm[2][0]);
  const sy = det < 0 ? -1 : 1;
  const py0 = sy > 0 ? mn[order[1]] : -mx[order[1]];
  const P2 = new Float32Array(m.positions.length);
  for (let i = 0; i < m.positions.length; i += 3) {
    P2[i] = m.positions[i + order[0]] - mn[order[0]];
    P2[i + 1] = sy * m.positions[i + order[1]] - py0;
    P2[i + 2] = m.positions[i + order[2]] - mn[order[2]];
  }
  const I2 = new Uint32Array(m.indices);

  // ── VEREDICTO KAZMER (§2.3, medido) + AUTO-VOLTEO §11 (pieza abraza el núcleo B)
  let dfmMesh = null;
  try {
    const DFM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'dfm-mesh.ts'));
    let r = DFM.dfmFromMesh({ positions: P2, indices: I2 }, { wallMm: wall, resin: spec.plastic, finish: spec.finish?.replace(/^SPI /, '') });
    if (r.orient.flipRecommended) {
      const WYf = ext2[order[1]], HZf = ext2[order[2]];
      for (let i = 0; i < P2.length; i += 3) { P2[i + 1] = WYf - P2[i + 1]; P2[i + 2] = HZf - P2[i + 2]; }
      console.log(`  orientación: VOLTEADA (relieve núcleo ${r.orient.coreReliefAsIsMm} → ${r.orient.coreReliefFlippedMm} mm/col — la pieza abraza el núcleo B, §11)`);
      r = DFM.dfmFromMesh({ positions: P2, indices: I2 }, { wallMm: wall, resin: spec.plastic, finish: spec.finish?.replace(/^SPI /, '') });
    } else {
      console.log(`  orientación: tal cual (relieve núcleo ${r.orient.coreReliefAsIsMm} vs volteada ${r.orient.coreReliefFlippedMm} mm/col)`);
    }
    dfmMesh = r;
    const label = r.moldable === 'si' ? '✓ MOLDEABLE (dos placas)'
      : r.moldable === 'con-mecanismos' ? '⚠ MOLDEABLE CON MECANISMOS (side-action/lifter §11.3)'
      : '✗ NO MOLDEABLE por inyección';
    console.log(`  VEREDICTO KAZMER: ${label}`);
    for (const v of r.verdicts) console.log(`   ${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} [${v.ref}]`);
  } catch (e) { console.log('  (veredicto DFM no disponible:', String(e).slice(0, 80), ')'); }

  // el raster de dfm-mesh alimenta los contratos: §5.5.3 (tonelaje sobre área REAL,
  // descontando ventanas) y §10.3.1 (topología de alabeo marco/placa)
  if (dfmMesh) {
    spec.projectedAreaMm2 = dfmMesh.projectedAreaMm2;
    spec.warpageTopology = dfmMesh.warpageTopology;
  }

  if (push) {
    // manda TAMBIÉN la malla teselada (los insertos se tallan con la pieza real)
    const ATLAS = 'ian@100.97.118.117', DIST = '/mnt/hdd/forja-dist';
    const meshJson = JSON.stringify({
      positions: Buffer.from(P2.buffer).toString('base64'),
      indices: Buffer.from(I2.buffer).toString('base64'),
    });
    writeFileSync('/tmp/mold-live-mesh.json', meshJson);
    execSync(`scp -q /tmp/mold-live-mesh.json ${ATLAS}:${DIST}/mold-live-mesh.json`);
    const rev = Math.floor(Date.now() / 1000);
    const live = JSON.stringify({
      rev, by: 'Claude (remoto)', spec, partMeshUrl: '/mold-live-mesh.json',
      dfmMesh: dfmMesh ? { moldable: dfmMesh.moldable, verdicts: dfmMesh.verdicts, undercut: dfmMesh.undercut, draft: dfmMesh.draft, wall: dfmMesh.wall } : undefined,
    });
    execSync(`echo '${live.replace(/'/g, "'\\''")}' | ssh -o ConnectTimeout=10 ${ATLAS} "cat > ${DIST}/mold-live.json"`);
    console.log(`✓ live rev=${rev} con malla real (${(meshJson.length / 1024).toFixed(0)} KB)${dfmMesh ? ' + veredicto DFM' : ''}`);
  }
})().catch((e) => { console.error('FATAL', String(e?.stack || e).slice(0, 400)); process.exit(1); });
