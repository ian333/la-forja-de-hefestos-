/**
 * CORRE TODOS LOS BOTONCITOS — "haz todos los estudios de todos los botoncitos que estén
 * ahí: análisis de apertura, análisis de temperatura, rayos X. MIENTRAS MÁS INFO VEAS
 * MÁS ERRORES VERÁS" (user 2026-07-15).
 *
 * Abre el sitio de producción, prende cada estudio y captura + LEE el texto de cada
 * reporte. El texto es lo que permite auditar: un render enseña formas, los reportes
 * traen NÚMEROS. Método del user: PARTIR DE QUE ESTÁ MAL y buscar la contradicción.
 * Uso: [SOFT=1] node scripts/mold-estudios-ss.cjs <outdir> [etiqueta]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const clickDom = async (p, sel) => p.$eval(sel, (el) => el.click()).catch(() => null);
const textOf = async (p, sel) => p.$eval(sel, (el) => el.innerText).catch(() => null);

(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/estudios';
  const tag = process.argv[3] || 'molde';
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

  // ── inventario: ¿el interlock llegó al árbol? ─────────────────────────────
  const comps = await p.$$eval('[data-testid="mold-parts-list"] [data-testid^="mold-part-"]',
    (ds) => ds.map((d) => d.innerText.split('\n')[0]));
  console.log(`\nCOMPONENTES (${comps.length}):`);
  for (const c of comps) console.log(`  · ${c}`);
  const hayInterlock = comps.some((c) => /nterlock/i.test(c));
  console.log(hayInterlock ? '  ✓ los INTERLOCKS están en el árbol' : '  ❌ NO hay interlocks en el árbol');

  const shot = async (nm) => { const f = path.join(dir, `${tag}-${nm}.png`); await p.screenshot({ path: f, timeout: 40000 }); return f; };
  const out = [];

  // ── 1) RAYOS X: ver adentro sin cortar ────────────────────────────────────
  await clickDom(p, '[data-testid="mold-xray-toggle"]');
  await p.waitForTimeout(1800);
  out.push(await shot('xray'));
  console.log('\n✓ 🩻 rayos X');

  // ── 2) COTAS 3D sobre el molde en rayos X (info + info) ───────────────────
  await clickDom(p, '[data-testid="mold-cotas-toggle"]');
  await p.waitForTimeout(1500);
  const cotas = await p.$$eval('[data-testid="mold-cotas-overlay"] > div', (ds) => ds.map((d) => d.innerText)).catch(() => []);
  console.log(`✓ 📐 cotas (${cotas.length}): ${cotas.filter((c) => /✗/.test(c)).length} en ROJO`);
  out.push(await shot('xray-cotas'));

  // ── 3) TÉRMICO: el estudio que el user sospecha ───────────────────────────
  await clickDom(p, '[data-testid="mold-sim-toggle"]');
  await p.waitForTimeout(6000);                      // el transitorio necesita correr
  const rep = await textOf(p, '[data-testid="mold-sim-report"]');
  if (rep) { console.log('\n🌡 REPORTE TÉRMICO/ESTRUCTURAL:'); for (const l of rep.split('\n').filter(Boolean).slice(0, 14)) console.log(`   ${l}`); }
  else console.log('\n🌡 (sin reporte térmico visible)');
  out.push(await shot('termico'));

  if (errs.length) console.log('\n⚠ errores de página:', errs.slice(0, 3).join(' | '));
  console.log('\nSS → ' + out.join('\n     '));
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 400)); process.exit(1); });
