# Pliego: Moldflow + NAFEMS como CLIENTE

> **Ejercicio.** Los autores no son "referencias": son el cliente que nos dicta requisitos.
> Aquí el cliente es doble y es el más estratégico del proyecto:
>
> - **(a) Autodesk Moldflow** — el software comercial de simulación de moldeo que queremos igualar.
>   Nos dice *qué se resuelve, en qué orden, con qué modelos de material y qué expone su API*.
> - **(b) NAFEMS** — el organismo cuyos benchmarks son el estándar con el que la industria decide
>   si un solver es creíble. Nos dice *cómo se demuestra que un solver sirve*.
>
> Hoy La Forja valida contra los ejemplos resueltos del libro de Kazmer. Eso prueba que
> **copiamos bien un libro**. No prueba que el solver sea correcto ante un tercero.
> Este pliego es el puente entre esas dos cosas.

**Fuentes (literales, en `docs/forja-research/manuales/`):**

| Código | Documento | Qué aporta |
|---|---|---|
| `P2_42` | *Autodesk Moldflow Insight 2021 — Validation Report of Solver API Extensions* | El contrato del solver comercial: modelos de material, fases del proceso, ganchos de la API |
| `P2_35` | *Benchmarks Guide — The Standard NAFEMS Benchmarks: Linear Elastic Tests* (ESRD/StressCheck, 2018; referencias de *The Standard NAFEMS Benchmarks*, Rev. 3, oct. 1990) | 9 benchmarks con geometría, condiciones de frontera y **valor de referencia**, más la doctrina de validación |
| `P2_40` | *Autodesk University MFG124427 — Nonlinear Simulation in Fusion 360* (Fiedler & Taylor) | Reglas prescriptivas de cuándo un modelo lineal deja de aplicar, y juicio humano de analista |

**Honestidad sobre el alcance de las fuentes.** `P2_42` es un *reporte de validación de las extensiones
de la Solver API*, no el manual teórico completo de Moldflow. Por eso este pliego marca explícitamente
qué está **literal en el documento** y qué es **inferencia declarada**. Donde el documento no dice, aquí
dice "el documento no lo cubre" — no se inventa. En particular: **`P2_42` nunca menciona las mallas
midplane ni Dual Domain**; sólo habla del *3D Flow solver*. Ver §1.2.

---

# 1. EL PROCESO DEL SOLVER COMERCIAL (Moldflow)

## 1.1 Qué resuelve y en qué orden

`P2_42` no da un diagrama de flujo, pero el orden y el acoplamiento **se deducen de frases literales**
que se repiten en las cuatro secciones del reporte. Reconstruido:

```
                MATERIAL (Cross-WLF + Tait pvT + solidificación)
                                  │
   ┌──────────────────────────────▼──────────────────────────────┐
   │  FLOW  (llenado)                                            │
   │    fase 1: CONTROL POR VELOCIDAD  → SolverUserHb3dFlowRate  │
   │    ─── V/P SWITCHOVER ──────────  → SolverUserHb3dSwitchOver│
   │    fase 2: CONTROL POR PRESIÓN    → SolverUserHb3dPressure  │
   │    fase 3: PACK / HOLDING                                   │
   │    (paso de tiempo)               → SolverUserHb3dTimeIncrement
   └──────────────────────────────┬──────────────────────────────┘
                                  │ campos: T, p, v, γ̇, orientación de fibra,
                                  │ cristalinidad, degradación
                                  ▼
                              WARP (alabeo)
```

Literales que lo sustentan:

- *"The injection conditions, including **filling control, velocity-pressure switchover and
  pack/holding control** are set in the Molding Process Setup->Process Setting"* → las tres fases del
  llenado son objetos de primera clase del setup, no detalles internos.
- *"The function for user control of injection flow rate is called **during the velocity control
  phase** of injection"* / *"The user function for injection pressure control is called **during the
  pressure control phase**"* → el llenado está partido en dos regímenes de control distintos con
  un evento discreto entre ellos.
- *"This API is applicable only to the **Flow solver**, although it may also influence **Warp** results
  to the extent that the modified viscosity influences the flow results."* — repetido cuatro veces en
  el documento, con variaciones. → **Flow → Warp es un acoplamiento unidireccional y explícito.**
  Warp no retroalimenta a Flow. ⭐
- Enfriamiento: `P2_42` **no** lo trata como solver aparte (es un reporte de la API de flujo), pero
  la *cooling rate* aparece listada como una de las condiciones disponibles para el control de
  inyección: *"which depends on additional conditions, such as injection time, percentage volume
  filled, ram position, injection pressure, clamp force, **cooling rate** and models of injection
  molding machine response."*

**Requisito que sale de aquí para La Forja:** el orden canónico **llenado → empaque → enfriamiento →
alabeo** debe existir como una *cadena de campos*, no como cuatro reportes sueltos. Hoy tenemos
`filling.ts` (llenado 1D), `mold-thermal-fdm.ts` (térmico) y `fea.ts` (mecánico) sin ningún campo
compartido entre ellos. El alabeo no existe.

## 1.2 Qué malla usa

**Lo que el documento dice, literal:**

- Todo el reporte habla del **"3D Flow solver"** / **"3D flow analysis"**. Todas las rutinas llevan el
  prefijo `SolverUserHb3d…`.
- Los datos del usuario viven **por NODO**: `Order ID of the current node`, `SolverUtilityHb3dGetUserNodeField`,
  `SolverUserHb3dUserNodeFieldsInitialize`.
- ⭐ **Junto al node ID viaja SIEMPRE un `Laminate ID`.** Aparece en las seis rutinas de user node
  fields y en `SolverUserHb3dViscosityAtLaminateOfNode`. Es decir: aun en el solver "3D", los nodos
  están **organizados por capa a través del espesor** (laminados). El solver 3D no es un campo
  desestructurado plano; conserva la noción de "estoy en la capa k del espesor". Esto es una pista
  fuerte de que el 3D de Moldflow arrastra la herencia laminada Hele-Shaw en su estructura de datos.
- Existen resoluciones de viscosidad a cuatro granularidades distintas, y eso te dice qué entidades
  reconoce la malla: `SolverUserHb3dViscosity` (punto), `…AtNode`, `…AtLaminateOfNode`, `…AtElement`.

**Lo que el documento NO dice:** midplane, Dual Domain, tetraedros vs. prismas, número de capas por
espesor, criterios de aspect ratio, tolerancia de match de Dual Domain. **Nada de eso está en `P2_42`.**
Si se quiere ese contrato hay que conseguir el *Moldflow Insight Help / Meshing* — este pliego no lo
inventa.

## 1.3 Qué modelos de material EXIGE

Estos sí están **literales y completos** en `P2_42`. Son el contrato de material del cliente.

### Viscosidad — Cross-WLF (el default de termoplásticos)

```
              η₀
η = ────────────────────
     1 + (η₀·γ̇ / τ*)^(1−n)

η₀ = D₁ · exp( − A₁(T − T*) / (A₂ + (T − T*)) )

T* = D₂ + D₃·p           A₂ = Ã₂ + D₃·p
```

- `η` viscosidad del fundido [Pa·s]; `η₀` viscosidad a cizalla cero (límite newtoniano);
  `γ̇` rapidez de corte [1/s]; `τ*` esfuerzo crítico de transición a shear-thinning (ajustado por
  curva); `n` índice de ley de potencia en régimen de alta cizalla (ajustado por curva).
- `T` en **K**; `T*` temperatura de transición vítrea; `p` presión [Pa]; `D₁, D₂, D₃, A₁, Ã₂` coeficientes
  ajustados a datos.
- ⭐ Nótese que `D₃` aparece **dos veces**: corrige `T*` y corrige `A₂`. La dependencia con la presión
  no es un factor multiplicativo pegado al final — está metida dentro de la exponencial WLF en dos
  lugares. Un implementador apurado sólo mete uno.
- **Valores concretos que el documento usa como ejemplo** (sirven de caso de prueba):
  `n = 0.2817`, `τ* = 120200`, `D₁ = 1.4e15`, `D₂ = 361.15`, `D₃ = 0`, `A₁ = 37.592`, `Ã₂ = 57.3`.

**Brecha directa:** nuestro `filling.ts` usa **ley de potencia pura** (`μ = k·γ̇^(n−1)`, con
`ABS_MG47 = { k: 17070, n: 0.348 }`). Eso es el término de alta cizalla de Cross-WLF **sin** el plateau
newtoniano, **sin** dependencia con T y **sin** dependencia con p. Es la Eq. 5.20-5.22 de Kazmer y es
correcta para lo que hace, pero **no es el modelo que exige el cliente**.

### pvT — Tait (2 dominios: fundido y sólido)

`P2_42` no escribe la ecuación de Tait, pero **sí especifica el orden exacto de los coeficientes que
la API espera**, y eso revela la estructura del modelo:

```
b5, b1m, b2m, b3m, b4m, b1s, b2s, b3s, b4s
```

⭐ Léelo con cuidado: **`b5` es único y compartido; los demás vienen en pares `…m` (melt) y `…s`
(solid)**. Tait de dos dominios con una temperatura de transición común. Cuatro coeficientes por
dominio, uno global. Ese solo renglón te da el esqueleto del modelo sin la ecuación.

### Cinética de cristalización — Nakamura (extensión no isotérmica de Avrami)

```
dθ/dt = n·K(T)·(1 − θ)·[−ln(1 − θ)]^((n−1)/n)

K(T) = K₀ · exp( −U*/(R_g(T − T∞)) ) · exp( −K_g / ((T + 273.15)(T_m − T)) )
```

