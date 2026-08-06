#!/usr/bin/env node
/**
 * camara-probe.cjs — DÓNDE ESTÁ LA CÁMARA DE VERDAD.
 *
 * Por qué existe (2026-08-05): "El codo" salió en 1080 como una pared de luz. Pasé tres
 * rondas DEDUCIENDO la posición de la cámara desde el código (culpé al traversal, luego al
 * tamaño de los sprites) y me equivoqué cada vez. Un still dice "está mal"; esto dice POR QUÉ.
 *
 * Lee las dos sondas inertes de la escena (`__binProbe`, `__molProbe`) y PROYECTA a mano las
 * 8 esquinas de la caja de la nube: si el sujeto se sale del cuadro o se lo traga la cámara,
 * sale en números ANTES de gastar 20 min de render.
 *
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MOL=codo TIMES=3,20,50,90 node scripts/camara-probe.cjs
 *
 * Reusa la receta de lanzamiento de peek.cjs (misma GPU real, mismo hook).
 */
'use strict';
const { chromium } = require('playwright');

const W = parseInt(process.env.W || '1080', 10), H = parseInt(process.env.H || '1920', 10);
const MOL = process.env.MOL || 'codo';
const TIMES = (process.env.TIMES || '3,20,50,90').split(',').map(s => parseFloat(s.trim())).filter(Number.isFinite);
const BASE = process.env.BASE_URL || 'http://localhost:5178';

// proyección a mano: mundo → NDC, con la MISMA convención que three (fov vertical, roll aparte).
function proyecta(P, pos, target, fovDeg, aspect) {
  const f = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
  const fl = Math.hypot(...f); for (let i = 0; i < 3; i++) f[i] /= fl;
  let up = Math.abs(f[1]) > 0.94 ? [0, 0, 1] : [0, 1, 0];
  const r = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
  const rl = Math.hypot(...r); for (let i = 0; i < 3; i++) r[i] /= rl;
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const v = [P[0] - pos[0], P[1] - pos[1], P[2] - pos[2]];
  const z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];          // profundidad (adelante = +)
  const x = v[0] * r[0] + v[1] * r[1] + v[2] * r[2];
  const y = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
  const th = Math.tan(fovDeg * Math.PI / 360);
  return { ndcX: x / (z * th * aspect), ndcY: y / (z * th), z };
}

(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--hide-scrollbars', `--window-size=${W},${H}`] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('  [error]', m.text().slice(0, 160)); });
  await page.goto(`${BASE}/cinematic-molecule.html?m=${MOL}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.ready === true, null, { timeout: 40000 });
  await page.waitForTimeout(800);

  const bin = await page.evaluate(() => window.__binProbe);
  if (!bin) { console.error('✗ sin __binProbe — ¿vite sirve el .tsx VIEJO? (VITE_NO_WATCH: relanza vite)'); process.exit(2); }
  const [x0, y0, z0, x1, y1, z1] = bin.bbox;
  console.log(`\n══ EL .BIN (${MOL}) ═══════════════════════════════════════════`);
  console.log(`  extent DECLARADO : ${bin.extentDeclarado.toFixed(2)}`);
  console.log(`  radio MEDIDO     : puntos ${bin.radioPuntos.toFixed(2)} · núcleos ${bin.radioNucleos.toFixed(2)}`);
  console.log(`  bbox             : x[${x0.toFixed(1)}, ${x1.toFixed(1)}]  y[${y0.toFixed(1)}, ${y1.toFixed(1)}]  z[${z0.toFixed(1)}, ${z1.toFixed(1)}]`);
  console.log(`  centro bbox      : (${((x0 + x1) / 2).toFixed(1)}, ${((y0 + y1) / 2).toFixed(1)}, ${((z0 + z1) / 2).toFixed(1)})   ← la cámara apunta a (0,0,0)`);
  console.log(`  puntos ${bin.nPuntos} · núcleos ${bin.nNucleos} · tamaño sprite ${bin.tam.min.toFixed(3)}–${bin.tam.max.toFixed(3)}`);
  const razon = bin.radioPuntos / bin.extentDeclarado;
  console.log(`  ⇒ radio_real / extent = ${razon.toFixed(2)}${razon > 1.25 || razon < 0.8 ? '   ✗ LA CÁMARA ENCUADRA UNA MOLÉCULA QUE NO EXISTE' : '   ✓ coherente'}`);

  const dur = (await page.evaluate(() => window.__cinematicAtom.duration)) || 16;
  console.log(`\n══ LA CÁMARA (duración ${dur}s) ═══════════════════════════════`);
  const corners = [];
  for (const X of [x0, x1]) for (const Y of [y0, y1]) for (const Z of [z0, z1]) corners.push([X, Y, Z]);
  const aspect = W / H;

  for (const tt of TIMES) {
    await page.evaluate((t) => window.__cinematicAtom.renderAt(t), Math.min(tt, dur));
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
    const c = await page.evaluate(() => window.__molProbe);
    if (!c) { console.log(`  t=${tt}: sin __molProbe`); continue; }
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity, mnZ = Infinity, mxZ = -Infinity;
    for (const P of corners) {
      const p = proyecta(P, c.pos, c.target, c.fov, aspect);
      mnX = Math.min(mnX, p.ndcX); mxX = Math.max(mxX, p.ndcX);
      mnY = Math.min(mnY, p.ndcY); mxY = Math.max(mxY, p.ndcY);
      mnZ = Math.min(mnZ, p.z); mxZ = Math.max(mxZ, p.z);
    }
    // llenado: 1.0 = el sujeto toca justo los bordes. >1 = se SALE. <<1 = punto perdido.
    const llenaX = (mxX - mnX) / 2, llenaY = (mxY - mnY) / 2;
    const dentro = mnZ > c.near;
    const diag = mxZ < c.near ? 'CÁMARA DETRÁS/DENTRO' : !dentro ? 'RECORTADA por el NEAR'
      : Math.max(llenaX, llenaY) > 1.6 ? 'DEMASIADO CERCA — el sujeto se DESBORDA'
      : Math.max(llenaX, llenaY) < 0.35 ? 'DEMASIADO LEJOS — punto perdido en el void'
      : 'encuadre sano';
    console.log(`  t=${String(tt).padStart(5)}  d=${c.d.toFixed(1)}  fov=${c.fov.toFixed(1)}  near=${c.near.toFixed(2)}  ex=${c.ex.toFixed(2)}`);
    console.log(`          profundidad de la nube: ${mnZ.toFixed(1)} … ${mxZ.toFixed(1)}   llenado X=${llenaX.toFixed(2)} Y=${llenaY.toFixed(2)}   → ${diag}`);
  }
  console.log('');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
