const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1600,1000'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const failed = []; const errs = [];
  p.on('requestfailed', r => failed.push(r.url().slice(-80) + ' :: ' + (r.failure()&&r.failure().errorText)));
  p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().slice(-90)); });
  p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,160)); });
  p.on('pageerror', e => errs.push('PAGEERR '+String(e).slice(0,200)));
  const out = {};
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // poll for __forgeBrep up to 60s, print progress
    let ready = false;
    for (let i=0;i<30;i++){
      const st = await p.evaluate(() => ({
        has: typeof window.__forgeBrep,
        keys: window.__forgeBrep ? Object.keys(window.__forgeBrep) : null,
        ready: window.__forgeBrep && window.__forgeBrep.ready,
        canvas: !!document.querySelector('canvas'),
      }));
      if (st.has === 'object') { out.state = st; if (st.ready) { ready = true; break; } }
      out.lastState = st;
      await p.waitForTimeout(2000);
    }
    out.ready = ready;
    await p.screenshot({ path: '/tmp/audit-fixes/PROBE.png', timeout: 20000 });
    out.shot = 'PROBE.png';
  } catch(e){ out.fatal = String(e).slice(0,300); }
  out.failed = failed.slice(0,25); out.errs = errs.slice(0,15);
  fs.mkdirSync('/tmp/audit-fixes',{recursive:true});
  fs.writeFileSync('/tmp/audit-fixes/probe.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
  await b.close();
})();
