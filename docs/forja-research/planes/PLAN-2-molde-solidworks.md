# Plan Maestro — La Forja: del croquis al molde de plástico por clicks

## 1. Propósito

Llevar a La Forja de "kernel fuerte / UI a medias" a un CAD de navegador donde un usuario LATAM modela una pieza por clicks (croquis → features) y la valida produciendo un **molde de plástico real (core + cavity)** sin tocar código. Orden duro: **primero la pieza, luego el molde; el CAM es fase posterior.** Honestidad: hoy estamos ~1/100 — aún no sale un tornillo limpio por clicks.

## 2. El flujo de diseño universal (destilado de Advanced SOLIDWORKS 2026)

- **Croquis 2D** — dibujar perfil en un plano (line/rect/circle/arc/spline).
- **Relaciones + cotas** — restringir (H/V/coincident/tangent/symmetric) y acotar (lineal/diámetro/angular) hasta *fully-defined*.
- **Features sólidas** — extrude / revolve / loft / sweep como base; luego cut/hole/fillet/chamfer/shell.
- **Parametrización** — ecuaciones, variables globales, configuraciones, design tables, library features.
- **Patrones** — lineal / circular / espejo de features o croquis.
- **Superficies** — extrude/revolve/loft/boundary/fill/radiate → trim → knit → thicken (forma compleja y materia prima del molde).
- **Ensamble** — insertar partes + mates (concentric/coincident/distance) + motion study.
- **Planos** — vistas ortográficas (HLR), cotas, cajetín, cut list/BOM.

El **molde** (cap. 6) es un sub-pipeline aguas abajo del sólido: **Draft Analysis → Scale (contracción) → Shut-off → Parting Line → Parting Surface → Tooling Split → separar cuerpos → ensamble + vista explotada.**

## 3. La Forja HOY vs ese flujo (gap honesto)

### Croquis (`sketch-solver.ts` + `SketchEditor.tsx`)
**Tenemos:** line/rect/circle/arc/point por clicks con drag-to-draw; solver LM (Levenberg-Marquardt) con **14 restricciones** y residuales cerrados; **fully-defined real** (DOF por entidad vía espacio nulo del Jacobiano, azul→blanco a paridad de Fusion); muy probado por invariantes + hook `window.__sketchEditor`.

**Falta (y es donde se *siente* incompleto — el hueco es el EDITOR, no el solver):**
- 4 restricciones **huérfanas** (el solver YA las resuelve, no tienen botón): `pointOnLine`, `concentric`, `equalRadius`, `tangentLC`. **Arreglo baratísimo.**
- **Cero auto-inferencia** de relaciones al dibujar (lo que hace que SolidWorks "se sienta vivo"): no detecta H/V/coincident/tangent/midpoint al vuelo. Único auto: H/V del rectángulo.
- Cotas: solo distancia euclidiana y radio. **Faltan diámetro, angular, H/V proyectada**, y re-editar cotas ya puestas.
- **Faltan trim/extend, offset, mirror, fillet/chamfer de croquis, pattern de croquis**; sin undo/redo.
- Geometría faltante: elipse, spline/bézier, polígono, slot.
- Integración con sólido asume **un solo lazo cerrado simple** (islas/perfiles múltiples lo confunden).

### Features + molde (`occt.ts` + `ForgeBRepStudio.tsx`)
**Tenemos (kernel OCCT, 1611 líneas, completo):** extrude/revolve/loft/sweep (B-spline C2 real), hole, fillet/chamfer, shell, patrón (lineal/circular/espejo), booleanas fuse/cut/common, transform/mirror/compound, STEP import/export, `enumerateFaces` (con normal en planos), `tessellate` (faceIds), massProperties, `drawing.ts` (planos HLR real), `topopt.ts` (generativo), `fea.ts` (von Mises real). El botón **"Cavidad" (`subtractFrom`)** ya da el negativo de la pieza dentro de un bloque.

