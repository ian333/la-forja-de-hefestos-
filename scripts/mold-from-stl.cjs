/**
 * AUTOMATIZAR EL MOLDE desde un STL REAL (binario o ASCII):
 *   parsea la malla → MIDE (bbox, volumen por divergencia, superficie, pared ≈ 2V/A)
 *   → MachineSpec → push a la sesión viva. Sin OCCT: pura malla (rápido, robusto).
 * Uso: node scripts/mold-from-stl.cjs <archivo.stl> "<nombre>" [push] [--scale N]
 */
const { readFileSync } = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function parseSTL(buf) {
  // binario: 80 header + uint32 nTris + 50 bytes/tri; ASCII empieza con "solid" Y es texto
  const isAscii = buf.slice(0, 5).toString() === 'solid' && buf.length < 84 + buf.readUInt32LE(80) * 50;
  const tris = [];
  if (!isAscii) {
    const n = buf.readUInt32LE(80);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;   // salta la normal
      tris.push([
        [buf.readFloatLE(o), buf.readFloatLE(o + 4), buf.readFloatLE(o + 8)],
        [buf.readFloatLE(o + 12), buf.readFloatLE(o + 16), buf.readFloatLE(o + 20)],
        [buf.readFloatLE(o + 24), buf.readFloatLE(o + 28), buf.readFloatLE(o + 32)],
      ]);
    }
  } else {
    const nums = buf.toString().match(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g) || [];
    for (let i = 0; i + 2 < nums.length; i += 3) {
      const v = (s) => s.match(/[-\d.eE+]+/g).map(Number);
      tris.push([v(nums[i]), v(nums[i + 1]), v(nums[i + 2])]);
    }
  }
  return tris;
}

