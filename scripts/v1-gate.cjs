/**
 * EL v1-GATE — la DEFINICIÓN DE HECHO mecánica de "Tu primera pieza, tu primer
 * molde" (orden v1·6): STEPs AJENOS entran a ciegas y la Máquina responde.
 *
 *   exige: 10/10 importan · 10/10 cotizan · ≥8/10 parten (cuerpos=2, ∩=∅)
 *
 * A CIEGAS: el juez lee SOLO el archivo .stp + su intake §2.1.5 (sidecar:
 * nombre/pared/redonda — lo que un cliente declara). Nada de __forgeBrep, nada
 * de conocer la construcción.
 *
 * HOY (sin red para GrabCAD/Thingiverse): el generador de abajo fabrica 10
 * variantes PARAMÉTRICAS de la familia tapa/vaso/caja con PRNG sembrado,
 * las exporta a STEP y el juez las RE-IMPORTA del archivo. Los 10 STEPs
 * reales con URL + los 5 humanos quedan DECLARADOS PENDIENTES (ian).
 *
 *   node --import tsx scripts/v1-gate.cjs               (genera + juzga)
 *   node --import tsx scripts/v1-gate.cjs --dir <ruta>  (STEPs de ian + sidecars .json)
 */
const { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } = require('fs');
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

// PRNG sembrado (mulberry32): las variantes son REPRODUCIBLES, no elegidas a mano.
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

(async () => {
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const ed = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'estudio-molde-datos.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);

  const argDir = process.argv.indexOf('--dir');
  let dir = argDir > -1 ? process.argv[argDir + 1] : '';

  if (!dir) {
    // ── GENERADOR (separado del juez; el juez solo verá los archivos) ──
    dir = '/tmp/v1-gate-steps';
    mkdirSync(dir, { recursive: true });
    const rnd = mulberry32(20260825);
    const entre = (a, b) => a + rnd() * (b - a);
    const r1 = (x) => Math.round(x * 10) / 10;
    for (let i = 0; i < 10; i++) {
      const fam = i < 4 ? 'vaso' : i < 8 ? 'caja' : 'tapa';
      let shape, side;
      if (fam === 'vaso') {
        const R = r1(entre(30, 55)), H = r1(entre(15, 45)), w = r1(entre(1.5, 3.5));
        shape = occt.cut(oc, occt.makeCylinder(oc, R, H),
          occt.transformShape(oc, occt.makeCylinder(oc, R - w, H), { translate: [0, 0, w] }));
        side = { nombre: `AJENO-${i + 1} · vaso ⌀${2 * R}×${H}`, wallMm: w, round: true };
      } else {
        const L = fam === 'caja' ? r1(entre(60, 140)) : r1(entre(70, 150));
        const W = fam === 'caja' ? r1(entre(40, 100)) : r1(entre(50, 110));
        const H = fam === 'caja' ? r1(entre(15, 40)) : r1(entre(8, 14));
        const w = r1(entre(1.5, 3));
        shape = occt.cut(oc, occt.makeBox(oc, L, W, H),
          occt.transformShape(oc, occt.makeBox(oc, L - 2 * w, W - 2 * w, H), { translate: [w, w, w] }));
        side = { nombre: `AJENO-${i + 1} · ${fam} ${L}×${W}×${H}`, wallMm: w, round: false };
      }
      writeFileSync(path.join(dir, `ajeno-${i + 1}.stp`), occt.exportSTEP(oc, shape));
      writeFileSync(path.join(dir, `ajeno-${i + 1}.json`), JSON.stringify(side));
    }
    console.log(`· 10 STEPs paramétricos generados (semilla 20260825) → ${dir}`);
  }

  // ── EL JUEZ — a ciegas: solo el .stp + su intake ──
  const steps = readdirSync(dir).filter((f) => /\.st(e?p)$/i.test(f)).sort();
  const filas = [];
  for (const f of steps) {
    const fila = { archivo: f, importa: false, cotiza: false, parte: false, detalle: '' };
    try {
      const side = JSON.parse(readFileSync(path.join(dir, f.replace(/\.st(e?p)$/i, '.json')), 'utf8'));
      const shape = occt.importSTEP(oc, readFileSync(path.join(dir, f), 'utf8'));
      const vol = occt.volume(oc, shape);
      if (!(vol > 1)) throw new Error('importó vacío');
      fila.importa = true;
      const pz = ed.piezaDesdeArbol(oc, shape, { nombre: side.nombre, wallMm: side.wallMm, round: !!side.round });
      const cot = ed.cotizacionPieza(pz, { fecha: '2026-08-25' });
      if (!(cot.dinero.moldeUSD > 0 && cot.dinero.totalPzaUSD > 0 && /\d+×\d+/.test(cot.molde.baseNombre))) throw new Error('cotización coja');
      fila.cotiza = true;
      fila.detalle = `${cot.molde.baseNombre.split(' (')[0]} · $${cot.dinero.moldeUSD.toLocaleString('en-US')} · $${cot.dinero.totalPzaUSD}/pza`;
      const e2 = ed.estacion2(pz);
      const acero = ed.construirAceroE3(oc, e2.pkg, false, undefined, pz);
      const inter = ed.interseccionMitades(oc, acero.r.cavityPlate, acero.r.macho);
      fila.parte = acero.r.bodies === 2 && inter.ok;
      if (!fila.parte) fila.detalle += ` · NO parte (cuerpos ${acero.r.bodies})`;
    } catch (e) {
      fila.detalle = String((e && e.message) || e).slice(0, 90);
    }
    console.log(`  ${fila.parte ? '✔' : fila.cotiza ? '◐' : fila.importa ? '◔' : '✘'} ${fila.archivo} — ${fila.detalle}`);
    filas.push(fila);
  }
  const n = filas.length, imp = filas.filter((x) => x.importa).length,
    cot = filas.filter((x) => x.cotiza).length, par = filas.filter((x) => x.parte).length;
  const pass = n >= 10 && imp === n && cot === n && par >= Math.ceil(n * 0.8);
  console.log(`\n  importan ${imp}/${n} · cotizan ${cot}/${n} · parten ${par}/${n} (exige ${n}/${n} · ${n}/${n} · ≥${Math.ceil(n * 0.8)})`);
  console.log('\n  PENDIENTES DECLARADOS (no son de esta corrida):');
  console.log('  · 10 STEPs REALES de GrabCAD/Thingiverse con URL — cuando ian los baje: --dir <ruta>');
  console.log('  · 5 humanos con `forja.leccion.completa` en telemetría, sin DM de ayuda');
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, n, importan: imp, cotizan: cot, parten: par }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('VERIFY_RESULT=' + JSON.stringify({ pass: false, fatal: String(e).slice(0, 300) })); process.exit(1); });
