# EL PLIEGO DE ANÁLISIS — Kazmer caps. 4–6
## Ingeniería inversa del modelo mental: qué se calcula, en qué orden, y qué decide

**Fecha:** 2026-08-06 · **Alcance:** cap. 4 (arquitectura del molde: dirección de apertura, línea y
superficie de partición, shut-offs, insertos, layout de cavidades, mold base, compatibilidad con la
máquina, materiales), cap. 5 (análisis de llenado de la cavidad), cap. 6 (sistema de alimentación).

Documento hermano de `analisis-caps7-9.md`: mismos nueve campos por ficha, mismas convenciones,
mismo cierre con GRAFO. Este tomo va **antes** en el libro y **antes** en el flujo de diseño.

---

## Por qué existe este documento

El libro de Kazmer **no tiene** un capítulo llamado "análisis a realizar". Tiene a un ingeniero
razonando en voz alta. Cada vez que compara, despeja, sustituye un número o dicta un veredicto,
eso es un análisis — y el grafo que los conecta lo da por obvio porque lo tiene en la cabeza.
Este pliego lo vuelve explícito.

Ya se hicieron dos lecturas del mismo corpus con otras lentes:
- **UI** — `pliego-UI-v2.md`, `pliego-caps4-6.md`, `libro-caps4-6.md` (qué pantallas hacen falta).
- **Verificación visual** — `verificaciones-visuales.md`, fichas V4.1–V4.13, V5.1–V5.6, V6.1–V6.6
  (qué se juzga MIRANDO).

Ésta es la tercera: **ANÁLISIS** (qué se calcula, con qué entra, qué sale, y qué decide).

## Qué cuenta como "análisis" aquí

Unidad de razonamiento que **toma datos, produce un número o un veredicto, y alimenta una decisión**.
Si no alimenta ninguna decisión, es lección, no análisis, y no tiene ficha.

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

## Fuente y su límite (regla dura)

Los tomos crudos del libro **ya no existen** (se perdieron en una limpieza de disco). Este pliego se
construyó sobre el corpus DERIVADO, que sí conserva **citas literales verificadas con grep**:
`libro-caps4-6.md`, `pliego-caps4-6.md`, `verificaciones-visuales.md` (fichas V4.x/V5.x/V6.x) y `cruce.md`.

- **Toda cita entre comillas de este documento existe textualmente en el corpus.** Verificado con
  `grep -F` frase por frase.
- Lo que no es cita y es deducción mía va marcado **`INFERIDO`**.
- Lo que sospecho que el libro dice y el corpus derivado **no capturó** va marcado
  **`NO OBSERVADO EN EL CORPUS`** — es información útil (dice dónde volver a leer si el tomo reaparece),
  no un fracaso.

## Convenciones

- Fórmulas en ASCII. `alpha` = difusividad térmica, `gammadot` = tasa de corte, `Vdot` = caudal
  volumétrico, `mu`/`eta` = viscosidad, `rho` = densidad, `Cp` = calor específico, `k` = conductividad.
- **[LIBRO]** = umbral numérico explícito del libro · **[COMPARA]** = el criterio es una comparación
  entre dos cantidades calculadas, sin número absoluto · **[JUICIO]** = Kazmer decide sin número
  (y lo dice).
- Las piezas de ejemplo del libro se citan por su nombre: **bezel** (marco de laptop, ABS, pared
  1.5 mm, 2 gates), **cup** (taza, ABS, pared 3 mm), **lid** (tapa, ABS, pared 2 mm) y el
  **contenedor** 100×160×60 mm (2 mm de pared, *"2° draft with 10 mm fillets"*).
- **Numeración: `A-060 … A-137`, en el espacio ÚNICO del pliego** (`A-001 … A-292`, en orden de libro).
  Los cuatro tomos se escribieron por separado y dos reiniciaron en `A-01`; la colisión se resolvió el
  2026-08-07 renumerando cap. 1-3 → 4-6 → 7-9 → 10-13. Este tomo era local `A-01 … A-78` (+59).
  Índice maestro y tabla viejo→nuevo: [`INDICE-ANALISIS.md`](./INDICE-ANALISIS.md).

## Tres cosas que este tomo trata como de primera clase, porque el libro las trata así

1. **Las bandas de DOS colas.** Un ΔP bajo también REPRUEBA (§5.1 en la cavidad, §6.5.1 en el runner);
   un molde demasiado chico para la máquina también reprueba (§4.3.3); un tonelaje excesivo también
   daña. Un optimizador que minimice ΔP produce exactamente el diseño que Kazmer rechaza.
2. **La dirección del redondeo.** No hay `round()` simétrico en este libro: alturas de inserto hacia
   ARRIBA (§4.2.1), diámetros del feed system hacia ABAJO (§6.5.5). La dirección ES el análisis.
3. **El sesgo declarado del método.** *"all the models always over predicted the filling pressures"*
   (§5.4). El análisis no pretende ser exacto: pretende errar del lado seguro, y el libro dice cuánto
   y por qué. Eso convierte el contraste contra simulación (A-107, Tabla 5.1) en parte del método,
   no en un extra.

---

# CAPÍTULO 4 — ARQUITECTURA DEL MOLDE · A-060 … A-081

> **El cap. 4 es un embudo: cada paso consume grados de libertad del siguiente**, y el libro lo declara
> como gate de orden — *"The mold designer **must first** determine the mold opening direction to design
> the parting plane"* (§4.1). La cadena es apertura → línea de partición → plano de partición →
> shut-offs → insertos → layout de cavidades → mold base → máquina → proveedor → materiales.
> No hay una sola ecuación en §4.1: los primeros cinco análisis son **cualitativos con criterio
> declarado**, y por eso son los que un software tiende a saltarse.

### A-060 · Dirección de apertura del molde
- **CUÁNDO** — primerísimo paso del diseño del molde. Nada del cap. 4 corre antes.
- **ENTRADAS** — geometría de la pieza: áreas de las caras, undercuts, orientación de paredes,
  costillas y bosses. Raíz del grafo: no viene de ningún análisis anterior.
- **EL CÁLCULO** — **cualitativo, sin ecuación**, con dos criterios que se evalúan a la vez:
  (1) *"The mold cavity is typically placed with its largest area parallel to the parting plane"*,
  cuya razón es que la cavidad *"does not exert undue stress on the injection mold"*;
  (2) *"the mold cavity should be positioned such that the molded part can be ejected"*.
- **SALIDA** — un vector de apertura, más el catálogo de direcciones descartadas con su motivo.
  Si el resultado exige más de una dirección de movimiento, sale además una **bandera de costo**.
- **DECIDE** — apertura axial simple (dos mitades) vs *split cavity* (§13.9.1, fuera de este tomo)
  vs apertura oblicua. Determina qué es siquiera posible en A-061 y A-062.
- **CRITERIO** — **[JUICIO]** con default declarado: *"the axial mold opening direction ... is the
  simplest design and is usually preferred"*; las alternativas *"add significantly to the cost"*.
  No hay cota numérica. La ficha visual V4.1 lo confirma: la métrica objetiva es
  "nº de direcciones de apertura ≠ 1 ⇒ bandera de costo".
- **INVALIDA** — que la línea de partición resultante (A-061) caiga en zona visible o funcional: el
  libro declara ese retorno (a la taza con asa, o si hay que alejar la línea del labio, se cambia a
  split cavity).
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/draw-axis.ts :: pickDrawAxis` prueba los 3 ejes de la
  pieza y ordena por `enclosedVoids → volumen de undercut → % de área lateral sin draft`, o sea
  **solo el criterio (2)**. El criterio (1) NO entra en la elección, aunque
  `src/forja/mold/dfm-mesh.ts :: projectedAreaMm2` ya calcula el área proyectada. Además solo hay
  3 candidatos alineados a ejes: direcciones oblicuas (Fig 4.5) no se evalúan.

### A-061 · Ubicación de la línea de partición — prueba de visibilidad
- **CUÁNDO** — inmediatamente después de A-060.
- **ENTRADAS** — dirección de apertura (←A-060); geometría; **y un dato que no es geométrico: qué caras
  ve el usuario final** (§4.1.4 lo usa como predicado, V4.6 lo formaliza).
- **EL CÁLCULO** — trazado de la frontera donde se tocan cavidad, corazón y plástico, más un
  predicado booleano por tramo: ¿esta longitud de línea cae sobre superficie visible o funcional?
  La física del defecto que lo justifica: deflexión de la cavidad → hueco → flash; desgaste o mal
  manejo → hueco; y aun con molde nuevo, la línea de partición *"usually results in a very slight
  witness line along its length."*
- **SALIDA** — la curva 3D de la línea de partición + longitud sobre superficie visible (mm) y
  longitud oculta (mm).
- **DECIDE** — dónde va la línea. Ejemplo del libro, con par bueno/malo en una sola figura: en la
  taza, la línea cerca del labio *"would result in a witness line and possible flash that might make
  the molded cup unusable"*; la buena está *"at the bottom of the rim"*.
- **CRITERIO** — **[LIBRO, booleano]**: *"the parting line **should** be located along a bottom edge of
  the part, **or some other non-visual, non-functional edge**"*. No es un umbral numérico: es un
  predicado duro que se evalúa por visibilidad.
- **INVALIDA** — cambio de A-060; y un cambio en la declaración de superficies críticas/estéticas de
  la pieza (que vive en el cap. 2, fuera de este tomo).
- **¿TENEMOS?** — **SÍ.** Trazado: `src/forja/mold/parting.ts :: partingLoops` (lazos por transición
  de signo de `dot(normal, pull)`; envoltorio OCCT en `curso-flow.ts :: lineaParticion`).
  Visibilidad: `src/forja/mold/visibilidad.ts :: clasificarVisibilidad` +
  `src/forja/mold/lamina-particion-angulo.ts :: analizarParticionAngulo`, que produce
  `longOcultaMm / longFronteraMm / longVisibleMm` con z-buffer ortográfico por vista de uso.
  Pendiente cableado: `src/forja/mold/revisar-modelo.ts` declara la V4.3 de la lámina de usuario
  "SIN CABLEAR".

### A-062 · Planaridad de la línea y complejidad del plano de partición
- **CUÁNDO** — al proyectar el plano de partición hacia afuera desde la pieza (§4.1.3), justo
  después de fijar la línea.
- **ENTRADAS** — línea de partición (←A-061); dirección de apertura (←A-060).
- **EL CÁLCULO** — desviación de planaridad del lazo (máxima variación en la dirección de apertura)
  y, si no es plano, el conteo de features que hay que convertir en superficie. El método de
  construcción que prescribe el libro: superficies **lofted**, cada una mezclando una feature curva
  de la línea con una línea de ancho correspondiente en el plano —
  *"The result is a surface with the needed profile at the parting line"*— y luego knit con el plano.
- **SALIDA** — desviación en mm (0 = plano) + veredicto plano / escalonado / no plano.
- **DECIDE** — si se acepta el costo de una partición no plana o se vuelve a A-061/A-060 a buscar una
  línea más simple. Y **cuándo** se muestra ese costo: el libro insiste en que la consecuencia se
  declara al elegir, no después — *"this complex parting line shape will cause a more complex parting
  plane."*
- **CRITERIO** — **[JUICIO]** con dos riesgos nombrados, no cuantificados: desgaste por desalineación,
  *"if not an outright impact between the leading edge of the core and the mating cavity surface"*,
  y trabado bajo tonelaje. V4.4 confirma que el libro **no** rotula la geometría cruda como "mal
  diseño": la presenta como lo que hay que modificar.
- **INVALIDA** — cualquier cambio de A-060 o A-061.
- **¿TENEMOS?** — **PARCIAL.** Planaridad sí:
  `src/forja/mold/lamina-particion-angulo.ts :: LoopInfo.desviacionMm` (zMax−zMin) con
  `TOL_PLANA_MM = 0.05` y `planaridad.plana`. Proyección hacia afuera sí:
  `src/forja/mold/parting.ts :: splitNoPlano` (falda radial lazo→rectángulo, `FALDA_MM_DEFECTO = 30`).
  **FALTA lo específico del libro:** las superficies *lofted con draft*. Todas nuestras faldas son
  regladas/horizontales, sin el ángulo de salida que §4.1.3 exige llevar del perfil al plano.

### A-063 · Ángulo de las features de interlock del plano de partición
- **CUÁNDO** — sobre el plano de partición ya construido, antes de congelar superficies.
- **ENTRADAS** — superficie de partición (←A-062); dirección de apertura (←A-060).
- **EL CÁLCULO** — por cada parche de interlock, el ángulo respecto a la dirección de apertura
  (`theta = asin(|n · d|)`), y el área acumulada por debajo del umbral.
- **SALIDA** — % del área de partición con `theta < 5°`, y el listado de parches infractores.
- **DECIDE** — rediseñar el interlock (inclinarlo) o aceptarlo. Es un gate de cierre de la fase de
  superficies.
- **CRITERIO** — **[LIBRO]**, cota dura: *"interlocking features on the parting plane **should be
  inclined at least five degrees** relative to the mold opening direction"*. Consecuencia si no:
  desgaste/impacto y, bajo tonelaje, *"the surfaces to lock together with extreme force"*.
- **INVALIDA** — cambio de A-060 o A-062.
- **¿TENEMOS?** — **SÍ, y es de lo mejor implementado.**
  `src/forja/mold/lamina-particion-angulo.ts :: UMBRAL_INTERLOCK_DEG = 5`, `anguloParcheDeg`,
  `bajoUmbral`, y en `analizarParticionAngulo` los campos `areaBajoUmbralMm2` / `pctBajoUmbral` /
  `areaPorBandaMm2` con `CORTES_DEG = [5,10,30,60]` — exactamente el "% de área por debajo de 5°"
  que pide V4.5. (El umbral también está declarado, sin medir, en
  `src/forja/mold/mold-interlocks.ts :: MIN_ANGLE_DEG = 5`.)

### A-064 · Conteo de shut-offs contra ventanas de la pieza
- **CUÁNDO** — después del plano de partición, cerrando §4.1.
- **ENTRADAS** — geometría de la pieza (número de ventanas/aberturas); plano de partición (←A-062);
  mapa de visibilidad (←A-061).
- **EL CÁLCULO** — conteo: `n_shutoffs == n_ventanas`, más, por cada shut-off, el predicado de
  visibilidad de SU propia línea de partición.
- **SALIDA** — entero vs entero (taza: 0 y 0; bezel: 1 y 1) + veredicto por shut-off.
- **DECIDE** — cuántas superficies de cierre hay que construir y dónde puede ir cada una.
- **CRITERIO** — **[LIBRO, conteo]**: *"A shut-off will need to be defined for each window or opening
  in the molded part."* Para la UBICACIÓN dentro de la zona oculta, en cambio, el libro declara
  expresamente que **no hay criterio** — **[JUICIO]**: *"Either location (or even any location in
  between) would likely be acceptable"* porque *"the entire shelf is hidden from view."* V4.6 saca la
  lección correcta: el predicado a evaluar no es la posición, es la visibilidad.
- **INVALIDA** — cambio de geometría de la pieza (una ventana nueva) o de A-061/A-062.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/parting.ts :: splitNoPlano` genera de facto un
  shut-off por lazo interno (columna tapada) y avisa
  `'ventana … NO cerró como columna — queda sin shut-off'`. **FALTA el conteo explícito como gate**:
  no hay contrato ni veredicto que compare `n_shutoffs == n_ventanas`, y no existe un conteo de
  ventanas independiente desde el DFM con el cual contrastar. Es el mismo hueco que `cruce.md` N-07
  detectó en la práctica (el warning amarillo de SolidWorks que el experto brinca).

### A-065 · Altura del inserto por línea de enfriamiento
- **CUÁNDO** — abre §4.2, el dimensionado de insertos, con el plano de partición ya cerrado.
- **ENTRADAS** — profundidad de la cavidad; **diámetro elegido de línea de agua** (dato que en rigor
  pertenece al cap. 9 y que aquí se anticipa como catálogo).
- **EL CÁLCULO** — `H_min_arriba = H_min_abajo = 3 * D_linea_agua`, con
  *"Cooling line diameters typically range from 4.76 mm (3/16″) for smaller molds to 15.88 mm (5/8″)
  for large molds"*. Altura del inserto = profundidad de la pieza + los dos colchones.
- **SALIDA** — altura del inserto en mm (antes de redondear).
- **DECIDE** — el alto de los bloques de cavidad y de corazón, y por lo tanto el espesor mínimo de
  las placas A y B.
- **CRITERIO** — **[LIBRO]**: la altura la manda el enfriamiento, no la pieza — el inserto debe
  *"have enough height above and below the molded part to safely pass a cooling line"*, y
  *"the minimum height dimension between the molded part and the top or bottom surface of the insert
  is **typically three times the diameter of the cooling line**"* (el 3× viene del esfuerzo bajo la
  línea de agua, §12, fuera de este tomo).
- **INVALIDA** — cambiar el diámetro de la línea de agua en el diseño de enfriamiento (cap. 9).
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/moldbase.ts :: coolingLineDia` (4.76 / 6.35 / 7.94 / 9.53 /
  11.11 / 15.88 mm, mismo rango) y `sizeInserts` con `cool = 3 * dia`. Matiz: el "arriba y abajo" se
  reparte en dos cotas separadas (`insertHcavityMm = round10(depth + 3⌀)` y
  `insertHcoreMm = round10(3⌀)`), no en una sola.

### A-066 · Redondeo de la altura del inserto al incremento de placa (hacia ARRIBA)
- **CUÁNDO** — inmediatamente después de A-065.
- **ENTRADAS** — altura calculada (←A-065); sistema de unidades del mold base (←A-081).
- **EL CÁLCULO** — subir al siguiente incremento de catálogo: *"These plates are commonly available in
  **½″ increments** in English units, and in **10 mm increments** in metric"*.
- **SALIDA** — altura estándar en mm (o pulgadas) + el estado de la cara del inserto.
- **DECIDE** — la cota que se compra y se maquina.
- **CRITERIO** — **[LIBRO], y el criterio ES LA DIRECCIÓN**: *"the insert heights **should be adjusted
  up** such that the faces of the cavity and core inserts are **flush or slightly proud** with respect
  to the A and B plates"*. Un `round()` simétrico deja el inserto hundido y el molde con rebaba.
- **INVALIDA** — cambio de A-065, o cambio del sistema de unidades del proveedor.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/moldbase.ts :: sizeInserts` usa
  `round10 = (x) => Math.ceil(x/10)*10` — dirección correcta (hacia arriba) e incremento métrico
  correcto. **FALTAN** el incremento de ½″ (12.7 mm) y, sobre todo, **el criterio de cara
  "flush or slightly proud"**: no existe en el repo.

### A-067 · Altura TOTAL del core para procuración
- **CUÁNDO** — al armar la lista de materiales / cotización, en paralelo al diseño.
- **ENTRADAS** — altura de diseño del core (←A-065/A-066); altura del corazón por encima del plano de
  partición (geometría de la pieza).
- **EL CÁLCULO** — suma explícita: `H_compra = H_(trasera→parting plane) + H_(core sobre el parting
  plane)`.
- **SALIDA** — altura total en mm, distinta de la cota de diseño.
- **DECIDE** — cuánto acero se ordena y cuánto cuesta.
- **CRITERIO** — **[LIBRO], y es una trampa de nomenclatura, no un umbral**: *"the height of the core
  insert ... is **not its total height** but rather the height ... from the rear surface to the
  parting plane. For materials procurement and cost estimation, the total height **should also
  include** the height of the core above the parting plane"*. Dos cotas con el mismo nombre. Un
  pipeline que arrastre un solo número **compra acero de menos**.
- **INVALIDA** — cualquier cambio de geometría de la pieza que mueva el corazón.
- **¿TENEMOS?** — **FALTA, y la omisión está declarada en nuestro propio código.**
  `src/forja/mold/moldbase.ts` devuelve `insertHcoreMm = round10(cool + part.depthMm * 0)` con el
  comentario *"core: 3⌀ bajo la partición (el macho va aparte)"*.
  `src/forja/mold/mold-drawing-set.ts :: insertDims` da `Hk = min(plates.B - 6, dep + 26)`, UNA
  altura ajustada a la placa, no la suma de compra. Nada en el repo suma las dos cotas.

### A-068 · Largo y ancho del inserto: agua contra estructura, y cuál domina
- **CUÁNDO** — junto con A-065, cerrando §4.2.
- **ENTRADAS** — planta de la cavidad; profundidad de la cavidad; diámetro de línea de agua.
- **EL CÁLCULO** — dos reglas evaluadas **en paralelo**, y se toma el máximo:
  `cheek >= 3 * D_linea_agua` (por lado) y `cheek >= profundidad_de_la_cavidad`.
  `L_inserto = L_cavidad + 2*cheek`, ídem para el ancho.
