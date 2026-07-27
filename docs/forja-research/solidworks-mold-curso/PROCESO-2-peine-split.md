# Split Core & Cavity in SolidWorks — Hair Comb

> Tutorial: **Alwis Design — Tutorial 3D Modeling** ("Hair Clip Mold"). SOLIDWORKS Premium **2023 SP0.1**. Síntesis literal del proceso completo, paso a paso, para el corpus de forja-research.

---

## 1. META del tutorial

- **Piezas**: DOS piezas distintas de plástico — una **pinza de pelo grande tipo claw** (HAIR CLIP 1, 3,897 KB) y un **peine chico** (HAIR CLIP 2, 1,927 KB).
- **Molde**: molde **FAMILIA de 2 cavidades** (una huella por pieza), con **partición ondulada (no plana)**: placa cavidad (verde) arriba, placa núcleo (rosa) abajo, huellas pintadas en rojo.
- **Material**: **ABS**, contracción **0.6% → factor de escala 1.006**.
- **Filosofía del flujo**: todo ocurre **dentro de UNA parte multicuerpo** (Part2), NO en un ensamble. Las piezas se insertan como cuerpos sólidos, se escalan, se posicionan, y el molde se talla con Mold Tools + superficies manuales.
- **Lo distintivo**: la superficie de partición y los shut-offs se construyen **A MANO** (3D Sketch + Convert Entities + Extruded/Boundary/Filled Surface + Knit), NO con las herramientas automáticas Shut-off Surfaces / Parting Surfaces. La herramienta automática solo se usa para **Parting Lines** y el **Tooling Split** final.

---

## 2. EL PROCESO paso a paso

### Fase A — Layout multicuerpo (0:00–3:00)

1. **Insert > Part...** (caption "Import Part File") en un documento de parte NUEVO y vacío (Part2). En el diálogo Open: carpeta MOLD HAIR CLIP → **HAIR CLIP 1** (Configuration: Default; filtro `*.sldprt;*.prt`).
2. **Insert Part (PropertyManager)**: OK para insertar **EN EL ORIGEN**. Transfer: **Solid bodies ✓, Cosmetic threads ✓**; Surface bodies ☐, Axes ☐, Planes ☐. En el árbol queda `HAIR CLIP 1 -> (Default)` como parte externa.
3. **Insert > Features > Scale...**: Scale about **Origin**, **Uniform scaling ✓**, factor **1.006** (recuadro didáctico: "Material ABS / Shrinkage: 0.6% or 1.006"). Queda **Scale1**. *La contracción se compensa ANTES de tallar el molde.*
4. **Insert > Features > Move/Copy... (rotación)**: cuerpo `<HAIR CLIP 1>-<Stock-...>`, **Copy ☐** (mueve, no copia). El punto de rotación traía coordenadas residuales (**-0.51465851, -15.05310133, 10.76306387 mm**) → las **teclea a 0,0,0** una por una. Rotación: **180.00°** alrededor del **eje Z** (los otros ángulos 0.00°). Queda **Body-Move/Copy1**.
5. **Move/Copy... (traslación)**: mismo cuerpo, sección Translate: **ΔX = 0.000000 mm, ΔY = 15.000000 mm, ΔZ = 30.000000 mm**. Queda **Body-Move/Copy2** — la pinza queda en su posición del layout de 2 cavidades.
6. **Insert > Part... (segunda pieza)**: HAIR CLIP 2, mismas opciones de Transfer, insertada en el origen. → Solid Bodies(2).
7. **Scale (pieza 2)**: about Origin, Uniform, **1.006**. Queda **Scale2**.
8. **Move/Copy (rotar pieza 2)**: limpia igual las coordenadas residuales a 0,0,0; rotación **180.00° en el eje Y** (segundo campo). Queda **Body-Move/Copy3** — las dos piezas quedan **espalda con espalda** para la partición.
9. **Move/Copy (trasladar pieza 2)**: **ΔX = 0, ΔY = 15.000000 mm, ΔZ = 30.000000 mm**. Queda **Body-Move/Copy4**. *Patrón: 2 Move/Copy por cuerpo, 4 features en total.*
10. **Appearances** (toolbar contextual del cuerpo): color a cada cuerpo (marco en khaki claro, peine en amarillo intenso) para distinguir core/cavity después.

