# ORDEN C: LA PUERTA QUE DICE NO — si no se puede moldear, se dice antes del molde y del precio

ESTADO: hoy
PRIORIDAD: 1

BASE: (el agente pone `git rev-parse --short HEAD` tras `git merge --ff-only main`)

OBJETIVO: hoy La Forja nunca dice NO. La tapa con snaps (`1594C Lid.stp`) sale «con-mecanismos» en el DFM y aun así arma un molde de
2 placas, viable, con precio (red team: $31,464); el revisor de contrasalidas `checkUndercut` (`ejectortypes.ts:75`) existe con CERO
llamadas; `stl.ts:88` fija `solidos: 1`; una pieza con grieta cotiza viable; la matrícula de la malla (`matriculaDeMalla`,
`src/forja/verificacion/matricula.ts:413`) existe y no corre al soltar; y el error de entrada vive en el `sim-panel` que el modo
camino pone en opacidad 0 (`piel-futuro.ts`). Esta orden pone UNA puerta en el paso 2 (al soltar), antes del kernel, que dice:
cerrada / grieta, cuántos cuerpos, unidades sospechosas, y si hay contrasalidas — y si no se puede, lo dice con su razón y lo que haría
falta, y BLOQUEA el molde (paso 6) y cualquier precio. Sin estaciones nuevas (ian congeló 60 días las correderas).

## LO QUE SE CONSTRUYE
1. **La matrícula al soltar** (medido por perf: 748 ms en Benchy 225k triángulos, 157 ms en el snap-fit): cierre (aristas abiertas,
   no-manifold), cuerpos, χ/género, devanado; en ≤ 3 s; el resultado en una tarjeta del paso 2 (verde/ámbar/rojo) con palabras de
   taller. `stl.ts` deja de fijar `solidos: 1`.
2. **Cuerpos**: STEP con N > 1 sólidos → «Tu archivo trae N sólidos: ¿cuál moldeo?» con la lista (volumen y caja de cada uno); el
   camino espera la elección. STL → «Con un STL reviso tu pieza; el molde pide el STEP».
3. **Unidades**: solo para STL (el STEP declara unidades; ver `PJ12106.step`): diagonal < 5 mm → «¿está en pulgadas?».
4. **Contrasalidas**: cablear `checkUndercut` (y lo que ya calcula `dfm-mesh.ts` para «con-mecanismos») sobre la dirección de apertura
   del paso 5; si hay regiones que no salen en línea recta, se PINTAN en la pieza y la tarjeta dice: «Tu pieza tiene N zonas que no
   salen del molde en línea recta (contrasalidas, Kazmer §2.3.7). Aquí no diseño correderas: te doy el dictamen de tu pieza y su
   enfriamiento; el molde y el precio, no». Los pasos 6–9 quedan bloqueados (el riel los muestra apagados con un candado).
5. **El error se ve**: el aviso de entrada (`rp-error` y el «no se pudo abrir…») sale en la tarjeta del paso 2, no en un panel oculto.

## YA-EXISTE
- `matricula.ts` (`matriculaDeMalla`), `scripts/verif-matricula-test.cjs` (su prueba), `checkUndercut`, `dfm-mesh.ts` («con-mecanismos»),
  el rótulo en `MoldPanels.tsx` ~L412, `abrirArchivo` en `ForgeBRepStudio.tsx` ~L5220 y el aviso `aviso-entrada-ok`.
- OJO con la filmadora y el runner: hoy hacen clic en `aviso-entrada-ok`; si cambias ese flujo, conserva ese testid para la pieza sana.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/stl.ts
- src/forja/verificacion/matricula.ts
- src/forja/mold/ejectortypes.ts
- src/forja/mold/dfm-mesh.ts
- src/forja/brep/piel-futuro.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/TransicionPaso.tsx

## CREA
- (nada; si de verdad necesitas un archivo, ENMIENDA la orden con la razón)

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA (los tres happy paths del plan)
- **LA PIEZA QUE SÍ** (`1594C Box.stp`): tarjeta verde ≤ 3 s y el camino sigue igual (captura 4K del paso 2).
- **LA PIEZA QUE NO** (`1594C Lid.stp`): tarjeta roja con las regiones pintadas, 0 moldes, 0 precio, pasos 6–9 con candado (captura 4K).
- **EL ENSAMBLE** (`1557BGY.stp` o un 1593K de `test-parts/`): «trae N sólidos, ¿cuál moldeo?» con la lista (captura 4K).
- Par de control de la matrícula: un STL sano pasa; el mismo con un triángulo borrado sale «abierta» (captura o número).
- Gate VERDE; tsc sin errores nuevos.

## CIERRE (se llena al terminar)
