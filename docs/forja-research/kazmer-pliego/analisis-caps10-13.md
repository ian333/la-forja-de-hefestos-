# EL PLIEGO DE ANÁLISIS — Kazmer caps. 10–13
## Ingeniería inversa del modelo mental: qué se calcula, en qué orden, y qué decide

**Fecha:** 2026-08-06 · **Alcance:** cap. 10 (contracción y alabeo), cap. 11 (expulsión),
cap. 12 (estructural), cap. 13 (tecnologías de molde) y los Apéndices A–F.

---

## Por qué existe este documento

El libro de Kazmer **no tiene** un capítulo llamado "análisis a realizar". Tiene a un ingeniero
razonando en voz alta. Cada vez que compara, despeja, sustituye un número o dicta un veredicto,
eso es un análisis — y el grafo que los conecta lo da por obvio porque lo tiene en la cabeza.
Este pliego lo vuelve explícito.

Ya se hicieron dos lecturas del mismo corpus con otras lentes:
- **UI** — `pliego-UI-v2.md`, `pliego-caps10-13.md`, `libro-caps10-13.md` (qué pantallas hacen falta).
- **Verificación visual** — `verificaciones-visuales.md`, 122 fichas (qué se juzga MIRANDO).

Ésta es la tercera: **ANÁLISIS** (qué se calcula, con qué entra, qué sale, y qué decide).
Este tomo es la continuación de `analisis-caps7-9.md`; los cuatro tomos se leen como un solo
documento y comparten numeración corrida.

## Qué cuenta como "análisis" aquí

Unidad de razonamiento que **toma datos, produce un número o un veredicto, y alimenta una decisión**.
Si no alimenta ninguna decisión, es lección, no análisis, y no tiene ficha.

Cada ficha lleva nueve campos fijos:

| Campo | Qué contiene |
|---|---|
| **ID y nombre** | `A-nn`, numeración corrida a lo largo de los cuatro tomos |
| **CUÁNDO** | en qué momento del flujo se corre |
| **ENTRADAS** | y de qué análisis vienen (`←A-nn`) — esto es lo que arma el grafo |
| **EL CÁLCULO** | ecuación literal con su número de ecuación del libro; si es cualitativo, se dice |
| **SALIDA** | con unidades |
| **DECIDE** | la decisión concreta que alimenta |
| **CRITERIO** | umbral del libro / comparación / juicio humano — se declara CUÁL de los tres |
| **INVALIDA** | qué lo tira a la basura y obliga a recorrerlo |
| **¿TENEMOS?** | archivo y función en `src/forja/mold/`, o **FALTA** |

### Numeración

Este tomo arranca en **A-60**. Los IDs **A-01…A-59 quedan reservados** para los tomos de
caps. 1–9 (`analisis-caps7-9.md` y el que falta de caps. 1–6). Si al juntar los tomos sobran
huecos, se dejan: un hueco es barato, una colisión de IDs rompe el grafo.

### Empalme con `analisis-caps7-9.md` (no duplicar)

El tomo de caps. 7–9 ya fichó **los dos análisis del cap. 10 que cierran el argumento del cap. 9**.
Aquí van como **enlaces**, no como fichas nuevas, y no cuentan en el total de este tomo:

- **[enlace C10-a] Contracción lineal recomendada** — el número que escala el acero. Es el destino
  de la cadena PvT (A-60 → A-63) y la entrada de A-65/A-68/A-70 y de toda la expulsión (A-81).
  Ficha completa en `analisis-caps7-9.md`.
- **[enlace C10-b] Alabeo por gradiente A TRAVÉS DEL ESPESOR** (Ecs. 10.17–10.18) — el cierre del
  cap. 9: `R_warpage = 2h/(s_core − s_cavity)`, `delta = W·sin(W/R)`; el bezel con **2 °C** de
  diferencia núcleo↔cavidad da **1.6 mm**, más que la contracción total borde a borde (0.8 mm), y
  *"this warpage estimate is not sensitive to the overall temperature of the molding, but only to
  the temperature gradient through the thickness."* Ficha completa en `analisis-caps7-9.md`.
  **Tratamiento de la errata:** ver la sección ERRATAS al final — el "1050 mm" impreso es el typo,
  el bueno es **R = 9050 mm**, y el seno se evalúa en **radianes**. Nuestro `warpage.ts` ya lo
  codifica así y lo documenta en su encabezado.

En este tomo, C10-a y C10-b aparecen en el GRAFO como nodos, para que la cadena no quede rota.

## Fuente y su límite (regla dura)

Los tomos crudos del libro **ya no existen** (se perdieron en una limpieza de disco). Este pliego se
construyó sobre el corpus DERIVADO, que sí conserva **citas literales verificadas con grep**:
`libro-caps10-13.md`, `pliego-caps10-13.md`, `verificaciones-visuales.md` (fichas V10.x/V11.x/V12.x/
V13.x + apéndice de erratas) y `cruce.md`.

- **Toda cita entre comillas de este documento existe textualmente en el corpus.** Verificado con
  `grep -rF` archivo por archivo.
- Lo que no es cita y es deducción mía va marcado **`INFERIDO`**.
- Lo que sospecho que el libro dice y el corpus derivado **no capturó** va marcado
  **`NO OBSERVADO EN EL CORPUS`** — es información útil (dice dónde volver a leer si el tomo
  reaparece), no un fracaso.

## Convenciones

- Fórmulas en ASCII. `s` = contracción lineal, `rv` = razón de volúmenes específicos, `sigma` =
  esfuerzo, `tau` = cortante, `delta` = deflexión/flecha, `phi` = diámetro (o ángulo de salida donde
  se diga), `lambda` = interferencia, `epsilon` = deformación unitaria, `mu` = coeficiente de fricción.
- **[LIBRO]** = umbral numérico explícito del libro · **[COMPARA]** = el criterio es una comparación
  entre dos análisis · **[JUICIO]** = Kazmer decide sin número (y lo dice).
- Las tres piezas de ejemplo del libro se citan por su nombre: **bezel** (marco de tablet, ABS
  Cycolac MG47, 240×160, pared 1.5 mm), **cup** (vaso, ABS, pared 3 mm) y **lid** (tapa, ABS,
  pared 2 mm).
- Rutas de código relativas a `src/forja/mold/` salvo que se diga otra cosa.

---

# CAPÍTULO 10 — CONTRACCIÓN Y ALABEO

> El capítulo es una **cadena de 7 pasos** que Kazmer numera él mismo (§10.1.1 a §10.1.7) y que
> termina, no en un número, sino en **un rango, una recomendación de proceso y un responsable
> firmando**. Después vienen dos validaciones (§10.2 uniformidad y steel-safe) y el alabeo (§10.3),
> que es donde el capítulo se conecta hacia atrás con el agua y hacia adelante con la expulsión.

### A-60 — Condiciones de proceso nominales
- **§** 10.1.1 · **CUÁNDO:** primer paso de la cadena de contracción, en cuanto hay material elegido
  y el análisis de llenado ya entregó la presión de inyección.
- **ENTRADAS:** rango de melt del proveedor (Apéndice A) · rango de refrigerante (Apéndice A) ·
  presión de llenado ←`analisis-caps4-6` (§5.5.2; el ejemplo del bezel: 83 MPa).
- **CÁLCULO:** tres reglas de dedo, no ecuaciones. `T_melt = punto medio del rango del proveedor`
  (*"the melt temperature is equal to the mid-range temperature recommended from the material
  supplier"* → ABS Cycolac MG47 = 239 °C); `P_pack = 0.80 · P_llenado` (*"a common molding practice
  is that the packing pressure is initially set to 80% of the pressure required to fill the mold"* →
  83 → 66 MPa); `T_molde = punto medio del rango de refrigerante` (*"The mold temperature is also
  assumed to be at the middle of the recommended range for the coolant temperature"*).
- **SALIDA:** `(T_melt [°C], P_pack [MPa], T_molde [°C])` — el punto de operación nominal.
- **DECIDE:** el punto (T,P) en el que se evalúa TODA la cadena PvT. Sin esto no hay contracción.
- **CRITERIO:** [LIBRO] tres defaults citados, los tres editables. No hay veredicto: es el arranque.
- **INVALIDA:** cambiar de material; que el análisis de llenado entregue otra `P_llenado`; que el
  molder declare sus condiciones reales (A-67 lo puede sobreescribir).
- **¿TENEMOS?** **Parcial.** `shrinkage.ts:shrinkageRecommendation()` aplica el 0.80·P_llenado
  literal (`const pNom = 0.8 * o.fillMPa * 1e6`) y recibe `tNoFlowC`/`tMeltC`. Los puntos medios de
  rango del proveedor **no se derivan de una tabla de rangos**: se pasan a mano. FALTA el campo
  "rango melt min/max" y "rango refrigerante min/max" en la BD de plásticos.

### A-61 — Volumen específico PvT (Tait doble dominio)
- **§** 10.1.2, Ecs. 10.2–10.6 · **CUÁNDO:** inmediatamente después de A-60; es el motor de todo el
  capítulo.
- **ENTRADAS:** coeficientes `b1m..b4m`, `b1s..b4s`, `b5`, `b6` (y `b7..b9` si es semicristalino) del
  Apéndice A · `T [K]`, `P [Pa]` ←A-60.
- **CÁLCULO:** `Tt(P) = b5 + b6·P`; si `T > Tt(P)` usa coeficientes de **melt**, si no de **solid**;
  `v0 = b1 + b2·(T − b5)`, `B = b3·exp(−b4·(T − b5))`,
  `v(T,P) = v0·[1 − C·ln(1 + P/B)] + vT`, con `C = 0.0894` (constante universal de Tait) y `vT = 0`
  en amorfos. Ejemplo del bezel: no-flujo 405 K > `Tt(66 MPa)` = 386 K ⇒ **coeficientes de melt**.
- **SALIDA:** `v [m^3/kg]` — y de ahí `rho = 1000/v` (Ec. 10.7), CVTE (Ec. 10.8) y compresibilidad
  `beta` (Ec. 10.9).
- **DECIDE:** nada por sí solo — alimenta A-62 y A-63. Es la función que hace posible el capítulo.
- **CRITERIO:** [LIBRO] la **elección de dominio** es el veredicto interno: melt vs solid según
  `T` contra `Tt(P)`. Se muestra cuál usó y por qué.
- **INVALIDA:** material sin coeficientes Tait tabulados; grado con relleno que no tiene PvT propio
  (→ A-73 lo declara aproximación).
- **¿TENEMOS?** **SÍ.** `shrinkage.ts:specificVolume()` + `transitionT()`, con `ABS_TAIT` (los
  coeficientes del bezel: b5 370.6, b6 2.3e-7, b1m 9.83e-4…). La rama semicristalina `b7/b8/b9`
  está implementada. **Falta la BD completa de los 16 materiales del Apéndice A** — hoy solo hay ABS.

### A-62 — Gate de sanidad del modelo PvT contra el dato del proveedor
- **§** 10.1.2 · **CUÁNDO:** justo después de A-61, ANTES de usar el PvT para nada.
- **ENTRADAS:** `v(20 °C, 0 MPa)` ←A-61 · densidad de ficha del proveedor.
- **CÁLCULO:** `rho_calculada = 1000/v` a 20 °C y 0 MPa; comparar contra la del proveedor. En el
  libro: **1047 vs 1044 kg/m³** → *"compares well"*.
- **SALIDA:** `rho_calc [kg/m³]`, `rho_prov [kg/m³]`, brecha relativa [%].
- **DECIDE:** seguir o parar. Si el PvT no reproduce la densidad conocida, los coeficientes están
  mal transcritos o son de otro grado, y todo lo de abajo es basura.
- **CRITERIO:** [COMPARA] no hay umbral numérico en el libro; el juicio es *"compares well"* sobre
  una diferencia de ~0.3 %. `INFERIDO`: codificar el gate con un umbral declarado (p. ej. 1 %) y
  decir que el umbral es NUESTRO, no del libro.
- **INVALIDA:** cambiar de grado de material sin cambiar la densidad de referencia.
- **¿TENEMOS?** **FALTA.** `shrinkage.ts` calcula `v` pero no hay comparación contra densidad de
  proveedor, ni campo de densidad de ficha para contrastarla. Es un gate barato y de alto valor.

### A-63 — Contracción volumétrica del ciclo
- **§** 10.1.3, Ecs. 10.10–10.11 · **CUÁNDO:** tercer paso, con el PvT ya validado.
- **ENTRADAS:** `P_pack` ←A-60 · `T_no-flujo` del material (Apéndice A) · `v(T,P)` ←A-61 ·
  estado de uso final (20 °C, 0 MPa).
- **CÁLCULO:** atajo autorizado por el libro — *"a more simple approach is to assume that the melt
  temperature at the end of the packing stage is equal to the no-flow melt temperature"*.
  `dv = v(T_noflow, P_pack) − v(20 °C, 0)` ; `rv = v(20 °C, 0) / v(T_noflow, P_pack)`.
- **SALIDA:** `dv [m^3/kg]` y `rv` (adimensional).
- **DECIDE:** alimenta directo la contracción lineal (C10-a) y la rama anisotrópica (A-64).
- **CRITERIO:** [LIBRO] el atajo `T_fin_pack = T_no-flujo` sustituye al perfil térmico del cap. 9.
  Se declara como supuesto, no como verdad.
- **INVALIDA:** si el usuario decide calcular el perfil térmico real (cap. 9) en vez del atajo, este
  análisis se rehace con otra `T`; también lo invalida cambiar `P_pack`.
- **¿TENEMOS?** **SÍ.** `shrinkage.ts:shrinkage()` devuelve `{vPack, vUse, rv, linear, moldScale}`,
  verificado contra el ejemplo del bezel (s = 0.31 %).

### A-64 — Contracción anisotrópica (LCP y reforzados con fibra)
- **§** 10.1.5, Ecs. 10.14–10.16 · **CUÁNDO:** en lugar de la lineal isotrópica cuando el material
  es LCP o lleva fibra de vidrio. *"Most unfilled plastics exhibit isotropic behavior"*, así que sin
  relleno esta rama no corre.
- **ENTRADAS:** `rv` ←A-63 · % en peso de fibra · `rho_resina`, `rho_fibra` (Tabla 10.1) · factor de
  anisotropía `a` (dato del usuario; el libro usa 0.5 en el Cycolac CRT3370 con 15 % de vidrio).
- **CÁLCULO:** fracción **volumétrica** `p = %peso · (rho_resina/rho_fibra)` → 15 % en peso ≈ **6 %
  en volumen**; el 94 % restante contrae como resina virgen ⇒ `dv_filled = 0.94 · dv_neat`. Luego la
  cúbica por punto fijo: `s = −[(rv−1) + (2+a)·s² − a·s³]/(2+a)`, semilla `s = 0`
  (*"an initial guess of zero shrinkage should suffice"*), *"The solution has converged after two
  iterations"* (0.352 % → 0.351 %).
- **SALIDA:** `s` transversal/en el espesor [%] y `a·s` en dirección de flujo [%].
- **DECIDE:** el molde se escala con DOS factores distintos según el eje — cambia la geometría del
  acero, no solo un número.
- **CRITERIO:** [LIBRO] converger por iteración visible, no resolver la cúbica analítica. Y `a` es
  dato: si no hay, se marca pendiente al proveedor.
- **INVALIDA:** que el proveedor entregue PvT del compuesto (entonces no hace falta prorratear);
  cambiar el % de relleno.
- **¿TENEMOS?** **FALTA.** `shrinkage.ts` solo tiene la rama isotrópica (`1 − cbrt(rv)`). No hay
  fracción volumétrica de fibra, ni el 0.94, ni la iteración, ni el eje de flujo.

### A-65 — Banda de contracción (límites inferior y superior)
- **§** 10.1.6 · **CUÁNDO:** después de tener el nominal; es **un paso propio del libro**, no un
  adorno.
- **ENTRADAS:** `P_llenado` ←`analisis-caps4-6` · `T_no-flujo`, `T_melt` ←Apéndice A · el motor PvT
  ←A-61/A-63.
- **CÁLCULO:** dos escenarios extremos.
  Límite **INFERIOR** de contracción (pack largo y fuerte): *"A practical upper limit for the packing
  pressure may be the greater of 120% of the injection pressure or 100 MPa"* ⇒
  `P_pack_max = max(1.2·P_inj, 100 MPa)`.
  Límite **SUPERIOR** (pack corto y flojo, fundido caliente): *"a low packing pressure (equal to the
  lesser of 40% of the injection pressure or 30 MPa) and a high melt temperature (equal, perhaps, to
  the temperature half-way between the no-flow temperature and the melt temperature)"* ⇒
  `P_pack_min = min(0.4·P_inj, 30 MPa)` y `T = (T_noflow + T_melt)/2`.
- **SALIDA:** `[s_min, s_nominal, s_max]` [%] y su ancho (span).
- **DECIDE:** (a) si el molde tiene ventana de proceso para entrar a especificación; (b) si el rango
  sale muy ancho (el libro: 0.3 % vs 1.9 %), la salida deja de ser un número y se vuelve una
  **recomendación de proceso**: *"The mold designer should suggest an extended packing stage with
  higher packing pressures"*.
- **CRITERIO:** [LIBRO] los dos límites de presión son literales. El "muy ancho" es [JUICIO].
- **INVALIDA:** cambio de `P_llenado` (retorno desde alimentación) o de material.
- **¿TENEMOS?** **SÍ.** `shrinkage.ts:shrinkageRecommendation()` implementa los dos límites
  literales y el `spanPct`; `mold-contratos.ts:contratoContraccion()` lo audita como `contr-rango`.
  El umbral de "ancho excesivo" (`spanPct > 3·nominal`) es NUESTRO y así está comentado.

### A-66 — Alarma de sobre-empaque (s ≤ 0)
- **§** 10.1.6 · **CUÁNDO:** sobre la salida de A-65, siempre.
- **ENTRADAS:** `s_min` y `s_nominal` ←A-65.
- **CÁLCULO:** comparación pura: `s <= 0` ⇒ sobre-empaque.
- **SALIDA:** veredicto booleano + el valor negativo (el ejemplo del libro llega a −0.2 %).
- **DECIDE:** bajar la presión de empaque, o rechazar esa ventana de proceso. Y en la UI: **prohibir
  que un optimizador minimice contracción**.
- **CRITERIO:** [LIBRO] literal y contraintuitivo: *"some shrinkage is desirable so that the plastic
  molding will shrink away from the walls of the cavity and onto the core so the molding can be
  ejected"* — con contracción cero la pieza no suelta de costillas ni bosses.
- **INVALIDA:** nada lo invalida; es un gate permanente sobre A-65.
- **¿TENEMOS?** **SÍ, y bien.** `shrinkage.ts` emite la nota y `mold-contratos.ts` la codifica como
  `contr-positiva`, con la distinción fina (nominal ≤ 0 = VIOLA; solo el extremo del rango ≤ 0 =
  ADVIERTE) que el libro insinúa al hablar de diseñar **y** operar.

### A-67 — Recomendación final de contracción y asignación de responsabilidad
- **§** 10.1.7 · **CUÁNDO:** último paso de la cadena; **gate de liberación** hacia el escalado del
  acero.
- **ENTRADAS:** `s_nominal` y banda ←A-65 · dato del proveedor · datos de molde prototipo · medidas
  de moldes previos + entrevista al molder · simulación numérica ←A-69.
- **CÁLCULO:** **CUALITATIVO**. Tres objetivos simultáneos: (1) cercano a la contracción real;
  (2) que el molde pueda operarse en un **rango** de condiciones y aún así entrar a especificación;
  (3) maquinado steel-safe, alterable. Y la regla dura: *"should not be used in isolation given the
  potential for error"* — el análisis **verifica** a las otras fuentes, no decide solo.
  La entrevista es parte del método: *"the mold designer should inquire with the molder"* si hubiera
  preferido otras temperaturas/presiones, y en tal caso pedirle piezas moldeadas en **sus**
  condiciones aunque salgan fuera de especificación, y calcular la contracción de ésas.
- **SALIDA:** `s_recomendada [%]` + fuente de confrontación usada + **nombre del responsable**.
- **DECIDE:** el número que escala cavidad y corazón (A-68) y que viaja hasta la expulsión (A-81).
  Y si nadie firma, la salida es **proyecto de molde prototipo**.
- **CRITERIO:** [JUICIO] humano, con obligación de registrar contra cuál de las 4 fuentes se
  confrontó. **ENTREGABLE: acta de contracción.**
- **INVALIDA:** que llegue un dato mejor (tryout, prototipo) — y entonces se re-escala el acero
  (A-68) con todo lo que eso arrastra río abajo.
- **¿TENEMOS?** **Parcial.** `mold-contratos.ts` tiene `contr-responsable` (§10.1.7) y
  `expediente.ts:decisionesDelPaquete()/registrarDecision()` levanta el acta con firma y fecha. Lo
  que **FALTA** es el registro estructurado de **cuál de las 4 fuentes** se usó y su dato, para poder
  auditar la confrontación (hoy solo se registra que hay responsable).

