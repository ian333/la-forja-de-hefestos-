const { chromium } = require('playwright');
const fs = require('fs');
const URL='http://localhost:5002/forja-brep.html', DIR='/home/ian/Orkesta/la-forja/forja-shots/hibrido';
// 3 discos GRUESOS + rodillos acinturados + barril + 100g + banco
const PH={R:27.124,T:6.8,E:1.017,Rr:2.034,shaftD:10.85,shaftBore:5.425,outPinD:4.07,discs:3,testRig:true};
(async()=>{
  fs.mkdirSync(DIR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars','--window-size=1680,1050']});
  const p=await b.newPage({viewport:{width:1680,height:1050},deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms), shot=async t=>{await p.screenshot({path:`${DIR}/${t}.png`,timeout:30000});};
  const out={};
  try{
    await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000}); await wait(800);
    // params del hibrido ANTES de construir → build directo (sin carrera de rescale)
    await ev((pp)=>window.__forgeBrep.updateGearbox(pp),PH); await wait(600);
    await ev(()=>window.__forgeBrep.applyGearbox());
    let bodies=null; for(let i=0;i<26;i++){await wait(2500); bodies=await ev(()=>window.__forgeBrep.gbBodies?window.__forgeBrep.gbBodies.map(x=>x.key):null); if(bodies&&bodies.length===6){console.log('HYB@'+((i+1)*2.5)+'s n='+bodies.length);break;}}
    out.bodies=bodies; out.mesh=await ev(()=>window.__forgeBrep.gbMeshClearance(0)); out.geom=await ev(()=>window.__forgeBrep.gearboxGeom);
    // hembra aislada → ver los rodillos acinturados
    await ev(()=>window.__forgeBrep.isolateGbBody('hembra')); await wait(800);
    await ev(()=>window.__forgeBrep.orbitTo(28,14,120)); await wait(700); await shot('01-hembra-rodillos');
    await ev(()=>window.__forgeBrep.orbitTo(85,4,95)); await wait(600); await shot('02-rodillos-cintura');
    // seccion: hembra + disco-1 → ver el ABRAZO (barril en cintura)
    await ev(()=>window.__forgeBrep.showAllGbBodies()); await wait(400);
    await ev(()=>{const a=window.__forgeBrep; for(let i=2;i<=3;i++)a.toggleGbBody('disco-'+i); a.toggleGbBody('salida');}); await wait(500);
    await ev(()=>window.__forgeBrep.setSection(true,'y',0)); await wait(800);
    await ev(()=>window.__forgeBrep.orbitTo(6,8,90)); await wait(700); await shot('03-seccion-abrazo');
    // banco completo
    await ev(()=>{window.__forgeBrep.setSection(false); window.__forgeBrep.showAllGbBodies();}); await wait(500);
    await ev(()=>window.__forgeBrep.orbitTo(30,20,150)); await wait(700); await shot('04-banco-3discos');
    try{await ev(()=>window.__forgeBrep.exportSTL()); await wait(800); out.exported=true;}catch(e){}
    out.errs=errs.slice(0,5);
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,400);}
  finally{await b.close().catch(()=>{});}
  fs.writeFileSync(`${DIR}/data.json`,JSON.stringify(out,null,2));
  console.log('HYBRID='+JSON.stringify({bodies:out.bodies&&out.bodies.length,mesh:out.mesh,exported:out.exported,errs:out.errs,fatal:out.fatal}));
})();
