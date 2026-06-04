I have enough real anchors. Here's the plan.

# La Forja — Plan priorizado: Imprimibilidad + Planos Fusion + Sección

> Síntesis accionable de la investigación DFM / print-in-place / Fusion-drawings / sección. Cada feature trae fórmula, dónde engancha con lo que YA existe, esfuerzo (S/M/L) y por qué va en ese orden.

**Anclas reales del repo verificadas (úsalas, no inventes archivos):**
- `src/forja/brep/occt.ts` → `TessellatedMesh{positions, normals, indices, faceIds, faceGroups}`, `Shape`, `SketchPlane3D`, `BRepAlgoAPI_Fuse_3/Cut_3/Common_3`, `makePolygonWire`. Cada sólido ya expone su malla y `faceId` por triángulo.
- `src/forja/brep/drawing.ts` (252 LOC) → `generateDrawing()`, `ViewDef{u,v,eye}`, raycast Möller–Trumbore `occluded()`, export SVG. **Hoy sin sección, sin cotas de barreno, sin DXF.**
- `src/lib/viewport/SectionPlane.tsx` → `SectionState{enabled, axis, distance, flip}`, `sectionToThreePlane()`, `sectionToVec4()`, `MeshClipper` (ya hace `gl.localClippingEnabled` + traverse + respeta `userData.__forgeNoClip`). **Hoy `axis ∈ {X,Y,Z}` fijo, sin cap, sin hatch, sin sección 2D.**
- `src/forja/brep/ForgeBRepStudio.tsx` → host; ya tiene la malla en `BufferGeometry`.
- `src/forja/mech/cycloidal.ts`, `armgen.ts` → generadores; el clearance vive aquí.

---

## ORDEN GLOBAL Y POR QUÉ

1. **Imprimibilidad** primero: es **puro cómputo sobre las normales/bbox de la malla que YA tenemos**, cero kernel nuevo, cero UI compleja. Da valor inmediato (el usuario sabe si su pieza se imprime ANTES de exportar) y es la promesa diferencial del proyecto ("análisis MIENTRAS diseñas"). Riesgo mínimo, impacto máximo.
2. **Sección viva en el visor** segundo: el clip-plane ya está medio hecho en `SectionPlane.tsx`; cerrar cap+hatch+normal-arbitrario es la mejora más visible por menos código, y produce el `sliceMesh()` que el plano técnico reutiliza.
3. **Planos a paridad Fusion** tercero (sección 2D, cotas de barreno, DXF): es lo que hace el plano UTILIZABLE en un taller, pero depende del kernel de corte y de un detector de círculos; lo construyes encima de #2.

> Nota de implementación: 1 y 3 comparten el **detector de círculos/barrenos** y la **clasificación de triángulos por plano**. Constrúyelos como utilidades puras reusables, no duplicados.

---

# FASE 1 — ANALIZADOR DE IMPRIMIBILIDAD (FDM)

**Dónde vive:** nuevo módulo puro `src/forja/brep/printability.ts` (sin React, testeable), consumido por un panel en `ForgeBRepStudio.tsx`. Entrada = `TessellatedMesh` + `PrintProfile`. Salida = `PrintabilityReport`.

```ts
interface PrintProfile {
  bedX: number; bedY: number; bedZ: number;   // mm, default Media 256×256×256
  margin: number;                              // mm de borde no usable, default 5
  nozzle: number;                              // default 0.4
  layerHeight: number;                         // default 0.2
  material: 'PLA'|'PETG'|'ABS'|'TPU'|'Nylon';
  overhangWarnDeg: number;                     // 45
  overhangErrDeg: number;                      // 60
  buildZ: THREE.Vector3;                       // dirección de impresión, default (0,0,1)
}
```

### 1.1 Mapa de voladizos por triángulo — **esfuerzo S** *(va primero, es el core)*

