#!/usr/bin/env node
/*
 * render-bh-comercial.cjs — EL COMERCIAL DE CINE de Gargantua, por BEATS, con
 * GRADE REAL "DaVinci" en 10-bit. Vertical 9:16, 4K (2160x3840).
 * ============================================================================
 * "EL FOTÓN QUE CAE" — tú ERES un fotón cayendo hacia Gargantua.
 *
 * Este script NO reinventa nada: COMPONE tres piezas que YA existen.
 *   · La ESCENA   : src/cinematic/CinematicBHReel.tsx — expone
 *                   window.__cinematicBHReel { ready, duration, beats[], chain,
 *                   renderAt(t) }. Determinista: mismo t → mismo frame. La escena
 *                   ya hace el ÚNICO tonemap ACES (BHRaytraced linearOutput=true
 *                   + CinematicPostFX). Aquí NO se vuelve a tonemapear.
 *   · El SONIDO   : scripts/bh-sound-design.py — síntesis determinista (SEED fija)
 *                   con el silencio HORNEADO en samples ~0 y HEADROOM (~-6 dBFS).
 *                   Por beat (--beat B1..B4) o cadena (--chain commercial).
 *   · El OUTRO    : assets/gaia-prime-outro-vertical-4k.mp4 (marca GAIA Prime).
 *
 * Roba de:
 *   · render-cinematic.cjs   → supersample (deviceScaleFactor) + MOTION BLUR por
 *                              subframes (media verdadera; aquí vía el filtro `mix`
 *                              sobre N stills aislados — ver renderBeatBase), crop
 *                              9:16, flags GPU de Playwright/Chrome.
 *   · video-atoms-vertical.cjs → receta GAIA Prime: outro re-encode a los mismos
 *                              params, concat, reverb de catedral + nivelación.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LO QUE ESTE SCRIPT AÑADE (lo que "faltaba" — la SEGUNDA ETAPA ffmpeg offline)
 * ════════════════════════════════════════════════════════════════════════════
 * El master de render-cinematic salía "computado": PNG 8-bit + h264 8-bit, SIN
 * grade. Aquí, DESPUÉS del único ACES de la escena (entrada tratada como Rec.709
 * display-referred, CERO doble tonemap), se aplica el grade pesado de DaVinci:
 *   (1) scale lanczos del supersampled  (antialias real)
 *   (2) LUT .cube opcional (lut3d tetrahedral; slot para Kodak-2383 look Nolan)
 *   (3) SPLIT-TONE: sombras teal / altas ámbar (curves + colorbalance) — paleta
 *       Interstellar (frío = aislamiento del void, cálido = el disco/conexión)
 *   (4) HALACIÓN ROJA-ÁMBAR REAL: split → aislar altas → ATENUAR G/B (sangrado
 *       al rojo, NO un bloom blanco) → gblur sigma escalado a 4K → blend SCREEN.
 *       El sangrado al rojo ES el punto entero.
 *   (5) GRANO de cine DETERMINISTA: noise con all_seed FIJO (derivado de fecha,
 *       JAMÁS random → rompería el cache), atado a luma, strength bajo (textura).
 *   (6) GATE-WEAVE sub-pixel determinista: micro-traslación < 1px + micro-rotación
 *       vía senos de baja frecuencia con seed de beat = "capturado, no computado".
 *   (7) 10-BIT + ANTI-BANDING: salida yuv420p10le con DITHER obligatorio (el PNG
 *       fuente es 8-bit ya cuantizado; el supersample x2 + lanczos genera bits
 *       sub-pixel que el dither convierte en gradiente liso void→disco). libx265
 *       Main10 por defecto; prores_ks 422 HQ documentado como alternativa.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CACHE POR BEAT — la biblioteca de beats, NO un video monolítico
 * ════════════════════════════════════════════════════════════════════════════
 * El comercial es una CADENA curada de beats; cada beat es CACHEABLE por su HASH.
 * Dos etapas, ambas con su propio cache key:
 *
 *   ETAPA A (render base lineal-display) — la más cara (raymarch; en iangpu hoy
 *     puede caer a llvmpipe/CPU). Por beat: renderiza sus frames del rango t
 *     [start,end) leído de window.__cinematicBHReel.beats, con supersample +
 *     subframes, y ENCODE a un mp4 lossless intermedio (ffv1). Hash A =
 *     sha1(id + start + end + fps + subframes + super + W + H + shutter +
 *          MTIME(CinematicBHReel.tsx,BHRaytraced.tsx,CinematicPostFX.tsx,
 *                CinematicCamera.tsx,ScaleReference.tsx) + URL).
 *     Si <cache>/A_<id>_<hashA>.mkv existe → CACHE HIT (no se re-renderiza).
 *
 *   ETAPA B (grade DaVinci 10-bit) — barata, IDÉNTICA entre beats (consistencia
 *     de look garantizada en toda la cadena). Por beat toma el mp4 de A y aplica
 *     el grade. Hash B = sha1(hashA + GRADE_VERSION + lut + gradeParams). Si
 *     <cache>/B_<id>_<hashB>.mkv existe → CACHE HIT.
 *
 * DETERMINISMO TOTAL habilita esto: toda cámara/animación/audio es función pura
 * de t; el slow-down de B3 vive en el mapeo t→pose (NO en el avance de t del
 * render). El grano y el gate-weave usan seed FIJO. Mismo input → mismo byte →
 * cache hit. Cambiar el .cube o un gradeParam invalida solo la ETAPA B (re-grade
 * barato); cambiar la escena invalida A (re-render caro) — granularidad correcta.
 *
 * El ENSAMBLE final = concat de los beats B-graded de la cadena → mezcla audio de
 * bh-sound-design.py (gate de silencio respetado: ver mezcla más abajo) → concat
 * outro GAIA escalado a 2160x3840 → entrega. Salida: master 10-bit + entrega.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DÓNDE CORRE — iangpu (Tailscale 100.65.173.85, RTX 4070 Ti vía WSL D3D12)
 * ════════════════════════════════════════════════════════════════════════════
 * El ÚNICO nodo R3F-headless con GPU real. Receta RTX (env + flags), si tu Chrome
 * engancha la 4070 Ti por D3D12/ANGLE en vez de caer a llvmpipe/CPU:
 *
 *   GALLIUM_DRIVER=d3d12 \
 *   MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *   node scripts/render-bh-comercial.cjs \
 *     --url http://localhost:4173/cinematic-bh-reel.html \
 *     --out dist-video/bh-comercial \
 *     --fps 24 --subframes 8 --chain commercial
 *
 * El flag de Chrome --use-angle=gl se pasa por defecto (ver gpuArgs); headless:false
 * + --headless=new es el truco que usa video-atoms-vertical.cjs para enganchar la
 * GPU real en Linux (headless:true cae a software). Si la GPU no engancha, B1/B4
 * (fuera del campo fuerte: 8·rs y dolly-back) abaratan el raymarch; B2/B3 (POV en
 * campo fuerte) son los caros pero se CACHEAN una vez.
 *
 * ANTES de renderizar (lo hace el OPERADOR): iangpu tiene su PROPIO filesystem.
 * Sincroniza el source EDITADO y reconstruye el dist ANTES de cada render, y crea
 * el HTML de entrada cinematic-bh-reel.html + su input en vite.config.ts (ver
 * cabecera de src/cinematic/cinematic-bh-reel-main.tsx). Apunta --url al PREVIEW
 * (vite preview), NUNCA al dev server con HMR (HMR rompe la reproducibilidad).
 *     rsync -az --delete --exclude node_modules --exclude dist --exclude .git \
 *           /home/ian/Orkesta/la-forja/ ian@100.65.173.85:/home/ian/la-forja/
 *     ssh ian@100.65.173.85 'cd ~/la-forja && npm run build && \
 *           npx vite preview --port 4173 &'
 *
 * ════════════════════════════════════════════════════════════════════════════
 * FLAGS (ver parseArgs). Notables:
 *   --url [req]            URL del preview (cinematic-bh-reel.html)
 *   --out [dist-video/bh-comercial]   prefijo de salida
 *   --chain [commercial]   cadena de beats (de la escena) + chain de audio
 *   --fps [24]  --subframes [8]  --shutter [0.7]  --super [2]
 *   --width [2160] --height [3840]    vertical 4K (¡no horizontal!)
 *   --codec h265|prores [h265]        10-bit; prores = master/archivo
 *   --crf [16]            (libx265 Main10)
 *   --lut [<vacío>]       ruta a .cube (look Kodak-2383). Sin LUT = solo split-tone.
 *   --hook [__cinematicBHReel]
 *   --cache-dir [dist-video/.cache/bh-comercial]
 *   --no-grade            salta la ETAPA B (debug del render base)
 *   --no-audio            sin pista de audio
 *   --no-outro            sin outro GAIA (toggle)
 *   --outro-path [assets/gaia-prime-outro-vertical-4k.mp4]  ruta al mp4 del outro
 *                         (distinta del toggle --no-outro; se valida que exista)
 *   --force               ignora el cache (re-render + re-grade)
 *   --keep-frames         conserva los PNG crudos
 *   --ready-timeout [120000]
 *   --chrome [/usr/bin/google-chrome-stable]
 *   --captions            quema el caption de cada beat (drawtext, banda segura)
 */

