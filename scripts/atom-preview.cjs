#!/usr/bin/env node
/**
 * atom-preview.cjs — RENDER BARATO para el GENERADOR (laptop, sin build, sin NVENC).
 *
 * Sirve para CALIFICAR viajes candidatos: baja-res + libx264 (CPU, corre en
 * cualquier lado). NO es el render de entrega (ese va 4K/NVENC en iangpu).
 *
 * Asume un server estático sirviendo dist/ (python -m http.server) — NO vite.
 *   BASE_URL=http://localhost:8000 Z=11 W=360 H=640 FPS=12 OUT=/tmp/prev.mp4 \
 *     node scripts/atom-preview.cjs
 */
'use strict';
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:8000';
const Z = parseInt(process.env.Z || '11', 10);
const W = parseInt(process.env.W || '360', 10);
const H = parseInt(process.env.H || '640', 10);
const FPS = parseInt(process.env.FPS || '12', 10);
const OUT = process.env.OUT || `/tmp/atom-prev-${Z}.mp4`;
const DUR_CAP = process.env.DURATION ? parseFloat(process.env.DURATION) : null;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch({
    headless: true, executablePath: CHROME,
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--use-gl=angle',
      '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl',
      '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
      `--window-size=${W},${H}`],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  // genoma del viaje por URL (lo lee la escena tras el build): journey=seed, palette=id
  const extra = [];
  if (process.env.JOURNEY) extra.push(`journey=${encodeURIComponent(process.env.JOURNEY)}`);
  if (process.env.PALETTE) extra.push(`palette=${encodeURIComponent(process.env.PALETTE)}`);
  const url = `${BASE}/cinematic-atom.html?z=${Z}${extra.length ? '&' + extra.join('&') : ''}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true,
    null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const sceneDur = await page.evaluate(() => window.__cinematicAtom.duration);
  const dur = DUR_CAP ? Math.min(DUR_CAP, sceneDur) : sceneDur;
  const total = Math.round(dur * FPS);
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'atomprev-'));
  process.stderr.write(`  preview z=${Z} ${W}x${H}@${FPS} · ${dur.toFixed(1)}s · ${total} frames\n`);
  for (let i = 0; i < total; i++) {
    await page.evaluate((tt) => window.__cinematicAtom.renderAt(tt), i / FPS);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.screenshot({ path: path.join(frames, `${String(i).padStart(5, '0')}.jpg`),
      type: 'jpeg', quality: 88, timeout: 20000 });
  }
  await browser.close();
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS),
    '-i', path.join(frames, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'veryfast',
    '-crf', '23', '-pix_fmt', 'yuv420p', OUT]);
  fs.rmSync(frames, { recursive: true, force: true });
  process.stderr.write(`  ✓ ${OUT} en ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
})().catch(e => { process.stderr.write('PREVIEW_ERR ' + e.message + '\n'); process.exit(1); });
