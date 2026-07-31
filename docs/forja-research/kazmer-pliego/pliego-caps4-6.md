# RESPALDO — Experimento 'Kazmer es el cliente' (2026-07-31)

He leído el archivo completo (3,998 líneas: cap. 4 completo, cap. 5 completo, cap. 6 completo, y las primeras líneas del cap. 7). Reporte de analista abajo.

---

# ANÁLISIS DE REQUISITOS — Kazmer caps. 4, 5, 6

Nota de alcance: el archivo termina en la primera página del cap. 7 (Gating). Por eso **no hay** en este corpus: reglas de venteo del runner, dimensionado de gates, ni tipos de gate. Lo único sobre venteo que aparece es §5.2.3 (predecir la última zona para poner vents) y §5.5.4 (gas trap en pared lateral = quemadura). Esas reglas viven en caps. 7 y 8 — hay que traerlas aparte.

---

# CAPÍTULO 4 — MOLD LAYOUT DESIGN

## 1. EL PROCESO A MANO (secuencia de decisiones)

El cap. 4 es una **cadena estrictamente ordenada**, y el orden importa porque cada paso consume grados de libertad del siguiente:

1. **§4.1.1 Determinar la dirección de apertura** (relativa a la pieza, no al molde: "the mold usually opens in a direction normal to the parting plane" — la incógnita es la orientación de la CAVIDAD).
2. **§4.1.2 Determinar la línea de partición** (dónde se tocan cavidad + corazón + plástico).
3. **§4.1.3 Proyectar el plano de partición** hacia afuera desde la pieza.
4. **§4.1.4 Definir un shut-off por cada ventana/abertura.**
5. **§4.2 Dimensionar insertos** — altura (§4.2.1), largo/ancho (§4.2.2), ajustes (§4.2.3).
6. **§4.3.1 Layout de cavidades** → **§4.3.2 dimensionar la base** → **§4.3.3 verificar la máquina** → **§4.3.4 elegir proveedor**.
7. **§4.4 Seleccionar materiales** (base + insertos, por separado).

### §4.1.1 — Cómo elige la dirección de apertura
Dos factores que gobiernan, en este orden:
- *"the mold cavity should be positioned such that it does not exert undue stress on the injection mold. The mold cavity is typically placed with its largest area parallel to the parting plane"* → el área mayor de la pieza va **paralela** al plano de partición, para que las placas (ya en compresión por el tonelaje) resistan la presión del plástico.
- *"the mold cavity should be positioned such that the molded part can be ejected"* → pieza típica = caja abierta de cinco lados con paredes, costillas y bosses **normales** a su área mayor; la expulsión vuelve a apuntar a apertura normal al área proyectada mayor.

**Formas de partición que reconoce (el catálogo de opciones):**
- **Apertura axial simple** (dos mitades, 2 líneas): *"the simplest design and is usually preferred"*.
- **Split cavity mold** (§13.9.1): la cavidad se parte en 3 piezas que se mueven en 2 ejes. Se usa *"since it allows for a more complex part design as well as more options in locating the parting line"* — ejemplos literales: si a la taza le agregas un **asa**, o si necesitas **mover la línea de partición lejos del labio**.
- **Apertura oblicua/inclinada** (bezel, Fig. 4.5): *"the mold opening direction is inclined in order to allow the mold surfaces to separate from the molded part without excessive surface friction or shearing of features"*. Costo: *"add significantly to the cost of mold design, manufacture, and operation."*

### §4.1.2 — Cómo elige la línea de partición
La física del defecto primero: deflexión de la cavidad respecto al corazón → hueco → **flash**; imperfecciones por **desgaste o mal manejo** → también hueco; y aun con molde nuevo y bien hecho, *"the location of the parting line usually results in a very slight witness line along its length."*

Regla resultante y ejemplos concretos:
- Taza: partición cerca del labio → witness line + posible rebaba que *"might make the molded cup unusable"*. Correcta: **al fondo del reborde (bottom of the rim)**.
- Bezel: la línea **no está en un solo plano** — sigue el perfil de las features de las paredes laterales, porque el corazón tiene que formar los agujeros de conectores. Consecuencia declarada: *"this complex parting line shape will cause a more complex parting plane."*

### §4.1.3 — Del parting line al parting plane
Se **proyecta hacia afuera** desde la pieza. Los dos problemas de operación que introduce una partición no plana:
1. Cualquier desalineación entre features filosos causa desgaste entre superficies deslizantes *"if not an outright impact between the leading edge of the core and the mating cavity surface."*
2. El tonelaje puede **trabar** las superficies con fuerza extrema → esfuerzo excesivo y deformación del molde en operación.

Método de construcción CAD que prescribe: superficies **lofted**, cada una mezclando una feature curva de la línea de partición con una línea de ancho correspondiente en el plano; *"The result is a surface with the needed profile at the parting line and the necessary draft down to the parting plane"*; luego **knit** con el plano.

### §4.1.4 — Shut-offs
*"A shut-off will need to be defined for each window or opening in the molded part."* Sin ventanas (la taza) → cero shut-offs. Cada shut-off tiene su propia línea de partición.

### §4.2 — Dimensionado de insertos
Largo y ancho deben ser suficientes para las 4 cosas, en la lista literal: (a) encerrar la cavidad, (b) resistir las fuerzas de la presión del melt sobre el área de la cavidad, (c) **contener las líneas de enfriamiento**, (d) contener otros componentes (tornillos de retención, pines expulsores, otros).
Tensión declarada: *"All of these requirements suggest making the core and cavity inserts as large as possible"* vs. el costo, que *"can become excessive with increases in the number of cavities or molded part size"*. Para piezas chicas, agrandar cuesta poco.

### §4.3.3 — Selección de máquina (la lista de verificación)
1. ¿Cabe entre las barras de amarre? — *"Perhaps the most common limitation is that the mold will not fit between the tie bars"* (HM320: 800 mm horizontal × 630 mm vertical).
2. ¿Daylight? — altura del molde > A_min y < B_max (350–800 mm). Menor al mínimo: *"the molding machine platen can not fully close the mold and build clamp tonnage"*. Mayor al máximo: no cabe entre platinas abiertas.
3. ¿Volumen de disparo? — suficiente volumen **y** presión; y no demasiado, *"if the injection unit has too large a shot size, then the melt may degrade in the barrel."*
4. ¿Tonelaje? — insuficiente → *"the mold will open during operation and the melt will flow across the parting plane and shut-offs"*. Excesivo sobre molde subdimensionado → *"the mold may be damaged by the imposed compressive stresses."*

---

## 2. REGLAS PRESCRIPTIVAS EN PROSA — CAP. 4

### Partición y apertura
| § | Frase (EN) | Qué exige |
|---|---|---|
| 4.1 | *"The mold designer **must first** determine the mold opening direction to design the parting plane"* | Gate de orden: dirección de apertura ANTES del plano. |
| 4.1.1 | *"guide bushings and/or mold interlocks are **almost always** located on the parting plane"* | Bujes guía e interlocks van EN el plano de partición. |
| 4.1.1 | *"The mold cavity is **typically** placed with its largest area parallel to the parting plane"* | Orientación por defecto de la cavidad. |
| 4.1.1 | *"the axial mold opening direction ... is the simplest design and is **usually preferred**"* | Default = apertura simple; split cavity solo si hay razón. |
| 4.1.2 | ⭐ *"the parting line **should** be located along a bottom edge of the part, **or some other non-visual, non-functional edge**"* | Regla estética/funcional de colocación: borde inferior o cualquier arista no visible y no funcional. |
| 4.1.3 | ⭐ *"To avoid excessive stress, interlocking features on the parting plane **should be inclined at least five degrees** relative to the mold opening direction"* | ≥5° en TODA feature de interlock del plano de partición. |
| 4.1.4 | *"Each shut-off is defined by a parting line, which **should** be located in a non-visual area where a witness line or slight flashing **would not reduce the value** of the molded part"* | Misma regla estética, aplicada a cada shut-off. |

