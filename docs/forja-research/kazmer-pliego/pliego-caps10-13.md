# RESPALDO — Experimento 'Kazmer es el cliente' (2026-07-31)

He leído el archivo completo (6,425 líneas, caps 10-13 + apéndices A-F). Reporte abajo.

---

# EL PROCESO A MANO DE KAZMER — caps 10-13

> **Marcador `★`** = los 10 detalles que una máquina lineal se saltaría (van marcados en su lugar y resumidos al final).
> Formato de cada regla: **§** — *"frase en inglés"* → traducción / implicación de implementación.

---

## CAPÍTULO 10 — CONTRACCIÓN Y ALABEO

### 10.1 — La secuencia de decisiones de contracción (7 pasos, en orden)

**§10.1.1 Estimar condiciones de proceso**
- *"the mold designer may assume that the melt temperature is equal to the mid-range temperature recommended from the material supplier"* → temperatura de fusión = **punto medio** del rango del proveedor (para ABS Cycolac MG47 = 239 °C; está tabulado en Apéndice A como "Mid-range melt temperature").
- *"a common molding practice is that the packing pressure is initially set to 80% of the pressure required to fill the mold"* → **Ppack = 0.80 · Pllenado**. Regla de dedo, no ecuación derivada.
- *"The mold temperature is also assumed to be at the middle of the recommended range for the coolant temperature"* → T_molde = punto medio del rango de refrigerante del Apéndice A (min/max coolant temperature).

**§10.1.2 Modelar compresibilidad (Tait doble dominio)**
- Decisión de rama: si T > Tt(P) usa coeficientes de **melt** (b1m..b4m); si T < Tt(P) usa los de **solid** (b1s..b4s). `Tt(P) = b5 + b6·P`.
- Validación cruzada que él hace a mano: sacar la densidad a 20 °C / 0 MPa del PvT y **compararla con la del proveedor** (1047 vs 1044 kg/m3 → "compares well"). Es un gate de sanidad del modelo antes de seguir.

**§10.1.3 Evaluar contracción volumétrica**
- *"a more simple approach is to assume that the melt temperature at the end of the packing stage is equal to the no-flow melt temperature"* → **T_fin_pack = T_no-flow** (tabulada). Atajo autorizado en lugar de calcular el perfil térmico del cap 9.
- `Δv = v(T_noflow, Ppack) − v(T_uso, P_uso)`; `rv = v(T_uso,P_uso) / v(T_noflow,Ppack)`. Uso final asumido a **20 °C y 0 MPa**.

**§10.1.4 Contracción lineal isotrópica**
- *"Most unfilled plastics exhibit isotropic behavior"* → sin relleno ⇒ isotrópico por defecto. `s = 1 − rv^(1/3)`.

**§10.1.5 Contracción anisotrópica**
- Aplica a *"liquid crystal polymers and glass filled polymers"*. `a` = fracción de anisotropía en dirección de flujo.
- Resuelve `s = −[(rv−1) + (2+a)s² − a·s³]/(2+a)` **por iteración**; *"an initial guess of zero shrinkage should suffice"* y *"The solution has converged after two iterations"* → semilla s=0, converge en 2 iteraciones. (No usar el cúbico analítico; él prefiere el punto fijo.)
- Regla de conversión peso→volumen de fibra: `p = %peso · (ρ_resina/ρ_fibra)`; 15% en peso de vidrio ≈ **6% en volumen**; el 94% restante contrae como resina virgen y el 6% "no contrae significativamente" → `Δv_filled = 0.94 · Δv_neat`.

**§10.1.6 Evaluar el RANGO (límites inferior y superior)** — esto es un paso propio, no un adorno
- Límite INFERIOR de contracción: pack largo + presión alta. *"A practical upper limit for the packing pressure may be the greater of 120% of the injection pressure or 100 MPa"* → `Ppack_max = max(1.2·Pinj, 100 MPa)`.
- Límite SUPERIOR: pack corto + presión baja. *"a low packing pressure (equal to the lesser of 40% of the injection pressure or 30 MPa) and a high melt temperature (equal, perhaps, to the temperature half-way between the no-flow temperature and the melt temperature)"* → `Ppack_min = min(0.4·Pinj, 30 MPa)` y `T = (T_noflow + T_melt)/2`.
- **★ JUICIO CLAVE:** *"molds are not usually designed or operated with the intent of obtaining zero or negative shrinkage… some shrinkage is desirable so that the plastic molding will shrink away from the walls of the cavity and onto the core so the molding can be ejected. Negative shrinkage corresponds to 'over packing'… it may not be possible to release the part from cavity details such as ribs and bosses."* → Si el cálculo da s ≤ 0, **no es un resultado válido de diseño, es una alarma**: se necesita contracción positiva para que la pieza se despegue de la cavidad y se pueda expulsar.
- Si el límite superior sale muy alto (1.9% vs 0.3%): *"The mold designer should suggest an extended packing stage with higher packing pressures"* → la salida no es solo un número, es una **recomendación de proceso al moldeador**.

**§10.1.7 Recomendación FINAL de contracción — los 3 objetivos simultáneos**
1. *"to provide a shrinkage value that is close to the actual shrinkage of the material"*
2. *"a mold machined with a shrinkage value that may be operated under a range of process conditions to bring the part dimensions within specification"* → el valor debe dejar **ventana de proceso**, no solo acertar el nominal.
3. *"a mold that is machined 'steel safe' such that the mold can be readily altered if necessary"*

- *"the shrinkage analysis should be considered as complementing other sources… should not be used in isolation given the potential for error… should be used to verify the shrinkage estimates coming from other sources."* → **El análisis NUNCA decide solo: verifica a los otros.**
- Las 4 fuentes de dato, en orden de confiabilidad creciente y costo creciente:
  1. **Proveedor / laboratorio**: placa de prueba de 2 o 3 mm, condiciones medias, se deja **equilibrar un tiempo** antes de medir. Riesgo: *"the shrinkage data may not be based on testing of the actual material, but rather assumptions that the material will behave as supposedly similar materials"*. Inexacto si el espesor o el proceso difieren mucho del test.
  2. **Molde prototipo** con longitud de flujo, espesor y sistema de enfriamiento **similares a la aplicación real** → presiones y temperaturas muy parecidas ⇒ la contracción medida es muy cercana. Caro pero *"very useful in tight tolerance applications"*.
  3. **Moldes previos + experiencia del moldeador**: comparar medidas de la pieza contra las **dimensiones del acero**. **★ Y aquí el detalle humano:** *"the mold designer should inquire with the molder to check if the molder would have preferred to operate the molding machine at different melt temperatures and/or pressures. If so, the mold designer should ask the molder to produce moldings at the preferred conditions (even if the moldings fall outside of specification), and then calculate the shrinkage of these moldings for use in mold design applications."* → Pedirle al moldeador que corra en **SUS** condiciones preferidas aunque las piezas salgan fuera de especificación, y calcular la contracción de ESAS piezas.
  4. **Simulación**: *"subject to the same errors regarding the assumed material behavior and processing conditions"* pero *"valuable to validate the manual shrinkage analysis while providing non-uniform shrinkage estimates across the mold cavity."*
- **Cierre contractual / de riesgo:** *"If the shrinkage rate is uncertain, then the mold designer should communicate the potential error with the molder, material supplier, and end-user to reduce the uncertainty and assess liability should the utilized shrinkage rates be so erroneous to incur costly mold changes. In some contracts, the final shrinkage recommendation is the responsibility of the mold's customer… In other cases, no party is willing to accept responsibility… so the parties agree that a prototype molding project is necessary."* → **La recomendación final incluye asignar la RESPONSABILIDAD del número.**

### 10.2 — Validación y "steel safe"

**§10.2.1 Contracción no uniforme — qué hacer**
- Hallazgo de simulación: 0.3% en zonas delgadas (congelan a alta presión), ~0.6% en el grueso, **>1% cerca del fin de llenado** (la puerta congela y no deja llegar más material).
- Estrategia A: **usar valores de contracción distintos en distintas zonas del molde** (habilitado por CNC + simulación). *"For more complex product geometry with a tightly interconnected surface, however, the application of non-uniform shrinkage values can become a complex and risky endeavor."* → solo en geometría simple/desacoplada.
- Estrategia B (**la más común**): *"A more common approach to obtaining tight tolerances is to ensure more uniform shrinkage across the mold cavity through the addition of multiple gates."* 2→4 puertas: máximo 1.1% → 0.9%, promedio 0.6% → 0.5%.
- Advertencia de costo de la iteración tardía: *"the modification from a two-drop 'straight bar' manifold to a four-drop 'H' or 'X' style manifold may require the purchasing of a new manifold, the addition of bores to the A-side of the mold, and the re-routing of cooling lines."* → Añadir puertas después de construido puede ser barato **o carísimo**; si es carísimo, corregir por **proceso o material** en lugar de por acero.

**§10.2.2 Diseño "steel safe" — LAS REGLAS**
- Definición operativa: *"the core and cavity inserts are purposefully designed so that they can be enlarged by removing existing mold metal if the product dimensions are found to be undersized."*
- **La receta numérica:** contracción esperada 0.5% ⇒ **cavidad con 0.4%, corazón con 0.6%**. Cavidad más chica, corazón más grande = metal de reserva. (Regla general: cavidad = s_esperada − Δ, corazón = s_esperada + Δ.)
- **Contra-argumento que él mismo da (juicio):** *"machining will be necessary in some molding applications regardless of the shrinkage behavior… by utilizing different shrinkage estimates for the core and cavity, the nominal dimensions of the plastic moldings will be out of tolerance. For this reason, many mold designers prefer to use a constant but mid-range estimate of the shrinkage for the design of the core and cavity inserts, and hope that the molder can adjust the molding process."* → **Steel-safe garantiza retrabajo. Hay una escuela que prefiere el valor medio constante y confiar en el proceso.** El software debe ofrecer LAS DOS y hacer explícito el trade-off.
- **★ Segunda práctica steel-safe, la que se olvida:** *"Another common 'steel safe' practice is to avoid finishing critical cavity details until after the mold is constructed and tested. By leaving features such as bosses, snap fits, and other mold cavity surfaces in a semi-finished state, the mold designer can finalize the design and implementation of these features after the shrinkage has been characterized. While such staged deployment of features in the mold design does lengthen the mold build time, the risk during mold development is reduced and the tolerances of the final moldings can be increased."* → **Despliegue por etapas: bosses y snap-fits se dejan semi-acabados hasta después del tryout.** Es una decisión de CRONOGRAMA, no de geometría.

