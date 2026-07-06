/**
 * LO RECIO — prueba de fuego del ENSAMBLE GENÉRICO (kind 'pieza').
 * 1) Construye una PLACA (100×60×20) y un PIN (Ø20×35) y los guarda en la biblioteca.
 * 2) Doc nuevo: INSERTA ambas piezas, posiciona el pin, y verifica el volumen del
 *    compound = suma EXACTA de las piezas (130,995.57 mm³).
 *
 *   NODE_PATH=... DISPLAY=:0 ... node scripts/recio/test-ensamble.cjs [outDir]
 */
const { ForjaAgent } = require('../forja-agent.cjs');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/test-ensamble';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const a = await new ForjaAgent().open();
  const saveAs = async (name) => {
    await a.page.evaluate((n) => {
      const KEY = 'forja:library:v1';
      const lib = JSON.parse(localStorage.getItem(KEY) || '{}');
      lib[n] = window.__forgeBrep.serializeDoc();
      localStorage.setItem(KEY, JSON.stringify(lib));
    }, name);
    console.log(`  guardada en biblioteca: ${name}`);
  };

  // 1) PLACA 100×60×20
  await a.newDoc();
  await a.sketch({ kind: 'rect', width: 100, height: 60, plane: 'xy', planeOffset: 0, plane3d: undefined });
  await a.op('extrude');
  await a.updateOpByType('extrude', { depth: 20 });
  await a.wait(1500);
  const invP = await a.invariants();
  console.log(`placa vol=${invP && invP.vol_kernel}`);
  await saveAs('test-placa');

  // 2) PIN Ø20×35
  await a.newDoc();
  await a.sketch({ kind: 'circle', r: 10, radius: 10, plane: 'xy', planeOffset: 0, plane3d: undefined });
  await a.op('extrude');
  await a.updateOpByType('extrude', { depth: 35 });
  await a.wait(1500);
  const invPin = await a.invariants();
  console.log(`pin vol=${invPin && invPin.vol_kernel}`);
  await saveAs('test-pin');

  // 3) ENSAMBLE: doc nuevo + insertar ambas + posicionar pin encima de la placa.
  await a.newDoc();
  // El doc nuevo trae una pieza-demo (rect 40×24 × extrude 12 = 11,520 mm³): un
  // ensamble empieza LIMPIO — borra las ops base.
  const baseOps = await a.eval('window.__forgeBrep.opsList');
  for (const o of baseOps) { await a.call('removeOp', o.id); await a.wait(300); }
  const libs = await a.eval('window.__forgeBrep.libraryNames && window.__forgeBrep.libraryNames()');
  console.log('biblioteca:', JSON.stringify(libs));
  await a.call('insertPieza', 'test-placa');
  await a.wait(2500);
  await a.call('insertPieza', 'test-pin');
  await a.wait(2500);
  const comps = await a.eval('window.__forgeBrep.components');
  const pin = comps[comps.length - 1];
  await a.call('updateComponent', pin.id, { x: 25, y: 10, z: 20 });   // pin parado sobre la placa
  await a.wait(2500);
  const inv = await a.invariants();
  const esperado = 120000 + Math.PI * 100 * 35;   // 130,995.57
  const vol = inv && inv.vol_kernel;
  console.log(`ensamble vol=${vol && vol.toFixed(2)} esperado=${esperado.toFixed(2)} euler=${inv && inv.euler}`);
  await a.call('setView', 'iso'); await a.wait(1600);
  await a.shot(`${OUT}/ensamble.png`);
  const ok = vol != null && Math.abs(vol - esperado) < 5;
  console.log(ok ? '✓✓ ENSAMBLE GENÉRICO FUNCIONA — compound exacto' : '✗✗ ENSAMBLE FALLA');
  console.log(`ENSAMBLE_${ok ? 'OK' : 'FAIL'}`);
  await a.close();
})();
