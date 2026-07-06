#!/usr/bin/env node
/**
 * comando-calidad.cjs — EL CLASIFICADOR DE CALIDAD del Centro de Comando.
 *
 * Califica TODOS los videos (0-100) sin GPU (ffmpeg → RGB crudo → métricas) y
 * escribe public/comando/calidad.json para que la página liste los MEJORES.
 *
 * Score = gancho 0.30 + vida 0.25 + exposición 0.25 + color 0.20  (cada sub 0-100):
 *   • GANCHO — energía del primer ~1.2s vs el pico (cold-open fuerte = retención).
 *   • VIDA   — % del cuadro que se mueve − congelado − stutter (gate de movimiento).
 *   • EXPOSICIÓN — sin quemado (blanco reventado = "más luz no es color") ni sujeto oscuro.
 *   • COLOR  — saturación del sujeto − tinte morado.
 * Flags: BLOWOUT, MORADO, CONGELADO, MUERTA, STUTTER, GANCHO-DÉBIL.
 *
 * Cruza por id con catalogo.json → adjunta título canónico + rel de /biblioteca para reproducir.
 *
 *   node scripts/comando-calidad.cjs [--dir dist-video] [--fps 3] [--w 120]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(arg('--dir', path.join(ROOT, 'dist-video')));
const W = parseInt(arg('--w', '120'), 10);
const FPS = parseFloat(arg('--fps', '3'));
const OUT = arg('--out', path.join(ROOT, 'public/comando/calidad.json'));
const CAT = arg('--catalogo', path.join(ROOT, 'public/comando/catalogo.json'));
const GX = 6, GY = 10;

const EL = [null,'Hidrógeno','Helio','Litio','Berilio','Boro','Carbono','Nitrógeno','Oxígeno','Flúor','Neón','Sodio','Magnesio','Aluminio','Silicio','Fósforo','Azufre','Cloro','Argón','Potasio','Calcio','Escandio','Titanio','Vanadio','Cromo','Manganeso','Hierro','Cobalto','Níquel','Cobre','Zinc','Galio','Germanio','Arsénico','Selenio','Bromo','Kriptón','Rubidio','Estroncio','Itrio','Circonio','Niobio','Molibdeno','Tecnecio','Rutenio','Rodio','Paladio','Plata','Cadmio','Indio','Estaño','Antimonio','Telurio','Yodo','Xenón','Cesio','Bario','Lantano','Cerio','Praseodimio','Neodimio','Prometio','Samario','Europio','Gadolinio','Terbio','Disprosio','Holmio','Erbio','Tulio','Iterbio','Lutecio','Hafnio','Tántalo','Wolframio','Renio','Osmio','Iridio','Platino','Oro','Mercurio','Talio','Plomo','Bismuto','Polonio','Astato','Radón','Francio','Radio','Actinio','Torio','Protactinio','Uranio','Neptunio','Plutonio','Americio','Curio','Berkelio','Californio','Einstenio','Fermio','Mendelevio','Nobelio','Lawrencio','Rutherfordio','Dubnio','Seaborgio','Bohrio','Hasio','Meitnerio','Darmstadtio','Roentgenio','Copernicio','Nihonio','Flerovio','Moscovio','Livermorio','Téneso','Oganesón'];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NAME2Z = {}; EL.forEach((nm, z) => { if (nm) NAME2Z[norm(nm)] = z; });

let catalogo = { pieces: [] };
try { catalogo = JSON.parse(fs.readFileSync(CAT, 'utf8')); } catch { /* sin catálogo: igual califica */ }
const byId = new Map(catalogo.pieces.map((p) => [p.id, p]));

