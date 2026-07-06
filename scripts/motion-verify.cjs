#!/usr/bin/env node
/*
 * motion-verify.cjs — EL VERIFICADOR DE MOVIMIENTO (lo que faltaba).
 * ---------------------------------------------------------------------------
 * critic-gate.cjs mide UN still por beat → es ciego al TIEMPO. Por eso se nos
 * coló "la nube está fija": cada cuadro suelto se veía bien, pero NADA fluía.
 * Este script analiza el VIDEO YA RENDERIZADO (o una carpeta de frames) y MIDE
 * el movimiento, sin IA y sin deps (ffmpeg → RGB crudo → diferencias).
 *
 * Detecta los defectos TEMPORALES que un still nunca revela:
 *   1) CONTENIDO CONGELADO — celdas con brillo (hay materia) que NO cambian en
 *      todo el clip. Es el bug exacto del O₂: "solo se mueven los núcleos, la
 *      nube está fija". Métrica: % del área luminosa que permanece estática.
 *   2) FRAMES CONGELADOS — cuadros consecutivos casi idénticos (stutter, frame
 *      dropeado, render trabado). Corre de >=N cuadros sin cambio.
 *   3) TELETRANSPORTE — saltos de movimiento enormes (discontinuidad/teleport).
 *      Se REPORTAN (un corte seco motivado también salta — no falla solo).
 *   4) ZONA ESTÁTICA — opcional: el subtítulo/título (abajo) DEBE quedarse quieto.
 *
 * Salidas: heatmap PNG (qué se movió, sobre el contenido), verdict.json,
 * brief.md (para que un agente lo lea), sparkline ASCII en consola, exit 0/1.
 *
 * Uso:
 *   node scripts/motion-verify.cjs --video out.mp4 [--out _motion] [--fps 6]
 *     [--w 160] [--grid 6x10] [--expect-motion] [--static-bottom 0.12]
 *   node scripts/motion-verify.cjs --frames dir/ --glob '*.jpg' ...
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
function has(name) { return process.argv.indexOf(name) >= 0; }

const VIDEO = arg('--video');
const FRAMES = arg('--frames');
const GLOB = arg('--glob', '*.jpg');
const OUT = arg('--out', '_motion');
const SAMPLE_FPS = parseFloat(arg('--fps', '6'));     // cuadros/seg a analizar
const W = parseInt(arg('--w', '160'), 10);            // ancho de análisis (downscale)
const [GX, GY] = arg('--grid', '6x10').split('x').map((v) => parseInt(v, 10));
const EXPECT_MOTION = has('--expect-motion') || true; // por defecto exigimos vida (es video, no foto)
const STATIC_BOTTOM = parseFloat(arg('--static-bottom', '0'));  // fracción inferior que debe estar quieta (0 = off)
const FFMPEG = arg('--ffmpeg', 'ffmpeg');

// Umbrales (calibrables). Escala de luminancia 0..255.
const TH = {
  lumFloor: 10,          // celda con lum media > esto = "tiene contenido"
  cellMotionFloor: 0.6,  // motion media/cuadro de la celda > esto = "se mueve"
  maxFrozenContent: 0.55,// si >55% del área luminosa NO se mueve → CONTENIDO CONGELADO
  minAliveFrac: 0.04,    // si <4% del cuadro se mueve (global) → escena MUERTA
  freezeFloor: 0.25,     // motion global/cuadro < esto = cuadro "congelado"
  maxFreezeRun: 3,       // >= este nº de cuadros congelados seguidos = stutter
  teleportFactor: 6,     // motion global > factor × mediana = salto (se reporta)
  staticZoneMax: 0.8,    // motion media en la zona estática debe ser < esto
};

if (!VIDEO && !FRAMES) { console.error('falta --video <mp4> o --frames <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// ---- 1) altura EXACTA desde ffprobe (no adivinar: H=2 es falso positivo) ----
function probeDims() {
  let target = VIDEO;
  if (!target) { // primer archivo que matchea el glob
    const dir = FRAMES, pat = GLOB.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    const re = new RegExp('^' + pat + '$');
    const f = fs.readdirSync(dir).filter((n) => re.test(n)).sort()[0];
    if (!f) { console.error('sin archivos que matcheen', GLOB, 'en', dir); process.exit(2); }
    target = path.join(dir, f);
  }
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0:s=x', target]);
  if (r.status !== 0) { console.error('ffprobe falló:', r.stderr?.toString().slice(-300)); process.exit(2); }
  const [ow, oh] = r.stdout.toString().trim().split('x').map((v) => parseInt(v, 10));
  if (!ow || !oh) { console.error('no pude leer dimensiones de', target); process.exit(2); }
  let th = Math.round((oh * W) / ow); th -= th % 2;     // misma fórmula que scale=W:-2 (par)
  return { H: Math.max(2, th) };
}
const H = probeDims().H;
const FRAME_EXP = W * H * 3;

// ---- extraer frames a RGB crudo con altura FORZADA y exacta ----
function extractRaw() {
  const vf = `scale=${W}:${H},fps=${SAMPLE_FPS}`;
  const args = ['-hide_banner', '-loglevel', 'error'];
  if (VIDEO) args.push('-i', VIDEO);
  else args.push('-pattern_type', 'glob', '-framerate', '30', '-i', path.join(FRAMES, GLOB));
  args.push('-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-');
  const r = spawnSync(FFMPEG, args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) { console.error('ffmpeg falló:', r.stderr?.toString().slice(-400)); process.exit(2); }
  return r.stdout;
}
const raw = extractRaw();
if (raw.length % FRAME_EXP !== 0) { console.error(`stream crudo no cuadra: ${raw.length} no es múltiplo de ${FRAME_EXP} (W=${W} H=${H})`); process.exit(2); }
const FRAME = FRAME_EXP;
const N = raw.length / FRAME;
if (N < 2) { console.error('menos de 2 frames analizables'); process.exit(2); }

// ---- 2) luminancia por frame, acumular media y movimiento por píxel ----
const NP = W * H;
const lumPrev = new Float32Array(NP);
const lumCur = new Float32Array(NP);
const meanLum = new Float64Array(NP);     // suma → media
const motionPx = new Float64Array(NP);    // suma |Δlum| por píxel
const globalMotion = new Float32Array(N); // motion media por cuadro

function loadLum(fi, dst) {
  const base = fi * FRAME;
  for (let p = 0; p < NP; p++) {
    const o = base + p * 3;
    dst[p] = 0.299 * raw[o] + 0.587 * raw[o + 1] + 0.114 * raw[o + 2];
  }
}
loadLum(0, lumPrev);
for (let p = 0; p < NP; p++) meanLum[p] += lumPrev[p];
for (let fi = 1; fi < N; fi++) {
  loadLum(fi, lumCur);
  let gm = 0;
  for (let p = 0; p < NP; p++) {
    const d = Math.abs(lumCur[p] - lumPrev[p]);
    motionPx[p] += d; gm += d;
    meanLum[p] += lumCur[p];
    lumPrev[p] = lumCur[p];
  }
  globalMotion[fi] = gm / NP;
}
for (let p = 0; p < NP; p++) meanLum[p] /= N;
const motionNorm = new Float32Array(NP);  // media |Δ| por cuadro y píxel
for (let p = 0; p < NP; p++) motionNorm[p] = motionPx[p] / (N - 1);

// ---- 3) métricas por celda (grid GX×GY) ----
const cells = [];
let brightCells = 0, brightStatic = 0;
const cw = W / GX, ch = H / GY;
for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
  let lumS = 0, motS = 0, cnt = 0;
  const x0 = Math.floor(gx * cw), x1 = Math.floor((gx + 1) * cw);
  const y0 = Math.floor(gy * ch), y1 = Math.floor((gy + 1) * ch);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = y * W + x; lumS += meanLum[p]; motS += motionNorm[p]; cnt++; }
  const lum = lumS / cnt, mot = motS / cnt;
  const bright = lum > TH.lumFloor, moving = mot > TH.cellMotionFloor;
  if (bright) { brightCells++; if (!moving) brightStatic++; }
  cells.push({ gx, gy, lum: +lum.toFixed(1), mot: +mot.toFixed(2), bright, moving });
}
const frozenContent = brightCells ? brightStatic / brightCells : 0;

// ---- 4) métricas temporales globales ----
const gmSorted = [...globalMotion.slice(1)].sort((a, b) => a - b);
const median = gmSorted[Math.floor(gmSorted.length / 2)] || 0;
const aliveFrac = motionNorm.reduce((a, v) => a + (v > TH.cellMotionFloor ? 1 : 0), 0) / NP;
let freezeRun = 0, maxFreezeRun = 0, frozenFrames = 0; const teleports = [];
for (let fi = 1; fi < N; fi++) {
  if (globalMotion[fi] < TH.freezeFloor) { freezeRun++; frozenFrames++; if (freezeRun > maxFreezeRun) maxFreezeRun = freezeRun; }
  else freezeRun = 0;
  if (median > 0 && globalMotion[fi] > TH.teleportFactor * median) teleports.push({ frame: fi, t: +(fi / SAMPLE_FPS).toFixed(2), motion: +globalMotion[fi].toFixed(2) });
}

// ---- 5) zona estática opcional (subtítulo abajo) ----
let staticZone = null;
if (STATIC_BOTTOM > 0) {
  const y0 = Math.floor(H * (1 - STATIC_BOTTOM));
  let s = 0, c = 0;
  for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) { s += motionNorm[y * W + x]; c++; }
  const m = s / c;
  staticZone = { fracBottom: STATIC_BOTTOM, motion: +m.toFixed(2), ok: m < TH.staticZoneMax };
}

// ---- 6) heatmap PNG: contenido tenue (gris) + movimiento (rojo-caliente) ----
function writeHeatmap(file) {
  const buf = Buffer.alloc(FRAME);
  let mmax = 0; for (let p = 0; p < NP; p++) if (motionNorm[p] > mmax) mmax = motionNorm[p];
  mmax = Math.max(mmax, 1);
  for (let p = 0; p < NP; p++) {
    const g = Math.min(60, meanLum[p] * 0.35);          // fondo: contenido tenue
    const m = Math.min(1, motionNorm[p] / mmax);
    const hot = Math.pow(m, 0.6);                        // gamma para ver lo tenue
    const o = p * 3;
    buf[o] = Math.min(255, g + hot * 255);              // R sube con movimiento
    buf[o + 1] = Math.min(255, g + hot * 120);          // G medio (naranja)
    buf[o + 2] = Math.min(255, g + hot * 20);           // B casi nada
  }
  // upscale ×4 para verlo
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
    '-s', `${W}x${H}`, '-i', '-', '-vf', `scale=${W * 4}:${H * 4}:flags=neighbor`, '-y', file], { input: buf });
  return r.status === 0;
}
const heatFile = path.join(OUT, 'motion-heatmap.png');
const heatOK = writeHeatmap(heatFile);

// ---- 7) veredicto ----
const fails = [];
if (frozenContent > TH.maxFrozenContent) fails.push(`CONTENIDO-CONGELADO (${(frozenContent * 100).toFixed(0)}% del área luminosa no se mueve)`);
if (EXPECT_MOTION && aliveFrac < TH.minAliveFrac) fails.push(`ESCENA-MUERTA (solo ${(aliveFrac * 100).toFixed(1)}% del cuadro se mueve)`);
if (maxFreezeRun >= TH.maxFreezeRun) fails.push(`FRAMES-CONGELADOS (racha de ${maxFreezeRun} cuadros sin cambio)`);
const warns = [];
// la zona estática es opcional y depende MUCHO de la composición (partículas pueden
// cruzarla legítimamente) → es AVISO, no tumba el gate.
if (staticZone && !staticZone.ok) warns.push(`zona-estática se mueve (motion ${staticZone.motion}) — ¿el subtítulo/logo tiembla o solo pasa contenido por ahí?`);
const pass = fails.length === 0;

// ---- 8) sparkline ASCII del movimiento global ----
function sparkline(arr) {
  const bl = '▁▂▃▄▅▆▇█'; const mx = Math.max(...arr, 1e-6);
  const step = Math.max(1, Math.floor(arr.length / 64));
  let s = '';
  for (let i = 1; i < arr.length; i += step) s += bl[Math.min(7, Math.floor((arr[i] / mx) * 7.999))];
  return s;
}

// ---- 9) salida ----
const verdict = {
  pass, source: VIDEO || FRAMES, frames: N, sampleFps: SAMPLE_FPS, analyzeRes: `${W}x${H}`, grid: `${GX}x${GY}`,
  metrics: {
    frozenContentPct: +(frozenContent * 100).toFixed(1), brightCells, brightStatic,
    aliveFracPct: +(aliveFrac * 100).toFixed(2), maxFreezeRun, frozenFrames,
    globalMotionMedian: +median.toFixed(3), teleports,
  },
  staticZone, thresholds: TH, fails, warns, heatmap: heatOK ? heatFile : null,
};
fs.writeFileSync(path.join(OUT, 'verdict.json'), JSON.stringify(verdict, null, 2));

let md = `# Verificación de MOVIMIENTO\n\n`;
md += `Fuente: \`${verdict.source}\` · ${N} cuadros @ ${SAMPLE_FPS}fps · análisis ${W}x${H} · grid ${GX}x${GY}\n\n`;
md += `**Veredicto: ${pass ? '✓ PASA' : '✗ FALLA'}**${fails.length ? ' — ' + fails.join('; ') : ''}\n\n`;
md += `- Contenido congelado: **${(frozenContent * 100).toFixed(0)}%** del área luminosa NO se mueve (${brightStatic}/${brightCells} celdas). <${(TH.maxFrozenContent * 100)}% = ok.\n`;
md += `- Área viva (global): ${(aliveFrac * 100).toFixed(1)}% del cuadro se mueve.\n`;
md += `- Racha de frames congelados: ${maxFreezeRun} (umbral ${TH.maxFreezeRun}).\n`;
md += `- Teletransportes (saltos): ${teleports.length}${teleports.length ? ' → ' + teleports.map((x) => `t${x.t}`).join(', ') : ''}\n`;
if (staticZone) md += `- Zona estática (abajo ${STATIC_BOTTOM}): motion ${staticZone.motion} ${staticZone.ok ? '(quieta ✓)' : '(SE MUEVE ✗)'}\n`;
md += `\nAbre el heatmap con Read y juzga: **¿lo que DEBE fluir (la materia/nube) está caliente, o solo unos puntos (núcleos) y el resto frío?**\n\n`;
md += heatOK ? `![heatmap](${path.resolve(heatFile)})\n\n\`${path.resolve(heatFile)}\`\n` : `(heatmap no generado)\n`;
fs.writeFileSync(path.join(OUT, 'brief.md'), md);

// consola
console.log(`\n  MOVIMIENTO — ${path.basename(String(verdict.source))}  ·  ${N} cuadros @ ${SAMPLE_FPS}fps  ·  ${W}x${H}`);
console.log('  global motion: ' + sparkline(globalMotion));
console.log(`  contenido congelado : ${(frozenContent * 100).toFixed(0)}%  (${brightStatic}/${brightCells} celdas luminosas quietas)   [<${TH.maxFrozenContent * 100}%=ok]`);
console.log(`  área viva (global)  : ${(aliveFrac * 100).toFixed(1)}%   [>${TH.minAliveFrac * 100}%=ok]`);
console.log(`  frames congelados   : racha máx ${maxFreezeRun}   [<${TH.maxFreezeRun}=ok]`);
console.log(`  teletransportes     : ${teleports.length}${teleports.length ? '  → ' + teleports.map((x) => `t${x.t}`).join(', ') : ''}`);
if (staticZone) console.log(`  zona estática       : motion ${staticZone.motion}  ${staticZone.ok ? '✓ quieta' : '⚠ se mueve'}`);
console.log(`  heatmap → ${heatOK ? heatFile : '(falló)'}`);
for (const w of warns) console.log(`  ⚠ aviso: ${w}`);
console.log(`\n  ${pass ? '✓ MOTION PASA' : '✗ MOTION FALLA — ' + fails.join('; ')}\n`);
process.exit(pass ? 0 : 1);
