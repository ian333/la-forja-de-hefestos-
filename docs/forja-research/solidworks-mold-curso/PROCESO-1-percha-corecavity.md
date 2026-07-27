# Mold Design in SolidWorks — Core & Cavity (Hair clip?)

> **Fuente:** video-tutorial del canal **Alwis Design — Tutorial 3D Modeling** (YouTube).
> **Software:** SOLIDWORKS Premium 2022 SP1.0, unidades **MMGS**.
> **Ojo con el título:** aunque el título sugiere "hair clip", la pieza real es un **GANCHO DE ROPA**
> (archivo `HANGER YT.SLDPRT`). Todo el tutorial es sobre la percha.

---

## 1. META del tutorial

- **Pieza:** un gancho de ropa (percha) de polipropileno (PP), importado como sólido a una parte nueva (`Part4`).
- **Molde:** molde de inyección **núcleo/cavidad de 2 cavidades** (la segunda cavidad se genera copiando las superficies y rotándolas 180°), con:
  - superficie de partición construida **A MANO** (croquis + Surface-Extrude + Trim mutuo), no con el comando automático Parting Surfaces;
  - **Tooling Split** para separar núcleo y cavidad;
  - **side cores** (corazones laterales) extraídos con Mold Tools > Core;
  - dos placas rectangulares regularizadas (350 × 630 mm) con drafts, fillets, chaflanes;
  - **4 pernos guía** (Hole Wizard counterbore Ø35, caja Ø40×8) en una placa y **4 bushings guía** (Ø48, caja Ø54×10) en la otra.
- **Resultado final:** dos placas (Hole1 = cavidad, Hole2 = núcleo) que cierran como molde compacto; la intro renderizada (0:00–0:15) muestra la placa cavidad rosa traslúcida arriba, la placa núcleo verde abajo y la percha coral suspendida entre ambas, con los 4 barrenos guía en las esquinas.
- **Todo dentro de UNA sola parte multicuerpo** — nunca se pasa a ensamble.

---

## 2. EL PROCESO paso a paso

### Fase A — Preparar la pieza (0:21–2:06)

1. **Parte nueva** (`Part4`), pestaña Surfaces activa, vista *Trimetric, unidades MMGS.
2. **Insert > Part…** — importa `HANGER YT.SLDPRT` (carpeta YOUTUBE > MOLD HANGER) y lo suelta en la zona gráfica.
   - Opciones: Transfer ☑ **Solid bodies**, ☐ Surface bodies; Configuration: Default.
   - Resultado: `HANGER YT -> (Default)` en el árbol, Solid Bodies(1).
3. **Insert > Features > Scale…** — compensa la contracción del plástico.
   - Opciones: Scale about: **Origin**; ☑ Uniform scaling.
   - Medida: **factor 1.015** (rótulo del video: "Material : PP" → 1.5% de contracción para polipropileno). → `Scale1`.
4. **Reference Geometry > Plane** — plano de asiento de la partición.
   - Opciones: First Reference: **Top Plane**; ☑ Flip offset.
   - Medida: **offset 34.00 mm** hacia abajo, hasta quedar **tangente al punto más bajo del gancho**. → `Plane1`, Fully Defined.
5. **Insert > Features > Move/Copy… #1 (modo Constraints)** — asienta la pieza sobre el plano.
   - Selecciona el cuerpo `<HANGER YT>-<Cut-Extrude5>`, botón **Constraints**, mate **Coincident** entre **Edge<1> + Plane1**. ☐ Copy.
   - Coordenadas mostradas (no tecleadas): -0.1074159 mm / 74.11700347 mm / 14.44287236 mm. → `Body-Move/Copy1`.
6. **Move/Copy Body #2 (Translate/Rotate)** — orienta la pieza.
   - Rotate: teclea 0 en el primer campo de origen de rotación (traía 38.1915411… mm; el otro 14.44287236 mm).
   - Medida: **rotación Y = 90.00°** (X y Z = 0). → `Body-Move/Copy2`; eje largo vertical en vista *Top.
7. **Move/Copy Body #3 (Translate)** — centra respecto al futuro bloque.
   - Medida: **ΔX = 40.00 mm** (ΔY = ΔZ = 0). → `Body-Move/Copy3`.

### Fase B — Parting Lines (2:09–2:27)

