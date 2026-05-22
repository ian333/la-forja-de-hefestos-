# Render GPU pipeline (iangpu · RTX 4070 Ti · NVENC HEVC 10-bit)

Pipeline GPU end-to-end para grabar masterclasses en **4K 10-bit HEVC** usando
captura WebGL2 acelerada por NVIDIA + encode NVENC. **No CPU SwiftShader.**

## Por qué este pipeline existe (vs `render.cjs` genérico)

El pipeline original (`render.cjs` + `capture.cjs` + `encode.cjs`) corre en la
laptop local con WSL2 Ubuntu 20.04 — Mesa 21.2 da máximo OpenGL 3.1, **WebGL2
no acelerado**. Chrome cae a SwiftShader (~2 fps a 4K), encode libx264 CPU
(CRF 18). Funciona pero es lento y CPU-bound.

Este pipeline corre en **iangpu** (Tailscale `100.65.173.85`, RTX 4070 Ti,
WSL2 Ubuntu 24.04, Mesa 25.2). Ahí Chrome → ANGLE → D3D12 → NVIDIA da
**WebGL2 OpenGL 4.6 acelerado** (~26 fps a 4K en escenas R3F con bloom/postFX),
y `ffmpeg 6 + hevc_nvenc` encodea 10-bit Main10 en GPU.

## Cuándo usar cuál

| Use-case | Script | Backend |
|---|---|---|
| Render rápido local, draft, no GPU disponible | `render.cjs <classId>` | CPU SwiftShader + libx264 |
| **Render final 4K 10-bit calidad master** | `render-limones.cjs` (Limones) o derivado | **NVENC HEVC 10-bit GPU** |
| Captura determinista frame-by-frame (renderAt) | `capture-deterministic.cjs` | demanda externa |

## Render Limones (ejemplo concreto, ya probado)

```bash
# En iangpu
ssh ian@100.65.173.85
cd ~/Orkesta/la-forja

# 1) Asegurar dist fresco
npm run build

# 2) Levantar vite preview
nohup npx vite preview --host --port 5174 > /tmp/vite.log 2>&1 &

# 3) Lanzar render con env vars GPU CRÍTICAS
DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
  nohup node scripts/video-gaia/render-limones.cjs \
    --skip-server --base-url http://localhost:5174 \
    > /tmp/limones-render.log 2>&1 &

# 4) Monitorear (cada 30s imprime progreso)
tail -F /tmp/limones-render.log

# 5) Output final
ls -lh dist-video/econ-01-limones/limones-4k-10bit.mkv
```

**Output esperado** (medido 2026-05-22 en RTX 4070 Ti, 25 escenas Limones):
- Captura: ~12.5 min wall (1× realtime), 19,485 frames @ 26 fps avg
- Encode HEVC NVENC: ~17 min (0.7× realtime, preset p7 multipass fullres)
- Mux: ~40 s
- Total wall: ~30 min
- MKV final: **1.04 GB · 4K UHD · HEVC Main 10 · yuv420p10le · 60 fps · 12 Mbps avg**

## Env vars críticas (sin esto Chrome cae a llvmpipe CPU)

| Variable | Valor | Por qué |
|---|---|---|
| `DISPLAY` | `:0` | WSLg display, sin esto Chrome no abre |
| `GALLIUM_DRIVER` | `d3d12` | Forza Mesa al driver D3D12 (sin esto: llvmpipe CPU) |
| `MESA_D3D12_DEFAULT_ADAPTER_NAME` | `NVIDIA` | Selecciona la GPU NVIDIA (si hay varias) |

## Chrome flags críticos (en el script)

```js
chromium.launch({
  headless: false,                              // Playwright headless mode = viejo, no GPU
  executablePath: '/usr/bin/google-chrome-stable', // system Chrome, NO bundled Playwright
  args: [
    '--no-sandbox',
    '--headless=new',                            // new headless mode = GPU OK
    '--ignore-gpu-blocklist',
    '--enable-gpu', '--enable-gpu-rasterization', '--enable-zero-copy',
    '--enable-webgl', '--enable-accelerated-2d-canvas',
    '--disable-software-rasterizer',             // matar fallback CPU
    `--window-size=${W},${H}`,
  ],
});
```

**Verificación** (en `gl.getExtension('WEBGL_debug_renderer_info')`):
```
ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Ti), OpenGL 4.6)
```
Si ves `SwiftShader` o `llvmpipe`, falta una env var o el flag `--use-angle=vulkan`
está mal (cae a Mesa llvmpipe porque dzn Vulkan driver no funciona con NVIDIA en
WSL2 — usar OpenGL D3D12 path).

## NVENC HEVC 10-bit args (ffmpeg 6+)

```
-c:v hevc_nvenc -preset p7 -tune hq -profile:v main10 -pix_fmt p010le
-tier 1 -rc vbr -multipass fullres -cq 16 -b:v 150M -maxrate 250M -bufsize 500M
-spatial_aq 1 -temporal_aq 1 -aq-strength 8 -rc-lookahead 32
-bf 3 -b_ref_mode middle -g 120
```

Overrides via env: `CQ`, `BV`, `MBV`, `BUF` (defaults: 16, 150M, 250M, 500M).

## Generalizar a otras masterclases

`render-limones.cjs` es específico para `econ-01-limones` porque esa clase
usa `LimonesCinematicChain` (25 escenas con audio per-componente,
**no usa el manifest del Player**).

Para otras clases que SÍ usan el manifest estándar (todas las econ-02..18,
phys-*, blackhole, etc.), conviene un `render-class-gpu.cjs` que:
1. Lee `public/audio/masterclass/<classId>/manifest.json` para el orden y duración de escenas
2. Captura `/masterclass.html?id=<classId>&render=1`
3. Concatena los MP3 del manifest para audio
4. Encode + mux igual que Limones

Patrón a copiar: ver `render-limones.cjs` líneas 96-110 (probe duración) y
175-310 (capture/encode/mux core). El único cambio es la fuente del audio list.

## Limitaciones conocidas

- **WSL Ubuntu 20.04 (la laptop del user) NO sirve para este pipeline**: Mesa
  21.2 da OpenGL 3.1, WebGL2 falla. Siempre usar iangpu.
- **Vulkan dzn driver no funciona con NVIDIA en WSL2** (bug NVIDIA forums 183+ días).
  Si `--use-angle=vulkan` cae a Mesa llvmpipe, ignorar ese flag.
- **Audio drift**: el script usa wall-clock para alinear video+audio. Diferencia
  típica < 500ms en clip de 12 min. Si necesitás sync perfecto, usar pipeline
  determinista `capture-deterministic.cjs` (requiere refactor de escenas a
  `renderAt(t)`).
- **MKV output 1+ GB**: `dist-video/` está gitignored. Para distribuir, mover a
  `/mnt/hdd/` o subir directo a YouTube/Drive.
