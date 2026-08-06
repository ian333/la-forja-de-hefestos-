# EL FRONTEND REAL DE LA FORJA — mapa quirúrgico para el ESTUDIO VIENTO

> Auditoría de código para el módulo **AERO** dentro de `forja-brep.html` (el Part Studio).
> Regla: **se reporta lo que el código HACE, no lo que dicen los docs.** ⚠️ marca dónde no coinciden.
> Documento hermano: [`forja-backend.md`](./forja-backend.md) (kernel, física, lecciones, gate).
> Medido el 2026-08-04 sobre `main` @ `982a887`. **NO se corrieron builds ni `tsc`** (regla del proyecto).

---

## 0. Los siete hallazgos que cambian el plan

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | ⚠️ **El Estudio Viento ya tiene MUCHÍSIMA más visualización de la que dice el reporte del backend.** No son "dos colores planos": hay **campo de partículas advectado** (`VientoFlowField`, hasta 6000 pts), **líneas de corriente** (`VientoStreamlines`, hasta 100), **onda de choque como haz de líneas**, rampa de Cp propia (`cpColor`) y **detección de tier de GPU** para PCs viejas de LATAM. Líneas **2049–2302**. | El 70 % de la plomería de render aero **YA EXISTE y sirve**. Lo que está mal es **de dónde salen los datos** (todo se deriva de un `WedgeFrame` analítico sacado del bbox), no cómo se dibujan. **No reescribas el render: reemplaza la fuente.** |
| 2 | El viewport CAD **no tiene EffectComposer** (deliberado, comentado en `2067`) y **no usa `<Text>` de drei**. Las etiquetas 3D ya se hacen con el patrón HUD-DOM (`CotaDriver`/`CotaLabels`). | Los dos gotchas del prompt **ya están respetados**. Las anotaciones aero (vector de sustentación, Cp máx) copian `CotaDriver` tal cual. El "glow" se finge con sprite aditivo, no con Bloom. |
| 3 | El canal de pintado sobre la piel es **un solo prop**: `SolidMesh.feaColors`, alimentado en la línea **6207** con `feaColors={vientoColors ?? feaColors}`. Es `Float32Array` RGB por vértice + `meshBasicMaterial vertexColors toneMapped={false}`. | Pintar Cp real por panel = **producir un `Float32Array` mejor**. Cero cambios de material, cero shader. |
| 4 | 🔴 **`window.__forgeBrep` NO expone la malla teselada** (`result.mesh.positions/faces/edgeGeoms`). Solo `invariants` con conteos. | Un módulo 100 % hermano (estilo `TutorialOverlay`) **no puede leer la geometría**. Este es EL obstáculo de la opción "cero cambios al monolito". Hay que abrir un puerto (§7). |
| 5 | ⚠️ `showTau` **no dibuja nada**. `VientoOverlay` recibe `showP/showTau/showShock` pero solo usa `showShock` (línea **2299**). `showP` gatea los colores de Cp desde fuera (línea **4614**). El botón `chk-viento-tau` solo mueve un booleano que el check de `a1-l1 p06` verifica. | **Las flechas de cortante τ no existen.** El texto del panel ("flechas p/τ") es aspiracional. Hueco limpio para construir. |
| 6 | El `useEffect` que monta el API tiene **102 dependencias** (contadas), líneas **5332–5865**. Ya carga 7 entradas de viento. | Cada campo nuevo del estudio aero mete otra dependencia. Es el argumento cuantitativo para sacar el módulo del monolito. |
| 7 | 🔴 **El sketcher NO puede recibir un perfil NACA** — no por lento (el solver hace 160 puntos en **0.8 ms** y el kernel ya extruye **440 vértices en producción**), sino porque **el snap de 10 px fusiona el 100 % de los puntos** y **no existe ni un hook de escritura de geometría** en `window.__sketchEditor`. Además apareció un **bug real**: la cota alineada de la CUERDA **no converge** (falla ya con 4 puntos). §4 | El perfil entra por **`window.__forgeBrep.loadDoc()`** con `smooth:true`, saltándose el croquis. **La lección AERO no puede ser "dibuja el perfil a mano"**: es "elige/teclea el NACA y el CAD lo construye"; el gesto humano se reserva para cuerda, envergadura y α. |

---

## 1. ÍNDICE QUIRÚRGICO de `ForgeBRepStudio.tsx` (8 929 líneas / 537 KB)

Ruta: `/home/ian/Orkesta/la-forja/src/forja/brep/ForgeBRepStudio.tsx`

### 1.1 Vista de pájaro

| Rango | Qué es | Tocable sin miedo |
|---|---|---|
| 1–20 | Docblock de filosofía del archivo | ✅ |
| 22–155 | **Imports** (React, three, R3F, drei, `viento.ts` en la 26) + 6 overlays `lazy` (29–34) + ~30 imports del dominio molde | ✅ (añadir uno más) |
| 157–335 | **Constantes y paletas**: `GLOBAL_AXES`, `GOLD/STEEL/INK`, `CAD_EDGE/CAD_BG`, `MATERIAL_PBR`, `PART_PALETTE`, `MATERIALS`, `FEA_MATERIAL_KEY`, defaults de rosca/rack/DIN/gearbox/gear | ✅ |
| 336–1621 | **Modelo del documento + constructores de geometría PUROS** (no-React): `SketchFeature`, `Op`/`OpType`, `Component`, `BuildResult`, `buildShape` (841), `buildDocSolid` (1123), toda la familia `buildGearbox*`/`buildCyc*`/`buildHembra`… | ⚠️ zona densa, no hace falta tocarla |
| 1622–1898 | Teselado a `PartGeo`, datos de movimiento de la caja, `applyPattern`, `buildAssembly`, `sweepMeshingInterference` | — |
| **1900–2302** | **COMPONENTES R3F de escena** — ver §1.2. Aquí vive el Estudio Viento visual | 🎯 **la zona aero** |
| 2304–2411 | `SectionGizmo` — plano de corte + **flecha arrastrable** (cilindro + cono). **El precedente de flecha 3D del proyecto** | 📋 copiar |
| 2412–2472 | `FeaDeformMesh` — la pieza **deformada animada** + fantasma en reposo | 📋 patrón |
| 2477–2791 | **`SolidMesh`** — el sólido, el picking de cara/arista, hover, resaltes, overlay de color | 🎯 **el canal de Cp** |
| 2793–2898 | `GenerativeVoxels`, `GenerativeSurface`, `ProfileGhost`, `SketchPlane` | — |
| 2899–2982 | `ViewController` — vistas preset, **la cámara VUELA (tween), nunca salta** | — |
| **2983–3107** | **`CadViewport`** — el `<Canvas>`: cámara, HDRI, luces, `OrbitControls`, ViewCube, piso | 🎯 leer antes de tocar |
| 3109–3210 | `CamToolpath3D`, `CamStock3D`, `CadGround` | — |
| 3211–3288 | `BindContext` + **`Dim`** — el control numérico canónico (label + input + scrub + ƒₓ) | 📋 usar |
| 3289–3379 | `DocState`, defaults, biblioteca `localStorage`, `faceLabel`, `feaLegendGradient` | — |
| **3380–8158** | **`export default function ForgeBRepStudio()`** — el componente. Ver §1.3 | 🎯 |
| 8160–8249 | Helpers de presentación: `Row`, `opIcon`, `opTitle`, `opSubtitle`, `CollapseHead`, `meshToStlBlob`, `triggerDownload` | 📋 usar |
| 8250–8929 | **`const CSS = \`…\``** — TODA la hoja de estilos del CAD, inyectada con `<style>{CSS}</style>` en la 5956 | 🎯 aquí van los estilos del panel aero |

### 1.2 La zona de escena R3F (1900–2302) — al detalle

| Líneas | Símbolo | Nota |
|---|---|---|
| 1900–1935 | `PartMesh` | pieza teselada + acabado + clip + emissive |
| 1936–1947 | `EnvBoundary` | ErrorBoundary del HDRI (un asset decorativo tumbó La Forja entera el 2026-07-21) |
| 1948–1968 | `GhostMesh` | resalte fantasma de componentes enterrados |
| 1996–2040 | `GearboxMotion` | animación cinemática |
| **2049–2063** | **`cpColor(cp, out, scale)`** | Rampa de presión: **azul frío ← 0 → ámbar cálido**. `scale` NORMALIZA al rango real de Cp de la escena (si se fija, un Cp chico sale gris). ⚠️ Es una rampa **divergente de 2 ramas**, distinta del `jetColor` del FEA. |
| 2069–2079 | `dotSprite()` | textura de punto radial cacheada (glow sin postFX) |
| 2080–2103 | `VientoQ` / `VIENTO_TIERS` / `detectVientoTier` / `resolveVientoQ` | **Calidad adaptable por GPU real** (lee `WEBGL_debug_renderer_info`): tier 0 = 650 pts sin animar; tier 1 = 2600; tier 2 = 6000 + glow |
| **2105–2128** | **`WedgeFrame` + `useWedgeFrame(bbox, r)`** | 🔴 **EL CUELLO DE BOTELLA.** Deriva del bbox: eje de cuerda = span mayor, eje de espesor = span menor, ápice = centro − medio-span. Todo el render aero cuelga de esto. |
| 2131–2133 | `wedgeToWorld(f, s, n, z, out)` | (s a lo largo de la cuerda, n ⊥, z envergadura) → mundo |
| 2135–2141 | `streamN(f, n0, s)` | 🔴 **cinemática de la línea de corriente HARDCODEADA a la cuña**: recta hasta cruzar el choque en `s = |n0|/tan β`, luego paralela a la cara |
| **2145–2207** | **`VientoFlowField`** | N partículas en `<points>`, un solo draw-call. Semilla por **secuencia áurea** (determinista, sin `Math.random`). `useFrame` reescribe `position`+`color` cada frame (o cada `throttle` frames). `PointsMaterial` + `AdditiveBlending` + `depthWrite:false` |
| **2210–2248** | **`VientoStreamlines`** | `<lineSegments>` con color por vértice, 14–24 segmentos por línea, geometría en `useMemo` (estática) |
| **2250–2302** | **`VientoOverlay`** | El contenedor. Monta streamlines + partículas + (si `showShock`) el haz de líneas del choque. ⚠️ **`showP` y `showTau` entran pero NO se usan aquí.** |

> **Uniforms**: no hay ni un `<shaderMaterial>` en todo el archivo. Los materiales son `PointsMaterial`/
> `LineBasicMaterial`/`meshBasicMaterial` construidos en `useMemo` y **los atributos de buffer se mutan**
> (`attr.needsUpdate = true`). El gotcha "uniforms nunca inline" **no aplica aquí porque no hay shaders
> propios** — pero el patrón equivalente (crear una vez con `useMemo`, mutar en `useFrame`) **ya se sigue
> al pie de la letra** en `VientoFlowField:2162-2205`. Cópialo.

### 1.3 Dentro de `ForgeBRepStudio()` (3380–8158)

#### Estado (3381–3648)