**§10.2.3 Dependencia del proceso** — orden de influencia sobre la contracción (Fig. 10.11):
`packing time`, `packing pressure`, `barrel temperature`, `coolant temperature`, `cooling time`. Notas: *"Both packing time and cooling time are significant but have a small effect on shrinkage when sufficient packing and cooling times are used. The coolant temperature has a slightly greater effect than the barrel temperature, because it more directly controls the temperature of the molding upon ejection."*
- **Perfilado de presión de pack:** presión alta al inicio (reduce contracción lejos de la puerta), luego bajar conforme congela el material cerca de la puerta (evita sobre-empaque). Consigue casi lo mismo que 4 puertas **sin costo de acero**. *"Unfortunately, few molders leverage the capabilities of pack pressure profiling."*

**§10.2.4 Semicristalinos** — *"Many amorphous plastics have shrinkage rates on the order of 0.5%"*; acetal ≈ **3.5%**. *"Molding applications with such high shrinkage rates tend to be more difficult to control to tight tolerances due to their increased sensitivity to process conditions."* → bandera automática: semicristalino + tolerancia cerrada = riesgo.

**§10.2.5 Rellenos** (Tabla 10.1: carbon black 2000 kg/m3 CTE 0.5; glass bead 2600/3; **glass fiber 2600/3 — el único con anisotropía significativa**; mica 2800/10; rubber 1500/80).
- CTE de rellenos ~5e-6 vs plástico ~100e-6 → los rellenos **reducen** la contracción y **aumentan** la dimensión de la pieza. El caucho es la excepción (modificador de impacto, CTE 80).
- Si no hay PvT del grado relleno: usar el PvT de la resina virgen y el prorrateo volumétrico de §10.1.5.

### 10.3 — Alabeo: fuentes y mitigación

**§10.3.1 Las tres fuentes** (todo alabeo = contracción diferencial):
1. **Gradiente de T a través del espesor** (enfriamiento no uniforme). *"a temperature difference of 5 °C between surfaces of the core and the cavity inserts is not uncommon"*. `R_warp = 2h/(s_core − s_cavity)`; `δ = W·sin(W/R_warp)`.
   - Observación crítica: con solo 2 °C de diferencia, el alabeo (1.6 mm) **excede** la contracción total borde a borde (0.8 mm). Y *"this warpage estimate is not sensitive to the overall temperature of the molding, but only to the temperature gradient through the thickness."*
2. **Gradiente de presión a través del área** (pieza con puerta central).
3. **Gradiente de temperatura a través del área.**
- **Criterio de pandeo (buckling)** para piezas de área cerrada: `(s_edge − s_center) > 0.44·(h/W)²` → pandea. Entonces `δ = sqrt(W² − {W[1−(s_edge−s_center)]}²)`. Asume placa circular isotrópica, ν=0.4 (válido para casi todos los plásticos).
- **★ El juicio geométrico que ninguna fórmula da:** *"the window in the laptop bezel mechanically decouples the various sides from each other, such that each side is free to shrink independently. Warpage would likely only occur… if the shrinkage rate on the left side was very different from the shrinkage rate on the right side."* → Una pieza con **ventana/marco abierto** no alabea aunque tenga contracción muy dispareja; solo alabea si lados OPUESTOS difieren. Una pieza de **área cerrada** sí alabea porque la tensión solo se resuelve fuera de plano. La topología decide, no el mapa de contracción.
- Autocrítica sobre su propio cálculo: el ejemplo de la tapa da 6.6 mm y él dice *"it is somewhat unlikely that the lid would warp and very unlikely that the lid would warp to this extent"* porque asumir 0 MPa en el borde es irreal. → El resultado numérico se **pondera contra la plausibilidad física** antes de actuar.

**§10.3.2 Estrategias de evasión — 3 niveles, en este orden**

*Nivel 1 — DISEÑO DEL MOLDE (lo más importante):* *"By far, the most important strategy is to design a mold that will provide uniform melt temperatures and pressures throughout the cavity."* Cuatro acciones:
- *"Avoid high flow length to wall thickness ratios by utilizing multiple gates"*
- *"Maintain uniform cavity pressures by designing a balanced feed system with low flow resistance"*
- *"Maximize the mold surface temperature uniformity with a tight cooling line pitch and highly conductive mold inserts where needed"*
- *"Facilitate melt pressure and temperature uniformity… by requiring uniform part thickness and generous fillets"* (← esto es un **requisito de vuelta al diseñador de la PIEZA**)

*Nivel 2 — PROCESO (lo intenta el moldeador, sin tocar acero):*
- Llenar **lo más rápido posible** (reduce enfriamiento de la piel solidificada)
- Subir tiempo de pack **hasta que el peso de la pieza deje de aumentar** (criterio medible y concreto)
- Subir presión de pack
- Perfilar la presión de pack
- Usar **temperaturas de refrigerante distintas en lados distintos del molde** para controlar deliberadamente la distribución de contracción
- Probar otros materiales y sistemas de relleno

*Nivel 3 — CAMBIOS AL MOLDE (iteración con acero):*
- **Añadir una o más puertas** (el más común)
- **Añadir costillas someras (shallow ribs)** para subir la rigidez y evitar el pandeo
- **Contornear la superficie de la cavidad para que la pieza alabee HACIA la forma correcta** — *"places a significant burden on the mold designer and mold maker, since it involves a very high level of predictive capability and very fine surface machining. Since the dimensional shifts of the part due to warpage may exceed steel safe limits, errors in this approach can incur very high costs."* → última opción, fuera del margen steel-safe, alto riesgo.

### §10.4 — Criterios de aceptación del capítulo (checklist de cierre)
Comprender: relación contracción↔dimensiones del molde↔dimensiones de pieza; PvT de amorfos y semicristalinos; relación cualitativa P/T↔contracción; calcular contracción volumétrica desde PvT; calcular lineal desde volumétrica; causas de contracción diferencial; calcular alabeo desde contracción diferencial; efecto de proceso y rellenos; estrategias de diseño de molde para manejar contracción y alabeo.

---

## CAPÍTULO 11 — SISTEMA DE EXPULSIÓN

### 11.1 — Los 7 objetivos (son los criterios de aceptación del subsistema)

**§11.1.1 Permitir que el molde abra**
- *"the number of moving cores should be minimized by simplifying the product design and developing a suitable mold design"* → minimizar corazones móviles, **negociando con el diseñador de producto**.
- *"When moving cores are used, they should be designed, when possible, to work with the opening action of the mold rather than relying on additional actuators and control systems."* → **jerarquía dura: primero accionamiento por apertura (slide/angle pin), después actuador (core pull).**
- Core pull: actuadores típicos = válvulas neumáticas, hidráulicas, solenoides eléctricos o motores. *"should be designed to contact a limit switch when fully retracted. The molding machine will typically be programmed to delay the mold opening until all limit switches from all core pull circuits are energized."*

**§11.1.2 Transmitir fuerzas** — modos de falla a vigilar: *"excessive shear stress, compressive stress, deflection, fatigue, buckling, and mold failure."*

**§11.1.3 Minimizar distorsión de la pieza** — *"apply a low and uniform state of stress across the moldings… If the ejector force is uniformly distributed across many points… the molding will be uniformly ejected… without any permanent distortion."*

**§11.1.4 Actuar rápido y confiable**
- Air poppets / air jets para subir velocidad y bajar ciclo.
- Sprue pickers y robots: *"these systems do not greatly reduce the molding cycle time but rather provide increased control of molding's removal and subsequent placement while protecting the aesthetic areas."*
- **Si hay robot:** *"the moldings must be stripped off the core but retained at a controlled position by some of the ejection system components"* y *"mold designers should confirm and design interface geometry in the cavity and/or feed system that is easily identified and highly repeatable for interfacing with the part removal system."* → hay que **diseñar geometría de agarre** en la pieza o el bebedero.

**§11.1.5 Minimizar interferencia con el enfriamiento**
- Dos causas: metal menos conductivo que el inserto, y **resistencia térmica de contacto en cada ajuste deslizante**.
- Regla concreta: **un pin de diámetro mayor al espesor nominal de pared** genera punto caliente (el plástico sobre el pin tiene que enfriarse lateralmente).
- *"the use of overly large ejector pins should be avoided in favor of multiple, smaller ejector pins placed so as to not interfere with the mold cooling."*
- *"Such large components [stripper plates, lifters, core pulls] should be fitted with cooling channels and actively cooled to provide consistent ejection temperatures."*

**§11.1.6 Minimizar impacto en superficies** — las marcas de testigo (witness marks):
- Tres daños: *"reduce the visual quality of the molding's surface, interfere with mating assembly surfaces, and reduce strength in structural applications."*
- Regla #1: *"The most common approach is to locate ejector pins on non-visible surfaces and in low stress areas of the molding."*
- Regla #2: *"larger components such as sleeves, slides, lifters, and stripper plates may be strategically used such that their witness lines coincide with features of the molding"* → **hacer coincidir la línea de testigo con una arista/feature existente = testigo invisible.**
- Regla #3: si un lado debe estar 100% libre de marcas ⇒ **expulsión inversa (§13.9.4)**, todo el sistema en el lado fijo junto con el sistema de alimentación.

**§11.1.7 Minimizar complejidad y costo**
- *"the mold designer and mold maker should be sure to key and label each ejector pin so that they can be readily maintained by the molder."*
- *"The mold designer should not just consider the initial design and tooling costs, but the operational, maintenance, and failure costs as well."*

### 11.2 — El proceso de diseño del expulsor (6 pasos, en orden)

**§11.2.1 Identificar superficies de partición** → sin socavados = 1 plano; con socavados internos/externos = planos adicionales + componentes de accionamiento; si es muy grande → split cavity (§13.9.1).

**§11.2.2 Estimar fuerza de expulsión**
`Feject = μs · cos(φ) · E · CTE · (T_solidificación − T_expulsión) · A_eff`
- μs: *"from 0.5 for highly polished surfaces (with low surface roughness) to more than 1.0 for rough and/or textured surfaces"*.
- **A_eff NO es el área proyectada** — es el área de sección transversal (como cortar la pieza en dos: la banda elástica alrededor del corazón). Para pieza compleja con costillas:
  `A_eff = h(2L + 2W) + n_wall·h·H_part + n_rib·h_rib·H_rib`
