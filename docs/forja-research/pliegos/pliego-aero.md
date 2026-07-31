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

