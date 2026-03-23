# Fusion 360 — Área de Diseño: Todas las Funciones
## Referencia completa para La Forja de Hefestos

> **Objetivo**: Documentar CADA función del workspace "Design" de Fusion 360, su propósito, inputs, y cómo la implementaríamos en La Forja.
> Organizado exactamente como aparece en la toolbar de Fusion 360.

---

## 📐 1. SKETCH (Boceto 2D)

El Sketch es la **base de todo** en Fusion 360. Antes de crear cualquier sólido, dibujas un perfil 2D en un plano o cara, y luego lo extruyes/revolucionas/barres.

### 1.1 Crear Sketch

| Función | Propósito | Inputs | Estado en La Forja |
|---------|-----------|--------|-------------------|
| **Create Sketch** | Inicia modo sketch en un plano o cara seleccionada | Plano (XY/XZ/YZ) o cara de un cuerpo | ✅ Básico (planos) |
| **Finish Sketch** | Cierra el modo sketch y vuelve al 3D | — | ✅ |

### 1.2 Herramientas de Dibujo (Sketch > Create)

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Line** | Dibuja líneas rectas conectadas punto a punto. Base de casi todo perfil. | Punto inicio → Punto fin (encadenables) | 🔴 CRÍTICA |
| **Rectangle** → Center | Rectángulo desde centro + esquina | Centro + esquina | ✅ Implementado |
| **Rectangle** → 2-Point | Rectángulo definido por 2 esquinas opuestas | Esquina 1 + Esquina 2 | 🔴 CRÍTICA |
| **Rectangle** → 3-Point | Rectángulo rotado, definido por 3 puntos | Base start → Base end → Ancho | 🟡 Media |
| **Circle** → Center Diameter | Círculo por centro + radio/diámetro | Centro + Radio | ✅ Implementado |
| **Circle** → 2-Point | Círculo definido por 2 puntos diametralmente opuestos | Punto 1 + Punto 2 | 🟡 Media |
| **Circle** → 3-Point | Círculo que pasa por 3 puntos arbitrarios | P1 + P2 + P3 | 🟡 Media |
| **Circle** → 2-Tangent | Círculo tangente a 2 líneas | Línea 1 + Línea 2 + Radio | 🟢 Baja |
| **Arc** → 3-Point | Arco de círculo por 3 puntos | Inicio + Mid + Fin | 🔴 CRÍTICA |
| **Arc** → Center Point | Arco desde centro + inicio + barrido angular | Centro + Inicio + Ángulo | 🟡 Media |
| **Arc** → Tangent | Arco tangente al final de otra curva | Punto previo + Punto final | 🟡 Media |
| **Polygon** → Circumscribed | Polígono regular inscrito en círculo | Centro + Radio + N lados | 🟡 Media |
| **Polygon** → Inscribed | Polígono regular circunscrito a círculo | Centro + Radio + N lados | 🟡 Media |
| **Polygon** → Edge | Polígono definido por un borde | Punto 1 + Punto 2 + N lados | 🟢 Baja |
| **Ellipse** | Elipse por centro + eje mayor + eje menor | Centro + Eje A + Eje B | 🟡 Media |
| **Slot** → Center to Center | Ranura/oblongo (2 semicírculos + rectángulo) | Centro 1 + Centro 2 + Ancho | 🟡 Media |
| **Slot** → Overall | Ranura definida por longitud total | Punto 1 + Punto 2 + Ancho | 🟡 Media |
| **Slot** → Center Point | Ranura desde un punto central | Centro + Dirección + Longitud + Ancho | 🟢 Baja |
| **Spline** → Fit Point | Curva suave que pasa por puntos dados | Serie de puntos | 🔴 CRÍTICA |
| **Spline** → Control Point | Curva B-spline controlada por polos (no pasa por ellos) | Serie de puntos de control | 🟡 Media |
| **Conic Curve** | Curva cónica (entre línea y arco) con parámetro rho | Inicio + Fin + Tangentes + rho | 🟢 Baja |
| **Point** | Punto de construcción en el sketch | Posición | 🟡 Media |
| **Text** | Texto como perfil extruible (tipografía → contornos) | String + Font + Tamaño + Posición | 🟢 Baja |

