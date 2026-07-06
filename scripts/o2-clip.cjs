#!/usr/bin/env node
/**
 * o2-clip.cjs — CLIP de la FORMACIÓN del enlace O₂ (sin audio; el audio/subs los
 * pega atom-reel-final / el ensamble aparte). GPU real.
 *
 * 4K ROBUSTO: a DPR=2 (2160×3840) un solo contexto de browser FUGA VRAM y se cuelga
 * ~frame 110 (CLAUDE.md). Por eso refrescamos el CONTEXTO por LOTE (BATCH frames,
 * ctx.close() libera VRAM → cero fuga). renderAt(t) es puro → cache reproducible.
 *
 * Uso (iangpu, vite dev):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   DPR=2 BATCH=75 T0=0 T1=62 FPS=60 BASE_URL=http://localhost:5010 OUT=<mp4> node scripts/o2-clip.cjs
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);   // 16:9 → W=1920 H=1080
const DPR = parseInt(process.env.DPR || '1', 10);          // 2 → 4K (2160×3840)
const FPS = parseInt(process.env.FPS || '24', 10);
const T0 = parseFloat(process.env.T0 || '0');
const T1 = parseFloat(process.env.T1 || '16');
const BATCH = parseInt(process.env.BATCH || '0', 10);      // 0 = un solo contexto; >0 = refresca cada BATCH
const BASE = process.env.BASE_URL || 'http://localhost:5001';
const MOL = process.env.MOL || 'o2';                       // o2 | n2 | f2 | h2 (la serie de enlaces)
const OUT = process.env.OUT || path.join(ROOT, 'dist-video', `${MOL}-formacion-preview.mp4`);
// TMP configurable: apuntar a /dev/shm (tmpfs/RAM) evita el EIO del vhdx de WSL en
// renders 4K largos (miles de JPGs). export FRAMES_DIR=/dev/shm/o2clip
const TMP = process.env.FRAMES_DIR || path.join(ROOT, 'dist-video', '.tmp', `${MOL}clip`);
const PAGE = `${BASE}/cinematic-molecule.html?m=${MOL}`;

const RESUME = process.env.RESUME === '1';   // no borra TMP; salta frames ya escritos (recuperación tras EIO)
(async () => {
  if (fs.existsSync(TMP) && !RESUME) fs.rmSync(TMP, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const gpuArgs = ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
    '--enable-webgl', '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`];
  let browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args: gpuArgs });

  let ctx = null, page = null, inCtx = 0;
  const settle = () => page.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
  async function freshCtx() {
    if (ctx) { try { await ctx.close(); } catch { /* noop */ } }
    // si el BROWSER entero murió (crash del proceso GPU), relanzarlo — no solo el contexto
    try {
      ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, bypassCSP: true });
    } catch {
      console.log('  ! browser muerto → relanzando Chrome completo');
      try { await browser.close(); } catch { /* noop */ }
      browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args: gpuArgs });
      ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, bypassCSP: true });
    }
    page = await ctx.newPage();
    await page.goto(PAGE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    inCtx = 0;
  }
  await freshCtx();

  const total = Math.round((T1 - T0) * FPS);
  console.log(`O₂ · t=${T0}→${T1}s · ${total} frames @ ${FPS}fps · DPR=${DPR} (${W * DPR}×${H * DPR}) · batch=${BATCH || 'off'}`);
  const t0 = Date.now(); let last = t0;
  for (let i = 0; i < total; i++) {
    const fp = path.join(TMP, `${String(i).padStart(6, '0')}.jpg`);
    if (RESUME && fs.existsSync(fp) && fs.statSync(fp).size > 20000) continue;  // ya renderizado, salta
    if (BATCH > 0 && inCtx >= BATCH) await freshCtx();
    const tt = T0 + i / FPS;
    // AUTO-RECOVERY: si el renderer muere a mitad de lote (context-lost, __cinematicAtom
    // desaparece), contexto FRESCO y reintenta el MISMO frame — no se tira el render.
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        await page.evaluate((t) => window.__cinematicAtom.renderAt(t), tt);
        await settle();
        await page.screenshot({ path: fp, type: 'jpeg', quality: 93, animations: 'disabled', timeout: 30000 });
        ok = true;
      } catch (e) {
        console.log(`  ! frame ${i} intento ${attempt + 1} falló (${String(e.message).slice(0, 80)}) → contexto fresco`);
        await freshCtx();
      }
    }
    if (!ok) throw new Error(`frame ${i} falló 3 veces`);
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
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
