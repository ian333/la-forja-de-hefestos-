# Anderson caps 1–2 — El contrato de datos de todo el software aerodinámico

**Fuente:** `docs/forja-research/manuales/aero/txt/anderson.txt`, líneas **769–9867**, leído completo
(cap. 1 = 769–5259, pp. 3–104; cap. 2 = 5260–9867, pp. 105–202). Anderson, *Fundamentals of
Aerodynamics*, 6ª ed., McGraw-Hill 2017, ISBN 978-1-259-12991-9.
**Fecha:** 2026-08-04. **Análisis:** agente de pliego AERO (bloque Anderson 1–2).

> Regla del CONTRATO cumplida: cada afirmación lleva § y página. Lo que no está en el libro lleva
> `[EXTENSIÓN DECLARADA]`. Lo que el `pdftotext` perdió está en §7 NO OBSERVADO.
> Convención de notación: escribo las fórmulas en ASCII (I=V/R), no en LaTeX.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

El cliente (Raymer) dice CÓMO se diseña un avión. Anderson caps. 1–2 dicen **de dónde salen los
números que Raymer usa** y, más importante para nosotros, **cuál es el tipo de dato que todo el
software tiene que hablar**. Estos dos capítulos no calculan ni un perfil: montan el vocabulario y
el aparato. Son, literalmente, el esquema de la base de datos.

**Cap. 1 — "Aerodynamics: Some Introductory Thoughts" (pp. 3–104).**
Cuatro entregables duros para nosotros:

1. **Las cuatro variables de campo** (p, ρ, T, V) como *propiedades de punto* (§1.4, pp. 15–18)
   y el esfuerzo cortante τ = μ·dV/dy. Nuestro campo no es un mapa de colores bonito: es un
   campo escalar/vectorial definido punto a punto.
2. **LA operación fundamental del CAD aerodinámico** (§1.5, pp. 19–26): *toda* fuerza y momento
   sale de **integrar p y τ sobre la piel del cuerpo**. Ecuaciones (1.7), (1.8) y (1.11) en forma
   dimensional; (1.15), (1.16), (1.17) en forma de coeficientes. Ésta es la función que la Forja
   debe correr sobre la geometría B-Rep que dibuja el alumno. Nada más lo es.
3. **Los coeficientes adimensionales** (§1.5, pp. 24–25) con **su área y longitud de referencia
   explícitas** — el contrato de datos. Más `Re` y `M∞` del análisis dimensional (§1.7, pp. 34–41).
4. **La similitud dinámica** (§1.8, pp. 41–52): la justificación matemática de por qué podemos
   **precomputar UN caso en la GPU y servirlo a muchos**. Es la licencia teórica de nuestra
   estrategia de cómputo.

Más: centro de presión y sus tres representaciones equivalentes (§1.6), estática de fluidos y
Arquímedes (§1.9), la taxonomía de flujos (§1.10 — continuo/libre, viscoso/no viscoso,
compresible/incompresible, regímenes de Mach), capa límite y no-deslizamiento (§1.11), magnitudes
típicas de los coeficientes (§1.12), y dos notas históricas (§1.13, §1.14) que explican **por qué
el centro de presión desapareció de las hojas de datos modernas** y **por qué se adimensionaliza
con q∞·S** — ambas decisiones de diseño de producto, no anécdotas.

**Cap. 2 — "Some Fundamental Principles and Equations" (pp. 105–202).**
Es un capítulo de *herramientas*, dicho por el propio autor: *"The purpose of this chapter is
'tool-building'"* (§2.1, p. 106) y *"You are reminded again that this is a tool-building chapter"*
(§2.13, p. 176). El epígrafe del capítulo es la consigna de todo el bloque — von Karman, 1954:
***"The principle is most important, not the detail."*** Entregables:

0. **El kit vectorial completo** (§2.2, pp. 107–119): gradiente, divergencia y rotacional en
   cartesianas, cilíndricas y esféricas; integrales de línea/superficie/volumen con sus **convenciones
   de tangente y normal**; y los tres teoremas (Stokes 2.25, divergencia 2.26, gradiente 2.27). Es,
   literalmente, la especificación de los operadores que el solver debe implementar.
1. **Los tres principios y sus dos formas** (integral sobre volumen de control finito ↔ diferencial
   en un punto): continuidad (§2.4), momento/Euler/Navier-Stokes (§2.5), energía (§2.7). Más una
   aplicación medible: **el arrastre por levantamiento de estela** (§2.6).
2. **La derivada sustancial** D/Dt (§2.9) — la diferencia entre "qué pasa en este punto" y "qué le
   pasa a esta partícula". Es exactamente la diferencia entre un *field probe* y un *tracer* en
   nuestra UI, y el libro la mide: un elemento de fluido en un flujo "benigno" sufre **36.6 g**.
3. **Vorticidad y circulación** (§2.12, §2.13) — el puente conceptual hacia la sustentación.
   `ξ = ∇×V = 2ω` y `Γ ≡ −∮ V·ds`, con el signo negativo que Anderson usa a propósito.
4. **Función de corriente ψ y potencial de velocidad φ** (§2.14, §2.15) — de tres incógnitas (u,v,w)
   a **una sola** escalar. Es la razón por la que un solver potencial cabe en un navegador.
5. **Líneas de corriente / trayectoria / traza** (§2.11) y el criterio de cuándo son la misma cosa.
6. **Cómo se resuelven las ecuaciones** (§2.17, pp. 187–196) — analítico vs CFD, con el veredicto
   duro: *"to date, no general analytical solution to these equations has been obtained."*

**Por qué le importa al cliente en una frase:** el cap. 1 define el *tipo de dato* del producto
(coeficientes con su referencia), el cap. 2 define el *motor* (ecuaciones, y sobre todo el atajo
irrotacional que hace el motor barato). Y el par (§1.7 + §1.8) define la *arquitectura de cómputo*:
un caso adimensional sirve para infinitos casos dimensionales.

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§ pág] requisito (APRENDER | CONSTRUIR | AMBOS)`

### 1.A — Núcleo: la integral de superficie (el corazón del CAD aerodinámico)

- **[aero2d] [§1.5 p.19] (CONSTRUIR)** El sistema DEBE modelar que solo existen **dos** fuentes de
  fuerza aerodinámica. Literal: *"the aerodynamic forces and moments on the body are due to only
  two basic sources: **1. Pressure distribution over the body surface. 2. Shear stress distribution
  over the body surface.** No matter how complex the body shape may be, the aerodynamic forces and
  moments on the body are due entirely to the above two basic sources. The only mechanisms nature
  has for communicating a force to a body moving through a fluid are pressure and shear stress
  distributions on the body surface."* → La API de resultados no debe admitir ningún término de
  fuerza que no sea trazable a `p(s)` o `τ(s)` sobre una cara de la pieza.
- **[aero2d] [§1.5 pp. 22–23] (CONSTRUIR)** El integrador DEBE implementar las Ecuaciones (1.7),
  (1.8) y (1.11) **con la convención de signo de θ del libro**: θ positivo medido **en sentido
  horario** desde la vertical hacia la dirección de p, y desde la horizontal hacia la dirección de τ.
  Literal: *"in these equations, the positive clockwise convention for θ must be followed"* y
  *"Equations (1.3) to (1.6) hold in general (for both the forward and rearward portions of the
  body) as long as the above sign convention for θ is consistently applied."*
- **[geometria] [§1.5 p.22] (CONSTRUIR)** La piel debe parametrizarse por **arco desde el borde de
  ataque**: `su` sobre el extradós, `sl` sobre el intradós, con `dS = ds·(1)` para el caso 2D de
  envergadura unitaria. Las cantidades primadas (`N'`, `A'`, `M'_LE`) son **por unidad de
  envergadura**.
- **[aero2d] [§1.5 p.23] (AMBOS)** Convención de momento: *"By convention, moments that tend to
  increase α (pitch up) are positive, and moments that tend to decrease α (pitch down) are
  negative."* El signo del momento es un contrato de API; documentarlo en el tipo, no en un
  comentario.
- **[aero2d] [§1.5 p.23] (APRENDER)** El objetivo declarado de toda la teoría: *"A major goal of
  theoretical aerodynamics is to calculate p(s) and τ(s) for a given body shape and freestream
  conditions, thus yielding the aerodynamic forces and moments via Equations (1.7), (1.8), and
  (1.11)."* → Esa frase es la especificación del solver de la Forja en una línea.
- **[aero2d] [§1.5 p.26] (CONSTRUIR)** La forma **preferente** de la integral es la de coeficientes,
  Ecuaciones (1.15)–(1.17), que integra `Cp` y `cf` sobre `dx` usando `dy/dx` de la superficie.
  Literal: *"It is important to note from Equations (1.15) through (1.19) that the aerodynamic force
  and moment coefficients can be obtained by integrating the pressure and skin friction coefficients
  over the body. This is a common procedure in both theoretical and experimental aerodynamics."*
- **[aero3d] [§1.5 p.26] (APRENDER)** Las (1.15)–(1.17) son **2D solamente**. Literal: *"although
  our derivations have used a two-dimensional body, an analogous development can be presented for
  three-dimensional bodies—the geometry and equations only get more complex and involved—the
  principle is the same."* El propio Ejemplo 1.2 lo demuestra: para un cono hay que rehacer la
  integral a mano (*"We cannot use Equations (1.15) to (1.17) here"*, p. 30). → El motor 3D no puede
  reutilizar el kernel 2D: es otra rutina, aunque el principio no cambie.

### 1.B — El contrato de datos: coeficientes adimensionales

- **[aero2d/aero3d] [§1.5 p.24] (CONSTRUIR)** Todo coeficiente de fuerza es `X / (q∞·S)` y todo
  coeficiente de momento es `M / (q∞·S·l)`, con `q∞ ≡ ½·ρ∞·V∞²`. `S` = área de referencia,
  `l` = longitud de referencia.