### Fase B — Parting Lines (3:00–5:00)

11. **Pestaña Mold Tools** (si no aparece: click derecho sobre las pestañas del CommandManager → **Tabs → Mold Tools ✓**). Tooling Split sale **gris** — aún no hay parting lines ni superficies.
12. **Parting Lines (cuerpo 1, el marco)**: selecciona el cuerpo (Solid Body<1>), marca **Split faces ✓**, dirección de extracción = **Top Plane** (del árbol flyout), **Use for Core/Cavity Split ✓**, radio **At +/- draft transition**, draft **1.00°**. Pulsa **Draft Analysis**: el cuerpo se pinta **verde (positivo) / rojo (negativo)** y SolidWorks encadena **78 aristas** automáticamente.
13. **Edición manual de la cadena**: zoom a la frontera verde/rojo y agrega a mano las aristas faltantes (de 78 → **87 aristas**) hasta que el mensaje se pone **VERDE**: *"The parting line is complete. The mold can be separated into core and cavity."* → **ese mensaje verde es el criterio de éxito**. Queda **Parting Line1** + carpeta Surface Bodies(2).
14. **Parting Lines (cuerpo 2, el peine)**: mismo setup (Top Plane, 1.00°, Use for Core/Cavity Split ✓). El análisis arroja **WARNING AMARILLO**: *"...the mold cannot be separated into core and cavity. You may need to create shut-off surfaces."* con solo **9 aristas**. Marca **Split faces ✓** y pica manualmente arista por arista sobre el filo verde/rojo hasta cerrar el lazo: **87 aristas** → mensaje verde. Queda **Parting Line2**; el árbol llega a **Surface Bodies(4)** (carpetas **Cavity Surface Bodies(2)** y **Core Surface Bodies(2)**).

### Fase C — Shut-offs de barrenos con Delete Face (5:00–6:00)

15. **Inspección**: los **barrenos pasantes de las orejas/bisagras** de ambos clips quedaron abiertos (agujeros que la parting line no cierra). *Los cierra borrando las caras cilíndricas, NO con la herramienta Shut-off Surfaces.*
16. Habilita la pestaña **Direct Editing** (click derecho en pestañas → Tabs). Trae: Move Face, Fillet, Chamfer, Delete/Keep Body, **Delete Face**, Split, Combine.
17. **Delete Face (clip 1)**: selecciona las **4 caras cilíndricas** de los 2 barrenos (ambos lados), opción **"Delete and Patch"**, Show preview ✓. Status bar: Total area **14.861848 mm²** (2 caras) → **29.719545 mm²** (4 caras). Queda **DeleteFace1**.
18. **Delete Face (clip 2)**: mismas 4 caras (**Radius: 0.9054 mm** al pickear; Total area **29.719545 mm²**). Queda **DeleteFace2** — ambos cuerpos sin agujeros.

### Fase D — Superficie de partición manual, clip 1 (6:00–7:30)

19. **3D Sketch + Convert Entities (3DSketch1)**: pica una por una las aristas de la línea de partición del clip 1 (Edge<1>…Edge<6>), rotando entre picks. Total Length acumulada: 14.051487 → 17.454651 → 34.942364 → 39.800432 → **67.865518 mm**; estado pasa a **Fully Defined**.
20. **Extruded Surface** sobre el 3DSketch1: From Sketch Plane, Direction 1 **Blind**, **Direction of Extrusion = Right Plane** (un croquis 3D no trae plano implícito), profundidad 10 mm default → **80.000000 mm**. Draft outward ☐, Cap end ☐. Queda **Surface-Extrude1** (faldón lateral).
21. **Mirror (Features)**: Mirror Face/Plane = **Right Plane**, **Bodies to Mirror** = Surface-Extrude1 (cuerpo de superficie, NO Features to Mirror). Merge solids ☐, Knit surfaces ☐, Propagate visual properties ✓, Partial preview. Queda **Mirror1**, Surface Bodies(6).

