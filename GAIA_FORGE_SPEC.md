# GAIA Forge — Product Specification v1
## The Variable-First Parametric CAD + Simulation Platform

**Authors**: Ian (Product/Vision) + AI Co-founder (Architecture/Engineering)
**Date**: March 2026
**Status**: Requirements Definition

---

## 0. What This Document Is

This is not a feature list. This is the engineering blueprint for what GAIA Forge
IS and WHY it exists. Every architectural decision, every UI choice, every data
structure flows from the principles defined here.

Read this before writing any code.

---

## 1. IDENTITY

**GAIA Forge** is an open-source parametric CAD and simulation platform for
mechanical engineers, mold designers, and scientists.

It is NOT a Fusion 360 clone. It shares some workflows because those workflows
are correct, but it diverges fundamentally in three areas:

### 1.1 Everything Is A Variable

In Fusion 360, you create a sketch, draw a rectangle 50mm × 30mm, extrude it
20mm, and THEN if you're disciplined enough, you go to "Change Parameters" and
rename `d1`, `d2`, `d3` to something meaningful.

In GAIA Forge, there is no `d1`. The workflow is:

```
1. Define: width = 50 mm
2. Define: depth = 30 mm
3. Define: height = 20 mm
4. Sketch rectangle using (width, depth)
5. Extrude using (height)
```

The variable table IS the model. When you change `width`, everything that
references it updates instantly. Variables are not metadata attached to
geometry — geometry is an expression of variables.

**Implementation**: Every numeric value in the system — every dimension, every
position coordinate, every angle — is either:
- A **literal** (hardcoded number), or
- A **reference** to a named variable, or
- An **expression** combining variables (e.g., `width * 0.8 - 2`)

There are no "Model Parameters" auto-generated with meaningless names. If the
user draws a line without naming the dimension, the system FORCES a name prompt
or auto-generates a semantic one: `sketch1_line1_length`.

### 1.2 Math Is The Geometry

Most CAD tools use B-Rep: vertices + edges + faces stored as mesh topology.
GAIA Forge uses **F-Rep (Function Representation)**: every shape is a math
function `f(x,y,z)`. The surface is where `f = 0`.

This means:
- **Boolean operations are trivial**: union = `min(a,b)`, subtract = `max(a,-b)`
- **No mesh healing**: there are no meshes to heal
- **Smooth blends are free**: `smoothMin(a, b, k)` = automatic fillet
- **Infinite detail**: zoom in forever, no facets
- **GPU-native**: the shader evaluates `f(x,y,z)` per pixel → pixel-perfect

The trade-off: no explicit edges/faces to select. We solve this with:
- **CPU SDF evaluator** for picking (ray march from click → surface point → normal)
- **Normal-based face detection** for "select face" workflows
- **Analytic edge detection** in the shader (where gradient changes sharply)

### 1.3 Simulation Is Not Separate

In Fusion 360, you design → export → open Simulation workspace → set up study →
run → go back and redesign. Two separate worlds.

In GAIA Forge, simulation is a **live layer**. You can:
- See stress distribution while you edit dimensions
- Set a variable constraint: `wall_thickness >= minWallThickness(material, process)`
- Run thermal analysis in real-time on the GPU via SDF field sampling
- The simulation doesn't "import" the model — it IS the model

This is possible because SDF evaluation is O(1) per point: we can sample the
distance field at any resolution for any analysis.

---

## 2. TARGET WORKFLOWS

GAIA Forge is not a general-purpose tool trying to do everything. It targets
three specific industrial workflows with full-depth support:

### 2.1 Injection Mold Design

This is the #1 target because it requires the deepest CAD + simulation
integration. A mold designer needs:

**Part Design**:
- Sketch-constrained parametric modeling (same as any CAD)
- Wall thickness analysis (min/max per material)
- Draft angle enforcement (typically 1°-3° per side)
- Undercut detection and side-action design
- Shrinkage compensation (material-dependent: ABS ≈ 0.5%, PP ≈ 1.8%)
- Warpage prediction

