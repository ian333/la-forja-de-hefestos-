# Plan Maestro — La Forja: CAD/CAM generativo por clicks para LATAM

> Fundado en 3 libros comprados (Fusion 360 *Tutorial Approach*, Advanced SOLIDWORKS 2026, Cimo *CAM Journey*) + recon **verificado contra el binario** del kernel.
> Sub-planes completos: `planes/PLAN-2-molde-solidworks.md`, `planes/PLAN-3-cam.md`. Evidencia cruda: `planes/EVIDENCIA-*.json`.
> Fecha: 2026-06-30. Regla del proyecto: **"compila" ≠ "funciona"; ver con el ojo.** Cero hype.

---

## 0. TL;DR — el diagnóstico cambió

**El kernel NO es el problema.** `occt.ts` (1611 líneas) ya tiene extrude/revolve/loft/sweep (B-spline C2 real), fillet/chamfer/shell, patrones, booleanas, STEP I/O, normales por cara, masa/inercia, FEA von Mises, planos HLR (`drawing.ts`), generativo (`topopt.ts`). El recon **abrió el `.wasm` de opencascade.js** y confirmó que las clases del molde (`gp_Trsf::SetScale`, `BRepOffsetAPI_DraftAngle`, `BRepAlgoAPI_Splitter/Section`, `MakeFilling`…) **ya están compiladas adentro**.

Entonces "estamos al 1/100" se recalibra: no falta el motor, faltan **dos capas de UX por clicks**:
1. **El croquis** — el solver ya es bueno (14 restricciones, *fully-defined* real), pero al **editor** le falta lo que hace que "se sienta vivo" (auto-inferencia, cotas, trim/offset/mirror).
2. **El molde** — el botón "Cavidad" hace el negativo pero **no abre el molde** (no separa macho/hembra). El resto es **cablear** OCCT que ya está.

**El CAM (maquinado) sí es hueco real (~0.5/10)** — pero va después (orden del user: diseño primero).

---

## 1. Misión y reglas duras

- **Democratizar CAD/CAM en LATAM**: navegador, español mexicano, **gratis o ultra-barato**. Nadie aquí paga miles de USD de licencia Fusion/SolidWorks.
- **El molde de plástico es el EVALUADOR**, no el producto. Si no sale por **clicks/comandos/planos**, el sistema no sirve. Nada de hardcodear la pieza.
- **Orden duro del user:** DISEÑO primero (hacer la pieza) → molde (evaluador) → maquinado (CAM) después.
- **Reutilizar open-source LIBRE** (MIT/BSD/Apache/Boost/LGPL); construir solo el hueco. **Cero AGPL/GPL embebido** (La Forja es SaaS = servir el JS es distribución).
- **Diferenciador:** diseño generativo (topopt) + IA que maneja la UI + precio. El "wow" emerge de la corrección.

---

## 2. Estado REAL vs el flujo (gap honesto)

| Capa | Estado | Detalle |
|---|---|---|
| **Kernel B-Rep** | ✅ ~7/10 | occt.ts completo; todas las ops de modelado y las del molde ya en el `.wasm` |
| **Croquis (solver)** | ✅ Bueno | LM, 14 restricciones, residuales cerrados, *fully-defined* real (DOF por espacio nulo del Jacobiano) |
| **Croquis (editor)** | ⚠️ A medias | dibuja line/rect/circle/arc/point; **falta** auto-inferencia, cotas diám/ángulo, trim/offset/mirror, 4 restricciones huérfanas sin botón, multi-lazo |
| **Features (modelado)** | ✅ Existen | extrude/revolve/loft/sweep/fillet/chamfer/shell/pattern/hole corren; **falta** estabilizar puente croquis→feature, sketch-on-face, Selected Contours |
| **Molde** | ⚠️ Cerca | "Cavidad" (`subtractFrom`) = bloque−pieza; **falta** draft analysis, scale, parting line/surface, tooling split (separar core/cavity) |
| **Shell de UI (Ribbon/árbol)** | ❌ Roto | toolbar monolítica, sin feature-tree editable, sin ViewCube/marking-menu; el frontend "se traba y no se entiende" |
| **Planos 2D** | ✅ Maduro | drawing.ts HLR real |
| **Generativo** | ✅ Maduro | topopt SIMP+OC + filtro de voladizo AM |
| **FEA** | ✅ Maduro | von Mises real (fea.ts) |
| **CAM (maquinado)** | ❌ ~0.5/10 | solo importa cinemática (.mch); 4 botones de "Fabricación" `disabled`; cero trayectorias, cero G-code |