- **SALIDA** — L y W del inserto en mm **más la etiqueta de cuál requisito ganó**.
- **DECIDE** — el tamaño del inserto y, río abajo, el tamaño del mold base y su costo.
- **CRITERIO** — **[COMPARA]**, y el libro lo demuestra con las dos piezas: para el bezel
  *"the requirement of fitting a cooling line will exceed the structural requirement"*; para la taza
  *"the insert length and width dimension are driven by the structural requirement."* Cotas:
  *"length and width allowances of **three cooling line diameters per side** are typical"* y
  *"a **safe guideline** is that the thickness of the side wall in the length and width dimension
  **should equal the depth of the mold cavity**"*.
- **INVALIDA** — cambio de la línea de agua (cap. 9) o de la profundidad de la pieza. Y **el retorno
  declarado de §4.2.3**: L y W pueden REDUCIRSE después *"supported by later engineering analysis"*
  (enfriamiento cap. 9, estructura cap. 12) — hasta entonces son provisionales.
- **¿TENEMOS?** — **SÍ, con el reporte del dominante incluido.**
  `src/forja/mold/moldbase.ts :: sizeInserts` → `cheek = Math.max(3*dia, part.depthMm)`,
  `insertLmm = Lmm + 2*cheek`, y **`driver: 'estructural' | 'refrigeración'`**. Juzgado en
  `src/forja/mold/mold-contratos.ts` contrato `layout-cheek` (§4.2.2) y reportado en
  `src/forja/mold/mold-analysis.ts` ("Cheek (pared lateral)").

### A-069 · Selección del layout de cavidades
- **CUÁNDO** — abre §4.3, con los insertos dimensionados.
- **ENTRADAS** — número de cavidades; tamaño del inserto (←A-068); requisitos de gating (adelanto del
  cap. 6).
- **EL CÁLCULO** — **cualitativo, catálogo con criterio por opción**: línea, rejilla, círculo,
  híbrido. Rejilla *"most common for applications requiring high production volumes when the number
  of cavities is a **multiple of 2, i.e., 4, 8, 16, 32**"*; círculo *"sometimes used when the molded
  parts are relatively small **or when the number of mold cavities is relatively low, for example 8
  or less**"*, con la desventaja de más área de molde.
- **SALIDA** — patrón + posiciones de cada cavidad.
- **DECIDE** — la planta del molde, y con ella el layout del feed system (A-110) y el balanceo.
- **CRITERIO** — **[JUICIO] con un malo explícito**: *"Placing all the cavities along a line ... is a
  **simple but poor design**"* porque *"requires an unbalanced feed system"*. Una cavidad sola va
  *"typically located in the center"* salvo que el gating obligue a descentrarla. Y el libro deja
  la puerta abierta a layouts libres (Fig 4.20, híbrido de 6 cavidades).
- **INVALIDA** — cambio del número de cavidades (que viene del análisis económico del cap. 3), o del
  tamaño del inserto (A-068).
- **¿TENEMOS?** — **PARCIAL.** Los cuatro patrones existen, pero **como red de alimentación, no como
  layout de cavidades**: `src/forja/mold/feed-layouts.ts :: layoutSeries / layoutBranched /
  layoutRadial / layoutHybrid` emiten posiciones de cavidad (Figs 6.13–6.16). El camino del mold base
  solo sabe rejilla cuadrada (`src/forja/mold/mold-drawing-set.ts :: cavityGrid`, `nx = round(√n)`).
  `src/forja/mold/laminas-visuales.ts :: laminaParticion` cita Figs 4.17→4.20 pero solo DIBUJA.
  **FALTA el selector §4.3.1** que elija entre línea/rejilla/círculo/híbrido con el criterio del libro.

### A-070 · Relación de aspecto de la envolvente de cavidades
- **CUÁNDO** — inmediatamente después de A-069; es su gate.
- **ENTRADAS** — posiciones y tamaños de todas las cavidades (←A-069).
- **EL CÁLCULO** — `aspect = max(W_env, L_env) / min(W_env, L_env)` sobre la envolvente rectangular
  de TODAS las cavidades.
- **SALIDA** — número adimensional (`n : 1`).
- **DECIDE** — aceptar el layout o volver a A-069 (línea → rejilla / círculo / híbrido).
- **CRITERIO** — **[LIBRO]**, cota dura: *"the **width to length ratio** of the bounding envelope
  around all cavities **should be kept less than 2 : 1**"*. Las dos consecuencias que el libro nombra
  al pasarse: molde grande subutilizado, y cargas estructurales *"for which molding machine platens
  may not be designed"*.
- **INVALIDA** — cambio de A-069 o del número de cavidades.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/moldbase.ts :: selectMoldBase` →
  `aspect = max(envW,envL)/min(envW,envL)`, warning si `> 2`, y `ok: aspect <= 2`. Contrato
  `layout-aspect` en `src/forja/mold/mold-contratos.ts`; dibujado en
  `src/forja/mold/laminas-visuales.ts :: laminaParticion`.

### A-071 · Área usable del plano de partición (holgura ≥ ½·D por vecino)
- **CUÁNDO** — al dimensionar el mold base (§4.3.2), con el layout ya elegido.
- **ENTRADAS** — layout de cavidades (←A-069); inventario de componentes del plano de partición:
  leader pins, guide bushings, return pins, SHCS, líneas de agua, expulsores, pilares.
- **EL CÁLCULO** — por CADA componente vecino: `distancia(cavidad, componente) >= 0.5 * D_componente`.
  El resultado es un área sombreada (Fig 4.21) que es lo realmente disponible para insertos.
- **SALIDA** — área usable en mm² + lista de violaciones con su distancia faltante.
- **DECIDE** — si la base crece, o si se reacomoda el layout.
- **CRITERIO** — **[LIBRO]**, cota dura y **por componente, no global**: *"A dimensional allowance
  equal to **at least one-half of each component's diameter** is provided between the mold cavity and
  the surrounding components to avoid excessive stress."* La consecuencia sistémica que el libro
  declara: *"mold bases are **often sized larger** than what would first be considered"* — o sea, la
  base crece por conflictos que todavía no existen en el modelo.
- **INVALIDA** — agregar cualquier componente al plano de partición (un expulsor más, un puerto de
  agua más) invalida el área usable.
- **¿TENEMOS?** — **PARCIAL, y es de los huecos caros.** La regla ½⌀ literal existe **solo para
  agua**: `src/forja/mold/mold-drawing-set.ts` (`const CLR = dia / 2`, §9.2.7) y contrato `agua-claro`
  en `mold-contratos.ts`. En el plano de partición solo hay una reserva **perimetral agregada**:
  `src/forja/mold/moldbase.ts` (`reserve = pin * 2`, con `pin` heurístico), y
  `src/forja/mold/mold-interlocks.ts :: clear()` esquiva tornillos con `pick.d/2 + o.dia/2 + 3`.
  **FALTA la holgura ≥½⌀ contra CADA vecino y el concepto de "área usable"**: no existe esa variable
  en el repo.

### A-072 · Dimensionado del mold base (L×W, A, B, S, E, C, stack)
- **CUÁNDO** — cierre de §4.3.2, con área usable resuelta.
- **ENTRADAS** — insertos (←A-065…A-068); layout (←A-069); área usable (←A-071); profundidad de la pieza.
- **EL CÁLCULO** — mayormente selección de catálogo más dos reglas: tamaño estándar entre
  *"200 mm up to 1000 mm"* por lado; alturas de placa A y B por las alturas de inserto; y la carrera
  del expulsor **E = profundidad de la pieza** (*"the ejector travel is **often** set to be equal to
  the **depth of the molded part**"*). Stack height = suma del apilado.
- **SALIDA** — la hoja de especificación completa: L×W, A, B, S, E, C, stack height, diámetro de
  orificio del sprue.
- **DECIDE** — **la orden de compra del mold base.** Es el gate económico del capítulo.
- **CRITERIO** — mezcla: **[LIBRO]** para el rango de catálogo y para E; **delegación** para dos
  cotas que el diseñador NO calcula — *"the height of the support plate, S, is **normally determined
  from the mold base supplier**"* y la altura del housing C *"is **assigned by**"* el proveedor a
  partir de la carrera. Y una cota que explícitamente NO bloquea: el orificio del sprue es
  *"of lesser importance"* porque el buje se reemplaza o se maquina.
- **INVALIDA** — todo lo de A-065 a A-071. Y el gate del libro: *"any mistakes in the mold base
  selection can **consume significant time and expense**"* — nada se ordena hasta que layout,
  colchones y máquina estén en verde.
- **¿TENEMOS?** — **PARCIAL.** Tamaño estándar: `src/forja/mold/moldbase.ts :: STANDARD_BASES`
  (196…996 mm) + contrato `layout-base-catalogo` (200–1000 mm). A y B: `selectMoldBase`
  (`plateAmm`/`plateBmm`). S: `src/forja/mold/platesizing.ts :: sizeSupportPlate` /
  `optimizeSupportPlate`. Stack: `src/forja/mold/mold-drawing-set.ts :: moldStackHeight`.
  **FALTAN E y C como cotas dimensionantes**: `ejectorHousing` está hardcodeado (66 mm en
  `mold-plano-set.ts`, 116 mm en `lamina-vonmises.ts`) y nada lo deriva de E.

### A-073 · Compatibilidad con la máquina 1 — ancho entre tie bars
- **CUÁNDO** — §4.3.3, con el mold base especificado y ANTES de comprarlo.
- **ENTRADAS** — L×W del mold base (←A-072); **saliente de tapones de agua y conectores de hot runner**
  (←A-108 si hay colada caliente); ficha de la máquina del moldeador.
- **EL CÁLCULO** — `ancho_total = ancho_base + salientes` contra el claro entre barras, menos holgura
  de inserción. Ejemplo del libro (Battenfeld HM320): 800 mm horizontal × 630 mm vertical.
- **SALIDA** — semáforo + margen en mm.
- **DECIDE** — si el molde cabe en ESA máquina, o si hay que cambiar base, cavitación o máquina.
- **CRITERIO** — **[LIBRO]**, con la trampa incluida: el ancho que se compara es
  *"the maximum mold width, **including cooling plugs, hot runner connectors, etc.**"*, y además
  *"**less some relatively small clearance**"* para poder insertar el molde. Es el fallo más común:
  *"Perhaps the most common limitation is that the mold will not fit between the tie bars"*.
- **INVALIDA** — cambiar de máquina, o agregar cualquier conector que sobresalga.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/mold-contratos.ts` contrato `layout-ancho-con-plugs`:
  `anchoConPlugs = bMax + 2*20` contra `tieBar = min(tieHmm, tieVmm)` — incluye el saliente. El check
  pelón (sin plugs) está en `src/forja/mold/moldbase.ts :: checkMachine` y
  `src/forja/mold/machinesizing.ts :: selectInjectionMachine`.

### A-074 · Compatibilidad con la máquina 2 — daylight (falla por los dos lados)
- **CUÁNDO** — junto con A-073.
- **ENTRADAS** — stack height del molde (←A-072); carrera de apertura necesaria (←A-131/A-133 si es de
  tres placas); daylight mínimo A y máximo B de la máquina.
- **EL CÁLCULO** — `A_min <= altura_molde` y `altura_molde + carrera <= B_max`. Ejemplo HM320:
  banda 350–800 mm.
- **SALIDA** — dos semáforos (cierra / abre) con sus márgenes en mm.
- **DECIDE** — máquina o base.
- **CRITERIO** — **[LIBRO], banda de dos colas**: *"the mold height must be greater than the indicated
  A dimension and smaller than the indicated B dimension"*. Los dos extremos fallan y por razones
  distintas: por abajo, *"the molding machine platen can not fully close the mold and build clamp
  tonnage"*; por arriba, no cabe entre platinas abiertas.
- **INVALIDA** — cambio de stack (A-072) o de la carrera de apertura (A-131/A-133). Pasar de dos a tres
  placas dispara este análisis otra vez: en el ejemplo del libro el daylight total salta de 339 a
  558 mm.
- **¿TENEMOS?** — **SÍ, con las dos colas.** `src/forja/mold/moldbase.ts :: checkMachine` falla por
  abajo (`stack < minDaylightMm` → "el clamp no cierra") y por arriba
  (`daylightNeededMm(stack, carrera) > maxDaylightMm` → "CIERRA pero no ABRE"), usando
  `src/forja/mold/threeplate.ts :: daylightNeededMm = stack + carrera`.

### A-075 · Compatibilidad con la máquina 3 — ventana de disparo
- **CUÁNDO** — junto con A-073/A-074.
- **ENTRADAS** — volumen de cavidades × nº de cavidades; volumen del feed system (←A-115); capacidad
  de disparo de la máquina.
- **EL CÁLCULO** — `V_disparo = n_cav * V_pieza + V_feed`, contra la ventana cómoda de la máquina
  (no contra su máximo).
- **SALIDA** — cc y % de la capacidad.
- **DECIDE** — máquina, o cavitación.
- **CRITERIO** — **[LIBRO], banda de dos colas otra vez**: la HM320 tiene 490 cc de máximo pero
  *"this machine is **ideally suited** for molds requiring a shot volume **between 120 cc and 250
  cc**"* — o sea ~25–50% del máximo. Con demasiado poco, *"the melt may degrade in the barrel."*
  No es "cabe / no cabe".
- **INVALIDA** — cambio del volumen del feed (A-115) o del número de cavidades.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/moldbase.ts :: checkMachine` calcula `shotPct` con ventana
  25–50% (HM320 con `maxShotCc: 490` en `MACHINES`, y el rango 120–250 cc citado en el encabezado);
  `src/forja/mold/machinesizing.ts :: shotVentana` (25–50%) con techo duro 85%; contrato
  `layout-shot-ventana` en `mold-contratos.ts`.

### A-076 · Compatibilidad con la máquina 4 — tonelaje (suficiente y no excesivo)
- **CUÁNDO** — junto con A-073…A-075, pero **depende del cap. 5**: el número entra desde A-099.
- **ENTRADAS** — tonelaje requerido (←A-099); tonelaje de la máquina (HM320: 3200 kN = 326 t métricas).
- **EL CÁLCULO** — comparación directa, en las dos direcciones.
- **SALIDA** — semáforo + margen.
- **DECIDE** — la máquina, y en última instancia la cavitación.
- **CRITERIO** — **[LIBRO], dos colas**: si falta, *"the mold will open during operation and the melt
  will flow across the parting plane and shut-offs"*; si sobra sobre un molde subdimensionado,
  *"the mold may be damaged by the imposed compressive stresses."*
- **INVALIDA** — cualquier cosa que mueva A-099: cambio de presión de cavidad, de área proyectada o del
  número de cavidades.
- **¿TENEMOS?** — **SÍ, con la alarma inversa.** `src/forja/mold/moldbase.ts :: checkMachine`:
  `clampNeedTons > clampTons` → "FLASH", **y** `clampNeedTons < clampTons / 10` → "molde muy chico
  para N t: riesgo de aplastarlo (§4.3.3)". Reforzado por el contrato `layout-maquina` ("y NO
  groseramente sobrados") en `mold-contratos.ts`.

### A-077 · Difusividad térmica del acero del molde
- **CUÁNDO** — al comparar materiales candidatos (§4.4.1), en paralelo al resto del cap. 4.
- **ENTRADAS** — k, rho, Cp del metal (Apéndice B, fuera de este tomo).
- **EL CÁLCULO** — `alpha = k / (rho * Cp)` — **Ec 4.1**.
- **SALIDA** — m²/s.
- **DECIDE** — qué metal se compara contra cuál; alimenta A-078 (costo de operación) y el diseño de
  enfriamiento del cap. 9.
- **CRITERIO** — **[LIBRO], cambio de métrica**: *"the **thermal diffusivity** ... is a **better
  measure**"* que la conductividad sola, porque la carga térmica del molde es **cíclica**. Y el
  trade-off que el libro grafica (Fig 4.25) y que no tiene salida: *"no material exists that has a
  very high fatigue limit stress and a very high thermal diffusivity"*.
- **INVALIDA** — cambiar de metal.
- **¿TENEMOS?** — **PARCIAL.** La ecuación existe pero **como constante privada y solo para P20**:
  `src/forja/mold/mold-thermal-fdm.ts :: const ALPHA = K_STEEL / (RHO_STEEL * CP_STEEL)`. En el resto
  del repo `alphaM2s` es dato tabulado (`moldbase.ts :: MOLD_METALS`, `cooling-design.ts ::
  PLASTICOS_A`). **FALTA** una función exportada `alpha(k, rho, cp)`.

### A-078 · Factores de costo de fabricación y de operación del molde
- **CUÁNDO** — §4.4.3, comparando el conjunto de metales candidatos.
- **ENTRADAS** — costo del material; dureza Brinell; tasa de maquinado; difusividad (←A-077).
- **EL CÁLCULO** — dos índices normalizados a P20:
  `f_mold_making ~ (costo_material * Brinell) / tasa_de_maquinado` — **Ec 4.2**
  `f_mold_operating ~ 1 / (difusividad * Brinell)` — **Ec 4.3**
- **SALIDA** — dos números adimensionales por metal (scatter de Fig 4.27).
- **DECIDE** — si romper la inercia del P20 y con qué. El libro pone la mira en dos direcciones:
  *"aluminum alloys **should be seriously considered** when a molding application does not require
  high strength or hardness"*, y en la contraria *"very hard materials such as D2, A6, and H13
  **should only be used when required**"* porque matan la tasa de maquinado (Fig 4.26).
- **CRITERIO** — **[COMPARA]** contra P20 como referencia. No hay umbral: es un scatter donde se
  busca el frente eficiente.
- **INVALIDA** — cambio de volumen de producción o de abrasividad de la resina (mueven qué región del
  scatter es admisible, vía A-079).
- **¿TENEMOS?** — **FALTA.** `brinell` **solo se declara y almacena** en
  `src/forja/mold/moldbase.ts :: MOLD_METALS` — cero lecturas del campo en cualquier cálculo del repo.
  `src/forja/mold/moldcost-detailed.ts :: estimateMoldCost` cuesta con las Ecs 3.5–3.12 (material +
  tiempos volumétrico/de área ÷ eficiencia × complejidad), **no** con f_making / f_operating. Es un
  campo muerto esperando estas dos ecuaciones.

### A-079 · Selección del material de insertos por la matriz de Tabla 4.1
- **CUÁNDO** — §4.4.4, cierre del capítulo.
- **ENTRADAS** — tipo de aplicación (melt no abrasivo/presión baja · ligeramente abrasivo o presión
  moderada · muy abrasivo · presiones altas · melt corrosivo) × volumen de producción
  (<10,000 ciclos / moderado / >1,000,000); más los factores de A-078 como desempate.
- **EL CÁLCULO** — **lookup de matriz** (no ecuación). Celdas del libro: no-abrasivo/baja presión →
  Al | Al o Cu | Cu, P20, SS420 · ligeramente abrasivo o presión moderada → Al/Cu/1045 | Cu, P20,
  4140, S7 | SS420, S7, D2, A6 · altamente abrasivo → P20, S7 | D2, A6, H13 | H13 · alta presión →
  1045, 4140, P20 | P20, S7 | D2, A6 · corrosivo → P20, SS420 | SS420 | SS420.
- **SALIDA** — el material de cada inserto, con la celda que lo justifica.
- **DECIDE** — qué acero se compra para cavidad y corazón, y con qué dureza se maquina.
- **CRITERIO** — **[LIBRO], matriz**, más dos guardias numéricas: el aluminio se usa con cuidado
  *"when molding at **moderate melt pressures (100 MPa or greater)**"* o con resinas
  *"**even slightly abrasive plastics (such as carbon filled)**"*; y la propiedad de dimensionado NO
  es la fluencia — *"neither of these properties [ultimate, yield] **should be utilized**. Instead,
  the **fatigue limit stress** (endurance limit)"*, porque la carga se aplica y retira millones de
  veces. Contra la inercia: *"P20 is sometimes improperly specified"*.
- **INVALIDA** — cambio de resina (abrasividad, corrosividad) o del volumen de producción.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/moldbase.ts :: MOLD_METALS` trae los 11 metales del
  Apéndice B con sus números, y `selectMetal` elige por **prioridades booleanas**
  (`prototipo` / `resinaCorrosiva` / `pulidoEspejo` / `resinaAbrasiva` / `prioridadTermica`), con
  `produccionAnual` solo como nota lateral. **FALTA la matriz Tabla 4.1 como lookup
  aplicación × volumen.** El límite de fatiga, en cambio, **SÍ** está bien plantado como propiedad de
  dimensionado: `MoldMetal.fatigueLimitMPa` (S-N a 1e6 ciclos),
  `src/forja/mold/cooling-design.ts :: ACEROS_MOLDE.sigmaEnduranceMPa` con
  `maxMeltPressureMPa = σ_endurance / SCF`, `src/forja/mold/mold-analysis.ts :: SIGMA_ENDURANCE_P20`,
  y los contratos `estr-no-apilar-sesgos` / `estr-vida-ciclos`.

