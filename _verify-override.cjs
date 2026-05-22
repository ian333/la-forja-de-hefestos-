const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/efdf48d4-334f-4589-a7cc-12552b85c1f1',
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl2') { console.warn('BLOCKED webgl2'); return null; }
      return orig.call(this, type, ...args);
    };
  });
  page.on('console', m => console.log(m.type(), m.text().slice(0, 200)));
  page.on('pageerror', e => console.error('ERR:', e.message.slice(0, 200)));
  await page.goto('data:text/html,<canvas id=c></canvas><script>const c=document.getElementById("c");window.G2=c.getContext("webgl2");window.G1=c.getContext("webgl");const g=window.G1;if(g){const e=g.getExtension("WEBGL_debug_renderer_info");window.R=e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):"no_ext";}</script>', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 500));
  const r = await page.evaluate(() => ({ g2: window.G2 === null, r: window.R }));
  console.log('OVERRIDE TEST:', JSON.stringify(r));
  await browser.disconnect();
})();
