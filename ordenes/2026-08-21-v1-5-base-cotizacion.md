# ORDEN: v1·5 — BASE DE CATÁLOGO + LA COTIZACIÓN (E1+E2+E3+base → PDF)

ESTADO: proximo
PRIORIDAD: 5

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

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## EVIDENCIA
- las 3 figuras emiten cotización con base nombrada y $/pza distinto (ya medido:
  $9,259 / $11,343 / $19,294)
- la cotización se LEE en el cuadro (juez de legibilidad, como el acta)
- orden-gate VERDE