const file = process.argv[2], name = process.argv[3] || path.basename(file, '.stl');
const push = process.argv.includes('push');
const scaleIdx = process.argv.indexOf('--scale');
const scale = scaleIdx > 0 ? Number(process.argv[scaleIdx + 1]) : 1;
const tris = parseSTL(readFileSync(file));
let vol = 0, area = 0;
const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
for (const [a, b, c] of tris) {
  for (const p of [a, b, c]) for (let k = 0; k < 3; k++) {
    const v = p[k] * scale;
    if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  const ax = a[0] * scale, ay = a[1] * scale, az = a[2] * scale;
  const bx = b[0] * scale, by = b[1] * scale, bz = b[2] * scale;
  const cx = c[0] * scale, cy = c[1] * scale, cz = c[2] * scale;
  // divergencia: V += (a · (b × c)) / 6  (malla cerrada)
  vol += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
}
vol = Math.abs(vol);
const size = mx.map((v, k) => +(v - mn[k]).toFixed(1)).sort((a, b) => b - a);
const wall = Math.min(4, Math.max(1, +(2 * vol / area).toFixed(2)));
console.log(`pieza: ${name} (${tris.length.toLocaleString()} triángulos${scale !== 1 ? ` · escala ×${scale}` : ''})`);
console.log(`  bbox ${size[0]}×${size[1]}×${size[2]} mm · vol ${(vol / 1000).toFixed(1)} cm³ · sup ${(area / 100).toFixed(0)} cm² · pared est ${wall} mm`);
(async () => {
  // ── malla COMPLETA (escalada) para el análisis y la elección de eje ──
  const fullPos = new Float32Array(tris.length * 9);
  const fullIdx = new Uint32Array(tris.length * 3);
  tris.forEach((tri, t) => tri.forEach((pt, v) => {
    fullPos[t * 9 + v * 3] = pt[0] * scale;
    fullPos[t * 9 + v * 3 + 1] = pt[1] * scale;
    fullPos[t * 9 + v * 3 + 2] = pt[2] * scale;
    fullIdx[t * 3 + v] = t * 3 + v;
  }));

  // ── LA MÁQUINA ELIGE LA DIRECCIÓN DE APERTURA (prueba los 3 ejes; ver
  // draw-axis.ts): sellado ✗ → menos undercut → menos área sin draft. La regla
  // vieja "eje menor = profundidad" ACOSTABA embudos y vasos.
  let DA, DFM;
  try {
    DA = await import('/home/ian/Orkesta/la-forja/src/forja/mold/draw-axis.ts');
    DFM = await import('/home/ian/Orkesta/la-forja/src/forja/mold/dfm-mesh.ts');
  } catch {
    console.error('✗ corre con `node --import tsx scripts/mold-from-stl.cjs …` (elección de eje + veredicto)');
    process.exit(1);
  }
  const choice = DA.pickDrawAxis({ positions: fullPos, indices: fullIdx }, { wallMm: wall });
  for (const c of choice.candidates)
    console.log(`  eje ${'LWH'[c.zAxis]}: undercut ${c.underVol} mm³ · sin-draft ${c.draftPct}%${c.enclosed ? ' · SELLADO' : ''}${c.zAxis === choice.oriented.zAxis ? '   ← ELEGIDO' : ''}`);

  // ── AUTO-VOLTEO §11 (la pieza abraza el núcleo B) sobre la malla orientada ──
  let P3 = choice.oriented.positions;
  let dfmMesh = choice.dfm;
  let mxo = [0, 0, 0];
  for (let i = 0; i < P3.length; i += 3) for (let k = 0; k < 3; k++) mxo[k] = Math.max(mxo[k], P3[i + k]);
  if (choice.dfm.orient.flipRecommended) {
    const flipped = new Float32Array(P3.length);
    for (let i = 0; i < P3.length; i += 3) {
      flipped[i] = P3[i];
      flipped[i + 1] = mxo[1] - P3[i + 1];
      flipped[i + 2] = mxo[2] - P3[i + 2];
    }
    P3 = flipped;
    dfmMesh = DFM.dfmFromMesh({ positions: P3, indices: fullIdx }, { wallMm: wall });
    console.log(`  orientación: VOLTEADA (relieve núcleo ${choice.dfm.orient.coreReliefAsIsMm} → ${choice.dfm.orient.coreReliefFlippedMm} mm/col — abraza el núcleo B, §11)`);
  } else {
    console.log(`  orientación: tal cual (relieve núcleo ${choice.dfm.orient.coreReliefAsIsMm} vs volteada ${choice.dfm.orient.coreReliefFlippedMm} mm/col)`);
  }

  // ── spec con las dimensiones ORIENTADAS (L=x, W=y, H=z de apertura) ──
  const spec = {
    name, Lmm: +mxo[0].toFixed(1), Wmm: +mxo[1].toFixed(1), Hmm: +mxo[2].toFixed(1),
    surfaceMm2: Math.round(area), volumeMm3: Math.round(vol), wallMm: wall,
    annualVolume: 500000, plastic: 'ABS', finish: 'SPI B-3',
  };
  console.log('  MachineSpec:', JSON.stringify(spec));

  // ── DECIMAR la malla orientada (clustering ~150 celdas) para el molde vivo ──
  const cellD = Math.max(mxo[0], mxo[1], mxo[2]) / 150;
  const vmap = new Map(); const P = []; const I = [];
  for (let t = 0; t < fullIdx.length; t += 3) {
    const ids = [0, 1, 2].map((v) => {
      const o = (t + v) * 3;
      const k = `${Math.round(P3[o] / cellD)},${Math.round(P3[o + 1] / cellD)},${Math.round(P3[o + 2] / cellD)}`;
      if (!vmap.has(k)) { vmap.set(k, P.length / 3); P.push(P3[o], P3[o + 1], P3[o + 2]); }
      return vmap.get(k);
    });
    if (ids[0] !== ids[1] && ids[1] !== ids[2] && ids[0] !== ids[2]) I.push(ids[0], ids[1], ids[2]);
  }
  console.log(`  malla decimada: ${(P.length / 3).toLocaleString()} vértices · ${(I.length / 3).toLocaleString()} tris`);
  const meshJson = JSON.stringify({
    positions: Buffer.from(new Float32Array(P).buffer).toString('base64'),
    indices: Buffer.from(new Uint32Array(I).buffer).toString('base64'),
  });

  const label = dfmMesh.moldable === 'si' ? '✓ MOLDEABLE (dos placas)'
    : dfmMesh.moldable === 'con-mecanismos' ? '⚠ MOLDEABLE CON MECANISMOS (side-action/lifter §11.3)'
    : '✗ NO MOLDEABLE por inyección';
  console.log(`  VEREDICTO KAZMER: ${label}`);
  for (const v of dfmMesh.verdicts) console.log(`   ${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} [${v.ref}]`);

  if (push) {
    const ATLAS = 'ian@100.97.118.117', DIST = '/mnt/hdd/forja-dist';
    const rev = Math.floor(Date.now() / 1000);
    const { writeFileSync } = require('fs');
    writeFileSync('/tmp/mold-live-mesh.json', meshJson);
    execSync(`scp -q /tmp/mold-live-mesh.json ${ATLAS}:${DIST}/mold-live-mesh.json`);
    const live = JSON.stringify({
      rev, by: 'Claude (remoto)', spec, partMeshUrl: '/mold-live-mesh.json',
      dfmMesh: { moldable: dfmMesh.moldable, verdicts: dfmMesh.verdicts, undercut: dfmMesh.undercut, draft: dfmMesh.draft, wall: dfmMesh.wall },
    });
    execSync(`echo '${live.replace(/'/g, "'\\''")}' | ssh -o ConnectTimeout=10 ${ATLAS} "cat > ${DIST}/mold-live.json"`);
    console.log(`✓ live rev=${rev} con MALLA REAL (${(meshJson.length / 1024).toFixed(0)} KB) + veredicto DFM → La Forja arma el molde`);
  }
})();
