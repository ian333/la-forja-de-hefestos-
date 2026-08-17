#!/usr/bin/env node
/*
 * salud-canarios.cjs — EL PORTERO DE LOS GANADORES. Carga cada escena canario en headless
 * y verifica que VIVE: ready, duración, cero excepciones de página, y un cuadro de prueba
 * con luz. Sale 1 si cualquiera falla.
 *
 * POR QUÉ EXISTE (2026-08-17): "qScale is not defined" tuvo MUERTO el acto de formación
 * de todas las diatómicas (O₂ incluido) durante DÍAS. La escena reventaba al cargar y el
 * hook nunca llegaba a ready — pero nadie carga a los ganadores entre renders, así que
 * nadie lo vio. El typecheck lo gritaba y todos lo saltábamos como "error preexistente".
 * La documentación no previene esta clase de error; este script sí: 90 segundos que
 * cargan lo sagrado y se niegan a dejarte renderizar sobre una escena rota.
 *
 * Uso (iangpu):  node scripts/salud-canarios.cjs            # los canarios default
 *                node scripts/salud-canarios.cjs o2 wpair    # solo esos
 */
'use strict';
const { chromium } = require('playwright');

// Los CANARIOS: los ganadores + el canon de átomos. Cada uno declara su página, hook y
// qué más debe ser verdad además de ready.
const CANARIOS = {
  o2:      { url: 'cinematic-molecule.html?m=o2',    hook: '__cinematicAtom', durMin: 30 },
  wpair:   { url: 'cinematic-molecule.html?m=wpair', hook: '__cinematicAtom', durMin: 60 },
  whex6:   { url: 'cinematic-molecule.html?m=whex6', hook: '__cinematicAtom', durMin: 80 },
  atomo24: { url: 'cinematic-atom.html?z=24',        hook: '__cinematicAtom', durMin: 20, fuente: 'abinitio' },
};

const BASE = process.env.BASE_URL || 'http://localhost:5178';
const pedidos = process.argv.slice(2).filter(a => !a.startsWith('-'));
const lista = pedidos.length ? pedidos : Object.keys(CANARIOS);

(async () => {
  const browser = await chromium.launch({
    headless: false, executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--ignore-gpu-blocklist', '--enable-gpu',
      '--use-angle=gl', '--enable-webgl', '--disable-software-rasterizer',
      '--hide-scrollbars', '--window-size=540,960'],
  });
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 } });
  const cdp0 = null;
  let fallas = 0;
  for (const nombre of lista) {
    const c = CANARIOS[nombre];
    if (!c) { console.log(`✗ ${nombre}: canario desconocido`); fallas++; continue; }
    const t0 = Date.now();
    const errs = [];
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    try {
      await page.goto(`${BASE}/${c.url}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction((h) => window[h] && window[h].ready === true, c.hook, { timeout: 90000 });
      const st = await page.evaluate((h) => ({
        dur: window[h].duration, fuente: window[h].fuente ?? null,
      }), c.hook);
      // un cuadro de PRUEBA con luz: ready sin píxeles también es una escena muerta
      await page.evaluate(({ h, t }) => window[h].renderAt(t), { h: c.hook, t: (st.dur || 20) / 2 });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      const cdp = await ctx.newCDPSession(page);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80, optimizeForSpeed: true });
      const kb = Buffer.from(shot.data, 'base64').length / 1024;
      const problemas = [];
      if (errs.length) problemas.push(`${errs.length} excepciones de página (${errs[0]})`);
      if (!(st.dur >= c.durMin)) problemas.push(`duración ${st.dur} < ${c.durMin}`);
      if (c.fuente && st.fuente !== c.fuente) problemas.push(`fuente=${st.fuente}, esperaba ${c.fuente}`);
      if (kb < 25) problemas.push(`cuadro de prueba casi vacío (${kb.toFixed(0)}KB)`);
      if (problemas.length) {
        console.log(`✗ ${nombre.padEnd(8)} ${problemas.join(' · ')}`);
        fallas++;
      } else {
        console.log(`✓ ${nombre.padEnd(8)} ready · dur=${st.dur}s · cuadro ${kb.toFixed(0)}KB · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
    } catch (e) {
      console.log(`✗ ${nombre.padEnd(8)} ${String(e.message).slice(0, 120)}${errs.length ? ` · pageerror: ${errs[0]}` : ''}`);
      fallas++;
    }
    await page.close().catch(() => {});
  }
  await browser.close();
  console.log(fallas ? `✗ ${fallas} canario(s) CAÍDOS — NO renderizar hasta arreglar` : '✓ todos los canarios viven');
  process.exit(fallas ? 1 : 0);
})();
