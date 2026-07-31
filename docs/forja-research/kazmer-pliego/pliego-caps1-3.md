# RESPALDO — Experimento 'Kazmer es el cliente' (2026-07-31)

He leído el archivo completo (2,775 líneas: caps 1–3 íntegros más el arranque del cap 4 que venía incluido). Aquí va el pliego de requisitos.

---

# PLIEGO DE REQUISITOS — Kazmer, Caps 1–3 (la "entrevista con el cliente")

**Nota de alcance:** el prompt pedía "mold classes SPI (101–105)"; en estos tres capítulos NO aparecen las clases de molde SPI — lo que sí aparece es la escala SPI de **acabados superficiales** (A-1…D-3, §2.3.5). Las clases de molde deben venir de otro capítulo u otra fuente; no inventarlas desde aquí.

---

## CAPÍTULO 1 — Introduction

### 1.1 EL PROCESO A MANO (cap 1)

**Flujo de desarrollo del molde (§1.5, Figura 1.9)** — es un lazo con DOS ciclos de retorno explícitos:

1. **Initial design** → el cliente (product designer) entrega solo: dimensiones generales, espesor, material, cantidad de producción.
2. **Review part design and specifications**.
3. **Develop preliminary mold design & quote** — esto obliga al moldero a estimar de una vez variables de proceso: tonelaje de cierre, tarifa horaria de máquina, tiempo de ciclo (§1.5).
4. **Gate: "Project OK?"** → si NO, regresa al diseño inicial (renegociación con el cliente final).
5. Aceptada la cotización, arranca la ingeniería en serio, EN ORDEN: **Layout design → Feed system → Cooling system → Ejector system → Structural system** (§1.5).
6. **Machining, polishing, assembly & trials**.
7. **Gate: "Moldings OK?"** → si NO, se regresa a rediseñar subsistemas; si hay "fatal flaw", se tira el molde y se rediseña completo (§1.5).
8. **Close project.**

**Dato clave de secuencia (§1.5):** el diseño de subsistemas NO es lineal — "each of the required sub-systems of the mold is designed, which **sometimes requires the redesign of previously designed subsystems**. For example, the placement of ejector(s) may require a redesign of the cooling system." El software debe modelar el flujo como grafo con retornos, no como wizard de un solo paso.

**Concurrencia (§1.5):** para acortar tiempos, la base de molde y materiales se ordenan mientras se detalla el diseño ("many mold-makers do order the mold base and plates upon confirmation of the order") — PERO: "Such concurrent engineering **should not be applied to fuzzy aspects of the design**." Regla operativa: solo se compra por adelantado lo que ya está congelado. Tiempos de desarrollo hoy: semanas, no meses; los clientes exigen garantías de entrega con penalizaciones (§1.5).

### 1.2 REGLAS PRESCRIPTIVAS (cap 1)

- ⭐ **§1.2 — ANTI-SOBREDISEÑO**: "The tendency among novice designers, when in doubt, is to over design. **This tendency should be avoided** since it tends to lead to large, costly, and inefficient molds." → Cuando el sistema no sepa, NO debe engordar el molde por default; debe exponer la duda. Es la regla madre del cliente y una máquina lineal haría exactamente lo contrario (aplicar el caso peor siempre).
- **§1.2 — conflictos son la norma**: el enfriamiento ideal (muchas líneas pegadas a la cavidad) choca con la eyección (pines donde van las líneas). "It is up to the mold designer to consider the **relative importance** of the conflicting requirements" → el software debe detectar el conflicto y pedir prioridad, no resolverlo en silencio.
- **§1.1 — packing**: la máquina típicamente fuerza **1–10% de masa adicional** durante empaque; el filling se optimiza para minimizar presión de inyección y esfuerzos residuales; el packing se minimiza con **estudios de estabilidad de peso de disparo** hasta el freeze-off del gate; el cooling domina el ciclo, EXCEPTO en disparos muy grandes donde la plastificación puede exceder al enfriamiento.
- **§1.1 — reset**: minimizar apertura y carrera de eyectores; la meta del molder es proceso **totalmente automático**.
- **§1.1 — variantes de proceso** (gas assist, dos disparos, etc.): dan diferenciación "but **may increase risk and limit the number of qualified suppliers**" → cada tecnología exótica debe listar su costo en riesgo/proveedores, no solo en dólares.
- **§1.3.1 — anillo localizador**: estándar más común **100 mm (4 in)**; es obligatorio por dos razones (alineación sprue-nozzle y knockout-eyectores).
- **§1.3.1 — alineación A/B**: pines y bujes guía son "crucial"; mala construcción → mala alineación → mala pieza + **desgaste acelerado del molde**.
- **§1.3.2 — espaciado de cavidades**: "It is **generally desired to place the mold cavities as close together as possible** while not sacrificing other functions such as cooling, ejection, etc." → molde más chico = más barato + más fácil para el molder + cabe en más máquinas.
- **§1.4 — dos placas**: ~la mitad de todos los moldes; sus 6 limitaciones están listadas (feed atado al plano de partición, gating limitado, espaciado restringido, fuerzas extra del feed, scrap del runner, ciclo más largo por el runner).
- **§1.4.1 — tres placas**: 3 problemas: (1) el runner frío se moldea cada ciclo (material + ciclo), (2) placas/componentes extra = molde más caro, (3) carrera de apertura grande → exige máquina con más "daylight".
- **§1.4.2 — hot runner**: 2 desventajas: inversión + "**not all molders have the auxiliary equipment or expertise**"; y purga larga en cambios de resina — "In short run production applications having aesthetic requirements, the number of cycles required to start-up or change resins **may be unacceptable**."
- **§1.4.3, Tabla 1.1** — la matriz de decisión de feed system del cliente (gating/material/ciclo/inversión/arranque/mantenimiento × two-plate/three-plate/hot-runner). Tendencia declarada: **alejarse de tres placas** conforme bajan de precio los hot runners.