**Falta para "tornillo limpio" y molde:**
- Ningún OpType `draft`/`scale`/`parting`/`mold`/`split` (grep = 0 matches: cero `SetScale`, `DraftAngle`, `Splitter`, `parting`).
- El "Cavidad" es **monolítico**: hace el negativo pero **NO abre el molde** (no separa macho/hembra); el componente restable es solo box/cyl; el acumulador `acc` lineal es frágil con >1 cavidad.
- Sin Draft Analysis, Shut-off, Parting Line/Surface, Tooling Split real.

## 4. Reutilización open-source

| Pieza | Licencia | Browser | Qué nos resuelve | Decisión |
|---|---|---|---|---|
| **opencascade.js 1.1.1** (kernel actual, .wasm 65 MB) | LGPL-2.1 c/excepción | Sí | B-Rep completo; **verificado en el binario**: `BRepOffsetAPI_DraftAngle`, `gp_Trsf::SetScale`, `BRepBuilderAPI_GTransform` (escala anisotrópica), `MakeFilling`, `GeomPlate_BuildPlateSurface`, `Geom_Plane`, `MakeFace`, `MakeThickSolid`, `MakeOffset`, **`BRepAlgoAPI_Splitter`/`Section`**, `Defeaturing`, `SplitShape`, `Proj_Projection`, `UnifySameDomain` | **ADOPTAR** — ~90% del molde es CABLEADO, no dependencia nueva |
| **planegcs** (`@salusoft89/planegcs`) | LGPL-2.0+ | Sí (WASM) | Solver 2D de FreeCAD: set COMPLETO de restricciones (symmetric, ángulo, point-on-object) + DogLeg/LM/BFGS + diagnóstico de redundantes/conflictivas | **ADOPTAR en radar** — no urgente; nuestro solver basta para croquis chicos/medios. Swap solo si llega muro de escala o se quiere el diagnóstico de conflictos |
| **manifold** (`manifold-3d`) | Apache-2.0 | Sí (WASM) | Boolean garantizado-manifold sobre malla; **red de seguridad** cuando el BOP de OCCT revienta por geometría sucia en el split core/cavity | **ADOPTAR como fallback** — no reemplaza B-Rep (sin NURBS/STEP) |
| **occt-import-js** | MIT | Sí | Importar STEP/IGES→malla (ingesta de catálogo/cliente) | **MANTENER** solo como importador |
| **HLRBRep_HLRToShape** | (parte de OCCT) | — | Extractor de aristas HLR (parting line por silueta exacta) | **NO está en el build** (verificado: `strings` exact=0). Está whitelisted → ampliable con custom `.yml` + rebuild. **Diferir**: mientras tanto, silueta-desde-malla |
| **SolveSpace solver** | GPLv3 | con esfuerzo | Solver robusto | **DESCARTAR** — GPLv3 contamina el producto |

**Condición LGPL (dura):** servir el `.wasm` como asset reemplazable con su URL (ya se hace vía `locateFile` en `occt.ts`), nunca inlinearlo. Cero riesgo viral en todo el set (LGPL/MIT/Apache).

**Alternativa más barata que planegcs para perf:** Jacobiano **analítico** en el solver propio (residuales polinómicos → derivadas cerradas triviales), elimina el cuello de las diferencias centradas (`2·n·m` evals/iter) sin dependencia externa.

## 5–6. Roadmap diseño-primero (con qué reutilizar / construir, riesgo y verificación drive-by-sight)

> Harness de verificación: `scripts/forja-drive.cjs` (Claude maneja la UI real en iangpu:5001 por screenshots) + `scripts/forja-gate.cjs` (kernel+FEA+croquis+planos+e2e) + hooks `window.__sketchEditor` / `forja.op`. Regla del proyecto: **"compila" ≠ "funciona"; ver con el ojo.**

