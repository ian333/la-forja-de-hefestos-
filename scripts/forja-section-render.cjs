#!/usr/bin/env node
/**
 * RENDER 4K de EL CORTE DEL MOLDE — barrido del corte + órbita, frames
 * deterministas via window.__cutRenderAt(t), encode NVENC. Corre en iangpu con
 * el vite DEV vivo en :5001 y el env GPU (DISPLAY=:0 GALLIUM_DRIVER=d3d12 …).
 */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/forja-cut-frames';
const VIDEO = process.env.VIDEO || '/home/ian/Orkesta/la-forja/dist-video/el-corte-molde.mp4';
const URL = process.env.URL || 'http://localhost:5001/forja-brep.html';
const FPS = +(process.env.FPS || 30);
const DUR = +(process.env.DUR || 9);          // segundos
const XRAY_AT = +(process.env.XRAY_AT || 5.0); // s: transición corte → rayos X
const W = +(process.env.W || 3840), H = +(process.env.H || 2160);   // 4K horizontal
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(require('path').dirname(VIDEO), { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
           '--disable-software-rasterizer', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tab-simulacion"]', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const renderer = await page.evaluate(() => { try { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); } catch (e) { return 'n/a'; } });
  console.log('RENDERER:', renderer);
  if (/SwiftShader|llvmpipe|Software/i.test(renderer)) { console.log('ABORT: no GPU real'); process.exit(2); }

  const tab = page.locator('[data-testid="tab-simulacion"]');
  if (await tab.count()) await tab.click(); else await page.evaluate(() => window.__forja?.setWorkspace?.('simulacion'));
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('[data-testid="btn-section-reveal"]').click());
  await page.waitForFunction(() => !!window.__cutRenderAt && !!document.querySelector('canvas'), { timeout: 20000 });
  // HUD limpio: oculta los botones (el overlay full-screen tapa el CAD)
  await page.addStyleTag({ content: 'button{display:none!important}' });
  await page.waitForTimeout(1200);

  const N = Math.round(FPS * DUR);
  let xrayOn = false;
  for (let i = 0; i < N; i++) {
    const t = i / FPS;
    const wantX = t >= XRAY_AT;
    await page.evaluate(([tt, x]) => { window.__cutRenderAt(tt); if (window.__cutXray) window.__cutXray(x); }, [t, wantX]);
    if (wantX && !xrayOn) { xrayOn = true; await page.waitForTimeout(250); }   // deja re-montar materiales
    await page.waitForTimeout(90);
    await page.screenshot({ path: `${OUT}/f${String(i).padStart(4, '0')}.png`, timeout: 30000 });
    if (i % 30 === 0) console.log(`frame ${i}/${N} (t=${t.toFixed(2)}s)`);
  }
  if (logs.length) console.log('ERRORES:', logs.slice(0, 8).join(' | '));
  await ctx.close(); await browser.close();

  // encode NVENC 4K (h264 10-bit-safe yuv420p, reproducible en todos lados)
  console.log('encodeando NVENC…');
  execSync(`ffmpeg -y -framerate ${FPS} -i ${OUT}/f%04d.png -c:v h264_nvenc -preset p6 -rc vbr -cq 20 -b:v 40M -pix_fmt yuv420p -movflags +faststart ${VIDEO}`, { stdio: 'inherit' });
  console.log('VIDEO_OK', VIDEO);
})().catch((e) => { console.log('FATAL', String(e).slice(0, 300)); process.exit(1); });
