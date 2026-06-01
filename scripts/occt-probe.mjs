// OCCT embind symbol probe — discover exact mangled API names at runtime.
// Run on iangpu:  node /home/ian/Orkesta/la-forja/scripts/occt-probe.mjs
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const glueUrl = 'file://' + path.join(distDir, 'opencascade.wasm.js');
const factory = (await import(glueUrl)).default;
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

const oc = await factory({
  wasmBinary: wasmBin,
  locateFile: (p) => path.join(distDir, p),
});

const want = [
  'BRepPrimAPI_MakeBox', 'BRepPrimAPI_MakeCylinder',
  'BRepAlgoAPI_Cut', 'BRepAlgoAPI_Fuse', 'BRepAlgoAPI_Common',
  'BRepFilletAPI_MakeFillet', 'BRepMesh_IncrementalMesh',
  'GProp_GProps', 'BRepGProp', 'BRepGProp_Face',
  'TopExp_Explorer', 'TopExp',
  'TopAbs_ShapeEnum', 'gp_Pnt', 'gp_Ax2', 'gp_Dir', 'gp_Trsf',
  'STEPControl_Writer', 'STEPControl_Reader', 'STEPControl_StepModelType',
  'Message_ProgressRange', 'TopLoc_Location', 'BRep_Tool',
  'TopoDS', 'TopoDS_Shape', 'IFSelect_ReturnStatus', 'Interface_Static',
  'Poly_Triangulation', 'TColgp_Array1OfPnt', 'Poly_Connect',
  'TopExp_1', 'TopAbs_Orientation',
];
const keys = Object.keys(oc);
for (const base of want) {
  const matches = keys.filter((k) => k === base || k.startsWith(base + '_'));
  console.log(`${base}: ${matches.length ? matches.join(', ') : '*** MISSING ***'}`);
}
console.log('TOTAL_SYMBOLS=' + keys.length);
