# ORDEN: EL PORTAMOLDES DE TU PIEZA — las placas de sujeción con sus ranuras de clamp, rieles, soporte, expulsora y retenedora en el 3D del molde de la pieza soltada

ESTADO: cerrado
PRIORIDAD: 1

BASE: 777b020

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

## SE ABRE · 2026-09-21 (el simón de ian: «me mama, date recio»)
ian, tras ver el video 34: «en verdad se hace el molde, PERO FALTA EL PORTAMOLDE, FALTA LITERAL TODO EL MOLDE que se vea en
el video» y «todo se ve igual, no hay colores entre placas». Acordado: el camino de la carcasa NO cambia de promesa, se
ENDURECE — en el paso 6 «el molde» es el molde ENTERO — y esta orden le debe ese paso.
- **Medido al abrir (node + kernel, carcasa 1594C, pared 3.2):** el marco del constructor ES el del ciclo (partición 160 =
  `plateStackZ().A`, base 246×246 desde la misma esquina). `buildMoldParts` completo: **6.2 s**, 25 componentes, 68,824
  triángulos (lo funcional solo 0.5 s; las placas ~5.5 s) → en el navegador ~15 s: va como ESTACIÓN FINAL, no en E3 (el
  reloj de la colada ≤60 s ya va justo). El constructor YA trae color por placa (`PLATE_TINT`) y acero opaco.
- La expulsora del 3D SÍ cabe entre los rieles (x 65..181 en un hueco 50..196): lo de «expulsora del ancho de la base» de
  los revisores es de las LÁMINAS, no de estas piezas.
- **Dos verdades que el portamoldes va a enseñar a cuadro:** (1) los cuerpos de los pines acaban en z 87.6 y la cabeza debe
  quedar capturada en z 58 (la longitud libre se midió a la partición, no a la punta: faltan zPiso − zPartición = 29.6 mm);
  (2) la CARRERA NO CABE: entre la retenedora (z 71) y el soporte (z 102) hay 31 mm libres y la expulsión de la carcasa es
  H + 8 = 41.3 mm (causa 3 de LAS 20 PIEZAS). Se mide y se decide DENTRO de esta orden si se arregla o se registra.
- Del constructor se toma SOLO el portamoldes: placas `clamp · support · ejector · ejector-ret · bottom` + herrajes `rieles ·
  pilares-soporte · guias · bujes · anillo · pines-retorno · tornillos-cav · tornillos-core · interlocks`. Se DESCARTAN sus
  `pieza · inserto-* · colada · agua-* · pines` (el ciclo tiene los suyos, mejores) y las platinas. Las placas A y B del
  ciclo se quedan (son la ventana para ver adentro): así no hay dos aguas barrenadas.

## ENMIENDA · 2026-09-21 (deuda de LA ENTRADA cazada al correr el cubo)
- `ciclo-dado-test` dio 265/266: falló «CARGADOR · un STEP con varios sólidos lo DICE», que pedía la palabra «FUSIONADOS».
  Desde LA ENTRADA el cargador moldea la pieza MAYOR y lo dice; el check se quedó pidiendo el defecto viejo. El 266/266
  que reporté en el cierre de LA ENTRADA se midió ANTES de la enmienda de `stl.ts` y no lo volví a correr: **error mío**.
  Entra al TOCA `scripts/ciclo-dado-test.cjs`: el check pide la verdad nueva y además la MIDE (kernel y malla = 25.16 cc,
  el sólido mayor de 1553B, no el ladrillo de 10).

## PROPUESTA (para el simón de ian)
E3 («base comprada») pasa de dos cajas a la PILA completa en bloques baratos (sujeción · A · B · soporte · rieles ·
expulsora · retenedora · sujeción inferior): el portamoldes se COMPRA primero y debe verse desde que aparece el acero.
El detalle caro (ranuras de clamp, postes guía + bujes, anillo centrador, pines de retorno, pilares) entra en una
estación final «EL PORTAMOLDES» después de los botadores, con su barra de progreso, y entonces arranca el ciclo.
Las platinas de la inyectora, ocultas por defecto (son contexto, no molde).