### A-080 · Compatibilidad del material elegido con el catálogo de mold bases
- **CUÁNDO** — inmediatamente después de A-079, antes de emitir la orden.
- **ENTRADAS** — material del inserto (←A-079); catálogo de bases del proveedor (←A-081).
- **EL CÁLCULO** — pertenencia a conjunto: `material_base ∈ {1045, 4140, P20}` (con Al y SS420
  disponibles para baja presión y corrosivos respectivamente).
- **SALIDA** — veredicto binario.
- **DECIDE** — evita especificar una base en un material que nadie surte.
- **CRITERIO** — **[LIBRO]**, y es un aviso de que hay DOS catálogos: *"**all the recommendations
  pertain specifically to materials for the core and cavity inserts**. Standard mold bases are not
  available in all these materials; mold bases are typically available in **1045, 4140, or P20**"*.
  Default por volumen: 1045 *"often chosen"* para volúmenes bajos y presiones moderadas, 4140 y P20
  *"usually preferred"* para altos.
- **INVALIDA** — cambio de proveedor (A-081) o de material de inserto (A-079).
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/moldbase.ts :: BASE_MATERIALS = ['1045','4140','P20']`
  (§4.4.4), aplicado en `BaseSelection.baseMaterial` y verificado por el contrato
  `layout-material-base` en `mold-contratos.ts` ("el acero del inserto y el de la base son catálogos
  DISTINTOS").

### A-081 · Calificación del proveedor de mold base
- **CUÁNDO** — §4.3.4, en paralelo a A-072, antes de la orden.
- **ENTRADAS** — los 7 criterios del libro aplicados a cada proveedor candidato.
- **EL CÁLCULO** — **scorecard cualitativo**, no ecuación: rango de tamaños y materiales · portafolio
  de componentes · sistema de unidades nativo y calidad de dibujos · inventario y entrega · calidad
  de recepción · experiencia previa · precio.
- **SALIDA** — proveedor calificado sí/no, y con qué SLA.
- **DECIDE** — a quién se le compra, y qué incrementos de placa aplican en A-066 (½″ vs 10 mm).
- **CRITERIO** — **[LIBRO] verificable en varios puntos**: componentes *"in the supplier's inventory"*;
  bases custom *"within one week"*; órdenes *"before noon"* salen el *"same day"*; recepción
  *"**All mold plates should be supplied finish ground, heat treated, and ready for machining**"*;
  y los dibujos con un sistema de unidades coherente *"through the use of **round numbers,
  fractions**"*. Lo demás es **[JUICIO]**: el libro reconoce que hay talleres que ni usan base
  estándar, y que cambiar de proveedor tiene *"risk or a significant learning curve"*.
- **INVALIDA** — nada río arriba; es una entrada externa. Pero cambiarlo invalida A-066 y A-072.
- **¿TENEMOS?** — **FALTA.** No hay modelo de proveedor ni SLA en el repo; el catálogo
  `STANDARD_BASES` es genérico y sin dueño.

---

# CAPÍTULO 5 — ANÁLISIS DE LLENADO · A-082 … A-107

> **Es el capítulo más denso en análisis de todo el tomo: 26 de 78 fichas.** Y es el único donde
> Kazmer construye una **cadena numérica cerrada** que se puede seguir de punta a punta con el bezel:
> velocidad recomendada 0.82 m/s → t_fill 0.25 s → caudal 125 cc/s → presión de lay-flat 83.2 MPa →
> espesor mínimo 1.36 mm → tonelaje 99 t métricas — y luego la valida contra Moldflow (Tabla 5.1).
>
> El orden operativo, literal del capítulo: §5.5.1 condiciones de proceso → §5.5.2 presión de llenado
> (gate → lay-flat → segmentos → modelo) → espesor mínimo → §5.5.3 tonelaje → §5.5.4 patrón de
> llenado → §5.5.5 corrección. Los tres objetivos declarados en §5.2 son: llenado completo a presión
> razonable, evitar llenado disparejo o sobre-empaque, y controlar el flujo (colocar knit-lines,
> prever venteo, orientar fibra).
>
> **§5.3 es la caja de herramientas** (A-083…A-087): cuatro modelos reológicos que no se corren "en un
> orden", se ELIGEN. Kazmer los presenta de menor a mayor fidelidad y declara cuál usa dónde.

### A-082 · Temperatura de melt de análisis
- **CUÁNDO** — primer dato de §5.5.1; entra a todo el capítulo.
- **ENTRADAS** — el rango recomendado por el proveedor de la resina.
- **EL CÁLCULO** — `T_melt = (T_min + T_max) / 2`. **El análisis es la elección del punto, no la
  aritmética.** En el ejemplo del bezel el resultado es 239 °C para ABS.
- **SALIDA** — °C.
- **DECIDE** — el punto de operación contra el que se dimensiona TODO el molde.
- **CRITERIO** — **[LIBRO], y la razón no es física sino contractual**: *"It is **recommended** that
  mold designers assume a melt temperature **in the middle of the range** recommended by the material
  supplier since this provides the molder with **freedom to adjust up or down**"*. Se diseña dejándole
  margen al moldeador **en las dos direcciones**. El criterio se repite en §5.5.2 y §5.6.
- **INVALIDA** — cambio de resina, o que el moldeador declare una ventana propia más angosta.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/cooling-design.ts :: PLASTICOS_A`,
  `src/forja/mold/feed.ts :: FEED_MATERIALS` y `src/forja/mold/filling.ts :: ABS_MG47` documentan sus
  `tMelt` como "mid-range" (Apéndice A), **pero el punto medio está precalculado a mano y
  hardcodeado**: no hay campos `tMeltMinC/tMeltMaxC` ni función que promedie. Solo el refrigerante
  guarda su rango (`tCoolMinC`/`tCoolMaxC`) y ni ése se promedia en código. Consecuencia: el software
  no puede mostrar el margen que le queda al moldeador, que es TODO el punto de la regla.

### A-083 · Tasa de corte y esfuerzo cortante nominales
- **CUÁNDO** — §5.3.1, como fundamento pedagógico antes de cualquier modelo.
- **ENTRADAS** — velocidad del fundido; espesor del canal; viscosidad.
- **EL CÁLCULO** — `gammadot = v / h` (**Ec 5.2**), `tau = eta * gammadot` (**Ec 5.1**),
  `F = tau * A`. Ejemplo del libro: 100 mm/s sobre 1.5 mm = 67 1/s → 6,700 Pa → 135 N sobre una placa
  de 0.2 × 0.1 m.
- **SALIDA** — 1/s, Pa, N.
- **DECIDE** — establece la magnitud del problema; es la base de A-084 y del criterio de shear de los
  gates (cap. 7, fuera de este tomo).
- **CRITERIO** — **ninguno propio**: es la definición. Su valor es que fija de dónde salen los números
  de todo lo demás.
- **INVALIDA** — nada; es identidad.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/filling.ts :: shearRateNewtonian` usa
  `gammadot = 6*v/H` (Ec 5.24, la forma de canal), **no** el `v/h` didáctico. Y **falta por completo
  la cadena `tau = eta*gammadot` y `F = tau*A` para el fundido**: el único `shearStress` del repo
  (`src/forja/mold/structural.ts`) es esfuerzo cortante en el ACERO del molde (Ec 12.8), física
  distinta.

### A-084 · Gradiente de presión por esfuerzo de pared
- **CUÁNDO** — §5.3.2, inmediatamente después de A-083.
- **ENTRADAS** — esfuerzo cortante en la pared (←A-083); espesor del canal.
- **EL CÁLCULO** — `dP/dL = 2*tau/H` (**Ec 5.7**). Ejemplo: tau = 13,000 Pa con H = 1.5 mm →
  17.3 MPa/m → ΔP = 3.5 MPa en 200 mm.
- **SALIDA** — MPa/m, y ΔP en MPa al integrar sobre la longitud.
- **DECIDE** — da la intuición de cuánta presión cuesta cada centímetro de flujo; es el puente entre
  reología y presión de llenado.
- **CRITERIO** — **ninguno propio**; es la relación que justifica por qué el espesor pega al cubo.
- **INVALIDA** — nada; es identidad.
- **¿TENEMOS?** — **FALTA.** No existe `dP/dL = 2*tau/H` en el repo. Todo el ΔP se calcula directo por
  la Ec 5.22 integrada, nunca como gradiente. Es una pérdida sobre todo **pedagógica**: sin el
  gradiente no se puede explicar por qué la presión escala como se ve.

### A-085 · Curva de viscosidad Cross-WLF
- **CUÁNDO** — §5.3.3, para caracterizar la resina antes de elegir modelo de flujo.
- **ENTRADAS** — coeficientes del Apéndice A (fuera de este tomo); tasa de corte, temperatura, presión.
- **EL CÁLCULO** — `eta(gammadot, T, P)` — **Ecs 5.8 a 5.12**, con tres asas: `eta0`, `tau*` y `n`
  (Fig 5.4). Ejemplo PC: 350 Pa·s a 100 1/s baja a 80 Pa·s a 10,000 1/s a 280 °C; y `eta0` sube de
  250 a 660 Pa·s al bajar la temperatura de 290 a 270 °C. Ajuste típico con reómetro capilar entre
  10 y 10,000 1/s.
- **SALIDA** — Pa·s.
- **DECIDE** — de dónde salen la `k` y la `n` del power law (A-087) para la ventana de shear de ESTA
  pieza; y si la resina está caracterizada o no.
- **CRITERIO** — **[LIBRO], alarma de dato insuficiente**: el MFI es una medida de UN punto y
  *"may not be very representative"* del rango de shear, temperatura y presión del moldeo. Si el
  material solo trae MFI, el análisis está sobre arena.
- **INVALIDA** — cambio de resina o de lote caracterizado.
- **¿TENEMOS?** — **FALTA.** Cero ocurrencias de Cross-WLF, `tauStar`, `D1`, `A1`, `A2` en todo
  `src/`. El único modelo de viscosidad es power law puro (`k`, `n`) en `MeltMaterial` de
  `src/forja/mold/filling.ts`. **Es el hueco más caro del cap. 5**: sin Cross-WLF no hay dependencia
  de la viscosidad con la temperatura, y toda la palanca de A-082 (mid-range para dejar margen) queda
  sin efecto numérico.

### A-086 · Modelo newtoniano de canal rectangular
- **CUÁNDO** — §5.3.4; primera opción de cálculo de ΔP, la simple.
- **ENTRADAS** — viscosidad `mu` evaluada a la tasa de corte representativa (←A-085); geometría del
  segmento (L, W, H); caudal o velocidad media.
- **EL CÁLCULO** — perfil parabólico (**Ec 5.14**), `V = (2/3)*vmax*W*H` (**Ec 5.15**),
  `gammadot = 6*v/H = 6*V/(W*H^2)` (**Ec 5.16**),
  `DeltaP = 12*mu*L*v/H^2 = 12*mu*L*V/(W*H^3)` (**Ec 5.17**).
- **SALIDA** — Pa.
- **DECIDE** — si alcanza con el modelo simple o hay que ir a power law.
- **CRITERIO** — **[LIBRO], condición de uso**: la viscosidad se evalúa a la tasa de corte
  representativa **antes** de usarla, y §5.6 lo repite como verificación de cierre — que
  *"the **dependence of the viscosity on shear rate be verified** when using the Newtonian model"*.
  El libro además acota su validez: para el PC del ejemplo, el newtoniano es exacto solo alrededor de
  7,000 1/s.
- **INVALIDA** — que la tasa de corte real caiga fuera de la ventana donde se evaluó `mu`.
- **¿TENEMOS?** — **PARCIAL.** `gammadot = 6*V/(W*H^2)` sí:
  `src/forja/mold/gating.ts :: shearRateStrip` (Tabla 7.2), ecuación idéntica.
  `DeltaP = 12*mu*L*V/(W*H^3)` existe **solo despejada y para AIRE**:
  `src/forja/mold/venting.ts :: ventMinThickness` (Ec 8.2) — algebraicamente la misma rendija
  newtoniana, pero no hay versión para el fundido. `V = (2/3)*vmax*W*H` **FALTA** (no hay `vmax` de
  fundido en el repo).

### A-087 · Modelo power law
- **CUÁNDO** — §5.3.5; es el modelo que el libro efectivamente usa en el ejemplo del bezel.
- **ENTRADAS** — `k` y `n` ajustados a la ventana de shear de la pieza (←A-085); geometría; caudal.
- **EL CÁLCULO** — `eta = k * gammadot^(n-1)` (**Ec 5.18**), perfil de velocidad (**Ec 5.19**),
  tasa de corte en la pared (**Ec 5.21**) y `DeltaP` (**Ec 5.22**). Con `n = 1` se recupera el
  newtoniano; con `n → 0` el perfil se vuelve plug flow (Fig 5.8). Para el ABS del bezel:
  `k = 17,070`, `n = 0.348` a 239 °C.
- **SALIDA** — Pa.
- **DECIDE** — el número de presión que se compara contra el techo (A-094).
- **CRITERIO** — **[LIBRO], sobre el ajuste**: *"the power law model can **purposefully fit to a
  smaller shear rate regime of interest**"* — el modelo se ajusta a la ventana de ESTA pieza, no en
  general.
- **INVALIDA** — cambio de resina, de temperatura de análisis (A-082) o de la ventana de shear.
- **¿TENEMOS?** — **SÍ, con la ecuación literal.** `src/forja/mold/filling.ts :: viscosityPowerLaw`,
  `pressureDropSegment` (Ec 5.22: `ΔP = (2kL/H)·[2(1+1/n)v̄/H]^n`) y `shearRatePowerLaw`
  (Ec 5.21: `γ̇ = 2(2+1/n)·v̄/H`) — las tres tal cual.

### A-088 · Velocidad de llenado recomendada, con lazo de convergencia
- **CUÁNDO** — §5.5.1, el primer cálculo "vivo" del capítulo.
- **ENTRADAS** — `T_melt` (←A-082), `T_wall`, conductividad `kappa` de la resina, y **la viscosidad,
  que a su vez depende de la velocidad que se está buscando** (←A-087). Ése es el lazo.
- **EL CÁLCULO** — **Ec 5.23** (derivación en el Apéndice F, fuera de este tomo), iterada:
  `v -> gammadot -> mu -> v` hasta converger. Escalera literal del libro para el bezel:
  **0.5 → 0.69 → 0.77 → 0.80 → 0.82 m/s**.
  ⚠ **DEFECTO DEL CORPUS DERIVADO, RECONSTRUIDO NUMÉRICAMENTE.** `libro-caps4-6.md` R-042 transcribe
  la Ec 5.23 como `v = 5(Tmelt-Twall)*kappa/(3*mu)`, **sin raíz**. Con eso la primera iteración da
  0.47 m/s, no los 0.69 del propio libro. Con raíz cuadrada la escalera se reproduce EXACTA:
  partiendo de v = 0.5 m/s → `gammadot = 6*0.5/0.0015 = 2000 1/s` (el libro dice 2000) →
  `mu = 17070*2000^(-0.652) = 120 Pa·s` (el libro dice 120) →
  `v = sqrt(5*(239-60)*0.19/(3*120)) = 0.69 m/s` (el libro dice 0.69). Siguiente vuelta: 2760 1/s,
  ~97 Pa·s, 0.77 m/s — el libro dice 2760, 95.4 y 0.77. **La forma correcta es
  `v = sqrt( 5*(Tmelt-Twall)*kappa / (3*mu) )`.** `INFERIDO` a partir de los números del propio libro.
- **SALIDA** — m/s.
- **DECIDE** — la velocidad de referencia de todo el llenado: alimenta t_fill, caudal, presión y —vía
  el caudal— TODO el cap. 6.
- **CRITERIO** — **[LIBRO], de convergencia**: *"it is necessary to recompute the shear rate and
  viscosity **until the velocity converges**"*. Un valor sin su escalera no es auditable.
- **INVALIDA** — cambio de A-082, de resina, o del espesor de pared.
- **¿TENEMOS?** — **SÍ, y nuestro código tiene la forma CORRECTA con raíz.**
  `src/forja/mold/filling.ts :: recommendedVelocity` = `Math.sqrt((5*(tMelt-tWall)*kappa)/(3*mu))`, y
  `convergeVelocityTraced` corre el lazo (tol 1e-4, 24 vueltas) devolviendo `escalera[]`. El docstring
  cita la escalera del libro y `src/forja/mold/mold-contratos.ts :: contratoLlenado`
  (criterio `llenado-convergencia`) la audita contra ella. **Es el caso donde el código está mejor que
  el corpus derivado** — vale la pena anotarlo en el pliego original.

### A-089 · Tiempo de llenado y caudal
- **CUÁNDO** — inmediatamente después de A-088.
- **ENTRADAS** — velocidad convergida (←A-088); longitud de flujo (←A-102); volumen de la cavidad.
- **EL CÁLCULO** — `t_fill = longitud_de_flujo / v` y `caudal = V_cavidad / t_fill`.
  Ejemplo bezel: 0.2 m / 0.82 = 0.25 s; 30 cc / 0.25 s = 125 cc/s en boquilla.
- **SALIDA** — s y cc/s.
- **DECIDE** — **es la entrada maestra del cap. 6**: todo el dimensionado del feed system se hace a
  ese caudal.
- **CRITERIO** — **ninguno propio**, pero §5.5.1 declara la alternativa válida: estimar el caudal por
  volumen/tiempo *"works well for those practitioners with experience"* — ruta legítima pero no
  transferible. Y §6.4.5 pide confirmar con el moldeador el tiempo de llenado esperado.
- **INVALIDA** — cambio de A-088 o de la longitud de flujo.
- **¿TENEMOS?** — **PARCIAL, y las dos mitades están descableadas.** `t_fill = L/v` existe **inline y
  sin exportar** en `src/forja/brep/useMoldStudio.ts` (`const tFill = L / v`). `V̇ = V_cav/t_fill`
  existe en `src/forja/mold/feed.ts :: designSprueFeed` / `designFeedSystem`
  (`Vdot = partVolumeCc*1e-6 / tFill`), **pero con `tFill = o.fillTimeS ?? 1` s**, no con el `L/v`
  convergido de A-088. O sea: calculamos la velocidad correcta y luego el feed system la ignora.

### A-090 · Check de banda de velocidad lineal
- **CUÁNDO** — cierre de §5.5.1.
- **ENTRADAS** — velocidad convergida (←A-088).
- **EL CÁLCULO** — comparación contra banda.
- **SALIDA** — semáforo.
- **DECIDE** — si el resultado de A-088 es creíble o hay un error de datos aguas arriba.
- **CRITERIO** — **[LIBRO], banda**: *"**Typical linear velocities** of the melt through the mold range
  from **0.01 to 1 m/s**"*. (El libro da además el rango del ABS: 0.4 m/s a 3 mm/218 °C hasta
  1.6 m/s a 0.8 mm/260 °C.)
- **INVALIDA** — cambio de A-088.
- **¿TENEMOS?** — **SÍ, umbral idéntico.** `src/forja/mold/mold-contratos.ts :: contratoLlenado`,
  criterio `llenado-velocidad`: `vel.vMs >= 0.01 && vel.vMs <= 1`.

### A-091 · Construcción y segmentación del lay-flat
- **CUÁNDO** — §5.5.2, apenas elegida la ubicación del gate.
- **ENTRADAS** — geometría 3D de la pieza; ubicación de gates (←A-092).
- **EL CÁLCULO** — desplegar la pieza al plano: *"the sides of the container are 'cut' at the corners
  and the side walls folded down to make a lay flat"*. Luego partir en segmentos de flujo.
- **SALIDA** — una lista de segmentos con L, W, H cada uno.
- **DECIDE** — la geometría 1D sobre la que se calcula la presión (A-093) y el patrón de llenado (A-100).
- **CRITERIO** — **mezcla de [LIBRO] y [JUICIO], y hay que distinguirlos**: la segmentación por
  espesor es **obligatoria** — *"**Sections of varying thickness should also be broken out** into
  different flow segments"* — mientras que agrupar por ancho es criterio del diseñador:
  *"sections of similar width may be lumped together to simplify"*. Simplificación autorizada, con su
  condición: costillas y bosses *"are neglected"* porque son *"very likely to fill"* si son chicos
  frente al canal principal.
- **INVALIDA** — mover el gate (A-092) o cambiar espesores (A-105).
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/layflat.ts :: desdoblar` despliega la pieza a caras
  planas por isometría, con espesor por cara (`espesorFondoMm`, `espesorParedMm[]`), y
  `solverLayFlat` / `evalRuta` parten el camino en `tramos[]`. **Dos huecos:** la segmentación es
  **por cara geométrica, no por cambio de espesor** (un cambio dentro de una misma pared no parte el
  segmento — justo lo que el libro declara obligatorio), y **el ancho W no está en el modelo**, así
  que la agrupación opcional por ancho no existe.