### 1.3 Herramientas de Modificación de Sketch (Sketch > Modify)

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Fillet** | Redondea una esquina de sketch con arco tangente | Esquina + Radio | 🔴 CRÍTICA |
| **Chamfer** | Corta una esquina en línea recta (bisel) | Esquina + Distancia(s) | 🔴 CRÍTICA |
| **Trim** | Elimina un segmento de curva entre intersecciones | Clic sobre el segmento a borrar | 🔴 CRÍTICA |
| **Extend** | Extiende una curva hasta la siguiente intersección | Clic sobre extremo a extender | 🟡 Media |
| **Break** | Rompe una curva en un punto dado (2 segmentos) | Curva + Punto de corte | 🟡 Media |
| **Offset** | Crea una copia paralela de una curva/perfil a distancia dada | Curvas + Distancia | 🔴 CRÍTICA |
| **Mirror** | Refleja entidades de sketch sobre una línea eje | Entidades + Línea espejo | 🔴 CRÍTICA |
| **Circular Pattern** | Repite entidades en patrón circular | Entidades + Centro + N copias + Ángulo | 🟡 Media |
| **Rectangular Pattern** | Repite entidades en cuadrícula | Entidades + Dir1 + Dir2 + N1×N2 + Espac. | 🟡 Media |
| **Move/Copy** | Desplaza o copia entidades de sketch | Entidades + Vector/Rotación | 🟡 Media |
| **Scale** | Escala entidades de sketch | Entidades + Punto base + Factor | 🟡 Media |
| **Change Parameters** | Edita dimensiones/restricciones numéricamente | Selección + Nuevo valor | 🔴 CRÍTICA |

### 1.4 Restricciones de Sketch (Sketch > Constraints)

**Esto es lo que hace a Fusion 360 PARAMÉTRICO.** Cada restricción es una ecuación que el solver mantiene.

| Restricción | Propósito | Prioridad |
|------------|-----------|-----------|
| **Coincident** | Fuerza 2 puntos a coincidir (o punto sobre curva) | 🔴 CRÍTICA |
| **Horizontal** | Fuerza una línea a ser horizontal | 🔴 CRÍTICA |
| **Vertical** | Fuerza una línea a ser vertical | 🔴 CRÍTICA |
| **Perpendicular** | 2 líneas a 90° | 🔴 CRÍTICA |
| **Parallel** | 2 líneas con misma dirección | 🔴 CRÍTICA |
| **Tangent** | Curva tangente a otra curva (continuidad G1) | 🔴 CRÍTICA |
| **Equal** | 2 entidades con misma dimensión (ej: 2 líneas = misma longitud) | 🔴 CRÍTICA |
| **Symmetric** | 2 puntos simétricos respecto a línea eje | 🟡 Media |
| **Concentric** | 2 arcos/círculos con mismo centro | 🟡 Media |
| **Collinear** | 2 líneas en la misma recta infinita | 🟡 Media |
| **Midpoint** | Punto en el punto medio de una línea | 🟡 Media |
| **Fix/Unfix** | Bloquea posición de una entidad (ya no se mueve con el solver) | 🔴 CRÍTICA |
| **Smooth (G2)** | Continuidad de curvatura entre splines | 🟢 Baja |

### 1.5 Dimensiones de Sketch (Sketch > Dimension)

| Función | Propósito | Prioridad |
|---------|-----------|-----------|
| **Sketch Dimension** | Dimensión inteligente — detecta automáticamente qué medir (distancia, radio, ángulo) según lo seleccionado. Es LA herramienta paramétrica. | 🔴 CRÍTICA |

> **Nota del usuario**: *"Fusion es muy malo para parametrizar y designar variables"* — Esto es donde La Forja puede ser MEJOR. Propuesta: sistema de variables con nombres, fórmulas, y referencias cruzadas tipo spreadsheet.

---

## 🧊 2. SOLID (Crear Sólidos 3D)