### A-68 — Escalado del acero desde la contracción
- **§** 10.1 (Ec. 10.1) · **CUÁNDO:** en cuanto A-67 entrega el número; antes de liberar a maquinado.
- **ENTRADAS:** `s_recomendada` ←A-67 · dimensiones nominales de la pieza · tolerancias
  (Tabla 2.6: general típica ±0.4 %, apretada ±0.1 %).
- **CÁLCULO:** `s = 1 − L_pieza/L_cavidad` y su despeje `L_cavidad = L_nominal/(1 − s)`
  (100 mm al 0.5 % → cavidad 100.5 mm).
- **SALIDA:** factor de escala del molde (adimensional) y las cotas de acero [mm].
- **DECIDE:** la geometría real que se maquina.
- **CRITERIO:** [LIBRO] check duro: un `s` de 0.5 % **sin compensar** saca la pieza de tolerancia
  tanto en ±0.4 % como en ±0.1 %. La cavidad debe estar escalada antes de liberar a maquinado.
- **INVALIDA:** cambiar `s` (A-67) invalida superficies, tooling-split, planos y cotización.
  **Es el retorno más caro del capítulo.**
- **¿TENEMOS?** **SÍ.** `shrinkage.ts` devuelve `moldScale = 1/(1 − s)`; el paquete lo transporta
  (`pkg.diseno.contraccion.moldScale`) y `mold-contratos.ts` lo imprime en `contr-steel-safe`.

### A-69 — Mapa de contracción NO uniforme (validación por simulación)
- **§** 10.2.1 · **CUÁNDO:** después del cálculo a mano, como validación; requiere simulación de
  llenado/empaque.
- **ENTRADAS:** geometría de cavidad · sistema de alimentación (nº y posición de compuertas)
  ←`analisis-caps4-6` · perfil de presión de empaque.
- **CÁLCULO:** campo `s(x,y)` sobre la cavidad. Hallazgos del bezel: ~0.3 % en zonas delgadas que
  congelan a alta presión, ~0.6 % en el grueso, **>1 %** cerca del fin de llenado (la compuerta
  congela y corta la presión). Con 4 compuertas en vez de 2: máximo **1.1 % → 0.9 %**, promedio
  **0.6 % → 0.5 %**.
- **SALIDA:** mapa `s(x,y)` [%] y sus estadísticos: **rango (max − min)**, desviación estándar,
  **% de área por encima de 1 %**.
- **DECIDE:** entre dos estrategias — (A) asignar contracción **distinta por región** (habilitado por
  CNC + simulación, pero *"complex and risky"* en geometría interconectada) o (B) **más compuertas**
  para uniformar (la más común). También alimenta A-71 (perfilado de pack como alternativa gratis).
- **CRITERIO:** [COMPARA] el libro **nunca da umbral absoluto**: juzga por **uniformidad**. La ficha
  V10.3/V10.4 lo dice explícito: nuestro juez debe hacer lo mismo.
- **INVALIDA:** cualquier cambio en el feed system o en el perfil de empaque.
- **¿TENEMOS?** **FALTA como mapa de contracción.** Tenemos motor de llenado (`flowlen*.ts`,
  `filling.ts`) y mapas de longitud de flujo, pero no un campo `s(x,y)` derivado de presión local
  ni sus estadísticos de uniformidad. Es la brecha grande del cap. 10.

### A-70 — Sesgo steel-safe de cavidad y corazón
- **§** 10.2.2 · **CUÁNDO:** al escalar el acero (junto con A-68), como decisión declarada.
- **ENTRADAS:** `s_esperada` ←A-67 · banda ←A-65 · cronograma de construcción del molde.
- **CÁLCULO:** definición operativa: *"purposefully designed so that they can be enlarged by removing
  existing mold metal"*. Receta numérica del libro para `s_esperada = 0.5 %`: **cavidad con 0.4 %,
  corazón con 0.6 %** (cavidad más chica, corazón más grande = metal de reserva).
- **SALIDA:** dos factores de escala distintos (cavidad y corazón), o uno solo, según la opción.
- **DECIDE:** una de tres, y queda registrada con su porqué:
  (A) **asimétrico** — deja acero de reserva pero **garantiza retrabajo**, porque el nominal sale
  fuera de tolerancia a propósito;
  (B) **valor medio constante** — *"many mold designers prefer to use a constant but mid-range
  estimate of the shrinkage"* y confían en que el molder ajuste proceso;
  (C) **despliegue por etapas** — dejar bosses, snap-fits y detalles críticos **semi-acabados** hasta
  caracterizar la contracción en tryout. Alarga el build, baja el riesgo. Es una decisión de
  **cronograma**, no de geometría.
- **CRITERIO:** [JUICIO] el libro presenta las tres y NO elige. El software tampoco debe elegir.
- **INVALIDA:** que el tryout entregue la contracción real (entonces se remueve el acero de reserva
  y la opción C se resuelve).
- **¿TENEMOS?** **Parcial — SÍ para A y B.** `mold-contratos.ts:contr-steel-safe` presenta las dos escuelas con
  sus factores calculados y deja escrito que **ninguna de las dos es el default** (frase nuestra, no
  del libro); `expediente.ts` la levanta como
  decisión firmable. **FALTA la opción C** (features semi-acabados con su impacto en cronograma) —
  no hay estado "semi-terminado" en el modelo de features.

### A-71 — Sensibilidad de la contracción al proceso y perfilado de empaque
- **§** 10.2.3 · **CUÁNDO:** cuando A-69 muestra contracción despareja y hay que decidir si se corrige
  con acero o con proceso.
- **ENTRADAS:** el motor PvT ←A-61 · las cinco perillas: tiempo de empaque, presión de empaque,
  temperatura de barril, temperatura de refrigerante, tiempo de enfriamiento.
- **CÁLCULO:** barrido de sensibilidad (Fig. 10.11). Orden y notas literales: *"Both packing time and
  cooling time are significant but have a small effect on shrinkage when sufficient packing and
  cooling times are used"*; *"The coolant temperature has a slightly greater effect than the barrel
  temperature, because it more directly controls the temperature of the molding upon ejection"*.
  Y el perfilado: presión alta al inicio (reduce contracción lejos de la compuerta), luego bajar
  conforme congela el material cerca de la compuerta (evita sobre-empaque).
- **SALIDA:** ranking de sensibilidad (d s / d perilla) y, para el perfilado, el mapa `s(x,y)`
  resultante.
- **DECIDE:** corregir por **proceso** (gratis) en vez de por **acero** (caro). El libro dice que el
  perfilado alcanza casi lo mismo que 4 compuertas sin gastar, y remata que pocos molders lo usan.
- **CRITERIO:** [COMPARA] el criterio es literalmente **parecerse a otro mapa**: el del molde de 4
  compuertas (Fig. 10.9). La ficha V10.7 lo formaliza como diferencia campo a campo entre mapas.
- **INVALIDA:** que el molder no tenga máquina con perfilado de presión.
- **¿TENEMOS?** **FALTA.** Ni barrido de sensibilidad ni perfil de empaque como entrada del PvT.
  Es barato de hacer sobre `shrinkage.ts` (ya es puro y determinista) y da la lección completa.

### A-72 — Bandera de semicristalino
- **§** 10.2.4 · **CUÁNDO:** al elegir material, antes de comprometer tolerancias.
- **ENTRADAS:** clase del polímero (amorfo/semicristalino) · PvT ←A-61 (la rama `b7..b9`) ·
  tolerancia especificada (Tabla 2.6).
- **CÁLCULO:** el salto de fase del semicristalino (acetal: `v` 0.77 → 0.69, `rv` 0.90) da
  `s ≈ 3.5 %` contra ~0.5 % de los amorfos, con mayor sensibilidad al proceso.
- **SALIDA:** `s` esperada [%] + bandera de riesgo.
- **DECIDE:** si la combinación (semicristalino + tolerancia apretada) exige **molde prototipo**
  antes de comprometerse.
- **CRITERIO:** [LIBRO] no hay umbral, hay contraste de órdenes (3.5 % vs 0.5 %) más el enunciado de
  que las altas contracciones *"tend to be more difficult to control to tight tolerances"*.
- **INVALIDA:** cambio de material.
- **¿TENEMOS?** **Parcial.** El motor `specificVolume()` soporta `b7/b8/b9`, pero no hay ningún
  material semicristalino cargado ni la bandera cruzada con la tolerancia del spec. FALTA la regla.

### A-73 — Corrección por rellenos sin PvT propio
- **§** 10.2.5, Tabla 10.1 · **CUÁNDO:** material con carga y sin PvT del compuesto.
- **ENTRADAS:** tipo y % de relleno (Tabla 10.1: negro de humo 2000 kg/m³ CTE 0.5 · perla de vidrio
  2600/3 · **fibra de vidrio 2600/3, la única con anisotropía significativa** · mica 2800/10 · hule
  1500/80) · PvT de la resina virgen ←A-61.
- **CÁLCULO:** prorrateo volumétrico de §10.1.5 aplicado sobre la resina neat (ver A-64). El CTE del
  relleno (~5e-6) contra el del plástico (~100e-6) hace que los rellenos **reduzcan** la contracción
  y **aumenten** la dimensión de la pieza; el hule es la excepción (CTE 80).
- **SALIDA:** `s` corregida [%] **marcada como aproximación declarada**.
- **DECIDE:** si se puede seguir sin pedir PvT del compuesto al proveedor.
- **CRITERIO:** [LIBRO] es un método autorizado con etiqueta de aproximación, no un resultado.
- **INVALIDA:** que llegue el PvT del grado cargado.
- **¿TENEMOS?** **FALTA.** No hay Tabla 10.1 ni prorrateo (comparte la brecha con A-64).

### A-74 — Clasificación topológica de la región (¿área cerrada o marco?)
- **§** 10.3.1 · **CUÁNDO:** **antes** de evaluar el pandeo; es el gate que decide si A-75 corre.
- **ENTRADAS:** geometría de la pieza (conectividad — literalmente contar agujeros/ventanas).
- **CÁLCULO:** clasificación. *"When the molding consists of a single closed area, the material
  within the molding is in continuous contact such that any non-uniform shrinkage and stresses across
  the part may only be resolved through out of plane distortion of the part."* Contra el caso opuesto:
  *"the window in the laptop bezel mechanically decouples the various sides from each other, such
  that each side is free to shrink independently."*
- **SALIDA:** etiqueta `{marco | placa | mixta}` + fracción de interior vacío.
- **DECIDE:** si se aplica el criterio de pandeo (A-75) o si en su lugar solo se compara lado
  izquierdo contra derecho y arriba contra abajo.
- **CRITERIO:** [JUICIO] geométrico — y es el juicio que **ninguna fórmula da**: la topología decide,
  no el mapa de contracción. El par bueno/malo del libro es tapa cerrada (pandea) vs bezel con
  ventana (no pandea), con la misma contracción diferencial.
- **INVALIDA:** que el diseñador de producto abra o cierre una ventana (retorno a pieza).
- **¿TENEMOS?** **SÍ.** `warpage.ts:alabeoPorArea()` recibe `topologia: 'marco'|'placa'|'mixta'` y
  declara NO APLICABLE al marco; `dfm-mesh.ts` produce `warpageTopology` (tipo +
  `interiorEmptyFrac`) y `mold-contratos.ts:contr-warpage-topologia` lo audita, con estado
  `SIN-CABLEAR` cuando el dato no llega. La contabilidad está bien hecha.

### A-75 — Pandeo por contracción diferencial A TRAVÉS DEL ÁREA
- **§** 10.3.1, Ecs. 10.19–10.20 · **CUÁNDO:** después de A-74, si la región es área cerrada.
- **ENTRADAS:** `s_centro` y `s_borde` (evaluados con la presión local: centro empacado, borde no)
  ←A-61/A-69 · espesor `h` · semiancho `W` · topología ←A-74.
- **CÁLCULO:** criterio `(s_borde − s_centro) > 0.44·(h/W)²` ⇒ pandea. Flecha:
  `delta = sqrt(W² − [W·(1 − (s_borde − s_centro))]²)` (Ec. 10.20). Supone placa circular isotrópica
  con `nu = 0.4`, válido para casi todos los plásticos. Ejemplo de la tapa:
  `(1.66 % − 0.31 %) > 0.44·(2/40.5)²` → **0.0135 > 0.0011** ⇒ pandea, `delta = 6.6 mm`.
- **SALIDA:** veredicto pandea/no-pandea + `delta [mm]` + los dos lados de la desigualdad.
- **DECIDE:** si hay que emparejar el empaque (más compuertas / perfil), abrir el área, o añadir
  costillas someras que rigidicen (A-77).
- **CRITERIO:** [LIBRO] umbral literal `0.44·(h/W)²`. **Con ponderación del propio autor:** el
  ejemplo de la tapa **sobre-predice** porque asumió 0 MPa en el borde; el número es cota
  conservadora, no predicción. El libro se autocritica antes de actuar.
- **INVALIDA:** cambiar de gate (cambia el perfil de presión), abrir una ventana (cambia A-74),
  engrosar la pared.
- **¿TENEMOS?** **SÍ, completo.** `warpage.ts:alabeoPorArea()` implementa las dos ecuaciones, el gate
  topológico y **emite siempre la advertencia de sobre-estimación** con la cita del libro. La
  auditoría vive en `mold-contratos.ts:contr-warpage-topologia`.

### A-76 — Checklist de uniformidad anti-alabeo (diseño del molde)
- **§** 10.3.2, nivel 1 · **CUÁNDO:** como cierre del cap. 10 y **precondición** del diseño de agua y
  de alimentación.
- **ENTRADAS:** razón longitud de flujo/espesor ←`analisis-caps4-6` · resistencia y balance del feed
  system ←`analisis-caps4-6` · pitch de líneas de agua y conductividad de insertos
  ←`analisis-caps7-9` · uniformidad de espesor y filetes ←DFM de pieza.
- **CÁLCULO:** **CUALITATIVO**, cuatro puntos con semáforo. *"the most important strategy is to
  design a mold that will provide uniform melt temperatures"* (y presiones) en toda la cavidad:
  (1) evitar razones flujo/espesor altas usando múltiples compuertas; (2) feed system balanceado de
  baja resistencia; (3) máxima uniformidad de temperatura superficial con pitch de agua apretado e
  insertos conductivos donde haga falta; (4) espesor uniforme y filetes generosos.
- **SALIDA:** 4 semáforos.
- **DECIDE:** si el molde entra a construcción o vuelve a alimentación / agua / pieza.
- **CRITERIO:** [JUICIO] declarado como la estrategia #1 (*"By far, the most important strategy"* en
  el corpus está recortado a la forma citada arriba; se usa esa).
- **INVALIDA:** cualquier cambio en feed, agua o espesor de pared.
- **¿TENEMOS?** **Parcial y disperso.** Los cuatro puntos existen como criterios separados
  (`mold-contratos.ts`: `feed-*`, `agua-paso`, `agua-claro`; `dfm.ts` para espesor y filetes) pero
  **no existe el checklist §10.3.2 como veredicto único de anti-alabeo**. FALTA el agregador.

### A-77 — Escalera de remedios de alabeo, con su costo
- **§** 10.3.2, niveles 2 y 3 · **CUÁNDO:** cuando C10-b o A-75 dan alabeo fuera de tolerancia.
- **ENTRADAS:** veredicto de alabeo ←C10-b / A-75 · costo de modificar el molde vs costo de proceso.
- **CÁLCULO:** **CUALITATIVO**, en dos niveles ordenados.
  **Nivel 2 (proceso, sin tocar acero):** llenar lo más rápido posible; subir tiempo de empaque
  **hasta que el peso de la pieza deje de aumentar** (criterio medible); subir presión de empaque;
  perfilar la presión; usar **temperaturas de refrigerante distintas por lado del molde**; probar
  otros materiales y rellenos.
  **Nivel 3 (acero):** añadir compuertas (el más común) → RETORNO a alimentación; añadir **costillas
  someras** que suban rigidez y eviten el pandeo → RETORNO a pieza; **contornear la cavidad** para
  que la pieza alabee hacia la forma correcta — última opción, alto riesgo, porque los corrimientos
  por alabeo *"may exceed steel safe limits"* y los errores cuestan carísimo.
- **SALIDA:** remedio elegido + su costo + a qué fase regresa.
- **DECIDE:** el orden de intento: proceso antes que acero, siempre.
- **CRITERIO:** [JUICIO] con jerarquía explícita del libro y una advertencia de riesgo declarada en
  la tercera opción.
- **INVALIDA:** que el remedio elegido no cierre el alabeo → se sube un escalón.
- **¿TENEMOS?** **FALTA.** No hay escalera de remedios ni el enlace "alabeo → añadir compuerta"
  como retorno navegable. `contr-warpage-topologia` sugiere el remedio en texto, pero no lo ejecuta
  ni lo cotiza.

---
# CAPÍTULO 11 — SISTEMA DE EXPULSIÓN

> El cap. 11 declara su propio orden en §11.4: **planos de partición y direcciones → (si hay más de
> una dirección: planear core pulls/slides ANTES del detalle) → estimar fuerza → área y perímetro →
> tipo/número/tamaño/ubicación → detallar**. Cada paso con veredicto antes de avanzar. El dato de
> contracción del cap. 10 **entra aquí**: sin `s` no hay fuerza de expulsión.

### A-78 — Planos de partición y direcciones de expulsión
- **§** 11.2.1 (con §4.1) · **CUÁNDO:** paso 1 del subsistema, antes de cualquier número.
- **ENTRADAS:** geometría de la pieza · catálogo de undercuts (§2.3.7) · dirección de apertura
  ←`analisis-caps4-6`.
- **CÁLCULO:** **CUALITATIVO**. Sin socavados ⇒ un plano de partición. Con socavados internos o
  externos ⇒ planos adicionales + componentes actuados. Si la sección con socavados es muy grande, o
  si el exterior exige un plano de partición transversal a la apertura ⇒ split cavity (→A-127).
- **SALIDA:** número de planos de partición · lista de direcciones de expulsión · conteo de corazones
  móviles necesarios.
- **DECIDE:** si el molde es de desmoldeo recto o si necesita mecanismos — **y ése es el driver de
  costo del molde**.
- **CRITERIO:** [JUICIO] *"the number of moving cores should be minimized by simplifying the product
  design"* — la salida legítima incluye **regresar al diseñador de producto**.
- **INVALIDA:** cualquier cambio de geometría o de dirección de apertura.
- **¿TENEMOS?** **SÍ.** `parting.ts` + `dfm.ts` (detector de undercuts) + `moldtech.ts:
  chooseMoldTechnology()` mapea la característica que impide el desmoldeo recto a su tecnología
  §13.9/§11.3.6-7. El conteo de mecanismos como **driver de costo** vive en `moldcost-detailed.ts`.

### A-79 — Jerarquía de accionamiento del corazón móvil
- **§** 11.1.1 · **CUÁNDO:** en cuanto A-78 declara que hace falta un corazón móvil.
- **ENTRADAS:** dirección y carrera del corazón móvil ←A-78 · disponibilidad de circuitos de la
  máquina.
- **CÁLCULO:** **CUALITATIVO**, jerarquía dura: primero accionamiento por la **apertura del molde**
  (slide con perno ángel), después actuador externo. *"they should be designed, when possible, to
  work with the opening action of the mold rather than relying on additional actuators"* (la cita
  del corpus está recortada así; se usa esa forma).
- **SALIDA:** `{slide por apertura | core pull con actuador}`.
- **DECIDE:** si el análisis sigue por A-101 (slide) o por A-99/A-100 (core pull), y si hay que
  documentar la secuencia de la máquina.
- **CRITERIO:** [JUICIO] con jerarquía explícita. Si es core pull: **limit switch por circuito**, con
  la apertura del molde inhibida hasta que todos energicen.
- **INVALIDA:** que la carrera necesaria no se alcance con 20° de perno ángel (→A-101 lo mide y
  devuelve el caso a core pull).
- **¿TENEMOS?** **Parcial.** `sideactions.ts:sideActionDesign()` calcula el slide y `anglePinDesign()`
  la carrera; `moldtech.ts` decide la tecnología. **FALTA la jerarquía explícita como veredicto**
  ("¿por qué no se pudo con apertura?") y el registro de limit switches.

### A-80 — Área efectiva de expulsión (A_eff)
- **§** 11.2.2, Ec. 11.8 · **CUÁNDO:** antes de la fuerza; es la entrada que más se equivoca.
- **ENTRADAS:** secciones transversales de la pieza · espesor `h` · perímetro `2L + 2W` · número y
  altura de paredes y de costillas.
- **CÁLCULO:** `A_eff = h·(2L + 2W) + n_wall·h·H_pieza + n_rib·h_rib·H_rib`.
  **A_eff NO es el área proyectada**: es la sección transversal tipo "liga elástica" que se relaja al
  seccionar. El libro razona en voz alta que cortar solo A-A no basta, ni A-A + B-B: hay que sumar
  C-C porque las costillas se jalan entre sí.