con `θ = X(T)/X∞` (cristalinidad relativa), `T` en **°C**, `T∞` ligada a la Tg, `K_g` constante
cinética de nucleación, `T_m` punto de fusión en equilibrio [°C].

⭐ **La reformulación numérica es el detalle que vale.** El documento dice literalmente: haz
`Y = ln(1/(1−θ))`, *"which desirably eliminates the possibility for θ to be greater than 1 in solving
the differential equation"*. La EDO se vuelve:

```
dY/dt = n·K(T)·Y^((n−1)/n)
```

Ese cambio de variable no es cosmético: **hace imposible por construcción que la integración salga del
dominio físico.** Es exactamente la clase de truco que uno reimplementa mal si sólo copia la primera
ecuación. Y encaja con `…CheckAndFix`, que existe para acotar el campo.

Acoplamiento cristalinidad → viscosidad:

```
η_efectiva = η(T, γ̇) / lViscFactor
lViscFactor = 1.0 − Crystallinity / CrystallinitySolidificationValue
Crystallinity = (1 − e^(−Y)) − (1 − e^(−Y_germ))
```

⭐ Fíjate en el signo: se **DIVIDE** por un factor que **baja** hacia 0 conforme cristaliza. O sea la
viscosidad **explota** al acercarse a `CrystallinitySolidificationValue`. Así se modela la
solidificación: no con un `if T < Tf then sólido`, sino con una singularidad de viscosidad.
Y el `Y_germ` (valor de germinación pequeño) existe para que `Y` no arranque en 0 y la potencia
`Y^((n−1)/n)` no reviente. Detalle de implementación puro.

La cristalinidad además afecta **el volumen específico** (`SolverUserHb3dSpecificVolume`) y **la
solidificación** (`SolverUserHb3dSolidification`), no sólo la viscosidad.

### Degradación térmica — Arrhenius de primer orden

```
dα/dt = k(T)·f(α)        k(T) = A·exp(−E_a/RT)
```

El documento trae la **tabla completa de 13 modelos de reacción** `f(α)`/`g(α)` (ICTAC): leyes de
potencia P4/P3/P2/P2/3, difusión D1/D2/D3, Mampel F1, Avrami–Erofeev A2/A3/A4, esfera contrayente R3,
cilindro contrayente R2. El ejemplo usa **F1 (Mampel, primer orden)**: `dα/dt = A(1−α)·e^(−E_a/RT)`.

Efecto en viscosidad: `η(T,γ̇) · e^(TGViscCoeef·α)` — aquí **multiplica** y **sube** (la degradación
espesa). Parámetros del ejemplo: `E_a = 160 kJ/mol`, `K = 8.8e15`, `R = 8.31`, `TGViscCoeef = 0`.

⭐ Resultado visual esperado, literal del documento: *"For a square plate the API would predict final
thermal degradation showing **"burn marks" near injectors**"*. Es decir: la degradación no es un número
de reporte, es un **mapa** cuyo patrón (quemaduras junto a los inyectores) es el criterio cualitativo
de que la implementación quedó bien.

### Orientación de fibra — Folgar-Tucker

```
∂A/∂t + v·∇A = Ȧ = Ȧ_kinetic + Ȧ_diffusion

Ȧ_kinetic   = (W·A − A·W) + ξ(D·A + A·D − 2𝔸:D)
Ȧ_diffusion = 2·C_I·γ̇·(I − 3A)

D = ½(L + Lᵀ)     W = ½(L − Lᵀ)     γ̇ = √(2·D_ij·D_ji)
ξ = ((L/D)² − 1)/((L/D)² + 1)
```

Cierre híbrido de cuarto orden: `𝔸 = (1−f)·𝔸_linear + f·𝔸_quad`, con `𝔸_quad,ijkl = A_ij·A_kl`,
`𝔸_linear` la expresión de Advani-Tucker con los coeficientes −1/35 y 1/7, y

```
f = 1 − 27·det(A)
```

⭐ **`f = 1 − 27·det(A)` es un medidor de alineación disfrazado de peso de mezcla.** Para orientación
isotrópica `A = I/3` → `det = 1/27` → `f = 0` → cierre puramente lineal. Para orientación
perfectamente alineada `det = 0` → `f = 1` → cierre puramente cuadrático. El cierre **cambia de
naturaleza según qué tan orientadas están las fibras**, automáticamente. Esa es la idea, y se pierde
si sólo copias la fórmula.

Estructura del tensor: 9 componentes → **5 independientes** por simetría `a_ij = a_ji` y normalización
`a₁₁ + a₂₂ + a₃₃ = 1`. La API expone exactamente esos cinco: `A_xx, A_yy, A_xy, A_xz, A_yz`.
Ejes: plano de flujo 1-2 (X-Y), eje 3 (Z) en el espesor. Nota del documento: *"`a₁₁` contains most of
the quantitative information about the microstructure and is most sensitive to flow, processing and
material changes"* → **si vas a validar orientación de fibra, `a₁₁` es el target extraction.**

Valor del coeficiente de interacción usado en el caso de estudio: `C_I = 0.001`.

### Herschel-Bulkley-WLF (termoestables con esfuerzo de fluencia)

```
η = τ_y/γ̇ + K·γ̇^(n−1)          τ_y = τ_y0 · e^(T_y/T)
K = K₀ · exp( −C_a(T − T_g) / (C_b + (T − T_g)) )
K₀ = K₀₀ · ( α_g / (α_g − α) )^(C₁ + C₂·α)
```

`α` = grado de curado (0–1), `α_g` = grado de curado al que solidifica.
Aplicable a **Reactive Molding, Microchip Encapsulation, Underfill Encapsulation**.

⭐ Dos notas explícitas del documento que son reglas duras:
- *"`α` should be less than `α_g`"* — si no, `K₀` diverge. Es una precondición, no una recomendación.
- *"If using the Herschel-Bulkley-WLF viscosity model for a **thermoplastic** material with yield stress
  behaviour, the values of `α` and `α_g` can be set to **0 and 1** respectively."* — el modelo de
  termoestable se degrada a modelo de termoplástico con fluencia neutralizando el término de curado.
  Truco de reuso que el cliente documenta.

## 1.4 La API: entradas y salidas

**Mecánica de integración (literal):**

- API **estilo C**. Dos clases de funciones: **user routines** (las escribes tú) y **utility functions**
  (las llamas tú para pedirle datos al solver).
- Se compilan en un **DLL** que va en el directorio `bin` de la instalación de AMI.
- Se activa con un checkbox **"Enable Solver API"** en los solver parameters del análisis 3D de flujo,
  más un selector por modelo.
- ⭐ **Regla de contrato parcial, literal:** *"It is only necessary that the user-compiled DLL contains
  user functions for the user models **which are switched on** in the solver parameters."* y
  *"if the options for both user-coded Fiber orientation and another model such as user-coded PVT are
  selected, then the compiled DLL **must contain user routines for both**"*. Es decir: el binding es
  **por slot encendido**, no por DLL completo. Rutinas presentes pero apagadas se **ignoran**
  silenciosamente. Esa asimetría es una fuente clásica de "compila y no hace nada".

**Slots de modelo enchufables** (los que el documento enumera):
`Viscosity` · `PVT` · `Solidification` · `Core-shift` · `Fiber orientation` ·
`Injection and time step control` · `User node fields`.

**Ciclo de vida de un campo de usuario (user node field)** — este es el contrato más reutilizable de todo
el documento, porque es un **integrador de EDO advectada genérico**:

| Rutina | Entra | Sale | Rol |
|---|---|---|---|
| `…UserNodeFieldsDimensions` | — | `int` | Cuántas variables por nodo. Si no la das, se asume 0 |
| `…UserNodeFieldsInitialize` | `X*`, nodeID, laminateID | escribe `X` | Condición inicial por nodo |
| `…UserNodeFieldsNumberOfSubSteps` | — | `int` | Sub-pasos por paso de tiempo del solver |
| `…UserNodeFieldsEvolution` | `X*`, nodeID, laminateID | escribe `dXdt` | El lado derecho de la EDO |
| `…UserNodeFieldsAreValid` | `X*`, nodeID, laminateID | `bool` | ⭐ Juez de admisibilidad física |
| `…UserNodeFieldsCheckAndFix` | `X*`, nodeID, laminateID | corrige `X` | Proyección al dominio válido |

⭐⭐ **El detalle que vale oro, literal:** sobre `…AreValid` —
*"If the values are determined to be invalid, **the present solution is discarded, and smaller sub steps
are attempted** in order to maintain solution stability."*

Es decir: **la estrategia de control de paso del solver comercial es delegable al usuario, y su
criterio no es un residual numérico sino la ADMISIBILIDAD FÍSICA del campo.** El solver no pregunta
"¿convergió?", pregunta "¿esto tiene sentido físico?" y si no, retrocede y reintenta más fino. Y hay
DOS niveles: `AreValid` (rechazar y reintentar) y `CheckAndFix` (aceptar pero proyectar). Un
implementador ingenuo hace sólo lo segundo (clampear) y se queda sin el mecanismo de control de paso.

Esto es directamente transferible a nuestro FDM térmico y a cualquier integrador nuestro.

**Control de inyección y paso de tiempo** — firmas (argumentos literales del documento):

| Rutina | Se llama | Argumentos que recibe | Devuelve |
|---|---|---|---|
| `SolverUserHb3dFlowRate` | fase de velocidad | tiempo actual; volumen desplazado por el husillo o volumen llenado; presión de inyección actual; tiempo del paso anterior; caudal del paso anterior | caudal volumétrico **en la punta del husillo** |
| `SolverUserHb3dPressure` | fase de presión | tiempo actual; tiempo en el switchover; presión en el switchover; tiempo del paso anterior; presión del paso anterior | presión de inyección de la máquina |
| `SolverUserHb3dSwitchOver` | fase de velocidad | **% de volumen llenado; posición del husillo; presión de inyección; fuerza de cierre; tiempo de inyección** | ¿hacer switchover? |
| `SolverUserHb3dTimeIncrement` | cada paso | incremento máximo permitido; tiempo actual; volumen desplazado/llenado | tamaño del siguiente paso |

