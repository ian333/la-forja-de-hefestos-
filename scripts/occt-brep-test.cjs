/**
 * La Forja — Test de INVARIANTES del kernel B-Rep (OCCT-WASM)
 * ===========================================================
 * Verifica corrección matemática/topológica, no "se ve bien":
 *   - Caja 50×30×20  → faces=6, edges=12, verts=8, Euler=2, vol=30000 EXACTO
 *   - Cilindro D10 pasante cortado → vol baja exactamente π·5²·20 = 1570.7963…
 *   - STEP roundtrip → misma topología y mismo volumen
 *
 * Carga occt.ts compilado on-the-fly NO (Node no resuelve .ts); en su lugar
 * importamos el factory crudo e invocamos la MISMA lógica que occt.ts expone,
 * registrándola vía require del módulo transpilado por tsx si está disponible,
 * o reimplementando las llamadas idénticas. Aquí usamos tsx para cargar occt.ts
 * directamente y probar el código de producción real.
 */
const { readFileSync } = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

(async () => {
  // Carga el módulo de producción occt.ts vía tsx (registrado por el runner).
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));

  const oc = await factory({
    wasmBinary: wasmBin,
    locateFile: (p) => path.join(distDir, p),
  });
  occt._setActiveOCCT(oc);

  const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const PI = Math.PI;

  // ── 1. CAJA 50×30×20 ───────────────────────────────────────────
  const box = occt.makeBox(oc, 50, 30, 20);
  const topoBox = occt.topology(oc, box);
  const volBox = occt.volume(oc, box);
  const areaBox = occt.surfaceArea(oc, box);
  const areaBoxExact = 2 * (50 * 30 + 50 * 20 + 30 * 20); // 7400

  // ── 2. CILINDRO D10 (r=5) PASANTE, h=20, cortado de la caja ─────
  // Centrado en (25,15) atravesando todo el espesor Z (0..20).
  const cyl = occt.makeCylinder(oc, 5, 20, {
    origin: [25, 15, 0],
    dir: [0, 0, 1],
  });
  const volCyl = occt.volume(oc, cyl);
  const volCylExact = PI * 5 * 5 * 20; // 1570.7963…

  const cutShape = occt.cut(oc, box, cyl);
  const topoCut = occt.topology(oc, cutShape);
  const volCut = occt.volume(oc, cutShape);
  const volCutExact = 30000 - volCylExact; // 28429.2036…

  // ── 3. STEP ROUNDTRIP del sólido cortado ───────────────────────
  const stepText = occt.exportSTEP(oc, cutShape, 'test_cut.step');
  const reimported = occt.importSTEP(oc, stepText, 'reimport.step');
  const topoRe = occt.topology(oc, reimported);
  const volRe = occt.volume(oc, reimported);
  const roundtripOk =
    topoRe.faces === topoCut.faces &&
    topoRe.edges === topoCut.edges &&
    topoRe.vertices === topoCut.vertices &&
    approx(volRe, volCut, 1e-3) &&
    /ISO-10303-21/.test(stepText);

  // ── 4. TESELADO (sanity: malla no vacía, normales unitarias) ───
  const mesh = occt.tessellate(oc, cutShape, 0.1, 0.4);
  let normUnit = true;
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const l = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
    if (Math.abs(l - 1) > 1e-3 && l > 1e-9) {
      normUnit = false;
      break;
    }
  }

  // ── Invariantes booleanas ───────────────────────────────────────
  const inv = {
    box_faces: topoBox.faces,
    box_edges: topoBox.edges,
    box_verts: topoBox.vertices,
    box_euler: topoBox.euler,
    box_vol: volBox,
    box_area: areaBox,
    cyl_vol: volCyl,
    cut_faces: topoCut.faces,
    cut_edges: topoCut.edges,
    cut_verts: topoCut.vertices,
    cut_euler: topoCut.euler,
    cut_vol: volCut,
    step_bytes: stepText.length,
    re_faces: topoRe.faces,
    re_edges: topoRe.edges,
    re_verts: topoRe.vertices,
    re_euler: topoRe.euler,
    re_vol: volRe,
    mesh_verts: mesh.vertexCount,
    mesh_tris: mesh.triangleCount,
  };

  const checks = {
    box_faces_6: topoBox.faces === 6,
    box_edges_12: topoBox.edges === 12,
    box_verts_8: topoBox.vertices === 8,
    box_euler_2: topoBox.euler === 2,
    box_vol_30000: approx(volBox, 30000, 1e-6),
    box_area_7400: approx(areaBox, areaBoxExact, 1e-6),
    cyl_vol_exact: approx(volCyl, volCylExact, 1e-6),
    cut_euler_2: topoCut.euler === 2,
    cut_vol_exact: approx(volCut, volCutExact, 1e-3),
    step_roundtrip_ok: roundtripOk,
    mesh_nonempty: mesh.triangleCount > 0,
    mesh_normals_unit: normUnit,
  };

  const allPass = Object.values(checks).every(Boolean);

  console.log('VERIFY_RESULT=' + JSON.stringify(
    {
      pass: allPass,
      expected: {
        box_faces: 6,
        box_edges: 12,
        box_verts: 8,
        euler: 2,
        box_vol: 30000,
        box_area: areaBoxExact,
        cyl_vol: volCylExact,
        cut_vol: volCutExact,
      },
      invariants: inv,
      checks,
    },
    null,
    2,
  ));
  process.exit(allPass ? 0 : 2);
})().catch((e) => {
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: false, fatal: String(e && e.stack || e) }));
  process.exit(1);
});