- Razonamiento que él muestra explícitamente: cortar solo A-A no basta, ni A-A + B-B; hay que sumar la sección C-C porque las costillas se jalan entre sí.
- *"the analysis is conservative… the use of this analysis for the ejection force should result in effective ejection system designs **without the use of safety factors**"* → **NO aplicar factor de seguridad encima; ya viene conservador.**
- **Excepción:** *"when a molder allows the molded part to remain in the mold and cool to low temperatures. In this case, the final temperature of the molding should be used as the ejection temperature which will result in significant increases in the predicted ejection force."*
- Verificación contra realidad: *"the ejection force provided by the machine is typically 2% of the clamp tonnage"*; sus estimaciones dan ~0.5% del clamp → orden de magnitud correcto. **Este es su gate de validación.**

**§11.2.3 Determinar área y perímetro de empuje**
- Compresión en el pin: `A_ejectors > Feject / σ_fatigue_limit`. *"Most ejector pins and sleeves are made of hardened materials, with fatigue limit stresses on the order of 800 MPa. A conservative mold design, however, may assume a lower fatigue limit stress of 450 MPa for P20."*
- Cortante en la PIEZA: `Ω_ejectors > 2·Feject / (σ_plastic_yield · h)` → *"the mold should be designed such that the perimeter around all the ejectors provides a shear stress less than one-half the yield stress of the material."*
- Defecto nombrado: *"the part can permanently distort near the pin (an effect known as 'push pin'), permanently warp, or even fracture."*
- **Conclusión de diseño:** *"for most molding applications, the design of the ejector system is driven more by the yield stresses exerted on the plastic molding rather than by the compressive stresses on the pin."* (En el ejemplo: 0.8 mm por compresión vs **2.23 mm** por cortante en la pieza.)

**§11.2.4 Especificar tipo, número y tamaño**
- Trade-off explícito (juicio):
  - **Pocos y grandes** → menos componentes y features que maquinar, más barato de fabricar Y MANTENER, esfuerzos bajos, menos pandeo.
  - **Muchos y pequeños** → colocación más frecuente ⇒ **venteo y expulsión más uniformes**; más flexibilidad para colocarlos entre líneas de agua, en corazones angostos, en paredes laterales o costillas.
- *"the above analysis only provides a **lower limit**… The mold designer can always add ejectors or increase the ejector size to improve the uniformity of ejection or reduce stress."*
- Catálogo de tipos: ejector pins, blades, sleeves, stripper plates, slides, lifters, angle pins, core pulls, collapsible cores, expandable cavities, split cavity molds.
- **Los dos motivos por los que rechaza su propio layout de 10 pines de 4.5 mm:** (a) *"there may not be enough ejectors at locations near where the molding will stick in the mold. In particular, the ribs and bosses will tend to shrink onto the core and so require nearby ejector pins"*; (b) *"only 1 mm of steel separates the ejector hole from the surface of the mold cavity. With high melt pressures, stresses will develop in the steel, deforming the ejector holes to be non-round, causing the ejector pins to bind. Eventually, cracks will propagate between the ejector hole and the mold cavity."*

**§11.2.5 Layout — DÓNDE van los pines**
- Principio: *"ejectors will be more effective when placed near the locations where the ejection forces are generated"* y *"when pushing on rigid areas of the molded part."*
- Antipatrón nombrado: *"A common but ineffective layout arises when ejector pins are uniformly distributed across the mold cavity"* → pin lejos de costilla y pared lateral ⇒ momento y deflexión antes de que despegue.
- **Regla de acero mínima:** *"To avoid excessive stress in the core insert due to the provision of the ejector hole, an allowance of at least **one ejector pin diameter** should be specified between the surface of the mold cavity and the surface of the ejector hole."*
- **Conflicto declarado con enfriamiento:** al acercar pines a la costilla puede que ya no quepa una línea de agua entre costilla y pared → *"the diameter of the ejector pins may be reduced slightly to allow the addition of a cooling line if desired."*
- **Pin bajo la costilla (ideal mecánico):** fuerza de fricción y de expulsión **en línea** ⇒ casi cero deformación. Problema: la costilla es más delgada que el pin ⇒ **"ejector pad"** (boss sólido sobre la costilla). *"Since the ejector pin pushes directly on the ejector pad, **no draft angle is required** so the ejector pad diameter can be maximized."*
  - Costo del pad: *"high volumetric shrinkage that can lead to sink on the aesthetic surface"* → alternativa: boss hueco expulsado con **sleeve** (mejor calidad, más caro).
- **Pines contorneados (contoured):** eliminan la necesidad del pad; el pin se alinea a un lado de la costilla, se contornea para empujar la cara superior y se extiende hacia abajo para empujar también el plano de partición. Permite espaciamiento compacto **sin cambiar la pieza**.
  - **★ El gotcha de longitud:** *"if the ejector pin is too short, then a gap will form… If this gap is larger than the thickness of a vent, then flash is likely to occur. Meanwhile, if the ejector pin is too long, then the pin will be compressed on mold closure. With repeated ejection cycles, the pin can fatigue and buckle. Given that the required length… is difficult to precisely determine due to the stack-up in tolerances across the mold assembly, the mold designer may wish to use a 'steel-safe' approach with multiple length adjustments. Alternatively, the mold designer may choose to place the ejector pin **within the mold cavity**… slight errors in the contour of the pin will be on non-aesthetic surfaces."*

**§11.2.6 Detallar (holguras y ensamble) — los números duros**
- **Venteo:** *"typically a clearance of 0.02 mm (0.001 in) is provided for a length of the order of two to three diameters of the ejector pin. Afterwards, the ejector hole should step to a larger size so as to not restrict the sliding of the pin."*
- *"A chamfer should be provided from the larger diameter to the venting diameter. Otherwise, the ejector pin would tend to hang up on the sharp corner during mold assembly."*
- **Holgura mayor:** debe absorber desalineación entre placas. *"The specified clearance should exceed the total stack-up of the holes' positional tolerances across the mold plates. Since typical drilling tolerances are on the order of 0.25 mm, a clearance of **0.5 mm** should be sufficient in most molding applications."*
- *"a generous chamfer should be provided at the interface between the core insert and the support plate"* (guía el pin durante el ensamble).
- **Placa retenedora:** contrabarreno para jalar la cabeza del pin lejos del plano de partición al retroceder; *"the counterbore is provided a generous tolerance so that the axes of the ejector pins are governed by the mating of the pin with the reamed ejector hole in the core inserts"* → **la posición la manda el barreno rimado del inserto, no el retenedor.**
- **Pin contorneado:** cabeza con plano (flat) + ranura paralela + dowel localizador en el retenedor para mantener la **orientación angular**.
- *"Whenever possible, the mold designer should specify the same length and diameter of ejector pins to facilitate mold assembly and maintenance."*
- **★ La regla anti-error humano:** *"The mold designer should **always avoid designing ejector pins that vary only slightly in their design**, since similar pins may accidentally be considered interchangeable by the molder. The incorrect assembly of ejector pins may cause damage to the pins as well as the opposing mold cavity surfaces."* + *"key and label each ejector pin **and matching location on the ejector retainer plate**."*

### 11.3 — Los tipos de expulsor: CUÁNDO cada uno

**§11.3.1 Ejector pins (el default)**
- Fabricación: *"hot forged and cylindrically ground from hard steels (such as H13). Subsequently, the pins are nitrided and polished."* Estándar: **Ø1 a 25 mm, largo 150 a 500 mm**. El moldero los corta y rectifica al largo/contorno final.
- *"especially long pins with small diameters should be avoided"* (pandeo). Modelo Euler con extremo superior soportado por el barreno y extremo inferior articulado en el retenedor: `Fbuck = π²EI/(0.7L)²`, `R > (F·L²/63.2E)^(1/4)`.
- *"The mold designer should perform analysis for their molding application to confirm the driving constraint"* — cuál de las 3 restricciones (compresión / cortante en la pieza / pandeo) manda **depende del largo del pin**; en su ejemplo dieron el mismo orden de magnitud.
- **Pin escalonado (stepped):** si el diámetro mínimo por pandeo es mayor al deseado por estética/posición. *"Step pins typically have a shoulder approximately 1 mm larger in diameter than the head of the ejector pin, and a typical shoulder length of 50 mm."* Ojo: *"ensure that a suitable hole and clearance is specified in the support plate and core insert."*

**§11.3.2 Ejector blades — CUÁNDO: directamente bajo costillas**
- Ventajas: aplica la fuerza donde se genera la fricción; la costilla es rígida; **la costilla no es superficie estética** — *"though this is a potential area of stress concentration during the molding's end-use."*
- *"the thickness of the ejector blade should be set to the full thickness of the rib"* (y "usually set to the thickness of the opposing rib or wall").
- Requiere **EDM de hilo o de penetración** para el barreno rectangular. *"The amount of EDM can be minimized by specifying the clearance hole close to the surface of the mold cavity, with a typical **land length equal to twice the width of the ejector blade**."*
- **★ Regla de servicio:** *"The mold designer should also ensure that the length of travel between the ejector blade's tapered shoulder and the narrowed hole in the mold insert **exceed the maximum stroke of the ejector system**. Otherwise, the molder may inadvertently seize and damage the ejector blades."*
- Compresión y cortante normalmente NO gobiernan; **pandeo sí** (I = W·H³/12; `L < (1.7·E·W·H³/F)^(1/2)`).
- Si sale marginal (93 mm calculado vs 93.8 mm real): *"add additional blades to reduce the ejection force per blade, use a wider or thicker blade if available, or use a push pad with a constant rectangular section through the rib to allow for the use of a thicker ejector blade."*

**§11.3.3 Ejector sleeves — CUÁNDO: bosses cilíndricos**
- *"very effective components for part ejection, since they push on a stiff portion of the part at a location where friction forces between the molding and the core occur."*
- Core pin **asentado en la placa de sujeción trasera y fijado con un tornillo prisionero de cabeza hueca (socket head set screw)**; recomendado **altamente conductivo**.
- Sin problemas de esfuerzo ni pandeo, pero: *"the wall thickness and concentricity of the molding around the core pin is governed by the tolerance stack-up of the ejector hole, ejector sleeve, and core pin. **To reduce dimensional variations in the molded part, clearances for venting should be minimized.**"*
- *"The mold designer should ensure that the core pin has a suitable clearance through the ejector plate and ejector retainer plate, otherwise a slight lack of concentricity between the ejector sleeve and core pin may cause the sleeve to bind."*