### A-092 · Ubicación de gates para balancear el flujo
- **CUÁNDO** — **antes** del cálculo de presión, no después. Es el primer paso de §5.5.2.
- **ENTRADAS** — lay-flat (←A-091, relación circular deliberada: se itera); geometría.
- **EL CÁLCULO** — **cualitativo sobre longitudes de flujo**: colocar el o los gates de modo que las
  longitudes hasta los bordes más lejanos se parezcan.
- **SALIDA** — coordenadas del gate (o los gates) sobre el lay-flat.
- **DECIDE** — todo el patrón de llenado, dónde caen las soldaduras y dónde las trampas de gas.
- **CRITERIO** — **[LIBRO], cualitativo**: *"the mold designer **should select the gating location(s)
  to balance the flow** between the different portions of the mold"*, y el objetivo de §5.2.2 es que
  el fundido llegue a los bordes más lejanos *"at approximately the same time"*.
- **INVALIDA** — cambio de geometría; y el retorno de §5.5.5 (si aparece race-tracking, lo primero que
  se mueve es el gate).
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/layflat.ts :: compuertaContenedor` coloca la compuerta
  del caso del libro y `veredictoRace` la juzga, pero **no hay optimizador ni asistente que PROPONGA
  la ubicación** que balancea. Hoy el usuario la pone y el software la califica.

### A-093 · Presión de llenado de la cavidad
- **CUÁNDO** — §5.5.2, con el lay-flat segmentado.
- **ENTRADAS** — segmentos (←A-091); modelo reológico (←A-086 o A-087); velocidad/caudal (←A-088/A-089);
  temperatura de análisis (←A-082).
- **EL CÁLCULO** — sumar el ΔP de cada segmento en serie con la Ec 5.22 (o la 5.17).
  Ejemplo bezel, un cuarto de la pieza modelado como tira de 200 × 20 × 1.5 mm con ABS
  `k = 17,070`, `n = 0.348` a 239 °C → **ΔP = 83.2 MPa = 12,060 psi**.
- **SALIDA** — MPa.
- **DECIDE** — si la pieza es moldeable como está; y es la base del espesor mínimo (A-095) y del
  tonelaje (A-097).
- **CRITERIO** — el suyo propio es **[COMPARA]** contra el techo de A-094. El libro insiste en mostrar
  la Ec 5.22 con los números sustituidos, no solo el resultado.
- **INVALIDA** — cambio de resina, de temperatura, de espesor, de gate o de segmentación.
- **¿TENEMOS?** — **SÍ la función, PARCIAL el cableado.** `src/forja/mold/filling.ts ::
  fillingPressure` suma `pressureDropSegment` sobre los segmentos con el docstring "lay-flat del libro
  §5.5.2", y está registrada como comando `fill.pressure` en `src/forja/commands/registry.ts`.
  **Pero nadie la llama desde `layflat.ts`**: el lay-flat acumula resistencia en mm-equivalentes y
  nunca convierte a MPa; y `src/forja/mold/moldmachine.ts :: clampFor` / `physicalDesign` usan **un
  solo segmento**. Tenemos las dos piezas y no están soldadas.

### A-094 · Check de la banda de presión de cavidad (techo Y cola baja)
- **CUÁNDO** — inmediatamente después de A-093.
- **ENTRADAS** — presión de llenado (←A-093).
- **EL CÁLCULO** — comparación contra una banda, no contra un techo.
- **SALIDA** — semáforo de dos colas.
- **DECIDE** — arriba: rediseñar (escalera de remedios, ver abajo). Abajo: **adelgazar la pared y
  poner costillas**.
- **CRITERIO** — **[LIBRO], banda de dos colas.** Techo: *"**Typically**, the melt pressure required
  to fill the cavity is **less than 100 MPa** (about 15,000 psi) even though most modern machines can
  supply **twice** this amount"*; el margen de 2× cubre el feed system y las variaciones. Nunca se
  diseña contra la capacidad nominal — *"a **lower melt pressure should be assumed**"*. La asimetría
  que justifica el conservadurismo: *"Since it is **easier to adjust** the molding process for a mold
  with too low melt pressures than ... too high pressures"*.
  **Cola baja, y es igual de dura**: *"filling pressures are **not too low**, since very low melt
  pressures are indicative of a **poor molded part design** ... excessively thick wall sections will
  result in low pressures, excessive material costs, and extended cycle times. In such cases, the
  nominal wall thickness **should be decreased and ribs utilized**"*.
  **La escalera de remedios cuando no llena, en el orden del libro** (el último es el más caro):
  *"increasing the mold and melt temperatures, enlarging the runner diameters, trying lower viscosity
  plastics, and finally changing the wall thickness"*. Y su espejo, lo que el moldeador hará con tu
  margen si sobra: *"reduce the mold and melt temperatures while increasing the injection velocity"*.
- **INVALIDA** — cambio de A-093, o que el moldeador declare una máquina de alta presión / un hot runner
  de baja caída.
- **¿TENEMOS?** — **SÍ, con las dos colas.** `src/forja/mold/mold-contratos.ts :: contratoLlenado`,
  criterios `llenado-techo` (ΔP ≤ **100 MPa**, §5.1) y `llenado-cola-baja` (con la cita del libro
  sobre "poor molded part design"). Ojo: el piso usa `const PISO_DECLARADO = 20` MPa, **declarado
  explícitamente como umbral propio, no del libro** — correcto, porque el libro **no da número** para
  la cola baja. Duplicado en `src/forja/brep/useMoldStudio.ts` (`warn: dP > 100 || dP < 20`).

### A-095 · Espesor mínimo de pared por la curva P(h)
- **CUÁNDO** — §5.5.2, cerrando el bloque de presión.
- **ENTRADAS** — el modelo de presión (←A-093) barrido sobre el espesor; el techo de presión (←A-094);
  **y el presupuesto de ΔP del feed system (←A-111)**.
- **EL CÁLCULO** — trazar `P(h)` a temperatura media y leer el espesor en la intersección con la línea
  de presión máxima permitida. Ejemplo bezel: **1.36 mm a 100 MPa** (Fig 5.13).
- **SALIDA** — mm.
- **DECIDE** — el espesor nominal de pared de la PIEZA. Es el resultado del cap. 5 que sale del molde
  y entra al diseño del producto.
- **CRITERIO** — **[COMPARA]**: intersección de curva con línea. El umbral es el de A-094.
- **INVALIDA** — **el acoplamiento declarado más importante del tomo**: *"the minimum wall thickness is
  **also a function of the feed system design**"* (§5.5.2). Si el cap. 6 cambia el presupuesto de
  presión, el espesor mínimo se recalcula. Es un retorno cap. 6 → cap. 5 → diseño de pieza.
- **¿TENEMOS?** — **FALTA.** No hay barrido de espesor, ni curva P(h), ni lectura del mínimo en la
  intersección. (`src/forja/mold/cores.ts :: minWallThickness` es pared de ACERO contra sigma_limit,
  Ec 12.21 — no tiene nada que ver.)

### A-096 · Área proyectada de la cavidad
- **CUÁNDO** — §5.5.3, antes de cualquier cálculo de tonelaje.
- **ENTRADAS** — geometría de la pieza; dirección de apertura (←A-060).
- **EL CÁLCULO** — proyección del área sobre el plano normal a la apertura, **descontando ventanas** y
  sin contar las paredes inclinadas o verticales.
- **SALIDA** — mm². Bezel: 9,724 mm².
- **DECIDE** — el multiplicando del tonelaje (A-097, A-098).
- **CRITERIO** — **[LIBRO], y es una trampa numérica**: *"The **projected area** of the cavity is used
  rather than the total area since the melt pressure acting on inclined (or vertical) side walls
  contribute little (or no) force"*. En el mismo ejemplo del libro, la tira del lay-flat mide 20 mm de
  ancho pero su proyección son 12 mm: **el ancho del lay-flat NO es el área proyectada**.
- **INVALIDA** — cambio de A-060 o de geometría.
- **¿TENEMOS?** — **PARCIAL, y hay un bug de contabilidad.** El área proyectada real **sí se calcula**:
  `src/forja/mold/dfm-mesh.ts :: dfmFromMesh` → `projectedAreaMm2` (columnas sólidas del ráster,
  descontando ventanas), y `src/forja/mold/mold-contratos.ts` criterio `llenado-area-proyectada` la
  contrasta contra el bbox. **Pero el tonelaje no la usa**:
  `src/forja/mold/moldmachine.ts :: clampFor` y `physicalDesign` hacen
  `projAreaM2 = nCav * spec.Lmm * spec.Wmm * 1e-6` — bbox L×W — aunque
  `src/forja/mold/revisar-modelo.ts` ya rellene `spec.projectedAreaMm2`. Dato bien calculado que no
  llega al juez.

### A-097 · Tonelaje al final del llenado
- **CUÁNDO** — §5.5.3.
- **ENTRADAS** — presión de llenado (←A-093); área proyectada (←A-096).
- **EL CÁLCULO** — forma rigurosa `F_clamp = integral( P * cos(theta) dA )` (**Ec 5.26**);
  forma conservadora `F_clamp = P_cavidad * A_proyectada` (**Ec 5.29**). Al final del llenado el
  perfil de presión es **lineal de 100 a 0 MPa**, o sea media 50 MPa: en la tira del ejemplo,
  120 kN = 12.2 t métricas.
- **SALIDA** — kN y toneladas métricas.
- **DECIDE** — junto con A-098, el tonelaje de la máquina (A-076).
- **CRITERIO** — **ninguno propio**; su criterio es la comparación de A-099.
- **INVALIDA** — cambio de A-093 o A-096.
- **¿TENEMOS?** — **PARCIAL.** `F = P*A_proj` sí: `src/forja/mold/filling.ts :: clampForceN` (Ec 5.29)
  y `clampMetricTons` (÷9806.65). El perfil lineal también está capturado:
  `src/forja/mold/moldmachine.ts :: CAVITY_PRESSURE_FACTOR = 0.5`, con el comentario de que es la
  media del perfil triangular gate→frente. **La forma integral con cos(theta) (Ec 5.26) FALTA.**

### A-098 · Tonelaje al inicio del empaque, con piso de 50 MPa
- **CUÁNDO** — §5.5.3, en paralelo a A-097.
- **ENTRADAS** — presión de empaque (del moldeador, o el piso); área proyectada (←A-096).
- **EL CÁLCULO** — presión **uniforme** sobre toda la cavidad (no triangular): en el ejemplo, ~75 MPa
  sobre la tira → 180 kN = 18.3 t métricas; y sobre el bezel completo,
  100 MPa × 9,724 mm² = 972,000 N = **99 t métricas**.
- **SALIDA** — kN y toneladas métricas.
- **DECIDE** — normalmente ES el tonelaje gobernante.
- **CRITERIO** — **[LIBRO], rango y piso duro**: *"**Typically, the packing pressure is between 50 to
  90%** of the filling pressure"*, pero por debajo manda un piso: *"molders will **generally use
  packing pressures in the vicinity of 50 MPa**. As such, the mold designer **should verify** the
  expected cavity pressures **with the molder** or **assume a minimum cavity pressure of 50 MPa**"*.
  Aunque el análisis dé menos, el moldeador empacará ahí.
- **INVALIDA** — que el moldeador entregue su presión real de empaque.
- **¿TENEMOS?** — **PARCIAL, y el piso no muerde.** `src/forja/mold/mold-contratos.ts ::
  contratoLlenado`, criterio `llenado-tonelaje`, hace `estado: cav < 50 ? 'ADVIERTE' : 'CUMPLE'` con la
  cita literal del libro. **Es solo una advertencia de reporte: no hay `Math.max(cav, 50)` antes de
  calcular el tonelaje**, así que el piso no se aplica al número. Y **falta la rama de empaque como
  cálculo separado**.

### A-099 · Selección del tonelaje gobernante
- **CUÁNDO** — cierre de §5.5.3.
- **ENTRADAS** — tonelaje de llenado (←A-097) y de empaque (←A-098).
- **EL CÁLCULO** — `F_diseño = max(F_llenado, F_empaque)`.
- **SALIDA** — toneladas métricas.
- **DECIDE** — **la máquina** (entra directo a A-076).
- **CRITERIO** — **[COMPARA]**, y el libro declara que no se puede saber de antemano cuál gana:
  *"**It can be difficult to discern** ... whether the maximum clamp tonnage will be driven by the
  pressures during filling or packing"*. Por eso se calculan los dos. **La trampa**: presión de
  llenado baja NO implica tonelaje bajo — el pico suele llegar al INICIO del empaque, cuando la
  cavidad entera se presuriza (12.2 → 18.3 t en el ejemplo).
- **INVALIDA** — cambio de A-097 o A-098.
- **¿TENEMOS?** — **FALTA como cálculo.** El criterio existe **solo como texto** en
  `src/forja/mold/mold-contratos.ts :: contratoLlenado` (`llenado-tonelaje`: "se calcula en llenado Y
  en empaque (gana el mayor)"), pero **ningún código hace el `max`**: solo se calcula la rama de
  llenado.

### A-100 · Predicción del patrón de llenado (arcos y phantom gates)
- **CUÁNDO** — §5.5.4, con el lay-flat y el gate ya fijos.
- **ENTRADAS** — lay-flat (←A-091); gate (←A-092); velocidad lineal (←A-088).
- **EL CÁLCULO** — método gráfico completo, literal: desde el gate *"an arc may be drawn from the gate
  representing the position of the melt at a given point in time"*, con
  *"the distance between arc is equal to the linear melt velocity times the time step"*; al doblar una
  esquina se crea un **phantom gate** — *"creating a 'phantom' gate and maintaining the same flow
  lengths from this 'phantom' gate as from the real gate"* — y
  *"Intersecting arcs corresponding to the same time step are then trimmed"*, agregando phantom gates
  hasta cubrir todo el lay-flat. Con flow leaders, los radios del tramo delgado avanzan al 75%
  (`v_side = v_center * 210/280`, **Ec 5.35**).
- **SALIDA** — mapa de isócronas sobre el lay-flat.
- **DECIDE** — es la materia prima de A-101, A-103 y A-104.
- **CRITERIO** — **ninguno propio**; es la construcción de la vista que las demás juzgan (V5.2 lo dice
  igual).
- **INVALIDA** — cambio de gate, de espesores o de geometría.
- **¿TENEMOS?** — **SÍ, y bien.** `src/forja/mold/layflat.ts :: campoLayFlat` (campo escalar de
  resistencia mínima) + `arcos` (marching squares = las isócronas) + `phantomGates` /
  `rutasDesdoblado` / `isoGiro` (el phantom gate es la imagen de la compuerta girada alrededor del
  vértice de la esquina). **El "recorte de arcos que se intersectan" está implementado
  implícitamente**: `solverLayFlat.en()` toma el MÍNIMO sobre todas las rutas de desdoblado, que es
  exactamente el trimming del libro. Vista 3D complementaria en
  `src/forja/mold/laminas-visuales.ts :: laminaFrente`.

### A-101 · Detección de race-tracking
- **CUÁNDO** — §5.5.4, sobre el patrón de llenado.
- **ENTRADAS** — longitudes de flujo por perímetro y por centro (←A-102); geometría (profundidad y
  ancho).
- **EL CÁLCULO** — dos reglas que deben coincidir: `L_perimetro < L_centerline`, y la cota geométrica
  `profundidad > ancho/2`. En el contenedor del libro: profundidad 60 mm contra la mitad del ancho
  (100/2 = 50 mm).
- **SALIDA** — booleano + las dos longitudes.
- **DECIDE** — dispara el remedio ordenado de §5.5.5.
- **CRITERIO** — **[COMPARA] con respaldo [LIBRO]**: *"race-tracking ... can occur when the **length of
  flow around the perimeter is less than the length of flow across the center-line**"*. La trampa es
  que una caja de paredes parejas, sin nada raro, **lo hace sola** si es lo bastante profunda.
- **INVALIDA** — cambio de geometría o de gate.
- **¿TENEMOS?** — **SÍ, con las dos reglas cruzadas.** `src/forja/mold/layflat.ts :: veredictoRace`
  implementa `race = per.LeqMm < cen.LeqMm` **y** `cotaGeom = s.lf.H > ancho/2`, y además reporta
  `coherente: race === cotaGeom` — o sea, avisa cuando las dos reglas discrepan. Umbrales idénticos.
  El fenómeno también emerge del motor 3D vía `resistance` en
  `src/forja/mold/flowlen.ts :: measureFlowLength`.

### A-102 · Longitudes de flujo comparadas
- **CUÁNDO** — §5.5.5, sobre el lay-flat.
- **ENTRADAS** — lay-flat (←A-091); gate (←A-092).
- **EL CÁLCULO** — medir sobre el desplegado la longitud por la línea central y la longitud por el
  perímetro. Contenedor del libro: **L_centerline = 280 mm**, **L_side walls = 210 mm** (Fig 5.18).
- **SALIDA** — mm por ruta.
- **DECIDE** — alimenta A-101 (detección) y A-105 (el espesor del flow leader), y A-089 (t_fill).
- **CRITERIO** — **ninguno propio**; es medición.
- **INVALIDA** — cambio de geometría o de gate.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/layflat.ts :: LIBRO_CONTENEDOR`
  (`LcenterlineMm: 280`, `LsideWallsMm: 210`), `cotasContenedor` (define las dos rutas con
  `via: 'fondo'` vs `via: 'perimetro'`) y `medirCotas`, que **mide sobre el desdoblado y reporta
  `errVsLibroPct`** — no cita los 280/210, los reproduce. Verificado a 0.000% de error por
  `scripts/mold-layflat-test.cjs`.

### A-103 · Localización de líneas de soldadura
- **CUÁNDO** — §5.2.3 / §5.5.4, sobre el patrón de llenado.
- **ENTRADAS** — patrón de llenado (←A-100); mapa de superficies estética o estructuralmente críticas.
- **EL CÁLCULO** — dónde se encuentran dos frentes (entre gates distintos, o al reencontrarse
  alrededor de un núcleo).
- **SALIDA** — curvas sobre la pieza.
- **DECIDE** — si hay que mover el gate para reubicar la soldadura.
- **CRITERIO** — **[JUICIO] explícito**: las knit-lines van en zonas
  *"less important with respect to aesthetics"* o de integridad estructural — **el diseñador decide
  qué es menos importante**. El libro no da cota.
