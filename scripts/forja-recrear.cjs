/**
 * FORJA-RECREAR — recrea a manita 196 COMPONENTES REALES (dims de norma) con el
 * SDK, por la interfaz, para APRENDER las limitaciones del tool. Cada pieza se
 * reconstruye desde sus dimensiones reales; se registra si construyó, su masa, y
 * lo que el tool NO captura (`cant`). La salida alimenta el catálogo de límites.
 *
 * Resumible (dir persistente) y leak-safe (agente fresco por lote).
 *   node scripts/forja-recrear.cjs            # corre lo pendiente
 *   node scripts/forja-recrear.cjs --shots
 */
const fs = require('fs');
const path = require('path');
const { ForjaAgent } = require('./forja-agent.cjs');
const { items } = require('./componentes-reales.cjs');

const OUT = process.env.OUT || '/home/ian/forja-recrear';
const BATCH = +(process.env.BATCH || 12), SHOT_EVERY = 14, RELOAD_EVERY = +(process.env.RELOAD_EVERY || 3);
const isTransient = (err) => /undefined|Target|closed|page\.(evaluate|waitFor|goto)|crash/i.test(err || '');
const WANT_SHOTS = process.argv.includes('--shots') || process.env.SHOTS === '1';
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const RESULTS = path.join(OUT, 'results.jsonl');

// hexágono por entre-caras (AF): circunradio = AF/√3, vértices a 30°+k·60°
const hexPts = (af) => { const R = af / Math.sqrt(3); return Array.from({ length: 6 }, (_, i) => { const a = (30 + i * 60) * Math.PI / 180; return { x: R * Math.cos(a), y: R * Math.sin(a) }; }); };
const cyl = (r, h, x, y, z) => ({ r: Math.max(0.18, r), h, x, y, z });

