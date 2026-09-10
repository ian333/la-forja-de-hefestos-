# ORDEN: EL PASO 6 SE VE TRABAJAR — el molde se va armando, estación por estación, sin congelar la pantalla

BASE: f1397c0

OBJETIVO: ian (2026-09-09): «sí prefiero que el molde se vaya armando». Medido el 2026-09-08 en iangpu:
al tocar MOLDE la pantalla se CONGELA 90 s (E3 talla el acero en el hilo principal: ni el arnés pudo
capturar), luego 48 s de viewport casi negro (E4), y el molde armado aparece de golpe a los 176 s del
paseo, el 73 % del video. Un cliente a los 20 s cree que se murió; a los 40 recarga y paga otros 36 s de
carga. Al final de esta orden el molde EMERGE sobre la pieza estación por estación, cada estación con su
rótulo («¿cuántas cavidades?», «SPRUE DIRECTO»…) en ≤4 s de pantalla, la pieza jamás sale del cuadro, el
hilo principal nunca se bloquea más de 1 s, y la primera placa aparece en ≤10 s. Presupuesto del paso
entero: ≤60 s con progreso visible por estación.

## LO QUE IAN VIO EN EL VIDEO 26 (2026-09-09)
- **0:50 → 1:56 «se queda cargando»**: 66 s de video con la caja morada quieta bajo el letrero «EL MOLDE»
  (y eso ya con los congelones cortados a 3 s: en crudo son ~90 s de hilo bloqueado en E3). Es el hoyo que
  esta orden tapa: el tallado fuera del hilo y el molde apareciendo estación por estación.

## LO QUE HEREDA DE LO QUE HAY SE VE (2026-09-10, medido)
- La cámara ya no es el problema: salta (dur 0) al bloque entero en cuanto cambian las partes (`__forjaOrbitLog`).
- El hilo: E2/E3 bloquean 72-79 s (p6-1) en cada corrida; en la MEDICIÓN E3→E4→E5 tardan < 1 s después, pero en
  el PASEO (con REC) la cadena se alarga y retrocede: p6-2 devolvió «false» (la estación baja de 3), p6-3 «placas»
  tardó 22 s, p6-4 «colada» 59 s, y el encuadre falló en el paseo (10.9 s) y pasó en la medición. Sospecha: el
  PUENTE re-siembra E1 si cambia `intakeRev`/`arbolRev` a mitad del ciclo (`useMoldStudio` efecto con deps
  `[oc, arbolRev, intakeRev]`), o E5 (colada + «una sola tubería») bloquea decenas de segundos bajo carga.
- El video 27 conserva ~10-20 s oscuros en 130-140 s (frontera E2→E3): esta orden los debe.

## POR QUÉ ES EL GOLPE ESTRUCTURAL
- Es el paso que vende el producto y es donde el video se muere (170 de 242 s quietos o negros, y 63
  congelones cortados antes).
- El tallado B-Rep (booleanas OCC sobre el sólido real) tarda 19–110 s según la pieza. No se edita: se
  saca del hilo principal (worker con su propia instancia del kernel) o se vuelve progresivo (una placa por
  vuelta del ciclo, pintando el ghost mientras se talla la siguiente).

## YA-EXISTE (prueba de ausencia)
- `useMoldStudio.ts`: `cicloEstacion2/3/4/5` ya avanzan una estación por render (`setTimeout(paso, 80)`,
  orden el-paso-6-existe); E4 ya pinta `frenteGrid` y ghosts (`placa-a-ghost`, `placa-b-ghost` en
  `data-roles`). La secuencia existe; lo que bloquea es E3 (`buildMoldLaminas`/booleanas con `partSolid`).
- `scripts/forja-drive.cjs` ya marca `SHOT_TIMEOUT_*` cuando el hilo se congela y `NO_PERF_MEASURE=1`
  quita el perfilador de React: el arnés ya sabe DETECTAR el congelón; falta que el producto no lo tenga.
- El kernel OCC corre hoy en el hilo principal (`opencascade.wasm`); no hay worker del kernel.
- NO existe: progreso por estación visible al cliente (el único indicador es el título de la ventana a
  11 px), ni presupuesto de tiempo en el ciclo.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/fan.ts

