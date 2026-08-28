# ORDEN: T7 · LA LÍNEA DE PARTICIÓN — hoy dice "SIN CABLEAR" en la cara del cliente

BASE: 3f86e47

OBJETIVO: la propia lámina de ian lo confesó: «⚠ Línea de partición · §4.1.2 Fig 4.6 — SIN
CABLEAR: la silueta de partición no llega a esta lámina todavía — V4.3 no está medida». Es la
deuda más cara que tenemos y no es cosmética: es **la causa medida** de que el v1-gate con las
20 piezas reales de Hammond dé `importan 20/20 · cotizan 17/20 · parten 2/20`.

Al terminar: para una pieza cualquiera (malla o kernel) la máquina calcula la silueta de
partición según la dirección de apertura, la dibuja SOBRE la pieza y la usa para partir el
acero. Sin esto, "tu primera pieza, tu primer molde" solo funciona con cajas.

Va aparte del carril visual (T1-T6) a propósito: no depende de ninguno y ninguno depende de él.

## EJERCICIOS
- part-silueta · La silueta de partición se calcula desde la malla · clasificarVisibilidad n·d + contorno · la silueta del vaso cierra (curva cerrada) y su área proyectada = área proyectada del kernel ±2 %
- part-direccion · La dirección de apertura se elige por área proyectada y expulsabilidad · §4.1.2 · el cubo elige +Z (bit-igual con el ciclo actual) y el 1594C Lid elige su eje mayor
- part-no-plana · Superficie de partición NO plana por loft ≥5° · MakeFilling/loft · el 1591XXCBK (esquinas redondeadas) cierra sin auto-intersección y el volumen cavidad+macho = bloque ±0.1 %
- part-undercut · Los undercuts se detectan y se DICEN (n·d invertido) · signo por sonda geométrica · el engrane de ian lista sus caras atrapadas con su área
- part-parte-de-verdad · El acero se separa en DOS cuerpos con piezas reales · construirAceroE3 + interseccionMitades · el v1-gate con /tmp/v1-reales sube de 2/20 a ≥12/20 parten
- part-en-la-lamina · La lámina deja de decir SIN CABLEAR · V4.3 medida · la línea roja aparece sobre la pieza y el check pasa de ⚠ a ✓

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/parting.ts` — importa OC/Shape y ya trae maquinaria de partición del cubo.
- `src/forja/mold/visibilidad.ts::clasificarVisibilidad` — el n·d por cara desde una dirección
  (lo usa la lámina L21). Es el insumo de la silueta.
- `construirAceroE3` + `interseccionMitades` (estudio-molde-datos) — parten el bloque HOY, pero
  con la huella del cubo/del árbol, no con una silueta medida de malla arbitraria.
- `scripts/v1-gate.cjs --dir` — el juez que hoy da 2/20 y que aquí tiene que subir.
- NO existe: silueta de partición desde una malla arbitraria (por eso la lámina lo declara).

## TOCA
- src/forja/mold/parting.ts
- src/forja/mold/visibilidad.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/laminas-visuales.ts
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-28-t7-linea-de-particion/resultados.json

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al activarla)

## EVIDENCIA (declarada ANTES de trabajar)
- gate del ciclo VERDE con los checks nuevos · v1-gate con las 20 Hammond ≥12/20 parten
- still de la línea de partición sobre el engrane de ian
- orden-gate VERDE · Temis n/6

## CIERRE (se llena al terminar)
