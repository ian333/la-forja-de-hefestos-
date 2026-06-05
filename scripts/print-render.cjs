const { chromium } = require('playwright');
const fs=require('fs');
const URL='http://127.0.0.1:8124/forja-shots/printsim/finger.html';
const DIR='/home/ian/Orkesta/la-forja/forja-shots/printsim';
const FR=DIR+'/frames';
const TEST = process.argv.includes('--test');
(async()=>{
  fs.mkdirSync(FR,{recursive:true});
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',
    args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer','--hide-scrollbars']});
  const p=await b.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  const out={};
  try{
    await p.goto(URL,{waitUntil:'networkidle',timeout:60000});
    await p.waitForFunction('window.__ready===true',{timeout:60000});
    out.renderer=await p.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2')||document.querySelector('canvas').getContext('webgl');const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'?';});
    const ph=await p.evaluate(()=>window.__ph);
    if(TEST){ await p.evaluate(()=>window.renderAt(30)); await p.screenshot({path:DIR+'/TEST-mid.png'}); out.test=true; }
    else {
      const N=300, top=ph.top;
      for(let i=1;i<=N;i++){ const h=(i/N)*(top+2); await p.evaluate((hh)=>window.renderAt(hh),h);
        await p.screenshot({path:`${FR}/f${String(i).padStart(4,'0')}.png`}); }
      out.frames=N;
    }
    out.errs=errs.slice(0,5);
  }catch(e){out.fatal=String(e&&e.stack||e).slice(0,300);}
  finally{await b.close().catch(()=>{});}
  console.log('PRINTSIM='+JSON.stringify(out));
})();