**Mold Design**:
- Parting line definition (split surface between core and cavity)
- Core/cavity generation (offset surfaces)
- Runner system design (cold runner, hot runner, valve gate)
- Gate location optimization (balanced fill)
- Cooling channel layout (conformal cooling for 3D-printed molds)
- Ejector pin placement + force calculation
- Venting calculation (gas escape paths)
- Mold base selection (DME, Hasco, Misumi standard catalogs)
- Slide/lifter mechanisms for undercuts

**Simulation**:
- Fill simulation (Hele-Shaw flow approximation)
- Pack/hold pressure analysis
- Cooling analysis (transient thermal FEA)
- Warpage prediction (residual stress → deformation)
- Clamp force calculation

**Standards**:
- SPI (Plastics Industry Association) mold classifications (101-105)
- ISO 294 — injection molding test specimens
- ISO 1133 — melt flow rate
- ASTM D638 — tensile testing
- Material datasheets: Moldflow-compatible material database

### 2.2 CNC Machined Parts

**Part Design**:
- Feature recognition for manufacturing (pockets, holes, slots, bosses)
- Internal corner radius constraints (tool radius minimum)
- Deep pocket ratio limits (depth/width)
- Surface finish specification per face

**Toolpath (future)**:
- 2.5D and 3-axis toolpath generation from SDF
- Tool selection from library
- Feed/speed calculator per material
- G-code export

### 2.3 3D Printed Parts

**Part Design**:
- Overhang detection (angle threshold per process: FDM ≈ 45°, SLA ≈ 30°)
- Support structure visualization
- Wall thickness vs. process minimum
- Build orientation optimization

**Export**:
- STL (already implemented)
- 3MF (with materials and colors)
- STEP (for interoperability)

---

## 3. VARIABLE SYSTEM ARCHITECTURE

This is the core of GAIA Forge. Everything else is built on top of it.

### 3.1 Variable Types

```typescript
type GaiaUnit =
  | 'mm' | 'cm' | 'm' | 'in' | 'ft'        // Length
  | 'deg' | 'rad'                             // Angle
  | 'mm2' | 'cm2' | 'm2'                     // Area
  | 'mm3' | 'cm3' | 'm3'                     // Volume
  | 'g' | 'kg' | 'lb'                        // Mass
  | 'Pa' | 'MPa' | 'GPa' | 'psi'            // Pressure/Stress
  | 'N' | 'kN'                               // Force
  | 'N·m'                                    // Torque
  | 'K' | '°C' | '°F'                        // Temperature
  | 'W/(m·K)'                                // Thermal conductivity
  | 'J/(kg·K)'                               // Specific heat
  | '1/K'                                    // Thermal expansion
  | 'kg/m3'                                  // Density
  | 'Pa·s'                                   // Viscosity
  | 'none'                                   // Dimensionless

interface GaiaVariable {
  id: string;
  name: string;              // User-facing name: "wall_thickness"
  group: string;             // Grouping: "Dimensions", "Material", "Process"
  unit: GaiaUnit;
  expression: string;        // "12" or "width * 0.4" or "minWall(material)"
  resolvedValue: number;     // Computed result after expression evaluation
  description: string;       // "Minimum wall thickness for ABS injection"
  min?: number;              // Constraint: minimum allowed value
  max?: number;              // Constraint: maximum allowed value
  locked: boolean;           // Can't be changed by solver/optimizer
  source: 'user' | 'auto' | 'simulation' | 'standard';
}
```

### 3.2 Expression Language

Variables can reference other variables in expressions. The expression evaluator
supports:

- Arithmetic: `+`, `-`, `*`, `/`, `^`, `%`
- Functions: `sin`, `cos`, `tan`, `sqrt`, `abs`, `min`, `max`, `round`, `ceil`, `floor`
- Conditionals: `if(condition, then, else)`
- Units: `25.4 mm` == `1 in` (auto-conversion)
- References: `$width`, `$height`, `$material.shrinkage`
- Constants: `PI`, `E`, `G` (gravitational)

