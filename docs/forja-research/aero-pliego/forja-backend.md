# EL BACKEND REAL DE LA FORJA — lo que hay, medido en el código

> Auditoría de código para el módulo **AERO** (aerodinámica + diseño de aeronaves + escuela).
> Regla de esta auditoría: **se reporta lo que el código HACE, no lo que los docs dicen.**
> Donde doc y código no coinciden, está marcado con ⚠️.
> Verificado corriendo `npx vitest run` el 2026-08-04: **67 archivos / 1197 tests, todos verdes, 21 s.**

---

## 0. Resumen para el que va a construir

| Pregunta | Respuesta corta |
|---|---|
| ¿Hay backend? | **NO.** Todo es un SPA estático multi-página de Vite + nginx. Hay UN servicio ajeno (telemetría) y UNA API de cuentas/pagos externa. Nada de cómputo servidor. |
| ¿El kernel me puede dar la PIEL de la pieza (paneles con normal y área)? | **Sí, casi.** `tessellate()` da triángulos + normales **por vértice** + `faceIds` por triángulo. La **normal por triángulo y el área por triángulo hay que calcularlas tú** (una cruz vectorial; el patrón ya existe copiable en `dfm-mesh.ts`). |
| ¿Me puede dar superficie de referencia, alargamiento, cuerda media del ala? | **NO existe nada de eso.** Hay volumen, área total, centroide, inercia y AABB. Todo lo aeronáutico (S_ref, AR, MAC, envergadura, diedro, flecha) **se construye de cero**. |
| ¿Ya hay física aero? | **Sí y es buena**: `src/aero/` (ISA, Joukowski potencial, cuña de Anderson) — 25 tests contra números publicados. Más `src/forja/sim/viento.ts` (7 tests). **32/32 verdes.** |
| ¿Ya hay un "Estudio Viento" en el CAD? | **Sí, un v0 que funciona pero es una maqueta**: deriva el semiángulo del **bounding box**, no de la geometría. Ver §5. |
| ¿Cuál es el patrón a copiar para el ESTUDIO VIENTO real? | El FEA: `fea.ts` (solver puro) + `ForgeBRepStudio.tsx` (UI, picking, pintado). Descrito paso a paso en §4. |
| ¿Puedo servir tablas/polares/base de perfiles precomputadas? | **Sí, trivialmente.** `public/precomputed/` ya sirve **472 MB** de `.bin`/`.json` estáticos con `location /precomputed/` propio en nginx. Es el camino. |
| ¿Aero está en el gate? | ⚠️ **NO.** `scripts/forja-gate.cjs` corre 67 suites y **ninguna toca `src/aero/`**. Ver §8. |

---

## 1. Mapa de archivos y responsabilidades

### 1.1 Kernel geométrico (OCCT-WASM)

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `/home/ian/Orkesta/la-forja/src/forja/brep/occt.ts` | 84 KB (~1980) | **EL kernel.** Envoltura tipada de `opencascade.js` (embind). Init singleton, primitivas, features, booleanos, teselado, medición, STEP I/O. |
| `/home/ian/Orkesta/la-forja/public/occt-import-js.wasm` | 7.3 MB | WASM auxiliar de importación. El WASM grande de OCCT (~66 MB) llega por `import` dinámico del paquete npm; `vite.config.ts` lo excluye de `optimizeDeps` y lo trata como asset. |
| `/home/ian/Orkesta/la-forja/src/forja/brep/fea.ts` | 51 KB (~1180) | **El solver FEA** (voxel→tet4→CG sparse→von Mises) + colores por vértice. Modelo a imitar. |
| `/home/ian/Orkesta/la-forja/src/lib/formulas.ts` | — | Motor elástico base: `tet4Element`, `elasticityMatrix3D`, `vonMisesStress`, `principalStresses`, `MATERIAL_DATABASE`. |
| `/home/ian/Orkesta/la-forja/src/forja/brep/ForgeBRepStudio.tsx` | **537 KB (~8700 líneas)** | ⚠️ El monolito de la UI del CAD. Viewport, paneles, picking, TODOS los estudios, el API de agente. Ver §9 (deuda). |
| `/home/ian/Orkesta/la-forja/src/forja/brep/sketch-solver.ts` | 18 KB | Solver de restricciones 2D (DOF, Levenberg-Marquardt). |
| `/home/ian/Orkesta/la-forja/src/forja/brep/drawing.ts` | 29 KB | Motor de planos 2D (HLR). |
| `/home/ian/Orkesta/la-forja/src/forja/brep/topopt.ts` | 19 KB | Optimización topológica SIMP (diseño generativo). |
| `/home/ian/Orkesta/la-forja/src/forja/campo/campo.ts` | — | **Sustrato único de simulación**: `Campo3`/`CampoVec3` + `grad`/`div`/`lap`/`sample` + operador 𝔄 de difusión, verificados contra analítica. Nació para sustituir las 7 rejillas artesanales del repo (incluida `viento`). **Candidato natural para el campo de flujo de aero.** |

### 1.2 Física aeronáutica que ya existe

| Archivo | Tests | Qué hace |
|---|---|---|
| `/home/ian/Orkesta/la-forja/src/aero/atmosfera.ts` | 8 ✓ | ISA 0–20 km (troposfera lineal + estratosfera isoterma). `atmosferaISA(h)→{T,p,rho,aSonido}`, `presionDinamica(h,v)`, `mach(h,v)`. Constantes ISO 2533 exactas. |
| `/home/ian/Orkesta/la-forja/src/aero/potencial.ts` | 9 ✓ | **Flujo potencial de Joukowski completo**: mapeo `z=ζ+a²/ζ`, inversa, `flowVelocity`, condición de Kutta, `kuttaGamma`, `liftCoefficient`, `cpValue`, RK4 de líneas de corriente y de parcelas, `circulationIntegral` (verificador de Stokes), `nacaProfile(t,n)` (NACA 00xx), `cpToColor`. |
| `/home/ian/Orkesta/la-forja/src/aero/cuna-anderson.ts` | 8 ✓ | Ejemplo 1.1 de Anderson por integración de paneles + `betaChoqueOblicuo(M,θ)` (relación θ-β-M, rama débil, por bisección). |
| `/home/ian/Orkesta/la-forja/src/forja/sim/viento.ts` | 7 ✓ | **Estudio Viento v0**: `estudioVientoSupersonico({delta,cuerdaM,mach,hM,nPaneles})`. Combina ISA + choque oblicuo + integral de paneles. |
| `/home/ian/Orkesta/la-forja/src/physics/modules/fluids/Aerodynamics.tsx` | — | Lab R3F de aerodinámica (26 KB). |
| `/home/ian/Orkesta/la-forja/src/physics/modules/fluids/AeroAtmosfera.tsx` | — | Lab de la ISA, expone `window.__aeroLab`. |
| `/home/ian/Orkesta/la-forja/src/physics/modules/fluids/AeroFuerzas.tsx` | — | Lab de fuerzas, expone `window.__aeroLab`. |
| `/home/ian/Orkesta/la-forja/src/physics/modules/fluids/NavierStokes2D.tsx` | — | Navier-Stokes 2D (39 KB) — solver de fluido existente, 2D. |
| `/home/ian/Orkesta/la-forja/src/physics/modules/fluids/SPH.tsx` | — | SPH (25 KB). |

### 1.3 Escuela y comandos

| Archivo | Responsabilidad |
|---|---|
| `/home/ian/Orkesta/la-forja/src/forja/commands/registry.ts` | **El bus `ui.run`.** 57 comandos en 12 dominios. |
| `/home/ian/Orkesta/la-forja/public/escuela/lecciones/*.json` | 65 lecciones (2 de ellas AERO: `a1-l1.json`, `a1-l4.json`). |
| `/home/ian/Orkesta/la-forja/src/escuela/mecanica/TutorialOverlay.tsx` | **Ejecutor en navegador** (modo GUÍA interactivo + modo REPRODUCIR). |
| `/home/ian/Orkesta/la-forja/scripts/escuela/clase-drive.cjs` | **Ejecutor Playwright** (graba la clase en video, corre los checks). |
| `/home/ian/Orkesta/la-forja/src/escuela/EscuelaPortal.tsx` | Portal de la escuela (51 KB). |
| `/home/ian/Orkesta/la-forja/scripts/forja-gate.cjs` | El portero maestro: 67 suites. |

