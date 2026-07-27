# Pipeline canónico de diseño de moldes en SolidWorks (3 tutoriales) y mapeo a La Forja

## 1. EL PIPELINE CANÓNICO

Los tres cursos repiten exactamente la misma columna vertebral, con variaciones solo en cómo construyen la superficie de partición (plana-quebrada vs. curva con parches):

| # | Fase | Feature SolidWorks | Parámetros típicos observados |
|---|------|--------------------|-------------------------------|
| 1 | **Importar la pieza** | `Insert > Part` en una parte vacía | Transfer: solo Solid bodies; config Default; insertar en el origen |
| 2 | **Contracción** | `Insert > Features > Scale` | Scale about **Origin**, uniform; **1.015** (gancho) / **1.006** (ABS 0.6%). Un Scale POR pieza |
| 3 | **Layout de cavidades** | `Move/Copy Body` ×2-3 por cuerpo | Patrón fijo: (a) asentar sobre plano con mate/constraint, (b) rotar 90/180° **poniendo en 0 a mano las coordenadas residuales del origen de rotación**, (c) trasladar (ΔX=40, o ΔY=15/ΔZ=30). Molde familia = repetir 1-3 por cada pieza |
| 4 | **Línea de partición** | `Mold Tools > Parting Lines` | Pull direction = Top Plane; draft angle **1.00°**; botón Draft Analysis; ☑ Use for Core/Cavity Split; ☑ Split faces; "At +/- draft transition". El auto-chain deja el lazo INCOMPLETO y el usuario pica aristas a mano (78→87 en el clip; 9→87 en el peine) hasta el mensaje verde |
| 5 | **Shut-offs** | `Delete Face` (Delete and Patch) + `Fill Surface` + `Boundary Surface` | Barrenos pasantes de orejas → Delete and Patch (4 caras cilíndricas). Ventanas → Fill Surface (lazo de 9 aristas, Contact). Huecos entre dientes → Boundary Surface con SelectionManager (2 Open Groups + arista guía en Dir 2), UNO POR HUECO, repetido 6+ veces |
| 6 | **Superficie de partición** | Croquis (2D o 3D) + `Convert Entities` arista por arista + `Surface-Extrude` + `Mirror` + `Trim Mutual` + `Knit` | Curso 1: convertir contorno (9 aristas), extensiones acotadas (700 mm simétrico, Y=−40), extrude **Mid Plane 500 mm**, copia rotada 180°, Trim Mutual. Curso 2: 3DSketch con **29 aristas convertidas una por una** (259.38 mm), falda de **80 mm** normal a un plano, Mirror, parches boundary puente, **Knit** (tol 0.0025 mm) que colapsa 47→7 cuerpos |
| 7 | **Tooling Split** | `Mold Tools > Tooling Split` | Croquis Center Rectangle del bloque (230×500 / 350×630); alturas **145 arriba / 90 abajo**; listas Core/Cavity/Parting Surface llenadas a mano; Interlock surface SIN marcar |
| 8 | **Volver placa rectangular** | `Boss-Extrude` Up To Surface | Croquis 350×630 sobre el bloque, Merge result, Feature Scope manual (Tooling Split + Cores) → funde todo en UNA placa |
| 9 | **Insertos laterales** | `Mold Tools > Core` | Croquis rectángulos espejeados (63 mm, Mirror about Right Plane); draft **5°**; profundidad 200 mm; Cap ends |
| 10 | **Salidas y acabado de placa** | `Draft` + `Fillet` ×4-6 + `Chamfer` | Draft **5°** neutral-plane en TODAS las paredes de bolsillo; fillets en cascada **R20** (esquinas verticales) → **R10** (escalones largos) → **R5** (curvas de partición) → **R4** (perímetro de piso); chamfer **10 mm × 45°** en la base |
| 11 | **Barrenos guía** | Croquis de círculos + `Hole Wizard` Counterbored | Círculos Ø35 en esquinas (±142, ±277) + Mirror; pernos guía: Ø35 pasante, caja Ø40×8; bushings: Ø48, caja Ø54×10; Through All; posiciones amarradas concéntricas al croquis |
| 12 | **Verificación visual** | Isolate / Change Transparency / órbita | Placa cavidad translúcida sobre núcleo, inspección de improntas y barrenos |

