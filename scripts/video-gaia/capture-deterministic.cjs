#!/usr/bin/env node
/**
 * GAIA video pipeline — frame capture DETERMINÍSTICO.
 *
 * Diferencia vs capture.cjs (real-time):
 *   - Real-time: CDP screencast → frames a la velocidad del browser
 *                (en WSL con WebGL software: ~12fps real, pierde frames)
 *   - Deterministic: `window.renderAt(t)` + `page.screenshot()` por frame
 *                    (frame-perfect, calidad constante)
 *
 * Requiere:
 *   - Player en modo `?render=1&deterministic=1`
 *   - Escenas R3F migradas a `useRenderClock()` (las no migradas siguen
 *     usando wall-clock, lo cual rompe el determinismo SOLO para ellas)
 *
 * Uso:
 *    node scripts/video-gaia/capture-deterministic.cjs <classId> \
 *         [--base-url URL] [--fps 60] [--clip intro|main|outro|all]
 *
 * Output:  dist-video/.tmp/<classId>/{00-intro,01-main,02-outro}/000000.png ...
 *          dist-video/.tmp/<classId>/capture.json
 */

// Switch from playwright → puppeteer porque playwright bundles chromium SIN
// soporte ANGLE D3D12 (sólo SwiftShader CPU). Puppeteer usa el chromium del
// sistema que sí tiene --use-angle=gl → NVIDIA RTX 4060 vía D3D12.
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const {
  WIDTH, HEIGHT, INTRO_SEC, OUTRO_SEC,
  readManifest, sceneDurations, ensureDir, nukeDir, tmpDirFor, pad,
} = require('./lib.cjs');

// ─── args ────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith('-')) {
    console.error('usage: node capture-deterministic.cjs <classId> [--base-url URL] [--fps 60] [--clip intro|main|outro|all]');
    process.exit(2);
  }
  const out = {
    classId: args[0],
    baseUrl: 'http://localhost:5001',
    clip: 'all',
    fps: 60,
  };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--base-url') out.baseUrl = args[++i];
    else if (args[i] === '--clip') out.clip = args[++i];
    else if (args[i] === '--fps') out.fps = parseInt(args[++i], 10);
  }
  return out;
}

// FIX 2026-05-21: WSL2 SÍ tiene GPU disponible vía D3D12 (mesa-utils muestra
// "D3D12 (NVIDIA GeForce RTX 4060) Accelerated: yes"). Chrome con
// --use-angle=gl activa la GPU para WebGL. Esto da 6-8x speedup vs swiftshader.
// Vulkan en WSL2 solo tiene llvmpipe (CPU) — falta Mesa Dozen driver para
// usar Vulkan acelerado. Por ahora ANGLE GL es lo correcto.
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--use-angle=gl',                  // ← D3D12 → NVIDIA RTX 4060 si funciona
  '--enable-gpu-rasterization',
  '--enable-accelerated-2d-canvas',
  // Sin --disable-software-rasterizer: queremos fallback si GPU falla
  '--disable-features=IsolateOrigins,site-per-process',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  `--window-size=${WIDTH},${HEIGHT}`,
];

/**
 * Captura un clip llamando a window.renderAt(t) por cada frame.
 * Mucho más lento que screencast (1 screenshot por frame) pero frame-perfect.
 *
 * Para main: el classId masterclass debe estar montado con ?render=1&deterministic=1
 * Para bumpers intro/outro: deben tener su propia función window.renderAt(t)
 */
async function captureClipDeterministic({ browser, url, durationSec, outDir, fps }) {
  ensureDir(outDir);
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  // GPU vía ANGLE D3D12 solo expone WebGL 1.0 en WSL2 (no WebGL 2 ni
  // EXT_color_buffer_float). Forzamos Three.js a usar WebGL 1 deshabilitando
  // 'webgl2' en HTMLCanvasElement.getContext.
  await page.evaluateOnNewDocument(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl2') return null;
      return orig.call(this, type, ...args);
    };
  });

  page.on('pageerror', e => console.error('PAGEERR:', e.message));
  page.on('console', m => {
    if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 200));
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window).__renderClockReady === true, { timeout: 30000 });

  const totalFrames = Math.ceil(durationSec * fps);
  console.log(`  Capturing ${totalFrames} frames @ ${fps}fps (${durationSec}s) → ${outDir}`);

  const t0 = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    await page.evaluate((tt) => (window).renderAt(tt), t);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

    const filename = path.join(outDir, `${pad(i, 6)}.png`);
    await page.screenshot({
      path: filename,
      type: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });

    if (i % 30 === 0 || i === totalFrames - 1) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const fps_real = ((i + 1) / parseFloat(elapsed)).toFixed(1);
      process.stdout.write(`\r    frame ${String(i + 1).padStart(6, ' ')}/${totalFrames}  (${elapsed}s · ${fps_real} fps)`);
    }
  }
  console.log('');
  await page.close();

  return { frameCount: totalFrames };
}

(async () => {
  const args = parseArgs();
  const manifest = readManifest(args.classId);
  const durationsArr = sceneDurations(args.classId, manifest);
  const mainDurationSec = durationsArr.reduce((acc, s) => acc + s.durationSec, 0);
  const tmp = tmpDirFor(args.classId, '');

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  Deterministic capture · ${args.classId}`);
  console.log(`║  Main duration: ${mainDurationSec.toFixed(1)}s · ${manifest.scenes.length} scenes`);
  console.log(`║  Capture: ${WIDTH}x${HEIGHT} @ ${args.fps}fps`);
  console.log(`║  Output: ${tmp}`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const browser = await puppeteer.launch({ headless: 'new', args: LAUNCH_ARGS });
  ensureDir(tmp);

  const capture = {
    classId: args.classId,
    width: WIDTH,
    height: HEIGHT,
    fps: args.fps,
    deterministic: true,
    clips: {},
  };

  // Main (Player con ?render=1&deterministic=1)
  if (args.clip === 'all' || args.clip === 'main') {
    nukeDir(path.join(tmp, '01-main'));
    const url = `${args.baseUrl}/masterclass.html?id=${args.classId}&render=1&deterministic=1`;
    console.log(`\n[main] ${url}`);
    const r = await captureClipDeterministic({
      browser, url,
      durationSec: mainDurationSec,
      outDir: path.join(tmp, '01-main'),
      fps: args.fps,
    });
    capture.clips.main = { durationSec: mainDurationSec, ...r };
  }

  // Intro y outro: SOLO si el bumper-intro.html y bumper-outro.html implementan window.renderAt
  // (por ahora seguimos usando el outro pre-renderizado de marketing/gaia-reveal,
  //  que se concatena directamente en encode.cjs sin pasar por captura).

  fs.writeFileSync(path.join(tmp, 'capture.json'), JSON.stringify(capture, null, 2));
  await browser.close();
  console.log(`\n✓ Capture deterministic completa: ${tmp}/capture.json`);
})().catch(e => { console.error(e); process.exit(1); });
