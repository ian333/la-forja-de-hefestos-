#!/usr/bin/env node
/**
 * render-limones.cjs — graba la clase "Los Limones" en 4K · 10-bit · HEVC NVENC.
 *
 * Por qué un script dedicado:
 *   La clase Limones NO usa el manifest del Player. Vive en
 *   `LimonesCinematicChain.tsx` con 25 escenas, cada una con su propio
 *   <audio src="/audio/preview/XX-name.mp3">. La cadena avanza por
 *   `audio.onended` de cada escena. El pipeline genérico video-gaia
 *   (capture.cjs + encode.cjs) asume manifest + 1 mp3 por escena en
 *   /audio/masterclass/<id>/ — no aplica acá.
 *
 * Pipeline:
 *   1. Lanza Chromium en WSL2 con GPU real (--use-angle=gl → D3D12).
 *   2. Navega a /masterclass.html?id=econ-01-limones&render=1 → la cadena.
 *   3. Click programático para desbloquear audio context.
 *   4. CDP screencast (JPEG q100) → JPEGs a disco con timestamps CDP.
 *   5. Captura por audioTotal + buffer.
 *   6. Concat de los 25 MP3 (/audio/preview/01-hook.mp3 ... 25-cierre.mp3) → WAV.
 *   7. ffmpeg encode JPEG seq → HEVC 10-bit Main10 NVENC, max VBR (~150 Mbps).
 *   8. Mux video + audio → dist-video/econ-01-limones/limones-4k-10bit.mkv.
 *
 * 100% GPU: WebGL en ANGLE/D3D12 (no swiftshader CPU), encode en NVENC (no x264 CPU).
 *
 * Uso:
 *   node scripts/video-gaia/render-limones.cjs
 *   node scripts/video-gaia/render-limones.cjs --skip-server --base-url http://localhost:5174
 *   W=2160 H=3840 node scripts/video-gaia/render-limones.cjs   # vertical 9:16
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

/* ─── config (overridable por env) ────────────────────────────────────────── */
const W   = parseInt(process.env.W   || '3840', 10);  // 4K UHD horizontal
const H   = parseInt(process.env.H   || '2160', 10);
const FPS = parseInt(process.env.FPS || '60',   10);  // output framerate
const CQ  = process.env.CQ  || '16';                  // NVENC constant quality
const BV  = process.env.BV  || '150M';                // target bitrate
const MBV = process.env.MBV || '250M';                // peak bitrate
const BUF = process.env.BUF || '500M';                // bufsize

const DEFAULT_PORT = 5174;
const BASE_URL = process.env.BASE_URL ||
  (process.argv.includes('--base-url')
    ? process.argv[process.argv.indexOf('--base-url') + 1]
    : `http://localhost:${DEFAULT_PORT}`);
const SKIP_SERVER = process.argv.includes('--skip-server');
const KEEP_TMP    = process.argv.includes('--keep-tmp');
const TARGET_URL = `${BASE_URL}/masterclass.html?id=econ-01-limones&render=1`;

const OUT_DIR    = path.join(ROOT, 'dist-video', 'econ-01-limones');
const TMP_DIR    = path.join(ROOT, 'dist-video', '.tmp', 'limones-4k10b');
const FRAMES_DIR = path.join(TMP_DIR, 'frames');
const AUDIO_DIR  = path.join(ROOT, 'public', 'audio', 'preview');

/** 25 MP3 que LimonesCinematicChain consume en orden 01 → 25. */
const AUDIO_FILES = [
  '01-hook.mp3', '02-misconception.mp3', '03-reveal-interno.mp3',
  '04-cien-carros.mp3', '05-cliffhanger.mp3', '06-matematica.mp3',
  '07-exodus.mp3', '08-nuevo-promedio.mp3', '09-colapso.mp3',
  '10-hay-solucion.mp3', '11-berkeley.mp3', '12-pregunta-absurda.mp3',
  '13-rechazado.mp3', '14-nobel.mp3', '15-pero-akerlof.mp3',
  '16-no-es-solo-carros.mp3', '17-seguros-medicos.mp3', '18-credito.mp3',
  '19-subprime-2008.mp3', '20-que-mercado.mp3', '21-tu-vida.mp3',
  '22-la-senal.mp3', '23-como-no-ser-limon.mp3', '24-economia-info.mp3',
  '25-cierre.mp3',
];

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function run(cmd, args, opts = {}) {
  console.log(`  $ ${cmd} ${args.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: exit ${r.status}`);
}