---

## 2. EL KERNEL: contrato de datos para un solver aerodinámico

Esta es la sección crítica. **Qué SÍ y qué NO puede medir el kernel HOY.**

### 2.1 Lo que SÍ da, tal cual, sin escribir código

#### La malla de superficie — `tessellate(oc, shape, deflection, angle)`

```ts
export interface TessellatedMesh {
  positions: Float32Array;   // xyz por vértice (3·N) — MILÍMETROS
  normals:   Float32Array;   // xyz por vértice (3·N) — unitarias, área-ponderadas
  indices:   Uint32Array;    // 3 índices por triángulo
  vertexCount: number;
  triangleCount: number;
  faceIds:   Uint32Array;    // faceId POR TRIÁNGULO (len = triangleCount)
  faceGroups: Array<{ faceId: number; start: number; count: number }>;
}
```

**Esto es el 80 % de lo que un método de paneles necesita.** `faceIds` mapea cada triángulo a la
cara B-Rep estable, así que puedes segmentar la piel por cara (extradós / intradós / borde de
salida) sin heurística.

⚠️ **Gotcha ya pagado y documentado en el código**: `BRepMesh_IncrementalMesh` es *incremental*.
Si la forma ya trae malla pegada (y la trae en cuanto pasó por un fillet o un booleano), **ignora
en silencio la deflexión que pides**. `tessellate()` ya limpia la triangulación previa — pero si
escribes tu propio teselado, este bug te va a morder.

#### Medición exacta (integración geométrica, NO por malla)

| Función | Firma | Unidades | Devuelve |
|---|---|---|---|
| `volume` | `(oc, shape) → number` | mm³ | Volumen exacto (`BRepGProp::VolumeProperties`) |
| `surfaceArea` | `(oc, shape) → number` | mm² | Área total exacta |
| `massProperties` | `(oc, shape, density) → MassProperties` | mm/g | ver abajo |
| `topology` | `(oc, shape) → {faces,edges,vertices,euler}` | — | Conteos + Euler V−E+F |

```ts
export interface MassProperties {
  volume: number;                       // mm³
  mass: number;                         // g  (= volumen · densidad[g/mm³])
  centerOfMass: [number, number, number];  // mm
  inertia: [[number,number,number],[number,number,number],[number,number,number]]; // g·mm², EN EL CENTRO DE MASA
  principal: [number, number, number];  // momentos principales, g·mm²
}
```

El tensor de inercia ya viene trasladado al centro de masa (teorema de ejes paralelos) y los
momentos principales salen por forma cerrada de Smith. **Para masa y balance de una aeronave esto
es directamente utilizable.**

#### Enumeración de caras y aristas

```ts
export interface FaceRef {
  index: number;                        // ÍNDICE ESTABLE (== faceIds del teselado)
  kind: string;                         // 'plane'|'cylinder'|'cone'|'sphere'|'other'
  area: number;                         // mm² — área EXACTA de la cara
  center: [number, number, number];     // centroide, mm
  normal: [number, number, number];     // ⚠️ SOLO planos; [0,0,0] si no aplica
}

export interface EdgeGeom {
  edgeId: number;
  kind: string;                         // 'line'|'circle'|'other'
  length: number;
  polyline: Array<[number, number, number]>;  // discretización exacta de la curva
  mid: [number, number, number];
  axis?: { origin: [number,number,number]; dir: [number,number,number] };  // solo rectas
}
```

`enumerateEdgesGeom(oc, shape, segments)` te da **la curva discretizada de cualquier arista**. Para
aero esto sirve directo para extraer el **borde de ataque y el borde de salida** como polilíneas.

#### Operaciones de construcción disponibles

Extrude (`extrudePolygon`, `extrudePolygonWithHoles`, `extrudeCircle`, **`extrudeSpline`**),
**`revolvePolygon`**, **`loftSections`** (crítico para alas: perfil raíz → perfil punta),
**`sweepProfileAlong` / `sweepProfilePipeShell`**, booleanos (`fuse`/`cut`/`common`/`fuseAll`),
`filletEdges`/`filletAllEdgesResilient`/`chamferEdges`, `shellSolid`, `draftFaces`, `drillHole`,
`transformShape`/`scaleShape`/`mirrorShape`, `makeTriFace`+`sewFaces`+`solidFromShell`
(construir un sólido desde triángulos crudos), `exportSTEP`/`importSTEP`.

> **`loftSections` + `mirrorShape` + `sewFaces` = un ala paramétrica es construible HOY** sin tocar
> el kernel.

### 2.2 Lo que NO da — hay que construirlo

| Falta | Costo | Cómo |
|---|---|---|
| **Normal y área POR TRIÁNGULO** | Trivial (~15 líneas) | Cruz vectorial de los dos bordes: `n = (b−a)×(c−a)`, `area = ‖n‖/2`, `n̂ = n/‖n‖`. **Patrón exacto ya escrito** en `/home/ian/Orkesta/la-forja/src/forja/mold/dfm-mesh.ts:110-121`. Cópialo. |
| **Bounding box del kernel** | Trivial | ⚠️ **`occt.ts` NO exporta ninguna función de AABB.** `fea.ts` tiene `computeAABB(positions)` en la línea 140 pero es **privada, no exportada**. La UI recalcula el suyo a mano (`meshBBox` en `ForgeBRepStudio.tsx:4578`). **Hay tres implementaciones de AABB en el repo y ninguna compartida.** Extráela. |
| **Superficie de referencia S_ref** | Medio | No es el área total del sólido: es el área **proyectada en planta**. Se calcula sumando `|área_triángulo · n̂·ẑ|` sobre la mitad superior, o proyectando la silueta. |
| **Envergadura b, cuerda media aerodinámica MAC, alargamiento AR, taper λ, flecha Λ, diedro Γ** | Medio-alto | Nada de esto existe. Requiere un concepto de "ala" (secciones ordenadas a lo largo de la envergadura), no solo un sólido. |
| **Secciones transversales del sólido en estaciones de envergadura** | Medio | Hay `cross-section.ts` y `gpu-cross-section.ts` en `src/lib/`, y `sectionClip` en la UI, pero **cortan para VER, no devuelven la polilínea del corte**. Verificar si `cross-section.ts` devuelve datos aprovechables. |
| **Curvatura de superficie** | Alto | `BRepLProp_SLProps` ya se usa para normales; podría dar curvatura, pero nadie lo hace hoy. |
| **Normal en cara CURVA** | Medio | `FaceRef.normal` es `[0,0,0]` en cilindros/conos/esferas. El FEA lo parchea con una heurística fea (eje más delgado del bbox de la cara). **Para un ala, que es toda superficie curva, esa heurística NO sirve.** Usa las normales por vértice del teselado, que sí son correctas en curvas. |

### 2.3 El contrato que YO recomiendo para el solver de paneles

Lo que el kernel puede entregar hoy, empaquetado:

```ts
// PROPUESTA — no existe todavía; se construye sobre tessellate()
export interface PanelSkin {
  /** centroide de cada panel [x,y,z] en mm — 3·nPaneles */
  centers: Float64Array;
  /** normal unitaria SALIENTE de cada panel — 3·nPaneles */
  normals: Float64Array;
  /** área de cada panel en mm² — nPaneles */
  areas: Float64Array;
  /** faceId B-Rep de cada panel (segmenta extradós/intradós/TE) — nPaneles */
  faceIds: Uint32Array;
  nPanels: number;
  /** área total, para el invariante: Σ areas ≈ surfaceArea(oc, shape) */
  totalArea: number;
}
```

**El invariante de verificación es gratis y fuerte**: `Σ areas` de los paneles debe converger al
`surfaceArea(oc, shape)` exacto de OCCT al refinar la deflexión. Y `Σ (area·n̂)` debe dar ≈ 0 para
un sólido cerrado (teorema de la divergencia). **Esos dos checks cazan errores de winding, de
orientación de cara REVERSED y de deflexión ignorada** — los tres bugs que un método de paneles
sufre en silencio. Ponlos en el primer test.

