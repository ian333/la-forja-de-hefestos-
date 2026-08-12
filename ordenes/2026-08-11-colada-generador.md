# ORDEN: EXTRAER LA COLADA a su propio generador — con los DATUMS del libro

BASE: 975673b

OBJETIVO: ian, después de leer el capítulo 6 conmigo: *"mi problema sigue siendo lo
espacial, no es código… te apuesto a que ya debe de haber algo programado por ahí
respecto al sprue que no se usa"*. Ganó la apuesta. Y su lectura del arreglo fue mejor
que la mía: yo propuse **conectar** el ciclo al monolito; él dijo **desconectar** —
*"si no la viste es porque estaba entre un bueno de código, cuando debería estar separada
como todo lo demás"*.

Esta orden EXTRAE la colada a un generador propio, con las mismas cuatro capas que hacen
verificables a las estaciones 1-4, y hace que **los dos** consumidores (el ciclo del dado
y `mold-plano-set`) llamen al MISMO generador. Deja de haber dos coladas en el repo.

## LO QUE SE ENCONTRÓ (y por qué esta orden existe)

`mold-plano-set.ts` **ya construye la colada bien**, con los datums del libro — pero
enterrada en la línea 1112 de 1619, entre el agua y los tornillos:

```
1112:  const Lsprue = topZ - zGate;                     ← §6.3.1: el largo sale del STACK
1113:  const fd = sprueDesignFromCavity(spec.plastic, spec.cavity, Lsprue);
1116:  K.makeCone(oc, fd.rBaseMm - 0.05, fd.rTopMm - 0.05, Lsprue, {origin:[f.x,f.y,zGate]})
1066:  centerX: spec.widthMm / 2, centerY: D / 2        ← el sprue AL CENTRO (Fig 6.4)
1311:  bushing = K.cut(oc, bushing, K.makeCylinder(...)) ← el CANAL como VACÍO (§6.3.2)
 926:  for (const f of feed) tools.push(vCyl(...))      ← y TALADRADO en la placa A
```

Y trae comentarios de bugs YA PAGADOS que la estación 5 volvió a cometer:
> *"El cono NACE en la base cerrada de la pieza, NO en la partición: nacer en zPart lo
> metía POR DENTRO del macho — esa era la colisión inserto-core↔colada (45.8 mm³)"*

La E5 lo nació en la partición. Mismo error, con su autopsia dos archivos más allá.

## EL PATRÓN QUE SE SIGUE (el de E1-E4, que sí funciona)

```
1 · DATOS PUROS      datumsColada(...)        sin OCC, node-testeable
2 · FORMA            construirColada(oc, d)   recibe oc → devuelve sólidos
3 · VERIFICACIÓN     verificacionColada(...)  mide el B-Rep: declarado ≈ medido
4 · CONTROL NEG.     coladaMalaShape(oc, d)   una colada que DEBE reprobar
        ↓
    el handler de React sólo ORQUESTA — cero matemática de geometría
```

La E5 respetó la capa 1 y se saltó la 2, la 3 y la 4: metí `makeCone`/`makeCylinder`/
`makeBox`/`fuseAll` y las mediciones de bbox DENTRO del handler de React. Por eso su
gate no pudo medir el sólido como lo hace la E3, y por eso nadie la encontraría ahí.

## YA-EXISTE (prueba de ausencia)
- `feed.ts::designSprueFeed` / `sprueDesignFromCavity` — los RADIOS (§6.3.1, Eq 6.8).
- `mold-plano-set.ts::plateStackZ` — **el stack real**: bottom · ejector · ejector-ret ·
  support · B · A · clamp. De ahí sale `L_sprue`, que es el datum que yo inventé como 60.
- `mold-plano-set.ts` líneas 1095-1120 y 1300-1316 — la colada, el bushing y el anillo
  centrador YA construidos con esos datums. **Es lo que se extrae, no se reescribe.**
- `feed-layouts.ts` — redes multi-cavidad (ya importado en `useMoldStudio.ts:36`).
- `gating.ts::gateDesign` — la compuerta.
- `estudio-molde-datos.ts::estacion5Dado` — los NÚMEROS de la estación (capa 1), se queda
  pero deja de inventar cotas: recibe los datums.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs

## CREA
- src/forja/mold/colada.ts

> AUTORIZADO EXPLÍCITAMENTE por ian ("dale, extráela así"). Archivo chico y de un solo
> tema, del tamaño de `feed.ts` (303 líneas), NO otro monolito.

## BORRA
- (nada)

> La geometría de la E5 se borra de `useMoldStudio.ts`, que está en TOCA.

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)

Todo se MIDE del sólido construido (la lección de la E3), y los datums se COMPARAN contra
el stack, no contra mis constantes.