// ── derivar id estilo catálogo + familia + título desde la ruta local ──
function derive(rel) {
  let n = path.basename(rel).replace(/\.mp4$/i, '');
  n = n.replace(/^\d{2}-/, '');                       // HOY/01-...
  const top = rel.split('/')[0];
  // átomos: por número Z (026-Fe, atomo-018) o por NOMBRE (atomo-argon)
  let z = 0;
  const mz = n.match(/(?:^|[^0-9])(\d{2,3})-[A-Za-z]/) || n.match(/^atomo-(\d{2,3})/);
  if (mz) z = parseInt(mz[1], 10);
  else { const mn = n.match(/atomo-([a-zñáéíóú]+)/i); if (mn && NAME2Z[norm(mn[1])]) z = NAME2Z[norm(mn[1])]; }
  if (z >= 1 && z <= 118) return { id: 'atomo-' + String(z).padStart(3, '0'), familia: 'atomo', titulo: `Átomo de ${EL[z]}` };
  if (/^dna|adn|telomero|brca|tata/.test(n) || top === 'dna') {
    const tema = n.replace(/-16x9|-9x16|^dna-|^adn-/g, '');
    return { id: 'adn-' + tema, familia: 'adn', titulo: `ADN — ${tema}` };
  }
  if (top === 'molecules' || top === 'chains' || /^mol-|^chain-/.test(n)) {
    const tema = n.replace(/^mol-|^chain-|-16x9|-9x16/g, '');
    return { id: 'mol-' + tema, familia: 'molecula', titulo: `Molécula ${tema}` };
  }
  if (/limones|coase|romer|ostrom|krugman|acemoglu|econ|clase/.test(top + '/' + n)) {
    const tema = (n.match(/limones|coase|romer|ostrom|krugman|acemoglu/) || [n])[0];
    return { id: 'clase-' + tema, familia: 'clase', titulo: `Clase — ${tema}` };
  }
  if (/bh|agujero|tde|pulsar|quasar|magnetar|gargantua|showcase/.test(top + '/' + n)) {
    return { id: 'astro-' + n.replace(/-16x9|-9x16|_master|_vertical|_FINAL/g, ''), familia: 'astro', titulo: n.replace(/[-_]/g, ' ') };
  }
  return { id: 'otro-' + n, familia: 'otro', titulo: n.replace(/[-_]/g, ' ') };
}

function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|\.tmp|\.peek|_masters|_archivo|frames/.test(p)) walk(p, acc); }
    else if (/\.mp4$/i.test(e.name) && !/outro|_master|hevc|preview|_clip|_neb|_card/i.test(e.name)) acc.push(p);
  }
  return acc;
}

