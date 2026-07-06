# La Forja — ERRORES, DESVIACIÓN y ONBOARDING (LEER PRIMERO cada sesión)

> Documentación destilada de la sesión 2026-07-01 (~20 drives reales del proceso).
> Objetivo: que la siguiente instancia NO repita las desviaciones. Las imágenes de
> verificación (RESULT vs LIBRO) están en `docs/forja-libro-verificacion/`.

## 📌 QUÉ LEER, EN ORDEN
1. `docs/forja-tutoriales-libro-PROGRESO.md` — avance real + planes por tutorial + puerto/estado iangpu.
2. ESTE doc — los errores y las reglas duras que salieron de ellos.
3. `docs/forja-libro-verificacion/` — pares RESULT_*/LIBRO_* para calibrar el ojo (así ves qué "salió bien").
4. Memoria `project-forja-cadcam-libros` + `reference-forja-drive-harness`.

## 🩸 LOS ERRORES (agrupados, ordenados por gravedad)

### A. VERIFICACIÓN — entregar sin ver (el peor)
- **Entregué el video del yoke (c4t3) SIN ver sus frames finales** → salió una "forma U pelona" sin barrenos, con geometría mal interpretada. El user lo cachó al instante.
- **REGLA DURA:** ningún video/pieza se da por bueno sin: (1) `ffmpeg -sseof -N -i vid.mp4 -frames:v 1` + `Read` los frames FINALES (turntable), (2) volumen kernel vs volumen calculado a mano, (3) comparar contra la figura del libro (`docs/forja-libro-verificacion/LIBRO_*`). "DRIVE_OK" ≠ correcto.

### B. INTERPRETACIÓN de figuras — de aquí salió CASI TODA la desviación
- Malinterpreté vistas ortográficas del yoke (front/top/section) → puse el ⌀60 donde caía en la ranura; gasté muchos ciclos adivinando cotas.
- **Mapeo imagen→figura es DIFUSO** (el caption va DESPUÉS de la imagen en el xhtml) → confié en el número de imagen y era otra figura (133=Fig 4-34, no 4-36).
- **REGLAS:** (1) identifica qué vista es cuál (front vs top vs section) ANTES de dibujar; (2) ancla en un sub-feature ya verificado (ej. la cara 130×100 del brazo) y construye alrededor; (3) las cotas VIVEN en las figuras → VE la figura, nunca adivines; (4) VE la imagen para confirmar su caption antes de usarla.

### C. MÉTODO — construir vs reproducir (corrección del user)
- Construí funciones a ciegas (face-by-normal, mirror) ANTES de toparme con el tutorial que las pedía.
- **REGLA (textual del user):** "NO construyes para terminar un tutorial, INTENTAS hacer el tutorial y ves qué funciones te faltan para continuar." → tutorial-driven: intenta → choca → construye SOLO el hueco → sigue.
- Me detuve/reporté demasiado. **REGLA:** trabajo CONTINUO, entrega VIDEOS mp4 (a Downloads de ambas PC), NO reportes; solo aparecer al terminar el libro o en bloqueo real (infra caída).

### D. PRECISIÓN dimensional
- Barrenos salieron ⌀15.4/⌀59.4 vs 15/60 (deriva ~1-2% del clic-radio a ojo).
- **REGLA:** fijar diámetros/longitudes con COTA (`dimDiam`/`dimDist` del hook), no solo con el clic del radio. Croquis debe quedar fully-defined (negro) antes de extruir.

### E. INFRA (gotchas)
- ssh sin `cd` cae en $HOME (lo hice 6× seguidas) → SIEMPRE `bash scripts/forja-run.sh <cmd>` (bakea el cd).
- iangpu INESTABLE hoy (4 reboots): patrón = esperar ping (`until ping…; do sleep 30; done` en background) → rearrancar vite → seguir, sin perder estado (código en /home persiste; /tmp se borra en reboot).
- Vite hace fallback de puerto (5001→5002 si ocupado); confirmar puerto con `curl` antes de driftar.

## 📌 CONVENCIÓN croquis-en-cara (2026-07-02): en la cara X-min del yoke, la **v del plano apunta ABAJO en el mundo** (los triángulos de chaflán a y=+15..50 salieron cortando la BASE). Al croquizar en cara: si la posición vertical importa, verificar con el primer corte o invertir el signo de y. Fix futuro: normalizar planeFromMeshFace para que v siempre apunte +Z-mundo (proyección).

## 📌 LECCIONES DEL LIBRO CAM (2026-07-02)
- **ssh a iangpu SIN cd** me pasó 3 VECES MÁS en una sola sesión → usar SIEMPRE `ssh iangpu 'bash /home/ian/Orkesta/la-forja/scripts/forja-run.sh env VAR=… <cmd>'` (env vars como argumentos de `env`, el wrapper bakea el cd). Y el drive EXIGE el env GPU (`DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`) o WebGL muere y los picks 3D caen al vacío.
- **Clic 3D por pixel: calibrar SOBRE el frame post-Encuadrar** (`btn-fit` → vista determinista por bbox → los pixeles SON reproducibles entre corridas de la misma pieza). Calibrar sobre la vista pre-fit me costó 2 corridas: el clic cayó en la silueta/arista, el pick quedó ARMADO y se disparó durante el turntable (creó un Agujero fantasma en el fondo de la ranura).
- **`hook` vs `main` en el arnés**: `hook` = window.__sketchEditor (dimDiam/dimArcR/pick…), `main` = window.__forgeBrep (sketchOnTopFace/setActiveCompPattern/camDrillAuto…). Confundirlos = el fn se traga silencioso.
- **Slider Radio con step=1 rechaza ⌀6.8** (fill "3.4" = Malformed value; un humano tampoco podría) → step 0.1. El libro (broca ⌀6.8 piloto M8) fue quien encontró el hueco.

## 🔧 FIXES PENDIENTES (prioridad)
1. ✅ **HECHO 2026-07-01: la LÍNEA SIGUE el mouse** (rubber-band). SketchEditor.tsx: estado `lineCursor`, se setea en `onPointerMove` cuando tool='line' && draft!=null, render de `<line>` punteada del `draft` al cursor, limpieza en selectTool. VERIFICADO por sight (linepreview.png).
2. **Selección de contornos** (un croquis → varios features por contorno) — lo pide c5t1.
3. Cotas exactas (dimDiam) para matar la deriva del 1%.
4. Revolve deja un extrude fantasma (sk-finish auto-extruye; el revolve lo tapa pero ensucia el timeline).
5. Refinar c4t3 (patrón en AMBAS paredes + chaflán + 2×⌀10) y c4t4 (rayos por corte-en-cara + patrón circular ×6 + crank pin).

## ✅ LO QUE SÍ FUNCIONA (no re-descubrir)
Funciones construidas + verificadas 2026-07-01: **croquis-sobre-cara** (corte/saliente/cualquier cara, `sketchOnFace/TopFace/BottomFace/FaceDir`, arnés action `main`), **TRIM** (círculo→arco), **mirror-feature** (`Component.mirror`), fix tope-extrude (80→3000). Videos correctos entregados: c4t1 eslabón, c4t2 revolve, c4t3 yoke, c4t4 rueda-base. Detalle técnico en PROGRESO.md.
