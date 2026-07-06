#!/usr/bin/env node
/**
 * shot-font.cjs — comparación de FUENTES de subtítulo sobre el MISMO frame
 * de una masterclass cine. Carga clase.html, fija __cineT, y por cada fuente
 * candidata inyecta el webfont (Google Fonts) + overridea el span del
 * subtítulo → crop del tercio inferior. Para que el director elija.
 *
 *   T=207.3 W=1080 H=1920 BASE_URL=http://localhost:8099 node scripts/shot-font.cjs
 * Salida: ~/font-<slug>.png (cwd del proceso)
 */
'use strict';
const { chromium } = require('playwright');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const ID = process.env.ID || 'econ-2018-romer-nordhaus';
const T = parseFloat(process.env.T || '207.3');
const BASE = process.env.BASE_URL || 'http://localhost:8099';

// candidatas: [slug, css font-family, google family param o null si ya está]
const FONTS = [
  ['outfit', "'Outfit', sans-serif", null],                  // la que va embarcada
  ['jost', "'Jost', sans-serif", 'Jost:wght@600'],
  ['sora', "'Sora', sans-serif", 'Sora:wght@600'],
  ['manrope', "'Manrope', sans-serif", 'Manrope:wght@700'],
];

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle',
      '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`${BASE}/clase.html?id=${ID}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  const btn = await page.$('[data-cine-play]');
  if (btn) { await btn.click(); await page.waitForTimeout(1000); }
  await page.evaluate((t) => {
    window.__cineT = t;
    const a = document.querySelector('audio'); if (a) a.pause();
  }, T);
  await page.waitForTimeout(900);
  const clip = { x: 0, y: Math.round(H * 0.82), width: W, height: Math.round(H * 0.14) };
  for (const [slug, family, gf] of FONTS) {
    await page.evaluate(async ({ family, gf }) => {
      if (gf && !document.querySelector(`link[data-font="${gf}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.dataset.font = gf;
        l.href = `https://fonts.googleapis.com/css2?family=${gf}&display=block`;
        document.head.appendChild(l);
      }
      await document.fonts.ready;
      // el span del subtítulo es el único hijo del contenedor bottom-[7%]
      const span = document.querySelector('div.bottom-\\[7\\%\\] span');
      if (span) span.style.fontFamily = family;
    }, { family, gf });
    await page.waitForTimeout(1200);   // deja bajar el woff2
    const f = `font-${slug}.png`;
    await page.screenshot({ path: f, type: 'png', clip });
    console.log(`✓ ${f}`);
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