- **[aero2d/aero3d] [§1.5 pp. 24–25] (CONSTRUIR)** **`S` y `l` NO son universales y el software DEBE
  transportarlas junto al número.** Literal: *"the reference area S and reference length l are chosen
  to pertain to the given geometric body shape; for different shapes, S and l may be different
  things. For example, for an airplane wing, S is the planform area, and l is the mean chord length…
  However, for a sphere, S is the cross-sectional area, and l is the diameter."* Y el requisito
  explícito: *"The particular choice of reference area and length is not critical; however, **when
  using force and moment coefficient data, you must always know what reference quantities the
  particular data are based upon**."* → `type Coef = { valor: number; S_ref: Area; l_ref: Longitud;
  origen: string }`. Un `CL` suelto, sin su `S`, es un dato corrupto. **Éste es el requisito #1 del
  bloque.**
- **[aero2d] [§1.5 p.25] (CONSTRUIR)** Convención de mayúsculas/minúsculas **obligatoria**: mayúsculas
  (`CL, CD, CM, CA, CN`) = cuerpo tridimensional completo (avión, ala finita); minúsculas
  (`cl, cd, cm`) = cuerpo **bidimensional**, fuerzas por unidad de envergadura, con `S = c·(1) = c`.
  Refuerzo en §1.16 p.101: *"by convention, the lift and drag coefficients for an airfoil are
  expressed by lowercase letters, whereas those for a three-dimensional body… are expressed by
  uppercase letters."* → El tipo debe distinguir 2D de 3D; mezclarlos es el bug clásico
  (§1.16 p.101 lo cuantifica: `L/D` de perfil = 110 vs `L/D` de avión = 14 para el mismo alumno).
- **[aero2d] [§1.5 p.25] (CONSTRUIR)** `Cp ≡ (p − p∞)/q∞` y `cf ≡ τ/q∞`. Nota crítica de diseño: al
  usar `Cp` (presión manométrica) en vez de `p`, **la contribución de la presión ambiente se cancela
  sola sobre un cuerpo cerrado**; el Problema 2.1 (p. 200) pide justamente probar que *"If the
  pressure distribution over the surface of the body is constant, prove that the resultant pressure
  force on the body is zero."* → Ver §8, hallazgo 3.
- **[compresible] [§1.7 p.38] (CONSTRUIR)** `Re ≡ ρ∞·V∞·c/μ∞`. Definición física literal:
  *"The Reynolds number is physically a measure of the ratio of inertia forces to viscous forces in
  a flow and is one of the most powerful parameters in fluid dynamics."*
- **[viscoso] [§1.11 p.73] (CONSTRUIR)** `Re_x ≡ ρ∞·V∞·x/μ∞`, Ecuación (1.61) — Reynolds **local**,
  con `x` medido desde el borde de ataque. Es un `Re` distinto del de referencia; no confundirlos.
- **[compresible] [§1.7 p.39] (CONSTRUIR)** `M ≡ V∞/a∞`.
- **[aero3d] [§1.7 p.40] (CONSTRUIR)** El resultado central del capítulo, Ecuaciones (1.42)–(1.44):
  `CL = f(Re, M∞, α)`, `CD = f(Re, M∞, α)`, `CM = f(Re, M∞, α)` **para una forma dada**. → La firma
  de la tabla precomputada es exactamente ésa: cuatro entradas (forma, α, Re, M) → tres salidas.

### 1.C — Centro de presión y sistema fuerza-momento

- **[estabilidad] [§1.6 p.32] (CONSTRUIR)** `x_cp = −M'_LE / N'` (Ec. 1.20); con α pequeño,
  `x_cp ≈ −M'_LE / L'` (Ec. 1.21). Definición alterna literal: *"an alternate definition of the
  center of pressure is that point on the body about which the aerodynamic moment is zero."*
- **[estabilidad] [§1.6 p.33] (CONSTRUIR)** El sistema fuerza-momento tiene **tres representaciones
  equivalentes** y el software debe poder convertir entre ellas: resultante en el borde de ataque
  con `M'_LE`, resultante en c/4 con `M'_c/4`, o resultante en `x_cp` con momento cero.
  Ecuación (1.22): `M'_LE = −(c/4)·L' + M'_c/4 = −x_cp·L'`.
- **[estabilidad] [§1.6 p.33] (APRENDER + guarda de software)** **`x_cp` es numéricamente inestable.**
  Literal: *"As N' and L' decrease, x_cp increases. As the forces approach zero, the center of
  pressure moves to infinity. For this reason, the center of pressure is not always a convenient
  concept in aerodynamics."* → La UI **no debe** graficar `x_cp` cerca de sustentación nula sin un
  guardarraíl; debe ofrecer `cm_c/4` como representación por defecto.
- **[estabilidad] [§1.13 p.93] (CONSTRUIR)** La NACA ya tomó esta decisión de producto por nosotros
  a principios de los 1930: *"Instead of giving the airfoil data in terms of lift, drag, and center
  of pressure, the NACA chose the alternate systems of reporting lift, drag, and moments about
  either the quarter-chord point or the aerodynamic center."* Y: *"the center of pressure is rarely
  given as part of modern airfoil data. On the other hand, for three-dimensional bodies, such as
  slender projectiles and missiles, the location of the center of pressure still remains an important
  quantity, and modern missile data frequently include x_cp."* → **Perfiles: reportar `cm_c/4`.
  Cuerpos esbeltos 3D (misil, fuselaje, cohete): reportar `x_cp`.** Dos vistas distintas, no una.
- **[estabilidad] [§1.6 p.34, Ej. 1.4] (CONSTRUIR)** El sistema fuerza-momento también queda
  determinado **dando los momentos respecto a dos puntos cualesquiera**: *"this example proves that
  the force and moment system is also uniquely specified by giving the moments acting about any two
  points on the airfoil."* → Útil como ruta de entrada alterna de datos experimentales.

### 1.D — Análisis dimensional y similitud (la licencia del precómputo)

- **[optimizacion] [§1.7 pp. 34–41] (AMBOS)** El software DEBE trabajar en el espacio adimensional.
  El libro cuantifica el ahorro: `R = f(ρ∞, V∞, c, μ∞, a∞)` son **5** variables independientes;
  Buckingham las reduce a **2**. Literal: *"by using the Buckingham pi theorem, we have reduced the
  number of independent variables from five in Equation (1.23) to two in Equation (1.38)… With a
  small amount of analysis, we have saved a huge amount of effort and wind-tunnel time."*
- **[optimizacion] [§1.8 p.41] (CONSTRUIR)** Definición operativa de **similitud dinámica** (los tres
  criterios, literales): *"1. The streamline patterns are geometrically similar. 2. The distributions
  of V/V∞, p/p∞, T/T∞, etc., throughout the flow field are the same when plotted against common
  nondimensional coordinates. 3. The force coefficients are the same."* Con la nota: *"item 3 is a
  consequence of item 2"*.
- **[optimizacion] [§1.8 p.41] (CONSTRUIR)** Y los dos criterios **para lograrla**: *"1. The bodies
  and any other solid boundaries are geometrically similar for both flows. 2. The similarity
  parameters are the same for both flows."* → **Éste es el permiso formal para cachear.** La clave de
  caché de un caso es `(forma_adimensional, α, Re, M∞)`; nada más. Ver §5.
- **[optimizacion] [§1.8 p.41] (APRENDER — límite del permiso)** El libro **acota** su propia regla:
  *"this statement is not quite precise because there are other similarity parameters that influence
  the flow. In addition, differences in freestream turbulence between the wind tunnel and free flight
  can have an important effect on CD and the maximum value of CL."* → La caché es válida, pero la UI
  debe rotular el resultado como "similitud Re–M" y no como "verdad".
- **[compresible/viscoso] [§1.7 p.40] (APRENDER)** Cuando entra termodinámica o transferencia de
  calor aparecen **más** parámetros de similitud: `cp/cv = γ`, `Tw/T∞`, y `Pr = μ∞·cp/k∞`. → Si algún
  día el estudio incluye calentamiento, la clave de caché crece; diseñarla extensible desde hoy.

### 1.E — Taxonomía de flujos (el enrutador de solvers)

- **[aero2d/compresible] [§1.10 p.62] (CONSTRUIR)** El software DEBE clasificar el caso antes de
  elegir solver, con los cuatro ejes del libro:
  1. **Continuo vs molecular libre** (λ ≪ d vs λ ~ d). Decisión de alcance literal: *"in this book we
     will always deal with continuum flow"* → la Forja también. Fuera de alcance declarado.
  2. **No viscoso vs viscoso.** *"Inviscid flows do not truly exist in nature"*, pero *"more than 70
     percent of this book (Chapters 3 to 14) deals primarily with inviscid flows."*
  3. **Incompresible vs compresible.**
  4. **Régimen de Mach.**
- **[compresible] [§1.10 p.64] (CONSTRUIR)** Umbrales, **todos declarados por el libro como "rule of
  thumb"** (no como verdad):
  - `M < 0.3` → *"it is always safe to assume ρ = constant"* (incompresible).
  - `M∞ < 0.8` → subsónico, *"for slender bodies"*. *"For blunt bodies, M∞ must be even lower."*
  - `0.8 < M∞ < 1.2` → transónico (*"as a rule of thumb for slender bodies"*).
  - `M∞ > 1.2` → supersónico. Advertencia literal: *"the listing of M∞ > 1.2 in Figure 1.44d is a
    very tenuous rule of thumb and should not be taken literally."*
  - `M∞ > 5` → hipersónico (*"a somewhat arbitrary but frequently used rule of thumb"*).
  → La UI debe mostrar el umbral **con su etiqueta de "regla de dedo"**, nunca como una frontera dura.
- **[compresible] [§1.10 p.65] (APRENDER)** La diferencia física que manda: *"In a supersonic flow,
  because the local flow velocity is greater than the speed of sound, disturbances created at some
  point in the flow cannot work their way upstream (in contrast to subsonic flow). This property is
  one of the most significant physical differences between subsonic and supersonic flows. It is the
  basic reason why shock waves occur in supersonic flows, but do not occur in steady subsonic flow."*
- **[compresible] [§1.10 p.64] (APRENDER — trampa de la UI)** *"a freestream Mach number M∞ less than
  1 does not guarantee a totally subsonic flow over the body."* → No etiquetar el caso por `M∞`
  solamente; el Mach **local** manda.

### 1.F — Capa límite y viscosidad

- **[viscoso] [§1.11 p.69] (CONSTRUIR)** Condición de **no deslizamiento**: *"due to friction the
  infinitesimally thin layer of air molecules immediately adjacent to the body surface sticks to the
  surface, thus it has zero velocity relative to the surface. This is the no-slip condition, and it
  is the cause of the large velocity gradients within the boundary layer."*
- **[viscoso] [§1.11 p.70] (CONSTRUIR — la simplificación que nos deja vivir)** *"It can be shown
  experimentally and theoretically that **the pressure through the boundary layer in a direction
  perpendicular to the surface is constant**… This is why the surface pressure distribution calculated
  for an inviscid flow gives accurate results for the real-life surface pressures."*
  **Rango de validez, literal:** *"The preceding statements are reasonable for thin boundary layers
  that remain attached to the body surface; **they do not hold for regions of separated flow**."*
  → Arquitectura: el solver potencial da `Cp(s)`; la capa límite lo consume, no lo corrige — **salvo
  que haya separación, y ahí el software DEBE avisar en vez de mentir.**
- **[viscoso] [§1.11 pp. 71–72] (CONSTRUIR)** `τw = μ·(dV/dy)|y=0` (Ec. 1.59) y
  `q̇w = −k·(dT/dy)|y=0` (Ec. 1.60). El signo menos en (1.60) es físico y va documentado.
- **[viscoso] [§1.11 p.74] (APRENDER)** Laminar vs turbulento con su consecuencia dura:
  `(τw)_laminar < (τw)_turbulento` y `(q̇w)_laminar < (q̇w)_turbulento`. Con el dato de magnitud:
  *"At hypersonic speeds, turbulent heat transfer rates can be almost a factor of 10 larger than
  laminar heat transfer rates—a showstopper in some hypersonic vehicle designs."*
- **[viscoso] [§1.11 p.68] (APRENDER)** Origen del arrastre de presión: *"when the flow separates
  from the surface, it dramatically changes the pressure distribution over the surface resulting in
  a large increase in drag called pressure drag."*

### 1.G — Estática de fluidos y flotación

- **[sizing] [§1.9 p.52] (CONSTRUIR)** Ecuación hidrostática (1.52): `dp = −g·ρ·dy`. Literal:
  *"Equation (1.52) governs the variation of atmospheric properties as a function of altitude in the
  air above us. It is also used to estimate the properties of other planetary atmospheres such as for
  Venus, Mars, and Jupiter."*
- **[sizing] [§1.9] (CONSTRUIR)** Para ρ constante: (1.53) `p2 − p1 = ρ·g·Δh` con `Δh = h1 − h2`;
  (1.54) `p + ρ·g·h = constante`. Pared de contenedor (1.55) `p = pa + ρ·g·(h1 − h)`. Manómetro en U
  (1.56) `pb = pa − ρ·g·Δh`. Flotación (1.57) `F = (p2 − p1)·l·(1)`, (1.58)
  `F = l·(1)·∫[h2→h1] ρ·g·dy`.
- **[sizing] [§1.9] (APRENDER)** Arquímedes: **fuerza de flotación = peso del fluido desplazado**, y
  el libro declara su generalidad: *"the Archimedes principle holds for bodies of any general shape…
  the Archimedes principle holds for both gases and liquids and does not require that the density be
  constant."*
- **[sizing] [§1.9] (DECISIÓN DE ALCANCE)** Literal: *"For most problems in aerodynamics, however,
  buoyancy force is so small that it can be readily neglected."* Con el factor: agua ρ=10³ kg/m³ vs
  aire ρ=1.23 kg/m³ → *"a given body will experience a buoyancy force a thousand times greater in
  water than in air. Obviously, for naval vehicles buoyancy force is all important, whereas for
  airplanes it is negligible."* → **La Forja NO incluye flotación en el balance de un avión.** Sí, en
  cambio, para dirigibles/globos (el Problema 1.12 sobre Zeppelins lo exige).
- **[sizing] [§1.9, Ej. 1.10] (CONSTRUIR)** Distinción **obligatoria** entre altitud **geométrica**
  `hG` y **geopotencial** `h`. Literal: *"we must make a distinction between the geometric altitude,
  hG, which is the actual 'tape measure' altitude above sea level, and the geopotential altitude, h,
  which is a slightly fictitious altitude consistent with the assumption of a constant value of g"*
  y *"when we use Equation (E1.5), or any other such equation assuming a constant value of g, we
  must use the geopotential altitude."* → **Divergencia detectada en nuestro código: ver §3, fixture
  `anderson-ej-1.10`, y §8 hallazgo 5.**

### 1.H — Núcleo del cap. 2: ecuaciones de gobierno

- **[aero2d/aero3d] [§2.3 pp. 119–121] (AMBOS)** El software DEBE ofrecer los **dos** modelos de
  fluido del libro, porque son dos vistas de UI distintas: **volumen de control finito** (fijo o
  moviéndose con el fluido) e **elemento infinitesimal**. El tercero (molecular) está declarado fuera
  de alcance: *"it is beyond the scope of the present book."*
- **[aero2d] [§2.3.4 p.123] (CONSTRUIR)** Interpretación física de la divergencia, Ecuación (2.32):
  `∇·V = (1/δV)·D(δV)/Dt` → *"∇·V is physically the time rate of change of the volume of a moving
  fluid element, per unit volume."* → Es una **magnitud visualizable**: el HUD puede mostrar "este
  paquete de aire se comprime a −73 %/s" (Ejemplo 2.1) en vez de un número sin significado.
- **[aero2d] [§2.4 p.128] (CONSTRUIR)** Flujo másico `ṁ = ρ·Vn·A` (2.43) y flujo másico específico
  `ρ·Vn` (2.44). Regla mnemónica literal del libro: *"Area × density × component of flow velocity
  normal to the area"*.
- **[aero2d] [§2.4 p.129] (CONSTRUIR — convención de normal, crítica)** *"by convention, **dS always
  points in a direction out of the control volume**. Hence, when V also points out of the control
  volume, the product ρV·dS is positive… a positive ρV·dS denotes an outflow… a negative ρV·dS
  denotes an inflow."* → La normal de cara en nuestra malla debe ser **saliente**, siempre, y el
  validador de geometría debe rechazar caras invertidas antes de integrar.
- **[aero2d] [§2.4 pp. 130–131] (CONSTRUIR)** Continuidad, forma integral (2.48) y diferencial (2.52);
  estacionaria (2.53) y (2.54). Supuestos declarados literales: *"the only assumption about the nature
  of the fluid is that it is a continuum. Therefore, Equations (2.48) and (2.52) hold in general for
  the three-dimensional, unsteady flow of any type of fluid, inviscid or viscous, compressible or
  incompressible."*
- **[aero2d] [§2.4 p.131] (DISCIPLINA DE INGENIERÍA — cítese en la escuela)** *"It is important to
  keep track of all assumptions that are used in the derivation of any equation because they tell you
  the limitations on the final result, and therefore prevent you from using an equation for a
  situation in which it is not valid. In all our future derivations, develop the habit of noting all
  assumptions that go with the resulting equations."* → **Requisito de producto:** cada resultado que
  la Forja emite debe cargar la lista de supuestos con los que se calculó. Es la regla #4 del CONTRATO
  dicha por el propio cliente.
- **[aero2d] [§2.5 pp. 132–137] (CONSTRUIR)** Momento: (2.64) integral, (2.70a–c) diferencial,
  (2.71) y (2.72a–c) para estacionario/no viscoso/sin fuerzas de cuerpo. Nomenclatura obligatoria:
  *"The momentum equations for an inviscid flow [such as Equations (2.72a to c)] are called the
  **Euler equations**. The momentum equations for a viscous flow [such as Equations (2.70a to c)] are
  called the **Navier-Stokes equations**."*
- **[aero2d] [§2.5 p.133] (CONSTRUIR)** Descomposición obligatoria de fuerzas: **de cuerpo** (`ρ·f·dV`,
  Ec. 2.57) y **de superficie** (presión `−∮p·dS`, Ec. 2.58, más `F_viscous`). El signo menos de la
  presión es físico: *"the control surface is experiencing a pressure force that is directed into the
  control volume… such an inward-directed force is in the direction opposite of dS."*
- **[compresible] [§2.7 pp. 146–151] (CONSTRUIR)** Energía: (2.95) integral, (2.96) diferencial,
  (2.97)/(2.98) para estacionario-no viscoso-adiabático-sin fuerzas de cuerpo. **Cuándo se necesita,
  literal:** *"For an incompressible flow, where ρ is constant, the primary flow-field variables are
  p and V. The continuity and momentum equations obtained earlier are two equations in terms of the
  two unknowns p and V. Hence, for a study of incompressible flow, the continuity and momentum
  equations are sufficient tools to do the job. However, for a compressible flow, ρ is an additional
  variable, and therefore we need an additional fundamental equation to complete the system."*
  → **Regla de enrutamiento del solver: incompresible = 2 ecuaciones; compresible = 5 ecuaciones
  (continuidad, momento, energía, `e = cv·T` (2.99), `p = ρ·R·T` (2.100)) para 5 incógnitas
  (ρ, p, V, e, T).** Ésa es la diferencia de costo entre los dos modos del producto.
- **[aero2d] [§2.7 p.150] (APRENDER — alcance)** *"For the aerodynamic problems considered in this
  book, shaft work is not treated, and changes in potential energy are always negligible."*

### 1.I — Derivada sustancial, líneas y vorticidad

- **[aero2d] [§2.9 p.154] (CONSTRUIR)** `D/Dt ≡ ∂/∂t + (V·∇)` (2.104), con los tres nombres del libro:
  **sustancial** (siguiendo al elemento), **local** (`∂/∂t`, punto fijo), **convectiva** (`V·∇`).
  → Dos widgets distintos en la UI: la sonda fija mide `∂/∂t`; el trazador mide `D/Dt`. Confundirlos
  es un error de física, no de estilo.
- **[aero2d] [§2.10 p.159] (CONSTRUIR)** Formas **conservativa** (divergencia) vs **no conservativa**
  (derivada sustancial). Requisito literal para el CFD: *"Both forms are equally valid statements of
  the fundamental principles, and in most cases, there is no particular reason to choose one form
  over the other… **However, for the numerical solution of some aerodynamic problems, the conservation
  form sometimes leads to more accurate results.** Hence, the distinction between the conservation form
  and the nonconservation form has become important in the modern discipline of computational fluid
  dynamics."* → Nuestro solver numérico usa forma **conservativa**; la escuela explica en la **no
  conservativa** (que es la que se lee como física).
- **[aero2d] [§2.11 pp. 160–165] (CONSTRUIR)** Tres curvas distintas y su criterio de igualdad:
  **pathline** (trayectoria de una partícula), **streamline** (tangente a V en cada punto),
  **streakline** (*"the locus of fluid elements that have earlier passed through a prescribed
  point"* — la línea de humo/tinta). Regla: *"For a steady flow, pathlines, streamlines, and
  streaklines are all the same curves. Only in an unsteady flow are they different."*
  Ecuaciones: `ds × V = 0` (2.115) → (2.117a–c); en 2D, `dy/dx = v/u` (2.118).
- **[aero2d] [§2.11 p.164] (CONSTRUIR)** **Tubo de corriente**: *"For a steady flow, a direct
  application of the integral form of the continuity equation proves that the mass flow across all
  cross sections of a streamtube is constant."* → Invariante testeable del visualizador.
- **[aero2d] [§2.12 pp. 168–169] (CONSTRUIR)** Velocidad angular (2.127), **vorticidad `ξ ≡ 2ω`** y el
  resultado clave (2.129): `ξ = ∇×V`. Definiciones operativas: `∇×V ≠ 0` → **rotacional**;
  `∇×V = 0` → **irrotacional**. En 2D, condición de irrotacionalidad (2.131): `∂v/∂x − ∂u/∂y = 0`.
- **[viscoso] [§2.12 p.174] (APRENDER — regla dura)** *"viscous flows are rotational."* Demostrado en
  el Ejemplo 2.6 y argumentado físicamente en la Figura 2.37.
- **[aero2d] [§2.12 p.176] (APRENDER — el teorema que nos deja precomputar campos potenciales)**
  *"A flow field that is originally irrotational, without any internal mechanisms such as frictional
  shear stress to generate vorticity, will remain irrotational throughout."* Es el enunciado
  cualitativo del teorema de Kelvin; **la forma formal (Kelvin's Circulation Theorem, DΓ/Dt = 0) NO
  está en los caps. 1–2: está en §4.6, pp. 342–346.** Ver §7 y §8.
- **[aero2d] [§2.13 p.176] (CONSTRUIR — SIGNO CRÍTICO)** `Γ ≡ −∮_C V·ds` (2.136). El signo menos es
  **deliberado**: *"by mathematical convention the positive sense of the line integral is
  counterclockwise. However, in aerodynamics, it is convenient to consider a positive circulation as
  being clockwise. Hence, a minus sign appears in the definition."* Con la advertencia de
  interoperabilidad, literal en nota al pie: *"Some books do not use the minus sign in the definition
  of circulation. In such cases, the positive sense of both the line integral and Γ is in the same
  direction. This causes no problem as long as the reader is aware of the convention used in a
  particular book or paper."* → **La API debe fijar la convención de Anderson y decirlo en el nombre
  del símbolo.** Ver §3 fixture `anderson-ej-2.8` y §8 hallazgo 4.
- **[aero2d] [§2.13 p.177] (APRENDER — antídoto de un malentendido)** *"It does not necessarily mean
  that the fluid elements are moving around in circles within this flow field—a common early
  misconception of new students of aerodynamics. Rather, when circulation exists in a flow, it simply
  means that the line integral in Equation (2.136) is finite."* → **Requisito de la escuela:** la
  animación de circulación NO debe mostrar aire dando vueltas alrededor del perfil.
- **[aero2d] [§2.13 pp. 177–178] (CONSTRUIR)** Puente Stokes: `Γ = −∮V·ds = −∬(∇×V)·dS` (2.137) y,
  en el límite, `(∇×V)·n = −dΓ/dS` (2.138) → *"the component of vorticity normal to dS is equal to the
  negative of the 'circulation per unit area'."* Consecuencia inmediata y testeable: **flujo
  irrotacional dentro del contorno → Γ = 0.**
- **[aero2d] [§2.14 pp. 179–182] (CONSTRUIR)** Función de corriente. `ψ̄ = constante` es una línea de
  corriente; `Δψ̄` entre dos líneas **es el flujo másico** entre ellas (por unidad de profundidad,
  kg/(s·m)). Compresible: (2.147a,b) `ρu = ∂ψ̄/∂y`, `ρv = −∂ψ̄/∂x`; polares (2.148a,b).
  Incompresible `ψ ≡ ψ̄/ρ`: (2.150a,b) `u = ∂ψ/∂y`, `v = −∂ψ/∂x`; polares (2.151a,b); **unidades m²/s
  = caudal volumétrico** por unidad de profundidad. Restricción dura: *"The stream function is valid
  for both rotational and irrotational flows, but it is restricted to two-dimensional flows only."*
  (Nota al pie: también sirve para flujos **axisimétricos**, p. 184.)
- **[aero2d/aero3d] [§2.15 pp. 183–184] (CONSTRUIR)** Potencial de velocidad `V = ∇φ` (2.154), en
  cartesianas (2.156), cilíndricas (2.157) y esféricas (2.158). Las **tres diferencias** con ψ, literales:
  1. *"The flow-field velocities are obtained by differentiating φ in the same direction as the
     velocities, whereas ψ̄ (or ψ) is differentiated normal to the velocity direction."*
  2. *"The velocity potential is defined for **irrotational flow only**. In contrast, the stream
     function can be used in either rotational or irrotational flows."*
  3. *"The velocity potential applies to **three-dimensional** flows, whereas the stream function is
     defined for two-dimensional flows only."*
- **[optimizacion] [§2.15 p.184] (CONSTRUIR — la razón económica del producto)** *"When a flow field
  is irrotational, hence allowing a velocity potential to be defined, there is a tremendous
  simplification. Instead of dealing with the velocity components (say, u, v, and w) as unknowns,
  hence requiring three equations for these three unknowns, we can deal with the velocity potential
  as one unknown, therefore requiring the solution of only one equation for the flow field."*
  → **3 incógnitas → 1.** Ésta es la línea que justifica que el laboratorio de la Forja corra flujo
  potencial en el navegador en tiempo real. *"Because irrotational flows can be described by the
  velocity potential φ, such flows are called potential flows."*
- **[aero2d] [§2.16 p.186] (CONSTRUIR — invariante de dibujo)** Líneas equipotenciales (`φ = cte`) y
  líneas de corriente (`ψ = cte`) son **mutuamente perpendiculares** en flujo 2D irrotacional,
  Ecuación (2.165): `(dy/dx)_ψ = −1/(dy/dx)_φ`. → Test visual automático de la malla de flujo: si
  la retícula no es ortogonal, el campo está mal.

### 1.J — El kit vectorial (§2.2) como especificación de operadores

- **[geometria] [§2.2.2 p.109] (CONSTRUIR)** El motor DEBE soportar los tres sistemas ortogonales del
  libro con sus transformaciones literales: cartesiano; cilíndrico `(r, θ, z)` con (2.5)/(2.6);
  esférico `(r, θ, Φ)` con (2.7)/(2.8). Definición: *"An orthogonal coordinate system is one where
  all three coordinate directions are mutually perpendicular."*
- **[optimizacion] [§2.2.2 p.109] (APRENDER — aviso para el mallador)** *"some modern numerical
  solutions of fluid flows utilize nonorthogonal coordinate spaces; moreover, for some numerical
  problems the coordinate system is allowed to evolve and change during the course of the solution.
  These so-called **adaptive grid techniques** are beyond the scope of this book."* → Declarado fuera
  de alcance por el cliente. Si algún día lo hacemos, es `[EXTENSIÓN DECLARADA]`.
- **[aero2d/aero3d] [§2.2.5–§2.2.7 pp. 113–116] (CONSTRUIR)** Los tres operadores en los tres
  sistemas, con su número de ecuación (fórmulas completas en §2.11 de este pliego): gradiente
  (2.16)(2.17)(2.18); divergencia (2.19)(2.20)(2.21); rotacional (2.22)(2.23)(2.24). **(2.23) y
  (2.24) el libro solo las da como determinante, sin expandir** — expandirlas es trabajo nuestro.
- **[aero2d] [§2.2.5 p.113] (CONSTRUIR)** Derivada direccional (2.15): `dp/ds = ∇p · n`, con la
  propiedad: *"the rate of change of p in any arbitrary direction is simply the component of ∇p in
  that direction."* Y la definición del gradiente en dos puntos literales: *"1. Its magnitude is the
  maximum rate of change of p per unit length of the coordinate space at the given point. 2. Its
  direction is that of the maximum rate of change of p at the given point."* Más el invariante de
  dibujo del que sale la Ec. (2.165): *"The gradient line and isoline through any given point in the
  coordinate space are perpendicular."*
- **[geometria] [§2.2.8 p.116] (CONSTRUIR — convención de TANGENTE y de sentido)** Integral de línea:
  *"let ds be an elemental length of the curve, and **n be a unit vector tangent to the curve**.
  Define the vector ds = n ds."* Sentido positivo: *"the counterclockwise direction around C is
  considered positive. (The positive direction around a closed curve is, by convention, that direction
  you would move such that the area enclosed by C is always on your left.)"* → **Es exactamente la
  convención que hace falta el signo menos en `Γ ≡ −∮V·ds` (2.136).**
- **[geometria] [§2.2.9 p.117] (CONSTRUIR — convención de NORMAL, la más crítica del pliego)**
  Superficie **abierta** acotada por C: *"n be a unit vector normal to the surface. The orientation of
  n is in the direction according to the **right-hand rule** for movement along C… Define a vector
  elemental area as **dS = n dS**."* Superficie **cerrada**: *"**n points out of the surface, away from
  the enclosed volume**."* → El validador de mallas de la Forja debe comprobar ambas cosas: normales
  salientes en cuerpos cerrados, y coherencia mano-derecha entre el borde y la superficie en tapas
  abiertas. Con `∬p dS` el resultado es **vector**; con `∬A·dS` es **escalar**; con `∬A×dS` es vector.
- **[aero2d] [§2.2.11 p.119] (CONSTRUIR)** Los tres teoremas, con su número:
  Stokes `∮_C A·ds = ∬_S (∇×A)·dS` (2.25); divergencia `∯_S A·dS = ∭_V (∇·A) dV` (2.26);
  gradiente `∯_S p dS = ∭_V ∇p dV` (2.27). Anderson **no** llama "de Gauss" al segundo: lo llama
  *"the divergence theorem"*. Los tres se usan literalmente en las derivaciones de §2.3 a §2.13.
- **[aero2d] [§2.2.3 p.112] (CONSTRUIR — define las incógnitas del solver)** *"In many theoretical
  aerodynamic problems, the above scalar and vector fields are **the unknowns to be obtained in a
  solution** for a flow with prescribed initial and boundary conditions."*

### 1.K — Magnitudes típicas: los sanity-checks del software (§1.12)

Anderson abre §1.12 con el criterio de aceptación en forma de pregunta: *"It is important for you to
obtain a feeling for typical values of the aerodynamic coefficients. **(For example, do you expect a
drag coefficient to be as low as 1e−5, or maybe as high as 1000—does this make sense?)**"*
→ **Requisito:** la Forja DEBE tener un validador de rangos que avise (no bloquee) cuando un
resultado se sale de estos órdenes de magnitud, todos literales del libro:

- **[aero2d] [§1.12 p.76] (CONSTRUIR)** `CD` de cuerpos romos, referido al **área frontal** `S = d·(1)`,
  incompresible: placa plana perpendicular = **2.0** (*"the largest possible drag coefficient of any
  conventional configuration"*); cilindro circular a `Re ≈ 1e5` = **1.2**; cuerpo aerodinámico de
  espesor `d` = **0.12**; cilindro a `Re ≈ 1e7` = **0.6**. Rango declarado: *"the values of CD range
  from a maximum of 2 to numbers as low as 0.12. **These are typical values of CD for aerodynamic
  bodies.**"*
- **[aero2d] [§1.12 p.76] (CONSTRUIR — invariante testeable)** *"It will be shown in Chapter 3 that
  CD for a circular cylinder is **relatively independent of Re between Re = 1e4 and 1e5**."*
- **[viscoso] [§1.12 p.80] (CONSTRUIR)** `Cf` de placa plana referido al **área en planta**
  `S = c·(1)`: *"The magnitudes of Cf range typically from **0.001 to 0.01** over a large range of Re.
  These numbers are considerably smaller than the drag coefficients listed in Figure 1.54. **This is
  mainly due to the different reference areas used.**"* Con las tres reglas: `Cf` baja al subir `Re`;
  `Cf` turbulento > `Cf` laminar al mismo `Re`.
- **[aero2d] [§1.12 p.82] (CONSTRUIR)** Perfil: `cd` típico **0.004 a 0.006** (mínimo del NACA 63-210
  = **0.0045** a `Re = 3e6`); `cl` de **−1.0 a 1.5** en `α` de −12° a 14°, con máximo cerca de
  **α = 14°**; `cm_c/4` **del orden de −0.035**, y siempre negativo: *"**all conventional airfoils
  produce negative, or 'pitch-down,' moments**."*
- **[aero2d] [§1.12 p.82] (CONSTRUIR — el sanity-check de una línea)**
  ***"For an airfoil, the magnitude of cl is about a factor of 100 larger than cd."***
- **[performance] [§1.12 pp. 78, 84] (CONSTRUIR)** `CD` de avión completo, referido al **área en
  planta del ala**: **0.0166** (Seversky XP-41 en configuración limpia, `CL = 0.15`) → **0.0275**
  en configuración operacional, *"increased by more than 65 percent"*. Veredicto literal:
  *"**This is a typical airplane drag-coefficient value.**"* Caza moderno (T-38) a bajo subsónico:
  `CD ≈ 0.015`, *"considerably lower than the 1930s-type airplane"*.
- **[compresible] [§1.12 p.84] (CONSTRUIR)** *"the value of CD is relatively constant from M = 0.1 to
  about 0.86. At Mach numbers of about 0.86, the CD rapidly increases. **This large increase in CD
  near Mach one is typical of all flight vehicles.**"*
- **[performance] [§1.12 pp. 83–86] (CONSTRUIR — la tabla de L/D que la escuela necesita)**
  perfil NACA 63-210 a α=4° (`cl=0.6`, `cd=0.0046`) → **L/D = 130**; Northrop T-38 → *"about 10"*;
  Boeing B-52 → **21.5**. Con la razón física: fuselaje y góndolas dan poca sustentación y mucho
  arrastre, y las puntas del ala añaden **arrastre inducido** (*"for short, stubby wings, such as on
  the T-38, the induced drag can be large"*). → **Cruza con el §1.16: `L/D` de perfil (110–130) vs de
  avión (10–21.5) es un factor de 10.** El software debe impedir que se comparen.
- **[aero2d] [§1.12 p.77] (CONSTRUIR)** Descomposición del arrastre, Ecuación (1.62), con las dos
  definiciones **duras** del libro: ***"Blunt body = a body where most of the drag is pressure drag"***
  y ***"Streamlined body = a body where most of the drag is skin friction drag"***. Y el término:
  *"the pressure drag… is more precisely denoted as 'pressure drag due to flow separation'; this drag
  is frequently called **form drag**."*
- **[aero2d] [§1.12 p.76] (APRENDER — la identidad del carenado)** El arrastre de un cuerpo
  aerodinámico **10 veces más grueso** que un cilindro es **el mismo**:
  `D' = 0.12·q∞·d` en ambos casos. *"another way of stating the aerodynamic value of streamlining."*
