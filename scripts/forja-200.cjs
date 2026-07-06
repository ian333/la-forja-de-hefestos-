/**
 * FORJA-200 — diseña ~200 mecanismos POR LA INTERFAZ para APRENDER LÍMITES.
 * =========================================================================
 * Visión del fundador: "diseña no uno, 200, para que aprendas las limitaciones y
 * mejoremos, que podamos hacer brazos robóticos". Este driver maneja La Forja con
 * el SDK ForjaAgent (todo por window.__forgeBrep, sin hardcodear geometría) sobre
 * un catálogo grande y registra, por pieza: ¿construyó? ¿error? volumen/masa, y la
 * LIMITACIÓN que prueba. La salida (results.jsonl) alimenta el reporte de límites.
 *
 * Resumible (salta lo ya hecho) y leak-safe (agente FRESCO cada lote de 40).
 *   node scripts/forja-200.cjs            # corre todo lo pendiente
 *   node scripts/forja-200.cjs --shots    # + screenshot 1 de cada N
 */
const fs = require('fs');
const path = require('path');
const { ForjaAgent } = require('./forja-agent.cjs');

const OUT = process.env.OUT || '/tmp/forja-200';
const BATCH = 40;
const SHOT_EVERY = 12;
const WANT_SHOTS = process.argv.includes('--shots') || process.env.SHOTS === '1';
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const RESULTS = path.join(OUT, 'results.jsonl');

// ── helpers de catálogo ────────────────────────────────────────────
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const camPts = (R, e, lobes, n = 80) => range(n + 1, (i) => {
  const t = (i / n) * 2 * Math.PI;
  const r = R + e * Math.cos(lobes * t);
  return { x: r * Math.cos(t), y: r * Math.sin(t) };
});

// ── BUILDERS (cada uno opera la app por el SDK) ────────────────────
const B = {
  // brazo robótico: viga + 2 barrenos de junta en los extremos
  async link(a, { L, w, t, hd }) {
    await a.newDoc(); await a.sketch({ kind: 'rect', width: L, height: w });
    await a.updateOpByType('extrude', { depth: t });
    await a.hole({ x: -(L / 2 - w * 0.5), y: 0, diameter: hd });
    await a.hole({ x: (L / 2 - w * 0.5), y: 0, diameter: hd });
  },
  async bracket(a, { w, h, lw, t, hd }) {
    await a.newDoc(); await a.sketch({ kind: 'lprofile', width: w, height: h, legW: lw });
    await a.updateOpByType('extrude', { depth: t }); await a.hole({ diameter: hd });
  },
  async plate(a, { w, h, t, hd, n, dx }) {
    await a.newDoc(); await a.sketch({ kind: 'rect', width: w, height: h });
    await a.updateOpByType('extrude', { depth: t }); await a.hole({ x: -dx * (n - 1) / 2, y: 0, diameter: hd });
    await a.pattern({ mode: 'linear', count: n, dx, dy: 0 });
  },
  async gear(a, { m, Z, th, bore }) { await a.newDoc(); await a.gear({ m, Z, thickness: th, bore }); },
  async shaft(a, { steps }) { await a.newDoc(); await a.shaft(steps); },
  async pulley(a, { R, groove, w }) { await a.newDoc(); await a.shaft([{ r: R, L: w }, { r: R - groove, L: w * 0.6 }, { r: R, L: w }]); },
  async loft(a, { height, topScale, w, h }) { await a.newDoc(); await a.sketch({ kind: 'rect', width: w, height: h }); await a.loft({ height, topScale }); },
  async pipe(a, { r, R, ang }) { await a.newDoc(); await a.sketch({ kind: 'circle', radius: r }); await a.sweep({ pathKind: 'arc', radius: R, angle: ang }); },
  async coil(a, { wire, R, pitch, turns }) { await a.newDoc(); await a.sketch({ kind: 'circle', radius: wire }); await a.sweep({ pathKind: 'helix', radius: R, pitch, turns }); },
  async cam(a, { R, e, lobes }) { await a.newDoc(); await a.custom(camPts(R, e, lobes), true); await a.updateOpByType('extrude', { depth: 10 }); },
  // paquete electrónico: cuerpo + patas (dims de norma). Probe: ensamble multi-cuerpo + precisión
  async package(a, { bw, bh, bt, legs, pitch, legR, legLen }) {
    await a.newDoc(); await a.sketch({ kind: 'rect', width: bw, height: bh });
    await a.updateOpByType('extrude', { depth: bt }); await a.material('pla');
    const x0 = -pitch * (legs - 1) / 2;
    for (let i = 0; i < legs; i++) await a.addComponent('cyl', { r: legR, h: legLen, x: x0 + i * pitch, y: 0, z: -legLen / 2 });
  },
  // junta clevis: horquilla (vaciado) + barreno de pasador + pasador. Probe: JUNTA REAL (sin DOF)
  async clevis(a, { w, h, t, pinD }) {
    await a.newDoc(); await a.sketch({ kind: 'rect', width: w, height: h });
    await a.updateOpByType('extrude', { depth: t });
    await a.hole({ x: 0, y: 0, diameter: pinD });
    await a.addComponent('cyl', { r: pinD / 2, h: t + 6, x: 0, y: 0, z: -3 });
  },
  // gripper: base + 2 mordazas (componentes). Probe: ensamble sin actuación
  async gripper(a, { bw, jaw, gap }) {
    await a.newDoc(); await a.sketch({ kind: 'rect', width: bw, height: 30 });
    await a.updateOpByType('extrude', { depth: 10 });
    await a.addComponent('box', { w: 8, d: jaw, h: 20, x: -gap / 2, y: 25, z: 5 });
    await a.addComponent('box', { w: 8, d: jaw, h: 20, x: gap / 2, y: 25, z: 5 });
  },
};

