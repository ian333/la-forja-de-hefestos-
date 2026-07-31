# RESPALDO — Experimento 'Kazmer es el cliente' (2026-07-31)

He leído el archivo completo (2,944 líneas: cap. 7 líneas 1–894, cap. 8 líneas 895–1356, cap. 9 líneas 1357–2839, y el arranque del cap. 10 en 2840–2944).

---

# ENTREVISTA CON EL CLIENTE — David Kazmer, caps. 7 / 8 / 9
## Lo que NO está en las ecuaciones

---

# CAPÍTULO 7 — GATING DESIGN (diseño de entradas)

## 7-A. EL PROCESO A MANO (secuencia real de decisiones)

Kazmer declara el proceso en §7.3 en **5 pasos**, pero antes fija **5 objetivos en conflicto** (§7.1) que son los que gobiernan cada juicio:

**Los 5 objetivos (§7.1) — el gate sirve a cinco amos a la vez:**
1. §7.1.1 Conectar runner → cavidad. *"the design of the gate provides a means by which the flow of the melt can be fine tuned through the adjustment of its location or dimensions"* — el gate es la perilla fina del llenado (ubicación **o** dimensión).
2. §7.1.2 Degatado automático.
3. §7.1.3 Degatado estético (testigo/vestigio).
4. §7.1.4 Evitar cortante y caída de presión excesivos.
5. §7.1.5 Controlar el tiempo de empaque (pack time).

**Los 5 pasos del proceso (§7.3):**
1. §7.3.1 **Determinar el TIPO** de gate (Tabla 7.1).
2. §7.3.2 **Calcular cortante** — pero primero *asignar dimensiones iniciales por regla de dedo* (ver abajo).
3. §7.3.3 **Calcular caída de presión**.
4. §7.3.4 **Calcular tiempo de congelamiento del gate** y compararlo contra el tiempo de empaque requerido por la pieza.
5. §7.3.5 **Ajustar dimensiones** (y a veces el tipo, y a veces el TIPO DE MOLDE).

**La regla de arranque que la máquina se salta (§7.3.2):** antes de calcular nada hay que *sembrar* dimensiones. Kazmer da la semilla explícita:

- Gates gruesos / cortante bajo-moderado (**sprue, edge, tab, fan, valve**): espesor inicial = **espesor de pared de la pieza en el punto del gate**.
- Gates delgados / cortante moderado-alto (**pin-point, flash, diaphragm, tunnel, submarine, thermal**): espesor inicial = **la MITAD del espesor de pared**.
- Gates tipo tira (strip) — ancho inicial:
  - flash y diaphragm → ancho = **la longitud de arista a lo largo de la cual se quiere flujo lineal** (para el diaphragm, la **circunferencia**).
  - los demás → ancho inicial = **2 × espesor del gate**, y de ahí se sube o baja para ajustar cortante.

---

## 7-B. §7.2 — CÓMO ELIGE EL TIPO (uno por uno, con pros y contras)

### §7.2.1 Sprue gate
- **Qué es:** el sprue descarga directo a la cavidad; el "gate" es la interfaz entre el fondo del sprue y el techo de la cavidad. **No tiene longitud → no tiene caída de presión.**
- **Cuándo:** moldes de **una sola cavidad** donde el bushing del sprue topa directo contra la superficie de la cavidad.
- **Pro:** dimensiones grandes → ΔP y cortante bajos → se pueden lograr **gastos volumétricos altos**.
- **Contra:** degatado difícil por el diámetro grande; **manual** con cortador; *"powered cutters are necessary for many applications with large sprue diameters or tough engineering materials"* (se requieren cortadores motorizados para diámetros grandes o materiales de ingeniería duros). Deja un **vestigio grande que puede estorbar al uso del producto**.
- **Regla de cálculo:** *"For the verification of the shear rate, the smallest diameter of the sprue should be used."* (para verificar cortante se usa el diámetro **menor** del sprue).
- **Dos remedios de diseño para el vestigio (Fig. 7.2 y 7.3):** (a) un **borde/reborde (rim) alrededor del perímetro de la base** para que el vaso siente plano después de quitar el sprue; (b) si no se quiere ese rim, un **rebaje (recess / gate well)** alrededor del sprue que dé claro al vestigio.

### §7.2.2 Pin-point gate
- **Qué es:** orificio cilíndrico pequeño.
- **Cuándo:** muy usado por su tamaño chico → **facilidad de degatado y vestigio mínimo**. Típico en **moldes de 3 placas** con sprue de **cono invertido (reverse taper)**; también en 2 placas para entrar a las **paredes laterales**.
- **Contra:** *"the flow of the melt through such a small orifice will incur high pressure drops and shear rates"*.
- **Reglas de dimensión:** *"The diameter ... should be specified so as to be large enough to avoid excessive shear rates yet small enough to provide the desired de-gating and aesthetics."* La **longitud es del orden de su diámetro**, y sólo tan larga como se necesite para poder **manufacturarla**.
- **Detalles obligados:** *"A properly designed pin-point gate will have a reverse taper between the cavity surface and the gate breakpoint"* (cono invertido entre la superficie de la cavidad y el punto de ruptura). Además: *"A smooth transition should also be designed between the gate and the sprue or runner"* (transición suave hacia el sprue/runner). Y opcional: recess en gate well para el vestigio.

### §7.2.3 Edge gate
- **Qué es:** variante estándar de runner frío a la **arista** de la cavidad.
- **Juicio de ubicación clave:** si el vestigio queda **interno al ensamble** (no lo ve el usuario), entonces *"the edge gate can and should utilize the full thickness of the adjacent wall section, and need not be gated underneath the lower surface of the frame"* (puede y **debe** usar todo el espesor de la pared adyacente; no hace falta esconderlo por abajo). **La estética sólo cuesta cuando se ve.**
- **Reglas de dimensión (prosa pura):**
  - Espesor: *"the thickness of the edge gate should be less than the wall thickness of the molding, but may approach the thickness of the molding if shear rates are a concern"*.
  - Ancho: *"should be less than the diameter of the runner but wide enough to avoid excessive shear rates"*.
  - Longitud: *"should be kept to a minimum, but long enough to provide the molding machine operator access for de-gating with gate cutters"* — **la longitud del gate la fija la MANO del operador con las pinzas**, no la física.
- Comparado con pin-point: cortante y ΔP **mucho menores**.

### §7.2.4 Tab gate
- **Qué es:** edge gate + una **pestaña/costilla que se queda pegada a la pieza para siempre**, puesta ahí sólo para poder gatear bien.
- **Cuándo (el disparador exacto):** cuando el edge gate entraría a una **sección delgada** — *"which can cause premature freeze-off of the flow and excessive volumetric shrinkage in the surrounding thicker sections"*. El tab conecta el runner con la **porción gruesa** de la pieza, saltándose el marco delgado.
- **Dimensión:** la costilla se hace **del espesor nominal de la pieza**.
- **Contra asumido conscientemente:** *"sink will likely develop on the top surface. However, this issue is not significant since this area is hidden by the screen assembly"* — **acepta un hundimiento porque queda oculto**.
- **La regla maestra:** *"The key to their effectiveness is to establish potential gating areas where their remnants will not affect the aesthetics or functionality of the resulting moldings. Once such gating areas are established, the mold designer should select whatever tab geometry and dimensions are appropriate."* Es decir: **primero se declara la zona de sacrificio, luego la geometría es libre.**

### §7.2.5 Fan gate
- **Qué es:** edge gate cuyo **ancho en la pieza excede el diámetro del runner**.
- **Cuándo:** (a) para evitar cortante excesivo a gasto volumétrico alto; (b) para producir **flujo LINEAL** en lugar del radial.
- **Dos criterios que "must be met" para que el flujo lineal funcione:** *"First, the fan gate must span the width of the molding across which linear flow is desired. Second, the flow resistance across the width of the fan gate must be negligible."*
- **Geometría típica:** *"a simple loft between the circular section of the runner and the rectangular section of the mold cavity"* (un loft simple círculo→rectángulo).
- **Contra:** *"the feed system is typically removed [with a] powered gate cutter, a reciprocating saw, or a router"* — degatado con **herramienta eléctrica** (sierra recíproca o router).
- **Cómo se analiza (§7.3.3):** la sección varía a lo largo; *"The fan gate could be broken into a number of small segments each with a different section"*, o **aproximación**: rectángulo con ancho y espesor **a la mitad del camino** entre el inicio circular y el final rectangular.

### §7.2.6 Flash gate / Diaphragm gate
- **Cómo funciona (el truco físico):** sección **gruesa circular** pegada a una **delgada rectangular**. El melt entra a la gruesa, la delgada lo frena/congela, la gruesa se llena completa, la presión sube y **fuerza al material congelado de la sección delgada a fluir** → flujo **casi lineal** en todo el ancho. La condición: *"the flow resistance along the thick section is small compared to the flow resistance across the thin section"*.
- **Diaphragm:** el mismo concepto en cilíndrico → **flujo lineal SIN líneas de unión (knit-lines)**. *"Even though the geometry of the diaphragm gate is cylindrical, the analysis is correctly performed according to a strip geometry with a width equal to the circumference of the diaphragm."*
- **Degatado:** flash → *"can typically be removed by an operator without the need for power assisted cutters"*. Diaphragm → *"power tools or a punch press are typically required"*.
- **Estética:** *"Both the flash and the diaphragm gates will leave a witness line, so it is desired to minimize the thickness of the gate itself."*
- **Contraintuición que Kazmer aclara:** parecen imponer cortante brutal por ser delgadas, pero *"these gates' large width will result in relatively low linear melt velocities even at high volumetric flow rates"* → cortante y ΔP moderados.

### §7.2.7 Tunnel / Submarine gate ⭐(reglas duras)
- **Ventaja principal:** *"the tunnel gate provides for automatic de-gating with the actuation of a simple two-plate mold"* — degatado automático **sin invertir en 3 placas ni en cámara caliente**.
- **Dimensionamiento:** *"These differences are negligible with respect to the flow"* → se dimensiona **igual que un pin-point**.
- **Los dos ángulos que "must be specified":**
  - *"a nominal 45 degree angle should be maintained between the centerline of the tunnel gate and the parting plane to allow for the transmission of shearing stresses to the gate"* (45° nominal entre el eje del túnel y el plano de partición, para transmitir el esfuerzo cortante que lo rompe).
  - *"the tunnel gate should have an included taper angle of at least 20 degrees to ensure that the tunnel gate does not stick in the mold and that the tunnel gate breaks at the junction with the molding"* (**cono incluido ≥ 20°**).
