#!/usr/bin/env node
/**
 * render-clase.cjs — render 4K de una masterclass cine (clase.html) con el reloj
 * determinista __cineT. Pipeline canónico de La Forja:
 *   · contexto de browser FRESCO por lote (~300 frames) → cero fuga de VRAM
 *   · screenshot timeout FINITO (30 s); resumable por frame VÁLIDO (size>0)
 *   · encode NVENC: master HEVC 10-bit + entrega H264; audio opcional
 *   · server estático propio (python http.server) sobre dist/
 *
 *   SLUG=romer ID=econ-2018-romer-nordhaus END=226 AUDIO=auto FMT=916 node scripts/render-clase.cjs
 *   SLUG=krugman ID=econ-2008-krugman END=44 AUDIO=none FMT=169 node scripts/render-clase.cjs
 *
 * Env: SLUG, ID, END, FPS, FMT(916|169), AUDIO(auto|none|ruta), BATCH, PORT, OUTDIR
 *  · AUDIO=auto → usa public/audio/clase-<SLUG>/narration.mp3 si existe, si no, sin audio.
 */
'use strict';
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');

const FMT = process.env.FMT || '916';
let [W, H] = FMT === '169' ? [3840, 2160] : [2160, 3840];
// Override de resolución: W/H explícitos (p.ej. 1080 9:16 = W=1080 H=1920 para
// previews/tests rápidos; el master de entrega sigue siendo 4K por mandato).
if (process.env.W && process.env.H) { W = parseInt(process.env.W, 10); H = parseInt(process.env.H, 10); }
const SLUG = process.env.SLUG || 'romer';
const ID = process.env.ID || 'econ-2018-romer-nordhaus';
const END = parseFloat(process.env.END || '226');
const FPS = parseInt(process.env.FPS || '24', 10);
const BATCH = parseInt(process.env.BATCH || '300', 10);
const PORT = parseInt(process.env.PORT || '8123', 10);
const ROOT = path.resolve(__dirname, '..');
const OUTDIR = process.env.OUTDIR || path.join(ROOT, 'dist-video', `clase-${SLUG}`);
const FRAMES = path.join(OUTDIR, `frames-${FMT}`);

// audio: auto-detecta narration.mp3 de la clase; 'none' = pieza visual sin voz.
let AUDIO = process.env.AUDIO || 'auto';
if (AUDIO === 'auto') {
  const guess = path.join(ROOT, 'public', 'audio', `clase-${SLUG}`, 'narration.mp3');
  AUDIO = fs.existsSync(guess) ? guess : 'none';
}
const HAS_AUDIO = AUDIO !== 'none' && fs.existsSync(AUDIO);

const MASTER = path.join(OUTDIR, `clase-${SLUG}-${FMT}-4k-hevc10.mp4`);
const DELIVERY = path.join(OUTDIR, `clase-${SLUG}-${FMT}-4k.mp4`);

const N = Math.round(END * FPS);
const fname = i => path.join(FRAMES, `${String(i).padStart(5, '0')}.jpg`);
// un frame está LISTO solo si existe Y tiene bytes: un screenshot truncado por
// corte de red queda en 0 bytes y existsSync daría true → ffmpeg pararía ahí.
const ready = i => { try { return fs.statSync(fname(i)).size > 0; } catch { return false; } };

