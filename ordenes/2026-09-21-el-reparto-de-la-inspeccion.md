# ORDEN: EL REPARTO DE LA INSPECCIÓN — cinco órdenes en paralelo, cinco agentes Opus, cinco worktrees, una fusión

ESTADO: cerrado
PRIORIDAD: 1

BASE: b3815ba

OBJETIVO: ian (2026-09-21): «reparte el trabajo padrino, recuerda que para todo debe de haber tickets; pueden crear sus tickets
y trabajarlo en paralelo con Opus». Las causas raíz del plan de inspección se atacan a la vez, cada una bajo SU orden, en SU
worktree de git (rama propia) y con SU copia de la app en iangpu (forja-dev3..7, vite :5199/:5195/:5196/:5197/:5198). Yo
(la sesión coordinadora) fusiono las ramas en main una por una, corro tsc + ciclo-dado-test + camino + inspección sobre lo
fusionado, regenero Temis y despliego UNA vez. Ningún agente despliega ni toca main ni public/temis.json.

## LAS CINCO (por causa raíz)
1. LA CARRERA CABE — la pila por la pieza y la apertura con bebedero · ordenes/2026-09-21-la-carrera-cabe.md · dev3 :5199
2. EL AGUA DICE DOS COSAS — una fuente de ⌀ y el juez contra caras/inserto/barrenos · ordenes/2026-09-10-el-agua-dice-dos-cosas.md · dev4 :5195
3. LOS PINES EN LA CARA DEL MACHO — piso real, equilibrio, cabeza capturada · ordenes/2026-09-21-los-pines-en-la-cara-del-macho.md · dev5 :5196
4. LOS INSERTOS SE BARRENAN — bebedero, pines y agua con barreno; retornos fuera · ordenes/2026-09-21-los-insertos-se-barrenan.md · dev6 :5197
5. LA CÁMARA DEL INSPECTOR — que cada punto SE VEA; el inspector entra al repo · ordenes/2026-09-21-la-camara-del-inspector.md · dev7 :5198

## LA DECISIÓN QUE CRUZA A TODAS (ian: «reparte» sobre mi recomendación de UNA verdad)
El cubo firmado (acta R92) cambia con la pila (1) y con el agua (2). Cada orden lista en su CIERRE los literales de
`ciclo-dado-test` que cambió como **ACTA R93 — pendiente de firma de ian**. Si ian dice que no, se revierte esa parte al fusionar.

## RIESGOS DE FUSIÓN (declarados)
- `mold-plano-set.ts`: (1) placas · (2) cooling · (4) retornos — misma función `packageToAssemblySpec` en (1) y (2), líneas distintas.
- `estudio-molde-datos.ts`: (1) apertura · (2) estacion8Dado · (3) estacion10Dado · (4) construirAceroE3 — funciones distintas.
- `useMoldStudio.ts`: (1) moldOpenStrokeMm · (3) cicloBotadoresPieza · (4) cicloPortamoldesPieza · (2) el agua.
- `ForgeBRepStudio.tsx`: (1) openMm/ejectMm · (3) la tira · (5) inspección/corte.
- `scripts/ciclo-dado-test.cjs`: (1)(2)(3)(4) literales — se fusiona a mano.

## ENMIENDA 2026-09-21 (en la fusión)
- `scripts/inspecciona-molde.cjs` (nació en LA CÁMARA DEL INSPECTOR): el punto 3.1 calculaba la apertura como 2.5·H por su cuenta; con LA
  CARRERA CABE fusionada la app abre `carreraDeApertura` y el inspector la LEE (`animZ('clamp')` con `estado(1,0)`). Un check que supone lo
  que la app hace es el gate tautológico al revés. Y el superticket LAS 20 PIEZAS recibe los hallazgos nuevos de los cinco agentes.

## EJERCICIOS
- [x] las 5 órdenes abiertas y en Temis; infraestructura (dev3..7 + vites) viva.
- [x] los 5 agentes terminan con gate VERDE en su rama y CIERRE escrito.
- [x] fusión en main una por una (rebase), conflictos resueltos, tsc/ciclo/camino/inspección sobre lo fusionado.
- [x] Temis regenerado · deploy ÚNICO · verificación del sello y del bundle.

## TOCA
- public/temis.json
- ordenes/DESPUES-DE-V1.md
- scripts/inspecciona-molde.cjs
- ordenes/2026-09-18-las-20-piezas.md
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- public/evidencia/2026-09-21-el-reparto-de-la-inspeccion/resultados.json
- public/evidencia/2026-09-21-el-reparto-de-la-inspeccion/antes-despues.png
- ordenes/2026-09-22-el-macho-de-la-caja-grande.md

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; foto al cerrar, 2026-09-22 — BASE sube al HEAD con las 5 ramas fusionadas)
- docs/CANON-VIDEO.md
- public/comando/comentarios.json
- public/comando/respuestas-comentarios.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- src/cinematic/CinematicMolecule.tsx
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
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- 5 ramas fusionadas; la inspección de las 4 piezas después de la fusión: 3.1, 3.2, 2.1, 2.2, 2.3, 2.5, 7.2, 2.4 ✓ y puntas en la cara.

## CIERRE (2026-09-22 · MEDIDO, no contado)

**Cinco órdenes, cinco agentes Opus en paralelo, cinco ramas fusionadas en main sin perder nada.** Sobre la fusión (las 5 juntas)
la inspección de las 4 piezas pasó de **6/5/8/6 ✓ a 13/13/9/14 ✓**, y las fallas de **8/6/9/8 a 2/2/6/1** (carcasa / tapa / caja
grande / ensamble). tsc 66 = base (cero nuevos) · ciclo-dado-test 266/266 con las cinco ramas · camino de la carcasa 44/46 (los
dos rojos son relojes con iangpu recién reiniciado; todos los checks del molde pasan: portamoldes, la expulsora sube 41.3 mm, la
carrera cabe 46/41.3).