Expressions are evaluated in **dependency order** using topological sort of the
variable graph. Circular references are detected and flagged as errors.

### 3.3 Variable Scoping

```
Project
├── Global Variables         (apply everywhere)
│   ├── material = "ABS"
│   ├── shrinkage = 0.006
│   └── draft_angle = 1.5 deg
├── Component: Housing
│   ├── width = 80 mm
│   ├── depth = 50 mm
│   ├── wall = 2.5 mm        (expression: "minWall($material)")
│   ├── Sketch: profile
│   │   ├── outer_w = $width
│   │   └── outer_d = $depth
│   └── Feature: extrude1
│       └── height = 35 mm
└── Component: Lid
    ├── width = $Housing.width + 0.2   (references sibling)
    └── depth = $Housing.depth + 0.2
```

### 3.4 Dependency Graph

Every variable knows what it depends on and what depends on it. This enables:
- **Instant propagation**: change `width` → everything downstream updates
- **Impact analysis**: "if I change `width`, what features are affected?"
- **Optimization**: "find `width` that minimizes `total_mass` subject to `stress < yield`"
- **Variant generation**: "show me the model with `width` = 60, 80, 100"

---

## 4. UI PHILOSOPHY

### 4.1 Current Problem

The current UI fails because it violates every principle of professional tool
design:

1. **Everything is visible at once** — toolbar has 7+ button groups, left panel
   always open, right panel always open, timeline, status bar. This is visual
   noise, not information.
2. **No context** — the toolbar shows the same tools whether you're sketching,
   extruding, or doing nothing. Professional tools show you what you can do NOW.
3. **Tiny typography** — 8px, 9px, 10px text that's unreadable at arm's length.
   Engineers use 27" monitors and sit 60cm away. 12px minimum.
4. **Panels steal viewport** — left panel (240px) + right panel (288px) = 528px
   stolen from a 1920px screen. That's 27% of the screen used for chrome.
5. **No spatial hierarchy** — everything has the same visual weight. A "delete"
   button looks like a "create" button looks like a dropdown.

### 4.2 Design Principles

**P1: The viewport is the product.**
The 3D viewport must occupy ≥75% of the screen at all times. Panels overlay or
collapse. Nothing permanently eats viewport space except when the user explicitly
requests it.

**P2: Contextual tools.**
The toolbar changes based on what you're doing:
- **Nothing selected**: Create tools (Sketch, Primitives, Import)
- **Sketch mode**: Line, Arc, Rectangle, Circle, Constraint, Dimension
- **Face selected**: Extrude, Fillet, Chamfer, Shell, Offset, Draft
- **Body selected**: Move, Copy, Boolean, Pattern, Mirror
- **Variable selected**: Edit, Link, Optimize, Chart

**P3: Progressive disclosure.**
Show the minimum needed. Details expand on demand:
- Tree browser → collapsed to icons by default, expand on hover
- Properties → appear as floating panel near the selection, not a permanent sidebar
- Variables → horizontal bar above timeline with current values, expand to full editor
- Simulation → overlay on viewport with controls, not a separate panel

**P4: Typography that respects eyesight.**
- Primary labels: 13px semibold
- Secondary info: 12px regular
- Metadata/hints: 11px
- NOTHING below 11px. Ever.

**P5: One design language.**
Every interactive element follows the same visual system:
- **Active/selected**: Blue fill (`#0696D7`) with dark background
- **Hover**: Subtle background shift + gentle Scale
- **Disabled**: 40% opacity, no interaction
- **Danger**: Red accent (delete, destructive operations)
- **Background**: Deep navy (`#12151c` → `#1a1e2a` gradient)
- **Surfaces**: Elevated navy (`#1e2230`) with 1px subtle borders (`#2a3045`)
- **Text**: Light silver (`#c8cdd8`) primary, muted (`#6b7394`) secondary

### 4.3 Layout Architecture

