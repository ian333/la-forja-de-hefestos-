#!/usr/bin/env node
/**
 * video-atoms-vertical.cjs — Reels 9:16 para TikTok / Instagram.
 *
 * Difiere del horizontal (video-atoms-final.cjs):
 *   · 2160×3840 (4K vertical) · 30 fps · H.264 (no HEVC) · yuv420p
 *   · audio = sonificación del espectro real (scripts/atom-sonify.py) + reverb
 *   · sin outro 16:9 (necesitaría un outro vertical aparte)
 *
 * Specs alineadas a TikTok/IG 2026: 1080×1920 efectivo, H.264, 30fps, 8–20 Mbps.
 * Capturamos 4K vertical para forzar mayor bitrate en el re-encode de IG.
 *
 * Env:  ONLY=6 | ATOMS=1,2,6  ·  W H FPS BV  ·  NO_AUDIO=1
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const W   = parseInt(process.env.W   || '2160', 10);
const H   = parseInt(process.env.H   || '3840', 10);
const FPS = parseInt(process.env.FPS || '30',   10);
const DURATION = parseInt(process.env.DURATION || '15', 10);
const BV  = process.env.BV  || '22M';
const MBV = process.env.MBV || '28M';
const BUF = process.env.BUF || '44M';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-video', 'atoms-vertical');
const TMP_DIR = path.join(ROOT, 'dist-video', '.tmp', 'atoms-vertical');
const SONIFY = path.join(ROOT, 'scripts', 'atom-sonify.py');
const OUTRO_PATH = process.env.OUTRO || path.join(ROOT, 'assets', 'gaia-prime-outro-vertical-4k.mp4');
const NO_OUTRO = !!process.env.NO_OUTRO;

const ATOMS_FULL = [
  [1,'H','Hidrógeno'],[2,'He','Helio'],[3,'Li','Litio'],[4,'Be','Berilio'],
  [5,'B','Boro'],[6,'C','Carbono'],[7,'N','Nitrógeno'],[8,'O','Oxígeno'],
  [9,'F','Flúor'],[10,'Ne','Neón'],[11,'Na','Sodio'],[12,'Mg','Magnesio'],
  [13,'Al','Aluminio'],[14,'Si','Silicio'],[15,'P','Fósforo'],[16,'S','Azufre'],
  [17,'Cl','Cloro'],[18,'Ar','Argón'],[19,'K','Potasio'],[20,'Ca','Calcio'],
  [21,'Sc','Escandio'],[22,'Ti','Titanio'],[23,'V','Vanadio'],[24,'Cr','Cromo'],
  [25,'Mn','Manganeso'],[26,'Fe','Hierro'],[27,'Co','Cobalto'],[28,'Ni','Níquel'],
  [29,'Cu','Cobre'],[30,'Zn','Zinc'],[31,'Ga','Galio'],[32,'Ge','Germanio'],
  [33,'As','Arsénico'],[34,'Se','Selenio'],[35,'Br','Bromo'],[36,'Kr','Kriptón'],
  [37,'Rb','Rubidio'],[38,'Sr','Estroncio'],[39,'Y','Itrio'],[40,'Zr','Circonio'],
  [41,'Nb','Niobio'],[42,'Mo','Molibdeno'],[43,'Tc','Tecnecio'],[44,'Ru','Rutenio'],
  [45,'Rh','Rodio'],[46,'Pd','Paladio'],[47,'Ag','Plata'],[48,'Cd','Cadmio'],
  [49,'In','Indio'],[50,'Sn','Estaño'],[51,'Sb','Antimonio'],[52,'Te','Telurio'],
  [53,'I','Yodo'],[54,'Xe','Xenón'],[55,'Cs','Cesio'],[56,'Ba','Bario'],
  [57,'La','Lantano'],[58,'Ce','Cerio'],[59,'Pr','Praseodimio'],[60,'Nd','Neodimio'],
  [61,'Pm','Prometio'],[62,'Sm','Samario'],[63,'Eu','Europio'],[64,'Gd','Gadolinio'],
  [65,'Tb','Terbio'],[66,'Dy','Disprosio'],[67,'Ho','Holmio'],[68,'Er','Erbio'],
  [69,'Tm','Tulio'],[70,'Yb','Iterbio'],[71,'Lu','Lutecio'],[72,'Hf','Hafnio'],
  [73,'Ta','Tántalo'],[74,'W','Wolframio'],[75,'Re','Renio'],[76,'Os','Osmio'],
  [77,'Ir','Iridio'],[78,'Pt','Platino'],[79,'Au','Oro'],[80,'Hg','Mercurio'],
  [81,'Tl','Talio'],[82,'Pb','Plomo'],[83,'Bi','Bismuto'],[84,'Po','Polonio'],
  [85,'At','Astato'],[86,'Rn','Radón'],[87,'Fr','Francio'],[88,'Ra','Radio'],
  [89,'Ac','Actinio'],[90,'Th','Torio'],[91,'Pa','Protactinio'],[92,'U','Uranio'],
  [93,'Np','Neptunio'],[94,'Pu','Plutonio'],[95,'Am','Americio'],[96,'Cm','Curio'],
  [97,'Bk','Berkelio'],[98,'Cf','Californio'],[99,'Es','Einstenio'],[100,'Fm','Fermio'],
  [101,'Md','Mendelevio'],[102,'No','Nobelio'],[103,'Lr','Lawrencio'],[104,'Rf','Rutherfordio'],
  [105,'Db','Dubnio'],[106,'Sg','Seaborgio'],[107,'Bh','Bohrio'],[108,'Hs','Hassio'],
  [109,'Mt','Meitnerio'],[110,'Ds','Darmstadtio'],[111,'Rg','Roentgenio'],[112,'Cn','Copernicio'],
  [113,'Nh','Nihonio'],[114,'Fl','Flerovio'],[115,'Mc','Moscovio'],[116,'Lv','Livermorio'],
  [117,'Ts','Teneso'],[118,'Og','Oganesón'],
];

function selectAtoms() {
  if (process.env.ONLY) return ATOMS_FULL.filter(a => String(a[0]) === process.env.ONLY);
  if (process.env.ATOMS) {
    const z = process.env.ATOMS.split(',').map(s => s.trim());
    return ATOMS_FULL.filter(a => z.includes(String(a[0])));
  }
  return ATOMS_FULL;
}
const ATOMS = selectAtoms();

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'pipe' });
  if (r.status !== 0) {
    console.error(`    ${cmd} stderr: ${r.stderr?.toString().slice(-800)}`);
    throw new Error(`${cmd} exit ${r.status}`);
  }
  return r;
}

function makeAudio(z, symbol, dur) {
  if (process.env.NO_AUDIO) return null;
  const dry = path.join(TMP_DIR, `audio-${symbol}-dry.wav`);
  // pasamos Z → si no hay líneas NIST, atom-sonify deriva el espectro del átomo
  const r = spawnSync('python3', [SONIFY, symbol, dry, String(dur), String(z)], { stdio: 'pipe' });
  if (r.status !== 0) {
    console.log(`    (sin audio: ${symbol} — ${r.stderr?.toString().slice(-200)})`);
    return null;
  }
  return dry;
}

function ffprobeDuration(file) {
  const r = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration',
    '-of','default=noprint_wrappers=1:nokey=1', file], { stdio: 'pipe' });
  return parseFloat(r.stdout?.toString().trim() || '0') || 0;
}

// Re-encode el outro a los mismos params que el clip del átomo (una sola vez).
let _outroMatched = null;
function ensureOutroMatched() {
  if (NO_OUTRO || !fs.existsSync(OUTRO_PATH)) return null;
  if (_outroMatched) return _outroMatched;
  const out = path.join(TMP_DIR, 'outro-matched.mp4');
  run('ffmpeg', [
    '-y','-i', OUTRO_PATH,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${FPS},format=yuv420p`,
    '-c:v','h264_nvenc','-preset','p7','-profile:v','high','-pix_fmt','yuv420p',
    '-rc','vbr','-cq','19','-b:v',BV,'-maxrate',MBV,'-bufsize',BUF,
    '-g', String(FPS*2), '-movflags','+faststart','-an', out,
  ]);
  _outroMatched = out;
  return out;
}

async function captureAtom(z, symbol, name) {
  const framesDir = path.join(TMP_DIR, `frames-${symbol}`);
  if (fs.existsSync(framesDir)) fs.rmSync(framesDir, { recursive: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const totalFrames = DURATION * FPS;
  const url = `${BASE_URL}/cinematic-atom.html?z=${z}`;
  console.log(`  ⚛ Z=${z} ${symbol} — ${name}  (${W}×${H} @ ${FPS}fps)`);

  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox','--disable-setuid-sandbox','--headless=new',
      '--ignore-gpu-blocklist','--enable-gpu','--enable-gpu-rasterization',
      '--enable-webgl','--disable-software-rasterizer',
      '--disable-background-timer-throttling','--hide-scrollbars',
      `--window-size=${W},${H}`,
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(
    () => window.__cinematicAtom && window.__cinematicAtom.ready === true,
    null, { timeout: 20_000 });
  await page.waitForTimeout(800);

  const t0 = Date.now();
  let lastLog = t0;
  for (let i = 0; i < totalFrames; i++) {
    await page.evaluate((tt) => window.__cinematicAtom.renderAt(tt), i / FPS);
    await page.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.screenshot({
      path: path.join(framesDir, `${String(i).padStart(6,'0')}.jpg`),
      type: 'jpeg', quality: 100, animations: 'disabled',
    });
    if (Date.now() - lastLog > 8000) {
      console.log(`      ${((i/totalFrames)*100).toFixed(0)}% · ${i}/${totalFrames}`);
      lastLog = Date.now();
    }
  }
  await browser.close();
  console.log(`    ✓ ${totalFrames} frames in ${((Date.now()-t0)/1000).toFixed(0)}s`);

  // Encode H.264 (silent), yuv420p — máxima compatibilidad redes
  const clip = path.join(TMP_DIR, `clip-${symbol}.mp4`);
  run('ffmpeg', [
    '-y','-framerate', String(FPS), '-i', path.join(framesDir, '%06d.jpg'),
    '-c:v','h264_nvenc','-preset','p7','-tune','hq','-profile:v','high',
    '-pix_fmt','yuv420p','-rc','vbr','-cq','19',
    '-b:v',BV,'-maxrate',MBV,'-bufsize',BUF,
    '-spatial_aq','1','-temporal_aq','1','-rc-lookahead','20',
    '-g', String(FPS*2), '-movflags','+faststart','-an', clip,
  ]);
  fs.rmSync(framesDir, { recursive: true, force: true });

  // Concatenar outro GAIA Prime vertical (si existe)
  const outroMatched = ensureOutroMatched();
  let silent = clip;
  if (outroMatched) {
    const concatList = path.join(TMP_DIR, `concat-${symbol}.txt`);
    const merged = path.join(TMP_DIR, `merged-${symbol}.mp4`);
    fs.writeFileSync(concatList, `file '${clip}'\nfile '${outroMatched}'\n`);
    run('ffmpeg', ['-y','-f','concat','-safe','0','-i', concatList,
      '-c','copy','-movflags','+faststart','-an', merged]);
    fs.unlinkSync(concatList);
    fs.unlinkSync(clip);
    silent = merged;
  }

  // Audio sonificado cubriendo TODO el video (átomo + outro): el drone resuelve
  // sobre el logo. Reverb de catedral + nivelación.
  const totalDur = ffprobeDuration(silent);
  const finalFile = path.join(OUT_DIR, `atom-${String(z).padStart(3,'0')}-${symbol}.mp4`);
  const dry = makeAudio(z, symbol, totalDur || (DURATION + 3));
  if (dry) {
    run('ffmpeg', [
      '-y','-i', silent, '-i', dry, '-map','0:v','-map','1:a',
      '-af','highpass=f=28, aecho=0.8:0.9:83|137|211|307:0.45|0.36|0.28|0.2, aecho=0.85:0.9:431|617:0.16|0.1, lowpass=f=3400, loudnorm=I=-18:TP=-2:LRA=10',
      '-c:v','copy','-c:a','aac','-b:a','256k','-ar','48000','-shortest',
      '-movflags','+faststart', finalFile,
    ]);
    fs.unlinkSync(silent);
    fs.unlinkSync(dry);
  } else {
    fs.renameSync(silent, finalFile);
  }

  const sz = fs.statSync(finalFile).size;
  console.log(`    ✓ ${path.basename(finalFile)} · ${(sz/1024/1024).toFixed(1)} MB${dry?' +audio':''}${outroMatched?' +outro':''}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  console.log(`\n🎬 Atoms VERTICAL (reels) · ${W}×${H} @ ${FPS}fps · H.264 · ${ATOMS.length} atoms\n`);
  const t0 = Date.now();
  let ok = 0;
  for (const [z, sym, nm] of ATOMS) {
    try { await captureAtom(z, sym, nm); ok++; }
    catch (e) { console.error(`    ✗ ${sym} FAILED: ${e.message}`); }
    console.log(`    [${ok}/${ATOMS.length} · ${((Date.now()-t0)/60000).toFixed(1)} min]\n`);
  }
  console.log(`\n✓ ${ok}/${ATOMS.length} reels · ${((Date.now()-t0)/60000).toFixed(1)} min\n  ${OUT_DIR}\n`);
}
main().catch(e => { console.error(e); process.exit(1); });
