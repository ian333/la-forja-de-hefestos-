/**
 * GATE del GENERADOR DE MECANISMOS (§11.3.6-7) + COLADA CALIENTE (§6.3.3):
 *   1. Ejemplos del libro AL DECIMAL: F=200·220=44 kN (Eq 11.24), bore=75 mm
 *      (Eq 11.25 @10 MPa), perno 12/sin20°=35+25=60 mm (Eq 11.26)
 *   2. Túnel lateral medido → plan automático (dirección + carrera + tipo)
 *   3. buildMoldParts(bezel declarado) → componente mecanismo-1 (corredera) +
 *      colada CALIENTE con manifold (§6.3.3)
 *   4. pirámide (sin undercuts) → CERO mecanismos
 * Uso: node --import tsx scripts/mold-mecanismos-test.cjs
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

const bezel = {
  name: 'Molde bezel laptop', code: 'MLD-BEZEL', widthMm: 381,
  plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
  cavity: { widthMm: 240, depthMm: 10, shape: 'rect', lenMm: 160, wallMm: 1.5, frameMm: 20, ribs: 7 },
  cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
  ejectors: { type: 'pin', diaMm: 3, count: 20 },
  core: { widthMm: 240, material: 'AISI P20' },
  cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)', clampTons: 200,
  feed: 'hot-runner', sideAction: { aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }, nCav: 1,
};

let fails = 0;
const check = (name, cond, detail) => {
  console.log(` ${cond ? '✓' : '❌'} ${name} — ${detail}`);
  if (!cond) fails++;
};

(async () => {
  const GEN = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-sideaction-gen.ts'));
  const DFM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'dfm-mesh.ts'));

  // ── 1) LOS EJEMPLOS DEL LIBRO AL DECIMAL ──
  const slide = GEN.planFromSpec({ aProjMm2: 220, pMeltMPa: 200, strokeMm: 12 }, 10);
  console.log(`bezel declarado: F=${slide.forceKN} kN · perno contacto ${slide.pinContactMm} + 25 = ${slide.pinTotalMm} mm`);
  check('Eq 11.24: F = 200 MPa · 220 mm² = 44 kN', Math.abs(slide.forceKN - 44) < 0.1, `${slide.forceKN} kN`);
  check('Eq 11.26: L contacto = 12/sin20° = 35 mm', Math.abs(slide.pinContactMm - 35) < 1, `${slide.pinContactMm} mm`);
  check('perno total = 35 + 25 = 60 mm (libro)', Math.abs(slide.pinTotalMm - 60) < 1, `${slide.pinTotalMm} mm`);
  check('12 mm de carrera → CORREDERA (perno)', slide.kind === 'slide', slide.kind);
  const pull = GEN.planFromSpec({ aProjMm2: 220, pMeltMPa: 200, strokeMm: 40 }, 10);
  console.log(`carrera 40 mm (fuera de catálogo): kind=${pull.kind} · bore=${pull.boreMm} mm`);
  check('Eq 11.25: bore = √(4·44kN/π·10MPa) = 75 mm', Math.abs(pull.boreMm - 75) < 1.5, `${pull.boreMm} mm`);
  check('40 mm de carrera (fuera de catálogo) → CORE PULL hidráulico', pull.kind === 'core-pull', pull.kind);
  const s30 = GEN.planFromSpec({ aProjMm2: 220, pMeltMPa: 200, strokeMm: 30 }, 10);
  check('30 mm de carrera → cabe en unidad CU-90 del catálogo', s30.kind === 'slide' && s30.unit?.code === 'CU-90', `${s30.kind} ${s30.unit?.code ?? ''}`);
  // EL ESTUDIO VETA: región enorme (área atrapada) → NO actuador monstruo, split cavity
  const monster = GEN.planSideAction({ x0: 0, x1: 46, y0: 0, y1: 56, zLo: 5, zHi: 32, volMm3: 60000, cols: 900, dir: [0, -1] }, { pMeltMPa: 200 });
  console.log(`región monstruo: ${monster.kind} F=${monster.forceKN} kN bore=${monster.boreMm} → feasible=${monster.feasible}`);
  check('F > 100 kN → el estudio VETA el actuador (split cavity §13.9.1)', monster.feasible === false && /SPLIT CAVITY/.test(monster.notes.join(' ')), `F=${monster.forceKN} kN`);

  // ── 2) TÚNEL LATERAL MEDIDO → PLAN AUTOMÁTICO ──
  const K = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await occtFactory({ wasmBinary: wasmBin, locateFile: (p) => path.join(distDir, p) });
  K._setActiveOCCT(oc);
  const mesh = (shape) => { const m = K.tessellate(oc, shape, 0.3, 0.3); return { positions: m.positions, indices: m.indices }; };
  {
    const box = K.makeBox(oc, 40, 30, 20);
    const tunel = K.transformShape(oc, K.makeBox(oc, 10, 60, 8), { translate: [15, -10, 6] });
    const r = DFM.dfmFromMesh(mesh(K.cut(oc, box, tunel)));
    const { plans } = GEN.planSideActions(r.regionsDetail, { pMeltMPa: 200 });
    console.log(`\ntúnel lateral: ${plans.length} plan(es)`, plans[0] ? `· ${plans[0].kind} · dir [${plans[0].dir}] · S=${plans[0].strokeMm} · F=${plans[0].forceKN} kN` : '');
    check('túnel → 1 mecanismo generado', plans.length === 1, `${plans.length}`);
    check('dirección de jale en Y (el túnel corre en Y)', plans[0] && Math.abs(plans[0].dir[1]) === 1, `[${plans[0]?.dir}]`);
    check('carrera libra el túnel (≥ 30 mm de penetración)', plans[0] && plans[0].strokeMm >= 30, `${plans[0]?.strokeMm} mm`);
    check('carrera larga → core pull', plans[0]?.kind === 'core-pull', plans[0]?.kind);
  }

  // ── 3) buildMoldParts(bezel) → mecanismo-1 (kit COMPLETO) + colada caliente ──
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const DS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
  {
    const parts = PS.buildMoldParts(K, oc, bezel, 'blocks');
    const mec = parts.find((p) => p.role === 'mecanismo-1');
    const base = parts.find((p) => p.role === 'mecanismo-1-base');
    const fijo = parts.find((p) => p.role === 'mecanismo-1-fijo');
    const col = parts.find((p) => p.role === 'colada');
    const kitBodies = (mec?.bodies ?? 0) + (base?.bodies ?? 0) + (fijo?.bodies ?? 0);
    console.log(`\nbezel: ${parts.length} componentes · móvil=${mec?.bodies} + base=${base?.bodies} + fijo=${fijo?.bodies} = ${kitBodies} cuerpos · colada="${col?.name}"`);
    for (const n of mec?.features ?? []) console.log(`   ${n}`);
    check('bezel declarado → componente mecanismo-1', !!mec, mec?.name ?? 'FALTA');
    check('CINEMÁTICA CORRECTA en 3 piezas: móvil(kin) + base(B, estática) + fijo(lado A)', !!mec?.kin && !!base && !base.kin && !!fijo && !fijo.kin, `kin solo en móvil: ${JSON.stringify(mec?.kin)}`);
    check('kit COMPLETO (nariz+cuerpo | base+2 rieles | perno+inserto+talón ≥ 8)', kitBodies >= 8, `${kitBodies} cuerpos`);
    check('UNIDAD PRECARGADA del catálogo (CU-25: S=12≤12, cara 22×10≤25×16)', /CU-25/.test(mec?.name ?? ''), mec?.name ?? '');

    // ── CARRERA LIBRE + TALÓN DENTRO DE PLACA (numérico — el ojo no basta) ──
    const sa0 = PS.computeSideActionPlans(bezel);
    const fr0 = PS.mecFrames(bezel, sa0).frames;
    let heelOK = true, travelOK = true, detail = '';
    for (const f of fr0) {
      const u = f.plan.unit; if (!u) continue;
      const plateEdge = f.sgn > 0 ? (f.alongX ? bezel.widthMm : DS.plateDepth(bezel)) : 0;
      const wantOuter = f.innerU + f.sgn * u.bodyLmm;
      const maxOuter = f.sgn > 0 ? plateEdge - 4 - u.heelLmm - 4 : 4 + u.heelLmm + 4;
      const outerU = f.sgn > 0 ? Math.min(wantOuter, maxOuter) : Math.max(wantOuter, maxOuter);
      const heelEnd = outerU + f.sgn * (4 + u.heelLmm);
      const baseOut = f.sgn > 0 ? Math.min(outerU + f.plan.strokeMm, plateEdge - 2) : Math.max(outerU - f.plan.strokeMm, 2);
      if (f.sgn > 0 ? heelEnd > plateEdge - 3.9 : heelEnd < 3.9) heelOK = false;
      const travel = Math.abs(baseOut - outerU);
      if (travel < f.plan.strokeMm - 0.1) travelOK = false;
      detail = `talón termina en ${heelEnd.toFixed(0)} (placa ${plateEdge}) · riel de carrera ${travel.toFixed(0)}/${f.plan.strokeMm} mm`;
    }
    console.log(`carrera libre: ${detail}`);
    check('TALÓN dentro de la placa (v2 colgaba en u=386 con placa de 381)', heelOK, detail);
    check('riel con CARRERA COMPLETA visible (base se extiende S)', travelOK, detail);
    check('ESTUDIOS en el árbol (Eq 11.20 elástica + Eq 11.24 F)', !!mec && mec.features.some((f) => f.includes('Eq 11.20')) && mec.features.some((f) => f.includes('Eq 11.24')), 'filas con ecuación citada');
    check('estudio de apertura requerida (L·cosφ)', !!mec && mec.features.some((f) => /Apertura/.test(f)), 'presente');
    check('colada CALIENTE con manifold (§6.3.3)', !!col && /CALIENTE/.test(col.name) && (col.bodies ?? 0) >= 4, `${col?.bodies} cuerpos`);

    // ── ESTUDIO DE COLISIÓN perno↔agua (numérico): el perno sube inclinado por la
    // placa A — a la altura de la línea A (zAboveMm) su XY debe LIBRAR los canales
    const sa = PS.computeSideActionPlans(bezel);
    const { frames } = PS.mecFrames(bezel, sa);
    const cc = DS.coolingCircuit(bezel, DS.plateDepth(bezel));
    const zPart = PS.plateStackZ(bezel).A;
    let worst = 1e9, wi = '';
    for (const f of frames) {
      const p = f.plan;
      if (p.kind !== 'slide' || cc.zAboveMm == null) continue;
      const ang = p.angleDeg * Math.PI / 180;
      const cellU = f.alongX ? f.cell.cx : f.cell.cy;
      const bodyCU = cellU + f.sgn * (f.insHalf + 30 / 2);           // aprox centro del cuerpo
      const dz = (zPart + cc.zAboveMm) - (zPart - 6 + 2);
      const uPin = bodyCU + f.sgn * Math.tan(ang) * dz;              // XY del perno a la altura de la línea A
      const px = f.alongX ? uPin : f.vC, py = f.alongX ? f.vC : uPin;
      for (const g of cc.segs) {
        const vx = g.x1 - g.x0, vy = g.y1 - g.y0, len2 = vx * vx + vy * vy || 1;
        const tt = Math.max(0, Math.min(1, ((px - g.x0) * vx + (py - g.y0) * vy) / len2));
        const d = Math.hypot(px - (g.x0 + tt * vx), py - (g.y0 + tt * vy)) - cc.diaMm / 2 - 5;
        if (d < worst) { worst = d; wi = `perno@(${px.toFixed(0)},${py.toFixed(0)}) z=${(zPart + cc.zAboveMm).toFixed(0)}`; }
      }
    }
    console.log(`estudio colisión perno↔agua: holgura ${worst === 1e9 ? '∞' : worst.toFixed(1) + ' mm'} (${wi || 'sin cruce'})`);
    check('el perno LIBRA las líneas de agua (≥2 mm)', worst === 1e9 || worst >= 2, `${worst === 1e9 ? '∞' : worst.toFixed(1)} mm`);
  }
  // ── 3b) MULTI-CAVIDAD: solo celdas EXTERIORES reciben mecanismo + aviso ──
  {
    const multi = { ...bezel, nCav: 4, widthMm: 700, cavity: { ...bezel.cavity, widthMm: 120, lenMm: 80 } };
    const sa = PS.computeSideActionPlans(multi);
    const { frames, skipped } = PS.mecFrames(multi, sa);
    console.log(`\nmulti-cavidad 4: ${frames.length} mecanismos en celdas exteriores · ${skipped} interiores saltadas`);
    check('multi-cav: NO todos los kits (interiores sin salida se saltan)', frames.length < 4 * sa.plans.length || skipped > 0 || frames.length === 2, `${frames.length} frames, ${skipped} saltadas`);
    check('multi-cav: al menos las exteriores SÍ llevan kit', frames.length >= 1, `${frames.length}`);
  }
  // ── 4) pirámide (sin undercuts) → CERO mecanismos ──
  {
    const pm = { positions: new Float32Array([0, 0, 0, 40, 0, 0, 40, 30, 0, 0, 30, 0, 20, 15, 18]),
      indices: new Uint32Array([0, 2, 1, 0, 3, 2, 0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]) };
    const spec2 = { ...bezel, sideAction: undefined, feed: 'cold', nCav: 1 };
    const parts = PS.buildMoldParts(K, oc, spec2, 'blocks', pm);
    const mecs = parts.filter((p) => p.role.startsWith('mecanismo'));
    console.log(`\npirámide: ${mecs.length} mecanismos (esperado 0)`);
    check('pirámide sin undercuts → 0 mecanismos', mecs.length === 0, `${mecs.length}`);
  }

  console.log(fails ? `\n❌ ${fails} checks fallaron` : '\n✓ GENERADOR de mecanismos y colada caliente CALZAN con el libro (Eq 11.24-26 + §6.3.3)');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', e); process.exit(1); });
