# ORDEN: v1·0b — TEMIS: la pantalla de EVIDENCIA (no se revisa sin screenshots)

BASE: 1cf4bc8

OBJETIVO: ian — "para que me pidas que revise uno, SÍ O SÍ deben estar los ss de
evidencia de que funciona". Al terminar: cada tarjeta de Temis abre una pantalla
de evidencia con su OBJETIVO, la EVIDENCIA declarada, el CIERRE completo, el
commit y la GALERÍA de screenshots reales (`public/evidencia/<slug>/*.jpg`). Una
orden cerrada sin screenshots se marca "sin evidencia visual" y NO es revisable;
cerrar una orden nueva sin ss hace que el generador se niegue (exit 1).

## YA-EXISTE
- `scripts/temis-tablero.cjs` genera el JSON de las tarjetas — se extiende con
  `evidenciaSS` (archivos en `public/evidencia/<slug>/`), `evidenciaDeclarada`
  y `cierreCompleto`.
- `ProjectSwitcher.tsx:TemisBoard` — las tarjetas; se agrega el detalle.
- Screenshots reales ya tomados en esta sesión (lobby, vaso cargado, jabonera,
  cubo-ciclo, Temis en prod) y de la anterior (acta E12, vaso hecho a mano).
  Se convierten a JPG (~150 KB) para no engordar el repo.

## TOCA
- src/forja/brep/ProjectSwitcher.tsx
- scripts/temis-tablero.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-14-ciclo-dado-estacion6/01-contraccion-inicio.jpg
- public/evidencia/2026-08-14-ciclo-dado-estacion6/02-contraccion-final.jpg
- public/evidencia/2026-08-17-ciclo-dado-estacion7/01-venteo-anatomia-fig-8-6.jpg
- public/evidencia/2026-08-17-ciclo-dado-estacion7/02-venteo-fin-de-flujo.jpg
- public/evidencia/2026-08-17-ciclo-dado-estacion7/03-sonda-venteo.jpg
- public/evidencia/2026-08-17-ciclo-dado-estacion8/01-agua-e8.jpg
- public/evidencia/2026-08-17-n2-termico/01-espiral-n2-inicio.jpg
- public/evidencia/2026-08-17-n2-termico/02-espiral-n2-congela.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion10/01-pines-escalonados.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion10/02-sonda-expulsion.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion11/01-estructura-r90.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion12/01-antes-acta-ilegible.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion12/02-acta-rotulada-en-escena.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion12/03-crop-1a1-del-master-4k.jpg
- public/evidencia/2026-08-18-ciclo-dado-estacion9/01-contraccion-acero-escalado.jpg
- public/evidencia/2026-08-18-e8b-circuito-real/01-circuito-real-anillo-baffle.jpg
- public/evidencia/2026-08-18-el-ciclo-en-movimiento/01-llenar-abrir-expulsar.jpg
- public/evidencia/2026-08-21-jabonera-tercera-figura/01-jabonera-cargada.jpg
- public/evidencia/2026-08-21-temis-tablero/01-temis-dev-primera-captura-markdown-crudo.jpg
- public/evidencia/2026-08-21-temis-tablero/02-temis-en-prod.jpg
- public/evidencia/2026-08-21-vaso-con-botadores/01-boceto-xy.jpg
- public/evidencia/2026-08-21-vaso-con-botadores/02-circulo-a-ojo-dof0.jpg
- public/evidencia/2026-08-21-vaso-con-botadores/03-extruir.jpg
- public/evidencia/2026-08-21-vaso-con-botadores/04-cascaron-tapa-abierta.jpg
- public/evidencia/2026-08-21-vaso-con-botadores/05-draft-ninguna-cara-aplicable.jpg
- public/evidencia/2026-08-21-vaso-con-botadores/06-vaso-d80x20-pared3.jpg
- public/evidencia/2026-08-21-vaso-proyecto-revision/01-lobby-tarjeta-vaso.jpg
- public/evidencia/2026-08-21-vaso-proyecto-revision/02-vaso-cargado-editable.jpg
- public/evidencia/2026-08-21-vaso-proyecto-revision/03-contraste-cubo-12-estaciones.jpg
- public/evidencia/2026-08-25-temis-evidencia/01-tablero-con-insignias-revisable.jpg
- public/evidencia/2026-08-25-temis-evidencia/02-pantalla-de-evidencia-en-prod.jpg
- public/evidencia/2026-08-25-temis-evidencia/03-galeria-6-capturas-cargan.jpg

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- generador: tarjetas con `evidenciaSS` para las órdenes que tienen carpeta;
  control negativo: cerrar una orden nueva SIN carpeta → exit 1 ("se niega")
- screenshot de la pantalla de evidencia abierta (con galería) — en dev y EN VIVO
- esta misma orden cierra CON su carpeta de ss (la regla se aplica a sí misma)
- censo igual · orden-gate VERDE · deploy

## CIERRE (lo que de verdad pasó)

**LA PANTALLA DE EVIDENCIA VIVE EN PROD.** Cada tarjeta de Temis abre su detalle:
estado, título, `fecha · archivo · commit`, OBJETIVO, EVIDENCIA declarada, CIERRE
completo y la GALERÍA de screenshots reales. Las cerradas llevan insignia
**"📷 N — revisable"** o **"sin evidencia visual"** (honesto: las de validación
fueron números de gate, no capturas). 14 → 15 órdenes con evidencia visual (29
→ 32 capturas, 2.4 MB en JPG), rescatadas del scratchpad de la sesión anterior
(E6, E7, E8, E8b, E9, E10, E11, N2, el ciclo, el acta) y de ésta (vaso, jabonera,
Temis).

**LA REGLA SE NIEGA:** cerrar una orden nueva sin carpeta `public/evidencia/<slug>/`
→ `exit 1` "CERRADA SIN EVIDENCIA VISUAL" (control negativo probado). Esta orden
se cierra CON sus 3 capturas — la regla aplicada a sí misma.

**Verificado EN VIVO** (university.gaiaprime.com.mx, desde la laptop con
SwiftShader — iangpu se cayó 3 veces bajo Chrome+dev+build y se reinició solo):
3 insignias revisables visibles, detalle abre, **6/6 imágenes de la galería
cargan (1400 px)**, 0 errores de página. Gotchas: el splash "Cargando el motor de
geometría" tapa la captura hasta que el kernel WASM carga (esperar a que
desaparezca); CERRADO muestra 6 y el resto tras "y N más".

**Cazado con los ojos y arreglado:** `all:unset` en la tarjeta-botón habría
borrado borde y fondo (→ `appearance:none; font:inherit`); la tabla markdown del
cierre salía aplanada (→ fuera del texto de la tarjeta).
