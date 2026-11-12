#!/usr/bin/env node
/**
 * PONER UNA PIEZA COMPRADA — verificación con navegador y GPU real (orden 2026-11-11-poner-pieza-comprada).
 * En «LABORATORIO v2 · generado», con el mouse y el teclado:
 *   A. «＋ poner una pieza comprada» abre el formulario; caja 245 × 125 × 65 «Fuente S-1200-48» → Poner;
 *   B. aparece en el Taller (227 cuerpos), dentro de «Piezas mías», agarrada, y mide 245 × 125 × 65 exactos;
 *   C. nace junto al banco, sin encimarse con él, y la cámara no brinca;
 *   D. se mueve con «mover» (ΔX = −300) y se mide contra el banco con Medir apagado/encendido como cualquier pieza;
 *   E. es comprada: una cara suya solo ofrece «Cuerpo nuevo»;
 *   F. un cilindro Ø56.4 × 76 (NEMA 23) entra igual y mide Ø56.4;
 *   G. guardar (serializeDoc) → laboratorio limpio (226) → cargar: vuelven las dos, movidas;
 *   H. «quitar» la saca (y se lleva su movida); poner/quitar no apaga los focos ni rehace los golpes de otras piezas.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/piezas-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'piezas');
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
  const espera = (ms) => p.waitForTimeout(ms);
  const shot = (n) => p.screenshot({ path: path.join(OUT, n), timeout: 30000 });
  const taller = () => p.evaluate(() => { const t = window.__forgeBrep.taller; return { total: t.total, visibles: t.visibles, sel: t.sel, agarre: t.agarre }; });
  const caja = (k) => p.evaluate((key) => window.__forgeBrep.mover.caja(key), k);
  const talla = (c) => [0, 1, 2].map((i) => +(c.max[i] - c.min[i]).toFixed(3));
  const cam = async () => { const n = await p.evaluate(() => window.__forgeBrep.nav); return { pos: n.pos, t: n.target }; };
  const abrirLab = async () => {
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    await p.evaluate(() => document.querySelector('.lj-x')?.click());
    await espera(300);
  };
  const llenar = async (id, v) => { await p.fill(`[data-testid="${id}"]`, String(v)); };
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await abrirLab();

    // un golpe y un foco apagado ANTES: poner una pieza no debe rehacer el golpe ni prender el foco
    const OTRA = 'lab-alambre/alambre-pie-carrete';
    const cm = await p.evaluate((k) => window.__forgeBrep.yunque.caraMayor(k), OTRA);
    await p.evaluate((o) => window.__forgeBrep.yunque.golpear(o), { sobre: OTRA, cara: cm.cara, modo: 'unir', depth: 4, rect: [cm.ancla[0] - 3, cm.ancla[1] - 3, cm.ancla[0] + 3, cm.ancla[1] + 3] });
    await p.waitForFunction((k) => { const y = window.__forgeBrep.yunque; return !y.forjando && y.forjadas.includes(k); }, OTRA, { timeout: 240000 });
    const serie0 = await p.evaluate((k) => window.__forgeBrep.yunque.tiempos()[k].serie, OTRA);
    await p.click('[data-testid="ref-lab-placa"]');   // foco de «Placa soldada» apagado
    await espera(400);
    const t0 = await taller();
    const banco = await caja('lab-cuerpo');
    const c0 = await cam();

    // ── A. el formulario ──
    await p.click('[data-testid="pieza-poner"]');
    ok('A. «＋ poner una pieza comprada» abre el formulario', (await p.$('[data-testid="pieza-form"]')) !== null);
    await p.fill('[data-testid="pieza-nombre"]', 'Fuente S-1200-48');
    await llenar('pieza-w', 245); await llenar('pieza-d', 125); await llenar('pieza-h', 65);
    await shot('01-formulario.png');
    await p.click('[data-testid="pieza-agregar"]');
    await p.waitForFunction((n) => { const t = window.__forgeBrep.taller; return t.total === n + 1; }, t0.total, { timeout: 60000 });
    await espera(900);

    // ── B. está, agarrada, con sus medidas ──
    const K1 = 'mias/mia-1';
    const t1 = await taller(), k1 = await caja(K1);
    const txt = await p.$eval('[data-testid="taller-agarre"]', (e) => e.textContent).catch(() => '');
    ok('B. la pieza aparece en el Taller, agarrada, y mide 245 × 125 × 65', t1.total === t0.total + 1 && t1.sel && t1.sel.key === K1 && t1.sel.nivel === 'cuerpo' && JSON.stringify(talla(k1)) === '[245,125,65]' && /Fuente S-1200-48/.test(txt) && (await p.$(`[data-taller-key="${K1}"]`)) !== null,
      { total: t1.total, medidas: talla(k1), caja: txt.slice(0, 70) });

    // ── C. junto al banco, sin encimarse, y sin que la cámara brinque ni se prenda el foco apagado ──
    const todo = await p.evaluate(() => { const m = window.__forgeBrep.mover; const cs = ['lab-cuerpo', 'lab-placa', 'lab-alambre'].map((k) => m.caja(k)).filter(Boolean); return { maxX: Math.max(...cs.map((c) => c.max[0])), minZ: Math.min(...cs.map((c) => c.min[2])) }; });
    const c1 = await cam();
    const serie1 = await p.evaluate((k) => window.__forgeBrep.yunque.tiempos()[k].serie, OTRA);
    ok('C. nace junto al banco (a 40 mm), sobre el piso; la cámara no brinca; el foco apagado sigue apagado; el golpe de otra pieza no se rehízo',
      Math.abs(k1.min[0] - (todo.maxX + 40)) < 0.01 && Math.abs(k1.min[2] - Math.max(0, todo.minZ)) < 0.01 && Math.hypot(c1.pos[0] - c0.pos[0], c1.pos[1] - c0.pos[1], c1.pos[2] - c0.pos[2]) < 0.5 && t1.visibles === t0.visibles + 1 && serie1 === serie0,
      { separacion_mm: +(k1.min[0] - todo.maxX).toFixed(2), piso_z: k1.min[2], camara_se_movio_mm: +Math.hypot(c1.pos[0] - c0.pos[0], c1.pos[1] - c0.pos[1], c1.pos[2] - c0.pos[2]).toFixed(2), visibles: [t0.visibles, t1.visibles], forjas: [serie0, serie1] });
    await shot('02-fuente-junto-al-banco.png');

    // ── D. se mueve ──
    await p.fill('[data-testid="mover-x"]', '-300'); await p.keyboard.press('Enter'); await espera(600);
    const k2 = await caja(K1);
    ok('D. se mueve con «mover»: ΔX = −300', Math.abs(k2.min[0] - (k1.min[0] - 300)) < 0.01 && JSON.stringify(talla(k2)) === '[245,125,65]', { x: [k1.min[0], k2.min[0]] });

    // ── E. es comprada: su cara solo ofrece «Cuerpo nuevo» ──
    const cmF = await p.evaluate((k) => window.__forgeBrep.yunque.caraMayor(k), K1);
    ok('E. es una pieza comprada: no se une ni se corta', cmF && cmF.forjable === false && Math.abs(cmF.area - 245 * 125) < 1, cmF && { cara_mm2: Math.round(cmF.area), forjable: cmF.forjable });

    // ── F. un cilindro (NEMA 23: Ø56.4 × 76) ──
    await p.click('[data-testid="pieza-poner"]');
    await p.click('[data-testid="pieza-tipo-cilindro"]');
    await p.fill('[data-testid="pieza-nombre"]', 'NEMA 23');
    await llenar('pieza-w', 56.4); await llenar('pieza-h', 76);
    await p.click('[data-testid="pieza-agregar"]');
    await p.waitForFunction((n) => window.__forgeBrep.taller.total === n + 2, t0.total, { timeout: 60000 });
    await espera(900);
    const K2 = 'mias/mia-2', k3 = await caja(K2), tC = talla(k3);
    ok('F. un cilindro Ø56.4 × 76 entra igual', Math.abs(tC[0] - 56.4) < 0.1 && Math.abs(tC[1] - 56.4) < 0.1 && Math.abs(tC[2] - 76) < 0.01 && (await taller()).sel.key === K2, { medidas: tC });
    await shot('03-fuente-y-motor.png');

    // ── G. guardar → limpio → cargar ──
    const guardado = await p.evaluate(() => JSON.stringify(window.__forgeBrep.serializeDoc()));
    await abrirLab();
    const tL = await taller();
    await p.evaluate((t) => window.__forgeBrep.loadDoc(JSON.parse(t)), guardado);
    await p.waitForFunction((n) => { const t = window.__forgeBrep.taller; return t.total === n + 2 && t.visibles === t.total; }, t0.total, { timeout: 180000 });
    await espera(1500);
    const kG = await caja(K1);
    ok('G. el laboratorio limpio no las trae; lo guardado regresa las dos, con la fuente donde se movió', tL.total === t0.total && kG && Math.abs(kG.min[0] - k2.min[0]) < 0.01 && JSON.stringify(talla(kG)) === '[245,125,65]' && (await caja(K2)) !== null, { limpio: tL.total, x_de_la_fuente: kG && kG.min[0] });

    // ── H. quitar ──
    await p.evaluate(() => document.querySelector('.lj-x')?.click());
    if (!(await p.$(`[data-testid="taller-${K1}"]`))) await p.click('[data-testid="taller-abrir-mias"]');
    await espera(300);
    await p.click(`[data-testid="taller-${K1}"]`); await espera(300);
    await p.click('[data-testid="pieza-quitar"]');
    await p.waitForFunction((n) => window.__forgeBrep.taller.total === n + 1, t0.total, { timeout: 60000 });
    await espera(600);
    const mov = await p.evaluate(() => window.__forgeBrep.mover.movidas);
    ok('H. «quitar» saca la fuente y se lleva su movida; el motor se queda', (await caja(K1)) === null && (await caja(K2)) !== null && !(K1 in mov), { movidas: mov });
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
    await shot('99-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'piezas-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nPIEZAS_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
