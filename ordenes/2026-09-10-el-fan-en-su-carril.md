# ORDEN: EL FAN EN SU CARRIL — el llenado deja de bloquear el hilo y el molde arma en < 60 s

ESTADO: proximo
PRIORIDAD: 7

BASE: 22674c9

OBJETIVO: hallazgo de EL PASO 6 SE VE TRABAJAR (2026-09-10, medido con telemetría por paso en iangpu): el solver
FAN/Hele-Shaw de la E5 (colada ∪ pieza, 70×111×141 vóxeles a 1 mm, 20 790 nodos, 386 pasos) pesa **57 s de los 64 s
de E5** y **el ciclo E2→E5 queda en 81 s** (venía de 133 s); la promesa de ≤60 s del paso 6 NO se cumplió por él.
Hoy el solver corre como GENERADOR que cede el hilo cada 1 s (la barra vive), pero eso le cuesta ~10 s más que la
función plana (V8 no aplica OSR al bucle caliente dentro de una generadora; sacar el cuerpo a `vuelta()` recupera
solo una parte). Al final de esta orden el llenado corre en su propio carril (Web Worker con el campo serializado —
es JavaScript puro, no necesita OCC), el hilo principal no se bloquea nunca por él, la barra sigue diciendo «llenado
N % · paso M», el resultado es bit-igual (ciclo-dado-test y A/B con diff 0) y el ciclo E2→E5 baja de 60 s.

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/fan.ts`: `llenadoFANGen` (generador) + `resolverLlenadoFAN` (síncrono, bit-igual) +
  `resolverLlenadoFANAsync(campo, o, cada, cadaMs)`; `ProgresoFAN {outer, pasos, volPct}`.
- `useMoldStudio.ts` E5: sub-pasos con `marca()` y `setProgreso` (datums · colada acero · campo conjunto · FAN ·
  ocupación por planos z · pintar); `respira()` / `respiraCuadro(ms)`.
- NO existe: worker alguno en La Forja; serialización de `CampoFAN` (typed arrays → transferables); medición del
  costo del generador vs función plana en node (solo se midió en el navegador: 54.7 → 64 s).

## LO QUE DESTAPÓ «EL AGUA DE TU PIEZA» (2026-09-17, medido)
- La rejilla de la E5 arranca en `z0 = col.tz − (alturaMm + 1) − 2`, que supone que la pieza cuelga HACIA
  ABAJO de `tz` (cierto para el cubo, cuyo marco local va 0..40). La carcasa vive en local −33.31..0.03, o
  sea ARRIBA de `tz`: la rejilla empieza en **123.19** cuando la pieza empieza en **159.50** ⇒ **36.3 mm de
  planos z VACÍOS, el 26 % del rango** (de los 141 planos, 36 no tienen un solo vóxel de cavidad). El bucle
  de ocupación los recorre igual (70×111×36 ≈ 280 k celdas de puro aire). Recortar la caja al extremo REAL
  de la pieza (`min/max` de `zBocaMm` y `zBaseCerradaMm`, que desde hoy dice la verdad) es ~26 % menos
  rejilla en la E5 — pero MUEVE el origen del cubo 0.5 mm (142.5 → 143) y con él su voxelización, así que
  va aquí y no de contrabando: hay que re-medir y re-firmar el ciclo del dado.

## EJERCICIOS
- [ ] medir en node el FAN plano vs generador vs `vuelta()` sobre el campo real de la carcasa (guardar el campo en
      `public/evidencia/…/campo-1594C.json`): saber cuánto es V8 y cuánto es el solver.
- [ ] worker: `fan.worker.ts` recibe el campo (transferables) y devuelve `LlenadoFAN` + progreso por mensaje; E5 lo
      espera con la barra viva; el hilo principal libre → `SHOT_TIMEOUT` 0 y `p6-5 colada` ≤ 30 s en el paseo.
- [ ] si con worker sigue > 45 s: celda 1.5 mm SOLO en el tramo del bebedero (la pieza sigue a 1 mm) — declarado
      y medido contra el resultado a 1 mm (presión, tiempo de llenado, short-shot iguales ±5 %).
- [ ] RUNNER paso 6: `testid:molde-de-la-pieza@150000<=10000` sigue verde; nuevo check «ciclo E2→E5 ≤ 60 s» desde
      la telemetría; `orden-gate` VERDE; ciclo-dado-test 248/248 y A/B diff 0.

## TOCA
- src/forja/mold/fan.ts
- src/forja/brep/useMoldStudio.ts
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- src/forja/mold/fan.worker.ts (no es Canvas: censo igual)
- public/evidencia/2026-09-10-el-fan-en-su-carril/resultados.json
- public/evidencia/2026-09-10-el-fan-en-su-carril/telemetria.png
- public/evidencia/2026-09-10-el-fan-en-su-carril/paseo-contactos.png

## BORRA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- telemetría: E5 total y FAN antes/después; ciclo E2→E5 < 60 s en la medición del runner.
- paseo sin `SHOT_TIMEOUT`, p6-5 (colada) en verde con margen; GLITCH 0.
- bit-igual: ciclo-dado-test 248/248 con el worker y sin él; A/B de checks diff 0.

## CIERRE (se llena al terminar)
