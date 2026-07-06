#!/usr/bin/env node
/**
 * peek.cjs — Captura unos cuantos frames clave de una escena cinematográfica para
 * verificar cámara/geometría SIN renderizar el video entero. Rápido (1080p, GPU).
 *
 * Uso (iangpu, vite en :5001):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MOL=octane TIMES=0.6,6,11,15 node scripts/peek.cjs
 *   (átomo)  Z=6 TIMES=1,8,15 node scripts/peek.cjs
 * Salida: dist-video/.peek/<name>-t<tt>.jpg
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const MOL = process.env.MOL || '';
const Z = process.env.Z || '6';
const TIMES = (process.env.TIMES || '0.6,6,11,15').split(',').map(s => parseFloat(s.trim())).filter(n => Number.isFinite(n));
const NAME = process.env.NAME || MOL || `z${Z}`;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist-video', '.peek');
const PAGE = MOL ? `cinematic-molecule.html?m=${MOL}` : `cinematic-atom.html?z=${Z}`;
const BASE = process.env.BASE_URL || 'http://localhost:5001';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 200)); });
  await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 30000 });
  await page.waitForTimeout(600);
  const dur = (await page.evaluate(() => window.__cinematicAtom.duration)) || 16;
  console.log(`peek ${NAME} · duración ${dur}s · frames en t=${TIMES.join(', ')}`);
  for (const tt of TIMES) {
    await page.evaluate((t) => window.__cinematicAtom.renderAt(t), Math.min(tt, dur));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.waitForTimeout(120);
    const f = path.join(OUT, `${NAME}-t${String(tt).replace('.', '_')}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 90, animations: 'disabled' });
    console.log(`  ✓ ${path.basename(f)}`);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
