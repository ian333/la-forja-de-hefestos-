# ORDEN: LA INYECTORA DEL TALLER — la FCS HT-150SV es LA máquina de La Forja

BASE: 2ec340d

OBJETIVO: ian (2026-09-08, la máquina entrando al taller): «VE E INVESTIGA TODOS LOS DATOS · todos los
datos de la forja serán ahora con datos de este bebé · ya busqué placa de datos y modelo y nop · es 2022».
Hoy el molde se dimensiona contra un catálogo GENÉRICO (IM-50…IM-500, cifras "representativas LATAM") y la
HM320 del libro. Al final de esta orden existe `MAQUINA_DEL_TALLER` (FCS HT-150SV) con CADA número citado
al catálogo oficial de FCS (no hay placa: la fuente es el catálogo HT 2022 cruzado con la brochure HT-SV
2016), el selector la evalúa PRIMERO (si la pieza cabe en la máquina del taller, esa es la máquina; si no,
dice POR QUÉ no cabe y qué pediría el mercado), el dictamen/expediente muestran su nombre, y lo que el
catálogo NO trae queda marcado SIN DATO (no inventado) con la instrucción de dónde leerlo en la máquina.

## YA-EXISTE (prueba de ausencia)
- `machinesizing.ts:INJECTION_MACHINES` (7 máquinas genéricas + HM320) y `selectInjectionMachine` (mínimo
  tonelaje que cumple cierre/shot≤85 %/presión/expulsión/ajuste). `moldbase.ts:MACHINES` (HM320 + 2
  genéricas) + `checkMachine`. Consumidores: `moldmachine.ts:373` (pkg.maquina.seleccion),
  `estudio-molde-datos.ts:441/777/3693` (planos, expediente, expulsión), `mold-contratos.ts:233/899`
  (boquilla §6.3.1). Tests que fijan nombres: `mold-machinesizing-test.cjs` (cup→IM-50, bezel→IM-250),
  `mold-machine-test.cjs` (diseño→IM-250), `mold-base-test.cjs` (MACHINES[0]=HM320).
- NO existía: ninguna máquina real del taller; ningún doc de máquina (`docs/inyectora/` es la PL1200
  de fabricación propia, otra cosa). El catálogo HT público de FCS (fcs.com.tw, 2025) OMITE las páginas
  9–16 (las tablas); las tablas viven en el catálogo HT 2022 que distribuye Mitchell Industries y en la
  brochure HT-SV 2016 de IMM Technical — ambos bajados y hasheados en el doc.

## TOCA
- src/forja/mold/machinesizing.ts
- src/forja/mold/moldbase.ts
- scripts/mold-machinesizing-test.cjs
- public/temis.json
- public/temis-deploy.json
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- ordenes/2026-09-08-la-inyectora-del-taller.md
- docs/MAQUINA-DEL-TALLER.md
- public/evidencia/2026-09-08-la-inyectora-del-taller/resultados.json
- public/evidencia/2026-09-08-la-inyectora-del-taller/catalogo-2022-ht150.png
- public/evidencia/2026-09-08-la-inyectora-del-taller/catalogo-2022-motor-380v.png
- public/evidencia/2026-09-08-la-inyectora-del-taller/brochure-2016-ht150sv.png
- public/evidencia/2026-09-08-la-inyectora-del-taller/brochure-2016-items.png
- public/evidencia/2026-09-08-la-inyectora-del-taller/platina-ht150.png
- public/evidencia/2026-09-08-la-inyectora-del-taller/maquina-en-la-forja.png
- public/evidencia/2026-09-08-la-inyectora-del-taller/paseo-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol: comando, tutoriales, YouTube)
- public/comando/historia.json
- public/comando/metricas.json
- scripts/captions-pendientes.py
- scripts/playlist-tutoriales.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/CRONOGRAMA.json
- videos/mol-h2o-dos-gotas.json
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

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `node --import tsx scripts/mold-machinesizing-test.cjs` → VERIFY_RESULT pass; los checks del libro
  (cup→IM-50, bezel→IM-250) siguen VERDES contra el catálogo de mercado, y se agregan: cup cabe en la
  HT-150SV (ok, shot ~8 % <25 % como advertencia), bezel NO cabe en la HT-150SV (clamp 157 t > 150 t)
  y cae al mercado → IM-250 con el issue «no cabe en la FCS HT-150SV (taller): …».
