const { chromium } = require('playwright');
const fs=require('fs'); const URL='http://localhost:5002/forja-brep.html', DIR='/home/ian/Orkesta/la-forja/forja-shots/hibrido';
const PH={R:27.124,T:6.8,E:1.017,Rr:2.034,shaftD:10.85,shaftBore:5.425,outPinD:4.07,discs:3,testRig:true};
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
    for(let i=0;i<16;i++){await wait(2000); if(await ev(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length===8)){console.log('BASE@'+((i+1)*2));break;}}
    await ev((pp)=>window.__forgeBrep.updateGearbox(pp),PH);
    let bodies=null; for(let i=0;i<24;i++){await wait(2000); bodies=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.map(x=>x.key):null); if(bodies&&bodies.length===6){console.log('HYB3@'+((i+1)*2)+'s');break;}}
    out.bodies=bodies; out.mesh=await ev(()=>window.__forgeBrep.gbMeshClearance(0));
    await ev(()=>window.__forgeBrep.showAllGbBodies()); await wait(600);
    await ev(()=>window.__forgeBrep.orbitTo(30,20,150)); await wait(700); await shot('H1-banco-3discos');
    await ev(()=>{const a=window.__forgeBrep; a.toggleGbBody('hembra'); a.toggleGbBody('salida');}); await wait(500);
    await ev(()=>window.__forgeBrep.setSection(true,'y',0)); await wait(800);
    await ev(()=>window.__forgeBrep.orbitTo(6,9,95)); await wait(700); await shot('H2-seccion-3discos');
    await ev(()=>window.__forgeBrep.setSection(false)); await wait(300);
    await ev(()=>window.__forgeBrep.isolateGbBody('hembra')); await wait(700);
    await ev(()=>window.__forgeBrep.orbitTo(84,3,110)); await wait(600); await shot('H3-rodillos-3cinturas');
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('HYB3='+JSON.stringify(out));
})();
