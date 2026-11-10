#!/usr/bin/env node
/**
 * TOUCHPAD + RADIAL CON 2 CLICS DERECHOS — verificación con navegador y GPU real (orden 2026-11-09-touchpad-y-radial).
 * Abre «LABORATORIO v2 · generado» y prueba sobre el visor:
 *   A. arrastre con el derecho MUEVE y NO abre el radial; un clic derecho quieto tampoco; dos seguidos SÍ;
 *   B. rueda de mouse (±100) = zoom; C. rueda de touchpad (deltas finos) = GIRAR; D. Shift + touchpad = MOVER;
 *   E. pellizco (ctrl + rueda) = zoom; F. el chip fuerza Mouse / Touchpad.
 * Uso (iangpu, vite DEV vivo):
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA node scripts/navegacion-verify.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.env.URL || 'http://localhost:5009/forja-brep.html';
const OUT = process.env.OUT || path.resolve(__dirname, '..', 'forja-shots', 'navegacion');
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
  // cámara en números: distancia al blanco, azimut y elevación (grados), y el blanco
  const cam = async () => {
    const n = await p.evaluate(() => window.__forgeBrep.nav);
    const o = [n.pos[0] - n.target[0], n.pos[1] - n.target[1], n.pos[2] - n.target[2]];
    const d = Math.hypot(...o);
    return { modo: n.modo, visto: n.visto, d, az: (Math.atan2(o[0], o[2]) * 180) / Math.PI, el: (Math.asin(o[1] / d) * 180) / Math.PI, t: n.target };
  };
  const dT = (a, b2) => Math.hypot(a.t[0] - b2.t[0], a.t[1] - b2.t[1], a.t[2] - b2.t[2]);
  const dAng = (a, b2) => Math.hypot(((a.az - b2.az + 540) % 360) - 180, a.el - b2.el);
  const radial = async () => (await p.$('[data-testid="radial-menu"]')) !== null;
  const chip = () => p.$eval('[data-testid="nav-modo"]', (e) => ({ modo: e.dataset.modo, activo: e.dataset.activo, txt: e.textContent }));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.curso && document.querySelector("canvas"))', null, { timeout: 180000 });
    const gl = await p.evaluate(() => {
      const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info');
      return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?';
    });
    ok('GPU real (no SwiftShader/llvmpipe)', !/swiftshader|llvmpipe/i.test(gl), gl);
    await p.click('[data-testid="doc-switcher"]');
    await p.click('[data-testid="ps-open-st-laboratorio"]');
    await p.waitForFunction(() => { const t = window.__forgeBrep.taller; return t && t.total > 200 && t.visibles === t.total; }, null, { timeout: 180000 });
    await espera(3500);
    const vp = await p.$eval('.fb-viewport', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const cx = vp.x + vp.w * 0.45, cy = vp.y + vp.h * 0.5;
    await p.mouse.move(cx, cy);
    let c0 = await cam();
    ok('arranca en Auto', c0.modo === 'auto', await chip());

    // ── A. el botón derecho ──
    await p.mouse.down({ button: 'right' });
    await p.mouse.move(cx + 60, cy + 20, { steps: 6 });
    await p.mouse.move(cx + 140, cy + 50, { steps: 6 });
    await p.mouse.up({ button: 'right' });
    await espera(900);
    let c1 = await cam();
    ok('A. arrastre con el derecho MUEVE la vista', dT(c0, c1) > 1 && dAng(c0, c1) < 0.5, { movio_mm: +dT(c0, c1).toFixed(1) });
    ok('A. …y NO abre el radial', !(await radial()));
    await p.mouse.click(cx, cy, { button: 'right' });
    await espera(700);
    ok('A. un clic derecho quieto NO abre el radial', !(await radial()));
    await p.mouse.click(cx, cy, { button: 'right' });
    await espera(120);
    await p.mouse.click(cx, cy, { button: 'right' });
    await espera(350);
    ok('A. DOS clics derechos abren el radial', await radial());
    await shot('01-radial-doble-clic.png');
    await p.keyboard.press('Escape');
    await espera(300);
    ok('A. Esc lo cierra', !(await radial()));

    // ── B. rueda de mouse = zoom ──
    c0 = await cam();
    for (let i = 0; i < 3; i++) { await p.mouse.wheel(0, -100); await espera(60); }
    await espera(900);
    c1 = await cam();
    ok('B. rueda de mouse (±100) = ZOOM y se ve «mouse»', c1.d < c0.d * 0.97 && c1.visto === 'mouse' && dAng(c0, c1) < 0.5, { d0: Math.round(c0.d), d1: Math.round(c1.d) });

    // ── C. touchpad: dos dedos = girar ──
    await espera(500);
    c0 = await cam();
    for (let i = 0; i < 20; i++) { await p.mouse.wheel(7, 2); await espera(16); }
    await espera(700);
    c1 = await cam();
    ok('C. dos dedos GIRAN (misma distancia, mismo blanco)', dAng(c0, c1) > 15 && Math.abs(c1.d / c0.d - 1) < 0.002 && dT(c0, c1) < 0.01 && c1.visto === 'touchpad',
      { giro_grados: +dAng(c0, c1).toFixed(1), d0: Math.round(c0.d), d1: Math.round(c1.d), chip: await chip() });
    await shot('02-touchpad-giro.png');

    // ── D. Shift + dos dedos = mover ──
    c0 = await cam();
    await p.keyboard.down('Shift');
    for (let i = 0; i < 20; i++) { await p.mouse.wheel(6, 4); await espera(16); }
    await p.keyboard.up('Shift');
    await espera(700);
    c1 = await cam();
    ok('D. Shift + dos dedos MUEVEN (misma dirección de vista)', dT(c0, c1) > 5 && dAng(c0, c1) < 0.05 && Math.abs(c1.d / c0.d - 1) < 0.002, { movio_mm: +dT(c0, c1).toFixed(1) });

    // ── E. pellizco = zoom ──
    c0 = await cam();
    await p.keyboard.down('Control');
    for (let i = 0; i < 20; i++) { await p.mouse.wheel(0, 3); await espera(16); }
    await p.keyboard.up('Control');
    await espera(900);
    c1 = await cam();
    ok('E. pellizco (ctrl + rueda) = ZOOM', Math.abs(c1.d / c0.d - 1) > 0.03, { d0: Math.round(c0.d), d1: Math.round(c1.d) });

    // ── F. el chip manda ──
    await p.click('[data-testid="nav-modo"]');                     // auto → mouse
    await p.mouse.move(cx, cy);
    await espera(500);
    c0 = await cam();
    for (let i = 0; i < 12; i++) { await p.mouse.wheel(7, 2); await espera(16); }
    await espera(900);
    c1 = await cam();
    ok('F. chip en Mouse: los deltas finos ya NO giran', (await chip()).modo === 'mouse' && dAng(c0, c1) < 1.5, { giro_grados: +dAng(c0, c1).toFixed(2) });
    await p.click('[data-testid="nav-modo"]');                     // mouse → touchpad
    await p.mouse.move(cx, cy);
    await espera(500);
    c0 = await cam();
    await p.mouse.wheel(0, 100);
    await espera(700);
    c1 = await cam();
    ok('F. chip en Touchpad: hasta una muesca de ±100 gira', (await chip()).modo === 'touchpad' && dAng(c0, c1) > 10 && Math.abs(c1.d / c0.d - 1) < 0.002, { giro_grados: +dAng(c0, c1).toFixed(1) });
    await shot('03-chip-touchpad.png');
    await p.click('[data-testid="nav-modo"]');                     // touchpad → auto
    ok('F. el chip regresa a Auto', (await chip()).modo === 'auto', await chip());
  } catch (e) {
    ok('sin excepción', false, String(e).slice(0, 300));
  }
  ok('sin errores de página', errs.length === 0, errs.slice(0, 6));
  fs.writeFileSync(path.join(OUT, 'navegacion-verify.json'), JSON.stringify({ url: URL, checks, errs }, null, 2));
  const fallas = checks.filter((c) => !c.pasa).length;
  console.log(`\nNAVEGACION_VERIFY: ${fallas ? 'FALLA' : 'PASA'} (${checks.length - fallas}/${checks.length}) · capturas en ${OUT}`);
  await b.close();
  process.exit(fallas ? 1 : 0);
})();
