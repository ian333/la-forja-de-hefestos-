const { chromium } = require('playwright');
const URL='http://localhost:5002/forja-brep.html';
const OUT='/home/ian/Orkesta/la-forja/forja-shots/testrig/banco-cicloidal-100g.stl';
const P100={R:27.124,T:4.069,E:1.017,Rr:2.034,shaftD:10.85,shaftBore:5.425,outPinD:4.07,testRig:true};
(async()=>{
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer']});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage(); const out={};
  try{
    await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000}); await p.waitForTimeout(800);
    await p.evaluate(()=>window.__forgeBrep.applyGearbox());
    for(let i=0;i<20;i++){await p.waitForTimeout(2500); if(await p.evaluate(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length))break;}
    await p.evaluate((pp)=>window.__forgeBrep.updateGearbox(pp),P100); await p.waitForTimeout(3000);
    // ESPERA a que el result (fuente del STL) se ESTABILICE en ~100g (no un transitorio)
    let mass=999,prev=-1,stable=0; for(let i=0;i<32;i++){await p.waitForTimeout(2500); try{mass=await p.evaluate(()=>window.__forgeBrep.invariants.mass_g);}catch(e){}
      if(mass>60&&mass<160&&Math.abs(mass-prev)<1.5){stable++; if(stable>=2){console.log('STABLE@'+((i+1)*2.5)+'s mass='+mass.toFixed(1)); break;}} else stable=0; prev=mass;}
    try{const inv=await p.evaluate(()=>window.__forgeBrep.invariants); out.vol_mm3=Math.round(inv.vol_kernel); out.masa_g=+inv.mass_g.toFixed(1);}catch(e){}
    const [dl]=await Promise.all([p.waitForEvent('download',{timeout:30000}), p.evaluate(()=>window.__forgeBrep.exportSTL())]);
    await dl.saveAs(OUT); out.stl=OUT;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('RIGSTL='+JSON.stringify(out));
  process.exit(out.stl?0:2);
})();