### Insertos
| § | Frase (EN) | Qué exige |
|---|---|---|
| 4.2.1 | *"the core and cavity insert **should** have enough height above and below the molded part to safely pass a cooling line"* | La altura la manda el enfriamiento, no la pieza. |
| 4.2.1 | *"Cooling line diameters **typically** range from 4.76 mm (3/16″) for smaller molds to 15.88 mm (5/8″) for large molds"* | Rango de catálogo de líneas de enfriamiento. |
| 4.2.1 | *"the minimum height dimension between the molded part and the top or bottom surface of the insert is **typically three times the diameter of the cooling line**"* | Regla de dedo 3·D (referida a cap. 12 por esfuerzo). |
| 4.2.1 | *"These plates are commonly available in **½″ increments** in English units, and in **10 mm increments** in metric"* | Redondeo a catálogo de placas A/B. |
| 4.2.1 | ⭐ *"the insert heights **should be adjusted up** such that the faces of the cavity and core inserts are **flush or slightly proud** with respect to the A and B plates"* | Se redondea HACIA ARRIBA y la cara queda a ras o ligeramente sobresaliente — nunca hundida. |
| 4.2.1 | ⭐ *"the height of the core insert ... is **not its total height** but rather the height ... from the rear surface to the parting plane. For materials procurement and cost estimation, the total height **should also include** the height of the core above the parting plane"* | Dos cotas distintas con el mismo nombre: la de diseño y la de COMPRA. |
| 4.2.2 | *"length and width allowances of **three cooling line diameters per side** are typical"* | Holgura lateral 3·D por lado. |
| 4.2.2 | *"a **safe guideline** is that the thickness of the side wall in the length and width dimension **should equal the depth of the mold cavity**"* | Cheek = profundidad de la cavidad (domina en piezas profundas). |
| 4.2.3 | *"the length and width dimensions of the inserts are **more critical** than the height dimension"* | Prioridad de refinamiento: L y W antes que H (manejan el tamaño de la base y el costo). |
| 4.2.3 | *"There is **no fundamental requirement** on the external shape ... The design of the insert **should be dictated by** the shape of the molded part, the efficiency of the mold design, and the ease of manufacture"* | Forma libre; pieza redonda → inserto redondo torneable en torno. |

### Layout y base
| § | Frase (EN) | Qué exige |
|---|---|---|
| 4.3 | *"It is **critical** to order a mold base with appropriately sized plates and materials, since any mistakes ... can consume significant time and expense"* | La base es una decisión irreversible/cara. |
| 4.3.1 | *"If a single cavity mold ... the cavity is **typically located in the center**, though gating requirements **may necessitate** placing the mold cavity off center"* | Centrada por default; el gating puede descentrarla. |
| 4.3.1 | *"the **width to length ratio** of the bounding envelope around all cavities **should be kept less than 2:1**"* | Invariante duro del envelope de cavidades. |
| 4.3.1 | *"Placing all the cavities along a line ... is a **simple but poor design**"* + *"requires an unbalanced feed system"* | Layout en serie = penalizado por default. |
| 4.3.1 | *"most common for applications requiring high production volumes when the number of cavities is a **multiple of 2, i.e., 4, 8, 16, 32**"* | Grid ↔ potencias de 2 ↔ balanceo natural. |
| 4.3.1 | *"a circular layout is **sometimes used** when the molded parts are relatively small **or when the number of mold cavities is relatively low, for example 8 or less**"* | Umbral del layout circular; desventaja: más área de molde. |
| 4.3.2 | ⭐ *"A dimensional allowance equal to **at least one-half of each component's diameters** is provided between the mold cavity and the surrounding components"* | Holgura mínima cavidad↔cada componente vecino = ½ del diámetro de ESE componente. |
| 4.3.2 | *"Due to these conflicts, mold bases are **often sized larger** than what would first be considered"* | Anticipar conflictos con leader pins, guide bushings, return pins, SHCS, cooling, ejectores, pilares. |
| 4.3.2 | *"Standard mold bases are widely available from **200 mm up to 1000 mm** on a side"* | Rango de catálogo. |
| 4.3.2 | *"the ejector travel is **often** set to be equal to the **depth of the molded part**"* | Regla de dedo para E. |
| 4.3.2 | *"the height of the support plate, S, is **normally determined from the mold base supplier**"*; *"the height of the ejector housing, C, is **assigned by** the mold base supplier"* | S y C NO los calcula el diseñador: los da el proveedor a partir de A, B y E. |
| 4.3.2 | *"This dimension [sprue orifice] is of **lesser importance** since the sprue bushing may be replaced or machined, or the machine nozzle changed"* | El orificio del sprue no bloquea la orden de la base. |
| 4.3.3 | ⭐ *"the maximum mold width, **including cooling plugs, hot runner connectors, etc.**, is 800 mm (**less some relatively small clearance** ... to provide for mold insertion)"* | El ancho que se compara contra las tie bars incluye lo que SOBRESALE, más holgura de inserción. |
| 4.3.3 | *"this machine is **ideally suited** for molds requiring a shot volume **between 120 cc and 250 cc**"* (de un máximo de 490 cc) | Ventana de disparo ~25–50% del máximo, no "cabe / no cabe". |

### Proveedores y materiales
| § | Frase (EN) | Qué exige |
|---|---|---|
| 4.3.4 | *"Standard 'quick ship' mold components should be **in the supplier's inventory**. Customized mold bases ... shipped **within one week**. Orders placed **before noon** should be shipped the **same day** and no later than the next day"* | SLA de proveedor, verificable. |
| 4.3.4 | *"**All mold plates should be supplied finish ground, heat treated, and ready for machining** at the mold maker"* | Criterio de calidad de recepción. |
| 4.3.4 | *"the mold base drawings should reflect a compatible system of units through the use of **round numbers, fractions**"* | El sistema de unidades NATIVO importa (números redondos). |
| 4.4.1 | *"neither of these properties [ultimate, yield] **should be utilized**. Instead, the **fatigue limit stress** (endurance limit)"* | En moldes se dimensiona por límite de fatiga, no por fluencia. |
| 4.4.1 | *"the **thermal diffusivity** ... is a **better measure**"* que k | Usar α = k/(ρ·Cp). |
| 4.4.2 | *"very hard materials such as D2, A6, and H13 **should only be used when required** for molding abrasive plastics"* | Dureza solo bajo demanda (mata el machining rate). |
| 4.4.2 | *"aluminum alloys ... **should be used carefully** when molding at **moderate melt pressures (100 MPa or greater)** or when molding **even slightly abrasive plastics (such as carbon filled)**"* | Umbral numérico para descartar aluminio. |
| 4.4.3 | *"the aluminum alloys **should be seriously considered** when a molding application does not require high strength or hardness"* | Contra el sesgo de "todo P20". |
| 4.4.4 | ⭐ *"**all the recommendations pertain specifically to materials for the core and cavity inserts**. Standard mold bases are not available in all these materials; mold bases are typically available in **1045, 4140, or P20**"* | Dos catálogos de material distintos: insertos ≠ base. |
| 4.4.4 | *"Plain 1045 ... **often chosen** for lower production volumes and moderate pressures. For higher production volumes and pressures, 4140 and P20 are **usually preferred**"* | Default por volumen. |

