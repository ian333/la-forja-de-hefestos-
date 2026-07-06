#!/usr/bin/env node
/*
 * critic-gate.cjs — PORTERO automático de calidad para escenas cinematic.
 * ---------------------------------------------------------------------------
 * Antes de invertir 30 min en un render 4K, captura UN still por beat (al t
 * medio) y MIDE los 3 defectos que ya nos costaron caro, SIN IA y SIN deps
 * externas (analiza los píxeles DENTRO de la página con canvas 2D, no pngjs):
 *
 *   1) NEGRO-MORADO  — el void debe leer NEGRO, no morado (lección del shader
 *                      lavanda). Mide B-R medio en la zona oscura. >umbral=morado.
 *   2) CONFETI       — puntos verde/rojo del chromaticAberration sobre el
 *                      starfield. % de píxeles verde-dominantes.
 *   3) FRAME-NEGRO   — beat casi todo negro (ley geométrica asin(b_crit/r)>=fov/2
 *                      o glitch del driver). Luminancia media < umbral.
 *
 * Lee window.<hook>.beats (start/end) y mide cada uno a (start+end)/2. Emite
 * veredicto JSON + exit code (0 = pasa, 1 = falla) → usable como GATE de render.
 *
 * Uso:
 *   node scripts/critic-gate.cjs --url http://localhost:4173/cinematic-bh-reel.html \
 *     --hook __cinematicBHReel --out _gate [--w 1080 --h 1920]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

// Umbrales (calibrados a mano en la sesión del comercial del BH).
const TH = { purpleDelta: 4, greenPct: 0.4, darkMeanMin: 12 };

(async () => {
  const url = arg('--url'); if (!url) { console.error('falta --url'); process.exit(2); }
  const hook = arg('--hook', '__cinematic');
  const W = parseInt(arg('--w', '1080'), 10), H = parseInt(arg('--h', '1920'), 10);
  const sup = parseInt(arg('--super', '1'), 10);
  const out = arg('--out', '_gate');
  const jsonOut = arg('--json', path.join(out, 'verdict.json'));
  const chrome = arg('--chrome', '/usr/bin/google-chrome-stable');
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({
    headless: false, executablePath: chrome,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new', '--ignore-gpu-blocklist',
      '--enable-gpu', '--enable-gpu-rasterization', '--use-angle=gl', '--enable-webgl',
      '--enable-unsafe-swiftshader', '--hide-scrollbars', `--window-size=${W},${H}`],
  });
  const page = await (await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: sup, bypassCSP: true,
  })).newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction((h) => window[h] && window[h].ready === true, hook, { timeout: 120000 });

  const gl = await page.evaluate(() => {
    try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); if (!g) return 'NULL';
      const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'masked';
    } catch (err) { return 'err'; }
  });
  console.log('[gl]', String(gl).slice(0, 56));

  const beats = await page.evaluate((h) => (window[h].beats || []).map((b) => ({ id: b.id, start: b.start, end: b.end })), hook);
  if (!beats.length) { console.error('[gate] la escena no expone .beats'); await browser.close(); process.exit(2); }

  // Mide los píxeles del <canvas> WebGL re-dibujándolo en un canvas 2D pequeño
  // (downscale 96px de ancho — barato, suficiente para las métricas globales).
  const measure = () => page.evaluate(() => {
    const c = document.querySelector('canvas'); if (!c) return null;
    const sw = 96, sh = Math.max(1, Math.round(96 * c.height / c.width));
    const s = document.createElement('canvas'); s.width = sw; s.height = sh;
    const x = s.getContext('2d'); x.drawImage(c, 0, 0, sw, sh);
    const d = x.getImageData(0, 0, sw, sh).data; const n = sw * sh;
    let rS = 0, gS = 0, bS = 0, lumS = 0, dR = 0, dB = 0, dN = 0, green = 0;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      rS += r; gS += g; bS += b; lumS += lum;
      if (r + g + b < 90) { dR += r; dB += b; dN++; }
      if (g > r + 22 && g > b + 22 && g > 28) green++;
    }
    return {
      avgRGB: [Math.round(rS / n), Math.round(gS / n), Math.round(bS / n)],
      lumMean: +(lumS / n).toFixed(1),
      darkPurple: +(dN ? (dB / dN) - (dR / dN) : 0).toFixed(1),
      greenPct: +((green / n) * 100).toFixed(2),
    };
  });

  const results = [];
  for (const b of beats) {
    const t = (b.start + b.end) / 2;
    await page.evaluate(({ tt, h }) => window[h].renderAt(tt), { tt: t, h: hook });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    await page.waitForTimeout(120);
    const f = path.join(out, `${b.id}.png`);
    await page.screenshot({ path: f, type: 'png', animations: 'disabled', timeout: 30000 });
    const m = await measure();
    m.beat = b.id; m.t = +t.toFixed(2); m.file = f;
    m.flags = { purple: m.darkPurple > TH.purpleDelta, confetti: m.greenPct > TH.greenPct, blackFrame: m.lumMean < TH.darkMeanMin };
    results.push(m);
  }
  await browser.close();

  let pass = true;
  console.log('\n  beat                     t     lum   morado  verde%   veredicto');
  console.log('  ' + '─'.repeat(70));
  for (const m of results) {
    const bad = [];
    if (m.flags.purple) bad.push('MORADO');
    if (m.flags.confetti) bad.push('CONFETI');
    if (m.flags.blackFrame) bad.push('NEGRO');
    if (bad.length) pass = false;
    console.log(`  ${m.beat.padEnd(24)} ${String(m.t).padStart(5)} ${String(m.lumMean).padStart(6)} ${String(m.darkPurple).padStart(7)} ${String(m.greenPct).padStart(7)}   ${bad.length ? '✗ ' + bad.join('+') : '✓ ok'}`);
  }
  const verdict = { pass, thresholds: TH, gl: String(gl).slice(0, 56), beats: results };
  fs.writeFileSync(jsonOut, JSON.stringify(verdict, null, 2));
  console.log(`\n  ${pass ? '✓ GATE PASA' : '✗ GATE FALLA'} — ${jsonOut}`);
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
