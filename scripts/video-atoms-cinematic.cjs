#!/usr/bin/env node
/**
 * video-atoms-cinematic.cjs — Captura DETERMINISTA frame-by-frame de
 * CinematicAtom.tsx. 60 fps verdaderos, 4K, sin importar el speed del GPU.
 *
 * Cómo:
 *   1. Carga /cinematic-atom.html?z=N
 *   2. Espera a que window.__cinematicAtom esté lista
 *   3. Para cada frame i ∈ [0, 900):
 *        - window.__cinematicAtom.renderAt(i/60)
 *        - waitForFrame (rAF×2)
 *        - page.screenshot → JPEG q=100
 *   4. ffmpeg HEVC NVENC 10-bit @ 60fps
 *
 * Uso en iangpu:
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     node scripts/video-atoms-cinematic.cjs
 *
 * Variables:
 *   ONLY=6        solo carbon (un solo átomo, smoke test)
 *   DURATION=15   segundos por átomo
 *   FPS=60        framerate output
 *   W/H           4K default
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const W   = parseInt(process.env.W   || '3840', 10);
const H   = parseInt(process.env.H   || '2160', 10);
const FPS = parseInt(process.env.FPS || '60',   10);
const DURATION = parseInt(process.env.DURATION || '15', 10);
const CQ  = process.env.CQ  || '17';
const BV  = process.env.BV  || '120M';
const MBV = process.env.MBV || '220M';
const BUF = process.env.BUF || '440M';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-video', 'atoms-cinematic');
const TMP_DIR = path.join(ROOT, 'dist-video', '.tmp', 'atoms-cin');

const ATOMS_FULL = [
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

const ATOMS = process.env.ONLY
  ? ATOMS_FULL.filter(a => String(a[0]) === String(process.env.ONLY))
  : ATOMS_FULL;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'pipe' });
  if (r.status !== 0) {
    console.error(`    ffmpeg stderr: ${r.stderr?.toString().slice(-1000)}`);
    throw new Error(`${cmd} exit ${r.status}`);
  }
}

async function captureAtom(z, symbol, name) {
  const framesDir = path.join(TMP_DIR, `frames-${symbol}`);
  if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const totalFrames = DURATION * FPS;
  const url = `${BASE_URL}/cinematic-atom.html?z=${z}`;

  console.log(`  ⚛ Z=${z} ${symbol} — ${name}`);
  console.log(`    ${url}`);

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
      '--hide-scrollbars',
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
    const t = m.type();
    if (t === 'error') console.log(`    chrome err: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', e => console.log(`    page err: ${e.message.slice(0, 200)}`));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });

  // Wait until cinematic api is ready
  await page.waitForFunction(
    () => window.__cinematicAtom && window.__cinematicAtom.ready === true,
    null,
    { timeout: 20_000 }
  );

  // Wait for first paint stabilization
  await page.waitForTimeout(800);

  console.log(`    capturing ${totalFrames} frames @ ${FPS}fps deterministic ...`);
  const t0 = Date.now();
  let lastLog = t0;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => {
      window.__cinematicAtom.renderAt(tt);
    }, t);

    // Wait two rAFs to ensure render settles
    await page.evaluate(() => new Promise(r => {
      requestAnimationFrame(() => requestAnimationFrame(() => r(null)));
    }));

    await page.screenshot({
      path: path.join(framesDir, `${String(i).padStart(6, '0')}.jpg`),
      type: 'jpeg',
      quality: 100,
      fullPage: false,
      animations: 'disabled',
    });

    if (Date.now() - lastLog > 5000) {
      const pct = ((i / totalFrames) * 100).toFixed(0);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
      const fps = (i / ((Date.now() - t0) / 1000)).toFixed(1);
      console.log(`      ${pct}% · ${i}/${totalFrames} · ${elapsed}s · ${fps} cap-fps`);
      lastLog = Date.now();
    }
  }

  await browser.close();

  const captureDur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`    ✓ ${totalFrames} frames in ${captureDur}s`);

  // Encode
  const outFile = path.join(OUT_DIR, `atom-${String(z).padStart(3, '0')}-${symbol}.mp4`);
  console.log(`    encoding HEVC NVENC ...`);
  const enc0 = Date.now();
  run('ffmpeg', [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(framesDir, '%06d.jpg'),
    '-vf', `format=p010le`,
    '-c:v', 'hevc_nvenc',
    '-preset', 'p7',
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

  fs.rmSync(framesDir, { recursive: true, force: true });
  const sz = fs.statSync(outFile).size;
  const encDur = ((Date.now() - enc0) / 1000).toFixed(1);
  console.log(`    ✓ ${path.basename(outFile)} · ${(sz / 1024 / 1024).toFixed(1)} MB · enc ${encDur}s`);
  return true;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  console.log(`\n🎬 Cinematic Atom Capture · DETERMINISTIC`);
  console.log(`   ${W}×${H} @ ${FPS}fps · ${DURATION}s · ${ATOMS.length} atoms`);
  console.log(`   HEVC 10-bit NVENC · bv=${BV} maxrate=${MBV} cq=${CQ}`);
  console.log(`   output: ${OUT_DIR}\n`);

  const t0 = Date.now();
  let ok = 0;
  for (const [z, sym, nm] of ATOMS) {
    try {
      const success = await captureAtom(z, sym, nm);
      if (success) ok++;
    } catch (e) {
      console.error(`    ✗ ${sym} FAILED: ${e.message}`);
    }
    const el = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`    [${ok}/${ATOMS.length} done · ${el} min elapsed]\n`);
  }

  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });

  const totalMin = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n✓ ${ok}/${ATOMS.length} videos · ${totalMin} min total`);
  console.log(`  output: ${OUT_DIR}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
