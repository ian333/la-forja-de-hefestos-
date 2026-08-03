/**
 * verify-telemetria.cjs — PRUEBA QUE LOS EVENTOS LLEGAN.
 *
 * "Compila" no es "sirve": la telemetría puede estar perfectamente escrita y
 * no mandar nada (le pasó al laboratorio, que estuvo CIEGO semanas porque a
 * `lab-main.tsx` le faltaba el `import './lib/telemetry'`, y nadie lo notó
 * porque nada falla visiblemente cuando la medición no existe).
 *
 * Este arnés maneja el lab como una persona —toca 3 elementos, cambia de
 * pestaña, gira la escena, se va— INTERCEPTA las peticiones a
 * /api/telemetry/events y verifica la FORMA de cada evento con nombre.
 *
 *   node scripts/verify-telemetria.cjs                       # contra :4173
 *   node scripts/verify-telemetria.cjs --url http://host:pto
 *
 * Sale con código 1 si falta cualquier evento o si un campo no cuadra.
 */
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const BASE = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:4173';
// Una URL de anuncio REAL de Instagram: si el fbclid sobrevive al filtro, el
// log se vuelve a ensuciar y este arnés tiene que gritarlo.
const CAMPANA = '?utm_source=ig&utm_medium=paid&utm_campaign=120246753788750519&utm_content=AD_TEST&fbclid=PAZXh0bgNhZW0BMABhZGlkAaszyRVLKWdzcnRj';

