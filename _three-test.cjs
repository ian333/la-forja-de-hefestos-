const puppeteer = require('puppeteer');
async function test(label, args) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', ...args] });
  const page = await browser.newPage();
  await page.goto('data:text/html,<canvas id=c></canvas><script>const c=document.getElementById("c");const g2=c.getContext("webgl2");const g1=!g2?c.getContext("webgl"):null;const g=g2||g1;if(!g){window.R={error:"NO_CTX"};}else{const e=g.getExtension("WEBGL_debug_renderer_info");window.R={webgl2:!!g2,r:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),ext:{ANGLE_instanced_arrays:!!g.getExtension("ANGLE_instanced_arrays"),OES_texture_float:!!g.getExtension("OES_texture_float"),EXT_color_buffer_half_float:!!g.getExtension("EXT_color_buffer_half_float"),EXT_color_buffer_float:!!g.getExtension("EXT_color_buffer_float"),WEBGL_draw_buffers:!!g.getExtension("WEBGL_draw_buffers")}};}</script>');
  await new Promise(r => setTimeout(r, 1000));
  const r = await page.evaluate(() => window.R);
  console.log(label.padEnd(28), JSON.stringify(r).slice(0, 300));
  await browser.close();
}
(async () => {
  for (const [l, a] of [
    ['gl + headless new', ['--use-angle=gl', '--ignore-gpu-blocklist', '--enable-webgl']],
    ['d3d11 + headless new', ['--use-angle=d3d11', '--ignore-gpu-blocklist']],
    ['vulkan + headless new', ['--use-angle=vulkan', '--ignore-gpu-blocklist']],
    ['default + headless new', ['--ignore-gpu-blocklist']],
    ['gl + headless=false', ['--use-angle=gl', '--ignore-gpu-blocklist']],
  ]) {
    try { await test(l, a); } catch (e) { console.log(l.padEnd(28), 'FAIL:', e.message.slice(0, 100)); }
  }
})();