ENMIENDA 2026-09-10 20:40 UTC (fan.ts entra a TOCA): la telemetría midió E5 = 54.9 s de los 73 s del ciclo y su peso
es el solver FAN en el hilo; el solver se vuelve GENERADOR con envoltura síncrona bit-igual + variante async que cede
el hilo entre tandas de pasos; ninguna ecuación cambia; ciclo-dado-test.cjs se corre antes y después.
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- public/evidencia/2026-09-09-el-paso-6-se-ve-trabajar/resultados.json
- public/evidencia/2026-09-09-el-paso-6-se-ve-trabajar/e3-por-pasos.png
- public/evidencia/2026-09-09-el-paso-6-se-ve-trabajar/telemetria.png
- public/evidencia/2026-09-09-el-paso-6-se-ve-trabajar/paseo-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol: comando, tutoriales, YouTube, ecolchon)
- public/precomputed/economia-colchon.json
- scripts/assemble-narracion.py
- scripts/precompute-colchon.py
- scripts/ticks-reloj.py
- scripts/video.sh
- src/cinematic/CinematicMolecule.tsx
- videos/econ-colchon.json
- scripts/reemplazar-yt.py
- videos/tutorial-29-anatomia-producto.json
- public/comando/historia.json
- public/comando/metricas.json
- scripts/captions-pendientes.py
- scripts/playlist-tutoriales.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- cuenta.html
- precios.html
- deploy/nginx-forja.conf
- scripts/cuenta-puerta-fija.sh
- scripts/cuenta-webhook.py
- scripts/guiones/econ-colchon.txt
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

## EVIDENCIA (se declara ANTES de trabajar)
- RUNNER paso 6: `testid:molde-de-la-pieza@150000<=10000` (primera placa en ≤10 s) en verde; el paso
  entero ≤60 s.
- Cero `SHOT_TIMEOUT_*` en meta.json del runner (el arnés pudo capturar cada estación).
- Paseo: en la línea de tiempo (un cuadro cada 8 s) el molde cambia de un cuadro al siguiente durante el
  paso 6; ninguna secuencia de más de 2 cuadros iguales; ningún cuadro negro.
- `__forgeBrep.encuadre()` verde en cada estación (ley de LO QUE HAY SE VE).
- Agua y expulsores siguen siendo de T6: el paso 6 sigue «a medias» y lo dice; esta orden NO los promete.
- orden-gate VERDE; censo igual (un worker no es Canvas).

## CIERRE (se llena al terminar)
- orden vs entregado: TOCA idéntico más la ENMIENDA declarada (fan.ts, 20:40 UTC, antes de tocarlo); CREA idéntico
  (resultados.json, e3-por-pasos.png, telemetria.png, paseo-contactos.png); BORRA nada. El worker del kernel NO se
  hizo (sigue diferido): el tallado (5.3 s) y la verificación de 17 cotas (3.7 s) siguen bloqueando el hilo más de 1 s.
- lo hecho, golpe por golpe (cada uno medido con el runner en iangpu dev :5194):
  1. **Telemetría real del ciclo** (`marca()` por paso → `__forgeBrep.telemetria`, barra `progreso-molde` con
     estación · paso · i/n · segundos, tick de 250 ms): la espera de 60 s del molde NO era E3 (18 s) sino E2, que
     teselaba el sólido real SIETE veces (una por copia de la familia ×1/×2/×4). Una teselación + copias trasladadas
     en la malla: **E2 60 s → 2.4 s**.
  2. **E3 progresivo**: la base comprada, la partición y la pieza COLOCADA se pintan ANTES de las booleanas (la pieza
     es la malla de E2 volteada con la misma `volt` de construirAceroE3, sin re-teselar); el hilo respira entre el
     tallado y cada teselado (cavidad → un cuadro → núcleo) y antes del acero espera 350 ms para que el reencuadre de
     la cámara (timer de 30 ms + dos renders del estudio) PINTE la base antes del bloque. **Primera placa: 9.5 s →
     0.36 s** (medición) y **15.6 s → 0.40 s** (paseo, grabando).
  3. **E5 con sub-pasos y el solver FAN cediendo el hilo**: datums · acero de la colada · campo conjunto (70×111×141
     vóxeles, 2.8 s) · FAN (20 790 nodos, 386 pasos) · ocupación sub-vóxel troceada por planos z · pintar. El solver
     es un GENERADOR (`llenadoFANGen`) con `resolverLlenadoFAN` síncrono bit-igual (ciclo-dado-test 248/248 con el
     solver de HEAD y con el nuevo; diff de todas las líneas de checks = 0) y `resolverLlenadoFANAsync` que cede cada
     1 s escribiendo «llenado N % · paso M» en la barra.