'use strict';

const { chromium } = require('playwright');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Bump esto cuando cambie la receta del grade (invalida SOLO la etapa B → re-grade
// barato, sin re-render). El render base (etapa A) tiene su propio hash.
const GRADE_VERSION = 'davinci-v2-negros';

// Seed FIJO derivado de la fecha del beat (brief). JAMÁS random() — rompería el
// cache. Se usa para el grano de cine y el gate-weave.
const SEED = 20260531;

// CORTE AL SILENCIO (t exacto, segundos). COMERCIAL v1 = cadena B1 + cola B4:
// el corte cae al FINAL de B1 (15s). DEBE coincidir con SILENCE_CUT_S de
// bh-sound-design.py. El reverb se corta en seco aquí; después solo señal cruda
// (silencio absoluto + re-crescendo sobre el outro GAIA).
const SILENCE_CUT_S = 20.0;

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs() {
  const a = process.argv.slice(2);
  const o = {
    url: null,
    out: path.join('dist-video', 'bh-comercial'),
    chain: 'commercial',
    fps: 24,
    subframes: 8,
    shutter: 0.7,
    super: 2,
    width: 2160,    // VERTICAL 4K (9:16). El crop usa la columna central segura.
    height: 3840,
    codec: 'h265',  // 10-bit; 'prores' para master/archivo
    crf: 16,
    lut: null,
    hook: '__cinematicBHReel',
    cacheDir: path.join('dist-video', '.cache', 'bh-comercial'),
    grade: true,
    audio: true,
    outro: true,
    force: false,
    keepFrames: false,
    captions: false,
    readyTimeout: 120000,
    chrome: '/usr/bin/google-chrome-stable',
    outroPath: path.join(ROOT, 'assets', 'gaia-prime-outro-vertical-4k.mp4'),
    // MODO WORKER: si se pasa, este proceso renderiza SOLO ese beat (Chrome propio,
    // GPU fresca) a su .mkv y SALE. El orquestador lo invoca por beat vía spawn →
    // cada beat tiene Chrome limpio enganchado a la RTX (sin herencia de SwiftShader).
    workerBeat: null,   // id del beat a renderizar en modo worker
    workerOut: null,    // ruta del .mkv de salida del worker
  };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--url') o.url = a[++i];
    else if (k === '--out') o.out = a[++i];
    else if (k === '--chain') o.chain = a[++i];
    else if (k === '--fps') o.fps = parseInt(a[++i], 10);
    else if (k === '--subframes') o.subframes = Math.max(1, parseInt(a[++i], 10));
    else if (k === '--shutter') o.shutter = Math.min(1, Math.max(0, parseFloat(a[++i])));
    else if (k === '--super') o.super = Math.max(1, parseInt(a[++i], 10));
    else if (k === '--width') o.width = parseInt(a[++i], 10);
    else if (k === '--height') o.height = parseInt(a[++i], 10);
    else if (k === '--codec') o.codec = a[++i];
    else if (k === '--crf') o.crf = parseInt(a[++i], 10);
    else if (k === '--lut') o.lut = a[++i];
    else if (k === '--hook') o.hook = a[++i];
    else if (k === '--cache-dir') o.cacheDir = a[++i];
    else if (k === '--no-grade') o.grade = false;
    else if (k === '--no-audio') o.audio = false;
    else if (k === '--no-outro') o.outro = false;
    else if (k === '--force') o.force = true;
    else if (k === '--keep-frames') o.keepFrames = true;
    else if (k === '--captions') o.captions = true;
    else if (k === '--ready-timeout') o.readyTimeout = parseInt(a[++i], 10);
    else if (k === '--chrome') o.chrome = a[++i];
    else if (k === '--worker-beat') o.workerBeat = a[++i];
    else if (k === '--worker-out') o.workerOut = a[++i];
    // --outro-path = RUTA al mp4 del outro (distinta del toggle --no-outro). Antes
    // se llamaba --outro y se confundía con el toggle. Validamos que exista.
    else if (k === '--outro-path') {
      o.outroPath = a[++i];
      if (o.outroPath === undefined) { console.error('[comercial] --outro-path requiere una ruta'); process.exit(1); }
    }
    else { console.error('[comercial] flag desconocido:', k); process.exit(1); }
  }
  if (!o.url) { console.error('[comercial] falta --url (apunta al preview de cinematic-bh-reel.html)'); process.exit(1); }
  // Si se pidió outro y se pasó una ruta explícita, debe existir (falla claro, no
  // a mitad del ensamble). --no-outro la salta por completo.
  if (o.outro && o.outroPath && !fs.existsSync(o.outroPath)) {
    console.error(`[comercial] --outro-path no existe: ${o.outroPath}`); process.exit(1);
  }
  if (o.codec !== 'h265' && o.codec !== 'prores') {
    console.error('[comercial] --codec debe ser h265 o prores (ambos 10-bit)'); process.exit(1);
  }
  return o;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function ff(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}
function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}
function sha1(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
}
// Hash del CONTENIDO de un archivo (sha1). Antes esto usaba `mtimeMs | 0`, que
// trunca a int32 → wraparound (~cada 24.8 días el valor da la vuelta) y el cache
// servía un beat STALE con código nuevo. El contenido es la fuente de verdad: si
// el archivo no cambia byte a byte, el render base no cambia → cache hit legítimo.
function contentHashOf(p) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 12); }
  catch { return 'absent'; }
}
function ffprobeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { stdio: 'pipe' });
  return parseFloat(r.stdout?.toString().trim() || '0') || 0;
}