---

## 3. El motor aero existente: qué es reusable

### 3.1 Convenciones que sigue (respétalas)

- **Unidades: SI puro** en `src/aero/` (metros, Pa, K, kg/m³, m/s, radianes). Contraste con el
  kernel, que trabaja en **mm** — el FEA convierte con `MM_TO_M`. **La frontera mm↔m es donde van a
  nacer los bugs; declárala explícita en cada función.**
- **Funciones PURAS y deterministas.** Cero React, cero estado, cero `Math.random`. `potencial.ts`
  lo dice literal: "Módulo PURO compartido por el laboratorio y el cine".
- **Constantes en un objeto `as const` exportado** al principio del archivo (`ISA`, `CUNA_ANDERSON`).
- **Sistema de coordenadas de `potencial.ts`**: el freestream sube a `+α` (término `U·e^{−iα}`) y la
  escena rota el marco `−α`. `seedField(sx,sy,α)` convierte pantalla→campo. Está documentado porque
  ya causó confusión.
- **Estilo de test: contra números PUBLICADOS, jamás contra sí mismo.** Cada test cita el libro y la
  tolerancia (`±1 %`, `±0.4°`). Y hay **tests de física, no de implementación**: el mejor ejemplo es
  `∮u·dl = −Γ_Kutta` por Stokes, que **cazó el bug del signo del vórtice** del lab original (el
  comentario en `potencial.ts:107-111` documenta que el bug sobrevivía porque "en ζ_im=0 ambas
  coinciden: por eso la condición de Kutta en el borde se veía bien"). **Copia ese patrón.**

### 3.2 Qué le falta para llegar a un método de paneles

`potencial.ts` es **2D, un solo perfil, mapeo conforme**. Un método de paneles necesita:

| Falta | Nota |
|---|---|
| **Discretización del contorno en paneles** con puntos de control | `nacaProfile()` ya da el contorno cerrado con cosine spacing — es el punto de partida. |
| **Matriz de influencia** (coeficientes de fuente/vórtice panel-a-panel) | Cero. Es el corazón del método. |
| **Solve del sistema lineal denso** | ⚠️ `fea.ts` documenta que el `conjugateGradient` de `formulas.ts` es **denso, `number[][]`, matVec O(n²)** e "inviable". Para paneles la matriz **es densa por naturaleza** pero pequeña (100–400 paneles = 400² floats, perfectamente manejable). **Necesitas un LU/Gauss denso; el CG sparse de `fea.ts` no aplica** (la matriz de paneles no es simétrica ni definida positiva). |
| **Condición de Kutta discreta** | La formulación existe conceptualmente en `potencial.ts` pero no como restricción de panel. |
| **Extensión a 3D (vortex-lattice / paneles 3D)** | Nada. Bertin & Cummings es la referencia del pliego. |
| **Capa límite / arrastre viscoso** | `cuna-anderson.ts` usa `τ=431·s^−0.2`, que está **explícitamente etiquetado como empírico del Ejemplo 1.1**, no un modelo. El comentario dice: "el modelo general de capa límite llega con `capa-limite.ts` en U4-L7". **No existe todavía.** |
| **Polar completa (CL vs α, CD vs CL)** | `liftCoefficient(α)=2π·sin(α)` es thin-airfoil puro, sin pérdida, sin arrastre. |

---

## 4. EL FLUJO DEL ESTUDIO FEA — el patrón exacto a copiar

Este es el molde. Descrito con nombres reales.

### Paso 1 — El usuario entra al espacio de trabajo

`ForgeBRepStudio.tsx:3464`
```ts
const [workspace, setWorkspace] = useState<'diseno'|'manufactura'|'simulacion'>('diseno');
```
El botón es `data-testid="tab-simulacion"` (`ForgeBRepStudio.tsx:6479`). El panel completo vive
bajo `{workspace === 'simulacion' && (...)}` en la línea **6918**, con `data-testid="sim-panel"`.

### Paso 2 — Fijar una cara (empotramiento)

1. Usuario da clic en `data-testid="btn-pick-fija"` → llama `togglePickFace`.
2. Usuario da **clic real en la pieza** en el viewport R3F.
3. **El picking**: el raycast de three.js entrega el **índice del triángulo** (`e.faceIndex`).
   `ForgeBRepStudio.tsx:2585-2593`:
   ```ts
   if (ti != null && ti >= 0 && ti < mesh.faceIds.length) {
     onPickFace(mesh.faceIds[ti], e.point);
   }
   ```
   **Triángulo → `faceIds[ti]` → faceId B-Rep estable.** Directo y exacto, sin heurística. Este es
   el mecanismo clave y funciona: es el mismo índice que consume `enumerateFaces`.
4. Se guarda en `feaFixedFace` (número o `null`). Se muestra en `data-testid="fea-fija-id"`.

### Paso 3 — Cara de carga y magnitud

Mismo mecanismo con `btn-pick-carga` → `feaLoadFace`. La magnitud entra por
`data-testid="input-carga"` en **newtons** → `feaLoadN`.

### Paso 4 — Disparar el análisis

Botón `data-testid="btn-fea"` → `runFeaAnalysis(loadDirOverride?)`, definido en
`ForgeBRepStudio.tsx:4320`. Corre **en el main thread**, envuelto en `requestAnimationFrame` para
que la UI pinte el estado "ocupado" antes de bloquear. ⚠️ **No hay worker.**

Lo que hace, en orden:

```
4320  guarda: si no hay oc o feaFixedFace == null → error y sale
4327  setFeaBusy(true); setGenResult(null)   // el FEA y el generativo comparten canal de color
4331  RECONSTRUYE el sólido: buildShape(oc, boundDoc.sketch, boundDoc.ops, edgeAxisRef.current)
      ⚠️ el rebuild anterior YA BORRÓ el Shape — hay que reconstruirlo cada vez
4338  const faces = enumerateFaces(oc, shape)
4339  dirección de carga = normal OCCT de la cara de carga; si es degenerada → [0,0,-1]
      (loadDirOverride tiene prioridad — así funcionan los botones fea-dir-*)
4357  const bc: FaceBC = { fixedFaces:[feaFixedFace], loadFaces:[feaLoadFace] }
4363  const matKey = FEA_MATERIAL_KEY[material] ?? 'aluminio_6061'
4364  const session = prepareFeaSession(oc, shape, bc, { material: matKey, resolution: 18 })
4368  const res = solveLoadOnSession(session, { totalForce: [dx*F, dy*F, dz*F] })
4373  const renderPos = resultRef.current?.mesh.positions   // la malla que SE VE
4374  const { colors } = vonMisesVertexColors(res, renderPos);  setFeaColors(colors)
4376  const { disp, maxMag } = feaVertexDisplacements(res, renderPos); setFeaDisp(disp)
4380  setFeaResult(res)
4386  finally: shape?.delete?.()   // higiene del heap WASM — OBLIGATORIO
```

### Paso 5 — Dentro del solver (`fea.ts`)

**Malla** — `brepToVolumeTetMesh(oc, shape, resolution=16, deflection=0.1)` (línea 229):

1. `tessellate()` → malla de superficie.
2. `computeAABB(tess.positions)` → caja.
3. **Voxeliza el AABB** (`resolution` voxeles en el lado más largo).
4. Clasifica cada voxel **por ray-cast del centro contra la malla teselada** (`pointInsideMesh`).
   ⚠️ Comentario literal del código: *"este build de opencascade.js NO expone
   `BRepClass3d_SolidClassifier` — verificado"*. Por eso el ray-cast.
5. Los voxeles interiores se parten en **5 tet4 por voxel (split de Kuhn)**.
6. Devuelve `VolumeTetMesh { nodes: Float64Array (mm), tets: Uint32Array, nNodes, nTets, voxel, aabb, fillFraction }`.

**Cara → nodos** — `nodesOnFace(mesh, faceCenter, faceNormal, bboxMin, bboxMax)` (línea 349):
selecciona los nodos que caen dentro de una **banda de `0.6·voxel`** del plano de la cara Y dentro
del bbox de sus triángulos (con `pad = 0.5·voxel`).
⚠️ **Esto es puramente planar.** Para caras curvas usa la heurística del "eje más delgado del bbox".
**Para un ala no sirve.**

**Ensamble** (SI, nodos convertidos a metros con `MM_TO_M`):
- `D = elasticityMatrix3D(E, ν)` (6×6)
- por tet: `const { K: Ke, B } = tet4Element(coords, D)` → dispersa Ke (12×12) en `K` global (3 DOF/nodo)
- `B` se guarda por elemento en `tetB[e]` para recuperar esfuerzos después

**Cargas**: `totalForce` [N] repartida **por igual entre los nodos** de la cara cargada. Alternativa:
`pressure` [Pa] × **área OCCT exacta de la cara** (`fref.area`, convertida a m²) → fuerza total.
> **Nota para aero**: esa vía `pressure` × área-de-cara-OCCT es **exactamente el puente que necesita
> el Estudio Viento** para transferir el campo de presión al FEA. Ya existe. Pero es **una presión
> escalar por cara**, no un campo por panel — habría que extender `FaceBC` a `pressureField`.

**Condiciones de Dirichlet**: eliminación simétrica — fila/columna `d` = `e_d`, `f[d]=0`, mantiene
simetría (línea ~730).

**Solve**: `sparseCG(K, f, tol=1e-6, maxIter=max(2000, 4·nDOF))` — gradiente conjugado sparse (CSR,
`Map` por fila) con precondicionador Jacobi. ⚠️ El comentario de cabecera explica por qué:
el `conjugateGradient` de `formulas.ts` es denso `number[][]` y con ~6000 DOF serían ~350 MB.

**Recuperación**: por elemento `ε = B·u`, `σ = D·ε`, `vm = vonMisesStress(σ)`; luego promedio a
nodos.

**Resultado**:
```ts
export interface FEAResult {
  mesh: VolumeTetMesh;
  displacements: Float64Array;    // mm, 3·nNodes
  vonMisesNodal: Float64Array;    // Pa, por nodo
  vonMisesElem: Float64Array;     // Pa, por elemento
  dispMagNodal: Float64Array;     // mm
  maxVonMises: number;
  maxDisplacement: number;
  minSafetyFactor: number;        // σ_y / max(σ_vm)
  solver: { iterations: number; residual: number; converged: boolean };
  fixedNodes: number[];
  loadedNodes: number[];
}
```

### Paso 6 — Sesión incremental ("análisis mientras diseñas")

`prepareFeaSession(oc, shape, bc, opts) → FEASession` cachea lo **caro** (malla, K con Dirichlet ya
aplicado, `tetB`, `D`). `solveLoadOnSession(session, {totalForce})` hace solo lo **barato** (vector f
+ CG con **warm-start**). Mover el slider de carga repinta en **milisegundos** (`feaLiveMs`).

> **Este es el patrón que aero DEBE copiar**: la matriz de influencia de paneles no cambia con α ni
> con la velocidad. Cachea la matriz, resuelve por ángulo de ataque. **Una polar CL(α) completa se
> vuelve interactiva.**

### Paso 7 — Pintar el campo SOBRE la pieza

Dos funciones en `fea.ts`, ambas exportadas:

**`vonMisesVertexColors(result, positions) → { colors, vmPerVertex }`** (línea 1126):
1. `buildNodeGrid(mesh)` → estructura de búsqueda espacial.
2. Para cada vértice de la **malla de render** (no la de análisis): `sampleNodalField(...)`
   interpola el campo nodal.
3. ⚠️ **Normaliza por el PERCENTIL 98, no por el máximo.** Comentario literal: *"un solo nodo
   singular en un filete dispara maxVonMises y APLASTA todo el resto del campo al extremo azul"*.
   **Guarda esta lección: el Cp de aero tiene exactamente la misma patología en el borde de ataque.**
4. `jetColor(t)` → rampa tipo Turbo pero con el extremo bajo en **azul profundo, no púrpura**
   (*"el púrpura sobre la pieza en reposo lee como defecto, no como dato"*).

**`feaVertexDisplacements(result, positions) → { disp, maxMag }`** (línea 1166): muestrea el
desplazamiento nodal sobre los vértices visibles → la UI **deforma la pieza en vivo**
(`pos' = pos + disp·escala·pulso`), con contorno fantasma del reposo.

**Cómo llega a la GPU**: `feaColors` es un `Float32Array` de colores por vértice que se ata al
`BufferGeometry` como atributo `color` con `vertexColors` activado. **No hay shader especial.**
Leyenda en `ForgeBRepStudio.tsx:6431-6448` (`data-testid="fea-legend-max"`), con la escala en MPa y
el factor de exageración de la deformada.

### Paso 8 — Exponer al agente / a la lección

`ForgeBRepStudio.tsx:5605-5650`:
```ts
setFeaFixedFace: (i) => setFeaFixedFace(i),
setFeaLoadFace:  (i) => setFeaLoadFace(i),
setFeaLoad:      (n) => setFeaLoadN(n),
runFEA:    runFeaAnalysis,
runFEADir: (dir) => runFeaAnalysis(dir),
feaLiveSetLoad: (n) => feaLiveSetLoad(n),
get feaResult() { return { maxVonMises_MPa, minSafetyFactor, maxDisplacement_mm,
                           n_nodes, n_tets, iterations, residual, converged, ... } },
```
Todo colgado de `window.__forgeBrep`. **Los checks de las lecciones leen justo estos getters.**

---

## 5. ⚠️ El "Estudio Viento" que ya existe — v0, y su deuda

El repo **ya tiene** un Estudio Viento cableado en la misma pestaña de Simulación, con lecciones
grabadas (`a1-l1`, `a1-l4`). Funciona y sus 7 tests pasan. Pero **hay que saber exactamente qué es**
antes de construir encima.

**La física (`viento.ts`) es honesta y buena**: ISA real + choque oblicuo θ-β-M resuelto por
bisección (la presión `p₂` **emerge del choque**, no se copia del libro) + integral de paneles de la
ecuación 1.8. El test lo verifica contra Anderson: `p₂ ≈ 1.31×10⁵ Pa` al 1.4 %, `cd ≈ 0.022`.

**La conexión con la geometría es una maqueta.** `ForgeBRepStudio.tsx:4596-4608`:

```ts
const spans = meshBBox.half.map((h) => h * 2);
const cuerdaMM  = Math.max(...spans);
const espesorMM = Math.min(...spans);
const delta = Math.atan((espesorMM / 2) / cuerdaMM);   // ⚠️ el semiángulo sale del BOUNDING BOX
```

**El semiángulo de la cuña se deriva de la relación de aspecto del bounding box.** No lee ni una
normal, ni un área de cara, ni un panel. Si el usuario dibuja un ala real en vez de una cuña, el
número que salga **no significa nada**.

**El pintado de Cp es igualmente heurístico** (`ForgeBRepStudio.tsx:4613-4636`): clasifica cada
vértice como "en la cara inclinada" o "en la base" comparando su posición contra la pendiente
`tan(δ)` derivada del bbox:

```ts
const onFace = s > chord * 0.02 && n > 0.65 * s * tanD;  // sigue la pendiente
const c = onFace ? cWarm : cBase;
```

Es decir: **dos colores planos, asignados por geometría de bounding box.** El comentario del código
es honesto sobre por qué se hizo así (*"nada de quads sobrepuestos: daban z-fight y franjas"*) y usa
el mismo canal de color por vértice que el FEA — **la plomería de render es correcta y reusable**.

### Veredicto

| Componente | Estado | Acción para AERO |
|---|---|---|
| `viento.ts` (física de la cuña supersónica) | **Bueno, con tests** | **Reusar tal cual** como el caso U1-L1. Es el ancla contra Anderson. |
| Medición de δ desde el bbox | **Maqueta** | **Reemplazar** por medición real sobre paneles. |
| Pintado de Cp por clasificación de bbox | **Maqueta** | **Reemplazar** por Cp real por panel. |
| Canal de color por vértice + leyenda + drivers `window.__forgeBrep.setViento*` | **Bueno** | **Reusar tal cual.** Los test-ids ya existen: `btn-viento`, `chk-viento-p`, `chk-viento-tau`, `chk-viento-shock`, `viento-delta`, `viento-cd`, `viento-drag`, `viento-error`. |

---

## 6. El bus de comandos `ui.run`

**Archivo**: `/home/ian/Orkesta/la-forja/src/forja/commands/registry.ts`

### Definición

```ts
export interface CommandCtx { oc?: unknown; }   // instancia OCCT viva
export type CmdStatus = 'implementado' | 'parcial' | 'falta';

export interface Command {
  id: string;         // 'clamp.force'
  domain: string;     // 'llenado'
  eq?: string;        // 'Eq 5.29' — la ecuación del libro
  status: CmdStatus;
  needsOc?: boolean;  // requiere el kernel
  summary: string;
  run: (params: Record<string, any>, ctx: CommandCtx) => any;
}
```

Registro por `reg({...})` en un `Map` de módulo. **API**: `run(id, params, ctx)`, `has(id)`,
`describe(id)`, `list({domain?, status?})`, `stats()`. Exportado como `forjaCommands`.

`run()` da errores útiles: comando desconocido sugiere vecinos del mismo dominio; `status:'falta'`
lanza *"es un hueso pelón"*; `needsOc` sin `ctx.oc` lanza claro.

### Conteo real (medido con grep, no del doc)

**57 comandos** en **12 dominios**:

| Dominio | n | Dominio | n |
|---|---|---|---|
| llenado | 10 | dfm | 4 |
| gates | 7 | venteo | 3 |
| shape | 6 | placas | 3 |
| curso | 6 | balanceo | 3 |
| colada | 6 | 3placas | 3 |
| orquestador | 5 | producto | 1 |

⚠️ `docs/forja-research/MOLDE-COMANDOS.md` habla de **184 comandos** — ese es el **catálogo
aspiracional** destilado del libro de Kazmer. **El registro ejecutable tiene 57.** El propio
encabezado de `registry.ts` lo aclara: *"el destilado dejaba de ser un catálogo y pasa a ser VERDAD
EJECUTABLE"*. No confundas los dos números.

### Cómo se invoca

`ForgeBRepStudio.tsx:5851` monta el bus en `window` **con el `oc` vivo inyectado**:
```ts
(window as any).__forja = {
  ...forjaCommands,
  run: (id, params?, ctx?) => forjaRun(id, params ?? {}, { oc: oc ?? undefined, ...(ctx ?? {}) }),
};
```
Un agente o un test hace `window.__forja.run('gate.design', {...})`. **No hay CustomEvent ni store
de por medio: es llamada directa síncrona.**

### El almacén de handles (importante para aero)

Los `Shape` de OCCT **no son JSON** y no cruzan la frontera del bus. Solución ya implementada: los
comandos devuelven un **handle opaco** (`'sh_7'`), el bus guarda el shape en un `Map`, y la etapa N
recibe el handle de la N−1. Con ciclo de vida explícito: `shape.list` / `shape.meta` /
`shape.volume` / `shape.mesh` / `shape.free` / `shape.clear` (que llaman `.delete()` en el heap
WASM). **Si aero necesita un pipeline componible (perfil → ala → análisis), este es el mecanismo y
ya funciona.**

⚠️ **No hay un solo comando de aero en el registro.** Es un hueco limpio: `aero.*` está libre.

### Otras superficies globales

| Global | Qué es |
|---|---|
| `window.__forgeBrep` | **El API de agente del CAD** — ~99 métodos/getters. Incluye `invariants`, todos los drivers de FEA, generativo, CAM, y los de Viento. |
| `window.__forja` | El bus de comandos con `oc` inyectado. |
| `window.__sketchEditor` | Driver del croquis (`toPx`, `svgRect`, `points()`, `lines()`, `dimDist`, `dof`). |
| `window.__aeroLab` | Driver de los labs de física AERO (`AeroAtmosfera.tsx`, `AeroFuerzas.tsx`). |
| ⚠️ `src/forja/api.ts` + `runner.ts` (`window.__forjaRunScene`) | **Sistema VIEJO y separado**: DSL declarativo sobre el motor **SDF**, no sobre B-Rep. No lo uses para aero. |

---

## 7. El sistema de lecciones de la escuela

### 7.1 Esquema COMPLETO (enumerado sobre los 65 JSON)

**Raíz** (conteo de apariciones en 65 archivos):

| Campo | Presente en | Tipo |
|---|---|---|
| `id`, `titulo`, `pasos` | 65/65 | string, string, Paso[] |
| `curso`, `unidad`, `n`, `subtitulo`, `fuente`, `descripcion` | 62/65 | string/number |
| `biblioteca` | 10/65 | array |
| `url` | 2/65 | string — página destino (p.ej. `"forja-brep.html"`). **Ambas son las AERO.** |
| `moldLive` | 1/65 | `{ at: pasoId }` |

**Paso** (520 pasos en total):

| Campo | Presente en | Tipo |
|---|---|---|
| `id` | 520 | string (`"p01"`) |
| `dice` | 520 | string — **el guion hablado, español mexicano**, se convierte en TTS y en subtítulo |
| `gestos` | 520 | Gesto[] |
| `check` | 202 | `{ js: string; desc: string }` |
| `zoom` | 33 | string — control al que enfocar |

**Check**: exactamente **dos** campos, siempre: `js` y `desc`.

### 7.2 Los 14 tipos de gesto (con conteo real)

| type | usos | Implementación (`clase-drive.cjs`) |
|---|---|---|
| `tclick` | 591 | Desliza el mouse al `[data-testid=X]` y hace clic real de Playwright |
| `fill` | 378 | `loc.fill(String(a.text))` sobre el testid |
| `wait` | 184 | `page.waitForTimeout(a.ms)` |
| `clickmm` | 154 | **Clic en coordenadas MM del croquis** — `window.__sketchEditor.toPx(x,y)` + `svgRect()` → pixel absoluto |
| `orbit` | 146 | `mouse.down()` en `from`, `move(to, {steps:26})`, `up()` — órbita real de cámara |
| `view` | 119 | `window.__forgeBrep.setView(name)` (`'iso'`, etc.) |
| `key` | 110 | `keyboard.press(a.key)` |
| `hook` | 94 | `window.__sketchEditor[fn](...args)` |
| `probe` | 77 | Lee `window.__forgeBrep.invariants` y lo imprime (diagnóstico, no falla) |
| `dimline` | 32 | Acota la línea más larga horizontal/vertical **por endpoints**, sin índices hardcodeados |
| `clickptwhere` | 23 | Clic en el punto del croquis más `'bl'`/`'tr'`/`'origin'` |
| `click` | 15 | Clic por **pixel absoluto del viewport** — así se elige una CARA de la pieza |
| `main` | 14 | **`window.__forgeBrep[fn](...args)`** ← la vía para drivers del estudio |
| `rclick` | 1 | Clic derecho |

Además, implementados en el driver pero sin uso todavía en los JSON: `type` (teclear),
`dragmm` (arrastre en mm del croquis), **`alab`** (`window.__aeroLab[fn](...args)` — **ya cableado
para AERO**).

Cada gesto acepta `settle` (ms de espera después, default 700, escalado por `PACE`).

### 7.3 Cómo se verifica un `check` — el código literal

Hay **DOS ejecutores** y evalúan distinto. Esto importa.

**A) En el navegador — `TutorialOverlay.tsx:34`** (modo GUÍA interactivo):
```ts
function evalCheck(js: string): boolean {
  try {
    const inv = (window.__forgeBrep as { invariants?: unknown } | undefined)?.invariants;
    const sk = window.__sketchEditor;
    // El check viene de NUESTRAS lecciones (mismo repo), no de input del usuario.
    return !!new Function('inv', 'sk', `return (${js});`)(inv, sk);
  } catch { return false; }
}
```
Se **sondea con intervalo**; al pasar, marca el paso y avanza solo.