- `node --import tsx scripts/mold-base-test.cjs` y `scripts/mold-machine-test.cjs` → pass (sin cambiar
  sus expectativas: HM320 sigue en MACHINES[0]; el diseño de prueba pide >150 t y cae a IM-250).
- Cada número de `MAQUINA_DEL_TALLER` tiene su celda en `catalogo-2022-ht150.png` (columna HT-150) y
  coincide con `brochure-2016-ht150sv.png` (columna HT-150SV); las diferencias entre ediciones se
  ANOTAN en el doc (tie bars 462 vs 460, velocidad 97 vs 128/108, motor 13.4/18.2 vs 11/15).
- Runner en iangpu (dev aislado :5194) sobre la carcasa: el expediente/planos dicen
  «FCS HT-150SV (taller)» → captura `maquina-en-la-forja.png`; paseo grabado y entregado en Downloads
  de AMBAS PCs (mp4 + hoja de contactos `paseo-contactos.png`).
- `node scripts/orden-gate.cjs` VERDE; censo igual (Canvas 8→8, vite/html igual); cero pageerror.

## CIERRE (se llena al terminar)
- orden vs entregado: idéntico en TOCA/CREA/BORRA. Una adición dentro de lo declarado: el paso 7 del
  camino ganó un check (24 en vez de 23) y dos gestos (esperar el overlay y abrir la lámina «Análisis»)
  para que la inyectora del taller se MIDA y se VEA; cero cambios en la interfaz (el nombre aparece solo
  porque la carcasa cabe). `scripts/mold-machinesizing-test.cjs` importa `threeplate.ts` para el daylight.
- números: `mold-machinesizing-test` 20/20 pass (cup→IM-50 y bezel→IM-250 del libro intactos con
  taller=null; cup en la del taller: FCS, ok, shot 8.2 % avisado; bezel: «no cabe en la FCS HT-150SV
  (taller): clamp 157 t > 150 t → en el mercado: IM-250»; gigante: taller.ok=false, governs cierre) ·
  `mold-base-test` pass · `mold-machine-test` pass (diseño 213 t → IM-250) · tsc en iangpu: 0 errores en
  machinesizing.ts/moldbase.ts (158 preexistentes en otros archivos, la mayoría copias viejas sueltas del
  checkout de iangpu) · runner 2026-09-08 23:21 UTC dev :5194 iangpu: **7/8 ok · 7:4/4** (p7-4 «la del
  taller: FCS HT-150SV (taller) CUMPLE») · 6:3/5 como antes (agua/expulsores) · orden-gate VERDE · censo
  8→8 / 41→41 / 46→46.
- evidencia: `public/evidencia/2026-09-08-la-inyectora-del-taller/` — catalogo-2022-ht150.png (la columna),
  catalogo-2022-motor-380v.png, brochure-2016-ht150sv.png + brochure-2016-items.png (el cruce),
  platina-ht150.png (anillo ⌀100, 100×M16, KO), maquina-en-la-forja.png (la hoja de análisis con el renglón
  ampliado), paseo-contactos.png; video 25-LA-INYECTORA-DEL-TALLER-paseo.mp4 (241.9 s, 4K hevc 10-bit
  escalado desde 1080 CSS, declarado) en Downloads de ambas PCs y E:\forja-videos; doc
  `docs/MAQUINA-DEL-TALLER.md` (tabla completa, fuentes con sha256, SIN DATO y dónde leerlo).
- preguntas abiertas (para ian, en la máquina): (1) ¿qué tornillo trae: A ⌀40 / B ⌀44 / C ⌀50? (pantalla
  de parámetros del controlador o grabado del cañón) — hoy B, dicho; (2) ¿220 o 380 V?; (3) orificio y radio
  de la punta de boquilla instalada; (4) foto de la placa de serie (bastidor lado operador / puerta del
  gabinete) y de la platina móvil con cinta. Siguientes tickets, no de esta orden: modelar la platina
  (anillo ⌀100, roscas M16, KO) en `moldbase.ts`; mostrar en la lámina POR QUÉ no cabe cuando no cabe
  (`seleccion.taller.issues`); aviso «molde < 299×299 sugerido»; el letrero final del paseo dice COMPLETO
  con un paso a medias.
