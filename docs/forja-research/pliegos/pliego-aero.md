# PLIEGO AERO — "Raymer es el CLIENTE"
### Ejercicio de requisitos leyendo el diseño conceptual de aeronaves como una entrevista, no como un libro de texto
**Fecha:** 2026-07-31 · **Para:** La Forja (CAD/CAM en navegador, React + R3F + OCCT-WASM) · **Español mexicano**

---

## 0. QUIÉN HABLA Y CON QUÉ AUTORIDAD

Este pliego trata a los autores como el cliente que lleva 40 años haciendo esto **a mano** y que nos
contrató para construirle el software. Los libros no son material de estudio: son la **entrevista de
requisitos**. Cada "should", "typically", "historically", "rule of thumb" es un requisito funcional
dicho en prosa.

| Fuente | Quién es | Qué aporta |
|---|---|---|
| **Daniel P. Raymer, *Aircraft Design: A Conceptual Approach*, 6ª ed. (AIAA, 2018), 1097 pág, 24 caps** | **EL CLIENTE PRINCIPAL.** Diseñador conceptual real ("blank-sheet-of-paper designs for over 40 years"), lideró el diseño del vehículo del X-31, autor del software RDS-Professional. El libro *es* el proceso | El PROCESO completo: requisitos → sizing → T/W y W/S → layout → análisis → optimización. Caps 2, 3, 5, 6, 19 y 24 son el corazón |
| **John D. Anderson, *Fundamentals of Aerodynamics*, 6ª ed. (2017), 1154 pág, 20 caps** | El teórico canónico | De dónde salen los coeficientes: potencial, perfil delgado, paneles, línea sustentadora, compresibilidad, capa límite, supersónico. Los ejemplos numéricos son fixtures de test |
| **John J. Bertin & Russell Cummings, *Aerodynamics for Engineers*, 6ª ed. (2022), 844 pág, 14 caps** | El complemento aplicado | Vortex-lattice trabajado, capa límite práctica, high-lift, deltas, diseño de cazas |

> **Nota de honestidad sobre la autoridad del cliente.** Raymer no vende los métodos como exactos.
> Los vende como **suficientes y auditables**: *"they are good enough to be used to check the results
> of the sophisticated computerized methods, and if they are far apart, the computer results are
> probably wrong!"* (§1.4). Ese es exactamente el rol que queremos para el módulo: **el detector de
> mentiras del CFD**, no su sustituto.

> **Y el cliente ya tiene opinión sobre NUESTRO producto.** §2.1.4 y §2.3, sobre CAD en diseño
> conceptual: *"This emphasis on trade studies and alternative design concepts poses a problem for
> high-end CAD systems. They are too good! Typically, they've been tailored for production part
> design, not the 'everything will change' environment of conceptual design."* Y el requisito
> explícito: *"a CAD capability to change the wing's sweep and automatically revise the geometry of
> the spars and ribs accordingly would be of tremendous use. The wing sweep will probably change
> after every optimization study or wind-tunnel test. The CAD system should make this easy."*
> Traducción: **el cliente pide un CAD paramétrico de conceptual, no un modelador de piezas.**
> Es literalmente el hueco de mercado que La Forja puede ocupar.

---

## 1. EL PROCESO A MANO DE RAYMER

### 1.1 Las tres fases y por qué importan para el software

§2.2, Fig. 2.2. Tres fases con **metas, métodos y hasta gente distinta**:

```
REQUISITOS
   │
   ▼
CONCEPTUAL DESIGN   ¿qué requisitos mandan? ¿cómo debe verse? ¿peso? ¿costo?
   │                ¿qué trade studies? ¿qué tecnologías? ¿es viable Y vendible?
   │                → semanas a ~6 meses. MUCHOS conceptos alternativos.
   ▼
PRELIMINARY DESIGN  congelar la configuración; desarrollar el LOFT (superficie);
   │                base de datos de prueba y análisis; diseñar los ítems mayores;
   │                costo estadístico real ("You bet your company!")
   ▼
DETAIL DESIGN       diseñar las piezas reales, herramental, proceso de fabricación
   │                (NOW you learn the real numbers!)
   ▼
FABRICACIÓN
```

La advertencia de la portadilla del capítulo, palabra por palabra:

> *"If you do the right thing in the wrong phase, it's the wrong thing."*
> *"Those who don't understand this always want to jump to detail design too early — ensuring disaster."*

**Requisito de software que sale de aquí:** el módulo de aero NO debe pedirle al alumno/usuario
geometría de detalle. En conceptual, *"the landing gear may be shown only as a circle for the tire
and a stick for the gear leg"* (§2.2.1), y el larguero delantero *"is 'designed' as nothing more
than a flat plate from root to tip"* (§2.2.1). **Fidelidad de representación por fase.**

### 1.2 La secuencia real del diseño conceptual (Fig. 2.4) — el grafo que hay que implementar

```
Design requirements ─┐
Technology availbty ─┼──► CONCEPT SKETCH ──► FIRST-GUESS SIZING (cap 3)
New concept ideas ───┘         │                    │
                               ▼                    ▼
                          INITIAL LAYOUT  ◄──  (Dash-One: geometría, tres vistas)
                               │
                               ▼
                          INITIAL ANALYSIS  (aero, pesos, propulsión)
                               │
                               ▼
                          SIZING & PERFORMANCE OPTIMIZATION (caps 5, 6)
                               │
                               ▼
                          REVISED LAYOUT (Dash-Two)  ◄── requirements tradeoffs (lazo largo)
                               │
                               ▼
                          ANÁLISIS COMPLETO (aero, pesos, propulsión, estabilidad,
                               │              estructuras, costo, subsistemas)
                               ▼
                          REFINED SIZING & PERFORMANCE OPTIMIZATION (cap 19)
                               │
                               ▼
                          PRELIMINARY DESIGN
```

**El lazo de requisitos es EXPLÍCITO y corre en paralelo a todo:** la flecha punteada
*"requirements tradeoffs"* de la Fig. 2.4 va del análisis de vuelta a los requisitos. §2.1:
*"Whatever you think the design requirements should be on that first day of the project, you can be
certain that they will have changed before the airplane flies."*

### 1.3 El orden en que se estima cada cosa, y con qué regla de dedo

Esta es la respuesta directa a *"¿qué se estima primero, con qué regla de dedo, y qué lo cierra?"*:

| # | Qué | Con qué | Qué lo cierra | § |
|---|---|---|---|---|
| 1 | **Los requisitos** | Cliente, análisis de mercado, FAR 23/25, EASA CS, Mil-Specs, "o invéntalos" | Nada — evolucionan todo el proyecto | §2.1 |
| 2 | **Aspect ratio A** | Se **selecciona** de datos históricos por tipo (Tabla 4.x) | Trade study del cap 19 | §3.4.4, cap 4 |
| 3 | **Relación de área mojada S_wet/S_ref** | **A OJO ("eyeball") desde el croquis**, comparando con el espectro de la Fig. 3.6 (rango real ≈ 2.2 delta … 6.2 convencional) | El layout real, midiendo el área mojada del CAD | §3.4.4 |
| 4 | **Aspect ratio mojado A_wet** | `A_wet = b²/S_wet = A / (S_wet/S_ref)` | — | Ec. (3.11) |
| 5 | **L/D_max** | `L/D_max = K_LD·√A_wet` con K_LD = 15.5 jet civil / 14 jet militar / 11 prop retráctil / 9 prop fijo / 13 alto AR / 15 planeador | Cálculo de arrastre del cap 12 sobre el layout | Ec. (3.12), Fig. 3.5 |
| 6 | **L/D de crucero y de loiter** | Jet: crucero 0.866·L/D_max, loiter L/D_max. **Prop: al revés** — crucero L/D_max, loiter 0.866·L/D_max | Cap 17 | §3.4.5 |
| 7 | **SFC** | Tabla 3.3 (jet) / 3.4 (prop) por tipo de motor y por segmento | Datos reales del fabricante; cap 13 instalado | §3.4.3 |
| 8 | **Fracciones de segmento W_i/W_{i−1}** | Históricas para warmup+takeoff (0.970), climb (0.985), landing (0.995); **Breguet** para crucero, **endurance** para loiter | Cap 6 (métodos refinados) y cap 17 | Tabla 3.2, Ecs. (3.6) (3.8) |
| 9 | **Fracción de combustible W_f/W_0** | `1.06·(1 − W_x/W_0)` — el 6% cubre reserva + atrapado | Cap 6: 5% reserva + 1% atrapado por separado | Ec. (3.13) |
| 10 | **Fracción de vacío W_e/W_0** | `A·W_0^C·K_vs` — 16 clases de avión en la Tabla 3.1 | Cap 15: suma componente por componente | Tabla 3.1 |
| 11 | **W_0** | **EL LAZO DE PUNTO FIJO** (§1.4 abajo) | Converge en pocas vueltas | Ec. (3.4) |
| 12 | **T/W (o P/W)** | Máximo de: (a) estadístico `T/W = a·M_max^C` (Tabla 5.3/5.4) y (b) **thrust matching** `T/W = 1/(L/D)_crucero` ajustado a takeoff | Restricciones de desempeño del cap 17 | §5.2 |
| 13 | **W/S** | **EL MÍNIMO** de todos los W/S que salen de: pérdida, despegue, aterrizaje, catapulta, viraje instantáneo, viraje sostenido, ascenso, techo, crucero, loiter | Optimización conjunta T/W × W/S del cap 19 | §5.3, §5.4 |
| 14 | **Geometría** | S = W_0/(W/S); T = W_0·(T/W); longitud de fuselaje `L = a·W_0^C` (Tabla 6.3); colas por coeficiente de volumen | El layout | §6.5 |
| 15 | **El layout (Dash-One)** | Se DIBUJA | Todo lo anterior se recalcula sobre él | cap 7 |

**El punto que una máquina lineal no ve:** los pasos 2 y 3 son **selecciones humanas a ojo**, no
cálculos. Todo el edificio numérico posterior cuelga de un "eyeball estimate" de la relación de área
mojada sobre un croquis de servilleta. Raymer lo dice sin pudor (§3.4.4):
*"Wetted area ratio can be 'eyeball' estimated from the sketch, using Fig. 3.6 for guidance."*

### 1.4 ⭐ EL LAZO DE CONVERGENCIA DE PESO — punto fijo explícito

Este es **el lazo de Kazmer del mundo aeronáutico**: una ecuación implícita en W₀ que se resuelve
iterando, con una regla de relajación dicha en prosa.

**La ecuación.** §3.2, el balance:

```
W0 = W_crew + W_payload + W_fuel + W_empty
```

Pero `W_fuel` y `W_empty` **dependen de W₀**. Se expresan como fracciones y se despeja:

```
                W_crew + W_payload
W0  =  ──────────────────────────────────────        ... Ec. (3.4)
        1 − (W_f/W0) − (W_e/W0)
```

Con `W_e/W0 = A·W0^C·K_vs` (Tabla 3.1, C **siempre negativo**), la ecuación es
**implícita en W₀ → punto fijo**. Raymer lo declara sin rodeos (§3.2):

> *"The crew and payload weights are both known because they are given in the design requirements.
> The only unknowns are the fuel weight and empty weight. However, they are both dependent on the
> total aircraft weight. Thus, an iterative process must be used for aircraft sizing."*

**El algoritmo tal cual lo dicta (§3.5):**

> *"This is done by guessing the takeoff gross weight, calculating the statistical empty-weight
> fraction, and then calculating the takeoff gross weight. If the result doesn't match the guess
> value, a value between the two is used as the next guess. This will usually converge in just a
> few iterations."*

En pseudocódigo:

```
W0 ← adivinanza inicial
repetir:
    We_frac ← A · W0^C · K_vs          # estadístico, C<0
    W0_calc ← (W_crew + W_payload) / (1 − Wf_frac − We_frac)
    si |W0_calc − W0| < tol: salir
    W0 ← relajación(W0, W0_calc)       # "a value between the two"
```

**La relajación NO es 0.5 en el método refinado.** §6.3.7, la regla de dedo del cliente:

> *"Experience indicates that the solution will converge most rapidly if the new guess for W0 is
> about three-fourths of the way from the initial guess to the calculated W0 value."*

Es decir `W0_nuevo = W0 + 0.75·(W0_calc − W0)` — **sobre-relajación ω = 0.75**, no bisección.
Un implementador ingenuo pondría ω = 0.5 o Newton; el cliente ya midió que 0.75 converge más rápido.

**El criterio de paro** (§6.2): *"the solution is iterated until the two are approximately equal to
within a few percent."* Unos pocos por ciento — no 1e-9. Es un método de conceptual.

**⭐ La condición de existencia que rompe el solver si la ignoras.** §3.3, sobre ajustar tu propia
curva estadística:

> *"If using curve-fit software be careful — it may return a positive exponent depending upon the
> exact data you've fed it. Don't use that result — it isn't 'real world' and the sizing equation
> will not converge. Instead force the software to use a negative number 'C' term."*

Un exponente C positivo hace que W_e/W₀ **crezca** con W₀ y el punto fijo diverge. Este es un
**gate duro de validación de datos de entrada** que un programador que solo lee las fórmulas jamás
implementaría.

**El método gráfico alternativo (§3.6.4, Fig. 3.11)** — vale la pena implementarlo porque es
didáctico y a prueba de divergencia: graficas `W0_calculado` vs `W0_adivinado`, trazas la recta de
45° desde el origen, y **la intersección es la respuesta**. Es el mismo punto fijo, visto como
gráfica de telaraña. Para la Escuela vale más que el iterador.

### 1.5 El "efecto palanca" — por qué el sizing es la calculación más importante

§3.6.6, el hallazgo del trade de materiales compuestos:

> *"The use of composite materials reduces the takeoff gross weight from 56,702 lb to only 51,585 lb
> ... This is a 9% takeoff-weight savings, resulting from only a 5% empty-weight saving. This result
> sounds erroneous, but is actually typical of the 'leverage' effect of the sizing equation.
> Unfortunately, this works both ways."*

**5% de peso vacío ⇒ 9% de peso de despegue.** El denominador `1 − Wf/W0 − We/W0` amplifica.
Y la consecuencia operativa: *"it is crucial that realistic estimates of empty weight be used during
early conceptual design, and that the weight be strictly controlled during later stages."*

Este es el **growth factor** y debería ser una salida de primera clase del módulo, no un
subproducto: ∂W₀/∂W_payload y ∂W₀/∂W_empty calculados numéricamente alrededor del punto convergido.

### 1.6 El método refinado (cap 6) — qué cambia

§6.3.2 en adelante. La diferencia estructural:

- Cap 3: multiplicas TODAS las fracciones de segmento y sacas una sola fracción de combustible.
- Cap 6: **caminas la misión segmento por segmento**, calculando el combustible quemado en cada uno
  y restándolo del peso corriente. Ec. (6.5): `W_fi = (1 − W_i/W_{i−1})·W_{i−1}`, y
  `W_fm = Σ W_fi`.

