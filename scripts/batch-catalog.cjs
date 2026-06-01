#!/usr/bin/env node
/**
 * batch-catalog.cjs — Renderiza las moléculas del CATÁLOGO (scripts/catalog.json):
 * precompute-catalog (σ + π + pares libres) + render 4K con placard, color, campos
 * (π / σ / nube+pares) + outro GAIA. Resiliente + reanudable. Requiere vite :5001.
 *
 * Uso (iangpu):  DISPLAY=:0 GALLIUM_DRIVER=d3d12 node scripts/batch-catalog.cjs
 * Opcionales:  ONLY=etanol,isooctano  FORCE=1
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', 'catalog');
const PREC_BIN = path.join(ROOT, 'public', 'precomputed');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const RENDER = path.join(ROOT, 'scripts', 'render-local.cjs');
const PRECOMPUTE = path.join(ROOT, 'scripts', 'precompute-catalog.ts');

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'catalog.json'), 'utf8'));
// prioridad del usuario primero: alcohol + gasolina; luego el resto en orden del catálogo
const PRIO = ['etanol', 'isooctano'];
const allKeys = catalog.map(m => m.key);
const ordered = [...PRIO.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !PRIO.includes(k))];

const only = process.env.ONLY ? process.env.ONLY.split(',').map(s => s.trim()) : null;
const list = (only ? ordered.filter(k => only.includes(k)) : ordered).map(k => [k, `mol-${k}`]);
const FORCE = !!process.env.FORCE;
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const done = [], failed = [];
console.log(`▶ batch-catálogo — ${list.length} (4K · placard + color + campos)`);
for (let i = 0; i < list.length; i++) {
  const [key, name] = list[i];
  const outFile = path.join(OUT, name + '.mp4');
  if (!FORCE && fs.existsSync(outFile) && fs.statSync(outFile).size > 1e6) { console.log(`  ⟳ ${name} ya existe, salto`); done.push(key); continue; }
  const bin = path.join(PREC_BIN, `catalog-${key}.bin`);
  if (FORCE || !fs.existsSync(bin)) {
    console.log(`  [${i + 1}/${list.length}] ⚛ precompute ${key}…`);
    const pr = spawnSync(TSX, ['--tsconfig', 'tsconfig.lesson.json', PRECOMPUTE, key, '110000'], { stdio: 'inherit', cwd: ROOT });
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
console.log(`\n▶ FIN catálogo — ${done.length} ok · ${failed.length} fallidas${failed.length ? ': ' + failed.join(',') : ''}`);