### P0 — Croquis sólido *(base de TODO)*
**Entregable:** sketcher que se siente SolidWorks: auto-inferencia + cotas completas + trim/offset/mirror + fully-defined.

- **REUTILIZAR:** el solver LM propio (ya bueno) + sus 14 restricciones. Opcional: planegcs si crecen los croquis.
- **CONSTRUIR (orden por impacto/costo):**
  1. Exponer las **4 restricciones huérfanas** (botón/gesto). *Trivial, alto impacto.*
  2. **Auto-inferencia** al dibujar (H/V/coincident/tangent/midpoint al vuelo) + snap a líneas/midpoints/cuadrantes/intersecciones. *Medio — es lo más "SolidWorks".*
  3. Cotas **diámetro + angular + H/V proyectada**, y re-edición de cotas. *Medio.*
  4. **trim / offset / mirror** + restricciones symmetric/midpoint; undo/redo. *Medio.*
  5. Integración multi-lazo (islas anidadas, perfiles múltiples). *Medio.*
- **Riesgo:** bajo-medio (núcleo probado; trabajo de capa de interacción). Jacobiano analítico opcional si la perf molesta.
- **VERIFICA:** `forja-drive` dibuja rect+círculo+arco, aplica tangente por clic, ve estado verde *fully-defined*; familia `sketch-fit-*` por geometría exacta; un agente VE el azul→blanco.

### P1 — Features confiables por clicks *(hacer "un tornillo limpio")*
**Entregable:** modelar un tornillo (revolve del perfil + rosca/chaflán + cabeza hexagonal por extrude+pattern) de punta a punta por clicks, exportable a STEP.

- **REUTILIZAR:** todo el kernel (extrude/revolve/loft/sweep/fillet/chamfer/shell/pattern/hole ya existen y corren).
- **CONSTRUIR:** estabilizar el puente croquis→feature (P0.5 multi-lazo), `Selected Contours` (extruir un contorno específico de un croquis multi-lazo), feedback de errores de operación, y la **parametrización mínima** (variables globales + ecuaciones dim=f(otras) con `mathjs`/`expr-eval` + DAG `toposort` para orden de resolución).
- **Riesgo:** bajo en kernel, medio en orquestación (árbol de features ya tiene suppress/rollback/bindings).
- **VERIFICA:** `forja-drive` produce el tornillo y `forja-gate` valida topología (Euler), volumen y STEP redondo; un agente compara el render contra un tornillo DIN real.

### P2 — MOLDE DE PLÁSTICO por clicks *(EL HITO / EVALUADOR)*
**Entregable:** dada una pieza (modelada o STEP del cliente), botones que ejecutan los 8 pasos y entregan **core + cavity separados + STEP + vista explotada.**

Mapeo paso a paso (REUTILIZAR vs CONSTRUIR):

| Paso | Reutilizar (OCCT en el build) | Construir | Dif./Riesgo |
|---|---|---|---|
| 1. Pieza con draft | extrude/revolve + features | OpType `draft` opcional vía `BRepOffsetAPI_DraftAngle` | bajo |
| 2. **Draft Analysis** | `tessellate`+normales (ya existen) | **PURO sobre malla**: `asin(normal·pull)` por cara → verde/amarillo/rojo en R3F (como `drawing.ts`) | medio, **sin kernel** |
| 3. **Scale (contracción)** | `gp_Trsf::SetScale` (uniforme) / `BRepBuilderAPI_GTransform` (anisotrópico) | `scaleShape(shape, factor)` ~10 líneas | **trivial** |
| 4. **Shut-off** | `BRepBuilderAPI_MakeFace`/`Geom_Plane` (plano), `MakeFilling`/`GeomPlate` (curvo) | detectar wires de borde y taparlos | medio-alto |
| 5. **Parting Line** | silueta desde malla (faceIds+normales: aristas donde `n·pull` cambia de signo) | extractor de silueta; HLR exacto **diferido** (falta `HLRToShape`) | medio (planar fácil, no-planar duro) |
| 6. **Parting Surface** | `MakeFilling` / radiate (extruir cada arista ⟂pull) | banda desde parting line al perímetro | alto |
| 7. **Tooling Split** | **`BRepAlgoAPI_Splitter`/`Section`** + `common`/`cut` + `Defeaturing` + `UnifySameDomain` | **caso planar (~80%):** `core=cut(common(bloque, semiespacio_inf), pieza)`, `cavity=cut(common(bloque, semiespacio_sup), pieza)` con 2 boxes y plano Z elegido | medio (planar) / alto (superficie) |
| 8. Separar + explotar | `makeCompound`, exportSTEP | vista explotada (transform R3F) | bajo |