- **`L_sprue` MEDIDO del sólido = `zCaraClamp − zGate` del stack real** (§6.3.1: *"the
  length of the sprue is determined by the combined thicknesses of the top clamp plate and
  the A plate"*). El 60 mm inventado desaparece.
- **el eje del bebedero = el CENTRO del molde** (Fig 6.4: bushing + anillo centrador),
  medido del bbox. Hoy está en `lado + rBase + 6`, que no es cota de nadie.
- **el bebedero NACE en la base cerrada de la pieza, no en la partición** — el bug de los
  45.8 mm³ ya documentado. Se verifica con `interseccionMitades`-style: colada ∩ macho = ∅.
- **A-129 · monotonía de ⌀ aguas abajo**: `⌀sprue_base > ⌀runner > ⌀gate`, medido. El
  pliego lo tiene como 🟥 FALTA; esta orden lo cierra.
- **el SPRUE PULLER con conicidad INVERTIDA existe y su undercut es medible** (§6.3.1:
  *"a reverse taper is usually provided below the sprue"*). Hoy no existe: es lo que
  ian pudo estar viendo como "invertido" — faltaba, no estaba al revés.
- **SI EL STACK NO TIENE TOP CLAMP PLATE, el generador lo DECLARA** y no inventa el largo.
  ian: *"el sprue necesita de más placas"*. Si faltan, se dice.
- **EL EJEMPLO RESUELTO DEL CAPÍTULO** (p.146-148, molde familia vaso+tapa) reproducido
  como gate: `R_sprue = 2.7 mm`, `R_runner_vaso = 1.5 mm`, `R_runner_tapa = 1.25 mm`,
  `regrind = 3.5 %`. Y p.149: `t_c sprue 26.7 s` vs `t_c vaso 18.9 s`. Ésta es la prueba
  de que el generador sabe del libro, no de mí.
- **CONTROL NEGATIVO**: la colada de ayer (⌀9.5 recta, fuera de eje, sin runner) debe
  REPROBAR la verificación. Si el test no distingue lo roto, no es evidencia.
- **UNA SOLA COLADA EN EL REPO**: después de esto, `grep -c "makeCone.*sprue\|Lsprue"`
  debe apuntar a un solo generador; `mold-plano-set` lo LLAMA en vez de construirla.
- `node scripts/ciclo-dado-test.cjs` con los criterios nuevos · `node scripts/orden-gate.cjs`
  VERDE (sin pipe) · censo IGUAL (0 `<Canvas>` nuevos).
- Captura del CAD revisada con OJOS **antes** del 4K, y video juzgado después.
- Entrega a `Downloads\FORJA-DADO` de AMBAS PCs + `/mnt/e/forja-videos`.

## CIERRE (2026-08-11) — PARCIAL, y el gate queda ROJO A PROPÓSITO

- **entregado**: `src/forja/mold/colada.ts` (283 líneas, un solo tema) con las cuatro
  capas: `datumsColada` (pura) · `construirColada(K, oc, d)` · `verificacionColada` ·
  `coladaMala` (control negativo). Gate: **71 pasan · 1 falla**.
- **NO entregado, y se declara**: el cableado al ciclo y a `mold-plano-set`. No se hizo
  porque sería construir sobre marcos que no coinciden — ver abajo. Cablearlo hoy habría
  dado otra geometría verde sobre un cimiento falso, que es exactamente el error que esta
  sesión lleva cazando.

- **CADA COTA TRAE SU PROCEDENCIA.** El módulo expone `fuente`, y ahí se ve qué es del
  libro y qué es extensión mía:
  - `L_sprue` → §6.3.1 literal, del STACK (`zCaraClamp − zGate`). El 60 inventado murió.
  - `eje` → Fig 6.4, el centro del molde (bushing + anillo centrador). El `lado+rBase+6` murió.
  - `zGate` → la base CERRADA de la pieza, no la partición — el bug de 45.8 mm³ que
    `mold-plano-set` ya había pagado y que la E5 volvió a cometer.
  - `L_runner` → §6.3.1, "determined by the position of the cavities".
  - `holguraAceroMm` y `gateLargoMm` → **EXTENSIÓN DECLARADA**, dicho en el código.

- **EL HALLAZGO QUE ORDENA TODO LO DEMÁS — dos marcos de coordenadas que nunca se
  encuentran.** Medido:

  | | marco de la PIEZA (E3) | marco del MOLDE (stack) |
  |---|---|---|
  | centro XY | (20, 20) | (98, 98) |
  | partición Z | 39.5 | 146 |
  | cara del clamp | — | 248 |

  Desfase **(+78, +78, +106.5)**. Los insertos del ciclo NUNCA han estado dentro de la
  base del molde. Por eso el bebedero no tenía dónde caer, por eso `L_sprue` sale 248 mm
  (el molde entero en vez de top clamp + placa A = 102) y por eso el runner sale
  degenerado. ian lo venía diciendo con otras palabras desde el principio: *"mi problema
  sigue siendo lo espacial, no es código"*. La colada no lo causó: lo hizo visible.

- **EL GATE QUEDA EN ROJO, y es la entrega correcta.** El check
  `la PIEZA y el MOLDE comparten marco de coordenadas` FALLA con sus números. Ponerlo como
  nota al pie y dejar el gate verde habría sido la misma mentira que este proyecto tiene
  documentada en CLAUDE.md: *"un gate escrito por el mismo que comete el error mide
  coherencia interna, no derecho a existir"*. Prefiero 71/1 honesto que 72/0 cómodo.

- **RETORNO anunciado**: el arreglo es de la **estación 3** (el layout), no de la 5.
  O los insertos de la E3 se colocan en el marco del molde, o la base se construye en el
  marco de la pieza. Es una decisión de ian, y es exactamente el "grafo con retornos"
  (§1.5, Fig 1.9) que el ciclo modela.

- **pendientes que esta orden NO cerró** (declarados, no escondidos): el cableado al ciclo
  y al monolito; el ejemplo resuelto vaso+tapa del capítulo (p.146-148) como gate; el
  sprue puller sólo se construye cuando hay runner; y `mold-plano-set` sigue con su propia
  colada — todavía hay dos en el repo.