### 2.1 Create (Crear formas 3D)

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Extrude** | Extruye un perfil 2D a lo largo de su normal. LA operación más usada en CAD. Soporta: distancia, simétrico, hasta objeto, hasta cara, "all". Puede cortar (cut), unir (join), o crear nuevo cuerpo. | Perfil + Distancia + Dirección + Operación (Join/Cut/Intersect/New Body) | 🔴 CRÍTICA (✅ básico) |
| **Revolve** | Gira un perfil 2D alrededor de un eje para crear sólidos de revolución (cilindros, botellas, vasos, tornillos). | Perfil + Eje + Ángulo (parcial o 360°) | 🔴 CRÍTICA |
| **Sweep** | Barre un perfil 2D a lo largo de una curva guía (trayectoria). Para tubos, cables, molduras. | Perfil + Path + Orientación (normal/paralelo) | 🔴 CRÍTICA |
| **Loft** | Crea un sólido que transiciona suavemente entre 2+ perfiles en diferentes planos. Para formas aerodinámicas, botellas, carcasas. | Perfil 1 + Perfil 2 [+ Perfil N] + Guías opcionales | 🔴 CRÍTICA |
| **Rib** | Crea un nervio/refuerzo estructural (pared delgada entre 2 caras). Muy usado en piezas plásticas inyectadas. | Sketch line + Dirección + Espesor | 🟡 Media |
| **Web** | Similar a Rib pero crea una red/malla de refuerzo | Sketch + Dirección + Espesor | 🟢 Baja |
| **Hole** | Wizard de agujeros: simple, roscado, avellanado, escariado. Con tabla de roscas estándar (M3, M4, 1/4-20…). | Punto(s) + Tipo + Diámetro + Profundidad + Rosca | 🔴 CRÍTICA |
| **Thread** | Añade rosca cosmética o modelada a un cilindro existente | Cara cilíndrica + Tipo rosca + Pitch | 🟡 Media |
| **Box** | Primitiva caja (atajo: sketch rect + extrude) | Posición + Dimensiones | ✅ Implementado |
| **Cylinder** | Primitiva cilindro | Posición + Radio + Altura | ✅ Implementado |
| **Sphere** | Primitiva esfera | Centro + Radio | ✅ Implementado |
| **Torus** | Primitiva toroide | Centro + R mayor + R menor | ✅ Implementado |
| **Coil** | Genera hélice/resorte (spring). Para resortes, roscas exteriores. | Eje + Radio + Pitch + Turns + Sección | 🟡 Media |
| **Pipe** | Tubo a lo largo de una trayectoria 3D | Path + Sección (circular/cuadrada) + Dimensiones | 🟡 Media |
| **Pattern** → Rectangular | Repite un feature en cuadrícula 3D | Feature + Dir1 + Dir2 + N1×N2 + Espac. | 🔴 CRÍTICA |
| **Pattern** → Circular | Repite un feature alrededor de un eje | Feature + Eje + N copias + Ángulo total | 🔴 CRÍTICA |
| **Pattern** → On Path | Repite un feature a lo largo de una curva | Feature + Path + N copias + Espac. | 🟡 Media |
| **Mirror** | Refleja features/cuerpos respecto a un plano | Features + Plano espejo | 🔴 CRÍTICA |

