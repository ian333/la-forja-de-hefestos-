const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'http://localhost:5002/forja-brep.html';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/testrig';
const P100 = { R:27.124, T:4.069, E:1.017, Rr:2.034, shaftD:10.85, shaftBore:5.425, outPinD:4.07, testRig:true };
(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const b = await chromium.launch({ headless:false, executablePath:'/usr/bin/google-chrome-stable',
    args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars','--window-size=1680,1050'] });
  const p = await b.newPage({ viewport:{width:1680,height:1050}, deviceScaleFactor:1 });
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  const ev=(f,a)=>p.evaluate(f,a); const wait=ms=>p.waitForTimeout(ms);
  const shot=async t=>{ await p.screenshot({path:`${DIR}/${t}.png`,timeout:30000}); };
  const out={};
  try {
    await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000});
    await wait(800);
    await ev(()=>window.__forgeBrep.applyGearbox());
    let b1=null; for(let i=0;i<20;i++){ await wait(2500); b1=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.length:null); if(b1){console.log('BASE@'+((i+1)*2.5)+'s'); break;} }
    await ev((pp)=>window.__forgeBrep.updateGearbox(pp), P100);
    await wait(4000);
    let bodies=null; for(let i=0;i<22;i++){ await wait(2500); bodies=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.map(x=>x.key):null); if(bodies&&bodies.length){console.log('RIG@'+((i+1)*2.5)+'s'); break;} }
    out.bodies=bodies;
    out.geom=await ev(()=>window.__forgeBrep.gearboxGeom);
    out.mesh=await ev(()=>window.__forgeBrep.gbMeshClearance(0));
    await ev(()=>window.__forgeBrep.showAllGbBodies()); await wait(600);
    await ev(()=>window.__forgeBrep.orbitTo(32,20,150)); await wait(800); await shot('01-banco-completo');
    await ev(()=>window.__forgeBrep.orbitTo(18,6,150)); await wait(600); await shot('02-frontal');
    await ev(()=>window.__forgeBrep.orbitTo(0,68,150)); await wait(600); await shot('03-palanca-arriba');
    await ev(()=>window.__forgeBrep.orbitTo(0,-55,150)); await wait(600); await shot('04-base-abajo');
    await ev(()=>{const a=window.__forgeBrep; a.toggleGbBody('hembra'); a.toggleGbBody('salida');}); await wait(500);
    await ev(()=>window.__forgeBrep.setSection(true,'y',0)); await wait(800);
    await ev(()=>window.__forgeBrep.orbitTo(8,10,100)); await wait(700); await shot('05-seccion-barril');
    await ev(()=>window.__forgeBrep.setSection(false)); await wait(300);
    await ev(()=>window.__forgeBrep.isolateGbBody('disco-1')); await wait(700);
    await ev(()=>window.__forgeBrep.orbitTo(35,4,60)); await wait(600); await shot('06-disco-barril');
    try { await ev(()=>window.__forgeBrep.exportSTL()); await wait(1000); out.exported=true; } catch(e){}
    out.errs=errs.slice(0,6);
  } catch(e){ out.fatal=String(e&&e.stack||e).slice(0,400); }
  finally { await b.close().catch(()=>{}); }
  fs.writeFileSync(`${DIR}/data.json`, JSON.stringify(out,null,2));
  console.log('TESTRIG='+JSON.stringify({bodies:out.bodies,geom:out.geom,mesh:out.mesh,exported:out.exported,errs:out.errs,fatal:out.fatal},null,1));
  process.exit(0);
})();
