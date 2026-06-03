# RECETARIO de implementación — La Forja (CAD/CAE/CAM)

> Cuatro recetas de ingeniería para llevar a La Forja del **diseño** al **análisis** y a la **fabricación**, ordenadas por lo que conviene construir primero. Filosofía común (regla dura del proyecto): **el humano DISEÑA, la IA ASISTE**; **física/geometría EXACTA** (nada hardcodeado, nada estilizado); cada módulo es **TS puro** verificable en Node contra **invariantes analíticas** antes de tocar UI; el patrón a imitar siempre es `src/forja/brep/fea.ts` + su script `.cjs` de verificación. Builds y renders se corren en **iangpu** (`ssh ian@100.65.173.85`), nunca local; `scp` del source editado ANTES de cada `vite build`.

---

## Orden de construcción (por qué este y no otro)

1. **FEA mientras diseñas** — el corazón ya existe (`runFEA` verificado contra el cantilever). Solo hay que volverlo incremental. Máximo ROI, riesgo bajo, desbloquea el feedback en vivo que da el "wow" del proyecto. **Empieza por el warm-start (1 función).**
2. **Diseño generativo (SIMP/OC)** — se monta encima del solver FEA ya verificado, reusa la malla regular de voxeles como "elementos de diseño". Es el diferenciador premium frente a Fusion básico. Depende de (1) para el solver.
3. **Análisis de desmoldeo (draft/undercut)** — geométrico-local, O(triángulos), sin solver, milisegundos. Barato y muy visible. No depende de (1) ni (2), pero va después porque su valor es secundario al CAE estructural.
4. **CNC/CAM 2.5D (toolpath + G-code)** — cierra el flujo "diseñar→fabricar". Geometría 2D pura + post-procesador. Independiente del FEA.
5. **PCB→3D (KiCad/EasyEDA)** — importador de ensamble; reusa el kernel sketch→prism→cut sin código nuevo. Es el más acotado y nicho; va al final.

> Nota: la lista de tareas activa del repo (auth/Stripe) es ajena a este trabajo y no se toca.

---

# RECETA 1 — FEA mientras diseñas (von Mises incremental en ~tiempo real)

## Diagnóstico (lo que YA tiene La Forja)

- `runFEA(oc, shape, bc, opts)` en `src/forja/brep/fea.ts` hace **el ciclo completo en frío** cada vez: voxeliza el AABB → clasifica inside/outside por ray-cast (Möller-Trumbore) → arma tets diagonal-6 → ensambla `K` sparse (mapas `col→valor`) → aplica Dirichlet → resuelve con **PCG-Jacobi** desde `u=0` → recupera σ por elemento → von Mises nodal. Material de `MATERIAL_DATABASE`, todo en SI (`MM_TO_M`).
- Elemento = **Tet4 lineal** (`tet4Element` en `formulas.ts`, B 6×12, 1 punto de Gauss). El manual (Felippa IFEM cap. 17) es sobre **quad isoparamétrico**; esa matemática genérica `Kᵉ=∫BᵀEB·det J dξdη` con Gauss aplica para añadir un **Quad4 plano** opcional (mucho más barato para placas, que es el 80% de lo que dibuja un humano).
- Costo real hoy: el cuello NO es el solve (PCG converge en cientos de iters), es **(a)** el ray-cast inside/outside `O(voxeles × triángulos)` y **(b)** el reensamble de `K` desde cero. Para un drag a 30-60 fps hay que matar ambos.
- UI: `ForgeBRepStudio.tsx` corre FEA **solo al botón** (`runFeaAnalysis`) y al menor cambio de geometría (`opCount`) **borra** el resultado (`useEffect` ~línea 1802). El sketch-solver (`solveSketch`, Levenberg-Marquardt) ya mueve puntos en el drag. **No hay puente sketch-drag → FEA.**

Estrategia: **no recalcular lo que la topología no cambió.** Malla, conectividad, factorización del precondicionador y las `Bᵉ` se **cachean**; solo se **mutan** las entradas que dependen del parámetro que el humano arrastra.

## (1) Pasos en orden

**Fase A — Separar "topología" de "parámetros".** Clasificar cada edición:
- **T-change (topológico):** añadir/quitar barreno, fillet, shell, cambiar nº de lados, booleana. → Invalida malla + conectividad + cache. Recalcula en frío (es raro y el humano lo espera "pesado").
- **P-change (paramétrico):** arrastrar un punto del sketch, mover un slider de cota, cambiar `depth`, cambiar carga `F`/dirección, cambiar material. → **Conectividad idéntica.** Reusa todo lo posible.

Dentro de P-change, 3 niveles barato→caro:
1. **Solo carga `f`:** `K` no cambia. **Re-solve únicamente** con warm-start (arrancar PCG de la `u` anterior) → 5-20 iters. Objetivo < 16 ms.
2. **Solo material (E, ν):** `D` reescala. Para ν fijo, `K` escala lineal con E → `u = u_ref · E_ref/E` exacto, **sin re-solve**. Si cambia ν, reensambla `K` (mismo patrón sparse) y re-solve con warm-start.
3. **Drag de un punto del sketch (mueve nodos, NO conectividad):** re-clasificar localmente los voxeles del punto/aristas; recomputar las `Bᵉ` de los tets afectados; **restar** las contribuciones viejas de esos `Kᵉ` de `K` y **sumar** las nuevas. Re-solve con warm-start.

**Fase B — Malla barata para el preview.** Dos resoluciones: `resPreview` (≈10, durante el drag) y `resFinal` (18, al soltar). **Coarse-base + Quad4 para placas:** si el sólido es un extrude de espesor uniforme (lo más común), no voxelizar 3D — mallar el perfil 2D con Quad4 en tensión plana (1/10 del costo). El 3D voxel queda para piezas genuinamente 3D.

**Fase C — Bucle de feedback continuo.** `pointerdown` en un punto → marcar drag activo. `pointermove` (throttle a rAF): `solveSketch` mueve la geometría → recomputar shape barato → **P-change incremental** del FEA preview → recolorear. Si el frame anterior sigue calculando, **descartar intermedios** (coalescing). `pointerup`: FEA `resFinal` exacto una vez.

**Fase D — Verificación** (sección 6).

## (2) Matemática exacta

**El sistema y el reuso** (Felippa cap. 17):
```
K·u = f,   Kᵉ = ∫_Ωᵉ Bᵀ E B dΩ   (ec. 17.18)
```
Quad4 isoparamétrico con Gauss 2×2:
```
x = Σ Nᵢ xᵢ                                   (17.6)   N₁=(1-ξ)(1-η)/4, …
J = P·X (2×2),  J = det J = J₁₁J₂₂−J₁₂J₂₁     (17.2, 17.8)
[∂Nᵢ/∂x; ∂Nᵢ/∂y] = J⁻¹ [∂Nᵢ/∂ξ; ∂Nᵢ/∂η]      (17.5)
B (3×8) con las parciales x,y                  (17.9)
Kᵉ = Σ_g w_g · h · B(ξ_g)ᵀ E B(ξ_g) · det J(ξ_g)  (17.21+17.19)
```
Gauss 2×2: `ξ_g,η_g = ±1/√3`, `w_g = 1` (Tabla 17.1). `E` plano = `E/(1−ν²)·[[1,ν,0],[ν,1,0],[0,0,(1−ν)/2]]`. **`B` y `det J` dependen solo de las coords nodales** → mover un nodo solo cambia los `Kᵉ` de sus elementos.

**Update incremental del ensamble (drag de un punto):**
```
K ← K − Σ_{e∈afectados} scatter(Kᵉ_old)        // restar lo viejo
recompute Bᵉ, det Jᵉ, Kᵉ_new  para e∈afectados (17.5–17.21)
K ← K + Σ_{e∈afectados} scatter(Kᵉ_new)        // sumar lo nuevo
```
Como `K.rows[i]` es `Map<col,val>`, `sparseAdd(K,i,j,+Δ)` lo hace en O(1) por entrada. **No se reconstruye el patrón sparse.** Coste `O(|afectados|·144)` ≪ reensamble completo.