// ── CATÁLOGO (~200) — familia, probe, límite esperado, build ───────
function catalog() {
  const items = [];
  const add = (family, probe, expectLimit, params, build) =>
    items.push({ id: `${family}-${String(items.filter(x => x.family === family).length + 1).padStart(2, '0')}`, family, probe, expectLimit, params, build });

  range(24, (i) => add('link', 'viga+2 barrenos (eslabón de brazo)', null, { L: 60 + i * 6, w: 20 + (i % 4) * 4, t: 8, hd: 5 + (i % 3) }, B.link));
  range(20, (i) => add('bracket', 'perfil L + barreno', null, { w: 40 + i * 2, h: 30 + (i % 5) * 3, lw: 8 + (i % 3) * 2, t: 6, hd: 6 }, B.bracket));
  range(16, (i) => add('plate', 'placa + patrón de barreno', 'patrón replica el CUERPO, no la feature', { w: 80 + i * 4, h: 40, t: 6, hd: 5, n: 2 + (i % 4), dx: 18 }, B.plate));
  range(24, (i) => add('gear', 'engrane involuta', null, { m: 1.5 + (i % 4) * 0.5, Z: 12 + i, th: 10, bore: 5 }, B.gear));
  range(20, (i) => add('shaft', 'flecha escalonada (revolve)', null, { steps: [{ r: 8 + (i % 3) * 2, L: 15 }, { r: 12 + (i % 4) * 2, L: 20 + i }, { r: 8, L: 12 }] }, B.shaft));
  range(12, (i) => add('pulley', 'polea con ranura (revolve)', null, { R: 20 + i * 2, groove: 4 + (i % 3), w: 6 }, B.pulley));
  range(16, (i) => add('loft', 'tronco/embudo (loft)', null, { height: 15 + i * 2, topScale: 0.2 + (i % 5) * 0.15, w: 40, h: 30 }, B.loft));
  range(12, (i) => add('pipe', 'codo de tubo (sweep arco)', null, { r: 4 + (i % 4), R: 20 + i * 2, ang: 45 + (i % 4) * 30 }, B.pipe));
  range(12, (i) => add('coil', 'bobina/resorte (sweep hélice)', 'bobina+carrete = 2 cuerpos torneados imposible', { wire: 1.2 + (i % 3) * 0.4, R: 10 + i, pitch: 5 + (i % 3) * 2, turns: 3 + (i % 4) }, B.coil));
  range(10, (i) => add('cam', 'leva lobulada (perfil libre)', null, { R: 18 + i, e: 4 + (i % 3), lobes: 2 + (i % 4) }, B.cam));
  // paquetes electrónicos con dims de norma (mm)
  const pkgs = [
    { name: 'TO-92', bw: 4.8, bh: 4.0, bt: 5.2, legs: 3, pitch: 1.27, legR: 0.25, legLen: 14 },
    { name: 'TO-220', bw: 10.16, bh: 4.58, bt: 8.7, legs: 3, pitch: 2.54, legR: 0.3, legLen: 13 },
    { name: 'TO-247', bw: 15.9, bh: 5.0, bt: 20, legs: 3, pitch: 5.45, legR: 0.5, legLen: 20 },
    { name: 'DIP8', bw: 9.8, bh: 6.4, bt: 3.3, legs: 8, pitch: 2.54, legR: 0.2, legLen: 6 },
    { name: 'DIP14', bw: 19.3, bh: 6.4, bt: 3.3, legs: 14, pitch: 2.54, legR: 0.2, legLen: 6 },
    { name: 'TO-218(SCR)', bw: 15.5, bh: 4.8, bt: 20, legs: 3, pitch: 5.45, legR: 0.5, legLen: 20 },
  ];
  pkgs.forEach((p) => range(3, (i) => add('package', `paquete ${p.name} (norma)`, 'multi-cuerpo; patas no se orientan (solo rz)', { ...p, bt: p.bt + i }, B.package)));
  range(10, (i) => add('clevis', 'horquilla + pasador (junta)', 'JUNTA SIN DOF: no hay movimiento/grados de libertad', { w: 24 + i, h: 20, t: 10, pinD: 5 + (i % 3) }, B.clevis));
  range(8, (i) => add('gripper', 'pinza base+2 mordazas', 'ensamble sin actuación ni mate', { bw: 50 + i * 4, jaw: 10, gap: 24 + i * 2 }, B.gripper));
  return items;
}

