# EL PLIEGO DE ANÁLISIS — Kazmer caps. 1–3
## Ingeniería inversa del modelo mental: qué se calcula, en qué orden, y qué decide

**Fecha:** 2026-08-06 · **Alcance:** cap. 1 (el molde, su nomenclatura y el flujo de desarrollo),
cap. 2 (diseño de la pieza para moldeo: worksheets, espesor, costillas, bosses, esquinas, acabado,
draft, undercuts), cap. 3 (COSTO: drivers, estimación del molde, costo por pieza, yield, cotización),
más el arranque del cap. 4 que venía en el mismo tomo y **cierra** el lazo del costeo (inserto ↔ base discreta).

---

## Por qué existe este documento

El libro de Kazmer **no tiene** un capítulo llamado "análisis a realizar". Tiene a un ingeniero
razonando en voz alta. Cada vez que compara, despeja, sustituye un número o dicta un veredicto,
eso es un análisis — y el grafo que los conecta lo da por obvio porque lo tiene en la cabeza.
Este pliego lo vuelve explícito.

Ya se hicieron dos lecturas del mismo corpus con otras lentes:
- **UI** — `pliego-UI-v2.md`, `pliego-caps1-3.md`, `libro-caps1-3.md` (qué pantallas hacen falta).
- **Verificación visual** — `verificaciones-visuales.md`, 122 fichas (qué se juzga MIRANDO).

Ésta es la tercera: **ANÁLISIS** (qué se calcula, con qué entra, qué sale, y qué decide).

En estos tres capítulos el reparto es muy desigual, y eso ya dice algo del modelo mental:
- **Cap. 1 casi no calcula** — pone la topología del proceso (el grafo con sus dos gates y sus retornos)
  y la regla madre de sesgo (§1.2 anti-sobrediseño). Sus "análisis" son de encuadre y de conflicto.
- **Cap. 2 califica geometría** — casi todo es un umbral sobre una razón adimensional (70 %, 150 %, 50 %,
  4×, 10×, 0.5°). Son baratos, se corren temprano y todos son gate del cap. 3.
- **Cap. 3 es el motor** — 25 de las 58 fichas. Es una cadena aritmética casi sin ramas hasta que
  llega al final y **se lee a sí misma**: la proporción del resultado dispara los retornos (§3.4.4, §3.5).

## Qué cuenta como "análisis" aquí

Unidad de razonamiento que **toma datos, produce un número o un veredicto, y alimenta una decisión**.
Si no alimenta ninguna decisión, es lección, no análisis, y no tiene ficha (al final hay una lista
corta de lo que se descartó por esa regla, para que se vea que fue decisión y no olvido).

Cada ficha lleva nueve campos fijos:

| Campo | Qué contiene |
|---|---|
| **ID y nombre** | `A-nn`, numeración corrida a lo largo de los tres capítulos |
| **CUÁNDO** | en qué momento del flujo se corre |
| **ENTRADAS** | y de qué análisis vienen (`←A-nn`) — esto es lo que arma el grafo |
| **EL CÁLCULO** | ecuación literal con su número de ecuación del libro; si es cualitativo, se dice |
| **SALIDA** | con unidades |
| **DECIDE** | la decisión concreta que alimenta |
| **CRITERIO** | umbral del libro / comparación / juicio humano — se declara CUÁL de los tres |
| **INVALIDA** | qué lo tira a la basura y obliga a recorrerlo |
| **¿TENEMOS?** | archivo y función en `src/forja/mold/`, o **FALTA** |

> **Nota de fusión:** los IDs `A-001…A-058` son **locales a este tomo (caps. 1–3)**. El tomo de caps. 7–9
> usa la misma numeración corrida desde `A-001`. Al juntar los cuatro tomos hay que prefijar
> (`C13-A-001`, `C79-A-001`, …) o renumerar; las referencias internas de este documento son consistentes
> entre sí y con las citas `§`.

## Fuente y su límite (regla dura)

Los tomos crudos del libro **ya no existen** (se perdieron en una limpieza de disco). Este pliego se
construyó sobre el corpus DERIVADO, que sí conserva **citas literales verificadas con grep**:
`libro-caps1-3.md`, `pliego-caps1-3.md`, `verificaciones-visuales.md` (fichas V1.1 y V2.1–V2.7) y `cruce.md`.

- **Toda cita entre comillas de este documento existe textualmente en el corpus.** Verificada con `grep`.
- Lo que no es cita y es deducción mía va marcado **`INFERIDO`**.
- Lo que sospecho que el libro dice y el corpus derivado **no capturó** va marcado
  **`NO OBSERVADO EN EL CORPUS`** — es información útil (dice dónde volver a leer si el tomo reaparece),
  no un fracaso.
- **Hueco de fuente específico de este tomo:** `verificaciones-visuales.md` tiene fichas V1.x y V2.x
  pero **no tiene ninguna ficha V3.x** — el cap. 3 no aporta verificaciones visuales porque es economía,
  no geometría. Sus figuras (3.1 calendario de desembolsos, 3.2–3.3 drivers, 3.4 break-even log-log,
  3.5 desglose del bezel) son gráficas de datos, y su contenido gráfico está **NO OBSERVADO EN EL CORPUS**.

## Convenciones

- Fórmulas en ASCII. `rho` = densidad, `kappa` = costo por kg, `eta` = eficiencia de maquinado,
  `f_*` = factor adimensional, `h` = espesor de pared, `A` = área, `V` = volumen, `n` = cantidad.
- **[LIBRO]** = umbral numérico explícito del libro · **[COMPARA]** = el criterio es una comparación
  entre dos análisis · **[JUICIO]** = Kazmer decide sin número (y lo dice).
- La pieza guía del libro en estos capítulos es el **bezel** (marco de laptop, ABS, 240×160×10 mm,
  pared 1.5 mm, 1,000,000 piezas → molde $74,800 → parte ~$0.48). Todos los números de ejemplo
  que aparecen en las fichas del cap. 3 son de ese caso.
- ⚠ **Numeración duplicada EN EL LIBRO** (documentada en `libro-caps1-3.md` §H): hay dos "Tabla 3.7"
  (aceros de base / coeficientes de feed), dos "Tabla 3.11" (misceláneos / mantenimiento), dos
  "Tabla 3.13" (eficiencia de ciclo / capacidad de máquina) y dos "Ec. (3.14)" (tiempo de acabado /
  costo de base). Aquí **siempre se cita por nombre + §**, nunca solo por número.
- ⚠ **UNIDADES**: en todo el cap. 3, *"all dimensions must be stated in meters"* o los coeficientes
  estadísticos (830, 1330, 17200, 0.057, 0.189) revientan.

---

# FASE 0 — ADMISIÓN Y ENCUADRE (cap. 1 §1.2/§1.5 · cap. 2 §2.1–§2.2)

Lo que ocurre antes de tocar geometría. Son análisis de **suficiencia, naturaleza del dato y
sesgo**: deciden si hay proyecto, qué es restricción y qué es salida, y con qué prejuicio se
va a resolver todo lo demás.

### A-001 · Suficiencia del intake (¿puedo arrancar?)
- **CUÁNDO:** al recibir la RFQ, antes de cualquier cálculo. El libro dice que las RFQ llegan
  *"usually towards the end of the concept design stage or near the beginning of the detailed design stage"* —
  o sea, con el CAD **sin terminar**, y eso es normal, no un defecto del cliente.
- **ENTRADAS:** lo que mandó el cliente (dimensiones generales, espesor de pared, material, cantidad de
  producción). Origen externo: no viene de ningún análisis.
- **EL CÁLCULO:** cualitativo, un conteo de presencia contra la lista mínima. Literal (§2.1.5):
  *"The critical part design information required to begin a mold design includes just the part size,
  wall thickness, and expected production quantity."* El §1.5 agrega el material a la lista de arranque.
- **SALIDA:** veredicto `puedo cotizar` / `falta X`, y la lista de campos ausentes con su dueño.
- **DECIDE:** si se arranca el layout preliminar y la cotización, o si se pide dato antes de invertir horas.
- **CRITERIO:** **[LIBRO]** 4 campos. Es un piso, no un ideal: el resto (Tablas 2.1–2.11) se llena después.
- **INVALIDA:** nada río arriba. Es la raíz del grafo.
- **¿TENEMOS?** **FALTA.** `moldmachine.ts::moldMachine` exige un `MachineSpec` con 7+ campos obligatorios
  (`Lmm/Wmm/Hmm/surfaceMm2/volumeMm3/wallMm/annualVolume`) y truena si falta uno. No existe el veredicto
  de suficiencia ni el arranque degradado con 4 datos. Es el hueco más barato de cerrar y el más visible
  para un cliente: el libro promete cotizar con cuatro números.

### A-002 · Clasificación restricción-vs-salida de cada campo de producción
- **CUÁNDO:** al capturar la Tabla 2.3 (worksheet de producción, 9 campos), antes de optimizar nada.
- **ENTRADAS:** los 9 campos de la Tabla 2.3 (vida de la aplicación, cantidad total, horas de moldeo/año/máquina,
  tasas mín/máx de producción, tcycle esperado, cavidades por molde, family mold sí/no + nº de partes, nº de moldes) ←A-001.
- **EL CÁLCULO:** cualitativo, un flag por campo. Literal (§2.2.2): esos datos *"may not be available at the
  start… these data are intermediate results from the mold design process"*, pero *"some customers will
  provide these details as specifications that the mold designer must satisfy"*. Si no se especifican,
  *"the mold designer should perform iterative design with cost analyses"*.
- **SALIDA:** por campo, uno de {`RESTRICCIÓN del cliente`, `SALIDA a optimizar`, `ausente`}.
- **DECIDE:** el **espacio de búsqueda** de todo el cap. 3. Si `cavidades` es restricción, A-051 no barre
  cavitaciones: las fija. Si es salida, A-051 barre y A-049 decide.
- **CRITERIO:** **[JUICIO]** — lo declara el cliente; el sistema solo lo registra y lo respeta.
- **INVALIDA:** que el cliente cambie de postura (típico cuando ve el break-even de A-049: suelta la
  cavitación que había impuesto).
- **¿TENEMOS?** **PARCIAL.** `moldmachine.ts` tiene `spec.cavPref` y `spec.feedPref`, y cuando vienen,
  restringe el barrido (`const cavs = spec.cavPref ? [spec.cavPref] : [1,2,4,8,16]`); `expediente.ts:65`
  lo registra (`el cliente IMPUSO N cavidades (§2.2.2)`). Pero solo 2 de los 9 campos tienen el flag, y
  no existe el worksheet como objeto con estado por campo.

### A-003 · Capacidad requerida: cavidades mínimas por throughput
- **CUÁNDO:** en cuanto hay una estimación de ciclo (A-042) y la cantidad anual; se re-corre por cada
  variante del barrido A-051.
- **ENTRADAS:** cantidad anual y horas de moldeo por año por máquina (Tabla 2.3) ←A-002 · tcycle ←A-042.
- **EL CÁLCULO:** `n_cav_min = ceil( qty_anual · tcycle / (horas_ano · 3600) )` — **INFERIDO**. El libro
  **lista los campos** (cantidad, horas de moldeo/año/máquina, tasas mín/máx de producción, tcycle,
  cavidades) pero la ecuación que los liga **NO OBSERVADA EN EL CORPUS**: es la aritmética obvia entre
  ellos, no una cita.
- **SALIDA:** cavidades mínimas [adimensional]; y el veredicto `alcanza / no alcanza con 16`.
- **DECIDE:** el piso de la cavitación (por debajo de él una variante es infactible aunque sea la más barata),
  y si hace falta **más de un molde** (campo "Number of molds required" de la Tabla 2.3).
- **CRITERIO:** **[COMPARA]** capacidad instalada vs demanda. Las tasas mín/máx del cliente son el rango legal.
- **INVALIDA:** cambio de espesor (A-042 va con h²), cambio de modo de operación (semi-auto ↔ full-auto),
  cambio de cantidad anual.
- **¿TENEMOS?** **PARCIAL — con un dato inventado.** `moldmachine.ts::moldMachine` tiene
  `const nMin = (v) => Math.ceil((spec.annualVolume * v.part.cycleTimeS) / (HORAS_ANO * 3600))` y marca
  `v.factible`. Pero `HORAS_ANO = 6000` está **hardcodeado** con el comentario "molder típico 2-3 turnos":
  el libro pide ese número como **campo del cliente** (Tabla 2.3, "Available molding hours per year per machine").
  Es exactamente el patrón que el pliego persigue: un dato del cliente sustituido por un default silencioso.

### A-004 · Auditoría de tolerancias (¿alcanzable o sobre-especificada?)
- **CUÁNDO:** al capturar la Tabla 2.6, antes de prometer nada; y otra vez si el cliente aprieta una cota.
- **ENTRADAS:** tolerancia general en % (mm/mm) + la lista de tolerancias críticas ←A-001/A-002 ·
  material y su rango de contracción (Tabla 2.10) ←A-007.
- **EL CÁLCULO:** cualitativo con dos anclas numéricas **[LIBRO]**: típica **±0.4 %**, apretada **±0.1 %**;
  estructura recomendada = UNA general + **unas pocas** críticas (la Tabla 2.6 da 3 renglones).
  La regla dura es la advertencia: *"Just because a tolerance is specified does not mean that it is achievable."*
  y *"it is not uncommon for product designers to over-specify the tolerances"*.
- **SALIDA:** por cota, `alcanzable / dudosa / sobre-especificada`; y un conteo de críticas contra el
  presupuesto de 3.
- **DECIDE:** tres cosas a la vez — (1) si se abre la conversación con el equipo de producto,
  (2) si la cotización debe incluir **molde prototipo** para caracterizar la contracción y
  **modificaciones durante el commissioning** (costo oculto que si no se cotiza, se come el margen),
  (3) el acero del inserto (A-024: tolerancia apretada empuja a acero duro).
- **CRITERIO:** **[LIBRO]** los dos porcentajes y el conteo; **[JUICIO]** el veredicto final por cota.
- **INVALIDA:** cambio de material (otra contracción), cambio de espesor o de geometría que mueva el
  perfil de contracción, cambio de acabado (A-019).
- **¿TENEMOS?** **FALTA.** No existe auditoría de tolerancias de PIEZA. `fits.ts` sí resuelve tolerancias,
  pero de **ajustes mecánicos molde-molde** (pin↔barreno 0.13 mm, interferencia λ=0.001·C·∛D), que es otro
  problema. La consecuencia económica (molde prototipo + retrabajo de commissioning) no se cotiza en ningún lado.

### A-005 · Auditoría regulatoria y estética
- **CUÁNDO:** al capturar Tablas 2.5 y 2.7, antes de fijar acabado y ubicación de compuerta.
- **ENTRADAS:** normas aplicables (ANSI, FDA I/II/III, IEC, MIL-SPEC, ISO, UL) · sistema de color
  (DIN/RAL/Munsell/AFNOR/NCS/Pantone), match entre componentes, % de gloss, acabado SPI, textura
  (proveedor/número) y **superficies críticas** ←A-001.
