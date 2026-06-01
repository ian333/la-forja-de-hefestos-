#!/usr/bin/env node
/* gl-probe.cjs — prueba combinaciones de flags de Chrome para encontrar cual da
 * WebGL2 con GPU real en iangpu (WSL + RTX via D3D12 ANGLE). Imprime, por set:
 * version de WebGL y UNMASKED_RENDERER. El "ganador" es el que reporte la RTX. */
const { chromium } = require('playwright');

const COMMON = ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new',
  '--ignore-gpu-blocklist', '--enable-gpu', '--disable-software-rasterizer',
  '--hide-scrollbars', '--window-size=640,480'];

const SETS = {
  'A_atoms_like': [...COMMON, '--enable-gpu-rasterization', '--enable-webgl', '--disable-background-timer-throttling'],
  'B_angle_d3d12': [...COMMON, '--use-gl=angle', '--use-angle=d3d12', '--enable-unsafe-webgpu'],
  'C_angle_gl': [...COMMON, '--use-gl=angle', '--use-angle=gl'],
  'D_angle_vulkan': [...COMMON, '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan'],
  'E_egl': [...COMMON, '--use-gl=egl'],
  'F_swiftshader': ['--no-sandbox', '--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=640,480'],
};

const HTML = 'data:text/html,<canvas id=c></canvas>';

(async () => {
  for (const [name, args] of Object.entries(SETS)) {
    let line = `${name}: `;
    try {
      const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable', args });
      const page = await browser.newPage();
      await page.goto(HTML, { waitUntil: 'load', timeout: 20000 });
      const info = await page.evaluate(() => {
        const c = document.getElementById('c');
        const g2 = c.getContext('webgl2');
        const g1 = g2 || c.getContext('webgl') || c.getContext('experimental-webgl');
        if (!g1) return { ver: 'NONE', renderer: '-' };
        const ext = g1.getExtension('WEBGL_debug_renderer_info');
        const r = ext ? g1.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'masked';
        return { ver: g2 ? 'webgl2' : 'webgl1', renderer: r };
      });
      line += `${info.ver} | ${info.renderer}`;
      await browser.close();
    } catch (e) {
      line += `ERR ${e.message.split('\n')[0].slice(0, 80)}`;
    }
    console.log(line);
  }
})();