Por qué importa: el método del cap 3 **no admite soltar carga** (bombas, paracaidistas) y **asume
T/W constante** (§6.3.1: *"buried in the math is the assumption that T/W is being held constant, so
it isn't very accurate when used for fixed-engine sizing"*). El del cap 6 sí.

Y el combustible total ya no es un 6% de bulto: §6.3.3, `W_f = 1.06·W_fm` se descompone en
**5% de reserva** (motor con peor consumo del nominal) **+ 1% de atrapado** (no bombeable).

**Fracciones refinadas del cap 6** (reemplazan las de la Tabla 3.2):

| Segmento | Fracción | § |
|---|---|---|
| Arranque, taxi y despegue | 0.97 – 0.99 | Ec. (6.8) |
| Ascenso+aceleración subsónico a Mach M | `1.0065 − 0.0325·M` | Ec. (6.9) |
| Ascenso+aceleración supersónico | `0.991 − 0.007·M − 0.01·M²` | Ec. (6.10) |
| Descenso | 0.990 – 0.995 | Ec. (6.22) |
| Aterrizaje y taxi de regreso | 0.992 – 0.997 | Ec. (6.23) |

**⭐ Regla de composición que se salta cualquiera:** si la aceleración no empieza en Mach 0.1,
**divides** la fracción del Mach final entre la del Mach inicial. Raymer da el número:
Mach 0.1→0.8 da 0.9805; Mach 0.1→2.0 da 0.937; luego Mach 0.8→2.0 = 0.937/0.9805 = **0.956** (§6.3.9).

### 1.7 Motor "rubber" vs motor de tamaño fijo — el lazo cambia de variable

§6.2. Este es un requisito de arquitectura del solver, no un detalle.

- **Rubber engine** (motor nuevo, escalable): puedes sostener T/W en el valor que exige el desempeño
  mientras W₀ varía; el motor se estira. **Iteras sobre W₀ y cierras contra alcance Y desempeño a la vez.**
- **Fixed-size engine** (motor existente): T es constante, así que **T/W varía durante la iteración**.
  Y aparece el conflicto que Raymer declara sin adornos:

> *"You cannot guarantee both range and performance, unless you're willing to buy a bigger engine."*

Hay entonces **dos modos de solver distintos** (§6.4.1 y §6.4.2):

1. **"Mission range must be met"** → W₀ sale del combustible; el desempeño es **fallout**.
   Ojo: la Ec. (6.16) de quemado por tiempo (que asume T/W constante) **no sirve**; hay que usar la
   Ec. (6.24) `W_f = C·T·d` con T absoluto.
2. **"Performance must be met"** → el alcance es fallout, y el sizing se vuelve **trivial**:
   `W0 = N·T_por_motor / (T/W)` (Ec. 6.25). Luego se **invierte el lazo**: se fija W₀ como
   "adivinanza" permanente y se **varía el alcance** hasta que el W₀ calculado iguale al conocido.

**⭐ La inversión del lazo del modo 2 es el detalle que se salta una máquina lineal.** No es "resolver
para W₀"; es **resolver para R** con W₀ congelado, usando exactamente la misma maquinaria. El solver
tiene que estar escrito con la variable de convergencia parametrizada, no cableada a W₀.

§6.4.3 añade el tercer modo, el que más se usa en la práctica y en aviones eléctricos:
seleccionar primero un motor existente por costo/disponibilidad, estimar T/W por desempeño, sacar
W₀ con la Ec. (6.25) y descubrir el alcance al final.

### 1.8 Cómo se convierten los requisitos de desempeño en restricciones sobre T/W y W/S

§5.3 y §5.4. Este es el segundo motor de cálculo del pliego, y es un **problema de optimización con
restricciones en 2D** que se resuelve a mano tomando envolventes.

La receta declarada (§5.4):

> *"In the method presented here, an initial estimate of the thrust-to-weight ratio is made and then
> used to calculate the required wing loading to meet various performance requirements. From these
> wing loadings, the lowest should be selected to ensure that the wing is large enough for all flight
> conditions. Don't forget to convert all wing loadings to takeoff conditions prior to comparisons."*

Las restricciones, cada una con su ecuación:

| Restricción | Ecuación | Notas del cliente |
|---|---|---|
| **Velocidad de pérdida** | `W/S = ½·ρ·V_stall²·C_Lmax` (5.6) | ρ = 0.00238 slug/ft³ {1.23 kg/m³} a nivel del mar, o el valor de día caliente a 5000 ft (0.00189 {0.974}) *"to ensure that the airplane can be flown into Denver during summer"* |
| **Despegue** | `W/S = TOP·σ·C_Lto·(T/W)` (5.9) jet, `·(hp/W)` (5.8) prop | TOP de la Fig. 5.4. C_Lto = C_Lmax/1.21 porque despega a 1.1·V_stall |
| **Catapulta** | Ec. (5.10) | ρ = 0.00219 slug/ft³ {1.13} día tropical; V_end de la Fig. 5.5 |
| **Aterrizaje** | `S_landing = 80·(W/S)/(σ·C_Lmax) + S_a` {ft} (5.11) | S_a = 1000 ft aerolínea (3°), 600 ft GA motor cortado, 450 ft STOL (7°) |
| **Viraje instantáneo** | `W/S = q·C_Lmax/n` (5.20) | n del requisito de razón de viraje, Ec. (5.19) |
| **Viraje sostenido** | Ecs. (5.22) y (5.25) | Con la condición de existencia (5.26) |
| **Ascenso / planeo** | Ec. (5.30) con G = gradiente | Con la condición (5.31): `T/W ≥ G + 2·√(C_D0/(π·A·e))` |
| **Techo** | Ec. (5.30) con G ≈ 0 (o G = 100 ft/min ÷ V para techo de servicio) | — |
| **Crucero óptimo** | Prop: `W/S = q·√(π·A·e·C_D0)` (5.13). Jet: `W/S = q·√(π·A·e·C_D0/3)` (5.14) | *"aerodynamic optimizations, not firm requirements"* |
| **Loiter óptimo** | Jet: (5.15) = misma forma que (5.13). Prop: (5.16) con factor /3 al revés | El jet loiterea a L/D_max; el prop a inducido = 3× parásito |

**⭐ La regla que hace esto no-lineal como proceso:** si un W/S sale ridículamente bajo por UNA sola
restricción, **no se acepta — se cuestiona el requisito o se cambia el avión**. §5.3.1:

> *"If an unreasonably low wing loading value is driven by only one of these performance conditions,
> the designer should consider another way to meet that condition. For example, if the wing loading
> required to meet a stall speed requirement is well below all other requirements, it might be better
> to equip the aircraft with a high-lift flap system."*

Y §5.4: *"if these drive the wing loading to ridiculously low values, they can be ignored."*
Un optimizador que solo toma el mínimo **produce un avión estúpido**. El software tiene que
**mostrar la envolvente completa con quién manda en cada tramo** y dejar que el humano vete.

**⭐ La coherencia de condiciones es un invariante duro.** Cada W/S y cada T/W se calcula en una
condición de vuelo distinta (peso de combate ≈ 0.85·W₀, peso de aterrizaje ≈ 0.85·W₀ para jets ≈ 1.0
para props y entrenadores, empuje de crucero 20–25% del de despegue en turbofán de alto bypass,
40–70% en bajo bypass/turbojet, eshp de crucero 60–80% del de despegue en turbohélice, 75% de
potencia en pistón). **Todo debe ratiarse a condiciones de despegue antes de comparar.** Un bug de
unidades o de condición aquí no revienta: da un avión plausible y equivocado.

### 1.9 ⭐ LOS DIEZ PASOS A MANO — el "Intermission" entre el cap 11 y el cap 12

Entre los capítulos 11 y 12 hay un capítulo sin número, el **INTERMISSION**, subtitulado
*"Design of a New Design"*, que es literalmente **el cliente describiendo su propio método
paso a paso**. Es el pasaje más valioso del libro para nosotros y es fácil de saltárselo porque no
está en el índice como capítulo numerado.

Empieza con dos advertencias que hay que respetar en el producto:

> *"the procedures presented next are only one designer's opinions and would be hotly debated by
> almost every other designer! Different designers have found different approaches that work best
> for themselves."*

> *"even for the same type of aircraft there are really no standard procedures for aircraft layout.
> Every aircraft demands its own procedure. ... This process is impossible to describe or teach and
> is only learned through practice and a high level of desire."*

Y aun así, lo describe. Los diez pasos:

| # | Paso | Qué se hace realmente |
|---|---|---|
| 1 | **Requisitos** | Necesidad operativa, cliente probable, cómo se opera. Valores duros: payload/pasajeros, alcance, distancias de despegue y aterrizaje, velocidades (máxima, crucero, pérdida o aproximación), razón de ascenso (incluido **motor fuera justo después del despegue**). Más los específicos de clase: ruido, dimensiones de cabina, puertas, descenso de emergencia (aerolínea); razón de viraje, aceleración, stealth y tamaño de antena → **que condiciona la forma del morro** (militar). Y **elegir la TAD (technology availability date)** |
| 2 | **Juntar los datos** | Geometrías y pesos de TODO lo que va adentro: APU, asientos, contenedores, bombas, cañones, galleys, baños. Motores candidatos con geometría, peso y desempeño. Ponerse al día en aero, estructuras, control de vuelo, stealth |
| 3 | **Croquis de concepto (varios)** | *"Do not begin a design project thinking that you know the right approach. Look at many possibilities, sketch up alternatives, and if possible, do several competing initial designs."* El croquis sirve para fijar la visión, decidir dónde va cada cosa, **y estimar pesos y arrastres para el sizing** |
| 4 | **Sizing inicial** | W₀ y W_fuel (caps 3 y 6), T/W y W/S (cap 5), geometría de ala (cap 4), tamaño de llantas (cap 11), volumen de tanques y área de captura del ducto o diámetro de hélice (cap 10). Y **la posición en % de cuerda de los largueros delantero y trasero**, "based on history and conversations with structures and aerodynamics experts" |
| 5 | **Empezar el layout** | Se calcula y se traza la **geometría trapezoidal de referencia del ala**, y se coloca respecto al c.g. deseado para la estabilidad buscada. Se aproxima dónde empieza y acaba el fuselaje. Se meten los componentes más grandes. La longitud de fuselaje sale de la Tabla 6.3 y **se modifica conforme el dibujo avanza**. Con la longitud aproximada ya se dimensionan las colas por coeficiente de volumen. **El tren de aterrizaje se ubica lo antes posible** |
| 6 | **Esquema de loft** | Elegir **número y ubicación de las estaciones de control** (las secciones que DEFINEN la forma; las demás salen por fairing). Y el número y tipo de curvas por sección, que fija el número de líneas de control longitudinales / de parches del CAD |
| 7 | **Tren y sistemas** | Detallar tren, aviónica, payload, AMAD, sistema de combustible |
| 8 | **Terminar el layout** | Tabular en el dibujo (o adjunto al archivo CAD) los parámetros geométricos de ala y colas, W₀ estimado, peso y volumen de combustible, tipo y tamaño de motor, área de captura, geometría de hélice |
| 9 | **Analizar el layout** | Áreas mojadas, áreas de planta expuestas, distribución de volumen, volúmenes de combustible, y "numerous lengths and other measurements needed for analysis" |
| 10 | **Preparar la SIGUIENTE iteración** | Ver abajo |

**⭐ Requisito duro de diseño de la UI que sale del paso 6, y que un implementador de CAD nunca
adivina:** *"A minimum number of control stations should be used to avoid excessive 'wiggling' of
the resulting longitudinal contours"* y *"avoid a large number of defining curves to avoid
wiggling."* El cliente pide **pocos grados de libertad a propósito**. Un sistema que deja al usuario
meter 40 secciones produce una superficie fea y él lo sabe. Es lo contrario del instinto de un
programador de CAD ("más control = mejor").

**⭐ Y el paso 7 trae la advertencia operativa más concreta del libro:** *"If the designer has not
already planned for locating the landing gear before the loft scheme is defined, there is an
excellent chance that it won't fit. Don't let that be you."* Reforzado en el resumen del cap 11:
*"Landing gear, which should be a straightforward bit of mechanical engineering, can destroy your
design layout! ... The down position is almost fully constrained, and a 'home for the gear' in the
up position is often difficult to find. Plan ahead."*

**El paso 10, la cultura del proyecto, dicha completa:**

> *"The designer should now immediately begin preparations for redrawing the aircraft for the next
> design iteration. What didn't work out so well on the first drawing? Is the landing gear as simple
> as it could be? Did you have to use any design 'tricks' to make something fit? Could the fuselage
> be made shorter, or could the wetted area be reduced some other way? Does the design have growth
> potential, or would a future fuselage stretch be impossible due to, say, tail-down ground angle?
> **Do not 'fall in love' with your design** — there is always room for improvement."*

Y la expectativa realista sobre el resultado del primer dibujo:

> *"The analysis process as discussed in the next chapters will result in a revised sizing
> calculation that will almost always tell you that the design you drew doesn't really work!"*

Y el criterio de calificación del profesor, que es el criterio de calidad del producto:

> *"'my plane is great, let's build it' rates a C. 'Here's what's wrong with it and here's how the
> next iteration will be better' gets the A. And the job."*

**Cuántas vueltas son "suficientes":** *"After perhaps 5–25 iterations, each one a full design layout
with analysis, optimization, and study by an expanding team of experts, you may finally have a design
good enough to believe it might be the 'right' answer."* Ese 5–25 es el número de diseño del producto:
**el ciclo completo tiene que ser barato, porque se corre 25 veces.**

### 1.10 El recheck obligatorio

§5.4, la última vuelta del capítulo:

> *"When the best compromise for wing loading has been selected, the thrust-to-weight ratio should be
> rechecked to ensure that all requirements are still met. The equations in the last section that use
> T/W should be recalculated with the selected W/S and T/W."*

Es decir: el sistema es **acoplado** y el barrido de W/S usó un T/W supuesto. Hay un **segundo lazo
de punto fijo T/W ↔ W/S** encima del lazo de peso.

---

## 2. LOS LAZOS ITERATIVOS DECLARADOS

Raymer no esconde las iteraciones: las nombra. Hay **seis lazos anidados**, y saber cuál es cuál es
la diferencia entre un solver que converge y uno que oscila.

```
LAZO 6 · REQUISITOS  ────────────────────────────────────────────────┐  (meses; humano + cliente)
  │  dispara: el avión sale absurdo, o muy caro, o no existe motor    │
  │  cierra: el cliente acepta relajar alcance/payload/velocidad      │
  ▼                                                                   │
 LAZO 5 · DASH-N  ───────────────────────────────────────────────┐    │  (5–25 vueltas; humano dibuja)
   │  dispara: el análisis "as-drawn" dice que el avión no cumple │    │
   │  cierra: alguien dice "enough!" → design freeze              │    │
   ▼                                                              │   │
  LAZO 4 · SIZING MATRIX / CARPET PLOT (cap 19)  ──────────┐      │   │  (decenas de corridas)
    │  dispara: querer el óptimo de T/W × W/S × A × ...     │      │   │
    │  cierra: el óptimo restringido en el carpet plot      │      │   │
    ▼                                                       │      │  │
   LAZO 3 · T/W ↔ W/S (§5.4)  ───────────────────────┐      │      │  │  (pocas vueltas)
     │  dispara: el barrido de W/S usó un T/W supuesto│      │      │  │
     │  cierra: recheck de todas las restricciones    │      │      │  │
     ▼                                                │     │      │  │
    LAZO 2 · PESO W0 (§3.5, §6.3.7)  ───────────┐     │     │      │  │  (3-6 vueltas)
      │  dispara: We y Wf dependen de W0        │     │     │      │  │
      │  cierra: |W0_calc − W0| < pocos %       │     │     │      │  │
      ▼                                         │     │     │      │  │
     LAZO 1 · MARCHA POR LA MISIÓN (§6.3.3) ─┐  │     │     │      │  │  (por segmento, sin iterar)
       resta combustible segmento a segmento │  │     │     │      │  │
     ◄────────────────────────────────────────┘  │     │     │      │  │
   ◄──────────────────────────────────────────────┘     │     │      │  │
  ◄───────────────────────────────────────────────────────┘     │      │  │
 ◄─────────────────────────────────────────────────────────────────┘      │  │
◄────────────────────────────────────────────────────────────────────────────┘  │
◄──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Tabla de disparadores y cierres

| Lazo | Variable de convergencia | Qué dispara la vuelta | Qué la cierra | Relajación / criterio |
|---|---|---|---|---|
| **1. Marcha por la misión** | ninguna (es un barrido) | — | fin del último segmento | — |
| **2. Peso W₀** | W₀ (o R si el motor es fijo y manda el desempeño) | W_e y W_f dependen de W₀ | `|W0_calc − W0| ≲ pocos %` | **ω = 0.75** hacia el calculado (§6.3.7); C del ajuste estadístico **debe ser negativo** o diverge |
| **3. T/W ↔ W/S** | el par (T/W, W/S) | el barrido de W/S supuso un T/W | *"the equations in the last section that use T/W should be recalculated with the selected W/S and T/W"* (§5.4) | a mano, pocas vueltas |
| **4. Sizing matrix** | los parámetros de diseño barridos | querer el óptimo, no solo lo factible | el óptimo restringido leído en el carpet plot | cap 19 |
| **5. Dash-N** | el dibujo completo | el análisis "as-drawn" contradice al sizing estadístico | design freeze | 5–25 vueltas |
| **6. Requisitos** | el pliego del cliente | el avión resultante no es viable ni vendible | acuerdo con el cliente | meses |

### 2.2 Los tres lazos "de disciplina" que cruzan el diseño (arrastre, peso, empuje)

Además de los seis anidados, el análisis del cap 12 en adelante cierra tres lazos disciplinares
sobre el mismo dibujo:

1. **Lazo de arrastre.** El sizing usó `L/D = K_LD·√A_wet` (estadístico, ojo sobre croquis). El cap 12
   lo recalcula por **component buildup** sobre el área mojada REAL del layout. Si el arrastre
   as-drawn es peor, sube el combustible y sube W₀ → vuelve al lazo 2.
2. **Lazo de peso.** El sizing usó `W_e/W0 = A·W0^C` (estadístico). El cap 15 lo recalcula
   **sumando los pesos de cada componente** del dibujo. §14/§15 lo dicen: si el peso vacío crece,
   por el efecto palanca W₀ crece **más que proporcionalmente**.
3. **Lazo de empuje.** El T/W estadístico se sustituye por el **empuje instalado** del cap 13
   (pérdidas de entrada, de tobera, de sangrado, de potencia extraída). El empuje instalado siempre
   es menor que el de catálogo → o crece el motor o baja el desempeño.

**⭐ Y hay un lazo de control que nadie espera:** §2.3 y §12.1. Las colas se dimensionaron con
coeficiente de volumen (estadístico). Cuando los especialistas de control corren el 6-DOF, pueden
**mandar agrandar una superficie de control**, y entonces:

> *"If a larger aileron is required, the designer must ensure that it can be incorporated into the
> design without adversely affecting something else, such as the flaps or the landing gear."*

Es un lazo **geométrico**, no numérico: agrandar el alerón le come envergadura al flap, lo que baja
C_Lmax, lo que sube el W/S requerido, lo que agranda el ala. Este acoplamiento **no vive en ninguna
ecuación del libro** — vive en el dibujo. Es exactamente el tipo de restricción que un CAD
paramétrico podría atrapar y una hoja de cálculo jamás.


---

## 3. REGLAS PRESCRIPTIVAS EN PROSA

Cada renglón es un requisito funcional dicho en inglés por el cliente. Formato:
**§ · frase corta en inglés · traducción · rango numérico si lo da.**

### 3.1 Caps 1–3 — proceso, sizing, fracciones

| § | En inglés (corto) | Traducción | Rango / valor |
|---|---|---|---|
| 2.0 | *"If you do the right thing in the wrong phase, it's the wrong thing."* | Hacer lo correcto en la fase equivocada es hacer lo incorrecto | — |
| 2.0 | *"Those who don't understand this always want to jump to detail design too early — ensuring disaster."* | Los que no entienden esto siempre quieren saltar al diseño de detalle demasiado pronto — desastre asegurado | — |
| 2.1 | *"If you don't have a customer who has carefully spelled out a proper set of aircraft design requirements, you need to get requirements — or make them up!"* | Si no tienes cliente con requisitos escritos, consíguelos — o invéntalos | — |
| 2.1 | *"Write these down — it is sometimes more difficult than you would think."* (los supuestos de alto nivel) | Escribe los supuestos: es más difícil de lo que crees | — |
| 2.1 | *"get to an initial layout quickly and use it to assess relative importance and finalize the requirements"* | Llega rápido a un layout inicial y úsalo para fijar prioridades y cerrar requisitos | — |
| 2.2.1 | *"the wise designer will also design several aft-tail concepts, and perhaps a tailless one, and let the numbers (not opinion, prejudice, or preconceived notions) make the final selection"* | Diseña también varios conceptos con cola atrás y quizá uno sin cola, y deja que **los números** elijan | ≥ 3–4 conceptos |
| 2.2.1 | Conceptual design *"can take as little as a week (done poorly!) or as much as several years"*; típico *"six months or so"* para un proyecto mayor | Duración del conceptual | 1 semana (mal) … ~6 meses (bien) … años |
| 2.2.2 | *"Preliminary design should take somewhere between a few months (done poorly) and perhaps two years"* | Duración del preliminar | meses … 2 años |
| 2.2.2 | *"Modern CAD systems have excellent data management tools — use them!"* | Usa la gestión de datos del CAD; sin ella, caos con varios diseñadores | — |
| 2.2.3 | *"Often to meet a schedule the fabrication of some parts must begin before detail design is completed. Sometimes this leads to changes in already fabricated parts or tools, at enormous expense. **Watch this carefully when you are managing a program.**"* | Fabricar antes de terminar el detalle cuesta carísimo cuando hay cambios | — |
| 2.2.3 | *"It may be as important to test the tooling as it is to test the prototype aircraft."* | Probar el herramental importa tanto como probar el prototipo | — |
| 2.3 | *"you never build the Dash-One"* | Nunca construyes el Dash-One; es la herramienta para hacer el Dash-Two | Dash-50 no es raro |
| 2.3 | *"CAD capabilities for rapidly locating rivets or cutter paths are worthless at this early stage"* | Las capacidades de remaches y trayectorias no valen nada en conceptual | — |
| 3.1 | *"Sizing is the most important calculation in aircraft design, more so than drag, or stress, or even cost."* | El sizing es **la** calculación más importante | — |
| 3.3 | Ala de flecha variable: multiplicar W_e/W₀ por **1.04**. *"Crude, but not too far off."* | Flecha variable pesa más | ×1.04 |
| 3.3 | Compuestos: *"we usually fake it"* — multiplicar por **0.95** | Compuestos, aproximación de conceptual | ×0.95 |
| 3.3 | *"it's always better to develop your own trendline"* con datos de aviones parecidos al tuyo | Ajusta tu propia curva estadística | — |
| 3.3 | ⭐ *"If using curve-fit software be careful — it may return a positive exponent... **Don't use that result** — the sizing equation will not converge. Instead **force** the software to use a negative number 'C' term."* | Exponente positivo ⇒ el lazo diverge. Fuerza C < 0 | C < 0 obligatorio |
| 3.3 | W_e/W₀ histórico: *"vary from about 0.3 to 0.7 and diminish with increasing total aircraft weight"* | Rango de la fracción de vacío | 0.30 – 0.70 |
| 3.4.1 | *"For safety you would be wise to carry extra fuel... a loiter of typically 20–30 min [at 10,000 ft]"* | Loiter de reserva | 20–30 min a 10,000 ft |
| 3.4.1 | FAA: **30 min** extra de crucero diurno VFR, **45 min** nocturno o IFR | Reservas legales | 30 / 45 min |
| 3.4.1 | *"the weapons drop... is often left out of the sizing analysis to ensure that the aircraft has enough fuel to return safely if the weapons are not used"* | No cuentes la suelta de armas: podría no ocurrir | conservador |
| 3.4.1 | Reabastecimiento en vuelo *"resets the clock"* — los tramos posteriores se tratan como misión aparte | Refuel = misión nueva | — |
| 3.4.2 | *"In our simple sizing method we ignore descent, assuming that the cruise ends with a descent and that the distance traveled during descent is part of the cruise range."* | El descenso se absorbe en el crucero | — |
| 3.4.3 | *"It is very important to use consistent units!"* — convertir todo a ft-lb-s o m-kg-s | Unidades consistentes, siempre | — |
| 3.4.3 | η_p = **0.8** típico, salvo hélice de paso fijo en loiter donde η_p = **0.7** | Eficiencia de hélice | 0.7 / 0.8 |
| 3.4.4 | Aspect ratio: *"range from under 1 for reentry lifting bodies to over 30 for sailplanes. Typical values range between 3 and 8."* | Rango de AR | 3–8 típico |
| 3.4.4 | ⭐ *"Two airplanes with similar span and total wetted area will have a similar lift-to-drag ratio, even if they look completely different and their aspect ratios are dissimilar."* | **El AR NO predice el arrastre**; el área mojada y la envergadura sí | delta AR 3 = convencional AR 7.7 con L/D 16 vs 15 |
| 3.4.4 | *"Wetted area ratio can be 'eyeball' estimated from the sketch"* | S_wet/S_ref se estima **a ojo** del croquis | 2.2 (delta) … 6.2 (convencional) |
| 3.4.5 | Jet: crucero 0.866·L/D_max, loiter L/D_max. Prop: crucero L/D_max, loiter 0.866·L/D_max | Los factores 0.866 van CRUZADOS entre jet y prop | 0.866 |
| 3.4.6 | Reserva + atrapado: *"a 6% allowance"* | Fracción de combustible = 1.06·(1 − W_x/W₀) | 6% |
| 3.5 | *"a value between the two is used as the next guess. This will usually converge in just a few iterations."* | Relajación entre adivinado y calculado | pocas vueltas |
| 3.6.1 | *"there is no such thing as a free lunch!"* | Todo diseño es una serie de compromisos | — |
| 3.6.1 | *"The fuel tanks should be placed so that the fuel is evenly distributed about the aircraft center of gravity"* | El combustible, repartido alrededor del c.g. | — |
| 3.6.1 | Tanques de combustible en el fuselaje: *"increase the risk of fire... and is forbidden in commercial aircraft"* | Prohibido en comercial | — |
| 3.6.1 | *"fire safety should always be considered"* aun en militar | Seguridad contra incendio, siempre | — |
| 3.6.5 | *"While strict accuracy should not be expected, this simple sizing method will usually yield an answer in the 'right ballpark.'"* | No esperes exactitud; espera el orden correcto | error real +7.9% vs S-3A |
| 3.6.6 | *"it is crucial that realistic estimates of empty weight be used during early conceptual design, and that the weight be strictly controlled during later stages"* | Control de peso desde el día uno | 5% de W_e ⇒ 9% de W₀ |

### 3.2 Cap 5 — T/W y W/S

| § | En inglés (corto) | Traducción | Rango / valor |
|---|---|---|---|
| 5.2 | *"It is important to avoid confusing the takeoff T/W with the T/W at other conditions"* | No confundas T/W de despegue con el de otras condiciones | — |
| 5.2.1 | Power loading *"has an opposite connotation from T/W. Confusingly, a high power loading indicates a small engine."* | Ojo: carga de potencia alta = motor **chico** | 10–15 lb/hp típico; acrobático ~6; mínimo histórico 3 |
| 5.2.3 | *"should be considered valid only within the normal range of maximum speeds for each aircraft class"* | Las ecuaciones estadísticas solo valen dentro del rango de su clase | — |
| 5.2.4 | *"For initial layout the T/W should be selected as the higher of either the statistical value... or the value obtained from the thrust matching"* | Toma el **máximo** de estadístico y thrust matching | — |
| 5.2.4 | *"most aircraft engines cannot be run at maximum power for a long time"* → hay que verificar crucero además de ascenso | Verifica crucero aparte del ascenso | — |
| 5.2.5 | Empuje de crucero / de despegue: turbofán alto bypass **20–25%**; turbofán bajo bypass o turbojet **40–70%**; eshp de turbohélice **60–80%**; pistón cruza al **75%** de potencia | Lapso de empuje | ver rangos |
| 5.2.5 | Pistón sin sobrealimentación: la potencia cae ≈ con la razón de densidad σ (a 10,000 ft ≈ 73%) | Caída de potencia con altitud | σ |
| 5.3.1 | *"the designer should select the lowest of the estimated wing loadings"* | Toma el **mínimo** de los W/S | — |
| 5.3.1 | ⭐ *"If an unreasonably low wing loading value is driven by only one of these performance conditions, the designer should consider another way to meet that condition."* | Si UNA restricción manda un W/S absurdo, cambia el avión o el requisito | — |
| 5.3.2 | FAR 23 < 12,500 lb: pérdida ≤ **61 kt** salvo multimotor con ciertos ascensos | Límite legal de pérdida | 61 kt {113 km/h} |
| 5.3.2 | *"a stall speed of about 50 kt would be considered the upper limit for a civilian trainer"* | Límite práctico para pilotos novatos | 50 kt |
| 5.3.2 | Aproximación ≥ **1.3**·V_stall (civil), ≥ **1.2** (militar) | Márgenes de aproximación | 1.3 / 1.2 |
| 5.3.2 | ρ de diseño: nivel del mar 0.00238 slug/ft³ {1.23}; **día caliente a 5000 ft** 0.00189 {0.974} *"to ensure that the airplane can be flown into Denver during summer"* | Densidad de diseño | dos valores |
| 5.3.2 | C_Lmax: ala limpia **1.2–1.5**; flaps interiores **1.6–2.0**; transporte con flaps y slats **~2.4**; STOL **~3.0**; con soplado hasta **5.0** | Rangos de C_Lmax | ver |
| 5.3.2 | Ala de AR > ~5 sin flaps: C_Lmax ≈ **0.9**·c_lmax del perfil, y ×cos Λ_c/4 si hay flecha | Ec. (5.7) | 0.9·cos Λ |
| 5.3.2 | *"you are never sure of the maximum lift coefficient until the airplane flies"* | Nunca sabes el C_Lmax hasta que vuela | — |
| 5.3.2 | Flaps de despegue ≈ mitad del ángulo de aterrizaje → C_Lmax de despegue ≈ **80%** del de aterrizaje | Regla de flaps | 0.8 |
| 5.3.3 | Obstáculo: **50 ft** militar y civil general, **35 ft** para jets comerciales; BFL militar sobre 50 ft ≈ 5% mayor que sobre 35 ft | Alturas de obstáculo | 50 / 35 ft |
| 5.3.3 | Despegue a **1.1**·V_stall ⇒ C_L de despegue = C_Lmax/**1.21** | Coeficiente de despegue | /1.21 |
| 5.3.3 | Ángulo de cola abajo del tren limita el C_L: *"typically not more than 15 deg"* | El tren limita la actitud | ≤15° |
| 5.3.3 | *"we usually design twin-engine aircraft with a higher total T/W"* (pierden la mitad del empuje con un motor fuera) | Bimotores llevan más T/W | — |
| 5.3.3 | *"use of reversed thrust is not permitted for calculation of balanced field length"* | El reversor no cuenta para BFL | — |
| 5.3.4 | Catapulta: margen de 10% en velocidad (÷1.21) o 15% en C_L (÷1.18); empuje del motor añade **3–10 kt** {5–18 km/h}; viento sobre cubierta 20–40 kt, pero *"frequently require launch capabilities with zero wind-over-deck or even a negative value"* | Catapulta | ver |
| 5.3.5 | Toma de contacto ≈ **1.15**·V_stall; FAR 25 añade **2/3** de distancia extra | Aterrizaje | 1.15; ×1.67 |
| 5.3.5 | Regla rápida: distancia total de aterrizaje en ft ≈ **0.3·(V_approach en kt)²** | Regla de dedo de aterrizaje | 0.3·V² |
| 5.3.5 | S_a: **1000 ft** aerolínea (3°), **600 ft** GA con motor cortado, **450 ft** STOL (7°) | Distancia de obstáculo | ver |
| 5.3.5 | Reversores: multiplicar el rodaje por **0.66** — pero *"FAR and other requirements often specify that thrust reversers cannot be used to meet landing specifications for a simple reason — they may break, right when you need them the most"* | El reversor no se acredita | ×0.66 (si se permite) |
| 5.3.5 | Peso de aterrizaje: props y entrenadores ≈ **1.0**·W₀; jets ≈ **0.85**·W₀; militar típicamente payload completo + **50%** de combustible | Ratios de peso | ver |
| 5.3.7 | Un margen de razón de viraje de **2 °/s** *"is usually considered significant"* | Cuánta ventaja de viraje importa | 2 °/s |
| 5.3.7 | Factor de carga límite de cazas: antes **7.33 g**, nuevos **8 g** | Límite estructural | 7.33 / 8 |
| 5.3.7 | Corner speed de un caza moderno: **300–350 kt** IAS *"regardless of altitude"* | Velocidad de esquina | 300–350 kt |
| 5.3.7 | C_Lmax de combate: **0.6–0.8** con flap simple de borde de fuga; **1.0–1.5** con sistema completo de borde de ataque y fuga | Sustentación usable en combate | ver |
| 5.3.7 | Peso de combate ≈ **0.85**·W₀ (tanques externos soltados + 50% del interno) | Peso de combate | 0.85 |
| 5.3.9 | ⭐ *"At high angles of attack the effective e value can be reduced by 30% or more... If these equations yield W/S values far from historical values, the e value is probably unrealistic, and the calculated W/S values should be ignored."* | e se derrumba a alto α; si el resultado se sale de la historia, **ignóralo** | −30% o más |
| 5.3.10 | Flaps de despegue: C_D0 **+0.02**, e **−5%**. Flaps de aterrizaje: C_D0 **+0.07**, e **−10%**. Tren abajo: C_D0 **+0.02** | Incrementos de configuración | ver |
| 5.3.10 | ⭐ *"no matter how 'clean' your design is, the T/W must be greater than the desired climb gradient"* y *"A 200-mph airplane that flies on 20 hp can't be expected to climb as well as an airplane that requires 200 hp to reach 200 mph"* | Un avión muy limpio con poco empuje **asciende mal** | T/W ≥ G + 2√(C_D0/πAe) |
| 5.3.10 | Motor fuera en trimotor: T/W pasa a **2/3**. El arrastre del motor parado *"can probably be ignored"* en análisis inicial | Motor fuera | — |
| 5.3.11 | Techo de servicio con ascenso residual típico de **100 ft/min** {30.5 m/min} | Techo de servicio | 100 ft/min |
| 5.3.11 | C_L de diseño del perfil ≈ **0.5** típico; perfiles nuevos de gran altitud **0.95–1.0** | C_L de diseño | 0.5 / 0.95–1.0 |
| 5.3.6 | Loiter típico si no se especifica: **150–200 kt** {~325 km/h} turbohélice y jet; **80–120 kt** {~180 km/h} hélice de pistón. Altitud de mejor SFC: **30,000–40,000 ft** {~10,000 m} para jet; el límite del turbo para pistón; nivel del mar sin turbo | Velocidades y altitudes de loiter | ver |
| 5.3.6 | Peso promedio de loiter ≈ **0.85**·W₀ *"in the absence of better information"* | Peso de loiter | 0.85 |
| 5.4 | *"Don't forget to convert all wing loadings to takeoff conditions prior to comparisons."* | Convierte todo a condiciones de despegue antes de comparar | — |
| 5.4 | *"A low wing loading makes a bigger wing which will always increase aircraft weight and cost."* | Ala grande = más peso y más costo, siempre | — |
| 5.4 | ⭐ *"Push to a Dash-One layout as quickly as possible, then optimize from its geometry... **don't believe it until you've redone the optimization using parameters taken from the real design layout.**"* | No creas ninguna optimización previa al dibujo | — |
| 5.4 | *"these selected values of W/S and T/W are used only for the initial design layout... The initial values are just to get the design started and are **never used again**."* | Los valores iniciales son desechables por diseño | — |

### 3.3 Cap 6 — sizing refinado y geometría

| § | En inglés (corto) | Traducción | Rango / valor |
|---|---|---|---|
| 6.2 | *"'fixed' refers to the engine size, not to how it is attached!"* | "Motor fijo" = tamaño fijo, no montaje fijo | — |
| 6.2 | *"The engine companies would be happy to create a new engine at any size you desire, **as long as somebody pays for it**."* Desarrollar un turbofán nuevo cuesta **miles de millones** | El motor de goma no es gratis | — |
| 6.3.1 | *"buried in the math is the assumption that T/W is being held constant, so it isn't very accurate when used for fixed-engine sizing"* | El método del cap 3 asume T/W constante | — |
| 6.3.2 | *"these equations are only suitable for use before the airplane layout is made, and they are **not appropriate for design trade studies**"* | La estadística de peso no sirve para trade studies | — |
| 6.3.3 | Reserva **5%** + atrapado **1%** | Desglose del 6% | 5% + 1% |
| 6.3.7 | ⭐ *"the solution will converge most rapidly if the new guess for W0 is about **three-fourths of the way** from the initial guess to the calculated W0 value"* | Sobre-relajación ω = 0.75 | **medido: 6 vueltas vs 13 con ω=0.5** |
| 6.4 | ⭐ *"You cannot guarantee both range and performance, unless you're willing to buy a bigger engine."* | Con motor fijo: alcance **o** desempeño | — |
| 6.4 | *"One possibility is to reduce the payload, but remember that **payload is usually the reason for building the aircraft in the first place!**"* | Recortar payload es recortar la razón de ser | — |
| 6.5 | El fineness ratio (longitud/diámetro máximo) hay que definirlo explícitamente | Esbeltez del fuselaje | ver Tabla 6.3 |

### 3.4 Cap 4 — perfil y geometría de ala/cola (el corazón geométrico)

**Perfil (§4.2–4.6)**

| § | Regla | Valor |
|---|---|---|
| 4.2 | El origen del perfil va en el **borde de ataque**; los catálogos con eje en el fondo plano son "improper". *"you must always ask 'with respect to what reference axis?'"* | — |
| 4.2 | Radio de LE grande = más ángulo de pérdida y más sustentación; **radio gordo = más arrastre**. Supersónico: LE afilado **para evitar la onda de proa**, o barre el ala | — |
| 4.2 | *"the upper surface contributes about two-thirds of the total lift"* ⇒ **los bultos van abajo** (pozos de rueda, montantes) | 2/3 |
| 4.2 | Al escalar espesor, *"the camber line should remain unchanged"* ⇒ **separa comba y espesor, escala el espesor, recombina** | — |
| 4.3 | +1% de comba ≈ **+0.03 de c_lmax** | 0.03/% |
| 4.3 | *"As a rule-of-thumb, this negative angle is approximately equal in degrees to the percent camber"* | α_L0 ≈ −(%comba) |
| 4.3 | Centro aerodinámico ≈ **25% de cuerda** subsónico; migra a **35–40%** en supersónico | 0.25 → 0.35–0.40 |
| 4.4 | C_l de diseño = el del mejor L/D (tangente desde el origen al polar); `C_l_diseño = W/(qS)`. Histórico **0.3–0.5** | 0.3–0.5 |
| 4.4 | Comba NACA 6 dígitos: `%comba ≈ 5.5·C_l_diseño` | ×5.5 |
| 4.4 | Al quemar combustible hay que **subir de altitud (cruise-climb)** para no salirse del C_l de diseño | — |
| 4.5 | **Tipo de pérdida por t/c:** > 14% "fat" = desde el TE, gradual, ~10° α, poco cambio de C_m. **6–14%** = desde el LE, **abrupta**. Muy delgado = burbuja larga, suave pero **con cambios grandes de C_m** | — |
| 4.5 | Washout hace que la **raíz** entre en pérdida primero → buffet en la cola = aviso al piloto | — |
| 4.5 | **La interpolación de propiedades entre perfiles NO funciona para supercríticos ni laminares** | — |
| 4.5 | Para bajo A o mucha flecha, *"airfoil stall characteristics can be essentially ignored"* — mandan los efectos 3D | — |
| 4.5 | *"you cannot use airfoil data obtained at one Reynolds number and apply it to an airplane at a very different Reynolds number"* | ±½ orden de magnitud |
| 4.6 | ⭐ **Peso:** `W_ala ∝ 1/√(t/c)`. *"Halving the thickness ratio will increase wing weight by about 41%"* — y el ala es ~15% del vacío ⇒ **+6% de peso vacío** | +41% / +6% |
| 4.6 | Supercrítico admite **~10% más de t/c** al mismo arrastre | ×1.1 |
| 4.6 | Perfil raíz **20–60% más grueso** que el de punta sin penalizar; el engrosamiento **≤30% de la semi-envergadura** | ≤30% b/2 |
| 4.6 | *"Don't waste a lot of time on picking the perfect airfoil — it'll change soon."* | — |
| 4.6 | Arranques recomendados: NACA **64A/65A** supersónico barrido; supercrítico para transporte alto-subsónico; NASA moderno para GA (Apéndice D) | — |

**Geometría de referencia (§4.7)**

```
S = W/(W/S)                b = √(A·S)
C_root = 2S/[b(1+λ)]       C_tip = λ·C_root
c̄ = (2/3)·C_root·(1+λ+λ²)/(1+λ)
Ȳ = (b/6)·(1+2λ)/(1+λ)          ← DUPLICAR Ȳ para cola vertical
Ala elíptica: C_root = 4S/(πb); MAC = 0.849·C_root; Ȳ = 0.529·(b/2)
```
⭐ El ala de referencia trapezoidal **es parcialmente ficticia**: llega al eje del avión y tiene punta
cuadrada. *"You don't build it."* Y: *"It is very important to avoid confusing these two sweep
angles"* — **LE manda en supersónico, c/4 manda en subsónico**.

**Tabla 4.1 — Aspect ratio** (A **equivalente** = b²/(S_ala + S_canard))

| Tipo | A |
|---|---|
| Planeador | `A = 0.19·(mejor L/D)^1.3` |
| Homebuilt | 6.0 |
| GA monomotor | 7.6 |
| GA bimotor | 7.8 |
| Agrícola | 7.5 |
| Bi-turbohélice | 9.2 |
| Hidroavión | 8.0 |

| Jets — `A = a·M_max^C` | a | C |
|---|---|---|
| Entrenador jet | 4.737 | −0.979 |
| Caza (dogfighter) | 5.416 | −0.622 |
| Caza (otros) | 4.110 | −0.622 |
| Carguero/bombardero militar | 5.570 | −1.075 |
| Transporte jet | 7.50 a 10 | 0 |

Canard = **10–25%** del área sustentadora ⇒ `A_ala = A_estadístico/(0.9 a 0.75)`.
L/D_max sube ≈ √A y el peso del ala sube por el mismo factor. **Cola con A bajo** (que entre en
pérdida después del ala); **canard con A alto** (que entre antes).

**Flecha (§4.9)**

- *"For a low speed airplane, especially propeller-powered, the best sweep is usually zero."*
- Supersónico: barrer el LE **detrás del cono de Mach**, `arcsin(1/M)`. A Mach 2.5 la teoría pide
  **>66°** pero lo real es **~60°** (LE supersónico con perfiles afilados). Outlier: F-104 a Mach 2
  con ~30° y un LE tan filoso que le ponían fundas en tierra.
- Subsónico: se barre para que el flujo perpendicular al LE **siga subsónico**.
  *"This actually sets the wing sweep for most airliners."*
- **10° de flecha ≈ 1° de diedro efectivo.**
- **Pitch-up** (Fig. 4.21, NASA TN 1093): frontera A vs Λ_c/4. Puede **limitar A por debajo** del de
  la Tabla 4.1. Considerar en cazas, acrobáticos, GA y entrenadores.
- Flecha variable: pivote al **30–40% de cuerda**; **+4% de peso vacío**, **+19% del peso del ala**.
  Se diseña la planta **sin barrer** y luego se barre.

**Estrechamiento λ (§4.10)**

| Regla | Valor |
|---|---|
| Alas de poca flecha | **λ ≈ 0.4–0.5** |
| Alas barridas | **λ ≈ 0.2–0.3** |
| Rectangular sin torsión (λ=1) | **+7% de arrastre inducido** vs elíptica |
| Óptimo aerodinámico sin flecha | **λ = 0.45** (<1% peor que la elíptica) |
| Óptimo **con el ahorro de peso** | **λ ≈ 0.4** |
| Piso duro | *"taper ratios much lower than 0.2 should be avoided for all but delta wings"* (tip stall) |
| Curiosidad | Sin estrechamiento, la elíptica pediría **22° de flecha HACIA ADELANTE** |
| λ > 1 (XF-91) | *"worked poorly, looked really strange, added to the wing weight, and hasn't been attempted since."* |

**Torsión, incidencia, diedro (§4.11–4.13)**

- Torsión típica **0 a −5°** (washout). Arranque histórico: **−3°**.
  *"large amounts of twist (much over 5 deg) should be avoided"* — la optimización de torsión solo
  vale a **un** C_L. *"wash-in is very unlikely."*
- Incidencia inicial: **GA y homebuilt ≈ 2°**, **transporte ≈ 1°**, **militar ≈ 0°**. Si hay torsión,
  es la **incidencia promedio** la que debe dar esos valores. Y la anécdota-requisito:
  *"the incidence angle must be carefully chosen to ensure that the flight attendants do not have to
  push the food carts uphill, as was the case in the L-1011!"*
- **Tabla 4.2 — Diedro (grados)**

| | Ala baja | Ala media | Ala alta |
|---|---|---|---|
| Sin flecha (civil) | 5 a 7 | *(celda perdida en el OCR — verificar contra el impreso; el valor publicado suele citarse como 2 a 4)* | 0 a 2 |
| Flecha subsónica | 3 a 7 | −2 a 2 | −5 a −2 |
| Flecha supersónica | 0 a 5 | −5 a 0 | −5 a 0 |

  Ala alta + flecha ⇒ **diedro geométrico NEGATIVO** (C-5) para no caer en Dutch roll; corregirlo
  obliga a **agrandar la vertical** (peso + arrastre). Y la confesión:
  *"there isn't a simple technique for selecting the correct dihedral angle."*

**Posición vertical del ala (§4.14)**

| | A favor | En contra |
|---|---|---|
| **Alta** | Piso de carga a **4–5 ft {1.5 m}** = altura de caja de camión; menos peso de tren; menos riesgo de golpe de punta; STOL | Fuselaje reforzado + blister; fondo aplanado (más pesado que circular); **bloquea la visibilidad en viraje y ascenso** (la colisión clásica alta-sobre-baja) |
| **Media** | **El menor arrastre** con fuselaje circular y sin fairings; despeje para armamento; mejor acrobacia | **El carrythrough** no pasa si hay carga o pasaje (se muestran 6 in {15 cm} de claro) |
| **Baja** | Trunnion anclado directo a la caja; tren sin blister; **menos upsweep de cola** ⇒ menos arrastre | El diedro a veces lo fija **no la aerodinámica sino no rayar la punta** en un mal aterrizaje |

Fuselaje de transporte grande (~20 ft {6 m} de diámetro): la caja pasa **debajo** del pasaje y
**parte la bodega en dos**.

**Puntas y winglets (§4.15–4.16)**

- *"even a simple cutoff tip offers less drag than a rounded-off tip"* — **la punta redondeada le
  facilita al aire escaparse**. Usa arista viva. **Hoerner tip:** todo el remodelado en la superficie
  **inferior**, cantada ~30°, posiblemente cóncava.
- Punta barrida atrás = menos arrastre pero **más carga torsional**. Punta cortada barrida adelante
  **al ángulo del cono de Mach** en supersónicos (F-15).
- **Endplate:** aumento efectivo de envergadura solo **~80%** del físico.
- **Winglet:** hasta **+20% de L/D**, hasta el **doble** del aumento efectivo de envergadura. Gana más
  con A **menor** al óptimo o en un avión recertificado a más peso; **un ala de A alto ya eficiente
  casi no gana**. Contras: masa detrás del eje elástico (**flutter**) y optimizado a **una sola
  velocidad**. Y el veredicto: *"When an all new wing is being designed, it is usually better to rely
  upon increased aspect ratio."*

**Arreglo de cola (§4.19) — los compromisos declarados de cada uno**

| Arreglo | A favor | En contra |
|---|---|---|
| **Convencional** | ~70% de la flota; **estabilidad y control al menor peso**; flujo limpio, estructura y varillaje existentes | "boring" — pero *"you should always consider a conventional tail, no matter how 'boring' you think it is"* |
| **T-tail** | End-plate ⇒ vertical más chica; horizontal fuera de estela y propwash ⇒ más chica; menos buffet y fatiga; permite motores en el fuselaje trasero; *"considered stylish, which is not a trivial consideration"* | **Más pesada**; **deep stall**; exige un ala sin pitch-up |
| **Cruciforme** | Sube la horizontal para librar el chorro (B-1B); **menos penalización de peso que la T** | **No da** la reducción por end-plate |
| **H-tail** | Verticales en aire limpio a alto α; timones en el propwash (motor-out); end-plate; **el A-10 oculta las toberas de los misiles IR**; baja la altura total | Más pesada que la convencional |
| **V-tail** | Menos área mojada **en teoría**; menos arrastre de interferencia (real) | NACA: hay que **subir el área al mismo total** que colas separadas; **mixer** de mando; **acoplamiento adverso roll-yaw** |
| **V invertida** | Acoplamiento **proverse**; reduce tendencias en espiral | Claro con el suelo |
| **Twin tails** | Timones fuera de la línea central (no los tapa el ala a alto α); menor altura | **Más pesadas** que una sola de igual área — pero **más efectivas** |
| **Booms** | Permite hélice pusher o motor pesado cerca del CG | **Más pesados** que fuselaje convencional |
| **Ring-tail** | Atractivo conceptual | *"has proven inadequate in application"* |
| **Canard de control** | Mando en aire no perturbado; anti-pitch-up; vórtice que refuerza el del ala | Exige **FCS rápido y fiable** (X-31: un sensor congelado = pérdida de control instantánea) |
| **Canard sustentador** | Ambas superficies suben; pérdida segura (entra primero) | Es un tandem: CG muy adelante, el ala trasera va "floja", más área total, **no puedes poner flaps atrás** |
| **Tres superficies** | **Mínimo arrastre de trim en teoría** (canard y cola se cancelan); permite flaps | Peso, complejidad, interferencia; el beneficio es de **campo lejano** y puede no realizarse |
| **Sin cola / ala volante** | **El menor peso y arrastre de todos** | Ala reflexada o torcida (pierde eficiencia) o inestable con FCS; **hipersensible al CG**; *"probably the most difficult configuration to stabilize"* |

⭐ **Tandem:** el 50% teórico de ahorro inducido **no se da** — la segunda ala vuela en el downwash de
la primera, su sustentación se **gira** y aparece un **nuevo término de arrastre**, más inestabilidad
en cabeceo.
⭐ **Estudio N+3 NASA-GRC:** quitar **ambas** colas ahorró **10% de área mojada** en crucero, sin
penalizar frontal ni estructura; el análisis dio **−60% de consumo**.

**Cola para recuperación de barrena (§4.20)**

- La estela de la horizontal en pérdida sale **~45°** hacia arriba.
- **REGLA DURA:** *"at least a third of the rudder should be out of the wake"* — ≥1/3 del timón sin
  tapar.
- Aleta **dorsal** (vórtice que se pega a la vertical, previene sideslip alto) y **ventral** (nunca la
  tapa la estela del ala; también evita inestabilidad lateral a alta velocidad).

**Tabla 4.3 — Geometría de cola**

| | Horizontal A | Horizontal λ | Vertical A | Vertical λ |
|---|---|---|---|---|
| Caza | 3–4 | 0.2–0.4 | 0.6–1.4 | 0.2–0.4 |
| Planeador | 6–10 | 0.3–0.5 | 1.5–2.0 | 0.4–0.6 |
| Otros | 3–5 | 0.3–0.6 | 1.3–2.0 | 0.3–0.6 |
| T-tail | — | — | 0.7–1.2 | 0.6–1.0 |

- Flecha LE de la horizontal ≈ **flecha del ala + 5°** (que entre en pérdida después y tenga M_crit
  mayor). Flecha de la vertical **35–55°**; en avión lento, más de ~20° *"other than aesthetics"*.
- Espesor de cola ≈ el del ala; en alta velocidad, horizontal **~10% más delgada**.
- Incidencia de la horizontal **−2 a −3°**, ajustable **±3°**.
- ⭐ *"For conceptual design, it is usually acceptable simply to draw tail surfaces that 'look right'
  ... provided that the total area is correct."*
- Un **canard sustentador o tandem se diseña con las reglas de ALA**, no de cola.

### 3.5 Cap 6 §6.5–6.6 — dimensionamiento geométrico

**Tabla 6.3 — Longitud de fuselaje `L = a·W₀^C`** (ft con W₀ en lb; {m} con W₀ en kg)

| Tipo | a (ft) | a {m} | C |
|---|---|---|---|
| Planeador sin motor | 0.86 | {0.383} | 0.48 |
| Planeador motorizado | 0.71 | {0.316} | 0.48 |
| Homebuilt metal/madera | 3.68 | {1.35} | 0.23 |
| Homebuilt compuesto | 3.50 | {1.28} | 0.23 |
| GA monomotor | 4.37 | {1.6} | 0.23 |
| GA bimotor | 0.86 | {0.366} | 0.42 |
| Agrícola | 4.04 | {1.48} | 0.23 |
| Bi-turbohélice | 0.37 | {0.169} | 0.51 |
| Hidroavión | 1.05 | {0.439} | 0.40 |
| Entrenador jet | 0.79 | {0.333} | 0.41 |
| Caza jet | 0.93 | {0.389} | 0.39 |
| Carguero/bombardero militar | 0.23 | {0.104} | 0.50 |
| Transporte jet | 0.67 | {0.287} | 0.43 |

*"give remarkably good correlations to most existing aircraft. However, they should be considered no
more than an initial starting point."*

**Fineness ratio óptimo**

| Caso | Óptimo |
|---|---|
| Área de sección **impuesta** (p.ej. dos asientos lado a lado) — Hoerner | **≈ 3** |
| Volumen fijo, componentes reorganizables, **subsónico** | **6 a 8** (coincide con los dirigibles exitosos) |
| **Supersónico** | **≈ 14**, rango **10–15 o más** |

Fineness 3 puede **no dar brazo de cola suficiente** ⇒ colas enormes o **tail boom "tadpole"**. Y la
honestidad: *"the realities of packaging the internal components will ultimately establish the
fuselage length and diameter — but it is good to know the optimal fineness ratio as a layout goal."*

**Coeficiente de volumen de cola**

```
c_VT = L_VT·S_VT/(b_w·S_w)   →   S_VT = c_VT·b_w·S_w/L_VT      (6.28)
c_HT = L_HT·S_HT/(c̄_w·S_w)  →   S_HT = c_HT·c̄_w·S_w/L_HT      (6.29)
```
L = de **c/4 de la cola** a **c/4 del ala**. Área horizontal **hasta el eje**; área de canard **solo
la expuesta**; verticales gemelas **se suman**.

**Tabla 6.4 — Coeficientes ("conservative averages")**

| Tipo | c_HT | c_VT |
|---|---|---|
| Planeador | 0.50 | *(celda perdida en el OCR — verificar contra el impreso; suele citarse 0.02)* |
| Homebuilt | 0.50 | 0.04 |
| GA monomotor | 0.70 | 0.04 |
| GA bimotor | 0.80 | 0.07 |
| Agrícola | 0.50 | 0.04 |
| Bi-turbohélice | 0.90 | 0.08 |
| Hidroavión | 0.70 | 0.06 |
| Entrenador jet | 0.70 | 0.06 |
| Caza jet | 0.40 | **0.07–0.12** * |
| Carguero/bombardero militar | 1.00 | 0.08 |
| Transporte jet | 1.00 | 0.09 |

\* *"Long fuselage with high wing loading needs larger value."*

**⭐ Brazo de cola como fracción de la longitud del fuselaje — los valores exactos**

| Configuración | L_cola / L_fuselaje |
|---|---|
| **Motor de hélice en la nariz** | **≈ 60%** |
| **Motores en las alas** | **50–55%** |
| **Motores traseros (aft-mounted)** | **45–50%** |
| **Planeador** | **≈ 65%** |
| **Canard** | **30–50%** (mucha más dispersión) |

**Correcciones al coeficiente de volumen:** cola all-moving **−10 a −15%**; T-tail **vertical −5%** y
**horizontal −5%**; H-tail **horizontal −5%**; FCS activo **−10%** (siempre que se cumplan trim,
engine-out y nosewheel liftoff). **V-tail:** dimensiona H y V normal, suma las áreas, y el
**diedro = arctan√(S_VT/S_HT) ≈ 45°**. **Canard de control:** c_HT ≈ **0.1**. **Canard sustentador:
el método NO aplica** — reparto de área ≈ **25% canard / 75% ala** (50-50 sería tandem).

**Superficies de mando (§6.6)**

- **Alerones y flaps: 15–25% de la cuerda del ala.** **Timones y elevadores: 25–50% de la cuerda de
  la cola.** Las superficies se estrechan **con el mismo λ** ⇒ % de cuerda constante ⇒ **largueros
  rectos, no curvos**.
- **Alerones: de ~50% a ~90% de la semi-envergadura.** El 10% final hasta la punta da poco control
  (flujo de vórtice) pero sirve de **alojamiento del mass balance**.
- **Flaps: todo lo interior al alerón.** Si necesitas C_Lmax alto, **usa spoilers en vez de alerones**
  para alargar el flap.
- **Elevadores y timones: del costado del fuselaje al ~90% de la envergadura de la cola.** En alta
  velocidad, a veces **timón de cuerda grande que solo llega al ~50%** (evita reversión).

**Tabla 6.5 — C_f/C de superficies de mando**

| Avión | Elevador | Timón |
|---|---|---|
| Caza/ataque | 0.30 * | 0.30 |
| Transporte jet | 0.25 † | 0.32 |
| Entrenador jet | 0.35 | 0.35 |
| Biz jet | 0.32 † | 0.30 |
| GA monomotor | 0.45 | 0.40 |
| GA bimotor | 0.36 | 0.46 |
| Planeador | 0.43 | 0.40 |

\* Supersónico: normalmente **cola all-moving sin elevador separado**. † A menudo **all-moving más elevador**.

**Flutter y balance:** mass balance **delante de la bisagra**, lo más adelante posible. El **eje de
bisagra no debe ir más atrás del ~20% de la cuerda media** de la superficie. El **notched balance NO
sirve** para alerones ni para nada en alta velocidad. Regla de arquitectos navales para el primer
trazo: CP a **0.33** de la cuerda móvil si va detrás de una fija, **0.20** si está en corriente libre;
promedia ponderado por área y pon la bisagra bien delante. Y el remate:
*"Then, don't trust the result — use a more sophisticated analysis method as soon as possible."*

**⭐ Volumen de combustible: disponible vs requerido (§10.4) — el gate del kernel**

| Tanque | % del volumen medido a la piel que es **utilizable** |
|---|---|
| Integral en ala | **85%** |
| Integral en fuselaje | **92%** |
| Bladder en ala | **77%** |
| Bladder en fuselaje | **83%** |

Densidades a 15 °C: JET A-1 **6.70 lb/gal {0.803 kg/l}**; JP-8/JET A **6.74 {0.808}**; AvGas
**5.93 {0.710}**; JP-10 **7.85 {0.941}**. **Usar los valores de 15 °C y proveer 3–5% de volumen extra**
para expansión térmica. Espuma antiexplosión: desplaza **2.5%** del volumen, retiene ~0.6%, pesa
**1.3 lb/ft³**. El CG de cada tanque = centroide del área bajo la curva del fuel-volume plot, y **el
CG total del combustible debe quedar cerca del CG del avión**.

### 3.6 Cap 7 — loft y geometría CAD (lo que toca directo a nuestro kernel)

**Por qué cónicas.** El método de splines de madera con *ducks* tiene dos defectos: mucho ensayo y
error para lograr suavidad simultánea en sección y longitudinal, y **no produce una definición
matemática única** de la superficie — crear una sección nueva, sobre todo **canteada**, cuesta
enormidades y es propensa a mismatch. El veredicto del cliente:

> ⭐ *"Quite simply, there is too much 'art' involved."*

Esa frase **es la justificación de existir de un kernel B-Rep**. La cónica nació en el **P-51
Mustang** porque *"it is in fact a mathematically defined curve, so that it can be plotted with great
accuracy for production lofting, but it is also easy to construct on the drafting table."*
El production lofting exige precisión de **centésimas de pulgada o menos sobre todo el avión** para
que partes hechas en plantas distintas encajen.

Y una opinión que importa para la Escuela:
*"a good understanding of traditional conic lofting is a necessary foundation for understanding the
process of aircraft surface design and will help the designer learn to properly use even the best of
modern CAD systems."*

**El parámetro de forma p**  (`p = |DE|/|DC|` con `|AD| = |BD|`)

| p | Curva |
|---|---|
| **> 0.5** | Hipérbola |
| **= 0.5** | Parábola |
| **< 0.5** | Elipse |
| **= 0.4142** con \|AC\|=\|BC\| | **Círculo** |

`p → 1.0` casi cuadrada; `p → 0.0` casi la recta A-B. Valores reales de un caza: p = 0.4142 arriba,
**0.595 y 0.610** abajo para "cuadrar" y meter el tren.

**Líneas de control longitudinales.** Conectas longitudinalmente los puntos **A, B, C, S** de las
secciones. *"Typically, some 5–10 control stations will be required to develop a fuselage that meets
all geometric requirements."* Una **línea de control auxiliar** grafica p a lo largo del fuselaje, y
el criterio de suavidad es:

> *"If the value of p varies smoothly from nose to tail, and the conic endpoints and tangent
> intersection point are controlled with smooth longitudinal lines, then the resulting fuselage
> surface will be smooth."*

**⭐ Flat-wrap lofting y su regla.** Superficie **desarrollable** (curvatura en una sola dirección) —
*"not necessarily the same as the 'ruled surface' available on most CAD systems"*. Las dos
condiciones para lograrlo con cónicas:

1. **Las líneas de control longitudinales deben ser RECTAS**, incluida la del shoulder point; si usas
   p, **p constante o variando linealmente**.
2. **Los ángulos tangentes de las cónicas NO deben cambiar longitudinalmente.**

Rutas garantizadas: sección constante; misma sección escalada linealmente (un cono); o las dos
condiciones de arriba. **El caso X-31:** cambiar las últimas **30 in {76 cm}** del fuselaje trasero a
flat-wrap eliminó un dado de titanio de **$400,000 (1999)** que además era el ítem crítico del
cronograma. Compromiso declarado: flat-wrap es **más barato pero aerodinámicamente peor**.

**Buttock-plane cuts como VERIFICACIÓN (§7.7).** Se prefieren cortes **verticales** porque **el perfil
alar ES un butt-plane cut del ala**. Trazas verticales en cada sección, transfieres las
intersecciones a la vista lateral y las conectas: *"If the fuselage surface is smooth, then these
longitudinal lines for the different butt-planes will all be smooth."* **Este es un gate de calidad
de superficie implementable como test automático.**

**Posición del ala respecto al CG (§7.8) — reglas exactas**

| Configuración | CG en % de MAC |
|---|---|
| Ala volante pura trapezoidal | **25%** = neutralmente estable |
| **Estable, cola trasera** | **≈ 30%** |
| **Inestable, cola trasera (F-22)** | **≈ 40%** |
| **Canard de control + FCS (inestable)** | **15–20%** |
| **Canard sustentador** | **~15% MAC** de cada superficie (20–25% si inestable), luego **promedio ponderado por área**. *"Note that this is a very crude estimate!"* |

**⭐ El caso de falla estructural por interpolación mal hecha.** La interpolación lineal entre
perfiles = *"ruled surfaces"* en muchos CAD, y **NO da flat-wrap**. La interpolación flat-wrap cambia
un solo paso: **conecta puntos de IGUAL PENDIENTE, no de igual % de cuerda.** El caso real: una
cortadora de hot-wire con marcas a % constante de cuerda produjo una superficie interpolada
**hundida** respecto a la piel flat-wrap ⇒ mala adhesión ⇒

> *"It is conceivable that such a wing could fail in flight for this simple reason. Who said lofting
> is not important?"*

**Fillet ala-fuselaje:** arco circular de radio variable, tangente a ala y fuselaje, radio típico
**≈ 10% de la cuerda raíz**, **creciendo hacia atrás** para evitar separación. El arco es
perpendicular a la superficie del ala (vertical solo en el máximo espesor, **horizontal en el LE**).
Para el layout inicial *"se calcula a ojo"*.

**Winglet (guías de Whitcomb):** empieza donde el perfil de punta tiene **su máximo espesor**; flecha
≈ la del ala; **altura ≥ la cuerda de punta**; **comba MAYOR que la del ala**; incidencia **4°
leading-edge-out**; **t/c ≈ 8%**; **cant 15°**. Panel inferior (si va): torcido **7° en la raíz y 11°
en la punta**.

**Área mojada y volumen a mano (§7.9–7.10)**

```
t/c < 0.05 :  S_wet = 2.003 · S_expuesta                       (7.11)
t/c > 0.05 :  S_wet = S_expuesta · [1.977 + 0.52·(t/c)]        (7.12)
Fuselaje:     S_wet ≈ 3.4 · (A_top + A_side)/2                 (7.13)
Volumen:      Vol  ≈ 3.4 · (A_top · A_side)/(4L)               (7.14)
S_expuesta verdadera = área proyectada / cos(diedro)
```
**Integración gráfica exacta:** grafica el **perímetro** de sección vs estación ⇒ el área bajo la
curva **es el área mojada**; grafica el **área** de sección vs estación ⇒ el área bajo la curva **es
el volumen**. **REGLA DE RESTA:** *"the cross-sectional perimeter measurements should not include the
portions where components join... These areas are not 'wetted'."*

⭐ El **volumen interno se usa como chequeo de razonabilidad**: un avión con menos volumen interno
del típico para su peso *"will have development problems and poor maintainability"* — los grupos de
ingeniería del cliente lo usan para ver **si los diseñadores hicieron trampa**.

**§7.11 — LO QUE EL CLIENTE OPINA DE NUESTRO PRODUCTO (textual)**

1. *"the integrated use of CAD and CAM has been, in this author's opinion, the single greatest
   improvement in cost and quality that the aircraft industry has ever seen."*
2. ⭐ *"with a CAD system there is a tendency to let the computer lead you in the 'easy' direction.
   If it is easy to retract the landing gear directly inward with your CAD system, you may do so even
   if a better design would result from having it retract inward and forward at a
   difficult-to-construct oblique angle."*
   **Requisito derivado: la retracción oblicua de doble cante debe ser TAN fácil como la recta.**
3. ⭐ *"If you can easily calculate the volume of a square fuel tank, but don't know how to get the
   volume of a complicated tank wrapped around the inlet duct, guess which one you are likely to
   design!"* **Requisito: volumen de tanques de geometría arbitraria = un botón.**
4. *"Sometimes a CAD system may confidently display an incorrect answer!"* — el área mojada del
   perfil raíz que hay que quitar del fuselaje **se olvida o se cuenta doble**;
   *"This potential problem is minimized if true 'solid models' are (properly!) employed."* Y con
   tomas, toberas y disco de hélice: *"Even a solid model could accidentally give the wrong answer in
   this case, failing to understand that the 'hole' isn't there!"*
5. ⭐ **EL TEST DE ACEPTACIÓN, en sus mayúsculas:** *"it is STRONGLY recommended that all CAD users
   start by doing a trivially simple 'aircraft design' consisting of a tube-plus-cone fuselage and a
   simple wing, where the correct wetted areas and volumes can be easily calculated by hand and
   compared with the answer from the CAD system."*
6. *"the aircraft design course can easily become the 'learn how to use a certain CAD system' course
   ... ANY time spent learning which button produces which geometry is time NOT spent learning the
   philosophy, methods, and techniques of aircraft conceptual design."* **Requisito de UX: cero curva
   de botones.**
7. ⭐ *"with a CAD system, everybody's designs look good whether they are or are not! When everybody
   was using a drafting table, you could usually tell from drafting technique that a design was done
   by a beginner... Today, it 'takes one to know one'."* **El CAD borró la señal de calidad; el
   sistema tiene que MEDIR lo que el ojo ya no puede juzgar.**
8. ⭐⭐ **EL REQUISITO FUNCIONAL #1, literal:** *"During conceptual design ... those parameters are
   constantly being changed, almost every week in the early stages. Conceptual designers need
   capabilities to change these instantly and to have the computer automatically revise the wing's
   nontrapezoidal shaping to match the new geometry and also revise the geometries of any parts made
   from the wing, such as wing fuel tanks, flaps, ailerons, spars, ribs, and possibly even wing
   carry-through structure and landing gear attachments. **All that the designer should have to do is
   to enter the revised geometric parameter (such as aspect ratio).**"*
9. Del encabezado del cap 7: *"The actual configuration geometry is the heart and soul of aircraft
   conceptual design."* / *"A well-done layout 'miraculously' goes through subsequent analysis and
   detail design — things fit, the drag is low, and the structure is lightweight. This is not an
   accident!"* / *"Good lofting is necessary but not sufficient."*
10. Y en el margen: **"Never forget: the end product of design is the design layout!"** —
    *"the only thing that gets built is the aircraft as defined by the layout geometry. The only thing
    that actually 'flies' is the drawing."*

### 3.7 Cap 8 — reglas de forma

**Aerodinámica (§8.2)**

| Regla | Valor |
|---|---|
| El área mojada es *"the most powerful aerodynamic consideration for virtually all aircraft"* | — |
| ⭐ *"Slope discontinuities (breaks) in the longitudinal direction are very bad."* Si hace falta un quiebre, **radio ≈ el diámetro del fuselaje** | R = D_fus |
| ⭐ Evita también la discontinuidad de **segunda** derivada (curvatura): *"The flow tends to separate right at the discontinuity."* Solución: **Euler spiral / Track Transition Curve** (curvatura lineal con la longitud). *"We airplane designers just call it a railroad curve, and eyeball it to look like this. It works."* | — |
| Desviación del fuselaje trasero respecto a la corriente libre | **≤10–12°**, hasta **15°** abajo |
| Con hélice pusher tolera **30° o más** — pero al pararse el motor **se separa** | 30° |
| Upsweep de cola: minimizar; hasta **~25%** tolerable en carga trasera **si las esquinas inferiores son afiladas** (crean un vórtice que reduce la penalización) | ≤25% |
| **Sección cuadrada: +30–40% de arrastre** por separación en las esquinas | +30–40% |
| **Base area** (cualquier superficie roma sin carenar mirando atrás): arrastre **extremadamente alto** | — |
| **Nunca pongas el canard donde su estela pueda entrar a las tomas** a ningún α — *"Wake ingestion can stall or even destroy a jet engine"* | — |

**Area ruling de Whitcomb (§8.2.2).** El arrastre de onda **se calcula con la SEGUNDA DERIVADA
(curvatura) del volume-distribution plot**; el óptimo teórico es el **Sears-Haack body**.
*"it is usually impossible to exactly or even approximately match the Sears-Haack shape for a real
aircraft. Fortunately, major drag reductions can be obtained simply by smoothing the volume
distribution shape."* Exprimir el fuselaje donde el ala aporta más sección ("coke-bottling") da
**hasta −50% de arrastre de onda**. **CONSERVACIÓN:** *"the volume removed at the center of the
fuselage must be provided elsewhere."* Bonus subsónico: un fuselaje que **crece de sección hacia el
TE del ala** empuja aire sobre el ala y reduce separación.
**Compression lift:** el B-70 monta el ala **encima de sus propios choques** ⇒ **~30% de la
sustentación gratis**; las puntas plegables reflejan más choques, **mueven el AC hacia adelante** y
**recuperan efectividad de la vertical** en supersónico.

**Fixes aerodinámicos (§8.2.4).** Casi todos los problemas son separación o un vórtice malo, y casi
todos los fixes **crean y controlan vórtices buenos**: vortex generators (dentro de la capa límite,
*"almost no increase in parasitic drag, even on a flat plate"*; ubicación por **prueba y error**;
**no en la nariz**), fence (justo **por fuera** de donde empieza la pérdida), notch/snag (=fence
virtual; con el LE exterior cambado abajo *"highly recommended for general aviation and training
aircraft"* contra la barrena), nose strake (fuerza vórtices **simultáneos** en ambos lados; uno solo
tira la nariz de lado ⇒ barrena), vortilon. Y la honestidad:
*"As can be imagined, they were not on the conceptual design layouts!"*

**Estructura (§8.3)**

| Regla | Valor |
|---|---|
| **Load paths:** el peso se minimiza **acercando las fuerzas opuestas** (sustentación vs pesos) | — |
| **Spanloading** llevado al extremo = ala volante; repartir motores por la envergadura ahorra peso — contra más arrastre y **una vertical más grande** por engine-out | — |
| Longerons **lo más rectos posible**; el trade real es rectos-sobre-la-caja vs más separados con un kink: *"Only a trade study can ultimately determine which approach is lighter"* | — |
| **Keelson:** viga tipo quilla que lleva la flexión **a través de la zona destrozada por los pozos de rueda** | — |
| **Cutouts** lejos del ala. *"An especially poor arrangement (seen on some older fighter aircraft) has the main landing gear retracting into the wing-box area, which requires a large cutout where the loads are the greatest."* | — |
| **Minimiza el número de mamparos** haciendo que cada uno recoja **varias** cargas concentradas | 2 en vez de 4–5 |
| Los compuestos penalizan **más** en cargas concentradas ⇒ **evita concentrarlas** (por eso Lancair/Cirrus/Kestrel moldean la vertical **integrada** al fuselaje) | — |
| **Largueros: delantero al 20–30% de cuerda, trasero al 60–75%** | 20–30 / 60–75% |
| El tren en el ala va **detrás de la caja**, con un **"kick spar"** de TE que recoge las cargas de flap | — |
| Barrido variable y plegado **suben mucho** el peso; el ala delta lo **baja** | — |

**Los cuatro carrythrough:** **Box** (estándar en transporte y GA; el fuselaje no ve el momento pero
**ocupa volumen y añade sección donde peor le cae al arrastre de onda**, e interfiere con los
longerons) · **Ring-frame** (más pesado estructuralmente **pero menos arrastre** ⇒ **la mayoría de
los cazas modernos**) · **Bending beam** (compromiso; planeadores y GA de compuestos) ·
**Strut-braced** (~**40° sobre la horizontal** para equilibrar la sustentación interior y exterior al
anclaje; **probablemente el más ligero de todos**, con penalización de arrastre a alta velocidad).

**⭐ Claros estructurales desde la mold line (§8.3.3) — números duros para el layout**

| Caso | Claro |
|---|---|
| Airliner grande (pared de cabina → piel) | **4 in {10 cm}** |
| Fuselaje de caza convencional | **2 in {5 cm}** |
| Aviación general pequeña | **1 in o menos** |
| Motor a reacción en fuselaje de Al o compuesto | **+1 in extra** de heat shield |
| Tanque integral | **0** (solo el espesor de la piel) |

*"There is no easy formula for the estimation of structural clearance. The designer must use judgment
acquired through experience."*

**Flutter (§8.3.4).** Regla madre: **"don't allow the center of mass to be behind the hinge line!"**
Estáticamente balanceada = CG de cuerda sobre la bisagra; balance completo = **producto de inercia
cero** ⇒ pesos **cerca de las puntas**. El **juego** en varillajes o trim tabs es peligro ⇒ pushrods
rígidos mejor que cables. Forma: *"They should never be convex, bulging out into the airflow"* —
planas o cóncavas, **TE biselado**, **engrosadas en la bisagra** para readherir el flujo. **Los
alerones no deben llegar a la punta.** Menos flutter torsional si **el timón baja hasta la mitad del
fuselaje**; **torque tube rígido** entre elevadores. Flexure-torsion: mantén el **CG de cuerda del ala
en o delante del eje elástico** ⇒ **evita peso detrás de ~la mitad del ala**.

**Stealth (§8.4) — las reglas de forma.** Escala: 0 dBsm = 1 m². B-52 ≈ **100 m²**; B-1B tratado ≈
**1 m²**; A-12 ≈ **0.014 m²**; caza no-stealth de nariz ≈ **10 m²**; objetivo stealth **0.01–0.1 m²**.
Los cinco mecanismos: **specular** (inclina costados y canta las verticales), **LE redondo** (barre
mucho), **cavidades** (inclina el **plano de la abertura** fuera de las amenazas + absorbedor en los
labios), **corner reflectors** (nada de intersecciones a ~90°, típicamente la unión ala-fuselaje), y
**scattering de corrientes superficiales** (barre TODA discontinuidad ⇒ **bordes en diamante o
dientes de sierra en cada puerta y panel**).

⭐ **"Aiming the spikes" — el algoritmo declarado.** Decide primero qué direcciones son amenaza
severa (frente: vas a atacar; cola: huyes y están enojados; costados a altitud similar; arriba y
abajo poco probables). Todo avión tendrá **al menos 4 spikes**. **Alinea cualquier spike adicional
con esos.** *"one big spike is better than two little spikes."* Alinear TE izquierdo con LE derecho
⇒ **planta en diamante (λ=0)**; TE izquierdo con LE izquierdo ⇒ **planta sin estrechamiento (λ=1)**.
**Ambas son las peores plantas aerodinámicas posibles** (cap 4) — pero combinándolas y torciendo con
cuidado se logra buena eficiencia (≈ el B-2 original). El faceteado del F-117 *"is no longer in
favor"* (demasiadas aristas de difracción); lo actual es **planta de líneas rectas muy barridas con
secciones transversales SUAVES**. Y la regla de oro:
**"Get rid of things — the radar can't see it if it isn't there!"**
RAM: espesor **≈ λ/4** de la amenaza; *"one can probably assume that such use will reduce or
eliminate any weight savings otherwise assumed for the use of composite materials."*

**Ruido (§8.7).** *"Chorro chico y rápido = máximo ruido; hélice grande de baja velocidad de punta =
mínimo; turbofán en medio."* **Hélices: claro mínimo al fuselaje 1 ft {30 cm}, preferible la MITAD
del radio** — pero más claro ⇒ vertical más grande por engine-out. **Motores en fuselaje trasero: lo
más lejos que permita la estructura y lo más atrás posible, de preferencia detrás del vaso de presión
de cabina.** Hallazgo reciente: **tren extendido y flaps** aportan mucho del ruido en sobrevuelo.

**Vulnerabilidad (§8.8).** *"Vulnerable area"* = área proyectada × P(matar el avión), **distinta por
dirección**. Reglas: *"If at all possible, fuel should not be located over or around the engines and
inlet ducts"* (el fluido hidráulico también arde: el 2º Have Blue se perdió por una soldadura
agrietada en una línea hidráulica) · **firewalls** entre bahías · **nada crítico donde puedan pegarle
álabes desprendidos**; motores gemelos en fuselaje: firewall + escudo de contención y **≥1 ft {30 cm}
de separación** · **nada crítico dentro de un arco de 5° del disco de la hélice** · **ni armas, ni
bombas, ni combustible cerca de la cabina; nada de combustible en el fuselaje de un avión de
pasajeros** · la redundancia mejora supervivencia **y empeora el mantenimiento**.

**Crashworthiness (§8.9).** El avión debe actuar como **amortiguador**. Dato brutal: en GA de ala
baja, **los de atrás sobreviven y los de adelante no**, porque van sentados sobre la caja del ala que
no colapsa. **Scarfed firewall:** inclina hacia atrás la parte baja — un firewall vertical *"escarba"*
el suelo y frena peligrosamente rápido. **Sin puntales de piso** desde el fuselaje inferior
(atraviesan el piso hacia arriba). **Nada pesado detrás y/o encima de las personas.**

**Producibilidad (§8.10).** Flat-wrap es la palanca #1 sobre el costo. **Part commonality:** tren
izquierdo = derecho; **cola horizontal sin comba** para que izq/der sean comunes aunque cueste algo de
aerodinámica. **Forjas = lo más caro y el ítem de mayor lead-time**; se necesitan cuando **una carga
alta pasa por un área pequeña** ⇒ *"The designer should avoid, if possible, such highly loaded
structure."* Los boards de gobierno comparan **densidad global (peso/volumen)** contra históricos
*"to ensure packaging realism"*. **Manufacturing breaks:** el corte típico va justo detrás de la
cabina; **no coloques componentes cruzando los cortes**. AM: buy-to-fly → **≈1** (100 lb maquinada
sale de un bloque de 2,000 lb); Lockheed Polecat, 90 ft de envergadura y 9,000 lb, mayormente AM,
**diseñado y construido en 18 meses**.

**Mantenibilidad (§8.11).** Métrica **MMH/FH**: de **<1** (avión privado chico) a **>100**
(bombardero/interceptor supersónico). **Métrica de mérito del layout: área total de puertas de acceso
/ área mojada del fuselaje** — los cazas modernos se acercan a **1/2**. Regla general: *"the best
access should be provided to the components that break the most often."* **Lo peor posible:** exigir
desensamble estructural mayor (AV-8B: hay que quitar **el ala entera** para sacar el motor). **Diseño
"one-deep":** nada que haya que quitar para llegar a otra cosa. Contraejemplo positivo: **el motor del
B-70 se cambiaba en 25 minutos.**

### 3.8 Cap 11 — tren de aterrizaje (la restricción que destruye layouts)

Del encabezado: **"Landing gear will ruin your layout more than anything else, so plan ahead."** y
**"This is no place for uninformed innovation."**

**Número de ruedas por peso**

| MTOW | Configuración |
|---|---|
| < 50,000 lb {22,680 kg} | 1 por strut (2 es mejor por pinchadura) |
| 50,000–150,000 lb | **2 por strut** |
| hasta ~250,000 lb | a veces todavía 2 por strut |
| 200,000–400,000 lb | **bogey de 4 ruedas** |
| > 400,000 lb {181,440 kg} | **4 bogeys de 4 o 6 ruedas** |

Casi todos usan **doble rueda de nariz** por control con pinchadura; naval, doble de **≥19 in** de
diámetro para librar la catapulta.

**⭐ Geometría del triciclo — las reglas clave**

| Parámetro | Valor |
|---|---|
| Ángulo de aterrizaje (fija la longitud del tren) | **10–15°**, con la punta del ala sin tocar en **5° de alabeo** |
| **Tipback / tail-strike** | ángulo de la vertical de la rueda principal al CG **> tipback o 15°, el mayor**; naval frecuentemente **>25°** |
| Límite superior | **>25° dificulta levantar la nariz** ⇒ **"porpoising" catastrófico** |
| **% de peso en la rueda de nariz** | **>20% ⇒ tren principal muy atrás**; **<5% ⇒ sin tracción para dirigir**; **ÓPTIMO 8–15%** |
| **Overturn angle** | **≤63°** (**54°** naval) |
| **Strut travel angle** | **7° óptimo**; **0–10° hacia atrás aceptable**; hacia adelante es **indeseable** |
| Despeje de hélice | **7 in {18 cm}** triciclo, **9 in {23 cm}** taildragger — con el strut de nariz **comprimido** y los principales **totalmente extendidos** |

Taildragger: **tail-down 10–15°** estático; **CG entre 16° y 25°** detrás de la vertical de la rueda
principal (adelante ⇒ capota, atrás ⇒ ground loop); separación lateral **>25°** respecto al CG.

**Tabla 11.1 — Dimensionamiento estadístico de llanta** `Dim = A·W_w^B` (W_w = peso sobre la rueda;
las principales llevan **~90%** del peso)

| Tipo | A diám (in) | B diám | A ancho (in) | B ancho | A diám (cm) | A ancho (cm) |
|---|---|---|---|---|---|---|
| Aviación general | 1.51 | 0.349 | 0.7150 | **0.312** ᵃ | 5.1 | 2.3 |
| Business twin | 2.69 | 0.251 | 1.170 | 0.216 | 8.3 | 3.5 |
| Transporte/bombardero | 1.63 | 0.315 | 0.1043 | 0.480 | 5.3 | 0.39 |
| Caza/entrenador jet | 1.59 | 0.302 | 0.0980 | 0.467 | 5.1 | 0.36 |

ᵃ El OCR perdió esta celda; **el valor es recuperable con certeza** porque el exponente B es idéntico
en imperial y en métrico, y la fila métrica sí lo trae (0.312).

Ajustes: **pista rústica +30%** en diámetro y ancho · **ruedas de nariz 60–100%** de las principales ·
bicicleta/cuadriciclo: delanteras **iguales** a las principales · **rueda de cola 1/4 a 1/3** de la
principal.

**Cargas y márgenes**
```
Carga estática máx (principal) = W·N_a/B
Carga estática máx (nariz)     = W·M_f/B
Carga estática mín (nariz)     = W·M_a/B
Carga dinámica de frenado (nariz) = 10·H·W/(g·B)     ← µ=0.3, deceleración 10 ft/s² {3 m/s²}
```
**FAR 25: +7%** de margen a todas las cargas de rueda, **+25% adicional** como allowance de
crecimiento. Sobrecarga dinámica permitida: **Tipo III = 1.4×** el estático, **Tipo VII y diseño nuevo
= 1.3×**; se toma **la mayor** entre el dimensionamiento estático y el dinámico.
`W_w = P·A_p` con `A_p = 2.3·√(w·d)·(d/2 − R_r)`; **rolling radius ≈ 2/3 del radio**. Operar a la
**mitad** de la carga y presión máxima **multiplica por ~6 el número de aterrizajes**.

**Presiones máximas por superficie:** portaaviones **200+ psi {1380+ kPa}** · aeródromo militar mayor
**200** · aeropuerto civil mayor **120 {828}** · tarmac buena cimentación **70–90** · mala **50–70** ·
pista metálica temporal **50–70** · pasto seco sobre suelo duro **45–60** · pasto mojado sobre suelo
blando **30–45** · arena compactada **40–60** · arena suelta **25–35**.

**Frenos:** `KE = ½·(W_landing/g)·V_stall²` ÷ número de ruedas frenadas. **Peso de aterrizaje =
80–100% del de despegue** (aterrizaje de emergencia inmediato). **Rim ≈ la mitad del diámetro de la
llanta**; si el rim requerido excede el de la llanta elegida, **sube de llanta**.

**⭐ CLEARANCE DE LLANTA — regla directa para el kernel**
*"Don't locate the tire so that it is tangent to the aircraft outer mold line"* — pasó en una revisión
de diseño real y hoy ese caza tiene un bulto en la puerta del tren (más arrastre y más RCS). En otros,
el pozo se metió al ducto de entrada ⇒ **problemas de flujo, mal desempeño del motor y hasta stalls**.
La llanta envejecida **crece ~2–3% en diámetro y 4% en ancho**. **Regla: claro de 3–5% del ancho de la
llanta ALREDEDOR de toda la llanta, más 1–2 in {3–5 cm} de estructura hasta la mold line.**
Y el margen: **"A home for the gear: find it early, or pay the price!"**

**Amortiguación (§11.4)**
```
S = V_vertical²/(2g·η·N_gear) − (η_T/η)·S_T                (11.12)
```
⭐ **La ecuación de stroke NO contiene el peso** — *"an airliner and an ultralight would require the
same stroke!"* **Regla de dedo: el stroke en PULGADAS ≈ la velocidad vertical en ft/s.**
**+1 in {3 cm}** de margen; **mínimo 8 in {20 cm}**, **deseable 10–12 in {25–30 cm}**. **Stroke de
nariz ≥ el principal** (confort al rodar).

| Tipo | V_vertical de diseño |
|---|---|
| Mayoría | **10 ft/s {3 m/s}** |
| Entrenador USAF | **13 ft/s {4 m/s}** |
| STOL | **15 ft/s {4.6 m/s}** |
| **Naval de portaaviones** | **20 ft/s {6 m/s} o más** (*"much like a controlled crash"*) |

Referencia: 4–5 ft/s es lo que un pasajero llama "mal aterrizaje"; >10 fps ocurre **menos de 1 en 10
millones** de aterrizajes comerciales.

**Tabla 11.4 — eficiencia η:** ballesta de acero 0.50 · resorte helicoidal 0.62 · resorte de aire 0.45
· bloque de hule 0.60 · bungee 0.58 · **oleo de orificio fijo 0.65–0.80** · **oleo de orificio medido
0.75–0.90** · llanta 0.47.
**Tabla 11.5 — factor de carga N_gear** (típico 3): bombardero grande 2.0–3 · comercial 2.7–3 · GA 3 ·
caza USAF 3.0–4 · **caza naval 5.0–6**.
**Oleo:** posición estática al **~66%** del recorrido (general), **~84%** transporte grande, **~60%**
GA. **Longitud total ≈ 2.5 × el stroke.** Presión interna típica **1800 psi {12,415 kPa}**; diámetro
externo **~30% mayor** que el pistón.

**Rueda castoreada (§11.5)**

| Caso | Rake | Trail |
|---|---|---|
| **Libre de girar** (y rueda de cola) | **−4 a −6°** | **0.2–1.2 × el radio**; si trail < radio, **puede requerir shimmy damper** |
| **Dirigible, avión grande** | **+7°** | **≥16% del radio** |
| **Dirigible, avión chico** | hasta **+15°** | **~20%** |

**Retracción (§11.6).** Casi todos los mecanismos son **four-bar linkage**. **Drag brace adelante con
retracción hacia ADELANTE es preferible: *"the air loads will blow the gear down in the event of a
hydraulic failure."*** **Punto de pivote: en cualquier lugar de la MEDIATRIZ del segmento que une la
posición abajo y la posición arriba de la rueda.** Trunnion **doble-canteado** (lateral + planta) para
que la rueda quede más al ras (Gripen) — y el detalle humano: *"Old time designers can be seen bending
and twisting a paper clip to visualize the trunnion angle."* Sobre rotator y planing links:
*"Such mechanisms aren't too complicated or heavy but should be avoided anyway if possible. They add
more cost, more design work, more part count in production, more maintenance, and one more thing that
can break — and wreck the airplane."*

**Dónde guardarlo:** en el ala (mínima penalización aerodinámica, **reduce la caja y el volumen de
combustible**) · en el fuselaje (**interfiere con los longerons**) · unión ala-fuselaje (**prácticamente
todos los transportes civiles**) · wing-podded (**ahorro de peso significativo**; A-10 y ex-bloque
soviético; penalización minimizada poniendo los pods en el TE por area-ruling) · fuselage-podded
(evita el bulto en la bodega, **penalización de arrastre sustancial**) · en la góndola (típico en
hélice; **en jet la góndola se ensancha ⇒ más arrastre**).

### 3.9 Cap 9 — cabina, pasaje y payload (vistazo)

**Visión sobre la nariz:** `α_overnose ≈ α_approach + 0.07·V_approach (kt)` (Ec. 9.1). Valores:
transportes y bombarderos militares **17°**; caza/ataque **11–15°**; entrenador con instructor atrás
**5°**; GA **5–10°**; L-1011 civil **21°**. **Visión abajo:** 35° sin mover la cabeza, 70° con la
cabeza contra el vidrio. **Arriba: ≥20°** sobre el horizonte. **Ninguna estructura de canopy más ancha
de 2 in {5 cm}.** **Ángulo rasante mínimo de la transparencia: 30°** (si no, el piloto ve el reflejo
del panel). Longitud de cabina de transporte: **150 in {3.8 m}** con 4 tripulantes, **130 in** con 3,
**100 in** con 2. Asiento eyectable requerido arriba de **q ≈ 230 psf {11 kN/m²}**; arriba de
**1200 psf** hace falta **cápsula** (la del B-1A pesaba ~9,000 lb).

**Tabla 9.1 — Cabina de pasajeros**

| | Primera | Turista | Alta densidad |
|---|---|---|---|
| Pitch in {cm} | 38–40 {97–102} | 34–36 {86–91} | 30–32 {76–81} |
| Ancho de asiento | 20–28 {51–71} | 17–22 {43–56} | 16–18 {41–46} |
| Ancho de pasillo | 20–28 {51–71} | 18–20 {46–51} | ≥12 {30} |
| Alto de pasillo | >76 {193} | >76 {193} | >60 {152} |
| Pax por tripulante de cabina | 16–20 | 31–36 | ≤50 |
| Pax por lavatorio (40×40 in) | 10–20 | 40–60 | 40–60 |
| Galley ft³/pax | 5–8 {0.14–0.23} | 1–2 {0.03–0.06} | 0–1 |

**Máximo 3 asientos por pasillo** ⇒ más de 6 abreast pide **dos pasillos**. Puertas y pasillos de
entrada **cada 10–20 filas**, ocupando **40–60 in {1–1.5 m}** cada uno. Pasajero **180 lb {82 kg}**
vestido y con equipaje de mano, más **40–60 lb** documentado. Volumen de carga por pasajero
**8.6–15.6 ft³ {0.24–0.44 m³}**. Y la nota amarga del autor: hoy las aerolíneas usan **31 in de pitch
× 17 in de ancho**, *"so the airlines can cram in more rows after they have bought the plane."*

**Claros de armamento:** **≥3 in {8 cm} al suelo en TODAS las actitudes** — incluyendo el peor caso
combinado: **una llanta y su strut totalmente desinflados, actitud tail-down máxima (15° o más) y 5°
de alabeo**; **doblar el claro en pista rústica**. **≥3 in entre armas**; **≥1 ft {30 cm} entre arma y
disco de hélice**. Cono de **10°** libre para lanzamiento por riel.
