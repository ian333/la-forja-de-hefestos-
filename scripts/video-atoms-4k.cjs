#!/usr/bin/env node
/**
 * video-atoms-4k.cjs — Video 4K 15s de cada átomo, sin UI, solo la nube orbital.
 *
 * Pipeline por átomo:
 *   1. Abre lab.html, selecciona el elemento, oculta TODO el UI
 *   2. CDP screencast 15s → JPEGs q100
 *   3. ffmpeg HEVC NVENC 10-bit → .mp4 por átomo
 *
 * Uso en iangpu:
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     node scripts/video-atoms-4k.cjs
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const W   = parseInt(process.env.W   || '3840', 10);
const H   = parseInt(process.env.H   || '2160', 10);
const FPS = parseInt(process.env.FPS || '60',   10);
const CQ  = process.env.CQ  || '18';
const BV  = process.env.BV  || '80M';
const MBV = process.env.MBV || '150M';
const BUF = process.env.BUF || '300M';
const CLIP_SEC = parseInt(process.env.CLIP_SEC || '15', 10);

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-video', 'atoms-4k-video');
const TMP_DIR = path.join(ROOT, 'dist-video', '.tmp', 'atoms-vid');

const ATOMS = [
  [1,  'H',  'Hidrógeno'],
  [2,  'He', 'Helio'],
  [6,  'C',  'Carbono'],
  [7,  'N',  'Nitrógeno'],
  [8,  'O',  'Oxígeno'],
  [10, 'Ne', 'Neón'],
  [11, 'Na', 'Sodio'],
  [14, 'Si', 'Silicio'],
  [15, 'P',  'Fósforo'],
  [16, 'S',  'Azufre'],
  [17, 'Cl', 'Cloro'],
  [18, 'Ar', 'Argón'],
  [20, 'Ca', 'Calcio'],
  [22, 'Ti', 'Titanio'],
  [24, 'Cr', 'Cromo'],
  [26, 'Fe', 'Hierro'],
  [29, 'Cu', 'Cobre'],
  [30, 'Zn', 'Zinc'],
  [33, 'As', 'Arsénico'],
  [35, 'Br', 'Bromo'],
  [36, 'Kr', 'Kriptón'],
  [47, 'Ag', 'Plata'],
  [53, 'I',  'Yodo'],
  [54, 'Xe', 'Xenón'],
  [74, 'W',  'Wolframio'],
  [79, 'Au', 'Oro'],
  [82, 'Pb', 'Plomo'],
  [92, 'U',  'Uranio'],
];

function run(cmd, args) {
  console.log(`    $ ${cmd} ${args.slice(0, 4).join(' ')} ...`);
  const r = spawnSync(cmd, args, { stdio: 'pipe' });
  if (r.status !== 0) {
    console.error(`    ffmpeg stderr: ${r.stderr?.toString().slice(-500)}`);
    throw new Error(`${cmd} exit ${r.status}`);
  }
}

async function hideUI(page) {
  await page.evaluate(() => {
    // Hide header
    const h = document.querySelector('header');
    if (h) h.style.display = 'none';
    // Hide dock/sidebar
    const a = document.querySelector('aside');
    if (a) a.style.display = 'none';
    // Hide all small overlay panels
    document.querySelectorAll('div').forEach(el => {
      // Skip canvas parents
      if (el.querySelector('canvas')) return;
      if (el.tagName === 'CANVAS') return;
      const s = el.className || '';
      if (s.includes('absolute') || s.includes('fixed')) {
        const r = el.getBoundingClientRect();
        // Only hide small UI panels, not the main viewport
        if (r.width < window.innerWidth * 0.6 && r.height < window.innerHeight * 0.6) {
          el.style.display = 'none';
        }
      }
    });
    // Hide the tab nav bar
    document.querySelectorAll('nav').forEach(n => n.style.display = 'none');
    // Make background pure black
    document.body.style.background = '#000';
    const root = document.getElementById('root');
    if (root) root.style.background = '#000';
  });
}

async function clickElement(page, symbol) {
  // Briefly show sidebar to click element
  await page.evaluate(() => {
    const a = document.querySelector('aside');
    if (a) a.style.display = '';
  });
  await page.waitForTimeout(300);

  const clicked = await page.evaluate((sym) => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const bold = btn.querySelector('[class*="font-bold"]');
      if (bold && bold.textContent.trim() === sym) {
        btn.click();
        return true;
      }
    }
    return false;
  }, symbol);

  return clicked;
}

async function captureAtomVideo(page, client, z, symbol, name) {
  const framesDir = path.join(TMP_DIR, `frames-${symbol}`);
  if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true });
  fs.mkdirSync(framesDir, { recursive: true });

  // Click element
  const clicked = await clickElement(page, symbol);
  if (!clicked) {
    console.log(`    ⚠ skip ${symbol} — not found`);
    return false;
  }

  // Hide UI again
  await hideUI(page);

  // Wait for orbital to render + settle
  await page.waitForTimeout(3000);

  // Start screencast
  let frameCount = 0;
  let firstTs = null;
  let lastTs = null;

  const onFrame = async ({ data, sessionId, metadata }) => {
    const ts = (metadata && metadata.timestamp) ? metadata.timestamp : (Date.now() / 1000);
    if (firstTs === null) firstTs = ts;
    lastTs = ts;
    const idx = frameCount++;
    const fp = path.join(framesDir, `${String(idx).padStart(6, '0')}.jpg`);
    fs.writeFileSync(fp, Buffer.from(data, 'base64'));
    try { await client.send('Page.screencastFrameAck', { sessionId }); } catch {}
  };

  client.on('Page.screencastFrame', onFrame);

  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 100,
    everyNthFrame: 1,
    maxWidth: W,
    maxHeight: H,
  });

  // Capture for CLIP_SEC seconds
  await page.waitForTimeout(CLIP_SEC * 1000);

  await client.send('Page.stopScreencast').catch(() => {});
  client.removeListener('Page.screencastFrame', onFrame);
  await page.waitForTimeout(500); // drain

  if (frameCount === 0) {
    console.log(`    ⚠ 0 frames for ${symbol}`);
    return false;
  }

  const dur = lastTs - firstTs;
  const fpsAvg = frameCount / Math.max(0.01, dur);
  console.log(`    ${frameCount} frames · ${dur.toFixed(1)}s · ${fpsAvg.toFixed(1)} fps`);

  // Encode HEVC NVENC
  const outFile = path.join(OUT_DIR, `atom-${String(z).padStart(3, '0')}-${symbol}.mp4`);
  run('ffmpeg', [
    '-y',
    '-framerate', fpsAvg.toFixed(4),
    '-i', path.join(framesDir, '%06d.jpg'),
    '-vf', `fps=${FPS},format=p010le`,
    '-c:v', 'hevc_nvenc',
    '-preset', 'p5',
    '-tune', 'hq',
    '-profile:v', 'main10',
    '-pix_fmt', 'p010le',
    '-tier', '1',
    '-rc', 'vbr',
    '-multipass', 'fullres',
    '-cq', String(CQ),
    '-b:v', BV,
    '-maxrate', MBV,
    '-bufsize', BUF,
    '-spatial_aq', '1',
    '-temporal_aq', '1',
    '-aq-strength', '8',
    '-rc-lookahead', '32',
    '-bf', '3',
    '-b_ref_mode', 'middle',
    '-g', String(FPS * 2),
    '-movflags', '+faststart',
    '-an',
    outFile,
  ]);

  // Cleanup frames
  fs.rmSync(framesDir, { recursive: true, force: true });

  const stat = fs.statSync(outFile);
  console.log(`    ✓ ${outFile.split('/').pop()} · ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
  return true;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  console.log(`\n🎬 Atom 4K Video Capture`);
  console.log(`   ${W}×${H} @ ${FPS}fps · ${CLIP_SEC}s per atom · HEVC 10-bit NVENC`);
  console.log(`   ${ATOMS.length} elements · output: ${OUT_DIR}\n`);

  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--headless=new',
      '--ignore-gpu-blocklist',
      '--enable-gpu', '--enable-gpu-rasterization', '--enable-zero-copy',
      '--enable-webgl', '--enable-accelerated-2d-canvas',
      '--disable-software-rasterizer',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      `--window-size=${W},${H}`,
    ],
  });

  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    bypassCSP: true,
  });

  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error') console.log(`  chrome: ${m.text().slice(0, 150)}`);
  });

  console.log(`  loading ${BASE_URL}/lab.html ...`);
  await page.goto(`${BASE_URL}/lab.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const client = await page.context().newCDPSession(page);

  let ok = 0;
  const t0 = Date.now();

  for (const [z, symbol, name] of ATOMS) {
    console.log(`\n  ⚛ Z=${z} ${symbol} — ${name}`);
    const success = await captureAtomVideo(page, client, z, symbol, name);
    if (success) ok++;
    const elapsed = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`    [${ok}/${ATOMS.length} done · ${elapsed} min elapsed]`);
  }

  await browser.close();

  // Cleanup tmp
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });

  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n✓ ${ok}/${ATOMS.length} videos · ${totalMin} min total`);
  console.log(`  output: ${OUT_DIR}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