### Fase E — Parches Boundary Surface entre dientes del peine (7:30–10:12)

22. **Ciclo del parche** (se repite **6 veces**, uno por cada ventana entre dientes):
    1. **Boundary Surface** (pestaña Surfaces).
    2. **Clic DERECHO en el viewport → SelectionManager** (caption "Right Click on the Mouse").
    3. Con **Select Open Loop**: cadena de aristas del costado de un diente → **Open Group<1>** (palomita verde de la barrita).
    4. Otro clic derecho → SelectionManager → cadena del diente OPUESTO → **Open Group<2>**. Aparece el preview beige del parche.
    5. (A veces) **Direction 2** = una arista transversal del fondo del hueco (**Edge<1>**), con **Dir1/Dir2 curves influence = Global**.
    6. Tangencia **None** en todos los grupos, **0.00°**; **Merge tangent faces ✓**; Trim by direction 1 ☐. OK.
    - Resultado acumulado: **Boundary-Surface1…6**, Surface Bodies 6 → **12**.
23. Apariencia de las superficies de partición: **Plain White** — contraste deliberado pieza roja vs superficies blanco-plata.

### Fase F — Faldón perimetral + ventana del asa, clip 1 (10:18–12:30)

24. **3D Sketch + Convert Entities (3DSketch2)**: copia el **perímetro completo** de la superficie de partición arista por arista (Edge<1>…Edge<29>, con scroll en la lista). Total Length crece: 80 → 81.775004 → 83.033340 → 99.107214 → 108.901065 → 117.727937 → 126.682297 → 135.664826 → 144.550123 → 153.289465 → 170.278392 → 171.019716 → 171.413857 → 177.602142 → **259.377297 mm** → Fully Defined.
25. **Extruded Surface** del perímetro: Blind, **dirección = Front Plane**, **80.000000 mm**. El faldón queda a ambos lados → Surface Bodies(24).
26. **Filled Surface** (ventana del asa del clip): pica el lazo de **9 aristas** (Edge<1>…Edge<9>), todas con condición **Contact - S0 - Boundary**; **Optimize surface ✓**, Show preview ✓; Fix up boundary / Merge result / Create solid / Reverse direction todos ☐. → Surface Bodies(25).
27. **Mirror**: Mirror Face/Plane = **Front Plane**, Bodies to Mirror = Surface-Extrude1 (el faldón de 80 mm). Al confirmar → Surface Bodies(27).

### Fase G — Shut-offs del clip 2 (12:45–16:09)

28. **Filled Surface** (abertura central del broche): lazo de **9 aristas** en Contact (las aristas pertenecen a Parting Line2) → Surface Bodies(28).
29. **4 Boundary Surface consecutivos** para los huecos entre dientes del peine, con el mismo ciclo SelectionManager (2 Open Groups + arista de partición en Direction 2, Global, None/0.00°, Merge tangent faces ✓) → Surface Bodies 29, 30, 31, **32**. *En 13:54 usa "Clear Selections" del menú contextual para reiniciar una selección equivocada.*
30. **2 Boundary Surface más** (huecos entre dientes y superficie de partición): en uno la caja Direction 2 muestra **`**Error**Edge<1>`** — aun así da OK y **la superficie se genera de todas formas** al reconstruir → Surface Bodies 33, **34**.

### Fase H — Faldón perimetral completo + puente central (16:12–18:24)

