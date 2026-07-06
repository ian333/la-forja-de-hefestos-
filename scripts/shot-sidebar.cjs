#!/usr/bin/env node
// Verifica que el SIDEBAR del Physics Lab haga scroll y el ultimo modulo sea
// alcanzable. Expande TODAS las ramas, mide scrollHeight vs clientHeight, baja
// hasta abajo y confirma que circuit-field queda visible en viewport.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = '/tmp/sidebar-shot'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || `http://localhost:${process.env.PORT || 4173}`;

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/physics.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // expandir TODAS las ramas para forzar overflow
  const branches = await page.locator('[data-testid^="branch-"]').all();
  for (const b of branches) { await b.click(); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);

  const aside = page.locator('aside').first();
  const m1 = await aside.evaluate(el => ({ scroll: el.scrollHeight, client: el.clientHeight, top: el.scrollTop }));
  await page.screenshot({ path: `${OUT}/top.png`, clip: { x: 0, y: 0, width: 260, height: 720 }, timeout: 30000 });

  // bajar el aside hasta el fondo
  await aside.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  const m2 = await aside.evaluate(el => ({ top: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
  await page.screenshot({ path: `${OUT}/bottom.png`, clip: { x: 0, y: 0, width: 260, height: 720 }, timeout: 30000 });

  // el ultimo modulo dentro del viewport?
  const cf = page.locator('[data-testid="module-circuit-field"]');
  const visible = await cf.isVisible().catch(() => false);
  const box = visible ? await cf.boundingBox() : null;
  const inView = box ? (box.y >= 0 && box.y + box.height <= 720) : false;

  console.log(`aside: scrollHeight=${m1.scroll} clientHeight=${m1.client} → ${m1.scroll > m1.client ? 'SCROLLABLE' : 'NO-SCROLL'} (sobra ${m1.scroll - m1.client}px)`);
  console.log(`scroll al fondo: scrollTop=${m2.top}/${m2.max}`);
  console.log(`circuit-field visible=${visible} y=${box ? box.y.toFixed(0) : '?'} dentro-del-viewport=${inView}`);
  console.log(`VEREDICTO: ${m1.scroll > m1.client && inView ? 'OK — hay scroll y el ultimo modulo se alcanza' : 'REVISAR'}`);
  await ctx.close(); await browser.close();
})();
