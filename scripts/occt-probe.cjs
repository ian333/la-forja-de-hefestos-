// OCCT STEP roundtrip + fillet probe (CJS).
const { readFileSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

function T(name, fn) { try { const r = fn(); console.log(`OK   ${name}` + (r !== undefined ? ' => ' + r : '')); return r; } catch (e) { console.log(`ERR  ${name}: ${String(e).slice(0,120)}`); return null; } }
function vol(oc, shape) { const g = new oc.GProp_GProps_1(); oc.BRepGProp.VolumeProperties_1(shape, g, false, false, false); return g.Mass(); }

(async () => {
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });

  const box = new oc.BRepPrimAPI_MakeBox_1(50, 30, 20).Shape();

  // STEP write to MEMFS, read back
  const w = T('Writer.Transfer', () => { const ww = new oc.STEPControl_Writer_1(); ww.Transfer(box, oc.STEPControl_StepModelType.STEPControl_AsIs, true); return ww; });
  // Write to a virtual path then read it
  T('Write to /tmp.step', () => { return w.Write('/box.step').value !== undefined ? 'ok' : w.Write('/box.step'); });
  const bytes = T('FS.readFile', () => { const b = oc.FS.readFile('/box.step'); return 'len=' + b.length; });

  // Reader
  const rd = new oc.STEPControl_Reader_1();
  T('ReadFile', () => rd.ReadFile('/box.step').value);
  T('TransferRoots', () => rd.TransferRoots(new oc.Message_ProgressRange_1 ? undefined : undefined) );
  // try several transfer methods
  for (const m of ['TransferRoots_1','TransferRoots','TransferRoot_1','NbRootsForTransfer','OneShape']) {
    if (typeof rd[m] === 'function') console.log('reader has ' + m);
  }
  T('NbRootsForTransfer', () => rd.NbRootsForTransfer());
  T('TransferRoots()', () => rd.TransferRoots());
  const back = T('OneShape', () => rd.OneShape());
  if (back) console.log('roundtrip volume=' + vol(oc, back));

  // Fillet: pick an edge and apply radius (just confirm API shape)
  const exp = new oc.TopExp_Explorer_2(box, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  const firstEdge = exp.Current();
  console.log('fillet ctor variants: ' + Object.keys(oc).filter(k=>/^BRepFilletAPI_MakeFillet/.test(k)).join(','));
  T('MakeFillet', () => { const f = new oc.BRepFilletAPI_MakeFillet(box, oc.ChFi3d_FilletShape ? oc.ChFi3d_FilletShape.ChFi3d_Rational : undefined); f.Add_2 ? f.Add_2(2.0, oc.TopoDS.Edge_1(firstEdge)) : f.Add(2.0, oc.TopoDS.Edge_1(firstEdge)); return vol(oc, f.Shape()); });
  console.log('TopoDS.Edge variants: ' + Object.keys(oc.TopoDS).filter(k=>/Edge/.test(k)).join(','));
  console.log('ChFi3d: ' + Object.keys(oc).filter(k=>/ChFi3d_FilletShape/.test(k)).join(','));

  console.log('DONE');
})().catch((e) => { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