- **[viscoso] [§1.12 p.76] (CONSTRUIR)** Orden de magnitud del Reynolds real: cilindro de `d = 1 m`
  a `V∞ = 45 m/s` a nivel del mar → `Re = 3.09e6`. *"**values of Re in the millions are typical of
  practical applications in aerodynamics.**"* → El eje `Re` de la tabla precomputada debe cubrir
  `1e5`–`1e8`, no `1e2`–`1e4`.

### 1.L — Arrastre por levantamiento de estela (§2.6) — un método MEDIBLE

- **[viscoso/aero2d] [§2.6 pp. 137–146] (CONSTRUIR)** Implementar el **wake survey**: el arrastre 2D
  se obtiene del déficit de cantidad de movimiento aguas abajo, **sin tocar el cuerpo**.
  Compresible (2.83): `D' = ∫ ρ2·u2·(u1 − u2) dy`. Incompresible (2.84): `D' = ρ·∫ u2·(u1 − u2) dy`.
  Interpretación literal: *"the integral in Equation (2.83) is physically the **decrement in momentum
  flow that exists across the wake**, and from Equation (2.83), this wake momentum decrement is equal
  to the drag on the body."*
- **[viscoso] [§2.6 p.146] (APRENDER)** *"Equation (2.84) is the answer to the questions posed at the
  beginning of this section. It shows how a **measurement of the velocity distribution across the wake**
  of a body can yield the drag."* Instrumento real: **Pitot rake** (*"a series of Pitot tubes attached
  to a common stem, which allows the simultaneous measurement of velocity across the wake"*).
- **[aero2d] [§2.6 p.146] (APRENDER — la moraleja de arquitectura)** *"The result embodied in
  Equation (2.84) illustrates the power of the integral form of the momentum equation; **it relates
  drag on a body located at some position in the flow to the flow-field variables at a completely
  different location.**"*
- **[aero2d] [§2.6.1 p.146] (RESTRICCIÓN DURA — ver §8, hallazgo 12)** El volumen de control finito
  es **unidireccional**: detalle del campo → cantidad global es exacto; cantidad global → detalle del
  campo **no queda determinado**. Cita completa en §2.12 de este pliego. → **El software NO debe
  invertir la Ec. (2.84) para inferir perfiles de estela.**
- **[aero2d] [§2.6 p.137] (APRENDER — precedente del cliente)** Así midió la NACA en los 30–40:
  *"the lift was obtained from the pressure distributions on the ceiling and floor of the tunnel
  (above and below the wing), and **the drag was obtained from measurements of the flow velocity
  downstream of the wing**."* La fórmula análoga para sustentación **no se da**: *"the derivation is
  left as a homework problem"* (Problema 2.2).

### 1.M — Cómo se resuelven las ecuaciones (§2.17) — la arquitectura de solvers

- **[optimizacion] [§2.17.1 p.187] (APRENDER — el veredicto)** *"The governing equations of
  aerodynamics… are **highly nonlinear, partial differential, or integral equations; to date, no
  general analytical solution to these equations has been obtained.**"* → Todo lo que sigue en el
  producto son **soluciones simplificadas** o **soluciones numéricas**. No hay tercera vía.
- **[optimizacion] [§2.17.1 p.187] (CONSTRUIR)** Dos rutas analíticas legítimas, con su etiqueta:
  1. **Exacta por reducción dimensional** — el choque normal 1D: *"the resulting one-dimensional
     equations, **which are still exact for the one-dimensional case being considered**, lend
     themselves to a direct analytical solution."*
  2. **Aproximada por linealización** — el perfil delgado compresible: *"If the airfoil is thin and at
     a small angle of attack, and if the freestream Mach number is not near one (not transonic) nor
     above five (not hypersonic), then many of the terms… are small compared to others and can be
     neglected. **The resulting simplified equations are linear and can be solved analytically.**"*
  → La UI debe distinguir estos dos casos: uno no tiene error de modelo, el otro sí, **con rango de
  validez explícito** (`M∞` fuera de transónico e hipersónico, `α` pequeño, perfil delgado).
- **[escuela] [§2.17.1 pp. 188–189] (APRENDER — por qué la Forja conserva solvers analíticos)** Las
  tres ventajas, literales: *"1. The act of developing these solutions puts you in intimate contact
  with all the physics involved in the problem. 2. The results, usually in closed form, give you
  direct information on what are the important variables, and how the answers vary with increases or
  decreases in these variables. 3. Finally, the results in closed form provide simple tools for rapid
  calculations, making possible the proverbial **'back of the envelope calculations' so important in
  the preliminary design process** and in other practical applications."* → **El punto 3 es
  literalmente el hueco de mercado del CONTRATO**: diseño conceptual, no de producción.
- **[optimizacion] [§2.17.2 p.189] (CONSTRUIR)** Definición operativa de CFD, citada por el propio
  autor: *"the art of replacing the integrals or the partial derivatives… with **discretized algebraic
  forms**, which in turn are solved to obtain numbers for the flow field values at discrete points in
  time and/or space."* Y qué gana: *"**The beauty of CFD is that it can deal with the full nonlinear
  equations of continuity, momentum, and energy, in principle, without resorting to any geometrical
  or physical approximations.**"*
- **[optimizacion] [§2.17.2 p.190] (CONSTRUIR — restricción de la UI)** *"The flow field properties…
  are calculated **just at the discrete grid points, and nowhere else**… This is an inherent property
  that distinguishes CFD solutions from closed-form analytical solutions."* → Cualquier valor que la
  UI muestre entre nodos **es interpolación nuestra**, y debe estar rotulado como tal.
- **[optimizacion] [§2.17.2 p.190] (CONSTRUIR — regla de mallado subsónico)** *"This large extension
  of the grid into the main stream of the flow is necessary for a subsonic flow, **because disturbances
  in a subsonic flow physically feed out large distances away from the body**."* Más el refinamiento
  local: *"a very large number of closely spaced grid points near the airfoil, **for better definition
  of the viscous flow near the airfoil**."* → Dos reglas de mallado directamente implementables.
- **[optimizacion] [§2.17.2 pp. 191–194] (CONSTRUIR — orden de exactitud)** Diferencias adelantada
  (2.168) y atrasada (2.171) son de **primer orden**; centrada (2.174) es de **segundo orden**.
  Requisito literal: *"**In most CFD solutions, first-order accuracy is not good enough; we need a
  discretization that has at least second-order accuracy**… **For most CFD solutions, second-order
  accuracy is sufficient.**"*
- **[optimizacion] [§2.17.2 p.194] (CONSTRUIR — la bifurcación de familias)** *"**Taylor series have
  been used to obtain these discrete forms. Such Taylor series expressions are the basic foundation of
  finite-difference solutions in CFD.** In contrast, if the integral form of the governing flow
  equations are used, such as Equations (2.48) and (2.64), the individual integral terms can be
  discretized, leading again to algebraic equations that are the **basic foundation of finite-volume
  solutions in CFD**."* → **Nuestro pipeline sobre B-Rep debería ser volúmenes finitos**, porque la
  geometría del alumno es de caras, no de una retícula estructurada.
- **[optimizacion] [§2.17.2 p.196] (DECLARAR EN LA UI — la advertencia del cliente)** *"**do not be
  misled. Computational fluid dynamics is a sophisticated and complex discipline.** For example, we
  have said nothing here about the accuracy of the final solutions, whether or not a certain
  computational technique will be **stable** (some attempts at obtaining numerical solutions will go
  unstable—blow up—during the course of the calculations), and **how much computer time** a given
  technique will require… **The generation of an appropriate grid for a given flow problem is
  frequently a challenge, and grid generation has emerged as a subdiscipline in its own right within
  CFD.** For these reasons, CFD is usually taught only in graduate-level courses."* → **Tres cosas que
  el producto tiene que exponer y que ningún CAD comercial expone bien: exactitud, estabilidad y costo
  del caso.** Y el mallado no es un botón.
- **[escuela] [§2.17.3 p.196] (APRENDER)** *"**CFD is today an equal partner with pure theory and pure
  experiment** in the analysis and solution of aerodynamic problems… they do not stand alone, but
  rather help each other to continue to resolve and better understand the 'big picture' of
  aerodynamics."* La frase *"third dimension"* que se cita a menudo **NO está en §2.17**: está en el
  **Prefacio** y en **§13.1, p. 830** (fuera de este bloque). No atribuirla a §2.17.

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

### 2.1 Las variables de campo (§1.4, pp. 15–18)

| Magnitud | Definición del libro | Naturaleza | Nota |
|---|---|---|---|
| Presión `p` | `p = lim(dF/dA)`, `dA→0` | escalar, **de punto** | *"the normal force per unit area exerted on a surface due to the time rate of change of momentum of the gas molecules impacting on (or crossing) that surface"* |
| Densidad `ρ` | `ρ = lim(dm/dv)`, `dv→0` | escalar, de punto | |
| Temperatura `T` | `KE = (3/2)·k·T` (k = Boltzmann) | escalar, de punto | proporcional a la energía cinética molecular media |
| Velocidad `V` | *"the velocity of an infinitesimally small fluid element as it sweeps through B"* | **vector**, de punto | contrasta con la de un sólido, donde todo el cuerpo va igual |
| Cortante `τ` | `τ = lim(dFf/dA)`, `dA→0`; `τ = μ·dV/dy` | escalar, de punto | actúa **tangencial** a la línea de corriente |

**Rango de validez del límite:** el propio libro pone la nota al pie: *"Strictly speaking, dA can
never achieve the limit of zero, because there would be no molecules at point B in that case. The
above limit should be interpreted as dA approaching a very small value, near zero in terms of our
macroscopic thinking, but sufficiently larger than the average spacing between molecules on a
microscopic basis."* → **Qué se rompe fuera:** en el límite de flujo molecular libre (λ ~ tamaño del
cuerpo, §1.10.1) `p`, `ρ`, `T` **dejan de estar definidos como propiedades de punto**. Nuestro
software solo vive en régimen continuo.

**τ = μ·dV/dy — supuesto:** *"For the type of gases and liquids of interest in aerodynamic
applications, the value of the shear stress at a point on a streamline is proportional to the spatial
rate of change of velocity normal to the streamline at that point."* Es decir: **fluido newtoniano**.
Y `μ` no es constante: *"In reality, μ is not really a constant; it is a function of the temperature
of the fluid."* Para líquidos `μ` **baja** con T; para gases **sube** con T. Valor de referencia,
aire a nivel del mar estándar (§1.11, p. 72): `μ = 1.7894e−5 kg/(m·s) = 3.7373e−7 slug/(ft·s)`;
`k = 2.53e−2 J/(m·s·K) = 3.16e−3 lb/(s·°R)`, con `k ≈ constante × μ`.

**Unidades (§1.4.1, Tabla 1.1, p. 18):** SI (N, kg, m, s, K) e inglés de ingeniería
(lb, slug, ft, s, °R). Requisito literal: *"When a consistent set of units is used, physical
relationships are written without the need for conversion factors in the basic formulas; they are
written in the pure form intended by nature."* → El software trabaja **solo** en unidades
consistentes internamente; la conversión vive en la frontera de la UI. El libro insiste en que el
ingeniero sea *"bilingual in these units"* — el Ejemplo 1.7 tropieza a propósito con mph vs ft/s
(`88 ft/s = 60 mph`).

### 2.2 LA integral de superficie (§1.5, pp. 19–26) — desarrollo completo

**Geometría (Figuras 1.18, 1.19, 1.22).** Cuerda horizontal; `x` paralelo y `y` perpendicular a la
cuerda; viento relativo inclinado el ángulo de ataque `α`. `su` = arco desde el borde de ataque sobre
el **extradós**, `sl` sobre el **intradós**. En cada punto, `p` es normal a la superficie e inclinada
`θ` respecto de la perpendicular; `τ` es tangente e inclinada `θ` respecto de la horizontal.
**Signo de θ: positivo medido en sentido HORARIO** (de la vertical hacia p, de la horizontal hacia τ).
Elemento de superficie: `dS = ds·(1)` — envergadura unitaria.

**Contribuciones elementales (Ecs. 1.3–1.6, p. 22):**

```
extradós:   dN' = −pu·dsu·cosθ − τu·dsu·sinθ            (1.3)
            dA' = −pu·dsu·sinθ + τu·dsu·cosθ            (1.4)
intradós:   dN' = +pl·dsl·cosθ − τl·dsl·sinθ            (1.5)
            dA' = +pl·dsl·sinθ + τl·dsl·cosθ            (1.6)
```

**Integrales totales, por unidad de envergadura (Ecs. 1.7, 1.8, p. 22):**

```
N' = −∫[LE→TE] (pu·cosθ + τu·sinθ) dsu + ∫[LE→TE] (pl·cosθ − τl·sinθ) dsl      (1.7)
A' =  ∫[LE→TE] (−pu·sinθ + τu·cosθ) dsu + ∫[LE→TE] (pl·sinθ + τl·cosθ) dsl     (1.8)
```

**Momento respecto al borde de ataque (Ec. 1.11, p. 23):**

```
M'_LE = ∫[LE→TE] [ (pu·cosθ + τu·sinθ)·x − (pu·sinθ − τu·cosθ)·y ] dsu
      + ∫[LE→TE] [ (−pl·cosθ + τl·sinθ)·x + (pl·sinθ + τl·cosθ)·y ] dsl        (1.11)
```
con `y` **positivo arriba de la cuerda y negativo abajo**.

**Paso a lift/drag (Ecs. 1.1, 1.2, p. 20):** `L = N·cosα − A·sinα`, `D = N·sinα + A·cosα`. Válidas
tanto para el cuerpo completo (sin prima) como por unidad de envergadura (con prima).

**Forma en coeficientes (Ecs. 1.12–1.17, pp. 25–26).** Con `dx = ds·cosθ` (1.12),
`dy = −ds·sinθ` (1.13) y `S = c·(1)` (1.14):

```
cn = (1/c)·∫[0→c] (Cp,l − Cp,u) dx + (1/c)·∫[0→c] ( cf,u·dyu/dx + cf,l·dyl/dx ) dx      (1.15)
ca = (1/c)·∫[0→c] ( Cp,u·dyu/dx − Cp,l·dyl/dx ) dx + (1/c)·∫[0→c] (cf,u + cf,l) dx      (1.16)
cm_LE = (1/c²)·∫[0→c] (Cp,u − Cp,l)·x dx − (1/c²)·∫[0→c] ( cf,u·dyu/dx + cf,l·dyl/dx )·x dx
      + (1/c²)·∫[0→c] ( Cp,u·dyu/dx + cf,u )·yu dx + (1/c²)·∫[0→c] ( −Cp,l·dyl/dx + cf,l )·yl dx  (1.17)
cl = cn·cosα − ca·sinα     (1.18)
cd = cn·sinα + ca·cosα     (1.19)
```

Advertencia del libro al evaluar: *"keep in mind that yu is directed above the x axis, and hence is
positive, whereas yl is directed below the x axis, and hence is negative. Also, dy/dx on both the
upper and lower surfaces follow the usual rule from calculus."*

**Supuestos y rango de validez de (1.15)–(1.17):**
- Cuerpo **bidimensional** (o sección de cilindro infinito de sección uniforme). **NO usar en 3D**
  (el propio Ejemplo 1.2 lo prohíbe explícitamente).
- La superficie debe ser **una función `y(x)` de una sola valuación por rama** (extradós/intradós)
  para que `dy/dx` exista. **Qué se rompe fuera:** una base vertical (culata de la cuña del Ej. 1.1)
  tiene `dy/dx → ∞` y **no es integrable en esta forma**; hay que usar la forma dimensional (1.7)/(1.8)
  o apoyarse en que `Cp = 0` ahí. Ver §8, hallazgo 3.
- No hay ningún supuesto sobre viscosidad, compresibilidad o régimen: **estas integrales son exactas
  siempre**, si conoces `p(s)` y `τ(s)`. Lo difícil nunca fue la integral: es conocer `p` y `τ`.

### 2.3 Coeficientes (§1.5, pp. 24–25) — definiciones literales

```
q∞ ≡ ½·ρ∞·V∞²                          [Pa o lb/ft²]
CL ≡ L/(q∞·S)     CD ≡ D/(q∞·S)     CN ≡ N/(q∞·S)     CA ≡ A/(q∞·S)
CM ≡ M/(q∞·S·l)
cl ≡ L'/(q∞·c)    cd ≡ D'/(q∞·c)    cm ≡ M'/(q∞·c²)          [S = c·(1) = c]
Cp ≡ (p − p∞)/q∞          cf ≡ τ/q∞
```

**Referencias por forma (explícitas en el libro, Figura 1.21):** ala de avión → `S` = **área en
planta**, `l` = **cuerda media**. Esfera → `S` = **área de sección transversal**, `l` = **diámetro**.
Cono (Ej. 1.2) → `S` = **área de la base** `Sb = π·rb²`. Cilindro (Ej. 1.5) → `S = π·d²/4`.

**Qué se rompe fuera:** comparar dos `CD` con `S` distintas. El Ejemplo 1.2 lo hace evidente: para el
cono, `CD` referido a la base **es igual a `Cp`** — un resultado que solo es cierto con esa `S`.

### 2.4 Buckingham Pi y los parámetros de similitud (§1.7, pp. 34–41)

