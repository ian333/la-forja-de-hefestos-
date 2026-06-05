const { chromium } = require('playwright');
const fs=require('fs'); const URL='http://localhost:5002/forja-brep.html', DIR='/home/ian/Orkesta/la-forja/forja-shots/hibrido';
(async()=>{
  fs.mkdirSync(DIR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars','--window-size=1680,1050']});
  const p=await b.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms), shot=async t=>{await p.screenshot({path:`${DIR}/${t}.png`,timeout:30000});};
  const out={};
  try{
    await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000}); await wait(800);
    await ev(()=>window.__forgeBrep.applyGearbox());
    for(let i=0;i<22;i++){await wait(2500); if(await ev(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length)){console.log('READY@'+((i+1)*2.5));break;}}
    out.mesh=await ev(()=>window.__forgeBrep.gbMeshClearance(0));
    // HEMBRA aislada → rodillos acinturados (la cintura por disco)
    await ev(()=>window.__forgeBrep.isolateGbBody('hembra')); await wait(900);
    await ev(()=>window.__forgeBrep.orbitTo(26,12,150)); await wait(700); await shot('A1-hembra-acinturada');
    await ev(()=>window.__forgeBrep.orbitTo(88,2,120)); await wait(600); await shot('A2-cintura-lado');
    // SECCIÓN del abrazo: hembra + disco-1 (barril en la cintura)
    await ev(()=>window.__forgeBrep.showAllGbBodies()); await wait(400);
    await ev(()=>{const a=window.__forgeBrep; for(let i=2;i<=5;i++)a.toggleGbBody('disco-'+i); a.toggleGbBody('salida');}); await wait(500);
    await ev(()=>window.__forgeBrep.setSection(true,'y',0)); await wait(800);
    await ev(()=>window.__forgeBrep.orbitTo(4,7,120)); await wait(700); await shot('A3-abrazo-seccion');
    await ev(()=>window.__forgeBrep.orbitTo(40,14,130)); await wait(600); await shot('A4-abrazo-iso');
    out.bodies=await ev(()=>window.__forgeBrep.gbBodies.map(x=>x.key));
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('ABRAZO='+JSON.stringify(out));
})();
