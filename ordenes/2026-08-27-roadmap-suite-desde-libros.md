# ORDEN: SUPERTICKET ROADMAP — la suite de diseño construida DESDE LOS LIBROS (planeación + sprints + supertickets)

BASE: 87f6ad4

OBJETIVO: ian (2026-08-27): «todas las empresas allá afuera tienen miles de ingenieros y ya
tienen tu misma capacidad; ellos nos llevan ventaja en PLANEACIÓN». Quiere que con los libros
descargados se construya la nueva suite de diseño en el navegador, con user stories basadas
en los libros, donde el DoD de cada feature son LOS MISMOS PROBLEMAS DEL LIBRO resueltos en la
suite con video y fotos de evidencia. Pero PRIMERO la planeación y el roadmap para hacer los
sprints y los supertickets — y antes de eso, LEER TODOS LOS LIBROS. Esta orden produce:
(1) la lectura completa de los 7 libros + 33 manuales (un md por libro con catálogo de
ejercicios, features y supertickets propuestos), (2) `docs/ROADMAP-SUITE.md` con el diagrama,
los sprints y la matriz libro→feature→ejercicio, (3) los supertickets como órdenes (formato
`## EJERCICIOS` que Temis ya lee): los del sprint 1 en `ordenes/`, el resto en
`ordenes/supertickets/` (backlog fuera de la tapa). Es un superticket: cada libro es un
ejercicio y el oráculo es mecánico (archivo existe + JSON válido + conteos).

## EJERCICIOS
- lib-bethune · Bethune (SolidWorks 2023) leído: catálogo + supertickets · lector×4 sintetizador · docs/forja-research/libros/bethune.md + .json con ≥40 ejercicios y ≥3 supertickets
- lib-kazmer · Kazmer (Injection Mold Design) leído · lector×3 sintetizador · libros/kazmer.md + .json con ≥30 ejercicios y ≥3 supertickets
- lib-shigley · Shigley (Mechanical Engineering Design 2024) leído · lector×12 sintetizador · libros/shigley.md + .json con ≥80 ejercicios y ≥5 supertickets
- lib-anderson · Anderson (Fundamentals of Aerodynamics) leído · lector×10 sintetizador · libros/anderson.md + .json con ≥40 ejercicios y ≥3 supertickets
- lib-bertin · Bertin & Cummings (Aerodynamics for Engineers) leído · lector×8 sintetizador · libros/bertin.md + .json con ≥40 ejercicios y ≥3 supertickets
- lib-raymer · Raymer (Aircraft Design) leído · lector×9 sintetizador · libros/raymer.md + .json con ≥40 ejercicios y ≥3 supertickets
- lib-herath · Herath (Foundations of Robotics) leído · lector×4 sintetizador · libros/herath.md + .json con ≥30 ejercicios y ≥3 supertickets
- dom-fea-lineal · FEA lineal + NAFEMS (Felippa, CalculiX, Code_Aster) · agente de dominio · libros/fea-lineal.md + .json con ≥10 benchmarks y ≥1 superticket
- dom-fea-nolineal · FEA no lineal (plasticidad, contacto, grandes deformaciones) · agente de dominio · libros/fea-nolineal.md + .json con ≥8 benchmarks y ≥1 superticket
- dom-kernel-nurbs · Kernel CAD: NURBS, RMF, loft, IGA, FreeCAD · agente de dominio · libros/kernel-nurbs.md + .json con ≥8 ejercicios y ≥1 superticket
- dom-termica-cfd · Térmico + CFD + CHT · agente de dominio · libros/termica-cfd.md + .json con ≥8 benchmarks y ≥1 superticket
- dom-cam-chapa · CAM (RS274) + chapa (factor K, springback) · agente de dominio · libros/cam-chapa.md + .json con ≥8 ejercicios y ≥1 superticket
- dom-dibujo-gdt · Dibujo + GD&T ASME Y14.5-2018 · agente de dominio · libros/dibujo-gdt.md + .json con ≥8 ejercicios y ≥1 superticket
- dom-moldflow-benchmarks · Validación del solver de inyección (Moldflow + benchmarks reales) · agente de dominio · libros/moldflow-benchmarks.md + .json con ≥8 benchmarks y ≥1 superticket
- dom-generativo-fatiga-dinamica · TopOpt + fatiga + modal + multicuerpo · agente de dominio · libros/generativo-fatiga-dinamica.md + .json con ≥8 ejercicios y ≥1 superticket

## YA-EXISTE (prueba de ausencia)
- Digestos previos de los libros (NO se tiran, se cruzan): `docs/forja-research/pliegos/*.md`
  (Shigley + anexos, aero, cam, GD&T, FEA, kernel, moldflow-NAFEMS, robótica, térmica-CFD),
  `kazmer-pliego/` (292 análisis con estado SÍ/PARCIAL/FALTA), `aero-pliego/` (Anderson,
  Bertin, Raymer capítulo a capítulo), `bethune/CURRICULUM.md` (63 lecciones mec-u1..u11),
  `aero/CURRICULUM-AERO.md`, `PLAN-MAESTRO-FORJA.md` y `LA-FORJA-PLAN-MAESTRO.md` (roadmaps
  2026-06/07, anteriores al ciclo del dado y a la v1). Lo que NO existía: el CATÁLOGO de
  ejercicios con respuesta impresa como DoD, la matriz libro→feature→ejercicio, ni los
  supertickets por libro.
