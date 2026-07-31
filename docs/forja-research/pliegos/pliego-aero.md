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
| **2. Peso W₀** | W₀ (o R si el motor es fijo y manda el desempeño) | W_e y W_f dependen de W₀ | `abs(W0_calc − W0) ≲ pocos %` | **ω = 0.75** hacia el calculado (§6.3.7); C del ajuste estadístico **debe ser negativo** o diverge |
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

### 3.10 Cap 12 — aerodinámica del layout "as-drawn"

**El encuadre honesto de §12.2:** *"these are all **'accounting fictions.'** They are defined just to
make calculation easier. **They don't represent the actual physics** of airflow over a vehicle."*
Solo hay dos cosas: presión (normal) y fricción (tangencial).

**Reglas de contabilidad**

| § | Regla |
|---|---|
| 12.3 | **`S_ref` es el trapecio COMPLETO hasta la línea central**, no el área expuesta |
| 12.3 | "counts": *"38 counts of drag mean a drag coefficient of 0.0038"* ⇒ **la UI muestra 4 decimales** |
| 12.3 | ⭐ *"The point at which a line from the origin is just tangent to the drag polar curve is the point of maximum lift-to-drag ratio. **Note that this is not the point of minimum drag!**"* — requisito de UI: dibujar esa tangente |
| 12.6.3 | *"The drag values used for performance calculations **should include the trim drag**"* |

**§12.4 Sustentación**
```
CLα = 2πA / { 2 + √[ 4 + (A²β²/η²)(1 + tan²Λ_maxt/β²) ] } · (S_exp/S_ref) · F     (12.6)
β² = 1 − M²   ;   η = c_lα/(2π/β)   ;   F = 1.07(1 + d/b)²                        (12.7–12.9)
```
- `Λ_maxt` = flecha de la línea de **máximo espesor**, NO la de c/4.
- Si no conoces c_lα(M): *"the airfoil efficiency η can be approximated as about **0.95**"*.
- ⭐ **Guardarraíl duro:** *"Sometimes the product (S_exposed/S_ref)·F is greater than one... This is
  unlikely and **should probably be suppressed by setting this product to a value slightly less than
  1.0, say, 0.98**."*
- Winglets/endplates: `A_eff = A(1 + 1.9h/b)` endplate (12.10); `A_eff = A(1 + h/b)²` winglet (12.11).
  *"An **expertly-designed winglet may have a 25% higher value** for the h/b term. For a poorly-designed
  winglet... **there may be no benefit at all.**"* Y: *"The effective aspect ratio corrections **should
  be used in the induced drag calculations**."*
- Supersónico: `c_lα = 4/β`, válido si `M > 1/cos Λ_LE`. Fuera de eso, cartas —
  *"difficult to predict without use of a sophisticated computer program"* y *"these charts give best
  results **only for trapezoidal wings without kinks or strakes**"*.
- ⭐ **Transónico (0.85–1.2): NO HAY MÉTODO.** *"there are **no good but quick estimation methods**...
  the calculated subsonic and supersonic values are plotted vs Mach number, then **a smooth curve is
  faired** between them."* → **Requisito: spline entre sub y supersónico, EDITABLE A MANO.**

**C_Lmax — la calculación menos confiable del libro**

> ⭐ *"the maximum lift coefficient of the wing **will usually determine the wing area** ... **the
> estimation of maximum lift is probably the least reliable of all of the calculations** used in
> aircraft conceptual design. Even refined wind-tunnel tests cannot predict maximum lift with great
> accuracy."*

Regla rápida: `C_Lmax = 0.9·c_lmax·cos Λ_0.25c` (12.15). **Tabla 12.1 — Δy (agudeza del BA)**:
NACA 4 dígitos `26·t/c` · 5 dígitos `26·t/c` · serie 64 `21.3·t/c` · serie 65 `19.3·t/c` · biconvexo
`11.8·t/c`. (Δy = separación vertical entre los puntos a **0.15% y 6%** de cuerda desde el BA.)

⭐ **A Mach alto la sustentación la limita la ESTRUCTURA, no la aerodinámica:** *"the available maximum
lift at Mach 1 is usually **enough to break the wings off!**"*

**Flaps**
```
ΔC_Lmax = 0.9·Δc_lmax·(S_flapped/S_ref)·cos Λ_HL     (12.21)
Δα_0L   = (Δα_0l)_airfoil·(S_flapped/S_ref)·cos Λ_HL (12.22)
```
**Tabla 12.2 — aporte de cada dispositivo (Δc_lmax):** Plain y split **0.9** · Slotted **1.3** ·
Fowler **1.3·c′/c** · Double slotted **1.6·c′/c** · Triple slotted **1.9·c′/c** · Fixed slot **0.2** ·
Leading-edge flap **0.3** · Kruger **0.3** · Slat **0.4·c′/c**.
Despegue: **60–80%** de esos valores. Δα_0l 2D: **−15°** en aterrizaje, **−10°** en despegue.
⭐ **`S_flapped` = área del ALA que lleva flap, no el área del flap** (dicho en el propio dibujo de la
Fig. 12.21: *"Area of wing having flap, not area of flap alone!"*).
Flap plain típico: `C_f = 30%` de cuerda, máximo a **40–45°** de deflexión. LEX: incremento
*"crudely estimated as **0.4**"* a alto α — pero *"a **LEX tends to promote pitch-up tendencies and so
must be used with care**"*.

> ⭐ *"Estimating a wing's maximum lift with flaps is **extremely difficult**... **Even tiny changes in
> the gap between wing and flap can have a large effect on lift.** An unexpected amount of flap
> structural bending can change that gap and **literally make the airplane stall at too high of a
> speed**."* ⇒ *"if at all possible, **it should be calibrated with test data on an actual airplane
> with similar flap geometry**."*

**§12.5.1 — El método rápido, `C_D0 = C_fe·S_wet/S_ref` (Tabla 12.3, VERIFICADA LITERAL):**

| Tipo de avión | C_fe |
|---|---|
| Bomber | 0.0030 |
| Civil transport | 0.0026 |
| Military cargo (high upsweep fuselage) | 0.0035 |
| Air Force fighter | 0.0035 |
| Navy fighter | 0.0040 |
| Clean supersonic cruise aircraft | 0.0025 |
| Light aircraft — single engine | 0.0055 |
| Light aircraft — twin engine | 0.0045 |
| Prop seaplane | 0.0065 |
| Jet seaplane | 0.0040 |

⭐ **Y su rol declarado: es EL VALIDADOR del método detallado** — *"suitable for initial subsonic
analysis and **for checking the results of the more detailed method** described in the next
section."* Mismo patrón que §1.4: el método barato audita al caro.

**§12.5.2–12.5.7 — Component buildup**
```
C_D0 = [ Σ_c (C_f,c · FF_c · Q_c · S_wet,c) ] / S_ref  +  C_D,misc  +  C_D,L&P        (12.24)
Laminar:    C_f = 1.328/√R                                          (12.26)
Turbulento: C_f = 0.455 / [ (log₁₀R)^2.58 · (1 + 0.144M²)^0.65 ]     (12.27)
R = ρVℓ/μ ;  ℓ = longitud total del fuselaje, ℓ = MAC para ala y colas
```
- *"On a smooth flat plate, **laminar flow will be maintained until the local Reynolds number reaches
  roughly half a million**."* Y el costo: *"The skin-friction drag can literally be **doubled** if the
  flow is turbulent rather than laminar."*
- ⭐ Dato duro (NASA, VariEze / Long-EZ / Bellanca Skyrocket): *"deliberately 'tripping' the flow to
  turbulent right at the wing leading edge caused a **25% increase in cruise drag of the whole
  airplane**."*

**Tabla 12.4 — flujo laminar alcanzable (% del área mojada)**

| Caso | Fuselaje % | Ala y colas % |
|---|---|---|
| GA — metal liso (sin remaches ni grietas) | 10 | 35 |
| GA — compuestos moldeados lisos | 25 | 50 |
| Planeador — compuestos moldeados lisos | 35 | 70 |
| Helicóptero — diseño tradicional | 0 | 0 |
| Helicóptero — diseño liso | 20 | 20 |
| Jet civil — metal de producción clásico | 5 | 10 |
| Jet civil — meta de investigación (pasivo) | 25 | 50 |
| Jet civil — meta de investigación (succión activa) | 50 | 80 |
| Militar con camuflaje | 0 | 0 |
| Supersónico — actual | 0 | 0 |
| Supersónico — meta con succión activa | 20 | 40 |

Notas al pie que son **reglas de validación del software**: improbable cerca de motores en el ala
(**1 diámetro a cada lado**) · improbable después de la grieta de una superficie móvil · más difícil
con más flecha · **detrás de la hélice, multiplica por 0.8 y 0.9** · son del área mojada **total del
ala**, no del perfil 2D · son **% del área mojada total**, no la longitud desde la nariz.

⭐ **Y quién carga la responsabilidad, literal:**
> *"This author's current best guesses are in Table 12.4, but **the final guess is yours**. If you
> guess higher values than you can actually attain, your airplane will look good in conceptual design
> analysis but **won't reach its range and performance goals when the airplane is built**. If you guess
> too far on the conservative side, **you may never get to build the airplane** because the predicted
> performance won't excite potential customers."*

Y el riesgo operativo, que casi nadie modela: *"After several takeoff and landing cycles, **dirt and
bug splatter** can reduce laminar flow enough to **affect both range and stall speed**. Perhaps such
airplanes will need to **factor a worst-case assumption for fuel reserves and approach speeds**."*

**Reynolds de corte por rugosidad**
```
Subsónico:              R_cutoff = 38.21·(ℓ/k)^1.053                (12.28)
Transónico/supersónico: R_cutoff = 44.62·(ℓ/k)^1.053·M^1.16         (12.29)
```
⭐ **La regla:** *"**If the calculated cutoff Reynolds number is lower than the actual Reynolds
number**, then the roughness will increase the drag, so **the cutoff Reynolds number should be
used**."* — es un `min()`, y es fácil implementarlo al revés.

**Tabla 12.5 — rugosidad k:** pintura de camuflaje sobre aluminio `3.33e−5 ft {1.015e−5 m}` · pintura
lisa `2.08e−5 {0.634e−5}` · lámina de producción `1.33e−5 {0.405e−5}` · lámina pulida
`0.50e−5 {0.152e−5}` · compuesto moldeado liso `0.7e−5 {0.052e−5}` *(las dos columnas de este último
renglón son inconsistentes entre sí — probable errata de OCR; verificar contra el impreso)*.
Cierre: el C_f final es el **promedio ponderado** de laminar y turbulento según el % alcanzable.

**Factores de forma FF (válidos hasta M_DD)**
```
Ala, cola, montante, pilón:
  FF = [ 1 + 0.6/(x/c)_m · (t/c) + 100(t/c)⁴ ] · [ 1.34·M^0.18·(cos Λ_m)^0.28 ]      (12.30)
Fuselaje y canopy liso:  Ec. (12.31) — el OCR la destruyó.
  Nota al pie del propio autor: *"In prior editions of this book, the fuselage form factor was
  given as FF = 1 + 60/f³ + f/400"*  ← ESTA es la que reproduce el DR-3 exactamente
  (f=8.218 → 1.129; canopy f=6.95 → 1.196)
Góndola y almacén liso:  FF = 1 + (0.35/f)                                            (12.32)
f = ℓ/d = ℓ/√(4·A_max/π)                                                              (12.33)
Diverter: doble cuña FF = 1 + (d/ℓ) ; cuña simple FF = 1 + (2d/ℓ)                     (12.34–35)
```
`(x/c)_m` = posición del espesor máximo: **~0.3** en perfiles de baja velocidad, **~0.5** en los de
alta. Y por qué cambió 12.31: la vieja *"seems to **overestimate drag for fineness ratios much below
5**"*; la nueva *"gives conservative (larger) values to account for the additional separation pressure
drag likely in real airplanes with a **short, fat fuselage**"*.

**Incrementos de FF:** cola con timón/elevador articulado **+10%** · fuselaje de lados cuadrados
**+30–40%** · casco de hidroavión **+50%** · flotador **×3** · canopy de dos piezas con parabrisas
carenado (F-15) **+40%** · canopy de caras planas (A-10, Me-109) **+300%** · cierre pronunciado ante
hélice propulsora *"author's wild guess: **reduce form factor increment by 50%** but **when the engine
stops, double it**"* · cuerpos optimizados con Stratford/CFD *"reduce the form factor increments above
by 10–20%, maybe more"* — pero *"**Ask your aerodynamics expert**, then carefully check CFD results to
confirm any savings."*

> ⭐⭐ **LA REGLA DE IMPLEMENTACIÓN #1, verificada literal (nota al pie de §12.5.4):**
> *"These form factor adjustments **should be applied only to the pressure-caused increment over the
> skin-friction drag, i.e., the portion of the form factor above 1.0.** If the calculated form factor
> is 1.2 and you wish to apply a 30% increase, **the resulting form factor is 1.26 not 1.56**."*
> Es decir `FF′ = 1 + 1.30·(FF − 1)`, no `1.30·FF`. **Un programador que lea solo "+30%" lo implementa
> mal y el error es silencioso.** El software tiene que hacerlo imposible.

Y el límite de aplicabilidad: *"**Don't apply them to automobiles or other non-airplane shapes**
because those can have much more airflow separation."*

**⭐ Factores de interferencia Q — los valores tabulados**

| Componente / condición | Q |
|---|---|
| Góndola o almacén montado **directamente** sobre fuselaje o ala | **1.5** |
| Góndola o almacén a **menos de ~1 diámetro** | **1.3** |
| Góndola o almacén **mucho más allá de 1 diámetro** | **≈1.0** |
| Misil en punta de ala | **1.25** |
| Ala alta, media, o baja **bien carenada** | **≈1.0** |
| Ala baja **sin carenar** | **1.1–1.4** |
| Fuselaje | **1.0** |
| Diverter de capa límite | **1.0** |
| Cola en V limpia | **1.03** |
| Cola en H | **1.08** |
| Cola convencional | **1.04–1.05** |

*"A favorable interference is possible... **Favorable interference is likely for components placed
underneath the wing.** ... we usually ignore it for preliminary analysis."* Y:
*"Interference drag is **best calculated by a high-end computational aerodynamics code**... For
preliminary estimation, **we have to guess it**."*

**Arrastres misceláneos**
```
Upsweep de fuselaje:  D/q = 3.83·u^2.5·A_max          (12.36)  ← u en RADIANES, medido desde el
                                                       EJE del fuselaje, no del vientre
Base drag subsónico:  D/q = [0.139 + 0.419(M − 0.161)²]·A_base   (12.37)
Base drag supersónico:D/q = [0.064 + 0.042(M − 3.84)²]·A_base    (12.38)
Hélice en bandera:    D/q = 0.1·σ·A_disco             (12.39)   [0.8 si NO se abandera]
Turborreactor en molinete: D/q = 0.3·A_frontal        (12.40)
```
⭐ *"**Roughly speaking, [base drag] should be expected any place where the aft angle to the freestream
exceeds about 20 deg.**"* Solidez de hélice: con AR de pala típico de **8**, `σ = 0.04 × nº de palas`.

**Tabla 12.6 — C_Dπ (por área frontal):** placa plana perpendicular **1.28** · esfera Re alto 0.10 /
Re bajo 0.3–0.5 · media esfera hueca abierta al frente **1.40** / atrás 0.40 · bala de base roma 0.30 ·
radiador expuesto 1.00 / carenado 0.3–0.5 · tomas de aire 1.2–2.0 · cuerno de mando 0.3–0.8 ·
aerofreno en fuselaje 1.00 / en ala 1.60 · parabrisas bien carenado **0.07** / de aristas vivas
**0.15** · cabina abierta 0.50 · paracaídas 1.40 · **rueda y llanta normal 0.25** · segunda en tándem
0.15 · carenada 0.18 · con fairing 0.13 · montante carenado (1/6 < t/c < 1/3) **0.05** · montante o
alambre redondo Re>3e5 **0.30** / Re<3e5 **1.17** · pata de ballesta plana **1.40** · horquilla o
herraje irregular 1.0–1.4.
Reglas del tren: **×1.2** por interferencia mutua entre componentes; **+7%** si las puertas quedan
abiertas con el tren abajo. Montantes: *"the optimal thickness ratio considering both aerodynamic and
structural efficiency is about **0.19 for a strut in tension** and about **0.23 for a strut in
compression**."*

**Tabla 12.7 — D/q absoluto (ft²/m²):** gancho de apontaje USN 0.15/0.014 · USAF 0.10/0.009 · puertos
de ametralladora 0.02/0.002 · puerto de cañón 0.20/0.019 · **piloto expuesto: en decúbito 1.20/0.111 ·
sentado 6.00/0.557 · en aspa 9.00/0.836**.

**⭐ §12.5.8 — Leakage & protuberance: los porcentajes (Tabla 12.8)**

| Tipo de avión | % del arrastre parásito total |
|---|---|
| Avión de hélice | **5–10** |
| Transportes jet o bombarderos | **2–5** |
| Cazas no-stealth | **10–15** |
| Cazas stealth | **3–5** |
| **Ala de flecha variable** | **+3% adicional** por los huecos y escalones del pivote |

Y la justificación de por qué es un porcentaje y no un cálculo:
> *"These are things that **don't appear on a configuration layout** during conceptual design and
> aren't fully defined until detail design and fabrication. **It simply isn't possible to calculate
> their drag directly — we don't know what they are!**"*

*"If special care is taken during design and manufacturing, these drag increments **can be reduced to
near zero but at a considerable expense**. Normally, **only race planes** are subjected to such extreme
'cleanup.'"*

**§12.5.9 Supersónico — la regla de bookkeeping que rompe todo si la olvidas**
> ⭐ *"the supersonic skin-friction drag **does not receive adjustments for form factors, nor for
> interference effects** ... In other words, **we set FF and Q equal to 1.0** and then add a wave drag
> term which incorporates them."* (Verificado en la corrida del DR-3: a M1.6 **todos los FF = 1.000**.)

```
Sears-Haack: (D/q)_wave = (9π/2)·(A_max/ℓ)²                                        (12.44)
Estimación:  (D/q)_wave = E_wd·[1 − 0.386(M−1.2)^0.57·(1 − πΛ_LE^0.77/100)]·(D/q)_S-H  (12.45)
```
**E_wd:** Sears-Haack perfecto **1.0** · avión muy limpio con delta mezclada **1.2** ·
caza/bombardero/SST típico **1.8–2.2** · distribución de volumen bumpy **2.5–3.0** · F-15 **≈2.9** ·
transporte subsónico (para trazar el drag rise) **≈4.0**.
Reglas de preparación de datos: **resta el área de captura de la toma a A_max** · resta de ℓ cualquier
tramo de **sección constante** · si el máximo de sección está **muy detrás del punto medio**, *"it
should be assumed that the fuselage length is **double the distance from nose to the location of
maximum cross-section area**"*.
Corrección del propio autor: *"this old empirical relationship **seems overly optimistic** and gets
better results by **replacing the 0.386 term with 0.2**."*
⭐ **La jerarquía de qué importa:** *"this efficiency factor is **less important in drag determination
than the fineness ratio** as represented by (A_max/ℓ). **This term is squared**, which explains why area
ruling that **actually reduces A_max** provides a far greater drag reduction than does merely smoothing
the volume distribution."*
Y el límite del ojo: *"At higher Mach numbers it is **very difficult to minimize total wave drag by
'eyeball' area ruling**. Instead it is more profitable to **smooth the entire configuration through
wing-body blending**."*

**§12.5.10 M_DD y drag rise — DOS definiciones que la UI debe soportar**
- **Boeing:** M_DD es donde el drag rise llega a **20 counts**; *"usually about **0.08 Mach above the
  critical Mach number**"*.
- **Douglas / USAF:** donde `dC_D0/dM` llega a **0.10**; *"typically **0.06 Mach above the Boeing
  M_DD**"* y representa **80–100 counts**.
- ⭐ *"**Jet transports usually cruise at about M_DD (Boeing) and have a maximum level speed of about
  M_DD (Douglas).**"*
- Ejemplo: el **Boeing 727** tiene M_DD ≈ **0.86 con C_L = 0.1**, pero con **C_L = 0.3** cae a **0.82**.
- Supercrítico: **multiplica el t/c real por 0.6** antes de usar las cartas.
- Fuselaje: *"If the fuselage is relatively blunt, it will experience shock formation before the wing
  does"* ⇒ ⭐ **calcula M_DD del ala Y del fuselaje, y usa el menor.**
- Simplificación permitida: *"For initial analysis it is acceptable to use a **single M_DD based upon a
  mid-mission weight and cruise altitude**."*

**Construcción gráfica del drag rise (Fig. 12.32) — algoritmo literal, 7 pasos:**
1. **A** = drag a M ≥ 1.2 por Ec. (12.45). 2. **B** = drag a M 1.05 *"typically equal to the drag at
Mach 1.2"*. 3. **C** = drag a M 1.0 = *"about **half** of the Mach 1.05 value"*. 4. **D** = drag rise en
M_DD = **0.002 por definición**. 5. **E** = M_cr = *"roughly **0.08 slower** in Mach number than M_DD"*.
6. Recta por B y C; curva de M_cr a M_DD que empalme suave — ⭐ *"**If a smooth curve cannot be drawn,
the M_cr point (E) should be moved until an approximately circular arc can be drawn.**"* Luego curva
suave de B a A. 7. Fricción transónica: **recta** entre la de M_DD (con FF y Q) y la de M1.2 (sin
ellos) — *"**This does not reflect any reduction in drag, merely a change in bookkeeping.**"*

Y el aviso teórico: *"The linear wave drag analysis gives **completely incorrect results in the
transonic regime** ... **drag rise below Mach 1.0 is in fact caused by the terms that are dropped in
the linear analysis!**"*

⭐ **Entregable gráfico que el cliente pide por su nombre (§12.5.12):** *"A **'Drag Map'** is a useful
and **under-appreciated tool** ... a plot of drag versus Mach number [that] includes the drag rise ...
**includes the drag-due-to-lift at various arbitrary lift coefficients** so there are several lines,
not just one. The Drag Map also includes the **lift coefficient effect on the drag-divergent Mach
number**, which is not apparent on a plot of C_D0 alone."*

**§12.6 — Drag due to lift: LOS DOS MÉTODOS y cuándo usar cada uno**

*Método A — Oswald span efficiency:*
```
K = 1/(π·A·e)                                                        (12.47)
Ala recta:     e = 1.78(1 − 0.045·A^0.68) − 0.64                     (12.48)
Ala en flecha: e = 4.61(1 − 0.045·A^0.68)(cos Λ_LE)^0.15 − 3.1       (12.49)   [Λ_LE > 30°]
Supersónico:   K = A(M²−1)cos Λ_LE / [4A√(M²−1) − 2]                 (12.51)
```
- *"The Oswald efficiency factor is **typically between 0.7 and 0.85**. Numerous estimation methods ...
  such as those by Glauert and Weissinger. **These tend to produce results higher than the values of
  real aircraft.** More realistic estimation equations **based upon actual aircraft** are presented
  here."* (fuente: Cavallo, NADC-AW-6604, 1966)
- ⭐ **Límites duros:** *"These equations **should only be used with 'normal' aspect ratios and sweeps
  and are not valid for high-aspect-ratio designs such as sailplanes**. For sweeps between 0 and 30,
  **linearly interpolate** between results from the two equations."*
- ⭐ Y la autocrítica: *"Note that this method is **simplistic**, and **you should consider using the
  superior 'leading-edge suction' method**."*
- Biplano: la e de Prandtl da **>1** y *"seems a bit optimistic ... it is suggested that the results be
  **multiplied by 0.8**"*. Supersónico: e cae a **0.3–0.5 a Mach 1.2**, y *"the leading-edge suction
  method presented next is **far preferable**"*.