31. **3D Sketch + Convert Entities (3DSketch3)**: recorre TODA la silueta de la partición de AMBAS mitades (~**29 aristas**, Total Length: 99.107214 → 100.592956 → 101.442118 → 108.901065 → 126.682297 → 127.849723 → 136.832284 → 153.892695 → 170.278392 → 170.672533 → 172.119747 → 177.602142 → **259.377297 mm**, Fully Defined).
32. **Extruded Surface**: Blind **80.000000 mm**, dirección = **Front Plane**, Draft outward ☐, Cap end ☐ → Surface Bodies(46). *La falda se extiende de sobra para luego recortarla al tamaño del bloque.*
33. **Boundary Surface (puente central)**: rellena el hueco de partición ENTRE las dos regiones de los clips — clic derecho → SelectionManager → cadenas tangentes de cada lado como **Open Group<1>/<2>** (tangencia None, 0.00°), Merge tangent faces ✓ → Surface Bodies(47).

### Fase I — Knit + Tooling Split (18:36–20:00)

34. **Knit Surface**: cose **~26 superficies** del lado cavidad (extrudes, boundaries, mirrors) clicándolas una por una. **Create solid ☐, Merge entities ☐**; Knitting tolerance **0.0025 mm**; Show gaps in range **0.0025–0.1 mm**; gaps detectados **0.00255–0.02011 mm**. Corrige selecciones con clic derecho en la lista. Resultado: Surface Bodies cae de **47 a 7**.
35. **Move/Copy Body (posicionamiento final)**: con los **9 cuerpos** (2 sólidos + 7 superficies) y un mate **Coincident** entre la cara de partición (Face<1>) y el **Top Plane** — la partición queda alineada al plano del split.
36. **Tooling Split** (Mold Tools) sobre el **Top Plane**: croquis con **Center Rectangle 120.00 × 180.00 mm**; bloque **40 mm / 40 mm** (arriba/abajo), checkbox **Interlock surface SIN marcar**; asigna **A MANO** los cuerpos: **Core = Body-Move/Copy5[7],[6]**, **Cavity = [8],[9]**, **Parting Surface = [3],[5],[4]**. Al confirmar → **Solid Bodies(4)** con los dos medios-moldes.

### Fase J — Interlocks manuales + acabado del núcleo (20:00–fin)

37. **Isolate** del núcleo (clic derecho → Isolate). Pinta de **rojo** (Appearances → color standard) las caras de **Parting Line1 y Parting Line2** sobre el bloque gris para visualizar las huellas.
38. **Interlocks de esquina (croquis)**: en la cara del núcleo, **Corner Rectangle 40.00 × 40.00** con **Sketch Fillet R10** en la esquina interior; **Mirror** del croquis sobre **Right Plane** y luego **Front Plane** → las 4 esquinas.
39. **Mold Tools → Core**: Sketch3 + Face<1> + cuerpo **Tooling Split1[1]**; draft **10° "Draft outward"**; **Blind 10 mm en ambas direcciones**; **Cap ends** → talla los **4 postes de esquina** (interlocks).
40. **Insert > Features > Combine (Add)**: une **Tooling Split1[2] + Core1[2..5]** en un solo sólido (medio molde núcleo + sus 4 insertos).
41. **Move Face (Offset)**: **1 mm, Flip direction** — rebaja las caras superiores de los 4 postes interlock (holgura de asiento).
42. **Chamfer 5 mm × 45°** en la arista perimetral inferior del bloque.
43. **Chamfer 1 mm × 45°** en las aristas superiores de los 4 interlocks.
44. **Fillet Constant Size 2 mm** en las 4 aristas verticales de esas esquinas (total **30 mm de arista**).
45. **Show** del cuerpo Core1[1] (la otra mitad) para continuarla.
46. **Chamfer 2 mm × 45°** (Tangent propagation, Full preview) sobre las **4 aristas curvas** de los postes interlock en la cara de partición (status: Radius **10 mm**, Total Length **47.12389 mm**); **chamfer 5 mm × 45°** en UNA sola arista vertical de esquina de la placa como **referencia de orientación**.
47. **Appearance por cuerpo** (carpeta Solid Bodies(4)): **rosa** al cuerpo 'Chamfer4' (la mitad con las 2 impresiones = núcleo) y **verde claro** al cuerpo 'Fillet1' (cavidad). Verifica alternando **Wireframe / Shaded With Edges** con zooms a la línea de partición ondulada y su interlock.

