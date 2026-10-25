# EL QA REAL — cómo lo usa otra sesión (orden 2026-10-24-d-el-qa-real)

Todo corre **en el navegador** (la app real, un build de producción) en **iangpu**, nunca en node (juez C, D4: node tesela y
orienta distinto). Lo único en node es la fábrica de piezas rotas.

## Antes de tu commit (≈ 6 min): la huella ×3 + los números dorados

```bash
# en iangpu, desde TU copia, contra TU build de producción (vite build --outDir /home/ian/el-plan/dist-devN + vite preview --port 42N0)
cd /home/ian/forja-devN
flock /home/ian/el-plan/gpu.lock env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
  NODE_PATH=/home/ian/Orkesta/la-forja/node_modules URL=http://localhost:42N0/forja-brep.html \
  node scripts/qa-huella.cjs --out /home/ian/el-plan-devN/qa/huella          # HUELLA_GATE: VERDE|ROJO · exit 0/1 (2 = no vale)
node scripts/qa-dorados.cjs --medido /home/ian/el-plan-devN/qa/huella        # DORADOS_GATE: VERDE|ROJO · exit 0/1
```
o todo junto con acta: `env … URL=… node scripts/qa-banco.cjs --lista box --out /home/ian/el-plan-devN/qa/box` (sin `flock`: el
banco toma el turno del GPU él solo, pieza por pieza; envolverlo en `flock` lo bloquea para siempre).

| comando | qué hace | cuánto (medido 2026-10-24, build de producción :4270, RTX 4070 Ti compartida) |
|---|---|---|
| `qa-huella.cjs` | la 1594C Box ×3, cada vez en un navegador fresco, camino completo hasta el portamoldes; firma pieza + cada cuerpo del molde (caja, triángulos, volumen con signo) + leyenda + Foco + dorados | 372 s las 3 (≈ 2 min c/u: molde 84–110 s) |
| `qa-huella.cjs --control` | + una corrida con la falla conocida (reloj congelado antes de MOLDE): su huella DEBE salir distinta | + ≈ 100 s |
| `qa-dorados.cjs --medido <dir>` | compara los números de esa corrida contra `scripts/qa-dorados/1594C-Box.json` (±5 %) | < 1 s |
| `qa-dorados.cjs --medido <dir> --control` | par de control del gate: el JSON tal cual → VERDE; una copia con un número +10 % → ROJO nombrándolo | < 1 s |
| `qa-banco.cjs --lista box` | huella ×3 + dorados + acta HTML, en UN turno del GPU | ≈ 6–7 min de GPU |
| `qa-banco.cjs --lista rotos` | + el control de la huella (mismo turno) + los 5 STL rotos (un turno, 135 s) + la tapa (un turno) | ≈ 13 min de GPU en 3 turnos |
| `qa-banco.cjs --lista noche` | + 3 Hammond (1598B Bottom, 1599HBK, 1591XXCBK), un turno cada una — **de noche, lo lanza el coordinador** | ≈ 25 min de GPU |
| `node --import tsx scripts/qa-fabrica-rotos.cjs` | fabrica los fixtures (OCCT en node, sin GPU), determinista byte a byte | ≈ 30 s |

**Ojo con la cola del GPU**: el banco espera su turno en `gpu.lock` como todos. El 2026-10-24 por la tarde cada turno esperó
15–40 min (cuatro órdenes + un lote de LLM que retuvo el candado ~40 min). Por eso la Box ×3 + su control van en UN turno
(es una pieza) y los STL rotos en otro: pedir un turno por corrida multiplicaba la espera ×4.

El cron de la noche (una línea; el coordinador la pone en el crontab de iangpu y sirve un build de main en :4199):
```cron
30 2 * * * cd /home/ian/Orkesta/la-forja && env DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA NODE_PATH=/home/ian/Orkesta/la-forja/node_modules URL=http://localhost:4199/forja-brep.html node scripts/qa-banco.cjs --lista noche >> /home/ian/el-plan/qa/noche.log 2>&1
```
El acta queda en `/home/ian/el-plan/qa/<fecha>/acta.html` (+ `acta.png` para juzgarla con Read, `acta.json`, `stills/`, `corridas/`).

