# ORDEN: UNA SOLA VERDAD — cavidades, ciclo y puntaje idénticos en dictamen, molde, hoja y expediente

ESTADO: proximo
PRIORIDAD: 1

BASE: 5c64cb8

OBJETIVO: crítica del moldista al paseo (2026-09-09): «El producto se contradice en LO PRIMERO que cotizo».
Medido en las capturas del runner: el dictamen dice «71/100 · cold-2placas × 2 cav · CICLO ✗»; la hoja de
análisis de los planos dice «cold-2placas × 1 · DFM 100/100 ✓ · 2 placas (bebedero + canales) ✓»; el título
del molde en E5 dice «SPRUE DIRECTO a la base»; el enfriamiento dice 233 s de ciclo. Tres pantallas, tres
moldes distintos: un cliente lo refuta con su primera pregunta («¿cuántas cavidades?»). Al final de esta
orden hay UN `MoldPackage` por pieza: la misma especificación alimenta al dictamen, al molde 3D, a la hoja y
al expediente; cada puntaje se llama por su nombre; la fila de la máquina trae números, no palomitas; y el
runner lo mide leyendo los tres lugares y exigiendo igualdad.

## LA RAÍZ (rastreada 2026-09-09, solo lectura)
- **Dos `moldMachine` con dos specs.** El dictamen construye su `MachineSpec` desde la MALLA en
  `revisar-modelo.ts:121-130` con `annualVolume = pieza.annualVolume ?? 200_000` (`RevisarPiezaPanel.tsx:100`;
  el studio nunca lo pasa) y la pared del ráster `dfm-mesh` (`revisar-modelo.ts:142-145`). La hoja/planos
  construyen otro desde el SÓLIDO OCC en `estudio-molde-datos.ts:1479-1486` con `annualVolume ?? 100_000` y
  la pared de la lente PARED (`ForgeBRepStudio.tsx:3746-3748`). El interruptor: `moldmachine.ts:215-219`,
  `nMin = ceil(Q · ciclo / (6000·3600))` → con 200 k sale 2 cavidades, con 100 k sale 1.
- **Dos puntajes con el mismo sufijo.** 71 = `contratos.score` (cumple/criterios de los 10 subsistemas,
  `mold-contratos.ts:1194-1204`, pintado en `RevisarPiezaPanel.tsx:158`). 100 = `pkg.dfm.score`
  (`100 − 15·errores − 5·avisos`, `dfm.ts:136`, fila en `ForgeBRepStudio.tsx:3783`). El DFM es la puerta 0
  (`moldmachine.ts:182`), no el juez.
- **Dos decisiones de alimentación sin relación.** La fila «bebedero + canales» lee `pkg.recomendacion.arch`
  (etiqueta ECONÓMICA, `mold-drawing-set.ts:449` ← `mold-plano-set.ts:1617`); el título «SPRUE DIRECTO» lo
  decide `datumsColada` (`colada.ts:116-140`) en `useMoldStudio.ts:1133` con `bocaHaciaElSprue:false` clavado
  (`useMoldStudio.ts:1049`), sin consultar `pkg.diseno.alimentacion` ni `recomendacion.nCav`.
- **Dos «CICLO».** 233 s = `pkg.diseno.enfriamiento.cicloS` = Eq 3.23, 4·pared² (`moldmachine.ts:334,379`).
  El CICLO ✗ del dictamen es `feed-ciclo` (congelamiento del sprue vs pieza, Eq 9.5, `mold-contratos.ts:190-198`):
  otra cosa con el mismo rótulo (`tituloCorto`, `mold-contratos.ts:101-105`).
- **La máquina «✓ ✓» sin números** es de la orden la-inyectora-del-taller (2026-09-08): la fila
  `ForgeBRepStudio.tsx:3781` pinta `pkg.maquina.nombre` + ok; `seleccion.clampUtilPct`, `shotPct`,
  `apertura.holguraMm` y `taller.issues` existen y no se pintan.

## YA-EXISTE (prueba de ausencia)
- `RevisionInput.spec` (`revisar-modelo.ts:114`) ya acepta una spec hecha: el camino para pasarle la del
  studio existe y nadie lo usa. `piezaDesdeArbol` ya deriva la spec del sólido.
- NO existe: una función única `specDeLaPieza(intake)` con los mismos defaults (Q, pared, área proyectada)
  para ambos consumidores; un check del runner que lea cavidades/ciclo/puntaje en los tres lugares.

## TOCA (probable; se confirma al empezar)
- src/forja/mold/revisar-modelo.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/mold-contratos.ts (rótulos «CICLO» distintos; el score se llama «contratos»)
- caminos/la-carcasa-de-mitsubishi.md

## CREA
- public/evidencia/2026-09-09-una-sola-verdad/… (capturas de los tres lugares con el MISMO número + resultados.json)

## BORRA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- Un solo `moldMachine` por pieza soltada (contar llamadas en el paseo: 1). Dictamen, molde, hoja y
  expediente leen el mismo `pkg`.
- RUNNER: check en paso 4 y paso 7 que extrae «× n cav» del dictamen y de la hoja y exige n igual; el ciclo
  del enfriamiento y el «ciclo» de la hoja son el mismo número o se rotulan distinto («ciclo Eq 3.23» vs
  «congelamiento del sprue Eq 9.5»); ningún «/100» sin su nombre («contratos 71/100», «DFM 100/100»).
- Fila de la máquina con números: «FCS HT-150SV (taller) · clamp X t de 150 (Y %) · shot Z % del barril ·
  246 entre 462 · abierto W de 1010» y, cuando no cabe, el porqué (`taller.issues[0]`).
- El título de E5 y la fila de alimentación dicen lo mismo (sprue directo O bebedero + canales), decidido
  por `pkg.diseno.alimentacion`.
- El M6 de la hoja (tornillería §12.4 para 124 kg) se marca «por revisar contra el taller», no se inventa.
- `mold-machinesizing-test`, `mold-machine-test`, `mold-base-test` y `forja-gate` en verde; orden-gate
  VERDE; censo igual; runner ≥ 7/8 sin regresión.

## CIERRE (se llena al terminar)