**B) En Playwright — `clase-drive.cjs:293-298`** (grabación de la clase):
```js
rec.check = await page.evaluate((js) => {
  const inv = window.__forgeBrep && window.__forgeBrep.invariants;
  const sk  = window.__sketchEditor;
  // el js del check puede dejar un valor de diagnóstico en window.__claseDbg
  return { pass: !!eval(js), vol: inv && inv.vol_kernel, dof: sk && sk.dof, dbg: window.__claseDbg };
}, paso.check.js);
```
Con **reintento: 4 intentos × 2.5 s** (el kernel WASM corre en CPU y bajo contención el settle fijo
no alcanza). **No aborta la clase**: el reporte decide si el video sirve.

⚠️ **Diferencia real de contrato**: el overlay expone las variables `inv` y `sk` **como parámetros de
función**; Playwright usa `eval` en el scope global, donde `inv` y `sk` son **`const` locales** del
callback. En la práctica ambos funcionan para los checks existentes, pero **un check que use `window.`
explícito (como los de AERO) es el único 100 % portable entre los dos ejecutores.** Los checks de
`a1-l1`/`a1-l4` ya lo hacen bien: `var v=window.__forgeBrep.viento; ...`.

### 7.4 Contra qué se verifica: los invariantes del kernel

`window.__forgeBrep.invariants` (`ForgeBRepStudio.tsx:5335`):
```ts
{
  ops: string[],          // tipos de operación aplicadas
  faces, edges, vertices, euler,   // topología (V−E+F)
  vol_kernel,             // mm³ EXACTO de OCCT
  area,                   // mm²
  mass_g, com, principal, // masa, centro de masa, momentos principales
  step_bytes, tris, n_faces, n_edges
}
```

