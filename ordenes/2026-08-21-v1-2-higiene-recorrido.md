# ORDEN: v1·2 — HIGIENE DEL RECORRIDO: lo que "juguete" significa

ESTADO: en-curso
BASE: 33bb289

OBJETIVO: quitar del ribbon los cargadores de demo (El DADO, Probeta, Espiral,
N2, Flanera, Vaso, Core/Cav, Pieza, Escala…) — viven en el lobby, que ya existe —
y que el estado vacío reciba con un arranque guiado, no con "Error: el documento
no tiene sólido". Es la crítica de ian ("se ve de juguete") convertida en dos
cambios baratos y de alto impacto percibido. Cero pantalla nueva.

## YA-EXISTE
- `MoldPanels.tsx:MoldRibbonGroup` — los botones de demo en la cinta.
- `ProjectSwitcher.tsx` — el lobby con tarjetas `st-*` (dado, vaso, jabonera…).
- el mensaje de error del estado vacío sale del rebuild (`REBUILD_ERR`).

## TOCA
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/ProjectSwitcher.tsx
- scripts/llenado-video.cjs
- public/temis.json

## ENMIENDA (al diseñar)
"Escala…" en el objetivo era el corte visual del ribbon, NO un demo: Escala /
Move-Copy / Parting Line / Tooling Split / Guías son MOLD TOOLS (operaciones
reales sobre la pieza — el puente las acaba de habilitar para piezas del
usuario) y SE QUEDAN. Lo que sale del ribbon son los CARGADORES: El DADO,
Probeta, Espiral, N2, Flanera, Vaso, Core/Cav, Pieza (percha) y las 4 redes
(6.13–6.16). Viven en el lobby, en una sección propia "Banco de pruebas". Los
arneses que clickeaban esos botones (llenado-video.cjs) abren el lobby.

## CREA
- public/evidencia/2026-08-21-v1-2-higiene-recorrido/01-estado-vacio-guiado-ribbon-sin-demos.jpg
- public/evidencia/2026-08-21-v1-2-higiene-recorrido/02-lobby-con-banco-de-pruebas.jpg
- public/evidencia/2026-08-21-v1-2-higiene-recorrido/03-dado-cargado-desde-el-lobby-ciclo-intacto.jpg

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

## EVIDENCIA
- captura del ribbon SIN cargadores; los demos siguen en el lobby (drive: abrir
  lobby → cargar dado → ciclo intacto)
- captura del estado vacío con arranque guiado, sin "Error:" en la barra
- 192 del ciclo verdes · orden-gate VERDE

## CIERRE (lo que de verdad pasó)

**EL RIBBON YA NO ES EL LOBBY.** Salieron los 12 cargadores (El DADO, Probeta,
Espiral, N2, Flanera, Vaso, Core/Cav, Pieza y las 4 redes 6.13–6.16); quedan los
5 MOLD TOOLS (Escala · Move/Copy · Parting Line · Tooling Split · Guías), que
ahora también esperan al kernel. El ribbon cabe entero a 1900 px — antes
"Escala…" se cortaba en el borde. Los demos viven en el lobby, en la sección
propia **"Banco de pruebas · validación del solver"** (9 tarjetas nuevas + las 6
plantillas = 15). Sonda DOM: `demosEnRibbon: []`, `moldTools: 5`, `secBanco: true`.

**EL LIENZO VACÍO YA NO GRITA "Error".** Un documento sin ops no es un error:
la barra dice *"Lienzo vacío — Boceto → Extruir, o abre un proyecto"* y el
viewport recibe con la tarjeta *"Tu primera pieza, tu primer molde · 1 Boceto ·
2 Extruir · 3 Cascarón + Draft"* + "o abre un proyecto ▸" (abre el lobby que ya
existe). `REBUILD_ERR` al arrancar: 0 (antes 2 por corrida del arnés).

**Los arneses no se rompen a escondidas:** `__forgeBrep.demo('dado' | 'probeta' |
'espiral' | 'espiral-n2' | …)` carga un starter por llave (misma acción que la
tarjeta). `llenado-video.cjs` (el pipeline canónico de videos) ya usa `demo()`
esperando al kernel por el splash — OJO: `__forgeBrep.ready` exige un SÓLIDO y en
lienzo vacío nunca llega. Los 12 scripts históricos que clickeaban `btn-dado` /
`btn-flanera` / `btn-red-*` (probe-*, flanera-*, mold-inspect, m1-agua-verify,
audit-fixes-verify, mold-eject-frames) se arreglan con esa línea cuando se
necesiten — se DECLARA, no se disimula con botones invisibles.

**Regresión probada:** el dado cargado desde el lobby conserva su ciclo (E1
"DADO hueco 40×40×40 · pared 2 — APROBADO, t_c 8.5 s"). Gate **198/198**.
Build ✓. Cero pantalla nueva, cero botón de ribbon nuevo (el CTA del lienzo
vacío es DOM del estado vacío y abre el lobby existente).

**Plomería que volví a pagar (anotada):** `pkill` en la línea del ssh mata la
propia sesión; y el dev sirve JSX TRANSFORMADO — esperar por un literal de
cadena (`ps-sec-banco`), nunca por `</div>`.
