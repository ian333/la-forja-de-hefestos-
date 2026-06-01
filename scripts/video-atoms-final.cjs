#!/usr/bin/env node
/**
 * video-atoms-final.cjs — Cinematic atom + GAIA Prime outro concat.
 *
 * Per atom:
 *   1. Capture 15s cinematic (deterministic frame-by-frame)
 *   2. Encode HEVC NVENC → atom clip
 *   3. Concat with GAIA Prime outro → final .mp4
 *
 * Env:
 *   ONLY=6        single atom (smoke test)
 *   ATOMS=1,2,6   comma-separated Z list
 *   FPS=60        framerate
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
const OUT_DIR = path.join(ROOT, 'dist-video', 'atoms-final');
const TMP_DIR = path.join(ROOT, 'dist-video', '.tmp', 'atoms-final');
const OUTRO_PATH = process.env.OUTRO || path.join(ROOT, 'assets', 'gaia-prime-outro-4k.mp4');

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

function selectAtoms() {
  if (process.env.ONLY) {
    return ATOMS_FULL.filter(a => String(a[0]) === process.env.ONLY);
  }
  if (process.env.ATOMS) {
    const zList = process.env.ATOMS.split(',').map(s => s.trim());
    return ATOMS_FULL.filter(a => zList.includes(String(a[0])));
  }
  return ATOMS_FULL;
}

const ATOMS = selectAtoms();

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
    if (m.type() === 'error') console.log(`    err: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', e => console.log(`    page err: ${e.message.slice(0, 200)}`));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(
    () => window.__cinematicAtom && window.__cinematicAtom.ready === true,
    null, { timeout: 20_000 }
  );
  await page.waitForTimeout(800);

  console.log(`    capturing ${totalFrames} frames @ ${FPS}fps ...`);
  const t0 = Date.now();
  let lastLog = t0;

  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS;
    await page.evaluate((tt) => window.__cinematicAtom.renderAt(tt), t);
    await page.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => r(null)))
    ));
    await page.screenshot({
      path: path.join(framesDir, `${String(i).padStart(6, '0')}.jpg`),
      type: 'jpeg', quality: 100, fullPage: false, animations: 'disabled',
    });

    if (Date.now() - lastLog > 8000) {
      const pct = ((i / totalFrames) * 100).toFixed(0);
      const fps = (i / ((Date.now() - t0) / 1000)).toFixed(1);
      console.log(`      ${pct}% · ${i}/${totalFrames} · ${fps} cap-fps`);
      lastLog = Date.now();
    }
  }
  await browser.close();
  console.log(`    ✓ ${totalFrames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);

  // Encode atom clip
  const atomClip = path.join(TMP_DIR, `clip-${symbol}.mp4`);
  console.log(`    encoding atom clip ...`);
  run('ffmpeg', [
    '-y', '-framerate', String(FPS),
    '-i', path.join(framesDir, '%06d.jpg'),
    '-vf', 'format=p010le',
    '-c:v', 'hevc_nvenc', '-preset', 'p7', '-tune', 'hq',
    '-profile:v', 'main10', '-pix_fmt', 'p010le', '-tier', '1',
    '-rc', 'vbr', '-multipass', 'fullres',
    '-cq', CQ, '-b:v', BV, '-maxrate', MBV, '-bufsize', BUF,
    '-spatial_aq', '1', '-temporal_aq', '1', '-aq-strength', '8',
    '-rc-lookahead', '32', '-bf', '3', '-b_ref_mode', 'middle',
    '-g', String(FPS * 2), '-movflags', '+faststart', '-an',
    atomClip,
  ]);
  fs.rmSync(framesDir, { recursive: true, force: true });

  // Re-encode outro to match (HEVC, same fps, 10-bit)
  const outroMatch = path.join(TMP_DIR, `outro-matched.mp4`);
  if (!fs.existsSync(outroMatch)) {
    console.log(`    encoding outro to match ...`);
    run('ffmpeg', [
      '-y', '-i', OUTRO_PATH,
      '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,format=p010le,fps=${FPS}`,
      '-c:v', 'hevc_nvenc', '-preset', 'p7', '-tune', 'hq',
      '-profile:v', 'main10', '-pix_fmt', 'p010le',
      '-rc', 'vbr', '-cq', '18', '-b:v', '80M',
      '-movflags', '+faststart', '-an',
      outroMatch,
    ]);
  }

  // Concat
  const finalFile = path.join(OUT_DIR, `atom-${String(z).padStart(3, '0')}-${symbol}.mp4`);
  const concatList = path.join(TMP_DIR, `concat-${symbol}.txt`);
  fs.writeFileSync(concatList, `file '${atomClip}'\nfile '${outroMatch}'\n`);
  console.log(`    concat + outro ...`);
  run('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
    '-c', 'copy', '-movflags', '+faststart', '-an',
    finalFile,
  ]);

  fs.unlinkSync(atomClip);
  fs.unlinkSync(concatList);

  const sz = fs.statSync(finalFile).size;
  console.log(`    ✓ ${path.basename(finalFile)} · ${(sz / 1024 / 1024).toFixed(1)} MB`);
  return true;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  if (!fs.existsSync(OUTRO_PATH)) {
    console.error(`\n✗ Outro not found: ${OUTRO_PATH}`);
    console.error(`  Copy gaia-prime outro to that path or set OUTRO=path\n`);
    process.exit(1);
  }

  console.log(`\n🎬 Cinematic Atoms — FINAL CUT`);
  console.log(`   ${W}×${H} @ ${FPS}fps · ${DURATION}s + 7s outro`);
  console.log(`   ${ATOMS.length} atoms · HEVC 10-bit NVENC`);
  console.log(`   outro: ${OUTRO_PATH}`);
  console.log(`   output: ${OUT_DIR}\n`);

  const t0 = Date.now();
  let ok = 0;
  for (const [z, sym, nm] of ATOMS) {
    try {
      await captureAtom(z, sym, nm);
      ok++;
    } catch (e) {
      console.error(`    ✗ ${sym} FAILED: ${e.message}`);
    }
    const el = ((Date.now() - t0) / 60000).toFixed(1);
    console.log(`    [${ok}/${ATOMS.length} done · ${el} min]\n`);
  }

  if (fs.existsSync(path.join(TMP_DIR, 'outro-matched.mp4')))
    fs.unlinkSync(path.join(TMP_DIR, 'outro-matched.mp4'));

  console.log(`\n✓ ${ok}/${ATOMS.length} final videos · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  console.log(`  ${OUT_DIR}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