- **Camino mínimo a "Mold Tools v1" usable:** Scale (trivial) + Draft Analysis (malla, puro) + **Tooling Split PLANAR** (orquestación con `common`/`cut` + 2 boxes). Eso convierte la "Cavidad" monolítica de hoy en **core+cavity separables y exportables**. Generalizar `Component.bool` para restar un **sólido arbitrario** (no solo box/cyl) y soportar >1 cavidad no-lineal.
- **Fallback de robustez:** si el BOP de OCCT revienta → mandar a **manifold** (malla→boolean→mesh).
- **Riesgo:** Scale/Draft/Split-planar = **bajo-medio** (todo el binding verificado presente). Parting surface no-planar + shut-off curvo = **alto** (diferir a v2).
- **VERIFICA:** `forja-drive` carga un STEP, corre los 8 botones, separa cuerpos y exporta; un agente VE el draft verde/rojo y la **vista explotada core/cavity** contra la figura del cap. 6; gate valida que `core ∪ cavity ⊇ bloque` y que el hueco = forma de la pieza escalada.

### P3+ — Fase posterior *(solo bosquejo)*
- **Superficies avanzadas** (boundary/fill/trim/knit/thicken) para piezas orgánicas y parting surfaces no-planares — reusa `MakeFilling`/`GeomPlate`/`Sewing` ya en el build.
- **Chapa** (base flange, flat pattern, K-factor, unfold/fold) — `bendAllowance` es función pura testeable; referencia FreeCAD SheetMetal Workbench (mismo OCCT).
- **Generativo alimentando** (`topopt.ts` ya existe) → meter resultado al flujo de pieza.
- **Inserts, ecuaciones/design tables** para moldes multi-cavidad (catálogo por filas).
- **MAQUINADO/CAM (torno/fresa)** — **análisis aparte**, NO en este plan (orden del user).

## 7. Decisiones abiertas que requieren al user

1. **planegcs ¿ya o después?** Recomendación: **después** (solver propio basta; planegcs no arregla el hueco del editor). ¿De acuerdo en invertir primero en editor + Jacobiano analítico?
2. **Custom build de OCCT para HLR exacto** (`HLRBRep_HLRToShape`): requiere `.yml` + rebuild emscripten en CI. ¿Lo agendamos para parting line no-planar, o vivimos con silueta-desde-malla en v1?
3. **Alcance de P2 v1:** ¿basta con **línea de partición PLANA** (~80% de piezas, Tooling Split por 2 boxes) como evaluador entregable, dejando superficie no-planar + shut-off curvo para v2?
4. **Pieza-objetivo del "tornillo limpio" (P1)** y **pieza-demo del molde (P2)**: ¿qué SKU concreto? (sugerencia: tornillo DIN del catálogo Weston + una tapa/carcasa simple con draft para el molde).
5. **Factor de contracción por material:** ¿hardcodeamos una tabla (ABS ~0.6%, PP ~1.5%…) o lo dejamos como variable global editable por el usuario?
6. **Parametrización (ecuaciones/configs/design tables):** ¿entra en P1 o se difiere? Es transversal pero no bloquea el molde.