## Qué significa cada color
- **HUELLA VERDE**: los 3 hashes iguales → el mismo commit arma el mismo acero. **ROJO**: el diff dice qué cuerpo (`rol|nombre`) o
  qué llave cambió entre corridas — eso es un bug de determinismo (carrera de temporizadores, orden de promesas) y va PRIMERO.
  **NO VALE** (exit 2): GPU equivocada (SwiftShader/llvmpipe) o «Error creating WebGL context» → repite, no juzgues.
- **DORADOS ROJO**: un número del motor se movió más de 5 % (o desapareció su fuente): el gate dice cuál y de cuánto a cuánto.
  Si tu orden lo movió A PROPÓSITO (p. ej. la orden B: clamp 2.3 % → ~24 %), re-graba con la razón (abajo). Si no, es una regresión.
- **ACTA · CONFIABLE / NO CONFIABLE**: cada pieza rota tiene su oráculo (qué debe decir la puerta). Si la app deja pasar UNA
  pieza rota («la app: VERDE»), la corrida entera es NO CONFIABLE: esa noche la puerta aprueba basura y ningún verde certifica
  nada. Hoy (antes de la orden C) sale NO CONFIABLE: es lo correcto. El 00 (la Box sana como STL) es el control: si la puerta lo
  rechaza, también es NO CONFIABLE (una puerta que dice «no» a todo cumpliría los oráculos sola).

## Re-grabar los dorados (solo con razón)
```bash
COMMIT=<sha corto> node scripts/qa-dorados.cjs --medido <carpeta de qa-huella> --regrabar "orden B: p_pack 50 MPa → clamp 24 %, placa y pilares nuevos"
```
La razón, la fecha, el commit, la huella y qué cambió quedan en `historia` del JSON. Sin `--regrabar "razón"` no se graba nada.

## Agregar una pieza rota
Un `NN-slug.<stl|stp>` + `NN-slug.oraculo.json` en `test-parts/rotos/` (mejor: agrégala a `qa-fabrica-rotos.cjs` para que se
fabrique y se mida sola). El oráculo: `esperado` (`rechaza` | `pregunta` | `sin-molde` | `pasa`), `debe` (en palabras de taller),
`dice` (regex que DEBE verse en pantalla tras soltar; texto VISIBLE: opacidad 0 no cuenta), `noDice` (para los sanos), `sinMolde` /
`sinPrecio` (para los STEP), `cita`. Si la orden C cambia sus palabras, se AMPLÍA el regex con su razón; nunca se afloja para que
pase un fixture.

## Gotchas
- En las copias `forja-devN`, `test-parts` y `public/*` son **symlinks al repo principal**: no escribas ahí (`--out`/`--rotos` a tu carpeta).
- Los números dorados se leen del MOTOR (`window.__qaForja`, una línea en `ForgeBRepStudio.tsx`), no del texto de la hoja.
- Los tiempos se anotan en el acta pero no se juzgan: en GPU compartida los relojes son clima.
- **ACTUALIZADO 2026-10-24 (e69f8a6, LA CARRERA DEL ARRANQUE arreglada):** el control se partió en dos. «pared 2.8» (la misma pieza con
  otra pared declarada vía `__qaForja.setIntake`) DEBE dar otra huella (PAR_DE_CONTROL: MUERDE); «reloj congelado» (la falla vieja)
  DEBE dar la MISMA huella que la sana (REGRESION_CARRERA: VERDE). Si la del reloj congelado cambia, la carrera regresó.
- (historia) El control de la huella reproducía una carrera que SEGUÍA en la app (el temporizador de la E2 nace con la pieza maciza y la
  re-siembra de la pared lo cancela un commit después; con el reloj congelado antes de MOLDE gana la carrera: molde de otra pieza,
  0 pines, «manda la pieza 2350 s», F 40 kN — medido 2026-10-24, huella a7c2b9c0…, igual las dos veces). Con los 40 ms reales que
  hoy deja la filmadora NO se reproduce (misma huella que la sana). Si algún día se arregla esa carrera en la app, este control deja
  de morder y el banco sale ROJO por eso: celébralo y cámbialo por otra falla conocida, no lo borres.
- Los rotos se sueltan con un nombre NEUTRO (`pieza.stl`): la app escribe el nombre del archivo en pantalla y la primera corrida
  «cumplía» /abiert/ con el nombre `01-abierta`, no con la puerta (medido 2026-10-24). Un oráculo nunca debe poder cumplirse con
  algo que el banco mismo puso en la pantalla.