### 2.2 Modify (Modificar sólidos)

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Fillet** | Redondea aristas con radio constante o variable. LA operación de acabado más usada. | Arista(s) + Radio(s) | 🔴 CRÍTICA |
| **Chamfer** | Bisel en aristas (corte plano en vez de redondeo) | Arista(s) + Distancia(s) + Ángulo | 🔴 CRÍTICA |
| **Shell** | Vacía un sólido dejando paredes de espesor dado. Para carcasas, contenedores. | Cuerpo + Caras a remover + Espesor pared | 🔴 CRÍTICA |
| **Draft** | Aplica ángulo de desmoldeo a caras (para inyección de plástico) | Cara(s) + Plano de partición + Ángulo | 🟡 Media |
| **Scale** | Escala un cuerpo uniformemente o por ejes | Cuerpo + Factor(es) + Punto base | 🟡 Media |
| **Combine** | Operaciones booleanas entre cuerpos: Join (unión), Cut (resta), Intersect | Cuerpo target + Cuerpo tool + Operación | ✅ Implementado (CSG) |
| **Replace Face** | Reemplaza una cara de un sólido con otra superficie | Cara original + Superficie nueva | 🟢 Baja |
| **Split Face** | Divide una cara en 2 usando una línea/plano de corte | Cara + Herramienta de corte | 🟡 Media |
| **Split Body** | Corta un cuerpo en 2+ cuerpos separados | Cuerpo + Herramienta de corte | 🟡 Media |
| **Silhouette Split** | Divide un cuerpo por su silueta vista desde una dirección | Cuerpo + Dirección | 🟢 Baja |
| **Move/Copy** | Mueve o copia cuerpos/componentes | Cuerpo + Transformación (traslación/rotación/punto a punto) | ✅ Básico |
| **Align** | Alinea un cuerpo a otro por caras/aristas/puntos | Origen + Destino | 🟡 Media |
| **Physical Material** | Asigna material (acero, aluminio, ABS…) con propiedades físicas | Cuerpo + Material de biblioteca | 🟡 Media |
| **Manage Materials** | Editor de materiales personalizados (densidad, color, textura) | — | 🟢 Baja |
| **Change Parameters** | Abre el editor de parámetros/variables del modelo completo | — | 🔴 CRÍTICA |

---

## 🔧 3. CONSTRUCT (Geometría de Construcción)

Estos NO son sólidos — son planos, ejes y puntos auxiliares que sirven de referencia para otras operaciones.

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Offset Plane** | Plano paralelo a otro a distancia dada | Plano base + Distancia | 🔴 CRÍTICA |
| **Plane at Angle** | Plano rotado respecto a una arista | Arista + Ángulo | 🟡 Media |
| **Tangent Plane** | Plano tangente a una superficie en un punto | Cara + Punto | 🟡 Media |
| **Midplane** | Plano equidistante entre 2 caras paralelas | Cara 1 + Cara 2 | 🟡 Media |
| **Plane Through 2 Edges** | Plano definido por 2 líneas | Arista 1 + Arista 2 | 🟢 Baja |
| **Plane Through 3 Points** | Plano que pasa por 3 puntos | P1 + P2 + P3 | 🟡 Media |
| **Plane Along Path** | Plano normal a una curva en un punto dado | Path + Distancia/Parámetro | 🟢 Baja |
| **Axis Through Cylinder** | Eje central de una cara cilíndrica | Cara cilíndrica | 🟡 Media |
| **Axis Through 2 Points** | Eje definido por 2 puntos | P1 + P2 | 🟡 Media |
| **Axis Perpendicular at Point** | Eje normal a una cara en un punto | Cara + Punto | 🟢 Baja |
| **Point at Vertex** | Punto en un vértice existente | Vértice | 🟡 Media |
| **Point Through 2 Edges** | Punto en la intersección de 2 aristas | Arista 1 + Arista 2 | 🟢 Baja |
| **Point at Center** | Punto en el centro de un arco/círculo | Arco/Círculo | 🟡 Media |
| **Point Along Path** | Punto a una distancia dada sobre una curva | Path + Distancia | 🟢 Baja |

---

## 📏 4. INSPECT (Inspeccionar/Medir)

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Measure** | Mide distancia, ángulo, área, volumen entre geometrías seleccionadas | 1 o 2 entidades | 🔴 CRÍTICA |
| **Interference** | Detecta interferencia/colisión entre 2+ cuerpos (volumen de penetración) | Cuerpos | 🟡 Media |
| **Curvature Comb** | Visualiza continuidad de curvatura en curvas (G0/G1/G2) con peines | Curva(s) | 🟢 Baja |
| **Zebra Analysis** | Mapa de cebra sobre superficies para verificar continuidad y calidad | Cara(s) | 🟢 Baja |
| **Draft Analysis** | Visualiza ángulos de desmoldeo por colores sobre caras | Cuerpo + Dirección de desmoldeo | 🟢 Baja |
| **Curvature Map** | Mapa de colores de curvatura gaussiana/media sobre superficies | Cara(s) | 🟢 Baja |
| **Section Analysis** | Corte transversal del modelo para ver interior | Plano de corte | 🔴 CRÍTICA |
| **Center of Mass** | Calcula y muestra el centro de masa | Cuerpo(s) | 🟡 Media |
| **Display Component Colors** | Colores aleatorios por componente para distinguirlos | — | 🟡 Media |