8. **Activar pestaña Mold Tools:** clic derecho en el CommandManager > Tabs > **Mold Tools ✓** (Tooling Split aparece gris — aún no hay superficies de partición).
9. **Mold Tools > Parting Lines:**
   - Pull direction: **Top Plane**; botón **Draft Analysis**.
   - Opciones: ☑ Use for Core/Cavity Split; ☑ Split faces; radio "At +/- draft transition".
   - Medida: **draft angle 1.00°**.
   - Resultado: la pieza se pinta VERDE (draft positivo), mensaje verde **"The parting line is complete. The mold can be separated into core and cavity."**, callout **"Parting Line: 18"** (18 aristas por el contorno inferior apoyado en Plane1). → `Parting Line1` (genera Cavity Surface Bodies y Core Surface Bodies).

### Fase C — Superficie de partición A MANO (2:30–5:03)

10. **Vista *Right + Sketch1** sobre el plano de la partición.
11. **Convert Entities** — convierte una por una las aristas del contorno de partición: Edge<1>…Edge<9>.
    - Opciones: Select chain ☐; Inner loops one by one ☐.
    - Medidas: Total Length crece 206.42 mm (3 aristas) → 295.76 → 295.99 → 453.3 → **502.41 mm** al cerrar la cadena completa.
12. **Línea de construcción vertical** desde el origen hacia abajo (☑ For construction).
    - Relaciones: Vertical0 + Coincident10 → Fully Defined. Parámetros mostrados: 116.03472596 mm, 270.00° (valor dinámico al arrastrar: 111.71). Será el **eje de simetría**.
    - (Punto extremo izquierdo del contorno, coordenadas mostradas: X = -256.66449875, Y = -57.31971529.)
13. **Line — extensiones horizontales** desde el extremo IZQUIERDO y el DERECHO del contorno hacia afuera (valor dinámico 133; extremo izquierdo queda en X = -306.46704361, Y = -54.53580586).
14. **Add Relations** con Ctrl+clic en Line1/Line2/Line3 (Total Length seleccionado: 232.05 mm; badges verdes — la relación exacta no se alcanza a leer, ofrece Horizontal/Vertical/Collinear/Parallel/Equal/Symmetric).
15. **Smart Dimension (vertical):** el valor libre 54.53580586 mm se reemplaza por **40** → la línea extendida queda en **Y = -40 mm**.
16. **Smart Dimension (horizontal total):** preview 619.08 → teclea **700.00 mm** de ancho total.
17. **Add Relations: Symmetric** — Line1 (vertical de construcción) + Point32 + Point33 (los dos extremos) → el ancho de 700 queda **centrado en el gancho**. Croquis **Fully Defined** con cotas 40.00 y 700.00.
18. **Surfaces > Extruded Surface** con el croquis de partición.
    - Opciones: From: Sketch Plane; Direction 1: **Mid Plane** (crece simétrica a ambos lados); Draft outward ☐, Cap end ☐.
    - Medida: Depth 10.00 mm inicial → **500.00 mm**. → `Surface-Extrude1`, Surface Bodies(3).
19. **Insert > Move/Copy Body #4 (Copy + Rotate)** — segunda cavidad.
    - Bodies: **Parting Line1[3]** (cavity surface) + **Parting Line1[2]** (core surface).
    - Opciones: ☑ **Copy**, copias = 1; origen de rotación 54.44287236 / 37.87610122 / 0.06520289 mm → lo deja en 0.00 / 0.00 / 0.06520289.
    - Medida: **rotación Y = 180.00°** → copia espejo al lado. → `Body-Move/Copy4[1]` y `[2]`, Surface Bodies(5). **Layout de molde de 2 cavidades.**
20. **Trim Surface** — recorte mutuo.
    - Opciones: Trim Type: **Mutual**; Surfaces: **Surface-Extrude1 + Body-Move/Copy4 + Parting Line1**; radio **Remove selections** (pica en la superficie grande las regiones a eliminar: `Surface-Extrude1-Trim0`, `Surface-Extrude1-Trim1`); Surface Split Options: **Natural**; Create solid ☐.
    - Resultado: `Surface-Trim1` — la superficie de partición con las dos siluetas del gancho recortadas. Árbol: Surface Bodies(5), Solid Bodies(1).

### Fase D — Tooling Split (5:06–6:27)

