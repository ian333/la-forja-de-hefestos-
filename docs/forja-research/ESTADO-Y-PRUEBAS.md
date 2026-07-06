# La Forja — Estado real + cómo probarla COMPLETA (2026-06-23)

Sesión con premisa "todo está mal". Resultado empírico: **el núcleo NO está mal**.
Lo que sí estaba mal era un **test que mentía** (testid obsoleto) y un **falso verde**
en la hélice. Ambos arreglados. Además se agregaron **Loft + Sweep** (P0 del plan).

## 1. UNA sola manera de probarla completa  →  `scripts/forja-gate.cjs`

El portero maestro corre TODAS las suites de verificación con UN comando y emite
PASS/FAIL por área. Es robusto a CWD (se ancla al repo; un `ssh` pelón cae en $HOME).

```bash
# en iangpu (vía el lanzador que mete el cd):
bash scripts/forja-run.sh node scripts/forja-gate.cjs                  # node-only (sin navegador)
bash scripts/forja-run.sh env DISPLAY=:0 node scripts/forja-gate.cjs \
     --ui http://localhost:5001/forja-brep.html --json /tmp/gate.json   # + e2e GPU
```

**Resultado 2026-06-23: 9/9 TODO VERDE.**

| suite | área | qué verifica (invariante) |
|---|---|---|
| kernel/occt-brep | B-Rep | caja/cilindro/cut: vol+Euler EXACTO, STEP roundtrip |
| kernel/occt-extrude | B-Rep | perfil 2D→sólido rect & círculo, malla, STEP |
| kernel/occt-features | B-Rep | barreno, revolve (Pappus), shell, masa, fillet/chamfer selectivo |
| **kernel/occt-sweep-loft** | **B-Rep (NUEVO)** | **loft prisma A·h + tronco h/3·(a²+b²+ab); sweep cilindro πr²L + codo + hélice** |
| physics/fea | FEA | K·u=f vs σ=F/A, δ=FL/AE, viga voladizo |
| physics/topopt | Generativo | SIMP: compliance↓, volumen conservado, vacío creado |
| unit/vitest-forja | varios | croquis (DOF/L-M), planos (HLR), auto-soporte 45°, soportes, GA |
| e2e/forja-brep-ui | Web/GPU | Part Studio por CLICS: extrude→barreno→fillet→shell + análisis |
| **e2e/sweep-loft-ui** | **Web/GPU (NUEVO)** | **Loft + Sweep (recta/codo/hélice) por clics → sólidos válidos** |

Lanzador: `scripts/forja-run.sh` = `cd repo && exec "$@"` (mata el bug de "ssh sin cd").
Vite dev (NO preview, por el `@vite-ignore` del wasm): `bash scripts/forja-run.sh env DISPLAY=:0 npx vite --host --port 5001`.

## 2. Defectos REALES encontrados y arreglados

1. **`forja-brep-ui-verify.cjs` mentía**: esperaba testid `edge-0`, la UI emite `edge-item-0`
   (ForgeBRepStudio.tsx:4759). El fillet por UI SÍ funcionaba; el test fallaba en falso.
2. **Hélice = falso verde**: con el rect por defecto (⌀~23) y paso 8, MakePipe se
   auto-intersecaba y la UI conservaba el sólido anterior EN SILENCIO; el test pasaba
   leyendo el volumen obsoleto. Fix: **auto-dimensionar la hélice** (paso ≥ 2.2·r,
   radio ≥ 1.25·r) para que el resorte SIEMPRE sea válido con cualquier perfil; y el
   test ahora exige que la hélice reconstruya (vol ≠ recta).
3. **MakePipe truncaba** spines con esquina C0 (V caía al primer tramo). Fix: el spine
   se interpola como **B-spline C2 suave** (≥3 puntos) → barre todo el camino, codo
   redondeado (tubo real). Recta (2 puntos) sigue siendo segmento exacto.

## 3. Lo VERIFICADO-real hoy (no "se ve bien", invariante analítico)

