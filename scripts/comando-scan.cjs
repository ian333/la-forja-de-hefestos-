#!/usr/bin/env node
/**
 * comando-scan.cjs — arma los datos del CENTRO DE COMANDO de La Forja.
 * Genera public/comando/produccion.json con:
 *   • videos[]      — inventario de TODO lo renderizado (de iangpu dist-video o
 *                     de la biblioteca en gaia-prime, lo que responda)
 *   • narracion{}   — qué clases tienen narración (audio/clase-X narration.mp3)
 *   • telemetria{}  — resumen de events.jsonl del server de telemetría (atlas)
 *   • generatedAt   — timestamp (lo pasa el caller; no usamos Date.now en build)
 *
 * El estado de las CLASES (live/pending, títulos) lo importa la página directo
 * de nobel-catalog.ts; aquí solo el inventario físico + telemetría.
 *
 *   node scripts/comando-scan.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'comando');
const IANGPU = 'ian@100.65.173.85';
const PRIME = 'ian@100.110.244.20';
const ATLAS = 'ian@100.97.118.117';
const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30000 }); } catch { return ''; } };

// ── 1. inventario de videos — lee la BIBLIOTECA LIMPIA en atlas (taxonomía) ──
// rel = ruta relativa a la raíz de biblioteca (ej. economia/clases/coase/x.mp4).
// Se sirve en /biblioteca/<rel>. Saltamos _masters y _archivo (no publicable).
function videoInventory() {
  const ATLAS_BASE = '/mnt/hdd/forja-dist/biblioteca/';
  const PRIME_BASE = '/mnt/hdd/biblioteca/';
  // usar la fuente MÁS COMPLETA (un espejo a medio correr puede dejar una
  // biblioteca PARCIAL en ATLAS — no dejar que 3 archivos pisen el catálogo real)
  const rawA = sh(`ssh -o ConnectTimeout=12 ${ATLAS} 'find /mnt/hdd/forja-dist/biblioteca -name "*.mp4" -printf "%p|%s\\n" 2>/dev/null'`);
  const rawP = sh(`ssh -o ConnectTimeout=10 ${PRIME} 'find /mnt/hdd/biblioteca -name "*.mp4" -printf "%p|%s\\n" 2>/dev/null'`);
  const nA = rawA.trim() ? rawA.trim().split('\n').length : 0;
  const nP = rawP.trim() ? rawP.trim().split('\n').length : 0;
  let raw, base;
  if (nA >= nP) { raw = rawA; base = ATLAS_BASE; } else { raw = rawP; base = PRIME_BASE; }
  console.log(`  inventario: ATLAS=${nA} PRIME=${nP} → usando ${base}`);
  const vids = [];
  for (const line of raw.trim().split('\n')) {
    if (!line.includes('|')) continue;
    const [p, s] = line.split('|');
    const rel = p.replace(base, '');
    if (rel.startsWith('_masters/') || rel.startsWith('_archivo/')) continue;  // no publicable
    const familia = rel.split('/')[0];                     // economia | atomos | moleculas | adn | astro
    const sub = rel.split('/').slice(0, -1).join('/');       // ruta de carpeta (familia/tema)
    const name = path.basename(p);
    const fmt = /916|9x16|9-16|vertical|1080x1920/.test(name) ? '9:16' : /169|16x9|16-9|2160x3840/.test(name) ? '16:9' : '?';
    vids.push({ familia, serie: sub, name, fmt, master: false, mb: Math.round((+s || 0) / 1048576), rel });
  }
  return vids.sort((a, b) => a.rel.localeCompare(b.rel));
}

// ── 2. narración por clase (local) ──
function narracion() {
  const dir = path.join(ROOT, 'public', 'audio');
  const out = {};
  if (fs.existsSync(dir)) {
    for (const d of fs.readdirSync(dir)) {
      if (!d.startsWith('clase-')) continue;
      const f = path.join(dir, d, 'narration.mp3');
      const w = path.join(dir, d, 'words.json');
      if (fs.existsSync(f)) out[d.replace('clase-', '')] = { narration: true, aligned: fs.existsSync(w), bytes: fs.statSync(f).size };
    }
  }
  return out;
}

// ── 3. resumen de telemetría (events.jsonl en atlas) ──
function telemetria() {
  const raw = sh(`ssh -o ConnectTimeout=12 ${ATLAS} 'sudo docker exec gaia_telemetry_forja cat /data/events.jsonl 2>/dev/null | tail -8000'`)
    || sh(`ssh -o ConnectTimeout=12 ${ATLAS} 'sudo docker cp gaia_telemetry_forja:/data/events.jsonl /tmp/tele.jsonl 2>/dev/null; tail -8000 /tmp/tele.jsonl 2>/dev/null'`);
  if (!raw.trim()) return { connected: false };
  const sids = new Set(); const pages = {}; let pv = 0, errs = 0, clicks = 0; let last = 0;
  for (const line of raw.trim().split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.sid) sids.add(e.sid);
    if (e.t && e.t > last) last = e.t;
    if (e.type === 'pageview') { pv++; const u = (e.url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '') || '/'; pages[u] = (pages[u] || 0) + 1; }
    else if (e.type === 'error' || e.type === 'console.error') errs++;
    else if (e.type === 'click') clicks++;
  }
  const topPages = Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([u, n]) => ({ u, n }));
  return { connected: true, sessions: sids.size, pageviews: pv, clicks, errors: errs, lastEvent: last, topPages };
}

const data = {
  videos: videoInventory(),
  narracion: narracion(),
  telemetria: telemetria(),
  generatedAt: process.env.STAMP || '',
};
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'produccion.json'), JSON.stringify(data));
console.log(`✓ produccion.json — ${data.videos.length} videos, ${Object.keys(data.narracion).length} clases con narración, telemetría ${data.telemetria.connected ? data.telemetria.sessions + ' sesiones' : 'sin conectar'}`);