// ── BUILDERS: cada uno recrea una familia desde dims reales, por la interfaz ──
const BLD = {
  boltHex: async (a, d) => { await a.newDoc(); await a.custom(hexPts(d.head_af)); await a.updateOpByType('extrude', { depth: d.head_h }); await a.addComponent('cyl', cyl(d.thread_d / 2, d.length, 0, 0, -d.length / 2)); },
  capScrew: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.head_d / 2 }); await a.updateOpByType('extrude', { depth: d.head_h }); await a.addComponent('cyl', cyl(d.thread_d / 2, d.length, 0, 0, -d.length / 2)); },
  nutHex: async (a, d) => { await a.newDoc(); await a.custom(hexPts(d.af)); await a.updateOpByType('extrude', { depth: d.thick }); await a.hole({ diameter: d.bore }); },
  washer: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.od / 2 }); await a.updateOpByType('extrude', { depth: d.thick }); await a.hole({ diameter: d.id }); },
  bearing: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.od / 2 }); await a.updateOpByType('extrude', { depth: d.width }); await a.hole({ diameter: d.id }); },
  flanged: async (a, d) => { await a.newDoc(); await a.shaft([{ r: d.od / 2, L: d.width }, { r: d.flange_od / 2, L: d.flange_h || 1 }]); await a.hole({ diameter: d.id }); },
  package: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'rect', width: d.body_w, height: d.body_t }); await a.updateOpByType('extrude', { depth: d.body_h }); await a.material('pla'); const x0 = -d.pitch * (d.leads - 1) / 2; for (let i = 0; i < d.leads; i++) await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, x0 + i * d.pitch, 0, -d.lead_len / 2)); },
  diode: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.body_d / 2 }); await a.updateOpByType('extrude', { depth: d.body_h }); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, 0, 0, d.body_h + d.lead_len / 2)); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, 0, 0, -d.lead_len / 2)); },
  // LÍMITE conocido: el render se cae con >~6 cuerpos → topamos las patas a 3/lado
  // (DIP) o 6 (header). Recreación reconocible; la fidelidad por-pata se pierde.
  dip: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'rect', width: d.body_len, height: d.body_w }); await a.updateOpByType('extrude', { depth: d.body_h }); await a.material('pla'); const cap = Math.min(d.per_side, 3); const x0 = -d.pitch * (cap - 1) / 2, yr = d.row_pitch / 2; for (const yy of [yr, -yr]) for (let i = 0; i < cap; i++) await a.addComponent('cyl', cyl(0.2, d.lead_len, x0 + i * d.pitch, yy, -d.lead_len / 2)); },
  header: async (a, d) => { await a.newDoc(); const cols = d.rows === 2 ? Math.ceil(d.pins / 2) : d.pins, rws = d.rows || 1; await a.sketch({ kind: 'rect', width: d.pitch * cols, height: d.pitch * rws }); await a.updateOpByType('extrude', { depth: d.base }); await a.material('pla'); const x0 = -d.pitch * (cols - 1) / 2, y0 = -d.pitch * (rws - 1) / 2; let nc = 0; for (let r = 0; r < rws; r++) for (let c = 0; c < cols; c++) { if (nc++ >= 6) break; await a.addComponent('cyl', cyl(d.pin_d / 2, d.pin_len, x0 + c * d.pitch, y0 + r * d.pitch, 0)); } },
  box: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'rect', width: d.w, height: d.d }); await a.updateOpByType('extrude', { depth: d.h }); },
  capRadial: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.dia / 2 }); await a.updateOpByType('extrude', { depth: d.height }); const p = d.pitch || 2.5; await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, -p / 2, 0, -d.lead_len / 2)); if (p > 0) await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, p / 2, 0, -d.lead_len / 2)); },
  capDisc: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.dia / 2 }); await a.updateOpByType('extrude', { depth: d.thick }); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, -d.pitch / 2, 0, -d.lead_len / 2)); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, d.pitch / 2, 0, -d.lead_len / 2)); },
  axial: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.body_d / 2 }); await a.updateOpByType('extrude', { depth: d.body_len }); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, 0, 0, d.body_len + d.lead_len / 2)); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, 0, 0, -d.lead_len / 2)); },
  led: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.dia / 2 }); await a.updateOpByType('extrude', { depth: d.body_h }); await a.addComponent('cyl', cyl(d.lead_d / 2, d.lead_len, 0, 0, -d.lead_len / 2)); },
  toroid: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.od / 2 }); await a.updateOpByType('extrude', { depth: d.height }); await a.hole({ diameter: d.id }); },
  potRV: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'rect', width: d.body, height: d.body }); await a.updateOpByType('extrude', { depth: d.height }); await a.addComponent('cyl', cyl(d.shaft_d / 2, d.shaft_len, 0, 0, d.height + d.shaft_len / 2)); },
  nema: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'rect', width: d.body, height: d.body }); await a.updateOpByType('extrude', { depth: d.height }); await a.addComponent('cyl', cyl(d.shaft_d / 2, d.shaft_len, 0, 0, d.height + d.shaft_len / 2)); const hp = d.hole_pitch / 2; for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) await a.hole({ x: sx * hp, y: sy * hp, diameter: d.hole_d }); },
  dcmotor: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.body_d / 2 }); await a.updateOpByType('extrude', { depth: d.length }); await a.addComponent('cyl', cyl(d.shaft_d / 2, d.shaft_len, 0, 0, d.length + d.shaft_len / 2)); },
  pulley: async (a, d) => { await a.newDoc(); await a.shaft([{ r: d.flange_od / 2, L: 1 }, { r: d.od / 2, L: d.width }, { r: d.flange_od / 2, L: 1 }]); await a.hole({ diameter: d.bore }); },
  leadscrew: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.d / 2 }); await a.updateOpByType('extrude', { depth: Math.min(d.length, 120) }); },
  rod: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.d / 2 }); await a.updateOpByType('extrude', { depth: Math.min(d.length, 150) }); },
  nutRound: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.od / 2 }); await a.updateOpByType('extrude', { depth: d.height }); await a.hole({ diameter: d.bore }); },
  coupling: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.od / 2 }); await a.updateOpByType('extrude', { depth: d.length }); await a.hole({ diameter: d.bore1 }); },
  gear: async (a, d) => { await a.newDoc(); await a.gear({ m: d.m, Z: d.Z, thickness: d.thickness, bore: d.bore }); },
  extrusion: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'rect', width: d.w, height: d.h }); await a.updateOpByType('extrude', { depth: 60 }); await a.hole({ diameter: d.bore }); },
  standoff: async (a, d) => { await a.newDoc(); await a.custom(hexPts(d.af)); await a.updateOpByType('extrude', { depth: d.height }); await a.hole({ diameter: d.bore }); },
  standoffRound: async (a, d) => { await a.newDoc(); await a.sketch({ kind: 'circle', radius: d.od / 2 }); await a.updateOpByType('extrude', { depth: d.height }); await a.hole({ diameter: d.bore }); },
  gearSpecial: async (a, d) => {
    await a.newDoc();
    if (d.Z) await a.gear({ m: d.m, Z: d.Z, thickness: d.thickness || 12, bore: d.bore || 6 });
    else if (d.h) { await a.sketch({ kind: 'rect', width: Math.min(d.length, 120), height: d.h }); await a.updateOpByType('extrude', { depth: d.w }); }
    else { await a.sketch({ kind: 'circle', radius: d.d / 2 }); await a.updateOpByType('extrude', { depth: Math.min(d.length, 120) }); await a.hole({ diameter: d.bore }); }
  },
};