**La observación clave:** ~70% del tiempo de video es picar aristas una por una (parting line, convert entities, parches boundary) y llenar listas de selección a mano. La "inteligencia" (qué draft, qué radios, qué layout) son ~15 números que se repiten idénticos entre cursos.

---

## 2. MAPEO SolidWorks → La Forja

| Paso SolidWorks | Equivalente en La Forja | Estado |
|---|---|---|
| Insert Part | Import STEP/malla al kernel (piezas Hammond 21/21) | ✅ Existe |
| Scale (contracción) | `scaleForShrinkage()` en `src/forja/mold/mold.ts` + tabla `shrinkage.ts` por material | ✅ Existe |
| Move/Copy Body (layout) | Transforms del kernel existen; **layout multi-cavidad/familia automático balanceado NO existe** como función | 🟡 Parcial |
| Parting Lines (análisis + cadena) | `draftAnalysis()` + `dfmFromMesh()` clasifican caras por draft; **la extracción de la CADENA de aristas de partición sobre el B-Rep NO existe** | 🟡 Parcial |
| Shut-off Surfaces / Delete Face and Patch | Nada equivalente. El booleano de `splitMold` (bloque − pieza) hace emerger acero pasante implícito, pero sin control de a qué mitad va el shut-off ni parcheo explícito de barrenos | ❌ Falta |
| Superficie de partición NO plana (falda + parches + knit) | Solo `splitMoldByPlane()` (partición PLANA). Partición que sigue el contorno de la pieza: **no existe** | ❌ Falta |
| Tooling Split | `splitMold()` / `splitMoldByPlane()` — equivalente funcional para partición plana; para partición curva depende del punto anterior | 🟡 Parcial |
| Interlock surface | `planInterlocks()` §12.2.5 (`mold-interlocks.ts`): cálculo de corte + plan; geometría en el ensamble | ✅ Existe |
| Core (insertos laterales) | `sideactions.ts` (angle pin, slide units) + `mold-sideaction-gen.ts`: diseño y cálculo sí; **extracción geométrica del inserto desde un croquis frontera, parcial** | 🟡 Parcial |
| Draft (AGREGAR salida a caras) | Tenemos ANÁLISIS de draft (DFM), no la **operación de modelado** neutral-plane que inclina caras (OCCT `BRepOffsetAPI_DraftAngle` está disponible pero no envuelto) | ❌ Falta |
| Fillet / Chamfer | `filletAllEdgesResilient` + chaflanes en el kernel | ✅ Existe |
| Hole Wizard (counterbore guía) | Catálogo DIN 942 SKUs + `fastenerPlan()` + barrenos en el ensamble de placas (`mold-assembly.ts`, `moldbase.ts`) | ✅ Existe |
| Bloque/placas dimensionados | `sizeInserts()` + `selectMoldBase()` + `platesizing.ts` — MEJOR que el tutorial (ahí los 145/90 salen "de experiencia") | ✅ Existe |
| Draft Analysis con colores | DFM desde malla con undercuts/draft/pared | ✅ Existe |
| Planos / verificación visual | HLR + planos con color/translúcido | ✅ Existe |
| Cotización | `moldMachine()` — SolidWorks NO lo tiene en estos cursos | ✅ Existe (ventaja nuestra) |

**Honestidad:** los dos hoyos grandes son (a) **partición no plana** (línea + superficie + split real) y (b) **shut-offs controlados**. Todo lo demás es cerrar cabos o ya lo superamos (cotización, sizing por fórmula, DFM).

---

## 3. MICRO-PATRONES AUTOMATIZABLES

1. **Línea de partición por transición de draft.** El usuario pica 87 aristas a mano; la regla es determinista: aristas cuyas dos caras adyacentes tienen signo opuesto de `dot(normal, pull)`. → *Recorrer aristas del B-Rep con `TopExp` cara-a-cara, filtrar por cambio de signo, encadenar en lazo cerrado con tolerancia de vértice.*

