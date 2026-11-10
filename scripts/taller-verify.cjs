#!/usr/bin/env node
/**
 * EL TALLER + LAS TENAZAS — verificación con navegador y GPU real (orden 2026-11-09-el-taller-tenazas).
 * ============================================================================================================
 * Abre «LABORATORIO v2 · generado» desde el lobby y prueba, con el mouse de verdad sobre el visor:
 *   A. el árbol lista los 3 módulos con su cuenta (80 / 106 / 40) y se despliega;
 *   B. tenaza CARA: el mouse encima ilumina UNA cara; el clic la agarra («Cara plana · N mm²») y el árbol marca la hoja;
 *   C. tenaza CUERPO y PIEZA agarran la hoja y el módulo entero;
 *   D. el foco de una hoja honda la oculta (y solo a ella);
 *   E. aislar deja solo ese subárbol; F. Esc suelta;
 *   G. con rayos X, el mouse ATRAVIESA la cubierta fantasma (nunca la agarra).
 * Capturas a 1920×1080 en forja-shots/taller/ (para revisarlas A OJO, no solo «pasó»).
 *
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     node scripts/taller-verify.cjs            # URL=http://localhost:5009/forja-brep.html por omisión
 * Sale con 0 si todo pasa, 1 si algo falla.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'taller');
const checks = [];
const ok = (nombre, pasa, dato) => { checks.push({ nombre, pasa: !!pasa, dato }); console.log(`${pasa ? 'PASA' : 'FALLA'}  ${nombre}${dato !== undefined ? '  · ' + JSON.stringify(dato) : ''}`); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({
    headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--window-size=1920,1080'],
  });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERR ' + String(e).slice(0, 240)));
  p.on('console', (m) => { if (m.type() === 'error' && !/telemetry|favicon|404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
  const shot = (n) => p.screenshot({ path: path.join(OUT, n), timeout: 30000 });
  const qa = () => p.evaluate(() => { const t = window.__forgeBrep.taller; return t && { tenaza: t.tenaza, sel: t.sel, agarre: t.agarre, aislado: t.aislado, hover: t.hover, visibles: t.visibles, total: t.total, fantasmas: t.fantasmas }; });
  const espera = (ms) => p.waitForTimeout(ms);
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => {
      const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info');
      return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?';
    });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);

    // ── abrir el laboratorio desde el lobby ──
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    let s = await qa();
    ok('laboratorio cargado completo', s.visibles === s.total, `${s.visibles}/${s.total}`);

    // ── A. el árbol ──
    const filas0 = await p.$$eval('[data-taller-key]', (els) => els.map((e) => ({ key: e.dataset.tallerKey, txt: e.textContent })));
    const cuenta = (k) => { const f = filas0.find((x) => x.key === k); const m = f && f.txt.match(/·\s*(\d+)/); return m ? +m[1] : null; };
    ok('A. árbol: 3 módulos con 80 / 106 / 40 cuerpos', filas0.length === 3 && cuenta('lab-cuerpo') === 80 && cuenta('lab-placa') === 106 && cuenta('lab-alambre') === 40,
      filas0.map((f) => `${f.key}:${cuenta(f.key)}`));
    await p.click('[data-testid="taller-abrir-lab-cuerpo"]');
    await espera(200);
    const filas1 = await p.$$eval('[data-taller-key]', (els) => els.length);
    ok('A. desplegar «Cuerpo impreso» muestra sus hijos', filas1 > 50, filas1);
    await shot('01-arbol.png');

    // ── B. tenaza CARA: barrer el visor con el mouse hasta dar con una cara plana grande del cuerpo impreso ──
    const vp = await p.$eval('.fb-viewport', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const hits = [];
    for (let gy = 1; gy < 14; gy++) for (let gx = 1; gx < 22; gx++) {
      const x = vp.x + (vp.w * gx) / 22, y = vp.y + (vp.h * gy) / 14;
      await p.mouse.move(x, y);
      const h = await p.evaluate(() => window.__forgeBrep.taller.hover);
      if (h) hits.push({ x, y, ...h });
    }
    s = await qa();
    const fantasmasTocados = hits.filter((h) => s.fantasmas.includes(h.key));
    ok('G. rayos X: el mouse nunca agarra la cubierta fantasma', s.fantasmas.length > 0 && fantasmasTocados.length === 0,
      { fantasmas: s.fantasmas.length, tocados: fantasmasTocados.map((h) => h.key).slice(0, 5), puntosConPieza: hits.length });
    const conInfo = [];
    for (const h of hits) {
      if (h.cara == null || !h.key.startsWith('lab-cuerpo/')) continue;
      const c = await p.evaluate(([k, i]) => window.__forgeBrep.taller.cara(k, i), [h.key, h.cara]);
      if (c) conInfo.push({ ...h, ...c });
    }
    const planas = conInfo.filter((h) => h.plana).sort((a, b) => b.area - a.area);
    ok('B. hay caras planas del cuerpo impreso bajo el mouse', planas.length > 0, planas.slice(0, 3).map((h) => `${h.nombre} cara ${h.cara} ${Math.round(h.area)} mm²`));
    const blanco = planas[0];
    if (!blanco) throw new Error('sin cara plana bajo el mouse: no se puede seguir');
    await p.mouse.move(blanco.x, blanco.y);
    await espera(250);
    const hov = await p.evaluate(() => window.__forgeBrep.taller.hover);
    ok('B. el mouse encima ilumina ESA cara', hov && hov.key === blanco.key && hov.cara === blanco.cara, hov);
    await shot('02-cara-mouse-encima.png');
    await p.mouse.click(blanco.x, blanco.y);
    await espera(400);
    s = await qa();
    const txtAgarre = await p.$eval('[data-testid="taller-agarre"]', (e) => e.textContent).catch(() => '');
    ok('B. clic agarra la cara: «Cara plana · N mm²» y su cuerpo', s.sel && s.sel.nivel === 'cara' && s.sel.key === blanco.key && s.sel.cara === blanco.cara && /^Cara plana · [\d,.]+ mm²/.test(txtAgarre), txtAgarre);
    const filaSel = await p.$eval(`[data-taller-key="${blanco.key}"]`, (e) => e.className).catch(() => null);
    ok('B. el árbol se despliega y marca la hoja agarrada', filaSel && /\bsel\b/.test(filaSel), filaSel);
    await shot('03-cara-agarrada.png');

    // ── C. tenaza CUERPO y PIEZA ──
    await p.click('[data-testid="tenaza-cuerpo"]');
    await p.mouse.click(blanco.x, blanco.y);
    await espera(400);
    s = await qa();
    const txtCuerpo = await p.$eval('[data-testid="taller-agarre"]', (e) => e.textContent).catch(() => '');
    ok('C. tenaza CUERPO agarra la hoja entera', s.sel && s.sel.nivel === 'cuerpo' && s.sel.key === blanco.key && /^Cuerpo · \d+ × \d+ × \d+ mm/.test(txtCuerpo), txtCuerpo);
    await shot('04-cuerpo.png');
    await p.click('[data-testid="tenaza-pieza"]');
    await p.mouse.click(blanco.x, blanco.y);
    await espera(400);
    s = await qa();
    const txtPieza = await p.$eval('[data-testid="taller-agarre"]', (e) => e.textContent).catch(() => '');
    ok('C. tenaza PIEZA agarra el módulo (80 cuerpos)', s.sel && s.sel.nivel === 'pieza' && s.sel.key === 'lab-cuerpo' && /80 cuerpos/.test(txtPieza), txtPieza);
    await shot('05-pieza.png');

    // ── F. Esc suelta ──
    await p.keyboard.press('Escape');
    await espera(200);
    s = await qa();
    ok('F. Esc suelta lo agarrado', !s.sel && (await p.$('.fb-agarre.vacio')) !== null);

    // ── D. foco de una hoja honda ──
    await p.click('[data-testid="tenaza-cara"]');
    const total = s.total;
    const focoSel = `[data-testid="taller-foco-${blanco.key}"]`;
    if (!(await p.$(focoSel))) { await p.click('[data-testid="taller-abrir-lab-cuerpo"]').catch(() => {}); }
    await p.click(focoSel);
    await espera(400);
    s = await qa();
    await p.mouse.move(blanco.x + 1, blanco.y + 1);
    await p.mouse.move(blanco.x, blanco.y);
    await espera(200);
    const hov2 = await p.evaluate(() => window.__forgeBrep.taller.hover);
    ok('D. foco apagado oculta esa hoja y solo esa', s.visibles === total - 1 && (!hov2 || hov2.key !== blanco.key), { visibles: s.visibles, total, ahoraEncima: hov2 && hov2.key });
    await shot('06-foco-apagado.png');
    await p.click(focoSel);
    await espera(300);

    // ── E. aislar ──
    await p.click('[data-testid="taller-aislar-lab-alambre"]');
    await espera(500);
    s = await qa();
    ok('E. aislar «Módulo del alambre» deja sus 40 cuerpos', s.visibles === 40 && s.aislado === 'lab-alambre', s.visibles);
    await shot('07-aislado-alambre.png');
    await p.click('[data-testid="taller-desaislar"]');
    await espera(300);
    s = await qa();
    ok('E. «mostrar todo» regresa todo', s.visibles === total, s.visibles);
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'taller-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nTALLER_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