**§11.3.4 Stripper plates — CUÁNDO: empujar todo el perímetro**
- Reemplaza la placa B y **flota** entre placa A y placa de soporte. Corazones localizados con dowel al centro + SHCS a la placa de soporte.
- *"the ejection forces are uniformly distributed across the moldings resulting in low imposed stress, little deformation, and reliable ejection."*
- Simplificación posible: con actuación por stripper bolt en la apertura, *"the ejector retainer plate, ejector plate, and leader pins serve no purpose and can be eliminated… such that the support plate may be used as the rear clamp plate."*
- **El conflicto de la línea de partición (juicio puro):** el mejor punto estructural para el contacto stripper↔corazón (el centro del domo redondeado) *"would result in an undesirable and possibly sharp witness line"*; moverlo hacia adentro mejora el testigo pero *"results in a sharp edge at the parting line of the stripper plate. This sharp edge can damage the vertical surface of the core insert, and will likely quickly wear. For this reason, the mold designer may wish to **avoid the use of a stripper plate or request the redesign of this section of the cup to provide a flat push area**."* → **volver al diseñador de producto es una salida legítima.**
- **Balance de fuerzas:** *"unbalanced ejection forces can lead to uneven wear in the mold. To minimize this wear, the thickness of the stripper plate and the size of the guide bushings can be increased. Additionally, the stripper plate should be actuated at **two locations that are in-line with the axis of the cavities** instead of one central point."*

**§11.3.5 Deformación elástica sobre socavados**
- `ε = δ/L`. *"most plastics have a strain to yield above 2%, which is a reasonable mold design guideline. The exception is heavily filled materials, which have a lower elastic limit and tend to fail in a brittle manner."* (Apéndice A tiene "Strain to yield (%)" por material: ABS 2, acetal 12, PA66 35, PA66-33%GF **3**, PS-30%GF **1.2**.)
- 1.3% de deformación → *"significant but not excessive"*.
- *"stripper plates are ideal for such ejection since they provide very uniform ejection forces that are nearly in-line with the friction force."*
- `Feject = μs·cos(φ)·E·(δ/L)·A_eff`; luego verificar cortante `τ = Feject/(π·φ·h)` contra el yield del plástico.

**§11.3.6 Core pulls / side actions — CUÁNDO: socavados grandes y complejos**
- Se usan cuando *"might otherwise not be economically feasible to produce"*.
- Layout del inserto móvil: **chaveta (key) perfilada en el fondo** con chavetero en placa B e inserto (retención vertical + guía); **chaflán en las aristas de ataque** *"to avoid damaging the mating surfaces of the mold"*.
- *"Any significant vertical displacement would cause flashing along top of the molding or the bottom of the rib. For this reason, an **interlock** has been provided between the front of the moving core and the core insert to prevent the moving core from shifting due to the pressures imposed by the melt."*
- *"a clearance has been provided between the front surface of the moving core and the core and cavity inserts. This clearance ensures that **entire clamping force of the actuation cylinder is applied to the window core** to prevent flashing of the window."*
- Fuerza: `F = P_melt · A_proyectada_del_corazón`, *"conservatively assume a melt pressure of 200 MPa"* → 44 kN ≈ 4 toneladas. *"the moving core must provide a closing force equivalent to the clamp force required for the production of a similarly sized molding."*
- **Por qué hidráulico:** *"hydraulic actuators have a power density an order of magnitude above that of pneumatic or electric"* ⇒ más compactos, baratos, amplia gama de diámetros y carreras, y *"easily integrated with the hydraulic and electric systems on many molding machines"* (sin equipo auxiliar).
- Presión disponible: *"most hydraulic systems are designed for a pressure of 20.7 MPa (3,000 psi), **many molding machines and auxiliary systems are operated at 10 MPa**"* → diseñar con 10 MPa. `D_bore = sqrt(4F/(π·P_fluido))`. Luego **redondear a cilindro estándar** (75 mm calculado → 82.55 mm / 3.25 in, carrera 25.4 mm).
- *"The travel must be sufficient for the moving core to clear the envelope of the features of the molded part."*
- **Risers (elevadores):** *"must be of sufficient strength to avoid flexure under load"*; reducir su altura es deseable *"since it reduces interference with the actuator, molding machine, and operator"*; se pueden eliminar acortando el corazón móvil y dejando que el vástago viaje dentro del perfil chaveteado.
- *"the cylinder attachments must be located on **only one side** of the mold."*
- **Seguridad y robustez:** *"the mold designer should specify the use of limit switches to confirm that the moving core is in its forward or retracted position."* Y **★**: *"the mold designer should strive to design the moving core such that the mold opening or part ejection **does not damage the mold if the moving core is improperly positioned**… such events do occur and molders greatly appreciate a robust mold design that can withstand intermittent abuse without reworking the ejector pins, blades, sleeves, or moving cores."*

**§11.3.7 Slides (angle pin) — CUÁNDO se prefieren sobre core pull**
- *"core pulls require actuators, auxiliary control, and significant space. For this reason, mold designers often prefer to use sliding cores that are actuated by inclined angle pins."*
- Componentes: **gib de bronce** en la placa B (superficie deslizante lubricada), localizada con dowels y sujeta con SHCS; **heel block**; **angle pin insert** con cara plana para orientar el pin; placa retenedora para que el slide no se caiga del gib.
- **Reparto de fuerzas (importante y contraintuitivo):** el **heel block** da la fuerza lateral que aguanta la presión del melt; el **inserto de cavidad** al cerrar da la fuerza de sujeción hacia abajo (evita flash en la línea de partición); ***"the angle pin does not provide the lateral force and is not subjected to significant stress in this design."*** El angle pin **solo mueve**, no sostiene.
- *"Well designed clearances, tolerances, and fits are crucial to the function and longevity of the sliding core."*
- Fricción: *"the bronze gib may be drilled and filled with graphite lubricant."*
- **Límite duro del ángulo:** *"the inclined angle… between the axis of the angle pin and the mold opening direction is limited to about **20 degrees**."* `S_slide = L_angle_pin · sin(φ)`. Añadir **~25 mm extra** de longitud para acoplar el pin al inserto; se corta a medida y se termina durante el ensamble.
- **★ Modo de falla humano previsto:** *"a curious operator or visitor may be intrigued with a mold in a molding machine, and naively move the sliding core. If the mold closes with the core not in its outwards position, then the angle pin will improperly contact the top surface of the slide… and cause the angle pin to bend under even a relatively low mold closing force."* Mitigaciones: **resorte de compresión** entre el frente del slide y el inserto para mantenerlo afuera cuando el molde está abierto; **limit switch** en la placa retenedora; *"If multiple sliding cores are used, then the multiple switches can be **wired in series**."*

**§11.3.8 Retorno de expulsores — cuándo cada esquema**
- **Base (default):** return pins accionados por el cierre del molde. *"this design is simple and reliable"*.
- **Retorno temprano** (algunos moldeadores lo exigen), dos formas comunes:
  1. **Retorno positivo con knock-out rods roscados al ejector plate.** *"the molding machine's ejector knock-out system are typically instrumented with position transducers, so positive return provides feedback as to the actual position of the ejection system prior to mold closure."* → *"the mold designer should **confirm the location(s), diameter, and thread of the knock-out rods with the molder**."*
  2. **Resortes de compresión** entre placa de soporte y retenedor. Reglas:
     - *"a support pin should be used in the center of the compression spring to avoid spring buckling **when the free length of the spring exceeds four times the diameter of the spring**; the support pin should be threaded into the support plate or rear clamp plate to locate the spring."*
     - *"the range of spring compression should be limited to about **40% of the free length**."*
     - *"The diameter and gauge of the spring should be selected to provide a return force that is a fraction (for example, **one-fourth**) of the required ejection force."*
- **Veredicto (juicio):** positivo > resortes, por 4 razones: (1) da retroalimentación de posición; (2) requiere menos cambios al molde; (3) los resortes limitan la carrera y *"can be damaged or cause damage if the molding machine forces the ejector assembly beyond the compression spring's range of free travel"*; (4) *"compression springs and ejector systems tend to wear such that molds with compression springs frequently fail to completely return the ejector system after an indefinite number of molding cycles."*
- *"In either case, if early return of the ejectors needs to be guaranteed prior to mold closure, then the mold designer should include a **limit switch that is active when the ejector system is fully reset**."*
- Otros métodos existen (cilindros neumáticos/hidráulicos, motores/solenoides, levas mecánicas) pero *"are less common and so are not detailed."*

### §11.4 — Criterios de aceptación del capítulo
Orden canónico confirmado: **planos de partición y direcciones de expulsión → (si >1 dirección: planear core pulls/slides ANTES del detalle) → estimar fuerza → número/tamaño/ubicación para no exceder esfuerzos → detallar**. Checklist: entender sistemas básicos; entender los objetivos; identificar planos de partición y direcciones; estimar fuerzas; estimar área y perímetro requeridos; especificar tipo/número/tamaño/ubicación (rectos, contorneados, escalonados, blades, sleeves); detallar para evitar interferencias y facilitar el ensamble; diseñar contra pandeo; entender stripper plates, core pulls, slides.

---

## CAPÍTULO 12 — SISTEMA ESTRUCTURAL

### 12.1 — Los 3 objetivos y cómo se fija el esfuerzo límite

**§12.1.1 Minimizar esfuerzo**
- Mapa de esfuerzos: lado **fijo** = cavidad soportada por top clamp plate y platina ⇒ **compresión pura**, poca flexión. Lado **móvil** = el hueco del ejector housing no soporta los corazones ⇒ compresión + cortante ⇒ **flexión significativa de placa**. *(Esto es lo que decide dónde hay que analizar.)*
- `σ_Mises = sqrt(σ1² − σ1σ2 + σ2²) < σ_limit`.
- **Dos métodos MUTUAMENTE EXCLUYENTES para fijar σ_limit:**
  - (a) σ_limit = σ_yield **+ escenario de peor caso** (presión de melt máxima que el molde vería, *"perhaps 200 MPa"*).
  - (b) σ_limit = σ_yield / f **+ presión esperada** (*"perhaps 100 MPa"*). *"Typical values range from **1.5 for non-critical mold components to 6.0 for hoist rings**."*
  - **★** *"To avoid over-designing the mold, the mold designer should **not jointly apply a factor of safety with the worst case scenario**."*