**Warm-start del PCG:**
```
u₀ ← u_prev;   r₀ = f − K·u₀     (en vez de r₀ = f, u₀=0)
z = M⁻¹r;  p = z;  rz = rᵀz       (luego sparseCG sin tocar)
```
`M⁻¹ = diag(K)⁻¹` (Jacobi) casi no cambia en P-change → se reusa.

**Escalado exacto por E (ν fijo):** `K(E,ν) = E·K̂(ν)` ⇒ `u(E) = (E_ref/E)·u_ref` (**cero solve**). σ = E·(B·u) y u∝1/E ⇒ **σ invariante con E** (correcto: campo de esfuerzo con fuerza impuesta no depende de E). Solo cambian desplazamiento y FOS (vía σ_y del nuevo material) → feedback instantáneo.

**Re-clasificación local de voxeles:** solo los voxeles en `±2·voxel` alrededor del punto movido y sus aristas se reclasifican (`pointInsideMesh`). Si un voxel cambia inside↔outside → T-change local → fallback a frío.

**von Mises (ya correcto):** `σ_vM = √(3J₂)`, `FOS = σ_y/σ_vM` (`vonMisesStress`).

## (3) Estructuras de datos

Cache persistente entre frames, anclado a una firma de topología:
```ts
interface FEACache {
  topoSig: string;            // hash de {tipo ops, nº lados, barrenos, fillets…}; cambia ⇒ invalida
  mesh: VolumeTetMesh;        // nodos + tets (conectividad estable mientras topoSig no cambie)
  D: number[][];              // matriz constitutiva (ν); E factorizado aparte
  Eref: number;               // E con el que se ensambló K̂
  K: SparseSym;               // ensamblada SIN Dirichlet (se aplica por copia)
  KeOld: Float64Array[];      // Kᵉ por elemento para el restar-sumar incremental
  nodeToElems: Uint32Array[]; // adyacencia nodo→elementos (localizar afectados en O(1))
  diag: Float64Array;         // diag(K) para el precondicionador Jacobi
  uPrev: Float64Array;        // última solución (warm-start)
  fixedDOF: Set<number>;      // DOF Dirichlet
  nodeGrid: NodeGrid;         // hash espacial (ya existe) para sampleNodalField
}

type FeaDelta =
  | { kind: 'topology' }                                  // frío completo
  | { kind: 'load'; totalForce: [number,number,number] }  // solo f → re-solve warm
  | { kind: 'material'; E: number; nu: number; sigmaY: number } // escala/reensambla
  | { kind: 'nodes'; movedNodes: number[] }               // §2.2 + §2.5 + re-solve warm
```
API nueva en `fea.ts`:
```ts
export function feaCacheBuild(oc, shape, bc, opts): FEACache;   // frío, 1 vez por topología
export function feaApplyDelta(cache: FEACache, d: FeaDelta, bc, opts): FEAResult; // incremental
```
`runFEA` queda como "frío"; `feaApplyDelta` como camino caliente. El UI guarda `FEACache` en un `useRef`.

## (4) Cómo encaja con lo existente

- **`fea.ts`:** `brepToVolumeTetMesh`, `sparseInit/Add/MatVec/CG`, `tet4Element`, `vonMisesVertexColors`, `buildNodeGrid/sampleNodalField` **se reusan tal cual**. Añadir: (a) `feaCacheBuild` (= `runFEA` partido en "construir cache" + "primer solve", guardando `KeOld` y `nodeToElems`); (b) `feaApplyDelta`; (c) warm-start en `sparseCG` (parámetro opcional `u0`).
- **`sketch-solver.ts`:** comparar `points` antes/después del drag → set cambiado → mapear a `movedNodes` (vía `nodeGrid`) → `FeaDelta {kind:'nodes'}`.
- **`occt.ts`:** durante el drag NO re-teselar OCCT (caro, dispara bug del heap). Deformar la malla de render con el campo `u` y reconstruir el shape OCCT solo en `pointerup`.
- **`ForgeBRepStudio.tsx`:** reemplazar el `useEffect` que **borra** el FEA por uno que **clasifica** el cambio (topo vs param) y llama `feaApplyDelta`. Cablear el drag → `feaApplyDelta({kind:'nodes'})` en rAF con coalescing. El slider `feaLoadN` → `{kind:'load'}`, el selector `material` → `{kind:'material'}`. Exponer en `window.__forgeBrep`: `lastFeaMs`, `lastFeaIters`, `lastFeaKind`, `maxVonMises`, `minSafetyFactor`.

## (5) Respaldo en el manual (Felippa IFEM cap. 17)

- §17.2.1 (p.17-3, ec.17.1-17.2): `J`, `J⁻¹`, `det J`.
- §17.2.2 (p.17-4, ec.17.4-17.5): regla de la cadena `∂N/∂x = J⁻¹ ∂N/∂ξ` (lo que se recomputa al mover un nodo).
- §17.2.3 (p.17-4/5, ec.17.6-17.8): `J = P·X` → **`J` depende solo de `X`**, fundamento del update incremental.
- §17.2.4 (p.17-5, ec.17.9): estructura de `B`.
- §17.3 + Tabla 17.1 (p.17-6/9): Gauss 2×2.
- §17.4 (p.17-10, ec.17.18-17.21): `Kᵉ = ∫ h Bᵀ E B det J`.
- §17.5.2 + Ej.17.3 (p.17-12/17): **shear locking** del Quad4 con 2×2 en flexión → usar integración selectiva o no fiarse del coarse en flexión (coincide con la nota de `fea-node-test.cjs` sobre el Tet4 lineal que sobre-rigidiza).

## (6) Primer corte mínimo verificable

**Corte 0 — Warm-start (1 función, máximo ROI).** Parámetro `u0?: Float64Array` en `sparseCG` (si se da, `r = f − K·u0`). *Invariante:* misma solución que cold (‖u_warm−u_cold‖∞/‖u_cold‖∞ < 1e-6) y menos iters cuando `u0` está cerca. *Verif. (Node, copiando `scripts/fea-convergence.cjs`):* barra a tensión, perturbar `F` +5%, resolver cold vs warm; assert campos <1e-6 y `iters_warm < iters_cold/3`.

**Corte 1 — `feaCacheBuild` + `feaApplyDelta({kind:'load'})`.** *Invariante:* `feaApplyDelta(load=2·F)` da `u` y σ_vM exactamente 2×; coincide con `runFEA` desde cero a 2F (<1e-6). *Verif.:* `scripts/fea-incremental-verify.cjs` (plantilla = `fea-convergence.cjs`).

**Corte 2 — `{kind:'material'}` por escalado en E.** *Invariante:* σ_vM **invariante** al duplicar E; `u` a la mitad; `minSafetyFactor` cambia según σ_y. Comparar contra `runFEA` frío con el nuevo material (<1e-6).

**Corte 3 — `{kind:'nodes'}` (restar-sumar `Kᵉ`).** *Invariante DECISIVO:* la `K` incremental debe ser **idéntica entrada por entrada (<1e-9)** a un reensamble completo con las nuevas coords (equivalente al truco "frame A vs B" del CLAUDE.md: si difieren, el bug está en el scatter/gather, no en la física). *Caso canónico:* barra a tensión, mover el nodo de carga +1 mm en X; el incremental debe dar la misma `σ=F/A` y `δ=FL'/AE` con el nuevo L'.

**Corte 4 — Playwright en iangpu.** `scripts/fea-drag-verify.cjs` (plantilla = `sketch-drag-verify.cjs`): abrir `forja-brep.html` → `window.__forgeBrep.ready` → extruir placa, pick caras, FEA baseline `maxVonMises` → drag de esquina (`page.mouse.down/move(×N)/up`). *Invariantes:* **continuidad** (≥3 updates `lastFeaKind==='nodes'`); **latencia** `lastFeaMs < 50 ms` en `resPreview`; **coherencia física** (alargar placa con misma sección y F axial → `maxVonMises` final ≈ baseline ±2%, atrapa corrupción de `K`); **convergencia al exacto** (FEA de `pointerup` coincide con `runFEA` frío); **cero errores de consola**.

**Arranque (en iangpu, NO local):**
```
ssh ian@100.65.173.85 'cd /home/ian/Orkesta/la-forja && node scripts/fea-incremental-verify.cjs'   # cortes 0-3
ssh ian@100.65.173.85 'cd /home/ian/Orkesta/la-forja && npx vite build && (npx vite preview --port 5002 &) && URL=http://localhost:5002/forja-brep.html node scripts/fea-drag-verify.cjs'  # corte 4
```
Recordar: `scp` del source a iangpu **antes** del build.

