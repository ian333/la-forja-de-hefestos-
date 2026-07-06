/**
 * perfil-e2e.cjs — QA end-to-end del progreso REAL (sin ?demo).
 *
 *   Flujo probado (mismo contexto/origen → mismo localStorage):
 *     1. /lab.html (química): clic en 4 mesas → 4 lecciones 'quimica'.
 *     2. /math.html: dispara gaia:lesson-complete → el shell registra el módulo.
 *     3. /perfil.html (SIN demo): el átomo/HUD reflejan las lecciones reales.
 *
 *   En iangpu: DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *              node scripts/perfil-e2e.cjs
 */
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5174';
const OUT = process.env.OUT || '/tmp/perfil-shots';

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-software-rasterizer', '--window-size=1500,1000'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  const fails = [];
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
    if (!ok) fails.push(name);
  };

  // localStorage sobrevive navegaciones; si el contexto murió (tab GPU pesada),
  // se relee desde una página LIGERA del mismo origen.
  const readStore = async () => {
    try {
      return await page.evaluate(() => JSON.parse(localStorage.getItem('gaia_progress_v1') || 'null'));
    } catch {
      await page.goto(`${BASE}/terminos.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(600);
      return await page.evaluate(() => JSON.parse(localStorage.getItem('gaia_progress_v1') || 'null'));
    }
  };

  // ── 1. Química: explorar mesas de trabajo (las 3 ligeras, determinista) ──
  await page.goto(`${BASE}/lab.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  for (const frag of ['Molécula', 'Enlace', 'Reacción']) {
    const btn = page.locator('button', { hasText: frag }).first();
    await btn.click({ timeout: 15000 }).catch((e) => console.log(`  (clic '${frag}' falló: ${e.message.split('\n')[0]})`));
    await page.waitForTimeout(1600);
  }
  // Sandbox = smoke aparte (GPU pesada; puede tirar el contexto en headless)
  await page.locator('button', { hasText: 'Sandbox' }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  let store = await readStore();
  const quimica = store?.lessons?.quimica ?? [];
  check('quimica: 3 mesas ligeras registradas',
    ['tab:molecule', 'tab:bond', 'tab:reaction'].every((t) => quimica.includes(t)),
    `quimica=${JSON.stringify(quimica)}`);

  // ── 2. Mate: fin de clase guiada (evento del LessonPanel) ─────────
  await page.goto(`${BASE}/math.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('gaia:lesson-complete')));
  await page.waitForTimeout(800);
  store = await readStore();
  const mathDone = store?.lessons?.math?.length ?? 0;
  check('math: lección registrada vía evento', mathDone === 1, `math=${JSON.stringify(store?.lessons?.math)}`);

  // ── 3. Perfil REAL (sin ?demo): el átomo eres tú ───────────────────
  const total = (Object.values(store?.lessons ?? {})).reduce((s, a) => s + a.length, 0);
  await page.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  const h1 = await page.locator('h1').innerText().catch(() => '');
  // Z = max(1, lecciones): 4 → Berilio, 5 → Boro (según si el sandbox contó)
  const ELEMENTS = { 1: 'Hidrógeno', 3: 'Litio', 4: 'Berilio', 5: 'Boro', 6: 'Carbono' };
  const expected = ELEMENTS[Math.max(1, total)] || null;
  check(`perfil: h1 dice el elemento real (${total} lecciones → ${expected})`,
    expected ? h1.includes(expected) : h1.length > 0, `h1="${h1.replace(/\n/g, ' ')}"`);
  const chips = await page.locator('text=/Z = \\d+/').innerText().catch(() => '');
  check('perfil: chip Z presente', /Z = \d+/.test(chips), chips);
  await page.screenshot({ path: `${OUT}/6-e2e-perfil-real.png`, timeout: 30000 });

  await browser.close();
  console.log(fails.length ? `\nE2E: ${fails.length} FALLAS` : '\nE2E: TODO VERDE');
  process.exit(fails.length ? 1 : 0);
})();
