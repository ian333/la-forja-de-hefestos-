#!/usr/bin/env node
/**
 * gaia-montage.cjs — EL MOTOR DE MONTAJE. No edites a mano: la máquina elige.
 *
 * Para cada clip, ANALIZA los píxeles (ffmpeg→RGB crudo a 2fps) y elige SOLA la
 * ventana buena: máxima vida (movimiento) + color, esquivando negros, flashes
 * quemados y tarjetas de marca estáticas. Luego arma: cortes + texto (Inter con
 * sombra) + música etérea + NVENC. Cero timestamps a mano.
 *
 *   node scripts/gaia-montage.cjs   (corre EN iangpu)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = '/home/ian/Orkesta/la-forja';
const W = 1080, H = 1920, FPS = 30;
const T = '/tmp/gaia-mont'; fs.rmSync(T, { recursive: true, force: true }); fs.mkdirSync(T, { recursive: true });

// fuente elegante
let FONT = (spawnSync('bash', ['-c', "fc-list : file 2>/dev/null | grep -iE 'Inter-Regular|InterDisplay-Medium|Inter-Medium' | head -1 | sed 's/: *//;s/:$//'"]).stdout || '').toString().trim();
if (!FONT || !fs.existsSync(FONT)) FONT = path.join(ROOT, 'scripts/fonts/Outfit-600.ttf');

// ── el guion: clips + cuánto dura cada corte + texto (la máquina elige la VENTANA) ──
const CLIPS = [
  { f: 'dist-video/bh-9x16-4k60_master.mp4',        dur: 3.4 },                 // agujero negro
  { f: 'dist-video/atoms-final/atom-026-Fe.mp4',    dur: 1.9, maxStart: 4.5 },  // Hierro (nube, antes de la tarjeta)
  { f: 'dist-video/atoms-final/atom-079-Au.mp4',    dur: 1.9, maxStart: 4.5 },  // Oro
  { f: 'dist-video/atoms-final/atom-010-Ne.mp4',    dur: 1.9, maxStart: 4.5 },  // Neón
  { f: 'dist-video/dna/dna-tata.mp4',               dur: 3.0 },                 // ADN
  { f: 'dist-video/GRAIL_nebula_4k_PLAY.mp4',       dur: 2.6, maxStart: 20 },   // nebulosa fluida
  { f: 'dist-video/GRAIL_nebula_4k_PLAY.mp4',       dur: 3.6, fixedStart: 24.2 }, // α GAIA PRIME (marca — cierre)
];
const TEXT = [
  { seg: 0, t: 'n o   l o   m e m o r i z a s', size: 46, y: 1560, frac: [0.15, 0.9] },
  { seg: 1, t: 'l o   V E S .', size: 100, y: 1330, frac: [0.1, 1.4] },   // puede desbordar al Au (ok)
  { seg: 5, t: 'e l   u n i v e r s o ,   d e   v e r d a d', size: 46, y: 980, frac: [0.1, 0.95] },
];

function ffprobeDur(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f]);
  return parseFloat((r.stdout || '').toString().trim()) || 0;
}
function probeWH(f) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', f]);
  const [w, h] = (r.stdout || '').toString().trim().split('x').map(Number); return { w, h };
}