---

## 3. Reutilización open-source (unificada, licencias verificadas)

| Pieza | Licencia | Browser | Qué nos resuelve | Decisión |
|---|---|---|---|---|
| **opencascade.js** (ya en stack) | LGPL + excepción OCCT | ✅ WASM | Kernel B-Rep; **~90% del molde es CABLEAR** lo ya compilado (SetScale, DraftAngle, Splitter, Section, MakeFilling) | **YA ADOPTADO** — reusar, no sumar dep |
| **planegcs** (`@salusoft89/planegcs`) | LGPL-2.0+ | ✅ WASM | Solver 2D de FreeCAD (set completo + diagnóstico de conflictos) | **EN RADAR** — nuestro solver basta; swap solo si hay muro de escala |
| **Clipper2-WASM** | Boost (BSL-1.0) | ✅ WASM | Offset de polígonos = pasadas CAM, kerf láser, skin/infill | **ADOPTAR** (base 2D del CAM) |
| **manifold** (`manifold-3d`) | Apache-2.0 | ✅ WASM | Booleana robusta garantizada-manifold = red de seguridad del split core/cavity y slicing | **ADOPTAR** (fallback CSG) |
| **three-bvh-csg / three-mesh-bvh** | MIT | ✅ R3F nativo | Booleanas/queries en vivo + draft analysis acelerado por BVH | **ADOPTAR** (feedback interactivo) |
| **Kiri:Moto** (grid-apps) | MIT | ✅ JS | Motor CAM completo (fresa 2.5/3D + láser + slicing FDM + G-code + posts) | **ADOPTAR/forkear** en CAM (P3+) |
| **SVGnest / Deepnest** | MIT | ✅ | Nesting de piezas láser | **ADOPTAR** (P3 láser) |
| **gcode-parser / gcode-toolpath** (cncjs) | MIT | ✅ | Parsear/visualizar G-code = gate de verificación | **ADOPTAR** (cierra el lazo) |
| **occt-import-js** (ya en stack) | MIT | ✅ | Importar STEP/IGES → malla | **MANTENER** (importador) |
| `HLRBRep_HLRToShape` | (OCCT) | — | Silueta/parting line exacta | **NO está en el build** → custom `.yml`+rebuild; **diferir**, usar silueta-desde-malla en v1 |
| CuraEngine / PrusaSlicer / jscut / LaserWeb | AGPL/GPL | ✅ | Algoritmos de oro | **DESCARTAR embeber** — solo **minar algoritmos**, nunca código |
| SolveSpace solver | GPLv3 | — | Solver | **DESCARTAR** (copyleft contamina) |

**Regla LGPL dura:** servir el `.wasm` como asset reemplazable vía `locateFile` (ya se hace), nunca inlinearlo.

---

## 4. Roadmap DISEÑO-PRIMERO

> Cada fase: **entregable + evaluador + qué reutilizar/construir + riesgo real**, verificado por sight con `scripts/forja-drive.cjs` (Claude maneja la UI real en iangpu:5001) + `scripts/forja-gate.cjs` (geometría exacta).

### P0 — Croquis sólido *(la prioridad #1 del user; base de TODO)*
**Entregable:** un sketcher que se siente Fusion/SolidWorks: dibujas y la figura crece con auto-relaciones, acotas y queda *fully-defined* (negro), recortas/desfasas/espejeas.

