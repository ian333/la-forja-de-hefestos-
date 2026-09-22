# ORDEN: EL REPARTO DE LA INSPECCIÓN — cinco órdenes en paralelo, cinco agentes Opus, cinco worktrees, una fusión

ESTADO: en-curso
PRIORIDAD: 1

BASE: eca3df0

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

## EJERCICIOS
- [ ] las 5 órdenes abiertas y en Temis; infraestructura (dev3..7 + vites) viva.
- [ ] los 5 agentes terminan con gate VERDE en su rama y CIERRE escrito.
- [ ] fusión en main una por una (rebase), conflictos resueltos, tsc/ciclo/camino/inspección sobre lo fusionado.
- [ ] Temis regenerado · deploy ÚNICO · verificación del sello y del bundle.

## TOCA
- public/temis.json
- ordenes/DESPUES-DE-V1.md

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; foto al abrir, 2026-09-21)
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

## CIERRE (se llena al terminar)