**Enunciado literal del teorema (p. 36):** con `K` = número de dimensiones fundamentales
(en mecánica, masa/longitud/tiempo → `K = 3`) y `N` variables físicas en `f1(P1…PN) = 0` (1.24),
la relación se reexpresa como `f2(Π1…Π(N−K)) = 0` (1.25), donde cada `Π` combina las `K` variables
repetidas más una. Restricciones del propio teorema: *"The choice of the repeating variables… should
be such that they include all the K dimensions used in the problem. Also, the dependent variable
should appear in only one of the Π products."*

**Aplicación (p. 37):** `R = f(ρ∞, V∞, c, μ∞, a∞)` (1.23), `N = 6`, `K = 3`. Dimensiones:
`[R] = m·l·t⁻²`, `[ρ∞] = m·l⁻³`, `[V∞] = l·t⁻¹`, `[c] = l`, `[μ∞] = m·l⁻¹·t⁻¹`, `[a∞] = l·t⁻¹`.
Variables repetidas elegidas: `ρ∞, V∞, c`. Resultado:

```
Π1 = R/(ρ∞·V∞²·c²)  →  redefinido  Π1 = R/(½·ρ∞·V∞²·S) = R/(q∞·S) = CR   (1.32)(1.33)
Π2 = ρ∞·V∞·c/μ∞ ≡ Re                                                       (1.35)
Π3 = V∞/a∞ ≡ M                                                             (1.37)
⇒  CR = f(Re, M∞)                                                          (1.38)
⇒  CL = f(Re, M∞, α),  CD = f(Re, M∞, α),  CM = f(Re, M∞, α)              (1.42)–(1.44)
```

**Rango de validez:** las (1.42)–(1.44) **suponen una forma de cuerpo dada** (*"Equations (1.42) to
(1.44) assume a given body shape"*). **Qué se rompe fuera:** si la geometría cambia (aunque sea el
espesor relativo), la función cambia; no es la misma tabla. Y si el problema incluye termodinámica o
transferencia de calor, faltan parámetros (`γ`, `Tw/T∞`, `Pr`) y la relación de dos variables es
insuficiente.

**Los tres criterios de similitud dinámica y los dos criterios para lograrla** están citados
literalmente en §1.B/§1.D. La consecuencia comercial, literal (§1.8, p. 41): *"This is a key point in
the validity of wind-tunnel testing. If a scale model of a flight vehicle is tested in a wind tunnel,
the measured lift, drag, and moment coefficients will be the same as for free flight as long as the
Mach and Reynolds numbers of the wind-tunnel test-section flow are the same as for the free-flight
case."*

**Y el límite práctico (p. 44), que es el corazón del Ejemplo 1.6:** simular `M` y `Re`
simultáneamente en el mismo túnel es carísimo. Literal: *"Today, for the most part, we do not attempt
to simulate all the parameters simultaneously; rather, Mach number simulation is achieved in one wind
tunnel, and Reynolds number simulation in another tunnel. The results from both tunnels are then
analyzed and correlated to obtain reasonable values for CL and CD appropriate for free flight."*
→ **Es exactamente lo que nuestro precómputo puede hacer gratis y el túnel no: barrer los dos ejes.**

### 2.5 Vuelo nivelado — el puente a `performance` (Design Box §1.8, pp. 46–51)

```
L = W ,  T = D            (vuelo nivelado no acelerado)
CL = W/(q∞·S) = 2W/(ρ∞·V∞²·S)                       (1.45)
V∞ = sqrt( 2W/(ρ∞·S·CL) )                            (1.46)
V_stall = sqrt( 2W/(ρ∞·S·CL,max) )                   (1.47)
CD = D/(q∞·S) = T/(q∞·S) = 2T/(ρ∞·V∞²·S)             (1.48)
V∞ = sqrt( 2T/(ρ∞·S·CD) )                            (1.49)
V_max = sqrt( 2·T_max/(ρ∞·S·CD,min) )                (1.50)
L/D = (q∞·S·CL)/(q∞·S·CD) = CL/CD                    (1.51)
```

**Rango de validez:** vuelo **estacionario y nivelado**, `L = W` y `T = D`. **Qué se rompe fuera:**
maniobra, ascenso, aceleración. Además la nota al pie del libro acota `V_stall`: *"The lowest velocity
may instead be dictated by the power required to maintain level flight exceeding the power available
from the powerplant. This occurs on the 'back side of the power curve.' The velocity at which this
occurs is usually less than the stalling velocity, so is of academic interest only."*

**Datos de magnitud que el software puede usar como sanity check:** *"Typically, for conventional
cruising flight, L/D ≈ 15 to 20"* (p. 46). Y la frase que resume el oficio: *"Obtaining raw lift on a
body is relatively easy—even a barn door creates lift at angle of attack. The name of the game is to
obtain the necessary lift with as low a drag as possible."*

### 2.6 Estática de fluidos (§1.9) — ver §1.G para las ecuaciones (1.52)–(1.58) y su alcance.

### 2.7 Capa límite (§1.11, pp. 68–75)