- **Fatiga manda a la larga:** *"For most steels, the endurance stress is approximately one-half the yield stress."* (P20: yield 830, endurance ~450-456.)
- **★ El aluminio no tiene límite de resistencia:** *"QC7 (and all known aluminums) do not exhibit an endurance stress limit… the continued cycling of any stress on aluminum will eventually cause failure due to fatigue. For this reason, the mold designer working with aluminum should carefully select the limit stress according to the desired number of molding cycles."* Tabla implícita para QC7: **<1,000 ciclos → 545 MPa; ~10,000 ciclos → 370 MPa; 1,000,000 ciclos → 170 MPa.**
- Síntesis: `σ_limit = min(σ_yield/f, σ_endurance)`. → **La vida esperada del molde (número de ciclos) es una ENTRADA de diseño, no un resultado.**

**§12.1.2 Minimizar deflexión** — *"excessive mold deflection is an even greater concern in many molding applications"*
- Criterio de falla real: **flash**. En el ejemplo, corazón 0.24 mm + cavidad 0.12 mm = **0.36 mm de separación** contra un venteo de **0.02 mm** ⇒ flash garantizado ⇒ *"The mold design must be improved."* → **El umbral de deflexión aceptable se compara contra el espesor del venteo, no contra un número abstracto.**
- Nota al pie valiosa: *"Mold designers and molders usually assume platens to be flat and infinitely rigid"* — pero la platina fija deflectó 0.04 mm, **el doble** que la móvil (porque el ejector housing transfiere carga hacia las orillas de la platina móvil).

**§12.1.3 Minimizar tamaño**
- **★** *"all steels have nearly the same elastic modulus, around 200 GPa. As a result, the mold designer **can not change the deflection by steel selection**, but rather must resort to changing the geometry."* → Cambiar de P20 a H13 sube el esfuerzo admisible pero **NO reduce la deflexión ni un micrón.**
- *"the stiffness of the mold plates is related to the **cube** of the plate thickness"*, pero placas gruesas ⇒ molde pesado, caro, y *"a stack height that limits the availability of molding machines."* → El grosor de placa se paga en **disponibilidad de máquina**.

### 12.2 — El orden de verificación de placas

**§12.2.1 Compresión de placa**
- Placas comerciales: *"oversized with a slight (1 mm) stock allowance, or finish ground to tolerances on the order of ±0.02 mm."*
- *"Deflection due to compression is not usually an issue since 1) it is relatively small and 2) it is uniform across the mold. As such, it does not cause flashing."*
- **Excepción con acción:** *"the mold designer should slightly increase the depth of the mold cavity to compensate for plate compression if a tight tolerance is specified on the thickness of a part with a deep cavity."*
- Atajo: tratar el molde como bloque monolítico. *"In actual molding, the total mold deflection may be **twice this amount** since the rails on the sides of the ejector housing will exhibit a significantly higher state of stress."*
- Área de soporte alrededor de la cavidad: **restar cavidad, leader pins y guide bushings** *"since these components do not transmit any of the clamping force."*
- La altura de cavidad bajo clamp cambia ~0.002 mm y además *"the melt pressure… will tend to counteract the mold clamping force"* ⇒ despreciable.

**§12.2.2 Flexión de placa**
- `A_shear = (2W_cav + 2L_cav)·(H_placaB + H_soporte)`; `δ = F·L³/(48·E·I)`, `I = W·H³/12`.
- **Elecciones conservadoras declaradas:** carga puntual central *"to provide a conservative estimate"*; ancho en flexión = ancho de la cavidad; claro libre = distancia entre caras internas del ejector housing.
- *"This deflection is roughly twice the 0.024 mm… from the finite element analysis… The presented analysis will tend to over predict… but is on the correct order of magnitude and should lead to robust mold designs."* (carga puntual vs distribuida = **+60%**).
- **★** *"the effective plate thickness, H, **should not include the thickness of the cores** when the cores do not contribute significantly to the stiffness of the mold assembly."*
- Multicavidad: *"the analysis should be applied to separate portions of the mold cavity"* — agrupar (p.ej. 3 cavidades) y usar el ancho efectivo de ese grupo.

**§12.2.3 Pilares de soporte**
- *"support pillars are best placed directly under the portions of the mold cavity that generate significant force."*
- Montaje: holgura pasante por ejector plate y retainer; pilar localizado con **dowel** al rear clamp plate; queda fijado al atornillar support plate ↔ rear clamp plate con SHCS.
- **Conflicto declarado:** *"the location of support pillars can conflict with other components including the ejector pins and the ejector knock-out rod(s). For this reason, different layouts and sizes of support pillars should be analyzed. **If mold deflection is a critical issue, then the ejector layout can be adjusted to provide space** for several large support pillars at ideal locations."* → **La deflexión gana sobre el layout de expulsión, no al revés.**
- Antipatrón: **un solo pilar grande al centro** — *"will not greatly reduce the deflection… since the majority of the plate bending will occur due to the loading on the left and right sides"* y *"could conflict with the use of a centrally located ejector rod from the molding machine, which is quite common."*
- Superposición obligatoria (el pilar mismo se comprime): `δ_total(x) = δ_comp·(1 − x/L) + δ_bend·(3L²x − 4x³)/L³`; `δ_max = max(δ_comp, δ_comp/2 + δ_bend)` → el máximo ocurre **o en el centro del pilar o a media distancia entre pilar y riel**.
- Iteración mostrada: Ø37.5 mm → 297 MPa y 0.13 mm (> 0.1 mm objetivo) ⇒ **subir a Ø50 mm** → 167 MPa y 0.07 mm.
- **★ PRE-CARGA DE PILARES (el truco de artesano):** *"the deflection due to compression could be greatly reduced by **pre-loading** the support pillars. Specifically, support pillars of 88.97 mm (88.9 mm plus the 0.07 mm) can be used such that the pillars compress to their nominal 88.9 mm (3.5 in) length **so that cavity becomes flat during molding**."* → Se fabrica el pilar **más largo por exactamente la deflexión calculada** para que bajo carga el molde quede plano.
- Nota de economía: *"the thickness of the B plate and/or support plate could be slightly reduced while still meeting the deflection requirement"* → después de meter pilar, **regresar a adelgazar placas**.

**§12.2.4 Cortante en paredes laterales (la "cheek")**
- *"A common guideline in the mold design is that the width of the cheek should be equal to the height of the mold cavity."*
- Verificación: `τ = P·H_cavity/W_cheek < σ_limit/2` ⇒ `W_cheek > 2·H_cavity·sqrt(P/σ_limit)`. Para SAE4140 (endurance 412) a 150 MPa ⇒ `W_cheek > 0.73·H_cavity`. *"Accordingly, the rule of thumb that the width of the cheek should equal the thickness of the cavity provides a slight factor of safety under typical assumptions."*
- *"Even though the shear stress may not exceed the specified limit, the mold designer should **also verify the deflection** of the side wall under load"*: `δ = 3·P·H_cavity⁴ / (2·E·W_cheek³)` (viga simplemente apoyada, carga uniforme). Ojo: **cuarta potencia de la altura.**

**§12.2.5 Interlocks (cuando la cheek sale muy cara)**
- Disparador: *"The mold designer could increase the width of the cheek… However, this approach adds significant size and expense. Another alternative is to use interlocks."*
- *"Both types of interlocks should be placed **on the parting plane and as close to the mold cavities as possible**."*
- **Redondo vs rectangular:** *"the rectangular interlock will provide greater resistance to deflection due to its larger size and cross sectional area. However, round interlocks are available in smaller sizes and are **easier to install**."*
- *"the **largest** interlock should be used that can be readily incorporated into the mold design."*
- **★ Advertencia:** *"It is important that the mold designer **does not jeopardize the structural integrity of the side wall by removing excess mold material when incorporating the interlocks**."* (El remedio puede ser peor que la enfermedad.)
- Efecto: *"The use of the interlock effectively **doubles the stiffness of the side wall**, resulting in a halving of the amount of the side wall deflection."*
- Montaje: macho en barreno pasante de la placa B; hembra en cajera ciega de la placa A (más profunda); ambos con ajuste apretado a las placas y retenidos en altura con SHCS.
- Cálculo: *"A conservative estimate is that **half of the force** will be carried by the interlock"*: `F_lateral = 0.5·P·φ_interlock·H_cavity`; `τ = F/A`. *"If the interlock is made of S7 tool steel, then the design should provide a shear stress less than **300 MPa**."*

**§12.2.6 Concentraciones de esfuerzo (líneas de agua y barrenos de expulsor)**
- `K = 3.1 + 0.75·(φ_hole/H_hole)^2.29`, con H_hole = distancia de la superficie de cavidad al **centro** del barreno.
- **★ El piso de K=3:** *"a stress concentration of **3 results even when a hole is located far from the cavity surface**. This explains why many molds develop cracks emanating from the waterlines in molding applications with high melt pressures, even when the cooling lines are located far from the cavity surface."*
- Consecuencia de material: *"molding applications with high melt pressures should be constructed of materials with high endurance stresses such as **A6, D2, or H13**."*
- Despeje: `H_hole = φ_hole·(0.75/(K−3.1))^2.29`, con `K_admisible = σ_endurance / σ_nominal`.
- **Jerarquía de riesgo (juicio):** *"Cooling lines seem to cause more significant problems than ejector holes in practice. Cracks emanating from cooling lines will eventually **leak and cause quality issues**. By comparison, cracks emanating from ejector holes may not ever cause a catastrophic failure… the deformation of the ejector hole under load can cause the plate around hole to be supported by the ejector, thereby reducing the stress… cracks propagating from ejector holes will reach a critical length at which point the elastic deformation of the core insert onto the ejector **prevents further crack propagation**."*
- Modo de falla del expulsor por deformación del barreno: la deflexión del barreno (0.03 mm estimado) es **del orden de la holgura de venteo** ⇒ *"Over many molding cycles, the hole will plastically deform and cause **binding of the ejector pin**."*
- **Autocrítica del método:** FEA dio 0.10 mm contra 0.03 mm analítico. *"The reason… was that the close proximity of hole to the cavity surface caused **local bending at the top of the hole**, which was not considered in the analysis."* → el analítico subestima cuando el barreno está muy cerca de la cavidad.