- **INVALIDA** — cambio de gate o de geometría.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/flowlen.ts :: computeWeldMask` (frontera entre compuertas +
  reencuentro alrededor de núcleos); `src/forja/mold/layflat.ts :: campoLayFlat` campo `soldadura`
  (cresta del gradiente, con umbral 0.72 declarado como extensión propia, no del libro);
  `src/forja/mold/venting-locations.ts :: enumerarVenteos` tipo `'soldadura'`.

### A-104 · Trampas de gas y última zona en llenar
- **CUÁNDO** — §5.2.3 y §5.5.4, sobre el patrón de llenado.
- **ENTRADAS** — patrón de llenado (←A-100).
- **EL CÁLCULO** — dónde se cierra el frente sobre sí mismo, **distinguiendo si el cierre cae en un
  borde (venteable) o en el interior de una superficie (trampa)**; y cuál es el último punto en
  llenarse.
- **SALIDA** — coordenadas de cada cierre, clasificadas, + el punto last-to-fill.
- **DECIDE** — **dónde van los venteos y/o los pines expulsores.** Es el resultado del cap. 5 que se
  propaga al cap. 8 (venteo) y al cap. 11 (expulsión).
- **CRITERIO** — **[LIBRO], severidad por ubicación**: *"predict the **last area to fill** so that
  **vents and/or ejector pins** are provided for the displaced gas to exit"*; y la trampa en pared
  lateral es de otra categoría — *"a **gas trap on a side wall** ... is **especially problematic since
  it is difficult to vent**. As such, the trapped air will likely **combust**, causing a **burn
  mark**"*. Quemadura casi segura, no defecto cosmético.
- **INVALIDA** — cambio de gate, de espesores (A-105) o de geometría.
- **¿TENEMOS?** — **PARCIAL, y el hueco es justo la severidad.** Trampas y clasificación
  interior/venteable: `src/forja/mold/venting-locations.ts :: clasificarCierres` (flag `interior`) y
  `src/forja/mold/layflat.ts :: campoLayFlat.cierre` + `distBordeLibre`. Last-to-fill:
  `enumerarVenteos` tipo `'fin-de-flujo'` y `campoLayFlat.maxUV/maxCara/maxLeqMm`.
  **Lo que falta es distinguir las trampas de PARED LATERAL en la ruta 3D**: `clasificarCierres`
  decide en PLANTA, y una pared vertical se proyecta sobre una sola columna del borde, así que una
  trampa a media pared sale clasificada como venteable (limitación declarada en el docstring de
  `frenteEnPlanta`). Solo la ruta `layflat.ts` lo resuelve bien, vía `distBordeLibre`.

### A-105 · Dimensionado del flow leader
- **CUÁNDO** — §5.5.5, **y solo como último recurso**.
- **ENTRADAS** — longitudes de flujo (←A-102); espesor nominal; viscosidades de cada zona.
- **EL CÁLCULO** — de igualar `ΔP_centerline = ΔP_paredes` (**Ecs 5.30–5.31**) sale
  `H_side = H * (L_side/L_center) * sqrt(mu_side/mu_center)` (**Ec 5.33**).
  Ejemplo: `2 mm * 210/280 = 1.5 mm` con la misma viscosidad.
  ⚠ El corpus declara una corrección de OCR aquí: la razón de **longitudes va SIN raíz** y solo la de
  viscosidades va bajo raíz; con la raíz sobre todo saldría 1.73 mm y no cuadra con el 1.5 del libro.
  Consistente con el texto: *"largely proportional to the ratio of the flow lengths with a lesser
  dependence on the melt viscosities"*.
- **SALIDA** — mm de espesor por zona.
- **DECIDE** — el espesor de la pared lateral de la pieza.
- **CRITERIO** — **[LIBRO], pero con orden de prelación y minimización**. El remedio anti-gas-trap va
  en este orden: (1) mover el gate al centro de la pared larga; (2) gate central vía tres placas o
  hot runner; (3) **solo si el layout lo impide**, flow leaders. Y con freno:
  *"thickness variations in molded parts are **generally undesirable** ... the cavity thickness
  variation **should be kept to a minimal amount**"*.
- **INVALIDA** — cambio de gate o de geometría; y cualquier cosa que mueva A-102.
- **¿TENEMOS?** — **SÍ, con la ecuación idéntica.** `src/forja/mold/flowleaders.ts ::
  flowLeaderThickness` = `hNominalMm * (lRegionMm/lRefMm) * Math.sqrt(muRatio)` — Ec 5.33 exacta,
  con la raíz solo sobre las viscosidades. Más `flowLeaderVelocityRatio` (Ec 5.32) y
  `designFlowLeaders` (resuelve todas las regiones y avisa si la variación de espesor supera 25%).
  Envuelto en `src/forja/mold/layflat.ts :: remedioFlowLeader`, que además ofrece la variante
  Ec 5.22 (`H ∝ L^(1/(1+n))`) marcada como EXTENSIÓN propia.

### A-106 · Re-verificación del remedio (lo que costó el flow leader)
- **CUÁNDO** — después de aplicar A-105. **Es un análisis, no un trámite**: el libro lo cuantifica.
- **ENTRADAS** — geometría remediada (←A-105); el mismo modelo de presión (←A-093).
- **EL CÁLCULO** — recorrer A-093 y A-100 con los espesores nuevos y comparar contra los viejos.
  Números del libro para el contenedor: bajar la pared de 2 a 1.5 mm
  *"did increase the injection pressure 10%… but also decreased the part weight by a similar amount."*
- **SALIDA** — Δ% de presión y Δ% de peso.
- **DECIDE** — aceptar el remedio o buscar otro. **El fix nunca es gratis, y el libro obliga a ponerle
  precio.**
- **CRITERIO** — **[COMPARA]** contra el techo de A-094: si el +10% te saca de los 100 MPa, el remedio
  no sirve.
- **INVALIDA** — cambio de A-105.
- **¿TENEMOS?** — **CASI FALTA.** `src/forja/mold/layflat.ts :: LIBRO_CONTENEDOR.presionExtraPct = 10`
  es una **constante literal muerta: está declarada y no se usa en ningún cálculo**.
  `contenedorKazmer({lateralMm: 1.5})` permite reconstruir la geometría remediada y volver a correr el
  solver, pero **nada recalcula ΔP antes/después ni compara el +10%**, y **el peso de la pieza no se
  calcula en ningún lado** (el −10% de peso: cero código).

### A-107 · Contraste análisis-a-mano contra simulación (Tabla 5.1)
- **CUÁNDO** — al cerrar el cap. 5, cuando existe una simulación. **No es un extra: es la calibración
  declarada del método.**
- **ENTRADAS** — todos los resultados a mano (A-088, A-093, A-097, A-098) y los de la simulación.
- **EL CÁLCULO** — tabla de contraste, magnitud por magnitud. Los números del libro para el bezel:

  | Magnitud | Análisis a mano | Simulación (Moldflow) |
  |---|---|---|
  | Presión de llenado | 100 MPa | 110 MPa |
  | ΔT bulk del fundido | 0 °C (isotérmico) | +3.4 °C |
  | Tasa de corte promedio | 1,760 1/s | 1,290 1/s |
  | Tonelaje al llenado | 486 kN | 519 kN |
  | Tonelaje al empaque | 972 kN | 397 kN |

- **SALIDA** — % de discrepancia por magnitud, **más la explicación de cada una**.
- **DECIDE** — cuánta confianza se le da a cada método, y en qué dirección corregir. En presión y
  tonelaje de llenado el acuerdo es del orden del 7% — el análisis a mano sirve. En tonelaje de
  empaque la discrepancia es de 2.4× **y el que está mal es el número de la simulación**: los 397 kN
  a 1.2 s no son el pico real, que ocurre al arranque del empaque o si el control se pasa del punto
  de conmutación V/P. **Comparar contra ese número es la trampa.**
- **CRITERIO** — **[COMPARA] con sesgo conocido y declarado**: *"**all the models always over predicted**
  the filling pressures ... the analyses are **conservative** ... Unfortunately, the analysis will
  drive part designs that are **somewhat thicker** than may actually be possible"*. El libro lista seis
  causas de la discrepancia (calentamiento por corte en los runners, el transductor, deslizamiento en
  la pared, el lote de material, la caracterización, y otras). Y el juicio que enmarca todo esto:
  no analizar *"may work for a mold designer who routinely designs similar molds for the same
  material, [but] quickly becomes inadequate for new designs or materials"*, mientras que el molde
  prototipo da *"the most accurate results, but also requires significant investment"*.
- **INVALIDA** — cambio de cualquier entrada de los análisis contrastados.
- **¿TENEMOS?** — **FALTA por completo.** Grep de 1760, 1290, 486, 519, 972, 397, "110 MPa", "3.4 °C",
  "Tabla 5.1" sobre todo `src/`: ninguna coincidencia. No existe tabla de contraste análisis-vs-
  simulación. Lo más cercano es de otra naturaleza: el cruce lay-flat vs vóxel en `layflat.ts`
  (solo longitudes) y FEA vs analítico en `src/forja/mold/lamina-vonmises.ts` (cap. 12).

---

# CAPÍTULO 6 — SISTEMA DE ALIMENTACIÓN · A-108 … A-137

> **El cap. 6 es el único con una máquina de estados explícita.** §6.1 declara el proceso en 3 pasos
> —tipo de feed system, ruteo, y diámetros de cada segmento *"to balance pressure drops, shear rates,
> and material utilization"*— y §6.4 lo desarrolla en **8 sub-pasos numerados** que son literalmente
> el orden de ejecución: §6.4.1 tipo → §6.4.2 layout → §6.4.3 caídas de presión → §6.4.4 volumen →
> §6.4.5 optimizar diámetros → §6.4.6 balancear caudales → §6.4.7 enfriamiento del runner →
> §6.4.8 residencia.
>
> **El contrato del feed system son tres metas simultáneas** (§6.4), y es un sistema acoplado, no una
> lista: ΔP *"typically **no greater than 50% of the pressure required to fill the cavities or 50
> MPa**"*; volumen *"**no greater than 30% of the volume of the cavities for cold runner** molds
> **or 100% ... for hot runner** molds"*; y *"**not extend the mold cooling time**."* Subir diámetros
> baja ΔP y sube volumen; bajarlos hace lo contrario. **Ése es el lazo central del capítulo** (Fig 6.3).
>
> Y el cap. 6 **depende del cap. 5**: el caudal con el que se dimensiona todo sale de A-089.

### A-108 · Selección del tipo de feed system
- **CUÁNDO** — §6.4.1, primer paso; y muchas veces ya viene decidido desde la cotización.
- **ENTRADAS** — volumen de producción; número de cavidades; requisitos de gating; **capacidad del
  moldeador**; economía (cap. 3).
- **EL CÁLCULO** — **matriz cualitativa de 5 arquitecturas × 4 medidas** (Tabla 6.2):

  | Tipo | Inversión | Capacidad del moldeador | Ef. material | Ef. ciclo |
  |---|---|---|---|---|
  | 2 placas frío | Lowest | Lowest | Low | Lowest |
  | 3 placas frío | Low | Low | Low | Low |
  | Insulated runner | Moderate | Moderate | Moderate | Moderate |
  | Hot runner | High | Moderate | High | High |
  | Stack mold | Highest | High | High | Highest |

  Regla de bolsillo del hot runner: elimina plastificar el fundido del feed, inyectarlo, esperar a que
  enfríe, abrir mucho el molde y desgatear → *"**20% faster cycle times and 20% less material
  scrap**"*.
- **SALIDA** — el tipo, con su justificación.
- **DECIDE** — la arquitectura completa del molde: placas, apertura, expulsión del feed, daylight.
- **CRITERIO** — **[JUICIO] con un gate humano obligatorio.** El libro dice que el tipo
  *"often specified as part of the mold quote ... since it is **either obvious or has been specified
  by the customer**"*; y cuando no, manda preguntar: *"the mold designer **should verify the
  capabilities of the molder**"*, porque *"**all molders are expected to operate two-plate molds**"*
  pero algunos *"**may not be familiar**"* con tres placas, insulated o hot runner, y los stack molds
  pueden parecer *"**daunting**"* y exigir *"**auxiliary controllers that are not available**"*.
  **Esto puede vetar el diseño técnicamente superior.** Disparador geométrico adicional (§6.4.2):
  *"**Hot runner and three-plate molds should be considered when cavities in a two-plate mold obstruct
  the desired layout** of the feed system"*.
- **INVALIDA** — cambio del número de cavidades, del layout (A-110) o de la capacidad declarada del
  moldeador.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/moldmachine.ts :: type Arch` + `moldMachine` conoce solo
  3 tipos (`cold-2placas | cold-3placas | hot-runner`) y **elige por costo total / break-even (cap. 3),
  no por los criterios de la Tabla 6.2**. Faltan *insulated* y *stack* (el stack solo existe como
  llave de costo `hot-stack-thermal` / `hot-stack-valve` en
  `src/forja/mold/moldcost-detailed.ts :: CUSTOM_FACTORS.feed`). "Capacidad del moldeador" aparece
  solo como texto de opción en `src/forja/mold/expediente.ts` (id `vetos`) y en `mold-contratos.ts`.
  No hay eje de inversión ni de eficiencia.

### A-109 · Comparación económica y de plazo de la arquitectura
- **CUÁNDO** — junto con A-108, cuando el tipo NO viene especificado.
- **ENTRADAS** — costo y plazo de cada arquitectura candidata; estructura de la cadena de suministro.
- **EL CÁLCULO** — **comparación de costo Y tiempo**, con el ejemplo del libro: 12 moldes simples de
  4 cavidades operados en Europa, Asia y América (≈US$20,000 y unas semanas) contra 1 stack mold de
  64 cavidades (≈US$1,000,000 y varios meses).
- **SALIDA** — costo de herramental y plazo de desarrollo por opción.
- **DECIDE** — cuántos moldes y de qué tipo, no solo cuál es más eficiente por ciclo.
- **CRITERIO** — **[JUICIO] con la economía por encima de la geometría**: *"**Economic analysis is
  vital** to determine the correct number of cavities, the layout, and the type of feed system"*.
  Y la razón por la que a veces gana la opción "peor": los 12 moldes
  *"may reduce the initial mold development time, provide **redundancy to mold failure**, and allow
  for **reduced tact time** in the supply chain"*. El plazo pesa tanto como el dinero —
  *"the added time may be as significant an issue as the added cost."*
- **INVALIDA** — cambio de volumen de producción o de la estrategia de suministro del cliente.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/moldmachine.ts` compara arquitecturas por costo/
  break-even y `src/forja/mold/moldcost-detailed.ts :: estimateMoldCost` cuesta el herramental, pero
  **no hay eje de PLAZO** (semanas/meses) ni escenarios multi-molde con redundancia.

### A-110 · Selección del layout del feed system
- **CUÁNDO** — §6.4.2, con el tipo elegido y el layout de cavidades de A-069.
- **ENTRADAS** — layout de cavidades (←A-069); tipo de feed (←A-108); número de cavidades.
- **EL CÁLCULO** — catálogo de 5 topologías con su trade-off declarado: **serie**, **ramificado**,
  **radial**, **híbrido**, **custom**. El ranking del libro (V6.2 lo ordena):
  serie = MALO, porque la caída a lo largo del primario causa
  *"to be delivered to cavities further from the sprue"* caudales menores;
  ramificado = naturalmente balanceado pero *"consumes significantly more material"* e impone
  *"high pressure drop"*, más desbalance TÉRMICO por las vueltas del fundido (de ahí el Melt Flipper™);
  radial = *"naturally balanced with only a moderate amount of runner volume"*;
  híbrido = **el mejor**, *"utilizes less material while also providing naturally balanced flow"*;
  custom = sin ranking, *"no reason to adhere to either branched or radial"* en ciertos casos.
- **SALIDA** — la topología del árbol de colada, con las longitudes de cada segmento.
- **DECIDE** — la geometría sobre la que corren A-114 a A-117, y si el balanceo será natural o artificial.
- **CRITERIO** — **[LIBRO], preferencia declarada**: *"**Naturally balanced feed systems provide greater
  cavity to cavity consistency** ... than artificially balanced designs"*, y la serie
  *"**is not frequently used in precision applications**"*.
- **INVALIDA** — cambio de A-069 o de A-108.
- **¿TENEMOS?** — **SÍ para las topologías.** `src/forja/mold/feed-layouts.ts :: layoutSeries`
  (Fig 6.13), `layoutBranched` (6.14), `layoutRadial` (6.15), `layoutHybrid` (6.16) y `layoutForGrid`
  (el "custom", pero atado a rejilla de cavidades, no a un grafo arbitrario). **PARCIAL en la
  distinción natural vs artificial**: `layoutSeries` adelgaza secundarios cercanos (= artificial) y
  `applyResistanceNetwork` juzga el desbalance real, pero **no hay clasificador que detecte
  "geometría espejo ⇒ naturalmente balanceado"** — esa distinción vive en comentarios, no en código
  que decida.

### A-111 · Presupuesto de caída de presión del feed system
- **CUÁNDO** — §6.2.2, antes de dimensionar nada. Es el techo contra el que se resuelve todo el
  capítulo.
- **ENTRADAS** — presión máxima de inyección de LA máquina del moldeador (dato externo); presión de
  cavidad (←A-093).
- **EL CÁLCULO** — `ΔP_disponible = P_max_maquina − P_cavidad`. Si el dato no existe, default declarado.
- **SALIDA** — MPa.
- **DECIDE** — el radio de cada segmento (A-117), y por rebote el **espesor mínimo de pared** (A-095).
- **CRITERIO** — **[LIBRO], con dato que se pide por teléfono y default explícito**:
  *"the mold designer **should contact the molder** to obtain the molding machine's maximum injection
  pressure"*; y *"If this information is **not known**, then the mold designer **can assume a maximum
  pressure drop through the feed system of 50 MPa (7,200 psi)**. While this is **slightly higher than
  some industry practices**, this specification will result in a **steel-safe** design"*. Nótese la
  dirección del conservadurismo: es steel-safe, no presión-safe.
  El techo compuesto del §6.4: `ΔP_feed <= min(50% de ΔP_cavidad, 50 MPa)`.
- **INVALIDA** — que llegue el dato real de la máquina; o que cambie A-093.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/mold-contratos.ts :: contratoAlimentacion`, criterio
  `feed-dp` con `limDP = Math.min(0.5*fillMPa, 50)` — el mínimo compuesto exacto. Mismos umbrales
  duplicados en `src/forja/mold/feed.ts :: designFeedSystem` (`limDPMPa`).

### A-112 · Presupuesto de volumen del feed system
- **CUÁNDO** — §6.2.3, junto con A-111. Es la otra mitad del lazo.
- **ENTRADAS** — volumen de las cavidades; % de regrind permitido por el cliente; tipo de feed (←A-108).
- **EL CÁLCULO** — `V_feed_max = %_regrind * V_cavidades` para cold runner; para hot runner el criterio
  cambia de naturaleza y pasa a ser el turnover por ciclo. Ejemplo del libro: 2 cavidades de 50 cc con
  30% ⇒ feed ≤ 15 cc.
- **SALIDA** — cc.
- **DECIDE** — el piso de los diámetros (junto con A-111, que pone el techo).
- **CRITERIO** — **[LIBRO]**: *"A **typical limit on regrind may be 30%**, which translates directly to
  a specification on the **maximum volume of the feed system**"*; y para caliente,
  *"Hot runners are **being increasingly designed with smaller diameters, such that the material turns
  over every molded cycle**"*. **Y la asimetría que casi nadie modela**:
  *"**unlike a steel-safe designed cold runner system, high costs may be incurred to reduce the
  diameters of a hot runner system**"* — el sesgo steel-safe no se paga igual en frío que en caliente.