- No deslizamiento en la pared: `V = 0` en `y = 0` (y `T = Tw`, *"a kind of 'no slip' condition on
  temperature"*).
- `τw = μ·(dV/dy)|y=0` (1.59); `q̇w = −k·(dT/dy)|y=0` (1.60); `Re_x = ρ∞·V∞·x/μ∞` (1.61).
- **La hipótesis operativa** (la que hace posible acoplar potencial + capa límite): *"Conventional
  boundary layer analysis assumes that the flow conditions at the outer edge of the boundary layer are
  the same as the surface flow conditions from an inviscid flow analysis"*, más `p` constante a través
  del espesor.
- **Qué se rompe fuera:** separación. El libro es explícito en que la constancia de `p` a través de la
  capa **no vale** en zonas separadas, y que ahí *"no inviscid theory can independently predict the
  aerodynamics of such flows"* (§1.10.2, p. 63).
- Consecuencia numérica: `(τw)_lam < (τw)_turb` porque el perfil turbulento es *"fatter, or fuller"*
  y su pendiente en la pared es mayor.
- Consecuencia de alcance para el producto: *"because friction (shear stress) is a major source of
  aerodynamic drag, **inviscid theories by themselves cannot adequately predict total drag**"* (p. 63).
  → **Un solver potencial en el navegador puede dar `cl` creíble y NO puede dar `cd` creíble.** La UI
  debe decirlo.

### 2.8 Continuidad, momento, energía (§2.4–§2.7) — ver §1.H. Resumen de la jerarquía de supuestos:

| Ecuación | Supuestos | Se rompe si… |
|---|---|---|
| (2.48)/(2.52) continuidad | **solo** medio continuo | régimen molecular libre |
| (2.53)/(2.54) | + estacionario | flujo con transitorios |
| (2.64)/(2.70a–c) momento | continuo (viscoso o no, compresible o no) | medio no continuo |
| (2.71)/(2.72a–c) **Euler** | + estacionario + **no viscoso** + sin fuerzas de cuerpo | capa límite, estela, separación |
| (2.70a–c) **Navier-Stokes** | continuo, viscoso | — |
| (2.95)/(2.96) energía | continuo | — |
| (2.97)/(2.98) | + estacionario + no viscoso + **adiabático** + sin fuerzas de cuerpo | calentamiento aerodinámico, combustión |
| (2.99) `e = cv·T` | **gas caloríficamente perfecto** | alta temperatura, disociación (§1.10.4 hipersónico) |
| (2.100) `p = ρ·R·T` | **gas perfecto** | gas real |

### 2.9 Vorticidad y circulación (§2.12–§2.13) — el puente a la sustentación

```
ω = ½·[ (∂w/∂y − ∂v/∂z)·i + (∂u/∂z − ∂w/∂x)·j + (∂v/∂x − ∂u/∂y)·k ]     (2.127)
ξ ≡ 2ω = ∇×V                                                              (2.128)(2.129)
2D irrotacional:  ∂v/∂x − ∂u/∂y = 0                                       (2.131)
Γ ≡ −∮_C V·ds = −∬_S (∇×V)·dS                                             (2.136)(2.137)
(∇×V)·n = −dΓ/dS                                                          (2.138)
```

Además, tensor de derivadas de velocidad (p. 171): la **diagonal** suma `∇·V` = dilatación; los
**términos fuera de la diagonal** producen rotación y **deformación** (`εxy = ∂v/∂x + ∂u/∂y`, 2.135a,
y cíclicas). El libro avisa: *"we do not make use of the time rate of strain until Chapter 15."*

**Por qué importa (literal, p. 170):** *"irrotational flows are much easier to analyze than
rotational flows. However, irrotational flow may at first glance appear to be so special that its
applications are limited. Amazingly enough, such is not the case. There are a large number of
practical aerodynamic problems where the flow field is essentially irrotational, for example, the
subsonic flow over airfoils, the supersonic flow over slender bodies at small angle of attack, and
the subsonic-supersonic flow through nozzles. For such cases, there is generally a thin boundary layer
of viscous flow immediately adjacent to the surface; in this viscous region the flow is highly
rotational. However, outside this boundary layer, the flow is frequently irrotational."*

**Rango de validez del atajo irrotacional:** perfiles subsónicos, cuerpos esbeltos supersónicos a
`α` pequeño, toberas. **Qué se rompe fuera:** dentro de la capa límite (siempre rotacional),
detrás de una **onda de choque curva** (§9.5.1 del libro, fuera de rango: gradientes de entropía →
vorticidad), y en estelas separadas.

**Historia y crédito (§2.13, p. 176, literal):** *"This tool was used independently by Frederick
Lanchester (1878–1946) in England, Wilhelm Kutta (1867–1944) in Germany, and Nikolai Joukowski
(1847–1921) in Russia to create a breakthrough in the theory of aerodynamic lift at the turn of the
twentieth century."*

### 2.10 ψ y φ (§2.14–§2.16) — ver §1.I. Tres puntos de física que el software debe respetar:

1. `ψ̄` tiene **unidades de flujo másico por unidad de profundidad** (kg/(s·m)); `ψ` incompresible
   tiene unidades de **caudal volumétrico** (m²/s). Un visualizador que rotule `ψ` como "algo
   adimensional" está mintiendo.
2. `φ` **solo existe si el flujo es irrotacional.** Si el solver calcula `φ` de un campo con
   vorticidad, el resultado no significa nada. → Validador: `max|∇×V|` debe ser ~0 antes de aceptar `φ`.
3. `ψ` es 2D (o axisimétrico); `φ` es 3D. Un motor 3D **no** puede apoyarse en `ψ`.

### 2.11 Operadores vectoriales (§2.2) — la especificación literal para el código

```
GRADIENTE
(2.16)  cartesiano:  ∇p = (∂p/∂x) i + (∂p/∂y) j + (∂p/∂z) k
(2.17)  cilíndrico:  ∇p = (∂p/∂r) er + (1/r)(∂p/∂θ) eθ + (∂p/∂z) ez
(2.18)  esférico:    ∇p = (∂p/∂r) er + (1/r)(∂p/∂θ) eθ + (1/(r·sinθ))(∂p/∂Φ) eΦ
(2.15)  derivada direccional:  dp/ds = ∇p · n

DIVERGENCIA
(2.19)  cartesiano:  ∇·V = ∂Vx/∂x + ∂Vy/∂y + ∂Vz/∂z
(2.20)  cilíndrico:  ∇·V = (1/r)·∂(r·Vr)/∂r + (1/r)·∂Vθ/∂θ + ∂Vz/∂z
(2.21)  esférico:    ∇·V = (1/r²)·∂(r²·Vr)/∂r + (1/(r·sinθ))·∂(Vθ·sinθ)/∂θ
                           + (1/(r·sinθ))·∂VΦ/∂Φ

ROTACIONAL
(2.22)  cartesiano:  ∇×V = i(∂Vz/∂y − ∂Vy/∂z) + j(∂Vx/∂z − ∂Vz/∂x) + k(∂Vy/∂x − ∂Vx/∂y)
(2.23)  cilíndrico:  ∇×V = (1/r)·det[ er , r·eθ , ez ; ∂/∂r , ∂/∂θ , ∂/∂z ; Vr , r·Vθ , Vz ]
(2.24)  esférico:    ∇×V = (1/(r²·sinθ))·det[ er , r·eθ , (r·sinθ)·eΦ ;
                                              ∂/∂r , ∂/∂θ , ∂/∂Φ ;
                                              Vr , r·Vθ , (r·sinθ)·VΦ ]

TRANSFORMACIONES
(2.5)/(2.6)  cilíndrico ↔ cartesiano:  x = r·cosθ, y = r·sinθ, z = z ;
                                        r = sqrt(x²+y²), θ = atan(y/x), z = z
(2.7)/(2.8)  esférico ↔ cartesiano:    x = r·sinθ·cosΦ, y = r·sinθ·sinΦ, z = r·cosθ ;
                                        r = sqrt(x²+y²+z²), θ = acos(z/r),
                                        Φ = acos(x/sqrt(x²+y²))

PRODUCTOS         (2.3) A·B ≡ |A||B|cosθ      (2.4) A×B ≡ (|A||B|sinθ)·e  (mano derecha)
                  (2.9)(2.11)(2.13) por componentes;  (2.10)(2.12)(2.14) como determinante

TEOREMAS
(2.25) Stokes:        ∮_C A·ds = ∬_S (∇×A)·dS
(2.26) divergencia:   ∯_S A·dS = ∭_V (∇·A) dV
(2.27) gradiente:     ∯_S p dS = ∭_V ∇p dV
```

**Advertencias de fidelidad y de implementación:**
- (2.12), (2.14), (2.23) y (2.24) **el libro solo las da como determinante**, sin expandir.
  Expandirlas es implementación nuestra; el resultado se debe verificar contra la forma cartesiana
  transformando coordenadas.
- **Anderson NO declara "factores de escala"** (`h_r=1, h_θ=r, h_Φ=r·sinθ`). Están embebidos en los
  `1/r` y `1/(r·sinθ)` de (2.17)/(2.18)/(2.20)/(2.21). Si nuestro código los usa explícitamente,
  marcarlo `[EXTENSIÓN DECLARADA]`.
- El símbolo `Φ` del tercer ángulo esférico **se perdió en el `pdftotext`** en todo §2.2. Está
  reconstruido por contexto (*"the angle measured from the x axis and is in the xy plane"*).

### 2.12 Arrastre por levantamiento de estela (§2.6, pp. 137–146)

**Volumen de control (Figura 2.20a):** contorno `abcdefghia`, ancho unitario en z, formado por
(1) las líneas de corriente muy por encima y por debajo del cuerpo (`ab`, `hi`);
(2) las estaciones de entrada y salida perpendiculares al flujo (`ai`, `bh`);
(3) un corte que envuelve la superficie del cuerpo (`cdefg`).

**Supuestos, uno por uno (todos declarados en el texto):**
- **estacionario**, 2D, por unidad de envergadura;
- **`p = p∞` uniforme en TODO el contorno `abhi`** — incluida la estación de salida;
- **`u1` uniforme** en `ai`; `u2 = f(y)` en `bh` (hay estela), **ambas en dirección x**;
- **cortante despreciado en `ab` y `hi`**;
- los cortes `cd` y `fg` son adyacentes → sus fuerzas de superficie **se cancelan**;
- **fuerza volumétrica despreciable**.

**Derivación (números de ecuación del libro):**
```
(2.73)  Fuerza de superficie = −∮_abhi p dS − R          [3ª ley: el cuerpo ejerce −R]
(2.74)  momento integral (2.64) con ese lado derecho
(2.75)  estacionario:  R = −∮_S (ρV·dS)V − ∮_abhi p dS
(2.76)  componente x (D' = componente x de R por unidad de envergadura)
(2.77)  ∮_abhi (p dS)_x = 0     ← porque p es CONSTANTE sobre abhi (Problema 2.1)
(2.78)  D' = −∮_S (ρV·dS) u
        · ab, hi y def son LÍNEAS DE CORRIENTE → V·dS = 0 → no contribuyen
        · cd y fg son adyacentes → sus flujos se cancelan
        · quedan solo ai (entrada) y bh (salida), con dS = dy·(1)
(2.79)  ∮_S (ρV·dS)u = −∫_ai ρ1·u1² dy + ∫_bh ρ2·u2² dy
(2.80)  CONTINUIDAD integral estacionaria (2.53):  ∫_ai ρ1·u1 dy = ∫_bh ρ2·u2 dy
(2.81)  × u1 (constante):  ∫_ai ρ1·u1² dy = ∫_bh ρ2·u2·u1 dy
(2.82)  sustituyendo:  ∮_S (ρV·dS)u = −∫_bh ρ2·u2·(u1 − u2) dy

(2.83)  D' = ∫_bh ρ2·u2·(u1 − u2) dy        ← COMPRESIBLE (hay que medir también ρ2(y))
(2.84)  D' = ρ · ∫_bh u2·(u1 − u2) dy       ← INCOMPRESIBLE (ρ constante y conocida)
```

**Qué se rompe fuera del rango:** si el contorno no está lo bastante lejos, `p ≠ p∞` en `bh` y la
Ec. (2.77) **deja de ser cero** → aparece un término de presión que (2.83)/(2.84) no tienen. Si el
flujo no es estacionario, falta el término `∂/∂t`. Si hay sustentación, `u2` ya no es solo en x.

**Restricción de dirección (§2.6.1, p. 146, cita completa):** *"On one hand, we demonstrated that, by
knowing the detailed flow properties along the control surface, this application led to an accurate
result for an overall quantity such as drag on a body… On the other hand, in Example 2.2, we have
shown that, **by knowing an overall quantity such as the net drag on a flat plate, the finite control
volume concept by itself does not necessarily provide an accurate calculation of detailed flow-field
properties along the control surface** (in this case, the velocity profile), although the momentum
principle is certainly satisfied in the aggregate… **The weakness here is the need to assume some form
for the variation of flow properties over the control surface**; in Example 2.2, the assumption of the
particular power-law profile proved to be unsatisfactory."*

### 2.13 Discretización (§2.17.2, pp. 191–194) — la especificación del solver numérico

Malla uniforme rectangular, índice `i` en x, `j` en y; `Δx` y `Δy` pueden diferir entre sí pero cada
uno es uniforme. De la serie de Taylor (2.166):

```
(2.168)  adelantada:  (∂u/∂x)|i,j = [u(i+1,j) − u(i,j)] / Δx              → PRIMER orden
(2.171)  atrasada:    (∂u/∂x)|i,j = [u(i,j) − u(i−1,j)] / Δx              → PRIMER orden
(2.174)  centrada:    (∂u/∂x)|i,j = [u(i+1,j) − u(i−1,j)] / (2·Δx)        → SEGUNDO orden
```
El **error de truncamiento** son los términos que se descartan de la serie: (2.167) y (2.170) llevan
`(∂²u/∂x²)·Δx/2` como término principal (de ahí el primer orden); (2.173) lleva
`(∂³u/∂x³)·(Δx)²/3` (de ahí el segundo orden). Ecuaciones (2.167), (2.170) y (2.173) **siguen siendo
matemáticamente exactas**; el error aparece solo al truncarlas.

**Requisito literal:** *"In most CFD solutions, first-order accuracy is not good enough; we need a
discretization of (∂u/∂x)|i,j that has at least second-order accuracy… For most CFD solutions,
second-order accuracy is sufficient."*

**Qué se rompe fuera:** la derivación asume malla **uniforme**. Sobre una malla estirada (que es lo
que hace falta cerca de la pared para resolver la capa límite, §2.17.2 p. 190) la diferencia centrada
**pierde el segundo orden** salvo que se reformule. Es un gotcha que el libro no menciona y que
hunde solvers caseros. `[EXTENSIÓN DECLARADA — no está en Anderson caps. 1–2]`

---

## 3. FIXTURES DE TEST

Todos los ejemplos numéricos resueltos de los caps. 1–2: **12 en el cap. 1** (1.1 a 1.12) y **10 en el
cap. 2** (2.1 a 2.10), más el *Integrated Work Challenge* de §1.16 y una tabla de rangos de
sanity-check derivada de §1.12. **Total: 24 fixtures. Ninguno pendiente.**

---

```
FIXTURE anderson-ej-1.1  [§1.5, pp. 26–30]   ← EL FIXTURE MAESTRO DEL BLOQUE
entradas: cuña de semiángulo 5°, α = 0, M∞ = 2.0, cuerda c = 2 m,
          p∞ = 1.01e5 N/m², ρ∞ = 1.23 kg/m³, T∞ = 288 K (nivel del mar estándar),
          pu = pl = 1.31e5 N/m² (constante sobre las caras inclinadas),
          p_base = p∞,  τw = 431·s^(−0.2)  [Pa, s en m desde el borde de ataque]
salida esperada:
   a∞ = 340.2 m/s ; V∞ = 680.4 m/s ; q∞ = 2.847e5 N/m² ; S = c·(1) = 2.0 m²
   ∫ presión extradós = 5260 N   ;  ∫ presión intradós = 5260 N
   ∫ fricción extradós = 936.5 N ;  ∫ fricción intradós = 936.5 N
   D'_presion = 1.052e4 N/m ; D'_friccion = 0.1873e4 N/m ; D' = 1.24e4 N/m
   cd = 0.022
   reparto: 85 % presión (onda de choque / wave drag), 15 % fricción
ruta alterna (misma respuesta, Ec. 1.16):
   Cp,u = Cp,l = 0.1054 ; cf = 1.513e−3·x^(−0.2) ; dyu/dx = tan5° = 0.0875
   cd = 0.01854 (presión) + 0.00329 (fricción) = 0.022
tolerancia: 1 % (el libro redondea intermedios a 3–4 cifras)
```
**Frase del libro que el fixture debe preservar (p. 29):** *"In this example, only 15 percent of the
drag is skin friction drag; the other 85 percent is the pressure drag (wave drag). This is typical of
the drag of slender supersonic bodies. In contrast, as we will see later, the drag of a slender body
at subsonic speed, where there is no shock wave, is mainly skin friction drag."*

**Verificación contra `src/aero/cuna-anderson.ts` (25 tests de la Forja): COINCIDE.**
Recalculé la integral analítica y por paneles. Resultados (todos dentro del 1 %):

| Cantidad | Libro | Analítico exacto | `cunaAnderson(400)` | Δ vs libro |
|---|---|---|---|---|
| `a∞` | 340.2 m/s | 340.17 | 340.17 | 0.01 % |
| `V∞` | 680.4 m/s | 680.35 | 680.35 | 0.01 % |
| `q∞` | 2.847e5 Pa | 284,667 | 284,667 | 0.01 % |
| `D'_presión` | 1.052e4 N/m | 10,498.6 | 10,498.6 | **0.20 %** |
| `D'_fricción` | 1873 N/m | 1874.6 | 1873.3 | **0.09 %** |
| `D'` | 1.24e4 N/m | 12,373.2 | 12,371.9 | **0.16 %** |
| `cd` | 0.022 | 0.02173 | 0.02173 | 1.2 % del redondeo |
| fracción presión | 85 % | 84.86 % | 84.86 % | 0.2 % |

**Las tres discrepancias están rastreadas y son del LIBRO, no nuestras:**
1. El libro redondea `1.31e5·sin5° = 11,418.9` a `1.142e4` y `c/cos5° = 2.00765` a `2.008`; su
   `5260 N` sale de `22,931 − 17,675 = 5256`, redondeado. El valor exacto es 5249.3 N por cara.
2. El libro usa `429` donde el valor exacto es `431·cos5° = 429.36` (p. 28) → 936.5 vs 937.3.
3. `cd`: el libro publica `0.022`; el exacto es `0.02173` (y su propia ruta alterna da `0.02183`).

**Nota de convergencia numérica (hallazgo real, no defecto):** el integrando `s^(−0.2)` tiene una
singularidad integrable en `s = 0`. La regla del punto medio converge **por abajo**: n=50 → 1867.5;
n=200 → 1872.2; n=400 → 1873.3; n=4000 → 1874.4; analítico → 1874.6. El test
`converge: 50 paneles ya está al 1 % de 400` **pasa**, pero por coincidencia el valor a n=400 (1873.3)
queda más cerca del número redondeado del libro (1873) que el valor exacto (1874.6). Documentarlo en
la escuela: **es el ejemplo perfecto de "el número correcto y el número del libro no siempre son el
mismo, y el ingeniero debe saber cuál es cuál".**

**Divergencias a corregir en el código (2):**
- `betaChoqueOblicuo()` y su test (`β ≈ 34.3°`, "carta NACA 1135") **NO pertenecen al Ejemplo 1.1**.
  La relación θ-β-M es Anderson **§9.2, Ec. (9.23), p. 620** — otro capítulo. El Ejemplo 1.1 **da**
  `pu = 1.31e5` como dato; nunca lo deriva. Marcar `[EXTENSIÓN DECLARADA — Anderson §9.2]` o mover el
  test al bloque del cap. 9.
- El docstring del módulo dice `p∞ = 1.01×10⁵ Pa`, correcto; pero el comentario del cálculo de la base
  (`succión de culata`) merece la nota del libro: la base **no** es succión, es simplemente `p∞`
  actuando hacia adelante sobre el área proyectada `2·c·tan5° = 0.35 m`.

---

```
FIXTURE anderson-ej-1.2  [§1.5, pp. 30–32]
entradas: cono a α = 0 en flujo hipersónico, semiángulo θc,
          ley newtoniana seno-cuadrado: Cp = 2·sin²(θc) (constante sobre la superficie inclinada),
          p_base = p∞, fricción despreciada, referencia: área de la base Sb = π·rb²
salida esperada (simbólica, y ES el fixture):
   D = ∫[0→rb] 2π·r·(p − p∞) dr = π·(p − p∞)·rb²
   CD = D/(q∞·π·rb²) = Cp        ← "el CD de un cono es igual a su Cp de superficie"
   CD = 2·sin²(θc)
tolerancia: exacto (identidad algebraica)
```
Requisito derivado, literal (p. 30): *"We cannot use Equations (1.15) to (1.17) here. These equations
are expressed for a two-dimensional body… whereas the cone in Figure 1.24 is a shape in
three-dimensional space."* → **Test de arquitectura: el kernel 3D es otra rutina.**
La ley `Cp = 2·sin²θ` está declarada como aproximación hipersónica *"to be derived in Chapter 14"*.

---

```
FIXTURE anderson-ej-1.3  [§1.6, pp. 33–34]
entradas: NACA 4412, flujo incompresible de baja velocidad, α = 4°,
          cl = 0.85 , cm,c/4 = −0.09   (datos experimentales)
salida esperada: x_cp/c = 1/4 − (cm,c/4)/cl = 0.25 − (−0.09/0.85) = 0.356
tolerancia: 1 %
```
Nota del libro que el software debe respetar: *"for a thin, symmetrical airfoil, the center of pressure
is at the quarter-chord location. However, for the NACA 4412 airfoil, which is not symmetric, the
center-of-pressure location is behind the quarter-chord point."*

---

```
FIXTURE anderson-ej-1.4  [§1.6, p. 34]
entradas: DC-3, sección de ala justo fuera de la góndola del motor, cuerda c = 15.4 ft,
          crucero 188 mi/h a nivel del mar,
          M'_c/4 = −1071 ft·lb/ft ,  M'_LE = −3213.9 ft·lb/ft
salida esperada: (c/4)·L' = M'_c/4 − M'_LE = −1071 + 3213.9 = 2142.9
                 c/4 = 3.85 ft  →  L' = 2142.9/3.85 = 556.6 lb/ft
                 x_cp = −M'_LE/L' = 3213.9/556.6 = 5.774 ft   (= 0.375·c)
tolerancia: 0.5 %
```
Requisito derivado, literal: *"the force and moment system is also uniquely specified by giving the
moments acting about any two points on the airfoil."*

---

```
FIXTURE anderson-ej-1.5  [§1.8, pp. 41–43]
entradas: dos cilindros circulares, d2 = 4·d1 ;  ρ2 = ρ1/4 , V2 = 2·V1 , T2 = 4·T1
          supuesto declarado: μ ∝ T^(1/2) y a ∝ T^(1/2)
salida esperada: μ2/μ1 = 2 ; a2/a1 = 2 ; M2 = M1 ; Re2 = Re1
                 ⇒ los dos flujos son DINÁMICAMENTE SIMILARES
                 ⇒ mismos patrones de línea de corriente, mismas distribuciones
                   adimensionales p/p∞ vs s/d, y CD1 = CD2 (con S = π·d²/4)
tolerancia: exacto
```
**Este fixture es el test unitario de la caché.** Si el sistema devuelve resultados distintos para dos
casos con la misma `(forma, α, Re, M)`, la caché está rota.

---

```
FIXTURE anderson-ej-1.6  [§1.8, pp. 43–44]
entradas: Boeing 747 a 550 mi/h, altitud estándar 38,000 ft,
          p1 = 432.6 lb/ft² , T1 = 390 °R ; modelo a escala 1/50 ; T2 = 430 °R
          supuesto: μ ∝ T^(1/2) , a ∝ T^(1/2)
salida esperada: V2 = 550·sqrt(430/390) = 577.5 mi/h
                 ρ2/ρ1 = c1/c2 = 50
                 p2/p1 = (ρ2/ρ1)·(T2/T1) = 50·(430/390) = 55.1
                 p2 = 55.1 · 432.6 = 23,836 lb/ft² = 11.26 atm   (1 atm = 2116 lb/ft²)
tolerancia: 0.5 %
```
Lección de producto, literal (p. 44): *"the wind-tunnel test stream must be pressurized far above
atmospheric pressure in order to simulate the proper free-flight Reynolds number. However, most
standard subsonic wind tunnels are not pressurized as such, because of the large extra financial cost
involved."* Contexto histórico: el **NACA Variable Density Tunnel (VDT)**, autorizado marzo 1921,
operativo octubre 1922 en Langley, carcasa de presión de **85 toneladas**, hasta **20 atm**, con el
que se caracterizaron las familias de perfiles NACA en los 1920–30; hoy es *National Historic
Landmark*.

---

```
FIXTURE anderson-ej-1.7  [Design Box §1.8, pp. 51–52]
entradas: jet ejecutivo tipo Cessna 560 Citation V, V∞ = 492 mph, altitud 33,000 ft,
          ρ∞ = 7.9656e−4 slug/ft³ (el propio libro usa 7.9659e−4 en el cálculo),
          W = 15,000 lb , S = 342.6 ft² , CD = 0.015
salida esperada: V∞ = 492·(88/60) = 721.6 ft/s
                 CL = 2W/(ρ∞·V∞²·S) = 0.21
                 L/D = CL/CD = 0.21/0.015 = 14
tolerancia: 1 %
```
Interpretación literal a preservar en la UI: *"the lift-to-drag ratio is 14, which means that for the
expenditure of one pound of thrust to overcome one pound of drag, the wing is lifting 14 pounds of
weight—quite a nice leverage."*
**Ojo, errata del libro:** el enunciado da `ρ∞ = 7.9656e−4` y la solución usa `7.9659e−4`. Con
7.9656e−4 el resultado no cambia a 2 cifras. Documentar el fixture con **7.9656e−4** (el enunciado)
y tolerancia 1 %.

---

```
FIXTURE anderson-ej-1.8  [Design Box §1.8, p. 52]
entradas: mismo avión del Ej. 1.7; V_stall = 100 mph a nivel del mar,
          W_max_despegue = 15,900 lb , ρ∞ = 0.002377 slug/ft³ , S = 342.6 ft²
salida esperada: V_stall = 100·(88/60) = 146.7 ft/s
                 CL,max = 2W/(ρ∞·V_stall²·S) = 1.81
tolerancia: 1 %
```

---

```
FIXTURE anderson-ej-1.9  [§1.9]
entradas: globo de aire caliente, diámetro inflado D = 30 ft, peso total W = 800 lb
          (incluye el aire caliente interior); ρ_nivel_mar = 0.002377 slug/ft³ ; g = 32.2 ft/s²
          ley de densidad dada: ρ = 0.002377·(1 − 7e−6·h)^4.21   [h en ft, ρ en slug/ft³]
salida esperada: V = (4/3)·π·15³ = 14,137 ft³
                 B = g·ρ·V = 32.2·0.002377·14,137 = 1082 lb
                 m = 800/32.2 = 24.8 slug
                 (a) a = (B − W)/m = (1082 − 800)/24.8 = 11.4 ft/s²
                 (b) altitud máxima: B = W ⇒ ρ = 800/(32.2·14,137) = 0.00176 slug/ft³
                     h = (1/7e−6)·[1 − (0.00176/0.002377)^(1/4.21)] = 9842 ft
tolerancia: 1 %
```

---

```
FIXTURE anderson-ej-1.10  [§1.9]   ← EL FIXTURE DE LA ATMÓSFERA ESTÁNDAR
entradas: troposfera 0–11 km con gradiente lineal a = dT/dh = −6.5 K/km = −0.0065 K/m;
          nivel del mar: p_s = 1.01325e5 N/m², ρ_s = 1.2250 kg/m³, T_s = 288.16 K;
          R = 287 J/(kg·K), g_s = 9.80 m/s²
          altitud GEOMÉTRICA h_G = 5 km  →  altitud GEOPOTENCIAL h = 4.996 km (0.08 % de diferencia)
cadena: (E1.1) dp/p = −(g/R)·(dh/T)      (E1.2) dh = dT/a      (E1.3) dp/p = −(g/(a·R))·(dT/T)
        (E1.5) p/p_s = (T/T_s)^(−g_s/(a·R))    (E1.7) T − T_s = a·h  (h GEOPOTENCIAL)
salida esperada: T = 288.16 − 0.0065·4996 = 255.69 K
                 exponente −g_s/(a·R) = −9.80/((−0.0065)(287)) = 5.25328
                 p/p_s = (255.69/288.16)^5.25328 = 0.53364
                 p = 5.407e4 N/m²
                 ρ = p/(R·T) = 5.407e4/(287·255.69) = 0.7368 kg/m³
tolerancia: el propio libro declara 0.04 % en p y 0.05 % en ρ contra el Apéndice D
```
**Verificación contra `src/aero/atmosfera.ts`: coincide en la FÍSICA, DIVERGE en dos constantes y en
una definición.**
- El módulo usa `T0 = 288.15 K`, `R = 287.053`, `g = 9.80665` (ISO 2533 / ISA moderno). Anderson usa
  `T_s = 288.16 K`, `R = 287`, `g_s = 9.80` (modelo **ARDC 1959** de los Apéndices D/E). El exponente
  sale **5.2559** (nuestro) vs **5.25328** (Anderson). **Ninguno está mal**; son dos estándares. El
  propio Anderson atribuye su desviación de 0.04 % a esto: *"the value of R = 287 J/(kg)(K) used here,
  which depends on the molecular weight of air, which in turn varies slightly from one source to
  another."*
  → **Requisito:** `atmosfera.ts` debe exponer un selector de estándar (`ISO2533` | `ARDC1959`), o al
  menos declarar cuál usa, para poder correr los fixtures del libro **con las constantes del libro**.
- **Divergencia real:** `atmosferaISA(h)` no distingue altitud **geométrica** de **geopotencial**. El
  libro lo marca con "must". Para `h_G = 5 km` la diferencia es 0.08 % — despreciable — pero a 20 km
  ya no lo es, y el módulo declara validez hasta 20,000 m. Añadir `hGeopotencial(hG)` o documentar el
  supuesto explícitamente. Ver §8, hallazgo 5.
- El docstring de `atmosfera.ts` cita "Anderson cap. 3" para el modelo ISA. **La derivación ISA está en
  Anderson §1.9, Ejemplo 1.10 (cap. 1), no en el cap. 3.** Corregir la cita.

---

```
FIXTURE anderson-ej-1.11  [§1.9]
entradas: manómetro de mercurio en U, vertical; un extremo SELLADO con vacío total (p_b = 0),
          el otro abierto a la atmósfera a nivel del mar estándar (p_a = 1.013e5 N/m²);
          ρ_mercurio = 1.36e4 kg/m³ ; g = 9.8 m/s²
salida esperada: Δh = p_a/(ρ·g) = 1.013e5/(1.36e4·9.8) = 0.76 m = 76 cm = 29.92 in
                 la columna MÁS ALTA es la del extremo SELLADO al vacío (h1 > h2)
tolerancia: 1 %
```

---

```
FIXTURE anderson-iwc-1.16  [§1.16, pp. 98–101]  ← FUERZA AXIAL HACIA ADELANTE
condición general: existe fuerza axial hacia ADELANTE (A negativa) si y solo si  L/D > cot(α)
caso numérico: NACA 2412 a α = 6° ; cl = 0.88 (Fig. 4.10) ; cd = 0.008 (Fig. 4.11)
salida esperada: L/D = 0.88/0.008 = 110 ;  cot(6°) = 9.52  ;  110 > 9.52  ⇒ SÍ hay fuerza
                 axial hacia adelante ("propelling component" de Lilienthal)
caso frontera: A = 0  ⇔  D/L = tan(α)  ⇔  L/D = cot(α)  (R perpendicular a la cuerda)
tolerancia: 1 %
```
Es un **test de signo** del integrador: si `A'` de la Ec. (1.8) nunca sale negativa en un perfil con
camber a `α` pequeño, el integrador tiene un error de signo. Contexto histórico: Otto Lilienthal lo
observó antes de 1889 en su brazo giratorio — *"not only does the direction of the air pressures
closely approach that of the perpendicular to the surface, but for certain angles it actually passes
beyond it to the other side, converting the usual restraining component into a propelling component."*

---

```
FIXTURE anderson-ej-2.1  [§2.3.5, pp. 125–127]
entradas: flujo compresible subsónico sobre pared ondulada coseno,
          l = 1.0 m , h = 0.01 m , V∞ = 240 m/s , M∞ = 0.7
          u = V∞·[1 + (h/β)·(2π/l)·cos(2πx/l)·e^(−2πβy/l)]        (2.35)
          v = −V∞·h·(2π/l)·sin(2πx/l)·e^(−2πβy/l)                  (2.36)
          β ≡ sqrt(1 − M∞²)
punto de evaluación: (x/l, y/l) = (1/4, 1)
salida esperada: β = sqrt(1 − 0.49) = 0.714
                 ∇·V = (β − 1/β)·V∞·h·(2π/l)²·sin(2πx/l)·e^(−2πβy/l)      (2.40)
                 ∇·V = (0.714 − 1/0.714)·(240)(0.01)·(2π/1)²·e^(−2π·0.714)
                 ∇·V = −0.7327 s⁻¹    (el elemento pierde 73 % de volumen por segundo)
                 ⇒ el punto (1/4, 1) está en una región de COMPRESIÓN (ρ aumentando)
                 ∇·V = 0 solo en x/l = 0, 1/2, 1, 3/2, … (donde sin(2πx/l) = 0)
tolerancia: 1 %
```

---

```
FIXTURE anderson-ej-2.3  [§2.9, pp. 155–158]   ← LA DERIVADA SUSTANCIAL, MEDIDA
entradas: mismo flujo del Ej. 2.1, mismo punto (x/l, y/l) = (1/4, 1)
intermedios del libro: 2π/l = 6.283 ; β = 0.714 ; 2πβy/l = 4.486 ; e^(−4.486) = 0.01126
                       sin(2πx/l) = 1 ; cos(2πx/l) = 0
                       u = V∞ = 240 m/s ; v = −0.1698 m/s
                       ∂u/∂x = −1.494 s⁻¹ ; ∂u/∂y = 0 ; ∂v/∂x = 0 ; ∂v/∂y = 0.7617 s⁻¹
salida esperada: ax = u·∂u/∂x + v·∂u/∂y = 240·(−1.494) = −358.56 m/s²
                 ay = u·∂v/∂x + v·∂v/∂y = −0.1698·0.7617 = −0.129 m/s²
                 |a| = 358.6 m/s²  →  DECELERACIÓN de 358.6 m/s² = 36.6 g
tolerancia: 1 %
```
**El dato de escuela (literal, p. 158):** *"a human being can tolerate only up to 10 g acceleration or
deceleration, and that for only a few seconds before life-threatening bodily injury… The flow field
shown in Figure 2.17 and treated here and in Example 2.1 is relatively benign; indeed, it is a flow
involving only small perturbations from a uniform flow. Yet, from this example we deduce that a given
fluid element, even though it is moving through a rather calm flow field, gets rather drastically
pushed around."*
**Nota de errata del libro:** en (E2.2) el texto imprime `ay = u·∂u/∂x + v·∂v/∂y`; debe ser
`ay = u·∂v/∂x + v·∂v/∂y`. Los números que publica (−0.129) corresponden a la forma **correcta**
(`240·0 − 0.1698·0.7617`). El fixture usa la forma correcta.

---

```
FIXTURE anderson-ej-2.4  [§2.11, p. 164]
entradas: u = y/(x² + y²) , v = −x/(x² + y²) ; punto (0, 5)
salida esperada: dy/dx = v/u = −x/y  →  y·dy = −x·dx  →  y² = −x² + c
                 c = 25  →  x² + y² = 25   (círculo centrado en el origen, radio 5)
tolerancia: exacto
```

---

```
FIXTURE anderson-ej-2.5  [§2.12, p. 172]
entradas: mismo campo del Ej. 2.4
salida esperada: ξ = ∇×V = 0·i + 0·j + 0·k = 0
                 el campo es IRROTACIONAL en todo punto EXCEPTO en el origen (x²+y² = 0)
tolerancia: exacto
```
**Este campo es el vórtice puntual** (aparece en el Problema 2.8 como *"vortex flow"*). Es el fixture
canónico del par irrotacional-pero-con-circulación: ver Ej. 2.8.

---

```
FIXTURE anderson-ej-2.6  [§2.12, pp. 172–174]
entradas: perfil de capa límite u/V∞ = (y/δ)^0.25 , incompresible, con δ/x = 5/sqrt(Re_x)
salida esperada: ∂u/∂y = C4·y^(−3/4)·x^(−1/8)   (término finito)
                 ∂v/∂x = C3·y^(5/4)·x^(−17/8)
                 ∂v/∂x − ∂u/∂y ≠ 0   ⇒  EL FLUJO ES ROTACIONAL
regla general que instancia: "viscous flows are rotational"
tolerancia: cualitativo (test de signo/no-nulidad)
```
**Nota de errata del libro:** en el paso final imprime `C4·y^(−3/4)·x^(−1/9)` y antes `x^(−1.8)`;
por la cadena de la derivación debe ser `x^(−1/8)`. No cambia la conclusión.

---

```
FIXTURE anderson-ej-2.7  [§2.12, pp. 175–176]
entradas: campo de la pared ondulada, Ecs. (2.35) y (2.36)
salida esperada: ∂v/∂x = −V∞·h·(2π/l)²·cos(2πx/l)·e^(−2πβy/l)
                 ∂u/∂y = −V∞·h·(2π/l)²·cos(2πx/l)·e^(−2πβy/l)
                 ∂v/∂x − ∂u/∂y = 0   ⇒  ∇×V = 0  ⇒  IRROTACIONAL en todo el campo
tolerancia: exacto (cancelación algebraica)
```
Es el fixture del teorema cualitativo de Kelvin: el flujo libre uniforme aguas arriba es irrotacional
(`∂u/∂y = ∂v/∂x = 0`), no hay viscosidad ni cortante en la pared que genere vorticidad, luego el campo
**permanece** irrotacional.

---

```
FIXTURE anderson-ej-2.8  [§2.13, pp. 178–179]   ← EL FIXTURE DE LA CIRCULACIÓN
entradas: campo del Ej. 2.4 (u = y/(x²+y²), v = −x/(x²+y²), en m/s),
          camino circular de radio 5 m centrado en el origen
polares: Vr = 0 ; Vθ = −1/r
salida esperada: V·ds = Vr·dr + r·Vθ·dθ = −dθ
                 Γ = −∮ V·ds = −∫[0→2π] (−dθ) = 2π m²/s
                 Γ es INDEPENDIENTE del radio del camino
tolerancia: 1e−6 (integración numérica de ∮ con n ≥ 2000)
```
**Verificación contra `src/aero/potencial.ts` (9 tests): FÍSICA CORRECTA, DOCUMENTACIÓN INVERTIDA.**
- `potencial.test.ts` afirma y verifica `∮u·dl ≈ −Γ_Kutta`. **Eso es consistente con Anderson**
  Ec. (2.136), donde `Γ ≡ −∮V·ds`, es decir `∮V·ds = −Γ`. ✔ Test correcto.
- Pero el **docstring de `circulationIntegral()`** dice: *"por el teorema de Stokes debe dar
  EXACTAMENTE Γ (el vórtice ligado)"*. **Contradice a su propio test y a Anderson (2.136).** La
  función devuelve `∮V·ds` (recorrido antihorario, sin el signo menos) = `−Γ_Anderson`.
  → **Corregir el docstring**, o renombrar la función a `lineIntegralVelocity()` y añadir
  `circulacionAnderson() = −lineIntegralVelocity()`. Es exactamente la trampa que el propio libro
  advierte en su nota al pie de la p. 177.
- `kuttaGamma`, `liftPerSpan (L' = ρ·U·Γ)`, `Cp = 1 − |u/U|²` y el perfil NACA 00xx están **fuera de
  los caps. 1–2**: Kutta-Joukowski es §3.16 (p. 282), la condición de Kutta es §4.5 (p. 338),
  `Cp = 1 − (V/V∞)²` es §3.5 (p. 235), y la nomenclatura NACA es §4.2 (p. 326). Todo legítimo, pero
  **debe marcarse `[EXTENSIÓN — Anderson caps. 3–4]`** para que este bloque no se lea como si los
  caps. 1–2 los avalaran.
- Lo que **sí** avalan los caps. 1–2 en ese módulo: `V = ∇φ` (2.154), la condición de irrotacionalidad
  2D (2.131), `Γ = −∮V·ds = −∬(∇×V)·dS` (2.136)(2.137), `Cp ≡ (p−p∞)/q∞` (§1.5) y el criterio de
  ortogonalidad ψ⊥φ (2.165) — este último **todavía no está testeado** y es un test gratis. Ver §6.

---

```
FIXTURE anderson-ej-2.9  [§2.15, pp. 184–186]
entradas: campo de la pared ondulada, Ecs. (2.35) y (2.36)
salida esperada: integrando u respecto a x:  φ = V∞·x + (V∞·h/β)·sin(2πx/l)·e^(−2πβy/l) + f(y)
                 integrando v respecto a y:  φ = V∞·(h/β)·sin(2πx/l)·e^(−2πβy/l) + g(x)
                 comparando: f(y) = 0 y g(x) = V∞·x
                 φ = V∞·x + (V∞·h/β)·sin(2πx/l)·e^(−2πβy/l)          (E2.17)
tolerancia: exacto
```
**Test de consistencia gratis para el software:** `∇φ` recalculado debe reproducir (2.35) y (2.36)
punto a punto. Y el prerequisito: solo existe `φ` porque el Ej. 2.7 probó que el campo es irrotacional.

---

```
FIXTURE anderson-ej-1.12  [§1.12, pp. 87–89]   ← POTENCIA REQUERIDA EN CRUCERO
entradas: Seversky P-35, S = 220 ft² (planta del ala), W = 5599 lb,
          CL = 0.15 , CD = 0.0275 (Fig. 1.58, configuración operacional completa),
          nivel del mar estándar ρ∞ = 0.002377 slug/ft³ ; 1 hp = 550 ft·lb/s
cadena: (E1.12.1) P = T·V∞ = D·V∞    (vuelo nivelado ⇒ T = D)
        (E1.12.2) W = L
        (E1.12.3) W = q∞·S·CL = ½·ρ∞·V∞²·S·CL
        (E1.12.4) V∞ = sqrt( 2W/(ρ∞·S·CL) )
salida esperada: V∞ = sqrt(2·5599/(0.002377·220·0.15)) = 377.8 ft/s = 257.6 mi/h
                 q∞ = ½·0.002377·377.8² = 169.6 lb/ft²
                 D  = q∞·S·CD = 169.6·220·0.0275 = 1026 lb
                 P  = D·V∞ = 1026·377.8 = 3.876e5 ft·lb/s
                 P  = 3.876e5/550 = 704 hp
tolerancia: 1 %
```
**Doble validación externa que el propio libro hace (y que la escuela debe imitar):** la velocidad de
crucero publicada del P-35 en *The American Fighter* (Angelucci y Bowers, 1985) es **260 mi/h** —
contra las 257.6 calculadas; *"this explains why the drag data given in Figure 1.58 was given for a
lift coefficient of 0.15."* Y el motor real, un Pratt & Whitney R-1830-45 de **1050 hp**, es
*"consistent with this engine throttled back for efficient cruise conditions"* frente a los 704 hp
calculados. **Es el ejemplo canónico de cerrar el lazo contra el mundo real.**
*Errata del libro:* en el paso de `V∞` cita *"Equation (E1.12.3)"* cuando usa la **(E1.12.4)**.

---

```
FIXTURE anderson-ej-2.2  [§2.6, pp. 143–146]   ← EL LÍMITE DEL VOLUMEN DE CONTROL
entradas: capa límite laminar incompresible sobre placa plana de cuerda c,
          perfil supuesto u = V∞·(y/δ)^n ,
          δ/c = 5/sqrt(Re_c)  ,  Cf ≡ D'/(q∞·c·(1)) = 1.328/sqrt(Re_c)
          Re_c = ρ∞·V∞·c/μ∞
pregunta: calcular el valor de n consistente con esos datos
cadena: Cf = 2·∫[0→δ/c] (u2/V∞)·[1 − (u2/V∞)] d(y/c)          [de la Ec. 2.84, con u1 = V∞]
        1.328/sqrt(Re_c) = [2/(n+1)]·(δ/c) − [2/(2n+1)]·(δ/c)
        con δ/c = 5/sqrt(Re_c):   1/(n+1) − 1/(2n+1) = 1.328/10
        0.2656·n² − 0.6016·n + 0.1328 = 0
salida esperada: n = 2   o   n = 0.25
   (raíces exactas verificadas: 2.0166 y 0.2478 — el libro redondea)
tolerancia: 1 %
```
**El fixture NO es el número: es el veredicto.** Literal (p. 146): *"**the result n = 2 gives a concave
velocity profile that is essentially nonphysical** when compared to the convex profiles always observed
in boundary layers. The result n = 0.25 gives a convex velocity profile that is **qualitatively
physically correct. However, this profile is quantitatively inaccurate**… Hence, our original
assumption of a power-law velocity profile… is not very good, **in spite of the fact that when n = 2
or 0.25, this assumed velocity profile does satisfy the momentum principle**, applied over a large,
finite control volume."*
→ **Test de honestidad del software:** dos soluciones satisfacen exactamente la conservación de
momento y **una de ellas es físicamente absurda**. Un validador que solo compruebe balances integrales
aprobaría las dos. Ver §8, hallazgo 12.

---

```
FIXTURE anderson-ej-2.10  [§2.17.2, pp. 194–196]   ← EL ESQUEMA EXPLÍCITO
entradas: flujo 1D no estacionario; malla con índice i en x, dos niveles de tiempo t y t+Δt;
          conocidos ρ, u en i−1, i, i+1 en el instante t
cadena: (2.52)  ∂ρ/∂t + ∇·(ρV) = 0
        (2.175) ∂ρ/∂t + ∂(ρu)/∂x = 0                       [1-D]
        (2.176) ∂ρ/∂t = −ρ·(∂u/∂x) − u·(∂ρ/∂x)
        (2.177) diferencia ADELANTADA en el tiempo + CENTRADA en el espacio:
                [ρ_i^(t+Δt) − ρ_i^t]/Δt
                  = −ρ_i^t·[u_(i+1)^t − u_(i−1)^t]/(2Δx) − u_i^t·[ρ_(i+1)^t − ρ_(i−1)^t]/(2Δx)
salida esperada (el esquema explícito):
        (2.178) ρ_i^(t+Δt) = ρ_i^t − (Δt/(2Δx))·[ ρ_i^t·u_(i+1)^t − ρ_i^t·u_(i−1)^t
                                                 + u_i^t·ρ_(i+1)^t − u_i^t·ρ_(i−1)^t ]
tolerancia: exacto (identidad algebraica; es un test de la implementación del esquema)
```
Literal: *"Equation (2.177) is called a **difference equation**; it is an approximate representation of
the original partial differential equation… where the error in the approximation is given by the **sum
of the truncation errors** associated with each of the finite differences used."* Y la propiedad que lo
hace **explícito**: *"In Equation (2.178), **all quantities on the right-hand side are known values at
time t.** Hence, Equation (2.178) allows the direct calculation of the unknown value."*
`u` e `e` en `t+Δt` se obtienen igual, con (2.113a) y (2.114).

---

```
FIXTURE anderson-rangos-1.12  [§1.12, pp. 75–87]   ← EL VALIDADOR DE ÓRDENES DE MAGNITUD
(no es un ejemplo resuelto: es la tabla de sanity-check que el software debe llevar dentro)

CD referido al ÁREA FRONTAL S = d·(1), incompresible:
  placa plana perpendicular, Re ≈ 1e5 ..................... CD = 2.0   (el máximo posible)
  cilindro circular d,        Re ≈ 1e5 ..................... CD = 1.2
  cilindro circular 0.1d,     Re ≈ 1e4 ..................... CD = 1.2
  cilindro circular d,        Re ≈ 1e7 ..................... CD = 0.6
  cuerpo aerodinámico espesor d, Re ≈ 1e5 .................. CD = 0.12
  ⇒ rango declarado "típico de cuerpos aerodinámicos": 0.12 ≤ CD ≤ 2.0
  ⇒ invariante: CD del cilindro es casi INDEPENDIENTE de Re entre 1e4 y 1e5
  ⇒ identidad del carenado: D'(cuerpo aero de espesor d) = D'(cilindro de 0.1d) = 0.12·q∞·d

Cf de placa plana referido al ÁREA EN PLANTA S = c·(1):   0.001 ≤ Cf ≤ 0.01
  (Cf baja al subir Re;  Cf turbulento > Cf laminar al mismo Re)

PERFIL (NACA 63-210, Re = 3e6):
  cd ......... típico 0.004–0.006 ; mínimo 0.0045 (en régimen laminar, "bucketlike")
  cl ......... de −1.0 a 1.5, para α de −12° a 14° ; máximo cerca de α = 14°
  cm,c/4 ..... del orden de −0.035, SIEMPRE negativo ("pitch-down")
  en α = 4° .. cl = 0.6 , cd = 0.0046 → L/D = 130
  regla ...... |cl| es ~100× mayor que cd

AVIÓN COMPLETO, CD referido al ÁREA EN PLANTA DEL ALA:
  Seversky XP-41 limpio, CL = 0.15 ......................... CD = 0.0166
  Seversky XP-41 operacional (18 adiciones) ................ CD = 0.0275  (+65 %)  ← "típico"
  Northrop T-38, sustentación nula, bajo subsónico ......... CD ≈ 0.015
  T-38: CD casi constante de M = 0.1 a 0.86, luego SUBE rápido cerca de M = 1

L/D MÁXIMOS:  perfil 63-210 ≈ 130 · NACA 2412 (α=6°) = 110 · T-38 ≈ 10 · B-52 = 21.5
  (crucero convencional, Design Box §1.8: L/D ≈ 15 a 20)

REYNOLDS: cilindro d=1 m a 45 m/s a nivel del mar → Re = 3.09e6
  "values of Re in the millions are typical of practical applications in aerodynamics"
```
**Corrección de atribución importante:** el **NACA 2412 NO aparece en §1.12**. El único perfil de esa
sección es el **NACA 63-210**. Los datos del 2412 vienen del Problema 1.6 (tabla completa, p. 102),
del §1.16 (`cl = 0.88`, `cd = 0.008` a 6°, citando las Figuras 4.10/4.11) y del cap. 4. Igualmente,
**la pendiente de sustentación `2π` por radián = 0.11 por grado NO está en los caps. 1–2**: es la
Ec. (4.34), p. 350. Y **"drag polar"** como término no aparece en §1.12 (§1.12 solo describe la curva
de `cd` del 63-210 como *"bucketlike"*); el término se define en el cap. 4, p. 328.

---

## 4. DECISIONES HUMANAS — dónde juzga el ingeniero y el software NO debe decidir

1. **Elegir `S` y `l` de referencia.** [§1.5, p. 25] *"The particular choice of reference area and
   length is not critical."* El libro **no** da una regla; da ejemplos. → El software **propone** la
   convención (ala → planta + cuerda media; cuerpo de revolución → área frontal + diámetro) pero el
   ingeniero **confirma y queda registrada** con el resultado. Un cambio de `S` no debe ser silencioso.

2. **Decidir el modelo de fluido.** [§2.3, p. 119] Volumen de control finito vs elemento infinitesimal:
   *"There is no single answer to this question; rather, three different models have been used
   successfully throughout the modern evolution of aerodynamics."* → No hay "el correcto"; hay el
   adecuado al problema.

3. **Declarar el flujo viscoso o no viscoso.** [§1.10.2, p. 62] *"Inviscid flows do not truly exist in
   nature; however, there are many practical aerodynamic flows (more than you would think) where the
   influence of transport phenomena is small, and we can model the flow as being inviscid."* → Es un
   juicio de ingeniería sobre **si el fenómeno que te importa vive en la capa límite o fuera de ella**.
   El software puede sugerir por `Re`, pero la decisión (y el error que implica) es humana.

4. **Declarar el flujo compresible o incompresible.** [§1.10.3, p. 64] La regla `M < 0.3` viene con
   *"it is always safe"*, pero la sección abre con *"all flows, to a greater or lesser extent, are
   compressible; truly incompressible flow, where the density is precisely constant, does not occur in
   nature."* → El software marca el umbral; el ingeniero acepta el error.

5. **Los umbrales de Mach son "rules of thumb" y el libro lo repite tres veces.** [§1.10.4, pp. 64–67]
   *"the above is just a loose rule of thumb and should not be taken as a precise quantitative
   definition"*, *"a very tenuous rule of thumb and should not be taken literally"*, *"a somewhat
   arbitrary but frequently used rule of thumb"*. → El software **nunca** debe bloquear un caso por
   cruzar M=1.2. Advierte, no impide.

6. **Qué se sacrifica en el túnel de viento (o en el precómputo).** [§1.8, p. 44] Simular `M` y `Re`
   a la vez es prohibitivo; *"Mach number simulation is achieved in one wind tunnel, and Reynolds
   number simulation in another tunnel. The results from both tunnels are then analyzed and correlated
   to obtain reasonable values."* Esa **correlación** es juicio humano.

7. **Reportar `x_cp` o `cm_c/4`.** [§1.6, p. 33 + §1.13, p. 93] El libro documenta que la NACA tomó
   una decisión de producto explícita a favor de `cm_c/4`. Nuestro software debe ofrecer las tres
   representaciones equivalentes y **no elegir por el alumno** — pero sí debe **avisar** cuando `x_cp`
   está numéricamente degenerado.

8. **Aceptar o rechazar el resultado de un solver no viscoso para arrastre.** [§1.10.2, p. 63]
   *"inviscid theories by themselves cannot adequately predict total drag."* → La UI puede negarse a
   poner un número de `cd` sin modelo viscoso, pero **la decisión de usarlo igual, sabiendo el sesgo,
   es del ingeniero**.

9. **La forma conservativa vs no conservativa en el solver numérico.** [§2.10, p. 159] *"in most cases,
   there is no particular reason to choose one form over the other… However, for the numerical solution
   of some aerodynamic problems, the conservation form sometimes leads to more accurate results."*
   "Sometimes" es literalmente una decisión de ingeniería numérica, no una regla.

10. **El propio Anderson señala el valor del juicio por encima del cálculo** [§2.3, p. 119]:
    *"An important virtue of all successful aerodynamicists (indeed, of all successful engineers and
    scientists) is that they have good 'physical intuition,' based on thought and experience, which
    allows them to make reasonable judgments on difficult problems."* → **La misión de la escuela de la
    Forja, dicha por el cliente.**

