/**
 * Sonda de SÍMBOLOS embind para sweep/loft (y wires). Imprime qué variantes
 * existen en ESTE build de opencascade.js (1.1.1) para no adivinar la firma.
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
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  const want = [
    'BRepOffsetAPI_ThruSections', 'BRepOffsetAPI_MakePipe', 'BRepOffsetAPI_MakePipeShell',
    'BRepBuilderAPI_MakeWire', 'BRepBuilderAPI_MakeEdge', 'BRepBuilderAPI_MakeFace',
    'GeomFill_Trihedron', 'gp_Ax2', 'TopoDS',
  ];
  for (const base of want) {
    const variants = Object.keys(oc).filter((k) => k === base || k.startsWith(base + '_'));
    console.log(`${base}: ${variants.length ? variants.join(', ') : '∅ (no expuesto)'}`);
  }
  // Métodos de instancia clave (ThruSections AddWire/CheckCompatibility/Build)
  if (oc.BRepOffsetAPI_ThruSections_1) {
    try {
      const ts = new oc.BRepOffsetAPI_ThruSections_1(true, false, 1e-6);
      const methods = ['AddWire', 'AddVertex', 'CheckCompatibility', 'Build', 'Shape', 'IsDone'];
      console.log('ThruSections methods: ' + methods.map((m) => `${m}=${typeof ts[m]}`).join(' '));
    } catch (e) { console.log('ThruSections_1 ctor error: ' + e); }
  }
  if (oc.BRepOffsetAPI_ThruSections_2) console.log('also: BRepOffsetAPI_ThruSections_2 exists');
})().catch((e) => { console.error('PROBE_FAIL', e); process.exit(1); });