- **EL CÁLCULO:** cualitativo. Regla del libro (§2.2.3): el diseñador *"should inquire"* sobre las
  regulaciones y, idealmente, el cliente *"should provide a copy"* de ellas **resaltando** lo que afecta al molde.
- **SALIDA:** lista de restricciones duras + el conjunto de **superficies donde están PROHIBIDOS**
  knit-lines, marca de gate, sink y witness marks.
- **DECIDE:** dónde NO puede ir la compuerta ni la línea de partición ni el pin expulsor (restricción que
  viaja hasta los caps. 7 y 11); el acabado objetivo (A-019); y si no hay normas, se declara
  "sin regulación aplicable declarada" en vez de dejarlo vacío.
- **CRITERIO:** **[JUICIO]** con documento externo como evidencia.
- **INVALIDA:** cambio de aplicación o mercado destino.
- **¿TENEMOS?** **FALTA el worksheet**, pero **TENEMOS el consumidor**: `visibilidad.ts::clasificarVisibilidad`
  y `::juzgarMarcas` clasifican superficies y juzgan marcas de proceso — solo que la lista de superficies
  críticas se la inventa el sistema en vez de recibirla del cliente.

### A-006 · Semáforo meta-vs-estimado de costo por pieza
- **CUÁNDO:** al cerrar la primera pasada de costeo, y en cada re-cotización.
- **ENTRADAS:** las 4 metas de la Tabla 2.1 (material, molde, proceso, total por pieza) ←A-001 ·
  los 4 estimados ←A-039, A-041, A-045, A-047.
- **EL CÁLCULO:** resta y razón, término a término: `delta_i = estimado_i − meta_i`.
- **SALIDA:** 4 semáforos + el delta en $/pieza.
- **DECIDE:** el gate **"Project OK?"** (§1.5, Fig. 1.9) del lado del cliente. Si el total estimado
  rebasa la meta, el proyecto regresa a "Review part design and specifications".
- **CRITERIO:** **[COMPARA]** contra la meta que puso el cliente, no contra un umbral del libro.
- **INVALIDA:** cualquier cambio en la cadena del cap. 3.
- **¿TENEMOS?** **FALTA.** `moldmachine.ts` calcula los 4 términos (`costoPieza.{moldPerPart, materialPerPart,
  processPerPart, partUSD}`) pero no hay metas contra las cuales compararlos: el sistema nunca sabe si el
  número que produjo es bueno o malo **para este cliente**.

### A-007 · Ficha de material: verificación y documentación de supuestos
- **CUÁNDO:** al arrancar, y cada vez que se cambie de resina o de acero.
- **ENTRADAS:** Tabla 2.10 (plástico, 18 propiedades, **la especifica el CLIENTE**) · Tabla 2.11
  (metal del molde, 18 propiedades, **la elige el DISEÑADOR**).
- **EL CÁLCULO:** cualitativo/contable: cotejar propiedad por propiedad contra la fuente. Regla literal
  (§2.2.5): *"The mold designer should verify the mold material properties… with the material supplier,
  and document the assumed material properties that govern the mold design."*
- **SALIDA:** ficha completa + registro de supuestos con su fuente (Apéndice A, proveedor, ides.com, matweb.com).
- **DECIDE:** toda constante física río abajo: contracción, ciclo, tasas de maquinado (A-026/A-027), costo
  de material (A-025, A-041), factor de mantenimiento (A-038).
- **CRITERIO:** **[JUICIO]** con trazabilidad obligatoria: el supuesto que gobierna el diseño se firma.
- **INVALIDA:** cambio de resina o de acero.
- **¿TENEMOS?** **PARCIAL y bueno.** `moldbase.ts::MOLD_METALS` trae los 11 metales del Apéndice B con
  números exactos (incluye `volMachineM3h` y `areaMachineM2h`, que son justo lo que A-026/A-027 necesitan) y
  `moldcost-detailed.ts::PLASTICS` trae rho y kappa de 5 resinas. Falta el **registro de supuestos firmado**:
  `expediente.ts::decisionesDelPaquete` lo hace para contracción y steel-safe, no para propiedades de material.

### A-008 · Detección de conflictos entre subsistemas y arbitraje por importancia relativa
- **CUÁNDO:** cada vez que dos subsistemas piden el mismo espacio o la misma variable. En cap. 1 es
  advertencia; en la práctica se dispara en agua↔expulsión, colada↔ciclo, pilares↔pines.
- **ENTRADAS:** los diseños de dos subsistemas cualesquiera (posiciones, diámetros, claros).
- **EL CÁLCULO:** geométrico/lógico (detección) + **[JUICIO]** (resolución). Literal §1.2:
  *"It is up to the mold designer to consider the relative importance of the conflicting requirements"*.
  Y la regla madre de sesgo: *"The tendency among novice designers, when in doubt, is to over design.
  This tendency should be avoided since it tends to lead to large, costly, and inefficient molds."*
- **SALIDA:** lista de conflictos con sus dos opciones costeadas; **no** un ganador automático.
- **DECIDE:** cuál subsistema cede. Y define el sesgo global del sistema: ante la duda **NO** se engorda
  el molde — se expone la duda.
- **CRITERIO:** **[JUICIO]**, explícitamente delegado al humano por el libro.
- **INVALIDA:** cualquier reubicación de componentes.
- **¿TENEMOS?** **PARCIAL, y es de lo mejor que hay.** `mold-contratos.ts` reporta conflictos en vez de
  resolverlos en silencio: criterio `feed-lazo` (cita `§6.4.7 · §1.2`), `vent-vs-agua`, `agua-claro`,
  `eject-layout`; y `expediente.ts::decisionesDelPaquete` los saca como decisiones pendientes con opciones
  numeradas. Falta un detector genérico agua↔expulsión sobre coordenadas reales (hoy son criterios sueltos
  por subsistema, no un barrido de interferencia entre todos los pares).

### A-009 · Clasificación FIRME vs DIFUSO para compra concurrente
- **CUÁNDO:** al confirmar la orden, cuando el taller quiere comprar base y acero para ganar semanas.
- **ENTRADAS:** el estado de cada dimensión de layout (largo/ancho/alto de insertos, tamaño de base)
  ←A-023, A-034, A-058.
- **EL CÁLCULO:** cualitativo, un flag por dimensión. Literal §1.5: la ingeniería concurrente
  *"should not be applied to fuzzy aspects of the design"*.
- **SALIDA:** por dimensión, `FIRME (comprable)` / `DIFUSO (no comprar)`.
- **DECIDE:** qué se ordena hoy y qué espera. El costo del error es alto porque, en palabras del cap. 4,
  *"these dimensions are quite expensive to change once the mold making process has begun"*.
- **CRITERIO:** **[JUICIO]**.
- **INVALIDA:** cualquier retorno del grafo que toque una dimensión ya marcada FIRME — ése es exactamente
  el escenario que la regla busca evitar.
- **¿TENEMOS?** **FALTA.** Ninguna salida del sistema distingue dimensión firme de dimensión provisional.
  Hoy toda cota sale con la misma autoridad, que es precisamente el error que el libro señala.

---

# FASE 1 — DFM DE LA PIEZA (cap. 2 §2.2.4 y §2.3)

Todo esto se corre **antes** de diseñar el molde: *"A detailed review of the plastic part design should be
conducted prior to the design and manufacture of the injection mold"* (§2.3). Son análisis baratos, casi
todos umbrales sobre razones adimensionales contra el espesor nominal `h`, y todos son gate del cap. 3
porque mueven el factor de complejidad (A-028) y el ciclo (A-042).

### A-010 · Checklist DFM de 9 puntos (agregador)
- **CUÁNDO:** al cerrar la revisión de pieza, como gate de entrada al diseño del molde.
- **ENTRADAS:** los veredictos de A-012 (espesor uniforme/mínimo), A-016 (esquinas), A-014 (ribs), A-015 (bosses),
  A-018 (draft), A-020 (undercuts), A-004 (tolerancias alcanzables), más "gates especificados" y
  "longitud de flujo requerida" (Tabla 2.8).
- **EL CÁLCULO:** agregación con semáforo por punto; no hay fórmula.
- **SALIDA:** 9 semáforos + veredicto global de moldeabilidad.
- **DECIDE:** si se puede cortar acero, o si primero hay que regresar con el diseñador de producto.
- **CRITERIO:** **[LIBRO]** la lista de 9 es literal (Tabla 2.8); cada punto trae su propio criterio.
- **INVALIDA:** cualquier edición del CAD de la pieza.
- **¿TENEMOS?** **PARCIAL — 7 de 9.** `dfm.ts::checkDFM` cubre espesor, esquinas, ribs, bosses, draft y
  undercuts, y devuelve `{findings, errors, warns, score}`; `dfm-mesh.ts::dfmFromMesh` los mide sobre la
  malla real en vez de declararlos. "Longitud de flujo requerida" existe aparte
  (`flowlen.ts::measureFlowLength`) y "gates especificados" también (`gating.ts::designGateProcess`),
  pero **ninguno de los dos entra al checklist**; y "tolerancias alcanzables" (A-004) falta por completo.
  El checklist de 9 puntos como objeto único con semáforo no existe.

### A-011 · Checklist DFA de 6 puntos
- **CUÁNDO:** en la misma revisión de pieza, mirando el ensamble completo, no la pieza sola.
- **ENTRADAS:** el ensamble del producto (nº de partes, dirección de ensamble, snaps, sujetadores,
  simetría, requisitos de take-out) ←A-001.
- **EL CÁLCULO:** cualitativo, 6 puntos (Tabla 2.9).
- **SALIDA:** 6 semáforos + propuestas de consolidación de partes.
- **DECIDE:** rediseño del producto **antes** de que sea caro. Doble propósito declarado (§2.2.4): mejorar
  el producto Y **reducir cambios tardíos**. La iteración que se PREVIENE también cuenta.
- **CRITERIO:** **[JUICIO]** guiado por la lista.
- **INVALIDA:** cambio de arquitectura del producto.
- **¿TENEMOS?** **FALTA.** El sistema razona sobre UNA pieza; no tiene concepto de ensamble del producto.
  "Requisitos de take-out" sí tiene consumidor (`ejection.ts`), pero nadie los captura.

### A-012 · Uniformidad de pared y dirección de la transición
- **CUÁNDO:** primer análisis geométrico, antes que cualquier otro de §2.3. Es la raíz del DFM:
  la ficha visual V2.1 lo marca ★TOP-10 porque *"todo lo demás (llenado, contracción, ciclo) hereda de aquí"*.
- **ENTRADAS:** mapa de espesor de la pieza (o los espesores declarados) · posición de la compuerta
  (define la **dirección** del flujo) ←A-005/A-020.
- **EL CÁLCULO:** razón `h_max/h_min` + signo del gradiente de espesor **en la dirección del flujo** +
  longitud de la transición en múltiplos de `h`. Reglas literales (§2.3.1):
  *"Parts of varying wall thickness should be avoided"* y *"Extreme differences in wall thicknesses should
  be avoided if at all possible since internal voids may be formed internal to the part due to excessive
  shrinkage in the thick sections."* La tríada de la Fig. 2.2 (peor → mejor → mejor aún):
  *"The worst part design, shown at left, has the melt flowing from a thin section to a thick section with
  a sharp transition."* → mejora *"by reversing the direction of melt flow"* → mejora más
  *"by gradually transitioning the thick section to the thin section."*
- **SALIDA:** razón [adimensional], gradiente con signo, longitud de transición [× h]; veredicto por transición.
- **DECIDE:** rediseño de la pieza (A-013), reubicación de la compuerta, o aceptar el defecto (jetting,
  mala réplica superficial, mal control dimensional en la sección gruesa).
- **CRITERIO:** **[LIBRO]** cualitativo con dirección obligatoria — el mismo escalón es aceptable o
  inaceptable según de qué lado entra el material. Es una alarma **direccional**, no un número solo.
  Umbrales numéricos concretos: **NO OBSERVADOS EN EL CORPUS** (el libro califica con palabras).
- **INVALIDA:** mover la compuerta invierte el veredicto sin tocar la geometría.
- **¿TENEMOS?** **SÍ, y en dos niveles.** `dfm.ts::checkDFM` §2.3.1 calcula la razón y dispara
  `error` si >1.5, `warn` si >1.15 — esos dos umbrales son **INVENTADOS NUESTROS**, no del libro, y
  deberían ir etiquetados como tales. La regla direccional sí está: `w.flujoDesdeDelgado &&
  transition==='seca'` → error de jetting. `dfm-mesh.ts::dfmFromMesh` lo mide sobre la malla
  (`wall.{nominalMm,p50Mm,p95Mm,ratio}` + `thickMap` para la lámina).

### A-013 · Trade-off espesor nominal vs pared delgada + costillas
- **CUÁNDO:** cuando A-012 reprueba, o cuando el producto pide más rigidez.
- **ENTRADAS:** espesor nominal actual · rigidez requerida ←A-001 (Tabla 2.4: carga, deflexión permisible).
- **EL CÁLCULO:** comparación de dos diseños de rigidez EQUIVALENTE, con los números del libro:
  engrosar la pared 30 % cuesta *"approximately 15% more material and have a 70% longer cycle time"*
  frente a pared delgada con costillas. El +70 % de ciclo es coherente con A-042 (`t ∝ h²`: 1.30² = 1.69).
- **SALIDA:** delta de material [%], delta de ciclo [%], delta de costo por pieza [$/pieza] al pasarlo
  por A-041 y A-045.
- **DECIDE:** engrosar vs adelgazar+costillar. La salida preferida del libro es explícita:
  *"the best design may be to use a thinner wall thickness together with vertical ribs."*
- **CRITERIO:** **[LIBRO]** los dos porcentajes; **[COMPARA]** el costo por pieza resultante.
- **INVALIDA:** cambio de material (otro módulo → otra rigidez), cambio de requisito de carga.
- **¿TENEMOS?** **FALTA el comparador.** Las dos piezas del cálculo existen sueltas
  (`moldcost-detailed.ts::cycleTimeEstimate` da el ciclo con `h²`, `::estimatePartCost` da el material),
  pero nadie construye las dos alternativas y las contrasta. Es un análisis de **dos escenarios**, y el
  sistema hoy solo evalúa la pieza que le dieron.

### A-014 · Verificación de costilla (rib)
- **CUÁNDO:** por cada costilla, en la revisión de pieza.
- **ENTRADAS:** base, altura y paso de cada costilla · espesor nominal `h` ←A-012 · si la resina está
  cargada y si la aplicación es estética ←A-005/A-007.
