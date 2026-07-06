#!/usr/bin/env node
/**
 * render-local.cjs — Render de UN átomo en esta laptop (SwiftShader + libx264).
 * Para los 2 showcase (Carbono, Oro) sin depender de iangpu.
 *   1080×1920 · 30fps · H.264 (libx264, CPU) · audio sonificado + outro GAIA.
 *
 * Requiere el dev server corriendo en :5001 (vite --port 5001).
 * Uso:  Z=6 SYM=C node scripts/render-local.cjs
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const FPS = 30, DURATION = 18, DPR = parseInt(process.env.DPR || '1');
const Z = process.env.Z || '6';
const SYM = process.env.SYM || 'C';
const MOL = process.env.MOL || '';               // si está → renderiza MOLÉCULA
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROOT, 'dist-video', 'showcase');
const TMP = path.join(ROOT, 'dist-video', '.tmp', 'showcase');
const OUTRO = path.join(ROOT, 'assets', 'gaia-prime-outro-vertical-4k.mp4');
const SONIFY = path.join(ROOT, 'scripts', 'atom-sonify.py');
const VIBES = path.join(ROOT, 'scripts', 'sonify-water-vibes.py');
const MOLSONIFY = path.join(ROOT, 'scripts', 'sonify-molecule.py');
const DNASONIFY = path.join(ROOT, 'scripts', 'sonify-dna.py');
const IS_DNA = ['brca1', 'telomero', 'tata'].includes(MOL);
const PAGE_URL = MOL ? `cinematic-molecule.html?m=${MOL}` : `cinematic-atom.html?z=${Z}`;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'pipe' });
  if (r.status !== 0) { console.error(`${cmd}: ${r.stderr?.toString().slice(-600)}`); throw new Error(`${cmd} ${r.status}`); }
  return r;
}
function ffdur(f){ const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',f]); return parseFloat(r.stdout?.toString().trim()||'0')||0; }

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  const TAG = process.env.OUTNAME || SYM;          // único por render → paralelo-seguro
  const framesDir = path.join(TMP, `frames-${TAG}`);
  if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true });
  fs.mkdirSync(framesDir, { recursive: true });

  console.log(`⚛ ${SYM} (Z=${Z}) — ${W*DPR}×${H*DPR} @ ${FPS}fps · arrancando…`);
  const BASE = process.env.BASE_URL || 'http://localhost:5001';
  const gpuArgs = ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--enable-webgl','--disable-software-rasterizer','--hide-scrollbars',`--window-size=${W},${H}`];
  const swArgs  = ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-software-rasterizer','--hide-scrollbars',`--window-size=${W},${H}`];
  const browser = await chromium.launch({ headless: process.env.GPU ? false : true, executablePath: '/usr/bin/google-chrome-stable',
    args: process.env.GPU ? gpuArgs : swArgs });
  const page = await (await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:DPR, bypassCSP:true })).newPage();
  await page.goto(`${BASE}/${PAGE_URL}`, { waitUntil:'networkidle', timeout:60000 });
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout:30000 });
  await page.waitForTimeout(800);

  // Duración VARIABLE leída de la página (depende del # de subcapas del elemento):
  // el zoom-out final dura más en átomos con muchas órbitas.
  const vidDur = (await page.evaluate(() => window.__cinematicAtom.duration)) || DURATION;
  const total = Math.round(vidDur * FPS);
  console.log(`  ${SYM}: duración ${vidDur}s · ${total} frames`);

  // Brillo medio del canvas (downscale 8×8 vía 2D) — requiere preserveDrawingBuffer.
  // Sirve para detectar frames negros: el driver Mesa/ANGLE ocasionalmente dibuja
  // un frame en negro para ciertos valores de tiempo exactos (bug de precisión).
  const canvasLuma = () => page.evaluate(() => {
    const c = document.querySelector('canvas'); if (!c) return 255;
    const s = document.createElement('canvas'); s.width = 8; s.height = 8;
    const x = s.getContext('2d'); x.drawImage(c, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data; let sum = 0;
    for (let k = 0; k < d.length; k += 4) sum += d[k] + d[k + 1] + d[k + 2];
    return sum / (64 * 3);
  });
  const settle = () => page.evaluate(() => new Promise(r =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))));
  const ensureReady = () => page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 20000 });
  // Resiliente: si la página se recargó (HMR) y window.__cinematicAtom desapareció,
  // re-espera ready y reintenta — así un reload no mata el render a media grabación.
  const renderAt = async (tt) => {
    try { await page.evaluate((t) => window.__cinematicAtom.renderAt(t), tt); }
    catch { await ensureReady().catch(() => {}); await page.waitForTimeout(300); await page.evaluate((t) => window.__cinematicAtom.renderAt(t), tt); }
  };

  const t0 = Date.now(); let last = t0; let reshot = 0; let prevLuma = null;
  for (let i = 0; i < total; i++) {
    let tt = i / FPS;
    await renderAt(tt); await settle(); await page.waitForTimeout(12);
    let luma = await canvasLuma();
    // Re-disparo adaptativo anti-glitch: el driver Mesa/ANGLE a veces dibuja un
    // frame NEGRO para ciertos valores de tiempo exactos. El contenido es continuo,
    // así que una CAÍDA súbita de brillo (>55% vs el frame previo) = glitch → jitter
    // sub-ms hasta que dibuje bien (imperceptible).
    for (let tries = 0; tt > 2.0 && prevLuma !== null && luma < 0.45 * prevLuma && tries < 8; tries++) {
      tt = i / FPS + 0.0011 * (tries + 1) + 0.0003;
      await renderAt(tt); await settle(); await page.waitForTimeout(12);
      luma = await canvasLuma();
      if (luma >= 0.45 * prevLuma) reshot++;
    }
    await page.screenshot({ path: path.join(framesDir, `${String(i).padStart(6,'0')}.jpg`), type:'jpeg', quality: parseInt(process.env.JPGQ || '95'), animations:'disabled' });
    prevLuma = luma;
    if (Date.now()-last > 10000) { console.log(`  ${((i/total)*100).toFixed(0)}% · ${i}/${total} · ${((Date.now()-t0)/1000/Math.max(1,i)).toFixed(1)}s/frame · reshot=${reshot}`); last = Date.now(); }
  }
  console.log(`  frames re-disparados (anti-negro): ${reshot}`);
  await browser.close();
  console.log(`  ✓ ${total} frames en ${((Date.now()-t0)/60000).toFixed(1)} min`);

  // Encode H.264 (CPU)
  const clip = path.join(TMP, `clip-${TAG}.mp4`);
  const venc = process.env.VENC || 'libx264';
  // Calidad: por defecto alta; el batch nocturno sube CQ/bitrate al máximo.
  const CQ = process.env.CQ || '18';
  const VB = process.env.VBITRATE || '20M';
  const encArgs = venc === 'h264_nvenc'
    ? ['-c:v','h264_nvenc','-preset','p7','-tune','hq','-profile:v','high','-rc','vbr','-cq',CQ,'-b:v',VB,'-maxrate','40M','-bufsize','80M']
    : ['-c:v','libx264','-preset','medium','-crf','17'];
  run('ffmpeg', ['-y','-framerate',String(FPS),'-i',path.join(framesDir,'%06d.jpg'),
    ...encArgs,'-pix_fmt','yuv420p','-movflags','+faststart','-an', clip]);
  fs.rmSync(framesDir, { recursive: true, force: true });

  // Outro con CROSSFADE — el átomo se disuelve en el outro (sin corte a negro)
  // y el outro se escala a las dimensiones REALES del clip (DPR), evitando el
  // cambio de resolución a mitad de stream que se veía como ~1s negro en 4K.
  let silent = clip;
  if (fs.existsSync(OUTRO)) {
    const EW = W * DPR, EH = H * DPR;
    const om = path.join(TMP, `outro-${TAG}.mp4`);
    run('ffmpeg',['-y','-i',OUTRO,'-vf',`scale=${EW}:${EH}:force_original_aspect_ratio=decrease,pad=${EW}:${EH}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p`,
      ...encArgs,'-pix_fmt','yuv420p','-an', om]);
    const merged = path.join(TMP, `merged-${TAG}.mp4`);
    const clipDur = ffdur(clip) || DURATION;
    const xf = 0.7, off = Math.max(0, clipDur - xf);
    run('ffmpeg',['-y','-i',clip,'-i',om,'-filter_complex',
      `[0:v][1:v]xfade=transition=fade:duration=${xf}:offset=${off},format=yuv420p[v]`,
      '-map','[v]', ...encArgs,'-pix_fmt','yuv420p','-an', merged]);
    fs.unlinkSync(clip); silent = merged;
  }

  // Audio sonificado
  const finalFile = path.join(OUT_DIR, `${process.env.OUTNAME || SYM}.mp4`);
  const dur = ffdur(silent) || (DURATION+3);
  const dry = path.join(TMP, `audio-${process.env.OUTNAME || SYM}.wav`);
  // Audio: ADN → su CÁNTICO (secuencia→melodía + coro); AGUA → modos vibracionales;
  // otras moléculas → mezcla de voces de sus átomos; átomos → espectro de emisión.
  const ar = IS_DNA
    ? spawnSync('python3', [DNASONIFY, MOL, dry, String(dur)], { stdio:'pipe' })
    : MOL === 'h2o'
      ? spawnSync('python3', [VIBES, dry, String(dur)], { stdio:'pipe' })
      : MOL
        ? spawnSync('python3', [MOLSONIFY, MOL, dry, String(dur)], { stdio:'pipe' })
        : spawnSync('python3', [SONIFY, SYM, dry, String(dur), Z], { stdio:'pipe' });
  if (ar.status === 0) {
    run('ffmpeg',['-y','-i',silent,'-i',dry,'-map','0:v','-map','1:a',
      '-af','highpass=f=28, aecho=0.8:0.9:83|137|211|307:0.45|0.36|0.28|0.2, aecho=0.85:0.9:431|617:0.16|0.1, lowpass=f=3400, loudnorm=I=-18:TP=-2:LRA=10',
      '-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-shortest','-movflags','+faststart', finalFile]);
    fs.unlinkSync(silent); fs.unlinkSync(dry);
  } else { fs.renameSync(silent, finalFile); console.log('  (sin audio)'); }
  console.log(`✓ ${finalFile} · ${(fs.statSync(finalFile).size/1024/1024).toFixed(1)} MB · ${ffdur(finalFile).toFixed(1)}s`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
