/**
 * EXPERIMENTO video→robot: ingeniería inversa de una JUNTA CICLOIDAL.
 * =================================================================
 * 1) Referencia: animación real de un cycloidal drive (Wikimedia).
 * 2) Clasificación (visión): clase=cicloidal, ~12 ring-pins → 11 lóbulos → 11:1,
 *    ~6 pernos de salida, 1 disco. (5 números, no geometría.)
 * 3) GENERACIÓN: La Forja instancia un cicloidal PRINT-IN-PLACE desde esos números
 *    (su generador ya probado), TODO por la interfaz (sin hardcodear geometría).
 * 4) FÍSICA: dinamica.ts + la reducción → qué brazo mueve este actuador.
 * Salida: STL imprimible + hoja de specs. Ultra-barato, en minutos.
 */
const path = require('path');
const { ForjaAgent } = require('./forja-agent.cjs');
const OUT = process.env.OUT || '/tmp/exp-cicloidal';
require('fs').mkdirSync(OUT, { recursive: true });

// ── lo que "vi" en la referencia (clasificación) ──
const SPEC = { clase: 'cicloidal', ringPins: 12, lobes: 11, outPins: 6, discs: 1 };

(async () => {
  const dyn = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mech', 'dinamica.ts'));
  const a = await new ForjaAgent().open();

  // ── GENERAR el cicloidal print-in-place desde el SPEC, por la interfaz ──
  await a.newDoc();
  await a.eval('window.__forgeBrep.applyGearbox && window.__forgeBrep.applyGearbox()');
  await a.wait(1500);
  const defaults = await a.eval('window.__forgeBrep.gearbox');
  await a.eval(`window.__forgeBrep.updateGearbox(${JSON.stringify({ lobes: SPEC.lobes, discs: SPEC.discs, outPins: SPEC.outPins })})`);
  // el cicloidal reconstruye lento; espera a que el volumen cambie del default
  await a.wait(3500);

  const gearbox = await a.eval('window.__forgeBrep.gearbox');
  const geom = await a.eval('window.__forgeBrep.gearboxGeom').catch(() => null);
  const inv = await a.invariants();
  const massKg = inv && inv.mass_g != null ? inv.mass_g / 1000 : null;

  // ── exportar STL imprimible + still ──
  await a.eval('window.__forgeBrep.exportSTL && window.__forgeBrep.exportSTL()');
  await a.shot(`${OUT}/cicloidal.png`);

  // ── FÍSICA: reducción = nº lóbulos; NEMA17 de entrada → torque de salida ──
  const reduction = SPEC.lobes;                 // 11:1 (housing fijo, salida por pernos)
  const nema17_Nm = 0.45;                        // par de retención típico NEMA17
  const outTorque = nema17_Nm * reduction;       // par en la junta
  // ¿qué brazo sostiene? un eslabón a `reach` con carga en la punta:
  const g = dyn.G;
  const payloadAt = (reachM) => outTorque / (g * reachM);   // kg en la punta (ignora peso del eslabón)
  const arm = dyn.armStatics({ links: [{ lengthM: 0.20, massKg: massKg || 0.3 }], payloadKg: 0.5 });

  const spec = {
    referencia: 'Wikimedia Cycloidal_drive.gif (animación real)',
    clasificacion: SPEC,
    generado_por: 'interfaz La Forja (applyGearbox + updateGearbox) — print-in-place',
    geometria: { lobes: gearbox && gearbox.lobes, discs: gearbox && gearbox.discs, outPins: gearbox && gearbox.outPins, R: gearbox && gearbox.R, ringPins: (gearbox && gearbox.lobes) + 1, vol_mm3: inv && inv.vol_kernel, masa_g: inv && inv.mass_g },
    fisica: {
      reduccion: `${reduction}:1`,
      entrada_NEMA17_Nm: nema17_Nm,
      par_salida_Nm: +outTorque.toFixed(2),
      carga_punta_a_0_15m_kg: +payloadAt(0.15).toFixed(2),
      carga_punta_a_0_25m_kg: +payloadAt(0.25).toFixed(2),
      torque_sosten_brazo_Nm: +arm.baseTorqueNm.toFixed(2),
    },
    costo: 'una sola impresión (PLA) + 1 NEMA17 + 1 rodamiento — backlash ~cero (cicloidal)',
  };
  require('fs').writeFileSync(`${OUT}/spec.json`, JSON.stringify(spec, null, 2));
  console.log(JSON.stringify(spec, null, 2));
  console.log('telemetría:', JSON.stringify(a.telemetry().by_type));
  await a.close();
})();
