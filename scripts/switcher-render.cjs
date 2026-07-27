/** switcher-render.cjs — abre el LOBBY integrado (clic en el título) y lo captura. */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const OUT = process.env.OUT || '/tmp/switcher';
const fs = require('fs');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0,160)));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && document.querySelector("canvas"))', { timeout: 120000 });
    // sembrar biblioteca (proyectos de VARIOS tipos) para ver "Tus proyectos"
    await p.evaluate(() => {
      const mk = (name, nf, nc) => ({ version:1, name, sketch:{ kind:'custom', steps:[], plane:'xy' },
        ops:Array.from({length:nf},(_,i)=>({id:'o'+i,type:'extrude'})), material:'steel',
        components:Array.from({length:nc},(_,i)=>({id:'c'+i,name:'p'+i,kind:'box'})) });
      const lib = {
        'Molde Tupper 165×120': mk('Molde Tupper 165×120', 6, 4),
        'Brazo robótico 3 eslabones': mk('Brazo robótico 3 eslabones', 9, 7),
        'Reductor cicloidal 11:1': mk('Reductor cicloidal 11:1', 5, 3),
      };
      localStorage.setItem('forja:library:v1', JSON.stringify(lib));
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForFunction('!!(window.__forgeBrep && document.querySelector("canvas"))', { timeout: 120000 });
    await p.waitForTimeout(1500);
    // abrir el lobby por el TÍTULO
    await p.click('[data-testid="doc-switcher"]');
    await p.waitForSelector('[data-testid="project-switcher"]', { timeout: 8000 });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/switcher.png`, timeout: 30000 });
    // filtrar a Robots
    await p.click('[data-testid="ps-filter-robot"]').catch(() => {});
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/switcher_robot.png`, timeout: 30000 });
    console.log(JSON.stringify({ ok: true, errs: errs.slice(0,8) }, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300), errs: errs.slice(0,8) }, null, 2)); }
  finally { await b.close(); }
})();