**Archivos:** `src/forja/brep/fea.ts` (warm-start, `feaCacheBuild`, `feaApplyDelta`, tipos), `src/forja/brep/ForgeBRepStudio.tsx` (clasificar edición, drag→delta con coalescing, métricas en `window.__forgeBrep`). Scripts nuevos: `scripts/fea-incremental-verify.cjs`, `scripts/fea-drag-verify.cjs`.

**Resumen de ingeniería:** el humano DISEÑA arrastrando; la IA recalcula **solo el delta**. La topología fija conectividad y patrón sparse → se cachean una vez. El drag muta solo los `Kᵉ` tocados (restar-sumar sobre los `Map` de filas) y re-solvea con warm-start (cientos→decenas de iters). Carga = solo re-solve; E = escalado cerrado sin solve. Preview a `res≈10`, exacto a `res=18` al soltar. Todo anclado al cap. 17 de Felippa y verificado con el invariante "K incremental == K reensamblada".

---

# RECETA 2 — Diseño generativo (optimización topológica SIMP) sobre la malla FEA

**Archivo nuevo:** `src/forja/brep/topopt.ts`. **Reusa:** `src/forja/brep/fea.ts` (malla, ensamble, solver) + `src/lib/formulas.ts` (`tet4Element`, `elasticityMatrix3D`, `MATERIAL_DATABASE`). **Respaldo:** manual `P0_06_efficient-topology-optimization-in-matlab…pdf` (Andreassen et al., top88, *Struct Multidisc Optim* 43:1-16, 2011) + digesto `simulacion-avanzada.md` §11.

> **Idea de encaje:** top88 es 2D con cuadrados regulares (1 elemento = 1 variable de densidad). La Forja YA tiene una malla **estructurada de voxeles** (`brepToVolumeTetMesh`) donde cada voxel se parte en **6 tets idénticos**. **El voxel ES el "elemento de diseño"** (la variable `x_e`), no el tet. Reproduce 1:1 la estructura regular de top88, pero en 3D con 6 tets por celda. Lo mejor de ambos mundos: solver FEA real ya verificado contra el cantilever + malla regular que hace triviales filtro y OC.

## 1. Pasos en orden (el bucle SIMP+OC)

```
ENTRADA: oc, shape, BC, material, resolution, volfrac f, penal p=3, rmin (voxeles),
         ft∈{1=sens,2=dens}, maxLoops, tolChange
─────────────────────────────────────────────────────────────────────────
PRE-PROCESO (una vez):
  P1. mesh = brepToVolumeTetMesh(oc, shape, resolution)           [reusa fea.ts]
  P2. Índice VOXEL→TETS (6 tets consecutivos/voxel) + centroide (i,j,k).
  P3. D = elasticityMatrix3D(E, ν)                                [reusa formulas.ts]
  P4. Por voxel, k0_e = Σ_{t∈voxel} Ke_t(E=1)  (Ke UNITARIA, 24×24). Guardar B de cada tet.
  P5. Caras OCCT → DOFs fijos + vector de carga f.                [reusa collectFaceNodes/presión]
  P6. FILTRO: por voxel e, vecinos i con H_ei = max(0, rmin − dist(e,i)); Hs_e = Σ H_ei  (ec.8)
  P7. x_e = f para todo voxel (campo uniforme).
─────────────────────────────────────────────────────────────────────────
BUCLE (loop=1..maxLoops, hasta change ≤ tolChange):
  S1. FE: xPhys=(ft==2)?filtroDensidad(x):x (9); E_e=Emin+xPhys^p(E0−Emin) (1);
          K = Σ dispersar(E_e·k0_e); Dirichlet; sparseCG(K,f).
  S2. ce_e = u_eᵀ k0_e u_e; c = Σ(Emin+xPhys^p(E0−Emin))·ce_e (2);
      dc_e = −p·xPhys^{p−1}(E0−Emin)·ce_e (5,≤0); dv_e = 1 (6).
  S3. FILTRADO: ft==1 → dc̃ (7); ft==2 → dc,dv con H/Hs (10).
  S4. OC: Be_e=−dc_e/(λ·dv_e); xnew con move-limit y [0,1] (3,4,η=0.5,m=0.2);
          bisección λ hasta mean(xPhys(xnew))=f.
  S5. change = max|xnew−x|; x = xnew.
─────────────────────────────────────────────────────────────────────────
SALIDA: xPhys por voxel (0..1) + historia compliance + mesh.
        Render: dibujar voxeles con xPhys > 0.5.
```

## 2. Matemática EXACTA (numerada como el manual)

**SIMP (ec.1, p.3):** `E_e(x_e) = E_min + x_e^p·(E0 − E_min)`, `x_e∈[0,1]`, `p=3`, `E_min≈1e-9·E0`. Lineal: como `k0_e` usa `E=1`, rigidez del voxel = `E_e·k0_e`.

**Problema (ec.2):** `min_x c(x)=UᵀKU=Σ_e E_e·u_eᵀk0_e u_e` s.a. `V/V0=f, KU=F, 0≤x≤1`.

**OC update (ec.3):**
```
x_e^new = max(0, x_e−m)   si x_e·B_e^η ≤ max(0,x_e−m)
        = min(1, x_e+m)   si x_e·B_e^η ≥ min(1,x_e+m)
        = x_e·B_e^η        en otro caso          (m=0.2, η=0.5)
```
**Factor (ec.4):** `B_e = (−∂c/∂x_e)/(λ·∂V/∂x_e)`, λ por **bisección** hasta cumplir volumen.

**Sensibilidades (ec.5,6):** `∂c/∂x_e = −p·x_e^{p−1}(E0−E_min)·u_eᵀk0_e u_e` (≤0), `∂V/∂x_e = 1`.

**Filtro sensibilidad (ec.7,8):** `∂c̃/∂x_e = 1/(max(γ,x_e)·Σ H_ei)·Σ_{i∈N_e} H_ei x_i ∂c/∂x_i`, `H_ei=max(0,rmin−Δ(e,i))`, `γ=1e-3`.

**Filtro densidad (ec.9,10):** `x̃_e = (1/Σ H_ei)·Σ H_ei x_i`; `dc`,`dv` se filtran con `H/Hs`.

**(Premium opcional) Heaviside (ec.20,22 + digesto §11):** `x̄_e = 1 − e^{−β x̃_e} + x̃_e e^{−β}`, β 1→512 cada 50 iters → solución blanco-y-negro con escala mínima `rmin`.

## 3. Estructuras de datos

```ts
interface DesignCell {           // el voxel = la variable x_e
  i,j,k: number; cx,cy,cz: number;       // índice rejilla + centroide mm
  tetStart, tetCount: number;             // rango en mesh.tets (6 consecutivos)
  dof: Int32Array;                        // 24 DOFs globales (8 nodos × 3)
  k0: Float64Array;                       // Ke unitaria del VOXEL 24×24 (E=1)
}
interface TopOptModel {
  mesh: VolumeTetMesh; cells: DesignCell[]; nDOF: number;
  fixedDOF: Set<number>; f: Float64Array; D: number[][];
  filtIdx: number[][]; filtW: Float64Array[]; filtHs: Float64Array;  // filtro CSR-like
}
interface TopOptParams { volfrac, penal, rmin, ft:1|2, maxLoops, tolChange, move; }
interface TopOptResult {
  xPhys: Float64Array; compliance: number;
  history: {loop,c,vol,change}[]; mesh: VolumeTetMesh; cells: DesignCell[];
}
```
**Por qué `k0` por VOXEL (24×24), no por tet:** evita re-ensamblar 6 tets en cada una de ~200 iteraciones. Se calcula UNA vez con `tet4Element(coords, D_unit)` por los 6 tets, se dispersa en una densa 24×24 indexada por los 8 nodos, y por iteración solo `E_e·k0` al dispersar en `K`. Es la optimización "mover código fuera del bucle" del §3.3.

## 4. Cómo encaja con lo existente