// analiza un clip a 2fps/160px y devuelve métricas por frame
function frameMetrics(file) {
  const AW = 160; const { w, h } = probeWH(file); if (!w) return null;
  let AH = Math.round(h * AW / w); AH -= AH % 2;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${AW}:${AH},fps=2`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) return null;
  const raw = r.stdout, FR = AW * AH * 3, N = Math.floor(raw.length / FR);
  const M = []; let prevLum = null;
  for (let fi = 0; fi < N; fi++) {
    const b = fi * FR; let lumS = 0, satS = 0, blown = 0, black = 0; const lum = new Float32Array(AW * AH);
    for (let p = 0; p < AW * AH; p++) {
      const o = b + p * 3, R = raw[o], G = raw[o + 1], B = raw[o + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B; lum[p] = L;
      lumS += L; satS += Math.max(R, G, B) - Math.min(R, G, B);
      if (L > 230) blown++; if (L < 8) black++;
    }
    let mot = 0; if (prevLum) { for (let p = 0; p < lum.length; p++) mot += Math.abs(lum[p] - prevLum[p]); mot /= lum.length; }
    prevLum = lum;
    M.push({ t: fi / 2, lum: lumS / (AW * AH), sat: satS / (AW * AH), blown: blown / (AW * AH), black: black / (AW * AH), mot });
  }
  return M;
}

// elige la mejor ventana [start, start+dur] esquivando negro/flash/tarjeta estática
function pickWindow(file, dur, maxStart) {
  const total = ffprobeDur(file);
  const M = frameMetrics(file);
  if (!M || !M.length) return 1.0;
  const hi = Math.max(1, Math.min(maxStart || (total - dur - 0.3), total - dur - 0.3));
  let best = 1.0, bestScore = -1e9;
  for (let s = 1.0; s <= hi; s += 0.5) {
    const win = M.filter(m => m.t >= s && m.t <= s + dur);
    if (win.length < 2) continue;
    const avg = k => win.reduce((a, m) => a + m[k], 0) / win.length;
    const lum = avg('lum'), sat = avg('sat'), blown = avg('blown'), black = avg('black'), mot = avg('mot');
    if (black > 0.92 || lum < 6) continue;               // casi todo negro
    if (blown > 0.45) continue;                          // flash quemado
    // score: color + vida + exposición sana − castigos (tarjeta = poco color + poco movimiento)
    const score = sat * 1.0 + mot * 0.6 + Math.min(lum, 90) * 0.25 - blown * 300 - (black > 0.75 && mot < 0.4 ? 120 : 0);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return +best.toFixed(2);
}

// ── 1. elegir ventanas + extraer segmentos ──
const NORM = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},format=yuv420p,setsar=1`;
console.log('== la máquina elige ventanas ==');
const segFiles = [];
CLIPS.forEach((c, i) => {
  const abs = path.join(ROOT, c.f);
  const start = c.fixedStart != null ? c.fixedStart : pickWindow(abs, c.dur, c.maxStart);
  const out = path.join(T, `s${i}.mp4`);
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(start), '-t', String(c.dur), '-i', abs, '-vf', NORM, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-y', out]);
  if (r.status !== 0) { console.error('  ✗ seg', i, (r.stderr || '').toString().slice(-200)); process.exit(1); }
  segFiles.push(out);
  console.log(`  ✓ s${i} ${path.basename(c.f)} @ ${start}s (${c.dur}s)`);
});

// ── 2. concat ──
const listP = path.join(T, 'list.txt');
fs.writeFileSync(listP, segFiles.map(f => `file '${f}'`).join('\n'));
spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listP, '-c', 'copy', '-y', path.join(T, 'cat.mp4')]);

// ── 3. texto (timeline desde las duraciones) ──
const starts = []; let acc = 0; CLIPS.forEach(c => { starts.push(acc); acc += c.dur; });
const esc = s => s.replace(/'/g, "\\'").replace(/,/g, '\\,');
const draws = TEXT.map(x => {
  const s0 = starts[x.seg] + x.frac[0], s1 = starts[x.seg] + Math.min(x.frac[1], CLIPS[x.seg].dur * 1.4) + (x.frac[1] > CLIPS[x.seg].dur ? 0 : 0);
  const a = starts[x.seg] + x.frac[0], b = starts[x.seg] + (x.frac[1] <= 1 ? CLIPS[x.seg].dur * x.frac[1] : x.frac[1]);
  return `drawtext=fontfile=${FONT}:text='${esc(x.t)}':fontcolor=white@0.97:fontsize=${x.size}:x=(w-tw)/2:y=${x.y}:shadowcolor=black@0.75:shadowx=3:shadowy=3:alpha='min(1\\,3.5*sin(PI*(t-${a.toFixed(2)})/(${(b - a).toFixed(2)})))':enable='between(t\\,${a.toFixed(2)}\\,${b.toFixed(2)})'`;
}).join(',');
spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(T, 'cat.mp4'), '-vf', draws, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-y', path.join(T, 'txt.mp4')], { stdio: 'inherit' });

// ── 4. música etérea + NVENC ──
const dur = ffprobeDur(path.join(T, 'txt.mp4'));
const MUS = path.join(ROOT, 'dist-video/bh-16x9-4k60_PLAY_eterea.mp4');
const OUT = path.join(ROOT, 'dist-video/QUE-ES-GAIA-v3.mp4');
const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', path.join(T, 'txt.mp4'), '-ss', '6', '-i', MUS,
  '-filter_complex', `[1:a]afade=t=in:st=0:d=1.2,afade=t=out:st=${(dur - 1.6).toFixed(2)}:d=1.6,volume=0.92[a]`,
  '-map', '0:v', '-map', '[a]', '-c:v', 'hevc_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '20', '-pix_fmt', 'yuv420p10le',
  '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', '-y', OUT]);
if (r.status !== 0) { console.error('encode falló', (r.stderr || '').toString().slice(-300)); process.exit(1); }
console.log(`\n✓ ${path.relative(ROOT, OUT)} · ${ffprobeDur(OUT).toFixed(1)}s`);
