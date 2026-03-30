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

> **Actualizado**: 29 de marzo 2026

| Categoría | La Forja v1.x (actual) | Fusion 360 | Gap |
|-----------|-------------|------------|-----|
| **Motor geométrico** | F-Rep/SDF (único diferenciador) — 6 primitivas, 4 booleanas, módulos | B-Rep + NURBS Parasolid | Nuestro F-Rep es superior para formas orgánicas y booleanas, inferior para precisión de bordes |
| **Primitivas** | 6 (sphere, box, cylinder, torus, cone, capsule) + extrusión de sketch rect/circle | Infinitas vía sketch→extrude→revolve→sweep→loft | Necesitamos sketch 2D completo + más operaciones 3D |
| **Booleanas** | ✅ union, subtract, intersect, smooth union | join, cut, intersect | ✅ Estamos bien, `smooth union` es ventaja nuestra |
| **Renderer** | ✅ Three.js rasterización + GPU ray marching dual | OpenGL rasterization + ray trace render | ✅ RESUELTO — 60fps |
| **UI** | ✅ Menubar Fusion-style + Omnibar + Marking Menu + Tree + Timeline + Variable Bar + Blueprint Panel | Workspace system completo | Funcional pero tema demasiado oscuro. Pendiente: Tool Strip, Inspector HUD, Inline Dimensions |
| **Sketch 2D** | ⚠️ Rect + Circle en 3 planos + face picking | Completo con constraints | NECESITA: constraint solver, más tools |
| **Timeline/History** | ✅ Undo/redo completo con historial | Paramétrico completo | Funcional. Pendiente migrar a Operation Stack |
| **Gizmos** | ❌ No hay transform gizmos | Translate/Rotate/Scale 3D | **NECESITA: transform gizmos** |
| **Import** | ✅ STEP/IGES + .mch (8 máquinas) + drag&drop | STEP, IGES, SAT, STL, OBJ, 3MF, DWG, DXF | Básico pero funcional |
| **Export** | ✅ STL + SVG blueprint | STEP, IGES, SAT, STL, OBJ, 3MF, DWG, DXF, PDF | Expandir formatos |
| **Reverse Engineering** | ✅ Modelo→primitivas SDF + CT-scan + GPU plane fitting + sketch fitting | No tiene equivalente | **VENTAJA NUESTRA** |
| **Feature Recognition** | ✅ Reconocimiento geométrico de features | Limitado | **VENTAJA** |
| **Búsqueda** | ✅ Omnibar ⌘K con 60+ comandos | Command search | ✅ Competitivo |
| **Audio** | ✅ Feedback sonoro en todas las acciones | No tiene | **VENTAJA** |
| **Fórmulas** | ✅ 1,457 líneas (FEA, térmica, fluidos, fatiga, materiales) — NO CONECTADO A UI | FEA completo integrado | Conectar formulas.ts al pipeline de simulación |
| **Assembly** | ❌ No existe | Joints + Motion Study | Fase posterior |
| **Simulation** | ❌ Stats básicas, fórmulas desconectadas | FEA completo | Fase posterior |
| **CAM** | ⚠️ Parser de 8 máquinas CNC, sin toolpaths | Completo 2-5 ejes | Fase posterior |
| **ViewCube** | ✅ Implementado + transiciones suaves numpad | Completo | ✅ |
| **Marking Menu** | ✅ Implementado con secciones contextuales | Radial completo | ✅ |
| **Blueprint/Dibujos** | ✅ Panel interactivo de planos + export SVG | Drawing workspace completo | Parcial |
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

### Fase 0 — Foundation (✅ COMPLETADA — Marzo 2026)
> Objetivo: viewport funcional a 60fps con interactividad real

- [x] Instalar Three.js + @react-three/fiber + @react-three/drei
- [x] Crear `ForgeViewport.tsx` con Three.js canvas
- [x] Implementar MC Worker (`mc-worker.ts`) con transferable buffers
- [x] Conectar SDF engine → Worker → Three.js mesh
- [x] Grid infinito tipo Fusion 360 (gris, XYZ colores)
- [x] ViewCube (o usar `GizmoHelper` de drei)
- [x] Orbit/Pan/Zoom controls (like Fusion: middle-button orbit)
- [x] Escena por defecto: una esfera + un box con boolean subtract
- [x] 60fps verificado con 50+ primitivas

### Fase 1 — UI Fusion 360 Style (⚠️ PARCIALMENTE COMPLETADA)
> Objetivo: parecer Fusion 360, no Blender