- **Regla de posición:** *"To ensure adequate structural integrity of the cavity undercut, the tunnel gate should be located at least three tunnel diameters off the parting plane."* (**≥ 3 diámetros de túnel fuera del plano de partición**).
- **Dependencia externa obligatoria:** *"the runners should be designed with nearby sucker pins to retain the runner system on the core side. If the tunnel gates and the runner system remain on the cavity side, then they can not be removed through actuation of the ejection system."* — **si el runner se queda del lado de la cavidad, el degatado automático NO EXISTE.**
- **Riesgo declarado:** *"The primary risk in application is that the tunnel gate may be improperly designed or wear such that the runner system does not reliably de-gate"* — **el desgaste mata el degatado con el tiempo** (falla progresiva, no instantánea).
- **Variantes:** *submarine* = baja al **núcleo** (el degatado lo hace el sistema de expulsión, no la apertura del molde). *Extended / banana / cashew* = rodea paredes verticales para entrar a superficies interiores — *"such designs pose additional risk with respect to reliable de-gating"*.

### §7.2.8 Thermal gates (cámara caliente)
Objetivo extra frente a los fríos: *"must also provide a solidified plug that prevents the liquefied plastic melt in the hot runner from flowing out of the gate when the mold opens"*.

**(a) Thermal pin-point (con torpedo):**
- Torpedo altamente conductivo lleva calor hacia el gate; *"Typically, three or four orifices in the torpedo"*; una **capa delgada de plástico residual aísla** el torpedo caliente de la pared fría.
- **Contra 1:** orificios chicos → *"this gate design may not be suitable for shear sensitive or heavily filled materials"* (materiales sensibles al cortante o muy cargados).
- **Contra 2 (residencia):** *"any stagnant material will degrade with the potential to be pulled into the flow stream and contaminate the plastic melt, most typically as black specks"* → **puntos negros**; y en **cambio de color**: *"even small amounts of residual material may cause color streaking on subsequently molded parts"*.
- **Contra 3 (nota al pie):** el tapón sólido debe romperse por presión al inicio del ciclo, y *"the magnitude and timing of the melt pressure may vary slightly from gate to gate depending on gate tolerances, gate assembly, and gate temperature distribution. While not an issue in most molding applications, these variances may be problematic in precision molding applications."* → **inaceptable en moldeo de precisión multi-drop**.
- Juicio: *"Hot runner suppliers have worked to resolve these issues, but with limited success."*

**(b) Thermal sprue gate:**
- Punta con **largo contacto con el molde** → la zona del gate se enfría → **no requiere capa aislante** → **bore abierto**.
- **Pros:** cortante y ΔP menores → apto para **sensibles al cortante y muy cargados**; *"typically requires fewer molding cycles when colors or materials are changed"*; y un pro poco obvio: *"the length of the sprue can be designed to allow clearance for ribs or other cavity details that emanate towards the feed system and may prevent direct gating with a thermal pin-point gate"* — **el sprue se alarga para librar costillas que impiden gatear directo**.
- **Contra:** el sprue se queda moldeado con la pieza → **vestigio o degatado posterior por el operador**.
- Mecánica de ruptura: *"A set of converging-diverging tapers in the nozzle tip dictates the break point of the sprue"*.

### §7.2.9 Valve gate
- **Pros:** sello mecánico **acero contra acero** (más robusto contra fugas) y la cara del pin es **superficie de cierre del molde** → **vestigio mínimo**.
- **Contras (costo y complejidad, enumerados):** pines de válvula, actuadores, **placa de sujeción superior mucho más grande** para alojar actuadores, mangueras, conexiones y sistema de control. *"the cost of a hot runner system with valve gates may be twice the cost of a hot runner system with thermal gates."* Y complejidad de uso: *"the operator must correctly connect the hoses and specify timings to coincide with the process settings"*.

### §7.3.1 — La tabla de selección (Tabla 7.1) y sus 4 notas
| Tipo | Runner | Degatado | Cortante | Flujo |
|---|---|---|---|---|
| Sprue | Frío | Manual | Moderado | Radial |
| Pin-point | Frío | Automático | Alto | Radial |
| Edge | Frío | Manual | Moderado | Radial |
| Tab | Frío | Manual | Moderado | Radial |
| Flash/diaphragm | Frío | Manual | Moderado | **Lineal** |
| Fan | Frío | Manual | **Bajo** | **Lineal** |
| Tunnel/submarine | Frío | Automático | Alto | Radial |
| Thermal pin-point | Caliente | Automático | Alto | Radial |
| Thermal sprue | Caliente | Automático | Moderado | Radial |
| Valve | Caliente | Automático | Moderado | Radial |

**Los 4 factores primarios de selección:** *"the type of runner system, the desired method of de-gating, the allowable level of shear rates through the gate, and the resulting flow that is desired."* Y antes: *"Often, the selection of a type of gate is obvious."*

**Notas de la tabla que cambian el modelo de datos:**
1. **Híbrido común:** *"it is common in multi-cavity molds to use a hot runner system in which each drop feeds a plurality cold 'sub-runners' and associated gates"* — 4 drops × 4 sub-runners = **16 cavidades**. El tipo de runner **no es global**, es por rama.
2. La columna "degatado" se refiere **sólo a la acción del molde**, NO considera robots.
3. **Calibración de los regímenes de cortante:** bajo ≈ **10,000 s⁻¹**, moderado ≈ **40,000 s⁻¹**, alto ≈ **100,000 s⁻¹**.
4. Sólo **fan, flash y diaphragm** están diseñados a propósito para flujo lineal; **todos los demás dan flujo radial**.

---

## 7-C. REGLAS PRESCRIPTIVAS EN PROSA — CAP. 7 (el oro)

**Degatado (§7.1.2)**
- *"the gate and runners should be automatically disconnected from the molding at the time of ejection"* — deben desconectarse **automáticamente al expulsar**.
- Razón económica: el operador **impone costo de mano de obra**, y además *"the handling and de-gating of moldings by the operator can also limit the cycle time and induce defects into the moldings"* (**limita el tiempo de ciclo E induce defectos**).
- Tres caminos al degatado automático: (1) **acción de apertura del molde** — 2 placas con tunnel, o 3 placas con pin-point; (2) **cámara caliente** con thermal o valve gates (elimina el degatado por completo); (3) **robot con cortador**.
- Si es robot: *"the mold designer should discuss alternative gate types and locations with the molder to provide access for pick-up of the molding and de-gating"* — **el diseñador DEBE platicar con el moldeador** sobre tipos y ubicaciones alternativas para dar **acceso de pick-up**.

**Estética / testigo (§7.1.3)**
- Dos recetas: (a) *"use a very small gate (such as a pin-point gate) in combination with a coarse texture such that the gate vestige is less apparent"* — **gate chico + textura gruesa esconde el vestigio**; (b) *"locate gates on non-visible surfaces such as underneath a side wall instead of into the side wall"* — **debajo de la pared lateral, no en la pared lateral**.
- Advertencia: *"careful gate removal may be required since any significant gate vestige may interfere with mating surfaces in the product assembly"* — **el vestigio puede estorbar superficies de acoplamiento del ensamble** (no es sólo estética, es función).

**Cortante y presión (§7.1.4)**
- Defectos de un gate demasiado chico, en orden: **degradación del material; flujo no laminar y jetting; splay y otros defectos visuales; tiempos de llenado extendidos; tiros cortos (short shots)**.
- *"the shear rate should be calculated and verified that it is below the maximum permissible value"*.
- *"the mold designer should consult with the material supplier for application-specific data"* — el apéndice A es referencia, **el proveedor del material manda**.
- *"If the shear rate is permissible, then the pressure drop is usually acceptable as well. However, the mold designer should calculate the pressure drop to ensure that it is not excessive."*
- **Números de dedo:** *"A typical pressure drop through a gate is on the order of 2 MPa (300 psi), with 6 MPa (900 psi) potentially excessive dependent on the availability of melt pressure to fill the mold cavity."* Y en §7.3.3: *"Pressure drops above 10 MPa are usually indicative of improperly designed gates that are either too thin or too long."*

**Empaque (§7.1.5)**
- *"It is really the gate, and not the molding machine, that determines the packing time of the cavity."*
- Gate chico → congela prematuro → contracción volumétrica excesiva → **malas propiedades dimensionales y estéticas**.
- Gate grande → no congela a tiempo → o el molde aguanta un pack larguísimo, o **el melt se REGRESA de la cavidad al runner y a la máquina** → otra vez contracción excesiva.
- *"the theoretical minimum packing time of the gate should be calculated and checked against the expected process parameters. If the packing time is unexpectedly short or long, then the dimensions should be adjusted **even if the shear rates and pressure drops were found acceptable**."* — **el pack time puede invalidar un gate que ya pasó cortante y presión.**

**Steel-safe (§7.3.2 y §7.4)** ⭐
- *"Given this dilemma and the ease of increasing the size of gates, it may be desirable for the mold designer to be 'steel safe' and specify a smaller gate with the intent that the mold will be tested and the gate sizes increased as necessary."*
- *"the mold designer should assume a reasonable flow rate for analysis, select a type of gate that can be enlarged, and specify dimensions that are 'steel safe'"* — **el tipo de gate se elige, entre otras cosas, por si SE PUEDE AGRANDAR después.**
- §7.4: *"If the specification of the gate dimensions is uncertain, then the mold designer should utilize smaller gate dimensions since they can be more readily increased if required after molding trials."*
- Por qué el máximo tabulado es mentira piadosa: *"the maximum shear rates are dependent not just on the maximum shear rate, but also the entire thermal and mechanical history of the polymer melt. In many if not most cases, much higher shear rates may be possible."*

**Congelamiento del gate (§7.3.4)**
- *"the molder should set up the molding machine to end the packing stage at gate freeze-off and begin the plastication stage."*
- El criterio de no-flujo: **viscosidad de 100,000 Pa·s "arbitrarily selected"**; de ahí sale la "no flow temperature" del Apéndice A.
- Las ecuaciones de la Tabla 7.4 dan **MÍNIMOS**: asumen conducción perfecta e **ignoran la convección del flujo que pasa por el gate** (que tiende a impedir que congele). *"gate pack times should be expected to be significantly longer than those predicted."* → **sirven sólo para orden de magnitud.**
- ⭐ *"It is noted that this edge gate design does gate into a thinner section of the mold cavity, which is not recommended. For this reason, a three-plate mold or hot runner mold should be considered to provide gating into the thicker 1.5 mm section with a longer packing time."* — **la conclusión de un cálculo de gate puede ser CAMBIAR EL TIPO DE MOLDE.**

**Balanceo por gates (§7.3.5)**
- *"The extent of the balancing that can be achieved through gate design is extremely limited due to the small size of the gate. To bring about large changes in flow, the gate dimensions must vary by such significant amounts that the shear rates and gate freeze times will vary substantially between gates, causing unintended consequences. For this reason, it may be preferred to change the dimensions of the runners or to use a dynamic flow control technology."* — **NO balancees con gates; balancea con runners.**

**Tres remedios contra contracción volumétrica excesiva (§7.3.5), en el orden de frecuencia real:**
1. *"The most common approach used by the molder is to impose a very high packing pressure before the gate freezes"* — pero *"can lead to excessive flashing and/or residual stresses"*.
2. *"a second common approach is to increase the diameter or thickness of the gate to increase the solidification time and provide packing at more moderate melt pressures"*.
3. *"A third and seldom used approach is to rework the mold to reduce the nominal thickness of the molding."*

