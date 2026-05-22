# GAIA video pipeline · `scripts/video-gaia/`

Convierte cada masterclass de la-forja en un video 4K listo para YouTube.

> **Pipeline GPU oficial (NVENC HEVC 10-bit)**: ver [`RENDER-GPU.md`](./RENDER-GPU.md).
> Probado 2026-05-22 en iangpu (RTX 4070 Ti) con Limones. 1.04 GB · 4K · HEVC Main10.
> El pipeline de abajo (CPU libx264) se mantiene como fallback / draft.

## Arquitectura

```
masterclass.html?id=X&render=1     bumpers/intro.html
bumpers/outro.html                  ─┐
                                    │
        Playwright + CDP screencast │
                                    ▼
        PNG sequences (dist-video/.tmp/<id>/)
                                    │
        ffmpeg                      ▼
        ├─ encode @ libx264 4K 60fps CRF 18
        ├─ concat intro + main + outro
        ├─ mux audio (silencio intro + MP3s + silencio outro)
        ├─ subs .vtt + .srt
        ├─ thumbnail.png
        └─ metadata.txt
                                    ▼
                       dist-video/<id>/
                          ├─ video.mp4
                          ├─ subs.vtt
                          ├─ subs.srt
                          ├─ thumbnail.png
                          └─ metadata.txt
```

## Comandos

```bash
# Build dist first (recomendado — preview es más rápido que dev)
npm run build

# Render una clase
node scripts/video-gaia/render.cjs phys-einstein-pe

# Render todas (22 clases)
node scripts/video-gaia/render.cjs --all

# Mantener PNGs intermedios para debugging
node scripts/video-gaia/render.cjs phys-einstein-pe --keep-tmp

# Saltarse el lanzamiento del server (úsalo si ya tienes npm run preview corriendo)
node scripts/video-gaia/render.cjs phys-einstein-pe --skip-server --base-url http://localhost:5001
```

## Decisiones de diseño

- **Player como fuente única**: añadimos `?render=1` al Player existente en lugar de un renderer paralelo. Las escenas R3F y el subtítulo del Player ya son lo que sale al YouTube — burn-in automático.
- **`?render=1`**:
  - Auto-start cuando carga el manifest
  - Oculta controles, salida, chiclet bar
  - Expone `window.__renderStatus = {idx, total, started, ended}` para sincronización
- **Captura real-time**: la animación corre a velocidad natural; CDP screencast emite frames a la velocidad que el browser pueda. ffmpeg resamplea al output target con `-vf fps=60`.
- **Audio aparte**: el `<audio>` del Player se reproduce silenciosamente; los MP3 originales se concatenan después con ffmpeg para sincronización exacta.
- **Subs duplicados**: el subtítulo del Player ya queda quemado en el frame. Además generamos `subs.vtt` para que YouTube CC permita activar/desactivar y auto-traducir.

## Output esperado

```
dist-video/
└── phys-einstein-pe/
    ├── video.mp4         ~3 GB · 4K · 60fps · H.264 CRF 18
    ├── subs.vtt          subtítulos sincronizados (YouTube CC)
    ├── subs.srt          equivalente SRT
    ├── thumbnail.png     frame del 30% del main video
    └── metadata.txt      título · playlist · tags · descripción · capítulos
```

## Limitaciones conocidas

- En WSL2 con GPU NVIDIA, Chromium **no tiene acceso a /dev/dri** → WebGL cae a swiftshader (software CPU).
  - A 4K nativo: ~2 fps real (inusable)
  - A 1440p: ~12 fps real → capturamos aquí y upscalamos a 4K en ffmpeg con Lanczos
  - **Output efectivo**: video 4K @ 30fps, fluidez visual equivalente a ~12fps real con duplicación
- Para 4K @ 60fps **verdaderamente fluido**, dos caminos:
  1. **Migrar a `renderAt(t)` determinista** — el Canvas se vuelve `frameloop="demand"`, el clock de R3F se controla externamente, `puppeteer` hace `page.evaluate(window.renderAt(t)) + page.screenshot()` por cada frame. Cada PNG es exacto sin importar la velocidad GPU. Pattern probado por `marketing/gaia-reveal/`. **Requiere refactor de las escenas R3F** que actualmente usan `performance.now()` directo (CascadeQuanticaScene, MillikanDataScene).
  2. Renderear en una máquina con GPU expuesta + drivers mesa instalados (no WSL).
- El upload a YouTube es manual: llevas `dist-video/<id>/` a YouTube Studio.

## Outro

Usa el MP4 pre-renderizado por la otra IA: `/home/ian/Orkesta/Orkesta/marketing/gaia-reveal/output/gaia-v6_16x9_1080p.mp4` (7s · 1080p · 30fps · sin audio). Se reescala a 4K con Lanczos al encode. Para cambiar el outro, edita `OUTRO_VIDEO` y `OUTRO_VIDEO_SEC` en `lib.cjs`.