| Necesidad | Reusar | Archivo |
|---|---|---|
| Malla regular | `brepToVolumeTetMesh()` (voxeles = celdas) | `fea.ts:229` |
| Ke por elemento (E=1) | `tet4Element(coords, D)` → `{K,B}` | `formulas.ts:514` |
| Matriz D | `elasticityMatrix3D(E,ν)` | `formulas.ts:235` |
| Material real | `MATERIAL_DATABASE` | `formulas.ts:65` |
| BC caras→DOFs+carga | `collectFaceNodes`/`nodesOnFace`/presión×área | `fea.ts:530-630` |
| Ensamble+Dirichlet | `sparseInit/Add/MatVec` | `fea.ts:404-649` |
| Solver K·U=F | `sparseCG` (idéntico, 1×/iter) | `fea.ts:430` |
| Coloreo | `jetColor`/`vonMisesVertexColors` (o densidad→opacidad) | `fea.ts:816,854` |

**Lo único nuevo:** el bucle SIMP/OC, el filtro precomputado y el escalado `E_e·k0`. Todo lo demás ya está verificado contra el cantilever. **Refactor sugerido:** exportar `collectFaceNodes`, ensamble y Dirichlet como helpers (hoy internos a `fea.ts`).

## 5. Página del manual

SIMP (§2.1, p.3); objetivo (§2.1); OC+bisección (§2.2); sensibilidades (§2.1); filtros (§2.3 + §3.2, p.3-5); FEA malla regular + Ke única + mover fuera del bucle (§3.1, p.4-5); bucle y paro `change≤1%` (§3.3, p.6); Heaviside (§5, p.9); patologías checkerboard/dependencia de malla → por qué el filtro (§2.3). Cross-check: digesto §11.

## 6. PRIMER CORTE mínimo verificable

**Objetivo corte 1:** reproducir el benchmark **MBB/cantilever 3D** (equivalente a `top88(60,20,0.5,3,1.5,1)`, Fig.1) sobre nuestra malla, sin UI.

**Construir:** (1) `runTopOpt(oc, shape, bc, material, params): TopOptResult` puro (como `runFEA`); (2) caso = caja prismática (el de `fea-node-test.cjs`): viga `L×H×W`, cara `x=0` fija, fuerza puntual abajo en el extremo libre, `volfrac=0.4, p=3, rmin=1.5·voxel, ft=1`; (3) `scripts/topopt-node-test.cjs` (patrón de `fea-node-test.cjs`).

**Invariantes (gate "compila ≠ funciona"):**
- **I1 Compliance monótona decreciente** (ningún incremento >5% tras loop 10).
- **I2 Volumen conservado:** `mean(xPhys) ≈ volfrac ±1e-3` cada iteración (valida OC/bisección).
- **I3 Convergencia:** `change → ≤ tolChange (0.01)` antes de `maxLoops`.
- **I4 Densidades acotadas:** `0 ≤ xPhys_e ≤ 1`.
- **I5 Sensibilidad ≤ 0** (ec.5 monótona; signo positivo = bug en `u_eᵀk0u_e`).
- **I6 Topología física:** material sobrevive en el camino de carga; fracción `xPhys>0.5` en las alas (σ máx) supera al núcleo neutro (cercha MBB, Fig.3).
- **I7 Filtro mata checkerboard:** sin filtro (`rmin→0`) aparece patrón tablero (correlación de signo alterno alta); con `rmin=1.5` cae.

**Playwright (corte 2):** reusar arnés `physics-screenshots.cjs`; cargar studio → caja → fijar cara → carga → "Optimizar topología" → esperar `window.__forja.topoptDone` → aseverar `compliance` final < inicial y nº voxeles `xPhys>0.5 ≈ volfrac·nCeldas ±5%`. Still antes (bloque lleno) vs después (cercha) para revisión por agente (patrón `critic-eye.cjs`).

**Defaults a hardcodear (con cita):** `p=3, η=0.5, m=0.2, γ=1e-3, Emin=1e-9·E0, tolChange=0.01`; `rmin ≈ 0.04·(lado en voxeles)` (paper usa 1.5-6 según malla, §3.4); bisección λ en `[1e-9, 1e9]`, corta cuando `λ2−λ1 ≤ tol` o el volumen cuadra (§2.2).

**Por qué primero:** valida el corazón matemático (OC + sensibilidad + filtro + acoplamiento al solver real) contra un resultado publicado, solo con invariantes numéricos en Node, sin UI ni GPU. Si I1-I7 pasan, el algoritmo es correcto; UI y render del campo de densidad son cosmética sobre base verificada.

---

# RECETA 3 — Análisis de desmoldeo (Draft / Undercut) para moldes

> Análisis por signo `n·d` sobre la malla del B-Rep: línea de partición y separación núcleo/cavidad. El humano elige la dirección de extracción y el ángulo mínimo; la IA clasifica, colorea, propone la dirección óptima y mide el área de undercut.

## 0. Qué es y por qué encaja

Digesto §1 ("Draft") y §12 ("Moldflow") fijan: **cara desmoldable si `n·d ≥ 0`; undercut cuando el signo se invierte.** Análisis puramente geométrico-local sobre la teselación, idéntico en estructura a lo que `fea.ts` ya hace: `tessellate()` + `enumerateFaces()`, clasificar por triángulo/cara, colorear por vértice como `vonMisesVertexColors`. **Sin solver** (O(triángulos), milisegundos, sin voxelizar ni WASM extra). Es el "draft analysis" que el digesto marca como diferenciador premium (línea 248).

Piezas que se reutilizan tal cual: `tessellate(oc,shape,deflection,angle)` → `{positions,normals,indices,faceIds,faceGroups}` (`faceIds[triángulo]` da triángulo→cara estable, occt.ts:1106); `enumerateFaces` (occt.ts:948); patrón `vonMisesVertexColors` (fea.ts:854); harness `scripts/fea-node-test.cjs`; el picking triángulo→`faceId` ya cableado (ForgeBRepStudio.tsx:980-1018) para que el humano clique una cara y fije "dirección = su normal".

## 1. Pasos en orden

1. **Normal por triángulo** (no la del centroide de cara: un cilindro tiene una sola cara OCCT pero normales que barren 360°). `n_t = normalize((v1−v0)×(v2−v0))`, winding orientado AFUERA por `tessellate` (respeta `TopAbs_REVERSED`).
2. **Producto escalar con `d`** (unitaria, del humano: preset ±X/±Y/±Z o normal de cara clicada). Ángulo de salida `α_t = 90° − acos(n_t·d)`.
3. **Clasificar cada triángulo** por `s = n_t·d` y `α_min` (1°-3°): POSITIVA (`s ≥ sin α_min`, sale con el lado móvil); NEGATIVA (`s ≤ −sin α_min`, lado fijo); DRAFT_INSUFICIENTE (`0 ≤ |s| < sin α_min`, raspa, la zona ámbar más útil); UNDERCUT (positiva pero ocluida).
4. **Agregar por cara OCCT** (`faceId`): área por clase, ángulo mínimo, bandera undercut.
5. **Línea de partición:** aristas que separan un triángulo positivo de uno negativo (lugar `n·d = 0`, la silueta vista desde `d`).
6. **Separación núcleo/cavidad:** partición por signo de `s` (positivo→core móvil; negativo→cavity fijo); draft-insuficiente y undercut aparte (necesitan side-action, lifter o cambiar `d`).
7. **Optimización de `d` (asistencia IA):** barrer direcciones sobre la esfera, elegir la que minimiza `área undercut + w·área draft-insuficiente`.
8. **Render:** colores por vértice (semáforo) + línea de partición como `LineSegments`.

## 2. Matemática EXACTA

`d` = dirección de extracción unitaria (mitad MÓVIL abre en `+d`). `n_t` = normal exterior. `α_min` = draft mínimo (rad).

```
e1 = v1−v0; e2 = v2−v0
n_t = (e1×e2)/‖e1×e2‖;   A_t = ½‖e1×e2‖          (área = peso para agregar)
s_t = n_t·d  ∈ [−1,1]                            (corazón, digesto §1)
θ_t = acos(clamp(s_t,−1,1));   α_t = 90° − θ_t = asin(s_t)
```
- Cara ⟂ d (techo): `s=1, α=+90°` (desmolda perfecto). Cara ∥ d (pared, draft 0): `s=0, α=0°` (raspa). Cara contra d: `s<0, α<0` (otra mitad del molde).

