# ORDEN: X4 · EL HAPPY PATH — sueltas tu pieza y ya estás viendo

BASE: fe1b84c
TIPO: imprevisto

OBJETIVO: ian, viendo el lienzo vacío: «**se sigue viendo el cuadrado**, no me termina de
gustar. Hagamos el happy path: **subir un STL Y EMPEZAR A VER INFORMACIÓN.** De ahí nos
derivamos a un chingo de cosas».

Tenía razón en las dos, y la segunda es la grande.

## MEDIDO ANTES DE TOCAR

**El camino a la primera información eran SEIS pasos:**
tarjeta del lienzo → «o abre un proyecto» → panel del lobby → «＋ Abrir archivo» → diálogo de
archivos → carga → **tecla Q**. Y hasta ahí, información.

**No existía arrastrar-y-soltar en ningún lado del CAD** (cero `onDrop` en todo el archivo).
El gesto natural con un STL —tirarlo a la ventana— no hacía nada.

Y el cuadrado era literalmente una caja: `background` + `border` + `borderRadius: 14` +
`backdropFilter`, flotando en un lienzo que debería estar vacío. Encima enseñaba el camino
LARGO (tres pasos de boceto) en vez del que ian quiere.

## EJERCICIOS
- x4-un-gesto · Sueltas el archivo EN CUALQUIER PARTE y carga · `onDrop` en `.fb-root` · el drop va en la raíz, no en el viewport: nadie apunta al viewport cuando arrastra, apunta a la ventana
- x4-una-sola-verdad · Las DOS puertas usan el MISMO código · `abrirArchivo` · el handler estaba inline en el JSX del lobby; se extrae a un `useCallback` que usan el input y el drop. Copiarlo habría sido tener dos flujos que se desincronizan
- x4-ver-de-inmediato · Al cargar ya hay información, sin tocar Q · el Foco se prende solo · entra en MEDIDAS, que es instantáneo: las cotas salen sobre la pieza sin pagar el campo. Las lentes se calculan si las pides
- x4-sin-cuadrado · El lienzo vacío deja de ser una tarjeta · CSS · sin fondo, sin borde, sin radio: tipografía sobre el lienzo. Y dice el camino CORTO
- x4-avisa-al-arrastrar · Se ve que la ventana acepta el archivo · marco · mientras arrastras sale un marco fino (no una caja) que dice SUÉLTALO; se va al soltar o al salir
- x4-sin-regresion · Nada de lo que ya servía se rompe · gate · `ciclo-dado-test.cjs` verde, el lobby sigue abriendo archivos, y el drive no da errores de consola

## YA-EXISTE (prueba de ausencia)
- `mallaDesdeArchivo` + `mallaParaElVisor` + `bboxDeMalla` ya hacen todo el trabajo de cargar.
  Este ticket **no toca el cargador**: le abre una puerta más y las junta en una función.
- `ProjectSwitcher` ya tiene su `input[type=file]` (`input-ps-archivo`). Se queda: es la puerta
  para quien prefiere buscar. Ahora las dos llaman a lo mismo.
- El Foco (`focoOn`) y las cotas (`focoCotas`) ya existen desde U3. Solo se prende solo.
- NO existe: ningún `onDrop`/`onDragOver` en todo el CAD.

## LO QUE CAMBIA UNA DECISIÓN VIEJA, dicho de frente
U3 dejó el Foco **apagado** al arrancar, por la regla de Detroit («el HUD limpio, la
información solo cuando hace falta»). Aquí se prende solo al soltar una pieza. No es
contradecir la regla: **soltar una pieza ES cuando hace falta.** Sigue apagado en un lienzo
vacío, que es donde la regla aplicaba.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- public/temis.json

## CREA
- ordenes/2026-09-01-x4-el-happy-path.md
- public/evidencia/2026-09-01-x4-el-happy-path/resultados.json
- public/evidencia/2026-09-01-x4-el-happy-path/lienzo-sin-cuadrado.png
- public/evidencia/2026-09-01-x4-el-happy-path/arrastrando-sueltalo.png
- public/evidencia/2026-09-01-x4-el-happy-path/soltado-el-foco-solo.png

## BORRA
- (nada)

## PREEXISTENTE
<!-- de la OTRA sesión de Claude (el video del campo + el túnel a iangpu). -->
- scripts/iangpu.sh
- src/cinematic/CinematicMolecule.tsx
- public/comando/catalogo.json
- public/comando/produccion.json
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json

## EVIDENCIA (declarada ANTES de trabajar)
- captura del lienzo vacío SIN cuadrado
- captura arrastrando: el marco SUÉLTALO
- captura al soltar: la pieza con el Foco prendido y sus cotas, sin haber tocado Q
- prueba de drop REAL (DataTransfer con el archivo), no simulada con el input
- gate `ciclo-dado-test.cjs` verde · orden-gate VERDE · censo Canvas 8→8
- deploy + verificación contra el bundle SERVIDO