21. **Vista *Top → Mold Tools > Tooling Split** — pide plano/cara/croquis; elige **Plane1** del flyout del árbol → entra a `Sketch2`.
22. **Center Rectangle** centrado en el origen alrededor de las dos improntas (al vuelo 344.02 / 262.01 mm).
23. **Smart Dimension:** D1@Sketch2 medido 306.20556917 mm → teclea **230**; D2@Sketch2 → **500.00**. Bloque de croquis **230.00 × 500.00 mm**, Fully Defined. Al confirmar aparece solo el PM de Tooling Split.
24. **Tooling Split (PropertyManager):**
    - **Block Size: 145.00 mm (arriba) / 90.00 mm (abajo)** — solo verifica, no los cambia. **Interlock surface: SIN marcar.**
    - **Core:** Parting Line1[2] + **Body-Move/Copy4[2]** (agregado a mano).
    - **Cavity:** Parting Line1[3] + **Body-Move/Copy4[1]** (agregado a mano).
    - **Parting Surface:** **Surface-Trim1** (se pinta morado oscuro).
    - OK → **Solid Bodies(3):** `<HANGER YT>`, `Tooling Split[1]`, `Tooling Split[2]`. Los bloques todavía tienen caras onduladas (siguen la superficie de partición).

### Fase E — Placa CAVIDAD: regularizar + side cores + acabado + pernos guía (6:33–12:06)

25. **Clic derecho en el cuerpo Tooling Split1 > Body > Isolate** — trabaja solo esa mitad.
26. **Sketch3 en Top Plane:** Center Rectangle envolviendo el bloque (al vuelo 383.39 / 581.22) → cotas D1 = 383.38809105 → **350.00**; D2 = 581.22001204 → **630.00**. Rectángulo **350 × 630 mm**, MÁS GRANDE que el bloque 230×500 — será la placa final.
27. **Features > Boss-Extrude1:** From: Sketch Plane; Direction 1: **Up To Surface** → **Face<1>** (cara plana inferior del bloque); **Merge result ☑**; Feature Scope: Selected bodies + Auto-select. (D1 por defecto que mostraba: 500.00 mm.) → la placa ondulada se vuelve **bloque rectangular** con las dos improntas.
28. **Sketch4 sobre la cara superior:** Corner Rectangle lateral ajustado a las aristas (parámetros del PM: -175.00, 315.00, -175.00, -315.00; al vuelo 630) → **Smart Dimension:** 75.13076946 mm → **63.00 mm**. Fully Defined.
29. **Mirror Entities:** Entities to mirror: Line2, Line1, Line4, Line3; ☑ Copy; Mirror about: **Right Plane** → dos rectángulos laterales simétricos.
30. **Mold Tools > Core** — corazones laterales (side cores).
    - Selections: **Sketch4** + **Face<1>** (dirección de extracción) + Core/Cavity Body: **Boss-Extrude1**.
    - Parameters: ☑ Draft outward, **5.00°**; condición Blind arriba y abajo; ☑ Cap ends.
    - Medida: profundidad 158.00 → **200.00 mm** (el preview amarillo debe SOBRESALIR del bloque para garantizar corte pasante). → `Core1` (insertos laterales como cuerpos separados).
31. **Features > Draft (Draft1):** Type: **Neutral Plane**; Neutral Plane: **Face<1>** (cara superior, cian); Faces to Draft: **Face<2>…Face<7>** (paredes del bolsillo, rosas); Face propagation: None. **5.00°**.
32. **Draft (Draft2):** mismo esquema sobre el bloque de las islas levantadas: Neutral Plane Face<1>; Faces to Draft: Face<2>, Face<3>. **5.00°**.
33. **Fillet1 — R20:** Constant Size, Symmetric, Circular, ☑ Tangent propagation; teclea **20** (default 10.00) → las **4 aristas verticales** de las esquinas del bolsillo (Edge<1>…Edge<4>; Length 40.31 mm c/u, Total 120.92 mm).
34. **Fillet2 — R10:** las **2 aristas largas** del escalón superior de la partición (Edge<1>, Edge<2>; Length 223 mm). Deja el default 10.00 mm.
35. **Fillet3 — R5:** 10 → **5.00 mm**; las **2 aristas CURVAS** (perfil S del gancho) del escalón (Edge<1>, Edge<3>; Arc Length 89.58 mm).
36. **Fillet4 — R4:** 5 → **4.00 mm**; los **lazos del perímetro del piso** de cada bolsillo (Edge<1>, Edge<2> — con Tangent propagation el lazo se propaga solo; Length 183.15 mm).
37. **Fillet5 — R4:** perímetro superior del bolsillo (Edge<1>, Edge<2>; **4.00 mm**; Length 190.15 mm al confirmar).
38. **Sketch5 en Top Plane — posiciones de los pernos guía:**
    - Círculo (☑ Diameter dimensions) en la esquina inferior-izquierda, a ojo (centro mostrado: -136.46117757 / -270.25969801) → **Smart Dimension Ø35.00**; posición: **277.00 (vertical)** y **142.00 (horizontal)** respecto al origen.
    - **Mirror Entities:** Arc1 respecto a **Right Plane** (☑ Copy). Status: Diameter: 35mm Center: -142mm, 0mm, 277mm.
    - Segundo círculo esquina inferior-derecha (arrastre: Diameter 46.24 mm, Center 127.12 / 0 / 277) → reacota: **X = 142.00, Y = -277.00**; cota derecha queda **275.00** (así se lee) y la izquierda 277.00.
    - Fully Defined: **Ø35.00 ×2, 142.00 ×2, 277.00 y 275.00** → 4 posiciones de esquina (2 círculos + 2 marcas espejeadas).