### 12.3 — Corazones

- **Umbral de clasificación:** *"a core can be considered **shallow** when the height of the core is less than **both** the width and length of the core."* Shallow ⇒ tratar como placa (§12.2). Deep ⇒ análisis propio.

**§12.3.1 Compresión axial**
- **★ La suposición conservadora de oro:** *"It may appear that the cooling insert… will fully support the core insert. While this may be fine in theory, a more robust design may be provided by **assuming that the cooling insert provides no support**. There are two reasons… First, the outer surfaces of the cooling insert may not tightly fit the inner surfaces of the core insert. **Any gap greater than the deflection of the core will completely prevent the cooling insert from supporting the core.** Second, the cooling insert may be made from a different material… may not be able to withstand the stresses imposed."*
- Esfuerzo sobre el área **anular** de pared, no sobre el área proyectada. `δ_total = δ_compresión_paredes + δ_flexión_cara_superior` (superposición).
- Lectura del resultado: 216 MPa ⇒ *"indicating that a **mild steel or aluminum should not be used** in this application when considering the cyclic loading and possible fatigue."*

**§12.3.2 Esfuerzo circunferencial (hoop) en corazón hueco**
- `σ_hoop = P·φ_core/(2·h_core)`; `h_core > P·φ/(2σ_limit)`; `φ_inner < φ_core·(1 − P/σ_limit)`.
- **Reglas de dedo para P20 a 150 MPa:** `h_core > φ/6` y `φ_inner < (2/3)·φ_core`. *"In practice, the mold designer should customize the above analysis by utilizing the maximum melt pressure and endurance stress that are specific to the molding application."*
- **★ DOS cargas hay que revisar, no una:** (1) fatiga a la presión de operación con σ_endurance; (2) *"an **overpressure situation** wherein the molder accidentally injects the melt at the maximum pressure of the molding machine. A single cycle at too high a pressure could cause the core insert to fail"* → 200 MPa contra σ_yield. En el ejemplo QC7: fatiga da 31 mm, overpressure da 38 mm ⇒ *"cyclic fatigue is a more critical issue than yield in an overpressure situation"* ⇒ manda 31 mm.

**§12.3.3 Flexión de corazón**
- `δ = ΔP·φ_core·H_core⁴/(8EI)`; `I = π(φ_core⁴ − φ_inner⁴)/64`.
- **Efecto auto-reforzante:** *"a slight bending of the core facilitates more melt flow and pressure to the thicker portion of the cavity and further bending of the core."*
- **Cómo estimar ΔP (la regla de dedo, no hay fórmula):** corazón corto → *"perhaps 50% of the filling pressure"*; corazón largo relativo a su diámetro → *"perhaps 10% of the filling pressure"*. *"However, the core deflection is proportional to the **fourth power** of the core height, so a small asymmetry of the melt pressure can cause a large deflection."*
- "Muy esbelto" = *"a core length on the order of **ten times** the core diameter"* → ahí hasta un centro-inyectado se dobla.
- **Escalera de remedios, en orden:**
  1. *"utilize solid cores with a minimal length to diameter ratio"*
  2. *"When possible, slender core pins should be **interlocked with the stationary side** of the mold… Such interlocking of the core pin reduces the lateral deflection of the pin to approximately **10%** of the deflection for a pin that is supported on only one end."*
  3. Si no se puede interlockear ni engrosar: *"the mold designer should **strongly recommend** using a center gate at the top of the corner or **two opposing gates** at the bottom of the core to minimize the pressure gradient."* (← vuelta al sistema de alimentación)
  4. **Flow leaders**: canalizan el flujo y el material entra a las secciones delgadas adyacentes y **congela parcialmente**, atrancando el corazón antes de que se doble. *"The flow leaders shown on the core… may be undesirable as protrusions on the inner surface of the molded part if in contact with fluids. As such, the flow leaders may be integrated on the **outside surface** of the molding… set into the cavity insert."*

### 12.4 — Sujetadores: los tres tipos y su reparto de funciones
*"First, **fits** are used to tightly locate one component within another… Second, **locating pins or dowels**… These first two fastening methods only provide fastening across the length and width directions. To fasten the mold components together in the **height** direction, **socket head cap screws** are used."*

**§12.4.1 Ajustes (fits)**
- *"Since tight tolerances are required in molds, **interference fits are commonly used** to locate the mold components."* Un clearance fit permite ensamble fácil pero *"the precise location of components to remain unknown."*
- *"a rigid interference fit can result when the difference between the nominal dimensions is very small, **on the order of 0.01% of the nominal dimension**."*
- Método: `D = sqrt(W·L)` (rectangular → diámetro aparente); `λ = 0.001·C·D^(1/3)`. Base ANSI B4.1-1967(R1999), barreno lateral.
- Tabla 12.1 (coeficientes C, mm): LN1 (4.89 | hembra 0.00/4.93 | macho 5.67/9.05), LN2 (7.14 | 0.00/7.84 | 8.59/13.52), LN3 (12.22 | 0.00/7.84 | 13.67/18.60), FN1 (13.57 | 0.00/4.93 | 14.34/17.73), FN2 (22.02 | 0.00/7.84 | 23.47/28.41), FN3 (30.85 | 0.00/7.84 | 32.30/37.24).
- **Cuándo cada uno:** *"**Locational-interference fits (LN)** are used when the accuracy of location is critical and the components require lateral rigidity. However, locational-interference fits **do not provide significant retention force in the height direction**, so the components must be secured in the height direction to another component via screws."* *"**FN1 to FN3** correspond to **drive fits** with increasing interference and requiring increasing insertion forces. While drive fits provide semi-permanent assemblies, mold designs **usually provide screws or other means for positively retaining the components in the height direction**."* → **Siempre tornillos en altura, sea LN o FN.**
- **★ Verificación obligatoria de fuerza de inserción:** `σ = λ_interference·E/(2D)` (el 2 porque la interferencia también tensa la placa); `F_insertion = f·σ·(π·D·H)`, f≈1.0. En el ejemplo FN1 de 88.9 mm: **808 kN = 180,000 lb**. *"If a press is not available with this capacity, the mold designer can utilize a location-interference fit."* → **El ajuste "correcto" puede ser físicamente inarmable; hay que consultar la capacidad de prensa del taller.**
- *"it is desirable to provide a slight **taper along the leading edge** of the core insert to assist in alignment during assembly."*

**§12.4.2 Tornillos SHCS**
- *"the most common fastener used in molds. The primary reason is that socket head cap screws have been carefully designed such that the strength of the **head, threads, and bolt are matched**."*
- Geometría: *"the head height is equal to the thread diameter, and the head diameter is approximately **150% of the thread diameter**."*
- Resistencia: `F_tensile = 800 MPa · π·D_thread²/4` (DIN/ISO estándar).
- **Escenario de peor caso para los tornillos de sujeción de mitades:** *"Since this socket head cap screw is used in a critical application where **failure may result in loss of equipment or life**, a worst case scenario is assumed."*
  - Masa máxima del molde = bloque sólido de acero con las dimensiones exteriores (ρ=7800).
  - *"The worst case scenario occurs when the mold is clamped to **only one side** of the molding machine without the support of the moving platen, which may occur when the mold is being installed."*
  - *"the entire mass of the mold must be supported by **only one tightened screw**, which may occur if the other cap screws are not tightened."*
  - `F_screw = M·ng·g·(L_COG/L_screw)`, momentos alrededor del anillo localizador. **★** *"The coefficient ng relates to the number of gravities… and is usually set quite high for safety purposes. **Due to the shock of a crane, ng is set equal to 10.**"*
  - Resultado: 8.65 mm → **redondear arriba a M10 o 3/8"**. (La mold base traía 1/2" ⇒ *"Failure of cap screws in this mold base is not expected."*)

**§12.4.3 Dowels**
- *"**Cap screws should not be relied upon to locate mold components** given their relatively large radial clearances."*
- Tabla 12.2 (C, mm): LC1 (−4.16 | hembra 0.00/4.93 | macho −3.39/0.00), LT1 (−6.38 | 0.00/7.84 | −2.43/−2.51), LT3 (−0.73 | 0.00/7.84 | 0.72/5.65), LN1 (4.89 | 0.00/4.93 | 5.67/9.05).
- **Veredicto de selección:** *"Locational clearance fits [LC] are intended for parts that are typically stationary but can be readily disassembled… This fit provides the same order of tolerance as threaded fasteners, so is **not recommended for injection molds since the large clearance can allow accelerated wear of sliding surfaces**. Locational-transition fits [LT] provide for tighter control of location, but with the possibility of interference between the dowel and the hole which hinders the mold assembly."* → **LT3 es el default práctico** (es el que usa en el ejemplo).
- **★ Verificación de peor caso del dowel:** con LT3 el juego promedio es de 1.5 μm, pero en el peor caso hay 0.013 mm de interferencia ⇒ `F_insertion = 50 kN`. *"This magnitude of insertion force for a dowel is clearly undesirable since **separation of the mold plates can not be accomplished manually**. The mold assembler would require **grinding to reduce the pin diameter**."* → Hay que revisar el peor caso de la tolerancia, no el promedio, y preguntarse **"¿se puede desarmar a mano para dar servicio?"**

### §12.5 — Cierre e ITERACIÓN
- Jerarquía de restricciones: (1) no ceder ante una sobrepresión única; (2) no fallar por fatiga; (3) no deflectar en exceso (flash + desgaste acelerado de la línea de partición). *"Of these issues, **fatigue and deflection tend to dominate** though the relative importance is a function of the number of mold cavities, the molding pressures, the mold geometry, and the production quantity."*
- Principio general: *"all analyses indicate that increasing the amount of steel between the load and support points provides for lower levels of stress and deflection. As such, the mold designer must perform analysis to develop robust designs that are **not uneconomical**."*
- **★ LA ITERACIÓN DECLARADA:** *"In practice, the provision of fasteners may **interfere with other subsystems of the mold including part ejection and mold cooling**. In such cases, **iterative redesign of the mold may be required** to efficiently locate all the mold's subsystems without increasing the size and cost of the mold."*
- Checklist de capacidades (criterio de aceptación): describir el flujo de fuerzas cavidad→tie bars; relaciones módulo/esfuerzo/deformación y último/fluencia/endurancia; **especificar σ_limit y deflexión máxima según los requisitos de la aplicación**; estimar compresión, cortante y hoop; deflexión por compresión y por flexión de placa/corazón/pilar/pared; especificar espesor de placa y pilares; especificar cheek e interlocks; diseñar corazones contra hoop y flexión; **especificar la distancia mínima cavidad↔barrenos (agua y expulsores)**; especificar límites dimensionales para clearance/transition/interference/drive; estimar juego o fuerza de inserción; especificar SHCS.

