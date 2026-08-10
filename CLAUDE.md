# La Forja — instrucciones del proyecto (LÉEME SIEMPRE)

Visualizadores científicos R3F (física/astrofísica/química/bio) + cine para YouTube/IG/TikTok.
Render en **iangpu** (RTX 4070 Ti, WSL). El operador es **ian**.

> Toda instancia de Claude que trabaje aquí DEBE seguir estas reglas. No son sugerencias.

---

## 🥇 REGLA #0 — ANTES DE CUALQUIER VIDEO DE LA SERIE: LEE `docs/CANON-VIDEO.md`

**Antes de tocar 1 línea de un video de moléculas/enlaces: LEE `docs/CANON-VIDEO.md` y COPIA el
código del último GANADOR (O₂, N₂, C₂, H₂O v1/v2 — su código está respaldado en cápsulas).**
NO reinventes cámara, subtítulos ni estructura — reusa `O2Cloud`/`camera-shots.ts`/el formato ASS
de la serie y cambia lo MÍNIMO, 1 cambio a la vez. Reinventar lo ya hecho = EL fallo #1 recurrente.
CANON-VIDEO.md es el flujo canónico completo (física→voz→beats→render 4K→QA de agentes→ensamble→
cápsula→Comando) + los gotchas ya pagados. No es sugerencia: es un gate.