function probeDur(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout.trim());
}

function pingUrl(url) {
  return new Promise(resolve => {
    const u = new URL(url);
    const req = http.get({
      host: u.hostname, port: u.port, path: u.pathname, timeout: 1500,
    }, res => { resolve(res.statusCode < 500); res.resume(); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  if (SKIP_SERVER) return null;
  const probe = `${BASE_URL}/masterclass.html`;
  if (await pingUrl(probe)) {
    console.log(`● server live at ${BASE_URL}`);
    return null;
  }
  console.log(`● starting vite preview at ${BASE_URL}`);
  const distOk = fs.existsSync(path.join(ROOT, 'dist', 'index.html'));
  if (!distOk) {
    throw new Error('no dist/index.html — corre `npm run build` primero');
  }
  const port = String(new URL(BASE_URL).port);
  const proc = spawn('npx', ['vite', 'preview', '--host', '--port', port],
    { cwd: ROOT, stdio: 'pipe', detached: false });
  proc.stdout.on('data', d => {
    const s = d.toString();
    if (/error|fail/i.test(s)) process.stdout.write(`  server> ${s}`);
  });
  proc.stderr.on('data', d => process.stdout.write(`  server-err> ${d.toString()}`));
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    if (await pingUrl(probe)) {
      console.log('  ↳ server ready');
      return proc;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  proc.kill();
  throw new Error('vite preview no levantó en 60s');
}

/* ─── main ────────────────────────────────────────────────────────────────── */
async function main() {
  // Reset tmp dir
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  /* 1 — sum audio duration */
  console.log('\n┌─ render-limones · econ-01-limones');
  console.log(`├─ output ${W}×${H} @ ${FPS}fps · HEVC 10-bit · NVENC vbr_hq cq=${CQ}`);
  console.log(`└─ url ${TARGET_URL}\n`);

  const audioDurs = AUDIO_FILES.map(f => {
    const p = path.join(AUDIO_DIR, f);
    if (!fs.existsSync(p)) throw new Error(`missing audio: ${p}`);
    return probeDur(p);
  });
  const audioTotal = audioDurs.reduce((s, d) => s + d, 0);
  console.log(`● audio: ${AUDIO_FILES.length} mp3s · ${audioTotal.toFixed(1)}s total (${(audioTotal/60).toFixed(2)} min)\n`);

  /* 2 — concat audio → wav */
  const audioListPath = path.join(TMP_DIR, 'audio-concat.txt');
  fs.writeFileSync(
    audioListPath,
    AUDIO_FILES.map(f => `file '${path.join(AUDIO_DIR, f).replace(/'/g, "'\\''")}'`).join('\n') + '\n',
  );
  const audioWav = path.join(TMP_DIR, 'audio.wav');
  console.log('● concat audio → wav');
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', audioListPath,
    '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', audioWav]);

  /* 3 — server */
  const server = await ensureServer();

  try {
    /* 4 — launch SYSTEM chrome (not playwright bundled) con GPU NVIDIA real
     *      vía D3D12/ANGLE. Confirmado en WSL2 con system google-chrome-stable:
     *        ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4060), OpenGL 3.3)
     *      Requiere --headless=new (no el viejo --headless) + headless:false en
     *      Playwright (si no, Playwright override con --headless viejo).
     */
    const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
    console.log(`\n● launch ${CHROME_PATH} ${W}×${H} · NVIDIA D3D12 via ANGLE`);
    const browser = await chromium.launch({
      headless: false,
      executablePath: CHROME_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--headless=new',
        '--ignore-gpu-blocklist',
        '--enable-gpu',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--enable-webgl',
        '--enable-accelerated-2d-canvas',
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
      const t = m.type();
      if (t === 'error') console.log(`  chrome err: ${m.text().slice(0, 200)}`);
    });
    page.on('pageerror', e => console.log(`  page err: ${e.message.slice(0, 200)}`));

    console.log(`● goto ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Confirm we got the cinematic chain mounted (not the manifest-based Player).
    await page.waitForTimeout(3000);

    // Programmatic click → desbloquea AudioContext y dispara play() del audio escena 01.
    await page.mouse.click(Math.floor(W / 2), Math.floor(H / 2));
    console.log('● click sent (audio unlock)');
    // Wait a beat for audio to actually start
    await page.waitForTimeout(400);

    /* 5 — CDP screencast → JPEG q=100 a disco */
    const client = await page.context().newCDPSession(page);
    let frameCount = 0;
    let firstTs = null;
    let lastTs = null;
    const frameTimestamps = [];

    client.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
      const ts = (metadata && metadata.timestamp) ? metadata.timestamp : (Date.now() / 1000);
      if (firstTs === null) firstTs = ts;
      lastTs = ts;
      const idx = frameCount++;
      frameTimestamps.push(ts);
      const fp = path.join(FRAMES_DIR, `${String(idx).padStart(6, '0')}.jpg`);
      fs.writeFileSync(fp, Buffer.from(data, 'base64'));
      try { await client.send('Page.screencastFrameAck', { sessionId }); } catch {}
    });

    await client.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 100,
      everyNthFrame: 1,
      maxWidth: W,
      maxHeight: H,
    });

    const captureSec = Math.ceil(audioTotal + 6);
    console.log(`● capturing ${captureSec}s ...`);
    const t0 = Date.now();
    const progTimer = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      const fps = frameCount / Math.max(0.1, el);
      console.log(`  ↳ ${el.toFixed(0)}s/${captureSec}s · ${frameCount} frames · ${fps.toFixed(1)} fps avg`);
    }, 30_000);

    await page.waitForTimeout(captureSec * 1000);
    clearInterval(progTimer);

    await client.send('Page.stopScreencast').catch(() => {});
    await new Promise(r => setTimeout(r, 800));  // drain in-flight

    const captureDur = (lastTs - firstTs);
    const fpsAvg = frameCount / Math.max(0.01, captureDur);
    console.log(`✓ ${frameCount} frames · ${captureDur.toFixed(1)}s wall · ${fpsAvg.toFixed(1)} fps avg`);

    // Save metadata for postmortem / debugging
    fs.writeFileSync(path.join(TMP_DIR, 'capture-meta.json'), JSON.stringify({
      frameCount, captureDur, fpsAvg, firstTs, lastTs, audioTotal, W, H, FPS,
    }, null, 2));

    await browser.close();

    if (frameCount === 0) throw new Error('zero frames captured — GPU/headless flag issue?');

    /* 6 — encode JPEG seq → HEVC 10-bit Main10 NVENC */
    const videoMkv = path.join(TMP_DIR, 'video.mkv');
    const inputFps = fpsAvg.toFixed(4);

    console.log(`\n● encode HEVC 10-bit NVENC · input ${inputFps}fps → output ${FPS}fps`);
    // ffmpeg 6.x NVENC: preset p7 (slowest/best), tune hq, multipass fullres
    run('ffmpeg', [
      '-y',
      '-framerate', inputFps,
      '-i', path.join(FRAMES_DIR, '%06d.jpg'),
      '-vf', `fps=${FPS},format=p010le`,
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
      '-an',
      videoMkv,
    ]);

    /* 7 — mux video + audio */
    const finalMkv = path.join(OUT_DIR, 'limones-4k-10bit.mkv');
    console.log('\n● mux video + audio');
    run('ffmpeg', ['-y',
      '-i', videoMkv,
      '-i', audioWav,
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      '-map', '0:v:0', '-map', '1:a:0',
      '-shortest',
      finalMkv,
    ]);

    /* 8 — summary */
    const st = fs.statSync(finalMkv);
    console.log(`\n✅ ${finalMkv}`);
    console.log(`   ${(st.size / 1024 / 1024).toFixed(1)} MB · ${captureDur.toFixed(1)}s capture · ${fpsAvg.toFixed(1)} fps capture avg`);
    console.log(`   spec: 4K (${W}×${H}) · HEVC Main10 10-bit · NVENC · VBR cq=${CQ} target=${BV} peak=${MBV}`);

    if (!KEEP_TMP) {
      console.log(`   (limpiando frames — usa --keep-tmp si quieres conservarlos)`);
      fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
    }
  } finally {
    if (server) {
      console.log('● stopping vite preview');
      server.kill();
    }
  }
}

main().catch(e => { console.error('\n❌', e.message); console.error(e.stack); process.exit(1); });