⭐ **Los argumentos de `SwitchOver` son la lista completa y autorizada de criterios de switchover que
un solver serio debe soportar:** volumen, posición, presión, **fuerza de cierre** y tiempo. Nuestro
`clampForceN` (Eq 5.29 de Kazmer) hoy es un número de reporte al final; en el cliente es una
**variable de control en vivo durante el llenado**.

**Caso de estudio del documento — el lag de la máquina.** El perfil de caudal real no es el
programado. El ejemplo lo modela con un promediado de un paso:

```
Q' = ½·(Q_previous + Q_current)
```

⭐ El punto no es la fórmula (es un filtro de primer orden trivial). El punto es la **tesis**:
*"in real practice the flow rate profile achieved by the molding machine **may not be the same as the
preset profile**"* — por límites de caudal, límites de tasa de variación del caudal, o porque la
máquina no responde instantáneamente. **El setpoint no es el proceso.** Un simulador que asume que la
máquina hace exactamente lo que se le pidió es un simulador de la hoja de proceso, no del taller.
Para talleres LATAM con máquinas viejas esto no es un detalle académico: es *la* diferencia.

**Salidas / plots.** Resultados definidos por el usuario vía
`SolverUserHb3dNumberOfUserNodalPlots`, `…UserNodalPlotOutputStagesOption`,
`…UserNodalPlotOutputDomainOption`, `…UserPlotResultAtNode`. Se vuelven visibles con "New Plot" y son
resultados **no-default** (hay que pedirlos).

---

# 2. CRITERIOS DE VALIDACIÓN — el corazón del pliego

## 2.1 La doctrina, literal (`P2_35`)

Esta es la parte más valiosa del ejercicio completo. **No es "corre el caso y compara".** Es un
protocolo con separación de errores y anti-trampas.

### 2.1.1 Nombra el "target extraction" ANTES de resolver

Cada benchmark define **un escalar en un punto**, nombrado de antemano:
"la tensión tangencial de borde en el punto D", "el desplazamiento radial en el punto A".

⭐ **Nunca es "el máximo del modelo".** El máximo migra con la malla, y si hay una singularidad
(esquina reentrante, carga puntual) el máximo **diverge** al refinar: cuanto mejor mallas, peor te va.
Un gate contra "el máximo" es un gate que castiga el refinamiento. Todos nuestros gates FEA actuales
comparan contra `maxVonMises` y `maxDisplacement`. Eso hay que cambiarlo.

### 2.1.2 Malla mínima vs. malla densa

Definiciones literales:

- **"Minimum Mesh"**: *"the least-refined mesh required to achieve numerical convergence **within 1%
  of the target extraction**"*. Se construye con el número **mínimo** de elementos que llenan el
  dominio, y luego se sube el DOF **sobre esa malla fija** por p-extension. Si no converge dentro de
  1%, se refina la malla. Nota del documento: *"in most cases only **one iteration** of mesh refinement
  was needed."*
- **"Dense Mesh"**: *"an **overly-refined** mesh relative to the Minimum Mesh to demonstrate that adding
  more elements produced **insignificant changes** in the target extraction."*

⭐ La malla densa **no existe para dar un mejor resultado**. Existe para **probar que la malla mínima
ya bastaba**. Es un control negativo, no una mejora. Reportar sólo la malla densa es reportar menos
información, no más.

### 2.1.3 ⭐⭐ La convergencia se demuestra SIN mirar la respuesta

Literal, y es la regla más importante del documento entero:

> *"Numerical convergence was evaluated **independently of the NAFEMS reference solutions**, hence
> StressCheck results for each fixed mesh included **graphical convergence evidence** to automatically
> quantify the discretization error in the target extraction."*

Traducción operativa: **primero pruebas que TU número dejó de moverse; después lo comparas con el de
NAFEMS.** Si usas la respuesta de NAFEMS para decidir cuándo parar de refinar, no validaste nada —
ajustaste hacia el número. Son dos preguntas distintas y en ese orden:

1. **¿Convergí?** — mide tu propio error de discretización. Criterio: **< 1%**.
2. **¿Convergí a lo correcto?** — compara contra la referencia. Criterio: **< 3%**.

Y son **tolerancias distintas y no intercambiables**. Un solver puede converger perfectamente (1%)
a un número equivocado (15% fuera): eso es un bug de formulación, y el protocolo lo distingue de
"malla pobre". Con un solo número no puedes distinguirlos.

### 2.1.4 ⭐⭐ Reporta la corrida real, nunca el límite extrapolado

Literal:

> *"Converged StressCheck results **for the solution with highest DOF** are extracted from each graph
> and reported... Note: **the estimated limit in each graph is for reference only and should not be
> reported for the target extraction**."*

En las gráficas de convergencia el software estima un límite por extrapolación (para LE1 malla mínima
tri: `Est.Limit = 92.87` con 0.03% de error estimado). **Ese número está prohibido como resultado.**
Se reporta el valor de la corrida de más DOF que realmente se resolvió. Es una regla anti-trampa
explícita: la extrapolación de Richardson te acerca a la respuesta sin que tu solver haya hecho el
trabajo.

### 2.1.5 Los dos veredictos finales del reporte

- *"the discretization error was reported to be **< 1%** for all StressCheck results in **all** benchmark
  models."*
- *"the StressCheck results and the NAFEMS reference benchmark solutions differed by **< 3%** for **all**
  benchmarks."*

Ese es el listón. **1% contra ti mismo, 3% contra el mundo, en TODOS los casos** — no en promedio,
no en la mayoría.

## 2.2 ⭐ Lo que enseñan las gráficas de convergencia de LE1 (datos crudos)

El PDF trae las tablas DOF-vs-resultado. Vale la pena leerlas porque desmienten dos intuiciones:

**LE1, malla mínima de triángulos (6 elementos), p-extension:**

| Run | DOF | σ_y [MPa] |
|---|---|---|
| 1 | 12 | 39.46 |
| 2 | 36 | 75.66 |
| 3 | 72 | 89.51 |
| 4 | 120 | 91.94 |
| 5 | 180 | 92.66 |
| 6 | 252 | 92.96 |
| 7 | 336 | 92.96 |
| 8 | 432 | 92.84 |

**LE1, malla densa de triángulos (216 elementos), p-extension:**

| Run | DOF | σ_y [MPa] |
|---|---|---|
| 1 | 252 | 84.18 |
| 2 | 936 | 93.17 |
| 3 | 2052 | 92.86 |
| 4 | 3600 | 92.70 |
| 5 | 5580 | 92.67 |
| 6 | 7992 | 92.66 |
| 7 | 10836 | 92.66 |
| 8 | 14112 | 92.66 |

Tres lecciones que una máquina lineal no saca:

1. ⭐ **Más elementos puede ser PEOR.** La malla densa con 252 DOF da **84.18 MPa** (−9%). La malla
   mínima con 180 DOF ya iba en **92.66 MPa** (−0.04%). Con **menos DOF** y **36× menos elementos**.
   Refinar `h` con orden `p` bajo pierde contra subir `p` sobre pocos elementos. El instinto de
   "métele más malla" está mal calibrado.
2. ⭐ **La convergencia no es monótona.** 92.96 → 92.96 → 92.84. Un criterio de paro tipo
   "|Δ| < ε entre dos corridas consecutivas" te habría detenido en el run 7 creyendo haber convergido
   a 92.96, y el 8 se mueve. Hay que ver la **tendencia completa**, no el último delta.
3. ⭐ **Las dos mallas convergen a límites DISTINTOS**: 92.75 (mínima) vs 92.66 (densa), ~0.1% aparte.
   "Convergido" no es un punto, es una **banda**. Reportar 6 cifras significativas de un resultado
   convergido es mentir sobre la precisión.

## 2.3 ⭐⭐ Las NOTAS por benchmark — donde vive la sabiduría

El PDF pone una nota al pie en cinco benchmarks. Cada una es una lección sobre validación que ningún
resumen automático conserva. **Estas notas valen más que las tablas.**

### LE3 — un benchmark matemáticamente inadmisible que sigue siendo válido

> *"**Point loads are inadmissible input data for hierarchic shell models** because the strain energy
> associated with a point load is not finite and therefore the corresponding displacements cannot be
> finite. However when point loads are used for computing displacements (as in this benchmark problem)
> **the divergence in the data of interest is extremely slow** and the reported results compare well
> with the reference solution."*

⭐⭐ Lección: **la admisibilidad se juzga por CANTIDAD EXTRAÍDA, no por el modelo.** El mismo problema
es inválido para energía o esfuerzo, y perfectamente usable para desplazamiento. Un solver que
"rechaza cargas puntuales en shells" por corrección teórica reprueba un benchmark estándar. La
corrección numérica sin contexto de qué se está midiendo es un estorbo.

### LE5 — se permite otra familia de elemento, declarándola

> *"Hexas/tetras were used for this benchmark as **StressCheck does not implement slope-discontinuous
> shells**."*

⭐ El enunciado NAFEMS asume shells. StressCheck no los tiene con quiebre de pendiente, así que
resolvió con sólidos y **lo declaró**. Y pagó: 1.2–1.7% de error, el más alto de los sólidos.
**Puedes cambiar de formulación; lo que no puedes es callártelo.** Esto abre la puerta para que La
Forja (que sólo tiene sólidos Tet4) intente benchmarks escritos para shells — declarando la
sustitución y el costo.