**Matriz Tabla 4.1** (insertos, ciclos × melt): no-abrasivo/baja presión → Al | Al o Cu | Cu, P20, SS420. Ligeramente abrasivo o presión moderada → Al/Cu/1045 | Cu, P20, 4140, S7 | SS420, S7, D2, A6. Altamente abrasivo → P20, S7 | D2, A6, H13 | H13. Alta presión → 1045, 4140, P20 | P20, S7 | D2, A6. Corrosivo → P20, SS420 | SS420 | SS420. (Umbrales: <10,000 / — / >1,000,000 ciclos.)

---

## 3. ITERACIONES — CAP. 4

| Disparador | Qué se cambia | § |
|---|---|---|
| La partición ideal cae en zona visible/funcional | Cambiar la **dirección de apertura** a split cavity (radial/oblicua) para poder mover la línea | 4.1.1 |
| Feature fuera de plano en la línea de partición | Rehacer el plano con superficies lofted + draft; inclinar interlocks ≥5° | 4.1.3 |
| Aspect ratio del envelope > 2:1 | Cambiar el **layout** (línea → grid o circular/híbrido) | 4.3.1 |
| Conflicto cavidad ↔ leader pins / return pins / SHCS / cooling / pilares | **Crecer la base** (o reacomodar el layout) | 4.3.2 |
| La cheek no deja pasar el enfriamiento periférico ni otros componentes | Crecer L y W del inserto (caso bezel: se diseñó "quite aggressively" y se advierte el riesgo) | 4.2.3 |
| Insertos demasiado grandes → base cara | Reducir L y W **apoyándose en el análisis de enfriamiento y estructural posteriores** (caps. 9 y 12) | 4.2.3 |
| Altura del inserto no coincide con placas de catálogo | Subir la altura al siguiente ½″ / 10 mm | 4.2.1 |
| El molde no cabe entre tie bars / fuera de daylight / tonelaje insuficiente o excesivo | Cambiar la base **o** el número/layout de cavidades **o** la máquina | 4.3.3 |
| Shot volume fuera de la ventana 25–50% | Cambiar de máquina (o de cavitación) | 4.3.3 |

---

## 4. JUICIOS HUMANOS — CAP. 4

- **Split cavity sí/no** (§4.1.1): "más complejo pero permite mejor pieza y mejor línea de partición" vs. costo significativo de diseño, manufactura y operación. No hay número.
- **Dónde exactamente en la zona oculta** (§4.1.4): *"Either location (or even any location in between) would likely be acceptable since the entire shelf is hidden from view."* El criterio es "¿se ve?", no una cota.
- **Forma externa del inserto** (§4.2.3): redondo (torneable) vs cuadrado vs rectangular con o sin filetes — por "shape of the molded part, efficiency, ease of manufacture".
- **Usar o no base estándar** (§4.3.4): *"many mold makers do not use mold bases"* — piezas gigantes sin estándar; **creencia** de que las estándar son de calidad inferior; talleres que hacen el molde completo por menos de lo que cuesta la base.
- **Sole source vs varios proveedores calificados** (§4.3.4), y el peso de la **experiencia previa**: *"there may be risk or a significant learning curve associated with switching suppliers."*
- **Romper la inercia del P20** (§4.4, §4.4.4): *"P20 is sometimes improperly specified"*; *"While one material such as P20 may have always worked well for a given mold designer, there is the possibility that significant improvements ... could be realized by utilizing other mold materials."*
- **Comprar en paralelo al análisis** (§4.5): *"In many mold making companies, these materials are immediately ordered concurrent with the detailed analysis and design of the mold subsystems."* Apuesta de tiempo contra riesgo de re-orden.

## 5. CRITERIOS DE ACEPTACIÓN — CAP. 4 (antes de congelar el layout)
1. Un shut-off definido por cada ventana/abertura.
2. Toda feature de interlock del plano ≥5° respecto a la apertura.
3. Toda línea de partición (y de shut-off) en zona no visual / no funcional.
4. Altura del inserto ≥ 3·D_cooling arriba y abajo de la pieza.
5. Cheek ≥ profundidad de la cavidad, y ≥ 3·D_cooling por lado si hay línea perimetral.
6. Alturas de inserto redondeadas hacia arriba al incremento de placa; caras flush o proud.
7. Envelope de cavidades con relación ancho:largo < 2:1.
8. Holgura ≥ ½·D de cada componente vecino en el plano de partición.
9. La base cabe entre tie bars **incluyendo conectores/plugs** y dentro del daylight [A_min, B_max].
10. Shot requerido dentro de la ventana cómoda de la máquina; tonelaje disponible ≥ requerido y no groseramente excesivo.
11. Materiales: uno para insertos (Tabla 4.1), otro compatible con lo disponible en bases (1045/4140/P20).

---

# CAPÍTULO 5 — CAVITY FILLING ANALYSIS

## 1. EL PROCESO A MANO — qué chequea y en qué orden

Orden literal del capítulo (§5.5.1 → §5.5.5), que es el orden operativo:

1. **§5.5.1 Estimar condiciones de proceso**: temperatura de melt = **mid-range del proveedor**; luego **iterar** velocidad ← shear rate ← viscosidad hasta converger (Ec. 5.23).
2. **§5.5.2 Estimar presión de llenado**: elegir gate(s) para **balancear** el flujo → hacer el **lay flat** (enderezar vueltas, desdoblar bordes) → partir en segmentos (por cambio de ancho y **obligatoriamente** por cambio de espesor) → aplicar Newtoniano o power law → comparar contra el techo (100 MPa).
3. **Derivar el espesor mínimo de pared**: intersección de la curva P(h) con la línea de presión máxima.
4. **§5.5.3 Estimar tonelaje**: al final del llenado Y al inicio del packing; usar **área proyectada**; piso de 50 MPa.
5. **§5.5.4 Predecir el patrón de llenado** (arcos + phantom gates): detectar race-tracking, weld lines, gas traps, última zona en llenar.
6. **§5.5.5 Corregir**: mover el gate → cambiar tipo de molde (3-placas/hot runner para gatear al centro) → y solo si el layout lo impide, **flow leaders** (variar espesor).

Los tres objetivos declarados que se chequean (§5.2): (a) llenado completo a presión razonable; (b) evitar llenado disparejo / sobre-empaque; (c) controlar el flujo (colocar knit-lines, prever venteo, orientar fibra).

## 2. REGLAS PRESCRIPTIVAS EN PROSA — CAP. 5

