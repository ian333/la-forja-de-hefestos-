const { chromium } = require('playwright');
(async () => {
  for (const angle of ['gles', 'gl', 'vulkan']) {
    try {
      const b = await chromium.launch({ headless: true,
        args: [`--use-angle=${angle}`, '--use-gl=angle', '--enable-gpu', '--ignore-gpu-blocklist',
               '--disable-software-rasterizer', '--no-sandbox'],
        env: { ...process.env, DISPLAY: ':0', GALLIUM_DRIVER: 'd3d12', MESA_D3D12_DEFAULT_ADAPTER_NAME: 'NVIDIA' } });
      const p = await (await b.newContext()).newPage();
      const r = await p.evaluate(() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2');
        if (!gl) return { ctx: 'NO-WEBGL2' };
        const e = gl.getExtension('WEBGL_debug_renderer_info');
        return { ctx: 'WEBGL2', renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?', ver: gl.getParameter(gl.VERSION) };
      });
      console.log(`[${angle}]`, JSON.stringify(r));
      await b.close();
    } catch (e) { console.log(`[${angle}] ERROR`, e.message.split('\n')[0]); }
  }
})();
