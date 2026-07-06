#!/usr/bin/env node
/*
 * batch-motion.cjs — corre motion-verify.cjs sobre TODA una carpeta de videos y
 * triA: separa los listos-para-subir de los que tienen defecto temporal (nube
 * congelada / escena muerta / stutter). Sin GPU. Reporte CSV + resumen + top-sospechosos.
 *
 * Uso: node scripts/batch-motion.cjs --dir dist-video [--out _triage] [--fps 4] [--limit N]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const DIR = arg('--dir', 'dist-video');
const OUT = arg('--out', '_triage');
const FPS = arg('--fps', '4');
const LIMIT = parseInt(arg('--limit', '100000'), 10);
fs.mkdirSync(OUT, { recursive: true });

function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.tmp|\.peek/.test(p)) walk(p, acc); }
    else if (/\.mp4$/i.test(e.name) && !/outro/i.test(e.name)) acc.push(p);
  }
  return acc;
}
const vids = walk(DIR, []).sort().slice(0, LIMIT);
console.log(`triando ${vids.length} videos de ${DIR} @ ${FPS}fps …\n`);

const rows = [];
let i = 0;
for (const v of vids) {
  i++;
  const od = path.join(OUT, '_w');
  const r = spawnSync('node', ['scripts/motion-verify.cjs', '--video', v, '--out', od, '--fps', FPS, '--grid', '6x10'],
    { encoding: 'utf8', maxBuffer: 1 << 30 });
  let m = null;
  try { m = JSON.parse(fs.readFileSync(path.join(od, 'verdict.json'), 'utf8')); } catch { /* */ }
  if (!m) { rows.push({ v, ok: null, note: 'ERROR-ANALISIS' }); console.log(`  [${i}/${vids.length}] ⁇ ${path.basename(v)} (error)`); continue; }
  const row = {
    v: path.relative(DIR, v), ok: m.pass, frozen: m.metrics.frozenContentPct, alive: m.metrics.aliveFracPct,
    freeze: m.metrics.maxFreezeRun, teleports: m.metrics.teleports.length, frames: m.frames, fails: m.fails.join('|'),
  };
  rows.push(row);
  console.log(`  [${i}/${vids.length}] ${m.pass ? '✓' : '✗'} ${row.v}  frozen=${row.frozen}% alive=${row.alive}% ${m.fails.length ? '→ ' + row.fails : ''}`);
}

// CSV + resumen
const hdr = 'video,pass,frozenPct,alivePct,maxFreeze,teleports,frames,fails';
const csv = [hdr, ...rows.filter(r => r.ok !== null).map(r => `"${r.v}",${r.ok},${r.frozen},${r.alive},${r.freeze},${r.teleports},${r.frames},"${r.fails}"`)].join('\n');
fs.writeFileSync(path.join(OUT, 'triage.csv'), csv);
const fails = rows.filter(r => r.ok === false);
const errs = rows.filter(r => r.ok === null);
const pass = rows.filter(r => r.ok === true);
console.log(`\n===== RESUMEN =====`);
console.log(`  ✓ listos     : ${pass.length}`);
console.log(`  ✗ con defecto: ${fails.length}`);
console.log(`  ⁇ error      : ${errs.length}`);
if (fails.length) {
  console.log(`\n  --- SOSPECHOSOS (revisar con el ojo) ---`);
  fails.sort((a, b) => (b.frozen - a.frozen) || (b.freeze - a.freeze));
  for (const r of fails.slice(0, 40)) console.log(`   ${r.v}  frozen=${r.frozen}% alive=${r.alive}% freeze=${r.freeze} → ${r.fails}`);
}
console.log(`\n  CSV → ${path.join(OUT, 'triage.csv')}`);
