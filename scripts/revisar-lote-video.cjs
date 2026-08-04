/**
 * VIDEO DEL LOTE — "REVISAR EN VOLUMEN" en 4K (mandato 4K de CLAUDE.md).
 * ============================================================================
 * Graba la pantalla N-29 haciendo su trabajo REAL sobre 12 modelos (6 specs +
 * 6 STL del banco): el lote llenándose, la tabla ordenada por severidad, el
 * drill-down a una pieza REAL (carcasa RPi4) con cada criterio citando su § y
 * sus números vivos, y el expediente §13.10 firmándose.
 *
 * CAPTURA: viewport 1920×1080 con deviceScaleFactor 2 ⇒ frames de 3840×2160
 * exactos (la UI está diseñada para ~1600 px: capturar a 3840 lógicos dejaría
 * el texto ilegible de tan chico). El ritmo se controla con el demuxer concat
 * (una duración por frame) en vez de duplicar JPEGs de 4K.
 *
 * Uso (iangpu): DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   node /home/ian/Orkesta/la-forja/scripts/revisar-lote-video.cjs
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5002/forja-brep.html';
const OUT = process.env.OUT || '/mnt/e/forja-videos/revisar-lote-4k.mp4';
const TMP = process.env.TMP_DIR || '/tmp/rl-video-frames';
const FPS = 30;

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  const shots = [];                                   // { file, dur }
  let n = 0;

  const browser = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--hide-scrollbars', '--force-device-scale-factor=2', '--window-size=1920,1080'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });

  /** captura un frame y le asigna cuánto DURA en pantalla (s) */
  const snap = async (dur) => {
    const file = path.join(TMP, `${String(++n).padStart(5, '0')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 92, timeout: 30000 });
    shots.push({ file, dur });
  };
  /** scroll suave de un contenedor: cada paso es un frame de 1/FPS */
  const scrollSuave = async (sel, deltaTotal, pasos) => {
    for (let i = 0; i < pasos; i++) {
      await page.$eval(sel, (el, d) => { el.scrollTop += d; }, deltaTotal / pasos);
      await snap(1 / FPS);
    }
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction('window.__forgeBrep && !!document.querySelector("canvas")', null, { timeout: 45000 });
    await page.waitForTimeout(900);

    // ── ACTO 1: abrir el panel y VER el lote llenarse ──────────────────────
    await page.click('[data-testid="tab-simulacion"]');
    await page.waitForTimeout(300);
    const btn = page.locator('[data-testid="btn-revisar-lote"]');
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    await btn.click({ timeout: 8000 }).catch(async () => {
      await page.$eval('[data-testid="btn-revisar-lote"]', (el) => el.click());
    });
    await page.waitForSelector('[data-testid="revisar-lote-view"]', { timeout: 15000 });
    await snap(1.2);                                   // el panel recién abierto: todo en cola
    // el motor incremental resuelve uno a uno: se captura el progreso REAL
    for (let i = 0; i < 120; i++) {
      const pend = await page.$$('[data-testid^="rl-pend-"]');
      if (!pend.length) break;
      await snap(0.22);
      await page.waitForTimeout(220);
    }
    await snap(2.6);                                   // LA TABLA COMPLETA: 12 modelos por severidad
    console.log(`acto 1 · ${n} frames (lote lleno)`);

    // ── ACTO 2: drill-down a la pieza REAL del banco ───────────────────────
    await page.click('[data-testid="rl-row-carcasa RPi4"]');
    await page.waitForTimeout(500);
    await snap(2.2);                                   // el detalle de un STL real
    // recorrer los contratos: cada criterio con su § y sus números vivos
    await scrollSuave('[data-testid="rl-detail"]', 2600, 95);
    await snap(1.6);
    console.log(`acto 2 · ${n} frames (contratos)`);

    // ── ACTO 3: el expediente §13.10 — la firma ────────────────────────────
    // baja hasta el expediente y FIRMA la escuela de steel-safe
    await page.$eval('[data-testid="rl-decision-steel-safe-contraccion"]', (el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    await snap(1.8);
    const dec = '[data-testid="rl-decision-steel-safe-contraccion"]';
    const ops = await page.$eval(`${dec} select`, (s) => Array.from(s.options).map((o) => o.value).filter(Boolean));
    await page.selectOption(`${dec} select`, ops[1]);  // la escuela CONSTANTE
    await snap(1.4);
    await page.fill(`${dec} input`, 'ian');
    await snap(1.2);
    await page.click('[data-testid="rl-firmar-steel-safe-contraccion"]');
    await page.waitForTimeout(450);
    await snap(3.0);                                   // firmada: verde con fecha
    console.log(`acto 3 · ${n} frames (expediente firmado)`);

    // ── CIERRE: de vuelta a la tabla completa ──────────────────────────────
    await page.$eval('[data-testid="rl-detail"]', (el) => { el.scrollTop = 0; });
    await page.waitForTimeout(300);
    await snap(2.4);
  } finally {
    await browser.close();
  }

  // ── ENCODE 4K 10-bit NVENC (mandato 4K) ───────────────────────────────────
  const dims = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', shots[0].file]).toString().trim();
  console.log(`frames: ${shots.length} · resolución ${dims}`);
  if (!dims.startsWith('3840,2160')) throw new Error(`los frames NO son 4K (${dims}) — revisa deviceScaleFactor`);

  const lista = path.join(TMP, 'concat.txt');
  fs.writeFileSync(lista, shots.map((s) => `file '${s.file}'\nduration ${s.dur.toFixed(4)}`).join('\n')
    + `\nfile '${shots[shots.length - 1].file}'\n`);      // el demuxer pide repetir el último
  const durTotal = shots.reduce((a, s) => a + s.dur, 0);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', `fps=${FPS},format=p010le`,
    '-c:v', 'hevc_nvenc', '-preset', 'p5', '-tune', 'hq',
    '-profile:v', 'main10', '-pix_fmt', 'p010le', '-tier', '1',
    '-rc', 'vbr', '-multipass', 'fullres', '-cq', '21',
    '-b:v', '40M', '-maxrate', '70M', '-bufsize', '90M',
    '-spatial_aq', '1', '-temporal_aq', '1', '-rc-lookahead', '32',
    '-bf', '3', '-b_ref_mode', 'middle', '-g', String(FPS * 2),
    '-movflags', '+faststart', OUT], { stdio: 'inherit' });

  const mb = fs.statSync(OUT).size / 1e6;
  const real = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,nb_frames:format=duration', '-of', 'default=nw=1', OUT]).toString().trim();
  console.log(`\n✅ ${OUT} · ${mb.toFixed(1)} MB · ~${durTotal.toFixed(1)}s planeados\n${real}`);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