### 1.3 ITERACIONES (cap 1)

- Gate "Project OK?" NO → regresar a diseño inicial y re-cotizar (§1.5).
- Colocación de eyectores → rediseño del sistema de enfriamiento (§1.5).
- Trials: "Usually, the mold and molding process are sound but **must be tweaked**"; a veces hay "**fatal flaws**… may necessitate the scrapping of the mold and a complete redesign" (§1.5).
- §1.5/§2.1.5: al final del desarrollo hay presión enorme; "mold designers **may be required to redesign and change portions of the mold** and work closely with molders to qualify the mold for production."

### 1.4 JUICIOS HUMANOS (cap 1)

- Prioridad relativa entre funciones en conflicto (cooling vs ejection vs estructura) — §1.2.
- Elección de feed system (Tabla 1.1): es multiobjetivo y depende del molder que lo va a operar — §1.4.3.
- Housing integrado (compacto) vs rieles separados (flexibilidad) — §1.3.1.
- Qué tan "firme" está una parte del diseño para atreverse a comprar material antes de terminar (lo "fuzzy" no se compra) — §1.5.

### 1.5 CRITERIOS DE ACEPTACIÓN (cap 1)

- Trial de molde: primero **funcionalidad básica**, luego muestreo de piezas y **calidad contra especificaciones** (§1.5).
- Entregas con garantía de fecha y calidad, con penalizaciones (§1.5).

---

## CAPÍTULO 2 — Plastic Part Design

### 2.1 EL PROCESO A MANO (cap 2)

**Proceso de desarrollo de producto (§2.1, Fig. 2.1)** — 5 etapas con toll-gates de aprobación gerencial entre cada una: Product definition → Product design → Business & production development → Scale-up → Launch. Los dos atributos que TODO proceso comparte (§2.1): plan estructurado (tracking/completeness) + **toll-gates que sueltan presupuesto solo tras revisión** (mitigación de riesgo). En cada gate el proyecto puede ser "declined, shelved, or modified" (§2.1.1).

**Cuándo entra el moldero (§2.1.5):** las RFQ llegan "usually towards the **end of the concept design stage or near the beginning of the detailed design stage**". Es NORMAL que no haya diseño detallado aún, por dos razones dichas: (1) mucho del diseño de molde puede ir concurrente, (2) la ingeniería de molde **va a sugerir cambios** al producto. → El intake del software NO debe exigir CAD terminado.

**Información mínima para arrancar (§2.1.5):** "The critical part design information required to begin a mold design includes **just the part size, wall thickness, and expected production quantity**." Con eso el diseñador ya produce: layouts iniciales, estimados de costo y **mejoras al diseño del producto**.

**"Detailed design" definido (§2.1.2):** cada componente totalmente especificado en material, forma geométrica, acabado superficial, tolerancias, **proveedor** y costo.

**EL FORMULARIO DE INTAKE (§2.2, Tablas 2.1–2.11) — campos literales:**

- ⭐ **§2.2 — los worksheets son DOCUMENTOS VIVOS**: "the mold design engineer should not consider these worksheets as static pages, but rather as **living documents that are linked to design decisions and decision making processes with routing from and to the right people for information and approval**." → No es un formulario que se llena una vez: es un objeto con estado, vínculos a decisiones, y flujo de ruteo/aprobación (motivado además por ISO/regulatorio, que exige documentación formal). Una máquina lineal lo implementaría como form estático.

**Tabla 2.1 — Application engineering:** Project name; Part/project number; Product/assembly name; Date project initiated; Date cavities required; Date mold trial required; Date volume production required; Target material cost per part; Target mold cost per part; Target processing cost per part; Target total cost per part. — Las fechas "are frequently **negotiated** since they are related to technical feasibility, market success, and also **payment terms**" (§2.2.1). El número de proyecto debe referenciarse en TODA la documentación.

**Tabla 2.2 — Contactos:** Customer name; Customer technical contact name + info; Internal sales/application engineer name + info. ⭐ **§2.2.1 — regla de relación**: puede ser preferible llamar PRIMERO al ingeniero de aplicaciones interno "so as to **avoid continuously contacting the customer regarding what may be considered as potentially trivial issues**." → El software debe rutear dudas: triviales→interno, de fondo→cliente. Detalle 100% humano que una máquina se salta.

