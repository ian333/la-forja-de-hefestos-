# Verificaciones VISUALES del libro de Kazmer

**Fuente:** David O. Kazmer, *Injection Mold Design Engineering* (caps. 1–13, texto completo extraído).
**Propósito:** enumerar todo punto donde el libro juzga un diseño **MIRANDO una vista**, para construir
un juez con OJOS (hoy solo juzgamos con números).

**Regla de este documento:** cada ficha cita § y figura con su *caption* literal en inglés. Cuando el
libro muestra la figura **sin criterio verbal**, se dice explícitamente. Nada se inventa. Todas las citas
fueron verificadas con `grep` contra el texto extraído.

---

## Resumen ejecutivo

- **122 fichas de verificación visual**, repartidas sobre ~200 figuras de los 13 capítulos.
- **31 son PARES o TRÍADAS bueno/malo explícitas** (el libro enseña comparando; ese es el oro).
- **58 son juzgables por píxeles al 100%** (distancia, área, conteo de contornos, % de mapa de color),
  **41 PARCIAL** (necesitan un dato del modelo además de la imagen), **23 NO** (requieren criterio de experto
  o son puramente descriptivas).
- El libro tiene **un idioma visual repetido**: mapa de contornos (isócronas de llenado, isotermas de 2 °C,
  isolíneas de desplazamiento de 0.01 mm), sección achurada del molde, planta del plano de partición, y
  vista *lay-flat* de la pieza desplegada. Un juez con ojos que domine esas cuatro vistas cubre el 80 % del libro.

### TOP-10 por importancia (las que más deciden si un molde sirve)

| # | Verificación | § / figuras | Por qué manda |
|---|---|---|---|
| 1 | **Ruteo de líneas de enfriamiento** (inviable → factible pero pobre → gradiente térmico) | §9.2.7 · Fig 9.9 → 9.10 → 9.11 | Es la tríada malo→malo→consecuencia más explícita del libro. Decide ciclo, contracción diferencial y alabeo. |
| 2 | **Layout de pines expulsores** (lejos de paredes → cerca → bajo costilla → contorneados) | §11.2.5 · Fig 11.10 → 11.11 → 11.12 → 11.13 | El par canónico. Un layout malo deforma la pieza en cada ciclo. |
| 3 | **Patrón de llenado: race-tracking, línea de soldadura y trampa de gas** | §5.5.4 · Fig 5.17 · §5.5.5 Fig 5.20 | La trampa de gas quema la pieza y "es difícil de ventear". Se VE en el patrón, no en un número. |
| 4 | **Las dos formas de alabeo** (a través del espesor vs. a través del área) | §10.3 · Fig 10.14 y 10.15 | Alabeo = el defecto que mata la pieza. Puramente visual: una curva, un pandeo. |
| 5 | **Deflexión del molde vs. espesor del venteo** | §12.1.2 · Fig 12.6 | 0.36 mm de separación contra 0.02 mm de vent ⇒ *"significant amount of flashing is expected"*. |
| 6 | **Espesor de pared uniforme y sus transiciones** | §2.3.1 · Fig 2.2 | Es el primer gate del libro; todo lo demás (llenado, contracción, ciclo) hereda de aquí. |
| 7 | **Ubicaciones de venteo derivadas del patrón de llenado** (3 tipos) | §8.2.2 · Fig 8.1 → 8.2 → 8.3 → 8.4 → 8.5 | El método es literalmente "mira dónde converge el frente". ~36 candidatos, 8 críticos. |
| 8 | **Layout de cavidades y relación de aspecto** | §4.3.1 · Fig 4.17 → 4.18 (→4.19/4.20) | *"a simple but poor design"*; envolvente < 2:1. Se mide con un rectángulo sobre la planta. |
| 9 | **Layout del sistema de alimentación (balanceo natural)** | §6.4.2 · Fig 6.13 → 6.14 → 6.15 → 6.16 | Serie = desbalanceada; híbrido = *"less material while also providing naturally balanced flow"*. |
| 10 | **Reubicación de gates por estética + gate en sección delgada** | §7.1.3 Fig 7.1 · §7.2.4 Fig 7.5→7.6 | La marca de compuerta es lo primero que ve el cliente final; el gate a sección delgada congela el flujo. |

---

## Capítulo 1 — Las vistas base del molde

### V1.1 — Las cinco vistas de nomenclatura del molde
- **§** 1.3.1 / 1.3.2 / 1.3.3 / 1.4.1 / 1.4.2
- **Figuras:**
  - Fig 1.4: *"View of a closed two-plate mold"*
  - Fig 1.5: *"View of molding ejected from injection mold"*
  - Fig 1.6: *"Top and cross section views of a two-plate mold"*
  - Fig 1.7: *"Section of an open three plate mold"*
  - Fig 1.8: *"Section of hot runner mold"*
- **Qué se mira:** isométrica del molde cerrado; isométrica del molde abierto con el moldeo siendo expulsado;
  planta + sección A-A con *hatch patterns* distintos por componente; sección de molde de 3 placas abierto;
  sección de molde de canal caliente.
- **Criterio a ojo:** **el libro muestra estas figuras sin criterio verbal de bueno/malo.** Son vistas de
  nomenclatura y función. La única advertencia funcional asociada (Fig 1.4) es:
  > *"Improper construction of the mold components may cause improper alignment of the 'A' and 'B' plates,
  > poor quality of the molded parts, and accelerated wear"* — pero no dice qué mirar para detectarlo.
- **Par bueno/malo:** no.
- **Juzgable por píxeles:** **NO** (descriptivas). **Su valor para nosotros es otro:** definen las cuatro
  vistas canónicas que el resto del libro reusa. Fig 1.6 (planta + sección con achurado por componente) es
  el formato de render que hay que replicar en TODO el juez.

---

## Capítulo 2 — DFM de la pieza

### V2.1 — Espesor de pared y sus transiciones ★ TOP-10
- **§** 2.3.1 Uniform Wall Thickness
- **Figura:** Fig 2.2: *"Wall thickness design"* — **tríada en una sola figura** (izq → centro → der)
- **Qué se mira:** sección de la pieza con la dirección de flujo marcada, en tres variantes.
- **Criterio a ojo (literal):**
  > *"The worst part design, shown at left, has the melt flowing from a thin section to a thick section with
  > a sharp transition. This design may lead to moldings with poor surface finish due to jetting of the melt
  > from the thin section into the thick section, as well as poor surface replication and dimensional control
  > in the thick section related to premature solidification of the plastic molded in the thin section."*
  > *"The design may be improved by reversing the direction of melt flow… The design may be further improved
  > by gradually transitioning the thick section to the thin section."*
- **Par bueno/malo:** IZQUIERDA = **el peor** (delgado→grueso, transición viva). CENTRO = mejor (flujo invertido).
  DERECHA = **el mejor** (transición gradual).
- **Contexto de la regla:** *"Extreme differences in wall thicknesses should be avoided if at all possible since
  internal voids may be formed internal to the part due to excessive shrinkage in the thick sections."* Y la
  salida preferida: *"the best design may be to use a thinner wall thickness together with vertical ribs."*
- **Juzgable por píxeles:** **SÍ.** Render = mapa de color de espesor sobre la pieza + vector de flujo desde el gate.
  Métricas: (a) razón espesor_max/espesor_min; (b) gradiente de espesor en la dirección de flujo (positivo delgado→grueso = MALO);
  (c) longitud de la transición en múltiplos del espesor (0 = escalón vivo = el peor caso).

### V2.2 — Diseño de costilla (rib)
- **§** 2.3.2 Rib Design
- **Figura:** Fig 2.3: *"Effective rib design"*
- **Qué se mira:** sección de la costilla con sus tres cotas anotadas contra el espesor nominal.
- **Criterio a ojo (literal + cotas):**
  > *"the base thickness of the rib is 70% of the wall thickness of the part and the height of the rib is four
  > times the wall thickness of the part. The ribs are spaced at ten times the wall thickness of the part."*
  Regla de falla:
  > *"Ribs thicker than 70% of the wall thickness will tend to draw material away from the center of the opposite
  > wall when the rib cools. The volumetric shrinkage in this region will cause internal voids or sink to appear
  > on the side of the part opposite the rib."*
  Y el draft: en esta misma figura *"a 2° draft angle was applied to facilitate the ejection"*.
- **Par bueno/malo:** el libro muestra solo el **bueno**; el malo se define verbalmente (rib > 70 % ⇒ sink visible
  en la cara opuesta).
- **Cotas:** base 0.70·h · altura 4·h · paso 10·h · draft 2°. Efecto: rigidez equivalente a pieza 30 % más gruesa,
  que costaría *"approximately 15% more material and have a 70% longer cycle time"*.
- **Juzgable por píxeles:** **SÍ.** Vista = sección transversal de cada costilla + planta con el paso.
  Marcar en ROJO toda costilla con base > 0.70·h y proyectar la mancha de sink esperada en la cara opuesta.

### V2.3 — Diseño de boss
- **§** 2.3.3 Boss Design
- **Figura:** Fig 2.4: *"Effective boss design"* — tres variantes (no es par bueno/malo)
- **Qué se mira:** izquierda = *"a boss near a corner with two ribs and a gusset placed at 120°"*; centro =
  *"a boss on a rib with two gussets at 90°"*; derecha = *"a free-standing boss with gusseted ribs that provide
  for an elevated assembly surface"*.
- **Criterio a ojo (literal):**
  > *"All boss designs utilize a boss, rib, and gusset thickness of 70% times the nominal wall thickness."*
  > *"bosses should not be designed with overly thick sections that may require extended cycle times or cause
  > aesthetic problems."*
  Excepción explícita de draft: *"In the designs of Figure 2.4, no draft was utilized on the bosses and gussets"*,
  porque *"using less draft on these features can aid in increasing the stiffness and strength of the molding
  without significantly increasing the ejection forces."*
- **Par bueno/malo:** **no** — las tres son "efectivas" según contexto.
- **Juzgable por píxeles:** **SÍ.** Medir espesor de boss/rib/gusset contra nominal (regla del 70 %) y el ángulo
  entre gussets (120° / 90°).

### V2.4 — Filetes de esquina
- **§** 2.3.4 Corner Design
- **Figura:** Fig 2.5: *"Comparison of fillets"*
- **Qué se mira:** esquina externa vs. interna con sus radios acotados contra el espesor de pared.
- **Criterio a ojo (literal):**
  > *"the fillet radius on an external corner should be 150% of the wall thickness. To maintain the same
  > thickness around the corner, the fillet on the internal corner is set to 50% of the wall thickness."*
  > *"These fillet recommendations are only guidelines. In fact, even larger fillets should be used if possible."*
- **Par bueno/malo:** el libro **no rotula un lado como malo**; compara externa vs. interna con las cotas
  recomendadas. El "malo" es la esquina viva, justificada aparte con tres razones (§2.3.4):
  > *"sharp corners greatly restrict the heat flow from the polymer melt to the core insert… The result is often
  > differential shrinkage across the thickness of the part near the corner and significant warpage of the molded part."*
- **Juzgable por píxeles:** **SÍ.** Detectar aristas con radio < 0.5·h (interna) o < 1.5·h (externa) y pintarlas;
  medir el espesor *alrededor* de la esquina para verificar que se mantiene constante.

### V2.5 — Chaflanes de esquina
- **§** 2.3.4 Corner Design
- **Figura:** Fig 2.6: *"Comparison of chamfers"*
- **Qué se mira:** la misma esquina resuelta con bisel en vez de radio.
- **Criterio a ojo (literal):**
  > *"a chamfer of one half the wall thickness is often utilized on the internal corner to provide for adequate
  > relief while avoiding potential negative issues related to melt flow and part strength."*
  Ángulo típico: *"often at a 45 degree angle"*.
- **Par bueno/malo:** no rotulado.
- **Juzgable por píxeles:** **SÍ** (misma mecánica que V2.4, midiendo la longitud del bisel contra 0.5·h y el ángulo contra 45°).

### V2.6 — Ángulo de salida (draft)
- **§** 2.3.6 Draft (+ Tabla 2.14 *"Draft examples"*)
- **Figura:** el libro **no dedica figura propia al draft**; lo ancla a Fig 2.3 (*"a 2° draft angle was applied"*)
  y a la ausencia deliberada de draft en Fig 2.4.
- **Qué se mira:** la pieza coloreada por ángulo entre cada cara y la dirección de apertura.
- **Criterio a ojo (literal):**
  > *"Draft refers to the angle of incline placed between the vertical surfaces of the plastic moldings and the
  > mold opening direction."*
  > *"lower draft angles (such as ½ or 1°) may cause the part to excessively stick in the mold."*
  > *"A minimum draft angle of 0.5° is usually necessary, with 1 to 2° commonly applied according to material
  > supplier recommendations"* + *"an additional 1° of draft commonly applied per 20 μm of surface roughness or texture depth."*
- **Cotas (Tabla 2.14, literales):** A-1/Acrílico/0.01 µm → **0.5°** · B-3/ABS/12 µm → **1.5°** ·
  arena/PC 20 % GF/12 µm → **2°** · piel/PVC blando/125 µm → **4°** · piel/ABS/125 µm → **7.5°**.
- **Par bueno/malo:** no hay par gráfico; la regla es un umbral.
- **Juzgable por píxeles:** **SÍ, y es el ejemplo más limpio de todo el libro.** Mapa de color de draft sobre la
  pieza (verde ≥ requerido, ámbar entre 0 y requerido, rojo < 0 = undercut). Métrica: **% de área roja** y
  **% de área por debajo del mínimo de la tabla según acabado**. Umbral por acabado, no fijo.

### V2.7 — Catálogo de undercuts
- **§** 2.3.7 Undercuts
- **Figura:** Fig 2.7: *"Some common features with undercuts"*
- **Qué se mira:** cuatro geometrías-tipo: *"a window in a side wall, an overhang above the bottom wall of the
  part, a horizontal boss, and a snap finger."*
- **Criterio a ojo:** **el libro presenta el catálogo sin criterio verbal de bueno/malo por figura.** Es
  identificación de casos que interfieren con la dirección de expulsión y obligan a mecanismo de molde.
  La política de diseño se da en prosa: evitarlos por costo, salvo que la función sea vital.
- **Par bueno/malo:** no.
- **Juzgable por píxeles:** **SÍ** — un undercut es exactamente "área con draft negativo respecto a la dirección
  de apertura" (mismo render que V2.6, canal rojo). El *conteo* de regiones rojas conexas = número de mecanismos
  que el molde va a necesitar.

---

## Capítulo 4 — Layout del molde, línea de partición e insertos

### V4.1 — Dirección de apertura: axial vs. radial
- **§** 4.1.1 Determine Mold Opening Direction
- **Figuras:** Fig 4.2: *"Axial mold opening direction"* · Fig 4.3: *"Radial mold opening direction"*
- **Qué se mira:** sección del bloque de cavidad de la taza; **se cuentan las líneas de separación**: 2 líneas
  horizontales (axial) vs. 4 líneas con tres piezas moviéndose en dos ejes (radial).
- **Criterio a ojo (literal):**
  > *"the axial mold opening direction shown in Figure 4.2 is the simplest design and is usually preferred."*
  El radial se justifica solo si se necesita *"a more complex part design as well as more options in locating
  the parting line"*, a costa de un *"split cavity mold"*.
- **Par bueno/malo:** 4.2 = **preferido**; 4.3 = alternativa cara.
- **Juzgable por píxeles:** **PARCIAL.** Contar planos de separación y cuántos ejes de movimiento distintos hay
  se hace en la geometría, no en la imagen; pero el render (sección con las líneas de partición resaltadas) es la
  evidencia. Métrica: nº de direcciones de apertura ≠ 1 ⇒ bandera de costo.

### V4.2 — Dirección de apertura del bezel: normal vs. compleja
- **§** 4.1.1
- **Figuras:** Fig 4.4: *"Normal mold opening direction for bezel"* · Fig 4.5: *"Complex mold opening directions for bezel"*
- **Qué se mira:** sección del bezel; 4.4 con dos líneas horizontales, 4.5 con tres líneas verticales que parten
  la cavidad en piezas oblicuas.
- **Criterio a ojo (literal):**
  > *"the mold opening direction is inclined in order to allow the mold surfaces to separate… without excessive
  > surface friction or shearing"* pero *"requires several additional mold components… which add significantly to the cost."*
- **Par bueno/malo:** 4.4 = solución normal; 4.5 = compleja, solo si 4.4 no libera la pieza.
- **Juzgable por píxeles:** **PARCIAL** (igual que V4.1).

### V4.3 — Ubicación de la línea de partición (taza) ★
- **§** 4.1.2 Determine Parting Line
- **Figura:** Fig 4.6: *"Two parting line locations for cup"* — **par bueno/malo dentro de una sola figura**
- **Qué se mira:** la línea trazada sobre el perfil de la taza: cerca del labio vs. en la base del reborde.
- **Criterio a ojo (literal):**
  > *"[the parting line very close to the lip] would result in a witness line and possible flash that might make
  > the molded cup unusable. Alternatively, a better location for the parting line is at the bottom of the rim."*
- **Par bueno/malo:** cerca del labio = **MALO**; base del reborde = **BUENO**.
- **Juzgable por píxeles:** **SÍ.** Render = la pieza con la línea de partición dibujada + las caras marcadas como
  "visibles por el usuario". Métrica: **¿la línea de partición cruza una superficie visible/funcional?** Booleano
  duro, más la longitud de línea sobre superficie visible.

### V4.4 — Línea de partición no plana (bezel)
- **§** 4.1.2
- **Figura:** Fig 4.7: *"Parting line location for bezel"*
- **Qué se mira:** la línea siguiendo el perfil escalonado de las paredes laterales.
- **Criterio a ojo:** **descriptivo, sin bueno/malo.**
  > *"the parting line for the bezel is not in a single plane. Rather, the parting line follows the profile of the
  > features on the side walls."*
- **Juzgable por píxeles:** **PARCIAL** — se puede medir la planaridad de la curva (desviación Z máxima) y reportar
  "partición escalonada / no plana", que es un driver de costo declarado en el cap. 3.

### V4.5 — Plano y superficie de partición
- **§** 4.1.3 Parting Plane
- **Figuras:** Fig 4.8: *"Parting plane for cup"* · Fig 4.9: *"Parting plane for bezel"* · Fig 4.10: *"Modified parting surface for bezel"*
- **Qué se mira:** la superficie de partición proyectada; en 4.9 los detalles fuera de plano convertidos en
  superficie; en 4.10 la superficie ya reconstruida con *lofts* y draft.
- **Criterio a ojo (literal) y COTA DURA:**
  > *"interlocking features on the parting plane should be inclined at least five degrees relative to the mold
  > opening direction."*
  Riesgos si no: *"any misalignment… will cause wear… or an outright impact"* y *"clamp tonnage… can cause the
  surfaces to lock together with extreme force, causing excessive stress."*
- **Par bueno/malo:** 4.9 → 4.10 es progresión problema→solución constructiva, pero **el libro no rotula 4.9 como
  "mal diseño"**; lo presenta como la geometría cruda que hay que modificar.
- **Juzgable por píxeles:** **SÍ.** Mapa de color sobre la superficie de partición por ángulo respecto a la
  dirección de apertura; **rojo = < 5°**. Métrica: % de área de partición por debajo de 5°.

### V4.6 — Superficies de shut-off
- **§** 4.1.4 Shut-Offs
- **Figuras:** Fig 4.11 y Fig 4.12, ambas con caption *"Shut-off surface for bezel"*
- **Qué se mira:** dos ubicaciones posibles de la partición del shut-off, arriba o abajo del estante que soporta la pantalla.
- **Criterio a ojo (literal — y es un "no criterio" explícito):**
  > *"Either location (or even any location in between) would likely be acceptable since the entire shelf is hidden
  > from view."*
- **Par bueno/malo:** **NO hay jerarquía** — el libro dice expresamente que ambas sirven. **Lección para el juez:**
  el criterio no es la posición, es **si la superficie está oculta a la vista**. Ese es el predicado a evaluar.
- **Juzgable por píxeles:** **SÍ, pero el predicado es "visibilidad"**: renderizar la pieza desde el punto de vista
  del usuario final y marcar qué superficies son visibles; el shut-off es libre dentro de la región no visible.

### V4.7 — Altura del inserto
- **§** 4.2.1 Height Dimension
- **Figura:** Fig 4.13: *"Insert height allowance"*
- **Qué se mira:** sección con la cota entre la superficie de la pieza y la cara trasera del inserto.
- **Criterio/cotas (literal):**
  > *"the minimum height dimension between the molded part and the top or bottom surface of the insert is
  > typically three times the diameter of the cooling line."*
  Diámetros de línea: *"typically range from 4.76 mm (3/16″) for smaller molds to 15.88 mm (5/8″) for large molds."*
  Placas A/B en incrementos de ½″ o 10 mm.
- **Juzgable por píxeles:** **SÍ.** Sección con la cota acotada; comparar contra 3·D_línea. Falla = pintar la zona en rojo.

