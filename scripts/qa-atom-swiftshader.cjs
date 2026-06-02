/** Reproduce el entorno del usuario: WebGL por SOFTWARE (SwiftShader), como Brave
 *  sin aceleración HW. Si el átomo Cinematic sale BLANCO aquí → reproducido. */
const { chromium } = require('playwright');
(async () => {
  const W = 1540, H = 860;
  const mode = process.env.GLMODE || 'swift';
  const args = ['--no-sandbox', '--headless=new', `--window-size=${W},${H}`];
  if (mode === 'swift') {
    // forzar render por software / SwiftShader (sin GPU)
    args.push('--disable-gpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  } else {
    args.push('--enable-gpu', '--use-gl=angle', '--ignore-gpu-blocklist');
  }
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args });
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, bypassCSP: true })).newPage();
  await p.goto('http://localhost:5012/lab.html', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(3000);
  // reportar el renderer real
  const info = await p.evaluate(() => {
    const c = document.querySelector('canvas'); if (!c) return 'no-canvas';
    const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'no-gl';
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '??',
      canvas: c.width + 'x' + c.height,
      floatBuf: !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')),
    };
  });
  console.log('RENDERER:', JSON.stringify(info));
  await p.locator('button:has-text("Cinematic")').first().click({ force: true });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `/tmp/atom-${mode}.jpg`, type: 'jpeg', quality: 82 });
  await b.close();
  console.log('ok → /tmp/atom-' + mode + '.jpg');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