```
┌─────────────────────────────────────────────────────┐
│  Logo   [Context Toolbar ...]          [Actions]    │ ← 44px, changes with mode
├────┬────────────────────────────────────────────────┤
│    │                                                │
│ T  │                                                │
│ R  │              V I E W P O R T                   │
│ E  │           (75-100% of screen)                  │
│ E  │                                                │
│    │                                                │
│ 48 │                                                │
│ px │                                                │
├────┴────────────────────────────────────────────────┤
│  [$width=80] [$depth=50] [$height=35] ...  [+ Var]  │ ← 32px Variable Bar
├─────────────────────────────────────────────────────┤
│  ◆──◆──◆──◆──◆──◆──●──○──○──○──○                    │ ← 28px Timeline
├─────────────────────────────────────────────────────┤
│  GPU Ray March │ 12 vars │ 60 FPS │ WebGL2          │ ← 22px Status
└─────────────────────────────────────────────────────┘
```

**Tree** (left): 48px collapsed (icons only). Hover → expands to 220px overlay.
Click pin → stays open. Shows: Origin, Bodies, Sketches, Construction.

**Variable Bar**: New concept. A horizontal strip showing your named variables as
editable chips. Click a chip → edit value/expression. Drag chip to a dimension
input → creates reference. Always visible so you never lose track of your parameters.

**Properties**: Floating panel near selection. Appears when you select something,
disappears when you deselect. NOT a permanent sidebar.

**Sketch Mode**: When active, the toolbar transforms to show sketch tools. The
tree shows sketch entities. The viewport goes to orthographic view of the sketch
plane.

---

## 5. FEATURE SET — PHASED

### Phase 1: Parametric Foundation (Current sprint)
**Goal**: A usable sketch → extrude → boolean workflow with named variables.

| Feature | Description | Priority |
|---------|-------------|----------|
| Variable Manager | Define, edit, group, reference variables | P0 |
| Expression Evaluator | Parse and compute variable expressions | P0 |
| Variable Bar UI | Horizontal bar with editable variable chips | P0 |
| Sketch: Line | Draw connected line segments | P0 |
| Sketch: Arc (3-point) | Draw arc through 3 points | P0 |
| Sketch: Constraints | Coincident, horizontal, vertical, perpendicular | P0 |
| Sketch: Dimension | Click-to-dimension creates a named variable | P0 |
| Extrude (advanced) | Distance, symmetric, to-face, cut/join/new | P0 |
| Revolve | Profile + axis → solid of revolution | P1 |
| Fillet 3D | Round edges with SDF smooth-min | P1 |
| Shell | Hollow out body with wall thickness | P1 |
| Properties Panel | Floating context panel near selection | P0 |
| Contextual Toolbar | Toolbar changes with selection/mode | P0 |
| Tree (collapsible) | Icon-collapsed tree, hover-expand | P0 |

### Phase 2: Industrial Features
**Goal**: Complete enough for injection mold part design.

| Feature | Description | Priority |
|---------|-------------|----------|
| Draft Angle | Apply/analyze draft per face | P0 |
| Wall Thickness Analysis | Color-map visualization on GPU | P0 |
| Undercut Detection | Identify areas that can't demold | P1 |
| Mirror 3D | Reflect features across plane | P0 |
| Pattern (Rect) | Repeat features in grid | P0 |
| Pattern (Circular) | Repeat features around axis | P0 |
| Hole Wizard | Standard holes with thread spec | P1 |
| Material Database | Full polymer + metal library with all properties | P0 |
| Shrinkage Comp. | Auto-scale cavity by material shrinkage factor | P0 |
| Section View | Cut model with plane, see interior | P0 |
| Measure Tool | Distance, angle, area between entities | P0 |

### Phase 3: Mold Design
**Goal**: Design the complete mold, not just the part.

| Feature | Description | Priority |
|---------|-------------|----------|
| Parting Line | Define split between core & cavity | P0 |
| Core/Cavity Split | Generate mold halves from part + parting | P0 |
| Runner Design | Cold/hot runner system layout | P1 |
| Gate Placement | Optimize gate location for balanced fill | P1 |
| Cooling Channels | Layout conformal cooling paths | P1 |
| Ejector Layout | Place ejector pins with force calculation | P1 |
| Mold Base Library | DME/Hasco/Misumi standard bases | P2 |
| Slide Mechanisms | Side-action design for undercuts | P2 |