- **Kernel B-Rep** (occt.ts, OCCT-WASM): extrude/revolve/**loft**/**sweep**/fuse/cut/
  common/fillet/chamfer/shell/drillHole/STEP I/O/tessellate/massProps/transform/compound.
- **Croquis 2D** (sketch-solver.ts): L-M, 13 restricciones, DOF=nVars−rank(J), color azul/negro/rojo.
- **FEA estático** (fea.ts): Tet4 voxel, K·u=f, von Mises/FOS, validado vs voladizo.
- **Generativo** (topopt.ts + topopt-am.ts): SIMP + filtro auto-soporte 45° (AM).
- **Planos 2D** (drawing.ts): 3 vistas, HLR real (Möller-Trumbore), auto-cotas Ø, SVG.
- **Árbol de features**: rollback/suprimir/reordenar/undo-redo + parámetros con ecuaciones.
- **UI Part Studio** (ForgeBRepStudio.tsx): todo lo anterior por clic; STEP/STL export.

## 4. MATRIZ DE BRECHAS vs Fusion 360 (sin electrónica) — qué FALTA

| Área Fusion | Estado | Qué falta para paridad |
|---|---|---|
| Sketch + restricciones | **PARCIAL** | arco/spline/slot/elipse, offset, project, trim/extend, mirror-in-sketch, auto-constraint |
| Sólidos (extrude/revolve/**loft**/**sweep**/fillet/chamfer/shell/hole/pattern) | **PARCIAL→** | falta **draft, rib, web, thread, hole-wizard (counterbore/csink/tapped), emboss** |
| Booleanas (∪/−/∩) | PARCIAL | kernel completo; falta tool explícito combine/cut/intersect por cuerpo |
| Edición directa / mesh | **FALTA** | push-pull, mover/offset cara, cuerpo de malla |
| Superficies NURBS | **FALTA** | patch, boundary-fill, knit, trim, thicken, continuidad G0/G1/G2 |
| Ensamblaje + joints + motion | PARCIAL (solo engranes) | grafo de juntas 6-DOF, Grübler/redundancia KKT, GJK/SAT, DAE |
| Generativo / opt. topológica | **DONE** (carga única) | multi-caso, restricción de esfuerzo/pandeo (KS) |
| Sim estática | **DONE** (lineal) | no-lineal, malla conforme/adaptativa |
| Sim modal / térmica / pandeo / no-lineal | **FALTA** | M+eigensolver / FE de calor / K geométrica / Newton-Raphson |
| CAM (fresado/torneado) | **FALTA** | `src/forja/cam/` no existe; solo hay slicer FFF (gcode-k1) |
| Prep impresión 3D (FFF) | PARCIAL | DFM+soportes reusables; falta orientador, slicer general, SLA |
| Sim de impresión (warp) | PARCIAL | 1D fusión; falta warp capa-a-capa / esfuerzo residual |
| Planos | PARCIAL | falta sección/detalle/iso, GD&T, BOM, export PDF/DXF |
| Import/Export | PARCIAL | STEP/STL out + STEP in; falta STL/IGES/3MF/OBJ in, DXF |
| Chapa metálica | **FALTA** | brida→flat pattern→springback |

## 5. Ruta crítica recomendada (del PLAN-MAESTRO, ya con Loft/Sweep hechos)

`✅ M1a Loft` → `✅ M1b Sweep` → **draft/rib (M1b resto)** → **M2 ensamblaje (reusa el
solver del sketcher a 6-DOF)** → **M3 multi-caso** → M1c superficies → M4 moldes → M5 CAM.
Lo barato primero: draft/rib son ops sobre primitivas OCCT ya integradas; M2 reusa
matemática existente. CAM y superficies son los grandes faltantes (directorios nuevos).

> Regla del proyecto: cada feature nueva ENTRA con su gate analítico en `forja-gate.cjs`
> antes de mostrarse. Compila ≠ funciona.