// Archivos de la escena cuyo MTIME entra al hash A: si cambia cualquiera, el
// render base se invalida (es lo que afecta los píxeles del beat).
const SCENE_DEPS = [
  'src/cinematic/CinematicBHReel.tsx',
  'src/labs/components/BHRaytraced.tsx',
  'src/cinematic/CinematicPostFX.tsx',
  'src/cinematic/CinematicCamera.tsx',
  'src/cinematic/ScaleReference.tsx',
].map((p) => path.join(ROOT, p));

// Hash de la ETAPA A (render base) de un beat: identidad + params de render +
// MTIME del código de la escena + URL. Mismo hash → mismos píxeles → cache hit.
function hashA(beat, opts) {
  // Hash del CONTENIDO de cada dep de escena (no mtime): un byte distinto en el
  // shader/cámara invalida el render base; un touch sin cambios NO lo invalida.
  const sceneHashes = SCENE_DEPS.map(contentHashOf).join(',');
  return sha1([
    beat.id, beat.start, beat.end,
    opts.fps, opts.subframes, opts.super, opts.width, opts.height, opts.shutter,
    opts.url, sceneHashes,
  ].join('|'));
}

// Hash de la ETAPA B (grade): depende del A + la receta del grade (versión, LUT,
// codec). El grade es idéntico entre beats → look consistente; su hash solo
// cambia si tocas la receta o el .cube (re-grade barato, sin re-render).
function hashB(hA, opts, frameOffset) {
  // El .cube entra por CONTENIDO (mismo motivo que SCENE_DEPS): cambiar el LUT
  // re-gradúa, retocar su mtime no. frameOffset entra al hash porque el grano y el
  // gate-weave dependen del frame GLOBAL del beat → dos beats con misma base pero
  // distinta posición en la cadena gradúan distinto (textura continua).
  return sha1([
    hA, GRADE_VERSION, opts.lut ? `${opts.lut}:${contentHashOf(opts.lut)}` : 'no-lut',
    opts.codec, opts.crf, opts.captions ? 'cap' : 'nocap', `fo:${Math.round(frameOffset) || 0}`,
  ].join('|'));
}

// ---------------------------------------------------------------------------
// Encoders
// ---------------------------------------------------------------------------
// Intermedio LOSSLESS de la ETAPA A (cache): ffv1 en .mkv. Sin pérdida → el grade
// posterior parte de la fuente exacta; rgb para no cuantizar antes del 10-bit.
function encoderIntermediate() {
  return '-c:v ffv1 -level 3 -pix_fmt gbrp -g 1';
}

// Encoder FINAL 10-bit. libx265 Main10 (entrega) o ProRes 422 HQ (master/archivo).
// El DITHER + accurate_rnd va en el filtergraph (format=yuv420p10le tras el grade),
// no aquí, para que el RGB→YUV de 10-bit lleve dithering anti-banding.
function encoderFinal(opts) {
  if (opts.codec === 'prores') {
    // ProRes 422 HQ: master/archivo. NO acepta 4:2:0 → yuv422p10le.
    return '-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -qscale:v 9 -vendor apl0';
  }
  // HEVC Main10 (entrega 10-bit). hdr-opt=0 (SDR Rec.709). hvc1 para QuickTime/IG.
  return `-c:v libx265 -preset slow -crf ${opts.crf} -pix_fmt yuv420p10le ` +
    `-x265-params hdr-opt=0:repeat-headers=1 -tag:v hvc1`;
}

