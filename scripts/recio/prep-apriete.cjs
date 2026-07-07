/**
 * Pieza para U9-L3 "El apriete": eje-apriete Ø20.03 (r=10.015) × 45 → 14,179.5 mm³.
 * Reusa buje-h7 (agujero Ø20). Interferencia = 20.03 − 20.00 = +0.03 mm → ajuste de APRIETE.
 */
const { ForjaAgent } = require('../forja-agent.cjs');
const fs = require('fs'); const path = require('path');
const BIB = path.join(__dirname, '..', '..', 'public', 'escuela', 'biblioteca');
(async () => {
  const a = await new ForjaAgent().open();
  const saveAs = async (n) => { const d = await a.eval('window.__forgeBrep.serializeDoc()'); fs.writeFileSync(path.join(BIB, `${n}.json`), JSON.stringify(d)); console.log(`  → ${n}.json`); };
  for (let t = 1; t <= 3; t++) {
    await a.newDoc();
    await a.sketch({ kind: 'circle', r: 10.015, radius: 10.015, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude'); await a.updateOpByType('extrude', { depth: 45 });
    await a.wait(2000);
    const vol = (await a.invariants())?.vol_kernel;
    console.log(`eje-apriete intento ${t}: vol=${vol}`);
    if (vol != null && Math.abs(vol - 14179.5) < 25) { await saveAs('eje-apriete'); break; }
    await a.reload();
  }
  console.log('PREP_OK'); await a.close();
})();