**El check compara contra la VERDAD DEL KERNEL, no contra el estado de React.** Esa es la razón de
que este sistema valga: la lección no puede "pasar" pintando pixeles.

### 7.5 Ejemplo REAL completo — la lección AERO que ya existe

`/home/ian/Orkesta/la-forja/public/escuela/lecciones/a1-l1.json`:

```json
{
 "id": "a1-l1",
 "curso": "aero",
 "unidad": 1,
 "n": 1,
 "titulo": "Las dos manos del aire: presión y cortante",
 "subtitulo": "dibuja la cuña · ponla en el túnel supersónico · no hay tercera fuerza · Anderson Ej. 1.1",
 "fuente": "Anderson, Fundamentals of Aerodynamics 6ª ed., §1.5 y Ejemplo 1.1 (cuña 5° a Mach 2)",
 "descripcion": "El aire solo sabe hacer DOS cosas: empujarte perpendicular (presión) y rasparte tangente (cortante)...",
 "url": "forja-brep.html",
 "pasos": [
  {
   "id": "p03",
   "dice": "Cierro el croquis y lo extruyo ochocientos milímetros de envergadura...",
   "gestos": [
    { "type": "tclick", "testid": "sk-finish",     "settle": 1600 },
    { "type": "tclick", "testid": "btn-extrude",   "settle": 1600 },
    { "type": "fill",   "testid": "input-altura", "text": "800", "settle": 1800 }
   ],
   "check": { "desc": "la cuña sólida (vol ≈ 2.8×10⁸ mm³)",
              "js": "inv && inv.vol_kernel > 2.7e8 && inv.vol_kernel < 2.9e8" }
  },
  {
   "id": "p04",
   "dice": "Voy a la pestaña de Simulación y prendo el estudio de Viento. El CAD MIDE el semiángulo de mi pieza...",
   "gestos": [
    { "type": "tclick", "testid": "tab-simulacion", "settle": 1000 },
    { "type": "main", "fn": "setViento",         "args": [true], "settle": 400 },
    { "type": "main", "fn": "setVientoMach",     "args": [2.0],  "settle": 400 },
    { "type": "main", "fn": "setVientoAlt",      "args": [0],    "settle": 400 },
    { "type": "main", "fn": "setVientoPaneles",  "args": [6],    "settle": 600 }
   ],
   "check": { "desc": "estudio activo, δ medido de la pieza = 5° a Mach 2",
              "js": "var v=window.__forgeBrep.viento; v && Math.abs(v.deltaDeg-5)<0.4 && v.mach===2" }
  }
 ]
}
```