// ===========================================================================
// GRADE "DaVinci" 10-bit — el filtergraph de la SEGUNDA ETAPA ffmpeg.
// ---------------------------------------------------------------------------
// Entrada: el mp4/mkv del render base (Rec.709 display-referred, ya ACES-eado por
// la escena). CERO doble tonemap. Orden del brief:
//   scale lanczos → [LUT] → split-tone → halación roja-ámbar → grano → gate-weave
//   → format 10-bit + dither.
// Devuelve el string del -filter_complex (sin el -i; el caller arma el comando).
// W,H = resolución FINAL (2160x3840). El supersample ya se promedió en la etapa A.
// ===========================================================================
function buildGradeFilter(opts, frameOffset = 0) {
  const W = opts.width, H = opts.height;
  // sigma de la halación escala con resolución: a 2160w, ~18 px = tamaño del halo.
  const haloSigma = Math.round((W / 2160) * 11);

  // frameOffset = frame GLOBAL donde arranca este beat en la cadena (= round(start*fps)).
  // Cada beat se gradúa en un PROCESO ffmpeg independiente cuyo contador de frame
  // (la variable `n` del filtergraph) arranca en 0 → sin offset, el grano y el
  // gate-weave reinician su textura/fase en CADA corte y se ve el "salto de gate".
  // Sumando frameOffset volvemos la textura CONTINUA a través de los cortes,
  // manteniendo el determinismo (el offset deriva del t del beat, no del reloj).
  const fo = Math.round(frameOffset) || 0;

  // gate-weave: micro-traslación < 1px + micro-rotación < 0.05° vía senos de baja
  // frecuencia (funciones puras de t = N/FR). seeds derivados del SEED fijo →
  // determinista, cacheable. "capturado, no computado".
  const sx = ((SEED % 97) / 97) * 6.283;   // fase x
  const sy = ((SEED % 89) / 89) * 6.283;    // fase y
  const sr = ((SEED % 71) / 71) * 6.283;    // fase rot

  const parts = [];

  // (1) scale lanczos a la resolución final (el supersampled se promedió en A).
  //     Es no-op si el intermedio ya está a WxH, pero lo dejamos explícito.
  parts.push(`[0:v]scale=${W}:${H}:flags=lanczos,format=gbrp[base0]`);

  // (2) LUT .cube opcional (tetrahedral evita shifts de hue en el degradado).
  //     La fuente post-ACES ya es ~Rec.709; un .cube 2383 que tome Rec.709 de
  //     entrada = un solo lut3d. Sin --lut: pasa directo.
  if (opts.lut) {
    parts.push(`[base0]lut3d=file='${opts.lut.replace(/'/g, "\\'")}':interp=tetrahedral[base1]`);
  } else {
    parts.push(`[base0]null[base1]`);
  }

  // (3) GRADE: NEGROS NEGROS + altas cálidas (v2). En 16:9 (mucho más void que el
  //     9:16) el crush a 0.04 dejaba VIVO el tenue polvo nebular azulado, y la
  //     halación roja lo bañaba → MORADO en el void (medido: BASE negro, GRADED
  //     morado; el morado lo metía el GRADE, no la escena). Fix v2 (validado en still):
  //     · colorbalance: sombras NEUTRAS (rs/gs/bs=0), solo ALTAS cálidas (ámbar).
  //     · curves: crush del punto negro a 0.14 → el polvo tenue cae a negro PURO
  //       (las estrellas brillantes sobreviven); S-curve suave en mids/altas.
  //     · eq saturation 0.88 (baja el residual de color del void).
  //     · halación CONTENIDA (sigma×11 no ×18, opacity 0.16 no 0.28, highs aislados
  //       0.78) → el glo cálido ABRAZA el disco en vez de teñir todo el cuadro.
  parts.push(
    `[base1]` +
    `colorbalance=rs=0.00:gs=0.00:bs=0.00:rm=0.00:gm=0.00:bm=0.00:rh=0.10:gh=0.04:bh=-0.08,` +
    `curves=master='0/0 0.14/0 0.34/0.18 0.5/0.5 0.75/0.80 1/1',` +
    `eq=saturation=0.88:contrast=1.12:gamma=0.97` +
    `[graded]`
  );

  // (4) HALACIÓN ROJA-ÁMBAR REAL (etapa propia, NO un bloom blanco):
  //     split → en la rama del halo: aislar ALTAS (curves que aplasta sombras a 0)
  //     + ATENUAR G y B (el blanco sangra al ROJO-ámbar) → gblur sigma~18@2160w →
  //     blend SCREEN al 0.28 (aditivo suave en altas). Sin atenuar G/B = halo
  //     blanco genérico CGI; el sangrado al rojo ES el punto entero.
  parts.push(`[graded]split=2[gbase][ghi]`);
  parts.push(
    `[ghi]` +
    // aislar altas: todo lo medio/bajo a 0, solo el tope sobrevive
    `curves=master='0/0 0.78/0 0.9/0.5 1/1',` +
    // sangrado al ámbar: R intacto, G y B aplastados (curva por canal)
    `curves=green='0/0 1/0.42':blue='0/0 1/0.18',` +
    `gblur=sigma=${haloSigma}:steps=3,` +
    `format=gbrp[glow]`
  );
  parts.push(`[gbase][glow]blend=all_mode=screen:all_opacity=0.16[halated]`);

  // (5) GRANO de cine DETERMINISTA: all_seed derivado del SEED fijo + frameOffset
  //     del beat (JAMÁS random). Atado a luma (allf=t+u temporal + uniforme),
  //     strength bajo = textura, no nieve. El offset por frame global evita que la
  //     textura "gate" se REINICIE visiblemente en cada corte (cada beat se gradúa
  //     en su propio proceso ffmpeg con n=0): seeds distintos por beat → la textura
  //     no se repite idéntica de un corte al siguiente. Sigue siendo determinista.
  parts.push(
    `[halated]noise=alls=10:allf=t+u:all_seed=${SEED + fo}[grained]`
  );

  // (6) GATE-WEAVE sub-pixel determinista: micro-traslación < 1px + micro-rotación
  //     < 0.05° (0.00087 rad) vía senos lentos. funciones puras de t = (n+fo)/FR.
  //
  //     FIX (cuñas negras): antes el overfill era un `pad=...:black` (inset 2px) y
  //     el rotate + la traslación de hasta ~1.1px sacaban el crop FUERA del
  //     contenido → mordía la cuña NEGRA del relleno en las esquinas. Subir el pad
  //     a +8 NO basta: el crop sigue alcanzando el borde negro al traslada(r). Ahora
  //     el overfill son PÍXELES REALES: un scale lanczos de +8px (inset 4px) genera
  //     el borde por INTERPOLACIÓN (no negro). Equivale a "rotar antes del scale a
  //     mayor resolución" del brief. Verificado: a ±(0.9 traslación + ~0.2 rot)px en
  //     ambos extremos del seno, las 4 esquinas quedan en contenido real (sin negro).
  //
  // (n+fo) = frame GLOBAL en la cadena → los senos lentos del weave NO reinician
  // su fase en cada corte (continuidad de "gate" a través de los beats).
  const rotExpr = `0.00087*sin(2*PI*0.13*(n+${fo})/${opts.fps}+${sr.toFixed(4)})`;
  const dxExpr = `0.9*sin(2*PI*0.11*(n+${fo})/${opts.fps}+${sx.toFixed(4)})`;
  const dyExpr = `0.9*sin(2*PI*0.09*(n+${fo})/${opts.fps}+${sy.toFixed(4)})`;
  parts.push(
    `[grained]` +
    `scale=iw+8:ih+8:flags=lanczos,` +
    `rotate='${rotExpr}':ow=iw:oh=ih:fillcolor=none,` +
    `crop=${W}:${H}:'4+${dxExpr}':'4+${dyExpr}'` +
    `[weaved]`
  );

  // (7) 10-BIT + ANTI-BANDING: format al pix_fmt de salida CON dither. El PNG
  //     fuente es 8-bit ya cuantizado; el supersample+lanczos generó bits
  //     sub-pixel que el dither convierte en gradiente liso void→disco. SIN
  //     dither el 10-bit NO arregla el banding. accurate_rnd+full_chroma en swscale.
  const outFmt = opts.codec === 'prores' ? 'yuv422p10le' : 'yuv420p10le';
  parts.push(`[weaved]format=${outFmt}[out]`);

  return { filter: parts.join(';'), outLabel: '[out]' };
}