| Líneas | Bloque |
|---|---|
| 3381–3414 | Kernel (`oc`, `bootErr`, `opErr`), documento (`sketch`, `ops`, `material`, `assembly`, `result`) |
| 3415–3479 | UI: `pickMode`, `collapsed`, **ventanas flotantes** (`winPos`, se arrastran y se desacoplan), **`workspace`** (`'diseno'|'manufactura'|'simulacion'`) en la **3464** |
| 3480–3575 | Rollback, parámetros con ecuaciones, componentes, STEP, biblioteca, croquis-en-cara, `radial`, `partColor`, ribbon |
| **3576–3601** | **FEA**: `feaFixedFace`, `feaLoadFace`, `feaPickTarget`, `feaLoadN`, `feaResult`, `feaColors`, `feaDisp`, `feaLoadDir`, `feaErr`, `feaBusy`, `feaSessionRef`, `feaDirRef`, `feaSigRef`, `feaLiveMs` |
| **3602–3615** | **VIENTO**: `vientoOn`, `vientoMach`, `vientoAltM`, `vientoNPan`, `vientoShowP`, `vientoShowTau`, `vientoShowShock`, `vientoCalidad`, `vientoTier` |
| 3616–3623 | Generativo (topopt) |
| 3624–3648 | `selectedFaceId/EdgeId`, refs de STEP / eje / `resultRef` |

#### Efectos y callbacks (3649–5953)

| Líneas | Bloque |
|---|---|
| 3649–3675 | **Boot del kernel** con progreso real (el `.wasm` pesa 65 MB) |
| **3676–3821** | **`rebuild()`** — replay del grafo → `buildShape` → `tessellate` → invariantes + masa. La operación pesada |
| 3822–3957 | Undo/redo, serializar/cargar documento, insertar pieza, lobby de proyectos |
| 3958–4015 | Importar STEP, mutadores del perfil de revolución y del engrane |
| 4016–4313 | Mutadores del grafo (`addOp`/`updateOp`/…), features engrane/gearbox/rosca/rack/DIN, ensamble, verificación de embonado |
| **4314–4390** | **`runFeaAnalysis(loadDirOverride?)`** — el flujo FEA completo (§2) |
| 4392–4412 | `feaLiveSetLoad(N)` — FEA en vivo con sesión cacheada + warm-start |
| 4414–4461 | `runGenerative(...)` |
| 4462–4567 | Export STL, imprimibilidad/voladizos, movimiento y cuerpos de la caja |
| 4568–4592 | **Sección**: `sectionOn/Axis/Offset/Flip` + **`meshBBox`** (4577) — el AABB inline de la UI |
| **4593–4607** | **`vientoResult`** — mide δ del bbox y corre `estudioVientoSupersonico` |
| **4609–4635** | **`vientoColors`** — el `Float32Array` de Cp por vértice (clasificación por bbox) |
| 4637–4660 | `sectionClip` (plano estable mutado por la flecha) |
| 4661–5088 | **CAM**: planos 2D, careado, ranura, taladrado, roscado, bore, adaptive 3D, torno, láser, FDM |
| 5089–5237 | Caducidad de overlays al cambiar la geometría; selección de cara/arista para la op activa |
| 5238–5330 | Boceto con el mouse, atajos de teclado, paleta "S" |
| **5332–5865** | 🔴 **EL `useEffect` GIGANTE** — construye `api` (~99 métodos/getters), lo monta en `window.__forgeBrep` (**5848**) y monta `window.__forja` (**5851**). **102 dependencias.** Drivers de viento en **5666–5690** |
| 5866–5910 | `cameraDist`, auto-encuadrar |
| 5911–5953 | Croquis en escena (`sketchPlaneK`, cámara ⊥ al plano, zoom del boceto) |

#### JSX (5954–8158)

| Líneas | Bloque | `data-testid` |
|---|---|---|
| 5955–5956 | `<div className="fb-root">` + `<style>{CSS}</style>` | — |
| 5958–5991 | Pantalla de carga del kernel | `boot-overlay` |
| 5998–6224 | **`.fb-viewport` → `<CadViewport>` → `<group rotation={[-π/2,0,0]}>`** | `viewport`, `viewport-canvas` |
| 6027–6030 | Stock + toolpath CAM (solo `manufactura`) | — |
| 6031–6034 | Plano de croquis + fantasma del perfil | — |
| 6035–6164 | Molde en vivo (placas, cotas, pinturas térmicas) | — |
| 6165–6211 | **La cadena de render del sólido** (ver §3.1) | — |
| 6213–6216 | `SectionGizmo` | — |
| **6218–6222** | **`<VientoOverlay …/>`** | — |
| 6226–6233 | **Etiquetas de cota 3D FUERA del Canvas** (divs HUD) ← el gotcha de `<Text>` documentado en el propio código | — |
| 6236–6238 | `<SketchEditor>` (overlay SVG sobre el viewport) | — |
| 6242–6258 | Selector de plano de boceto | `sketch-chooser` |
| 6261–6276 | **`<RadialMenu>`** (clic derecho) | — |
| 6278–6341 | Overlays lazy a pantalla completa (ciclo, 3 placas, desenrosque, corte, máquina, lote) | `btn-cycle-sim`… |
| 6342–6350 | Pista de picking | `pick-hint` |
| 6351–6406 | HUD de sección | `section-hud` |
| 6407–6431 | HUD de ensamble | `hud-assembly` |
| **6432–6459** | **Leyenda FEA** (barra de gradiente + ticks en MPa + factor de exageración) | `fea-legend`, `fea-legend-max`, `fea-amp` |
| 6461–6578 | Header: título, **pestañas de workspace** (6473–6481), undo, menú ⋮ | `tab-diseno`, `tab-manufactura`, **`tab-simulacion`** |
| 6579–6719 | Toolbar/ribbon por workspace | `btn-sketch`, `btn-extrude`, `btn-cam-*` |
| 6720–6728 | HUD de vista | `hud-view` |
| 6729–7138 | **Riel IZQUIERDO**: árbol del documento (6730), lista de caras (6896), **panel de simulación (6918–7137)** | `rail-left`, `feature-tree`, `face-list`, **`sim-panel`** |
| 7139–8110 | **Riel DERECHO**: parámetros de la op activa (7140), análisis/propiedades (7892), tabla de parámetros | `rail-right`, `op-panel`, `analysis-panel`, `params-panel` |
| 8112–8157 | Overlays de plano 2D y CAM (SVG a pantalla completa) | `plano-overlay`, `cam-overlay` |

---

## 2. EL FLUJO DE UI DEL FEA — pantalla por pantalla, con nombres reales

Este es el molde que el Estudio Viento debe copiar.

### Paso 1 — Entrar a Simulación
`workspace` (estado, línea **3464**) pasa a `'simulacion'` por el botón `data-testid="tab-simulacion"`
(**6479**) o por `window.__forgeBrep.setWorkspace('simulacion')`. Eso monta el `<aside>` con
`data-testid="sim-panel"` (**6918–7137**), en el **riel izquierdo**, debajo del árbol y la lista de caras.
El panel es **arrastrable** (`onPointerDown={winDrag('sim')}`) y se **desacopla con doble clic**
(`winUndock('sim')`).

### Paso 2 — Elegir la cara FIJA
1. `<button data-testid="btn-pick-fija" className="fb-pick-btn">` (**6957**) → `startFeaPick('fija')`
   → pone `feaPickTarget = 'fija'` y el botón se tiñe de `${GOLD}33`.
2. El usuario **hace clic real en la pieza** en el viewport.
3. **El picking** (`SolidMesh.handleClick`, **2589–2604**): el raycast de three.js entrega
   `e.faceIndex` (índice de TRIÁNGULO). El kernel etiquetó cada triángulo con su cara OCCT:
   ```ts
   const ti = e.faceIndex;
   if (ti != null && ti >= 0 && ti < mesh.faceIds.length) { onPickFace(mesh.faceIds[ti], e.point); return; }
   ```
   Triángulo → `faceIds[ti]` → **faceId B-Rep estable**. Sin heurística. Fallback por centroide más cercano.
4. `togglePickFace` enruta a `feaFixedFace` cuando `feaPickTargetRef.current === 'fija'`.
5. Se muestra en `<span data-testid="fea-fija-id">#N</span>` (**6962**).

**Hover y selección** (gratis, ya construidos, y **reusables para aero**):
- `handlePointerMove` (**2619**) pre-resalta la cara bajo el cursor → `hoverGeo` (**2640–2654**), una
  sub-malla armada con los `mesh.faceGroups` de esa cara, pintada de oro tenue `#f3bf8e` @ 0.3.
- La cara **seleccionada** (`highlightGeo`, **2563–2582**) va en **azul CAD** `#4C9FFF` + emissive
  `#2F7FE0` @ 0.45 con `polygonOffset` (convención Fusion/Onshape/SolidWorks).
- Las **aristas** son pickeables con **tubos invisibles** por arista (`TubeGeometry` sobre la polilínea
  exacta del kernel, **2543–2554**), en dos radios: fino = objetivo de raycast, grueso = resalte.

### Paso 3 — Cara de carga y magnitud
`btn-pick-carga` → `feaLoadFace` (`fea-carga-id`). La magnitud entra por el control canónico
`<Dim label="Carga" … testid="input-carga">` (**6978–6980**) en **newtons**, que en `onChange` llama a
`feaLiveSetLoad` si ya hay sesión cacheada (repinta en ms) o solo a `setFeaLoadN`.

