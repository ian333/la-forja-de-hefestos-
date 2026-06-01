#!/usr/bin/env node
/*
 * render-cinematic.cjs — pipeline de render OFFLINE de cine para iangpu.
 * ---------------------------------------------------------------------------
 * Convierte una escena R3F determinista en un MASTER horizontal 4K (2.39:1
 * util) con calidad IMAX, y deriva un recorte VERTICAL 9:16 de la columna
 * central segura. Todo el peso (supersampling + motion blur por subframes)
 * vive AQUI, en el render offline — la escena realtime queda ligera.
 *
 * DONDE CORRE
 *   Este script corre en iangpu (Tailscale 100.65.173.85), el UNICO nodo con
 *   GPU real para R3F headless: RTX 4070 Ti. Usa PLAYWRIGHT + el chrome del
 *   sistema (/usr/bin/google-chrome-stable), igual que video-atoms-*.cjs, que
 *   son los scripts que YA renderizan ahi. La laptop WSL no sirve (sin GPU).
 *
 * ANTES DE RENDERIZAR (lo hace el OPERADOR, no este script):
 *   iangpu tiene su PROPIO filesystem. Hay que sincronizar el source EDITADO y
 *   reconstruir el dist en iangpu ANTES de cada render, si no el video sale con
 *   codigo viejo. Flujo tipico:
 *       rsync -az --delete --exclude node_modules --exclude dist --exclude .git \
 *             /home/ian/Orkesta/la-forja/ ian@100.65.173.85:/home/ian/la-forja/
 *       ssh ian@100.65.173.85 'cd ~/la-forja && npm run build && \
 *             npx vite preview --port 4173 &'
 *   Apuntar --url al PREVIEW (vite preview), NO al dev server con HMR (HMR
 *   inyecta no-determinismo y rompe la reproducibilidad frame a frame).
 *
 * QUE HACE
 *   1) MASTER 4K (3840x2160) con SUPERSAMPLING: renderiza a 'super'x via
 *      deviceScaleFactor y baja con lanczos en ffmpeg -> antialias de cine.
 *   2) MOTION BLUR REAL por acumulacion de subframes: por cada frame de salida
 *      renderiza N subframes con t avanzado fraccionalmente y los PROMEDIA
 *      (media verdadera via ffmpeg tmix, NO alpha-blend). Esto da el peso.
 *   3) Recorte VERTICAL 9:16 (2160x3840) del master, centrado en la columna
 *      central segura (el sujeto clave vive ahi por diseno de escena).
 *   4) Ensamble a mp4 ligero (h264 por defecto, h265 opcional), yuv420p.
 *
 * DETERMINISMO
 *   La escena DEBE exponer window.__cinematic*.renderAt(t) como funcion pura de
 *   t. Este script avanza t en pasos exactos -> frames 100% reproducibles.
 *   Subframes simetricos alrededor del instante del frame: frac = (s+0.5)/N.
 *
 * USO
 *   node scripts/render-cinematic.cjs \
 *     --url http://localhost:4173/cinematic-bh.html \
 *     --out bh --duration 12 --fps 24 --subframes 8 --hook __cinematicBH
 *
 *   Genera:  bh_master.mp4   (3840x2160, 2.39:1 letterboxed dentro del 16:9)
 *            bh_vertical.mp4 (2160x3840, recorte 9:16 de la columna central)
 *
 * FLAGS  (ver parseArgs). Notables:
 *   --url [req] --out [cinematic] --duration [12] --fps [24] --subframes [8]
 *   --shutter [0.7] --super [2] --width [3840] --height [2160]
 *   --codec h264|h265 [h264] --crf [17] --hook [__cinematic]
 *   --no-vertical --keep-frames --ready-timeout [120000]
 *   --chrome [/usr/bin/google-chrome-stable]
 */

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs() {
  const a = process.argv.slice(2);
  const o = {
    url: null,
    out: 'cinematic',
    duration: 12,
    fps: 24,
    subframes: 8,
    shutter: 0.7,
    super: 2,
    width: 3840,
    height: 2160,
    codec: 'h264',
    crf: 17,
    hook: '__cinematic',
    vertical: true,
    keepFrames: false,
    readyTimeout: 120000,
    chrome: '/usr/bin/google-chrome-stable',
  };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--url') o.url = a[++i];
    else if (k === '--out') o.out = a[++i];
    else if (k === '--duration') o.duration = parseFloat(a[++i]);
    else if (k === '--fps') o.fps = parseInt(a[++i], 10);
    else if (k === '--subframes') o.subframes = Math.max(1, parseInt(a[++i], 10));
    else if (k === '--shutter') o.shutter = Math.min(1, Math.max(0, parseFloat(a[++i])));
    else if (k === '--super') o.super = Math.max(1, parseInt(a[++i], 10));
    else if (k === '--width') o.width = parseInt(a[++i], 10);
    else if (k === '--height') o.height = parseInt(a[++i], 10);
    else if (k === '--codec') o.codec = a[++i];
    else if (k === '--crf') o.crf = parseInt(a[++i], 10);
    else if (k === '--hook') o.hook = a[++i];
    else if (k === '--no-vertical') o.vertical = false;
    else if (k === '--keep-frames') o.keepFrames = true;
    else if (k === '--ready-timeout') o.readyTimeout = parseInt(a[++i], 10);
    else if (k === '--chrome') o.chrome = a[++i];
    else { console.error('[render] flag desconocido:', k); process.exit(1); }
  }
  if (!o.url) { console.error('[render] falta --url'); process.exit(1); }
  return o;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function ff(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

// Encoder libx264/libx265 "ligero de reproducir": yuv420p universal, crf
// razonable, preset slow (offline = sin prisa).
function encoderArgs(opts) {
  if (opts.codec === 'h265') {
    return `-c:v libx265 -preset slow -crf ${opts.crf} -pix_fmt yuv420p -tag:v hvc1`;
  }
  return `-c:v libx264 -preset slow -crf ${opts.crf} -pix_fmt yuv420p`;
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();
  const outPrefix = path.resolve(opts.out);

  const renderW = opts.width;
  const renderH = opts.height;

  // El screenshot sale a renderW*super x renderH*super (deviceScaleFactor).
  // ffmpeg promedia los subframes a esa resolucion alta y recien al final hace
  // el downscale lanczos -> antialias real.
  const ssW = renderW * opts.super;
  const ssH = renderH * opts.super;

  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cine-'));
  const subDir = path.join(frameDir, 'sub');   // subframes crudos (supersampled)
  const accDir = path.join(frameDir, 'acc');   // frames ya promediados (motion blur)
  fs.mkdirSync(subDir, { recursive: true });
  fs.mkdirSync(accDir, { recursive: true });
  console.log('[render] tmp ->', frameDir);
  console.log(`[render] master ${renderW}x${renderH} | supersample x${opts.super} (${ssW}x${ssH}) | ${opts.subframes} subframes | shutter ${opts.shutter}`);

  // Playwright + chrome del sistema con GPU real (mismos flags que
  // video-atoms-vertical.cjs, que ya renderiza en iangpu).
  // Set PROBADO en iangpu (lo usa video-atoms-vertical.cjs). Da WebGL2 via
  // ANGLE/Mesa. OJO: --use-gl=egl da NONE aqui; NO ponerlo. La RTX por D3D12 hoy
  // tampoco engancha -> corre en llvmpipe (CPU): para video pesado conviene
  // resolver acceso a GPU o bajar el costo del raymarch.
  const gpuArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--headless=new',
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--enable-gpu-rasterization',
    '--enable-webgl',
    '--disable-software-rasterizer',
    '--disable-background-timer-throttling',
    '--hide-scrollbars',
    `--window-size=${renderW},${renderH}`,
  ];
  // headless:false + flag --headless=new es el truco que usa video-atoms-*.cjs
  // para que Chrome use la GPU REAL en Linux (headless:true cae a software).
  const browser = await chromium.launch({ headless: false, executablePath: opts.chrome, args: gpuArgs });
  const page = await (await browser.newContext({
    viewport: { width: renderW, height: renderH },
    deviceScaleFactor: opts.super,   // supersampling
    bypassCSP: true,
  })).newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(
    (hook) => window[hook] && window[hook].ready === true,
    opts.hook,
    { timeout: opts.readyTimeout },
  );
  // Validar que el hook expone renderAt() callable (si no, fallamos claro y no
  // colgados con un error cripico de playwright a mitad del loop).
  const hookOk = await page.evaluate(
    (hook) => typeof window[hook]?.renderAt === 'function',
    opts.hook,
  );
  if (!hookOk) { console.error(`[render] window.${opts.hook}.renderAt no es funcion`); await browser.close(); process.exit(1); }

  const totalFrames = Math.ceil(opts.duration * opts.fps);
  const frameDt = 1 / opts.fps;
  // El obturador abre 'shutter' fraccion del intervalo de frame; los subframes
  // se reparten DENTRO de esa ventana, centrada en el instante del frame.
  const shutterDt = frameDt * opts.shutter;

  // settle: 2 rAF tras renderAt para que el GPU termine de dibujar (mismo patron
  // que video-atoms-vertical.cjs).
  const settle = () => page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );

  for (let f = 0; f < totalFrames; f++) {
    const tCenter = f / opts.fps;

    // --- 1) N subframes deterministicos dentro de la ventana de obturador.
    for (let s = 0; s < opts.subframes; s++) {
      // Offset PURO y SIMETRICO: frac=(s+0.5)/N centra las muestras en
      // [0.5/N, (N-0.5)/N] -> offsets simetricos alrededor de tCenter. Con
      // subframes=1 -> frac=0.5 -> tSub=tCenter exacto (sin blur).
      const frac = (s + 0.5) / opts.subframes;
      const tSub = tCenter + (frac - 0.5) * shutterDt;
      await page.evaluate(({ tt, hook }) => window[hook].renderAt(tt), { tt: tSub, hook: opts.hook });
      await settle();
      const subFile = path.join(subDir, `sub_${String(s).padStart(3, '0')}.png`);
      await page.screenshot({ path: subFile, type: 'png', animations: 'disabled', timeout: 0 });
    }

    // --- 2) PROMEDIAR los subframes -> media verdadera (motion blur de cine).
    // tmix promedia 'frames' consecutivos; tomamos solo el resultado del grupo
    // completo (select). Media aritmetica por canal, NO alpha-blend.
    const accFile = path.join(accDir, `frame_${String(f).padStart(5, '0')}.png`);
    if (opts.subframes === 1) {
      fs.copyFileSync(path.join(subDir, 'sub_000.png'), accFile);
    } else {
      ff(
        `ffmpeg -y -framerate 1 -i "${subDir}/sub_%03d.png" ` +
        `-vf "tmix=frames=${opts.subframes}:weights='${Array(opts.subframes).fill(1).join(' ')}',select='eq(n\\,${opts.subframes - 1})'" ` +
        `-frames:v 1 -update 1 "${accFile}" -loglevel error`,
      );
    }

    if (f % 12 === 0 || f === totalFrames - 1) {
      console.log(`[render] frame ${f + 1}/${totalFrames}`);
    }
  }

  await browser.close();

  // ---------------------------------------------------------------------------
  // 3) MASTER: downscale lanczos de supersampled -> 4K real, codec ligero.
  //    Encuadre util 2.39:1: se recorta y se letterboxea dentro del 16:9 (negros
  //    profundos arriba y abajo) para el formato de cine sin perder el plano.
  // ---------------------------------------------------------------------------
  const masterH239 = Math.round(renderW / 2.39 / 2) * 2;      // alto util 2.39:1 (par)
  const masterPath = `${outPrefix}_master.mp4`;
  console.log('[render] ensamblando master 4K (2.39:1)...');
  ff(
    `ffmpeg -y -framerate ${opts.fps} -i "${accDir}/frame_%05d.png" ` +
    `-vf "scale=${renderW}:${renderH}:flags=lanczos,` +
    `crop=${renderW}:${masterH239}:0:(ih-${masterH239})/2,` +
    `pad=${renderW}:${renderH}:0:(${renderH}-${masterH239})/2:color=black" ` +
    `${encoderArgs(opts)} -movflags +faststart "${masterPath}" -loglevel error`,
  );
  console.log('[render] master ->', masterPath);

  // ---------------------------------------------------------------------------
  // 4) VERTICAL 9:16: recorte de la COLUMNA CENTRAL segura, desde el supersampled.
  // ---------------------------------------------------------------------------
  if (opts.vertical) {
    const vCropW = Math.round((ssH * 9) / 16 / 2) * 2;
    const vertPath = `${outPrefix}_vertical.mp4`;
    console.log('[render] derivando vertical 9:16 (columna central)...');
    ff(
      `ffmpeg -y -framerate ${opts.fps} -i "${accDir}/frame_%05d.png" ` +
      `-vf "crop=${vCropW}:${ssH}:(iw-${vCropW})/2:0,scale=2160:3840:flags=lanczos" ` +
      `${encoderArgs(opts)} -movflags +faststart "${vertPath}" -loglevel error`,
    );
    console.log('[render] vertical ->', vertPath);
  }

  if (!opts.keepFrames) {
    fs.rmSync(frameDir, { recursive: true, force: true });
  } else {
    console.log('[render] frames conservados en', frameDir);
  }
  console.log('[render] listo.');
}

main().catch((e) => { console.error(e); process.exit(1); });
