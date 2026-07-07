/**
 * La Forja — Test del generador de ROSCA MODELADA (thread.ts) en el kernel.
 * Verifica que makeThreadedRod produce un SÓLIDO válido con cuerda real:
 *   - volumen < cilindro liso (los surcos quitan material) pero no colapsa
 *   - malla con MUCHOS triángulos (el detalle helicoidal existe = se ve la cuerda)
 *   - exporta STL para inspección visual
 * Corre: node --import tsx scripts/occt-thread-test.cjs
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
  const thread = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'thread.ts'));
  const oc = await factory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);

  const D = 14, P = 3, L = 18;   // rosca COARSE visible (fina M8 no la arma MakePipe simple)
  const dims = thread.threadDims(D, P);
  console.log(`ROSCA ${thread.threadDesignation(D, P)}: h=${dims.h.toFixed(3)} d2=${dims.d2.toFixed(2)} d1=${dims.d1.toFixed(2)}`);

  // DIAG: la espira (coil) sola — ¿el barrido helicoidal del círculo es válido?
  { const R = D / 2 - P * 0.42, turns = L / P, n = Math.ceil(turns * 28), hx = [];
    for (let i = 0; i <= n; i++) { const t = (turns * 2 * Math.PI * i) / n; hx.push([R * Math.cos(t), R * Math.sin(t), (P * t) / (2 * Math.PI)]); }
    try {
      const coil = occt.sweepProfileAlong(oc, { kind: 'circle', center: { x: 0, y: 0 }, radius: P * 0.42 }, hx);
      const vc = occt.volume(oc, coil); const mc = occt.tessellate(oc, coil, 0.05, 0.35);
      const tc = (mc.positions ? mc.positions.length : 0) / 9;
      console.log(`DIAG coil solo (R=${R.toFixed(2)} wire=${(P * 0.42).toFixed(2)} turns=${turns}): vol=${vc.toFixed(1)} tris=${Math.round(tc)}`);
    } catch (e) { console.log('DIAG coil FALLÓ:', String(e).slice(0, 120)); }
  }

  const cyl = occt.makeCylinder(oc, D / 2, L);
  const volCyl = occt.volume(oc, cyl);
  console.log(`cilindro liso Ø${D}×${L}: vol=${volCyl.toFixed(1)} (π·${(D / 2) ** 2}·${L}=${(Math.PI * (D / 2) ** 2 * L).toFixed(1)})`);

  let rod, volRod, tris = 0;
  const t0 = Date.now();
  try {
    rod = thread.makeThreadedRod(oc, D, P, L);
    volRod = occt.volume(oc, rod);
    const mesh = occt.tessellate(oc, rod, 0.05, 0.35);
    tris = (mesh.positions ? mesh.positions.length : (mesh.pos ? mesh.pos.length : 0)) / 9;
    console.log(`BARRA ROSCADA: vol=${volRod.toFixed(1)} (${((1 - volRod / volCyl) * 100).toFixed(1)}% menos) · ${Math.round(tris)} triángulos · ${Date.now() - t0}ms`);
    // exporta STL para verlo
    if (occt.exportSTL) { writeFileSync('/tmp/rosca-M8.stl', occt.exportSTL(oc, rod)); console.log('STL → /tmp/rosca-M8.stl'); }
  } catch (e) {
    console.log('FALLÓ makeThreadedRod:', String(e).slice(0, 200));
    process.exit(2);
  }

  // Veredicto: cuerda real = volumen bajó (surcos) pero sigue siendo >70% (no colapsó)
  const reduc = 1 - volRod / volCyl;
  const okVol = reduc > 0.02 && reduc < 0.35;
  const okTris = tris > 800; // el detalle helicoidal mete miles de triángulos
  console.log(okVol && okTris
    ? `✓ CUERDA VÁLIDA (vol −${(reduc * 100).toFixed(1)}%, ${Math.round(tris)} tris)`
    : `✗ sospechoso: okVol=${okVol} (−${(reduc * 100).toFixed(1)}%) okTris=${okTris} (${Math.round(tris)})`);
  process.exit(okVol && okTris ? 0 : 1);
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(3); });
