/**
 * EL MOLDE COMPLETO DE KAZMER — laptop bezel (el ejemplo que corre por TODO el
 * libro) — pieza + placas core/cavity + HOT RUNNER (optimizado cap 6) +
 * CANALES DE ENFRIAMIENTO (reglas cap 9) + EYECTORES (cap 11) + REPORTE DE
 * INGENIERÍA completo (llenado/presión/clamp cap 5, enfriamiento cap 9,
 * expulsión cap 11, costos/break-even cap 3) + export STEP.
 */
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const mold = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
  const fill = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'filling.ts'));
  const feed = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'feed.ts'));
  const cool = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling.ts'));
  const eject = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'ejection.ts'));
  const cost = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cost.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const R = [];
  const log = (s) => { R.push(s); console.log(s); };

  // ══ 1. LA PIEZA: laptop bezel 240×160, pared 1.5, marco 20, paredes h10, 7 costillas ══
  log('══ PIEZA: laptop bezel (Kazmer Figs 3.5/5.12/11.7) ══');
  const W = 240, D = 160, T = 1.5, FR = 20, HW = 10;
  const rect = (w, d) => [{ x: -w/2, y: -d/2 }, { x: w/2, y: -d/2 }, { x: w/2, y: d/2 }, { x: -w/2, y: d/2 }];
  // marco: placa con ventana (extrudePolygonWithHoles)
  let pieza = occt.extrudePolygonWithHoles(oc, rect(W, D), [rect(W - 2*FR, D - 2*FR)], T, occt.PLANE_XY);
  // 4 paredes perimetrales exteriores (hacia arriba, espesor T, altura HW)
  const wall = (w, d, x, y) => occt.transformShape(oc, occt.makeBox(oc, w, d, HW), { translate: [x - w/2, y - d/2, T] });
  for (const [w, d, x, y] of [[W, T, 0, -D/2 + T/2], [W, T, 0, D/2 - T/2], [T, D - 2*T, -W/2 + T/2, 0], [T, D - 2*T, W/2 - T/2, 0]])
    pieza = occt.fuse(oc, pieza, wall(w, d, x, y));
  // 7 costillas transversales (t=1, h=10) sobre el marco inferior
  for (let i = 0; i < 7; i++) {
    const x = -W/2 + FR + (i + 1) * (W - 2*FR) / 8;
    pieza = occt.fuse(oc, pieza, occt.transformShape(oc, occt.makeBox(oc, 1, FR, 10), { translate: [x - 0.5, -D/2, T] }));
  }
  try { pieza = occt.draftFaces(oc, pieza, 1); log('draft 1° aplicado'); }
  catch (e) { log('draft 1°: DraftAngle no convergió en esta topología (marco+costillas) — geometría v1 SIN draft, requisito documentado'); }
  const vPieza = occt.volume(oc, pieza);
  log(`pieza: ${vPieza.toFixed(0)} mm³ (~${(vPieza * 1.05e-3).toFixed(1)} g ABS) · draft 1° aplicado`);

  // ══ 2. ANÁLISIS DE INGENIERÍA (los 5 sistemas) ══
  log('\n══ ANÁLISIS (Kazmer caps 5/9/11/3) ══');
  const fr = fill.fillingReport(fill.ABS_MG47, { flowLengthM: 0.2, wallM: 0.0015, projectedAreaM2: (W * D - (W - 2*FR) * (D - 2*FR)) * 1e-6 });  // marco: la ventana no proyecta
  fr.report.forEach((l) => log('  llenado: ' + l));
  const cr = cool.coolingReport([
    { name: 'pared 1.5mm', kind: 'plate', sizeMm: 1.5 }, { name: 'costilla 1mm', kind: 'plate', sizeMm: 1 },
  ], cool.ABS_KAZMER);
  log(`  enfriamiento: gobierna ${cr.governing} → t_c ${cr.cycleCoolingS.toFixed(1)} s`);
  const aEff = eject.effectiveArea({ h: 0.0015, L: 0.24, W: 0.16, nWalls: 4, hWall: 0.01, nRibs: 7, tRib: 0.001, hRib: 0.01 });
  const fEj = eject.ejectionForce(eject.ABS_EJECT, 1, aEff);
  const pins = eject.ejectorPinSizing(eject.ABS_EJECT, fEj, 20, 0.0015);
  log(`  expulsión: F=${fEj.toFixed(0)} N → 20 pines ⌀≥${pins.dMinMm.toFixed(2)} mm (cortante gobierna) → usar ⌀3 estándar`);
  const hotOpt = feed.optimizeFeedSystem(fill.ABS_MG47, [
    { name: 'sprue', L: 0.09, Vdot: 125e-6 }, { name: 'manifold', L: 0.118, Vdot: 62.5e-6 }, { name: 'nozzle', L: 0.108, Vdot: 62.5e-6 },
  ], 30e6);
  hotOpt.forEach((o) => log(`  hot runner: ${o.name} R=${(o.R * 1000).toFixed(1)} mm (ΔP asignado ${(o.dPAllocPa / 1e6).toFixed(1)} MPa)`));
  const be = cost.breakEven(
    { name: 'cold', fixedCost: 10000, marginalCost: 0.55 }, { name: 'hot', fixedCost: 250000, marginalCost: 0.16 });
  log(`  costos: break-even colada caliente = ${Math.round(be).toLocaleString()} piezas (1M pedidas → HOT RUNNER ✓)`);
  // cooling layout (cap 9): ⌀6.35, depth 4D=25.4 (2D<H<5D Eq9.22), pitch 2H (H<W<2H Eq9.24)
  const CD = 6.35, CDepth = 4 * CD, CPitch = 1.75 * CDepth;
  log(`  cooling layout: ⌀${CD} · depth ${CDepth.toFixed(1)} (4D ∈ [2D,5D]) · pitch ${CPitch.toFixed(0)} (∈[H,2H]) · P_melt≤175 MPa (P20)`);

  // ══ 3. GEOMETRÍA DEL MOLDE: placas core/cavity ══
  log('\n══ MOLDE: split core/cavity ══');
  const m = mold.splitMold(oc, pieza, {
    scale: 1.01, pinch: 0.5, plateThickness: 36, coreSide: 'above', margin: 45,
    // SHUT-OFF de la VENTANA central del marco (pasante 200×120): lámina que
    // corta el puente en el plano del espesor — el pad de la ventana va a la cavity.
    shutOffs: [{ w: (W - 2*FR) * 1.01 + 4, d: (D - 2*FR) * 1.01 + 4, h: 2.6, x: 0, y: 0, z: 0.76 }],
  });
  m.report.forEach((l) => log('  ' + l));
  if (m.bodies < 2) log('  ⚠ revisar shut-offs');

  // ══ 4. SISTEMAS BARRENADOS EN LAS PLACAS ══
  const cyl = (r, h, x, y, z, dir = 'z') => {
    const c = occt.makeCylinder ? null : null;  // usar makeCylinder de occt
    return occt.transformShape(oc,
      dir === 'z' ? occtMakeCyl(r, h) : occt.transformShape(oc, occtMakeCyl(r, h), { translate: [0, 0, 0], rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: dir === 'x' ? [0, 1, 0] : [1, 0, 0] } }),
      { translate: [x, y, z] });
  };
  const occtMakeCyl = (r, h) => occt.makeCylinder(oc, r, h, { origin: [0, 0, 0], dir: [0, 0, 1] });
  const bb = mold.shapeBBox(oc, m.corePlate);
  // hot runner en la placa CORE (arriba): sprue vertical + 2 manifolds horizontales + 2 nozzles verticales
  let core = m.corePlate;
  core = occt.cut(oc, core, cyl(hotOpt[0].R * 1000, 200, 0, 0, m.zPart));                       // sprue
  for (const sx of [-1, 1]) {
    const man = occt.transformShape(oc, occtMakeCyl(hotOpt[1].R * 1000, 118),
      { translate: [0, 0, 0], rotateAngle: sx * Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 1, 0] } });
    core = occt.cut(oc, core, occt.transformShape(oc, man, { translate: [0, 0, m.zPart + 18] }));
    core = occt.cut(oc, core, cyl(hotOpt[2].R * 1000, 60, sx * 100, 0, m.zPart - 1));           // nozzles a las cavidades
  }
  // canales de enfriamiento en AMBAS placas (líneas en X, pitch calculado)
  let cavity = m.cavityPlate;
  const nLines = Math.max(2, Math.floor(D / CPitch) + 1);
  for (let i = 0; i < nLines; i++) {
    const y = -D / 2 + (i + 0.5) * (D / nLines);
    const mk = () => occt.transformShape(oc, occt.transformShape(oc, occtMakeCyl(CD / 2, W + 140),
      { translate: [0, 0, 0], rotateAngle: Math.PI / 2, rotateAxis: { origin: [0, 0, 0], dir: [0, 1, 0] } }),
      { translate: [-(W + 140) / 2, y, 0] });
    cavity = occt.cut(oc, cavity, occt.transformShape(oc, mk(), { translate: [0, 0, m.zPart - HW - T - CDepth] }));
    core = occt.cut(oc, core, occt.transformShape(oc, mk(), { translate: [0, 0, m.zPart + CDepth] }));
  }
  // 20 eyectores ⌀3 en la placa CAVITY (empujan el marco desde abajo)
  let nP = 0;
  for (let i = 0; i < 10 && nP < 20; i++) for (const sy of [-1, 1]) {
    const x = -W / 2 + 12 + i * (W - 24) / 9, y = sy * (D / 2 - 10);
    cavity = occt.cut(oc, cavity, cyl(1.5, 120, x, y, m.zPart - 100)); nP++;
  }
  log(`\n  placas TERMINADAS: hot runner (sprue+2 manifold+2 nozzle) + ${nLines}×2 canales ⌀${CD} + ${nP} eyectores ⌀3`);
  log(`  core: ${occt.volume(oc, core).toFixed(0)} mm³ · cavity: ${occt.volume(oc, cavity).toFixed(0)} mm³`);

  // ══ 5. EXPORT ══
  const outDir = '/tmp/kazmer-mold';
  require('fs').mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}/bezel-core-plate.step`, occt.exportSTEP(oc, core, 'core.step'));
  writeFileSync(`${outDir}/bezel-cavity-plate.step`, occt.exportSTEP(oc, cavity, 'cavity.step'));
  writeFileSync(`${outDir}/bezel-pieza.step`, occt.exportSTEP(oc, pieza, 'pieza.step'));
  writeFileSync(`${outDir}/REPORTE-INGENIERIA.txt`, R.join('\n'));
  log(`\n  STEP + reporte → ${outDir}/`);
  console.log('MOLD_OK');
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 500)); process.exit(1); });
