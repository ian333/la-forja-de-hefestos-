# ORDEN: T2 · LAS CAPAS SOBRE EL SÓLIDO — el espesor y los expulsores dejan de ser estampas

BASE: 3f86e47

OBJETIVO: ian, viendo el mapa de espesor: «eso está bien verga pero de nada me sirve verlo en
2D». Y de la planta del núcleo: «si me enseñaras algo plano… y todas las piezas serán
complejas». Tiene razón: hoy esas figuras son **SVG dibujados** (`laminas-visuales.ts`), no el
CAD. Son estampas muertas al lado de un visor vivo.

Al terminar: el mapa de espesor, los expulsores y la visibilidad se pintan **sobre la malla
real**, en el visor, con escala FIJA en múltiplos del nominal y leyenda; se prenden y apagan
como capas. El SVG sobrevive solo donde 2D sí es el medio: la hoja imprimible.

## EJERCICIOS
- capa-espesor · El espesor se pinta en el sólido, no en una planta · thickMap → feaColors · el vaso pinta p95/nominal = el mismo ratio que reporta dfmFromMesh (±1 %) y la leyenda dice los mm
- capa-escala-fija · La escala NO se auto-normaliza (una pieza pésima se vería uniforme) · múltiplos del nominal · dos piezas distintas con el mismo nominal dan el MISMO color para el mismo espesor
- capa-expulsores · Los pines se ven donde empujan, en 3D · gripEjectorLayout → marcadores · los 5 pines del rpi4 caen sobre las zonas de agarre y su ⌀ en pantalla = ⌀ real ±2 px
- capa-visibilidad · Claro/oscuro (a la vista / escondido) sobre la pieza girable · clasificarVisibilidad · la cara marcada "no visible" en la lámina es la misma que se pinta oscura en el visor
- capa-toggles · Cada capa se prende y apaga sin recalcular · estado de capas · alternar 10 veces no dispara ningún recálculo (contador de raster estable)
- capa-sin-regresion · von Mises y el estudio de Viento siguen pintando igual · feaColors compartido · gate del ciclo verde + still del FEA idéntico al de antes

## YA-EXISTE (prueba de ausencia)
- El canal **`feaColors`** (ForgeBRepStudio ~l.2481-2509): pinta un color POR VÉRTICE sobre la
  malla del sólido. Lo usan von Mises y el Cp del estudio de Viento. Es el mecanismo probado.
- `dfmFromMesh(mesh).thickMap` — el espesor ya está calculado (lo dibuja `laminaEspesor`).
- `gripEjectorLayout(mesh, …)` — las posiciones de los pines ya están calculadas.
- `clasificarVisibilidad(mesh, {res:512})` — el claro/oscuro ya está calculado.
- `fea.ts` ya hace transferencia Shepard vóxel→vértice: es el puente thickMap→feaColors.
- NO existe: ninguna de esas tres capas dibujada sobre la geometría del visor.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/mold/dfm-mesh.ts
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-28-t2-capas-sobre-el-solido/resultados.json

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al activarla)

## EVIDENCIA (declarada ANTES de trabajar)
- gate del ciclo VERDE con los checks de capas · stills 1600×1000 de cada capa sobre el engrane
- juez con ojos: el mismo defecto se ve en el 3D y en la lámina (no dos verdades)
- orden-gate VERDE · Temis n/6 · censo canvas IGUAL (las capas van DENTRO del Canvas que ya existe)

## CIERRE (se llena al terminar)