// drawtext del caption del beat dentro de la banda segura centrada (>=250px arriba
// / >=340px abajo a escala 1080 → x2 a 4K). Devuelve un filtro extra encadenable.
function captionFilter(text, opts) {
  if (!text) return null;
  const safeBottom = Math.round((opts.height / 3840) * 680); // ~340px@1080 *2
  const esc = String(text).replace(/'/g, "’").replace(/:/g, '\\:').replace(/,/g, '\\,');
  const fontsize = Math.round((opts.width / 2160) * 64);
  return (
    `drawtext=fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf':` +
    `text='${esc}':fontcolor=white@0.92:fontsize=${fontsize}:` +
    `x=(w-text_w)/2:y=h-${safeBottom}:` +
    `box=1:boxcolor=black@0.0:line_spacing=10:shadowx=2:shadowy=2:shadowcolor=black@0.6`
  );
}

// ---------------------------------------------------------------------------
// ETAPA A — render base de UN beat (con cache).
// Renderiza solo los frames del rango t [start,end) del beat, con supersample +
// motion blur por subframes, y los encodea a un .mkv lossless intermedio.
// ---------------------------------------------------------------------------
async function renderBeatBase(page, beat, opts, cachePath, frameRoot) {
  if (!opts.force && fs.existsSync(cachePath)) {
    console.log(`[A] CACHE HIT  ${beat.id} → ${path.basename(cachePath)}`);
    return cachePath;
  }
  console.log(`[A] render base  ${beat.id}  t∈[${beat.start.toFixed(2)},${beat.end.toFixed(2)})`);

  const renderW = opts.width, renderH = opts.height;
  const subDir = path.join(frameRoot, `sub-${beat.id}`);
  const accDir = path.join(frameRoot, `acc-${beat.id}`);
  fs.rmSync(subDir, { recursive: true, force: true });
  fs.rmSync(accDir, { recursive: true, force: true });
  fs.mkdirSync(subDir, { recursive: true });
  fs.mkdirSync(accDir, { recursive: true });

  const frameDt = 1 / opts.fps;
  const shutterDt = frameDt * opts.shutter;
  // frames del beat: desde start hasta end (exclusivo) en pasos de 1/fps.
  const beatLen = Math.max(0, beat.end - beat.start);
  const totalFrames = Math.max(1, Math.round(beatLen * opts.fps));

  const settle = () => page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );

  // 4K GPU PURA (probado empíricamente 2026-06-01): a super=1 (2160×3840 nativo,
  // 8.3MP) page.screenshot SOSTIENE 80+ frames en un proceso/contexto fresco SIN
  // colgarse (RSS sube y BAJA, no fuga monotónica; ~1.2s/frame estable). El cuelgue
  // anterior era el reciclaje cada-40 (frágil) + timeout:0. Ahora: NADA de reciclaje
  // intra-beat; el aislamiento es POR BEAT (main abre contexto fresco por beat).
  for (let f = 0; f < totalFrames; f++) {
    const tCenter = beat.start + f / opts.fps;
    // N subframes simétricos dentro de la ventana de obturador (motion blur real).
    for (let s = 0; s < opts.subframes; s++) {
      const frac = (s + 0.5) / opts.subframes;
      const tSub = tCenter + (frac - 0.5) * shutterDt;
      await page.evaluate(({ tt, hook }) => window[hook].renderAt(tt), { tt: tSub, hook: opts.hook });
      await settle();
      const subFile = path.join(subDir, `sub_${String(s).padStart(3, '0')}.png`);
      // HONESTIDAD 10-bit: page.screenshot type:png entrega 8 bit/canal. El
      // pipeline NO captura 10-bit NATIVO. La profundidad efectiva >8-bit en el
      // degradado void→disco se RECONSTRUYE así: supersample (deviceScaleFactor) +
      // promedio de N subframes (este loop) + downscale lanczos + dither en el
      // RGB→YUV de 10-bit (etapa B). El contenedor yuv420p10le es 10-bit REAL y
      // evita banding del re-encode, pero la FUENTE de captura es 8-bit promediado,
      // no 10-bit por píxel. NO afirmar "10-bit nativo de captura".
      // TODO(10-bit nativo): para 10-bit REAL desde el render, leer el framebuffer
      // con gl.readPixels en half-float (RGBA16F) o exportar EXR por subframe y
      // promediar en lineal antes del tonemap; reemplazaría este screenshot PNG.
      // No bloquea el pipeline: el camino actual ya da un degradado liso.
      // timeout FINITO (30s): si el contexto se degrada, FALLA rápido y se reintenta
      // el beat en proceso fresco — NUNCA cuelgue infinito (la causa del pegado a 4K).
      await page.screenshot({ path: subFile, type: 'png', animations: 'disabled', timeout: 30000 });
    }
    // PROMEDIAR los subframes → media verdadera (motion blur de cine), NO alpha.
    //
    // FIX (motion blur): antes esto usaba `tmix=frames=N,select='eq(n,N-1)'`. tmix
    // es una MEDIA DESLIZANTE temporal: para el frame i emite el promedio de
    // [i-N+1 .. i]. Sobre un grupo AISLADO de N stills, el frame N-1 es el único
    // con su ventana llena, pero los frames 0..N-2 entran al pipeline arrastrando
    // ventanas PARCIALES y el select dependía de un conteo frágil — no es el
    // promedio limpio del grupo. La forma correcta de promediar N imágenes
    // AISLADAS es el filtro espacial `mix`: toma N inputs y emite UN frame =
    // Σ wᵢ·inputᵢ / Σ wᵢ. Con pesos todos 1 → media aritmética exacta por canal,
    // determinista. Alimentamos los N PNG como N inputs separados.
    const accFile = path.join(accDir, `frame_${String(f).padStart(5, '0')}.png`);
    if (opts.subframes === 1) {
      fs.copyFileSync(path.join(subDir, 'sub_000.png'), accFile);
    } else {
      const N = opts.subframes;
      const inputs = [];
      for (let s = 0; s < N; s++) {
        inputs.push(`-i "${path.join(subDir, `sub_${String(s).padStart(3, '0')}.png`)}"`);
      }
      // [0][1]...[N-1]mix=inputs=N:weights='1 1 ... 1'  → media verdadera.
      // El filtro `mix` normaliza por Σ pesos (scale por defecto = 1/Σw) → con
      // pesos unitarios sale exactamente la media aritmética de los N subframes.
      const labels = Array.from({ length: N }, (_, s) => `[${s}:v]`).join('');
      const weights = Array(N).fill(1).join(' ');
      ff(
        `ffmpeg -y ${inputs.join(' ')} ` +
        `-filter_complex "${labels}mix=inputs=${N}:weights='${weights}'" ` +
        `-frames:v 1 -update 1 "${accFile}" -loglevel error`,
      );
    }
    if (f % 12 === 0 || f === totalFrames - 1) {
      console.log(`[A] ${beat.id} frame ${f + 1}/${totalFrames}`);
    }
  }

  // Downscale lanczos del supersampled (renderW*super → renderW) y encode lossless.
  // El crop 9:16 NO hace falta: ya renderizamos vertical (2160x3840). El supersample
  // estaba en deviceScaleFactor → el screenshot salió a renderW*super, el scale baja.
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  ff(
    `ffmpeg -y -framerate ${opts.fps} -i "${accDir}/frame_%05d.png" ` +
    `-vf "scale=${renderW}:${renderH}:flags=lanczos" ` +
    `${encoderIntermediate()} "${cachePath}" -loglevel error`,
  );
  if (!opts.keepFrames) {
    fs.rmSync(subDir, { recursive: true, force: true });
    fs.rmSync(accDir, { recursive: true, force: true });
  }
  console.log(`[A] base listo  ${beat.id} → ${path.basename(cachePath)}`);
  return cachePath;
}