---

## CAPÍTULO 13 — TECNOLOGÍAS DE MOLDE (cuándo recomendar qué)

### §13.1 — El árbol de decisión (Figura 13.1) — transcrito completo
Esto es literalmente el selector, de necesidad de negocio a tecnología:

```
Competir eficazmente
├─ MAYOR CALIDAD
│  ├─ Múltiples materiales
│  │  ├─ Plástico sobre otro material .......... INSERT MOLD
│  │  ├─ Plástico sobre plástico ............... MULTI-SHOT MOLD
│  │  └─ Plástico dentro de plástico ........... COINJECTION MOLD
│  ├─ Piezas huecas
│  │  ├─ Fluido dentro del plástico ............ GAS/WATER ASSIST MOLD
│  │  ├─ Plástico inflado ...................... INJECTION BLOW MOLD
│  │  └─ Interior complejo ..................... LOST CORE MOLD
│  ├─ Superficie estética
│  │  ├─ Superficie decorada ................... IN-MOLD LABELING
│  │  ├─ Superficie brillante/transparente ..... MOLD WALL TEMPERATURE
│  │  └─ Sin marcas de testigo ................. REVERSE EJECTION
│  ├─ Geometría compleja
│  │  ├─ Exterior complejo ..................... SPLIT CAVITY MOLD
│  │  ├─ Features interiores ................... ROTATING CORE MOLD
│  │  └─ Tolerancias cerradas .................. INJECTION COMPRESSION
├─ MENORES COSTOS
│  ├─ Mayor rendimiento (yields)
│  │  └─ Mejor control de flujo ................ DYNAMIC FEED / MELT FLIPPER
│  ├─ Mayor productividad
│  │  ├─ Mayor cavitación ...................... HOT RUNNER MOLD
│  │  ├─ Menor tonelaje de cierre .............. STACK MOLD
│  │  └─ Menos desperdicio de material ......... INSULATED RUNNER MOLD
│  └─ Menor costo de herramental
│     └─ Menor cavitación ...................... TWO PLATE MOLD
└─ MÁS RÁPIDO AL MERCADO
   └─ Herramental más rápido / alta velocidad ... PROTOTYPE MOLD
```

### Reglas transversales de cap 13

- **§13.2.2 Coinyección:** *"many conventional molds can be successfully used in a coinjection process since the mechanisms for coinjection are mostly integrated with the molding machine and not the mold itself."* Ajustes al análisis: *"in many coinjection applications, the mold will operate successfully if the mold is designed to fill completely with **only the more viscous material**"*; y para enfriamiento/contracción/expulsión *"a reasonable approach is to derive a **'meta-material'** that has material properties in proportion to the layer thickness of the two constitutive materials."* Ajuste deslizante cavidad↔corazón con guide pins/interlocks/keyways *"to avoid accelerated wear on the sliding surfaces."*
- **§13.2.3 Gas/Water assist — la regla contraintuitiva:** *"In most mold designs, the cavity wall thickness is made as uniform as possible… However, such a mold design will **not** lead to an effective mold for fluid-assist. The reason is that the gas or water will permeate or **'finger' in random directions** through a uniformly thick mold cavity, thereby weakening the molding without significantly reducing the part weight. As such, **thick flow channels are commonly added** to the mold cavity to direct the gas or water."* Objetivo del canal: *"as uniform a molded wall as possible while providing the necessary fluid flow and part stiffness."* Water assist: 3 ventajas (calor específico → menor ciclo, incluso circulando; incompresible → más presión con menos energía/riesgo; superficie interna más lisa) y 2 desventajas (hay que sacar el agua antes de abrir; humedad y corrosión ⇒ *"a corrosion resistant mold material such as **SS420** is recommended"*).
- **§13.3.1 Insert / compresión a baja presión:** *"In any molding process, the mold designer should **explicitly consider the handling of the molded parts upon de-molding**"* → cavidad inferior **más profunda** + **flash well** ⇒ la pieza se queda del lado de abajo, predeciblemente. **Ranuras** para asegurar el inserto contra el movimiento del molde y del flujo. Molde con ciclo térmico ⇒ *"the mold should be carefully designed to **minimize the size and thickness of the plates** so that energy consumption and cycle time are minimized."* La holgura de la superficie de flash no puede ser muy chica o el ritmo del proceso lo limita el flujo de salida.
- **§13.3.2 Control de línea de soldadura (knit line):** se puede **mover la posición de la línea de unión** poniendo temperaturas de pared distintas a cada lado del inserto (el lado más caliente avanza más rápido), + resistencia local que calienta arriba de Tg para fundir y fusionar la zona de la knit-line.
- **§13.3.3 Lost core:** el núcleo de bajo punto de fusión (aleación **58% Bi / 42% Sn**, funde ~138 °C) no se derrite durante la segunda inyección porque *"has sufficient mass to act as a heat sink"*; para plásticos de más temperatura *"both the mold and the lost core can be cooled."*
- **§13.5 Multi-shot, reglas generales:**
  - *"multi-shot molds may require **extended cooling times**… the first layer will largely prohibit the transfer of heat from the second layer to the mold. For these reasons, the mold designer should consider multi-shot molding using the analysis for **one-sided heat flow** (§9.3.5.6); **the second layer should be 40% thinner than the first layer to avoid extending the cycle time**."*
  - Doble filo del segundo disparo: *"provides the opportunity to utilize the second injection… to melt and wipe out small imperfections or witness lines on the first layer. Because of this effect, however, the mold designer **should avoid the placement of fine details** on the some surfaces of the first molding that may be degraded by the second injection."*
  - §13.5.1 Overmolding: **proyecciones** para subir área de contacto y resistencia de unión + resistencia lateral; **costilla que socava** el segundo material *"to ensure that the two pieces are not separable"*.
  - §13.5.2 Core-back: *"for strength reasons a **preferred design** would use a **single set of blades that interlock with a slot on the opposing face** of the mold cavity"*; *"structural analysis should be used to ensure that the blades are of sufficient thickness to avoid excessive shear stress and bending."* Y el hallazgo: una sección central retráctil grande **no** necesita fuerza de actuación enorme *"since the center section will not see significant pressure when molding areas 11 and 12, and can be **supported by a shoulder** or other mold components when retracted and exposed to high melt pressures."*
  - §13.5.3 Multi-station: *"compared to a core back mold design, the multi-station mold provides for **greater flexibility** in the molded part design"* — permite meter una pieza compleja en cavidades arbitrariamente complejas.
- **§13.6.1 Insulated runner:** *"the use of insulated runner systems has **decreased with the commoditization of hot runners**. Even so, insulated runners can provide good performance at low cost."* Experimentos: Ø runner ~25 mm, ciclos ~60 s, piel ~6 mm. Cambio de color se resuelve abriendo la sección de runner.
- **§13.6.2 Stack molds — CUÁNDO valen la pena (★ juicio de negocio):** *"the stack mold design requires carefully balancing of potential processing cost savings with issues related to **investment, maintenance, color change, stack height, and injection volume**."* Beneficio: dos (o 3-4) niveles de cavidades con **el mismo tonelaje de cierre y el mismo ciclo**. Los diseños viejos con sprue tenían 2 defectos: bebedero = scrap, y flujo desbalanceado por el largo extra; **hot runner los resuelve ambos**.
- **§13.6.3 Branched runners / Melt Flipper:** aun con balance geométrico ("naturally balanced") hay **desbalance térmico por cortante**: núcleo viscoso rodeado de una capa más caliente y menos viscosa; al ramificar, el material de baja viscosidad se queda del lado exterior. Remedio: **cambio de nivel justo antes de la rama** (inserto cavidad+corazón), que reorienta la variación de viscosidad **verticalmente**. Advertencia: *"Because the viscosity variation is only **reoriented and not eliminated**, the use of multiple level changing inserts at consecutive runner branches will **re-establish** the flow imbalances."*
- **§13.7 Control de temperatura de pared — cuándo se justifica:** solo para *"lenses, airplane cockpit canopies, optical storage media, and fiber reinforced materials"*, cuando la piel solidificada causa congelamiento prematuro, birrefringencia, o falta de brillo/réplica de superficie.
  - §13.7.1 Pulsed cooling: **dos fluidos separados** (uno caliente, uno frío) *"to reduce the cost and time associated with sequentially heating and cooling a single fluid"*. Éxito depende de **minimizar la masa de acero y refrigerante**: insertos delgados, líneas cortas, cámaras de aire (air gaps) y láminas aislantes contra las placas de sujeción. Economía: ~10 MJ = 3 kWh por ciclo ⇒ **~$0.30 USD por ciclo solo en energía** ⇒ *"pulsed cooling is not commonly used except in very demanding applications."*
  - §13.7.2 Conduction heating: **3 razones por las que fracasa** — (1) la presión cíclica fatiga los calefactores; (2) es difícil lograr temperatura de pared uniforme; (3) el calefactor queda entre cavidad y agua ⇒ **alarga el enfriamiento**. Cifra de dimensionamiento: hay que entregar ≥420 W solo para vencer la fuga hacia el agua antes de que suba la temperatura.
  - §13.7.3 Induction heating: ventana operativa estrecha — *"a heating power **less than 100 W/cm²** did not significantly increase the mold surface temperature and eventually caused the overload breaker to actuate. On the other hand, when the power output **exceeded 10,000 W/cm²**, the rate of the surface temperature increase became too steep to control… defects such as gloss irregularities, sink marks, etc. were observed with **temperature differences of more than 50 °C** across the surface."*
  - §13.7.4 Managed heat transfer (pasivo): capa aislante polimérica ~**0.25 mm** (poliimida, PAI, PA, polisulfona, PES, PTFE, PEEK) bajo un stamper de níquel. *"the mold designer and process engineer should intuitively understand that the addition of an insulating layer will tend to reduce the rate of heat transfer… and therefore require extended cooling times. To alleviate this issue, **the cooling lines can be operated at a lower temperature**."* Limitación: *"may be difficult to apply to complex three dimensional geometries."*