**Tabla 2.3 — Production data:** Application lifetime [yr]; Total lifetime production quantity; Available molding hours per year per machine [h/yr]; Minimum production rate [moldings/h]; Maximum production rate [moldings/h]; Expected cycle time; Number of cavities per mold; Family mold [yes/no] + number of parts; Number of molds required. ⭐ **§2.2.2 — campos de doble naturaleza**: "the cycle time and other mold design data in Table 2.3 **may not be available at the start**… these data are **intermediate results from the mold design process**. However, some customers **will provide these details as specifications** that the mold designer must satisfy. If these items are not specified… the mold designer should perform **iterative design with cost analyses** to provide the customer with the most efficient mold designs." → Cada campo necesita un flag: ¿es RESTRICCIÓN del cliente o SALIDA a optimizar? Una máquina lineal los trataría todos como inputs obligatorios.

**Tabla 2.4 — End-use:** End use temperature; End use loading; Allowable deflection; Required yield stress; Required strain to failure; Required impact resistance; Water absorption; Chemical resistance. (El diseñador "should be generally aware" del uso final aunque no lo controle — §2.2.3.)

**Tabla 2.5 — Regulatorio:** ANSI; FDA (Class I/II/III); IEC; MIL-SPEC; ISO; UL. Regla (§2.2.3): el diseñador "**should inquire** about any governing regulations"; "Ideally, the customer **should provide a copy** of any such regulations **and highlight the specific requirements** related to the mold design."

**Tabla 2.6 — Tolerancias:** General tolerance (% mm/mm); Critical tolerance 1; 2; 3. Reglas (§2.2.3): tolerancia típica **±0.4%**, apretada **±0.1%**; se recomienda UNA tolerancia general + **pocas** críticas. ⭐ "**Just because a tolerance is specified does not mean that it is achievable.** In fact, it is not uncommon for product designers to **over-specify** the tolerances." El diseñador "**should discuss** tight tolerance specifications with the product development team, and **communicate** that such specifications **may require prototype molding** to characterize the shrinkage behavior, non-uniform profiling of shrinkage rates…, and mold modifications during mold commissioning." → El software debe DESAFIAR tolerancias, no aceptarlas; y cotizar el costo oculto (molde prototipo + retrabajo en commissioning).

**Tabla 2.7 — Estética:** Color (DIN, RAL, Munsell, AFNOR, NCS, Pantone, other); Color match across assembly?; Gloss level (%); Surface finish (SPI D-3 a A-1); Mold surface texture (supplier/number); **Critical aesthetic surfaces**. Defectos a evitar en superficies críticas: knit-lines, gate blemish, sink, witness marks (§2.2.3).

**Tabla 2.8 — Checklist DFM:** Uniform/minimum wall thickness; Sharp corners avoided; Effective rib design; Effective boss design; Draft applied; Undercuts avoided; Tolerances achievable; Gate locations specified; Flow length required.

**Tabla 2.9 — Checklist DFA:** Number of parts minimized; Top down assembly; Snap fits designed/avoided; Uniform fastener type; Parts symmetric or obviously asymmetric; Molded part take-out requirements. — Doble propósito declarado (§2.2.4): mejorar el producto Y **reducir cambios tardíos** que cuestan tiempo y dinero.

**Tabla 2.10 — Propiedades del plástico** (el CLIENTE especifica el plástico, §2.2.5): Supplier; Trade name; Type; Cost ($/kg); Modulus; Yield strength; Strain to yield; DTUL (0.45 MPa, ASTM D648); No-flow temperature; Melt temperature range; Coolant temperature range; Density; Specific heat; Thermal conductivity; Thermal diffusivity; Thermal expansion coeff; Shrinkage range; **Maximum shear rate**; Viscosity and PvT coefficients. Fuentes alternas: Appendix A, resin suppliers, ides.com, matweb.com.

**Tabla 2.11 — Propiedades del material del molde** (el DISEÑADOR lo especifica, §2.2.5): Supplier; Trade name; Type; Composition; Cost ($/kg); Density; Modulus; Yield stress; **Fatigue limit stress**; Hardness Brinell; Strain to yield; Specific heat; Conductivity; Diffusivity; Cutting speed (carbide); Feed per tooth; Volume machining rate; Area machining rate. Regla (§2.2.5): "The mold designer **should verify** the mold material properties… with the material supplier, **and document the assumed material properties** that govern the mold design." → Trazabilidad de suposiciones.

### 2.2 REGLAS PRESCRIPTIVAS (cap 2 — el oro de diseño de pieza, §2.3)

**Pared (§2.3.1):**
- "Parts of varying wall thickness **should be avoided**" (costo Y calidad; enfriamiento diferencial → distorsión por el alto CTE del plástico).
- "**Extreme** differences in wall thicknesses should be avoided **if at all possible**" — vacíos internos aun con packing/cooling extendidos.
- Escalera de mejora (Fig. 2.2): peor = flujo delgado→grueso con transición brusca (jetting + mala réplica + solidificación prematura); mejor = **invertir la dirección de flujo** (grueso→delgado); mejor aún = **transición gradual**; ideal = **pared delgada uniforme + ribs** donde se necesite rigidez. Subir el espesor nominal elimina problemas de calidad pero "can lead to excessive material consumption and extended cooling times."

