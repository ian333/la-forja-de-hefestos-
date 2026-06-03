# Referencias CAD — investigación desde documentación OFICIAL

Resultado de los 2 workflows de debate adversarial (forja-carencias-click + forja-carencias-visual).
Leyeron la doc oficial de Fusion 360, SolidWorks, Onshape, FreeCAD y Blender (39+43 agentes).
Esta es la base para construir features de La Forja "copiando el proceso" (no la pinta).

---

## 1. Flujo de modelado e interacción (por CAD)

### Autodesk Fusion 360 (Autodesk Fusion) — Design workspace, Solid tab

**Secuencia canónica (sketch→feature):**
- 1) Elegir plano: en el espacio de trabajo Design, pestaña Solid, seleccionar Create Sketch (Crear boceto). [Fuente oficial: SKT-CREATE-3D-SKETCH]
- 2) Entrar al boceto: seleccionar el plano inicial o una cara plana existente sobre la que dibujar — Fusion abre el entorno de sketch y muestra la Sketch Palette. Los planos base disponibles son XY, YZ y ZX. [Fuente oficial: GUID-88CC0E51 / SKT-CREATE-3D-SKETCH]
- 3) Dibujar geometría: en la Sketch toolbar (barra de boceto) seleccionar una herramienta de boceto (Line, Circle, Rectangle, etc.) y colocar los puntos del boceto en el plano. [Fuente oficial: SKT-CREATE-3D-SKETCH]
- 4) Acotar / restringir: aplicar constraints (coincident, parallel, perpendicular, tangent, equal, horizontal/vertical, etc.) desde el panel Sketch > Constraints, y/o Sketch Dimension (D) para fijar medidas; el objetivo es definir totalmente el boceto (fully constrained / fully defined). [Fuente oficial: SKT-CONSTRAINTS]
- 5) Salir del sketch: en la barra de herramientas hacer clic en Finish Sketch (Finalizar boceto) para volver al modelado. [Fuente oficial: SKT-CREATE-3D-SKETCH]
- 6) Extruir: con el perfil cerrado del boceto, usar Create > Extrude (atajo E) para convertir el perfil 2D en un sólido 3D. [Fuente oficial: GUID-F0491540 keyboard shortcuts reference]
- 7) Editar sobre una cara: seleccionar Create Sketch otra vez y elegir una cara plana del cuerpo recién creado como nuevo plano de boceto, o usar Press Pull (Q) / Fillet (F) directamente sobre caras y aristas del modelo. [Fuente oficial: GUID-88CC0E51 'create sketches on a plane or existing planar face on a body' + GUID-F0491540]

**Modelo de restricciones del sketch:**
- Horizontal/Vertical — restringe una sola línea, o dos puntos, para que queden sobre el eje horizontal o vertical
- Coincident (coincidente) — restringe la posición de dos puntos, o un punto y una línea/curva, para que coincidan
- Tangent (tangente) — restringe una curva y otro objeto para que se toquen en un solo punto sin cruzarse
- Equal (igual) — restringe objetos similares para que sus tamaños sean idénticos (si cambia uno, cambian los demás)
- Parallel (paralelo) — restringe dos líneas para que vayan en la misma dirección y nunca se intersecten
- Perpendicular (perpendicular) — restringe dos objetos para que queden perpendiculares (90 grados) entre sí
- Fix/UnFix (fijar/desfijar) — bloquea el tamaño y la ubicación de un punto u objeto
- Midpoint (punto medio) — restringe un punto u objeto al punto medio de otro objeto
- Concentric (concéntrico) — restringe dos o más arcos, círculos o elipses al mismo centro
- Collinear (colineal) — restringe dos o más objetos para que compartan una línea común
- Symmetry (simetría) — restringe dos o más objetos para que sean simétricos respecto de un eje común
- Curvature (curvatura) — restringe un spline y otra curva de boceto para crear continuidad de curvatura suave G2
- Dimension (Sketch Dimension) — no es una restricción geométrica sino una cota paramétrica; fija distancia/ángulo/radio y, junto con las constraints, define totalmente el boceto

**Atajos de teclado oficiales:**
- `L` — Line (boceto)
- `C` — Center Diameter Circle (círculo)
- `R` — 2-point Rectangle (rectángulo)
- `D` — Sketch Dimension (acotar)
- `E` — Extrude (extruir)
- `F` — Fillet (redondeo)
- `Q` — Press Pull
- `(ninguno por defecto)` — Create Sketch (crear boceto) — sin atajo de teclado por defecto en la referencia oficial; se invoca por menú/toolbar o marking menu

**Cómo se invoca un comando:** Los comandos se invocan de varias formas oficiales documentadas: (1) Marking menu — un menú radial que aparece al hacer clic derecho en cualquier parte del canvas alrededor del cursor; se arrastra el cursor hacia el comando y se hace clic en la cuña resaltada (nivel 1 con 8 comandos por defecto, nivel 2 para operaciones de sketch). (2) Toolbar/barra de herramientas del espacio de trabajo (p. ej. Solid > Create Sketch, Sketch toolbar > Line/Circle/Rectangle). (3) Atajos de teclado por defecto (L, C, R, D, E, F, Q...) según la 'Fusion keyboard shortcuts reference' oficial. Nota: Create Sketch no tiene atajo de teclado por defecto en la referencia oficial. (El 'shortcut bar' tipo tecla S de productos como Inventor/AutoCAD NO aparece documentado como mecanismo oficial en la ayuda de Fusion; no se afirma.)

**Fuentes oficiales:**
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/SKT-CREATE-3D-SKETCH.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/GUID-88CC0E51-AD05-4028-BF59-FACA5EC0FA2B.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/SKT-CONSTRAINTS.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-F0491540-0324-470A-B651-2238D0EFAC30.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-6514ABC1-CB75-4F0B-AB0E-316FAD36BA93.htm

### SOLIDWORKS (Dassault Systèmes) — official help documentation (help.solidworks.com)

**Secuencia canónica (sketch→feature):**
- 1) Crear/abrir un documento de pieza (New > Part). El sketch es la base de todo modelo 3D, según la documentación oficial.
- 2) ELEGIR EL PLANO: seleccionar uno de los planos por defecto (Front Plane, Top Plane o Right Plane) o un plano creado. Oficial: 'you can create a sketch on any of the default planes (Front Plane, Top Plane, and Right Plane), or a created plane' (Sketch / Where to Start a Sketch).
- 3) ENTRAR AL SKETCH: abrir un sketch sobre ese plano (Sketch en la pestaña Sketch del CommandManager, o seleccionar primero una herramienta de entidad —line, circle...— que abre el sketch automáticamente). La vista normalmente se orienta normal al plano.
- 4) DIBUJAR LA GEOMETRÍA: usar herramientas de entidad de sketch — Line, Corner Rectangle, Circle, etc. (p. ej. el rectángulo de la base en Lesson 1 - Parts).
- 5) ACOTAR / RESTRINGIR: aplicar relaciones geométricas (Add Relations — coincident, horizontal, etc.) y cotas con Smart Dimension hasta dejar el sketch 'fully defined' (negro). Oficial: Dimensioning a 2D Sketch / Smart Dimension / Add Relations.
- 6) SALIR DEL SKETCH (Exit Sketch): cerrar el sketch. Oficial: 'You exit a sketch when you create a feature from a sketched profile' — al extruir base/boss/cut desde el sketch se sale de él.
- 7) EXTRUIR: convertir el contorno cerrado en sólido con Extruded Boss/Base (Features), fijando la profundidad/Direction 1; aparece como Boss-Extrude con su Sketch1 en el FeatureManager (Lesson 1 - Extruding the Base).
- 8) EDITAR SOBRE UNA CARA: seleccionar una cara plana del modelo y abrir un nuevo sketch sobre ella ('Sketching on the Face of a Part') para añadir el siguiente feature (otro Extruded Boss/Base, Cut o Fillet), repitiendo el ciclo plano/cara -> sketch -> geometría -> cotas -> feature.

**Modelo de restricciones del sketch:**
- Horizontal — una o más líneas, o dos o más puntos; las líneas quedan horizontales (relativas al sistema de coordenadas del sketch), los puntos se alinean horizontalmente.
- Vertical — una o más líneas, o dos o más puntos; las líneas quedan verticales, los puntos se alinean verticalmente.
- Collinear — dos o más líneas; quedan sobre la misma línea infinita.
- Coradial — dos o más arcos; comparten el mismo centro y radio.
- Perpendicular — dos líneas; quedan a 90° entre sí.
- Parallel — dos o más líneas; quedan paralelas.
- Tangent — un arco/elipse/spline y una línea o arco; quedan tangentes.
- Concentric — dos o más arcos, o un punto y un arco; comparten el mismo centro.
- Midpoint — un punto y una línea; el punto queda en el punto medio de la línea.
- Intersection — dos líneas y un punto; el punto queda en la intersección.
- Coincident — un punto y una línea/arco/elipse; el punto queda sobre la entidad (también punto-a-punto).
- Equal — dos o más líneas, o dos o más arcos; iguala longitudes (líneas) o radios (arcos).
- Symmetric — una línea central y dos puntos/líneas/arcos/elipses; quedan simétricos respecto a la línea central y equidistantes.
- Parallel/Perpendicular to plane/axis y relaciones con modelo 3D existen para 3D y referencias, pero el núcleo 2D es el listado anterior.
- Fix — cualquier entidad; queda fijada en su posición/tamaño actual.
- Pierce — un punto de sketch y un eje/arista/línea/spline; el punto coincide donde el eje/curva atraviesa el plano del sketch.
- Merge Points — dos puntos finales (endpoints) o puntos de sketch; se fusionan en un solo punto.
- NOTA UX: las relaciones se aplican (a) automáticamente al dibujar (inferencia) o (b) manualmente con Add Relations (Tools > Relations > Add o barra Dimensions/Relations); las cotas (Smart Dimension) son la otra forma de restringir hasta 'fully defined'.

