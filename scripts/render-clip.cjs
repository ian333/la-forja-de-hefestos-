#!/usr/bin/env node
/*
 * render-clip.cjs — renderiza una SECUENCIA de frames de una escena cinematic determinista
 * (window[hook].renderAt(t) PURO en t) a PNG, para ensamblar un clip. Recta canónica WSL:
 * contexto FRESCO por LOTE (libera VRAM, sin fuga), timeout FINITO, GPU real (D3D12/NVIDIA).
 * La escena debe ir en modo cámara-pura-en-t (?clip=1) para que los lotes empaten sin costura.
 *
 * Uso (iangpu, env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA):
 *   node scripts/render-clip.cjs --url '...cinematic-pulsar.html?clip=1&vol=1&...' \
 *     --hook __cinematicPulsar --out dist-video/.grailframes --fps 30 --w 3840 --h 2160 --batch 60
 */
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }

(async () => {
  const url = arg('--url'); if (!url) { console.error('falta --url'); process.exit(1); }
  const hook = arg('--hook', '__cinematicPulsar');
  const W = parseInt(arg('--w', '3840'), 10);
  const H = parseInt(arg('--h', '2160'), 10);
  const sup = parseInt(arg('--super', '1'), 10);
  const fps = parseInt(arg('--fps', '30'), 10);
  const outdir = arg('--out', 'dist-video/.clipframes');
  const batch = parseInt(arg('--batch', '60'), 10);
  const warm = parseInt(arg('--warm', '22'), 10);
  const durOv = parseFloat(arg('--dur', '0'));     // override de duración (0 = usar la de la escena)
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');
  fs.mkdirSync(outdir, { recursive: true });

  const launchArgs = [
    '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
    '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
    '--use-angle=gl', '--enable-webgl', '--enable-unsafe-swiftshader',
    '--disable-software-rasterizer', '--hide-scrollbars', `--window-size=${W},${H}`,
  ];

  // FRESCO POR LOTE = relanzar el BROWSER COMPLETO (no solo el contexto). Cerrar solo el
  // contexto NO libera el contexto WebGL2 de ANGLE en headless → tras ~3 lotes Chrome se
  // queda sin contextos WebGL2 → fallback → frames NEGROS. Relanzar el proceso lo cura.
  let browser = null, ctx = null, page = null, frameInCtx = 0, glLogged = false;
  async function freshCtx() {
    if (ctx) await ctx.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    browser = await chromium.launch({ headless: false, executablePath: chrome, args: launchArgs });
    ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: sup, bypassCSP: true });
    page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction((h) => window[h] && window[h].ready === true, hook, { timeout: 120000 });
    if (!glLogged) {
      const gl = await page.evaluate(() => { try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked'; } catch (err) { return 'err ' + err.message; } });
      console.log('[gl]', gl); glLogged = true;
    }
    // calentar: deja cargar la textura 3D del volumen + asentar antes del primer frame
    await page.evaluate(({ h }) => window[h].renderAt(0), { h: hook });
    for (let k = 0; k < warm; k++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    await page.waitForTimeout(400);
    frameInCtx = 0;
  }

  await freshCtx();
  const dur = durOv > 0 ? durOv : (await page.evaluate((h) => window[h].duration, hook)) || 24;
  const N = Math.round(dur * fps);
  console.log(`[clip] ${N} frames · ${dur}s @ ${fps}fps · ${W}x${H} (dsf ${sup}) · lote ${batch}`);
  const t0 = Date.now();
  const BLACK = 150000;   // bytes: un frame 4K con contenido pesa MB; negro ≈ 40KB
  let blacks = 0;
  for (let i = 0; i < N; i++) {
    if (frameInCtx >= batch) await freshCtx();
    const t = i / fps;
    const f = path.join(outdir, String(i).padStart(5, '0') + '.png');
    let ok = false;
    for (let attempt = 0; attempt < 4 && !ok; attempt++) {
      await page.evaluate(({ tt, h }) => window[h].renderAt(tt), { tt: t, h: hook });
      // bombear suficientes rAF + espera: a 4K el frame tarda; pocas rAF = screenshot
      // dispara ANTES de que el GPU termine → NEGRO. Damos tiempo a que dibuje y vacíe.
      for (let k = 0; k < 5; k++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
      await page.waitForTimeout(110);
      await page.screenshot({ path: f, type: 'png', clip: { x: 0, y: 0, width: W, height: H }, timeout: 60000 });
      const sz = fs.statSync(f).size;
      if (sz > BLACK) { ok = true; }
      else {
        // frame NEGRO (race o WebGL2 caído): relanzar browser fresco y reintentar este frame
        console.log(`[clip] frame ${i} negro (${sz}B) → reintento ${attempt + 1} (browser fresco)`);
        await freshCtx();
      }
    }
    if (!ok) { blacks++; console.error(`[clip] !! frame ${i} sigue negro tras reintentos`); }
    frameInCtx++;
    if (i % 30 === 0 || i === N - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log(`[clip] ${i + 1}/${N}  (${el.toFixed(0)}s, ${(el / (i + 1)).toFixed(2)}s/f, negros=${blacks})`);
    }
  }
  if (ctx) await ctx.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  console.log(`[clip] LISTO ${N} frames → ${outdir}`);
})().catch((e) => { console.error(e); process.exit(1); });