Y de `a1-l4.json`, checks que verifican **la ISA contra la tabla publicada, medida a través de la
UI**:
```
p03: var v=window.__forgeBrep.viento; v && Math.abs(v.rho-1.225)<0.002 && v.hM===0
p04: var v=window.__forgeBrep.viento; v && Math.abs(v.rho-0.7361)<0.003 && v.hM===5000
p05: var v=window.__forgeBrep.viento; v && Math.abs(v.rho-0.3639)<0.002 && v.hM===11000
```

**Ese es el estándar.** La lección no dice "aprende la ISA": **conduce el CAD y verifica el número
del estándar internacional**.

### 7.6 Índice / currículum

⚠️ **No hay un JSON de índice.** `EscuelaPortal.tsx` (51 KB) tiene el currículum embebido en TS. El
plan de aero está en prosa: `docs/forja-research/aero/CURRICULUM-AERO.md` y
`docs/forja-research/aero/PLAN-ESCUELA-AERO-EN-EL-CAD.md`.

---

## 8. Backend de verdad

### 8.1 No hay servidor de aplicación

Es un **SPA multi-página estático de Vite**. `vite.config.ts` declara **~40 entradas HTML**
(`index`, `physics`, `escuela`, `forja-brep`, `clase`, `comando`, ...). `npm run build` → `dist/`.

**Despliegue** (`deploy.sh`): build local → `rsync` a **ATLAS** (`100.97.118.117`) en
`/mnt/hdd/forja-dist`. **nginx sirve directo desde disco**, sin restart de contenedor. Dominio:
**`https://university.gaiaprime.com.mx`**.

`deploy/nginx-forja.conf`:
```nginx
location /api/telemetry/ { proxy_pass http://gaia_telemetry_forja:8002/; }
location /precomputed/   { ... }   # ruta PROPIA para los datasets grandes
location /audio/         { ... }
location ~* \.(js|css|woff2?|wasm|png|jpg|jpeg|svg|ico|bin)$ { ... }
location ~* \.html$      { ... }
location /               { ... }
```
**Un solo `proxy_pass`, y es telemetría.** Cero cómputo servidor.

### 8.2 Los tres servicios que sí existen

| Servicio | Dónde | Qué hace |
|---|---|---|
| **Telemetría** | `/home/ian/Orkesta/la-forja/telemetry-service/server.cjs` (Node puro, sin deps, puerto 8002) | `POST /events` (batch JSON), `GET /` (dashboard HTML), `GET /raw` (JSONL), `GET /tail` (SSE), `GET /clear` (con token). Storage: JSONL append-only en `/mnt/hdd/forja-telemetry/events.jsonl`, rota a los 100 MB. **También guarda `registro.json`** — la persistencia del Centro de Comando. |
| **university-api** (externo, aislado) | `API_BASE` en `src/lib/gaia-access.ts`, leído de `<meta name="gaia-api">`, fallback `http://localhost:8000` | Cuentas y pagos: `/auth/me`, `/auth/request-link`, `/auth/session-from-checkout`, `/billing/portal`, `/checkout`. **Stripe.** Nada de simulación. |
| **lab1k / RIAN** (solo en dev) | proxy `/rpc → http://127.0.0.1:9877` en `vite.config.ts` | Daemon fuera del repo, no en producción. |

### 8.3 ✅ Datos precomputados: el camino está pavimentado

**`public/precomputed/` = 472 MB** ya sirviéndose estáticamente, con su propio `location` en nginx
(añadido el 2026-07-31 porque los `.bin` caían en `location /` y salían mal).

Ejemplos reales que la app ya hace `fetch` de ahí:
```
/precomputed/cargas-gauss.json        /precomputed/cargas-gauss-efield.bin
/precomputed/faraday-jaula.json       /precomputed/faraday-jaula-efield.bin
/precomputed/silicio-campos.bin       /precomputed/silicio-particulas.bin
/precomputed/water-md.bin             /precomputed/quasar-sed.bin
/precomputed/${molKey}-abinitio.bin   /precomputed/${molKey}-efield.bin
```
Más `public/viz-data/` (267 MB, con `viz-data/index.json`) y `public/comando/*.json`.

> **Para AERO esto resuelve el problema de las polares y la base de perfiles.** Precomputa en iangpu
> (RTX 4070 Ti), escribe `public/precomputed/aero-*.bin` + un `.json` de índice, y `fetch` desde el
> navegador. **Cero backend nuevo.** Es exactamente el patrón `[PRECÓMPUTO]` que el CONTRATO del
> pliego aero ya nombra.