11. **Elegir la forma supuesta del campo sobre la superficie de control.** [§2.6.1, p. 146] *"The
    weakness here is the need to **assume some form** for the variation of flow properties over the
    control surface."* El Ejemplo 2.2 muestra que dos suposiciones distintas (`n = 2` y `n = 0.25`)
    satisfacen **igual de bien** el balance de momento, y una es físicamente absurda. → El software
    no puede elegir el perfil; el ingeniero sí, y con criterio físico (¿cóncavo o convexo?), no
    numérico.

12. **Decidir la extensión y el refinamiento de la malla.** [§2.17.2, p. 196] *"The generation of an
    appropriate grid for a given flow problem is frequently a challenge, and **grid generation has
    emerged as a subdiscipline in its own right within CFD**."* El libro solo da dos reglas
    cualitativas (extender mucho en subsónico; refinar mucho cerca de la pared). El resto es juicio.

13. **Aceptar el error de linealización.** [§2.17.1, p. 188] La solución analítica del perfil delgado
    compresible vale si *"the airfoil is thin and at a small angle of attack, and if the freestream
    Mach number is not near one (not transonic) nor above five (not hypersonic)"*. **"Thin" y "small"
    no están cuantificados en el libro.** El software debe pedir al ingeniero que declare el umbral, y
    guardarlo con el resultado, en vez de inventar uno.

14. **Cuándo dejar de calcular y comparar contra el mundo.** El Ejemplo 1.12 valida 704 hp contra un
    motor real de 1050 hp y 257.6 mi/h contra una velocidad de crucero publicada de 260 mi/h. Ese
    cierre de lazo **no lo hace ninguna ecuación**: lo hace el ingeniero que sabe dónde buscar el dato.

---

## 5. COSTO DE CÓMPUTO

