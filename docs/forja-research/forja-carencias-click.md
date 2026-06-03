## La Forja CAD — carencia de repetición, keymap propio y qué automatizar

### Resumen ejecutivo

Tu motor B-Rep ya tiene lo difícil resuelto: el raycast de cara **YA** te entrega tanto el `faceId` exacto (cada triángulo está etiquetado con su cara OCCT) como el **punto exacto del clic en coordenadas de mundo** (`e.point`, en `handleClick`, `ForgeBRepStudio.tsx:985`). El problema no es que falte información — es que la estás **tirando**. Para colocar un barreno el usuario teclea X,Y en dos sliders, y el engrane se hornea siempre coaxial al origen (`buildGearSolid` clava `x:0, y:0` en la línea 301). En todo CAD de verdad eso se hace **clicando la cara**. Ya tienes el clic; solo no lo conectas al centro del barreno.

### Carencia #1 (P0) — el clic ya existe, conéctalo al centro del barreno

El handler `onPickFace` hoy recibe solo un entero (el `faceId`) y olvida el punto. El fix es chico y **reduce** UI:

1. Cambia la firma `onPickFace: (i: number)` → `(i: number, p?: THREE.Vector3)` y pasa `e.point` desde `handleClick`.
2. En `togglePickFace`, si la op activa es `'hole'`, proyecta ese punto al plano de la cara clicada (usa la normal/centro de la cara, que el kernel ya tesela) y escribe `updateOp(op.id, { x, y })` con la coordenada del clic **en vez de leer los sliders**.
3. En `buildGearSolid` deja de hardcodear `x:0, y:0` y acepta el centro del clic.

Los sliders X/Y no se borran: bajan a **ajuste fino opcional** (numeric input al estilo CAD), ya no son la única vía. Menos fricción, menos UI, cero motor nuevo.

### Carencia #2 (P1) — auto-inferir el plano desde la cara

Hoy el barreno asume siempre el eje Z (`drillHole` con `zTop` fijo, perfil en `PLANE_XY`). Para que el clic funcione en **cualquier** cara, el `HoleOp` debe guardar también la **normal** y el **origen** de la cara (que el teselado ya conoce) y taladrar a lo largo de esa normal. Mientras eso no exista, limita el click-to-place a la cara superior (normal ≈ Z) y marca el resto como "requiere datum". Esto es literalmente el paso 1 de tu espinazo: **el plano de trabajo es la cara que clicaste**.

### Keymap propio — bilingüe, una tecla, sin choques

Mnemónicos que funcionan en **español y en inglés** a la vez, sin colisiones:

| Tecla | ES | EN | Acción |
|---|---|---|---|
| **S** | croquiS | Sketch | Entrar al croquis + caja de atajos al cursor |
| **L** | Línea | Line | Línea |
| **C** | Círculo | Circle | Círculo centro-diámetro |
| **R** | Rectángulo | Rectangle | Rectángulo 2 puntos |
| **D** | Dimensión | Dimension | Acotar (cota) |
| **E** | Extruir | Extrude | Perfil → sólido (cierra el croquis solo) |
| **B** | Barreno | Boring/hole | Barreno: el siguiente clic en la cara fija el centro |
| **F** | Fillet | Fillet | Redondeo de aristas |
| **X** | chaflán | Chamfer | Bisel (X biseca el ángulo; C ya es círculo) |
| **W** | Wall/vaciado | Wall/Shell | Vaciado a pared delgada (S ya es sketch) |
| **V** | reVolución | reVolve | Revolución del perfil |
| **G** | enGrane | Gear | Engrane de involuta |
| **P** | Plano/Pick | Plane/Pick face | Picking de cara = elegir plano |
| **K** | acotar (picK) | picK edge | Picking de arista (eje del revolve) |
| **Esc** | salir | escape | Salir del croquis / cancelar picking |
| **Enter** | repetir | repeat | Confirma + repite la última herramienta |

Las parejas clave son las que pediste: **C = círculo/circle** y **B = barreno/boring**, ambas idénticas en los dos idiomas. La caja `ShortcutOverlay` estilo Fusion (tecla **S**) ya existe en `src/components/ShortcutOverlay.tsx`; solo le llega la lista `tools` vacía. Cablear un `keydown` global que mapee estas teclas a los handlers que **ya tienen los botones** (`addOp`, `applyGear`, `enableFacePick`) — cero lógica nueva, solo un despachador tecla→handler — y que ignore la tecla cuando el foco está en un input (para no robarla mientras editas una cota).

### Qué automatizar de la repetición (el espinazo, horneado)

1. **Elegir plano** → arranca en el plano más usado y, si ya hay una cara seleccionada o el cursor está sobre ella, **auto-infiérelo**. Mata el diálogo de "selecciona un plano".
2. **Abrir croquis** → fúndelo con dibujar: elegir C/L/R **abre el croquis solo** (como SOLIDWORKS y Onshape).
3. **Acotar/restringir** → auto-constraint por inferencia (horizontal/vertical/coincident/snapping) que proponga el set que deja el croquis fully-defined; el usuario solo corrige.
4. **Salir del croquis** → pulsar **E** lo cierra solo y **auto-selecciona las regiones cerradas**. Tu código ya tiene este patrón en `setGear`/`applyGear` ("garantiza el extrude si no existe", líneas 1497-1499); generalízalo a todas las entidades para que nunca exista un "Finish" manual.
5. **Editar sobre una cara** → un clic en la cara plana arranca un croquis nuevo sobre ella, reanudando el ciclo dibujar→extruir como macro.

### Orden recomendado

P0 ya: cablear el clic → centro del barreno (es la joya, y es el fix más barato). Luego P1: keymap + caja de atajos, y guardar normal/origen de cara para barrenos fuera del eje Z. Lo de auto-constraint del croquis libre (P2) puede esperar porque tu motor hoy arranca de perfiles ya cerrados (involuta/engrane).