- [x] Layout: toolbar top + browser left + viewport center + properties right + timeline bottom
- [ ] Color scheme: gris medio (#3c3c3c → #505050), highlight azul (#0696D7) — **NOTA: se implementó con paleta "Oro Divino" (void black + gold), resultado demasiado oscuro. Pendiente ajustar.**
- [x] Toolbar con íconos por workspace (solo "Design" para MVP)
- [x] Browser tree: componentes, bodies, sketches collapsible
- [x] Properties panel: editar parámetros del feature seleccionado
- [x] Selection system: hover highlight, click select, multi-select con Shift
- [ ] Transform gizmo (TransformControls de Three.js) → mover/rotar/escalar
- [x] Marking menu radial al right-click

### Fase 2 — Sketch 2D (⚠️ BÁSICO IMPLEMENTADO)
> Objetivo: dibujar perfiles 2D en cualquier plano

- [x] Seleccionar plano (cara del modelo o plano de construcción)
- [ ] Dibujar: línea, ~~rectángulo~~, ~~círculo~~, arco, spline — **rect y circle ya funcionales**
- [ ] Constraints: horizontal, vertical, coincident, tangent, perpendicular, equal
- [ ] Dimensiones paramétricas (editables como parámetros)
- [ ] Trim, Extend, Offset, Mirror, Pattern
- [x] Extrude sketch → crea sólido via SDF (sweep del perfil 2D a lo largo de eje)

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

1. ✅ **Viewport 60fps** con grid tipo Fusion, ViewCube, orbit/pan/zoom suave
2. ✅ **Árbol de partes** editable con módulos y renombrado
3. ❌ **Transform gizmo** para mover/rotar primitivas — **PENDIENTE**
4. ✅ **6 primitivas** con parámetros editables en panel de properties
5. ✅ **4 booleanas** (union, subtract, intersect, smooth union)
6. ✅ **LOD automático** — baja resolución al arrastrar, alta al soltar
7. ✅ **Export STL** funcional
8. ✅ **Export SVG blueprint** funcional + Blueprint Panel interactivo
9. ⚠️ **Paleta Fusion 360** — se implementó "Oro Divino" (void black + gold). **Demasiado oscura.** Ajustar.
10. ✅ **Escena demo** con primitivas y booleanas
11. ✅ **BONUS**: Import STEP/IGES, reverse engineering, CT-scan, GPU plane fitting, 8 configs de máquinas CNC, Omnibar, Marking Menu, audio, keyboard shortcuts

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
1. ✅ `npm install three @react-three/fiber @react-three/drei zustand`
2. ✅ Crear `mc-worker.ts` — Marching Cubes en Web Worker
3. ✅ Crear `ForgeViewport.tsx` — canvas Three.js con grid + ViewCube
4. ✅ Crear `useForgeStore.ts` — Zustand store con scene graph + history
5. ✅ Reescribir `ForgePage.tsx` con layout tipo Fusion 360
6. ✅ Conectar pipeline: edit → SDF → Worker → mesh → Three.js
7. ❌ Agregar TransformControls (gizmo) — **PENDIENTE**
8. ✅ Probar con 50+ primitivas → confirmar 60fps
9. ⚠️ MVP v1 ~90% lista. Falta: gizmo, ajuste de tema visual, Tool Strip

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

## 13. SIMULACIONES — EL UNIVERSO COMPLETO

> **Visión**: La Forja no es solo un CAD. Es un simulador universal de fenómenos físicos, químicos y multifísica.
> Motor F-Rep = todo son funciones matemáticas = podemos simular CUALQUIER COSA que tenga una ecuación.
>
> **Referencia competitiva**:
> - ANSYS: 92 productos ($25K-$100K/año por módulo)
> - COMSOL Multiphysics: 30+ módulos ($5K-$50K/año)
> - SolidWorks Simulation: 3 tiers ($3K-$18K/año)
> - Abaqus: $30K+/año
> - Moldflow: $15K+/año
> - OpenFOAM: gratis pero requiere PhD para usarlo
>
> **Nuestra ventaja**: Todo corre sobre el MISMO campo SDF. No hay conversión de formatos entre CAD y simulación.
> El mesh se genera adaptativamente del SDF en la GPU. Los resultados se pintan directamente en el ray marcher.

### 13.1 Tipos de Simulación por Dominio

#### A. MECÁNICA ESTRUCTURAL (como ANSYS Mechanical + SolidWorks Simulation)

| # | Tipo de Estudio | Qué Resuelve | Ecuación Base | Estado en formulas.ts | Usuarios |
|---|----------------|--------------|---------------|----------------------|----------|
| 1 | **Estrés Estático Lineal** | "¿Se rompe mi pieza bajo esta carga?" | Kx = F (Hooke generalizado) | ✅ elasticityMatrix3D, tet4Element, solveLinearSystem, conjugateGradient | TODOS |
| 2 | **Von Mises + Factor de Seguridad** | "¿Qué tan lejos estoy de la fluencia?" | σ_vm = √(½[(σ₁-σ₂)²+...]) | ✅ vonMisesStress, safetyFactorVonMises, principalStresses | TODOS |
| 3 | **Análisis Modal (Frecuencias Naturales)** | "¿A qué frecuencia vibra mi pieza? ¿Resonará?" | (K - ω²M)φ = 0 | ✅ naturalFrequency, dampedFrequency, beamNaturalFrequency | Automotriz, Aeroespacial, Robótica |
| 4 | **Pandeo (Buckling)** | "¿A qué carga colapsa esta columna/chapa?" | (K + λK_g)φ = 0 | ✅ eulerBucklingLoad | Estructural, Arquitectura |
| 5 | **Fatiga (S-N / Goodman)** | "¿Cuántos ciclos aguanta antes de fracturarse?" | S = a·N^b, σ_a/Se + σ_m/Su = 1/n | ✅ basquinSN, goodmanFatigueSafety | Automotriz, Aerospace |
| 6 | **No Lineal Estático** | Grandes deformaciones, contacto, plasticidad | Iteración Newton-Raphson sobre K(u)·Δu = R(u) | 🔴 FALTA | Elastómeros, Crashworthiness |
| 7 | **Dinámica Transitoria** | Impacto, caída, choque | M·ü + C·u̇ + K·u = F(t) (Newmark-β) | 🔴 FALTA | Electrónica (drop test), Automotriz |
| 8 | **Respuesta en Frecuencia** | Vibración forzada harmónica | (-ω²M + iωC + K)·u = F | 🔴 FALTA | NVH automotriz, Acústica |
| 9 | **Contacto Mecánico** | Superficies que se tocan, fricción | Penalty method / Lagrange multipliers | 🔴 FALTA | Ensambles, Moldes |
| 10 | **Materiales Compuestos** | Laminados (fibra de carbono, fibra de vidrio) | Teoría clásica de laminados (CLT) | 🔴 FALTA | Aero, Naval, Deportes |
| 11 | **Concentración de Esfuerzos** | Fillets, esquinas, agujeros | K_t analítico + subrefinamiento | ✅ stressConcentration, ktPlateWithHole | TODOS |
| 12 | **Cilindros de Pared Gruesa (Lamé)** | Recipientes a presión, cañones | σ_r, σ_θ = f(r_i, r_o, p) | ✅ lameThickCylinder | Química, Petróleo, Hidráulica |
| 13 | **Deflexión de Vigas** | Deformación bajo carga puntual/distribuida | δ = PL³/(48EI), etc. | ✅ beamDeflectionCenterLoad, cantileverDeflection | Estructura, Educación |

#### B. TRANSFERENCIA DE CALOR (como ANSYS Thermal + COMSOL Heat Transfer)

| # | Tipo de Estudio | Qué Resuelve | Ecuación Base | Estado | Usuarios |
|---|----------------|--------------|---------------|--------|----------|
| 14 | **Conducción Estado Estacionario** | "¿Cuál es la distribución de temperatura?" | ∇·(k∇T) = 0 | ✅ thermalTet4, fourierConduction | TODOS |
| 15 | **Conducción Transitoria** | "¿Cuánto tarda en enfriarse/calentarse?" | ρc_p ∂T/∂t = ∇·(k∇T) + Q | ✅ thermalCapacitanceTet4 | Moldes, Electrónica |
| 16 | **Convección** | Enfriamiento por fluido (aire, agua, aceite) | q = h·(T_s - T_∞) (Newton) | ✅ newtonConvection, dittusBoelter | TODOS |
| 17 | **Radiación** | Intercambio térmico por radiación infrarroja | q = εσ(T_s⁴ - T_∞⁴) | ✅ radiationHeat, STEFAN_BOLTZMANN | Hornos, Espacial, Electrónica |
| 18 | **Resistencia Térmica Multicapa** | Paredes compuestas (aislamiento) | R = Σ(L_i/k_i·A) | ✅ thermalResistanceSeries, convectionResistance | Arquitectura, HVAC |
| 19 | **Eficiencia de Aletas** | Disipadores de calor, radiadores | η = tanh(mL)/(mL) | ✅ finEfficiency | Electrónica, HVAC |
| 20 | **Esfuerzo Térmico** | Dilatación restringida → esfuerzo | σ = -E·α·ΔT | ✅ thermalStressConstrained, thermalExpansionFree | Motores, Tuberías |
| 21 | **Cambio de Fase** | Solidificación/fusión (moldes, fundición) | Stefan problem, enthalpy method | 🔴 FALTA | Fundición, Metalurgia |

#### C. MECÁNICA DE FLUIDOS / CFD (como ANSYS Fluent + COMSOL CFD)

| # | Tipo de Estudio | Qué Resuelve | Ecuación Base | Estado | Usuarios |
|---|----------------|--------------|---------------|--------|----------|
| 22 | **Flujo Potencial** | Flujo ideal sin fricción | ∇²φ = 0 (Laplace) | 🔴 FALTA (fácil) | Educación, Aerodinámica básica |
| 23 | **Bernoulli** | Presión/velocidad en fluidos incompresibles | p₁/ρ + V₁²/2 + gz₁ = const | ✅ bernoulli | Hidráulica, Tuberías |
| 24 | **Pérdidas en Tuberías** | Caída de presión en sistemas de tuberías | h_f = f·(L/D)·(V²/2g) | ✅ darcyWeisbachLoss, frictionFactorSwameeJain | HVAC, Plomería, Petróleo |
| 25 | **Número de Reynolds** | ¿Flujo laminar o turbulento? | Re = VD/ν | ✅ reynoldsNumber | TODOS |
| 26 | **Navier-Stokes Incompresible** | Flujo viscoso completo | ρ(∂v/∂t + v·∇v) = -∇p + μ∇²v + f | 🔴 FALTA (GPU Lattice Boltzmann) | Aerodinámica, Hidráulica |
| 27 | **Hele-Shaw (flujo en cavidad delgada)** | Llenado de molde de inyección | ∇·(h³/12μ · ∇p) = 0 | 🔴 FALTA | Moldes de Plástico |
| 28 | **Flujo en Medios Porosos** | Filtración, geotecnia, oil & gas | Ley de Darcy: v = -(k/μ)∇p | 🔴 FALTA | Geotecnia, Petróleo |
| 29 | **Flujo Multifásico** | Agua+aceite, burbujas, spray | Volume of Fluid (VOF), Level Set | 🔴 FALTA | Petróleo, Alimentaria |
| 30 | **Transferencia de Calor Conjugada** | Sólido+fluido acoplados | Navier-Stokes + Fourier simultáneo | 🔴 FALTA | Electrónica (cooling), Motores |

#### D. ELECTROMAGNETISMO (como ANSYS HFSS/Maxwell + COMSOL AC/DC)

| # | Tipo de Estudio | Qué Resuelve | Ecuación Base | Estado | Usuarios |
|---|----------------|--------------|---------------|--------|----------|
| 31 | **Electrostática** | Campos eléctricos, capacitancia | ∇·(ε∇φ) = -ρ_v (Poisson/Laplace) | 🔴 FALTA | Electrónica, MEMS |
| 32 | **Magnetostática** | Campos magnéticos, inductancia | ∇×H = J, ∇·B = 0 | 🔴 FALTA | Motores, Transformadores |
| 33 | **Corrientes Inducidas** | Pérdidas por Eddy currents, calentamiento por inducción | ∇×(1/μ ∇×A) + σ∂A/∂t = J_s | 🔴 FALTA | Motores eléctricos |
| 34 | **Distribución de Corriente** | Resistencia, calentamiento Joule en PCBs | ∇·(σ∇V) = 0 | 🔴 FALTA | PCB, Electrónica |
| 35 | **RF/Microondas** | Antenas, guías de onda, filtros | Ecuaciones de Maxwell completas | 🔴 FALTA (largo plazo) | Telecomunicaciones |

#### E. INGENIERÍA QUÍMICA (como COMSOL Chemical Reaction Engineering)

| # | Tipo de Estudio | Qué Resuelve | Ecuación Base | Estado | Usuarios |
|---|----------------|--------------|---------------|--------|----------|
| 36 | **Difusión Molecular** | Transporte de especies por gradiente de concentración | ∂C/∂t = D∇²C (Fick) | 🔴 FALTA (pero es Laplace, fácil) | Química, Farmacéutica |
| 37 | **Reacciones Químicas** | Cinética: A + B → C con velocidad k | dC/dt = -k·Cₐ^n·C_b^m (Arrhenius) | 🔴 FALTA | Petroquímica, Farmacéutica |
| 38 | **Reactores (CSTR/PFR/Batch)** | Conversión, selectividad, rendimiento | Balance de masa + energía + cinética | 🔴 FALTA | Ingeniería Química |
| 39 | **Curado de Polímeros** | Grado de cura vs. tiempo + temperatura | dα/dt = A·exp(-Ea/RT)·f(α) (Kamal) | 🔴 FALTA | Inyección de plástico, Composites |
| 40 | **Electroquímica** | Baterías, celdas de combustible, corrosión | Butler-Volmer, Nernst | 🔴 FALTA | Energía, Automotriz EV |
| 41 | **Cristalización / Precipitación** | Crecimiento de cristales, nucleación | Modelos de población, Avrami | 🔴 FALTA | Farmacéutica, Alimentaria |

#### F. MULTIFÍSICA (como COMSOL Multiphysics — la joya de la corona)

| # | Tipo de Estudio | Qué Acopla | Estado | Usuarios |
|---|----------------|------------|--------|----------|
| 42 | **Termomecánico** | Temperatura → Esfuerzo térmico → Deformación | 🔴 FALTA (datos ✅) | Motores, Electrónica |
| 43 | **Fluido-Estructura (FSI)** | Presión de fluido → deformación del sólido → cambia el flujo | 🔴 FALTA | Aero, Biomédica, Válvulas |
| 44 | **Electro-Térmico** | Corriente → calentamiento Joule → cambio de resistividad | 🔴 FALTA | PCBs, Fusibles, Calefacción |
| 45 | **Termo-Fluido** | Flujo → temperatura → propiedades del fluido | 🔴 FALTA | HVAC, Intercambiadores |
| 46 | **Piezoeléctrico** | Campo eléctrico ↔ deformación mecánica | 🔴 FALTA | Sensores, Actuadores, MEMS |
| 47 | **Acústica-Estructura** | Vibración → ondas de sonido → campo acústico | 🔴 FALTA | Automotriz NVH, Audio |

#### G. OPTIMIZACIÓN Y DISEÑO GENERATIVO

| # | Tipo | Qué Hace | Ventaja F-Rep | Estado | Usuarios |
|---|------|----------|---------------|--------|----------|
| 48 | **Optimización Topológica (SIMP/BESO)** | Quita material innecesario manteniendo resistencia | El SDF es continuo → gradient descent directo sin remallado | 🔴 FALTA | TODOS |
| 49 | **Optimización de Forma** | Ajusta la superficie para minimizar esfuerzo/peso | Derivadas del SDF = gradientes naturales | 🔴 FALTA | Aero, Automotriz |
| 50 | **Diseño Generativo Multi-Objetivo** | Genera N variantes optimizando peso vs. rigidez vs. costo | Variación paramétrica + solver | 🔴 FALTA | TODOS |
| 51 | **DOE (Design of Experiments)** | Barrido sistemático de variables para entender sensibilidad | Tabla de parámetros → barrido automático | 🔴 FALTA | Manufactura, I+D |
| 52 | **Optimización de Lattice / Infill** | Estructuras tipo panal, gyroides, TPMS | F-Rep NATIVO — los gyroides son SDFs | 🔴 FALTA | Aditiva, Biomédica, Aero |

#### H. MANUFACTURA Y PROCESO

| # | Tipo | Qué Simula | Estado | Usuarios |
|---|------|-----------|--------|----------|
| 53 | **Inyección de Plástico — Llenado** | Frente de flujo de polímero fundido en molde | 🔴 FALTA | Moldes |
| 54 | **Inyección — Empaque/Holding** | Distribución de presión durante packing | 🔴 FALTA | Moldes |
| 55 | **Inyección — Enfriamiento** | Ciclo térmico, canales de enfriamiento | 🔴 FALTA (datos térmicos ✅) | Moldes |
| 56 | **Inyección — Warpage** | Deformación post-desmoldeo por esfuerzos residuales | 🔴 FALTA | Moldes |
| 57 | **Fundición / Casting** | Solidificación, contracción, rechupe | 🔴 FALTA | Fundición |
| 58 | **Conformado de Chapa (Stamping)** | Embutición profunda, formabilidad | 🔴 FALTA | Automotriz |
| 59 | **Soldadura** | Campo térmico, esfuerzo residual, distorsión | 🔴 FALTA | Manufactura |
| 60 | **Mecanizado (corte)** | Fuerzas de corte, desgaste de herramienta, vibraciones | 🔴 FALTA | CNC |

### 13.2 Priorización de Implementación

**Criterio**: ¿Qué le da más valor a más usuarios con menos esfuerzo, dado que ya tenemos formulas.ts?

#### ONDA 1 — Simulación Fundacional (lo que ya casi está listo)
1. ✅→🔨 **Estrés Estático + Von Mises** — Tenemos tet4Element, solver CG, material DB. Falta: SDF→mesh adaptativo, ensamble global, UI de cargas/restricciones
2. ✅→🔨 **Térmica Estado Estacionario** — Tenemos thermalTet4. Falta: igual que arriba
3. ✅→🔨 **Análisis Modal** — Tenemos fórmulas de frecuencia. Falta: eigenvalue solver generalizado
4. ✅→🔨 **Pandeo** — Euler ya está. Falta: extensión a 3D general
5. ✅→🔨 **Fatiga básica** — Goodman y Basquin ya están. Falta: ciclo de carga + acumulación

#### ONDA 2 — Gran Diferenciador (lo que nos separa de Fusion/SolidWorks)
6. **Diseño Generativo GPU** — Optimización topológica corriendo en tiempo real sobre SDF. NINGÚN otro CAD puede hacer esto sin cloud.
7. **Inyección de Plástico (Hele-Shaw)** — El mercado de moldes mexicano. Hele-Shaw sobre campo SDF.
8. **Térmica Transitoria** — Ciclo de enfriamiento de molde. Ya tenemos la matriz de capacitancia.
9. **Lattice / TPMS** — Gyroides y estructuras celulares son NATIVOS en F-Rep. Código de una línea: `sin(x)*cos(y)+sin(y)*cos(z)+sin(z)*cos(x) - t`
10. **Multifísica: Termomecánico** — Temperatura → esfuerzo. Acoplar lo que ya tenemos.

#### ONDA 3 — Plataforma de Simulación Universal
11. **CFD básico (Lattice Boltzmann GPU)** — Flujo incompresible visualizado en tiempo real
12. **Electrostática + distribución de corriente** — Para diseño de PCBs
13. **Difusión + Reacciones químicas** — Las ecuaciones de Fick y Arrhenius son fáciles sobre grids SDF
14. **FSI (fluido-estructura)** — Acoplamiento débil primero
15. **DOE + Optimización multi-objetivo** — Barrido paramétrico automatizado

#### ONDA 4 — Conquistar la Academia y la Industria
16. **Navier-Stokes completo** — Motor CFD serio
17. **No-lineal (plasticidad, grandes deformaciones)** — Newton-Raphson iterativo
18. **Dinámica transitoria (impacto)** — Drop test, crash
19. **Electromagnetismo (Maxwell)** — Motores eléctricos, transformadores
20. **Electroquímica (baterías)** — Butler-Volmer para celdas

---

## 14. CAM / CNC — POST-PROCESADORES Y MANUFACTURA

> **Visión**: Diseñas en La Forja → simulas → generas G-code → conectas a tu máquina → maquinas.
> Soportar controles Fanuc, Siemens 840D, Haas NGC, GROB, Mazak, Okuma, LinuxCNC, GRBL.

### 14.1 Generación de Toolpaths desde SDF

La ventaja de F-Rep para CAM:
- No hay mesh → no hay tolerancias de tesselación
- El SDF te da la distancia exacta a la superficie en cualquier punto
- La normal del SDF = dirección exacta de la herramienta
- Detección de colisión = evaluar el SDF en la geometría de la herramienta

| # | Tipo de Toolpath | Descripción | Ejes | Prioridad |
|---|-----------------|-------------|------|-----------|
| 1 | **Facing** | Planear superficie superior del stock | 2.5D | 🔴 |
| 2 | **2D Adaptive / HSM** | Desbaste inteligente con engagement constante | 2.5D | 🔴 |
| 3 | **2D Pocket** | Vaciar cavidades | 2.5D | 🔴 |
| 4 | **2D Contour** | Perfilar contorno exterior | 2.5D | 🔴 |
| 5 | **Drilling (Peck, Chip-break, Tap)** | Ciclos de taladrado | 1D | 🔴 |
| 6 | **3D Adaptive** | Desbaste 3D con control de carga | 3 ejes | 🟡 |
| 7 | **3D Pocket** | Acabado de cavidades 3D | 3 ejes | 🟡 |
| 8 | **Parallel/Scallop/Pencil** | Acabado superficial 3D | 3 ejes | 🟡 |
| 9 | **Swarf** | Mecanizado con flanco de herramienta | 4-5 ejes | 🟢 |
| 10 | **Multi-axis Contour** | Trayectoria continua 5 ejes | 5 ejes | 🟢 |
| 11 | **Turning (Face, Profile, Groove, Thread)** | Torneado | 2 ejes + C | 🟡 |
| 12 | **Mill-Turn** | Combinación fresado + torneado | Multi | 🟢 |

### 14.2 Post-Procesadores

| Control | Fabricante | Máquinas Ejemplo | Prioridad |
|---------|-----------|-----------------|-----------|
| **Fanuc 0i/30i/31i** | FANUC | Robodrill, Partner machines | 🔴 CRÍTICA |
| **Siemens 840D** | Siemens | DMG MORI, Starrag, Heller | 🔴 CRÍTICA |
| **Haas NGC** | Haas | VF-2, VF-4, EC-630, VS-3 | ✅ Ya tenemos config |
| **Mazak Smooth** | Mazak | INTEGREX, VARIAXIS | 🟡 |
| **Okuma OSP** | Okuma | MULTUS, GENOS | 🟡 |
| **Hurco WinMax** | Hurco | BX40i, VMX | ✅ Ya tenemos config |
| **GRBL** | Open Source | CNC routers, hobby | 🟡 |
| **LinuxCNC** | Open Source | Conversiones, labs | 🟡 |
| **Mach3/Mach4** | ArtSoft/Newfangled | Hobby, talleres pequeños | 🟢 |
| **DATRON next** | DATRON | Neo, M10 Pro | ✅ Ya tenemos config |
| **Brother** | Brother | SPEEDIO M300X3 | ✅ Ya tenemos config |

### 14.3 Simulación de Mecanizado

- **Stock Simulation**: Resta booleana SDF (herramienta vs. stock) en cada paso del toolpath
- **Collision Detection**: Evaluar SDF de fixture + pieza en punto de herramienta
- **Machine Kinematics**: Ya parseamos las cinemáticas de 8 máquinas reales
- **Feed/Speed Calculator**: Material + herramienta + operación → f/s óptimos

### 14.4 Manufactura Aditiva (3D Printing)

| # | Proceso | Qué Necesitamos | Prioridad |
|---|---------|----------------|-----------|
| 1 | **FDM/FFF Slicing** | Contornos 2D por capa desde SDF (trivial: slice Z → contorno de sdf=0) | 🔴 |
| 2 | **SLA/DLP** | Capas de imagen (mismo slice, output como PNG mask) | 🟡 |
| 3 | **SLS/MJF** | Arrangement + orientación + sinterizado sim | 🟡 |
| 4 | **Soporte Automático** | Detección de overhang via normal del SDF | 🔴 |
| 5 | **Infill/Lattice** | ¡F-Rep nativo! Gyroid, Diamond, Schwarz-P como SDFs | 🔴 |
| 6 | **Compensación de encogimiento** | Offset de SDF por factor de shrinkage material | 🟡 |

---

## 15. USUARIOS Y VERTICALES INDUSTRIALES

> **Visión**: La Forja sirve a TODOS los que diseñan, simulan o fabrican cosas físicas.

### 15.1 Mapa de Usuarios por Industria

| Industria | Rol | Qué Usan Hoy | Qué Usarían de La Forja | Precio Que Pagan Hoy |
|-----------|-----|-------------|------------------------|---------------------|
| **Moldes de Inyección** | Diseñador de moldes | SolidWorks + Moldflow + Mastercam | CAD + Sim llenado + CAM | $50K+/año |
| **Taller CNC** | Operador/Programador | Fusion 360 + Mastercam | CAD + CAM + Post Fanuc/Haas | $5K-$15K/año |
| **Automotriz** | Ingeniero de diseño | CATIA + ANSYS | CAD + FEA + Fatiga + CFD | $100K+/año |
| **Aeroespacial** | Stress analyst | NX + Nastran | FEA + Fatiga + Compuestos + Modal | $80K+/año |
| **Arquitectura** | Arquitecto/Calculista | Revit + Robot Structural | Modelado + Análisis estructural + Térmica de edificio | $10K+/año |
| **Mecatrónica/Robótica** | Ingeniero de sistemas | SolidWorks + MATLAB + ROS | CAD + Cinemática + IDE firmware + Sim | $15K+/año |
| **Electrónica** | PCB designer | KiCad/Altium + ANSYS | PCB layout + Thermal + EMI | $5K-$20K/año |
| **Biomédica** | Ingeniero biomédico | COMSOL + SolidWorks | Implantes + FSI + Biocompat sim | $30K+/año |
| **Petróleo y Gas** | Ingeniero de proceso | ANSYS + HYSYS | Tuberías + CFD + Corrosión | $50K+/año |
| **Energía (EV/Baterías)** | Ingeniero de baterías | COMSOL + StarCCM | Electroquímica + Térmica | $40K+/año |
| **Educación** | Profesor/Estudiante | Versiones educativas | TODO gratis → formar la próxima generación | $0 |
| **Alimentaria** | Ingeniero de proceso | CFD genérico | Flujo + Transferencia de calor | $20K+/año |
| **Farmacéutica** | Ingeniero de proceso | COMSOL | Reactores + Difusión + Cristalización | $30K+/año |
| **3D Printing** | Diseñador/Operador | PrusaSlicer + Fusion | CAD + Slice + Lattice GenDesign | $500/año |

### 15.2 Cómo Sirve La Forja a Cada Vertical

#### Para ARQUITECTOS:
- Modelado paramétrico de edificios y estructuras
- Análisis estructural (vigas, columnas, marcos)
- Simulación térmica de envolventes (aislamiento, puentes térmicos)
- Cálculo de cargas de viento (CFD simplificado)
- Análisis sísmico (modal + respuesta espectral)
- Diseño de alumbrado (ray tracing óptico)
- Generative design para formas orgánicas (Zaha Hadid style)

#### Para MECATRÓNICOS/ROBOTICISTAS:
- Diseño mecánico del robot (articulaciones, eslabones)
- Cinemática directa e inversa (ya en el plan §11)
- Simulación de trayectorias
- Análisis FEA de estructura del robot
- Diseño de PCB del controlador
- IDE de firmware integrado (ya en el plan §12)
- Programación ROS2 directa
- Digital twin con conexión en tiempo real

#### Para DISEÑADORES DE MOLDES DE PLÁSTICO:
- Diseño de pieza con draft, wall thickness, shrinkage
- Parting line → core/cavity automático
- Runner system + gate placement
- Simulación de llenado (Hele-Shaw)
- Simulación de enfriamiento (canales conformales = SDF puro)
- Predicción de warpage
- CAM para mecanizar el molde
- Post-procesador para Fanuc/Siemens

#### Para OPERADORES CNC:
- Importar STEP de cliente → automático feature recognition
- Generar toolpaths desde el modelo
- Simulación de mecanizado (stock removal via SDF boolean)
- Post-procesar para su control (Fanuc, Haas, Siemens...)
- Verificar colisiones con fixture y máquina
- Hoja de setup automática

#### Para EDUCACIÓN (La Forja como escuela):
- **Simulador de Física**: Visualizar esfuerzos, deformaciones, campos de temperatura en tiempo real
- **Simulador de Química**: Ver cómo difunde un reactante, cómo se mezclan fluidos, cinética de reacciones
- **Laboratorio Virtual**: Montaje de experimentos paramétricos (cambiar variables y ver resultados al instante)
- **Tutoriales Interactivos**: Cada simulación tiene un "modo profesor" que explica las ecuaciones
- **Competencias**: Retos de optimización (¿quién diseña la viga más ligera que soporte 1000N?)
- **Acceso Gratuito**: Version educativa sin restricciones funcionales

---

## 16. DISEÑO GENERATIVO — LA VENTAJA F-REP

> **Tesis Central**: La optimización topológica sobre F-Rep es FUNDAMENTALMENTE superior a la de B-Rep.
> En B-Rep necesitas remallado constante. En F-Rep, el campo de densidad ES el SDF.

### 16.1 Cómo Funciona en Otros CADs (lento y caro)

```
Fusion 360 / nTopology / Altair:
1. Usuario define geometría preserve + obstacles + cargas
2. Se sube a la NUBE (Autodesk cloud)
3. Se mallan millones de elementos
4. Se corre SIMP (Solid Isotropic Material with Penalization)
5. Horas/días de compute
6. Se devuelve un mesh ruidoso
7. Se suaviza el mesh (pérdida de detalle)
8. Se convierte a B-Rep (frecuentemente falla)
9. El usuario recibe N variantes
```

### 16.2 Cómo Funciona en La Forja (rápido y local)

```
La Forja (F-Rep nativo):
1. Usuario define geometría preserve + obstacles + cargas (mismas)
2. Se corre FEA sobre voxel grid de SDF (GPU compute)
3. Se calcula sensibilidad: ∂compliance/∂ρ_e por voxel
4. Se actualiza campo de densidad ρ(x,y,z) (es otro SDF)
5. Se combina: final_sdf = max(original_sdf, density_field)
6. Se renderiza INSTANTÁNEAMENTE (el ray marcher ya sabe pintar SDFs)
7. Convergencia en SEGUNDOS, no horas
8. No hay conversión a B-Rep — el resultado YA ES un SDF editable
```

### 16.3 Tipos de Diseño Generativo

| Tipo | Qué Hace | F-Rep Advantage |
|------|----------|----------------|
| **Topological Optimization** | Quita material donde no hay esfuerzo | Gradient descent continuo sobre SDF |
| **Shape Optimization** | Ajusta contornos manteniendo topología | Mueve la superficie SDF=0 via gradiente |
| **Size Optimization** | Ajusta espesores de paredes, radios | Variables paramétricas → barrido automático |
| **Lattice Optimization** | Relleno con celdas variables (gyroid, diamond) | `sin(x)cos(y)+... - t` donde `t = f(stress)` |
| **Multi-material** | Optimiza distribución de 2+ materiales | SDFs superpuestos con diferentes propiedades |
| **Compliance Minimization** | Maximiza rigidez para peso dado | Formulación estándar SIMP adaptada a SDF |
| **Stress Constrained** | Ningún punto supera σ_max | Von Mises evaluado en cada voxel |
| **Thermal Optimization** | Minimiza T_max o uniformiza temperatura | Fourier sobre voxel grid |

### 16.4 Lattice / TPMS Structures (Nativo en F-Rep)

Estas son funciones SDF LITERALES:

```glsl
// Gyroid — estructura de mínima superficie
float gyroid(vec3 p, float scale, float thickness) {
    p *= scale;
    return abs(sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x)) - thickness;
}

// Schwarz-P
float schwarzP(vec3 p, float scale, float t) {
    p *= scale;
    return abs(cos(p.x) + cos(p.y) + cos(p.z)) - t;
}

// Diamond
float diamond(vec3 p, float scale, float t) {
    p *= scale;
    return abs(sin(p.x)*sin(p.y)*sin(p.z) + sin(p.x)*cos(p.y)*cos(p.z)
         + cos(p.x)*sin(p.y)*cos(p.z) + cos(p.x)*cos(p.y)*sin(p.z)) - t;
}

// Conformal lattice: thickness varies with stress field
float adaptiveLattice(vec3 p, float scale, float stressField) {
    float t = mix(0.05, 0.4, stressField); // Más grueso donde hay más esfuerzo
    return gyroid(p, scale, t);
}
```

En Fusion 360 / nTopology esto es un proceso de 10 pasos. En La Forja es **una línea de GLSL**.

---

## 17. MOLDES DE INYECCIÓN DE PLÁSTICO — VERTICAL #1

> **Por qué es la vertical #1**: México es el 4to exportador de autopartes del mundo.
> La industria del molde de inyección paga $50K+/año por herramientas hoy.
> Ningún CAD une diseño + simulación de llenado + CAM del molde en una sola herramienta.

### 17.1 Workflow Completo de Diseño de Molde

```
1. Diseñar la pieza (CAD paramétrico)
     ↓
2. Análisis de manufacturabilidad
   - Draft analysis (ángulos de desmoldeo)
   - Wall thickness (grosores mínimos por material)
   - Undercut detection (zonas que no desmoldan)
   - Shrinkage compensation (escalar cavidad)
     ↓
3. Definir línea de partición (parting line)
   - Automática: silueta desde dirección de desmoldeo
   - Manual: el usuario selecciona aristas
     ↓
4. Generar core + cavity
   - Offset surface hacia afuera → cavity insert
   - Offset surface hacia adentro → core insert
   - Ambos son operaciones SDF triviales: sdf_cavity = sdf_part + offset
     ↓
5. Diseñar sistema de alimentación (runner + gate)
   - Cold runner: canales cilíndricos (SDFs)
   - Hot runner: manifold con heaters
   - Gate: punto de inyección (pin gate, sub gate, edge gate)
     ↓
6. Diseñar canales de enfriamiento
   - Convencionales: líneas rectas (drilling)
   - Conformales: siguen la geometría de la pieza (para impresión 3D del inserto)
   - LOS CANALES CONFORMALES SON SDF PURO — offset del sdf de la pieza
     ↓
7. Simular llenado (Hele-Shaw)
   - Frente de flujo sobre la cavidad (SDF < 0)
   - Detección de últimas zonas en llenar (air traps)
   - Líneas de soldadura (weld lines)
   - Balance de runners
     ↓
8. Simular enfriamiento
   - Transitorio térmico: molde + pieza + canales
   - Tiempo de ciclo óptimo
   - Distribución de temperatura al expulsar
     ↓
9. Simular warpage
   - Esfuerzos residuales del enfriamiento diferencial
   - Shrinkage anisotrópico (fibras orientadas)
   - Compensación inversa del molde
     ↓
10. Calcular fuerza de cierre
    - Área proyectada × presión de inyección × factor de seguridad
    - Seleccionar máquina inyectora adecuada (tonnage)
      ↓
11. Diseñar sistema de expulsión
    - Pines de expulsión (fuerza de desmoldeo)
    - Stripper plates
    - Lifters para undercuts internos
    - Slides para undercuts externos
      ↓
12. Seleccionar mold base (DME, Hasco, Misumi)
    - Tamaño de placa
    - Guías + bushings
    - Barras expulsoras
      ↓
13. Generar CAM para mecanizar insertos
    - Core: 3D adaptive + acabado
    - Cavity: 3D adaptive + acabado
    - Electrodes para EDM (para detalles finos)
      ↓
14. Post-procesar para Fanuc/Siemens/Haas
    - G-code optimizado por control
    - Hoja de setup con herramientas, origenes, tiempos
```

### 17.2 Base de Datos de Materiales para Inyección

Ya tenemos ABS, PLA, PETG, Nylon en `formulas.ts`. Necesitamos expandir:

| Material | Shrinkage | T_melt | T_mold | MFI | Min Wall | Prioridad |
|----------|-----------|--------|--------|-----|----------|-----------|
| ABS | 0.4-0.7% | 220-260°C | 40-80°C | 10-40 | 1.0mm | ✅ ya |
| PLA | 0.3-0.5% | 170-220°C | 20-40°C | 6-20 | 0.8mm | ✅ ya |
| PETG | 0.2-0.5% | 230-260°C | 30-50°C | 15-30 | 1.0mm | ✅ ya |
| Nylon 6/6 | 0.8-1.5% | 260-290°C | 60-90°C | 15-80 | 0.8mm | ✅ ya |
| PP (Polipropileno) | 1.0-2.5% | 200-280°C | 20-60°C | 5-50 | 0.8mm | 🔴 FALTA |
| PE-HD | 1.5-3.0% | 200-280°C | 20-60°C | 0.3-50 | 0.8mm | 🔴 FALTA |
| PC (Policarbonato) | 0.5-0.7% | 280-320°C | 80-120°C | 5-30 | 1.0mm | 🔴 FALTA |
| POM (Acetal/Delrin) | 1.8-2.5% | 190-230°C | 60-100°C | 5-30 | 0.8mm | 🔴 FALTA |
| TPU (Elastómero) | 0.5-1.5% | 190-230°C | 20-40°C | varies | 1.5mm | 🔴 FALTA |
| PA-GF30 (Nylon + Fibra) | 0.2-0.5% | 275-300°C | 80-100°C | 10-30 | 1.2mm | 🔴 FALTA |
| PEEK | 1.0-1.5% | 370-400°C | 150-180°C | 5-20 | 1.0mm | 🟡 |
| LCP | 0.1-0.5% | 280-360°C | 80-130°C | 10-50 | 0.5mm | 🟡 |

---

## 18. ESTÁNDARES Y NORMATIVIDAD

> Instituciones y estándares que debemos cumplir/soportar.

### 18.1 Estándares de Datos CAD

| Estándar | Organismo | Qué Define | Relevancia |
|----------|-----------|-----------|-----------|
| **STEP AP203** | ISO 10303 | Geometría 3D + estructura de ensamble | Import ✅ (via occt-import-js) |
| **STEP AP214** | ISO 10303 | Automotriz: geometría + color + capas | Import 🟡 |
| **STEP AP242** | ISO 10303 | PMI (tolerancias GD&T) + diseño paramétrico | Import 🟡 (archivos NIST descargados) |
| **IGES** | ANSI/ASME | Geometría 3D (formato legacy) | Import ✅ |
| **STL** | 3D Systems | Mallas trianguladas (aditiva) | Export ✅ |
| **3MF** | 3MF Consortium | Mallas + materiales + colores + soporte | Export 🔴 |
| **JT** | Siemens | Visualización liviana de ensambles | 🟢 |
| **IFC** | buildingSMART | Modelo de edificio (arquitectura/MEP) | 🟡 |
| **QIF** | DMSC | Quality Information Framework (metrología) | 🟢 |

### 18.2 Estándares de Manufactura

| Estándar | Qué Define | Relevancia |
|----------|-----------|-----------|
| **ISO 6983 / RS-274** | G-code estándar (lo que leen Fanuc, Haas...) | 🔴 CRÍTICO para CAM |
| **ISO 14649 (STEP-NC)** | Datos de manufactura inteligentes | 🟡 Futuro |
| **ISO 286** | Tolerancias y ajustes (H7/g6, etc.) | 🔴 Para dibujos |
| **ISO 1101** | GD&T — tolerancias geométricas | 🔴 Para dibujos |
| **ASME Y14.5** | GD&T versión americana | 🔴 Para dibujos |
| **ISO 2768** | Tolerancias generales (no indicadas) | 🟡 |
| **SPI Mold Classes** | Clasificación 101-105 de moldes | 🟡 Para vertical moldes |
| **ISO 294** | Especímenes de prueba para inyección | 🟡 |

### 18.3 Estándares de Simulación

| Estándar / Referencia | Qué Define | Para Qué |
|----------------------|-----------|----------|
| **NAFEMS Benchmarks** | Problemas de validación FEA con soluciones exactas | Validar nuestro solver |
| **ASME V&V 10** | Verificación y Validación de modelos computacionales | Credibilidad de simulaciones |
| **ISO 12135** | Tenacidad a la fractura | Fatiga avanzada |
| **ASTM E466** | Pruebas de fatiga | Validación S-N |
| **NIST PMI Test Cases** | ✅ YA DESCARGADOS — Modelos de prueba para validar lectura de STEP con PMI | Validar import |

### 18.4 Organizaciones Clave

| Organización | Qué Hace | Por Qué Nos Importa |
|-------------|---------|---------------------|
| **NIST** (USA) | Estándares de metrología y datos CAD | Modelos de prueba, validación STEP |
| **ISO TC184/SC4** | Comité que mantiene STEP (ISO 10303) | Interoperabilidad CAD |
| **NAFEMS** | Asociación internacional de simulación | Benchmarks FEA, credibilidad |
| **OCC (Open Cascade)** | Kernel CAD open source (B-Rep) | Usamos occt-import-js para STEP |
| **3MF Consortium** | Formato moderno de impresión 3D | Microsoft, HP, Autodesk, etc. |
| **MTConnect Institute** | Protocolo de comunicación con máquinas CNC | Conexión en tiempo real |
| **OPC UA Foundation** | Protocolo industrial IoT | Comunicación con PLCs |
| **buildingSMART** | IFC para construcción/arquitectura | Si entramos al mercado de AEC |
| **Khronos Group** | WebGL, glTF, OpenCL | Nuestro rendering y compute |
| **SPE (Society of Plastics Engineers)** | Comunidad de inyección de plástico | El gremio de nuestro vertical #1 |

---

## 19. INVENTARIO TÉCNICO COMPLETO — QUÉ EXISTE HOY

### 19.1 Código Implementado (42 archivos TS/TSX — 18,574 líneas)

> **Actualizado**: 29 de marzo 2026

| Archivo | Líneas | Estado | Conectado a UI |
|---------|--------|--------|----------------|
| `ForgePage.tsx` | 2,278 | ✅ Completo | ✅ Sí |
| `formulas.ts` | 1,457 | ✅ Completo | ❌ NO (desconectado) |
| `useForgeStore.ts` | 1,102 | ✅ Completo | ✅ Sí |
| `gpu-cross-section.ts` | 1,090 | ✅ Completo | ✅ Sí (via scanModel) |
| `reverse-engineer.ts` | 897 | ✅ Completo | ✅ Sí |
| `sketch-fitting.ts` | 789 | ✅ Completo | ✅ Sí (via fitSketches) |
| `cross-section.ts` | 765 | ✅ Completo | ✅ Sí (via ctScan) |
| `feature-recognition.ts` | 675 | ✅ Completo | ✅ Sí |
| `BlueprintPanel.tsx` | 590 | ✅ Completo | ✅ Sí |
| `machine-config.ts` | 555 | ✅ Completo | ✅ Sí |
| `sdf-engine.ts` | 524 | ✅ Completo | ✅ Sí |
| `mc-worker.ts` | 503 | ✅ Completo | ✅ Sí |
| `stl-export.ts` | 475 | ✅ Completo | ✅ Sí |
| `profile-to-sdf.ts` | 460 | ✅ Completo | ✅ Sí |
| `step-import.ts` | 437 | ✅ Completo | ✅ Sí |
| `gaia-variables.ts` | 392 | ✅ Completo | ✅ Sí |
| `blueprint-export.ts` | 372 | ✅ Completo | ✅ Sí |
| `RayMarchMesh.tsx` | 366 | ✅ Completo | ✅ Sí |
| `ForgeViewport.tsx` | 339 | ✅ Completo | ✅ Sí |
| `Omnibar.tsx` | 339 | ✅ Completo | ✅ Sí |
| `SketchInViewport.tsx` | 331 | ✅ Completo | ✅ Sí |
| `MarkingMenu.tsx` | 282 | ✅ Completo | ✅ Sí |
| `SketchPanel.tsx` | 285 | ✅ Completo | ✅ Sí |
| `sdf-cpu.ts` | 242 | ✅ Completo | ✅ Sí |
| `forge-audio.ts` | 237 | ✅ Completo | ✅ Sí |
| `simulation.ts` | 212 | ⚠️ Solo stats/kinematics | ⚠️ Parcial |
| `CommandPalette.tsx` | 210 | ✅ Completo | ✅ Sí |
| `SectionPlane.tsx` | 207 | ✅ Completo | ✅ Sí |
| `CameraTransitions.tsx` | 206 | ✅ Completo | ✅ Sí |
| `SketchOverlay.tsx` | 183 | ✅ Completo | ✅ Sí |
| `Timeline.tsx` | 140 | ✅ Completo | ✅ Sí |
| `sketch-engine.ts` | 114 | ⚠️ Solo rect/circle | ⚠️ Parcial |
| `ShortcutOverlay.tsx` | 106 | ✅ Completo | ✅ Sí |
| `ToolbarDropdown.tsx` | 91 | ✅ Completo | ✅ Sí |
| 10 componentes shadcn/ui | ~1,100 | ✅ Completo | ✅ Sí |
| `main.css` | 277 | ✅ Completo | ✅ Sí |
| viewport utilities | ~60 | ✅ Completo | ✅ Sí |

### 19.2 Fórmulas Ya Implementadas en formulas.ts (LISTAS PARA CONECTAR)

| Categoría | Funciones | Estado |
|-----------|-----------|--------|
| **Material Database** | 20 materiales con todas las propiedades | ✅ Listo |
| **Elasticidad** | Matrices 3D, plane stress, plane strain | ✅ Listo |
| **Esfuerzos** | Von Mises, principales, cortante máximo, safety factor, hidrostático | ✅ Listo |
| **Elementos FEM** | Truss 3D, Beam Euler-Bernoulli, Beam Timoshenko, CST triangle, Tet4 | ✅ Listo |
| **Térmica** | Fourier, Newton, Stefan-Boltzmann, resistencia serie, aletas, Tet4 térmico, capacitancia | ✅ Listo |
| **Fluidos** | Bernoulli, Reynolds, Darcy-Weisbach, Colebrook, Dittus-Boelter | ✅ Listo |
| **Vibraciones** | Frecuencia natural, amortiguada, viga, pandeo Euler | ✅ Listo |
| **Diseño Mecánico** | Concentración de esfuerzos, Lamé, deflexión vigas, momentos de inercia, secciones | ✅ Listo |
| **Fatiga** | Basquin S-N, Goodman modificado | ✅ Listo |
| **Esfuerzo Térmico** | Barra restringida, expansión libre | ✅ Listo |
| **Solvers** | Gauss con pivoteo parcial, Gradiente Conjugado Precondicionado (Jacobi) | ✅ Listo |
| **Mallado** | Generador tetraédrico estructurado (hex → 5 tets) | ✅ Listo |
| **Secciones** | Rectángulo, Círculo, Tubo, I-Beam (A, I, S, r, J) | ✅ Listo |
| **Constantes** | g, kB, σ, R, NA, atm, ρ_water, ρ_air, ν_water, ν_air | ✅ Listo |
| **Unidades** | mm↔m, psi↔Pa, °C↔K↔°F, RPM↔rad/s, hp↔W, etc. | ✅ Listo |

### 19.3 Archivos de Prueba Descargados

| Set | Archivos | Organismo | Para Qué |
|-----|----------|-----------|---------|
| **NIST D2MI Models** | 8 archivos (.prt, .stp, .sat) | NIST | Validar reverse engineering |
| **NIST PMI STEP Files** | 20+ archivos AP242 | NIST | Validar import PMI/GD&T |
| **NIST MTC Assembly** | NX + SolidWorks formats | NIST | Validar ensambles |
| **Machine Configs** | 8 archivos .mch de Fusion 360 | Autodesk/OEM | Parsear cinemáticas CNC |

---

## 20. ROADMAP DE DESARROLLO — SECUENCIA COMPLETA

> Orden lógico. Cada onda se construye sobre la anterior. Sin saltos.

### ONDA 0: CIMIENTOS (Lo que falta para que el CAD sea usable) — Sprint 1-4

| # | Feature | Depende de | Resultado |
|---|---------|-----------|-----------|
| 0.1 | Sketch: Line tool | — | Dibujar polilíneas |
| 0.2 | Sketch: Arc 3-point | Line tool | Curvas básicas |
| 0.3 | Sketch: Trim / Extend | Line + Arc | Editar perfiles |
| 0.4 | Sketch: Fillet + Chamfer 2D | Trim | Esquinas redondeadas |
| 0.5 | Sketch: Offset | Perfil cerrado | Paredes, offsets |
| 0.6 | Sketch: Constraints (H, V, Coincident, Perp, Parallel, Tangent, Equal, Fix) | Entidades 2D | PARAMETRICIDAD |
| 0.7 | Sketch: Constraint Solver (Newton-Raphson) | Constraints | DOFs resueltos |
| 0.8 | Sketch: Dimensions → Variables | Solver + Variables | Cada cota es una variable con nombre |
| 0.9 | Extrude avanzado (cut/join/new body, symmetric, to-face) | Perfil cerrado | Modelado real |
| 0.10 | Revolve | Perfil + eje | Cilindros, botellas, tornillos |
| 0.11 | Sweep + Loft | Perfiles + guías | Formas complejas |
| 0.12 | Fillet 3D (variable radius via SDF smoothMin variable) | Cuerpos 3D | Acabado |
| 0.13 | Shell (hollow via SDF offset) | Cuerpos 3D | Carcasas |
| 0.14 | Draft angle | Caras + dirección | Moldes |
| 0.15 | Pattern (rect + circular) | Features 3D | Repetición |
| 0.16 | Mirror 3D | Features + plano | Simetría |
| 0.17 | Assembly: Components + Joints | Múltiples cuerpos | Ensambles |
| 0.18 | Measure tool | Geometría | Distancias, ángulos, áreas |

### ONDA 1: SIMULACIÓN FUNDACIONAL — Sprint 5-8

| # | Feature | Depende de | Resultado |
|---|---------|-----------|-----------|
| 1.1 | SDF → Adaptive Tetrahedral Mesh | SDF engine | Mesh automático desde campo SDF |
| 1.2 | FEA Global Assembly (K_global, f_global) | Mesh + formulas.ts | Sistema ensamblado |
| 1.3 | Boundary Conditions UI (cargas + restricciones) | Assembly | Usuario define fuerzas y fijaciones |
| 1.4 | Estrés Estático completo | 1.1-1.3 | Von Mises, displacement, safety factor |
| 1.5 | GPU Results Overlay | Resultados FEA | Colores de estrés pintados en ray marcher |
| 1.6 | Térmica Estado Estacionario | 1.1-1.3 | Distribución de temperatura |
| 1.7 | Análisis Modal (eigenvalue) | K + M matrices | Frecuencias naturales + mode shapes |
| 1.8 | Pandeo (eigenvalue de K + K_g) | K + K_geométrica | Carga crítica |
| 1.9 | Fatiga (Goodman + S-N post-process) | Resultados de estrés | Vida estimada en ciclos |
| 1.10 | Material Selector UI | Material DB | Panel visual de materiales con propiedades |

### ONDA 2: EL GRAN DIFERENCIADOR — Sprint 9-14

| # | Feature | Depende de | Resultado |
|---|---------|-----------|-----------|
| 2.1 | Diseño Generativo (Topological Optimization GPU) | FEA + SDF | Optimización en tiempo real |
| 2.2 | Lattice/TPMS (Gyroid, Schwarz-P, Diamond) | SDF engine | Estructuras celulares |
| 2.3 | Adaptive Lattice (grosor = f(esfuerzo)) | 2.1 + 2.2 | Lattice optimizado por carga |
| 2.4 | Inyección: Hele-Shaw Flow Simulation | SDF field + BC | Simulación de llenado |
| 2.5 | Inyección: Cooling Simulation (transitoria) | Térmica transitoria | Ciclo de enfriamiento |
| 2.6 | Inyección: Warpage Prediction | Esfuerzos residuales | Deformación post-desmoldeo |
| 2.7 | Parting Line + Core/Cavity automático | SDF boolean | Generación de molde |
| 2.8 | Multifísica: Termomecánico acoplado | FEA + Térmica | Esfuerzos por temperatura |
| 2.9 | DOE (Design of Experiments) | Variables + Solver | Barrido paramétrico |
| 2.10 | Reporte automático (PDF) | Cualquier simulación | Documentación profesional |

### ONDA 3: CAM COMPLETO — Sprint 15-20

| # | Feature | Depende de | Resultado |
|---|---------|-----------|-----------|
| 3.1 | Facing (planeado) toolpath | SDF stock + tool geometry | Planear |
| 3.2 | 2D Pocket toolpath | Contornos 2D del SDF slice | Vaciado |
| 3.3 | 2D Contour toolpath | Contorno exterior | Perfilado |
| 3.4 | Drilling cycles (peck, tap, bore) | Hole feature detection | Taladrado |
| 3.5 | 3D Adaptive (HSM) | SDF ray-based tool engagement | Desbaste eficiente |
| 3.6 | 3D Finishing (scallop, parallel, pencil) | SDF normal + stepover | Acabado |
| 3.7 | Stock Simulation (SDF boolean removal) | Toolpath + stock SDF | Verificación visual |
| 3.8 | Post-procesador Fanuc 0i/30i | G-code template engine | G-code Fanuc |
| 3.9 | Post-procesador Siemens 840D | G-code template engine | G-code Siemens |
| 3.10 | Post-procesador Haas NGC | G-code template engine | G-code Haas |
| 3.11 | Post-procesador GRBL / LinuxCNC | G-code template engine | Open CNC |
| 3.12 | Feed/Speed Calculator | Material + tool + op | Parámetros óptimos |
| 3.13 | Setup Sheet automático | Toolpath + tools | Hoja de configuración |
| 3.14 | FDM Slicer (contornos SDF por capa) | SDF slice Z | G-code aditivo |
| 3.15 | Support generation (overhang detection via SDF normals) | SDF normals | Soportes automáticos |

### ONDA 4: SIMULACIÓN AVANZADA — Sprint 21-30

| # | Feature | Depende de | Resultado |
|---|---------|-----------|-----------|
| 4.1 | CFD: Lattice Boltzmann GPU | GPU compute framework | Flujo incompresible visual |
| 4.2 | CFD: Conjugate heat transfer | CFD + Thermal | Enfriamiento por convección forzada |
| 4.3 | No-lineal: plasticidad (bilineal) | Newton-Raphson iterativo | Deformación permanente |
| 4.4 | No-lineal: grandes deformaciones | Updated Lagrangian | Elastómeros, rubber |
| 4.5 | Dinámica transitoria (Newmark-β) | M + C + K matrices | Impacto, vibración |
| 4.6 | Materiales compuestos (CLT) | Laminado lay-up | Fibra de carbono/vidrio |
| 4.7 | Electrostática / corrientes | Laplace solver | PCBs, MEMS |
| 4.8 | Difusión + reacciones (Fick + Arrhenius) | Scalar field solver | Química, farmacéutica |
| 4.9 | Fluido-Estructura (FSI) weak coupling | CFD + FEA alternating | Válvulas, aero |
| 4.10 | Optimización multi-objetivo | DOE + Pareto | N variables, M objetivos |

### ONDA 5: ECOSISTEMA COMPLETO — Sprint 31+

| # | Feature | Resultado |
|---|---------|-----------|
| 5.1 | Dibujos técnicos (2D drawings) con GD&T automático | Planos ISO/ASME |
| 5.2 | Planos de montaje con BOM | Documentación de producción |
| 5.3 | Export 3MF (con materiales y colores) | Aditiva avanzada |
| 5.4 | Export STEP AP242 (con PMI) | Interoperabilidad industrial |
| 5.5 | Sheet Metal (unfold, K-factor) | Corte láser / doblado |
| 5.6 | Electrónica: esquemático + PCB | Diseño de placas |
| 5.7 | Plugin system (JS/TS extensions) | Extensibilidad |
| 5.8 | Collaboration (multi-user) | Trabajo en equipo |
| 5.9 | Version control (git-like branching) | Historial de diseño |
| 5.10 | Marketplace de componentes estándar | Tornillos, rodamientos, motores |
| 5.11 | Conexión MTConnect a máquinas CNC | Digital twin de fábrica |
| 5.12 | App móvil (viewer + aprobaciones) | Acceso en planta |

---

## 21. LA FORJA COMO ESCUELA — EL SIMULADOR EDUCATIVO

> **Visión**: Cada tipo de simulación tiene un "modo profesor" que explica qué ecuaciones se usan,
> por qué, y te permite experimentar cambiando variables en tiempo real.
> El estudiante de mecatrónica, química, civil o industrial puede APRENDER haciendo.

### 21.1 Módulos Educativos

| Curso | Qué Enseña | Con Qué Simulación |
|-------|----------|-------------------|
| **Resistencia de Materiales** | Esfertzo, deformación, Hooke, Von Mises, Mohr | Estrés estático + vigas + presión |
| **Mecánica de Fluidos** | Bernoulli, Reynolds, pérdidas, Navier-Stokes | CFD + tuberías + flujo externo |
| **Transferencia de Calor** | Fourier, Newton, Stefan-Boltzmann, aletas | Térmica steady + transitoria |
| **Termodinámica** | Ciclos, eficiencia, entalpía | Thermal + fluid (futuro) |
| **Vibraciones Mecánicas** | Frecuencia natural, amortiguamiento, resonancia | Modal + dinámica armónica |
| **Diseño de Máquinas** | Fatiga, concentración, seguridad, rodamientos | Fatiga + estrés + Hertz |
| **Dinámica de Cuerpo Rígido** | Cinemática, dinámica, Newton-Euler | Multibody dynamics |
| **Control Automático** | PID, respuesta escalón, Bode, Nyquist | Simulación de sistemas (lazo cerrado) |
| **Ciencia de Materiales** | Microestructura, fases, tratamientos térmicos | Diagramas de fase + TTT (visual) |
| **Química General** | Reacciones, equilibrio, cinética | Reactores + difusión |
| **Procesos de Manufactura** | Maquinado, inyección, fundición, soldadura | CAM + Sim de proceso |
| **Estructuras (Civil)** | Marcos, armaduras, cimientos | FEA 2D/3D + Pandeo |
| **Hidráulica** | Tuberías, bombas, canales | Flujo en tuberías + Bernoulli |

### 21.2 Features Educativas

- **Modo Ecuación**: Al pasar el cursor sobre cualquier resultado de simulación, muestra la ecuación que lo generó
- **Modo Paso-a-Paso**: Ejecuta el solver paso a paso, mostrando cada iteración
- **Comparador**: "¿Qué pasa si cambio el material de ABS a Acero?" → split-screen con ambos resultados
- **Retos**: Problemas predefinidos con solución conocida (benchmarks NAFEMS)
- **Certificaciones**: Al completar módulos, el usuario obtiene badge verificable
- **Exportar como Reporte**: El estudiante entrega un PDF con modelo + simulación + conclusiones

---

## 22. DISEÑO DE INTERFAZ — EL PLAN VISUAL

> **Diagnóstico brutal**: La interfaz actual SE VE IGUAL QUE TODAS.
> Tenemos dark theme + gold accent + menubar + tree panel + timeline = es Fusion 360 con otro color.
> Plasticity triunfa porque se siente diferente. Houdini es diferente.
> Nosotros somos F-Rep, no B-Rep. La interfaz debe REFLEJAR eso.

### 22.1 Qué Tiene Hoy (y Por Qué Se Siente Genérico)

> **Actualizado**: 29 de marzo 2026 — ForgePage.tsx alcanza 2,278 líneas

| Elemento | Qué Hace | Estado | Problema |
|----------|---------|--------|---------|
| **Header/Menubar** | SKETCH · SOLID · SURFACE · METAL · CONSTRUCT · INSPECT · INSERT · ASSEMBLE | ✅ shadcn Menubar con submenús completos | Es la barra de Fusion 360 renombrada. 8 menús que el 95% del tiempo no se tocan. |
| **Scene Tree (sidebar izq.)** | Árbol jerárquico colapsable con hover-expand, módulos renombrables | ✅ Funcional con módulos y activación | Patrón de Fusion/Blender/Unity. Funcional pero NO innovador. |
| **Properties Panel** | Panel flotante con posición/rotación/parámetros/variables vinculadas | ✅ Floating con glass effect | Genérico pero bien ejecutado. |
| **Timeline (barra inferior)** | Nodos de historial con navegación | ✅ Funcional | Copia de Fusion. No aporta mucho en F-Rep. |
| **Omnibar (Ctrl+K)** | Búsqueda universal con 60+ comandos, categorías, keywords | ✅ **Excelente** | ✅ Mantener. |
| **Marking Menu (clic derecho)** | Menú radial con secciones contextuales | ✅ Funcional | ✅ Funcional. Visual básico. |
| **Shortcut Overlay (S)** | Grid de atajos rápidos | ✅ Funcional | OK pero limitado. |
| **Variable Bar** | Chips de variables editables encima del viewport | ✅ Funcional con VarChip components | Buena idea, ejecución plana. |
| **Viewport** | Three.js + ray marching dual + grid + ViewCube + camera transitions | ✅ **Core sólido** | ✅ Funciona bien. |
| **Sketch 2D** | Rect/Circle en 3 planos + face picking + panel de herramientas | ✅ Básico | Solo 2 forms, sin constraints. |
| **Blueprint Panel** | Visualizador interactivo de planos técnicos extraídos | ✅ Completo | ✅ Bien. |
| **Import/Export** | STEP/IGES drag&drop + STL/SVG export + 8 máquinas .mch | ✅ Funcional | Buena base. |
| **Ingeniería Inversa** | Modelo→primitivas SDF + CT-scan + GPU planes + sketch fitting | ✅ Pipeline completo | **Feature único. Ningún otro CAD tiene esto.** |
| **Audio** | Click, create, delete, undo, error, complete sounds | ✅ Funcional | ✅ Diferenciador. |
| **Tema Visual** | "Oro Divino" — void black (#08090d) + gold (#c9a84c) + glass panels | ✅ Implementado | **⚠️ DEMASIADO OSCURO. Los fondos son casi negro puro, no navy profundo.** |

**Conclusión**: El 80% de la UI es un collage de patrones de otros CADs.
No hay NADA que al abrirlo digas "esto es de otro planeta".

### 22.2 Principios de Diseño — "Forjado por Dioses"

> La Forja no es un CAD más. Es una herramienta divina. La interfaz debe sentirse como operar
> un artefacto de civilización avanzada — no como llenar formularios en una ventana de Windows.

#### P1: EL VIEWPORT ES TODO (Viewport-First)
- El viewport ocupa el **100%** de la pantalla. No hay barras que le roben espacio permanentemente.
- TODO lo demás son **capas flotantes** que aparecen cuando se necesitan y desaparecen cuando no.
- Referencia: Plasticity (viewport limpio), videojuegos AAA (HUD mínimo).

#### P2: INVOCACIÓN > NAVEGACIÓN (Command-Driven)
- No menús para buscar cosas. **Invocas** lo que necesitas.
- Omnibar (⌘K) = la puerta de entrada universal. Ya lo tenemos, es correcto.
- Marking Menu (right-click) = acceso contextual rápido.
- **Gesto + Intención**: arrastras una línea en el viewport → La Forja infiere que quieres sketch → activa el modo.

#### P3: INFORMACIÓN BAJO DEMANDA (Progressive Disclosure)
- Sin panels permanentes de propiedades. Al seleccionar algo → aparece un **HUD contextual** pegado al objeto.
- Las dimensiones se muestran SOBRE la geometría (como cotas en un dibujo técnico), no en un panel lateral.
- La jerarquía de escena se accede vía Omnibar o breadcrumb sutil, no con un panel de árbol siempre abierto.

#### P4: FLUIR, NO CONFIGURAR (Flow State)
- Cada interacción tiene máximo 1 clic/gesto para empezar. Sin diálogos de confirmación.
- Feedback inmediato: arrastras y ves el resultado EN TIEMPO REAL. No hay "preview" y luego "apply".
- Audio sutil confirma acciones (ya lo tenemos con forge-audio.ts ✅).

#### P5: MATERIALIDAD DIVINA (Visual Identity)
- No es flat design. No es neomorfismo. Es **materia luminosa en el vacío**.
- Paneles = cristal oscuro con bordes de plasma dorado que respiran.
- Elementos activos = brillo interior, no solo cambio de color de fondo.
- Animaciones de estado: las cosas no aparecen/desaparecen — se **materializan** y se **disuelven**.
- La selección de un objeto hace que su silueta emita un halo dorado en el viewport.

#### P6: TIPOGRAFÍA COMO DATO, NO COMO DECORACIÓN
- Números = monospace (JetBrains Mono ✅), grande, legible.
- Labels = casi invisibles hasta que importan.
- El usuario ve NÚMEROS y GEOMETRÍA, no palabras.

### 22.3 La Nueva Arquitectura de Layout

```
┌──────────────────────────────────────────────────────────────┐
│                     VIEWPORT (100%)                          │
│                                                              │
│  ┌─────────┐                              ┌──────────────┐  │
│  │ Context  │                              │   Inspector  │  │
│  │ Breadcrumb│                             │   HUD        │  │
│  │ (top-left)│                             │   (flotante) │  │
│  └─────────┘                              └──────────────┘  │
│                                                              │
│                    ┌──────────────┐                          │
│                    │  3D OBJECT   │                          │
│                    │  con cotas   │                          │
│                    │  inline      │                          │
│                    └──────────────┘                          │
│                                                              │
│                                                              │
│  ┌─────┐                                     ┌──────────┐  │
│  │Tools│                                     │ ViewCube │  │
│  │Strip│                                     │ + camera │  │
│  │(left)│                                    └──────────┘  │
│  └─────┘                                                    │
│                                                              │
│           ┌──────────────────────────────┐                  │
│           │     Variable Bar (bottom)    │                  │
│           └──────────────────────────────┘                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Status Strip (minimal)                  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

#### Elementos de la nueva UI:

| Elemento | Posición | Comportamiento | Reemplaza |
|----------|---------|---------------|-----------|
| **Context Breadcrumb** | Top-left, sobre viewport | `Proyecto > Módulo > Componente`: clickable para navegar. Aparece al hover o al seleccionar. | Scene tree sidebar |
| **Tool Strip** | Left edge, vertical, iconos tenues | 6-8 iconos: Select, Sketch, Create, Boolean, Sim, Export. Al hacer hover se expande con sub-opciones. | Menubar de 8 menús |
| **Inspector HUD** | Flotante, anclado al objeto seleccionado | Propiedades, dimensiones, material. Se mueve con el objeto al rotar la cámara. Glass effect + gold border. | Properties panel |
| **Inline Dimensions** | Sobre la geometría 3D | Cotas paramétricas renderizadas en 3D (como un dibujo técnico vivo). Click para editar. | Campos numéricos en panel |
| **Variable Bar** | Bottom, centrado, colapsable | Chips de variables. Click para expandir y editar. Mantener concepto actual pero más compacto. | Variable bar (mejora) |
| **Status Strip** | Bottom-left, muy tenue | FPS, mesh quality, mass, volume — solo texto mínimo. | Status bar actual |
| **Omnibar** | Center, invocable con ⌘K | Sin cambios funcionales. Mejorar visual con glass más profundo y animación de materialización. | Omnibar (mejora visual) |
| **Marking Menu** | Center, invocable con right-click | Sin cambios funcionales. Mejorar visual: iconos con glow, líneas de conexión al centro como rayos de energía. | Marking Menu (mejora) |
| **Simulation Overlay** | Right edge, expandible | Al activar sim → panel lateral derecho con controles. Se desliza desde el borde. Solo visible en modo sim. | NUEVO |
| **Mode Indicator** | Top-center, sutil | Badge: "DESIGN" / "SKETCH" / "SIMULATE" / "CAM" — indica modo actual. | NUEVO |

### 22.4 Matar la Menubar — La Barra de Herramientas Muere

> **Problema central**: SKETCH · SOLID · SURFACE · METAL · CONSTRUCT · INSPECT · INSERT · ASSEMBLE
> Son 8 categorías. El usuario promedio usa 3. Las otras 5 son ruido visual permanente.

**Solución: Tool Strip + Omnibar**

La **Tool Strip** es una columna vertical izquierda, casi invisible, con 6 iconos:

| Icono | Modo | Qué Expande al Hover | Equivale a |
|-------|------|---------------------|-----------|
| ⊘ (cursor) | **Select** | Nada — modo default | Select tool |
| ✎ | **Sketch** | Sub-strip: Line, Rect, Circle, Arc, Trim, Dimension | Menú SKETCH completo |
| ⬡ | **Create** | Sub-strip: Extrude, Revolve, Sweep, Primitives, Boolean | Menú SOLID + SURFACE |
| ⚙ | **Modify** | Sub-strip: Fillet, Chamfer, Shell, Draft, Pattern, Mirror | Menú MODIFY |
| ▶ | **Simulate** | Abre panel lateral: Structural, Thermal, CFD, Modal... | NUEVO |
| ⚡ | **Manufacture** | Sub-strip: CAM Setup, Toolpath, G-code, Slice | Menú CAM (nuevo) |

**TODO lo demás** (Insert, Assemble, Inspect, Construct) vive en el **Omnibar**.
- Quieres insertar un STEP? `⌘K → "import step"` → listo.
- Quieres crear un plano de construcción? `⌘K → "offset plane"` → listo.
- Quieres medir? `⌘K → "measure"` → listo.

**No necesitas un menú visible para algo que usas 2 veces al día.**

### 22.5 Inspector HUD — Propiedades Pegadas al Objeto

> En vez de un panel lateral con "Posición X: [___]", las propiedades están en el espacio 3D.

```
Ejemplo — Seleccionas un cilindro:

                    ┌──────────────────┐
                    │  ↕ 45.0mm        │  ← altura, click para editar
           ┌──────────────────────────────────────┐
           │        │                  │           │
           │        │   Cilindro       │           │
           │        │   Steel 4140     │           │  ← nombre + material inline
           │        └──────────────────┘           │
           │            ↔ 12.0mm                   │  ← radio, click para editar
           └───────────────────────────────────────┘

   [ ∪ Unir ]  [ ∖ Restar ]  [ ✕ Eliminar ]    ← Action pills debajo del objeto
```

**Implementación técnica**:
- Cada dimensión paramétrica es un `Html` component de `@react-three/drei` posicionado en el espacio 3D.
- Click en el número → input editable inline → actualiza la variable.
- Pills de acción rápida debajo del bounding box del objeto.
- Glass background con blur, se desvanece cuando la cámara se aleja.

### 22.6 Inline Dimensions — Cotas Vivas en 3D

> El modelo siempre muestra sus dimensiones como si fuera un dibujo técnico,
> pero vivo y editable. Esto NO EXISTE en ningún CAD desktop.

- Líneas de extensión + líneas de cota renderizadas por `THREE.Line2` con material `LineDashedMaterial`.
- Texto de cota renderizado con `Html` de drei o `Text` de troika-three-text para que sea nítido.
- Color: dorado tenue cuando no está seleccionado, dorado brillante cuando sí.
- Click en cualquier cota → se convierte en input → tecleas nuevo valor → geometría se actualiza en tiempo real.
- Las cotas se posicionan automáticamente para no solaparse (layout de cotas algorítmico).

**Referencia**: Este es el feature #1 que más impresionaría en una demo.
Nadie más lo tiene en real-time 3D.

### 22.7 Paleta de Colores v2 — "Plasma en el Vacío"

La paleta actual (Oro Divino v5) está bien en concepto pero falta **profundidad** y **vida**.

> **NOTA (29 mar 2026)**: La paleta actual se pasó de oscura. Los fondos `#08090d`, `#0d0f14`, `#12151c` 
> son prácticamente **negro puro** — no "navy profundo" como dice la spec GAIA_FORGE_SPEC §4.2.
> La propuesta original de la sección abajo sugería ir AÚN MÁS NEGRO (`#030305`), lo cual es incorrecto.
> **CORRECCIÓN**: Los fondos deben subir hacia navy con más color: los paneles deben tener tinte azulado
> visible, no ser void black indistinguible. El concepto dorado funciona pero necesita más contraste
> con fondos que tengan presencia de color.
> 
> **Paleta corregida propuesta**:
> - `--c-base`: `#0c0e16` (navy muy oscuro, pero con tinte azul visible)
> - `--c-surface`: `#10131c` (superficie con presencia navy)
> - `--c-surface-up`: `#161a26` (elevada, claramente navy)
> - `--c-overlay`: `#1c2030` (overlays con más cuerpo)
> - `--c-raised`: `#222838` (paneles elevados, navy medio)
> - Los golds se mantienen — funcionan bien contra navy.

#### Backgrounds — ~~Más Negros~~ Más Navy, Con Color

| Token | Actual | Nuevo | Razón |
|-------|--------|-------|-------|
| `--c-base` | `#08090d` | `#030305` | Más negro = más contraste con el glow |
| `--c-surface` | `#0d0f14` | `#06070b` | Los paneles flotantes son MÁS oscuros que el viewport background |
| `--c-surface-up` | `#12151c` | `#0a0c12` | |

#### Gold — Más Cálido, Más Vivo

| Token | Actual | Nuevo | Razón |
|-------|--------|-------|-------|
| `--c-gold` | `#c9a84c` | `#d4a843` | Un pelo más saturado/cálido |
| `--c-gold-hi` | `#e2c97e` | `#f0d68a` | Más luminoso en highlights |
| `--c-gold-glow` | `rgba(201,168,76,0.06)` | `rgba(212,168,67,0.12)` | Glow más presente |

#### Nuevos Tokens — Simulación y Modos

| Token | Valor | Para Qué |
|-------|-------|----------|
| `--c-sim-struct` | `#3b82f6` (azul) | Resultados estructurales (Von Mises) |
| `--c-sim-thermal` | `#ef4444` → `#3b82f6` (gradiente) | Mapas térmicos (rojo=caliente, azul=frío) |
| `--c-sim-flow` | `#06b6d4` (cyan) | Líneas de flujo CFD |
| `--c-sim-mode` | `#a78bfa` (violeta) | Mode shapes (modal) |
| `--c-cam-path` | `#22c55e` (verde) | Toolpaths de mecanizado |
| `--c-sketch-active` | `#f59e0b` (ámbar) | Líneas de sketch activas |
| `--c-error` | `#ef4444` | Errores (ya existe similar) |
| `--c-success` | `#22c55e` | Confirmaciones |

### 22.8 Glass Effect v2 — Cristal Vivo

El glass actual usa `backdrop-filter: blur(24px)`. Necesita más capas:

```css
.forge-glass-v2 {
  /* Base: casi negro, semi-transparente */
  background: rgba(3,3,5,0.72);
  
  /* Borde: DOBLE borde — uno sutil exterior, uno de glow interior */
  border: 1px solid rgba(212,168,67,0.08);
  box-shadow:
    /* Glow exterior sutil */
    0 0 30px rgba(212,168,67,0.03),
    /* Sombra profunda */
    0 16px 64px rgba(0,0,0,0.7),
    /* Borde interior luminoso (top edge) */
    inset 0 1px 0 rgba(255,255,255,0.04),
    /* Glow interior muy sutil */
    inset 0 0 20px rgba(212,168,67,0.02);
  
  /* Blur más fuerte */
  backdrop-filter: blur(32px) saturate(1.6) brightness(0.95);
  
  /* Bordes más redondeados */
  border-radius: 14px;
  
  /* Transición de materialización */
  animation: materialize 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes materialize {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(4px);
    backdrop-filter: blur(0px);
    border-color: rgba(212,168,67,0.30);
    box-shadow: 0 0 40px rgba(212,168,67,0.15);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    backdrop-filter: blur(32px);
    border-color: rgba(212,168,67,0.08);
    box-shadow: 0 0 30px rgba(212,168,67,0.03), 0 16px 64px rgba(0,0,0,0.7);
  }
}
```

La animación de **materialización** hace que cada panel aparezca con un flash dorado que se desvanece — como si se forjara frente a tus ojos.

### 22.9 Selection Halo — El Objeto Brilla

Cuando seleccionas un objeto en el viewport:

1. **Outline glow**: Post-process pass que dibuja un outline dorado alrededor del objeto (2px, `#d4a843`, blur 6px).
2. **Fresnel boost**: El shader de ray marching aumenta el término Fresnel del objeto seleccionado → brilla más en los bordes.
3. **Ambient particles**: Partículas sutiles de polvo dorado flotan alrededor del objeto seleccionado (30-50 partículas, vida 1-3s, opacidad 0.1-0.3).
4. **Ground shadow**: Sombra suave del objeto en el grid, con un tinte dorado.

Esto transforma "seleccionar un cubo" en una **experiencia sensorial**. No es cosmético — te ayuda a ver EXACTAMENTE qué está seleccionado en escenas complejas.

### 22.10 Modos de Trabajo — Espacios Distintos

> Cuando cambias de Design a Simulate, la interfaz CAMBIA. No es el mismo espacio con más botones.

| Modo | Color del Mode Indicator | Tool Strip | Viewport | Panels Especiales |
|------|-------------------------|-----------|---------|-------------------|
| **DESIGN** | Dorado `#d4a843` | Sketch, Create, Modify | Normal: objetos con cotas | Ninguno |
| **SKETCH** | Ámbar `#f59e0b` | Line, Arc, Rect, Trim, Dim, Constrain | Plano 2D resaltado, grid más visible, resto en wireframe tenue | Constraint panel (bottom) |
| **SIMULATE** | Azul `#3b82f6` | Structural, Thermal, CFD, Modal | Colormaps sobre geometría, cut-planes, streamlines | Sim Setup panel (right), Legend (left) |
| **CAM** | Verde `#22c55e` | Setup, Toolpath, Verify, Post | Stock + toolpaths animados, machine envelope wireframe | Tool Library (right), Op list (left) |
| **LEARN** | Violeta `#a78bfa` | Módulos, Retos, Sandbox | Split: teoría izq + viewport der | Lesson panel (left), Equation overlay |

La transición entre modos es una **animación de 400ms** donde:
1. El color del viewport background cambia sutilmente (tint del modo).
2. Los paneles anteriores se disuelven.
3. Los paneles nuevos se materializan.
4. El Mode Indicator en top-center hace un flash del color del modo.

### 22.11 Matar el Timeline — Reemplazar con Operation Stack

> El timeline de Fusion 360 tiene sentido en B-Rep donde cada feature depende de la anterior.
> En F-Rep, el árbol CSG ES la historia. No necesitamos una timeline separada.

**Reemplazo: Operation Stack** — Un breadcrumb vertical en el bottom-left que muestra los últimos 3-5 cambios:

```
  Últimas acciones:
  ├─ Extrude 45mm         [↶ undo]
  ├─ Subtract cylinder    [↶ undo]
  └─ Fillet R2            [↶ undo]
```

- Ocupa mínimo espacio (3 líneas de texto).
- Click en "undo" deshace ESA acción específica.
- Se colapsa a solo el último cambio después de 3s sin interacción.
- Ctrl+Z sigue funcionando igual.

### 22.12 Tool Strip — Diseño Visual

```
┌─────┐
│  ⊘  │ ← Select (tenue cuando no hover)
│─────│
│  ✎  │ ← Sketch → al hover expande sub-strip horizontal
│─────│
│  ⬡  │ ← Create
│─────│
│  ⚙  │ ← Modify
│─────│
│  ▶  │ ← Simulate
│─────│
│  ⚡  │ ← Manufacture
└─────┘

Tamaño: 48px ancho, iconos 20px, padding 14px
Background: rgba(3,3,5,0.40) con blur
Border: none (solo 1px right border tenue)
Hover en icono: glow dorado + expand horizontal con sub-opciones
Modo activo: icono con color del modo + dot indicator
```

### 22.13 Viewport Background — No Más Gris Plano

El viewport background actual es un color sólido oscuro. Propuesta:

1. **Gradient radial sutil**: Centro ligeramente más claro que bordes. Como un spotlight apuntando al centro de la escena.
2. **Grid con perspectiva**: El grid actual es bueno. Añadir líneas de grid que se desvanecen con la distancia (ya probablemente lo hace).
3. **Ambient particles**: 50-100 partículas de polvo microscópicas flotando lentamente. Casi invisibles (opacidad 0.02-0.05). Dan profundidad y vida.
4. **Vignette**: Oscurecimiento sutil en los bordes del viewport. Dirige la mirada al centro.

### 22.14 Typography Hierarchy

| Nivel | Font | Size | Weight | Color | Uso |
|-------|------|------|--------|-------|-----|
| **H0** | Inter | 10px | 700 | `--c-gold` | Mode indicator: "DESIGN", "SIMULATE" |
| **H1** | Inter | 13px | 600 | `--c-text-1` | Títulos de paneles flotantes |
| **H2** | Inter | 11px | 500 | `--c-text-2` | Labels de secciones |
| **Data** | JetBrains Mono | 13px | 500 | `--c-text-1` | Números: dimensiones, valores, cotas |
| **Data-sm** | JetBrains Mono | 11px | 400 | `--c-text-2` | Valores secundarios, unidades |
| **Caption** | Inter | 10px | 400 | `--c-text-3` | Hints, shortcuts, status |
| **Micro** | Inter | 9px | 400 | `--c-text-4` | Counters, badges diminutos |

### 22.15 Micro-Interacciones Que Importan

| Acción | Feedback Visual | Feedback Audio |
|--------|----------------|---------------|
| Hover sobre objeto en viewport | Outline tenue aparece (0.3 opacity) | — |
| Click para seleccionar | Outline → glow completo + halo + cotas aparecen | Click suave (ya existe) |
| Drag para mover | Ghost del objeto en posición original + líneas guía | — |
| Crear primitiva | Flash de materialización dorado en el punto de creación | Create sound (ya existe) |
| Boolean subtract | Flash rojo en la zona de corte, luego se desvanece | Cut/delete sound |
| Undo | El objeto restaurado hace un flash inverso (de 0 a 1 opacidad) | Undo sound (ya existe) |
| Cambio de modo | Transición de color ambiental 400ms + flash en mode badge | Mode transition chime (NUEVO) |
| Error de constraint | Shake del elemento 50ms + flash rojo | Error beep (ya existe) |
| Export completado | Toast con progress bar que se llena de dorado | Complete chime (ya existe) |
| Hover sobre cota | Cota se ilumina + línea de extensión se resalta | — |
| Editar cota | Input aparece con glow + las líneas de extensión pulsan | — |

### 22.16 Comparación Visual: Antes vs Después

```
ANTES (actual):
┌─ Header: [Logo] SKETCH SOLID SURFACE METAL CONSTRUCT INSPECT INSERT ASSEMBLE [Search] [Export] ─┐
├─ Tree ─├──────────────── Viewport ──────────────────┤─ Properties panel ──┤
│ ▾ Root │                                             │ Posición X: [___]  │
│   ● S1 │                                             │ Posición Y: [___]  │
│   ■ B1 │         (modelo 3D)                         │ Posición Z: [___]  │
│   ◆ C1 │                                             │ Radio:      [___]  │
│        │                                             │ Altura:     [___]  │
├────────┴─────────────────────────────────────────────┴────────────────────┤
│ Timeline: ◉ ─── ◆ ─── ◆ ─── ◆ ─── ◆ ─── ► [↶] [↷]                     │
└──────────────────────────────────────────────────────────────────────────┘

DESPUÉS (propuesta):
┌──────────────────────────────────────────────────────────────────────────┐
│  [⊘]                    ◆ DESIGN                                 [⊞]  │
│  [✎]   Root > Module1              ┌─────────────┐                     │
│  [⬡]                               │  ↕ 45.0mm   │                     │
│  [⚙]                    ┌──────────┤  Cilindro   ├──────────┐         │
│  [▶]                    │          │  Steel 4140  │          │         │
│  [⚡]                    │          └─────────────┘          │         │
│                         │             ↔ 12.0mm               │         │
│                         └────────────────────────────────────┘         │
│                               [∪ Unir] [∖ Restar] [✕]                 │
│                                                                        │
│                                                                        │
│                                                                        │
│  Extrude 45mm [↶]                                                      │
│  16 piezas · 34.2 cm³ · 0.27 kg                    60fps · high       │
└──────────────────────────────────────────────────────────────────────────┘
```

El espacio visual se DUPLICA. El usuario se enfoca en la geometría, no en la interfaz.

### 22.17 Prioridad de Implementación — UI

| # | Cambio | Impacto Visual | Esfuerzo | Sprint |
|---|--------|---------------|----------|--------|
| 1 | **Matar menubar** → Tool Strip vertical | ⭐⭐⭐⭐⭐ | Medio | 1 |
| 2 | **Matar timeline** → Operation Stack | ⭐⭐⭐⭐ | Bajo | 1 |
| 3 | **Matar scene tree** → Breadcrumb + Omnibar | ⭐⭐⭐⭐ | Medio | 1 |
| 4 | **Glass v2** (materialización + glow) | ⭐⭐⭐⭐⭐ | Bajo | 1 |
| 5 | **Selection Halo** (outline + Fresnel boost) | ⭐⭐⭐⭐⭐ | Medio | 2 |
| 6 | **Inspector HUD** (propiedades pegadas al objeto) | ⭐⭐⭐⭐⭐ | Alto | 2 |
| 7 | **Colores v2** (más negro + gold más vivo) | ⭐⭐⭐ | Bajo | 1 |
| 8 | **Inline Dimensions** (cotas 3D editables) | ⭐⭐⭐⭐⭐ | Alto | 3 |
| 9 | **Mode transitions** (Design→Sim→CAM) | ⭐⭐⭐⭐ | Medio | 3 |
| 10 | **Viewport atmosphere** (gradient + vignette + particles) | ⭐⭐⭐ | Bajo | 2 |
| 11 | **Ambient particles on selection** | ⭐⭐⭐ | Bajo | 2 |
| 12 | **Mode indicator** top-center badge | ⭐⭐⭐ | Bajo | 1 |
| 13 | **Marking Menu v2** (rayos de energía) | ⭐⭐⭐ | Medio | 3 |
| 14 | **Sim overlay panel** (right slide) | ⭐⭐⭐⭐ | Medio | 3 |

### 22.18 CSS Architecture — Qué Cambia

| Archivo | Qué Cambiar |
|---------|------------|
| `main.css` | Nuevos tokens de color, `.forge-glass-v2`, animación `materialize`, `.tool-strip`, `.mode-indicator`, `.operation-stack`, `.inline-dim`, particle keyframes |
| `ForgePage.tsx` | Eliminar `<header>` menubar completo, eliminar `<aside>` tree sidebar, eliminar `<Timeline>`, añadir `<ToolStrip>`, `<ContextBreadcrumb>`, `<ModeIndicator>`, `<OperationStack>` |
| `ForgeViewport.tsx` | Añadir post-process selection outline pass, vignette, ambient gradient |
| `RayMarchMesh.tsx` | Uniform para selección: boost Fresnel, añadir outline data a output |
| NUEVO: `ToolStrip.tsx` | Componente: columna vertical 48px, iconos, expand-on-hover |
| NUEVO: `InlineDimension.tsx` | Componente: Html overlay en espacio 3D anclado a SDF bounding box |
| NUEVO: `InspectorHUD.tsx` | Componente: panel flotante anclado a objeto seleccionado |
| NUEVO: `ModeIndicator.tsx` | Componente: badge top-center con modo actual |
| NUEVO: `OperationStack.tsx` | Componente: últimas 3-5 acciones con undo individual |
| NUEVO: `ContextBreadcrumb.tsx` | Componente: breadcrumb de navegación top-left |
| `MarkingMenu.tsx` | Visual v2: líneas de energía, glow en iconos |
| `Omnibar.tsx` | Visual v2: glass más profundo, materialización |

### 22.19 Lo Que NO Cambia

- **Omnibar** (⌘K) — concepto correcto, solo mejora visual
- **Keyboard shortcuts** — todos se mantienen
- **Drag & Drop import** — se mantiene
- **Audio feedback** — se mantiene y se extiende
- **Variable system** — concepto se mantiene, migra a variable bar v2
- **Marking Menu** — concepto correcto, solo mejora visual
- **Zustand store** — sin cambios en estado
- **SDF engine** — sin cambios
- **Ray marcher** — solo se añade selection pass

### 22.20 Resumen: De Genérico a Divino

| Antes | Después |
|-------|---------|
| Menubar con 8 menús | Tool Strip con 6 iconos + Omnibar |
| Scene tree sidebar permanente | Breadcrumb mínimo + Omnibar search |
| Properties panel en sidebar | Inspector HUD flotante anclado al objeto |
| Timeline horizontal | Operation Stack (3 líneas de texto) |
| Viewport ocupa ~70% de pantalla | Viewport ocupa **100%** de pantalla |
| Selección = highlight de color | Selección = halo + glow + Fresnel + particles |
| Dimensiones en campos de input | Cotas 3D inline editables sobre la geometría |
| Un solo modo visual para todo | 5 modos con transición de color y paneles distintos |
| Paneles aparecen instantáneamente | Paneles se **materializan** con flash dorado |
| Se ve como Fusion 360 con otro color | Se ve como un artefacto de civilización avanzada |

---

*Documento vivo. Actualizar conforme avancemos.*
*La Forja de Hefestos — Hecho en México 🇲🇽*
*"La única herramienta del mundo donde diseñas la pieza, cotizas los materiales, simulas la fábrica, programas el robot, flasheas la placa, y APRENDES física, química e ingeniería — sin salir."*