---

## 7-D. ITERACIONES DECLARADAS (cap. 7)

| Disparador | Regreso a | Acción |
|---|---|---|
| γ̇ > γ̇max en edge gate (ej.: 111,000 vs 50,000 s⁻¹) | §7.3.1/§7.3.2 | Ensanchar… **pero al llegar a 14 mm "would require a change in the gate type to a fan gate"** ⭐ — el ancho cambia la CLASE del objeto |
| γ̇ > γ̇max, alternativa | Proceso, no molde | *"the flow rate can be reduced from 125 cc/s at the nozzle to 60 cc/s, which would require a doubling of the filling time"* |
| γ̇ > γ̇max en pin-point (132,000 s⁻¹) | §7.3.2 | Resolver R directo para γ̇max (1.03 mm → Ø2 mm) — pero *"This larger diameter would leave a larger gate vestige and require greater forces for de-gating. It may be reasonable to initially specify the lesser diameter of 1.5 mm, and then increase the diameter if issues are encountered"* |
| ΔP > 10 MPa | §7.3.5 | Gate demasiado **delgado o largo** |
| t_freeze del gate ≪ t_pack de la pieza (1.1 s vs 24 s) | §7.3.5 | *"It is likely that the gate will freeze prematurely and the cup may not be adequately packed"* → engrosar gate, subir presión de empaque, o adelgazar la pieza |
| El gate entra a sección delgada | §7.3.1 **y el tipo de molde** | Pasar a 3 placas o cámara caliente para entrar a la sección gruesa |
| Tunnel gate se **desgasta** en producción | §7.2.7 | Falla progresiva del degatado; añadir/revisar **sucker pins** |
| Vestigio del gate estorba a un asiento de ensamble | §7.1.3 | Reubicar el gate o añadir **recess/gate well** |

---

## 7-E. JUICIOS HUMANOS (cap. 7)

- **"A menudo la selección del tipo es obvia"** (§7.3.1) — el experto no corre el árbol de decisión completo; lo reconoce de golpe. El software debe permitir *saltar* a un tipo y luego validar.
- **Aceptar un hundimiento (sink) a propósito** porque queda tapado por el ensamble de la pantalla (§7.2.4).
- **Aceptar una línea de testigo** en flash/diaphragm y sólo minimizar el espesor (§7.2.6).
- **Elegir gate chico + textura gruesa** como estrategia estética en vez de mover el gate (§7.1.3).
- **Costo/mantenimiento de hot tips (§7.2.8):** el thermal pin-point es "clever" pero se ensucia; el juicio real es *frecuencia de cambio de color* y *si el material es sensible al cortante o cargado*. Si hay cambios de color frecuentes → **thermal sprue**, aunque deje vestigio.
- **Valve gate = duplicar el costo del hot runner** (§7.2.9): sólo se justifica si el vestigio o el sello son inaceptables de otro modo. Y añade **carga cognitiva al operador** (mangueras + timings).
- **Preferencia de taller (§7.1.2):** discutir con el moldeador tipos y ubicaciones si va a haber robot.
- **Escoger un tipo "que se pueda agrandar"** (§7.3.5) — criterio de *reversibilidad*, no de desempeño.
- **Molde de familia (contexto §9.2.1, aplica al gating):** aceptar el ciclo del más grueso a cambio de **color matching y ensamble a pie de prensa**.

---

## 7-F. CRITERIOS DE ACEPTACIÓN — congelar el diseño de gates

1. γ̇ ≤ γ̇max del material (Apéndice A **o** dato del proveedor, que manda).
2. ΔP calculado, típico ~2 MPa; **> 6 MPa** sospechoso según presión disponible; **> 10 MPa** = mal diseñado (muy delgado o muy largo).
3. t_freeze del gate comparado explícitamente contra t_cooling / t_pack de la pieza — ni prematuro ni eterno.
4. El gate **no** entra a una sección más delgada que la que debe empacar.
5. Existe una ruta de degatado declarada (manual / automático por acción del molde / robot) **y** el acceso físico para ejecutarla.
6. El vestigio cae en superficie no visible **o** no interfiere con superficies de acople.
7. Para tunnel: 45° al plano de partición, cono incluido ≥ 20°, ≥ 3 diámetros fuera del plano de partición, y sucker pins presentes.
8. Para fan/flash/diaphragm que buscan flujo lineal: abarca todo el ancho **y** la resistencia transversal es despreciable.
9. Las dimensiones son **steel-safe** (se pueden abrir en el tryout).

---

# CAPÍTULO 8 — VENTING (venteo)

## 8-A. Postura de arranque (la frase que define el capítulo)

*"Venting is normally a minor aspect of mold design, which is frequently neglected until molding trials indicate mold inadequacies related to venting. An understanding of the purpose and function of vents can assist the mold designer to **design vents where clearly needed and ensure that the mold may accommodate additional vents when required**."*

→ El entregable de venteo tiene **dos partes**: los vents que sí se maquinan, **y la capacidad reservada** para los que se van a añadir después. ⭐

## 8-B. EL PROCESO A MANO (§8.2, tres pasos declarados)

*"A three step analysis process is recommended"*:
1. §8.2.1 Estimar el **gasto de aire desplazado** relativo al del melt.
2. §8.2.2 Determinar **número, tipo y ubicación** de vents.
3. §8.2.3 Especificar **ancho, largo y espesor** de cada vent — con la doble cota: *"the thickness must be greater than some minimum value to ensure adequate venting while also smaller than some maximum amount to avoid excessive flashing."*

### §8.2.1 Gasto de aire
- *"The amount of air displaced will be approximately equal to the volume of the injected plastic."* Se asume **V̇aire = V̇melt** (el aire se expande al tocar el melt pero se enfría al rozar el acero → se cancelan).

### §8.2.2 Dónde SÍ van los vents — las **tres clases de ubicación** (Fig. 8.1)
1. **Donde el melt converge en una arista del plano de partición u otra superficie de cierre (shut-off).**
2. **Donde dos frentes convergen y forman línea de unión (knit/weld line)** — *"a vent is therefore required on an internal surface of the mold cavity. **Usually, ejector pins are designed to provide such venting functions** on the surface of the mold cavity."* ⭐ (el vent interno **es** un expulsor).
3. **Bolsas muertas (dead pockets)** — *"The exact locations are not always obvious"*. Tres ejemplos canónicos:
   - **Punta de un boss:** el melt sube por la pared del boss y atrapa aire arriba.
   - **Punto muerto superior de una costilla:** dos frentes se juntan en la costilla y empujan el aire al tope.
   - **Esquina de costilla con recorte (cutout):** el frente cruza la costilla en diagonal y el recorte atrapa el aire en la esquina.

### Dónde NO hace falta (el juicio de descarte)
- En el bezel hay **12 ubicaciones candidatas** en el plano de partición; *"Some of these vents, including the four locations near the gates and the four locations at the corners **may not be necessary since the melt flow is predominantly radial**. Since the flow is radial, the melt should reach the edges of the mold without trapping any air."*
- **Pero** — y aquí está el juicio: *"the exact melt front behavior may change slightly and it is not uncommon for the melt to trap gas at these locations. While the vents in the corner and near the gate may be considered as optional, **the mold designer may choose to specify vent locations at these locations to avoid mold changes later**."* ⭐ Se maquinan vents "innecesarios" como **seguro contra un cambio de molde futuro**.
- Los **cuatro del final de flujo SÍ deben incluirse**: *"should be included since a significant fraction of the displaced air from the cavity will likely exit here."*

### El conteo real
- ~12 en el plano de partición + **~20 bolsas muertas** en el bezel = *"about three dozen vent locations that the mold designer may wish to consider. It is unlikely that all of these vent locations are necessary."*
- *"the addition of vents is usually a relatively simple operation that can be accomplished after the mold is built and tested. For this reason, **it is fairly common for the mold designer to initially specify vents at only the most critical vent locations**."*
- **Decisión final del ejemplo: de ~36 candidatos, se maquinan 8.**

### §8.2.3 Dimensionamiento
- **Largo y ancho:** *"In general, the length and width of the vent are determined by the application geometry."* (los fija la geometría, no el cálculo).
- ⭐ **La regla anti-intuitiva del reparto de aire:** *"It may seem reasonable to estimate the air flow through each vent as the total volumetric air flow divided by the number of vents. **However, this approach would not be conservative.** The reason is that the exact location of the end of fill is not known ... **A more conservative approach is to assume that all the local air flow exits through each available vent.**"* En el ejemplo: 125 cc/s se parte en dos flujos de 62.5 (arriba/abajo), y **cada** vent se diseña para **62.5 cc/s completos**, no para 62.5/4.
- **Presión permitida a través del vent:** *"To avoid compressing the gas and increasing pressure on the plastic melt, the allowable pressure drop across the vent is **one atmosphere** (14.7 psi or 0.1 MPa)."*
- **Viscosidad del aire:** 1.8·10⁻⁵ Pa·s (ambiente).
- **Resultado:** h_min = 0.06 mm para 100 cc/s, W=10 mm, L=10 mm.
- **Por qué el mínimo casi nunca manda (3 razones explícitas):** (a) el modelo laminar predice más caída que el turbulento real; (b) se usó **un solo vent chico con flujo alto**; (c) la viscosidad a temperatura ambiente es **mayor** que la del aire caliente/comprimido real. → *"the minimum thickness of the vent will not generally be a limiting design constraint."* ⭐ **El que manda es el máximo (rebaba), no el mínimo (aire).**
- **Máximo (rebaba):** *"The formation of flashing in extremely thin channels such as vents is an advanced research topic, requiring transient simulation with small time steps. **No simple analytical solution exists.**"* Se usa una aproximación *"for the purpose of discussion only"*:
  - h_max = sqrt( 12·mu / (P_melt · t_flashing) ) · L_flash
  - P_melt = (dP/dt)·t_flashing, con **dP/dt < 100 MPa/s** para la mayoría de los procesos.
  - t_flashing = tiempo de solidificación del melt **en el vent** (se calcula con las ecuaciones de gate freeze de la Tabla 7.4) ≈ **0.003 s** para 0.06 mm.
  - mu ≈ **10 Pa·s** (*"Since the vent is thin, there will be significant shear thinning so a low viscosity of 10 Pa s is assumed"*).
  - Resultado: h_max ≈ **0.4 · L_flash**. Con L_flash permitida de 0.2 mm → h_max = 0.08 mm.
- **La palanca cuando el máximo aprieta:** *"If less flashing was desired, then **more and wider vents** could be used to reduce the required air flow, after which the vent thickness could be reduced to reduce flashing while providing adequate air flow."* → **más vents y más anchos → vents más delgados.**

