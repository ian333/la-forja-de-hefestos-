# ORDEN: U10 · EL FOCO ES EL LUGAR DEL ANÁLISIS — las LENTES sobre tu pieza

BASE: 53ea93b

OBJETIVO: ian: «quiero POCs :D con los datos que ya tengamos. El Foco puede ser para ver el
sistema de enfriamiento o la temperatura — **la idea es que el Foco sea el lugar del análisis y
no tengas que pagar extra o esperar**».

Eso es un requisito duro, no un deseo: **sin módulo aparte, sin pantalla aparte, sin espera.**
Prendes `Q` sobre tu pieza y ahí mismo está el análisis.

## MEDIDO HOY, ANTES DE PROMETER (esto es lo que hace la orden posible)

El motor **ya existe** — `flowFieldFromMesh` (revisar-modelo.ts) → `FlowField` con espesor local
Hildebrand–Rüegsegger, longitud de flujo geodésica y resistencia. Y `cooling.ts` trae la Eq 9.5
de Kazmer verificada contra el libro (8.4/18.9/22.9 s). Lo corrí sobre STLs reales:

| pieza | triángulos | campo COMPLETO | pared mediana | t_c mediana | t_c MÁX |
|---|---|---|---|---|---|
| rpi4-top | 3,780 | **0.46 s** | 2.22 mm | 10.3 s | 41.3 s |
| einsy-base | 9,142 | **0.62 s** | 3.53 mm | 26.1 s | **382.9 s** |
| naturebytes-front | 14,392 | **0.85 s** | 4.61 mm | 44.7 s | 134.0 s |
| 3dbenchy (peor caso) | 225,706 | **2.44 s** | 8.46 mm | 150.5 s | 401.3 s |

**0.46–2.44 s por UNA pasada que alimenta las TRES lentes.** Eso es "sin esperar".

Descartado y por qué: la vía del **SDF** (`sdf-malla.ts`) tardó **14 s** en la pieza más chica
(1,700 triángulos) — es exacta y sirve para el molde, pero no para una lente viva. Se declara
porque me costó la medición.

## LA REGLA DE COLOR (de la captura 8:26 de Horizon, U9)

**cian = lo que MEDIMOS · violeta = lo que SIMULAMOS.** Se estrena aquí:
- **PARED** es cian — el espesor está EN la pieza, solo lo trazamos.
- **ENFRIAMIENTO** y **LLENADO** son violeta — no existen en la pieza: son un cálculo.
Y de Shipbreaker: **la leyenda donde el color ES la clave**, y pestañas de lente sobre el MISMO
objeto (una pieza, tres lecturas) en vez de tres pantallas.

Al terminar: con la pieza en el visor, `Q` prende el Foco y aparecen las **LENTES**. Cada lente
pinta el sólido por vértice (canal `feaColors`, que ya existe y ya va con `toneMapped:false`),
trae su leyenda con valores reales, y una **FICHA en lenguaje natural** — no `F_eject 5567 N`.

## EJERCICIOS
- lente-motor · UNA pasada alimenta las 3 lentes · `foco-lentes.ts` puro · `lentesDelFoco(mesh)` corre el campo UNA vez y devuelve pared+enfriamiento+llenado; el gate mide que el t_c de una placa de 2 mm ABS = 8.4 s (Eq 9.5, el número del libro)
- lente-sin-esperar · No se paga espera · medición · las 4 piezas de la tabla se resuelven en ≤2.5 s y el módulo DECLARA sus ms; ninguna corre dos veces el campo
- lente-color-honesto · El color dice de dónde viene el número · doctrina · PARED en cian (medido), ENFRIAMIENTO y LLENADO en violeta (simulado); el gate verifica el `origen` de cada lente
- lente-leyenda · El color ES la clave, no adorno · UI · cada lente trae paradas con valor real y unidad; sin leyenda una lente no se puede prender
- lente-ficha · Dice lo que pasa en español, no en símbolos · texto · la ficha de enfriamiento nombra el punto que MANDA el ciclo, su espesor y su t_c, y qué hacer
- lente-en-la-forja · Pasa DENTRO del CAD, sin pantalla nueva · Regla #0.7 · cero `<Canvas>` nuevo (censo 8→8), la pieza se pinta con el `SolidMesh` que ya existe

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/flowlen.ts` — `measureFlowLength`: espesor local (EDT chamfer + esfera
  Hildebrand–Rüegsegger), L geodésica y resistencia. **No se reescribe: se consume.**
- `src/forja/mold/revisar-modelo.ts` — `flowFieldFromMesh(mesh)`: malla → campo, con la celda
  acotada. Es la entrada exacta que necesita la lente.
- `src/forja/mold/cooling.ts` — Eq 9.5/9.6/9.4 de Kazmer, `ABS_KAZMER` calibrado al libro.
- `ForgeBRepStudio.tsx` línea ~6263 — el comentario del canal ya dice *"en T2, el canal de
  colores por vértice para pintarle el espesor encima"*. El gancho estaba puesto.
- `SolidMesh` ya pinta `feaColors` con `meshBasicMaterial vertexColors toneMapped={false}` —
  el colormap sale como DATO, no tonemapeado. No hay que tocar el material.
- NO existe: ningún módulo que ate el campo a una lente del Foco, ni leyenda, ni ficha.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/RevisarPiezaPanel.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- ordenes/2026-08-30-u10-el-foco-es-el-analisis.md
- src/forja/mold/foco-lentes.ts
- public/evidencia/2026-08-30-u10-el-foco-es-el-analisis/resultados.json
- public/evidencia/2026-08-30-u10-el-foco-es-el-analisis/foco-medidas.png
- public/evidencia/2026-08-30-u10-el-foco-es-el-analisis/lente-enfriamiento.png
- public/evidencia/2026-08-30-u10-el-foco-es-el-analisis/lente-pared.png
- public/evidencia/2026-08-30-u10-el-foco-es-el-analisis/lente-llenado.png

## BORRA
- (nada)

## PREEXISTENTE
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json
- scripts/precompute-water-approach.py
- src/cinematic/CinematicMolecule.tsx

## EVIDENCIA (declarada ANTES de trabajar)
- gate `ciclo-dado-test.cjs` con los casos de lente, incluida la placa de 2 mm = 8.4 s del libro
- capturas del arnés `forja-drive.cjs` con una pieza REAL cargada y cada lente prendida
- los ms medidos, impresos por el propio módulo (no de mi memoria)
- entrega a `C:/Users/sebas/Downloads` — **nada en /tmp**
- deploy a producción + verificación contra el bundle SERVIDO
- orden-gate VERDE · censo Canvas 8→8 · Temis n/6
