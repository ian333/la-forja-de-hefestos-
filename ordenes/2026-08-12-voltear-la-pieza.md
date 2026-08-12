# ORDEN: VOLTEAR LA PIEZA — el layout de la Fig 7.2: boca a B, sprue directo al centro

BASE: f7c0df9

OBJETIVO: ian: *"VOLTEA LA PIEZA POR FAVOR :D, me pasas el video"*. Es la decisión que la
alarma de balance dejó pendiente, y es el layout canónico del libro para una cavidad de
caja abierta (§7.2.1 + Fig 7.2, que es literalmente nuestra pieza dibujada boca abajo):

```
   HOY (desplazada, mi parche)          VOLTEADA (Fig 7.2)
   ────────────────────────────         ────────────────────
        ║ bebedero                           ║ bebedero (L ≈ 62)
   ═════╬══════╤═════ partición 146     ═════╧═════════════
        └runner┤                            ┌───────┐ ← base CERRADA arriba (z 185.5)
       ┌───────┐  boca ARRIBA               │ pieza │   el sprue cae DIRECTO al centro
       │ pieza │  (hacia A)                 └──╥────┘ ← boca ABAJO (hacia B), en 146
       └───────┘  desbalance 29.2       ═════════════════ partición 146
                                            macho SUBE desde B
```

El mapa del volteo (rotación 180° sobre X + colocación, TODO desde `colocacionEnLaBase`):
`global = (x_local + 78, 118 − y_local, 185.5 − z_local)` — la boca (z_local 39.5) cae en
la partición (146), la base cerrada (z_local 0) queda ARRIBA (185.5), y la pieza queda
CENTRADA (78..118 × 78..118): la alarma de balance debe ponerse VERDE SOLA.

## LO QUE CAMBIA (por estación)
- **E3**: el molde entero rota con la pieza — la CAVIDAD queda en A (arriba), el MACHO
  sube desde B con su respaldo Hk abajo. `verificacionE3` re-ancla sus cotas a la
  orientación nueva (cara INFERIOR de la cavidad en la partición, respaldo bajo ella,
  piso arriba) y el draft por rebanadas se vuelve agnóstico de orientación (mide los DOS
  extremos). Las cotas 3D viajan por el mapa del volteo.
- **E4**: el predicado local no cambia (`dentroDadoLocal` intacto); cambia el MAPA
  local↔global y la semilla, que ahora es el SPRUE GATE en el centro de la base
  (98, 98, ~184.5).
- **E5**: `datumsColada` gana la semántica correcta del flag (la boca ya no mira al
  sprue): **modo `sprue-directo`** — bebedero SOLO, cayendo del clamp a la base
  (L = 248 − 185.5 = 62.5), sin runner/compuerta/pozo/puller. `estacion5Dado` bifurca
  sus filas por modo (§7.2.1: el sprue gate no tiene longitud ni ΔP propio; el freeze
  que manda el empaque es el del propio bebedero). El campo CONJUNTO se re-siembra en
  la boquilla y el dominio se ENCOGE (ya no hay tramos finos de 1 mm — el artefacto
  visual del sprue que ian señaló pierde su causa).

## LO QUE DEBE PASAR SOLO (sin tocar los checks)
- alarma de BALANCE: 29.2 mm → **0** → VERDE (el gate vuelve a 0 fallas).
- `colada ∩ macho = ∅` se mantiene (el sprue vive completo en el lado A).
- regrind: 36.7 % → **≈15 % CUMPLE §6.2.3** (el bebedero corto).
- tubería única: 0 inalcanzables + semilla en boquilla.
- las 17 cotas E3 y la prueba del rayo siguen pasando (re-ancladas, mismos valores).

## YA-EXISTE
- `transformShape` (rotación+traslación exacta) · `splitMold` (convención local intacta:
  se parte en local y se ROTA el conjunto) · `colocacionEnLaBase` (fuente única del mapa)
  · `dentroColada`/`volumenColadaCc`/`construirColada` (el cono solo, con LrunnerMm=0,
  ya construye únicamente el bebedero) · la alarma de balance y la de tubería.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/colada.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs

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
- MEDIDO del sólido: pieza centrada (98, 98) · boca en z=146 · base cerrada en 185.5 ·
  cavidad ARRIBA de la partición (Hc=60) · respaldo del macho ABAJO (Hk=16).
