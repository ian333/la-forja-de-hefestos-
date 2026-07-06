/**
 * EXPORTA EL MOLDE COMPLETO POR COMPONENTES para la animación del CICLO:
 * cada parte (placas, pieza, eyectores, pilares) como malla independiente
 * con su ROL cinemático + los TIEMPOS REALES del análisis Kazmer.
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const mold = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
  const cool = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const box = (w, d, h, x, y, z) => occt.transformShape(oc, occt.makeBox(oc, w, d, h), { translate: [x - w / 2, y - d / 2, z] });
  const cylZ = (r, h, x, y, z) => occt.transformShape(oc, occt.makeCylinder(oc, r, h, { origin: [0, 0, 0], dir: [0, 0, 1] }), { translate: [x, y, z] });
  const ring = (n, ro, ri) => ({
    outer: Array.from({length: n}, (_, k) => ({ x: ro*Math.cos(2*Math.PI*k/n), y: ro*Math.sin(2*Math.PI*k/n) })),
    inner: Array.from({length: n}, (_, k) => ({ x: ri*Math.cos(2*Math.PI*k/n), y: ri*Math.sin(2*Math.PI*k/n) })),
  });

  // ── EL CUP (family mold) + su molde completo, todo como componentes ──
  const { outer, inner } = ring(48, 30, 27);
  let cup = occt.extrudePolygonWithHoles(oc, outer, [inner], 70, occt.PLANE_XY);
  cup = occt.fuse(oc, cup, occt.extrudePolygon(oc, outer, 3, occt.PLANE_XY));
  const m = mold.splitMold(oc, cup, { scale: 1.005, pinch: 0.5, plateThickness: 30, margin: 40, coreSide: 'above' });
  const tC = cool.coolingTimePlate(0.003, cool.ABS_KAZMER);
  const bb = mold.shapeBBox(oc, m.cavityPlate);
  const W = bb.max[0] - bb.min[0], D = bb.max[1] - bb.min[1];
  const zPart = m.zPart;
  // stack: [rear 20][rails 60 + ejector plates DENTRO][support 25][CAVITY][CORE][top 20]
  const zCavBot = bb.min[2];
  const comps = [];
  const add = (name, shape, role, color) => comps.push({ name, shape, role, color });
  add('pieza', occt.transformShape(oc, cup, { translate: [0, 0, 0] }), 'part', '#3aa0ff');
  add('cavity-plate', m.cavityPlate, 'fixed', '#8fa3bd');
  add('core-plate', m.corePlate, 'moving', '#aab8cc');           // el core+placa sube al abrir
  add('top-clamp', box(W, D, 20, 0, 0, zPart + 30), 'moving', '#7c8ba0');
  add('support', box(W, D, 25, 0, 0, zCavBot - 25), 'fixed', '#7c8ba0');
  add('rail-izq', box(40, D, 60, -(W / 2 - 20), 0, zCavBot - 85), 'fixed', '#6b7a8f');
  add('rail-der', box(40, D, 60, (W / 2 - 20), 0, zCavBot - 85), 'fixed', '#6b7a8f');
  add('ejector-plate', box(W - 100, D - 30, 10, 0, 0, zCavBot - 70), 'ejector', '#c9a227');
  add('ejector-retainer', box(W - 100, D - 30, 14, 0, 0, zCavBot - 60), 'ejector', '#c9a227');
  add('rear-clamp', box(W, D, 20, 0, 0, zCavBot - 105), 'fixed', '#7c8ba0');
  // 4 pines eyectores (suben con el ejector: empujan el LABIO del cup)
  for (const [i, a] of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].entries())
    add(`pin-${i}`, cylZ(2.5, zCavBot - (zCavBot - 60) + 62, 28.5 * Math.cos(a), 28.5 * Math.sin(a), zCavBot - 60), 'ejector', '#e0b840');
  // 4 pilares guía (fijos, del support al top)
  for (const [i, s] of [[-1, -1], [1, -1], [-1, 1], [1, 1]].entries())
    add(`pilar-${i}`, cylZ(10, zPart - zCavBot + 55, s[0] * (W / 2 - 22), s[1] * (D / 2 - 22), zCavBot - 25), 'fixed', '#9fb0c4');
  // sprue por el top (por donde INYECTA)
  add('sprue-bushing', cylZ(8, 26, 0, 0, zPart + 24), 'moving', '#d08040');

  const out = { params: {
    tCoolS: +tC.toFixed(2), tFillS: 0.6, openStrokeMm: 90, ejectStrokeMm: 45, zPart: +zPart.toFixed(3),
  }, components: [] };
  for (const c of comps) {
    const mesh = occt.tessellate(oc, c.shape, 0.45, 0.4);
    out.components.push({ name: c.name, role: c.role, color: c.color,
      positions: Array.from(mesh.positions), indices: Array.from(mesh.indices) });
  }
  mkdirSync('/tmp/mold-cycle', { recursive: true });
  writeFileSync('/tmp/mold-cycle/mold.json', JSON.stringify(out));
  console.log('EXPORT_OK', out.components.length, 'componentes · t_c', tC.toFixed(1), 's · MB:', (JSON.stringify(out).length / 1e6).toFixed(1));
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