**Clasificación (umbral en `sin α_min`, evita acos):**
```
POSITIVA  : s_t ≥ +sin(α_min)
NEGATIVA  : s_t ≤ −sin(α_min)
INSUF.    : |s_t| < sin(α_min)
UNDERCUT  : POSITIVA pero ocluida (ver test de visibilidad)
```
**Test de undercut por visibilidad** (la sutileza que el signo solo no captura): `n·d ≥ 0` es necesaria, no suficiente — una cara puede mirar en `+d` y estar atrapada por material re-entrante. Test exacto = moldeabilidad por visibilidad:
```
undercut(t) ⇔ s_t ≥ sin(α_min) ∧ ∃ intersección de {c_t + λd, λ>ε} con la malla
```
Reusa **literalmente** el ray-cast Möller–Trumbore de `fea.ts` (`rayCrossingsOdd`): existencia de un cruce con `λ > ε`. **Primer corte:** omitir y reportar undercut solo por discrepancia de signo con la mitad dominante del vecindario; el test de rayo es el correcto y se incluye después.

**Línea de partición.** Arista `(faceA,faceB)` en la línea si `sign(s̄_A) ≠ sign(s̄_B)` (`s̄` = `⟨n·d⟩` área-ponderado). A nivel de malla, el contorno `s=0` por marching de signo: para cada arista cuyos dos triángulos incidentes tienen `s` opuesto, el punto pasa por `t* = s_i/(s_i − s_j)`.

**Optimización de `d`.** N direcciones por espiral de Fibonacci:
```
d_k = (√(1−z²)cosφ, √(1−z²)sinφ, z),  z = 1−2(k+0.5)/N,  φ = k·π(3−√5)
d* = argmin_k [ Σ_{undercut} A_t + w·Σ_{draft-insuf} A_t ]   (w default 0.5)
```
Reportar las 3 mejores. **Métricas:** `draftFraction`, `undercutArea` (mm², debe ser 0 en pieza limpia), `minDraftAngleDeg`, `partingLineLength`.

## 3. Estructuras de datos

Archivo nuevo: `src/forja/brep/draft.ts`.
```ts
export type PullDir = [number,number,number];
export const DRAFT_CLASS = { POSITIVE:0, NEGATIVE:1, INSUFFICIENT:2, UNDERCUT:3 } as const;
export interface DraftOptions {
  pull: PullDir; minDraftDeg: number; deflection?: number; angle?: number;
  testUndercutByRay?: boolean;  // default true; false = solo signo (primer corte)
}
export interface DraftTriField { s: Float32Array; alphaDeg: Float32Array; cls: Uint8Array; area: Float32Array; }
export interface FaceDraft { faceId: number; cls: DraftClass; minAlphaDeg: number; meanS: number; area: number; side: 'core'|'cavity'|'none'; }
export interface PartingSegment { a: [number,number,number]; b: [number,number,number]; }
export interface DraftResult {
  pull: PullDir; minDraftDeg: number; tri: DraftTriField; faces: FaceDraft[];
  parting: PartingSegment[]; core: number[]; cavity: number[];
  metrics: { draftFraction, undercutArea, insufficientArea, minDraftAngleDeg, partingLineLength };
}
export function analyzeDraft(oc, shape, opts): DraftResult;
export function suggestPullDirections(oc, shape, minDraftDeg, n?): PullCandidate[];
export function draftVertexColors(result, tess): Float32Array;  // RGB 3·N, patrón vonMisesVertexColors
```
Paleta (sin púrpura, ya evitado en `jetColor`): POSITIVE verde `(0.20,0.80,0.35)`, NEGATIVE azul `(0.16,0.50,0.96)`, INSUFFICIENT ámbar `(0.98,0.74,0.15)`, UNDERCUT rojo `(0.85,0.12,0.10)`.

## 4. Cómo encaja con lo existente

Entrada = el mismo `Shape` que `rebuild()` ya construye. `analyzeDraft` llama a `tessellate(oc,shape,deflection,angle)` como `runFEA` y reutiliza `faceIds`/`faceGroups`. `enumerateFaces` para `center`/`kind` del reporte. Dirección por clic: el picking triángulo→`faceId`→normal ya existe (`onPickFace`, :986) + presets ±X/±Y/±Z. `draftVertexColors` se enchufa al mismo `BufferGeometry.setAttribute('color',…)` que el FEA. `PartingSegment[]` → `<lineSegments>`. Panel hermano del de FEA (botón "Desmoldeo"). **Reusa el ray-cast:** extraer `rayHitsAheadOf(p,d,tri,eps)` de `fea.ts:rayCrossingsOdd` para que ambos lo importen.

## 5. Página/manual

Digesto `docs/forja-research/simulacion-avanzada.md` §1 (línea 16 draft cónico; línea 25 `n·d ≥ 0`; línea 27 OCCT DraftAngle [P0] + SCIRP undercuts [P2]; línea 248 diferenciador premium). Fuente primaria (`docs/forja-research/manuales/INDICE.md` líneas 95-96): *"Automatic Recognition and Construction of Draft Angle for Injection Mold Design"* (SCIRP, `file.scirp.org/Html/5-9302331_73785.htm`) → WebFetch para el detalle de visibilidad/oclusión y la parting surface. OCCT Modeling Algorithms (INDICE.md 37-38), sección Draft Angle (`BRepOffsetAPI_DraftAngle`) para *aplicar* draft a futuro. Moldflow (INDICE.md 56-57, 101-102) = continuación natural (digesto §12).

## 6. PRIMER CORTE mínimo verificable

**Construir primero (lógica pura):** `draft.ts` con `analyzeDraft` (tesela, calcula `s_t`/`α_t`, clasifica 4 clases, agrega por `faceId`, computa `metrics`; `testUndercutByRay` default false en el primer corte) + `draftVertexColors`. `parting` y `suggestPullDirections` quedan como stubs (corte 2).

**Verificación por invariantes — `scripts/draft-node-test.cjs`** (preámbulo de `fea-node-test.cjs`):
- **Caso A — Caja draft cero** (rect 40×20 alto 10, `d=+Z`): techo `s=+1,α=+90°` POSITIVE; piso `s=−1,α=−90°` NEGATIVE; 4 paredes `s=0,α=0°` INSUFFICIENT (`α_min=1°`). Invariantes: `insufficientArea ≈ 2(40+20)·10 = 1200 mm²`; `minDraftAngleDeg ≈ 0°`; tol <2%.
- **Caso B — Tronco de cono** (semiángulo 5°, `d=+Z`): pared lateral `α ≈ 5°`, POSITIVE si `α_min<5°`, INSUFFICIENT si `α_min>5°`. `minDraftAngleDeg ≈ 5° ±0.5°`.
- **Caso C — Suma de áreas:** `Σ_t A_t == surfaceArea(oc,shape)` (<0.5%); las 4 clases particionan el área total sin solapar.
- **Caso D — Invariancia de signo:** `d=+Z` vs `d=−Z` intercambia POSITIVE↔NEGATIVE y deja `insufficientArea` idéntica (`s(−d)=−s(d)`).

**E2E (Playwright, corte 2):** patrón `forja-brep-ui-verify.cjs`: studio → caja default → "Desmoldeo" → `d=+Z, α_min=1°` → aseverar DOM "Undercut: 0 mm²", "Draft mínimo: 0°", colores con verde (techo) + ámbar (paredes). Still 4K opcional.

**Orden de entrega:** Corte 1 = `draft.ts` + `draft-node-test.cjs` (A-D verdes). Corte 2 = parting line + `suggestPullDirections` + panel + Playwright. Corte 3 = undercut por rayo (`rayHitsAheadOf`) + core/cavity coloreado + (futuro) parting *surface* + enlace a Moldflow.

**Archivos:** crear `src/forja/brep/draft.ts`, `scripts/draft-node-test.cjs`. Reusar `occt.ts` (`tessellate`:1106, `enumerateFaces`:948, `surfaceArea`:787), `fea.ts` (`rayCrossingsOdd`:183, `vonMisesVertexColors`:854), `scripts/fea-node-test.cjs`, `ForgeBRepStudio.tsx` (`onPickFace`:986, panel FEA:1721).

---

