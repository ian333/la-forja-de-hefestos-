# Raymer caps 18–24 — COSTOS, TRADE STUDIES y OPTIMIZACIÓN

Fuente: `docs/forja-research/manuales/aero/txt/raymer.txt`, líneas **35234–48660** (cap 18 §35234,
cap 19 §36328, cap 20 §37664, cap 21 §39100, cap 22 §40890, cap 23 §42150, cap 24 §43462).
Caps 18, 19 y 24 leídos **completos**; caps 20–23 leídos dirigidos a lo que toca sizing/costo/optimización.
Análisis: 2026-08-04. Auditado contra `docs/forja-research/pliegos/pliego-aero.md` §7.5–7.11 (no repite: completa y corrige).

> **Convenciones de este documento**
> `[OCR DUDOSO: …]` = el escaneo no permite leer el número con seguridad. **No lo teclees a un test.**
> `[EXTENSIÓN DECLARADA]` = derivación mía, no del libro, con el motivo dicho.
> `[NO OBSERVADO]` = figura o tabla que era imagen y no está en el texto.
> Las citas literales van **en inglés entre comillas** porque el requisito es la frase del cliente.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

Este bloque es **el cierre del lazo** del libro. Los caps 3–17 construyen y analizan **un** avión.
Los caps 18–19 responden la única pregunta que importa después: **¿es este el mejor avión, y cuánto cuesta?**
Los caps 20–23 dicen **dónde se rompe ese lazo** (eléctrico, VTOL, cohete, configuraciones raras) y el
cap 24 lo **ejecuta dos veces con números**, una a mano con lápiz y otra con computadora.

| Cap | Qué es | Para el producto |
|---|---|---|
| **18 Cost Analysis** (p.687–707) | LCC, CERs, **DAPCA IV**, learning curve, O&M, economía de aerolínea, NPV | **La función objetivo alterna.** 9 ecuaciones algebraicas cerradas que convierten `We` en dólares. Cero iteración. Es lo más barato con más palanca del libro |
| **19 Sizing and Trade Studies** (p.709–733) | Sizing refinado por segmento, **sizing matrix / carpet plot**, catálogo de trade studies, MDO, costo como measure of merit, CAIV | **EL capítulo.** Es la especificación funcional literal del optimizador. Kuhn–Tucker, el algoritmo del carpet plot paso a paso, la regla de anidamiento, y las tres objeciones del cliente a la optimización automática |
| **20 Electric Aircraft** (p.735–761) | Motores, baterías, celdas, híbrido, solar, **BMF y ec. de sizing eléctrica** | El lazo clásico **se rompe**: suma en vez de producto, sin logaritmo. Un caso de prueba para que el motor no cablee la física térmica |
| **21 Vertical Flight** (p.763–803) | VTOL a chorro y hélice/helicóptero | El sizing se domina por **balance y thrust matching**, no por misión |
| **22 Extremes of Flight** (p.805–831) | Cohetes/lanzadores/naves, hipersónicos, dirigibles | **Δ-V sustituye al alcance y Tsiolkovsky a Breguet.** Misma arquitectura de lazo, otra ecuación de segmento |
| **23 Unique Concepts** (p.833–866) | 12 configuraciones no convencionales + **diseño derivativo** | **Los factores de ajuste numéricos** (0.768, 0.774, −15%, +20% L/D…) y la restricción de "función escalón de costo" del derivativo |
| **24 Design Examples** (p.867–958) | **DR-1** homebuilt acrobático (todo a mano) y **DR-3** caza supercrucero (RDS) | **Los fixtures.** Dos optimizaciones completas con matriz, restricciones y óptimo leído |

**Lo estratégico, en una frase:** el cliente ya nos dijo que el CAD de alta gama falla porque *"they've been
tailored for production part design, not the 'everything will change' environment of conceptual design"*
(§2.1.4, p.13–14) y que lo que quiere es *"a CAD capability to change the wing's sweep and automatically
revise the geometry of the spars and ribs accordingly... The wing sweep will probably change after every
optimization study or wind-tunnel test. The CAD system should make this easy."* (§2.3, p.23).
**El cap 19 es el que genera esos cambios de flecha.** Construir el optimizador sin el CAD paramétrico
detrás es construir la mitad inútil; construir el CAD sin el optimizador es no tener quién mueva la flecha.

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§] requisito (APRENDER / CONSTRUIR / ambos)`

### 1.1 Costos

| # | dominio | § | requisito | A/C |
|---|---|---|---|---|
| C-01 | costos | §18.4 | Implementar **DAPCA IV modificado** como función **pura**: `dapca4(We, V, Q, FTA, N_eng, T_max, M_max, T_tit, C_avionics, rates, fudges) → {H_E,H_T,H_M,H_Q,C_D,C_F,C_M,C_eng, total}`. Ecs. (18.1)–(18.9). Sin iteración | CONSTRUIR |
| C-02 | costos | §18.4 | `Q` = *"lesser of production quantity or number to be produced in five years"*. **Es una regla, no un dato**: el software debe pedir ambos y tomar el menor | CONSTRUIR |
| C-03 | costos | §18.4 | Los **fudge factors por material** (Al 1.0 · grafito-epoxi 1.1–1.8 · fibra de vidrio 1.1–1.2 · acero 1.5–2.0 · titanio 1.1–1.8) son **parámetros de entrada explícitos**, jamás cableados. El libro los llama *"highly debatable"* | CONSTRUIR |
| C-04 | costos | §18.4 | La salida **debe ser una banda, no un número**: material 1.1–1.8 son 1.6× de indeterminación y el ÷4 de aviación general son 4×. Reportar `{lo, nominal, hi}` | CONSTRUIR |
| C-05 | costos | §18.4 | Aplicar los tres ajustes globales declarados: **×1.2** para diseños modernos (la base es *"non-stealth, non-composite"*), **×0.9** para comercial (*"DAPCA tends to overpredict commercial aircraft costs"*), **÷4** para aviación general (*"hard to believe, but perhaps is acceptable for relative trade studies"*) | CONSTRUIR |
| C-06 | costos | §18.4 | DAPCA **no estima aviónica ni interiores**. Aviónica: 5–25% del flyaway, o $4,000–$8,000/lb {$9,000–$18,000/kg} (2012). Interiores: **+$3,500/pasajero** jet de transporte, **$1,700** regional, **$850** GA. Deben ser entradas separadas | ambos |
| C-07 | costos | §18.3 | Implementar el **CER de peso-por-componente** como método alterno: `horas = Σ (peso_componente × h/lb_baseline)`, con **50 h/lb {110 h/kg}** fuselaje+subsistemas y **90 h/lb {198 h/kg}** alas y empenajes. El libro dice que esto *"is probably better than a sophisticated CER based upon a number of not-so-similar aircraft"* | CONSTRUIR |
| C-08 | costos | §18.3 | Implementar el **CER de una línea del airliner**: `Precio = $5,000,000 + 550·We[lb]` {`+1200·We[kg]`}, dólares 2012. Es el sanity check de un renglón | CONSTRUIR |
| C-09 | costos | §18.3 | Calcular y exponer el **DCPR/AMPR weight** = `We` menos ruedas, frenos, llantas, motores, arrancadores, fluidos de enfriamiento, vejigas de combustible, instrumentos, baterías, fuentes/convertidores eléctricos, aviónica, armamento, control de tiro, aire acondicionado y APU. **Típicamente 60–70% de `We`** | ambos |
| C-10 | costos | §18.3 | **Learning curve**: el término `Q^x` **ES** la curva de aprendizaje. Rango histórico **75–85%**; origen Wright-Patterson AFB, **años 1930**, 15% por duplicación = 85%; **Boeing 727 = 80%**, recta casi perfecta en log-log del avión 1 al 1000 | ambos |
| C-11 | costos | §18.1 | **Gate anti-comparación**: *"Comparing the flyaway cost of one aircraft to the program or life-cycle cost of another is meaningless."* El software debe **etiquetar toda cifra con su agrupación** (RDT&E / flyaway / procurement / program / LCC) y **negarse a comparar agrupaciones distintas** | CONSTRUIR |
| C-12 | costos | §18.1 | **Gate de dólares**: *"for establishing a cost baseline for new aircraft cost prediction, constant-year dollars should be used"*. Toda cifra lleva año-base pegado. Ejemplo canónico: F-15 vs F-16 = **+60% en then-year, +130% en constantes de 1978** | CONSTRUIR |
| C-13 | costos | §18.2 | Modelar las **6 agrupaciones de LCC** con sus proporciones declaradas: RDT&E *"typically less than 10% of total life-cycle cost"*; producción *"about half of LCC for military aircraft, but less for commercial"*; O&M *"usually much larger than development and production costs for commercial aircraft and about equal in the military"*; disposal militar despreciable, civil **negativo** (~10% del precio, *"highly variable"*) | ambos |
| C-14 | costos | §18.5 | **O&M por reparto declarado**: militar fuel ~15%, tripulación ~35%, mantenimiento ~50%. Comercial fuel ~38%, tripulación ~24%, mantenimiento ~25%, depreciación ~12%, seguro ~1%, tasas de aterrizaje +~2% | CONSTRUIR |
| C-15 | costos | §18.5 | **MMH/FH** (maintenance man-hours per flight hour) es *"the primary measure of maintenance 'goodness'"* y *"is roughly proportional to weight"*. Debe salir del pipeline de pesos, no ser un dato suelto | ambos |
| C-16 | costos | §18.5 | **Block hours ≠ flight hours.** `block ≈ tiempo de vuelo + 15 min de maniobra en tierra + 6 min de maniobra en aire`. La distancia de misión **no** es la línea recta: **+~2%** para >1400 millas y `(0.015 + 7/D)%` para viajes cortos `[OCR DUDOSO: la forma exacta del segundo término]` | CONSTRUIR |
| C-17 | costos | §18.7 | **DOC por asiento-milla** es la measure of merit del transporte comercial. Referencia: *"Current airliners average a DOC of about 6–8 cents per seat-mile."* CASM típico de aerolínea mayor ≈ **15 centavos** (4 mano de obra, 5 combustible, resto otros) | ambos |
| C-18 | costos | §18.7 | Implementar **break-even doble**: (a) fabricante = costo de desarrollo / margen de contribución (ejemplo del libro: $400M de desarrollo ÷ $2M de margen ⇒ **avión #200**); (b) aerolínea = `load factor de equilibrio = costo por asiento-milla / tarifa media por asiento-milla` | CONSTRUIR |
| C-19 | costos | §18.7 | Implementar **NPV / IRR**: `V_n = V_0(1+r)^n` (18.14), `V_np = V_n/(1+r)^n` (18.15). NPV del airliner = Σ NPV de las utilidades anuales (ingresos − DOC − IOC, **sin depreciación**) + NPV del valor de salvamento (~10% del precio). Criterio: **NPV > precio de compra** o no rinde `r` | CONSTRUIR |
| C-20 | costos | §18.6 | **Design-to-cost / CAIV**: el costo puede ser una **restricción dura, no un objetivo**. *"the plane has to cost 'X'—now tell me what you can give me for that!"*. Si no cumple, *"either performance or range must be sacrificed"* | ambos |

### 1.2 Optimización y trade studies

| # | dominio | § | requisito | A/C |
|---|---|---|---|---|
| O-01 | optimizacion | §19.4 | **Sizing matrix**: variar los dos parámetros *"arbitrarily... typically by plus and minus 20%"* alrededor del baseline as-drawn. Mínimo **3×3**; *"For better accuracy, 5×5 and larger sizing matrices are used at the major aircraft companies but require more work."* | CONSTRUIR |
| O-02 | optimizacion | §19.4 | ⭐ **Cada celda es un avión distinto.** *"Each combination of T/W and W/S produces a different airplane, with different aerodynamics, propulsion, and weights. These different airplanes are separately sized."* **Prohibido interpolar el análisis**; solo se interpola la superficie de resultados | CONSTRUIR |
| O-03 | optimizacion | §19.4 | Cobertura garantizada: *"If the T/W and W/S variations are wide enough, at least one of the aircraft will meet all performance requirements, although it will probably be the heaviest airplane."* El software debe **verificar que al menos un punto es factible** y avisar si no | CONSTRUIR |
| O-04 | optimizacion | §19.4 | Implementar los dos formatos gráficos **con los mismos datos**: `sizing matrix plot` (plano T/W–W/S con iso-W₀ y líneas de restricción) y `carpet plot` (*"Fig. 19.5 Carpet plot format (same results!)"*) | CONSTRUIR |
| O-05 | optimizacion | §19.4 | El carpet plot exige **desplazar el eje horizontal un incremento arbitrario e IGUAL** por cada curva de T/W: *"This shifting of the axis is crucial to the development of the carpet-plot format."* Después *"The horizontal axis can be removed from the carpet plot because one can now read wing loadings by interpolating between the curves."* | CONSTRUIR |
| O-06 | optimizacion | §19.4 | El sombreado es normativo: *"Shading is used to indicate which side of these 'constraint lines' the desired answer must avoid."* | CONSTRUIR |
| O-07 | optimizacion | §19.4 | El óptimo *"is found by inspection... and usually will be located where two constraint lines cross"*. **El software propone el cruce; el ingeniero lo confirma a ojo.** Ver §4 | ambos |
| O-08 | optimizacion | §19.4 | Marco teórico declarado: **Kuhn–Tucker (1950)** — *"at the optimum the only direction you can move to improve the objective function is one that will violate one or more constraints. This is the essence of aircraft optimization methods, which long predate Kuhn–Tucker."* | APRENDER |
| O-09 | optimizacion | §19.4 | *"It is possible to create sizing plots in which the measure of merit is cost rather than weight. The plotting procedure is the same."* La measure of merit es **inyectable**, no cableada | CONSTRUIR |
| O-10 | optimizacion | §19.5 | Implementar **Tabla 19.1** completa como catálogo de trade studies en tres familias: *design trades*, *requirements trades*, *growth sensitivities* (contenido en §2.6) | CONSTRUIR |
| O-11 | optimizacion | §19.5 | **Growth sensitivity** se presenta *"in a single graph, with percentage change of the various parameters on the horizontal axis and percentage change in takeoff weight on the vertical axis"*. Es una vista con nombre propio | CONSTRUIR |
| O-12 | optimizacion | §19.5 | ⭐ **Gate del realism factor.** *"insist that all redesigned layouts used for trade studies be checked to maintain the same internal density as the baseline, calculated as takeoff weight divided by internal volume."* Con nuestro kernel B-Rep esto es **medible automáticamente**: `ρ = W₀ / volumen_interno`. Un CAD puede; una hoja de cálculo no | CONSTRUIR |
| O-13 | optimizacion | §19.5 | ⭐ **Regla de anidamiento.** *"each parametric variation of those other variables should be calculated using a complete T/W–W/S carpet plot for each data point. Otherwise, the answers aren't believable because the initial values of T/W and W/S might be forcing the answer to a non-optimal direction."* | CONSTRUIR |
| O-14 | optimizacion | §19.5 | Aritmética de costo declarada por el autor: A y Λ ⇒ 3×3 × 9 puntos de carpet = **81 aviones completos**; los 6 parámetros base ⇒ **3⁶ = 729 mínimo** (*"5⁶, or 15,625 data points would be better"*). Y su pregunta: *"How do you draw a six-dimensional carpet plot?"* | APRENDER |
| O-15 | optimizacion | §19.6 | Catálogo MDO a implementar/ofrecer: **response surface**, **Latin squares**, **finite difference**, **gradiente exhaustivo con reducción de paso**, **Implicit Function Theorem**, **decomposition**, **algoritmos genéticos** (§2.7) | CONSTRUIR |
| O-16 | optimizacion | §19.6 | ⭐ **Regla dura de la superficie de respuesta**: *"if the equation form of the RS is lower than third degree, any reflexes in the actual surface will be smoothed over and the answer will be wrong. Fourth or fifth degree would be even better, but the calculation time goes up dramatically."* **Grado ≥ 3, por defecto 4** | CONSTRUIR |
| O-17 | optimizacion | §19.6 | Ventaja declarada de RS que es un requisito de UX: *"the design points are selected and evaluated external to, and prior to, the optimization. This makes it possible to select design points and have real engineers working offline do the design and analysis work"* — **el optimizador debe poder comer una tabla de puntos analizados a mano** | CONSTRUIR |
| O-18 | optimizacion | §19.6 | El **Net Design Volume** de Raymer [ref 137] es la respuesta declarada al problema de "¿cabe?": *"Suitable for computerized aircraft optimization methods, it takes few additional inputs beyond those already needed"*. Pero *"it isn't perfect and doesn't fully capture the geometric changes"* | ambos |
| O-19 | optimizacion | §19.7 | **Cuándo el peso miente como proxy de costo**: *"if you are doing trade studies of alternative technologies, engines, avionics, manufacturing methods, or similar items, then weight is a poor approximation to cost"* y *"life-cycle cost is largely driven by fuel costs... A higher-aspect-ratio wing is heavier but saves fuel."* El software debe **avisar** cuando el trade study cae en esa lista | CONSTRUIR |
| O-20 | optimizacion | §19.7 | Frontera declarada: DAPCA sirve para optimizar, WBS no. *"It is more difficult to use cost as estimated by the detailed WBS methods... the number of inputs and assumptions overwhelms the optimization process. For these reasons, most companies use DAPCA or an in-house equivalent for conceptual design trade studies and optimizations, then use a detailed WBS method for the final contract pricing."* | CONSTRUIR |

### 1.3 Sizing (el lazo)

| # | dominio | § | requisito | A/C |
|---|---|---|---|---|
| S-01 | sizing | §19.3 | Sizing refinado **por segmento** con las ecs. (19.6)–(19.11), no con fracciones estadísticas | CONSTRUIR |
| S-02 | sizing | §19.3 | ⭐ **Gate de segmentación:** *"Mission-segment weight fractions should range between about 0.9 and 1.0. If a mission-segment weight fraction is less than 0.9, the accuracy should be improved by breaking that mission segment into two or more smaller segments. If the mission-segment weight fraction is calculated to be greater than 1.0, you have probably used the wrong units somewhere or have forgotten the negative sign on an exponent!"* → **fracción > 1.0 = ERROR duro; fracción < 0.9 = partir el segmento automáticamente** | CONSTRUIR |
| S-03 | sizing | §19.3 | Bifurcación **rubber vs fijo**: con rubber, (19.7) *"can be used unchanged for each iteration"*; con motor fijo *"would have to be recalculated for each iteration step"*, o usar (19.6) y tratar el combustible *"as a weight drop in the sizing iterations"* | CONSTRUIR |
| S-04 | sizing | §19.3 | Escalado del peso vacío ec. (19.13) con `c` de la Tabla 3.1 (típico **−0.1**, así que `1+c ≈ 0.9`). Y **cómo calcular tu propio `c`**: *"Make an arbitrary change in W₀, say a 10% increase, and recalculate W_e with all effects considered"* (alas, colas, fuselaje, tren, motor mayor) y despejar | CONSTRUIR |
| S-05 | sizing | §19.3 | ⭐ **Gate de cordura del autor**: *"this author gets nervous at a takeoff-weight difference greater than about 30% of the as-drawn weight"* ⇒ *"the results should be considered suspicious and the aircraft redrawn, reanalyzed, and resized"* | CONSTRUIR |
| S-06 | sizing | §19.3 | **Photo-scale**: coeficientes reusables *"provided that the sizing calculations stay close to the baseline TOGW, say 10–20%"*. Corrección ec. (19.14). Escape declarado: *"For most design efforts, and certainly for student projects, the photo-scale problem can be ignored."* | ambos |
| S-07 | sizing | §19.3 | Crédito de distancia: *"The distance travelled during climb is usually 'credited' to the cruise segment that follows, that is, that distance is subtracted from the required cruise range."* Y en descenso, *"credit should be taken for the distance travelled unless the mission requirements specifically exclude range credit"* | CONSTRUIR |
| S-08 | sizing | §19.3 | Viento: *"you must increase the required cruise range in the mission-segment weight fraction equation by the ratio of velocities (V_airspeed/V_groundspeed) while still using the actual airspeed for V. **Loiter is not affected by wind.**"* | CONSTRUIR |
| S-09 | sizing | §19.2 | El criterio de paro de los grandes: *"The computer iterates for sized takeoff weight by varying the assumed takeoff weight until the ending empty-weight fraction matches the empty-weight fraction determined by the detailed weight estimation."* | APRENDER |
| S-10 | sizing | §19.3 | Reserva y combustible atrapado: **+6%** sobre el combustible de misión (el DR-3 lo imprime como `RESERVE & TRAPPED FUEL ALLOWANCE = 1.060`) | CONSTRUIR |

### 1.4 Vehículos especiales (dónde el lazo cambia)

| # | dominio | § | requisito | A/C |
|---|---|---|---|---|
| V-01 | sizing | §20.10–20.11 | Eléctrico: **`BMF_total = Σ BMF_i` (SUMA, no producto)**. *"The total required aircraft Battery Mass Fraction (BMF) is then found as the sum (not product) of the various mission segment Battery Mass Fractions."* | CONSTRUIR |
| V-02 | sizing | §20.10 | Prohibición explícita: *"methods developed for fuel-burning aircraft should not be applied to electric aircraft because their derivations assumed that the aircraft gets lighter as the mission segment progresses."* | CONSTRUIR |
| V-03 | sizing | §20.10 | *"since W₀ doesn't change during the flight the logarithmic operation resulting from integration over the weight change isn't included"* — desaparece el `ln` de Breguet | ambos |
| V-04 | sizing | §22.4 | Cohetes: **Δ-V sustituye al alcance y Tsiolkovsky a Breguet.** *"Rather than a range requirement, we determine an equivalent parameter called Delta-V. Rather than the Breguet equation, we use Tsiolkovsky's Rocket equation."* La razón de masas `m_i/m_f = e^(ΔV/g₀I_sp)` *"is in the form of a mission-segment weight fraction as derived in Chapter 3"* ⇒ **misma arquitectura de lazo, otra ecuación de segmento** | CONSTRUIR |
| V-05 | sizing | §22.4 | Etapas: `ΔV_total = Σ ΔV_i` (22.14). **Suma otra vez** — igual que el BMF eléctrico | CONSTRUIR |
| V-06 | sizing | §22.4 | *"Launch vehicle boosters have extremely high sizing growth factors so the weight goes up even more."* → el lazo de cohete diverge más fácil; el amortiguamiento importa más | ambos |
| V-07 | pesos | §23.2–23.8 | Los **factores de ajuste numéricos** de configuraciones raras son entradas del motor de pesos, no del optimizador (§2.9) | CONSTRUIR |
| V-08 | optimizacion | §23.12 | **Diseño derivativo**: modo de optimización con restricciones distintas y **función de costo escalonada**, no continua (§2.10) | CONSTRUIR |

### 1.5 Escuela

| # | dominio | § | requisito |
|---|---|---|---|
| E-01 | escuela | §24.1 | El libro **manda el orden pedagógico**: *"The author recommends that students do their initial sizing and other pre-layout activities by hand as shown here, before being permitted to use RDS-Student or any other 'canned' design program. Then, use the computer for the laborious 'number-crunching' of sizing, performance, and trade studies."* ⇒ **la lección hace el primer lazo a mano y solo después desbloquea el optimizador** |
| E-02 | escuela | §24.1 | Honestidad de calificación: *"Were the author to grade himself in a college design course, these examples would rate at most a 'B.' The 'A' students would conduct far more analysis (structures, roll rate, c.g. envelopes, etc.) and would ultimately redraw the as-optimized aircraft to ensure that the analysis assumptions were realistic."* ⇒ **la rúbrica de la escuela: redibujar el as-optimized es lo que separa B de A** |
| E-03 | escuela | Preguntas cap 18–19 | Los ejercicios del libro son las lecciones (§6) |

---

## 2. FÍSICA Y ECUACIONES — con rango de validez, supuestos y qué se rompe fuera

### 2.1 DAPCA IV modificado (§18.4, p.696–697)

Dólares **2012**. `We` en lb {kg}, `V` = velocidad máxima en kt {km/h}.

```
(18.1)  H_E = 4.86 · We^0.777 · V^0.894 · Q^0.163        {fps}
              5.18 · We^0.777 · V^0.894 · Q^0.163        {mks}      horas de INGENIERÍA
