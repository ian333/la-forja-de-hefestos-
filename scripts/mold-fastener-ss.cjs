/**
 * CAPTURA EL ESTUDIO DE TORNILLERÍA EN VIVO — abre el MISMO sitio de producción, espera
 * a que el poller arme el molde de la pieza empujada, despliega el componente `tornillos`
 * y fotografía el panel de la ELECCIÓN (candidatos + por qué ganó), en las dos mitades.
 * Uso: [URL=..] [WAIT=..] node scripts/mold-fastener-ss.cjs <outdir> [etiqueta]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/fast-ss';
  const tag = process.argv[3] || 'pieza';
  fs.mkdirSync(dir, { recursive: true });
  // GPU real si se puede; si el browser GPU de iangpu está frágil, SOFT=1 → SwiftShader
  const gpuArgs = ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'];
  const softArgs = ['--no-sandbox'];
  const soft = process.env.SOFT === '1';
  const b = await chromium.launch({ headless: soft ? true : false, args: soft ? softArgs : gpuArgs });
  const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  // el molde tarda: poll 1.5s + build + tesela
  await p.waitForSelector('[data-testid="mold-comp-tornillos"]', { timeout: Number(process.env.WAIT || 60000) });
  console.log('✓ el molde vivo trae componente tornillos');
  // desplegar el componente → aparece el estudio. El árbol sigue re-renderizando
  // mientras el molde termina de armarse, así que el click normal falla por "no
  // estable": llevar a la vista + force (el estado del botón sí está listo).
  // el click de Playwright espera "visible+enabled+ESTABLE"; con SwiftShader la tesela
  // del molde bloquea el hilo y nunca se estabiliza → expira. Disparar el click del DOM
  // directo (el handler de React corre igual) evita ese chequeo por completo.
  await p.$eval('[data-testid="mold-expand-tornillos"]', (el) => el.click());
  // waitForSelector espera "visible" y con el re-render de React el handle se hace
  // obsoleto una y otra vez → expira aunque el panel YA esté ahí. Preguntar por
  // EXISTENCIA dentro de la página esquiva todo el chequeo de actionability.
  await p.waitForFunction(() => !!document.querySelector('[data-testid="mold-fastener-study"]'), { timeout: 25000 });
  await p.waitForTimeout(700);
  // el canvas 3D re-renderiza en bucle (rAF) y con SwiftShader jamás da un frame estable
  // → page.screenshot se cuelga esperándolo. El estudio es DOM puro: apagar el canvas
  // deja la página quieta y la foto sale al instante. (KEEP3D=1 para conservarlo.)
  if (process.env.KEEP3D !== '1') {
    await p.evaluate(() => document.querySelectorAll('canvas').forEach((c) => { c.style.display = 'none'; }));
    await p.waitForTimeout(500);
  }

  const shots = [];
  for (const half of ['cavity', 'core']) {
    await p.$eval(`[data-testid="mold-fast-half-${half}"]`, (el) => el.click()).catch(() => {});
    await p.waitForTimeout(500);
    // recorte por COORDENADAS (elementHandle.screenshot también exige actionability)
    const box = await p.evaluate(() => {
      const e = document.querySelector('[data-testid="mold-fastener-study"]');
      e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, text: e.innerText };
    });
    const f = path.join(dir, `${tag}-estudio-${half}.png`);
    await p.screenshot({ path: f, timeout: 30000,
      clip: { x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: Math.min(box.width + 12, 1680), height: Math.min(box.height + 12, 1050) } });
    shots.push(f);
    // el TEXTO del panel: la prueba de que los números son reales, no pixeles bonitos
    console.log(`\n── ${half.toUpperCase()} ──\n${box.text.split('\n').filter(Boolean).map((l) => '  ' + l).join('\n')}`);
  }
  const full = path.join(dir, `${tag}-studio.png`);
  await p.screenshot({ path: full });
  shots.push(full);
  if (errs.length) console.log('⚠ errores de página:', errs.slice(0, 3).join(' | '));
  console.log('\nSS →', shots.join('\n     '));
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 400)); process.exit(1); });