- **Reutilizar:** el solver LM propio (ya bueno) + sus 14 restricciones. (planegcs en radar, no ahora.)
- **Construir (orden por impacto/costo):**
  1. **Exponer las 4 restricciones huérfanas** (`pointOnLine`, `concentric`, `equalRadius`, `tangentLC`) — el solver YA las resuelve, solo falta botón. *Trivial, alto impacto.*
  2. **Auto-inferencia al dibujar** (H/V/coincident/tangent/midpoint al vuelo) + **inferencing lines** + snaps (endpoint/mid/centro/cuadrante/intersección). *Medio — es LO que hace que "se sienta vivo".*
  3. **Sketch Dimension contextual** (deduce lineal/diámetro/radio/angular/aligned) que **maneja** la geometría + re-editar cotas + driven dims al sobre-restringir. *Medio.*
  4. **Trim/extend, Offset, Mirror, Sketch Fillet** + restricciones symmetric/collinear. *Medio.*
  5. **Multi-lazo** (islas/perfiles anidados) para el puente croquis→feature + undo/redo. *Medio.*
- **Riesgo:** bajo-medio (núcleo probado; es capa de interacción). Jacobiano analítico opcional si la perf molesta.
- **Evaluador:** dibujar un croquis cerrado no trivial y dejarlo **fully-defined por clicks**; rumbo a planos de una pieza/edificio estructural. **Verifica:** `forja-drive` dibuja rect+círculo+arco, aplica tangente por clic, VE el azul→negro.

### P1 — Features confiables *(hacer "un tornillo limpio" por clicks)*
**Entregable:** modelar un tornillo de punta a punta por clicks (revolve del perfil + chaflán + cabeza hex por extrude+pattern), exportable a STEP.

- **Reutilizar:** todo el kernel (las features ya existen y corren).
- **Construir:** estabilizar el puente croquis→feature (multi-lazo + **Selected Contours**), **sketch-on-face** + **planos de referencia** (offset/ángulo/midplane — todos *fáciles*), feedback de errores de operación, y **parametrización mínima** (variables globales + ecuaciones dim=f(otras) con `expr-eval` + DAG `toposort`).
- **Riesgo:** bajo en kernel, medio en orquestación (el árbol de features ya tiene suppress/rollback).
- **Evaluador:** el tornillo sale por clicks; `forja-gate` valida topología (Euler), volumen y STEP redondo; un agente compara el render contra un tornillo DIN real (catálogo Weston).

### P2 — MOLDE DE PLÁSTICO por clicks *(EL HITO / EVALUADOR)*
**Entregable:** dada una pieza (modelada o STEP), botones que ejecutan los 8 pasos y entregan **core + cavity separados + STEP + vista explotada.**

| Paso | Reutilizar (OCCT ya en el build) | Construir | Dif. |
|---|---|---|---|
| 1. Pieza con draft | features | OpType `draft` opcional (`BRepOffsetAPI_DraftAngle`) | bajo |
| 2. **Draft Analysis** | `tessellate`+normales (ya existen) | **puro sobre malla:** `asin(n·pull)` → verde/amarillo/rojo en R3F | medio, **sin kernel** |
| 3. **Scale (contracción)** | `gp_Trsf::SetScale` | `scaleShape(shape, f)` ~10 líneas | **trivial** |
| 4. **Shut-off** | `MakeFace`/`Geom_Plane` (plano), `MakeFilling` (curvo) | detectar wires de borde y taparlos | medio-alto |
| 5. **Parting Line** | silueta desde malla (aristas donde `n·pull` cambia signo) | extractor de silueta (HLR exacto **diferido**) | medio |
| 6. **Parting Surface** | `MakeFilling` / radiate | banda de la línea al perímetro del bloque | alto |
| 7. **Tooling Split** | `BRepAlgoAPI_Splitter`/`Section` + `common`/`cut` | **caso plano (~80%):** `core=cut(common(bloque, semiespacio_inf), pieza)`, `cavity=cut(common(bloque, semiespacio_sup), pieza)` con 2 cajas y plano Z | medio (plano) / alto (superficie) |
| 8. Separar + explotar | `makeCompound`, exportSTEP | vista explotada (transform R3F) | bajo |