**Qué construir:** un pass O(#triángulos) sobre `positions+indices+normals` (o normal de cara recomputada) que clasifica cada triángulo en `OK / WARN / SUPPORT` según su orientación frente al eje de impresión `buildZ`.

**Fórmula exacta por triángulo** (recomputa la normal de cara para no depender de normales suavizadas por vértice):

```
// vértices del triángulo i: a, b, c (de positions vía indices[3i..3i+2])
n = normalize( cross(b - a, c - a) )          // normal de la cara
nz = dot(n, buildZ)                            // componente en el eje de impresión

// ángulo de la cara respecto a la HORIZONTAL del plato:
//   overhangFromHoriz = 90° - angle(n, buildZ)   pero basta el coseno:
// Una cara que mira hacia ABAJO tiene nz < 0.
// Regla raíz (45°): a 45° cada capa solapa ≥50% de la anterior.
// Necesita soporte si la cara mira abajo y su pendiente supera el umbral:

if (nz < -cos(deg2rad(overhangErrDeg)))   estado = SUPPORT   // nz < -cos(60°)=-0.5
else if (nz < -cos(deg2rad(overhangWarnDeg))) estado = WARN  // nz < -cos(45°)=-0.707
else                                       estado = OK
```

> Equivalencia con la regla de la investigación `normal.z < -cos(45°)`: con `buildZ=(0,0,1)`, `nz = n.z`. El umbral de **error** estricto del corpus (>60° desde la vertical) se traduce a `nz < -cos(60°) = -0.5`; el **warning** a 45° es `nz < -cos(45°) ≈ -0.707`. (Sí: el error es el umbral MENOS negativo porque "más voladizo" = normal apunta más hacia abajo = nz menos negativo conforme se acerca a horizontal — ver caja de calibración abajo.)

**Calibración del signo (no equivocarse):**
- Cara que mira **directo abajo** (techo de un puente, normal = `(0,0,-1)`): `nz = -1`. Voladizo total → SUPPORT.
- Cara **vertical** (pared, normal horizontal): `nz = 0`. → OK (las paredes verticales nunca necesitan soporte).
- Cara a **45° colgando** (normal a mitad entre abajo y horizontal): `nz = -cos(45°) ≈ -0.707`. → frontera WARN/SUPPORT.

Por eso el umbral de SUPPORT (`-0.5`, ~60° desde vertical) es **mayor** (menos negativo) que el de WARN (`-0.707`, 45°): cuanto más se acuesta la cara hacia el techo horizontal, más negativo es `nz`, pero el PELIGRO crece cuando `nz` está entre `-0.707` y `0` (voladizos suaves a verticales son OK; el problema es el rango profundo). **Define claramente:** WARN cuando `-1 ≤ nz < -0.707` es demasiado agresivo. La convención correcta y simple:

```
ang = degrees( acos( clamp(-nz, -1, 1) ) )   // ángulo del voladizo desde el plano horizontal
                                              // -nz = cuánto "mira abajo"
if (n mira abajo, i.e. nz < 0):
   selfSupportLimit = overhangWarnDeg (45)
   if  ang_desde_vertical = degrees(acos(-nz))  // 0=abajo total, 90=vertical
   // cara peor (más horizontal) => menor ang_desde_vertical
   if (ang_desde_vertical < 90 - overhangErrDeg)  -> SUPPORT
   else if (ang_desde_vertical < 90 - overhangWarnDeg) -> WARN
```

**Recomendación práctica (la que codificas):** trabaja con el ángulo del voladizo medido **desde la horizontal del plato**:
```
overhang = degrees( asin( clamp(-nz, 0, 1) ) )   // 0°=vertical (OK), 90°=techo plano (peor)
if (nz >= 0)              estado = OK             // mira arriba o de lado-arriba
else if (overhang >= overhangErrDeg)  estado = SUPPORT   // ≥60° colgando
else if (overhang >= overhangWarnDeg) estado = WARN      // 45–60°
else                                  estado = OK         // <45° autosoportado
```
Esto es inequívoco: `overhang` crece de 0 (vertical, seguro) a 90 (techo horizontal, peor). Úsalo.

**Cómo pintar el mapa sobre el mesh (visor):**
- Genera un `Float32Array` de **color por vértice** (3 floats/vértice). Para cada triángulo, escribe el color de su estado en sus 3 vértices del buffer (clona la geometría para no compartir vértices entre triángulos — si no, los colores se promedian). Verde `#3ddc84` OK, ámbar `#ffb000` WARN, rojo `#ff3b30` SUPPORT.
- Setea `geometry.setAttribute('color', ...)` + `material.vertexColors = true`. Es un overlay toggleable; respeta `userData.__forgeNoClip` si conviven con sección.
- Alternativa más barata si no quieres clonar: shader con `flat varying` del faceId → LUT de color. Pero el clon de geometría es S y suficiente.

### 1.2 Volumen/área de soporte — **esfuerzo S**

```
areaTri = 0.5 * |cross(b-a, c-a)|
supportArea = Σ areaTri  para triángulos en estado SUPPORT
// altura promedio sobre el plato de cada cara con soporte:
hTri = (a.z + b.z + c.z)/3 - bboxMin.z      (en eje buildZ)
// volumen estimado de soporte (columnas verticales bajo cada cara, densidad ~15%):
supportVolume ≈ Σ ( areaProyectadaXY_tri * hTri ) * supportDensity
   donde areaProyectadaXY = areaTri * |nz|   (proyección al plato)
   supportDensity ≈ 0.15
```
Reporta `supportArea` (cm²), `supportVolume` (cm³), y `nFacesSupport`. **Re-orientación:** ofrece probar 6 orientaciones (±X,±Y,±Z como buildZ) y reporta cuál minimiza `supportArea` — botón "orientar para menos soporte".

### 1.3 ¿Cabe en el volumen de impresión? — **esfuerzo S**

```
bbox = aabb(positions)                          // tras orientar
dim = [bbox.max - bbox.min]                     // (dx, dy, dz)
usable = [bedX - 2*margin, bedY - 2*margin, bedZ - margin]
fits = dim.x<=usable.x && dim.y<=usable.y && dim.z<=usable.z
// si no cabe recto, probar diagonal de la cama:
diag = hypot(usable.x, usable.y)
fitsDiagonal = (dim.x<=diag) && (dim.y<=diag... )  // sugerir rotar 45° en XY
```
Presets exactos: **Pequeña 200×200×200**, **Media 256×256×256**, **Grande 300×300×400** (Ender-class 220×220×250 como cuarto preset). Error si excede → sugerir escalar / partir / reorientar diagonal.

### 1.4 Espesor de pared y feature mínimo — **esfuerzo M** *(el más caro de la fase)*

El espesor local exacto necesita eje medial / ray-casting interno. **MVP barato y honesto:**
- **Wall por ray-casting interno:** para una muestra de triángulos, dispara un rayo desde el centroide hacia `-n` (hacia adentro) contra el mismo mesh (reusa el **Möller–Trumbore que ya existe en `drawing.ts`**); la primera intersección da el espesor local `t`. Muestrea N rayos (p.ej. 1 por cada cara o submuestreo) y reporta el `min`.
```
minWall = 2 * nozzle           // default 0.8 mm
if (t < minWall)      estado = ERROR  (no imprimible / sin relleno)
else if (t < 1.5)     estado = WARN   (frágil)
```
- **Feature mínimo:** `< nozzle (0.4)` = NO IMPRIMIBLE; pin/boss `< 1.8–2.0 mm` = WARN; rib/slot `< 0.8 mm` = WARN. (Detección fina de pins/ribs es L → diferir; el ray-cast de pared cubre el 80%.)
- **Barrenos:** ⌀ `< 2.0 mm` WARN, `< 1.0 mm` ERROR; agujeros horizontales (eje en XY) imprimen peor → sugerir taladrar o reorientar. (Reusa el detector de círculos de la Fase 3.)

### 1.5 Holguras print-in-place + tabla de manufactura — **esfuerzo S**

Expón un parámetro global `clearance` derivado del perfil, NO hardcodeado:
```
clearance = k * extrusionWidth,   extrusionWidth ≈ nozzle (0.4)
k = 1 (deslizante) | 2 (giro libre)
// por material: PLA 0.30, PETG 0.40, ABS 0.35, TPU 0.45, +PETG/flex necesitan más
fit enum:  presionado -0.10 | deslizante +0.20 | libre +0.40
hole comp: +0.15 mm al ⌀ nominal (los agujeros salen subdimensionados 0.1–0.3)
```
- **Cicloidal (`cycloidal.ts`):** aplica offset equidistante **negativo** `clearance≈0.3` al perfil del disco (encoge el lóbulo) para que malle sin trabarse; `outputHoles` ya es `Dpin+2E` (cinemático) → suma `+clearance` (manufactura). Reporta **backlash estimado en grados** (función de clearance y geometría; referencia: ~2.7° impreso vs ~1.9° CNC a 0.3 mm). Re-valida que `minR(perfil) > 0` tras el offset.
- El generador debe emitir las partes **ya en posición de ensamble** con ≥ `clearance` en TODA la trayectoria, no solo en pose inicial.

**Por qué este orden interno (1.1→1.5):** 1.1 es el corazón y lo más vistoso (mapa de colores), 1.2/1.3 son triviales y dan el "pasa/no pasa", 1.4 es el único M (ray-cast de pared) y se apoya en el Möller-Trumbore existente, 1.5 conecta con los generadores que ya tienes.

---

# FASE 2 — ANÁLISIS DE SECCIÓN EN EL VISOR (3D vivo)

**Dónde vive:** extender `src/lib/viewport/SectionPlane.tsx` + nuevo `src/forja/brep/slice.ts` (puro). La mitad viva (clip plane) **ya funciona**; cierras las 3 carencias vs Fusion: cap sólido, hatch, sección 2D, y normal arbitrario.

### 2.1 Normal de plano arbitrario (Cut Plane tipo Fusion) — **esfuerzo S**

Generaliza `SectionState`:
```ts
// hoy: { enabled, axis:'X'|'Y'|'Z', distance, flip }
// nuevo: { enabled, normal:[x,y,z], distance, flip }  (+ presets X/Y/Z como atajos)
```
`sectionToThreePlane`/`sectionToVec4` ya soportan normal arbitrario internamente — **solo cambia la fuente del normal**. Flujo Fusion: raycast sobre una cara → `faceIds[triángulo]` → normal de esa cara → set como `section.normal`. `constant = -(normal · puntoEnElPlano)`; mover Distance = mutar `plane.constant` (ya lo hace `MeshClipper`, no recrees el plano).

### 2.2 Cap sólido del corte (stencil) — **esfuerzo M**

Sin cap, el sólido se ve hueco. Implementa el **stencil capping** del ejemplo oficial `webgl_clipping_stencil`:
```
Por cada sólido, clona su geometría en un PlaneStencilGroup (2 meshes):
  back:  { side:BackSide,  colorWrite:false, depthWrite:false, stencilWrite:true,
           stencilFunc:Always, stencilZFail/ZPass:IncrementWrap }
  front: { side:FrontSide, ... DecrementWrap }
Cap quad (uno por plano):
  { stencilWrite:true, stencilRef:0, stencilFunc:NotEqual,
    stencilFail/ZFail/ZPass:Replace, clippingPlanes:[] }   // el cap NO se recorta a sí mismo
```
- Orienta el cap con `plane.coplanarPoint(target)` + `lookAt(normal)`.
- Marca el cap con `userData.__forgeNoClip` para que `MeshClipper` NO lo recorte.
- **GOTCHA crítico:** el stencil es sensible al render order → `renderOrder` explícito (sólido1: 1,2; cap1: 3; sólido2: 4,5…), completa todas las pasadas de un sólido antes del siguiente.
- Color del cap = color del componente (Fusion "From Component") o fijo (Fusion "Custom").

### 2.3 `sliceMesh()` — contorno plano∩malla — **esfuerzo S** *(reusado por Fase 3)*

Función pura en `slice.ts`, base para hatch del visor y para la sección 2D:
```
sliceMesh(positions, indices, plane): Segment3D[]
por triángulo (v0,v1,v2):
  d0 = N·v0 - c;  d1 = N·v1 - c;  d2 = N·v2 - c   (|d|<1e-6 ⇒ "sobre el plano")
  si los 3 d del mismo signo → no corta
  si hay cambio de signo → el plano cruza EXACTAMENTE 2 aristas:
    para cada arista (va,vb) con da,db de signo opuesto:
       t = da/(da - db);  P = va + t*(vb - va);   (clamp t∈[0,1])
  → 1 segmento dirigido entre los 2 puntos de cruce
```
El conjunto de segmentos = contorno del corte.

### 2.4 Hatch del cap — **esfuerzo S**

En el visor, el hatch barato es **textura procedural** de líneas a 45° aplicada al cap quad (repeat según `spacing`/escala), alineada al plano — más barato que geometría de líneas. Toggle "Show Hatch" en `SectionState`. Para distinguir componentes, varía el ángulo por `faceId`/material (0/45/90/135). El algoritmo de líneas reales (scanline) se reserva para el DXF de la Fase 3.

**Por qué Fase 2 antes que los planos 2D:** el clip-plane ya existe (mínimo delta), produces `sliceMesh()` que el plano técnico necesita, y es la demo más vendible ("ve por dentro mientras diseñas") con ~1 archivo nuevo + 1 editado.

---

# FASE 3 — PLANOS A PARIDAD FUSION

**Dónde vive:** `src/forja/brep/drawing.ts` (hoy 252 LOC: 3 ortográficas + HLR + SVG, sin sección/cotas/DXF). Orden por valor/esfuerzo:

### 3.1 Vista de SECCIÓN 2D (PRIORIDAD #1 de planos) — **esfuerzo M**

**Vía correcta para La Forja = B-Rep EXACTO** (no slicear la malla; eso solo para mallas importadas sin B-Rep). Añade a `occt.ts`:
```
sectionShape(oc, shape, plane: SketchPlane3D): Shape[]
  gp_Pln pln(gp_Ax3(origin, normal));
  BRepAlgoAPI_Section sec(shape, pln);  sec.Approximation(true);  sec.Build();
  edges = sec.Shape();                  // aristas de intersección (cilindro∩plano = círculo exacto)
  → reordenar con ShapeFix_Wire en wire(s) cerrado(s)
```
Esto reutiliza el kernel OCCT que ya cargas (al lado de `Fuse_3/Cut_3/Common_3`). El contorno sale **exacto** (no escalonado por la malla), listo para acotar. Luego:
- Proyecta la wire al plano 2D (base tangente `u ⟂ N`, `v = N×u`, coord `(P·u, P·v)`).
- Rellena con **hatch real (scanline)**: rota el polígono al espacio del hatch, scanlines `y=k·spacing`, intersecta con aristas, ordena X, rellena pares (regla par-impar 0-1, 2-3…), rota de vuelta. Ángulo 45°, spacing 2–4 mm a 1:1.
- Dibuja la línea de sección A-A con flechas sobre la vista padre.
- **Fallback** sin B-Rep (STEP/mesh importado): usa `sliceMesh()` (Fase 2.3) + chaining por hash de endpoints (`key = round(x/eps)|round(y/eps)|round(z/eps)`) → loops cerrados.

**Fácil/difícil con nuestro motor:** *medio*. El corte exacto es trivial (BRepAlgoAPI ya está); el chaining de wires y el hatch scanline son el grueso. Cachear por `(vista, plano)`.

### 3.2 Detección de círculos + cotas de BARRENO (PRIORIDAD #2) — **esfuerzo M**

Base de center marks, hole table y cotas ⌀/R:
- **Detectar círculos en las aristas:** las aristas B-Rep ya son polilíneas 3D; un círculo proyectado es un loop con curvatura constante → ajusta centro+radio por mínimos cuadrados (3 puntos no colineales dan tentativa; valida con el resto). En B-Rep exacto, identifica caras cilíndricas vía `BRepAdaptor` (tipo `Cylinder` → eje, radio, profundidad) — **más robusto** que ajustar la polilínea.
- **Glifos de cota:** ⌀ (diámetro, línea al centro), R (radio), con el símbolo y el valor. Toggle radio↔diámetro.
- **Center mark / centerline:** detecta círculos/arcos en la salida HLR → cruz de centro (línea-punto) + ejes; auto-generable por vista. **Esfuerzo S, gran impacto visual profesional.**

**Fácil/difícil:** *fácil-medio*. El detector de caras cilíndricas en OCCT es directo; ajustar círculos en HLR proyectado es el caso de mallas importadas.

### 3.3 Más vistas: ISO + detalle + auxiliar — **esfuerzo S cada una**

Ya tienes 3 ortográficas parametrizadas por `ViewDef{u,v,eye}`. Todas son **otra dirección de proyección + el mismo HLR**:
- **Isométrica** (30°): otra matriz de cámara. Alto valor visual, bajo costo. *S.*
- **Detalle:** clip 2D de la vista base a un boundary circular/rect + re-render a escala mayor (2:1, 4:1) + círculo+leader+etiqueta. No toca kernel. *S–M.*
- **Auxiliar:** dirección de cámara HLR = normal de una arista 2D que el usuario elige. Cambio chico si la proyección ya es matriz. *S.*

### 3.4 Export DXF (CRÍTICO para entregar valor) — **esfuerzo M**

Sin export, el plano no compite. DXF es lo que pide el taller/CNC. Serializa la salida del plano (que hoy ya se vuelca a SVG) a entidades DXF: `LINE`, `ARC`, `CIRCLE`, `TEXT`, y polilíneas del hatch. PDF = render vectorial (ya tienes SVG → SVG→PDF). CSV = volcado de hole table. **Reusa el mismo modelo 2D que alimenta el SVG**; es serialización, no geometría nueva.

### 3.5 GD&T básico + tolerancias en cotas — **esfuerzo M**

- **Tolerancia por cota:** metadata (`±0.1` / límites / "basic" recuadrado) + precisión decimal + unidad. *S.*
- **Feature Control Frame:** recuadro multi-celda `[símbolo | ⌀tol Ⓜ | datum A | B | C]`. Necesita los **14 símbolos GD&T como paths SVG** (rectitud, planitud, posición, perpendicularidad, runout…). *M.*
- **Datum identifier:** triángulo relleno + cuadro con letra + leader. *S.*
- Banda de tolerancia por defecto **±0.3 mm** (XY más preciso que Z); para cotas críticas sugerir tolerancia explícita o post-proceso.

**Orden interno de Fase 3:** sección 2D (la carencia #1 de un motor de solo ortográficas) → barrenos/center marks (lo que más falta en piezas reales) → ISO/detalle (alto valor, bajo costo) → DXF (hace el plano usable fuera del navegador) → GD&T (profesionalización). Tablas (hole table, BOM) y símbolos de nicho (soldadura, sheet-metal) van después.

---

# TABLA MAESTRA DE REGLAS NUMÉRICAS DFM (hardcodea estas)

| Parámetro | Valor / Umbral | Acción en La Forja |
|---|---|---|
| **Ángulo de voladizo (autosoporte)** | < 45° desde horizontal = OK; 45–60° = WARN; ≥ 60° = SUPPORT | `overhang = asin(-nz)`; estados por umbral configurable |
| **Regla raíz 45°** | a 45° cada capa solapa ≥ 50% de la anterior | justifica el umbral WARN |
| **Bridging (puente sin soporte)** | ≤ 5–10 mm OK; 10–30 mm WARN (droop); > 30 mm SUPPORT | medir span entre apoyos; estricto 5 mm si superficie visible |
| **Espesor de pared mín.** | `2×nozzle` = 0.8 mm mínimo; 1.5 mm recomendado; < 0.8 = ERROR | ray-cast interno (Möller-Trumbore) |
| **Feature mínimo** | < nozzle (0.4 mm) = NO IMPRIMIBLE; pin/boss < 1.8–2.0 = WARN; rib/slot < 0.8 = WARN | |
| **⌀ barreno mínimo (vertical)** | < 2.0 mm WARN; < 1.0 mm ERROR | horizontal imprime peor → sugerir taladrar |
| **Compensación barreno** | salen 0.1–0.3 mm chicos → +0.15 mm al ⌀ nominal | `holeCompensation` separado del modelo |
| **Tolerancia dimensional FDM** | ±0.2 mm XY (bien calibrado); ±0.1–0.3 Z (peor) | banda default ±0.3 mm en cotas |
| **Altura de capa** | default 0.2 mm; fino 0.1; rápido 0.3 | tiempo, stair-step, feature vertical mín ≈ 0.4 mm (2 capas) |
| **Clearance print-in-place** | `k·extrusionWidth`: k=1 deslizante (~0.4), k=2 libre (~0.8) | derivar del nozzle, no hardcodear |
| **Clearance por material** | PLA 0.30 · PETG 0.40 · ABS 0.35 · TPU 0.45 · Nylon (autolub.) | tabla por material |
| **Fits (interferencia)** | presionado −0.10 · deslizante +0.20 · libre +0.40 mm | enum → offset de cara BREP |
| **Clearance cicloidal** | **0.30 mm** óptimo (mín. varianza); 0.2 vibra, 0.5 backlash | offset negativo al lóbulo; backlash ~2.7° |
| **outputHoles cicloidal** | `Dpin + 2E` (cinemático) **+ clearance** (manufactura) | +2E no opcional |
| **Inserto heat-set** | M3 → barreno 4.0–4.2 mm; M4 → ~5.6 mm; boss ≥ 2× ⌀ insert, ≥ 2 mm material | boss paramétrico por tabla |
| **Rosca modelada** | < M5 no confiable → inserto/tap; tap 0.90× · autorroscante 0.96× · heat-set 0.98× del ⌀ | |
| **Volumen de impresión** | Pequeña 200³ · **Media 256³** · Grande 300×300×400 (Ender 220×220×250) | bbox vs usable (margin 5 mm) |
| **Anisotropía Z** | resistencia Z = 50–70% de XY | orientar capas ⟂ a la carga; reportar plano débil = XY |
| **Fillet / chamfer** | fillet interno 2–5 mm (sugerir); chamfer base ~0.3 mm (anti elephant-foot) | sugerir, no bloquear |
| **Texto emboss/engrave** | emboss ancho ≥ 0.9 mm, alto ≤ 2 mm; engrave ancho ≥ 0.5 mm, prof ≤ 2 mm | |
| **Hatch de sección** | 45°, spacing 2–4 mm a 1:1; variar ángulo por componente | scanline par-impar |

---

# RESUMEN DE ESFUERZO Y SECUENCIA

| # | Feature | Esfuerzo | Archivo(s) |
|---|---|---|---|
| 1.1 | Mapa de voladizos (normales) | **S** | `printability.ts` + color por vértice en Studio |
| 1.2 | Volumen/área de soporte | **S** | `printability.ts` |
| 1.3 | ¿Cabe en la cama? | **S** | `printability.ts` |
| 1.4 | Pared/feature mínimo (ray-cast) | **M** | `printability.ts` (reusa Möller-Trumbore de `drawing.ts`) |
| 1.5 | Clearance print-in-place + cicloidal | **S** | `cycloidal.ts`, `armgen.ts`, selector material |
| 2.1 | Normal de plano arbitrario | **S** | `SectionPlane.tsx` |
| 2.2 | Cap sólido (stencil) | **M** | `SectionPlane.tsx` |
| 2.3 | `sliceMesh()` plano∩malla | **S** | `slice.ts` (nuevo, puro) |
| 2.4 | Hatch del cap (textura) | **S** | `SectionPlane.tsx` |
| 3.1 | Sección 2D (B-Rep exacto + hatch) | **M** | `occt.ts` (`sectionShape`) + `drawing.ts` |
| 3.2 | Círculos + cotas barreno + center marks | **M** | `occt.ts` (caras cilíndricas) + `drawing.ts` |
| 3.3 | Vistas ISO/detalle/auxiliar | **S** | `drawing.ts` |
| 3.4 | Export DXF/PDF/CSV | **M** | `drawing.ts` |
| 3.5 | GD&T + tolerancias | **M** | `drawing.ts` + fuente de símbolos SVG |

**Camino crítico recomendado:** 1.1 → 1.2 → 1.3 (un día, todo S, valor inmediato) → 1.4/1.5 → 2.1 → 2.3 (`sliceMesh`, lo necesitan #2 y #3) → 2.2/2.4 → 3.1 → 3.2 → 3.4 (DXF, sin esto el plano no sale del navegador) → 3.3 → 3.5.

**Honestidad del proyecto (regla dura):** etiqueta lo evocativo — un gerotor impreso NO sella a presión (tolerancia FDM ±0.2 mm >> 0.025 mm de mecanizado); el backlash del cicloidal es un compromiso explícito que se MUESTRA en grados, no se esconde.