### Tabla 8.1 — Espesores recomendados de vent (mm), por handbook
| Material | Glanvill (1965) | Rosato (1986) | Menges (2000) |
|---|---|---|---|
| Baja viscosidad: **PP, PA, POM, PE** | 0.08 | 0.1 | **0.015** |
| Media viscosidad: **PS, ABS, PC, PMMA** | 0.2 | 0.3 | **0.03** |

**La explicación de la divergencia (juicio histórico, no dato):** *"there has been a long term trend in the plastics industry to move to thinner walls, faster injection rates, and higher injection pressures; **the maximum thickness of the vent decreases with increasing melt pressure**. At the same time, material manufacturers have sought to reduce the viscosity of plastic resins... Accordingly, it should not be surprising that the technical standards for vents changes, with **thinner vents being recently recommended**."*
→ Regla derivada: **más presión de inyección y resina más fluida ⇒ vent más delgado.** Las tablas viejas no son "otra opinión", son de otra época del proceso.

---

## 8-C. §8.3 — LOS TRES DISEÑOS DE VENT

### §8.3.1 Vent en el plano de partición
- **Anatomía:** canal delgadísimo **directo en el final de flujo** → sale de la línea de partición hacia afuera → desemboca en un **"relief" o "channel"** mucho más grueso → salida.
- **Cotas del ejemplo bezel:** h_vent = **0.06 mm**, L = **2 mm**, luego canal de **2 mm de espesor**, salida de **Ø3 mm** al centro y arriba del inserto. *"The width of the vent, W, has been made **purposefully high** to provide for uncertainty in the last area of the melt to fill the cavity."* ⭐ (el ancho absorbe la incertidumbre del end-of-fill).
- **Pieza cilíndrica con gate central** (3 placas o cámara caliente): *"vents can be placed around the periphery of the entire mold cavity"* — **anillo de venteo completo**; con ese ancho enorme, h = **0.015 mm**, L = **1 mm**, y un canal que conecta el anillo al costado del inserto.
- **La falla estructural que hay que anticipar:** *"they are susceptible to flashing with bending of the mold plates ... Any significant deflection will tend to increase the thickness of the vents and thereby increase the likelihood and amount of flashing."* Y peor: en el diseño del anillo, *"the outside, bottom surface of the lid is an area observed and handled by the end-user"* → la rebaba cae en zona estética. **Solución declarada:** vent interno alrededor de una **placa desmoldeadora (stripper plate)** (§11.3.4).
- ⭐ **La recomendación operativa que contradice al cálculo:** *"To avoid excessive flashing and associated maintenance, it is recommended that vents on the parting plane be used **sparingly** with a thickness on the order of **0.02 mm**. If venting is subsequently found to be inadequate, then additional vents can be added or the thickness of existing vents increased."*
  (el cálculo dio 0.06 mm mínimo; la práctica dice arrancar en 0.02 mm y **abrir en el tryout** — otra vez *steel safe*).

### §8.3.2 Vents alrededor de pines expulsores
- *"A very common practice is to use the clearance around ejector pins for venting purposes."*
- **Tres ventajas:** (1) *"the actuation of the ejector serves to at least partially clear the venting channel"* — **se autolimpia**; (2) son componentes comunes y bien entendidos; (3) *"Since a clearance needs to be specified around the pin to provide a sliding fit anyways, it is economical"* — el claro **ya existe**, sale gratis.
- **La cota de taller:** *"Holes for ejector pins are normally **drilled and subsequently reamed**. In mold manufacturing, the **diametral clearance between the ejector pin and ejector hole is typically 0.13 mm (0.005 in)**, which leaves **0.065 mm (0.0025 in)** thickness for venting."*
- ⭐ **Por qué se acepta que sea MÁS GRUESO que el vent recomendado (3 razones explícitas):** (1) *"the clearance is useful to avoid increased sliding friction and ejector pin buckling"* (fricción y pandeo del pin); (2) *"ejector pins are usually machined through solid steel, so increased flashing due to parting plane deflection are unlikely"*; (3) *"any witness lines associated with flashing at the ejector pins are usually located on non-aesthetic surfaces."*
- **Anatomía obligada (Fig. 8.8):** canal de venteo hasta **3 mm** de la superficie de la cavidad, después el canal **se abre en cono** hasta el barreno nominal del pin. *"**Both of these elements should be present in a good vent design.** The larger channel serves to reduce the flow resistance of the air while also assisting in the assembly of the ejector pins to the mold. **The taper is useful to guide the head of the pin during mold assembly.**"* → el cono es para **armado**, no para aire.
- **La longitud es negociable:** *"The vent length, L, of 3 mm has been chosen for illustrative purposes and is certainly not mandatory ... it is possible to extend the length of the vent to a location that is convenient."* Dos ejemplos de conveniencia: ⭐
  - *"it may be desirable to **avoid a large vent channel near cooling lines**"* — **el vent cede el paso a la línea de agua**.
  - *"a mold may be more economically produced with the same vent section through the majority of the core insert, **tapering to a larger size only where the core insert faces the support plate**"* — se abre sólo donde se puede maquinar barato.
- Aplica también a **cuchillas expulsoras (ejector blades)**.

### §8.3.3 Vents en bolsas muertas
- **Inserto venteado:** bolsa rectangular maquinada en el núcleo + inserto venteado. *"the vent only spans the width of the rib where the trapped air is expected"* — **el vent abarca sólo el ancho de la costilla**. Cotas: **H = 0.2 mm, L = 2 mm**, luego canal más ancho detrás. Detalle de manufactura: *"**Since there is no ejector pin, there is no need for a smooth transition** between the vent and the vent channel."* (sin pin no hay que guiar nada → transición brusca permitida).
- ⭐ **El veredicto económico:** *"the venting function of the insert ... could have also been provided by using an **ejector blade** at the same location. The ejector blade like could have been provided **at lower cost while also facilitating the ejection** of the part. As such, **venting inserts are not especially common**."* — **la cuchilla expulsora gana casi siempre: ventea y expulsa.**
- **Vents sinterizados:** Ø **2–12 mm**, poros de **0.03–0.1 mm**. *"Given their small size and non-machinable top surface, sintered vents are best placed with their venting surface **flush with flat mold cavity surfaces**."* (superficie **plana**, al ras — porque la cara del sinterizado **no se puede maquinar**). Contra: *"sintered vents can require intermittent replacement or maintenance as the micro-channels may clog **without any easy method for in-mold cleaning**."*

---

## 8-D. REGLAS PRESCRIPTIVAS EN PROSA — CAP. 8

- §8.1.1 *"If the burn marks appear on an aesthetic surface, **the molder should reject the molded part**."* — criterio de **rechazo de pieza**, no de diseño.
- §8.1.1 El gas atrapado entre dos frentes *"can reduce the part strength ... while also forming **v-notches** on the surface of the molded part that act as a **stress concentration** during the part's end-use"* — el venteo es un requisito **estructural**, no cosmético.
- §8.1.2 *"if a molder continues operation with excessive flashing, then **the mold's parting plane can wear and require resurfacing**"* — la rebaba **destruye el molde**, no sólo la pieza.
- §8.1.2 *"Such deflashing is undesirable since the operator incurs labor cost **yet does not provide 100% consistency**."*
- §8.1.2 **La conclusión de balance:** *"For these reasons, **fewer and smaller vents are preferred**."* (contra el instinto de "muchos vents grandes").
- §8.1.3 *"Many polymers will off-gas in the molten state, releasing particles that can build up and clog the venting system. **Such clogged vents can occur especially quickly with the use of mold release.**"* → **el desmoldante tapa los vents rápido**.
- §8.1.3 *"Many molders resolve this issue by incorporating **vent cleaning as part of a preventive maintenance program**."*
- §8.1.3 *"the mold designer should strive to design venting systems that require **minimal maintenance, and are easy to maintain when required**."*
- §8.4 *"This approach [ventear después del tryout] **has some merit** since all of the required venting locations may not be known until the mold filling patterns are verified. However, a complete lack of analysis and foresight regarding venting can lead to significant mold defects, time consuming mold changes, and costly product development delays."* — **la postergación es legítima; la ignorancia no.**

## 8-E. ITERACIONES (cap. 8)

| Disparador | Acción |
|---|---|
| Tryout muestra short shot / burn marks / weld line débil | *"additional vents can be added **or the thickness of existing vents increased**"* (§8.3.1) |
| Rebaba excesiva en los vents | *"more and wider vents ... after which the vent thickness could be reduced"* (§8.2.3) |
| Rebaba por **flexión de placas** | No es problema de vent: rediseño estructural, o pasar a **vent interno con stripper plate** (§8.3.1 → §11.3.4) |
| Vents tapados intermitentemente | Programa de mantenimiento preventivo; rediseñar hacia vents **autolimpiables** (expulsores) (§8.1.3, §8.3.2) |
| Canal de vent choca con línea de enfriamiento | **Alargar el vent** hasta un punto conveniente (§8.3.2) |
| Bolsa muerta detectada tarde | Cuchilla expulsora en el punto, antes que inserto venteado (§8.3.3) |
| Vent sinterizado tapado | Reemplazo del inserto (no hay limpieza in situ) (§8.3.3) |

## 8-F. JUICIOS HUMANOS (cap. 8)
- Decidir cuáles de ~36 candidatos se maquinan (aquí: **8**) — puro juicio de "los más críticos".
- Maquinar vents **opcionales** (esquinas, junto al gate) sólo para **no tener que abrir el molde después**: apostar costo de maquinado contra costo de un cambio de molde.
- Aceptar que la línea de testigo del expulsor caiga en superficie **no estética**.
- Escoger cuchilla expulsora sobre inserto venteado por **costo y doble función**.
- Confiar en la tabla más nueva (Menges) o en la más vieja según la presión y la resina reales del taller.

## 8-G. CRITERIOS DE ACEPTACIÓN — congelar el venteo
1. Hay vent en **todo final de flujo** en el plano de partición.
2. Hay vent (típicamente un expulsor) en **cada convergencia de frentes** interna.
3. Cada **bolsa muerta** identificada tiene ruta de escape o está declarada como riesgo aceptado.
4. h_min ≤ h_vent ≤ h_max, con **h_max** (rebaba) como el que realmente manda; punto de arranque práctico 0.02 mm en plano de partición, 0.065 mm en expulsores.
5. Cada vent dimensionado para **todo el flujo local**, no para el flujo prorrateado.
6. Cada vent desemboca en un **canal de alivio** y de ahí a una **salida** al exterior del inserto.
7. Los canales de alivio **no chocan con líneas de enfriamiento**.
8. La rebaba prevista cae en superficie no estética y no manipulada por el usuario final.
9. El molde tiene **espacio reservado** para añadir vents después.

---

# CAPÍTULO 9 — COOLING SYSTEM DESIGN

## 9-A. Diagnóstico de arranque

*"The cooling system is extremely important to the economics and operation of the designed mold, and yet remains **one of the most under engineered systems** in injection molds. Perhaps the reason for the lack of engineering is that **the temperature distribution is not obvious when molding compared to defects related to flow**."*