**Atajos de teclado oficiales:**
- `S` — Shortcut Bar (barra de comandos no-contextuales por modo: sketch/part/assembly/drawing) — mecanismo OFICIAL de atajos; la tecla por defecto es S y es re-asignable
- `(sin asignar por defecto; asignable en Customize > Keyboard)` — Sketch — SOLIDWORKS NO trae atajo de teclado por defecto; se asigna por el usuario en Tools > Customize > Keyboard (o se invoca desde el Shortcut Bar 'S' / CommandManager)
- `(sin asignar por defecto; asignable)` — Line — sin atajo de teclado por defecto; asignable por el usuario en Customize > Keyboard (típicamente vía Shortcut Bar 'S')
- `(sin asignar por defecto; asignable)` — Circle — sin atajo de teclado por defecto; asignable por el usuario en Customize > Keyboard
- `(sin asignar por defecto; asignable) — Shift = forzar cuadrado` — Rectangle / Corner Rectangle — sin atajo por defecto; asignable. Truco oficial: mantener Shift al dibujar el rectángulo de esquina lo fuerza a cuadrado
- `(sin asignar por defecto; asignable)` — Smart Dimension (acotar) — sin atajo de teclado por defecto; asignable en Customize > Keyboard
- `(sin asignar por defecto; asignable)` — Extruded Boss/Base (Extrude) — sin atajo de teclado por defecto; asignable en Customize > Keyboard
- `(sin asignar por defecto; asignable)` — Fillet (constant size fillet / redondeo) — sin atajo de teclado por defecto; asignable en Customize > Keyboard
- `Enter` — Repeat Last Command (re-ejecuta la última herramienta usada) — atajo integrado documentado

**Cómo se invoca un comando:** "SOLIDWORKS ofrece varias vías OFICIALES para invocar comandos, según la doc: (1) CommandManager / toolbars / menús con las pestañas Sketch y Features. (2) Shortcut Bar: tecla 'S' (re-asignable) abre una barra de comandos no-contextuales propia de cada modo —sketch, part, assembly, drawing— que el usuario personaliza; también permite buscar comandos. (3) Mouse Gestures (marking menu radial): se hace right-drag en el área gráfica para acceder a una herramienta/macro preasignada; el número de gestos configurable es 2, 3, 4, 8 o 12 (right-drag en las direcciones del 'guide'). (4) Búsqueda de comandos (Search Commands / 'Search SOLIDWORKS Commands'): encuentra y ejecuta un comando o lo localiza en la UI; también accesible pulsando 'S'. (5) Context toolbar / menú contextual al hacer click derecho o seleccionar una entidad/cara. (6) Keyboard shortcuts personalizados asignados por el usuario en Tools > Customize > Keyboard (SOLIDWORKS NO preasigna atajos por herramienta de sketch/feature como Line/Circle/Extrude/Fillet — la tecla 'S' del Shortcut Bar es el mecanismo de atajo provisto de fábrica)."

**Fuentes oficiales:**
- https://help.solidworks.com/2023/english/SolidWorks/sldworks/c_Sketch.htm
- https://help.solidworks.com/2014/english/solidworks/sldworks/c_where_to_start_a_sketch.htm
- https://help.solidworks.com/2021/english/SolidWorks/sldworks/c_commandmanager.htm
- https://help.solidworks.com/2026/english/SolidWorks/sldworks/t_Sketching_Corner_Rectangles.htm
- https://help.solidworks.com/2016/english/solidworks/sldworks/c_rectangles.htm
- https://help.solidworks.com/2021/english/SolidWorks/sldworks/t_Dimensioning_a_2D_Sketch.htm
- https://help.solidworks.com/2023/english/SolidWorks/Sldworks/c_Description_of_Sketch_Relations.htm
- https://help.solidworks.com/2021/english/SolidWorks/sldworks/c_description_of_sketch_relations.htm
- https://help.solidworks.com/2025/English/Solidworks/sldworks/c_horizontal_vertical_sketch_relations.htm
- https://help.solidworks.com/2012/english/SolidWorks/sldworks/Exit_Sketch.htm
- https://help.solidworks.com/2025/English/swtutorialonline/t_tut_lesson1_extrudingbase.htm
- https://help.solidworks.com/2024/english/swconntutorial/c_tut_lesson1_start.htm
- https://help.solidworks.com/2018/english/SolidWorks/sldworks/t_creating_an_extrude_feature.htm
- https://help.solidworks.com/2024/English/SolidWorks/sldworks/t_Sketching_on_the_Face_of_a_Part.htm
- https://help.solidworks.com/2024/english/SolidWorks/sldworks/r_constant_size_fillets.htm
- https://help.solidworks.com/2021/English/SolidWorks/sldworks/c_fillet_overview.htm
- https://help.solidworks.com/2017/english/SolidWorks/sldworks/c_shortcut_bars.htm
- https://help.solidworks.com/2025/english/solidworks/sldworks/HIDD_CUSTOMIZE_KEYBOARD.htm
- https://help.solidworks.com/2021/english/SolidWorks/sldworks/c_mouse_sestures.htm
- https://help.solidworks.com/2018/English/SolidWorks/sldworks/t_using_mouse_gestures.htm
- https://help.solidworks.com/2025/English/SolidWorks/sldworks/c_command_search.htm
- https://help.solidworks.com/2021/english/SolidWorks/sldworks/t_searching_command.htm
- https://help.solidworks.com/2022/english/SolidWorks/sldworks/c_time_saving_keyboard_shortcuts.htm
- https://help.solidworks.com/2021/english/SolidWorks/acadhelp/t_Repeat_Last_Command.htm

### Onshape

**Secuencia canónica (sketch→feature):**
- 1) Click Sketch in the Feature toolbar to open the Sketch dialog (or press the Sketch shortcut).
- 2) Select the sketch plane: pick a standard plane (Top/Front/Right), an existing planar part face, or a Mate connector (only one plane at a time).
- 3) Choose a sketch tool from the Sketch toolbar (Line, Circle, Rectangle, etc.) and click in the graphics area to draw geometry; Onshape applies automatic inferencing to add constraints (e.g. coplanar vertices) while you draw.
- 4) Dimension and constrain: enter dimension values inline as geometry is drawn, or use the Dimension tool afterward, and add constraints manually from the toolbar constraints menu (coincident, parallel, equal, etc.) until the sketch is fully defined.
- 5) Accept/close the sketch by clicking the green checkmark, which records the sketch as a feature in the Features list.
- 6) Extrude: click the Extrude tool (Shift+e); choose Solid creation type and a result operation, then select the faces / closed sketch regions to extrude (when a sketch is open, closed regions are auto-selected).
- 7) Edit on a face: select an existing planar part face as the sketch plane and start a new sketch on it, then repeat the draw -> dimension/constrain -> exit -> extrude cycle to add or remove material.

**Modelo de restricciones del sketch:**
- Coincident
- Concentric
- Parallel
- Perpendicular
- Tangent
- Equal
- Horizontal
- Vertical
- Midpoint
- Normal
- Pierce
- Symmetric
- Fix
- Curvature
- Dimension (dimensional constraint)
- Quadrant (auto-created)
- Use (auto-created)
- Intersection (auto-created)

**Atajos de teclado oficiales:**
- `s` — Open shortcut toolbar at the mouse cursor location
- `l` — Sketch line tool (select or exit Line)
- `c` — Sketch circle tool (select or exit Center point circle)
- `r` — Sketch center point rectangle tool
- `g` — Sketch corner rectangle tool
- `d` — Sketch dimension tool (select or exit Dimension)
- `Shift+e` — Extrude feature (opens while working on a sketch)
- `Shift+f` — Fillet (opens Edge in Fillet dialog)
- `Shift+/` — Toggle the keyboard shortcuts map open/closed
- `Alt+c` — Open command/feature Search tools dialog

**Cómo se invoca un comando:** Onshape exposes four official ways to invoke a command: (1) Feature/Sketch toolbar -- click the tool icon directly (e.g. click Sketch, then a sketch tool, then Extrude). (2) Shortcut toolbar -- press 's' to open a customizable shortcut toolbox at the mouse cursor, contextual to the active tab/toolbar (Sketch, Features, Assembly, Drawing); set up in account Preferences. (3) Direct keyboard hotkeys -- single-letter keys while a sketch plane is selected (l, c, r, g, d) and modified keys for features (Shift+e Extrude, Shift+f Fillet). (4) Command/feature Search tools -- click the Search tools button to the right of the toolbar or press Alt+c, then type a word/phrase and click the matching tool or vetted custom feature in the results list.

**Fuentes oficiales:**
- https://cad.onshape.com/help/Content/Home/keyboard_shortcuts_and_hotkeys.htm
- https://cad.onshape.com/help/Content/Sketch/sketch_basics.htm
- https://cad.onshape.com/help/Content/Primer/creating_a_sketch.htm
- https://cad.onshape.com/help/Content/Sketch/working_with_constraints.htm
- https://cad.onshape.com/help/Content/extrude.htm
- https://cad.onshape.com/help/Content/Home/search_tools.htm
- https://cad.onshape.com/help/Content/ui-basics.htm

### FreeCAD (Sketcher + PartDesign workbenches) — FreeCAD 1.0

