# ⚒️ La Forja de Hefestos

> CAD/CAM paramétrico de código abierto con motor F-Rep (Function Representation).
> Variables-first · GPU ray marching · Simulación integrada · Hecho en México 🇲🇽

---

## Qué Es

La Forja de Hefestos es una plataforma de diseño paramétrico que usa **F-Rep/SDF** en lugar de B-Rep.
Cada forma es una función matemática `f(x,y,z)` — la superficie existe donde `f = 0`.

Esto significa:
- **Booleanas triviales**: unión = `min(a,b)`, resta = `max(a,-b)`
- **Fillets gratis**: `smoothMin(a, b, k)` = redondeo automático
- **Resolución infinita**: sin mallas que reparar
- **GPU-nativo**: el shader evalúa `f(x,y,z)` por píxel

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **UI** | React 19 + TypeScript + Tailwind CSS v4 |
| **3D** | Three.js vía @react-three/fiber + @react-three/drei |
| **Geometría** | Motor SDF propio (TypeScript) → Marching Cubes (Web Worker) → BufferGeometry |
| **Estado** | Zustand con historial undo/redo |
| **Build** | Vite 6 |
| **Componentes UI** | shadcn/ui (menubar, tooltip, command, dialog) |

## Inventario de Código (Marzo 2026)

### Archivos Principales — 18,574 líneas TS/TSX

| Archivo | Líneas | Descripción |
|---------|--------|-------------|
| `ForgePage.tsx` | 2,278 | Interfaz principal completa |
| `formulas.ts` | 1,457 | Base de datos de materiales + fórmulas de ingeniería (Timoshenko, Von Mises, Fourier, etc.) |
| `useForgeStore.ts` | 1,102 | Store Zustand — scene graph, historial, variables, import/export |
| `gpu-cross-section.ts` | 1,090 | Secciones transversales aceleradas por GPU |
| `reverse-engineer.ts` | 897 | Ingeniería inversa: modelo importado → primitivas SDF |
| `sketch-fitting.ts` | 789 | Ajuste de sketches a secciones transversales |
| `cross-section.ts` | 765 | Pipeline de secciones transversales CPU |
| `feature-recognition.ts` | 675 | Reconocimiento de features geométricas |
| `BlueprintPanel.tsx` | 590 | Panel de planos técnicos interactivo |
| `machine-config.ts` | 555 | Parser de configuraciones de máquinas CNC (.mch) |
| `sdf-engine.ts` | 524 | Motor SDF: primitivas, operaciones, compilador GLSL |
| `mc-worker.ts` | 503 | Marching Cubes en Web Worker |
| `stl-export.ts` | 475 | Exportación STL |
| `profile-to-sdf.ts` | 460 | Conversión de perfiles 2D a campo SDF |
| `step-import.ts` | 437 | Importación STEP/IGES vía occt-import-js |
| `gaia-variables.ts` | 392 | Sistema de variables paramétricas con expresiones |
| `blueprint-export.ts` | 372 | Exportación de planos SVG |
| `RayMarchMesh.tsx` | 366 | Renderer GPU ray marching — visualización SDF pixel-perfect |
| `ForgeViewport.tsx` | 339 | Canvas Three.js con grid, ViewCube, controles |
| `Omnibar.tsx` | 339 | Búsqueda universal estilo Spotlight (⌘K) |
| `sdf-cpu.ts` | 242 | Evaluador SDF en CPU para picking/selección |
| `forge-audio.ts` | 237 | Sistema de audio: clicks, creates, deletes, undos |
| `simulation.ts` | 212 | Estadísticas de escena y simulación cinemática |
| `sketch-engine.ts` | 114 | Motor de sketch 2D (rect, circle, extrude) |

### Componentes UI (shadcn + custom)

| Componente | Descripción |
|-----------|-------------|
| `MarkingMenu` | Menú radial contextual (clic derecho) |
| `Omnibar` | Paleta de comandos universal |
| `ShortcutOverlay` | Grid de atajos rápidos (tecla S) |
| `Timeline` | Línea de tiempo de historial |
| `SketchPanel` | Panel de herramientas de sketch |
| `BlueprintPanel` | Visualizador de planos técnicos |
| `CommandPalette` | Paleta de comandos |
| `ToolbarDropdown` | Dropdowns de la barra de herramientas |
| shadcn: `menubar`, `tooltip`, `dialog`, `command`, `button`, `input`, `dropdown-menu` | Componentes base |

### Scripts de Prueba — 13,759 líneas CJS

16 scripts de validación y prueba para pipeline geométrico, sketch fitting, secciones transversales, etc.

### Modelos de Prueba