---

## 3. Tabla-resumen del flujo

| # | Etapa | Feature / Herramienta | Parámetros clave |
|---|-------|----------------------|------------------|
| 1 | Insertar piezas | Insert > Part ×2 | Solid bodies ✓ + Cosmetic threads ✓; en el origen; parte multicuerpo (no ensamble) |
| 2 | Contracción | Scale ×2 (Scale1/Scale2) | About Origin, Uniform, **1.006** (ABS 0.6%) |
| 3 | Layout | Move/Copy Body ×4 | Rot **180° Z** (clip 1) / **180° Y** (clip 2), punto rotación 0,0,0; Translate **Y=15, Z=30 mm** |
| 4 | Colores | Appearances | Un color por cuerpo (distinguir core/cavity) |
| 5 | Línea de partición | Parting Lines ×2 | Top Plane, **1.00°**, Use for Core/Cavity Split ✓, Split faces ✓, At +/- draft transition; 78→**87** aristas (marco), 9→**87** (peine, con warning de shut-off) |
| 6 | Shut-off barrenos | Delete Face ×2 (Direct Editing) | **Delete and Patch**, 4 caras c/u; áreas 14.861848→**29.719545 mm²**; R 0.9054 mm |
| 7 | Faldón clip 1 | 3DSketch1 + Convert Entities → Surface-Extrude → Mirror | Perímetro **67.865518 mm**; Blind **80 mm** dir. Right Plane; Mirror Right Plane (Bodies) |
| 8 | Parches dientes | Boundary Surface ×6 | SelectionManager, Open Group<1>/<2>, Dir 2 = Edge, Global, None, 0.00°, Merge tangent faces ✓ |
| 9 | Faldón perimetral | 3DSketch2 + Convert Entities → Surface-Extrude → Mirror | ~29 aristas, **259.377297 mm**; Blind **80 mm** dir. Front Plane; Mirror Front Plane |
| 10 | Shut-off asa/abertura | Filled Surface ×2 | **9 aristas** c/u, Contact - S0 - Boundary, Optimize surface ✓ |
| 11 | Más parches peine | Boundary Surface ×6 | Mismo ciclo; tolera `**Error**Edge<1>` |
| 12 | Faldón total + puente | 3DSketch3 → Surface-Extrude + Boundary Surface | ~29 aristas **259.377297 mm**; Blind **80 mm** Front Plane; puente entre regiones |
| 13 | Coser | Knit Surface | ~26 superficies, tolerancia **0.0025 mm**, gaps 0.00255–0.02011 mm; Surface Bodies 47→**7** |
| 14 | Alinear | Move/Copy Body (mate) | Coincident: cara de partición ↔ Top Plane; 9 cuerpos |
| 15 | Partir el bloque | Tooling Split | Top Plane, Center Rectangle **120 × 180 mm**, bloque **40/40 mm**, sin interlock automático; Core/Cavity/Parting Surface asignados a mano |
| 16 | Interlocks | Sketch (Corner Rect **40×40**, Fillet **R10**) + Mold Tools Core | Draft **10° outward**, Blind **10 mm** ambas dir., Cap ends; 4 postes |
| 17 | Unir | Combine (Add) | Tooling Split1[2] + Core1[2..5] |
| 18 | Ajustes | Move Face + Chamfers + Fillet | Offset **1 mm** Flip; chaflanes **5×45°**, **1×45°**, **2×45°** (Tangent propagation); Fillet **2 mm** (30 mm de arista) |
| 19 | Presentación | Appearances por cuerpo | Núcleo rosa / cavidad verde; verificación Wireframe/Shaded |

---

## 4. Trucos y gotchas del instructor

