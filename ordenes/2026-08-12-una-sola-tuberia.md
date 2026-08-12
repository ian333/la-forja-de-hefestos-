# ORDEN: UNA SOLA TUBERÍA — colada y cavidad son UN dominio, y la conectividad es una ALARMA

BASE: 819985a

OBJETIVO: ian, viendo el video del retorno, cazó DOS cosas y la raíz de ambas:

1. *"el plástico aparece mágicamente en el molde, pero el sprue solo lo veo parpadear —
   están separados"* — la pieza se llena con `llenadoT` (determinista) y el sprue lo
   anima `FeedFill` con el reloj de pared EN BUCLE. Dos relojes.
2. *"se llena de un lado y el sprue está del otro — no están conectadas las cavidades.
   El cálculo del llenado está mal porque el llenado lleva al sprue. Y que no haya
   levantado una ALARMA — son 2 tuberías desconectadas en lugar de 1 — quiere decir que
   está mal todo."*

La segunda es la raíz. El campo de llenado voxeliza SOLO la pieza, sembrado además en el
labio VIEJO (x=39, el opuesto a la compuerta real tras el retorno). La colada es un
sólido decorativo aparte. **Dos subsistemas, cada uno verde en su gate, juntos un
sinsentido — y ningún check midió jamás que estuvieran CONECTADOS.** El plan previo de
"repartir el reloj por volumen" (orden retirada sin committear) seguía siendo dos
tuberías sincronizadas; se tira.

## EL ARREGLO: UN DOMINIO

```
   HOY (2 tuberías)                    LA ORDEN (1 tubería)
   ──────────────────                  ─────────────────────
   campo = solo la PIEZA               campo = COLADA ∪ PIEZA, voxelizadas JUNTAS
   semilla en un labio viejo           semilla en la BOQUILLA (arriba del bebedero)
   colada = sólido decorativo          el frente BAJA por el bebedero, cruza el
   FeedFill con reloj propio             runner, entra por la compuerta y llena la
   sin check de conexión                 pieza — UN campo, UN reloj, UNA superficie
                                       ALARMA: `unreachable > 0` = tubería rota
```

- `measureFlowLength` YA calcula `unreachable` (vóxeles aislados de la semilla). Con el
  dominio conjunto y la semilla en la boquilla, **`unreachable = 0` ES el teorema de la
  tubería única** — y `> 0` la alarma que faltaba, con control negativo que la dispara.
- El reloj único sale GRATIS: los cuantiles de volumen sobre el campo conjunto hacen que
  la colada (≈5 cc) ocupe su fracción del tiempo ANTES de que la pieza arranque — física
  del caudal constante sin ningún reparto a mano.
- `FrenteSuperficie` sobre el campo conjunto dibuja el fundido BAJANDO por el bebedero
  como superficie. `FeedFill` sale de la E5 (con él muere el parpadeo); la colada
  estática queda FANTASMA (el tubo se ve, el fundido avanza adentro).
- **Reparto de estaciones (el libro lo dicta)**: la E4 se queda SOLO-CAVIDAD — §5.5.2
  declara que su presión excluye el feed — pero su semilla se corrige al labio CERCANO
  (la compuerta real). La E5 es la tubería completa.

## YA-EXISTE
- `flowlen.ts::measureFlowLength` — voxeliza cualquier predicado, y `unreachable` ya
  viene calculado. NO se toca la física.
- `colada.ts::DatumsColada` — todas las cotas para el predicado `dentroColada`.
- `FrenteSuperficie` + `llenadoT`/`llenadoStats`/cuantiles — la tubería del video; el
  campo conjunto entra por la MISMA ranura (`frenteGrid`/`grid`) sin tocarla.
- `interseccionMitades`, el juez de video, el orden-gate.

## TOCA
- src/forja/mold/colada.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts

> ENMIENDA (a media obra, cachada por el orden-gate): el predicado del dado vivía INLINE
> en la E4 — usarlo también en el campo conjunto de la E5 habría creado la segunda copia
> (los dos marcos otra vez, ahora de predicados). Se extrajo como
> `estudio-molde-datos.ts::dentroDadoLocal` (fuente única), y ese archivo faltaba en TOCA.
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs
- scripts/llenado-video.cjs

## CREA
- (nada)

