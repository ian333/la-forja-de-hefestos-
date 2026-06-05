const { chromium } = require('playwright');
const fs=require('fs'); const URL='http://127.0.0.1:5050/forja-brep.html', DIR='/home/ian/Orkesta/la-forja/forja-shots/hibrido';
(async()=>{
  fs.mkdirSync(DIR,{recursive:true});
  const b=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome-stable',
    args:['--no-sandbox','--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--hide-scrollbars','--window-size=1400,900']});
  const p=await b.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms), shot=async t=>{await p.screenshot({path:`${DIR}/${t}.png`,timeout:60000});};
  const out={}; const t0=Date.now();
  try{
    await p.goto(URL,{waitUntil:'domcontentloaded',timeout:90000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:90000}); await wait(900);
    await ev(()=>window.__forgeBrep.applyGearbox());
    for(let i=0;i<40;i++){await wait(2500); if(await ev(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length)){console.log('READY@'+((Date.now()-t0)/1000).toFixed(0)+'s');break;}}
    out.mesh=await ev(()=>window.__forgeBrep.gbMeshClearance(0));
    out.renderer=await ev(()=>{try{const c=document.createElement('canvas');const gl=c.getContext('webgl');const e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);}catch(_){return 'n/a';}});
    await ev(()=>window.__forgeBrep.isolateGbBody('hembra')); await wait(1200);
    await ev(()=>window.__forgeBrep.orbitTo(85,3,120)); await wait(900); await shot('L1-cintura-local');
    await ev(()=>window.__forgeBrep.showAllGbBodies()); await wait(400);
    await ev(()=>{const a=window.__forgeBrep; for(let i=2;i<=5;i++)a.toggleGbBody('disco-'+i); a.toggleGbBody('salida');}); await wait(600);
    await ev(()=>window.__forgeBrep.setSection(true,'y',0)); await wait(1000);
    await ev(()=>window.__forgeBrep.orbitTo(4,7,110)); await wait(900); await shot('L2-abrazo-local');
    out.secs=((Date.now()-t0)/1000).toFixed(0);
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('LOCAL='+JSON.stringify(out));
})();