- **EL CÁLCULO:** cuatro razones contra `h`. Literal (Fig. 2.3): *"the base thickness of the rib is 70%
  of the wall thickness of the part and the height of the rib is four times the wall thickness of the part.
  The ribs are spaced at ten times the wall thickness of the part."* + *"a 2° draft angle was applied to
  facilitate the ejection"*. Regla de falla: *"Ribs thicker than 70% of the wall thickness will tend to
  draw material away from the center of the opposite wall when the rib cools. The volumetric shrinkage in
  this region will cause internal voids or sink to appear on the side of the part opposite the rib."*
- **SALIDA:** `base/h`, `altura/h`, `paso/h`, draft [°]; y la **mancha de sink proyectada** en la cara opuesta.
- **DECIDE:** adelgazar la costilla, o aceptar el sink. Excepción declarada: en aplicaciones
  **no estéticas** con materiales **muy cargados** (baja contracción) la costilla puede engrosarse.
- **CRITERIO:** **[LIBRO]** 0.70 / 4× / 10× / 2°, con la excepción condicionada a dos flags.
- **INVALIDA:** cambio de `h` (todas las razones se mueven), cambio de resina cargada→sin carga,
  reclasificación de la superficie a estética (A-005).
- **¿TENEMOS?** **SÍ.** `dfm.ts::checkDFM` §2.3.2 verifica los cuatro y **respeta la excepción**
  (`frac > 0.7 && !p.material?.cargado` → error; con carga → warn). Falta la proyección de la mancha de
  sink en la cara opuesta, que es lo que pide la ficha visual V2.2 para el juez con ojos.

### A-015 · Verificación de boss y gusset
- **CUÁNDO:** por cada boss, en la revisión de pieza.
- **ENTRADAS:** espesor de boss/rib/gusset · `h` ←A-012 · torque de inserción del tornillo autorroscante
  y fuerza de pull-out esperada ←A-001 (Tabla 2.4).
- **EL CÁLCULO:** razón contra `h` **[LIBRO]**: *"All boss designs utilize a boss, rib, and gusset thickness
  of 70% times the nominal wall thickness."* Más dos restricciones opuestas que hay que satisfacer a la vez:
  *"Designed bosses must be able to withstand the torque applied during insertion of the self-threading
  screws as well as the potential tensile pull-out forces"* y a la vez *"bosses should not be designed with
  overly thick sections that may require extended cycle times or cause aesthetic problems."*
  Ángulos de gusset del libro: 120° (boss en esquina con 2 ribs) y 90° (boss sobre rib con 2 gussets).
- **SALIDA:** `espesor/h` por boss y gusset, ángulos [°], y veredicto estructural (torque/pull-out).
- **DECIDE:** geometría del boss; y **el draft local** — aquí está la excepción más contraintuitiva del cap. 2:
  *"In the designs of Figure 2.4, no draft was utilized on the bosses and gussets"* porque
  *"using less draft on these features can aid in increasing the stiffness and strength of the molding
  without significantly increasing the ejection forces."* Un sistema que aplica draft global a TODO
  hace lo contrario de lo que hace Kazmer.
- **CRITERIO:** **[LIBRO]** el 70 % y los ángulos; **[JUICIO]** el balance torque-vs-ciclo.
- **INVALIDA:** cambio de `h`, cambio de tornillo, cambio de draft global (A-018).
- **¿TENEMOS?** **PARCIAL.** `dfm.ts::checkDFM` §2.3.3 verifica el 70 % de boss y gusset. **Faltan tres cosas:**
  el chequeo estructural de torque/pull-out, los ángulos de gusset (90°/120°), y sobre todo la
  **excepción de draft selectivo** — hoy el draft se juzga global (A-018) y un boss sin draft sería marcado
  como error, cuando el libro lo hace a propósito.

### A-016 · Verificación de esquinas (filetes y chaflanes)
- **CUÁNDO:** por cada arista, en la revisión de pieza.
- **ENTRADAS:** radio o chaflán de cada arista, con su tipo (externa/interna) · `h` ←A-012.
- **EL CÁLCULO:** razón contra `h` **[LIBRO]** (§2.3.4): *"the fillet radius on an external corner should be
  150% of the wall thickness. To maintain the same thickness around the corner, the fillet on the internal
  corner is set to 50% of the wall thickness."* Chaflán: *"a chamfer of one half the wall thickness is often
  utilized on the internal corner"*, típicamente *"at a 45 degree angle"*. Y una regla que casi ningún
  verificador implementa: *"These fillet recommendations are only guidelines. In fact, even larger fillets
  should be used if possible."* — el umbral es un **piso**, no un objetivo.
- **SALIDA:** `R_ext/h`, `R_int/h`, longitud de chaflán [× h], ángulo [°]; y el espesor medido **alrededor**
  de la vuelta (debe mantenerse constante).
- **DECIDE:** rediseño de la arista. La esquina viva castiga por tres frentes distintos: producto
  (concentración de esfuerzos y falla frágil), molde (maquinado con herramientas decrecientes o procesos
  especiales → sube A-029) y proceso — este último es el que se olvida: *"sharp corners greatly restrict the
  heat flow from the polymer melt to the core insert… The result is often differential shrinkage across the
  thickness of the part near the corner and significant warpage of the molded part."*
- **CRITERIO:** **[LIBRO]** 150 % / 50 % / ½h a 45°, entendidos como piso.
- **INVALIDA:** cambio de `h`; y el fillet interno cambia solo si se aplica el tip de CAD del libro
  (filetear las aristas exteriores **antes** del shell → el interno sale como ext−espesor).
- **¿TENEMOS?** **SÍ.** `dfm.ts::checkDFM` §2.3.4 verifica ambos radios y el chaflán, y trata la arista sin
  filete ni chaflán como `error`. No mide el espesor alrededor de la vuelta (lo que pide V2.4), y no
  comunica que el umbral es un piso.

### A-017 · Disponibilidad de herramienta para el radio elegido
- **CUÁNDO:** justo después de A-016, antes de congelar el radio.
- **ENTRADAS:** radios propuestos ←A-016 · catálogo de cortadores del taller.
- **EL CÁLCULO:** búsqueda en catálogo, no fórmula. Literal (§2.3.4): *"the mold designer should suggest a
  fillet radius that corresponds to readily available tooling geometry so that custom tools need not be
  custom made."*
- **SALIDA:** radio ajustado al catálogo [mm] + el delta de costo evitado (herramienta especial).
- **DECIDE:** el valor final del radio en el CAD de la pieza; evita un renglón de herramienta custom en A-030.
- **CRITERIO:** **[LIBRO]** cualitativo, pero con dato externo obligatorio (el catálogo).
- **INVALIDA:** cambio de proveedor de herramienta o de taller (otro catálogo).
- **¿TENEMOS?** **FALTA.** `src/forja/cam/` tiene módulos de maquinado (`pocket.ts`, `tool-stress.ts` con
  `Herramienta{d,z}`) pero **no hay catálogo de radios comerciales** ni nadie conecta el DFM de esquinas con
  la herramienta que va a cortarlas. Es una regla de fabricabilidad que vive fuera de la geometría —
  exactamente el tipo de cosa que un verificador puramente geométrico nunca deduce.

### A-018 · Draft requerido por acabado y material
- **CUÁNDO:** después de elegir acabado (A-019) y antes de congelar la geometría; se re-corre si cambia el acabado.
- **ENTRADAS:** rugosidad o profundidad de textura [µm] ←A-019 · material (cargado / flexible) ←A-007 ·
  recomendación del proveedor de resina.
- **EL CÁLCULO:** **[LIBRO]** `draft_min = 0.5°` con *"1 to 2° commonly applied according to material supplier
  recommendations"*, más la regla de dedo: *"an additional 1° of draft commonly applied per 20 μm of surface
  roughness or texture depth"*. En ASCII: `draft ≈ 0.5 + rugosidad_um/20` [°], acotado por las anclas de la
  Tabla 2.14: A-1/acrílico/0.01 µm → 0.5° · B-3/ABS/12 µm → 1.5° · arena/PC 20 %GF/12 µm → 2° ·
  piel/PVC blando/125 µm → 4° · **piel/ABS/125 µm → 7.5°**. Ajustes direccionales: **subir** para
  vidrio/mica y baja contracción, **bajar** para muy flexibles (PVC suave).
- **SALIDA:** draft requerido [°] por superficie; y sobre la pieza, el % de área por debajo del requerido.
- **DECIDE:** el ángulo de las paredes verticales, la fuerza de expulsión (cap. 11) y, si el área en rojo
  es negativa, la existencia de un undercut (A-020 mide exactamente eso).
- **CRITERIO:** **[LIBRO]** el umbral, pero el propio libro lo relativiza: *"the allowable draft angle is a
  complex function of the material behavior, processing conditions, and surface finish"*. Y la trampa:
  ½–1° "se ve razonable" pero *"may cause the part to excessively stick in the mold"*, y eso
  *"can be compounded"* con materiales cargados de mica o vidrio.
- **INVALIDA:** **cambiar el acabado cambia el draft** (A-019 → A-018 es el retorno más olvidado del cap. 2);
  cambiar la resina; cambiar la dirección de apertura.
- **¿TENEMOS?** **SÍ, y es el mejor implementado del cap. 2.** `dfm.ts::draftForFinish` implementa
  `0.5 + rugosidad/20` acotado por `DRAFT_TABLE_214` (las 5 filas exactas); `dfm-mesh.ts::dfmFromMesh` lo
  **mide** sobre la malla (`draft.{pctBelowMin, pctBelowTable, minDeg, tableDeg}` + mapa de draft por columna).
  Falta el ajuste direccional por material (cargado → subir, flexible → bajar) y la excepción de A-015.

### A-019 · Selección de acabado y sus TRES efectos simultáneos
- **CUÁNDO:** al fijar la estética (Tabla 2.7), antes de A-018 y antes de A-031.
- **ENTRADAS:** requisito estético del cliente (gloss, textura, superficies críticas) ←A-005.
- **EL CÁLCULO:** selección en la escala SPI (A-1 ~0.01 µm Ra … D-3 ~4 µm Ra, Tabla 2.12) o textura
  (Tabla 2.13: arena 50 µm→B, piel 125 µm→C, red 150 µm→C, madera 250 µm→D). Y el cálculo real es que
  **una sola decisión propaga tres consecuencias**: (1) el **pre-acabado obligatorio** — SPI B para texturas
  someras, SPI C para rugosas, porque si no el mal acabado subyacente se ve a través de la textura;
  (2) **+1° de draft por 20 µm** (A-018); (3) **el costo y el tiempo** de acabado (A-031).
- **SALIDA:** nivel SPI o textura + pre-acabado requerido + draft extra [°] + horas de acabado.
- **DECIDE:** el acabado del molde, el draft, el costo, y si hay que reservar tiempo/dinero de
  **subcontratación** (el texturizado lo hace *"a relatively small subset of companies"*).
- **CRITERIO:** **[LIBRO]** las tablas; **[JUICIO]** el nivel objetivo.
- **INVALIDA:** cambio de requisito estético; cambio de resina (el mismo acabado sobre otro plástico pide
  otro draft: piel/PVC 4° vs piel/ABS 7.5°).
- **¿TENEMOS?** **PARCIAL — y el defecto es justo el que el libro advierte.** `moldcost-detailed.ts::FINISH_RATE`
  tiene las tasas por nivel (efecto 3) y `dfm.ts::draftForFinish` tiene el draft (efecto 2), pero **el
  efecto 1 (pre-acabado obligatorio B/C) no existe en el código**, y los tres no están unidos bajo un solo
  selector. El libro lo dice con todas sus letras: si la UI los separa, el usuario olvida alguno.
  El otro pedazo faltante es el **costo superlineal**: *"to effectively apply a given surface finishing
  method, the mold maker must successively apply all lower level finishing methods"* — el costo del nivel N
  incluye todos los N−1, y `FINISH_RATE` lo trata como tabla plana.

### A-020 · Detección y clasificación de undercuts
- **CUÁNDO:** en cuanto hay geometría y dirección de apertura definida.
- **ENTRADAS:** malla o B-Rep de la pieza · dirección de apertura ←cap. 4.
- **EL CÁLCULO:** un undercut es **área con draft negativo respecto a la dirección de apertura** — el mismo
  render de A-018, canal rojo; el conteo de **regiones rojas conexas** da el número de mecanismos que el molde
  va a necesitar. El libro da el catálogo de las cuatro familias (Fig. 2.7):
  *"a window in a side wall, an overhang above the bottom wall of the part, a horizontal boss, and a snap finger."*
- **SALIDA:** nº de regiones, área y volumen de undercut [mm²/mm³], familia de cada una.
- **DECIDE:** el mecanismo que arrastra cada undercut (slide o lifter externo, interno, core pull actuado)
  y por lo tanto **su coeficiente de costo** en A-036 (Tabla 3.9). El junior VE cuánto cuesta cada feature.
- **CRITERIO:** **[LIBRO]** geométrico y objetivo (draft < 0). El propio libro nota que
  *"Much of the time, the product designer is unaware"* de que los puso.
- **INVALIDA:** cambiar la dirección de apertura o el plano de partición **cambia el conjunto de undercuts**
  sin tocar la pieza. Es el retorno cap. 4 → cap. 2.
- **¿TENEMOS?** **SÍ.** `dfm-mesh.ts::dfmFromMesh` hace el raster de columnas en ±Z, cuenta cruces de
  superficie, devuelve `undercut.{columnsPct, volumeMm3, enclosedVoids, regions}` y detecta el caso
  **NO MOLDEABLE** (hueco cerrado). `mold-sideaction-gen.ts` genera el mecanismo. La clasificación por
  **familia** del libro (ventana/overhang/boss horizontal/snap) no está: contamos regiones, no las nombramos.

### A-021 · Decisión eliminar-vs-conservar el undercut
- **CUÁNDO:** por cada undercut detectado, antes de cotizar.
- **ENTRADAS:** el undercut y su mecanismo ←A-020 · costo del mecanismo ←A-036 · costo de la alternativa
  (operaciones post-molde, o partir la pieza en varias) ←A-011.
- **EL CÁLCULO:** comparación de dos costos + una prueba de veto funcional. Literal (§2.3.7): el proceso
  humano es *"identify undercuts, alert the customer, and work with the product design engineer to remove"*
  los undercuts — **pero** *"undercuts should NOT be designed out of the product if the function… is vital
  to the product or the removal would necessitate additional post-molding operations or the redesign of a
  single part into multiple pieces."*
- **SALIDA:** por undercut, `eliminar` / `conservar y pagar el mecanismo`, con el delta en $.
- **DECIDE:** la geometría final de la pieza y el contenido de mecanismos del molde.
- **CRITERIO:** **[JUICIO]** con dos vetos duros del libro (función vital; alternativa peor). Un optimizador
  que "limpie" undercuts a ciegas viola la regla explícitamente.
- **INVALIDA:** cambio de función del producto; cotización nueva del mecanismo.
- **¿TENEMOS?** **PARCIAL.** `expediente.ts::decisionesDelPaquete` sabe sacar decisiones pendientes con
  opciones numeradas, y `moldmachine.ts::buildCostInputs` ya mete `slide-externo` al costeo cuando hay
  undercuts. Lo que **falta es la comparación**: nadie cotiza la alternativa sin undercut, así que la
  decisión se presenta sin su otro lado.