| § | Frase (EN) | Qué exige |
|---|---|---|
| 5.1 | *"**Typically**, the melt pressure required to fill the cavity is **less than 100 MPa** (about 15,000 psi) even though most modern machines can supply **twice** this amount"* | Techo de diseño 100 MPa con margen 2× para feed system + varianzas. |
| 5.1 | ⭐ *"filling pressures are **not too low**, since very low melt pressures are indicative of a **poor molded part design** ... excessively thick wall sections will result in low pressures, excessive material costs, and extended cycle times. In such cases, the nominal wall thickness **should be decreased and ribs utilized**"* | Regla de DOS colas: ΔP bajo también reprueba. Remedio: adelgazar + costillas. |
| 5.2.1 | *"Modern molding machines can typically deliver ... approximately **200 MPa (30,000 psi)**. However, a **lower melt pressure should be assumed**"* (por tonelaje, ΔP del feed, y factor de seguridad) | Nunca diseñar contra la capacidad nominal de la máquina. |
| 5.2.1 | *"Since it is **easier to adjust** the molding process for a mold with too low melt pressures than ... too high pressures, mold designers **should assume a conservative** cavity filling pressure"* | La asimetría que justifica el conservadurismo. |
| 5.2.1 | *"In the event that a mold is very difficult to fill, molders will generally try to compensate by **increasing the mold and melt temperatures, enlarging the runner diameters, trying lower viscosity plastics, and finally changing the wall thickness**"* | **Escalera de remedios del moldeador**, en ese orden (el espesor al último = lo más caro). |
| 5.2.1 | *"if a mold is very easy to fill, molders will generally **reduce the mold and melt temperatures while increasing the injection velocity** to shorten the cycle"* | Lo que el moldeador hará con tu margen. |
| 5.2.2 | *"the mold **should** be designed such that the polymer melt reaches the edges ... furthest from the gate at **approximately the same time**"* | Criterio de llenado par. |
| 5.2.2 | *"using **slight changes in the wall thicknesses** to purposefully direct the flow"* | El espesor es una palanca de dirección de flujo, no solo estructural. |
| 5.2.3 | *"predict the **last area to fill** so that **vents and/or ejector pins** are provided for the displaced gas to exit"* | El resultado del análisis alimenta el venteo y la ubicación de expulsores. |
| 5.3.5 | *"the power law model can **purposefully fit to a smaller shear rate regime of interest**"* | El ajuste del modelo se hace a la ventana de shear rate de ESTA pieza. |
| 5.4 | *"**all the models always over predicted** the filling pressures ... the analyses are **conservative** ... Unfortunately, the analysis will drive part designs that are **somewhat thicker** than may actually be possible"* | Sesgo conocido y aceptado del método. |
| 5.5.1 | *"It is **recommended** that mold designers assume a melt temperature **in the middle of the range** recommended by the material supplier since this provides the molder with **freedom to adjust up or down**"* | Regla del mid-range: se diseña dejándole al moldeador margen en las dos direcciones. |
| 5.5.1 | *"**Typical linear velocities** of the melt through the mold range from **0.01 to 1 m/s**"* | Sanity check de velocidad. |
| 5.5.2 | *"the mold designer **should select the gating location(s) to balance the flow** between the different portions of the mold"* | Criterio primario de gateado en el análisis 1D. |
| 5.5.2 | *"features such as ribs and bosses **are neglected**. These features are **very likely to fill** if they are relatively small compared to the main flow channel"* | Simplificación autorizada, con su condición. |
| 5.5.2 | *"**Sections of varying thickness should also be broken out** into different flow segments"* | Segmentación obligatoria por espesor (por ancho es opcional). |
| 5.5.3 | *"The **projected area** of the cavity is used rather than the total area since the melt pressure acting on inclined (or vertical) side walls contribute little (or no) force"* | Tonelaje sobre área proyectada. |
| 5.5.3 | *"**It can be difficult to discern** ... whether the maximum clamp tonnage will be driven by the pressures during filling or packing"* | Calcular ambos y quedarse con el mayor. |
| 5.5.3 | *"**Typically, the packing pressure is between 50 to 90%** of the filling pressure"* | Rango del packing. |
| 5.5.3 | ⭐ *"molders will **generally use packing pressures in the vicinity of 50 MPa**. As such, the mold designer **should verify** the expected cavity pressures **with the molder** or **assume a minimum cavity pressure of 50 MPa**"* | Piso duro de 50 MPa para tonelaje aunque el análisis dé menos — y una llamada al moldeador. |
| 5.5.4 | *"race-tracking ... can occur when the **length of flow around the perimeter is less than the length of flow across the center-line**"* | Criterio geométrico de race-tracking (en el ejemplo: profundidad 60 > mitad del ancho 100). |
| 5.5.4 | *"a **gas trap on a side wall** ... is **especially problematic since it is difficult to vent**. As such, the trapped air will likely **combust**, causing a **burn mark**"* | Gas trap en pared lateral = defecto grave, no cosmético. |
| 5.5.5 | *"thickness variations in molded parts are **generally undesirable** ... the cavity thickness variation **should be kept to a minimal amount**"* | Los flow leaders son el ÚLTIMO recurso, y mínimos. |
| 5.6 | *"It is **recommended** that filling analyses utilize **mid-range melt temperatures** ... and the **dependence of the viscosity on shear rate be verified** when using the Newtonian model"* | Dos verificaciones de cierre del capítulo. |

**Números que amarran:** máquina moderna ~200 MPa; techo de cavidad 100 MPa; packing 50–90% del llenado; piso de packing ~50 MPa; velocidad lineal 0.01–1 m/s (ABS: 0.4 m/s @3 mm/218 °C hasta 1.6 m/s @0.8 mm/260 °C); Newtoniano exacto solo a ~7,000 1/s para ese PC; Cross-WLF ajustado con reómetro capilar entre 10 y 10,000 1/s; Re < 2300 (real ~0.1).

**Corrección de implementación (Ec. 5.33/5.34):** el OCR deja ambiguo el radical. Derivando de Ec. 5.17 con v_side = v_center·(L_side/L_center), la relación correcta es
`H_side = H · (L_side/L_center) · sqrt(mu_side/mu_center)`
— la razón de **longitudes va sin raíz** y solo la de viscosidades va bajo raíz. Es consistente con el texto (*"largely proportional to the ratio of the flow lengths with a lesser dependence on the melt viscosities"*) y con el numérico del libro (2 mm · 210/280 = 1.5 mm). Si se implementa con raíz sobre todo, sale 1.73 mm y no cuadra con Kazmer.

## 3. ITERACIONES — CAP. 5

| Disparador | Vuelta | § |
|---|---|---|
| La velocidad recomendada depende de μ, que depende del shear rate, que depende de la velocidad | **Lazo cerrado numérico**: 0.5 → 0.69 → 0.77 → 0.80 → **0.82 m/s** (converge). Literal: *"it is necessary to recompute the shear rate and viscosity until the velocity converges"* | 5.5.1 |
| ΔP de cavidad > techo (100 MPa) | Subir espesor / agregar gates / subir temp de melt (mid-range deja margen) / cambiar material | 5.5.2, 5.6 |
| Espesor mínimo inaceptable | Nota clave: *"the minimum wall thickness is **also a function of the feed system design**"* → **volver al cap. 6** y rediseñar el feed | 5.5.2 |
| Short shot en planta | Moldeador: temp ↑, presión ↑, otra resina → si falla, **cambio físico del molde**: *"adding more gates, increasing the diameters of the feed system, increasing the wall thickness"*. *"Such physical alterations of the mold can be expensive and time consuming"* | 5.6 |
| Race-tracking / gas trap detectado en el lay-flat | (1) mover el edge gate al centro del lado largo; (2) three-plate o hot runner para gatear al centro; (3) si el layout lo impide, **flow leaders**: adelgazar la pared lateral | 5.5.5 |
| Se aplicó flow leader | Re-verificar: adelgazar 2 → 1.5 mm **subió la presión de inyección 10%** y bajó el peso ~10% → re-checar contra el techo de presión | 5.5.5 |
| Presión de llenado muy baja | Adelgazar pared + costillas; o el moldeador bajará temps y subirá velocidad | 5.1, 5.2.1 |

