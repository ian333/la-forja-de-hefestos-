/**
 * TEST del molde-como-componentes: arma buildMoldParts(bezel) en node y reporta cada
 * componente (rol, nombre, triángulos, bbox). Falla si faltan pines/agua/pieza/guías.
 * Uso: node --import tsx scripts/mold-parts-test.cjs
 */
const path = require('path');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const occtFactory = require(cjsGlue);
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

const bezel = {   // cotas LITERALES del libro (Kazmer), ver scripts/kazmer-bezel-mold.cjs
  name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
  ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' },
  cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)', clampTons: 200,
  feed: 'hot-runner', sideAction: { aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }, nCav: 1,
};

function bbox(p) {
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[i + k]); mx[k] = Math.max(mx[k], p[i + k]); }
  return { mn, mx, size: mx.map((v, k) => +(v - mn[k]).toFixed(0)) };
}

(async () => {
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const t0 = Date.now();
  const parts = PS.buildMoldParts(K, oc, bezel, 'blocks');
  const ms = Date.now() - t0;
  console.log(`buildMoldParts(bezel,'blocks') → ${parts.length} componentes en ${ms} ms\n`);
  const roles = new Set();
  for (const p of parts) {
    const b = bbox(p.positions);
    roles.add(p.role);
    console.log(`  ${p.role.padEnd(8)} ${String(p.indices.length / 3).padStart(6)} △  z[${b.mn[2].toFixed(0)}..${b.mx[2].toFixed(0)}]  size ${b.size.join('×')}  ${p.name}`);
  }
  // ── VERIFICACIÓN NUMÉRICA: el agua NO choca con ningún barreno (feedback user) ──
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  const Dp = DS.plateDepth(bezel);
  const cc = DS.coolingCircuit(bezel, Dp);
  let worst = 1e9, worstInfo = '';
  for (const role of ['A', 'B']) for (const h of DS.standardHoles(bezel, role)) {
    for (const g of cc.segs.filter((g) => g.y0 === g.y1)) {
      if (h.x < Math.min(g.x0, g.x1) - h.dia / 2 || h.x > Math.max(g.x0, g.x1) + h.dia / 2) continue;
      const d = Math.abs(g.y0 - h.y) - cc.diaMm / 2 - h.dia / 2;
      if (d < worst) { worst = d; worstInfo = `${h.type}@(${h.x},${h.y}) vs canal y=${g.y0}`; }
    }
  }
  console.log(`\nholgura mínima agua↔barreno: ${worst.toFixed(1)} mm (${worstInfo})`);
  if (worst < 2.5) { console.log('❌ AGUA CHOCA con un barreno'); process.exit(1); }

  // ── LADO A LIBRA LA IMPRESIÓN (Eq 9.22 desde la superficie moldeante) ──
  // la impresión tallada sube depthMm sobre la partición; la línea A va a zAboveMm.
  const holguraA = cc.zAboveMm != null ? cc.zAboveMm - bezel.cavity.depthMm - cc.diaMm / 2 : -999;
  console.log(`holgura línea A ↔ tope de impresión: ${holguraA.toFixed(1)} mm (línea a ${cc.zAboveMm} mm, impresión ${bezel.cavity.depthMm} mm)`);
  if (holguraA < 3) { console.log('❌ LA LÍNEA A PERFORA (o roza) LA IMPRESIÓN'); process.exit(1); }
  // caso PIEZA ALTA (Benchy-like): dep 31 en placa A de 70 — debe librar o avisar
  const tall = { ...bezel, cavity: { ...bezel.cavity, depthMm: 31 }, plates: { ...bezel.plates, A: 70 } };
  const ccTall = DS.coolingCircuit(tall, DS.plateDepth(tall));
  const hTall = ccTall.zAboveMm != null ? ccTall.zAboveMm - 31 - ccTall.diaMm / 2 : -999;
  console.log(`pieza ALTA (dep 31, A=70): línea A a ${ccTall.zAboveMm ?? '—'} mm → holgura ${hTall.toFixed(1)} mm${ccTall.aWarn ? ' · ⚠ ' + ccTall.aWarn : ''}`);
  if (ccTall.zAboveMm != null && hTall < 3) { console.log('❌ pieza alta: línea A perfora la impresión'); process.exit(1); }

  // ── INSERTOS TALLADOS (heightfield): pirámide sintética → cav/core sin NaN, liso ──
  {
    const pm = { positions: new Float32Array([0, 0, 0, 40, 0, 0, 40, 30, 0, 0, 30, 0, 20, 15, 18]),
      indices: new Uint32Array([0, 2, 1, 0, 3, 2, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]) };
    const carvedParts = PS.buildMoldParts(K, oc, bezel, 'blocks', pm);
    const cav = carvedParts.find((p) => p.role === 'inserto-cav'), core = carvedParts.find((p) => p.role === 'inserto-core');
    if (!cav || !core) { console.log('❌ con partMesh no salieron insertos tallados'); process.exit(1); }
    let nan = 0, zMx = -1e9, zMn = 1e9;
    for (const part of [cav, core]) for (let i = 0; i < part.positions.length; i += 3) {
      if (Number.isNaN(part.positions[i]) || Number.isNaN(part.positions[i + 1]) || Number.isNaN(part.positions[i + 2])) nan++;
      zMx = Math.max(zMx, part.positions[i + 2]); zMn = Math.min(zMn, part.positions[i + 2]);
    }
    const zPart = PS.plateStackZ(bezel).A;
    console.log(`insertos tallados (pirámide): cav ${cav.indices.length / 3} △ · core ${core.indices.length / 3} △ · z[${zMn.toFixed(0)}..${zMx.toFixed(0)}] (partición ${zPart}) · NaN=${nan}`);
    if (nan > 0) { console.log('❌ tallado con NaN'); process.exit(1); }
    if (!(zMx > zPart && zMn < zPart)) { console.log('❌ tallado no cruza la partición'); process.exit(1); }
  }

  // ── EL ESTUDIO GATEA LA GEOMETRÍA (regla dura del generativo, nunca al revés) ──
  // Aquí el molde se CONSTRUYE de verdad, así que se puede comparar el tornillo REAL
  // contra el que el estudio eligió. Bug histórico: el molde se armaba con
  // moldBoltSizing (M16) mientras el panel mostraba otro (M10) — estudio decorativo.
  {
    const FA = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-fasteners.ts'));
    const plan = FA.fastenerPlan(bezel, { half: 'cavity' });
    // la tornillería son DOS componentes desde el fix de 2026-07-16: 'tornillos-cav'
    // (sube con la placa A al abrir) y 'tornillos-core' (se queda con B). Un solo
    // componente con las dos mitades no se podía animar y parecía amarrar A con B.
    const torn = parts.find((p) => /^tornillos/.test(p.role));
    if (!torn) { console.log(' ❌ no hay componente tornillos'); fails++; }
    else {
      const ok = torn.name.includes(plan.desig) || torn.material.includes(plan.desig);
      console.log(`\n${ok ? ' ✓' : ' ❌'} el molde se ARMA con el tornillo del ESTUDIO — construido "${torn.name.match(/M[\d.×]+/)?.[0]}" vs estudio "${plan.desig}"`);
      if (!ok) fails++;
    }
  }

  const need = ['pines', 'agua-a', 'agua-b', 'guias', 'pieza', 'colada'];
  const missing = need.filter((r) => !roles.has(r));
  console.log('\nfuncionales presentes:', need.filter((r) => roles.has(r)).join(', ') || '(ninguno)');
  if (missing.length) { console.log('❌ FALTAN:', missing.join(', ')); process.exit(1); }
  console.log('✓ el molde tiene placas + pines + enfriamiento + guías + pieza + colada + tallado A/B');
})().catch((e) => { console.error('TEST_FATAL', e); process.exit(1); });
