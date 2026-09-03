# ORDEN: EL CAMINO EN TEMIS — el proyecto se lleva a sí mismo como proyecto

BASE: 0799784

OBJETIVO: ian (2026-09-02): «necesito tener esto visualmente en Temis. Al final del día es un
proyecto, y aquí el proyecto es **hacer que el proyecto pueda llevarse a sí mismo como proyecto**.
Se alcanza a leer el cine, el cronograma de trabajo — se puede poner el happy path de la Forja de
Hefestos en lugar de cine: **puede ser el cronograma de nuestro happy path**. Y buscar quick wins
iterables chiquitos. Tenemos buena base, hay que conectar todo.»

Temis tenía unidades de TRABAJO (orden, superticket, imprevisto) y ninguna unidad de USO. Las
Moiras hilan, miden y cortan: Temis medía y cortaba — nadie hilaba. EL CAMINO es el hilo.

## EJERCICIOS
- camino-declarado · Un camino es un archivo, no un guion · `caminos/<slug>.md` · actor + promesa + pieza + PASOS (n · gesto · se ve · estado · ticket); el primero es LA CARCASA DE MITSUBISHI con 8 pasos
- camino-en-el-tablero · La franja de arriba lo muestra como cronograma · UI · pestañas CAMINO | CINE (el cine NO se borra: es de la otra sesión); una tarjeta por paso con su estado; cabecera «n/N ✓ · se rompe en el paso k»
- camino-conecta · Cada paso rojo enlaza al ticket que lo debe · vínculo · clic en el chip del paso abre el detalle del ticket (T7, T6, T5) — «conectar todo»
- probado-muere · La columna PROBADO deja de existir · tablero · ian: «ahí dice probado XD»; el «probado» real es que su paso pase en el camino. Se quita la columna, la rejilla vuelve a 4
- quick-win-chiquito · Estado a mano hoy, automático mañana · alcance · esta orden pinta el estado DECLARADO (lo que ya medimos: 20/20 · 17/20 · 2/20); el runner que recorre producción y actualiza los pasos es el siguiente quick win, declarado aquí
- sin-regresion · Nada del tablero se rompe · gate · temis-tablero corre, orden-gate VERDE, el lobby se ve en producción con la franja

## YA-EXISTE
- La franja CINE (`temis-tablero.cjs:242`, `TemisBoard.tsx:221`, CSS `.tm-cine/.tm-dia`): se REUSA
  tal cual para el camino — misma tira, mismas tarjetas.
- Las órdenes T5/T6/T7 con sus slugs: son los dueños de los pasos rojos.
- El arnés `forja-drive.cjs` (20 gestos) y mis guiones de captura: la base del runner futuro.
- NO existe: ninguna noción de camino/happy path en Temis; ninguna forma de ver si la promesa se cumple de punta a punta.

## TOCA
- scripts/temis-tablero.cjs
- src/forja/brep/TemisBoard.tsx
- public/temis.json

## CREA
- ordenes/2026-09-02-el-camino-en-temis.md
- ordenes/2026-09-02-el-banco-no-encanta.md
- caminos/la-carcasa-de-mitsubishi.md
- public/evidencia/2026-09-02-el-camino-en-temis/resultados.json
- public/evidencia/2026-09-02-el-camino-en-temis/temis-camino.png
- public/evidencia/2026-09-02-el-camino-en-temis/temis-paso-ticket.png
- public/evidencia/2026-09-02-el-camino-en-temis/temis-cine-tab.png

## BORRA
- (nada)

## PREEXISTENTE
- public/comando/catalogo.json
- public/comando/produccion.json
- public/temis-deploy.json
- src/cinematic/CinematicMolecule.tsx

## EVIDENCIA (declarada ANTES de trabajar)
- captura del lobby → Temis con la franja EL CAMINO y sus 8 pasos
- captura de un paso rojo abriendo su ticket
- deploy + verificación contra el bundle servido · orden-gate VERDE

## CIERRE (2026-09-02)
**6/6 EN VERDE · medido en el DOM del lobby · orden-gate VERDE · censo Canvas 8→8.**

Temis ya hila. Arriba del tablero vive EL CAMINO — LA CARCASA DE MITSUBISHI, 8 pasos, «4/8 ✓ ·
se rompe en el paso 5» — como cronograma, con CINE a un clic (no se borró: es de la otra
sesión). Cada paso trae su estado (verde/rojo/ámbar/gris) y su chip de ticket: el paso 5 (PARTIR)
abre T7 · LA LÍNEA DE PARTICIÓN, el 6 abre T6, el 8 abre T5. Eso es «conectar todo»: un paso rojo
ya no es una queja, es un ticket con dueño. La columna PROBADO murió («ahí dice probado XD»);
probado es que el paso pase.

Un bug pagado: el `useState` de la franja quedó debajo de los returns tempranos y React tiró
«Rendered more hooks than during the previous render» al llegar temis.json. Hoisted; comentado.

Lo que NO hace esta orden y queda declarado como siguiente quick win: los estados son los
DECLARADOS (lo medido a mano en X4/U10/X6 y en el pliego: 20/20 importan, 17/20 cotizan, 2/20
parten). El runner que recorre producción paso a paso con `forja-drive.cjs` y reescribe los
estados del camino es la orden que sigue.