## 4. JUICIOS HUMANOS — CAP. 5
- **Confiar en la experiencia vs. analizar** (§5.4): no analizar *"may work for a mold designer who routinely designs similar molds for the same material, [but] quickly becomes inadequate for new designs or materials."*
- **Molde prototipo sí/no** (§5.4): *"the most accurate results, but also requires significant investment and so is not economical for many molding applications."*
- **Cuánto agrupar en el lay-flat** (§5.5.2): tres niveles de fidelidad mostrados (A / B+C / segmentado fino) — *"sections of similar width may be lumped together to simplify"*. Es criterio del diseñador.
- **Aceptar el sesgo conservador** (§5.4): sabiendo que la pieza saldrá más gruesa de lo necesario, se acepta porque el error va del lado seguro.
- **Dónde poner el knit-line** (§5.2.3): en zonas *"less important with respect to aesthetics or structural integrity"* — el diseñador decide qué es menos importante.
- **Estimar el caudal por volumen/tiempo** (§5.5.1): *"works well for those practitioners with experience"* — reconoce que la ruta de experiencia es válida pero no transferible.

## 5. CRITERIOS DE ACEPTACIÓN — CAP. 5
1. ΔP_cavidad ≤ 100 MPa (o el límite acordado con el moldeador), **sin** contar el feed system.
2. ΔP_cavidad no absurdamente bajo (pared no engordada).
3. La velocidad recomendada **convergió** (lazo v↔γ↔μ).
4. Velocidad lineal dentro de 0.01–1 m/s.
5. Los extremos más lejanos al gate llegan aproximadamente al mismo tiempo (sin estancamiento/surge).
6. Sin gas traps en paredes laterales; última zona en llenar identificada y venteable (vent o expulsor).
7. Knit-lines en zonas aceptables.
8. Tonelaje calculado en llenado Y en packing, sobre área proyectada, con piso de 50 MPa; ≤ tonelaje de la máquina.
9. Variación de espesor minimizada (flow leaders solo si mover el gate o cambiar el tipo de molde no era viable).
10. Verificación cruzada contra simulación cuando exista (referencia Tabla 5.1: análisis 100 MPa vs Moldflow 110 MPa; tonelaje de llenado 486 vs 519 kN = 7%).

---

# CAPÍTULO 6 — FEED SYSTEM DESIGN

## 1. EL PROCESO A MANO

**Proceso en 3 pasos declarado (§6.1):** (1) tipo de feed system; (2) ruteo; (3) diámetros de cada segmento *"to balance pressure drops, shear rates, and material utilization."*

**Desarrollado en §6.4 como 8 sub-pasos numerados** — esta es la máquina de estados del capítulo:
- §6.4.1 Determinar el tipo → §6.4.2 Determinar el layout → §6.4.3 Estimar caídas de presión → §6.4.4 Calcular volumen → §6.4.5 **Optimizar diámetros** (método de restricción) → §6.4.6 Balancear caudales → §6.4.7 Estimar tiempos de enfriamiento del runner (frío) → §6.4.8 Estimar tiempo de residencia (caliente).

**Las 3 metas cuantificadas (§6.4)** — el "contrato" del feed system:
- ΔP: *"typically **no greater than 50% of the pressure required to fill the cavities or 50 MPa**"*;
- Volumen: *"**no greater than 30% of the volume of the cavities for cold runner** molds **or 100% ... for hot runner** molds"*;
- *"**not extend the mold cooling time**."*

**Layouts (§6.4.2):** series, branching (naturalmente balanceado), radial (con diafragma en la base del sprue para multiplicar primarios), hybrid (branched → radiales; menos material Y balanceado), custom (multi-gated; puede llevar rotating shut-offs para cambiar la conectividad **con el molde en la máquina**).

**Balanceo natural vs artificial:**
- Natural = geometría espejo (grid múltiplo de 2, radial, híbrido). Costo: más material y más ΔP; y desbalance TÉRMICO por las vueltas del melt en ramas múltiples → Melt Flipper™ [27,28].
- Artificial = diámetros distintos por rama. Se usa cuando las cavidades **no** son iguales (family molds, multi-gated). Sus dos límites duros están en §6.2.4.

**Cold vs hot vs three-plate (§6.3.3 y Tabla 6.2):**

| Tipo | Inversión | Capacidad del moldeador | Ef. material | Ef. ciclo |
|---|---|---|---|---|
| 2-plate cold | Lowest | Lowest | Low | Lowest |
| 3-plate cold | Low | Low | Low | Low |
| Insulated runner | Moderate | Moderate | Moderate | Moderate |
| Hot runner | High | Moderate | High | High |
| Stack mold | Highest | High | High | Highest |

Hot runner elimina 5 cosas: plastificar el melt del feed, inyectarlo, esperar a que enfríe, abrir mucho el molde, y desgatear → *"**20% faster cycle times and 20% less material scrap**"*.
Three-plate: el costo real es el **daylight** y el tiempo de apertura, no la altura de pila. Tabla 6.1: stack 264→308 mm (+20%), masa 151→181 kg (+20%), pero **apertura 75→250 mm** y **daylight total 339→558 mm**, tiempo de apertura **0.36→1.2 s**. Velocidad de apertura por regresión: `v_apertura = 184 + 13·log(F_clamp[mTon])` mm/s (≈210 mm/s para 100 ton).

## 2. REGLAS PRESCRIPTIVAS EN PROSA — CAP. 6

### Objetivos y presupuesto
| § | Frase (EN) | Qué exige |
|---|---|---|
| 6.2.2 | *"the mold designer **should contact the molder** to obtain the molding machine's maximum injection pressure"* | Dato de entrada que se pide por teléfono, no se supone. |
| 6.2.2 | ⭐ *"If this information is **not known**, then the mold designer **can assume a maximum pressure drop through the feed system of 50 MPa (7,200 psi)**. While this is **slightly higher than some industry practices**, this specification will result in a **steel-safe** design"* | Default explícito y su justificación (conservador *por el lado del acero*, no por el de la presión). |
| 6.2.3 | *"A **typical limit on regrind may be 30%**, which translates directly to a specification on the **maximum volume of the feed system**"* | 30% de regrind ⇒ V_feed ≤ 0.30·V_cavidades. Ej: 50 cc → 15 cc. |
| 6.2.3 | *"Hot runners are **being increasingly designed with smaller diameters, such that the material turns over every molded cycle**"* | Hot runner objetivo: n_turns ≈ 1. |
| 6.2.3 | ⭐ *"**unlike a steel-safe designed cold runner system, high costs may be incurred to reduce the diameters of a hot runner system**"* | El hot runner NO se corrige barato — el sesgo steel-safe no se paga igual. |
| 6.2.4 | *"an **artificially balanced feed system may not balance** the mold filling for **different materials and processing conditions**"* | El balanceo artificial está atado al material y al proceso asumidos. |
| 6.2.4 | *"runner segments with **smaller diameters will tend to freeze quickly and reduce the amount of packing to downstream cavities**"* | Balancear el LLENADO puede desbalancear el PACKING. |
| 6.2.4 | *"the mold designer **should strive to utilize mold cavities that have similar filling requirements**"* | Prevenir antes que balancear. |

