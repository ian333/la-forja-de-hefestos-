/** Estudio de convergencia del FEA: barra a tensión, refinando la malla.
 *  Debe converger a σ=F/A y δ=FL/AE conforme sube la resolución. */
const { readFileSync, writeFileSync, existsSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const factory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const fea = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'fea.ts'));
  const { MATERIAL_DATABASE } = await import(path.resolve(__dirname, '..', 'src', 'lib', 'formulas.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const E = MATERIAL_DATABASE['acero_1045'].youngsModulus;

  const L = 100, b = 20, h = 20, F = 50000;
  const box = occt.extrudePolygon(oc,
    [{ x: 0, y: 0 }, { x: L, y: 0 }, { x: L, y: b }, { x: 0, y: b }], h);
  const faces = occt.enumerateFaces(oc, box);
  const find = (axis, t) => faces.reduce((bs, fr) => {
    const d = Math.abs(fr.center[axis] - t); return !bs || d < bs.d ? { idx: fr.index, d } : bs; }, null).idx;
  const fix = find(0, 0), load = find(0, L);

  const A = (b * 1e-3) * (h * 1e-3);
  const sigma = F / A, delta = (F * (L * 1e-3)) / (A * E) * 1e3;
  console.log('analytic  sigma_MPa=' + (sigma / 1e6).toFixed(2) + '  delta_mm=' + delta.toFixed(5));

  for (const res of [12, 20, 28, 40]) {
    const t0 = Date.now();
    const r = fea.runFEA(oc, box,
      { fixedFaces: [fix], loadFaces: [load], totalForce: [F, 0, 0] },
      { material: 'acero_1045', resolution: res });
    const vmSorted = [...r.vonMisesElem].sort((a, b) => a - b);
    const vmMed = vmSorted[Math.floor(vmSorted.length / 2)];
    console.log(
      `res=${res}  tets=${r.mesh.nTets}  dof=${r.mesh.nNodes * 3}  ` +
      `vmMed_MPa=${(vmMed / 1e6).toFixed(2)}  ` +
      `dErr=${(Math.abs(vmMed - sigma) / sigma * 100).toFixed(1)}%  ` +
      `delta_mm=${r.maxDisplacement.toFixed(5)}  ` +
      `δErr=${(Math.abs(r.maxDisplacement - delta) / delta * 100).toFixed(1)}%  ` +
      `iters=${r.solver.iterations}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
})().catch((e) => { console.error('FATAL', e && e.stack ? e.stack : e); process.exit(2); });