**Ribs (§2.3.2):**
- Receta: base = **70% del espesor de pared**, altura = **4× espesor**, paso = **10× espesor**, draft 2° (Fig. 2.3).
- Justificación económica citada: rigidez equivalente a pared 30% más gruesa, que consumiría **~15% más material** y **70% más ciclo**.
- "Ribs **thicker than 70%**… will tend to draw material away… **internal voids or sink** on the side opposite the rib."
- Excepción con criterio: "In **non-aesthetic** applications that use **highly filled** materials with lower shrinkage, the rib thickness **can be increased**. Otherwise, a rib thickness less than 70%… **should be used** in molding applications with unfilled materials."

**Bosses (§2.3.3):**
- Boss, rib y gusset al **70%** del espesor nominal; configuraciones: boss en esquina con 2 ribs+gusset a 120°; boss sobre rib con 2 gussets a 90°; boss libre con ribs gusseted para superficie de ensamble elevada.
- "Designed bosses **must be able to withstand** the torque applied during insertion of the self-threading screws **as well as** the potential tensile pull-out forces" — y a la vez "**should not** be designed with overly thick sections" (ciclo/estética).
- ⭐ **Draft selectivo**: en las Fig. 2.4 "**no draft was utilized on the bosses and gussets**… **using less draft on these features can aid in increasing the stiffness and strength** of the molding **without significantly increasing the ejection forces**" (porque son features chicos respecto a la pieza). → Una máquina lineal aplicaría el draft global a TODO; el cliente deliberadamente NO lo hace en features estructurales pequeños.

**Esquinas (§2.3.4):**
- "Sharp corners in molded products **should be avoided**" por TRES frentes: producto (concentración de esfuerzos, fallas frágiles; caja de esquinas vivas y lados altos pierde rigidez torsional vs redondeada), molde (maquinado especial/múltiples herramientas decrecientes), proceso (la esquina restringe el flujo de calor al core y lo facilita al cavity → contracción diferencial a través del espesor → warpage).
- Receta: fillet exterior = **150% del espesor**; interior = **50%** (mantiene espesor constante en la vuelta); **filetear ANTES de shell** en el CAD.
- "These fillet recommendations are **only guidelines**. In fact, **even larger fillets should be used if possible**."
- ⭐ **Radio = herramienta de catálogo**: "the mold designer **should suggest a fillet radius that corresponds to readily available tooling geometry** so that custom tools need not be custom made." → Regla de fabricabilidad que vive en el catálogo de cortadores, no en la geometría; nadie lineal la deduce.
- Chamfer: **½ espesor de pared**, típico 45°, en esquina interior; grandes chamfers también antes del shell (§2.3.4).