// ── runner resumible + leak-safe ───────────────────────────────────
(async () => {
  let items = catalog();
  // SAMPLE=1 → un item de cada familia (smoke test rápido de los builders).
  if (process.env.SAMPLE === '1') {
    const seen = new Set();
    items = items.filter((it) => (seen.has(it.family) ? false : seen.add(it.family)));
  }
  const done = new Set();
  if (fs.existsSync(RESULTS)) fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).forEach((l) => { try { done.add(JSON.parse(l).id); } catch {} });
  const pending = items.filter((it) => !done.has(it.id));
  console.log(`catálogo: ${items.length} · hechos: ${done.size} · pendientes: ${pending.length}`);

  let gi = items.length - pending.length;
  for (let b = 0; b < pending.length; b += BATCH) {
    const batch = pending.slice(b, b + BATCH);
    const a = await new ForjaAgent().open();
    for (const it of batch) {
      gi++;
      const t0 = Date.now();
      const rec = { id: it.id, family: it.family, probe: it.probe, expectLimit: it.expectLimit };
      try {
        await it.build(a, it.params);
        const inv = await a.invariants();
        rec.built = !!(inv && inv.vol_kernel > 0 && Number.isFinite(inv.euler) && !inv.error);
        rec.vol = inv && +(inv.vol_kernel || 0).toFixed(1);
        rec.mass_g = inv && inv.mass_g != null ? +inv.mass_g.toFixed(2) : null;
        rec.euler = inv && inv.euler;
        rec.ops = inv && inv.ops;
        rec.err = inv && inv.error ? String(inv.error).slice(0, 100) : null;
      } catch (e) {
        rec.built = false; rec.err = String(e && e.message || e).slice(0, 120);
      }
      rec.ms = Date.now() - t0;
      if (WANT_SHOTS && gi % SHOT_EVERY === 0) { try { rec.shot = await a.shot(path.join(OUT, 'shots', `${it.id}.png`)); } catch {} }
      fs.appendFileSync(RESULTS, JSON.stringify(rec) + '\n');
      process.stdout.write(`${rec.built ? '✓' : '✗'} ${it.id} ${rec.err ? '· ' + rec.err.slice(0, 50) : `vol=${rec.vol}`}\n`);
    }
    const tele = a.telemetry();
    await a.close();
    console.log(`  ── lote ${Math.floor(b / BATCH) + 1}: telemetría ${tele.total} eventos ──`);
  }

  // resumen
  const all = fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const byFam = {};
  for (const r of all) { (byFam[r.family] ||= { built: 0, fail: 0, n: 0 }); byFam[r.family].n++; byFam[r.family][r.built ? 'built' : 'fail']++; }
  console.log('\n=== RESUMEN por familia ===');
  for (const [f, s] of Object.entries(byFam)) console.log(`  ${s.built === s.n ? '✓' : '⚠'} ${f.padEnd(10)} ${s.built}/${s.n} construidos`);
  console.log(`\nTOTAL: ${all.filter((r) => r.built).length}/${all.length} construidos · results → ${RESULTS}`);
})();
