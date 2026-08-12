# ORDEN: COLOCAR los insertos DENTRO de la base estándar (§4.3.2, Fig 4.21)

BASE: e1c403e

OBJETIVO: ian: *"kazmer dice que se construye a partir del estándar, ya hay placas
prearmadas"*. Cierto, y `moldbase.ts` **ya lo implementa**: `STANDARD_BASES` + `selectMoldBase`
eligen la base estándar más chica que contiene el envelope, con aspecto ≤ 2:1 (§4.3.1) y
reserva perimetral de ½⌀ (§4.3.2), y las placas A/B salen de la altura de los insertos.
El 196×196 no es inventado: es la base SELECCIONADA.

Lo que falta es el paso que §4.3.2 describe en una frase y que nunca se escribió:

> "The shaded area in **Figure 4.21** represents the **usable area of the parting plane
> into which the core and cavity inserts can be placed**."

La estación 3 DIMENSIONA los insertos (60/16, verificados) y SELECCIONA la base, pero
nunca los **coloca dentro** de ella. Quedaron en su marco local, y por eso el gate está
en rojo con un desfase medido de **(+78, +78, +106.5)**:

```
insertos E3    centro (20, 20)    partición z = 39.5
base estándar  centro (98, 98)    partición z = 146
```

No es rediseño: es una COLOCACIÓN. Y en cuanto exista, la colada extraída en `colada.ts`
entra sin cambiarle una línea, porque su eje ya es el centro de la base (Fig 6.4).

## YA-EXISTE (prueba de ausencia)
- `moldbase.ts::STANDARD_BASES` + `selectMoldBase` — §4.3.1/§4.3.2 completos, con la
  reserva perimetral (`reserveMm`) que es justo la holgura de ½⌀ a pilares y retornos.
- `mold-plano-set.ts::plateStackZ` — el stack; `z.A` ES la partición de la base.
- `mold-plano-set.ts::packageToAssemblySpec` — de `pkg` al spec con `plates` y `widthMm`.
- `estudio-molde-datos.ts::construirAceroE3` / `verificacionE3` — dimensionan y miden.
- `occt.ts::transformShape` — la traslación rígida.
- `colada.ts` — ya pide el marco de la base; no se toca.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
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
- **el check rojo se pone VERDE SOLO**: `la PIEZA y el MOLDE comparten marco de
  coordenadas` debe pasar sin que yo lo toque. Si lo tengo que editar para que pase,
  es que no arreglé nada.
- **el centro del inserto = el centro de la base** (§4.3.2), medido del sólido.
- **la partición del ciclo = `plateStackZ(asm).A`**, medida del sólido.
- **los insertos caben en el ÁREA UTILIZABLE** (Fig 4.21): el bbox de los insertos
  colocados queda dentro de `base − 2·reserveMm`, que es la holgura de ½⌀ que
  `selectMoldBase` ya calcula. Si no cabe, se DECLARA (no se encoge la reserva).
- **las 17 cotas de la E3 siguen pasando**: una traslación rígida no cambia tamaños.
  Si alguna cambia, es que movía algo que no debía.
- **la prueba del rayo sigue dando `atrapadas = 0`** y su control negativo sigue
  reprobando — es invariante a traslación, y si se rompe, la colocación está mal.
- **el llenado de la E4 sigue midiendo lo mismo**: el campo se mueve con la pieza, y el
  volumen de vóxeles (14,140) no debe cambiar.
- Captura del CAD con OJOS antes del 4K.
- `node scripts/ciclo-dado-test.cjs` VERDE (0 fallan) · `node scripts/orden-gate.cjs` VERDE.

## CIERRE (2026-08-11)

- **el check rojo se puso VERDE SOLO.** No lo edité: arreglé la colocación y pasó.
  `la PIEZA y el MOLDE comparten marco de coordenadas — centro de la pieza MEDIDO
  (98.0, 98.0) vs centro de la base (98, 98) · partición 146 vs stack 146`.
  Gate: **77 pasan · 0 fallan** (venía de 71/1).

- **`colocacionEnLaBase(pkg)` es FUENTE ÚNICA** del offset (+78, +78, +106.5): la usan
  `construirAceroE3`, el campo de llenado de la E4 y el gate. Si alguien lo recalcula por
  su cuenta, vuelven los dos marcos — por eso vive en un solo lugar.

- **la colada entró SIN TOCARLE UNA LÍNEA**, como estaba previsto, y sus números dejaron
  de ser absurdos porque el marco por fin es uno solo:

  | | antes (dos marcos) | ahora (colocada) |
  |---|---|---|
  | L_sprue | 248 mm (el molde entero) | **141.5 mm** |
  | ⌀ bebedero en la partición | 17.99 mm | **12.41 mm** |
  | eje | — | **(98, 98) = centro de la base** |
  | arranque | — | **z 106.5 = base cerrada de la pieza** |
  | runner | degenerado (L=0) | **⌀6, y la compuerta TOCA la pieza en x=118** |
  | sprue puller | no existía | **existe, bajo la partición** |

- **Fig 4.21 verificada**: el inserto colocado ocupa x 38..158 dentro de una base 0..196.

- **DOS DEFECTOS de la misma familia, cazados al colocar** — coordenadas absolutas
  horneadas que asumían que la pieza vive en el origen:
  1. `verificacionE3` rebanaba el sólido en **z absoluto 0 y 2** para medir el draft. Con
     la pieza 106.5 mm arriba, las rebanadas cortaban en el VACÍO y el kernel reventaba
     con `wasmTable.get is not a function`. Ahora la rebanada va anclada al bbox del
     sólido. Aislado paso por paso: `transformShape` OK, `splitMold` desplazado OK — el
     crash era la medición, no la colocación.
  2. La cota `núcleo entra hasta el piso` estaba declarada como **2** absoluto; es 2 mm
     sobre el fondo de la PIEZA. Ahora se declara relativa (`bbD.min[2] + 2`).

- **PENDIENTE Y DECLARADO — no se hizo la revisión visual.** iangpu dejó de responder
  (`Connection timed out`, el gotcha de sobrecarga SSH ya documentado) justo al ir por la
  captura. La evidencia de esta orden es NUMÉRICA (77/77 con OCC real); **la captura con
  ojos y el video 4K quedan pendientes**, y no se dan por hechos.

- **también pendiente**: la estación 5 sigue construyendo su propia geometría en
  `useMoldStudio` en vez de llamar a `colada.ts`. Con el marco ya resuelto, ese cableado
  es lo siguiente — y ahí se borra la segunda colada del repo.