| Método / cálculo | § | Costo | Por qué |
|---|---|---|---|
| Coeficientes `CL, CD, CM, Cp, cf, Re, M, q∞` a partir de fuerzas o datos | §1.5, §1.7 | **[NAVEGADOR]** | aritmética escalar; microsegundos |
| Integral de superficie (1.7)/(1.8)/(1.11) o (1.15)–(1.17) sobre una piel 2D ya panelizada | §1.5 | **[NAVEGADOR]** | O(n) sobre paneles; 400 paneles = fracción de ms. **Medido:** la cuña del Ej. 1.1 converge al 1 % con **50 paneles** |
| Integral de superficie sobre malla 3D (Ej. 1.2, cuerpo de revolución o B-Rep) | §1.5 | **[NAVEGADOR]** hasta ~10⁵ caras; **[PRECÓMPUTO]** arriba | sigue siendo O(n) pero la extracción de la malla desde OCCT domina el tiempo |
| Centro de presión y conversión entre las tres representaciones | §1.6 | **[NAVEGADOR]** | álgebra pura, Ec. (1.22) |
| Cadena de similitud dinámica (verificar/derivar condiciones equivalentes) | §1.8 | **[NAVEGADOR]** | son cocientes; Ejs. 1.5 y 1.6 son 6 líneas |
| Vuelo nivelado: `CL(V)`, `CD(V)`, `L/D(V)`, `V_stall`, `V_max` | Design Box §1.8 | **[NAVEGADOR]** | barrido de 200 puntos = instantáneo. **La curva del Problema 1.15 es un widget vivo** |
| Atmósfera estándar `p(h), ρ(h), T(h), a(h)` | §1.9 Ej. 1.10 | **[NAVEGADOR]** | forma cerrada (E1.5); ya está en `atmosfera.ts` |
| Campo potencial 2D analítico (pared ondulada, vórtice, fuente) — `u, v, ∇·V, ∇×V, ψ, φ` | §2.3.5, §2.12, §2.14, §2.15 | **[NAVEGADOR]** | evaluación puntual de fórmula cerrada; 60 fps sobre retícula 200×200 |
| Trazado de líneas de corriente / trayectorias (RK4) | §2.11 | **[NAVEGADOR]** | ~10³ pasos por línea; ya funciona en `potencial.ts` |
| `Γ = −∮V·ds` sobre un contorno | §2.13 | **[NAVEGADOR]** | 4000 muestras = instantáneo |
| **Tabla `CL/CD/CM = f(forma, α, Re, M)`** — el producto real | §1.7, §1.8 | **[PRECÓMPUTO]** | 4 ejes; con 40 α × 20 Re × 20 M × N formas ya son 16,000·N casos. **Éste es EL trabajo de la 4070 Ti.** La similitud dinámica (§1.8) es la licencia formal: un caso adimensional sirve a infinitos casos dimensionales |
| Barrido de la nube `Cp(x)` sobre una familia paramétrica de perfiles | §1.5 | **[PRECÓMPUTO]** | se sirve como campo/textura; el navegador solo interpola |
| Operadores `∇p`, `∇·V`, `∇×V` sobre un campo analítico o una retícula 2D | §2.2 | **[NAVEGADOR]** | diferencias centradas (2.174) sobre 200×200 = 40k puntos, trivial |
| Arrastre por levantamiento de estela (2.83)/(2.84) desde un perfil `u2(y)` medido o simulado | §2.6 | **[NAVEGADOR]** | una integral 1D. **Lo caro es obtener `u2(y)`, no integrarlo** |
| Validador de órdenes de magnitud (tabla `anderson-rangos-1.12`) | §1.12 | **[NAVEGADOR]** | comparaciones; es una tabla de 20 entradas |
| Potencia requerida / punto de crucero (Ej. 1.12) | §1.12 | **[NAVEGADOR]** | 5 líneas de álgebra |
| Solución de Euler (2.71)/(2.72a–c) sobre malla | §2.5 | **[GPU-VIVO]** | sistema no lineal acoplado; iterativo |
| Navier-Stokes (2.70a–c) + energía (2.96) | §2.5, §2.7 | **[GPU-VIVO]** | 5 incógnitas acopladas (ρ, p, V, e, T) por celda. Es **el** salto de costo del producto. El caso de referencia del libro (Fig. 2.42: perfil a α=14°, M∞=0.5, Re=3e5, no estacionario, viscoso, turbulento, separado) *"can only be obtained by means of CFD"* |
| Esquema explícito 1D (2.178) — el del Ejemplo 2.10 | §2.17.2 | **[NAVEGADOR]** en 1D didáctico; **[GPU-VIVO]** en 2D/3D real | en 1D con ~10³ nodos corre a 60 fps; sirve para la escuela |
| Generación de malla (extensión grande en subsónico + refinado en la pared) | §2.17.2 | **[PRECÓMPUTO]** | *"grid generation has emerged as a subdiscipline in its own right"*; se hace una vez por geometría y se cachea |
| Capa límite acoplada (`τw`, `δ`, `q̇w`) | §1.11 | **[PRECÓMPUTO]** por perfil; **[GPU-VIVO]** si hay separación | mientras la capa esté adherida, `Cp` de la solución no viscosa la alimenta y el resultado se tabula |

**La tesis de arquitectura, en una línea del libro (§1.7, p. 39):** *"by using the Buckingham pi
theorem, we have reduced the number of independent variables from five in Equation (1.23) to two in
Equation (1.38)."* Sin adimensionalizar, la tabla precomputada tendría **5 ejes dimensionales** y sería
inservible. Con `Re` y `M`, cabe en la VRAM.

**Clave de caché recomendada:** `hash(forma_adimensional) : α : Re : M∞`. Nada más. Y **el registro
debe guardar `S_ref` y `l_ref`** aunque no formen parte de la clave, porque el resultado no se puede
interpretar sin ellos (§1.5, p. 25).

---

## 6. ESCUELA — lecciones que salen de este bloque

Todas viven **dentro del CAD** (`forja-brep.html`): el alumno **dibuja con croquis y cotas**, luego
corre un **estudio**. No hay simulador de juguete aparte.

---

### L1 — "Las dos manos": p y τ (§1.4, §1.5)
- **Construye:** una cuña simétrica de semiángulo 5° y cuerda 2 m, dibujada con croquis y **acotada**
  (5° y 2 m son cotas, no coordenadas tecleadas).
- **Mueve:** el semiángulo (2°…15°) y el número de paneles del integrador (10 → 400).
- **Ve:** dos campos de flechas sobre la piel — `p` normal (azul) y `τ` tangente (rojo) — y **la suma
  acumulándose panel a panel** hasta cerrar el arrastre. Y la barra 85/15 llenándose.
- **Verifica contra el número:** `D' = 1.24e4 N/m` y `cd = 0.022` del **Ejemplo 1.1** (fixture
  `anderson-ej-1.1`, tolerancia 1 %). Y la convergencia: con 50 paneles ya está al 1 %.
- **Lo que el alumno se lleva:** *"the only mechanisms nature has for communicating a force to a body
  moving through a fluid are pressure and shear stress distributions on the body surface"* (§1.5).

### L2 — "El mismo número, dos áreas distintas" (§1.5, p. 25)
- **Construye:** una esfera y un ala rectangular con el **mismo** arrastre en newtons.
- **Mueve:** el selector de área de referencia (`planta` / `frontal` / `mojada`).
- **Ve:** el `CD` cambiando de valor **sin que cambie ni una molécula de aire**.
- **Verifica:** el `CD` del cono del **Ejemplo 1.2** referido a la base es **exactamente su `Cp`**;
  referido a cualquier otra área, no.
- **Lo que se lleva:** un coeficiente sin su `S` no es un dato. Es la lección más rentable del bloque.

### L3 — "El centro de presión se te escapa" (§1.6, §1.13)
- **Construye:** un NACA 4412 (o cualquier perfil con camber del alumno).
- **Mueve:** el ángulo de ataque de −4° a 14°, con `cl` y `cm_c/4` de la tabla del Problema 1.6.
- **Ve:** el punto de aplicación de la resultante **corriendo por la cuerda y saliéndose del dibujo**
  cuando `cl → 0`. Y al lado, la representación en c/4, que **no se mueve**.
- **Verifica:** **Ejemplo 1.3**, `x_cp/c = 0.356` a α=4°. Y luego el **Ejemplo 1.4** (DC-3): con dos
  momentos, `L' = 556.6 lb/ft` y `x_cp = 5.774 ft`.
- **Lo que se lleva:** por qué la NACA dejó de publicar `x_cp` para perfiles (§1.13, p. 93) y por qué
  los misiles sí lo siguen publicando.

### L4 — "Un solo caso sirve para muchos" (§1.7, §1.8) — **la lección clave del producto**
- **Construye:** dos cilindros, uno con 4× el diámetro del otro.
- **Mueve:** `ρ`, `V` y `T` del caso grande hasta hacer coincidir `Re` y `M` con el chico
  (la receta del **Ejemplo 1.5**: `ρ2 = ρ1/4`, `V2 = 2V1`, `T2 = 4T1`).
- **Ve:** los dos campos superpuestos **colapsando en el mismo dibujo** cuando los dos números
  coinciden, y separándose en cuanto mueves uno.
- **Verifica:** `CD1 = CD2` exacto (**Ejemplo 1.5**). Y luego el reto caro: **Ejemplo 1.6**, el 747 a
  1/50 exige `p = 11.26 atm` en el túnel.
- **Lo que se lleva:** por qué la Forja precomputa. Y por qué eso no es hacer trampa.

### L5 — "Tu avión en una curva" (Design Box §1.8)
- **Construye:** el alumno mete `W` y `S` de su propio diseño conceptual.
- **Mueve:** la velocidad de vuelo de `V_stall` a `V_max`.
- **Ve:** las tres curvas del libro apareciendo solas: `CL(V)` cayendo, `CD(V)` con su mínimo, y
  `L/D(V)` con su máximo — y el ángulo de ataque bajando conforme acelera.
- **Verifica:** **Ejemplo 1.7** (`CL = 0.21`, `L/D = 14`) y **Ejemplo 1.8** (`CL,max = 1.81`).
  Y el **Problema 1.15**, que es literalmente esta lección con un Cessna Skylane:
  `CD = 0.025 + 0.054·CL²`, `W = 2950 lb`, `S = 174 ft²`, de 70 a 250 ft/s.
- **Lo que se lleva:** *"Obtaining raw lift on a body is relatively easy—even a barn door creates lift
  at angle of attack. The name of the game is to obtain the necessary lift with as low a drag as
  possible."*

### L6 — "El aire se pega" (§1.11)
- **Construye:** una placa plana a α = 0 (la geometría más simple posible del CAD).
- **Mueve:** el `Re` (por velocidad o por longitud) y el interruptor laminar/turbulento.
- **Ve:** el perfil de velocidad dentro de la capa límite, la pendiente en la pared, y `δ` creciendo
  con `x`. Y el perfil turbulento **más lleno** con pendiente mayor.
- **Verifica:** **Problema 1.16** — placa plana a Mach 10, nivel del mar, `x = 0.5 m`,
  `τw = 282 N/m²`, `Tw = T_nivel_del_mar` → calcular `(dV/dy)|w` con la Ec. (1.59) y
  `μ = 1.7894e−5 kg/(m·s)`. Es un fixture de una línea.
- **Lo que se lleva:** `(τw)_lam < (τw)_turb`, y que **el arrastre de fricción de un A380 sale de esa
  capa delgada**.

### L7 — "Este paquete de aire lleva 36 g" (§2.3.4, §2.9)
- **Construye:** la **pared ondulada** de los Ejemplos 2.1/2.3/2.7/2.9 — un croquis de coseno con
  amplitud `h` y longitud de onda `l` acotadas.
- **Mueve:** `M∞` (0.1 → 0.85) y la posición de la sonda.
- **Ve:** **dos widgets lado a lado**: la sonda fija midiendo `∂/∂t` (cero, el flujo es estacionario)
  y el trazador montado en un elemento midiendo `D/Dt` (enorme). Y el elemento **encogiéndose y
  estirándose** con `∇·V`.
- **Verifica:** `∇·V = −0.7327 s⁻¹` (**Ejemplo 2.1**) y `|a| = 358.6 m/s² = 36.6 g` (**Ejemplo 2.3**).
- **Lo que se lleva:** la derivada local y la sustancial son cosas **físicamente distintas**, y el
  libro te lo enseña con la cueva y la bola de nieve (§2.9, p. 154).

### L8 — "Gira o no gira" (§2.12)
- **Construye:** tres campos: el flujo uniforme, el campo del Ej. 2.4 (vórtice puntual) y el perfil de
  capa límite `u/V∞ = (y/δ)^0.25` del Ej. 2.6.
- **Mueve:** una cruz de dos varillas rígidas soltada en el campo.
- **Ve:** en el uniforme no gira; en el vórtice **no gira** (¡aunque el aire da vueltas!); en la capa
  límite **sí gira**.
- **Verifica:** **Ejemplo 2.5** (`∇×V = 0` salvo en el origen), **Ejemplo 2.6** (rotacional),
  **Ejemplo 2.7** (`∂v/∂x − ∂u/∂y = 0` idénticamente).
- **Lo que se lleva:** "irrotacional" **no** significa "el aire no da vueltas"; significa que el
  elemento no rota sobre sí mismo. Y "viscoso ⇒ rotacional" siempre.

### L9 — "La circulación no es dar vueltas" (§2.13)
- **Construye:** un lazo cerrado dibujado por el alumno (¡con croquis!) alrededor de un perfil.
- **Mueve:** el tamaño y la forma del lazo, y el ángulo de ataque.
- **Ve:** la integral `−∮V·ds` acumulándose alrededor del lazo, y **quedándose en el mismo valor**
  aunque el alumno deforme el lazo — mientras encierre el perfil. Y colapsando a cero si no lo encierra.
- **Verifica:** **Ejemplo 2.8**, `Γ = 2π m²/s`, **independiente del radio**. Y el test que ya existe en
  `potencial.test.ts` con la convención de signo de Anderson.
- **Lo que se lleva:** la advertencia literal del libro contra la imagen mental de "aire dando vueltas"
  (§2.13, p. 177). **La animación NO debe mostrar el aire circulando alrededor del perfil.**

### L10 — "De tres incógnitas a una" (§2.14, §2.15, §2.16)
- **Construye:** el campo potencial del alumno alrededor de su geometría.
- **Mueve:** el número de líneas `ψ = cte` y `φ = cte` dibujadas.
- **Ve:** la **retícula ortogonal** apareciendo, y el caudal entre dos líneas de corriente **siendo el
  mismo** a lo largo del tubo.
- **Verifica:** (a) `Δψ` entre dos líneas = caudal calculado por integración directa de `ρ·V·n` en dos
  secciones distintas del tubo (invariante del §2.11, p. 164); (b) **ortogonalidad** por la Ec. (2.165);
  (c) **Ejemplo 2.9**, `∇φ` reconstruye (2.35) y (2.36).
- **Lo que se lleva:** *"Instead of dealing with the velocity components as unknowns, hence requiring
  three equations… we can deal with the velocity potential as one unknown, therefore requiring the
  solution of only one equation."* Es por qué esta lección corre en el navegador y no en iangpu.

### L11 — "La fuerza que empuja hacia adelante" (§1.16)
- **Construye:** un perfil con camber (NACA 2412) y una placa plana.
- **Mueve:** `α` de 0° a 12°.
- **Ve:** el vector resultante `R` **cruzando la perpendicular a la cuerda** y la componente axial
  volteándose hacia adelante.
- **Verifica:** `L/D > cot(α)` ⇔ `A < 0`. Caso: NACA 2412 a 6°, `cl/cd = 110 > cot6° = 9.52`.
- **Lo que se lleva:** la intuición miente, y la geometría de la descomposición de `R` no. Y el
  Problema 1.20: ¿le pasa lo mismo a una placa plana?

### L12 — "Mido el arrastre sin tocar el cuerpo" (§2.6)
- **Construye:** cualquier sección 2D que el alumno haya dibujado (la cuña de L1 sirve), más un
  **volumen de control dibujado a mano** con croquis: dos líneas de corriente arriba y abajo, dos
  estaciones verticales, y el corte que envuelve la pieza.
- **Mueve:** la posición de la estación de salida (`bh`), acercándola y alejándola del cuerpo.
- **Ve:** el perfil `u2(y)` con su déficit de estela, y el área bajo `ρ2·u2·(u1 − u2)` llenándose —
  y **el número convergiendo al mismo `D'` que dio la integral de superficie de L1**, aunque el
  contorno esté lejísimos.
- **Verifica:** (a) que `D'` por estela (2.84) coincide con `D'` por integral de piel (1.8) para el
  mismo caso — **es el mejor test cruzado del bloque**; (b) **Ejemplo 2.2**: `n = 2` o `n = 0.25`.
- **Lo que se lleva:** *"it relates drag on a body located at some position in the flow to the
  flow-field variables at a completely different location"* — y la lección amarga del §2.6.1:
  el balance integral se cumple **también** para el perfil físicamente absurdo (`n = 2`). Satisfacer
  la conservación **no** es lo mismo que ser correcto.

### L13 — "¿Este número tiene sentido?" (§1.12)
- **Construye:** nada nuevo — el alumno trae los resultados de sus lecciones anteriores.
- **Mueve:** un "termómetro" de órdenes de magnitud donde cae su `CD`, `cd`, `Cf`, `cl`, `cm`, `L/D`
  y `Re`, junto a las referencias reales del libro.
- **Ve:** que su perfil con `cd = 0.05` está **10 veces fuera**; que su avión con `L/D = 60` es
  imposible (el B-52 llega a 21.5); que su `Re = 5000` no corresponde a nada que vuele.
- **Verifica:** la tabla completa del fixture `anderson-rangos-1.12`. Y el reto: reproducir la
  **identidad del carenado** — un cuerpo aerodinámico 10× más grueso que un cilindro tiene el mismo
  arrastre (`0.12·q∞·d` en ambos casos).
- **Lo que se lleva:** la pregunta con la que Anderson abre §1.12 — *"do you expect a drag coefficient
  to be as low as 1e−5, or maybe as high as 1000—**does this make sense?**"* Es la habilidad que
  separa a un ingeniero de un usuario de software.

### L14 — "Por qué hay tres formas de resolverlo" (§2.17)
- **Construye:** un caso que el alumno ya tenga resuelto por vía analítica (la cuña del Ej. 1.1).
- **Mueve:** el número de nodos de una malla 1D y el paso `Δt` del esquema explícito (2.178).
- **Ve:** tres columnas lado a lado — **teoría** (fórmula cerrada, valor exacto en cualquier punto),
  **CFD** (números **solo en los nodos**), y **experimento** (los datos del túnel del libro). Y la
  solución numérica **explotando** cuando `Δt` es demasiado grande.
- **Verifica:** que la diferencia centrada (2.174) converge como `(Δx)²` y la adelantada (2.168) como
  `Δx` — se mide graficando el error contra `Δx` en log-log; la pendiente debe ser 2 y 1.
- **Lo que se lleva:** *"CFD is today an **equal partner** with pure theory and pure experiment"*
  (§2.17.3) — y la advertencia: *"do not be misled. Computational fluid dynamics is a sophisticated
  and complex discipline."* Estabilidad, exactitud y costo son parte del resultado, no notas al pie.

---

## 7. NO OBSERVADO — figuras y tablas que eran imagen

El `.txt` viene de `pdftotext`. **Ninguna figura tiene contenido gráfico**; en el mejor caso sobrevive
el pie y algunos rótulos sueltos. En los caps. 1–2 hay **66 figuras del cap. 1 (1.1–1.66)**, un número
comparable en el cap. 2, y **una sola tabla (Tabla 1.1, unidades — ésta SÍ se recuperó completa)**.

**Figuras cuya pérdida BLOQUEA un requisito (hay que sacarlas del PDF aparte):**

- **Figura 1.12** — *Road map del capítulo 1*. Es la taxonomía visual completa del capítulo.
  (Errata detectada: §1.15, p. 97, la llama "Figure 1.11"; §1.3, p. 15, la llama "Figure 1.12".
  Correcta: 1.12.)
- **Figura 1.45** — *Block diagram categorizing the types of aerodynamic flows*. Declarada por el
  propio autor como *"a road map for this entire book"*, con bloques **letrados** (C, D, E, F…) a los
  que el libro se refiere después. **Sin esta figura no puedo reproducir el enrutador de solvers con
  las etiquetas del libro.**
- **Figura 1.65** — *The Lilienthal Table of normal and axial force coefficients*. Es el facsímil de la
  tabla de `η` y `θ` vs ángulo de ataque publicada por Chanute (1897) y usada por los Wright.
  **Ningún valor numérico de esa tabla existe en el .txt.** Los Problemas 1.19 y 1.20 la necesitan.
- **Figura 1.64** — mediciones de los Wright del centro de presión (gráfica manuscrita de Wilbur,
  25 julio 1905). De ella solo sobrevive la prosa: dos perfiles (h/c = 1/12 y 1/20) y que la excursión
  más adelantada del `x_cp` es **33 % de la cuerda**.
- **Figura 1.58** — desglose del arrastre del **Seversky XP-41: las 18 configuraciones con sus `ΔCD`
  incrementales tabulados**. **NO OBSERVADA — es la segunda pérdida más grave del bloque.** La tabla
  de los 18 incrementos (que es exactamente el tipo de dato que un CAD conceptual quiere para estimar
  arrastre parásito por componente) **no existe en el texto**. Solo sobreviven los extremos:
  `CD = 0.0166` (limpio) → `CD = 0.0275` (operacional), +65 %. Datos del **NACA Langley Full-Scale
  Tunnel**, sección de prueba de **30 × 60 ft**, justo antes de la 2ª Guerra Mundial; fuente citada:
  Coe, Paul J., *"Review of Drag Cleanup Tests in Langley Full-Scale Tunnel (From 1935 to 1945)
  Applicable to Current General Aviation Airplanes,"* NASA TN-D-8206, 1976.
