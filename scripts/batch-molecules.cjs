#!/usr/bin/env node
/**
 * batch-molecules.cjs — Produce las moléculas (precompute LCAO si falta + render).
 *   Cada una: núcleo molten + densidad coloreada por simetría + bokeh + campo de
 *   plasma electrostático + grado de cine + outro GAIA. 4K.
 * Resiliente (sigue si una falla) + reanudable (salta las que ya existen).
 *
 * Uso (iangpu, vite en :5001):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 node scripts/batch-molecules.cjs
 * Opcionales:  ONLY=h2,n2,co  FORCE=1
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', 'molecules');
const PREC_BIN = path.join(ROOT, 'public', 'precomputed');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const RENDER = path.join(ROOT, 'scripts', 'render-local.cjs');
const PRECOMPUTE = path.join(ROOT, 'scripts', 'precompute-molecule.ts');

// orden = historia: origen del cosmos → aire → enlaces → vida. (agua ya hecha)
const MOLS = [
  ['hehp', '01-HeH'], ['h2', '02-H2'], ['co', '03-CO'], ['li2', '04-Li2'],
  ['n2', '05-N2'], ['o2', '06-O2'], ['co2', '07-CO2'],
  ['nacl', '08-NaCl'], ['hcl', '09-HCl'], ['hf', '10-HF'],
  ['c2h4', '11-C2H4'], ['c2h2', '12-C2H2'], ['c6h6', '13-C6H6'],
  ['ch4', '14-CH4'], ['nh3', '15-NH3'],
];

const only = process.env.ONLY ? process.env.ONLY.split(',').map(s => s.trim()) : null;
const list = only ? MOLS.filter(m => only.includes(m[0])) : MOLS;
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const done = [], failed = [];
console.log(`▶ batch-moléculas — ${list.length} (4K · campo de plasma)`);
for (let i = 0; i < list.length; i++) {
  const [key, name] = list[i];
  const outFile = path.join(OUT, name + '.mp4');
  if (!process.env.FORCE && fs.existsSync(outFile) && fs.statSync(outFile).size > 1e6) {
    console.log(`  ⟳ ${name} ya existe, salto`); continue;
  }
  const bin = path.join(PREC_BIN, `mol-${key}.bin`);
  if (!fs.existsSync(bin)) {
    console.log(`  [${i + 1}/${list.length}] ⚛ precompute ${key}…`);
    const pr = spawnSync(TSX, ['--tsconfig', 'tsconfig.lesson.json', PRECOMPUTE, key, '140000'], { stdio: 'inherit', cwd: ROOT });
    if (pr.status !== 0 || !fs.existsSync(bin)) { failed.push(key); console.log(`     ✗ precompute ${key} FALLÓ`); continue; }
  }
  console.log(`  [${i + 1}/${list.length}] 🎬 render ${name}…`);
  const r = spawnSync('node', [RENDER], {
    stdio: 'inherit',
    env: { ...process.env, GPU: '1', VENC: 'h264_nvenc', DPR: '2', MOL: key, OUTNAME: name, OUT, BASE_URL: process.env.BASE_URL || 'http://localhost:5001' },
  });
  if (r.status === 0 && fs.existsSync(outFile)) { done.push(key); console.log(`     ✓ ${name}`); }
  else { failed.push(key); console.log(`     ✗ ${name} FALLÓ`); }
  const el = (Date.now() - t0) / 60000, rate = el / (i + 1), eta = rate * (list.length - i - 1);
  console.log(`     · ${done.length} ok, ${failed.length} fail · ${el.toFixed(0)}min · ETA ${eta.toFixed(0)}min`);
}
console.log(`\n▶ FIN — ${done.length} ok · ${failed.length} fallidas${failed.length ? ': ' + failed.join(',') : ''}`);
