# ORDEN: ESTACIÓN 5 — ALIMENTACIÓN (Kazmer cap 6): que el sprue deje de verse raro por la RAZÓN correcta

BASE: b3bdd2d

OBJETIVO: ian, viendo el video de la superficie: *"se sigue viendo raro el sprue"*. Y sí.
La conicidad está bien (medida: ⌀9.43 partición → ⌀5.08 boquilla), pero hay tres defectos
reales, y los tres son cap 6:

1. **Cae en la ESQUINA.** El eje del bebedero está en x=40, y=20 — sobre la arista del
   cubo, no sobre el centro de la pieza (que es x=20, y=20).
2. **Termina en su punto MÁS ANCHO justo donde toca la pieza**: ⌀9.5 mm entrando a una
   pared de 2 mm. No hay runner ni compuerta. La alimentación debe ESTRECHAR hacia la
   pieza, no ensancharse.
3. **Los radios están HARDCODEADOS** (`makeCone(oc, 4.75, 2.5, 60)`) en vez de salir de
   `designSprueFeed`, que ya existe y que el resto de la app YA usa. Ése es el defecto de
   fondo: el ciclo ignora su propio motor.

## EL DIBUJO (aprobado por ian antes de codear)

```
   HOY (lo que se ve raro)              ESTACIÓN 5 · ALIMENTACIÓN (cap 6)
   ────────────────────────             ─────────────────────────────────
        ╲   ╱  boquilla                      ╲   ╱  ⌀ = orificio boquilla + holgura
         ╲ ╱                                  ╲ ╱   conicidad 1–3°/lado (§6.3.1)
          ▓                                    ▓
         ▓▓▓  sprue ⌀9.5 HARDCODEADO          ▓▓▓  BEBEDERO ⌀ de designSprueFeed
        ▓▓▓▓▓                                ▓▓▓▓▓
   ═══════╤═══════ partición            ═══════╤═══════ partición
          │ ⌀9.5 ENTRA DIRECTO                 ├──────┐  RUNNER  (Eq 6.8/6.9)
     ┌────┴──┐  ← y en la ESQUINA              │      ▽  POZO DE ESCORIA (cold slug)
     │       │                                 │   ┌──┴──┐
     │ pieza │                                 └──▷│pieza│  ← COMPUERTA chica, CENTRADA
     └───────┘                                     └─────┘
                                          ⌀sprue_base > ⌀runner > ⌀gate  ← se MIDE
```

## YA-EXISTE (prueba de ausencia) — ESTA ESTACIÓN ES ENSAMBLE, NO CONSTRUCCIÓN

El motor del cap 6 YA ESTÁ ESCRITO Y VERIFICADO. Lo que falta es que el ciclo lo use.
Si en algún momento me descubro escribiendo una fórmula del cap 6: **ALTO, ya existe.**

- **`mold/feed.ts`** — `designSprueFeed` es literalmente esta estación: cono desde el
  orificio de boquilla + holgura + taper (§6.3.1), ΔP power-law (Eq 6.5), γ̇ (Eq 6.4) vs
  Tabla 7.2 / Apéndice A, Re (Eq 6.2) < 2300, volumen y **regrind (Eq 6.6) vs el 30 % de
  §6.2.3**, t_c del sprue vs t_c de la pieza (§6.4.7) y freeze de la compuerta (Tabla 7.4).
  Devuelve **`rTopMm` y `rBaseMm`** — exactamente los radios que el CAD debe usar.
  Además: `designFeedSystem`, `optimizeFeedSystem`, `feedPressureDrop`, `feedVolume`,
  `minRunnerRadius` (Eq 6.8 + asignación Eq 6.9), `reynolds`, `shearRateRunner`.
  Su cabecera declara: *"Verificado contra el hot-runner del laptop bezel (p.139-144)"*.
- **`mold/feed-layouts.ts`** — `FeedNetwork`/`FeedSeg`, `layoutBranched/Radial/Series/
  Hybrid`, `applyResistanceNetwork`, `flowTForSegs`. **Ya están IMPORTADOS en
  `useMoldStudio.ts:36`** y sin usar en el ciclo.
