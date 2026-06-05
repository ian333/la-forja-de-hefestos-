const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless:false, executablePath:'/usr/bin/google-chrome-stable', args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer'] });
  const p = await b.newPage();
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  try{
    await p.goto('http://localhost:5002/forja-brep.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000}); await wait(900);
    await ev(()=>window.__forgeBrep.applyGearbox());
    let n=null; for(let i=0;i<20;i++){await wait(2500); n=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.length:null); if(n){break;}}
    const c0=await ev(()=>window.__forgeBrep.gbMeshClearance(0));
    const c30=await ev(()=>window.__forgeBrep.gbMeshClearance(30));
    const c60=await ev(()=>window.__forgeBrep.gbMeshClearance(60));
    console.log('CLEAR bodies='+n+' @0='+JSON.stringify(c0)+' @30='+JSON.stringify(c30)+' @60='+JSON.stringify(c60));
  }catch(e){console.log('ERR '+String(e).slice(0,160));}
  await b.close().catch(()=>{});
})();