- números (corrida final 22:03 UTC, iangpu dev :5194, `## MEDIDO` del camino): **6/8 · paso 6 = 9/11** (rojos: agua y
  expulsores, declarados fuera; paso 3 = 4/6 por escala/tiempo = EL ENFRIAMIENTO SE VE). Medición: p6-1 primera placa
  **0.41 s** (antes 9.45) · progreso 1.3 s · E≥3 0.7 s · placas 3.5 s · colada 45 s · encuadre dx −0.012 dy 0.135 fill
  0.62 luma 0.23 · telemetría E2 2.5 + E3 16.1 + E4 0.7 + E5 64.3 s. Paseo (grabando): p6-1 **0.38 s** (antes 15.6),
  E5 59.0 s, video 211 s, GLITCH 0, **SHOT_TIMEOUT 0** (antes 1 por corrida), p7-4 planos 32.9 s > 30 s (variación bajo
  screencast; en la medición pasó). Sonda por estación (mismo código): E2 2.4 · E3 14.6 (acero 5.3 · cavidad 0.9 ·
  núcleo 1.8 · verificación 3.7 · rayo 1.1 · intersección 1.1 · placas 0.6) · E4 0.6 · E5 63.7 (campo 2.8 · FAN 57.2 ·
  ocupación 2.1). Ciclo E2→E5: **133 s → 81 s**; la promesa de ≤60 s NO se cumple (el FAN solo pesa 57 s).
  **Queda un hueco de ~3 s** (dos cuadros a 0.5 fps) entre la familia de E2 y la base pre-pintada: el salto de cámara
  no alcanza a pintarse antes del tallado ni con 350 ms de aire; el resto del paso 6 ya no tiene viewport vacío
  (antes: 66 s en el video 26, 8 s en la primera corrida de hoy). ciclo-dado-test 248/248 · A/B diff 0 · tsc sin
  errores nuevos · orden-gate VERDE · censo 8→8 / 41→41 / 46→46.
- evidencia: `public/evidencia/2026-09-09-el-paso-6-se-ve-trabajar/` — telemetria.png (21 filas, ms por paso),
  e3-por-pasos.png (la tira del video: familia → base+pieza → cavidad → núcleo → placas), paseo-contactos.png,
  resultados.json; video 28-EL-PASO-6-SE-VE-TRABAJAR-paseo.mp4 en Downloads de ambas PCs y E:\forja-videos.
- HALLAZGOS (se registran, no se tocan aquí):
  · **El FAN pesa 57 s de los 64 s de E5** y es inherente al solver (386 pasos × solve de presión sobre 20 790 nodos
    del campo conjunto colada ∪ pieza a 1 mm). El generador le cuesta ~10 s más que la función plana (E5 54.7 → 64 s):
    V8 no aplica OSR al bucle caliente dentro de una generadora, y aun sacando el cuerpo a `vuelta()` el acceso a
    variables capturadas lo frena. Ticket propuesto: EL FAN EN SU CARRIL (estado del solver como objeto + worker, o
    celda de 1.5 mm en el bebedero) — es el paso que decide si el molde arma en < 60 s.
  · **Ceder el hilo cuesta un cuadro entero** (~90 ms: escena 3D + re-render del estudio por `setProgreso`): a 120 ms
    de cadencia E5 subió a 78 s. La barra vive con cadencia de 1 s + el contador de segundos.
  · `ciclo-dado-test` da **248/248** hoy (el 266/266 del 09-09 era con otro árbol; A/B con el mismo árbol: 248 y 248).
- gotchas pagados:
  · **dev2 es COPIA, no symlink** (`src/` y `public/`; solo `node_modules` es symlink): una corrida entera midió
    código viejo por sincronizar solo el repo de iangpu. Regla: rsync `src/` a `/home/ian/forja-dev2/src/` antes.
  · **El `<=ms` del runner mide HILO LIBRE, no DOM**: `waitForFunction(polling:100)` sondea dentro de la página; con el
    kernel bloqueando, la tira ya visible a 1.5 s se «vio» a 10.8 s. Respirar entre bloques es lo que lo pone verde.
  · `pkill -f` inline por ssh mata al ssh (cuarta vez): TODO kill vive en `.runner/matar-p6.sh`.
  · El paseo que se lanza con código intermedio se mata (`matar-p6.sh`) y no se entrega.
- preguntas abiertas: ¿EL FAN EN SU CARRIL antes de EL ENFRIAMIENTO SE VE? (el molde arma hoy en ~83 s; la promesa
  del ticket era ≤60 s y NO se cumple: queda en rojo aquí, no se maquilla). ¿Worker del kernel para acero (5.3 s) y
  verificación (3.7 s), los dos bloques > 1 s que quedan?
