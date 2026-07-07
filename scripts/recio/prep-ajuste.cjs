/**
 * Piezas para U9-L2 "El ajuste" (tolerancias/ajustes):
 *   buje-h7        = balero de camisa, OD Ø40, agujero Ø20 (H7), largo 25  → 23,561.9 mm³
 *   eje-deslizante = eje Ø19.98 (g6) × 45                                   → 14,108.8 mm³
 * Holgura = 20.00 − 19.98 = 0.02 mm → ajuste DESLIZANTE (el eje gira en el buje).
 */
const { ForjaAgent } = require('../forja-agent.cjs');
const fs = require('fs'); const path = require('path');
const BIB = path.join(__dirname, '..', '..', 'public', 'escuela', 'biblioteca');
fs.mkdirSync(BIB, { recursive: true });
(async () => {
  const a = await new ForjaAgent().open();
  const saveAs = async (n) => { const d = await a.eval('window.__forgeBrep.serializeDoc()'); fs.writeFileSync(path.join(BIB, `${n}.json`), JSON.stringify(d)); console.log(`  → ${n}.json`); };
  const pieza = async (name, esperado, tol, build) => {
    for (let t = 1; t <= 3; t++) {
      await a.newDoc(); await build(); await a.wait(2000);
      const vol = (await a.invariants())?.vol_kernel;
      console.log(`${name} intento ${t}: vol=${vol}`);
      if (vol != null && Math.abs(vol - esperado) < tol) { await saveAs(name); return; }
      await a.reload();
    }
    console.log(`✗✗ ${name} NO construyó`);
  };
  // buje: disco Ø40 × 25 con agujero Ø20 pasante
  await pieza('buje-h7', 23561.9, 30, async () => {
    await a.sketch({ kind: 'circle', r: 20, radius: 20, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude'); await a.updateOpByType('extrude', { depth: 25 });
    await a.hole({ x: 0, y: 0, diameter: 20, through: true });
  });
  // eje deslizante Ø19.98 × 45
  await pieza('eje-deslizante', 14108.8, 20, async () => {
    await a.sketch({ kind: 'circle', r: 9.99, radius: 9.99, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude'); await a.updateOpByType('extrude', { depth: 45 });
  });
  console.log('PREP_OK');
  await a.close();
})();