- **SALIDA:** `A_eff [mm²]` (el cup del libro: 526 mm²).
- **DECIDE:** la magnitud de la fuerza de expulsión (A-81) — y por tanto todo el dimensionado.
- **CRITERIO:** [LIBRO] la ecuación es literal; la **elección de secciones representativas** es
  visual (ficha V11.2) y es donde se equivoca la gente.
- **INVALIDA:** añadir/quitar costillas o cambiar el espesor de pared (retorno a pieza).
- **¿TENEMOS?** **SÍ.** `ejection.ts:effectiveArea({h,L,W,nWalls,hWall,nRibs,tRib,hRib})` es la
  Ec. 11.8 literal.

### A-81 — Fuerza de expulsión
- **§** 11.2.2, Ec. 11.7 · **CUÁNDO:** paso 3 del subsistema; **aquí aterriza el cap. 10**.
- **ENTRADAS:** `A_eff` ←A-80 · `mu_s` (0.5 pulido a >1.0 texturizado) · ángulo de salida `phi` desde
  el CAD · `E`, `CTE`, `T_solidificación`, `T_expulsión` del Apéndice A · y el hilo desde el cap. 10:
  la contracción es la que genera el apriete sobre el corazón (§10.4 encadena los datos).
- **CÁLCULO:** `F_eject = mu_s · cos(phi) · E · CTE · (T_solidificación − T_expulsión) · A_eff`.
  Ejemplos: cup **1,800 N**, bezel **4,700 N**.
- **SALIDA:** `F_eject [N]`.
- **DECIDE:** área y perímetro de empuje (A-83/A-84), número y tamaño de eyectores, y la fuerza que
  debe dar la máquina.
- **CRITERIO:** [LIBRO] **y una prohibición**: el análisis ya es conservador (módulo a temperatura
  ambiente, sin relajación, sin estado compresivo previo) y por eso *"the use of this analysis for
  the ejection force should result in effective ejection system designs without the use of safety
  factors"*. **No apilar factor de seguridad encima.**
- **INVALIDA:** que el molder deje enfriar la pieza de más en el molde — entonces la `T` final real
  es la `T_expulsión` y la fuerza **sube significativamente**; hay que recorrer con ese caso.
- **¿TENEMOS?** **SÍ y de más.** `ejection.ts:ejectionForce()` es la Ec. 11.7 literal;
  `residualStress()` es la 11.5; y `ejectionVector()` extiende al balance completo (peso real,
  orientación de máquina, fricción de guía) — **extensión nuestra, declarada**.
  `mold-contratos.ts:eject-sin-fs` codifica la prohibición de apilar factor de seguridad.

### A-82 — Sanity-check de la fuerza contra la máquina
- **§** 11.2.2 · **CUÁNDO:** inmediatamente después de A-81, antes de dimensionar nada.
- **ENTRADAS:** `F_eject` ←A-81 · tonelaje de cierre de la máquina ←`analisis-caps4-6`.
- **CÁLCULO:** *"the ejection force provided by the machine is typically 2% of the clamp tonnage"*;
  los dos ejemplos del libro dan ~**0.5 %** del clamp (1.8 kN / 400 kN y 4.7 kN / 1400 kN).
- **SALIDA:** `F_eject / F_clamp [%]` y margen contra el 2 % disponible.
- **DECIDE:** seguir, o revisar entradas si el resultado sale fuera de ese orden de magnitud.
  **Éste es el gate de validación del propio Kazmer.**
- **CRITERIO:** [COMPARA] contra el 2 % de la máquina, y contra el ~0.5 % típico como referencia de
  orden de magnitud.
- **INVALIDA:** cambio de máquina.
- **¿TENEMOS?** **SÍ.** `ejection.ts:ejectionKinematics({fMachineMaxN, fEjectN, ...})` devuelve
  `libera` y `sf`; `machinesizing.ts` da el tonelaje; `mold-contratos.ts:eject-fuerza` lo audita.

### A-83 — Área mínima de empuje (compresión en el acero del pin)
- **§** 11.2.3, Ec. 11.10 · **CUÁNDO:** paso 4, primera de las dos varas.
- **ENTRADAS:** `F_eject` ←A-81 · `sigma_fatiga` del pin.
- **CÁLCULO:** `A_ejectors > F_eject / sigma_fatiga`. El libro da dos valores y obliga a declarar
  cuál se usó: **800 MPa** para pines endurecidos típicos, o **450 MPa** conservador para P20
  (⚠ ver ERRATAS: para el P20 estructural la vara buena es 456 MPa; el 450 de §11.2.3 es
  explícitamente "conservador", así que aquí no hay contradicción — es otra decisión).
- **SALIDA:** `A_min [mm²]` y, repartida entre `n` pines, `D_min_compresión [mm]`.
- **DECIDE:** un piso al diámetro de pin.
- **CRITERIO:** [LIBRO] con elección declarada de la vara (450 vs 800).
- **INVALIDA:** cambiar el material del pin, o cambiar `n`.
- **¿TENEMOS?** **SÍ.** `ejection.ts:ejectorPinSizing(m, fEjectN, nPins, wallM, sigmaFatiguePa=450e6)`
  devuelve `dMinCompressionMm`. El default 450 MPa está codificado como en el libro.

### A-84 — Perímetro mínimo (cortante en el PLÁSTICO) — la vara que gobierna
- **§** 11.2.3, Ec. 11.12 · **CUÁNDO:** junto con A-83, y es la que suele mandar.
- **ENTRADAS:** `F_eject` ←A-81 · `sigma_yield` del plástico (Apéndice A; ABS 44 MPa) · espesor de
  pared `h`.
- **CÁLCULO:** `Omega_ejectors > 2·F_eject / (sigma_yield_plástico · h)`. El 2 sale de exigir que el
  cortante alrededor de todos los eyectores sea **menor a la mitad** del yield del material.
- **SALIDA:** `Omega_min [mm]` y, repartido entre `n` pines, `D_min_cortante [mm]`.
- **DECIDE:** el diámetro real de los pines. Previene el defecto que el libro nombra: **"push pin"**
  (distorsión permanente junto al pin), alabeo permanente o fractura.
- **CRITERIO:** [LIBRO] y **la trampa central del capítulo**: *"the design of the ejector system is
  driven more by the yield stresses exerted on the plastic molding rather than by the compressive
  stresses on the pin"*. Bezel con 20 pines: **0.8 mm** por compresión pero **2.23 mm** por cortante.
- **INVALIDA:** cambio de material de la pieza o de espesor de pared.
- **¿TENEMOS?** **SÍ.** `ejection.ts:ejectorPinSizing()` devuelve `dMinShearMm` y `dMinMm =
  max(comp, shear)`; `mold-contratos.ts:eject-driver` audita explícitamente **cuál de las dos
  gobierna**.