39. **Chamfer1:** Angle-Distance; arista inferior de la base (Edge<1>); **10.00 mm × 45.00°**; ☑ Tangent propagation.
40. **Hole Wizard — "Hole for Guide Pins"** (rótulo quemado del video), sobre la cara superior de Tooling Split1:
    - Type: **Counterbored**; End Condition: **Through All**; Feature Scope: Selected bodies + Auto-select.
    - Medidas: default Ø20.00 × 100.00 → **Diameter 35 mm, Depth 235 mm, C-Bore Diam 40 mm, C-Bore Depth 8 mm** (preview: Ø40.00 arriba, caja de 8.00, Ø35.00 pasante).
    - Pestaña **Positions:** un punto por esquina, amarrados a los centros del Sketch5 → Fully Defined → **Hole1** (4 barrenos escalonados).
41. **Exit Isolate** — regresan todos los cuerpos. Inspección del árbol: Solid Bodies(5) con **Core bodies(2)** = Core1[2] y Core1[3] (los insertos con forma de percha, verdes al seleccionar); Surface Bodies(5): Cavity Surface Bodies(1) + Parting Line1[3], Core Surface Bodies(1) + Parting Line1[2], Body-Move/Copy4[1], Body-Move/Copy4[2], Surface-Trim1.

### Fase F — Placa NÚCLEO: fusionar + drafts + fillets (12:30–14:57)

42. **Sketch8 en Top Plane:** Center Rectangle con diagonales de construcción (Add construction lines, From Corners) → cotas **350** y 63→**630** → **350.00 × 630.00 mm**, Fully Defined. (Abre Convert Entities pero no confirma conversión; popup "Save reminder: This document has not been saved for at least 20 minutes".)
43. **Boss-Extrude2:** Direction 1: **Up To Surface** → **Face<1>** (cara inferior del bloque núcleo); ☑ Merge result; Feature Scope: **Selected bodies con Auto-select DESMARCADO** → pick manual: **Tooling Split1[2] + Core1[2] + Core1[3]**. → el lado núcleo queda fundido en UN bloque; **Solid Bodies baja de (5) a (3)**.
44. **Draft3:** Neutral plane = Face<1> (cara superior); Faces to Draft: **Face<2>…Face<7>** (las 6 paredes interiores del bolsillo); Face propagation: None. **5.00°**.
45. **Draft4:** Neutral plane = Face<1>; Faces to Draft: **Face<2>, Face<3>** (las dos caras de los extremos de la superficie de partición en V). **5.00°**.
46. **Cadena de 5 fillets sobre el bloque núcleo:**
    - **R20** (Fillet6): 4 aristas verticales de las esquinas del bolsillo (Edge<1>…Edge<4>; Length 40.31, Total 120.92 mm).
    - **R10** (Fillet7): contorno superior de la isla/escalón + escalón derecho de la zona de colada (Edge<1>, Edge<2>; Length 223 mm).
    - **R4** (Fillet8): las 2 aristas largas curvas del contorno de la partición (Edge<1>, Edge<2>; Arc Length 115.67 mm).
    - **R5** (Fillet9): arista en L del escalón inferior + aro superior del contorno del bloque (Edge<1>, Edge<2>; Normal Distance 493 mm, Total Length 366.31 mm; barra: "No bad faces found").
    - **R4** (Fillet10): las 2 aristas largas inclinadas que flanquean el bolsillo (Edge<1>, Edge<2>; Length 278.14 mm).