| Set | Cantidad | Origen |
|-----|----------|--------|
| Archivos STEP (NIST) | 38 | NIST D2MI, PMI, MTC Assembly |
| Configuraciones de máquinas (.mch) | 8 | Haas, Hurco, DATRON, Brother, GROB |
| Datos de visualización (JSON) | 38 | Planos extraídos de modelos NIST |

## Features Implementados ✅

- **6 primitivas SDF**: Esfera, Caja, Cilindro, Toroide, Cono, Cápsula
- **4 operaciones booleanas**: Unión, Resta, Intersección, Smooth Union
- **GPU ray marching**: visualización pixel-perfect a 60fps
- **Marching Cubes**: meshing en Web Worker con LOD adaptativo (64³→512³)
- **Sistema de variables**: variables con nombre, expresiones, dependencias, barra de variables
- **Importación STEP/IGES**: vía occt-import-js con descomposición de ensambles
- **Exportación STL**: con resolución configurable
- **Exportación SVG**: planos técnicos con vistas ortogonales
- **Ingeniería inversa**: descomposición de modelos importados en primitivas SDF
- **CT-Scan**: secciones transversales multi-eje para análisis de geometrías
- **GPU plane fitting**: detección de planos guiada por geometría
- **Sketch 2D**: rect + circle en planos XY/XZ/YZ con extrusión
- **Face picking**: selección de cara mediante CPU ray march → sketch en cara
- **Módulos/Grupos**: organización jerárquica del scene graph
- **Parser de máquinas CNC**: 8 máquinas reales parseadas (Haas VF-2, EC-630, VS-3, Hurco BX40i, DATRON Neo, Brother M300X3, GROB G350, Bambu Lab P1P)
- **Base de datos de materiales**: 20+ materiales con propiedades mecánicas/térmicas completas
- **Fórmulas de ingeniería**: elasticidad, Von Mises, FEA tetraédrica, térmica, fluidos, fatiga
- **Undo/Redo**: historial completo con Ctrl+Z/Y
- **Búsqueda universal** (⌘K): comandos, primitivas, booleanas, vistas, materiales, máquinas
- **Menú radial**: clic derecho contextual
- **Atajos de teclado**: numpad para vistas, 1-5 para primitivas, S para shortcuts
- **Audio feedback**: sonidos sutiles para cada acción
- **Drag & Drop**: importar archivos arrastrando al viewport
- **Vista de sección**: corte por plano con eje/distancia configurable
- **Plano técnico interactivo**: panel Blueprint con extracción de vistas

## Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (puerto 5001)
npm run dev

# Build de producción
npm run build
```

## Arquitectura de Documentación

| Documento | Qué Contiene |
|-----------|-------------|
| [GAIA_FORGE_SPEC.md](GAIA_FORGE_SPEC.md) | Especificación técnica: identidad, variables, UI, data model, file format |
| [LA_FORJA_V2_PLAN.md](LA_FORJA_V2_PLAN.md) | Plan maestro: análisis de Fusion 360, roadmap completo, workspaces, simulaciones, CAM, robótica, IDE |
| [FUSION360_DESIGN_FUNCTIONS.md](FUSION360_DESIGN_FUNCTIONS.md) | Referencia de funciones de diseño de Fusion 360 |

## Estado del Tema Visual (Marzo 2026)

**Tema actual**: "Oro Divino" — fondo void black + acentos dorados.

**Diagnóstico**: El tema funciona conceptualmente pero los fondos son **demasiado negros** (`#08090d` base).
La sección 22 del Plan Maestro documenta una propuesta de rediseño completo de UI ("Forjado por Dioses")
que incluye viewport al 100%, Tool Strip, Inspector HUD, Inline Dimensions y eliminación de la menubar.

**Paleta actual vs especificación**:

| Token | CSS actual | Spec (GAIA_FORGE_SPEC §4.2) | Nota |
|-------|-----------|------------------------------|------|
| Base | `#08090d` | `#12151c` | CSS es más oscuro que la spec |
| Surface | `#0d0f14` | `#1a1e2a` | CSS es más oscuro que la spec |
| Raised | `#1e2230` | `#1e2230` | ✅ Coincide |
| Gold | `#c9a84c` | — | Definido en CSS, no en spec original |
| Text primary | `#f0ece4` | `#c8cdd8` | CSS es más cálido/dorado |
| Text secondary | `#8a7e6b` | `#6b7394` | CSS es más cálido/dorado |

**Próximo paso**: Ajustar la paleta para que sea oscura pero con más profundidad navy (no void black).

---

*La Forja de Hefestos — Hecho en México 🇲🇽*
*"Todo es una variable. Todo es una función. Todo se forja."*
