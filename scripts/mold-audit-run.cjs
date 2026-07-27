/**
 * CORRE EL AUDITOR sobre una pieza: preset del libro (bezel/cup/...) o un STL real.
 * Construye el molde en node, corre auditMold, imprime hallazgos rankeados y escribe
 * un capture-plan.json (qué aislar + qué vista) para el shot script.
 * Uso: node --import tsx scripts/mold-audit-run.cjs <preset|archivo.stl> [nombre]
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

const PRESETS = {
  bezel: {
    name: 'Bezel', code: 'MLD-BEZEL', widthMm: 381,
    plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
    cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
    cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 }, ejectors: { type: 'pin', diaMm: 3, count: 20 },
    core: { widthMm: 240, material: 'AISI P20' }, cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)',
    clampTons: 200, feed: 'hot-runner', sideAction: { aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }, nCav: 1,
  },
};

function parseBinSTL(file) {
  const buf = readFileSync(file);
  const isAscii = buf.slice(0, 5).toString() === 'solid' && buf.length < 84 + buf.readUInt32LE(80) * 50;
  const tris = [];
  if (!isAscii) {
    const n = buf.readUInt32LE(80);
    for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12;
      tris.push([[buf.readFloatLE(o), buf.readFloatLE(o+4), buf.readFloatLE(o+8)], [buf.readFloatLE(o+12), buf.readFloatLE(o+16), buf.readFloatLE(o+20)], [buf.readFloatLE(o+24), buf.readFloatLE(o+28), buf.readFloatLE(o+32)]]); }
  } else {
    const nums = buf.toString().match(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g) || [];
    for (let i = 0; i + 2 < nums.length; i += 3) { const v = (s) => s.match(/[-\d.eE+]+/g).map(Number); tris.push([v(nums[i]), v(nums[i+1]), v(nums[i+2])]); }
  }
  return tris;
}

(async () => {
  const arg = process.argv[2], nameArg = process.argv[3];
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const DA = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'draw-axis.ts'));
  const AU = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-audit.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);

  let spec, partMesh = undefined, name;
  if (PRESETS[arg]) { spec = PRESETS[arg]; name = arg; }
  else if (existsSync(arg)) {
    name = nameArg || path.basename(arg, path.extname(arg));
    const tris = parseBinSTL(arg);
    let vol = 0, area = 0; const mn = [1e18,1e18,1e18], mx = [-1e18,-1e18,-1e18];
    const fullPos = new Float32Array(tris.length * 9), fullIdx = new Uint32Array(tris.length * 3);
    tris.forEach((t, i) => t.forEach((p, v) => { fullPos[i*9+v*3]=p[0]; fullPos[i*9+v*3+1]=p[1]; fullPos[i*9+v*3+2]=p[2]; fullIdx[i*3+v]=i*3+v;
      for (let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[k]);mx[k]=Math.max(mx[k],p[k]);} }));
    for (const [a,b,c] of tris) { vol += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2]; area+=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)/2; }
    vol = Math.abs(vol); const wall = Math.min(4, Math.max(1, +(2*vol/area).toFixed(2)));
    const choice = DA.pickDrawAxis({ positions: fullPos, indices: fullIdx }, { wallMm: wall });
    let P3 = choice.oriented.positions, mxo = [0,0,0];
    for (let i=0;i<P3.length;i+=3) for (let k=0;k<3;k++) mxo[k]=Math.max(mxo[k],P3[i+k]);
    if (choice.dfm.orient.flipRecommended) { const fl = new Float32Array(P3.length); for (let i=0;i<P3.length;i+=3){fl[i]=P3[i];fl[i+1]=mxo[1]-P3[i+1];fl[i+2]=mxo[2]-P3[i+2];} P3=fl; }
    partMesh = { positions: P3, indices: fullIdx };
    const ms = { name, Lmm:+mxo[0].toFixed(1), Wmm:+mxo[1].toFixed(1), Hmm:+mxo[2].toFixed(1), surfaceMm2:Math.round(area), volumeMm3:Math.round(vol), wallMm:wall, annualVolume:500000, plastic:'ABS', finish:'SPI B-3' };
    spec = PS.packageToAssemblySpec(MM.moldMachine(ms));
  } else { console.error('uso: mold-audit-run.cjs <preset|archivo.stl> [nombre]'); process.exit(1); }

  const parts = PS.buildMoldParts(K, oc, spec, 'blocks', partMesh);
  const findings = AU.auditMold(parts, spec);
  const crit = findings.filter((f) => f.sev === 'CRÍTICO').length, warn = findings.filter((f) => f.sev === 'ADVERTENCIA').length;
  console.log(`\n═══ AUDITORÍA: ${name} (${parts.length} componentes) ═══`);
  console.log(`  ${crit} CRÍTICOS · ${warn} advertencias\n`);
  for (const f of findings) console.log(`  ${f.sev === 'CRÍTICO' ? '🔴' : f.sev === 'ADVERTENCIA' ? '🟡' : 'ℹ️'} [${f.check}] ${f.role}: ${f.detail}`);
  if (!findings.length) console.log('  ✓ sin hallazgos');

  const plan = findings.filter((f) => f.camera).map((f, i) => ({ id: `${String(i).padStart(2,'0')}-${f.check}`, ...f.camera, label: `${f.role}: ${f.detail.slice(0, 60)}` }));
  writeFileSync('/tmp/mold-audit-plan.json', JSON.stringify({ name, spec: { widthMm: spec.widthMm, nCav: spec.nCav }, plan }, null, 2));
  console.log(`\ncapture-plan: ${plan.length} tomas → /tmp/mold-audit-plan.json`);
  process.exit(0);
})().catch((e) => { console.error('AUDIT_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