2. **Contracción por material, no por número.** Tecleaban 1.006 sabiendo "ABS = 0.6%". → *`scaleForShrinkage(pieza, material)` con lookup en `shrinkage.ts` — pegar las dos funciones que ya tenemos para que nadie vuelva a teclear el factor.*

3. **Layout multi-cavidad / molde familia.** Siempre: copiar, rotar 180° (limpiando el centroide residual a 0 — fuente de error clásica), trasladar simétrico al eje del runner. → *`layoutCavities(piezas[], n)`: transforms alrededor del origen, balanceando volúmenes contra el campo flowlen que ya tenemos.*

4. **Shut-off de barrenos pasantes.** Delete-Face-and-Patch de 4 caras cilíndricas, dos veces. La regla: cara cilíndrica con eje ∥ pull que atraviesa la pieza = shut-off. → *Enumerar caras cilíndricas alineadas al pull (ya enumeramos sub-shapes), taparlas con disco plano a la altura de partición, con flag de a qué mitad va el acero.*

5. **Falda de partición al borde del bloque.** El 3DSketch de 29 Convert Entities + extrude 80 mm + Mirror + 6 boundary + Knit es UNA idea: extender el lazo de partición hasta el bounding box del bloque. → *Ruled/offset surface desde la cadena del patrón 1 hacia el rectángulo del bloque, cosida con `sewing` de OCCT.*

6. **Receta de bolsillo estándar.** Siempre idéntica: draft 5° en paredes + R20 esquinas verticales + R4 piso + chamfer 10×45 base. → *`pocketFinish(placa, {draft:5, rCorner:20, rFloor:4, chamfer:10})` clasificando aristas por orientación (vertical/lazo de piso) sobre `filletAllEdgesResilient`.*

7. **Patrón de guía en 4 esquinas.** Círculos a ±(W/2−margen), espejeados, counterbore de catálogo (pin Ø35/caja Ø40×8; bushing Ø48/caja Ø54×10). → *`guidePinPattern(placa, sku)` con los SKUs DIN que ya tenemos; 4 counterbores simétricos en una llamada.*

8. **Gate de partición completa.** SolidWorks valida con el mensaje verde "the mold can be separated"; el usuario lo persigue a ciegas. → *Invariante en `forja-gate`: lazo cerrado + cavity∪core = bloque + volumen de impronta = volumen de pieza escalada (nuestro estilo verification-first).*

---

## 4. QUÉ AUTOMATIZAR PRIMERO

**La partición no plana automática: micro-patrones 1 + 5 juntos** (cadena de partición por transición de draft → falda hasta el bloque → split del bloque con esa superficie).

Razones:

- **Es el cuello de botella real de los 3 cursos.** Picar 87 aristas y coser 47 superficies es donde se va el tiempo humano y donde se meten los errores (el propio tutorial muestra `**Error** Edge<1>` y lazos que no cierran). Es exactamente el trabajo que un kernel hace mejor que un humano.
- **Desbloquea todo lo demás.** `splitMoldByPlane` nos limita a piezas de partición plana; el gancho y el peine (los casos de los cursos) requieren partición quebrada/curva. Sin esto, Tooling Split real, shut-offs y el molde familia quedan detrás de la misma puerta.
- **Ya tenemos las dos mitades del puente.** El análisis de draft (clasificación de caras) existe, y el split booleano existe; falta solo el eslabón geométrico entre ambos: cadena de aristas → superficie reglada → corte.
- **Es verificable con invariantes duras** (patrón 8): lazo cerrado, conservación de volumen, cavity+core = bloque. Encaja directo en `forja-gate.cjs` sin depender de ojo humano.

Segundo lugar: **shut-offs de barrenos pasantes (patrón 4)** — es chico, determinista, y es lo primero que rompe la partición en cuanto la pieza tiene un hoyo. Tercero: **la operación Draft de modelado** (envolver `BRepOffsetAPI_DraftAngle`), porque hoy podemos *diagnosticar* falta de salida pero no *corregirla*, y es la única feature del pipeline que el kernel no puede expresar de ninguna forma.