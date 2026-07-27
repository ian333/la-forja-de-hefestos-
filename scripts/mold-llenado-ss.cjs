/**
 * EL LLENADO, VISTO CON LOS OJOS — "revisa la animación porque no es real y no veo cómo
 * pasa por los canales" (user 2026-07-15).
 *
 * La inyección dura ~0.35 s de un ciclo de ~35 s: **el 1 % de los cuadros**. A tiempo real
 * verificarla a ojo era cuestión de suerte — por eso el bug vivió tanto. Esta captura
 * CAMINA el proceso con `window.__cycleStep(dt)` (determinista) y en cada parada:
 *   · lee el estado (fase, feedFrac, fillFrac, presión)
 *   · captura el cuadro
 * El check que manda: durante el llenado del BEBEDERO la cavidad debe estar en CERO —
 * o sea, el plástico se ve PASAR por los canales antes de entrar.
 *
 * Uso: [SOFT=1] node scripts/mold-llenado-ss.cjs <outdir> [etiqueta]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const clickDom = async (p, sel) => p.$eval(sel, (el) => el.click()).catch(() => null);

(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/llenado';
  const tag = process.argv[3] || 'llenado';
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

  const gpu = await p.evaluate(() => {
    const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'sin webgl';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '?';
  });
  console.log(`  renderer: ${gpu}`);

  // OJO: `mold-sim-toggle` es el TÉRMICO. La simulación del CICLO (la que inyecta) es
  // `btn-cycle-sim` → monta MoldCycleSim, que es un chunk LAZY: hay que esperar a que
  // baje y monte antes de buscar el gancho.
  // …y `btn-cycle-sim` NO existe hasta abrir la pestaña SIMULACIÓN (medido con un probe
  // al DOM: los únicos testids de ciclo son `tab-simulacion` y `mold-sim-toggle`).
  await clickDom(p, '[data-testid="tab-simulacion"]');
  await p.waitForTimeout(1200);
  await p.waitForSelector('[data-testid="btn-cycle-sim"]', { timeout: 20000 }).catch(() => null);
  await clickDom(p, '[data-testid="btn-cycle-sim"]');
  await p.waitForFunction(() => typeof (window).__cycleStep === 'function', { timeout: 45000 })
    .catch(() => null);
  await p.waitForTimeout(1500);
  const vivo = await p.evaluate(() => typeof (window).__cycleStep === 'function');
  console.log(`  gancho __cycleStep: ${vivo ? 'vivo' : 'AUSENTE'}`);
  if (!vivo) { console.log('❌ sin gancho no hay captura determinista'); await b.close(); process.exit(1); }

  const paso = async (dt) => {
    await p.evaluate((d) => (window).__cycleStep(d), dt);
    await p.waitForTimeout(90);
    return p.evaluate(() => {
      const s = (window).__cycleSimState;
      return s ? { fase: s.phase, feed: s.feedFrac, fill: s.fillFrac, P: s.pressureMPa } : null;
    });
  };

  // La sim AUTOARRANCA: para cuando uno empieza a muestrear, la inyección de este ciclo
  // ya pasó y la siguiente está a ~36 s. Por eso: pasos GRUESOS hasta caer en 'cierre'
  // (la fase justo ANTES de inyectar) y a partir de ahí pasos FINOS. Sin esto, capturar
  // la inyección es esperar a que la lotería caiga en el 1 % de los cuadros.
  let s0 = null;
  for (let i = 0; i < 200 && (!s0 || s0.fase !== 'cierre'); i++) s0 = await paso(0.35);
  console.log(`  posicionado en la fase: ${s0?.fase ?? '?'} (la de antes de inyectar)`);

  const filas = [];
  let n = 0;
  for (let i = 0; i < 260; i++) {
    const s = await paso(0.012);                              // 12 ms de proceso por paso
    if (!s) continue;
    const enLlenado = s.fase === 'inyeccion';
    if (enLlenado && n < 6) {
      const f = path.join(dir, `${tag}-${String(n).padStart(2, '0')}.png`);
      await p.screenshot({ path: f, timeout: 30000 });
      filas.push({ ...s, png: path.basename(f) });
      console.log(`  ${s.fase.padEnd(11)} bebedero ${(100 * s.feed).toFixed(0).padStart(3)}% · cavidad ${(100 * s.fill).toFixed(0).padStart(3)}% · P ${s.P.toFixed(1)} MPa  → ${path.basename(f)}`);
      n++;
    }
    if (n >= 6 && s.fase !== 'inyeccion') break;
  }

  // ── LOS CHECKS ───────────────────────────────────────────────────────────
  let fails = 0;
  const check = (nm, c, d) => { console.log(` ${c ? '✓' : '❌'} ${nm} — ${d}`); if (!c) fails++; };
  console.log('');
  check('se capturó la INYECCIÓN (0.35 s de un ciclo de 35: antes era suerte)', filas.length > 0, `${filas.length} cuadros`);
  const enCanal = filas.filter((r) => r.feed < 1);
  if (enCanal.length) {
    check('mientras el fundido baja el BEBEDERO, la cavidad está VACÍA',
      enCanal.every((r) => r.fill === 0), `feedFrac ${enCanal.map((r) => (100 * r.feed).toFixed(0) + '%').join(',')} con cavidad en 0`);
  }
  check('la presión CRECE al avanzar el frente (no es constante)',
    filas.length > 1 && filas[filas.length - 1].P > filas[0].P, `${filas[0]?.P.toFixed(1)} → ${filas[filas.length - 1]?.P.toFixed(1)} MPa`);
  check('cero errores de consola', errs.length === 0, errs.length ? errs[0] : 'limpio');

  fs.writeFileSync(path.join(dir, `${tag}.json`), JSON.stringify({ url, gpu, filas, errs }, null, 2));
  console.log(`\n${fails ? `❌ ${fails} fallaron` : '✓ EL LLENADO SE VE: el plástico pasa por el bebedero ANTES de entrar a la cavidad'} → ${dir}`);
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SS_FATAL', String(e && e.stack || e).slice(0, 300)); process.exit(1); });