- **Mínimo a "Mold Tools v1" usable:** Scale (trivial) + Draft Analysis (malla) + **Tooling Split PLANO**. Eso convierte la "Cavidad" monolítica de hoy en **core+cavity separables y exportables**. Generalizar `Component.bool` para restar un **sólido arbitrario** (no solo box/cyl) y >1 cavidad.
- **Fallback robustez:** si el BOP de OCCT revienta → **manifold** (malla→boolean→mesh).
- **Riesgo:** Scale/Draft/Split-plano = bajo-medio (bindings verificados presentes). Parting surface no-plano + shut-off curvo = **alto** (diferir a v2).
- **Evaluador:** `forja-drive` carga un STEP, corre los 8 botones, separa cuerpos y exporta; un agente VE el draft verde/rojo y la **vista explotada core/cavity** contra la figura del cap. 6 (SolidWorks); gate valida `core ∪ cavity ⊇ bloque` y que el hueco = la pieza escalada.

### P3+ — MAQUINADO / CAM *(fase posterior; detalle en `planes/PLAN-3-cam.md`)*
Pipeline universal: **CAD → Setup → Stock → WCS → herramienta → estrategia → trayectoria → simular → post → G-code.** Toda operación = mismo diálogo (Tool/Geometry/Heights/Passes → simular verde → post).
- **P3 Fresado 3-ejes** (prende los 4 botones `disabled`): Setup/Stock/WCS + face/adaptive/contour/drill + post. Reusar **Kiri:Moto** (arranque) **+ Clipper2** (control propio); `enumerateFaces`+`cut`+`sweepProfileAlong` ya sirven para detección/simulación.
- **P4 Torneado 2-ejes** (diferenciador: nadie lo regala en navegador) — perfil de revolución + Clipper2.
- **P5 Láser** (nesting SVGnest + kerf Clipper2) y **P6 Aditivo** (slicing Kiri:Moto) — los más acotados.

### Transversal A — Shell de UI (Ribbon + feature-tree + ViewCube + marking-menu)
El frontend "roto" se arregla con la **estructura de Fusion**: Ribbon con tabs/paneles, SKETCH contextual, árbol de operaciones editable, ViewCube, marking-menu radial, hotkeys (L/R/C/E/F/H/D/T/O/Q/M/J). Es transversal a P0–P2 (sin esto, "todo se traba"). Se ataca incrementalmente junto con P0.

### Transversal B — Generativo → diseño
`topopt.ts` ya produce geometría optimizada; su salida alimenta P1 (pieza a maquinar), P2 (pieza a moldear), P4 (imprimir). **Construir:** puente densityToMesh→B-Rep limpio (riesgo real). Demuestra la tesis "análisis MIENTRAS diseñas".

---

## 5. Decisiones abiertas (requieren al user)

1. **Arranque:** ¿P0 croquis primero (afinar el sketcher, tu prioridad histórica) **o** saltar a P2 molde reusando lo que ya hay (ver el evaluador antes) **o** ambos en paralelo? *(El molde v1 puede usar un STEP importado mientras el croquis madura.)*
2. **Alcance molde v1:** ¿**línea de partición PLANA** (~80% de piezas, barato, Tooling Split por 2 cajas) basta como evaluador entregable, dejando superficie no-plana + shut-off curvo para v2?
3. **planegcs:** recomiendo **después** (solver propio basta; no arregla el hueco del editor). ¿De acuerdo?
4. **Pieza-demo concreta:** "tornillo limpio" (P1) = tornillo DIN del catálogo Weston; molde (P2) = una tapa/carcasa simple con draft. ¿Te sirven o prefieres otras?
5. **Factor de contracción:** ¿tabla por material (ABS ~0.6%, PP ~1.5%…) o variable global editable?
6. **(CAM, para después) Kiri:Moto:** ¿forkear+embeber (semanas) o solo minar algoritmos sobre Clipper2 (control total, más lento)? Recomiendo híbrido.