- **§13.8 In-mold labeling:** película ~**0.15 mm (5 mils)**, del **mismo material** que la pieza. Sujeción por adhesivo, aire comprimido, vacío o **carga estática**. *"The structural loading is driven by the **shear stress applied by the rate of the polymer melt flowing across the film and not the magnitude of the melt pressure**"* (usar §5.3.1). *"If the film is too thin, then the printed design may be destroyed by the complete melting and flow of the film."* Si la impresión no fusiona: *"the printing may be imperceptibly **dithered** to facilitate fusion."* Película indexada (§13.8.2) cuando el volumen es alto: resortes abren un hueco de ~**0.5 mm** entre cavity plate y top clamp plate para pasar la cinta.
- **§13.9.1 Split cavity — CUÁNDO:** *"If the section of the cavity with undercuts is **very large**, or if the exterior of the molded part necessitates a **parting plane that is transverse to the mold opening direction**."* (Si es chico → core pull o slide, §11.3.6-7.)
  - Confirma la regla del cap 12: *"the thickness of the cheek is approximately the same as the depth of the mold cavity, as suggested by the analysis of §12.2.4."*
  - **Desgaste (mantenimiento):** *"wear can be an issue in this mold design due to the **large mass of the inserts, the length of travel, and the high number of molding cycles**. For this reason, the **gibs should be specified to include lubricity and be easily replaced when necessary**. In addition, **wear plates should be incorporated** between the support plate and the cavity inserts."*
- **§13.9.2 Collapsible cores — CUÁNDO:** *"when the part design includes complex and undercutting surfaces on the **interior** of the part."* Comerciales: **Ø13 a 90 mm, colapso ≈ 6% del diámetro del corazón**; accionados por la placa expulsora deslizando los segmentos sobre un manguito retenedor (acción de leva). Limitación: *"one issue with collapsible cores is the formation of **witness lines on the interior** of the molded part where the core segments interface. Depending on the application requirements, these witness lines may prohibit the use of the collapsible cores."*
- **§13.9.3 Rotating cores (unscrewing) — CUÁNDO:** cuando hay **roscas internas** y el testigo del collapsible core no es aceptable.
  - Dos arquitecturas: **hélice de paso grueso** (*"a coarsely threaded helix is necessary since the **torque and wear will increase substantially as the pitch decreases**"*; el largo de la hélice depende de la fricción y del número de vueltas) vs **engranaje planetario** (sol + planetas + cremallera/piñón/cónicos). Trade-off: la planetaria *"decouple[s] the actuation of the rack and pinion from the rotation of the cores… possible to **delay and otherwise program** the rotation… while avoiding the very large stack height associated with the coarse helix."* Contras: número, complejidad y volumen de engranes; *"the planetary layout suggests a **radial layout of cavities** and so may require very large molds for a high number of cavities. Accordingly, the planetary gear design may be preferable in a mold with a **relatively low number of cavities requiring high actuation torques**."*
  - **Regla obligatoria:** *"the mold designer should ensure that the part geometry is designed to **prevent the rotation of the molded part with the rotating core**. In some cases, the runner and gate may provide sufficient strength… In other cases, however, this approach is inadequate since the ejection forces will tend to vary with the material properties, processing conditions, and surface finish. For this reason, the mold design may use some **small undercuts or other non-asymmetric features** to prevent the part rotation."*
- **§13.9.4 Reverse ejection — CUÁNDO:** cuando se requiere **una cara 100% libre de defectos cosméticos**. Problema que resuelve: el diseño convencional deja testigos de expulsor en el lado del corazón Y testigos del sistema de alimentación en el lado de cavidad. Costo: *"Since the molding machine's ejector rod is located on the moving side… and is **useless** with this mold design, the mold design also includes **hydraulic cylinders** for actuation of the ejector plate."*

### §13.10 — EL CRITERIO DE ACEPTACIÓN FINAL DEL LIBRO
**★** *"For many molding applications, however, the issue to be deliberated is **not what can be done but rather what should be done** for a specific application. The decision as to how to develop a mold design is for the mold designer, who must strive to serve the needs of the molder and end-user. For this reason, **critical decisions about the mold design and related technologies should be approved and documented between all the involved parties with a common understanding of the costs, benefits, and risks.**"*
→ El entregable no es solo la geometría: es un **registro de decisiones aprobado y documentado**, con costos, beneficios y riesgos explícitos, firmado por moldeador + cliente + diseñador.

---

## LOS 10 ★ (los que una máquina lineal se salta)

1. **§10.1.6 — Contracción cero o negativa NO es "excelente", es una ALARMA.** Se necesita contracción positiva para que la pieza se despegue de la cavidad y se agarre al corazón; sobre-empacada no sale de las costillas y los bosses. Un optimizador que minimice contracción produce un molde que no expulsa.
2. **§10.2.2 — Steel-safe tiene DOS caras y la segunda es de cronograma:** dejar bosses, snap-fits y detalles críticos **semi-acabados** hasta después del tryout. Se paga con tiempo de construcción, se cobra en tolerancia final. Y steel-safe **garantiza** retrabajo — por eso hay una escuela entera que prefiere el valor medio constante.
3. **§10.1.7 — Pedirle al moldeador que corra en SUS condiciones preferidas aunque las piezas salgan fuera de especificación**, y calcular la contracción de esas piezas. La contracción "correcta" es la del proceso que el moldeador realmente va a usar, no la del proceso nominal.
4. **§11.2.6 — Nunca diseñar pines de expulsión que difieran solo un poquito.** El moldeador los intercambiará por accidente y romperá el molde. Marcar y etiquetar cada pin **y su lugar en la placa retenedora**. Es una regla de diseño motivada por error humano, no por física.
5. **§11.2.5 — El pin contorneado corto = flash; largo = fatiga y pandeo.** El largo exacto no se puede calcular por el apilamiento de tolerancias ⇒ steel-safe con **múltiples ajustes de longitud**, o mover el pin adentro de la cavidad para que el error de contorno caiga en superficie no estética.
6. **§12.2.3 — Pre-cargar los pilares de soporte:** fabricarlos **más largos por exactamente la deflexión calculada** (88.97 en lugar de 88.9) para que bajo presión de inyección el molde quede PLANO. La deflexión no se elimina, se cancela.
7. **§12.3.1 — Asumir que el inserto de enfriamiento da CERO soporte estructural**, aunque geométricamente parezca que lo da. Cualquier holgura mayor a la deflexión anula el soporte, y el material puede ser distinto.
8. **§12.4.1 y §12.4.3 — Verificar la FUERZA DE INSERCIÓN y la desarmabilidad, no solo la tolerancia.** Un FN1 "correcto" puede pedir 808 kN (¿tiene prensa el taller?) y un dowel LT3 en su peor caso puede pedir 50 kN, con lo cual las placas ya no se separan a mano para dar servicio. El ajuste correcto en papel puede ser inarmable o inservible.
9. **§11.3.6-7 — Diseñar para el abuso:** que abrir o expulsar con un corazón mal posicionado **no destruya el molde**; resorte que mantiene el slide afuera contra el operador curioso; limit switches **en serie** para todos los corazones. Kazmer lo dice explícito: *"such events do occur and molders greatly appreciate a robust mold design that can withstand intermittent abuse."*
10. **§12.1.1 — Nunca combinar factor de seguridad CON escenario de peor caso** (sobre-diseño). Y el aluminio **no tiene límite de resistencia a la fatiga**: el esfuerzo admisible es función de la **vida esperada en ciclos** (QC7: 545 / 370 / 170 MPa a 1e3 / 1e4 / 1e6 ciclos), o sea que "clase de molde" es una entrada numérica del cálculo estructural.

*Casi-★ (mencionables):* §11.3.2 el recorrido entre el hombro cónico del blade y el barreno angosto debe **exceder la carrera máxima** o el moldeador atasca y destruye los blades; §12.2.2 el espesor efectivo H **excluye** el grueso de los corazones; §12.2.6 el factor de concentración **nunca baja de 3** por más lejos que pongas la línea de agua; §13.5 el segundo disparo debe ser **40% más delgado** que el primero.

---

## HUECOS: lo que pediste y NO está en los caps 10-13

Verificado por búsqueda exhaustiva sobre el archivo completo:

- **Ojos de izaje / hoist rings:** solo aparece **una** mención, y es como valor de factor de seguridad: *"Typical values range from 1.5 for non-critical mold components to **6.0 for hoist rings**"* (§12.1.1). No hay dimensionamiento, ubicación ni especificación de argollas.
- **Choque de grúa:** único dato relacionado, `ng = 10` *"due to the shock of a crane"* (§12.4.2), aplicado al peor caso de los tornillos de sujeción.
- **Placas de identificación / nameplates:** **no aparecen** en estos capítulos.
- **Straps de seguridad / bandas de transporte del molde:** **no aparecen**.
- **Interlock eléctrico de seguridad:** lo eléctrico que sí está es **limit switches** (core pull retraído §11.1.1; core pull adelante/atrás §11.3.6; slide afuera con switches **en serie** §11.3.7; retorno temprano de expulsores completado §11.3.8) — son de protección de máquina/molde y de secuencia, no de seguridad del operador.
- **Accesibilidad de mantenimiento:** existe pero disperso, no como sección: etiquetar/marcar pines (§11.1.7, §11.2.6), mismo largo y diámetro de pines para facilitar ensamble y mantenimiento (§11.2.6), gibs con lubricidad y **fácilmente reemplazables** + wear plates (§13.9.1), costos de operación/mantenimiento/falla en la decisión (§11.1.7), y la advertencia de que un dowel demasiado apretado impide separar las placas a mano (§12.4.3).
- **Clase de molde según vida esperada:** no hay una tabla tipo SPI Class 101-105. Lo que hay es el equivalente funcional y es mejor: **el número de ciclos objetivo entra directo en σ_limit** (§12.1.1), y define el material (§12.2.6: alta presión ⇒ A6/D2/H13; §12.3.1: 216 MPa ⇒ ni acero suave ni aluminio).

Si esos temas (izaje, placas de identificación, straps, seguridad eléctrica) son requisito del software, hay que buscarlos en los capítulos previos del libro — probablemente en el capítulo de mold base / componentes estándar (caps 3-4), no en 10-13.