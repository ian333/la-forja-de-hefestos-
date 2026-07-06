// gen-gaia-outro.cjs — OUTRO Gaia: átomo (cierre) + "Sigue aprendiendo" + relacionados. Inter.
// uso: node gen-gaia-outro.cjs "Relacionado 1|Relacionado 2"
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
(async () => {
  const W = 3840, H = 2160, Z = parseInt(process.env.Z || '8', 10);
  const RELATED = (process.argv[2] || 'Cómo hacer una compra|Obras y rentabilidad').split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const DUR = 5.0, FPS = 30, N = Math.round(DUR * FPS);
  const fdir = '/tmp/gaia_outro_frames'; fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
  const exe = fs.existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined;
  const browser = await chromium.launch({ headless: false, executablePath: exe,
    args: ['--no-sandbox','--disable-setuid-sandbox','--headless=new','--ignore-gpu-blocklist',
      '--enable-gpu','--enable-gpu-rasterization','--enable-webgl', `--window-size=${W},${H}`] });
  const ctx = await browser.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:1, bypassCSP:true });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__GAIA_BRAND = 1; });
  await page.goto(`http://localhost:5001/cinematic-atom.html?z=${Z}`, { waitUntil:'networkidle', timeout:60000 });
  // Vite frío: doble carga (la 1a dispara reload de deps y mata el contexto)
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil:'networkidle' }).catch(() => {});
  await page.waitForFunction(() => window.__cinematicAtom && window.__cinematicAtom.renderAt, null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  await page.evaluate((related) => {
    const o = document.createElement('div'); o.id = 'gaia-ov';
    const items = related.map(r => `<div class="git" style="font-family:'Inter',system-ui,sans-serif;font-size:1.9vw;font-weight:400;color:rgba(255,255,255,0.72);letter-spacing:0.01em;margin-top:0.8vw;opacity:0">▸  ${r}</div>`).join('');
    o.innerHTML = `
      <div id="ohead" style="font-family:'Inter',system-ui,sans-serif;font-size:3.4vw;font-weight:200;color:#fff;letter-spacing:-0.02em;line-height:1;opacity:0;text-shadow:0 4px 55px rgba(0,0,0,.7)">Sigue aprendiendo</div>
      <div style="margin-top:1.4vw">${items}</div>
      <div id="obrand" style="font-family:'Inter',system-ui,sans-serif;font-size:1.5vw;font-weight:300;color:rgba(255,255,255,0.5);letter-spacing:0.02em;margin-top:2.4vw;opacity:0">GAIA Prime</div>`;
    Object.assign(o.style, { position:'fixed', left:'7%', bottom:'13%', zIndex:'99999',
      display:'flex', flexDirection:'column', alignItems:'flex-start', textAlign:'left', pointerEvents:'none' });
    document.body.appendChild(o);
    const clamp = x => Math.min(1, Math.max(0, x));
    const ease = x => 1 - Math.pow(1 - clamp(x), 3);
    const seg = (t,a,b) => ease((t-a)/(b-a));
    const $ = id => document.getElementById(id);
    const gits = [...document.querySelectorAll('.git')];
    window.__gaiaOut = (lt) => {
      const h = seg(lt,0.8,1.7); $('ohead').style.opacity = h; $('ohead').style.transform = `translateY(${(1-h)*0.9}vw)`;
      gits.forEach((g,i) => { const s = seg(lt, 1.4 + i*0.35, 2.2 + i*0.35); g.style.opacity = s; g.style.transform = `translateX(${(1-s)*1}vw)`; });
      $('obrand').style.opacity = seg(lt,2.6,3.4);
      const fo = seg(lt,4.7,5.0); o.style.opacity = 1 - fo;
    };
    window.__gaiaOut(0);
  }, RELATED);
  // átomo en fase "mirada/contemplación" (calmado): at 9 -> 13.5
  for (let i = 0; i < N; i++) {
    const lt = i / FPS, at = 9.0 + lt * 0.9;
    await page.evaluate(({at, lt}) => {
      window.__cinematicAtom.renderAt(at); window.__gaiaOut(lt);
      document.querySelectorAll('div').forEach(d => {
        if (d.closest('#gaia-ov')) return;
        if (/Z\s*=\s*\d/.test(d.textContent || '') && !d.querySelector('canvas')) d.style.display = 'none';
      });
    }, { at, lt });
    await page.waitForTimeout(90);
    await page.screenshot({ path: path.join(fdir, String(i).padStart(4,'0')+'.png') });
  }
  await browser.close();
  const out = path.join(__dirname, 'gaia-outro-4k.mp4');
  execSync(`ffmpeg -y -framerate ${FPS} -i ${JSON.stringify(fdir+'/%04d.png')} -vf "format=p010le" -c:v hevc_nvenc -profile:v main10 -preset p6 -cq 15 -b:v 60M -maxrate 90M -bufsize 120M -r ${FPS} ${JSON.stringify(out)}`, { stdio:'ignore' });
  console.log('GAIA OUTRO OK ' + out);
})();
