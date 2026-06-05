const { chromium } = require('playwright');
const fs=require('fs');
const URL='http://127.0.0.1:8124/forja-shots/printsim/finger.html';
const FR='/home/ian/Orkesta/la-forja/forja-shots/printsim/inspect';
(async()=>{
  fs.mkdirSync(FR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer']});
  const p=await b.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
  const ev=(o)=>p.evaluate((x)=>window.renderAt(x),o); const shot=async(n)=>{await p.screenshot({path:`${FR}/${n}.png`});};
  const out={frames:0};
  try{
    await p.goto(URL,{waitUntil:'networkidle',timeout:60000});
    await p.waitForFunction('window.__ready===true',{timeout:60000});
    let n=0; const F=async(o)=>{await ev(o);await shot('i'+String(++n).padStart(3,'0'));};
    // ÓRBITA 360 de la pieza terminada (mover la cámara, explorar todo)
    for(let a=0;a<360;a+=18) await F({h:60,az:a,el:16,dist:115,hot:false});
    // ángulos alto/bajo
    await F({h:60,az:35,el:70,dist:120,hot:false});   // top-down
    await F({h:60,az:35,el:-25,dist:120,hot:false});  // desde abajo (ver voladizos)
    // CLOSEUPS de cada codo (verificar el gap del joint)
    for(const ty of [10,28,44]){ await F({h:60,az:20,el:6,dist:34,ty,hot:false}); await F({h:60,az:110,el:6,dist:34,ty,hot:false}); }
    out.frames=n;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('INSPECT='+JSON.stringify(out));
})();