- El formato de superticket ya está en producción: `ordenes/2026-08-26-superticket-croquis-A-dibujar.md`,
  `-B-domar.md`, `-moldes-por-pieza.md`; `scripts/temis-tablero.cjs::ejerciciosDe` lee
  `## EJERCICIOS` y `public/evidencia/<slug>/resultados.json`. Los supertickets NO cuentan para
  la tapa EN CURSO ≤ 1 (`enCursoTapa`). Temis lee SOLO `ordenes/*.md` (no subcarpetas): por eso
  el backlog de supertickets vive en `ordenes/supertickets/` sin ensuciar el tablero.
- Libros en disco: Kazmer (C:/Users/sebas/Documents), Shigley/Anderson/Bertin/Raymer/Bethune/
  Herath (C:/Users/sebas/Downloads + `docs/forja-research/manuales/`), 33 manuales P0-P2 en
  `manuales/`, ~30 papers de llenado en `/home/ian/benchmarks-llenado/`. **NO hay libros de
  química en ningún disco (laptop, Windows, iangpu):** ian los mencionó («TODOS incluidos los
  de química») — pregunta abierta al cierre.

## TOCA
- public/temis.json
- docs/forja-research/README.md

## CREA
- docs/ROADMAP-SUITE.md
- docs/forja-research/libros/README.md
- docs/forja-research/libros/bethune.md
- docs/forja-research/libros/bethune.json
- docs/forja-research/libros/kazmer.md
- docs/forja-research/libros/kazmer.json
- docs/forja-research/libros/shigley.md
- docs/forja-research/libros/shigley.json
- docs/forja-research/libros/anderson.md
- docs/forja-research/libros/anderson.json
- docs/forja-research/libros/bertin.md
- docs/forja-research/libros/bertin.json
- docs/forja-research/libros/raymer.md
- docs/forja-research/libros/raymer.json
- docs/forja-research/libros/herath.md
- docs/forja-research/libros/herath.json
- docs/forja-research/libros/fea-lineal.md
- docs/forja-research/libros/fea-lineal.json
- docs/forja-research/libros/fea-nolineal.md
- docs/forja-research/libros/fea-nolineal.json
- docs/forja-research/libros/kernel-nurbs.md
- docs/forja-research/libros/kernel-nurbs.json
- docs/forja-research/libros/termica-cfd.md
- docs/forja-research/libros/termica-cfd.json
- docs/forja-research/libros/cam-chapa.md
- docs/forja-research/libros/cam-chapa.json
- docs/forja-research/libros/dibujo-gdt.md
- docs/forja-research/libros/dibujo-gdt.json
- docs/forja-research/libros/moldflow-benchmarks.md
- docs/forja-research/libros/moldflow-benchmarks.json
- docs/forja-research/libros/generativo-fatiga-dinamica.md
- docs/forja-research/libros/generativo-fatiga-dinamica.json
- ordenes/supertickets/ (backlog de supertickets por sprint — exento del gate, fuera de Temis)
- ordenes/2026-08-27-superticket-*.md (los del sprint 1 — exentos del gate, visibles en Temis)
- public/evidencia/2026-08-27-roadmap-suite-desde-libros/resultados.json
- public/evidencia/2026-08-27-roadmap-suite-desde-libros/01-temis-supertickets.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones — no entra a mis commits)
- docs/CANON-VIDEO.md
- ordenes/DESPUES-DE-V1.md
- public/temis-deploy.json
- scripts/subir-instagram.py
- src/cinematic/CinematicMolecule.tsx
- videos/cargas-gauss.json
- videos/faraday-jaula.json
- videos/mol-grasa-butirico.json
- videos/mol-h2o-el-anillo.json
- videos/mol-h2o-el-cuarteto.json
- videos/mol-h2o-el-hexamero.json
- videos/mol-h2o-el-puente-camB.json
- videos/mol-h2o-el-puente.json
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- ordenes/2026-08-27-forja-analitica-conectada.md
- ordenes/2026-08-27-temis-compartido.md
- public/2DN1.pdb
- videos/mol-hemo-la-cazadora.json

## EVIDENCIA (declarada ANTES de trabajar)
- 15/15 ejercicios verdes por oráculo mecánico: cada `libros/<x>.json` parsea y cumple los
  conteos mínimos declarados arriba; `resultados.json` lo escribe un verificador, no una mano.
- `node scripts/temis-tablero.cjs` sale VERDE (sin violaciones de tapa) con los supertickets
  del sprint 1 listados en EN CURSO como supertickets (0/N) y este superticket 15/15.
- `node scripts/orden-gate.cjs` VERDE contra esta orden.
- `docs/ROADMAP-SUITE.md` trae: diagrama (mermaid) libro→módulo→sprint, tabla de sprints con
  supertickets y dependencias, y la matriz de cobertura (qué ya existe / parcial / falta).
- censo esperado: canvas/vite/html IGUAL (esta orden no toca código).

## CIERRE (se llena al terminar)
