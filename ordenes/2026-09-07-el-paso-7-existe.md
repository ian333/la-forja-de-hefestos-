# ORDEN: EL PASO 7 EXISTE — LOS PLANOS del molde de la pieza soltada, en pantalla y en PDF

BASE: 0869ba7

OBJETIVO: golpe 4 de PARA CERRARLO. ian (2026-09-07): «COMPLETA EL HAPPY PATH».
Hoy el juego de láminas del molde (`buildMoldLaminas`: ensamble, análisis, 5 placas acotadas + 4 vistas,
la pieza moldeada) existe pero solo lo alimenta el FORMULARIO NUMÉRICO de La Máquina; el sólido de la
pieza (`partSolid`) nunca se le pasa. Al final de esta orden, la pestaña PLANOS en EL PARTE toma el
paquete E2 de ESTA pieza y su sólido del kernel, arma las láminas en un overlay con pestañas por lámina
y botón a PDF, y el runner mide el paso 7.
## EJERCICIOS
- planos-gesto · Hay puerta para los planos junto a la pieza · pestaña `parte-lente-planos` · si aún no hay E2, prende MOLDE y los genera al llegar el paquete
- planos-de-esta-pieza · Las láminas salen del paquete E2 de la pieza y de SU sólido · `buildMoldLaminas(OCC, oc, packageToAssemblySpec(e2.pkg), rows, arbol.shape)` · la lámina «Pieza moldeada · 4 vistas» enseña la carcasa, no un preset
- planos-se-ven · Overlay con pestañas por lámina · `planos-del-molde` data-paginas · ≥3 láminas (ensamble, análisis, placas); juzgado con ojos sobre el 1594C Box
- planos-pdf · Todas las láminas a una ventana imprimible · `btn-planos-molde-pdf` · el mismo `laminasToPrintHTML` de La Máquina
- paso-7-verde · El runner mide el paso 7 · `## RUNNER` · gesto PLANOS + 3 checks; el muro se mueve al 8
- sin-regresion · Nada se rompe · gate · orden-gate VERDE, censo Canvas 8→8 (el overlay reusa `.fb-plano-overlay`), cero pageerror
## YA-EXISTE (prueba de ausencia)
- `mold-plano-set.ts:1495` buildMoldLaminas(K, oc, spec, rows?, partSolid?) y `laminasToPrintHTML` (1523); `packageToAssemblySpec` (1535) ya importado en el studio. `MoldMachinePanel.tsx:36-53` es el patrón (rows: recomendación, máquina, DFM). `Estacion2Dado.pkg` (estudio-molde-datos:1543) es el paquete de la pieza. NO existía: ninguna llamada con el sólido de la pieza ni desde el Foco.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-07-el-paso-7-existe.md
- public/evidencia/2026-09-07-el-paso-7-existe/resultados.json
- public/evidencia/2026-09-07-el-paso-7-existe/planos-del-molde.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- drive contra el dev aislado (symlinks) de iangpu: drop → MOLDE → PLANOS → overlay con ≥3 láminas; captura de la lámina de la pieza
- runner completo · orden-gate VERDE · paseo regrabado

## CIERRE (se llena al terminar)
**6/6 EN VERDE · 17 láminas del molde de ESTA pieza, en pantalla y a PDF · el runner mide el paso 7 OK.**

- orden vs entregado: idéntico. `buildMoldLaminas` recibe por primera vez el `partSolid` (el sólido del
  STEP): la lámina «Pieza moldeada · 4 vistas» enseña la carcasa. Ensamble con sección A-A y BOM de 12
  renglones (MLD-1594CB), Análisis, 5 placas acotadas y 5 a 4 vistas.
- números: 17 láminas · el runner 3/3 · abrir los planos tras el molde: 7 ms con click crudo.
- evidencia: planos-del-molde.png (lámina Ensamble legible) · resultados.json.
- defecto pagado: `locator.click` de Playwright vencía 15 s en PLANOS tras armar el molde (212k tris) por
  su espera de estabilidad; un click crudo entraba en 7 ms → `force:true` en el gesto, declarado en el
  camino. Y cerrar el overlay tiraba las láminas (el expediente las perdía) → estado `planosOn` aparte.