- **`mold/moldmachine.ts:293`** ya llama `designFeedSystem` → es el objeto `al` que
  `estacion4Dado` YA consume.
- **`estudio-molde-datos.ts`** — la E4 YA ACUSA a esta estación, con número:
  *"el bebedero se come el presupuesto de presión"* (§6.4 · A-111) y *"demasiado material
  se va en la colada"* (§6.2.3 · A-121). Y `CICLO_KAZMER` ya declara
  `{ n: 5, titulo: 'Alimentación', cap: 'cap 6', aparece: 'sprue + runners' }`.
- **`MoldScene.FeedFill`** — el fundido BAJANDO por la colada, con MODO RED por vértice
  (Figs 6.13-6.17). Es lo que ian pidió ver. **Se REUSA tal cual**, no se reescribe: ésa
  fue la lección de las ocho reescrituras del frente.
- **`mold-plano-set.ts:1116`** ya construye el sprue a partir de `fd.rBaseMm`/`fd.rTopMm`
  — o sea el resto de la app ya consume el motor; el único que hardcodea es el ciclo.
- **`mold/lamina-compuerta.ts`** — la lámina de compuerta, con el criterio rBase > rTop.
- **`mold/threeplate.ts::compareFeedSystems`** — comparación de arquitecturas.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx
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

Todo se MIDE del sólido construido, no se declara en un panel (la lección de la E3: el
panel decía 60/16 y el acero medía 52/14).

- **los radios del sprue MEDIDOS = los que dice `designSprueFeed`** (±0.1 mm), rebanando
  el sólido con OCC como se hizo para diagnosticar. Éste es el bug que originó la orden.
- **el eje del bebedero CENTRADO sobre la pieza**: medido del bbox del sólido, x=20 y=20
  para el cubo de 40 (hoy: x=40, y=20 — sobre la arista).
- **LA ALIMENTACIÓN ESTRECHA**: `⌀sprue_base > ⌀runner > ⌀gate`, verificado numéricamente
  sobre los sólidos construidos, no sobre las intenciones. Es el criterio que hace que
  deje de verse "al revés".
- **P_total = ΔP_cavidad (lay-flat §5.5.2) + ΔP_alimentación (Eq 6.5)** y su veredicto
  contra la presión disponible de la inyectora. La E4 dio el de cavidad A PROPÓSITO
  (§5.5.2 literal: *"does not include the pressure drop through the feed system"*); aquí
  se cierra la cuenta.
- **REPRODUCIR LA ACUSACIÓN DE LA E4**: el regrind (Eq 6.6) de un sprue de 60 mm para una
  pieza de 40 mm probablemente VIOLA el 30 % de §6.2.3. La estación debe reproducir esa
  violación y RESOLVERLA (acortar el bebedero / cambiar arquitectura), con el número antes
  y después. Si no se resuelve, se DECLARA — no se esconde bajando el límite.
- **un ejemplo del LIBRO reproducido**: `designSprueFeed` dice estar verificado contra el
  bezel de p.139-144; el gate lo comprueba contra el número impreso.
- **la regla √n como CONTRAEJEMPLO**, que es como el libro la presenta.
- **VER ANTES DE RENDERIZAR**: captura del CAD (peek) revisada con ojos —el fundido baja
  bebedero → runner → compuerta → pieza con `FeedFill`— y DESPUÉS el video 4K juzgado por
  `scripts/llenado-video.cjs` (7 criterios, incluido el de PÍXELES).
- Entrega a `Downloads\FORJA-DADO` de AMBAS PCs + `/mnt/e/forja-videos`.
- `node scripts/ciclo-dado-test.cjs` con los criterios nuevos, y `node scripts/orden-gate.cjs`
  VERDE (sin pipe) · censo IGUAL (0 `<Canvas>` nuevos).

## CIERRE
- (pendiente)