---

## 🗂 5. INSERT (Insertar/Importar)

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **Insert Derive** | Importa un cuerpo de otro archivo Fusion como referencia vinculada | Archivo + Cuerpo | 🟢 Baja |
| **Decal** | Pega una imagen sobre una cara (para branding, etiquetas) | Imagen + Cara + Posición + Escala | 🟢 Baja |
| **Insert Canvas** | Imagen de referencia en un plano (para modelar encima de un dibujo) | Imagen + Plano + Escala | 🟡 Media |
| **Insert Mesh** | Importa STL/OBJ como mesh referencia | Archivo mesh | 🟡 Media |
| **Insert SVG** | Importa SVG como perfil de sketch | Archivo SVG + Plano | 🟡 Media |
| **Insert DXF** | Importa DXF como sketch | Archivo DXF + Plano | 🟡 Media |
| **McMaster-Carr** | Catálogo de componentes estándar (tornillos, tuercas, rodamientos) | Búsqueda + Selección | 🟢 Baja |

---

## 📋 6. SELECTION & NAVIGATION

### 6.1 Modos de Selección

| Modo | Propósito | Prioridad |
|------|-----------|-----------|
| **Select** (clic) | Selecciona una entidad (cara, arista, vértice, cuerpo) | 🔴 CRÍTICA |
| **Window Select** (arrastrar) | Selecciona todo dentro de un rectángulo | 🟡 Media |
| **Paint Select** | Selecciona pasando el cursor por encima | 🟢 Baja |
| **Selection Filter** | Filtra qué tipo de entidad se puede seleccionar (solo caras, solo aristas, etc.) | 🔴 CRÍTICA |
| **Select Priority**: Body/Face/Edge/Vertex | Determina qué nivel de entidad se selecciona al hacer clic | 🔴 CRÍTICA |

### 6.2 Prioridad de Selección (Selection Priority)

Fusion 360 tiene un concepto clave: **dependiendo del contexto**, un clic selecciona diferentes cosas:
- En modo Sketch → selecciona entidades 2D
- En modo Fillet → selecciona aristas
- En modo Shell → selecciona caras
- Con "Body" priority → selecciona cuerpos completos

### 6.3 Viewport Navigation

| Acción | Control | Estado |
|--------|---------|--------|
| **Orbit** | Middle mouse / Shift+Middle | ✅ |
| **Pan** | Middle mouse + Shift | ✅ |
| **Zoom** | Scroll wheel | ✅ |
| **Zoom to Fit** | Doble-clic middle / Home key | 🟡 Media |
| **Look At** | Clic en cara → "Look At" hace que la cámara mire perpendicular a esa cara | 🟡 Media |
| **ViewCube** | Clic en caras/aristas/esquinas del cubo para orientar | ✅ |
| **Named Views** | Front, Back, Top, Bottom, Left, Right, Home | 🟡 Media |

---

## 🏗 7. ASSEMBLY (Ensamblaje)

> No es el workspace Assembly separado — Fusion maneja componentes dentro de Design.

| Función | Propósito | Inputs | Prioridad |
|---------|-----------|--------|-----------|
| **New Component** | Crea un componente hijo (sub-ensamble) | Nombre + Tipo (vacío/desde cuerpos) | 🔴 CRÍTICA |
| **Joint** | Define conexión entre 2 componentes con grados de libertad (rígido, revolución, slider, cilíndrica, bola, planar) | Componente 1 + Componente 2 + Tipo + Posición | 🔴 CRÍTICA |
| **As-Built Joint** | Joint que preserva la posición actual (sin mover componentes) | Componente 1 + Componente 2 + Tipo | 🟡 Media |
| **Joint Origin** | Define un punto/orientación de conexión en un componente | Punto + Orientación | 🟡 Media |
| **Rigid Group** | Bloquea posiciones relativas de varios componentes | Componentes | 🟡 Media |
| **Ground** | Fija un componente en el espacio (punto de anclaje del ensamble) | Componente | 🔴 CRÍTICA |
| **Motion Link** | Vincula movimiento de 2 joints (ej: engranaje) | Joint 1 + Joint 2 + Ratio | 🟢 Baja |
| **Enable/Disable Contact Sets** | Activa colisiones físicas entre componentes | — | 🟢 Baja |