### Layout
| § | Frase (EN) | Qué exige |
|---|---|---|
| 6.4.2 | *"such **artificial balancing can be difficult to achieve**, and does not guarantee consistent part quality ... the **series layout ... is not frequently used in precision applications**"* | Serie descartado en precisión. |
| 6.4.2 | *"The **total length** of the feed system **should be as short as possible**"* (dicho dos veces: material y ΔP) | Regla #1 de layout. |
| 6.4.2 | *"**Naturally balanced feed systems provide greater cavity to cavity consistency** ... than artificially balanced designs"* | Preferencia por default. |
| 6.4.2 | *"The **total number of branches should be minimized** to avoid excessive runner volume and potential **melt temperature imbalances**"* | Minimizar ramas (no solo longitud). |
| 6.4.2 | *"the **diameters are generally largest with the sprue** and subsequently become smaller with the primary, secondary, and other runners"* | Monotonía decreciente aguas abajo. |
| 6.4.2 | *"**Economic analysis is vital** to determine the correct number of cavities, the layout, and the type of feed system"* | La economía decide, no la geometría. |
| 6.4.2 | *"**Hot runner and three-plate molds should be considered when cavities in a two-plate mold obstruct the desired layout** of the feed system"* | Disparador geométrico para cambiar de tipo de molde. |
| 6.4 | ⭐ *"While this design guideline [D_down = D_up/sqrt(n)] is simple and seems intuitive, **the resulting designs are inferior** with respect to the imposed pressure drops and the consumed plastic material"* | **Kazmer RECHAZA la regla clásica de velocidad constante.** Es un anti-patrón explícito. |

### Análisis y optimización
| § | Frase (EN) | Qué exige |
|---|---|---|
| 6.4.3 | *"To verify laminar flow, the Reynolds number **should be less than 2300**"* (real ~0.1) | Chequeo formal previo a Hagen-Poiseuille. |
| 6.4.3 | *"the most accurate estimate may be provided by **analyzing each segment of the tapered bore**. Given this particular geometry, however, **a reasonable estimate may be obtained by modeling the tapered bore as a constant section**"* | Autorización explícita a simplificar el cónico, caso por caso. |
| 6.4.5 | *"**Multivariate optimization** ... **requires time to implement and validate while hiding the details of the analysis from the designer**"* | Rechaza la caja negra; prefiere el método de restricción resoluble. |
| 6.4.5 | *"**The problem with this approach** [ΔP igual por segmento] is that it **does not account for the length** ... the diameter being **too small for the secondary runner and too large for the primary**"* | Asignar ΔP_i = ΔP_max·L_i/L_total, no en partes iguales. |
| 6.4.5 | *"by **maintaining the same runner diameter in the manifold and the nozzle, more uniform shear stresses are maintained with a lower likelihood for dead spots**"* | Beneficio colateral que hay que preservar cuando el cálculo lo permite. |
| 6.4.6 | *"the **total filling time and pressure of each branch ... should be evaluated** to ensure a truly balanced design; **multiple iterations may be needed**"* | Verificación de cierre del balanceo. |
| 6.4.7 | *"the mold designer can **simply check the cooling time for the thickest mold cavity section and the largest feed system diameter (usually the diameter at the base of the sprue)**"* | Atajo autorizado: solo los dos peores casos. |
| 6.4.7 | *"If the cooling time of the feed system **greatly exceeds** that of the cavities, then the mold designer **should redesign the feed system**"* | Criterio de rechazo (nota: "greatly exceeds", no "exceeds" — 26.7 vs 18.9 s se acepta con matiz). |
| 6.4.8 | *"If the number of turns is **less than or close to one**, then the hot runner is **unlikely to impede color changes** ... If ... **on the order of 10 or more**, then purging ... **hundreds (or thousands) of molding cycles**"* | Umbrales de n_turns. |
| 6.4.8 | *"the allowable residence time of most polymers ... is **typically greater than 15 minutes**"* | Referencia de residencia. |

