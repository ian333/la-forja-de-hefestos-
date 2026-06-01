/**
 * probe-edge-geom.cjs — verifica que enumerateEdgesGeom discretiza aristas a
 * polilíneas y detecta rectas (point+dir) para usarlas de eje. CPU/WASM (sin GPU).
 *   node --import tsx scripts/probe-edge-geom.cjs
 */
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
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);

  // Caja 10×6×4 → 12 aristas rectas.
  const box = occt.makeBox(oc, 10, 6, 4);
  const geom = occt.enumerateEdgesGeom(oc, box);
  const lines = geom.filter((g) => g.kind === 'line');
  const withAxis = geom.filter((g) => g.axis);
  const polyOk = geom.every((g) => Array.isArray(g.polyline) && g.polyline.length >= 2);
  // longitud de la 1ra arista por polilínea vs longitud real
  const polylen = (pl) => { let L = 0; for (let i = 1; i < pl.length; i++) { const a = pl[i-1], b = pl[i]; L += Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]); } return L; };
  const edges = occt.enumerateEdges(oc, box);
  let lenMatch = true;
  for (const g of geom) {
    const e = edges.find((x) => x.index === g.edgeId);
    if (Math.abs(polylen(g.polyline) - e.length) > 1e-6) lenMatch = false;
  }
  // índices alineados con enumerateEdges
  const idAligned = geom.every((g, i) => g.edgeId === edges[i].index);

  // Cilindro: aristas circulares (no rectas) deben discretizarse a >2 puntos.
  const cyl = occt.makeCylinder(oc, 5, 12);
  const cgeom = occt.enumerateEdgesGeom(oc, cyl);
  const circles = cgeom.filter((g) => g.kind === 'circle');
  const circlePolyOk = circles.length === 0 || circles.every((g) => g.polyline.length > 8);

  console.log('PROBE_RESULT=' + JSON.stringify({
    box_edges: geom.length,
    box_lines: lines.length,
    box_with_axis: withAxis.length,
    poly_ok: polyOk,
    len_match: lenMatch,
    id_aligned: idAligned,
    first_axis: withAxis[0] ? { origin: withAxis[0].axis.origin, dir: withAxis[0].axis.dir } : null,
    cyl_edges: cgeom.length,
    cyl_circles: circles.length,
    circle_poly_ok: circlePolyOk,
    sample_polyline: geom[0].polyline,
  }, null, 2));
  process.exit(0);
})().catch((e) => { console.log('PROBE_FATAL=' + String(e && e.stack || e)); process.exit(1); });
