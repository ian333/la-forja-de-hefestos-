# ORDEN: TEMIS — la evidencia se recorre A LO ANCHO y el panel deja de ser chico

BASE: 640c678

OBJETIVO: caza de ian (2026-08-26, mientras probaba): «las imágenes, las pueda
recorrer hacia la derecha y no hacia abajo, también el panel está muy pequeño».
Hoy la galería de evidencia es una COLUMNA (`grid-template-columns:1fr`): con 3-6
capturas de 1400 px hay que hacer scroll vertical eterno para ver una sola
tarjeta, y el panel de Temis tope a 1040 px en una pantalla de 1900+. La
evidencia es LO QUE SE REVISA: si revisarla cansa, no se revisa.

Al terminar: carrusel horizontal con snap + flechas ‹ › + contador, y el panel
de Temis usando el ancho real de la pantalla.

## YA-EXISTE (prueba de ausencia)
- `src/forja/brep/TemisBoard.tsx` — el módulo ya EXTRAÍDO por la sesión paralela
  (commit e3c71fe). La galería vive en `.tm-gal` (líneas ~55-65 markup, ~257-260
  CSS). NO se reescribe el tablero: se cambia el layout de esa galería.
- `.ps-panel` / `.ps-panel.wide` (ProjectSwitcher.tsx) ya tienen la variante
  ancha para Temis — solo está corta (1040).
- Las flechas son controles de UNA galería que ian pidió explícitamente; no son
  botones de función CAD (la prohibición del ribbon no aplica aquí).

## TOCA
- src/forja/brep/TemisBoard.tsx
- src/forja/brep/ProjectSwitcher.tsx
- public/temis.json

## CREA
- public/evidencia/2026-08-26-temis-galeria-panel/01-galeria-horizontal.jpg
- public/evidencia/2026-08-26-temis-galeria-panel/02-panel-ancho.jpg
- public/evidencia/2026-08-26-temis-galeria-panel/03-galeria-siguiente.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/ACS724-hall-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/ACS758-hall.pdf
- docs/forja-research/datasheets-fuente-corriente/FDH055N15A-mosfet.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4115-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4227-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFP4568-mosfet-backup.pdf
- docs/forja-research/datasheets-fuente-corriente/LRS-1200-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/MBR60100PT-schottky.pdf
- docs/forja-research/datasheets-fuente-corriente/RSP-1000-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/TC4422-gatedriver-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/UCC27614-gatedriver.pdf
- docs/forja-research/datasheets-fuente-corriente/ag-peina.py
- docs/forja-research/datasheets-fuente-corriente/sim-ag.py
- docs/forja-research/datasheets-fuente-corriente/sim-sensor.py
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- public/temis-deploy.json
- scripts/guiones/hemo-v1-proteina-entera.txt
- scripts/guiones/hemo.txt
- scripts/guiones/sal.txt
- scripts/narracion-gen.py
- scripts/precompute-heme-approach.py
- scripts/precompute-hemoglobin.py
- scripts/salud.sh
- scripts/video.sh
- videos/cargas-gauss.json
- videos/faraday-jaula.json
- videos/mol-grasa-butirico.json
- videos/mol-h2o-el-anillo.json
- videos/mol-h2o-el-cuarteto.json
- videos/mol-h2o-el-hexamero.json
- videos/mol-h2o-el-puente-camB.json
- videos/mol-h2o-el-puente.json
- videos/mol-hemo-la-cazadora.json

## EVIDENCIA
- la galería de una tarjeta con 3+ capturas se recorre A LO ANCHO (snap), con
  flechas y contador «n/N»; cero scroll vertical para pasar de una a otra
- el panel de Temis usa el ancho real de la pantalla (medido en 1900 px)
- las 4 columnas del tablero siguen intactas (mismos testids)
- orden-gate VERDE

## CIERRE (2026-08-26)
HECHO, con Playwright y con los OJOS (el arnés solo no bastó — dos defectos los
cazó la vista).

- **La evidencia se recorre A LO ANCHO**: `.tm-gal` pasó de `grid 1fr` (columna)
  a carril flex con `scroll-snap-type:x mandatory`. Prueba MECÁNICA en el arnés:
  las 3 figuras tienen la MISMA Y, X distintas, `scrollWidth > clientWidth` y
  `scrollHeight <= clientHeight` — o sea, en FILA de verdad, no apiladas.
- **Flechas ‹ › + contador n/N**, con el índice derivado del scroll REAL (si
  arrastras con el trackpad el contador sigue). Probado: `1/3` → clic ›  → `2/3`
  y el carril avanzó de verdad (scrollLeft subió).
- **El panel de Temis usa la pantalla**: `.ps-panel.wide` de `min(1040px…)` a
  `calc(100vw - 24px)` con tope 1760. Medido en 1900 px: **1760×938** (antes 1040).

LO QUE CAZARON LOS OJOS (el arnés daba verde en los 3 checks):
1. La foto se **cortaba abajo** y el nav quedaba fuera del panel → tope
   `max-height:42vh` + `object-fit:contain`.
2. La galería vivía al FINAL, debajo de un CIERRE de 30 líneas: para revisar
   había que scrollear hasta el fondo. **La evidencia ahora va ARRIBA**, lo
   primero tras el título, y el nav va sobre el carril. Es la regla de la orden
   de evidencia aplicada a sí misma: si revisar cansa, no se revisa.

GOTCHA NUEVO (costó una vuelta): **vite dev cachea el índice de `public/` al
arrancar** — las capturas copiadas DESPUÉS salen 200 pero con el HTML del
fallback (`Content-Type: text/html`, `naturalWidth 0` = imagen rota). Cura:
reiniciar vite. Es hermano del gotcha de `VITE_NO_WATCH` con los módulos viejos.

Sin deploy: la sesión paralela tiene LA SAL en curso y los deploys no se
encinman. Entra en el próximo publish.