### A-022 · Propuesta de rediseño que abarata el molde del cliente
- **CUÁNDO:** al cerrar la revisión de pieza, antes de entregar la cotización.
- **ENTRADAS:** todos los hallazgos de A-010 a A-021 · el delta de costo de cada corrección ←cap. 3.
- **EL CÁLCULO:** por hallazgo, `ahorro = costo_actual − costo_con_el_cambio`; se reportan los positivos.
- **SALIDA:** lista priorizada de mejoras al producto con su ahorro en $ (molde y/o pieza).
- **DECIDE:** qué se le propone al cliente. Y es **política de negocio, no optimización**: el libro describe
  al diseñador que ve que cambiar un ángulo eliminaría un undercut pero *"remain silent to justify the need
  for a core pull and a higher priced mold"*, y sentencia que *"it is a losing long term strategy"*.
  El proveedor exitoso busca agregar valor mejorando la calidad y bajando el costo del producto **del cliente**.
- **CRITERIO:** **[JUICIO]** político-comercial, invisible para una máquina que maximiza margen.
- **INVALIDA:** cambio de la pieza (la lista se recalcula).
- **¿TENEMOS?** **FALTA.** El sistema reporta defectos DFM (`dfm.resumen`) pero nunca cuantifica cuánto
  ahorraría corregirlos, ni arma la propuesta para el cliente. Es el mismo hueco que A-013 y A-021: nos falta
  el hábito de **cotizar la alternativa**.

---

# FASE 2 — COSTO DEL MOLDE (cap. 3 §3.3)

Aquí empieza el motor. Kazmer lo declara de entrada: los insertos son
*"the single largest driver of the total mold cost"* y dentro de ellos el maquinado de cavidad es
*"the single most significant driver"*. El orden real del cálculo (§3.3) es:
dimensiones de inserto → acero → tiempos de maquinado → acabado por zonas → descuento por multiplicidad →
base de molde → customizaciones → y hasta el final, **leer el resultado y juzgarlo**.

Mandato transversal, repetido tres veces en §3.3: **todo coeficiente es un default sobreescribible** —
*"the negotiated machinist's rate should be used if this data is available"*.

### A-023 · Dimensiones del inserto de cavidad
- **CUÁNDO:** primer paso del costeo, en cuanto hay bbox de la pieza.
- **ENTRADAS:** Lpart, Wpart, Hpart [m] ←A-001.
- **EL CÁLCULO (Ecs. 3.5–3.7):**
  `Lcav = Lpart + max[0.1·Lpart, Hpart]`
  `Wcav = Wpart + max[0.1·Wpart, Hpart]`
  `Hcav = max[0.057, 2·Hpart]`   (metros)
- **SALIDA:** Lcav, Wcav, Hcav [m] → `Vcav = Lcav·Wcav·Hcav` [m³].
- **DECIDE:** cuánto acero se compra por juego (A-025), cuánto hay que remover (A-026), y el tamaño de la
  base (A-034). Es el nodo del que cuelga casi todo el capítulo.
- **CRITERIO:** **[LIBRO]** fórmula cerrada. ⚠ *"all dimensions must be stated in meters"*.
- **INVALIDA:** cambio del bbox de la pieza; **no** lo invalida el número de cavidades.
- **¿TENEMOS?** **SÍ.** `moldcost-detailed.ts::cavityInsertDims`, verificado contra el bezel
  (`scripts/mold-cost-detailed-test.cjs`: Lcav 0.264, Wcav 0.176, Hcav 0.057 — con la nota de que el libro
  imprime 0.268, errata documentada en el test).

### A-024 · Selección del acero del inserto
- **CUÁNDO:** después de A-023, antes de A-025/A-026.
- **ENTRADAS:** tolerancia (¿apretada?) ←A-004 · volumen de producción ←A-001/A-002 · abrasividad y
  corrosividad de la resina ←A-007 · si hay pulido espejo ←A-019.
- **EL CÁLCULO:** selección en el Apéndice B, **[JUICIO]** guiado. El razonamiento del libro en el ejemplo:
  *"Since this is a tight tolerance part with a high production quantity, tool steel D2 is selected for its
  wear and abrasion resistance"* (D2: rho = 7670 kg/m³, 21.4 $/kg).
- **SALIDA:** acero elegido con sus propiedades: rho [kg/m³], kappa [$/kg], `R_volumen` [m³/h],
  `R_area` [m²/h], dureza Brinell.
- **DECIDE:** costo de material (A-025), velocidad de maquinado (A-026/A-027 — un acero duro cuesta más Y se
  maquina más lento: doble castigo), y el factor de mantenimiento (A-038 — donde se paga el beneficio).
- **CRITERIO:** **[JUICIO]** por tolerancia + volumen + abrasividad. Es de las decisiones que el libro
  nombra explícitamente como del ingeniero.
- **INVALIDA:** cambio de resina, de volumen o de tolerancia (A-004).
- **¿TENEMOS?** **SÍ.** `moldbase.ts::selectMetal({produccionAnual, resinaAbrasiva, resinaCorrosiva,
  pulidoEspejo, prototipo})` devuelve metal + `porQue[]`. Nota honesta: recibe `prototipo` y `pulidoEspejo`
  pero **no recibe la tolerancia**, que es la primera razón que da el libro en su ejemplo.

### A-025 · Costo de material del inserto
- **CUÁNDO:** inmediatamente después de A-023 y A-024.
- **ENTRADAS:** Vcav [m³] ←A-023 · rho, kappa del acero ←A-024.
- **EL CÁLCULO:** `C_material = Vcav · rho · kappa` [$]. (Bezel: **$435**.)
- **SALIDA:** $ por juego de cavidad.
- **DECIDE:** el primer sumando de A-032.
- **CRITERIO:** **[LIBRO]** aritmética directa.
- **INVALIDA:** A-023 o A-024.
- **¿TENEMOS?** **SÍ.** `moldcost-detailed.ts::estimateMoldCost` → `materialUSD`. Test: $435 ±3.

### A-026 · Tiempo de maquinado volumétrico
- **CUÁNDO:** con Vcav y el acero ya elegidos.
- **ENTRADAS:** Vcav [m³] ←A-023 · `R_volumen` del acero [m³/h] ←A-024 (Apéndice B).
- **EL CÁLCULO (Ecs. 3.8–3.10):** `t_vol = Vcav / R_volumen` [h]. (Bezel: 3.78 h.)
  El supuesto que lo sostiene es deliberadamente conservador y el libro lo defiende de antemano:
  *"This may seem an overly conservative estimate, but in fact much of the volume must be removed around
  the outside of the core… and the inside of the cavity."*
- **SALIDA:** horas.
- **DECIDE:** el grueso del tiempo de maquinado (A-030).
- **CRITERIO:** **[LIBRO]**, con **sesgo conservador declarado**.
- **INVALIDA:** A-023, A-024.
- **¿TENEMOS?** **SÍ.** `estimateMoldCost` → `tVolH`, y el sesgo **sale etiquetado** en
  `CostBreakdown.sesgos[]` ("volumen a remover = inserto entero", dirección `conservador`, cita `§3.3.1.2 Eq 3.7`).
  Eso es exactamente lo que el libro pide: etiquetar el sesgo, no esconderlo.

### A-027 · Tiempo de maquinado por área
- **CUÁNDO:** junto con A-026 (paralelo).
- **ENTRADAS:** área superficial de la pieza [m²] ←CAD/A-001 · `R_area` del acero [m²/h] ←A-024.
- **EL CÁLCULO (Ec. 3.11):** `t_area = A_part_surface / R_area` [h]. (Bezel: 2.69 h.)
  El libro subraya que el CAD provee área y volumen **exactos** — no hay que estimarlos.
- **SALIDA:** horas.
- **DECIDE:** el segundo sumando del tiempo de maquinado (A-030).
- **CRITERIO:** **[LIBRO]**.
- **INVALIDA:** cambio del CAD de la pieza (cualquier análisis de la Fase 1 que mueva superficie).
- **¿TENEMOS?** **SÍ.** `estimateMoldCost` → `tAreaH`. Test: 2.69 h ±0.02.

### A-028 · Factor de complejidad de la pieza
- **CUÁNDO:** junto con A-026/A-027.
- **ENTRADAS:** área superficial [mm²] y volumen [mm³] de la pieza ←A-001 · espesor de pared `h` [mm] ←A-012.
- **EL CÁLCULO (Ec. 3.12):** `f_complexity = (A_part_surface · h_wall) / V_part` [adimensional].
  Galería de calibración del libro (Tabla 3.3): **1.02** (charola simple) · **1.9** · **2.5** (el bezel) · **3.1**.
- **SALIDA:** número adimensional ≥ ~1.
- **DECIDE:** multiplica el tiempo de maquinado (A-030). Es el mecanismo por el que **cada costilla, boss y
  ventana que sobrevive a la Fase 1 se paga en acero**.
- **CRITERIO:** **[LIBRO]** geométrico y objetivo — y esto es una elección de diseño explícita del autor:
  los métodos por conteo de features son *"time consuming and dependent upon the subjective opinion as to
  what constitutes a dimension or feature"*, por eso el factor es una razón geométrica.
- **INVALIDA:** cualquier cambio del CAD; cambio de espesor (entra lineal).
- **¿TENEMOS?** **SÍ.** `estimateMoldCost` → `complexity = (ApartSurfaceMm2 * wallMm) / VpartMm3`.
  Test del bezel: 2.5 ±0.02. Falta la galería de calibración (Tabla 3.3) para que el usuario sepa leer el número.

### A-029 · Factor de maquinado por mezcla de procesos
- **CUÁNDO:** al estimar el maquinado, después de saber qué features tiene la pieza.
- **ENTRADAS:** proporción de uso de cada proceso sobre este inserto ←**[JUICIO]** del matricero,
  informado por la Fase 1 (costillas angostas → EDM; superficies planas de precisión → rectificado).
- **EL CÁLCULO (Tabla 3.4):** **promedio PONDERADO** por proporción de uso, con los factores
  torneado 0.5 · taladrado 0.5 · fresado 1 · **rectificado 4** · **EDM 4**.
  El juicio en el ejemplo: *"the laptop bezel contains many narrow ribs that will be produced primarily with
  EDM, a machining factor of 4 is used"*.
- **SALIDA:** `f_machining` [adimensional, 0.5–4].
- **DECIDE:** multiplica el tiempo de maquinado (A-030). Un 4 contra un 1 **cuadruplica** el driver más grande
  del costo del molde.
- **CRITERIO:** **[JUICIO]** — reconocer qué features fuerzan EDM es lectura humana de la geometría.
- **INVALIDA:** cambio de features (Fase 1), cambio de estrategia de maquinado del taller.
- **¿TENEMOS?** **PARCIAL — y aquí sustituimos un juicio del libro por una heurística nuestra.**
  `moldcost-detailed.ts::MACHINING_FACTOR` tiene la tabla exacta, pero `moldmachine.ts` elige así:
  `complexity > 2.5 ? edm : complexity > 1.5 ? 2 : fresado`. Eso **no es el promedio ponderado del libro**:
  es un mapeo inventado desde A-028, y encima acopla dos análisis que el libro mantiene separados
  (un cascarón grande y liso puede tener complejidad alta y cero EDM). Falta el editor de mezcla de procesos.

### A-030 · Costo de maquinado del inserto
- **CUÁNDO:** cierra el bloque de maquinado.
- **ENTRADAS:** t_vol ←A-026 · t_area ←A-027 · f_complexity ←A-028 · f_machining ←A-029 ·
  eficiencia `eta` · tarifa facturada [$/h].
- **EL CÁLCULO:** `t_machining = ((t_vol + t_area) / eta) · f_complexity · f_machining` [h];
  `C_machining = t_machining · tarifa` [$]. (Bezel: 258 h × $100/h = **$25,800**.)
  Dos trampas caras, ambas literales:
  1. **eta**: *"In theory… 100%. In reality, the efficiency rarely exceeds 50%… a machining efficiency rate
     of 25% is recommended for cost estimation"*. Un estimado con eficiencia optimista se ve profesional y
     queda 4× corto.
  2. **tarifa**: salario directo del matricero $23.94/h **≠** tarifa facturada ~$100/h (prestaciones, planta,
     herramienta, overhead, utilidad). Cotizar con el salario es el error clásico.
- **SALIDA:** horas y $.
- **DECIDE:** el sumando dominante de A-032, y por lo tanto casi todo el precio del molde.
- **CRITERIO:** **[LIBRO]** eta = 25 % por default; cambiarlo debe exigir justificación registrada.
- **INVALIDA:** cualquiera de sus cinco entradas; cambio de taller (otra tarifa).
- **¿TENEMOS?** **SÍ.** `estimateMoldCost` con `eta = inp.efficiency ?? 0.25` y `machiningRateUSDh` como
  parámetro (`moldmachine.ts` default 100, comentado "EE.UU. por defecto"). El sesgo de eta sale etiquetado
  en `sesgos[]`, y `mold-contratos.ts::contratoCosto` criterio `costo-datos-taller` verifica que la tarifa
  del taller mande sobre la tabla. Bien cubierto.

### A-031 · Tiempo y costo de acabado por zonas
- **CUÁNDO:** después de A-019 (acabado elegido) y del despiece de superficies.
- **ENTRADAS:** áreas por nivel de acabado [m²] ←A-019/A-005 · tasas de la Tabla 3.6
  (textura 0.0002 m²/h … D-3 0.02 m²/h) · tarifa de acabado [$/h].
- **EL CÁLCULO (Ecs. 3.13–3.14):** `t_finish = suma_i ( A_i / R_i )` [h]; `C_finish = t_finish · tarifa`.
  Regla contable que el ejemplo aplica: **restar del área general las áreas ya contadas** en un acabado
  premium, para no cobrarlas dos veces (en el bezel, el frente pulido se resta de la superficie general).
  Escala del renglón: el acabado es **5–30 % del costo total del molde**. (Bezel: 34 h → **$1,700**.)
- **SALIDA:** horas y $ por zona y totales.
- **DECIDE:** el tercer sumando de A-032; y si conviene subcontratar (el pulido y el texturizado se
  subcontratan por su alto contenido de mano de obra).
- **CRITERIO:** **[LIBRO]** tabla de tasas + la regla de no doble conteo.
- **INVALIDA:** cambio de acabado (A-019) o del despiece de superficies críticas (A-005).
- **¿TENEMOS?** **PARCIAL — la API sabe, el orquestador no.** `moldcost-detailed.ts` acepta
  `finishAreas: Array<{spi, areaMm2}>` y `scripts/mold-cost-detailed-test.cjs` **sí** hace la resta a mano
  (`{B-3, 45700−10000}, {A-1, 10000}`) para reproducir el bezel. Pero `moldmachine.ts::buildCostInputs`
  manda **una sola zona con toda la superficie**: en producción el desglose por zonas y la resta
  anti-doble-conteo **no ocurren**. El dato existe y no llega al juez — el patrón de bug que ya nos mordió.

