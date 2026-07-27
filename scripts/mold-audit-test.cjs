/**
 * GATE del AUDITOR: construye el molde de varias piezas y exige CERO hallazgos
 * CRÍTICOS. Caza regresiones geométricas (colada asomándose, pin que no alcanza,
 * agua fuera de placa, insertos que se cruzan). Uso: node --import tsx scripts/mold-audit-test.cjs
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

const bezel = {
  name: 'Bezel', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
  clampTons: 200, feed: 'hot-runner', sideAction: { aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }, nCav: 1,
};

function parseBinSTL(file) {
  const buf = readFileSync(file); const n = buf.readUInt32LE(80);
  const pos = new Float32Array(n * 9), idx = new Uint32Array(n * 3);
  for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12; for (let v = 0; v < 9; v++) pos[i*9+v] = buf.readFloatLE(o + v*4); idx[i*3]=i*3; idx[i*3+1]=i*3+1; idx[i*3+2]=i*3+2; }
  return { positions: pos, indices: idx };
}

(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const DA = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'draw-axis.ts'));
  const AU = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-audit.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  let fails = 0;

  const cases = [{ name: 'bezel', spec: bezel, mesh: undefined }];
  for (const [file, nm] of [['test-parts/rpi4-bottom.stl', 'carcasa RPi4'], ['test-parts/funnel-130.stl', 'embudo'], ['test-parts/3dbenchy.stl', 'benchy']]) {
    const f = path.resolve(__dirname, '..', file); if (!existsSync(f)) continue;
    const m = parseBinSTL(f);
    const choice = DA.pickDrawAxis(m); let P3 = choice.oriented.positions, mxo = [0,0,0];
    for (let i=0;i<P3.length;i+=3) for (let k=0;k<3;k++) mxo[k]=Math.max(mxo[k],P3[i+k]);
    if (choice.dfm.orient.flipRecommended) { const fl=new Float32Array(P3.length); for(let i=0;i<P3.length;i+=3){fl[i]=P3[i];fl[i+1]=mxo[1]-P3[i+1];fl[i+2]=mxo[2]-P3[i+2];} P3=fl; }
    const wall = 2; // aprox; la moldeabilidad no cambia la geometría del molde
    const ms = { name: nm, Lmm:+mxo[0].toFixed(1), Wmm:+mxo[1].toFixed(1), Hmm:+mxo[2].toFixed(1), surfaceMm2: 10000, volumeMm3: 20000, wallMm: wall, annualVolume: 500000, plastic: 'ABS', finish: 'SPI B-3' };
    cases.push({ name: nm, spec: PS.packageToAssemblySpec(MM.moldMachine(ms)), mesh: { positions: P3, indices: m.indices } });
  }

  for (const c of cases) {
    const parts = PS.buildMoldParts(K, oc, c.spec, 'blocks', c.mesh);
    const findings = AU.auditMold(parts, c.spec);
    const crit = findings.filter((f) => f.sev === 'CRÍTICO');
    console.log(`\n[${c.name}] ${parts.length} comp · ${crit.length} CRÍTICOS · ${findings.length - crit.length} adv`);
    for (const f of crit) console.log(`   🔴 [${f.check}] ${f.role}: ${f.detail}`);
    if (crit.length) fails++;
  }

  // ── CHECK ESPECÍFICO de coordenadas: ningún tornillo cruza la partición ──
  const CO = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-coords.ts'));
  const ca = CO.coordAudit(bezel);
  const crossParting = ca.findings.filter((f) => /particion|bore-continuo|colineal/.test(f.check));
  console.log(`\n[coords bezel] tornillos ${ca.screws.cavityHalf}cav+${ca.screws.coreHalf}nuc · ${ca.screws.perScrewKN}kN/tornillo (cap ${ca.screws.capKN}) · ${crossParting.length} choques de eje`);
  if (crossParting.length) { for (const f of crossParting) console.log(`   🔴 ${f.detail}`); fails++; }

  console.log(fails ? `\n❌ ${fails} problemas` : '\n✓ AUDITOR: cero críticos + tornillos no cruzan la partición (reparto de carga §12.4)');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