## EJERCICIOS
- [x] medir en node `buildMoldParts(spec de la carcasa, 'blocks' y 'full')`: tiempo y triángulos por rol.
- [x] E3 con la pila completa en bloques (roles del constructor, no `-ghost`); cubo bit-igual (266/266).
- [x] estación final con el detalle; los cuerpos de los pines llegan a la retenedora (cabeza capturada, Fig 1.6).
- [x] la animación: `animZ('ejector')` ≈ la carrera de expulsión; `animZ('clamp')` ≈ la apertura.
- [x] kernel: los pines y el agua contra el portamoldes — MEDIDO con `moldSolidCollisions`: pines 0.02 mm (ajuste) tras el arreglo; el agua B SÍ entra al soporte (causa 2, registrada) y los retornos al núcleo (registrado).
- [x] RUNNER paso 6: check «portamoldes» (roles `clamp` + `bottom` + `ejector`) y encuadre todavía ≥ 0.30 / centrado.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldScene.tsx
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-plano-set.ts
- caminos/la-carcasa-de-mitsubishi.md
- scripts/ciclo-dado-test.cjs
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
(foto del árbol al ABRIR la orden, 2026-09-21)
- src/cinematic/CinematicMolecule.tsx
(llegaron de la otra sesión MIENTRAS trabajaba — el gate los marcó antes del commit; BASE sube a su commit 777b020; no entran al mío)
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- scripts/narracion-gen.py

## EVIDENCIA (se declara ANTES de trabajar)
- Paso 6: el check «portamoldes» del RUNNER pasa y no se pierde ninguno de los 13 de hoy; el camino sigue 8/8.
- Las ranuras de clamp se VEN en las dos placas de sujeción; la expulsora sube con los pines en el ciclo animado
  (`animZ('ejector')` medido) y la sujeción superior se va con la apertura.
- Traslape 0 mm³ entre pines/agua y el portamoldes (kernel); `ciclo-dado-test` 266/266.
- Paseo con el molde COMPLETO; video en ambas PCs; orden-gate VERDE.

## CIERRE (2026-09-21 · MEDIDO, no contado)

**El molde de TU pieza ya es un MOLDE ENTERO, y se mueve entero.** Carcasa 1594C: desde E3 aparece la pila comprada en
bloques (sujeción superior e inferior con su oreja, soporte, rieles, expulsora + retenedora) junto con A y B; tras los
botadores, la **estación 8 · EL PORTAMOLDES** cambia los bloques por el acero fresado del constructor — 14 componentes:
ranuras de clamp en las dos sujeciones, anillo centrador + bushing, postes guía + bujes, pilares, retornos, tornillería
e interlocks, cada placa con SU tinte — en **5.4 s de kernel (6.7–9.2 s la estación)**, y entonces arranca el ciclo: el
lado A sube completo con su sujeción y su anillo, y la expulsora + retenedora SUBEN con los pines.
Runner: `portamoldes` ✓ · «el molde TRABAJA 33.6 %» · «los botadores SUBEN 41.3 mm» · **«la expulsora SUBE con los pines:
41.3 mm»** · encuadre centrado (fill 0.68).

**Lo que se entregó**
- `mold-plano-set.ts`: las cotas del portamoldes con NOMBRE y una sola fuente (`EXPULSORA_MARGEN_*`, `RIEL_ANCHO_MM`,
  `orejaDeSujecionMm`, `tinteDePlaca` — mismos números de antes); `portamoldesEnBloques(spec)` (la pila en cajas, ms) y
  `soloPortamoldes(parts)` (del constructor se toma SOLO la base: nada de su pieza, insertos, colada, agua ni pines).
- `useMoldStudio.ts`: la pila en E3 (solo con pieza; el cubo bit-igual) · `cicloPortamoldesPieza` (estación 8, con los
  barrenos de TUS pines) · la animación arranca cuando el molde está entero · **los pines llegan a la retenedora** (el
  cuerpo acababa en z 87.6, en el aire; ahora baja a z 58 con su cabeza capturada, Fig 1.6).
