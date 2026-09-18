# ORDEN: EL PORTAMOLDES DE TU PIEZA — las placas de sujeción con sus ranuras de clamp, rieles, soporte, expulsora y retenedora en el 3D del molde de la pieza soltada

ESTADO: proximo
PRIORIDAD: 4

BASE: ee10820

OBJETIVO: ian (2026-09-18, tras el video 32): «por primera vez tenemos el ciclo completo, aún faltan los portamoldes
y las placas iniciales para poner los clamps, pero a mi parecer hemos llegado». Hoy el molde de la pieza soltada es el
CORAZÓN — insertos, placa A y placa B como dos cajas fantasma, colada, agua, botadores — y nada más: los 8 pines
terminan EN EL AIRE (cuerpo hasta z 87.6, sin placa que los empuje) y no hay de dónde agarre la inyectora. Al final de
esta orden el 3D del molde de TU pieza trae su portamoldes completo: placa de sujeción superior e inferior CON sus
ranuras de clamp (Fig 1.4), placa de soporte, rieles, placa expulsora + retenedora con las cabezas de los pines
capturadas, pines de retorno, postes guía + bujes y el anillo centrador con el bushing; y en el ciclo animado la
expulsora SUBE con los pines y el lado fijo se va con la apertura.

## YA-EXISTE (prueba de ausencia · medido 2026-09-18)
- **El portamoldes completo YA se construye** — para la Máquina de Moldes, no para el ciclo de la pieza:
  `buildMoldParts(K, oc, spec, detail, partMesh, realSolids)` (mold-plano-set.ts) arma las placas `clamp · A · B ·
  support · ejector · ejector-ret · bottom` con `buildPlateSolid`, que ya talla la **ranura de clamp en cada oreja**
  (Fig 1.4: angosta, a lo largo de Y, en la cara que toca la platina, con hombro sólido a los lados), los barrenos guía
  escalonados y el asiento del bushing; y los componentes `rieles · pilares-soporte · guias · bujes · anillo · pines ·
  pines-retorno`. `buildMountParts` agrega `platina-fija` y `platina-movil` («las bridas NO se modelan como bloques:
  el libro monta con RANURAS»).
- **La animación ya sabe moverlo:** `MOLD_A_SIDE = clamp · A · inserto-cav · agua-a · colada · anillo · bujes ·
  platina-fija · tornillos-cav` viaja con la apertura; `ejector · ejector-ret · pines · pines-retorno` viajan con la
  expulsión (MoldScene.tsx).
- **La spec de la pieza ya existe:** `packageToAssemblySpec(ciclo.e2.pkg)` — es la que usan las 17 láminas del paso 7,
  que YA dibujan «Placa de sujeción superior/inferior», «Placa retenedora (cabezas)», «Placa expulsora». El z del
  stack es el MISMO del ciclo (`plateStackZ`: la partición = tope de B).
- Hoy solo lo llama el camino de `liveMoldSpec` (useMoldStudio.ts:435). El ciclo de la pieza dibuja en E3 dos cajas:
  `placa-a-ghost` y `placa-b-ghost` (useMoldStudio.ts:927-928).
- NO existe: el ciclo de la pieza pidiendo su portamoldes; un check del runner que lo exija; la medida de cuánto tarda
  `buildMoldParts` sobre una base de 446×546 (puede ser caro: cada ranura y barreno es un corte del kernel).

## EL RIESGO QUE HAY QUE CUIDAR
`buildMoldParts` también dibuja SUS propios insertos, agua, colada, pines y pieza. El ciclo de la pieza ya tiene los
suyos, mejores (cavidad/núcleo del sólido real, el circuito §9 con los números de la pieza, los 8 pines por agarre).
Se toma del constructor SOLO el portamoldes (placas + herrajes); si se mezclan los dos juegos hay dos aguas y dos
juegos de pines en pantalla — otra vez «dos cosas».

## PROPUESTA (para el simón de ian)
E3 («base comprada») pasa de dos cajas a la PILA completa en bloques baratos (sujeción · A · B · soporte · rieles ·
expulsora · retenedora · sujeción inferior): el portamoldes se COMPRA primero y debe verse desde que aparece el acero.
El detalle caro (ranuras de clamp, postes guía + bujes, anillo centrador, pines de retorno, pilares) entra en una
estación final «EL PORTAMOLDES» después de los botadores, con su barra de progreso, y entonces arranca el ciclo.
Las platinas de la inyectora, ocultas por defecto (son contexto, no molde).

## EJERCICIOS
- [ ] medir en node `buildMoldParts(spec de la carcasa, 'blocks' y 'full')`: tiempo y triángulos por rol.
- [ ] E3 con la pila completa en bloques (roles del constructor, no `-ghost`); cubo bit-igual (266/266).
- [ ] estación final con el detalle; los cuerpos de los pines llegan a la retenedora (cabeza capturada, Fig 1.6).
- [ ] la animación: `animZ('ejector')` ≈ la carrera de expulsión; `animZ('clamp')` ≈ la apertura.
- [ ] kernel: los pines y el agua NO chocan con el portamoldes (traslape 0 mm³ fuera de sus barrenos).
- [ ] RUNNER paso 6: check «portamoldes» (roles `clamp` + `bottom` + `ejector`) y encuadre todavía ≥ 0.30 / centrado.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldScene.tsx
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-plano-set.ts
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- public/evidencia/2026-09-18-el-portamoldes-de-tu-pieza/resultados.json
- public/evidencia/2026-09-18-el-portamoldes-de-tu-pieza/portamoldes-en-el-molde.png
- public/evidencia/2026-09-18-el-portamoldes-de-tu-pieza/paseo-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; git status al registrar el ticket, 2026-09-18)
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json
(de la otra sesión — LA CIUDAD DE NOCHE, commit 1a9f138; lo volvió a editar después de mi foto)
- scripts/precompute-ciudad.py

## EVIDENCIA (se declara ANTES de trabajar)
- Paso 6: el check «portamoldes» del RUNNER pasa y no se pierde ninguno de los 13 de hoy; el camino sigue 8/8.
- Las ranuras de clamp se VEN en las dos placas de sujeción; la expulsora sube con los pines en el ciclo animado
  (`animZ('ejector')` medido) y la sujeción superior se va con la apertura.
- Traslape 0 mm³ entre pines/agua y el portamoldes (kernel); `ciclo-dado-test` 266/266.
- Paseo con el molde COMPLETO; video en ambas PCs; orden-gate VERDE.

## CIERRE (se llena al terminar)
