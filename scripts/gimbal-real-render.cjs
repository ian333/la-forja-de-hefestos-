const { chromium } = require('playwright');
const fs=require('fs'); const DIR='/home/ian/Orkesta/la-forja/forja-shots/brazo', FR=DIR+'/grframes';
const POSES=[{q1:20,q2:-25,az:40},{q1:-40,q2:0,az:40},{q1:45,q2:0,az:40},{q1:0,q2:-50,az:40},{q1:0,q2:45,az:40},{q1:30,q2:-35,az:40},
 {q1:20,q2:-25,az:0,el:60},{q1:20,q2:-25,az:90,el:10},{q1:20,q2:-25,az:175,el:16},{q1:20,q2:-25,az:255,el:10},
 {q1:0,q2:0,az:30,el:6},{q1:25,q2:-30,az:40,el:55}];
(async()=>{
  fs.mkdirSync(FR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars']});
  const p=await b.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1}); const out={};
  const log=[]; p.on('pageerror',e=>log.push(String(e).slice(0,200)));
  try{
    await p.goto('http://127.0.0.1:8125/forja-shots/brazo/gimbal-real.html',{waitUntil:'networkidle',timeout:60000});
    await p.waitForFunction('window.__ready===true',{timeout:60000});
    for(let i=0;i<POSES.length;i++){ await p.evaluate((o)=>window.renderAt(o),POSES[i]); await p.waitForTimeout(120); await p.screenshot({path:`${FR}/r${String(i+1).padStart(2,'0')}.png`}); }
    out.frames=POSES.length;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300); out.log=log.slice(0,4);}
  finally{await b.close().catch(()=>{});}
  console.log('GREAL='+JSON.stringify(out));
})();
