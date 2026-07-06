#!/usr/bin/env node
/*
 * critic-eye.cjs — captura los stills para el OJO CRÍTICO (agente Opus).
 * ---------------------------------------------------------------------------
 * Complementa a critic-gate.cjs (gate automático sin IA). Este captura los
 * mismos PNG por beat + escribe un MANIFIESTO (critic-brief.md) con la ruta de
 * cada frame y qué juzgar, listo para que un agente Opus los ABRA (Read muestra
 * la imagen) y critique la fotografía/color/composición — el debate de
 * directores que SÍ ve las imágenes.
 *
 * El loop completo (lo orquesta quien llame): 1) critic-eye captura → 2) un
 * agente Opus lee critic-brief.md, abre los PNG y emite crítica → 3) si aprueba
 * (y critic-gate pasa), se lanza el render 4K.
 *
 * Uso:
 *   node scripts/critic-eye.cjs --url http://localhost:4173/cinematic-bh-reel.html \
 *     --hook __cinematicBHReel --out _eye [--shots 2]   (shots = stills por beat)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

(async () => {
  const url = arg('--url'); if (!url) { console.error('falta --url'); process.exit(1); }
  const hook = arg('--hook', '__cinematic');
  const W = parseInt(arg('--w', '1080'), 10), H = parseInt(arg('--h', '1920'), 10);
  const sup = parseInt(arg('--super', '1'), 10);
  const out = arg('--out', '_eye');
  const shots = Math.max(1, parseInt(arg('--shots', '2'), 10)); // stills por beat
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

  const beats = await page.evaluate(
    (h) => (window[h].beats || []).map((b) => ({ id: b.id, start: b.start, end: b.end, caption: b.caption || '' })), hook);
  if (!beats.length) { console.error('[eye] la escena no expone .beats'); await browser.close(); process.exit(1); }

  const captured = [];
  for (const b of beats) {
    // 'shots' instantes repartidos dentro del beat (evita justo el borde del corte).
    for (let s = 0; s < shots; s++) {
      const frac = shots === 1 ? 0.5 : 0.25 + 0.5 * (s / (shots - 1));
      const t = b.start + (b.end - b.start) * frac;
      await page.evaluate(({ tt, h }) => window[h].renderAt(tt), { tt: t, h: hook });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      await page.waitForTimeout(120);
      const name = `${b.id}_s${s}.png`;
      await page.screenshot({ path: path.join(out, name), type: 'png', animations: 'disabled', timeout: 30000 });
      captured.push({ beat: b.id, caption: b.caption, t: +t.toFixed(2), file: path.join(out, name) });
    }
  }
  await browser.close();

  // MANIFIESTO para el agente Opus.
  const absOut = path.resolve(out);
  let md = `# Crítica visual — frames a juzgar\n\n`;
  md += `Abre cada PNG con Read (verás la imagen real) y juzga la FOTOGRAFÍA: luz, exposición,\n`;
  md += `color (¿negro real o morado?, ¿gradiente azul-ISCO/rojo-borde?), composición, contraste,\n`;
  md += `dónde cae la mirada, profundidad, si hay zonas quemadas o muertas. NO juzgues lo que\n`;
  md += `imaginas: juzga lo que VES. Sugiere mejoras concretas y tomas que impacten.\n\n`;
  md += `Carpeta: ${absOut}\n\n`;
  for (const c of captured) {
    md += `- **${c.beat}** (t=${c.t})${c.caption ? ` · "${c.caption}"` : ''} → \`${c.file}\`\n`;
  }
  const briefPath = path.join(out, 'critic-brief.md');
  fs.writeFileSync(briefPath, md);
  console.log(`[critic-eye] ${captured.length} stills en ${absOut}`);
  console.log(`[critic-eye] manifiesto → ${briefPath}`);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