### V4.8 — Largo y ancho del inserto (regla del *cheek*)
- **§** 4.2.2 Length and Width Dimensions
- **Figura:** Fig 4.14: *"Insert length and width allowance"*
- **Criterio/cotas (literal):**
  > *"length and width allowances of three cooling line diameters per side are typical."*
  > *"the thickness of the side wall in the length and width dimension should equal the depth of the mold cavity."*
  Y cuál requisito manda en cada pieza:
  > *"for the laptop bezel, the requirement of fitting a cooling line will exceed the structural requirement. For
  > the molded cup, however, the insert length and width dimension are driven by the structural requirement."*
- **Juzgable por píxeles:** **SÍ.** Planta del inserto con las dos holguras acotadas y las dos reglas (3·D vs.
  W_cheek = H_cavity) evaluadas en paralelo; se pinta cuál manda. Nota: esta regla reaparece en §12.2.4 (V12.10)
  y §13 (V13.4) — es la misma verificación vista desde tres capítulos.

### V4.9 — Insertos core/cavity: redondo vs. rectangular
- **§** 4.2.3 Adjustments
- **Figuras:** Fig 4.15: *"Core and cavity inserts for cup"* · Fig 4.16: *"Core and cavity inserts for bezel"*
- **Qué se mira:** inserto circular (torneable) vs. rectangular agresivamente dimensionado.
- **Criterio a ojo (advertencias, literal):** taza — *"the allowance in the radial dimension may not be sufficient
  to withstand the pressures exerted on the side wall by the melt"*; bezel — *"the thickness of the surrounding
  cheek may not allow for sufficient cooling around the periphery of the mold cavity while also providing space
  for other mold components."*
- **Par bueno/malo:** **no** — son dos casos con su riesgo respectivo.
- **Juzgable por píxeles:** **PARCIAL** (la advertencia se resuelve con V4.8 y con el cap. 12).

### V4.10 — Layout de cavidades y relación de aspecto ★ TOP-10
- **§** 4.3.1 Cavity Layouts
- **Figuras:** Fig 4.17: *"Series layout of cavities"* · Fig 4.18: *"Grid layout of cavities"* ·
  Fig 4.19: *"Circular layout of cavities"* · Fig 4.20: *"Hybrid layout of cavities"*
- **Qué se mira:** **planta del plano de partición** con las cavidades y su envolvente rectangular.
- **Criterio a ojo (literal) y COTA DURA:**
  > *"Placing all the cavities along a line, as shown in Figure 4.17, is a simple but poor design."*
  > *"In general, the width to length ratio of the bounding envelope around all cavities should be kept less than 2 : 1."*
  > *"Higher aspect ratios will require the use of large molds that are significantly under utilized while at the
  > same time producing structural loadings across the mold for which molding machine platens may not be designed.
  > Furthermore, the use of such a line layout requires an unbalanced feed system."*
  Rejilla: *"the grid layout will result in a compact mold with an acceptable aspect ratio"* y *"lends itself well
  to naturally balanced feed system layouts"*, para nº de cavidades múltiplo de 2 (4, 8, 16, 32).
  Circular: para piezas pequeñas o *"the number of mold cavities is relatively low, for example 8 or less"*, con la
  desventaja de que *"requires a larger mold surface area than the previously discussed grid layout."*
  Híbrido: *"a very compact design for six cavities."*
- **Par bueno/malo:** 4.17 = **MALO explícito** ("poor design"); 4.18 = el estándar bueno; 4.19/4.20 = alternativas
  con su trade-off declarado.
- **Juzgable por píxeles:** **SÍ, es de las más limpias.** Render = planta del plano de partición. Métricas:
  (a) **razón W:L de la envolvente** (falla si ≥ 2:1); (b) **área de cavidades / área de la envolvente** (compacidad);
  (c) clasificar el patrón (línea / rejilla / círculo) por la distribución de centroides.

### V4.11 — Área usable del plano de partición
- **§** 4.3.2 Mold Base Sizing
- **Figura:** Fig 4.21: *"Usable parting plane area"*
- **Qué se mira:** el área sombreada de la placa disponible para insertos, ya descontados leader pins y bujes.
- **Criterio/cota (literal):**
  > *"A dimensional allowance equal to at least one-half of each component's diameter is provided between the mold
  > cavity and the surrounding components to avoid excessive stress."*
- **Juzgable por píxeles:** **SÍ.** Planta con el área usable sombreada; verificar que cada inserto cae dentro y
  que ninguna distancia inserto↔componente baja de ½·D. Es un chequeo de "colisión con holgura" puramente 2D.

### V4.12 — Cotas de altura del molde base
- **§** 4.3.2
- **Figura:** Fig 4.22: *"Height dimensions to specify"*
- **Qué se mira:** el apilado A / B / S (soporte) / E (recorrido del expulsor) / C (housing).
- **Criterio a ojo:** **el libro etiqueta las cotas sin dar criterio de bueno/malo.**
- **Juzgable por píxeles:** **PARCIAL** — la vista sirve para verificar que la suma de cotas cae dentro del
  daylight de la máquina (ver V4.13); por sí sola no juzga.

### V4.13 — Compatibilidad con la máquina: tie bars y daylight
- **§** 4.3.3 Molding Machine Compatibility
- **Figuras:** Fig 4.23: *"Typical tie bar and bolt pattern (dimensions in mm)"* · Fig 4.24: *"Minimum and maximum
  daylight (dimensions in mm)"*
- **Qué se mira:** la **planta del molde superpuesta al patrón de tie bars** de la máquina, y la **elevación del
  molde entre platinas** contra las cotas A (mínima) y B (máxima).
- **Criterio a ojo (literal) y cotas del ejemplo (Battenfeld HM320, 3200 kN):**
  > *"the mold height must be greater than the indicated A dimension and smaller than the indicated B dimension,
  > or between 350 and 800 mm for this machine. If the mold is smaller than 350 mm, then the molding machine platen
  > can not fully close the mold and build clamp tonnage. If the mold is larger than 800 mm, then the mold will not
  > fit between the two platens."*
  Espaciado de tie bars: horizontal **800 mm**, vertical **630 mm**.
- **Juzgable por píxeles:** **SÍ, y es un check visual perfecto.** Dos renders superpuestos: silueta del molde
  contra el rectángulo de tie bars (¿pasa entre barras?) y la elevación contra la banda [A, B].

---

## Capítulo 5 — Llenado de la cavidad (el frente de flujo)

### V5.1 — Llenado parejo vs. estancamiento ★ TOP-10
- **§** 5.2.2 Avoid Uneven Filling or Over-Packing
- **Figura:** Fig 5.1: *"Melt front progression of laptop bezel"* — contornos isócronos numerados 1…11, con las
  etiquetas **"Last area to fill"** y **"End of flow"** dibujadas EN la figura.
- **Qué se mira:** planta de la pieza con las **isócronas del frente de fusión** desde las 2 compuertas.
- **Criterio a ojo (literal):**
  > *"the mold should be designed such that the polymer melt reaches the edges of the mold cavity furthest from
  > the gate at approximately the same time. Such even filling allows for more uniform and lower melt pressures
  > throughout the mold cavity."*
  El defecto que se VE en esta figura:
  > *"the plastic was injected at gates located slightly toward the lower portion of the part, such that the bottom
  > portion of the part fills before the upper portion… When the two melt fronts meet at the bottom center, very
  > little additional plastic melt can be forced into the lower portion… The flow to the bottom portion of the part
  > stagnates, causing a surge in the melt flow to the upper portion."*
  Consecuencias listadas textualmente: *"Excessive cavity filling pressures… and flashing"*; *"Inability to fill the
  mold cavity (short shot)"*; *"High residual stress and warpage"*; *"Melt fracture, jetting, hesitation or other
  aesthetic defects."*