*Método B — Leading-edge suction (el preferido):*
```
K = S·K₁₀₀ + (1 − S)·K₀ ,   K₁₀₀ = 1/(πA)  [subsónico] ,   K₀ = 1/C_Lα        (12.57)
Equivalencia:  e = 1/[ (πA/C_Lα)(1−S) + S ]                                    (12.58)
```
Por qué existe: *"For a wing with a large leading-edge radius this [K constante] is acceptable, but
**for most supersonic aircraft it gives a poor approximation.**"* Permite que **K varíe con C_L y con
Mach**, y *"reflects the impact of the designer's chosen wing design lift coefficient"*.

| Condición | S |
|---|---|
| Crucero subsónico, flecha moderada, radio de BA grande | **0.85–0.95** |
| Ala operando a **su propio C_L de diseño** (regla general) | **≈0.9** |
| Ala de alto alargamiento | **0.95–0.97** |
| Caza supersónico en viraje de alta g | **≈0** |
| Ejemplo del deterioro | *"A wing with an **S of 0.9 at its design C_L of 0.5** can have an **S value less than 0.3 at a C_L of 1.0**"* |

Física: *"in the worst case of zero leading-edge suction, **K is simply the inverse of the slope of the
lift curve**"* · *"A three-dimensional wing is considered to have **100% leading-edge suction when the
Oswald efficiency factor exactly equals 1.0**"* · *"In transonic flight, **starting at M_DD**, the shock
formation interferes with leading-edge suction ... **When the leading edge becomes supersonic, the
suction goes to zero.**"* (ocurre cuando el ángulo de Mach `arcsin(1/M)` iguala la flecha del BA).
Receta sin datos de ensayo para alto AR: supón `e = 0.8` en el C_L de diseño, despeja S de (12.58),
*"assumed to apply from zero lift up to about **0.1 C_L above the wing design C_L**, after which it
drops off to about **80%** of the equivalent design S at the stall lift coefficient. Although crude,
this approximation **correlates well with actual aircraft data and is more realistic** than simply
using Oswald's method."*
⭐ Y la confesión de práctica industrial: *"the big airliner companies often used a **straight flat
line** to the left of a value slightly higher than the design lift coefficient, and a **descending
straight line** to the right of it. **This crude representation simplified computer coding, way back
when.**"*

**Flaps y suelo**
```
ΔC_D0,flap = F_flap·(C_f/C)·(S_flapped/S_ref)·(δ_flap − 10)     (12.61)  [δ en grados]
   F_flap = 0.0144 plain ; 0.0074 slotted
ΔC_Di,flap = k_f²·ΔC_L,flap²·cos Λ_c/4                          (12.62)
   k_f = 0.14 full-span ; 0.28 half-span
Efecto suelo: K_eff/K = 33(h/b)^1.5 / [1 + 33(h/b)^1.5]         (12.60)  [si h < b/2]
```
Deflexiones típicas: **60–70°** aterrizaje, **20–40°** despegue; *"**Light aircraft usually take off
with no flaps.**"* Y: *"After the flaps are deflected, the lift distribution is far from elliptical so
the drag due to lift is increased and **possibly doubled**."*

**§12.7 CFD — el límite del método clásico, en números**
- ⭐ **Precisión del método clásico:** *"the classic industry practice of combining linearized computer
  codes with empirical data and corrections produced good results in most cases. **Actual
  flight-measured values of lift and drag are usually within about 2–10% of the estimates.** Also, the
  estimates are the most accurate for the cruise portions of the flight."*
- Su límite conceptual: *"These methods gave us numerical answers, but **they did not tell us why the
  design had problems, or how it could be improved**."*
- *"**CFD does not replace the wind tunnel.**"* · *"CFD results are **always somewhat suspect until the
  code has been checked against experimental data** for a similar configuration."* · ⭐ *"You can
  actually get **different answers for the same aircraft using two different gridding schemes** ...
  'this sensitivity is **more pronounced than that due to the type of mathematical model** being used,
  e.g., NS vs. Euler equations.'"*
- ⭐ El caso 737/CFM-56: la regla de dedo decía *"the inlet should be about **two inlet diameters
  forward** of the wing and about **one inlet diameter below** it"*; el CFD demostró que la
  "interference drag" **era arrastre inducido** — *"This important piece of information had not been
  determined in **20 years of wind-tunnel testing!**"*
- Y el modo de trabajo real: *"More often, though, we use CFD to identify problems ... and then **use
  designer intuition to revise the geometry** in hopes of solving the problem."*

### 3.11 Cap 15 — pesos

**Los CUATRO métodos (más un nivel cero), no tres**

| # | Método | Cuándo |
|---|---|---|
| 0 | Fracción estadística pre-layout | caps 3 y 6 |
| 1 | **Historical analogy** — *"a new component is thought to be similar to a component from an existing airplane"* | componente sin ecuación |
| 2 | **Statistics** — curve-fit | **es el §15.5, el nivel conceptual** |
| 3 | **Component selection** — *"might literally be taken from an existing airplane. **Use the actual weight.**"* | preliminar / detalle |
| 4 | **Structural analysis** — *"calculate the volumes, and multiply by material densities... **This is a large team effort, taking months or years.**"* | detalle |

Y el nivel rápido es **checador**: *"Such quick results can also be used to **check the results of the
more detailed statistical methods** later."*

**Tabla 15.2 — Approximate Empty Weight Buildup**

| Grupo | Cazas | Transporte y bombardero | Aviación general | **Multiplica por** | c.g. aprox. |
|---|---|---|---|---|---|
| Ala | 9 lb/ft² {44 kg/m²} | 10 {49} | 2.5 {12} | **S expuesta proyectada** | 40% MAC |
| Cola horizontal | 4 {20} | 5.5 {27} | 2 {10} | S expuesta | 40% MAC |
| Cola vertical | 5.3 {26} | 5.5 {27} | 2 {10} | S expuesta | 40% MAC |
| Fuselaje | 4.8 {23} | 5 {24} | 1.4 {7} | **S MOJADA** | 40–50% de la longitud |
| Tren | 0.033 | 0.043 | 0.057 | TOGW | centroide |
| Tren — Navy | 0.045 | — | — | TOGW | centroide |
| Motor instalado | 1.3 | 1.3 | 1.4 | peso del motor desnudo | centroide |
| "All-else empty" | 0.17 | 0.17 | 0.1 | TOGW | 40–50% de la longitud |

Nota: **15% al tren de nariz, 85% al principal**; *"**reduce gear weight by 0.014·W₀ if fixed gear**."*
⭐ **Trampa documentada: cada grupo usa un área DISTINTA** (expuesta vs mojada). No reutilices una sola
`S` en el código.
⭐ **Sanity check numérico explícito del cliente:** *"If the later calculation says that a
general-aviation airplane wing of **100 ft² should weigh 90 lb, something is probably wrong!**"*
(0.9 lb/ft² contra los 2.5 de tabla.)
⭐ Y la doctrina de presupuesto: *"**A weight budget is NOT a target.** If the wing weighs less than the
budget implies, **don't add rocks until the budget is met!**"*

**§15.5 — 59 ecuaciones estadísticas en tres juegos** (Fighter/Attack 15.1–15.24, Cargo/Transport
15.25–15.45, General Aviation 15.46–15.59). Lo que el software debe capturar:

*Alcance y no doble-contar (crítico):*
- *"W_flight controls includes the mechanisms, actuators, control linkages, and in-cockpit controls
  **but not the weight of the actual control surfaces** such as ailerons and flaps. **Those are
  included in the wing and tail weight equations.**"*
- *"The equations below for fighter and GA aircraft **do include the seats** (ejection seats for the
  fighters), but the equation for **transport aircraft does not**."*
- ⭐ *"A critical term W_dg is the **flight design gross weight**. For military aircraft this is **often
  less than the maximum takeoff weight**. A common assumption is that **only 50–60% of the fuel
  remains**."*

*Clamps duros que el tipo debe hacer cumplir:* `L_s/L_d ≥ 0.25` · `λ_vt ≥ 0.2` (GA) ·
*"ignore second term if W_fw = 0"*.
*Trampa de unidades:* **`L_m` y `L_n` van en PULGADAS; todo lo demás en pies.**
*Enums, no campos libres:* `H_t/H_v` = 0.0 convencional / 1.0 cola en T · `K_cb` 2.25 cross-beam
(F-111) / 1.0 · `K_door` 1.0 / 1.06 / 1.12 / 1.12 / 1.25 · `K_dw` 0.768 delta / 1.0 · `K_dwf` 0.774
delta / 1.0 · `K_Lg` 1.12 / 1.0 · `K_mp` 1.126 · `K_np` 1.15 · `K_vs` 1.19 · `K_y ≈ 0.3·L_t` ·
`K_z ≈ L_t`, entre otros 22.
*Rangos típicos:* `N_c = 0.5` para UAV · `N_f` 4–7 · `N_l = N_gear × 1.5` · ⭐ **`N_z = 1.5 × factor de
carga LÍMITE`** · `R_kva` 40–60 transportes / 110–160 cazas y bombarderos · `W_uav` 800–1400 lb.

**Tabla 15.4 — Fudge factors por material**

| Categoría | Grupo | Multiplicador |
|---|---|---|
| Compuestos avanzados | Ala | **0.85–0.90** |
| Compuestos avanzados | Colas | **0.83–0.88** |
| Compuestos avanzados | Fuselaje / góndola | **0.90–0.95** |
| Compuestos avanzados | Tren | **0.95–1.0** |
| Compuestos avanzados | Toma de aire | **0.85–0.90** |
| Ala arriostrada | Ala | **0.82** |
| Biplano arriostrado | Ala | **0.6** |
| Fuselaje de madera | Fuselaje | **1.60** |
| Fuselaje de tubo de acero | Fuselaje | **1.80** |
| Casco de hidroavión | Fuselaje | **1.25** |
| Avión de portaaviones | Fuselaje y tren | **1.2–1.3** |

*"These are approximations only, and are **subject to heated debate**. Some claim that a properly
designed steel-tube fuselage can be lighter than an aluminum fuselage. It's probably true, under
certain special conditions. **Usually not.**"* **No hay renglón de aluminio-litio, tela ni titanio.**

**Tabla 15.3 — pesos misceláneos (extracto):** pasajero comercial con equipaje de mano **190 lb {86}** ·
asiento de cabina de mando 60 {27} · asiento de pasajero 32 {15} · asiento de tropa 11 {5} · HUD 40 {18}
· cañón M61 250 {113} · 940 cartuchos 550 {250} · pilón y lanzador `0.12·W_misil` · lavatorios
largo alcance `1.11·N_pax^1.33` / corto `0.31·N_pax^1.33` / ejecutivo `3.90·N_pax^1.33` ·
gancho de apontaje USAF `0.002·W_dg` / Navy `0.008·W_dg` · catapulta `0.003·W_dg` · ala plegable
`0.06·W_ala`.

**⭐ Las advertencias — dónde las ecuaciones NO sirven**

| Inglés | Español |
|---|---|
| *"there is a **danger**. If a new design has a parameter that is **far from the values of the airplanes used to calibrate the equation**, it might give an answer that is **very wrong**."* | Fuera de la base de calibración, la respuesta puede estar muy mal |
| *"If you design a commercial transport with a **wing aspect ratio of 50, don't use** the wing statistical equation."* | Con AR de 50, no la uses |
| *"our real-world weights correlations are somewhat **stuck in the past** and need 'fudge-factor' adjustments for modern designs."* | Están ancladas en el pasado |
| ⭐ *"**Never change the takeoff gross weight on the Group Weight Statement!**"* | Nunca cambies el TOGW en el statement |
| *"there are **no 'right' answers** in weights estimation until the first aircraft flies."* | No hay respuestas correctas hasta que vuela |
| ⭐ *"the most common [mistake] being the use of **limit load factor**, where **ultimate load factor N_z should be used instead**"* — **y Raymer confiesa haberlo cometido en la 1ª edición** | El error #1: n límite donde va N_z último |
| *"a **novel configuration such as a canard pusher**, or an **advanced technology such as a laminar flow coating** may result in a **poor weights estimate**."* | Configuración novedosa = mala estimación |
| *"there have been **too few Mach 3 aircraft** to develop a good statistical database."* | — |
| *"a **top-level statistical equation for all UAVs is unlikely**."* | — |
| ⭐ *"**No airplane in its as-designed configuration should have or need any ballast weights**"* (F-104F >80 lb; X-15A cientos) | Ningún avión de diseño debe llevar lastre |
| ⭐ *"**We easily move the wing in Conceptual Design, and carefully do in Preliminary Design, but not after that.**"* | La ventana para mover el ala se cierra |
| *"**Temporary or removable ballast is a really bad idea**"*; y si existe, *"should be **painted red and labelled 'permanent ballast — do not remove.'**"* | — |
| F-35B: *"almost **10% over predictions**... reduce the limit load factor **from 9 to 7 g**"*; el A-12 se canceló por peso *"after billions were spent."* | El peso mata programas |

Márgenes declarados: **3–15%** de crecimiento + **~5%** de "unknown-unknowns"; crecimiento después del
primer vuelo **<2%/año** hoy (era 5%). **Raymer NO da un ±% de precisión por método.**

### 3.12 Cap 17 — desempeño: el mapa de restricciones

```
ΣFx = T − D − W·sin γ      (17.6)        ΣFz = L − W·cos γ      (17.7)
dW/dt = −C·T               (17.3)
C_equiv(hélice) = C_bhp·V/(550·η_p)  (17.4)      T = 550·bhp·η_p/V   (17.5)
```
> ⭐ *"These simple equations are the basis of the most detailed sizing and performance programs used
> by the major airframe companies... **The complications arise in determining what the angle of attack
> and thrust level should be** to perform some maneuver."*

**Requisito de arquitectura:** lo trivial es la ecuación; lo difícil es el **solver** que elige α y el
nivel de empuje. Y: *"the thrust level is restricted to the available thrust, as obtained from a
**table of installed engine thrust vs altitude and velocity**"* ⇒ **el empuje viene de una tabla
T(h,M), no de una fórmula.**

**LA TABLA DE RESTRICCIONES T/W ↔ W/S**

| Punto de desempeño | Restricción | Notas |
|---|---|---|
| **Vuelo nivelado / V_max** | `T/W = q·C_D0/(W/S) + K·(W/S)/q` (17.11) | cuártica en V; Raymer **no la resuelve** — manda al método gráfico |
| **Ascenso / gradiente G** | `T/W = cos γ/(L/D) + sin γ ≈ 1/(L/D) + V_v/V` (17.41) | γ < 15° ⇒ cos γ ≈ 1 |
| **Techo** | (17.41) con V_v = 0 / 100 / 300 / 500 fpm | ver definiciones |
| **Viraje sostenido n** | `n = √{ (q/(K·W/S))·[T/W − q·C_D0/(W/S)] }` (17.54) | ⭐ **ITERATIVA**: K = f(C_L) y C_L = f(n) |
| **Viraje instantáneo** | `ψ̇ = g√(n²−1)/V` (17.52) + límites C_Lmax y n estructural | corner speed = la intersección |
| **P_s en (n, M, h)** | `P_s = V·[T/W − q·C_D0/(W/S) − n²·K·(W/S)/q]` (17.89) | ⭐ *"T/W and W/S are at the given flight condition, **not the takeoff values!**"* |
| **Despegue (BFL)** | (17.113)–(17.115) | ver constantes |
| **Aterrizaje** | (17.102) inverso, **×1.666** FAR 25 | |
| **Envolvente** | P_s=0, pérdida, q límite, presión en el ducto, temperatura de piel | Fig. 17.17 |

**Definiciones numéricas de techo:** *"The '**absolute ceiling**' is determined by the highest altitude
at which **P_s = 0** ... FARs require **100 fpm {30.5 mpm} for propeller aircraft** and **500 fpm
{152 mpm} for jets** [en techo de servicio]. Military specifications require **100 fpm** at the service
ceiling (**300 fpm {91 mpm} for U.S. Navy**)."*

⭐ **La especificación de un caza ES una lista de restricciones:** *"Design specifications for a new
fighter will have **a large number of 'must meet or exceed' P_s points**, such as **P_s = 0 at n = 5 at
Mach 0.9 at 30,000 ft**."* ⇒ **el software debe aceptar una lista de puntos P_s(n, M, h) como entrada
de primera clase.**

**⭐ Constantes óptimas — gates de test aritméticos puros (cuestan minutos y atrapan errores de signo)**

| Condición | Valor |
|---|---|
| V de mínima potencia / V de mínimo arrastre | **0.760** (= 3^(−1/4)) |
| C_L de mínima potencia / C_L de mínimo arrastre | **1.73** (+73%) |
| L/D en mínima potencia | **0.866**×(L/D)max; arrastre real **+15.5%** |
| V de mejor alcance jet / V de máx L/D | **1.316**; C_D = **1.33·C_D0**; L/D = **0.866**×max |
| Alcance máximo con **hélice** | volar a **máx L/D** |
| Loiter jet | máx L/D. **Loiter hélice** = **V de mínima potencia** |
| Endurance derivada | `E = 1.14·R/V` (17.34) |
| Mínima resistencia | inducido **iguala** al parásito; `D_min = 2qS·C_D0` |
| Planeo de mínimo hundimiento | `C_L = √(3C_D0/K)`; V = **0.76**×V de mejor planeo; L/D = **0.866**×max |
| h_e a M0.9 / 30,000 ft | **42,447 ft {12,938 m}** |

> ⭐ **Discrepancia del propio libro que el pliego debe resolver:** §17.2.3 dice *"the minimum-power-
> required velocity is about **86.6%** of the minimum-thrust-required velocity"* — y contradice el 0.760
> de §17.2.2. El **0.866 es la razón de L/D, no de velocidad**. **Usa 3^(−1/4) = 0.760.**

**Despegue — todas las constantes**
```
S_G = (1/(2g·K_A))·ln[ (K_T + K_A·V_f²)/(K_T + K_A·V_i²) ]      (17.102)
K_T = T/W − μ  ;  K_A = (ρ/(2·W/S))·(μ·C_L − C_D0 − K·C_L²)     (17.103–104)
BFL = 0.863/(1+2.3G)·[(W/S)/(ρ·g·C_L,climb) + h_obs]·[1/(T_av/W − U) + 2.7] + 655/√(ρ/ρ_sl)   (17.113)
T_av,jet  = 0.75·T_TO·[(5+BPR)/(4+BPR)]                          (17.114)
T_av,prop = 5.75·bhp·[(ρ/ρ_sl)·N_e·D_p²/bhp]^(1/3)               (17.115)
γ_min = 0.024 (2 motores) / 0.027 (3) / 0.030 (4) ;  U = 0.01·C_Lmax + 0.02
```
Reglas: `V_TO ≥ 1.1·V_stall` · empuje promedio al **70% (1/√2) de V_TO** · C_L en tierra **< 0.1** sin
flaps grandes · μ de rodadura **0.03** en pista dura · rotación **3 s** (aviones grandes, `S_R = 3·V_TO`)
o **1 s** (pequeños) · transición a **1.15·V_stall** con **0.9·C_Lmax** · obstáculo **50 ft** militar y
civil pequeño, **35 ft** comercial · el piloto reacciona en **1 s** antes de frenar ·
*"**The use of reverse thrust is not permitted** for the balanced field-length calculations."* ·
FAR 25 = lo peor entre BFL y **+15%** sobre la distancia con todos los motores, y
*"**FAR 23 certified aircraft do not have to meet this double-trouble requirement.**"*
⭐ Y el acoplamiento geométrico: *"Remember that **landing-gear geometry can limit maximum angle of
attack** (and hence lift coefficient)."*

**Aterrizaje**
⭐ *"[Landing weight] ranges from the takeoff value to about **85% of takeoff weight**. **Landing weight
is not the end-of-mission weight** because this would require dumping large amounts of fuel."*
`V_a = 1.3·V_stall` (**1.2** militar) · ángulo de aproximación *"**no steeper than 3 deg**"* para
transportes · `V_TD = 1.15·V_stall` (**1.1** militar) · flare a **1.23·V_stall** (**1.15** militar) ·
`n = 1.2` · free roll **1–3 s** · μ de frenado **0.5 civil / 0.3 militar** · reversa **40–50%** del
empuje máximo (hélices **40%**, turbohélices **60%**), con corte a **~50 kt** ⇒ ⭐ *"The ground roll
must be broken into **two segments**"* · drogue `C_D ≈ 1.4 × A_frontal_inflada/S_ref` ·
**FAR field length = 1.666 × total**: *"The FAA requires that an additional **two-thirds** be added...
to allow for pilot technique."*
Viento: velocidad promediada = **0.29·V_i + 0.71·V_f**; *"**A time-domain 3-DOF simulation is probably
needed** to get a good answer."* Y: *"If for some reason a downwind takeoff or landing is attempted,
all distances increase dramatically. **Don't do that.**"*

**Tabla 17.1 — resistencia al rodaje** (rodadura / frenos): concreto o asfalto seco **0.03 / 0.5 civil,
0.3 militar** (del texto; las celdas se perdieron en el OCR) · mojado — / 0.15–0.3 · con hielo
0.02 / 0.06–0.10 · pasto duro 0.05 / 0.4 · tierra firme 0.04 / 0.3 · pasto blando 0.07 / 0.2 ·
pasto mojado 0.08 / 0.2.

