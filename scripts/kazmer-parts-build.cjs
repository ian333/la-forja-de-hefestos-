/**
 * BANCO DE PRUEBAS DEL KERNEL — construir las 4 piezas del libro Kazmer con OCCT.
 * ==============================================================================
 * La hipótesis del user: "si me cuesta recrear la pieza compleja, es que al
 * kernel le faltan herramientas". Este script intenta construir las 4 piezas
 * REALES del libro (cup, lid, jabonera, laptop bezel) con el kernel B-Rep y
 * reporta, paso a paso, qué opera y qué truena → los huecos reales.
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
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const report = [];
  const built = {};
  const step = (label, fn) => { try { const r = fn(); report.push(`  ✓ ${label}${r != null ? ` · ${r}` : ''}`); return r; } catch (e) { report.push(`  ✗ ${label} → ${String(e.message || e).slice(0, 90)}`); throw e; } };
  const vol = (s) => `V=${K.volume(oc, s).toFixed(0)} mm³`;

  // ── 1. CUP (copa) — revolve del perfil de pared (⌀60, pared 2, alto 58, piso 3) ──
  console.log('\n[1] CUP (copa) — revolve de perfil:');
  try {
    const prof = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 58 }, { x: 28, y: 58 }, { x: 28, y: 3 }, { x: 0, y: 3 }];
    step('revolvePolygon 360° del perfil', () => vol(K.revolvePolygon(oc, prof, 360))); built.cup = true;
  } catch (e) {}
  console.log(report.splice(0).join('\n'));

  // ── 2. LID (tapa) — revolve con LABIO de undercut (§11.3.5) ──
  console.log('\n[2] LID (tapa) — revolve con labio de undercut:');
  try {
    const prof = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 8 }, { x: 41, y: 9 }, { x: 41, y: 11 }, { x: 38, y: 11 }, { x: 38, y: 2 }, { x: 0, y: 2 }];
    step('revolvePolygon 360° con labio', () => vol(K.revolvePolygon(oc, prof, 360))); built.lid = true;
  } catch (e) {}
  console.log(report.splice(0).join('\n'));

  // ── 3. JABONERA (box/soap-case) — caja + vaciado (shell) + filetes ──
  console.log('\n[3] JABONERA (box) — box + shell + fillet:');
  try {
    let b = step('makeBox 120×80×30', () => { const s = K.makeBox(oc, 120, 80, 30); return vol(s); }) && K.makeBox(oc, 120, 80, 30);
    step('filletAllEdges R2 sobre sólido MACIZO (¿fillet funciona de raíz?)', () => vol(K.filletAllEdges(oc, K.makeBox(oc, 120, 80, 30), 2)));
    const faces = K.enumerateFaces(oc, b);
    // cara superior = la de normal +Z (mayor z). Vaciar 2mm.
    let topIdx = 0, maxZ = -1e9;
    faces.forEach((f, i) => { if (f.centroid && f.centroid[2] > maxZ) { maxZ = f.centroid[2]; topIdx = i; } });
    b = step(`shellSolid pared 2mm (cara sup #${topIdx})`, () => { const s = K.shellSolid(oc, b, 2, [topIdx]); return vol(s); }) && K.shellSolid(oc, b, 2, [topIdx]);
    step('filletAllEdgesResilient R3 (antes tronaba)', () => { const r = K.filletAllEdgesResilient(oc, b, 3); return `${vol(r.shape)} · ${r.nota}`; }); built.box = true;
  } catch (e) {}
  console.log(report.splice(0).join('\n'));

  // ── 4. LAPTOP BEZEL (la COMPLEJA) — marco con ventana + costillas + bosses + draft + fillet ──
  console.log('\n[4] LAPTOP BEZEL (compleja) — marco+ventana+costillas+bosses+draft+fillet:');
  try {
    const outer = [{ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 240, y: 160 }, { x: 0, y: 160 }];
    const window = [{ x: 20, y: 20 }, { x: 220, y: 20 }, { x: 220, y: 140 }, { x: 20, y: 140 }];
    let bz = step('extrudePolygonWithHoles (marco 240×160, ventana 200×120, h10)', () => { const s = K.extrudePolygonWithHoles(oc, outer, [window], 10); return vol(s); }) && K.extrudePolygonWithHoles(oc, outer, [window], 10);
    // 7 costillas (Kazmer bezel: nRibs 7, tRib 1, hRib 10) — extruir tiras y fusionar
    step('fuse 7 costillas (1×10 mm)', () => {
      let acc = bz;
      for (let i = 0; i < 7; i++) {
        const x = 30 + i * 26;
        const rib = K.extrudePolygon(oc, [{ x, y: 20 }, { x: x + 1, y: 20 }, { x: x + 1, y: 140 }, { x, y: 140 }], 10);
        acc = K.fuse(oc, acc, rib);
      }
      bz = acc; return vol(acc);
    });
    // 4 bosses (postes ⌀6 para tornillos)
    step('fuse 4 bosses (⌀6×10)', () => {
      let acc = bz;
      for (const [cx, cy] of [[30, 30], [210, 30], [30, 130], [210, 130]]) {
        acc = K.fuse(oc, acc, K.makeCylinder(oc, 3, 10, { origin: [cx, cy, 0], dir: [0, 0, 1] }));
      }
      bz = acc; return vol(acc);
    });
    // DRAFT de las paredes verticales (desmoldeo +Z) — el paso crítico de moldeo
    step('draftFaces 1° (desmoldeo +Z)', () => {
      const faces = K.enumerateFaces(oc, bz);
      const vertical = faces.map((f, i) => i).filter((i) => faces[i].normal && Math.abs(faces[i].normal[2]) < 0.3);
      return `caras verticales=${vertical.length} · ` + vol(K.draftFaces(oc, bz, 1, [0, 0, 1], 0, vertical.slice(0, 12)));
    });
    // FILETES en las aristas (redondeo de raíces de costilla)
    step('filletAllEdgesResilient R0.5 (antes tronaba)', () => { const r = K.filletAllEdgesResilient(oc, bz, 0.5); bz = r.shape; return `${vol(r.shape)} · ${r.nota}`; });
    step('exportSTEP del bezel completo', () => { const step7 = K.exportSTEP(oc, bz); return `STEP ${(step7.length / 1024).toFixed(1)} KB`; }); built.bezel = true;
  } catch (e) {}
  console.log(report.splice(0).join('\n'));

  const checks = { cup: !!built.cup, lid: !!built.lid, box: !!built.box, bezel: !!built.bezel };
  const pass = Object.values(checks).every(Boolean);
  console.log('\nVERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