47. **Chamfer2:** Angle-Distance, arista inferior del bloque liso (Edge<1>); **10 mm × 45°**.

### Fase G — Bushings guía en la segunda placa + verificación (15:00–fin)

48. **Hole Wizard — "Hole for Guide Bush"** (caption quemado), sobre la cara superior de Tooling Split1 (la otra placa):
    - Type: dropdown "Simple" → cambia a perfil **counterbore**; End Condition: **Through All**; Feature Scope: Selected bodies.
    - Medidas: defaults Ø20 × 100 → tabla inicial 35 / 235 / 40 / 8 → edita: **Diameter 35 → 48 mm; C-Bore Diam 40 → 54 mm; C-Bore Depth 8 → 10 mm**. Final: **Ø48 pasante (Through All, Depth 235 mm en tabla) + caja Ø54 × 10 mm**.
    - Pestaña **Positions:** clics concéntricos a los círculos de las 4 esquinas → Fully Defined → **Hole2**.
49. **Verificación final:** oculta el croquis auxiliar; identifica en Solid Bodies(3) que **Hole1 y Hole2 son las dos placas**; aplica **Change Transparency** a la placa cavidad y orbita el molde cerrado para revisar las cavidades del gancho y los barrenos guía a través del cuerpo traslúcido.

---

## 3. Tabla-resumen del flujo

| # | Etapa | Feature / Herramienta | Parámetros clave |
|---|-------|----------------------|------------------|
| 1 | Importar pieza | Insert > Part | `HANGER YT.SLDPRT`, ☑ Solid bodies |
| 2 | Contracción | Scale | Origin, Uniform, **1.015** (PP = 1.5%) |
| 3 | Plano de asiento | Plane | Top Plane, offset **34.00 mm**, Flip |
| 4 | Posicionar | Move/Copy Body ×3 | Coincident Edge+Plane1 → **Y 90°** → **ΔX 40 mm** |
| 5 | Línea de partición | Parting Lines | Pull: Top Plane, draft **1.00°**, **18 aristas**, Core/Cavity Split ✓ |
| 6 | Croquis de partición | Convert Entities + Line + cotas | contorno **502.41 mm**; eje Symmetric; **40 mm** alto, **700 mm** ancho |
| 7 | Superficie de partición | Surface-Extrude | Mid Plane, **500 mm** |
| 8 | 2ª cavidad | Move/Copy Body (Copy) | cavity+core surfaces, **Y 180°** |
| 9 | Recorte | Trim Surface | **Mutual**, Remove selections, Natural → Surface-Trim1 |
| 10 | Separar molde | Tooling Split | croquis **230 × 500**; bloques **145 / 90 mm**; listas Core/Cavity + Body-Move/Copy4; Parting Surface = Surface-Trim1 |
| 11 | Placa cavidad | Boss-Extrude1 | croquis **350 × 630**, Up To Surface, Merge |
| 12 | Side cores | Mold Tools > Core | Sketch4 (**63 mm** + Mirror), draft **5°**, **200 mm**, Cap ends |
| 13 | Salidas cavidad | Draft1, Draft2 | Neutral Plane (cara sup.), **5.00°** |
| 14 | Redondeos cavidad | Fillet1–5 | **R20 → R10 → R5 → R4 → R4** |
| 15 | Chaflán base | Chamfer1 | **10 mm × 45°** |
| 16 | Pernos guía | Sketch5 + Hole Wizard | Ø35 en **142 / 277**; Counterbored **Ø35 pasante + caja Ø40×8**, Through All |
| 17 | Placa núcleo | Boss-Extrude2 | **350 × 630**, Up To Surface, Feature Scope manual (Tooling Split1[2] + Core1[2] + Core1[3]) |
| 18 | Salidas núcleo | Draft3, Draft4 | Neutral Plane, **5.00°** |
| 19 | Redondeos núcleo | Fillet6–10 | **R20 → R10 → R4 → R5 → R4** |
| 20 | Chaflán base | Chamfer2 | **10 mm × 45°** |
| 21 | Bushings guía | Hole Wizard | Counterbore **Ø48 pasante + caja Ø54×10**, Through All |
| 22 | Verificación | Change Transparency | molde cerrado, cavidades visibles a través de la placa |

