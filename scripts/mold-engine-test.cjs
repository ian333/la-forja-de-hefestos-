/**
 * TEST del MOTOR DE MOLDES (src/forja/mold/mold.ts) — cap 6 en node:
 * método 2 (core & cavity) con piezas construidas EN CÓDIGO (los generadores
 * de la fábrica — deterministas, viven en el repo), método 1 (split plano,
 * jabonera) y draft analysis.
 * ⚠ LECCIÓN 2026-07-06: la versión anterior replay-eaba docs de /tmp (fixtures
 * de drives por clicks) y el tmp-cleaner de iangpu los borró → gate roto.
 * Un fixture de test SIEMPRE vive en el repo o se construye en código.
 */
const { readFileSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const mold = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const approx = (a, b, eps) => process.env.PIN ? true : Math.abs(a - b) <= eps;
  // referencias EXACTAS (deterministas: generadores en código + kernel OCCT).
  // Capturadas con PIN=1 el 2026-07-06 tras perder los fixtures de /tmp.
  const REF = {
    coverPieza: 836232.0, coverCavity: 9923296.588, coverMacho: 6233907.979, coverPlate: 3642423.501,
    cvCavity: 1581904.514, cvMacho: 146981.199,
  };
  const P = { xy: occt.PLANE_XY, yz: occt.PLANE_YZ, xz: occt.PLANE_XZ };

  // replay de una pieza desde su doc serializado (grafo de La Forja)
  const replay = (docPath, { shell = false, draft = 0 } = {}) => {
    const doc = JSON.parse(readFileSync(docPath, 'utf8'));
    const ex = doc.ops.find((o) => o.type === 'extrude');
    let acc = occt.extrudePolygon(oc, doc.sketch.customProfile, ex.depth, P[ex.plane ?? 'xy']);
    if (shell) { const so = doc.ops.find((o) => o.type === 'shell'); acc = occt.shellSolid(oc, acc, so.thickness, so.faces); }
    for (const c of doc.components) {
      if (c.kind !== 'sketch' || !c.profile || c.profile.length < 3 || c.bool !== 'subtract') continue;
      const bp = P[c.plane ?? 'xy'];
      const pl = c.plane3d ? c.plane3d : (c.planeOffset ? occt.offsetPlane(bp, c.planeOffset) : bp);
      const tool = (c.circle && !(c.holes && c.holes.length))
        ? occt.extrudeCircle(oc, { x: c.circle.x, y: c.circle.y }, c.circle.r, c.depth ?? 12, pl)
        : occt.extrudePolygon(oc, c.profile, c.depth ?? 12, pl);
      acc = occt.cut(oc, acc, tool);
    }
    if (draft) acc = occt.draftFaces(oc, acc, draft);
    return acc;
  };

  const checks = {};

  const cbox = (w, d, h, x, y, z) => occt.transformShape(oc, occt.makeBox(oc, w, d, h), { translate: [x - w / 2, y - d / 2, z] });

  // ── 1. PLASTIC COVER (Tutorial 1 simplificada, generador de la fábrica):
  //      350×200×100 pared 6, piso 3 → split auto con escala pvT de la fábrica ──
  let cover = cbox(350, 200, 100, 0, 0, 0);
  cover = occt.cut(oc, cover, cbox(338, 188, 98, 0, 0, 3));
  const volCover = occt.volume(oc, cover);
  checks.cover_pieza = approx(volCover, REF.coverPieza, 0.5);
  const mCover = mold.splitMold(oc, cover, { scale: 1.0055, pinch: 0.5, plateThickness: 30, margin: 40 });
  console.log('COVER:', mCover.report.join(' | '));
  checks.cover_separa = mCover.bodies >= 2;
  checks.cover_cavity = approx(mCover.vols.cavity, REF.coverCavity, 5);
  checks.cover_macho = approx(mCover.vols.macho, REF.coverMacho, 5);
  checks.cover_core = approx(mCover.vols.core, mCover.vols.macho + REF.coverPlate, 5);

  // ── 2. COVER-VENTANAS (undercuts): las ventanas PUENTEAN cavity↔macho;
  //      las láminas shut-off declaradas deben CORTAR el puente ──
  let cv = cbox(100, 60, 30, 0, 0, 0);
  cv = occt.cut(oc, cv, cbox(96, 56, 29, 0, 0, 2));
  cv = occt.cut(oc, cv, cbox(20, 70, 10, -25, 0, 12));
  const mCv = mold.splitMold(oc, cv, {
    scale: 1.0055, pinch: 0.5, plateThickness: 30, margin: 40,
    shutOffs: [{ w: 26, d: 9, h: 18, x: -25, y: 29.1, z: 15 }, { w: 26, d: 9, h: 18, x: -25, y: -29.1, z: 15 }],
  });
  console.log('COVER-VENTANAS:', mCv.report.join(' | '));
  checks.cv_separa = mCv.bodies >= 2;                      // sin shut-offs esto era 1 cuerpo (puente)
  checks.cv_cavity = approx(mCv.vols.cavity, REF.cvCavity, 5);
  checks.cv_macho = approx(mCv.vols.macho, REF.cvMacho, 5);

  // ── 3. MÉTODO 1 (split mold por plano, jabonera): caja 80×50×24 en z 10..34 ──
  const jab = occt.transformShape(oc, occt.makeBox(oc, 80, 50, 24), { translate: [-40, -25, 10] });
  const sm = mold.splitMoldByPlane(oc, jab, { scale: 1.05 });
  console.log('JABONERA:', sm.report.join(' | '));
  checks.jab_conserva = approx(sm.vols.top + sm.vols.bottom, sm.vols.molde, 0.01);
  checks.jab_simetrica = approx(sm.vols.top, sm.vols.bottom, 0.01);

  // ── 4. DRAFT ANALYSIS: caja sin draft → 4 paredes amarillas; drafteada → 0 ──
  const box = occt.makeBox(oc, 20, 20, 10);
  const da0 = mold.draftAnalysis(oc, box, [0, 0, 1], 1);
  const boxD = occt.draftFaces(oc, occt.makeBox(oc, 20, 20, 10), 3);
  const da1 = mold.draftAnalysis(oc, boxD, [0, 0, 1], 1);
  console.log('DRAFT ANALYSIS: sin draft req=%d neu=%d | con draft req=%d pos=%d neg=%d',
    da0.requiresDraft.length, da0.neutral.length, da1.requiresDraft.length, da1.positive.length, da1.negative.length);
  checks.da_caja_requiere = da0.requiresDraft.length === 4 && da0.neutral.length === 2;
  checks.da_drafted_ok = da1.requiresDraft.length === 0;

  if (process.env.PIN) {
    console.log('PIN=', JSON.stringify({
      coverPieza: volCover, coverCavity: mCover.vols.cavity, coverMacho: mCover.vols.macho,
      coverPlate: mCover.vols.core - mCover.vols.macho,
      cvCavity: mCv.vols.cavity, cvMacho: mCv.vols.macho,
    }));
  }
  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }, null, 1));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
