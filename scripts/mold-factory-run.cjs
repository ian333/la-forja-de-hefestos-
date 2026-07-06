/**
 * LA FÁBRICA EN MARCHA — TODOS los moldes del libro de Kazmer:
 * 6 piezas × 12 variantes (2placas/3placas/hot × 1/2/4/8 cav) = 72 análisis
 * completos + geometría split para las 2 mejores de cada pieza + reportes.
 * Salida: /tmp/kazmer-molds/<pieza>/REPORTE.txt + *.step
 */
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));
(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const mold = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
  const fab = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'factory.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  const OUT = '/tmp/kazmer-molds'; mkdirSync(OUT, { recursive: true });
  const box = (w, d, h, x, y, z) => occt.transformShape(oc, occt.makeBox(oc, w, d, h), { translate: [x - w / 2, y - d / 2, z] });
  const rect = (w, d) => [{ x: -w/2, y: -d/2 }, { x: w/2, y: -d/2 }, { x: w/2, y: d/2 }, { x: -w/2, y: d/2 }];
  const ring = (n, ro, ri) => {
    const outer = Array.from({length: n}, (_, k) => ({ x: ro*Math.cos(2*Math.PI*k/n), y: ro*Math.sin(2*Math.PI*k/n) }));
    const inner = Array.from({length: n}, (_, k) => ({ x: ri*Math.cos(2*Math.PI*k/n), y: ri*Math.sin(2*Math.PI*k/n) }));
    return { outer, inner };
  };

  // ── LAS 6 PIEZAS DEL LIBRO ──
  const parts = [];
  { // 1. CUP (family mold cap 9: pared 3mm, ⌀60×h70) — vaso: tubo + fondo
    const { outer, inner } = ring(48, 30, 27);
    let s = occt.extrudePolygonWithHoles(oc, outer, [inner], 70, occt.PLANE_XY);
    s = occt.fuse(oc, s, occt.extrudePolygon(oc, outer, 3, occt.PLANE_XY));
    parts.push({ name: 'cup', shape: s, wallMm: 3, flowLenMm: 100, projAreaMm2: Math.PI*30*30, annualVolume: 500000 });
  }
  { // 2. LID (tapa pared 2mm, ⌀62×h10)
    const { outer, inner } = ring(48, 31, 29);
    let s = occt.extrudePolygon(oc, outer, 2, occt.PLANE_XY);
    s = occt.fuse(oc, s, occt.extrudePolygonWithHoles(oc, outer, [inner], 10, occt.PLANE_XY));
    parts.push({ name: 'lid', shape: s, wallMm: 2, flowLenMm: 62, projAreaMm2: Math.PI*31*31, annualVolume: 500000 });
  }
  { // 3. SOAP CASE (jabonera cap 6 SW: 90×60×25 shell 2)
    let s = box(90, 60, 25, 0, 0, 0);
    s = occt.cut(oc, s, box(86, 56, 24, 0, 0, 2));
    parts.push({ name: 'soap-case', shape: s, wallMm: 2, flowLenMm: 75, projAreaMm2: 90*60, annualVolume: 1000000 });
  }
  { // 4. PLASTIC COVER (Tutorial 1 simplificada: 350×200×100 pared 6, piso 3)
    let s = box(350, 200, 100, 0, 0, 0);
    s = occt.cut(oc, s, box(338, 188, 98, 0, 0, 3));
    parts.push({ name: 'plastic-cover', shape: s, wallMm: 6, flowLenMm: 175, projAreaMm2: 350*200, annualVolume: 50000 });
  }
  { // 5. LAPTOP BEZEL (el del libro: marco 240×160 pared 1.5)
    let s = occt.extrudePolygonWithHoles(oc, rect(240, 160), [rect(200, 120)], 1.5, occt.PLANE_XY);
    for (const [w, d, x, y] of [[240,1.5,0,-79.25],[240,1.5,0,79.25],[1.5,157,-119.25,0],[1.5,157,119.25,0]])
      s = occt.fuse(oc, s, box(w, d, 10, x, y, 1.5));
    parts.push({ name: 'laptop-bezel', shape: s, wallMm: 1.5, flowLenMm: 200, projAreaMm2: 240*160-200*120, annualVolume: 1000000,
      shutOffs: [{ w: 206, d: 126, h: 2.6, x: 0, y: 0, z: 0.75 }] });   // ventana central del marco
  }
  { // 6. COVER CON VENTANAS LATERALES (undercuts → SLIDES): 100×60×30 shell 2 + 2 ventanas 20×10
    let s = box(100, 60, 30, 0, 0, 0);
    s = occt.cut(oc, s, box(96, 56, 29, 0, 0, 2));
    s = occt.cut(oc, s, box(20, 70, 10, -25, 0, 12));   // ventana lateral atraviesa ambas paredes
    parts.push({ name: 'cover-ventanas', shape: s, wallMm: 2, flowLenMm: 80, projAreaMm2: 100*60,
      undercuts: [{ aProjMm2: 20*10, strokeMm: 12 }, { aProjMm2: 20*10, strokeMm: 12 }], annualVolume: 300000,
      shutOffs: [{ w: 26, d: 9, h: 18, x: -25, y: 29.1, z: 15 }, { w: 26, d: 9, h: 18, x: -25, y: -29.1, z: 15 }] });  // láminas en las 2 ventanas laterales
  }

  // ── LA MATRIZ: análisis completo de cada pieza ──
  const index = [];
  let total = 0;
  for (const p of parts) {
    const dir = `${OUT}/${p.name}`; mkdirSync(dir, { recursive: true });
    const vol = occt.volume(oc, p.shape);
    const fam = fab.moldFactory(oc, p);
    total += fam.variants.length;
    const R = [`══ ${p.name.toUpperCase()} — ${vol.toFixed(0)} mm³ · ${p.annualVolume.toLocaleString()} pzas/año ══`, ''];
    R.push('RANKING (por costo total):'); R.push(...fam.summary); R.push('');
    for (const v of fam.variants.slice(0, 3)) {
      R.push(`── ${v.arch} ×${v.cavities} ──`); R.push(...v.report); R.push('');
    }
    writeFileSync(`${dir}/REPORTE.txt`, R.join('\n'));
    writeFileSync(`${dir}/pieza.step`, occt.exportSTEP(oc, p.shape, 'p.step'));
    // geometría del molde para la MEJOR variante (split con escala pvT real)
    try {
      const best = fam.best;
      const m = mold.splitMold(oc, p.shape, { scale: best.analysis.moldScale, pinch: 0.5, plateThickness: 30, margin: 40, shutOffs: p.shutOffs });
      writeFileSync(`${dir}/cavity-plate.step`, occt.exportSTEP(oc, m.cavityPlate, 'c.step'));
      writeFileSync(`${dir}/core-plate.step`, occt.exportSTEP(oc, m.corePlate, 'k.step'));
      R.push(`geometría: cavity ${m.vols.cavity.toFixed(0)} · core ${m.vols.core.toFixed(0)} · cuerpos ${m.bodies}`);
      writeFileSync(`${dir}/REPORTE.txt`, R.join('\n'));
      console.log(`${p.name}: ★ ${best.arch}×${best.cavities} · $${best.analysis.partCostUSD.toFixed(3)}/pza · molde $${best.analysis.moldCostUSD.toLocaleString()} · split ${m.bodies >= 2 ? 'OK' : 'PUENTE⚠'}`);
    } catch (e) { console.log(`${p.name}: geometría ERR ${String(e).slice(0, 80)}`); }
    index.push(`${p.name}: mejor = ${fam.best.arch} ×${fam.best.cavities} ($${fam.best.analysis.partCostUSD.toFixed(3)}/pza)`);
  }
  writeFileSync(`${OUT}/INDICE.txt`, ['FÁBRICA DE MOLDES KAZMER — ' + total + ' variantes analizadas', '', ...index].join('\n'));
  console.log('FACTORY_OK', total, 'variantes');
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