1. **Multicuerpo, no ensamble**: todo el molde familia vive en UNA parte. Insert > Part trae las piezas como cuerpos sólidos y cada operación de molde es una feature más del árbol — historial completo y editable.
2. **Scale ANTES que todo**: la contracción (1.006 para ABS) se aplica inmediatamente después de insertar, antes de cualquier línea de partición. Si escalas después, las superficies ya talladas no corresponden.
3. **Cero el punto de rotación**: Move/Copy Body arrastra coordenadas residuales en el punto de rotación (p. ej. -0.51465851 mm…) — el instructor las teclea a 0,0,0 SIEMPRE antes de rotar. Si no, la rotación ocurre alrededor de un punto arbitrario.
4. **El mensaje VERDE es el gate**: en Parting Lines, el criterio de éxito es literal — *"The parting line is complete. The mold can be separated into core and cavity."* El amarillo (*"...you may need to create shut-off surfaces"*) significa que hay pasajes abiertos: o los cierras o el Tooling Split fallará.
5. **Draft Analysis encadena, tú completas**: el botón detecta la mayoría de las aristas (78 de 87 en el marco), pero en geometría ondulada hay que picar a mano las que faltan siguiendo la frontera verde/rojo hasta cerrar el lazo. Zoom extremo + rotación constante.
6. **Delete Face "Delete and Patch" como shut-off exprés**: para barrenos cilíndricos simples es más rápido borrar las caras del agujero en las superficies copiadas que usar la herramienta Shut-off Surfaces. Genera el parche automáticamente.
7. **Croquis 3D no tiene plano**: toda Extruded Surface sobre un 3D Sketch necesita una **referencia explícita de dirección** (Right Plane / Front Plane pickeados del árbol flyout en el viewport). Sin eso el comando no sabe hacia dónde extruir.
8. **SelectionManager = clic derecho**: la única forma de meter CADENAS de aristas del modelo como perfil de un Boundary Surface es clic derecho → SelectionManager → Select Open Loop. Los grupos entran como Open Group<n>; "Clear Selections" del mismo menú reinicia una selección equivocada.
9. **Boundary Surface con Direction 2**: en huecos con fondo curvo, una arista transversal en Direction 2 (influencia Global) controla la forma del parche para que siga la partición ondulada, no un puente recto.
10. **Los `**Error**` de selección a veces se resuelven solos**: un `**Error**Edge<1>` en Direction 2 no detiene la reconstrucción — dar OK y dejar regenerar puede producir la superficie correcta. Verificar visualmente después.
11. **Extruir de sobra y recortar después**: el faldón se extruye 80 mm — mucho más que el bloque — porque el Tooling Split lo recorta al tamaño del rectángulo (120×180). Nunca intentes extruir "exacto".
12. **Knit con Gap Control**: coser a tolerancia 0.0025 mm y REVISAR la lista de gaps (0.00255–0.02011 mm aquí). Surface Bodies desplomándose de 47 a 7 es la señal de que la costura agarró.
13. **Asignación manual en Tooling Split**: con superficies hechas a mano, SolidWorks no adivina qué es Core/Cavity/Parting Surface — se asignan cuerpo por cuerpo en las tres cajas del PropertyManager.
14. **Interlocks a mano > checkbox**: en vez del "Interlock surface" automático (que quedó desmarcado), talla postes de esquina propios: croquis 40×40 R10 espejeado a las 4 esquinas + Mold Tools Core con draft 10° outward, y luego **Move Face -1 mm** para la holgura de asiento + chaflanes 1×45° para la entrada.
15. **Un chaflán como testigo de orientación**: el chaflán 5×45° en UNA sola esquina vertical de la placa marca la orientación del molde (foolproofing) — truco estándar de moldista.
16. **Color como documentación**: piezas amarillas, huellas rojas, núcleo rosa, cavidad verde, superficies Plain White — cada color separa un rol. La verificación final es visual: Wireframe/Shaded With Edges con zoom a la partición ondulada y su interlock.