### Componentes y práctica
| § | Frase (EN) | Qué exige |
|---|---|---|
| 6.3.1 | *"To facilitate ejection, a **reverse taper is usually provided below the sprue** to ensure that the sprue and attached runner **remains with the B half**"* | El undercut del sprue puller es estándar. |
| 6.3.1 | ⭐ *"the **diameter of the molding machine's nozzle orifice is typically smaller than the diameter of the sprue inlet**"* ... *"the mold designer **should verify and/or recommend** the nozzle orifice diameter"* | ÚNICA excepción a "aguas abajo más chico". Si se invierte: el sprue se pega a la mitad A → "sprue break" → *"adds complexity and variance to the molding cycle"*. |
| 6.3.2 | *"the mold designer **should design the sucker pins such that they do not restrict flow**"* + *"they could be **moved further away from sprue bushing**"* | Colocación de sucker pins en 3-placas. |
| 6.3.2 | *"A **typical mold open distance between the A and B plates is equal to two to three times the height of the molded parts**"* | Regla de dedo para el stripper bolt. |
| 6.3.2 | *"the mold opening **velocity and position must be carefully determined and controlled** ... If ... not carefully set up, then the feed system may not be reliably ejected **or the mold can be damaged**"* | El 3-placas es sensible al setup. |
| 6.3.3 | *"Hot runner molds **should be considered whenever gating flexibility, cycle efficiency, and material efficiency are important**"* | Disparador de evaluación del hot runner. |
| 6.3.3 | *"**overly large diameters can permit the material to degrade** ... and **prohibit rapid change-overs** between different resins and colors"* | El límite superior del hot runner no es la presión: es degradación y cambio de color. |
| 6.3.3 | ⭐ *"Thrust pads, **typically machined from titanium**, are used to transfer these forces from the hot runner to the top clamp plate **while transferring a minimal amount of heat**"* + *"**cooling lines and/or insulating sheets should be used with the top clamp plate to prevent the transfer of significant heat to the platens**"* + *"the **manifold is allowed to expand and slide** across the top surface of the nozzles ... **maintained in compression in the height direction**"* | Tres requisitos estructurales/térmicos del hot runner que no salen de ninguna ecuación de flujo. |
| 6.3.3 | *"The mold designer **should consult with multiple hot runner suppliers**"* | El manifold no se diseña solo. |
| 6.4.1 | *"the mold designer **should verify the capabilities of the molder** if the type of feed system has not been specified"* | Gate humano antes de elegir el tipo. |
| 6.5.1 | *"**all these non-circular types of runner will need to be slightly larger** and consume additional material to provide the same pressure drop as a full round runner"* | Penalización por sección no circular: eficiencias 100% / 87.9% (round-bottom trap) / 78.5% (trapezoidal) / 61.2% (half-round). |
| 6.5.1 | *"the equations in Table 6.3 have been **derived assuming a 5 degree taper angle to assist with the ejection of the runner**"* | Los 5° de salida están HORNEADOS en las fórmulas de D_h. |
| 6.5.1 (ejemplo) | *"The dimensions of this trapezoidal design are **too large, providing a low pressure drop but consuming excess material and cycle time**. The depth and width **should be reduced**"* | ΔP bajo se REPRUEBA también en el runner. |
| 6.5.2 | *"it is **recommended that the diameter of the sucker be slightly less than the diameter of the associated runner** to avoid increased cooling times"* | Cota del sucker pin. |
| 6.5.2 | *"**Typical heights and taper angles are one half the runner diameter and 5 degrees**"* | Altura = D_runner/2, ángulo 5°. Restricción: sin material excesivo y **sin pandear (buckling) el expulsor**. |
| 6.5.2 | *"it is **preferred to align the top of the ejector pin with the bottom of the runner**"* | Evita perturbar el frente de flujo. |
| 6.5.2 | ⭐ *"if **multiple slotted ejector pins** are used ... the mold designer **should consider the relative alignment of the undercutting slots** ... If ... **provided at random angles, then the runner system may inadvertently bind** ... **hampering the adoption of a fully automatic molding cycle**"* | La ORIENTACIÓN angular de cada ranura es una cota del plano. |
| 6.5.3 | *"Mold designers **should consider the use of runner shut-offs** to provide molders with manufacturing flexibility"* | 3 usos: cavidad dañada, combinaciones de family mold, alterar el gating multi-gated. ~US$150, para runners de 2 a 9.5 mm, config. "T", "L", recto. |
| 6.5.3 n.4 | *"**cavity shut-offs should not be used in commercial production for high precision molding applications**"* salvo re-calificación del proceso | Controversia declarada: cambia shot size y velocidad, y desbalancea flujo y transferencia de calor. |
| 6.5.4 | *"the mold designer **should specify runner diameters that are machined with readily available cutting tools**"* | Lista literal: 1/32″, 1/16″, 3/32″, 1/8″, 3/16″, 1/4″, 5/16″, 3/8″, 7/16″, 1/2″, y 2, 3, 4, 4.5, 5, 6, 8, 10, 12 mm. |
| 6.5.4 | *"**However, if non-standard runner sizes provide for less material utilization and more balanced melt flow, then non-standard runner diameters can and should be specified**"* | El catálogo NO es camisa de fuerza: hay una condición de escape explícita. |
| 6.5.4 | *"Hot runner systems are similarly available with a range of standard bore sizes, **typically stepped in 2 mm increments**"* (5/7/9 o 4/6/8/10 según proveedor); *"the mold designer **should verify the appropriateness** of the [supplier's] recommendations"* | Redondeo a catálogo del proveedor + verificación propia. |
| 6.5.5 | ⭐ *"the mold designer **should specify feed system dimensions that are 'steel safe'** ... the design should call for **the removal of less mold steel** than may ultimately be required ... **round the feed system dimensions DOWN one or two standard sizes**"* | 4.6 mm → especificar **4.5 o 4 mm**, nunca 5. Si se redondeó hacia arriba, corregir cuesta: pocket milling, fabricar y ajustar inserto, soldadura y/o fasteners, y rehacer el feed. |

## 3. ITERACIONES — CAP. 6

| Disparador | Vuelta | § |
|---|---|---|
| Viscosidad aparente depende del radio (Newtoniano, Ec. 6.7) | Iterar shear rate ↔ viscosidad ↔ R — **o** saltar la iteración usando power law (Ec. 6.8, un solo paso) | 6.4.5 |
| ΔP total > presupuesto | Subir diámetros (y aceptar más volumen) o reasignar ΔP por longitud | 6.4.3/6.4.5 |
| Volumen del feed > 30% de las cavidades (frío) | Bajar diámetros → sube ΔP; para compensar: *"a **higher melt temperature, lower viscosity material, or lower flow rate**"* | 6.4.5 |
| Volumen del hot runner alto / n_turns alto | Bajar diámetros (pero: costoso en hot runner) o rediseñar el manifold | 6.2.3/6.4.8 |
| El diseño quedó con ΔP muy bajo y volumen alto | **Rediseñar hacia abajo** (ej. trapezoidal 6×8 mm: *"too large ... depth and width should be reduced"*); barrido de la curva V(ΔP) de la Fig. 6.19 | 6.5.1, 6.4.5 |
| Tiempo de enfriamiento del sprue > el de la cavidad (26.7 vs 18.9 s) | Reducir el diámetro del sprue, *"albeit with a higher pressure drop"* — pero antes, **juzgar**: el runner no necesita la misma rigidez que la pieza | 6.4.7 |
| Las ramas de un family mold no llenan a la vez | Iterar diámetros por rama igualando el **ΔP total** desde el fondo del sprue; luego **re-verificar los tiempos de llenado de cada rama** | 6.4.6 |
| Regrind muy alto | *"The mold designer **may assess a higher pressure drop** through the feed system to reduce this percentage, and **may wish to recommend a hot runner system** to the end user"* | 6.4.6 |
| Las cavidades del 2-placas estorban el ruteo deseado | Cambiar a **3-placas o hot runner** | 6.4.2 |
| Muchas cavidades + desbalance térmico por ramas | Migrar a hot runner: *"molding applications with a high number of cavities are increasingly utilizing hot runner feed systems"* | 6.4.2 |
| Caudal real desconocido | Estimar v con Ec. 5.23 (cap. 5) y asumir caudal constante durante el llenado → **el cap. 6 depende del cap. 5** | 6.4.5 |

## 4. JUICIOS HUMANOS — CAP. 6
- **Tipo de feed system**: *"often specified as part of the mold quote ... since it is **either obvious or has been specified by the customer**"*. Cuando no: economía + capacidad del moldeador.
- **Capacidad del moldeador** (§6.4.1): *"While **all molders are expected to operate two-plate molds**, some molders **may not be familiar** with the proper setup, operation, and maintenance of three-plate, insulated runner, or hot runner molds"*; los stack molds *"may seem **daunting** to some molders and require **auxiliary controllers that are not available**."* Esto puede vetar el diseño técnicamente superior.
- **Cadena de suministro sobre eficiencia** (§6.4.1): 12 moldes simples de 4 cavidades repartidos en Europa/Asia/América — peor ciclo, pero *"may reduce the initial mold development time, provide **redundancy to mold failure**, and allow for **reduced tact time** in the supply chain in response to fluctuations in consumer demand."*
- **Tiempo = dinero en desarrollo** (§6.4.1): 2-placas 2 cav ≈ $20,000 y unas semanas vs. stack de 64 cav ≈ $1,000,000 y varios meses; *"the added time may be as significant an issue as the added cost."*
- **Family mold sí/no** (§6.2.4, §6.4.6): se admite pero se desalienta — *"strive to utilize mold cavities that have similar filling requirements"*; si las diferencias son grandes, mejor tecnología activa (Dynamic Feed™) que geometría estática.
- **Aceptar el límite del balanceo** (§6.4.6): *"a truly optimal, balanced mold design is **extremely difficult to achieve** ... **realize that there will be limits to the performance of static feed system geometries**."*
- **Runner no circular** (§6.5.1): se elige por **facilidad de maquinado y menos riesgo de desalineación** al no tener que empatar dos mitades — se paga con eficiencia.
- **Regrind que no vale la pena** (§6.4.6): 3.5% → *"The cost of collection, regrind, and re-use of this material **may exceed the purchase cost of the resin**."*
- **Shut-offs de cavidad** (§6.5.3 n.4): "somewhat controversial" — decisión de riesgo, no de cálculo.
- **Rechazo de la optimización automática** (§6.4.5): prefiere un método transparente aunque sea subóptimo, *"hiding the details of the analysis from the designer"* es un costo real.

