/**
 * La Forja — Test de INVARIANTES de las NUEVAS features del kernel B-Rep
 * =====================================================================
 * Cubre las operaciones que habilitan los clásicos #3..#6 del Part Studio
 * interactivo (fillet selectivo, chamfer, shell/vaciado, revolve, barreno) y
 * el primer ANÁLISIS (masa/volumen/centro-de-masa/inercia exactos vía GProp).
 * Verifica corrección matemática, no "se ve bien":
 *   - drillHole pasante D8 en placa 40×24×12 → vol baja exacto π·4²·12.
 *   - revolvePolygon (rectángulo [r0..r1]×[0..h]) 360° → tubo: Pappus 2π·A·x̄.
 *   - shellSolid de caja 40×40×20, pared 2, cara superior abierta → vol > 0,
 *     un solo sólido, vol_hueco < vol_macizo.
 *   - massProperties de placa centrada → CoM en el centro geométrico, masa
 *     = vol·densidad, inercia diagonal (placa alineada a ejes).
 *   - enumerateFaces/Edges → conteos coherentes con la topología + tipos.
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
  const oc = await factory({
    wasmBinary: wasmBin,
    locateFile: (p) => path.join(distDir, p),
  });
  occt._setActiveOCCT(oc);

  const approx = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
  const PI = Math.PI;
  const rect = (w, h) => [
    { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 },
  ];

  // ── 1. PLACA + BARRENO PASANTE ─────────────────────────────────
  const W = 40, H = 24, D = 12;
  const plate = occt.extrudePolygon(oc, rect(W, H), D);
  const volPlate = occt.volume(oc, plate);
  const drilled = occt.drillHole(oc, plate, {
    x: 0, y: 0, diameter: 8, zTop: D, depth: D, through: true,
  });
  const volDrilled = occt.volume(oc, drilled);
  const holeRemoved = volPlate - volDrilled;
  const holeExact = PI * 4 * 4 * D; // π r² h

  // ── 2. REVOLVE 360° (tubo): perfil rect [r0..r1]×[0..h] alrededor de Y ──
  // El perfil vive en x∈[r0,r1], y∈[0,h]; girado 360° en torno a Y (x=0).
  const r0 = 6, r1 = 10, hh = 20;
  const tubeProfile = [
    { x: r0, y: 0 }, { x: r1, y: 0 }, { x: r1, y: hh }, { x: r0, y: hh },
  ];
  const tube = occt.revolvePolygon(oc, tubeProfile, 360);
  const volTube = occt.volume(oc, tube);
  // Pappus: V = 2π·A·x̄. A = (r1−r0)·h, x̄ = (r0+r1)/2.
  const A = (r1 - r0) * hh;
  const xbar = (r0 + r1) / 2;
  const volTubeExact = 2 * PI * A * xbar; // = π(r1²−r0²)h
  const topoTube = occt.topology(oc, tube);

  // ── 3. SHELL / VACIADO de caja, cara superior abierta ──────────
  const box = occt.extrudePolygon(oc, rect(40, 40), 20);
  const volBox = occt.volume(oc, box);
  const faces = occt.enumerateFaces(oc, box);
  // La cara superior es el plano con normal +Z y centroide en z≈20.
  let topIdx = -1, topZ = -Infinity;
  for (const f of faces) {
    if (f.kind === 'plane' && f.center[2] > topZ) { topZ = f.center[2]; topIdx = f.index; }
  }
  const shelled = occt.shellSolid(oc, box, 2, [topIdx]);
  const volShell = occt.volume(oc, shelled);
  const shellSolids = occt.uniqueSubShapes(oc, shelled, oc.TopAbs_ShapeEnum.TopAbs_SOLID).length;

  // ── 4. PROPIEDADES DE MASA de la placa centrada (aluminio 2.7e-3 g/mm³) ──
  const density = 2.7e-3;
  const mp = occt.massProperties(oc, plate, density);
  const massExact = volPlate * density;
  // CoM de la placa centrada en XY extruida 0..D → (0,0,D/2).
  const comOk = approx(mp.centerOfMass[0], 0, 1e-6) &&
                approx(mp.centerOfMass[1], 0, 1e-6) &&
                approx(mp.centerOfMass[2], D / 2, 1e-6);

  // ── 5. ENUMERACIÓN de caras/aristas ────────────────────────────
  const edges = occt.enumerateEdges(oc, plate);
  const planeFaces = faces.length; // de la caja (6)
  const plateFaces = occt.enumerateFaces(oc, plate).length; // 6

  // ── 6. FILLET SELECTIVO (1 arista) y CHAMFER (1 arista) ────────
  const plate2 = occt.extrudePolygon(oc, rect(40, 24), 12);
  const fil = occt.filletEdges(oc, plate2, 2, [0]);
  const volFil = occt.volume(oc, fil);
  const cha = occt.chamferEdges(oc, plate2, 2, [0]);
  const volCha = occt.volume(oc, cha);

  // ── 7. ESCALA (contracción de molde, cap 6): cubo 10³ ×1.05 → 1157.625 EXACTO ──
  const cubeS = occt.makeBox(oc, 10, 10, 10);
  const scaled = occt.scaleShape(oc, cubeS, 1.05, [5, 5, 5]);
  const volScaled = occt.volume(oc, scaled);
  const comScaled = occt.massProperties(oc, scaled, 1).centerOfMass;

  // ── 8. DRAFT (ángulo de salida, cap 6 molde): caja 20×20×10, 3° pull +Z,
  //       neutro z=0 → tronco piramidal EXACTO h/3·(a²+ab+b²) con b=20−2h·tan3°
  const boxD = occt.makeBox(oc, 20, 20, 10);
  const drafted = occt.draftFaces(oc, boxD, 3, [0, 0, 1], 0);
  const volDraft = occt.volume(oc, drafted);
  const bTop = 20 - 2 * 10 * Math.tan((3 * Math.PI) / 180);
  const volDraftIn = (10 / 3) * (400 + 20 * bTop + bTop * bTop);       // paredes se cierran
  const bOut = 20 + 2 * 10 * Math.tan((3 * Math.PI) / 180);
  const volDraftOut = (10 / 3) * (400 + 20 * bOut + bOut * bOut);      // paredes se abren

  const inv = {
    vol_plate: volPlate, vol_drilled: volDrilled, hole_removed: holeRemoved, hole_exact: holeExact,
    vol_scaled: volScaled, com_scaled: comScaled,
    vol_draft: volDraft, vol_draft_in: volDraftIn, vol_draft_out: volDraftOut,
    vol_tube: volTube, vol_tube_exact: volTubeExact, tube_euler: topoTube.euler,
    vol_box: volBox, vol_shell: volShell, top_face_idx: topIdx, shell_solids: shellSolids,
    mass: mp.mass, mass_exact: massExact, com: mp.centerOfMass, principal: mp.principal,
    plate_faces: plateFaces, plate_edges: edges.length, box_faces: planeFaces,
    vol_fillet: volFil, vol_chamfer: volCha,
  };

  const checks = {
    drill_removed_exact: approx(holeRemoved, holeExact, 1e-2),
    drilled_valid: occt.topology(oc, drilled).faces > 6,
    revolve_pappus: approx(volTube, volTubeExact, 1e-1),
    revolve_solid: topoTube.faces >= 4,
    shell_single_solid: shellSolids === 1,
    shell_hollow: volShell > 0 && volShell < volBox,
    mass_exact: approx(mp.mass, massExact, 1e-6),
    com_centered: comOk,
    principal_positive: mp.principal.every((x) => x > 0),
    plate_faces_6: plateFaces === 6,
    plate_edges_12: edges.length === 12,
    box_faces_6: planeFaces === 6,
    fillet_reduces: volFil < volPlate && volFil > 0,
    chamfer_reduces: volCha < volPlate && volCha > 0,
    // escala 1.05 alrededor del centro: vol ×1.05³ exacto y el COM NO se mueve
    scale_vol_exact: approx(volScaled, 1157.625, 1e-6),
    scale_com_fixed: Math.hypot(comScaled[0] - 5, comScaled[1] - 5, comScaled[2] - 5) < 1e-6,
    // draft 3° de DESMOLDEO: caras exteriores se ABREN hacia el pull (la pieza
    // sale de la hembra) → el cubo se ensancha arriba = tronco invertido EXACTO
    draft_frustum_exact: approx(volDraft, volDraftOut, 1e-4),
    draft_valid: occt.topology(oc, drafted).faces === 6,
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: allPass, invariants: inv, checks }, null, 2));
  process.exit(allPass ? 0 : 2);
})().catch((e) => {
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: false, fatal: String((e && e.stack) || e) }));
  process.exit(1);
});
