#!/usr/bin/env node
/**
 * clip-peek.cjs — clip CORTO de verificación de una escena cinematic en un rango
 * [T0,T1] de tiempo, ensamblado a mp4. Para juzgar MOVIMIENTO (radioactividad,
 * campos vivos) sin renderizar el video entero. GPU real en iangpu.
 *
 *   Z=92 T0=10.5 T1=15.5 FPS=24 W=1080 H=1920 BASE_URL=http://localhost:8099 \
 *     node scripts/clip-peek.cjs
 * Salida: dist-video/.peek/clip-z<Z>.mp4
 */
'use strict';
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const Z = process.env.Z || '92';
const T0 = parseFloat(process.env.T0 || '10.5');
const T1 = parseFloat(process.env.T1 || '15.5');
const FPS = parseInt(process.env.FPS || '24', 10);
const BASE = process.env.BASE_URL || 'http://localhost:8099';
// PAGE + HOOK genéricos: cualquier escena cinematic (átomo, limones, …)
const PAGE = process.env.PAGE || `cinematic-atom.html?z=${Z}`;
const HOOK = process.env.HOOK || '__cinematicAtom';
const NAME = process.env.NAME || `z${Z}`;
const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(ROOT, 'dist-video', '.peek', `clip-${NAME}-frames`);
const OUT = path.join(ROOT, 'dist-video', '.peek', `clip-${NAME}.mp4`);

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  await page.goto(`${BASE}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
  if (HOOK === '__cineT') {
    await page.waitForTimeout(7000);                       // GLBs + bin de nebulosa
    const btn = await page.$('[data-cine-play]');
    if (btn) { await btn.click(); await page.waitForTimeout(800); }
    await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.pause(); });
  } else {
    await page.waitForFunction((h) => window[h] && window[h].ready === true, HOOK, { timeout: 30000 });
  }
  await page.waitForTimeout(500);
  const nFrames = Math.round((T1 - T0) * FPS);
  console.log(`clip z${Z} · ${T0}→${T1}s @ ${FPS}fps · ${nFrames} frames · ${W}×${H}`);
  for (let i = 0; i < nFrames; i++) {
    const t = T0 + i / FPS;
    if (HOOK === '__cineT') await page.evaluate((tt) => { window.__cineT = tt; }, t);
    else await page.evaluate(([h, tt]) => window[h].renderAt(tt), [HOOK, t]);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    const f = path.join(TMP, `${String(i).padStart(4, '0')}.jpg`);
    await page.screenshot({ path: f, type: 'jpeg', quality: 92, animations: 'disabled' });
  }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, '%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', OUT], { stdio: 'inherit' });
  console.log(`✓ ${OUT}`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
