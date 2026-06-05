const { chromium } = require('playwright');
const fs=require('fs'); const DIR='/home/ian/Orkesta/la-forja/forja-shots/ensamble', FR=DIR+'/mframes';
(async()=>{
  fs.mkdirSync(FR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars','--window-size=1280,960']});
  const p=await b.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms); const out={};
  try{
    await p.goto('http://localhost:5002/forja-brep.html',{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000}); await wait(800);
    await ev(()=>window.__forgeBrep.applyGearbox());
    for(let i=0;i<16;i++){await wait(2000); if(await ev(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length)){break;}}
    await ev(()=>window.__forgeBrep.orbitTo(28,18,140)); await wait(400);
    await ev(()=>window.__forgeBrep.setGbMotion(true)); await wait(1500);
    for(let i=1;i<=48;i++){ await wait(110); await p.screenshot({path:`${FR}/m${String(i).padStart(3,'0')}.png`}); }
    out.frames=48;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('EMOTION='+JSON.stringify(out));
})();