(async () => {
  let pool = items;
  if (process.env.SMOKE === '1') { const seen = new Set(); pool = items.filter((it) => (seen.has(it.builder) ? false : seen.add(it.builder))); }
  // Dedupe por nombre (última corrida gana) y RETRY de fallas transitorias
  // (crash del navegador), no de límites reales del tool.
  const last = {};
  if (fs.existsSync(RESULTS)) fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).forEach((l) => { try { const r = JSON.parse(l); last[r.name] = r; } catch {} });
  const done = new Set(Object.values(last).filter((r) => r.built || !isTransient(r.err)).map((r) => r.name));
  const pending = pool.filter((it) => !done.has(it.name));
  console.log(`componentes: ${items.length} · hechos: ${done.size} · pendientes: ${pending.length}`);

  let gi = items.length - pending.length;
  for (let b = 0; b < pending.length; b += BATCH) {
    const batch = pending.slice(b, b + BATCH);
    const a = await new ForjaAgent().open();
    let sinceReload = 0;
    for (const it of batch) {
      gi++; const t0 = Date.now();
      // Recarga periódica (WASM fresco) ANTES de acumular y crashear el render.
      if (sinceReload >= RELOAD_EVERY) { try { await a.reload(); } catch {} sinceReload = 0; }
      sinceReload++;
      const rec = { name: it.name, family: it.family, builder: it.builder, source: it.source, cant: it.cant };
      try {
        const bld = BLD[it.builder];
        if (!bld) throw new Error('builder faltante: ' + it.builder);
        await bld(a, it.dims);
        const inv = await a.invariants();
        rec.built = !!(inv && inv.vol_kernel > 0 && Number.isFinite(inv.euler) && !inv.error);
        rec.vol = inv && +(inv.vol_kernel || 0).toFixed(1);
        rec.mass_g = inv && inv.mass_g != null ? +inv.mass_g.toFixed(2) : null;
        rec.err = inv && inv.error ? String(inv.error).slice(0, 90) : null;
      } catch (e) { rec.built = false; rec.err = String(e && e.message || e).slice(0, 110); }
      rec.ms = Date.now() - t0;
      if (WANT_SHOTS && gi % SHOT_EVERY === 0) { try { rec.shot = await a.shot(path.join(OUT, 'shots', `${String(gi).padStart(3, '0')}-${it.builder}.png`)); } catch {} }
      fs.appendFileSync(RESULTS, JSON.stringify(rec) + '\n');
      process.stdout.write(`${rec.built ? '✓' : '✗'} ${it.name.slice(0, 34).padEnd(34)} ${rec.err ? '· ' + rec.err.slice(0, 44) : `vol=${rec.vol}`}\n`);
    }
    await a.close();
    console.log(`  ── lote ${Math.floor(b / BATCH) + 1} cerrado ──`);
  }

  const lastBy = {};
  fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean).forEach((l) => { try { const r = JSON.parse(l); lastBy[r.name] = r; } catch {} });
  const all = Object.values(lastBy);
  const byFam = {};
  for (const r of all) { (byFam[r.family] ||= { b: 0, n: 0 }); byFam[r.family].n++; if (r.built) byFam[r.family].b++; }
  console.log('\n=== por familia ===');
  for (const [f, s] of Object.entries(byFam)) console.log(`  ${s.b === s.n ? '✓' : '⚠'} ${f.padEnd(11)} ${s.b}/${s.n}`);
  console.log(`\nTOTAL construidos: ${all.filter((r) => r.built).length}/${all.length} · results → ${RESULTS}`);
})();
