#!/usr/bin/env node
/**
 * sandman-clip.cjs — CLIP del test Sandman (figura de polvo + sábana). GPU real.
 * Mismo harness robusto que o2-clip.cjs: contexto fresco por LOTE, screenshot con
 * timeout FINITO, NVENC al final. renderAt(t) puro → cache reproducible.
 *
 * Uso (iangpu, vite dev):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   DPR=1 BATCH=100 T0=0 T1=10 FPS=30 BASE_URL=http://localhost:5210 \
 *   FRAMES_DIR=/dev/shm/sandclip node scripts/sandman-clip.cjs
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const W = 1080, H = 1920;
const DPR = parseInt(process.env.DPR || '1', 10);
const FPS = parseInt(process.env.FPS || '30', 10);
const T0 = parseFloat(process.env.T0 || '0');
const T1 = parseFloat(process.env.T1 || '10');
const BATCH = parseInt(process.env.BATCH || '100', 10);
const BASE = process.env.BASE_URL || 'http://localhost:5210';
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', 'sandman-test-preview.mp4');
const TMP = process.env.FRAMES_DIR || path.join(ROOT, 'dist-video', '.tmp', 'sandclip');
const PAGE = `${BASE}/cinematic-sandman.html`;

const RESUME = process.env.RESUME === '1';
(async () => {
  if (fs.existsSync(TMP) && !RESUME) fs.rmSync(TMP, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const gpuArgs = ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
    '--enable-webgl', '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`];
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args: gpuArgs });

  let ctx = null, page = null, inCtx = 0;
  const settle = () => page.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  async function freshCtx() {
    if (ctx) { try { await ctx.close(); } catch { /* noop */ } }
    ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, bypassCSP: true });
    page = await ctx.newPage();
    await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 60000 });
    await page.waitForTimeout(500);
    inCtx = 0;
  }
  await freshCtx();

  const total = Math.round((T1 - T0) * FPS);
  console.log(`Sandman · t=${T0}→${T1}s · ${total} frames @ ${FPS}fps · DPR=${DPR} (${W * DPR}×${H * DPR}) · batch=${BATCH || 'off'}`);
  const t0 = Date.now(); let last = t0;
  for (let i = 0; i < total; i++) {
    const fp = path.join(TMP, `${String(i).padStart(6, '0')}.jpg`);
    if (RESUME && fs.existsSync(fp) && fs.statSync(fp).size > 20000) continue;
    if (BATCH > 0 && inCtx >= BATCH) await freshCtx();
    const tt = T0 + i / FPS;
    await page.evaluate((t) => window.__cinematicAtom.renderAt(t), tt);
    await settle();
    await page.screenshot({ path: fp, type: 'jpeg', quality: 93, animations: 'disabled', timeout: 30000 });
    inCtx++;
    if (Date.now() - last > 10000) { console.log(`  ${((i / total) * 100).toFixed(0)}% · ${i}/${total} · ${((Date.now() - t0) / 1000 / Math.max(1, i)).toFixed(2)}s/frame`); last = Date.now(); }
  }
  try { await ctx.close(); } catch { /* noop */ }
  await browser.close();
  console.log(`  frames en ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const r = spawnSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', path.join(TMP, '%06d.jpg'),
    '-c:v', 'h264_nvenc', '-preset', 'p7', '-cq', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT],
    { stdio: 'pipe' });
  if (r.status !== 0) { console.error('ffmpeg:', r.stderr?.toString().slice(-500)); process.exit(1); }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`✓ ${OUT} · ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
})();
