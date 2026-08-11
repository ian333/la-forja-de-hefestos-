# ORDEN: LLENADO NIVEL 1 — resistencia, isócronas, weld line y gas trap · + Cross-WLF

BASE: c03fd0b

OBJETIVO: rehacer la estación 4 como el libro la enseña, después de que ian frenó la
versión anterior ("el llenado debe ser un análisis de fluidos y presiones… aquí es
falso, no está el sprue") y de leer el cap 5 completo CON SUS 20 FIGURAS. Tres cosas:

(1) **Cross-WLF de verdad** — η(γ̇,T) con los coeficientes LITERALES del Apéndice A del
    libro (ABS: n 0.247 · τ* 9.97e4 · D1 1.93e13 · D2 373.15 · D3 0 · A1 31.4 · A2 51.6 ·
    η₀ 2210 Pa·s @ mid-range 239 °C). Hoy solo hay power law, que miente a corte bajo —
    justo en la compuerta y en el frente frío.
(2) **NIVEL 1 del llenado**: el frente sale de la RESISTENCIA (∝ ΔP, Eq 5.22), no de la
    distancia. Mi propio `flowlen.ts` lo advierte por escrito y usé el atajo.
    Isócronas NUMERADAS como Fig 5.1/5.17 (no un degradado), weld line y gas trap
    ROTULADOS, y ΔP por SEGMENTO del lay-flat (§5.5.2) con `fillingPressure(segments)`,
    que YA EXISTE y tampoco usé.
(3) **El sprue VISIBLE**: la escena muestra el fundido entrando por la colada. El número
    del cap 5 es de cavidad A PROPÓSITO (§5.5.2 literal: "does not include the pressure
    drop through the feed system") — eso se DECLARA en pantalla y el total queda como
    deuda del cap 6, que es la estación 5.

## YA-EXISTE (prueba de ausencia)
- `flowlen.ts::measureFlowLength` → voxeliza, da `thicknessMm` (espesor local) y
  `resistance` (∝ ΔP, el ORDEN REAL de llenado) + `computeWeldMask`. ES el nivel 1.
- `filling.ts::fillingPressure(segments)` → el lay-flat de §5.5.2, ya implementado.
- `filling.ts::convergeVelocityTraced` → la escalera de A-088 (ya en pantalla).
- Pintores por vértice: `MoldScene.LlenadoPaint` (creado en la E4 anterior) — se
  REESCRIBE para pintar por BANDAS isócronas, no gradiente.
- El sprue como sólido: `mold-plano-set` ya lo construye en el molde completo.

## TOCA
- src/forja/mold/filling.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/MoldScene.tsx
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo)
- index.html
- public/comando/
- scripts/comando-catalogo.cjs
- public/atrio/
- scripts/reels-web.py
- src/cinematic/
- scripts/guiones/
- videos/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py

## EVIDENCIA (declarada antes de trabajar)
- Cross-WLF verificado contra EL LIBRO: a 239 °C y γ̇ = 2000 1/s debe dar ~120 Pa·s
  (§5.5.1, el ejemplo del bezel, línea a línea). Y el lazo de velocidad con Cross-WLF
  debe converger a ~0.82 m/s (el libro: 0.5 → 0.69 → 0.77 → 0.80 → 0.82).
- Lay-flat del bezel de §5.5.2 (200 mm × 20 mm × 1.5 mm, v 0.82) → ΔP ≈ **83.2 MPa**
  (el número impreso del libro). Ése es el gate del método.
- Nivel 1 sobre el dado: el frente sale de RESISTENCIA; se reportan las isócronas, la
  última zona, y si hay weld line / gas trap.
- CONTROL NEGATIVO: el contenedor de §5.5.4 (100×160×60, pared uniforme) DEBE dar
  race-tracking con gas trap; con las paredes a 1.5 mm (flow leader, §5.5.5 y Fig 5.20)
  el gas trap DEBE desaparecer. Es el par bueno/malo del propio libro.
- Captura CAD con isócronas numeradas + rótulos + sprue, revisada con ojos → Downloads
  de AMBAS PCs (carpeta FORJA-DADO) + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL.

## CIERRE (2026-08-11) — PARCIAL: motor entregado, UI pendiente
- orden vs entregado: el MOTOR completo y verificado; la UI (isócronas pintadas en el
  3D + sprue visible) queda para la siguiente vuelta — se declara, no se simula hecha.
- números: gate `ciclo-dado-test` **47/47** con OCC real. Cross-WLF reproduce el libro
  LÍNEA POR LÍNEA: η₀(239 °C) = 2190 vs 2210 tabulado · **η(γ̇=2000) = 119.9 vs los
  "120 Pa s" de §5.5.1** · el lazo 0.5 → 0.8214 m/s en 7 vueltas vs "0.82" del libro ·
  lay-flat del bezel = **83.2 MPa exacto** (el número impreso de §5.5.2).
  Y el par bueno/malo DEL PROPIO LIBRO reproducido con nuestro motor: contenedor
  100×160×60 de pared uniforme → **race-tracking SÍ** (el último punto por resistencia
  está a 107 mm del más lejano por distancia, Fig 5.17); con laterales a 1.5 mm
  (flow leader, Fig 5.19/5.20) → **curado**, y el llenado se EMPAREJA: la banda pico
  baja de 22 % a 14 % del total, que es el objetivo declarado de §5.2.
- evidencia: el gate ES la evidencia numérica (reproduce tres ejemplos resueltos y un
  par de figuras del libro). Capturas del 3D: PENDIENTES.
- LO QUE ESTA ORDEN CORRIGE de mí: usé distancia geodésica cuando `flowlen.ts` advierte
  POR ESCRITO que el orden real de llenado es `resistance`; y `fillingPressure(segments)`
  —el lay-flat de §5.5.2— ya existía sin usar. El motor de fluidos estaba en casa.
- preguntas abiertas: (1) pintar las isócronas NUMERADAS en el 3D y hacer visible el
  sprue (lo que ian pidió VER); (2) `computeWeldMask` aún no está cableado — weldLines
  sale 0 y eso está declarado en la estructura, no escondido; (3) el nivel 2
  (Hele-Shaw ∇·(S∇p)=0) como estación propia con MMS y flujo radial analítico.