| orden | rama | lo que cerró (medido en las 4 piezas) |
|---|---|---|
| LA CARRERA CABE | 03e6b51 | caja expulsora por la carrera (§4.3.2 Fig 4.22) y apertura = pieza + colada (§6.3.2): 3.1 0/4 → 4/4 · 3.2 1/4 → 4/4 |
| EL AGUA DICE DOS COSAS | 16f4550 | UNA fuente del circuito (3D = lámina = hoja de análisis, 4/4) · agua B ↔ cara de B −1.14 → ≥ +3.17 mm · juez de 8 categorías |
| LOS PINES EN LA CARA DEL MACHO | 157f7b1 | punta por rayo en el piso real (Δ 0 en 3 piezas) · equilibrio (carcasa 14 → 3.9 mm) · cabeza capturada en láminas |
| LOS INSERTOS SE BARRENAN | dcedf6f | bebedero, pines y agua barrenados en cavidad/núcleo: 7.2 0/4 → 4/4 · corte híbrido (el compound perdía brocas) |
| LA CÁMARA DEL INSPECTOR | cb873aa | tarjetas que se ven 28/64 → 63/64 · aislar / cota / geomPose / caraEn · el inspector entra al repo |

**En la fusión (mío):** el único conflicto fue un import en mold-drawing-set.ts (los dos lados; se quedan ambos) · la rama de los
pines arrastraba el commit de reparto ya enmendado → `rebase --onto main` · el inspector suponía 2.5·H para la apertura: ahora LEE
la apertura real de la app · y medía la punta del pin DENTRO de su propio barreno (falso «50 mm metida» en cuanto los insertos
se barrenaron): ahora muestrea la cara del núcleo junto al barreno. Infraestructura: las seis copias compartían el caché de vite
(«Hooks can only be used within the Canvas») → cada copia con su `node_modules/.vite`.

**LO QUE QUEDA ROJO (y por qué)** — `resultados.json`
- **1599HBK: el núcleo no llena la pieza en su centro** (1.1/6.1): hallazgo NUEVO de esta fusión, nace en el acero de E3 →
  ordenes/2026-09-22-el-macho-de-la-caja-grande.md (PRÓXIMO 1). Sus 6.2/2.3/2.5 se re-miden después de arreglarlo.
- **2.4 carcasa y tapa:** los retornos ⌀12 no caben fuera del inserto (banda 16.5 / 26 mm, piden 36) → decisión de ian.
- **2.3 tapa (y alta):** pines que cruzan líneas de agua B → decisión de ian: se mueven los pines o se va a baffles/bubblers.
- **5.1 carcasa y alta:** los postes gruesos mandan el ciclo (6.2× y 4×). Es la PIEZA del cliente, no el molde: el dictamen lo dice.
- **2.2 ensamble:** el agua A entra 1.2–1.5 mm al inserto de cavidad (el barrenado no la alcanza en esa pieza).

**ACTA R93 — PENDIENTE DE FIRMA DE IAN (el cubo firmado cambia):**
- LA CARRERA CABE: caja expulsora 66 → 106, partición 146 → 186; un solo literal del test (las sondas del bebedero pasan de
  absolutas a relativas al datum de la compuerta; imprimen los mismos números).
- EL AGUA: ⌀4.76·H19·W38.1 → ⌀6.35·H25.4·W50.8; seis literales del test (detalle en el CIERRE de su orden).
Si ian dice que no: se revierte esa parte de cada rama.

**PREGUNTAS PARA IAN (juntas, de los cinco agentes):** 1 ACTA R93 · 2 holgura de expulsión 2 vs 1 mm · 3 margen del soporte sobre
el venteo (hoy 96 % en 396×296) · 4 piso maquinable 6.35 deja el flujo laminar (Re 871) · 5 pines vs agua: mover pines o baffles ·
6 retornos ⌀12 que no caben: crece la expulsora · baja la orilla del inserto · ⌀ de la banda · 7 el 0.1·L del equilibrio es regla
nuestra · 8 1557BGY con pisos a 4 alturas: igualar pines o keyearlos (§11.2.6) · 9 ¿orden para pasar `cutAll` al corte híbrido? ·
10 el agua teselada a 0.9 mm da residuos falsos de hasta 1 mm en el estudio de contacto.

**Entrega** · `public/evidencia/2026-09-21-el-reparto-de-la-inspeccion/`: `antes-despues.png` (4 piezas × carrera / insertos / pines,
antes | después) y `resultados.json` (punto × pieza antes → después, gates, hallazgo nuevo). Cada orden trae su propia evidencia.

## FIRMA DE IAN (2026-09-22)
**ACTA R93 FIRMADA** — se quedan la caja expulsora por la carrera (66 → 106, partición 146 → 186) y el agua ⌀6.35·H25.4·W50.8.
Respuestas: 2 holgura **2 mm** · 3 flecha del soporte ≤ **70 %** del venteo por defecto, **85 %** tope — *regla de Hefestos* ·
4 subir el caudal a turbulento · 5 mover pines antes que baffles · 6 crece la expulsora · 7 el 0.1·L se queda como *regla de
Hefestos* (rotulada, no de Kazmer) · 8 cada pin a SU largo + llave + etiqueta (§11.2.6); cada pieza en GAIA con su identificador ·
9 el corte que pierde hoyos «lleva apareciendo varias veces»: solución robusta (una sola función de barrenado + juez de material
quitado), no otro parche · 10 teselar más fino el agua en el estudio de contacto.
