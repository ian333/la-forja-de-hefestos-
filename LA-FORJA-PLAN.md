# La Forja — CAD/CAE democratizado para LATAM
**Documento maestro · v1 · 2026-06-01**

> El CAD/CAE mexicano que da gratis a los estudiantes y barato a las empresas lo que Fusion / SolidWorks / Inventor cobran carísimo en dólares. Corre en el navegador; el cómputo pesado vive en nuestro cluster.

---

## 1. La oportunidad: el caso de la democratización

| Suite | Kernel | Precio base (USD/año) | Add-ons de simulación (USD/año c/u) | MXN aprox. |
|---|---|---|---|---|
| **Autodesk Fusion** | ShapeManager (ASM, fork de ACIS 7.0) | ~680 / 85 mensual | Simulation +1,465 · Manufacturing +1,465 | ~12,000–14,000 |
| **Inventor + AutoCAD** | ShapeManager (ASM) | ~2,500 + ~2,000 = **~4,500** | (colecciones caras) | ~80,000+ |
| **SOLIDWORKS** | Parasolid (Siemens) + DCM | ~2,820 (Std) · 4,716 (Premium) | Simulation/Flow/Plastics: miles c/u | ~50,000–85,000 |
| **Onshape** (100% navegador) | Parasolid (Siemens) | 1,500 (Std) · 2,500 (Pro c/FEA) | incluido en Pro | ~27,000–45,000 |

**Lecturas clave:**
- Un asiento SOLIDWORKS Premium + Simulation + Flow rebasa **$10,000–15,000 USD el primer año**. El costo oculto no es el CAD: son las **extensiones de simulación**.
- **Ningún incumbente es dueño de su kernel Y libre de licencia:** Autodesk forkeó ACIS; SOLIDWORKS *le RENTA* Parasolid a su competidor Siemens. **OCCT (LGPL) es el único kernel B-Rep completo sin regalías** — el mismo que usa FreeCAD. Esa es la base de la disrupción: misma familia tecnológica que ASM/Parasolid, costo de licencia = **0**.
- **Onshape es el rival más directo** (navegador, cómputo en servidor), pero su tier gratis es solo para proyectos *públicos*. El gancho de La Forja: **documentos privados gratis para estudiantes.**

**Posicionamiento:** La Forja = "el Onshape de LATAM", con docs privados gratis para estudiantes, barato/mes para emprendedores, per-seat para empresas — corriendo en laptop modesta porque el render es navegador y el cómputo pesado vive en el cluster propio.

---

## 2. Decisión de kernel: **HÍBRIDO**

**B-Rep (OCCT) como kernel PRIMARIO; F-Rep (Hefestos/SDF) DEGRADADO a rol secundario** (orgánico / blends / esculpido / CAD-conversacional-IA).

El paradigma de producto —árbol de features, planos 2D, mates, export STEP— se construye sobre B-Rep/OCCT. El SDF se conserva solo para lo que B-Rep hace mal o caro.

**Honestidad sobre el estado real del repo (corrección importante):**
1. OCCT **ya está embebido, pero solo como VIEWER** (`occt-import-js@0.0.23` en `src/lib/step-import.ts`: `ReadStepFile`/`ReadIgesFile`/`ReadBrepFile` + teselado). **NO** trae las APIs de modelado (`BRepPrimAPI`, `BRepAlgoAPI`, `BRepFilletAPI`) ni `STEPControl_Writer`. → "el kernel ya está" es **cierto para I/O, falso para modelar.** Hay que sustituirlo por **`opencascade.js` completo**. Pero la infra de carga WASM + mapeo a three.js se reúsa.
2. El modelador activo hoy es **F-Rep/SDF** (`sdf-engine.ts`, `RayMarchMesh.tsx`, marching cubes). Excelente para macizos imprimibles/blends, pero **por paradigma** no da geometría exacta con topología → sin STEP real, sin planos HLR limpios, sin GD&T ni mates por cara/eje.
3. El **80% del valor diario** (sketch restringido → extrude/revolve → fillet/shell/hole → patrón → ensamble → plano → STEP) **exige B-Rep exacto**. OCCT es el único B-Rep open-source completo (LGPL).
4. **No B-Rep puro** porque ya hay inversión real en SDF y resuelve barato lo orgánico + el **CAD-conversacional-IA** (diferenciador) que en B-Rep es caro/imposible.

