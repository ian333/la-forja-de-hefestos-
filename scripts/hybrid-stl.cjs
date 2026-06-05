const { chromium } = require('playwright');
const URL='http://localhost:5002/forja-brep.html';
const OUT='/home/ian/Orkesta/la-forja/forja-shots/hibrido/banco-3discos-gap.stl';
const PH={R:27.124,T:6.8,E:1.017,Rr:2.034,shaftD:10.85,shaftBore:5.425,outPinD:4.07,discs:3,testRig:true};
(async()=>{
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer']});
  const ctx=await b.newContext({acceptDownloads:true}); const p=await ctx.newPage(); const out={};
  const ev=(f,a)=>p.evaluate(f,a), wait=ms=>p.waitForTimeout(ms);
  try{
    await p.goto(URL,{waitUntil:'domcontentloaded',timeout:60000});
    await p.waitForFunction('window.__forgeBrep && window.__forgeBrep.ready',{timeout:60000}); await wait(800);
    await ev(()=>window.__forgeBrep.applyGearbox());
    for(let i=0;i<16;i++){await wait(2000); if(await ev(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length===8))break;}
    await ev((pp)=>window.__forgeBrep.updateGearbox(pp),PH);
    // espera 6 cuerpos (3 discos) Y masa estable (el result reescalado)
    let okBodies=false; for(let i=0;i<24;i++){await wait(2000); if(await ev(()=>window.__forgeBrep.gbBodies&&window.__forgeBrep.gbBodies.length===6)){okBodies=true;break;}}
    let mass=999,prev=-1,stable=0; for(let i=0;i<26;i++){await wait(2000); try{mass=await ev(()=>window.__forgeBrep.invariants.mass_g);}catch(e){} if(mass>50&&mass<260&&Math.abs(mass-prev)<1.5){stable++; if(stable>=2)break;} else stable=0; prev=mass;}
    out.bodies=okBodies?6:'?'; out.masa_g=+mass.toFixed(1); out.mesh=await ev(()=>window.__forgeBrep.gbMeshClearance(0));
    try{const inv=await ev(()=>window.__forgeBrep.invariants); out.vol_mm3=Math.round(inv.vol_kernel);}catch(e){}
    const [dl]=await Promise.all([p.waitForEvent('download',{timeout:30000}), ev(()=>window.__forgeBrep.exportSTL())]);
    await dl.saveAs(OUT); out.stl=OUT;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('HSTL='+JSON.stringify(out));
})();