**Envolvente de operación** — los límites, en el orden que los cita: **P_s = 0** · **pérdida** ·
**techos** · ⭐ **límite de eyección: 50,000 ft {15,240 m}** (*"The odds of surviving an ejection above
50,000 ft are rather small without an astronaut-type pressure suit"*) · **reencendido del motor a baja
q** (*"provided by the engine manufacturer"*) · ⭐ **q estructural 1800–2200 psf {86–105 kN/m²}** para
cazas, *"corresponds to transonic speeds at sea level"* · ⭐ **presión en el conducto de admisión**: el
inlet frena el aire a **Mach 0.4–0.5** en la cara del motor y la presión de pared *"can easily be
**three times** the outside dynamic pressure"*, y **no sigue la misma pendiente que el límite de q** ·
**temperatura de piel**. `q = 0.7·p_static·M²` (17.98).

**Alcance y crucero — el requisito de búsqueda numérica**
```
Breguet jet:    R = (V/C)(L/D)·ln(W_i/W_{i+1})          (17.23)
Breguet hélice: R = (η_p/C_power)(L/D)·ln(W_i/W_{i+1})  (17.28)   ← SIN V
Endurance jet:  E = (1/C)(L/D)·ln(W_i/W_{i+1})          (17.30)
```
Cruise-climb *"has been found to offer maximum range"*; el "stair-step" impuesto por control aéreo se
modela *"by **breaking the cruise legs into several shorter mission-segments**, using the appropriate
L/D values as aircraft weight drops."*
⭐ **Requisito duro:** *"Thus, Eqs. (17.25–17.27) are **not exactly correct in the real world**. A more
correct optimum condition for range can be found by **exhaustively searching throughout the flight
envelope** at the current aircraft weight, looking for the place where the range parameter (V/C)(L/D)
is at a maximum. **This is the method used by the computer programs in the major aircraft
companies.**"*
⭐ **Viento (17.35):** *"If you are sizing to a required range, **you must increase the required cruise
range R** ... by the ratio **(V_airspeed/V_groundspeed)** while still using the actual airspeed for V."*
Y: *"**you should fly faster into a headwind... slower if a tailwind**"*; *"**The wind has no effect on
loiter time** or loiter optimization airspeeds."*
⭐ **Validación obligatoria:** *"a maneuver involving a **reduction in energy height cannot put fuel
back in the tanks**, as would be implied by putting a negative value for the change in h_e."*
(El propio RDS de Raymer lo implementa e imprime
`NEGATIVE DELTA ENERGY HEIGHT - CHECK YOUR INPUTS - SEGMENT IGNORED`.)

**Energía-maniobrabilidad.** `h_e = h + V²/(2g)` · `P_s = V(T−D)/W` · `t = ∫dh_e/P_s`.
⭐ **El algoritmo programable para mínimo tiempo de ascenso**, dicho por el autor: *"These points can
also be found by **starting at the top of each energy height h_e curve and following it down to sea
level, noting the altitude where the highest value of P_s is found. This technique is easiest for
programming and automatically accounts for oddly shaped P_s curves.**"*
Criterios de combate: *"A turn-rate advantage of **2 deg/s** is considered significant"* · *"To win a
protracted dogfight, an aircraft should have **P_s = 0 contours that envelop those of an opponent**"* ·
corner speed **300–350 kt {560–650 km/h}**.
Empuje vectorizado: instantáneo `φ_T = 90° − α`, sostenido `φ_T = −α`. El Harrier crea *"almost **1-g**
of extra load factor"* y *"**Harrier pilots learn to use this sparingly.**"* Restricción de instalación:
*"**only works if the nozzles are located close to the aircraft center of gravity**"* (F-22 y F-35 no
pueden).

### 3.13 Cap 14 — cargas (lo que el pliego necesita)

⭐ **El V-n: la mitad se ELIGE, la otra mitad se calcula.**
> *"While we think of 'calculating' the V-n diagram, in fact **most of the diagram consists of
> parameters that we select**, including maximum positive load factor, most negative load factor, and
> maximum dive speed. **The positive and negative stall lines are calculated.** The straight line from
> negative load factor at cruise speed, to zero load factor at dive speed, is a common assumption."*

Secuencia: (1) **eliges** n⁺, n⁻ y V_dive; (2) **calculas** las parábolas de pérdida; (3) punto
**high AOA** = la velocidad más lenta que alcanza n_max sin entrar en pérdida; (4) punto **max q** en
V_dive con n_max; (5) cierras con la recta. **Todo en velocidad EQUIVALENTE.**

⭐ **Alerta histórica que ninguna fórmula da:** *"At high angle of attack, the load direction can
actually be **forward** of the aircraft body-axis vertical direction... During World War I, **several
aircraft had a problem with the wings shedding forward** due to this unexpected load."*
(`N = L·cosα + D·sinα`, `C = D·cosα − L·sinα`.)

Velocidades: `V_dive` **40–50% más alta** que la de crucero nivelado (subsónico) o *"about **Mach 0.2
faster** than maximum level-flight speed"* (supersónico) · `V_p` (maniobra) = *"the maximum speed at
which the pilot can **fully deflect the controls without damaging** either the airframe or the
controls"*, con `K_p = 0.15 + 5400/(W + 3300)` que *"**should not be allowed to fall below 0.5 or above
1.0**"* y en GA *"usually **does not exceed 0.9**"* · `V_f` = *"usually **twice the flaps-down stall
speed**"*.

**Tabla 14.2 — factores de carga límite típicos**

| Categoría | n⁺ | n⁻ |
|---|---|---|
| GA — normal | 2.5 a 3.8 | −1 a −1.5 |
| GA — utility | 4.4 | −1.8 |
| GA — aerobatic | 6 | −3 |
| Homebuilt | 5 | −2 |
| Transporte | 3 a 4 | −1 a −2 |
| Bombardero estratégico | 3 | −1 |
| Bombardero táctico | 4 | −2 |
| Caza | 6.5 a 9 | −3 a −6 |

**El factor de seguridad 1.5 y de dónde salió**
> ⭐ *"**Since the 1930s, the factor of safety has usually been 1.5.** This was defined in an Air Corps
> specification based upon the ratio between the ultimate tensile load and yield load of **24ST
> aluminum alloy**."*
> Y el corolario: *"Composites... will **fracture without warning**... **these materials do not have a
> 'built-in' 1.5 safety factor, so a safety factor must be assumed**"* — típicamente diseñar a
> **dos tercios (1/1.5)** de la deformación última.
> Y: *"when the aircraft exceeds its limit load factor, **some structural elements will be permanently
> deformed and must be repaired** after the aircraft lands."*

**Ráfagas.** `Δn = ρ·U·V·C_Lα/(2·W/S)` con `U = K·U_de`. `U_de = 30 ft/s {9.1 m/s}` estándar
(*"For most aircraft this produces roughly a **3-g** positive load factor"*) hasta V_C; *"For higher
speeds it can be assumed that **U_de drops linearly to 15 ft/s {4.6 m/s} at maximum dive speed**."*
⭐ **Dos contraintuiciones para el software:** *"the load factor due to a gust **increases if the
aircraft is lighter**"* · *"An **aft-swept wing** will experience roughly **15% lower load factor** due
to a given gust than an unswept wing."*
Y el límite del método: *"**not as complete or accurate** as the methods used at most large aircraft
companies. The more accurate methods rely upon a **power-spectral-density** approach."*

**Schrenk para la distribución de sustentación:** *"the load distribution on an untwisted wing or tail
has a shape that is **the average of the actual planform shape and an elliptic shape of the same span
and area**. **The total area under the lift load curve must sum to the required total lift.**"*
Con diedro, *"**Divide the lift by the cosine of the dihedral angle**"*. Con torsión, el ángulo de
sustentación nula *"**must be found by trial and error**"* ⇒ **otro lazo**.
⭐ **Límite duro:** *"**Schrenk's approximation does not apply to highly swept planforms experiencing
vortex flow**... Loads for such a planform **must be estimated using computers and wind tunnels**."*

**Reglas duras adicionales:** *"**the lifting surfaces are almost always critical under the high-g
maneuver conditions**"* · *"**Even the fuselage is almost always structurally sized by vertical
acceleration** rather than by the air pressures produced directly on the fuselage"* · ⭐ **acoplamiento
CH16 → CH14:** *"**The first step involves a stability-and-control calculation** to determine the
required lift on the horizontal tail... **the required tail lift will increase or decrease the required
wing lift** to attain the same load factor"* · el downwash del canard *"**moves the lift distribution
outboard, producing greater wing bending stresses than expected**"* · *"the instantaneous loads imposed
by **maximum aileron deflection while at maximum load factor (rolling pull-up)** are frequently
**critical to the wing structure**"* · fuerzas del piloto en sistema manual: palanca **167 lb** elevador
/ **67 lb** alerones, **rudder 200 lb** · tren: *"The vertical load factor applied to the airframe by
the landing gear is actually **something that we pick**, such as N = **3**"*, y *"**less favorable
landing scenarios that must be examined**: extreme tail-down landing, a one-wheel landing, and a
crabbed landing"*.
Materiales: *"**As a rule, the better the material properties, the more difficult it is to work
with.**"* · *"**The better the material, the more it usually costs.**"* · la fatiga *"is **probably the
single most common cause of aircraft material failure**"* · ⭐ *"'stress corrosion' can cause fracture
at a stress level **one-tenth the normal ultimate stress level**. For this reason **it is important to
avoid manufacturing processes that leave residual tension stresses**."*
Y el rol de los métodos clásicos frente al FEM (que es literalmente nuestro caso):
> ⭐ *"many of the methods presented are **no longer in regular usage**, having been supplanted by
> finite element methods... The older methods are useful, however, for **approximating the correct
> answer to ensure that the finite element method results are in the right 'ballpark'**."*

### 3.14 Cap 16 — estabilidad y control (criterios numéricos)

**Margen estático** `SM = X̄_np − X̄_cg = −C_mα/C_Lα`. *"The static margin is the **most important term**
in the longitudinal stability of an aircraft, and a target static margin... is **both a requirement and
a key design tool**."*

| Tipo | Margen estático |
|---|---|
| Transporte (en el c.g. más atrasado) | **+5 a +10% MAC** |
| Aviación general (Cessna 172) | **+19%** |
| Caza clásico estable | **≈ +5%** |
| Caza con RSS (F-16 / F-22 / F-35) | **0 a −15%** — *"coupled with a computerized flight control system... **This reduces trim drag substantially.**"* |

Correcciones: efecto de potencia en jets **−1 a −3%** · hélice: *"every mean aerodynamic chord length
that the propeller is ahead of the c.g. **reduces the stability by about 2%**"* · ala alta: **+10% de
la distancia vertical sobre el c.g. dividida entre la MAC** · eje de empuje: **un cuarto de por ciento
por cada 1% MAC que el eje esté arriba del c.g.** — pero *"**this benefit cannot be used to lessen the
aircraft's power-off static margin**"* · stick-free: *"the stick-free neutral point is **2–5% ahead of**
the stick-fixed neutral point"*.
⭐ **Flexibilidad aeroelástica en transporte en flecha (alto subsónico) — números que casi nadie
modela en conceptual:** C_Lα del ala **−20%**, momento de cola **−30%**, efectividad de elevador
**−50%**, el a.c. del ala **avanza ~10% MAC**, y los alerones *"**reduced by 50 to over 100%**"* ⇒
**aileron reversal** (el B-47 a **~470 kt**).
Centro aerodinámico: c/4 ±1% subsónico; **~45% MAC** supersónico.
`Δx_ac = 0.26(M − 0.4)^2.5` (0.4<M<1.1); `Δx_ac = 0.112 − 0.004M` (M>1.1).
**C_mα objetivo (por radián):** Transporte **−1.2 a −1.6** · Business/GA **−0.8 a −1.0** · Caza estable
**−0.2 a −0.6**. *"These can be used as **targets** for conceptual design. **Dynamic analysis during
later stages of design can revise these targets.**"*

**⭐ El coeficiente de volumen de cola como PISO DURO, no como estimación:**
> *"**vertical-tail size should not be reduced below the size indicated by the tail volume coefficient
> method until a six-DOF analysis has been conducted, preferably with wind-tunnel data** for the
> dynamic derivatives."*
> *"These rule-of-thumb methods result in a design that is **probably** as stable as desired and
> **probably** controllable as required. **To make sure, a better analysis is required just as soon as
> possible.**"*

**Estabilidad lateral:** *"**C_lβ should be of negative sign with magnitude about half that of the C_nβ
value at subsonic speeds, and about equal to it at transonic speeds.**"* Y la definición operativa:
*"C_lβ for a straight wing is approximately **0.0002 times the dihedral angle in deg**, so **1 deg of
'effective dihedral' is defined to be a C_lβ of 0.0002 per deg, or 0.0115 per radian**."*
*"**All terms should be negative except that the wing vertical placement term will be positive
(destabilizing) for a low wing.**"*

**Tabla 16.1 — radios de giro adimensionales** (`I_xx = b²WR_x²/(4g)`, `I_yy = L²WR_y²/(4g)`,
`I_zz = ((b+L)/2)²WR_z²/(4g)`; *"(In metric units, **don't apply the g term**.)"*)

| Clase | R_x | R_y | R_z |
|---|---|---|---|
| Monomotor de hélice | 0.25 | 0.38 | 0.39 |
| Bimotor de hélice | 0.34 | 0.29 | 0.44 |
| Business jet bimotor | 0.30 | 0.30 | 0.43 |
| Transporte bi-turbohélice | 0.22 | 0.34 | 0.38 |
| Transporte jet — motores en fuselaje | 0.24 | 0.36 | 0.44 |
| Transporte jet — 2 en el ala | 0.25 | 0.38 | 0.46 |
| Transporte jet — 4 en el ala | 0.31 | 0.33 | 0.45 |
| Entrenador jet militar | 0.22 | 0.14 | 0.25 |
| Caza jet | 0.23 | 0.38 | 0.52 |
| Bombardero jet pesado | 0.34 | 0.31 | 0.47 |
| Ala volante (tipo B-49) | 0.32 | 0.32 | 0.51 |
| Hidroavión | 0.25 | 0.32 | 0.41 |

Productos de inercia: *"**difficult to estimate at the conceptual level. As a rough guess, values from
similar airplanes can be ratioed by weight.** Normally, **products of inertia are ignored until the
stability and control group does a complete six-DOF analysis**."*

**Tabla 16.2 — MIL-F-8785B, requisitos de alabeo**

| Clase | Tipo | Requisito |
|---|---|---|
| I | Utilitario ligero, observación, entrenador primario | **60° en 1.3 s** |
| II | Bombardero medio, carga, transporte, ASW, reconocimiento | **45° en 1.4 s** |
| III | Bombardero pesado, carga, transporte | **30° en 1.5 s** |
| IV A | Caza-ataque, interceptor | **90° en 1.3 s** |
| IV B | Caza de combate cerrado | **90° en 1.0 s** y **360° en 2.8 s** |
| IV C | Caza con armamento aire-tierra | **90° en 1.7 s** |

Criterio alterno (NACA 715): *"**most pilots consider an aircraft to have a good roll rate if the wing
helix angle Pb/2V is at least equal to 0.07 (0.09 for fighters)**"*. Y la simplificación permitida:
*"aircraft generally reach maximum roll rate quickly; **the quasi-steady-state roll rate therefore can
be used to initially estimate the time to roll**."*

**Cooper-Harper — la escala 1-10 es un JUICIO DE PILOTO, no una ecuación.** Los tres bloques de
decisión: *satisfactorio sin mejoras* (1–3) · *deficiencies **warrant** improvement* (4–6) ·
*deficiencies **require** improvement* (7–9) · *improvement **mandatory*** (10). El 7 es el umbral
donde el desempeño adecuado ya **no es alcanzable** pero *"**Controllability not in question**"*; el 10
es **"Control will be lost"**. *"which is used by **test pilots**"* ⇒ **piloto en el lazo.**

**Departure (LCDP y C_nβ dinámico)**
```
LCDP    = C_nβ − C_lβ·(C_nδa/C_lδa)                  (16.65)
C_nβ,dyn = C_nβ·cos α − (I_zz/I_xx)·C_lβ·sin α       (16.66)
```
⭐ **Criterio numérico:** *"**Both of these parameters should be positive for good departure resistance.
A typical goal is to have C_nβ,dynamic greater than 0.004.**"* Las fronteras del diagrama de Weissman
*"determined from **high-g simulator tests using experienced pilots**"*.
⭐ **Y la advertencia que define el límite del conceptual:** *"the stability derivatives used to
calculate these departure parameters **become very nonlinear near the stall. First-order estimation
techniques used in conceptual design might not give usable results for departure estimation.** However,
the configuration designer can expect to be instructed to **'fix it' when the first wind-tunnel data
are available!**"*
Reglas de forma: *"An **elliptical nose cross section that has width greater than height is
desirable**"* · *"some sort of **strake or sharp edge on each side of the nose**"* · *"**Wing-tip
stalling should be prevented** by the use of **wing twist, fences, notches, or movable leading-edge
devices**"* · *"it is also desirable... to have a **substantial ventral-tail surface**."*

**Reglas prescriptivas selectas de CH16**
- ⭐ *"**Usually the most forward c.g. position is critical for trim. Aft-c.g. position is most critical
  for stability.**"*
- *"these methods are considered **crude by the stability and control community** and are only suitable
  for **conceptual design estimates and for student design projects**."*
- *"The tail lift-curve slope **should be reduced about 20% if the elevator gap is not sealed**"*
  (timón igual **20%**, alerones **15%**).
- Ground effect: a menos de **~20% de la envergadura** del suelo, las pendientes de sustentación
  **suben ~10%** y **el downwash se reduce a la mitad**. Requisito: *"**The aircraft must have
  sufficient elevator effectiveness to trim in ground effect with full flaps and full-forward c.g.
  location, at both power-off and full power.**"*
- Rotación de despegue: triciclo, *"the elevator should be powerful enough to **rotate the nose at 80%
  of takeoff speed with the most-forward c.g.**"*; taildragger, *"**lift the tail at half the takeoff
  speed with the most-aft c.g.**"*
- Motor crítico fuera: *"**at zero angle of sideslip at takeoff speed (1.1 × V_stall) with one engine
  out and at the aft-most c.g. location. Rudder deflection should probably be no more than 20 deg**."*
- Viento cruzado: *"**must be able to operate in crosswinds equal to 20% of takeoff speed**, which is
  equivalent to **holding an 11.5-deg sideslip**... **no more than 20 deg of rudder**."* Y hay que
  verificar los alerones ahí: *"An aircraft with a large amount of effective dihedral **might not have
  sufficient aileron area to prevent the aircraft from rolling away from the sideslip**."*
- *"The **vertical-tail aspect ratio should be increased for the endplate effects**... **Typically the
  effective aspect ratio will be about 55% higher** than the actual aspect ratio."*
- *"**Avoid confusing Q with dynamic pressure q.**"* · *"**Be careful**: the airfoil zero-lift angle is
  a negative value."* · *"a **consistent sign convention must be maintained, or the equations will be
  unusable**."* · *"A canard aircraft has a **'negative' tail moment arm**."*

---

## 4. LOS JUICIOS HUMANOS — dónde el software NO debe decidir

Raymer es explícito sobre qué es cálculo y qué es criterio. Esta sección es el mapa de **dónde el
producto debe abrir la puerta y quitarse**, porque automatizarlo produce basura plausible.

### 4.1 La selección de configuración

§3.6.1, el ejemplo ASW: el diseñador dibuja **cuatro** conceptos (convencional, nacelas sobre el ala,
canard con ala baja, canard con ala alta) y razona los compromisos de cada uno en prosa: las nacelas
sobre el ala dan sustentación extra por el chorro y separan el motor del suelo (menos FOD), pero
**dificultan el mantenimiento** y suelen dar arrastre de interferencia; el canard baja el arrastre de
trimado y amplía el rango de c.g. permitido, pero **complica poner flaps grandes → el ala tiene que
crecer**, y en canard **los tanques del ala quedan detrás del c.g.**, lo que obliga a tanques de
fuselaje (riesgo de fuego, prohibido en comercial) o a un strake lleno de combustible (más área
mojada).

Y la conclusión, que es la frase de cabecera del pliego:

> *"This example serves to illustrate an important principle of aircraft design — there is no such
> thing as a free lunch! ... The only way to determine whether a canard is a good idea for this or
> any aircraft is to design several aircraft, one with and one without a canard. This type of trade
> study comprises the majority of the design effort during the conceptual design process."*

**Requisito de producto:** el objeto de primera clase no es "el avión", es **el conjunto de aviones
competidores**. La UI tiene que hacer barato tener 4 configuraciones vivas a la vez y compararlas
número contra número. Un CAD de una-pieza-a-la-vez falla este requisito de raíz.

Y el criterio de decisión, §2.2.1: *"the wise designer will also design several aft-tail concepts,
and perhaps a tailless one, and **let the numbers (not opinion, prejudice, or preconceived notions)
make the final selection**."*

### 4.2 Cuándo el método estadístico ya no sirve

| Situación | Qué dice el cliente | § |
|---|---|---|
| El avión está fuera de la base de datos histórica | *"these equations were developed by the author using data from [6] and should be considered valid only within the normal range of maximum speeds for each aircraft class"* | §5.2.3 |
| Un avión "raro" (GlobalFlyer con W_e/W₀ < 0.18, lanzadores con < 0.10) | *"Don't expect that for an airplane with wings, landing gear, and other things that launch vehicles don't need"* | §3.3 |
| Compuestos | No hay suficientes aviones compuestos para hacer estadística: *"we usually fake it"* con un factor 0.95 | §3.3 |
| Ya hay layout | *"these equations are only suitable for use before the airplane layout is made, and they are not appropriate for design trade studies. After the layout is completed, the component weight buildup methods in Chapter 15 are used"* | §6.3.2 |
| Canard | *"For a canard aircraft, such rules of thumb are less reliable due to the..."* (coeficiente de volumen de cola) | cap 7 |
| C_Lmax | *"the 'real' answer takes a lot of work by a competent aerodynamics staff. Methods include CFD, historical comparisons, wind-tunnel test, and a bit of educated guesswork, but **you are never sure of the maximum lift coefficient until the airplane flies**"* | §5.3.2 |
| Crucero forzado fuera del óptimo | El método de L/D del cap 3 *"assumes that the aircraft is cruising at approximately the optimum altitude for the as-yet-unknown wing loading. It would be invalid if the aircraft were forced by the mission requirements to cruise at some other altitude such as sea level"* | §5.2.4 |
| El factor de Oswald a alto C_L | *"the efficiency factor e is itself a function of the lift coefficient... At high angles of attack the effective e value can be reduced by 30% or more. Unfortunately, the previous equations for turning flight are very sensitive to the e value. **If these equations yield W/S values far from historical values, the e value is probably unrealistic, and the calculated W/S values should be ignored**"* | §5.3.9 |

**⭐ Ese último renglón es un patrón de diseño de software, no un consejo.** El cliente pide un
**sanity check contra la historia como parte del solver**: si el resultado se sale del rango
histórico de su clase, el número no se muestra como respuesta — se muestra como **sospecha**. Es el
equivalente aeronáutico del gate de Kazmer. Y es exactamente lo contrario de lo que hace una hoja de
cálculo.

### 4.3 Dónde el cliente desconfía de la herramienta

- **Del CAD automático.** Paso 9 del Intermission: *"be very wary of automatic CAD systems and always
  check the results for reasonableness using rough approximations such as those provided in Chapter 7."*
  Habla de áreas mojadas y volúmenes: quiere el número del kernel **y** la aproximación de mano al lado.
- **De los programas de sizing enlatados.** Paso 4: *"If you have a 'canned' computer program available
  for rough initial sizing, by all means use it, but **be very suspicious of the results until you have
  checked it with a few hand calculations**."*
- **De las herramientas de "definición de requisitos" tipo House of Quality.** §2.1:
  *"this author has seen a tendency to devote excessive time and attention to such methods, to the
  detriment of actual aircraft design layout and layout-based trade studies. These methods are
  especially problematic when they amount to little more than a consolidation of guesswork...
  **You haven't drawn the airplane yet!**"* Su alternativa: *"get to an initial layout quickly and
  use it to assess relative importance and finalize the requirements."*
- **Del comité.** Cita a Kelly Johnson: *"there is a tendency today, which I hate to see, toward
  design by committee... Nothing very stupid will result, but nothing brilliant either."* Y el propio
  Raymer: *"We don't have a team vote on whether the wing will flutter off — the best technical
  expert makes that judgment."*
- **De la pre-optimización.** §5.4: *"It is also possible to select initial values for W/S and T/W by
  carpet plot or another optimization method (see Chapter 19). This is done using pre-layout estimates
  ... so this author believes that **the time spent usually isn't worth it. Push to a Dash-One layout
  as quickly as possible, then optimize from its geometry. ... don't believe it until you've redone
  the optimization using parameters taken from the real design layout.**"*

**⭐ Requisito de producto contraintuitivo:** el cliente **no quiere** que el software optimice antes
de que exista geometría. Quiere que el software lo empuje a dibujar. Un producto que abre con un
formulario de 40 campos y un optimizador está construido en contra del cliente.

### 4.4 Los compromisos de misión

- **Alcance vs payload vs peso.** El trade del ASW (§3.6.6): 1000 n mi → W₀ = 42,372 lb;
  1500 → 56,702; 2000 → 80,218. **No lineal y explosivo.** Payload 5,000 lb → 33,318;
  10,000 → 56,702; 15,000 → 78,866. Estos son los números con los que el diseñador va a negociar
  con el cliente. §3.6.7: *"the required range of 1500 n miles (each way) is probably less than the
  customer would really like."*
- **Cuándo relajar el requisito.** §2.2.1: *"The critical question is, 'Can any affordable aircraft
  be built that meets the requirements?' If not, it may be necessary to revise or relax the
  requirements."*
- **Riesgo tecnológico.** §2.3: *"An overly optimistic estimate of the technology availability will
  yield a lighter, cheaper aircraft ... but will also result in a higher development risk.
  Conversely, use of only 'yesterday's technology' will result in a heavy and underperforming
  airplane that nobody will buy!"* Con la escala TRL 1–9 como lenguaje común para discutirlo.
- **Motor fijo: alcance o desempeño, escoge.** §6.4: *"You cannot guarantee both range and
  performance, unless you're willing to buy a bigger engine."* Y la salida menos mala:
  *"One possibility is to reduce the payload, **but remember that payload is usually the reason for
  building the aircraft in the first place!**"*

### 4.5 El juicio sobre el gemelo bimotor

§5.3.3, un razonamiento que ninguna fórmula captura sola: *"a twin-engine aircraft has a greater
balanced field length than a three- or four-engine aircraft with the same total thrust ... **Because
of this, we usually design twin-engine aircraft with a higher total T/W.**"* Y en la Tabla 5.1, la
nota de que la dispersión de T/W de los transportes comerciales (0.25–0.4) es exactamente eso: los
valores altos son bimotores. *"With one engine out, all of the transports have a T/W of around 0.2."*
### 4.6 ⭐ La mentalidad "show-me" y la CALIBRACIÓN contra un avión conocido

El resumen del cap 23 (conceptos no convencionales) fija el estándar de prueba para cualquier idea
brillante:

> *"Innovative aircraft concepts are a lot of fun and are sometimes worthwhile, but designers need to
> study them with a **'show-me' mentality** focusing on **weight, wetted area, and trimmed maximum
> lift**."*

Tres números, no veinte. Un ala volante, un canard, un joined-wing o una configuración asimétrica
se juzgan por **peso, área mojada y sustentación máxima TRIMADA** — y la palabra "trimada" es la
trampa: mucha configuración exótica gana C_Lmax bruto y lo pierde todo al trimar.

Y el pasaje sobre diseños derivativos (§23.x) da el **patrón de validación de software** más
transferible del libro entero:

> *"Our analysis tools, suitable for conceptual design, are forced to almost perfectly match the
> known capabilities of the original airplane. Otherwise, nobody will believe the numbers for the
> modified airplane. This often requires 'tweaking' and 'fudge-factoring' the analysis inputs until
> the correct answers are obtained. Once we have calibrated the analysis to the unmodified aircraft
> and can match the range and key performance points, we can define the required changes..."*

**Requisito de producto:** el módulo necesita un **modo de calibración**: cargas un avión real con
sus datos publicados, el software ajusta los factores de corrección hasta reproducir su alcance y
desempeño, y **solo entonces** te deja modificarlo. Los deltas son creíbles aunque los absolutos no
lo sean. Es exactamente lo contrario de "corre el solver y cree el número".

Y el aviso sobre los métodos estadísticos en derivativos: *"The weight of a modified part is greater
than the weight of that part if designed all new. Often, a simple pounds-per-square-foot method is
better than a sophisticated statistical equation."* — **más sofisticado no es más correcto** cuando
estás fuera del dominio de la estadística.

### 4.7 El catálogo completo de "esto es criterio, arte o experiencia"

Cada renglón marca una frontera del producto: **aquí el software asiste, no decide.**

| § | Lo que dice | Qué significa para nosotros |
|---|---|---|
| 4.2 | *"Even in such a simple decision, aircraft design is always a compromise."* (radio de LE) | Nunca hay un "óptimo" que mostrar como respuesta única |
| 4.8 | *"Once again, design is a tradeoff."* (A vs peso) | — |
| 4.13 | ⭐ *"Unfortunately, there isn't a simple technique for selecting the correct dihedral angle. Like so many parameters in initial design, the dihedral angle must be estimated from historical data and then revised following analysis of the design layout."* | **La tabla histórica no es la respuesta, es el punto de partida** |
| 4.19 | *"the T-tail is considered stylish, which is not a trivial consideration"* | La estética **es** un requisito, y el cliente lo dice en serio |
| 4.19 | ⭐ *"Sometimes, though, one of our customer's needs — perhaps unstated — is to fly an airplane that really looks innovative and exotic, regardless of its technical merits!"* | Existen requisitos **no declarados** que ganan a los números |
| 4.21 | *"it is usually acceptable simply to draw tail surfaces that 'look right,' based upon prior experience and similar designs"* | En conceptual, el ojo entrenado sustituye al cálculo — con el **área** amarrada |
| 7.1 | ⭐ *"It has to be expertly done and is not a job to assign to someone based just upon CAD skills. In the past, a person needed about 10 years of experience in other areas, usually aerodynamics and structures, before he or she would be allowed to join the configuration layout group."* | **Saber CAD ≠ saber diseñar.** Y aun con 10 años, había aprendizaje antes del primer "blank sheet" |
| 7.3 | ⭐ *"Quite simply, there is too much 'art' involved."* (splines de madera) | **La frase que justifica un kernel matemático** |
| 7.4 | *"a designer with a 'good eye' can obtain sufficient smoothness using a French curve"* | — |
| 7.8 | *"For initial layout purposes the fillet is frequently 'eyeballed'... a fillet radius that 'looks good' can be used."* | — |
| 7.8 | *"Note that this is a very crude estimate!"* (MAC combinada de canard sustentador) | El autor **etiqueta** su propia incertidumbre; nosotros también debemos |
| 8.2 | ⭐ *"aerodynamic design doesn't start with calculations, it starts with the initial design layout. During concept layout, the designer must consider the requirements for aerodynamics based upon experience, understanding, and a 'good eye'."* | El análisis viene **después** del criterio, no antes |
| 8.2 | ⭐ *"The greatest compliment a designer will ever receive: 'He (or she) can see air.'"* | El objetivo de la Escuela, dicho por el cliente |
| 8.2 | *"We airplane designers just call it a railroad curve, and eyeball it to look like this. It works."* (Euler spiral) | — |
| 8.3 | *"A good designer with a 'calibrated eyeball' can prevent a lot of lost effort."* / *"There is no easy formula for the estimation of structural clearance... The best way to gain this judgment other than actual design experience is by looking at existing designs."* | **Requisito: biblioteca de diseños existentes navegable y medible** |
| 8.3 | *"Only a trade study can ultimately determine which approach is lighter for any particular aircraft."* (kink de longeron) | — |
| 8.2.4 | *"found by trial and error, both in the wind tunnel and in flight test"* (vortex generators) | Hay cosas que **no** se calculan |
| 8.10 | *"Design for producibility requires experience that no book can provide."* | — |
| 7.11 | ⭐ *"with a CAD system, everybody's designs look good whether they are or are not!... Today, it 'takes one to know one'."* | El CAD **borró la señal de calidad** que daba la técnica de dibujo |
| 11 | *"This is no place for uninformed innovation."* (tren) | Hay subsistemas donde la creatividad es un defecto |
| 11.6 | *"Old time designers can be seen bending and twisting a paper clip to visualize the trunnion angle."* | El clip es la interfaz que hay que superar |
| 6.6 | *"Then, don't trust the result — use a more sophisticated analysis method as soon as possible."* | Cada método rápido **declara su propia caducidad** |
| 8.1 | *"The configuration designer will never be expert in all of these, but needs to know them well enough to make the layout and talk to the experts."* | El perfil de usuario objetivo: generalista que integra |


---

## 5. CRITERIOS DE ACEPTACIÓN — qué revisa antes de congelar un concepto

Reconstruidos del Intermission (pasos 8–10), §2.2.2, §5.4, §12.1 y los resúmenes de capítulo.

### 5.1 Gate A — el sizing cierra

- [ ] El lazo de W₀ **convergió** (|W₀_calc − W₀| dentro de pocos %) y el exponente C es negativo.
- [ ] Todos los W/S y T/W están **ratiados a condiciones de despegue** antes de compararse.
- [ ] Se tomó el **mínimo** de los W/S y el **máximo** de los T/W, y se documentó **quién manda** en
      cada uno (¿la pérdida? ¿el ascenso con motor fuera? ¿la catapulta?).
- [ ] Se hizo el **recheck**: recalcular con el par (T/W, W/S) elegido.
- [ ] Ningún W/S "ridículamente bajo" se aceptó sin cuestionar el requisito que lo produjo.
- [ ] El resultado cae dentro del rango histórico de su clase (Tablas 3.1, 5.1, 5.2, 5.5). Si no,
      se explica por qué.

### 5.2 Gate B — el dibujo cierra

- [ ] **Todo cabe.** Suficientes secciones transversales dibujadas *"to verify that everything fits"* (§2.3).
- [ ] **El tren de aterrizaje cabe arriba y abajo.** Es la restricción que "puede destruir tu layout".
- [ ] El **volumen de combustible disponible** (medido en el layout) ≥ el requerido por el sizing (§6.5).
- [ ] Las **estaciones de control** son las mínimas necesarias y los contornos longitudinales **no
      hacen wiggle**.
- [ ] El **c.g.** cae donde se quiere, y **se mueve poco al quemar combustible** (§3.6.1: *"the fuel
      tanks should be placed so that the fuel is evenly distributed about the aircraft center of
      gravity ... so that the aircraft when loaded has nearly the same center of gravity as when its
      fuel is almost gone"*).
- [ ] **La tabla de parámetros está en el dibujo**: geometría de ala y colas, W₀, peso y volumen de
      combustible, motor y su escala, área de captura, geometría de hélice. *"This information will
      greatly aid those who later attempt to analyze the drawing."*

### 5.3 Gate C — el análisis as-drawn confirma (o no) al sizing

- [ ] Arrastre por **component buildup** sobre las áreas mojadas REALES (cap 12), no el L/D estadístico.
- [ ] Peso por **suma de componentes** (cap 15), no la fracción estadística.
- [ ] Empuje **instalado** (cap 13), no el de catálogo.
- [ ] **Re-sizing** con esos números. Y la expectativa honesta del cliente:
      *"a revised sizing calculation that will almost always tell you that the design you drew doesn't
      really work!"* — **que no cierre en la primera vuelta es lo NORMAL, no un fallo.**
- [ ] **Estabilidad y control** (cap 16): margen estático (¿hay que mover el ala?), trimado, pull-up,
      viraje (¿el elevador y el estabilizador son suficientes?), lateral (¿el vertical, el timón y los
      alerones?). El resumen del cap 16 es literalmente esa lista de decisiones.
- [ ] **Desempeño** real (cap 17) contra cada requisito, no contra la estimación de la restricción.
- [ ] **Costo** (cap 18). *"Cost is the real design measure of merit."*

### 5.4 Gate D — está listo para congelar

- [ ] Se estudiaron **varias configuraciones alternativas**, no una.
- [ ] Los números —no la opinión— eligieron entre ellas.
- [ ] Hay una **lista escrita** de qué está mal y qué se va a arreglar en la siguiente vuelta.
      Este es el criterio de calificación explícito del autor: la lista de defectos vale más que la
      confianza.
- [ ] Se pensó en **crecimiento**: *"Does the design have growth potential, or would a future
      fuselage stretch be impossible due to, say, tail-down ground angle?"*
- [ ] Nadie se enamoró del diseño.

**Y el criterio de "congelar" es organizacional, no numérico** (§2.2.2): *"At some point the company
believes that it has sufficient information to 'freeze' the design, forbidding further changes to
the overall design arrangement. This schedule milestone is crucial because it allows other designers
to begin serious development of structure and subsystems without fear that their work will be
invalidated by later changes."* En el software esto se traduce en **versionado con congelamiento
explícito**: el layout congelado es una entidad, no un estado de ánimo.


---

## 6. AERODINÁMICA: QUÉ CORRE EN EL NAVEGADOR Y QUÉ EXIGE CFD DE VERDAD

Fuentes: Anderson (**A**) y Bertin & Cummings (**B**). Todo lo marcado **[DERIVADO]** no está en los
libros y hay que **declararlo como extensión**, igual que hicimos con Kazmer.

### 6.1 Tabla maestra de costo — lo que SÍ corre

| Método | § | Entra | Sale | Sistema | Costo real |
|---|---|---|---|---|---|
| **Thin airfoil** (simétrico y cambado) | A §4.7–4.8 / B §6.3–6.5 | `dz/dx(x)`, α, c | c_l, α_L0, c_m,c/4, x_cp, γ(θ) | **ninguno** | microsegundos |
| **Source panel 2D** | A §3.17 / B §3.16 | contorno cerrado en N paneles | λ_j → C_p | N×N densa | N=100 → instantáneo |
| **Vortex panel 2D** | A §4.10 | contorno, V∞, α | γ_j → C_p, Γ, L′ | N×N (1 fila = Kutta) | igual |
| **Lifting-line (Fourier)** | A §5.3 / B §7.3 | c(y), torsión, a₀, α_0l, AR, λ | A_n → C_L, C_Di, δ, e | N×N con N = 4…10 | microsegundos |
| **Lifting-line numérica NO LINEAL** (post-stall) | A §5.4 | curva c_l(α_eff) **experimental** por estación | Γ(y) post-stall | iterativo, sin matriz | 50–150 iteraciones |
| **VLM (herradura)** | B §7.5 / A §5.5 | malla M×N sobre la superficie media | Γ_n → C_L, C_Di, C_m | **2N×2N** densa | 10×4 → nada |
| **Prandtl-Glauert / Kármán-Tsien / Laitone** | A §11.4–11.5 / B §9.1 | C_p0(x), M∞ | C_p(M∞) | ninguno | nada |
| **M_crit** (intersección de curvas) | A §11.6 | C_p0,min | M_cr | escalar no lineal, ~6 iter | nada |
| **Blasius / Falkner-Skan** | A §18.2 / B §4.3 | β(x) o placa plana | δ, δ*, θ, c_f | ODE + shooting | milisegundos |
| **Integral turbulento (Head + Cebeci-Bradshaw)** | B §4.7.2 | u_e(x), θ₀, H₀ | θ(x), H(x), C_f(x), **separación** | 2 ODEs acopladas | milisegundos |
| **Choque oblicuo (θ-β-M)** | A §9.2 / B §8.6 | M₁, θ, γ | β débil/fuerte, M₂, p₂/p₁ | escalar, bisección | nada |
| **Prandtl-Meyer** | A §9.6 | M₁, θ | ν, M₂, p₂/p₁ | escalar, Newton | nada |
| **Shock-expansion** (perfil poligonal) | A §9.7 / B §10.3 | polígono, M∞, α | C_p por panel → c_l, c_d, c_m | secuencia de escalares | nada |
| **Ackeret / Busemann 2º orden** | A §12.2–12.3 / B §10.1–10.2 | dz/dx, α, M∞ | c_l, c_d, c_m | ninguno | nada |
| **Taylor-Maccoll (cono)** | A §13.6 | M∞, θ_s | θ_c, campo cónico | 1 ODE + disparo | ms; **precalcula LUT** |
| **Newtonian / modified Newtonian** | A §14.3 / B §12.2, 12.4 | normales de la malla, M∞ | `C_p = C_p,max·sin²θ` | ninguno | nada |
| **Component drag buildup** | B §5.4.6 | S_wet, mac, K, Re | C_D0 total | ninguno | nada |
| **Método de características** (tobera 2D) | A §13.2–13.3 | condición inicial supersónica | malla + **contorno de la tobera** | marcha | nada |

**Ya tenemos tres de estos en el repo** (`potencial.ts` = Joukowski+Kutta, `cuna-anderson.ts` =
integración de p y τ, `viento.ts` = θ-β-M + choque oblicuo). El resto son días, no meses.

### 6.2 Teoría de perfil delgado — el único método sin matriz

```
(1/2π) ∫₀^c γ(ξ)dξ/(x−ξ) = V∞·(α − dz/dx),   con γ(c) = 0   (Kutta)   A Ec.(4.18)
Glauert: ξ = (c/2)(1−cosθ)
γ(θ) = 2V∞[A₀(1+cosθ)/sinθ + Σ A_n sin nθ]
A₀ = α − (1/π)∫₀^π (dz/dx) dθ                       (4.50)
A_n = (2/π)∫₀^π (dz/dx) cos nθ dθ                    (4.51)
c_l = π(2A₀ + A₁) = 2π(α − α_L0)                     (4.56/4.60)
α_L0 = −(1/π)∫₀^π (dz/dx)(cosθ − 1) dθ               (4.61)
c_m,c/4 = (π/4)(A₂ − A₁)                             (4.64)
x_cp = (c/4)[1 + (π/c_l)(A₁ − A₂)]                   (4.66)
```
⭐ **`dc_l/dα = 2π` SIEMPRE**, con comba o sin ella — la comba solo corre la curva. Y **solo A₀, A₁ y
A₂ entran en c_l y c_m**: el resto de la serie es irrelevante. Un implementador que calcule 20
términos está tirando ciclos.

**Rango de validez declarado** (A §4.9): *"applies only to thin airfoils at small angles of attack ...
the results compare favorably with experimental data for airfoils of about **12 percent thickness or
less**."* Y el gate operativo de B: *"Since the theory presumes that viscous effects are small,
**it is valid only for angles of attack below stall**."*

⭐ **Guardia numérica obligatoria:** `x_cp → ∞` cuando `c_l → 0` (A §4.8: *"as the lift approaches
zero, x_cp moves toward infinity; that is, it leaves the airfoil"*). Reporta el centro aerodinámico,
no el centro de presión, cerca de sustentación nula.

### 6.3 Paneles 2D — donde están todos los gotchas de implementación

**Source panel.** Sistema `λ_i/2 + Σ_{j≠i} (λ_j/2π)·I_ij + V∞ cos β_i = 0` (A Ec. 3.153), con la
**diagonal analítica `λ_i/2`** — nunca integres j=i. El coeficiente de influencia tiene forma cerrada
(Ec. 3.163). El **operador tangencial tiene diagonal CERO**: *"The tangential velocity on a flat
source panel induced by the panel itself is zero."*

⭐ **Cuántos paneles, la cita canónica** (A §3.17): *"a circular cylinder can be accurately represented
by **as few as 8 panels**, and most airfoil shapes, by **50 to 100 panels**."* Y el mallado:
*"cover the leading-edge region with a number of small panels ... larger panels over the relatively
flat portions"*, con *"in general, all the panels can be different lengths"*.

⭐ **`Σ λ_j·S_j = 0` es un TEST a posteriori, no una ecuación de reemplazo** (A Ec. 3.157:
*"provides an independent check on the accuracy"*). **Corrección importante a la creencia común:**
Anderson **nunca** dice que el sistema de fuentes sea singular ni mal condicionado — un barrido de
`singular|ill-condition|rank` sobre todo el capítulo no da nada. Si el diseño del módulo quiere
reemplazar una fila por el cierre de masa, **hay que declararlo como extensión**, no citarlo.

**Vortex panel — aquí sí hay singularidad, y es estructural.** La condición de Kutta numérica es
`γ_i = −γ_{i−1}` en el borde de fuga, con *"the two panels at the trailing edge ... be very small"*.
Y entonces (A §4.10, literal):

> ⭐ *"Equation (4.80) evaluated at all the panels and Equation (4.81) constitute an **overdetermined
> system of n unknowns with n + 1 equations**. Therefore, to obtain a determined system, Equation
> (4.80) is **not evaluated at one of the control points** on the body. That is, we choose to ignore
> one of the control points."*

Y la consecuencia que hay que documentar en el código:

> ⭐ *"**Which control point do you ignore?** Different choices sometimes yield different numerical
> answers for the distribution of γ over the surface."*

Más dos síntomas que **son esperados, no bugs**: *"the results ... are sensitive to the number of
panels used, their various sizes, and the way they are distributed"* y *"the resulting numerical
distributions for γ are **not always smooth**, but rather, they have oscillations from one panel to
the next."*

**La arquitectura que el propio autor recomienda:** *"what is more common today is to use a
**combination of both source and vortex panels** (source panels to basically simulate the airfoil
thickness and vortex panels to introduce circulation)."*

⭐ **Y una decisión geométrica del borde de fuga que casi nadie implementa:** *"**If the trailing-edge
angle is finite**, then the trailing edge is a stagnation point"*; si es cuspidal, las velocidades son
finitas e iguales. **Son dos tratamientos distintos según la geometría.**

Y el recordatorio físico que la Escuela debe dar: *"**Nature enforces the Kutta condition by means of
friction.** If there were no boundary layer ... there would be no physical mechanism"* — el modelo
potencial **toma prestada** una condición que el propio modelo no puede generar.

### 6.4 Línea sustentadora de Prandtl

```
CL  = A₁·π·AR                                    (5.53)
CDi = π·AR·Σ n·A_n²                              (5.60)
CDi = (CL²/πAR)(1+δ),  δ = Σ_{n≥2} n(A_n/A₁)²    (5.61)
e = 1/(1+δ)  ⇒  CDi = CL²/(π·e·AR)               (5.62)
a = a₀/[1 + (a₀/πAR)(1+τ)],   τ ∈ [0.05, 0.25]   (5.70)
Elíptica: solo A₁ ⇒ δ=0, e=1, downwash CONSTANTE, αi = CL/(πAR), CDi = CL²/(πAR)
```
Solo hacen falta los **términos impares** si la carga es simétrica.

⭐ **La frontera dura, literal** (A §5.4): *"Equation (5.69), like all results from simple lifting-line
theory, is **valid only for high-aspect-ratio straight wings (AR > 4, as a rule of thumb)**."*
B la endurece: sin flecha o poca, AR ≥ 4, sin diedro, α bajo, y *"each spanwise strip behaves as if
the flow were locally two dimensional, **which is why the model cannot be applied to cases with large
amounts of spanwise flow**."*

**Sustitutos DECLARADOS cuando AR < 4 o hay flecha** (no hay que inventarlos):
- **Helmbold** (A Ec. 5.81): `a = a₀/[√(1+(a₀/πAR)²) + a₀/(πAR)]` — *"excellent agreement with the
  data for AR < 4"*.
- **Küchemann** (A Ec. 5.82): igual pero con `a₀·cosΛ`, con Λ referida a la **línea de media cuerda**.

**Versión numérica no lineal (post-stall), A §5.4** — receta de 9 pasos, y tres números que un
implementador necesita y no adivinaría:
- La singularidad en `y_n = y_j` *"can be avoided by **replacing the given term by its average value
  based on the two adjacent sections**"*.
- ⭐ *"the iterative procedure requires **heavy damping, with typical values of D on the order of
  0.05**"* — relajación de 0.05, ¡veinte veces más fuerte que la de Raymer!
- ⭐ *"a **minimum of 50 and sometimes as many as 150 iterations** may be required"*.
Acuerdo con experimento hasta α = 50°: **dentro del 20%**. Pero: *"it is wise not to stretch the
applicability of lifting-line theory too far."*

### 6.5 Vortex lattice — y dos correcciones a la creencia común

⭐ **Hallazgo negativo #1: "Weissinger" NO aparece en ninguno de los dos libros** (0 coincidencias,
verificado). Las referencias reales de la regla ¼–¾ son **Falkner (1943)** y **Kalman et al. (1971)**.
⭐ **Hallazgo negativo #2: "cosine spacing" tampoco existe** como esquema de mallado en estos libros.
La única transformación coseno es la de Glauert dentro de la serie.

La regla ¼–¾, literal (B §7.5): *"**The bound vortex typically coincides with the quarter-chord line
of the panel** ... aligned with the local sweepback angle"* y *"**The control point of each panel is
centered spanwise on the three-quarter-chord line** midway between the trailing-vortex legs."*
La derivación de por qué ¾: `U = Γ/2πr`, `α ≈ Γ/(2πrU∞)`, `l = ½ρU∞²c·2πα = ρU∞Γ` ⇒ **r = c/2** desde
el vórtice a ¼.

**Tamaño de la matriz: 2N×2N — una ecuación por punto de control, contando AMBAS semialas.** La
simetría te ahorra incógnitas pero **no te exime de sumar las contribuciones de la otra mitad**.

⭐ **El truco de costo que hace al VLM barato en un navegador** (B §7.5): *"we will assume that the
trailing vortices are parallel to the axis of the vehicle ... Furthermore, **these geometric
coefficients do not change as the angle of attack is changed**."* ⇒ **ensambla e invierte UNA vez, y
barre α cambiando solo el lado derecho.** Un barrido de polar completo cuesta lo mismo que un punto.

⭐ **Y la admisión más honesta del libro sobre por qué el VLM funciona** (B §7.4):

> *"The VLM predicts the experimental data very well, due to the fact that **vortex lattice methods
> neglect both thickness and viscosity effects. For most cases, the effect of viscosity offsets the
> effect of thickness, fortuitously yielding good agreement.**"*

**Acierta por cancelación afortunada de dos errores.** Eso es un requisito de honestidad de la UI:
el número es bueno y la razón es una casualidad estructurada; si cambias el espesor o el Re fuera del
rango donde se cancelan, el acuerdo se va.

Límite adicional: *"Applying the boundary condition at only one point in the chordwise direction
**would not be adequate for a wing with cambered sections or a wing with deflected flaps**."*

### 6.6 Compresibilidad — el rango de cada corrección

```
Prandtl-Glauert  : Cp = Cp0/β
Kármán-Tsien     : Cp = Cp0/[β + (M∞²/(1+β))·(Cp0/2)]
Laitone          : Cp = Cp0/[β + (M∞²/β)·(1 + ((γ−1)/2)M∞²)·(Cp0/2)]
Lees (3D esbelto): Cp = Cp0/(1−M∞²)^{3/2}
                                                  con β = √(1−M∞²)
```
(Usa la notación de Bertin, con β explícito — la de Anderson es ambigua de paréntesis al extraerse
del PDF.)

| Regla | Vale hasta | Cómo falla |
|---|---|---|
| **Prandtl-Glauert** | **M∞ ≲ 0.7** | *"begins to give inappropriate results at values of M∞ = 0.7 and above"*; **subpredice** el dato; **singular en M = 1** |
| **Kármán-Tsien** | mejor que PG en todo el subsónico | *"has been widely adopted by the aeronautical industry since World War II"* |
| **Laitone** | la más alta de las tres | tiende a sobrepredecir |
| **Todas** | **se rompen en 0.8 < M∞ < 1.2** | *"it cannot be used for transonic flow, where 0.8 < M∞ < 1.2, or for hypersonic flow, where M∞ > 5"* |

⭐ **Regla de producto para la UI, dicha por el cliente** (B §9.1): *"the 'correct' answer may be
**between the Karman-Tsien and Laitone results**"* — **reporta una BANDA, no un número.** Eso es una
decisión de diseño de interfaz sacada directamente del libro.

**Mach crítico** (A Ec. 11.60): la curva `C_p,cr(M)` es **universal y exacta** (no depende de la
geometría); se intersecta con la curva `C_p(M∞)` **corregida**, que sí es aproximada. Y la hipótesis
oculta que hay que documentar: *"it is **implicit** ... that the point of minimum pressure **remains at
a fixed location** on the body surface as M∞ is increased."*

⭐ **Drag divergence: no hay teoría.** (B §9.2) *"There are **no reliable analytic methods** for
predicting the drag divergence Mach number, although practically every aircraft manufacturer has some
'rule of thumb'."* Lo único citable es Shevell (1988):
`M_dd = M_crit·[1.02 + 0.08(1 − cosΛ)]`.

### 6.7 Capa límite — con una corrección importante

⭐ **Hallazgo negativo #3: THWAITES NO EXISTE EN NINGUNO DE LOS DOS LIBROS.** Verificado con grep:
0 coincidencias de `thwaites|holstein|bohlen|walz` en ambos. No está la integral
`θ² = 0.45ν/u_e⁶ ∫u_e⁵dx`, ni la tabla `λ / l(λ) / H(λ)`, ni el criterio `λ = −0.09`. Y **A §18.6 no
es un método integral**: su título literal es *"Boundary Layers over Arbitrary Bodies: **Finite-
Difference Solution**"*. Si el módulo quiere Thwaites, la fuente es **White** o **Cebeci-Bradshaw**, y
hay que **declararlo como extensión**, no atribuírselo a Anderson.

**Lo que SÍ hay:**

**Blasius** (A §18.2): `2f''' + f·f'' = 0`, resuelto por **RK4 + shooting**.
```
δ/x  = 5.0/√Re_x      δ*/x = 1.72/√Re_x  (≈0.34δ)     θ/x = 0.664/√Re_x  (≈0.13δ)
c_f  = 0.664/√Re_x    C_f  = 1.328/√Re_L   ← POR UNA CARA
```
⭐ **Gotcha de convención:** `f''(0) = 0.332` con la η de Anderson, **0.4696** con la de Bertin
(factor √2). **Fija una y documéntala** o los tests se contradicen entre sí. Y `H = 2.59` para Blasius
**no está impreso en ninguno de los dos**: es derivable (`1.72/0.664`) y hay que marcarlo **[DERIVADO]**.

**Falkner-Skan es el "λ" de estos libros** (B §4.3): `f·f'' + f''' + [1 − (f')²]β = 0`, con
`β = (2s/u_e)(du_e/ds)`, y **criterio de separación β = −0.1988**.

| β | −0.1988 | −0.180 | 0.000 | 0.300 | 1.000 | 2.000 |
|---|---|---|---|---|---|---|
| f''(0) | **0.000** | 0.1286 | **0.4696** | 0.7748 | 1.2326 | 1.6872 |

**Cierre turbulento Head + Cebeci-Bradshaw** (B Ecs. 4.90–4.95) — el sustituto directo:
```
d/dx(u_e·θ·H₁) = u_e·F ;  H₁ = (δ−δ*)/θ ;  F = 0.0306(H₁−3.0)^{−0.6169}
G(H) = 0.8234(H−1.1)^{−1.287} + 3.3      (H ≤ 1.6)
G(H) = 1.5501(H−0.6778)^{−3.064} + 3.3   (H ≥ 1.6)
C_f  = 0.3·e^{−1.33H} / (log Re_θ)^{1.74+0.31H}
Separación turbulenta: H ≈ 2.2  (rango declarado 1.8 a 2.8)
```
Y el requisito de arranque: *"To start the calculations ... **values for two of the three parameters,
θ, H, and C_f, must be specified**."*

⭐ **Correlaciones turbulentas CON PRECISIÓN DECLARADA — esto es oro para un pliego:**

| Correlación | Fórmula | Precisión declarada |
|---|---|---|
| Prandtl (perfil 1/7) | `C_f = 0.074/Re_L^0.2` | **±25%** |
| **Prandtl-Schlichting** | `C_f = 0.455/(log₁₀Re_L)^2.58` | **±3%** ← *"should usually be used instead of"* la de Prandtl |
| Kármán-Schoenherr | `1/√C_f = 4.13 log₁₀(Re_L·C_f)` | ±2% (iterativa) |
| Schultz-Grunow | `C_f = 0.427/(log₁₀Re_L − 0.407)^2.64` | ±7% |

Con corrección laminar: `C_f ≈ 0.455/(log₁₀Re_L)^2.58 − A/Re_L`, con **A = 1050 / 1700 / 3300 / 8700**
para `Re_x,tr = 3e5 / 5e5 / 1e6 / 3e6`.

⭐ **DOS reglas de composición que un implementador rompe seguro:**
1. (A Ec. 4.92) *"Because the Reynolds number is always based on length measured from the leading
   edge, **we cannot simply calculate** the turbulent skin friction drag coefficient for region 2 by
   using Equation (4.88) with a Reynolds number based on x₂."* Hay que **restar**:
   `C_f = (x₁/c)(C_f,1)_lam + (C_f,c)_turb − (x₁/c)(C_f,1)_turb`.
2. (B §4.3) *"It can be tempting to add together the total skin-friction coefficients for various
   flat plates ... **this must never be done!** ... **Always** convert total skin-friction
   coefficients into drag coefficients (based on a single reference area) and then add."*

**Transición.** `Re_x,tr = 500,000` por defecto. Regla direccional: gradiente adverso, rugosidad,
soplado y turbulencia libre **adelantan**; gradiente favorable, Mach alto, succión y enfriamiento
**retrasan**. ⭐ **El método e^N NO se menciona en ninguno de los dos libros.** Y el `Re_x,cr` es
**input del usuario**, no salida: *"an accurate value for Re_x,cr ... **must come from somewhere —
experiment, free flight, or some semi-empirical theory** — and this may be difficult to obtain."*
Simplificación permitida: *"if transition takes place at less than **10%** of the length of the plate,
then the laminar correction usually can be ignored."*

### 6.8 Supersónico

```
Ackeret:  Cp = 2θ/√(M∞²−1)  ;  placa plana: c_l = 4α/√(M∞²−1),  c_d = 4α²/√(M∞²−1)
Perfil delgado (Bertin Ec.10.16):
   Cd = 4α²/√(M∞²−1) + (2/√(M∞²−1))·( s̄u² + s̄l² ),   s̄u² = (1/c)∫₀^c (dz_u/dx)² dx
Busemann 2º orden: Cp = C₁θ + C₂θ²,  C₂ = ((γ+1)M∞⁴ − 4M∞² + 4)/(2(M∞²−1)²)
Prandtl-Meyer:  ν(M) = √((γ+1)/(γ−1))·atan(√(((γ−1)/(γ+1))(M²−1))) − atan(√(M²−1))
θ-β-M:  tanθ = 2cotβ·(M₁²sin²β − 1)/(M₁²(γ + cos2β) + 2)
```
⭐ En supersónico **C_l es independiente de la comba y del espesor**, `α_L0 = 0`, y el **centro
aerodinámico está en la MEDIA cuerda**, no en c/4. Por eso B dice: *"**you should not apply intuitive
ideas from subsonic flow to supersonic flows**"* y *"camber and thickness **should be used minimally**
for supersonic airfoils."*

⭐ **Tres assert obligatorios en el módulo de choques:**
1. (A §9.2) *"For oblique shocks, the entry for p₀,₂/p₁ in Appendix B **cannot be used** ... it cannot
   be used for oblique shocks with M₁ replaced by M_n,1."* — **el error clásico**.
2. Default de rama: *"In nature, **the weak shock solution usually prevails** ... It is safe to make
   this assumption, unless you have specific information to the contrary."*
3. **Desprendimiento:** si `θ > θ_max`, *"no solution exists for a straight oblique shock wave.
   Instead, nature establishes a **curved shock wave, detached**"* — y detrás de un choque curvo el
   flujo es **rotacional** (Crocco) ⇒ **no hay potencial** ⇒ solo numérico. **El módulo debe detectar
   θ > θ_max y degradar a "fuera de alcance analítico", nunca extrapolar.** (`θ_max → 45.5°` cuando
   M₁ → ∞ con γ = 1.4.)

**Shock-expansion** tiene precondición literal: *"Whenever we have a body made up of straight-line
segments and **the deflection angles are small enough so that no detached shock waves occur**, the
pressure distribution ... can be obtained **exactly**."*

**El solver de tres niveles, justificado por el propio autor** (B §10.4): *"the **shock-expansion
technique leads to the most dependable answers**. However, linear theory and Busemann's second-order
theory can give quite good answers within the limits of their assumptions, and typically **take much
less time**."*

**Taylor-Maccoll:** *"There is **no closed-form solution** to Equation (13.78); it must be solved
numerically."* Disparo inverso: supón θ_s → choque oblicuo → RK4 marchando en θ → **para cuando
`V_θ′ = 0`; ese θ es θ_c**. Estrategia de navegador: **precalcula la LUT (M∞, θ_s) → θ_c** una vez —
que es exactamente lo que hicieron Kopal y Sims a mano.
Efecto de alivio 3D, para intuición: a M = 2 un cuerpo de 20° da **β = 53.3°** como cuña y
**θ_s = 37°** como cono; **el cono desvía solo 8° en el choque**.

### 6.9 QUÉ EXIGE CFD DE VERDAD — la frontera, sin adornos

**La admisión de fondo:** *"to date, **no general analytical solution** to these equations has been
obtained"* y, sobre un perfil separado a Re = 300 000 y α = 14°, *"**There is no analytical
solution**; the solution can only be obtained by means of CFD."* Y el encuadre correcto:
*"CFD is today **an equal partner** with pure theory and pure experiment"* — socio, no sustituto.

| Fallo | Cita |
|---|---|
| **c_l,max y stall** | *"It **does not allow us to calculate c_l,max**, which is a difficult viscous flow problem."* / *"the inviscid theory **does not predict flow separation**"* / B: *"**Separation effects must be modeled** in order to predict the maximum lift coefficient"* — y aun así *"will not always give such good results for all airfoils"* |
| **Transónico con choques** | *"The closed-form theory discussed in this chapter does not apply in this flight regime. **The only approach that allows the accurate calculation of airfoil and wing characteristics at transonic speeds is to use CFD.**"* Y Euler **no basta**: *"none of the approaches ... accounted for the effects of viscous flow ... This interaction, with the attendant flow separation, **is dominant in the prediction of drag**."* Razón matemática (B): cerca de M=1 el término que se descarta es **del mismo orden** que el que se guarda |
| **Arrastre de forma** | *"analyses based on just inviscid flow are **not sufficient** for the prediction of drag."* / *"For separated flows ... today **the only viable and general method** ... is a complete numerical Navier-Stokes solution."* / los códigos de paneles *"**do not provide estimates for the skin-friction component**"* |
| **Acoplamiento viscoso-inviscido** | Su frontera: *"this procedure **would not apply** to flow fields for which there are shock-wave/boundary-layer interactions or **significant regions of separated flow**."* Y por qué revienta: *"boundary-layer calculations usually **'blow up'** in regions of separated flow."* |
| **Alto α, bajo AR, vórtice** | *"for low-aspect-ratio straight wings, swept wings, and delta wings, classical lifting-line theory is **inappropriate**."* Polhamus tiene su frontera medida: bien hasta α > 20° con AR = 1.0–1.5, pero *"for a delta wing with an aspect ratio of 2.0, significant deviations exist for angles of attack **above 15°**"* |

⭐ **El dato que legitima nuestro enfoque completo** (B §6): el sistema hipersustentador del
**Boeing 777** se diseñó con **códigos 2D viscoso-inviscido acoplados**; *"Navier-Stokes and Euler
codes were **not used during the design process**."*

**Sensibilidad al modelo de turbulencia — con NÚMEROS.** NACA 0012, α = 0°, Re = 3×10⁶
(Lombardi et al., *J. Aircraft* 37-2, 2000):

| Método | C_f × 10³ | Error vs la solución de capa límite validada |
|---|---|---|
| Navier-Stokes, k–ε estándar | 7.486 | **+40%** |
| Navier-Stokes, RNG k–ε | 6.272 | +17.5% |
| Navier-Stokes, Reynolds stress | 6.792 | +27% |
| **Capa límite (validada con experimento)** | **5.340** | — |

> ⭐ *"the ability of Navier-Stokes solutions to predict skin friction in a turbulent flow seems to be
> **no better than about 20 percent accuracy, on the average**"*

Y las citas que hay que enmarcar: *"such turbulent models are frequently the **Achilles heel** of these
calculations"* · *"**no pure theory of turbulent flow exists.** Every analysis of turbulent flow
requires some type of empirical data"* · Neumann (1989): *"Turbulence models are just that ...
**models, non-physical ways of describing** the character of the physical situation of turbulence ...
they are **not unique**"* · Smith (1991): *"**Different results can be obtained with different
implementation of the same turbulence model.**"*

⭐ **Dispersión entre CÓDIGOS sobre un avión completo.** F-16XL, M∞ = 0.36, α = 11.85°,
Re = 46.8×10⁶, **siete investigadores**:

| Inv. | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| C_L | 0.43846 | 0.44693 | 0.37006 | 0.43851 | 0.46798 | 0.44190 | 0.44590 |
| C_D | 0.13289 | 0.13469 | 0.11084 | 0.15788 | 0.13648 | 0.16158 | 0.14265 |

> *"the discrepancy between the lowest and highest number obtained is **26 percent for CL and 42
> percent for CD**. However, if the results from Investigator 3 are not counted, the discrepancies are
> **6.7 percent for CL and 21.5 percent for CD**."*
> Y el remate: *"**Amazingly, in our modern world of high technology and advanced CFD techniques,
> accurate drag prediction remains a problem.**"*

**Esto es EL argumento de venta del módulo.** Si siete expertos con CFD de producción difieren 21.5%
en arrastre, un método de conceptual que acierta al 8% no es un juguete: es **la referencia contra la
que se audita el CFD** — exactamente el rol que Raymer le asigna en §1.4.

**Qué SÍ da cada escalón:**

| Nivel | Da | NO da (cita) |
|---|---|---|
| Semiempírico | fuerzas rápidas | *"limited to applications of Mach 5 or less"* |
| Panel / VLM | C_L, C_m a α bajo, arrastre de onda | *"limited to linear flows"*; sin fricción |
| Euler | inviscido no estacionario, choques capturados | *"the solutions **cannot be used to compute either the shear forces or the heat transfer**"* |
| Dos capas | τ_w, q_w con capa delgada | no sirve con choque-BL ni separación |
| RANS / N-S | separación, choque-BL, vórtices | exige malla de pared, modelo de turbulencia y transición |
| PNS | marcha espacial, gran ahorro | *"no streamwise separation"* |
| N-S a gran altitud | — | *"Under these conditions, **the Navier-Stokes equations are not valid**"* (Kn→1, ~340,000 ft) |

**Costo:** *"anywhere from thousands to close to a million grid points"* · *"grid generation has
emerged as a **subdiscipline in its own right**"* · *"these Navier-Stokes solutions are **still not in
the category of 'quick engineering calculations'**"* · *"generating grids ... may take **months**"*.
Órdenes de magnitud: vuelo = 100× túnel; túnel = 10× CFD.
Y sobre el mallado en general (A §6.5): *"**How many panels do you use?** These are all nontrivial
questions. It is not unusual for an aerodynamicist to spend **weeks or even a few months** determining
the best geometric distribution of panels."*

### 6.10 ⭐ La jerarquía de credibilidad de Bertin §14.2 — úsala como gate del producto

Cuatro niveles, y **no son sinónimos**:

1. **Verification** — ¿resolví bien las ecuaciones? *"the accuracy of the solution ... established
   through purely numerical experiments. These numerical experiments include both **grid-refinement
   studies** and comparison with solutions to problems that have **exact analytical solutions**."*
2. **Validation** — ¿son las ecuaciones correctas? *"detailed surface and flow field comparisons with
   experimental data ... Validation can occur **only when the accuracy and limitations of the
   experimental data are known**."*
3. **Calibration** — comparación con dato real *"without necessarily verifying that all the features
   of the flow are correctly modeled"*. Y la advertencia: *"the use of calibrated CFD solutions is
   **dangerous** because of the subtle viscous interactions."*
4. **Certification** — higiene de software.

⭐ **Quién valida** (Cosner 1995): *"it is preferable that this validation should be performed by
**representative engineers from the user community, not by the experts in the code**."*
⭐ **El error clásico** (Shang 1995): *"Common mistakes have been made in **using Euler equations to
investigate viscous dominated flows**, and employing the thin-layer approximation ... for flowfield
containing catastrophic separation. Under these circumstances, **no meaningful quantification of
errors** can be achieved."*

Y el cierre honesto, dos frases para poner en la pared del proyecto:
> *"**Aerodynamic modeling is the art of partial simulation.**"* (Trimmer et al., 1986)
> *"**Good judgment comes from experience; experience comes from bad judgment.**"* (B §14)

Con el dato duro que lo acompaña (Bushnell 2006, doce transportes): *"The drag predictions were as
much as **22% low and 10% high**"*, con correcciones típicas que suman **~+12%**.

### 6.11 Datos tabulares reutilizables (lo que hay que digitalizar)

**Nomenclatura NACA.** 4 dígitos XYZZ: X = comba máx en %, Y = posición en décimas, ZZ = espesor en %.
Modificaciones `-XY`: 1er dígito = radio de LE relativo (**normal = 6, afilado = 0**), 2º = posición
del espesor máximo en décimas (**normal 0.3c**). 5 dígitos: 1er × 3/2 = c_l,diseño en décimas, 2º–3º ÷ 2
= posición de comba en centésimas, 4º–5º = espesor. Serie 6: 2º dígito = posición de **presión mínima**
en décimas, 3º = c_l,diseño en décimas. **Las series 1/16 y de 7 dígitos NO están en estos libros.**

⭐ **Hallazgo negativo #4: el polinomio de espesor de 4 dígitos NO aparece en ninguno de los dos
libros.** Verificado por grep de `0.2969, 0.1260, 0.3516, 0.2843, 0.1015, 0.1036` — la única
coincidencia es una fila de una tabla de flujo compresible del apéndice. La fuente es
**Abbott & von Doenhoff (1949)**, que ambos citan pero no reproducen. **Hay que declararlo.**

**Las líneas de comba que SÍ están, literales:**
```
NACA 2412:  x/c ≤ 0.4 : z/c = 0.125 [0.8(x/c) − (x/c)²]
            x/c ≥ 0.4 : z/c = 0.0555[0.2 + 0.8(x/c) − (x/c)²]
NACA 4412:  x/c ≤ 0.4 : z/c = 0.25 [0.8(x/c) − (x/c)²]
            x/c ≥ 0.4 : z/c = 0.111[0.2 + 0.8(x/c) − (x/c)²]
NACA 23012: x/c ≤ 0.2025 : z/c = 2.6595[(x/c)³ − 0.6075(x/c)² + 0.11471(x/c)]
            x/c ≥ 0.2025 : z/c = 0.022083(1 − x/c)
```
**Forma general de 4 dígitos [DERIVADO]** — verificada contra los dos casos impresos (m = comba,
p = posición): `x/c ≤ p : z/c = (m/p²)[2p(x/c) − (x/c)²]`;
`x/c ≥ p : z/c = (m/(1−p)²)[(1−2p) + 2p(x/c) − (x/c)²]`.
Comprobación: 2412 → 0.125 ✓ y 0.05556 ✓; 4412 → 0.25 ✓ y 0.1111 ✓.

**Atmósfera.** p₀ = 1.01325e5 N/m²; **T₀ = 288.15 K** (Bertin, US Std 1976) vs **288.16 K** (Anderson,
ARDC 1959); ρ₀ = 1.2250 kg/m³; R = 287.05; a₀ = 340.29 m/s; γ = 1.4; Pr = **0.738**.
Troposfera: `T = 288.15 − 0.0065z`, `p = p₀(1 − Bz/T₀)^{5.26}`.
Sutherland: `μ = C₁T^1.5/(T+C₂)`, con **SI: C₁ = 1.458e−6, C₂ = 110.4**; error < 1.5% hasta ~1000 K.
⭐ **Los apéndices de los dos libros NO son intercambiables fila por fila** (modelos distintos), y
**Anderson distingue altitud geométrica h_G de geopotencial h** (sus ecuaciones con g constante exigen
h); Bertin no. **Ya tenemos `atmosfera.ts` con 8/8 tests contra ISO 2533** — hay que declarar cuál
modelo implementa.

**e (Oswald) — los dos libros se CONTRADICEN, y hay que decidir en el pliego:**

| Fuente | Magnitud | Rango |
|---|---|---|
| A §6.7 | **Oswald** (avión completo) | **0.7 – 0.85** |
| A §6.7 | **span efficiency** (ala sola) | **0.9 – 1.0** |
| B §7.3.5 | **span efficiency** | **0.6 – 0.95** |
| B §5.5.2 | **airplane efficiency** | 0.6 – 0.95, *"lower than the span efficiency factor"* |

Fórmula empírica (Raymer, citada en A Ec. 6.25): `e = 1.78(1 − 0.045·AR^0.68) − 0.64`, *"not for the
very large aspect ratios (on the order of 25 or higher) associated with sailplanes"*.
**δ y τ solo existen como FIGURAS**; τ ∈ [0.05, 0.25]. Puntos transcribibles: elíptica δ=0 e=1.00 ·
AR=8 λ=0.8 → δ=0.055 e=0.948 · AR=10 rectangular → δ=0.105 e=0.905 · AR=7.61 λ=0.45 → δ=0.01 e=0.99 ·
F-16 AR=3.0 → e=0.9084. Regla de diseño: **δ y τ se minimizan a la vez en λ ≈ 0.3–0.4** — que coincide
con el λ ≈ 0.4 de Raymer. Y: *"AR has a much stronger effect on CD,i than the value of δ, which varies
only by about **10 percent** over the practical range of taper ratio."*

**Datos experimentales de validación** (Abbott & von Doenhoff 1949, Re 3–9×10⁶, M < 0.17):

| Perfil | a₀ | α_L0 | c_l,max | α_stall | c_m,ac | x_ac |
|---|---|---|---|---|---|---|
| NACA 2412 | ~6.0/rad (−4.5% de 2π) | **−2.1°** | ≈1.6 | ≈16° | −0.045 | 0.239–0.247c |
| NACA 2418 | ~5.9/rad (−6.1%) | −2.1° | menor | menor | −0.050 | 0.239–0.242c |
| NACA 23012 | **0.104/deg** | **−1.2°** | **1.79** | **18°** | −0.01 | **0.241** |

**c_l,max vs espesor, serie 24XX:** 2408→1.5 · 2410→1.65 · **2412→1.70 (máximo)** · 2415→1.63 ·
2418→1.48 · 2424→1.30 ⇒ **espesor óptimo ≈ 12%** — que es exactamente donde Raymer pone el límite de
validez del perfil delgado y donde el t/c empieza a costar peso.

**Sanidad de C_D** (Re ≈ 1e5): placa plana de canto **2.0** · cilindro **1.2** · cuerpo carenado
**0.12**. **(L/D)max:** planeador 25–40 · transporte comercial 12–20 · caza supersónico 4–12 ·
hipersónico 1–4 (compara con los K_LD de Raymer §3.4.4 — **coinciden**).
**Reparto fricción/presión**, la regla de dedo de Anderson: *"**80 percent skin friction drag and 20
percent pressure drag** due to flow separation"*.
**Rugosidad estándar NACA:** granos de carborundo de **0.011 in** sobre **0.08c** desde el LE en ambas
superficies, cubriendo 5–10% del área. Efecto: α_L0 y c_lα casi sin cambio; **c_l,max sí cae**.

⭐ **Y el veredicto histórico sobre los perfiles laminares** (Loftin 1985, citado en B §6):
*"As a consequence, **the use of NACA laminar-flow airfoil sections has never resulted in any
significant reduction in drag** as a result of the achievement of laminar flow."* — Un dato que
contradice la intuición y que la Escuela debería enseñar.

### 6.12 ⭐ ERRATAS DETECTADAS EN LAS FUENTES — no las copies a los tests

Un test que transcriba estos valores **falla contra la física**. Se detectaron durante la extracción:

| Fuente | Errata |
|---|---|
| B Tabla 1.2A | μ a 5 km = `1.7885e−5` rompe la monotonía (debería ser ≈1.628e−5) |
| B Tabla 1.2B | μ a 8 kft = `3.4764e−7` rompe la monotonía |
| B Tabla 8.3 | `ρ₂/ρ₁` a M=10 = `5.1743`. **Usa 5.714 de Anderson** |
| B Tabla 8.2 | `ν=49.5° → μ=15.561` (debe ser ≈19.561); filas duplicadas en ν=94.5° |
| A Apéndice B | M=1.08: `p₀₂/p₀₁ = 0.9994+01` (el exponente correcto es +00) |
| A Ej. 9.11 | `M_n,1 = 34.2` (es 3.42) |
| A Ej. 9.4 | dice `M_n1 = 1.64` y divide con 1.66 |
| A Ej. 12.3 | `q∞ = 6.35×10⁴ m/s` (son N/m²) |
| A Ej. 12.1 | dice comparar con *"Example 9.11"*; el caso exacto es el **9.12** |
| A Ej. 18.3 | dice `ρ* = 0.599` pero calcula con 0.500; `C_f* = 2.09×10⁴` debe ser `10⁻⁴` |
| A §18.7 resumen | imprime `c_f* = 0.644/√Re_x*` — es **0.664** |
| A Ej. 4.10 | atribuye `(C_f,c)_turb = 0.00372` al Ej. 4.8; se calculó en el **4.9** |

**Requisito de proceso:** cada fixture de test debe llevar la **cita de origen Y el chequeo de
plausibilidad física** (monotonía, límites, orden de magnitud). Copiar del libro no basta — el libro
también se equivoca. Es la misma lección que dejó Kazmer.

⭐ **Y una convención de API que evita el error #1:** Anderson usa **mayúsculas para 3D**
(`C_L, C_D, C_M`) y **minúsculas con prima para 2D** (`c_l, c_d, L′, D′`) —
*"lift, drag, and moments per unit span have been denoted with primes"*. **Mantenla en los tipos de
TypeScript**: `Cl2D` y `CL3D` no deben ser el mismo tipo, porque confundirlos es silencioso y fatal.

---

## 7. LOS CASOS RESUELTOS — LA SUITE DE ACEPTACIÓN YA ESTÁ ESCRITA EN EL LIBRO

> **Nota metodológica, y es importante.** Todo lo de esta sección se **verificó contra el texto
> extraído**. Marco explícitamente qué es transcripción literal, qué se reprodujo numéricamente, y
> **qué NO se pudo verificar**. El cap 24 mezcla dos tipos de página: las del **DR-1 son escaneos
> MANUSCRITOS** cuyo OCR es prácticamente ilegible, mientras que las salidas de **RDS del DR-3 son
> texto de máquina y salieron limpias**. Cualquier "tabla del DR-1" que circule por ahí con números
> precisos hay que tratarla como **no verificada** hasta abrir el PDF a mano.

### 7.1 ⭐ GATE 1 — El ASW de §3.6. Verificado y REPRODUCIDO.

Es el gate más simple, el más completo y el único que se puede implementar hoy mismo. Ya lo corrí.

**Entradas** (todas literales de §3.6): loiter **3 h** a **1500 n mi {2778 km}** de la base ·
payload de aviónica **10,000 lb {4536 kg}** · tripulación de 4 = **800 lb {363 kg}** · crucero
**Mach 0.6 a 30,000 ft** (a = 994.8 ft/s) · A = 7 combinado · S_wet/S_ref ≈ 5.5 ⇒ A_wet = 1.27 ⇒
**L/D_max = 16** · C_crucero = 0.5 1/h, C_loiter = 0.4 1/h · clase `military cargo/bomber`
(A = 0.93, C = −0.07).

**Comparación libro vs código** (reproducción numérica independiente hecha durante la redacción de este pliego):

| Cantidad | Libro | Reproducido | Δ |
|---|---|---|---|
| W₃/W₂ (crucero) | 0.858 | 0.8581 | 0.01% |
| W₄/W₃ (loiter 3 h) | 0.9277 | 0.9277 | 0% |
| W₆/W₅ (loiter 20 min) | 0.9917 | 0.9917 | 0% |
| W₇/W₀ | 0.6441 | 0.6440 | 0.02% |
| W_f/W₀ | 0.3773 | 0.3773 | 0% |
| **W₀** | **56,702 lb** | **56,718 lb** | **0.03%** |
| Trade 1000 n mi | 42,372 | 42,379 | 0.02% |
| Trade 2000 n mi | 80,218 | 80,256 | 0.05% |
| Trade compuestos (×0.95) | 51,585 | 51,601 | 0.03% |
| Trade payload 5,000 lb | 33,318 | — | (mismo método) |
| Trade payload 15,000 lb | 78,866 | — | (mismo método) |

**Tolerancia propuesta: 0.5% en W₀.** La diferencia real es 0.03% y viene de que el libro redondea
las fracciones intermedias a 4 cifras antes de multiplicarlas.

⭐ **Y el gate de validación EXTERNA, que es el que de verdad importa:** el Lockheed S-3A real pesa
**52,539 lb {23,831 kg}**. El método da 56,702. **Error +7.9%.** El test debe **afirmar ese error
contra el avión real**, no solo contra el libro — es la honestidad que el propio cliente exige:
*"While strict accuracy should not be expected, this simple sizing method will usually yield an
answer in the 'right ballpark.'"*

⭐ **Growth factors derivados de los trades** (calculados de las cajas 3.2 y 3.3, no citados por el
libro — márcalos como derivados):

| Trade | Growth factor |
|---|---|
| Payload 5k → 10k lb | **4.68 lb de W₀ por lb de payload** |
| Payload 10k → 15k lb | **4.43 lb/lb** |
| Alcance 1000 → 1500 n mi | **28.7 lb de W₀ por n mi** |
| Alcance 1500 → 2000 n mi | **47.0 lb/n mi** — fuertemente **no lineal** |
| Compuestos (−5% en W_e/W₀) | **−9.02% en W₀ ⇒ palanca 1.8×** |

⭐ **Y el hallazgo medido sobre la relajación.** Con el mismo caso, desde W₀ = 50,000 lb, contando
vueltas hasta |ΔW₀| < 0.5 lb:

| Relajación | Vueltas |
|---|---|
| ω = 0.50 | 13 |
| **ω = 0.75 (la que dicta el cliente en §6.3.7)** | **6** |
| ω = 1.00 (punto fijo puro, sin relajar) | 7 |

**La regla de dedo de Raymer es medible y es correcta.** ω = 0.75 gana. Un implementador que pusiera
el 0.5 "obvio" duplicaría el costo de cada corrida — y el ciclo se corre 5–25 veces.

> ⚠ **Advertencia de trazabilidad.** Circula la afirmación de que el programa AC-SIZE del autor usa
> **k = 0.80** en lugar del 0.75 del texto, supuestamente deducida de las tablas de iteración
> impresas en el cap 24. **No pudimos verificarla:** en el texto extraído **no existe ninguna salida
> de AC-SIZE** (búsquedas de `AC-SIZE`, `Wo-guess`, `WO-calculated`, `SIZING ITERATIONS` dan cero
> coincidencias en las 55,136 líneas). Las páginas del DR-1 donde estarían son **manuscritas y el OCR
> las destruyó**. **Usa ω = 0.75, que sí está escrito en §6.3.7**, y deja el valor configurable. Si
> algún día se abre el PDF a mano y aparece el 0.80, es un cambio de una constante.

### 7.2 GATE 2 — El DR-3 "Lightweight Supercruise Fighter" (§24.3). Transcripción VERIFICADA.

Estas salidas de RDS **sí son texto de máquina y se verificaron carácter por carácter** contra el
extracto.

**Requisitos del DR-3:** reemplazo del F-16, monoplaza, **un motor "rubber"** · misión: crucero
**200 n mi** → dash **50 n mi a M1.4 / 35,000 ft** → combate **3 min a empuje militar seco,
M0.9 / 20,000 ft** → **suelta 400 lb** → dash 50 → crucero 200 → loiter 20 min a nivel del mar ·
payload 2 misiles + cañón con 750 cartuchos + piloto · despegue y aterrizaje **< 1000 ft** de carrera
· aproximación **≤ 130 kt** · **M 1.8 (A/B), 1.4 (seco)** · **acelerar M0.9 → M1.4 en 30 s a
35,000 ft** · **P_s = 0 a n = 5, 30,000 ft, M0.9**.

**7.2.1 — La tabla de 14 segmentos (VERBATIM, líneas 48032–48045)**

| # | Segmento | Fracción / drop | W_i/W₀ acumulado |
|---|---|---|---|
| 1 | TAKEOFF | 0.9584 | 0.9584 |
| 2 | CLIMB and/or ACCELERATE | 0.9736 | 0.9331 |
| 3 | CRUISE | 0.9721 | 0.9071 |
| 4 | CLIMB and/or ACCELERATE | 0.9950 | 0.9025 |
| 5 | CRUISE (dash) | 0.9813 | 0.8856 |
| 6 | KNOWN TIME FUEL BURN | 0.9339 | 0.8271 |
| 7 | **WEIGHT DROP 400.0 lb** | — | 0.8036 |
| 8 | CLIMB and/or ACCELERATE | 0.9800 | 0.7875 |
| 9 | CRUISE (dash) | 0.9817 | 0.7731 |
| 10 | CLIMB and/or ACCELERATE | **1.0000** *(ignorado)* | 0.7731 |
| 11 | CRUISE | 0.9716 | 0.7511 |
| 12 | DESCENT | 0.9900 | 0.7436 |
| 13 | LOITER | 0.9692 | 0.7207 |
| 14 | LANDING | 0.9950 | **0.7171** |

Resultados: **TOTAL RANGE 500.0 n mi · LOITER 0.33 h · FUEL 4693.0 lb · EMPTY 11,258.2 lb ·
LOAD (menos combustible) 1110.0 · GROSS WEIGHT 17,061.2 lb** — contra un as-drawn de **16,480 lb**:
**Δ = +3.5%**, muy por debajo del gate de 30% de §19.3. Comentario del autor:
*"This is closer than one would usually hope for, and **probably reflects luck more than skill!**"*

⭐ **Dos comportamientos del programa que hay que replicar como features, no como bugs:**
- El **segmento 10** imprime `NEGATIVE DELTA ENERGY HEIGHT - CHECK YOUR INPUTS - SEGMENT IGNORED` y
  se salta. Un ascenso con Δh_e negativo **no puede devolver combustible al tanque**.
- El **segmento 7** (weight drop) tiene un efecto lateral documentado:
  `SEGMENT IS TURNAROUND POINT — UNUSED CLIMB RANGE CREDIT IS CANCELLED`.

**7.2.2 — El carpet plot 5×5 (VERBATIM, líneas 48504–48570). El gate del optimizador.**

Metodología declarada: variaciones de **±10% y ±20%** sobre `T/W = 0.98`, `W/S = 56` ⇒ **25 aviones
completos**, cada uno re-analizado. Reglas de escalado: empuje ∝ T/W · peso de motor ∝ (ΔT)^1.1 ·
área mojada de nacela ∝ T/W · `S ∝ 1/(W/S)` · **área de cola ∝ (ΔS)^1.5** (volumen de cola constante)
· A_max proporcional al cambio de área alar ponderado por el % del ala en la sección total.

| Var | W/S | T/W | W₀ | W_e | W_f |
|---|---|---|---|---|---|
| 1 | 44.843 | 0.7840 | 15,470 | 10,308 | 4051.4 |
| 3 | 56.054 | 0.7840 | 13,478 | 8952.9 | 3415.3 |
| 5 | 67.265 | 0.7840 | 12,532 | 8278.2 | 3144.0 |
| 8 | 56.054 | 0.8820 | 15,068 | 9985.8 | 3972.5 |
| 11 | 44.843 | 0.9800 | 19,811 | 13,115 | 5586.2 |
| **13** | **56.054** | **0.9800** | **17,060** | **11,257** | **4692.7** ← baseline |
| 15 | 67.265 | 0.9800 | 15,716 | 10,316 | 4289.7 |
| 18 | 56.054 | 1.0780 | 19,528 | 12,809 | 5608.8 |
| 21 | 44.843 | 1.1760 | 26,811 | 17,496 | 8204.8 |
| 25 | 67.265 | 1.1760 | 20,573 | 13,335 | 6127.4 |

*(los 25 renglones están completos en el extracto; aquí van 10 para el gate de regresión)*

Y la tabla de desempeño paralela, con las 7 columnas de restricción
(`Takeoff · Landing · Ps@n=5 · Ps@n=5 · Ps@n=1 · Ps@n=1 · Accel`) y el renglón final
`Required Performance Values: 1000.0, 1000.0, 0.0, 0.0, 0.0, 0.0, 50.000`.
Ejemplo, variante 13 (el baseline): `723.61 · 990.36 · 64.169 · 156.59 · 684.62 · 71.460 · 42.231`.

**7.2.3 — El fallo declarado, que es parte del gate**

> ⭐ *"Note that while most performance requirements were met, **the requirement for acceleration from
> M.9 to M1.4 in 30 s was not met** by the baseline DR-3 design! Either the thrust will have to be
> increased, or the requirement will have to be relaxed."*

**Un test que reproduzca el DR-3 y le salga que todo cumple, está mal.** El caso correcto **falla**
la aceleración (42.2 s contra 30 s requeridos).

**7.2.4 — El óptimo y el requirements trade (el argumento de venta del software)**

| Escenario | T/W | W/S | W₀ |
|---|---|---|---|
| As-drawn baseline | 0.98 | 56 | 16,480 lb |
| Resized baseline | 0.98 | 56 | 17,060 lb |
| **Óptimo cumpliendo accel = 30 s** | **1.1** | **59** | **19,300 lb** (+17%) |
| **Óptimo relajando accel a 50 s** | **0.9** | **54** | **15,600 lb {7070 kg}** (−19%) |

> *"This is a 19% reduction in sized takeoff gross weight ... **This will produce a considerable cost
> savings for the relaxation of that one requirement.**"*

**Relajar UN requisito de 30 s a 50 s vale el 19% del peso del avión.** Ese número es la razón de
existir de un módulo de trade studies.
*(Nota: el libro imprime `{4218 kg}` junto a las 19,300 lb — **es una errata del libro**;
19,300 lb = 8754 kg.)*

**7.2.5 — ⭐ El mejor gate de optimizador que existe: la tabla MVO (VERBATIM, líneas 48619–48640)**

```
DR-3 MULTIVARIABLE OPTIMIZATION — MEASURE OF MERIT: Wo
                  BASELINE      BEST
T/W                 0.980       0.919
W/S                  56.1        52.6
ASPECT RATIO        3.500       2.800
SWEEP                38.0        34.7
TAPER RATIO         0.250       0.200
WING t/c            0.060       0.068
Sized Wo         17060.2     15242.2
Sized We         11257.5      9925.5
Sized Wf          4692.7      4206.7

                REQUIRED   BASELINE     BEST
Takeoff           1000.0      723.6     720.0
Landing           1000.0      990.4     960.4
Ps @ n=5             0.0       64.2       1.7   ← ACTIVA
Ps @ n=5             0.0      156.6      62.0
Ps @ n=1             0.0      684.6     515.7
Ps @ n=1             0.0       71.5       0.1   ← ACTIVA
Accel               50.0       42.2      49.4   ← ACTIVA
```

⭐ **Mira el patrón de Kuhn-Tucker en carne viva: en el óptimo, TRES restricciones están
prácticamente activas** (1.7, 0.1, y 49.4 contra 50). Ese es el mejor test de aceptación posible para
un optimizador restringido: **no basta con que dé un peso bajo — tiene que dar un peso bajo con las
restricciones CORRECTAS activas.** Un optimizador que da 15,242 lb con todas las restricciones
holgadas está mal, aunque el número coincida.

Y la lección de diseño: *"This indicates that **the wing planform chosen for the DR-3 using the
methods of this book was fairly close to optimal already.** However, this further 2% weight savings
is obtained **for free**."*

### 7.3 GATE 3 — El DR-1 "Single-Seat Aerobatic Homebuilt" (§24.2). **NO USABLE tal cual.**

El DR-1 es conceptualmente el caso más valioso porque **está hecho a mano con calculadora**
(*"The author even fought to show the original hand-written analysis work rather than having it
typed. Students can go through it and say, '...anybody can do that!'"*), pero **sus páginas son
escaneos manuscritos y el OCR las destruyó**. Lo que sí es recuperable y verificable del texto:

- **Requisitos:** motor **Lycoming O-320-A2B, 150 hp @ 2700 RPM**, `C_bhp = 0.5` · `V_max ≥ 150 kt` ·
  `V_stall ≤ 50 kt` · despegue ≤ 1000 ft sobre 50 ft · **RoC > 1500 fpm** al nivel del mar ·
  rango ≥ 280 n mi a 115 kt · **n = ±6 g** · tripulante 220 lb.
- **Selecciones:** `A = 6` · `λ = 0.4` · `Λ_c/4 = 0°` · `Γ = 3°` · sin torsión · **NACA 63₂-015 en la
  PUNTA y 63₂-012 en la RAÍZ** — más t/c en la punta *"to prevent tip stall"*, que es lo contrario de
  la práctica normal y es una decisión deliberada de avión acrobático.
- **W/hp = 8** (históricos: Pitts 6.4, Great Lakes 10), rechazando el 14.4 que da la estadística
  *"because statistical values are for cruising aircraft, not aerobatics"*.
- **W/S = 10.2 lb/ft²** desde la pérdida sin flaps con `C_Lmax = 1.2` (históricos: Pitts 11.7,
  Great Lakes 9.6, Stephens Akro 13.0).
- ⭐ **El patrón de CALIBRACIÓN CON UN AVIÓN HERMANO**, que es un requisito de software de primera
  clase: la ecuación multivariable de la Tabla 6.2 da un coeficiente de 1.043, pero *"this is for
  cruising, not aerobatic aircraft. **We adjust the equation using the Stevens Akro**"* —
  `W_e = 954 lb`, `W₀ = 1300 lb` ⇒ `W_e/W₀ = 0.73` ⇒ fudge = **1.434** ⇒
  **`W_e/W₀ = 1.495·W₀^(−0.1)`**.
- ⭐ **Con motor FIJO, la matriz de dimensionamiento cambia de ejes:** *"Since Hp is fixed, there is
  no meaningful T/W optimization. Instead we optimize **W/S and aspect ratio**, holding
  range = 280 n mi."*
- ⭐ **Y la lección más viva del libro: el autor INVENTA una restricción a mitad del ejercicio.**
  Al ver que el arrastre inducido no acota el AR por abajo: *"AT VERY LOW ASPECT RATIOS, THE INDUCED
  DRAG WOULD BECOME EXCESSIVE DURING MANEUVERS. THEREFORE, **WE NEED SOME REQUIREMENT BASED ON
  MANEUVERING.**"* ⇒ define un nuevo requisito de **viraje sostenido** y con eso el espacio queda
  acotado. **El espacio de restricciones no viene dado: se descubre diseñando.**
- La observación final sobre el óptimo: *"the wing loading required for the desired no-flaps stall
  speed has **strongly biased the aspect-ratio optimization**, leading to a lower-than-expected
  optimal aspect ratio. This looks odd until one notes that **the total wing span is quite normal
  after optimization — it is the chord length that is excessive.**"*

**Los números tabulares del DR-1 (matriz 3×3 de W₀, tablas de iteración, desempeño por variante) NO
son verificables en esta extracción.** Para convertirlos en gate hay que **abrir el PDF y
transcribirlos a mano**. Es una tarde de trabajo y vale la pena: sería el gate del modo "motor fijo".

### 7.4 Qué se puede implementar como suite de regresión, en orden

| # | Gate | Estado del dato | Esfuerzo |
|---|---|---|---|
| 1 | **ASW §3.6** (5 tablas de iteración, 3 trades) | ✅ verificado y ya reproducido a 0.03% | **hecho** |
| 2 | **Validación externa vs S-3A** (+7.9%) | ✅ literal | trivial |
| 3 | **No-convergencia con C > 0** | ✅ regla literal de §3.3 | trivial |
| 4 | **Composición de Mach 0.8→2.0 = 0.956** | ✅ literal de §6.3.9 | trivial |
| 5 | **Constantes óptimas del cap 17** (0.760, 1.316, 0.866, 1.73, h_e = 42,447 ft) | ✅ literal | trivial, y atrapa errores de signo |
| 6 | **DR-3, 14 segmentos + sizing results** | ✅ verbatim verificado | bajo |
| 7 | **DR-3, carpet plot 25×5 + desempeño 25×7** | ✅ verbatim verificado | medio (teclear) |
| 8 | **DR-3, MVO con 3 restricciones activas** | ✅ verbatim verificado | bajo — **el mejor test del optimizador** |
| 9 | **Tubo+cono+ala del §7.11** (áreas mojadas y volumen a mano vs kernel) | ✅ el cliente lo pide en mayúsculas | bajo |
| 10 | **DR-1 completo** (modo motor fijo) | ❌ requiere transcripción manual del PDF | una tarde |
| 11 | Ejemplos de Anderson y Bertin (TAT, PAN, LL, VLM, BL, OBL, PM, SE) | ✅ ~30 casos con números | por módulo |

### 7.5 El otro lazo: §19 — cómo se resuelve W₀ de verdad

**§19.2 (lo que hacen las empresas grandes, y que Raymer declara fuera de alcance):**
la misión se parte en *"a large number of very short segments that can be less than 1 min in
duration"*; α y nivel de empuje se **varían** para dar la sustentación y aceleración de cada
maniobra, con el empuje limitado por **una tabla de empuje instalado vs altitud y Mach**. Y el
criterio de paro: *"The computer iterates for sized takeoff weight by varying the assumed takeoff
weight **until the ending empty-weight fraction matches the empty-weight fraction determined by the
detailed weight estimation**."*

**§19.3 (lo que sí se implementa) — ecuaciones por segmento:**
```
(19.6)  W_fi = C·T·d                                    combustible por duración
(19.7)  W_i/W_{i−1} = 1 − C·d·(T/W)_i                   fracción por tiempo (rubber)
(19.8)  W_i/W_{i−1} = exp[ −C·Δh_e / (V·(1 − D/T)) ]    climb / accel (energía)
(19.9)  Δh_e = Δ(h + V²/2g)
(19.10) W_i/W_{i−1} = exp[ −R·C / (V·(L/D)) ]           cruise (cruise-climb)
(19.11) W_i/W_{i−1} = exp[ −E·C / (L/D) ]               loiter
(19.13) W_e = W_e,as-drawn · (W₀/W₀,as-drawn)^(1+c)     escalado del vacío, c ≈ −0.1
(19.14) C_D0′ = (1−X)·C_D0 + X·C_D0/(W₀/W₀,as-drawn)^0.666   corrección de photo-scale
```

⭐ **La bifurcación rubber vs fijo, literal:** *"if (T/W)_i remains essentially constant during the
iterations, the result of Eq. (19.7) can be used **unchanged** for each iteration. This is the case
for 'rubber-engine' sizing."* Con motor fijo, *"Eq. (19.7) **would have to be recalculated for each
iteration step** because the T/W for a fixed thrust changes as the weight is changed. Alternatively,
Eq. (19.6) can be used ... The fuel burned is then **treated as a weight drop** in the sizing
iterations."*

⭐ **Cómo calcular tu propio `c`** (en vez de usar el −0.1 estadístico): *"Make an arbitrary change in
W₀, say a **10% increase**, and recalculate W_e with all effects considered"* (alas, colas, fuselaje,
tren, motor mayor) y despeja c de (19.13).

⭐ **El gate de cordura del propio autor:** *"this author gets nervous at a takeoff-weight difference
greater than about **30% of the as-drawn weight**"* ⇒ redibujar, reanalizar, redimensionar.

**El photo-scale problem** — la trampa que rompe cualquier escalado ingenuo. Los coeficientes se
pueden reusar *"provided that the sizing calculations stay close to the baseline TOGW, say
**10–20%**"*. Si el TOGW se reduce a la mitad, la longitud escala √(1/2) y **el volumen escala
(1/2)^1.5 = 0.354** — no cabe nada. Y **el fuselaje de pasajeros no encoge**: siguen ahí los
pasajeros, galleys y baños. Efecto medido: en un estudio de transporte futuro el exponente de la
fracción de peso vacío pasa de **−0.06 a −0.31** al corregir el photo-scale — *"a huge difference"*.
Escape declarado: *"For most design efforts, and certainly for student projects, the photo-scale
problem **can be ignored**."*

### 7.6 §19.4 — El sizing matrix / carpet plot como ALGORITMO

Marco teórico que el autor cita explícitamente: **el teorema de Kuhn-Tucker (1950)** —
*"at the optimum the only direction you can move to improve the objective function is one that will
**violate one or more constraints**."* Y añade: *"This is the essence of aircraft optimization
methods, **which long predate Kuhn-Tucker**."*

```
P1  Construir la MATRIZ: variar T/W y W/S "typically by plus and minus 20%" → 3×3 mínimo.
    "For better accuracy, 5×5 and larger sizing matrices are used at the major aircraft
     companies but require more work."
P2  ⭐ CADA CELDA ES UN AVIÓN DISTINTO: re-analizar aero, propulsión y pesos. NO se interpola.
P3  Dimensionar cada uno a la misión → W0_sized[i][j]
P4  Analizar el desempeño de cada uno → Ps, s_TO, t_accel, ...
    "If the T/W and W/S variations are wide enough, at least one of the aircraft will meet
     all performance requirements, although it will probably be the heaviest airplane."
P5  CROSS-PLOT: para cada T/W, graficar W0_sized vs W/S y cada métrica vs W/S
P6  Sobre las curvas de W0, leer los W/S que dan pesos redondos igualmente espaciados
P7  Trasladar esos pares al plano T/W–W/S y unir → LÍNEAS DE ISO-W0
P8  Sobre las curvas de desempeño, leer los W/S que cumplen EXACTAMENTE cada requisito
P9  Trasladar → LÍNEAS DE RESTRICCIÓN. "Shading is used to indicate which side ... the
     desired answer must avoid."
P10 ÓPTIMO = el punto de menor iso-W0 que respeta todo; "found by inspection ... and usually
     will be located where two constraint lines cross."
```

El **carpet plot es el mismo resultado en otro formato** (*"Fig. 19.5 Carpet plot format (same
results!)"*): se superponen las curvas `W₀ vs W/S` de cada T/W **desplazando el eje horizontal un
incremento arbitrario e IGUAL cada vez** — *"This shifting of the axis is **crucial** to the
development of the carpet-plot format"* — y se unen los puntos de igual W/S. Luego
*"The horizontal axis can be removed ... because one can now read wing loadings by interpolating
between the curves."*
⚠ **El término "thumbprint" NO aparece en la 6ª edición** (0 coincidencias). Los nombres del autor
son **sizing matrix plot** y **carpet plot**.

**Ejemplo numérico de la Fig. 19.1** (caza pequeño, matriz 3×3, con requisitos `Ps ≥ 0 @ M0.9,
30k ft, 5 g` · `s_TO ≤ 500 ft` · `accel ≤ 50 s`):

| | W/S = 50 | W/S = 60 | W/S = 70 |
|---|---|---|---|
| **T/W = 1.1** | W₀ 56,000 · Ps 700 · s_TO 340 · a 46 s | 49,000 · 330 · 430 · 42 | 46,000 · 30 · 660 · 39 |
| **T/W = 1.0** | 48,500 · 430 · 450 · 50.5 | **baseline** 43,700 · 30 · 595 · 47 | 42,000 · −190 · 800 · 45 |
| **T/W = 0.9** | 44,000 · 140 · 670 · 56 | 39,000 · −230 · 810 · 53 | 36,000 · −320 · 1010 · 51 |

### 7.7 §19.5 — Trade studies y las dos reglas anti-trampa

**Tabla 19.1 — los tres tipos**

| Design trades | Requirements trades | Growth sensitivities |
|---|---|---|
| T/W y W/S · A, Λ · t/c, λ · forma y comba del perfil · dispositivos de alta sustentación · esbeltez del fuselaje · BPR, OPR, TIT · diámetro de hélice · materiales · configuración (tipo de cola, flecha variable, número y tipo de motores, mantenibilidad, observabilidad, arreglo de pasaje) · tecnologías avanzadas | Alcance / payload / pasajeros · tiempo de loiter · velocidad · razón de viraje, P_s, n_max · longitud de pista · tiempo de ascenso · nivel de firma · design-to-cost | **Dead weight** · C_D0 · K · C_Dwave · C_Lmax · empuje · SFC · precio del combustible |

El **growth sensitivity** se presenta *"in a single graph, with **percentage change of the various
parameters on the horizontal axis and percentage change in takeoff weight on the vertical axis**"* —
ese es el gráfico de growth factor, y es un entregable con nombre propio.
⚠ **El término "growth factor" con un número NO aparece en el cap 19**; la 6ª edición lo llama
*growth sensitivity*. Los números duros hay que sacarlos del ASW (§7.1 arriba).

⭐ **"Dead Weight", el trade que el autor destaca:** *"a catch-all phrase for 'the airplane empty
weight might increase by X pounds'."* Y la observación: *"When the actual aircraft is finished and
put up on scales, **there is no dead weight!** But there may be additional weight due to problems
like those mentioned above."*

⭐ **La regla del "realism factor" — el anti-fraude de los trade studies:**
> *"If asked to study the impact of carrying two more internal missiles, the designer might find a way
> to 'stuff them in' without changing the external lines of the aircraft. **If there were sufficient
> room in the baseline to fit two more missiles internally, then the baseline was poorly designed.
> If the baseline was already 'tight,' then the revised layout must be a fake!**"*
>
> Regla ejecutable: *"insist that all redesigned layouts used for trade studies be checked to
> **maintain the same internal density as the baseline, calculated as takeoff weight divided by
> internal volume**."*

**Esto es implementable hoy con nuestro kernel:** `densidad = W₀ / volumen_interno_medido`, comparada
contra el baseline, como **gate automático de todo trade study**. Es exactamente el tipo de
verificación que un CAD puede hacer y una hoja de cálculo no.

⭐ **La regla de anidamiento, que es carísima en cómputo:**
> *"each parametric variation of those other variables **should be calculated using a complete
> T/W–W/S carpet plot for each data point**. Otherwise, the answers aren't believable because the
> initial values of T/W and W/S might be forcing the answer to a non-optimal direction."*

Aritmética explícita del autor: optimizar A y Λ ⇒ 3×3 combinaciones × 9 puntos de carpet =
**81 aviones completos**; los 6 parámetros básicos ⇒ **3⁶ = 729 mínimo, 5⁶ = 15,625 sería mejor**.
Y su pregunta retórica: *"**How do you draw a six-dimensional carpet plot?**"*

**Aquí es donde el software gana de verdad contra Raymer haciéndolo a mano.** 729 corridas de un
lazo que converge en 6 vueltas es trivial para un navegador; a mano es una carrera.

### 7.8 §19.6 — Lo que el cliente opina de la optimización automática

**Contra el "todo-optimización":** *"Such 'everything optimization' is neither feasible nor desirable.
After a certain point, excessive time spent on defining, executing, and understanding an optimization
method or computer program is just **time taken away from other pressing design tasks**."*

⭐ **Argumento 1 — la misión de diseño es ficción:** *"In the history of aviation, there has probably
**never been a case of an aircraft flying its 'design mission'**."* El F-4 se diseñó para
interceptación supersónica desde cubierta y se usó como caza-bombardero multirol. El F-16 nació con el
grito de guerra *"not a pound for air-to-ground"* y hoy es el principal avión de ataque a tierra de la
USAF.
⭐ **Argumento 2 — la computadora no sabe si cabe:** *"the reader should now scream, '**but how does
the computer know if the landing gear fits, and the radar fits, and the passengers fit, and the fuel
tanks are big enough, and the overnose vision angle is still correct**, and....'"*
⭐ **Argumento 3 — el problema humano:** *"Once a time-consuming optimization model is developed for a
certain design approach, there will be an understandable **reluctance to look at totally different
design approaches** that are not represented by the model. This could serve as a **dampener on the
essence of aircraft conceptual design**."*

**Su postura de equilibrio, que es el pliego de UX del optimizador:**
> *"if we are careful to use optimization in a balanced fashion, **with experienced designers always
> 'in the loop,'** it can be a very powerful tool ... it is best used **when based on analysis of a
> realistic and complete aircraft conceptual design layout** and when its goal is to **quickly tell
> the aircraft designer how to change the design layout to make it better** and is used in the next
> design iteration **as only one of many 'inputs'**."*

**Catálogo de técnicas MDO** con sus reglas: **Response Surface** (*"the classic aircraft design
carpet plot is a graphically fit response surface but limited to three dimensions"*; ⭐ regla dura:
*"if the equation form of the RS is **lower than third degree**, any reflexes in the actual surface
will be smoothed over and **the answer will be wrong**. Fourth or fifth degree would be even
better"*) · **Latin squares** (*"tells you which data points to skip"*) · **Finite difference** ·
⭐ **Gradiente exhaustivo, el del propio Raymer** — algoritmo directamente implementable: cada
variable ±un paso; se analizan **todas** las variantes completas; la mejor que cumple todo se
recuerda y **se vuelve el nuevo centro**; se repite hasta que ninguna variante mejora; **entonces se
acorta el paso** y se repite hasta la resolución deseada *(es un pattern search / coordinate descent
con reducción de paso)* · **Implicit Function Theorem** · **Decomposition** · **Genetic algorithms**
(con escepticismo declarado: la convergencia poblacional *"is presumed to represent an optimum
(**but occasionally it doesn't** — the subject of much research today)"*).

**§19.7 — costo como medida de mérito:** el peso es buena aproximación *"because cost is so strongly
driven by the weight (especially empty weight) **for a given design approach**"*. ⭐ **Cuándo el peso
MIENTE:** *"if you are doing trade studies of **alternative technologies, engines, avionics,
manufacturing methods**, or similar items, then **weight is a poor approximation to cost**"* y
*"life-cycle cost is largely driven by fuel costs, which might not be minimized by finding the minimum
weight airplane. **A higher-aspect-ratio wing is heavier but saves fuel.**"*

### 7.9 §20.11 — El caso eléctrico: donde el lazo clásico SE ROMPE

⭐ **El diagnóstico físico, literal (§20.3):**
> *"A subtle disadvantage is that, unlike fuel-based powerplants, **there is no range benefit from the
> burn off of 'fuel' during the mission**. At the end of cruise, the gas-powered aircraft is lighter
> and therefore has less drag. It is this effect that is integrated in the Breguet range equation, but
> **it does not apply to electric propulsion**. Instead, drag stays the same and the range is found
> simply as speed times the power supply's calculated duration. For a long-range aircraft this may be
> equivalent to a **10–20% reduction in range**."*

Y la prohibición explícita: *"**methods developed for fuel-burning aircraft should not be applied to
electric aircraft** because their derivations assumed that the aircraft gets lighter as the mission
segment progresses."* Por eso desaparece el logaritmo: *"since W₀ doesn't change during the flight
**the logarithmic operation resulting from integration over the weight change isn't included**"* —
Breguet tiene `ln(W_i/W_{i+1})`; la eléctrica tiene `m_b/m` **lineal**.

**El pivote es el BMF (Battery Mass Fraction)** = masa de baterías / masa total.
*"BMF is analogous to a value of **one minus** the mission segment weight fraction (1 − W_i/W_{i−1})."*
```
(20.6) BMF = 1000·P_used·E / (E_sb·η_b2s·m)         known run-time (takeoff, descenso, viraje, VTOL)
(20.7) BMF = E·V·g / (3.6·E_sb·η_b2s·η_p·(L/D))     loiter
(20.8) BMF = R·g   / (3.6·E_sb·η_b2s·η_p·(L/D))     cruise
(20.9) BMF = h·P_used / (3.6·V_v·E_sb·η_b2s·m)      climb
(20.11) W₀ = W_payload / (1 − BMF − W_e/W₀)          la ecuación de sizing
```

> ⭐⭐ **LA REGLA QUE ROMPE EL CÓDIGO SI LA COPIAS DEL CAP 3:**
> *"The total required aircraft Battery Mass Fraction (BMF) is then found as the **sum (not product)**
> of the various mission segment Battery Mass Fractions."*
> **BMF_total = Σ BMF_i**, frente a `W_f/W₀ = 1.06·(1 − Π(W_i/W_{i−1}))`. Suma, no producto.

**¿Cerrada o iterativa?** *"Selecting a specific value for empty weight fraction makes this a
**closed-form** calculation, but this is a simplistic assumption."* Lo correcto es la estadística de
la Tabla 3.1 y entonces *"**an iteration process must then be applied**... First guess W₀, then
calculate W_e/W₀, and then use that and the required BMF to calculate W₀. Iterate until the calculated
value equals the guess value."*
**Punto sutil:** `BMF_total` **no depende de W₀**, así que la única no linealidad es `W_e/W₀ = A·W₀^C`
⇒ converge más rápido que el caso térmico.

**Eficiencias:** controlador **0.98** × motor **0.95** ⇒ **η_b2s ≈ 0.93**; con caja (0.98) ⇒ **0.90**.
`η_p ≈ 0.80`. Total batería→aire ≈ **0.72**.
**Tabla 20.1 — energía específica (2018,** *"should be used with great caution"***):** plomo-ácido 45 ·
NiCd 60 · NiMH 90 · Li-ion 100–265 · LiFePO4 120 · **NMC 260** · Li-S 400 · Licerion 500 ·
Li-aire 600 (experimental) Wh/kg. Contra **jet fuel 11,000 · gasolina 12,000 · LH2 39,406**.
⭐ **El benchmark brutal:** *"Even after the superior efficiency of electric motors is included,
**gasoline has 20 times better effective energy density than the best batteries**."*
⚠ **No hay fracciones de peso vacío para eléctricos** en el libro; Raymer manda a la Tabla 3.1 y dice
*"it is wise to **adjust the constant terms using data for recent electric-powered aircraft**."*
⚠ **Y no hay ningún ejemplo numérico resuelto en §20.10 ni §20.11.** Cero. Solo las ecuaciones.

### 7.10 Cap 18 — Costo: ¿vale la pena implementarlo?

**Sí, y es de lo más barato con más palanca del libro.** DAPCA IV son **9 ecuaciones algebraicas
cerradas, cero iteración**, con solo 8 escalares que el pipeline de sizing **ya produce**
(`W_e, V_max, Q, FTA, N_eng, T_max, M_max, T_TIT`). Es diferenciable y monótona ⇒ sirve directo como
función objetivo del optimizador del cap 19, que es exactamente para lo que el libro la manda usar.

```
(18.1) H_E   = 4.86·W_e^0.777·V^0.894·Q^0.163          horas de ingeniería
(18.3) H_M   = 7.37·W_e^0.82 ·V^0.484·Q^0.641          horas de manufactura
(18.4) H_Q   = 0.076·H_M (carguero) | 0.133·H_M (resto)
(18.5) C_D   = 91.3·W_e^0.630·V^1.3                    desarrollo
(18.6) C_F   = 2498·W_e^0.325·V^0.822·FTA^1.21         pruebas de vuelo
(18.7) C_M   = 22.1·W_e^0.921·V^0.621·Q^0.799          material
(18.9) RDT&E + flyaway = ΣH_i·R_i + C_D + C_F + C_M + C_eng·N_eng + C_avionics
Wrap rates (USD 2012/h): R_E $115 · R_T $118 · R_Q $108 · R_M $98
```
⭐ **El gotcha #1:** `Q` = *"lesser of production quantity **or number to be produced in five
years**"*. Y `Q^x` **ES la learning curve** — da **horas TOTALES ACUMULADAS del programa**, no horas
por avión. Validación cruzada del propio texto: *"the total engineering effort for a 500-aircraft
production run is about **three times** the engineering effort for a one-aircraft production run"* ⇒
`500^0.163 = 2.75 ≈ 3` ✓. **Ese es un test unitario de una línea.**
⭐ **Reglas de dedo:** *"**Aircraft are bought by the pound.**"* USD 2012 por libra de peso vacío:
GA pequeña ~$200 · airliners y business jets ~$800 · cazas viejos ~$2,000 · F-22 ~$3,500 ·
F-35 acercándose a $5,000. CER cerrado de airliner:
**`Precio = $5,000,000 + 550·W_e[lb]`**.
⭐ **Y la honestidad epistemológica:** *"There is **no 'fundamental physics'** to underpin the
analysis"*, y los fudge factors se definen como *"**variable constants that you multiply your answer
by to get the right answer**"*.
**Learning curve:** origen Wright-Patterson AFB, **años 1930**; *"production labor costs decreased by
up to 15% each time the production quantity was doubled. This is now called an **85% learning
curve**."* Rango típico **75–85%**; el **Boeing 727 fue 80%**, línea casi perfecta en log-log del
avión 1 al 1000.
⭐ **El método alterno que Raymer dice que puede ser MEJOR:** *"Merely multiplying the component
weights of the new aircraft times the dollars per pound or hours per pound for a similar baseline
aircraft is **probably better than a sophisticated CER** based upon a number of not-so-similar
aircraft."* Valores: **50 h/lb** para fuselaje y subsistemas, **90 h/lb** para alas y empenajes.
*"especially useful for prototype and flight demonstrator (X-series) aircraft, **which are poorly
estimated by sophisticated CERs**."*
⭐ **La regla anti-comparación:** *"**Comparing the flyaway cost of one aircraft to the program or
life-cycle cost of another is meaningless.**"* Y *"constant-year dollars should be used"* — F-15 vs
F-16: +60% en dólares del año, **+130% en dólares constantes de 1978**.
**Recomendación de implementación:** función pura `dapca4(...) → {horas, costos, banda_lo, banda_hi}`,
con los fudge factors **como parámetros explícitos, nunca cableados**, que **devuelva banda, no
número** (el rango de material 1.1–1.8 es 1.6× de indeterminación; el ÷4 de GA es 4×).

### 7.11 Apéndices — el inventario de datos a digitalizar

Son **seis, A–F**. Prioridad para nosotros:

| Ap. | Contenido | Qué hacer |
|---|---|---|
| **A** | Conversión de unidades, ~66 filas. Incluye taxonomía aeronáutica que los estándares no traen: **SFC, power SFC, fuel specific energy, range parameter (n mi/lb), loiter parameter (s/lb)** | Usa NIST SP 811 para los factores; **copia solo la taxonomía** |
| **B** | Atmósfera estándar, **84 filas fps + 74 mks**, fuente **US Standard Atmosphere 1976** | **Ya tenemos `atmosfera.ts`.** Usa estas tablas como **fixtures de test** (tol ~0.1%) |
| **C** | Airspeed IAS/CAS/EAS/TAS. Caso de verificación literal: *"at 15,000 ft, 30 °C day: M = 0.428; TAS = 290 kt; CAS = 215 kt; EAS = 213 kt"* | Una función + ese test |
| **D** | **8 perfiles** (NACA 0006, 0009, 2415, 4415, 23015, 64-006, 65(216)-415, y NLF(1)-0215F) con coordenadas. **Las polares son IMÁGENES escaneadas** de NACA TR-824 | Los 7 NACA se **generan** analíticamente. **No digitalices las polares** — genera con XFOIL y valida contra las láminas |
| **E** | 3 motores **HIPOTÉTICOS** (no reales), generados con ONX/OFFX. Turbofán A/B 30,000 lb BPR 0.41 · alto bypass 50,000 lb BPR 8.0 · turbohélice 6500 hp. Los decks son **~25 láminas gráficas** | Teclea las 3 fichas; **regenera los decks** con un modelo de ciclo. Para motores reales: **ICAO Engine Emissions Databank** y **EUROCONTROL BADA** |
| **F** | ⭐ **El más valioso: requisitos como restricciones ejecutables.** F.1 aplicabilidad FAR · F.2 despegue · F.3 aterrizaje · **F.4 gradientes de ascenso FAR por segmento y número de motores** (2º segmento 2.4/2.7/3.0%; 4º 1.2/1.5/1.7%; go-around 2.1/2.4/2.7%; config. de aterrizaje 3.2%) · F.5 idoneidad para portaaviones (elevador 70×52 ft, ancho de tren ≤22 ft, altura plegado ≤18'6", peso ≤80,000 lb, envergadura ≤82 ft) | **~120 celdas, teclear ya.** El texto normativo real desde **eCFR (14 CFR)** y **EASA CS-23/CS-25** |

**Y las tablas del CUERPO valen más que varios apéndices:** 3.1 (16 clases de W_e/W₀) · 3.2 · 3.3 ·
3.4 · 4.1/4.2/4.3 · 5.1–5.5 · **6.1/6.2 (peso vacío MULTIVARIABLE)** · 6.3 · 6.4 · 6.5 · 9.1 ·
12.1–12.8 · 14.2 · 15.2/15.3/15.4 · 16.1/16.2 · 17.1 · 19.1 · 20.1.
**Ese conjunto es lo que hace posible el primer lazo de sizing.** Es un día de tecleo.

---

## 8. BRECHA CONTRA LA FORJA Y QUÉ CONSTRUIR

### 8.1 Qué hay hoy (auditado en el repo, 2026-07-31)

| Módulo | Archivo | Estado | Tests |
|---|---|---|---|
| Atmósfera ISA | `src/aero/atmosfera.ts` | ✅ completo, validado vs ISO 2533 | 8 |
| Cuña supersónica (Anderson Ej. 1.1) | `src/aero/cuna-anderson.ts` | ✅ D′, c_d, reparto 85/15 por integración de paneles | 8 |
| Flujo potencial Joukowski + Kutta | `src/aero/potencial.ts` | ✅ Γ de Kutta, Cp, L′ = ρUΓ | 9 |
| Estudio VIENTO supersónico en el CAD | `src/forja/sim/viento.ts` | ✅ β de θ-β-M, p₂ del choque, integración sobre la pieza del kernel | 7 |
| Kernel B-Rep (OCCT-WASM) | `src/forja/brep/` | ✅ sólidos, secciones, planos, medición | — |
| FEA propio | `src/forja/brep/fea.ts` | ✅ 1191 líneas, von Mises sobre la pieza | — |
| Térmica FDM | `src/forja/mold/mold-thermal-fdm.ts` + 4 más | ✅ | — |
| **Paneles 2D (Hess-Smith / vortex panel)** | — | ❌ **no existe** | — |
| **Perfil delgado (Glauert) / generador NACA** | — | ❌ **no existe** | — |
| **Línea sustentadora / VLM** | — | ❌ **no existe** | — |
| **Capa límite / arrastre por fricción** | — | ❌ **no existe** | — |
| **SIZING: W₀, fracciones de misión, W_e** | — | ❌ **no existe — y es lo que Raymer considera "la calculación más importante"** | — |
| **Diagrama de restricciones T/W × W/S** | — | ❌ **no existe** | — |
| **Pesos por grupo (cap 15)** | — | ❌ **no existe** | — |
| **Carpet plot / trade studies** | — | ❌ **no existe** | — |

**El diagnóstico en una línea:** tenemos **aerodinámica de una pieza** (Anderson) y **cero
dimensionamiento de aeronave** (Raymer). Tenemos las herramientas para calcular sobre un sólido y
no tenemos el lazo que decide **qué tan grande** debe ser el sólido. Y ese lazo es, según el cliente,
la razón de ser de todo el resto:

> *"Sizing is the most important calculation in aircraft design, more so than drag, or stress, or
> even cost."* (§3.1)

### 8.2 ⭐ La observación estratégica: el sizing es Kazmer otra vez

El lazo de peso de Raymer y el lazo de enfriamiento de Kazmer son **el mismo objeto matemático**:
punto fijo explícito, con relajación dictada por experiencia, con criterio de paro laxo, con
condición de existencia que hay que validar antes de iterar, y con una tabla estadística por clase
de producto detrás. La Forja **ya sabe construir esto**: el patrón `libro → módulo → test → gate`
del molde aplica sin traducción.

La diferencia: el molde produce una cotización; el avión produce **un W₀ y un dibujo**. Y a
diferencia de moldes, aquí el cliente ya nos dijo qué le falta al CAD del mercado (§0).

### 8.3 Qué construir, en orden

**F0 — `src/aero/sizing.ts` — EL LAZO DE PESO. Primer entregable verificable.**

Superficie mínima:

```ts
type Segmento =
  | { tipo:'warmup'|'takeoff'|'climb'|'descent'|'land', fraccion:number }
  | { tipo:'climb-accel', machFinal:number, machInicial?:number }   // Ec. 6.9/6.10
  | { tipo:'crucero', R:number, C:number, V:number, LD:number }      // Breguet 3.6
  | { tipo:'loiter',  E:number, C:number, LD:number }                // 3.8
  | { tipo:'combate', d:number, C:number }                           // 6.16 / 6.24
  | { tipo:'suelta',  W:number };

type ClaseAvion = 'jet-transport'|'jet-fighter'|'military-cargo-bomber'|... // 16 clases, Tabla 3.1

sizeAircraft(mision, clase, {motor:'rubber'|'fijo', omega=0.75, tol})
  → { W0, We, Wf, historia: Iteracion[], convergio, quienManda }
```

Reglas que el módulo DEBE hacer cumplir (no son opcionales, son del cliente):
1. **Rechazar C ≥ 0** en la ecuación de peso vacío con un error explícito ("la ecuación de sizing no
   converge con exponente positivo" — §3.3).
2. **ω = 0.75** por defecto, configurable, documentado por qué.
3. Combustible = `1.05·mision + 1%` atrapado, desglosado, no un 1.06 opaco.
4. Modo motor fijo con **la variable de convergencia parametrizada** (W₀ o R), no cableada.
5. Exponer `growthFactor = ∂W₀/∂W_payload` como salida de primera clase.
6. **Sanity check histórico**: marcar el resultado si W_e/W₀, W/S o T/W caen fuera del rango de su
   clase (Tablas 3.1, 5.1, 5.2, 5.5).

**F1 — `src/aero/restricciones.ts` — el diagrama T/W × W/S.**
Las 10 restricciones de §5.3 como funciones puras `(params) → W/S_max` o `→ T/W_min`, más el
**gráfico de envolvente** con la etiqueta de quién manda en cada tramo. Salida a R3F/SVG: es una
imagen que vende sola y es didáctica.

**F2 — `src/aero/panel2d.ts` + `src/aero/naca.ts` + `src/aero/thin-airfoil.ts`.**
Lo que ya pide `PLAN-ESCUELA-AERO-EN-EL-CAD.md`. Alimenta a F3 con C_Lmax y polar real en vez de
tabla.

**F3 — `src/aero/lifting-line.ts` (+ VLM después).** C_Lα del ala, e de Oswald, CD_i real. Cierra el
lazo de arrastre sobre la geometría del kernel: **AR y S se MIDEN del sólido**, no se teclean.

**F4 — `src/aero/pesos.ts`** (cap 15, pesos por grupo) y **`src/aero/carpet.ts`** (cap 19).
Estos cierran los lazos 4 y 5 y convierten el módulo en un producto, no en una calculadora.

### 8.4 El primer entregable verificable — el gate del ASW

Igual que Kazmer, un caso del libro con números como gate de aceptación. **Ya está corrido y pasa.**

`src/aero/sizing.test.ts`, el caso `Raymer §3.6 Box 3.1 — ASW aircraft`:

- **Misión:** warmup+despegue, ascenso, crucero 1500 n mi a M 0.6 / 30,000 ft, loiter 3 h,
  crucero 1500 n mi de regreso, loiter 20 min, aterrizaje.
- **Payload:** 10,000 lb de aviónica. **Tripulación:** 800 lb (4).
- **Entradas:** A = 7 (combinado con canard), S_wet/S_ref = 5.5 → A_wet = 1.27 → L/D_max = 16;
  C_crucero = 0.5 1/h, C_loiter = 0.4 1/h; clase `military-cargo-bomber` (A = 0.93, C = −0.07).
- **Valores esperados del libro y lo que reproduce el código:**

| Cantidad | Libro | Reproducido | Δ |
|---|---|---|---|
| W₃/W₂ (crucero) | 0.858 | 0.8581 | 0.01% |
| W₄/W₃ (loiter 3 h) | 0.9277 | 0.9277 | 0% |
| W₆/W₅ (loiter 20 min) | 0.9917 | 0.9917 | 0% |
| W₇/W₀ | 0.6441 | 0.6440 | 0.02% |
| W_f/W₀ | 0.3773 | 0.3773 | 0% |
| **W₀** | **56,702 lb** | **56,718 lb** | **0.03%** |
| Trade 1000 n mi | 42,372 | 42,379 | 0.02% |
| Trade 2000 n mi | 80,218 | 80,256 | 0.05% |
| Trade compuestos (×0.95) | 51,585 | 51,601 | 0.03% |

Tolerancia propuesta: **0.5%** en W₀ (la diferencia real es 0.03%, y proviene de que el libro
redondea las fracciones intermedias a 4 cifras antes de multiplicarlas).

**Y el gate secundario, que es un hallazgo medido, no una cita:** con el mismo caso, contando
vueltas hasta |ΔW₀| < 0.5 lb desde W₀ = 50,000 lb:

| Relajación | Vueltas |
|---|---|
| ω = 0.50 | 13 |
| ω = 0.75 (**la del cliente**) | **6** |
| ω = 1.00 (punto fijo puro) | 7 |

**La regla de dedo de Raymer es medible y es correcta.** ω = 0.75 gana. Un implementador que hubiera
puesto el 0.5 "obvio" habría duplicado el costo de cada corrida, y el ciclo se corre 5–25 veces.

**Gates adicionales inmediatos** (mismos capítulos, mismo esfuerzo):
- **Validación externa:** el S-3A real pesa 52,539 lb; el método da 56,702. Error +7.9%.
  El test debe **afirmar el error contra el avión real**, no solo contra el libro — es la honestidad
  que el cliente exige (*"strict accuracy should not be expected... 'right ballpark'"*).
- **Gate de no-convergencia:** con C = +0.07 el solver **debe** fallar con error explícito.
- **Gate de composición de Mach:** M 0.8 → 2.0 debe dar 0.956 (§6.3.9).

### 8.5 ⭐ LOS REQUISITOS DE CAD QUE EL CLIENTE DICTÓ, Y NUESTRA POSICIÓN FRENTE A ELLOS

§7.11 es una lista de requisitos de producto escrita por el cliente en 2018, sin saber que la
estábamos leyendo. Contra cada uno, dónde estamos:

| # | Requisito del cliente (§7.11) | Estado en La Forja |
|---|---|---|
| R1 | **Cambias A, λ o flecha y TODO se regenera solo:** el remodelado no trapezoidal, tanques, flaps, alerones, largueros, costillas, carrythrough y anclajes del tren. *"All that the designer should have to do is to enter the revised geometric parameter."* | ❌ Tenemos kernel paramétrico y features; **no tenemos el modelo de ala paramétrico**. Es construible sobre lo que hay |
| R2 | **La retracción oblicua de doble cante debe ser tan fácil como la recta**, o el CAD te empuja al diseño peor | ❌ Tenemos joints y `joint-transforms.ts`; falta el mecanismo de tren de 4 barras con trunnion canteado |
| R3 | **Volumen de un tanque de geometría arbitraria** (envolviendo el ducto) = un botón | ✅ El kernel B-Rep ya mide volumen de sólidos arbitrarios. **Falta el descuento del 85/92/77/83% y el fuel-volume plot** |
| R4 | **Área mojada correcta**, sin olvidar ni contar doble el perfil raíz que se quita del fuselaje; y sin "tapar" tomas, toberas y disco de hélice | ⚠️ El kernel puede; **falta el test que lo demuestre** |
| R5 | **El test de aceptación en sus mayúsculas:** *"start by doing a trivially simple 'aircraft design' consisting of a tube-plus-cone fuselage and a simple wing, where the correct wetted areas and volumes can be easily calculated by hand"* | ❌ **Es el test que hay que escribir mañana.** Cuesta una tarde y valida el kernel para aero |
| R6 | **Cero curva de botones:** *"ANY time spent learning which button produces which geometry is time NOT spent learning... aircraft conceptual design"* | ⚠️ Es exactamente la doctrina de la Escuela (`escuela vive en el CAD`), pero el monolito de UI juega en contra |
| R7 | **El sistema debe MEDIR lo que el ojo ya no puede juzgar** (*"everybody's designs look good whether they are or are not"*) | ❌ Es la oportunidad más grande: **gates automáticos de calidad de layout** |
| R8 | **Buttock-plane cuts como verificación de suavidad** de la superficie | ❌ Tenemos `cross-section.ts` y `MoldSectionReveal`; el corte ya existe, **falta el criterio** |
| R9 | **Pocas estaciones de control a propósito**, para evitar el "wiggling" | ❌ Requisito de UI, no de kernel |

**⭐ R5 + R7 son el primer entregable de kernel, y son baratos.** El test tubo+cono+ala es aritmética
de preparatoria contra el kernel; el gate de suavidad por buttock-planes es medir la segunda derivada
de una polilínea. Los dos convierten "el CAD dijo" en "el CAD lo demostró", que es el sello del
proyecto.

### 8.6 Por qué esto le sirve a la Escuela y no solo al producto

`docs/forja-research/aero/CURRICULUM-AERO.md` y `PLAN-ESCUELA-AERO-EN-EL-CAD.md` ya trazan el camino
Anderson (U1–U5, con `panel2d.ts`, `naca.ts`, `lifting-line.ts` pendientes). **Este pliego añade el
capstone que faltaba: Raymer.** Una unidad U-CAPSTONE donde el alumno:

1. Recibe una misión (la del ASW, o la de un avión que le importe).
2. Dibuja **cuatro** croquis de concepto — porque el cliente exige cuatro, no uno.
3. Estima S_wet/S_ref **a ojo** contra la Fig. 3.6 y ve cómo su ojo cambia el W₀ final.
4. Corre el lazo de peso y **ve la telaraña converger** en la gráfica de 45° (Fig. 3.11).
5. Traza el **diagrama de restricciones** y descubre qué requisito manda su ala.
6. **Construye el avión en el Part Studio** con S y L salidos del sizing, colas por coeficiente de
   volumen, y el tren cumpliendo el 8–15% en la nariz y los 63° de vuelco.
7. El estudio mide **área mojada y volumen reales** del sólido, y el sizing se **vuelve a correr** —
   y le sale que su avión no cumple, que es exactamente lo que Raymer promete.
8. Escribe qué está mal y qué haría en el Dash-Two. **Esa es la calificación.**

Es la lección más honesta que se puede dar en ingeniería y **solo se puede dar dentro de un CAD**.

---

## 9. ⭐ LOS 10 DETALLES QUE UNA MÁQUINA LINEAL SE SALTA

Criterio de selección: cada uno es (a) invisible si solo lees las ecuaciones, (b) silencioso cuando
lo implementas mal —produce un número plausible y equivocado—, y (c) barato de hacer bien si lo sabes.

---

**⭐1 · La relajación es ω = 0.75, no 0.5 — y el exponente C DEBE ser negativo o el lazo diverge.**
§6.3.7: *"the new guess for W0 [should be] about **three-fourths of the way** from the initial guess
to the calculated W0 value."* Lo medí con el caso ASW: **ω=0.75 converge en 6 vueltas, ω=0.5 en 13,
ω=1.0 en 7.** El cliente ya hizo el experimento. Y §3.3 añade la condición de existencia:
*"it may return a **positive exponent** ... **the sizing equation will not converge**. Instead
**force** the software to use a negative number 'C' term."* Un C > 0 hace que W_e/W₀ crezca con W₀ y
el punto fijo se va al infinito. **Es un gate de validación de entrada, no un detalle numérico.**

---

**⭐2 · Con motor fijo, el lazo INVIERTE su incógnita: se itera sobre el ALCANCE, no sobre W₀.**
§6.4.2: *"**The known takeoff weight is repeatedly used as the 'guess' W0, and the range for one or
more cruise legs is varied until the calculated W0 equals the known W0.**"* Y no solo el alcance:
*"a research aircraft could be sized for a certain radius with **the number of minutes of test time**
as the variable parameter."* Un programador escribe `solveW0()`. El cliente pide
`solve(unknown ∈ {W0, R, E_loiter, t_test}, target)` — **la variable de convergencia es un
parámetro**, no está cableada. Reescribir esto después es caro; nacer con ello es gratis.

---

**⭐3 · Los incrementos de factor de forma se aplican SOLO a la parte arriba de 1.0.**
Nota al pie de §12.5.4, verificada literal: *"These form factor adjustments should be applied **only
to the pressure-caused increment over the skin-friction drag, i.e., the portion of the form factor
above 1.0**. If the calculated form factor is 1.2 and you wish to apply a 30% increase, **the
resulting form factor is 1.26 not 1.56**."* Es decir `FF′ = 1 + 1.30·(FF − 1)`. Quien lea "+30%" y
escriba `FF*1.3` mete **24% de arrastre de más** sin que nada falle. Y hay ocho incrementos así en el
capítulo (cola articulada, fuselaje cuadrado, casco, flotador, canopy…).

---

**⭐4 · El VLM acierta por CANCELACIÓN AFORTUNADA de dos errores — y hay que decirlo en la UI.**
Bertin §7.4, literal: *"The VLM predicts the experimental data very well, due to the fact that
**vortex lattice methods neglect both thickness and viscosity effects. For most cases, the effect of
viscosity offsets the effect of thickness, fortuitously yielding good agreement.**"* No es rigor: es
una casualidad estructurada que se sostiene en un rango. Fuera de él —espesores raros, Re bajo,
alta α— el acuerdo desaparece **sin previo aviso**. Un producto honesto muestra el número **y su
razón de ser**. Del mismo tipo: *"the 'correct' answer may be **between the Karman-Tsien and Laitone
results**"* ⇒ **reporta una banda, no un número.**

---

**⭐5 · Todo el edificio numérico cuelga de una estimación A OJO sobre un croquis de servilleta.**
§3.4.4: *"Wetted area ratio can be **'eyeball' estimated** from the sketch."* De ese ojo salen A_wet,
L/D_max, las fracciones de misión, el combustible y W₀. El rango real de S_wet/S_ref va de **2.2 a
6.2** — un factor de casi 3. Una máquina lineal pide el dato y sigue; el producto correcto **hace del
ojo un ciudadano de primera clase**: muestra el espectro de la Fig. 3.6 al lado, guarda la estimación
como una decisión con autor y fecha, y **propaga su sensibilidad hasta W₀**. Corolario del mismo §:
⭐ *"Two airplanes with similar span and total wetted area will have a similar lift-to-drag ratio,
even if they look completely different and **their aspect ratios are dissimilar**."* — **el aspect
ratio NO predice el arrastre**, y media industria cree que sí.

---

**⭐6 · Tomar el mínimo de los W/S es correcto Y es insuficiente: si UNA restricción manda, se veta.**
§5.3.1: *"If an unreasonably low wing loading value is driven by **only one** of these performance
conditions, the designer should consider **another way to meet that condition**."* Y §5.3.9 lo
convierte en regla de software: *"**If these equations yield W/S values far from historical values,
the e value is probably unrealistic, and the calculated W/S values should be ignored.**"* El cliente
pide un **sanity check contra la historia dentro del solver**: si el resultado sale del rango de su
clase, no se muestra como respuesta — se muestra como **sospecha**. Un `Math.min()` produce aviones
estúpidos con total confianza.

---

**⭐7 · Cuatro métodos que "todo el mundo sabe que están en Anderson" NO están en Anderson.**
Verificado con grep sobre las 52,097 + 46,951 líneas de los dos libros: **Thwaites** (0 coincidencias,
ni la integral ni la tabla λ/l/H ni el criterio −0.09) · **Weissinger** (0) · **método e^N** (0) ·
**el polinomio de espesor NACA de 4 dígitos** (0 — la única coincidencia de `0.2969` es una fila de
una tabla de flujo compresible). Y **A §18.6 no es un método integral**: se titula literalmente
*"Boundary Layers over Arbitrary Bodies: **Finite-Difference Solution**"*. Una máquina lineal cita la
fuente equivocada y el pliego hereda una mentira. **Lo que se importe de White, Cebeci-Bradshaw o
Abbott & von Doenhoff hay que DECLARARLO como extensión** — exactamente la regla que dejó Kazmer.

---

**⭐8 · En aviones eléctricos las fracciones se SUMAN, no se multiplican.**
§20.11, literal: *"The total required aircraft Battery Mass Fraction (BMF) is then found as the
**sum (not product)** of the various mission segment Battery Mass Fractions."* Contra el
`W_f/W₀ = 1.06·(1 − Π(W_i/W_{i−1}))` del cap 3. La razón es física y el autor la explica:
*"there is **no range benefit from the burn off of 'fuel'** ... drag stays the same"*, y por eso
*"**the logarithmic operation resulting from integration over the weight change isn't included**"*.
Reusar el motor de misión térmico para un eléctrico **compila, corre, y miente**. El propio autor lo
prohíbe: *"**methods developed for fuel-burning aircraft should not be applied to electric
aircraft.**"*

---

**⭐9 · Un óptimo correcto tiene RESTRICCIONES ACTIVAS. Si todas están holgadas, el optimizador miente.**
Raymer cita a Kuhn-Tucker (1950): *"at the optimum the only direction you can move to improve the
objective function is one that will **violate one or more constraints**"*, y añade que esto
*"long predate[s] Kuhn-Tucker"* en la práctica aeronáutica. Y luego lo **demuestra con números**: en
la tabla MVO del DR-3 (verificada verbatim), el óptimo tiene **tres restricciones prácticamente
activas** — `Ps@n=5 = 1.7`, `Ps@n=1 = 0.1`, `Accel = 49.4` contra 50 requeridos. Ese es el test de
aceptación real de un optimizador restringido: **no basta con reproducir el peso; hay que reproducir
CUÁLES restricciones muerden.** Y el caso del DR-1 va más lejos: el autor **inventa una restricción a
mitad del ejercicio** (*"we need some requirement based on maneuvering"*) porque el espacio no estaba
acotado. **Las restricciones no vienen dadas: se descubren diseñando.**

---

**⭐10 · La regla anti-fraude de los trade studies: densidad interna constante.**
§19.5.2, el problema que nadie modela: *"If asked to study the impact of carrying two more internal
missiles, the designer might find a way to 'stuff them in' without changing the external lines.
**If there were sufficient room in the baseline to fit two more missiles internally, then the baseline
was poorly designed. If the baseline was already 'tight,' then the revised layout must be a fake!**"*
Y la regla ejecutable: *"insist that all redesigned layouts ... **maintain the same internal density
as the baseline, calculated as takeoff weight divided by internal volume**."* Esto es implementable
**hoy** con nuestro kernel B-Rep —`W₀ / volumen_medido` contra el baseline, como gate automático de
todo trade study— y es precisamente **lo que una hoja de cálculo no puede hacer y un CAD sí**.
Es la mejor oportunidad de diferenciación del pliego entero.

---

### Menciones honoríficas (no entraron a los 10, pero muerden igual)

- **El libro se equivoca.** Se detectaron ~12 erratas numéricas verificables en Anderson y Bertin
  (ρ₂/ρ₁ a M=10, μ no monótona en dos tablas de atmósfera, exponentes corridos, `0.644` por `0.664`).
  **Copiar del libro no basta: cada fixture necesita cita Y chequeo de plausibilidad física.**
- **`N_z = 1.5 × factor de carga LÍMITE.** *"the most common [mistake] being the use of limit load
  factor, where ultimate load factor N_z should be used instead"* — **y Raymer confiesa haberlo
  cometido en la primera edición de su propio libro.**
- **Cada grupo de peso usa un área DISTINTA:** el ala va con área **expuesta proyectada**, el fuselaje
  con área **MOJADA** (Tabla 15.2). Reusar una sola `S` es el bug silencioso perfecto.
- **La composición de fracciones de Mach se DIVIDE:** M 0.8→2.0 = 0.937/0.9805 = **0.956** (§6.3.9).
- **Interpolar perfiles por igual % de cuerda en vez de por igual PENDIENTE** produjo una piel hundida
  y mala adhesión en un caso real, y Raymer remata: *"It is conceivable that such a wing could **fail
  in flight** for this simple reason. Who said lofting is not important?"*
- **Pocos grados de libertad A PROPÓSITO:** *"A minimum number of control stations should be used to
  **avoid excessive 'wiggling'**."* Lo contrario del instinto de todo programador de CAD.
- **El caso correcto del DR-3 FALLA** el requisito de aceleración (42.2 s contra 30 s). Un test que
  lo reproduzca y le salga todo verde está mal.
- **Descartar un punto de control distinto en el vortex panel cambia la respuesta:**
  *"**Which control point do you ignore?** Different choices sometimes yield different numerical
  answers."* Hay que fijarlo y documentarlo, no dejarlo al azar del bucle.