### Paso 4 — Correr
`<button className="fb-fea-run" data-testid="btn-fea">` (**6982**) → `runFeaAnalysis()` (**4320–4390**).
Corre **en el main thread** dentro de `requestAnimationFrame` (para que la UI pinte "⏳ Resolviendo
K·u = f…" antes de congelarse). **No hay worker.**

Además hay una **rejilla de 6 direcciones** `fea-dirs` (**6989–7007**), `data-testid="fea-dir-0-0-1"` etc.,
que re-resuelve al vuelo empujando en ±X/±Y/±Z. El botón activo se marca comparando con `feaLoadDir`.

### Paso 5 — Cómo se PINTA el von Mises sobre la pieza (**el patrón que aero copia**)

**No hay shader.** Son tres piezas:

1. **El campo → colores por vértice** (`fea.ts:1126` `vonMisesVertexColors(result, positions)`):
   - muestrea el campo nodal del tet-mesh sobre **los vértices de la malla de RENDER**;
   - ⚠️ **normaliza por el PERCENTIL 98, no por el máximo** (`fea.ts:1148`) — un nodo singular en un
     filete aplastaba todo el campo;
   - `jetColor(t)` (`fea.ts:1088`, exportada) → rampa tipo Turbo con el extremo bajo en azul profundo.
   - Devuelve `{ colors: Float32Array /* 3·N, RGB 0..1 */, vmPerVertex }`.
2. **El estado**: `setFeaColors(colors)` (**4375**). Paralelamente `feaVertexDisplacements` →
   `setFeaDisp(disp)` + `feaDispMaxRef.current = maxMag`.
3. **La GPU**: el prop viaja hasta `SolidMesh` (línea **6207**):
   ```tsx
   feaColors={vientoColors ?? feaColors}
   overhangColors={showOverhangs ? overhangColors : null}
   ```
   Dentro de `SolidMesh` (**2503**) `const overlayColors = overhangColors ?? feaColors;` — hay una
   **prioridad explícita: voladizos > FEA/viento**. Y en **2518–2525** el efecto pega/quita el atributo:
   ```ts
   if (overlayColors && overlayColors.length === mesh.positions.length)
     geom.setAttribute('color', new THREE.BufferAttribute(overlayColors, 3));
   else if (geom.getAttribute('color')) geom.deleteAttribute('color');
   ```
   El material se **cambia por completo** cuando hay overlay (**2668–2700**):
   ```tsx
   <meshBasicMaterial vertexColors color="#ffffff" toneMapped={false}
                      clippingPlanes={clipPlanes} side={THREE.DoubleSide} />
   ```
   `meshBasicMaterial` = **SIN luz**: un mapa de campo debe leerse fiel en cualquier ángulo, sin que el
   HDRI ni las sombras lo tiñan. `toneMapped={false}` lo saca del ACES. Las aristas B-Rep oscuras
   siguen encima y dan la forma.

   > **Invariante duro**: `overlayColors.length === mesh.positions.length`. Si no coincide, **el overlay
   > se ignora en silencio**. Es la trampa #1 al generar Cp desde otra malla.

4. **La leyenda** (**6432–6459**): `.fb-fea-legend`, barra con `background: feaLegendGradient()` que
   **muestrea el MISMO `jetColor`** (helper en **3366**), ticks en MPa, `data-testid="fea-legend-max"`.

5. **La deformada**: cuando hay `feaDisp` **y** `feaColors`, el render cambia de `SolidMesh` a
   `FeaDeformMesh` (**6190–6193**), que amplifica el desplazamiento a ~14 % de la diagonal del bbox y lo
   **pulsa** con un coseno de periodo 2.6 s, con un fantasma de aristas en reposo.

### Paso 6 — Sesión incremental
`prepareFeaSession` cachea malla + K con Dirichlet + `tetB`; `solveLoadOnSession` solo arma `f` y corre
el CG con warm-start. `feaLiveMs` muestra los milisegundos. **Ese es el patrón exacto para una polar
CL(α)**: la matriz de influencia de paneles no depende de α.

### Paso 7 — El API para lecciones/agentes
Todo cuelga de `window.__forgeBrep` (montado en **5848**). FEA: `setFeaFixedFace`, `setFeaLoadFace`,
`setFeaLoad`, `runFEA`, `runFEADir`, `feaLiveSetLoad`, `get feaResult`.
Viento: **5666–5690** — `setViento`, `setVientoMach`, `setVientoAlt`, `setVientoPaneles`,
`setVientoShow(kind,on)`, `setVientoCalidad`, `get vientoTier`, `get viento`.

---

## 3. EL VIEWPORT R3F Y SUS CAPACIDADES DE OVERLAY

### 3.1 Cómo se renderiza el sólido

`CadViewport` (**2983–3107**) es un `<Canvas>` con:
- `shadows="percentage"` (PCFShadowMap; el Soft está deprecado y ensuciaba la telemetría 66×/sesión)
- cámara perspectiva `fov 35`, `near 0.01`, `far 20000`, en 3/4 de CAD
- `gl={{ antialias:true, alpha:true, powerPreference:'high-performance' }}`, `dpr={[1.5, 2]}`
- `onCreated`: `ACESFilmicToneMapping`, `toneMappingExposure = 0.90`, **`gl.localClippingEnabled = true`**
- `<Environment files="/hdri/studio_small_03_1k.hdr">` dentro de `EnvBoundary` + `Suspense`
- 1 `ambientLight` + 3 `directionalLight`
- `<OrbitControls makeDefault enableDamping>`, `<ViewController>`, `<GizmoViewcube>` con `hoverColor={GOLD}`
- **fondo**: `radial-gradient(#16283F → #0C1626 → #050A14)` en el `div` padre, `Canvas` transparente

✅ **Verificado: NO hay `EffectComposer` ni `<Text>` de drei en este viewport.** Los dos gotchas del
prompt **ya están honrados por el código** — el comentario de la línea **2067** lo dice literal ("Sin
EffectComposer (el viewport del CAD lo prohíbe): el glow del modo Ultra se finge con sprite aditivo") y
el de la **6226** también ("drei `<Text>` dentro del Canvas es el gotcha conocido").

**Todo el contenido va dentro de `<group rotation={[-Math.PI/2, 0, 0]}>`** (línea **6025**): el CAD es
Z-arriba y three.js Y-arriba. **Cualquier cosa que dibujes para aero debe colgar de ese grupo** o
duplicarás la rotación. La conversión modelo→mundo es `(x,y,z) → (x, z, −y)` (se usa literal en **6022**
y **6654**).

La **cadena de render del sólido** (6165–6211), en orden de prioridad:
```
gbMotion+gbParts        → GearboxMotion
gearbox+showOverhangs   → SolidMesh(overhangColors)
gearbox+gbBodyGeos      → PartMesh por cuerpo
genResult               → GenerativeSurface | GenerativeVoxels
result+feaDisp+feaColors→ FeaDeformMesh          ← la deformada gana
result                  → SolidMesh(feaColors = vientoColors ?? feaColors)
```

### 3.2 Qué YA se puede hacer (inventario para aero)

| Necesidad aero | ¿Existe? | Dónde / cómo |
|---|---|---|
| **Cp pintado sobre la piel** | ✅ **el canal completo** | `SolidMesh.feaColors` (prop) → atributo `color` → `meshBasicMaterial vertexColors toneMapped={false}`. Alimentado en **6207**. Rampa `cpColor` en **2058**. |
| **Líneas de corriente alrededor del sólido** | ✅ **el dibujo**, ❌ **los datos** | `VientoStreamlines` (**2210**) dibuja `lineSegments` con color por vértice y `AdditiveBlending`. Pero las posiciones salen de `streamN()`, cinemática analítica de cuña. |
| **Campo de partículas / schlieren** | ✅ **el dibujo**, ❌ **los datos** | `VientoFlowField` (**2145**): `<points>` de hasta 6000, sprite radial, un draw-call, animado en `useFrame` con throttle por tier. Semilla áurea determinista. |
| **Onda de choque** | ✅ (haz de líneas) | `VientoOverlay:2268–2290`. Se dibuja como haz de líneas brillantes `#FFD9A0` en 9 planos de envergadura: de perfil se lee como la V del schlieren, en ISO no tapa la pieza. |
| **Flechas 3D (presión, fricción, sustentación)** | ❌ **no existen** — pero hay precedente exacto | `SectionGizmo:2389–2398`: `cylinderGeometry` (mango) + `coneGeometry` (punta) con `meshStandardMaterial` + `toneMapped={false}`. También `ForgeMechStudio.tsx:167`. |
| **Anotaciones/etiquetas 3D** | ✅ **patrón completo** | `MoldCotas3D.tsx`: `CotaLines` (líneas dentro del Canvas), **`CotaDriver`** (`useFrame` → `localToWorld` + `v.project(camera)` → muta `el.style.transform` de divs) y `CotaLabels` (los divs, **fuera** del Canvas). Ver `MoldCotas3D.tsx:65-88`. **Es la vía correcta para el vector de sustentación etiquetado.** |
| **Polilíneas curvas** | ✅ | `drei <Line>` ya se usa en `ForgeMechStudio.tsx:229`. |
| **Picking de cara → faceId B-Rep** | ✅ exacto | `SolidMesh:2589`. |
| **Segmentar la piel por cara** | ✅ | `mesh.faceGroups` (`{faceId, start, count}`) — así se arma `highlightGeo`/`hoverGeo`. **Extradós/intradós/borde de salida salen de aquí sin heurística.** |
| **Corte de sección** | ✅ | `sectionClip` + `clippingPlanes` en cada material. |
| **Calidad adaptable por GPU** | ✅ | `detectVientoTier` (**2088**) — reusar tal cual. |
| **Escala de color / leyenda** | ✅ para von Mises, ❌ para Cp | `.fb-fea-legend` (**6432**) está **hardcodeada a "von Mises (MPa)"** y a `feaResult`. Hace falta una hermana de Cp. |

### 3.3 Qué FALTA construir (y cómo)

| Falta | Costo | Receta |
|---|---|---|
| **Cp por PANEL real** | Medio | `panelSkin()` (ver `forja-backend.md` §2.3) → Cp por panel → **promediar a vértices** (cada vértice = media ponderada por área de sus triángulos) → `Float32Array` de `positions.length`. **Normaliza por percentil, no por máximo** — el borde de ataque tiene la misma patología que el filete del FEA (Cp→1 en estancamiento, muy negativo en el pico de succión). |
| **Streamlines de un campo real** | Medio-alto | Sustituir `streamN()` por integración RK4 sobre el campo de velocidad. `src/aero/potencial.ts` **ya trae el RK4 de líneas de corriente y de parcelas**. Para 3D, `src/forja/campo/campo.ts` es el sustrato candidato. La geometría de `VientoStreamlines` es `useMemo` estática: recalcularla al cambiar α es un re-`useMemo`, no un rediseño. |
| **Flechas de presión (⊥ a la piel) y de fricción (tangentes)** | Bajo | Un `InstancedMesh` de conos + un `lineSegments` para los mangos, sembrado en los centroides de panel con `scale ∝ |Cp|` y **color por signo** (`cpColor`). Un solo draw-call por tipo. Copiar el par cilindro+cono de `SectionGizmo:2389`. ⚠️ Sembrar **submuestreado** (1 de cada k paneles), o 3000 conos matan el frame. |
| **Vector de sustentación** | Bajo | Una flecha grande desde el centro aerodinámico + etiqueta HUD por `CotaDriver`. |
| **Leyenda de Cp** | Bajo | Clonar `.fb-fea-legend` + `feaLegendGradient()` muestreando `cpColor` en vez de `jetColor`, con rótulo "Cp" y ticks **con signo** (la rampa es divergente: −|Cp|max … 0 … +1). |
| **Estela / vórtices de punta** | Alto | Nada. |
| **Aguja de α (ángulo de ataque)** | Bajo | Gizmo de arco + `Dim` en el panel. |

---

## 4. EL CROQUIS (SKETCHER) — ¿aguanta un perfil NACA de 100-160 puntos?

> **Todo lo de esta sección está MEDIDO** corriendo el código real de producción con `tsx`, no estimado.

### 4.1 Veredicto en una línea

> **El solver NO revienta. El DOM NO revienta. El kernel NO revienta.**
> **Lo que revienta es la capa de ENTRADA: es físicamente IMPOSIBLE dibujar el perfil a mano, y no
> existe ningún hook para inyectarlo al SketchEditor.**
> **Hay salida limpia: `window.__forgeBrep.loadDoc()` se salta el croquis 2D por completo.**
> **Y de paso apareció un BUG REAL en la cota de la cuerda.**

| Componente | Veredicto | Número |
|---|---|---|
| Solver, contorno libre 160 pts | ✅ **VA BIEN** | **0.8 ms** (320 incógnitas, dof 320) |
| Solver, arrastrar sin restricciones | ✅ **VA BIEN** | **0.8 ms/frame → 1219 fps** |
| Solver, con 1 cota | ✅ **VA BIEN** | **42 ms** |
| Solver, arrastrar con TODO acotado | 💥 **REVIENTA** | **2 229 ms/frame → 0.4 fps** |
| Solver, **cota de la CUERDA (alineada)** | 💥 **BUG** | `iters=0`, `status='over'` (rojo), **falla desde n=4** |
| DOM / SVG | ✅ **VA BIEN** | ≈405 nodos; hit-test **0.21 ms/move** |
| Kernel OCCT | ✅ **VA BIEN** | **440 vértices ya en producción** |
| **Dibujarlo a mano** | 💥 **IMPOSIBLE** | snap 4.545 mm vs. separación 0.0385 mm → **80/80 puntos colapsan** |
| **Inyectarlo al SketchEditor** | 💥 **NO EXISTE** | cero hooks de escritura de geometría |
| **Inyectarlo al Studio** | ✅ **VA BIEN** | `loadDoc()` (`ForgeBRepStudio.tsx:5407`) |

### 4.2 Modelo de datos (`src/forja/brep/sketch-solver.ts:18-57`)
```ts
SkPoint { x, y, fixed? }   // :18
SkLine  { a, b, constr? }  // :19 — a/b son ÍNDICES a points[]
SkCircle{ c, r }           // :20
SkArc   { c, p0, p1 }      // :21
```
🔴 **No existe entidad spline ni polilínea.** Todo es segmento a segmento: 160 puntos = 160 `SkPoint` +
160 `SkLine`. **No hay límite duro** en ningún lado (ni constante, ni assert, ni guard). Los arcos se
teselan a 32, los círculos a 64, las elipses a 48. La herramienta `line` (`SketchEditor.tsx:340-348`)
**no agrega ninguna restricción automática**.

### 4.3 El solver: Levenberg-Marquardt, Jacobiano NUMÉRICO, álgebra DENSA

| Pieza | Línea | Costo |
|---|---|---|
| Jacobiano por diferencias centradas | `:192-205` | **2n** evaluaciones completas de residuales |
| Ecuaciones normales JᵀJ | `:296-305` | **O(n²·m)** |
| `solveDense` (Gauss-Jordan) | `:208-226` | **O(n³)**, hasta **8 veces por iteración** (`:307`) |
| `rankAndMovable` (RREF para el DOF) | `:232-261` | **O(m·n²)**, una vez al final |

2 incógnitas por punto libre; `maxIters = 80`, `tol 1e-9` (`:272`), y **nadie los sobreescribe**:
`commit` (`SketchEditor.tsx:162`) y el drag (`:287`) llaman `solveSketch(copy)` sin opciones.

**Por qué 160 puntos libres son gratis**: con 0 restricciones `residuals()` devuelve `[]` → `m = 0` → sale
en la iteración 0 y `rankAndMovable` cortocircuita (`:235`). **El O(n³) nunca se ejecuta.**

**Por qué acotar TODO sí duele**: 161 restricciones llenan JᵀJ y el Gauss-Jordan se vuelve real:
**177 ms/frame a n=80, 2 229 ms/frame a n=160** — y `onPointerMove` (`SketchEditor.tsx:287`) llama a
`solveSketch` en **cada** evento de puntero, **sin debounce ni rAF**.

### 4.4 🔴 BUG REAL: la cota de la CUERDA no converge

Al acotar `distance` entre dos puntos **casi colineales con un eje** —exactamente el borde de fuga → borde
de ataque de un perfil alar, que es casi horizontal— **el solver no mueve nada, sale con `iters=0` y marca
el croquis `over` (rojo)**. Reproducido con **4 puntos**, no con 160:

| pendiente `y1` | iters | status | resultado |
|---|---|---|---|
| 0 | 4 | under | ✅ |
| 1e-9 | 4 | under | ✅ |
| **1e-6** | **0** | **over** | ❌ no se mueve |
| **0.126** (TE de un NACA 2412) | **0** | **over** | ❌ |
| **1.0** | **0** | **over** | ❌ |
| 5.0 / 20 / 100 | 8 / 4 / 3 | under | ✅ |

Rango de falla: pendiente relativa ~1e-8 … ~0.03.

**Causa** (`sketch-solver.ts:208-226` + `:308`): `A = JᵀJ + λ·diag(JᵀJ) + 1e-12·I`; las variables no
involucradas quedan con diagonal `1e-12`, y el guard de pivote es `< 1e-14` (`:214`) → **sí pivota sobre
1e-12** y multiplica la fila por 1e12. Con la cancelación catastrófica del bloque 2×2 casi singular
(∂r/∂y ≈ 0.00126 vs. ∂r/∂x = 1), el `delta` sale basura → `costNew > cost` → los 8 reintentos fallan →
`applied = false` → `break` (`:318`) con `iters = 0`.

**Workaround verificado**: las cotas **`distX` / `distY`** (botones `↔` y `↕` del popup,
`SketchEditor.tsx:1340-1341`) convergen sin problema en el mismo caso (`iters=4`, residuo 5.7e-14). Sus
residuales son **lineales** (`sketch-solver.ts:115-116`).

⚠️ **Por qué nunca se detectó**: `npx vitest run src/forja/brep/sketch-solver.test.ts` pasa 14/14 en 24 ms,
pero **ninguno de sus casos toca geometría casi-alineada ni n>10**.
👉 **Acción**: añadir un test de regresión con el caso de la pendiente 0.126 antes de tocar nada de aero.

### 4.5 Por qué dibujarlo a mano es IMPOSIBLE (no lento: imposible)

`snapOrAdd` (`SketchEditor.tsx:246-253`) fusiona cualquier clic a menos de **10 px** de un punto existente.
Y la escala tiene techo duro: `scale = min(w,h)·0.44 / max(140, |x|, |y|)` (`:149-154`) → con canvas
1000×700, **máximo 2.2 px/mm**.

```
umbral de snap efectivo                       10 px / 2.2 = 4.545 mm
separación mínima, NACA 160 pts, cuerda 100 mm, coseno   0.0385 mm  (borde de ataque)
separación máxima (centro)                              1.963 mm
puntos que se FUSIONAN                                   80 de 80  (100 %)
```
**Ni un punto sobrevive.** El alumno haría 160 clics y obtendría ~4 puntos. Y `nearestPoint` para
seleccionar/acotar usa 12 px = 5.45 mm, así que **tampoco puede agarrar el punto que quiere**.

### 4.6 El render NO es el problema
SVG puro, un nodo DOM por entidad: 160 `<line>` (`:1312-1318`) + 160 `<circle>` (`:1326-1328`) + badges +
cotas ≈ **405 nodos**. El grid y los ejes **sí están memoizados** (`:1095`, `:1099`).
`computeSnap` (`:183-221`) corre en cada `onPointerMove` con un doble bucle O(L²) para intersecciones
(12 720 pares a n=160) → **0.21 ms/move medido**. No es cuello de botella.

### 4.7 Cómo entra un contorno programáticamente

**A `window.__sketchEditor`: NO SE PUEDE.** Lista completa de hooks (`SketchEditor.tsx:1013-1064`):
- **lectura**: `ready`, `dof`, `status`, `free()`, `nPoints`, `nLines`, `nCircles`, `points()`, `lines()`,
  `circles()`, `arcs()`, `toPx(x,y)`, `svgRect()`, `profile()`, `holes()`
- **escritura**: `pick(kind,i)`, `clearPick()`, `dimDist(p,q,axis?)`, `dimArcR(ai)`, `dimDiam(ci)`,
  `dimAngle(l1,l2)` — **solo selección y cotas**

🔴 **No hay `setPoints`, `setModel`, `loadPolygon`, ni preset `custom`.**

**La vía que SÍ funciona: `window.__forgeBrep.loadDoc()`** (definido en `ForgeBRepStudio.tsx:3883-3904`,
expuesto en **5407**):
```js
window.__forgeBrep.loadDoc({
  version: 1, name: 'NACA 2412',
  sketch: { kind: 'custom', customProfile: [/* 160 pts {x,y} */], smooth: true, plane: 'xy', /* …resto */ },
  ops: [{ id: 'extrude-1', type: 'extrude', depth: 200 }],
});
```
Entra directo a `SketchFeature.customProfile` (**277-313**) y **se salta el SketchEditor, el solver y el
SVG por completo**. También existe importar un JSON de documento desde la UI (`importDocFile`, **3953**,
botón en **6518**).

### 4.8 El camino al sólido — el kernel ya vive con más que esto

| Función | Línea (`occt.ts`) | Límite | Uso REAL en producción |
|---|---|---|---|
| `extrudePolygon` | **315-332** | solo `≥3` puntos (`:321`), **sin techo** | **440 vértices** (engrane involuta) |
| `extrudeSpline` | **417-474** | `≥4` puntos (`:423`) | **150 puntos** (disco cicloidal) |

Evidencia medida, no docs: `buildGearSketch(Z=20)` → **440 verts** por `extrudePolygon`; el comentario de
`ForgeBRepStudio.tsx:402` lo dice literal (*"Para Z=20 son ≈ 440 verts: B-Rep exacto lo aguanta (el límite
~400 era del SDF)"*). **160 puntos es 2.75× menos de lo que ya corre.**
`extrudeSpline` usa `GeomAPI_PointsToBSpline_2(arr, 3, 8, C2, 1e-3)` (`occt.ts:441`) con **fallback
automático a `extrudePolygon` en el `catch`** (`:470-473`) — nunca truena.

⚠️ **Trampa**: `ForgeBRepStudio.tsx:4168` — al terminar un croquis desde el editor,
`smooth: false` **está hardcodeado** y no hay toggle en la UI. Un perfil que salga del SketchEditor
**siempre** va por `extrudePolygon` (facetado). Para superficie curva real hay que entrar por `loadDoc`
con `smooth: true` (el único `smooth: true` del archivo es la plantilla cicloidal, **3326**).

### 4.9 Recomendación para el perfil alar

1. **Generar el NACA fuera** (función de ~15 líneas, espaciado coseno; `src/aero/potencial.ts` ya trae
   `nacaProfile(t, n)` para la serie 00xx — hay que extenderla a 4 y 5 dígitos).
2. **Meterlo con `loadDoc({ sketch:{ kind:'custom', customProfile, smooth:true }, ops:[{type:'extrude',…}] })`**
   → `extrudeSpline` → una sola arista curva, cara lateral suave, plano de taller con curva de verdad.
   Es **exactamente** lo que hace el disco cicloidal de producción con 150 puntos.
3. **No abrir el SketchEditor para este perfil.** Si el alumno debe "acotar la cuerda" como gesto
   pedagógico, hazlo con **parámetros del documento** (`params`/`bindings` + el `bindKey` de `Dim`), no
   con el solver 2D.
4. Si de todos modos se acota dentro del croquis: **usar `↔`/`↕` (distX/distY), NUNCA la cota alineada**
   (§4.4), y **no acotar todos los segmentos** (2.2 s por frame al arrastrar).
5. Si `smooth: true` redondea de más la punta afilada del borde de fuga, `smooth: false` con 160 puntos
   es igual de seguro — el engrane ya vive con 440.

> **Consecuencia para el diseño de la lección**: la clase AERO **no** puede ser "dibuja un perfil NACA a
> mano". Tiene que ser **"elige el perfil de una biblioteca / tecléale los 4 dígitos y el CAD lo
> construye"**, y el gesto humano se reserva para la CUERDA, la ENVERGADURA y el ÁNGULO DE ATAQUE — que
> sí son cotas honestas de un punto o dos. Eso además es lo que hace un ingeniero real.

---

## 5. LA UI DE LA ESCUELA DENTRO DEL CAD — el precedente de integración limpia

Archivo: `/home/ian/Orkesta/la-forja/src/escuela/mecanica/TutorialOverlay.tsx` (351 líneas).

### 5.1 El montaje — **la afirmación es CIERTA**, con un matiz que importa

`/home/ian/Orkesta/la-forja/src/forja-brep-main.tsx`:
```tsx
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModuleErrorBoundary moduleName="La Forja · Part Studio B-Rep" branchAccent="#FDB813">
      <ForgeBRepStudio />                    {/* línea 19 */}
      {/* ?leccion=<id> monta el tutorial interactivo (hermano del Studio,
          cero acoplamiento — habla por window.__forgeBrep). */}
      <TutorialOverlay />                    {/* línea 22 */}
    </ModuleErrorBoundary>
  </StrictMode>,
);
```
**Grep inverso verificado**: `ForgeBRepStudio.tsx` **no importa nada** de la escuela (solo dos comentarios
sueltos que dicen "Tutorial 1 de Fusion", líneas 299 y 3763). `TutorialOverlay.tsx` importa **solo React**.

⚠️ **El matiz honesto**: el acoplamiento no es cero, es **por contrato de runtime**, no por import. El
overlay depende de cuatro cosas del monolito:
1. el nodo DOM `.fb-root` (creado en **5955**) — al que **le muta el `style.transform` inline** para el
   zoom cinematográfico (`TutorialOverlay.tsx:130-162`);
2. `window.__forgeBrep` (**5848**);
3. `window.__sketchEditor` (`SketchEditor.tsx:1014`);
4. los `data-testid` de los botones.

**Esa es exactamente la superficie que el módulo aero puede usar… y su límite.** Nótese que `.invariants`
no incluye la malla: por eso un hermano puro no puede pintar Cp (§0, hallazgo 4).

### 5.2 Cómo carga la lección
```ts
const leccionId = useMemo(() => new URLSearchParams(location.search).get('leccion'), []);   // :165
fetch(`/escuela/lecciones/${leccionId}.json`)                                                // :174
  .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
  .then(setLec).catch(() => setLec(null));
```
Sin `?leccion=` o si falla el fetch → **`return null` (línea 257): render cero, costo cero.** Ése es el
truco de la integración limpia. El paso actual es estado local (`const [i, setI] = useState(0)`, :167).

### 5.3 Qué pinta
Tres piezas, **todas con estilos inline** (cero clases `.fb-*`), porque vive fuera del árbol del monolito:
- **Tarjeta de guía** (`:300-334`): `position:'fixed', right:16, bottom:16, zIndex:9000, width:420`,
  `background:'rgba(10,14,20,.96)'`, `border:'1px solid #2a3546'`, `borderRadius:14`, `color:'#e9eef5'`,
  Inter. Chip `ESCUELA · U{unidad} L{n}` en `GOLD`. Contador `Paso i/n · verificados d/t`.
- **Subtítulo de cine** (`:267-278`), modo reproducir: `bottom:92, zIndex:9500`, píldora con
  `backdropFilter:'blur(10px)'`, `font:'600 clamp(18px,2.3vw,27px)/1.32 Inter'`, animación `subin .34s`.
- **Transporte** ⏮ ■ ⏭ (`:284-296`), `zIndex:9600`, píldora `borderRadius:999`.

**z-index 9000 / 9500 / 9600** — muy por encima de todo el Studio (su modal más alto, `.fb-plano-overlay`,
es `z-index:80`). No hay pelea de capas. **Un panel aero hermano debe respetar ese rango** o tapará al tutor.

### 5.4 Cómo resalta un control
**No hay halo ni spotlight**: **muta el `outline` inline del elemento real**, sondeando cada 700 ms
(`:194-209`):
```ts
const target = (paso.gestos ?? []).find(g => (g.type === 'tclick' || g.type === 'fill') && g.testid);
const tick = window.setInterval(() => {
  const el = document.querySelector<HTMLElement>(`[data-testid="${target.testid}"]`);
  if (el && el !== hlRef.current) { el.style.outline = `2px solid ${GOLD}`; el.style.outlineOffset = '2px'; }
}, 700);
```
Solo en **modo GUÍA** (`if (!paso || playing) return`) y solo para gestos `tclick`/`fill`.
👉 **Consecuencia directa para aero: cualquier control nuevo necesita `data-testid` o la escuela no lo
puede resaltar ni manejar.**

El campo `zoom` del paso es otra cosa: alimenta el **zoom cinematográfico** del modo reproducir.
`scanRegions()` (`:91-113`) barre `.fb-root [data-testid], button`, descarta invisibles y <8×8 px, y arma
un `Map<testid, HTMLElement>`; `focusEl()` (`:118-129`) resuelve en cascada `paso.zoom` → `op-panel` →
testid del primer gesto → `viewport`. El zoom es un `transform` sobre `.fb-root` con escala clampeada
`S ∈ [1.35, 2.4]`. Expone `window.__forgeUIMap()` para autoría (`:187-191`).

### 5.5 Retroalimentación del check
```ts
function evalCheck(js: string): boolean {                                    // :34-41
  try {
    const inv = (window.__forgeBrep as { invariants?: unknown } | undefined)?.invariants;
    const sk = window.__sketchEditor;
    return !!new Function('inv', 'sk', `return (${js});`)(inv, sk);
  } catch { return false; }
}
```
Sondeo cada **1000 ms**; al pasar, marca y **avanza solo tras 900 ms** (`:212-221`). Lo que ve el alumno
(`:318-323`): `◌ <desc> — el kernel lo verifica solo` en `#8fa3b8` cuando está pendiente; `✓ <desc>` en
verde `#3ddc84` cuando pasa. ⚠️ **No existe estado de "falló"**: solo pendiente/logrado. Sin color de
error, sin reintento visible.

### 5.6 Audio
**No hay TTS ni audio en el overlay. Cero.** El "habla" del modo reproducir son **subtítulos temporizados**:
`splitPhrases()` corta el `dice` en frases ≤11 palabras y el timer usa `Math.max(isLast?2700:1500,
words*420)` ms (~0.42 s/palabra). La voz real (XTTS/Matilda) vive **solo en el pipeline de video**
(`scripts/narracion-gen.py` + `scripts/escuela/clase-drive.cjs`, que lee la duración de cada WAV con
`ffprobe`). **La misma lección JSON alimenta dos consumidores**: el overlay en vivo (sin voz) y el render
de video (con voz).

---

## 6. ESTILO VISUAL — para que el módulo no se vea pegado con cinta

### 6.1 ⚠️ Hay DOS paletas en el mismo archivo; la de abajo gana

El bloque `CSS` (**8250–8929**) tiene una capa vieja (dorado) y una **"FORJA DS v2"** desde la línea
**8701** que gana el cascade. **Un panel nuevo debe usar la de abajo.**

```css
:root{                                                        /* 8711-8717 */
  --ds-bg:#0A101C; --ds-panel:#0F1725; --ds-panel2:#16202F; --ds-raise:#1D2A3D;
  --ds-line:rgba(140,180,255,0.10); --ds-line2:rgba(140,180,255,0.20);
  --ds-text:#DCE7F5; --ds-dim:#A6B4C8; --ds-faint:#7E90A9;
  --ds-accent:#41C7D4; --ds-accent-ink:#04252A; --ds-brand:#E8A33D;
  --ds-sky:#58A6FF; --ds-aurora:#5DDB8C; --ds-nebula:#8E7CFF;
}
```
La doctrina está escrita en el comentario de **8701–8710**: *"cromo grafito NEUTRO… UN acento
interactivo… dorado SOLO para la marca"*, *"fondo = espacio profundo; acento = AGUA/cielo (cian-teal);
aurora verde = éxito; nebulosa violeta = especial"*.

| Rol | Valor |
|---|---|
| Fondo app / panel / elevado | `#0A101C` / `#0F1725` (asides: `rgba(15,23,37,.92)` + `blur(6px)`) / `#16202F`, `#1D2A3D` |
| Bordes | `rgba(140,180,255,.10)` y `.20` |
| Texto / dim / faint | `#DCE7F5` / `#A6B4C8` / `#7E90A9` |
| **Acento interactivo** | `#41C7D4` (hover `#5CD6E2`), tinta encima `#04252A` |
| **Dorado = MARCA, no acento** | `#E8A33D` (solo `.fb-mark`) |
| Éxito / advertencia / error | `#5DDB8C` (viejo `#8ff0a4`) / `#fbbf24` / `#fca5a5` sobre `rgba(248,113,113,.1)` |

Constantes TS heredadas, **todavía muy usadas inline en el JSX**:
`GOLD = '#FDB813'` y `GOLD_DIM = '#c9a84c'` (`src/forja/brep/ui-theme.ts:2-3`), `STEEL = '#9fb3c8'` (**168**),
`INK = '#05060A'` (**169**), tinta sobre dorado `#1a1206`.

> **Decisión que hay que tomar de una vez para AERO**: el panel de Viento actual (**7021-7076**) usa
> `GOLD` inline como acento (`btn-viento` prendido = fondo dorado). Eso contradice el DS v2. Si el módulo
> aero se rehace, o **se moderniza a `var(--ds-accent)`** (y de paso se moderniza el bloque de viento para
> que no queden dos estilos lado a lado), **o se mantiene `GOLD` inline** por consistencia con sus hermanos
> de la pestaña de simulación. **Recomiendo modernizar el bloque aero completo a `--ds-accent` cian** — es
> además semánticamente correcto: el acento agua/cielo para el estudio de AIRE.

### 6.2 Tipografía
- **UI**: `'Inter', system-ui, sans-serif` (`.fb-root`, **8252**; cargada en `forja-brep.html:11`).
- **Todo dato medible va en `'JetBrains Mono'`** — regla de oro: `.fb-dim-val`, `.fb-row .rv`, `.fb-pval`,
  `.fb-count`, `.fb-sim-tag`, `.fb-fea-ticks`.
- Escala: caption de grupo 8.5px/700 `ls 1.3`; micro-labels 9px/600-700 uppercase; label de cota y título
  colapsable 10px/600 uppercase `opacity .7`; pestañas 10.5px/700; botones 10-11px/500; texto de panel
  10-12px; `.fb-panel-title` 11px/600 uppercase GOLD; **valor destacado `.fb-row.hi .rv` 16px/700**.

### 6.3 Las clases que un panel nuevo DEBE usar (todas en el bloque `CSS`)

| Clase | Línea | Qué hace |
|---|---|---|
| `.fb-rail` / `-left` / `-right` | 8813 | Columnas reales (izq 244px, der 276px), scroll propio. Un panel se cuelga como `<aside>` hijo |
| `.fb-rail>aside` | 8817 | Convierte cualquier `<aside>` en tarjeta: borde `--ds-line`, radius 10, `rgba(15,23,37,.92)`, `blur(6px)`. `.floating` = ventana desanclada |
| `.fb-collapse-head/-btn/-title` + `.collapsed` | 8320, 8825 | Encabezado ▾/▸; `.collapsed` oculta todo menos la cabecera. `cursor:grab` |
| `.fb-panel-title` | 8516 | Título de sección 11px uppercase |
| `.fb-dim*` / `.fb-scrub` | 8523, 8907 | Control de cota (label arrastrable = scrub + campo mono + unidad) |
| `.fb-row` + `.rk` + `.rv` (+`.hi`) | 8626 | Fila clave/valor; `.hi` la vuelve destacada |
| `.fb-seg` + `button.on` | 8887 | Segmented control; activo = `--ds-accent` |
| `.fb-pick-btn` | 8594 | Botón toggle ancho completo — **el patrón `◉/○`** |
| `.fb-fea-run` | 8666 | **Botón primario grande** (`:disabled` → `opacity .45 + grayscale(.4)`) |
| `.fb-sim-clear` / `.fb-sim-err` / `.fb-hint-txt` | 8678/8681/8582 | Secundario / caja de error / párrafo de ayuda |
| `.fb-sim-bc` / `.fb-sim-bc-row` | 8662 | Contenedor de filas de controles |
| `.fb-divider` / `.fb-count` / `.fb-check` | 8530/8327/8580 | Hairline / badge numérico / checkbox `accent-color` |
| `.fb-big` / `.fb-group` / `.fb-group-cap` | 8776 | Botón del ribbon agrupado con caption |

⚠️ **Gotcha de montaje**: el `<style>{CSS}</style>` está **dentro** de `.fb-root` (**5956**) pero es global
al documento, así que un hermano fuera del árbol **sí hereda** `.fb-row`, `.fb-dim`, `.fb-fea-run`… pero
**NO** hereda lo anidado bajo `.fb-rail>aside` ni el `top/bottom` de los rieles. Por eso `TutorialOverlay`
usa 100 % inline. **Un panel aero hermano tendría que envolverse en un `.fb-rail` propio o replicar esas
reglas.** (Otro argumento a favor de la opción B de §7.)

### 6.4 RadialMenu (`src/forja/brep/RadialMenu.tsx`, 111 líneas)
- **Se abre con CLIC DERECHO en el viewport**, no con tecla: `onContextMenu` en **6007-6013**
  (`if (sketchOpen) return; e.preventDefault(); setRadial({x: e.clientX, y: e.clientY})`). Estado en **3558**.
- Cierra con Esc (`:24-28`), clic en el scrim, o clic derecho otra vez.
- API: `RadialItem { id, label, glyph, onPick }` + `RadialMenu({ x, y, items, onClose })` (`:12-21`).
  **Las acciones son un array literal inline** en **6262-6277** (8 ítems), no un registry.
- Geometría: radio `R = 104`, ítems 58×58, hub 92×92, anillo 262px; ítems desde **−90° en sentido horario**;
  clamp de pantalla con margen 168px; `zIndex: 60`.
- Color: **redeclara `GOLD='#FDB813'` local** (no importa `ui-theme`). Reposo
  `radial-gradient(circle at 34% 30%, #232e3d, #101722 74%)` borde `#3a4452`; hover borde GOLD, tinta
  `#1a1205`, fondo `radial-gradient(circle at 32% 28%, #ffe9ad, #FDB813 70%)`, `scale(1.13)` + glow.
  Escrim `radial-gradient(circle 340px at Xpx Ypx, transparente 30% → rgba(6,10,16,.42) 100%)`.
- Animaciones `fjRadialIn .16s` + `fjItemIn .18s` con stagger `i*0.022s`.
- testids: `radial-menu` y `radial-${it.id}` — **explícitamente "para que los tutoriales lo puedan manejar"**.
- 👉 **Si aero añade un ítem** (p. ej. "Perfil alar"), es una línea más en el array de **6262**. Barato.

### 6.5 Convención de `data-testid` (~250 en el monolito)

| Patrón | Ejemplos reales |
|---|---|
| `btn-<accion>` (×80) | `btn-extrude`, `btn-fea`, `btn-viento`, `btn-generativo` |
| `input-<campo>` | `input-mach`, `input-altitud`, `input-paneles-viento`, `input-carga` |
| `chk-<flag>` | `chk-viento-p`, `chk-viento-tau`, `chk-viento-shock` |
| `tab-<workspace>` | `tab-diseno`, `tab-manufactura`, `tab-simulacion` |
| `seg-<opcion>` / `pat-<opcion>` | `seg-rect`, `pat-circular`, `pat-axis-x` |
| `<panel>-panel` | `op-panel`, `sim-panel`, `analysis-panel` |
| `<dominio>-<metrica>` (valores leídos) | `viento-cd`, `viento-drag`, `viento-delta`, `an-masa` |
| `<dominio>-error` | `viento-error`, `gen-error` |
| Dinámicos | `` `viento-calidad-${c}` ``, `` `fea-dir-${x}-${y}-${z}` ``, `` `radial-${it.id}` `` |
| Derivados de `Dim` | `` `${testid}-expr` ``, `-bind`, `-unbind` (**3236/3242/3268**) |

Todo **kebab-case**, español o jerga CAD en inglés, sin mayúsculas ni acentos.
**El bloque VIENTO ya es el molde exacto para AERO** — copia esa nomenclatura literal y extiéndela
(`aero-*` para lo nuevo, `viento-*` para lo que las lecciones ya leen).

### 6.6 Anatomía de un panel de estudio
Los tres átomos: `CollapseHead({id,title,collapsed,onToggle,right})` (**8196**), `Row({k,v,hi,testid})`
(**8160**, solo lectura, el testid va en el valor) y `Dim({label,value,unit,onChange,min,max,step,testid,
bindKey})` (**3223**, con **scrub** al arrastrar el label y **sin slider a propósito** — el slider
redondeaba al step y rechazaba ⌀6.8).

Esqueleto:
```tsx
<div className="fb-rail fb-rail-left" data-testid="rail-left">
  <aside className={`fb-sim ${collapsed.sim?'collapsed':''} ${winPos.sim?'floating':''}`}
    data-testid="sim-panel" onPointerDown={winDrag('sim')} onDoubleClick={winUndock('sim')}
    style={winStyle('sim')}>
    <CollapseHead id="sim" title="…" collapsed={!!collapsed.sim} onToggle={() => toggleCollapse('sim')} />
    <p className="fb-hint-txt">…</p>
    <button className="fb-fea-run" data-testid="btn-…">…</button>
    <Dim label="Mach" … testid="input-mach" />
    <div className="fb-row hi"><span className="rk">c_d</span><span className="rv" data-testid="viento-cd">…</span></div>
    {err && <div className="fb-sim-err" data-testid="…-error">…</div>}
  </aside>
</div>
```
El estado del shell (`collapsed`, `winPos`, `winDrag/winUndock/winStyle`) está en **3422-3459**; un panel
nuevo solo agrega su `id` a esos records.

---

## 7. PROPUESTA DE ARQUITECTURA PARA EL MÓDULO AERO

### 7.0 La restricción que decide todo

El requisito **"Cp pintado sobre la piel"** obliga a escribir en `SolidMesh.feaColors` (línea **6207**), y
el requisito **"streamlines alrededor del sólido con oclusión correcta"** obliga a dibujar **dentro del
mismo `<Canvas>`, dentro del `<group rotation={[-π/2,0,0]}>`** (línea **6025**).

Ninguna de las dos cosas se puede hacer desde un hermano puro, porque:
- `window.__forgeBrep` **no expone** `result.mesh` / `result.faces` / `result.edgeGeoms` / `oc`;
- un segundo `<Canvas>` sobrepuesto tendría **otra cámara** (la del Studio no está expuesta), **otro
  depth buffer** (el flujo no se ocluiría por la pieza) y **otro contexto WebGL** (el navegador limita
  ~16; el CAD ya gasta uno y los overlays lazy del molde abren más).

👉 **La opción "cero cambios al monolito" existe pero NO cumple el requisito visual.** Queda descartada
(la dejo documentada abajo como Opción C para que nadie la vuelva a proponer).

---

### 🅐 Opción A — **Extender el Estudio Viento donde está** (dentro del monolito)

**Qué se hace**: sustituir `useWedgeFrame`/`streamN` por un marco derivado de paneles reales, reemplazar
`vientoColors` (4609-4635) por Cp por panel, añadir flechas y vector de sustentación dentro de
`VientoOverlay`, y crecer el bloque del panel (7015-7077).

**Costo medido**
| Concepto | Impacto |
|---|---|
| Líneas nuevas en `ForgeBRepStudio.tsx` | **+600 a +900** (el archivo pasa de 8 929 a ~9 800) |
| Estados nuevos (α, perfil, modo, streamlines, flechas, leyenda Cp, S_ref…) | **+10 a +14** `useState` |
| Dependencias del `useEffect` de QA (hoy 102) | **→ ~115** |
| Riesgo de romper algo ajeno | Alto: cualquier error de render en el bloque aero tumba el CAD entero |
| Tiempo hasta el primer pixel | **El más corto** (todo está a la mano: `oc`, `result.mesh`, `meshBBox`, `enumerateFaces`, el picking, el clip) |
| Deuda | Empeora exactamente lo que la memoria del proyecto marca como bloqueante (`feedback_forja_frontend_broken`: *"partir ANTES de más features"*) |

**A favor**: cero infraestructura nueva; el flujo FEA/viento ya cablea todo.
**En contra**: es la decisión que el proyecto ya declaró que no quiere volver a tomar.

---

### 🅑 Opción B — **PUERTO DE EXTENSIÓN + módulo hermano** ⭐ **RECOMENDADA**

> Una sola cirugía de **~13 líneas** al monolito, hecha una vez, que abre la puerta a **todos** los
> estudios futuros (y permite migrar hacia afuera FEA, generativo y molde después).

#### B.1 El puerto — archivo nuevo, infraestructura, no aero

**`/home/ian/Orkesta/la-forja/src/forja/brep/studio-port.ts`** (~90 líneas, cero dependencias)

```ts
// Store externo (useSyncExternalStore) — NO es React context: el hermano vive
// fuera del árbol de ForgeBRepStudio y el context no llegaría.
export interface StudioCtx {
  oc: unknown | null;
  mesh: TessellatedMesh | null;       // positions / normals / indices / faceIds / faceGroups
  faces: FaceRef[]; edgeGeoms: EdgeGeom[];
  bbox: { center: number[]; half: number[] } | null;
  workspace: 'diseno' | 'manufactura' | 'simulacion';
  selectedFaceId: number | null; selectedEdgeId: number | null;
  buildVersion: number;               // sube en cada rebuild → invalida caches del estudio
}
export interface SlotEntry { id: string; Comp: React.ComponentType }

export function publishCtx(c: StudioCtx): void;           // ← lo llama el monolito
export function useStudioCtx(): StudioCtx;                // ← lo usa el hermano
export function registerScene(e: SlotEntry): () => void;  // nodo R3F dentro del group del modelo
export function registerPanel(e: SlotEntry & { rail: 'left' | 'right' }): () => void;
export function setSkinColors(c: Float32Array | null): void;   // overlay sobre la piel
export function useStudioPort(): { scene: SlotEntry[]; panels: (SlotEntry & {rail:string})[]; skinColors: Float32Array | null };
```

Reglas duras del puerto:
- El registro se hace **en `useEffect` con cleanup** (idempotente ante el doble montaje de `StrictMode`).
- El renderizador de slots **envuelve cada `Comp` en un `ErrorBoundary`** — un estudio nuevo jamás debe
  tumbar el CAD (precedente: `EnvBoundary` de la línea **1936**, que existe porque un HDRI caído tumbó
  La Forja entera el 2026-07-21).
- `setSkinColors` respeta el invariante `length === mesh.positions.length`, o se ignora.

#### B.2 Los 6 puntos de inserción EXACTOS en `ForgeBRepStudio.tsx`

| # | Línea | Cambio |
|---|---|---|
| 1 | tras **154** (fin de imports del kernel) | `import { publishCtx, useStudioPort, SlotHost, SceneSlotHost } from './studio-port';` |
| 2 | tras **5910** (después de `cameraDist`/auto-encuadrar, ANTES del bloque de croquis) | ```const port = useStudioPort();```<br>```useEffect(() => { publishCtx({ oc, mesh: result?.mesh ?? null, faces: result?.faces ?? [], edgeGeoms: result?.edgeGeoms ?? [], bbox: meshBBox, workspace, selectedFaceId, selectedEdgeId, buildVersion: opCount }); }, [oc, result, meshBBox, workspace, selectedFaceId, selectedEdgeId, opCount]);``` ← **efecto PROPIO, de 7 deps; NO toca el `useEffect` de 102** |
| 3 | **6207** (dentro de `<SolidMesh …>`) | `feaColors={port.skinColors ?? vientoColors ?? feaColors}` — **una palabra más** |
| 4 | tras **6222** (justo después de `<VientoOverlay/>`, dentro del `<group rotation={[-π/2,0,0]}>`) | `<SceneSlotHost entries={port.scene} />` |
| 5 | tras **7137** (última línea del riel izquierdo, después del `sim-panel`) | `<SlotHost entries={port.panels} rail="left" />` |
| 6 | *(opcional)* en el array de **6262-6277** | `{ id: 'perfil', label: 'Perfil alar', glyph: '✈', onPick: () => aeroOpenProfile() }` |

**Total: ~13 líneas nuevas + 1 palabra editada. Cero borrados. Cero riesgo de regresión** (si nadie
registra nada, `port.scene` y `port.panels` están vacíos y `skinColors` es `null` → comportamiento
idéntico al de hoy).

#### B.3 Los archivos nuevos del módulo aero

**Física pura (Node, testeable con `npx vitest run src/aero`, cero React, SI puro):**

| Archivo | Qué |
|---|---|
| `src/aero/panel-skin.ts` | `panelSkin(mesh) → PanelSkin` (centroide, **normal y área POR TRIÁNGULO**, faceId). El patrón de la cruz vectorial está copiable en `src/forja/mold/dfm-mesh.ts:110-121`. **Dos invariantes gratis y fuertes**: `Σ areas ≈ surfaceArea(oc,shape)` y `Σ area·n̂ ≈ 0` — cazan winding, caras `REVERSED` y deflexión ignorada |
| `src/aero/geom-ala.ts` | S_ref, envergadura b, MAC, AR, taper λ, flecha Λ, diedro Γ, y **la declaración del marco** (eje de envergadura, borde de ataque, plano de simetría). ⚠️ **Declarado por picking, NO inferido del bbox** — ver §9 |
| `src/aero/paneles2d.ts` | Matriz de influencia + Kutta discreta + **LU/Gauss denso** (⚠️ el `sparseCG` de `fea.ts` NO aplica: la matriz de paneles es densa y no simétrica) |
| `src/aero/cp-campo.ts` | Cp por panel → **colores por vértice** (media ponderada por área sobre los triángulos incidentes) + **normalización por percentil** (copiar `fea.ts:1148`, no el bug) |
| `src/aero/estela.ts` | Integración RK4 de líneas de corriente 3D. `src/aero/potencial.ts` ya trae el RK4 2D |
| `src/aero/viento-medido.ts` | Sustituto de la medición por bbox: δ efectivo desde las normales de panel (§8) |
| `src/aero/naca.ts` | **Generador de perfiles NACA 4 y 5 dígitos** con espaciado coseno → `Pt2[]` listo para `loadDoc`. `potencial.ts:nacaProfile(t,n)` solo hace la serie **00xx simétrica**; extenderla ahí o crear este archivo. **Requisito duro de §4** |

**UI (React, hermanos):**

| Archivo | Qué |
|---|---|
| `src/aero/estudio/AeroStudio.tsx` | El **hermano**. Dueño del estado del estudio. Registra panel + escena en el puerto y publica `setSkinColors`. Se monta en `forja-brep-main.tsx` junto a `<TutorialOverlay/>` |
| `src/aero/estudio/AeroPanel.tsx` | El panel DOM. Reusa `.fb-rail>aside`, `CollapseHead`, `Row`, `Dim`, `.fb-fea-run`, `.fb-pick-btn` (hay que **exportarlos**: hoy `Row`/`CollapseHead`/`Dim` son privados de `ForgeBRepStudio.tsx` — **muévelos a `src/forja/brep/ui-atoms.tsx` y reimpórtalos ahí**; es un refactor mecánico de ~90 líneas que además **quita 90 líneas del monolito**) |
| `src/aero/estudio/AeroScene.tsx` | El nodo R3F: streamlines, campo de partículas, flechas p/τ, vector de sustentación, onda de choque. **Migra `VientoFlowField`/`VientoStreamlines`/`cpColor`/`detectVientoTier`/`dotSprite` tal cual** desde el monolito (líneas 2049-2302 salen del archivo: **−250 líneas al monolito**) |
| `src/aero/estudio/AeroLabels.tsx` | Etiquetas HUD (vector de sustentación, Cp máx). Copia `CotaDriver`/`CotaLabels` de `MoldCotas3D.tsx:65-88` |

**Balance neto del monolito con la opción B: +13 líneas de puerto −250 de viento −90 de átomos de UI
= ≈ −330 líneas.** El monolito **encoge** mientras se agrega la feature.

**Y el API de agente**: `AeroStudio.tsx` **extiende** `window.__forgeBrep` en vez de meterse en el
`useEffect` de 102 deps:
```ts
useEffect(() => {
  const w = window as any; const prev = w.__forgeBrep;
  if (!prev) return;                       // el Studio aún no montó → reintenta
  Object.defineProperties(prev, { viento: { get: () => snapshot, configurable: true } });
  Object.assign(prev, { setViento, setVientoMach, setVientoAlt, setVientoPaneles, setVientoShow, setVientoCalidad });
  return () => { /* restaurar */ };
}, [snapshot]);
```
⚠️ **Gotcha real**: el `useEffect` del monolito **borra `window.__forgeBrep` en su cleanup** (**5857**) y
se re-monta en cada una de sus 102 deps. El parche de aero debe **re-aplicarse** — lo más robusto es
sondear/re-aplicar cuando cambie la identidad del objeto, o pedir al monolito un tercer hook del puerto
(`registerApi(obj)`) que el propio `useEffect` haga `Object.assign(api, ...portApis)` antes de montar.
**Recomiendo la vía del puerto** (`registerApi`): es 1 línea más en el punto de inserción #2 y elimina la
carrera por completo.

**Costo total de la opción B**
| Concepto | Impacto |
|---|---|
| Cirugía al monolito | **13 líneas** (+ el refactor mecánico de átomos de UI, opcional pero recomendado) |
| Archivos nuevos | 6 puros + 4 de UI + 1 de puerto |
| Tiempo hasta el primer pixel | ~1 día más que la opción A (construir el puerto) |
| Testabilidad | **Muy superior**: toda la física en `src/aero/*.ts`, `vitest` en Node, sin navegador |
| Deuda | **Negativa** (el monolito encoge) |
| Riesgo | Bajo, y aislado por `ErrorBoundary` en el slot |

---

### 🅒 Opción C — hermano puro con segundo `<Canvas>` — **EVALUADA Y DESCARTADA**

Cero cambios al monolito, literal. Pero: no hay acceso a la malla (hallazgo #4), la cámara del Studio no
está expuesta (habría que espiar `OrbitControls` por DOM), el depth buffer es independiente (**el flujo
atravesaría la pieza**), y se gasta un contexto WebGL extra. **No cumple "Cp sobre la piel" ni "flujo
ocluido por el sólido".** Documentada aquí solo para que no se vuelva a proponer.

---

### 7.1 Recomendación

**Opción B.** El argumento decisivo no es estético, es aritmético: el monolito **encoge ~330 líneas**
mientras gana la feature, la física queda testeable en Node sin navegador, y la cirugía es de 13 líneas
que además **desbloquean la salida de FEA, generativo y molde** en el futuro. La opción A entrega un día
antes y cobra ~900 líneas + 13 dependencias de intereses.

**Orden de trabajo sugerido** (cada paso verificable solo, siguiendo *paso a paso, 1 cambio*):
1. Meter `src/aero` al gate (`forja-gate.cjs`, una línea — hoy los 25 tests de `src/aero` **no corren**).
2. Test de regresión del bug de la cota alineada (§4.4) — **antes** de que alguien escriba una lección
   que lo pise.
3. `src/aero/naca.ts` (4 y 5 dígitos, coseno) + su test contra coordenadas publicadas. Sin UI.
   Verificar a mano: `window.__forgeBrep.loadDoc({ sketch:{kind:'custom', customProfile: naca('2412',160),
   smooth:true}, ops:[{id:'extrude-1', type:'extrude', depth:200}] })` en la consola del CAD.
4. `src/aero/panel-skin.ts` + su test con los dos invariantes (`Σ areas ≈ surfaceArea`, `Σ area·n̂ ≈ 0`). Sin UI.
5. `src/forja/brep/studio-port.ts` + los 6 puntos de inserción. Verificar que **nada cambia** (gate verde).
6. Mover `Row`/`CollapseHead`/`Dim` a `ui-atoms.tsx`. Gate verde.
7. Mover el bloque visual de viento (2049-2302) a `AeroScene.tsx` y montarlo por el puerto.
   **Verificar que `a1-l1` y `a1-l4` siguen pasando con `clase-drive.cjs` en iangpu.**
8. Recién ahí: sustituir bbox → paneles (§8), con el camino doble y su gate.

---

*Auditoría hecha leyendo y midiendo el código, no los docs. Mediciones del sketcher corridas con `tsx`
sobre el código real de producción; `npx vitest run src/forja/brep/sketch-solver.test.ts` → 14/14 en 24 ms.
Sin builds ni `tsc` (regla del proyecto). 2026-08-04.*

---

## 8. LAS 2 LECCIONES AERO YA GRABADAS — qué se rompe y cómo se migra

`public/escuela/lecciones/a1-l1.json` y `a1-l4.json`, ambas con `"url": "forja-brep.html"`.
**Ambas dibujan LA MISMA cuña** por cotas dinámicas del croquis (`sk-dyn-a`/`sk-dyn-b`/`sk-dyn-go`):
punto `(−1000, 0)` → `2007.64 mm @ 5°` → `350 mm @ 270°` → `2007.64 mm @ 175°`, y luego **extruyen 800 mm**.

Con eso el bbox queda `spans = [2000, 350, 800]` mm y el cálculo actual (**4602**)
`δ = atan((min/2)/max) = atan(175/2000) = 5.0007°`, `cuerda = 2000 mm → 2.0 m`. **Coincide con Anderson
por construcción, no por casualidad**: la cuña es simétrica con el ápice en el borde de ataque.

### 8.1 Tabla de impacto, check por check

| Lección · paso | Check | ¿De qué depende? | Veredicto al pasar a paneles |
|---|---|---|---|
| `a1-l1 p03` | `inv.vol_kernel ∈ (2.7e8, 2.9e8)` | Kernel puro | ✅ **Intacto** |
| `a1-l1 p04` | `|deltaDeg − 5| < 0.4 && mach === 2` | **δ MEDIDO** | ⚠️ **En riesgo.** Con paneles reales δ debe salir 5.000° — **pero solo si la medición excluye la base (talón de 350 mm) y las dos tapas de envergadura.** Un "ángulo medio de todos los paneles" da basura |
| `a1-l1 p05` | `showP === true && |p2 − 1.31e5|/1.31e5 < 0.03` | δ → choque oblicuo | ⚠️ Derivado de p04. Si δ = 5°, pasa |
| `a1-l1 p06` | `showShock && showTau && |betaDeg − 34.3| < 0.6` | δ → θ-β-M | ⚠️ Derivado de p04. **Además exige que `showTau` siga existiendo como flag** (hoy no dibuja nada — §0 hallazgo 5). **No lo borres al construir las flechas reales** |
| `a1-l1 p07` | `nPaneles === 400 && |cd − 0.022| < 0.003 && fraccionPresion ∈ (0.82, 0.88)` | 🔴 **`nPaneles` = paneles de INTEGRACIÓN de `viento.ts`, un input del usuario** (`input-paneles-viento`, rango 2-400) | 🔴 **SE ROMPE si el módulo nuevo redefine `nPaneles` como "paneles geométricos del teselado"**. El teselado dará miles, no 400 |
| `a1-l4 p03/p04/p05/p07` | `|rho − {1.225, 0.7361, 0.3639}| < tol && hM === {0, 5000, 11000}` | ISA pura | ✅ **Intacto**… ⚠️ **con una trampa**: el getter `get viento()` devuelve **`null` si `vientoResult` es null**, y `vientoResult` es null si la medición de δ falla (`!(delta>0.001) \|\| !(delta<π/4)`, línea **4603**). **Si el medidor nuevo no produce δ para esta cuña, los 5 checks de ISA caen con ella** |
| `a1-l4 p06` | `q_Pa ∈ (80000, 100000)` | ISA + Mach | ✅ **Intacto** (misma trampa del getter null) |

### 8.2 El plan de migración (sin romper nada)

1. **Congela el contrato del getter.** `window.__forgeBrep.viento` debe seguir devolviendo **exactamente
   las mismas claves con la misma semántica**: `deltaDeg, betaDeg, p2_Pa, pInf_Pa, rho, q_Pa, V, aSonido,
   Dp, Df, D, cd, fraccionPresion, **nPaneles**, mach, hM, showP, showTau, showShock, calidad, tier`.
   **`nPaneles` sigue siendo el conteo de integración.** Si el módulo nuevo necesita exponer los paneles
   geométricos, que sea **una clave NUEVA** (`nPanelesGeom`). *(Regla general: los checks son un API
   público; se extiende, no se redefine.)*
2. **Camino doble con gate.** Añade `medirDeltaPorPaneles(skin, marco)` **junto** al cálculo por bbox, y
   un test de kernel que, con la cuña de la lección (chord 2000, semiespesor 175, extrusión 800),
   verifique `|δ_paneles − δ_bbox| < 0.05°` **y** `|δ_paneles − 5.0| < 0.05°`. **Solo cuando ese test
   esté verde**, cambia la fuente y borra el camino del bbox.
3. **Cómo medir δ bien.** El medidor por paneles debe: (a) tomar el marco de flujo (x̂ = dirección de la
   corriente); (b) descartar paneles con `|n̂·x̂| < ε` (tapas de envergadura) y con `n̂·x̂ < −0.9` (la base
   roma); (c) sobre los paneles restantes, δ = media **ponderada por área** de `asin(n̂·x̂)`. Segmentar por
   `faceId` con `mesh.faceGroups` hace (a)-(b) **exacto en vez de heurístico** — la cuña de la lección
   tiene caras B-Rep separadas para cada plano.
4. **Verifica con el ejecutor real, no a ojo.** `node scripts/escuela/clase-drive.cjs
   public/escuela/lecciones/a1-l1.json …` corre los checks con **4 intentos × 2.5 s** y produce el video.
   Córrelo **antes y después** del cambio. ⚠️ Necesita **GPU real → iangpu** (la laptop cae en SwiftShader).
5. **Si aun así hay que mover un número**, edita el JSON de la lección **y regraba el video**: los dos
   están publicados y el audio de la narración menciona los valores en voz alta ("la densidad estándar es
   uno punto dos dos cinco"). Cambiar el número sin regrabar deja una clase que se contradice a sí misma.

### 8.3 Lo que la migración habilita (y hay que aprovechar)

- `a1-l1` dice *"El CAD **MIDE** el semiángulo de mi pieza"*. Con bbox eso es **falso** para cualquier
  pieza que no sea una cuña simétrica. Con paneles se vuelve **verdad**, y la lección gana: se le puede
  pedir al alumno que dibuje una cuña de **7°** y ver que el estudio lo detecta.
- El `showTau` deja de ser decorativo: con flechas de fricción reales, `a1-l1 p06` (*"no hay tercera
  fuerza"*) por fin **se ve**.

---

## 9. RIESGOS CONCRETOS — dónde se rompe si movemos algo

| # | Riesgo | Dónde exactamente | Mitigación |
|---|---|---|---|
| 1 | 🔴 **`window.__forgeBrep` se borra y se re-crea constantemente** — el `useEffect` de **5332-5865** tiene **102 deps** y su cleanup hace `delete window.__forgeBrep` (**5857**). Cualquier parche externo al objeto **se pierde** al primer cambio de estado del CAD | 5332 / 5848 / 5857 | Punto de inserción #2 del puerto con un `registerApi(obj)` que el propio `useEffect` fusione (`Object.assign(api, ...portApis)`) antes de montar |
| 2 | 🔴 **Invariante silencioso del overlay**: si `overlayColors.length !== mesh.positions.length`, el color **se ignora sin error** | `SolidMesh:2519` | Validar en `setSkinColors` y **loguear**. Test: la longitud debe seguir a `buildVersion` |
| 3 | 🔴 **La malla cambia bajo tus pies**: `rebuild()` (**3676**) crea un `mesh` nuevo en cada op, y el efecto de **5089-5098** limpia `feaColors/feaResult/feaDisp/genResult` al cambiar `opCount` o `sketch.kind`. El overlay aero **debe caducar igual** o pintará colores viejos sobre vértices nuevos | 3676 / 5089 | Publicar `buildVersion: opCount` en el ctx y descartar el estudio cuando cambie |
| 4 | 🔴 **Todo corre en el main thread, sin workers.** El FEA ya congela la pestaña. Un barrido de polar CL(α) o un vortex-lattice 3D **cuelga la UI** | 4320-4390 (patrón) | Copiar `prepareFeaSession`/`solveLoadOnSession`: cachear la matriz de influencia (no depende de α) y resolver por ángulo. `requestAnimationFrame` solo permite pintar "ocupado", no evita el congelamiento |
| 5 | 🟠 **La rotación −π/2 en X del grupo del modelo** (**6025**). Cualquier geometría aero que no cuelgue de ese grupo aparece rotada 90°. Ya mordió a las cotas del molde (comentario en `MoldCotas3D.tsx:60-64`) | 6025 / 6022 / 6654 | Colgar el slot de escena **dentro** del grupo (punto de inserción #4) y usar `localToWorld` para proyectar etiquetas |
| 6 | 🟠 **`FaceRef.normal` es `[0,0,0]` en TODA cara curva.** Un ala es toda superficie curva | `occt.ts` / `runFeaAnalysis:4349` | Usar **las normales por vértice del teselado** (esas sí son correctas en curvas) o la normal por triángulo calculada. **Nunca** `FaceRef.normal` fuera de planos |
| 7 | 🟠 **Prioridad de overlays**: `overhangColors ?? feaColors` (**2503**) — los voladizos **ganan** sobre el FEA y sobre viento. Si el alumno deja prendido "voladizos", **el Cp no se ve y no hay mensaje** | 2503 / 6207-6208 | Al activar el estudio aero, apagar `showOverhangs` (o mostrar un aviso en el panel) |
| 8 | 🟠 **`FeaDeformMesh` secuestra el render** cuando hay `feaDisp && feaColors` (**6190**). Si el usuario corrió el FEA antes, la pieza deformada gana y **`SolidMesh` ni se monta** → el Cp no aparece | 6190-6193 | El estudio aero debe pedir `clearFeaOverlay()` al arrancar, o la condición de **6190** debe considerar `port.skinColors` |
| 9 | 🟠 **Higiene del heap WASM.** Cada `Shape` reconstruido necesita `.delete()` (`finally: shape?.delete?.()`, **4386**). Un ala por loft + booleanos es el caso de riesgo (`fuse` con cuerpos grandes **revienta la pestaña**, memoria del proyecto) | 4386 | Copiar el `try/finally` literal. Nunca guardar un `Shape` en estado de React |
| 10 | 🟠 **Deflexión del teselado ignorada en silencio** si la forma ya trae malla (tras fillet/booleano). `tessellate()` lo maneja; código nuevo que llame a `BRepMesh` directo, no. **Para paneles la deflexión ES la resolución del solver** | `occt.ts:tessellate` | Nunca llamar a `BRepMesh` directo. Test: `Σ areas` debe converger al `surfaceArea` exacto |
| 11 | 🟠 **El percentil 98.** El Cp del borde de ataque tiene la misma patología que el filete del FEA (estancamiento Cp→1, pico de succión muy negativo). Normalizar por el máximo **aplasta todo el campo** | `fea.ts:1148` | Copiar la solución. Y ojo: `cpColor` es **divergente** (dos ramas), así que hay que normalizar **cada rama por su propio percentil** o usar un percentil simétrico |
| 12 | 🟠 **`nPaneles` es un nombre ya ocupado** por un check publicado (`a1-l1 p07`) | §8.1 | Clave nueva `nPanelesGeom`, jamás redefinir |
| 13 | 🟡 **Sin `data-testid` no hay escuela**: el resalte del tutor (`TutorialOverlay:194-209`), los gestos `tclick`/`fill`, el `zoom` y `clase-drive.cjs` **todos** entran por testid | TutorialOverlay:200 | Testid en **cada** control aero, siguiendo §6.5 |
| 14 | 🟡 **El CSS del monolito es global pero los rieles no**: un panel montado fuera de `.fb-root` hereda `.fb-row`/`.fb-dim`/`.fb-fea-run` pero **no** `.fb-rail>aside`. Por eso `TutorialOverlay` usa 100 % inline | 5956 / 8817 | La opción B monta el panel **dentro** del riel (punto #5) → hereda todo. Es otra razón para preferirla |
| 15 | 🟡 **Dos paletas conviviendo** (§6.1): DS v2 cian vs. GOLD inline. Un panel nuevo puede salir con el color "equivocado" según de dónde copie | 8701 vs. 7023 | Decidir de una vez (recomendado: `--ds-accent` cian para aero) y modernizar el bloque de viento en el mismo commit |
| 16 | 🟡 **Rendimiento de las flechas**: `VientoFlowField` mantiene UN draw-call para 6000 puntos. Una flecha por panel serían miles de draw-calls | 2145-2207 | `InstancedMesh` de conos + submuestreo por tier (`VientoQ`); reusar `detectVientoTier` (**2088**) |
| 17 | 🟡 **`StrictMode` monta dos veces** (`forja-brep-main.tsx:17`). Registrarse en el puerto fuera de un `useEffect` con cleanup duplica los nodos | studio-port.ts | Registro idempotente por `id` + cleanup |
| 18 | 🟡 **Aero fuera del gate**: `forja-gate.cjs` corre `vitest run src/forja`, **no `src/`** → los 25 tests de `src/aero` nunca corren en el portero | `forja-gate.cjs` | **Arreglarlo ANTES de escribir código nuevo** (una línea) |
| 19 | 🟡 **Verificar necesita GPU real.** `clase-drive.cjs`, `forja-drive.cjs` y los e2e del gate caen en SwiftShader en la laptop | — | Correr en **iangpu** (`ssh ian@100.65.173.85`, `cd /home/ian/Orkesta/la-forja &&` siempre), y `rsync` del source **antes** de cada build |
| 20 | 🔴 **La cota alineada del sketcher no converge en geometría casi-horizontal** — exactamente el gesto "acota la cuerda del perfil". Falla ya con **4 puntos**; el croquis se pone **rojo (`over`)** y el alumno se atora | `sketch-solver.ts:208-226` + `:308` (pivote sobre `1e-12`, guard `<1e-14`) | Corto plazo: usar **`↔`/`↕` (distX/distY)**, que sí convergen. Largo plazo: subir el guard de pivote y/o escalar las columnas de JᵀJ. **Test de regresión con pendiente 0.126 ANTES de tocar aero** — la suite actual (14/14) nunca toca n>10 ni geometría casi-alineada |
| 21 | 🔴 **`smooth: false` está hardcodeado** al terminar un croquis (**4168**), sin toggle en la UI → todo perfil que salga del editor es **facetado** (`extrudePolygon`), nunca `extrudeSpline` | 4168 vs. 940 vs. 3326 | Entrar por `loadDoc` con `smooth: true`. Si se quiere que el editor también pueda, es un toggle nuevo en el panel del croquis |
| 22 | 🟠 **`onPointerMove` del croquis llama `solveSketch` sin debounce ni rAF** (`SketchEditor.tsx:287`) → con un contorno muy acotado, **2.2 s por movimiento de mouse** a n=160 | SketchEditor.tsx:287 | No acotar todos los segmentos de un perfil. Si aero necesita croquis denso + cotas, meter debounce/rAF ahí primero |
| 23 | 🟠 **`window.__sketchEditor` no tiene NINGÚN hook de escritura de geometría** (solo `pick`/`dim*`) | SketchEditor.tsx:1013-1064 | No planear lecciones que "dibujen" el perfil. Si en el futuro hace falta, añadir `setModel(points, lines)` es el hueco limpio |