const eventos = [];
let fallos = 0;
const ok = (cond, msg, extra) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}${extra !== undefined && !cond ? `  → ${JSON.stringify(extra)}` : ''}`);
  if (!cond) fallos++;
};
const de = (tipo) => eventos.filter((e) => e.type === tipo);

(async () => {
  const browser = await chromium.launch({
    headless: false,   // GPU real (ver CLAUDE.md): headless puro cae a SwiftShader
    args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  // CAPTURA: `request` ve el POST venga de fetch o de sendBeacon; `route` lo
  // contesta 200 para que el 404 del preview no dispare eventos http_error
  // que contaminarían la propia medición.
  page.on('request', (req) => {
    if (!req.url().includes('/api/telemetry/events') || req.method() !== 'POST') return;
    try { for (const e of JSON.parse(req.postData() || '[]')) eventos.push(e); } catch { /* cuerpo raro */ }
  });
  await page.route('**/api/telemetry/events', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));

  console.log(`\n═══ SESIÓN SIMULADA · ${BASE}/lab.html ═══`);
  await page.goto(`${BASE}/lab.html${CAMPANA}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('button[data-z="26"]', { timeout: 30000 });
  await page.waitForTimeout(2500);

  // 1) Tres elementos DISTINTOS desde la tabla periódica.
  for (const z of [26, 8, 79]) {
    await page.click(`button[data-z="${z}"]`);
    await page.waitForTimeout(400);
  }
  // 2) Un cuarto por los botones ← → (para probar la vía `nav`).
  await page.click('button:has-text("Siguiente")').catch(() => {});
  await page.waitForTimeout(400);
  // 3) Cambio de vista del átomo.
  await page.click('button:has-text("ψ Lab")').catch(() => {});
  await page.waitForTimeout(600);
  // 4) Girar la escena con el dedo.
  const hero = await page.$('main');
  const box = hero && await hero.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2 + i * 4);
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  // 5) Cambio de pestaña + una molécula.
  await page.click('button:has-text("Molécula")');
  await page.waitForTimeout(1500);
  await page.click('button:has-text("NH₃")').catch(() => page.click('button:has-text("CO₂")').catch(() => {}));
  await page.waitForTimeout(600);
  await page.click('button:has-text("Enlace")').catch(() => {});
  await page.waitForTimeout(1200);

  // 6) SE VA: pasa a segundo plano → dispara `salida` + `vitals` + flush.
  //    Se lanzan LOS DOS eventos que dispara un cierre real (visibilitychange
  //    y pagehide) justamente para comprobar que `salida` no sale duplicado.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
  });
  await page.waitForTimeout(2500);

  // ── VERIFICACIÓN ───────────────────────────────────────────────────
  console.log(`\n═══ EVENTOS RECIBIDOS: ${eventos.length} ═══`);
  const tipos = new Map();
  for (const e of eventos) tipos.set(e.type, (tipos.get(e.type) || 0) + 1);
  console.log('  ' + [...tipos].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join(' · '));

  console.log('\n── pageview del laboratorio ──');
  ok(de('pageview').length >= 1, '/lab.html emite pageview (antes: CERO en toda la historia)');

  console.log('\n── origen ──');
  const or = de('origen')[0];
  ok(!!or, 'existe el evento `origen`');
  ok(or?.data?.fuente === 'paid', 'fuente = paid (lo detectó por utm_medium + fbclid)', or?.data);
  ok(or?.data?.campana === '120246753788750519', 'campaña normalizada', or?.data?.campana);
  ok(de('origen').length === 1, 'se emite UNA sola vez por sesión', de('origen').length);
  ok(eventos.every((e) => !/fbclid|utm_/.test(e.url || '')), 'NINGÚN evento arrastra fbclid/utm en su url',
    eventos.find((e) => /fbclid|utm_/.test(e.url || ''))?.url);

  console.log('\n── lab.elemento ──');
  const els = de('lab.elemento');
  ok(els.length >= 3, `se registraron ${els.length} selecciones de elemento`);
  ok(els.every((e) => typeof e.data?.Z === 'number' && typeof e.data?.simbolo === 'string' && typeof e.data?.nOrdinal === 'number'),
    'todos traen {Z, simbolo, nOrdinal}', els[0]?.data);
  const ords = els.map((e) => e.data.nOrdinal);
  ok(Math.max(...ords) >= 3, `nOrdinal llega a ${Math.max(...ords)} — cuenta elementos DISTINTOS`, ords);
  ok(els.some((e) => e.data.via === 'tabla') && els.some((e) => e.data.via === 'nav'),
    'distingue la vía: tabla periódica vs botones ← →', els.map((e) => e.data.via));
  console.log('    ' + els.map((e) => `${e.data.simbolo}(Z=${e.data.Z},n=${e.data.nOrdinal},${e.data.via})`).join(' '));

  console.log('\n── lab.tab ──');
  const tabs = de('lab.tab');
  ok(tabs.length >= 1, `${tabs.length} cambios de pestaña`);
  ok(tabs.every((e) => e.data?.de && e.data?.a && e.data.de !== e.data.a), 'traen {de, a} y no se auto-repiten',
    tabs.map((e) => `${e.data?.de}→${e.data?.a}`));
  console.log('    ' + tabs.map((e) => `${e.data.de}→${e.data.a}`).join(' · '));

  console.log('\n── lab.vista ──');
  ok(de('lab.vista').length >= 1, 'el toggle ψ Lab ↔ ✦ Cinematic se registra', de('lab.vista')[0]?.data);

  console.log('\n── lab.orbita ──');
  ok(de('lab.orbita').length === 1, 'se emite EXACTAMENTE una vez (es "empezó a jugar")', de('lab.orbita').length);
  ok(!!de('lab.orbita')[0]?.data?.tab, 'dice en qué pestaña ocurrió', de('lab.orbita')[0]?.data);
  ok(de('lab.orbita').every((e) => !('x' in (e.data || {})) && !('y' in (e.data || {}))),
    'NO guarda coordenadas del gesto (sin reconstrucción de sesión)');

  console.log('\n── lab.audio / lab.molecula ──');
  ok(de('lab.audio').length >= 1, 'la narración reporta play/fin/bloqueado', de('lab.audio').map((e) => e.data?.accion));
  ok(de('lab.molecula').length >= 1, 'la galería de moléculas reporta qué se tocó', de('lab.molecula')[0]?.data);

  console.log('\n── vitals ──');
  const v = de('vitals')[0];
  console.log('    payload: ' + JSON.stringify(v?.data));
  ok(!!v, 'existe el evento `vitals`');
  ok(typeof v?.data?.lcp === 'number' && v.data.lcp > 0, `LCP medido: ${v?.data?.lcp} ms`, v?.data);
  ok(typeof v?.data?.fcp === 'number', `FCP medido: ${v?.data?.fcp} ms`);
  ok(typeof v?.data?.cls === 'number' || v?.data?.cls === undefined, 'CLS presente o legítimamente ausente');
  ok(typeof v?.data?.tpi === 'number', `1ª interacción a los ${v?.data?.tpi} ms`, v?.data);
  ok(v?.data?.toco === true, 'marca que la sesión SÍ interactuó');
  ok(de('vitals').length === 1, 'se manda UNA vez, no una por métrica', de('vitals').length);

  console.log('\n── salida ──');
  const s = de('salida')[0];
  ok(!!s, 'existe el evento `salida`');
  ok(typeof s?.data?.s === 'number' && s.data.s > 0, `segundos VISIBLES: ${s?.data?.s} (no derivados del último evento)`, s?.data);
  ok(typeof s?.data?.inter === 'number' && s.data.inter > 0, `interacciones contadas: ${s?.data?.inter}`);
  ok(s?.data?.seccion?.startsWith('lab:'), `sección de salida: ${s?.data?.seccion}`, s?.data);
  ok(!('scroll' in (s?.data || {})), 'el lab NO scrollea → no inventa un 100 % de profundidad', s?.data?.scroll);
  ok(de('salida').length === 1, 'UN solo `salida` (visibilitychange y pagehide no lo duplican)', de('salida').length);

  console.log('\n── higiene (nada de PII nueva) ──');
  const cuerpo = JSON.stringify(eventos);
  ok(!/"key(down|press)"|"input"|"keys"/.test(cuerpo), 'sin teclas ni contenido de inputs');
  ok(!de('lab.elemento').some((e) => 'x' in e.data || 'y' in e.data), 'los eventos con nombre no llevan coordenadas');

  // ── Profundidad de scroll: se prueba en el atrio, que SÍ scrollea ──
  console.log(`\n═══ SEGUNDA SESIÓN · ${BASE}/ (scroll + secciones) ═══`);
  eventos.length = 0;
  const p2 = await ctx.newPage();
  p2.on('request', (req) => {
    if (!req.url().includes('/api/telemetry/events') || req.method() !== 'POST') return;
    try { for (const e of JSON.parse(req.postData() || '[]')) eventos.push(e); } catch { /* cuerpo raro */ }
  });
  await p2.route('**/api/telemetry/events', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await p2.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60000 });
  await p2.waitForTimeout(2000);
  for (let i = 0; i < 12; i++) { await p2.mouse.wheel(0, 700); await p2.waitForTimeout(150); }
  await p2.waitForTimeout(1200);
  await p2.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p2.waitForTimeout(2000);
  const s2 = de('salida')[0];
  ok(!!s2, 'el atrio también emite `salida`');
  ok(typeof s2?.data?.scroll === 'number' && s2.data.scroll > 10, `scroll máximo: ${s2?.data?.scroll} %`, s2?.data);
  ok(!!s2?.data?.seccion, `sección de salida: ${s2?.data?.seccion}`, s2?.data);
  ok(de('origen')[0]?.data?.fuente === 'directo', 'sin utm ni referrer → fuente = directo', de('origen')[0]?.data);

  await browser.close();
  console.log(`\n${fallos === 0 ? '✓ TODO PASA' : `✗ ${fallos} FALLOS`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error('ARNÉS ROTO:', e); process.exit(1); });
