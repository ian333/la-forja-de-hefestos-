/**
 * bus-v3-test.cjs — prueba el PIPELINE del curso POR HANDLES (v3).
 * Corre percha→escala→layout→parting→split encadenando handles ('sh_N') por el
 * bus, verifica que cada etapa consuma el handle de la anterior, y prueba el ciclo
 * de vida (shape.list / shape.free / shape.clear · higiene de memoria wasm).
 */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const fs = require('fs');

(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const perr = []; p.on('pageerror', e => perr.push(String(e).slice(0,160)));
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forja && window.__forja.run)', { timeout: 120000 });
    // espera a que el kernel OCCT bootee (needsOc)
    await p.waitForFunction(() => {
      try { window.__forja.run('curso.percha', {}); return true; }
      catch (e) { return !String(e).includes('requiere OCCT'); }
    }, { timeout: 90000 });

    const out = await p.evaluate(async () => {
      const F = window.__forja;
      const steps = [];
      const step = (name, fn) => { try { const r = fn(); steps.push({ name, ok: true, r: JSON.stringify(r).slice(0,140) }); return r; } catch (e) { steps.push({ name, ok: false, r: 'THREW: ' + String(e).slice(0,120) }); throw e; } };
      // pipeline encadenado por HANDLES
      const a = step('curso.percha', () => F.run('curso.percha', {}));
      const b = step('curso.escala', () => F.run('curso.escala', { shape: a.shapeId, factor: 1.015 }));
      const c = step('curso.layout', () => F.run('curso.layout', { shape: b.shapeId }));
      const d = step('curso.parting', () => F.run('curso.parting', { bodies: c.shapeIds }));
      const e = step('curso.split', () => F.run('curso.split', { bodies: c.shapeIds }));
      // ciclo de vida
      const listed = step('shape.list', () => F.run('shape.list', {}));
      const vol = step('shape.volume', () => F.run('shape.volume', { id: a.shapeId }));
      const freed1 = step('shape.free', () => F.run('shape.free', { id: a.shapeId }));
      const cleared = step('shape.clear', () => F.run('shape.clear', {}));
      const afterClear = step('shape.list(after clear)', () => F.run('shape.list', {}));
      return {
        steps,
        chain: {
          perchaVol: a.volMm3, escalaVol: b.volDespues,
          layoutIds: c.shapeIds, partingOk: d.ok, splitMode: e.mode,
          liveHandles: listed.length, perchaVolFromHandle: vol,
          freed1: freed1.n, clearedN: cleared.freed, remaining: afterClear.length,
        },
      };
    });

    const pass = out.steps.filter(s => s.ok).length;
    const result = {
      url: URL, total: out.steps.length, pass, fail: out.steps.length - pass,
      chain: out.chain, steps: out.steps, pageErrors: perr.slice(0,8),
    };
    fs.mkdirSync('/tmp/bus-v3', { recursive: true });
    fs.writeFileSync('/tmp/bus-v3/result.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ fatal: String(e).slice(0,300), pageErrors: perr.slice(0,8) }, null, 2));
  } finally { await b.close(); }
})();