# RECETA 4 — Módulo CNC/CAM 2.5D (toolpath + G-code canónico)

> Toma un **perfil cerrado** (aristas de una cara plana, o un croquis 2D) y emite **trayectoria** + **G-code RS274/NGC**. El humano DISEÑA y ELIGE la operación (contornear, vaciar); la IA calcula offset, pasadas y código. Manual: NISTIR 6556 (intérprete NIST RS274/NGC v3).

Archivos nuevos: `src/forja/cam/toolpath.ts` (geometría: offset, pocketing, linking), `src/forja/cam/gcode.ts` (emisor canónico + capa "canonical machining functions"), `src/forja/cam/profile-from-brep.ts` (cara plana OCCT → perfil 2D), `scripts/cam-toolpath-test.cjs` (invariantes, primer corte).

## 1. Pasos en orden (pipeline 2.5D)

```
[A] PERFIL 2D cerrado ──► loops: Loop[] (CCW exterior, CW islas)
[B] OFFSET por radio r ──► loops offset (contorno) / nido de offsets (pocket)
[C] ESTRATEGIA por capa Z (stepdown ap): contour | pocket(zigzag|spiral-offset)
[D] LINKING: rapids (G0) a clearance, plunge/ramp (G1) al cortar, lead-in/out tangente
[E] POST: Move[] → canónicas (STRAIGHT_TRAVERSE/STRAIGHT_FEED/ARC_FEED)
[F] EMIT: canónicas → texto RS274/NGC (G20/21, G17, G0/G1/G2/G3, M3/M5, M2)
```
Cada paso es función pura. `[D]` produce `Toolpath` (lista de `Move`), frontera de verificación geométrica y entrada del post.

## 2. Matemática EXACTA

**Orientación (shoelace, idéntica a `sketchSignedArea`):** `A = ½ Σ(x_i y_{i+1} − x_{i+1} y_i)`. `A>0` CCW (exterior de material), `A<0` CW (isla). Material a la izquierda del avance ⇒ G41; a la derecha ⇒ G42.

**Offset por distancia `d` (= radio `r`, signo según lado).** Normal izquierda de arista `e=(ex,ey)`, `|e|=L`: `n = (−ey/L, ex/L)`. Vértice offset = **intersección de las dos rectas offset adyacentes** (exacta en convexos y cóncavos):
```
denom = cross(e_{i-1}, e_i)
si |denom| < ε → colineal: vértice = p_i + d·n_i
si no: w = b_i − a_i; t = (w.x·e_i.y − w.y·e_i.x)/denom; p'_i = a_i + t·e_{i-1}
```
**Esquina convexa (manual Appendix B, p.83):** el offset deja hueco → insertar **arco** radio `r` centrado en `p_i` (G2/G3) — *"If a convex corner is on the path, an arc is inserted to go around the corner."* **Esquina cóncava + herramienta grande (errores 10/16 que el manual EXIGE detectar):** si los dos offsets de una arista la acortan a longitud `<0` (producto punto del segmento offset con el original `<0`), la herramienta no cabe → **rechazar y avisar, no socavar**.

**Stepdown Z (2.5D):** `N_capas = ceil(H/a_p)`, `z_k = z_top − min(k·a_p, H)`; última pasada clava `z_bottom` exacto.

**Pocketing por offsets concéntricos:** stepover `s = ratio·(2r)` (típico 0.4-0.5·D), `d_j = r + j·s` mientras el offset sea válido (`A>0`, sin auto-intersección). `d_0=r` deja tool tangente a la pared. Parar cuando `sign(A_offset)≠sign(A_original)` o `A_offset<ε`. Cusp esférico `h ≈ s²/(8R)` (documentar para 3D; en 2.5D paredes verticales no tienen cusp lateral).

**Feeds & speeds (física real, etiquetada):** `n = (1000·Vc)/(π·D)` rpm → `S`; `F = n·Z·f_z` mm/min → `F` (G94); plunge `F_z ≈ 0.3·F`. `Vc`/`f_z` por material (espíritu de `MATERIAL_DATABASE`), recomendación sobreescribible.

**Arco → G2/G3 (formato centro, el que pide el manual, p.24):** G2 horario / G3 antihorario (visto desde +Z). `I = cx − x_s, J = cy − y_s` (offsets del centro respecto al actual). Validación: `dist(actual,centro)` y `dist(fin,centro)` coinciden dentro de **0.002 mm**. Mapea a `ARC_FEED(first_end,second_end,first_axis,second_axis,rotation,axis_end_point,…)` (§4.3.6.1, p.51).

## 3. Estructuras de datos

Reutiliza `Pt2 {x,y}` de `occt.ts`.
```ts
export interface Loop { pts: Pt2[]; closed: true; }
export interface Profile { loops: Loop[]; }
export interface Tool { slot: number; diameter: number; lengthOffset?: number; flutes?: number; }
export type CamOpType = 'contour'|'pocket'|'drill';
export type Side = 'left'|'right'|'on';   // G41/G42/centerline
export interface CamOp {
  type: CamOpType; side?: Side; toolSlot: number;
  zTop, zBottom, stepdown: number;        // ap
  stepover?: number; pocketStrategy?: 'offset'|'zigzag';
  feed: number; plungeFeed?: number; spindleRpm: number; clearanceZ: number; leadIn?: number;
}
export type Move =
  | { kind:'rapid'; x,y,z }                              // → STRAIGHT_TRAVERSE / G0
  | { kind:'feed';  x,y,z }                              // → STRAIGHT_FEED / G1
  | { kind:'arc';   x,y,z; i,j; cw:boolean };            // → ARC_FEED / G2,G3
export interface Toolpath { moves: Move[]; units:'mm'|'in'; tool: Tool; cutLength, rapidLength, estTimeMin; }
```
Emisor canónico (interfaz idéntica a las "canonical machining functions" §4.3, ejecutable por un intérprete real):
```ts
export interface CanonSink {
  setUnits; selectPlane; setFeedRate; setSpindleSpeed; startSpindleCW; stopSpindle;
  straightTraverse(x,y,z); straightFeed(x,y,z); arcFeed(xe,ye,cx,cy,rot,ze); programEnd;
}
export function emitGcode(tp: Toolpath): string;
export function signedArea(pts): number; export function offsetLoopPolygonal(loop, d): Loop;
export function pocketOffsets(loop, r, stepover): Loop[];
export function buildContour(profile, op, tool): Toolpath; export function buildPocket(profile, op, tool): Toolpath;
```

## 4. Cómo encaja con lo existente

| Pieza | Reuso |
|---|---|
| `occt.ts enumerateFaces`/`enumerateEdgesGeom` | `profile-from-brep.ts` toma cara plana elegida (face-picking `selectedFaceId`), proyecta wires al plano, discretiza aristas (`enumerateEdgesGeom` da `polyline` 3D); aristas `circle` se conservan exactas para `G2/G3` |
| `Pt2`, `SketchPlane3D`, `map2Dto3D` | toolpath vive en el plano de la cara, se mapea a XYZ con `uDir/vDir/normal` |
| `sketch-engine.ts`/`sketch-solver.ts` | croquis resuelto cerrado → `Profile` directo |
| `involute-gear-sketch.ts sketchSignedArea` | `signedArea` es la misma fórmula; contornear un engrane es inmediato |
| `fea.ts` (patrón) | módulo TS puro + verificación `.cjs` + panel + `data-testid` |
| `ForgeBRepStudio.tsx` | botón `btn-cam`, panel "Manufactura" (`cutLength/estTimeMin`), overlay 3D (rapids punteados, feeds sólidos), `window.__forgeBrep.exportGcode()` |
| `exportSTEP` (patrón) | `emitGcode` devuelve string, descarga `.ngc` |

Flujo completo: **Croquis → acotar → Extrude → (FEA) → CAM: elegir cara/herramienta/operación → G-code.** Cero botón mágico.

## 5. Página del manual (NISTIR 6556)

