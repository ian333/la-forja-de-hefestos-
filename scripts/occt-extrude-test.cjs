/**
 * La Forja — Test de INVARIANTES de la EXTRUSIÓN de perfil 2D (OCCT-WASM)
 * =======================================================================
 * El "primer momento del diseñador": perfil 2D paramétrico → sólido B-Rep.
 * Verifica corrección matemática, no "se ve bien":
 *   - Rectángulo 40×24 extruido 12  → caja: faces=6 edges=12 verts=8 Euler=2,
 *     V = 40·24·12 = 11520 EXACTO.
 *   - Círculo r=9 extruido 12        → cilindro: V = π·9²·12 = 3053.628… EXACTO,
 *     Euler=2.
 *   - Teselado no vacío, normales unitarias.
 *   - STEP roundtrip del rectángulo extruido conserva topología y volumen.
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

  const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
  const PI = Math.PI;

  // ── 1. RECTÁNGULO 40×24 extruido 12 (perfil poligonal) ─────────
  const W = 40, Hh = 24, D = 12;
  const rectPts = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: Hh },
    { x: 0, y: Hh },
  ];
  const rectSolid = occt.extrudePolygon(oc, rectPts, D); // plano XY default
  const topoRect = occt.topology(oc, rectSolid);
  const volRect = occt.volume(oc, rectSolid);
  const volRectExact = W * Hh * D; // 11520

  // ── 2. CÍRCULO r=9 extruido 12 (arista circular exacta → cilindro) ──
  const R = 9;
  const circSolid = occt.extrudeCircle(oc, { x: 0, y: 0 }, R, D);
  const topoCirc = occt.topology(oc, circSolid);
  const volCirc = occt.volume(oc, circSolid);
  const volCircExact = PI * R * R * D; // 3053.628…

  // ── 3. TESELADO del sólido extruido (malla para R3F) ───────────
  const mesh = occt.tessellate(oc, rectSolid, 0.1, 0.4);
  let normUnit = true;
  for (let i = 0; i < mesh.normals.length; i += 3) {
    const l = Math.hypot(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
    if (Math.abs(l - 1) > 1e-3 && l > 1e-9) { normUnit = false; break; }
  }
  const meshCirc = occt.tessellate(oc, circSolid, 0.05, 0.3);

  // ── 4. STEP roundtrip del rectángulo extruido ──────────────────
  const stepText = occt.exportSTEP(oc, rectSolid, 'extrude.step');
  const reimported = occt.importSTEP(oc, stepText);
  const topoRe = occt.topology(oc, reimported);
  const volRe = occt.volume(oc, reimported);
  const roundtripOk =
    topoRe.faces === topoRect.faces &&
    topoRe.edges === topoRect.edges &&
    topoRe.vertices === topoRect.vertices &&
    approx(volRe, volRect, 1e-3) &&
    /ISO-10303-21/.test(stepText);

  const inv = {
    rect_faces: topoRect.faces,
    rect_edges: topoRect.edges,
    rect_verts: topoRect.vertices,
    rect_euler: topoRect.euler,
    rect_vol: volRect,
    rect_vol_exact: volRectExact,
    circ_faces: topoCirc.faces,
    circ_edges: topoCirc.edges,
    circ_verts: topoCirc.vertices,
    circ_euler: topoCirc.euler,
    circ_vol: volCirc,
    circ_vol_exact: volCircExact,
    mesh_verts: mesh.vertexCount,
    mesh_tris: mesh.triangleCount,
    mesh_circ_verts: meshCirc.vertexCount,
    mesh_circ_tris: meshCirc.triangleCount,
    step_bytes: stepText.length,
    re_faces: topoRe.faces,
    re_edges: topoRe.edges,
    re_verts: topoRe.vertices,
    re_vol: volRe,
  };

  const checks = {
    rect_faces_6: topoRect.faces === 6,
    rect_edges_12: topoRect.edges === 12,
    rect_verts_8: topoRect.vertices === 8,
    rect_euler_2: topoRect.euler === 2,
    rect_vol_exact: approx(volRect, volRectExact, 1e-6),
    // Cilindro: 3 caras (lateral + 2 tapas), 3 aristas (2 círculos + costura),
    // 2 vértices (costura). Euler topológico = 2.
    circ_euler_2: topoCirc.euler === 2,
    circ_vol_exact: approx(volCirc, volCircExact, 1e-6),
    mesh_nonempty: mesh.triangleCount > 0 && meshCirc.triangleCount > 0,
    mesh_normals_unit: normUnit,
    step_roundtrip_ok: roundtripOk,
  };

  const allPass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: allPass, invariants: inv, checks }, null, 2));
  process.exit(allPass ? 0 : 2);
})().catch((e) => {
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: false, fatal: String((e && e.stack) || e) }));
  process.exit(1);
});