### LE6 — un error irreducible que NO es un bug

> *"There are **multiple corner singularities** in the problem description that required **graded meshing
> techniques** for convergence. This benchmark problem was solved using a **3D thin-solid formulation
> which may be different from the plate model** from which the analytical solution was obtained."*

⭐⭐ El 2.2–2.9% residual de LE6 **no es error de solver: es diferencia de MODELO**. La referencia sale
de teoría de placas; la solución sale de elasticidad 3D. Son dos problemas matemáticos distintos que
casi coinciden. Perseguir ese 2.5% refinando la malla es perseguir un fantasma — y es exactamente lo
que hace un pipeline automático que sólo ve "error > tolerancia, refina". Hay que saber **cuándo
dejar de refinar y escribir una nota**.

Segundo detalle: **singularidades de esquina exigen malla graduada**. No refinamiento uniforme —
graduada hacia las esquinas. Nuestro voxelizador tiene `resolution` **global**: no puede.

### LE7 y LE8 — teoría de shell vs. sólidos axisimétricos

> *"Axisymmetric shell theory was used in the original NAFEMS benchmark test. In StressCheck,
> **axisymmetric solids** were used to represent the model."*

Costo declarado: −2.3% (LE7) y −2.8% (LE8). Los dos peores resultados del reporte, y por la misma
causa estructural. ⭐ Nótese que **ambos errores son del mismo signo** (subestiman): eso es firma de
sesgo de modelo, no de ruido numérico. Cuando todos tus errores apuntan al mismo lado, no tienes un
problema de precisión, tienes un problema de formulación.

### LE10 — el enunciado del benchmark NO es admisible y hay que renegociarlo

> *"**Since constraints along a line are incompatible with 3D-elasticity**, the StressCheck results were
> obtained by fixing the z-displacement of the face BCB'C'."*

⭐⭐ El enunciado NAFEMS dice "Z-displacement fixed along mid-plane of face BCB'C'" — una restricción
sobre una **línea**. En elasticidad 3D una restricción sobre un conjunto de medida cero es
inadmisible (misma patología que la carga puntual de LE3). StressCheck **cambió el enunciado**
(fijó la cara completa) y lo declaró.

**El benchmark se negocia y se documenta.** No es un contrato ejecutable literal. Cualquiera que
implemente LE10 "tal cual dice el papel" o bien no puede, o bien produce basura.

## 2.4 Catálogo de benchmarks implementables

Los 9 benchmarks de `P2_35`, con geometría completa, condiciones de frontera y **valor de referencia**.
Todos: análisis **lineal elástico**. Todo lo de abajo está literal en el PDF (la geometría se leyó de
las figuras, que son imágenes rasterizadas).

### Tabla resumen

| ID | Problema | Target extraction | **Referencia NAFEMS** | ¿La Forja puede hoy? |
|---|---|---|---|---|
| **LE1** | Membrana elíptica, esfuerzo plano | σ_y tangencial de borde en D | **92.7 MPa** | ❌ sin 2D, sin simetría, frontera curva |
| **LE2** | Patch test de flexión de cascarón cilíndrico | σ tangencial superficie exterior | **60 MPa** | ❌ sin shells |
| **LE3** | Cascarón hemisférico con cargas puntuales | desplazamiento radial en A | **185 mm** | ❌ sin shells, sin carga nodal |
| **LE5** | Cantilever sección Z, torsión | σ axial en X=2.5, midsurface (punto A) | **−108 MPa** | ⚠️ **casi** — ver §5.3 |
| **LE6** | Placa oblicua, presión normal | σ₁ máx. superficie inferior en E | **0.802 MPa** | ❌ restricción sobre aristas, muy delgada |
| **LE7** | Cilindro/esfera axisimétrico, presión | σ axial superficie exterior en D | **25.86 MPa** | ❌ sin axisimétrico |
| **LE8** | Cascarón axisimétrico, presión | σ hoop superficie exterior en D | **94.55 MPa** | ❌ sin axisimétrico |
| **LE10** | Placa gruesa, presión | σ_yy en D | **−5.38 MPa** | ❌ simetría + frontera elíptica |
| **LE11** | Cilindro/cono/esfera sólido, carga térmica | σ_yy en A | **−105 MPa** | ❌ sin carga térmica, simetría, curvas |

### Fichas completas

---

#### **LE1 — Plane Stress: Elliptic Membrane** → **92.7 MPa**

- **Geometría** (cuarto de anillo elíptico, plano XY, espesor `T = 0.1 m`):
  - Elipse **interior** (arco AD): `(x/2)² + y² = 1` → semiejes 2.0 y 1.0
  - Elipse **exterior** (arco BC): `(x/3.25)² + (y/2.75)² = 1` → semiejes 3.25 y 2.75
  - Vértices: `A = (0, 1.0)`, `B = (0, 2.75)`, `D = (2.0, 0)`, `C = (3.25, 0)`
  - Cotas de verificación en la figura: AB = 1.75 m, OD = 2.0 m, DC = 1.25 m, OA = 1.0 m
- **Material**: `E = 210 GPa`, `ν = 0.3`. **Esfuerzo plano.**
- **BCs**: simetría a lo largo de **AB** (x=0) y **DC** (y=0)
- **Carga**: presión **hacia afuera** uniforme de **10 MPa** en el borde exterior BC
- **Target**: tensión tangencial de borde (σ_y) en el punto **D**
- **Referencia**: **92.7 MPa**
- **StressCheck**: Quad 4 elem → 92.75 (0.05%) · 144 elem → 92.70 (0.00%) · Tri 6 elem → 92.84 (0.15%) · 216 elem → 92.66 (−0.04%)

---

#### **LE2 — Cylindrical Shell Bending Patch Test** → **60 MPa**

- **Geometría**: sector **Θ = 30°** de cascarón cilíndrico, `R = 1000 mm`, arista AB = **500 mm**
  (dirección axial), espesor **`T = 10 mm`**
- **Material**: `E = 210 GPa`, `ν = 0.3`
- **BCs**: **empotrado** (clamped) a lo largo de la arista **AB**; **simetría** en las aristas **AD** y **BC**
- **Carga**: momento flector uniforme de **1000 N·mm por unidad de longitud** a lo largo de la arista **DC**
- **Target**: esfuerzo tangencial en la **superficie exterior**
- **Referencia**: **60 MPa**
- **StressCheck**: Quad **1 elemento** → 59.81 (−0.3%) · 121 elem → 59.80 (−0.3%) · Tri 2 elem → 59.81 (−0.3%) · 200 elem → 59.82 (−0.3%)
- ⭐ Es un **patch test**: **1 solo elemento** debe dar la respuesta. Si tu elemento necesita malla para
  pasar esto, tu elemento está mal. Y nótese que el error es **−0.3% en las cuatro configuraciones**,
  idéntico: es sesgo determinista de formulación, no error de discretización.

---

#### **LE3 — Hemispherical Shell with Point Loads** → **185 mm**

- **Geometría**: sector de **90°** de cascarón hemisférico, `R = 10 m`, espesor **`T = 0.04 m`**
- **Material**: `E = 68.25 GPa`, `ν = 0.3`  ← **ojo, distinto de los demás**
- **BCs**: `Uz = 0` en el punto **E** (polo); simetría en las aristas **AE** y **CE**
- **Carga**: cargas **puntuales** `Fx = +2 kN` en **A**, `Fy = −2 kN` en **C**
- **Target**: **desplazamiento radial** en el punto **A**
- **Referencia**: **185 mm**
- **StressCheck**: Quad/Tri 16 elem → 184.3 mm (−0.4%) · 64 elem → 184.4 mm (−0.3%)
- ⭐ Ver §2.3: inadmisible en teoría, válido en la práctica **para desplazamiento**. Además: el
  desplazamiento de referencia (185 mm) es **1.85% del radio** — grande pero aún lineal.

---

#### **LE5 — Z-Section Cantilever** → **−108 MPa**  ⬅ **el candidato de La Forja**

- **Geometría**: cantilever de sección Z, **longitud 10 m** (eje X), espesor de pared **`T = 0.1 m`**.
  Sección transversal: alma horizontal de **2 m**, con un patín de **1 m hacia arriba** en un extremo
  y un patín de **1 m hacia abajo** en el otro (la Z). **Todas las caras son planas y ortogonales.**
- **Material**: `E = 210 GPa`, `ν = 0.3`
- **BCs**: **todos los desplazamientos fijos en X = 0** (cara completa empotrada)
- **Carga**: **torque de 1.2 MN·m** en X = 10, aplicado como **dos cargas cortantes uniformemente
  distribuidas de 0.6 MN, una en cada superficie de patín** (sentidos opuestos; brazo 2 m → 0.6 × 2 = 1.2 MN·m ✓)
- **Target**: **esfuerzo axial** en **X = 2.5 m** del empotramiento (punto **A**), en la **midsurface**
- **Referencia**: **−108 MPa**
- **StressCheck**: **Hexa** 20 elem → −109.8 (1.7%) · 78 elem → −109.5 (1.4%) · **Tetra** 136 elem → −109.3 (1.2%) · 1186 elem → −109.5 (1.4%)
- ⚠️ **Único dato que el PDF no desambigua del todo:** la posición **transversal** exacta del punto A
  dentro de la sección (la figura lo marca sobre la arista frontal del alma). Hay que fijarlo contra
  *The Standard NAFEMS Benchmarks* Rev. 3 antes de cerrar el gate. Está anotado como riesgo, no
  adivinado.

---