**Y un video nuevo NO crea archivos: es un MANIFIESTO.** `videos/<id>.json` + `bash scripts/video.sh
<id> todo` (subs→render paralelo→ensamble→cápsula). Las tomas van al registro `CAMERA_SHOTS` de
`CinematicMolecule.tsx`; una variante de cámara = otra entrada + `?cam=<x>`. PROHIBIDO crear
`<mol>-pipeline.sh`/`<mol>-assemble.sh`/`<mol>-ass*.py` o constantes `<MOL>_SHOTS` (ver Regla #0.5).

---

## 🔒 REGLA #0.7 — TRABAJO SOLO = BAJO ORDEN · y el CAD del molde YA EXISTE

**Trabajo en La Forja sin ian presente: SIEMPRE bajo una orden** (`ordenes/<fecha>-<slug>.md`,
copia `ordenes/PLANTILLA.md`). La orden declara TOCA/CREA/BORRA + evidencia ANTES de trabajar
— lo normal es `CREA: (nada)`. El juez es **`node scripts/orden-gate.cjs`**: mecánico, archivo
no declarado o censo que sube (archivos con `<Canvas` en `src/forja/`, entradas de vite,
`*.html` en raíz) = exit 1. Si a medio camino "necesitas" crear un archivo: **ALTO y pregunta**
— la orden se enmienda, no se improvisa.

**Toda vista 3D de molde/pieza vive en `ForgeBRepStudio.tsx`** (bag `mold` de `useMoldStudio.ts`,
paneles DOM en `MoldPanels.tsx`, comandos en `registry.ts`). Un `<Canvas>` nuevo bajo `src/forja/`
= deuda, salvo orden explícita de ian. Ya se pagó caro: 4 pantallas nuevas (6,880 líneas) cuando
el CAD ya tenía despiece/corte/apertura/rayos-X/sonda — y sus gates dieron 40/40 PASA, porque un
gate escrito por el mismo que comete el error mide coherencia interna, no derecho a existir.
(Las escenas de cine/átomos son OTRO dominio: ahí una escena por pieza es el diseño.)

---

## 🎬 MANDATO 4K (regla #1, dura)

**TODO el video que se entregue va en 4K.** Vertical (reels) = **2160×3840**. Horizontal = **3840×2160**.
10-bit (`yuv420p10le`) + NVENC. Nada se entrega en 1080 como master. El 1080 solo existe como
derivado/preview, jamás como entregable final.

El usuario también quiere **60 fps** donde aplique (cine puede ir 24; reels de acción 60). Confirmar fps por pieza.

## 🖥️ PIPELINE DE RENDER 4K — CANÓNICO (no improvisar otro)

El render headless 4K en WSL es delicado; ya pagamos caro descubrir lo que funciona. **USA ESTO:**

**Receta GPU (iangpu):** lanzar node con env `DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`
y Chrome con flags `--headless=new --use-angle=gl --enable-gpu --ignore-gpu-blocklist --disable-software-rasterizer`
(Playwright `headless:false` + esos flags = GPU real; verificar con `WEBGL_debug_renderer_info` → debe decir
`ANGLE (... D3D12 (NVIDIA GeForce RTX 4070 Ti) ...)`, NUNCA SwiftShader/llvmpipe).

**Lo que SÍ funciona (probado empíricamente):**
- **super=1** (4K nativo 2160×3840 = 8.3 MP). NUNCA super=2 (33 MP/screenshot satura y cuelga).
- **Un CONTEXTO de browser FRESCO por beat/lote**, cerrado al terminar (`ctx.close()`) → libera VRAM, cero fuga acumulada. Probado: 80+ frames estables por contexto, RSS sube y baja, ~1.2 s/frame.
- **`page.screenshot({ timeout: 30000 })`** — timeout FINITO. NUNCA `timeout: 0` (cuelgue infinito si el contexto se degrada).
- Encode con **NVENC**: `-c:v hevc_nvenc -pix_fmt yuv420p10le` (4K 10-bit en GPU, instantáneo). `h264_nvenc` para entrega.
- Determinismo: la escena expone `window.__cinematic*.renderAt(t)` PURO en t (sin random runtime, sin reloj) → cache por beat reproducible.

**Lo que NO funciona / NO usar:**
- ❌ `HeadlessExperimental.beginFrame` — removido en Chrome 147+ (tenemos 148).
- ❌ `headless-gl` puro — solo WebGL1 y rompe EffectComposer/drei/postFX.
- ❌ Reciclar el contexto a mitad de un beat (frágil, cuelga). Aislar POR beat, no intra-beat.
- ❌ `--headless` con super≥2 a 4K, o screenshots PNG uno-por-uno sin aislar contexto (fuga → cuelgue ~frame 110).

**Scripts canónicos** (`scripts/`): `render-bh-comercial.cjs` (render 4K por beat + grade DaVinci 10-bit + NVENC + audio + outro GAIA — es la plantilla a copiar para nuevas escenas), `bh-sound-design.py` (sonido determinista), `grab-stills.cjs` (stills rápidos de verificación).

## 👁️ GATE DE CALIDAD (correr ANTES de cada render 4K)

Antes de invertir ~45 min en un render 4K, pasar el **portero**:
`node scripts/critic-gate.cjs --url <preview> --hook <hook>` → captura 1 still por beat y FALLA (exit 1) si detecta:
**morado** (negro teñido), **confeti** (verde/rojo por chromaticAberration sobre starfield), o **frame-negro**
(sombra que llena el cuadro por la ley geométrica). Para crítica de fotografía con un agente que VE las imágenes:
`scripts/critic-eye.cjs` (captura + manifiesto Markdown que un agente Opus abre con Read y juzga).

## ⚠️ DEFECTOS CONOCIDOS Y SUS CAUSAS (no re-descubrir)

- **Negro morado** → DOS causas distintas (medir cuál antes de tocar): (1) la nebulosa del shader (`BHRaytraced.tsx stars()`) con tinte lavanda (azul>rojo) — usar gris-frío tenue + `saturation` postFX ~0.04. (2) **EL GRADE ffmpeg** (`render-bh-comercial.cjs buildGradeFilter`): el crush flojo (0.04) dejaba VIVO el polvo nebular azul tenue y la halación roja lo bañaba → morado. **Prueba decisiva: extraer un frame del cache A_ (base, sin grade) vs B_ (graded). Si A=negro y B=morado, el morado lo mete el GRADE, NO la escena** (¡no pierdas horas en el shader!). Fix (davinci-v2-negros): crush a 0.14, eq saturation 0.88, halación CONTENIDA (sigma×11, opacity 0.16, highs aislados 0.78) → el void cae a negro PURO y el glo cálido abraza el disco. Más visible en 16:9 (más void) que en 9:16.
- **Confeti verde/rojo** → `chromaticAberration > ~0.1` sobre el starfield. Mantener 0 (o ≤0.05) en planos con muchas estrellas.
- **Frame negro en POV cerca del horizonte** → LEY GEOMÉTRICA: si `asin(b_crit/r) ≥ fov/2`, la sombra (b_crit=2.598·rs) llena el cuadro. Mantener la cámara donde el disco/anillo llena el frame.
- **Doble tonemap** → el shader emite HDR lineal (`linearOutput`) y `CinematicPostFX` hace el ÚNICO ACES. Nunca dos.
- **maxSteps** en BHRaytraced: 200 (científico) / 110 (alivia 4K). No bajar globalmente (otros módulos lo usan).

## 🔬 FÍSICA REAL (regla dura del proyecto)

Toda viz científica usa fórmulas reales (Kepler, Shakura-Sunyaev T∝r^-3/4, Doppler δ⁴, Blandford-Znajek,
Schwarzschild, photon ring √27/2·rs, etc.). NUNCA inventar ni hardcodear curvas. Datos reales (NASA/USGS/PDB)
para Tierra/Luna/planetas/proteínas — no estilizar. Lo evocativo se ETIQUETA como tal. El wow EMERGE de la corrección.

## 🛠️ OPERACIÓN

- **iangpu** = `ssh ian@100.65.173.85`, repo en **`/home/ian/Orkesta/la-forja`** (mismo path que la laptop).
  REGLA: SIEMPRE `cd /home/ian/Orkesta/la-forja &&` o usar rutas absolutas — un ssh pelón cae en `$HOME`.
- iangpu tiene su PROPIO filesystem → **rsync/scp el source editado ANTES de cada `npm run build`** o el video sale con código viejo.
- **NO builds/tsc/dev locales** (RAM limitada). Build y render se hacen en iangpu (`npx vite build` + `npx vite preview --port 4173`).
- Convención de uniforms: NUNCA inline en `<shaderMaterial>`; `useMemo` una vez + mutar `.value` en `useFrame`.
- NO `drei <Text>` dentro de un Canvas con EffectComposer (crashea). Captions = overlay DOM o quemados en ffmpeg.
- Copy/voiceover/comentarios: **español mexicano** (tú/tienes/eleva, NUNCA vos/tenés/elevás).

## 📐 DOCTRINA DE CINE (cuando se renderiza video)

> **LÉE `docs/FILOSOFIA-CINE.md` ANTES de cualquier render.** Es la doctrina completa:
> cada ángulo y decisión se toma por BELLEZA + TEXTURA + COLOR + MONSTRUOSIDAD (que se
> SIENTA el poder). Mandatos duros que salen de ahí: **OCUPAR TODA LA PANTALLA** (cero
> letterbox 2.39:1 en el entregable, cero void muerto); **ESCALA por referencia** (horizonte
> planetario / parallax+ancla / dato-awe — nunca esfera sola en void vacío); **VELOCIDAD
> sentida** por estelas=motion-blur + parallax + beaming δ⁴ + cámara en traslación (no marea);
> el lab interactivo se queda 3D, los renders son videos ULTRA-IMPACTANTES no navegables.
> **Color técnico accionable: `docs/DOCTRINA-COLOR.md`** (rampa T→sRGB con hex, líneas de
> emisión, falso-color Chandra, valores de grade, recetas por objeto, checklist). Léelo antes de tocar color.

1 objeto principal, fondo negro real, bloom de threshold bajo (los picos REVIENTAN), grade tipo DaVinci 10-bit
(halación rojo-ámbar real, grano de película, split-tone, dither anti-banding). Cámara con PESO determinista
(`CinematicCamera.WeightedRig`, pura en t). Escala por contraste (objeto de referencia + parallax). El SILENCIO
es recurso dramático (sonido de golpe → silencio en el zoom-out). Cortes secos motivados, no crossfades.
Cada escena de cine = biblioteca de **beats reutilizables y cacheables** (ver `CinematicBHReel.tsx`).
