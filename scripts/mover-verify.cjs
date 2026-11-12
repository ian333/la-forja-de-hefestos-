#!/usr/bin/env node
/**
 * MOVER PIEZAS — verificación con navegador y GPU real (orden 2026-11-11-mover-piezas).
 * Abre «LABORATORIO v2 · generado» y prueba:
 *   A. teclear ΔX = 30 a una PIEZA (módulo del alambre): la caja de todo lo suyo se corre 30.00 mm en X; lo demás no;
 *   B. las flechas en el visor: arrastrar la de X con el mouse cambia ΔX y deja ΔY = ΔZ = 0;
 *   C. mover un CUERPO dentro de la pieza ya movida: los corrimientos se suman;
 *   D. golpe DESPUÉS de mover: el saliente cae sobre la cara donde está AHORA la pieza (la caja no brinca de regreso);
 *   E. mover DESPUÉS de golpear: la pieza forjada se va entera, mismo volumen;
 *   F. Ctrl+Z regresa el último movimiento;  G. guardar → laboratorio limpio → cargar: todo vuelve movido;
 *   H. «regresar a su sitio» pone la pieza en cero.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/mover-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'mover');
const checks = [];
const ok = (nombre, pasa, dato) => { checks.push({ nombre, pasa: !!pasa, dato }); console.log(`${pasa ? 'PASA' : 'FALLA'}  ${nombre}${dato !== undefined ? '  · ' + JSON.stringify(dato) : ''}`); };
const PIEZA = 'lab-alambre', OTRA = 'lab-placa', CUERPO = 'lab-alambre/alambre-pie-carrete';

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
  const caja = (k) => p.evaluate((key) => window.__forgeBrep.mover.caja(key), k);
  const mv = () => p.evaluate(() => window.__forgeBrep.mover.movidas);
  const de = (k) => p.evaluate((key) => window.__forgeBrep.mover.de(key), k);
  const corr = (a, c) => [0, 1, 2].map((i) => +(c.min[i] - a.min[i]).toFixed(3));           // cuánto se corrió la esquina mínima
  const mismaTalla = (a, c) => [0, 1, 2].every((i) => Math.abs((c.max[i] - c.min[i]) - (a.max[i] - a.min[i])) < 0.01);
  const abrirLab = async () => {
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    await p.evaluate(() => document.querySelector('.lj-x')?.click());
    await espera(300);
  };
  const teclear = async (eje, v) => { await p.fill(`[data-testid="mover-${eje}"]`, String(v)); await p.keyboard.press('Enter'); await espera(500); };
  const tecla = async (t) => { await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await p.keyboard.press(t); await espera(400); };
  const kv = (k) => p.evaluate((key) => window.__forgeBrep.yunque.tiempos()[key] || null, k);
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await abrirLab();
    const c0 = await caja(PIEZA), o0 = await caja(OTRA), k0 = await caja(CUERPO);

    // ── A. teclear ΔX = 30 a la pieza ──
    await p.click(`[data-testid="taller-${PIEZA}"]`);
    await espera(300);
    ok('con una pieza agarrada, El Taller ofrece «mover»', (await p.$('[data-testid="taller-mover"]')) !== null);
    await teclear('x', 30);
    const c1 = await caja(PIEZA), o1 = await caja(OTRA);
    ok('A. ΔX = 30: la caja de la pieza se corre 30.00 mm en X, y solo ella', JSON.stringify(corr(c0, c1)) === '[30,0,0]' && mismaTalla(c0, c1) && JSON.stringify(corr(o0, o1)) === '[0,0,0]',
      { pieza: corr(c0, c1), otra: corr(o0, o1), movidas: await mv() });
    await shot('01-pieza-corrida-30.png');

    // ── B. las flechas ──
    await p.click('[data-testid="mover-flechas"]');
    await espera(700);
    await shot('02-flechas.png');
    let arrastro = null;
    for (const lejos of [70, 45, 100, 130]) {
      const s = await p.evaluate((k) => window.__forgeBrep.mover.pantalla(k), PIEZA);
      const dx = s.x[0] - s.c[0], dy = s.x[1] - s.c[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const x0 = s.c[0] + ux * lejos, y0 = s.c[1] + uy * lejos;
      const antes = (await mv())[PIEZA];
      await p.mouse.move(x0 - 6, y0 - 6); await p.mouse.move(x0, y0, { steps: 3 }); await espera(200);
      await p.mouse.down();
      await p.mouse.move(x0 + ux * 60, y0 + uy * 60, { steps: 8 }); await p.mouse.move(x0 + ux * 120, y0 + uy * 120, { steps: 8 });
      await espera(150);
      await p.mouse.up();
      await espera(700);
      const despues = (await mv())[PIEZA];
      if (despues && Math.abs(despues[0] - antes[0]) > 1) { arrastro = { lejos, antes, despues }; break; }
    }
    const sel = await p.evaluate(() => window.__forgeBrep.taller.sel);
    ok('B. arrastrar la flecha X: ΔX crece, ΔY = ΔZ = 0, y la pieza sigue agarrada', arrastro && arrastro.despues[0] > arrastro.antes[0] + 1 && arrastro.despues[1] === 0 && arrastro.despues[2] === 0 && sel && sel.key === PIEZA, arrastro);
    const dxPieza = ((await mv())[PIEZA] || [0])[0];
    const c2 = await caja(PIEZA);
    ok('B. …y la caja quedó donde dice el número', Math.abs(corr(c0, c2)[0] - dxPieza) < 0.01 && mismaTalla(c0, c2), { caja: corr(c0, c2), numero: dxPieza });
    await shot('03-tras-arrastrar.png');
    await p.click('[data-testid="mover-flechas"]');

    // ── C. un cuerpo dentro de la pieza movida ──
    if (!(await p.$(`[data-testid="taller-${CUERPO}"]`))) await p.click(`[data-testid="taller-abrir-${PIEZA}"]`);
    await espera(300);
    await p.click(`[data-testid="taller-${CUERPO}"]`);
    await espera(300);
    await teclear('z', 12);
    const k1 = await caja(CUERPO), suma = await de(CUERPO);
    ok('C. cuerpo dentro de la pieza: los corrimientos se suman (pieza X + cuerpo Z)', JSON.stringify(suma) === JSON.stringify([dxPieza, 0, 12]) && JSON.stringify(corr(k0, k1)) === JSON.stringify([dxPieza, 0, 12]), { suma, caja: corr(k0, k1) });

    // ── D. golpe DESPUÉS de mover ──
    const cm = await p.evaluate((k) => window.__forgeBrep.yunque.caraMayor(k), CUERPO);
    const id = await p.evaluate((o) => window.__forgeBrep.yunque.golpear(o), { sobre: CUERPO, cara: cm.cara, modo: 'unir', depth: 5, rect: [cm.ancla[0] - 5, cm.ancla[1] - 5, cm.ancla[0] + 5, cm.ancla[1] + 5] });
    await p.waitForFunction((k) => { const y = window.__forgeBrep.yunque; return !y.forjando && y.forjadas.includes(k); }, CUERPO, { timeout: 240000 });
    await espera(400);
    const k2 = await caja(CUERPO), t2 = await kv(CUERPO);
    const crece = [0, 1, 2].map((i) => +((k2.max[i] - k2.min[i]) - (k1.max[i] - k1.min[i])).toFixed(2));
    const brinco = [0, 1, 2].map((i) => +Math.max(Math.abs(k2.min[i] - k1.min[i]), Math.abs(k2.max[i] - k1.max[i])).toFixed(2));
    const yq = await p.evaluate(() => window.__forgeBrep.yunque.errores);
    ok('D. golpe después de mover: el saliente (≤ 500 mm³) cae sobre la pieza donde está AHORA', !!id && t2 && t2.vol - t2.volBase > 0 && t2.vol - t2.volBase <= 500.01 && brinco.every((v) => v <= 10.01) && !Object.keys(yq).length,
      { subio_mm3: t2 && +(t2.vol - t2.volBase).toFixed(1), la_caja_crece: crece, lo_mas_que_se_movio_un_borde: brinco, errores: yq });
    await shot('04-golpe-sobre-pieza-movida.png');

    // ── E. mover DESPUÉS de golpear ──
    await p.keyboard.press('Escape'); await p.click(`[data-testid="taller-${CUERPO}"]`); await espera(300);
    await teclear('y', -20);
    const k3 = await caja(CUERPO), t3 = await kv(CUERPO);
    ok('E. mover después de golpear: la pieza forjada se va entera 20 mm en −Y, mismo volumen', JSON.stringify(corr(k2, k3)) === '[0,-20,0]' && mismaTalla(k2, k3) && Math.abs(t3.vol - t2.vol) < 0.01, { caja: corr(k2, k3), volumen: Math.round(t3.vol) });

    // ── F. Ctrl+Z ──
    await tecla('Control+z');
    const k4 = await caja(CUERPO);
    ok('F. Ctrl+Z regresa el último movimiento', JSON.stringify(corr(k2, k4)) === '[0,0,0]', { caja: corr(k2, k4), movidas: await mv() });

    // ── G. guardar → limpio → cargar ──
    const guardado = await p.evaluate(() => JSON.stringify(window.__forgeBrep.serializeDoc()));
    const movGuardadas = JSON.parse(guardado).movidas;
    await abrirLab();
    const cL = await caja(PIEZA);
    ok('G. el laboratorio recién abierto está en su sitio', JSON.stringify(corr(c0, cL)) === '[0,0,0]' && Object.keys(await mv()).length === 0, { movidas: await mv() });
    await p.evaluate((t) => window.__forgeBrep.loadDoc(JSON.parse(t)), guardado);
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await p.waitForFunction((k) => { const y = window.__forgeBrep.yunque; return !y.forjando && y.forjadas.includes(k); }, CUERPO, { timeout: 240000 });
    await espera(1500);
    const cG = await caja(PIEZA), kG = await caja(CUERPO);
    ok('G. lo guardado vuelve movido y forjado (misma caja que antes de guardar)', JSON.stringify(movGuardadas) === JSON.stringify(await mv()) && Math.abs(corr(c0, cG)[0] - dxPieza) < 0.01 && JSON.stringify(corr(k4, kG)) === '[0,0,0]' && mismaTalla(k4, kG),
      { movidas: await mv(), cuerpo: corr(k4, kG) });
    await p.evaluate(() => document.querySelector('.lj-x')?.click());
    await shot('05-recargado.png');

    // ── H. regresar a su sitio ──
    await p.click(`[data-testid="taller-${PIEZA}"]`);
    await espera(300);
    await p.click('[data-testid="mover-regresar"]');
    await espera(500);
    const m9 = await mv();
    ok('H. «regresar a su sitio» deja la pieza en cero (el cuerpo conserva lo suyo)', !m9[PIEZA] && JSON.stringify(m9[CUERPO]) === '[0,0,12]', m9);
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
    await shot('99-falla.png').catch(() => {});
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'mover-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nMOVER_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
