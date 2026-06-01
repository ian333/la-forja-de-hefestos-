#!/usr/bin/env node
/**
 * video-molecule-vertical.cjs — Reel 9:16 de una molécula (cinematic-molecule.html).
 * Mismo formato que los átomos verticales (2160×3840, 30fps, H.264, outro GAIA),
 * pero el audio es la sonificación de los modos vibracionales (sonify-water-vibes.py).
 *
 * Uso:  MOL=h2o node scripts/video-molecule-vertical.cjs
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const W = parseInt(process.env.W || '2160', 10);
const H = parseInt(process.env.H || '3840', 10);
const FPS = parseInt(process.env.FPS || '30', 10);
const DURATION = parseInt(process.env.DURATION || '15', 10);
const BV = process.env.BV || '22M', MBV = process.env.MBV || '28M', BUF = process.env.BUF || '44M';
const MOL = (process.env.MOL || 'h2o').toLowerCase();
const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-video', 'molecules-vertical');
const TMP_DIR = path.join(ROOT, 'dist-video', '.tmp', 'molecules-vertical');
const OUTRO_PATH = process.env.OUTRO || path.join(ROOT, 'assets', 'gaia-prime-outro-vertical-4k.mp4');
const VIBES = path.join(ROOT, 'scripts', 'sonify-water-vibes.py');

const NAMES = { h2o: 'Agua', ch4: 'Metano', nh3: 'Amoniaco', co2: 'CO2' };

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'pipe' });
  if (r.status !== 0) { console.error(`${cmd}: ${r.stderr?.toString().slice(-800)}`); throw new Error(`${cmd} exit ${r.status}`); }
  return r;
}
function ffdur(f) {
  const r = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', f]);
  return parseFloat(r.stdout?.toString().trim() || '0') || 0;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const framesDir = path.join(TMP_DIR, `frames-${MOL}`);
  if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const total = DURATION * FPS;
  console.log(`🎬 Molécula ${MOL} — ${W}×${H} @ ${FPS}fps · ${total} frames`);
  const browser = await chromium.launch({
    headless: false, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--disable-setuid-sandbox','--headless=new','--ignore-gpu-blocklist',
      '--enable-gpu','--enable-gpu-rasterization','--enable-webgl','--disable-software-rasterizer',
      '--disable-background-timer-throttling','--hide-scrollbars',`--window-size=${W},${H}`],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/cinematic-molecule.html?m=${MOL}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(800);

  const t0 = Date.now(); let last = t0;
  for (let i = 0; i < total; i++) {
    await page.evaluate((tt) => window.__cinematicAtom.renderAt(tt), i / FPS);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.screenshot({ path: path.join(framesDir, `${String(i).padStart(6,'0')}.jpg`), type: 'jpeg', quality: 100, animations: 'disabled' });
    if (Date.now() - last > 8000) { console.log(`  ${((i/total)*100).toFixed(0)}% · ${i}/${total}`); last = Date.now(); }
  }
  await browser.close();
  console.log(`  ✓ ${total} frames in ${((Date.now()-t0)/1000).toFixed(0)}s`);

  // Encode H.264 silent
  const clip = path.join(TMP_DIR, `clip-${MOL}.mp4`);
  run('ffmpeg', ['-y','-framerate',String(FPS),'-i',path.join(framesDir,'%06d.jpg'),
    '-c:v','h264_nvenc','-preset','p7','-tune','hq','-profile:v','high','-pix_fmt','yuv420p',
    '-rc','vbr','-cq','19','-b:v',BV,'-maxrate',MBV,'-bufsize',BUF,
    '-spatial_aq','1','-temporal_aq','1','-rc-lookahead','20','-g',String(FPS*2),'-movflags','+faststart','-an', clip]);
  fs.rmSync(framesDir, { recursive: true, force: true });

  // Concat outro
  let silent = clip;
  if (fs.existsSync(OUTRO_PATH)) {
    const om = path.join(TMP_DIR, 'outro-matched.mp4');
    run('ffmpeg', ['-y','-i',OUTRO_PATH,'-vf',`scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p`,
      '-c:v','h264_nvenc','-preset','p7','-profile:v','high','-pix_fmt','yuv420p','-rc','vbr','-cq','19','-b:v',BV,'-g',String(FPS*2),'-movflags','+faststart','-an', om]);
    const merged = path.join(TMP_DIR, `merged-${MOL}.mp4`);
    const lst = path.join(TMP_DIR, `concat-${MOL}.txt`);
    fs.writeFileSync(lst, `file '${clip}'\nfile '${om}'\n`);
    run('ffmpeg', ['-y','-f','concat','-safe','0','-i',lst,'-c','copy','-movflags','+faststart','-an', merged]);
    fs.unlinkSync(lst); fs.unlinkSync(clip); silent = merged;
  }

  // Audio: modos vibracionales (solo h2o por ahora)
  const finalFile = path.join(OUT_DIR, `mol-${MOL}.mp4`);
  const totalDur = ffdur(silent) || (DURATION + 3);
  let dry = null;
  if (MOL === 'h2o' && !process.env.NO_AUDIO) {
    dry = path.join(TMP_DIR, `audio-${MOL}.wav`);
    const r = spawnSync('python3', [VIBES, dry, String(totalDur)], { stdio: 'pipe' });
    if (r.status !== 0) { console.log('  (audio falló)'); dry = null; }
  }
  if (dry) {
    run('ffmpeg', ['-y','-i',silent,'-i',dry,'-map','0:v','-map','1:a',
      '-af','highpass=f=28, aecho=0.8:0.9:83|137|211|307:0.45|0.36|0.28|0.2, aecho=0.85:0.9:431|617:0.16|0.1, lowpass=f=3800, loudnorm=I=-18:TP=-2:LRA=10',
      '-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-shortest','-movflags','+faststart', finalFile]);
    fs.unlinkSync(silent); fs.unlinkSync(dry);
  } else { fs.renameSync(silent, finalFile); }

  const sz = fs.statSync(finalFile).size;
  console.log(`✓ ${path.basename(finalFile)} · ${(sz/1024/1024).toFixed(1)} MB · ${ffdur(finalFile).toFixed(1)}s`);
})().catch(e => { console.error(e); process.exit(1); });
