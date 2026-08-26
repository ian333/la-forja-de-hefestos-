# ORDEN: v1·5 — BASE DE CATÁLOGO + LA COTIZACIÓN (E1+E2+E3+base → PDF)

BASE: 829131b

OBJETIVO: el entregable de la v1: "cuánto cuesta moldear MI pieza". De la pieza
del usuario → DFM (E1) → cavidades/arquitectura (E2) → cavidad+macho (E3) →
base ESTÁNDAR seleccionada (§4.3.2: se compra, no se modela — el 48 %) →
cotización imprimible con cada número y su §. No es el acta de 12 estaciones
(esa la muestra el cubo); es la cotización que un taller o un diseñador de
producto lee en 5 minutos.

## YA-EXISTE
- `moldMachine(spec)` ya cotiza y recomienda; `packageToAssemblySpec` +
  `insertDims` ya dimensionan insertos y eligen base.
- `printReport` / `genPlano` (ForgeBRepStudio) ya imprimen.
- `estacion12Dado` ya arma un acta con decisiones y recibos (patrón a reusar).

## ENMIENDA (al diseñar, antes de tocar)
- La cotización es PURA (sin OCC): `cotizacionPieza(pieza)` corre estacion1 +
  estacion2 (la Máquina) + estacion3Dado (insertos/base/stack) y arma la hoja;
  `cotizacionSvg(c)` la vuelve DOCUMENTO imprimible (SVG, como el plano);
  `juezLegibilidadCotizacion(svg)` es el juez que el acta enseñó a tener
  (tamaño de letra, sin desbordes, los números y §§ presentes) y vive en el
  gate con control negativo.
- El panel: `CotizacionE3` en el ciclo (estación 3 — donde la base ya existe
  §4.3.2), hoja en el cuadro + descarga SVG. Botón de PANEL del ciclo (canal
  btn-ciclo-*, no ribbon). ForgeBRepStudio: solo si hace falta (permiso).
- El gate gana los checks de las 3 figuras (base nombrada, 3 moldes 3 precios,
  el dinero cuadra al centavo, cubo == E2 del ciclo) — TOCA suma el test.
- WIP: corre mientras `temis-modulo-comando` (paralela) tiene el slot EN CURSO;
  próximo→cerrado directo (tapa ≤1).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-21-v1-5-base-cotizacion/01-cubo-cotizacion.jpg
- public/evidencia/2026-08-21-v1-5-base-cotizacion/02-vaso-cotizacion.jpg
- public/evidencia/2026-08-21-v1-5-base-cotizacion/03-jabonera-cotizacion.jpg

## EVIDENCIA
- las 3 figuras emiten cotización con base nombrada y $/pza distinto (ya medido:
  $9,259 / $11,343 / $19,294)
- la cotización se LEE en el cuadro (juez de legibilidad, como el acta)
- orden-gate VERDE

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
- scripts/temis-tablero.cjs
- scripts/temis-deploy-stamp.cjs
- scripts/forja-deploy.sh
- public/temis-deploy.json
- src/forja/brep/TemisBoard.tsx
- src/forja/brep/ProjectSwitcher.tsx
- src/comando/ComandoCenter.tsx
- deploy-atlas-build.sh
- ordenes/2026-08-25-temis-modulo-comando.md
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- public/comando/
- public/atrio/
- public/precomputed/
- index.html
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
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
- src/lib/chem/

## CIERRE (2026-08-25)
EL ENTREGABLE DE LA v1 EXISTE: "cuánto cuesta moldear MI pieza" es una HOJA.
`cotizacionPieza(pieza)` (PURA, sin OCC) + `cotizacionSvg` (documento
imprimible/descargable) + `juezLegibilidadCotizacion` (la lección del acta,
ahora con dientes) + panel `CotizacionE3` en la estación 3 del ciclo.

Gate **228/228** (+6):
- las 3 figuras con BASE NOMBRADA: cubo/vaso 196×196 · jabonera 246×246
- tres piezas, tres moldes, tres $/pza — specs escritos: $9,259 / $11,343 /
  $19,294; EN LA APP (pieza del árbol, MEDIDA): $9,259 / $11,342 / $19,361 —
  misma pieza, dos orígenes, ±0.35 %
- el dinero CUADRA al centavo (amortización §3.4.1 + resto = total)
- cotización del cubo == E2 del ciclo (misma Máquina, mismo número)
- el juez aprueba las 3 hojas y REPRUEBA la saboteada (control negativo)

EL JUEZ APRENDIÓ DE MIS OJOS (3 iteraciones REALES esta noche):
1. desborde de LA BANDA → lo cazó el juez (regla de marco) ✓
2. "×1 cavidad(es" ENCIMADO al $9,259 → lo cazaron los OJOS, el juez NO →
   regla NUEVA de colisión de columnas (c1<360, c2<655; el pie y=596+ exento)
3. `t_c = 8.477895220882502 s` crudo → toFixed(1)
La regla de siempre: el gate verde no sustituye mirar la hoja.

DEUDA OBSERVADA (fuera de TOCA — useMoldStudio): tras cargar un DEMO, abrir
una pieza del árbol NO re-siembra el ciclo (guard esDemo del puente): el panel
se queda en la estación del demo. El arnés lo rodeó con página fresca por
figura. Candidato a ticket.

Evidencia: las 3 hojas a página completa (dev iangpu, GPU real) — cada una con
SU DFM honesto (vaso/jabonera del árbol REPROBADOS §2.3.4/§2.3.6: el árbol no
trae filete, y ESO es el puente diciendo la verdad), SUS insertos, SU banda.
ForgeBRepStudio: 0 cambios. WIP: próximo→cerrado directo (paralela en el slot).
