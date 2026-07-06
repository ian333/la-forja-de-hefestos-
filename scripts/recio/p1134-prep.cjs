/**
 * Prepara la BIBLIOTECA para la lección U5L1 (ensamble 11-34 v1):
 *   1134-base  = placa 100×80×15 con barreno Ø20 pasante   (115,287.6 mm³)
 *   1134-link  = biela estadio centros 160, R25, 2×Ø20, e10 (~93,342 mm³)
 *   1134-pin   = pasador Ø20×35                              (10,995.6 mm³)
 * (El boss en D de la base llega con la v2 — brecha #3 de LO-RECIO.)
 */
const { ForjaAgent } = require('../forja-agent.cjs');
const fs = require('fs');
const path = require('path');
const BIB = path.join(__dirname, '..', '..', 'public', 'escuela', 'biblioteca');
fs.mkdirSync(BIB, { recursive: true });

function stadium() {
  const pts = [];
  for (let k = 0; k <= 24; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 24; pts.push({ x: 80 + 25 * Math.cos(a), y: 25 * Math.sin(a) }); }
  for (let k = 0; k <= 24; k++) { const a = Math.PI / 2 + (Math.PI * k) / 24; pts.push({ x: -80 + 25 * Math.cos(a), y: 25 * Math.sin(a) }); }
  return pts;
}

(async () => {
  const a = await new ForjaAgent().open();
  const saveAs = async (name) => {
    const doc = await a.eval('window.__forgeBrep.serializeDoc()');
    fs.writeFileSync(path.join(BIB, `${name}.json`), JSON.stringify(doc));
    console.log(`  → biblioteca/${name}.json`);
  };
  // Cada pieza se construye, se VERIFICA por volumen, y si la recarga fantasma
  // de la VM la corrompió, se REINTENTA — el prep no guarda basura.
  const pieza = async (name, esperado, tol, build) => {
    for (let t = 1; t <= 3; t++) {
      await a.newDoc();
      await build();
      await a.wait(2000);
      const vol = (await a.invariants())?.vol_kernel;
      console.log(`${name} intento ${t}: vol=${vol}`);
      if (vol != null && Math.abs(vol - esperado) < tol) { await saveAs(name); return true; }
      await a.reload();
    }
    console.log(`✗✗ ${name} NO construyó tras 3 intentos`);
    return false;
  };

  let ok = true;
  ok = (await pieza('1134-base', 115287.61, 20, async () => {
    await a.sketch({ kind: 'rect', width: 100, height: 80, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude'); await a.updateOpByType('extrude', { depth: 15 });
    await a.hole({ x: 0, y: 0, diameter: 20, through: true });
  })) && ok;
  ok = (await pieza('1134-link', 93295.74, 200, async () => {
    await a.sketch({ kind: 'custom', customProfile: stadium(), customHoles: [], customCircle: undefined, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude'); await a.updateOpByType('extrude', { depth: 10 });
    await a.hole({ x: -80, y: 0, diameter: 20, through: true });
    await a.hole({ x: 80, y: 0, diameter: 20, through: true });
  })) && ok;
  ok = (await pieza('1134-pin', 10995.57, 10, async () => {
    await a.sketch({ kind: 'circle', r: 10, radius: 10, plane: 'xy', planeOffset: 0, plane3d: undefined });
    await a.op('extrude'); await a.updateOpByType('extrude', { depth: 35 });
  })) && ok;

  console.log(ok ? 'PREP_OK' : 'PREP_FAIL');
  await a.close();
})();
