#!/usr/bin/env node
/**
 * GAIA video pipeline — frame capture.
 *
 * Lanza Chromium en 4K, navega a las URLs del bumper-intro / Player (render=1)
 * / bumper-outro y captura frames PNG vía CDP screencast.
 *
 * Output:  dist-video/.tmp/<classId>/{00-intro,01-main,02-outro}/000000.png ...
 * Manifest de captura:  dist-video/.tmp/<classId>/capture.json
 *
 * Uso:
 *    node scripts/video-gaia/capture.cjs <classId> --base-url http://localhost:5001
 *    node scripts/video-gaia/capture.cjs <classId> --clip intro|main|outro  (parcial)
 */

const { chromium } = require('playwright');
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
    console.error('usage: node capture.cjs <classId> [--base-url URL] [--clip intro|main|outro|all]');
    process.exit(2);
  }
  const out = { classId: args[0], baseUrl: 'http://localhost:5001', clip: 'all' };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--base-url') out.baseUrl = args[++i];
    else if (args[i] === '--clip') out.clip = args[++i];
  }
  return out;
}

// ─── chromium flags for headless WebGL @ 4K ─────────────────────────────────
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--use-gl=swiftshader',
  '--enable-accelerated-2d-canvas',
  '--disable-features=IsolateOrigins,site-per-process',
  // disable rate limiting of timers (helps R3F animate consistently in background)
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  // force window size to match viewport
  `--window-size=${WIDTH},${HEIGHT}`,
];

// ─── one clip capture ────────────────────────────────────────────────────────
/**
 * Captures a single clip from `url` for `durationSec` seconds.
 * Writes frames to `outDir/{000000}.png`. Returns array of {idx, ts_ms}.
 */
async function captureClip({ url, durationSec, outDir, readySignal }) {
  nukeDir(outDir);
  ensureDir(outDir);

  const browser = await chromium.launch({
    headless: true,
    args: LAUNCH_ARGS,
  });
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    bypassCSP: true,
  });
  const page = await ctx.newPage();

  console.log(`  ↳ goto ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

  if (readySignal) {
    console.log(`  ↳ wait for ${readySignal}`);
    await page.waitForFunction(readySignal, null, { timeout: 30_000 });
  }
  // Stabilization warmup — let R3F kick off, fonts paint
  await page.waitForTimeout(400);

  // CDP screencast
  const client = await page.context().newCDPSession(page);
  const frames = [];
  let frameIdx = 0;
  let startTs = null;

  const onFrame = async ({ data, sessionId, metadata }) => {
    const ts = metadata?.timestamp ? metadata.timestamp * 1000 : Date.now();
    if (startTs === null) startTs = ts;
    const idx = frameIdx++;
    const filePath = path.join(outDir, `${pad(idx)}.png`);
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    frames.push({ idx, ts_ms: ts - startTs });
    try {
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch { /* page may have closed */ }
  };
  client.on('Page.screencastFrame', onFrame);

  await client.send('Page.startScreencast', {
    format: 'png',
    everyNthFrame: 1,
    maxWidth: WIDTH,
    maxHeight: HEIGHT,
  });

  console.log(`  ↳ recording ${durationSec.toFixed(2)}s`);
  await page.waitForTimeout(Math.ceil(durationSec * 1000));

  await client.send('Page.stopScreencast').catch(() => {});
  // Drain any in-flight frames
  await page.waitForTimeout(200);

  await browser.close();

  const fps = frames.length / durationSec;
  console.log(`  ↳ ${frames.length} frames captured · ${fps.toFixed(1)} fps avg`);
  return { frames, durationSec, fps };
}

// ─── orchestration ───────────────────────────────────────────────────────────
async function main() {
  const { classId, baseUrl, clip } = parseArgs();
  const manifest = readManifest(classId);
  const scenes = sceneDurations(classId, manifest);
  const totalMainSec = scenes.reduce((a, s) => a + s.durationSec, 0);

  console.log(`\n┌─ capture · ${classId}`);
  console.log(`├─ title: ${manifest.title}`);
  console.log(`├─ scenes: ${scenes.length}  ·  main: ${totalMainSec.toFixed(1)}s`);
  console.log(`├─ base:   ${baseUrl}`);
  console.log(`└─ clip:   ${clip}\n`);

  const report = { classId, baseUrl, scenes, clips: {} };

  if (clip === 'intro' || clip === 'all') {
    console.log('● intro (3s)');
    const url = `${baseUrl}/bumpers/intro.html?title=${encodeURIComponent(manifest.title)}`;
    report.clips.intro = await captureClip({
      url,
      durationSec: INTRO_SEC,
      outDir: tmpDirFor(classId, '00-intro'),
      readySignal: '() => window.__bumperReady === true',
    });
  }

  if (clip === 'main' || clip === 'all') {
    console.log('● main (' + totalMainSec.toFixed(1) + 's)');
    const url = `${baseUrl}/masterclass.html?id=${classId}&render=1`;
    // wait until the Player has loaded the manifest AND started; small safety pad
    report.clips.main = await captureClip({
      url,
      durationSec: totalMainSec + 1.0,  // tiny pad para drainear última escena
      outDir: tmpDirFor(classId, '01-main'),
      readySignal: '() => window.__renderStatus && window.__renderStatus.started === true',
    });
  }

  // Outro is the pre-rendered GAIA brand MP4 — no capture needed.
  if (clip === 'outro' || clip === 'all') {
    console.log('● outro (pre-rendered GAIA video · 7s) — skipping capture');
  }

  // write capture report
  const reportPath = path.join(tmpDirFor(classId, ''), 'capture.json');
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✓ capture done · report: ${reportPath}`);
}

/** Best-effort "next class" caption for outro */
function inferNext(classId) {
  if (classId.startsWith('econ-')) {
    const n = parseInt(classId.split('-')[1], 10);
    if (n && n < 17) return `Nobel de Economía · ${pad(n + 1, 2)}`;
    return 'GAIA · university.gaiaprime.com.mx';
  }
  if (classId.startsWith('phys-')) return 'Nobel de Física · próximo';
  if (classId.startsWith('linalg')) return 'Cálculo infinitesimal';
  if (classId.startsWith('calc')) return 'Álgebra lineal';
  if (classId === 'blackhole') return 'la luz también es partícula';
  return 'GAIA · university.gaiaprime.com.mx';
}

main().catch(e => { console.error(e); process.exit(1); });