---

## 📊 8. PARAMETERS (Sistema Paramétrico)

> **ÁREA DE OPORTUNIDAD CLAVE** — El usuario señala que Fusion es malo aquí. La Forja puede ser MEJOR.

### 8.1 Cómo funciona en Fusion 360

| Concepto | Descripción |
|----------|-------------|
| **User Parameters** | Variables con nombre que defines tú: `ancho = 50 mm`, `alto = ancho * 2` |
| **Model Parameters** | Dimensiones auto-generadas por cada feature (d1, d2, d3…) — nombres horribles |
| **Favorites** | Parámetros marcados para acceso rápido |
| **Change Parameters** | Diálogo modal con tabla de parámetros — poco intuitivo, no permite agrupar |
| **Expressions** | Fórmulas: `ancho + 10`, `sin(45 deg)`, `if(ancho > 50, 10, 5)` |
| **Units** | Soporta mm, cm, in, ft + conversión automática |

### 8.2 Problemas de Fusion 360 que La Forja debe resolver

| Problema | Cómo lo arreglamos |
|----------|-------------------|
| Nombres auto-generados (d1, d2…) son inútiles | **Nombres obligatorios descriptivos** al crear cada dimensión |
| No hay agrupación de parámetros | **Carpetas/categorías** de variables |
| No hay vista de dependencias | **Grafo visual** de qué parámetro afecta a qué feature |
| El diálogo es modal y feo | **Panel lateral siempre visible** con búsqueda |
| No se pueden importar/exportar params | **JSON/CSV import/export** de tabla de parámetros |
| Las fórmulas son limitadas | **JavaScript completo** como lenguaje de expresiones |
| No hay historial de cambios de params | **Timeline integrada** con cada cambio de parámetro |
| No hay presets/variantes | **Variants** — guardar configuraciones con nombre: "Versión Grande", "Versión Mini" |

---

## 🕐 9. TIMELINE (Línea de Tiempo Paramétrica)

La Timeline es el **corazón del modelado paramétrico**. Cada operación se registra como un "feature" en orden.

| Función | Propósito | Prioridad |
|---------|-----------|-----------|
| **Feature Order** | Muestra cada operación en orden cronológico | ✅ Básico |
| **Drag to Reorder** | Arrastra un feature para cambiar orden (recalcula todo) | 🔴 CRÍTICA |
| **Roll Back** | Arrastra el marcador "ahora" hacia atrás para ver estado previo | 🔴 CRÍTICA |
| **Edit Feature** | Doble-clic en un feature para editarlo con sus valores | 🔴 CRÍTICA |
| **Suppress/Unsuppress** | Desactiva temporalmente un feature sin borrarlo | 🟡 Media |
| **Delete Feature** | Elimina un feature y recalcula los siguientes | ✅ |
| **Group** | Agrupa features relacionados con nombre | 🟡 Media |
| **Feature Icons** | Cada tipo de feature tiene un ícono identificable | ✅ |
| **Error Markers** | Marca roja en features que fallan tras edición | 🟡 Media |
| **Capture Position** | Guarda posición de componentes en un punto de la timeline | 🟢 Baja |

---

## 🖥 10. UI/UX ELEMENTS

### 10.1 Browser (Panel Izquierdo)

| Sección | Contenido | Prioridad |
|---------|-----------|-----------|
| **Document Settings** | Unidades, precisión, material por defecto | 🟡 Media |
| **Named Views** | Vistas guardadas con nombre | 🟢 Baja |
| **Origin** | Planos, ejes y punto origen (XY, XZ, YZ, X, Y, Z, Origin) | ✅ Básico |
| **Bodies** | Lista de cuerpos sólidos con visibility toggle | 🔴 CRÍTICA |
| **Sketches** | Lista de sketches con editar/visibility | 🔴 CRÍTICA |
| **Construction** | Planos, ejes y puntos auxiliares | 🟡 Media |
| **Joints** | Lista de joints del ensamble | 🟢 Baja |
| **Components** | Árbol jerárquico de componentes | 🟡 Media |

