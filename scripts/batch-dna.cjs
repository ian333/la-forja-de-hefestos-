#!/usr/bin/env node
/**
 * batch-dna.cjs — Renderiza las secuencias de ADN (doble hélice B-form real):
 * precompute-dna (denso, átomos + π-stacking) + render 4K con viaje de escala,
 * cántico (caja de música) y outro. Resiliente + reanudable.
 *
 * Uso (iangpu):  DISPLAY=:0 GALLIUM_DRIVER=d3d12 BASE_URL=http://localhost:5012 node scripts/batch-dna.cjs
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', 'dna');
const PREC_BIN = path.join(ROOT, 'public', 'precomputed');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const RENDER = path.join(ROOT, 'scripts', 'render-local.cjs');
const PRECOMPUTE = path.join(ROOT, 'scripts', 'precompute-dna.ts');

const DNA = [['brca1', 'dna-brca1'], ['telomero', 'dna-telomero'], ['tata', 'dna-tata']];
const only = process.env.ONLY ? process.env.ONLY.split(',').map(s => s.trim()) : null;
const list = only ? DNA.filter(m => only.includes(m[0])) : DNA;
const FORCE = !!process.env.FORCE;
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const done = [], failed = [];
console.log(`▶ batch-ADN — ${list.length} (4K · viaje de escala + cántico)`);
for (let i = 0; i < list.length; i++) {
  const [key, name] = list[i];
  const outFile = path.join(OUT, name + '.mp4');
  if (!FORCE && fs.existsSync(outFile) && fs.statSync(outFile).size > 1e6) { console.log(`  ⟳ ${name} ya existe, salto`); done.push(key); continue; }
  const bin = path.join(PREC_BIN, `dna-${key}.bin`);
  if (FORCE || !fs.existsSync(bin)) {
    console.log(`  [${i + 1}/${list.length}] ⚛ precompute ${key}…`);
    const pr = spawnSync(TSX, ['--tsconfig', 'tsconfig.lesson.json', PRECOMPUTE, key, '600000'], { stdio: 'inherit', cwd: ROOT });
    if (pr.status !== 0 || !fs.existsSync(bin)) { failed.push(key); console.log(`     ✗ precompute ${key} FALLÓ`); continue; }
  }
  console.log(`  [${i + 1}/${list.length}] 🎬 render ${name}…`);
  const r = spawnSync('node', [RENDER], {
    stdio: 'inherit',
    env: { ...process.env, GPU: '1', VENC: 'h264_nvenc', DPR: '2', MOL: key, OUTNAME: name, OUT, BASE_URL: process.env.BASE_URL || 'http://localhost:5012' },
  });
  if (r.status === 0 && fs.existsSync(outFile)) { done.push(key); console.log(`     ✓ ${name}`); }
  else { failed.push(key); console.log(`     ✗ ${name} FALLÓ`); }
}
console.log(`\n▶ FIN ADN — ${done.length} ok · ${failed.length} fallidas${failed.length ? ': ' + failed.join(',') : ''}`);
