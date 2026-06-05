const { chromium } = require('playwright');
const PATCH = JSON.parse(process.env.PATCH || '{"testRig":true}');
(async () => {
  const b = await chromium.launch({ headless:false, executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer'] });
  const p = await b.newPage();
  const warns=[]; p.on('console',m=>{const t=m.text(); if(/cuerpos|Standard_|abort|error/i.test(t)) warns.push(t.slice(0,160));}); p.on('pageerror',e=>warns.push('PE '+String(e).slice(0,160)));
  const ev=(f,a)=>p.evaluate(f,a); const wait=ms=>p.waitForTimeout(ms);
  await p.goto('http://localhost:5002/forja-brep.html',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000});
  await wait(800);
  await ev(()=>window.__forgeBrep.applyGearbox());
  let b1=null; for(let i=0;i<20;i++){ await wait(2500); b1=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.length:null); if(b1){console.log('BASE_READY@'+((i+1)*2.5)+'s n='+b1); break;} }
  // ahora aplicar el patch
  await ev((pp)=>window.__forgeBrep.updateGearbox(pp), PATCH);
  let b2='timeout'; for(let i=0;i<24;i++){ await wait(2500); const n=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.length:null); if(n){ b2=n; if(i>=2){console.log('PATCH_READY@'+((i+1)*2.5)+'s n='+n); break;} } else b2='null'; }
  console.log('PATCH='+JSON.stringify(PATCH)+' RESULT bodies='+b2);
  if(warns.length) console.log('WARNS='+JSON.stringify(warns.slice(-5)));
  await b.close();
})();