// ---------------------------------------------------------------------------
// ETAPA B — grade DaVinci 10-bit de UN beat (con cache). Idéntico entre beats.
// ---------------------------------------------------------------------------
function gradeBeat(baseMkv, beat, opts, cachePath, frameOffset) {
  if (!opts.grade) {
    console.log(`[B] grade OFF  ${beat.id} → uso base sin gradear`);
    return baseMkv;
  }
  if (!opts.force && fs.existsSync(cachePath)) {
    console.log(`[B] CACHE HIT  ${beat.id} → ${path.basename(cachePath)}`);
    return cachePath;
  }
  console.log(`[B] grade DaVinci 10-bit  ${beat.id}`);

  // frameOffset (= round(start*fps)) hace continuos el grano y el gate-weave a
  // través de los cortes (ver buildGradeFilter).
  const { filter, outLabel } = buildGradeFilter(opts, frameOffset);
  // Caption opcional QUEMADO en ffmpeg (NO drei <Text> en Canvas con
  // EffectComposer — regla dura). Se inserta en el filtergraph JUSTO antes del
  // format final, sobre [weaved] (8/16-bit-friendly para drawtext), dentro de la
  // banda segura centrada. El label de salida no cambia.
  let fullFilter = filter;
  const finalLabel = outLabel;
  if (opts.captions) {
    const cap = captionFilter(beat.caption, opts);
    if (cap) {
      fullFilter = filter.replace('[weaved]format=', `[weaved]${cap},format=`);
    }
  }

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  ff(
    `ffmpeg -y -i "${baseMkv}" ` +
    `-filter_complex "${fullFilter}" -map "${finalLabel}" ` +
    `-sws_flags accurate_rnd+full_chroma_int+full_chroma_inp ` +
    `-color_primaries bt709 -color_trc bt709 -colorspace bt709 ` +
    `${encoderFinal(opts)} -an "${cachePath}" -loglevel error`,
  );
  console.log(`[B] graded listo  ${beat.id} → ${path.basename(cachePath)}`);
  return cachePath;
}

// ---------------------------------------------------------------------------
// AUDIO — sintetiza la pista determinista con bh-sound-design.py y la mezcla.
// El silencio ya viene HORNEADO en samples ~0 + headroom. La mezcla (ver
// audioFilter()) respeta el silencio: NO loudnorm sobre el track (ni linear=true
// lo garantiza lineal → ganancia ESTÁTICA), y el reverb corre SOLO sobre [0,30)
// y se corta en seco en el match-cut (su cola NO se derrama al silencio).
// ---------------------------------------------------------------------------
// outroTail = duración REAL del outro tras la cadena (medida con ffprobe en el
// caller), para que el re-crescendo de órgano grave entre EXACTO bajo el logo.
// El audio cubre cadena+outro y se PADEA a la duración exacta del video (sin
// -shortest sobre el audio) → la marca GAIA queda completa con el órgano encima.
function makeAudio(opts, outroTail, tmpDir) {
  if (!opts.audio) return null;
  const wav = path.join(tmpDir, 'bh-sound.wav');
  const py = path.join(ROOT, 'scripts', 'bh-sound-design.py');
  const r = spawnSync('python3', [py, wav, '--chain', opts.chain, '--outro-tail', String(Math.max(0, outroTail).toFixed(2))],
    { stdio: 'pipe' });
  if (r.status !== 0) {
    console.warn(`[audio] bh-sound-design.py falló: ${r.stderr?.toString().slice(-300)} → sin audio`);
    return null;
  }
  console.log(`[audio] WAV determinista listo (silencio horneado + headroom · outro-tail ${outroTail.toFixed(2)}s)`);
  return wav;
}

// ---------------------------------------------------------------------------
// OUTRO GAIA — re-encode al MISMO perfil 10-bit y resolución que los beats graded
// (de la receta de marca, video-atoms-vertical.cjs). Debe terminar con idéntico
// codec/pix_fmt para que el concat -c copy de los beats sea homogéneo.
// ---------------------------------------------------------------------------
function ensureOutro(opts, tmpDir) {
  if (!opts.outro || !fs.existsSync(opts.outroPath)) {
    if (opts.outro) console.warn(`[outro] no encontrado: ${opts.outroPath} → sin outro`);
    return null;
  }
  const W = opts.width, H = opts.height;
  const outFmt = opts.codec === 'prores' ? 'yuv422p10le' : 'yuv420p10le';
  const out = path.join(tmpDir, `outro-matched.${opts.codec === 'prores' ? 'mov' : 'mkv'}`);
  // UN solo -vf: escala manteniendo aspecto + pad a 9:16 + fps de la cadena +
  // format al pix_fmt 10-bit de salida (con dither de swscale → sin banding).
  ff(
    `ffmpeg -y -i "${opts.outroPath}" ` +
    `-vf "scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${opts.fps},format=${outFmt}" ` +
    `-sws_flags accurate_rnd+full_chroma_int+full_chroma_inp ` +
    `-color_primaries bt709 -color_trc bt709 -colorspace bt709 ` +
    `${encoderFinal(opts)} -an "${out}" -loglevel error`,
  );
  console.log('[outro] GAIA re-encodeado al perfil 10-bit del comercial');
  return out;
}

// ---------------------------------------------------------------------------
// MEZCLA DE AUDIO — filtergraph que respeta el silencio del docking.
// ---------------------------------------------------------------------------
// Dos reglas duras del brief:
//   (9) El reverb (aecho, catedral de la marca) NO debe correr sobre el silencio:
//       su cola decayente llenaría el tramo mudo del zoom-out. Separamos con
//       asplit + atrim en SILENCE_CUT_S (t=30): reverb SOLO en [0,30), y el tramo
//       [30,fin) (silencio + crescendo final) va CRUDO (sin reverb). La cola del
//       reverb muere EN SECO en el match-cut → el silencio cae a ~-inf dB real.
//   (11) NADA de loudnorm (ni con linear=true se garantiza lineal; puede reportar
//       'Dynamic' y levantar el silencio). El WAV ya trae el arco + headroom
//       (-6 dBFS pico): una GANANCIA ESTÁTICA volume=NdB preserva el silencio
//       (0·g = 0) y la dinámica.
// targetDur = duración exacta del video → apad + atrim igualan el audio al video
// (sin -shortest sobre el audio) para que la marca GAIA quede COMPLETA (issue 5).
// Devuelve { filter, outLabel } para -filter_complex; el audio es la entrada idx aIdx.
function audioFilter(aIdx, targetDur) {
  const GAIN_DB = 8;       // ganancia estática (el WAV trae headroom ~-6 dBFS)
  const reverb =
    'aecho=0.8:0.9:83|137|211|307:0.45|0.36|0.28|0.2,' +
    'aecho=0.85:0.9:431|617:0.16|0.1';
  const lp = 'lowpass=f=4200';
  const hp = 'highpass=f=24';
  const td = targetDur.toFixed(3);
  const f =
    `[${aIdx}:a]asplit=2[apre][apost];` +
    // [0,30): señal con reverb. OJO: aecho AÑADE cola → alarga el tramo más allá de
    // 30 s; por eso re-recortamos a SILENCE_CUT_S DESPUÉS del reverb (atrim final).
    // Así la cola del reverb muere EN SECO en el match-cut y NO se derrama al
    // silencio. asetpts deja [arev] arrancando en t=0 con largo exacto = 30 s.
    `[apre]atrim=end=${SILENCE_CUT_S},asetpts=PTS-STARTPTS,${hp},${reverb},${lp},` +
    `atrim=end=${SILENCE_CUT_S},asetpts=PTS-STARTPTS[arev];` +
    // [30,fin): silencio + crescendo final, CRUDO (sin reverb que llene el silencio).
    `[apost]atrim=start=${SILENCE_CUT_S},asetpts=PTS-STARTPTS,${hp},${lp}[adry];` +
    // concat secuencial → [arev] (exacto 30 s) seguido de [adry]; el silencio queda
    // en su sitio. Ganancia estática + pad/trim a la duración EXACTA del video.
    `[arev][adry]concat=n=2:v=0:a=1[acat];` +
    `[acat]volume=${GAIN_DB}dB,apad,atrim=end=${td},asetpts=PTS-STARTPTS[aout]`;
  return { filter: f, outLabel: '[aout]' };
}