#### **LE6 — Skew Plate Under Normal Pressure** → **0.802 MPa**

- **Geometría**: placa romboidal (skew), lados de **1 m × 1 m**, ángulos internos **30°** (en A) y **150°**
  (en B), espesor **`T = 0.01 m`**. **E** = centro de la placa.
- **Material**: `E = 210 GPa`, `ν = 0.3`
- **BCs**: `Uz = 0` a lo largo de las **aristas** AB, BC, CD y AD; `Ux = Uy = 0` en **A** y `Uy = 0` en
  **B** para eliminar movimiento de cuerpo rígido
- **Carga**: presión uniforme de **−0.7 kPa** en dirección z vertical
- **Target**: **máximo esfuerzo principal (σ₁)** en la **superficie inferior**, en el punto **E**
- **Referencia**: **0.802 MPa**
- **StressCheck**: Quad 64 elem → 0.820 (2.2%) · 169 elem → 0.820 (2.2%) · Tri 128 elem → 0.826 (2.9%) · 254 elem → 0.822 (2.5%)
- ⭐ El peor acuerdo del reporte, y **explicado, no escondido** (ver §2.3). Relación de esbeltez 100:1.

---

#### **LE7 — Axisymmetric Cylinder/Sphere Under Pressure** → **25.86 MPa**

- **Geometría** (perfil axisimétrico R-Z, recipiente de pared delgada, `T = 0.025 m`):
  - Tapa esférica de A hasta B; pared cilíndrica recta de C hasta F
  - Altura de la tapa: **1.0 m**; longitud del cilindro: **1.5 m**; radio: **1.0 m**
  - Coordenadas dadas en tabla: `B = (R 0.9814, Z 1.692)`, `D = (R 1, Z 1.4034)`, `E = (R 1, Z 1.1136)`
- **Material**: `E = 210 GPa`, `ν = 0.3`
- **BCs**: `Ur = 0` en **A**; `Uz = 0` en **F**
- **Carga**: presión interna uniforme de **1.0 MPa**
- **Target**: **esfuerzo axial en la superficie exterior** en **D**, o sea en `R = 1.0125, Z = 1.4034`
- **Referencia**: **25.86 MPa**
- **StressCheck**: Quad 5 elem → 25.27 (−2.3%) · **605** elem → 25.27 (−2.3%) 
- ⭐ 5 elementos y 605 elementos dan **exactamente el mismo número**. El error es 100% de modelo
  (shell vs. sólido axisimétrico), 0% de malla. Refinar 121× no movió un dígito. **Ejemplo perfecto de
  cuándo refinar es tirar cómputo.**
- ⚠️ El target está en `R = 1.0125` = radio medio 1.0 + medio espesor 0.0125 → **superficie exterior**.
  Ese 0.0125 se pierde fácil.

---

#### **LE8 — Axisymmetric Shell Under Pressure** → **94.55 MPa**

- **Geometría** (perfil axisimétrico R-Z, `T = 0.01 m`): cilindro recto de A (`R = 0.25, Z = 0`) hacia
  arriba hasta B, altura **0.5 m**; luego un toro/nariz de **`R = 0.0625 m`** (arco B–C–D) que voltea el
  perfil; luego un arco de **`R = 0.25 m`** hasta E sobre el eje
- **Material**: `E = 210 GPa`, `ν = 0.3`
- **BCs**: `Uz = 0` en **A**; `Ur = 0` en **E**
- **Carga**: presión interna uniforme de **1.0 MPa**
- **Target**: **esfuerzo circunferencial (hoop)** en la **superficie exterior** en **D**, que está a
  **36° del centro del círculo** (del arco de R = 0.0625)
- **Referencia**: **94.55 MPa**
- **StressCheck**: Quad 12 elem → 91.93 (−2.8%) · 48 elem → 92.05 (−2.6%)

---

#### **LE10 — Thick Plate Under Pressure** → **−5.38 MPa**

- **Geometría**: **la misma planta elíptica de LE1**, extruida a un **espesor de 0.6 m** (placa gruesa).
  Caras superiores sin primo (A,B,C,D) e inferiores con primo (A',B',C',D').
  - Elipse interior `(x/2)² + y² = 1`, exterior `(x/3.25)² + (y/2.75)² = 1`; cotas 1.75 / 2.0 / 1.25 / 1.0 m
