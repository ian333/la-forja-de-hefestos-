/**
 * ENSAMBLE COMPLETO DEL MOLD BASE — Kazmer Figs 1.4/12.7 (molde 381×302×~400)
 * ============================================================================
 * El stack estándar de un molde de dos placas: rear clamp + rails del ejector
 * housing + ejector plate/retainer + support plate + CORE PLATE (la nuestra,
 * con hot runner/canales/eyectores) + CAVITY PLATE (la nuestra) + top clamp +
 * 4 pilares guía ⌀32 + tornillos M10 DIN 912 (análisis §12.4) + anillo
 * centrador ⌀100 + knock-out. Genera ENSAMBLE cerrado y EXPLOSIÓN → STEP.
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const out = '/tmp/kazmer-mold'; mkdirSync(out, { recursive: true });
  const box = (w, d, h, x, y, z) => occt.transformShape(oc, occt.makeBox(oc, w, d, h), { translate: [x - w / 2, y - d / 2, z] });
  const cylZ = (r, h, x, y, z) => occt.transformShape(oc, occt.makeCylinder(oc, r, h, { origin: [0, 0, 0], dir: [0, 0, 1] }), { translate: [x, y, z] });
  // tornillo DIN 912 M10: cuerpo ⌀10 + cabeza ⌀15×10
  const m10 = (x, y, z, L) => occt.fuse(oc, cylZ(5, L, x, y, z), cylZ(7.5, 10, x, y, z + L));

  // nuestras placas (con sistemas barrenados) — centradas en (175,-100); el stack en Z
  const core = occt.importSTEP(oc, readFileSync(`${out}/bezel-core-plate.step`, 'utf8'));
  const cavity = occt.importSTEP(oc, readFileSync(`${out}/bezel-cavity-plate.step`, 'utf8'));
  const bbCav = (await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'))).shapeBBox(oc, cavity);
  const bbCore = (await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'))).shapeBBox(oc, core);
  const W = 381, D = 302, CX = 175, CY = -100;                 // molde Fig 12.7
  // stack (de abajo hacia arriba). z=0 = cara inferior del rear clamp.
  const parts = [];
  const add = (name, shape, expDir = 0) => parts.push({ name, shape, expDir });
  add('rear-clamp-plate', box(W, D, 25, CX, CY, 0), -2);
  add('rail-izq', box(50, D, 76, CX - (W / 2 - 25), CY, 25), -1.5);
  add('rail-der', box(50, D, 76, CX + (W / 2 - 25), CY, 25), -1.5);
  add('ejector-plate', box(W - 130, D - 40, 12, CX, CY, 40), -1);
  add('ejector-retainer', box(W - 130, D - 40, 25, CX, CY, 52), -0.8);
  add('support-plate', box(W, D, 36, CX, CY, 101), -0.5);
  // nuestras placas: cavity abajo del split, core arriba (las movemos al stack)
  const zSplit = 137 + (0 - bbCav.min[2]);
  add('CAVITY-PLATE (La Forja)', occt.transformShape(oc, cavity, { translate: [0, 0, 137 - bbCav.min[2]] }), 0.8);
  const hCav = bbCav.max[2] - bbCav.min[2];
  add('CORE-PLATE (La Forja)', occt.transformShape(oc, core, { translate: [0, 0, 137 + hCav + 0.5 - bbCore.min[2]] }), 1.6);
  const hCore = bbCore.max[2] - bbCore.min[2];
  const zTop = 137 + hCav + 0.5 + hCore;
  add('top-clamp-plate', box(W, D, 25, CX, CY, zTop), 2.2);
  add('anillo-centrador', cylZ(50, 10, CX, CY, zTop + 25), 2.6);
  // 4 pilares guía ⌀32 (esquinas 248×168 de Fig 12.7, desde support hasta top)
  for (const sx of [-1, 1]) for (const sy of [-1, 1])
    add(`pilar-${sx}${sy}`, cylZ(16, zTop - 101, CX + sx * 124, CY + sy * 84, 101), 0.4);
  // 4 tornillos M10 (lado móvil: rear clamp→support, análisis §12.4 → M10)
  for (const sx of [-1, 1]) for (const sy of [-1, 1])
    add(`M10-DIN912-${sx}${sy}`, m10(CX + sx * 160, CY + sy * 120, -10, 120), -2.5);
  add('knock-out-rod', cylZ(12, 60, CX, CY, -60), -3);

  // ENSAMBLE cerrado y EXPLOSIÓN
  const closed = occt.makeCompound(oc, parts.map((p) => p.shape));
  const exploded = occt.makeCompound(oc, parts.map((p) =>
    occt.transformShape(oc, p.shape, { translate: [0, 0, p.expDir * 55] })));
  writeFileSync(`${out}/mold-base-ensamble.step`, occt.exportSTEP(oc, closed, 'ensamble.step'));
  writeFileSync(`${out}/mold-base-explosion.step`, occt.exportSTEP(oc, exploded, 'explosion.step'));
  const vol = occt.volume(oc, closed);
  console.log('piezas:', parts.length, '· vol total', (vol / 1000).toFixed(0), 'cm³ · masa ~', (vol * 7.8e-6).toFixed(0), 'kg');
  console.log('ASSEMBLY_OK');
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