---

## 4. Trucos y gotchas del instructor

- **Escala ANTES que todo lo demás.** El Scale 1.015 (contracción del PP) va inmediatamente después de importar, sobre Origin y uniforme. Si escalas después de construir el molde, las cavidades quedan chicas.
- **Posicionar con Move/Copy Body en modo Constraints, no a ojo.** Crea primero un plano tangente al punto más bajo (offset 34 mm) y ASIENTA la pieza con un mate Coincident dentro de la parte — el "ensamble dentro del part". Después rota (90° Y) y traslada (40 mm X) en operaciones separadas y legibles.
- **La superficie de partición se construye A MANO** (Convert Entities del contorno de la parting line + extensiones + Surface-Extrude Mid Plane + Trim Mutual), no con el botón Parting Surfaces. Eso le da control total para el layout de 2 cavidades.
- **Molde de 2 cavidades sin repetir el análisis:** copia las superficies cavity/core de `Parting Line1` con Move/Copy Body (☑ Copy) y **rotación Y 180°** — la copia espejo ES la segunda cavidad. Gotcha: cerar los campos de origen de rotación (traen el centroide) antes de teclear el ángulo.
- **Tooling Split se llena a mano:** las superficies copiadas (`Body-Move/Copy4[1]/[2]`) hay que AGREGARLAS a las listas Cavity y Core respectivamente — el comando no las toma solo. Hacer hover en el árbol ilumina cada cuerpo en naranja para identificar cuál es cuál.
- **Regularizar los bloques ondulados con Boss-Extrude "Up To Surface" + Merge result:** croquis rectangular más grande (350×630 vs 230×500 del split) extruido hasta la cara plana opuesta convierte la placa de tapa ondulada en bloque rectangular macizo. En el lado núcleo, **desmarcar Auto-select** en Feature Scope y elegir a mano los 3 cuerpos (bloque + 2 side cores) para fundirlos en uno.
- **Isolate para trabajar cada mitad** (clic derecho > Body > Isolate) — evita seleccionar caras del cuerpo equivocado; Exit Isolate al terminar.
- **Core (side cores) con corte garantizado:** subir la profundidad (158 → 200 mm) hasta que el preview amarillo SOBRESALGA del bloque; Draft outward 5° + Cap ends.
- **Draft siempre Neutral Plane = cara superior de la placa, 5°,** y las paredes del bolsillo una por una. El draft va DESPUÉS de fusionar el bloque y ANTES de los fillets.
- **Orden de fillets de mayor a menor radio** (R20 esquinas verticales → R10 escalones → R5 curvas → R4 perímetros) — "matar todas las esquinas" para que el bloque sea maquinable. Tangent propagation ✓ hace que un clic tome el lazo completo.
- **Regla de croquis del tutorial (la misma de La Forja):** dibujar a ojo → restringir → ACOTAR. Los valores crudos (383.38809105, 75.13076946, 127.11629225…) siempre se sobreescriben en el cuadro Modify; nunca se teclean coordenadas.
- **Simetría antes que aritmética:** eje vertical de construcción + relación Symmetric para centrar el ancho de 700; Mirror Entities respecto a Right Plane para side cores y posiciones de barrenos.
- **Pin y buje se corresponden:** placa A = pernos guía Ø35 con caja Ø40×8; placa B = bushings Ø48 con caja Ø54×10 — mismas posiciones (142 / 277 desde el origen), colocados en Positions del Hole Wizard amarrando a los centros del croquis previo.
- **Gotcha del Hole Wizard:** la tabla puede mostrar Depth 235 mm aunque el End Condition sea Through All — manda Through All (el barreno atraviesa).
- **Interlock surface se deja SIN marcar** en el Tooling Split (este diseño alinea con pernos/bujes, no con interlock cónico).
- **Verificación visual final con Change Transparency** en una placa: el molde cerrado deja ver cavidades y barrenos a través del cuerpo traslúcido — el equivalente al "corte de rayos X" antes de dar por bueno el diseño.
- Detalle honesto del registro: una cota de posición se lee **275.00** del lado derecho contra **277.00** del izquierdo en pantalla (probable redondeo del video); las demás cotas de posición son 142/277.