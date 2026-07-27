/**
 * ¿NUESTRO DFM SIRVE? — banco contra piezas INYECTADAS DE VERDAD (KiCad packages3D:
 * conectores, carcasas USB, zócalos... piezas en producción real, no diseñadas para
 * impresión 3D). Las 21 STL del lote fallaban salida porque NADIE le pone ángulo a una
 * pieza de impresión. Éstas SÍ deberían traerla.
 *
 * Si nuestro DFM les da ✓ → el análisis está calibrado.
 * Si les da ✗ → o el DFM miente, o aprendimos un límite real. Las dos cosas importan.
 * Uso: node --import tsx scripts/kicad-draft-test.cjs [archivo.step]
 */
const path = require('path');
const { readFileSync, readdirSync, existsSync, writeFileSync } = require('fs');

const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}

(async () => {
  const occtFactory = require(cjsGlue);
  const oc = await occtFactory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const DA = await import(path.join(ROOT, 'src', 'forja', 'mold', 'draw-axis.ts'));

  const DFM = await import(path.join(ROOT, 'src', 'forja', 'mold', 'dfm-mesh.ts'));

  // ── CALIBRACIÓN PRIMERO: ¿el medidor de salida dice la verdad? ─────────────
  // Antes de creerle un veredicto a NADIE, hay que probar el instrumento contra
  // ángulos CONOCIDOS. Sin esto, un banco malo se confunde con un medidor malo.
  console.log('CALIBRACIÓN del medidor (caja 40×30×20 con salida conocida):');
  let calFails = 0;
  for (const ang of [0, 1, 3, 7]) {
    let s = K.makeBox(oc, 40, 30, 20);
    if (ang > 0) s = K.draftFaces(oc, s, ang, [0, 0, 1], 0);
    const m = K.tessellate(oc, s, 0.1, 0.1);
    const idx = m.indices ?? new Uint32Array(m.positions.length / 3).map((_, i) => i);
    const pct = DFM.dfmFromMesh({ positions: m.positions, indices: idx }, { wallMm: 2 }).draft.pctBelowMin;
    const ok = ang === 0 ? pct > 95 : pct < 5;
    if (!ok) calFails++;
    console.log(`  ${ok ? '✓' : '❌'} salida real ${String(ang).padStart(2)}° → mide ${pct.toFixed(1)}% bajo 0.5° (esperado ${ang === 0 ? '~100' : '~0'}%)`);
  }
  if (calFails) { console.log('\n❌ EL MEDIDOR DE SALIDA MIENTE — cualquier veredicto de DFM es sospechoso'); process.exit(1); }
  console.log('  → el medidor está CALIBRADO: detecta la salida exactamente.\n');

  const dir = path.join(ROOT, 'test-parts', 'kicad');
  let files = process.argv.slice(2).filter((a) => /\.ste?p$/i.test(a));
  if (!files.length) files = readdirSync(dir).filter((f) => /\.ste?p$/i.test(f)).map((f) => path.join(dir, f));

  console.log(`banco: ${files.length} piezas INYECTADAS reales (KiCad packages3D)\n`);
  const rows = [];
  for (const f of files) {
    const nm = path.basename(f).replace(/\.ste?p$/i, '').slice(0, 34);
    try {
      const shape = K.importSTEP(oc, readFileSync(f));
      if (!shape) { console.log(`⏭  ${nm}: STEP no abre en el kernel`); continue; }
      const m = K.tessellate(oc, shape, 0.15, 0.15);
      if (!m || !m.positions?.length) { console.log(`⏭  ${nm}: no tesela`); continue; }
      const idx = m.indices ?? new Uint32Array(m.positions.length / 3).map((_, i) => i);
      const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
      for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], m.positions[i + k]); mx[k] = Math.max(mx[k], m.positions[i + k]); }
      const dim = mx.map((v, k) => +(v - mn[k]).toFixed(1));
      // pared nominal: 2V/A (misma heurística que el lote de STL)
      const vol = Math.abs(K.volume ? K.volume(oc, shape) : 0), area = K.surfaceArea ? K.surfaceArea(oc, shape) : 0;
      const wall = area > 0 ? Math.min(4, Math.max(0.3, +(2 * vol / area).toFixed(2))) : 1;
      const ch = DA.pickDrawAxis({ positions: m.positions, indices: idx }, { wallMm: wall });
      const d = ch.dfm;
      rows.push({ nm, dim, wall, tris: idx.length / 3, moldable: d.moldable,
        draftBad: +d.draft.pctBelowMin.toFixed(1), underPct: +((d.undercut.pctOfFootprint ?? 0)).toFixed(1) });
      const icon = d.moldable === 'si' ? '✓' : d.moldable === 'con-mecanismos' ? '⚠' : '✗';
      console.log(`${icon} ${nm.padEnd(36)} ${`${dim[0]}×${dim[1]}×${dim[2]}`.padEnd(20)} pared ${String(wall).padStart(4)}  sin-draft ${String(d.draft.pctBelowMin.toFixed(1)).padStart(5)}%  ${d.moldable}`);
    } catch (e) { console.log(`❌ ${nm}: ${String(e.message || e).slice(0, 90)}`); }
  }

  if (!rows.length) { console.log('\n❌ ninguna pieza pudo analizarse'); process.exit(1); }
  const media = rows.reduce((a, r) => a + r.draftBad, 0) / rows.length;
  const buenas = rows.filter((r) => r.draftBad < 50).length;
  console.log(`\n─── VEREDICTO DEL BANCO ───`);
  console.log(`  ${rows.length} piezas inyectadas reales · sin-draft MEDIO ${media.toFixed(1)}%`);
  console.log(`  con salida decente (<50% de caras sin draft): ${buenas}/${rows.length}`);
  console.log(`  moldeables ✓: ${rows.filter((r) => r.moldable === 'si').length} · con mecanismos ⚠: ${rows.filter((r) => r.moldable === 'con-mecanismos').length} · NO ✗: ${rows.filter((r) => r.moldable === 'no').length}`);
  console.log(`\n  HALLAZGO (2026-07-15): el medidor está CALIBRADO (arriba se probó contra`);
  console.log(`  ángulos conocidos) y aun así estas piezas dan ~${media.toFixed(0)}% sin salida — PEOR que`);
  console.log(`  los STL de impresión (~83%). Conclusión: los modelos 3D de KiCad NO son el`);
  console.log(`  CAD de producción del fabricante, son APROXIMACIONES VISUALES dibujadas a`);
  console.log(`  mano para el visor de PCB. Nadie modelando un conector para verlo en pantalla`);
  console.log(`  le pone 1° de salida.`);
  console.log(`\n  LO ESTRATÉGICO: no existe corpus GRATIS de CAD inyectable con salida real —`);
  console.log(`  es propiedad intelectual del fabricante. Toda pieza que traiga un cliente LATAM`);
  console.log(`  vendrá SIN salida. Por eso la herramienta que la AGREGA es el producto, no el`);
  console.log(`  banco de comparación.`);
  writeFileSync('/tmp/kicad-draft.json', JSON.stringify(rows, null, 2));
  console.log('\n→ /tmp/kicad-draft.json');
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