(18.2)  H_T = 5.99 · We^0.777 · V^0.696 · Q^0.263        {fps}      horas de HERRAMENTAL
              [NO OBSERVADO: la constante {mks} de 18.2 no está en el texto OCR]
(18.3)  H_M = 7.37 · We^0.820 · V^0.484 · Q^0.641        {fps}
              10.5 · We^0.820 · V^0.484 · Q^0.641        {mks}      horas de MANUFACTURA
(18.4)  H_Q = 0.076 · H_M   si es carguero
            = 0.133 · H_M   en cualquier otro caso                  horas de CONTROL DE CALIDAD
(18.5)  C_D = 91.3 · We^0.630 · V^1.3                    {fps}
              67.4 · We^0.630 · V^1.3                    {mks}      costo de SOPORTE AL DESARROLLO
(18.6)  C_F = 2498 · We^0.325 · V^0.822 · FTA^1.21       {fps}
              1947 · We^0.325 · V^0.822 · FTA^1.21       {mks}      costo de PRUEBAS DE VUELO
(18.7)  C_M = 22.1 · We^0.921 · V^0.621 · Q^0.799        {fps}
              31.2 · We^0.921 · V^0.621 · Q^0.799        {mks}      costo de MATERIALES
                     [OCR DUDOSO: la constante mks se lee "31.3" o "31.2"; el texto la fusiona
                      con el "3112[" de la ecuación siguiente. NO la teclees sin verificar el PDF]
(18.8)  C_eng = 3112 · [ 0.043·T_max + 243.25·M_max + 0.969·T_turbine_inlet − 2228 ]   {fps}
                1724 · [ 9.66·T_max  + 243.25·M_max + ...            − 2228 ]          {mks}
        [OCR DUDOSO — RECONSTRUIDA]. En el escaneo la ecuación 18.8 está destrozada
        (fragmentos legibles: "0 969", "43T", "243. 25Mmax", "2228", "3112[", "l.72[4", "9 . 66Tmax").
        La estructura es cierta; los coeficientes deben VERIFICARSE contra el PDF antes de
        cualquier test. Marcada como no-fixture.
(18.9)  RDT&E + flyaway = H_E·R_E + H_T·R_T + H_M·R_M + H_Q·R_Q
                          + C_D + C_F + C_M + C_eng·N_eng + C_avionics