### Phase 4: Simulation
**Goal**: Validate designs without leaving GAIA Forge.

| Feature | Description | Priority |
|---------|-------------|----------|
| Stress (Von Mises) | FEA via SDF sampling + GPU compute | P0 |
| Thermal Steady | Heat transfer analysis | P0 |
| Thermal Transient | Cooling simulation for mold cycle | P1 |
| Fill Simulation | Plastic flow (Hele-Shaw) | P1 |
| Pack/Hold | Pressure distribution during packing | P2 |
| Warpage Predict | Residual stress → deformation | P2 |
| Clamp Force | Required tonnage calculation | P1 |
| Modal Analysis | Natural frequencies + mode shapes | P2 |

### Phase 5: Advanced
**Goal**: Compete with Moldflow and Sigmasoft.

| Feature | Description | Priority |
|---------|-------------|----------|
| Optimizer | Auto-tune variables to meet constraints | P1 |
| DOE | Design of Experiments — sweep variable ranges | P1 |
| Report Generator | PDF with dimensions, tolerances, simulation results | P1 |
| STEP Export | Interoperability with other CAD tools | P0 |
| 3MF Export | Rich format with materials for 3D printing | P1 |
| Collaboration | Real-time multi-user editing | P2 |
| Version Control | Git-style branching for designs | P1 |
| Plugin System | JS/TS extensions for custom tools | P2 |

---

## 6. SIMULATION ENGINE ARCHITECTURE

We already have `formulas.ts` with 1458 lines of engineering math (Timoshenko,
von Mises, Navier, Fourier — all referenced). Here's how it integrates:

### 6.1 SDF-Based FEA

Traditional FEA requires a mesh. We don't have one, and we don't want one.
Instead, we use **meshless methods** on the SDF field:

**Approach**: Smoothed Particle Hydrodynamics (SPH) adapted for solids, or
Reproducing Kernel Particle Method (RKPM).

1. **Sample the SDF** on a regular grid (GPU compute shader)
2. **Identify interior points** where `sdf(p) < 0`
3. **Build stiffness contributions** per point using radial basis functions
4. **Solve** using conjugate gradient on GPU
5. **Visualize** stress/displacement as SDF field color overlay

For injection molding simulation:
- The SDF naturally handles complex mold geometries
- Flow front tracking: the fill fraction is another scalar field
- Temperature: another scalar field on the same grid
- GPU parallelism makes it fast enough for interactive

### 6.2 GPU Compute Pipeline

```
SDF Scene (GLSL map function)
  │
  ▼
Voxelize Interior (Compute Shader)
  │
  ▼
Apply Boundary Conditions (from variable constraints)
  │
  ▼
Solve (iterative, GPU-parallel)
  │
  ▼
Scalar Field Result (stress, temperature, displacement)
  │
  ▼
Color Map on Ray March (shader reads result texture + maps to color)
```

This entire pipeline runs on the GPU. The CPU orchestrates but doesn't touch
per-voxel data.

### 6.3 Material Model Integration

The `formulas.ts` material database becomes a first-class system:

```typescript
// Every material is a collection of variables
const abs = defineVariableGroup('material_abs', {
  name: 'ABS (Acrylonitrile Butadiene Styrene)',
  E: { value: 2.3e9, unit: 'Pa', desc: 'Young\'s modulus' },
  nu: { value: 0.35, unit: 'none', desc: 'Poisson\'s ratio' },
  rho: { value: 1050, unit: 'kg/m3', desc: 'Density' },
  sigma_y: { value: 40e6, unit: 'Pa', desc: 'Yield strength' },
  k: { value: 0.17, unit: 'W/(m·K)', desc: 'Thermal conductivity' },
  cp: { value: 1400, unit: 'J/(kg·K)', desc: 'Specific heat' },
  T_melt: { value: 230, unit: '°C', desc: 'Melt temperature' },
  T_mold: { value: 60, unit: '°C', desc: 'Recommended mold temperature' },
  shrinkage: { value: 0.006, unit: 'none', desc: 'Linear shrinkage (0.5-0.7%)' },
  mfi: { value: 25, unit: 'g/10min', desc: 'Melt Flow Index (220°C/10kg)' },
  min_wall: { value: 1.0, unit: 'mm', desc: 'Minimum wall thickness' },
  rec_wall: { value: 2.0, unit: 'mm', desc: 'Recommended wall thickness' },
  draft_min: { value: 0.5, unit: 'deg', desc: 'Minimum draft angle' },
  draft_rec: { value: 1.5, unit: 'deg', desc: 'Recommended draft angle' },
});
```

The user selects a material, and all these become available as `$material.E`,
`$material.shrinkage`, etc. in any expression.

---

## 7. DATA MODEL

### 7.1 Project Structure

```typescript
interface GaiaProject {
  id: string;
  name: string;
  units: { length: 'mm' | 'cm' | 'in'; angle: 'deg' | 'rad' };
  variables: GaiaVariable[];          // Global variables
  materials: MaterialAssignment[];     // Material definitions
  components: GaiaComponent[];         // Top-level components
  simulations: SimulationStudy[];      // Simulation setups
}

interface GaiaComponent {
  id: string;
  name: string;
  visible: boolean;
  variables: GaiaVariable[];           // Component-local variables
  features: GaiaFeature[];             // Ordered feature list (timeline)
  children: GaiaComponent[];           // Sub-components
}

interface GaiaFeature {
  id: string;
  type: FeatureType;
  name: string;
  suppressed: boolean;
  variables: GaiaVariable[];           // Feature-local variables (dimensions)
  params: Record<string, string>;      // Param name → expression string
  sketchId?: string;                   // Reference to source sketch
}

type FeatureType =
  | 'sketch'
  | 'extrude' | 'revolve' | 'sweep' | 'loft'
  | 'fillet' | 'chamfer' | 'shell' | 'draft'
  | 'pattern_rect' | 'pattern_circular' | 'mirror'
  | 'boolean_union' | 'boolean_subtract' | 'boolean_intersect'
  | 'hole' | 'thread'
  | 'construction_plane' | 'construction_axis' | 'construction_point';
```

### 7.2 Sketch Data Model

```typescript
interface GaiaSketch {
  id: string;
  name: string;
  plane: SketchPlaneRef;               // Origin plane or face reference
  entities: SketchEntity[];
  constraints: SketchConstraint[];
  dimensions: SketchDimension[];        // Each creates a GaiaVariable
  fullyConstrained: boolean;            // All DOF resolved
  underConstrainedDOF: number;          // Remaining degrees of freedom
}

type SketchEntity =
  | { type: 'point'; id: string; x: string; y: string }  // expressions
  | { type: 'line'; id: string; start: string; end: string }
  | { type: 'arc'; id: string; center: string; start: string; end: string }
  | { type: 'circle'; id: string; center: string; radius: string }
  | { type: 'spline'; id: string; points: string[] }
  | { type: 'rect'; id: string; origin: string; w: string; h: string };

type SketchConstraint =
  | { type: 'coincident'; a: string; b: string }
  | { type: 'horizontal'; entity: string }
  | { type: 'vertical'; entity: string }
  | { type: 'perpendicular'; a: string; b: string }
  | { type: 'parallel'; a: string; b: string }
  | { type: 'tangent'; a: string; b: string }
  | { type: 'equal'; a: string; b: string }
  | { type: 'fix'; entity: string }
  | { type: 'symmetric'; a: string; b: string; axis: string }
  | { type: 'midpoint'; point: string; line: string };

interface SketchDimension {
  type: 'distance' | 'angle' | 'radius' | 'diameter';
  entities: string[];                   // What's being dimensioned
  variableId: string;                   // Links to GaiaVariable
}
```

---

## 8. FILE FORMAT