## BORRA
- (nada)

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
- **LA ALARMA EXISTE Y DISPARA**: campo conjunto sembrado en la boquilla →
  `unreachable = 0` (tubería única). CONTROL NEGATIVO: la colada DESPLAZADA (o la
  semilla vieja) → `unreachable` masivo y la alarma en ROJO en el panel. Si el control
  no dispara, la alarma no es evidencia.
- **el volumen de colada por vóxeles ≈ `volumenColadaCc` (puro) ≈ `OCC.volume`** — tres
  fuentes del mismo número, cruzadas en el gate con tolerancia declarada.
- **EL ORDEN FÍSICO, medido**: los vóxeles de la PIEZA solo se llenan después de ≥75 %
  de la colada (el frente del campo conjunto lo da solo; el gate lo verifica).
- **JUEZ DE VIDEO nuevo**: el primer frame con vóxeles de pieza llenos exige colada
  ≥ 95 % llena. Si el plástico "nace" en la pieza, REPRUEBA.
- el sprue NO parpadea (FeedFill fuera de la E5) y el fundido se ve BAJAR por el
  bebedero — frames del MP4 revisados con ojos.
- los 7 criterios del juez siguen pasando; % total monótono 0 → 100.
- `node scripts/ciclo-dado-test.cjs` 0 fallan · `node scripts/orden-gate.cjs` VERDE.
- Video 4K juzgado y entregado a AMBAS PCs + `/mnt/e/forja-videos`.

## CIERRE (2026-08-12)

- **gate 82 pasan · 0 fallan** · orden-gate VERDE · **VIDEO 4K APROBADO 8/8** (el juez
  ganó su octavo criterio y lo pasó): `dado-tuberia-unica-4k.mp4`, entregado a AMBAS PCs.

- **LA TUBERÍA ES UNA**: colada ∪ pieza voxelizadas juntas (19,362 vóxeles), sembradas
  en la BOQUILLA. El frente BAJA por el bebedero, cruza runner y compuerta y entra a la
  pieza — revisado con ojos en frames del MP4: primer tercio = el fundido descendiendo
  por el tubo; a media película el bebedero lleno y la pieza llenándose DESDE el lado de
  la compuerta (ya no desde la esquina opuesta). El parpadeo murió con `FeedFill` fuera
  de la E5 (su reloj de pared en bucle era el parpadeo).

- **EL RELOJ ÚNICO SALIÓ GRATIS**, como se predijo: los cuantiles de volumen del campo
  conjunto reparten el tiempo solos — el juez midió *"primer frame con pieza mojada:
  colada al 100.0 %"* sin que ningún código reparta nada a mano.

- **LA ALARMA QUE FALTABA existe y tiene DOS condiciones** — y la segunda la cazó su
  propio control negativo en la primera corrida: `measureFlowLength` TELEPORTA la
  semilla al vóxel de cavidad más cercano cuando el punto pedido no cae en el dominio
  (flowlen.ts:131, ayudador legítimo para compuertas de frontera). Con la tubería ROTA
  eso dejaba `unreachable = 0` y la alarma muerta — **otro ayudador silencioso
  comiéndose una alarma**, la familia exacta que ian señaló. La alarma honesta:
  `unreachable = 0` **Y** `desvío de semilla ≤ 2 mm`. El control del dominio de AYER
  (solo pieza) dispara por teleporte: **101 mm** de boquilla a pieza.

- **TRES FUENTES DEL MISMO NÚMERO cruzadas**: V_colada por vóxeles 5.19 · analítico
  (`volumenColadaCc`, puro) 5.30 · OCC 5.15 cc — tolerancias declaradas (traslapes de
  la unión).

- **ORDEN FÍSICO medido**: min(frente | pieza) = 0.231 ≥ p75(frente | colada) = 0.200.

- **fuente única nueva**: `dentroDadoLocal` extraído de la E4 (vivía inline) para que el
  campo conjunto no naciera con una segunda copia del predicado — cachado por el
  orden-gate como archivo sin declarar, enmendado en TOCA.

- **la E4 queda SOLO-CAVIDAD a propósito** (§5.5.2 excluye el feed de su presión), con
  su semilla corregida al labio CERCANO — el "aparece mágicamente" tenía también esa
  mitad: el frente nacía en la esquina opuesta a la compuerta real.

- **pendiente que sigue vivo**: regrind 36.7 % (E3 placas / E2 colada caliente) y la
  colada mandando el ciclo — anunciados, sin maquillar.