- **INVALIDA** — cambio del % permitido por el cliente, o del tipo de feed.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/feed.ts :: designFeedSystem` con
  `limPct = hotRunner ? 100 : 30`, y `mold-contratos.ts` criterio `feed-volumen`.

### A-113 · Verificación de régimen laminar
- **CUÁNDO** — §6.4.3, antes de aplicar Hagen-Poiseuille. Formalidad, pero declarada.
- **ENTRADAS** — densidad del fundido, caudal (←A-089), viscosidad, diámetro.
- **EL CÁLCULO** — `Re = 4*rho*Vdot / (pi*mu*D)` — **Ec 6.2**. Con valores típicos de moldeo,
  Re ≈ 0.1: *"far from turbulent"*.
- **SALIDA** — adimensional.
- **DECIDE** — habilita el uso de Hagen-Poiseuille en A-114.
- **CRITERIO** — **[LIBRO]**: *"To verify laminar flow, the Reynolds number **should be less than
  2300**"*.
- **INVALIDA** — nada realista en moldeo; el valor es tres órdenes de magnitud menor al umbral.
- **¿TENEMOS?** — **SÍ, con un matiz.** `src/forja/mold/feed.ts :: reynolds` = `(4·ρ·V̇)/(π·μ·D)`,
  misma ecuación; umbral 2300 en `designSprueFeed` y en
  `src/forja/mold/mold-contratos.ts :: contratoAlimentacion` (`feed-reynolds`).
  **Matiz:** los dos llamadores internos pasan **μ = 100 Pa·s hardcodeado** (`feed.ts`), no la μ(γ̇)
  del punto de operación. Como Re ≈ 0.1, no cambia el veredicto — pero es un número decorativo.

### A-114 · Caída de presión por segmento del feed
- **CUÁNDO** — §6.4.3, el corazón del capítulo.
- **ENTRADAS** — geometría del segmento (L, R); caudal (←A-089); reología (←A-085/A-087).
- **EL CÁLCULO** — Hagen-Poiseuille `DeltaP = 8*mu*L*Vdot / (pi*R^4)` (**Ec 6.3**), con la viscosidad
  evaluada a `gammadot = 4*Vdot/(pi*R^3)` (**Ec 6.4**); o directamente la forma power law (**Ec 6.5**).
  Ejemplo hot runner del bezel: sprue 5.9 + manifold 8.8 + boquilla 16.7 = **31.4 MPa** totales
  (≈4,500 psi), razonable frente a los ~150 MPa típicos de máquina.
  **Simplificación autorizada, caso por caso:** el bore cónico de la boquilla se modela como sección
  constante de radio medio (3.5 mm × 108 mm en el ejemplo) — *"a reasonable estimate may be obtained by
  modeling the tapered bore as a constant section"*, aunque *"the most accurate estimate may be
  provided by **analyzing each segment of the tapered bore**"*.
- **SALIDA** — MPa por segmento y total.
- **DECIDE** — si el diseño cumple A-111; si no, dispara el lazo de diámetros.
- **CRITERIO** — **[COMPARA]** contra el presupuesto de A-111.
- **INVALIDA** — cambio de caudal (A-089), de resina, de geometría o de layout (A-110).
- **¿TENEMOS?** — **PARCIAL, y hay un bug de unidades conceptual.** La HP cilíndrica existe:
  `src/forja/mold/gating.ts :: gateDropCylNewt` = `8μLV̇/(πR⁴)`, idéntica; `γ̇ = 4V̇/(πR³)` en
  `gating.ts :: shearRateCyl` y `src/forja/mold/feed.ts :: shearRateRunner`; y
  `μ(γ̇) = k·γ̇^(n−1)` en `src/forja/mold/filling.ts :: viscosityPowerLaw`. **Nadie las encadena**:
  `gating.ts :: designGateProcess` llama `gateDropCylNewt(o.melt.k, …)` **pasando el índice de
  consistencia `k` como si fuera `μ`** — no evalúa la viscosidad a la tasa de corte. La forma power
  law equivalente sí está completa y bien: `src/forja/mold/feed.ts :: pressureDropRunner` (Ec 6.5).
  La simplificación del cono también: `feed.ts :: designSprueFeed` (`const rMean = (rTop + rBase)/2`)
  y el mismo criterio dentro de `designFeedSystem :: evalDia`.

### A-115 · Volumen total del feed system
- **CUÁNDO** — §6.4.4, con la geometría propuesta.
- **ENTRADAS** — longitudes y radios de cada segmento (←A-110, A-117).
- **EL CÁLCULO** — `V_total = suma_j( N_j * L_j * pi * R_j^2 )` — **Ec 6.6**.
  Ejemplo: 1 sprue R6×90 + 2 manifold R5×118 + 2 boquillas R3.5×108 = **37 cc**, contra una pieza de
  27.5 cc.
- **SALIDA** — cc.
- **DECIDE** — si cumple A-112; y alimenta el volumen de disparo de A-075.
- **CRITERIO** — **[COMPARA]** contra A-112, **y la lectura depende del tipo**: esos 37 cc son
  aceptables en hot runner (donde el criterio es turnover) e inaceptables en un cold runner de tres
  placas (donde serían >100% del volumen de pieza contra un techo de 30%).
- **INVALIDA** — cambio de diámetros (A-117, A-126, A-127) o de layout.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/feed.ts :: feedVolume` = `Σ (count ?? 1)·L·π·R²`, Ec 6.6
  exacta.

### A-116 · Reparto del presupuesto de ΔP por longitud
- **CUÁNDO** — §6.4.5, justo antes de resolver los radios.
- **ENTRADAS** — presupuesto total (←A-111); longitud de cada segmento (←A-110).
- **EL CÁLCULO** — `DeltaP_i = DeltaP_max * L_i / suma(L_j)` — **Ec 6.9**.
  Ejemplo del libro: 316 mm totales → sprue 8.5 MPa, manifold 11.2 MPa, boquilla 10.3 MPa.
- **SALIDA** — MPa asignados a cada segmento.
- **DECIDE** — la restricción individual que resuelve A-117.
- **CRITERIO** — **[LIBRO], contra la repartición intuitiva.** Dividir en partes IGUALES parece justo y
  está mal: *"**The problem with this approach** [ΔP igual por segmento] is that it **does not account
  for the length** ... the diameter being **too small for the secondary runner and too large for the
  primary**"*. Castiga al corto y le regala al largo.
  **Beneficio colateral que hay que preservar cuando el cálculo lo permite**: *"by **maintaining the
  same runner diameter in the manifold and the nozzle, more uniform shear stresses are maintained with
  a lower likelihood for dead spots**"*.
- **INVALIDA** — cambio de longitudes (A-110) o del presupuesto (A-111).
- **¿TENEMOS?** — **SÍ, exacto.** `src/forja/mold/feed.ts :: optimizeFeedSystem`:
  `const dPi = dPmaxPa * (p.L / Ltot)` — Ec 6.9, proporcional a la longitud, no partes iguales.

### A-117 · Solver de radio por restricción de presión
- **CUÁNDO** — §6.4.5, el paso que produce las cotas.
- **ENTRADAS** — ΔP asignado al segmento (←A-116); longitud; caudal (←A-089); reología.
- **EL CÁLCULO** — despeje de Hagen-Poiseuille:
  `R = ( 8*mu*L*Vdot / (pi*DeltaP_max) )^(1/4)` — **Ec 6.7**, newtoniano, que exige iterar porque la
  viscosidad aparente depende del radio; **o** la forma power law de un solo paso (**Ec 6.8**), que
  salta la iteración. Ejemplo: sprue R = 5 mm, manifold R = 4.4 mm, boquilla R = 4.4 mm.
- **SALIDA** — mm de radio por segmento.
- **DECIDE** — las cotas del feed system, que luego se redondean (A-126) y se ajustan steel-safe (A-127).
- **CRITERIO** — **[LIBRO], y es una decisión de método, no solo de número**: Kazmer rechaza
  explícitamente la optimización automática porque *"**Multivariate optimization** ... **requires time
  to implement and validate while hiding the details of the analysis from the designer**"*. Prefiere
  un método de restricción transparente aunque sea subóptimo. Ese rechazo es una **especificación de
  producto** para nosotros: nada de caja negra.
- **INVALIDA** — cambio de A-116, A-111, A-089 o de resina.
- **¿TENEMOS?** — **PARCIAL.** La forma **power law de un paso** sí:
  `src/forja/mold/feed.ts :: minRunnerRadius` (Ec 6.8). La forma **newtoniana Ec 6.7 no existe para el
  fundido**; su gemela sí existe para refrigerante en
  `src/forja/mold/coolinglines.ts :: minLineDiameter` (`(128μLV̇/(πΔP))^(1/4)`, la misma en diámetro)
  y en `cooling-design.ts`. Falta también el lazo de iteración radio↔viscosidad del caso newtoniano.

### A-118 · Barrido volumen contra presupuesto de presión
- **CUÁNDO** — §6.4.5, después del primer solver, para explorar el trade-off.
- **ENTRADAS** — el solver completo (←A-117) corrido a varios `ΔP_max`, por caudal.
- **EL CÁLCULO** — recorrer el solver variando `ΔP_max` y graficar el volumen resultante (Fig 6.19,
  con curvas para 50 / 125 / 300 cc/s). Números del libro: con ΔP_max = 50 MPa salen R_sprue = 4 mm y
  R_manifold = R_nozzle = 3.5 mm con **V = 21.3 cc**, contra **35 cc** a ΔP_max = 30 MPa.
- **SALIDA** — la curva V(ΔP_max) y el punto de operación elegido.
- **DECIDE** — dónde pararse dentro del lazo ΔP↔volumen. **Es el análisis que convierte el lazo en una
  elección consciente en vez de una iteración a ciegas.**
- **CRITERIO** — **[JUICIO] informado por dos umbrales** (A-111 y A-112): el diseño válido es cualquier
  punto de la curva que cumpla ambos; cuál se elige es del diseñador.
- **INVALIDA** — cambio de caudal o de layout.
- **¿TENEMOS?** — **FALTA.** No hay barrido de `ΔPmax` ni curva volumen-vs-ΔPmax en ningún archivo:
  `dPmax` solo aparece como escalar de entrada. Hoy resolvemos un punto, no la curva.

### A-119 · Balanceo artificial de un molde familia
- **CUÁNDO** — §6.4.6, cuando las cavidades NO son iguales.
- **ENTRADAS** — volumen y presión de cavidad de cada rama (←A-093); tiempo de llenado objetivo común.
- **EL CÁLCULO** — con el ejemplo completo del libro (taza + tapa): caudal por cavidad =
  volumen/t_fill (44 y 19 cc/s a 1 s); presiones de cavidad 16.8 y 15.4 MPa; **se asignan las caídas
  de runner para igualar el TOTAL**: 30 MPa a la rama de la taza (16.8 + 30 = 46.8) y **31.4 MPa** a
  la de la tapa (15.4 + 31.4 = 46.8) → R_taza = 1.5 mm, R_tapa ≈ 1.25 mm; sprue a 20 MPa → R = 2.7 mm.
  Verificación adicional: el llenado de los propios runners (~0.01 s) es despreciable.
- **SALIDA** — un radio distinto por rama.
- **DECIDE** — la geometría del feed de un molde familia.
- **CRITERIO** — **[LIBRO], y es el detalle que una máquina lineal se salta**: se iguala el **ΔP TOTAL
  (rama + cavidad) desde el fondo del sprue**, no el ΔP de los runners entre sí. Balancear solo los
  runners da un molde desbalanceado.
  **Y sus dos límites duros, declarados**: *"an **artificially balanced feed system may not balance**
  the mold filling for **different materials and processing conditions**"*, y
  *"runner segments with **smaller diameters will tend to freeze quickly and reduce the amount of
  packing to downstream cavities**"* — o sea, balancear el LLENADO puede desbalancear el EMPAQUE.
  La prevención antes que la cura: *"the mold designer **should strive to utilize mold cavities that
  have similar filling requirements**"*.
- **INVALIDA** — cambio de resina o de condiciones de proceso (el balanceo está atado a las que se
  asumieron); cambio de cualquier presión de cavidad.
- **¿TENEMOS?** — **FALTA.** No hay balanceo de molde familia igualando ΔP total desde el fondo del
  sprue. Lo más cercano, `src/forja/mold/feed-layouts.ts :: layoutSeries`, reparte con la heurística
  `dPfar * (2 - frac)` sobre cavidades **idénticas** y **sin incluir la ΔP de cavidad** — que es
  justamente la mitad que el libro dice que no se puede omitir.

### A-120 · Verificación de cierre del balanceo
- **CUÁNDO** — después de A-119 (o de cualquier layout que se declare balanceado).
- **ENTRADAS** — geometría final del feed (←A-117/A-119); presiones de cavidad (←A-093).
- **EL CÁLCULO** — recomputar, **por cada rama**, el tiempo total de llenado Y la presión total.
- **SALIDA** — tiempo (s) y presión (MPa) por rama, con su dispersión.
- **DECIDE** — cerrar la fase o volver a iterar diámetros.
- **CRITERIO** — **[LIBRO], con expectativa de iteración explícita**: *"the **total filling time and
  pressure of each branch ... should be evaluated** to ensure a truly balanced design; **multiple
  iterations may be needed**"*. Y el límite honesto que el libro pone al final:
  *"a truly optimal, balanced mold design is **extremely difficult to achieve** ... **realize that
  there will be limits to the performance of static feed system geometries**."*
- **INVALIDA** — cualquier cambio de diámetro, incluido el redondeo de A-126/A-127.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/feed-layouts.ts :: applyResistanceNetwork` cierra el
  **tiempo**: caudal real por cavidad, `tStartS` / `tFillS` / `totalFillS`, y una fila
  "⚖ V̇ REAL por cavidad" con % de desbalance; `layoutForGrid` lo narra en `net.pasos`.
  **Falta la presión por rama**: la red asume ΔP igual en rutas paralelas por construcción, así que
  nunca reporta ΔP_i — solo guarda conductancias `C[]` internas. Cerramos media verificación.

### A-121 · Métrica de regrind y su lectura económica
- **CUÁNDO** — §6.4.6, con el volumen del feed ya fijo.
- **ENTRADAS** — volumen del sprue y de los runners (←A-115); volumen de las cavidades.
- **EL CÁLCULO** — `%regrind = (V_sprue + V_runners) / V_cavidades`.
  Ejemplo del libro: `(1.7 + 0.26 + 0.2) / (44 + 19) = 3.5%`.
- **SALIDA** — %.
- **DECIDE** — si se recolecta y remuele, o no. **Y ésa es la parte contraintuitiva:** con 3.5%
  el libro concluye que *"The cost of collection, regrind, and re-use of this material **may exceed
  the purchase cost of the resin**."* Un número "bueno" que decide NO hacer algo.
- **CRITERIO** — **[COMPARA]** contra el límite del cliente (A-112) por arriba, y contra el costo de
  recolección por abajo. Si el regrind sale alto, el libro da la salida:
  el diseñador *"**may assess a higher pressure drop**"* por el feed para bajar el porcentaje,
  y *"**may wish to recommend a hot runner system**"* al cliente.
- **INVALIDA** — cambio de A-115.
- **¿TENEMOS?** — **SÍ el número.** `src/forja/mold/feed.ts :: designFeedSystem`
  (`pctRegrind = volCc/(partVolumeCc·nCav)·100`) y `designSprueFeed :: regrindPct`, juzgados por el
  criterio `feed-volumen` de `mold-contratos.ts`. **Falta la lectura económica** (el umbral por
  debajo del cual no vale la pena remoler).

### A-122 · Tiempo de enfriamiento del feed contra el de la cavidad
- **CUÁNDO** — §6.4.7, con la geometría del feed cerrada. Es la tercera meta del contrato.
- **ENTRADAS** — el mayor diámetro del feed (típicamente la base del sprue) y la sección más gruesa de
  la cavidad; temperaturas; difusividad de la resina.
- **EL CÁLCULO** — dos formas cerradas (Tabla 6.2 del cap. 6):
  tira: `t_c = h^2/(pi^2*alpha) * ln( (4/pi) * (Tmelt-Tcoolant)/(Teject-Tcoolant) )`
  cilindro: `t_c = D^2/(23.1*alpha) * ln( 0.692 * (Tmelt-Tcoolant)/(Teject-Tcoolant) )`
  Ejemplo ABS a 239 / 60 / 96.7 °C: **taza de 3 mm → 18.9 s** contra **sprue de Ø5.4 mm → 26.7 s**.
- **SALIDA** — segundos, los dos.
- **DECIDE** — si el feed system manda sobre el ciclo. Y la lección del ejemplo: **el sprue domina el
  ciclo por encima de la pieza** — el elemento más obvio no es el que manda.
- **CRITERIO** — **[COMPARA] con un adverbio que importa**: *"If the cooling time of the feed system
  **greatly exceeds** that of the cavities, then the mold designer **should redesign the feed
  system**"*. Es "greatly exceeds", no "exceeds": 26.7 contra 18.9 s se acepta **con matiz**.
  El atajo autorizado: *"the mold designer can **simply check the cooling time for the thickest mold
  cavity section and the largest feed system diameter (usually the diameter at the base of the
  sprue)**"* — solo los dos peores casos, no todo el árbol. Y el juicio que precede al remedio: el
  runner no necesita la rigidez de la pieza, pero un sprue blando se atora o se pega en la mitad A.
- **INVALIDA** — cambio de diámetro del sprue (que a su vez sube ΔP: retorno a A-114).
- **¿TENEMOS?** — **SÍ, con una discrepancia de coeficiente que hay que resolver.**
  Tira: `src/forja/mold/cooling.ts :: coolingTimePlate` = `h²/(π²α)·ln(4/π·…)`, idéntica (replicada
  inline dos veces en `feed.ts`, en vez de llamar a `cooling.ts`).
  Cilindro: `cooling.ts :: coolingTimeRod` y `feed.ts :: runnerCoolingTimeS` usan
  `D²/(23.1α)·ln(**1.60**·…)`, **no 0.692** — el comentario de `feed.ts` declara el 0.692 de la
  Tabla 6.2 como errata. El 0.692 sí se usa, pero con T_no_flow, en `gating.ts :: gateFreezeCylS` y
  `feed.ts :: gateFreezeCylSFeed`. **Sin el tomo original no se puede cerrar cuál es el correcto:
  queda como pendiente declarado.**
  La **comparación** sí existe: `feed.ts :: designFeedSystem` (`tcSprueS` contra `tcPartS`, §6.4.7) y
  el criterio `feed-ciclo` de `mold-contratos.ts`.

### A-123 · Vueltas y tiempo de residencia del hot runner
- **CUÁNDO** — §6.4.8, último sub-paso, solo si hay colada caliente.
- **ENTRADAS** — volumen del hot runner (←A-115); volumen de cavidades; tiempo de ciclo.
- **EL CÁLCULO** — `n_turns = V_hot / V_cavidades` (**Ec 6.10**) y
  `t_residencia = (1 + n_turns) * t_ciclo` (**Ec 6.11**).
  Ejemplo: 21.3 / 27.5 = 0.77 vueltas → (1 + 0.77) × 13.5 s = **24 s**.
- **SALIDA** — vueltas (adimensional) y segundos.
- **DECIDE** — si el hot runner permite cambios de color y si la resina se degrada.
- **CRITERIO** — **[LIBRO], dos umbrales**: *"If the number of turns is **less than or close to one**,
  then the hot runner is **unlikely to impede color changes** ... If ... **on the order of 10 or
  more**, then purging ... **hundreds (or thousands) of molding cycles**"*. Y para residencia,
  *"the allowable residence time of most polymers ... is **typically greater than 15 minutes**"* —
  recordando que el material **ya residió en el barril** antes de entrar. Nótese que el límite superior
  del hot runner no es la presión: *"**overly large diameters can permit the material to degrade** ...
  and **prohibit rapid change-overs** between different resins and colors"*.
- **INVALIDA** — cambio del volumen del manifold o del tiempo de ciclo.
- **¿TENEMOS?** — **FALTA.** `n_turns`, `t_residencia = (1+n_turns)·t_ciclo` y los umbrales 1/10 y
  15 min no existen. Solo hay menciones en prosa (`feed.ts`, `mold-contratos.ts`). Lo único cercano es
  un proxy de residencia por % de barril en `src/forja/mold/machinesizing.ts` (`shotPct < 25`), que es
  otro fenómeno.

### A-124 · Diámetro hidráulico y eficiencia de la sección del runner
- **CUÁNDO** — §6.5.1, al bajar del modelo circular a la sección que se va a maquinar.
- **ENTRADAS** — perfil elegido (redondo / trapezoidal / trapezoide de fondo redondo / medio redondo);
  sus cotas.
- **EL CÁLCULO** — `Dh = 4*A/p` — **Ec 6.12**, más las fórmulas de la Tabla 6.3, que **asumen 5° de
  salida**. Ejemplo trapezoidal W6 × H8 × 120 mm → Dh = 7.04 mm → ΔP = 3.9 MPa.
  Eficiencias de la Tabla 6.3: redondo **100%**, trapezoide de fondo redondo **87.9%**, trapezoidal
  **78.5%**, medio redondo **61.2%**.
- **SALIDA** — mm de diámetro equivalente y % de eficiencia.
- **DECIDE** — qué sección se maquina y cuánto hay que agrandarla para dar el mismo ΔP.
- **CRITERIO** — **[LIBRO], con banda de dos colas.** La penalización:
  *"**all these non-circular types of runner will need to be slightly larger** and consume additional
  material to provide the same pressure drop as a full round runner"*, porque en el trapezoidal
  *"the sections near the four corners"* casi no conducen flujo.
  **Y el veredicto contraintuitivo del ejemplo**: esos 3.9 MPa se ven buenísimos y el libro los
  REPRUEBA — *"The dimensions of this trapezoidal design are **too large, providing a low pressure
  drop but consuming excess material and cycle time**. The depth and width **should be reduced**"*.
  El semáforo tiene banda inferior, no solo techo.
  Advertencia de precisión: usar Dh en las ecuaciones circulares sabiendo que el resultado
  *"will not be as precise"*. Y el criterio de manufactura que justifica la sección no circular: se
  maquina en UNA sola placa (menos maquinado, menos riesgo de desalineación) — se paga con eficiencia.
  Los 5° están **horneados** en las fórmulas: *"the equations in Table 6.3 have been **derived assuming
  a 5 degree taper angle to assist with the ejection of the runner**"*.
- **INVALIDA** — cambiar el perfil o el ángulo de salida.
- **¿TENEMOS?** — **SÍ, con la tabla literal.** `src/forja/mold/lamina-compuerta.ts :: perfilRunner`
  (`const dh = (4 * area) / perim`, taper por defecto **5°**) y
  `:: TABLA_6_3 = {redondo:100, trapezoide-fondo-redondo:87.9, trapezoidal:78.5, medio-redondo:61.2}`
  con `ORDEN_LIBRO`; la verificación V6.3 reproduce el ranking con `Q = 4πA/P²`.

### A-125 · Sección anular del valve gate
- **CUÁNDO** — §6.5.1, cuando la boquilla lleva vástago de válvula.
- **ENTRADAS** — diámetro del bore, diámetro del pin, longitud, viscosidad, caudal.
- **EL CÁLCULO** —
  `DeltaP = 12*mu*L*Vdot / ( 0.5*pi*(Dpin+Dbore) * [0.5*(Dbore-Dpin)]^3 )` — **Ec 6.14**, con su forma
  power law (**Ec 6.15**). Ejemplo: L = 150 mm, bore 10 mm, pin 5 mm, 100 Pa·s, 50 cc/s → **24.5 MPa**.
- **SALIDA** — MPa.
- **DECIDE** — si el bore de la boquilla con valve pin alcanza, o hay que agrandarlo.
- **CRITERIO** — **[COMPARA]** contra el presupuesto de A-111. El libro no da umbral propio para la
  sección anular; V6.4 confirma que la figura es geométrica y el juicio es numérico.
- **INVALIDA** — cambio de pin o de bore.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/lamina-compuerta.ts`, bloque V6.4, mide la corona
  (`Db`, `dv`, `dh = Db − dv`, `areaFlujo = π/4·(Db²−dv²)`). **Falta la ecuación de caída de presión
  anular (Ec 6.14/6.15)**: no aparece en ningún archivo. Tenemos la geometría y no la física.