Las dos consecuencias: (1) tiempos de ciclo mucho más largos de lo alcanzable; (2) gradientes térmicos → **contracción diferencial y alabeo**.

## 9-B. §9.1 — LOS SEIS OBJETIVOS (los criterios en conflicto)

**§9.1.1 Maximizar transferencia:** k y dT/dz. *"A highly conductive material like Cu 940 or QC7 has a thermal conductivity several times higher than all of the steels."* Y: acercar las líneas a la superficie.

**§9.1.2 Uniformidad:** ⭐ *"While high heat transfer rates are desired, **an overly aggressive cooling system design can actually cause quality problems**. As the cooling lines approach the mold cavity surface, the heat transfer path becomes more direct. As a result, there can be **a great variation in the temperature across the cavity surface unless the cooling lines are also placed very close together**."*
Y la consecuencia en piso: *"the molder often has **no choice but to run longer cycle times and use the mold as a cooling fixture** ... often with higher mold coolant temperatures ... The result is a cycle much longer than might have been planned, **and which could have been prevented with a better cooling system design without any additional cost**."*

**§9.1.3 Costo:** *"there is a point at which further investment in the cooling system reaps no rewards"* — porque el cuello de botella se vuelve **la conducción a través del plástico y la convección al refrigerante**. Número duro: *"molds made out of highly conductive materials may have a **30% reduction in the cycle time** ... but not anything near the **eight-fold** improvement that might be anticipated from these material's high thermal conductivity values."*
*"**The key to designing a cost effective mold is to know where to invest.**"* Y: *"Complex cooling line designs often require substantial **machining, plugging, sealing, fitting, and maintenance**."*

**§9.1.4 Volumen y complejidad:** *"they often conflict with the placement of other components ... very little space in the mold to place the ejector systems, runners, bolts."* Reglas:
- *"the mold designer should strive to **route cooling lines that parallel the geometry of the mold cavities**."*
- *"**A smaller cooling line diameter, while more difficult to machine and transferring less heat, may have a lesser impact on nearby components and allow for the use of multiple lines to achieve more uniform cooling.**"* — línea chica y muchas > línea gorda y pocas.

**§9.1.5 Esfuerzo y corrosión:** cada línea quita material de soporte **y** mete concentración de esfuerzo; la carga cíclica → fatiga; *"corrosion of the metal by the circulating coolant tends to exacerbate the stress concentrations. **Cracks form, corrode, and propagate through the mold to the cavity and subsequently require repair.**"*

**§9.1.6 Usabilidad — reglas de operador:** ⭐
- *"The number of external connections should be kept to a minimum, and **preferably two (one inlet and one outlet) per mold half**."*
- *"If more than two connections are required, then the connections **should be labeled 'in' and 'out'** to help the operator **avoid forming a dead circuit**."* (evitar un circuito muerto).
- *"To avoid damage to the cooling system, **all external components should be recessed** to avoid direct contact with tie bars, work tables, or other items."*

## 9-C. §9.2 — EL PROCESO DE 7 PASOS

> Marco: *"it is not likely that every objective will be simultaneously optimized. **The goal is for the mold designer to reach a good compromise**, such that fast and uniform cooling is achieved in a cost effective manner."*

### §9.2.1 — Calcular el tiempo de enfriamiento
- Definición: tiempo tras el llenado para que el plástico sea **suficientemente rígido para expulsar**.
- Criterio de rigidez: **HDT / DTUL** (ASTM D648) como T_eject.
- Placas: tc = h²/(pi²·alpha) · ln( (4/pi) · (Tmelt − Tcool)/(Teject − Tcool) )
- Barras: tc = D²/(23.1·alpha) · ln( 1.60 · (Tmelt − Tcool)/(Teject − Tcool) )
- **Regla de selección de la cota:** *"the mold designer should consider **the thickest section** that is likely to require the longest time to solidify."*
- ⭐ **Nota al pie 2 — por qué línea central y no promedio:** *"This book recommends analysis using the **centerline** criterion for two reasons. First, it is **conservative**... Second, this approach is **supported by bending theory**. Specifically, consider a part that is rigid at the walls but semi-molten at the centerline. Since the plastic at the centerline is not able to transmit the shear stresses from one wall to the opposing wall under ejection loads, the deformation of the molded part will be much higher."*
- **Nota al pie 1 — por qué el cálculo siempre se queda corto:** (a) **resistencia térmica de contacto** entre materiales distintos, agravada por *"thin gaps which open up between the shrunken molding and the mold walls"*; (b) *"the cooling time is often not driven by the rigidity of the part, but rather by **quality requirements**"*.
- **Isotérmico vs convectivo:** con h_c ≈ 1000 W/(m²·°C), el tiempo pasa de **19 s a 24 s**. → **+25 % sobre el ideal.**
- **La regla de dedo de la industria:** **tc [s] = 2 · (h [mm])²**. Con 3 mm → 18 s (vs 19.2 s analítico y 24 s con convección). Kazmer la deriva y la valida: sale de alpha ≈ 0.09 mm²/s y (Tmelt−Tcool)/(Tcool−Teject) ≈ 5 → coeficiente 2.08.
  - Juicio: *"While Eq. (9.8) is an excellent guideline, **it is a good idea to use Eqs. (9.5) and (9.6)** to evaluate the cooling time for the specific application's design, material properties, and processing conditions."*
  - Y: *"Eq. (9.9) provides an estimate of the cooling time, **which is roughly half of the cycle time**."*
- **Insight del molde de familia (el ejemplo cup/lid):** tapa 2 mm → 8.4 s; vaso 3 mm → 18.9 s; runner → 22.9 s.
  - *"the family mold will be forced to operate at the much longer cycle time of the cup. If high production quantities are desired with parts of different wall thicknesses, then it may be more economical to use two different molds ... **However, such a mold design strategy gives up color matching and at-press assembly which are very significant benefits for family molds.**"* ⭐ juicio de negocio, no de física.
  - *"the cooling time of the runner is larger than that for the cup. In practice, **the runner need not be as rigid as the part being de-molded** so the required cooling time of the runner may be less ... However, the results do indicate that **the cycle time can be dominated by the cooling of the cold runners**, so it is important to minimize the runner diameters **not just for material savings but also to maintain a productive molding process**."*

### §9.2.2 — Potencia de enfriamiento requerida
- Q_moldings = m · Cp · (Tmelt − Teject), con **m = piezas + runners fríos**, *"estimated as the volume of these moldings times their density at room temperature"*.
- Q_cooling = Q_moldings / tc ; Q_line = Q_cooling / n_lines, *"Assuming that the mold is well designed and each cooling line removes the same amount of heat"*.
- ⭐ **Declaración de iteración:** *"At this point, the mold designer should recognize that **multiple design iterations may be necessary** to perform the cooling analysis for different cooling line layouts with varying number of cooling lines."* — n_lines es **entrada y salida al mismo tiempo**.

### §9.2.3 — Gasto de refrigerante
- ΔT_coolant = Q_line / (V̇ · rho · Cp)
- **Los dos números de dedo:** *"A typical allowable increase in the coolant temperature is **1 °C**. For a **precision part**, the allowable increase may be **0.1 °C**."*
- **El techo del beneficio:** *"Much tighter control of the coolant temperature requires much higher flow rates, **and yet provides little added benefit** given that the mold cavity surface temperatures will tend to vary more significantly **between the cooling lines**."* — no sirve de nada apretar el refrigerante si el pitch es flojo.
- ⭐ **Serie:** *"if two cooling lines were connected **in series**, then the cooling power would also be **doubled** such that **twice the flow rate** would be needed to maintain the same temperature distribution."*
- **Verificación obligatoria contra hardware real (Tabla 9.1):**
  | | VacTherm (agua) | IMSelect (aceite) |
  |---|---|---|
  | T mín / máx | 10 / 99 °C | 32 / 304 °C |
  | Calentamiento | 9 kW | 16 kW |
  | Enfriamiento | 14.6 kW | 16 kW |
  | Gasto | 1e-3 m³/s (15 GPM) | 3e-3 m³/s (45 GPM) |
  | Presión | 200 kPa (29 psi) | 30 kPa (4.3 psi) |
- *"multiple mold temperature controllers would be needed if the allowable temperature increase were set to 0.1 °C, or if the number of cavities in the mold was increased from 2 to 8."*

