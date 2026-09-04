# ORDEN: EL VIDEO DEL CAMINO — el happy path se ve en un video antes de que ian lo camine

BASE: 0b26101

OBJETIVO: ian (2026-09-04): «aún no me queda claro el happy path… puedes crear un video, así lo
haces tú y luego lo hago yo, es más rápido corregir que crear». Al final de esta orden existe UN
comando que graba el camino tal como está hoy en producción: el arnés recorre los 8 pasos con un
letrero por paso («PASO 2 DE 8 · SUELTA EL STEP…» + lo que debe verse + ✓/✗ medido), el cursor
visible, ritmo humano, 4K NVENC desde iangpu, entregado a Downloads de las dos PCs. El video sale
del MISMO archivo del camino que lee Temis y el runner — no de un guion aparte.

## EJERCICIOS
- letrero-por-paso · El arnés sabe poner un letrero en pantalla · `forja-drive.cjs` gesto `caption` · `{type:'caption', text, sub}` pinta un overlay DOM (n de N · gesto · «se ve»); `expect` le cuelga el veredicto ✓/✗ al letrero vigente; `caption` vacío lo quita
- el-paseo · El runner tiene modo paseo · `camino-runner.cjs --paseo <dir>` · arma las mismas acciones del `## RUNNER` pero con letrero por paso, settles humanos (1.2-2.6 s) y REC= para forja-drive; NO reescribe el camino (es un paseo, no una medición)
- cuatro-k · Sale en 4K de verdad · `W= H= DPR=` en el arnés · viewport 1920×1080 a DPR 2 → grabación 3840×2160; ffprobe del webm dice 3840×2160 (si Playwright no lo da, se declara y se escala con lanczos — pero se MIDE, no se supone)
- master-nvenc · El master es hevc 10-bit NVENC en iangpu · `hevc_nvenc yuv420p10le` · recorte del lead-in (meta.leadMs) y de la cola; duración ≈ 60-90 s; el h264 para compartir sale del mismo webm
- revisado-con-ojos · Antes de entregar se ve TODA la línea de tiempo · hoja de contactos · 12 cuadros repartidos en el video en un solo PNG, juzgados con Read; se cazan letreros tapando la pieza, pasos sin resultado visible, cursor perdido
- entregado-dos-pcs · Está en Downloads de las DOS PCs · `FORJA-LENTES-DEL-FOCO/22-EL-CAMINO-paseo.mp4` · laptop (/mnt/c) + iangpu (sshd de Windows, sebas@100.116.134.86) + LEEME; sin eso, no existe

## YA-EXISTE (prueba de ausencia)
- `forja-drive.cjs`: REC=<dir> ya graba la sesión a webm con cursor SVG y hint bar (fue hecho para
  «videotutorial automático»); `leadMs` en meta.json para recortar. Le faltan: letrero, W/H/DPR.
- `camino-runner.cjs` (orden el-runner-del-camino): ya arma las acciones desde `## RUNNER`; el
  paseo es el mismo armado con otro ritmo, no otro guion.
- `scripts/render-clase.cjs` y `clase-drive` graban clases del croquis — otro dominio (vite dev en
  iangpu, lecciones), no el camino. No se copian: se reusa el arnés que ya recorre el camino.
- NO existe: ningún video del happy path; ningún letrero en el arnés; ninguna grabación 4K del arnés.

## TOCA
- scripts/forja-drive.cjs
- scripts/camino-runner.cjs
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-04-el-video-del-camino.md
- public/evidencia/2026-09-04-el-video-del-camino/resultados.json
- public/evidencia/2026-09-04-el-video-del-camino/contactos.png
- public/evidencia/2026-09-04-el-video-del-camino/paso-2-letrero.png

## BORRA
- (nada)

## PREEXISTENTE
- videos/mol-h2o-los-dos-campos-b.json
- videos/mol-etoh-te-roba-el-agua.json
- videos/mol-h2o-dos-gotas.json
- videos/mol-h2o-eres-tu.json
- scripts/video.sh
- ordenes/2026-09-04-el-cine-programado.md
- ordenes/2026-08-26-subida-automatizada.md

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- ffprobe del webm y del mp4: 3840×2160, hevc, yuv420p10le, ~60-90 s
- hoja de contactos de 12 cuadros del mp4 juzgada con ojos
- el mp4 en Downloads de las dos PCs (ls en ambas) + LEEME
- orden-gate VERDE · censo Canvas 8→8 (no se toca la UI)

## CIERRE (se llena al terminar)
**5/6 · uno ROJO a propósito (cuatro-k) · el video existe, revisado con ojos, en Downloads de las dos PCs.**

Un comando graba el camino desde el mismo archivo que lee Temis:
`W=1920 H=1080 MAQUINA=iangpu URL=<prod> node scripts/camino-runner.cjs caminos/la-carcasa-de-mitsubishi.md --paseo <dir>`
→ webm 1920×1080 → `encode-paseo.sh` (quita cuadros encogidos, recorta lead-in, escala, hevc 10-bit NVENC)
→ `22-EL-CAMINO-paseo.mp4` 3840×2160 · 92.6 s (+ h264 1080).

- orden vs entregado: idéntico salvo el 4K: es ESCALADO desde 1080, no nativo (ver cuatro-k ROJO).
  El paso 5 ahora lleva Escape y el 8 vuelve a abrir D, para que los pasos rojos enseñen la pieza.
- números: 4/8 ok · se rompe en el 5 (igual que la medición) · 9 letreros · 147 cuadros encogidos
  quitados en 8 ráfagas · 0 restantes · lead 34.4 s recortado.
- evidencia: `public/evidencia/2026-09-04-el-video-del-camino/` contactos.png (12 cuadros del master),
  paso-2-letrero.png (captura 4K→1080 del letrero con la pieza y sus 3 cotas), resultados.json.
- defectos pagados (los dos los cazaron los OJOS, no los números): (1) ffprobe dijo 3840×2160 y la
  página estaba en un cuarto del cuadro — el screencast de Playwright ignora el DPR; (2) el screencast
  ENCOGE cuadros bajo carga y Playwright rellena con negro: 8 ráfagas <1 s, una por captura pesada;
  el primer detector (umbral 24) se comía el lienzo vacío (oscuro, no negro) — afinado a 20/99.
- lo que el video enseña de la Forja (para ian): el paso 1 en producción tarda ~35 s en dar el lienzo
  (carga + kernel) — un ingeniero de Mitsubishi ve una pantalla de carga medio minuto; y después de
  soltar, nada dice qué sigue (ticket QUÉ SIGUE).
- preguntas abiertas: ¿voz de Matilda sobre el paseo? ¿4K nativo (zoom CSS 2× o cuadros por
  screenshot)? ¿esconder la hint bar del arnés en los videos para cliente?