GAIA Forge uses `.gaia` files — JSON with a defined schema:

```json
{
  "format": "gaia-forge",
  "version": "1.0.0",
  "project": { ... GaiaProject ... }
}
```

Benefits:
- Human-readable (JSON)
- Git-diffable (text format)
- No proprietary encoding
- Easy to parse in any language
- Can include embedded base64 for imported meshes/images

---

## 9. WHAT EXISTS TODAY vs. WHAT WE NEED

> **Última actualización**: 29 de marzo 2026
> **Total**: 18,574 líneas TS/TSX + 13,759 líneas de scripts de prueba

### Already Built ✅ (Funcional y conectado a la UI)

**Motor Geométrico (core)**:
- SDF engine con compilador GLSL — 6 primitivas, 4 booleanas, módulos (`sdf-engine.ts`, 524 líneas)
- GPU ray march renderer — pixel-perfect a 60fps (`RayMarchMesh.tsx`, 366 líneas)
- CPU SDF evaluator para picking/selección (`sdf-cpu.ts`, 242 líneas)
- Marching Cubes en Web Worker con LOD adaptativo 64³→512³ (`mc-worker.ts`, 503 líneas)
- Viewport Three.js con grid infinito, ViewCube, orbit/pan/zoom (`ForgeViewport.tsx`, 339 líneas)

**Sistema de Variables**:
- Variables con nombre, expresiones, dependencias, unidades (`gaia-variables.ts`, 392 líneas)
- Variable Bar UI con chips editables en ForgePage
- Expression evaluator conectado al scene graph

**Import/Export**:
- Importación STEP/IGES vía occt-import-js con descomposición de ensambles (`step-import.ts`, 437 líneas)
- STL export con resolución configurable (`stl-export.ts`, 475 líneas)  
- SVG blueprint export con vistas ortogonales (`blueprint-export.ts`, 372 líneas)
- Blueprint Panel interactivo (`BlueprintPanel.tsx`, 590 líneas)
- Drag & Drop de archivos CAD y .mch

**Ingeniería Inversa y Análisis**:
- Reverse engineering: modelo → primitivas SDF (`reverse-engineer.ts`, 897 líneas)
- CT-Scan decomposición multi-eje (`cross-section.ts`, 765 líneas)
- GPU cross-section con winding number (`gpu-cross-section.ts`, 1,090 líneas)
- Sketch fitting a secciones transversales (`sketch-fitting.ts`, 789 líneas)
- Feature recognition geométrico (`feature-recognition.ts`, 675 líneas)
- Profile-to-SDF conversion (`profile-to-sdf.ts`, 460 líneas)

**Manufactura**:
- Parser de 8 configuraciones de máquinas CNC reales (`machine-config.ts`, 555 líneas)
- Máquinas: Haas VF-2/EC-630/VS-3, Hurco BX40i, DATRON Neo, Brother M300X3, GROB G350, Bambu Lab P1P

**Sketch 2D** (básico):
- Rectángulo y círculo en planos XY/XZ/YZ (`sketch-engine.ts`, 114 líneas)
- Sketch-in-viewport con overlay SVG (`SketchInViewport.tsx`, 331 líneas)
- Face picking: CPU ray march → normal → plano → sketch en cara
- Extrusión de sketches a primitivas SDF

**UI Completa**:
- ForgePage con menubar Fusion 360-style, variabels bar, tree, properties (`ForgePage.tsx`, 2,278 líneas)
- Omnibar búsqueda universal ⌘K con 60+ comandos (`Omnibar.tsx`, 339 líneas)
- Marking Menu radial contextual (`MarkingMenu.tsx`, 282 líneas)
- Shortcut Overlay (`ShortcutOverlay.tsx`, 106 líneas)
- Timeline de historial (`Timeline.tsx`, 140 líneas)
- Sketch Panel de herramientas (`SketchPanel.tsx`, 285 líneas)
- Vista de sección por eje con flip
- Transiciones de cámara suaves a vistas estándar (numpad)
- Audio feedback para todas las acciones (`forge-audio.ts`, 237 líneas)
- 10 componentes shadcn/ui (menubar, tooltip, dialog, command, button, input, etc.)