### A-032 · Costo de un juego de cavidad
- **CUÁNDO:** cierra el bloque de insertos.
- **ENTRADAS:** C_material ←A-025 · C_machining ←A-030 · C_finish ←A-031.
- **EL CÁLCULO (Ec. 3.4):** `C_cavity = C_material + C_machining + C_finish` [$].
  (Bezel: $435 + $25,800 + $1,700.)
- **SALIDA:** $ por juego (core + cavity).
- **DECIDE:** la base del escalamiento por cavitación (A-033) y, vía A-036, también la customización.
- **CRITERIO:** **[LIBRO]** suma visible con sus tres sumandos — el libro la muestra desglosada a propósito.
- **INVALIDA:** cualquiera de los tres.
- **¿TENEMOS?** **SÍ.** `estimateMoldCost` → `setUSD`, y `quoteReport()` la imprime con los tres sumandos.

### A-033 · Descuento por multiplicidad de juegos de cavidad
- **CUÁNDO:** al escalar de 1 cavidad a n.
- **ENTRADAS:** C_cavity ←A-032 · nº de cavidades ←A-002/A-051.
- **EL CÁLCULO (Ec. 3.3 + Tabla 3.5):** `C_cavities = (C_cavity · n_cavities) · f_discount`, con
  `f_discount` = 1 / 0.85 / 0.72 / 0.61 / 0.52 para 1/2/4/8/16 juegos: **−15 % por cada duplicación**,
  con piso porque *"after 16 cavities, it is difficult to further improve"*. Base declarada: investigación
  de factores humanos (curva de aprendizaje del taller), sustituible por datos propios.
- **SALIDA:** $ de todos los insertos.
- **DECIDE:** el primer término de A-037; y es una de las dos fuerzas que hacen que más cavidades **no**
  cuesten proporcionalmente más (la otra es que el ciclo se reparte, A-045).
- **CRITERIO:** **[LIBRO]** tabla explícita, sobreescribible.
- **INVALIDA:** cambio de cavitación (A-051).
- **¿TENEMOS?** **SÍ.** `moldcost-detailed.ts::cavityDiscount`. Detalle menor y honesto: el comentario dice
  "interpolación por la regla de duplicación (log2)" pero el código devuelve **escalones** (el último
  valor de tabla ≤ n) — para n = 3, 5, 12 da el escalón inferior, no una interpolación. Coincide con el
  libro en las potencias de 2, que son las que el libro tabula.

### A-034 · Dimensiones del mold base
- **CUÁNDO:** después de A-023 y de fijar la cavitación.
- **ENTRADAS:** Lcav, Wcav, Hcav ←A-023 · n_cavidades ←A-002/A-051.
- **EL CÁLCULO (Ecs. 3.16–3.17):**
  `L_mold = Lcav · n_cav_largo · 1.33` · `W_mold = Wcav · n_cav_ancho · 1.33` · `H_mold = 0.189 + 2·Hcav` [m],
  con la rejilla inicial `n_largo = n_ancho = ceiling(sqrt(n_cavidades))`.
  Sesgo declarado por el propio libro: esa rejilla *"will tend to make the mold have larger size and cost
  than might actually be realized, but will provide at least a reasonable estimate"*.
- **SALIDA:** L, W, H del bloque [m].
- **DECIDE:** la masa (A-035) y, río abajo, la compatibilidad con la máquina (tie bars, daylight).
- **CRITERIO:** **[LIBRO]**, con **sesgo conservador declarado**.
- **INVALIDA:** A-023 o la cavitación.
- **⚠ Nota de fuente:** el corpus advierte que en la extracción de la **Ec. (3.17)** el símbolo de raíz no
  sobrevivió y quedó como "ceiling(ncavities)". Lo verificable es que es una rejilla cuadrada conservadora;
  el **símbolo exacto está NO OBSERVADO EN EL CORPUS**.
- **¿TENEMOS?** **SÍ.** `estimateMoldCost`: `nSide = Math.ceil(Math.sqrt(nCavities))`, `LmoldM`, `WmoldM`,
  `HmoldM = 0.189 + 2*HcavM`; el sesgo sale etiquetado en `sesgos[]` ("layout ceiling(√n)").