### A-126 · Redondeo a diámetro de cortador estándar
- **CUÁNDO** — §6.5.4, después del solver.
- **ENTRADAS** — radios calculados (←A-117); catálogo de herramienta.
- **EL CÁLCULO** — mapear al diámetro de catálogo: 1/32″, 1/16″, 3/32″, 1/8″, 3/16″, 1/4″, 5/16″,
  3/8″, 7/16″, 1/2″, y 2, 3, 4, 4.5, 5, 6, 8, 10, 12 mm. Los hot runners van en pasos de 2 mm según
  proveedor (5/7/9 o 4/6/8/10).
- **SALIDA** — el diámetro que se pone en el plano.
- **DECIDE** — la cota de manufactura.
- **CRITERIO** — **[LIBRO] con condición de escape explícita**: *"the mold designer **should specify
  runner diameters that are machined with readily available cutting tools**"*, **pero**
  *"**However, if non-standard runner sizes provide for less material utilization and more balanced
  melt flow, then non-standard runner diameters can and should be specified**"*. El catálogo no es
  camisa de fuerza. Con el proveedor de hot runner, además, el diseñador
  *"**should verify the appropriateness**"* de las recomendaciones que le den.
- **INVALIDA** — cambio de A-117.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/feed.ts :: STANDARD_RUNNER_DIAMM = [2,3,4,4.5,5,6,8,10,12]`
  (§6.5.4). **Faltan** la serie en pulgadas 1/32″–1/2″ y los pasos de 2 mm del hot runner. Y **falta
  la condición de escape**: hoy el redondeo es obligatorio, sin la puerta que el libro deja abierta.

### A-127 · Ajuste steel-safe (redondear HACIA ABAJO)
- **CUÁNDO** — §6.5.5, después de A-126. **Es un análisis distinto, no el mismo redondeo.**
- **ENTRADAS** — el diámetro estándar más cercano (←A-126).
- **EL CÁLCULO** — bajar uno o dos tamaños de catálogo: 4.6 mm → especificar **4.5 o 4 mm**, nunca 5.
- **SALIDA** — la cota final del plano.
- **DECIDE** — con cuánto acero se libera a maquinado.
- **CRITERIO** — **[LIBRO], y el criterio ES LA DIRECCIÓN, por asimetría de costo de corrección**:
  *"the mold designer **should specify feed system dimensions that are 'steel safe'** ... the design
  should call for **the removal of less mold steel** than may ultimately be required ... **round the
  feed system dimensions DOWN one or two standard sizes**"*. Agrandar después es trivial; encoger
  exige fresado de bolsillo, fabricar y ajustar un inserto, soldadura y/o fasteners, y rehacer el feed.
  Redondear hacia arriba "por seguridad" es lo inseguro: condena al molde a desperdiciar material toda
  su vida. **Y no aplica igual en caliente**: en hot runner *"high costs may be incurred to reduce the
  diameters"*, así que ahí la incertidumbre pega doble.
- **INVALIDA** — cambio de A-126.
- **¿TENEMOS?** — **PARCIAL.** `src/forja/mold/feed.ts :: steelSafeDiaMm` redondea hacia abajo **un
  solo** tamaño (`filter(d => d <= diaMm)` → el mayor). **No implementa la variante de "uno o DOS"
  tamaños**, ni la asimetría frío/caliente. Usado en `feed-layouts.ts`, `mold-contratos.ts`
  (`feed-steel-safe`) y `lamina-compuerta.ts`.

### A-128 · Re-verificación post-redondeo
- **CUÁNDO** — inmediatamente después de A-126 y A-127.
- **ENTRADAS** — los diámetros finales.
- **EL CÁLCULO** — recorrer A-114 (ΔP), A-115 (volumen) y A-120 (balanceo) con las cotas redondeadas.
- **SALIDA** — el triple semáforo recalculado.
- **DECIDE** — si el diseño sigue cumpliendo después de haber tocado las cotas. **Redondear no exime
  de re-checar**: bajar dos tamaños en un segmento largo puede reventar el presupuesto de presión.
- **CRITERIO** — **[COMPARA]** contra A-111, A-112 y A-122 otra vez.
- **INVALIDA** — cualquier cambio de cota.
- **¿TENEMOS?** — **PARCIAL.** El triple semáforo existe y es correcto
  (`src/forja/mold/mold-contratos.ts :: contratoAlimentacion`, criterios `feed-dp`, `feed-volumen`,
  `feed-ciclo`), pero **no está encadenado como paso posterior obligatorio al redondeo**: hoy se juzga
  el diseño, no la secuencia calculado → estándar → steel-safe → re-verificado.

### A-129 · Monotonía de diámetros aguas abajo
- **CUÁNDO** — auditoría del árbol de colada, después de fijar diámetros.
- **ENTRADAS** — todos los diámetros del árbol (←A-117, A-126, A-127).
- **EL CÁLCULO** — verificar `D_sprue >= D_primario >= D_secundario >= ...`.
- **SALIDA** — booleano + la lista de violaciones.
- **DECIDE** — si hay que rediseñar un segmento.
- **CRITERIO** — **[LIBRO]**: *"the **diameters are generally largest with the sprue** and subsequently
  become smaller with the primary, secondary, and other runners"*. **Con una única excepción, y va
  ANTES del sprue** (A-130).
- **INVALIDA** — cualquier cambio de diámetro.
- **¿TENEMOS?** — **FALTA el check.** En `src/forja/mold/feed-layouts.ts` los diámetros decrecen **por
  construcción**, pero nadie lo audita: si un diámetro se edita a mano o se redondea, nada lo detecta.

### A-130 · Orificio de boquilla contra entrada del sprue
- **CUÁNDO** — §6.3.1, al especificar el buje de colada.
- **ENTRADAS** — diámetro del orificio de la nariz de la máquina; diámetro de entrada del sprue.
- **EL CÁLCULO** — comparación: `D_nozzle < D_sprue_inlet`.
- **SALIDA** — booleano.
- **DECIDE** — si se acepta el buje, o se recomienda cambiar la boquilla de la máquina.
- **CRITERIO** — **[LIBRO], y es LA excepción a A-129**: *"the **diameter of the molding machine's nozzle
  orifice is typically smaller than the diameter of the sprue inlet**"*, y el diseñador
  *"**should verify and/or recommend**"* ese diámetro. Si se invierte, el tapón congelado atrás del
  sprue lo pega a la mitad A y obliga a "sprue break" (retraer la unidad de inyección), lo que
  *"adds complexity and variance to the molding cycle."* Relacionado: el undercut estándar del sprue
  puller — *"a **reverse taper is usually provided below the sprue**"* para que
  *"the sprue and attached runner"* se queden con la mitad B.
- **INVALIDA** — cambio de máquina o de buje.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/mold-contratos.ts` criterio `feed-boquilla` (§6.3.1,
  `nozzleMm < sprueTopMm`, con el remedio del sprue pegado a la mitad A); el catálogo trae
  `nozzleOrificeMm` en `src/forja/mold/machinesizing.ts :: INJECTION_MACHINES`.

### A-131 · Velocidad y tiempo de apertura del molde
- **CUÁNDO** — §6.3.2, al comparar dos contra tres placas.
- **ENTRADAS** — tonelaje de cierre de la máquina (←A-099/A-076); distancia de apertura.
- **EL CÁLCULO** — regresión de máquinas comerciales (nota al pie de la Tabla 6.1):
  `v_apertura = 184 + 13*log10( F_clamp [toneladas métricas] )` mm/s — ≈210 mm/s para 100 t.
  `t_apertura = distancia_de_apertura / v_apertura`.
- **SALIDA** — mm/s y s.
- **DECIDE** — alimenta la comparación de A-132 y el tiempo de ciclo.
- **CRITERIO** — **ninguno propio**; es una correlación empírica que sirve de insumo.
- **INVALIDA** — cambio de máquina o de la carrera de apertura.
- **¿TENEMOS?** — **SÍ, idéntica.** `src/forja/mold/threeplate.ts :: moldOpeningVelocity` =
  `184 + 13*Math.log10(clampTons)`; el tiempo en `threePlateLayout` (`tOpenS: openTotal / v`) y en
  `compareFeedSystems`. Expuesta como comando `mold.openingVelocity` en
  `src/forja/commands/registry.ts`.

### A-132 · Comparativa dimensional dos placas contra tres placas
- **CUÁNDO** — §6.3.2, como entregable de decisión.
- **ENTRADAS** — geometría del molde en las dos arquitecturas; velocidad de apertura (←A-131).
- **EL CÁLCULO** — cinco magnitudes lado a lado (Tabla 6.1, valores del ejemplo del libro):
  stack height 264 → 308 mm (+20%), masa 151 → 181 kg (+20%), **distancia de apertura 75 → 250 mm**,
  **daylight total 339 → 558 mm**, **tiempo de apertura 0.36 → 1.2 s**.
- **SALIDA** — la tabla, calculada para EL molde del usuario, no la del ejemplo.
- **DECIDE** — dos o tres placas. **Y el punto que el libro subraya: el costo real del tres placas no
  es la altura de pila ni la masa (+20% ambas), es el daylight y el tiempo de apertura** — la apertura
  se triplica y el tiempo se cuadruplica.
- **CRITERIO** — **[COMPARA]**, y con un veredicto declarado: la mayor distancia de apertura
  *"is undesirable since it adds to the mold opening and closing time, and may also prevent the mold
  from operating in some injection molding machines with limited daylight"* — o sea, engancha directo
  con A-074.
- **INVALIDA** — cambio de altura de pieza, de placas o de máquina.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/threeplate.ts :: compareFeedSystems` devuelve
  `{stackMm, openMm, daylightMm, massKg, tOpenS}` para 2 y 3 placas, más `daylightNeededMm`. Anclas
  literales de la Tabla 6.1 en `src/forja/mold/lamina-apertura.ts :: TABLA_6_1 = {dosPlacasMm:75,
  tresPlacasMm:250}` (verificación V6.1).

### A-133 · Apertura A–B y longitudes libres de los stripper bolts
- **CUÁNDO** — §6.3.2, si el molde es de tres placas.
- **ENTRADAS** — altura de la pieza; geometría del feed system.
- **EL CÁLCULO** — `apertura_A_B = 2 a 3 × altura_de_la_pieza`, y las longitudes libres de los bolts
  suficientes para expulsar piezas Y feed system.
- **SALIDA** — mm.
- **DECIDE** — la carrera del molde, que entra a A-074 (daylight) y a A-132.
- **CRITERIO** — **[LIBRO], regla de dedo**: *"A **typical mold open distance between the A and B
  plates is equal to two to three times the height of the molded parts**"*. Con la advertencia de
  sensibilidad al setup: la velocidad y la posición de apertura
  *"**must be carefully determined and controlled**"*, porque si no
  *"the feed system may not be reliably ejected **or the mold can be damaged**"*.
- **INVALIDA** — cambio de altura de pieza o del ruteo del feed.
- **¿TENEMOS?** — **SÍ.** `src/forja/mold/threeplate.ts :: OPEN_FACTOR = 2.5` ("2 a 3 × altura de
  pieza", §6.3.2), `moldOpeningStrokeMm(partHeightMm, factor)`, y los stripper bolts como
  `boltABfreeMm` / `boltAXfreeMm` en `threePlateLayout`, con la cinemática en `openingSequence`.
  Consumido por `src/forja/mold/ciclo-datos.ts` y `lamina-apertura.ts`.

### A-134 · Dimensionado de sucker pins
- **CUÁNDO** — §6.5.2, en dos y tres placas, al resolver la expulsión del runner.
- **ENTRADAS** — diámetro del runner; riesgo de que el feed se quede en la mitad A.
- **EL CÁLCULO** — `D_sucker` un poco menor que `D_runner`; altura ≈ `D_runner / 2`; taper 5°;
  tope del expulsor enrasado con el fondo del canal.
- **SALIDA** — las cotas del pin, **más una cota angular**.
- **DECIDE** — si el runner se expulsa de forma confiable en ciclo automático.
- **CRITERIO** — **[LIBRO], cotas y una restricción angular que casi nadie modela.** Cotas:
  *"it is **recommended that the diameter of the sucker be slightly less than the diameter of the
  associated runner** to avoid increased cooling times"* y *"**Typical heights and taper angles are one
  half the runner diameter and 5 degrees**"*. Colocación: no restringir el flujo — el pin
  *"protrudes slightly into the runner section"* y por eso
  *"it is **preferred to align the top of the ejector pin with the bottom of the runner**"*; y pueden
  *"be **moved further away from sprue bushing**"*.
  **La cota angular:** *"if **multiple slotted ejector pins** are used ... the mold designer **should
  consider the relative alignment of the undercutting slots** ... If ... **provided at random angles,
  then the runner system may inadvertently bind** ... **hampering the adoption of a fully automatic
  molding cycle**"*. Es un fallo **intermitente**, el más difícil de diagnosticar, y su remedio es una
  cota en el plano.
- **INVALIDA** — cambio del diámetro del runner.
- **¿TENEMOS?** — **PARCIAL, con una contradicción interna.**
  `src/forja/mold/threeplate.ts :: suckerPinDesign` (⌀ = 0.6·D_runner, menor que el canal ✓) y
  `src/forja/mold/lamina-compuerta.ts :: agregaSucker` (`hs = D/2` y `tap = 5°` marcados LITERAL
  §6.5.2; `zTop = -D/2 + intr` alinea el tope con el fondo del canal, y V6.5 mide la intrusión).
  **Hueco 1:** `suckerPinDesign.depthMm = 0.8*runnerDiaMm` **contradice** el D/2 del libro que la
  lámina sí usa — dos verdades distintas en el mismo repo.
  **Hueco 2:** la **orientación de las ranuras no existe** — el pin se modela por revolución
  (`mallaRevolucion`), sin dato angular. Justo la cota que el libro dice que decide el ciclo
  automático.

### A-135 · Longitud total y número de ramas del feed
- **CUÁNDO** — §6.4.2, como criterio de puntuación del layout.
- **ENTRADAS** — el árbol de colada (←A-110).
- **EL CÁLCULO** — sumar longitudes y contar ramas, y comparar entre layouts candidatos.
- **SALIDA** — mm totales y número de ramas.
- **DECIDE** — cuál layout se lleva la fase.
- **CRITERIO** — **[LIBRO], dos reglas separadas**: *"The **total length** of the feed system **should
  be as short as possible**"* (el libro lo dice dos veces, por material y por ΔP), y
  *"The **total number of branches should be minimized** to avoid excessive runner volume and potential
  **melt temperature imbalances**"*. No es la misma regla: se puede tener un árbol corto con demasiadas
  ramas, y las ramas cuestan **temperatura**, no solo material.
- **INVALIDA** — cambio del layout de cavidades (A-069).
- **¿TENEMOS?** — **FALTA.** No hay criterio de layout por longitud total mínima ni por número mínimo
  de ramas. El único `Ltot` (`src/forja/mold/feed.ts :: optimizeFeedSystem`) sirve para repartir ΔP, no
  para puntuar layouts; y el "menos material" de `layoutHybrid` es prosa en `rows`, sin comparación
  calculada entre redes.

### A-136 · La regla de velocidad constante, como CONTRAEJEMPLO
- **CUÁNDO** — §6.4, antes de presentar el método propio. **El libro la enseña para rechazarla.**
- **ENTRADAS** — diámetro aguas arriba; número de ramas aguas abajo.
- **EL CÁLCULO** — `D_downstream = D_upstream / sqrt(n_downstream)` — **Ec 6.1**. Conserva la velocidad
  lineal: 6 mm → 4.24 mm da 1.77 m/s en ambos.
- **SALIDA** — mm.
- **DECIDE** — **nada. Su veredicto es que no se use.**
- **CRITERIO** — **[LIBRO], rechazo explícito**: *"While this design guideline [D_down = D_up/sqrt(n)]
  is simple and seems intuitive, **the resulting designs are inferior** with respect to the imposed
  pressure drops and the consumed plastic material"*. Es un anti-patrón declarado, y el sustituto es
  el solver por restricción de A-116 + A-117.
- **INVALIDA** — n/a.
- **¿TENEMOS?** — **SÍ, PERO AL REVÉS: está implementada y tratada como VÁLIDA.**
  `src/forja/mold/feed-layouts.ts` la usa como "Eq 6.1" en la cabecera del archivo, en `layoutBranched`
  (`rUp / Math.SQRT2`), en `layoutRadial` (`2*rSprue/Math.sqrt(nCav)`), en `layoutHybrid`, en
  `layoutForGrid`, y hasta la narra como paso (`'D_down = D_up/√2'`). **Ningún comentario la marca como
  rechazada por el libro.** Es una **contradicción activa** entre nuestro código y la fuente: nuestros
  layouts dimensionan con la regla que Kazmer llama inferior, en vez de con A-116/A-117. Es el hallazgo
  más accionable de este tomo.

### A-137 · Aislamiento térmico del hot runner
- **CUÁNDO** — §6.3.3, al integrar el manifold al molde.
- **ENTRADAS** — geometría del manifold; fuerzas de sellado; temperaturas de operación.
- **EL CÁLCULO** — **cualitativo / de diseño, no una ecuación de flujo.** Tres requisitos acoplados:
  colchón de aire alrededor del manifold; thrust pads *"typically machined from titanium"* que
  transfieren la fuerza al top clamp plate *"while transferring a minimal amount of heat"*; y
  *"cooling lines and/or insulating sheets should be used with the top clamp plate to prevent the
  transfer of significant heat to the platens"*. Más la condición cinemática: el manifold
  *"is allowed to expand and slide"* sobre las boquillas pero se mantiene
  *"maintained in compression in the height direction"*.
- **SALIDA** — checklist de aislamiento, con las cotas del air gap y de los pads.
- **DECIDE** — si el calor del manifold se fuga al acero y a las platinas.
- **CRITERIO** — **[LIBRO], checklist**, más un gate humano: *"The mold designer **should consult with
  multiple hot runner suppliers**"*. El manifold no se diseña solo. Y el disparador para siquiera
  evaluar hot runner: *"Hot runner molds **should be considered whenever gating flexibility, cycle
  efficiency, and material efficiency are important**"*.
- **INVALIDA** — cambio de manifold o de proveedor.
- **¿TENEMOS?** — **PARCIAL, y es geometría sin física.** `src/forja/mold/mold-plano-set.ts` (rama
  `if (hot && feed.length)`) construye **thrust pads de titanio** (`cyl(7, padH, …)`, `padH = 6`,
  `padGap = 1.5`) y declara el air gap y los pads en las notas (Fig 6.12). **Pero no hay cálculo**: no
  se dimensiona el air gap ni la expansión térmica, y **no existe el enfriamiento/aislamiento del top
  clamp plate** en ningún lado del repo.

---

# EL GRAFO

El premio de este pliego no es la lista: es **la secuencia**. Kazmer nunca dibuja este grafo porque lo
tiene en la cabeza. Aquí está volcado.

## Espina dorsal

```
                        ┌──────────────── RAMA MATERIALES (paralela a todo el cap. 4) ───────────────┐
                        │  A-077 alpha ──► A-078 f_making/f_operating ──► A-079 Tabla 4.1 ──► A-080 base │
                        │       A-081 proveedor ──────────────────────────────┴──► (A-066, A-072)       │
                        └───────────────────────────────────────────────────────────────────────────┘

