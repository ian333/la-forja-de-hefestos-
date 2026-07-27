/**
 * GATE DEL FLUJO DEL CURSO (curso-flow.ts) — los 6 botones del pipeline
 * PROCESO-1 contra invariantes duras (verification-first, patrón 8 del doc):
 * lazo cerrado (mensaje verde) · conservación de volumen · placas exactas
 * 350×630×145/90 · acero removido por las guías = fórmula de los counterbores.
 * Uso: node --import tsx scripts/curso-flow-test.cjs
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const oc = await require(path.join(distDir, 'opencascade.wasm.cjs'))({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const CF = await import(path.join(ROOT, 'src', 'forja', 'mold', 'curso-flow.ts'));
  const K = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));

  console.log('\n1) INSERT > PART (percha declarada):');
  const p1 = CF.insertarPercha(oc);
  console.log('   ' + p1.report.join('\n   '));
  check('vol percha cruda = kernel de referencia (120,956)', Math.abs(p1.volMm3 - 120956) < 60, `${p1.volMm3.toFixed(0)} mm³`);

  console.log('\n2) SCALE ×1.015:');
  const p2 = CF.escalaContraccion(oc, p1.shape, 1.015);
  console.log('   ' + p2.report.join('\n   '));
  check('factor volumétrico = 1.015³', Math.abs(p2.volDespues / p2.volAntes - 1.015 ** 3) < 1e-4, (p2.volDespues / p2.volAntes).toFixed(5));
  check('vPerchaE = telemetría archivada (126,480.6)', Math.abs(p2.volDespues - 126480.6) < 60, p2.volDespues.toFixed(1));

  console.log('\n3) MOVE/COPY — layout 2 cavidades:');
  const p3 = CF.layoutDosCavidades(oc, p2.shape);
  console.log('   ' + p3.report.join('\n   '));
  check('sin traslape (bandas X disjuntas)', p3.sinTraslape, p3.report[1]);

  console.log('\n4) PARTING LINES:');
  const p4 = CF.lineaParticion(oc, p3.cuerpos);
  console.log('   ' + p4.report.join('\n   '));
  check('MENSAJE VERDE (lazo completo)', p4.ok && p4.mensaje === CF.MENSAJE_VERDE, p4.mensaje.slice(0, 60));
  check('partición PLANA con lazo rico', p4.plana && p4.nVertices > 40, `${p4.nVertices} vértices, plana=${p4.plana}`);

  console.log('\n5) TOOLING SPLIT 350×630 · 145/90:');
  const p5 = CF.toolingSplitCurso(oc, p3.cuerpos);
  console.log('   ' + p5.report.join('\n   '));
  const volBlock = 350 * 630 * 235;
  check('vol conservado (cav+núcleo = bloque − piezas)', Math.abs(p5.vols.cavity + p5.vols.core - (volBlock - p3.volTotal)) / volBlock < 0.005,
    `${(p5.vols.cavity + p5.vols.core).toFixed(0)} vs ${(volBlock - p3.volTotal).toFixed(0)}`);
  check('núcleo = placa 350×630×90 maciza (espalda plana)', Math.abs(p5.vols.core - 350 * 630 * 90) / (350 * 630 * 90) < 0.005, p5.vols.core.toFixed(0));
  check('1 cuerpo por placa', p5.bodies.cavity === 1 && p5.bodies.core === 1, `cav ${p5.bodies.cavity} · núcleo ${p5.bodies.core}`);
  {
    const mb = K.tessellate(oc, p5.cavityPlate, 1.0, 1.0);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < mb.positions.length; i += 3) {
      x0 = Math.min(x0, mb.positions[i]); x1 = Math.max(x1, mb.positions[i]);
      y0 = Math.min(y0, mb.positions[i + 1]); y1 = Math.max(y1, mb.positions[i + 1]);
      z0 = Math.min(z0, mb.positions[i + 2]); z1 = Math.max(z1, mb.positions[i + 2]);
    }
    check('placa cavidad mide 350×630×145 EXACTO', Math.abs(x1 - x0 - 350) < 0.5 && Math.abs(y1 - y0 - 630) < 0.5 && Math.abs(z1 - z0 - 145) < 0.5,
      `${(x1 - x0).toFixed(1)}×${(y1 - y0).toFixed(1)}×${(z1 - z0).toFixed(1)}`);
  }

  console.log('\n6) HOLE WIZARD — guías:');
  const p6 = CF.guiasCurso(oc, p5.cavityPlate, p5.corePlate);
  console.log('   ' + p6.report.join('\n   '));
  const expCav = 4 * Math.PI * (24 * 24 * 145 + (27 * 27 - 24 * 24) * 10);
  const expCore = 4 * Math.PI * (17.5 * 17.5 * 90 + (20 * 20 - 17.5 * 17.5) * 8);
  check('acero removido cavidad = fórmula counterbore ⌀48/⌀54', Math.abs(p6.volQuitadoCav - expCav) / expCav < 0.005, `${p6.volQuitadoCav.toFixed(0)} vs ${expCav.toFixed(0)}`);
  check('acero removido núcleo = fórmula counterbore ⌀35/⌀40', Math.abs(p6.volQuitadoCore - expCore) / expCore < 0.005, `${p6.volQuitadoCore.toFixed(0)} vs ${expCore.toFixed(0)}`);

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ FLUJO DEL CURSO completo: 6 botones, cotas literales, invariantes verdes — listo para cablear a la UI.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