### 10.2 Properties Panel (Panel Derecho)

| Sección | Contenido | Estado |
|---------|-----------|--------|
| **Selection Info** | Tipo + Nombre + ID del elemento seleccionado | ✅ |
| **Transform** | Posición XYZ + Rotación XYZ | ✅ |
| **Parameters** | Dimensiones del feature seleccionado | ✅ |
| **Material** | Material asignado + propiedades físicas | 🟡 |
| **Physical Properties** | Masa, volumen, centro de masa, inercia | ✅ Básico |

### 10.3 Toolbar Layout (Fusion 360 exact)

```
[ SOLID ▼ ]  [ SURFACE ▼ ]  [ SHEET METAL ▼ ]  [ TOOLS ▼ ]
    |              |               |                |
    ├─ Create      ├─ Create       ├─ Create        ├─ Make (3D Print)
    ├─ Modify      ├─ Modify       ├─ Modify        ├─ Inspect
    ├─ Construct   ├─ Stitch       ├─ Unfold        ├─ Add-Ins
    ├─ Inspect     ├─ UnStitch     └─ Refold        └─ Scripts
    ├─ Insert      └─ Extend
    ├─ Assemble
    └─ Select
```

---

## 🎨 11. SURFACE (Superficies)

> Workspace de superficies — dentro de Design pero con herramientas especializadas.

| Función | Propósito | Prioridad |
|---------|-----------|-----------|
| **Extrude (Surface)** | Extruye perfil como superficie (sin grosor) | 🟡 Media |
| **Revolve (Surface)** | Revoluciona perfil como superficie | 🟡 Media |
| **Sweep (Surface)** | Barre perfil como superficie | 🟡 Media |
| **Loft (Surface)** | Loft entre perfiles como superficie | 🟡 Media |
| **Patch** | Crea superficie que cierra un hueco en un borde | 🟡 Media |
| **Ruled** | Superficie reglada entre 2 curvas | 🟢 Baja |
| **Offset Surface** | Superficie paralela a distancia de otra | 🟡 Media |
| **Stitch** | Une superficies adyacentes en un cuerpo cerrado (→ sólido) | 🔴 CRÍTICA |
| **Unstitch** | Separa caras de un sólido en superficies independientes | 🟡 Media |
| **Trim** | Recorta superficie con otra superficie/plano | 🟡 Media |
| **Untrim** | Extiende superficie recortada a sus límites naturales | 🟢 Baja |
| **Extend** | Extiende borde de superficie | 🟡 Media |
| **Thicken** | Añade grosor a una superficie → sólido | 🔴 CRÍTICA |

---

## 📦 12. SHEET METAL (Chapa Metálica)

| Función | Propósito | Prioridad |
|---------|-----------|-----------|
| **Flange** | Crea pestaña/ala desde un borde | 🟢 Baja |
| **Bend** | Dobla chapa en un ángulo | 🟢 Baja |
| **Flat Pattern** | Desarrolla (unfold) la chapa a plano para corte láser/CNC | 🟡 Media |
| **Sheet Metal Rules** | Define reglas: espesor, radio mínimo de doblez, K-factor | 🟢 Baja |

---

## ⌨️ 13. KEYBOARD SHORTCUTS (Fusion 360 defaults)

| Tecla | Acción | Estado |
|-------|--------|--------|
| **S** | Shortcut Box (búsqueda rápida de herramientas) | ✅ |
| **Q** | Push/Pull (Extrude contextual) | 🔴 Falta |
| **E** | Extrude | ✅ (como Rotar) |
| **L** | Line (en modo Sketch) | 🔴 Falta |
| **C** | Circle (en modo Sketch) | 🔴 Falta |
| **R** | Rectangle (en modo Sketch) | ✅ (como Scale) |
| **D** | Sketch Dimension | 🔴 Falta |
| **Delete** | Delete | ✅ |
| **Ctrl+Z** | Undo | ✅ |
| **Ctrl+Y** | Redo | ✅ |
| **Ctrl+Shift+P** | Command Search | ✅ |
| **F** | Fillet | 🔴 Falta |
| **M** | Move | 🔴 Falta |
| **J** | Joint | 🔴 Falta |
| **I** | Inspect/Measure | 🔴 Falta |

