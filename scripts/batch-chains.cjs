#!/usr/bin/env node
/**
 * batch-chains.cjs — Las 7 CADENAS: precompute (geometría real + densidad σ/π
 * localizada) + render 4K con placard ("qué ves · la medida · qué significa"),
 * cámara traversal, color (C–C teal / C–H ámbar / π violeta) y campo (caras π en
 * conjugadas, tubo σ en alcanos) + outro GAIA.
 * Resiliente + reanudable. Requiere vite en :5001 en iangpu.
 *
 * Uso (iangpu):  DISPLAY=:0 GALLIUM_DRIVER=d3d12 node scripts/batch-chains.cjs
 * Opcionales:  ONLY=octane,caroteno  FORCE=1 (regenera bins)
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', 'chains');
const PREC_BIN = path.join(ROOT, 'public', 'precomputed');
const TSX = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const RENDER = path.join(ROOT, 'scripts', 'render-local.cjs');
const PRECOMPUTE = path.join(ROOT, 'scripts', 'precompute-chain.ts');

// orden narrativo: alcano simple → más largo → aparece la conjugación (color) → caroteno
const CHAINS = [
  ['butane', 'chain-butane'], ['pentane', 'chain-pentane'], ['hexane', 'chain-hexane'], ['heptane', 'chain-heptane'],
  ['octane', 'chain-octane'], ['nonane', 'chain-nonane'], ['decane', 'chain-decane'], ['dodecane', 'chain-dodecane'],
  ['pentadecane', 'chain-pentadecane'], ['hexadecane', 'chain-hexadecane'], ['heptadecane', 'chain-heptadecane'], ['eicosane', 'chain-eicosane'],
  ['hexatriene', 'chain-hexatriene'], ['octatetraene', 'chain-octatetraene'], ['decapentaene', 'chain-decapentaene'],
  ['dodecahexaene', 'chain-dodecahexaene'], ['tetradecaheptaene', 'chain-tetradecaheptaene'], ['hexadecaoctaene', 'chain-hexadecaoctaene'],
  ['caroteno', 'chain-caroteno'],
];

const only = process.env.ONLY ? process.env.ONLY.split(',').map(s => s.trim()) : null;
const list = only ? CHAINS.filter(m => only.includes(m[0])) : CHAINS;
const FORCE = !!process.env.FORCE;
fs.mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const done = [], failed = [];
console.log(`▶ batch-cadenas — ${list.length} (4K · placard + color + campos)`);
for (let i = 0; i < list.length; i++) {
  const [key, name] = list[i];
  const outFile = path.join(OUT, name + '.mp4');
  const bin = path.join(PREC_BIN, `chain-${key}.bin`);
  // precompute si falta o si FORCE (los colores cambiaron → conviene regenerar)
  if (FORCE || !fs.existsSync(bin)) {
    console.log(`  [${i + 1}/${list.length}] ⚛ precompute ${key}…`);
    const pr = spawnSync(TSX, ['--tsconfig', 'tsconfig.lesson.json', PRECOMPUTE, key, '120000'], { stdio: 'inherit', cwd: ROOT });
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
console.log(`\n▶ FIN cadenas — ${done.length} ok · ${failed.length} fallidas${failed.length ? ': ' + failed.join(',') : ''}`);
