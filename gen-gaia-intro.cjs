// gen-gaia-intro.cjs — intro Gaia con el MOTOR REAL de la-forja (átomo recoloreado) + texto Gaia.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
(async () => {
  const W = 3840, H = 2160, Z = parseInt(process.env.Z || '8', 10);
  const TITLE = process.argv[2] || 'Cómo hacer una nota de venta';
  const DUR = 5.0, FPS = 30, N = Math.round(DUR * FPS);
  const fdir = '/tmp/gaia_intro_frames'; fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
  const exe = fs.existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined;
  const browser = await chromium.launch({ headless: false, executablePath: exe,
    args: ['--no-sandbox','--disable-setuid-sandbox','--headless=new','--ignore-gpu-blocklist',
      '--enable-gpu','--enable-gpu-rasterization','--enable-webgl', `--window-size=${W},${H}`] });
  const ctx = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1, bypassCSP:true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__GAIA_BRAND = 1; });
  await page.goto(`http://localhost:5001/cinematic-atom.html?z=${Z}`, { waitUntil:'networkidle', timeout:60000 });
  // Vite frío: la 1a carga optimiza deps y dispara un reload que destruye el contexto
  // a media captura. Doble carga = la 2a ya es estable.
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil:'networkidle' }).catch(() => {});
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.renderAt, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  // ocultar la etiqueta del elemento + inyectar overlay Gaia
  await page.evaluate((title) => {
    // ocultar cualquier overlay pre-existente (nombre del elemento / Z / letterbox letras)
    [...document.querySelectorAll('div')].forEach(d => {
      const t = d.textContent || '';
      if (/Z=\d/.test(t) && d.children.length && d.children.length < 6) d.style.display = 'none';
    });
    const o = document.createElement('div');
    o.id = 'gaia-ov';
    o.innerHTML = `
      <div id="gbrand" style="font-family:'Inter',system-ui,sans-serif;font-size:6.4vw;font-weight:200;color:#fff;letter-spacing:-0.03em;line-height:1;opacity:0;text-shadow:0 4px 55px rgba(0,0,0,.7)">GAIA Prime</div>
      <div id="gtitle" style="font-family:'Inter',system-ui,sans-serif;font-size:2.0vw;font-weight:400;color:rgba(255,255,255,0.62);letter-spacing:0.01em;margin-top:1.3vw;max-width:70vw;line-height:1.15;opacity:0">${title}</div>`;
    Object.assign(o.style, { position:'fixed', left:'7%', bottom:'13%', zIndex:'99999',
      display:'flex', flexDirection:'column', alignItems:'flex-start', textAlign:'left', pointerEvents:'none' });
    document.body.appendChild(o);
    const clamp = x => Math.min(1, Math.max(0, x));
    const ease = x => 1 - Math.pow(1 - clamp(x), 3);
    const seg = (t,a,b) => ease((t-a)/(b-a));
    const $ = id => document.getElementById(id);
    window.__gaiaText = (lt) => {
      const b = seg(lt,1.6,2.5); $('gbrand').style.opacity = b; $('gbrand').style.transform = `translateY(${(1-b)*0.9}vw)`;
      const s = seg(lt,2.3,3.2); $('gtitle').style.opacity = s; $('gtitle').style.transform = `translateY(${(1-s)*0.7}vw)`;
      const fo = seg(lt,4.7,5.0); o.style.opacity = 1 - fo;
    };
    window.__gaiaText(0);
  }, TITLE);
  // render loop: atom (1.2 -> 7.2 sobre los 5s) + texto por tiempo local
  for (let i = 0; i < N; i++) {
    const lt = i / FPS;
    const at = 1.2 + lt * 1.2;
    await page.evaluate(({at, lt}) => {
      window.__cinematicAtom.renderAt(at); window.__gaiaText(lt);
      // ocultar la etiqueta del elemento (React la re-monta al pasar t>2)
      document.querySelectorAll('div').forEach(d => {
        if (d.closest('#gaia-ov')) return;
        // solo la etiqueta (texto Z=n) que NO contenga el canvas del átomo
        if (/Z\s*=\s*\d/.test(d.textContent || '') && !d.querySelector('canvas')) d.style.display = 'none';
      });
    }, { at, lt });
    await page.waitForTimeout(90);
    await page.screenshot({ path: path.join(fdir, String(i).padStart(4,'0')+'.png') });
  }
  await browser.close();
  const slug = TITLE.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24);
  const out = path.join(__dirname, `gaia-intro-${slug}-4k.mp4`);
  execSync(`ffmpeg -y -framerate ${FPS} -i ${JSON.stringify(fdir+'/%04d.png')} -vf "format=p010le" -c:v hevc_nvenc -profile:v main10 -preset p6 -cq 15 -b:v 60M -maxrate 90M -bufsize 120M -r ${FPS} ${JSON.stringify(out)}`, { stdio:'ignore' });
  console.log('GAIA INTRO OK ' + out + ' (' + Math.round(fs.statSync(out).size/1024) + 'KB)');
})();
