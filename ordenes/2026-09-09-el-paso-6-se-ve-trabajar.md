# ORDEN: EL PASO 6 SE VE TRABAJAR — el molde se va armando, estación por estación, sin congelar la pantalla

ESTADO: proximo
PRIORIDAD: 3

BASE: 5c64cb8

OBJETIVO: ian (2026-09-09): «sí prefiero que el molde se vaya armando». Medido el 2026-09-08 en iangpu:
al tocar MOLDE la pantalla se CONGELA 90 s (E3 talla el acero en el hilo principal: ni el arnés pudo
capturar), luego 48 s de viewport casi negro (E4), y el molde armado aparece de golpe a los 176 s del
paseo, el 73 % del video. Un cliente a los 20 s cree que se murió; a los 40 recarga y paga otros 36 s de
carga. Al final de esta orden el molde EMERGE sobre la pieza estación por estación, cada estación con su
rótulo («¿cuántas cavidades?», «SPRUE DIRECTO»…) en ≤4 s de pantalla, la pieza jamás sale del cuadro, el
hilo principal nunca se bloquea más de 1 s, y la primera placa aparece en ≤10 s. Presupuesto del paso
entero: ≤60 s con progreso visible por estación.

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

## TOCA (probable; se confirma al empezar)
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/mold-plano-set.ts (o el módulo donde viven las booleanas del tallado)
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- (a decidir al empezar: un worker del kernel es archivo nuevo → se declara aquí ANTES, no se improvisa)
- public/evidencia/2026-09-09-el-paso-6-se-ve-trabajar/… (capturas por estación + resultados.json)

## BORRA
- (nada)

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