Estructura/palabras/modal groups §3.3 (p.14-19, Tabla 4-5); `G0/G1` §3.5.1-3.5.2; `G2/G3` centro `I/J` + tol 0.002 mm §3.5.3 (advierte NO radius-format en semicírculos); `G17` §3.5.6 + Appendix B.1; `G20/G21` §3.5.7; `G41/G42/G40` §3.5.10; offset/arco convexo/error cóncavo Appendix B (p.73-83, Fig.6, B.6); `G81/G83` §3.5.16; `M3/M4/M5`/`S`/`F`/`T`/`M2` §3.6.2/§3.7/Tabla 7; tool file §2.3+Tabla 1; canónicas `STRAIGHT_TRAVERSE/FEED/ARC_FEED` §4.3.4-4.3.6 (`ARC_FEED` firma §4.3.6.1 p.51); husillo §4.3.7. Cusp/feeds: digesto §12.

## 6. PRIMER CORTE mínimo verificable

**Construir primero:** (1) `toolpath.ts`: `signedArea`, `offsetLoopPolygonal` (sin arcos), `buildContour` para un loop convexo, sin lead-in, una capa Z, linking básico (G0 clearance → G0 sobre inicio → G1 plunge → loop G1 → G0 retract); (2) `gcode.ts`: `emitGcode` con G21/G17/G94, S+M3, G0/G1, M5/M2 (solo rectas); (3) `scripts/cam-toolpath-test.cjs` (molde de `occt-extrude-test.cjs`).

**Invariantes EXACTAS (cuadrado 40×40, D=10 → r=5):**
- **I1 Área de offset:** exterior `d=+5` → 50×50, `A=2500` exacto (inglete, sin arcos). Interior `d=−5` → 30×30, `A=900`. `|A_offset − esperado| < 1e-9`.
- **I2 Orientación preservada** (no se invierte para `|d|` < apotema).
- **I3 Longitud de corte:** `cutLength ≈ 4·50 = 200 mm`, `<1e-6`.
- **I4 G-code parseable y conservador:** exactamente un `M3`, un `M5`, un `M2`; toda línea de movimiento es `G0/G1` con coords finitas; **round-trip** (re-parsear X/Y de `G1` reconstruye el polígono de I1 con error <1e-6, parser regex en el test) — valida emisión sin LinuxCNC en CI.
- **I5 Detección de error (no socavar):** pocket de cuadrado 8×8 con D=10 (r=5 > apotema=4) → `buildPocket` falla limpio ("tool too big / concave", errores 10/16), no produce basura.
- **I6 Z stepdown:** profundidad 6 con `ap=2` → exactamente 3 capas, última en `z_bottom` exacto; plunges a `zTop-2, zTop-4, zTop-6`.

```
node scripts/cam-toolpath-test.cjs   # PASS/FAIL por invariante, exit 1 si falla
```
(El caso de polígono puro corre local; el B-Rep carga OCCT-WASM → iangpu.)

**Playwright (2ª capa):** botón `data-testid="btn-cam"` → panel "Manufactura" → `window.__forgeBrep.lastToolpath`/`exportGcode()`; e2e: extruir rect default, "contornear", `expect(lastToolpath.cutLength).toBeGreaterThan(0)` + HUD `data-testid="cam-cutlen"`; overlay visible (rapids punteados azul, feeds sólido oro).

**"Funciona" (no "compila"):** I1-I6 verdes + la línea de G-code pegada en un visor LinuxCNC/ncviewer dibuja el cuadrado offset. Luego: fase 2 (arcos convexos `G2/G3` + cutter-comp `G41/G42` real + lead-in tangente + `pocketOffsets` concéntrico + drill `G81/G83`); fase 3 (islas + medial-axis para pocket robusto).

**Archivos:** crear `src/forja/cam/toolpath.ts`, `src/forja/cam/gcode.ts`, `src/forja/cam/profile-from-brep.ts`, `scripts/cam-toolpath-test.cjs`. Manual: `docs/forja-research/manuales/P1_22_the-nist-rs274ngc-interpreter…pdf`. Reusar `occt.ts` (`Pt2`, `enumerateFaces`, `enumerateEdgesGeom`, `exportSTEP`), `sketch-solver.ts`/`sketch-engine.ts`/`involute-gear-sketch.ts`, `fea.ts`+`fea-cantilever-verify.cjs`+`occt-extrude-test.cjs`, `ForgeBRepStudio.tsx`.

---

# RECETA 5 — PCB→3D (KiCad / EasyEDA al ensamble)

> Importar una placa de **KiCad (`.kicad_pcb`, S-expr)** o **EasyEDA (JSON)** y traerla como **board outline + agujeros + sólido B-Rep** vía el kernel OCCT existente. El humano DISEÑA el circuito en su ECAD; La Forja lo trae a 3D mecánico exacto, no estilizado.

Cae en digesto §4 (Ensamblajes): la placa es un componente con su `RigidTransform` dentro de un `TopoDS_Compound`, y reutiliza al 100% el flujo **sketch→cara→prism→cut** (occt.ts:175-324, 651-676). Geometría EXACTA, outline/barrenos tal cual del archivo, validados por invariantes.

## 1. Pasos en orden

1. **Detectar formato** (`detectFormat`, espejo de `step-import.ts:77`): `.kicad_pcb` empieza con `(kicad_pcb`; EasyEDA = objeto con `.shape: string[]` y `.canvas`.
2. **Parsear** a IR neutra `PcbBoard`. KiCad: lexer S-expr → árbol → recolectar `gr_line/gr_arc/gr_circle/gr_rect/gr_poly` en `layer "Edge.Cuts"`; `footprint` con `(at fx fy frot)` y `pad thru_hole|np_thru_hole` con `(at px py)` + `(drill d)`; `(general (thickness t))`. EasyEDA: split por `~` de cada string; unidades 10-mil→mm (calibrar).
3. **Ensamblar contorno cerrado** (chaining por extremos coincidentes, tol 1e-3 mm). `gr_poly`/`SOLIDREGION` directos. Islas → lazo exterior + interiores por área con signo.
4. **Normalizar coordenadas:** trasladar a AABB-min/centroide; **invertir Y** según convención (KiCad Y hacia abajo; EasyEDA hacia arriba). Reportar AABB.
5. **Construir sólido B-Rep:** outline → wire cerrado → face → `MakePrism` espesor `t` (`general.thickness`, default 1.6 mm). Por agujero: `cut` de cilindro pasante (`drillHole`, occt.ts:651). Slots = `cut` de stadium (2 cilindros + caja).
6. **Validar invariantes** (sección 6) antes de mostrar.
7. **Registrar como componente del ensamble:** el `Shape` entra al `TopoDS_Compound` con `RigidTransform` (como los engranes en `buildAssembly`); `tessellate()` y nodo `SketchKind:'pcb'`.

## 2. Matemática EXACTA

**Unidades.** KiCad: nativo **mm**, `y_forja = −y_kicad`. EasyEDA: base 10 mil, `mm = u·0.254` — ⚠️ NO universal entre versiones; **calibrar contra dimensión conocida** (header 2.54 mm pitch debe dar pads a 2.54 mm) y exponer `unitToMm` como constante verificada.

**Pad absoluto (KiCad, footprint rotado `θ=frot·π/180`):**
```
[x_abs]   [cosθ −sinθ][x_pad]   [fx]
[y_abs] = [sinθ  cosθ][y_pad] + [fy]
```
**Arco (`gr_arc` start/mid/end → centro+radio):** circuncentro de los 3 puntos con `A=start, B=mid, C=end`:
```
D  = 2(Ax(By−Cy)+Bx(Cy−Ay)+Cx(Ay−By))
Ux = (|A|²(By−Cy)+|B|²(Cy−Ay)+|C|²(Ay−By))/D
Uy = (|A|²(Cx−Bx)+|B|²(Ax−Cx)+|C|²(Bx−Ax))/D
center = (Ux,Uy);  r = |A−center|;  sentido por sign(D)
```
Para OCCT: `gp_Circ` + `BRepBuilderAPI_MakeEdge` entre `atan2(Ay−Uy,Ax−Ux)` y `atan2(Cy−Uy,Cx−Ux)`. (EasyEDA arco = path SVG `A rx ry rot large-arc sweep x y`: `sweep`=sentido, `large-arc`=ángulo >π.)

**Cierre (chaining):** grafo de extremos cuantizados a `ε=1e-3 mm`; cerrado ⟺ todo nodo grado par y un único ciclo.

**Área con signo (shoelace):** `A = ½ Σ(x_i y_{i+1} − x_{i+1} y_i)` (arcos suman contribución de sector); orienta exterior (CCW, A>0) vs hueco (CW, A<0).

