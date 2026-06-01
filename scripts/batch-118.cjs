#!/usr/bin/env node
/**
 * batch-118.cjs — Renderiza los 118 elementos en serie llamando a render-local.cjs.
 *   4K (DPR=2) · h264_nvenc · audio sonificado · anti-glitch · frase de origen.
 * Resiliente: si uno falla, sigue con el siguiente y lo anota.
 * Reanudable: salta los que ya existen en OUT (a menos que FORCE=1).
 *
 * Uso (en iangpu, con vite en :5001):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 node scripts/batch-118.cjs
 * Opcionales:  FROM=1 TO=118  ONLY=6,79,118  DPR=2  FORCE=1
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', 'all-118');
const RENDER = path.join(ROOT, 'scripts', 'render-local.cjs');

const SYMBOLS = ['', // 1-based
  'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
  'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr',
  'Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd',
  'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg',
  'Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm',
  'Md','No','Lr','Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og'];

const from = parseInt(process.env.FROM || '1');
const to = parseInt(process.env.TO || '118');
const only = process.env.ONLY ? process.env.ONLY.split(',').map(s => parseInt(s.trim())) : null;
const force = process.env.FORCE === '1';
const DPR = process.env.DPR || '2';

fs.mkdirSync(OUT, { recursive: true });
const list = only || Array.from({ length: to - from + 1 }, (_, i) => from + i);
const t0 = Date.now();
const done = [], failed = [], skipped = [];

console.log(`▶ batch-118 — ${list.length} elementos · 4K(DPR=${DPR}) · OUT=${OUT}`);
for (let k = 0; k < list.length; k++) {
  const Z = list[k];
  const SYM = SYMBOLS[Z];
  if (!SYM) { failed.push(Z); console.log(`  ✗ Z=${Z} sin símbolo`); continue; }
  const outFile = path.join(OUT, `${String(Z).padStart(3, '0')}-${SYM}.mp4`);
  if (!force && fs.existsSync(outFile) && fs.statSync(outFile).size > 1e6) {
    skipped.push(Z); console.log(`  ⟳ ${SYM} (Z=${Z}) ya existe, salto`); continue;
  }
  const el = Date.now();
  console.log(`  [${k + 1}/${list.length}] ⚛ ${SYM} (Z=${Z}) …`);
  const r = spawnSync('node', [RENDER], {
    stdio: 'inherit',
    env: { ...process.env,
      GPU: '1', VENC: 'h264_nvenc', DPR, Z: String(Z), SYM,
      BASE_URL: process.env.BASE_URL || 'http://localhost:5001',
      OUT, OUTNAME: `${String(Z).padStart(3, '0')}-${SYM}` },
  });
  if (r.status === 0 && fs.existsSync(outFile)) {
    done.push(Z);
    console.log(`     ✓ ${SYM} en ${((Date.now() - el) / 60000).toFixed(1)} min`);
  } else {
    failed.push(Z);
    console.log(`     ✗ ${SYM} (Z=${Z}) FALLÓ (status ${r.status})`);
  }
  const elapsed = (Date.now() - t0) / 60000;
  const rate = elapsed / (k + 1);
  const eta = rate * (list.length - k - 1);
  console.log(`     · ${done.length} ok, ${failed.length} fail, ${skipped.length} skip · ${elapsed.toFixed(0)}min · ETA ${eta.toFixed(0)}min`);
}
console.log(`\n▶ FIN — ${done.length} ok · ${failed.length} fallidos${failed.length ? ': ' + failed.join(',') : ''} · ${skipped.length} saltados`);