**Secuencia canónica (sketch→feature):**
- 1. Crear/activar un Body: PartDesign -> Create body (un cuerpo es el contenedor del solido paramétrico).
- 2. Elegir el plano: PartDesign -> Create sketch, y en el panel de tareas seleccionar el plano de origen (XY_Plane / XZ_Plane / YZ_Plane) y pulsar OK. Tambien se puede seleccionar primero el plano/cara y luego Create sketch.
- 3. Entrar a edicion de sketch: al crear el sketch FreeCAD abre automaticamente el modo de edicion del Sketcher (la vista se alinea al plano).
- 4. Dibujar la geometria: usar las herramientas Sketcher (Create line G,L / Create rectangle G,R / Create circle G,C / Create polyline, etc.) para trazar el perfil 2D.
- 5. ACOTAR y restringir: aplicar restricciones geométricas (coincident, horizontal, vertical, parallel, perpendicular, tangent, equal, symmetric) y restricciones dimensionales (Dimension D / Constrain distance K,D, radius, diameter, angle) hasta dejar el sketch totalmente restringido (fully constrained, sin grados de libertad).
- 6. Salir del sketch: pulsar el boton Close en el panel de tareas (o Sketch -> Leave/Edit sketch) para cerrar el modo de edicion.
- 7. Extruir: con el sketch seleccionado, PartDesign -> Pad (extruir el perfil a un solido); fijar Length/Type (Dimension, Two dimensions, Symmetric to plane) y OK. (Equivalente en Part WB: Extrude.)
- 8. Editar sobre una cara: girar la vista, hacer clic en una cara plana del solido, PartDesign -> Create sketch (el nuevo sketch nace sobre esa cara); dibujar/acotar; Close; y aplicar la siguiente operacion (Pad aditivo, Pocket sustractivo, etc.). Detalles: Fillet/Chamfer sobre aristas del solido. Repetir cara->sketch->acotar->feature.

**Modelo de restricciones del sketch:**
- Geométricas — Coincident (puntos coincidentes / concéntrico)
- Geométricas — Point on object (punto sobre arista o eje)
- Geométricas — Horizontal (linea o par de puntos horizontal)
- Geométricas — Vertical (linea o par de puntos vertical)
- Geométricas — Parallel (lineas paralelas)
- Geométricas — Perpendicular (lineas/aristas perpendiculares)
- Geométricas — Tangent (o colineal: aristas tangentes, o arista y eje)
- Geométricas — Equal (igual longitud o igual radio/curvatura)
- Geométricas — Symmetric (dos puntos simétricos respecto a una linea/eje)
- Geométricas — Block (bloquea una arista en su lugar con una sola restriccion)
- Geométricas — Refraction / Snell's law (refraccion, ley de Snell)
- Dimensionales — Dimension (herramienta unificada contextual 1.0: ofrece la restriccion dimensional o geométrica adecuada segun la seleccion)
- Dimensionales — Distance (longitud de linea o distancia entre puntos / punto-linea)
- Dimensionales — Horizontal distance (distancia horizontal entre dos puntos)
- Dimensionales — Vertical distance (distancia vertical entre dos puntos)
- Dimensionales — Radius (radio de circulos/arcos)
- Dimensionales — Diameter (diametro de circulos/arcos)
- Dimensionales — Radiam (aplica radio o diametro automáticamente)
- Dimensionales — Angle (angulo entre aristas / angulo de linea con el eje / apertura de arco)
- Dimensionales — Lock (aplica distancia horizontal + vertical de golpe)
- Internal alignment (alineacion interna, p. ej. ejes de una elipse)

**Atajos de teclado oficiales:**
- `G, L` — Sketcher: Create line
- `G, C` — Sketcher: Create circle (center and rim point)
- `G, R` — Sketcher: Create rectangle
- `G, F` — Sketcher: Create fillet (raiz del submenu de filetes)
- `D` — Sketcher: Dimension (herramienta de acotado unificada, contextual)
- `M` — Sketcher: Dimension — ciclar entre las restricciones disponibles para la seleccion
- `K, D` — Sketcher: Constrain distance (acotar distancia explícita)
- `(sin atajo por defecto)` — PartDesign: Pad (extruir) — sin atajo de teclado por defecto; via menu/toolbar

**Cómo se invoca un comando:** Los comandos del Sketcher se invocan de cuatro formas oficiales, todas equivalentes: (1) boton en las toolbars del Sketcher (visibles solo en modo edicion de sketch); (2) menu Sketch -> submenus 'Sketcher geometries', 'Sketcher tools' y 'Sketcher constraints'; (3) menu contextual con clic derecho en la vista 3D; y (4) atajos de teclado de DOS pulsaciones con prefijo de categoria: 'G' inicia la familia de geometrias (G,L=line, G,C=circle, G,R=rectangle, G,F=fillet) y 'K' inicia la familia de restricciones (K,D=constrain distance). Las restricciones dimensionales en FreeCAD 1.0 se concentran en la herramienta unificada Dimension (atajo 'D'), que es contextual: segun lo seleccionado ofrece la restriccion adecuada y se cicla con 'M'. La mayoria de herramientas de creacion entran en 'continue mode' (siguen activas para crear varias) y se terminan con Esc o clic derecho.

**Fuentes oficiales:**
- https://wiki.freecad.org/Sketcher_Workbench
- https://github.com/FreeCAD/FreeCAD-documentation/blob/main/wiki/Sketcher_Workbench.md
- https://wiki.freecad.org/Basic_Part_Design_Tutorial
- https://wiki.freecad.org/Sketcher_Tutorial/en
- https://wiki.freecad.org/Sketcher_CreateLine
- https://wiki.freecad.org/Sketcher_CreateCircle
- https://wiki.freecad.org/Sketcher_CreateRectangle
- https://wiki.freecad.org/Sketcher_CreateFillet
- https://wiki.freecad.org/Sketcher_Dimension
- https://wiki.freecad.org/Sketcher_ConstrainDistance
- https://wiki.freecad.org/PartDesign_Pad
- https://wiki.freecad.org/PartDesign_Workbench

### Blender (5.1 manual / latest) — polygon MESH modeler, not a parametric CAD sketcher. There is NO sketch-plane + dimensional-constraint-solver paradigm like Fusion 360 / SolidWorks. Modeling happens by adding a primitive in Object Mode and editing its vertices/edges/faces in Edit Mode. The requested CAD step sequence is mapped below onto Blender's REAL equivalents, and where Blender has no equivalent (e.g. solver constraints, true dimensions) that is stated explicitly rather than invented.

**Secuencia canónica (sketch→feature):**
- CHOOSE-PLANE (Blender analog): there is no 'sketch plane'. You set the 3D Cursor (where new geometry spawns) and the viewport/view axis. Added primitives appear at the location of the 3D Cursor (Mesh Primitives page). Orientation/working axis is governed by the transform orientation and view, not by a selected datum plane.
- ENTER-TO-SKETCH (Blender analog = enter Edit Mode): Blender has no sketch entity. You first ADD a base mesh primitive (Add menu, Shift-A, Add > Mesh; primitives are 'starting points for modeling' and can be added in both Object Mode and Edit Mode). Then press Tab to toggle from Object Mode into Edit Mode, 'the main mode where modeling takes place' (Modeling Introduction / Object Modes).
- DRAW GEOMETRY (Blender analog = edit mesh elements): in Edit Mode you build/shape geometry by selecting and editing vertices/edges/faces (Vertex/Edge/Face select). New geometry is created by adding primitives, extruding, loop-cutting, etc.; popovers Ctrl-V (Vertex), Ctrl-E (Edge), Ctrl-F (Face) expose the per-element operators (Editing Introduction).
- ACOTAR / RESTRINGIR (Blender analog = numeric input + axis locking + snapping; NOT a constraint solver): Blender has NO dimensional/geometric constraint solver. 'Dimensioning' = Numeric Input: after a transform shortcut type the exact value (e.g. S 2 Return doubles scale; G 1 Tab 1 Tab 1 moves 1 unit on each axis). 'Constraining' = Axis Locking ('axis constraint'): press X / Y / Z (or hold MMB) to lock a transform to one axis (Numeric Input + Axis Locking pages). Alignment to other geometry = Snapping (Shift-Tab) to Vertex / Edge / Face / Volume / Increment / Grid (Snapping page).
- SALIR DEL SKETCH (Blender analog = exit Edit Mode): press Tab again to toggle back to Object Mode (Object Modes page). There is no 'close sketch / consume profile' step — the mesh you edited simply becomes the editable object.
- EXTRUIR (real Blender tool): in Edit Mode select the face(s)/edge(s)/vertices and press E (Extrude Region). Extrusion duplicates the selection and keeps it connected to the original geometry; movement can be axis-locked and given a numeric value (Extrude Region page).
- EDIT ON A FACE (real Blender workflow): stay in Edit Mode, switch to Face select, select the target face. Common per-face operations: Inset Faces (I) to make a smaller bordered face, then Extrude (E) it in/out; subdivide/loop-cut (Ctrl-R) to add detail; Bevel (Ctrl-B) to round/chamfer the bordering edges. Newly extruded primitives also appear at the 3D Cursor when added in Edit Mode.

