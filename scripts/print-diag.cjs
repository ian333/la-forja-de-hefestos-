const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer']});
  const p=await b.newPage();
  const log=[]; p.on('console',m=>log.push('C['+m.type()+'] '+m.text().slice(0,200))); p.on('pageerror',e=>log.push('PAGEERR '+String(e).slice(0,260))); p.on('requestfailed',r=>log.push('REQFAIL '+r.url().slice(-40)+' '+(r.failure()&&r.failure().errorText)));
  await p.goto('http://127.0.0.1:8124/forja-shots/printsim/finger.html',{waitUntil:'domcontentloaded',timeout:30000});
  await p.waitForTimeout(6000);
  const ready=await p.evaluate(()=>window.__ready===true).catch(()=>'eval-err');
  console.log('READY='+ready);
  console.log('LOG='+JSON.stringify(log.slice(0,12),null,1));
  await b.close();
})();