### 8.4 Persistencia

- **localStorage**: sesión GAIA (`gaia_session`), biblioteca de documentos del CAD, A/B testing
  (`__forja_ab:*`).
- **sessionStorage**: id de sesión de telemetría (`__forja_sid`).
- **Servidor**: solo `events.jsonl` + `registro.json` (Centro de Comando) en el servicio de
  telemetría.
- **No hay base de datos. No hay guardado de proyectos en servidor.**

---

## 9. Tests y el gate

### 9.1 La suite unitaria

`vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts']`, alias `@ → src`.

```bash
npx vitest run                        # todo
npx vitest run src/aero               # solo aero
npx vitest run src/forja --reporter=dot
```

**Medido hoy: 67 archivos, 1197 tests, 21 s, todos verdes.** Corre en **Node puro, sin build, sin
navegador, sin WASM** — los tests que necesitan OCCT no son de vitest (ver abajo).

### 9.2 `forja-gate.cjs` — el portero maestro

`/home/ian/Orkesta/la-forja/scripts/forja-gate.cjs`

```bash
node scripts/forja-gate.cjs                      # 67 suites, sin navegador
node scripts/forja-gate.cjs --only kernel,physics
node scripts/forja-gate.cjs --json out.json
node scripts/forja-gate.cjs --ui http://localhost:5001/forja-brep.html   # + 2 suites e2e con GPU
```

**Composición real (medida):**

| Grupo | Suites | Qué son |
|---|---|---|
| `kernel` | **62** | Scripts `.cjs` corridos con `node --import tsx`. Cargan **OCCT-WASM de verdad**. Cubren: B-Rep (topología/volumen exacto/STEP roundtrip), extrude, features (barreno/revolve por Pappus/shell/masa/fillet), las 4 piezas del libro de Kazmer, isoview, `campo-operador` (el sustrato de simulación), y **~45 suites de moldes** contra números literales de Kazmer. |
| `physics` | 2 | `fea-node-test.cjs` (**FEA vs analítico**: barra axial σ=F/A y δ=FL/AE, viga voladizo) y `topopt-node-test.cjs` (compliance↓, volumen conservado). |
| `unit` | 1 | `vitest run src/forja --reporter=dot` |
| `e2e` | 2 (solo con `--ui`) | Playwright con **GPU real (ANGLE)**: Part Studio por clics reales, Loft+Sweep. |

**Criterio de fallo**: exit code ≠ 0. Respaldo suave: si exit=0 pero la salida hace match con
`/(\bFAIL\b|✗|❌|Error:|AssertionError|✘|failed)/` y **nunca** dice PASS, se marca FAIL igual (atrapa
suites que no propagan el código). Timeout por suite: 200 s (`--timeout`). Se ancla a la raíz del
repo vía `__dirname` (*"un `ssh` pelón cae en `$HOME`"*).

### 9.3 ⚠️ Dos huecos de cobertura que importan para AERO

1. **`src/aero/` NO está en el gate.** La suite `unit` corre `vitest run src/forja` — no `src/`.
   Los 25 tests de `src/aero/` (`atmosfera`, `potencial`, `cuna-anderson`) **nunca corren en el
   portero**. Solo `viento.test.ts` entra, porque vive en `src/forja/sim/`.
   **Fix de una línea**: cambiar el arg a `['run', 'src', '--reporter=dot']`, o añadir una suite
   `{ group: 'physics', n: 'aero', cmd: VITEST, args: ['run','src/aero','--reporter=dot'] }`.
   **Hazlo antes de escribir código nuevo de aero.**
2. **No hay suite de kernel para aero.** Los 62 tests de kernel prueban OCCT con moldes. **Ninguno
   prueba que el teselado dé paneles con área/normal correctos.** Esa suite hay que escribirla (el
   invariante `Σ areas → surfaceArea` y `Σ area·n̂ → 0` de §2.3).

### 9.4 Otros arneses

`scripts/` tiene ~30 drivers `forja-*.cjs` de Playwright. Los relevantes:
`forja-drive.cjs` (maneja la UI real), `forja-mensula-fea.cjs` y `forja-sim-tour.cjs` (recorridos
del estudio de simulación), `forja-brep-ui-verify.cjs` (el e2e del gate),
`scripts/escuela/clase-drive.cjs` (corre lecciones + graba video).
⚠️ Todos necesitan **GPU real**: la laptop cae en SwiftShader; corren en **iangpu**.

---

## 10. Qué se reusa / qué se extiende / qué se construye

### ✅ Se reusa TAL CUAL

| Pieza | Ruta |
|---|---|
| ISA completa (0–20 km) con tests contra ISO 2533 | `src/aero/atmosfera.ts` |
| Flujo potencial de Joukowski + Kutta + Cp + RK4 + `nacaProfile` + verificador de Stokes | `src/aero/potencial.ts` |
| Choque oblicuo θ-β-M + Ejemplo 1.1 de Anderson | `src/aero/cuna-anderson.ts` |
| Física del Estudio Viento supersónico | `src/forja/sim/viento.ts` |
| **Teselado con `faceIds` + `faceGroups`** | `occt.ts:tessellate` |
| **Medición exacta** (volumen, área, masa, centroide, inercia) | `occt.ts:volume/surfaceArea/massProperties` |
| **Enumeración de caras/aristas + polilíneas de arista** | `occt.ts:enumerateFaces/enumerateEdgesGeom` |
| **Construcción de alas**: `loftSections`, `extrudeSpline`, `mirrorShape`, `sewFaces`, `solidFromShell` | `occt.ts` |
| **Picking de cara por raycast → faceId** | `ForgeBRepStudio.tsx:2585` |
| **Canal de color por vértice + leyenda + deformada** | `fea.ts:vonMisesVertexColors/jetColor` + UI |
| **Bus de comandos con almacén de handles** | `registry.ts` |
| **Motor de lecciones completo** (14 gestos + checks contra invariantes + video) | `TutorialOverlay.tsx` + `clase-drive.cjs` |
| **Servido de datos precomputados** | `public/precomputed/` + nginx |
| **Patrón de sesión cacheada + warm-start** | `fea.ts:prepareFeaSession/solveLoadOnSession` |

### 🔧 Se extiende

| Qué | Cómo |
|---|---|
| `occt.ts` | Exportar `boundingBox()`. Añadir `panelSkin(oc, shape, deflection) → PanelSkin` (normales y áreas por triángulo). |
| `FaceBC` de `fea.ts` | Añadir `pressureField?: Float64Array` (presión por panel) además del `pressure` escalar actual — es el puente **Viento → FEA** (aeroelasticidad básica: el ala se dobla bajo su propia carga aerodinámica). |
| `ForgeBRepStudio.tsx` | Panel del Estudio Viento: reemplazar la medición por bbox y el pintado por clasificación. Reusar test-ids existentes. |
| `registry.ts` | Dominio `aero.*` nuevo (`aero.isa`, `aero.panels`, `aero.polar`, `aero.wing.geom`, ...). El namespace está libre. |
| `forja-gate.cjs` | Añadir la suite de `src/aero` **y** una suite de kernel que valide los invariantes de paneles. |
| `campo.ts` | Evaluar si el sustrato de campo sirve para el campo de flujo 3D (ya sustituyó 7 rejillas artesanales, incluida la de viento). |

### 🏗️ Se construye de cero

| Qué | Nota |
|---|---|
| **Geometría de ala**: S_ref, b, MAC, AR, λ, Λ, Γ, secciones por estación | El hueco más grande. No hay ningún concepto de "ala" en el repo. |
| **Método de paneles 2D** (matriz de influencia + Kutta discreta + **solver LU denso**) | ⚠️ El CG sparse de `fea.ts` **no aplica**: la matriz de paneles es densa y no simétrica. |
| **Vortex-lattice 3D** | Bertin & Cummings. |
| **Capa límite** (`capa-limite.ts`) | Ya está prometido en un comentario de `viento.ts` para U4-L7. No existe. |
| **Polares** CL(α), CD(CL), y estimación de pérdida | |
| **Base de perfiles** (NACA de 4/5 dígitos, series de la industria) | `nacaProfile` solo hace 00xx simétrico. |
| **Estabilidad y control**, masa y balance de la aeronave | El proceso de Raymer. `massProperties` da el insumo (centro de masa e inercia) pero nadie lo agrega. |
| **Lecciones AERO** más allá de `a1-l1` y `a1-l4` | |

