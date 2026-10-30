# ORDEN G: LOS DATOS DE TU PLANTA — tarifas en pesos, tus máquinas, tu resina y tu boquilla, capturados una vez y usados por un motor

ESTADO: hoy
PRIORIDAD: 1

BASE: 54ea7ca

OBJETIVO: ian (2026-10-24, al congelar las estaciones nuevas): «me gusta, es la nuestra, descarga y configura todos sus datos». Hoy el
costo cobra `spec.machiningRateUSDh ?? 100` («EE.UU. por defecto», `moldmachine.ts:256`), toda resina que no sea ABS se vuelve PP
(`plastic === 'ABS' ? 'ABS' : 'PP'`, `moldmachine.ts:376`) y la máquina es la del taller. Al terminar, la planta captura UNA vez:
(a) sus tarifas en MXN/h por centro (fresado CNC, electroerosión, banco/ajuste, ingeniería); (b) sus inyectoras (tonelaje, ancho entre
barras, daylight mínimo y máximo, disparo en cc, radio y orificio de la boquilla); (c) su resina con su ficha; y UN solo motor las
usa: el costo de referencia, la selección de máquina (tonelaje, barras, daylight, disparo §4.3.3) y la contracción. Lo que FALTA se
dice («falta: tu tarifa de fresado») y el costo sale rotulado «referencia, Kazmer Apéndice D (USD)» — nunca un número inventado.
Los datos de la planta son suyos: se guardan en su navegador y se descargan/suben como un archivo de la planta; la telemetría deja de
mandar el nombre de la pieza (lo marcó el abogado del debate; orden D lo vio en `/api/telemetry/events`).

## CONTEXTO QUE DEBES LEER
- `/mnt/c/Users/sebas/Downloads/la-pelicula/debate-25-expertos/00-PLAN.md` y el juez B (`jueces/`, mercado-venta-soporte-ley): qué datos
  pide la planta y cómo se cobra la revisión (MXN 7,500 + IVA).
- `/mnt/c/Users/sebas/Downloads/la-forja-ataque/` (orden F): lo que se le promete a la planta.
- La inyectora del taller (FCS HT-150SV) ya está como dato en `src/forja/mold/machinesizing.ts` / `moldbase.ts`: es la primera máquina
  de la lista, no se borra.

## LO QUE SE CAMBIA
1. **La ficha de la planta** en el intake (DOM, `MoldPanels.tsx`; MODO CAMINO: que se vea solo en el paso que le toca): tarifas MXN/h,
   inyectoras, resina, boquilla. Guardar en localStorage (envuelto en try/catch) + botón descargar/subir el archivo de la planta.
2. **El costo**: con tarifa de la planta → MXN con su desglose (horas × tarifa por centro); sin tarifa → el de hoy, rotulado
   «referencia (Kazmer Apéndice D, USD) — falta tu tarifa». El expediente dice cuál de los dos es.
3. **La máquina**: la selección (`machinesizing.ts`) elige entre las inyectoras de la planta; si ninguna cabe, lo dice con el criterio
   que falla (tonelaje, barras con plugs, daylight, disparo), citando §4.3.3.
4. **La resina**: solo resinas con ficha completa del libro (las tablas de propiedades de Kazmer: busca en
   `docs/forja-research/libros/kazmer.md` y el PDF `/mnt/c/Users/sebas/Documents/David O. Kazmer (Auth.) - Injection Mold Design
   Engineering (Carl, Hanser Fachbuchverlag) - libgen.li.pdf`). Una resina sin ficha → se dice «sin ficha: no se calcula», no se
   convierte en PP. Mata el `'PP'` literal de `moldmachine.ts:376` y revisa los demás `?? 'PP'` por defecto (colada.ts, feed.ts,
   feed-layouts.ts, lamina-compuerta.ts): que lean la resina del intake.
5. **La telemetría** (`src/forja/telemetry-forja.ts`, `src/lib/telemetry.ts`): ningún evento lleva el nombre del archivo ni de la pieza.

## YA-EXISTE (prueba de ausencia)
- El intake (`useMoldStudio.ts` ~L612, campos en `MoldPanels.tsx` ~L590-610: pared, material, volumen, p_pack de la orden B).
- `materials.ts`, `ABS_KAZMER` (`cooling.ts`), `machinesizing.ts`, `moldbase.ts`, el costo en `moldmachine.ts` (~L256) y `expediente.ts`.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/mold/moldmachine.ts
- src/forja/mold/machinesizing.ts
- src/forja/mold/expediente.ts
- src/forja/mold/materials.ts
- src/forja/mold/colada.ts
- src/forja/mold/feed.ts
- src/forja/mold/feed-layouts.ts
- src/forja/mold/lamina-compuerta.ts
- src/forja/telemetry-forja.ts
- src/lib/telemetry.ts

## CREA
- (nada — si de verdad necesitas un archivo nuevo para la ficha, ENMIENDA con el porqué; lo normal es que viva en el intake)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (otras órdenes trabajan EN PARALELO)
- moldmachine.ts: G = costo (~L256) y material (~L376). H re-juzga el dictamen (~L380-460): no lo toques.
- useMoldStudio.ts: G = el intake (~L612). H toca el ciclo/re-juicio tras E5/E6.
- MoldPanels.tsx: G = el intake (~L590-610). H toca el panel del dictamen.
- expediente.ts: G = costo/tarifa. H = el bloque del dictamen.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Par de control con la 1594C Box: (1) sin ficha → costo de hoy, rotulado «referencia… falta tu tarifa» (mismo número que hoy);
  (2) con una ficha de prueba (tarifas y máquinas inventadas Y ROTULADAS «de prueba» en el CIERRE, nunca en el código) → costo en MXN
  con su desglose, y la máquina elegida entre las de la ficha; (3) una ficha cuya única inyectora no cierra → la pantalla dice cuál
  criterio falla.
- Una resina sin ficha → «sin ficha», no PP. La 1594C en ABS da los mismos números que hoy (`qa-dorados` en tu copia: los 18 dentro de
  ±5 %; si alguno cambia, explícalo).
- Captura 4K del intake con la ficha y del expediente con el costo en MXN, juzgadas con Read.
- grep del payload de la telemetría (o el evento capturado en la red) sin el nombre de la pieza.
- tsc sin errores nuevos; el cubo 266/266.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