// ---------------------------------------------------------------------------
// ENSAMBLE — concat beats graded → (+outro) → mezcla audio → entrega + master.
// ---------------------------------------------------------------------------
function assemble(gradedBeats, opts, tmpDir) {
  const outPrefix = path.resolve(opts.out);
  fs.mkdirSync(path.dirname(outPrefix), { recursive: true });

  // 1) concat de los beats graded (mismo perfil → -c copy).
  const chainList = path.join(tmpDir, 'chain.txt');
  fs.writeFileSync(chainList, gradedBeats.map((f) => `file '${path.resolve(f)}'`).join('\n') + '\n');
  const chainMkv = path.join(tmpDir, 'chain.mkv');
  ff(`ffmpeg -y -f concat -safe 0 -i "${chainList}" -c copy "${chainMkv}" -loglevel error`);

  // 2) + outro GAIA (escalado al perfil del comercial). Concat -c copy.
  let videoOnly = chainMkv;
  let outroDur = 0;
  const outro = ensureOutro(opts, tmpDir);
  if (outro) {
    outroDur = ffprobeDuration(outro);
    const withOutroList = path.join(tmpDir, 'with-outro.txt');
    fs.writeFileSync(withOutroList,
      `file '${path.resolve(chainMkv)}'\nfile '${path.resolve(outro)}'\n`);
    const withOutro = path.join(tmpDir, 'with-outro.mkv');
    ff(`ffmpeg -y -f concat -safe 0 -i "${withOutroList}" -c copy "${withOutro}" -loglevel error`);
    videoOnly = withOutro;
  }

  const totalDur = ffprobeDuration(videoOnly);
  console.log(`[ensamble] video (cadena ${(totalDur - outroDur).toFixed(2)}s + outro ${outroDur.toFixed(2)}s) = ${totalDur.toFixed(2)}s`);

  // 3) MASTER 10-bit (video + audio, sin re-encode de video → -c:v copy). El
  //    outro-tail = duración real del outro → el re-crescendo entra bajo el logo.
  const masterPath = `${outPrefix}_master.${opts.codec === 'prores' ? 'mov' : 'mp4'}`;
  const wav = makeAudio(opts, outroDur, tmpDir);
  if (wav) {
    // Mezcla (ver audioFilter): reverb SOLO en [0,30) cortado en seco + ganancia
    // ESTÁTICA (no loudnorm) + pad a la duración EXACTA del video. SIN -shortest
    // sobre el audio → la marca GAIA queda completa con el órgano resolviendo.
    const { filter, outLabel } = audioFilter(1, totalDur);
    ff(
      `ffmpeg -y -i "${videoOnly}" -i "${wav}" ` +
      `-filter_complex "${filter}" -map 0:v -map "${outLabel}" ` +
      `-c:v copy -c:a ${opts.codec === 'prores' ? 'pcm_s16le' : 'aac -b:a 320k'} -ar 48000 ` +
      `-movflags +faststart "${masterPath}" -loglevel error`,
    );
  } else {
    ff(`ffmpeg -y -i "${videoOnly}" -c copy -an -movflags +faststart "${masterPath}" -loglevel error`);
  }
  console.log('[ensamble] MASTER 10-bit →', masterPath);

  // 4) ENTREGA IG/TikTok: downsample 1080x1920, H.264 High 8-bit yuv420p, 24fps,
  //    ~14 Mbps, Rec.709. (Las apps muestran 8-bit; el 10-bit+dither pagó al
  //    gradar, NO como archivo subido.) Audio = MISMA mezcla que el master
  //    (reverb cortado en seco + ganancia estática + pad a totalDur, sin -shortest).
  const deliveryPath = `${outPrefix}_1080x1920.mp4`;
  if (wav) {
    const { filter: aF, outLabel: aOut } = audioFilter(1, totalDur);
    // Video y audio van JUNTOS por -filter_complex (no se puede mezclar -vf con un
    // -filter_complex de audio sobre la misma entrada). El video se escala en su
    // propia rama; el audio usa la mezcla con silencio respetado.
    const vF = `[0:v]scale=1080:1920:flags=lanczos,format=yuv420p[vout]`;
    ff(
      `ffmpeg -y -i "${videoOnly}" -i "${wav}" ` +
      `-filter_complex "${vF};${aF}" -map "[vout]" -map "${aOut}" ` +
      `-c:v libx264 -profile:v high -preset slow -crf 18 -maxrate 15M -bufsize 30M ` +
      `-pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 ` +
      `-c:a aac -b:a 256k -ar 48000 -movflags +faststart "${deliveryPath}" -loglevel error`,
    );
  } else {
    ff(
      `ffmpeg -y -i "${videoOnly}" -map 0:v -an ` +
      `-vf "scale=1080:1920:flags=lanczos,format=yuv420p" ` +
      `-c:v libx264 -profile:v high -preset slow -crf 18 -maxrate 15M -bufsize 30M ` +
      `-pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 ` +
      `-movflags +faststart "${deliveryPath}" -loglevel error`,
    );
  }
  console.log('[ensamble] ENTREGA 1080x1920 →', deliveryPath);

  return { masterPath, deliveryPath };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();
  console.log(`\n🎬 EL FOTÓN QUE CAE — comercial 9:16 ${opts.width}x${opts.height} 10-bit`);
  console.log(`   chain=${opts.chain} fps=${opts.fps} subframes=${opts.subframes} super=x${opts.super} codec=${opts.codec}${opts.lut ? ` lut=${opts.lut}` : ''}\n`);

  const cacheDir = path.resolve(opts.cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-com-'));
  const frameRoot = path.join(tmpDir, 'frames');
  fs.mkdirSync(frameRoot, { recursive: true });

  // Flags de Chrome GPU (receta iangpu RTX). El env GALLIUM_DRIVER /
  // MESA_D3D12_DEFAULT_ADAPTER_NAME lo pone el OPERADOR antes de node.
  const gpuArgs = [
    '--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
    '--ignore-gpu-blocklist', '--enable-gpu', '--enable-gpu-rasterization',
    '--enable-webgl', '--disable-software-rasterizer',
    '--use-angle=gl',
    '--disable-background-timer-throttling', '--hide-scrollbars',
    `--window-size=${opts.width},${opts.height}`,
  ];

  // openPageIn: abre Chrome→contexto→página fresca en la URL, espera ready + canvas
  // a tamaño pleno (anti-parpadeo) + settle. Verifica que ENGANCHÓ la GPU (no
  // SwiftShader); si cayó a software, lo reporta para reintentar.
  async function openPageIn(browser) {
    const ctx = await browser.newContext({
      viewport: { width: opts.width, height: opts.height },
      deviceScaleFactor: opts.super, bypassCSP: true,
    });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.error('[pageerror]', e.message));
    await pg.goto(opts.url, { waitUntil: 'networkidle', timeout: 90000 });
    await pg.waitForFunction((hook) => window[hook] && window[hook].ready === true, opts.hook, { timeout: opts.readyTimeout });
    const wantW = opts.width * opts.super, wantH = opts.height * opts.super;
    await pg.waitForFunction(({ w, h }) => { const c = document.querySelector('canvas'); return c && c.width >= w - 2 && c.height >= h - 2; }, { w: wantW, h: wantH }, { timeout: 30000 }).catch(() => {});
    await pg.evaluate(() => new Promise((r) => { let n = 0; const tk = () => (++n >= 3 ? r(null) : requestAnimationFrame(tk)); requestAnimationFrame(tk); }));
    // Verificar renderer: si NO es la RTX (cayó a SwiftShader/llvmpipe) → señalar.
    const renderer = await pg.evaluate(() => {
      try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'NULL';
        const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked';
      } catch (err) { return 'err'; }
    });
    const onGPU = /NVIDIA|RTX|D3D12/i.test(renderer) && !/SwiftShader|llvmpipe/i.test(renderer);
    return { pg, renderer, onGPU };
  }

  // ── MODO WORKER ───────────────────────────────────────────────────────────
  // Renderiza UN beat (Chrome propio = GPU fresca garantizada) a --worker-out y SALE.
  // El orquestador lo invoca por beat. Si Chrome cae a SwiftShader, sale con code 3
  // → el orquestador reintenta (Chrome nuevo suele re-enganchar la RTX).
  if (opts.workerBeat) {
    const browser = await chromium.launch({ headless: false, executablePath: opts.chrome, args: gpuArgs });
    const { pg, renderer, onGPU } = await openPageIn(browser);
    console.log(`[worker ${opts.workerBeat}] renderer=${String(renderer).slice(0, 50)} onGPU=${onGPU}`);
    if (!onGPU) { console.error(`[worker] CAYÓ A SOFTWARE (${renderer}) — abortar para reintento`); await browser.close(); process.exit(3); }
    const allBeats = await pg.evaluate((hook) => window[hook].beats, opts.hook);
    const beat = allBeats.find((b) => b.id === opts.workerBeat);
    if (!beat) { console.error(`[worker] beat ${opts.workerBeat} no existe`); await browser.close(); process.exit(2); }
    beat.caption = beat.caption || '';
    await renderBeatBase(pg, beat, opts, opts.workerOut, frameRoot);
    await browser.close();
    console.log(`[worker ${opts.workerBeat}] ✓ ${opts.workerOut}`);
    if (!opts.keepFrames) fs.rmSync(tmpDir, { recursive: true, force: true });
    return;   // worker termina aquí
  }

  // ── MODO ORQUESTADOR ──────────────────────────────────────────────────────
  // Lee los beats (Chrome efímero), y por cada beat NO cacheado lanza un WORKER en
  // PROCESO SEPARADO (Chrome propio → GPU fresca, sin herencia de SwiftShader).
  const infoBrowser = await chromium.launch({ headless: false, executablePath: opts.chrome, args: gpuArgs });
  const { pg: infoPage } = await openPageIn(infoBrowser);
  const info = await infoPage.evaluate((hook) => ({
    duration: window[hook].duration, beats: window[hook].beats,
    hasRenderAt: typeof window[hook].renderAt === 'function',
  }), opts.hook);
  await infoBrowser.close();
  if (!info.hasRenderAt) { console.error(`[comercial] window.${opts.hook}.renderAt no es función`); process.exit(1); }
  if (!info.beats || !info.beats.length) { console.error('[comercial] beats vacío'); process.exit(1); }
  console.log(`[scene] cadena = ${info.duration.toFixed(2)}s · ${info.beats.length} beats:`);
  info.beats.forEach((b) => console.log(`        ${b.id.padEnd(24)} t∈[${b.start.toFixed(2)},${b.end.toFixed(2)})  (${b.kind})`));

  const selfPath = __filename;
  // Reconstruye los args originales (menos worker-*) para pasar al subproceso.
  const baseArgs = process.argv.slice(2).filter((a, i, arr) =>
    a !== '--worker-beat' && a !== '--worker-out' && arr[i - 1] !== '--worker-beat' && arr[i - 1] !== '--worker-out');

  const gradedBeats = [];
  let frameOffset = 0;
  for (const beat of info.beats) {
    beat.caption = beat.caption || '';
    const beatFrames = Math.max(1, Math.round(Math.max(0, beat.end - beat.start) * opts.fps));
    const hA = hashA(beat, opts);
    const baseMkv = path.join(cacheDir, `A_${beat.id}_${hA}.mkv`);

    if (opts.force || !fs.existsSync(baseMkv)) {
      // Lanzar WORKER en proceso separado, con hasta 3 reintentos si cae a software.
      let ok = false;
      for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
        console.log(`[orq] beat ${beat.id} → worker (intento ${attempt}/3)`);
        const r = spawnSync('node', [selfPath, ...baseArgs, '--worker-beat', beat.id, '--worker-out', baseMkv, '--force'],
          { stdio: 'inherit', env: process.env });
        if (r.status === 0 && fs.existsSync(baseMkv)) { ok = true; }
        else if (r.status === 3) { console.warn(`[orq] beat ${beat.id} cayó a software, reintentando con Chrome nuevo…`); }
        else { console.warn(`[orq] beat ${beat.id} worker status=${r.status}; reintento`); }
      }
      if (!ok) { console.error(`[orq] beat ${beat.id} FALLÓ tras 3 intentos`); process.exit(1); }
    } else {
      console.log(`[A] CACHE HIT  ${beat.id} → ${path.basename(baseMkv)}`);
    }

    const hB = hashB(hA, opts, frameOffset);
    const gradedMkv = path.join(cacheDir, `B_${beat.id}_${hB}.${opts.codec === 'prores' ? 'mov' : 'mkv'}`);
    const out = gradeBeat(baseMkv, beat, opts, gradedMkv, frameOffset);
    gradedBeats.push(out);
    frameOffset += beatFrames;
  }

  // --- Ensamble final.
  const { masterPath, deliveryPath } = assemble(gradedBeats, opts, tmpDir);

  if (!opts.keepFrames) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } else {
    console.log('[comercial] tmp conservado en', tmpDir);
  }

  const mb = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(1);
  console.log(`\n✓ LISTO`);
  console.log(`  MASTER 10-bit : ${masterPath}  (${mb(masterPath)} MB)`);
  console.log(`  ENTREGA       : ${deliveryPath}  (${mb(deliveryPath)} MB)`);
  console.log(`  CACHE         : ${cacheDir}  (re-render solo lo que cambió)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