```

**Definiciones normativas (p.697):**
- `We` = peso vacío · `V` = velocidad máxima
- **`Q` = *"lesser of production quantity or number to be produced in five years"*** ← regla, no dato
- `FTA` = número de aviones de prueba en vuelo, *"typically 2–6"*
- `N_eng` = cantidad total producida × motores por avión
- `T_max` = empuje máximo del motor [lb o kN] · `M_max` = Mach máximo del motor
- `T_turbine inlet` = temperatura de entrada a turbina [°R o K] · `C_avionics` = costo de aviónica

**Wrap rates (2012 USD/hora, p.698)** — *"they include the direct salaries paid to employees as well as the
employee benefits, overhead, and administrative costs. Typically, the employee salaries are a little less
than half the wrap rate."*

| | |
|---|---|
| Ingeniería `R_E` | **$115** |
| Herramental `R_T` | **$118** |
| Control de calidad `R_Q` | **$108** |
| Manufactura `R_M` | **$98** |

**RANGO DE VALIDEZ (dicho por el libro, p.698–699):**
- Base estadística: *"non-stealth, non-composite fighters, trainers, transports, and bombers"*. **Fuera de eso hay que corregir.**
- *"DAPCA is probably not the very best set of CERs for any one class of aircraft, but is notable in that it seems to provide reasonable results for most classes of aircraft including fighters, bombers, and transports. With suitable adjustments, even GA and small UAV aircraft can be estimated by DAPCA."*
- **Las horas suponen un avión de ALUMINIO.** Otro material ⇒ multiplicar por el fudge factor.
- *"DAPCA assumes that the engine cost is known."* La ec. (18.8) es un parche importado de [ref 134]; *"For a turbofan engine, cost should be increased 15–20% higher than predicted with this equation. Note that the equation does not include the cost to develop a new engine."*

**QUÉ SE ROMPE FUERA DEL RANGO:**
- **Compuestos / furtividad**: subestima. Corrección ×1.2 global + fudge de material 1.1–1.8.
- **Comercial**: sobreestima. ×0.9.
- **Aviación general**: sobreestima brutalmente. *"People who have applied DAPCA to general aviation aircraft claim that the costs are reasonable after being divided by four! That is hard to believe, but perhaps is acceptable for relative trade studies."* ⇒ **en absoluto no sirve; en relativo sí.**
- **Prototipos / X-planes**: *"prototypes are usually built virtually by hand, with simplified prototype tooling, and can have labor hour costs much greater than accounted for by the learning curve"* ⇒ usar el método de peso-por-componente (C-07).
- **Derivativos**: **prohibido restar**. *"You cannot estimate cost by analyzing the revised design as if it were new and then analyzing the cost of the original design using the same methods, then subtracting one from the other. This does not work! Not even the proven methods of Chapter 18 can be applied in this fashion."* (§23.12, p.866)
- **Fundamento**: *"There is no 'fundamental physics' to underpin the analysis, so the analysts must obtain a massive amount of cost data, normalize it to ensure that varying accounting practices don't pollute the data, and correlate costs to suitable design parameters."* ⇒ **fuera de la nube de datos, la ecuación no ve nada.**

**Ajustes finales al precio (p.699):**
- **Investment cost factor 1.1–1.4** (costo del dinero + utilidad del contratista, *"considered highly proprietary by a company"*)
- **Repuestos iniciales: +10–15%** del precio de compra

### 2.2 La curva de aprendizaje (§18.3, p.693–694)

- Identificada en **Wright-Patterson AFB en los años 1930**: *"production labor costs decreased by up to 15% each time the production quantity was doubled. This is now called an 85% learning curve."*
- *"Later studies suggest that aircraft production typically follows a 75–85% learning curve."*
- *"The Boeing 727 learning curve, from first airplane to number 1000, followed an 80% learning curve that is an almost perfect straight line on log-log graph paper."*
- *"In statistical cost equations such as the ones presented below, learning curve effect is usually represented by the production quantity raised to a statistical power, i.e., an exponential term."*
- Fig. 18.2 rotula cinco curvas con `x = .926, .848, .678, .485, .263` (eje vertical "Production labor hr per aircraft", horizontal "Production quantity Q", `Q_i = 1`).

⭐ **[EXTENSIÓN DECLARADA — aritmética mía, sobre la relación que el libro sí enuncia]**
Los cinco exponentes de la Fig. 18.2 satisfacen exactamente `x = 1 + log₂(LC)`:

| LC | `1+log₂(LC)` | rótulo de la Fig. 18.2 |
|---|---|---|
| 95% | 0.926 | .926 ✓ |
| 90% | 0.848 | .848 ✓ |
| 80% | 0.678 | .678 ✓ |
| 70% | 0.485 | .485 ✓ |
| 60% | 0.263 | .263 ✓ |

De ahí, **los exponentes de `Q` en DAPCA SON curvas de aprendizaje implícitas** (`LC = 2^(x−1)`):

| ecuación | exponente de Q | LC equivalente | lectura |
|---|---|---|---|
| 18.3 manufactura | 0.641 | **≈78%** | dentro de la banda histórica 75–85% ✓ |
| 18.7 materiales | 0.799 | **≈87%** | apenas arriba de la banda — el material aprende menos que la mano de obra ✓ |
| 18.2 herramental | 0.263 | ≈60% | mayormente **no recurrente** |
| 18.1 ingeniería | 0.163 | ≈56% | mayormente **no recurrente** |

Motivo de declararlo: es un **test de plausibilidad de la implementación**. Si tu `dapca4` da una curva de
manufactura fuera de 70–90%, la implementación está mal. El libro no hace esta cuenta; la relación
`x = 1 + log₂(LC)` sí es suya (Fig. 18.2). **Qué se rompe fuera:** esto vale para el término `Q` solo, y solo
si `Q` se interpretó como cantidad acumulada, no como tasa anual.

**Validación cruzada que el propio libro entrega (p.695):** *"the total engineering effort for a 500-aircraft
production run is about three times the engineering effort for a one-aircraft production run"* ⇒ `500^0.163 = 2.75 ≈ 3` ✓.
**Ese es un test unitario de una línea, y es del autor, no mío.**

**El debate abierto que hay que respetar (p.694):** *"In recent years some people have declared 'the learning
curve is dead' because of the new manufacturing technologies such as numerically controlled machining and
3-D printing... There is probably some truth to this, but not as much as hoped for. There will be a
learning-curve effect as long as humans still work on production lines. The first few dozen units will
always take longer as we work the bugs out of the production operation. Also, don't forget the
'expectation' factor."*
Y el riesgo del "expectation factor": *"if the expected production quantity doesn't actually happen, the
company will be stuck with those costs. This is exactly what happened on the B-2 program—poor Northrop!"*

### 2.3 Costos de operación y mantenimiento (§18.5, p.699–703)

**Tabla 18.1 — Aproximaciones de parámetros de LCC (p.700)**

| Clase de avión | FH/YR/AC | Crew ratio | MMH/FH |
|---|---|---|---|
| Avión ligero | 500–1000 | — | 1/4 – 1 |
| Business jet | 500–2000 | — | 3–6 |
| Entrenador a chorro | 300–500 | — | 6–10 |
| Caza (moderno) | 300–500 | 1.1 | 10–15 |
| Bombardero | 300–500 | 1.5 | 25–50 |
| Transporte militar | 700–1400 | 1.5 si FH/YR < 1200 · 2.5 si 1200 < FH/YR < 2400 · 3.5 si 2400 < FH/YR | 20–40 |
| Transporte civil | 2500–4500 | — | 5–15 |

`[OCR DUDOSO: los encabezados de la tabla vienen destrozados; la asignación de columnas está inferida
del texto que dice "Typical crew ratios are provided in Table 18.1" y "Typical values [de MMH/FH] are shown
in Table 18.1". Los valores numéricos sí se leen limpios.]`

**Combustible:** perfil típico → combustible/hora promedio × horas de vuelo al año (Tabla 18.1) × precio.
Referencia de volatilidad que el libro usa como advertencia: *"going from about 80 cents per gallon in 1998
to about $4 per gallon in 2011, which was a 30% increase over the previous year."*
**Aceite: <0.5% del costo de combustible, se ignora.**

**Costo de tripulación civil, por hora-bloque (2012 USD, de datos de Boeing vía [ref 95]):**
```
(18.10) Costo tripulación de DOS = 70.4 ... (W₀/10⁵)^0.3 + 168.8    {fps}
                                 = 74.5 ... (W₀/10⁵)^0.3 + 168.8    {mks}
(18.11) Costo tripulación de TRES = 94.5 ... (W₀/10⁵)^0.3 + 237.2   {fps}
                                  = 100  ... (W₀/10⁵)^0.3 + 237.2   {mks}
   V_c = velocidad de crucero [kt o km/h];  W₀ = peso bruto de despegue [lb o kg]
```
`[OCR DUDOSO: los COEFICIENTES (70.4 / 168.8 / 94.5 / 237.2 / 74.5 / 100) se leen limpios, pero la
AGRUPACIÓN de V_c respecto al paréntesis y al exponente 0.3 NO se lee. No implementes 18.10/18.11
sin verificar el PDF.]`

Advertencia del autor sobre su propia ecuación: *"These equations must be viewed as rough approximations
only... The B-747 crew costs for an old established airline have been as much as five times the cost seen
in a new low-fare airline!"*

**Tripulación militar:** `nº de aviones × tripulantes por avión × crew ratio`. *"Military pilots no longer get
their own airplane as in the movies."* Crew ratio 1.1 (cazas) a 3.5 (transportes muy volados). Costo por
tripulante: *"In the absence of better data, the engineering hourly wrap-rates times 2080 hours per year
can be used for initial trade studies and student design projects."* ⇒ **$115 × 2080 = $239,200/año** en 2012 USD.

**Mantenimiento:** MMH/FH es *"the primary measure of maintenance 'goodness'"*, va de *"well under 1.0 for
small private aircraft to over 100 for certain special-purpose aircraft"*, y *"is roughly proportional to
weight because the parts count and systems complexity go up with weight."*
⭐ Efecto de utilización, con el número: *"the DC-9 has a MMH/FH of about 6.4 in civilian operation. The same
plane in military service (C-9), flying only about half as many hours per year, has a MMH/FH of about 12."*
**El mismo avión cuesta el doble de mantener si vuela la mitad.** Materiales de mantenimiento ≈ costo de
mano de obra para militares.

```
(18.12) costo material / FH   = 3.3·(C_a/10⁶) + 14.2 + 58·N_e·[(C_e/10⁶) − 26.1]
(18.13) costo material / ciclo = 4.0·(C_a/10⁶) + 9.3 + 7.5·N_e·[(C_e/10⁶) + 5.6]
        C_a = costo del avión menos motores · C_e = costo por motor · N_e = nº de motores
        Costos en dólares 2012 por hora de vuelo o por ciclo.
```
`[OCR DUDOSO — las ecs. 18.12 y 18.13 vienen severamente reflowadas; los términos y constantes
(3.3, 14.2, 58, 26.1, 4.0, 9.3, 7.5, 5.6) se leen sueltos pero su AGRUPACIÓN no es confiable.
NO son fixture. Verificar contra el PDF.]`

**Depreciación:** línea recta. Airframe: `(costo_airframe × (1 − valor_reventa)) / años`. Con reventa 10% y
12 años ⇒ `× 0.9 / 12`. Motor: **4 años**, reventa despreciable. Aviones comerciales se deprecian en
**12–14 años** aunque *"they can have a useful life of 20 years or more"*. **Seguro: +1–3%** del costo de operaciones.

### 2.4 Economía de aerolínea y NPV (§18.7, p.704–707)

- **DOC** = combustible, aceite, tripulación, mantenimiento, depreciación, seguro. **IOC** = todo lo demás
  (instalaciones, ventas, servicio al cliente, administración). *"IOC costs do not lend themselves to
  statistical analysis and depend very little upon the aircraft design itself."* Rango: **IOC ≈ 1/3 a 1× DOC**.
- **Tasas de aterrizaje** ∝ peso de aterrizaje. *"In some cases the landing fee can nearly equal the fuel cost
  for the flight, although a more typical value is about one-third of the fuel cost."*
- **Impuesto al carbono** (§10): *"By some estimates, the fees being considered would equal one-fourth of
  all airline profits."*
- **DOC por asiento-milla** es la measure of merit. *"Current airliners average a DOC of about 6–8 cents per
  seat-mile."* **CASM** (directos + indirectos) *"for a major airline is about 15 cents, of which 4 is labor,
  5 is fuel, and the rest is 'other.'"*
- **Ingresos:** primera ≈ 2× turista; ejecutiva ≈ 1.5×; excursión 50–90%. Mezcla del Atlántico Norte
  5% / 15% / 10% / 70% ⇒ *"the average fare paid is approximately the coach fare."* **Load factor 60–70%.**
- **Break-even del fabricante:** `nº de aviones = costo de desarrollo / margen de contribución`.
  Ejemplo literal: $400M de desarrollo (incluyendo costo del dinero), margen $2M ⇒ **avión #200**.
  *"We must set our sales price carefully: too high, and we won't make many sales. But if we set the price
  too low, the break-even point might not ever be reached."*
- **Break-even de la aerolínea:** `load factor = costo por asiento-milla / tarifa media por asiento-milla`.
  Con DOC solo = *"the load factor at which the passengers pay just enough to fly the airplane"*; con DOC+IOC
  = costo total. Aproximación: **IOC/asiento-milla ≈ DOC/asiento-milla**.

```
(18.14) V_n  = V_0 · (1 + r)^n            valor futuro
(18.15) V_np = V_n / (1 + r)^n            valor presente neto ;  r = "discount factor"
```
- **NPV del airliner** = Σ de los NPV de las utilidades anuales (ingresos − DOC − IOC, **sin depreciación**,
  *"because it is the yearly apportionment of the purchase price"*) + NPV del salvamento (~10% del precio).
- **Criterio:** *"The total NPV must be greater than the purchase price of the aircraft, or the investment
  will not return the expected normal rate of return."*
- **Elección de `r`:** *"greater than the interest received from extremely safe investments such as government
  bonds, but should be less than the return from risky investments such as volatile stocks... probably no
  less than the real rate of return on the airline company's stock."*
- **IRR** = el `r` para el cual NPV = inversión exactamente.

### 2.5 Sizing refinado por segmento (§19.3, p.711–717)

```
(19.1)  ΣF_x = T·cos(α + φ_T) − D − W·sin γ
(19.2)  ΣF_z = T·sin(α + φ_T) + L − W·cos γ
(19.3)  Ẇ = −C·T
(19.4)  C = C_power·V/η_p = C_bhp·V/(550·η_p)          equivalente para motor de pistón
(19.5)  T = P·η_p/V = 550·bhp·η_p/V
(19.6)  W_f,i = C · T · d                              combustible por duración d
(19.7)  W_i/W_(i−1) = 1 − C·d·(T/W)_i                  fracción por tiempo
(19.8)  W_i/W_(i−1) = exp[ −C·Δh_e / (V·(1 − D/T)) ]   climb/accel por método de energía
(19.9)  Δh_e = Δ(h + V²/2g)
(19.10) W_i/W_(i−1) = exp[ −R·C / (V·(L/D)) ]          crucero (cruise-climb)
(19.11) W_i/W_(i−1) = exp[ −E·C / (L/D) ]              loiter
(19.12) V_v = V·[(T/W) − q·C_D0/(W/S) − (W/S)·K/q]     descenso = ascenso negativo
        [OCR DUDOSO: la ec. 19.12 viene reflowada; la forma mostrada es la de la ec. de
         ascenso del cap 17 que el texto declara repetir. Verificar contra el cap 17.]
(19.13) W_e = W_e,as-drawn · (W₀ / W₀,as-drawn)^(1+c)   escalado del vacío, c de Tabla 3.1, típico −0.1
(19.14) C_D0' = (1−X)·C_D0 + X·C_D0 / (W₀/W₀,as-drawn)^0.666   corrección de photo-scale
```

**Supuestos y rangos declarados:**
- **(19.7)–(19.8)**: *"A long climb or large change in velocity should be broken into segments such that the
  quantity C/[V(1 − D/T)] is approximately constant."*
- **(19.10)** es **cruise-climb**. *"For a constant-airspeed, constant-altitude cruise, the cruise must be
  broken into shorter segments and the L/D revised as the weight changes."*
- **Arranque/calentamiento/taxi**: el estadístico era 0.97–0.99; el refinado usa el motor real, *"Typically,
  this would be 15 min at idle power."* Requisitos militares comunes: **5 min a potencia militar seca**;
  transportes: **14 min en ralentí de tierra + 1 min a empuje de despegue**.
- **Aterrizaje**: `W_i/W_(i−1)` de **0.992–0.997** *"is probably good enough even for more refined sizing"*.
  Motivo: *"From obstacle clearance height to full stop takes less than 1 min and is usually flown at idle
  power. Even if thrust reversers are employed, the impact upon total fuel weight is small because the thrust
  reversers are operated for only about 10 s."*
- **Descenso**: *"The detailed calculation of descent fuel is probably more trouble than it is worth for quick
  studies and student design projects. The earlier historical method [Eq. (6.22)] is usually good enough."*
- **Photo-scale (19.14)**: válido si el sizing se queda a **10–20% del TOGW baseline**. Fuera de eso:
  *"If the TOGW is halved, the wing area should be halved also... the internal volume is found from the cube
  of the length scaling, that is, a factor of (1/2) raised to the 3/2 power, or 0.354. But the weight was only
  halved, so the aircraft doesn't have enough internal volume."* Y el fuselaje de pasaje **no encoge**:
  *"It still has to hold the passengers, crew, cargo, galleys, and toilets."*
  Efecto medido en un estudio real de transporte futuro: el exponente de peso vacío de la Tabla 3.1
  pasa de **−0.06 a −0.31**, *"a huge difference"*.
  Ejemplo numérico literal: *"if the sizing calculation scales to 50% of TOGW, and 35% of the as-drawn wetted
  area will not photo-scale, then a parasitic drag coefficient of 100 counts (0.0100) will increase to 120 counts."*

### 2.6 Tabla 19.1 — los tres tipos de trade study (§19.5, p.724)

| **Design trades** | **Requirements trades** | **Growth sensitivities** |
|---|---|---|
| T/W y W/S | Alcance / carga de pago / pasajeros | Dead weight |
| A, Λ | Tiempo de loiter | C_D0 |
| t/c, λ | Velocidad | K |
| Forma y comba del perfil | Razón de viraje, P_s, n_max | C_Dwave |
| Dispositivos de alta sustentación | Longitud de pista | C_Lmax |
| Esbeltez del fuselaje | Tiempo de ascenso | Empuje |
| BPR, OPR, TIT, etc. | Nivel de firma | SFC |
| Diámetro de hélice | Design-to-cost | Precio del combustible |
| Materiales | | |
| Configuración: tipo de cola · flecha variable · número y tipo de motores · mantenibilidad · observables · arreglo de pasaje | | |
| Tecnologías avanzadas | | |

**Definiciones normativas:**
- *"Design trades reduce the weight and cost of the aircraft to meet a given set of mission and performance requirements."*
- *"Requirements trades determine the sensitivity of the aircraft to changes in the design requirements. If one requirement forces a large increase in weight or cost, the customer can relax it."*
- *"Growth-sensitivity trade studies determine how much the aircraft weight will be impacted if various parameters such as drag or specific fuel consumption should increase."*

⭐ **"Dead Weight"** — *"a catch-all phrase for 'the airplane empty weight might increase by X pounds.' It might
come about because the structure is heavier, or the tires need to be made larger, or more avionics was added
to the design. Perhaps a new technology turned out to be heavier when it went from laboratory to reality
(like, every time). Perhaps the airplane was out of balance and some ballast had to be added."*
Y la joya epistemológica: *"When the actual aircraft is finished and put up on scales, **there is no dead
weight!** But there may be additional weight due to problems like those mentioned above. During conceptual
design, our Dead Weight trade studies have hopefully warned us their impact even before they happen."*

### 2.7 Catálogo MDO (§19.6, p.728–730) — con sus reglas

| Método | Cómo funciona (literal) | Regla / advertencia |
|---|---|---|
| **Carpet plots repetidos** | El método clásico anidado | Costo explosivo: 3⁶ = 729 |
| **Response Surface** | *"the multivariable parametric data as already discussed can be fit to an approximating multidimensional surface equation... which can then be mathematically or numerically solved for an optimum"* · *"the classic aircraft design carpet plot is a graphically fit response surface but limited to three dimensions (two variables and the measure of merit)"* | ⭐ **grado ≥ 3, mejor 4 o 5**. Beneficio extra: *"RS has a further advantage of naturally smoothing out numerical noise resulting from the parametric analysis"* |
| **Latin squares** | *"It can be viewed as a mathematical approximation for reducing the number of data points needed to be calculated and is related to the 'Design of Experiments' method. Essentially, Latin squares tells you which data points to skip and how to approximate the results that the skipped points would have provided."* | *"It is analogous to the old sizing expert's trick—surprisingly good—of drawing a family of curves from five data points."* Usado en Boeing entre otras |
| **Finite difference** | *"Small parametric changes are made to the aircraft one at a time, and the change in the measure of merit... is used to define a slope (first derivative) of the 'system response'... These derivatives are then used to predict the optimum solution"* | *"iteration is used to drive out the obvious linearization errors"* |
| ⭐ **Gradiente exhaustivo (el del propio Raymer)** | *"Each variable is parametrically varied by plus and minus some selected 'step size,' and the resulting aircraft are all analyzed for aerodynamics, weights, sizing, cost, and performance. The 'best' variant, that with the lowest value of the selected measure of merit, which also meets all performance requirements, is remembered and, when all parametric variations about the initial baseline are exhausted, becomes the center point baseline for the next iteration loop. This continues until no better variant is found, then the stepping distance is shortened and the process repeated until some desired level of resolution is obtained."* | **Es un pattern search / coordinate descent con reducción de paso, directamente implementable.** *"This author has had good results with exhaustive searching by a simple gradient method to simultaneously optimize an aircraft for the six basic design parameters"* |
| **Implicit Function Theorem** | *"differentiates the various governing equations to obtain sensitivity equations. These are used to set up simultaneous linear algebraic equations, which are then solved for an optimal solution."* | — |
| **Decomposition** | *"works by partitioning a large engineering design optimization problem into a number of smaller, solvable problems ('submodules')... top-level routines pass data between the submodules in a structured manner that retains their coupling"*. Ejemplo del libro: módulo de aero que sabe arrastre/cargas dada la forma + módulo de estructuras que sabe peso/deflexiones dadas las cargas, iterando *"until they converge at an optimum for the measure of merit such as weight or drag, or a blended bit of both"* | — |
| **Algoritmos genéticos** | *"The design variables are coded into binary strings such that a collection of 1s and 0s defines a particular aircraft"*. Población inicial aleatoria → fitness → reproducción por cruce de genes → *"The 'child' might be able to say, 'I got my large engine from my father, and my area ruling from my mother.'"* | ⭐ **Escepticismo declarado:** la convergencia poblacional *"is presumed to represent an optimum (but occasionally it doesn't—the subject of much research today)"* |

**Definición de MDO que el libro adopta** (J. Sobieski, NASA Langley): *"a methodology for design of complex
engineering systems that are governed by mutually interacting physical phenomena and made up of distinct
interacting subsystems"*, apta para sistemas donde *"in their design, everything influences everything else"*.
Y el comentario de Raymer: *"That is, in fact, a pretty good description of aircraft conceptual design, and
the various multivariable optimizations just described can be viewed as MDO—even the simple sizing carpet
plots that, after all, optimize over disparate disciplines of aerodynamics, weights, propulsion, sizing,
and performance."*

### 2.8 Lo eléctrico: dónde el lazo cambia de álgebra (§20.10–20.11, p.755–760)

```
(20.1) E = m_b · E_sb · η_b2s / (1000 · P_used)        run-time endurance [hr]
(20.2) P_used·η_p = T·V = D·V = (W/(L/D))·V            nivel de vuelo (de la ec. 3.9)
(20.3) E = 3.6 · (L/D) · E_sb·η_b2s·η_p / (g·V) · (m_b/m)      loiter en vuelo nivelado [hr]
(20.4) R = 3.6 · (L/D) · E_sb·η_b2s·η_p / g · (m_b/m)          alcance en vuelo nivelado [km]
(20.5) V_v = η_p·P_used·1000/(m·g) − 3.6·V/(L/D)               régimen de ascenso [m/s]
(20.6) BMF = 1000·P_used·E / (E_sb·η_b2s·m)            run-time conocido
(20.7) BMF = E·V·g / (3.6·E_sb·η_b2s·η_p·(L/D))        loiter nivelado
(20.8) BMF = R·g   / (3.6·E_sb·η_b2s·η_p·(L/D))        crucero nivelado
(20.9) BMF = h·P_used / (3.6·V_v·E_sb·η_b2s·m)         ascenso
(20.10) BMF_disponible = (W₀ − W_e − W_payload)/W₀
(20.11) W₀ = W_payload / (1 − BMF − W_e/W₀)            ECUACIÓN DE SIZING ELÉCTRICA
```
> **AUDITORÍA del pliego existente §7.9:** las ecuaciones 20.6–20.9 y 20.11 están **correctas**. El OCR renderiza
> "BMF" como "EMF" en todo el capítulo; la lectura del pliego es la buena (*"The total required aircraft
> Battery Mass Fraction (BMF)"*). Eficiencias, Tabla 20.1 y el benchmark de la gasolina: **verificados**.
> **Lo que faltaba y aquí se agrega:** ecs. 20.1–20.5, y la regla de ascenso siguiente.

⭐ **Regla nueva no recogida antes (p.759):** *"L/D should be the climb value, which is about **0.866 times the
maximum value** if the aircraft is climbing at the climb-optimal speed (~**76%** of the speed for best L/D,
or around **60–80 kts** for most general aviation aircraft)."*
Y sobre (20.6): *"Propeller efficiency doesn't enter into the calculation because it doesn't matter what the
motor is connected to—**if it were driving a butter churn for that length of time it would require the same
battery mass fraction**."*

**Rangos y supuestos:**
- (20.1) y (20.6) son *"independent of flight condition or vehicle weight, and [do] not assume level or
  unaccelerated flight"* ⇒ sirven para despegue, descenso, viraje y VTOL.
- (20.3)/(20.4)/(20.7)/(20.8) **exigen vuelo nivelado**.
- La única no linealidad de (20.11) es `W_e/W₀`, porque **`BMF_total` no depende de `W₀`** ⇒ converge más
  rápido que el caso térmico. *"Selecting a specific value for empty weight fraction makes this a closed-form
  calculation, but this is a simplistic assumption."*
- Advertencia de calibración: *"Those are based on aircraft with fuel-burning engines so it is wise to adjust
  the constant terms using data for recent electric-powered aircraft."*
- Alternativa declarada de modelado: *"one could treat propulsion and avionics as 'payload' with fixed values,
  removing them from the estimation of W_e. Or, portions could be split between the two."*
- **Escape para diseños chicos:** *"It is fairly common in the design of electric-powered aircraft to select a
  motor as 'about right' for the class of aircraft, and then find the aircraft weight based on a P/W estimated
  for performance reasons (Eq. 6.24). The entire sizing process described above is skipped, but the mission
  range isn't known until later calculations are completed. If range is not met, a more-powerful motor and a
  higher gross weight must be assumed and the process repeated."*

### 2.9 Cohetes: la misma arquitectura, otra ecuación de segmento (§22.2, p.806–819)

```
(22.5)  m·V_s²/R = m·g                              fuerza centrífuga = peso
(22.6)  g = g₀·(R₀/(R₀+h))²                         gravedad con la altura
(22.7)  V_s = R₀·√(g₀/(R₀+h))                       velocidad orbital requerida
        g₀ = 32.1727 ft/s² {9.8062 m/s²} (Tierra) · R₀ = 20,925,646 ft {6,378,137 m} (Tierra)
(22.8/9/10)  derivación por conservación de momento: ΔV = m_prop·V_exhaust / m_final
(22.11) ecuación del cohete usando V_exhaust
(22.12) ecuación del cohete usando I_sp:  ΔV = g₀·I_sp·ln(m_i/m_f)
(22.13) RAZÓN DE MASAS: m_i/m_f = e^(ΔV/(g₀·I_sp)) = e^(ΔV/V_exhaust)
(22.14) ΔV_total = Σ ΔV_i = ΔV₁ + ΔV₂ + ΔV₃ + ...       cohete por etapas
(22.15)–(22.17) formas de etapas; (22.17) supone mismo I_sp y desprecia el vacío de todas
        las etapas menos la última — *"This is dubious, but does illustrate how the mass ratio
        appears much better for a staged rocket than for a single stage."*
```

⭐ **La frase que cierra el puente arquitectónico (p.816):** de (22.13), *"An even more useful form for designers
is found by solving for the required mass ratio... **This is in the form of a mission-segment weight fraction
as derived in Chapter 3**, allowing the calculation of the propellant mass required to obtain the required
Delta-V."* ⇒ **el mismo lazo de sizing, con otra `fracción_de_segmento(...)` inyectada.**

**Presupuesto de Δ-V (datos duros, p.812–814):**
- Tierra → órbita de Marte: *"roughly 38,000 fps {12,000 mps}"*
- Ayuda de la rotación terrestre al este: **1,542 fps {470 mps}** × cos(latitud). Órbita polar: cero ayuda.
  Hacia el oeste: Δ-V adicional. *"the closer the launch site is to the equator, the easier it is to reach orbit."*
- Gravedad + arrastre de subida: **+~6,000 fps {1,830 mps}** para llegar a órbita terrestre
- Velocidad de escape = velocidad orbital × √2
- **Tabla 22.3 — Hohmann desde órbita terrestre**: Mercurio 13,411 mps / 110 días · Venus 11,582 / 150 d ·
  Marte 11,582 / 260 d · Júpiter 14,021 / 2.7 años · Saturno 14,935 / 6 a · Urano 15,545 / 16 a ·
  Neptuno 15,850 / 31 a · Plutón 16,154 / 46 a
- **Tabla 22.2 — cuerpos celestes** (diámetro, masa relativa, gravedad específica, g superficial, velocidad de
  escape) — legible pero con reflow severo; usar solo Tierra/Luna/Marte que se leen limpios:
  Tierra g=9.806 m/s², v_esc=11,179 m/s · Luna g=1.58, v_esc=2380 · Marte g=3.749, v_esc=5000
- **Advertencia de ventana:** *"Although you can always do a Hohmann transfer from one planet's orbital radius
  to another, it is not always the case that the planet is there when you arrive!"*
- **Límite declarado del método:** *"Calculation of Delta-V to perform the required mission is, of course, more
  complicated than this brief overview implies. This is especially the case where maneuvers like gravity
  assist are employed. To really get the correct answer, even Einstein's relativity must be considered."*

**Reusabilidad como trade study, en las palabras del cliente (p.818):** *"Launch vehicle reusability should
reduce operational costs, but adds to the system development cost and weight... Finally, the booster must be
sized to its mission including the empty weight impact of these additional needs. Launch vehicle boosters have
extremely high sizing growth factors so the weight goes up even more. All of this adds to the weight and cost
of a reusable system. **The question is: are those costs so large that it remains cheaper to throw the whole
thing away after each flight? The jury is still out.**"*

### 2.10 Configuraciones no convencionales — los factores numéricos (§23, p.833–866)

⭐ **Los TRES problemas que hunden ideas nuevas (§23.1, p.834), literal:**
> *"There are three main problems that sink new ideas. Two are related: **wetted area** and **trimmed maximum
> lift coefficient**. Wetted area directly drives the parasitic drag and also has a large effect on empty
> weight. If a new idea has features that increase the wetted area over a normal design, it is unlikely that
> it will be worth it in the end.
> The problem with trimmed maximum lift capability is more subtle. Many innovative ideas include a lifting
> surface farther to the rear than a regular wing. This is fine in normal flight, but for landing it is not
> possible to trim the design when large flaps are deflected on the back wing. Without large flaps on all
> lifting surfaces, for trim or any other reason, those lifting surfaces must be made bigger. This makes them
> heavier, increases wetted area, and usually obliterates whatever benefit was expected.
> The third problem: **We always fool ourselves in weight estimation.** When evaluating the new hardware needed
> to implement our innovation, we have little understanding of the real-world problems. Nobody has made one
> like that before. We also show little patience with a conservative weight [estimate]."*

**Ajustes numéricos declarados (entradas del motor de pesos, no del optimizador):**

| Concepto | Ajuste | § / línea |
|---|---|---|
| **Ala volante / BWB** | *"the statistical weight equations of Chapter 15 can be applied, including the **0.768 wing weight adjustment** typical for delta wings if the flying wing is highly swept"*; el "fuselaje" central *"probably with a **weight adjustment of 0.774** as used for delta wings"* | §23.2, líneas 42324–42332 |
| **BWB (dato de estudio citado)** | *"a **15% reduction in sized takeoff weight**, a **20% improvement in L/D**, and a **27% reduction in fuel usage**"* [ref 163] | §23.2, línea 42382 |
| **Ala delta** | *"the weight equations of Chapter 15 suggest a **0.768 wing weight adjustment** for delta wings and a further weight adjustment to the fuselage of **0.774**"* | §23.3, línea 42409 |
| **Bombardero delta (dato citado)** | *"takeoff gross weight a full **30% lower** than a conventional bomber design"* | §23.3, línea 42430 |
| **Joined wing** | *"substantial reduction in wing structural weight... **on the order of 30%**"*; promesa teórica de **50%** con problemas fundamentales | §23.8, líneas 42817, 42876 |
| **Tandem / ala partida** | *"a half-size wing only has **35% of the volume**, so two of them have only **70% of the original volume**"* (cuadrado-cubo, §19) — golpea tanques y c.g. | §23.9, líneas 42900–42902 |
| **Ala de flecha adelantada** | *"Properly done, there is little weight penalty"* con compuestos y bend-twist coupling; pero *"not true if landing speed sizes the wing"* | §23.4 |

**Y la advertencia de método que aplica a TODO el capítulo (p.834):** *"Be advised that others, especially
proponents of a particular unique concept, might hotly disagree with some of this author's opinions and data
that follow. Also, **no claim is made as to the absolute correctness of this information.** It might be too
pessimistic, reflecting the author's 'show-me' engineering mentality, or it might be too optimistic,
reflecting this author's love of novel and creative engineering approaches."*

### 2.11 Diseño derivativo: optimización con función de costo ESCALONADA (§23.12, p.863–866)

Este apartado es un **modo de optimización distinto** y hay que implementarlo como tal.

- **El problema:** *"whatever we are trying to do with the modified airplane is constrained by the reality of
  the existing airplane. For a blank-sheet-of-paper design, if we need a little more wing span, we can redraw
  a few lines or type a few commands into the CAD program. For a derivative design, we need to know if it is
  feasible and affordable to extend the wing span."*
- ⭐ **LA FUNCIÓN ESCALÓN, literal:** *"There is a **cost step function**: it is fairly cheap to extend the wing
  span until you reach the length where the extra load requires a wing center-section redesign, and then the
  cost suddenly goes up a lot. You need to know where that is before you can decide how much to extend the
  wing span. **There are no top-level, rule-of-thumb estimations. You need to do the real calculations.**"*
  ⇒ **un optimizador de gradiente NO puede con esto.** Las derivadas mienten en el escalón.
- **Márgenes de crecimiento típicos (dato duro):** *"The landing gear of new aircraft are usually designed with
  a **25% increase in gross weight**, to allow for future growth."* Volumen extra cerca de las puntas
  convertible a tanque; holgura al suelo para hélice/turbofán mayor. P³I y "spiral development".
- **Los cuellos de botella duros:** peso total permitido para un tren dado (*"very difficult... once the
  built-in growth allowance is used up"* — struts, forjas caras y de largo plazo, presión de llanta que daña
  la pista, llantas mayores que no caben en el pozo, frenos); holgura al suelo para hélice o góndola; y
  **el diámetro del ducto de admisión interno**: *"it is almost impossible to increase the diameter of the
  internal inlet duct. An entire redesign is necessary, as was done for the F-86H and the British Nimrod."*
- **Interoperabilidad como restricción:** mismos materiales y procesos; *"You would like for the pilots of the
  current airplane to be able to fly the derivative with minimal training and hopefully avoid the need for a
  new 'type rating'... This requires minimal changes to the cockpit controls and instruments, flying qualities,
  and emergency procedures."*
- **Los 12 cambios típicos** (lista literal, p.865): TOGW mayor · más aviónica · más carga de pago · nuevos
  tipos de carga · combustible/carga externa · más combustible · más empuje del motor actual · re-motorización ·
  extensión de punta o raíz de ala · winglets · ala nueva · estiramiento de fuselaje
  (*"watch the tail-down ground angle"*) · pods y pallets pegados.
- ⭐ **REQUISITO DE CALIBRACIÓN (esto es un gate de software):** *"Our analysis tools, suitable for conceptual
  design, are forced to almost perfectly match the known capabilities of the original airplane. Otherwise,
  nobody will believe the numbers for the modified airplane. **This often requires 'tweaking' and
  'fudge-factoring' the analysis inputs until the correct answers are obtained.** Once we have calibrated the
  analysis to the unmodified aircraft and can match the range and key performance points, we can define the
  required changes..."*
- **Pesos:** *"The weight of a modified part is greater than the weight of that part if designed all new.
  Often, a simple pounds-per-square-foot method is better than a sophisticated statistical equation.
  The best answer, though, is a detail weights buildup of the additional parts."*
- **Costo:** WBS es lo correcto. El CER de RAND para derivativos [ref 169] son rectas en log-log basadas en
  **solo 11 aviones militares** — *"it seems reasonable for most classes of aircraft until better data are
  available"*. Y la regla contable: **"Take no credit for the old parts which are 'thrown away.' Nobody
  reimburses you for those 'returns.'"**

---

## 3. FIXTURES DE TEST

> Regla del contrato: los ejemplos numéricos del libro son la suite de aceptación.
> Marco cada fixture con su grado de confianza: **✅ tipografiado** (texto de máquina, transcripción segura),
> **⚠️ manuscrito** (escaneo de la letra del autor, transcripción parcial), **❌ imagen** (no observable).

### FIXTURE raymer-18-learning-500 ✅ [§18.4, p.695]
```
entradas:  Q = 500 ; ecuación (18.1) H_E ∝ Q^0.163
salida esperada:  H_E(500)/H_E(1) ≈ 3
            (el libro: "the total engineering effort for a 500-aircraft production run is about
             three times the engineering effort for a one-aircraft production run")
verificación: 500^0.163 = 2.75
tolerancia: el libro dice "about three" ⇒ aceptar 2.5–3.5
por qué importa: es el ÚNICO test cruzado que el autor da de DAPCA. Test unitario de una línea.
```

### FIXTURE raymer-18-learning-exponents ✅ [§18.3, Fig. 18.2, p.694]
```
entradas:  LC ∈ {95%, 90%, 80%, 70%, 60%}
salida esperada:  x = 1 + log2(LC) = {0.926, 0.848, 0.678, 0.485, 0.263}
tolerancia: exacta a 3 decimales (los rótulos de la figura son exactos)
nota: los rótulos SÍ están en el texto OCR; la curva graficada NO (es imagen).
```

### FIXTURE raymer-18-cer-airliner ✅ [§18.3, p.691]
```
entradas:  We = 100,000 lb  (ejemplo mío para probar la fórmula del libro)
fórmula del libro:  Precio = $5,000,000 + 550 · We[lb]   {$5M + 1200 · We[kg]}
salida esperada:  $60,000,000 (dólares 2012)
consistencia de unidades a verificar: 550 USD/lb × 2.20462 lb/kg = 1212 USD/kg ≈ 1200 ✓
tolerancia: la conversión redondea; aceptar 1%
```

### FIXTURE raymer-18-dollars-per-pound ✅ [§18.3, p.691]
```
Banda de cordura para cualquier salida de dapca4, en USD 2012 por libra de peso vacío:
   GA pequeña ~$200 · airliners y business jets ~$800 · cazas viejos ~$2,000
   F-22 ~$3,500 · F-35 acercándose a $5,000
uso: gate de rango. Si dapca4 devuelve $50/lb o $20,000/lb para una clase conocida, está roto.
cita: "Aircraft are bought by the pound."
```

### FIXTURE raymer-18-f15-f16-constant-dollars ✅ [§18.1, p.688]
```
entradas:  F-15 = $17.6M y F-16 = $10.8M en dólares del año (finales de los 1970s)
           F-15 = $18.8M y F-16 =  $8.2M en dólares CONSTANTES de 1978
salida esperada del comparador:  then-year → F-15 cuesta +63% ; constant-1978 → F-15 cuesta +129%
           (el libro dice "only 60% more" y "actually cost 130% more")
tolerancia: 3 puntos porcentuales
por qué importa: es el TEST del gate C-12. Un comparador que no distingue año-base da la respuesta
                 equivocada por un factor de 2 en la conclusión.
```

### FIXTURE raymer-18-dc9-mmhfh ✅ [§18.5, p.702]
```
entradas:  mismo avión (DC-9 / C-9), utilización militar ≈ mitad de la civil
salida esperada:  MMH/FH civil ≈ 6.4  →  militar ≈ 12
tolerancia: 10%
por qué importa: prueba que el modelo de mantenimiento depende de la UTILIZACIÓN, no solo del peso.
```

### FIXTURE raymer-18-breakeven-manufacturer ✅ [§18.7, p.706]
```
entradas:  costo de desarrollo y certificación (incl. costo del dinero) = $400,000,000
           margen de contribución por avión = $2,000,000
salida esperada:  break-even en el avión número 200; a partir de ahí $2M de utilidad real por avión
tolerancia: exacta
```

### FIXTURE raymer-18-npv ✅ [§18.7, p.707]
```
entradas:  V_n = $110 a recibir dentro de 1 año, r = 10%
salida esperada:  V_np = $100
fórmula: (18.15) V_np = V_n/(1+r)^n
tolerancia: exacta
```

### FIXTURE raymer-19-photoscale-drag ✅ [§19.3, p.717]
```
entradas:  W₀/W₀_as-drawn = 0.50 ; X = 0.35 (fracción de área mojada que NO photo-escala)
           C_D0 as-drawn = 0.0100 (100 counts)
fórmula: (19.14) C_D0' = (1−X)·C_D0 + X·C_D0/(W₀/W₀_asdrawn)^0.666
cálculo:  0.65·0.0100 + 0.35·0.0100/0.5^0.666 = 0.00650 + 0.00350/0.6300 = 0.00650 + 0.00556 = 0.01206
salida esperada del libro: "will increase to 120 counts" ⇒ 0.0120
tolerancia: 1 count (el libro redondea)
```

### FIXTURE raymer-19-photoscale-exponent ✅ [§19.3, p.717]
```
entradas: estudio de transporte futuro con el fuselaje que NO encoge
salida esperada: el exponente de la fracción de peso vacío pasa de −0.06 (Tabla 3.1, transporte típico)
                 a −0.31 al corregir el photo-scale
tolerancia: exacta (son los dos números que el libro imprime); el libro lo llama "a huge difference"
uso: test de que el motor de sizing NO cablea el −0.06.
```

### FIXTURE raymer-19-squarecube ✅ [§19.3, p.716]
```
entradas: TOGW a la mitad, W/S constante ⇒ S_w a la mitad ⇒ escala lineal √(1/2)
salida esperada: volumen interno = (1/2)^1.5 = 0.354 del original
tolerancia: exacta
```

### FIXTURE raymer-19-fig19.1-sizing-matrix ✅ [§19.4, Fig. 19.1, p.719]
Caza pequeño, matriz 3×3, motor rubber. **Requisitos:**
`P_s ≥ 0 a M0.9 / 30,000 ft {9144 m} / 5 g` · `s_TO ≤ 500 ft {152 m}` · `aceleración ≤ 50 s de M0.9 a M1.5`

| celda | W/S = 50 lb/ft² | W/S = 60 | W/S = 70 |
|---|---|---|---|
| **T/W = 1.1** | ①  W₀ 56,000 lb · P_s 700 fps · s_TO 340 ft · a 46 s | ②  49,000 · 330 · 430 · 42 | ③  46,000 · 30 · 660 · 39 |
| **T/W = 1.0** | ④  48,500 · 430 · 450 · 50.5 | ⑤ **baseline resized** 43,700 · 30 · 595 · 47 | ⑥  42,000 · −190 · 800 · 45 |
| **T/W = 0.9** | ⑦  44,000 · 140 · 670 · 56 | ⑧  39,000 · −230 · 810 · 53 | ⑨  36,000 · −320 · 1010 · 51 |

```
salida esperada del optimizador:
  - Diagnóstico del baseline ⑤: cumple todo MENOS distancia de despegue (595 > 500)
    ("the as-drawn baseline (number 5) exceeds the requirements except for takeoff distance")
  - Único punto factible de la matriz: ③  ("Number 3 exceeds all requirements but is very heavy")
  - Puntos ④⑦⑧⑨ = más ligeros pero deficientes en algún requisito
  - El óptimo NO es ninguna celda: está en el interior, "usually will be located where two
    constraint lines cross"
tolerancia: los valores de la matriz son EXACTOS (tipografiados). El óptimo interpolado depende
            del ajuste de curvas; no lo pongas como número esperado, pon el criterio.
por qué es EL fixture del optimizador: es el caso más chico que reproduce todo el algoritmo
            (matriz → crossplot → iso-W₀ → líneas de restricción → óptimo por inspección).
```

### FIXTURE raymer-24-acsize-relajacion ⭐✅ [§24.2, p.876, 877, 899 y §24.3, p.916]
**El hallazgo más útil del capítulo 24.** El programa `AC-SIZE` del autor imprime la sucesión completa de
sus iteraciones de punto fijo, y de ellas **se deduce su algoritmo exacto**:

```
entradas (DR-1, sizing con motor rubber, p.876):
   W0_drawn = 1200 lb ; We_drawn = 883 lb ; C = −0.1 (default)
   crew + payload = 220 lb
   fracciones de segmento de misión = 0.97 · 0.985 · 0.953 · 0.995

salida esperada — tabla de iteraciones (Wo_guess, Wfuel, Wempty, Wo_calculated):
   1200.0   119.6   883.0   1222.6
   1218.1   121.4   895.0   1236.3
   1232.7   122.8   904.6   1247.4
   1244.5   124.0   912.4   1256.4
   1254.0   125.0   918.7   1263.7
   1261.7   125.7   923.8   1269.5
   1268.0   126.4   927.9   1274.2
   1273.0   126.9   931.2   1278.0
   1277.0   127.3   933.9   1281.1
   1280.3   127.6   936.0   1283.6
   1282.9   127.8   937.7   1285.6
   1285.0   128.1   939.1   1287.2
   1286.8   128.2   940.2   1288.5
   1288.1   128.4   941.2   1289.5
   1289.2   128.5   941.9   1290.4      ← última iteración impresa
tolerancia: 0.1 lb (el programa imprime 1 decimal)
```

⭐ **[EXTENSIÓN DECLARADA — el algoritmo se deduce de la tabla; el libro NO lo enuncia]**
La regla de avance es **relajación con factor 0.8**:
```
   guess_(k+1) = guess_k + 0.8 · (calc_k − guess_k)
```
Verificación en tres puntos de esta tabla:
`1200 + 0.8·(1222.6−1200) = 1218.08 ≈ 1218.1 ✓` ·
`1218.1 + 0.8·(1236.3−1218.1) = 1232.66 ≈ 1232.7 ✓` ·
`1232.7 + 0.8·(1247.4−1232.7) = 1244.46 ≈ 1244.5 ✓`

Y se **confirma en otras dos corridas distintas del libro**:
- DR-1 fixed-engine (p.877): `1200 + 0.8·(1198.4−1200) = 1198.72 ≈ 1198.7 ✓`
- DR-3, caza rubber (p.916): `20000 + 0.8·(19418.7−20000) = 19534.96 ≈ 19534.9 ✓`

Esto **encarna literalmente** la instrucción de §19.2.1: *"A new assumed takeoff weight was selected
**somewhere between the two**, and the sizing process was iterated toward a solution."* — "somewhere
between the two" = 0.8 del camino.

**Criterio de paro** `[EXTENSIÓN DECLARADA — inferido, el libro no lo enuncia]`: las tres corridas se
detienen cuando `|calc − guess|` cae por debajo de ~**0.1% de W₀**:
DR-1 rubber: `1290.4 − 1289.2 = 1.2 lb` = 0.093% · DR-1 fijo: `1197.7 − 1196.7 = 1.0 lb` = 0.084%.
Motivo de declararlo: el criterio real puede ser 0.1% o un número fijo de iteraciones; **implementa 0.1%
como default configurable** y verifica contra estas tres tablas.

### FIXTURE raymer-24-dr1-fixed-engine ✅ [§24.2, p.877]
```
entradas: MISMO avión, pero motor de TAMAÑO FIJO
   W0_drawn = 1200 lb ; We_drawn = 883 lb ; C = −0.1 ; crew+payload = 220 lb
   fracción de segmento de misión = 0.925   (una sola, ajustada)
salida esperada:
   1200.0   95.4   883.0   1198.4
   1198.7   95.3   882.2   1197.5
   1197.7   95.2   881.5   1196.7
   ⇒ converge en 3 iteraciones (contra 15 del caso rubber)
   Y el resultado del despeje inverso: con Wf/W0 fijo, el ALCANCE que sale es R ≈ 1583 n mi
   [OCR DUDOSO: se lee "R = 9.5?300 ?" y "R = 1583 n.mi." en manuscrito]
por qué importa: prueba la bifurcación S-03. Con motor fijo el lazo NO escala el empuje;
   converge muchísimo más rápido porque desaparece la realimentación T/W→peso.
lección literal del autor sobre el caso rubber, escrita a mano al pie de la tabla anterior:
   "BUT THIS HEAVIER W₀ WOULD GIVE REDUCED PERFORMANCE WITH A FIXED-SIZE ENGINE!"
```

### FIXTURE raymer-24-dr1-matriz-WS-A ⭐⚠️ [§24.2, p.897–904]
**La optimización multivariable HECHA A MANO.** Es el mejor fixture pedagógico del libro entero.

```
avión: DR-1, homebuilt acrobático monoplaza, motor Lycoming O-320-A2B FIJO
       (160 hp a 2700 rpm, C_bhp ≈ 0.5, 272 lb seco)
baseline as-drawn: W/S = 10.2 lb/ft² ; A = 6 ; W₀ = 1200 lb

variables barridas (nota: NO son T/W y W/S — con motor fijo NO HAY T/W que optimizar):
   W/S ± 20%  →  8.16 · 10.2 · 12.24  lb/ft²
   A   ± 33%  →  4 · 6 · 8
   ⇒ 9 aviones distintos

MATRIZ DE SIZING — W₀ dimensionado a la misión (lb):
              W/S=8.16   W/S=10.2   W/S=12.24
      A = 4     1275①      1117②      1030③
      A = 6     1420④    [1200]⑤      1085⑥      ← ⑤ es el as-drawn baseline
      A = 8     1536⑦      ????⑧      1153⑨
   [OCR DUDOSO: la celda ⑧ (A=8, W/S=10.2) se lee "1 2.?" — podría ser 1265 o 1290. NO la teclees.]
tolerancia: ±5 lb (manuscrito, valores redondeados a la decena)
```

**Las restricciones cruzadas sobre esa malla (§24.2, p.901–904):**

| Restricción | Valor requerido | Cómo la calculó |
|---|---|---|
| **Velocidad de pérdida** | `V_stall ≤ 55 kts` sin flaps | Fija W/S directamente |
| **Régimen de ascenso** | `V_v ≥ 1500 ft/min` a nivel del mar | Supone `V = 75 kts` (mejor R.O.C. del baseline) y `T = 360 lb` |
| **Velocidad máxima** | `V_max ≥ 130 kts` a 8,000 ft | *"QUICK METHOD: CALCULATE DRAG AT 130 kts, USE TO SHIFT PREVIOUS DRAG CURVE UP OR DOWN, THEN FIND INTERSECTION WITH THRUST CURVE."* |
| ⭐ **Viraje sostenido** | `n ≥ 2.92` a 100 kts, nivel del mar | **RESTRICCIÓN INVENTADA A MITAD DEL ESTUDIO** — ver §4 |

Verificación de la restricción de viraje `[EXTENSIÓN DECLARADA — la aritmética es mía, los datos son del libro]`:
```
   ω = 30 deg/s = 0.5236 rad/s ; V = 100 kt = 168.9 ft/s ; g = 32.174 ft/s²
   n = √( (ω·V/g)² + 1 ) = √( 2.749² + 1 ) = 2.926
   el libro escribe a mano "so n ≈ 2.92"  ✓
   tolerancia: 0.01
```

**RESULTADO — el óptimo leído a ojo sobre la gráfica con restricciones (p.904):**
```
   W/S óptimo = 10.23 lb/ft²
   A   óptimo = 5.2
   W₀  óptimo = 1180 lb
   texto literal: "SO THE OPTIMAL AIRCRAFT FOR THE GIVEN REQUIREMENTS OCCURS AT [W/S = 10.23]
                   AND [A = 5.2] AND HAS W₀ = 1180 LB. THE NEXT STEP IN THE DESIGN PROCESS IS
                   TO REDRAW THE AIRCRAFT AND ANALYZE IT IN DETAIL."
tolerancia: W/S ±0.1 · A ±0.2 · W₀ ±10 lb
```

⭐ **El comentario del autor sobre por qué el resultado parece raro (§24.1, p.868), literal:**
> *"One interesting result of the sizing and optimization presented next is that the wing loading required
> for the desired no-flaps stall speed has strongly biased the aspect-ratio optimization, leading to a
> lower-than-expected optimal aspect ratio. This looks odd until one notes that the total wing span is quite
> normal after optimization—**it is the chord length that is excessive**, to provide enough wing area."*
> ⇒ **Requisito de UX:** el optimizador debe mostrar la **envergadura** además del alargamiento, o el
> ingeniero desconfía de un resultado correcto.

### FIXTURE raymer-24-dr3-requisitos ✅ [§24.3, p.906]
```
DR-3 "Lightweight Supercruise Fighter" — reemplazo de F-16, énfasis aire-aire, monoplaza,
UN motor avanzado "rubber" (post-2000, aprox. el A/B del Apéndice E.1 con 20% menos de SFC)

MISIÓN (7 tramos): warmup/takeoff/accel → CRUISE 200 n mi → DASH 50 n mi a M1.4 y 35,000 ft
   → 3 min de combate a máximo empuje a M0.9 y 20,000 ft → weapon release 400 lb (misiles solamente)
   → dash de vuelta → cruise de vuelta 200 n mi → LOITER 20 min a nivel del mar → aterrizaje
   [supercruise: 200 n mi + 50 n mi de dash, ver la traza tipografiada de sizing más abajo]

PAYLOAD: 2 misiles avanzados (200 lb, 5 in × 92 in) · 1 cañón avanzado con 750 cartuchos (440 lb)
         · piloto (220 lb)

REQUISITOS DE DESEMPEÑO:
   • despegue y aterrizaje  < 1000 ft de rodaje en tierra
   • velocidad de aproximación ≤ 130 kts
   • Mach ≤ 1.8 con postcombustión ; ≥ M1.4 en seco  (supercrucero)
   • máxima ... M0.9 → M1.4 en 30 s a 35,000 ft            ← EL REQUISITO QUE NO SE CUMPLE
   • P_s = 0 a 5 g / 30,000 ft / M0.9  y  ... M1.4
   • n ≥ 2.0 [OCR DUDOSO: "≥ 2.0 g"] a 350 kts a 20,000 ft
tolerancia: los requisitos son texto manuscrito parcialmente legible; los que aquí están
            se confirman contra la tabla tipografiada de resultados del carpet plot.
```

### FIXTURE raymer-24-dr3-mission-fractions ✅ [§24.3, p.947–948]
```
Traza completa del sizing del DR-3 (salida tipografiada de RDS, p.948):

  #  segmento                          fracción / peso soltado    Wi/W0
  1  TAKEOFF SEGMENT                        0.9584               0.9584
  2  CLIMB and/or ACCELERATE                0.9736               0.9331
  3  CRUISE SEGMENT                         0.9721               0.9071
  4  CLIMB and/or ACCELERATE                0.9950               0.9025
  5  CRUISE SEGMENT                         0.9813               0.8856
  6  KNOWN TIME FUEL BURN SEGMENT           0.9339               0.8271
  7  WEIGHT DROP SEGMENT                  400.0000 lb            0.8036
  8  CLIMB and/or ACCELERATE                0.9800               0.7875
  9  CRUISE SEGMENT                         0.9817               0.7731
 10  CLIMB and/or ACCELERATE                1.0000               0.7731
 11  CRUISE SEGMENT                         0.9716               0.7511
 12  DESCENT SEGMENT                        0.9900               0.7436
 13  LOITER SEGMENT                         0.9692               0.7207
 14  LANDING SEGMENT                        0.9950               0.7171

RESERVE & TRAPPED FUEL ALLOWANCE = 1.060

resultados (fps):  TOTAL RANGE = 500.0 n mi · TOTAL LOITER TIME = 0.33 hr
                   FUEL WEIGHT = 4693.0 lb · EMPTY WEIGHT = 11258.2 lb
                   LOAD (less Wf) = 1110.0 lb · AIRCRAFT GROSS WEIGHT = 17061.2 lb
resultados (mks):  926.0 km · 0.33 hr · 2128.7 kg · 5106.6 kg · 503.5 kg · 7738.8 kg

tramos con detalle:  seg 3 y 11 CRUISE 487.2 kt (M0.85) a 45,000 ft, 200 n mi c/u
                     seg 5 y 9  CRUISE 806.4 kt a 35,000 ft, 50 n mi c/u
                     seg 13     LOITER 191.6 kt (M0.29) a 200 ft, 0.3 hr

⭐ TESTS DERIVADOS QUE VALIDAN LA IMPLEMENTACIÓN DEL LAZO:
  (a) el producto acumulado: Π(fracciones) con el drop de 400 lb aplicado como resta
      debe reproducir la columna Wi/W0 hasta 0.7171 ✓  [verificado renglón a renglón]
  (b) el tramo 10 tiene fracción EXACTAMENTE 1.0000 → un tramo de "aceleración" sin gasto:
      el motor no está encendido o la fracción cae fuera de resolución. El software debe
      permitir 1.0000 sin disparar el error de S-02 (que aplica a > 1.0, no a = 1.0).
  (c) TODAS las fracciones están en [0.9, 1.0] ⇒ el gate S-02 pasa. Úsalo como test del gate.
  (d) Wf/W0 = 4693.0/17061.2 = 0.2751 ; y (1 − 0.7171)·1.06 = 0.2999 ≠ 0.2751 porque el
      peso soltado de 400 lb NO es combustible. El test verifica que el motor separa
      combustible de payload soltado. ← este es el bug clásico de implementación.
tolerancia: 0.0001 en fracciones, 0.1 lb en pesos.
```

### FIXTURE raymer-24-dr3-asdrawn-vs-sized ✅ [§24.3, p.931 y p.943]
```
peso vacío as-drawn calculado con las ecuaciones de caza del cap 15
   + ajustes de compuestos de la Tabla 15.4:
   entradas: W₀ = Wdg = 16,480 lb {7475.2 kg} ; Nz ultimate = 7.33 × 1.5 = 11 ;
             Sw = 294 ft² {27.313 m²} ; M_design_max = 1.8 ; 1 motor
             cola en V analizada con la ECUACIÓN DE COLA HORIZONTAL, área real 90 ft² {8.4 m²},
             A equivalente = 6.5
             penalización de 200 lb {90.7 kg} por el mecanismo de diedro variable → misc empty
             400 lb {181.4 kg} extra por la tobera vectorial 2-D → misc empty
             400 lb {181.4 kg} del cañón → misc empty
             tren: peso de aterrizaje = peso de despegue de diseño, factor de carga de tren = 4
             shroud de motor 14 ft {4.3 m} · longitud de control de motor 18.3 ft {5.6 m}
             aviónica instalada 990 lb {449 kg} (Tabla 11.6) ⇒ desinstalada 727 lb {330 kg} vía ec. (15.21)
   salida esperada: We = 10,947.2 lb {4965.6 kg}
   contraste declarado: "somewhat above the preliminary prediction of 10,788 lb {4893 kg}
                         used for initial sizing"  ⇒ error del método estadístico = +1.5%

sizing refinado a la misión:
   as-drawn W₀ = 16,480 lb {7475 kg}  →  resized W₀ = 17,062 lb {7739 kg}   (+3.5%)
   comentario del autor: "This is closer than one would usually hope for, and probably reflects
                          luck more than skill!"
   ⇒ GATE S-05 (30%) pasa holgadamente. Úsalo como caso NEGATIVO del gate.
tolerancia: 1 lb
```

### FIXTURE raymer-24-dr3-carpet-25 ⭐✅ [§24.3, p.956]
**El mejor fixture de optimizador que existe en el libro.** Matriz **5×5** completa, tipografiada.

```
baseline as-drawn:  T/W = 0.98 ; W/S = 56 lb/ft² {273.1 kg/m²}
variaciones: ±10% y ±20% sobre ambos  ⇒ 25 aviones completos

SUPUESTOS DE ESCALADO DECLARADOS (esto es la especificación del "generador de variantes"):
  Para T/W:
    • el empuje del motor varía DIRECTAMENTE con T/W
    • el peso desinstalado del motor varía con la potencia 1.1 del cambio relativo de empuje [ec. 10.3]
    • el efecto aerodinámico (sobre todo área mojada de góndola) se supone proporcional
      al área de la trayectoria de flujo del motor y por tanto proporcional a T/W
  Para W/S:
    • el área alar varía INVERSAMENTE con la carga alar
    • el área de cola varía con la potencia 3/2 del cambio relativo de área alar, para
      MANTENER CONSTANTE EL VOLUMEN DE COLA [ecs. 6.28 y 6.29]
    • el arrastre de onda se corrige cambiando A_max proporcionalmente al cambio de área alar,
      ponderado por el porcentaje del ala en el área transversal total del baseline

RESULTADOS DE SIZING (W/S lb/ft², T/W, W₀ lb, We lb, Wf lb):
   1  44.843  0.7840  15470.  10308.  4051.4
   2  50.449  0.7840  14303.   9516.1 3676.8
   3  56.054  0.7840  13478.   8952.9 3415.3
   4  61.659  0.7840  12928.   8564.6 3253.8
   5  67.265  0.7840  12532.   8278.2 3144.0
   6  44.843  0.8820  17381.  11557.  4713.9
   7  50.449  0.8820  16030.  10641.  4279.0
   8  56.054  0.8820  15068.   9985.8 3972.5
   9  61.659  0.8820  14423.   9533.3 3779.5
  10  67.265  0.8820  13960.   9201.0 3649.5
  11  44.843  0.9800  19811.  13115.  5586.2
  12  50.449  0.9800  18200.  12029.  5061.1
  13  56.054  0.9800  17060.  11257.  4692.7      ← baseline (coincide con el sizing de p.943 ✓)
  14  61.659  0.9800  16272.  10712.  4450.3
  15  67.265  0.9800  15716.  10316.  4289.7
  16  44.843  1.0780  22901.  15065.  6725.9
  17  50.449  1.0780  20928.  13748.  6070.4
  18  56.054  1.0780  19528.  12809.  5608.8
  19  61.659  1.0780  18561.  12149.  5301.6
  20  67.265  1.0780  17884.  11674.  5099.6
  21  44.843  1.1760  26811.  17496.  8204.8
  22  50.449  1.1760  24363.  15881.  7372.3
  23  56.054  1.1760  22636.  14736.  6789.1
  24  61.659  1.1760  21414.  13917.  6387.5
  25  67.265  1.1760  20573.  13335.  6127.4

RESULTADOS DE DESEMPEÑO (Takeoff ft, Landing ft, Ps@n=5 (a), Ps@n=5 (b), Ps@n=1 (a), Ps@n=1 (b), Accel s):
   1   712.36   887.21   69.818   −55.65   219.61  −112.1   70.633
   2   789.13   986.63   11.604   −66.96   277.23   −82.76  66.849
   3   865.12  1085.4   −51.97    −83.90   322.24   −59.97  64.226
   4   940.42  1183.6  −121.4    −104.6    358.25   −41.85  62.341
   5  1015.1   1281.3  −191.4    −128.0    387.64   −27.17  60.927
   6   648.88   846.98  127.89     64.593  400.80   −46.39  54.792
   7   717.89   941.41   69.679    53.278  458.42   −17.05  52.530
   8   786.14  1035.2     6.0952   36.346  503.43     5.7424 50.923
   9   853.73  1128.4   −63.32     15.608  539.44    23.865  49.749
  10   920.73  1221.2  −133.3      −7.770  568.83    38.547  48.858
  11   598.61   811.06  185.96    184.84   581.99    19.319  44.825
  12   661.48   901.02  127.75    173.52   639.61    48.667  43.319
  13   723.61   990.36   64.169   156.59   684.62    71.460  42.231   ← baseline
  14   785.09  1079.1    −5.252   135.85   720.63    89.583  41.429
  15   846.01  1167.4   −75.30    112.47   750.02   104.26   40.815
  16   557.82   778.78  244.04    305.08   763.18    85.038  37.956
  17   615.70   864.73  185.82    293.77   820.80   114.38   36.879
  18   672.87   950.06  122.24    276.84   865.81   137.17   36.094
  19   729.40  1034.8    52.822   256.10   901.82   155.30   35.510
  20   785.38  1119.1   −17.23    232.72   931.21   169.98   35.061
  21   524.05   749.61  302.11    425.33   944.37   150.75   32.927
  22   577.81   831.94  243.90    414.02  1002.0    180.10   32.118
  23   630.87   913.64  180.31    397.09  1047.0    202.89   31.524
  24   683.31   994.82  110.89    376.35  1083.0    221.01   31.080
  25   735.20  1075.5    40.843   352.97  1112.4    235.70   30.737

VALORES REQUERIDOS (la fila de restricciones):
      1000.0   1000.0   0.0000   0.0000   0.0000   0.0000   50.000
      (Takeoff ≤ 1000 · Landing ≤ 1000 · los cuatro Ps ≥ 0 · Accel ≤ 50 s)

tolerancia: exacta a los dígitos impresos.
```

⭐ **SALIDAS ESPERADAS DEL OPTIMIZADOR SOBRE ESTE FIXTURE (§24.3, p.955), literal:**
```
(a) el óptimo que cumple TODO está en el cruce de "2-Landing" y "7-Acceleration (30 s)":
        W₀ = 19,300 lb ; T/W = 1.1 ; W/S = 59 {288}
        [OCR/ERRATA: el libro imprime "{4218 kg}" junto a 19,300 lb. 19,300 lb = 8754 kg.
         El valor métrico es INCONSISTENTE. No lo uses.]
    "This weight is 17% greater than the as-drawn DR-3 weight, but remember that the baseline
     could not meet the acceleration requirement."
    verificación: 16,480 × 1.17 = 19,282 ≈ 19,300 ✓ (el 17% se refiere al AS-DRAWN, no al resized)

(b) relajando la aceleración de 30 s a 50 s (cruce "2-Landing" con "8-Acceleration (50 s)"):
        W₀ = 15,600 lb {7070 kg} ; T/W = 0.9 ; W/S = 54 {264}
    "This is a 19% reduction in sized takeoff gross weight from the aircraft that can meet the
     acceleration requirement. This will produce a considerable cost savings for the relaxation
     of that one requirement."
    verificación: (19300 − 15600)/19300 = 19.2% ✓ · 15,600 lb = 7076 kg ≈ 7070 ✓

⇒ ESTE ES EL TEST DE "REQUIREMENTS TRADE": UN requisito relajado = 19% de peso.
   Es el argumento comercial entero del módulo, con número.
```

### FIXTURE raymer-24-dr3-mvo ⭐✅ [§24.3, p.957]
**El mejor test de un optimizador restringido que existe: no basta con dar peso bajo, hay que dar
peso bajo con las restricciones CORRECTAS activas.**

```
DR-3 MULTIVARIABLE OPTIMIZATION — MEASURE OF MERIT: W₀
                       BASELINE      BEST
   T/W                    0.980     0.919
   W/S                     56.1      52.6
   ASPECT RATIO           3.500     2.800
   SWEEP                   38.0      34.7
   TAPER RATIO            0.250     0.200
   WING t/c               0.060     0.068
   Sized W₀            17060.2   15242.2
   Sized We            11257.5    9925.5
   Sized Wf             4692.7    4206.7

                       REQUIRED  BASELINE     BEST
   Takeoff               1000.0     723.6     720.0
   Landing               1000.0     990.4     960.4
   Ps @ n=5                 0.0      64.2       1.7    ← RESTRICCIÓN ACTIVA
   Ps @ n=5                 0.0     156.6      62.0
   Ps @ n=1                 0.0     684.6     515.7
   Ps @ n=1                 0.0      71.5       0.1    ← RESTRICCIÓN ACTIVA
   Accel                   50.0      42.2      49.4    ← RESTRICCIÓN ACTIVA

CRITERIO DE ACEPTACIÓN DEL TEST (el que de verdad importa):
   1. W₀ óptimo = 15,242 lb {6914 kg} ± 1%
   2. NINGUNA restricción violada
   3. EXACTAMENTE TRES restricciones activas (rozando su límite): Ps@n=5 (1.7), Ps@n=1 (0.1)
      y Accel (49.4 de 50.0)
   Un optimizador que da 15,242 lb con las restricciones EQUIVOCADAS activas está MAL,
   aunque el número coincida. Kuhn–Tucker en forma de test unitario.

CONTEXTO literal del autor (p.955):
   "Just for fun, the RDS-Professional Multivariable Optimizer was run to determine what additional
    weight savings could be obtained by optimizing for sweep, aspect ratio, taper ratio, and thickness
    as well as T/W and W/S. This produced an optimized weight of 15,242 lb {6914 kg}, 2% less than the
    optimum found with a T/W–W/S carpet plot. This indicates that the wing planform chosen for the DR-3
    using the methods of this book was fairly close to optimal already. However, this further 2% weight
    savings is obtained for free, resulting just from slight changes to the wing geometry."
   verificación del "2%": 15,600 vs 15,242 ⇒ 2.3% ✓ (el 2% es contra el carpet plot RELAJADO de 15,600)
```

### FIXTURE raymer-24-dr3-takeoff-landing ✅ [§24.3, p.950]
```
TAKEOFF: DR3       Wi = 16480.0 lb {7475.2 kg} · Wi/W0 = 1.000 · T/W = 0.980
   Thrust (inicio de despegue) = 16150.4 lb {71.8 kN} · W/S = 56.05 {273.68}
   V_stall = 99.80 kt {184.8 km/h} · V_takeoff = 109.8 kt {203.3 km/h}
   climb angle 44.97 deg · climb CDO 0.0289 · CL 1.49 · K 0.2609 · climb L/D 3.07
   ground roll 538.2 {164.0} · rotate 185.4 {56.5} · TOTAL GROUND ROLL 723.6 {220.6}
   transition 761.6 {232.1} · climb 0.0 {0.0} · TOTAL TAKEOFF 1485.2 {452.7}
   FAR PART 25 TAKEOFF DISTANCE 1707.9 {520.6}
   ⇒ verificación cruzada: 723.6 ft coincide EXACTAMENTE con la variante 13 de la tabla
      de desempeño del carpet plot ✓ (columna "Takeoff" = rodaje en tierra, NO distancia total)
      ← ESTE ES EL TEST DE QUE NO CONFUNDES LAS SEIS DEFINICIONES DE "DISTANCIA DE DESPEGUE".

LANDING: DR3       Wi = 16480.0 lb · rollout T/W = −0.392 · W/S = 56.05
   V_stall = 95.84 kt {177.5 km/h} · V_touchdown = 115.01 kt {213.0 km/h}
   approach angle −3.00 deg · approach CDO 0.1124 · CL 1.62 · K 0.2724 · approach L/D 2.53
   approach 773.5 {235.8} · flare 2733.1 {833.1} · free ground roll 194.2 {59.2}
   braking 796.1 {242.7} · TOTAL GROUND ROLL 990.4 {301.9}
   no-flare landing 1944.5 {592.7} · TOTAL LANDING 4497.0 {1370.7}
   FAR PART 25 LANDING 7495.0 {2284.5}
   ⇒ 990.4 ft coincide con la variante 13 ✓ y es el que roza el requisito de 1000 ft
      (por eso "2-Landing" es una de las dos restricciones que fijan el óptimo)
tolerancia: 0.1 ft
```

### FIXTURE raymer-24-dr3-ps-turn ✅ [§24.3, p.951]
```
Ps, TURN & CLIMB : DR3    M = 0.90 · ALT = 30,000 ft {9144 m}
   Wi/W0 = 0.872 · Wi = 14370.6 lb · W/S = 48.88 {238.65} · T/W = 0.649
   Thrust = 9322.7 lb {41.5 kN} · Turn Radius = 3426 ft {1044 m}

   n=1 : CDO 0.0161 · K 0.1411 · CL 0.14 · Ps = +458.34 {139.7}
         Rate of Climb = 27,500 fpm {8382 mpm} · Climb Gradient = 0.51
   n=2 : CDO 0.0161 · K 0.1138 · CL 0.27 · Ps = +419.78 {127.9} · turn rate 3.57 deg/s
   n=3 : CDO 0.0161 · K 0.1022 · CL 0.41 · Ps = +362.72 {110.6} · turn rate 5.83 deg/s
   n=4 : CDO 0.0161 · K 0.1103 · CL 0.55 · Ps = +258.88 {78.91} · turn rate 7.98 deg/s
   n=5 : CDO 0.0161 · K 0.1340 · CL 0.69 · Ps = +64.17  {19.56} · turn rate 10.10 deg/s

⭐ K NO ES CONSTANTE y no es monótono: baja de 0.1411 (n=1) a 0.1022 (n=3) y vuelve a subir
   a 0.1340 (n=5). Ese mínimo interior es la firma del modelo de arrastre inducido con succión
   de borde de ataque parcial del cap 12. Un motor que use K constante FALLA este fixture.
   ← el mejor test de que no cableaste K = 1/(π·A·e).
nota: performance calculada a peso de combate = 0.89 × W₀ ("the weight at the end of cruise").
      Aquí Wi/W0 = 0.872, no 0.89: el 0.89 es el supuesto de diseño y 0.872 el valor real
      del tramo. El software debe permitir ambos.
tolerancia: 0.01 en coeficientes, 0.1 en Ps.
```

### FIXTURE raymer-24-dr3-initial-TW-WS ⚠️ [§24.3, p.910–912]
```
Selección inicial de W/S por el MÍNIMO de todas las restricciones (manuscrito, parcialmente legible):
   • stall / aproximación:  V_approach ≤ 130 kt = 220 ft/s ; V_stall = 220/1.3 = 169 ft/s a nivel del mar
        ⇒ W/S ≈ 225 lb/ft²  ← ridículamente alto, el autor lo anota como "MUCH TOO ... FIGHTER!"
          y decide manejarlo con reversa de empuje en vez de con el ala
   • despegue:  ec. (5.x) W/S = TOP·σ·C_L·(T/W) ≈ 80·(?)·(?) = 104
   • crucero óptimo: (W/S)_opt = 289·(?)^0.5 ... ≈ 89.6
   • viraje sostenido de combate: (W/S)_combat ≈ 44  →  (W/S)_takeoff ≈ 52
   [OCR DUDOSO: todos los números intermedios de esta página son manuscritos y ambiguos.
    Solo el RESULTADO se confirma tipografiado más adelante: W/S as-drawn = 56.05 lb/ft²,
    T/W as-drawn = 0.98.]
⇒ el fixture utilizable es el par (W/S, T/W) = (56.05, 0.98) as-drawn, no la derivación.
   Y la LECCIÓN es utilizable aunque los números no: el MÍNIMO crudo (44) NO se tomó;
   el diseñador subió a 56 por juicio. Ver §4.
```

### FIXTURE raymer-24-dr3-geometry ✅ [§24.3, p.917 y p.932]
```
Layout data del DR-3 (mezcla tipografiada/manuscrita, valores confirmados en las entradas de pesos):
   Sw = 16480/56 = 294 ft² {27.313 m²}   ← "S = W0/(W/S)" verificado ✓
   A = 3.5 · λ = 0.25 · Λ_LE = 30°  [OCR DUDOSO: se lee "Λc/4 = 30°" o "Λ = 30°"]
   b = 32.08 ft = 384.98 in  [OCR DUDOSO: "13S'!.2"ft-1 32 4 �8't in"]
   c_root = 14.7 ft
   Nz ultimate = 11 (= 7.33 × 1.5) · M_design_max = 1.8 · 1 motor
   cola en V: área real 90 ft² {8.4 m²}, A equivalente 6.5
   perfil: 64A004 inicialmente ; t/c = 0.06
   flujo másico a M1.8 y 30,000 ft: ṁ = 270 lb/s ... A_c = 3.8 × 145.3 = 552 in²
   [OCR DUDOSO: la aritmética de la toma no se lee limpia]
tolerancia: las cifras confirmadas en la tabla de entradas de pesos (Sw, Nz, M, motores) son exactas.
```

### Fixtures que el libro NO da (declarado, importante)

| Lo que buscamos | Estado |
|---|---|
| **Un ejemplo numérico resuelto de DAPCA** | ❌ **NO EXISTE EN EL LIBRO.** El cap 18 no resuelve ninguno, y el cap 24 **no hace análisis de costo del DR-1 ni del DR-3** (el texto solo menciona que "cost... analysis were rerun" dentro de RDS, sin imprimir cifras). La única cifra de costo del cap 24 es cualitativa: *"This will produce a considerable cost savings."* ⇒ **DAPCA se implementa contra su propia validación interna (500^0.163 ≈ 3) y contra la banda de $/lb, no contra un ejemplo resuelto.** |
| **Un ejemplo numérico de las ecs. 20.6–20.11 (eléctrico)** | ❌ **CERO ejemplos resueltos** en §20.10 y §20.11. Solo las ecuaciones |
| **Un ejemplo numérico de la ec. del cohete (22.13)** | ❌ Ninguno resuelto. El ejercicio 21.2 se lo deja al estudiante: *"Size a rocket to put yourself into orbit, using reasonable or unreasonable assumptions."* |
| **Los trade studies de rango y SFC del DR-3** | ❌ Son **dos gráficas** (p.949): "Trade Study: RANGE (nmi): DR3.DAT" con baseline range = 500, y "Trade Study: C (% change)". **Los ejes están rotulados pero las curvas son imagen.** Solo se lee la escala vertical (10,000–20,000 lb) y la horizontal (300–700 n mi) |
| **DAPCA para el DR-3** | Es el **ejercicio 18.3** del libro, no un ejemplo resuelto: *"Estimate the development and procurement cost of the DR-3 design example... assuming a) traditional aluminum construction and b) substantial use of composites."* ⇒ es una **lección**, no un fixture |

---

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero

Esta sección es el contrato de UX del optimizador. Cada renglón dice **dónde el software propone y el
ingeniero decide**.

### 4.1 Las tres objeciones del cliente a la optimización automática (§19.6, p.727)

**Postura general, literal:**
> *"Such 'everything optimization' is neither feasible nor desirable. After a certain point, excessive time
> spent on defining, executing, and understanding an optimization method or computer program is just
> **time taken away from other pressing design tasks**."*

**Objeción 1 — la misión de diseño es una ficción:**
> *"All optimization methods must revolve around one or more measures of merit, which implies that we know
> exactly how the aircraft will be operated. **In the history of aviation, there has probably never been a
> case of an aircraft flying its 'design mission'**, that is, the exact same mission that was used for sizing
> and optimization during its conceptual design. Even if a pilot looked up the original design mission and
> tried to duplicate it in flight, it could not be done unless the pilot could find a perfect standard day
> and happened to have a perfect, nominal engine and an aircraft whose design was not changed or compromised
> during development.
> Even more important, most aircraft are converted to missions that were never anticipated during their
> design. The F-4, one of the most successful fighters of all time, was designed for a supersonic,
> deck-launched interception mission totally unrelated to its widespread use as a multirole fighter-bomber.
> The F-16, in use around the world, was conceived, sized, and optimized as a lightweight dogfighter with
> the designers' battle cry '**not a pound for air-to-ground**.' It is now the U.S. Air Force's main
> ground-attack fighter (but is still a potent air-to-air machine)."*

**Objeción 2 — la computadora no sabe si cabe:**
> *"Another problem is that aircraft optimization is, by definition, making changes to the shape of the
> aircraft. After wading through almost 800 pages of aircraft design methods emphasizing the actual
> conceptual layout, the reader should now scream, '**but how does the computer know if the landing gear
> fits, and the radar fits, and the passengers fit, and the fuel tanks are big enough, and the overnose
> vision angle is still correct**, and....'
> Of course, each of these and many more could be programmed into the optimizer, but the time to develop
> all the inputs for such an optimization model must be considered against the time constraints of
> conceptual design."*

**Objeción 3 — el problema humano (la más peligrosa para nosotros):**
> *"There is another, very human problem to consider. **Once a time-consuming optimization model is developed
> for a certain design approach, there will be an understandable reluctance to look at totally different
> design approaches that are not represented by the model.** If a certain trade study would be very difficult
> to model and optimize with the tools in use, it is easy to convince oneself that it 'probably won't work
> anyway.' **This could serve as a dampener on the essence of aircraft conceptual design.**"*

**La postura de equilibrio, que ES el pliego de UX:**
> *"However, if we are careful to use optimization in a balanced fashion, **with experienced designers always
> 'in the loop,'** it can be a very powerful tool for improving our design. In this author's opinion, it is
> best used **when based on analysis of a realistic and complete aircraft conceptual design layout** and when
> its goal is to **quickly tell the aircraft designer how to change the design layout to make it better** and
> is used in the next design iteration **as only one of many 'inputs.'**"*

### 4.2 El acto humano supremo: INVENTAR UNA RESTRICCIÓN (§24.2, p.903)

⭐⭐ **Este es el hallazgo más importante del bloque para la especificación del producto.**

En la optimización a mano del DR-1, después de cruzar las tres restricciones sobre la malla `W/S × A`,
el autor descubre que **el problema queda sin cota inferior en el alargamiento** — el optimizador se iría a
`A → 0`. Su respuesta escrita a mano no es tocar el algoritmo: **es escribir un requisito nuevo.**

> *"CROSSPLOTTING THE STALL, RATE-OF-CLIMB, AND V_max REQUIREMENTS ONTO THE SIZING GRAPH [ASPECT RATIO /
> WING LOADING]: AT VERY LOW ASPECT RATIOS, THE [análisis] GIVES NO LOWER LIMIT ON [aspect ratio, pero el]
> INDUCED DRAG WOULD BECOME EXCESSIVE DURING MANEUVERS. **THEREFORE, WE NEED SOME REQUIREMENT BASED ON
> MANEUVERING. DEFINE A NEW PERFORMANCE REQUIREMENT BASED ON SUSTAINED TURN: ω ≥ 30 deg/sec SUSTAINED,
> AT 100 kts, S.L.**"*
> `[transcripción parcial: el manuscrito está roto en las palabras entre corchetes]`

**Qué significa para el software:**
1. Un optimizador que sale disparado a una frontera **no está mal: está diciendo que falta un requisito.**
   Es información, no un bug.
2. El producto debe **detectar y reportar "óptimo no acotado en la variable X"** en vez de devolver el
   extremo del rango en silencio.
3. **El ingeniero, no el software, decide cuál es el requisito que falta.** El software puede sugerir la
   familia (aquí: maniobra), pero el número (30 deg/s, 100 kt, nivel del mar) lo pone la persona.
4. Y cuando lo pone, la restricción entra al mismo motor que las demás. **El conjunto de restricciones es
   editable en vivo, a mitad de un estudio.**

### 4.3 El catálogo completo de juicios humanos del bloque

| # | § | El juicio | La cita |
|---|---|---|---|
| J-01 | §19.4 | **Leer el óptimo** | *"The optimum combination of T/W and W/S is **found by inspection**"* — el algoritmo propone el cruce; el ingeniero mira la gráfica |
| J-02 | §19.3 | **"Substantially different"** | *"'Substantially different' is a matter of opinion, but this author gets nervous at a takeoff-weight difference greater than about 30%"* — el umbral es opinión, no ley. **Configurable, con 30% de default y la frase del autor a la vista** |
| J-03 | §19.5 | **El realism factor** | *"There is an unfortunate tendency to minimize redesign effort, especially for yet another boring trade study!"* + *"If there were sufficient room in the baseline to fit two more missiles internally, then the baseline was poorly designed. If the baseline was already 'tight,' then the revised layout must be a fake!"* — **el software puede MEDIR la densidad, pero es el humano el que decide si el rediseño es honesto** |
| J-04 | §19.6 | **Cuántas variables optimizar** | *"After a certain point, excessive time spent... is just time taken away from other pressing design tasks"* — nadie puede decidir por el ingeniero dónde parar |
| J-05 | §19.7 | **Si el peso sirve de proxy del costo** | *"if you are doing trade studies of alternative technologies, engines, avionics, manufacturing methods, or similar items, then weight is a poor approximation to cost"* — el software puede avisar; elegir la measure of merit es del humano |
| J-06 | §18.3 | **Los fudge factors** | *"variable constants that you multiply your answer by to get the right answer"* — y *"all such adjustment factors are highly debatable"*. **Nunca cablearlos** |
| J-07 | §18.4 | **El ÷4 de aviación general** | *"That is hard to believe, but perhaps is acceptable for relative trade studies"* — el propio autor no se lo cree del todo. Debe salir con esa advertencia pegada |
| J-08 | §18.5 | **El costo de tripulación** | *"These equations must be viewed as rough approximations only"* + el factor 5× entre aerolíneas |
| J-09 | §18.7 | **El discount factor del NPV** | *"Selection of the appropriate discount factor is critical to the NPV calculation"* — no hay valor por defecto correcto |
| J-10 | §5.4 | **No creerle a la pre-optimización** | *"Push to a Dash-One layout as quickly as possible, then optimize from its geometry... **don't believe it until you've redone the optimization using parameters taken from the real design layout.**"* Y sobre los valores iniciales: *"The initial values are just to get the design started and are **never used again**"* |
| J-11 | §5.4 | **Cuándo IGNORAR una restricción** | *"keep in mind that the optimal wing loadings calculated by Eqs. (5.13–5.16), (5.22), and (5.32) are **aerodynamic optimizations, not firm requirements**. If these drive the wing loading to ridiculously low values, **they can be ignored**."* ⇒ el diagrama de restricciones tiene **dos clases de línea**: requisito duro y optimización blanda. **El software debe distinguirlas visualmente** |
| J-12 | §5.4 | **Cuestionar el requisito, no el diseño** | *"A low wing loading makes a bigger wing which will always increase aircraft weight and cost. If a very low wing loading is driven by only one of the requirements, it might make sense to reconsider that requirement. Alternatively, this may point to a change in the design itself, perhaps adding more sophisticated flaps as a way to allow a higher wing loading."* |
| J-13 | §23.1 | **La mentalidad "show-me"** | *"most 'great ideas' in aircraft design fail to fulfill their promise. There are reasons why most airplanes follow the same basic arrangement, and it isn't 'conservatism' or worse by the designers."* Y *"**We always fool ourselves in weight estimation.**"* |
| J-14 | §23.12 | **La calibración del derivativo** | *"This often requires 'tweaking' and 'fudge-factoring' the analysis inputs until the correct answers are obtained"* — el software **debe permitir** esa calibración manual y **registrarla** (auditoría), no prohibirla |
| J-15 | §24.1 | **La honestidad del ejemplo** | *"no claim is made that these are optimal designs or even good designs or that all calculations are correct!"* |
| J-16 | §18.6 | **Design-to-cost** | *"At this point the designers sincerely hope that no other company has succeeded in designing an aircraft in full compliance with performance, range, and cost requirements."* — qué sacrificar (desempeño o alcance) es una decisión de negocio, no de algoritmo |
| J-17 | §22.2 | **Reusabilidad de lanzadores** | *"The jury is still out, but the potential payoff is attractive."* |

### 4.4 Lo que SÍ es optimizable (la otra mitad del contrato)

Para que la frontera sea útil hay que decir también dónde el software **debe** decidir solo:

| Optimizable sin intervención | § | Por qué |
|---|---|---|
| El lazo de punto fijo de `W₀` | §19.3 | Es aritmética pura con criterio de paro numérico |
| Las 25 (o 729) corridas de análisis de la matriz | §19.4 | *"What a lot of work!"* — es exactamente donde la máquina gana |
| El ajuste de la superficie de respuesta (grado ≥ 3) | §19.6 | Ajuste numérico con regla dura declarada |
| La búsqueda del cruce de restricciones | §19.4 | Geometría de curvas; el humano solo la confirma |
| El escalado de variantes (área alar, área de cola a volumen constante, peso de motor a la 1.1) | §24.3 | Reglas explícitas y cerradas (ver el fixture del carpet 25) |
| DAPCA completo | §18.4 | 9 ecuaciones algebraicas, cero iteración |
| El gate de densidad interna `W₀/V_interno` | §19.5 | **Medible en el kernel B-Rep.** Es la verificación que un CAD puede hacer y una hoja no |
| Los gates S-02 (fracciones fuera de [0.9,1.0]) y S-05 (30%) | §19.3 | Chequeos numéricos con umbral declarado |

---

## 5. COSTO DE CÓMPUTO

| Método | Clasificación | Por qué |
|---|---|---|
| **DAPCA IV completo (18.1–18.9)** | **[NAVEGADOR]** | 9 expresiones algebraicas cerradas, cero iteración, cero matriz. Microsegundos. Evaluable **dentro** del lazo del optimizador sin costo perceptible |
| **CER de peso-por-componente (50/90 h/lb)** | **[NAVEGADOR]** | Un producto punto sobre la lista de pesos |
| **O&M anual, DOC/IOC, break-even** | **[NAVEGADOR]** | Aritmética de contabilidad |
| **NPV / IRR (18.14–18.15)** | **[NAVEGADOR]** | NPV es una suma de ~14 términos. IRR es una raíz escalar (bisección, <20 iteraciones) |
| **Lazo de sizing refinado por segmento (19.6–19.13)** | **[NAVEGADOR]** | ~15–25 iteraciones × ~14 segmentos × aritmética. El DR-3 completo son ~350 evaluaciones de segmento. **Milisegundos.** |
| **Una celda del sizing matrix** (aero as-drawn + pesos cap 15 + propulsión + sizing + desempeño) | **[NAVEGADOR]** | Es el análisis conceptual completo del cap 12–17, todo algebraico/tabular. Este es el supuesto que hace viable todo lo demás |
| **Sizing matrix 3×3 (9 aviones)** | **[NAVEGADOR]** | 9 × lo anterior. Interactivo |
| **Sizing matrix 5×5 (25 aviones) = el fixture del DR-3** | **[NAVEGADOR]** | 25 × lo anterior. *"require more work"* a mano; trivial en máquina. **Aquí ya ganamos contra el proceso del libro** |
| **Trade study anidado 3×3 sobre A y Λ (81 aviones)** | **[NAVEGADOR]**, con barra de progreso | El propio autor lo llama *"What a lot of work!"*. 81 lazos de sizing ≈ menos de un segundo |
| **Optimización de los 6 parámetros base, 3⁶ = 729** | **[NAVEGADOR]** al límite / **[PRECÓMPUTO]** si el análisis por celda se enriquece | 729 lazos completos. Si cada uno cuesta 1 ms ⇒ 0.7 s. Si el análisis por celda sube a 50 ms (paneles 2D, vortex lattice) ⇒ 36 s ⇒ **precomputar y servir la superficie** |
| **5⁶ = 15,625 puntos** (*"would be better"*) | **[PRECÓMPUTO]** | 15,625 × análisis completo. Se corre una vez en iangpu, se sirve como superficie de respuesta |
| **Ajuste de superficie de respuesta grado 4–5, 6 variables** | **[NAVEGADOR]** | Mínimos cuadrados sobre una base polinomial. Grado 5 en 6 variables = C(11,6) = 462 términos ⇒ resolver un sistema 462×462. **~50 MB y un par de segundos**; hacerlo en un Worker |
| **Gradiente exhaustivo con reducción de paso (el método de Raymer)** | **[NAVEGADOR]** | 2n evaluaciones por vuelta (n=6 ⇒ 12), ~10–30 vueltas por nivel de paso, 3–4 niveles ⇒ ~1,500 aviones. Segundos |
| **Algoritmo genético** | **[PRECÓMPUTO]** | Población 100 × 200 generaciones = 20,000 evaluaciones. Y el propio libro advierte que la convergencia *"occasionally"* no es óptimo ⇒ hay que correrlo varias veces con semillas distintas ⇒ 100k+ evaluaciones |
| **Gate de densidad interna `W₀ / V_interno`** | **[NAVEGADOR]** | El volumen interno sale del kernel B-Rep que ya tenemos. Una consulta de propiedades de masa por variante |
| **Regenerar la geometría paramétrica por variante** (mover flecha y que costillas y largueros sigan) | **[NAVEGADOR]** para el loft y las secciones; **[PRECÓMPUTO]** si cada variante exige un rebuild B-Rep completo con fillets | **Este es el cuello de botella real del producto**, no la aritmética. 729 rebuilds de B-Rep con `filletAllEdgesResilient` **no** es interactivo. Estrategia: geometría de análisis (loft + paneles) en vivo, geometría de detalle (largueros/costillas/fillets) solo para el punto elegido |
| **Simulación de misión a segmentos de <1 min (§19.2, el método de las grandes)** | **[GPU-VIVO]** o **[PRECÓMPUTO]** | *"the mission is broken into a large number of very short segments that can be less than 1 min in duration"* con tabla de empuje instalado vs altitud y Mach. Una misión de 3 h = 180+ pasos con búsqueda de α y nivel de empuje en cada uno. Por 729 variantes ⇒ 131,000 pasos con solver interno. **El libro declara esto fuera de su alcance; nosotros lo declaramos fuera del navegador** |
| **Trade study de Δ-V / Hohmann (cap 22)** | **[NAVEGADOR]** | Álgebra cerrada + tablas |
| **Lazo eléctrico (20.6–20.11)** | **[NAVEGADOR]**, más rápido que el térmico | `BMF_total` no depende de `W₀` ⇒ la única no linealidad es `W_e/W₀`. Converge en menos vueltas |

**Regla de arquitectura que sale de la tabla:** *todo el cap 18 y el cap 19 caben en el navegador.*
La barrera de cómputo **no** está en la optimización — está en **regenerar la geometría real por variante**,
que es justo el requisito §2.3 del cliente. Ahí es donde La Forja gana o pierde.

## 6. ESCUELA — las lecciones que salen de este bloque

Regla del proyecto: **la escuela vive DENTRO del CAD** (`forja-brep.html`). El alumno dibuja con croquis y
cotas y analiza con un estudio. Y regla del cliente (§24.1): **primero a mano, después la computadora.**

> *"The author recommends that students do their initial sizing and other pre-layout activities by hand as
> shown here, before being permitted to use RDS-Student or any other 'canned' design program. Then, use the
> computer for the laborious 'number-crunching' of sizing, performance, and trade studies."*

Eso se implementa literal: **las lecciones L1–L3 tienen el optimizador BLOQUEADO.** Se desbloquea en L4.

### L1 — "El lazo que se muerde la cola" (sizing a mano)
| | |
|---|---|
| **Construye** | Nada de geometría todavía: una **hoja de misión** en el CAD (tramos, altitudes, Mach, tiempos) |
| **Mueve** | El `W₀` supuesto, a mano, renglón por renglón, en una tabla vacía |
| **Ve pasar** | Que `W₀_calculado ≠ W₀_supuesto` y que la brecha se cierra sola al avanzar 80% del camino |
| **Verifica contra** | **FIXTURE raymer-24-acsize-relajacion**: las 15 filas del DR-1. Si el alumno teclea 1200/883/220 y las cuatro fracciones, tiene que reproducir `1222.6, 1218.1, 1236.3, …` |
| **La lección real** | El lazo NO es magia: `guess + 0.8·(calc − guess)`. Y con motor fijo converge en **3** iteraciones en vez de 15 (FIXTURE raymer-24-dr1-fixed-engine) |
| **Gate** | Fracción de segmento > 1.0 ⇒ *"you have probably used the wrong units somewhere or have forgotten the negative sign on an exponent!"* — el error se muestra con esa frase |

### L2 — "El diagrama de restricciones es un problema de optimización dibujado"
| | |
|---|---|
| **Construye** | El plano `T/W – W/S` con una línea por requisito (pérdida, despegue, aterrizaje, ascenso, viraje sostenido, crucero) |
| **Mueve** | Cada requisito con un slider: longitud de pista, velocidad de aproximación, `n` sostenido |
| **Ve pasar** | Que el espacio factible **se cierra** y que **una sola línea** manda casi siempre |
| **Verifica contra** | El DR-3: aterrizaje 990.4 ft contra el requisito de 1000 ft ⇒ la línea "2-Landing" está **activa**. Y el mínimo crudo de W/S del DR-3 era ~44 pero el diseñador eligió 56 |
| **La lección real** | J-11: **hay dos clases de línea.** La de pérdida es ley; la de "crucero óptimo" es una optimización aerodinámica que *"can be ignored"* si manda un valor ridículo. Dibujarlas distinto |
| **Gate** | El alumno debe **identificar cuál requisito relajaría** y justificar por qué |

### L3 — "La optimización a mano" (reproducir el DR-1 completo)
| | |
|---|---|
| **Construye** | El croquis del DR-1 en el CAD: ala trapezoidal con `S` acotada, y las 9 variantes por cota (`W/S` × `A`) |
| **Mueve** | `W/S` ±20% y `A` ±33%, generando **9 aviones distintos** — con el CAD regenerando el ala cada vez |
| **Ve pasar** | Que el peso baja al subir `W/S` y bajar `A`, **y que las restricciones lo bloquean** |
| **Verifica contra** | **FIXTURE raymer-24-dr1-matriz-WS-A**: la matriz de 9 pesos y el óptimo `W/S = 10.23, A = 5.2, W₀ = 1180 lb` |
| ⭐ **El momento pedagógico** | Al cruzar las tres primeras restricciones **el alumno descubre que `A` no tiene cota inferior**. La lección le pide **inventar el requisito que falta** (viraje sostenido `n ≥ 2.92` a 100 kt) — exactamente lo que hizo Raymer a mano |
| **La lección real** | El optimizador que se dispara a una frontera **está informando, no fallando** |
| **Y el remate** | Mostrar la envergadura junto al alargamiento: *"it is the chord length that is excessive"* |

### L4 — "Ahora sí, la máquina" (el carpet plot 5×5)
| | |
|---|---|
| **Construye** | El layout del DR-3 (o el suyo) en el CAD, y le pide al motor **25 variantes** |
| **Mueve** | Nada a mano: define ±10% y ±20% y aprieta el botón |
| **Ve pasar** | Las 25 corridas, las iso-`W₀`, las 7 líneas de restricción y el cruce |
| **Verifica contra** | **FIXTURE raymer-24-dr3-carpet-25** completo (25×3 de sizing + 25×7 de desempeño + la fila de requisitos). Y el resultado: óptimo en el cruce Landing×Accel(30s) ⇒ `W₀ = 19,300 lb, T/W = 1.1, W/S = 59` |
| **La lección real** | **El baseline no cumplía la aceleración.** El óptimo que sí cumple pesa **17% más** que el as-drawn. Optimizar no siempre adelgaza: a veces revela que estabas haciendo trampa |
| **Gate** | El alumno debe reproducir la variante 13 (`W/S = 56.054, T/W = 0.98`) y verificar que coincide con el sizing suelto de 17,060 lb |

### L5 — "Un requisito vale 19% del avión" (requirements trade)
| | |
|---|---|
| **Construye** | El mismo carpet plot |
| **Mueve** | **Un solo número**: la aceleración de 30 s a 50 s |
| **Ve pasar** | El óptimo salta del cruce con "7-Acceleration" al cruce con "8-Acceleration"; `T/W` cae de 1.1 a 0.9 |
| **Verifica contra** | `19,300 lb → 15,600 lb`, **−19%**. Y las palabras: *"This will produce a considerable cost savings for the relaxation of that one requirement."* |
| **La lección real** | *"Requirements trades determine the sensitivity of the aircraft to changes in the design requirements. If one requirement forces a large increase in weight or cost, the customer can relax it."* Este es el argumento de venta del módulo, en una gráfica |

### L6 — "Lo que la matriz no ve" (optimización multivariable)
| | |
|---|---|
| **Construye** | El mismo DR-3, ahora con 6 variables: `T/W, W/S, A, Λ, λ, t/c` |
| **Mueve** | El optimizador (gradiente exhaustivo con reducción de paso) |
| **Ve pasar** | Que gana **2% adicional gratis**, solo moviendo la geometría del ala |
| **Verifica contra** | **FIXTURE raymer-24-dr3-mvo**: `W₀ = 15,242 lb` **y exactamente tres restricciones activas** (`Ps@n=5 = 1.7`, `Ps@n=1 = 0.1`, `Accel = 49.4`) |
| **La lección real** | ⭐ **Kuhn–Tucker se VE.** El óptimo está pegado a tres paredes. *"at the optimum the only direction you can move to improve the objective function is one that will violate one or more constraints"* |
| **Gate** | Un resultado con el peso correcto pero las restricciones equivocadas activas **reprueba** |

### L7 — "El costo manda" (DAPCA)
| | |
|---|---|
| **Construye** | Nada nuevo: toma el `We` que ya salió del pipeline |
| **Mueve** | `Q` (cantidad de producción), el material, el año-base |
| **Ve pasar** | Que `Q` mueve el costo por avión más que casi cualquier decisión de diseño |
| **Verifica contra** | `500^0.163 = 2.75 ≈ 3` (la validación del propio autor) + la banda de $/lb por clase |
| **La lección real** | *"Aircraft are bought by the pound."* Y **el ejercicio 18.3 del libro es la tarea**: estimar el DR-3 en aluminio y en compuestos, y explicar la diferencia |
| **Gate** | El alumno debe entregar una **banda**, no un número, y decir de dónde sale el ancho |

### L8 — "El peso miente" (cuándo la measure of merit cambia)
| | |
|---|---|
| **Construye** | Dos carpet plots del mismo avión: uno con `W₀` de measure of merit y otro con LCC |
| **Mueve** | El precio del combustible y el alargamiento |
| **Ve pasar** | Que el óptimo **se mueve**: *"A higher-aspect-ratio wing is heavier but saves fuel."* |
| **Verifica contra** | Ejercicio 18.1 del libro: *"Describe some situations where the minimum weight aircraft would not be the minimum cost aircraft, specifically a) purchase price, b) operating cost, and c) life-cycle cost."* |
| **La lección real** | La measure of merit es una **decisión**, no un default |

### L9 — "El lazo que no es el lazo" (eléctrico y cohete)
| | |
|---|---|
| **Construye** | El mismo avión de L1, ahora eléctrico |
| **Mueve** | La energía específica de la batería por la Tabla 20.1 (45 → 600 Wh/kg) |
| **Ve pasar** | Que `BMF` se **suma** y que el `ln` de Breguet desapareció |
| **Verifica contra** | El benchmark: *"gasoline has 20 times better effective energy density than the best batteries"* |
| **La lección real** | Un motor de sizing bien hecho **inyecta la ecuación de segmento**; no la cablea. Prueba: la misma arquitectura corre el cohete con `m_i/m_f = e^(ΔV/g₀I_sp)` (ejercicio 21.2: *"Size a rocket to put yourself into orbit"*) |

### L10 — "El realism factor" (el gate que solo un CAD puede correr)
| | |
|---|---|
| **Construye** | Un trade study: "mete dos misiles más" |
| **Mueve** | El layout, en el CAD |
| **Ve pasar** | La **densidad interna** `W₀/V_interno` medida por el kernel, comparada contra el baseline |
| **Verifica contra** | La regla literal: *"insist that all redesigned layouts used for trade studies be checked to maintain the same internal density as the baseline"* |
| **La lección real** | ⭐ *"If there were sufficient room in the baseline to fit two more missiles internally, then the baseline was poorly designed. If the baseline was already 'tight,' then the revised layout must be a fake!"* — **el alumno aprende que el trade study se puede falsificar, y ve la máquina atrapándolo** |

### L11 — "El escalón" (diseño derivativo)
| | |
|---|---|
| **Construye** | Una variante de un avión existente: estirar la envergadura |
| **Mueve** | La envergadura, poco a poco |
| **Ve pasar** | Que el costo sube suave... **y de golpe salta**, cuando la sección central del ala ya no aguanta |
| **Verifica contra** | *"There is a cost step function... There are no top-level, rule-of-thumb estimations. You need to do the real calculations."* |
| **La lección real** | Un optimizador de gradiente **no puede** con una función escalonada. Y el margen de crecimiento real: *"The landing gear of new aircraft are usually designed with a 25% increase in gross weight."* |

### Los ejercicios del libro, tal cual (son el examen)
```
18.1  Describe some situations where the minimum weight aircraft would not be the minimum cost
      aircraft, specifically a) purchase price, b) operating cost, and c) life-cycle cost.
18.2  The Sneaky Aircraft Company stole Boeing's cost data to help make a more accurate cost
      estimation for their new transport. Why was this a dumb idea (law and ethics aside)?
18.3  Estimate the development and procurement cost of the DR-3 design example, assuming
      a) traditional aluminum construction and b) substantial use of composites.
19.1  Develop an empty weight sizing equation for the DR-1 design example by estimating the
      change to empty weight for a 20% increase in takeoff weight, then applying that result
      to Eq. (19.13).
19.2  Revise the carpet plots of Figs. 19.4 and 19.6 showing a takeoff constraint of 600 and
      700 ft. What is the optimal aircraft for each of these relaxed requirements?
```
> ⚠️ **Erratum del libro:** los ejercicios se refieren a los ejemplos de diseño como *"Chapter 21"* cuando en
> la 6ª edición están en el **cap 24**. La sección de preguntas conserva la numeración de una edición anterior
> (también llama "Chapter 20" al vertical flight y "Chapter 22" a lo que es el cap 23). No es OCR: es el libro.
>
> ⚠️ **Segundo erratum, en el ejercicio 20.2/20.3:** *"W = 11,867 lb {847 kg}"* para el Sikorsky S-58.
> **11,867 lb = 5,383 kg, no 847 kg.** No copies la cifra métrica.

---

## 7. NO OBSERVADO — figuras y tablas que eran imagen

| Figura / tabla | Qué contenía | Qué sí se rescató del texto |
|---|---|---|
| **Fig. 18.1** *Elements of life-cycle cost* | Diagrama de cajas con tamaños proporcionales al costo | Los nombres de las cajas y las proporciones **están en el texto** (RDT&E <10%, producción ~50% militar, O&M el más grande). **Reconstruible** |
| **Fig. 18.2** *Production learning curve* | Cinco curvas de aprendizaje desde `Q_i = 1` | Los **rótulos de exponente sí están** (`x = .926, .848, .678, .485, .263`) y de ahí sale `x = 1+log₂(LC)`. La curva es trivial de regenerar. **Recuperada** |
| **Tabla 18.1** encabezados | Nombres de columna | Los valores numéricos se leen; los **encabezados** están destrozados. Asignación inferida del texto adyacente. `[OCR DUDOSO]` |
| **Ecuación 18.2 {mks}** | La constante métrica de las horas de herramental | **Ausente del texto.** Solo está la versión {fps} (5.99) |
| **Ecuación 18.8** | Costo de producción del motor | **Destruida por el OCR.** Reconstruida parcialmente y marcada como no-fixture |
| **Ecuaciones 18.10, 18.11** | Costo de tripulación | Coeficientes legibles; **agrupación de `V_c` ilegible** |
| **Ecuaciones 18.12, 18.13** | Costo de materiales de mantenimiento por FH y por ciclo | Constantes legibles sueltas; **estructura no confiable** |
| **Ecuación 19.12** | Descenso (repetida del cap 17) | Reflowada. Ir al cap 17 por la forma buena |
| **Fig. 19.1** *Sizing matrix* | Matriz 3×3 del caza pequeño | ⭐ **RECUPERADA COMPLETA** — los 9 conjuntos de datos y los 3 requisitos están tipografiados en el texto |
| **Fig. 19.2** *Sizing matrix crossplots* | 3 columnas × 3 filas de gráficas (W₀, P_s, s_TO vs W/S) | ❌ **Solo hay ruido de OCR.** Los ejes se adivinan (`W₀ (1000 lb)`, `P_s (100 fps)`, `s (100 ft)`, `W/S` de 50 a 70) pero **ninguna curva es legible**. **Regenerable a partir de la Fig. 19.1** |
| **Fig. 19.3** *Sizing matrix plot (continued)* | Iso-`W₀` en el plano T/W–W/S | Se leen los ejes (T/W 0.9–1.10, W/S 45–75) y **dos rótulos de contorno: "45 K" y "40 K"**. Las curvas, no |
| **Fig. 19.4** *Sizing matrix plot (concluded)* | Lo anterior + líneas de restricción + óptimo | ❌ **Solo los ejes.** El punto óptimo **no es legible** |
| **Fig. 19.5** *Carpet plot format (same results!)* | La construcción del carpet en 3 pasos con el eje desplazado | ⭐ **El PROCEDIMIENTO está descrito completo en el texto** (párrafos de p.722), incluyendo los puntos 1–9 y los W/S 50/60/70. **Reconstruible.** Los ejes se leen: `W₀ (1000 lb)` 30–60 |
| **Fig. 19.6** *Completed carpet plot* | El carpet con restricciones y el óptimo | ❌ Solo los ejes y el rótulo `W/S = 50` |
| **Fig. 19.7** *Cost-driven range trade* | Precio de compra vs alcance (el ejemplo de CAIV) | ⚠️ **Ejes legibles**: vertical "Purchase price" de **26,000 a 32,000** (unidades no impresas), horizontal "Range" de **300 a 700**. La curva no |
| **Tabla 22.2** *Data for heavenly bodies* | 9 cuerpos × 6 columnas | ⚠️ **Parcialmente legible.** Tierra, Luna y Marte se leen limpios; el resto tiene reflow. Usar solo esos tres sin verificar |
| **Fig. 22.1** blob de propelente · **Fig. 22.2** geometrías de etapas · **Fig. 22.3** booster reutilizable · **Fig. 22.4** waverider | Diagramas | ❌ Los **nombres** de las geometrías de etapas sí están: *sequential burn · parallel burn strap-on boosters · parallel burn engines · dropped tank* (Most/Soyuz/Atlas/Shuttle) |
| **Fig. 23.x** (todas las configuraciones raras) | Croquis de conceptos | ❌ Solo los pies de figura |
| **Cap 24: los 3-vistas del DR-1 y DR-3** | Los layouts dibujados | ❌ **Nada.** Los dibujos son el corazón del ejemplo y no están |
| **Cap 24: trade studies de rango y de SFC del DR-3 (p.949)** | 2 gráficas | ❌ **Curvas ausentes.** Solo: título *"Trade Study: RANGE (nmi): DR3.DAT"*, `Baseline Range = 500`, eje vertical 8,000–20,000 lb, eje horizontal 300–700 n mi; y *"Trade Study: C (% change)"* |
| **Cap 24: carpet plot del DR-3 (p.956)** | La gráfica del carpet | ⚠️ **Los rótulos SÍ están** — eje `W₀ (kg)` 6,000–12,000, eje `W₀ (lb)` 14,000–26,000, y **la leyenda completa de las 8 curvas de restricción**: `1-Takeoff · 2-Landing · 3-Ps@n=5 · 4-Ps@n=5 · 5-? · 6-Ps@n=1 · 7-Accel · 8-Accel`. **Los datos de la gráfica están en la tabla de p.956 ⇒ REGENERABLE AL 100%** |
| **Cap 24: gráficas de envolvente de vuelo, alcance específico, R.O.C., P_s y turn rate del DR-3** | ~10 gráficas | ⚠️ Se leen los **ejes y títulos** (`MAXIMUM TURN RATE at 30000ft: DR3.DAT`, `LOAD FACTOR (n) AFTERBURNER ON (OR MAX POWER)`, Mach 0.000–2.000, turn rate 0.00–20.00 deg/s) pero **ninguna curva** |
| **Cap 24: las páginas manuscritas del DR-1** | ~40 páginas de cálculo a mano del autor | ⚠️ **Parcialmente legibles.** Las tablas del programa AC-SIZE están tipografiadas (rescatadas al 100%); la aritmética manuscrita alrededor está a ~50% |

**Nota metodológica sobre las figuras de optimización:** las Figs. 19.2–19.6 son **el algoritmo dibujado**,
y son justamente las que no se pueden leer. **Pero no hacen falta**: el texto describe el procedimiento paso
a paso y la Fig. 19.1 da los datos de entrada. **Se pueden REGENERAR con nuestro propio motor y compararlas
cualitativamente contra las descripciones.** Eso es, de hecho, un gate de aceptación excelente: si nuestro
carpet plot generado desde la Fig. 19.1 no se parece a lo que el texto describe, el motor está mal.

---

## 8. LO QUE MÁS ME SORPRENDIÓ

### 8.1 El único capítulo que declara no tener física
El cap 18 dice de sí mismo: *"There is **no 'fundamental physics'** to underpin the analysis."* En un libro
cuya regla es que todo sale de una ecuación real, el capítulo que decide quién gana el contrato es
**estadística pura sobre datos que el autor admite que están contaminados**. Y el remate: los fudge factors
son *"variable constants that you multiply your answer by to get the right answer."*
**Una máquina lineal implementa DAPCA como si fuera Bernoulli.** No lo es: es una correlación con un dominio
de validez estrecho, un año-base pegado y una banda de incertidumbre que hay que **entregar junto al número**.
El requisito C-04 (devolver banda, no número) no es refinamiento: es lo que separa una herramienta honesta
de una calculadora que miente con 7 cifras.

### 8.2 El optimizador se disparó, y la respuesta fue escribir un requisito nuevo
En §24.2, la optimización a mano del DR-1 **no tiene cota inferior en el alargamiento**. Un ingeniero de
software habría revisado el algoritmo. Raymer escribió a mano: *"THEREFORE, WE NEED SOME REQUIREMENT BASED ON
MANEUVERING"* y **inventó una restricción de viraje sostenido a mitad del estudio**.
Eso reordena la arquitectura del producto: **el conjunto de restricciones no es una entrada del optimizador,
es una salida del diálogo.** Un optimizador que solo acepta restricciones al arrancar está construido en
contra de cómo trabaja el cliente.

### 8.3 La relajación 0.8 estaba escondida a plena vista
El libro dice *"A new assumed takeoff weight was selected somewhere between the two"* — vago, impreciso,
irritante para un implementador. Pero el autor **imprimió las tablas de iteración de su propio programa**,
y de esas tres tablas sale que "somewhere between" es exactamente `guess + 0.8·(calc − guess)`, verificado
en tres corridas independientes (DR-1 rubber, DR-1 fijo, DR-3).
**Lección de método: cuando el texto es vago, los fixtures no lo son.** Los números del cliente contienen
requisitos que su prosa no dice.

### 8.4 El óptimo del DR-3 pesa 17% MÁS que el baseline
Todo el instinto dice que optimizar adelgaza. En el mejor ejemplo del libro, **el óptimo es más pesado**,
porque el baseline **no cumplía la aceleración** y estaba mintiendo. Optimizar no encontró un avión mejor:
**encontró que el avión anterior era mentira.**
⇒ Requisito de UX: cuando el óptimo pese más que el baseline, el software tiene que decir **exactamente qué
restricción violaba el baseline**, o el usuario cree que el optimizador está roto.

### 8.5 Un solo requisito vale el 19% del avión
`30 s → 50 s` de aceleración ⇒ `19,300 lb → 15,600 lb`. Un número en un pliego, tecleado por alguien que
probablemente lo redondeó, se lleva **una quinta parte del avión**. Es el argumento comercial más fuerte de
todo el bloque, y está en dos renglones de la p.955.
**Y explica por qué el cliente insiste en "requirements trades":** no está optimizando el avión, está
negociando con su cliente.

### 8.6 El anti-fraude está definido como una medición geométrica
*"If there were sufficient room in the baseline to fit two more missiles internally, then the baseline was
poorly designed. If the baseline was already 'tight,' then the revised layout must be a fake!"*
Es una acusación de fraude convertida en un gate ejecutable: `W₀ / volumen_interno` constante.
⭐ **Y solo un CAD puede correrlo.** Una hoja de cálculo no sabe cuánto volumen tiene el fuselaje.
Este es, literalmente, **el requisito que justifica que el optimizador viva dentro del CAD y no al lado.**

### 8.7 La objeción #3 va dirigida a nosotros
Las objeciones 1 y 2 son técnicas. La tercera es sobre el efecto del software en la mente del ingeniero:
*"Once a time-consuming optimization model is developed for a certain design approach, there will be an
understandable reluctance to look at totally different design approaches that are not represented by the
model... **This could serve as a dampener on the essence of aircraft conceptual design.**"*
El cliente nos está advirtiendo que **nuestro producto puede hacer daño**. La contramedida no es técnica:
es que **agregar una configuración nueva sea barato**. Si meter un canard-pusher al modelo cuesta dos semanas,
nadie lo va a meter, y habremos construido exactamente el amortiguador que él teme.

### 8.8 El "no photo-scale" y el fuselaje que no encoge
El sizing escala el avión, pero *"the passenger compartment... still has to hold the passengers, crew, cargo,
galleys, and toilets. None of those get smaller just because the sizing calculation says TOGW is reduced."*
El efecto medido: el exponente de peso vacío pasa de **−0.06 a −0.31**. **Un factor de 5.**
Es el recordatorio más brutal de que el sizing es una **abstracción sobre geometría real**, y de que cuando
la abstracción se aleja de la geometría, miente por un factor de 5. Y el libro da el escape: **redibujar en
cada iteración es lo correcto**, y los programas sofisticados *"do just this internally"*.
⇒ **Eso es exactamente lo que nuestro CAD paramétrico puede hacer y una hoja de cálculo no.**

### 8.9 Los dos ejemplos usan variables de optimización DISTINTAS
El DR-3 (motor rubber) optimiza `T/W × W/S` — el carpet plot canónico. El DR-1 (motor **fijo**, un Lycoming
que ya existe) optimiza `W/S × A`, porque **no hay `T/W` que optimizar**: el empuje es un dato del catálogo.
Una máquina lineal cablea "carpet plot = T/W vs W/S". **Los ejes son una elección de diseño**, y la elección
la determina si el motor es de hule o de metal.

### 8.10 `K` no es constante y tiene un mínimo interior
En el fixture de P_s del DR-3, `K` baja de 0.1411 (n=1) a 0.1022 (n=3) y **vuelve a subir** a 0.1340 (n=5).
Un implementador que cablee `K = 1/(π·A·e)` obtiene una constante y **falla el fixture sin darse cuenta**,
porque los `P_s` seguirán saliendo "razonables". Es el tipo de error que un test de humo no atrapa y un
fixture del libro sí.

### 8.11 El libro se autocalifica con "B"
*"Were the author to grade himself in a college design course, these examples would rate at most a 'B.'
The 'A' students would... **ultimately redraw the as-optimized aircraft** to ensure that the analysis
assumptions were realistic."*
El autor del método declara que **su propio ejemplo publicado está incompleto**, y dice exactamente qué falta:
**volver al dibujo después de optimizar.** Eso no es humildad: es la especificación del último paso del lazo,
y es el que casi todo software omite.

### 8.12 Las preguntas del libro apuntan a capítulos que ya no existen
Los ejercicios llaman "Chapter 21" al capítulo 24. La sección de preguntas de la 6ª edición **no se
renumeró**. Es un recordatorio de que el manual del cliente **tiene errores**, y de que nuestro trabajo
incluye detectarlos y no propagarlos a los tests. (El otro: `11,867 lb {847 kg}` del S-58.)

---

## 9. EL MOTOR DE OPTIMIZACIÓN QUE PIDE EL CLIENTE

> Especificación funcional dicha **con las palabras del libro**. Cada requisito lleva su cita.
> Donde extiendo, lo marco. Donde el libro calla, digo que calla.

### 9.0 La tesis, en las palabras del cliente

Tres frases del cliente definen el producto entero:

> **(a) Por qué existe el hueco** — *"This emphasis on trade studies and alternative design concepts poses a
> problem for high-end CAD systems. **They are too good!** Typically, they've been tailored for production
> part design, not the 'everything will change' environment of conceptual design."* (§2.1.4, p.13)
>
> **(b) Qué quiere exactamente** — *"CAD capabilities for rapidly locating rivets or cutter paths are
> worthless at this early stage of design, but **a CAD capability to change the wing's sweep and
> automatically revise the geometry of the spars and ribs accordingly would be of tremendous use.
> The wing sweep will probably change after every optimization study or wind-tunnel test. The CAD system
> should make this easy.**"* (§2.3, p.23)
>
> **(c) Para qué sirve el optimizador** — *"it is best used **when based on analysis of a realistic and
> complete aircraft conceptual design layout** and when its goal is to **quickly tell the aircraft designer
> how to change the design layout to make it better** and is used in the next design iteration
> **as only one of many 'inputs.'**"* (§19.6, p.727)

Léelas juntas y sale una sola especificación:

**El optimizador de La Forja no es un solver que devuelve un vector óptimo. Es un generador de instrucciones
de rediseño, alimentado por geometría real, cuyo cuello de botella es regenerar esa geometría.**
Quien gane la regeneración paramétrica gana la categoría. Los grandes (ANSYS, Siemens, CATIA) tienen
solvers mejores que los nuestros y **regeneración peor para este uso**, y el cliente ya lo dijo: son
*"too good"* — están optimizados para el problema equivocado.

### 9.1 Arquitectura de cinco capas

```
  ┌─ CAPA 5 · GOBIERNO ────────────────────────────────────────────────────────┐
  │  "experienced designers always 'in the loop'"                              │
  │  · el ingeniero edita restricciones EN VIVO (§4.2)                         │
  │  · toda decisión del motor es explicable y reversible                      │
  │  · el resultado es "only one of many inputs", nunca un veredicto           │
  ├─ CAPA 4 · BÚSQUEDA ────────────────────────────────────────────────────────┤
  │  matriz paramétrica · superficie de respuesta (grado ≥3) · gradiente       │
  │  exhaustivo con reducción de paso · Latin squares · GA (opcional)          │
  ├─ CAPA 3 · MEDIDA DE MÉRITO ────────────────────────────────────────────────┤
  │  W₀ | We | costo de adquisición | DOC/seat-mile | LCC | NPV | ROI          │
  │  INYECTABLE. "It is possible to create sizing plots in which the measure   │
  │  of merit is cost rather than weight."                                     │
  ├─ CAPA 2 · ANÁLISIS DE UNA VARIANTE (el "avión completo") ──────────────────┤
  │  aero as-drawn → propulsión → pesos → LAZO DE SIZING → desempeño → costo   │
  │  "Each combination ... produces a DIFFERENT AIRPLANE ... separately sized" │
  ├─ CAPA 1 · GEOMETRÍA PARAMÉTRICA (nuestro diferenciador) ───────────────────┤
  │  mover Λ, A, λ, t/c, W/S ⇒ REGENERAR loft + largueros + costillas + tren   │
  │  ⇒ medir área mojada, A_max, volumen interno, encaje de tren y payload     │
  │  "The CAD system should make this easy."                                   │
  └────────────────────────────────────────────────────────────────────────────┘
```

**La regla de dependencia:** la capa 4 **nunca** llama a la capa 1 sin pasar por la 2, y la capa 2
**nunca** infiere geometría — la pide. Ese es el mecanismo que hace que *"the computer knows if the landing
gear fits"*, que es la objeción #2 del cliente.

### 9.2 CAPA 1 — el generador de variantes: qué debe regenerar y con qué reglas

El libro **da las reglas de escalado explícitas** (§24.3, p.955). No hay que inventarlas:

| Variable movida | Qué regenera | Regla LITERAL del libro |
|---|---|---|
| **T/W** | Empuje, peso del motor, góndola | *"engine thrust varies directly with T/W. Uninstalled engine weight was assumed to vary by the **1.1 power** of the relative change in thrust [Eq. (10.3)]. The aerodynamic effect of a change in T/W, largely the increase in nacelle wetted area, was assumed to be proportional to engine flow path area and therefore proportional to T/W."* |
| **W/S** | Área alar, área de colas, arrastre de onda | *"wing area varies inversely with wing loading. **Tail area was varied by the 3/2 power of the relative change in wing area to keep tail volume constant** [Eqs. (6.28 and 6.29)]. The change in wave drag due to the change in wing size was estimated by changing the maximum cross sectional area (A_max) proportional to the change in wing area, **weighted to the wing's baseline percentage of total cross-section area**."* |
| **A, Λ, λ, t/c** | Planta alar completa + estructura interna | ⭐ **Aquí el libro NO da regla porque a mano no se puede.** Es exactamente el hueco: *"a CAD capability to change the wing's sweep and automatically revise the geometry of the spars and ribs accordingly"* |
| **W₀ global (photo-scale)** | Todo el avión, o el avión menos el fuselaje | *"This is properly handled by **redrawing the airplane for each 'guess' of TOGW** in the sizing process. Sophisticated sizing programs do just this internally"* |

**Requisitos de la capa 1:**

| # | Requisito | Fuente |
|---|---|---|
| G-01 | Mover `Λ` debe **regenerar largueros y costillas** sin intervención | §2.3 literal |
| G-02 | Cada variante debe **medir** (no estimar): `S_wet`, `A_max`, **volumen interno**, y los encajes (tren, radar, pasajeros, tanques, ángulo de visión sobre la nariz) | §19.6 objeción 2 |
| G-03 | El **gate de densidad** `ρ = W₀/V_interno` se calcula **automáticamente** por variante y se compara contra el baseline. Fuera de tolerancia ⇒ **la variante se marca "no creíble"**, no se descarta en silencio | §19.5 literal |
| G-04 | Implementar el **Net Design Volume** [ref 137] como alternativa barata cuando la regeneración completa no sea viable, con su límite declarado: *"it isn't perfect and doesn't fully capture the geometric changes"* | §19.5 |
| G-05 | La regeneración debe ser **determinista y pura en los parámetros** — la misma tupla da la misma geometría, siempre. Sin esto no hay cache de variantes ni reproducibilidad de un estudio | [EXTENSIÓN DECLARADA: el libro no lo pide; nuestro pipeline sí lo exige para poder cachear 729 variantes] |
| G-06 | Separar **geometría de análisis** (loft + paneles + propiedades de masa, viva) de **geometría de detalle** (fillets, redondeos, sujetadores, precomputada solo para el punto elegido) | [EXTENSIÓN DECLARADA: es la única forma de que 729 rebuilds sean viables. Motivo: `filletAllEdgesResilient` sobre 729 variantes no es interactivo] |

### 9.3 CAPA 2 — el análisis de una variante y el lazo de sizing

```
FUNCIÓN analizarVariante(params, mision, requisitos) → Avion
  1. geometria   = CAPA1.regenerar(params)              // mide S_wet, A_max, V_interno
  2. aero        = analisisAsDrawn(geometria)           // cap 12
  3. propulsion  = motor(params.TW, geometria)          // cap 10, rubber o fijo
  4. pesos       = buildup(geometria, cargas)           // cap 15, NO estadística — ver abajo
  5. W0_sized    = LAZO_DE_SIZING(pesos, aero, propulsion, mision)
  6. desempeno   = evaluar(W0_sized, requisitos)        // cap 17
  7. costo       = dapca4(pesos.We, ...) + operaciones  // cap 18
  RETORNA { W0_sized, We, Wf, desempeno, costo, holguras, densidad }
```

**Requisito duro sobre el paso 4** — el libro prohíbe explícitamente la estadística aquí:
> *"these equations are only suitable for use before the airplane layout is made, and they are **not
> appropriate for design trade studies**. After the layout is completed, the component weight buildup methods
> in Chapter 15 are used."* (§6.3.2)
⇒ **El optimizador NO puede usar `We/W₀` estadístico.** Si el usuario intenta optimizar antes de tener
layout, el software debe advertir con esa frase.

**EL LAZO DE SIZING — especificación completa:**
```
FUNCIÓN LAZO_DE_SIZING(...)
  guess ← W0_as_drawn
  REPETIR hasta convergencia o iter_max:
     We ← We_as_drawn · (guess / W0_as_drawn)^(1+c)          // ec. 19.13, c de Tabla 3.1 o calculado
     PARA cada segmento i de la misión:
        f_i ← fraccionDeSegmento(tipo_i, ...)                // ecs. 19.6–19.11 (o 20.6–20.9, o 22.13)
        GATE: SI f_i > 1.0 → ERROR DURO
              "you have probably used the wrong units somewhere or have forgotten
               the negative sign on an exponent!"
        GATE: SI f_i < 0.9 → PARTIR el segmento en dos y reintentar
     Wf ← 1.06 · (1 − Π f_i)·guess    [ojo: los pesos SOLTADOS se restan, no se multiplican]
     calc ← W_payload + W_crew + Wf + We
     SI |calc − guess| / guess < 0.001 → CONVERGIÓ
     guess ← guess + 0.8·(calc − guess)                       // relajación deducida de los fixtures
  GATE FINAL: SI |W0_sized − W0_as_drawn| / W0_as_drawn > 0.30
     ADVERTIR: "this author gets nervous at a takeoff-weight difference greater than about 30%
                of the as-drawn weight" ⇒ redibujar, reanalizar, redimensionar
  GATE PHOTO-SCALE: SI la desviación supera 10–20%, aplicar ec. (19.14) o pedir redibujo
```

| # | Requisito | Fuente |
|---|---|---|
| A-01 | `fraccionDeSegmento` es **inyectable por tipo de propulsión**: térmica (19.6–19.11), eléctrica (20.6–20.9, **suma**), cohete (22.13) | §20.10, §22.2 |
| A-02 | Bifurcación rubber/fijo: con rubber la ec. (19.7) *"can be used unchanged"*; con fijo *"would have to be recalculated for each iteration step"* o tratar el combustible *"as a weight drop"* | §19.3 |
| A-03 | El peso **soltado** (payload drop) se **resta**, no multiplica. El fixture del DR-3 lo prueba: `Wf/W₀ = 0.2751` ≠ `(1−0.7171)·1.06 = 0.2999` | fixture raymer-24-dr3-mission-fractions |
| A-04 | Reserva y atrapado: **×1.06** | §19.3 |
| A-05 | Crédito de distancia de ascenso al crucero siguiente; crédito de descenso salvo prohibición explícita | §19.3 |
| A-06 | Viento: aumentar el alcance requerido por `V_air/V_ground`, con `V` = airspeed real. **El loiter no se afecta** | §19.3 |
| A-07 | Motor eléctrico: **BMF se SUMA**, no se multiplica; y `BMF_total` no depende de `W₀` ⇒ converge más rápido | §20.11 |

### 9.4 CAPA 3 — la medida de mérito, inyectable

> *"It is possible to create sizing plots in which the measure of merit is cost rather than weight.
> The plotting procedure is the same except that cost values are used rather than weight values."* (§19.4)
> *"It is a fairly simple matter to use purchase price, fuel cost, operating cost, life-cycle cost, return on
> investment, or net present value as the measure of merit for carpet plots. Estimate the desired cost value
> for each parametric design variation from its sized empty weight, and use the cost rather than weight on the
> carpet plot. The same can be done with multivariable optimizers and even with MDO."* (§19.7)

| Medida de mérito | Cómo se calcula | Cuándo usarla (dicho por el libro) |
|---|---|---|
| **`W₀` (default)** | Directa del lazo | *"for most aircraft types the minimization of weight will also minimize cost for a given design approach"* |
| **`We`** | Directa | Cuando el costo de adquisición es el objetivo y la misión es fija |
| **Precio de adquisición** | `dapca4(We,…)` × investment factor | *"cost is so strongly driven by the weight (especially empty weight) **for a given design approach**"* |
| **Costo de combustible / DOC** | Del `Wf` dimensionado, ratio de operación | *"life-cycle cost is largely driven by fuel costs"* |
| **LCC** | RDT&E + producción + O&M×20 años + disposal | Cost measure of merit militar |
| **DOC por asiento-milla** | §18.7 | Measure of merit de transporte comercial |
| **NPV / IRR** | ecs. 18.14–18.15 | *"the airlines will be more interested in their return on investment and even the net present value"* |

⭐ **REQUISITO DE ADVERTENCIA (O-19).** El software **debe avisar** cuando la medida de mérito elegida es
inválida para el trade study en curso:
> *"if you are doing trade studies of **alternative technologies, engines, avionics, manufacturing methods**,
> or similar items, then **weight is a poor approximation to cost**."*
Implementación: si el trade study toca `Materiales`, `BPR/OPR/TIT`, `Advanced technologies`, `Observables`
o `Configuración` de la Tabla 19.1 **y** la medida de mérito es `W₀` o `We` ⇒ **banner con la cita**.

⭐ **Y el ejemplo canónico del conflicto**, que debe estar en la ayuda:
> *"**A higher-aspect-ratio wing is heavier but saves fuel.**"*
Con `W₀` de medida de mérito, el optimizador baja `A`. Con LCC, lo sube. **La misma máquina, dos respuestas
opuestas, y ninguna está mal.** El que elige es el ingeniero.

**Frontera declarada (O-20):** DAPCA para optimizar, WBS para cotizar.
> *"It is more difficult to use cost as estimated by the detailed WBS methods... the number of inputs and
> assumptions overwhelms the optimization process. For these reasons, most companies use DAPCA or an in-house
> equivalent for conceptual design trade studies and optimizations, then use a detailed WBS method for the
> final contract pricing."*

### 9.5 CAPA 4 — los métodos de búsqueda

#### 9.5.1 Método 1 — SIZING MATRIX / CARPET PLOT (el obligatorio)

**Es el "granddaddy"** — *"The 'granddaddy' of all trade studies is the T/W–W/S carpet plot. This is such an
integral part of aircraft analysis that it is not usually even thought of as a trade study."* — y por eso es
el método por defecto, no una opción avanzada.

**Algoritmo, paso a paso, tal como el libro lo describe (§19.4, p.718–723):**
```
P1. Elegir DOS variables. Default T/W y W/S, "but other possibilities are discussed."
    Si el motor es de tamaño FIJO, T/W no es variable → usar W/S y A (caso DR-1).
P2. Variar ambas "arbitrarily from the as-drawn baseline values, typically by plus and minus 20%."
    Malla mínima 3×3; el DR-3 usa 5×5 con ±10% y ±20%.
P3. PARA CADA CELDA: regenerar geometría, reanalizar aero/propulsión/pesos, y DIMENSIONAR a la misión.
    "These different airplanes are separately sized to determine the takeoff weight of each."
    → CAPA 1 + CAPA 2. NO se interpola el análisis.
P4. PARA CADA CELDA: evaluar TODOS los requisitos de desempeño.
    VERIFICAR: "If the T/W and W/S variations are wide enough, at least one of the aircraft will meet
    all performance requirements, although it will probably be the heaviest airplane."
    → si NINGUNA celda es factible, AMPLIAR el rango y avisar.
P5. CROSS-PLOT: para cada T/W, graficar W₀_sized vs W/S, y cada métrica de desempeño vs W/S.
P6. Sobre las curvas de W₀, leer los W/S que dan pesos REDONDOS igualmente espaciados
    ("gross weights at 5000-lb increments were selected").
P7. Trasladar esos pares (W/S, T/W) al plano T/W–W/S y unir con curvas suaves
    → LÍNEAS DE ISO-W₀. "From these curves one can readily determine the sized takeoff weight
    for variations of the aircraft with any combination of T/W and W/S."
P8. Sobre las curvas de desempeño, leer los W/S que cumplen EXACTAMENTE cada requisito.
P9. Trasladar → LÍNEAS DE RESTRICCIÓN.
    "Shading is used to indicate which side of these 'constraint lines' the desired answer must avoid."
P10. ÓPTIMO = "the lightest aircraft that meets all performance requirements... found by inspection...
     and usually will be located where two constraint lines cross."
```

**El formato CARPET (mismo dato, otra vista) — §19.4, p.722:**
```
C1. Tomar la curva W₀ vs W/S de la PRIMERA T/W.
C2. Superponer la de la SIGUIENTE T/W, DESPLAZANDO el eje horizontal a la izquierda
    "some arbitrary distance". ⭐ "This SHIFTING OF THE AXIS IS CRUCIAL to the development
    of the carpet-plot format."
C3. Repetir con el MISMO incremento para cada T/W restante.
C4. Unir los puntos de IGUAL W/S entre curvas → "The resulting curves are said to resemble a carpet,
    hence the name."
C5. QUITAR el eje horizontal: "because one can now read wing loadings by interpolating between
    the curves."
C6. Proyectar las restricciones sobre el carpet y unirlas.
C7. ÓPTIMO = "the LOWEST POINT on the carpet plot that meets all constraints. This usually occurs
    at the intersection of two constraint curves."
```

⭐ **Requisito de UI:** los dos formatos son **la misma consulta con dos vistas**. El libro es explícito:
*"Fig. 19.5 Carpet plot format (**same results!**)"*. Un toggle, no dos módulos.

**Gates del carpet plot:**
| Gate | Condición | Mensaje |
|---|---|---|
| CP-1 | Ninguna celda factible | *"If the T/W and W/S variations are wide enough, at least one of the aircraft will meet all performance requirements"* ⇒ ampliar el rango |
| CP-2 | El óptimo cae **fuera** de la malla | Extrapolación no creíble ⇒ recentrar la matriz en el óptimo y recorrer |
| CP-3 | El óptimo **no** está en un cruce de restricciones | Sospechoso: revisar si alguna restricción falta (Kuhn–Tucker). Ver §4.2 |
| CP-4 | Alguna variante viola el gate de densidad | Marcar "no creíble" en la gráfica, con la cita del realism factor |
| CP-5 | El óptimo pesa **más** que el baseline | **Mostrar qué requisito violaba el baseline** (caso DR-3: la aceleración) |

#### 9.5.2 Método 2 — ANIDAMIENTO (la regla cara, pero obligatoria)

> *"The T/W–W/S carpet plot is described above as the 'granddaddy' of all trade studies. When doing trade
> studies of other variables as shown in Table 19.1, **each parametric variation of those other variables
> should be calculated using a complete T/W–W/S carpet plot for each data point. Otherwise, the answers
> aren't believable because the initial values of T/W and W/S might be forcing the answer to a non-optimal
> direction.**"*

Ejemplo aritmético que el libro entrega:
```
optimizar A solo:      3 valores de A × 9 puntos de carpet =  27 aviones
optimizar A y Λ:       9 combinaciones × 9 puntos          =  81 aviones ("What a lot of work!")
los 6 básicos:         3⁶                                   = 729 aviones (mínimo)
                       5⁶                                   = 15,625 ("would be better")
```
Y la pregunta del cliente: *"**How do you draw a six-dimensional carpet plot?**"*

⭐ **AQUÍ ES DONDE GANAMOS.** Esta regla es la razón por la que Raymer, a mano, **no puede** hacer lo correcto,
y por la que se resigna a los métodos de la §9.5.3. **Para nosotros 729 lazos de sizing son sub-segundo.**
La regla que el cliente enuncia como ideal inalcanzable es nuestro **default**.
⇒ **Requisito N-01: el anidamiento completo es el comportamiento por DEFECTO, no una opción experta.**
⇒ **Requisito N-02: el software reporta el conteo de aviones analizados**, para que el ingeniero vea que se
respetó la regla (`"81 aviones completos, 9 carpet plots"`).

#### 9.5.3 Método 3 — SUPERFICIE DE RESPUESTA

> *"the multivariable parametric data as already discussed can be fit to an approximating multidimensional
> surface equation called a 'response surface,' which can then be mathematically or numerically solved for an
> optimum."* + *"Actually, the classic aircraft design carpet plot described above **is** a graphically fit
> response surface but limited to three dimensions (two variables and the measure of merit)."*

| # | Requisito | Cita |
|---|---|---|
| RS-1 | **Grado ≥ 3, default 4** | *"if the equation form of the RS is lower than third degree, any reflexes in the actual surface will be smoothed over and **the answer will be wrong**. Fourth or fifth degree would be even better, but the calculation time goes up dramatically."* |
| RS-2 | Reportar el **residual del ajuste**, y rechazar la superficie si el óptimo cae donde el ajuste es pobre | [EXTENSIÓN DECLARADA: el libro no lo pide, pero sin esto el RS-1 no es verificable] |
| RS-3 | ⭐ **Aceptar puntos evaluados FUERA del sistema** | *"the design points are selected and evaluated external to, and prior to, the optimization. This makes it possible to select design points and **have real engineers working offline do the design and analysis work**... One company goes so far as to have designers prepare initial layouts of dozens of different aircraft concepts spanning the range of parametric design variables. These are then analyzed, fit to a response surface, and an optimum is determined."* ⇒ **importar/exportar una tabla de puntos es un requisito, no una comodidad** |
| RS-4 | Beneficio declarado a preservar | *"RS has a further advantage of naturally smoothing out numerical noise resulting from the parametric analysis."* |

#### 9.5.4 Método 4 — GRADIENTE EXHAUSTIVO CON REDUCCIÓN DE PASO (el del propio Raymer)

**Es el que el cliente dice que le funcionó.** Implementable literal:
```
FUNCIÓN gradienteExhaustivo(baseline, variables, paso_inicial, resolucion)
  centro ← baseline ; paso ← paso_inicial
  REPETIR:
     variantes ← {}
     PARA cada variable v en variables:
        variantes ← variantes ∪ { centro con v+paso, centro con v−paso }
     PARA cada variante: analizarVariante(...)        // aero, pesos, sizing, COSTO y desempeño
     mejor ← la variante con MENOR medida de mérito QUE CUMPLE TODOS LOS REQUISITOS
     SI mejor es mejor que centro:  centro ← mejor ; CONTINUAR
     SI NO:                          paso ← paso/2
     HASTA que paso < resolucion
  RETORNA centro
```
Cita literal: *"Each variable is parametrically varied by plus and minus some selected 'step size,' and the
resulting aircraft are all analyzed for aerodynamics, weights, sizing, cost, and performance. The 'best'
variant, that with the lowest value of the selected measure of merit, **which also meets all performance
requirements**, is remembered and, when all parametric variations about the initial baseline are exhausted,
becomes the center point baseline for the next iteration loop. This continues until no better variant is
found, then the stepping distance is shortened and the process repeated until some desired level of
resolution is obtained."*

**Ojo con la restricción incrustada:** *"which also meets all performance requirements"* — es un
**pattern search FACTIBLE**: las variantes infactibles se descartan, no se penalizan. Eso importa: un método
de penalización daría otro óptimo.

#### 9.5.5 Los demás métodos del catálogo

| Método | Estado recomendado | Cita que lo justifica |
|---|---|---|
| **Latin squares** | Ofrecer como acelerador | *"Latin squares tells you which data points to skip and how to approximate the results that the skipped points would have provided... analogous to the old sizing expert's trick—surprisingly good—of drawing a family of curves from five data points."* |
| **Finite difference** | Ofrecer | *"the change in the measure of merit... is used to define a slope (first derivative) of the 'system response'... iteration is used to drive out the obvious linearization errors."* ⚠️ **Falla en el escalón del diseño derivativo (§2.11)** |
| **Implicit Function Theorem** | Fuera de alcance v1 | Exige diferenciar las ecuaciones de gobierno |
| **Decomposition** | Arquitectura, no método | *"an aerodynamics module that knows how to calculate drag and airloads if it knows the wing shape, and a structures module that knows how to calculate weight and structural deflections if it knows the airloads. Each executes separately, passing their results to the other until they converge"* ⇒ **es la descripción de nuestra CAPA 2** |
| **Algoritmos genéticos** | Opcional, con la advertencia visible | *"This is presumed to represent an optimum (**but occasionally it doesn't**—the subject of much research today)."* ⇒ si se implementa, **corridas múltiples con semillas distintas y reportar la dispersión** |

### 9.6 CAPA 5 — el gobierno: dónde el software propone y el ingeniero decide

Esta capa es la que separa nuestro producto de un solver. **Está construida sobre las tres objeciones (§4.1).**

| # | Requisito de gobierno | Objeción que responde |
|---|---|---|
| GOB-1 | **Restricciones editables EN VIVO**, a mitad de un estudio, sin perder los resultados ya calculados | §4.2 — Raymer inventó una restricción a mitad del DR-1 |
| GOB-2 | **Detección de óptimo no acotado**: si el óptimo cae en el borde del rango de una variable, decirlo explícitamente y **sugerir la familia de requisito que falta**, sin elegir el número | §4.2 |
| GOB-3 | **Dos clases de línea de restricción**: `REQUISITO` (dura) vs `OPTIMIZACIÓN` (blanda, ignorable). Dibujarlas distinto. *"aerodynamic optimizations, not firm requirements... they can be ignored"* | J-11 |
| GOB-4 | **Explicabilidad total**: por cada punto de la malla, el usuario puede abrir el desglose de pesos, la traza de sizing por segmento y el desglose de costo. **Nada es una caja negra** | Objeción 3 |
| GOB-5 | **Costo de agregar una configuración nueva ≈ cero.** Un canard-pusher o un joined wing debe poder entrar al modelo en minutos, no semanas | ⭐ Objeción 3 — *"a dampener on the essence of aircraft conceptual design"* |
| GOB-6 | El resultado se presenta como **instrucción de rediseño**, no como veredicto: *"quickly tell the aircraft designer how to change the design layout to make it better"* y *"as only one of many 'inputs'"* | §19.6 |
| GOB-7 | **Botón de "redibujar el as-optimized"** al final del estudio, con el recordatorio: el propio autor se pone "B" por no hacerlo | §24.1 |
| GOB-8 | **Gate de creencia**: si el estudio se corrió con pesos estadísticos (pre-layout), marcar todo el resultado como NO CREÍBLE con la cita: *"don't believe it until you've redone the optimization using parameters taken from the real design layout"* | J-10 |
| GOB-9 | **Registro de calibración** para diseño derivativo: el software permite el *"tweaking and fudge-factoring"* pero **deja constancia** de cada factor aplicado | J-14 |
| GOB-10 | **La misión es ficción, y el software lo sabe**: ofrecer optimizar contra **más de una misión** y mostrar la sensibilidad. *"there has probably never been a case of an aircraft flying its 'design mission.'"* Casos citados: F-4 y F-16 | Objeción 1 |

### 9.7 El módulo de costo dentro del optimizador

```
FUNCIÓN costoDeVariante(avion, escenario) → BandaDeCosto
   We_DCPR ← We − (ruedas, frenos, llantas, motores, arrancadores, fluidos, vejigas,
                    instrumentos, baterías, fuentes eléctricas, aviónica, armamento,
                    control de tiro, aire acondicionado, APU)          // 60–70% de We
   horas   ← { H_E, H_T, H_M, H_Q }  de las ecs. (18.1)–(18.4)
   costos  ← { C_D, C_F, C_M } de (18.5)–(18.7) + C_eng·N_eng + C_avionics + C_interiores
   fudges  ← material × modernidad(1.2) × clase(0.9 comercial | 0.25 GA)
   RETORNA { lo, nominal, hi }  ×  investment_factor(1.1–1.4)  ×  escalación(año_base)
```
| # | Requisito | Fuente |
|---|---|---|
| K-01 | **Banda siempre**, nunca un escalar | §2.1 |
| K-02 | `Q` = min(cantidad total, cantidad en 5 años) — pedir ambos | §18.4 |
| K-03 | Etiqueta de agrupación obligatoria y **rechazo de comparaciones cruzadas** | §18.1 |
| K-04 | Año-base obligatorio; escalación por CPI (default) o por Federal Price Deflator | §18.4 |
| K-05 | Método alterno de peso-por-componente disponible siempre (50/90 h/lb), **preferente para prototipos y X-planes** | §18.3 |
| K-06 | Sanity check contra la banda de $/lb por clase; **advertir** si sale fuera | §18.3 |
| K-07 | Modo derivativo: **prohibir la resta** de dos corridas de DAPCA, con la cita | §23.12 |
| K-08 | El costo entra al optimizador como medida de mérito **o** como restricción dura (CAIV) | §19.7 |

### 9.8 Contra qué se verifica el motor completo — el plan de aceptación

| Orden | Gate | Fixture | Qué prueba |
|---|---|---|---|
| 1 | **El lazo converge** | `raymer-24-acsize-relajacion` (15 filas) + `raymer-24-dr1-fixed-engine` (3 filas) + DR-3 (25+ filas) | El punto fijo, la relajación 0.8, la bifurcación rubber/fijo |
| 2 | **Los gates del lazo disparan** | `raymer-24-dr3-mission-fractions` (14 segmentos, todos en [0.9,1.0]) | S-02 no da falso positivo; el tramo con `1.0000` pasa; el drop de 400 lb se resta |
| 3 | **DAPCA es aritméticamente correcto** | `500^0.163 ≈ 3` + banda de $/lb + CER de una línea | La única validación que el autor da |
| 4 | **Los gates de costo disparan** | `raymer-18-f15-f16-constant-dollars` | Que el comparador no mienta por un factor de 2 |
| 5 | **La matriz de sizing y sus restricciones** | `raymer-19-fig19.1-sizing-matrix` (3×3) | El caso mínimo del algoritmo completo |
| 6 | **El carpet plot 5×5 con 7 restricciones** | `raymer-24-dr3-carpet-25` | 25 variantes, reglas de escalado, el óptimo en el cruce Landing×Accel |
| 7 | **El requirements trade** | 30 s → 50 s ⇒ `19,300 → 15,600 lb` (−19%) | Que relajar un requisito mueva el óptimo al otro cruce |
| 8 | ⭐ **El optimizador multivariable RESTRINGIDO** | `raymer-24-dr3-mvo` | `15,242 lb` **y exactamente tres restricciones activas**. Kuhn–Tucker como test |
| 9 | **La optimización con motor FIJO (ejes distintos)** | `raymer-24-dr1-matriz-WS-A` ⇒ `W/S 10.23, A 5.2, W₀ 1180 lb` | Que los ejes no estén cableados a T/W×W/S |
| 10 | **El óptimo no acotado** | El mismo DR-1, **quitando** la restricción de viraje | Que el software detecte y reporte la falta de cota en `A` en vez de devolver el borde |
| 11 | **El gate de densidad** | Un trade study de "dos misiles más" sobre el DR-3 | Que la variante falsa se marque "no creíble" |
| 12 | **El photo-scale** | `raymer-19-photoscale-drag` (100 → 120 counts) + el exponente −0.06 → −0.31 | Que la corrección exista y que el exponente no esté cableado |
| 13 | **`K` no constante** | `raymer-24-dr3-ps-turn` (K con mínimo interior en n=3) | Que no cableaste `K = 1/(πAe)` |
| 14 | **El lazo eléctrico** | ecs. 20.6–20.11 con BMF **sumado** | Que `fraccionDeSegmento` sea inyectable |
| 15 | **El lazo de cohete** | ec. 22.13 como fracción de segmento | Lo mismo, con Δ-V en vez de alcance |

**Orden de construcción recomendado:** 1 → 2 → 5 → 6 → 8 → 3 → 4 → 11 → 9 → 10 → resto.
El gate 8 (MVO restringido) es el que declara el motor "terminado" para el caso térmico rubber;
el gate 11 (densidad) es el que lo declara **nuestro** y no de la competencia.

### 9.9 Lo que el libro NO nos da y hay que decidir nosotros

| Hueco | Qué falta | Propuesta `[EXTENSIÓN DECLARADA]` |
|---|---|---|
| **Criterio de paro del lazo** | El libro dice *"iterate until the calculated value equals the guess value"* — sin tolerancia | **0.1% de `W₀`**, deducido de las tres tablas del cap 24. Configurable |
| **El factor de relajación** | *"somewhere between the two"* | **0.8**, deducido y verificado en tres corridas del propio autor |
| **Regla de escalado para `A`, `Λ`, `λ`, `t/c`** | El libro da reglas para T/W y W/S; para las de planta alar **no**, porque a mano no se puede | **Es el hueco de mercado.** Lo resuelve la CAPA 1 con regeneración B-Rep paramétrica. Es literalmente el §2.3 del cliente |
| **Tolerancia del gate de densidad** | *"maintain the same internal density as the baseline"* — sin número. Y el autor cuenta que los gráficos de referencia de NAVAIR eran secretos: *"they declared that your design wouldn't work—but they wouldn't show you the magic graph!"* | Empezar en **±5%** y hacerlo configurable, mostrando el valor del baseline. **Nunca inventar una curva histórica** |
| **Un ejemplo resuelto de DAPCA** | No existe en el libro | Verificar solo contra `500^0.163 ≈ 3`, la banda de $/lb y la consistencia interna fps/mks |
| **Las ecs. 18.8, 18.10–18.13** | Ilegibles en el OCR | **Verificar contra el PDF antes de implementar.** Marcadas como no-fixture |
| **Cómo priorizar cuando dos medidas de mérito discrepan** | El libro solo dice que discrepan (el ala de alto alargamiento) | **Mostrar ambos óptimos en la misma gráfica** y dejar que decida el ingeniero (GOB-6) |
| **Cuántas misiones optimizar a la vez** | El libro dice que la misión de diseño es ficción, pero optimiza contra una sola | Ofrecer **multi-misión con pesos**, marcándolo como extensión nuestra |

---

## Índice de citas literales clave (para pegar en la UI)

| Contexto | Cita |
|---|---|
| Encabezado del cap 18 | *"Cost is the final measure of merit in aircraft design and optimization."* |
| Encabezado del cap 19 | *"Sizing is the heart of aircraft optimization—potential improvements must justify themselves by a better sizing result but without violating any requirements."* |
| Al abrir un carpet plot | *"This is the essence of aircraft optimization methods, which long predate Kuhn–Tucker."* |
| Al pedir un trade study de layout | *"If there were sufficient room in the baseline to fit two more missiles internally, then the baseline was poorly designed. If the baseline was already 'tight,' then the revised layout must be a fake!"* |
| Al entregar un óptimo | *"...as only one of many 'inputs.'"* |
| Al optimizar sin layout | *"don't believe it until you've redone the optimization using parameters taken from the real design layout."* |
| Al terminar un estudio | *"The 'A' students would... ultimately redraw the as-optimized aircraft to ensure that the analysis assumptions were realistic."* |
| Al mostrar un costo | *"There is no 'fundamental physics' to underpin the analysis."* |
| En el módulo de costos | *"Aircraft are bought by the pound."* |
| Cuando el usuario quiere optimizarlo todo | *"Such 'everything optimization' is neither feasible nor desirable."* |
| Cuando una fracción de segmento sale > 1.0 | *"you have probably used the wrong units somewhere or have forgotten the negative sign on an exponent!"* |
| Cuando el sizing se aleja > 30% | *"this author gets nervous at a takeoff-weight difference greater than about 30% of the as-drawn weight."* |

