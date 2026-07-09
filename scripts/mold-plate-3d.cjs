/**
 * PLACA EN 3D REAL — construye una placa del molde como SÓLIDO B-Rep (con TODAS
 * sus cavidades, canales de agua REALES barrenados y barrenos de expulsor) y la
 * saca en STEP + STL (para abrir y ROTAR en cualquier visor 3D) + un render
 * isométrico translúcido (para verla aquí). NO es un dibujo: es el sólido.
 *
 * Cliente por defecto: LEGO (16 cav, colada caliente). Placas B (núcleo) y A.
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { chromium } = require('playwright');

const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

// pieza LEGO (misma que el cliente): sólido del kernel → medición → MachineSpec
function buildLegoPart(K, oc) {
  let b = K.makeBox(oc, 31.8, 15.8, 9.6);
  const fs = K.enumerateFaces(oc, b); let bot = 0, mz = 1e9; fs.forEach((f, i) => { if (f.centroid && f.centroid[2] < mz) { mz = f.centroid[2]; bot = i; } });
  b = K.shellSolid(oc, b, 1.5, [bot]);
  for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 2; iy++) { try { b = K.fuse(oc, b, K.makeCylinder(oc, 2.4, 1.8, { origin: [3.9 + ix * 8, 3.9 + iy * 8, 9.6], dir: [0, 0, 1] })); } catch {} }
  return b;
}

function binarySTL(mesh) {
  const nTri = mesh.indices.length / 3, P = mesh.positions;
  const buf = Buffer.alloc(84 + nTri * 50);
  buf.write('La Forja - mold plate (real B-Rep)', 0);
  buf.writeUInt32LE(nTri, 80);
  let off = 84;
  for (let t = 0; t < nTri; t++) {
    const a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    buf.writeFloatLE(nx / l, off); buf.writeFloatLE(ny / l, off + 4); buf.writeFloatLE(nz / l, off + 8); off += 12;
    for (const i of [a, b, c]) { buf.writeFloatLE(P[i], off); buf.writeFloatLE(P[i + 1], off + 4); buf.writeFloatLE(P[i + 2], off + 8); off += 12; }
    buf.writeUInt16LE(0, off); off += 2;
  }
  return buf;
}

(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  const ISO = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'isoview.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const outDir = process.env.OUT || '/tmp/mold-3d';
  mkdirSync(outDir, { recursive: true });

  // LEGO → MoldAssemblySpec (idéntico al PDF)
  const part = buildLegoPart(K, oc);
  const mesh0 = K.tessellate(oc, part, 0.15, 0.4);
  let mnx = 1e9, mny = 1e9, mnz = 1e9, mxx = -1e9, mxy = -1e9, mxz = -1e9;
  for (let i = 0; i < mesh0.positions.length; i += 3) { mnx = Math.min(mnx, mesh0.positions[i]); mxx = Math.max(mxx, mesh0.positions[i]); mny = Math.min(mny, mesh0.positions[i + 1]); mxy = Math.max(mxy, mesh0.positions[i + 1]); mnz = Math.min(mnz, mesh0.positions[i + 2]); mxz = Math.max(mxz, mesh0.positions[i + 2]); }
  const spec = { name: 'Ladrillo LEGO 2×4', Lmm: +(mxx - mnx).toFixed(1), Wmm: +(mxy - mny).toFixed(1), Hmm: +(mxz - mnz).toFixed(1), surfaceMm2: Math.round(K.surfaceArea(oc, part)), volumeMm3: Math.round(K.volume(oc, part)), wallMm: 1.5, annualVolume: 20_000_000, plastic: 'ABS', finish: 'SPI A-3', feedPref: 'hot-runner' };
  const aspec = PS.packageToAssemblySpec(MM.moldMachine(spec));
  console.log(`LEGO: molde ${aspec.feed} × ${aspec.nCav} cav · base ${aspec.widthMm} mm`);

  const browser = await chromium.launch({ args: ['--no-sandbox', '--headless=new'] });
  const ctx = await browser.newContext({ viewport: { width: 2000, height: 1500 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const role of ['B', 'A']) {
    const def = DS.plateDefs(aspec).find((d) => d.role === role);
    const t0 = Date.now();
    const { solid, drilled, holes } = PS.buildPlateSolid(K, oc, aspec, def);
    const mesh = K.tessellate(oc, solid, 0.25, 0.5);
    console.log(`  Placa ${role}: ${drilled}/${holes} barrenos + cavidades + canales · ${mesh.triangleCount} tri · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    // STEP (B-Rep exacto) + STL (malla) — ambos abren en cualquier visor 3D
    const step = K.exportSTEP(oc, solid);
    writeFileSync(path.join(outDir, `lego-placa-${role}.step`), step);
    writeFileSync(path.join(outDir, `lego-placa-${role}.stl`), binarySTL(mesh));
    // render isométrico TRANSLÚCIDO (se ven los canales de agua adentro)
    const edges = K.enumerateEdgesGeom(oc, solid).map((e) => ({ polyline: e.polyline, kind: e.kind }));
    const svg = ISO.isoView(mesh.positions, mesh.indices, mesh.normals, edges,
      { name: `LEGO · Placa ${role} (real 3D)`, code: aspec.code, material: role === 'B' ? aspec.cavityMetal : aspec.cavityMetal },
      { color: [150, 165, 185], opacity: 0.55, edgeColor: '#122233' });
    await page.setContent('<body style="margin:0;background:#fff">' + svg + '</body>');
    await page.waitForTimeout(120);
    const el = await page.$('svg');
    writeFileSync(path.join(outDir, `lego-placa-${role}-3d.png`), await el.screenshot());
  }
  await browser.close();
  console.log('PLATE_3D_OK →', outDir);
})().catch((e) => { console.log('FATAL', String(e.stack || e).slice(0, 500)); process.exit(1); });
