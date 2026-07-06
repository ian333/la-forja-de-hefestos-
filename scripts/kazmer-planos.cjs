/**
 * PLANOS DE TALLER del molde de Kazmer — motor HLR real (drawing.ts):
 * pieza bezel + core plate + cavity plate → vistas ortogonales con líneas
 * ocultas y ⌀ detectados → SVG + PNG a Downloads.
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const draw = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'drawing.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const out = '/tmp/kazmer-mold'; mkdirSync(out, { recursive: true });
  for (const [name, file, mat] of [
    ['bezel-pieza', `${out}/bezel-pieza.step`, 'ABS'],
    ['core-plate', `${out}/bezel-core-plate.step`, 'P20'],
    ['cavity-plate', `${out}/bezel-cavity-plate.step`, 'P20'],
  ]) {
    const shape = occt.importSTEP(oc, readFileSync(file, 'utf8'));
    const mesh = occt.tessellate(oc, shape, 0.4, 0.4);
    const edges = occt.enumerateEdgesGeom(oc, shape);
    const mass = occt.massProperties(oc, shape, mat === 'ABS' ? 1.05e-6 : 7.85e-6).mass;
    const r = draw.generateDrawing(
      { positions: mesh.positions, indices: mesh.indices, edges },
      { name: `KAZMER MOLD — ${name}`, material: mat, massG: mass * 1000, units: 'mm', date: '2026-07-03' });
    writeFileSync(`${out}/plano-${name}.svg`, r.svg);
    const png = new Resvg(r.svg, { background: '#ffffff', fitTo: { mode: 'width', value: 2200 } }).render().asPng();
    writeFileSync(`${out}/plano-${name}.png`, png);
    console.log(name, '→', r.views.map((v) => `${v.label}:${v.nVisible}v/${v.nHidden}h`).join(' '), '·', r.views.reduce((s, v) => s + v.circles.length, 0), 'circulos');
  }
  console.log('PLANOS_OK');
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