> **🔴 RIESGO #1 — el foso técnico real: TOPOLOGICAL NAMING PROBLEM.** OCCT renumera caras/aristas al recomputar y rompe los features aguas abajo. Es lo que tuvo a FreeCAD roto >10 años hasta la v1.0 (fix de RealThunder/LinkStage). Si no se ataca desde el día 1 con **nombres topológicos persistentes por firma geométrica** (no por índice), el CAD "se rompe solo" al editar una cota. **Este —no el kernel ni el navegador— es el verdadero muro.** (CADmium/build123d/Chili3D ya probaron OCCT-WASM casi-nativo.)

**🔒 Restricción legal dura (preserva el per-seat):** el **cliente** que se descarga al navegador debe ser **solo-LGPL** (OCCT + planegcs + SU2). Los solvers GPL/AGPL (CalculiX, OpenFOAM, Code_Aster) corren **aislados como servicios en el cluster**, nunca enlazados ni distribuidos. SolveSpace (GPL) y Chili3D (AGPL) = **referencia de arquitectura, jamás se embeben.**

---

## 3. Set mínimo viable priorizado

**P0 (el MVP vendible — sketch→sólido→fillet→plano→STEP):**
- Croquizador 2D paramétrico con **solver de restricciones** (coincidente/paralela/perpendicular/tangente/H-V/concéntrica/igual/simétrica + cotas; detección sub/sobre-restricción + DOF) → **portar planegcs** (LGPL, el GCS de FreeCAD en WASM). *Pieza #1 ausente hoy.*
- Extrude/Revolve (boss/cut) sobre B-Rep → `BRepPrimAPI` (requiere opencascade.js completo)
- Booleanas exactas → `BRepAlgoAPI` (reemplaza el CSG/SDF)
- Fillet/Chamfer/Shell → `BRepFilletAPI` + `BRepOffsetAPI` (aplicar **tarde** en el árbol)
- **Árbol de features con history-replay + NAMING TOPOLÓGICO PERSISTENTE** → **CONSTRUIR** (el foso, 50-70% del riesgo)
- Hole + Patrón lineal/circular + Mirror
- Import/Export **STEP·IGES** + STL/glTF → falta cablear `STEPControl_Writer`
- Render del B-Rep teselado (`BRepMesh` → three.js/R3F) → reúsa `ForgeViewport`/`Stage`

**P1 (producto, no solo pieza):** Ensambles + mates (cara-cara, eje-eje, distancia, ángulo) + DOF · Planos 2D acotados vía **HLR** de OCCT · **FEA estática lineal** (CalculiX + Gmsh en cluster: von Mises/desplazamiento/FoS).

**P2:** Sheet metal · Sweep/Loft · Térmico/modal/CFD (SU2) · GD&T · familias/ecuaciones · PDM/colaboración · CAM 2.5/3 ejes · CAD conversacional IA.

**❌ FUERA de roadmap:** Superficie clase-A / NURBS / T-splines (OCCT no las soporta; es el muro CATIA/Alias y NO es donde está el 80% del valor mecánico).

---

## 4. Reúso open-source (todo maduro, sin licenciar kernel propietario)

- **OCCT** (LGPL) — kernel B-Rep: promover de viewer a modelador (`opencascade.js` completo). El de FreeCAD.
- **planegcs** (`@salusoft89/planegcs`, LGPL, WASM) — solver de restricciones 2D del sketcher. El GCS de FreeCAD.
- **CalculiX** (GPL) — FEA por defecto. **Aislado en cluster.**
- **SU2** (LGPL) — CFD (preferido por licencia). **OpenFOAM** (GPL) solo aislado si se requiere multifase.
- **Gmsh / Netgen** — mallado FEM tet.
- **three.js / R3F / drei** — YA en el repo; reúsa todo el pipeline de viewport + grade cinematográfico, cambiando solo la fuente de geometría.
- **CONSTRUIR (no hay reúso directo):** el motor de historia paramétrica con naming topológico, la capa de ensamble/mates (ref. Ondsel), planos 2D sobre HLR, y el CAD conversacional IA.

---

## 5. Arquitectura

