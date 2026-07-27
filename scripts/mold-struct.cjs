/** Verifica: (1) botón Sección en el ribbon, (2) estructura de componente (cuerpos+
 *  historia al desplegar), (3) platinas de la máquina al mostrarlas. */
const { chromium } = require('playwright');
(async () => {
  const url = process.env.URL || 'https://university.gaiaprime.com.mx/forja-brep.html';
  const dir = process.argv[2] || '/tmp/mr/st';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ headless: false, args: ['--no-sandbox', '--headless=new', '--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-software-rasterizer'] });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('[data-testid="viewport-canvas"]', { timeout: 90000 });
  await p.waitForTimeout(Number(process.env.WAIT || 13000));

  const ribbonSection = await p.$('[data-testid="btn-section-inspect"]').then((e) => !!e).catch(() => false);
  console.log('Sección en ribbon =', ribbonSection);
  // desplegar Placa A + inserto de cavidad → ver cuerpos + historia
  await p.click('[data-testid="mold-expand-A"]').catch(() => {});
  await p.click('[data-testid="mold-expand-inserto-cav"]').catch(() => {});
  await p.waitForTimeout(500);
  const treeA = await p.$('[data-testid="mold-comp-tree-A"]').then((e) => !!e).catch(() => false);
  console.log('estructura de componente (cuerpos+historia) desplegada =', treeA);
  await p.screenshot({ path: dir + '/1-struct-tree.png' });

  // mostrar las platinas de la máquina (contexto)
  await p.click('[data-testid="mold-part-platina-fija"] [data-testid="mold-hide-platina-fija"]').catch(() => {});
  // el botón hide de platinas ocultas es 🙈 → clic lo muestra; buscar por testid directo
  await p.click('[data-testid="mold-hide-platina-fija"]').catch(() => {});
  await p.click('[data-testid="mold-hide-platina-movil"]').catch(() => {});
  await p.waitForTimeout(500);
  await p.click('[data-testid="btn-fit"]').catch(() => {});
  await p.waitForTimeout(1000);
  await p.screenshot({ path: dir + '/2-mounted.png' });
  console.log('SS →', dir);
  await b.close();
})().catch((e) => { console.log('SS_FATAL', String(e.stack || e).slice(0, 300)); process.exit(1); });