### A-035 · Masa y costo del mold base
- **CUÁNDO:** después de A-034.
- **ENTRADAS:** L, W, H del molde [m] ←A-034 · acero de base elegido (DME #1/#2/#3).
- **EL CÁLCULO (§3.3.2, Ec. 3.15 y la de costo):**
  `M_mold = 1330·L·W + 17200·L·W·H` [kg, con L/W/H en metros]
  `C_mold_base = 830 + M_mold · kappa_acero` [$], con kappa de la Tabla 3.7 de aceros:
  SAE 1030 → 3.55 $/kg · AISI 4130 → 4.40 · AISI P20 → 5.25.
  Los coeficientes son **regresiones estadísticas** (R² = 0.9791 y 0.999 según las notas al pie) sobre
  catálogo real: no son inventados, y por eso **no se pueden usar en pulgadas**.
  (Bezel: 538 kg → **$3,700**.)
- **SALIDA:** kg y $.
- **DECIDE:** el segundo término de A-037; y el acero de la base (decisión separada del acero del inserto).
- **CRITERIO:** **[LIBRO]** regresión con procedencia declarada.
- **INVALIDA:** A-034; cambio de acero de base.
- **¿TENEMOS?** **SÍ.** `estimateMoldCost`: `massKg = 1330*L*W + 17200*L*W*H`,
  `moldBaseUSD = 830 + massKg * MOLD_STEEL_COEF[moldSteel]`. Test: 538 kg / $3,700.
  **Extensión propia bien documentada:** `plate-cost.ts::plateCosts` reparte esa cifra **placa por placa**
  (necesidad LATAM: aquí no se compra un DME armado, se compra acero y se corta) y su contrato es que
  **la suma cuadra con la Ec. 3.15**; el archivo declara en su encabezado que es extensión, no cita.

### A-036 · Costo de customización por subsistema
- **CUÁNDO:** después de A-033 y A-035, cuando ya se sabe qué tecnologías lleva el molde.
- **ENTRADAS:** C_cavities ←A-033 · C_mold_base ←A-035 · las 5 selecciones de tecnología:
  alimentación (Tabla 3.7 de feed) ←A-049/A-053 · enfriamiento (Tabla 3.8) · expulsión (Tabla 3.9) ←A-020/A-021 ·
  estructural (Tabla 3.10) · misceláneos (Tabla 3.11 de misc).
- **EL CÁLCULO (Ec. 3.18):**
  `C_customization = C_cavities · suma_i(f_cavity_i) + C_mold_base · suma_i(f_mold_i)`,
  con `i` sobre {alimentación, agua, expulsión, estructura, misceláneos}.
  ⚠ Los factores **YA incluyen la compra de componentes** (hot runners, fittings, core pulls): sumarlos
  aparte es doble conteo. Defaults declarados por el libro: aplicación simple de 1–4 cavidades → cold runner
  de dos placas; alto volumen y 16+ cavidades → hot runner de compuerta térmica; la mayoría de los moldes usa
  líneas rectas con o-ring, mezcla de pines/cuchillas/camisas, y pilares + interlocks; y en misceláneos,
  *"For most molds, none of these customizations are required."* (Bezel: **$43,200** — el renglón más grande.)
- **SALIDA:** $ y los dos sumatorios de factores.
- **DECIDE:** el tercer término de A-037; y en vivo, cuánto cuesta cada palomita de tecnología — es donde
  el undercut de A-020 se convierte en dinero.
- **CRITERIO:** **[LIBRO]** cinco tablas de coeficientes.
- **INVALIDA:** cualquier cambio de tecnología en cualquiera de los 5 subsistemas.
- **¿TENEMOS?** **SÍ.** `moldcost-detailed.ts::CUSTOM_FACTORS` (las 5 tablas completas, pares [cav, mold])
  y el sumatorio de la Ec. 3.18 en `estimateMoldCost`. `moldmachine.ts::buildCostInputs` arma la selección
  desde la arquitectura y los undercuts. Nota: esa selección es **fija** salvo el feed
  (`cooling:['circuito'], structural:['pilares-interlocks'], misc:['sensor-presion']`), o sea que los otros
  cuatro menús del libro no están expuestos como decisión.

### A-037 · Costo total del molde
- **CUÁNDO:** cierra §3.3.
- **ENTRADAS:** C_cavities ←A-033 · C_mold_base ←A-035 · C_customization ←A-036.
- **EL CÁLCULO (Ec. 3.2):** `C_total_mold = C_cavities + C_mold_base + C_customization` [$].
  (Bezel: $27,900 + $3,700 + $43,200 ≈ **$74,800**.)
- **SALIDA:** $ del molde.
- **DECIDE:** el costo fijo de cada escenario (A-048), la amortización por pieza (A-039) y el precio (A-057).
- **CRITERIO:** **[LIBRO]** suma.
- **INVALIDA:** los tres términos.
- **¿TENEMOS?** **SÍ, con ancla verificada.** `estimateMoldCost` → `totalUSD`;
  `scripts/mold-cost-detailed-test.cjs` reproduce el bezel completo ($435 material, 258 h/$25,800 maquinado,
  34 h/$1,700 acabado, 538 kg/$3,700 base, ≈$74,800 total). Ése es el ancla que impide que el módulo derive.

---

# FASE 3 — COSTO POR PIEZA (cap. 3 §3.4)

El molde ya está costeado; ahora se reparte entre piezas y se le suman material y proceso. La estructura
es `C_part = (molde + material + proceso) / yield`, y cada término tiene su propia cadena.

### A-038 · Factor de mantenimiento
- **CUÁNDO:** al amortizar el molde, después de A-024 (ya se sabe el acero).
- **ENTRADAS:** dureza/tipo de molde (suave, acero estándar P20, endurecido H13) ←A-024 ·
  abrasividad del plástico (sin carga, viscoso o con partícula, con fibra) ←A-007.
- **EL CÁLCULO (Tabla 3.11 de mantenimiento):** matriz 3×3 con valores **3/10/20** (molde suave),
  **2/5/10** (P20 estándar), **2/2/3** (H13 endurecido). En el ejemplo el libro **interpola a juicio**:
  ABS sobre D2 endurecido → *"the maintenance coefficient will fall between 2 and 5 — a factor of 3 is estimated"*.
- **SALIDA:** `f_maintenance` [adimensional, 2–20].
- **DECIDE:** multiplica la amortización (A-039). Y sobre todo, **decide el acero** (A-024) si se muestra a
  tiempo: *"the maintenance costs can far exceed the purchase cost"* del molde en su vida útil.
  Combinación letal: molde suave + plástico con fibra = ×20.
- **CRITERIO:** **[LIBRO]** la matriz; **[JUICIO]** la interpolación entre celdas.
- **INVALIDA:** cambio de acero o de resina.
- **¿TENEMOS?** **PARCIAL.** `estimatePartCost` toma `fMaintenance ?? 3` y **declara su justificación**
  (`fMaintenanceJustificacion`), y `mold-contratos.ts::contratoCosto` criterio `costo-mantenimiento` la
  audita citando el rango 2–20. Pero **la matriz 3×3 no existe como lookup**: el 3 es un default del ejemplo
  del bezel aplicado a todo, así que un molde de aluminio con PA-GF (que debería dar ×20) cotiza con ×3 y
  sale ~7× barato de lo que el libro predice. Es el hueco más caro de la Fase 3.

### A-039 · Costo de molde amortizado por pieza
- **CUÁNDO:** después de A-037 y A-038.
- **ENTRADAS:** C_total_mold ←A-037 · cantidad total de producción ←A-001/A-002 · f_maintenance ←A-038.
- **EL CÁLCULO (Ec. 3.20):** `C_mold/part = (C_total_mold / n_total) · f_maintenance` [$/pieza].
  (Bezel: **$0.22**.)
- **SALIDA:** $/pieza.
- **DECIDE:** el primer término de A-047; y es el término que dispara el veredicto de sobrediseño (A-054).
- **CRITERIO:** **[LIBRO]**.
- **INVALIDA:** A-037, A-038, o un cambio de la cantidad (que es justo lo que A-050 dice que no se conoce bien).
- **¿TENEMOS?** **SÍ.** `estimatePartCost` → `moldPerPart`.

### A-040 · Factor de desperdicio del feed y decisión de regrind
- **CUÁNDO:** al costear material, después de elegir arquitectura de alimentación.
- **ENTRADAS:** tipo de feed ←A-049/A-053 · política de regrind del cliente y del taller.
- **EL CÁLCULO (Tabla 3.12):** cold runner **1.25**, que baja a **1.08** si se usa TODO el regrind
  (con su costo declarado de mano de obra y energía de reciclar); hot runner **1.05** en corridas cortas
  (mucha purga de arranque) y **1.02** en corridas largas.
- **SALIDA:** `f_feed_waste` [adimensional].
- **DECIDE:** multiplica el material (A-041). Y contiene una trampa contraintuitiva: **el hot runner no
  siempre gana en material** — 1.05 (corrida corta) contra 1.08 (cold con regrind pleno) es una diferencia
  chica, y la ventaja depende del tamaño de corrida, no de la tecnología.
- **CRITERIO:** **[LIBRO]** tabla de 4 valores.
- **INVALIDA:** cambio de arquitectura de feed; cambio de política de regrind; cambio de tamaño de corrida.
- **¿TENEMOS?** **PARCIAL.** `moldcost-detailed.ts::FEED_WASTE` tiene los 4 valores exactos, pero
  `moldmachine.ts::ARCH_CUSTOM` mapea `cold-2placas` y `cold-3placas` → `'cold'` (1.25) **siempre**, y
  `hot-runner` → `'hot-long'` (1.02) **siempre**. Es decir: **`cold-regrind` (1.08) y `hot-short` (1.05)
  nunca se usan**. La decisión de regrind, que el libro presenta como decisión con costo asociado, no existe;
  y el hot runner siempre se costea con su mejor caso. Sesgo sistemático a favor del hot runner.

### A-041 · Costo de material por pieza
- **CUÁNDO:** después de A-040.
- **ENTRADAS:** volumen de la pieza [m³] ←A-001 · rho y kappa del plástico ←A-007 · f_feed_waste ←A-040.
- **EL CÁLCULO (Ec. 3.21):** `C_material/part = V_part · rho · kappa · f_feed_waste` [$/pieza].
  (Bezel: **$0.06**.)
- **SALIDA:** $/pieza.
- **DECIDE:** el segundo término de A-047.
- **CRITERIO:** **[LIBRO]**.
- **INVALIDA:** cambio de espesor o de geometría (A-012/A-013), de resina, o de feed.
- **¿TENEMOS?** **SÍ.** `estimatePartCost` → `materialPerPart` con `PLASTICS[plastic]` y `FEED_WASTE`.

### A-042 · Tiempo de ciclo estimado
- **CUÁNDO:** temprano — lo necesita A-003 (throughput) y A-045 (costo de proceso).
- **ENTRADAS:** espesor de pared `h` [mm] ←A-012 · modo de operación y tipo de feed ←A-053.
- **EL CÁLCULO (Ec. 3.23):** `t_cycle = 4 [s/mm²] · h_wall² · f_cycle_efficiency` [s], con
  `f_cycle_efficiency` de la Tabla 3.13 de eficiencia, en pares [cold | hot]:
  semi-automático con operador **2.5 | 3.0** · gravedad o robot **1.5 | 2.0** · full-automático **1.0 | 1.5**.
  Realidad del mercado que el libro no esconde: *"many molders continue to use cold runner molds operating
  in semi-automatic mode"* aunque lo deseable sea full-auto.
- **SALIDA:** segundos.
- **DECIDE:** el costo de proceso (A-045), las cavidades mínimas (A-003) y la fecha de entrega.
- **CRITERIO:** **[LIBRO]**. La trampa más citada del capítulo: **el espesor entra AL CUADRADO** —
  3 mm no es el doble de 1.5 mm, es ~4×. Cada vez que alguien engruesa "para ganar rigidez" (A-013),
  esto es lo que paga.
- **INVALIDA:** cambio de espesor (dominante), de modo de operación o de feed.
- **¿TENEMOS?** **SÍ el cálculo, NO la decisión.** `moldcost-detailed.ts::cycleTimeEstimate(wallMm, cycleEff)`
  y `CYCLE_EFFICIENCY` con los 3 pares exactos. Pero `moldmachine.ts` pasa `cycleMode: 'automatico'`
  **hardcodeado**: el sistema asume siempre el mejor caso (1.0/1.5) y nunca costea el escenario semiautomático
  que, según el libro, es el que muchos moldeadores realmente operan. Es un optimismo de 2.5× en el ciclo.

### A-043 · Tonelaje de cierre
- **CUÁNDO:** para elegir máquina y su tarifa.
- **ENTRADAS:** n_cavidades · Lpart, Wpart (área proyectada) ←A-001.
- **EL CÁLCULO (Ec. 3.25):** `F_clamp = 75e6 [Pa] · (n_cav · L_part · W_part) / 9800` → [toneladas métricas].
  Es decir, **presión media supuesta de 75 MPa sobre el área proyectada**. (Bezel: 294 mTon.)
- **SALIDA:** toneladas métricas.
- **DECIDE:** la tarifa horaria de máquina (A-044) y la selección de inyectora.
- **CRITERIO:** **[LIBRO]**, etiquetado como **estimación conservadora**, y el libro mismo hace el descuento
  a mano: *"the true required clamp tonnage is likely less than 294 metric tons since the laptop bezel has a
  large window in it. The analysis, however, is conservative."* El área proyectada de una pieza con ventanas
  sobreestima; se etiqueta "conservador", no se recorta sin análisis.
- **INVALIDA:** cambio de cavitación o de tamaño de pieza.
- **¿TENEMOS?** **DIVERGE — y por arriba.** La Ec. 3.25 con 75 MPa **no está implementada**. En su lugar,
  `moldmachine.ts::clampFor` calcula la presión de llenado real con la física del cap. 5
  (`filling.ts::convergeVelocityTraced` + `pressureDropSegment`) y la multiplica por
  `CAVITY_PRESSURE_FACTOR = 0.5` (presión media ≈ ½ del pico en la compuerta), luego
  `filling.ts::clampMetricTons`. Es **mejor física**, pero se pierde el ancla conservadora barata del cap. 3
  para cuando no hay datos reológicos. Y el descuento por ventanas **sí lo tenemos y el libro no**:
  `dfm-mesh.ts` devuelve `projectedAreaMm2` real (columnas sólidas del raster, sin bbox) y
  `mold-contratos.ts::contratoLlenado` criterio `llenado-area-proyectada` cita `§5.5.3 · §3.4.3`.

### A-044 · Tarifa horaria de la máquina de moldeo
- **CUÁNDO:** después de A-043.
- **ENTRADAS:** F_clamp [toneladas métricas] ←A-043 · clase de máquina y auxiliares (Tabla 3.13 de capacidad).
- **EL CÁLCULO (Ec. 3.24):** `R_molding = [47.0 + 0.073·F_clamp − 4.7·ln(F_clamp)] · f_machine` [$/h],
  con F en toneladas métricas. `f_machine` es la clase base más sumadores apilables:
  hidráulica vieja **0.8** / estándar **1.0** / eléctrica moderna **1.1**; utilidad +0.1 · robot+banda +0.05 ·
  control de hot runner +0.05 · gas assist +0.1 · inyección-compresión +0.1 · operador dedicado +0.15 ·
  two-shot +1.0 · three-shot +1.4. Regla de auxiliares: *"The cost of all auxiliaries should be added…
  they should provide a net savings"* — si el auxiliar no se paga solo, sobra.
- **SALIDA:** $/h.
- **DECIDE:** el costo de proceso (A-045); y qué auxiliares se justifican.
- **CRITERIO:** **[LIBRO]** ecuación + tabla de sumadores.
- **INVALIDA:** A-043; cambio de máquina o de auxiliares.
- **¿TENEMOS?** **PARCIAL.** `moldcost-detailed.ts::moldingMachineRate(clampTons, fMachine = 1)` implementa
  la Ec. 3.24 exacta. Pero la **Tabla 3.13 de capacidad no existe**: `fMachine` siempre entra como 1,
  así que las 3 clases y los 8 sumadores no se pueden expresar. Un two-shot (+1.0, o sea el doble de tarifa)
  hoy cotiza igual que una hidráulica vieja.

### A-045 · Costo de proceso por pieza
- **CUÁNDO:** después de A-042 y A-044.
- **ENTRADAS:** t_cycle [s] ←A-042 · n_cavidades ←A-002/A-051 · R_molding [$/h] ←A-044.
- **EL CÁLCULO (Ec. 3.22):** `C_process/part = (t_cycle / n_cavities) · R_molding / 3600` [$/pieza].
  (Bezel: **$0.19**.)
- **SALIDA:** $/pieza.
- **DECIDE:** el tercer término de A-047; y es la fuerza que empuja hacia más cavidades (el ciclo se divide).
- **CRITERIO:** **[LIBRO]**.
- **INVALIDA:** A-042, A-044, o la cavitación.
- **¿TENEMOS?** **SÍ.** `estimatePartCost` → `processPerPart`.

### A-046 · Yield esperado
- **CUÁNDO:** al cerrar el costo por pieza, y otra vez en arranque de producción.
- **ENTRADAS:** volumen de producción · nivel de exigencia de calidad ←A-004/A-005.
- **EL CÁLCULO (Tabla 3.14):** por volumen × exigencia (baja | alta):
  10k ciclos **0.95 | 0.90** · 100k **0.98 | 0.95** · 1M **0.99 | 0.98**.
  Nota de arranque: **50–60 %** en aplicaciones difíciles, subiendo hacia ~100 % en commodity maduro.
  El catálogo de defectos que alimenta el conteo (§3.4.4): short shot, flash, contaminación, color fuera,
  splay/blush, warpage/dimensional, quemaduras, gloss pobre. El moldeador **filtra internamente** antes de embarcar.
- **SALIDA:** yield [fracción 0–1].
- **DECIDE:** divide TODO el costo por pieza (A-047).
- **CRITERIO:** **[LIBRO]** tabla 3×2.
- **INVALIDA:** cambio de volumen o de exigencia; y en la práctica, los resultados del tryout.
- **¿TENEMOS?** **PARCIAL — con un default optimista.** `estimatePartCost` usa `yield_ ?? 0.98` y
  `moldmachine.ts` nunca lo pasa: **todo cotiza con 0.98**, que en la Tabla 3.14 corresponde a
  "100k piezas, exigencia baja" o "1M, exigencia alta". Para una corrida de 10k con exigencia alta el libro
  dice 0.90 (8 puntos de diferencia sobre el costo TOTAL, no solo el material). La tabla y el catálogo de
  defectos no existen en código.

### A-047 · Costo por pieza
- **CUÁNDO:** cierra §3.4.
- **ENTRADAS:** C_mold/part ←A-039 · C_material/part ←A-041 · C_process/part ←A-045 · yield ←A-046.
- **EL CÁLCULO (Ec. 3.19):** `C_part = (C_mold/part + C_material/part + C_process/part) / yield` [$/pieza].
  (Bezel: (0.22 + 0.06 + 0.19) / 0.98 = **$0.48**.)
- **SALIDA:** $/pieza, con los 4 términos visibles.
- **DECIDE:** la comparación entre escenarios (A-048/A-049), el semáforo contra la meta del cliente (A-006)
  y el veredicto de sobrediseño (A-054).
- **CRITERIO:** **[LIBRO]**. Trampa importante: **el yield DIVIDE el costo completo**, no solo el material —
  con yield 0.5 de arranque, TODO cuesta el doble por pieza buena.
- **INVALIDA:** los cuatro términos.
- **¿TENEMOS?** **SÍ.** `estimatePartCost` → `partUSD`, con los cuatro términos expuestos en
  `PartCostBreakdown`. `mold-contratos.ts::contratoCosto` los usa para el criterio de sobrediseño.

---

# FASE 4 — LECTURA, COMPARACIÓN Y CIERRE (cap. 3 §3.1, §3.2, §3.4.4, §3.5 + cap. 4 intro)

Ésta es la fase que separa a Kazmer de una hoja de cálculo. Los números ya están; ahora **se leen**,
se comparan entre escenarios, y **se disparan los retornos**. El capítulo no termina con un número:
termina cuando la especificación converge.

### A-048 · Costo total de producción por escenario
- **CUÁNDO:** una vez por cada escenario candidato.
- **ENTRADAS:** C_total_mold ←A-037 (costo fijo) · C_part ←A-047 (costo marginal) · cantidad `n`.
- **EL CÁLCULO (Ec. 3.1):** `C_total = C_fixed + n · C_marginal` [$].
- **SALIDA:** $ totales del programa de producción, por escenario.
- **DECIDE:** cuál escenario gana **a este volumen**.
- **CRITERIO:** **[COMPARA]** entre escenarios.
- **INVALIDA:** todo lo de arriba; y un cambio de `n`.
- **¿TENEMOS?** **SÍ.** `cost.ts::totalCost` y `::costPerPart`; en el orquestador,
  `moldmachine.ts` calcula `totalUSD = cost.totalUSD + totalQty * part.partUSD` por variante.

### A-049 · Break-even entre arquitecturas
- **CUÁNDO:** después de tener al menos dos escenarios costeados.
- **ENTRADAS:** C_fixed y C_marginal de dos escenarios ←A-048.
- **EL CÁLCULO (§3.2.2, Ec. 3.1 despejada):**
  `n_breakeven = (C_fixed_HR − C_fixed_CR) / (C_marginal_CR − C_marginal_HR)` [piezas].
  Ejemplo reproducible del libro: `($250,000 − $10,000) / ($0.55 − $0.16) = 615,000 piezas`.
  Se grafica log-log (Fig. 3.4).
- **SALIDA:** piezas [unidades] — el volumen donde se cruzan las dos curvas.
- **DECIDE:** la arquitectura de alimentación y la cavitación, **en primera instancia**: es el ganador
  económico, sujeto a los vetos de A-053.
- **CRITERIO:** **[COMPARA]** contra el volumen esperado.
- **INVALIDA:** cualquier cambio en el costeo de cualquiera de los dos escenarios.
- **¿TENEMOS?** **SÍ, con ancla verificada.** `cost.ts::breakEven(a, b)` y `::chooseMold`;
  `scripts/mold-cost-test.cjs` reproduce los 615,385 del libro y los renglones de la Tabla 3.1
  ($0.75/pieza cold @50k, $0.21 hot @5M). En el orquestador,
  `moldmachine.ts::breakEvenReport` compara la ganadora contra la mejor alternativa de otra arquitectura
  y lo redacta en prosa.

### A-050 · Banda de sensibilidad sobre la cantidad de producción
- **CUÁNDO:** junto con A-049, antes de presentar la recomendación.
- **ENTRADAS:** n_breakeven ←A-049 · la incertidumbre de la cantidad ←A-001/A-002.
- **EL CÁLCULO:** barrido de `n` alrededor del break-even y del volumen esperado. Motivo literal (§3.2.2):
  la cantidad de producción real **no se conoce con precisión** — por eso el libro pide mostrar sensibilidad
  y no un solo número que decida solo.
- **SALIDA:** banda de decisión (rango de `n` donde el ganador cambia) [piezas].
- **DECIDE:** cuánta confianza tiene la recomendación, y si conviene entregar dos diseños en vez de uno.
- **CRITERIO:** **[JUICIO]** sobre el riesgo del cliente.
- **INVALIDA:** A-049.
- **¿TENEMOS?** **FALTA.** Damos un break-even puntual (`breakEvenReport` imprime un número) sin banda ni
  análisis de qué pasa si el volumen real es la mitad. Es especialmente grave porque el mismo libro dice
  que ese número de entrada es el menos confiable de todos.

### A-051 · Barrido de escenarios (la tabla comparativa)
- **CUÁNDO:** en cuanto la cavitación o el feed son "salida a optimizar" (A-002).
- **ENTRADAS:** el conjunto de arquitecturas × cavitaciones a evaluar · toda la cadena A-023…A-048.
- **EL CÁLCULO:** correr la cadena completa por escenario y tabular (Tabla 3.1): cavidades, tipo de runner,
  costo de molde, tcycle, ciclo efectivo por parte, y costos por parte (proceso / molde / material / total).
  Mandato literal (§3.2.2): *"multiple mold designs should be developed for different target production
  quantities, and the total production costs estimated and compared via break-even analysis"*.
  Y el matiz que casi nadie implementa: a volúmenes intermedios (~500,000) el óptimo puede **no ser** ni 2 ni
  32 cavidades sino 4/8/16, con o sin hot runner.
- **SALIDA:** tabla de escenarios ordenada por costo total.
- **DECIDE:** el menú que se le presenta al cliente. El entregable puede ser un **menú de moldes, no un molde**:
  *"If necessary, the customer can be given more than one design"*.
- **CRITERIO:** **[COMPARA]**.
- **INVALIDA:** cambio de la pieza o de la cantidad.
- **¿TENEMOS?** **SÍ, y es de lo mejor del sistema.** `moldmachine.ts` barre
  `archs × cavs = 3 × [1,2,4,8,16] = 15 variantes`, corre la cadena completa en cada una, marca `factible`
  por throughput (A-003) y ordena por `totalUSD`; `mold-contratos.ts::contratoCosto` criterio `costo-menu`
  audita que haya más de una variante factible y reporta la segunda con su sobrecosto en %.
  `revisar-modelo.ts::revisarLote` lo hace para lotes de piezas.

### A-052 · Payback del hot runner de alta cavitación
- **CUÁNDO:** cuando el ganador de A-049 es un molde caro de alta cavitación.
- **ENTRADAS:** delta de inversión ←A-037 · ahorro por pieza ←A-047 · tasa de producción ←A-003.
- **EL CÁLCULO:** `payback = delta_inversion / (ahorro_por_pieza · piezas_por_mes)` [meses] — **INFERIDO**
  en su forma; lo que el corpus sí registra literal es el **criterio**: muchos moldeadores y clientes exigen
  payback corto, y solo aceptan el hot runner de alta cavitación si el payback es deseable (§3.2.2).
  La ecuación exacta: **NO OBSERVADA EN EL CORPUS**.
- **SALIDA:** meses.
- **DECIDE:** si el ganador económico de largo plazo sobrevive al criterio financiero de corto plazo.
- **CRITERIO:** **[JUICIO]** con umbral del cliente (no del libro).
- **INVALIDA:** A-037, A-047, o cambio de la tasa de producción.
- **¿TENEMOS?** **FALTA el cálculo.** `moldmachine.ts` declara `spec.vetos.paybackMaxMeses` en el tipo,
  pero **nadie lo calcula ni lo compara** (ver A-053).

### A-053 · Vetos no económicos sobre el ganador
- **CUÁNDO:** después de A-049, antes de recomendar.
- **ENTRADAS:** ganador económico ←A-049 · restricciones no económicas del cliente y del moldeador.
- **EL CÁLCULO:** filtro cualitativo. Los cuatro vetos que el libro nombra (§3.2.2):
  (1) **cambio rápido de color** — veta el hot runner por la purga (el libro remite a §6.4.8);
  (2) **capacidad y preferencia del moldeador** — *"the mold should be designed to maximize the molder's
  capability unless the application requirements and cost constraints dictate otherwise"*, reforzado por
  §1.4.2: *"not all molders have the auxiliary equipment or expertise"*;
  (3) **estandarización lean** del moldeador en un tipo/tamaño de molde;
  (4) **payback exigido** ←A-052.
- **SALIDA:** ganador confirmado o sustituido, **con la razón registrada**.
- **DECIDE:** la arquitectura final. Y el libro insiste en que la razón no económica quede **en el registro
  de decisiones**, no en la cabeza de alguien.
- **CRITERIO:** **[JUICIO]**, con veto sobre el resultado numérico.
- **INVALIDA:** cambio de moldeador destino; cambio de requisitos de la aplicación.
- **¿TENEMOS?** **PARCIAL — declarado pero NO aplicado.** `MachineSpec.vetos
  {cambioColorFrecuente, paybackMaxMeses, nota}` existe en el tipo (líneas 83–84 de `moldmachine.ts`) y
  `mold-contratos.ts::contratoCosto` criterio `costo-vetos` los audita y advierte cuando no hay ninguno
  declarado. Pero **el optimizador nunca lee `spec.vetos`**: el ganador se elige solo por `totalUSD`.
  El veto se documenta y no se ejerce.

### A-054 · Veredicto de SOBREDISEÑO (la lectura de la proporción)
- **CUÁNDO:** al final de §3.4, mirando el costo por pieza ya desglosado.
- **ENTRADAS:** los tres términos de A-047 (molde, material, proceso) en $/pieza.
- **EL CÁLCULO:** comparación de proporciones. En el bezel: 0.22 (molde) vs 0.06 + 0.19 (material + proceso).
  Veredicto literal (§3.4.4): *"The large cost of the mold relative to the material and processing costs
  indicates that the mold may have been over designed. Further cost analyses should be performed to analyze
  the effectiveness of a cold runner mold design with a lower initial mold cost."*
- **SALIDA:** bandera booleana + la alternativa recomendada.
- **DECIDE:** **RETORNO a A-051** con una arquitectura más barata. Es la señal de re-cotizar más importante
  del capítulo, y es lo que un motor lineal jamás haría: entrega el número y se queda tan tranquilo.
- **CRITERIO:** **[COMPARA]** interna al resultado; el umbral exacto (¿qué es "large relative to"?) es
  **[JUICIO]** — el libro no da un porcentaje. **NO OBSERVADO EN EL CORPUS** un umbral numérico.
- **INVALIDA:** cualquier re-costeo.
- **¿TENEMOS?** **SÍ.** `mold-contratos.ts::contratoCosto` criterio `costo-sobrediseno`: mide
  `pctMolde = moldPerPart/partUSD·100`, umbral **50 %**, y cuando lo cruza cita el texto en inglés.
  ⚠ El 50 % es **umbral nuestro, no del libro** — está bien elegido (en el bezel da 46 %, justo por debajo,
  y el libro **sí** llama sobrediseñado a ese caso), pero conviene etiquetarlo como calibración propia.

### A-055 · Sanity check geográfico del resultado
- **CUÁNDO:** justo antes de soltar la cotización.
- **ENTRADAS:** costo total ←A-037 · los coeficientes de mano de obra usados (tarifa de maquinado y de acabado).
- **EL CÁLCULO:** re-correr la cadena con otros coeficientes de mano de obra. El libro lo hace explícito en
  su propio ejemplo: el resultado es razonable para Estados Unidos y *"may over estimate the cost of the mold
  if made in Asia… Accordingly, the analysis could be repeated for a cold runner mold with different labor
  cost coefficients."*
- **SALIDA:** rango de costo por región [$].
- **DECIDE:** con qué número se compite; y si el trabajo se cotiza local o se subcontrata.
- **CRITERIO:** **[JUICIO]** de mercado.
- **INVALIDA:** cambio de tarifa; cambio de proveedor.
- **¿TENEMOS?** **PARCIAL.** `machiningRateUSDh` es parámetro del spec (con default 100 = EE.UU.) y
  `contratoCosto` criterio `costo-datos-taller` verifica que el dato del taller mande. Pero **no existe el
  re-corrido comparativo por geografía**: hay que llamar dos veces a mano y comparar a ojo.

### A-056 · Convergencia de la especificación del molde
- **CUÁNDO:** es el bucle exterior de todo el cap. 3.
- **ENTRADAS:** todos los estimados producidos hasta ahora.
- **EL CÁLCULO:** iteración hasta convergencia. Literal (§3.5): *"It is recommended that multiple cost
  estimates be developed for different mold designs until an effective mold specification is established"*.
- **SALIDA:** **la especificación del molde** — que es el entregable real del cap. 3 y la entrada del cap. 4.
- **DECIDE:** cuándo parar de cotizar. La cotización termina cuando la especificación converge, no cuando
  sale el primer número.
- **CRITERIO:** **[JUICIO]**.
- **INVALIDA:** cualquier retorno disparado por A-054, A-053, A-006 o A-022.
- **¿TENEMOS?** **PARCIAL.** El barrido de 15 variantes (A-051) es una convergencia de una sola pasada;
  no hay bucle que reaccione al veredicto de A-054 generando y evaluando la alternativa recomendada.
  El contrato lo **detecta** y lo **reporta**, pero nadie cierra el lazo automáticamente.

### A-057 · Costo verdadero vs precio, y términos de pago
- **CUÁNDO:** al armar el documento de cotización.
- **ENTRADAS:** C_total_mold ←A-037 · C_part ←A-047 · política comercial.
- **EL CÁLCULO:** separación explícita de **costo** y **precio**. Regla de honestidad literal (§3.1):
  ajustar la cotización según si quieres o no el negocio *"should be avoided since the provided quote does
  not represent the true costs of the supplier, which would become the basis in a long term and mutually
  beneficial partnership."* Términos de pago típicos: **tres tercios** — (1) al aceptar la cotización
  (ahí se compran base y materiales clave), (2) a mitad del proyecto, típicamente cuando los insertos de
  cavidad están maquinados, (3) *"upon acceptance of the quality of the molded parts"*.
- **SALIDA:** precio [$], calendario de pagos [3 hitos], términos de entrega y garantías con penalizaciones.
- **DECIDE:** el documento que firma el cliente. El tercer pago ata el cobro a un criterio de aceptación
  **sobre piezas**, no sobre el molde — eso es un requisito de diseño, no solo de contrato.
- **CRITERIO:** **[JUICIO]** comercial, con la regla dura de no maquillar el costo.
- **INVALIDA:** re-cotización.
- **¿TENEMOS?** **PARCIAL.** `moldmachine.ts` separa costo de precio (`precioMolde = win.cost.totalUSD *
  (spec.margin ?? 1.6)`) y estima `entregaSemanas`, que es exactamente la separación que el libro exige.
  **Faltan** los tres tercios, las garantías con penalizaciones y los términos de entrega.

### A-058 · Calendario de desembolsos del proyecto
- **CUÁNDO:** al presentar la cotización, para que el cliente vea el flujo de caja.
- **ENTRADAS:** términos de pago ←A-057 · duración del proyecto ←A-030 (horas de maquinado).
- **EL CÁLCULO:** distribución en el tiempo (Fig. 3.1): pagos del molde en los tres hitos, **trials en el
  mes ~3** con ~100 piezas de preproducción para marketing y pruebas, costos de producción, y mantenimiento
  **intermitente** durante la producción.
- **SALIDA:** curva de desembolso mensual [$/mes].
- **DECIDE:** aceptación del proyecto por finanzas del cliente; y la fecha del tryout.
- **CRITERIO:** **[LIBRO]** la estructura; los montos salen de A-037/A-047.
- **INVALIDA:** cambio de calendario o de alcance.
- **¿TENEMOS?** **FALTA.** Solo existe `entregaSemanas` (un escalar). El contenido gráfico de la Fig. 3.1
  está **NO OBSERVADO EN EL CORPUS** (solo su descripción textual).

### A-059 · Iteración inserto ↔ base discreta (frontera con el cap. 4)
- **CUÁNDO:** al aterrizar el tamaño estimado del molde en una base real.
- **ENTRADAS:** L, W, H estimados ←A-034 · catálogo de bases estándar.
- **EL CÁLCULO:** ajuste a tamaño discreto. Literal (cap. 4 intro): *"Mold bases are only available in
  discrete sizes, so iteration between the inserts' sizing and mold base selection is normal"*.
- **SALIDA:** base de catálogo + insertos re-dimensionados.
- **DECIDE:** las cotas que se congelan (y por lo tanto lo que se puede comprar, A-009), porque
  *"these dimensions are quite expensive to change once the mold making process has begun"*.
- **CRITERIO:** **[LIBRO]** catálogo; **[JUICIO]** cuándo congelar.
- **INVALIDA:** cambio de cavitación o de tamaño de inserto — **RETORNO a A-023**.
- **¿TENEMOS?** **PARCIAL.** `moldbase.ts::selectMoldBase` aterriza en bases estándar
  (196–996 mm por lado, placas a incrementos de 10 mm) y `mold-contratos.ts::contratoLayout` criterio
  `layout-base-catalogo` lo audita. Lo que **falta es la iteración**: si la base de catálogo obliga a
  achicar el inserto, nadie regresa a A-023 a re-dimensionarlo y re-costear.

---

## Lo que NO tiene ficha (y por qué)

Se descartó a propósito, no por olvido. Todo esto es **lección o dato**, no análisis: no produce un número
o veredicto que alimente una decisión.

| Qué | § | Por qué no es análisis |
|---|---|---|
| Glosario de componentes y sus nombres múltiples (placa "A", ejector housing, risers) | §1.3.1 | Nomenclatura. Ficha visual V1.1 lo confirma: *"el libro muestra estas figuras sin criterio verbal de bueno/malo"* |
| Recorrido del melt: nozzle → sprue → runners → gates → cavidades | §1.3.3, Fig 1.6 | Explicación de funcionamiento |
| Por qué la pieza queda del lado móvil (*"the moldings stay with the moving half since they have shrunken onto the core"*) | §1.3.3 | Hecho físico que fundamenta el diseño de expulsión, no un cálculo |
| Cinemática del three-plate (sprue pullers, stripper bolts, degating automático) | §1.4.1, Fig 1.7 | Descripción de mecanismo |
| Gates térmicos del hot runner que solidifican y se rompen al arrancar el ciclo | §1.4.2 | Descripción de mecanismo |
| Anillo centrador estándar de 100 mm | §1.3.1 | Dato de catálogo |
| Toll-gates del desarrollo de producto (concepto→diseño→desarrollo→scale-up→launch) | §2.1, Fig 2.1 | Estados del proyecto, no cálculo (aunque cada gate consume las salidas de A-006/A-010) |
| Estados alpha y beta | §2.1.3–2.1.4 | Hitos |
| Ruteo de preguntas (trivial → ingeniero interno; de fondo → cliente) | §2.2.1, Tabla 2.2 | Regla de relación; no produce número. Importa mucho para la UI, nada para el motor |
| Tip de CAD: filetear exteriores antes del shell | §2.3.4 | Técnica de modelado (aunque condiciona A-016) |
| Moldes prototipo de aluminio en NC de alta velocidad; el aluminio duro "canibalizando" acero | §3.3.1.3 nota | Tendencia de mercado que el cliente vigila |
| Que los drivers de costo NO incluyen indirectos (se absorben en las tarifas horarias) | §3.2 | Regla contable de no-doble-conteo; gobierna A-030/A-044, no es un análisis aparte |
| Compacidad del layout de cavidades (*"as close together as possible"* sin sacrificar agua/expulsión) | §1.3.2 | **Caso frontera.** Es un trade-off real, pero su cálculo (área usable, claros) vive en el cap. 4 (fichas V4.10/V4.11) y ahí debe llevar ficha, no aquí |

---

## NO OBSERVADO EN EL CORPUS — dónde este pliego se queda corto contra el libro

El corpus derivado es bueno en prosa y en ecuaciones, y **ciego en figuras**. Lo que falta:

1. **Cap. 3 sin fichas visuales.** `verificaciones-visuales.md` tiene V1.1 y V2.1–V2.7, y salta directo a V4.1:
   **no hay ninguna V3.x**. El contenido gráfico de las Figs. 3.1 (calendario de desembolsos),
   3.2–3.3 (árbol de drivers de costo; cable tie vs conector custom), 3.4 (break-even log-log) y
   3.5 (desglose del bezel) **no está**. Solo sus descripciones textuales. Afecta a A-058 sobre todo.
2. **El símbolo exacto de la Ec. (3.17).** El corpus documenta que la raíz cuadrada no sobrevivió a la
   extracción y quedó "ceiling(ncavities)". Se transcribe como `ceiling(sqrt(n))` porque el libro lo declara
   rejilla cuadrada conservadora, pero **el símbolo literal no está observado**.
3. **El umbral de "sobrediseño" (A-054).** El libro dice *"large cost of the mold relative to…"* sin dar
   porcentaje. Nuestro 50 % es calibración propia.
4. **La ecuación de payback (A-052).** El criterio está citado; la fórmula no.
5. **La ecuación de throughput (A-003).** Los campos de la Tabla 2.3 están; la aritmética que los liga, no.
6. **Umbrales numéricos de uniformidad de pared (A-012).** El libro califica con palabras
   ("varying", "extreme"); nuestros 1.15 y 1.5 son inventados.
7. **Tabla 2.12 completa (SPI A-1 … D-3 con método y rugosidad por fila).** El corpus da los extremos
   (A-1 #3 diamante ~0.01 µm; D-3 #24 óxido ~4 µm) y el ejemplo de C-3, no las 12 filas.
8. **Fotos de texturas de la Tabla 2.13.** Solo las profundidades y su pre-acabado.
9. **Tabla 3.2 completa** (la hoja de datos del bezel). Tenemos los números clave dispersos
   (240×160×10, pared 1.5, área 45,700 mm², volumen 27,500 mm³, 1M piezas) porque están en el test,
   no porque el corpus los liste juntos.
10. **Hatch patterns de la Fig. 1.6** (planta + sección A-A con achurado por componente) — la ficha V1.1
    los declara valiosos como formato de render canónico, pero la imagen no está.

---

## INVENTARIO — qué tenemos y qué falta

**59 análisis extraídos.** Reparto por capítulo de origen:

| Capítulo | Análisis | Cuáles |
|---|---|---|
| Cap. 1 | **2** | A-008 (conflictos §1.2), A-009 (firme vs difuso §1.5) |
| Cap. 2 | **20** | A-001…A-007 (worksheets e intake), A-010…A-022 (DFM §2.3) |
| Cap. 3 | **36** | A-023…A-058 |
| Cap. 4 intro | **1** | A-059 (inserto ↔ base discreta) |

Que el cap. 1 aporte solo 2 análisis **no es un vacío de la extracción**: el cap. 1 no calcula, pone la
**topología** (el grafo con sus dos gates y sus retornos) y el sesgo global (§1.2 anti-sobrediseño).
Su contribución real a este pliego está en la sección GRAFO, no en las fichas.

| Estado | Cuántos | Cuáles |
|---|---|---|
| **SÍ (implementado y con ancla verificada)** | **26** | A-012, A-014, A-016, A-018, A-020, A-023, A-024, A-025, A-026, A-027, A-028, A-030, A-032, A-033, A-034, A-035, A-036, A-037, A-039, A-041, A-045, A-047, A-048, A-049, A-051, A-054 |
| **PARCIAL** | **21** | A-002, A-003, A-007, A-008, A-010, A-015, A-019, A-021, A-029, A-031, A-038, A-040, A-042, A-043, A-044, A-046, A-053, A-055, A-056, A-057, A-059 |
| **FALTA** | **12** | A-001, A-004, A-005, A-006, A-009, A-011, A-013, A-017, A-022, A-050, A-052, A-058 |

El patrón salta a la vista: **la aritmética del cap. 3 está casi completa (Fase 2 al 100 %), y lo que falta
es todo lo que el libro pone ALREDEDOR de la aritmética** — los worksheets que la alimentan (A-001, A-004,
A-005, A-006), las tablas de juicio que la calibran (A-038 mantenimiento, A-046 yield, A-029 mezcla de procesos)
y los retornos que la reabren (A-013, A-022, A-050, A-052). Sabemos calcular el número; nos falta saber si el
número es bueno y qué hacer cuando no lo es.

### Los 6 huecos que más duelen (por impacto sobre el número final)

1. **A-038 · matriz de mantenimiento (Tabla 3.11).** `f_maint` fijo en 3 para todo. Un molde suave con
   resina cargada de vidrio debería dar **×20**: cotizamos ~7× barato en ese caso. Costo de arreglo: una tabla 3×3.
2. **A-046 · Tabla 3.14 de yield.** `yield` fijo en 0.98 para todo. Y el yield **divide el costo completo**,
   así que el error se propaga a los tres términos. Costo de arreglo: una tabla 3×2.
3. **A-042 + A-040 · optimismo sistemático.** `cycleMode` siempre `'automatico'` (mejor caso de la Tabla 3.13)
   y el hot runner siempre con `hot-long` (1.02, mejor caso de la Tabla 3.12), mientras el cold runner
   nunca ve `cold-regrind` (1.08). Los tres defaults empujan en la misma dirección: **el hot runner
   automático se ve mejor de lo que el libro lo pinta.**
4. **A-029 · f_machining por heurística.** Sustituimos el promedio ponderado por mezcla de procesos por
   `complexity > 2.5 ? 4 : …`, acoplando dos análisis que el libro mantiene separados. Multiplica el
   driver más grande del molde.
5. **A-031 · acabado por zonas sin cablear.** La API lo soporta y el test lo usa; el orquestador manda una
   sola zona. El dato existe y no llega al juez.
6. **A-053 · vetos declarados y no ejercidos.** `spec.vetos` está en el tipo, lo audita el contrato, y el
   optimizador nunca lo lee. Un cliente con cambio de color frecuente igual recibe hot runner.

### Lo que tenemos y el libro NO pide (extensiones honestas)

- `plate-cost.ts::plateCosts` — desglose placa por placa del mold base, con la suma amarrada a la Ec. 3.15.
  El archivo **declara en su encabezado que es extensión nuestra**, no cita. Ése es el estándar.
- `dfm-mesh.ts::dfmFromMesh` — mide sobre malla lo que el libro declara a mano, incluye `projectedAreaMm2`
  real (descuenta ventanas: el descuento que Kazmer hace mentalmente en A-043) y detecta cavidades cerradas
  no moldeables.
- `moldmachine.ts::clampFor` — clamp por física del cap. 5 en vez de los 75 MPa del cap. 3 (mejor, pero
  perdimos el ancla conservadora barata).
- `mold-contratos.ts` — el juez de 69 criterios; para el cap. 3 aporta `costo-sobrediseno`, `costo-menu`,
  `costo-vetos`, `costo-mantenimiento`, `costo-datos-taller`, `costo-sesgos`.
- `CostBreakdown.sesgos[]` — cada estimado conservador sale etiquetado con su dirección, magnitud y cita.
  Eso es literalmente lo que el libro pide y casi ningún software hace.

---

# GRAFO

El volcado del orden en que Kazmer piensa. `→` = alimenta. `⇒RETORNO` = el resultado obliga a rehacer algo
que ya estaba hecho. `‖` = corren en paralelo (no dependen entre sí).

## Columna vertebral

```
A-001 suficiencia del intake
  → A-002 restricción-vs-salida
      → A-003 cavidades mínimas por throughput   (necesita A-042, lazo corto)
  → A-004 tolerancias  ‖  A-005 regulatorio+estética  ‖  A-007 fichas de material
  → [FASE 1: DFM]
  → [FASE 2: costo del molde]
```

## Fase 1 — DFM (casi todo en paralelo, colgando de A-012)

```
A-012 uniformidad de pared  (RAÍZ del DFM: "todo lo demás hereda de aquí")
  → A-013 espesor nominal vs delgado+ribs
  → A-014 rib  ‖  A-015 boss  ‖  A-016 esquinas
                                  → A-017 radio de catálogo de herramienta
A-019 acabado ──┬→ A-018 draft requerido          (+1°/20 µm)
               ├→ pre-acabado obligatorio B/C
               └→ A-031 costo de acabado         (los TRES efectos de una sola decisión)
A-018 → A-020 undercuts (draft < 0)
        → A-021 eliminar vs conservar
A-004, A-005 ──→ A-010 checklist DFM 9 puntos ←── A-012, A-014, A-015, A-016, A-018, A-020
A-011 checklist DFA (independiente, mira el ensamble)
A-010, A-011, A-013, A-021 → A-022 propuesta de rediseño al cliente
```

## Fase 2 — Costo del molde (cadena casi lineal)

```
A-001 (bbox) → A-023 dimensiones de inserto
A-004 + A-007 → A-024 acero del inserto

A-023 + A-024 → A-025 material del inserto ────────────┐
A-023 + A-024 → A-026 t_vol  ‖  A-027 t_area            │
A-001 + A-012 → A-028 f_complexity                     │
[Fase 1] ────→ A-029 f_machining (mezcla de procesos)│
A-026,A-027,A-028,A-029 → A-030 costo de maquinado ──────┤
A-019 + A-005 ────────→ A-031 acabado por zonas ───────┤
                                                     ▼
                                            A-032 C_cavity (Ec 3.4)
                                                     │
                                            A-033 descuento ×n (Ec 3.3)
A-023 + n_cav → A-034 dims del molde → A-035 masa y costo de base (Ec 3.15)
A-020/A-021 + tecnologías → A-036 customización (Ec 3.18) ← A-033, A-035
                                                     ▼
                                    A-037 COSTO TOTAL DEL MOLDE (Ec 3.2)
```

## Fase 3 — Costo por pieza

```
A-024 + A-007 → A-038 f_maintenance
A-037 + A-038 → A-039 molde/pieza (Ec 3.20) ──┐
A-040 f_feed_waste → A-041 material/pieza ───┤
A-012 → A-042 t_cycle (Ec 3.23, h²) ─┐        │
A-001 → A-043 clamp (Ec 3.25) → A-044 R_maquina (Ec 3.24) │
A-042 + A-044 → A-045 proceso/pieza (Ec 3.22) ┤
A-001/A-004 → A-046 yield (Tabla 3.14) ───────┤
                                            ▼
                            A-047 COSTO POR PIEZA (Ec 3.19)
```

## Fase 4 — Lectura y cierre

```
A-037 + A-047 → A-048 costo total por escenario (Ec 3.1)
A-048 (×2)   → A-049 break-even
                → A-050 banda de sensibilidad
                → A-052 payback
A-002 + [toda la cadena] → A-051 barrido de escenarios (Tabla 3.1)
A-049 + A-052 → A-053 vetos no económicos → arquitectura FINAL
A-047        → A-054 veredicto de sobrediseño
A-037        → A-055 sanity check geográfico
A-037 + A-047 → A-057 costo vs precio + términos → A-058 calendario de desembolsos
A-034        → A-059 inserto ↔ base discreta
[todo]      → A-056 convergencia de la especificación → ENTREGA al cap. 4
```

## LOS RETORNOS (lo que hace que esto sea un grafo y no un wizard)

```
R1 ⇒ A-054 → A-051            SOBREDISEÑO. Si el molde amortizado domina el costo por pieza,
                            se regresa a generar y comparar la alternativa barata.
                            §3.4.4 — el retorno más importante del cap. 3.
                            TENEMOS la detección (contratoCosto), NO el regreso automático.

R2 ⇒ A-056 → A-051            CONVERGENCIA. "multiple cost estimates… until an effective mold
                            specification is established" (§3.5). El bucle exterior del capítulo.
                            PARCIAL: barremos una vez, no iteramos.

R3 ⇒ A-006 → A-001/A-012       GATE "Project OK?" (§1.5, Fig 1.9). Si el estimado rebasa la meta del
                            cliente, se regresa a "Review part design and specifications".
                            FALTA (no hay metas capturadas).

R4 ⇒ A-022 → A-012…A-021       REDISEÑO DE LA PIEZA. La propuesta al cliente reabre el DFM completo,
                            y con él toda la Fase 2 (A-028 f_complexity cambia). §2.2.4, §3.1.
                            FALTA.

R5 ⇒ A-021 → A-020 → A-036     UNDERCUT. Conservar o eliminar cambia el mecanismo, el coeficiente de
                            costo y a veces la dirección de apertura (que a su vez redefine QUÉ es
                            undercut: lazo A-020 ↔ cap. 4). §2.3.7. PARCIAL.

R6 ⇒ A-019 → A-018            ACABADO → DRAFT. Cambiar el acabado cambia el draft requerido
                            (+1°/20 µm) y por lo tanto puede crear undercuts nuevos (A-020).
                            El retorno más olvidado del cap. 2. TENEMOS la fórmula, no el disparo.

R7 ⇒ A-059 → A-023            BASE DISCRETA. "iteration between the inserts' sizing and mold base
                            selection is normal" (cap. 4 intro). Re-dimensionar el inserto
                            re-dispara TODA la Fase 2. PARCIAL: aterrizamos, no iteramos.

R8 ⇒ A-053 → A-049            VETO. Un factor no económico tumba al ganador del break-even y obliga
                            a elegir el segundo lugar. §3.2.2. DECLARADO, NO EJERCIDO.

R9 ⇒ A-003 → A-051            THROUGHPUT. Si ni la cavitación máxima alcanza el volumen anual,
                            hay que replantear (más moldes, o ciclo más corto → A-013 → A-012).
                            TENEMOS (bandera `throughputForzado`).

R10 ⇒ A-013 → A-042 → A-045    ESPESOR. Engrosar para ganar rigidez multiplica el ciclo por h²
                            y con él el costo de proceso; el "arreglo" de rigidez se paga
                            en la Fase 3. TENEMOS las piezas, FALTA el comparador.

R11 ⇒ A-008 (transversal)    CONFLICTO ENTRE SUBSISTEMAS. "the placement of ejector(s) may require
                            a redesign of the cooling system" (§1.5). No es un retorno de un nodo
                            a otro: es la regla de que **editar una fase marca STALE lo de río
                            abajo**. Vale para todo el grafo, incluidos los caps. 4–13.
                            PARCIAL (los contratos reportan conflictos; no hay marcado STALE).

R12 ⇒ gate "Moldings OK?"   Fuera del alcance de estos capítulos (§1.5, después del tryout), pero
                            define el destino final del grafo: "tweak" (lo usual) vs "fatal flaw"
                            (tirar el molde y rediseñar completo).
```

## Lo que se puede correr en paralelo (para quien lo vaya a implementar)

- **Fase 0:** A-004 ‖ A-005 ‖ A-007 (tres worksheets independientes).
- **Fase 1:** A-014 ‖ A-015 ‖ A-016 ‖ A-018 ‖ A-020 (cinco verificadores geométricos, todos cuelgan de A-012).
- **Fase 2:** A-025 ‖ (A-026 ‖ A-027) ‖ A-028 ‖ A-031 convergen en A-032; y A-034→A-035 corre en paralelo a
  toda la rama de insertos.
- **Fase 3:** A-039 ‖ A-041 ‖ A-045 son independientes entre sí; solo A-047 los junta.
- **Fase 4:** las 15 variantes de A-051 son **vergonzosamente paralelas** — cada una es una corrida
  completa e independiente de A-023…A-048.

## La forma del grafo, en una frase

El cap. 1 pone la **topología** (dos gates, retornos, y el sesgo anti-sobrediseño), el cap. 2 produce
**adimensionales baratos** que son gate del dinero, y el cap. 3 es una **cadena aritmética de 25 pasos
que al final se lee a sí misma** y decide si vale la pena recorrerla otra vez. El valor del pliego no
está en los 59 nodos: está en los 12 retornos, porque son lo único que un wizard lineal no puede imitar.