### A-85 — Pandeo del pin de expulsión
- **§** 11.3.1, Ec. 11.16 · **CUÁNDO:** con el diámetro candidato y el largo real del pin.
- **ENTRADAS:** `F_por_pin` ←A-81/n · largo libre `L` · `E` del acero (~200 GPa).
- **CÁLCULO:** Euler con el extremo superior soportado por el barreno y el inferior articulado en el
  retenedor ⇒ longitud efectiva **0.7·L**: `F_buck = pi²·E·I/(0.7·L)²`, despejado a
  `R > (F_pin·L²/(63.2·E))^(1/4)`. Ejemplo: `D >= 1.86 mm` → redondear a catálogo (2 mm o 3/32").
- **SALIDA:** `D_min_pandeo [mm]` y factor de seguridad contra pandeo.
- **DECIDE:** si el pin recto sirve o hay que pasar a **pin escalonado** (hombro ≈ +1 mm de diámetro,
  largo típico 50 mm), verificando claros en placa de soporte e inserto.
- **CRITERIO:** [LIBRO] con la advertencia de que cuál de las tres restricciones manda **depende del
  largo**: *"The mold designer should perform analysis for their molding application to confirm the
  driving constraint."*
- **INVALIDA:** cambiar el stack de placas (cambia `L`), o cambiar `n`.
- **¿TENEMOS?** **Parcial — SÍ el cálculo, con una desviación.** `ejection.ts:pinBuckling()` usa
  `K = 2` (empotrado-libre, voladizo) y exige `sf >= 2`, mientras el libro usa **0.7·L**
  (soportado-articulado) sin factor. Son modelos distintos: el nuestro es más conservador pero **no
  reproduce el 1.86 mm del ejemplo**. Hay que ofrecer `K = 0.7` como el modo "Kazmer literal".

### A-86 — Restricción gobernante del pin (el peor de tres)
- **§** 11.2.3 + §11.3.1 · **CUÁNDO:** al cerrar el diámetro.
- **ENTRADAS:** `D_min_compresión` ←A-83 · `D_min_cortante` ←A-84 · `D_min_pandeo` ←A-85 · acero
  disponible junto al barreno ←A-88.
- **CÁLCULO:** `D = max(los tres)`, redondeado **hacia arriba** a diámetro de catálogo, y acotado
  **hacia abajo** por A-88 (acero disponible) y por A-91 (interferencia térmica).
- **SALIDA:** `D [mm]` de catálogo + etiqueta de **cuál restricción domina**.
- **DECIDE:** el pin que se compra.
- **CRITERIO:** [LIBRO] el peor de tres, con la restricción dominante nombrada. Y el resultado es
  **solo un límite inferior**: *"the above analysis only provides a"* **"lower limit"** — siempre se
  pueden añadir eyectores o agrandarlos.
- **INVALIDA:** que el `D` resultante no quepa (→ A-88), o que exija pin escalonado (→ A-85).
- **¿TENEMOS?** **SÍ.** `ejectorPinSizing().dMinMm` + `mold-ejection-auto.ts:autoEjectionPlan()`
  aterriza a `STANDARD_EJECTOR_PIN_MM`; `mold-contratos.ts:eject-limite-inferior` deja escrito que el
  número es piso, no techo.

### A-87 — Pocos y grandes vs muchos y chicos
- **§** 11.2.4 · **CUÁNDO:** una vez conocido el límite inferior de A-86.
- **ENTRADAS:** `D_min` y `n` ←A-86 · espacio libre en el corazón · trazado de agua ←`analisis-caps7-9`
  · necesidades de venteo ←`analisis-caps7-9`.
- **CÁLCULO:** comparador de escenarios (el libro compara **10 pines Ø4.5 a 30 MPa** contra
  **40 pines Ø1.125 a 100 MPa**). Trade-off declarado: pocos/grandes = menos componentes que maquinar
  y mantener, esfuerzos bajos, menos pandeo; muchos/chicos = **venteo y expulsión más uniformes** y
  flexibilidad para colarse entre líneas de agua, corazones angostos, paredes y costillas.
- **SALIDA:** `(n, D)` elegidos + esfuerzo por pin [MPa].
- **DECIDE:** la población de eyectores del molde.
- **CRITERIO:** [JUICIO] con dos rechazos concretos del propio libro sobre su layout candidato de 10
  pines Ø4.5 (Fig. 11.9): faltan eyectores cerca de donde la pieza se pega, y
  *"only 1 mm of steel separates the ejector hole"* de la superficie de cavidad.
- **INVALIDA:** el trazado de agua (A-90) y el acero disponible (A-88) pueden tumbar el escenario.
- **¿TENEMOS?** **Parcial.** `mold-ejection-auto.ts` elige tipo y cantidad, pero **no presenta el
  MENÚ de escenarios** con su esfuerzo por pin. FALTA el comparador.

### A-88 — Acero mínimo entre barreno de eyector y cavidad
- **§** 11.2.4 / 11.2.5 · **CUÁNDO:** al posicionar cada pin.
- **ENTRADAS:** posición del pin · superficie de cavidad más cercana · `D` del pin ←A-86.
- **CÁLCULO:** *"an allowance of at least"* **"one ejector pin diameter"** entre la superficie de la
  cavidad y la superficie del barreno.
- **SALIDA:** holgura medida [mm] vs `1·D` exigido; veredicto por pin.
- **DECIDE:** mover el pin o achicarlo.
- **CRITERIO:** [LIBRO] umbral duro `>= 1·D`. El contraejemplo del libro son **1 mm** de acero: la
  presión deforma el barreno a no-redondo → el pin se atora → grietas hacia la cavidad.
- **INVALIDA:** re-escalar el molde (A-68) mueve todas las superficies.
- **¿TENEMOS?** **SÍ.** `mold-ejection-auto.ts:maxPinDiaForSteelMm(espacioAlMuroMm)` invierte la
  regla; `mold-contratos.ts:eject-acero-minimo` la audita. Es la misma regla que A-115 generaliza a
  todos los barrenos.

### A-89 — Layout: distancia de cada pin al punto de agarre
- **§** 11.2.5 · **CUÁNDO:** paso 5; después de fijar `(n, D)`.
- **ENTRADAS:** mapa de puntos de agarre (costillas, bosses, paredes laterales) · posiciones de pines
  ←A-87 · rigidez local de la pieza.
- **CÁLCULO:** distancia de cada pin a su punto de agarre más cercano y **brazo de momento**
  resultante. Cita madre: *"ejectors will be more effective when placed near the locations where the
  ejection forces are generated"* y empujando zonas rígidas. Antipatrón nombrado:
  *"A common but ineffective layout arises when ejector pins are uniformly distributed across the
  mold cavity"* — el pin lejos del agarre mete momento y deflexión antes de que la pieza despegue.
- **SALIDA:** por pin, distancia al agarre [mm]; como mapa, "qué tan solo está cada punto de agarre".
- **DECIDE:** mover pines, o cambiar de tipo (pad, sleeve, pin contorneado — A-93).
- **CRITERIO:** [JUICIO] visual; el libro no da umbral, da un par malo/bueno (Fig. 11.10 vs 11.11:
  tres pines añadidos cerca de la costilla y la pared).
- **INVALIDA:** cambiar la geometría de la pieza (nuevas costillas), o A-90 (el agua manda mover).
- **¿TENEMOS?** **SÍ.** `eject-layout.ts:gripEjectorLayout(mesh, ...)` produce el layout por puntos
  de agarre; `mold-contratos.ts:eject-layout` lo audita contra el antipatrón "repartido parejo".

### A-90 — Conflicto pin ↔ línea de agua (RETORNO)
- **§** 11.2.5 · **CUÁNDO:** al superponer el layout de eyección con el circuito de enfriamiento.
- **ENTRADAS:** posiciones de pines ←A-89 · trazado y diámetro de líneas de agua ←`analisis-caps7-9`
  · holgura mínima de acero (½ diámetro, §9.2.7).
- **CÁLCULO:** detección geométrica de colisión / falta de espacio entre costilla y pared.
- **SALIDA:** lista de colisiones + espacio faltante [mm].
- **DECIDE:** una de dos, ambas del libro: **reducir el diámetro de los pines**
  (*"the diameter of the ejector pins may be reduced slightly to allow the addition of a cooling
  line"*) o re-rutear el agua. **RETORNO a la fase de agua.**
- **CRITERIO:** [LIBRO] holgura de acero contra cualquier componente; conflicto declarado en el
  propio texto de la Fig. 11.11.
- **INVALIDA:** cualquier cambio de layout de cualquiera de los dos subsistemas.
- **¿TENEMOS?** **Parcial.** `collision.ts` + `mold-contratos.ts:agua-claro` (½ diámetro contra cualquier
  componente) y `vent-vs-agua`. **FALTA** que el conflicto ofrezca automáticamente la salida
  "achicar el pin" con el recálculo de A-86 encadenado.

### A-91 — Interferencia térmica del pin
- **§** 11.1.5 · **CUÁNDO:** al elegir diámetro y posición.
- **ENTRADAS:** `D` del pin ←A-86 · espesor nominal de pared de la pieza · conductividad del material
  del pin · resistencia térmica de contacto del ajuste deslizante.
- **CÁLCULO:** **CUALITATIVO con una regla concreta:** un pin de **diámetro mayor al espesor nominal
  de pared** genera punto caliente (el plástico sobre el pin tiene que enfriarse lateralmente).
  *"the use of overly large ejector pins should be avoided"* en favor de varios pines chicos
  colocados sin estorbar el agua. Componentes grandes (stripper plates, lifters, core pulls)
  **deben llevar canales de enfriamiento propios**.
- **SALIDA:** veredicto por pin + lista de componentes grandes que exigen enfriamiento propio.
- **DECIDE:** partir un pin grande en varios chicos; o añadir agua a un stripper/lifter/core pull.
- **CRITERIO:** [LIBRO] `D_pin > h_pared` ⇒ bandera.
- **INVALIDA:** cambio del espesor de pared.
- **¿TENEMOS?** **FALTA.** No existe la regla `D_pin` vs `h_pared`, ni el requisito de enfriar
  componentes grandes de expulsión. Es de una línea y cierra el cruce expulsión↔agua.

### A-92 — Decisión de marcas testigo
- **§** 11.1.6 · **CUÁNDO:** en paralelo con A-89, con el mapa estético de la pieza en la mano.
- **ENTRADAS:** superficies críticas / estéticas (Tabla 2.7) · zonas de bajo esfuerzo estructural ·
  aristas y features de la pieza donde esconder el testigo.
- **CÁLCULO:** **CUALITATIVO**, tres reglas en orden. (1) *"The most common approach is to locate
  ejector pins on non-visible surfaces"* y en zonas de bajo esfuerzo. (2) hacer coincidir la línea de
  testigo de sleeves/slides/lifters/strippers con features existentes de la pieza. (3) si un lado
  debe quedar **100 % libre** de marcas — de eyección **y** de compuerta — ⇒ **expulsión inversa**
  (§13.9.4, →A-127).
- **SALIDA:** mapa de testigos permitidos/prohibidos + veredicto de si hace falta reverse ejection.
- **DECIDE:** dónde puede ir cada eyector, y en el extremo, la arquitectura del molde entero.
- **CRITERIO:** [JUICIO] con tres daños nombrados: baja la calidad visual, interfiere con superficies
  de ensamble, y reduce resistencia en aplicaciones estructurales.
- **INVALIDA:** cambio del mapa estético del cliente.
- **¿TENEMOS?** **Parcial.** `moldtech.ts:chooseMoldTechnology({fullyAestheticSurface})` toma la
  decisión extrema (reverse ejection). **FALTA** el mapa de superficies estéticas de la pieza como
  dato de primera clase que restrinja el layout de A-89.

### A-93 — Largo del pin contorneado contra el espesor de venteo
- **§** 11.2.5 · **CUÁNDO:** al detallar pines contorneados (los que empujan sobre paredes/costillas).
- **ENTRADAS:** stack-up de tolerancias a través del ensamble del molde · espesor de venteo (0.02 mm)
  ←`analisis-caps7-9`.
- **CÁLCULO:** riesgo dual, puramente dimensional: **muy corto** ⇒ se forma un hueco entre la cara del
  pin y el inserto de cavidad; si el hueco supera el espesor de un venteo ⇒ **flash**. **Muy largo**
  ⇒ el pin se comprime al cerrar el molde y con los ciclos **fatiga y pandea**.
- **SALIDA:** hueco esperado [mm] vs 0.02 mm, y la banda de largo admisible.
- **DECIDE:** dos salidas del libro: enfoque **steel-safe con múltiples ajustes de longitud**, o meter
  el pin **dentro de la cavidad** para que los errores de contorno caigan en superficie no estética.
- **CRITERIO:** [LIBRO] el mismo 0.02 mm de venteo que gobierna A-107. El largo exacto **no se puede
  calcular** por el apilamiento de tolerancias — el libro lo dice y por eso manda steel-safe.
- **INVALIDA:** cambiar cualquier placa del stack.
- **¿TENEMOS?** **FALTA.** No hay stack-up de longitud de pin contorneado ni el check contra 0.02 mm.

### A-94 — Cuchilla (ejector blade): largo máximo por pandeo
- **§** 11.3.2, Ec. 11.19 · **CUÁNDO:** cuando el eyector va directo bajo una costilla.
- **ENTRADAS:** `F` por cuchilla ←A-81/n · espesor de la costilla (*"the thickness of the ejector
  blade should be set to the full thickness of the rib"*) · ancho `W` y espesor `H` de la sección ·
  `E` del acero.
- **CÁLCULO:** `I = W·H³/12`; `L < (1.7·E·W·H³/F)^(1/2)`.
- **SALIDA:** `L_max [mm]` contra el `L` real.
- **DECIDE:** si la cuchilla pasa. El ejemplo del libro sale **MARGINAL** (93 mm permitidos vs 93.8 mm
  reales) y él mismo dicta el veredicto: *"this blade design is marginal."* Salidas ofrecidas: más
  cuchillas (baja `F` por cuchilla), cuchilla más ancha o gruesa, o **push pad de sección constante**
  a través de la costilla para poder usar una cuchilla más gruesa.
- **CRITERIO:** [LIBRO] comparación directa `L_real` vs `L_max`, con la palabra "marginal" como
  categoría propia entre pasa y no pasa.
- **INVALIDA:** cambiar el espesor de la costilla (retorno a pieza) o el stack de placas.
- **¿TENEMOS?** **SÍ.** `ejectortypes.ts:bladeMaxLengthMm()`, `bladeBucklingForceN()`,
  `bladeInertiaM4()` y `checkEjectorBlade()` — la Ec. 11.19 literal, con `E_STEEL_PA`.

### A-95 — Carrera de servicio de la cuchilla
- **§** 11.3.2 · **CUÁNDO:** al detallar la cuchilla, después de A-94.
- **ENTRADAS:** distancia entre el hombro cónico de la cuchilla y el barreno angosto del inserto ·
  carrera máxima del sistema de expulsión de la máquina.
- **CÁLCULO:** comparación: el recorrido disponible debe *"exceed the maximum stroke of the ejector
  system"*.
- **SALIDA:** margen [mm]; veredicto pasa/no pasa.
- **DECIDE:** alargar el tramo o limitar la carrera. Es una **regla de servicio**: si no se cumple,
  el molder atasca y destruye las cuchillas sin querer.
- **CRITERIO:** [LIBRO] umbral relativo contra el stroke máximo de la máquina.
- **INVALIDA:** cambio de máquina (cambia el stroke).
- **¿TENEMOS?** **FALTA.** `ejectortypes.ts` cubre el pandeo pero no la carrera hombro↔barreno.
  Además hay que anotar: el barreno rectangular es **EDM**, y el EDM se minimiza con un land
  ≈ **2× el ancho** de la cuchilla — tampoco está.

### A-96 — Sleeve: stack-up de concentricidad
- **§** 11.3.3 · **CUÁNDO:** cuando el eyector es un sleeve sobre un boss cilíndrico.
- **ENTRADAS:** tolerancias del barreno de eyector, del sleeve y del core pin · holguras de venteo ·
  claro del core pin en placas eyectora y retenedora.
- **CÁLCULO:** **CUALITATIVO con causa nombrada:** *"the wall thickness and concentricity of the
  molding around the core pin is governed by the tolerance stack-up"* del trío barreno–sleeve–core
  pin. Dos acciones opuestas que hay que balancear: **minimizar** los claros de venteo (reducen
  variación dimensional de la pieza) y **dar claro suficiente** al core pin en las placas eyectora y
  retenedora, o el sleeve se atora.
- **SALIDA:** excentricidad esperada [mm] y variación de espesor de pared del boss [mm].
- **DECIDE:** las cotas y ajustes de los detalles B–F del ensamble del sleeve.
- **CRITERIO:** [JUICIO] — el libro **no da umbral numérico aquí** (lo dice la ficha V11.13). El
  criterio es que el esfuerzo y el pandeo típicamente NO gobiernan en un sleeve; gobierna la
  concentricidad.
- **INVALIDA:** cambio de tolerancias de maquinado del taller.
- **¿TENEMOS?** **FALTA.** `mold-ejection-auto.ts` sabe elegir `sleeve` como tipo, y `fits.ts` da
  holguras, pero no existe el stack-up de concentricidad barreno–sleeve–core pin.

### A-97 — Stripper plate: balance de fuerzas y punto de contacto
- **§** 11.3.4 · **CUÁNDO:** cuando el eyector es una placa botadora perimetral.
- **ENTRADAS:** `F_eject` por cavidad ←A-81 (cup ~1.8 kN vs lid ~1.2 kN en el molde de familia) ·
  geometría del borde de la pieza (¿hay cara plana de empuje?) · ejes de las cavidades.
- **CÁLCULO:** dos verificaciones. (a) **Balance:** comparar las fuerzas de expulsión de cavidades
  opuestas; el desbalance desgasta disparejo. La placa debe accionarse en
  *"two locations that are in-line with the axis of the cavities"*, no en un punto central; si el
  desbalance persiste, engrosar la placa y los bujes de guía. (b) **Punto de contacto:** apoyar en el
  centro del radio da deslizamiento confiable pero **witness filoso**; moverlo hacia adentro mejora la
  estética pero crea una **arista filosa** que desgasta y daña la superficie vertical del corazón.
- **SALIDA:** desbalance [N] y [%]; veredicto del punto de contacto.
- **DECIDE:** número y posición de puntos de accionamiento, espesor de placa y tamaño de bujes. Y en
  el límite, la salida legítima es **pedir el rediseño de la pieza** para tener cara plana de empuje.
  **RETORNO a pieza.**
- **CRITERIO:** [JUICIO] y la ficha V11.15 lo remata: **ninguna opción es buena**, el defecto es
  intrínseco a la geometría. Hay verificaciones cuyo veredicto correcto es "rediseña la pieza".
- **INVALIDA:** rediseño del borde de la pieza.
- **¿TENEMOS?** **Parcial.** `mold-ejection-auto.ts` calcula `stripper.pushPerimeterMm` y elige
  stripper para vasos de pared delgada. **FALTA** el balance entre cavidades y el veredicto del punto
  de contacto.

### A-98 — Expulsión elástica de undercut (¿hace falta mecanismo?)
- **§** 11.3.5, Ecs. 11.20–11.23 · **CUÁNDO:** por cada undercut detectado en A-78. **Es el filtro que
  decide si el molde necesita correderas — y por tanto su costo.**
- **ENTRADAS:** profundidad del undercut `delta` · perímetro que debe estirarse `L` ·
  strain-to-yield del material (Apéndice A: ABS 2, acetal 12, PA66 35, PA66-33%GF **3**,
  PS-30%GF **1.2**) · `A_eff` ←A-80 · espesor del undercut `h_undercut`.
- **CÁLCULO:** `epsilon = delta / L` (Ec. 11.20). Luego `F_eject = mu_s·cos(phi)·E·(delta/L)·A_eff`
  (Ec. 11.23) y cortante `tau = F/(pi·phi·h_undercut)` contra ~yield/2. Ejemplo del bezel:
  `delta = 1 mm` sobre `L = 77 mm` ⇒ **1.3 %**, *"significant but not excessive"*.
- **SALIDA:** `epsilon [%]`, `F_eject [N]`, `tau [MPa]`; veredicto apto/no-apto.
- **DECIDE:** expulsar el undercut por deformación elástica (sin mecanismo) o mandarlo a slide /
  core pull / collapsible core.
- **CRITERIO:** [LIBRO] *"most plastics have a strain to yield above 2%, which is a reasonable mold
  design guideline"* — **con EXCEPCIÓN declarada:** los materiales muy cargados tienen límite
  elástico menor y fallan de forma **frágil** (por eso PS-30%GF a 1.2 % es una trampa).
- **INVALIDA:** cambio de material (una resina cargada puede tumbar un undercut que ya pasaba).
- **¿TENEMOS?** **SÍ.** `ejectortypes.ts:undercutStrain()`, `undercutEjectForceN()`,
  `undercutShearMPa()` y `checkUndercut()` — las tres ecuaciones. La excepción de los materiales
  frágiles cargados **no está** como bandera separada.

### A-99 — Core pull: fuerza que debe vencer el actuador
- **§** 11.3.6, Ec. 11.24 · **CUÁNDO:** en cuanto A-79 manda a core pull.
- **ENTRADAS:** área **proyectada** del corazón móvil · presión de fundido.
- **CÁLCULO:** `F = P_melt · A_proyectada`, con el supuesto conservador declarado
  *"conservatively assume a melt pressure of 200 MPa"* y área completa. Ejemplo: corazón de
  22×10 mm ⇒ **44 kN ≈ 4 TONELADAS**.
- **SALIDA:** `F [kN]`.
- **DECIDE:** el tamaño del actuador (A-100) — y la sorpresa de escala que hay que mostrarle al
  usuario: *"the moving core must provide a closing force equivalent to the clamp force required for
  the production of a similarly sized molding."*
- **CRITERIO:** [LIBRO] con los dos supuestos conservadores declarados (200 MPa y área completa).
- **INVALIDA:** cambiar la presión de moldeo esperada o el tamaño de la ventana.
- **¿TENEMOS?** **SÍ.** `sideactions.ts:corePullForce(pMeltPa, aProjM2)` es la Ec. 11.24 literal.

### A-100 — Core pull: diámetro de cilindro y carrera
- **§** 11.3.6, Ec. 11.25 · **CUÁNDO:** después de A-99.
- **ENTRADAS:** `F` ←A-99 · presión de fluido **real de planta** · envolvente de las features que el
  corazón debe librar.
- **CÁLCULO:** `D_bore = sqrt(4F/(pi·P_fluido))`. **Y el gotcha de la presión:** aunque la mayoría de
  los sistemas hidráulicos se diseñan a 20.7 MPa (3,000 psi), *"many molding machines and auxiliary
  systems are operated at 10 MPa"* ⇒ diseñar con **10 MPa**. Luego **redondear a cilindro de
  catálogo** (75 mm calculado → 82.55 mm / 3.25", carrera 25.4 mm). La carrera debe superar la
  envolvente de las features.
- **SALIDA:** `D_bore [mm]` de catálogo + carrera [mm].
- **DECIDE:** el cilindro que se compra, la altura de los risers, y de qué lado del molde va (los
  cilindros deben ir **de un solo lado**).
- **CRITERIO:** [LIBRO] elección de actuador razonada: hidráulico gana porque
  *"hydraulic actuators have a power density an order of magnitude"* por encima de neumático o
  eléctrico, más disponibilidad, costo e integración con la máquina.
- **INVALIDA:** que la planta opere a otra presión (dato externo a pedir).
- **¿TENEMOS?** **Parcial.** `sideactions.ts:hydraulicBore()`, `STD_BORES_MM` (incluye 82.55) y
  `pickStdBore()`. **FALTA** el check de carrera contra la envolvente y la regla de "un solo lado".

### A-101 — Slide con perno ángel: ángulo y carrera
- **§** 11.3.7, Ec. 11.26 · **CUÁNDO:** cuando A-79 se resuelve por apertura del molde.
- **ENTRADAS:** carrera lateral necesaria (profundidad del undercut + holgura) · longitud de contacto
  del perno · espacio disponible en la placa.
- **CÁLCULO:** `S_slide = L_contacto · sin(phi)` con el **límite duro** de que el ángulo entre el eje
  del perno y la dirección de apertura está *"limited to about 20 degrees"* o se atasca por fricción.
  Añadir ~**25 mm** extra de longitud para acoplar el perno al inserto (ejemplo: 12 mm de carrera →
  perno de ~60 mm).
- **SALIDA:** `phi [°]`, `L_perno [mm]`, carrera [mm].
- **DECIDE:** si el slide alcanza la carrera necesaria; si no, se devuelve a core pull (A-99).
- **CRITERIO:** [LIBRO] `phi <= 20°`. Y la **clave contraintuitiva** que hay que enseñar: la fuerza
  lateral anti-flash la da el **heel block** y el cierre de la cavidad —
  *"the angle pin does not provide the lateral force"*. El perno solo mueve.
- **INVALIDA:** cambio de la profundidad del undercut o del espesor de la placa.
- **¿TENEMOS?** **SÍ.** `sideactions.ts:anglePinDesign(strokeMm, phiDeg=20, engagementMm=25)` y
  `sideActionDesign()`; `mold-sideaction-gen.ts` genera perno + gib de bronce + heel block con la
  nota de quién carga la fuerza lateral.

### A-102 — Retorno de expulsores: resortes contra retorno positivo
- **§** 11.3.8 · **CUÁNDO:** al cerrar el subsistema de expulsión.
- **ENTRADAS:** `F_eject` ←A-81 · largo libre y diámetro del resorte · ubicación, diámetro y **rosca**
  de los knock-out rods (dato del molder, a confirmar).
- **CÁLCULO:** si es por **resortes**: pin de soporte al centro cuando el largo libre excede
  **4× el diámetro** del resorte; compresión limitada a *"40% of the free length"*; fuerza de retorno
  ≈ una fracción de la de expulsión, *"one-fourth"* en el ejemplo.
  Si es **positivo**: knock-out roscado a la placa eyectora, con retroalimentación de posición desde
  los transductores de la máquina.
- **SALIDA:** especificación del resorte (Ø, largo libre, fuerza) **o** la especificación del rod.
- **DECIDE:** el esquema de retorno. El libro **prefiere el positivo** con 4 razones: da posición
  real, requiere menos cambios al molde, los resortes limitan la carrera y pueden dañarse o dañar si
  la máquina fuerza más allá de su recorrido, y los resortes se desgastan hasta que el sistema
  *"frequently fail to completely return the ejector system after an indefinite number of molding
  cycles"*.
- **CRITERIO:** [LIBRO] los tres números del resorte (4×D, 40 %, ¼·F) son literales; la preferencia es
  [JUICIO] argumentado. Si el retorno temprano debe **garantizarse** antes de cerrar ⇒ **limit switch
  de reset obligatorio**.
- **INVALIDA:** que el molder exija retorno temprano; cambio de máquina (otros knock-out rods).
- **¿TENEMOS?** **Parcial — SÍ para resortes.** `sideactions.ts:springReturnCheck(freeLenMm, diaMm, compressMm)`
  cubre el 4×D y el 40 %. **FALTA** el ¼·F_eject como dimensionado de fuerza y el registro del dato
  externo (ubicación/Ø/rosca de los knock-out rods).

### A-103 — Holguras de detallado del pin
- **§** 11.2.6 · **CUÁNDO:** último paso del subsistema, al detallar.
- **ENTRADAS:** `D` del pin ←A-86 · tolerancias de taladrado del taller (típicas 0.25 mm) · número de
  placas que atraviesa el pin.
- **CÁLCULO:** cuatro cotas duras. **Venteo:** holgura de **0.02 mm** en una longitud de **2 a 3
  diámetros**, y después el barreno escalona a mayor diámetro para no frenar el deslizamiento, con
  **chaflán** de la parte ancha a la de venteo (sin él el pin se atora al ensamblar). **Holgura
  gruesa:** debe exceder el stack-up de tolerancias posicionales entre placas; con taladrado a
  0.25 mm, **0.5 mm** basta. **Chaflán guía** en la interfaz placa de soporte → inserto.
  **Contrabarreno holgado** en la retenedora, porque la posición del pin la manda el **barreno rimado
  del inserto**, no la retenedora.
- **SALIDA:** tabla de cotas por pin.
- **DECIDE:** el plano de cada placa. **ENTREGABLE: tabla de eyectores** — todo pin **keyed** y
  etiquetado (el pin *y* su posición en la retenedora), y la regla anti-error humano:
  *"always avoid designing ejector pins that vary only slightly in their design"* porque el molder los
  intercambiará por accidente y dañará pines y superficies de cavidad.
- **CRITERIO:** [LIBRO] cuatro umbrales literales + una regla de diseño motivada por **error humano**,
  no por física.
- **INVALIDA:** cambio del stack de placas o de las tolerancias del taller.
- **¿TENEMOS?** **Parcial.** `fits.ts:ejectorPinFit()` da el barreno rimado (holgura diametral
  0.13 mm de §8.3.2, que ADEMÁS ventea) y `mold-contratos.ts:eject-pines-casi-iguales` codifica la
  regla anti-intercambio. **FALTA**: el escalón a 2–3 diámetros con chaflán, la holgura gruesa de
  0.5 mm contra el stack-up, y la generación de la **tabla de eyectores** como entregable.

---
# CAPÍTULO 12 — SISTEMA ESTRUCTURAL

> **La vara cambia aquí y es lo más importante del capítulo.** La carga del molde no se aplica una
> vez: se aplica **millones** de veces. Por eso el criterio no es la fluencia (`sigma_yield`) sino el
> **límite de fatiga** (`sigma_endurance`), y por eso **la vida esperada del molde en ciclos es una
> ENTRADA de diseño, no un resultado**. Y hay un segundo eje independiente: aunque el esfuerzo pase,
> la **deflexión** puede abrir el plano de partición más que el venteo y producir flash. El capítulo
> cierra con tres veredictos que se corren por separado (A-126).
>
> Lectura de mapa que decide dónde se analiza: el lado **fijo** va en compresión casi pura (la cavidad
> se respalda contra la placa de sujeción y la platina); el lado **móvil** flexiona, porque el bolsillo
> del housing del eyector no soporta los corazones. Por eso el análisis se concentra en el lado móvil.

### A-104 — Elección del esfuerzo límite: dos caminos EXCLUYENTES
- **§** 12.1.1 · **CUÁNDO:** antes de cualquier cálculo estructural; fija la vara de todo el capítulo.
- **ENTRADAS:** presión de fundido esperada (~100 MPa) y de peor caso (~200 MPa) · `sigma_yield` del
  metal (Apéndice B) · criticidad del componente.
- **CÁLCULO:** **elegir UNO**:
  (a) `sigma_limit = sigma_yield` **con escenario de peor caso** (presión máxima que el molde vería,
  ~200 MPa); o
  (b) `sigma_limit = sigma_yield / f` **con presión esperada** (~100 MPa), donde
  *"Typical values range from"* 1.5 para componentes no críticos hasta 6.0 para hoist rings.
- **SALIDA:** `sigma_limit [MPa]` + método declarado.
- **DECIDE:** el umbral contra el que se comparan A-106, A-113, A-114, A-118, A-119.
- **CRITERIO:** [LIBRO] con **prohibición literal**: *"the mold designer should not jointly apply a
  factor of safety with the worst case scenario"* — combinarlos es sobre-diseño. El sistema debe
  **bloquear** la combinación.
- **INVALIDA:** cambio de metal o de presión esperada.
- **¿TENEMOS?** **Parcial — auditado pero sin los dos caminos.** `platesizing.ts:StressMethod {metodo: 'deflexión-pura'|'yield/f'|
  'peor-caso', f, sigmaLimitMPa, cita}` y `mold-contratos.ts:estr-no-apilar-sesgos` reprueba si el
  módulo no declara cuál método usó. **Nota de deuda propia:** hoy `sizeSupportPlate()` devuelve
  siempre `'deflexión-pura'`, así que los caminos (a) y (b) existen como tipo pero no como cálculo.

### A-105 — Vida objetivo en ciclos → límite de fatiga
- **§** 12.1.1, Ec. 12.4 · **CUÁNDO:** junto con A-104. **Es la ficha que define el capítulo.**
- **ENTRADAS:** número de ciclos objetivo del molde (volumen de producción, del intake §2.2.2) ·
  curva S-N del metal (Apéndice B).
- **CÁLCULO:** `sigma_limit = min(sigma_yield/f, sigma_endurance)`.
  **Aceros:** *"For most steels, the endurance stress is approximately one-half the yield stress"* —
  P20: yield 830 MPa, endurance **456 MPa** (⚠ ver ERRATAS: el texto dice ~450, la figura rotula 456;
  se usa **456**).
  **Aluminio, la trampa:** *"do not exhibit an endurance stress limit"* — el ciclado continuo de
  cualquier esfuerzo termina fallando por fatiga. Para el QC7 hay que **entrar con el número de
  ciclos**: 545 MPa a <1,000 ciclos · 370 MPa a ~10,000 · **170 MPa a 1,000,000**.
- **SALIDA:** `sigma_endurance [MPa]` a la vida objetivo.
- **DECIDE:** la vara real de todos los veredictos de esfuerzo del capítulo, **y la elección de metal**
  (A-142).
- **CRITERIO:** [LIBRO] `min()` explícito. Y la consecuencia de modelo: **"clase de molde" deja de ser
  una etiqueta (SPI 101–105) y se vuelve un número que entra al cálculo**. El corpus declara que el
  libro **no trae** tabla de clases SPI, y que este mecanismo es el equivalente funcional y mejor.
- **INVALIDA:** que cambie el volumen de producción comprometido con el cliente.
- **¿TENEMOS?** **Parcial.** `moldbase.ts:MOLD_METALS` trae `fatigueLimitMPa` (S-N a 1e6, FS=1, nota B.4)
  para los 11 metales, y `mold-contratos.ts:estr-vida-ciclos` cruza el horizonte de piezas contra el
  metal y **advierte explícitamente cuando el metal es aluminio**. **FALTA la curva S-N como función**
  (hoy es un solo punto a 1e6): con aluminio a 10,000 ciclos el límite bueno es 370 MPa, no el 166/170
  tabulado, y hoy no se puede leer.

### A-106 — von Mises contra el esfuerzo límite
- **§** 12.1.1, Ec. 12.1 · **CUÁNDO:** sobre cada componente cargado, después de A-104/A-105.
- **ENTRADAS:** campo de esfuerzos principales `sigma1`, `sigma2` (de FEA o de los cálculos cerrados
  A-108…A-120) · `sigma_limit` ←A-104/A-105.
- **CÁLCULO:** `sigma_Mises = sqrt(sigma1² − sigma1·sigma2 + sigma2²) < sigma_limit`.
- **SALIDA:** `sigma_max [MPa]`, **% de área por encima de `sigma_limit`**, y la **asimetría lado fijo
  ↔ lado móvil**.
- **DECIDE:** engrosar geometría, cambiar metal, o meter pilares/interlocks.
- **CRITERIO:** [LIBRO] con una regla de presentación de la ficha V12.2: la escala de color debe estar
  **anclada a `sigma_limit`, no auto-escalada**, o dos diseños no se pueden comparar.
- **INVALIDA:** cualquier cambio de geometría o de presión.
- **¿TENEMOS?** **SÍ.** `mold-fea.ts:runMoldFea()` corre el sólido; `lamina-vonmises.ts` produce la
  lámina con escala anclada y mide la asimetría fijo↔móvil (cubre V12.2 y V12.12).

### A-107 — Deflexión contra espesor de venteo (el criterio de flash)
- **§** 12.1.2 · **CUÁNDO:** en paralelo con A-106; **es un semáforo INDEPENDIENTE del de esfuerzo**.
- **ENTRADAS:** desplazamiento del corazón y de la cavidad bajo presión (FEA o A-109/A-111/A-113) ·
  espesor de venteo (~0.02 mm) ←`analisis-caps7-9`.
- **CÁLCULO:** `separación = delta_corazón + delta_cavidad` contra el espesor del venteo. Ejemplo del
  libro: 0.24 mm + 0.12 mm = **0.36 mm** contra 0.02 mm ⇒ flash seguro, y el veredicto textual:
  *"The mold design must be improved"*.
- **SALIDA:** separación del plano de partición [mm] vs 0.02 mm.
- **DECIDE:** engrosar placas, meter pilares (A-110) o interlocks (A-114).
- **CRITERIO:** [LIBRO] **umbral absoluto**, rarísimo en este libro: la ficha V12.4 lo señala. En
  aplicaciones de tolerancia apretada, **la deflexión manda sobre el esfuerzo**.
  Nota al pie útil: las platinas **no** son infinitamente rígidas — la fija deflectó 0.04 mm, el doble
  que la móvil.
- **INVALIDA:** cambio del espesor de venteo especificado (y ojo: la Tabla 8.1 tiene dispersión de un
  orden de magnitud entre fuentes; el libro usa 0.02 mm como valor de trabajo).
- **¿TENEMOS?** **SÍ.** `platesizing.ts:sizeSupportPlate()` lleva `ventGapMm` (default 0.02e-3 m) y
  `flashOk`; `mold-contratos.ts:estr-deflexion-vs-venteo` y `estr-flash-coherente` lo auditan.

### A-108 — Compresión de placas y área de soporte efectiva
- **§** 12.2.1 · **CUÁNDO:** primer cálculo de placas.
- **ENTRADAS:** fuerza de cierre `F` ←`analisis-caps4-6` · área de soporte alrededor de la cavidad ·
  altura del stack · `E` del acero.
- **CÁLCULO:** `sigma = F/A`, `epsilon = sigma/E`, `delta = epsilon·L`. **El área es lo delicado:** se
  **restan** cavidad, leader pins y guide bushings, porque esos componentes no transmiten la fuerza de
  cierre. Ejemplos: stack completo del bezel **0.03 mm** — con la nota de que en moldeo real puede ser
  **el doble** porque los rieles del housing van a mucho mayor esfuerzo; y el cambio de altura de
  cavidad bajo clamp, **0.002 mm**, despreciable.
- **SALIDA:** `sigma [MPa]`, `delta [mm]`.
- **DECIDE:** normalmente **nada** — el libro declara que la compresión no suele ser problema porque es
  chica y **uniforme** (no causa flash). **Excepción con acción:** si hay tolerancia apretada en el
  espesor de una pieza con cavidad profunda, se **aumenta ligeramente la profundidad de la cavidad**
  para compensar.
- **CRITERIO:** [JUICIO] "no necesita más consideración" salvo la excepción declarada.
- **INVALIDA:** cambio de tonelaje o del área de soporte (mover leader pins, agrandar cavidad).
- **¿TENEMOS?** **Parcial — SÍ el cálculo, falta el área.** `structural.ts:plateCompression(fN, aM2, lM)` da
  sigma/epsilon/delta. **FALTA** la resta explícita de cavidad + leader pins + bushings (V12.5, que es
  un cálculo de área sobre la planta del plano de partición) y la compensación de profundidad de
  cavidad.

### A-109 — Flexión de placa como viga
- **§** 12.2.2 · **CUÁNDO:** después de A-108; es donde vive el problema del lado móvil.
- **ENTRADAS:** `F` sobre la proyección de la cavidad · claro `L` = luz entre las caras internas de
  los rieles del housing · ancho `W` = ancho de la cavidad · espesor efectivo `H` de placa.
- **CÁLCULO:** `I = W·H³/12`; `delta = F·L³/(48·E·I)`. También el cortante perimetral
  `A_shear = (2·W_cav + 2·L_cav)·(H_placaB + H_soporte)`.
- **SALIDA:** `delta [mm]`, `tau [MPa]`.
- **DECIDE:** espesor de placa, número de pilares (A-110).
- **CRITERIO:** [LIBRO] con **tres elecciones conservadoras declaradas**: carga puntual central (no
  distribuida) que sobre-predice ~+60 %; ancho en flexión = ancho de la cavidad; claro = luz entre
  caras internas del housing. El resultado sale **~2× el del FEA** (0.05 vs 0.024 mm) y el libro lo
  acepta: es del orden correcto y lleva a diseños robustos.
  **Y el gotcha:** *"the effective plate thickness, H,"* **"should not include the thickness of the
  cores"** cuando los corazones no rigidizan el ensamble.
  **Multicavidad:** descomponer en porciones (agrupar, p. ej., 3 cavidades) y usar el ancho efectivo
  de ese grupo.
- **INVALIDA:** cambiar el mold base (cambia el claro entre rieles) o el layout de cavidades.
- **¿TENEMOS?** **Parcial.** `structural.ts:plateBending()`, `rectInertia()`, `shearArea()`,
  `minPlateThickness()`; `platesizing.ts:thicknessByDeflection()` y `sizeSupportPlate()`.
  **FALTA** la descomposición multicavidad por grupos (V12.7) y la exclusión explícita del espesor de
  corazones.

### A-110 — Layout de pilares de soporte
- **§** 12.2.3 · **CUÁNDO:** cuando A-109 no cierra con espesor razonable.
- **ENTRADAS:** mapa de dónde la cavidad genera fuerza · layout de eyectores ←A-89 · posición del
  knock-out central de la máquina.
- **CÁLCULO:** **CUALITATIVO con tres opciones comparadas** (Fig. 12.14):
  *"support pillars are best placed directly under the portions of the mold cavity that generate
  significant force"*. Dos pilares chicos fuera de las cuchillas quedan bien espaciados pero no caben
  bajo la cara del bezel sin reacomodar la eyección; **un pilar grande al centro**
  *"will not greatly reduce the deflection"* (la placa dobla por los costados) y además suele chocar
  con el vástago de expulsión central de la máquina; un pilar único intermedio usa menos pilares pero
  deja más claro y por tanto más deflexión.
- **SALIDA:** `(n_pilares, posiciones, Ø)` + claro máximo sin apoyo [mm] + lista de colisiones.
- **DECIDE:** el layout de pilares. **Y el orden de prelación:** si la deflexión es crítica,
  *"the ejector layout can be adjusted to provide space"* para pilares grandes en las posiciones
  ideales. **RETORNO a expulsión: la deflexión gana sobre el layout de eyección, no al revés.**
- **CRITERIO:** [JUICIO] tres restricciones, todas visuales (claro, colisión con cuchillas/pines,
  colisión con el vástago central).
- **INVALIDA:** mover cualquier eyector; cambiar de máquina (otro knock-out).
- **¿TENEMOS?** **Parcial.** `platesizing.ts:spanWithPillars()` y `optimizeSupportPlate()` dimensionan;
  `mold-contratos.ts:estr-pilares` **advierte específicamente el caso de 1 pilar central** con la cita
  del libro, y `estr-menu-pilares` presenta el trade-off pilares↔espesor con su costo en acero.
  **FALTA** la detección de colisión pilar↔cuchilla/pin y pilar↔knock-out central.

### A-111 — Superposición compresión + flexión del pilar
- **§** 12.2.3, Ecs. 12.12–12.13 · **CUÁNDO:** con el pilar ya posicionado.
- **ENTRADAS:** `F` repartida (el libro usa F/4 – F/2 – F/4 entre pilares y rieles) · Ø y altura del
  pilar · `delta_comp` y `delta_bend` ←A-108/A-109.
- **CÁLCULO:** `delta_total(x) = delta_comp·(1 − x/L) + delta_bend·(3L²x − 4x³)/L³`, con
  `delta_max = max(delta_comp, delta_comp/2 + delta_bend)` — el máximo ocurre **o en el centro del
  pilar o a media distancia entre pilar y riel**. Iteración mostrada por el libro: Ø37.5 mm → 297 MPa
  y 0.13 mm (fuera de meta) ⇒ **Ø50 mm** → 167 MPa y 0.07 mm.
- **SALIDA:** `sigma_pilar [MPa]`, `delta_max [mm]`.
- **DECIDE:** el diámetro del pilar. **Meta de diseño explícita del libro:**
  *"the total deflection is less than 0.1 mm"* (editable, pero ése es el default citado).
- **CRITERIO:** [LIBRO] **umbral absoluto 0.1 mm** — junto con el 0.02 mm de A-107, son los **dos
  únicos umbrales absolutos de deflexión** del libro (ficha V12.9). El 297 MPa del primer intento
  además ronda el endurance del SAE1040: la vara es fatiga, no yield.
- **INVALIDA:** cambiar el número de pilares (cambia el reparto de carga).
- **¿TENEMOS?** **FALTA.** `platesizing.ts:optimizeSupportPlate()` busca el óptimo de placa+pilares
  **por masa de acero**, no por la meta de 0.1 mm: no hace la superposición Ecs. 12.12–12.13 ni evalúa
  `sigma` en el pilar contra el endurance. Es el único análisis ausente que gobierna una cota real
  del molde (el Ø del pilar).

### A-112 — Pre-carga de pilares
- **§** 12.2.3 · **CUÁNDO:** después de A-111, como refinamiento de artesano.
- **ENTRADAS:** `delta_comp` del pilar ←A-111 · altura nominal del pilar.
- **CÁLCULO:** fabricar el pilar **más largo por exactamente la deflexión calculada**: 88.97 mm en vez
  de 88.9 mm (3.5"), de modo que bajo carga se comprima a su nominal
  *"so that cavity becomes flat during molding"*. La deflexión no se elimina: **se cancela**.
- **SALIDA:** cota de fabricación del pilar [mm] (dos valores: fabricar `L + delta`, en operación `L`).
- **DECIDE:** la cota que baja al plano del pilar. Y una nota de economía del libro: después de meter
  el pilar se puede **regresar a adelgazar** la placa B y/o la de soporte sin perder el requisito de
  deflexión.
- **CRITERIO:** [LIBRO] es una técnica, no un veredicto; el criterio es que la cavidad quede plana.
- **INVALIDA:** cambiar la carga (cambia `delta`, y el pilar pre-cargado queda mal).
- **¿TENEMOS?** **SÍ.** `mold-contratos.ts:estr-precarga` emite la cota de dos valores
  (`fabricar L+delta / en operación L`) cuando hay pilares. Bien resuelto.

### A-113 — Mejilla (cheek): cortante y deflexión de pared lateral
- **§** 12.2.4, Ecs. 12.15 y 12.17 · **CUÁNDO:** al dimensionar el inserto de una cavidad profunda.
- **ENTRADAS:** profundidad de cavidad `H` · presión de fundido `P` · `sigma_limit` del metal
  ←A-104/A-105 · ancho de mejilla candidato `W_cheek`.
- **CÁLCULO:** regla de dedo: *"the width of the cheek, Wcheek,"* **"should be equal to the height of
  the mold cavity"**. Verificación exacta: `tau = P·H/W_cheek < sigma_limit/2` ⇒
  `W_cheek > 2·H·sqrt(P/sigma_limit)`; con SAE4140 (endurance 412 MPa) a 150 MPa da
  **`W_cheek > 0.73·H`**, o sea que la regla de dedo **ya trae margen**.
  Y además hay que verificar la deflexión de la pared: `delta = 3·P·H⁴/(2·E·W_cheek³)` — **cuarta
  potencia de la altura**.
- **SALIDA:** `W_cheek_min [mm]` por cortante y `delta_pared [mm]`; veredicto por pared.
- **DECIDE:** el ancho del inserto (y por tanto su costo y el tamaño del mold base). Si engordar la
  mejilla sale caro ⇒ **interlock** (A-114).
- **CRITERIO:** [LIBRO] regla de dedo + fórmula exacta que la valida. El libro **repite esta
  verificación en tres capítulos** (§4.2.2, §12.2.4, §13.9.1) — señal de que importa.
- **INVALIDA:** cambio de profundidad de cavidad o de metal.
- **¿TENEMOS?** **Parcial.** `mold-contratos.ts:layout-cheek` exige
  `cheek >= max(3·Ø_agua, profundidad de cavidad)` — cubre la **regla de dedo** cruzada con la regla
  de agua de §4.2.2, y dice cuál domina. **FALTA la Ec. 12.15 exacta** (`2·H·sqrt(P/sigma_limit)`,
  que es la que muestra que la regla trae margen) y **FALTA la Ec. 12.17** de deflexión de la pared.

### A-114 — Interlock en el plano de partición
- **§** 12.2.5 · **CUÁNDO:** cuando A-113 pide una mejilla que cuesta demasiado.
- **ENTRADAS:** `P` de fundido · Ø del interlock · profundidad de cavidad `H` · material del interlock
  (S7 típico).
- **CÁLCULO:** fuerza lateral con supuesto conservador — *"half of the force"* la lleva el interlock:
  `F_lateral = 0.5·P·phi_interlock·H_cavidad`; luego `tau = F/A`, y con S7 el diseño debe quedar por
  **debajo de 300 MPa**.
- **SALIDA:** `tau [MPa]` vs 300 MPa; veredicto.
- **DECIDE:** interlock **redondo** (disponible en tamaños chicos, más fácil de instalar) o
  **rectangular** (más rígido por su área). Colocación: sobre el plano de partición y **lo más cerca
  posible de la cavidad**. Efecto cuantificado: el interlock
  *"doubles the stiffness of the side wall"*, o sea **la mitad de deflexión**.
- **CRITERIO:** [LIBRO] `tau < 300 MPa` para S7. **Y una advertencia que puede volver el remedio peor
  que la enfermedad:** no comprometer la integridad estructural de la pared lateral al hacerle el
  bolsillo del interlock.
- **INVALIDA:** mover el interlock (la distancia a la cavidad es el criterio visual real, V12.11).
- **¿TENEMOS?** **SÍ.** `mold-interlocks.ts:interlockShear()` con `TAU_LIMIT_S7_MPA = 300`,
  `ROUND_INTERLOCKS_MM` de catálogo, y `planInterlocks()` que decide redondo/rectangular y documenta
  el montaje (macho pasante en B, hembra en bolsa ciega en A, retenidos con SHCS).

### A-115 — Concentración de esfuerzo alrededor de un barreno
- **§** 12.2.6, Ec. 12.19 · **CUÁNDO:** por cada barreno del molde (agua, eyector, tornillo).
- **ENTRADAS:** Ø del barreno · `H_hole` = distancia de la superficie de cavidad **al centro** del
  barreno · esfuerzo nominal.
- **CÁLCULO:** `K = 3.1 + 0.75·(phi_hole/H_hole)^2.29`. Validación del libro: barreno a 1.5 diámetros
  con 100 MPa aplicados ⇒ von Mises máximo 340 MPa ⇒ **K = 3.4**.
- **SALIDA:** `K` (adimensional) y `sigma_local = K·sigma_nominal [MPa]`.
- **DECIDE:** distancia mínima del barreno (A-116) y **elección de metal**: las aplicaciones de alta
  presión piden aceros de alto endurance (A6, D2, H13).
- **CRITERIO:** [LIBRO] y **el hecho contraintuitivo del capítulo**:
  *"a stress concentration of 3 results even when a hole is located far from the cavity surface"* —
  K nunca baja de ~3. Eso explica por qué los moldes de alta presión agrietan desde las líneas de agua
  **aunque estén bien lejos**.
- **INVALIDA:** re-escalar el molde (mueve la superficie de cavidad).
- **¿TENEMOS?** **SÍ.** `lamina-vonmises.ts` implementa `K = 3.1 + 0.75·(Ø/H)^2.29` literal y mide la
  concentración contra el mismo campo sin barreno. **Nota:** `mold-analysis.ts` y `cooling-design.ts`
  usan además la **Fig. 9.4** (K = 3.3 a 1Ø, 2.6 a 4Ø) — es otra curva del mismo libro, tabulada, no
  interpolable; hay que declarar cuál se usa dónde.

### A-116 — Distancia mínima de línea de agua a la cavidad
- **§** 12.2.6 · **CUÁNDO:** al rutear el circuito de enfriamiento, y como auditoría por línea.
- **ENTRADAS:** `sigma_endurance` del metal ←A-105 · `sigma_nominal` (presión de fundido esperada) ·
  Ø del barreno de agua.
- **CÁLCULO:** despejar de la Ec. 12.19 con `K_admisible = sigma_endurance / sigma_nominal`:
  `H_hole = phi_hole·(0.75/(K − 3.1))^(1/2.29)`. Ejemplo: H13 a 200 MPa ⇒ barreno de 9.5 mm a
  **≥ 11.1 mm** del acero de cavidad.
- **SALIDA:** `H_min [mm]` por línea; semáforo por **cada** línea de agua del molde.
- **DECIDE:** el ruteo del circuito. **RETORNO a agua.**
- **CRITERIO:** [LIBRO] con una **jerarquía de riesgo declarada**: las líneas de agua causan más
  problemas que los barrenos de eyector, porque sus grietas terminan **fugando** y arruinando calidad.
- **INVALIDA:** cambio de metal (sube o baja el endurance) o de presión esperada.
- **¿TENEMOS?** **Parcial y con otra vara.** `cooling-design.ts` verifica profundidad 2D–5D y avisa
  `H < 2D`; `mold-analysis.ts` aplica la K de la Fig. 9.4 para sacar `P_melt` máxima admisible
  (P20 a 4Ø → 175 MPa; aluminio a 1Ø → 50 MPa). **FALTA el despeje de la Ec. 12.19** que da `H_min`
  directamente por línea, que es la forma en que el cap. 12 lo plantea.

### A-117 — Barreno de eyector: ovalización y vida a fatiga
- **§** 12.2.6 · **CUÁNDO:** por cada barreno de eyector cercano a la cavidad.
- **ENTRADAS:** Ø del pin · acero entre barreno y cavidad ←A-88 · `sigma_yield` y `sigma_endurance`
  del metal ←A-105 · presión de fundido.
- **CÁLCULO:** `K` ←A-115 y `sigma_local`. Ejemplo QC7: pin de 4 mm con **0.5 mm** de aluminio ⇒
  **K = 5.3** ⇒ 530 MPa. Está **por debajo** del yield (545 MPa) pero **muy por encima** del endurance
  (166 MPa) ⇒ falla en ≈ **1,000 ciclos**.
- **SALIDA:** `sigma_local [MPa]`, vida estimada [ciclos], deformación del barreno [mm].
- **DECIDE:** alejar el barreno, achicar el pin o cambiar de metal.
- **CRITERIO:** [LIBRO] **la trampa "abajo del yield ≠ seguro"** — ésta es la ficha que resume la vara
  del capítulo entero. Y un matiz: las grietas desde barrenos de eyector rara vez son catastróficas
  (el barreno deformado se apoya en el pin y la grieta se frena), pero **se ovalan** y el pin se atora.
  Dato de humildad del modelo: el FEA dio **0.10 mm** de deformación contra **0.03 mm** del cálculo a
  mano, por flexión local en la boca del barreno que el analítico no captura (ficha V12.13).
- **INVALIDA:** cambio de metal o de layout de eyección.
- **¿TENEMOS?** **Parcial.** `lamina-vonmises.ts` tiene la K y `MOLD_METALS` los dos límites, pero
  **FALTA** el veredicto combinado "pasa yield / muere por fatiga en N ciclos" por barreno, que es
  exactamente la lección.

### A-118 — Corazón hueco: compresión axial
- **§** 12.3.1 · **CUÁNDO:** cuando el corazón es **profundo** — clasificación del libro:
  *"a core can be considered"* **"shallow"** cuando su altura es menor que **tanto** el ancho **como**
  el largo; shallow ⇒ se trata como placa (A-109); profundo ⇒ análisis propio.
- **ENTRADAS:** presión de fundido sobre la cara superior · área **anular** de pared (no la
  proyectada) · altura del corazón · `E`.
- **CÁLCULO:** `sigma = F/A_anular`; `delta_total = delta_compresión_paredes +
  delta_flexión_cara_superior` (superposición). Ejemplo del cup: **216 MPa**.
- **SALIDA:** `sigma [MPa]`, `delta [mm]`.
- **DECIDE:** el material del corazón. Lectura del libro sobre sus propios 216 MPa: ni acero suave ni
  aluminio sirven para ese caso, considerando la carga cíclica y la fatiga.
- **CRITERIO:** [LIBRO] contra `sigma_endurance` ←A-105. **Y el supuesto conservador de oro:** asumir
  que el inserto de enfriamiento interior **no da soporte** — *"assuming that the cooling insert
  provides no support"* — por dos razones: *"Any gap greater than the deflection of the core"* anula
  completamente el soporte, y el inserto puede ser de material más débil. **La ficha V12.14 lo llama
  lo que es: una advertencia contra creerle a la imagen.**
- **INVALIDA:** cambio de presión o de geometría del corazón.
- **¿TENEMOS?** **SÍ.** `cores.ts:axialStress()`, `axialDeflectionMm()` y `designCore()`, con el
  ejemplo del cup reproducido exacto (216 MPa, delta 0.06 mm) y el chequeo contra
  `m.fatigueLimitMPa`.

### A-119 — Corazón hueco: esfuerzo de aro con DOBLE vara
- **§** 12.3.2, Ec. 12.20 · **CUÁNDO:** junto con A-118.
- **ENTRADAS:** `P` de fundido esperada y de sobrepresión (~200 MPa) · Ø exterior del corazón ·
  espesor de pared · `sigma_endurance` y `sigma_yield` ←A-105.
- **CÁLCULO:** `sigma_hoop = P·phi/(2·h)`; despejes `h > P·phi/(2·sigma_limit)` y
  `phi_inner < phi·(1 − P/sigma_limit)`. Reglas de dedo para P20 a 150 MPa: **pared ≥ phi/6** y
  **hueco ≤ ⅔·phi**.
- **SALIDA:** `sigma_hoop [MPa]`, `h_min [mm]`, `phi_inner_max [mm]` — **dos valores**, uno por vara.
- **DECIDE:** el hueco interior máximo del corazón (y por tanto cuánto enfriamiento cabe adentro).
- **CRITERIO:** [LIBRO] **verificación DOBLE obligatoria**: (a) **fatiga** a la presión esperada con
  `sigma_endurance`; (b) **fluencia** ante una **sobrepresión** accidental de la máquina (~200 MPa, un
  solo ciclo malo) con `sigma_yield`. En el ejemplo QC7 gana la fatiga: hueco máximo **31 mm**, no 38.
  Textual: *"cyclic fatigue is a more critical issue than yield in an overpressure situation"*.
- **INVALIDA:** cambiar el metal, o que la máquina cambie su presión máxima.
- **¿TENEMOS?** **SÍ y ejemplar.** `cores.ts:hoopStress()`, `minWallThickness()`,
  `maxInnerDiameter()` y `designCore()` devuelven `innerMaxMm: {fatiga, sobrepresion, gobierna,
  govBy}` — las dos varas y **cuál gobierna**, reproduciendo los 31 vs 38 mm del libro.

### A-120 — Flexión de corazón esbelto (core bending)
- **§** 12.3.3, Ecs. 12.25–12.26 · **CUÁNDO:** corazones altos respecto a su diámetro.
- **ENTRADAS:** `delta_P` = diferencial de presión de un lado al otro ←A-121 · Ø exterior e interior ·
  altura `H` · `E`.
- **CÁLCULO:** `I = pi·(phi_ext⁴ − phi_int⁴)/64`; `delta = delta_P·phi·H⁴/(8·E·I)`.
- **SALIDA:** `delta [mm]` lateral en la punta del corazón.
- **DECIDE:** la **escalera de remedios en orden**: (1) corazón sólido con L/D mínimo;
  (2) **interlockear la punta contra el lado fijo** — reduce la deflexión a ≈ **10 %** de la de un
  corazón apoyado en un solo extremo; (3) si no se puede, **recomendar fuertemente** compuerta central
  arriba o **dos compuertas opuestas** abajo para minimizar el gradiente de presión → **RETORNO a
  alimentación**; (4) **flow leaders**, que dejan que el frente entre a las secciones delgadas
  adyacentes y **congele parcialmente**, atrancando el corazón antes de que se doble.
- **CRITERIO:** [LIBRO] con **dos trampas**: el efecto es **auto-reforzante** (una flexión leve deja
  pasar más flujo al lado ya grueso, lo que la aumenta) y va con la **cuarta potencia** de la altura,
  así que una asimetría chica de presión dobla corazones largos. "Muy esbelto" = altura del orden de
  **diez veces** el diámetro.
  Nota de conflicto declarada por el libro: un flow leader en la superficie **interior** puede estorbar
  si la pieza contiene fluidos ⇒ pasarlo a la superficie exterior, en la cavidad.
- **INVALIDA:** cambio de gate (cambia `delta_P`) o interlockear la punta (cambia el modelo entero).
- **¿TENEMOS?** **Parcial — SÍ el cálculo.** `cores.ts:coreInertiaM4()` y `coreBendingMm()` (verificados:
  I 5.1e-7, delta_flex 0.03 mm del cup). `flowleaders.ts` existe como recurso de llenado. **FALTA**
  la escalera de remedios como decisión encadenada (sobre todo el "interlock de punta → 10 %" y el
  retorno a alimentación).

### A-121 — Estimación del diferencial de presión sobre el corazón
- **§** 12.3.3 · **CUÁNDO:** antes de A-120; sin este número no hay flexión de corazón.
- **ENTRADAS:** presión de llenado ←`analisis-caps4-6` · posición de la compuerta · esbeltez del
  corazón.
- **CÁLCULO:** **no hay fórmula, hay regla de dedo declarada:** corazón corto con compuerta lateral ⇒
  `delta_P ≈ 50 %` de la presión de llenado; corazón muy largo respecto a su diámetro ⇒ `≈ 10 %`.
- **SALIDA:** `delta_P [MPa]`.
- **DECIDE:** el valor que entra a A-120.
- **CRITERIO:** [JUICIO] con dos anclas numéricas del libro y la advertencia de que, por la cuarta
  potencia, **el resultado es muy sensible a este estimado**.
- **INVALIDA:** una simulación de llenado que dé el `delta_P` real (lo reemplaza).
- **¿TENEMOS?** **FALTA.** `coreBendingMm()` recibe `delta_P` pero nadie lo estima con la regla del
  libro ni lo deriva de la simulación de llenado que sí tenemos (`flowlen*.ts`).

### A-122 — Ajustes (fits): límites dimensionales
- **§** 12.4.1, Ecs. 12.27–12.28 · **CUÁNDO:** al detallar cada interfaz inserto↔placa.
- **ENTRADAS:** dimensiones del inserto (`W`, `L` si es rectangular) · clase de ajuste elegida ·
  Tabla 12.1 (ANSI B4.1-1967(R1999), barreno lateral).
- **CÁLCULO:** miembro rectangular ⇒ **diámetro aparente** `D = sqrt(W·L)` (Ec. 12.27);
  `lambda = 0.001·C·D^(1/3)` (Ec. 12.28) con los coeficientes `C` de la Tabla 12.1 —
  LN1 (4.89 | hembra 0.00/4.93 | macho 5.67/9.05), LN2, LN3, FN1 (13.57 | 0.00/4.93 | 14.34/17.73),
  FN2, FN3. La interferencia rígida sale con diferencias del orden de
  *"0.01% of the nominal dimension"*.
- **SALIDA:** dimensiones **mín/máx del inserto y del bolsillo** [mm] (ejemplo FN1: inserto
  88.96/88.98 contra barreno 88.90/88.92).
- **DECIDE:** la cota que **baja automáticamente al plano** de cada placa e inserto.
- **CRITERIO:** [LIBRO] con criterio de selección de clase: **LN** cuando la precisión de localización
  es crítica y hace falta rigidez lateral, pero **no** dan retención en altura; **FN1–FN3** son drive
  fits semi-permanentes. En ambos casos **siempre tornillos en la dirección de altura**.
- **INVALIDA:** cambiar el tamaño del inserto (cambia `D` y todos los límites).
- **¿TENEMOS?** **SÍ.** `fits.ts:apparentDia()`, `interferenceFit()` con la `C_TABLE` completa
  (LN1–LN3, FN1–FN3) y la Ec. 12.28 literal.

### A-123 — Fuerza de inserción del ajuste vs prensa del taller
- **§** 12.4.1, Ecs. 12.29–12.31 · **CUÁNDO:** inmediatamente después de A-122. **Es el check que
  vuelve inarmable un ajuste "correcto".**
- **ENTRADAS:** `lambda` de interferencia ←A-122 · `D` aparente · altura de contacto `H` · `E` ·
  **capacidad de prensa del taller** (dato externo).
- **CÁLCULO:** `sigma = lambda·E/(2·D)` (el 2 porque la interferencia también tensa la placa);
  `F_insertion = f·sigma·(pi·D·H)` con `f ≈ 1.0`. Ejemplo FN1 de 88.9 mm en el cup: **808 kN ≈
  180,000 lb**.
- **SALIDA:** `F_insertion [kN]`.
- **DECIDE:** si el taller tiene prensa. Si no, **bajar a un fit de localización LN**. Y en todos los
  casos: chaflán o taper guía en el borde de ataque del inserto.
- **CRITERIO:** [COMPARA] contra la capacidad real de prensa del taller — que es un dato pedido al
  usuario y se marca `NO OBSERVADO` si falta.
- **INVALIDA:** cambio de clase de ajuste o de altura de contacto.
- **¿TENEMOS?** **FALTA.** `fits.ts` calcula la interferencia pero **no la fuerza de inserción**, ni
  compara contra prensa del taller. Es la mitad que importa: un FN1 de 808 kN pasa todos los checks
  dimensionales y no se puede armar.

### A-124 — Tornillos SHCS por peor caso de izaje
- **§** 12.4.2, Ec. 12.32 · **CUÁNDO:** al especificar la tornillería crítica que sujeta las mitades.
- **ENTRADAS:** masa del molde (bloque sólido de acero con las dimensiones exteriores, rho = 7800) ·
  distancia del centro de gravedad al anillo centrador · posición del tornillo.
- **CÁLCULO:** capacidad `F_tensil = 800 MPa·pi·D²/4`. Carga del peor caso:
  `F_screw = M·n_g·g·(L_COG/L_screw)`, momentos alrededor del anillo localizador, con
  **`n_g = 10`** *"Due to the shock of a crane"*. El escenario apilado: el molde sujeto a **una sola**
  platina (como al instalarlo) y sostenido por **un solo** tornillo apretado. Resultado del bezel:
  8.65 mm ⇒ redondear a **M10** o 3/8" (la mold base traía ½", sobrada).
- **SALIDA:** `D_rosca [mm]` mínima.
- **DECIDE:** la tornillería de sujeción de mitades. Y reglas geométricas del SHCS: altura de cabeza =
  diámetro de rosca; diámetro de cabeza ≈ **150 %** del diámetro de rosca.
- **CRITERIO:** [LIBRO] escenario de peor caso porque el fallo puede costar equipo o vidas. **Este
  `n_g = 10` es el factor de seguridad; no se le apila otro** (coherente con A-104).
- **INVALIDA:** cambio del tamaño/masa del molde.
- **¿TENEMOS?** **SÍ.** `fasteners.ts:worstCaseScrewForce(massKg, lCogM, lScrewM, nG=10, g=9.8)` y
  `mold-fasteners.ts` eligen el Ø, con la nota correcta de que en ESE escenario la fuerza **no se
  reparte** entre los N tornillos; `mold-drawing-set.ts` la baja al plano.

### A-125 — Dowels: juego esperado y peor caso de interferencia
- **§** 12.4.3 · **CUÁNDO:** al especificar la localización entre placas.
- **ENTRADAS:** Ø del dowel · clase de ajuste (Tabla 12.2: LC1 −4.16, LT1 −6.38, LT3 −0.73, LN1 4.89).
- **CÁLCULO:** **AMBOS extremos de la tolerancia**, no el promedio: el juego esperado (LT3 de 12 mm da
  ~1.5 μm promedio) **y** la fuerza de inserción en el peor caso de interferencia (0.013 mm ⇒
  **50 kN**).
- **SALIDA:** juego [μm] y `F_insertion` de peor caso [kN].
- **DECIDE:** la clase de ajuste del dowel, y si el ensamble es **desarmable a mano para dar
  servicio**. Con 50 kN, *"separation of the mold plates can not be accomplished manually"* y el
  ensamblador tendría que rectificar el pin.
- **CRITERIO:** [LIBRO] arranca con una regla dura: **los tornillos NO localizan** (su claro radial es
  grande). **LC1 no se recomienda** en moldes porque el claro grande acelera el desgaste de superficies
  deslizantes; **LT3 es el default práctico** (el que usa el ejemplo).
- **INVALIDA:** cambio de tolerancias del taller.
- **¿TENEMOS?** **FALTA.** `fits.ts` cubre la Tabla 12.1 (insertos) pero **no la Tabla 12.2** de
  dowels (LC1/LT1/LT3/LN1), ni el peor caso de interferencia, ni el veredicto de desarmabilidad.

### A-126 — Cierre estructural: los tres veredictos independientes
- **§** 12.5 · **CUÁNDO:** gate de cierre del subsistema.
- **ENTRADAS:** A-106 (esfuerzo) · A-105 (fatiga) · A-107/A-111 (deflexión).
- **CÁLCULO:** **CUALITATIVO**, tres veredictos que se corren por separado y ninguno cubre al otro:
  (1) no cede ante **una sola** sobrepresión (yield); (2) no falla por **fatiga** a los N ciclos
  objetivo; (3) no flexiona más que el venteo / la tolerancia (flash + desgaste acelerado del plano de
  partición).
- **SALIDA:** tres semáforos.
- **DECIDE:** liberar el molde a construcción o iterar.
- **CRITERIO:** [LIBRO] jerarquía declarada: *"fatigue and deflection tend to dominate"*, aunque el
  peso relativo depende del número de cavidades, las presiones, la geometría y la cantidad a producir.
  **Y la iteración es parte del método, no un fracaso:** los sujetadores pueden interferir con la
  expulsión y el enfriamiento, y entonces
  *"iterative redesign of the mold may be required"* para acomodar todos los subsistemas sin subir
  tamaño ni costo.
- **INVALIDA:** cualquier cambio en cualquier subsistema. Es el nodo de retorno del capítulo.
- **¿TENEMOS?** **Parcial.** `mold-contratos.ts` agrupa el subsistema estructural con sus criterios y
  `resumir()` da estado, pero **los tres veredictos no están separados como tres semáforos
  explícitos** (hoy fatiga y deflexión están mezclados en la lista general). Es un cambio de
  presentación, no de motor.

---
# CAPÍTULO 13 — TECNOLOGÍAS DE MOLDE

> El cap. 13 es **descriptivo**: casi no trae ecuaciones nuevas. Su aporte al grafo es de otro tipo y
> es doble. (1) **La decisión temprana**: el árbol de la Fig. 13.1 se corre **antes** de que empiecen
> los caps. 4–12, porque elegir canal caliente vs frío, o stack, o multi-shot, cambia todo lo de abajo.
> (2) **§13.10, la gobernanza**: el entregable no es la geometría, es el **registro de decisiones
> aprobado y documentado entre todas las partes**. Las pocas fichas con número que trae el capítulo
> son casi todas **reusos** de análisis de los caps. 9 y 12 aplicados a un contexto nuevo.

### A-127 — Selección de tecnología de molde (la decisión temprana)
- **§** 13.1, Fig. 13.1 · **CUÁNDO:** **antes** del layout del molde; es una decisión de arquitectura,
  no de detalle.
- **ENTRADAS:** la necesidad de negocio en la raíz del árbol (calidad / costo / time-to-market) y su
  rama concreta: multi-material · pieza hueca · superficie estética · geometría compleja · mejor
  control de flujo · más cavitación · menos tonelaje de cierre · menos desperdicio · menor herramental
  · más rápido al mercado.
- **CÁLCULO:** **CUALITATIVO**, recorrido del flow chart. Mapa completo:
  plástico sobre otro material → **insert mold** · plástico sobre plástico → **multi-shot** ·
  plástico dentro de plástico → **coinyección** · fluido dentro del plástico → **gas/water assist** ·
  plástico inflado → **injection blow** · interior complejo → **lost core** · superficie decorada →
  **in-mold labeling** · superficie brillante/transparente → **control de T de pared** ·
  sin marcas de testigo → **reverse ejection** · exterior complejo → **split cavity** ·
  features interiores → **rotating core** · tolerancias cerradas → **inyección-compresión** ·
  mejor control de flujo → **Dynamic Feed / Melt Flipper** · mayor cavitación → **canal caliente** ·
  menor tonelaje → **stack mold** · menos desperdicio → **insulated runner** · menor cavitación →
  **dos placas** · más rápido al mercado → **molde prototipo** (HSM).
- **SALIDA:** la tecnología elegida + su §.
- **DECIDE:** la arquitectura del molde entero, y por tanto qué análisis de los caps. 4–12 aplican.
- **CRITERIO:** [JUICIO] — el árbol es un índice de decisiones, no un criterio de defecto (ficha V13.1
  lo dice explícito). El valor está en poder **justificar** la elección ("¿por qué canal caliente y no
  tres placas?").
- **INVALIDA:** cambio de requisito de negocio o de volumen de producción.
- **¿TENEMOS?** **Parcial.** `moldtech.ts:chooseMoldTechnology()` cubre bien la rama **§13.9**
  (split-cavity, collapsible, unscrewing, reverse-ejection, side-action, estándar) con los criterios
  literales. **FALTA la rama de costo/productividad** del árbol (hot runner, stack, insulated runner,
  dos placas, prototipo) — que en la práctica es la que más plata mueve; hoy la arquitectura
  frío/caliente se decide en `feed.ts`/`moldmachine.ts` por break-even, no por el árbol de §13.1.

### A-128 — Meta-material de coinyección
- **§** 13.2.2 · **CUÁNDO:** si A-127 eligió coinyección.
- **ENTRADAS:** propiedades de los dos materiales · espesor de cada capa.
- **CÁLCULO:** dos ajustes al análisis normal. (a) **Llenado:** diseñar la cavidad para que llene
  completa **solo con el material MÁS VISCOSO**. (b) **Enfriamiento, contracción y expulsión:** derivar
  un **"meta-material"** con propiedades ponderadas por el espesor de las dos capas.
- **SALIDA:** propiedades del meta-material (E, CTE, k, rho, cp) que se inyectan a A-63, A-81 y al
  cap. 9.
- **DECIDE:** con qué números se corren los caps. 5, 9, 10 y 11 en una pieza de dos materiales.
- **CRITERIO:** [LIBRO] *"many conventional molds can be successfully used in a coinjection process
  since the mechanisms for coinjection are mostly integrated with the molding machine and not the mold
  itself"* — o sea: el molde casi no cambia, **los números sí**.
- **INVALIDA:** cambiar la relación de espesores entre capas.
- **¿TENEMOS?** **FALTA.** No hay coinyección ni meta-material.

### A-129 — Canal de flujo para gas/water assist
- **§** 13.2.3 · **CUÁNDO:** si A-127 eligió asistido por fluido.
- **ENTRADAS:** secciones candidatas de canal (Fig. 13.5) · espesor de pared remanente medido
  radialmente alrededor del canal.
- **CÁLCULO:** **uniformidad del espesor de pared remanente** — desviación estándar del espesor medido
  radialmente en cada sección candidata. La sección superior derecha de la Fig. 13.5 es
  **la peor** (pared irregular); las demás son aceptables.
- **SALIDA:** ranking de secciones por uniformidad.
- **DECIDE:** la geometría del canal de gas.
- **CRITERIO:** [LIBRO] **la regla contraintuitiva del capítulo**: el espesor uniforme —virtud clásica
  del diseño de pieza— **arruina** el asistido por fluido, porque el gas o el agua *"finger"* en
  direcciones aleatorias por una cavidad de espesor parejo, debilitando la pieza sin quitarle peso.
  Por eso se **añaden canales gruesos** que dirijan el fluido.
  Y para water assist, dos consecuencias de diseño: hay que **sacar el agua** antes de abrir, y la
  humedad y la corrosión piden un material resistente como **SS420**.
- **INVALIDA:** cambio de la geometría de la pieza.
- **¿TENEMOS?** **FALTA.** No hay gas/water assist. La métrica de uniformidad de espesor existe en
  `dfm-mesh.ts` para el DFM de pieza y sería reusable.

### A-130 — Espesor de la segunda capa en multi-shot
- **§** 13.5 · **CUÁNDO:** si A-127 eligió multi-shot.
- **ENTRADAS:** espesor de la primera capa · análisis de flujo de calor **a un solo lado** (§9.3.5.6).
- **CÁLCULO:** la primera capa **aísla**, así que el calor de la segunda solo puede salir por un lado ⇒
  *"the second layer should be 40% thinner than the first layer to avoid extending the cycle time"*.
- **SALIDA:** espesor máximo de la segunda capa [mm].
- **DECIDE:** la geometría de la segunda capa, y el tiempo de ciclo del molde.
- **CRITERIO:** [LIBRO] umbral relativo literal (−40 %). Y una **doble cara declarada**: el segundo
  disparo **funde y borra** imperfecciones y líneas de testigo de la primera capa (oportunidad), pero
  por lo mismo **degrada detalle fino** — hay que evitar poner detalles finos donde el segundo tiro
  los va a lavar.
- **INVALIDA:** cambio del espesor de la primera capa.
- **¿TENEMOS?** **FALTA.** El motor térmico de una cara existe (`thermal-layers.ts`,
  `thermal-series.ts`) pero no la regla del −40 % ni el multi-shot como arquitectura.

### A-131 — Core-back: cuchillas divisorias
- **§** 13.5.2 · **CUÁNDO:** si el multi-shot se resuelve con core-back.
- **ENTRADAS:** espesor de cavidad · presión de fundido · geometría de las cuchillas.
- **CÁLCULO:** **reuso del cap. 12**: cortante y flexión de las cuchillas divisorias con los métodos
  de A-109/A-113, para el espesor de cavidad y la presión de fundido.
- **SALIDA:** espesor mínimo de cuchilla [mm]; veredicto.
- **DECIDE:** el diseño preferido del libro es **un solo juego de cuchillas que interlockea con una
  ranura en la cara opuesta** de la cavidad. Alternativa: **una sección central actuada** — y el
  hallazgo es que **no requiere gran fuerza de actuación**, porque esa sección no ve presión mientras
  se moldean las zonas laterales, y al retraerse se apoya en un hombro.
- **CRITERIO:** [LIBRO] los métodos estructurales del cap. 12 aplicados a un componente nuevo.
- **INVALIDA:** cambio de la partición entre disparos.
- **¿TENEMOS?** **FALTA.** No hay core-back.

### A-132 — Insulated runner: piel congelada
- **§** 13.6.1 · **CUÁNDO:** al evaluar arquitecturas de alimentación de bajo costo.
- **ENTRADAS:** Ø de runner · tiempo de ciclo.
- **CÁLCULO:** con Ø de runner grande (~**25 mm**) y ciclos de ~**60 s**, la piel congelada queda de
  ~**6 mm** y el canal opera como hot runner **sin calentadores ni termopares**.
- **SALIDA:** Ø de runner y espesor de piel [mm]; ¿opera sin calentar?
- **DECIDE:** usar insulated runner en vez de hot runner. El cambio de color se resuelve abriendo la
  sección de runner y sacando el sistema completo.
- **CRITERIO:** [JUICIO] el libro **declara que su uso decayó** al abaratarse los hot runners; se
  presenta como opción de bajo costo con incertidumbre de proceso.
- **INVALIDA:** cambio de tiempo de ciclo (si el ciclo se alarga mucho, el canal se congela entero).
- **¿TENEMOS?** **FALTA.** `feed.ts`/`feed-layouts.ts` cubren frío y caliente, no insulated.

### A-133 — Stack mold: clamp compartido contra sus cinco costos
- **§** 13.6.2 · **CUÁNDO:** al elegir arquitectura, si hay presión de productividad.
- **ENTRADAS:** área proyectada por nivel · tonelaje disponible · altura de apilamiento disponible en
  la máquina (stack height) · volumen de inyección · plan de cambios de color.
- **CÁLCULO:** el clamp es proporcional al **área proyectada**, así que cavidades **apiladas comparten
  la fuerza de cierre**: dos niveles producen el doble con **el mismo clamp y el mismo ciclo**.
- **SALIDA:** número de niveles factible + tonelaje requerido + stack height requerido.
- **DECIDE:** stack mold sí o no. El libro exige balancearlo contra **cinco** cosas: inversión,
  mantenimiento, cambio de color, stack height y volumen de inyección.
- **CRITERIO:** [JUICIO] de negocio, con los cinco ejes nombrados. Nota histórica útil: el diseño viejo
  con sprue extendido tenía scrap y desbalance; **el hot runner resuelve ambos**.
- **INVALIDA:** cambio de máquina (stack height y volumen de inyección son de la máquina).
- **¿TENEMOS?** **FALTA como arquitectura.** `machinesizing.ts` sabe de tonelaje y ventana de shot, y
  `moldcost-detailed.ts` de break-even, pero el stack mold no está modelado.

### A-134 — Desbalance térmico de runner ramificado (Melt Flipper)
- **§** 13.6.3 · **CUÁNDO:** en cualquier feed system con **dos o más niveles de ramificación**.
- **ENTRADAS:** topología del árbol de runners (número de niveles de branch) · reología del material ·
  condiciones de proceso.
- **CÁLCULO:** **CUALITATIVO con mecanismo explícito.** Aun con balance geométrico ("naturally
  balanced"), el perfil térmico y de corte **lateral** del fundido desbalancea ramas idénticas: el
  núcleo viscoso va rodeado de una capa más caliente y menos viscosa, y al ramificar el material de
  baja viscosidad se queda del lado exterior ⇒ **cavidades más pesadas según su posición**.
  Remedio: **cambio de nivel justo antes de la rama** (inserto de cavidad + corazón) que reorienta la
  variación de viscosidad **a vertical**.
- **SALIDA:** bandera de riesgo de desbalance + posición recomendada del cambio de nivel.
- **DECIDE:** meter o no un Melt Flipper y **dónde**.
- **CRITERIO:** [LIBRO] con la **contra-trampa**: la variación *"is only"* reorientada y no eliminada,
  así que encadenar dos cambios de nivel en ramas consecutivas **`re-establish`** el desbalance. Y el
  efecto depende de la reología y del proceso.
- **INVALIDA:** cambio de la topología del feed system.
- **¿TENEMOS?** **FALTA.** `feed-layouts.ts` sabe de balanceo **geométrico** (serie vs H) y advierte
  el desbalance de las ramas en serie, pero **no modela el desbalance térmico/de corte** ni el cambio
  de nivel. Es una alarma barata: "≥2 niveles de branching ⇒ bandera".

### A-135 — Pulsed cooling: energía por ciclo
- **§** 13.7.1 · **CUÁNDO:** si se evalúa control activo de temperatura de pared.
- **ENTRADAS:** masa de acero que se cicla térmicamente · rango de temperatura · costo de la energía.
- **CÁLCULO:** cálculo económico con el número del libro: **100 kg de P20 ± 100 °C = 10 MJ ≈ 3 kWh ≈
  $0.30 USD por ciclo SOLO de energía**.
- **SALIDA:** costo energético por ciclo [USD].
- **DECIDE:** casi siempre **no usarlo** — el libro concluye que no se usa salvo en aplicaciones muy
  exigentes. Si se usa: minimizar masa térmica, meter air gaps y hojas aislantes contra las platinas,
  con dos fluidos separados (uno caliente, uno frío) conmutados.
- **CRITERIO:** [LIBRO] el criterio es **económico y calculado**, no técnico. Ésa es la lección.
- **INVALIDA:** cambio del costo de energía o de la masa del inserto.
- **¿TENEMOS?** **FALTA.**

### A-136 — Conduction heating: potencia mínima contra el drenaje al agua
- **§** 13.7.2 · **CUÁNDO:** si se evalúa calentar la pared por resistencia.
- **ENTRADAS:** potencia del calefactor · flujo de calor hacia el circuito de agua · área de superficie.
- **CÁLCULO:** el calefactor debe **primero vencer el drenaje hacia el agua** antes de subir la
  temperatura de la superficie: en el ejemplo, ~**1.4 W/cm²**, o **≥420 W** de entrega solo para
  empatar la fuga. El libro **desnuda una patente** con este análisis: 113 W entregados contra
  ~0.13 kWh necesarios — no cuadra.
- **SALIDA:** potencia mínima [W] y densidad [W/cm²].
- **DECIDE:** descartar o dimensionar. **Tres razones de fracaso en la práctica**, declaradas: la
  presión cíclica **fatiga** los calefactores; la uniformidad de temperatura de pared es difícil; y el
  calefactor queda **entre cavidad y agua**, así que alarga el enfriamiento.
- **CRITERIO:** [LIBRO] balance de potencia; el criterio es que la entrega supere la fuga.
- **INVALIDA:** cambio del circuito de agua.
- **¿TENEMOS?** **FALTA.** Tenemos el motor de resistencia térmica (`thermal-resistance.ts`,
  `thermal-steady.ts`) que haría este balance casi gratis.

### A-137 — Induction heating: ventana de potencia y gradiente
- **§** 13.7.3 · **CUÁNDO:** si se evalúa calentar la pared por inducción.
- **ENTRADAS:** frecuencia, corriente y densidad de espiras · mapa térmico de la superficie del molde.
- **CÁLCULO:** potencia proporcional a `f²·I²·(densidad de espiras)²`. **Ventana experimental:** una
  potencia **menor a 100 W/cm²** *"did not significantly increase the mold surface temperature and
  eventually caused the overload breaker to actuate"*; por encima de **10,000 W/cm²** la subida se
  vuelve incontrolable. Ejemplo: 400 kHz, ~10 s para +50 °C.
- **SALIDA:** densidad de potencia [W/cm²] y `delta_T` sobre la superficie [°C].
- **DECIDE:** parámetros del inductor, o descartar.
- **CRITERIO:** [LIBRO] **umbral absoluto y visible en un mapa térmico**: diferencias de más de
  **50 °C** sobre la superficie producen irregularidades de brillo y sink. La ficha V13.3 lo llama el
  gemelo caliente del gradiente de 6 °C del cap. 9.
- **INVALIDA:** cambio de geometría del inductor.
- **¿TENEMOS?** **FALTA.**

### A-138 — In-mold labeling: carga sobre el film
- **§** 13.8.1 · **CUÁNDO:** si A-127 eligió IML.
- **ENTRADAS:** espesor del film (~**0.15 mm**, 5 mils, del **mismo** polímero que la pieza) ·
  velocidad del frente de flujo (no la presión) · zonas impresas.
- **CÁLCULO:** **la trampa:** la carga estructural sobre el film la manda el **CORTANTE del flujo**
  (o sea la velocidad), **no la magnitud de la presión** de fundido — se analiza con §5.3.1.
- **SALIDA:** cortante sobre el film [Pa] y veredicto de integridad.
- **DECIDE:** el perfil de velocidad de inyección y el espesor del film. Si el film es **muy delgado**
  se funde completo y **destruye el diseño impreso**; si la impresión no fusiona,
  *"the printing may be imperceptibly"* dithered para permitir la unión por las zonas no impresas.
- **CRITERIO:** [LIBRO] criterio de mecanismo (cortante, no presión), sin umbral numérico en el corpus.
  **NO OBSERVADO EN EL CORPUS:** un valor límite de cortante para el film.
- **INVALIDA:** cambio del perfil de velocidad de llenado.
- **¿TENEMOS?** **FALTA.** El cortante del frente sí lo tenemos (`gating.ts`, `mold-contratos.ts:
  gate-shear` contra Tabla 7.2), así que la pieza que falta es el film como componente.

### A-139 — Collapsible core: colapso disponible contra el undercut
- **§** 13.9.2 · **CUÁNDO:** undercut **interno** que A-98 no resuelve elásticamente.
- **ENTRADAS:** Ø del corazón · profundidad del undercut interno.
- **CÁLCULO:** catálogo comercial **Ø13 a 90 mm** con colapso ≈ **6 % del diámetro**; comparar el
  colapso disponible contra la profundidad del undercut.
- **SALIDA:** colapso disponible [mm] vs undercut requerido [mm]; veredicto.
- **DECIDE:** collapsible core sí o no, y de qué tamaño.
- **CRITERIO:** [LIBRO] el 6 % es umbral duro de catálogo. **ALARMA:** deja **witness lines interiores**
  en las juntas de los segmentos — si el interior es crítico, la tecnología **no aplica** y hay que ir
  a rotating core (A-140).
- **INVALIDA:** cambio del Ø interior de la pieza.
- **¿TENEMOS?** **SÍ.** `unscrewing.ts:collapsibleCoreCheck(t, undercutDepthMm)` con el 6 % y el rango
  13–90 mm; `chooseInternalCoreMethod()` decide entre colapsable, hélice y planetario.

### A-140 — Rotating core: anti-rotación y arquitectura de accionamiento
- **§** 13.9.3 · **CUÁNDO:** roscas internas donde el testigo del collapsible no es aceptable.
- **ENTRADAS:** paso y número de vueltas de la rosca · número de cavidades · torque requerido ·
  altura disponible (stack height).
- **CÁLCULO:** dos arquitecturas comparadas. **Hélice de paso grueso:** el paso debe ser grueso porque
  torque y desgaste **suben sustancialmente al disminuir el paso**, y el largo de la hélice sale de la
  fricción y el número de vueltas ⇒ **stack height enorme**. **Tren sol-planetas con rack-pinion:**
  desacopla el accionamiento de la rotación, permite **retrasar y programar** el giro y es compacto en
  el eje; contras: muchos engranes y un **layout radial de cavidades** que exige moldes grandes si hay
  muchas cavidades ⇒ preferible con **pocas cavidades y torque alto**.
- **SALIDA:** arquitectura elegida + vueltas + torque [N·m] + stack height [mm].
- **DECIDE:** el mecanismo de desenrosque. **Y una REGLA obligatoria:** la pieza necesita
  **anti-rotación**. El runner y el gate pueden no bastar, porque la fuerza de expulsión varía con
  material, proceso y acabado (cap. 11) ⇒ **undercut leve o feature asimétrico**.
- **CRITERIO:** [JUICIO] con trade-off explícito, más la regla dura de anti-rotación.
- **INVALIDA:** cambio del número de cavidades (puede tumbar el planetario).
- **¿TENEMOS?** **Parcial — SÍ en gran parte.** `unscrewing.ts:unscrewTurns()`, `unscrewTorque()`,
  `helixDrive()` y `chooseInternalCoreMethod()` cubren vueltas, torque, hélice y la decisión
  hélice↔planetario. **FALTA el check de anti-rotación de la pieza** (¿hay undercut leve o feature
  asimétrico?), que es la regla que el libro marca como obligatoria.

### A-141 — Gobernanza: el acta de decisiones aprobada
- **§** 13.10 · **CUÁNDO:** **gate de cierre del proyecto entero**, y en cada decisión crítica de
  tecnología.
- **ENTRADAS:** todas las decisiones que el software **no puede tomar**: la contracción recomendada y
  su responsable ←A-67 · la escuela de steel-safe ←A-70 · la tecnología de molde ←A-127 · la clase de
  fit y su fuerza de inserción ←A-123 · los vetos no económicos.
- **CÁLCULO:** **CUALITATIVO**. Por cada decisión: opciones reales (con sus números), elección,
  responsable, fecha, y costos/beneficios/riesgos explícitos.
- **SALIDA:** **ENTREGABLE: registro de decisiones aprobado y documentado.** Más el plan de tryout
  (qué quedó deliberadamente chico y hacia dónde crece).
- **DECIDE:** si el proyecto cierra. Con decisiones pendientes de firma, **no cierra**.
- **CRITERIO:** [LIBRO] la frase que cierra el libro entero: el asunto a deliberar
  *"not what can be done but rather what should be done"* para una aplicación específica, y por eso
  las decisiones críticas *"approved and documented between all the involved parties"* con
  entendimiento común de costos, beneficios y riesgos.
- **INVALIDA:** que cambie cualquier decisión firmada — se re-abre el acta.
- **¿TENEMOS?** **Parcial.** `expediente.ts:decisionesDelPaquete()` deriva las decisiones pendientes **con
  sus opciones numéricas reales** y `registrarDecision(exp, id, eleccion, responsable, fecha)` las
  firma; `Expediente.pendientes/cerrable` implementa el "no cierra con pendientes". `revisar-modelo.ts`
  lo integra al reporte. **FALTA** el campo de costos/beneficios/riesgos por decisión (hoy hay
  opciones y notas, no la terna explícita que pide §13.10).

---

# APÉNDICES — las bases de datos que alimentan los veredictos

Los Apéndices A–F **no son análisis** (no producen veredicto): son **fuentes de datos**. Se listan aquí
por completitud, y solo los dos que sí ejercen un juicio llevan ficha.

| Apéndice | Contenido | ¿Lo tenemos? |
|---|---|---|
| **A** | 16 materiales plásticos: coeficientes Tait `b1m..b9`, T de no-flujo, módulo, yield, strain-to-yield, CTE, contracción mín/máx y paralela/perpendicular, densidades, costo $/kg y $/m³, rangos de melt y de refrigerante | **Parcial** — `shrinkage.ts:ABS_TAIT` (solo ABS), `ejection.ts:ABS_EJECT` + `mold-ejection-auto.ts` (ABS/PP/PS/PC), `moldcost-detailed.ts:PLASTICS`. **FALTA la tabla de 16 con todos los campos.** |
| **B** | Metales de molde (Al 7075/QC-7/Cu 940; 1045/4140/P20; A6/D2/H13/S7/SS420) con yield, **límite de fatiga** (S-N a 1e6 ciclos, f = 1.0), dureza, tasas de maquinado (m³/h y m²/h) y costo | **SÍ, completo** — `moldbase.ts:MOLD_METALS` (11 metales, 14 columnas) + `metalByKey()` |
| **C** | Refrigerantes (agua / etilenglicol / aceite ISO 32): rangos de uso, propiedades térmicas, viscosidad a 50/100 °C | **Parcial** — `cooling-design.ts` maneja agua; no hay tabla de los tres fluidos |
| **D** | Tarifas de labor: salarios EUA por oficio (**×3** declarado para tarifa cargada) + tabla internacional de proporción | **Parcial** — `moldcost-detailed.ts:machiningRateUSDh` documenta "Apéndice D ×3" y `moldmachine.ts` maneja región, pero no está la tabla de oficios |
| **E** | Conversión de unidades (MPa↔psi, ton métrica↔N…) — necesaria porque el libro mezcla catálogo imperial (3/32", ½"-13, 3.25 in) con análisis SI | **Parcial** — hay constantes sueltas (`TON_N`, `STD_BORES_MM` con 82.55); no hay capa de conversión |
| **F** | `NO OBSERVADO EN EL CORPUS` — el corpus derivado nombra "Apéndices A–F" pero solo describe A–E | — |

### A-142 — Selección de metal de molde por límite de fatiga
- **§** Apéndice B + §12.2.6 + §12.3.1 · **CUÁNDO:** después de A-105 y A-115; y otra vez si A-118 o
  A-119 reprueban.
- **ENTRADAS:** vida objetivo en ciclos ←A-105 · `sigma_local` máximo esperado ←A-106/A-115/A-117 ·
  presión de fundido · requisitos de corrosión y pulido · costo y maquinabilidad (Apéndice B).
- **CÁLCULO:** filtrar los metales cuyo `fatigueLimitMPa` supere el `sigma_local` a la vida objetivo, y
  ordenar por costo y por tasa de maquinado.
- **SALIDA:** metal elegido + margen contra fatiga [MPa] + costo del inserto.
- **DECIDE:** el acero (o aluminio) de insertos y placas.
- **CRITERIO:** [LIBRO] tres reglas concretas repartidas por el capítulo: alta presión de fundido ⇒
  aceros de **alto endurance** (A6, D2, H13); 216 MPa en el corazón del cup ⇒ **ni acero suave ni
  aluminio**; water assist ⇒ **SS420** por corrosión.
- **INVALIDA:** cambio del volumen de producción (A-105) o de la presión esperada.
- **¿TENEMOS?** **Parcial.** `moldbase.ts:MOLD_METALS` + `mold-contratos.ts:layout-material-base` (con la
  alarma anti-default-P20 de §4.4) + `cores.ts:designCore({metalKey})` que compara contra
  `fatigueLimitMPa`. **FALTA** que la selección se dispare automáticamente desde el `sigma_local`
  máximo del molde en vez de ser una entrada.

### A-143 — Costo de maquinado y cotización
- **§** Apéndice B (tasas) + Apéndice D (tarifas) + cap. 3 · **CUÁNDO:** en cada iteración de diseño;
  es lo que convierte un cambio técnico en un número que el cliente entiende.
- **ENTRADAS:** volumen y área a maquinar por componente · tasas del metal elegido
  (`volMachineM3h`, `areaMachineM2h`) ←Apéndice B/A-142 · tarifa cargada ($/h) ←Apéndice D, con el
  **×3** declarado sobre el salario · región de manufactura.
- **CÁLCULO:** horas = volumen/tasa volumétrica + área/tasa superficial; costo = horas × tarifa
  cargada; más material, acabado y componentes comprados.
- **SALIDA:** costo del molde [USD] y costo por pieza [USD].
- **DECIDE:** la cotización, y el arbitraje de todos los trade-offs del pliego (más acero contra menos
  deflexión, más compuertas contra más uniformidad, pilares contra placa gruesa).
- **CRITERIO:** [LIBRO] los coeficientes son **defaults**; si el taller tiene tarifa negociada, **manda
  la del taller**.
- **INVALIDA:** cambio de metal, de región o de la geometría de cualquier componente.
- **¿TENEMOS?** **SÍ.** `moldcost-detailed.ts:estimateMoldCost()`, `estimatePartCost()`,
  `quoteReport()`, `MACHINING_FACTOR`, `FINISH_RATE`, `MOLD_STEEL_COEF`; `mold-contratos.ts:
  costo-datos-taller` codifica que la tarifa del taller manda sobre la tabla.

---

# ERRATAS: cómo tratan a los análisis que dependen de ellas

El apéndice de erratas de `verificaciones-visuales.md` reporta seis anomalías del texto fuente.
**Cuatro tocan directo a los análisis de este pliego.** La regla: se reporta la anomalía **sin corregir
el texto**, y se declara qué valor codificamos y por qué.

**1. El "1050 mm" de la Ec. 10.18 (afecta al enlace C10-b).**
El texto calcula `R_warpage = 2·1.5/(0.34 % − 0.31 %) = 9050 mm` y dos líneas después evalúa
`delta = 120·sin(120/1050) = 1.6 mm`. Los dos radios no coinciden. **El resultado publicado (1.6 mm) es
el consistente con R = 9050** evaluando el seno en **radianes**: `120·sin(120/9050) = 1.59`; con 1050
saldrían ≈13.7 mm. **Conclusión: "1050 mm" es el typo; la fórmula y el resultado son correctos.**
*Trato:* codificar la Ec. 10.17 tal cual y evaluar en radianes. Ya está así en `warpage.ts`, que
documenta la errata en su encabezado. **Riesgo si se hubiera copiado el 1050:** el alabeo predicho
saldría **8.6× mayor**, el molde entero se rediseñaría por un fantasma, y el argumento del cap. 9 —que
2 °C bastan— quedaría irreconocible.

**2. El endurance del P20: 450 vs 456 MPa (afecta A-105, A-115, A-116, A-117, A-142).**
El texto de §12.1.1 dice *"approximately 450 MPa"*, la Fig. 12.5 rotula *"Endurance = 456 MPa"* y
§9.2.5 usa 456 en su cálculo. **Se usa 456 MPa.**
*Trato:* `moldbase.ts:MOLD_METALS` ya carga P20 con `fatigueLimitMPa: 456`. **Ojo con no
"corregir" el 450 de §11.2.3** (A-83): ése no es la misma cifra ni la misma errata — ahí el libro
declara explícitamente que 450 es una elección **conservadora** frente a los 800 MPa de un pin
endurecido. Son dos decisiones distintas que casualmente comparten número. Confundirlas haría que un
pin se dimensione con la vara de una placa.

**3. El QC7: yield 420 (Fig. 12.3) vs 545 MPa (§12.1.1) (afecta A-104, A-105, A-117, A-119).**
Inconsistencia entre figura y prosa **para el mismo material**. El corpus no resuelve cuál es la buena.
*Trato:* codificamos **545 MPa**, que es el valor con el que el libro **hace la aritmética** de sus
ejemplos (el barreno de eyector de A-117 compara 530 MPa contra "yield 545"; el hueco máximo por
sobrepresión de A-119 también). `moldbase.ts` carga QC-7 con `yieldMPa: 545`. **Se declara la
discrepancia en la ficha del material**, porque si algún día el número bueno fuera 420, el ejemplo de
A-117 cambiaría de veredicto: 530 MPa pasaría de "abajo del yield pero muere por fatiga" a
"**cede en el primer ciclo**" — que es una conclusión distinta, no un ajuste de margen.

**4. El endurance del QC7: 166 vs 170 MPa (no está en el apéndice de erratas, lo detecté aquí).**
§12.1.1 da la curva S-N con **170 MPa a 1e6 ciclos**, mientras §9.2.5 y el ejemplo de §12.2.6 usan
**166 MPa** (que es el valor del Apéndice B). Diferencia de 2.4 %, sin consecuencia práctica en ningún
veredicto del libro. *Trato:* se usa **166 MPa** (Apéndice B, que es la fuente tabulada), y se anota
que la curva de §12.1.1 es una **lectura de gráfica**, no una tabla. `moldbase.ts` carga
`Al QC-7: fatigueLimitMPa 166`. **Y el hueco real es otro:** hoy solo tenemos el punto de 1e6; la curva
completa (545 / 370 / 170 a 1e3 / 1e4 / 1e6) **no está codificada**, y sin ella un molde de aluminio
para 10,000 piezas se juzga con la vara equivocada — **demasiado estricta**, en este caso: 166 en vez
de 370. Ver A-105.

**5. Fig. 10.10 con caption cruzado** (*"PvT behavior for an acetal"* sobre la figura del steel-safe
0.4/0.5/0.6 %). No afecta ningún cálculo: es un problema de extracción de captions. Toca a A-70 solo en
la trazabilidad de la figura citada.

**6. Tabla 8.1, dispersión de un orden de magnitud entre fuentes para el espesor de venteo** (media
viscosidad: Glanvill 0.2 · Rosato 0.3 · Menges 0.03 mm). **No es errata: es dispersión real de la
literatura.** *Trato:* A-107 y A-93 usan **0.02 mm**, que es el valor de trabajo del propio libro en
§8.2.3 y §12.1.2, **y lo declaran como tal**. Cualquier umbral de venteo que codifiquemos tiene que
decir de qué fuente sale, porque el veredicto de flash es un umbral absoluto y con 0.3 mm en vez de
0.02 mm el molde del ejemplo del libro **pasaría**.

---

# GRAFO — la secuencia, las dependencias y los retornos

Notación: `A → B` = A alimenta a B. `⟲` = **RETORNO** (invalida y obliga a recorrer hacia atrás).
`‖` = corren en paralelo. `[gate]` = no se avanza sin veredicto. Los nodos `C10-a`/`C10-b` viven en
`analisis-caps7-9.md`.

## Cadena principal del cap. 10 (contracción)

```
(cap 5: P_llenado) ──┐
(Apéndice A: rangos) ┴─→ A-60 ─→ A-61 ─→ A-62 [gate: ¿el PvT reproduce la densidad?]
                                   │
                                   └─→ A-63 ─┬─→ C10-a (contracción lineal, caps7-9)
                                             └─→ A-64 (solo si hay fibra/LCP)  ←── A-73
                     A-61 ──────────────────────→ A-65 ─→ A-66 [gate: s > 0]
   C10-a ‖ A-64 ‖ A-65 ────────────────────────→ A-67 [gate: acta + responsable]
                                                    │
                                                    ├─→ A-68  (escala el acero)
                                                    └─→ A-70  (sesgo steel-safe A/B/C)
   A-61 ──→ A-72 (bandera semicristalino) ─────────→ A-67
```

## Validación y alabeo del cap. 10

```
(cap 6: feed system) ─→ A-69 ─┬─→ A-71 (perfil de pack: ¿alcanza sin gastar acero?)
                              └─→ A-67   [COMPARA: el mapa valida al cálculo a mano]

(cap 9: circuito de agua) ─→ C10-b  [2 °C ⇒ 1.6 mm]  ─→ A-77
(geometría de la pieza)  ─→ A-74 [gate topológico] ─→ A-75 ─→ A-77
A-76 (checklist de uniformidad) corre ‖ y condiciona a A-69, C10-b y A-75
```

## Cap. 10 → cap. 11 (el dato que viaja)

```
C10-a (s recomendada) ──→ A-81   § 10.4: la contracción es lo que aprieta la pieza sobre el corazón
```

## Cadena principal del cap. 11 (expulsión) — el orden que declara §11.4

```
A-78 ─→ A-79 ─┬─(por apertura)─→ A-101
              └─(por actuador)─→ A-99 ─→ A-100

A-78 ─→ A-98 [gate: ¿ε < 2 %?]  ─(no)→ A-79 / A-139 / A-140
                                 (sí)→ sin mecanismo

A-80 ─→ A-81 ─→ A-82 [gate: ~0.5 % del clamp]
          │
          ├─→ A-83 ─┐
          ├─→ A-84 ─┼─→ A-86 [max de tres] ─→ A-87 ─→ A-89 ─→ A-103
          └─→ A-85 ─┘        ↑                        │
                     A-88 ───┘ (acero disponible)     ├─→ A-90 ⟲ AGUA
                     A-91 ───┘ (D_pin vs h_pared)     └─→ A-92 ─(100 % estético)→ A-127
A-86 ─→ A-93 · A-94 ─→ A-95 · A-96 · A-97
A-81 ─→ A-97 (balance entre cavidades)  ·  A-81 ─→ A-102 (¼ de F para resortes)
```

## Cadena principal del cap. 12 (estructural)

```
(volumen de producción) ─→ A-105 ─┐
(criticidad, P esperada) ─→ A-104 ─┴─→ σ_limit ─→ A-106 ‖ A-107   [DOS semáforos independientes]

A-108 ─→ A-109 ─→ A-110 ─→ A-111 [gate: δ < 0.1 mm] ─→ A-112
                    ↑ ⟲ EXPULSIÓN (A-89): la deflexión gana sobre el layout de eyectores
A-113 ─(no cierra)→ A-114
A-115 ─┬─→ A-116 ⟲ AGUA
       └─→ A-117 [trampa: pasa yield, muere por fatiga]
A-118 ‖ A-119 [doble vara: fatiga y sobrepresión] ‖ A-120 ←─ A-121
                                                    A-120 ─→ ⟲ ALIMENTACIÓN (gate central / 2 gates)
A-122 ─→ A-123 [gate: ¿hay prensa?] ─(no)→ A-122 con fit LN
A-124 ‖ A-125 [gate: ¿se desarma a mano?]
TODO ─→ A-126 [gate de cierre: 3 veredictos separados] ─→ ⟲ cualquier subsistema
```

## Cap. 13: la decisión temprana y el cierre

```
A-127  se corre ANTES de los caps. 4-12 y condiciona a TODOS
   ├─ coinyección   → A-128
   ├─ gas/water     → A-129 (+ SS420 → A-142)
   ├─ multi-shot    → A-130 → A-131
   ├─ insulated     → A-132
   ├─ stack         → A-133
   ├─ hot runner    → A-134 (si hay ≥2 niveles de branch)
   ├─ T de pared    → A-135 ‖ A-136 ‖ A-137
   ├─ IML           → A-138
   ├─ collapsible   → A-139
   ├─ rotating      → A-140
   └─ reverse eject → (desde A-92)

A-67 · A-70 · A-123 · A-127 ──→ A-141 [gate FINAL: no cierra con firmas pendientes]
A-105 ─→ A-142 ─→ A-143 (y A-143 arbitra TODOS los trade-offs de arriba)
```

## Los RETORNOS, en una lista

| # | Retorno | Disparador | Costo declarado por el libro |
|---|---|---|---|
| R1 | **A-67/A-68 ⟲ TODO río abajo** | cambia la contracción recomendada | re-escala cavidad y corazón; invalida superficies, tooling-split, planos y cotización. El más caro del pliego |
| R2 | **A-69 ⟲ alimentación** | contracción despareja ⇒ más compuertas (2→4) | puede exigir manifold nuevo ("straight bar"→"H"/"X"), barrenos nuevos en lado A y **re-ruteo de líneas de agua** |
| R3 | **A-77 ⟲ pieza** | alabeo ⇒ costillas someras | rediseño de pieza |
| R4 | **A-77 ⟲ cavidad (contorneada)** | alabeo que no cede | ALTO RIESGO: los corrimientos *"may exceed steel safe limits"*, costos muy altos |
| R5 | **A-90 ⟲ agua** | el pin no deja pasar la línea de enfriamiento | achicar el pin (→ recalcular A-86) o re-rutear |
| R6 | **A-97 ⟲ pieza** | el stripper no tiene cara plana de empuje | pedir rediseño de la sección — salida legítima |
| R7 | **A-110 ⟲ expulsión** | hace falta espacio para pilares grandes | reacomodar el layout de eyección: **la deflexión gana** |
| R8 | **A-116 ⟲ agua** | línea de agua demasiado cerca de la cavidad | re-rutear el circuito |
| R9 | **A-120 ⟲ alimentación** | el corazón esbelto flexiona | compuerta central arriba o dos compuertas opuestas abajo |
| R10 | **A-123 ⟲ A-122** | el fit pide más prensa de la que hay | bajar de FN a LN |
| R11 | **A-101 ⟲ A-99** | el slide no alcanza la carrera con 20° | pasar a core pull con actuador |
| R12 | **A-98 ⟲ A-78** | ε ≥ 2 % (o material cargado y frágil) | el undercut exige mecanismo: cambia el costo del molde |
| R13 | **A-126 ⟲ cualquier subsistema** | los sujetadores chocan con eyección o agua | *"iterative redesign of the mold may be required"* |
| R14 | **A-141 ⟲ la decisión firmada** | cambia una decisión aprobada | se re-abre el acta |

## Lo que corre en PARALELO (y a veces se olvida que sí)

- **A-106 ‖ A-107** — esfuerzo y deflexión son **dos semáforos distintos**; un molde puede pasar
  esfuerzo y aun así producir flash.
- **A-118 ‖ A-119 ‖ A-120** — los tres modos de falla del corazón se corren juntos y el peor manda.
- **A-119 se corre DOS VECES** con dos varas distintas (fatiga a presión de operación, fluencia a
  sobrepresión) y el resultado más chico gobierna.
- **A-135 ‖ A-136 ‖ A-137** — las tres tecnologías de calentamiento de pared se evalúan en paralelo y
  compiten.
- **A-76 corre transversal** a todo el cap. 10: es una precondición, no un paso.

## La forma del grafo, en una frase

El cap. 10 es una **cadena** que termina en una firma; el cap. 11 es un **árbol** que se abre por tipo
de eyector y se cierra con el peor de tres límites; el cap. 12 es una **malla** de verificaciones
independientes atadas por un solo `sigma_limit` que la fatiga define; y el cap. 13 es una **raíz** que
se corre antes que todo lo demás y una **firma** que se pone al final.

---

# RESUMEN — qué tenemos y qué falta

**84 análisis fichados** (A-60 a A-143), más 2 enlaces a `analisis-caps7-9.md` (C10-a, C10-b).
Reparto: cap. 10 → 18 · cap. 11 → 26 · cap. 12 → 23 · cap. 13 → 15 · Apéndices → 2.

## Ya lo tenemos, completo — 31 de 84

`shrinkage.ts` → A-61 A-63 A-65 A-66 A-68 · `warpage.ts` → A-74 A-75 ·
`parting.ts` + `dfm.ts` + `moldtech.ts` → A-78 ·
`ejection.ts` → A-80 A-81 A-82 A-83 A-84 A-86 · `eject-layout.ts` → A-89 ·
`mold-ejection-auto.ts` → A-88 · `ejectortypes.ts` → A-94 A-98 ·
`sideactions.ts` → A-99 A-101 · `unscrewing.ts` → A-139 ·
`mold-fea.ts` + `lamina-vonmises.ts` → A-106 A-115 · `platesizing.ts` → A-107 ·
`mold-contratos.ts` → A-112 ·
`mold-interlocks.ts` → A-114 · `cores.ts` → A-118 A-119 · `fits.ts` → A-122 ·
`fasteners.ts` + `mold-fasteners.ts` → A-124 · `moldcost-detailed.ts` → A-143

## Parcial — el motor está, falta la pieza que decide — 28 de 84

A-60 (faltan los rangos min/max del proveedor) · A-67 (falta registrar **cuál** de las 4 fuentes) ·
A-70 (falta la opción C, features semi-acabados) · A-72 (falta el cruce semicristalino×tolerancia) ·
A-76 (los 4 puntos existen sueltos, falta el veredicto único) · A-79 (falta la jerarquía como
veredicto y el registro de limit switches) ·
A-85 (usa `K = 2`, no el `0.7·L` del libro — **no reproduce el 1.86 mm del ejemplo**) ·
A-87 (falta el menú de escenarios) · A-90 (falta encadenar "achicar el pin" al recálculo) ·
A-92 (falta el mapa estético como dato de primera clase) · A-97 (falta el balance entre cavidades) ·
A-100 (falta carrera vs envolvente y la regla de "un solo lado") · A-102 (falta el ¼·F y el dato del
knock-out rod) · A-103 (falta el escalón 2–3 Ø con chaflán, la holgura de 0.5 mm y la tabla de
eyectores) · A-104 (el tipo `StressMethod` existe pero hoy siempre sale `deflexión-pura`) ·
A-105 (falta la **curva S-N**; hoy solo el punto de 1e6) ·
A-108 (falta restar cavidad + leader pins + bushings del área de soporte) ·
A-109 (falta la descomposición multicavidad y excluir el espesor de corazones) ·
A-110 (falta colisión pilar↔cuchilla/pin y pilar↔knock-out central) ·
A-113 (falta la Ec. 12.15 exacta y la Ec. 12.17 de deflexión de pared) ·
A-116 (usa la K de Fig. 9.4, no el despeje de la Ec. 12.19) ·
A-117 (falta el veredicto combinado yield/fatiga por barreno) ·
A-120 (falta la escalera de remedios y el interlock de punta) ·
A-126 (falta separar los 3 semáforos) · A-127 (falta la rama de costo/productividad del árbol) ·
A-140 (falta el check de anti-rotación de la pieza) ·
A-141 (falta la terna costo/beneficio/riesgo por decisión) ·
A-142 (falta disparar la selección desde el `sigma_local` máximo)

## FALTA por completo — 25 de 84

**Cap. 10 (6):** A-62 gate de densidad · A-64 anisotropía por iteración · A-69 mapa de contracción
`s(x,y)` y su uniformidad · A-71 sensibilidad al proceso y perfil de pack · A-73 Tabla 10.1 de
rellenos · A-77 escalera de remedios de alabeo.
*(Transversal a casi todas: la BD de 16 materiales del Apéndice A.)*
**Cap. 11 (4):** A-91 interferencia térmica del pin · A-93 largo del pin contorneado vs venteo ·
A-95 carrera de servicio de la cuchilla (+ land de EDM) · A-96 stack-up de concentricidad del sleeve.
**Cap. 12 (4):** A-111 superposición compresión+flexión del pilar (**es la que decide el Ø**) ·
A-121 estimación de `delta_P` sobre el corazón · A-123 fuerza de inserción vs prensa del taller ·
A-125 Tabla 12.2 de dowels y su peor caso de interferencia.
**Cap. 13 (11):** A-128 coinyección · A-129 gas/water assist · A-130 multi-shot −40 % ·
A-131 core-back · A-132 insulated runner · A-133 stack mold · A-134 desbalance térmico /
Melt Flipper · A-135 pulsed cooling · A-136 conduction heating · A-137 induction heating · A-138 IML.

## Las cinco brechas que más duelen (por lo que decidirían)

1. **A-111** — sin la superposición, el diámetro del pilar se elige por masa de acero, no por la meta
   de 0.1 mm que el libro fija. Es el único análisis FALTANTE que gobierna una cota real del molde.
2. **A-105 con curva S-N completa** — hoy el aluminio se juzga con el punto de 1e6 aunque el molde sea
   para 10,000 piezas. La vara está mal por un factor de 2.2.
3. **A-123** — un ajuste que pasa todos los checks dimensionales y pide 808 kN de prensa **no se puede
   armar**, y nada lo delata.
4. **A-69** — sin mapa de contracción no hay validación de la contracción calculada, y §10.1.7 dice
   textualmente que el análisis *"should not be used in isolation"*.
5. **La rama de costo del árbol de A-127** — hot runner / stack / insulated / dos placas es donde el
   cap. 13 mueve más dinero, y hoy esa arquitectura se decide por break-even sin pasar por el árbol.

## Lo que quedó NO OBSERVADO EN EL CORPUS

- **Apéndice F.** El corpus nombra "Apéndices A–F" pero solo describe A–E. Contenido desconocido.
- **Umbral numérico de cortante admisible sobre el film de IML** (A-138): el libro da el mecanismo
  (cortante, no presión) y remite a §5.3.1, pero el corpus no capturó un valor límite.
- **Umbral de concentricidad del sleeve** (A-96): la ficha V11.13 declara explícitamente que el libro
  no da número aquí.
- **Tabla tipo SPI de clases de molde 101–105:** el corpus declara que **no existe** en estos
  capítulos, y que el equivalente funcional —mejor— es que el número de ciclos entre directo a
  `sigma_limit` (A-105).
- **Ojos de izaje / hoist rings:** única mención en el corpus es como valor de factor de seguridad
  (6.0, §12.1.1). Sin dimensionamiento, ubicación ni especificación.
- **Placas de identificación, straps de transporte, interlock eléctrico de seguridad del operador:**
  no aparecen en caps. 10–13. Lo eléctrico que sí está son **limit switches** de protección de
  máquina/molde y de secuencia (§11.1.1, §11.3.6, §11.3.7, §11.3.8), no de seguridad del operador.
  Si hacen falta, buscarlos en los capítulos de mold base / componentes estándar (caps. 3–4).
- **Accesibilidad de mantenimiento** como sección propia: no existe; está disperso en A-103 (etiquetar
  pines), A-125 (desarmable a mano) y §13.9.1 (gibs reemplazables + wear plates).



