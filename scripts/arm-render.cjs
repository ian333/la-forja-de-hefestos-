const { chromium } = require('playwright');
const fs=require('fs'); const DIR='/home/ian/Orkesta/la-forja/forja-shots/brazo', FR=DIR+'/frames';
const POSES=[
 {q2:0,q3:0,az:35}, {q2:-55,q3:0,az:35}, {q2:-30,q3:90,az:35}, {q2:-80,q3:130,az:35},
 {q1:50,q2:-40,q3:45,az:15}, {q1:110,q2:-40,q3:45,az:15}, {q2:35,q3:-25,az:35}, {q2:-92,q3:25,az:35},
 {q2:-45,q3:55,az:0,el:70}, {q2:-45,q3:55,az:90,el:10}, {q2:-45,q3:55,az:180,el:18}, {q2:-45,q3:55,az:270,el:10}
];
(async()=>{
  fs.mkdirSync(FR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars']});
  const p=await b.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1}); const out={};
  try{
    await p.goto('http://127.0.0.1:8125/forja-shots/brazo/arm-skeleton.html',{waitUntil:'networkidle',timeout:60000});
    await p.waitForFunction('window.__ready===true',{timeout:60000});
    for(let i=0;i<POSES.length;i++){ await p.evaluate((o)=>window.renderAt(o),POSES[i]); await p.waitForTimeout(120); await p.screenshot({path:`${FR}/a${String(i+1).padStart(2,'0')}.png`}); }
    out.frames=POSES.length;
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('ARM='+JSON.stringify(out));
})();