**Volumen (invariante):** `V = A_outline·t − Σ_k(π r_k² t)`, `A_outline = |exterior| − Σ|huecos|`.

**Stadium (slot):** longitud `L`, radio `r` → 2 cilindros + caja `L×2r×t` (`fuse`), luego `cut`. Área = `π r² + 2r·L`.

## 3. Estructuras de datos (IR neutra)

```ts
// src/lib/pcb-import.ts
export interface PcbPoint { x: number; y: number }  // mm, Cartesiano La Forja
export type PcbCurve =
  | { t:'seg'; a: PcbPoint; b: PcbPoint }
  | { t:'arc'; center: PcbPoint; r: number; a0,a1: number; ccw: boolean };
export interface PcbHole { x,y: number; diameter: number; plated: boolean; slot?: {length,angle}; source: string; }
export interface PcbBoard {
  format: 'kicad'|'easyeda'; thickness: number;
  outlineLoops: PcbCurve[][];   // [0]=exterior CCW; resto=huecos CW
  holes: PcbHole[]; aabb: {min,max}; unitToMm: number; warnings: string[];
}
export interface PcbImportResult {
  board: PcbBoard; shape: Shape;
  invariants: { outlineClosed: boolean; volumeAnalytic, volumeKernel, volumeError: number; holeCount, euler: number };
}
```
Mapea directo al kernel: `outlineLoops[0]` → `extrudePolygon`/wire-con-arcos; `holes[]` → bucle de `drillHole`.

## 4. Cómo encaja con lo existente

**Reusa `occt.ts` tal cual:** `extrudePolygon(oc, pts, t, PLANE_XY)` (:277) para el contorno facetado; `drillHole(oc, shape, {x,y,diameter,zTop:t,through:true})` (:651) por agujero; `volume`/`topology`/`tessellate`/`exportSTEP` para invariantes y salida. **Cero código de kernel para el primer corte.** Arcos exactos (2ª iter): helper `extrudeProfile(oc, curves, t, plane)` con `BRepBuilderAPI_MakeEdge_3` (seg) + `MakeEdge_8(gp_Circ)` (arco, ya usado en `extrudeCircle:314`); huecos del contorno: `MakeFace.Add(innerWire)` (hoy solo `MakeFace_15(wire,true)` — única adición de kernel, opcional). **Ensamble:** la placa entra al `Compound` vía `makeCompound` (:427) con `RigidTransform` (:367), patrón `buildAssembly`. **Grafo:** `SketchKind:'pcb'` + `SketchFeature.pcbBoard?` en `ForgeBRepStudio.tsx` (:156,175); rama en `buildShape` (:593). **UI:** botón `btn-import-pcb` + `<input type=file>` → `importPcbFile(file)` (espejo de `importCADFile`, step-import.ts:102); HUD con AABB/espesor/nº agujeros/invariantes. **STEP roundtrip** gratis con `exportSTEP`.

## 5. Manual/fuente

KiCad S-Expr (`dev-docs.kicad.org/en/file-formats/sexpr-pcb/`): outline `gr_line/gr_arc/gr_circle/gr_rect/gr_poly` en `(layer "Edge.Cuts")`; pads `(pad NUM TYPE SHAPE (at X Y [ROT]) (size W H) (drill [SHAPE] D))`, `TYPE∈{thru_hole,np_thru_hole}`, relativos al `(footprint (at fx fy frot))`; `(general (thickness T))`; **mm nativo**. EasyEDA (`docs.easyeda.com/en/DocumentFormat/3-EasyEDA-PCB-File-Format/`): `BoardOutLine` (layer 10) `RECT/CIRCLE/ARC/SOLIDREGION`; `PAD~shape~cx~cy~w~h~layer~~num~holeRadius~…~plated`; `HOLE`/`VIA`; unidad 10-mil (`·0.254`), **calibrar**. OCCT: `MakeWire/MakeEdge/MakeFace`, `MakePrism`, `BRepAlgoAPI_Cut` (ya en repo). Respaldo de flujo: digesto §1 (extrusión) + §4 (ensamble).

## 6. PRIMER CORTE mínimo verificable

**Construir primero:** parser **KiCad** (mm nativo, sin la trampa de unidades) → IR → contorno **rectangular esquinas rectas (sin arcos)** + agujeros **circulares pasantes** → sólido vía `extrudePolygon` + `drillHole` → invariantes. ~150 LOC en `src/lib/pcb-import.ts` + test headless, sin UI.

**Fixture** (`scripts/fixtures/test-board.kicad_pcb`): 4 `gr_line` formando rectángulo `40×30 mm` en `Edge.Cuts`, `(general (thickness 1.6))`, 4 footprints con un `pad thru_hole (drill 1.0)` en esquinas a `5 mm` del borde.

**Invariantes (`scripts/pcb-import-test.cjs`, patrón `occt-features-test.cjs`):**
1. **Parse:** `outlineLoops[0]` cierra (`outlineClosed===true`); `holes.length===4`; `thickness===1.6`.
2. **Outline:** `aabb` = `40×30`; `|A_outline| = 1200 mm²`.
3. **Volumen analítico vs kernel:** `V_analytic = 1200·1.6 − 4·π·0.5²·1.6 = 1914.97 mm³`; `|volume(oc,shape) − 1914.97|/1914.97 < 1e-3`.
4. **Topología:** sólido válido; verificar el `euler` concreto que arroja el kernel sobre el fixture y fijarlo como golden.
5. **STEP roundtrip:** `importSTEP(exportSTEP(shape))` → `|V₂−V₁| < 1e-6`.

**Visual (Playwright, `scripts/pcb-ui-verify.cjs`, patrón `forja-brep-ui-verify.cjs`):** cargar `forja-brep`, `click btn-import-pcb`, subir fixture, esperar `tessellate`, capturar still; DOM muestra "agujeros: 4", "volumen ✓ (err < 0.1%)", "espesor 1.6 mm"; malla no vacía (`triangleCount>0`), AABB ≈ `40×30×1.6`.

**Iteración tras el primer corte:** (a) arcos `gr_arc` exactos + contorno arbitrario; (b) slots/drill oblongo; (c) parser EasyEDA con unidad calibrada contra fixture; (d) integración al grafo + `RigidTransform` en el compound; (e) cobre/serigrafía como color cosmético etiquetado (NO geometría — eso sería estilizar).

**Riesgo conocido:** el factor de unidad de EasyEDA NO es confiable a ciegas (varía por versión); el primer corte usa KiCad para sacar la cadena kernel→invariantes del camino crítico antes de pelear con esa calibración.

**Archivos:** crear `src/lib/pcb-import.ts` (parsers, IR, `buildPcbSolid`, `importPcbFile`), `scripts/pcb-import-test.cjs`, `scripts/pcb-ui-verify.cjs`, `scripts/fixtures/test-board.kicad_pcb`. Tocar (iter 2) `src/forja/brep/occt.ts` (`extrudeProfile` + `MakeFace.Add`), `src/forja/brep/ForgeBRepStudio.tsx` (`SketchKind 'pcb'`, rama `buildShape`:593, botón `btn-import-pcb`).

---

## Hilo común (la doctrina de las 5 recetas)

- **El humano DISEÑA, la IA ASISTE** — ningún botón mágico; el humano elige cara, dirección, operación, material.
- **Física/geometría EXACTA** — Felippa (FEM), SIMP/OC (Andreassen), `n·d` (SCIRP draft), RS274/NGC (NIST), KiCad/EasyEDA (formato real). Nada hardcodeado, nada estilizado; lo evocativo se etiqueta.
- **TS puro + invariante analítico en Node ANTES de UI** — el patrón es `fea.ts` + su `.cjs`. El invariante decisivo recurrente: comparar el camino incremental/optimizado contra el camino frío exacto (equivalente al "frame A vs B" del CLAUDE.md). "Compila ≠ funciona".
- **Reuso máximo del kernel** — `occt.ts` (tessellate, enumerateFaces, extrudePolygon, drillHole, exportSTEP) y `fea.ts` (malla, sparse, solver, ray-cast, vertex colors) cubren casi todo; el código nuevo es la lógica específica de cada receta.
- **Build/render en iangpu, scp antes del build.**
