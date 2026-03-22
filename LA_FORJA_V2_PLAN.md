# 🔨 La Forja de Hefestos v2 — Plan Maestro

> "Reinventar la rueda, pero con matemáticas puras."
> Motor F-Rep + la UX de Fusion 360 + IDE propio + alma mexicana.
>
> **Lo que Fusion 360 NUNCA tendrá:** cotizar y pedir material con 1 click, simular tu planta completa como digital twin, programar tus robots directamente desde el diseño, y flashear tu placa personalizada sin salir de la herramienta.

---

## 1. ANÁLISIS COMPLETO DE FUSION 360

### 1.1 Workspaces (Espacios de trabajo)

Fusion 360 organiza TODO en **workspaces independientes** que comparten el mismo modelo paramétrico. El usuario cambia de workspace desde un dropdown en la toolbar superior. Cada workspace tiene su propia toolbar, paneles y lógica.

| # | Workspace | Qué hace | Herramientas clave |
|---|-----------|----------|--------------------|
| 1 | **Design** | Modelado sólido/superficies/paramétrico | Sketch, Extrude, Revolve, Loft, Sweep, Shell, Fillet, Chamfer, Pattern, Mirror, Thread, Hole, Split, Combine, Thicken, Boundary Fill |
| 2 | **Sculpt (Form)** | Modelado orgánico T-Splines | Edit Form, Subdivide, Insert Edge, Merge Edge, Bridge, Flatten, Crease, UnCrease, Thicken |
| 3 | **Mesh** | Editar mallas STL/OBJ importadas | Reduce, Remesh, Make Closed, Smooth, Plane Cut, Shell, Boolean (mesh-level) |
| 4 | **Sheet Metal** | Lámina metálica con dobleces | Flange, Bend, Unfold, Refold, Flat Pattern, Relief, Corner |
| 5 | **Render** | Fotorrealismo con ray tracing | Materiales PBR (400+), Escenas HDR, Decals, Render in-canvas y cloud, Turntable animation |
| 6 | **Animation** | Secuencias de ensamblaje | Transform, Explode, Manual Explode components, Storyboard timeline, Publish video |
| 7 | **Simulation** | FEA / análisis estructural | Static Stress, Modal Frequencies, Thermal, Buckling, Shape Optimization, Nonlinear, Event Simulation |
| 8 | **Manufacture** | CAM / trayectorias CNC | 2D/3D Adaptive, Pocket, Contour, Drilling, Turning, Multi-axis (3-5 ejes), Additive (FDM/SLS/MJF), Post Processors |
| 9 | **Drawing** | Planos 2D técnicos | Automatic Drawing generation, Section Views, Detail Views, Breakout Sections, Dimensions, Balloons, BOM, GD&T |
| 10 | **Electronics** | PCB / esquemáticos | Schematic Editor, PCB Layout, Auto-route, DRC, SPICE Simulator, 3D Board View, Gerber Export |
| 11 | **Generative Design** | IA optimiza geometría | Define obstacles/preserve geometries, Load cases, Manufacturing constraints, Cloud solve → multiple results, Compare outcomes |

**Workspaces NUEVOS exclusivos de La Forja (Fusion 360 NO tiene estos):**

| # | Workspace | Qué hace | Por qué Fusion 360 no lo tiene |
|---|-----------|----------|-------------------------------|
| 12 | **Cotizador** | BOM automático + cotización en tiempo real + pedido de material con 1 click | Es software de diseño, no de compras |
| 13 | **Planta** | Digital twin de fábrica: layout 2D/3D, maquinaria, simulación de flujo productivo | No es su mercado objetivo |
| 14 | **Robótica** | Diseño de robots + programación nativa (Python/C++/ROS2) + simulación de trayectorias | Solo simulación cinemática, CERO programación |
| 15 | **IDE de Placa** | Monaco Editor embebido + toolchain + flash por USB directo al hardware | Es CAD, no IDE de firmware |

### 1.2 Design Workspace — Detalle completo

El corazón de Fusion 360. Todo es **paramétrico** — cada operación queda en un **timeline** (historial) y se puede editar retroactivamente.

#### Sketch (2D)
- **Primitivas**: Línea, Rectángulo, Círculo, Arco (3-point, tangent, center), Elipse, Polígono, Spline (control-point y fit-point), Conic Curve, Point
- **Restricciones (Constraints)**: Horizontal, Vertical, Coincident, Tangent, Perpendicular, Parallel, Equal, Concentric, Midpoint, Symmetry, Collinear, Fix/Unfix, Smooth
- **Dimensiones**: Linear, Angular, Radial, Diameter — todas editable como parámetros con nombres
- **Herramientas**: Offset, Trim, Extend, Fillet, Chamfer, Mirror, Circular Pattern, Rectangular Pattern, Project, Intersect, Slice, Text
- **Construction geometry**: líneas de construcción que no forman perfil
- **Planos de sketch**: cualquier plano, cara, o plano offset/angled

#### Solid Modeling (3D)
- **Create**: Extrude, Revolve, Sweep, Loft, Rib, Web, Hole (simple, counterbore, countersink, tapped), Thread (cosmetic + modeled), Coil, Pipe, Emboss/Engrave
- **Modify**: Fillet (constant, variable, chord), Chamfer (equal, two-distance, angle), Shell, Draft, Scale, Move/Copy, Align, Replace Face, Split Face, Split Body, Combine (join, cut, intersect), Offset Face, Thicken, Delete, Press Pull
- **Pattern**: Rectangular, Circular, Pattern on Path
- **Mirror**: cara, plano, o plano de construcción
- **Combine**: unir cuerpos sólidos, cortar, intersectar
- **Direct Editing**: Push/Pull caras sin depender del timeline

#### Surface Modeling
- **Create**: Extrude, Revolve, Sweep, Loft, Patch, Offset Surface, Ruled Surface
- **Modify**: Trim, Untrim, Extend, Stitch, Unstitch, Thicken (surface→solid), Reverse Normal
- **No paramétrico**: superficies complementan formas que el sólido no puede

#### Assembly
- **Joints**: Rigid, Revolute, Slider, Cylindrical, Pin-Slot, Planar, Ball
- **Joint Limits**: mín/máx con resorte + amortiguación
- **Motion Study**: animar joints, detectar interferencias
- **As-built joint**: posicionar y luego definir movimiento
- **Components**: externos (linked) e internos, contextos de ensamblaje
- **Grounded component**: fija uno, los demás se mueven relativo

#### Parámetros y Configuraciones
- **Tabla de parámetros**: todas las cotas como variables con nombre, fórmulas, unidades
- **Favorited parameters**: acceso rápido
- **Configurations table**: variantes del mismo diseño (ej: S/M/L/XL)
- **User parameters**: variables globales que controlan múltiples feature

#### Timeline / History
- Cada operación es un nodo en el timeline inferior
- Se puede arrastrar el marcador para ver el estado en cualquier punto
- Editar features pasados → se propagan cambios automáticamente
- Suppress/Unsuppress features
- Capture Design History ON/OFF

### 1.3 Sculpt (T-Splines)
- Malla de subdivisión manipulable con caras/bordes/vértices
- Edit Form: mover caras o bordes con gizmo 3D
- Subdivide para agregar detalle local
- Insert Edge / Merge Edge para topología
- Bridge para conectar huecos
- Crease para crear bordes duros
- Thicken para convertir a sólido
- Symmetry (bilateral/radial)
- **Resultado**: se convierte a B-Rep para ser usado en Design workspace

### 1.4 Render
- **Materiales PBR**: 400+ materiales de Autodesk Material Library (metales, plásticos, madera, vidrio, cerámica, tela, compuestos)
- **Apariencias personalizadas**: editar roughness, metallic, bump map, opacity, self-illumination
- **Escenas**: Studio, Environment (HDR maps), suelo con sombras/reflejos
- **Render modes**: In-canvas (tiempo real), Local Render (path tracing), Cloud Render (resolution/quality)
- **Textura y Decals**: aplicar imágenes/logos sobre caras del modelo
- **Cámara**: focal length, exposure, depth of field
- **Turntable**: animación rotacional para presentaciones