---

## 11. Riesgos y deuda técnica que nos va a morder

1. 🔴 **`ForgeBRepStudio.tsx` = 537 KB / ~8700 líneas.** Toda la UI del CAD, todos los estudios, y el
   API de agente en UN archivo. El `useEffect` que monta `window.__forgeBrep` tiene un array de
   dependencias de **~90 entradas** y un comentario explicando cuáles se omiten a propósito para que
   no se borre a media interacción. **Meter el Estudio Viento aquí lo empeora.** Ya hay memoria del
   proyecto marcando esto (`feedback_forja_frontend_broken`: *"partir ANTES de más features"*).
   **Mitigación**: escribe el solver de aero como **módulo puro** (`src/aero/*.ts`) y el panel como
   **componente hermano** — igual que `TutorialOverlay.tsx` se monta "como HERMANO de
   ForgeBRepStudio (cero cambios al monolito)". Ese precedente existe y funciona.

2. 🔴 **El Estudio Viento actual mide del bounding box.** Ya está en producción, con dos lecciones
   grabadas y checks que dependen de él (`Math.abs(v.deltaDeg-5)<0.4`). **Si cambias la medición a
   paneles reales, esos checks pueden romperse.** Planea la migración: mide con paneles, verifica
   que la cuña siga dando 5.0°, y solo entonces borra el camino del bbox.

3. 🟠 **Tres implementaciones de AABB, ninguna compartida** (`fea.ts:computeAABB` privada,
   `ForgeBRepStudio.tsx:meshBBox` inline, y las de `dfm-mesh`/`draw-axis`). Vas a escribir la cuarta
   si no la extraes primero.

4. 🟠 **`FaceRef.normal` es `[0,0,0]` en toda cara curva.** El FEA lo parchea con "el eje más delgado
   del bbox de la cara" — heurística que en un ala **da resultados sin sentido**. Usa las normales
   por vértice del teselado (que sí son correctas) y no confíes en `FaceRef.normal` fuera de planos.

5. 🟠 **`nodesOnFace` es planar.** Selecciona por banda alrededor de un plano. Para transferir cargas
   aerodinámicas a una superficie curva hay que reescribirlo (o mapear panel→nodo por proximidad
   real).

6. 🟠 **Todo corre en el main thread.** El FEA congela la pestaña durante el solve
   (`requestAnimationFrame` solo permite pintar "ocupado" antes). No hay workers. Un método de
   paneles con 400 paneles es rápido, pero un vortex-lattice 3D o un barrido de polar **va a colgar
   la UI.** El patrón `prepareFeaSession`/`solveLoadOnSession` es el mitigante correcto: cachea lo
   caro, resuelve lo barato.

7. 🟠 **Higiene del heap WASM.** Cada `Shape` hay que `.delete()`-arlo (`finally: shape?.delete?.()`).
   El registro documenta que *"la pestaña se llena y revienta — como el fuse"*. Hay memoria del
   proyecto: **`fuse` en el navegador REVIENTA la pestaña** con cuerpos grandes. Un ala por loft +
   booleanos es exactamente el caso de riesgo.

8. 🟡 **Deflexión del teselado ignorada en silencio** si la forma ya trae malla (fillet/booleano
   previo). `tessellate()` ya lo maneja, pero cualquier código nuevo que llame a `BRepMesh` directo
   lo va a sufrir. **Y para paneles la deflexión ES la resolución del solver** — un teselado
   silenciosamente grueso da un CL silenciosamente malo.

9. 🟡 **La normalización por percentil 98 de `vonMisesVertexColors`** existe porque un solo nodo
   singular aplasta la escala. **El Cp del borde de ataque tiene la misma patología** (Cp→1 en el
   punto de estancamiento, Cp muy negativo en el pico de succión). Copia la solución, no el bug.

10. 🟡 **Aero fuera del gate** (§9.3). Riesgo de regresión silenciosa desde el día uno.

11. 🟡 **Dos evaluadores de `check` con contratos ligeramente distintos** (§7.3). Usa siempre
    `window.__forgeBrep...` explícito en los checks nuevos.

12. 🟡 **Hay un archivo `.tmp` sin commitear**: `src/escuela/EscuelaPortal.tsx.tmp.310501.4c2d17b5fa15`
    (51 KB) junto al real. Y `src/lib/ab.ts` sin trackear. Limpieza pendiente antes de tocar la
    escuela.

13. 🟡 **`docs/forja-research/MOLDE-COMANDOS.md` dice 184 comandos; el registro tiene 57.** No es un
    bug, es catálogo vs. implementación — pero si alguien planea aero contra el número del doc, va a
    calcular mal el esfuerzo.

---

## 12. Preguntas abiertas

1. **¿El Estudio Viento es 2D-por-sección o 3D de una vez?** El código actual es 1D (una cuña). El
   camino barato y honesto es **paneles 2D corridos en N estaciones de envergadura** (strip theory) y
   luego integrar — reusa `potencial.ts` casi tal cual. El camino caro es vortex-lattice 3D. **Hay
   que decidirlo antes de diseñar el contrato de datos.**

2. **¿Quién define "esto es un ala"?** El kernel entrega un sólido. Un solver aero necesita saber
   cuál es la dirección de envergadura, cuál el borde de ataque, dónde está el plano de simetría.
   ¿Se **infiere** de la geometría (frágil, como el bbox del viento actual), se **declara** por
   picking de caras/aristas (el patrón FEA, robusto), o el ala se construye con un **feature
   paramétrico "Ala"** que ya conoce su topología (lo más limpio, lo más trabajo)?

3. **¿Aeroelasticidad sí o no?** El puente Viento→FEA existe a medias (`FaceBC.pressure`). ¿Es un
   objetivo del módulo o una distracción?

4. **¿Qué se precomputa en iangpu y qué corre en vivo?** El CONTRATO del pliego aero ya define las
   etiquetas `[NAVEGADOR]` / `[PRECÓMPUTO]` / `[GPU-VIVO]`. Falta aplicarlas a cada método.
   Sugerencia: geometría y paneles 2D en el navegador; base de perfiles y polares barridas,
   precomputadas.

5. **¿El módulo aero vive en `forja-brep.html` (dentro del CAD) o en `physics.html` (labs) o en
   página propia?** Hoy está **partido**: los labs (`AeroAtmosfera`, `AeroFuerzas`, `Aerodynamics`)
   viven en physics con `window.__aeroLab`, y el Estudio Viento vive en el CAD con
   `window.__forgeBrep`. Las lecciones `a1-l1`/`a1-l4` traen `"url": "forja-brep.html"`. **Esa
   partición va a confundir tanto al alumno como al que escriba lecciones.**

6. **¿Se refactoriza `ForgeBRepStudio.tsx` antes o después?** Hay una decisión ya registrada en la
   memoria del proyecto de partirlo antes de más features. **Aero es "más features".**

7. **¿Se adopta `campo.ts` como sustrato del campo de flujo?** Nació explícitamente para sustituir
   las 7 rejillas artesanales del repo, **y `viento` está nombrada en esa lista**. Si el Estudio
   Viento se reescribe, ¿se hace sobre `campo.ts` o con su propia rejilla (y se vuelve la octava)?

8. **Unidades en la frontera**: el kernel es mm, `src/aero/` es SI. La lección `a1-l1` dibuja la cuña
   a **2007.64 mm** para que sea la cuerda de 2 m del libro. **¿El módulo aero trabaja en mm y
   convierte, o exige que la pieza esté a escala real?** Definirlo de una vez, por escrito, en el
   contrato de tipos.

---

*Auditoría hecha leyendo el código, no los docs. Tests corridos y verdes al momento de escribir:
`npx vitest run` → 67 archivos / 1197 tests / 21 s.
`npx vitest run src/aero src/forja/sim/viento.test.ts` → 32/32.*