---

## 🗺 ROADMAP DE IMPLEMENTACIÓN SUGERIDO

### Fase 1 — Sketch Engine Real (Prioridad #1)
1. ✅ Sketch en planos XY/XZ/YZ
2. ✅ Rectángulo, Círculo
3. ⬜ **Line tool** (polilíneas)
4. ⬜ **Arc tool** (3-point)
5. ⬜ **Trim** (recortar entre intersecciones)
6. ⬜ **Fillet/Chamfer** en sketch
7. ⬜ **Offset** de perfiles
8. ⬜ **Sketch Constraints** (coincident, horizontal, vertical, perpendicular, parallel)
9. ⬜ **Sketch Dimensions** (paramétrico real)
10. ⬜ **Sketch-on-Face** (crear sketch en cara de cuerpo existente) — ✅ Detección básica

### Fase 2 — Operaciones 3D Core
1. ✅ Extrude (básico — distancia fija)
2. ⬜ Extrude avanzado (hasta cara, symmetric, taper)
3. ⬜ **Revolve** (eje + perfil → sólido de revolución)
4. ⬜ **Sweep** (perfil + path)
5. ⬜ **Loft** (2+ perfiles)
6. ⬜ **Hole Wizard** (simple, roscado, avellanado)
7. ⬜ **Fillet 3D** (redondear aristas)
8. ⬜ **Chamfer 3D** (biselar aristas)
9. ⬜ **Shell** (vaciar sólido)
10. ⬜ **Pattern** (rectangular, circular)
11. ⬜ **Mirror** (reflejar features)

### Fase 3 — Sistema Paramétrico Superior
1. ⬜ **Parameter Manager** panel lateral con tabla editable
2. ⬜ **Named variables** con fórmulas JavaScript
3. ⬜ **Dependency graph** visual
4. ⬜ **Variants** (configuraciones guardadas)
5. ⬜ **Import/Export** de parámetros (JSON/CSV)

### Fase 4 — Timeline Paramétrica Real
1. ✅ Timeline de historial
2. ⬜ **Feature-based** timeline (cada operación con nombre e ícono)
3. ⬜ **Drag-to-reorder** features
4. ⬜ **Rollback marker** para viaje en el tiempo
5. ⬜ **Edit feature** (doble-clic para re-editar parámetros)
6. ⬜ **Suppress/Unsuppress** features

### Fase 5 — Ensamblaje
1. ⬜ Componentes jerárquicos
2. ⬜ Joints (rígido, revolución, slider)
3. ⬜ Gestión de grados de libertad

### Fase 6 — Análisis & Inspección
1. ⬜ Measure tool
2. ⬜ Section Analysis
3. ⬜ Interference detection
4. ⬜ Physical properties (masa, volumen, CoM, inercia)

---

## 💡 VENTAJAS COMPETITIVAS DE LA FORJA

| Feature | Fusion 360 | La Forja (objetivo) |
|---------|-----------|-------------------|
| **Precio** | $545/año 💸 | GRATIS 🎉 |
| **Rendering** | Mesh + LOD | GPU Ray March (pixel-perfect) ✅ |
| **Parámetros** | d1, d2… sin sentido | Variables con nombre + JS + grafo |
| **Offline** | Requiere cuenta + cloud | 100% local, 0 telemetría |
| **Variantes** | Limitado | Variants con comparador visual |
| **Performance** | Lento en modelos complejos | SDF en GPU = O(1) por pixel |
| **Extensibilidad** | API limitada + Add-Ins | Open source + plugins JS |
| **UI** | Legacy Qt + Electron | React moderna + Tailwind |

---

> **Nota**: Este documento es una referencia viva. Marcar ✅ conforme se implemente cada función.
> Última actualización: Marzo 2026
