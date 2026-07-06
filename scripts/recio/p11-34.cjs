/**
 * LO RECIO — Problema 11-34 del Bethune (CSWA): LINK ASSEMBLY (3 piezas).
 * =======================================================================
 * Construye las 3 piezas POR LA INTERFAZ (ForjaAgent → window.__forgeBrep),
 * verifica cada una por VOLUMEN EXACTO contra la figura del libro, captura
 * shots, e intenta el ENSAMBLE — donde truene, LO REPORTA como brecha.
 *
 *   BASE: placa 100×80×15 + boss en D (rect 30×60 + semidisco R30) join 10
 *         + barreno Ø20 pasante por boss y placa.        V≈144,282 mm³
 *   LINK: biela estadio (centros a 160, R25) 10 esp, 2×Ø20.  V≈93,352 mm³
 *   PIN:  cilindro Ø20×35.                                 V≈10,996 mm³
 *
 *   NODE_PATH=... DISPLAY=:0 ... node scripts/recio/p11-34.cjs [outDir]
 */
const { ForjaAgent } = require('../forja-agent.cjs');
const fs = require('fs');
const OUT = process.argv[2] || '/tmp/recio-p11-34';
fs.mkdirSync(OUT, { recursive: true });

const report = { problema: 'Bethune 11-34 LINK ASSEMBLY', piezas: [], brechas: [] };
const gap = (que, detalle) => { report.brechas.push({ que, detalle }); console.log(`  ⛏ BRECHA: ${que} — ${detalle}`); };

// Semidisco R30 a +u desde (0,0): D = rect u∈[-30,0] v±30 + semicírculo.
function dProfile() {
  const pts = [{ x: -30, y: -30 }, { x: 0, y: -30 }];
  for (let k = 0; k <= 24; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 24;
    pts.push({ x: 30 * Math.cos(a), y: 30 * Math.sin(a) });
  }
  pts.push({ x: 0, y: 30 }, { x: -30, y: 30 });
  return pts;
}
// Estadio (slot): centros ±80, R25.
function stadiumProfile() {
  const pts = [];
  for (let k = 0; k <= 24; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 24; pts.push({ x: 80 + 25 * Math.cos(a), y: 25 * Math.sin(a) }); }
  for (let k = 0; k <= 24; k++) { const a = Math.PI / 2 + (Math.PI * k) / 24; pts.push({ x: -80 + 25 * Math.cos(a), y: 25 * Math.sin(a) }); }
  return pts;
}

(async () => {
  const a = await new ForjaAgent().open();
  const pieza = async (nombre, esperado, build) => {
    console.log(`\n▶ ${nombre}`);
    await a.newDoc();
    try {
      await build();
      await a.wait(1500);
      const inv = await a.invariants();
      const vol = inv && inv.vol_kernel;
      const ok = vol != null && Math.abs(vol - esperado) < Math.max(10, esperado * 0.002);
      await a.call('setView', 'iso'); await a.wait(1400);
      await a.shot(`${OUT}/${nombre}.png`);
      report.piezas.push({ nombre, esperado, vol, ok, euler: inv && inv.euler });
      console.log(`  vol=${vol && vol.toFixed(1)} esperado=${esperado} ${ok ? '✓ EXACTO' : '✗ REVISAR'}`);
      const doc = await a.eval('window.__forgeBrep.serializeDoc && window.__forgeBrep.serializeDoc()');
      if (doc) fs.writeFileSync(`${OUT}/${nombre}.doc.json`, JSON.stringify(doc));
    } catch (e) {
      report.piezas.push({ nombre, esperado, error: String(e).slice(0, 200) });
      console.log(`  ✗ ERROR: ${String(e).slice(0, 160)}`);
    }
  };

  // ── BASE ──
  await pieza('base', 144282.7, async () => {
    await a.sketch({ kind: 'rect', width: 100, height: 80, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude');
    await a.updateOpByType('extrude', { depth: 15 });
    await a.wait(1200);
    // Boss en D sobre la cara superior (z=15), saliente 10.
    await a.addComponent('sketch', {
      name: 'Boss D', profile: dProfile(), holes: [], bool: 'union', depth: 10,
      plane3d: { origin: [0, 0, 15], uDir: [1, 0, 0], vDir: [0, 1, 0] },
    });
    await a.wait(1500);
    // Barreno Ø20 PASANTE por boss+placa: cilindro subtract alto (no el hole op,
    // que solo perfora el extrude base — si esto es cierto, es una BRECHA a anotar).
    await a.addComponent('cyl', { name: 'Barreno Ø20', r: 10, h: 80, x: 0, y: 0, z: -20, bool: 'subtract' });
    await a.wait(1500);
  });

  // ── LINK ──
  await pieza('link', 93352.4, async () => {
    await a.sketch({ kind: 'custom', customProfile: stadiumProfile(), customHoles: [], customCircle: undefined, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude');
    await a.updateOpByType('extrude', { depth: 10 });
    await a.wait(1200);
    await a.addComponent('cyl', { name: 'Ojo 1', r: 10, h: 40, x: -80, y: 0, z: -15, bool: 'subtract' });
    await a.addComponent('cyl', { name: 'Ojo 2', r: 10, h: 40, x: 80, y: 0, z: -15, bool: 'subtract' });
    await a.wait(1500);
  });

  // ── PIN ──
  await pieza('pin', 10995.6, async () => {
    await a.sketch({ kind: 'circle', r: 10, radius: 10, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude');
    await a.updateOpByType('extrude', { depth: 35 });
    await a.wait(1200);
  });

  // ── ENSAMBLE (aquí es donde esperamos tronar) ──
  console.log('\n▶ ensamble');
  const asmApi = await a.eval('Object.keys(window.__forgeBrep).filter((k) => /asm|assembl|mate|insert|import/i.test(k))');
  console.log('  API de ensamble disponible:', JSON.stringify(asmApi));
  // OJO: importStepText (STEP) y applyGearMate (solo engranes) NO son ensamble genérico.
  if (!asmApi.some((k) => /insertPart|addInstance|mateConcentric|mateCoincident/i.test(k))) {
    gap('ENSAMBLE GENÉRICO', 'No hay forma de insertar piezas guardadas en un doc de ensamble ni mates (concéntrico/coincidente). Solo existe el ensamble especial de engranes (gearbox). El 11-34 pide: base + link + pin unidos por el pasador.');
  }

  fs.writeFileSync(`${OUT}/reporte.json`, JSON.stringify(report, null, 2));
  console.log(`\nreporte → ${OUT}/reporte.json`);
  console.log(`RECIO_${report.piezas.every((p) => p.ok) ? 'PIEZAS_OK' : 'CON_FALLAS'} brechas=${report.brechas.length}`);
  await a.close();
})();
