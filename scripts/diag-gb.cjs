const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless:false, executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer'] });
  const p = await b.newPage();
  const warns=[]; p.on('console',m=>{const t=m.text(); if(/forja|cuerpos|error|abort|exception|Standard_/i.test(t)) warns.push(t.slice(0,200));});
  p.on('pageerror',e=>warns.push('PAGEERR '+String(e).slice(0,200)));
  await p.goto('http://localhost:5002/forja-brep.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000});
  await p.waitForTimeout(900);
  await p.evaluate(()=>window.__forgeBrep.applyGearbox());
  let bodies=null;
  for(let i=0;i<18;i++){ await p.waitForTimeout(2500); bodies=await p.evaluate(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.map(x=>x.key):null); if(bodies){console.log('READY@'+((i+1)*2.5)+'s'); break;} }
  console.log('BODIES='+JSON.stringify(bodies));
  if(warns.length) console.log('WARNS='+JSON.stringify(warns.slice(-6),null,1));
  await b.close();
})();