- **Material**: `E = 210 GPa`, `ν = 0.3`
- **BCs**: simetría en las caras **DCD'C'** y **ABA'B'**; `Ux = Uy = 0` en la cara **BCB'C'`**;
  desplazamiento Z fijo a lo largo del **plano medio** de la cara BCB'C'
- **Carga**: presión normal uniforme de **1.0 MPa** en la superficie **superior**
- **Target**: **esfuerzo directo σ_yy** en el punto **D**
- **Referencia**: **−5.38 MPa**
- **StressCheck**: Hexa 32 elem → −5.24 (−2.6%) · 60 elem → −5.25 (−2.4%)
- ⭐⭐ Ver §2.3: **el enunciado no es admisible en 3D** (restricción sobre línea). StressCheck fijó la
  **cara** BCB'C' completa en Z. Si implementas esto, implementas la versión renegociada y lo dices.

---

#### **LE11 — Solid Cylinder/Taper/Sphere, Temperature Loading** → **−105 MPa**

- **Geometría** (sólido de revolución, sector de **90°**; cotas de la figura):
  - Radios: **0.7071 m** y **0.2929 m** (nota: 0.7071 = √2/2, 0.2929 = 1 − √2/2 → la geometría sale de
    un chaflán a **45°** sobre radio 1) ⭐
  - Alturas apiladas: **0.400 / 0.345 / 0.345 / 0.700 m**
  - Radios de referencia: **1.0 m** y **1.4 m** desde el origen, con el **45°** marcado
  - Base: **1.0 m** + **0.4 m**; punto **A** en la base a `x = 1.0` (arranque del cono)
  - Vértices marcados B, C (exteriores) y D, E (interiores), con el sector de **90°** entre E y D
- **Material**: `E = 210 GPa`, `ν = 0.3`, **`α = 2.3e−4 /°C`** ← coeficiente de expansión térmica
- **BCs**: `Uz = 0` en el plano `Z = 0`; `Ux = 0` en el plano `X = 0`; `Uy = 0` en el plano `Y = 0`
  **y en la cara BCDE**
- **Carga**: **gradiente lineal de temperatura** en dirección radial y axial:
  ```
  Δθ = √(x² + z²) + y
  ```
- **Target**: **esfuerzo directo σ_y** en el punto **A**
- **Referencia**: **−105 MPa**
- **StressCheck**: Hexa 8 elem → −105.2 (0.19%) · 216 elem → −105.4 (0.38%) · **Tetra 317 elem → −105.5 (0.48%)** · 3531 elem → −105.4 (0.38%)
- ⭐⭐ **Es el ÚNICO benchmark donde los TETRAEDROS bajan de 0.5%.** Compárese con LE5 (tetra 1.2–1.4%).
  Razón: es un problema dominado por **deformación volumétrica** (expansión térmica restringida), no
  por **flexión**. Los Tet4 son malos en flexión (shear locking) y decentes en volumen. **Si La Forja
  quiere un benchmark que su formulación tetraédrica pueda ganar, es éste** — el precio de entrada es
  implementar carga térmica.
- ⭐ `α = 2.3e−4 /°C` es **10× el acero real** (~1.2e−5). Es un valor *sintético* elegido para producir
  esfuerzos grandes y medibles. **No confundas un benchmark con un caso realista.**

---

# 3. REGLAS PRESCRIPTIVAS EN PROSA

Todo esto es literal o parafraseado cerca del original. **Fuente marcada en cada renglón.**

## 3.1 Mallado y convergencia (`P2_35`)

| # | Regla | Fuente |
|---|---|---|
| M1 | La malla mínima **debe** ser el menor número de elementos que llena el dominio geométrico | *"the minimum number of elements... required to fill the geometric domain"* |
| M2 | El DOF **se sube sobre la malla FIJA** (p-extension); sólo si eso no converge dentro de 1% se refina | *"We then increased the DOF on this fixed mesh by p-extension"* |
| M3 | **Típicamente** basta **una** iteración de refinamiento de malla | *"in most cases only one iteration of mesh refinement was needed"* |
| M4 | La convergencia **debe** evaluarse **independientemente** de la solución de referencia | *"evaluated independently of the NAFEMS reference solutions"* |
| M5 | El error de discretización **debe** ser **< 1%** en el target extraction | *"convergence within 1% of the target extraction"* |
| M6 | La diferencia con la referencia NAFEMS **debe** ser **< 3%** | *"differed by < 3% for all benchmarks"* |
| M7 | El límite estimado por extrapolación **no debe** reportarse como resultado | *"should not be reported for the target extraction"* |
| M8 | Las singularidades de esquina **requieren** malla **graduada**, no refinamiento uniforme | LE6: *"required graded meshing techniques for convergence"* |
| M9 | La malla densa **debe** existir para demostrar que la mínima bastaba, no para mejorar el número | *"provided for comparative purposes"* |
| M10 | Se **debe** reportar: topología de elemento, nº de elementos (mínima y densa), resultado convergido y % de diferencia — para **ambas** mallas | estructura de la tabla de resultados |

## 3.2 Cuándo un modelo NO aplica (`P2_40` — límites del estático lineal)

Seis límites, con el **umbral numérico** donde lo dan:

| # | Límite | Umbral / regla |
|---|---|---|
| N1 | Las deformaciones **deben** ser pequeñas | ⭐ **Regla de 1/10**: si el desplazamiento llega a **1/10 de la longitud característica**, cámbiate a no lineal. *"I tend to utilize the 1/10th rule"* |
| N2 | Las deformaciones unitarias y **rotaciones** deben ser pequeñas | ⭐ **> ~10° de rotación** → considera no lineal. Deformación más allá del límite elástico = deformación grande |
| N3 | Los cambios de rigidez en el modelo deben ser pequeños | Ensamble de acero + espuma blanda → *"will likely result in errors or failure of the analysis to complete"*. También: **stress stiffening** (la cuerda de guitarra), fluencia y pandeo — ninguno lo captura el lineal |
| N4 | Los cambios de condición de frontera deben ser pequeños | En estático lineal, el movimiento entre partes en contacto **debe estar dentro de la distancia de un elemento o menos** |
| N5 | El cambio de dirección de la carga con la deformación debe ser pequeño | Las **follower forces** no existen en lineal. La presión se queda en la orientación inicial |
| N6 | El material **debe** permanecer en el rango lineal elástico | Si pasas la fluencia con material isotrópico lineal, *"the values tell you that you have exceeded the yield, but are **likely inaccurate**"* |

Distinción conceptual que el documento insiste en hacer (y que casi todos confunden):
> **Desplazamiento** = el cuerpo entero se mueve de lugar (traslación/rotación de cuerpo rígido) → caso
> ideal para no lineal. **Deformación** = flexión, elongación, compresión o torsión del cuerpo por las
> cargas → el estático lineal la resuelve **hasta que se vuelve grande**.

## 3.3 Datos de material — reglas duras (`P2_40`)

| # | Regla |
|---|---|
| D1 | Los datos σ-ε **deben ser esfuerzo VERDADERO vs deformación VERDADERA** (no ingenieril) |
| D2 | La pendiente entre dos puntos cualesquiera **no debe ser negativa**. *"Values with a negative slope should be avoided"* |
| D3 | Los valores **deben** pasar por **(0,0)**; la primera fila tiene que ser (0,0) |
| D4 | Si no das datos de compresión, se **asume idénticos a los de tensión** (mal para hierro fundido) |
| D5 | En elasto-plástico bilineal **debes** dar el **módulo tangente** y el **esfuerzo de fluencia inicial**; la regla de endurecimiento default es **isotrópica** (también hay cinemática e isotrópica+cinemática) |
| D6 | Mooney-Rivlin de 2 constantes: `A01`, `A10` y `D1` = **la mitad del módulo volumétrico**. ⭐ El ajuste de curva típicamente produce **5** constantes; se toman **las primeras dos** y **½ del bulk modulus** |
| D7 | Hiperelástico y no-lineal-elástico **regresan a su forma original** al descargar: **no hay deformación permanente**. Sólo elasto-plástico y plástico dejan deformación residual |
| D8 | Cambiar de estático lineal a no lineal **NO** te da plasticidad si el modelo de material sigue siendo **isotrópico lineal** — es el default y es una confusión frecuente |
| D9 | (Moldflow) `α < α_g` en Herschel-Bulkley-WLF, si no `K₀` diverge |

## 3.4 Convergencia y pasos de solución (`P2_40`)

| # | Regla |
|---|---|
| S1 | ⭐ Para que los modelos con **contacto** converjan, se **recomienda usar al menos 10 pasos** |
| S2 | ⭐ Con **no linealidad de material**, un rango de **20 a 40 pasos** es un buen punto de partida |
| S3 | La rigidez se actualiza **en cada iteración de equilibrio**; determinar la respuesta global es **iterativo** y requiere incrementar cargas y BCs |
| S4 | Todo incremento de carga **debe resolverse sobre la estructura DEFORMADA, no la original** |
| S5 | (Explícito/Event Sim) El solver **determina su propio paso crítico** a partir del **tamaño de malla y el material**. Puedes ayudarlo: quita detalles innecesarios para que la malla no sea muy fina, usa **cuerpos rígidos** donde puedas, y no uses una duración más larga de la necesaria |
| S6 | ⭐ En cuerpos rígidos: cualquier BC en cualquier dirección en cualquier punto **restringe ese GDL para la pieza ENTERA**. Por eso al volver rígida una parte se **borran** sus restricciones previas |
| S7 | (Moldflow) Si el campo de usuario resulta **inválido**, el paso se **descarta** y se reintenta con **sub-pasos más chicos** |

## 3.5 Errores típicos que los documentos nombran

1. Reportar "el máximo del modelo" en vez de un target extraction fijo (§2.1.1).
2. Refinar `h` esperando mejorar cuando el error es de **modelo** (LE6, LE7).
3. Usar la respuesta de referencia para decidir cuándo parar de refinar (§2.1.3).
4. Reportar el límite extrapolado (§2.1.4).
5. Creer que "no lineal" implica plasticidad sin cambiar el modelo de material (D8).
6. Cargas puntuales / restricciones sobre líneas en formulaciones donde son inadmisibles (LE3, LE10).
7. Compilar el DLL con rutinas que no están encendidas → se ignoran en silencio (§1.4).
8. Asumir que la máquina de inyección sigue el perfil programado (§1.4).
9. Duración de evento artificialmente corta → la onda no alcanza a propagarse (§4).
10. Meter σ-ε ingenieril donde se pide verdadero (D1).

---

# 4. JUICIOS HUMANOS — lo que decide el analista, no el software

Estos documentos son inusualmente francos sobre dónde termina la automatización.

| # | Decisión | Evidencia literal |
|---|---|---|
| J1 | **Qué cantidad se va a validar y en qué punto.** Es una decisión de ingeniería previa a mallar | El "target extraction" está en el enunciado del benchmark, no lo elige el solver |
| J2 | **Con qué familia de elemento resolver un problema escrito para otra**, y aceptar el costo | LE5: hexas/tetras porque no hay shells con quiebre de pendiente. LE7/LE8: sólidos axisimétricos en vez de shells |
| J3 | **Reinterpretar un enunciado inadmisible** y declarar la reinterpretación | LE10: restricción de línea → restricción de cara |
| J4 | **Aceptar un error irreducible y escribir la nota** en vez de perseguirlo | LE6: 2.2–2.9% por diferencia de modelo placa vs. sólido 3D |
| J5 | **Decidir que un modelo teóricamente inválido sirve** para la cantidad de interés | LE3: carga puntual en shell, divergencia "extremadamente lenta" en el dato de interés |
| J6 | **Cuándo dejar de refinar.** El juicio de que la malla densa "no cambió nada" | *"insignificant changes in the target extraction"* — "insignificante" es un juicio |
| J7 | **Lineal vs. no lineal.** Es un llamado del analista con reglas de dedo, no un check automático | *"I tend to utilize the 1/10th rule"*, *"if your rotation exceeds any more than about 10 degrees, then it is **likely time to start considering**"* |
| J8 | ⭐ **Diagnóstico por sustitución de material.** *"if I have an analysis that is having some difficulty converging and uses one of the complex material models, on occasion **I will temporarily switch parts to linear isotropic** to see if this analysis runs. This can give insight that the material could be the source"* — bisección manual de la causa de no convergencia |
| J9 | ⭐ **Qué partes merecen ser cuerpos rígidos.** *"The steel end plates are **not of much interest** and could be considered relatively stiff in comparison"* — juicio de relevancia, no de física |
| J10 | ⭐⭐ **La duración del evento se elige por BARRIDO Y OJO.** El autor corrió 0.002 / 0.01 / 0.1 / 0.25 s y **comparó las formas deformadas visualmente**: a 0.002 s *"it happens so rapidly that the lower half of the bellows has not responded"*; a 0.01 s *"still not enough time for the displacement to propagate"*; a 0.1 s *"the compression in the two convolutes looks rather fairly balanced"*; a 0.25 s *"we don't see too much difference"* → **se quedó con 0.1 s**. Ningún criterio numérico. Es exactamente nuestra doctrina de "métrica no basta, ver a ojo" |
| J11 | **Cuándo simular vs. confiar en regla de dedo.** *"it doesn't hurt, other than some solution time... to change it to a nonlinear analysis and test"* — cuando el costo de equivocarse supera el costo de cómputo, simula |
| J12 | **Pedirle a alguien con experiencia.** Sobre follower forces no soportadas: *"I would not necessarily suggest that you completely avoid these types of simulations **without first consulting some others with finite element experience**"* — la salida documentada ante una limitación es consultar a un humano |
| J13 | **Ajustar coeficientes de material desde ensayos reales.** Los constantes de Mooney-Rivlin salieron de ensayos equibiaxial + cortante puro + tensión simple, metidos a un programa de ajuste de curva. El analista **elige qué ensayos** y **qué constantes del ajuste usar** (tomó 2 de 5) |

⭐ Observación transversal: **el documento de Moldflow define su valor por lo que el usuario puede
enchufarle**, no por lo que trae de fábrica. Cristalización, orientación de fibra, respuesta de la
máquina, control de paso — todo el reporte es sobre **abrir el solver**. El cliente comercial nos está
diciendo que un solver cerrado no es competitivo.

---

# 5. BRECHA CONTRA LA FORJA

## 5.1 Lo que YA tenemos y sirve para un benchmark NAFEMS

| Capacidad | Dónde | Estado |
|---|---|---|
| Ensamble de K con Tet4, 3 GDL/nodo | `src/forja/brep/fea.ts` → `runFEA`, `prepareFeaSession` | ✅ |
| Elemento Tet4 + matriz constitutiva 3D | `src/lib/formulas.ts` → `tet4Element`, `elasticityMatrix3D` | ✅ |
| CG disperso con precondicionador IC(0), fallback Jacobi, warm-start | `fea.ts` → `sparseCG`, `buildIC0` | ✅ |
| **Reporte de convergencia del solver** (`iterations`, `residual`, `converged`) | `FEAResult.solver` | ✅ ya es la mitad de M4 |
| `E` y `ν` inyectables como objeto literal (no sólo clave de catálogo) | `FEAOptions.material` acepta `MaterialProperties` | ✅ **puerta directa** para meter los E/ν del benchmark |
| Dirichlet total sobre una **cara** | `FaceBC.fixedFaces` | ✅ (es justo lo que pide LE5) |
| Carga distribuida sobre una cara (fuerza total o presión × área OCCT) | `FaceBC.loadFaces` + `totalForce`/`pressure` | ✅ parcial |
| Arnés de gate con tolerancia declarada y `VERIFY_RESULT` | `scripts/*-test.cjs`, registrado en `scripts/forja-gate.cjs` (`SUITES`) | ✅ el molde ya existe |
| Barrido de refinamiento `h` | `scripts/fea-convergence.cjs` (res ∈ 12/20/28/40) | ⚠️ existe pero **no falla**: sólo imprime |
| Kernel geométrico B-Rep completo (extrusión, revolución, spline, booleanas) | `src/forja/brep/occt.ts` | ✅ las geometrías **se pueden modelar** |
| Térmico 3D transitorio con difusión espectral y Robin | `src/forja/mold/mold-thermal-fdm.ts` | ✅ (sin acoplar al mecánico) |
| Llenado 1D con ΔP y fuerza de cierre | `src/forja/mold/filling.ts` | ✅ (ley de potencia, no Cross-WLF) |

## 5.2 Lo que FALTA, ordenado por severidad

| # | Falta | Impacto | Costo |
|---|---|---|---|
| **B1** | **BC por componente y por simetría.** `FaceBC.fixedFaces` fija **los 3 GDL** de todos los nodos de la cara. No hay `Ux = 0 dejando Uy libre` | ⛔ **Bloquea 7 de 9 benchmarks.** LE1, LE6, LE7, LE8, LE10, LE11 usan simetría; LE3 usa `Uz=0` en un punto | **Bajo.** Extender a `fixedDOF: { faces: number[], dof: [bool,bool,bool] }[]` y tocar el lazo de eliminación simétrica (`fea.ts` ~715-732 y ~912-919) |
| **B2** | **Salida de componentes de esfuerzo.** `FEAResult` sólo trae von Mises. El tensor Voigt **se calcula y se tira** (`fea.ts` ~761-768) | ⛔ **Bloquea 8 de 9.** Los targets son σ_yy, σ axial, σ hoop, σ₁ — **ninguno es von Mises** | **Muy bajo.** Persistir `stressElem: Float64Array` (6 comp/tet). `principalStresses` ya existe re-exportada y nadie la llama |
| **B3** | **Sonda puntual.** No hay forma de preguntar "¿cuánto vale σ_yy en el punto (x,y,z)?" | ⛔ El target extraction **es** un punto | **Muy bajo.** Helper de tet contenedor o nodo más cercano |
| **B4** | **Cargas por cara con dirección propia.** Hoy hay **un** `totalForce` repartido entre **todos** los `loadFaces` | ⛔ LE5 necesita dos cortantes **opuestos** para formar un par | **Bajo.** `loads: { faces, totalForce }[]` |
| **B5** | **Vector de carga consistente.** La presión se convierte a fuerza total ÷ nº de nodos (**lumped**). El propio gate lo señala como causa de ~10% de error en δ | Error sistemático que no baja al refinar | **Medio.** `∫Nᵀ·t dS` sobre las caras triangulares |
| **B6** | **Malla conforme a fronteras curvas.** El único puente es `brepToVolumeTetMesh`, que es un **voxelizador** (clasifica por centro con ray-casting, parte cada voxel en 6 tets Freudenthal). La geometría se convierte en **escalones** | ⛔ LE1, LE7, LE8, LE10, LE11 tienen fronteras curvas, y el punto de medición cae en un escalón | **Alto.** Requiere un mallador tetraédrico real |
| **B7** | **Refinamiento local / graduado.** `resolution` es **global** sobre el lado más largo | ⛔ M8 (singularidades de esquina) es imposible | **Alto** |
| **B8** | **Tet4 → orden superior.** Tet4 lineal **sobre-rigidiza en flexión** (shear locking), documentado en el propio gate, que acepta razones de 0.2–1.25 en δ | ⛔ NAFEMS pide < 3%. Nuestro gate acepta **±75%** | **Alto** (tet10) pero es **el** salto de credibilidad |
| **B9** | **Carga térmica en el mecánico.** No existe `f_th = ∫Bᵀ·D·α·ΔT dV`. `α` **ya está** en `MATERIAL_DATABASE`; `thermalStressConstrained` existe como fórmula 1D huérfana | ⛔ LE11. Y bloquea el alabeo, que es la salida estrella de Moldflow | **Medio.** El dato ya está; falta el vector de carga y el acoplamiento con `mold-thermal-fdm.ts` |
| **B10** | **Esfuerzo plano / deformación plana / axisimétrico / shells.** `cstElement`, `planeStressMatrix`, `planeStrainMatrix`, vigas Euler-Bernoulli y Timoshenko **existen en `formulas.ts` sin ensamblador ni consumidor** | ⛔ LE1 (2D), LE2/LE3/LE6 (shells), LE7/LE8 (axisimétrico) = **6 de 9** | **Medio-alto** por familia. El axisimétrico es el más barato (2D con factor 2πr) |
| **B11** | **Protocolo de convergencia como gate.** `fea-convergence.cjs` barre pero no falla; los gates comparan `max*` en vez de un target extraction | ⛔ **Sin esto no puedes decir "validado" aunque el número salga bien** | **Muy bajo** — y es lo de mayor valor por peso |
| **B12** | (Moldflow) Cross-WLF, Tait pvT, cristalización, orientación de fibra, alabeo | El cliente comercial los exige | **Alto** — hoja de ruta larga |

## 5.3 ⭐ EL PRIMER BENCHMARK: **LE5 — Z-Section Cantilever**

### Por qué LE5 y no otro

Puntuación por capacidades nuevas requeridas:

| | 2D/shell/axisim. | Frontera curva | BC de simetría | Carga térmica | Restricción de arista/punto |
|---|---|---|---|---|---|
| LE1 | ❌ sí | ❌ sí | ❌ sí | — | — |
| LE2 | ❌ sí | ❌ sí | ❌ sí | — | — |
| LE3 | ❌ sí | ❌ sí | ❌ sí | — | ❌ punto |
| **LE5** | ✅ **no** | ✅ **no** | ✅ **no** | ✅ **no** | ✅ **no** |
| LE6 | ❌ sí | — | — | — | ❌ arista |
| LE7 | ❌ sí | ❌ sí | — | — | ❌ punto |
| LE8 | ❌ sí | ❌ sí | — | — | ❌ punto |
| LE10 | — | ❌ sí | ❌ sí | — | ❌ línea |
| LE11 | — | ❌ sí | ❌ sí | ❌ sí | — |

**LE5 es el único benchmark NAFEMS-LE que no exige NINGUNA capacidad estructural nueva.** Todo son
caras planas ortogonales a los ejes, un empotramiento de cara completa y cargas distribuidas sobre
caras. Mapea 1:1 sobre nuestro `FaceBC`.

### Por qué el voxelizador NO lo arruina (el argumento decisivo)

La sección Z es **enteramente prismática y alineada a los ejes**, con espesor de pared 0.1 m. Si eliges
`voxel` de modo que `0.1 / voxel` sea entero y la rejilla quede alineada, **la voxelización es EXACTA:
cero escalonamiento.** Es el único benchmark del set con esa propiedad. Nuestra peor debilidad
geométrica (B6) simplemente **no aplica**.

Costo de malla estimado: la sección transversal tiene ~4 m de desarrollo × 0.1 m de espesor.
- `voxel = 0.05 m` (2 elementos en el espesor) → ~160 voxeles por sección × 200 secciones ≈ **32 000
  voxeles → ~192 000 tets → ~120 000 GDL**. Pesado pero alcanzable.
- `voxel = 0.1 m` (1 elemento en el espesor) → ~40 × 100 = **4 000 voxeles → 24 000 tets → ~30 000 GDL**.
  Instantáneo, sirve como el punto más grueso del barrido de convergencia.

⚠️ Ojo: `brepToVolumeTetMesh` recorre **toda la AABB** (10 × 2.1 × 2.1) haciendo ray-casting; la
sección Z sólo llena ~9% de ella. Espera un `fillFraction ≈ 0.09` y un preproceso lento aunque la
malla resultante sea chica. Eso es diagnóstico esperado, no bug.

### Trabajo requerido (todo de costo bajo)

1. **B2** — persistir `stressElem` (6 componentes Voigt por tet) en `FEAResult`. El tensor ya se calcula.
2. **B3** — helper `probeStressAt(result, mesh, [x,y,z])` con promediado nodal o tet contenedor.
3. **B4** — permitir cargas por cara con dirección propia: `loads: { faces: number[], totalForce: [x,y,z] }[]`.
4. Modelar la sección Z con `extrudePolygon` (`occt.ts`) — polígono de 12 vértices extruido 10 m.
5. Escribir `scripts/nafems-le5.cjs` con el patrón 1 del repo (`ok(a,b,eps)` + `VERIFY_RESULT` +
   `process.exit`), registrarlo en `SUITES` de `forja-gate.cjs` como `{ group: 'physics', n: 'nafems-le5' }`.

### Qué esperar honestamente

**Probablemente NO pasemos el 3%.** Tet4 sin p-extension bajo **torsión** es el peor escenario posible
para nuestro elemento: StressCheck necesitó 136 tetras **con p-extension** para llegar a 1.2%.
Nosotros tenemos p = 1 fijo.

**Y eso está bien, porque ése es el punto.** Hoy nuestra afirmación es "el gate acepta razones de
0.2 a 1.25 en deflexión". Después de LE5 la afirmación será: *"nuestro solver da −XX MPa contra la
referencia NAFEMS de −108 MPa, con Y% de error de discretización medido independientemente."*
**Eso es un número que un tercero puede auditar.** Y es la justificación cuantificada, no
argumentativa, para invertir en tet10 (B8).

### Paso 0 — antes de LE5, y sin tocar el solver

Lo de **mejor relación valor/esfuerzo de todo el pliego** no es una geometría: es **B11, el protocolo**.

Se puede implementar **hoy, con cero cambios al solver**, sobre la barra a tensión y el cantilever que
ya viven en `scripts/fea-node-test.cjs`:

1. Declarar un **target extraction** fijo (un escalar en un punto) en vez de `maxVonMises`/`maxDisplacement`.
2. Convertir `fea-convergence.cjs` en **gate** con criterio de convergencia **independiente de la
   respuesta analítica**: `|q(h_i) − q(h_{i−1})| / |q(h_i)| < 1%` sostenido, más una tasa
   `‖e‖ ≤ C·h^p` con `p` consistente con Tet4.
3. Reportar **dos** errores separados: discretización (contra uno mismo) y exactitud (contra la
   referencia).
4. Reportar **malla mínima y malla densa**, con nº de elementos, como manda M10.

Eso convierte nuestros gates de "el número quedó cerca" a "el número convergió, y convergió a esto".
Es la diferencia entre parecer validado y estarlo — y es el prerrequisito para que LE5 signifique algo.

### Segundo benchmark recomendado: **LE11**

Una vez hechos B1 (simetría) y B9 (carga térmica): **LE11 es el benchmark que nuestra formulación puede
ganar.** Es el único donde los tetraedros bajan de 0.5% (317 tetras → 0.48%), porque está dominado por
deformación **volumétrica** y no por flexión. Además B9 es la puerta al **alabeo**, que es la salida
estrella del cliente Moldflow y hoy no existe en La Forja. Un solo trabajo abre dos frentes.

---

# 6. ⭐ Los 10 detalles que una máquina lineal se saltaría

1. ⭐ **La convergencia se demuestra SIN mirar la respuesta.** *"Numerical convergence was evaluated
   independently of the NAFEMS reference solutions."* Si usas la referencia para decidir cuándo parar
   de refinar, no validaste: afinaste hacia el número. Son dos preguntas y en ese orden: ¿convergí?
   (**< 1%**, contra ti mismo) y ¿convergí a lo correcto? (**< 3%**, contra el mundo). **Dos tolerancias,
   no intercambiables.**

2. ⭐ **El límite extrapolado está PROHIBIDO como resultado.** *"the estimated limit in each graph is
   for reference only and should not be reported."* Se reporta la corrida de más DOF que realmente se
   resolvió. Es una regla anti-trampa explícita contra la extrapolación de Richardson.

3. ⭐ **Más elementos puede ser PEOR.** LE1 malla densa con 252 DOF → **84.18 MPa** (−9%); malla mínima
   con 180 DOF → **92.66 MPa** (−0.04%), con **36× menos elementos**. Refinar `h` con `p` bajo pierde
   contra subir `p`. Y la convergencia **no es monótona** (92.96 → 92.96 → 92.84): un criterio de paro
   por delta consecutivo te engaña. Y las dos mallas convergen a **límites distintos** (92.75 vs 92.66):
   "convergido" es una **banda**, no un punto.

4. ⭐ **LE3 es matemáticamente inadmisible y aun así es un benchmark válido.** Carga puntual en shell =
   energía de deformación infinita → desplazamientos no pueden ser finitos. Pero *"the divergence in
   the data of interest is extremely slow"*. **La admisibilidad se juzga por CANTIDAD EXTRAÍDA, no por
   el modelo.** Un solver que rechaza cargas puntuales "por corrección" reprueba un estándar.

5. ⭐ **LE10 tal como está escrito NO es resoluble.** Restringe el desplazamiento Z sobre una **línea**,
   y *"constraints along a line are incompatible with 3D-elasticity"*. StressCheck fijó la **cara**
   completa y lo declaró. **El benchmark se negocia y se documenta** — no es un contrato ejecutable
   literal.

6. ⭐ **El 2.5% de LE6 y el −2.3% de LE7 NO son bugs: son diferencia de MODELO.** La referencia sale de
   teoría de placas / shell axisimétrico; la solución sale de elasticidad 3D. En LE7, **5 elementos y
   605 elementos dan el mismo número** (25.27) — refinar 121× no movió un dígito. Hay que saber cuándo
   dejar de refinar y **escribir una nota** en vez de perseguir un fantasma. Bonus: cuando todos tus
   errores tienen **el mismo signo**, no tienes ruido numérico, tienes sesgo de formulación.

7. ⭐ **`SolverUserHb3dUserNodeFieldsAreValid` controla el PASO DE TIEMPO por admisibilidad FÍSICA, no
   por residual.** *"If the values are determined to be invalid, the present solution is discarded, and
   smaller sub steps are attempted."* Y hay **dos** niveles distintos: `AreValid` (rechazar y reintentar
   más fino) vs. `CheckAndFix` (aceptar y proyectar). Un implementador ingenuo hace sólo clampeo y se
   queda sin mecanismo de control de paso.

8. ⭐ **La reformulación `Y = ln(1/(1−θ))` de Nakamura no es cosmética.** *"desirably eliminates the
   possibility for θ to be greater than 1."* Hace **imposible por construcción** salir del dominio
   físico. Igual de fino: la solidificación se modela **dividiendo** por
   `1 − Crystallinity/CrystallinitySolidificationValue`, o sea con una **singularidad de viscosidad**,
   no con un `if T < Tf`. Y `Y_germ` existe sólo para que la potencia no reviente en cero.

9. ⭐ **La máquina de inyección NO sigue el perfil programado.** *"in real practice the flow rate profile
   achieved by the molding machine may not be the same as the preset profile"* — por límites de caudal,
   de tasa de cambio, o por lag de respuesta (`Q' = ½(Q_prev + Q_current)`). **El setpoint no es el
   proceso.** Y los argumentos de `SolverUserHb3dSwitchOver` (% volumen, posición del husillo, presión,
   **fuerza de cierre**, tiempo) son la lista autorizada de criterios de switchover: nuestra
   `clampForceN` hoy es un número de reporte final; ahí es **variable de control en vivo**.

10. ⭐ **La duración del evento se elige POR OJO, no por criterio numérico.** El autor de Autodesk corrió
    0.002 / 0.01 / 0.1 / 0.25 s y **comparó formas deformadas visualmente**: a 0.002 s la mitad inferior
    del fuelle *"has not responded"*; a 0.1 s *"looks rather fairly balanced"*; a 0.25 s *"we don't see
    too much difference"* → se quedó con 0.1 s. **Ningún número decidió.** Y su técnica de depuración
    hermana: *"I will temporarily switch parts to linear isotropic to see if this analysis runs"* —
    bisección manual de la causa de no convergencia. Es literalmente nuestra doctrina de
    *"métrica no basta, ver a ojo"*, escrita por un cliente comercial.

**Bonus (11.º)** ⭐ **`Laminate ID` viaja junto al node ID en TODAS las rutinas del solver "3D" de
Moldflow** (`SolverUserHb3dViscosityAtLaminateOfNode`). Aun en 3D, los nodos siguen organizados **por
capa a través del espesor**. El "3D" de Moldflow no es un campo desestructurado plano: conserva la
estructura laminada. Y el binding de la API es **por slot encendido**: un DLL con rutinas correctas
pero con el checkbox apagado **se ignora en silencio**.

---

## Anexo: geometría de LE5 lista para modelar

Sección transversal en el plano YZ (extruir 10 m en +X). Espesor de pared `t = 0.1 m`.
Alma horizontal de 2 m; patín de 1 m hacia +Z en un extremo; patín de 1 m hacia −Z en el otro.

```
        ┌─┐  ← patín superior, 1 m de alto, 0.1 m de espesor
        │ │
  ┌─────┴─┘  ← alma horizontal, 2 m de largo, 0.1 m de espesor
  │
  └─┐        ← patín inferior, 1 m de alto, 0.1 m de espesor
    │
    └─
```

- **Empotramiento**: cara completa en `X = 0` (los 3 GDL) → `fixedFaces`
- **Cargas**: `+0.6 MN` en Z sobre la superficie del patín superior en `X = 10`;
  `−0.6 MN` en Z sobre la superficie del patín inferior en `X = 10`.
  Brazo = 2 m → par = 1.2 MN·m ✓
- **Sonda**: σ_xx en `X = 2.5 m`, sobre la midsurface, en el punto **A** de la figura
  (⚠️ fijar la coordenada transversal exacta contra NAFEMS Rev. 3 antes de cerrar el gate)
- **Referencia**: **−108 MPa**
- **Banda de aceptación NAFEMS**: ±3% → **[−111.2, −104.8] MPa**
- **Referencia de lo alcanzable con tetraedros** (StressCheck, con p-extension): −109.3 MPa (1.2%) con
  136 tetras; −109.5 MPa (1.4%) con 1186 tetras

---

*Pliego generado leyendo `P2_42`, `P2_35` y `P2_40` literalmente. Donde una fuente no cubre un tema,
está dicho. Los valores de referencia NAFEMS son citas textuales; la geometría se leyó de las figuras
rasterizadas de `P2_35`. El único dato marcado como incompleto es la posición transversal del punto A
en LE5.*
