# ORDEN: EL DROP CONSERVA EL SÓLIDO — el STEP soltado vive también en el kernel

BASE: 0869ba7

OBJETIVO: golpe 3 de PARA CERRARLO (camino de la carcasa). ian (2026-09-04): «que el drop guarde el
sólido, me gusta» — en memoria del navegador, no en servidores. Hoy `abrirArchivo` abre el STEP con
el kernel, lo tesela a malla y TIRA el sólido; la barra dice «sin caras de kernel: para acotar o
partir, importa un STEP» aunque SÍ era un STEP. Al final de esta orden, soltar un STEP deja las dos
cosas: la malla para el Foco (rápido, sirve igual para STL) y el B-Rep como pieza principal del
documento, que es lo que necesitan EL MOLDE (paso 6), LOS PLANOS (paso 7) y la partición de verdad.

## EJERCICIOS
- drop-conserva · Tras soltar un STEP, el kernel tiene el sólido · `window.__forgeBrep.invariants.vol_kernel > 0` · el mismo texto del STEP entra por `importStepText` (la puerta de DISEÑO ya lo hacía); el volumen del kernel coincide con el `volKernelMm3` que ya declaraba la nota de la malla (±0.1 %)
- foco-intacto · El Foco sigue sobre la malla · sin regresión · las 3 cotas, ENFRIAMIENTO (≤2.5 s) y el dictamen siguen saliendo igual; el visor sigue dibujando UNA pieza (la rama `piezaMalla` del render manda)
- stl-sigue-malla · Un STL no inventa sólido · control negativo · soltar un .stl deja `importedStep` en null (se limpia el de la pieza anterior) y el Foco funciona igual
- barra-honesta · La barra de estado deja de decir «importa un STEP» cuando ya lo importaste · texto · con sólido en el kernel dice cuántas caras trae; sin sólido (STL) sigue avisando
- runner-lo-mide · El paso 2 del camino gana el check del sólido · `## RUNNER` · `js:` sobre invariants tras el drop; el runner sigue 5/8 (el sólido solo se aprovecha en 6-7, que son las órdenes siguientes)
- sin-regresion · Nada se rompe · gate · orden-gate VERDE, censo Canvas 8→8, cero pageerror; TDZ vigilado (`importStepText` se define ANTES de `abrirArchivo`)

## YA-EXISTE (prueba de ausencia)
- `importStepText(text, name)` / `clearImportedStep` (ForgeBRepStudio.tsx ~4168) → `importedStep` →
  el efecto de rebuild (`mainShape = importedStep ? importSTEP(oc, importedStep) : …`, ~3920) produce
  `result`. Es la puerta de DISEÑO; aquí se reusa desde el drop.
- `mallaDesdeArchivo` (stl.ts) ya carga OCCT para el STEP: el kernel está caliente cuando llega el drop.
- NO existía: ningún STEP soltado llegaba al kernel; `hayArbol` era false con pieza soltada.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-07-el-drop-conserva-el-solido.md
- public/evidencia/2026-09-07-el-drop-conserva-el-solido/resultados.json
- public/evidencia/2026-09-07-el-drop-conserva-el-solido/drop-con-solido.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- drive contra el dev de iangpu: drop del 1594C Box → `invariants.vol_kernel` > 0 y ≈ volKernelMm3 de la nota; captura con la barra de estado nueva
- drive con un .stl → `importedStep` null, Foco vivo
- runner completo: sigue 5/8 · se rompe en el 6 · orden-gate VERDE

## CIERRE (se llena al terminar)
**5/6 EN VERDE (1 pendiente declarado) · el STEP soltado vive en el kernel: 472 caras, 55,822 mm³ · el Foco sigue igual.**

- orden vs entregado: idéntico. `abrirArchivo` decodifica el mismo buffer y lo mete por `importStepText`
  (la puerta de DISEÑO); un STL limpia el sólido anterior. La barra dice la verdad en ambos casos.
- números: runner p2-3 = «sólido en el kernel: 472 caras, 55822 mm³» a 16 ms del drop (el import
  tarda hasta ~20 s en el dev: por eso el check lleva @60000 y el paso 3 arranca cuando terminó).
  Costo medido del golpe: en una corrida el import compitió con la lente y ENFRIAMIENTO dio 3.4 s
  (>2.5); con el orden correcto vuelve a 0.3-0.6 s.
- evidencia: drop-con-solido.png (chip «STEP importado», topología V846−E1284+F472=34, volumen).
- pendiente declarado: el control negativo con .stl (3dbenchy.stl) no se corrió hoy — va con el pipeline.
- lo que abrió: gracias a esto existen los pasos 6, 7 y 8 (EL PUENTE arma E1 solo cuando el sólido entra).