- alarma de BALANCE VERDE SOLA (sin tocar el check) · desbalance 0.0 mm.
- `modo = 'sprue-directo'` · L_sprue MEDIDO = 62.5 = cara clamp − base · colada ∩ macho
  = 0 · regrind con el número nuevo y su veredicto §6.2.3 REAL (esperado ~15 % CUMPLE).
- tubería única: 0 inalcanzables · semilla a <2 mm de la boquilla · control del dominio
  roto sigue disparando.
- gate `ciclo-dado-test` **0 fallan** (las 83+ de hoy, re-ancladas) · orden-gate VERDE.
- VIDEO 4K del llenado volteado: el fundido baja por el bebedero corto y llena la pieza
  desde el CENTRO de la base — juzgado (8 criterios) y entregado a AMBAS PCs.

## CIERRE (2026-08-12)

- **gate 79 pasan · 0 fallan** · orden-gate VERDE · **VIDEO 4K APROBADO 8/8** →
  `dado-volteado-4k.mp4`, entregado a AMBAS PCs + `/mnt/e/forja-videos`.

- **TODO LO QUE DEBÍA PASAR SOLO, PASÓ SOLO** (sin tocar los checks):

  | | desplazada (parche) | VOLTEADA (Fig 7.2) |
  |---|---|---|
  | balance | 🔴 29.2 mm | **✓ 0.0 mm — verde SOLO** |
  | modo | sprue+runner | **sprue-directo · 0 conflictos** |
  | L_sprue | 102 mm | **62.5 = cara clamp − base cerrada** |
  | colada | bebedero+runner+pozo+puller+compuerta | **solo el bebedero (⌀5→⌀8.3)** |
  | V_colada | 5.2 cc | **2.21 cc** (vóxeles 2.29 ≈ puro 2.21 ≈ OCC 2.21) |
  | regrind | 36.7 % VIOLA | **15.6 % CUMPLE §6.2.3** |
  | colada ∩ macho | 0 (con offset) | **0 (centrada)** |
  | tubería | 0 inalcanzables | **0 inalcanzables · semilla a 0.71 mm** |

- **la mecánica del volteo**: se parte en el marco LOCAL (la convención probada de
  splitMold) y se rota EL CONJUNTO 180° sobre X + colocación — cavidad ARRIBA (lado A),
  macho subiendo desde B con su respaldo Hk debajo, boca a B en la partición. Las 17
  cotas E3 se re-anclaron (cara INFERIOR de la cavidad en la partición, piso arriba,
  draft por AMBOS extremos = agnóstico de orientación) y siguen 17/17.

- **el video, visto con ojos**: el fundido baja por el bebedero corto, entra por el
  CENTRO de la base y desciende por las cuatro paredes SIMÉTRICAMENTE — el llenado
  radial de una pieza centro-inyectada, que es la física que la Fig 7.2 promete. El
  juez de tubería: "primer frame con pieza mojada: colada al 98.3 %".

- **la familia NaN volvió y se cazó en el gate**: con runner ⌀0, `pressureDropRunner`
  divide por R=0 y `10.7 + NaN = NaN` llegó hasta la cuenta de presión (78/1). Los
  cálculos de runner ahora corren SOLO si hay runner; en directo, cero es la verdad
  §7.2.1 ("it has no length, there is no pressure drop").

- **el t_c que manda ahora es el del BEBEDERO** (⌀8.3 en la base): la fila y el anuncio
  a la E9 usan el número correcto según el modo, con la nota de p.149 (el sprue no
  necesita la rigidez de la pieza; o se reduce ⌀ pagando ΔP).

- **trade-off declarado en pantalla** (fila `directo`): el des-gateo deja VESTIGIO en la
  base — remedios del libro: rim perimetral (Fig 7.2) o pozo rebajado (Fig 7.3).

- **pendientes vivos**: el vestigio/de-gateo como decisión de acabado; y la estación 6
  (compuerta, cap 7) que ahora tiene su caso resuelto: el gate ES el sprue.
