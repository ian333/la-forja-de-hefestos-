# ORDEN: T6 · PIEZAS COMPLEJAS DE VERDAD — "todas las piezas serán complejas"

BASE: 3f86e47

OBJETIVO: ian, mirando la planta de su engrane: «si me enseñaras algo plano… **y todas las
piezas serán complejas**». Es la advertencia correcta: nuestro banco está lleno de cajas
(vaso, bezel, LEGO, charola) y los análisis se ven bien porque las cajas perdonan. El engrane
que él cargó ya se ve pixelado en la planta, y las 20 Hammond dan 2/20 al partir.

Al terminar: los análisis aguantan piezas complejas y el gate lo DEMUESTRA con piezas
complejas, no con cajas — y donde no aguanten, la pantalla lo dice en vez de dibujar bonito.

## EJERCICIOS
- cplx-resolucion · El raster se adapta a la pieza, no al revés · vóxeles por rasgo mínimo · el engrane resuelve sus dientes (nº de dientes contado del raster = el real)
- cplx-limite-honesto · Cuando la malla no alcanza, se DICE · aviso de resolución · una pieza que necesita más vóxeles que el tope muestra "resolución insuficiente para X", no un dibujo liso
- cplx-banco · El banco deja de ser solo cajas · gear + Hammond + benchy · el gate corre ≥5 piezas complejas y publica su tabla
- cplx-tiempo · Complejo no significa colgado · presupuesto de tiempo · ninguna pieza del banco pasa de 20 s de análisis en iangpu
- cplx-fidelidad · El volumen del raster cuadra con el de la malla · ±5 % · las 5 piezas complejas cuadran (hoy medido: vaso −0.4 %, cubo exacto)
- cplx-control · CONTROL NEGATIVO: bajarle la resolución REPRUEBA · el gate detecta la degradación · con la mitad de vóxeles el engrane falla su propio check de dientes

## YA-EXISTE (prueba de ausencia)
- `predicadoDeMalla` (flowlen.ts) y `solidFromMesh` con `maxVoxels` — el tope existe, pero es
  un número fijo, no derivado del rasgo más chico de la pieza.
- `scripts/mold-dfm-mesh-test.cjs` ya corre benchy/rpi4/embudo: el germen del banco complejo.
- `test-parts/` tiene el material: gear.stl, extruder-body.stl, einsy-base.stl, naturebytes-*,
  y las 23 Hammond.
- NO existe: resolución derivada del rasgo mínimo, ni aviso honesto de "no alcanza".

## TOCA
- src/forja/mold/flowlen-mesh.ts
- src/forja/mold/dfm-mesh.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-28-t6-piezas-complejas/resultados.json

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al activarla)

## EVIDENCIA (declarada ANTES de trabajar)
- tabla del banco complejo con tiempos y error de volumen · control negativo en rojo
- orden-gate VERDE · Temis n/6

## CIERRE (se llena al terminar)
