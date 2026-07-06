// gen-gaia-outro-alfa.cjs — OUTRO: el α de Gaia en reposo + Sigue aprendiendo. Standalone.
// uso: node gen-gaia-outro-alfa.cjs "Relacionado 1|Relacionado 2" [salida.mp4]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
(async () => {
  const REL = process.argv[2] || 'Cómo dar de alta un producto|Cómo dar de alta un cliente';
  const OUT = process.argv[3] || path.join(__dirname, 'gaia-outro-alfa-4k.mp4');
  const DUR = 5.0, FPS = 30, N = Math.round(DUR * FPS);
  const fdir = '/tmp/gaia_oalfa_frames_' + (process.env.RUNNER_ID || 'x'); fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
  const exe = fs.existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined;
  const browser = await chromium.launch({ headless: false, executablePath: exe,
    args: ['--no-sandbox','--disable-setuid-sandbox','--headless=new','--force-color-profile=srgb','--allow-file-access-from-files'] });
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + path.join(__dirname, 'gaia-outro-alfa.html') + '?rel=' + encodeURIComponent(REL));
  await pg.waitForFunction(() => document.getElementById('alfa').complete, null, { timeout: 20000 });
  await pg.waitForTimeout(400);
  for (let i = 0; i < N; i++) {
    await pg.evaluate(t => window.render(t), i / FPS);
    await pg.screenshot({ path: path.join(fdir, String(i).padStart(4, '0') + '.png') });
  }
  await browser.close();
  execSync(`ffmpeg -y -framerate ${FPS} -i ${JSON.stringify(fdir + '/%04d.png')} ` +
    `-vf "scale=3840:2160:flags=lanczos,format=p010le" -c:v hevc_nvenc -profile:v main10 -preset p6 -cq 15 -b:v 60M -maxrate 90M -bufsize 120M -r ${FPS} ${JSON.stringify(OUT)}`,
    { stdio: 'ignore' });
  console.log('ALFA OUTRO OK ' + OUT);
})();