### 1.5 Animation
- Timeline con keyframes
- Transform Components: mover/rotar partes a lo largo del tiempo
- Explode/Collapse componentes con distancia configurable
- Manual Explode: arrastrar partes individualmente
- Camera viewpoints como keyframes
- Export como video (MP4/AVI)
- Anotaciones durante la animación

### 1.6 Simulation (FEA)
- **Tipos de estudio**: Static Stress, Modal Frequencies, Thermal Steady-State, Thermal Transient, Structural Buckling, Nonlinear Static, Event Simulation, Shape Optimization
- **Cargas**: Force, Pressure, Moment, Bearing Load, Remote Force/Moment, Body Load (gravity, acceleration), Thermal loads
- **Restricciones**: Fixed, Pin, Frictionless, Spring, Prescribed Displacement
- **Mesh**: tetraédrico adaptable, refinamiento local, mesh preview
- **Resultados**: Von Mises stress, displacement, safety factor, reaction forces, contact pressure, mode shapes
- **Materiales**: propiedades mecánicas (Young's modulus, Poisson, yield, density, thermal conductivity)
- **Contactos**: bonded, sliding, separation, no-penetration
- **Convergencia**: h-refinement automático

### 1.7 Manufacture (CAM)
- **Setup**: definir stock (box, cylinder, from solid), WCS, fixture
- **2D Toolpaths**: Face, 2D Adaptive, 2D Pocket, 2D Contour, Slot, Trace, Thread, Bore, Circular, Engrave
- **3D Toolpaths**: 3D Adaptive, Pocket, Flat, Contour, Pencil, Scallop, Steep, Parallel, Radial, Spiral, Horizontal, Morphed Spiral, Project
- **Multi-axis**: Swarf, Multi-axis contour, Flow, Morph Spiral, Advanced Swarf
- **Turning**: Turning Face, Profile, Groove, Thread, Bore, Chamfer, Cutoff, Part-off
- **Drilling**: Drill, Peck, Chip Breaking, Tapping, Bore, Ream, Thread Mill
- **Additive**: FDM slicing, SLS/MJF arrangement, Orientation studies, Support generation
- **Inspection**: Contact probing, surface inspection
- **Simulation**: Verify toolpaths con stock simulation, Machine Collision Detection
- **Post**: 100+ post processors open-source (Haas, Mazak, Okuma, Fanuc, Grbl, etc.)
- **Tool Library**: definir herramientas con geometría completa

### 1.8 Drawing
- **Auto-generation**: crea planos automáticamente con vistas, cotas y partes list
- **Vistas**: Base, Projected, Section, Detail, Breakout Section, Auxiliary
- **Dimensiones**: Linear, Angular, Radial, Ordinate, Baseline, Chain
- **Anotaciones**: Center Line, Center Mark, GD&T symbols, Surface Finish, Weld, Balloon
- **BOM**: Bill of Materials automático, editable
- **Hojas**: A0-A4, ANSI, custom sizes, title block configurable
- **Export**: DWG, DXF, PDF

### 1.9 Electronics
- **Schematic**: editor con library de componentes (resistencias, capacitores, ICs, conectores)
- **PCB Layout**: 2D editor con layers (copper, solder mask, silk screen)
- **Auto-route**: ruteo automático de pistas
- **DRC**: design rule check (clearances, widths, via sizes)
- **SPICE Simulator**: simulación de circuitos analógicos
- **3D Board**: vista 3D del PCB para verificar fit mecánico
- **Export**: Gerber, Drill files, Pick & Place, BOM

### 1.10 Generative Design
- Define **preserve geometry** (lo que debe quedar) y **obstacle geometry** (lo que no se puede tocar)
- Define **load cases**: fuerzas y restricciones
- Escoge **manufacturing method**: unrestricted, milling, casting, additive
- Envía a la **nube** → resuelve decenas de variantes
- Compara resultados por peso, stress, displacement, factor de seguridad
- Convierte resultado seleccionado a sólido editable

### 1.11 UI/UX Paradigm

#### Layout
```
┌────────────────────────────────────────────────────────┐
│  Workspace dropdown │  Toolbar (contextual por workspace)       │ Search │ Account │
├────────────┬───────────────────────────────────────────────────────────┤
│ Data Panel │                                                          │
│ (archivos) │              3D VIEWPORT                                 │
│            │          (perspectiva / orbit / pan / zoom)              │
│            ├──────────────────────────────────────────────┤ Inspector │
│            │                                              │ (propiedades│
│  Browser   │                                              │  del feature│
│  (árbol    │                                              │  seleccionado)
│   de       │                                              │           │
│  componentes│                                             │           │
│  + timeline)│                                             │           │
│            │                                              │           │
├────────────┴──────────────────────────────────────────────┴───────────┤
│  Timeline (historial paramétrico) ← ← ← ← → → → → → → → →         │
├──────────────────────────────────────────────────────────────────────┤
│  Marking Menu (clic derecho = radial menu contextual)               │
└──────────────────────────────────────────────────────────────────────┘
```

#### Colores Fusion 360
- **Fondo**: gris oscuro uniforme (#3c3c3c a #505050)
- **Toolbar**: gris muy oscuro (#2d2d2d), íconos claros
- **Viewport background**: gradiente gris (#666 top → #999 bottom) — NO negro como Blender
- **Selection**: azul (#0696D7 — Autodesk blue)
- **Active feature**: amarillo (#FFB900)
- **Surface/body hover**: cyan highlight
- **Ground plane**: cuadrícula sutil, eje X=rojo, Y=verde, Z=azul (standard CAD)
- **Panels**: fondo ligeramente más claro que toolbar, bordes sutiles, esquinas redondeadas
- **Texto**: blanco/gris claro (#CCCCCC), tamaño ~11px
- **Botones**: gris medio con hover azul, sin bordes agresivos
- **Overall feel**: profesional, limpio, neutral — ni oscuro extremo ni claro

#### Interacción 3D
- **Orbit**: Middle mouse button (o Shift + Middle)
- **Pan**: Middle + Shift
- **Zoom**: Scroll wheel + pinch
- **Select**: Click izquierdo
- **Context menu**: Click derecho → Marking menu radial
- **ViewCube**: cubo 3D interactivo en esquina (Home, Front, Top, Right, ISO, etc.)
- **Navigation bar**: orbit, pan, zoom, look at, fit all, section analysis
- **Gizmo de transformación**: ejes XYZ con manijas de translate, rotate y scale

#### Marking Menu (menú radial)
- Click derecho en el viewport → menú radial con 8 posiciones
- Contexto-dependiente: diferente al seleccionar cara, borde, cuerpo, sketch, etc.
- Acceso rápido a los comandos más usados sin ir a toolbar
- Customizable

#### Keyboard Shortcuts
- S = shortcut box (mini-toolbar flotante personalizable)
- L = Line
- C = Circle
- R = Rectangle
- E = Extrude
- Q = Press/Pull
- F = Fillet
- D = Dimension
- M = Move
- Ctrl+Z / Ctrl+Y = Undo/Redo

---

## 2. QUÉ TIENE LA FORJA HOY vs QUÉ NECESITA

| Categoría | La Forja v1 | Fusion 360 | Gap |
|-----------|-------------|------------|-----|
| **Motor geométrico** | F-Rep/SDF (único diferenciador) | B-Rep + NURBS Parasolid | Nuestro F-Rep es superior para formas orgánicas y booleanas, inferior para precisión de bordes |
| **Primitivas** | 6 (sphere, box, cylinder, torus, cone, capsule) | Infinitas vía sketch→extrude→revolve→sweep→loft | Necesitamos sketch 2D + operaciones 3D |
| **Booleanas** | union, subtract, intersect, smooth union | join, cut, intersect | ✅ Estamos bien, `smooth union` es ventaja nuestra |
| **Renderer** | WebGL2 ray marching (LENTO 💀) | OpenGL rasterization + ray trace render | **CRÍTICO: Cambiar a Three.js/rasterization** |
| **UI** | Panel flotante simple | Workspace system completo | **CRÍTICO: Rediseñar totalmente** |
| **Sketch 2D** | ❌ No existe | Completo con constraints | **NECESITA: sistema de sketch** |
| **Timeline/History** | ❌ No existe | Paramétrico completo | **NECESITA: historial de operaciones** |
| **Gizmos** | ❌ No existe | Translate/Rotate/Scale 3D | **NECESITA: transform gizmos** |
| **Export** | STL + SVG blueprint | STEP, IGES, SAT, STL, OBJ, 3MF, DWG, DXF, PDF | Expandir formatos |
| **Assembly** | ❌ No existe | Joints + Motion Study | Fase posterior |
| **Simulation** | Stats + kinematics básico | FEA completo | Fase posterior |
| **CAM** | ❌ No existe | Completo 2-5 ejes | Fase posterior |
| **Render** | GLSL live (el que es lento) | PBR + ray tracing | Three.js PBR primero |
| **ViewCube** | ❌ No existe | Completo | NECESITA |
| **Marking Menu** | ❌ No existe | Radial completo | NECESITA |
| **Cotizador BOM** | ❌ No existe | ❌ No existe en Fusion | **VENTAJA: lo construimos nosotros** |
| **Marketplace materiales** | ❌ No existe | ❌ No existe en Fusion | **VENTAJA: 1-click comprar** |
| **Simulación de planta** | ❌ No existe | ❌ No existe en Fusion | **VENTAJA: digital twin de fábrica** |
| **Robótica + Programación** | ❌ No existe | Kinematics solo, sin código | **VENTAJA: diseña + programa + flashea** |
| **IDE de firmware** | ❌ No existe | ❌ No existe en Fusion | **VENTAJA: Monaco + toolchain integrado** |
| **Flash directo USB** | ❌ No existe | ❌ No existe en Fusion | **VENTAJA: WebUSB API nativa** |

---

## 3. ARQUITECTURA PROPUESTA — La Forja v2

### 3.1 Stack Tecnológico

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer (React + Tailwind)       │
│  Workspaces │ Toolbars │ Panels │ Timeline │ Menus  │
│  + IDE Monaco │ Cotizador │ Planta │ Robótica       │
├─────────────────────────────────────────────────────┤
│               Scene Graph (zustand store)            │
│  Parametric History │ Component Tree │ Constraints   │
│  + Robot URDF Tree │ Plant Layout Graph              │
├─────────────────────────────────────────────────────┤
│           Three.js Rendering Engine                  │
│  Rasterization │ PBR Materials │ Gizmos │ Grid      │
│  + Plant Digital Twin renderer                      │
├─────────────────────────────────────────────────────┤
│         Geometry Pipeline                            │
│  ┌─────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ F-Rep   │──▶│ Marching     │──▶│ Three.js     │ │
│  │ SDF     │   │ Cubes (CPU)  │   │ Mesh         │ │
│  │ Engine  │   │ (Web Worker) │   │ (60fps)      │ │
│  └─────────┘   └──────────────┘   └──────────────┘ │
├─────────────────────────────────────────────────────┤
│         Export Pipeline                              │
│  STL │ OBJ │ 3MF │ STEP*(futuro) │ SVG │ PDF      │
│  + URDF │ ROS2 pkg │ Arduino sketch │ Gerber       │
├─────────────────────────────────────────────────────┤
│         Simulation Engine                            │
│  Kinematics │ FEA (futuro) │ Stress viz             │
│  + Discrete Event Simulation (planta)               │
│  + IK/FK Solver (robótica)                          │
├─────────────────────────────────────────────────────┤
│         IDE + Firmware Layer                         │
│  Monaco Editor │ LSP (clangd/pylsp/rust-analyzer)  │
│  Toolchain WASM (avr-gcc, xtensa-gcc, arm-eabi)    │
│  WebUSB Flash │ Serial Monitor │ Logic Analyzer     │
├─────────────────────────────────────────────────────┤
│         Commerce / Procurement Layer                 │
│  BOM Engine │ Supplier API (precio tiempo real)     │
│  Cart → Proveedor │ DFM Cost Estimator              │
└─────────────────────────────────────────────────────┘
```

### 3.2 Web vs Desktop — Decisión

| Factor | Web (actual) | Desktop (Electron/Tauri) |
|--------|-------------|--------------------------|
| **GPU access** | WebGL2/WebGPU | OpenGL/Vulkan nativo |
| **Threads** | Web Workers (limitados) | Threads nativos ilimitados |
| **File system** | API limitada | Acceso completo |
| **Memory** | ~4GB máximo | Sin límite |
| **Distribution** | URL → funciona | Instalador |
| **Three.js** | ✅ Funciona perfecto | ✅ Funciona en Electron |
| **Performance** | Suficiente con Three.js para MVP | Mejor para modelos enormes |

**DECISIÓN**: Empezar web con Three.js. Si el Marching Cubes en Web Worker no alcanza para modelos de 500K+ triángulos, migrar a **Tauri** (más ligero que Electron, backend en Rust).

Three.js en web YA maneja escenas de millones de triángulos a 60fps — no hay razón para ir desktop todavía.

### 3.3 El Pipeline F-Rep → Pantalla

```
1. Usuario edita parámetros (slider, input, gizmo drag)
        ↓
2. Scene graph (SdfNode[]) se actualiza inmediatamente
        ↓
3. Se envía a Web Worker: marchingCubes(scene, resolution)
        ↓
4. Worker evalúa SDF en grid 3D → genera triángulos
        ↓
5. Worker retorna Float32Array de vértices + normales
        ↓
6. Main thread actualiza Three.js BufferGeometry
        ↓
7. Three.js rasteriza a 60fps (trivial para GPU)
        ↓
8. Usuario ve resultado en <1 segundo incluso con 100+ primitivas
```

**Ventaja clave**: El Marching Cubes solo se re-ejecuta cuando el modelo cambia, NO en cada frame. Three.js renderiza el mesh cacheado a 60fps siempre.

### 3.4 LOD (Level of Detail) para interactividad

| Acción del usuario | Resolución MC | Triángulos aprox | Latencia |
|--------------------|---------------|-------------------|----------|
| Arrastrando slider | 64³ (low) | ~5K | <50ms |
| Soltó slider | 128³ (medium) | ~40K | <200ms |
| Idle 1 segundo | 256³ (high) | ~300K | <2s (background) |
| Export STL | 512³ (ultra) | ~2M | ~10s (progress bar) |

---

## 4. ROADMAP DE DESARROLLO

### Fase 0 — Foundation (AHORA)
> Objetivo: viewport funcional a 60fps con interactividad real

- [ ] Instalar Three.js + @react-three/fiber + @react-three/drei
- [ ] Crear `ForgeViewport.tsx` con Three.js canvas
- [ ] Implementar MC Worker (`mc-worker.ts`) con transferable buffers
- [ ] Conectar SDF engine → Worker → Three.js mesh
- [ ] Grid infinito tipo Fusion 360 (gris, XYZ colores)
- [ ] ViewCube (o usar `GizmoHelper` de drei)
- [ ] Orbit/Pan/Zoom controls (like Fusion: middle-button orbit)
- [ ] Escena por defecto: una esfera + un box con boolean subtract
- [ ] 60fps verificado con 50+ primitivas

### Fase 1 — UI Fusion 360 Style
> Objetivo: parecer Fusion 360, no Blender

- [ ] Layout: toolbar top + browser left + viewport center + properties right + timeline bottom
- [ ] Color scheme: gris medio (#3c3c3c → #505050), highlight azul (#0696D7)
- [ ] Toolbar con íconos por workspace (solo "Design" para MVP)
- [ ] Browser tree: componentes, bodies, sketches collapsible
- [ ] Properties panel: editar parámetros del feature seleccionado
- [ ] Selection system: hover highlight, click select, multi-select con Shift
- [ ] Transform gizmo (TransformControls de Three.js) → mover/rotar/escalar
- [ ] Marking menu radial al right-click

### Fase 2 — Sketch 2D
> Objetivo: dibujar perfiles 2D en cualquier plano

- [ ] Seleccionar plano (cara del modelo o plano de construcción)
- [ ] Dibujar: línea, rectángulo, círculo, arco, spline
- [ ] Constraints: horizontal, vertical, coincident, tangent, perpendicular, equal
- [ ] Dimensiones paramétricas (editables como parámetros)
- [ ] Trim, Extend, Offset, Mirror, Pattern
- [ ] Extrude sketch → crea sólido via SDF (sweep del perfil 2D a lo largo de eje)

### Fase 3 — Operaciones 3D F-Rep
> Objetivo: las operaciones de Fusion pero con nuestro motor

- [ ] Extrude (sketch → SDF swept prism)
- [ ] Revolve (sketch → SDF swept revolution)
- [ ] Fillet (smooth min F-Rep — ya tenemos smooth union, extender a smooth subtract)
- [ ] Shell (offset surface interior)
- [ ] Pattern (rectangular, circular — repetir nodo SDF con transforms)
- [ ] Mirror (reflejo del nodo SDF)

**Ventaja F-Rep**: Nuestro smooth union/smooth subtract/smooth intersect da fillets implícitos por definición. No necesitamos calcular fillets como B-Rep. Es una ventaja ENORME.

### Fase 4 — Timeline Paramétrico
> Objetivo: cada operación es reversible y editable

- [ ] Agregar cada operación al timeline como nodo con timestamp
- [ ] Drag timeline marker para ver estado histórico
- [ ] Editar feature pasado → re-evaluar SDF tree completo
- [ ] Suppress/Unsuppress features
- [ ] Undo/Redo stack (Ctrl+Z/Y)

### Fase 5 — Export y Render
> Objetivo: sacar archivos útiles

- [ ] STL export (ya funciona ✅, mejorar resolución)
- [ ] OBJ export (vértices + normales + UV)
- [ ] 3MF export (con colores/materiales)
- [ ] SVG blueprint (ya funciona ✅, mejorar)
- [ ] PDF export (blueprint → PDF)
- [ ] PBR render con Three.js (materiales metálicos, plásticos, madera)
- [ ] Screenshot HD
- [ ] Turntable animation (export GIF/MP4)

### Fase 6 — Assembly Básico
> Objetivo: unir piezas

- [ ] Componentes múltiples en la escena
- [ ] Joints: fijo, revolución, slider
- [ ] Motion study: animar joints
- [ ] Detección de interferencias

### Fase 7 — Simulation
> Objetivo: FEA básico en el browser

- [ ] Mallado tetraédrico del mesh (TetGen via WASM o simplificado)
- [ ] Solver FEM simple (elástico lineal, tetraédros lineales)
- [ ] Visualización: Von Mises stress como color map
- [ ] Displacement amplificado
- [ ] O: integrar con solver externo (CalculiX WASM)

### Fase 8 — Desktop (si se necesita)
> Solo si web no alcanza para modelos complejos

- [ ] Migrar a Tauri (Rust backend + webview frontend)
- [ ] Marching Cubes en Rust (10-50x más rápido que JS)
- [ ] File system nativo
- [ ] GPU compute via wgpu

### Fase 9 — Cotizador y Marketplace
> Objetivo: desde el diseño hasta la orden de compra en <5 minutos

- [ ] BOM Engine: extraer materiales y cantidad desde el scene graph
- [ ] Integración DigiKey API (componentes electrónicos)
- [ ] Integración MercadoLibre Industrial (materiales nacionales)
- [ ] Integración SendCutSend / JLCPCB (manufactura on-demand)
- [ ] Panel de cotización: precios en tiempo real, comparador de proveedores
- [ ] Carrito de compras integrado con checkout
- [ ] DFM Analyzer: "¿qué tan caro es fabricar este diseño?"
- [ ] Export de BOM a CSV / Excel
- [ ] Seguimiento de pedido integrado (número de tracking en La Forja)

### Fase 10 — Simulación de Plantas (Digital Twin)
> Objetivo: layouts de fábrica con simulación de producción real

- [ ] Workspace "Planta" con canvas 2D drag & drop
- [ ] Biblioteca de activos industriales (50+ modelos: CNC, robots, conveyors, mesas)
- [ ] Vista 3D de la planta (los activos son modelos Three.js)
- [ ] DES Engine: discrete event simulation con ciclos, scrap rate, fallas
- [ ] Cálculo de throughput, OEE, cuello de botella, costo por pieza
- [ ] Animación en tiempo real del flujo de producción
- [ ] Integración con workspace Manufacture: tiempos de ciclo desde CAM real
- [ ] Export: plano de planta en DWG/PDF para permisos/construcción
- [ ] Dashboard de métricas: OEE, balanceo de línea, WIP

### Fase 11 — Robótica
> Objetivo: diseñar + programar + flashear un robot sin salir de La Forja

- [ ] Workspace "Robótica" con árbol URDF visual
- [ ] Builder de robot: links desde Design workspace + joints configurables
- [ ] URDF auto-generado desde el árbol visual
- [ ] FK solver: sliders de ángulos → modelo 3D se mueve en tiempo real
- [ ] IK solver (FABRIK): arrastra end-effector → ángulos calculados
- [ ] Path planning visual: click en viewport → waypoints → trayectoria 3D
- [ ] Colisión check en trayectorias
- [ ] Generación de código automática desde waypoints (Python/C++/MicroPython)
- [ ] Simulación física con Rapier WASM (dynamics, torques, colisiones)
- [ ] Export: URDF, ROS2 package, Arduino sketch, MicroPython
- [ ] Modo programación por bloques (Blockly) para no programadores

### Fase 12 — IDE de Placa y Firmware
> Objetivo: el VS Code que vive dentro de La Forja

- [ ] Monaco Editor embebido (`@monaco-editor/react`)
- [ ] Soporte C/C++ con clangd via WebSocket LSP proxy
- [ ] Soporte MicroPython con pylsp
- [ ] Soporte Rust con rust-analyzer  
- [ ] Backend local de compilación (Node.js child_process → toolchains nativos)
- [ ] avr-gcc WASM para compilar Arduino sin instalar nada
- [ ] WebUSB flash: conectar, detectar placa, programar sin drivers
- [ ] Web Serial Monitor: terminal serial en el browser
- [ ] Vinculación PCB ↔ Código: click en pad → salta al código
- [ ] `board_pins.h` auto-generado desde el diseño del PCB
- [ ] Biblioteca de plantillas para nuestras placas Orkesta
- [ ] Integración con Cortex: firmware publica telemetría → IRIS la procesa

---

## 5. VENTAJAS COMPETITIVAS DE F-REP vs B-REP

| Aspecto | F-Rep (La Forja) | B-Rep (Fusion 360, SolidWorks) |
|---------|-------------------|-------------------------------|
| **Booleanas** | Trivial: min/max/negación, nunca falla | Complejo: intersección de NURBS, puede fallar con geometrías degeneradas |
| **Fillets suaves** | GRATIS con smooth operators | Calculado: puede fallar en esquinas complejas |
| **Formas orgánicas** | Naturales (metaballs, blobs) | Necesita T-Splines separado |
| **Lattice/infill** | Trivial con funciones periódicas (gyroid, etc.) | Muy difícil en B-Rep |
| **Offset surfaces** | Trivial: f(x) + offset | Puede auto-intersectarse |
| **Detaching geometry** | Nunca pasa | Problema constante ("face failed") |
| **Precisión de bordes** | Aproximada (depende del mesh resolution) | Exacta (curvas NURBS) |
| **Rendimiento grandes modelos** | Más lento (evaluación puntual) | Más rápido (topología es O(1)) |
| **Formato estándar (STEP)** | No directamente (necesita tesselación primero) | Nativo |
| **Industria** | Nuevo/experimental | Estándar de facto 40 años |

**Pero en el campo que más importa — tiempo desde diseño hasta pieza real en mano — La Forja GANA porque puedes cotizar, comprar material, programar tu firmware y simular tu línea de producción SIN salir de la herramienta.**

---

## 6. STACK TÉCNICO DEFINITIVO

```
Frontend:        React 18 + TypeScript + Tailwind CSS + Zustand
3D Rendering:    Three.js vía @react-three/fiber + @react-three/drei
GLSL:            Solo para efectos visuales (grid, glow, outline), NO para SDF
Geometry:        sdf-engine.ts (puro TS) → mcWorker.ts → BufferGeometry
Gizmos:          @react-three/drei TransformControls + GizmoHelper
State:           Zustand store con history (undo/redo nativo)
Export:          stl-export.ts + blueprint-export.ts + urdf-export.ts + firmware-export.ts
Testing:         Vitest + Playwright
Build:           Vite
Desktop:         Tauri (solo si se necesita, Fase 8)

-- NUEVOS --
IDE:             @monaco-editor/react (Monaco = corazón de VS Code)
LSP:             clangd, rust-analyzer, pylsp (via WebSocket proxy al backend)
Toolchain:       avr-gcc (WASM) + backend local Node/Rust para ESP32/STM32/RP2040
Flash:           WebUSB API nativa (Chrome/Edge) — sin drivers, sin instalación
Serial:          Web Serial API nativa
IK Solver:       FABRIK en TypeScript + Rapier WASM para physics
Plant Sim:       Discrete Event Simulation engine propio en TypeScript
Supplier APIs:   DigiKey API, MercadoLibre API, SendCutSend API, JLCPCB API
BOM Engine:      Derivado del scene graph + PCB netlist automáticamente
Robot URDF:      urdf.js (parser/writer) + three-urdf-loader
ROS2 Bridge:     micro-ROS (firmware) ↔ rosbridge WebSocket (browser)
Visual Prog:     Blockly (Google) para programación por bloques de robots
```

---

## 7. ENTREGABLE MVP — "La Demo Que Impresiona"

### MVP v1 — El CAD que corre en el browser (Fases 0-5)
Hace que alguien diga: *"Wow, ¿esto corre en el browser?"*

1. **Viewport 60fps** con grid tipo Fusion, ViewCube, orbit/pan/zoom suave
2. **Árbol de partes** editable con drag-and-drop
3. **Transform gizmo** para mover/rotar primitivas
4. **5 primitivas** con parámetros editables en panel de properties
5. **3 booleanas** (union, subtract, smooth union) — el smooth union que se vea increíble
6. **LOD automático** — baja resolución al arrastrar, alta al soltar
7. **Export STL** funcional
8. **Export SVG blueprint** funcional
9. **Paleta Fusion 360** — gris medio, azul selección, profesional
10. **Una escena demo**: pieza mecánica con fillets suaves que diga "yo lo diseñé"

### MVP v2 — Más que Fusion 360 (Fases 9-12)
Hace que alguien diga: *"Esto hace TODO lo que Fusion 360 no puede hacer"*

1. **Cotizador en 1 click**: diseñas una pieza → click "Cotizar" → precios reales de proveedores mexicanos en <5 segundos
2. **Carrito de materiales**: seleccionas los mejores precios → checkout → número de seguimiento en La Forja
3. **Planta demo**: drag & drop de 5 máquinas → simular → ver throughput y cuello de botella en tiempo real
4. **Robot en 10 minutos**: 6 links + 6 joints → IK con gizmo → path planning → código generado automáticamente
5. **IDE + Flash**: abrir plantilla ESP32 → `Ctrl+B` compilar → `Ctrl+U` flashear → serial monitor — sin salir de La Forja
6. **Integración total**: el robot físico flasheado con La Forja actualiza el digital twin de la planta en tiempo real

---

## 8. PRÓXIMOS PASOS (en orden)

### Track A — CAD Core (Fases 0-5)
1. `npm install three @react-three/fiber @react-three/drei zustand`
2. Crear `mc-worker.ts` — Marching Cubes en Web Worker
3. Crear `ForgeViewport.tsx` — canvas Three.js con grid + ViewCube
4. Crear `useForgeStore.ts` — Zustand store con scene graph + history
5. Reescribir `ForgePage.tsx` con layout Fusion 360
6. Conectar pipeline: edit → SDF → Worker → mesh → Three.js
7. Agregar TransformControls (gizmo)
8. Probar con 50+ primitivas → confirmar 60fps
9. 🎉 Demo MVP v1 lista

### Track B — IDE y Firmware (Fase 12, puede ir en paralelo)
1. `npm install @monaco-editor/react`
2. Crear `ForgeIDE.tsx` — workspace con Monaco + panel lateral
3. Crear `toolchain-server.ts` — backend Node que invoca compiladores nativos
4. Implementar `webusb-flash.ts` — flash via WebUSB API
5. Implementar `web-serial-monitor.ts` — monitor serial
6. Crear plantillas base para ESP32 y nuestras placas
7. 🎉 Primer sketch compilado y flasheado desde La Forja

### Track C — Cotizador (Fase 9, puede ir en paralelo)
1. Diseñar `BOMEngine.ts` — extrae materiales del scene graph
2. Crear cuenta en DigiKey API + MercadoLibre Sellers API
3. Crear `SupplierService.ts` — wrapper de APIs de proveedores
4. Crear `ForjaCotizador.tsx` — UI del workspace cotizador
5. Implementar checkout flow (redirigir al proveedor con carrito pre-llenado)
6. 🎉 Primera cotización real generada desde un modelo 3D

### Track D — Robótica (Fases 11+12 integradas)
1. Crear `URDFBuilder.tsx` — árbol visual de links y joints
2. Implementar `fk-solver.ts` + `ik-fabrik.ts`
3. Crear path planner visual en el viewport 3D
4. Conectar con IDE: path → código generado → flash → robot real se mueve
5. 🎉 Robot diseñado y programado en La Forja moviéndose en el mundo real

---

## 9. COTIZADOR INTELIGENTE Y MARKETPLACE DE MATERIALES

> "Desde el modelo hasta el carrito de compras en 3 clics."
> Fusion 360 te dice QUÉ material usar. La Forja te lo CONSIGUE.

### 9.1 El Problema Real

El flujo actual de cualquier maker/ingeniero:
```
Diseñar en Fusion → exportar BOM manualmente → abrir Excel → 
buscar precios en 5 tabs → calcular → copy-paste a una orden → 
esperar cotización 3 días → volver a empezar si cambia algo
```

Nuestro flujo objetivo:
```
Diseñar en La Forja → click "Cotizar" → ver precios en tiempo real → 
click "Pedir" → carrito listo con todos los materiales → ✅
```

### 9.2 BOM Engine (Bill of Materials Automático)

El BOM se genera automáticamente desde:
- **Parámetros del modelo**: dimensiones → stock necesario (ej: bloque de aluminum 6061 de 100x50x30mm)
- **Material asignado a cada cuerpo**: acero, aluminio, PLA, ABS, resina, madera, etc.
- **Operaciones de manufactura**: si el diseño incluye filetes CNC → agregar "servicio CNC"
- **Electrónica**: si hay workspace Electronics → agregar componentes del BOM del PCB
- **Fijaciones**: si hay joints con tornillos → agregar tornillos M3/M4/M6 por cantidad

```typescript
interface BOMItem {
  id: string
  name: string              // "Barra de aluminio 6061"
  quantity: number
  unit: 'kg' | 'mm' | 'pcs' | 'm²'
  dimensions?: { x: number; y: number; z: number }
  material: MaterialSpec
  supplierId?: string
  unitPrice?: number        // actualizado en tiempo real
  totalPrice?: number
  leadTimeDays?: number
  inStock?: boolean
  alternatives?: BOMItem[]  // proveedores alternativos
}
```

### 9.3 Integración con Proveedores

**Fase 1 — Proveedores Nacionales (México):**
| Proveedor | Tipo | API / Método |
|-----------|------|-------------|
| MercadoLibre Industrial | Marketplace | REST API oficial |
| Grainger México | Industrial | Scraping + cotización manual |
| Truper / Pretul | Herramientas | Catálogo estático + precio |
| Aceros y Metales MX | Materia prima | Cotización por formulario automatizado |
| Distecno | Electrónica (ESP32, sensores) | REST API / catálogo |
| Grupo Industrial Monterrey | Acero/aluminio al corte | Webhook de cotización |

**Fase 2 — Proveedores Internacionales:**
| Proveedor | Tipo | API |
|-----------|------|-----|
| McMaster-Carr | Todo industrial | Web scraping / API no oficial |
| DigiKey / Mouser | Electrónica | REST API oficial (excelente) |
| PCBWay / JLCPCB | Manufactura PCB + CNC | REST API oficial |
| SendCutSend | Corte láser/agua/plasma | REST API (precio instantáneo) |
| Xometry | CNC/impresión 3D | REST API de cotización |

### 9.4 UX del Workspace Cotizador

```
┌─────────────────────────────────────────────────────────────┐
│ [Design] [Sculpt] [Cotizador] [Planta] [Robótica] [IDE]    │
├─────────────────────────────────────────────────────────────┤
│ BOM Auto-generado          │ Proveedor Selector            │
│ ┌──────────────────────┐   │ ○ México (más barato hoy)     │
│ │ ✅ Aluminio 6061      │   │ ○ Internacional               │
│ │    100x50x30mm  x1   │   │ ○ Solo lo que hay en stock    │
│ │    $145 MXN          │   ├───────────────────────────────┤
│ ├──────────────────────┤   │ Tiempo de entrega estimado:   │
│ │ ✅ Tornillos M3x10   │   │ 🟢 3-5 días hábiles           │
│ │    Acero inox    x8  │   ├───────────────────────────────┤
│ │    $32 MXN           │   │ COSTO TOTAL ESTIMADO:         │
│ ├──────────────────────┤   │ Materiales:    $1,247 MXN     │
│ │ 🔧 Servicio CNC      │   │ CNC:           $800 MXN       │
│ │    2h @ $400/h       │   │ Envío:         $150 MXN       │
│ │    $800 MXN          │   │ ─────────────────────         │
│ └──────────────────────┘   │ TOTAL:       $2,197 MXN       │
│                             │                               │
│ [Editar BOM]  [Exportar CSV]│ [🛒 PEDIR AHORA]             │
└─────────────────────────────────────────────────────────────┘
```

### 9.5 DFM Cost Estimator (Design for Manufacturing)

Mientras diseñas, un overlay muestra en tiempo real:
- **¿Qué tan caro es fabricar esto?** (score 1-10)
- **Sugerencias de ahorro**: "Si cambias este radio de 2mm a 3mm, el CNC ahorra 20 min → $160 MXN menos"
- **Material más barato con mismas propiedades**: "HDPE en vez de nylon → 60% más barato para esta aplicación"
- **¿Qué se puede imprimir 3D vs qué NECESITA CNC?** — colorea partes automáticamente

### 9.6 Manufactura-as-a-Service Integrada

Desde el workspace Cotizador:
- **Impresión 3D**: sube el STL → cotiza en SendCutSend / JLCPCB → pide → llega a tu puerta
- **CNC**: modelo + setup → cotiza con Xometry → pide → llega en días
- **Corte láser**: perfil 2D → cotiza en SendCutSend → precio instantáneo por área
- **PCB**: Gerber → JLCPCB → cotiza 5/10/100 piezas al instante → pide
- **Inyección plástico**: (fase futura) estimado de tooling + pieza/unidad

---

## 10. SIMULACIÓN DE PLANTAS — DIGITAL TWIN DE FÁBRICA

> "Diseña la pieza, diseña la fábrica que la hace."
> Fusion 360 no tiene esto. Siemens Plant Simulation cuesta $30K/año.

### 10.1 Concepto

Un workspace dedicado donde puedes:
1. **Diseñar el layout físico** de tu planta (piso de 2D/3D, maquinaria, mesas, pasillos)
2. **Conectar el producto** que diseñaste en el workspace Design — la planta sabe qué hace
3. **Simular el flujo de producción**: cuánto tarda hacer 100 piezas, dónde están los cuellos de botella
4. **Optimizar** antes de invertir en maquinaria real

### 10.2 Biblioteca de Activos de Planta

Modelos 3D listos para usar (estilo Fusion 360 pero de maquinaria industrial):

| Categoría | Assets incluidos |
|-----------|-----------------|
| **Manufactura** | Torno CNC, Fresadora CNC 3/5 ejes, Impresora 3D FDM/SLA, Cortadora láser, Dobladora de lámina, Prensa hidráulica, Soldadora MIG/TIG |
| **Ensamble** | Mesa de trabajo, Banda transportadora (configurable), Estación de ensamble, Torquímetro neumático, Prensa de inserción |
| **Logística** | Estantería, Pallet rack, Montacargas, AGV (vehículo autónomo), Conveyor de rodillos |
| **Robótica** | Brazo robótico 6 ejes (genérico), SCARA, Cobot, Delta robot |
| **Infraestructura** | Compresor de aire, Panel eléctrico, Mesa de control, Área de QC, Báscula industrial |
| **Espacios** | Paredes, puertas, ventanas, columna, área de seguridad |

### 10.3 Simulación de Flujo (Discrete Event Simulation)

```typescript
interface PlantProcess {
  stationId: string
  cycleTime: number          // segundos por unidad
  setupTime: number          // tiempo de setup inicial
  operators: number          // cuántos operadores necesita
  failureRate: number        // % de falla / mantenimiento
  rejectRate: number         // % de scrap
  predecessors: string[]     // qué estaciones alimentan esta
}

interface PlantSimResult {
  throughput: number         // piezas/hora promedio
  bottleneck: string         // ID de la estación cuello de botella
  utilization: Record<string, number>  // % uso por estación
  oee: number                // Overall Equipment Effectiveness
  wip: number                // Work In Progress promedio
  lineBalance: number        // % balanceo de línea
  costPerPart: number        // costo de fabricación por pieza
  suggestions: string[]      // sugerencias de optimización
}
```

### 10.4 UX del Workspace Planta

```
┌────────────────────────────────────────────────────────────┐
│ [Design] [Cotizador] [Planta ▼] [Robótica] [IDE]          │
├────────────────────────────────────────────────────────────┤
│ Asset Library  │         Vista 2D de Planta (top-down)    │
│ ┌───────────┐  │  ┌──────────────────────────────────┐   │
│ │ 🔧 CNC    │  │  │ [Almacén]→[CNC 1]→[CNC 2]        │   │
│ │ 🤖 Robot  │  │  │           ↓                       │   │
│ │ 📦 Conveyor│ │  │       [Ensamble]→[QC]→[Empaque]  │   │
│ │ 🏭 Mesa   │  │  └──────────────────────────────────┘   │
│ └───────────┘  ├──────────────────────────────────────────┤
│                │         Simulación en tiempo real         │
│ Vista: [2D][3D]│  Throughput: 47 pz/h  OEE: 73%          │
│                │  Cuello: CNC 2 (87% utilización)         │
│ [▶ Simular]   │  Costo/pieza: $23.40 MXN                  │
│ [📊 Reporte]  │  [📋 Ver sugerencias de optimización]      │
└────────────────────────────────────────────────────────────┘
```

### 10.5 Vista 3D del Digital Twin

- Render 3D de la planta completa con los modelos de los activos
- **Animación en tiempo real**: los robots se mueven, los conveyors avanzan, las piezas fluyen visualmente
- Cámara libre para "caminar" por la planta virtual (estilo primera persona)
- Overlay de datos: cada máquina muestra su OEE en tiempo real como flote
- **Exportar a PDF/DWG** el plano de planta para permiso de obra / cotización de instalación

### 10.6 Integración con el modelo de producto

El sistema sabe qué operaciones requiere la pieza (desde el workspace Design + Manufacture):
- Si la pieza tiene operaciones CNC → necesita una fresadora en la planta
- Si tiene soldadura → necesita estación de soldadura
- Si tiene PCB → necesita estación de ensamble SMD
- La simulación ajusta tiempos de ciclo basados en las trayectorias CAM reales del workspace Manufacture

---

## 11. ROBÓTICA — DISEÑAR + PROGRAMAR + SIMULAR + DESPLEGAR

> "Fusion 360 puede simular un robot moviéndose. La Forja puede programarlo."
> El gap más grande que ninguna herramienta CAD llena.

### 11.1 Por Qué Esto Es Un Game Changer

En el flujo actual con Fusion 360 + ROS2:
```
Diseñar robot en Fusion → exportar URDF manualmente (horrible) → 
configurar ROS2 (2 días de setup) → escribir código en otro IDE → 
probar → volver a Fusion → volver a ROS2 → etc.
```

En La Forja:
```
Diseñar links/joints → URDF generado automáticamente → 
programar en IDE integrado → simular en el mismo viewport → 
flashear a la placa → correr en el robot real → ✅
```

### 11.2 Workspace de Robótica — Definición de Estructura

#### 11.2.1 Árbol URDF Visual

```
Robot Tree
├── base_link (fijo al suelo)
│   └── Joint: base_to_shoulder (revolute, Z, -180°→180°)
├── shoulder_link
│   └── Joint: shoulder_to_upper_arm (revolute, Y, -90°→90°)
├── upper_arm_link
│   └── Joint: upper_arm_to_elbow (revolute, Y, -120°→120°)
├── forearm_link
│   └── Joint: elbow_to_wrist1 (revolute, Y, -120°→120°)
├── wrist_link
│   └── Joint: wrist1_to_wrist2 (revolute, Z, -360°→360°)
├── wrist2_link
│   └── Joint: wrist2_to_flange (revolute, Y, -120°→120°)
└── flange_link (end effector / tool attachment)
```

Cada link es un **cuerpo 3D del workspace Design** — el mismo modelo que diseñaste. No hay que re-modelar nada.

#### 11.2.2 Configuración de Joints desde UI

Al hacer click en un joint:
```
Panel de Joint
├── Tipo: [Revolute ▼] (fixed, revolute, prismatic, continuous)
├── Eje: [Z ▼] (X, Y, Z)
├── Límite mínimo: -180°
├── Límite máximo: +180°  
├── Velocidad máx: 180 °/s
├── Torque máx (Nm): 25 Nm
├── Offset: 0°
└── Masa del link: auto-calculada desde densidad del material
```

### 11.3 Forward / Inverse Kinematics

**FK (Forward Kinematics):** arrastra sliders de ángulos de cada joint → el modelo 3D se mueve en tiempo real.

**IK (Inverse Kinematics):** arrastra el end-effector con el gizmo → los ángulos de todos los joints se calculan automáticamente.

```typescript
// IK solver: FABRIK (Forward And Backward Reaching IK)
// Simple, estable, funciona en JS/WASM sin problemas
interface IKResult {
  jointAngles: number[]     // ángulos calculados para cada joint (rad)
  reachable: boolean        // ¿el target está en el workspace?
  iterations: number        // iteraciones hasta convergencia
}
```

### 11.4 Programación del Robot — IDE Integrado (ver también Sec. 12)

Desde el workspace de Robótica, un split-screen muestra:

**Izquierda:** Viewport 3D con el robot  
**Derecha:** Editor de código

El robot puede programarse en múltiples lenguajes:

#### Modo 1 — Python (para ROS2 y robots de alto nivel)
```python
# La Forja genera este esqueleto automáticamente desde el URDF
from forja_robot import Robot, Pose, JointAngles

robot = Robot.from_urdf("mi_robot.urdf")

# Definir puntos de trabajo visualmente (click en viewport → se genera código)
home = JointAngles([0, -90, 90, -90, -90, 0])  # en grados
pick_pos = Pose(x=0.3, y=0.1, z=0.15, rx=0, ry=180, rz=0)
place_pos = Pose(x=-0.3, y=0.1, z=0.15, rx=0, ry=180, rz=0)

robot.move_to_joints(home, speed=50)
robot.move_to_pose(pick_pos, speed=30)
robot.gripper.close()
robot.move_to_pose(place_pos, speed=30)
robot.gripper.open()
robot.move_to_joints(home, speed=50)
```

#### Modo 2 — Arduino/C++ (para robots pequeños con servos/motores)
```cpp
// Generado automáticamente con los pines correctos de la placa diseñada
#include <ForjaRobot.h>

ForjaRobot robot;

void setup() {
  robot.begin();
  robot.setJointPin(0, 9);   // joint 0 → servo en pin 9
  robot.setJointPin(1, 10);  // joint 1 → servo en pin 10
  // ... generado desde el diseño del PCB
}

void loop() {
  robot.moveToAngles({0, -90, 90, -90, -90, 0}, 50);  // speed=50%
  delay(1000);
  robot.moveToAngles({45, -45, 60, -90, 0, 45}, 30);
  delay(1000);
}
```

#### Modo 3 — MicroPython (para ESP32/Raspberry Pi Pico)
```python
from forja_robot import Robot
import time

robot = Robot()
robot.home()

while True:
    robot.move_joint(0, 45)   # joint 0 → 45 grados
    robot.move_joint(1, -30)
    time.sleep(1)
    robot.home()
    time.sleep(1)
```

#### Modo 4 — Visual Programming (para no programadores)
Bloques tipo Scratch:
```
[Cuando inicia] →
  [Mover a posición: HOME] →
  [Repetir 10 veces:] →
    [Mover end-effector a: PICK_POINT] →
    [Cerrar gripper] →
    [Mover end-effector a: PLACE_POINT] →
    [Abrir gripper] →
  [Fin repetir] →
[Fin]
```

### 11.5 Path Planning Visual

1. **Click en el viewport** para definir waypoints (puntos de paso)
2. La trayectoria se visualiza como línea 3D con flechas de orientación
3. Se verifica automáticamente:
   - ¿Alguna posición está fuera del workspace del robot?
   - ¿Hay colisiones con el entorno?
   - ¿La velocidad es factible con el torque disponible?
4. El código se genera automáticamente desde los waypoints visuales

### 11.6 Simulación Pre-deploy

Antes de flashear al robot real:
- **Simulación física**: el robot se mueve en el viewport con physics (Cannon.js/Rapier WASM)
- **Detección de colisiones** con el entorno y consigo mismo
- **Timing**: "esta trayectoria tarda 4.3 segundos por ciclo → 838 ciclos/hora"
- **Fuerza/torque** en cada joint → indica si los motores aguantan

### 11.7 Export de Robótica

| Formato | Para qué |
|---------|---------|
| `robot.urdf` | ROS2 / Gazebo / MoveIt |
| `moveit_config/` | Paquete ROS2 listo para usar |
| `arduino_sketch.ino` | Arduino IDE / PlatformIO |
| `micropython_main.py` | Thonny / flash directo |
| `robot_paths.csv` | Planilla de puntos para programación en teach pendant |
| `simulation_report.pdf` | Reporte de ciclo, torques, colisiones |

---

## 12. IDE DE PLACA — PLATAFORMA DE DESARROLLO DE FIRMWARE

> "El VS Code que vive dentro de tu herramienta de diseño."
> Diseña el encapsulado → diseña el PCB → programa el firmware → flashea → todo sin salir.

### 12.1 El Gap Fundamental

Cualquier producto mecatrónico necesita:
1. Diseño mecánico (La Forja Design)
2. Diseño electrónico (La Forja Electronics)
3. **Firmware** — aquí está el gap enorme

Hoy tienes que: abrir Arduino IDE / PlatformIO / VS Code / STM32CubeIDE por separado. Pierdes el contexto del diseño. La Forja rompe esto.

### 12.2 Monaco Editor Embebido

El mismo motor que usa VS Code, embebido en La Forja:
- **Monaco Editor** (`@monaco-editor/react`) — instalación trivial en React
- Syntax highlighting completo para C/C++, Python, Rust, JavaScript
- IntelliSense via **Language Server Protocol**
- Multi-tab (un archivo por módulo)
- Split-view: código izquierda, viewport/serial derecha
- Temas: oscuro (default, igual que VS Code dark), claro

```
┌────────────────────────────────────────────────────────────┐
│ [Design] [Electronics] [IDE ▼] [Robótica] [Cotizador]     │
├───────────────────┬────────────────────────────────────────┤
│ 📁 Proyecto       │  main.cpp          ×  sensors.h    ×  │
│ ├── main.cpp      │ ─────────────────────────────────────  │
│ ├── sensors.h     │  1  #include <Arduino.h>               │
│ ├── motors.cpp    │  2  #include "sensors.h"               │
│ ├── config.h      │  3  #include "motors.cpp"              │
│ └── lib/          │  4                                     │
│     ├── PID/      │  5  void setup() {                     │
│     └── I2C/      │  6    Serial.begin(115200);            │
│                   │  7    sensors.init();                  │
│ 🔧 Toolchain      │  8    motors.init();                   │
│ Target: ESP32     │  9  }                                  │
│ Board: [Nuestra   │ 10                                     │
│   Placa v2 ▼]     │ 11  void loop() {                     │
│ Port: /dev/ttyUSB0│ 12    float temp = sensors.readTemp(); │
│                   │ 13    if (temp > 60.0) {               │
│ [▶ Compilar]      │ 14      motors.emergency_stop();       │
│ [⚡ Flashear]     │ 15    }                                │
│ [🔍 Serial Mon.]  │ 16  }                                  │
└───────────────────┴────────────────────────────────────────┘
```

### 12.3 Toolchains Soportados

| Plataforma | Toolchain | Cómo se integra |
|-----------|----------|----------------|
| **Arduino / AVR** | avr-gcc 12 | WASM compilado o backend local |
| **ESP32 / ESP32-S3** | xtensa-esp32-elf-gcc | Backend local (xtensa no corre bien en WASM por tamaño) |
| **STM32 (ARM Cortex-M)** | arm-none-eabi-gcc | WASM (WebAssembly build de arm tools) |
| **Raspberry Pi Pico (RP2040)** | arm-none-eabi-gcc + pico-sdk | Backend local |
| **MicroPython** | No necesita compilar | Directo via WebUSB serial |
| **Rust (Embassy)** | rustc + cargo + target thumbv7em | Backend Rust task |
| **Nuestras placas propias** | Toolchain configurado por default | Plantilla incluida |

**Estrategia de compilación:**
- **Backend compilación**: servidor local ligero (Node/Rust) que corre los compiladores nativos
- **WASM para AVR**: avr-gcc puede compilarse a WASM (proyecto avr-libc-wasm)
- **Fallback**: si no hay backend local, usar API de Arduino Cloud / Wokwi API para compilar

### 12.4 Language Server Protocol (IntelliSense)

```
Monaco Editor (frontend)
      ↕ LSP (WebSocket o stdio)
Language Server (backend local)
├── clangd → C/C++ (ESP32, Arduino, STM32)
│   ├── compile_commands.json auto-generado
│   ├── Headers de la placa incluidos
│   └── Macros de platform.h expuestas
├── rust-analyzer → Rust / Embassy
├── pylsp → MicroPython / CircuitPython
└── micropython-stubs → tipos de MicroPython
```

IntelliSense sabe sobre los pines de TU placa específica:
```cpp
// Cuando escribes GPIO_PIN_, el autocompletado muestra:
GPIO_PIN_LED = 13        // porque tu placa tiene LED en pin 13
GPIO_PIN_SENSOR_TEMP = A0
GPIO_PIN_MOTOR_PWM = 9
// generado desde el diseño del PCB del workspace Electronics
```

### 12.5 Vinculación PCB ↔ Código

Esta es la killer feature:

1. En el workspace **Electronics**, asignas nombres a los pines del PCB:
   - Pin 9 → "MOTOR_PWM"
   - Pin A0 → "TEMP_SENSOR"
   - Pin 13 → "STATUS_LED"

2. En el **IDE**, estas constantes ya están disponibles:
   ```cpp
   #include "board_pins.h"  // auto-generado desde el PCB
   digitalWrite(STATUS_LED, HIGH);  // IntelliSense sabe que es pin 13
   ```

3. **Click en el código** → resalta el pad correspondiente en el PCB
4. **Click en un pad del PCB** → salta al lugar en el código donde se usa

### 12.6 Flash Directo — WebUSB

```typescript
// Proceso de flash completo via WebUSB API (nativo en Chrome/Edge)
async function flashFirmware(binary: Uint8Array, target: BoardTarget) {
  const device = await navigator.usb.requestDevice({ 
    filters: [{ vendorId: target.usbVendorId }] 
  })
  await device.open()
  
  // Protocolo según la plataforma
  if (target.protocol === 'stk500v1') {
    await stk500Flash(device, binary)   // Arduino Uno/Nano
  } else if (target.protocol === 'esptool') {
    await espFlash(device, binary)      // ESP32
  } else if (target.protocol === 'dfu') {
    await dfuFlash(device, binary)      // STM32 en modo bootloader
  } else if (target.protocol === 'uf2') {
    await uf2Flash(device, binary)      // RP2040, SAMD
  }
}
```

**Sin drivers, sin instalación, sin comandos en terminal.** Solo conecta el cable USB y presiona el botón "⚡ Flashear".

### 12.7 Serial Monitor y Debugging

Integrado en el mismo panel:
- **Serial Monitor**: recibe datos del microcontrolador, envía comandos
- **Plotter**: grafica datos numéricos en tiempo real (temperatura, voltaje, posición)
- **Logic Analyzer virtual**: si la placa tiene pin especial, captura señales digitales
- **REPL**: para MicroPython, una terminal interactiva directa al intérprete
- **Logs con timestamp**: guarda sesión de serial para análisis posterior

### 12.8 Plantillas de Firmware para Nuestras Placas

La Forja tiene una biblioteca de plantillas específicas para el hardware de Orkesta:

| Plantilla | Target | Descripción |
|-----------|--------|-------------|
| `blink_basic` | ESP32 / AVR | Hello World — parpadear LED |
| `sensor_temp_humidity` | ESP32 | DHT22 → Serial Monitor |
| `motor_dc_pid` | ESP32 + L298N | Control PID de motor DC |
| `servo_robot_arm` | AVR / ESP32 | Control de brazo robótico 6 DOF |
| `wifi_iot_dashboard` | ESP32 | Datos de sensores → Cortex/IRIS |
| `robot_ros2_bridge` | ESP32 + micro-ROS | Bridge con ROS2 via serial |
| `plc_ladder_logic` | ESP32 | Lógica escalera simple |
| `nuestra_placa_v2` | Placa Orkesta | Template completo para nuestra placa |

### 12.9 Integración con el Ecosistema Orkesta

El firmware puede conectarse directamente con:
- **Cortex/Mercuria**: enviar telemetría del hardware → IRIS lo procesa
- **La Planta (Sec. 10)**: el firmware del robot reporta estado → digital twin se actualiza en tiempo real
- **La Forja Robótica (Sec. 11)**: el código del robot se genera desde el path planner visual

```typescript
// Ejemplo: robot físico actualiza su estado en el digital twin
#include <ForjaConnector.h>

ForjaConnector cortex("ws://orkesta.local:8080");

void loop() {
  JointState state = robot.getJointAngles();
  cortex.publish("robot/joint_states", state.toJSON());
  // La Forja recibe esto y mueve el modelo 3D del robot en tiempo real
}
```

---

*Documento vivo. Actualizar conforme avancemos.*
*La Forja de Hefestos — Hecho en México 🇲🇽*
*"La única herramienta del mundo donde diseñas la pieza, cotizas los materiales, simulas la fábrica, programas el robot y flasheas la placa — sin salir."*