- La tira: `E8/8`, `✓ portamoldes` (solo con el acero fresado: anillo + guías + retornos, un bloque no la gana) y el aviso
  de la carrera; ficha de la estación 8; «paso 8/8». La ficha de enfriamiento del cubo ya no se cuela en la estación 8 de la pieza.
- Camino: el paso 6 ENDURECIDO — «el molde» es el molde entero, que trabaja y cuya carrera cabe (3 checks nuevos).

**Lo que cazó el estudio de colisiones sobre el molde entero (`moldSolidCollisions`)** — `resultados.json`
- **ARREGLADO: el núcleo se quedaba «abierto −40 mm» para siempre.** En el molde armado el macho colgaba 40 mm bajo la
  pieza: 434,000 mm³ compartidos con el soporte (9.5 mm), 11 mm en los pilares. Invisible sin portamoldes. Ahora, medido
  todo, el molde de tu pieza CIERRA (núcleo z 130..189.8) y sus cotas suben con él. El cubo se queda como lo firmó ian.
- **ARREGLADO: barrenos del soporte/retenedora con el ⌀ de la punta** (0.55 / 0.50 mm de acero compartido por pin) → con
  el ⌀ del CUERPO: 0.02 mm (ajuste).
- **REAL, registrado:** los retornos atraviesan la esquina del inserto de núcleo (5.3 mm) · el agua B entra 1.14 mm en el
  soporte (= la causa 2 de los revisores, confirmada por otra vía) → superticket LAS 20 PIEZAS.
- **Falso positivo del detector:** nucleo/cavidad ↔ guias/bujes (mallas de 4 cuerpos; hay 7 mm de acero entre ellos).
- Dentro del portamoldes: 0 colisiones.

**LA CARRERA NO CABE — se enseña, no se esconde:** la caja expulsora es un literal de 66 mm en `packageToAssemblySpec`:
31 mm libres contra 41.3 (H + 8). En el video 35 la retenedora entra 10 mm en el soporte en cada ciclo, con el aviso en
pantalla. Arreglarlo mueve toda la pila y los 266 literales del cubo FIRMADO → **ordenes/2026-09-21-la-carrera-cabe.md**
(PRÓXIMO, prioridad 1), que le debe al camino el check «la carrera cabe» (rojo a propósito desde hoy).

**Regresión**
- `ciclo-dado-test` **266/266**. Al abrir dio 265: el check del CARGADOR pedía la palabra «FUSIONADOS» — deuda de LA
  ENTRADA (mi 266/266 de aquel cierre se midió ANTES de tocar `stl.ts`). Ahora pide y MIDE la pieza mayor (25.16 cc).
- tsc 66 = 66, lista idéntica. orden-gate VERDE.
- Camino: **7/8, 44/46**. Los dos rojos: `p6-5` (colada 61.0 / 62.3 s contra 60 — el reloj de siempre con el host cargado,
  E5 75–80 s contra 57.5 sola) y `p6-12` «la carrera cabe» (a propósito). La evidencia declarada decía «el camino sigue
  8/8»: NO se cumple y es por decisión — ian y yo acordamos endurecer el paso 6 y dejarlo en rojo hasta que sea verdad.

**Lo que NO se hizo / queda feo (para el ticket de acero + corte + color, y el modo cine)**
- Durante E3→E7 la pila es translúcida y pálida («todo se ve igual» sigue siendo cierto ahí); al abrir, el lado A se sale
  de cuadro (el encuadre no contempla la carrera); las ✗ rojas falsas y el ruido de paneles siguen.
- Las placas A y B siguen siendo las cajas del ciclo (sin bolsillo ni barrenos): se dejaron a propósito para no barrenar
  dos aguas distintas.

**Entrega** · video 35 en Downloads de las dos PCs y E:\forja-videos: `35-EL-PORTAMOLDES-el-molde-entero-paseo.mp4`
(+ `-1080-h264`, `-720-chat`). Evidencia: `portamoldes-en-el-molde.png` (cerrado | abierto expulsando),
`paseo-contactos.png`, `resultados.json`.