- **Par bueno/malo:** **una sola figura que ES el caso malo**, con el bueno definido verbalmente ("todos los bordes
  al mismo tiempo").
- **Juzgable por píxeles:** **SÍ, y es LA métrica del capítulo.** Render = mapa de tiempo de llenado (isócronas).
  Métricas: (a) **dispersión del tiempo de llegada a los bordes** (t_max − t_min sobre el contorno de la pieza,
  normalizado por t_total); (b) posición del "last area to fill" — ¿coincide con un venteo?; (c) detección de
  estancamiento = región cuyo frente se detiene mientras otra sigue avanzando.

### V5.2 — El método gráfico del *lay flat* con arcos y *phantom gates* ★
- **§** 5.5.4 Predicting Filling Patterns
- **Figuras:** Fig 5.15: *"Container for prediction of fill patterns"* (contenedor 100 × 160 × 60 mm, *"2° draft with
  10 mm fillets"*) · Fig 5.16: *"Lay flat and first melt front locations"*
- **Qué se mira:** la pieza **desplegada** (paredes cortadas en las esquinas y abatidas al plano) con arcos numerados
  desde la compuerta.
- **Criterio/método (literal — este es el procedimiento completo):**
  > *"the sides of the container are 'cut' at the corners and the side walls folded down to make a lay flat. The gate
  > location is next identified. The flow will emanate from the gate producing a circular melt front. As such, an arc
  > may be drawn from the gate representing the position of the melt at a given point in time."*
  > *"the distance between arc is equal to the linear melt velocity times the time step."*
  > *"This can be accomplished by creating a 'phantom' gate and maintaining the same flow lengths from this 'phantom'
  > gate as from the real gate. For each time step, the length of flow is increased and an arc of corresponding radius is drawn."*
  > *"Intersecting arcs corresponding to the same time step are then trimmed. The flow is advanced with more phantom
  > gates added as needed until the flow throughout the entire lay flat is created."*
- **Par bueno/malo:** no — es el **método de construcción de la vista** que las fichas V5.3–V5.5 luego juzgan.
- **Juzgable por píxeles:** **SÍ (como vista canónica).** Para nosotros, el lay-flat con isócronas es una vista
  render obligatoria: es como Kazmer lee el llenado a mano, y es exactamente lo que un juez con ojos debe ver.

### V5.3 — Race-tracking, línea de soldadura y trampa de gas ★ TOP-10
- **§** 5.5.4
- **Figura:** Fig 5.17: *"Melt front locations for part of uniform thickness"* — con las etiquetas **"Weld line"** y
  **"Gas trap"** dibujadas en la pared opuesta a la compuerta.
- **Qué se mira:** el lay-flat lleno de arcos, buscando dónde se cierran los frentes.
- **Criterio a ojo (literal) y COTA GEOMÉTRICA:**
  > *"It is observed that the flow races around the side walls and will form a weld line and a gas trap on the side
  > wall opposite the gate. This phenomenon, known as 'race-tracking', is quite common in molded parts and can occur
  > when the length of flow around the perimeter of the molding is less than the length of flow across the center-line
  > of the part."*
  > *"In this case, race-tracking occurred because the 60 mm depth of the container is more than one-half the 100 mm
  > width of the container."*
  Por qué es grave:
  > *"a gas trap on a side wall such as shown in Figure 5.17 is especially problematic since it is difficult to vent.
  > As such, the trapped air will likely combust, causing a burn mark to appear at this location."*
- **Par bueno/malo:** Fig 5.17 = **MALO**; el bueno es Fig 5.19 (V5.5) y el par simulado es Fig 5.20 (V5.6).
- **Juzgable por píxeles:** **SÍ.** Métricas: (a) **L_perímetro vs. L_centerline** (regla directa: si perímetro <
  centerline ⇒ race-tracking); (b) **profundidad > ½ · ancho** ⇒ bandera; (c) sobre el mapa de isócronas, detectar
  cierres de frente **en el interior de una superficie** (trampa de gas) vs. en un borde (venteable).

### V5.4 — Longitudes de flujo comparadas
- **§** 5.5.5 Designing Flow Leaders
- **Figura:** Fig 5.18: *"Lay flat showing flow lengths"* — con **L_centerline = 280 mm** y **L_side walls = 210 mm**
  acotadas en la figura.
- **Criterio (literal):**
  > *"To eliminate the race tracking, the pressure drop across the center-line should equal the pressure drop around
  > the perimeter"* (ΔP_centerline = ΔP_side_walls), lo cual *"will ensure that the flow traverses across the
  > center-line at the same time that the flow reaches the far corners of the adjacent side walls."*
  Resultado: espesor de pared lateral **1.5 mm** desde un nominal de **2 mm** (2 mm × 210/280).
- **Juzgable por píxeles:** **PARCIAL.** Las dos longitudes se miden sobre el lay-flat (sí, en píxeles), pero la
  conversión a espesor requiere el modelo de flujo. La vista es la que da la evidencia.

### V5.5 — Flow leaders: el patrón corregido
- **§** 5.5.5
- **Figura:** Fig 5.19: *"Melt front locations for part with flow leaders"* — con las etiquetas **"2 mm wall
  thickness"** y **"1.5 mm wall thickness"** en la figura.
- **Criterio a ojo (literal):**
  > *"The analysis indicates that the melt does reach the end of the side walls before the melt reaches side of the
  > cavity opposite the gate."*
  (Velocidad en paredes laterales = 75 % de v_centerline; los arcos en la zona delgada se dibujan con radio menor.)
  Advertencia del propio libro sobre el remedio:
  > *"thickness variations in molded parts are generally undesirable as discussed in Section 2.3.1… the cavity
  > thickness variation should be kept to a minimal amount."*
- **Par bueno/malo:** Fig 5.19 = el **BUENO** frente a Fig 5.17.
- **Juzgable por píxeles:** **SÍ** — misma métrica de V5.3 aplicada al patrón corregido: los frentes ahora se cierran
  en un borde, no en el centro de una pared.

### V5.6 — El par simulado definitivo ★ TOP-10
- **§** 5.5.5
- **Figura:** Fig 5.20: *"Simulated melt front with and without flow leaders"* — dos simulaciones lado a lado
  rotuladas **"Uniform thickness"** (izq) y **"Thinner side walls"** (der).
- **Criterio a ojo (literal):**
  > *"the simulation indicated that the container without the flow leader would exhibit race-tracking, a weld line,
  > and a gas trap. Reducing the thickness of the side walls to 1.5 mm eliminated the problem."*
  Trade-off cuantificado: *"the reduction in the thickness of the side-wall from 2 mm to 1.5 mm did increase the
  injection pressure 10%… but also decreased the part weight by a similar amount."*
- **Par bueno/malo:** IZQUIERDA (espesor uniforme) = **MALO**; DERECHA (paredes delgadas) = **BUENO**.
- **Juzgable por píxeles:** **SÍ.** Este es el formato exacto que debe producir nuestro juez: **dos mapas de llenado
  lado a lado, mismo encuadre, misma escala de color**, con los defectos anotados sobre la imagen mala.

---

## Capítulo 6 — Sistema de alimentación (colada)

### V6.1 — Las secciones de los tres arquetipos de molde
- **§** 6.3.1 / 6.3.2 / 6.3.3
- **Figuras:** Fig 6.4: *"Isometric section of two-plate mold"* · Fig 6.5: *"Two-cavity molding with runners and
  sprue"* · Fig 6.6: *"Eight-cavity molding with runners and sprue"* · Fig 6.7: *"Isometric section of three-plate
  mold"* · Fig 6.8: *"Section of closed three-plate mold"* · Fig 6.9: *"Partial section of partially opened
  three-plate mold"* · Fig 6.10: *"Partial section of a fully opened three-plate mold"* · Fig 6.11: *"Isometric
  section of hot runner system"* · Fig 6.12: *"Partial section of hot runner mold"*
- **Qué se mira:** secciones isométricas y la **secuencia de apertura en tres poses** (cerrado → parcialmente
  abierto → totalmente abierto).
- **Criterio a ojo:** **descriptivas del mecanismo; el libro no da par bueno/malo aquí.** El único juicio
  cuantitativo asociado (Tabla 6.1):
  > *"the three-plate mold has a mold opening distance of 250 mm, much greater than the mold opening distance of
  > 75 mm for the two-plate mold. This larger mold opening distance is undesirable since it adds to the mold opening
  > and closing time, and may also prevent the mold from operating in some injection molding machines with limited daylight."*
- **Juzgable por píxeles:** **PARCIAL.** La carrera de apertura **sí** se mide en la vista (distancia entre placas
  en la pose "fully open") y se contrasta contra el daylight de la máquina (V4.13). El resto es nomenclatura.

### V6.2 — Layout del sistema de alimentación: balanceo natural ★ TOP-10
- **§** 6.4.2 Determine Feed System Layout
- **Figuras:** Fig 6.13: *"Series layout of runner system"* · Fig 6.14: *"Branched layout of runner system"* ·
  Fig 6.15: *"Radial layout of runner system"* · Fig 6.16: *"Hybrid (branched-radial) layout of runner system"* ·
  Fig 6.17: *"Custom layout of runner system"*
- **Qué se mira:** **planta del plano de partición con el árbol de colada** dibujado sobre el layout de cavidades.
- **Criterio a ojo (literal, ordenado de peor a mejor):**
  - Serie (6.13) — **MALO:** *"the pressure drop along the length of the primary runner will cause lower flow rates
    to be delivered to cavities further from the sprue."* El balanceo artificial *"can be difficult to achieve, and
    does not guarantee consistent part quality"*; por eso *"the series layout of runner systems is not frequently
    used in precision applications."*
  - Ramificado (6.14) — balanceado pero caro: *"By branching the feed system multiple times, the melt flow to
    multiple cavities can be naturally balanced"*, pero *"consumes significantly more material while also imposing a
    high pressure drop"*, más *"the development of melt temperature imbalances associated with the turning of the melt
    across multiple branches."*
  - Radial (6.15) — mejor: *"The primary benefit of a radial feed system layout is that the flow rates and melt
    pressures are naturally balanced with only a moderate amount of runner volume"*; comparado con el ramificado,
    *"this radial layout has a lower feed system volume and provides more balanced flow."*
  - Híbrido (6.16) — **EL MEJOR:** *"Compared to the feed system layouts shown in Figure 6.14 and Figure 6.15, the
    hybrid layout of the feed system design utilizes less material while also providing naturally balanced flow."*
  - Custom (6.17) — sin ranking; *"there is no reason to adhere to either branched or radial or even naturally
    balanced layouts"* en ciertos casos.
  Regla transversal del capítulo:
  > *"Naturally balanced feed systems provide greater cavity to cavity consistency with respect to melt flow, melt
  > pressure, and molded part quality than artificially balanced designs."*
- **Par bueno/malo:** 6.13 = MALO · 6.14/6.15 = intermedios con trade-off declarado · 6.16 = MEJOR.
- **Juzgable por píxeles:** **SÍ.** Sobre la planta del árbol de colada: (a) **longitud de recorrido sprue→gate por
  cavidad** — si todas son idénticas, es naturalmente balanceado (booleano duro y medible en la imagen);
  (b) **volumen de colada / volumen de piezas** (desperdicio); (c) **nº de cambios de dirección** por rama
  (el desbalance térmico que menciona el libro).

### V6.3 — Sección transversal del runner
- **§** 6.5.1 Runner Cross-Sections
- **Figura:** Fig 6.20: *"Common runner cross-sections"* — cuatro perfiles en una figura
- **Qué se mira:** el perfil del canal: redondo completo, trapezoidal, trapezoide de fondo redondo, medio redondo.
- **Criterio a ojo (literal, con ranking explícito):**
  > *"The results indicate that the full round runner is the most efficient section design, followed by the round
  > bottom trapezoid, the trapezoid, and the half-round."*
  Por qué falla el trapezoidal: *"the trapezoidal runner is easy to machine, but the sections near the four corners
  conduct very little flow down the length of the runner."*
- **Cotas (Tabla 6.3):** redondo **100 %** · trapezoide fondo redondo **87.9 %** · trapezoidal **78.5 %** ·
  medio redondo **61.2 %**.
- **Par bueno/malo:** ranking de cuatro en una sola figura — el redondo es el bueno, el medio redondo el peor.
- **Juzgable por píxeles:** **SÍ, trivialmente.** Basta clasificar la silueta de la sección y leer su eficiencia de
  la tabla. Métrica alternativa medible en la imagen: **área hidráulica efectiva / área total** del perfil.

### V6.4 — Sección anular en valve gate de canal caliente
- **§** 6.5.1
- **Figura:** Fig 6.21: *"Annular section in valve gated hot-runner"*
- **Qué se mira:** la corona circular que queda entre el vástago de la válvula y la pared del canal.
- **Criterio a ojo:** el libro presenta la geometría para el cálculo de diámetro hidráulico equivalente; **sin par
  bueno/malo verbal.**
- **Juzgable por píxeles:** **PARCIAL** (la sección se mide, el juicio es numérico).

### V6.5 — Sucker pins del runner frío
- **§** 6.5.2 Sucker Pins
- **Figura:** Fig 6.22: *"Two sucker pin designs for a cold runner"* — **par en una figura**
- **Qué se mira:** sección del runner sobre el pin: izquierda = expulsor ranurado; derecha = implementación más compleja.
- **Criterio a ojo (literal, con matiz):**
  > *"Compared with the implementation provided at right, the use of the slotted ejector is much simpler to machine
  > and easier to maintain."*
  Pero el mismo pin *"protrudes slightly into the runner section"* y puede causar *"an undesired disruption or
  instability in the flow front. For this reason, it is preferred to align the top of the ejector pin with the bottom
  of the runner."*
- **Par bueno/malo:** izquierda = más simple **pero** con riesgo si sobresale; **el criterio real y medible es la
  alineación**: tope del pin ≡ fondo del runner.
- **Cotas:** diámetro del sucker *"slightly less than the diameter of the associated runner"*; *"Typical heights and
  taper angles are one half the runner diameter and 5 degrees."*
- **Juzgable por píxeles:** **SÍ.** Sección del runner: medir la **intrusión del pin** (Δ vertical entre la cara del
  pin y el fondo del canal). Distinto de cero = bandera.

### V6.6 — Runner shut-off
- **§** 6.5.3 Runner Shut-Offs
- **Figura:** Fig 6.23: *"Design of runner shut-off per U.S. Patent 5,208,053"*
- **Qué se mira:** isométrica explosionada del inserto cilíndrico rotativo, la carcasa y el retenedor.
- **Criterio a ojo:** **puramente explicativo del mecanismo; el libro no da criterio visual.**
  (Dato de costo: *"approximately US$150 for use with runner diameters ranging from 2 mm to 9.5 mm."*)
- **Juzgable por píxeles:** **NO.**

---

## Capítulo 7 — Compuertas (gates)

### V7.1 — Reubicar la compuerta por estética ★ TOP-10
- **§** 7.1.3 Provide Aesthetic De-Gating
- **Figura:** Fig 7.1: *"Re-locating gates for improved aesthetics"* — **par explícito en una figura**, rotulado
  dentro de la imagen como **"Gating on side wall"** vs. **"Gating below side wall"**
- **Qué se mira:** la pieza (taza) con la posición de la compuerta marcada sobre su superficie.
- **Criterio a ojo (literal):**
  > *"Since gates are physically attached to the moldings, their removal will leave a witness mark on the surface
  > of the molding."*
  > *"Another common approach to resolve this issue is to locate gates on non-visible surfaces such as underneath a
  > side wall instead of into the side wall."*
  Riesgo funcional adicional: *"any significant gate vestige may interfere with mating surfaces."*
- **Par bueno/malo:** "on side wall" = **MALO** (pared visible); "below side wall" = **BUENO**.
- **Juzgable por píxeles:** **SÍ.** Mismo predicado que V4.3: renderizar la pieza desde el punto de vista del usuario,
  marcar superficies visibles, y evaluar **si la compuerta cae sobre superficie visible o sobre superficie de acoplamiento**.
  Booleano duro + distancia a la superficie visible más cercana.

### V7.2 — Sprue gate y su gate well
- **§** 7.2.1 Sprue Gate
- **Figuras:** Fig 7.2: *"Sprue gate design"* · Fig 7.3: *"Recessed gate well around sprue gate"*
- **Qué se mira:** sección en la base del sprue contra la cavidad.
- **Criterio a ojo:** **no hay frase evaluativa "esto está mal";** el libro describe el defecto (vestigio grande,
  degating difícil) y **dos soluciones visibles en sección**: (1) *"a small rim has been provided around the perimeter
  of the base so the cup may sit flat after sprue removal"*; (2) el *gate well* rebajado *"to provide clearance for
  the gate vestige."*
- **Juzgable por píxeles:** **SÍ (parcialmente).** En la sección: ¿el vestigio proyectado sobresale del plano de apoyo
  de la pieza? Medir la altura del vestigio contra la profundidad del rebaje/rim.

### V7.3 — Pin-point gate: el *reverse taper*
- **§** 7.2.2 Pin-Point Gate
- **Figura:** Fig 7.4: *"Pin-point gate designed with inverted sprue"*
- **Qué se mira:** sección del gate entre la superficie de la cavidad y el *breakpoint*.
- **Criterio a ojo (literal — es una definición de "correcto" verificable en sección):**
  > *"A properly designed pin-point gate will have a reverse taper between the cavity surface and the gate breakpoint
  > as shown in Figure 7.4."*
  Longitud del gate *"typically on the order of its diameter"*.
- **Juzgable por píxeles:** **SÍ.** En la sección, medir el **signo del cono** entre cavidad y breakpoint y la razón
  longitud/diámetro. El ⌀ debe **CRECER HACIA EL BREAKPOINT**, o sea alejándose de la pieza.
  > ⚠ **CORRECCIÓN (2026-08-04).** Esta glosa decía antes "debe abrirse hacia la cavidad", y está mal: eso da el
  > **mismo** signo que el bebedero y contradice el pie de la propia figura. Fig 7.4 se titula *"Pin-point gate
  > designed with **inverted sprue**"* — invertido **respecto al bebedero**, que sí crece hacia la pieza porque se
  > extrae hacia ella (§6.3.1). Con el ⌀ creciendo hacia el breakpoint la sección MÍNIMA queda pegada a la pieza:
  > el slug se va con el canal y truena ahí, dejando el vestigio diminuto que es todo el propósito del pin-point.
  > Con la glosa vieja el vestigio quedaría en el extremo ANCHO. El texto literal citado arriba ("reverse taper")
  > no cambia; lo que estaba mal era la paráfrasis de este renglón, no el libro.

### V7.4 — Edge gate → tab gate (gate a sección delgada) ★ TOP-10
- **§** 7.2.3 → 7.2.4
- **Figuras:** Fig 7.5: *"Edge gate design"* → Fig 7.6: *"Tab gate design"* — **par problema → solución entre dos figuras**
- **Qué se mira:** el gate entrando al marco interior delgado del bezel (7.5) vs. con una *tab*/rib intermedia (7.6).
- **Criterio a ojo (literal):**
  > *"[the edge gate] could be problematic since the melt flows from the runner into the thin inner frame… which can
  > cause premature freeze-off of the flow and excessive volumetric shrinkage in the surrounding thicker sections."*
  Solución en 7.6: una rib *"with a thickness equal to the thickness of the nominal thickness of the part… that connects
  the runner to the thicker portion of the molding."*
  El libro es explícito en otra parte del capítulo: *"this edge gate design does gate into a thinner section of the mold
  cavity, which is not recommended."*
  Defecto tolerado en 7.6: *"sink will likely develop on the top surface"*, aceptable porque queda *"hidden by the screen assembly."*
- **Par bueno/malo:** 7.5 = **MALO** (gate a sección delgada); 7.6 = **BUENO**.
- **Cotas del edge gate:** *"the thickness of the edge gate should be less than the wall thickness of the molding, but
  may approach the thickness of the molding if shear rates are a concern"*; *"The width of the gate should be less than
  the diameter of the runner."*
- **Juzgable por píxeles:** **SÍ.** Comparar el espesor local de la pieza **en el punto de entrada** contra el espesor
  máximo de la pieza. Regla: gate en sección delgada ⇒ bandera roja. Y sobre el mapa de espesor, dibujar el punto del gate.

### V7.5 — Fan gate y fan gate para flujo lineal
- **§** 7.2.5 Fan Gate
- **Figuras:** Fig 7.7: *"Fan gate design"* · Fig 7.8: *"Fan gate designed for linear flow"*
- **Qué se mira:** la geometría del abanico en planta y su transición a la cavidad.
- **Criterio a ojo (literal — dos condiciones verificables):**
  > *"First, the fan gate must span the width of the molding across which linear flow is desired. Second, the flow
  > resistance across the width of the fan gate must be negligible."*
- **Juzgable por píxeles:** **PARCIAL.** La primera condición **sí** se mide en la vista (ancho del abanico / ancho de
  la pieza ≈ 1). La segunda requiere el cálculo de resistencia. **El efecto sí se ve**: en el mapa de isócronas, el
  frente debe salir **recto**, no en arco.

### V7.6 — Flash gate y diaphragm gate
- **§** 7.2.6
- **Figuras:** Fig 7.9: *"Flash gate design"* · Fig 7.10: *"Diaphragm gate design"*
- **Qué se mira:** sección circular gruesa junto a sección rectangular delgada (flash); diafragma cilíndrico con gate
  delgado periférico.
- **Criterio a ojo:** **sin par bueno/malo;** descripción funcional: *"the flash gate consists of a thick circular
  section adjacent to a thin rectangular section."* Ambos dejan *"a witness line, so it is desired to minimize the
  thickness of the gate itself."*
- **Juzgable por píxeles:** **PARCIAL** — medir el espesor del gate (a minimizar) y la extensión de la línea testigo
  sobre la pieza.

### V7.7 — Tunnel gate: la sección cerrada vs. abierta ★
- **§** 7.2.7 Tunnel/Submarine Gate
- **Figuras:** Fig 7.11: *"Tunnel gate design"* · Fig 7.12: *"Section of closed mold with tunnel gate"* ·
  Fig 7.13: *"Section of slightly opened mold with tunnel gate"* — **par de secciones = la verificación del auto-degating**
- **Qué se mira:** la misma sección del molde en dos poses; se verifica que el gate **se rompa** al separarse los insertos.
- **Criterio a ojo (literal):**
  > *"the molding will move away from the cavity insert and stay on the core with the tunnel gate when the mold opens…
  > The motion of the core insert away from the cavity insert causes the tunnel gate to break at its junction with the molding."*
- **COTAS DURAS (las tres, verificables en la sección):**
  > *"First, a nominal 45 degree angle should be maintained between [the centerline of the tunnel gate and the parting plane]."*
  > *"Second, the tunnel gate should have an included taper angle of at least 20 [degrees]."*
  > *"the tunnel gate should be located at least three tunnel diameters off the parting plane."*
- **Juzgable por píxeles:** **SÍ, es de las mejores.** Sobre la sección: medir (a) el ángulo del eje del túnel contra
  el plano de partición (≈45°); (b) el ángulo incluido del cono (≥20°); (c) la distancia del gate al plano de partición
  en múltiplos del diámetro (≥3). Tres números, todos leídos de una sola vista.

### V7.8 — Submarine gate extendido (banana / cashew)
- **§** 7.2.7
- **Figura:** Fig 7.14: *"Section of mold with extended submarine gate"*
- **Qué se mira:** la sección curva del gate que llega por debajo de la superficie visible.
- **Criterio a ojo:** el libro lo nombra (*"banana"* o *"cashew"* gate) y advierte del riesgo de degating, **sin criterio
  numérico adicional.**
- **Juzgable por píxeles:** **NO / PARCIAL** (se puede verificar que la trayectoria del gate no cruce superficie visible).

### V7.9 — Gates térmicos: pin-point vs. sprue
- **§** 7.2.8 Thermal Gate
- **Figuras:** Fig 7.15: *"Section of mold with thermal pin-point gate"* · Fig 7.16: *"Section of mold with thermal sprue gate"*
- **Qué se mira:** sección del torpedo/punta de boquilla con la capa aislante de plástico residual.
- **Criterio a ojo (contraste explícito, no rotulado como bueno/malo):** el pin-point usa *"three or four orifices"*
  → alto cizallamiento y riesgo de degradación en estancamiento; el sprue térmico tiene *"open flow bore within the
  nozzle… reduced shear rates and pressure drop."* Tras la apertura *"an annulus of the solidified material will be
  broken around the torpedo tip. However, a thin solidified layer will remain."*
- **Juzgable por píxeles:** **PARCIAL** — en la sección se ve si hay orificios estrechos vs. bore abierto; el juicio
  de cizallamiento es numérico.

### V7.10 — Valve gate: vestigio mínimo
- **§** 7.2.9 Valve Gate
- **Figura:** Fig 7.17: *"Section of mold with valve gate"*
- **Qué se mira:** la sección con el vástago retraído (llenando) y avanzado (sellado) — el libro describe las dos poses
  en texto, con una sola figura.
- **Criterio a ojo (literal):**
  > *"the valve pin is retracted to provide access to the mold cavity. After the cavity is filled and packed, the valve
  > pin is advanced to seal the gate."*
  > *"the face of the valve pin presents a mold shut-off surface to the mold cavity when closed and thereby significantly
  > reduces the gate vestige."*
- **Juzgable por píxeles:** **SÍ.** En la pose cerrada, la cara del vástago debe quedar **al ras** de la superficie de
  cavidad: medir el escalón (debe ser ≈0). Es el mismo tipo de check que V6.5 (alineación de cara).

---

## Capítulo 8 — Venteo (dónde queda atrapado el aire)

> **El método completo del capítulo es visual:** se mira el patrón de llenado y se marcan los tres tipos de
> convergencia. Las fichas V8.1–V8.5 son *localización* (planta/isométrica); V8.6–V8.9 son *dimensionamiento*
> (detalle en sección).

### V8.1 — Los tres tipos de venteo ★ TOP-10
- **§** 8.2.2 Identify Number and Location of Vents
- **Figura:** Fig 8.1: *"Vent locations by type"*
- **Qué se mira:** la pieza/plano de partición con las convergencias del frente marcadas.
- **Criterio a ojo (literal — es el método entero):**
  > *"There are generally three different types of locations where venting is necessary as shown in Figure 8.1.
  > The first type of vent is required where the melt converges at an edge of the mold's parting plane or other
  > shut-off surface. The second type of vent is required where two melts converge to form a knit or weld line.
  > The third type of vent is required where the melt converges at a dead pocket in the mold."*
  Precisión importante del libro sobre por qué NO es trivial:
  > *"These locations may seem obvious, but on closer consideration these locations may not be so trivial to identify."*
- **Par bueno/malo:** no es par; es **taxonomía de localización**.
- **Juzgable por píxeles:** **SÍ, y encadena con V5.1/V5.3.** Sobre el mapa de isócronas, detectar los tres patrones:
  (1) frente que muere en un borde del plano de partición; (2) dos frentes que se cierran (línea de soldadura);
  (3) frente que rodea y encierra una región interior (dead pocket). Métrica: **conteo y coordenadas de cada tipo**,
  y **cobertura**: ¿cada convergencia tiene un vent asignado?

### V8.2 — Venteos sobre la superficie de shut-off
- **§** 8.2.2
- **Figura:** Fig 8.2: *"Vent locations on shut-off surface"*
- **Qué se mira:** las **12 ubicaciones candidatas** alrededor del plano de partición del bezel.
- **Criterio a ojo (literal — cuáles son opcionales y cuáles obligatorias):**
  > *"Some of these vents, including the four locations near the gates and the four locations at the corners may not
  > be necessary since the melt flow is predominantly radial. Since the flow is radial, the melt should reach the edges
  > of the mold without trapping any air."*
  > *"However, the exact melt front behavior may change slightly and it is not uncommon for the melt to trap gas at
  > these locations."*
  > *"The other four vent locations at the end of flow indicated in Figure 8.2 should be included since a significant
  > fraction of the displaced air from the cavity will likely exit here."*
- **Juzgable por píxeles:** **SÍ.** Los **4 del "end of flow" son obligatorios** y su ubicación sale directamente del
  mapa de isócronas (los máximos de tiempo sobre el contorno). Los 8 restantes son opcionales. Métrica dura:
  **¿hay vent en cada máximo local de tiempo de llenado sobre el borde?**

### V8.3 — Venteo en el interior de la pieza
- **§** 8.2.2
- **Figura:** Fig 8.3: *"Vent locations on part interior"*
- **Qué se mira:** el encuentro de **dos frentes cóncavos** en una superficie interior de la cavidad.
- **Criterio a ojo (literal):**
  > *"two concave melt fronts can come together and form an entrapment from which the air can not escape. As indicated
  > in Figure 8.3, a vent is therefore required on an internal surface of the mold cavity. Usually, ejector pins are
  > designed to provide such venting functions on the surface of the mold cavity."*
- **Juzgable por píxeles:** **SÍ.** Sobre las isócronas: detectar cierres de frente que **no tocan ningún borde**.
  Y el chequeo cruzado con el cap. 11: **¿coincide ese punto con un pin expulsor?** Si no, bandera. Esta es una de las
  verificaciones **cruzadas entre subsistemas** más valiosas del libro.

### V8.4 — Dead pockets
- **§** 8.2.2
- **Figura:** Fig 8.4: *"Vent locations in dead pockets"* — tres detalles en una figura
- **Qué se mira (los tres casos, literal):**
  > *"In the left detail, the melt flows from the cavity surface along the length of the boss, and eventually trapping
  > the air at the top of the boss. In the center detail, two melt fronts come together at a rib, pushing the air to the
  > top dead center of the rib. In the right detail, the melt front flows diagonally across a rib. Due to a cutout in the
  > rib, the air can be trapped in this corner of the mold cavity."*
  Escala del problema: *"There are approximately twenty such dead pockets in the bezel design that may require venting."*
- **Juzgable por píxeles:** **SÍ.** Los tres casos son **geometría de la pieza + dirección del frente**: todo boss ciego,
  toda costilla alta y todo recorte de costilla es candidato. Métrica: **conteo automático de bolsillos ciegos** y
  contraste contra el nº de vents especificados. En el bezel: ~20.

### V8.5 — Del catálogo de candidatos a los venteos especificados
- **§** 8.2.2
- **Figura:** Fig 8.5: *"Initial vent locations"*
- **Criterio a ojo (literal — la política de priorización):**
  > *"The above discussion indicates that there are about three dozen vent locations that the mold designer may wish to
  > consider. It is unlikely that all of these vent locations are necessary. Furthermore, the addition of vents is usually
  > a relatively simple operation that can be accomplished after the mold is built and tested. For this reason, it is fairly
  > common for the mold designer to initially specify vents at only the most critical vent locations."*
  Ejemplo: **8 venteos** especificados de ~36 candidatos.
- **Juzgable por píxeles:** **SÍ.** Render = la pieza con **los ~36 candidatos en gris y los especificados en color**.
  Métrica: cobertura de los críticos (end of flow + trampas interiores), no del total.

### V8.6 — Dimensiones del venteo en el plano de partición
- **§** 8.2.3 Specify Vent Dimensions
- **Figura:** Fig 8.6: *"Vent design on parting plane"*
- **Qué se mira:** **detalle en sección** del vent: *land* delgado seguido de canal de alivio y salida.
- **Cotas (literales):** espesor h_vent = **0.06 mm** · longitud del land L = **2 mm** · canal posterior de **2 mm**
  hasta salida de **3 mm de diámetro**. El ancho W *"made purposefully high to provide for uncertainty in the last area
  of the melt to fill the cavity"* (sin valor fijo). Recomendación general de espesor en plano de partición:
  *"on the order of 0.02 mm."*
- **Tabla 8.1 *"Recommended vent thicknesses (mm)"*** (referencia cruzada de tres fuentes):
  baja viscosidad (PP, PA, POM, PE) → 0.08 / 0.1 / 0.015 · media viscosidad (PS, ABS, PC, PMMA) → 0.2 / 0.3 / 0.03.
- **Juzgable por píxeles:** **SÍ.** El detalle en sección se acota directamente: espesor del land, longitud del land,
  y el escalón al canal de alivio. Falla = land demasiado largo o sin alivio (el aire no sale).

### V8.7 — Venteo perimetral en pieza cilíndrica
- **§** 8.2.3
- **Figura:** Fig 8.7: *"Vent design around cylindrical part"*
- **Cotas (literales):** espesor **0.015 mm**, longitud **1 mm**.
- **Criterio a ojo (riesgo estético declarado):** susceptible a rebaba por flexión del molde, y
  > *"the outside, bottom surface of the lid is an area observed and handled by the end-user."*
- **Juzgable por píxeles:** **SÍ** (acotar el detalle) **+ cruce con V12.4**: si la deflexión del molde supera el espesor
  del vent, habrá flash. Ese cruce es exactamente el argumento de Fig 12.6.

### V8.8 — Venteo alrededor de pin y blade expulsores
- **§** 8.2.3
- **Figura:** Fig 8.8: *"Vent design around ejector pin and blade"*
- **Cotas (literales):** holgura diametral típica **0.13 mm (0.005 in)** ⇒ espesor de venteo **0.065 mm (0.0025 in)**;
  el canal de venteo se mantiene hasta **3 mm** de la superficie de la cavidad y luego se abre (taper) al diámetro nominal.
- **Criterio a ojo (literal):**
  > *"Both of these elements should be present in a good vent design"* — es decir, **canal ancho + taper de guía**, los dos.
- **Juzgable por píxeles:** **SÍ.** En el detalle en sección: verificar que existan **los dos** escalones. La ausencia
  de cualquiera de ellos es una falla nombrada por el libro.

### V8.9 — Venteo dentro del inserto de núcleo (mecanizado y sinterizado)
- **§** 8.2.3
- **Figuras:** Fig 8.9 y Fig 8.10, ambas con caption *"Vent design in core insert"*
- **Qué se mira:** Fig 8.9 — Detail A: el vent abarca **solo el ancho de la costilla** (*"the vent only spans the width
  of the rib where the trapped air is expected"*); Details B y C: H = **0.2 mm**, L = **2 mm**.
  Fig 8.10 — inserto sinterizado poroso: diámetro **2–12 mm**, microporos **0.03–0.1 mm**.
- **Criterio a ojo:** la regla verbal es la de Detail A (el vent se ajusta al ancho de la trampa, no más).
- **Juzgable por píxeles:** **SÍ.** Comparar el ancho del vent contra el ancho de la costilla/bolsillo que ventea.

---

## Capítulo 9 — Enfriamiento (el circuito y la uniformidad térmica)

### V9.1 — Concentración de esfuerzo alrededor de la línea de agua
- **§** 9.2.5
- **Figura:** Fig 9.4: *"Stress distributions around cooling line"* — **par de mapas de contorno**, rotulados en la
  figura como **"Hline = 1 D, σ = 3.3 · Pmelt"** y **"Hline = 4 D, σ = 2.6 · Pmelt"**
- **Qué se mira:** los contornos de esfuerzo alrededor del barreno a dos profundidades.
- **Criterio a ojo (literal):**
  > *"the magnitude of the stress increases as the cooling line approaches the mold wall."*
- **Par bueno/malo:** 1·D = más concentración (peor); 4·D = menor. Es un **gradiente**, no un binario.
- **Cotas derivadas:** P20 con esfuerzo de resistencia 456 MPa a H=4D ⇒ P_melt max = 456/2.6 = **175 MPa**;
  aluminio a H=1D ⇒ 166/3.3 = **50 MPa**.
- **Juzgable por píxeles:** **PARCIAL.** La profundidad en diámetros **sí** se mide en la sección (SÍ); el factor de
  concentración sale de la tabla/gráfica, no de la imagen.

### V9.2 — Paso (pitch) vs. variación del flujo de calor ★
- **§** 9.2.6
- **Figura:** Fig 9.5: *"Effect of pitch on variation in heat flux"*
- **Qué se mira:** curva de % de variación de flujo de calor contra la razón paso:profundidad (acero y aluminio).
- **Criterio a ojo (literal — EL umbral numérico del capítulo):**
  > *"the variation in the heat flux is less than 5% up to a cooling line pitch equal to twice the cooling line depth.
  > Afterwards, the variation in heat flux increases dramatically."*
  Regla de diseño resultante: **H_line < W_line < 2·H_line**.
  Nota contraintuitiva verificable en la gráfica: los materiales muy conductivos (aluminio, cobre) **aumentan** la
  variación de flujo, no la reducen.
- **Juzgable por píxeles:** **SÍ, directísimo.** Sobre la sección del molde: medir profundidad y paso de cada línea y
  evaluar 1 < paso/profundidad < 2. Es el chequeo de enfriamiento más barato y más citado del libro.

### V9.3 — Flechas de flujo de calor (paso apretado vs. ancho)
- **§** 9.2.6
- **Figura:** Fig 9.6: *"Heat flow from cavity center-line to cooling line"* — **par rotulado en la figura**:
  **"Wline = Hline"** vs. **"Wline = 4 Hline"**
- **Qué se mira:** flechas cuya **longitud codifica la magnitud** del calor extraído en cada punto de la superficie.
- **Criterio a ojo (literal):**
  > *"the lengths of the arrows represent the relative amount of heat flowing out of the mold cavity at that location."*
  > *"the effective heat transfer rate at the mold wall is reduced… a significant variation in the heat transfer rate
  > arises across the cavity surface."*
- **Par bueno/malo:** W=H = **BUENO** (flechas parejas); W=4H = **MALO** (flechas muy desiguales).
- **Juzgable por píxeles:** **SÍ.** Render con glifos vectoriales sobre la superficie de cavidad; métrica =
  **desviación estándar de la longitud de flecha** a lo largo de la superficie. Kazmer literalmente juzga por
  "qué tan parejas se ven las flechas".

### V9.4 — Distribución de temperatura en pieza y molde
- **§** 9.2.6
- **Figura:** Fig 9.7: *"Temperature distribution in plastic and mold"* — mismo par W=H vs. W=4H
- **Criterio a ojo (literal):**
  > *"With a tight cooling line pitch, the moldings are ejected not only with a lesser temperature gradient across the
  > molding, but also at a significantly lower temperature. With a wide pitch, the moldings exhibit a much higher
  > temperature gradient and a much higher temperature."*
- **Par bueno/malo:** paso apretado = **BUENO**; paso ancho = **MALO**.
- **Juzgable por píxeles:** **SÍ.** Dos métricas leídas del mismo mapa: **temperatura máxima** y **gradiente**
  (rango de temperatura sobre la superficie). El libro juzga las dos por separado.

### V9.5 — Zonas viables para líneas de agua
- **§** 9.2.7 Cooling Line Routing
- **Figura:** Fig 9.8: *"Potential mold areas for cooling lines"*
- **Qué se mira:** el **área sombreada** del molde donde una línea puede vivir, ya descontados los componentes.
- **Criterio a ojo (literal) y COTA:**
  > *"the mold design should provide at least half a cooling diameter between the surface of the cooling line and the
  > surface of any other mold component. This requirement maintains the structural integrity of the mold while also
  > minimizing cooling leaks during mold operation due to corrosion."*
  Los componentes que restringen: *"the mold cavity, cavity inserts, core inserts, ejector return pins, guide pins,
  sprue bushing, and other mold components."*
- **Juzgable por píxeles:** **SÍ.** Render de la sección con la máscara de zona viable; verificar que cada línea cae
  dentro. Es un test de holgura geométrica puro.

### V9.6 — Layout inviable ★ TOP-10 (MALO #1)
- **§** 9.2.7
- **Figura:** Fig 9.9: *"Infeasible initial cooling line layout"*
- **Qué se mira:** las líneas trazadas aplicando literalmente las recomendaciones numéricas (Ø 6.35 mm, profundidad
  12.7 mm, paso 25.4 mm) **superpuestas al molde real**.
- **Criterio a ojo (literal):**
  > *"This initial design is infeasible for many reasons. Perhaps the most significant shortcoming in the design is that
  > many of the cooling lines intersect critical mold features such as the sprue bushing or the interface between the
  > cavity inserts and the mold plates."*
- **Par bueno/malo:** **MALO #1** de la tríada 9.9 → 9.10 → 9.11.
- **Juzgable por píxeles:** **SÍ, es EL check de colisión.** Detección de intersección línea↔componente sobre la vista
  transparente del molde. Métrica: **conteo de intersecciones** (cualquiera > 0 = inviable). Es la verificación visual
  más barata y más decisiva del capítulo 9.

### V9.7 — Layout factible pero pobre ★ TOP-10 (MALO #2)
- **§** 9.2.7
- **Figura:** Fig 9.10: *"Feasible but poor cooling line layout"*
- **Qué se mira:** las mismas líneas **alejadas de la cavidad**, manteniendo la razón paso:profundidad.
- **Criterio a ojo (literal — el matiz que hace valiosa esta figura):**
  > *"This design requires fewer cooling lines, all of which avoid the intersection with other mold components. While
  > this design provides poor cooling performance, it is quite common. A primary advantage is that all of the cooling
  > lines are not only straight, but each cooling line also passes through a single mold plate as well. As such, the
  > cooling lines can be machined in a single setup without any need for seals or gaskets. Unfortunately, the placement
  > of the cooling lines far from the mold cavity will reduce the rate of heat transfer and necessitate longer cycle times."*
  Segunda falla, la del núcleo profundo:
  > *"There is a second significant shortcoming in this cooling line layout, which stems from the use of a straight
  > cooling line with a core of significant height. The source of cooling is at the base of the core, and heat originates
  > from the plastic all along the height of the core."*
- **Par bueno/malo:** **MALO #2** — factible pero pobre. La lección: **"no colisiona" no significa "está bien"**.
- **Juzgable por píxeles:** **SÍ.** Métrica: **distancia línea↔superficie de cavidad** en múltiplos del diámetro
  (mapa de color sobre la superficie de cavidad = "qué tan lejos está el agua de aquí"). Y la altura del núcleo sin
  refrigeración lateral.

### V9.8 — El mapa térmico que resulta del layout pobre ★ TOP-10
- **§** 9.2.7
- **Figura:** Fig 9.11: *"Temperature gradient from poor design"*
- **Qué se mira:** **mapa de contornos de temperatura al final del ciclo**, con la clave de lectura dada por el libro:
  > *"each contour line represents a 2 °C change in temperature."*
- **Criterio a ojo (literal — se cuenta contornos):**
  > *"Due to the relatively deep core, a gradient of 6 °C exists from the base of the core to the top of the core."*
  > *"the temperature at the top of the core is not only 6 °C hotter than the temperature at the base of the core, but is
  > also roughly 6 °C hotter than the temperature at the opposing surface on the cavity insert."*
  > *"The temperature gradient in Figure 9.11 will drive differential shrinkage along the axis of the cup as well as
  > differential shrinkage through the wall thickness of the molding."*
  Los tres remedios que el libro enumera y luego desarrolla: *"using a highly conductive core insert, implementing a
  baffle or bubbler, or designing a cooling insert."*
- **Par bueno/malo:** es **la consecuencia visible** del MALO; sus contrapartes buenas son Fig 9.17, 9.18 y 9.19(b).
- **Juzgable por píxeles:** **SÍ, y de forma literal: se CUENTAN los contornos.** Métricas: (a) ΔT base→punta del núcleo;
  (b) ΔT core↔cavity en la misma pared (el que causa alabeo, ver V10.8). Un juez con ojos que cuente isotermas replica
  exactamente el razonamiento de Kazmer.

### V9.9 — Circuito en serie
- **§** 9.3.1
- **Figura:** Fig 9.12: *"Bezel cooling line layout in series"*
- **Qué se mira:** las 8 líneas conectadas en cascada con mangueras cortas, en **vista del circuito de agua sobre el molde**.
- **Criterio a ojo (literal):**
  > *"the flow resistance through the combined length of all the cooling lines can be extremely high… the mold coolant
  > temperature can increase along the length of the cooling circuit… a significant temperature differential can arise from
  > where the coolant enters the mold to where the coolant exits."*
- **Par bueno/malo:** **MALO** frente a Fig 9.13/9.14.
- **Juzgable por píxeles:** **SÍ.** Sobre la vista del circuito: **longitud total del camino más largo** y **nº de líneas
  en serie**. Un colormap de "temperatura acumulada del refrigerante a lo largo del circuito" reproduce el argumento.

### V9.10 — Cuatro circuitos en paralelo
- **§** 9.3.1
- **Figura:** Fig 9.13: *"Bezel cooling line layout with four parallel cooling circuits"*
- **Criterio a ojo (literal):**
  > *"This configuration is extremely common since it is simple and provides effective cooling"*, aunque
  > *"the installation and removal of the mold from the machine is complicated by the number of lines."*
- **Par bueno/malo:** **MEJOR** que 9.12.
- **Juzgable por píxeles:** **SÍ** — nº de conexiones externas y longitud del circuito más largo.

### V9.11 — Manifold interno en paralelo
- **§** 9.3.1
- **Figura:** Fig 9.14: *"Bezel with internal, parallel cooling line layout"*
- **Qué se mira:** dos líneas verticales que unen las 8 horizontales, con **veinte tapones a presión** bloqueando
  selectivamente el flujo.
- **Criterio a ojo (literal):**
  > *"only two connections are required. At the same time, the cooling uniformity is increased… very little added cost
  > while delivering both increased performance and ease of use."*
- **Par bueno/malo:** **EL MEJOR** de la progresión 9.12 → 9.13 → 9.14.
- **Juzgable por píxeles:** **SÍ** — nº de conexiones (2) + uniformidad del recorrido por rama.

### V9.12 — Circuito periférico taladrado
- **§** 9.3.1
- **Figura:** Fig 9.15: *"Bezel with drilled peripheral cooling line layout"*
- **Criterio a ojo (literal):**
  > *"This design provides extreme ease of use, moderate flow resistance, and uniform cooling about the entire molding."*
  Se justifica porque en molde de 3 placas o canal caliente *"there is no heat being generated in the central area of the
  mold cavity."*
- **Juzgable por píxeles:** **PARCIAL** — la validez depende de dónde está el calor (mapa de espesor/llenado), no solo del trazo.

### V9.13 — Enfriamiento fresado con gasket
- **§** 9.3.2
- **Figura:** Fig 9.16: *"Bezel core insert with milled cooling"* (la figura incluye la leyenda **"Gasket"**)
- **Criterio a ojo (riesgo, literal):**
  > *"leakage should be expected at any ejector pins located internal to the area surrounded by gasket."*
- **Juzgable por píxeles:** **SÍ, y es otro cruce entre subsistemas.** Sobre la planta del núcleo: **¿hay pines
  expulsores dentro del contorno del gasket?** Booleano duro que solo se ve superponiendo dos subsistemas.

### V9.14 — Enfriamiento conformal
- **§** 9.3.3
- **Figura:** Fig 9.17: *"Core insert for cup with conformal cooling lines"*
- **Criterio a ojo (literal, por referencia a la figura mala):** las líneas helicoidales sirven para
  > *"eliminating the temperature gradients shown in Figure 9.7."*
- **Juzgable por píxeles:** **SÍ (indirecto):** se juzga por su mapa térmico resultante, no por el trazo.

### V9.15 — Núcleo conductivo profundo
- **§** 9.3.4
- **Figura:** Fig 9.18: *"Temperatures in deep conductive core"*
- **Criterio a ojo (literal — comparación numérica contra el mapa malo):**
  > *"As before, each contour line represent a 2 °C change in temperature."*
  > *"the temperature gradient has been reduced by approximately 60% compared to temperature gradients shown in Figure 9.11."*
- **Par bueno/malo:** **BUENO** contra Fig 9.11.
- **Juzgable por píxeles:** **SÍ** — mismo conteo de isotermas, y el **% de reducción** es la métrica del par.

### V9.16 — Temperatura en la esquina: P20 vs. cobre
- **§** 9.3.4
- **Figura:** Fig 9.19: *"Temperature distribution in corner"* — **par rotulado dentro de la figura**:
  **(a) "P20 cavity and core"** vs. **(b) "P20 cavity and Cu 940 core"**
- **Criterio a ojo (literal):** (a) produce *"a 5 °C gradient across the wall thickness of the molding"*; (b) produce
  *"only a 1 °C differential across the wall thickness."*
- **Par bueno/malo:** (a) = **MALO** · (b) = **BUENO**.
- **Juzgable por píxeles:** **SÍ.** La métrica es **ΔT a través del espesor de la pieza en la esquina** — exactamente
  la variable que alimenta la fórmula de alabeo de V10.8. Otro cruce cap. 9 → cap. 10.

### V9.17 — Enfriamiento de núcleos esbeltos: inserto, baffle, bubbler, heat pipe, pin conductivo
- **§** 9.3.5
- **Figuras:** Fig 9.20: *"Core cooling insert"* · Fig 9.21: *"Spiral baffle"* · Fig 9.22: *"Bubbler"* ·
  Fig 9.23: *"Heat pipe"* · Fig 9.24 y Fig 9.25, ambas con caption *"Conductive pin"*
- **Qué se mira:** sección del núcleo con el dispositivo dentro.
- **Criterio de selección — Tabla 9.3 *"Slender core cooling options"* (cotas literales):**

  | Opción | Diámetro de núcleo | Diámetro de barreno | Tasa de enfriamiento |
  |---|---|---|---|
  | Cooling insert | > 50 mm | > 25 mm | Very high |
  | Baffle | 12–75 mm | 6–25 mm | Very high |
  | Bubbler | 6–30 mm | 3–12 mm | High |
  | Heat pipe | 5–20 mm | 3–12 mm | Medium |
  | Conductive pin | < 5 mm | N/A | Low |

- **Criterios/cotas adicionales:** inserto de enfriamiento — advertencia de que un diseño excesivo *"may favor cooling at
  too great an expense of core strength"*; baffle — mínimo *"diameter greater than 6.35 mm (1/4 inch)"*, ejemplo de 12 mm
  en núcleo de 60 mm; bubbler — ejemplo de < 2 mm en barreno < 3 mm.
- **Juzgable por píxeles:** **SÍ.** Medir el diámetro del núcleo en la sección y verificar que el dispositivo elegido
  cae en la fila correcta de la tabla. Es una regla de selección puramente dimensional.

### V9.18 — Flujo de calor en pin esbelto y el peor caso
- **§** 9.3.6
- **Figuras:** Fig 9.26: *"Heat flux in slender pin"* · Fig 9.27: *"Worst case heat flux scenario"*
- **Qué se mira:** vectores de flujo de calor dentro del pin (9.26) y el modelo de enfriamiento por un solo lado (9.27).
- **Criterio a ojo (literal):**
  > *"The flux vectors indicate that there is some significant heat transfer around the centerline of the pin towards
  > the coolant at its base. However, the pin's cross-sectional area is so small that there is a dominating radial heat
  > flux at the surface of the pin."*
  > *"Since all the heat must transfer through one side of the molding, the thermal behavior is essentially the same as if
  > two layers of the plastic melt were on top of each other."*
  Consecuencia: usar 2·h en las ecuaciones de tiempo de enfriamiento ⇒ *"a four fold increase in the cooling time over a
  molding cooled from two sides."*
- **Juzgable por píxeles:** **SÍ (vía glifos).** Mismo truco que V9.3: renderizar vectores de flujo y juzgar si dominan
  los radiales (superficie) o los axiales (hacia el refrigerante).

---

## Capítulo 10 — Contracción y ALABEO (el capítulo más visual del libro)

### V10.1 — Contracción volumétrica, lineal y anisotrópica
- **§** 10.1.4 / 10.1.5
- **Figuras:** Fig 10.5: *"Volumetric and linear shrinkage"* · Fig 10.7: *"Volumetric and anisotropic shrinkage"*
- **Qué se mira:** cubo unitario L³ contra el cubo contraído L(1−s)³ (10.5); y la caja con L(1−a·s) en la dirección de
  flujo contra L(1−s) en las otras dos (10.7).
- **Criterio a ojo:** **son definiciones geométricas, sin juicio bueno/malo.** Fundan Ecs. 10.13–10.16.
- **Juzgable por píxeles:** **NO** (didácticas). Valor para nosotros: definen **cómo dibujar** la contracción
  (superponer la pieza nominal y la contraída).

### V10.2 — Orientación a través del espesor
- **§** 10.1.5
- **Figura:** Fig 10.6: *"Orientation leading to anisotropy"*
- **Qué se mira:** elipses de distinta relación de aspecto y orientación, **capa por capa a través del espesor**, cerca
  del frente de flujo (la figura rotula "Flow").
- **Criterio a ojo:** **el libro muestra la figura sin criterio verbal de bueno/malo**; solo señala que
  *"the orientation through the thickness can be quite complex."*
- **Juzgable por píxeles:** **NO** por sí sola; **PARCIAL** si se renderiza el tensor de orientación (el patrón de
  elipses es exactamente un glifo tensorial, muy renderizable).

### V10.3 / V10.4 — El par de mapas de contracción: 2 compuertas vs. 4 ★
- **§** 10.2.1
- **Figuras:** Fig 10.8 y Fig 10.9, ambas con caption *"Shrinkage rate for bezel molded of an ABS"* (10.8 = 2 gates,
  10.9 = 4 gates)
- **Qué se mira:** **mapa de color de tasa de contracción sobre toda la cavidad.**
- **Criterio a ojo (literal) y números:**
  > *"the results indicate that the shrinkage varies widely across the mold cavity"*
  Fig 10.8: *"Low shrinkage rates (on the order of 0.3%)"* en zonas delgadas; *"Moderate shrinkage rates (around 0.6%)"*
  en el grueso; *"High shrinkage rates (above 1%)"* cerca del fin de llenado.
  Fig 10.9 (4 compuertas): máxima baja de **1.1 % → 0.9 %**, promedio de **0.6 % → 0.5 %**.
- **Par bueno/malo:** 10.8 = línea base con gradiente fuerte al fin de llenado; 10.9 = **MEJOR**, mapa más parejo.
- **Juzgable por píxeles:** **SÍ, y es un caso de libro para el juez con ojos.** Métricas sobre el mapa: **rango
  (max − min)**, **desviación estándar**, y **% de área por encima de 1 %**. El libro nunca da un umbral único: juzga por
  **uniformidad**, no por valor absoluto. Nuestro juez debe hacer lo mismo.

### V10.5 — Diseño "steel safe" de cavidad y núcleo
- **§** 10.2.2
- **Figura:** Fig 10.10 (⚠ el caption en el texto extraído dice *"PvT behavior for an acetal"*, que **no corresponde al
  contenido** — ver apéndice de erratas)
- **Qué se mira:** sección con tres valores de contracción anotados: cavity insert s = 0.4 %, "Expected" s = 0.5 %,
  core insert s = 0.6 %.
- **Criterio a ojo:** **no hay verbo de juicio visual**; es una prescripción: mecanizar la cavidad "chica" y el núcleo
  "grande" respecto al valor esperado, para dejar acero que se pueda quitar después.
- **Juzgable por píxeles:** **PARCIAL** — se puede verificar en la vista que la dirección del sesgo sea la correcta
  (cavidad hacia menos contracción, núcleo hacia más).

### V10.6 — Sensibilidad de la contracción al proceso
- **§** 10.2.3
- **Figura:** Fig 10.11: *"Effect of processing conditions on shrinkage"*
- **Qué se mira:** barras de sensibilidad a tiempo de empaque, presión de empaque, temperatura de barril, temperatura de
  refrigerante y tiempo de enfriamiento.
- **Criterio a ojo (literal):**
  > *"Both packing time and cooling time are significant but have a small effect on shrinkage."*
  > *"The coolant temperature has a slightly greater effect than the barrel temperature."*
- **Juzgable por píxeles:** **NO** (es una gráfica de resultados, no una vista del diseño).

### V10.7 — Perfilado de presión de empaque
- **§** 10.2.3
- **Figura:** Fig 10.12: *"Effect of packing pressure profiling on shrinkage"*
- **Criterio a ojo (literal — y el criterio es explícitamente *parecerse a otra figura*):**
  > *"the linear shrinkage has approached that of the four-gated mold design without added expense."*
- **Par bueno/malo:** el bueno de referencia es Fig 10.9.
- **Juzgable por píxeles:** **SÍ.** Comparación de dos mapas: **diferencia campo a campo** entre el mapa perfilado y el
  de 4 compuertas. Kazmer juzga por semejanza de mapas; eso se computa.

### V10.8 — Alabeo por contracción diferencial **a través del espesor** ★ TOP-10
- **§** 10.3.1
- **Figura:** Fig 10.14: *"Warpage due to differential shrinkage across thickness"* — la figura tiene **tres bandas
  rotuladas dentro de la imagen**: *"Non-uniform cooling system design"* → *"Non-uniform temperature and shrinkage"* →
  *"Warpage with radius of curvature"* (con R_W acotado).
- **Qué se mira:** la **cadena causal dibujada**: circuito desigual → gradiente térmico → **la pieza curvada**, con su
  radio de curvatura.
- **FORMA DEL ALABEO:** curvatura simple (la pieza se abarquilla como un plato / una "C").
- **Criterio a ojo + fórmulas (literal):**
  > *"For the example of Figure 10.14, the core surface is hotter so this side of the plastic molding will experience
  > greater shrinkage."*
  R_warpage = 2·h / (s_core − s_cavity)  (Ec. 10.17) · δ = W · sin(W / R_warpage)  (Ec. 10.18)
  Ejemplo con la cavidad **2 °C más fría** que el núcleo: s_cavity = 0.31 %, s_core = 0.34 % ⇒ **δ = 1.6 mm** sobre una
  pieza de 240 mm de ancho. Y el remate:
  > *"this warpage of 1.6 mm is somewhat greater than the absolute edge to edge shrinkage, which is 0.8 mm."*
  > *"this warpage estimate is not sensitive to the overall temperature of the molding, but only to the temperature
  > gradient through the thickness."*
- **Par bueno/malo:** la figura **es** el caso malo; el bueno es "sin gradiente a través del espesor" (Fig 9.19b).
- **Juzgable por píxeles:** **SÍ, y es la verificación visual más potente del libro.** Render = **la pieza deformada con
  la deflexión exagerada**, más el mapa de ΔT core↔cavity que la causa. Métricas: **δ máximo fuera de plano** y
  **radio de curvatura**. Cruce obligatorio con V9.8/V9.16 (2 °C de diferencia ya producen 1.6 mm de alabeo — ese es el
  argumento entero del libro para exigir un circuito parejo).

### V10.9 — Alabeo por contracción diferencial **a través del área** (pandeo) ★ TOP-10
- **§** 10.3.1
- **Figura:** Fig 10.15: *"Warpage due to differential shrinkage across area"* — bandas rotuladas
  *"Center-gated mold cavity"* → *"Non-uniform pressure and shrinkage"* → *"Warpage with radius of curvature"*
- **Qué se mira:** la pieza de compuerta central, con la presión (y por tanto la contracción) desigual entre centro y borde.
- **FORMA DEL ALABEO:** **pandeo** — el centro de la pieza se sale del plano. Es una forma **distinta** a la de 10.14.
- **Criterio a ojo (literal) y CRITERIO NUMÉRICO DE PANDEO:**
  > *"the melt pressure in the cavity can be much higher near the gate than at the extremities of the mold cavity. As such,
  > the volumetric and linear shrinkage in the center will be less than the shrinkage around the outside of the molding.
  > If the difference in the shrinkage is large enough, then the center of the part will warp out of the plane."*
  > *"When the molding consists of a single closed area, the material within the molding is in continuous contact such that
  > any non-uniform shrinkage and stresses across the part may only be resolved through out of plane distortion of the part."*
  Criterio (Ec. 10.19): **(s_edge − s_center) > 0.44 · (h/W)²** ⇒ pandea.
  Ejemplo (tapa): **(1.66 % − 0.31 %) > 0.44 · (2 mm / 40.5 mm)²** → *"0.0135 > 0.0011"* ⇒ pandea, δ = **6.6 mm**.
- **LA COMPARACIÓN CLAVE (literal) — por qué la topología decide:**
  > *"Figure 10.15 will tend to warp due to differential shrinkage while the bezel shown in Figure 10.8 will not. The reason
  > is that the window in the laptop bezel mechanically decouples the various sides from each other, such that each side is
  > free to shrink independently."*
- **Par bueno/malo:** **tapa cerrada (10.15) = pandea** vs. **bezel con ventana (10.8) = NO pandea**, con el mismo tipo de
  contracción diferencial. Es el par más sutil y más instructivo del libro.
- **Juzgable por píxeles:** **SÍ.** Dos ingredientes, ambos visuales: (a) el **mapa de contracción** da s_center y s_edge;
  (b) **la topología de la pieza** (¿área cerrada continua o con ventana que la desacopla?) se detecta por conectividad —
  literalmente contar agujeros. Métrica: evaluar Ec. 10.19 **solo si la región es un área cerrada**.

---

## Capítulo 11 — Expulsión (los layouts de pines)

### V11.1 — La secuencia del ciclo en cuatro poses
- **§** 11.1
- **Figuras:** Fig 11.1: *"Side view of opening mold"* · Fig 11.2: *"Side view of mold with actuated ejectors"* ·
  Fig 11.3: *"Side view of mold with reset knock-out rod"* · Fig 11.4: *"Side view of closing mold"*
- **Qué se mira:** vista lateral del molde en cuatro instantes: abriendo → expulsores actuados → reset → cerrando.
- **Criterio a ojo:** **ninguno explícito** — son vistas descriptivas de la secuencia.
- **Juzgable por píxeles:** **PARCIAL** — la secuencia sí permite verificar **colisiones e interferencias a lo largo del
  recorrido** (que es un check real), pero el libro no lo plantea así.

### V11.2 — Fuerzas de expulsión y área efectiva
- **§** 11.2.1 / 11.2.2
- **Figuras:** Fig 11.5: *"Ejection force vectors"* · Fig 11.6: *"Tensile stresses pulling across effective area"* ·
  Fig 11.7: *"Different cross sections of laptop bezel"*
- **Qué se mira:** diagrama vectorial F_friction / F_normal / F_eject; el corte de la taza con el área efectiva A_eff;
  y las secciones A-A, B-B, C-C del bezel usadas para estimar A_eff en piezas con costillas.
- **Criterio a ojo:** **base geométrica de las Ecs. 11.1–11.2, sin juicio bueno/malo.** Fig 11.7 enseña que sumar solo
  dos secciones sería insuficiente en una pieza con costillas.
- **Juzgable por píxeles:** **PARCIAL** — la elección de secciones representativas sí es visual.

### V11.3 — Esfuerzos en el punto del pin
- **§** 11.2.3
- **Figura:** Fig 11.8: *"Compressive and shear stresses at ejection pin"*
- **Qué se mira:** un pin empujando su porción de pieza; base de las Ecs. 11.9–11.12 (σ_pin, τ_part).
- **Criterio a ojo:** sin juicio visual explícito.
- **Juzgable por píxeles:** **PARCIAL** — el **área de empuje por pin** sí se mide en la planta y alimenta σ.

### V11.4 — El layout candidato que el libro RECHAZA ★
- **§** 11.2.4
- **Figura:** Fig 11.9: *"Candidate ejector pin layout for laptop bezel"*
- **Qué se mira:** **planta del núcleo** con 10 pines de 4.5 mm uniformemente espaciados.
- **Criterio a ojo (literal — dos razones, ambas visibles en la planta):**
  > *"This design, however, may be unsuitable for two reasons. First, there may not be enough ejectors at locations near
  > where the molding will stick in the mold. In particular, the ribs and bosses will tend to shrink onto the core and so
  > require nearby ejector pins. Second, the ejector pin diameter is slightly large given the close proximity of the nearby
  > ribs. In this design, only 1 mm of steel separates the ejector hole from the surface of the mold cavity. With high melt
  > pressures, stresses will develop in the steel, deforming the ejector holes to be non-round, causing the ejector pins to
  > bind. Eventually, cracks will propagate between the ejector hole and the mold cavity. For these reasons, the ejector pins
  > should be made smaller and more strategically located."*
  Dato bueno de la misma figura: *"the ejector pins located at the center of the top and bottom walls would provide needed
  venting at the end of flow"* (cruce con V8.2).
- **Par bueno/malo:** **MALO**, resuelto en Fig 11.11.
- **Juzgable por píxeles:** **SÍ, las dos razones.** (a) **Distancia mínima barreno↔superficie de cavidad** (aquí 1 mm —
  se mide en la planta y se pinta en rojo); (b) **distancia de cada costilla/boss al pin más cercano** (mapa de color
  "qué tan solo está este punto de agarre").

### V11.5 — Pin lejos de las paredes del núcleo ★ TOP-10 (el MALO canónico)
- **§** 11.2.5 Layout Ejectors
- **Figura:** Fig 11.10: *"Ejector pin located away from sides of core"*
- **Qué se mira:** **planta/isométrica del núcleo** con el pin y las costillas y paredes que agarran la pieza.
- **Criterio a ojo (literal — la cita madre de todo el subsistema):**
  > *"In general, ejectors will be more effective when placed near the locations where the ejection forces are generated.
  > Furthermore, the ejectors will be more effective when pushing on rigid areas of the molded part. A common but ineffective
  > layout arises when ejector pins are uniformly distributed across the mold cavity."*
  > *"Since the molding has shrunk onto the core, the ejection force is being generated by the friction between the molding
  > and the mold core at the rib and side wall. By placing the ejector pin far from these two sticking points, a significant
  > moment and deflection will be applied before the molding is stripped off the core."*
- **Par bueno/malo:** **MALO** de la secuencia 11.10 → 11.11 → 11.12 → 11.13.
- **Juzgable por píxeles:** **SÍ, y es la métrica insignia.** Sobre la planta del núcleo: **distancia de cada pin al punto
  de agarre (costilla / pared lateral) más cercano**, y el **brazo de momento** resultante. Render: pines en su posición +
  costillas y paredes resaltadas + una línea/flecha por cada par pin↔agarre con su longitud. Un mapa de color
  "distancia al agarre" sobre el núcleo reproduce exactamente lo que Kazmer mira.

### V11.6 — Pines cerca de las paredes del núcleo ★ TOP-10 (el MEJOR)
- **§** 11.2.5
- **Figura:** Fig 11.11: *"Ejector pins located near core side walls"*
- **Qué se mira:** los **tres pines adicionales** cerca de la costilla y de la pared lateral.
- **Criterio a ojo (literal) y COTA DURA:**
  > *"The design can be improved by adding ejector pins closer to the rib and side wall as shown in Figure 11.11. In this
  > case, three additional pins are added to provide ejection forces close to the molding."*
  > *"To avoid excessive stress in the core insert due to the provision of the ejector hole, an allowance of at least one
  > ejector pin diameter should be specified between the surface of the mold cavity and the surface of the ejector hole."*
  Efecto colateral que el libro **advierte en la misma vista** (cruce con el cap. 9):
  > *"this ejector pin layout may lead to a potential cooling issue since there may not be enough clearance to provide a
  > cooling line in the core insert between the rib and the side wall. As such, the diameter of the ejector pins may be
  > reduced slightly to allow the addition of a cooling line if desired."*
- **Par bueno/malo:** **BUENO** frente a 11.10, y **corrige el 1 mm de Fig 11.9** con la regla de 1 diámetro.
- **Juzgable por píxeles:** **SÍ.** Dos métricas de la misma planta: (a) holgura barreno↔cavidad ≥ 1·Ø_pin;
  (b) **¿queda espacio para la línea de agua entre costilla y pared?** — este último es el chequeo de **conflicto entre
  expulsión y enfriamiento** que el libro plantea explícitamente y que un juez con ojos ve de un vistazo superponiendo
  ambos subsistemas sobre la planta del núcleo.

### V11.7 — Pin bajo la costilla con *ejector pad*
- **§** 11.2.5
- **Figura:** Fig 11.12: *"Ejector pins located under rib with ejector pad"*
- **Criterio a ojo (literal):**
  > *"This design has the direct benefit that the friction force and the ejection force are in-line, such that very little
  > deformation of the molding will occur."*
  Problema que motiva el pad: *"the thinness of the rib and side wall compared to the larger ejector pin diameter. To avoid
  very small ejectors that may buckle during operation, a solid boss or 'ejector pad' may be provided on the rib."*
  Y el defecto que el pad introduce:
  > *"One issue with the use of the ejector pad, however, is the high volumetric shrinkage that can lead to sink on the
  > aesthetic surface of the part."*
  Dato de diseño: *"Since the ejector pin pushes directly on the ejector pad, no draft angle is required so the ejector pad
  diameter can be maximized."*
- **Par bueno/malo:** mejor que 11.10 en alineación de fuerzas, **peor** en estética (sink).
- **Juzgable por píxeles:** **SÍ.** (a) **Colinealidad** entre el eje del pin y la costilla (ángulo ≈ 0 = bueno);
  (b) proyectar la **mancha de sink** del pad sobre la cara opuesta y evaluar si cae en superficie visible (misma mecánica
  que V2.2 y V4.3).

### V11.8 — Pines contorneados sobre las paredes
- **§** 11.2.5
- **Figura:** Fig 11.13: *"Contoured ejector pins located on side walls"*
- **Criterio a ojo (literal):**
  > *"the ejector pin is aligned with one side of the rib or wall, and then contoured to push on the top surface of the
  > feature… Compared to the previous designs, this layout allows for effective transmission of the ejection forces and
  > compact ejector pin spacing without any changes to the molded part design."*
  **El riesgo dual, y es puramente dimensional:**
  > *"if the ejector pin is too short, then a gap will form between the top of the ejector pin and the opposite surface of
  > the cavity insert. If this gap is larger than the thickness of a vent, then flash is likely to occur. Meanwhile, if the
  > ejector pin is too long, then the pin will be compressed on mold closure. With repeated ejection cycles, the pin can
  > fatigue and buckle."*
  Mitigación: enfoque *"steel-safe"* con ajustes de longitud, o meter el pin dentro de la cavidad para que los errores caigan
  en superficie no estética.
- **Par bueno/malo:** es el **más avanzado** de la secuencia; su falla es de fabricación, no de layout.
- **Juzgable por píxeles:** **SÍ.** En la sección con el molde cerrado: medir el **hueco entre la cara del pin y el inserto
  de cavidad** y compararlo contra el espesor de venteo (0.02 mm, V8.6). Es literalmente el mismo criterio que V12.4.

### V11.9 — Holguras alrededor del pin
- **§** 11.2.6
- **Figura:** Fig 11.14: *"Clearances around ejector pin"* — Detail B y Detail C (pin recto y contorneado, en sección y planta)
- **Cotas (literales):** venteo **0.02 mm (0.001 in)** en una longitud *"of the order of two to three diameters"*, tras lo
  cual el barreno debe escalonarse a un diámetro mayor; holgura general pin↔agujero **0.5 mm**, dado que
  *"typical drilling tolerances are on the order of 0.25 mm."*
- **Juzgable por píxeles:** **SÍ** — detalle en sección acotado (mismo formato que V8.8; de hecho, son la misma verificación
  vista desde dos capítulos).

### V11.10 — Retención y alineación del pin contorneado
- **§** 11.2.6
- **Figura:** Fig 11.15: *"Retention and alignment of contoured ejector pin"* — Detail D (contrabarreno que retira la cabeza
  del pin de la línea de partición) y Detail E (plano + ranura + espiga que fijan la orientación angular)
- **Criterio a ojo:** el libro muestra los detalles **sin umbral numérico de aceptación**; el criterio es de presencia:
  un pin contorneado **debe** tener rasgo antigiro.
- **Juzgable por píxeles:** **SÍ (booleano de presencia):** ¿todo pin contorneado tiene rasgo de orientación? Si no, bandera.

### V11.11 — Pandeo del pin
- **§** 11.2.6
- **Figura:** Fig 11.16: *"Buckling model of ejector pin"*
- **Qué se mira:** el pin modelado como columna (Euler, factor 0.7·L).
- **Criterio a ojo:** modelo, no juicio visual.
- **Juzgable por píxeles:** **PARCIAL** — la **esbeltez L/Ø sí se lee de la vista** y es el predictor directo.

### V11.12 — Ejector blade
- **§** 11.3.1
- **Figura:** Fig 11.17: *"Ejector blade design"*
- **Criterio a ojo (literal, con veredicto explícito en el ejemplo):** blade de **93.8 mm** de largo real contra
  **93 mm** de longitud máxima calculada ⇒ *"this blade design is marginal."*
- **Juzgable por píxeles:** **PARCIAL** — la longitud y la sección se miden en la vista; el límite es calculado.

### V11.13 — Ejector sleeve
- **§** 11.3.2
- **Figura:** Fig 11.18: *"Ejector sleeve design"* — Details B a F con las holguras en cada placa
- **Criterio a ojo:** el foco es la **concentricidad** para evitar que el sleeve se agarrote contra el core pin; el libro
  no da umbral numérico aquí.
- **Juzgable por píxeles:** **SÍ.** Medir concentricidad y holgura anular en la sección; la excentricidad es visible.

### V11.14 — Stripper plate: ensamble y actuación
- **§** 11.3.3
- **Figuras:** Fig 11.19: *"Stripper mold design"* · Fig 11.20: *"Stripper plate actuation"*
- **Criterio a ojo:** vistas de ensamble; el beneficio declarado del stripper es que da
  *"uniform ejection forces that are nearly in-line with the friction force between the molding"* — la misma virtud que
  V11.7, extendida a todo el perímetro.
- **Juzgable por píxeles:** **PARCIAL.**

### V11.15 — Los defectos del stripper plate ★
- **§** 11.3.4
- **Figura:** Fig 11.21: *"Potential stripper plate detailed design issues"* — **figura de defectos**, con Detail A y
  Detail B ampliados
- **Qué se mira:** el punto exacto donde la placa stripper toca la parte redondeada de la taza / el undercut de la tapa.
- **Criterio a ojo (literal — el dilema, no hay solución limpia):** el punto ideal de contacto (centro de la parte redondeada)
  daría *"a reliable sliding surface"* pero produce *"an undesirable and possibly sharp witness line"*; moviendo el contacto
  hacia adentro se mejora la línea visible pero aparece un filo que
  > *"can damage the vertical surface of the core insert, and will likely quickly wear. For this reason, the mold designer
  > may wish to avoid the use of [the stripper plate]"* o rediseñar la sección para tener un área plana de empuje.
- **Par bueno/malo:** **ninguna opción es buena** — el libro enseña que el defecto es intrínseco a la geometría.
  Esto importa para nuestro juez: hay verificaciones cuyo veredicto correcto es *"rediseña la pieza"*, no *"mueve el componente"*.
- **Juzgable por píxeles:** **PARCIAL.** El ángulo entre la cara de empuje del stripper y la superficie de la pieza sí se
  mide (¿hay área plana de empuje, o el contacto es tangente a una curva?); el juicio estético de la línea testigo es de experto.

### V11.16 — Expulsión elástica de un undercut
- **§** 11.3.5
- **Figuras:** Fig 11.22: *"Elastic ejection of undercut"* · Fig 11.23: *"Undercut features in bezel"*
- **Criterio a ojo + cotas (literales):** deformación δ = 1 mm sobre L = 77 mm ⇒ ε = **1.3 %**, contra el criterio de material
  *"most plastics have a strain to yield above 2%"* ⇒ la expulsión elástica es viable.
- **Juzgable por píxeles:** **SÍ.** Sobre la sección: medir la **profundidad del undercut** y el perímetro que debe estirarse;
  ε se calcula de esas dos medidas. Regla: ε < 2 % ⇒ no hace falta mecanismo. Es el filtro que decide si el molde necesita
  correderas (y por tanto su costo).

### V11.17 — Núcleo móvil para la ventana
- **§** 11.4
- **Figuras:** Fig 11.24: *"Layout of moving core"* · Fig 11.25: *"Moving core mold design layout"* ·
  Fig 11.26: *"Mold design with actuated ejectors"*
- **Qué se mira:** el interlock frontal y la **holgura entre la cara frontal del núcleo móvil y los insertos**, de modo que
  *"the entire clamping force of the actuation cylinder is applied to the window core."*
  En 11.26 se señala que la altura de los *risers* debería minimizarse por interferencia con el actuador/máquina.
- **Criterio a ojo:** la holgura frontal es el criterio (si el núcleo topa en los lados, el cilindro no sella la ventana).
- **Juzgable por píxeles:** **SÍ.** En la sección: verificar que el contacto ocurra **en la cara frontal** y que haya holgura
  lateral. Es un check de contacto/holgura visible.

### V11.18 — Corredera (slide) con pin angular
- **§** 11.4
- **Figuras:** Fig 11.27: *"Moving slide layout view"* · Fig 11.28: *"Moving slide detail view"*
- **Qué se mira:** gib de bronce, pin angular y bloque de talón.
- **Cota dura (literal):** el ángulo del pin angular está *"limited to about 20 degrees"* para evitar agarrotamiento.
- **Juzgable por píxeles:** **SÍ.** Medir el ángulo del pin en la vista y verificar ≤ 20°; verificar además que el bloque de
  talón contacte antes de que la presión cargue el pin.

### V11.19 — Retorno de los expulsores
- **§** 11.5
- **Figuras:** Fig 11.29: *"Positive ejector return with threaded knock-out rods"* · Fig 11.30: *"Early ejector return with
  compression springs"*
- **Criterio a ojo:** **sin criterio visual de defecto**; el libro compara ventajas y desventajas en prosa.
- **Juzgable por píxeles:** **NO.**

---

## Capítulo 12 — Estructural (deflexión, pilares, el molde deformado)

### V12.1 — El flujo de esfuerzos por el molde
- **§** 12.1
- **Figura:** Fig 12.1: *"Flow of stresses during molding"*
- **Qué se mira:** flechas diagonales que trazan cómo viaja la carga: insertos de cavidad/núcleo → placas de soporte →
  platinas en flexión → tie bars en tensión.
- **Criterio a ojo:** **mapa conceptual, sin umbral numérico.** Su valor es que define **qué ruta de carga debe existir**;
  si en un diseño la carga no tiene por dónde bajar, se ve aquí.
- **Juzgable por píxeles:** **NO** directamente; **SÍ** como render explicativo (glifos de trayectoria de carga).

### V12.2 — Mapa de von Mises: lado fijo vs. lado móvil ★
- **§** 12.1.1
- **Figura:** Fig 12.2: *"Von Mises stresses during molding"* — **mapa de color** bajo 150 MPa de presión de fundido
- **Qué se mira:** el mapa comparando el **lado estacionario** (cavidad, respaldada por la top clamp plate) contra el
  **lado móvil** (núcleo, con el bolsillo del expulsor detrás).
- **Criterio a ojo (literal):**
  > *"[the stationary side is] generally in a state of pure compression so very little out of plane bending occurs"*
  mientras que el lado móvil *"must transmit the load via both compressive and shear stresses, which will tend to result in
  significant plate bending."*
  Límite formal: σ_Mises < σ_limit (Ec. 12.1), con σ_limit por fluencia con factor de seguridad o por fatiga.
- **Par bueno/malo:** los **dos lados del mismo molde** funcionan como par: fijo = bien soportado, móvil = el problema.
- **Juzgable por píxeles:** **SÍ.** Sobre el mapa: **σ_max**, **% de área por encima de σ_limit**, y la **asimetría fijo↔móvil**.
  Escala de color fija (no auto-escalada) para poder comparar diseños entre sí.

### V12.3 — Curvas de material y fatiga
- **§** 12.1.1
- **Figuras:** Fig 12.3: *"Stress-strain behavior of P20 and Al 7076"* · Fig 12.4: *"Cyclic stresses in molds"* ·
  Fig 12.5: *"Stress-failure curves for QC7 and P20"*
- **Criterio (literal + números):**
  > *"For P20, the endurance stress is approximately 450 MPa"* (el gráfico rotula *"Endurance = 456 MPa"*), mientras que las
  aleaciones de aluminio *"do not exhibit an endurance stress limit"* — el aluminio **siempre** falla por fatiga con
  suficientes ciclos. Para QC7: 545 MPa si < 1000 ciclos, 370 MPa a ~10 000, **170 MPa** si se piden un millón de ciclos.
- **Juzgable por píxeles:** **NO** (son gráficas de propiedades). Son el **umbral** que colorea los mapas de V12.2 y V12.12.

### V12.4 — Deflexión del molde vs. espesor del venteo ★ TOP-10
- **§** 12.1.2
- **Figura:** Fig 12.6: *"Deflection during molding"* — **mapa de contornos de desplazamiento**, misma carga que Fig 12.2
- **Qué se mira:** cuánto se abre el molde bajo presión, en el plano de partición.
- **Criterio a ojo (literal) y COTAS:**
  superficie del núcleo *"0.24 mm to the left"*, superficie de cavidad *"0.12 mm to the right"* ⇒ separación total
  **0.36 mm (0.014 in)**. Y el veredicto:
  > *"[compared with the vent thickness] typically on the order of 0.02 mm, a significant amount of flashing is expected.
  > The mold design must be improved to reduce this deflection."*
  Nota: la platina estacionaria deflecta ≈ 0.04 mm, *"roughly twice that of the moving platen."*
- **Par bueno/malo:** la figura **es** el caso malo, con veredicto textual explícito ("must be improved").
- **Juzgable por píxeles:** **SÍ, y con un umbral absoluto rarísimo en este libro.** Métrica: **separación del plano de
  partición vs. 0.02 mm**. Si separación > espesor de venteo ⇒ **flash garantizado**. Render: la deformación exagerada +
  el mapa de apertura del parting line sobre su contorno.

### V12.5 — Área de soporte alrededor de la cavidad
- **§** 12.2.1
- **Figuras:** Fig 12.7: *"Bezel mold dimensions for compressive stress analysis"* · Fig 12.8: *"Support area around cavity"*
- **Qué se mira:** el **área proyectada que realmente transmite la fuerza de cierre**, EXCLUYENDO la cavidad, los leader pins
  y los bujes.
- **Criterio a ojo:** el criterio es de **identificación correcta del área**: lo que no es acero contra acero no sostiene.
- **Juzgable por píxeles:** **SÍ.** Es un cálculo de área sobre la planta del plano de partición: área total − cavidad −
  agujeros de componentes. Directo de una imagen binaria.

### V12.6 — Cortante en el perímetro
- **§** 12.2.2
- **Figuras:** Fig 12.9: *"Shear stresses around perimeter"* · Fig 12.10: *"Bezel mold dimensions for shear stress analysis"*
- **Criterio a ojo:** figuras de apoyo al cálculo, **sin juicio bueno/malo.**
- **Juzgable por píxeles:** **PARCIAL** (el perímetro de corte se mide en la planta).

### V12.7 — Flexión de placa modelada como viga
- **§** 12.2.3
- **Figuras:** Fig 12.11: *"Plate bending modeled as a beam"* · Fig 12.12: *"Decomposition of separate bending areas"*
- **Qué se mira:** la idealización de carga central; y la **planta + sección de un molde de 6 cavidades** mostrando cómo
  agrupar 3 cavidades para definir el ancho efectivo W.
- **Criterio a ojo:** modelado, sin veredicto.
- **Juzgable por píxeles:** **PARCIAL** — la descomposición en áreas de flexión es una decisión visual sobre la planta
  (dónde están los apoyos, qué claro le toca a cada grupo de cavidades).

### V12.8 — Colocación de los pilares de soporte ★
- **§** 12.2.3
- **Figuras:** Fig 12.13: *"Typical mold design with support pillar"* · Fig 12.14: *"Different support pillar placements"* —
  **trío comparativo**
- **Qué se mira:** **planta de la placa de soporte** con los pilares y los blades del expulsor superpuestos.
- **Criterio a ojo (literal, opción por opción):**
  - Izquierda (dos pilares chicos fuera de los blades): *"fairly evenly spaced with regard to the span of the bezel"* pero
    *"can not be placed directly under the bezel face without rearranging the ejector layout."*
  - Centro (un pilar grande centrado): *"will not greatly reduce the deflection of the mold plates since the majority of the
    plate bending will occur due to the loading on the left and right sides"*, además de posible interferencia con la barra
    expulsora central de la máquina.
  - Derecha (un pilar único intermedio): *"requires fewer support pillars… but has a larger span… and so will likely provide
    more deflection."*
- **Par bueno/malo:** **no hay ganador único** — el libro expone un trade-off de tres, y las tres restricciones son visuales:
  claro entre apoyos, interferencia con los blades del expulsor, interferencia con la barra de la máquina.
- **Juzgable por píxeles:** **SÍ, superponiendo dos subsistemas.** Métricas sobre la planta: (a) **claro máximo sin apoyo**
  bajo el área cargada; (b) **colisión pilar↔blade/pin expulsor**; (c) **colisión pilar↔barra central de la máquina**.
  Otro caso donde el juicio solo aparece si se dibujan expulsión y estructura **en la misma vista**.

### V12.9 — Superposición de compresión y flexión
- **§** 12.2.3
- **Figuras:** Fig 12.15: *"Superposition of compression and bending"* · Fig 12.16: *"Compression and bending load cases"* ·
  Fig 12.17: *"Area of mold cavity local to support pillar"*
- **Qué se mira:** el diagrama Compresión + Flexión = Total; el reparto de carga F/4 – F/2 – F/4 entre pilares y rieles.
- **META DE DISEÑO EXPLÍCITA (literal):** diseñar el pilar del molde del bezel de modo que
  *"the total deflection is less than 0.1 mm."*
- **Juzgable por píxeles:** **SÍ.** Umbral duro y absoluto: **deflexión total < 0.1 mm**, leída del mapa de desplazamiento.
  Junto con el 0.02 mm de V12.4, son los dos únicos umbrales absolutos de deflexión del libro.

### V12.10 — Cortante y flexión de las paredes laterales (la regla del *cheek*)
- **§** 12.2.4
- **Figura:** Fig 12.18: *"Shearing and bending of side walls"*
- **Qué se mira:** sección de una cavidad profunda tipo taza con la presión empujando la pared lateral.
- **Criterio a ojo (literal) y REGLA PRÁCTICA:**
  > *"the width of the cheek, Wcheek, should be equal to the height of the mold cavity, Hcavity."*
  El análisis muestra que basta W_cheek > 0.73·H_cavity, o sea que **la regla práctica ya trae factor de seguridad**.
- **Juzgable por píxeles:** **SÍ, trivialmente.** Dos cotas de la misma sección: ancho de mejilla y profundidad de cavidad.
  Es la misma verificación que V4.8 y V13.4 — **el libro la repite en tres capítulos**, señal de que importa.

### V12.11 — Interlocks redondos y rectangulares
- **§** 12.2.5
- **Figuras:** Fig 12.19: *"Round and rectangular interlocks"* · Fig 12.20: *"Mold design with round interlock"* ·
  Fig 12.21: *"Projected view of interlock and cavity"*
- **Criterio a ojo (literal):**
  > *"[both should be placed] on the parting plane and as close to the mold cavities as possible."*
  > *"the rectangular interlock will provide greater resistance to deflection due to its larger size and cross sectional area"*
  pero *"round interlocks are available in smaller sizes and are easier to install."*
  Efecto cuantificado: *"the use of the interlock effectively doubles the stiffness of the side wall, resulting in a halving
  of the amount of the side wall deflection."*
- **Par bueno/malo:** trade-off, no par puro. **El criterio visual real es la DISTANCIA del interlock a la cavidad.**
- **Juzgable por píxeles:** **SÍ.** Sobre la planta del plano de partición: distancia interlock↔cavidad (menor = mejor) y
  el área proyectada del interlock (Fig 12.21 define exactamente qué área cuenta).

### V12.12 — Concentración de esfuerzo alrededor de un barreno ★
- **§** 12.2.6
- **Figuras:** Fig 12.22: *"Stress concentration about hole"* (mapa de color) · Fig 12.23: *"Stress concentration as a
  function of distance"* (curva K vs. nº de diámetros)
- **Criterio a ojo (literal) y números:** barreno a 1.5 diámetros de la cavidad con 100 MPa aplicados ⇒
  *"the resulting maximum von Mises stress is 340 MPa, which corresponds to a stress concentration factor of 3.4."*
  Modelo: K = 3.1 + 0.75·(Ø_hole/H_hole)^2.29. Y el hecho contraintuitivo:
  > *"a stress concentration of 3 results even when a hole is located far from the cavity surface."*
- **Juzgable por píxeles:** **SÍ.** Sobre la planta/sección: **distancia de cada barreno (expulsor, agua, tornillo) a la
  superficie de cavidad, en múltiplos de su diámetro**; mapa de color de K. Esta es la generalización de la regla de
  V11.6 (1 diámetro de allowance) a todos los barrenos del molde.

### V12.13 — Deformación alrededor de un barreno de expulsor cercano a la cavidad
- **§** 12.2.6
- **Figura:** Fig 12.24: *"Deformation around ejector hole near the cavity"* — **mapa de contornos FEA**
- **Criterio a ojo (literal — y una lección de humildad):** el cálculo manual predice δ_hole = **0.03 mm**, pero la FEA da
  **0.10 mm**, por *"local bending at the top of the hole"* que el análisis a mano no captura. El libro **valida contando
  contornos**: *"0.01 mm displacement lines."*
- **Par bueno/malo:** no es par; es **la evidencia de que la vista sabe más que la fórmula**. Es el mejor argumento del
  libro entero a favor de un juez con ojos.
- **Juzgable por píxeles:** **SÍ, literalmente contando isolíneas de 0.01 mm.** Y el veredicto: un barreno que deforma
  0.10 mm cerca de la cavidad ya supera 5× el espesor de venteo.

### V12.14 — Carga del inserto de núcleo
- **§** 12.2.7
- **Figuras:** Fig 12.25: *"Axial compression of hollow core"* · Fig 12.26: *"Core insert loaded by melt pressure"* ·
  Fig 12.27: *"Lateral loading of core insert"*
- **Criterio a ojo (literal):** supuesto conservador explícito — *"a more robust design may be provided by assuming that the
  cooling insert provides no support"*, **aunque en la vista el inserto de enfriamiento parezca sostener el núcleo**
  (advertencia contra creerle a la imagen sin pensar).
  Carga lateral: el efecto es *"self-reinforcing"* — una flexión leve del núcleo deja pasar más flujo por el lado ya grueso,
  aumentando la flexión.
- **Juzgable por píxeles:** **PARCIAL.** El desplazamiento del núcleo **sí** se ve; la advertencia sobre el soporte aparente
  es justo lo contrario de un check visual.

### V12.15 — Interlock del núcleo esbelto contra la cavidad
- **§** 12.2.7
- **Figura:** Fig 12.28: *"Interlocking of slender core into cavity"*
- **Criterio a ojo (literal) y número:** interconectar el núcleo con el lado estacionario
  > *"reduces the lateral deflection of the pin to approximately 10% of the deflection for a pin that is supported on only one end."*
- **Juzgable por píxeles:** **SÍ (booleano + efecto):** ¿el núcleo esbelto tiene apoyo en el extremo libre? Presencia/ausencia
  visible en la sección; el 10 % es el premio.

### V12.16 — Flow leaders para reducir la deflexión del núcleo
- **§** 12.2.7
- **Figura:** Fig 12.29: *"Use of flow leaders to minimize core deflection"*
- **Criterio a ojo (literal):** los flow leaders permiten que el fundido
  > *"propagate into the thinner adjacent sections of the cavity and partially freeze, thereby preventing the core from
  > deflecting a significant amount."*
- **Nota valiosa:** el **mismo recurso** que en §5.5.5 servía para equilibrar el llenado (V5.5) aquí sirve para sostener el
  núcleo. Un juez con ojos debe reportar los flow leaders una vez y evaluarlos contra los dos objetivos.
- **Juzgable por píxeles:** **PARCIAL** — el mapa de espesor muestra los flow leaders; el efecto en deflexión es del modelo.

### V12.17 — Ajustes de interferencia para insertos
- **§** 12.3.1
- **Figuras:** Fig 12.30: *"Location-interference fit for inserts"* · Fig 12.31: *"Insert and plate dimensions for an FN1 fit"*
- **Cotas (literales):** interferencia del orden de *"0.01% of the nominal dimension"*; ejemplo FN1 — inserto 88.96–88.98 mm
  contra agujero 88.90–88.92 mm.
- **Juzgable por píxeles:** **NO** (tolerancias, no geometría visible a esta escala).

### V12.18 — Tornillos
- **§** 12.3.2
- **Figuras:** Fig 12.32: *"Typical socket head cap screw"* · Fig 12.33: *"Worst case analysis for screw loading"*
- **Criterio/proporciones (literales):** altura de cabeza = diámetro de rosca; diámetro de cabeza ≈ **150 %** del diámetro de
  rosca. Caso de carga: izaje con un solo tornillo tensado y factor n_g = **10 "gravities"** por choque de grúa.
- **Juzgable por píxeles:** **PARCIAL** — las proporciones de cabeza se verifican en la vista; la carga no.

### V12.19 — Dowels de localización
- **§** 12.3.3
- **Figura:** Fig 12.34: *"Typical locating dowel design"*
- **Cota (literal):** holgura promedio dowel/agujero de *"0.0015 mm (or 1.5 μm)"*.
- **Juzgable por píxeles:** **NO** (micras).

---

## Capítulo 13 — El molde completo y las tecnologías avanzadas

### V13.1 — El árbol de selección de tecnología
- **§** 13.1
- **Figura:** Fig 13.1: *"Mold technology selection flow chart"*
- **Qué se mira:** el árbol desde cuatro objetivos raíz — *"Compete effectively"* → *"Higher quality"* / *"Higher yields"* /
  *"Lower costs"* / *"Faster time to market"* — ramificando a multi-shot, coinyección, gas/water assist, injection blow,
  lost core, in-mold labeling, control de temperatura de pared, reverse ejection, split cavity, núcleo rotativo, injection
  compression, Dynamic Feed™, Melt Flipper™, canal caliente, stack mold, insulated runner, dos placas, molde prototipo y
  mecanizado de alta velocidad.
- **Criterio a ojo:** **flowchart de selección, sin criterio de defecto.**
- **Juzgable por píxeles:** **NO.** Valor: es el **índice de decisiones** que el juez debe poder justificar ("¿por qué canal
  caliente y no tres placas?").

### V13.2 — Secciones de canal de gas: cuál es la peor ★
- **§** 13.3 (moldeo asistido por fluido)
- **Figura:** Fig 13.5: *"Flow channel sections for fluid assisted molding"* — **la única figura del cap. 13 con veredicto
  comparativo explícito dentro de una misma imagen**
- **Qué se mira:** varias secciones de canal de gas, comparando qué tan uniforme queda la pared moldeada resultante.
- **Criterio a ojo (literal):**
  > *"it is desirable to develop a gas channel to provide as uniform a molded wall as possible… For this reason, the top
  > right gas channel in Figure 13.5 is least preferred. Since the other flow channels are cored out by the fluid, the
  > cooling and shrinkage is made relatively uniform without extended cycle times."*
- **Par bueno/malo:** **la sección superior derecha es la peor**; las demás son aceptables.
- **Juzgable por píxeles:** **SÍ.** Sobre cada sección: **uniformidad del espesor de pared remanente** alrededor del canal
  (desviación estándar del espesor medido radialmente). Es la misma métrica de V2.1 aplicada a la sección del canal.

### V13.3 — Calentamiento por inducción: el gradiente que genera defectos
- **§** 13.7 (control de temperatura de pared de molde)
- **Figura:** Fig 13.25: *"Mold design with induction heating"* — con trazas A, B, C, D de temperatura superficial contra
  tiempo (A y B muestran el calentamiento localizado; C y D, alejadas, no reaccionan al inicio)
- **Criterio a ojo (literal) y COTA:** potencia < 100 W/cm² *"did not significantly increase the mold surface temperature and
  eventually caused the overload breaker to actuate"*; potencia > 10 000 W/cm² ⇒
  > *"the rate of the surface temperature increase became too steep to control… defects such as gloss irregularities, sink
  > marks, etc. were observed with temperature differences of more than 50 °C across the surface of the mold."*
- **Juzgable por píxeles:** **SÍ.** Umbral absoluto y visible en un mapa térmico de la **superficie del molde**:
  **ΔT > 50 °C ⇒ defectos de brillo y sink**. Es el gemelo, en el molde caliente, del gradiente de 6 °C de V9.8.

### V13.4 — Split cavity: la regla del *cheek* otra vez
- **§** 13.9
- **Figura:** Fig 13.29: *"Split cavity mold design"* (pinos de boliche)
- **Criterio a ojo (literal, por referencia cruzada):**
  > *"the thickness of the cheek is approximately the same as the depth of the mold cavity, as suggested by the analysis
  > of Section 12.2.4."*
- **Juzgable por píxeles:** **SÍ** — idéntico a V12.10 y V4.8.

### V13.5 — El resto de las secciones de tecnologías avanzadas
- **§** 13.2 – 13.10
- **Figuras:** Fig 13.2 *"Coinjection molding process"* · 13.3 *"Coinjection mold and process"* · 13.4 *"Gas assist with
  injection decompression"* · 13.6 *"Compression molding with inserted component"* · 13.7 *"Insert molding with mold
  temperature control"* · 13.8 *"Lost core molding with internal components"* · 13.9 *"Injection blow mold with rotating
  cavities and reciprocating core"* · 13.10 y 13.11 (ambas *"Two layer injection blow molding"*, ver erratas) ·
  13.12 *"Plane view of mold with core-back"* · 13.13 *"Section view of mold with core-back"* · 13.14 *"Multi-station mold
  design"* · 13.15 *"Turret style molding machine and mold design"* · 13.16 *"Insulated runner design"* · 13.17 *"Early stack
  mold design"* · 13.18 *"Hot runner stack mold design"* · 13.19 *"Branched runner system"* · 13.20 *"Level change mold
  inserts, also known as Melt Flipper"* · 13.21 *"Dynamic feed control"* · 13.22 *"Self-regulating valve design"* ·
  13.23 *"Mold design for pulsed cooling"* · 13.24 *"Mold design with conduction heating"* · 13.26 *"Mold design with managed
  heat transfer"* · 13.27 *"In mold labeling with static charge"* · 13.28 *"In mold labeling with indexed film"* ·
  13.30 *"Mold design with collapsible core"* · 13.31 *"Mold design with coarsely threaded rotating core"* ·
  13.32 *"Mold design with planetary gearing of rotating cores"* · 13.33 *"Mold design with reverse ejection"*
- **Criterio a ojo:** **el libro presenta estas figuras sin criterio verbal de bueno/malo.** Son secciones y vistas de
  ensamble que explican el mecanismo; las ventajas y desventajas se discuten en prosa, no señalando la imagen.
- **Juzgable por píxeles:** **NO** como juicio de calidad. **SÍ** como catálogo de **vistas de sección que el molde debe poder
  producir**: si nuestro CAD genera un molde con corredera, núcleo colapsable o stack, tiene que poder dibujar esta sección.

---

## Tabla resumen — las 122 verificaciones en una línea

**Orden:** por `puntaje = importancia (1-5) × facilidad de renderizar (1-5)`. La importancia es cuánto decide si el
molde sirve (criterio del libro); la facilidad es cuánto trabajo cuesta producir la vista con nuestro motor
(criterio nuestro). La columna **L** es la lámina canónica que la cubre (ver la sección siguiente).

| ID | § | Qué se mira | Píxeles | L | Pts |
|---|---|---|---|---|---|
| V11.5 | 11.2.5 | Planta del núcleo: brazo de palanca del pin al punto de agarre (costilla/pared) | SÍ | L1 | 25 |
| V11.6 | 11.2.5 | Planta del núcleo: holgura barreno↔cavidad ≥ 1 Ø + conflicto con la línea de agua | SÍ | L1 | 25 |
| V9.6 | 9.2.7 | Colisión de líneas de agua contra sprue/insertos/componentes | SÍ | L10 | 25 |
| V9.2 | 9.2.6 | Razón paso:profundidad de las líneas de agua (1 < W/H < 2) | SÍ | L10 | 25 |
| V12.4 | 12.1.2 | Apertura del plano de partición bajo presión vs. espesor de venteo (0.02 mm) | SÍ | L20 | 25 |
| V5.3 | 5.5.4 | Race-tracking, línea de soldadura y trampa de gas en el patrón de llenado | SÍ | L14/L15 | 25 |
| V4.10 | 4.3.1 | Envolvente de cavidades: razón W:L < 2:1 y compacidad | SÍ | L2 | 25 |
| V8.1 | 8.2.2 | Los tres tipos de convergencia del frente ⇒ ubicaciones de venteo | SÍ | L14 | 25 |
| V10.8 | 10.3.1 | Alabeo por gradiente térmico a través del espesor (curvatura, δ) | SÍ | L17 | 25 |
| V2.6 | 2.3.6 | Mapa de draft sobre la pieza contra el mínimo por acabado | SÍ | L12 | 25 |
| V2.7 | 2.3.7 | Regiones de draft negativo = undercuts; conteo de mecanismos | SÍ | L12/L22 | 20 |
| V5.1 | 5.2.2 | Dispersión del tiempo de llegada a los bordes; zona de estancamiento | SÍ | L14 | 20 |
| V9.7 | 9.2.7 | Distancia línea de agua↔superficie de cavidad; núcleo alto sin refrigerar | SÍ | L10 | 20 |
| V9.8 | 9.2.7 | Conteo de isotermas (2 °C/contorno): ΔT base→punta y core↔cavity | SÍ | L18 | 20 |
| V10.9 | 10.3.1 | Pandeo por contracción diferencial en área + topología (ventana desacopla) | SÍ | L16/L17 | 20 |
| V11.4 | 11.2.4 | Planta del núcleo: 1 mm de acero entre barreno y cavidad; agarres sin pin | SÍ | L1 | 20 |
| V2.1 | 2.3.1 | Mapa de espesor + dirección de flujo: transición delgado→grueso viva | SÍ | L13 | 20 |
| V7.1 | 7.1.3 | ¿La compuerta cae en superficie visible o de acoplamiento? | SÍ | L21 | 20 |
| V6.2 | 6.4.2 | Longitud sprue→gate por cavidad (balanceo natural) y volumen de colada | SÍ | L2 | 20 |
| V8.2 | 8.2.2 | Venteos en los máximos de tiempo de llenado sobre el borde (end of flow) | SÍ | L14 | 20 |
| V12.10 | 12.2.4 | Ancho de mejilla vs. profundidad de cavidad (W_cheek = H_cavity) | SÍ | L5 | 20 |
| V7.7 | 7.2.7 | Tunnel gate: 45° al parting, cono ≥ 20°, ≥ 3 Ø del plano | SÍ | L7 | 20 |
| V10.3/10.4 | 10.2.1 | Mapa de contracción: rango, σ y % de área > 1 % (2 vs. 4 compuertas) | SÍ | L16 | 20 |
| V12.9 | 12.2.3 | Deflexión total < 0.1 mm con pilar de soporte | SÍ | L20 | 20 |
| V12.12 | 12.2.6 | Distancia de cada barreno a la cavidad en Ø ⇒ factor K | SÍ | L1/L19 | 20 |
| V4.13 | 4.3.3 | Silueta del molde contra tie bars; altura dentro de [350, 800] mm | SÍ | L4 | 20 |
| V8.3 | 8.2.2 | Cierres de frente que no tocan borde ⇒ ¿hay pin expulsor ahí? | SÍ | L14+L1 | 20 |
| V2.2 | 2.3.2 | Costilla: base ≤ 0.70·h, altura 4·h, paso 10·h; sink proyectado | SÍ | L13 | 20 |
| V5.6 | 5.5.5 | Par de mapas de llenado lado a lado (con y sin flow leaders) | SÍ | L14 | 20 |
| V9.5 | 9.2.7 | Zona viable: ≥ ½ Ø entre línea de agua y cualquier componente | SÍ | L10 | 20 |
| V4.3 | 4.1.2 | ¿La línea de partición cruza superficie visible? (marca testigo + rebaba) | SÍ | L21 | 20 |
| V7.4 | 7.2.3-4 | Espesor local en el punto de entrada vs. espesor máximo (gate a sección delgada) | SÍ | L13 | 20 |
| V8.4 | 8.2.2 | Conteo de bolsillos ciegos (bosses, costillas, recortes) vs. vents | SÍ | L14 | 16 |
| V9.3 | 9.2.6 | Uniformidad de las flechas de flujo de calor sobre la superficie de cavidad | SÍ | L18 | 16 |
| V9.4 | 9.2.6 | Temperatura máxima y gradiente al expulsar (paso apretado vs. ancho) | SÍ | L18 | 16 |
| V12.2 | 12.1.1 | Mapa de von Mises: σ_max, % sobre σ_limit, asimetría lado fijo↔móvil | SÍ | L19 | 16 |
| V12.13 | 12.2.6 | Isolíneas de 0.01 mm alrededor del barreno de expulsor cercano a la cavidad | SÍ | L20 | 16 |
| V12.8 | 12.2.3 | Planta de soporte: claro sin apoyo, colisión pilar↔blade y ↔barra de máquina | SÍ | L3 | 16 |
| V11.8 | 11.2.5 | Hueco del pin contorneado contra el inserto de cavidad vs. espesor de vent | SÍ | L6 | 16 |
| V9.9 | 9.3.1 | Circuito en serie: longitud del camino más largo, nº de líneas encadenadas | SÍ | L10 | 16 |
| V9.11 | 9.3.1 | Manifold interno: nº de conexiones externas y uniformidad por rama | SÍ | L10 | 16 |
| V9.16 | 9.3.4 | ΔT a través del espesor en la esquina (5 °C P20 vs. 1 °C Cu 940) | SÍ | L18 | 16 |
| V11.16 | 11.3.5 | Profundidad del undercut ⇒ ε < 2 % (¿hace falta corredera?) | SÍ | L22 | 16 |
| V4.5 | 4.1.3 | Superficie de partición coloreada por ángulo: rojo < 5° | SÍ | L11 | 16 |
| V4.8 | 4.2.2 | Holgura del inserto: 3 Ø de agua por lado vs. W_cheek = H_cavity | SÍ | L5 | 16 |
| V8.6 | 8.2.3 | Detalle del vent: land 0.06 mm × 2 mm + canal de alivio + salida Ø 3 mm | SÍ | L8 | 16 |
| V8.8 | 8.2.3 | Vent del pin: canal ancho **y** taper de guía (ambos presentes) | SÍ | L8 | 16 |
| V9.17 | 9.3.5 | Ø del núcleo ⇒ dispositivo correcto (inserto/baffle/bubbler/heat pipe/pin) | SÍ | L9 | 16 |
| V9.13 | 9.3.2 | ¿Hay pines expulsores dentro del contorno del gasket? (fuga) | SÍ | L1 | 16 |
| V6.3 | 6.5.1 | Perfil del runner: redondo 100 % → medio redondo 61.2 % | SÍ | L7 | 16 |
| V10.7 | 10.2.3 | Semejanza del mapa de contracción perfilado contra el de 4 compuertas | SÍ | L16 | 16 |
| V4.11 | 4.3.2 | Área usable del plano de partición: ≥ ½ Ø a cada componente | SÍ | L2 | 16 |
| V12.5 | 12.2.1 | Área de soporte real = total − cavidad − barrenos de componentes | SÍ | L2 | 16 |
| V13.3 | 13.7 | Mapa térmico de superficie de molde: ΔT > 50 °C ⇒ brillo irregular y sink | SÍ | L18 | 15 |
| V5.2 | 5.5.4 | Lay-flat con arcos desde el gate y phantom gates (el método a mano) | SÍ | L15 | 15 |
| V2.4 | 2.3.4 | Filete externo 150 %·h / interno 50 %·h; espesor constante en la esquina | SÍ | L13 | 15 |
| V11.7 | 11.2.5 | Colinealidad pin↔costilla; sink del ejector pad sobre cara visible | SÍ | L1/L21 | 15 |
| V8.5 | 8.2.2 | Candidatos (~36) en gris vs. especificados (8) en color: cobertura de críticos | SÍ | L14 | 15 |
| V9.15 | 9.3.4 | % de reducción del gradiente contra el mapa malo (Fig 9.11) | SÍ | L18 | 15 |
| V12.11 | 12.2.5 | Distancia interlock↔cavidad y área proyectada del interlock | SÍ | L2 | 15 |
| V7.3 | 7.2.2 | Pin-point: signo del cono (reverse taper) y razón L/Ø | SÍ | L7 | 15 |
| V11.9 | 11.2.6 | Holgura del pin: vent 0.02 mm en 2-3 Ø + escalón; holgura general 0.5 mm | SÍ | L8 | 15 |
| V5.5 | 5.5.5 | Patrón corregido: los frentes cierran en un borde, no en el centro de una pared | SÍ | L14/L15 | 15 |
| V9.10 | 9.3.1 | Cuatro circuitos en paralelo: nº de conexiones vs. longitud de circuito | SÍ | L10 | 15 |
| V2.3 | 2.3.3 | Boss/rib/gusset al 70 %·h; ángulos 120°/90° entre gussets | SÍ | L13 | 15 |
| V13.2 | 13.3 | Uniformidad del espesor remanente alrededor del canal de gas | SÍ | L13 | 12 |
| V12.15 | 12.2.7 | ¿El núcleo esbelto tiene apoyo en el extremo libre? (deflexión al 10 %) | SÍ | L5 | 12 |
| V8.9 | 8.2.3 | Ancho del vent ajustado al ancho de la costilla; H 0.2 mm × L 2 mm | SÍ | L8 | 12 |
| V8.7 | 8.2.3 | Vent perimetral 0.015 mm × 1 mm; cruce con la deflexión del molde | SÍ | L8 | 12 |
| V11.18 | 11.4 | Ángulo del pin angular ≤ 20°; el bloque de talón contacta primero | SÍ | L6 | 12 |
| V11.17 | 11.4 | Núcleo móvil: contacto en la cara frontal, holgura lateral | SÍ | L6 | 12 |
| V7.10 | 7.2.9 | Valve gate cerrado: escalón cara del vástago↔cavidad ≈ 0 | SÍ | L7 | 12 |
| V6.5 | 6.5.2 | Intrusión del sucker pin en el canal (tope del pin ≡ fondo del runner) | SÍ | L7 | 12 |
| V13.4 | 13.9 | Split cavity: mejilla ≈ profundidad de cavidad | SÍ | L5 | 12 |
| V4.7 | 4.2.1 | Altura del inserto ≥ 3 Ø de línea de agua sobre la pieza | SÍ | L5 | 12 |
| V2.5 | 2.3.4 | Chaflán interno de ½·h a 45° | SÍ | L13 | 12 |
| V11.13 | 11.3.2 | Concentricidad y holgura anular del ejector sleeve | SÍ | L8 | 12 |
| V11.10 | 11.2.6 | ¿Todo pin contorneado tiene rasgo antigiro? (booleano de presencia) | SÍ | L1 | 12 |
| V9.18 | 9.3.6 | Vectores de flujo en pin esbelto: ¿dominan los radiales? | SÍ | L9 | 12 |
| V9.1 | 9.2.5 | Profundidad de la línea de agua en Ø ⇒ factor de concentración | PARCIAL | L5 | 12 |
| V9.14 | 9.3.3 | Conformal: se juzga por su mapa térmico, no por el trazo | SÍ | L18 | 12 |
| V7.2 | 7.2.1 | Vestigio del sprue contra el plano de apoyo (rim o gate well) | SÍ | L7 | 12 |
| V5.4 | 5.5.5 | L_centerline vs. L_side walls medidos sobre el lay-flat | PARCIAL | L15 | 12 |
| V9.12 | 9.3.1 | Circuito periférico: válido solo si no hay calor en el centro | PARCIAL | L10 | 10 |
| V4.1 | 4.1.1 | Nº de planos de separación y de ejes de movimiento (axial vs. radial) | PARCIAL | L22 | 10 |
| V4.2 | 4.1.1 | Bezel: apertura normal vs. inclinada con componentes extra | PARCIAL | L22 | 10 |
| V7.5 | 7.2.5 | Fan gate: ancho del abanico ≈ ancho de la pieza; frente sale recto | PARCIAL | L7/L14 | 10 |
| V11.15 | 11.3.4 | Stripper: ¿hay área plana de empuje o el contacto es tangente a una curva? | PARCIAL | L21 | 10 |
| V4.6 | 4.1.4 | Shut-off libre **dentro de la región no visible** (el predicado es visibilidad) | SÍ | L21 | 10 |
| V12.16 | 12.2.7 | Flow leaders: mismo rasgo juzgado contra llenado y contra deflexión de núcleo | PARCIAL | L13 | 10 |
| V6.1 | 6.3 | Carrera de apertura en la pose "fully open" vs. daylight (250 vs. 75 mm) | PARCIAL | L4/L6 | 10 |
| V11.12 | 11.3.1 | Ejector blade: longitud real vs. máxima ("this blade design is marginal") | PARCIAL | L8 | 10 |
| V11.11 | 11.2.6 | Esbeltez L/Ø del pin (predictor de pandeo) | PARCIAL | L8 | 10 |
| V4.4 | 4.1.2 | Planaridad de la línea de partición (desviación Z máxima) | PARCIAL | L11 | 10 |
| V10.5 | 10.2.2 | Sesgo steel-safe: cavidad hacia menos contracción, núcleo hacia más | PARCIAL | L16 | 9 |
| V12.7 | 12.2.3 | Descomposición en áreas de flexión: dónde están los apoyos y qué claro toca | PARCIAL | L3 | 9 |
| V7.9 | 7.2.8 | Gate térmico: orificios estrechos vs. bore abierto en la sección | PARCIAL | L7 | 9 |
| V12.14 | 12.2.7 | Desplazamiento del núcleo; ojo: el inserto de agua **parece** sostener y no cuenta | PARCIAL | L5 | 9 |
| V7.6 | 7.2.6 | Espesor del gate (a minimizar) y extensión de la línea testigo | PARCIAL | L7/L21 | 9 |
| V11.2 | 11.2.1-2 | Elección de secciones representativas para el área efectiva A_eff | PARCIAL | L5 | 9 |
| V12.6 | 12.2.2 | Perímetro de corte alrededor de la cavidad | PARCIAL | L2 | 8 |
| V11.14 | 11.3.3 | Stripper: fuerzas de expulsión alineadas con la fricción en todo el perímetro | PARCIAL | L6 | 8 |
| V11.3 | 11.2.3 | Área de empuje por pin (alimenta σ_pin) | PARCIAL | L1 | 8 |
| V11.1 | 11.1 | Secuencia de 4 poses: interferencias a lo largo del recorrido | PARCIAL | L6 | 8 |
| V4.9 | 4.2.3 | Inserto redondo vs. rectangular: riesgo radial / mejilla insuficiente | PARCIAL | L5 | 8 |
| V12.18 | 12.3.2 | Proporciones del tornillo (cabeza = Ø rosca; Ø cabeza ≈ 150 %) | PARCIAL | L5 | 6 |
| V6.4 | 6.5.1 | Sección anular del valve gate (Ø hidráulico equivalente) | PARCIAL | L7 | 6 |
| V4.12 | 4.3.2 | Apilado A/B/S/E/C de alturas del molde base | PARCIAL | L4 | 6 |
| V10.2 | 10.1.5 | Orientación a través del espesor (glifos elípticos por capa) | PARCIAL | L17 | 6 |
| V12.1 | 12.1 | Trayectoria de la carga: cavidad → soporte → platinas → tie bars | NO | L19 | 5 |
| V13.1 | 13.1 | Árbol de selección de tecnología (justifica las decisiones del molde) | NO | — | 5 |
| V1.1 | 1.3-1.4 | Las cinco vistas de nomenclatura (planta+sección con achurado por componente) | NO | L5 | 4 |
| V12.3 | 12.1.1 | Curvas σ-ε y S-N: dan el σ_limit que colorea los mapas | NO | L19 | 4 |
| V10.6 | 10.2.3 | Sensibilidad de la contracción a las condiciones de proceso | NO | — | 4 |
| V10.1 | 10.1.4-5 | Definición geométrica de contracción volumétrica/lineal/anisotrópica | NO | L17 | 4 |
| V13.5 | 13.2-13.10 | Catálogo de secciones de mecanismos avanzados (el CAD debe poder dibujarlas) | NO | L6 | 4 |
| V7.8 | 7.2.7 | Submarine extendido: la trayectoria no debe cruzar superficie visible | PARCIAL | L7 | 4 |
| V12.17 | 12.3.1 | Ajustes de interferencia (0.01 % nominal, FN1) | NO | — | 3 |
| V6.6 | 6.5.3 | Runner shut-off rotativo (mecanismo, sin criterio visual) | NO | — | 2 |
| V11.19 | 11.5 | Retorno de expulsores: positivo vs. resortes (sin criterio visual) | NO | — | 2 |
| V12.19 | 12.3.3 | Dowel de localización, holgura de 1.5 µm | NO | — | 2 |

---

## LAS VISTAS CANÓNICAS

Las 122 verificaciones **no** necesitan 122 imágenes. El libro entero se dibuja con **22 vistas distintas**.
Cada una es una *lámina*: un render con su encuadre, su codificación de color y sus anotaciones fijas, que se
produce siempre igual para poder comparar diseños entre sí (y contra la figura del libro).

Regla de oro que sale del libro: **escala de color FIJA, nunca auto-escalada**. Kazmer juzga contando contornos
(2 °C en Fig 9.11 y 9.18; 0.01 mm en Fig 12.24) y comparando dos mapas lado a lado (Fig 5.20, Fig 9.19, Fig 10.8
vs. 10.9). Si el color se re-normaliza por lámina, esa comparación se rompe.

Segunda regla: **las verificaciones más valiosas nacen de SUPERPONER dos subsistemas** en una sola vista
(expulsores + agua en L1; expulsores + pilares en L3; llenado + expulsores en L14). Ninguna de esas se ve
mirando un subsistema a la vez, y son justo donde el libro atrapa los errores.

### Estado y orden de construcción

| Tier | Láminas | Por qué en este orden |
|---|---|---|
| **HECHA** | L1 | Ya construida (§11.2.5, Fig 11.10 vs 11.11). Cazó dos bugs reales. |
| **A — siguiente** | L14, L10, L20, L17, L13 | Cubren 6 del TOP-10 y son las que más defectos atrapan por lámina. |
| **B** | L2, L12, L16, L18, L21 | Completan el TOP-10 y los mapas sobre la pieza. |
| **C** | L5, L7, L8, L3, L22, L11 | Detalles en sección y plantas secundarias; muchas verificaciones, cada una menor. |
| **D** | L9, L15, L19, L6, L4 | Requieren más motor (campo térmico, FEA, cinemática) o son de bajo rendimiento. |

---

### L1 — Planta del núcleo: expulsores contra puntos de agarre ✅ HECHA
- **Qué es:** vista en planta del inserto de núcleo, con los pines expulsores, las costillas y bosses proyectados,
  el contorno de la cavidad, y **una línea acotada de cada pin al punto de agarre más cercano** (el brazo de palanca).
- **Cubre:** V11.4 · V11.5 · V11.6 · V11.7 (colinealidad) · V11.10 · V11.3 · V12.12 (distancia de barrenos) · V9.13
  (pines dentro del gasket) · V8.3 (¿el cierre de frente tiene pin?).
- **Datos del motor:** contorno del núcleo · posición, Ø y tipo de cada expulsor · geometría proyectada de costillas,
  bosses y paredes laterales · contorno de la cavidad · contorno del gasket si hay fresado · (opcional, para el cruce
  con L10) trazas de las líneas de agua en el núcleo.
- **Codificación:** mapa de color "distancia al agarre" sobre el núcleo · rojo donde la holgura barreno↔cavidad < 1 Ø ·
  etiqueta numérica del brazo por pin.

### L2 — Planta del plano de partición: cavidades, colada y envolvente
- **Qué es:** la planta del molde a la altura de la partición, con las cavidades, el árbol de colada completo, la
  envolvente rectangular de todas las cavidades, y los componentes (leader pins, bujes, interlocks).
- **Cubre:** V4.10 (razón W:L < 2:1) · V4.11 (área usable, ≥ ½ Ø) · V6.2 (longitud sprue→gate por cavidad) ·
  V12.5 (área de soporte real) · V12.11 (distancia interlock↔cavidad) · V12.6.
- **Datos del motor:** contornos de cavidades y su centroide · árbol de colada con longitud y Ø por tramo ·
  posición y Ø de cada componente pasante · sprue.
- **Codificación:** la envolvente dibujada con su razón W:L anotada · cada camino sprue→gate en color distinto con su
  longitud (si son iguales ⇒ balanceo natural) · sombreado del área de soporte efectiva.

### L3 — Planta de la placa de soporte: pilares contra expulsores contra máquina
- **Qué es:** la placa de soporte vista en planta, con los pilares, **los blades y pines expulsores superpuestos**, y
  la posición de la barra expulsora central de la máquina.
- **Cubre:** V12.8 (el trío de Fig 12.14) · V12.7 (descomposición de claros) · V12.5.
- **Datos del motor:** posición y sección de cada pilar · huella de la placa expulsora (blades + pines) · área cargada
  proyectada de las cavidades · patrón de la barra central de la máquina.
- **Codificación:** claro máximo sin apoyo acotado bajo el área cargada · colisiones pilar↔expulsor en rojo.

### L4 — El molde contra la máquina: tie bars, daylight y carrera
- **Qué es:** dos paneles — silueta del molde superpuesta al rectángulo de tie bars, y elevación del molde contra la
  banda [daylight mínimo, daylight máximo] con la carrera de apertura requerida marcada.
- **Cubre:** V4.13 · V4.12 (apilado A/B/S/E/C) · V6.1 (carrera de 3 placas vs. 2 placas).
- **Datos del motor:** silueta y altura total del molde · cotas A/B/S/E/C · especificación de la máquina (espaciado de
  tie bars, daylight mín/máx, tonelaje) · carrera de apertura necesaria para liberar pieza y colada.

### L5 — Sección del molde por el eje del sprue (cerrado)
- **Qué es:** la sección canónica del libro (Fig 1.6): corte por el sprue con **achurado distinto por componente**,
  mostrando insertos, placas, líneas de agua cortadas, colada y expulsores.
- **Cubre:** V1.1 · V4.7 (altura del inserto ≥ 3 Ø) · V4.8 (mejilla) · V4.9 · V9.1 (profundidad en Ø) · V12.10
  (W_cheek = H_cavity) · V12.14 · V12.15 (apoyo del núcleo esbelto) · V13.4 · V11.2 · V12.18.
- **Datos del motor:** sólidos del molde con su rol (placa, inserto, componente) para el achurado · ejes de líneas de
  agua · geometría de colada · cotas automáticas de altura de inserto, mejilla y profundidad de cavidad.

### L6 — Secuencia de apertura y expulsión (3–4 poses de la misma sección)
- **Qué es:** la misma sección de L5 repetida en las poses del ciclo: cerrado → parcialmente abierto → totalmente
  abierto → expulsores actuados.
- **Cubre:** V11.1 · V11.8 (hueco del pin contorneado) · V11.14 · V11.17 · V11.18 · V7.7 (el tunnel gate rompiendo) ·
  V6.1 · V13.5.
- **Datos del motor:** cinemática de placas y actuadores parametrizada por la apertura · posición de cada componente
  en función de esa apertura · detección de interferencia a lo largo del recorrido.
- **Nota:** es la lámina más cara (necesita cinemática) y por eso queda en tier D, pero es la única que valida
  correderas, núcleos móviles y auto-degating.

### L7 — Detalle en sección de la compuerta (+ perfil del canal)
- **Qué es:** zoom en sección sobre el gate, con ángulos y diámetros acotados, más un panel con el perfil transversal
  del runner.
- **Cubre:** V7.2 · V7.3 (reverse taper) · V7.5 · V7.6 · V7.7 (45° / ≥20° / ≥3 Ø) · V7.8 · V7.9 · V7.10 (escalón ≈ 0) ·
  V6.3 (eficiencia del perfil) · V6.4 · V6.5 (intrusión del sucker pin).
- **Datos del motor:** geometría del gate y del runner en el plano de corte · plano de partición · tipo de gate ·
  posición del pin/vástago si aplica.

### L8 — Detalle en sección del venteo y holguras de expulsores
- **Qué es:** zoom en sección sobre el venteo: *land*, escalón de alivio y salida; y el mismo formato aplicado a la
  holgura alrededor de pines y blades.
- **Cubre:** V8.6 · V8.7 · V8.8 (canal **y** taper, ambos) · V8.9 · V11.9 · V11.11 (esbeltez) · V11.12 · V11.13.
- **Datos del motor:** espesor y longitud del land · geometría del alivio · holguras diametrales pin↔barreno ·
  longitud y Ø de cada pin/blade.

### L9 — Sección del inserto de núcleo con su dispositivo de enfriamiento
- **Qué es:** corte del núcleo esbelto mostrando baffle / bubbler / heat pipe / pin conductivo / inserto, con el Ø del
  núcleo y del barreno acotados, y vectores de flujo de calor.
- **Cubre:** V9.17 (Tabla 9.3 de selección) · V9.18 (flujo radial vs. axial) · V9.3 · V12.14.
- **Datos del motor:** Ø y altura del núcleo · Ø del barreno · tipo de dispositivo · campo de flujo de calor
  (para los glifos).

### L10 — Circuito de agua en transparencia (isométrica del molde)
- **Qué es:** el molde en transparencia con **todo el circuito de refrigeración** visible: trazas, conexiones,
  tapones, y el recorrido del refrigerante coloreado.
- **Cubre:** V9.5 (zona viable ≥ ½ Ø) · V9.6 (colisiones) · V9.7 (distancia a la cavidad) · V9.2 (paso/profundidad) ·
  V9.9 · V9.10 · V9.11 · V9.12 · V9.14 · V9.1.
- **Datos del motor:** ejes y Ø de cada línea · conectividad del circuito (qué está en serie y qué en paralelo) ·
  tapones · sólidos de todos los componentes para el test de colisión · distancia línea↔superficie de cavidad.
- **Codificación:** **rojo en cada intersección con un componente** (esa sola señal reproduce Fig 9.9) · mapa sobre la
  superficie de cavidad "qué tan lejos está el agua de aquí" · el circuito coloreado por temperatura acumulada del
  refrigerante (reproduce el argumento de Fig 9.12).

### L11 — Superficie de partición coloreada por ángulo (regla de 5°)
- **Qué es:** la superficie de partición sola, coloreada por el ángulo entre cada parche y la dirección de apertura.
- **Cubre:** V4.5 (≥ 5° en rasgos entrelazados) · V4.4 (planaridad) · V4.6 (dónde puede vivir el shut-off).
- **Datos del motor:** superficie de partición teselada con sus normales · dirección de apertura · clasificación
  visible/oculta heredada de L21.

### L12 — Mapa de draft sobre la pieza
- **Qué es:** la pieza coloreada por ángulo de salida respecto a la dirección de apertura, con el umbral fijado por el
  acabado superficial (Tabla 2.14).
- **Cubre:** V2.6 · V2.7 (las regiones rojas SON los undercuts) · V4.1 · V4.2.
- **Datos del motor:** normales por cara · dirección de apertura · acabado/textura especificada por región (para el
  umbral: 0.5° pulido, +1° por cada 20 µm de rugosidad).
- **Codificación:** verde ≥ requerido · ámbar entre 0 y requerido · **rojo < 0 (undercut)**. Métricas: % de área roja,
  % de área bajo el mínimo, y **conteo de regiones rojas conexas = nº de mecanismos que el molde va a necesitar**.

### L13 — Mapa de espesor de pared sobre la pieza
- **Qué es:** la pieza coloreada por espesor local, con la dirección de flujo desde el gate superpuesta.
- **Cubre:** V2.1 (transición delgado→grueso) · V2.2 (costillas) · V2.3 (bosses) · V2.4 · V2.5 (esquinas) ·
  V7.4 (gate a sección delgada) · V12.16 (flow leaders) · V13.2 (canal de gas).
- **Datos del motor:** espesor local (ray-cast o eje medio) · espesor nominal declarado · posición de los gates ·
  vector de flujo desde el gate · geometría identificada de costillas/bosses/filetes.
- **Codificación:** escala fija centrada en el nominal · flecha de flujo · **marcar en rojo toda transición delgado→
  grueso en la dirección de flujo** y toda costilla con base > 0.70·h, proyectando la mancha de sink esperada.

### L14 — Isócronas del frente de llenado sobre la pieza
- **Qué es:** la pieza en planta con los contornos de tiempo de llegada del frente (el formato exacto de Fig 5.1),
  con "last area to fill" y "end of flow" etiquetados, más los venteos especificados.
- **Cubre:** V5.1 · V5.3 · V5.5 · V5.6 · V8.1 · V8.2 · V8.3 · V8.4 · V8.5 · V7.5 (frente recto del fan gate).
- **Datos del motor:** tiempo de llegada por punto · posición de gates · contorno de la pieza y del plano de partición ·
  clasificación de cada cierre de frente (en borde = venteable / interior = trampa) · posición de los vents y de los
  pines expulsores (para el cruce de V8.3).
- **Codificación:** isócronas a paso constante · **círculo rojo en cada cierre de frente que no toca un borde** ·
  triángulos en los máximos de tiempo sobre el contorno (los vents obligatorios).
- **Es la lámina con mayor rendimiento del documento:** cubre 9 verificaciones, dos de ellas del TOP-10, y es la
  entrada de todo el capítulo 8.

### L15 — Lay-flat con arcos y phantom gates
- **Qué es:** la pieza **desplegada** al plano (paredes cortadas en las esquinas y abatidas) con los arcos de frente
  dibujados desde el gate real y desde los phantom gates, y las longitudes de flujo acotadas.
- **Cubre:** V5.2 (el método completo) · V5.3 (race-tracking) · V5.4 (L_centerline vs. L_side walls) · V5.5.
- **Datos del motor:** desarrollo (unfold) de las paredes · longitud de flujo por camino · espesor por zona ·
  posición del gate.
- **Nota:** es la vista *a mano* de Kazmer. Vale la pena aunque tengamos simulación, porque hace **auditable** el
  resultado: sobre el lay-flat, "el perímetro es más corto que la línea central" se ve de un vistazo.

### L16 — Mapa de contracción sobre la cavidad
- **Qué es:** la cavidad coloreada por tasa de contracción local, con escala fija (0.3 % / 0.6 % / >1 % son los
  niveles que el libro nombra).
- **Cubre:** V10.3 · V10.4 · V10.7 (comparación contra el mapa de 4 compuertas) · V10.5 (sesgo steel-safe) ·
  V10.9 (aporta s_center y s_edge).
- **Datos del motor:** contracción local · presión y temperatura al final del empaque · topología de la pieza
  (conectividad / agujeros).
- **Codificación:** escala fija · métricas impresas en la lámina: **rango (max−min), desviación estándar y % de área
  > 1 %**. El libro nunca da un umbral único: juzga por **uniformidad**.

### L17 — La pieza alabeada (deformación exagerada) con su causa al lado
- **Qué es:** dos paneles — la pieza deformada con la deflexión exagerada y su radio de curvatura acotado, y junto a
  ella el campo que la causa (ΔT core↔cavity para el modo "a través del espesor", o s_center vs. s_edge para el modo
  "a través del área").
- **Cubre:** V10.8 (curvatura simple) · V10.9 (pandeo + criterio de topología) · V10.1 · V10.2.
- **Datos del motor:** ΔT core↔cavity por punto · s_core, s_cavity, s_center, s_edge · espesor h · semi-ancho W ·
  **conectividad de la pieza** (¿área cerrada continua, o una ventana la desacopla?).
- **Codificación:** factor de exageración impreso en la lámina (nunca implícito) · δ máximo anotado · para el modo de
  área, imprimir la evaluación de la desigualdad `(s_edge − s_center) > 0.44·(h/W)²` con sus dos números, como hace el
  libro ("0.0135 > 0.0011").
- **Es la lámina que cierra el argumento del cap. 9:** 2 °C de diferencia core↔cavity ⇒ 1.6 mm de alabeo. Sin esta
  lámina, el gradiente térmico de L18 es un número sin consecuencia.

### L18 — Mapa térmico en sección, isotermas a 2 °C
- **Qué es:** la sección del molde y la pieza con contornos de temperatura **a paso fijo de 2 °C**, al final del ciclo
  (el formato literal de Fig 9.11, 9.18 y 9.19).
- **Cubre:** V9.8 · V9.4 · V9.15 · V9.16 · V9.3 (glifos de flujo) · V9.14 · V13.3 (ΔT superficial > 50 °C).
- **Datos del motor:** campo de temperatura en pieza y molde al final del ciclo · vectores de flujo de calor en la
  superficie de cavidad.
- **Codificación:** **contornos a 2 °C exactos, no auto-escalados** — el juicio de Kazmer es literalmente *contar
  contornos*. Métricas impresas: ΔT base→punta del núcleo, y **ΔT core↔cavity en la misma pared** (que alimenta L17).

### L19 — Mapa de von Mises en sección
- **Qué es:** la sección del molde coloreada por esfuerzo equivalente bajo la presión de fundido, con escala fija
  anclada al σ_limit del material.
- **Cubre:** V12.2 (asimetría lado fijo↔móvil) · V12.12 (concentración alrededor de barrenos) · V12.1 · V12.3.
- **Datos del motor:** campo de esfuerzo · presión de fundido aplicada · σ_limit por material (P20 ≈ 456 MPa de
  resistencia a fatiga; el aluminio **no tiene** límite de fatiga) · posición y Ø de todos los barrenos.

### L20 — Mapa de deflexión y apertura del plano de partición
- **Qué es:** la deformación del molde bajo presión, con **isolíneas de desplazamiento a 0.01 mm** (formato de Fig
  12.24) y la separación medida a lo largo del contorno del plano de partición, contrastada contra el espesor de venteo.
- **Cubre:** V12.4 (0.36 mm vs. 0.02 mm ⇒ flash) · V12.9 (meta < 0.1 mm) · V12.13 (barreno cercano a la cavidad) ·
  V11.8 (hueco del pin contorneado) · V8.7 (rebaba en el vent perimetral).
- **Datos del motor:** campo de desplazamiento · contorno del plano de partición parametrizado · espesor de venteo
  especificado en cada zona.
- **Codificación:** isolíneas a 0.01 mm · **rojo donde apertura > espesor de venteo local** (ese es el veredicto de
  flash, y es un umbral absoluto, no relativo) · deformación exagerada con su factor impreso.

### L21 — La pieza como la ve el usuario final
- **Qué es:** la pieza renderizada desde los puntos de vista de uso, con las superficies clasificadas visible/oculta,
  y **todas las marcas del proceso proyectadas encima**: línea de partición, vestigio de compuerta, sink proyectado,
  línea testigo del stripper, marcas de expulsor.
- **Cubre:** V4.3 (partición sobre superficie visible) · V4.6 (shut-off libre en zona oculta) · V7.1 (gate en
  superficie no visible) · V7.2 (vestigio) · V7.6 (línea testigo) · V11.7 (sink del ejector pad) · V11.15 (testigo del
  stripper) · V2.2 (sink de costilla).
- **Datos del motor:** puntos de vista de uso declarados en la pieza · clasificación visible/oculta por cara ·
  ubicación de partición, gates, pads, pines y contacto del stripper · proyección de sink desde costillas y pads.
- **Nota:** esta lámina convierte un montón de criterios estéticos difusos en **un solo predicado computable**:
  *¿la marca cae en superficie visible?* El libro usa exactamente ese predicado en cuatro capítulos distintos.

### L22 — Isométrica de undercuts y direcciones de apertura
- **Qué es:** la pieza con las regiones de draft negativo resaltadas y agrupadas, y una flecha por cada dirección de
  apertura necesaria (principal + laterales).
- **Cubre:** V2.7 · V4.1 · V4.2 · V4.4 · V11.16 (ε < 2 % ⇒ expulsión elástica, sin corredera) · V11.17 · V11.18.
- **Datos del motor:** regiones de draft negativo y su conectividad · profundidad de cada undercut y perímetro que
  debe estirarse (para ε) · direcciones de apertura candidatas.
- **Codificación:** una etiqueta por región: *elástico (ε=x %)* o *requiere mecanismo*. El conteo de las segundas es
  el driver de costo del molde.

---

## Apéndice — erratas y números raros detectados en el texto fuente

Se reportan tal como aparecen, **sin corregir el texto**, para que se verifiquen contra el PDF original antes de
codificar cualquier regla que dependa de ellos.

1. **§10.3.1, cálculo de alabeo (Fig 10.14).** La ecuación da `R_warpage = 2·1.5 mm / (0.34 % − 0.31 %) = 9050 mm`,
   pero la línea siguiente evalúa `δ = 120 mm · sin(120 mm / 1050 mm) = 1.6 mm`. Los dos radios no coinciden.
   **El resultado publicado (1.6 mm) es el consistente con R = 9050 mm** evaluando el seno en radianes
   (120·sin(120/9050) = 1.59 mm); con 1050 mm daría ≈ 13.7 mm. Conclusión: **"1050 mm" es la errata**, y la fórmula
   y el resultado son correctos. Codificar Ec. 10.17 tal cual.
2. **Fig 10.10** aparece con el caption *"PvT behavior for an acetal"* (el mismo tema que Fig 10.2/10.13), pero su
   contenido descrito en el texto es el diseño **steel-safe** de cavidad y núcleo (s = 0.4 % / 0.5 % / 0.6 %).
   Caption cruzado en la extracción.
3. **Fig 12.3** rotula en el gráfico *"Yield = 420 MPa"* para el QC7, mientras el texto de §12.1.1 usa
   *"yield stress of 545 MPa"* para el mismo material. Inconsistencia entre figura y prosa.
4. **Resistencia a fatiga del P20:** el texto dice *"approximately 450 MPa"*, el gráfico de Fig 12.5 rotula
   *"Endurance = 456 MPa"*, y §9.2.5 usa 456 MPa en el cálculo. Usar **456 MPa**.
5. **Captions duplicados** (dos figuras distintas con el mismo pie en el texto extraído): Fig 3.2 y 3.3
   (*"Cost drivers for a commodity and specialty part"*) · Fig 4.11 y 4.12 (*"Shut-off surface for bezel"*) ·
   Fig 8.9 y 8.10 (*"Vent design in core insert"*) · Fig 9.24 y 9.25 (*"Conductive pin"*, aunque 9.25 pertenece a
   §9.3.5.6 "Interlocking Core with Air Channel") · Fig 10.8 y 10.9 (*"Shrinkage rate for bezel molded of an ABS"*,
   que son 2 y 4 compuertas respectivamente) · Fig 13.10 y 13.11 (*"Two layer injection blow molding"*, siendo blow
   molding de dos capas y sobremoldeo de key caps).
   En los casos de 4.11/4.12, 8.9/8.10 y 10.8/10.9 el par duplicado **sí es un par significativo** y hay que
   distinguirlo por contenido, no por caption.
6. **Tabla 8.1 (espesores de venteo recomendados)** da valores que difieren hasta **un orden de magnitud** entre
   fuentes para el mismo material (media viscosidad: Glanvill 0.2 · Rosato 0.3 · Menges 0.03 mm). No es errata: es
   dispersión real de la literatura. Cualquier umbral de venteo que codifiquemos tiene que declarar **de qué fuente
   sale**; el propio libro usa 0.02 mm como valor de trabajo en §8.2.3 y en §12.1.2.

---

*Documento generado a partir del texto completo de los capítulos 1–13. Todas las citas entre comillas fueron
verificadas literalmente contra la fuente con `grep`. Donde el libro no da criterio verbal, se dice explícitamente.*