**Modelo de restricciones del sketch:**
- IMPORTANT: Blender (mesh modeling) does NOT provide a 2D sketch constraint SOLVER. There are no coincident / parallel / perpendicular / tangent / equal / horizontal / vertical relational constraints that a solver maintains, as in parametric CAD. Per the official manual the modeling primitives are vertices/edges/faces edited directly, not constrained sketch entities.
- Axis Locking ('axis constraint') — the closest official 'constraint': X, Y, Z (or hold MMB) restrict a Move/Rotate/Scale/Extrude to a single axis (or forbid two axes). This is what the manual literally calls a 'constraint'.
- Numeric Input — exact magnitude entry after a transform (the 'dimension' analog): type a number after G/R/S; Tab / Ctrl-Tab to enter values for the next axis; combine with axis locking for precise placement.
- Snapping (Shift-Tab) — alignment relations (the 'coincident/mate' analog), with snap targets: Vertex (snap to nearest vertex), Edge (snap to nearest edge), Face (snap to face surface, used for retopology), Volume, Increment (snap to an imaginary grid at the selection's origin), and Grid. Hold Ctrl to snap temporarily.
- Precision modifier — hold Shift during a transform for fine, non-incremental control; Ctrl+Shift combines snapping with 0.1-unit precision increments (Precision / Snapping pages).
- No true parametric 'dimension' object: distances/angles are set via numeric input at edit time; the Measure tool (Spacebar M in the configurable keymap) only reports distances, it does not constrain them.

**Atajos de teclado oficiales:**
- `Tab` — Enter/exit 'sketch' (toggle Object <-> Edit Mode, where modeling happens)
- `Shift A` — Add a base primitive (Add > Mesh menu; primitives spawn at the 3D Cursor) — Blender's 'start a profile'
- `E` — Line / draw geometry — no line tool; new geometry comes from primitives or from Extrude Vertices (extrude a selected vertex to add a connected edge)
- `Shift A` — Circle — added as a primitive via the Add > Mesh > Circle menu (no dedicated hotkey; opened with Shift A)
- `Shift A` — Rectangle / plane — added as a primitive via Add > Mesh > Plane (no dedicated hotkey; opened with Shift A)
- `G / R / S then type number (Tab between axes)` — Dimension / set exact size or distance — Numeric Input: press transform key then type the value (e.g. S 2 Return), Tab for next axis
- `E` — Extrude (Extrude Region) — pull a face/edge/vertex out as connected geometry
- `I` — Inset Faces — edit on a face: make a smaller bordered face inside the selected face
- `Ctrl B` — Fillet / rounded corner — Bevel with multiple segments (press S during bevel to set segment count; profile 0.5 = circular arc). Blender has no separate parametric mesh fillet tool
- `Ctrl B` — Bevel Edges (chamfer/round an edge)
- `Shift Ctrl B` — Bevel Vertices
- `Ctrl R` — Loop Cut (add an edge loop across faces, for adding detail on a face)
- `Shift Tab` — Snapping toggle (align to Vertex/Edge/Face/Increment/Grid) — the 'constrain to existing geometry' action
- `X / Y / Z (or hold MMB)` — Axis constraint (lock transform/extrude to one axis)
- `F3` — Menu / Operator Search (invoke any tool by name)
- `Ctrl V / Ctrl E / Ctrl F` — Vertex / Edge / Face context popover in Edit Mode

**Cómo se invoca un comando:** "Blender commands are invoked four official ways (per the manual): (1) KEYBOARD SHORTCUT directly — e.g. E extrude, I inset, Ctrl-B bevel, Ctrl-R loop cut; most modeling is hotkey-driven. (2) MENU SEARCH / OPERATOR SEARCH via F3 (Edit > Menu Search) — a pop-up that lists every operator by name (also shows which menu it lives in); Operator Search (Edit > Operator Search, needs Developer Extras) reaches operators not exposed in any menu. (3) HEADER / TOPBAR + Toolbar menus and tool buttons — each mode shows its own menus (e.g. Add menu, Vertex/Edge/Face menus) and a left Toolbar of active tools. (4) SPACEBAR — all pop-up menus are searchable by pressing Spacebar and typing; the Spacebar Action preference can map Spacebar to open Menu Search, or to act like a modifier key (Spacebar T = Transform, Spacebar M = Measure, etc.). Blender does NOT use a Fusion-style 'marking menu / shortcut bar (S)'; its radial menus are Pie Menus and tool selection is via the Toolbar + F3 search."

**Fuentes oficiales:**
- https://docs.blender.org/manual/en/latest/modeling/introduction.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/introduction.html
- https://docs.blender.org/manual/en/latest/editors/3dview/modes.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/primitives.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/editing/introduction.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/tools/extrude_region.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/editing/face/inset_faces.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/editing/edge/bevel.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/tools/loop.html
- https://docs.blender.org/manual/en/latest/editors/3dview/controls/snapping.html
- https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/numeric_input.html
- https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/axis_locking.html
- https://docs.blender.org/manual/en/4.1/interface/controls/templates/operator_search.html

---

## 2. Lenguaje visual / feedback (por CAD)

### Autodesk Fusion 360

**Convenciones visuales:**
- Sketch constraint state via geometry color: under-constrained geometry shows in a non-black color (default blue / orange for selected) and changes to BLACK once fully constrained; a red lock icon appears on the sketch node in the Browser when fully constrained. Doctrine for a CAD viz: animate lines snapping from blue to black to communicate 'this is now solved/locked'. (help.autodesk.com Fully define and constrain sketches)
- Closed sketch profiles get a translucent BLUE shading fill (Sketch Palette > Show Profile) to signal a region that can be extruded; open/unclosed loops get no fill. The blue profile shade is the canonical 'this is a valid face you can build on' cue. (help.autodesk.com Sketch Palette reference)
- Sketch plane shows a finite reference GRID with snap-to-grid; Sketch Palette toggles Sketch Grid and Snap. The grid plus the colored origin triad orient the user in the active 2D plane. Slice temporarily cuts bodies at the sketch plane so the sketch is never hidden behind solid. (help.autodesk.com Sketch Palette reference)
- Selection priority filter (Body / Face / Edge / Component / Vertex) — only one can be active at a time — gates what the cursor pre-highlights and picks; the canonical Fusion selectable types are Bodies, Body Faces, Body Edges, Body Vertices, Components, Features, Joints, Sketch Curves. (help.autodesk.com Selection in Fusion)
- Window/box selection: drag LEFT-to-RIGHT selects only objects fully enclosed; drag RIGHT-to-LEFT (and freeform counterclockwise) selects anything the boundary encloses OR crosses. The selection region itself is drawn as a translucent colored area: 'The background inside the area changes color and becomes translucent.' (help.autodesk.com Selection in Fusion)
- Live in-canvas manipulators are the primary editing surface: a DistanceValueCommandInput draws a draggable ARROW in the graphics window for extrude depth / plane offset; AngleValueCommandInput draws a draggable angle WIDGET; DirectionCommandInput draws an arrow whose direction you flip; a TriadCommandInput draws a full position/rotation/scale/flip triad. Manipulators stay invisible until prerequisite input is supplied, then appear. (Fusion 360 API Command Inputs)
- Operation preview-before-commit: dragging the extrude manipulator builds a live preview solid in the canvas and a Flip icon mirrors the extrusion over the profile plane before clicking OK — the result is shown, not just described, prior to confirmation. (help.autodesk.com Extrude a solid body)
- ViewCube (top-right): a labeled cube whose faces, edges, and corners orient the camera; click a face for an ortho view, an edge/corner for an iso view; orbit by dragging it. A Home icon resets to the default view and the cube reflects the model Up direction (Z-up default, indicates Y-up when changed). (help.autodesk.com Fusion interface / Navigation)
- Navigation Bar holds Zoom, Pan, Orbit plus the Display Settings menu that controls visual style and canvas appearance; middle-mouse Pan/Zoom/Orbit behavior is remappable to Fusion/Alias/Inventor/SolidWorks schemes. (help.autodesk.com Navigation / Pan Zoom Orbit preferences)
- Realistic material display: Appearances (color, patterns, texture images, bump maps) override the physical-material color WITHOUT changing engineering properties, and come in Opaque, Transparent, Metal (high specularity/glossiness), Layered (carbon fiber, metallic paint), and Solid Wood categories — applied by drag-drop onto components, bodies, or faces. (help.autodesk.com Materials and appearances)
- Canvas environment/lighting cues, all toggleable: Object Shadow (bodies cast onto bodies), Ground Shadow (bodies cast onto the ground plane), Ground Reflection (bodies reflected on the ground plane), Ambient Occlusion (contact-based shading from ambient light exposure), Environment Dome (virtual sky + horizon), and Anti-Aliasing (smooths curved edges/surfaces). Ground Plane enables both ground shadows and reflections. (help.autodesk.com Display preferences reference)
- Component/feature color-coding (Inspect > Display Component Colors, Shift+N): each component renders as a distinct color in the canvas, Browser, AND Timeline simultaneously; a feature touching multiple components shows a color swatch per component. Cycle Component Color recolors a part. This is the canonical way structure is read at a glance. (help.autodesk.com Color code components and features)
- Dimensions/measurements render as an OVERLAY directly on the geometry in the canvas (not only in a dialog): the Measure tool shows results both in the dialog and on the model, can display X/Y/Z deltas relative to a chosen coordinate system, and hovering a result value highlights the corresponding distance/angle on the geometry. (help.autodesk.com Measure objects)

**Patrones de feedback:**
- Hover / rollover (pre-highlight): placing the cursor over geometry pre-highlights the single entity under the priority filter before any click; with the Measure tool, Show Snap Points displays candidate snap points on the face/edge/sketch curve under the pointer, and Ctrl/Cmd locks to a snap point while Shift hides snap points. (help.autodesk.com Selection / Measure)
- Click to select: the picked face/edge/body/vertex is highlighted as selected (distinct from the hover pre-highlight); Ctrl/Cmd toggles objects into/out of the selection set, Shift only adds without removing. (help.autodesk.com Selection in Fusion)
- Box/lasso drag feedback: the active marquee or freeform lasso paints a translucent colored fill over its interior in real time ('the background inside the area changes color and becomes translucent'), and the fill color/behavior signals enclose-only (L-to-R / clockwise) vs enclose-or-cross (R-to-L / counterclockwise). (help.autodesk.com Selection in Fusion)
- Drag-to-edit feedback: dragging a value manipulator (arrow for distance, widget for angle, triad for move) live-updates a preview of the resulting body in the canvas; a Flip icon lets you reverse direction mid-operation — the model redraws continuously so the user sees the outcome before committing. (help.autodesk.com Extrude / API Command Inputs)
- Success / solved feedback (sketch): when the last degree of freedom is removed, the sketch geometry flips from its working color to BLACK and a red lock icon appears on the sketch in the Browser — the unambiguous 'fully constrained / done' signal. (help.autodesk.com Fully define and constrain sketches)
- Under-defined feedback: geometry that still has freedom stays in its non-black working color (blue), inviting more constraints/dimensions; this persistent color difference is the running 'not done yet' indicator. (help.autodesk.com Fully define and constrain sketches)
- Performance-adaptive feedback: when Dynamic graphics is on, canvas effects (shadows, AO, reflections, anti-aliasing) are automatically reduced or toggled off in priority order during orbit/pan to hold the target frame rate, then restored when navigation stops. (help.autodesk.com Display preferences reference)

**Fuentes oficiales:**
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/SKT-FULLY-DEFINE-CONSTRAIN-SKETCH.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Sketch/files/GUID-4183A4B7-E002-4396-AD5A-7FF3C8B2F33A.htm
- https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-SELECTION
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-SELECTION.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/CommandInputs_UM.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-EXTRUDE-SOLID.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GS-THE-FUSION-INTERFACE.htm
- https://help.autodesk.com/view/fusion360/ENU/?guid=GUID-7B742BB2-65B3-4ADA-9B11-9D57E1E31292
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Render/files/RND-MATS-APPEARANCES.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-GetStarted/files/GUID-878489CD-3A23-4303-8450-C2F4F8E410B1.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/GUID-4969CAA2-5C5F-4E84-B046-92EB480D5024.htm
- https://help.autodesk.com/cloudhelp/ENU/Fusion-Model/files/SLD-MEASURE.htm
- https://help.autodesk.com/view/fusion360/ENU/courses/AP-TIP-PAN-ZOOM-ORBIT-PREFERENCES

### SOLIDWORKS (Dassault Systèmes) — lenguaje visual extraído de la documentación oficial (help.solidworks.com)

**Convenciones visuales:**
- Selección de cara/arista: los elementos en el área gráfica se RESALTAN al seleccionarlos. El color de selección es configurable en Tools > Options > System Options > Colors, donde existen los slots 'Selected Item 1' y 'Selected Item 2'. SOLIDWORKS trae tres esquemas de resaltado predefinidos: Blue, Green y Orange (más esquemas personalizados guardables). En patrones, las instancias se resaltan con 'Selected Item 1' y la semilla (seed) con 'Selected Item 2' para distinguir la cara/feature origen.
- Preselección (hover): los elementos se 'dynamically highlighted' (resaltado dinámico) cuando el puntero pasa por encima, ANTES de hacer clic. El hover usa un color distinto al de selección confirmada (slot 'Dynamic highlighting' en System Options > Colors), de modo que pre-resaltado-al-pasar-el-mouse y seleccionado-al-hacer-clic se ven diferentes.
- Preview en vivo de la operación (Instant3D): geometría se crea y modifica arrastrando 'drag handles' y 'rulers' (reglas en pantalla) que miden con precisión la modificación mientras se arrastra; aparece una regla angular para revoluciones, drafts y al usar los anillos del triad para rotar Live Section Planes. El modelo se actualiza dinámicamente en tiempo real durante el drag (preview antes de soltar).
- Confirmación de operación: toda operación se ejecuta vía PropertyManager con un preview en vivo en el área gráfica; OK (acepta) y Cancel (descarta) aparecen DOS veces — en la esquina superior izquierda del PropertyManager y en la 'Confirmation Corner' (esquina superior derecha del área gráfica) para confirmar sin mover el puntero de vuelta al panel.
- Reference Triad: un triad aparece en documentos de pieza y ensamble para orientar al ver el modelo; muestra las direcciones globales X, Y, Z y sirve para cambiar la orientación de vista (clic en un eje del triad re-orienta la cámara). Se puede ocultar, pero no usar como punto de inferencia. Convención de color de ejes estándar (rojo X, verde Y, azul Z).
- Cotas/dimensiones — driving vs driven: las dimensiones de referencia (driven, no manejan el modelo) son GRISES y aparecen entre paréntesis por defecto; las driving (que controlan el modelo) usan otro color. Los colores de cada tipo de cota se configuran en Tools > Options > System Options > Colors, y los paréntesis en Document Properties > Dimensions.
- Estado de geometría de sketch por COLOR: azul = entidad no totalmente definida (under defined); negro = totalmente definida (fully defined); el origen del sketch se dibuja en rojo. Existen además estados over defined, dangling y no-resuelto con sus colores (rojo / amarillo / rosa / café-brown), donde el café aparece para relaciones en el PropertyManager Display/Delete Relations y en el FeatureManager. El estado del sketch (entidad por entidad) se comunica puramente por color.
- Rejilla del plano de sketch: se puede mostrar una grid en el sketch o dibujo activo; espaciado y 'minor grid lines per major' se configuran en Document Properties > Grid/Snap, con opciones de snap independientes. La misma config de espaciado aplica a las reglas (rulers) del dibujo.
- Materiales realistas / sombras / ambiente: RealView Graphics da soporte por hardware (GPU) de shading avanzado en tiempo real, incluyendo self-shadowing (auto-sombras desde la primera luz direccional), reflejos de escena y de entorno (environment reflections). Se complementa con Ambient Occlusion para añadir realismo sin renderizar. Si la GPU es compatible con RealView, está activado por defecto. Las apariencias (appearances) aplican el material visual sobre la geometría.
- Geometría válida vs sobre-restringida: en sketches, las entidades resueltas y bien definidas van en negro (fully defined); las sobre-restringidas (over defined) se marcan en rojo y disparan el mensaje de error 'Over Defined Sketch', con herramientas de diagnóstico ('Diagnosing/Resolving Over Defined Sketches'). En el FeatureManager, los errores de rebuild se distinguen de las advertencias por iconos (vía 'What's Wrong?').

**Patrones de feedback:**
- Hover (preselección): el elemento bajo el puntero se 'dynamically highlighted' con el color de 'Dynamic highlighting' antes del clic — feedback de qué se va a seleccionar.
- Selección (clic): el elemento se resalta con el color de 'Selected Item 1' (o 'Selected Item 2' para semillas de patrón); esquema por defecto Blue/Green/Orange configurable.
- Drag (Instant3D): preview en vivo con drag handles + reglas en pantalla que muestran la medida exacta mientras se arrastra; regla angular para revoluciones/drafts/rotación de planos de sección — la geometría se recalcula en tiempo real.
- Éxito / confirmación: OK (verde, marca de visto) en PropertyManager y en la Confirmation Corner del área gráfica aplica la operación; el preview se materializa en geometría final.
- Cancelar / descartar: Cancel (X) en PropertyManager / Confirmation Corner descarta el preview sin modificar el modelo.
- Error de sketch (over defined): entidades sobre-restringidas en rojo + mensaje 'Over Defined Sketch'; las no totalmente definidas quedan en azul como aviso de que faltan relaciones/cotas; el negro confirma 'fully defined' (estado sano).
- Error/advertencia de feature (rebuild): tras un rebuild, el FeatureManager Design Tree marca features con iconos de error vs advertencia; el comando 'What's Wrong?' lista los problemas — con errores no se genera geometría, con solo advertencias sí.
- Relaciones problemáticas: las relaciones colgantes/inválidas (dangling) se muestran en café (brown) en el área gráfica y en el panel Display/Delete Relations, señalando referencias rotas.

**Fuentes oficiales:**
- https://help.solidworks.com/2024/english/SolidWorks/sldworks/c_highlighting.htm
- https://help.solidworks.com/2024/english/SolidWorks/sldworks/HIDD_OPTIONS_SYSTEM_COLORS.htm
- https://help.solidworks.com/2025/English/SolidWorks/sldworks/r_reference_triad.htm
- https://help.solidworks.com/2024/English/SolidWorks/sldworks/c_realview_graphics.htm
- https://help.solidworks.com/2018/english/SolidWorks/sldworks/t_ambient_occlusion.htm
- https://help.solidworks.com/2024/English/SolidWorks/sldworks/c_instant3d_rulers.htm
- https://help.solidworks.com/2022/english/solidworks/sldworks/c_instant3d.htm
- https://help.solidworks.com/2024/English/SolidWorks/sldworks/c_Sketch_Geometry_Status.htm
- https://help.solidworks.com/2021/english/SolidWorks/sldworks/t_Diagnosing_Over_Defined_Sketches.htm
- https://help.solidworks.com/2020/English/SolidWorks/sldworks/c_Resolving_Over_Defined_Sketches.htm
- https://help.solidworks.com/2012/english/solidworks/sldworks/hide_overdefinedsketch.htm
- https://help.solidworks.com/2024/english/SolidWorks/sldworks/HIDD_OPTIONS_GRID.htm
- https://help.solidworks.com/2023/English/SolidWorks/sldworks/c_Reference_Dimensions.htm
- https://help.solidworks.com/2020/english/SolidWorks/sldworks/c_Formatting_Dimensions_in_Drawings.htm
- https://help.solidworks.com/2016/english/solidworks/sldworks/r_pm_overview.htm
- https://help.solidworks.com/2016/english/WhatsNew/c_command_confirmation.htm
- https://help.solidworks.com/2017/english/solidworks/sldworks/hidd_new_whats_wrong.htm
- https://help.solidworks.com/2024/english/SolidWorks/sldworks/c_component_icons_fmdt.htm

### Onshape (cloud CAD by PTC) — visual language extracted from official help docs at cad.onshape.com/help

**Convenciones visuales:**
- SELECTION HIGHLIGHT — selected part, surface, edge, or vertex in the graphics area turns Vivid Yellow #ffc107 (this is the single 'this is selected' signal across faces/edges/sketch entities). Selection is a click-toggle: click to select, click again to deselect, no modifier key needed for multi-select.
- CREATE-SELECTION TWO-TONE — when a selection auto-propagates (e.g. tangent-connected or adjacent loop), the entity you originally picked is ORANGE and the entities Onshape auto-added are YELLOW, so the user can read 'mine vs derived' at a glance.
- SKETCH GEOMETRY STATE BY COLOR (core convention) — in an ACTIVE sketch: Pure Blue #0000ff = under-defined/draggable (you can move it or resize it); Black #000000 = fully defined/constrained (locked, cannot drag); Moderate Red #bd3039 = over-defined / contains an error / unresolvable. A sketch becoming fully constrained is signaled purely by entities turning from blue to BLACK.
- INACTIVE SKETCH — lines/curves of a sketch you're not editing render in muted Dark Grayish Blue #949ba0; closed sketch regions get a faint Light Grayish Blue #E3E6E9 fill so closed profiles read as fillable.
- SKETCH PLANE / GRID — the sketch plane lines and plane text render in Very Soft Blue #90cef1; planes appear as a translucent bounded rectangle you sketch onto (the plane edges in #90cef1).
- HOVER / PRE-HIGHLIGHT — hovering a sketch edge tints it Very Soft Orange #f3bf8e; hovering a sketch dimension tints it Very Soft Orange #d9bfa0. Hover is a softer/warmer tone, distinct from the saturated yellow of an actual selection. Hovering an entity also reveals ONLY that entity's constraint glyphs (decluttered feedback).
- DIMENSIONS — driving dimensions, their arrows and witness/extension lines render in Black #000000; DRIVEN (reference) dimensions render in light gray, making driving-vs-driven readable by color alone. Dimension value is an inline editable field placed on the drawing/sketch.
- CONSTRAINT GLYPHS — drawn as a small square badge: normal/well-defined = gray square with a black icon inside; cross-sketch constraint = blue-background badge; on hover the referenced constraint goes a darker blue. Problem constraint = red square with a white icon.
- MATE CONNECTOR / WORLD TRIAD AXES — color-coded axes: X = Strong Red #cd0000, Y = Dark Lime Green #009500, Z = Strong Blue #0000d0 (standard RGB-XYZ mapping). The Triad Manipulator is three perpendicular arrows aligned to world axes specifying a 3D position (appears in assemblies; its origin can snap to implicit mate-connector points).
- VIEW CUBE — sits in the upper-right corner of the graphics area; a labeled cube whose SIDES (Top/Bottom/Front/Back/Left/Right) snap to orthographic plane views and whose CORNERS snap to trimetric views; surrounding arrow buttons rotate the model in 15-degree increments (90 or 5 degrees with modifiers). It also exposes the view menu: Isometric/Dimetric/Trimetric, Zoom to Fit, and render modes.
- RENDER / SHADE MODES — Shaded (default, faces + edges), Shaded without edges, Shaded with hidden edges, Hidden edges removed, Hidden edges visible, and Translucent (part shown see-through). Perspective view is a toggle (relative-distance camera) vs default orthographic.
- REALISTIC MATERIALS live in a separate Render Studio (photoreal) — appearances are real material categories (Fabric/Glass/Masonry/brushed aluminum) with parameters that change per material; environments are HDRI-style backdrops that ALSO supply scene illumination; placeable diffuse area lights (shaped, movable, resizable, direction in degrees); ground shadows/contact shadows, reflections, indirect/bounce lighting, bloom (glow/glare around bright sources), and matte fog (Koschmieder atmospheric falloff) for depth. The editing viewport uses flat studio lighting; photoreal look is reserved for Render Studio.
- ALERT / MESSAGE STYLING — info alerts: Dark Blue #094174 text on a light-blue background; warning & error alerts: Very Dark Gray #333333 text on an orange/red background. General system errors surface as a bubble notification at the top of the window.

**Patrones de feedback:**
- HOVER (pre-select) — entity warms to a soft orange (#f3bf8e edges / #d9bfa0 dimensions) and reveals only its own constraint glyphs; midpoints of edges/sketch lines become grabbable on hover; this warm tint is deliberately distinct from the saturated yellow of an actual selection.
- SELECT (click) — entity snaps to Vivid Yellow #ffc107; click again toggles it off. With Create Selection active, your pick is ORANGE and auto-propagated geometry is YELLOW.
- BOX / WINDOW SELECT — direction-encoded: drag LEFT-to-RIGHT = solid BLUE outline + blue-shaded box, selects only fully-enclosed entities; drag RIGHT-to-LEFT = dotted YELLOW outline + yellow-shaded box, selects everything the box touches.
- DRAG (sketch) — only blue (under-defined) geometry responds to dragging; black (fully constrained) geometry is immovable, so the cursor/no-move is itself the feedback that a sketch is locked. As you add constraints/dimensions, entities flip blue→black in real time.
- LIVE OPERATION PREVIEW — while a feature dialog (e.g. Extrude) is open, the result previews live in the graphics area and updates in real time as parameters change; an on-screen manipulator ARROW sets depth/direction (click the arrow to flip direction); a Preview opacity slider (0% = before / 100% = after) lets you blend the proposed result against the current model before committing.
- ACCEPT vs CANCEL — a green CHECKMARK (or Enter) commits the feature; a red X (or Esc) cancels and discards. Dialog TITLE color doubles as a readiness signal: black title = parameters valid/ready to accept, red title = incomplete or erroneous input.
- FIELD-LEVEL ERROR — an invalid input field is outlined in RED; a bad selection shows red in the selection list AND turns the corresponding part/sketch entity red in the graphics area, linking the dialog error to the 3D geometry.
- FEATURE-TREE ERROR/WARNING — problems surface as ORANGE text on the feature in the list and on the dialog title; hovering the orange text pops a tooltip summarizing the issue.
- ERROR-STATE GEOMETRY — an entity in error renders RED #bd3039; selecting an already-red entity deepens it to a darker shade of red (so 'selected + still broken' stays distinguishable).
- CONSTRAINT SUCCESS vs PROBLEM — a healthy constraint badge is a gray square with a black icon; a broken one becomes a red square with a white icon, so constraint health is readable without opening a panel.
- MATE STATUS (assemblies) — mate indicators glow Very Soft Blue #90cef1 when good, Moderate Red #bd3039 when problematic, and Dark Gray #999999 when suppressed/inactive.
- NAVIGATION RESPONSIVENESS (Render Studio) — progressive rendering: resolution drops during camera move for responsiveness then refines back up when the view settles, and an AI denoiser cleans the final frame — the temporary low-res-then-sharpen behavior is itself the 'still computing' cue.

**Fuentes oficiales:**
- https://cad.onshape.com/help/Content/Home/colors.htm
- https://cad.onshape.com/help/Content/Home/selection.htm
- https://cad.onshape.com/help/Content/Home/create_selection.htm
- https://cad.onshape.com/help/Content/Primer/viewing_and_selecting.htm
- https://cad.onshape.com/help/Content/Sketch/working_with_constraints.htm
- https://cad.onshape.com/help/Content/errorindicators.htm
- https://cad.onshape.com/help/Content/View/view_navigation_and_the_view_cube.htm
- https://cad.onshape.com/help/Content/triad.htm
- https://cad.onshape.com/help/Content/moving.htm
- https://cad.onshape.com/help/Content/extrude.htm
- https://cad.onshape.com/help/Content/feature-basics.htm
- https://cad.onshape.com/help/Content/render-studio-interface.htm
- https://cad.onshape.com/help/Content/RenderStudio/render_studio_interface_scene_panel.htm
- https://cad.onshape.com/help/Content/RenderStudio/render_studios.htm

### FreeCAD (official documentation — wiki.freecad.org)

**Convenciones visuales:**
- SELECTION HIGHLIGHT IN 3D VIEW: FreeCAD distinguishes two states with distinct colors set on the Edit > Preferences > Std Base > Selection preferences page (Ctrl+,). 'Preselection' = the color shown when hovering the cursor over an object/sub-element (face, edge, vertex) BEFORE clicking; 'Selection' = the color of an object/sub-element once clicked. Both default to green and are user-configurable. The highlight applies at sub-element granularity: a single hovered face, edge, or vertex lights up, not just the whole body. (Preferences Editor; Selection view)
- NAVIGATION CUBE: persistent gizmo in the TOP-RIGHT corner of the 3D view that both shows current camera orientation and changes it. The main cube has 26 clickable zones: 6 main square faces, 12 rectangular edge faces (since v0.20), and 8 triangular corner faces — each reorients the camera perpendicular to that zone. Surrounded by 4 triangular directional arrows (rotate view 90 deg about a perpendicular axis) and 2 curved arrows (roll). A small mini-cube/round button in the lower-right opens a drop-down menu (Orthographic, Perspective, Isometric, View All, View Selection); a separate corner button flips the view 180 deg about the vertical axis. Faces/buttons highlight on hover with parameter HiliteColor, default 0xaae2ffff (a light cyan-blue, RGBA where AA byte = transparency). (Navigation Cube)
- AXIS CROSS / TRIAD: a color-coded coordinate triad shown via View > Toggle axis cross (Std AxisCross). Axes are color-coded X/Y/Z (conventionally red/green/blue). Inside the Sketcher the origin is a red dot at the center of the coordinate cross, with a pink X-axis and a light-green Y-axis drawn on the sketch plane. (Std AxisCross; Sketcher Tutorial; Glossary)
- SKETCH GEOMETRY COLOR-CODING (state communicated by color): WHITE = normal geometry that still has degrees of freedom (under-constrained); GREEN = the whole sketch (all lines and vertices) once it is FULLY constrained (zero DoF); BLUE = construction geometry (toggled with Sketcher_ToggleConstruction) which only exists to help define constraints/other geometry and is not visible outside the sketch; external/projected geometry uses its own dedicated color. All of these are defaults and are individually re-configurable in Preferences > Sketcher. (Sketcher Workbench; Sketcher_ToggleConstruction; Sketcher Tutorial; Sketcher requirement for a sketch)
- OVER/REDUNDANT/CONFLICTING CONSTRAINTS: if the solver detects a REDUNDANT constraint the sketch turns ORANGE; redundant and conflicting constraints are also reported textually in the 'Solver messages' section of the Sketcher task panel as underlined links — clicking the link selects the offending constraints in the view so they can be deleted. The Sketcher provides dedicated Select Redundant Constraints and Select Conflicting Constraints tools for this. (Sketcher Workbench; Sketcher_SelectConflictingConstraints; Sketcher_SelectRedundantConstraints; Sketcher Micro Tutorial - Constraint Practices)
- DEGREES-OF-FREEDOM READOUT: the Solver messages panel always reports the remaining number of degrees of freedom; Sketcher_SelectElementsWithDoFs highlights exactly which elements are still free, complementing the white-vs-green geometry color. (Sketcher requirement for a sketch; Sketcher_SelectElementsWithDoFs)
- DIMENSIONS / DIMENSIONAL CONSTRAINTS: dimensional (datum) constraints are drawn in the sketch with their numeric value as a label and can be repositioned by holding the left mouse button over the value and dragging. A dimension can be toggled between DRIVING and REFERENCE (driven) mode — reference dimensions do not constrain the sketch and their value is derived from the geometry, visually distinguishing controlling vs. reported dimensions. The doctrine favors geometric constraints over datum/dimensional ones. (Sketcher_ConstrainDistance; Sketcher_ToggleDrivingConstraint; Sketcher Micro Tutorial - Constraint Practices)
- DRAW STYLE / SHADING (how solids are rendered): View > Draw style (Std_DrawStyle) offers As is, Points, Wireframe, Hidden line, No shading, Shaded, and Flat lines (default Flat lines = shaded surfaces + black edges). Per-object Display Mode (Flat lines / Shaded / Wireframe / Points) is set in View > Appearance. (Std_DrawStyle; Std_SetAppearance)
- REALISTIC MATERIALS / APPEARANCE: View > Appearance (Std_SetAppearance, Ctrl+D) sets per-object material from a named material list (filterable by category) plus manual material properties: ambient color (described in the docs as 'the color of shadows on the object'), diffuse color ('the actual/base color of the object'), specular/shininess, and transparency — producing a shaded, lit appearance rather than flat fill. (Std_SetAppearance)
- SKETCH / WORKING-PLANE GRID: a grid is drawn on the working plane to aid placement; spacing, the interval of emphasized 'main lines', and the snapping radius (max distance at which grid snap engages) are all configurable (Draft: Preferences > Draft > Grid and snapping; Sketcher has its own Toggle grid / Toggle snap). The Sketcher also has a 'Switch virtual space' helper to show/hide a secondary layer of constraints. (Draft_Snap_Grid; Sketcher Workbench)
- LIVE PREVIEW BEFORE CONFIRM: feature operations (e.g. PartDesign Pad/Pocket/Revolution, fillet/chamfer) open a Task panel in the combo view and render the resulting solid live in the 3D view as parameters (length, direction, etc.) are edited, so the user sees the outcome before pressing OK; the operation is committed on OK and abandoned on Cancel. (PartDesign Workbench; Basic Part Design Tutorial; PartDesign Hole)

**Patrones de feedback:**
- HOVER (preselection): moving the cursor over geometry highlights the specific sub-element under it (face/edge/vertex) in the Preselection color before any click, previewing what a click would select. In the Navigation Cube, the hovered face/arrow/button lights up with HiliteColor (default light-cyan aae2ffff). (Selection view; Navigation Cube)
- CLICK / SELECT: clicking turns the element to the Selection color; the selection is mirrored in the model tree and the Selection view panel. Clicking an underlined solver-message link in the Sketcher selects the corresponding (conflicting/redundant) constraints. Clicking a Navigation Cube face/arrow animates the camera to that orientation. (Selection view; Navigation Cube; Sketcher Workbench)
- DRAWING WITH AUTO-CONSTRAINTS (snap feedback): while drawing in the Sketcher with Auto constraints enabled (default), a proposed-constraint icon appears next to the cursor whenever the cursor is positioned such that a constraint would be applied (e.g. horizontal/vertical/coincident); when approaching an existing point or the origin, that point highlights and the coincident-constraint icon appears by the cursor — telling the user the new geometry will snap/attach there. (Sketcher Tutorial)
- DRAG: dimensional-constraint labels are repositioned by press-and-drag on the value; geometry/points can be dragged to reshape an under-constrained sketch, and the docs recommend dragging a freshly drawn line to visually confirm whether it is actually attached to neighbors (it moves independently if not constrained). Feature task panels update the live 3D preview continuously as values are dragged/typed. (Sketcher_ConstrainDistance; Sketcher Tutorial; PartDesign Workbench)
- ERROR / CONFLICT STATE: adding a constraint that over-constrains the sketch raises a warning in the combo view asking the user to undo the conflicting constraint; a redundant constraint turns the whole sketch ORANGE; conflicting/redundant constraints are listed as clickable links in the Solver messages section so the user can jump to and delete them. (Sketcher Micro Tutorial - Constraint Practices; Sketcher Workbench)
- SUCCESS / COMPLETION STATE: a sketch with all degrees of freedom removed flips entirely to GREEN and the Solver messages report 'fully constrained' (0 DoF) — the unambiguous 'done/valid' signal. Committing a feature with OK closes the task panel and replaces the live preview with the final shaded solid in the tree and 3D view. (Sketcher Tutorial; Sketcher requirement for a sketch; PartDesign Workbench)

**Fuentes oficiales:**
- https://wiki.freecad.org/Navigation_Cube
- https://wiki.freecad.org/Preferences_Editor
- https://wiki.freecad.org/Selection_view
- https://wiki.freecad.org/Fine-tuning
- https://wiki.freecad.org/Sketcher_Workbench
- https://wiki.freecad.org/Sketcher_Tutorial/en
- https://wiki.freecad.org/Sketcher_requirement_for_a_sketch
- https://wiki.freecad.org/Sketcher_ToggleConstruction
- https://wiki.freecad.org/Sketcher_SelectConflictingConstraints
- https://wiki.freecad.org/Sketcher_SelectRedundantConstraints
- https://wiki.freecad.org/Sketcher_SelectElementsWithDoFs
- https://wiki.freecad.org/Sketcher_ConstrainDistance/en
- https://wiki.freecad.org/Sketcher_ToggleDrivingConstraint/en
- https://wiki.freecad.org/Sketcher_Micro_Tutorial_-_Constraint_Practices
- https://wiki.freecad.org/Std_AxisCross
- https://wiki.freecad.org/Std_DrawStyle
- https://wiki.freecad.org/Std_SetAppearance
- https://wiki.freecad.org/Draft_Snap_Grid/tr
- https://wiki.freecad.org/PartDesign_Workbench
- https://wiki.freecad.org/Basic_Part_Design_Tutorial
- https://wiki.freecad.org/Glossary

### Blender

**Convenciones visuales:**
- SELECCION POR VERTICE: vertices NO seleccionados en negro, seleccionados en NARANJA, y el vertice ACTIVO en BLANCO (punto/dot). El tamano del punto del vertice es configurable en el tema del 3D Viewport.
- SELECCION POR ARISTA: aristas no seleccionadas en negro, aristas seleccionadas en AMARILLO, y la arista ACTIVA en BLANCO.
- SELECCION POR CARA: las caras seleccionadas se sombrean (shade) en NARANJA traslucido sobre la geometria; la cara ACTIVA ademas lleva un BORDE BLANCO que la distingue del resto de las seleccionadas. (docs: modeling/meshes/selecting/introduction)
- Codigo de COLOR DE EJES universal y consistente en todos los gizmos: X = ROJO, Y = VERDE, Z = AZUL. Mismo mapeo en la triada de transformacion, el navigation gizmo y el grid floor.
- NAVIGATION GIZMO en la esquina superior derecha del viewport: 'orbit gizmo' esferico que muestra la orientacion actual de la vista; los extremos de los ejes son etiquetas/bolas coloreadas (X rojo, Y verde, Z azul). El eje positivo es una bola rellena y el negativo una bola hueca/contorno. Arrastrar con LMB orbita; clic en una etiqueta de eje ALINEA la vista a ese eje, y un segundo clic salta al lado opuesto del mismo eje.
- Junto al orbit gizmo, controles flotantes de navegacion: zoom (lupa), pan (mano), toggle camara y toggle perspectiva/ortografica.
- PREVIEW EN VIVO DE LA OPERACION: las herramientas modales (Grab/Mover, Rotate, Scale) muestran el resultado en tiempo real en el viewport mientras se arrastra ANTES de confirmar; el LMB/Enter confirma y RMB/Esc cancela devolviendo todo a su estado original.
- PANEL 'Adjust Last Operation' (redo panel): tras ejecutar una operacion aparece un panel HUD plegable en la esquina INFERIOR IZQUIERDA del viewport con los parametros editables de la ultima operacion; reabrible con F9 como popup. Editar un valor recalcula el resultado al instante (preview no destructivo).
- ENTRADA NUMERICA durante el transform: al teclear numeros durante Grab/Rotate/Scale, los valores aparecen en el FOOTER (pie) del 3D Viewport; Tab/Ctrl-Tab cambia de eje. El eje restringido se resalta con su color (rojo/verde/azul) y una linea-guia de ese eje.
- COTAS / DIMENSIONES via overlay de medicion (grupo Measurement de Viewport Overlays en Edit Mode): muestra NUMERICAMENTE longitud de aristas seleccionadas, area de caras, angulo entre caras y angulo en esquinas de cara, con las unidades definidas en Scene Properties; al transformar, la geometria conectada a la seleccion muestra sus medidas en vivo (p.ej. mover un vertice actualiza las longitudes de aristas conectadas).
- Herramienta interactiva MEASURE (regla): se arrastran lineas en la escena para medir distancias/angulos, con snapping a geometria para precision.
- MATERIALES REALISTAS: el viewport tiene modos de shading; 'Material Preview' renderiza con EEVEE + un HDRI de entorno para previsualizar materiales y pintar texturas; 'Rendered' usa el motor de render real de la escena para preview interactivo del resultado final.
- SHADING SOLIDO (Workbench): geometria solida con iluminacion simplificada sin shader nodes; iluminacion por 'Studio lights' o 'MatCap' (material capture, volteable horizontalmente). Bueno para modelar/esculpir.
- SOMBRAS/AMBIENTE en modo Solid: opcion 'Shadow' (controla el falloff cerca del borde de la sombra), 'Cavity' (resalta crestas y valles de la geometria, metodo preciso-lento o rapido), Ambient Occlusion, y 'Outline' (dibuja un contorno alrededor de los objetos con color ajustable). 'Object Color' usa el color de Viewport Display del objeto.
- REJILLA DEL PLANO (grid/floor): en vista ortografica lateral se muestra una REJILLA (grid); en perspectiva se muestra el PLANO de suelo (ground/floor plane). La distancia entre lineas, el numero de subdivisiones entre lineas mayores, el tamano del grid y el COLOR de las lineas son configurables. Los ejes del mundo se dibujan tambien en el grid floor (lineas roja=X y verde=Y atravesando el origen).
- VALIDEZ DE GEOMETRIA: a diferencia de un CAD parametrico, Blender (malla) NO tiene un solver de restricciones con estado 'sobre-restringido'; la validez se comunica con (a) Face Orientation overlay: caras con normal hacia la camara en AZUL, normal invertida (hacia afuera) en ROJO -> error de normal evidente por color; (b) Mesh Analysis (en Edit Mode + Solid shading): mapea atributos de la malla de ROJO (valor alto) a AZUL (valor bajo), gris para fuera de rango; (c) Select All by Trait > Non-manifold resalta en seleccion aristas/vertices problematicos (sueltos, de borde, de 3+ caras, normales opuestas).

**Patrones de feedback:**
- HOVER de seleccion: el elemento bajo el cursor se pre-resalta; el clic selecciona y lo pinta con el color de seleccion (naranja vertice/cara, amarillo arista).
- SELECCION ACTIVA vs seleccionada: el ultimo elemento clicado (activo) se distingue en BLANCO (vertice/arista) o con BORDE BLANCO (cara) frente al naranja/amarillo del resto seleccionado.
- DRAG de transform (Grab/Rotate/Scale): preview en vivo continuo en el viewport; aparece linea-guia del eje restringido en su color (rojo/verde/azul) y los valores numericos en el footer; soltar = exito (se aplica), Esc/RMB = cancelar (vuelve al estado original).
- EXITO de una operacion: aparece el panel 'Adjust Last Operation' abajo-izquierda con los parametros, confirmando que la operacion corrio y permitiendo afinarla con recalculo inmediato (preview).
- ERROR / advertencia de operador: mensajes de reporte se muestran en la barra de estado / footer; un operador puede fallar sin registrarse en el redo si no aplica.
- ERROR de geometria (normal invertida): se comunica por color en el Face Orientation overlay -> cara ROJA = normal hacia afuera (problema), AZUL = correcta hacia camara.
- PROBLEMAS de malla (no-manifold): se DETECTAN y se RESALTAN como seleccion al usar Select All by Trait > Non-manifold; Mesh Analysis los pinta en gradiente rojo->azul (rojo = valor alto/critico).
- ENTRADA NUMERICA: feedback inmediato de los digitos tecleados en el footer del 3D Viewport mientras la operacion sigue activa (p.ej. S 2 Enter duplica la escala), confirmando el valor antes de aplicar.
- ALINEAR VISTA: clic en una etiqueta de eje del navigation gizmo alinea la camara a ese eje; segundo clic en el mismo eje voltea al lado opuesto (feedback de orientacion inmediato en el orbit gizmo).
- PERSONALIZACION en tiempo real: cambiar colores en Preferences > Themes se refleja al instante en pantalla, confirmando visualmente cada ajuste.

**Fuentes oficiales:**
- https://docs.blender.org/manual/en/latest/modeling/meshes/selecting/introduction.html
- https://docs.blender.org/manual/en/2.80/modeling/meshes/selecting.html
- https://docs.blender.org/manual/en/latest/editors/preferences/themes.html
- https://docs.blender.org/manual/en/latest/editors/3dview/navigate/introduction.html
- https://docs.blender.org/manual/en/latest/editors/3dview/display/gizmo.html
- https://docs.blender.org/manual/en/latest/editors/3dview/navigate/navigation.html
- https://docs.blender.org/manual/en/latest/editors/3dview/display/overlays.html
- https://docs.blender.org/manual/en/latest/scene_layout/object/editing/transform/control/numeric_input.html
- https://docs.blender.org/manual/en/2.83/interface/undo_redo.html
- https://docs.blender.org/manual/en/latest/editors/3dview/toolbar/measure.html
- https://docs.blender.org/manual/en/latest/editors/3dview/display/shading.html
- https://docs.blender.org/manual/en/latest/render/eevee/introduction.html
- https://docs.blender.org/manual/en/latest/render/workbench/options.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/selecting/all_by_trait.html
- https://docs.blender.org/manual/en/latest/modeling/meshes/mesh_analysis.html
- https://docs.blender.org/manual/en/latest/editors/3dview/controls/orientation.html

---

## 3. El ESPINAZO repetido (lo que automatizar)

**Pasos que se repiten en TODO tutorial (~80%):**
- 1) Elegir plano de trabajo (datum XY/YZ/ZX o cara plana del cuerpo) — Fusion: plano base/cara; SOLIDWORKS: Front/Top/Right o plano creado; Onshape: standard plane/face/mate connector; FreeCAD: XY/XZ/YZ_Plane; Blender (analogo, sin plano real): 3D cursor + eje de vista
- 2) Entrar al boceto / modo de edicion sobre ese plano — abre el entorno de sketch alineado normal al plano (Blender: Tab a Edit Mode tras anadir un primitivo)
- 3) Dibujar la geometria 2D (Line/Circle/Rectangle...) colocando los puntos del perfil cerrado (Blender: editar vertices/aristas/caras)
- 4) Acotar y restringir: relaciones geometricas (coincident/parallel/perpendicular/tangent/equal/horizontal/vertical) + cotas dimensionales hasta dejarlo totalmente definido/fully constrained (Blender: numeric input + axis lock + snapping, sin solver real)
- 5) Salir / cerrar el boceto (Finish/Exit/Close sketch; Blender: Tab de vuelta a Object Mode)
- 6) Extruir el perfil cerrado a solido 3D (Extrude E / Boss-Base / Pad; Blender: E Extrude Region)
- 7) Editar sobre una cara: seleccionar una cara plana del solido nuevo, iniciar otro sketch sobre ella y repetir el ciclo (anadir Boss/Pad, cortar Cut/Pocket, o Fillet/Chamfer en aristas)

