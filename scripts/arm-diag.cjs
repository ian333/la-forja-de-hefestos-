const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch({headless:false,executablePath:'/usr/bin/google-chrome-stable',args:['--no-sandbox','--headless=new','--use-angle=gl','--enable-gpu','--ignore-gpu-blocklist','--disable-software-rasterizer']});
  const p=await b.newPage(); const log=[];
  p.on('console',m=>{if(/error|warn/i.test(m.type())||/forja|three|undefined|null/i.test(m.text()))log.push('C '+m.text().slice(0,200))});
  p.on('pageerror',e=>log.push('PE '+String(e).slice(0,240)));
  await p.goto('http://127.0.0.1:8124/forja-shots/brazo/arm-skeleton.html',{waitUntil:'domcontentloaded',timeout:30000});
  await p.waitForTimeout(5000);
  console.log('READY='+await p.evaluate(()=>window.__ready===true).catch(()=>'err'));
  console.log('LOG='+JSON.stringify(log.slice(0,8),null,1));
  await b.close();
})();