**Fórmulas y Materiales** (implementado pero NO conectado a UI):
- `formulas.ts` (1,457 líneas): 20+ materiales, matrices de elasticidad 3D, Von Mises, 
  elementos FEA (tet4, beam, truss, CST), térmica (Fourier, Newton, aletas), fluidos 
  (Bernoulli, Darcy, Reynolds), fatiga (Goodman, Basquin), solver CG precondicionado, 
  mallado tetraédrico

**Estado Zustand** (1,102 líneas):
- Scene graph jerárquico con módulos
- Historial undo/redo completo
- Variables con resolución de expresiones
- Imported models + machine configs
- Reverse engineering + CT scan + sketch fitting
- Section view state
- Session sync

### Needs Evolution 🔄

- **ForgePage.tsx** (2,278 líneas) — Funcional pero necesita rediseño de layout:
  viewport al 100%, eliminar menubar permanente, Tool Strip vertical, Inspector HUD
- **Tema visual** — Demasiado negro (`#08090d`). Necesita más profundidad navy, no void black.
  La spec dice `#12151c` base, pero el CSS usa `#08090d`. Corregir.
- **useForgeStore.ts** — Migrar de SdfNode a modelo GaiaProject/GaiaFeature para features paramétricos
- **Sketch engine** — De solo rect/circle a constraint-based con solver Newton-Raphson
- **Timeline** — Reemplazar con Operation Stack (últimos 3-5 cambios con undo)

### Needs Building 🆕

**Prioridad Alta (Phase 1)**:
- Sketch constraint solver (Newton-Raphson para geometric constraints)
- Sketch: Line, Arc 3-point, Trim, Extend, Offset, Mirror, Pattern, Constraints, Dimensions
- Extrude avanzado (cut/join/new body, symmetric, to-face)
- Revolve, Sweep, Loft
- Fillet 3D + Shell + Draft via SDF
- Pattern (rectangular + circular) y Mirror 3D
- Inline dimensions: cotas 3D editables sobre la geometría
- Inspector HUD: propiedades flotantes ancladas al objeto seleccionado
- Tool Strip vertical reemplazando menubar

**Prioridad Media (Phase 2-3)**:
- FEA conectado: SDF → mesh adaptativo → solver → GPU overlay
- Simulación de inyección (Hele-Shaw)
- CAM: toolpaths desde SDF, post-procesadores Fanuc/Siemens/Haas
- Diseño Generativo / Optimización Topológica GPU
- Lattice/TPMS nativo (gyroid, Schwarz-P, diamond)

**Prioridad Futura (Phase 4+)**:
- CFD (Lattice Boltzmann GPU)
- Assembly con joints
- Cotizador BOM + integración proveedores
- Simulación de planta (Digital Twin)
- Workspace de robótica (URDF + IK/FK + path planning)
- IDE de firmware (Monaco + WebUSB flash)
- Dibujos 2D con GD&T
- Export STEP AP242, 3MF

---

## 10. DECISION LOG

| Decision | Rationale | Date |
|----------|-----------|------|
| F-Rep over B-Rep | Exact math, no mesh errors, GPU-native, free booleans | 2026-03 |
| GPU ray marching | Pixel-perfect, no LOD, no tessellation artifacts | 2026-03 |
| Variables-first | Engineers think in parameters, not in mouse clicks | 2026-03 |
| JavaScript expressions | Familiar, powerful, no new DSL to learn | 2026-03 |
| React + Three.js | Web-native, zero install, works everywhere | 2026-03 |
| Meshless FEA | No mesh = no meshing step = faster iteration | 2026-03 |
| JSON file format | Git-friendly, human-readable, no vendor lock | 2026-03 |
| Open source | Trust, community, extensibility | 2026-03 |

---

*This document defines what GAIA Forge IS. Code that contradicts this document
is wrong. If reality reveals this document is wrong, update the document first,
then fix the code.*