```
┌──────────────── NAVEGADOR (cliente, solo-LGPL) ────────────────┐
│ UI React — useForgeStore (árbol de features, documento)         │
│   ├─ Sketcher 2D ─► planegcs (WASM): GCS, DOF, restricciones    │
│   ├─ MOTOR DE HISTORIA ◄─ (CONSTRUIR) ─ NAMING TOPOLÓGICO        │
│   │     grafo de features (replay/rewind) · firma geométrica    │
│   ├─ KERNEL B-Rep: opencascade.js (OCCT-WASM completo)          │
│   │     BRepPrimAPI·AlgoAPI·FilletAPI·OffsetAPI·HLRBRep·STEP W/R │
│   │       ├─ BRepMesh ─► three.js/R3F (ForgeViewport, Stage)     │
│   │       └─ STEPControl_Writer / IGES / glTF / STL             │
│   └─ KERNEL F-Rep (2º): sdf-engine — orgánico/blends/IA ─►(tesela)│
│ Persistencia: documento = grafo de features (no malla). Multi-tenant.│
└────────────────────────────────────────────────────────────────┘
              │ geometría (BREP/STEP) + BCs  (REST/WS, el cliente nunca enlaza GPL)
              ▼
┌──────── CLUSTER PROPIO (RPi/GPU) — servicios aislados ─────────┐
│ Mallado: Gmsh/Netgen  ·  FEA: CalculiX  ·  CFD: SU2/OpenFOAM    │
│ booleanas/teselados pesados off-load · cuotas por tier · VTK→glTF│
└────────────────────────────────────────────────────────────────┘
```
- **El documento es el grafo de features serializado, NO la malla** → archivo ligero, versionable, diff-able (habilita PDM).
- **Naming topológico vive en la capa de historia**, por encima de OCCT (firma geométrica estable, no índice).
- **Frontera de licencia estricta:** navegador = LGPL; GPL/AGPL tras API en el cluster.
- **Multi-tenant** apalanca cuenta/magic-link/Stripe ya presentes.

---

## 6. Roadmap por fases

| Fase | Alcance | Esfuerzo | Desbloquea |
|---|---|---|---|
| **0 — Lo que ya hay** | OCCT-WASM (import), F-Rep activo, useForgeStore, pipeline R3F, joints SDF, blueprint/cross-section, cuenta/Stripe/magic-link | **Hecho** | Base WASM, viewport, store, I/O import, monetización |
| **1 — MVP sólido paramétrico** | opencascade.js completo · portar planegcs + UI sketch · **motor de historia + naming topológico (el foso)** · extrude/revolve/booleanas/fillet/shell/hole/patrón/mirror · teselado→R3F · **export STEP/STL** · planos 2D (HLR) | **~6–10 meses** (1–2 devs; naming = 50-70% del riesgo) | **Producto vendible mínimo:** estudiante hace pieza imprimible/manufacturable real. Funnel videos→tier gratis |
| **2 — Ensambles + FEA básica** | mates + DOF (ref. Ondsel) · FEA estática lineal en cluster (CalculiX+Gmsh) · BOM | **~4–7 meses** | Diseño de PRODUCTO + "carga/calor/estrés". Habilita tier **empresa per-seat** |
| **3 — Superficie + CFD + diferenciadores** | sweep/loft, sheet metal · térmico/modal · CFD (SU2) · GD&T, familias, PDM/colaboración, **CAD conversacional IA** (apalanca F-Rep) | **~6–12 meses** (por demanda) | Paridad de simulación a fracción del precio. CAD-IA = diferenciador único |

---

## 7. Cómo conviven los dos kernels

El F-Rep **NO se tira** — se reposiciona a su nicho real (orgánico, esculpido, blends, lattices, geometría IA, CAD conversacional). Activos vivos: `sdf-engine.ts`, `gpu-cross-section`, `reverse-engineer`, `sketch-fitting`, `RayMarchMesh`, marching cubes.

**Frontera clara:** el flujo de ingeniería de producto (sketch→feature→ensamble→plano→STEP→FEA) vive 100% en **B-Rep** (exacto, topológico, manufacturable). El F-Rep produce formas exploratorias/orgánicas; cuando una pieza SDF entra al flujo de manufactura/simulación, **se tesela/convierte a B-Rep** (shape-healing/sewing de OCCT) y de ahí es sólido B-Rep de primera. **El usuario no elige "kernel": elige operación.** SDF = "modo escultura/IA"; B-Rep = "modo ingeniería".

---

## 8. Veredicto

**Factible para un equipo chico**, apalancando stack open-source maduro, **sin licenciar ningún kernel propietario**. Camino claro a un **MVP vendible en ~6-10 meses**. El riesgo real y bien acotado es el **topological naming problem** (FreeCAD ya demostró que se resuelve). El primer hito atacable HOY: sustituir `occt-import-js` por `opencascade.js` completo y prototipar extrude/revolve + el motor de historia con naming topológico — todo lo demás cuelga de ahí.