### §9.2.4 — Diámetro de la línea
- **Máximo (turbulencia):** Re = 4·rho·V̇/(pi·mu·D) **> 4000**. → Dmax = 4·rho·V̇/(pi·mu·4000).
- **Juicio sobre la turbulencia:** ejemplo da Dmax = 20 mm y Kazmer remata: *"the requirement of turbulent flow is **not very constraining** ... **Most molding applications require a high rate of heat transfer and an associated high volumetric flow rate such that turbulent flow is almost given.**"* ⭐ (o sea: verifícalo, pero no lo trates como el driver).
- **Mínimo (caída de presión):** Dmin = ( rho·L_line·V̇² / (10·pi·ΔP_line) )^(1/5)
- ⭐ **La regla de reserva de presión:** *"The allowable pressure drop is set to 100 kPa, which is **½ of the maximum supply pressure** from the VacTherm controller. **This last assumption is made to ensure that some supply pressure is reserved for flow through the cooling hoses from the controller to the mold, as well as for pressure drops associated with turns, plugs, etc.**"*
- **L_line en serie se SUMA:** el ejemplo usa dos líneas de 302 mm en serie → **L = 0.6 m** en la fórmula.
- **Resultado del ejemplo: 3.7 mm < D < 20 mm.** *"While this is quite a broad range, the allowable range may be much smaller depending on the molding application."*
- ⭐ **El criterio final NO es el cálculo:** *"the mold designer should consider the **manufacturability** of the cooling lines and **the molder's standards regarding cooling plugs, connectors, and hoses** ... The mold designer should select a cooling line diameter that satisfies the above analysis **and is a standard size**."*
- **Tabla 9.2 — plugs DME (el catálogo que manda):**
  | Plug DME | Rosca NPT | Ø línea |
  |---|---|---|
  | JP-250 | 1/16 | 4.76 mm (3/16") |
  | JP-251 | 1/8 | 6.35 mm (1/4") |
  | JP-352 | 1/4 | 9.53 mm (3/8") |
  | JP-553 | 3/8 | 11.1 mm (7/16") |
  | JP-554 | 1/2 | 15.9 mm (5/8") |
- **Elección del ejemplo: 6.35 mm** ("readily machinable and also compatible with the cooling plug standards at the molder").
- **Refrigerantes no-agua:** *"Ethylene glycol and oil are **not as common in practice due to environmental and cost concerns**. These non-water coolants are also substantially more viscous than water, such that **turbulent flow is not likely to be achieved**."* → usar Hagen-Poiseuille laminar y verificar que ΔP no rebase la capacidad del controlador.

### §9.2.5 — Profundidad de la línea (H_line)
- **Estructural (empuja hacia el fondo):** factores de concentración medidos: **H = 1D → sigma = 3.3·P_melt**; **H = 4D → sigma = 2.6·P_melt**.
  - P20, endurance 456 MPa, a 4D → **P_melt max = 175 MPa** — *"which is close to the maximum injection pressures available from most molding machines"*.
  - Aluminio, límite de fatiga 166 MPa, a 1D (÷3.3) → **P_melt max = 50 MPa**.
  - Juicio: *"This analysis **does not prevent** a mold designer or a molder from operating at higher melt pressures, but simply indicates that **the mold will likely not operate for a long life without developing cracks emanating from the cooling lines**."*
- **Térmico (empuja hacia la superficie):** h_conduction = k_mold / H_line; y H_line < k_mold / 1000 W/(m²·°C). Para P20 (k = 32 W/m°C) → **H_line máx = 32 mm**.
- ⭐ **La conclusión práctica:** *"Combining the structural and heat transfer requirements for a typical 6.35 mm diameter cooling line, the recommended range for the cooling line depth is **2 D < H_line < 5 D**, which is a commonly used range in mold design. While a mold designer may choose an **arbitrary** cooling line depth from this range, the provided analysis should be used **for special applications** with diverse structural or heat transfer requirements."*

### §9.2.6 — Pitch entre líneas (W_line)
- Trade-off: pitch apretado → más rápido y uniforme, pero más líneas y **más conflictos con otros componentes**.
- Modelo de Menges (variación % del flujo de calor) — *"no suitable analytical treatment has yet been developed"* para la temperatura; esto es una estimación empírica.
- **El hallazgo numérico:** *"the variation in the heat flux is **less than 5% up to a cooling line pitch equal to twice the cooling line depth. Afterwards, the variation in heat flux increases dramatically**."*
- **Recomendación: H_line < W_line < 2·H_line.**
- **Modulación por tolerancia:** *"A **commodity product with loose tolerances** would likely be fine with a cooling line pitch equal to **two or three times** the cooling line depth. For **tighter tolerance** applications or for applications requiring **faster cycle times or more uniform cooling**, a closer spacing **equal to the cooling line depth** is desirable."*
- ⭐⭐ **LA TRAMPA CONTRAINTUITIVA:** *"Figure 9.5 indicates that the use of highly conductive materials (such as aluminum or copper) **actually increases the variation in heat flux** by improving the heat conduction between the cooling line and the cavity surface. As such, **the use of highly conductive materials does not directly allow for a wider pitch and a reduced number of cooling lines**. If fewer cooling lines are desired, then this may best be accomplished by **selecting a large cooling line depth and still setting the pitch to twice this amount**. Highly conductive mold materials can then be utilized to accomplish high rates of heat transfer with uniform cooling."*
- ⭐ **Y el corolario que mata el "arréglalo con más ciclo":** *"extending the cycle time for the mold with the wider pitch **does not reduce the temperature gradients** across the part **until the entire molded part approaches the coolant temperature**."* Con pitch flojo, las piezas salen **más calientes Y con más gradiente** — alargar el ciclo no lo arregla hasta el extremo absurdo.

### §9.2.7 — Ruteo (el paso donde todo choca)
- ⭐ **La regla de claro:** *"In general, the mold design should provide **at least half a cooling diameter** between the surface of the cooling line and the surface of **any other mold component**. This requirement maintains the structural integrity of the mold while also **minimizing cooling leaks during mold operation due to corrosion**."*
- **Con qué choca (lista literal):** *"the mold cavity, cavity inserts, core inserts, **ejector return pins, guide pins, sprue bushing**, and other mold components."*
- **El fracaso ejemplar (Fig. 9.9):** aplicar al pie de la letra Ø6.35 / H=12.7 / W=25.4 da un layout **infactible**: *"many of the cooling lines intersect critical mold features such as the sprue bushing or the interface between the cavity inserts and the mold plates."*
- **Las DOS estrategias de rescate:**
  1. *"enlarge the cavity insert, core insert, and associated mold plates to fit all the cooling lines within the envelope"* — *"This option is costly since it requires **redesign of the mold, procurement of a larger mold base, and more machining**. However, such a design **may be economically justified** given the more rapid and uniform cooling."*
  2. ⭐ *"move the cooling lines further from the mold cavity **while maintaining the same pitch to depth ratio**"* — *"While this design provides **poor cooling performance, it is quite common**. A primary advantage is that all of the cooling lines are **not only straight, but each cooling line also passes through a single mold plate** as well. As such, **the cooling lines can be machined in a single setup without any need for seals or gaskets.**"* Costo: menor transferencia y ciclos más largos.
- **La segunda falla, la del núcleo profundo:** con línea recta y núcleo alto, *"The source of cooling is at the base of the core, and heat originates from the plastic all along the height"* → **gradiente de 6 °C** de la base al tope del núcleo, y el tope queda además **6 °C más caliente que la superficie opuesta de la cavidad** → contracción diferencial **a lo largo del eje Y a través del espesor**.
- **Tres salidas declaradas:** *"using a **highly conductive core insert**, implementing a **baffle or bubbler**, or designing a **cooling insert**."*

## 9-D. §9.3 — LAS OPCIONES DE DISEÑO

### §9.3.1 Redes de líneas — **SERIE vs PARALELO (corrección importante al planteamiento)**
Kazmer **NO** prefiere la serie. La jerarquía real, de peor a mejor:

1. **Serie improvisada por el operador con mangueras cortas (Fig. 9.12) — la peor.** *"Such a setup has **two compounding issues**. First, the flow resistance through the combined length of all the cooling lines can be **extremely high, reducing the coolant flow rates**. Second, the mold coolant temperature can increase along the length of the cooling circuit at reduced coolant flow rates. As such, **a significant temperature differential can arise from where the coolant enters the mold to where the coolant exits**."*
2. **Paralelo con manifold EN LA MÁQUINA (Fig. 9.13) — el estándar de facto.** *"many if not most molders have coolant manifolds installed on the molding machine ... This configuration is **extremely common since it is simple and provides effective cooling**. However, the installation and removal of the mold from the machine is **complicated by the number of lines**... The high number of components and operator steps also **increases the likelihood that the cooling system may be setup incorrectly or fail, for instance, due to a loosely connected hose.**"*
3. ⭐ **Manifold INTERNO al molde (Fig. 9.14) — el ganador.** Dos líneas verticales que conectan las ocho horizontales + **veinte tapones (pressure plugs)** → **sólo dos conexiones externas**. *"This internal manifold design has **very little added cost while delivering both increased performance and ease of use**."* Motivación explícita: **lean manufacturing** (menos complejidad de proceso y menos tiempo de setup).
4. **Periférico taladrado a ciegas con tapones (Fig. 9.15) — el más elegante cuando aplica.** Observación previa: *"the portion of the cooling lines located inside the screen area of the bezel **is not removing any significant heat**"* — salvo si es molde de 2 placas con runner frío, **donde esas líneas sí enfrían sprue y runners**. → rutear alrededor del perímetro: *"extreme ease of use, moderate flow resistance, and uniform cooling about the entire molding"*, a costo similar.
- **La llave que abre todo:** *"**Once plugging is considered an option** in the routing of cooling lines, many more complex cooling line layout become available."*

### §9.3.2 Insertos de enfriamiento (canales fresados)
- *"cooling lines that conform to the shape of the mold cavity can be **milled into the rear faces** of the cavity or core inserts ... a **ball end mill** is routed around the bottom of the core insert, after which connecting lines are **drilled to one side** of the mold."*
- **Regla de balanceo:** *"The location of the coolant entrance and exits has been selected to **balance the pressure drop between the internal and external circuits**."*
- ⭐ **El problema de fuga y su regla:** *"a groove has been provided and fitted with a **gasket**. When fastened tightly to the support plate, the gasket will prevent leakage outside the mold. **However, leakage should be expected at any ejector pins located internal to the area surrounded by gasket.** In this application, a **stripper plate** could be successfully used."* — **cualquier expulsor dentro del área sellada = fuga garantizada.**

### §9.3.3 Conformal cooling
- Vía **SLS** (sinterizado láser selectivo). *"Since nearly any geometry can be made with SLS, **helical** cooling lines can be made to conform to the cavity surfaces to improve heat transfer rates and uniformity, thereby **eliminating the temperature gradients**."*

### §9.3.4 Insertos altamente conductivos — **QUÉ LADO NECESITA MÁS ENFRIAMIENTO** ⭐⭐
- Materiales: **Cu 940** o **Al QC7**, *"for portions or the entire core insert"*.
- Resultado en el núcleo profundo del vaso: **gradiente reducido ~60 %**.
- **LA RAZÓN FÍSICA de la asimetría (respuesta directa a "¿qué lado?"):** *"Because of the heat transfer **in three dimensions** and limitations regarding the proximity of the cooling line to the mold wall, **the cavity insert will conduct approximately twice the amount of heat away from the molding compared to the core insert**."*
  → El **NÚCLEO** (macho, típicamente lado B / móvil, y sobre todo en **esquinas internas** y **núcleos esbeltos**) es el que está hambreado de enfriamiento. La cavidad envuelve la pieza por fuera y drena ~2×; el núcleo recibe calor desde tres caras convergentes.
- **La prueba numérica:** P20/P20 → **5 °C** de gradiente a través del espesor en la esquina. P20 cavidad + **Cu 940 núcleo** → **1 °C**.
- ⭐ **Y la trampa:** *"the improved temperature distributions ... were the result of using **different materials for the core and the cavity inserts**. These temperature distributions **would not have been as uniform if both the core and cavity inserts were made from Cu 940**."* — **la asimetría del material es la que corrige la asimetría térmica; simetrizar el material la reintroduce.**
- **Segunda razón para no abusar:** *"these highly conductive materials tend to have **lower hardness and are more susceptible to wear**."*
- **La regla de aplicabilidad:** *"highly conductive inserts may be best when used in applications with **high production volumes, low to moderate injection pressures, and non-abrasive materials**."*
- *"The primary advantage of highly conductive core inserts is **the ability to strategically control the heat flow**."* (no "enfriar más", sino **dirigir** el calor).

### §9.3.5 Enfriamiento de núcleos esbeltos — Tabla 9.3 (la tabla de selección)
| Opción | Ø núcleo | Ø barreno | Tasa de enfriamiento |
|---|---|---|---|
| **Cooling insert** | > 50 mm | > 25 mm | Muy alta |
| **Baffle** | 12–75 mm | 6–25 mm | Muy alta |
| **Bubbler** | 6–30 mm | 3–12 mm | Alta |
| **Heat pipe** | 5–20 mm | 3–12 mm | Media |
| **Conductive pin** | < 5 mm | N/A | Baja |

**El principio:** *"Mold cores with a high length to diameter ratio prevent effective heat transfer along the length of the core, **even with the use of highly conductive materials**"* → hay que **conducir el calor a la superficie del núcleo y luego CONVECTARLO por el centro**. Y el balance: *"Larger cooling channels ... allow for higher coolant flow rates and higher rates of heat transfer. Larger cooling channels, however, require the removal of more volume inside the core and **a lessening of the core's structural integrity**."*

**§9.3.5.1 Cooling insert:** > 50 mm. Múltiples canales alrededor de la periferia y por el largo; retorno por una línea axial. *"Even though the cooling insert design appears extremely complex, it is **readily produced on a four axis milling machine or on a lathe**."*
- **Autocrítica de Kazmer sobre su propio dibujo:** *"This particular design **may favor cooling at too great an expense of core strength**. Depending on the melt pressures, it may be warranted to **move the cooling channels further from the cavity surface while reducing their width**."*
- **Regla estructural:** *"the cooling insert can be provided with a **tight fit to the back surface of the core** so that forces resulting from the melt pressure are **transmitted directly to the support plate**."*

**§9.3.5.2 Baffles:** *"normally inserted into a **drilled hole**"*; **tamaño mínimo: barreno Ø > 6.35 mm (1/4")**. Ejemplo: baffle de 12 mm en núcleo de 60 mm — *"While this design is likely sufficient, **a larger baffle could have been used to reduce the distance between the cooling channel and the cavity surface**."*
- **Limitación estructural:** *"Baffles are **not designed to carry any load in the axial direction** and have **limited load carrying capability in the radial direction (especially straight baffles)**. For this reason, the wall thickness of the core should be designed appropriately according to the analysis in Chapter 12."*
- ⭐ **EL "CLEARLY PREFERRED" REAL DEL CAPÍTULO:** *"In terms of availability, **baffles are standard components readily available from a number of suppliers, whereas cooling inserts must be designed and manufactured**. Given the **complexity, expense, and risk** associated with a custom cooling insert, **the baffle is clearly preferred whenever the molding application allows**."*
  (Ojo: el "clearly preferred" es **baffle sobre inserto de enfriamiento**, NO serie sobre paralelo.)

**§9.3.5.3 Bubblers:** el refrigerante circula **por fuera** del bubbler y regresa **por dentro**. *"The bubbler **does not contact the core** and so carries no load from the core compression. Because of this, the bubbler is designed with very thin wall thickness and compact dimensions."* Bubblers de **< 2 mm de diámetro en barrenos < 3 mm**.
- **Contra:** *"they require **two cooling channels** – one to provide flow around the bubbler and a second to return the flow from inside... the benefit of the smaller hole diameter comes as **greater expense with regard to its installation**."*

**§9.3.5.4 Heat pipes:** dispositivo cerrado con fluido que hierve entre T_melt y T_coolant; ciclo capilar evaporación-condensación. Componente estándar. Pros: **tamaño chico, buena tasa, facilidad de instalación**. Contras: menos efectivo que baffle/bubbler porque *"the bulk conveyance of the mold coolant, which has a high specific heat and a much lower temperature ... provides a much higher rate of heat transfer"*; además **problemas de respuesta inicial** (*"they require a significant temperature gradient to initiate an effective condensation-evaporation cycle"*) y de **efectividad bajo distintas temperaturas de refrigerante y melt**.

**§9.3.5.5 Conductive pin:** < 5 mm, *"the only option may be"*. El refrigerante corre por detrás del pin. ⭐ **Sentencia:** *"With high length to diameter ratios, however, the heat transfer is not very effective. In such cases, **the core pins prevent the flow of heat down the length of the core pins and act primarily as insulators**."* — a partir de cierto L/D **el pin conductivo es un AISLANTE**, no un enfriador.

**§9.3.5.6 Núcleo interlocked con canal de aire:** cuando la geometría lo permite, el núcleo esbelto **se acopla con la cavidad opuesta**. Dos ventajas: (1) soporte → **reduce la flexión del núcleo** (§12.3.3); (2) permite **llevar refrigerante del lado móvil, a través del núcleo, al lado fijo**. *"**Air is typically used** as the coolant in such a design since this coolant will be **exposed to the molded part and the environment when the mold is opened**. While air has a very low density which reduces its cooling effectiveness, this design will provide **much more heat transfer than a solid core pin**."*

### §9.3.6 Flujo de calor unilateral ⭐
- **Dos situaciones comunes:** (1) núcleo esbelto largo; (2) capa aislante debajo (two-shot).
- **La regla de cálculo:** *"Eqs. (9.5), (9.6), and (9.8) may be used by **substituting twice the thickness** of the molding for the variable, h. The result is that any molding application with a one sided heat flow will have a **four fold increase in the cooling time**."*
- Justificación: *"the thermal behavior is essentially the same as if **two layers of the plastic melt were on top of each other**. This double thickness representation is valid since the temperature distribution is symmetric across the centerline so there is no associated heat flux."*
- ⭐ **El juicio de secuencia en two-shot:** ABS 3 mm sobre PC 2 mm → **75.6 s** (uneconómico, porque el ciclo aplica a ambas capas). *"To be more economical, **it is preferable to mold the thinner layer second**."* PC 2 mm segundo → **13.5 s**, menor que los 18.9 s del ABS solo → **no añade tiempo de ciclo**. → **La secuencia de los disparos es una decisión de enfriamiento.**

---

## 9-E. ITERACIONES DECLARADAS (cap. 9)

| Disparador | Regreso a | Acción |
|---|---|---|
| Layout ideal choca con sprue bushing / interfaz inserto-placa | §9.2.5–9.2.7 | (a) **agrandar insertos y mold base** (caro, a veces justificado), o (b) **alejar las líneas manteniendo el ratio pitch/profundidad** (peor enfriamiento, muy común) |
| Línea choca con expulsor / return pin / guide pin / tornillo | §9.2.4/9.2.7 | Bajar diámetro y usar **más líneas**; rutear **paralelo a la geometría de la cavidad**; o mover el vent (§8.3.2) |
| Se necesita menos de **medio diámetro** de claro a otro componente | §9.2.7 | Prohibido — riesgo estructural **y de fuga por corrosión** |
| n_lines cambió | §9.2.2 | **Recalcular Q_line, V̇, ΔT, Dmin** — el bucle está declarado explícitamente |
| Gradiente de 6 °C en núcleo profundo | §9.3 | Tres opciones: **núcleo conductivo / baffle o bubbler / cooling insert** |
| Núcleo demasiado esbelto para baffle (Ø barreno < 6.35 mm) | Tabla 9.3 | Bajar a **bubbler** (< 3 mm) → **heat pipe** → **conductive pin** → **núcleo interlocked con aire** |
| Núcleo grande pero el cooling insert lo debilita | §9.3.5.1 | Alejar los canales de la superficie **y angostarlos**; **ajuste apretado al fondo** para pasar la carga a la placa de soporte |
| Refrigerante requiere ΔT de 0.1 °C, o cavidades 2→8 | §9.2.3 | **Se necesitan varios controladores** |
| Dmin > diámetro deseado | §9.2.4 | Subir diámetro al **plug estándar** siguiente, o partir el circuito (menos longitud en serie) |
| ΔP del refrigerante rebasa la capacidad del controlador (aceite/glicol) | §9.2.4 | Subir el diámetro (Hagen-Poiseuille laminar) |
| Fuga en expulsores dentro del área sellada por el gasket | §9.3.2 | **Stripper plate** en lugar de expulsores |
| Alabeo por gradientes | §9.1.2 | El moldeador alarga el ciclo y usa el molde como **fixture de enfriamiento** — pero §9.2.6 avisa que **con pitch flojo ni así se quita el gradiente** |
| Pieza sale muy caliente y con gradiente | §9.2.6 | **Apretar el pitch**, no alargar el ciclo |
| Two-shot con capa aislante da 75.6 s | §9.3.6 | **Invertir el orden de los disparos**: la capa delgada al final |
| Molde de familia con espesores distintos | §9.2.1 | Considerar **dos moldes separados** — pero se pierden color matching y ensamble a pie de prensa |

## 9-F. JUICIOS HUMANOS (cap. 9)
- **"Saber DÓNDE invertir"** (§9.1.3) — el juicio central del capítulo. La conductividad no compra ciclo linealmente (30 %, no 8×).
- **Aceptar un layout "malo pero común"** (§9.2.7) porque se maquina en un solo setup, todas las líneas rectas, **sin sellos ni empaques**.
- **Aceptar un ciclo dominado por el runner** o rediseñar el runner (§9.2.1).
- **Molde de familia vs dos moldes** (§9.2.1) — física dice dos moldes, negocio dice familia (color matching, ensamble en prensa).
- **Profundidad "arbitraria" dentro de 2D–5D** (§9.2.5) — el rango es tan sólido que dentro de él la elección se vuelve gusto/conveniencia; el análisis se reserva para casos especiales.
- **Pitch según tolerancia del producto** (§9.2.6) — commodity 2–3× profundidad, precisión 1×.
- **Preferencias de taller (§9.2.4):** el diámetro final lo decide el **estándar de plugs, conectores y mangueras del moldeador**, no la desigualdad.
- **Lean manufacturing como criterio de diseño** (§9.3.1): pagar un poco más de molde para bajar el tiempo de setup y los modos de falla del operador.
- **Baffle antes que inserto custom** por disponibilidad, costo y **riesgo** (§9.3.5.2).
- **Cu sólo en el núcleo, nunca en ambos** (§9.3.4).
- **Vida del molde vs presión de proceso** (§9.2.5): el análisis no prohíbe operar más alto; sólo dice que aparecerán grietas desde las líneas de agua.

## 9-G. CRITERIOS DE ACEPTACIÓN — congelar el sistema de agua
1. t_c calculado con criterio de **línea central** (conservador) sobre la **sección más gruesa**; contrastado contra la regla 2·h²; consciente de que la realidad será mayor (contacto térmico + requisitos de calidad).
2. Q_line, V̇ y ΔT_coolant calculados y **verificados contra un controlador comercial real** (gasto y presión).
3. ΔT_coolant ≤ 1 °C (o 0.1 °C en precisión).
4. **Re > 4000** en cada línea (verificado, aunque casi nunca sea el límite).
5. Dmin < D < Dmax, **y D es un tamaño estándar de plug** compatible con el taller.
6. ΔP total del circuito ≤ **la mitad** de la presión de suministro del controlador.
7. **2D < H_line < 5D**, y H_line < k_mold/1000.
8. **H_line < W_line < 2·H_line** (ajustado por tolerancia del producto).
9. Concentración de esfuerzo verificada: P_melt de operación ≤ sigma_endurance / K_t (K_t = 3.3 a 1D, 2.6 a 4D).
10. **≥ medio diámetro de claro** entre cualquier línea y cualquier otro componente.
11. **≤ 2 conexiones externas por mitad de molde**; si hay más, están **etiquetadas "in"/"out"**; todos los componentes externos **rebajados**.
12. Ningún circuito muerto posible por conexión equivocada.
13. Núcleos profundos y esbeltos tienen su solución declarada según Tabla 9.3.
14. Ningún expulsor dentro de un área sellada por gasket.
15. Gradiente máximo en la pieza al momento de expulsión evaluado (el ejemplo tolera ~2 °C por curva de contorno; 6 °C ya se declara problema).

---

# ⭐ LOS 10 DETALLES QUE UNA MÁQUINA LINEAL SE SALTARÍA

**⭐1 — §7.3.2 / §7.3.5 / §7.4 — "STEEL SAFE": el diseño se entrega A PROPÓSITO subóptimo.**
Un optimizador resuelve R para γ̇max y entrega el diámetro exacto. Kazmer entrega **el más chico**, con la intención declarada de que el tryout lo abra. Más aún: **el tipo de gate se elige por si SE PUEDE AGRANDAR**. El acero se quita, no se pone: la irreversibilidad de la manufactura es un criterio de diseño de primera clase. *"specify a smaller gate with the intent that the mold will be tested and the gate sizes increased as necessary."*

**⭐2 — §7.3.4 — El cálculo de un gate puede concluir "cambia el TIPO DE MOLDE".**
*"this edge gate design does gate into a thinner section of the mold cavity, which is not recommended. For this reason, a **three-plate mold or hot runner mold should be considered**."* Una máquina lineal itera dimensiones dentro del tipo elegido; el humano brinca **dos niveles de abstracción hacia arriba** (de gate → a arquitectura de molde). Lo mismo en §7.3.2: ensanchar el edge gate a 14 mm **"would require a change in the gate type to a fan gate"** — la dimensión cambia la clase del objeto.

**⭐3 — §7.2.7 — El degatado automático del tunnel gate depende de un componente de OTRO capítulo.**
45° al plano de partición + cono incluido ≥ 20° + **≥ 3 diámetros fuera del plano de partición** + **sucker pins en el runner**. *"If the tunnel gates and the runner system remain on the cavity side, then they can not be removed through actuation of the ejection system."* Un sistema que valide el gate en aislamiento declara "OK" un molde que **nunca va a degatar**. Y el modo de falla es por **desgaste**: pasa el tryout y falla en producción.

**⭐4 — §8.2.3 — El aire NO se divide entre los vents.**
*"It may seem reasonable to estimate the air flow through each vent as the total volumetric air flow divided by the number of vents. **However, this approach would not be conservative.**"* Cada vent se dimensiona para **todo el flujo local**, porque no se sabe dónde cae el final de llenado. Cualquier implementación "razonable" hace la división y subdimensiona todo el molde.

**⭐5 — §8.3.2 — El vent del expulsor es 0.065 mm A PROPÓSITO, más grueso que el recomendado.**
Claro diametral de taller 0.13 mm (0.005") → 0.065 mm de vent. Kazmer lo justifica con **tres razones que no son de venteo**: fricción y **pandeo del pin**, imposibilidad de rebaba por flexión (va por acero sólido), y que el testigo cae en cara no estética. Una máquina que optimice el vent contra rebaba lo cerraría y **trabaría el expulsor**.

**⭐6 — §8.3.1 — La recomendación práctica CONTRADICE al cálculo, y está bien.**
El cálculo da h_min = 0.06 mm. La recomendación es: *"vents on the parting plane be used **sparingly** with a thickness on the order of **0.02 mm**. If venting is subsequently found to be inadequate, then additional vents can be added or the thickness of existing vents increased."* Es el mismo *steel safe* del gate aplicado al vent. Y el número que gobierna no es el mínimo (aire) sino el máximo (rebaba): *"the minimum thickness of the vent will not generally be a limiting design constraint."*

**⭐7 — §9.2.6 — El cobre EMPEORA la uniformidad; no autoriza a poner menos líneas.**
*"the use of highly conductive materials **actually increases the variation in heat flux** ... **does not directly allow for a wider pitch and a reduced number of cooling lines**."* La inferencia natural ("mejor conductor ⇒ puedo separar las líneas") es **exactamente al revés**. La receta correcta: profundidad grande + pitch = 2× esa profundidad + material conductivo encima.

**⭐8 — §9.3.4 — La cavidad drena ~2× el calor que el núcleo ⇒ los materiales deben ser ASIMÉTRICOS.**
*"the cavity insert will conduct approximately twice the amount of heat away from the molding compared to the core insert."* P20/P20 → 5 °C a través del espesor; P20 cavidad + **Cu 940 núcleo** → 1 °C. Y la trampa: *"These temperature distributions would not have been as uniform **if both the core and cavity inserts were made from Cu 940**."* **Hacer todo de cobre es peor que hacer sólo el núcleo de cobre.** Un optimizador de material por objetivo global nunca llega ahí.

**⭐9 — §9.2.7 — Se acepta un layout térmicamente MALO por manufacturabilidad, y es "quite common".**
*"all of the cooling lines are not only straight, but each cooling line also passes through a single mold plate... **the cooling lines can be machined in a single setup without any need for seals or gaskets**."* El criterio ganador no es transferencia de calor: es **un solo setup, cero sellos**. El costo (ciclo más largo) se paga con los ojos abiertos.

**⭐10 — §9.2.4 — Sólo la MITAD de la presión del controlador es tuya.**
*"The allowable pressure drop is set to 100 kPa, which is ½ of the maximum supply pressure ... to ensure that some supply pressure is reserved for **flow through the cooling hoses from the controller to the mold**, as well as for pressure drops associated with **turns, plugs, etc.**" Y en el mismo paso: la longitud de líneas **en serie se suma** (dos de 302 mm → L = 0.6 m). Un cálculo que use la presión nominal completa y la longitud de una sola línea subdimensiona el diámetro por un factor grande (D va como ΔP^(1/5)·L^(1/5)).

**Casi entran (11–14):**
- §9.3.2 — el gasket sella hacia afuera pero **cualquier expulsor dentro del área sellada fuga** → stripper plate.
- §8.3.3 — el inserto venteado pierde contra una **cuchilla expulsora** por costo y doble función → *"venting inserts are not especially common"*.
- §9.2.3 — **conectar dos líneas en serie duplica el gasto requerido** para conservar la misma distribución de temperatura.
- §9.3.6 — en two-shot, **moldear la capa delgada al final** convierte 75.6 s en 13.5 s. La secuencia de disparos es una decisión térmica.

---

# ANEXO — Errores/typos del texto fuente (importantes para implementar)

Detectados al verificar los ejemplos numéricamente:

1. **§9.2.1** — el texto dice T_eject = 96.7 °C pero **todas las ecuaciones del ejemplo usan 97.6 °C** (transposición de dígitos). Con 97.6 los resultados 8.4 / 18.9 / 22.9 s cuadran exactos.
2. **§9.2.1** — el texto dice *"the diameter of the primary runner is 6.25 mm"* pero el cálculo del runner usa **0.00476 m (4.76 mm)** para dar 22.9 s. Con 6.25 mm daría ~39.5 s.
3. **§9.2.1 / Eq. 9.9** — *"most thermoplastics have a thermal diffusivity on the order of 9·10⁻⁵ m²/s"* está mal por 3 órdenes: la ecuación usa **0.09 mm²/s = 9·10⁻⁸ m²/s**, que es el valor correcto (y el mismo alpha = 8.69·10⁻⁸ m²/s del ABS en todos los ejemplos).
4. **§9.1 / §9.2.5** — h_c se escribe *"1000 W/°C"* y *"1000 W/m°C"*; para que H_line < k/1000 dé 32 mm con k = 32 W/m°C, **las unidades correctas son W/(m²·°C)**.
5. **§8.2.3** — el ejemplo dice W = 10 mm y L = 10 mm pero sustituye 0.1 m en ambos. Como sólo entra la razón L/W, **el resultado 0.06 mm es correcto de todos modos**.
6. **Eq. 8.3** — se lee `h_max = sqrt( 12·mu / (P_melt · t_flashing) ) · L_flash`; el coeficiente exacto del ejemplo es 0.365, redondeado a **0.4·L_flash**.

# ANEXO 2 — Arranque del cap. 10 (incluido en el archivo, contexto para criterios de aceptación)

- **Reparto de responsabilidades (§10 intro)** — el diseñador de molde no es el único responsable de la dimensión: *"The part designer should provide a design with **uniform thicknesses** and achievable specifications. The material supplier should provide consistent polymer resin... The molder should select suitable and consistent processing conditions. **The mold designer should provide a mold with balanced melt filling and cooling, and for which the mold cavity dimensions were engineered for an appropriate shrinkage.**"* → El entregable del cap. 7–9 se define exactamente así: **llenado balanceado + enfriamiento balanceado**.
- **Expansión térmica del molde:** P20 con CTE 12.8·10⁻⁶ m/m°C a 60 °C (40 °C sobre ambiente) → **0.0005 m/m = 0.05 %**. *"it is readily predicted and should be considered when specifying the final mold cavity dimensions **for tight tolerance applications**."*
- **Tolerancias SPI:** estándar típica **±0.4 %**, apretada típica **±0.1 %**. *"In either case, a 0.5% shrinkage rate will cause the molding to be out of tolerance."*

---

# QUÉ SIGNIFICA ESTO PARA EL SOFTWARE (síntesis del analista)

1. **El tipo de gate no es un enum plano** — tiene 5 atributos consultables (runner frío/caliente, degatado por acción de molde sí/no, régimen de cortante ~10k/40k/100k s⁻¹, flujo radial/lineal, **agrandable sí/no**) y el motor debe poder cambiar de tipo **como resultado** de un cálculo dimensional.
2. **El tipo de runner es por rama, no global** (hot drop → cold sub-runners).
3. **Todo cálculo con un "máximo tabulado" necesita bandera de confianza** — γ̇max del apéndice A es orientativo; el proveedor manda; muchas veces se puede más.
4. **El diseño debe emitir un "plan de tryout"**, no sólo cotas: qué dimensión está deliberadamente por debajo y hacia dónde crece (gates, vents).
5. **Los vents necesitan dos listas**: los maquinados y los **candidatos reservados** (~36 candidatos → 8 maquinados, y el molde debe admitir los otros 28).
6. **El bucle de enfriamiento es explícitamente iterativo sobre n_lines** — no es un pipeline de 7 pasos, es 7 pasos con retroalimentación de 9.2.7 → 9.2.2.
7. **El detector de colisiones del agua debe conocer**: cavidad, insertos de cavidad y núcleo, expulsores, **return pins**, guide pins, sprue bushing, tornillos, canales de vent — con claro de **≥ 0.5·D**.
8. **El material del inserto es una decisión POR LADO** (núcleo vs cavidad), y la simetría es un anti-patrón.
9. **Los catálogos son restricciones duras**: plugs DME (5 diámetros), controladores (gasto/presión/temperatura), baffles/bubblers/heat pipes estándar por rango de Ø núcleo (Tabla 9.3). El "óptimo continuo" siempre se redondea al catálogo del taller.
10. **Hay un objetivo de USABILIDAD medible** que hoy nadie modela: número de conexiones externas (meta = 2 por mitad), etiquetado in/out, componentes rebajados, y **número de pasos del operador** en el setup.