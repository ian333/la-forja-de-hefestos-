# ORDEN: la ESTACIÓN 5 usa el generador — y se borra la segunda colada

BASE: 94be46b

OBJETIVO: ian: *"cablea la estación 5 a colada.ts y borra la otra"*. Con el marco ya
resuelto (los insertos viven dentro de la base estándar, §4.3.2), el generador extraído
en `colada.ts` puede reemplazar las DOS coladas que quedan en el repo:

1. la geometría inline de la E5 en `useMoldStudio.ts` — la que inventé (`L=60`,
   `xSprue = lado + rBase + 6`), que además ahora quedaría fuera de sitio porque la pieza
   se movió (+78, +78, +106.5);
2. la de `mold-plano-set.ts` líneas 1112-1119 — la buena, pero enterrada, que pasa a
   LLAMAR al generador en vez de construir la suya.

Al final debe quedar **una sola colada en el repo**.

## YA-EXISTE (prueba de ausencia)
- `colada.ts` — `datumsColada` (puro) · `construirColada(K, oc, d)` · `verificacionColada`
  · `coladaMala` (control negativo). Verificado: 9 cotas + control negativo en el gate.
- `estudio-molde-datos.ts::colocacionEnLaBase(pkg)` — la fuente ÚNICA del offset.
- `estudio-molde-datos.ts::estacion5Dado` — el ANÁLISIS (presión total, regrind §6.2.3,
  congelamiento §7.1.5, monotonía A-129, anuncios de retorno). Eso se queda: es el trabajo
  de la estación. Lo que se le quita es inventar cotas — las recibe.
- `mold-plano-set.ts::sprueDesignFromCavity` — sigue siendo el motor de radios; `colada.ts`
  ya lo usa por dentro.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/colada.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

> Se BORRA CÓDIGO dentro de archivos que ya están en TOCA: la geometría inline de la E5
> en `useMoldStudio.ts` y la construcción propia de la colada en `mold-plano-set.ts`.

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
- **UNA SOLA COLADA**: `grep -c "makeCone" en los constructores de colada` debe dar 1, y
  vivir en `colada.ts`. Ni `useMoldStudio` ni `mold-plano-set` construyen conos de sprue.
- **la E5 deja de inventar cotas**: `estacion5Dado` recibe los datums; no calcula
  `xSprue`, ni `L_sprue`, ni la holgura. Si alguna cota sigue naciendo ahí, no se cumplió.
- **la E5 verifica con `verificacionColada`**, la misma que corre el gate — no con
  mediciones inline en el handler de React.
- **el gate sigue en 0 fallan** y el molde completo (`mold-plano-set`) sigue construyendo
  su colada con los mismos números de antes (misma `sprueDesignFromCavity`).
- **captura del CAD con OJOS** — pendiente de la orden anterior por caída de iangpu; si
  responde, se hace aquí y se juzga el video 4K.
- `node scripts/ciclo-dado-test.cjs` VERDE · `node scripts/orden-gate.cjs` VERDE.

## CIERRE (2026-08-11)

- **UNA SOLA COLADA.** Quedan dos `makeCone(4.75, 2.5, 60)` en el repo y ninguno es
  producción: uno es `coladaMala` —el control negativo, a propósito— y el otro es un
  comentario. Se borraron las dos reales:
  1. la geometría inline de la E5 en `useMoldStudio` (makeCone/makeCylinder/makeBox/
     fuseAll + bboxes en el handler de React);
  2. **el bebedero hardcodeado de la E4**, que yo había metido "para que se viera la
     inyección" — ⌀5→⌀9.5 × 60 mm en el marco viejo de la pieza. La alimentación es la
     estación 5; la 4 es el llenado de CAVIDAD (§5.5.2 lo dice literal).
  Y `mold-plano-set` DELEGA: su cono ahora lo hace `construirColadaSprue`.

- **la E5 dejó de inventar cotas.** `estacion5Dado` recibe `datums: DatumsColada`; ya no
  calcula `xSprue`, ni `L_sprue`, ni la holgura. Y verifica con `verificacionColada` —
  la MISMA función que corre el gate, no mediciones sueltas en la pantalla.

- **gate 73 pasan · 0 fallan**, con dos checks que cambiaron de forma por ser más honestos:
  - se borraron las mediciones inline viejas de la E5 (las hace `verificacionColada`);
    tener dos formas de medir era la otra cara de tener dos coladas.
  - el regrind dejó de exigir que el número salga bonito.

- **EL REGRIND AHORA DICE LA VERDAD, y es fea: 68.4 %.** Con `L_sprue = 141.5 mm` del
  stack real para una pieza de 14 cc, la colada se lleva más de dos tercios del disparo,
  contra el 30 % de §6.2.3. Antes yo lo "resolvía" acortando el bebedero — pero el largo
  lo fija el stack (§6.3.1), así que acortarlo es cambiar PLACAS. El gate ahora exige que
  la estación lo DETECTE y lo ANUNCIE como retorno a la **estación 3**, no que el número
  se vea bien. Es el mismo dado que la E4 ya había acusado, ahora con el número real.

- **PENDIENTE**: la captura con OJOS y el video 4K siguen sin hacerse — iangpu no
  respondía al cierre de la orden anterior y no se volvió a intentar aquí. La evidencia
  de esta orden es numérica (73/73 con OCC real).