**Automatizable (una tecla / default / macro):**
- 1) Elegir plano -> default inteligente: arrancar en el plano mas usado (Front/XY) y, si el usuario ya tiene una cara plana seleccionada o el cursor sobre ella, auto-inferir ese plano. Mata el dialogo de 'selecciona un plano' (el friction #1).
- 2) Entrar al boceto -> fundirlo con la accion de dibujar: elegir cualquier herramienta de entidad abre el sketch automaticamente (SOLIDWORKS y Onshape ya lo hacen). El paso 'abrir sketch' deja de existir como click separado.
- 4) Acotar/restringir -> auto-constraint por inferencia mientras dibujas (coincident/horizontal/vertical/coplanar) + snapping a vertice/arista/grid + cota inline; el solver propone el set que deja el boceto fully-defined y el usuario solo corrige. Onshape ('automatic inferencing'), Fusion (auto-constraints) y Blender (snapping) ya tienen las piezas.
- 5) Salir del boceto -> auto-exit al lanzar el feature: SOLIDWORKS ya define 'sales del sketch cuando creas un feature'. Bakearlo: pulsar Extrude cierra el sketch solo, sin Finish/Close manual.
- 6) Extruir -> UNA tecla (E) con auto-seleccion de las regiones cerradas del boceto activo (Onshape ya auto-selecciona closed regions). El perfil cerrado se vuelve solido sin elegir caras a mano.
- 7) Editar sobre una cara -> un click en la cara plana arranca un sketch nuevo sobre ella (saltando el dialogo de plano), reanudando el ciclo dibujar->extruir como macro.