## 5. CRITERIOS DE ACEPTACIÓN — CAP. 6
1. ΔP_feed ≤ min(50% de ΔP_cavidad, 50 MPa) — o el presupuesto real derivado de (P_máquina − P_cavidad).
2. V_feed ≤ 30% de V_cavidades (frío) / ≈100% (caliente, n_turns ≈ 1).
3. El feed system **no** extiende el tiempo de ciclo: t_cool(mayor diámetro, típicamente base del sprue) no excede *"greatly"* a t_cool(sección más gruesa de la cavidad).
4. n_turns cerca de 1 (alerta si ≥10); t_residencia = (1+n_turns)·t_ciclo ≪ 15 min.
5. Re < 2300 (formalidad; real ~0.1).
6. Diámetros monótonamente decrecientes aguas abajo — **excepto** nozzle_orifice < sprue_inlet.
7. Diámetros redondeados a herramienta de catálogo y **hacia abajo** (steel safe), salvo justificación de material/balanceo.
8. Balanceo: mismo ΔP total desde el fondo del sprue hasta el final de cada cavidad; tiempos de llenado de cada rama verificados.
9. Longitud total mínima y número de ramas mínimo.
10. Sucker pins: D_sucker < D_runner; altura ≈ D_runner/2; taper 5°; tope del expulsor alineado con el fondo del runner; ranuras con orientación **especificada**.
11. Hot runner: air gap, thrust pads, enfriamiento/aislamiento del top clamp plate, manifold libre de expandirse pero en compresión vertical.
12. 3-placas: apertura A–B = 2–3× la altura de la pieza; daylight total verificado contra la máquina (558 mm en el ejemplo, vs 339 del 2-placas).

---

# ⭐ LOS 10 DETALLES QUE UNA MÁQUINA LINEAL SE SALTARÍA

1. **§4.2.1 — La altura del inserto tiene DOS valores con el mismo nombre.** La cota de diseño va del respaldo al plano de partición; la de **compra y cotización** debe incluir el corazón que sobresale. Un pipeline que arrastre un solo número compra acero de menos.
2. **§4.2.1 — Redondear la altura HACIA ARRIBA y dejar la cara "flush or slightly proud".** El redondeo tiene dirección (nunca hacia abajo) y un estado de superficie preferido; un `round()` simétrico deja el inserto hundido y el molde con rebaba.
3. **§4.1.3 — Interlocks del plano de partición inclinados ≥5°, con superficies lofted que llevan el draft desde el perfil hasta el plano.** No es una cota de la pieza: es una cota que se INVENTA en el plano de partición para que el tonelaje no trabe el acero.
4. **§4.3.2 — La holgura mínima es "½ del diámetro de CADA componente", y la base crece por conflictos que aún no existen.** *"mold bases are often sized larger than what would first be considered"* — el layout se dimensiona contra return pins, guide pins, SHCS, cooling, expulsores y pilares, no contra el bounding box de las cavidades.
5. **§4.3.3 — El ancho que se compara contra las tie bars incluye cooling plugs y conectores del hot runner, menos holgura de inserción; y un molde DEMASIADO chico también se daña.** Los dos extremos fallan: por debajo del daylight mínimo no se genera tonelaje, y el exceso de tonelaje sobre un molde subdimensionado lo destruye. Además la ventana cómoda de disparo es 120–250 cc **de un máximo de 490** (~25–50%), no "cabe / no cabe".
6. **§5.1, §5.5.2, §6.5.1 — Una caída de presión DEMASIADO BAJA es un defecto, no un margen.** Pared gruesa → presión baja → *"excessive material costs and extended cycle times"* → adelgazar y poner costillas. Igual en el runner: el trapezoidal de 6×8 mm se **rechaza** por dar ΔP baja. Un optimizador que minimice ΔP produce exactamente el diseño que Kazmer reprueba.
7. **§5.5.3 — Piso de 50 MPa para el tonelaje, y el área PROYECTADA no es el ancho del lay-flat.** Aunque el análisis dé menos, *"assume a minimum cavity pressure of 50 MPa"* porque el moldeador empacará ahí; y en el mismo ejemplo el lay-flat mide 20 mm de ancho pero la proyección son **12 mm**. Dos trampas numéricas en el mismo párrafo.
8. **§6.4.6 — El balanceo artificial iguala el ΔP TOTAL (cavidad + rama) desde el fondo del sprue, no el ΔP del runner.** Literal: la rama del cup suma 46.8 MPa, así que a la rama del lid se le **diseña** 31.4 MPa para igualar ese total. Balancear solo los runners entre sí da un molde desbalanceado.
9. **§6.5.5 + §6.2.3 — "Steel safe" significa redondear HACIA ABAJO una o dos tallas de catálogo… y no aplica igual al hot runner.** 4.6 mm → especificar 4.5 o 4 mm. Redondear a 5 mm parece inocuo y condena el molde a desperdiciar material toda su vida, porque corregir hacia abajo exige pocket milling + inserto + soldadura. En hot runner *"high costs may be incurred to reduce the diameters"*: ahí el sesgo se paga distinto.
10. **§6.4 + §6.3.1 — Kazmer RECHAZA la regla clásica D_aguas_abajo = D_arriba/√n, y el orificio de la boquilla ROMPE la monotonía de diámetros.** La regla de "velocidad constante" es intuitiva, está en todos lados, y produce *"designs [that] are inferior with respect to the imposed pressure drops and the consumed plastic material"*. Y la única excepción a "todo se achica aguas abajo" va **antes** del sprue: nozzle_orifice < sprue_inlet, o el sprue se pega a la mitad A y el moldeador acaba haciendo "sprue break".

---

# BRECHAS DEL CORPUS (para pedir el siguiente tramo)

- **Venteo**: no está en caps. 4-6 más allá de "predice la última zona en llenar y pon vents o expulsores ahí" (§5.2.3) y "el gas trap en pared lateral es difícil de ventear y quema" (§5.5.4). Las cotas de venteo (profundidad, ancho, venteo del runner y del sprue) no aparecen.
- **Gates**: el cap. 7 arranca en la línea 3987 del archivo. Lo único que hay es la promesa: *"the most common types of gates being the edge and pin-point gates"* y *"gating represents a small portion of the mold cost but has a significant impact on the operation of the mold."* Los gates térmicos y valve gates se mencionan de paso en §6.3.3 y §6.5.1 (anular, Ec. 6.14/6.15) pero se dimensionan en el cap. 7.
- **Referencias adelantadas que el software va a necesitar**: §12.2.4 (cheek estructural), cap. 9 (enfriamiento y las ecuaciones de t_c de la Tabla 6.2), cap. 12 (esfuerzo bajo líneas de enfriamiento, de donde sale el 3·D), §11.2.6 (alineación de ranuras de expulsores), §13.6.4 (Dynamic Feed), §13.9.1 (split cavity), §2.3.1 (por qué la variación de espesor es mala), Apéndice B (propiedades de metales), Apéndice A (coeficientes Cross-WLF), Apéndice F (derivación de la velocidad recomendada, Ec. 5.23).