**Acabado y textura (§2.3.5):**
- SPI A-1 (#3 diamante, ~0.01 μm Ra) … D-3 (#24 óxido, ~4 μm Ra) — Tabla 2.12 completa.
- **Por qué el costo es superlineal**: "to effectively apply a given surface finishing method, the mold maker must **successively apply all lower level finishing methods**" (para C-3: blast grueso + fino + piedra #320). → El costo del acabado N incluye todos los N-1.
- Trampa de calidad: "molds with high levels of finish can produce moldings in which **defects are highly visible**, thus adding cost to the injection molding process **and mold maintenance**."
- Texturas: exigen preparación previa — **SPI B para texturas someras** (~pocas μm), **SPI C para texturas rugosas**; si no, el mal acabado subyacente se ve a través de la textura. Profundidades de referencia (Tabla 2.13): sand 50 μm→B; leather 125 μm→C; netting 150 μm→C; wood grain 250 μm→D.
- Texturizado = **subcontratación especializada** ("a relatively small subset of companies"); el plan del proyecto "must provide **adequate time and money** for the mold texturing". El pulido también se subcontrata a países de bajo costo por su alto contenido de mano de obra.
- Texturas suman valor percibido, esconden defectos (knit-lines, blemishes) y dan función (grip, ocultar rayones) — argumentos de venta que el software puede ofrecer.

**Draft (§2.3.6):**
- "A **minimum draft angle of 0.5° is usually necessary**, with **1 to 2° commonly applied** according to **material supplier recommendations**."
- Regla de dedo clave: "**an additional 1° of draft commonly applied per 20 μm of surface roughness or texture depth**."
- Draft bajo (½–1°) en ribs "may cause the part to **excessively stick** in the mold"; el sticking "**can be compounded** when molding with **mica and/or glass filled** materials" (baja contracción + alta rugosidad).
- Dirección de ajuste: **aumentar** draft para glass-filled/baja contracción; **puede disminuirse** para materiales muy flexibles (soft PVC). "the allowable draft angle is a **complex function** of the material behavior, processing conditions, and surface finish" — Tabla 2.14 (A-1 acrílico 0.5°; B-3 ABS 1.5°; sand 20%GF PC 2°; leather soft PVC 4°; **leather ABS 7.5°**).
- Tensión con producto: los diseñadores evitan el draft (estética, volumen interno) — el moldero lo impone por eyección (§2.3.6). En ribs: menos draft = ribs más altos/rígidos (deseable) pero se pegan (§2.3.6).

**Undercuts (§2.3.7):**
- "When possible, undercuts **should be avoided**" (mecanismos complejos, molde más difícil de usar, "and **even damage the mold if used improperly**").
- Proceso humano: "the mold design engineer should **identify undercuts, alert the customer, and work with the product design engineer to remove** the undercuts."
- ⭐ **La excepción**: "However, undercuts **should NOT be designed out** of the product if the function… is **vital** to the product **or** the removal would necessitate **additional post-molding operations** or the **redesign of a single part into multiple pieces**." → La máquina no debe "optimizar" quitando undercuts a ciegas: debe comparar costo del mecanismo vs costo de operaciones post-molde/multi-pieza y PREGUNTAR.
- Los 4 undercuts típicos que el cliente reconoce a ojo (Fig. 2.7): ventana en pared lateral, overhang sobre pared de fondo, boss horizontal, snap finger. "Much of the time, the product designer is **unaware**" — el software debe detectarlos y explicarlos.

**Ética/relación (§2.2.4):**
- ⭐ "a mold designer may understand that the cost of the mold could be reduced by slightly changing an angle… to eliminate an undercut **but remain silent to justify the need for a core pull and a higher priced mold**… **it is a losing long term strategy**. Rather, the most successful mold suppliers **seek to add value**… by providing services that improve the quality and reduce the cost of their customers' products." → Requisito de producto: el sistema SIEMPRE muestra al cliente el rediseño que abarataría su molde, aunque baje el ticket. Es política de negocio del cliente, invisible para una máquina que optimiza margen.
- §2.2.4: "Rather than assume that the product design is finished and unchangeable, the mold designer **should check** that the part has been specifically designed for injection molding" — los diseños "terminados" que llegan suelen ser "really substandard".

### 2.3 ITERACIONES (cap 2)

- Cada toll-gate gerencial puede regresar/declinar/modificar el proyecto (§2.1, §2.1.1).
- Alpha no satisfactoria → "the manufacturing processes, associated tooling, **and detailed component designs are adjusted** as appropriate" (§2.1.3). Beta → "the design and manufacturing of the product **may be revised**" (§2.1.4).
- Tolerancias apretadas → vuelta a hablar con el equipo de producto + posible **molde prototipo** + modificaciones durante commissioning (§2.2.3).
- Undercut detectado → vuelta con el diseñador de producto para removerlo… o no (§2.3.7).
- Review DFA para "reduce the number of **late design changes**" (§2.2.4) — la iteración que se PREVIENE también cuenta.
- El moldero al final del proyecto: rediseñar porciones del molde y calificarlo con el molder (§2.1.5).

### 2.4 JUICIOS HUMANOS (cap 2)

- Negociación de fechas hito (ligadas a pagos) — §2.2.1.
- ¿A quién preguntarle qué? (cliente vs ingeniero interno) — §2.2.1.
- ¿Tolerancia crítica de verdad o sobre-especificada? — §2.2.3.
- ¿Rib más grueso? Solo si no-estético + material cargado — §2.3.2.
- ¿Cuánto draft? Función compleja material×proceso×acabado; tablas son puntos de partida — §2.3.6.
- ¿Quitar el undercut o pagar el mecanismo? — §2.3.7.
- ¿Fillet más grande que la guía? "even larger… if possible" contra estética/volumen — §2.3.4.
- ¿Decirle al cliente que su pieza está mal diseñada? Sí, siempre (política) — §2.2.4.

### 2.5 CRITERIOS DE ACEPTACIÓN (cap 2)

- Antes de diseñar el molde: "A detailed review of the plastic part design **should be conducted** prior to the design and manufacture of the injection mold" (§2.3) — con las checklists 2.8 y 2.9 como gate.
- Producto: alpha pasa "battery of tests to verify performance levels, regulatory compliance, and user satisfaction" (§2.1.3); beta va a marketing/ventas/clientes clave (§2.1.4); release solo cuando TODOS los stakeholders están listos (§2.1.4).
- Documentación: worksheets completos, con propiedades verificadas con proveedor y suposiciones documentadas (§2.2.5); número de proyecto en todo documento (§2.2.1).

---

## CAPÍTULO 3 — Mold Cost Estimation

### 3.1 EL PROCESO A MANO — cotización (§3.1)

**Vista del comprador:** RFQs a varios molderos → las cotizaciones regresan variando **hasta 3× o más** → "prospective mold purchasers **should ask about the details** of the provided quotes, **and check if the costs can be reduced through product redesign**" → listas de proveedores calificados (más rápido, calidad uniforme, mejor precio) → la relación madura elimina la cotización: **"cost plus"** (labor + materiales facturados). Selección final: "the most preferable **combination** of molded part quality, payment terms, delivery terms, and service" — NO solo precio (§3.1).

**Vista del proveedor (nuestro cliente):** invertir mucho tiempo en una cotización con baja probabilidad de ganar; "Sometimes, the mold designer may have to **redesign the product and perform extensive analysis** to provide the quote"; una cotización cara puede ser el molde de mejores materiales/mano de obra que **se paga solo en producción** (§3.1) — la cotización debe poder ARGUMENTAR eso.

**Regla de honestidad (§3.1):** ajustar la cotización según si quieres o no el negocio (ocupado→inflar, ocioso→bajar) "**should be avoided** since the provided quote does not represent the **true costs** of the supplier, which would become the basis in a long term and mutually beneficial partnership."

**Términos de pago típicos (§3.1):** tres tercios — (1) al aceptar la cotización (ahí se compran base de molde y materiales clave); (2) a mitad del proyecto ("often when **cavity inserts have been machined**"); (3) "**upon acceptance of the quality of the molded parts**". → El tercer pago ata el cobro a un criterio de aceptación del cliente final.

**Calendario de gastos (Fig. 3.1):** mes ~3 = trials con **~cien piezas pre-producción** para marketing y pruebas; mantenimiento aparece intermitente durante producción.

**Integrados verticales (§3.1):** fee inicial + precio por pieza; contratos con **cantidades mínimas garantizadas** y descuentos/penalizaciones por cambios de calendario.

### 3.2 EL PROCESO A MANO — estimación (§3.3–3.4, la secuencia que el software ya tiene en ecuaciones; aquí lo que la rodea)

Orden real del cálculo: (1) dimensiones de insertos desde la pieza → (2) material de insertos (juicio) → (3) tiempos de maquinado (volumen+área, complejidad, proceso, eficiencia) → (4) acabado por zonas → (5) descuento por multiplicidad de cavidades → (6) base de molde (masa estadística) → (7) customizaciones por subsistema (factores) → (8) costo por pieza (amortización×mantenimiento + material×waste + proceso + yield) → (9) **leer el resultado y juzgarlo** (ver ⭐ abajo).

**Reglas en prosa alrededor de las ecuaciones:**

- **§3.3 (repetido 3 veces en el capítulo)**: usar los apéndices O "provide more application specific data as available" / "the negotiated machinist's rate should be used if this data is available" / el discount factor "may be replaced with application-specific data". → Todo coeficiente del sistema debe ser sobreescribible por dato real del taller.
- **§3.3.1**: insertos = "the single largest driver of the total mold cost" (contienen todo el detalle, materiales duros, acabado fino). Maquinado de cavidad = "the single most significant driver".
- **§3.3.1.2 — ejemplo**: elección de D2 "Since this is a **tight tolerance part with a high production quantity**, tool steel D2 is selected for its **wear and abrasion resistance**" — la selección de acero es juicio guiado por tolerancia+volumen.
- **§3.3.1.3**: tarifa varía por costo de vida (Alemania vs Taiwán), toolset y utilización de planta (5 ejes NC cobra más que 3 ejes manual). Supuesto conservador declarado: volumen a remover = TODO el volumen del inserto ("This may seem an overly conservative estimate, but in fact much of the volume must be removed around the outside of the core… and the inside of the cavity").
- **§3.3.1.3 — complejidad**: los métodos por conteo de features son "time consuming and dependent upon the **subjective opinion** as to what constitutes a dimension or feature" — por eso su factor es geométrico (A·h/V). Referencias visuales: 1.02 (charola simple) a 3.1 (Tabla 3.3).
- **§3.3.1.3 — machining factor**: turning/drilling 0.5, milling 1, **grinding 4, EDM 4**; el factor de la aplicación = **promedio ponderado según la proporción de uso** de cada proceso (Tabla 3.4). En el ejemplo, el juicio: "the laptop bezel contains **many narrow ribs that will be produced primarily with EDM**, a machining factor of 4 is used" — reconocer qué features fuerzan EDM es juicio humano.
- **§3.3.1.3 — eficiencia**: "In theory… 100%. In reality, the efficiency **rarely exceeds 50%**… a machining efficiency rate of **25% is recommended** for cost estimation" (programación, herramientas, setups, electrodos, verificación).
- **§3.3.1.3 — tarifa facturada vs salario**: salario directo $23.94/h vs facturado **100 $/h** — la diferencia son prestaciones, planta, herramientas, overhead y utilidad. El sistema debe cotizar con tarifa FACTURADA.
- **§3.3.1.4 — descuento por cavidades**: −15% por cada duplicación; "after 16 cavities, it is difficult to further improve" (0.52 piso); basado en human factors research.
- **§3.3.1.5 — acabado**: 5–30% del costo total del molde; sumar por zonas con acabados distintos y **restar el área premium del área general para no contarla doble** (así lo hace el ejemplo); "finishing… is sometimes outsourced".
- **Footnote 1 (§3.3.1.3)**: moldes prototipo en aluminio en NC de alta velocidad: costos precisos y bajos, pero "comparatively soft and often **not appropriate for molding high quantities**"; ojo — aleaciones de aluminio duras nuevas "are increasingly cannibalizing conventionally manufactured steel molds" (tendencia de mercado que el cliente vigila).
- **§3.3.2 — layout inicial**: n_length = n_width = ceiling(√n) "will tend to make the mold have larger size and cost than might actually be realized, but will provide **at least a reasonable estimate**" — sesgo conservador deliberado y declarado.
- **§3.3.3 — customizaciones**: qué escala con qué (pockets ∝ #cavidades y dimensiones; runner ∝ tipo feed + #gates; cooling ∝ #líneas ∝ #cavidades; barrenos de eyectores ∝ #pines ∝ geometría). Defaults típicos declarados: "A **simple** molding application with **one to four cavities** might use a **two plate cold runner**"; "**high production volume and sixteen or more cavities**, a **thermally gated hot runner**"; "**Many molds** use straight [cooling] lines with o-ring and fittings"; "**Most molds** can be assumed to use a mix of round ejector pins, blades, and sleeves"; "**Most molds with high production volumes**… support pillars and parting plane interlocks"; miscelánea (sensores, 2-shot…): "For most molds, **none** of these customizations are required." Los factores INCLUYEN la compra de componentes (hot runners, fittings, core pulls) — no sumar aparte.
- **§3.4.1 — mantenimiento**: "the maintenance costs **can far exceed the purchase cost** across the operational lifetime of the mold"; el factor crece con abrasividad de resina vs dureza de molde (Tabla 3.11: de 2 hasta **20** para aluminio/acero suave con fibra de vidrio). Niveles de mantenimiento reales del molder: preventivo tras CADA corrida, inspecciones/reparaciones menores intermitentes, general trimestral/semestral, rebuild según necesidad. En el ejemplo: ABS+D2 endurecido → "the maintenance coefficient will fall between 2 and 5 — **a factor of 3 is estimated**" (interpolación a juicio).
- **§3.4.2 — waste**: cold runner 1.25; cold runner con regrind pleno 1.08 (el regrind cuesta labor+energía); hot runner corridas cortas 1.05 (consume mucho en arranque); largas 1.02.
- **§3.4.3 — ciclo**: t = 4·h²·f_eff; f_eff: semiauto con operador 2.5/3.0 (cold/hot), gravedad o robot 1.5/2.0, full-auto 1.0/1.5. Realidad del mercado: "many molders **continue to use cold runner molds operating in semi-automatic mode**" aunque lo deseable sea full-auto+hot runner.
- **§3.4.3 — máquina**: factores aditivos (utilidad del molder +0.1; robot+banda +0.05; control hot runner +0.05; gas assist +0.1; operador dedicado +0.15; 2-shot +1.0; 3-shot +1.4); "The cost of **all auxiliaries** should be added… they **should provide a net savings**" (si el auxiliar no se paga solo, sobra).
- **§3.4.3 — clamp**: estimado conservador con **75 MPa promedio × área proyectada**; el ejemplo advierte: "the **true required clamp tonnage is likely less** than 294 metric tons since the laptop bezel has a **large window** in it. The analysis, however, is conservative." → El área proyectada de piezas con ventanas/huecos sobreestima; el humano lo descuenta mentalmente.
- **§3.4.4 — yield**: defectos comunes listados (short shot, flash, contaminación, color, splay/blush, warpage/dimensional, burn, gloss); el molder FILTRA internamente antes de embarcar; yields: **50–60% en arranque** de aplicación difícil → ~100% commodity maduro; tabla: 10k ciclos 0.95/0.90, 100k 0.98/0.95, 1M 0.99/0.98 (low/high quality requirements).

### 3.3 ITERACIONES (cap 3)

- **§3.2.2**: "**multiple mold designs should be developed for different target production quantities**, and the total production costs estimated and compared via break-even analysis"; a volúmenes intermedios (~500k) el óptimo no es ni 2 ni 32 cavidades → "multiple designs and cost estimates **should be developed until** a good balance is achieved… **If necessary, the customer can be given more than one design** to select the design that they think will ultimately be best." → El entregable puede ser un MENÚ de moldes, no un molde.
- **§3.3.3 — ejemplo final**: "may over estimate the cost of the mold if made in Asia… **Accordingly, the analysis could be repeated** for a cold runner mold with different labor cost coefficients."
- ⭐ **§3.4.4 — ejemplo final, LA señal de re-cotizar**: "The **large cost of the mold relative to the material and processing costs indicates that the mold may have been over designed. Further cost analyses should be performed** to analyze the effectiveness of a cold runner mold design with a lower initial mold cost." → Regla de dedo emergente: si la componente de molde amortizado DOMINA el costo por pieza, es bandera de sobrediseño → generar automáticamente la alternativa más barata y comparar. Una máquina lineal entrega el número y se queda tan tranquila.
- **§3.5**: "It is recommended that **multiple cost estimates be developed for different mold designs until an effective mold specification is established**" — la cotización ES un proceso iterativo por diseño.
- **§3.1**: comprador puede regresar con "check if the costs can be reduced through **product redesign**" → vuelta al cap 2.
- **Cap 4 (arranque, líneas 2755–2770)**: "Mold bases are only available in **discrete sizes**, so **iteration between the inserts' sizing and mold base selection is normal**"; y el layout es caro de cambiar "once the mold making process has begun" — congelar tarde, iterar temprano.

### 3.4 JUICIOS HUMANOS (cap 3)

- ¿Quiero este negocio? — el cliente dice que NO se cotice distinto por hambre/saturación (§3.1); pero la decisión de entrar a competir sí es humana.
- Defender una cotización cara con el argumento de vida útil/productividad (§3.1).
- Elección de acero de insertos por tolerancia+volumen+abrasividad (§3.3.1.2, §3.4.1).
- Proporción de EDM/grinding/milling según los features de la pieza (§3.3.1.3).
- Factores no-económicos que vetan al ganador del break-even (§3.2.2): **cambios rápidos de color** (veta hot runner, ver §6.4.8), **capacidad y preferencia del molder** ("the mold should be designed to **maximize the molder's capability** unless the application requirements and cost constraints dictate otherwise"), **estandarización lean** del molder en un tipo/tamaño de molde; aplicaciones avanzadas → escoger molder con capacidades especializadas.
- Payback corto exigido por muchos molders/clientes: se mira la curva de costo total y solo se acepta hot-runner de alta cavitación con payback deseable (§3.2.2).
- Sanity check geográfico del resultado ("reasonable for… United States… may over estimate… Asia") (§3.3.3).
- Interpolar coeficientes de tablas (mantenimiento "entre 2 y 5 → 3") (§3.4.1).
- Descontar mentalmente el clamp por ventanas en el área proyectada (§3.4.3).

### 3.5 CRITERIOS DE ACEPTACIÓN (cap 3)

- La cotización entregable incluye: costo del molde desglosado (cavidades/base/customización), costo por pieza (molde amortizado+mantenimiento, material, proceso, yield), términos de pago (tercios) y de entrega (§3.1, §3.3, §3.4).
- El pago final del molde se libera "**upon acceptance of the quality of the molded parts**" (§3.1) — el criterio de cierre es del cliente final, sobre piezas, no sobre el molde.
- Auto-revisión antes de soltar la cotización: ¿el número es razonable para la geografía? ¿la proporción molde/material/proceso delata sobrediseño? ¿se exploraron cavitaciones alternativas y el break-even? (§3.3.3, §3.4.4, §3.5).
- Contratos con mínimos de producción y penalizaciones/descuentos por cambios de calendario (§3.1).

---

## LOS 10 ⭐ — lo que una máquina lineal se saltaría

1. **§1.2 — Anti-sobrediseño**: ante la duda NO engordar el molde; exponer la duda. (La máquina haría worst-case siempre.)
2. **§2.2 — Worksheets = documentos vivos** con ruteo, aprobaciones y vínculo a decisiones, no forms estáticos.
3. **§2.2.1 — Ruteo de preguntas**: lo trivial al ingeniero interno, no al cliente; proteger la relación.
4. **§2.2.2 — Campos de Tabla 2.3 con doble naturaleza**: cada uno es restricción del cliente O salida a optimizar; si faltan, el sistema itera diseño+costo para proponerlos.
5. **§2.2.3 — "Just because a tolerance is specified does not mean that it is achievable"**: desafiar tolerancias, cotizar molde prototipo + retrabajo de commissioning como consecuencia.
6. **§2.2.4 — Nunca callarse un rediseño que abarata el molde del cliente** (aunque baje el ticket propio): política de negocio explícita.
7. **§2.3.3 — Draft selectivo**: deliberadamente MENOS/CERO draft en bosses y gussets pequeños para ganar rigidez sin castigar eyección; el draft global no se aplica ciegamente a todo.
8. **§2.3.4 — El radio de fillet se elige del catálogo de cortadores disponibles** para no mandar a hacer herramienta custom.
9. **§2.3.7 — Excepción de undercuts**: NO eliminarlos si la función es vital o si quitarlos obliga a operaciones post-molde o a partir la pieza en varias; comparar y preguntar.
10. **§3.4.4 + §3.5 — Leer la proporción del costo**: si el molde amortizado domina el costo/pieza → bandera de sobrediseño → generar y comparar automáticamente la alternativa más barata; la cotización termina cuando la ESPECIFICACIÓN converge, no cuando sale el primer número.

**Menciones que casi entran al top-10** (también implementarlas): §1.5 concurrencia solo sobre lo no-"fuzzy"; §3.1 la cotización nunca se infla/desinfla por carga del taller (representa costos VERDADEROS); §3.3.1.3 eficiencia de maquinado al 25% (no 50%, no 100%) y tarifa FACTURADA ≠ salario; §3.4.3 descuento de clamp por ventanas en el área proyectada; §3.2.2 el molde se diseña para maximizar la capacidad del molder que lo va a operar; §3.3.1.5 restar áreas premium para no contar doble el acabado.

---

## IMPLICACIONES DIRECTAS PARA EL MOTOR (síntesis del analista)

1. **Intake mínimo de 3 campos** (tamaño, espesor, cantidad) debe producir un entregable completo (layout + cotización + sugerencias de rediseño) — §2.1.5. Todo lo demás (Tablas 2.1–2.11) se llena progresivamente como documento vivo con estado restricción/salida.
2. **El flujo es un grafo con retornos**, con tres lazos: subsistema→subsistema (eyector→cooling, §1.5), cotización→rediseño de pieza (§3.1/§2.3), cotización→cotización (multi-diseño hasta converger, §3.2.2/§3.5) — más el lazo inserto↔base discreta del cap 4.
3. **Toda tabla de coeficientes es default sobreescribible** por dato del taller/aplicación (mandato repetido en §3.3, §3.3.1.3, §3.3.1.4).
4. **Las decisiones de §3.2.2 (feed system, cavitación, molder) y §2.3.7 (undercuts) se presentan como menú con trade-offs** — el cliente lo dice literal: "the customer can be given more than one design".
5. **Cada estimado conservador está declarado como tal** (volumen de remoción = inserto entero; clamp a 75 MPa sobre área proyectada; ceiling(√n)) — el software debe etiquetar el sesgo, no esconderlo.

Archivo fuente: `/tmp/claude-1000/-home-ian-Orkesta-la-forja/86616bb5-44f5-4a6d-903c-b7ac70b28c29/scratchpad/kazmer-caps1-3.txt` (cubierto al 100%, líneas 1–2775).