- **Figuras 1.56, 1.57, 1.60, 1.61, 1.62, 1.63** — todas las curvas cuantitativas de §1.12:
  `Cf(Re)` laminar/turbulento de placa plana; `cd(α)` y `cl(α)` y `cm_c/4(α)` del **NACA 63-210** a
  `Re = 3e6`; `CD(M)` de sustentación nula del **T-38**; `CL(α)` del T-38 con **tres deflexiones de
  flap a M = 0.4** (los ángulos de flap **no se dan en el texto**). **NO OBSERVADAS.** De ellas solo
  tengo los valores puntuales que la prosa cita, recogidos en el fixture `anderson-rangos-1.12`.
- **Figura 1.55** — barras comparativas de fricción vs presión para las cinco formas. **NO OBSERVADA
  y sin ningún reparto porcentual en el texto.** Solo la conclusión cualitativa: placa y cilindros
  dominados por presión, cuerpo aerodinámico dominado por fricción.
- **Figura 1.54 (a–e)** — **PARCIALMENTE recuperada**: el OCR sí capturó las etiquetas de `Re` y `CD`
  (2.0 / 1.2 / 0.12 / 1.2 / 0.6), que son el contenido útil. Los dibujos de estela y los puntos de
  separación son imagen. Fuente: Talay, T. A., *Introduction to the Aerodynamics of Flight*,
  NASA SP-367, 1975.
- **Figuras 4.10 y 4.11** (referenciadas desde §1.16) — curvas `cl(α)` y `cd(cl)` del **NACA 2412**.
  El fixture `anderson-iwc-1.16` solo tiene los dos puntos que la prosa cita (`cl = 0.88`,
  `cd = 0.008` a α=6°). La curva completa está fuera de alcance de este bloque.
- **Figuras 2.42 y 2.43** — el campo de flujo separado calculado por CFD (perfil a α=14°, M∞=0.5,
  Re=3e5, Referencia 53) y **la malla usada para resolverlo**. **NO OBSERVADAS.** Las dos reglas de
  mallado que extraje (extensión grande en subsónico, refinado en la pared) vienen **de la prosa**,
  no de la figura. *Errata del libro:* el pie de la Fig. 2.43 remite a la *"Figure 2.40"*; el cuerpo
  del texto dice correctamente Figura 2.42.
- **Figuras 2.20b, 2.21, 2.22, 2.23, 2.24** (§2.6) — foto de los perfiles de estela con burbujas de
  hidrógeno; reacciones `R` / `−R`; el **Pitot rake**; la capa límite de la placa; y la **comparación
  del perfil laminar exacto con `n = 2` y `n = 0.25`**. **NO OBSERVADAS**; de la 2.24 no hay ningún
  valor numérico del perfil exacto en el texto, solo el juicio cualitativo cóncavo/convexo.
- **Figuras 2.4 a 2.12** (§2.2) — todos los diagramas del kit vectorial: suma/resta/producto vectorial
  y regla de la mano derecha, los tres sistemas de coordenadas, el gradiente con sus isolíneas, la
  derivada direccional, las integrales de línea, y **la superficie cerrada con la normal saliente**.
  **NO OBSERVADAS** (la 2.11 sobrevive como esquema ASCII con `n, P, S, dS, C`). Las convenciones de
  normal y tangente que documenté vienen de la **prosa**, que por suerte es explícita.
- **Figura 2.46** — *"The three equal partners of modern aerodynamics"*. **NO OBSERVADA**; solo las
  tres etiquetas: *Pure experiment*, *Pure theory*, *Computational fluid dynamics*.
- **Apéndices D y E** (atmósfera estándar ARDC 1959, SI e inglés) — fuera del rango de líneas. Los
  Ejemplos 1.10 y 1.11 y los Problemas 1.12 y 1.15 **dependen** de valores tabulados de ahí. Si el
  software va a replicar exactamente las tablas del libro, hay que extraerlas por separado.
- **Apéndice C** (función de Prandtl-Meyer y ángulo de Mach) — no necesario para caps. 1–2.

**Figuras conceptuales perdidas (la prosa alcanza, pero el dibujo ayudaría a la escuela):**
1.7 (modelo de flujo de Newton), 1.9 y 1.10 (calentamiento de reentrada esbelto vs romo),
1.13 (velocidad y líneas de corriente), 1.14 (fricción por gradiente), 1.15 (p y τ sobre la
superficie), 1.16 y 1.17 (**descomposición de R en L/D y N/A — la figura maestra de §1.5**),
1.18 y 1.19 (**nomenclatura de la integración: la convención de signo de θ solo está en prosa**),
1.20 (signo del momento), 1.21 (**áreas y longitudes de referencia por forma**), 1.22 (dx, dy, ds),
1.23 (la cuña del Ejemplo 1.1, con sus tramos s1…s4), 1.24 (el cono del Ejemplo 1.2),
1.25 y 1.26 (**centro de presión y las tres representaciones equivalentes**), 1.27 y 1.28 (similitud),
1.31–1.36 (**las curvas genéricas del Design Box: CL/CD vs α, CL vs V, CD vs V, L/D vs V, L/D vs α**),
1.38–1.41 (estática de fluidos, manómetro, flotación), 1.42 y 1.43 (división viscoso/no viscoso;
flujos dominados por viscosidad), 1.44 (**los cinco regímenes de Mach**), 1.46–1.53 (capa límite,
perfiles de velocidad y temperatura, laminar vs turbulento), 1.66 (**la geometría de la fuerza axial
hacia adelante**), 2.3 (road map del cap. 2), 2.11 (superficie abierta y curva C para Stokes),
2.13–2.16 (modelos de fluido, campo de flujo), 2.17 (**la pared ondulada de los Ejs. 2.1/2.3/2.7/2.9**),
2.18 y 2.19 (flujo másico, volumen de control fijo), 2.25 (trabajo de una fuerza),
2.26 (derivada sustancial), 2.27–2.31 (líneas de trayectoria/corriente/traza, tubo de corriente),
2.32–2.37 (**rotación y deformación de un elemento — la figura 2.33 es la derivación completa**),
2.38 y 2.39 (circulación y su relación con la vorticidad), 2.40 y 2.41 (función de corriente).

**Figuras que son solo fotografía** (sin contenido técnico perdido): 1.1 DC-3, 1.2 Boeing 707,
1.3 Bell X-1, 1.4 F-104, 1.5 F-22, 1.6 blended wing body, 1.8 túnel de los Wright, 1.11 láser
gasdinámico, 1.29 y 1.30 el NACA Variable Density Tunnel, 1.37 tres vistas del Cessna 560.

**Lo que sí se recuperó completo:** Tabla 1.1 (unidades SI vs inglés de ingeniería), toda la tabla de
datos del **Problema 1.6** (NACA 2412: `α`, `cl`, `cd`, `cm,c/4` de −2° a 14°) — que es un fixture
gratis para la lección L3 — y todas las ecuaciones numeradas de ambos capítulos.

**Símbolos perdidos por `pdftotext` que hay que reconstruir con cuidado (lista completa detectada):**
1. **`Δ` (delta mayúscula) borrada** en todo el documento: `Δh` sale como `h`, `Δψ` como `ψ`, y en
   §2.17.2 y las Ecs. (2.166)–(2.178) `Δx`, `Δy`, `Δt` salen como `x`, `y`, `t`. (Se confirma porque
   el arte ASCII de la Figura 2.44 **sí** conserva `Δx` y `Δy`.)
2. **`Φ` (tercer ángulo esférico) borrada** en todo §2.2: aparece como `(r, θ, )`.
3. **`ℓ` (longitud de onda) borrada**: `T = 2π·sqrt(/g)` es `sqrt(ℓ/g)`; `= 1.0 m` es `ℓ = 1.0 m`.
4. **Signos de raíz cuadrada borrados** en (2.6) y (2.8) — el radicando sí está.
5. **Símbolos de integral cerrada** (`∮`, `∯`, `∭`) renderizados como cadenas de puntos.
6. **Exponentes desplazados de línea o perdidos**: `sin2 θ` = `sin²θ`; `43 π(15)3` = `(4/3)·π·15³`;
   `(1 − M∞ ) . / 2 1/2` = `(1 − M∞²)^(1/2)`; y en el cálculo del Ejemplo 2.1 `(2π/1)` es
   `(2π/ℓ)²` — **verificado por aritmética**: con el cuadrado da −0.732 (coincide con el −0.7327
   publicado); sin el cuadrado daría −0.117.
7. **Al menos una fracción invertida**: `m = 32.2/800` en el Ejemplo 1.9, donde el valor publicado
   (24.8 slug) confirma que es `800/32.2`.
8. **Determinantes (2.12), (2.14), (2.23), (2.24)** el libro los da sin expandir — no es pérdida de
   OCR, pero significa que expandirlos es trabajo nuestro y hay que verificarlo.

**Regla:** no copiar ningún número del `.txt` sin rehacer la aritmética. Tres de los siete errores de
arriba habrían producido resultados falsos y plausibles.

**Erratas del propio libro detectadas en este bloque (no propagar):**
- §1.15 (p. 97) llama *"Figure 1.11"* al road map del cap. 1; §1.3 (p. 15) lo llama correctamente
  **Figura 1.12**.
- Ejemplo 1.7: el enunciado da `ρ∞ = 7.9656e−4` y la solución usa `7.9659e−4`.
- Ejemplo 1.12: cita *"Equation (E1.12.3)"* donde usa la **(E1.12.4)**.
- Ejemplo 2.3, Ec. (E2.2): imprime `ay = u·∂u/∂x + v·∂v/∂y`; debe ser `ay = u·∂v/∂x + v·∂v/∂y`
  (los números publicados corresponden a la forma correcta).
- Ejemplo 2.6: imprime `x^(−1/9)` y `x^(−1.8)` donde la cadena de la derivación da `x^(−1/8)`.
- Pie de la Figura 2.43: remite a la *"Figure 2.40"*; debe ser la **2.42**.

---

## 8. LO QUE MÁS ME SORPRENDIÓ — lo que una máquina lineal se salta

**1. La integral de superficie no necesita saber NADA de física.** Las Ecuaciones (1.7), (1.8) y (1.11)
son exactas para cualquier flujo — viscoso o no, compresible o no, subsónico o hipersónico. No tienen
un solo supuesto. Toda la dificultad de la aerodinámica está **antes**: en conocer `p(s)` y `τ(s)`.
Esto reordena la arquitectura del producto: **el integrador es infraestructura estable y compartida
por todos los solvers**, no una parte del solver. Se escribe una vez, se testea contra el Ejemplo 1.1,
y no se toca más.

**2. `Cp` no es "presión bonita": es lo que hace que la integral cierre sobre un cuerpo cerrado.**
El Ejemplo 1.1 tiene dos soluciones. La primera integra `p` y necesita tratar la culata de la cuña
**explícitamente** (`−p∞·2c·tan5° = −35,350 N`, empujando hacia adelante). La segunda integra `Cp` con
la Ec. (1.16) y **la culata simplemente desaparece** — porque ahí `Cp = 0`. Ambas dan 0.022. El motivo
es el Problema 2.1 (p. 200): la integral de una presión **constante** sobre un cuerpo cerrado es cero.
→ **Requisito de software que ningún libro dice en voz alta:** si el integrador trabaja en `Cp`, la
piel del alumno **tiene que estar cerrada**, y el validador de geometría debe exigirlo antes de
integrar. Si trabaja en `p`, no necesita el cierre pero sí necesita todas las caras, incluida la base.
Es exactamente el tipo de decisión que hunde un CAD si se toma sin darse cuenta.

**3. Los "rules of thumb" están etiquetados como tales — tres veces, con creciente vehemencia.**
Anderson escribe *"just a loose rule of thumb"*, luego *"a very tenuous rule of thumb and should not
be taken literally"*, y luego *"a somewhat arbitrary but frequently used rule of thumb"*. Un extractor
automático de requisitos convertiría `M∞ > 1.2 → supersónico` en una constante dura y el producto
mentiría. El cliente **explícitamente** nos prohíbe hacerlo. → En la Forja, todo umbral heredado de un
"rule of thumb" debe llevar su etiqueta visible en la UI.

**4. El signo de la circulación es una trampa histórica, y el libro pone la trampa en una nota al pie.**
`Γ ≡ −∮V·ds` (2.136) porque *"in aerodynamics, it is convenient to consider a positive circulation as
being clockwise"*. Y la nota al pie de la p. 177 avisa que **otros libros no ponen el menos**.
Nuestro `src/aero/potencial.ts` tiene el test **correcto** (verifica `∮u·dl ≈ −Γ`) y el **docstring
invertido** (dice que debe dar `+Γ`). El test manda, el comentario miente. Cuando alguien lea el
comentario y "arregle" la función, el test tronará y se perderá una tarde. **Es un bug de
documentación que se convierte en bug de código.** Corregir ya.

**5. Altitud geométrica ≠ altitud geopotencial, y el libro usa "must" dos veces.** Nuestro
`atmosfera.ts` no hace la distinción. A 5 km la diferencia es 0.08 % (irrelevante), pero el módulo se
declara válido hasta 20 km, donde ya importa. Además el docstring cita "Anderson cap. 3" cuando la
derivación está en **§1.9, Ejemplo 1.10 (cap. 1)**, y usa constantes ISO 2533 (`T0=288.15`, `R=287.053`,
`g=9.80665`) mientras el libro usa ARDC 1959 (`288.16`, `287`, `9.80`). Ninguno está mal, **pero no se
pueden correr los fixtures del libro sin poder cambiar las constantes**.

**6. El aire "tranquilo" está sometido a 36 g.** El Ejemplo 2.3 mide la deceleración de un elemento de
fluido en un flujo de perturbación **pequeña** sobre una pared ondulada: **358.6 m/s² = 36.6 g**,
cuando un humano aguanta 10 g unos segundos. Es el mejor gancho de la escuela que hay en estos dos
capítulos, y sale de una derivada sustancial, no de un choque ni de un vórtice. La intuición de que
"el flujo suave es suave" es falsa a escala de partícula.

**7. La reducción de 3 incógnitas a 1 es la razón económica de todo el laboratorio interactivo.**
§2.15, p. 184: si el flujo es irrotacional, `u, v, w` → `φ`. Tres ecuaciones → una. Y §2.12, p. 170
dice **dónde** vale: perfiles subsónicos, cuerpos esbeltos supersónicos, toberas. Es decir: **casi
todo el diseño conceptual de Raymer**. El hueco de mercado que el CONTRATO identifica (CAD conceptual
vs CAD de producción) coincide exactamente con el dominio donde el atajo irrotacional funciona. No es
coincidencia: es la razón de que el diseño conceptual sea rápido a mano desde hace un siglo.

**8. Y la trampa complementaria:** el mismo capítulo que regala el atajo también dice que
*"inviscid theories by themselves cannot adequately predict total drag"* (§1.10.2, p. 63). El
laboratorio del navegador puede dar `cl` creíble y **no** puede dar `cd` creíble. Un producto honesto
tiene que decirlo en la pantalla, no en la letra chica. Ésa es, probablemente, la decisión de producto
más importante que sale de este bloque.

**9. La historia de §1.14 es una lección de diseño de API, no una anécdota.** La cadena
Lilienthal (`N = 0.13·η·F·V²`, con el coeficiente de Smeaton **0.13 metido dentro**) → Langley
(`R = k·S·V²·F(α)`) → Wright (`L = k·S·V²·CL`) → Eiffel (`R = Ki·S·V²`, con la densidad **escondida**
en `Ki`) → NACA TR-20 (`F = C·ρ·S·V²`, la densidad **por fin explícita**) → Prandtl (`W = c·F·q`) →
la forma moderna `L = q∞·S·CL`, es exactamente la historia de una API que tardó **30 años** en separar
sus variables. Cada paso intermedio funcionaba y cada uno escondía una constante empírica que resultó
estar mal: *"the classical value of Smeaton's coefficient of 0.13 was in error by almost 40 percent"*.
Eso es lo que le costó a los Wright dos años de trabajo. → **Corolario para la Forja:** cualquier
coeficiente empírico embebido en una fórmula del producto es una deuda de 40 % esperando a cobrarse.
Sepáralos y hazlos visibles.

**10. Lilienthal no usó su propia fórmula para reducir sus datos.** El libro lo señala (§1.14): dividió
`N` y `T` **entre la fuerza medida a 90° de ángulo de ataque**, con lo que *"he divided out the
influence of uncertainties in Smeaton's coefficient and the velocity"*. Es decir: normalizó contra un
caso de referencia medido en el mismo aparato en vez de contra una constante publicada. **Es
exactamente la técnica correcta**, inventada 30 años antes de que existiera la teoría que la justifica.
Vale como lección de escuela sobre por qué la adimensionalización funciona.

**11. El cliente nos dictó la regla #4 del CONTRATO.** §2.4, p. 131, literal: *"It is important to keep
track of all assumptions that are used in the derivation of any equation because they tell you the
limitations on the final result, and therefore prevent you from using an equation for a situation in
which it is not valid. In all our future derivations, develop the habit of noting all assumptions that
go with the resulting equations."* No es un consejo pedagógico: es un **requisito funcional**. Todo
resultado que emita la Forja debe cargar su lista de supuestos, en el dato, no en la documentación.

**12. Conservar el momento NO es lo mismo que estar bien — y el libro construyó un ejemplo entero solo
para demostrarlo.** El Ejemplo 2.2 encuentra **dos** perfiles de capa límite (`n = 2` y `n = 0.25`)
que satisfacen **exactamente** el principio de momento sobre el volumen de control. Uno de los dos es
cóncavo y *"essentially nonphysical"*. El §2.6.1 lo remata: el volumen de control finito es
**unidireccional** — detalle → global es exacto, global → detalle **no está determinado**.
→ **Consecuencia dura para nuestro verificador:** una suite que solo compruebe balances integrales
(masa entra = masa sale, momento cerrado, energía cerrada) **aprobaría un campo físicamente absurdo**.
Es exactamente el fallo que la memoria del proyecto ya registró en otro dominio ("los gates NO miden
verdad", "el transistor inventado sacó el mejor score"). Anderson lo dice para aerodinámica en 1984 y
diseña un ejemplo específicamente para enseñarlo. **Todo gate de la Forja necesita, además del balance,
un criterio de forma** (¿el perfil es convexo? ¿la presión es monótona donde debe serlo?).

**13. El texto que faltó es justo el que un CAD conceptual más quiere.** La Figura 1.58 tabula los
**18 incrementos de `CD` del Seversky XP-41**, componente por componente, desde la configuración
limpia (0.0166) hasta la operacional (0.0275). Eso es, literalmente, una tabla de **arrastre parásito
por componente** — el corazón del método de estimación de arrastre de diseño conceptual (que es lo
que Raymer sistematiza). El `.txt` conserva los dos extremos y **ninguno de los 18 pasos**. Es la
pérdida de datos más costosa de todo el bloque, y hay que ir al PDF por ella.

**14. "No existe solución analítica general" está escrito en el capítulo 2, no escondido en un
apéndice.** §2.17.1, p. 187: *"to date, no general analytical solution to these equations has been
obtained."* Un producto honesto no puede prometer "resuelve la aerodinámica"; solo puede prometer
resolver **casos simplificados** (con su rango declarado) o **casos discretizados** (con su malla, su
error de truncamiento y su costo). El libro además enumera las **tres** ventajas de las soluciones
cerradas, y la tercera es literalmente nuestra propuesta de valor: *"simple tools for rapid
calculations, making possible the proverbial **'back of the envelope calculations' so important in the
preliminary design process**."* El CONTRATO dice que Raymer nos regaló el hueco de mercado; Anderson,
desde el capítulo 2, nos da la razón técnica de por qué ese hueco existe.

**15. El signo menos de la circulación estaba escrito 20 páginas antes, en la definición de la
integral de línea.** §2.2.8, p. 116: *"the counterclockwise direction around C is considered
positive."* §2.13, p. 176: en aerodinámica se prefiere positivo **horario**, luego `Γ ≡ −∮V·ds`. No
es una manía: es la reconciliación de dos convenciones que vienen de disciplinas distintas
(matemáticas vs. aerodinámica), y el libro las pone en la misma página mental. Leer §2.13 sin haber
leído §2.2.8 es exactamente cómo se genera el bug que tenemos documentado en `potencial.ts`.

**16. Los coeficientes NO son intercambiables entre 2D y 3D, y la brecha es de un orden de
magnitud.** `L/D` de un perfil: **110–130**. `L/D` de un avión completo: **10 (T-38) a 21.5 (B-52)**.
El libro explica por qué (fuselaje y góndolas que no levantan, y **arrastre inducido** de las puntas),
y §1.16 lo repite: *"the whole airplane has a greater surface area contributed by parts of the airplane
that do not produce lift, with a consequently much larger skin-friction drag."* Un alumno —o un
software— que arrastre un `cl/cd` de perfil hasta la ecuación de alcance del avión se equivoca por
un factor de 10. **La convención mayúscula/minúscula del libro no es tipografía: es un tipo de dato.**
