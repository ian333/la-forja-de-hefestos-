const { chromium } = require('playwright');
const fs=require('fs'); const DIR='/home/ian/Orkesta/la-forja/forja-shots/brazo', FR=DIR+'/gframes';
const POSES=[
 {q1:0,q2:0,az:40},        // neutral
 {q1:-45,q2:0,az:40}, {q1:45,q2:0,az:40},          // YAW solo (axial)
 {q1:0,q2:-55,az:40}, {q1:0,q2:50,az:40},          // PITCH solo (radial)
 {q1:35,q2:-40,az:40}, {q1:-35,q2:35,az:40},       // combinado
 {q1:25,q2:-30,az:0,el:65}, {q1:25,q2:-30,az:90,el:12}, {q1:25,q2:-30,az:170,el:18}, {q1:25,q2:-30,az:255,el:12}, // orbit
];
(async()=>{
  fs.mkdirSync(FR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars']});
  const p=await b.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1}); const out={};
  try{
    await p.goto('http://127.0.0.1:8125/forja-shots/brazo/gimbal.html',{waitUntil:'networkidle',timeout:60000});
    await p.waitForFunction('window.__ready===true',{timeout:60000});
    for(let i=0;i<POSES.length;i++){ await p.evaluate((o)=>window.renderAt(o),POSES[i]); await p.waitForTimeout(120); await p.screenshot({path:`${FR}/g${String(i+1).padStart(2,'0')}.png`}); }
    out.frames=POSES.length;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('GIMBAL='+JSON.stringify(out));
})();