function encode(codec, pix, out) {
  const a = ['-y', '-framerate', String(FPS), '-i', path.join(FRAMES, '%05d.jpg')];
  if (HAS_AUDIO) a.push('-i', AUDIO, '-map', '0:v', '-map', '1:a');
  a.push('-c:v', codec, '-preset', 'p5', '-rc', 'vbr', '-cq', '19', '-b:v', '0', '-pix_fmt', pix);
  if (HAS_AUDIO) a.push('-c:a', 'aac', '-b:a', '192k');
  a.push('-t', String(END), out);
  execFileSync('ffmpeg', a, { stdio: 'inherit' });
}

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });

  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', path.join(ROOT, 'dist')],
    { stdio: 'ignore' });
  const killSrv = () => { try { srv.kill(); } catch { /* ya murió */ } };
  process.on('exit', killSrv);
  await new Promise(r => setTimeout(r, 1500));

  // GUARDA ANTI-SQUATTER: si el puerto ya estaba OCUPADO (otra sesión sirviendo
  // OTRO árbol: /tmp/forja-mirror, ~/forja-aero/dist…), nuestro spawn falla EN
  // SILENCIO (stdio ignore) y renderizaríamos 45 min de CÓDIGO AJENO/VIEJO.
  // Verifica que lo servido sea EXACTAMENTE nuestro dist antes de tocar la GPU.
  // (Nos mordió DOS veces el mismo día: squatter en 8123 y luego en 8127.)
  const servido = await new Promise((res, rej) => {
    require('http').get(`http://localhost:${PORT}/clase.html`, r => {
      let d = ''; r.on('data', c => { d += c; }); r.on('end', () => res(d));
    }).on('error', rej);
  });
  const enDisco = fs.readFileSync(path.join(ROOT, 'dist', 'clase.html'), 'utf8');
  if (servido !== enDisco) {
    killSrv();
    throw new Error(`PUERTO ${PORT} SQUATTEADO: lo servido NO es nuestro dist (otra sesión sirve otro árbol). Relanza con otro PORT.`);
  }

  const LAUNCH = () => chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
      '--disable-software-rasterizer', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
      '--hide-scrollbars', `--window-size=${W},${H}`] });
  // PIDs de los chrome que lanza ESTE render (los únicos que podemos matar).
  // browser.process() NO existe en esta versión de Playwright → los detectamos
  // por diferencia: los chrome que aparecen tras nuestro launch son nuestros.
  const ourChromes = new Set();
  const chromeSnapshot = () => {
    try { return execFileSync('pgrep', ['-x', 'chrome'], { encoding: 'utf8' }).split('\n').filter(Boolean).map(Number); }
    catch { return []; }                          // sin match = 0 chromes
  };
  const LAUNCH_TRACKED = async () => {
    const before = new Set(chromeSnapshot());
    const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
      args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
        '--disable-software-rasterizer', '--autoplay-policy=no-user-gesture-required', '--mute-audio',
        '--hide-scrollbars', `--window-size=${W},${H}`] });
    for (const pid of chromeSnapshot()) if (!before.has(pid)) ourChromes.add(pid);
    return b;
  };
  let browser = await LAUNCH_TRACKED();
  const WAIT = parseInt(process.env.WAIT || '8000', 10);
  // un frame CON contenido (nube 4K) pesa >1MB; uno vacío (context-lost: oscuro o
  // blanco uniforme) comprime a ~100KB. El tamaño delata el frame muerto.
  // A 1080 los beats oscuros legítimos pueden caer bajo 180KB → override por env.
  const MINBYTES = parseInt(process.env.MINBYTES || '', 10) ||
    Math.max(180000, Math.floor(W * H / 22));
  // un evaluate puede colgarse PARA SIEMPRE si el GPU se congela (rAF nunca dispara).
  // race contra timeout → lanza → se trata como context-lost → reinicia browser.
  const withT = (p, ms, lbl) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${lbl}`)), ms))]);

  let i = 0;
  while (i < N && ready(i)) i++;                          // resume (solo frames VÁLIDOS)
  console.log(`render ${SLUG} (${ID}) · ${W}×${H} @ ${FPS}fps · ${N} frames · audio:${HAS_AUDIO ? 'sí' : 'no'} · MINBYTES ${MINBYTES} · empieza en ${i}`);

  let batchRetries = 0;
  // killChrome — mata SOLO el chrome de ESTE render (su árbol de procesos).
  //
  // ⚠️ NUNCA volver a `pkill -9 -x chrome`: iangpu la comparten 2-3 AGENTES y ese
  // pkill es GLOBAL — mataba el Chrome de los otros agentes en pleno render (y los
  // suyos mataban el nuestro). ESA era la causa real de los "frame VACÍO
  // (context-lost)": no era la GPU, ni TDR, ni VRAM (medido: 987 MiB de 12282
  // usados, 0 errores en probe aislado). Cazado con telemetría 2026-07-15.
  const killChrome = () => {
    for (const pid of ourChromes) { try { process.kill(pid, 'SIGKILL'); } catch { /* ya murió */ } }
    ourChromes.clear();
  };
  // tope de pared por lote: red final si CUALQUIER op (launch/newContext/goto/nebula/render)
  // se cuelga sin disparar su propio timeout → corta, mata chrome y reintenta.
  const BATCH_WALL = 120000 + BATCH * 4000;
  while (i < N) {
    let gpuDead = false;
    try {
      await withT((async () => {
        // BROWSER FRESCA POR LOTE: en 4K pesado el chrome se "wedgea" a nivel de proceso
        // entre lotes. Cerrar (con timeout) y FORZAR kill de chrome trabado antes de relanzar.
        try { await withT(browser.close(), 8000, 'close'); } catch { /* colgado */ }
        killChrome();
        browser = await withT(LAUNCH_TRACKED(), 60000, 'launch');
        const ctx = await withT(browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }), 60000, 'newctx');
        const page = await withT(ctx.newPage(), 30000, 'newpage');
        await withT(page.goto(`http://localhost:${PORT}/clase.html?id=${ID}`, { waitUntil: 'load', timeout: 60000 }), 70000, 'goto');
        await page.waitForTimeout(WAIT);                    // GLBs + woff2
        // ESPERA la señal real de que el .bin de la nebulosa está cargado y en GPU
        await withT(page.waitForFunction(() => window.__nebulaReady === true, { timeout: 60000 }), 70000, 'nebula');
        const btn = await page.$('[data-cine-play]');
        if (btn) { await btn.click(); await page.waitForTimeout(1000); }
        await page.evaluate(() => { const a = document.querySelector('audio'); if (a) a.pause(); });
        await page.waitForTimeout(800);

        const batchStart = i;
        const stop = Math.min(i + BATCH, N);
        const t0 = Date.now();
        for (; i < stop; i++) {
          if (ready(i)) continue;
          const t = i / FPS;
          await withT(page.evaluate((tt) => { window.__cineT = tt; }, t), 12000, 'setT');
          await withT(page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))), 20000, 'rAF');
          await page.screenshot({ path: fname(i), type: 'jpeg', quality: 92, timeout: 30000 });
          // un frame VACÍO (context-lost: oscuro/blanco uniforme) comprime por debajo de
          // MINBYTES → bórralo y aborta el lote (relanza browser fresca).
          if (fs.statSync(fname(i)).size < MINBYTES) {
            fs.rmSync(fname(i), { force: true });
            throw new Error(`frame ${i} VACÍO (context-lost)`);
          }
        }
        const dt = (Date.now() - t0) / 1000;
        console.log(`  ${SLUG}/${FMT} lote hasta ${i}/${N} · ${(dt / Math.max(1, i - batchStart)).toFixed(2)} s/frame · RSS ${(process.memoryUsage().rss / 1e9).toFixed(2)}G`);
        batchRetries = 0;
      })(), BATCH_WALL, 'lote');
    } catch (e) {
      console.error(`  ⚠ ${SLUG}/${FMT} lote falló en frame ${i}: ${e.message.slice(0, 160)}`);
      gpuDead = true;
    } finally {
      killChrome();   // pase lo que pase, no dejar chrome trabado para el siguiente lote
    }
    if (gpuDead) {
      await new Promise(r => setTimeout(r, 1200));
      // un frame que NO se deja renderizar (OOM/wedge en 4K sobre un beat pesado)
      // bloquearía toda la clase. Tras varios intentos con browser fresca, duplica el
      // frame previo (1/FPS s, imperceptible) y sigue. Si es el frame 0, aborta.
      if (++batchRetries > 8) {
        if (i > 0 && ready(i - 1)) {
          fs.copyFileSync(fname(i - 1), fname(i));
          console.error(`  ⤷ frame ${i} irrecuperable tras ${batchRetries} intentos — duplico ${i - 1} y sigo`);
          batchRetries = 0;
        } else {
          throw new Error(`demasiados reinicios en frame ${i}`);
        }
      }
    }
  }
  killChrome();
  killSrv();

  console.log(`encode NVENC ${SLUG}/${FMT}…`);
  encode('hevc_nvenc', 'yuv420p10le', MASTER);
  encode('h264_nvenc', 'yuv420p', DELIVERY);
  console.log(`✓ master   ${MASTER}`);
  console.log(`✓ entrega  ${DELIVERY}`);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