function probeH(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file]);
  if (r.status !== 0) return 0;
  const [ow, oh] = r.stdout.toString().trim().split('x').map((v) => parseInt(v, 10));
  if (!ow || !oh) return 0;
  let th = Math.round((oh * W) / ow); th -= th % 2; return Math.max(2, th);
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function scoreVideo(file) {
  const H = probeH(file); if (!H) return null;
  const FRAME = W * H * 3, NP = W * H;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `scale=${W}:${H},fps=${FPS}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || !r.stdout || r.stdout.length % FRAME !== 0) return null;
  const raw = r.stdout; const N = raw.length / FRAME; if (N < 2) return null;

  const lumPrev = new Float32Array(NP), lumCur = new Float32Array(NP);
  const motionPx = new Float64Array(NP);
  let blown = 0, content = 0, contentLumS = 0, satS = 0, purpleDark = 0, darkN = 0, allPx = 0;
  const frameEnergy = new Float32Array(N);

  function load(fi, dst) {
    const b = fi * FRAME;
    for (let p = 0; p < NP; p++) {
      const o = b + p * 3, R = raw[o], G = raw[o + 1], B = raw[o + 2];
      const lum = 0.299 * R + 0.587 * G + 0.114 * B; dst[p] = lum;
      allPx++; if (lum > 235) blown++;
      if (lum > 18) { content++; contentLumS += lum; satS += Math.max(R, G, B) - Math.min(R, G, B); }
      // MORADO real = void teñido de púrpura: azul Y rojo elevados, verde bajo
      // (un glow AZUL tiene R≈G bajos y NO cuenta; el morado tiene componente roja).
      if (lum < 45) { darkN++; if (B > R + 14 && R > G + 5) purpleDark++; }
    }
  }
  load(0, lumPrev);
  let l0 = 0; for (let p = 0; p < NP; p++) l0 += lumPrev[p]; frameEnergy[0] = l0 / NP;
  for (let fi = 1; fi < N; fi++) {
    load(fi, lumCur);
    let gm = 0, lm = 0;
    for (let p = 0; p < NP; p++) { const d = Math.abs(lumCur[p] - lumPrev[p]); motionPx[p] += d; gm += d; lm += lumCur[p]; lumPrev[p] = lumCur[p]; }
    frameEnergy[fi] = lm / NP + gm / NP * 2;       // brillo + movimiento (peso al movimiento)
  }
  const motionNorm = new Float32Array(NP); for (let p = 0; p < NP; p++) motionNorm[p] = motionPx[p] / (N - 1);

  // métricas
  const blownPct = (blown / allPx) * 100;
  const contentLum = content ? contentLumS / content : 0;
  const satContent = content ? satS / content : 0;
  const purplePct = darkN ? (purpleDark / darkN) * 100 : 0;
  let aliveN = 0; for (let p = 0; p < NP; p++) if (motionNorm[p] > 0.6) aliveN++;
  const aliveFrac = aliveN / NP;
  // frozenContent por celdas
  const cw = W / GX, ch = H / GY; let bright = 0, brightStatic = 0;
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    let lumS = 0, motS = 0, c = 0;
    for (let y = Math.floor(gy * ch); y < Math.floor((gy + 1) * ch); y++) for (let x = Math.floor(gx * cw); x < Math.floor((gx + 1) * cw); x++) { const p = y * W + x; lumS += motionNorm[p] >= 0 ? 0 : 0; c++; }
    // recomputar lum media de la celda desde frameEnergy no sirve; usamos meanLum approx vía motionPx? mejor: recorrer
  }
  // frozenContent simple: usar grilla con lum media (recorremos una vez más, barato)
  const cellLum = new Float64Array(GX * GY), cellMot = new Float64Array(GX * GY), cellCnt = new Float64Array(GX * GY);
  // meanLum aproximada = del último frame cargado (lumPrev ya es el último). Suficiente para "hay contenido".
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x; const ci = Math.min(GY - 1, Math.floor(y / ch)) * GX + Math.min(GX - 1, Math.floor(x / cw));
    cellLum[ci] += lumPrev[p]; cellMot[ci] += motionNorm[p]; cellCnt[ci]++;
  }
  for (let i = 0; i < GX * GY; i++) { const lum = cellLum[i] / cellCnt[i], mot = cellMot[i] / cellCnt[i]; if (lum > 10) { bright++; if (mot <= 0.6) brightStatic++; } }
  const frozenContentPct = bright ? (brightStatic / bright) * 100 : 0;
  // stutter
  let freezeRun = 0, maxFreezeRun = 0; const eMed = [...frameEnergy].sort((a, b) => a - b)[Math.floor(N / 2)] || 0;
  for (let fi = 1; fi < N; fi++) { if (frameEnergy[fi] < 0.25) { freezeRun++; if (freezeRun > maxFreezeRun) maxFreezeRun = freezeRun; } else freezeRun = 0; }
  // gancho: ¿abre FUERTE (in medias res) o entra lento/negro? Se compara el primer
  // ~0.8s contra la MEDIANA del clip (robusto al pico de un corte, que reventaba el ratio).
  // ratio ≥1 = abre al nivel típico o más; <0.5 = entra por debajo (fade-in lento).
  const k = Math.max(1, Math.round(0.8 * FPS)); let eFirst = 0; for (let fi = 0; fi < Math.min(k, N); fi++) eFirst += frameEnergy[fi]; eFirst /= Math.min(k, N);
  const hookRatio = eFirst / Math.max(eMed, 1e-6);   // eMed = mediana del clip (calculada arriba, robusta al pico de un corte)

  // sub-scores 0-100
  const expo = clamp(100 - blownPct * 4 - (contentLum > 185 ? (contentLum - 185) * 2 : 0) - (contentLum < 28 ? (28 - contentLum) * 2.2 : 0));
  const color = clamp((satContent / 62) * 100 - purplePct * 4);
  const vida = clamp((aliveFrac / 0.5) * 100 - frozenContentPct * 0.7 - (maxFreezeRun >= 3 ? 30 : 0));
  const gancho = clamp((hookRatio - 0.25) / 1.1 * 100);   // 0.25→0 · 0.8→50 · 1.35→100
  const score = Math.round(clamp(0.30 * gancho + 0.25 * vida + 0.25 * expo + 0.20 * color));
  const grade = score >= 85 ? 'S' : score >= 75 ? 'A' : score >= 62 ? 'B' : score >= 48 ? 'C' : 'D';
  const flags = [];
  if (blownPct > 2) flags.push('BLOWOUT');
  if (purplePct > 8) flags.push('MORADO');
  if (frozenContentPct > 55) flags.push('CONGELADO');
  if (aliveFrac < 0.04) flags.push('MUERTA');
  if (maxFreezeRun >= 3) flags.push('STUTTER');
  if (hookRatio < 0.5) flags.push('GANCHO-DÉBIL');   // abre claramente por debajo de lo típico (entra lento/negro)

  return { frames: N, score, grade, sub: { gancho: Math.round(gancho), vida: Math.round(vida), expo: Math.round(expo), color: Math.round(color) }, flags,
    raw: { blownPct: +blownPct.toFixed(1), contentLum: +contentLum.toFixed(0), satContent: +satContent.toFixed(0), purplePct: +purplePct.toFixed(1), aliveFracPct: +(aliveFrac * 100).toFixed(1), frozenContentPct: +frozenContentPct.toFixed(0), maxFreezeRun, hookRatio: +hookRatio.toFixed(2) } };
}

const files = walk(DIR, []).sort();
console.log(`calificando ${files.length} videos de ${path.relative(ROOT, DIR)} @ ${FPS}fps (W=${W}) …\n`);
const byIdItem = new Map(); let i = 0;
for (const f of files) {
  i++;
  const rel = path.relative(DIR, f);
  const d = derive(rel);
  const sc = scoreVideo(f);
  if (!sc) { console.log(`  [${i}/${files.length}] ⁇ ${rel} (no analizable)`); continue; }
  const piece = byId.get(d.id);
  const playRel = piece ? (piece.formatos['9:16'] || piece.formatos['video'] || piece.formatos['16:9'] || Object.values(piece.formatos)[0]) : null;
  const item = { id: d.id, familia: d.familia, titulo: (piece && piece.titulo) || d.titulo, file: rel, rel: playRel,
    score: sc.score, grade: sc.grade, sub: sc.sub, flags: sc.flags, raw: sc.raw, frames: sc.frames, enCatalogo: !!piece, variantes: 1 };
  // dedupe por id: nos quedamos con el MEJOR render de cada pieza (pero contamos variantes)
  const prev = byIdItem.get(d.id);
  if (!prev) byIdItem.set(d.id, item);
  else { item.variantes = prev.variantes + 1; if (item.score > prev.score) byIdItem.set(d.id, item); else { prev.variantes++; } }
  console.log(`  [${i}/${files.length}] ${sc.grade} ${String(sc.score).padStart(3)} ${rel}  ${sc.flags.length ? '⚑ ' + sc.flags.join(',') : ''}`);
}
const items = [...byIdItem.values()].sort((a, b) => b.score - a.score);
const porFam = {}; for (const it of items) (porFam[it.familia] ||= []).push(it.score);
const out = { items, count: items.length, generatedAt: process.env.STAMP || '',
  resumen: { S: items.filter(x => x.grade === 'S').length, A: items.filter(x => x.grade === 'A').length, B: items.filter(x => x.grade === 'B').length, C: items.filter(x => x.grade === 'C').length, D: items.filter(x => x.grade === 'D').length },
  porFamilia: Object.fromEntries(Object.entries(porFam).map(([f, a]) => [f, { n: a.length, media: Math.round(a.reduce((s, v) => s + v, 0) / a.length) }])) };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`\n✓ ${path.relative(ROOT, OUT)} — ${items.length} videos calificados`);
console.log(`  grados: S:${out.resumen.S} A:${out.resumen.A} B:${out.resumen.B} C:${out.resumen.C} D:${out.resumen.D}`);
console.log(`  TOP 10:`); for (const it of items.slice(0, 10)) console.log(`   ${it.grade} ${it.score}  ${it.titulo}  (${it.file})`);
