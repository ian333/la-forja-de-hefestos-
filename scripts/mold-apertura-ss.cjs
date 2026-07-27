/**
 * LA COTA DE LA APERTURA, VISTA CON LOS OJOS — "el movimiento debe de tener cota pues se
 * está calculando cuánto se abrirá, no?" (user 2026-07-15).
 *
 * Maneja la apertura con `window.__moldOpen(t)` (determinista) y en cada t:
 *   · captura el frame
 *   · LEE la etiqueta de la cota (que reporta la posición REAL de la placa A)
 * El check que manda: a t=1 la cota debe cerrar `apertura X / X mm` — la animación y el
 * estudio de acuerdo. Si divergen, la cota lo grita (para eso lee el sólido y no repite
 * el parámetro). "compila" ≠ "sirve": esto lo VE.
 *
 * Uso: [SOFT=1] [URL=…] node scripts/mold-apertura-ss.cjs <outdir> [etiqueta]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const clickDom = async (p, sel) => p.$eval(sel, (el) => el.click()).catch(() => null);

(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/apertura';
  const tag = process.argv[3] || 'apertura';
  fs.mkdirSync(dir, { recursive: true });
  const soft = process.env.SOFT === '1';
  const b = await chromium.launch({ headless: soft ? true : false,
    args: soft ? ['--no-sandbox'] : ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const p = await (await b.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForSelector('[data-testid="mold-parts-head"]', { timeout: Number(process.env.WAIT || 120000) });
  console.log('✓ molde vivo armado');

  // el renderer REAL (SwiftShader = la captura no vale para juzgar sombreado)
  const gpu = await p.evaluate(() => {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'sin webgl';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'sin debug_renderer_info';
  });
  console.log(`  renderer: ${gpu}`);

  await clickDom(p, '[data-testid="mold-cotas-toggle"]');       // 📐 prende las cotas
  await p.waitForTimeout(900);

  const leer = async () => p.$eval('[data-testid="cota-apertura"]',
    (el) => ({ txt: el.textContent, vis: el.style.display !== 'none', col: el.style.color })).catch(() => null);

  const filas = [];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    await p.evaluate((tt) => (window).__moldOpen?.(tt), t);
    await p.waitForTimeout(700);
    const c = await leer();
    const f = path.join(dir, `${tag}-t${String(t).replace('.', '_')}.png`);
    await p.screenshot({ path: f, timeout: 30000 });
    filas.push({ t, cota: c?.txt ?? '(sin cota)', vis: c?.vis, png: path.basename(f) });
    console.log(`  t=${t}  →  ${c?.txt ?? '(sin cota)'}   ${path.basename(f)}`);
  }
  await p.evaluate(() => (window).__moldOpen?.(null));           // suelta la animación

  // ── LOS CHECKS (números, no impresiones) ────────────────────────────────
  const num = (s) => { const m = /apertura\s+([\d.]+)\s*\/\s*([\d.]+)/.exec(s || ''); return m ? { hay: +m[1], debe: +m[2] } : null; };
  const t0 = num(filas[0].cota), t1 = num(filas[4].cota), tm = num(filas[2].cota);
  let fails = 0;
  const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

  console.log('');
  check('la cota de apertura EXISTE en pantalla', !!t1, filas[4].cota);
  if (t1) {
    check('cerrado (t=0) ⇒ apertura 0', t0 && t0.hay === 0, `${filas[0].cota}`);
    check('abierto (t=1) ⇒ la animación ALCANZA la carrera del estudio', t1.hay >= t1.debe - 0.5,
      `${t1.hay} / ${t1.debe} mm`);
    check('la carrera NO es el 80 inventado', t1.debe !== 80, `${t1.debe} mm (§6.3.2 = 2.5 × altura de pieza)`);
    check('a medio camino la cota se MUEVE (mide, no repite)', tm && tm.hay > 0 && tm.hay < t1.debe,
      `t=0.5 → ${tm?.hay} mm de ${t1.debe}`);
  }
  check('cero errores de consola', errs.length === 0, errs.length ? errs[0] : 'limpio');

  fs.writeFileSync(path.join(dir, `${tag}-cotas.json`), JSON.stringify({ url, gpu, filas, errs }, null, 2));
  console.log(`\n${fails ? `❌ ${fails} fallaron` : '✓ LA APERTURA ESTÁ COTADA y la animación cierra con el estudio'} → ${dir}`);
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SS_FATAL', String(e && e.stack || e).slice(0, 300)); process.exit(1); });