A-060 apertura ──► A-061 parting line ──► A-062 parting plane ──► A-063 interlocks >=5°
   │                    │                      └──► A-064 shut-offs = ventanas
   │                    │
   │                    └──► A-065 altura inserto (3·D agua) ──► A-066 redondeo ARRIBA ──► A-067 H compra
   │                         A-068 L/W inserto (agua vs cheek)
   │                                   │
   │                                   ▼
   │                         A-069 layout cavidades ──► A-070 aspecto <2:1 ──► A-071 area usable (½·D)
   │                                                                              │
   │                                                                              ▼
   │                                                                     A-072 SPEC DEL MOLD BASE
   │                                                                     ═══ GATE DE COMPRA ═══
   │                                                                              │
   │                                        ┌─────────────┬───────────────┬───────┴───────┐
   │                                        ▼             ▼               ▼               ▼
   │                                   A-073 tie bars  A-074 daylight  A-075 disparo    A-076 tonelaje
   │                                                       ▲                              ▲
   └──► A-096 area proyectada ─────────────────────────────┼──────────────────────────────┤
                                                           │                              │
CAP. 5                                                     │                              │
A-082 T_melt ──► A-085 Cross-WLF ──► A-086 newtoniano / A-087 power law                       │
                                          │                                               │
                                          ▼                                               │
              A-083 gammadot/tau ─► A-084 dP/dL      A-088 v recomendada  ⟲ LAZO v-gammadot-mu│
                                                          │                               │
                                                          ├──► A-090 banda 0.01–1 m/s       │
                                                          ▼                               │
                                              A-089 t_fill y CAUDAL ──────────► (CAP. 6)    │
                                                          │                               │
        A-092 gates ⇄ A-091 lay-flat ─────────────────────► A-093 presion de llenado          │
                    │                                      │                               │
                    │                                      ├──► A-094 banda 100 MPa / cola baja
                    │                                      │              │                │
                    │                                      │              ▼                │
                    │                                      │      A-095 ESPESOR MINIMO ◄────┼── A-111
                    │                                      │                               │
                    │                                      ├──► A-097 tonelaje llenado ──┐   │
                    │                          A-096 ───────┴──► A-098 tonelaje empaque ──┼──►A-099 max ─┘
                    │                                                                   │
                    ▼
        A-100 patron de llenado ──┬──► A-101 race-tracking ◄── A-102 longitudes de flujo
                                 ├──► A-103 weld lines
                                 └──► A-104 gas traps / last-to-fill ──► (CAP. 8 venteo, CAP. 11 expulsion)
                                          │
                     A-101/A-104 ──► A-105 flow leaders ──► A-106 re-verificacion (+10% P, -10% peso)

        A-107 CONTRASTE vs SIMULACION (Tabla 5.1) ─── valida A-088, A-093, A-097, A-098, A-099

CAP. 6
A-109 economia ──► A-108 TIPO de feed ──► A-110 LAYOUT ──► A-135 longitud/ramas
                       │                    │
                       │                    ├──► A-131 v apertura ──► A-132 2 vs 3 placas ──► A-074
                       │                    │         A-133 apertura A–B (3 placas) ───────► A-074
                       │                    │
   A-093 ──► A-111 PRESUPUESTO ΔP ──► A-116 reparto por longitud ──► A-117 SOLVER DE RADIO ──► A-118 barrido
                       ▲                                                │
   A-112 PRESUPUESTO VOLUMEN ◄── A-115 volumen del feed ◄─────────────────┤
                       │                                                │
   A-089 caudal ──► A-113 Re<2300 ──► A-114 ΔP por segmento ◄──────────────┤
                                          ▲                             │
                       A-124 Dh / eficiencia de seccion ─────────────────┤
                       A-125 seccion anular ────────────────────────────┘
                                                                        │
   A-119 balanceo familia ──► A-120 cierre del balanceo ◄─────────────────┤
   A-115 ──► A-121 regrind        A-115 ──► A-123 n_turns / residencia      │
   A-117 ──► A-122 t_c feed vs cavidad                                    │
                                                                        ▼
                      A-126 cortador estandar ──► A-127 STEEL-SAFE (abajo) ──► A-128 RE-VERIFICAR
                                                                        │
                      A-129 monotonia de diametros · A-130 boquilla < sprue · A-134 sucker pins
                      A-136 regla sqrt(n) = CONTRAEJEMPLO (no produce nada) · A-137 aislamiento HR
```

## Los 20 retornos

Un retorno es un resultado que **obliga a rehacer algo anterior**. Son lo que distingue este grafo de
una lista ordenada. Marcados `◄══`.

**Dentro del cap. 4**

1. `A-061 ◄══ A-060` — si la línea de partición ideal cae en zona visible o funcional, se cambia la
   **dirección de apertura** (split cavity / oblicua) para poder moverla. §4.1.1
2. `A-062 ◄══ A-061` — feature fuera de plano ⇒ rehacer el plano con superficies lofted y draft, e
   inclinar los interlocks ≥5°. §4.1.3
3. `A-070 ◄══ A-069` — aspecto ≥2:1 ⇒ cambiar el layout (línea → rejilla / círculo / híbrido). §4.3.1
4. `A-071 ◄══ A-072 / A-069` — conflicto con leader pins, return pins, SHCS, agua o pilares ⇒ **crecer la
   base** o reacomodar el layout. *"mold bases are often sized larger than what would first be
   considered"*. §4.3.2
5. `A-073…A-076 ◄══ A-072 / A-069 / máquina` — cualquiera de los cuatro semáforos en rojo tira la base, la
   cavitación o la máquina. §4.3.3
6. `A-068 ◄══ (cap. 9 y cap. 12)` — **retorno declarado y diferido**: las dimensiones L/W del inserto
   pueden REDUCIRSE después *"supported by later engineering analysis"*. Hasta entonces son
   **provisionales**, y si cambian invalidan A-072. §4.2.3

**Dentro del cap. 5**

7. `A-088 ⟲ A-088` — **lazo interno**: velocidad → tasa de corte → viscosidad → velocidad,
   *"until the velocity converges"*. 0.5 → 0.69 → 0.77 → 0.80 → 0.82 m/s. §5.5.1
8. `A-094 ◄══ A-093 / A-087 / A-082 / geometría` — la **escalera de remedios**, en el orden del libro:
   subir temperaturas de molde y melt → agrandar runners (= retorno al cap. 6) → resina de menor
   viscosidad → **y hasta el final** cambiar el espesor de pared (= retorno a la fase pieza, que
   invalida llenado, feed y tonelaje). §5.2.1
9. `A-094(cola baja) ◄══ geometría` — presión demasiado baja ⇒ **adelgazar la pared nominal y poner
   costillas**. El remedio de la cola baja NO es el mismo que el de la cola alta. §5.1
10. `A-101 ══► A-092 ══► A-108 ══► A-105` — **escalera ordenada anti gas-trap**: (1) mover el gate al centro
    de la pared larga; (2) gate central vía tres placas o hot runner (= **cambio de tipo de molde**);
    (3) solo si el layout lo impide, flow leaders. §5.5.5
11. `A-106 ◄══ A-093 / A-094` — el flow leader costó +10% de presión: hay que re-checar contra el techo.
    **El fix nunca es gratis.** §5.5.5
12. `A-107 ══► documenta el sesgo` — la simulación no invalida el análisis a mano (7% en presión y
    tonelaje de llenado), pero el tonelaje de empaque de la sim **no es el pico real** y compararse
    contra él es la trampa. §5.5.3

**Entre capítulos (los que más cuestan)**

13. `A-095 ◄══ A-111` — **el acoplamiento declarado más caro del tomo**: *"the minimum wall thickness is
    **also a function of the feed system design**"*. Si el cap. 6 mueve el presupuesto de presión, el
    espesor mínimo de la PIEZA se recalcula. Retorno cap. 6 → cap. 5 → diseño de producto. §5.5.2
14. `A-076 ◄══ A-099` — el tonelaje del cap. 5 entra al semáforo de máquina del cap. 4. El cap. 4 no
    cierra sin el cap. 5.
15. `A-074 ◄══ A-132 / A-133` — pasar de dos a tres placas dispara el daylight de 339 a 558 mm en el
    ejemplo del libro: el cap. 6 puede tirar la máquina elegida en el cap. 4. §6.3.2
16. `A-075 ◄══ A-115` — el volumen del feed entra al volumen de disparo, y puede sacar al molde de la
    ventana cómoda de la máquina. §4.3.3 + §6.4.4
17. `A-065 / A-068 ◄══ (cap. 9)` — el diámetro de la línea de agua es del cap. 9 y aquí se anticipa:
    cambiarlo re-dimensiona los insertos y con ellos la base.

**Dentro del cap. 6**

18. `A-114 ⟷ A-115` — **el lazo central del capítulo** (Fig 6.3): si ΔP > máximo, agrandar diámetros;
    si el volumen > máximo, achicarlos. Los dos tiran del mismo parámetro en direcciones opuestas, y
    la fase no cierra hasta que AMBOS estén en verde. §6.2.2
19. `A-122 ══► A-117 ══► A-114 ══► A-119/A-120` — si el enfriamiento del sprue estira el ciclo, se reduce el
    diámetro del sprue *"albeit with a higher pressure drop"*, lo que sube ΔP y puede exigir
    re-balancear. §6.4.7
20. `A-128 ◄══ A-126 / A-127` — **redondear no exime de re-checar**: tras el estándar y el steel-safe hay
    que recorrer ΔP, volumen y balanceo otra vez. §6.5.4
    Y dos más de la misma familia: `A-121 ══► A-111 o A-108` (si el regrind sale alto, el diseñador
    *"may assess a higher pressure drop"* o *"may wish to recommend a hot runner system"*, §6.4.6); y
    `A-110 ══► A-108` (si las cavidades del dos placas estorban el ruteo deseado, se cambia el tipo de
    molde, §6.4.2).

## Qué corre en paralelo

- **La rama de materiales (A-077 → A-078 → A-079 → A-080) es independiente de toda la geometría.** Puede
  correr desde el día 1 y solo se cruza con el resto en A-072 (catálogo de la base) y A-066 (incrementos
  de placa). El corpus declara además que en muchas casas *"these materials are immediately ordered
  concurrent with the detailed analysis"* — apuesta de tiempo contra riesgo de re-orden. §4.5
- **A-081 (proveedor)** es entrada externa: no depende de nada, pero al cambiar invalida A-066, A-072 y
  A-080.
- **A-096 (área proyectada)** solo necesita A-060. Se puede tener listo mucho antes que la presión.
- **A-083, A-084, A-085 son caja de herramientas, no pasos.** Se preparan una vez por resina y se
  reutilizan en A-086, A-087, A-114 y A-117.
- **En el cap. 6 hay dos ramas casi independientes**: la **hidráulica** (A-111 → A-118, A-122 → A-128) y la
  **de arquitectura de apertura** (A-131, A-132, A-133). Solo se encuentran en A-074 (daylight) y en el
  tiempo de ciclo.
- **A-129, A-130, A-134, A-135, A-137 son auditorías de cierre**: corren al final, sobre el diseño ya
  resuelto, y ninguna alimenta a otra.
- **A-063 y A-064** pueden correr en paralelo: los dos dependen de A-062 y ninguno del otro.

## El único gate de compra del tomo

§4.3 lo dice sin adornos: *"any mistakes in the mold base selection can **consume significant time and
expense**"*. Traducido al grafo: **A-072 no se libera hasta que A-069, A-070, A-071 y los cuatro semáforos
A-073…A-076 estén en verde** — y A-076 depende de A-099, que está hasta el final del cap. 5. En la
práctica eso significa que **no se puede ordenar el mold base sin haber corrido el análisis de
llenado completo.**

---

# COBERTURA EN CÓDIGO

**78 análisis. 31 los tenemos, 32 están a medias, 14 faltan, y 1 está implementado al revés.**

| Capítulo | Análisis | SÍ | PARCIAL | FALTA | CONTRADICE |
|---|---|---|---|---|---|
| 4 · Arquitectura | A-060 … A-081 (22) | 10 | 9 | 3 | 0 |
| 5 · Llenado | A-082 … A-107 (26) | 9 | 11 | 6 | 0 |
| 6 · Alimentación | A-108 … A-137 (30) | 12 | 12 | 5 | 1 |
| **Total** | **78** | **31** | **32** | **14** | **1** |

### Lo que FALTA por completo (14)

`A-067` altura total del core para compra · `A-078` factores de costo con Brinell · `A-081` proveedor ·
`A-084` gradiente dP/dL · `A-085` **Cross-WLF** · `A-095` **curva P(h) y espesor mínimo** ·
`A-099` **el max(llenado, empaque) del tonelaje** · `A-106` costo del flow leader ·
`A-107` **contraste contra simulación** · `A-118` barrido V(ΔP) · `A-119` **balanceo de molde familia** ·
`A-123` n_turns y residencia del hot runner · `A-129` monotonía de diámetros · `A-135` longitud/ramas
como criterio de layout.

### Lo que hay que arreglar antes que agregar nada (por impacto / costo)

1. **`A-136` — nuestro código dimensiona con la regla que el libro RECHAZA.**
   `src/forja/mold/feed-layouts.ts` usa `D_down = D_up/sqrt(n)` como "Eq 6.1" válida en
   `layoutBranched`, `layoutRadial`, `layoutHybrid` y `layoutForGrid`, y hasta la narra como paso. El
   libro dice *"the resulting designs are inferior"*. **Contradicción activa con la fuente**, y el
   sustituto (A-116 + A-117) ya existe en `feed.ts`. Es el arreglo más barato de mayor impacto.
2. **`A-096` — el bug de contabilidad del área proyectada.** `dfm-mesh.ts :: projectedAreaMm2` la
   calcula bien (descontando ventanas), `revisar-modelo.ts` la rellena en el spec, y
   `moldmachine.ts :: clampFor` / `physicalDesign` **la ignoran** y usan `L×W` del bbox. Dato bien
   calculado que no llega al juez — el mismo patrón que ya cazamos en los contratos.
3. **`A-098` + `A-099` — el piso de 50 MPa no muerde y el `max` no existe.** Hoy el piso es una
   ADVERTENCIA de reporte (`cav < 50 ? 'ADVIERTE'`), no un `Math.max(cav, 50)` antes de calcular; y la
   rama de empaque no se calcula, así que nunca hay un máximo que tomar. El tonelaje que le damos al
   usuario **no es el que Kazmer calcularía**.
4. **`A-089` + `A-093` — la cadena del cap. 5 está descableada en dos puntos.** `convergeVelocityTraced`
   produce la velocidad correcta y `feed.ts` la ignora (`tFill = o.fillTimeS ?? 1`); `fillingPressure`
   existe y `layflat.ts` nunca la llama (acumula resistencia en mm-eq y no convierte a MPa). Tenemos
   las piezas y no están soldadas.
5. **`A-085` — sin Cross-WLF, A-082 no sirve de nada.** Toda la palanca del mid-range de temperatura
   (dejarle margen al moldeador en las dos direcciones) es puramente decorativa mientras la viscosidad
   no dependa de la temperatura.
6. **`A-134` — dos verdades en el mismo repo.** `threeplate.ts :: suckerPinDesign.depthMm = 0.8·D`
   contra `lamina-compuerta.ts :: agregaSucker (hs = D/2)`, que es el valor del libro. Y falta la
   orientación angular de las ranuras, que es justo la cota que decide el ciclo automático.

### Donde el código está MEJOR que el corpus

`A-088`. `src/forja/mold/filling.ts :: recommendedVelocity` implementa la Ec 5.23 **con raíz cuadrada**
y reproduce exacto la escalera del libro; `libro-caps4-6.md` R-042 la transcribe **sin raíz**, lo que
daría 0.47 m/s en vez de los 0.69 del propio ejemplo. Vale la pena corregir el pliego original.

---

# DEFECTOS DEL CORPUS DERIVADO DETECTADOS

Tres, y conviene anotarlos porque el tomo original ya no existe para arbitrar:

1. **Ec 5.23 sin raíz** (`libro-caps4-6.md` R-042). **Resuelto por reconstrucción numérica**: solo la
   forma `v = sqrt( 5*(Tmelt-Twall)*kappa / (3*mu) )` reproduce los 2000 1/s → 120 Pa·s → 0.69 m/s del
   propio libro. Nuestro código ya la tiene bien.
2. **Ec 5.33 con radical ambiguo.** Ya lo declara y corrige el propio `pliego-caps4-6.md`: la razón de
   longitudes va SIN raíz y solo la de viscosidades bajo raíz (2 mm × 210/280 = 1.5 mm; con la raíz
   sobre todo saldría 1.73 y no cuadra). Nuestro `flowleaders.ts` ya la tiene bien.
3. **Coeficiente del t_c cilíndrico: 0.692 (corpus) contra 1.60 (nuestro código).** `feed.ts` declara
   el 0.692 de la Tabla 6.2 como errata y usa 1.60; el 0.692 sí se usa, pero con T_no_flow, en el
   freeze del gate. **NO RESOLUBLE con el corpus derivado**: haría falta la Tabla 6.2 completa del
   cap. 6 y la difusividad del ejemplo, que no están. Queda como pendiente declarado.

---

# NO OBSERVADO EN EL CORPUS

Lo que este pliego **no pudo** extraer porque el corpus derivado no lo capturó. No es un fracaso: es
la lista exacta de qué volver a leer si el tomo reaparece.

**Ecuaciones nombradas pero no transcritas.** El corpus las cita por número y da su resultado, sin la
expresión completa: **Ecs 5.8–5.12** (Cross-WLF), **5.14** (perfil parabólico), **5.19** (perfil power
law), **5.26** (la forma integral del tonelaje con cos θ), **6.5** y **6.8** (formas power law de ΔP y
del solver de radio), **6.15** (anular power law). Se pueden implementar de la literatura estándar,
pero entonces **dejan de ser LITERALES del libro** y hay que declararlo.

**Tablas incompletas.**
- **Tabla 4.1**: tenemos las 5 filas y las 3 columnas con sus materiales, pero el umbral de la columna
  intermedia es solo "moderado" — sin número.
- **Tabla 6.3**: tenemos los cuatro porcentajes de eficiencia (100 / 87.9 / 78.5 / 61.2) y `Dh = 4A/p`,
  pero **no las fórmulas de Dh por perfil** que el libro tabula (las que llevan horneado el taper de 5°).
- **Tabla 6.2 del cap. 6** (tiempos de enfriamiento): las dos formas cerradas están, pero no la tabla
  completa ni la difusividad usada en el ejemplo — de ahí el punto 3 de la sección anterior.
- **Tabla 5.1**: tenemos las cinco filas de números, pero de las **seis causas de la discrepancia** solo
  tenemos la enumeración (shear heating en runners, transductor, slip en pared, lote de material,
  caracterización, otras), sin el desarrollo de ninguna.

**Criterios enumerados sin desarrollo.**
- Los **7 criterios de selección de proveedor** (§4.3.4) están listados, pero solo tres traen cota
  verificable (SLA, calidad de recepción, unidades). Los otros cuatro son títulos.
- Las **5 configuraciones de manifold** de hot runner (barra recta, "X", "H", stack, "seven leg
  special", §6.3.3) aparecen nombradas y **sin ningún criterio de selección** — el libro delega en
  *"consult with multiple hot runner suppliers"*, pero seguramente hay más texto.
- Las **Figs 4.25, 4.26 y 4.27** (difusividad vs fatiga, tasa de maquinado vs Brinell, y el scatter
  f_making vs f_operating) se describen pero **sin ejes ni valores**: no se puede reproducir el scatter
  que A-078 necesita.

**Zonas que el propio corpus declara fuera de este tomo** (y que por lo tanto NO son huecos de la
extracción, sino del recorte): venteo más allá de "pon vents en el last-to-fill" (caps. 7–8),
dimensionado de gates (cap. 7), enfriamiento detallado (cap. 9), expulsión (cap. 11), estructura
(cap. 12), split cavity §13.9.1, melt control §13.6.4, propiedades de los Apéndices A y B, y la
derivación de la Ec 5.23 del Apéndice F.

**Un hueco de método, no de dato.** El libro razona con **cuatro piezas** (taza, tapa, bezel,
contenedor) y el corpus conserva sus números. Lo que **no** conserva es cómo Kazmer decide *cuándo un
análisis se puede saltar*. Aparece una sola vez, en §5.5.2, autorizando despreciar costillas y bosses
*"very likely to fill"*, y otra en §6.4.3 con el bore cónico. Sospecho que hay más autorizaciones de
ese tipo repartidas en el texto — son valiosísimas para un software, porque son la diferencia entre
un análisis que corre y uno que exige datos que nadie tiene. `NO OBSERVADO EN EL CORPUS`.

