# Anderson caps 10–14 — Toberas, Prandtl-Glauert, supersónico linealizado, CFD y flujo hipersónico

Fuente: `docs/forja-research/manuales/aero/txt/anderson.txt` líneas **31514–43460** (leído completo).
Anderson, *Fundamentals of Aerodynamics*, 6ª ed. — cap. 10 (p.689–738), cap. 11 (p.739–810),
cap. 12 (p.811–827), cap. 13 (p.829–870), cap. 14 (p.871–922).
Fecha del análisis: 2026-08-04. Analista: agente Opus 5 (bloque caps 10–14 del pliego AERO).

> **Nota de lectura (defecto del `pdftotext`).** Las líneas **32769–33856** del `.txt` son un
> **bloque DUPLICADO** de las páginas 694–716 (repite desde la ec. 10.2 hasta §10.3.1). El texto
> nuevo se reanuda en la línea 33856 (`"Make certain to fix in your mind this proportionality"`).
> Lo verifiqué comparando párrafo por párrafo. No hay pérdida de contenido: la duplicación es
> byte-a-byte. Lo declaro aquí porque cualquier otro agente que lea este rango va a tropezar con lo
> mismo y va a creer que hay dos secciones §10.3.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

Estos cinco capítulos son **el puente entre el perfil que el cliente dibuja y el avión que vuela
rápido**. El bloque 1–9 de Anderson le dio al cliente la aerodinámica incompresible (paneles, línea
sustentadora) y los choques. Este bloque le da **cuatro cosas que valen dinero**:

| Cap | Qué es | Por qué le importa al cliente |
|---|---|---|
| **10** | Flujo casi-1D en ductos: tobera, difusor, túnel de viento | Es el **motor** (tobera de cohete/jet) y es el **laboratorio** (dimensionar el túnel supersónico donde valida sus modelos). Todo cálculo de empuje sale de aquí. |
| **11** | Flujo subsónico compresible sobre perfiles: teoría lineal | **La corrección más barata del libro.** Convierte un `Cp` incompresible (que La Forja ya calcula con paneles) en uno válido a Mach alto con una división. Y da `M_cr` y `M_drag-divergence` — la decisión de espesor y flecha del ala. |
| **12** | Flujo supersónico linealizado | `cl` y `cd` supersónicos en **fórmula cerrada**: `cl = 4α/√(M²−1)`. Cuesta nanosegundos. Candidata #1 para correr en vivo en el navegador. |
| **13** | Técnicas numéricas para flujo supersónico no lineal | **CFD de verdad**: método de las características (contorno correcto de tobera), diferencias finitas de MacCormack, *time-marching* para el cuerpo romo, y Taylor-Maccoll para el cono. Es el único camino cuando la teoría lineal se rompe. |
| **14** | Elementos de flujo hipersónico | Ley de Newton (`Cp = 2 sin²θ`), independencia de Mach, y **calentamiento aerodinámico** — que en hipersónico *domina el diseño*, no lo acompaña. |

**La columna vertebral del bloque, en una frase:** el capítulo 11 te dice **hasta dónde** sirve el
solver barato, el 12 te da el solver barato del otro lado de Mach 1, el 13 te dice qué hacer cuando
ninguno sirve, y el 14 te dice qué te va a matar cuando vayas muy rápido.

### El hueco de mercado, otra vez

El cliente (Raymer §2.1.4) dijo que el CAD de producción es "demasiado bueno" para el diseño
conceptual. Este bloque es la prueba: la ec. (11.51) —Prandtl-Glauert— es **una división**, y con
ella el ingeniero conceptual corrige toda una base de datos de perfiles de baja velocidad a Mach 0.7.
Un solver Navier-Stokes daría la respuesta "correcta" en 6 horas de GPU; Prandtl-Glauert la da en
un microsegundo con 1–3 % de error donde vale. **Eso es diseño conceptual.** La Forja debe entregar
las dos cosas y decirle al ingeniero *cuál* está usando y *dónde deja de ver*.

### Advertencia del autor sobre este bloque

Anderson es explícito en que este bloque cambia el tipo de matemática:

> *"Our first four chapters dealing with the basics of compressible flow (Chapters 7–10) used
> mathematics at essentially the level of algebra. To go further in our study of compressible flow
> [...] we have to return to the world of partial differential equations."* (§11 Preview Box, p.740)

Y en que la teoría cerrada se acaba:

> *"But this is about as far as we can go with our analytical solutions allowed by tractable
> mathematics. For all other applications, encompassing the vast majority of all other real-world
> applications, the flows are governed by the more complete nonlinear equations of motion, for which
> there are no closed-form analytical solutions."* (§13 Preview Box, p.829)

Esa frase es el requisito de arquitectura del solver de La Forja: **dos niveles, declarados**.

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§] requisito (APRENDER/CONSTRUIR/ambos)`

### 1.1 Compresible interno — toberas, difusores, túneles (cap 10)

- `[compresible] [§10.2, p.692]` El solver de ductos DEBE usar el modelo **casi-unidimensional**:
  `A = A(x)` pero `p = p(x)`, `ρ = ρ(x)`, `u = u(x)`. Es una aproximación declarada, no la verdad;
  los resultados se interpretan como **propiedades medias sobre cada sección transversal**.
  *"we can visualize the quasi-one-dimensional results as giving the mean properties at a given
  station, averaged over the cross section"* (§10.7, p.726). (ambos)
- `[compresible] [§10.2, p.696]` El solver DEBE reconocer que la continuidad casi-1D es
  `d(ρuA) = 0`, **no** `d(ρu) = 0`. Anderson advierte que reducir la ec. (2.52) general a 1-D da
  `d(ρu)=0`, lo cual es *inconsistente* con el ducto de área variable. Un bug clásico. (CONSTRUIR)
- `[compresible] [§10.2, p.699]` DEBE implementar la **relación área-velocidad** (10.25) y usarla
  como el "porqué" de la forma convergente-divergente: subsónico acelera convergiendo, supersónico
  acelera divergiendo, sónico **solo** en un mínimo de área. (ambos)
- `[compresible] [§10.3, p.702]` DEBE implementar la **relación área-Mach** (10.32) y respetar que
  es **bivaluada**: para cada `A/A* > 1` hay una raíz subsónica y una supersónica. El solver DEBE
  pedir/inferir cuál rama aplica según `p_e/p_0`, nunca elegirla sola en silencio. (ambos)
- `[compresible] [§10.3, p.706]` DEBE distinguir `A_t` (área geométrica de la garganta) de `A*`
  (área sónica de referencia). En flujo puramente subsónico `A_t > A*` y `A*` es solo una
  referencia ficticia. Confundirlas es el error #1 del alumno. (ambos)
- `[compresible] [§10.3, p.707]` DEBE modelar **flujo ahogado (choked)**: una vez `M=1` en la
  garganta, el gasto no cambia por más que bajes `p_e`. *"the flow at the throat, as well as
  upstream of the throat, becomes 'frozen'"*. (ambos)
- `[compresible] [§10.3.1, p.716]` DEBE exponer el gasto ahogado en **forma cerrada** (ec. E10.3) y
  su proporcionalidad `ṁ ∝ p0·A*/√T0` (ec. 10.33) como cantidad de diseño de primer orden. (ambos)
- `[compresible] [§10.3, p.708–710]` DEBE clasificar el régimen de salida en los seis casos del
  libro: subsónico puro, sónico en garganta, **choque normal dentro** de la tobera, choque normal
  justo en la salida, **sobreexpandida** (choques oblicuos afuera) y **subexpandida** (abanicos de
  expansión afuera). El estado de salida es una salida del solver, no un dato. (ambos)
- `[compresible] [§10.4, p.717]` DEBE tratar la **pérdida de presión total** `p0` como la métrica
  de ineficiencia. *"a loss of total pressure is always an inefficiency—a loss of the capability to
  do a certain amount of useful work."* (ambos)
- `[compresible] [§10.4, p.718]` DEBE declarar que el difusor isentrópico ideal **no existe**:
  *"an ideal diffuser is of the nature of a 'perpetual motion machine'—only a utopian wish in the
  minds of engineers."* El difusor real usa choques oblicuos reflejados + choque normal débil, y
  `A_t,real > A*`. (APRENDER)
- `[sizing] [§10.5, p.722]` El dimensionador de túnel supersónico DEBE calcular la **segunda
  garganta** con `A_t2/A_t1 = p0,1/p0,2` (ec. 10.39) y avisar que si `A_t2` queda por debajo, el
  túnel **se desarranca (unstart)**. (ambos)
- `[sizing] [§10.5, p.723]` A falta de datos, DEBE usar la regla de dedo del libro: suponer que la
  pérdida de `p0` equivale a la de un **choque normal al Mach de la sección de pruebas**
  ("normal shock efficiency"). Declarada como regla de dedo, no como física. (ambos)
- `[sizing] [§10.8, p.730]` DEBE ofrecer los **cuatro tipos de túnel** del libro (blowdown,
  indraft, presión-vacío, circuito cerrado continuo) con sus ventajas/desventajas, y dejar la
  elección al ingeniero. (ambos)
- `[sizing] [§10.8, p.730]` DEBE dimensionar la sección de pruebas con el criterio de Pope & Goin:
  las ondas del modelo deben reflejarse en las paredes **suficientemente aguas abajo** para no
  reincidir sobre el modelo. Geometría: `h/(L/2) = tan μ`. (ambos)
- `[sizing] [§10.8, p.734]` DEBE cerrar el lazo de costo: gasto → tiempo de corrida → masa de aire
  → **volumen del tanque** → altura del tanque → "¿cabe en el laboratorio?". El libro muestra que
  a 2 atm el tanque mide 80 ft de alto y a 20 atm mide 8 ft. Ese es el ciclo de diseño conceptual
  que el cliente compró. (ambos)
- `[viscoso] [§10.6, p.724]` DEBE advertir que el choque normal dentro de la tobera **interactúa
  con la capa límite**: separación, patrón de choque en λ ("lambda shock") en los pies del choque,
  y el núcleo del flujo separado corriendo a área casi constante. El dibujo no viscoso miente. (APRENDER)

### 1.2 Corrección de compresibilidad y transónico (cap 11)

- `[aero2d] [§11.2, p.744]` DEBE tener la **ecuación exacta del potencial de velocidad** (11.12) +
  (11.13) documentada como el punto de partida: exacta para flujo estable, irrotacional,
  isentrópico, **todos los Mach y todos los espesores** — pero **no lineal** y sin solución
  analítica general conocida. (APRENDER)
- `[aero2d] [§11.3, p.747]` DEBE implementar la **ecuación linealizada del potencial de
  perturbación** (11.18) con su dominio explícito grabado en el código:
  `0 ≤ M∞ ≤ 0.8` **o** `1.2 ≤ M∞ ≤ 5`, cuerpos delgados, ángulo de ataque pequeño. (ambos)
- `[aero2d] [§11.3, p.749]` DEBE usar el **coeficiente de presión linealizado** `Cp = −2û/V∞`
  (11.32), consistente con (11.18). Depende **solo** de la perturbación en `x`. (ambos)
- `[aero2d] [§11.3, p.750]` DEBE usar la **condición de tangencia linealizada** `∂φ̂/∂y = V∞ tan θ`
  (11.34) en la superficie, no la exacta (11.33). Mezclar niveles de aproximación es incoherente. (CONSTRUIR)
- `[aero2d] [§11.4, p.754]` **REQUISITO ESTRELLA.** DEBE implementar la **regla de Prandtl-Glauert**
  (11.51)–(11.53) para `Cp`, `cl` y `cm`, y aplicarla directamente sobre la salida del solver de
  paneles incompresible que ya existe en `src/aero/potencial.ts`. (ambos)
- `[aero2d] [§11.4, p.751]` DEBE **limitar** P-G: *"it is limited to thin airfoils at small angles
  of attack. Moreover, it is purely a subsonic theory and begins to give inappropriate results at
  values of M∞ = 0.7 and above."* La UI DEBE cambiar de color arriba de M∞ = 0.7. (ambos)
- `[aero2d] [§11.5, p.755]` DEBE implementar **Karman-Tsien** (11.54) y **Laitone** (11.55) como
  alternativas, y decir cuál es la industrial: *"[Karman-Tsien] has been widely adopted by the
  aeronautical industry since World War II."* (ambos)
- `[aero2d] [§11.5, p.756]` DEBE reportar el sesgo conocido: **P-G subpredice** el dato
  experimental; Karman-Tsien y Laitone son más precisas porque *"attempt to account for some of the
  nonlinear aspects of the flow"*. (APRENDER)
- `[aero2d] [§11.4, p.754]` DEBE enseñar que **la paradoja de d'Alembert sobrevive** al flujo
  subsónico compresible no viscoso (P-G escala `Cp` por una constante `β`, así que si la integral de
  arrastre era cero sigue siendo cero) — y que muere en cuanto aparece flujo localmente supersónico
  con choques, generando **arrastre de onda**. (APRENDER)
- `[aero2d] [§11.6, p.758]` DEBE implementar (11.58), la relación local `Cp ↔ M_local` dado `M∞`.
  Anderson la llama *"the compressible flow analogue of Bernoulli's equation"*. Y el Problema 11.6
  la enuncia como requisito: **"el `Cp` de un flujo compresible no viscoso es función única del Mach
  local y del Mach de corriente libre"** — no de la velocidad. (ambos)
- `[aero2d] [§11.6, p.758]` DEBE implementar la **curva universal** `Cp,cr = f(M_cr)` (11.60), que
  *"has no connection with the shape of a given airfoil [...] is a type of 'universal relation' which
  can be used for all airfoils."* Se precomputa una vez. (ambos)
- `[aero2d] [§11.6, p.759]` DEBE estimar el **Mach crítico** por el procedimiento de 3 pasos: (1)
  obtener `(Cp,0)min` experimental o teórico, (2) trazar `Cp(M∞)` con P-G/K-T/Laitone, (3)
  intersectar con (11.60). Y DEBE ofrecer también la solución **analítica** por iteración
  (ec. 11.63). (ambos)
- `[aero2d] [§11.6, p.760]` DEBE mostrar el resultado de diseño: **perfil más delgado → `M_cr` más
  alto**. Ejemplos del libro: Gates Lear jet 9 % vs Piper Aztec 14 %. (ambos)
- `[aero2d] [§11.6.1, p.765]` DEBE advertir que el **punto de presión mínima NO está en el espesor
  máximo**. NACA 0012: espesor máximo en `x/c = 0.3`, presión mínima en `x/c = 0.11`.
  *"our intuition would be completely wrong. Nature places the maximum velocity at a point which
  satisfies the physics of the whole flow field, not just what is happening in a local region."* (ambos)
- `[aero2d] [§11.6.1, p.765]` DEBE declarar el supuesto oculto de todas las correcciones: que el
  punto de presión mínima **no se mueve** al subir `M∞`. Anderson lo verifica con dato
  experimental (`x/c = 0.11` a M∞ = 0, 0.575 y 0.725). (APRENDER)
- `[aero2d] [§11.7, p.766]` DEBE definir el **Mach de divergencia de arrastre** como el `M∞` donde
  `cd` empieza a subir bruscamente, un poco **arriba** de `M_cr`, y cuantificar la magnitud:
  *"the drag coefficient can become very large, typically increasing by a factor of 10 or more."* (ambos)
- `[aero2d] [§11.7, p.767]` DEBE desmontar la "barrera del sonido": P-G predice `Cp → ∞` en M∞ → 1
  **pero P-G no es válida ahí**. El `cd` real hace pico en/cerca de Mach 1 y **baja** en supersónico. (APRENDER)
- `[aero3d] [Design Box §11.7, p.768]` DEBE implementar los **dos recursos clásicos** para subir
  `M_drag-divergence`: **perfil delgado** y **ala en flecha**. (ambos)
- `[aero3d] [Design Box §11.7, p.769]` La explicación de la flecha DEBE ser la geométrica del
  libro: con `Λ = 45°`, la corriente ve `t2 = t1` pero `c2 = 1.41·c1`, luego `t/c` efectivo cae de
  0.15 a **0.106** — casi un tercio más delgado, sin quitar volumen. (ambos)
- `[aero3d] [Design Box §11.7, p.771]` DEBE implementar las **correcciones de compresibilidad a la
  pendiente de sustentación**: ec. (11.66) ala recta de alto AR, (11.67) ala recta de bajo AR
  (Helmbold), (11.68) ala en flecha con `M∞,n = M∞ cos Λ`, con `Λ` medido sobre la **línea de
  media cuerda**. (ambos)
- `[aero3d] [§11.8, p.774]` DEBE implementar la **regla del área transónica**: la distribución de
  área transversal del avión completo (fuselaje + ala + cola) debe variar **suavemente**, sin saltos
  en `A` ni en `dA/dx`. Resultado típico: **factor 2 de reducción** en el pico de arrastre cerca de
  Mach 1. (ambos)
- `[aero2d] [§11.9, p.775]` DEBE ofrecer el **perfil supercrítico** como estrategia alterna: no
  subir `M_cr`, sino **ensanchar la distancia entre `M_cr` y `M_drag-divergence`**. (ambos)
- `[aero2d] [§11.9, p.777]` DEBE describir la geometría supercrítica LITERAL: dorso relativamente
  **plano** (burbuja supersónica más tendida y con Mach local más bajo → choque terminal más débil),
  **camber negativo en el 60 % delantero**, y **camber positivo extremo en el 30 % trasero** —
  de ahí la forma de cúspide en el borde de salida por abajo. (ambos)
- `[aero2d] [§11.10, p.778]` DEBE declarar los **cuatro escalones históricos del CFD transónico**:
  (1) potencial de pequeña perturbación transónico (11.69), (2) potencial completo (11.12),
  (3) Euler (choques bien tratados), (4) Navier-Stokes (interacción choque/capa límite y separación,
  que es lo que domina el arrastre). Y el talón de Aquiles: *"some type of turbulence model must be
  included [...] and such turbulent models are frequently the Achilles heel of these calculations."* (APRENDER)
- `[optimizacion] [§11.10, p.779]` El caso Jameson es el requisito de producto: **CFD + optimización
  numérica** re-diseña un ala transónica de M∞ = 0.83 hasta quedar prácticamente **sin choque**, con
  **7.6 % menos arrastre**, bajo la restricción de **espesor constante**. (APRENDER)

### 1.3 Supersónico linealizado (cap 12)

- `[aero2d] [§12.1, p.812]` DEBE reconocer que la misma ec. (11.18) cambia de **elíptica** (subsónico)
  a **hiperbólica** (supersónico) al cambiar el signo de `1 − M∞²`, y que eso implica un cambio
  físico: en supersónico **las perturbaciones no viajan aguas arriba**. (ambos)
- `[aero2d] [§12.2, p.813]` DEBE implementar la solución `φ̂ = f(x − λy)` con `λ = √(M∞²−1)`: `φ̂` es
  constante a lo largo de **líneas de Mach** de pendiente `dy/dx = 1/√(M∞²−1)`. (ambos)
- `[aero2d] [§12.2, p.815]` **REQUISITO ESTRELLA.** DEBE implementar el `Cp` supersónico
  linealizado `Cp = 2θ/√(M∞²−1)` (12.15): **directamente proporcional a la inclinación local de la
  superficie respecto a la corriente libre**. Positivo si la superficie se mete en la corriente,
  negativo si se aleja. Vale para cualquier cuerpo 2-D delgado. (ambos)
- `[aero2d] [§12.3, p.816]` La convención de signo DEBE ser la operacional del libro, no la formal:
  *"keep in mind that when the surface is inclined into the freestream direction, linearized theory
  predicts a positive Cp"*; `θ` se maneja siempre como cantidad positiva y el signo se decide mirando
  la geometría. (CONSTRUIR)
- `[aero2d] [§12.3, p.818]` DEBE implementar `cl = 4α/√(M∞²−1)` (12.23) y `cd = 4α²/√(M∞²−1)`
  (12.24) para placa plana, y declarar que **(12.23) también vale para un perfil delgado de forma
  arbitraria** — `cl` supersónico linealizado **no depende de la forma ni del espesor**. (ambos)
- `[aero2d] [§12.3, p.818]` DEBE declarar que `cd` **sí** depende de la forma:
  `cd = 4/√(M∞²−1) · (α² + g_c² + g_t²)` con `g_c` función de la línea de curvatura media y `g_t`
  del espesor. **Las formas de `g_c` y `g_t` NO están en el libro** (remite a Refs. 25–26). (ambos)
- `[aero2d] [§12.2, p.815]` DEBE mostrar la **inversión de tendencia**: en subsónico `Cp` **crece**
  con `M∞` (11.51); en supersónico `Cp` **decrece** con `M∞` (12.15). Ambas divergen en M∞ → 1 y
  ninguna vale ahí. (APRENDER)
- `[viscoso] [§12.4, p.823]` DEBE modelar el arrastre de fricción compresible como
  `Cf = F(Me, Pr, Tw/Te)/√Re_c` (laminar, 12.25) y `Cf = G(Me, Pr, Tw/Te)/Re_c^{1/5}` (turbulento,
  12.26): **la forma de la ley no cambia con la compresibilidad, solo el numerador**. (ambos)
- `[viscoso] [§12.4, p.823]` DEBE reportar la tendencia: `Cf` **baja** al subir `M∞`, y la caída es
  **más dramática en turbulento** que en laminar. (APRENDER)
- `[performance] [§12.4, p.825]` DEBE sumar arrastre de onda + fricción y reportar la **partición**.
  En el caso F-104 del libro, la **fricción es el 60 %** del arrastre total y hunde `L/D` de 28.3 a
  11.2. El arrastre de onda va como `α²`, la fricción no; hay un `α` de cruce (2.47° en ese caso). (ambos)
- `[performance] [Prob. 12.6, p.826]` DEBE implementar el óptimo cerrado (el libro **publica la
  respuesta**): `α_opt = √Cf · (M²−1)^{1/4} / 2` y `(cl/cd)max = Cf^{−1/2} · (M²−1)^{−1/4}`. (ambos)
- `[performance] [Prob. 12.8, p.827]` DEBE enseñar la consecuencia: `(L/D)max` **cae** al subir el
  Mach. *"This is a fact of nature that progressively causes designers of supersonic airplanes grief."* (APRENDER)
- `[aero3d] [Design Box §12.3, p.821]` DEBE implementar la **regla del área supersónica**: el área
  relevante ya no es la normal a la corriente sino la cortada por un **plano oblicuo al ángulo de
  Mach** `μ = asin(1/M∞)`. El F-16 cumple ambas (transónica y supersónica a M∞ = 1.2 y 1.6). (ambos)

### 1.4 Métodos numéricos (cap 13)

- `[compresible] [§13.2, p.835]` DEBE implementar el **método de las características (MOC)** 2-D
  irrotacional: las líneas características son las **líneas de Mach**, con pendiente
  `(dy/dx)_char = tan(θ ∓ μ)`. Dos por punto: `C−` (por debajo de la línea de corriente) y `C+`
  (por encima). (ambos)
- `[compresible] [§13.2, p.837]` DEBE implementar las **ecuaciones de compatibilidad**
  `θ + ν(M) = K−` sobre `C−` y `θ − ν(M) = K+` sobre `C+`, y reconocer que **solo en 2-D
  irrotacional** son algebraicas; en el caso general son EDOs. (ambos)
- `[compresible] [§13.2.1, p.839]` DEBE implementar el **proceso unitario de punto interno**:
  `θ3 = ½[(K−)1 + (K+)2]`, `ν3 = ½[(K−)1 − (K+)2]`, y de ahí `M3` (Ap. C), `p3`, `T3` (Ap. A),
  `a3`, `V3`. (ambos)
- `[compresible] [§13.2.2, p.840]` DEBE implementar el **punto de pared**: `(K−)5 = (K−)4 = θ4+ν4`,
  con `θ5` conocido (pendiente de la pared) → `ν5`. (ambos)
- `[compresible] [§13.2.1, p.839]` DEBE usar la aproximación de segmento recto con **pendiente
  promedio**: `C−` entre 1 y 3 → `½(θ1+θ3) − ½(μ1+μ3)`; `C+` entre 2 y 3 → `½(θ2+θ3) + ½(μ2+μ3)`.
  Y declarar que ahí vive el error numérico: *"the method of characteristics is truly exact only in
  the limit of an infinite number of characteristic lines."* (ambos)
- `[geometria] [§13.3, p.840]` **REQUISITO DE PRODUCTO.** DEBE **diseñar el contorno** de la tobera
  supersónica, no solo analizarlo. El cap. 10 dio propiedades para un `A(x)` **dado**; el cap. 13 da
  el `A(x)` que produce flujo **isentrópico y sin choques**. (ambos)
- `[geometria] [§13.3, p.842]` DEBE partir la divergente en **sección de expansión** (θ creciente
  hasta `θmax`, forma libre, típicamente arco circular de radio grande) y **sección de
  enderezamiento** (θ decreciente hasta 0 en la salida, **calculada** para cancelar las ondas de
  expansión). (ambos)
- `[geometria] [§13.3, p.841]` DEBE empezar el marchado desde una **línea de datos iniciales aguas
  abajo de la característica límite** (limiting characteristic), no desde la línea sónica (que es
  curva por la 2-D del cuello). (ambos)
- `[geometria] [§13.3, p.842]` DEBE usar la propiedad de cancelación: si no hay ondas reflejadas
  desde el enderezamiento, `θ` es constante sobre esa característica → `θ12 = θ9`, y el tramo de
  contorno se aproxima por recta de pendiente `½(θ8 + θ12)`. (CONSTRUIR)
- `[compresible] [§13.4, p.844]` DEBE implementar diferencias finitas con las tres formas
  (adelantada 13.27, atrasada 13.28, centrada 13.29). (ambos)
- `[compresible] [§13.4, p.847]` DEBE usar la **forma conservativa** con variables de flujo
  `F = ρu`, `G = ρu²+p`, `H = ρuv`, `K = ρu(e+V²/2)+pu` — no las primitivas — y recuperar las
  primitivas después con (13.44)–(13.46). (CONSTRUIR)
- `[geometria] [§13.4, p.847]` DEBE **transformar la malla curva (plano físico) a rectangular
  (plano computacional)** con `ξ = x`, `η = y/y_s(x)`, aplicando la regla de la cadena (13.48),
  (13.49). Las diferencias finitas se aplican **solo** en el plano computacional. (ambos)
- `[compresible] [§13.4.1–13.4.2, p.849]` DEBE implementar **MacCormack**: predictor con
  diferencias **adelantadas**, corrector con diferencias **atrasadas**, y derivada **promediada**
  (13.58). (ambos)
- `[compresible] [§13.4, p.850]` DEBE advertir que el marchado espacial supersónico **revienta** si
  entra en una región localmente subsónica (la ecuación deja de ser hiperbólica en `x`). (ambos)
- `[compresible] [§13.5, p.852]` DEBE implementar la técnica **dependiente del tiempo
  (time-marching)** para flujo **mixto subsónico-supersónico**: es *"the only approach known today
  which allows the uniform calculation of a mixed subsonic-supersonic flow field of arbitrary
  extent."* Las ecuaciones no estacionarias son **hiperbólicas en `t`** sin importar el Mach local. (ambos)
- `[compresible] [§13.5, p.853]` El flujo estacionario es el **límite asintótico**; los transitorios
  son un medio, no un resultado. *"it is this steady-state value that we want; the time-dependent
  approach is simply a means to that end."* (ambos)
- `[compresible] [§13.5, p.854]` DEBE transformar con `ξ = (x−b)/(s−b)`, `η = y`, donde `b = b(y)`
  es el cuerpo (`ξ=0`) y `s = s(y,t)` es el choque (`ξ=1`), y **actualizar la forma y posición del
  choque en cada paso** imponiendo las relaciones de choque en los puntos justo detrás. (ambos)
- `[compresible] [§13.5, p.851]` DEBE reconocer que el flujo tras un choque **curvo** es
  **rotacional** (cada línea de corriente cruza una parte distinta del choque → gradiente de entropía
  normal a las líneas de corriente) y que por eso **no se puede usar el potencial de velocidad**. (ambos)
- `[aero3d] [§13.6, p.860]` DEBE implementar **flujo cónico**: propiedades **constantes a lo largo
  de rayos** desde el vértice, `∂/∂φ = 0` y `∂/∂r = 0`. La justificación es física: un cono
  semi-infinito no tiene longitud de escala. (ambos)
- `[aero3d] [§13.6.2, p.864]` DEBE implementar la **ecuación de Taylor-Maccoll** (13.78)/(13.80),
  una EDO en `θ` con `Vr'` como única incógnita, con `Vθ' = dVr'/dθ` (13.79) y
  `V' = [2/((γ−1)M²)+1]^{−1/2}` (13.81). (ambos)
- `[aero3d] [§13.6.3, p.865]` DEBE resolverla por el **método inverso**: se supone `θs` y `M∞`, se
  integra (Runge-Kutta) en pasos `Δθ` desde el choque hacia adentro, y el **cono que soporta ese
  choque** es el `θ = θc` donde `Vθ' = 0`. (ambos)
- `[aero3d] [§13.6.4, p.868]` DEBE cuantificar el **efecto de alivio tridimensional**: el cono da
  choque más débil, menor `p`, `T`, `ρ` y `s` en superficie, y **mayor ángulo máximo con choque
  adherido** que la cuña del mismo ángulo. (ambos)
- `[aero3d] [§13.6.4, p.869]` DEBE contemplar el caso raro: con `θc` grande (pero `< θc,max`) puede
  haber **compresión isentrópica de supersónico a subsónico** cerca de la superficie del cono, sin
  choque. *"we see one of the few instances in nature where a supersonic flow field is actually
  isentropically compressed from supersonic to subsonic velocities."* (APRENDER)

### 1.5 Hipersónico (cap 14)

- `[compresible] [§14.2, p.873]` DEBE definir hipersónico por **fenómenos**, no por un número:
  *"there is nothing magic about Mach 5. If you were flying at Mach 4.99, and you accelerate to Mach
  5.01, nothing new is going to happen"*. Lo que define el régimen es **capa de choque delgada +
  interacción viscosa + temperatura alta + calentamiento**. (ambos)
- `[viscoso] [§14.2, p.873]` DEBE modelar **interacción viscosa**: el espesor de capa límite en
  cuerpos esbeltos va como `M∞²`, y a alta altitud (Re bajo) la capa límite puede ser del mismo
  orden que la capa de choque → la capa de choque es **completamente viscosa** y la forma del choque
  y la distribución de presión quedan afectadas. (ambos)
- `[viscoso] [§14.2, p.874]` DEBE modelar el caso de la **placa plana hipersónica**: no hay presión
  constante `p∞`; la capa límite gruesa desvía el flujo externo, crea un choque curvo desde el borde
  de ataque y la presión en el borde de ataque es **mucho mayor** que `p∞`, cayendo a `p∞` solo muy
  aguas abajo. (ambos)
- `[compresible] [§14.2, p.875]` DEBE modelar **efectos de alta temperatura** con los umbrales
  LITERALES: `O2 → 2O` en 2000–4000 K, `N2 → 2N` en 4000–9000 K, ionización `N → N⁺+e⁻`,
  `O → O⁺+e⁻` arriba de 9000 K. Consecuencia operativa: **γ deja de ser 1.4 y deja de ser
  constante**, y **todas las tablas de los caps. 7–13 dejan de valer**. (ambos)
- `[compresible] [§14.2, p.876]` DEBE separar calentamiento **convectivo** `qc = −k(∂T/∂n)` de
  **radiativo** `qr` (va como `T⁴`), con `q = qc + qr`. Anclas del libro: reentrada tipo ICBM
  (~28,000 ft/s) → solo convectivo; Apolo → `qr/q ≈ 0.3`; sonda a Júpiter → `q ≈ qr`. (ambos)
- `[aero2d] [§14.3, p.879]` **REQUISITO ESTRELLA.** DEBE implementar la **ley del seno cuadrado de
  Newton**: `Cp = 2 sin²θ` (14.4) con `θ` el ángulo entre la tangente a la superficie y la corriente
  libre; equivalentemente `Cp = 2 cos²φ` (14.5) con `φ` medido desde la normal. (ambos)
- `[aero2d] [§14.3, p.880]` DEBE implementar la **ley newtoniana modificada**
  `Cp = Cp,max · sin²θ` (14.7), con `Cp,max` del punto de estancamiento calculado con teoría exacta
  de choque normal: `Cp,max = (2/γM∞²)(p0,2/p∞ − 1)`. Es **más precisa** que la newtoniana pura
  para cuerpos romos. (ambos)
- `[aero2d] [§14.3, p.879]` DEBE enseñar el contraste de `Cp` en estancamiento: **1.0** incompresible,
  **1.28** en M∞=1, **1.86** en M∞→∞ con γ=1.4, y **2.0** en el límite newtoniano. (APRENDER)
- `[aero2d] [§14.3, p.881]` DEBE declarar los sesgos de precisión: newtoniano mejora al **subir
  M∞** y al **subir θ**, y es **más preciso en cuerpos tridimensionales** (cono) que en
  bidimensionales (cuña). (ambos)
- `[aero2d] [§14.4, p.884]` DEBE implementar la placa plana newtoniana: `Cp,l = 2sin²α`, `Cp,u = 0`
  (superficie superior "en la sombra"), `cn = 2sin²α`, `cl = 2sin²α cosα`, `cd = 2sin³α`. (ambos)
- `[aero2d] [§14.4, p.884]` DEBE implementar `L/D = cot α` y declarar que **no es newtoniano**: es
  geometría pura, válida siempre que la fuerza resultante sea normal a la placa (flujo no viscoso
  supersónico o hipersónico sobre placa infinitamente delgada). (ambos)
- `[aero2d] [§14.4, p.885]` DEBE enseñar que en hipersónico **`cl` NO es lineal en α** — a
  diferencia de subsónico (cap. 5) y supersónico linealizado (12.23). Transónico e hipersónico son
  **inherentemente no lineales**, incluso a α pequeño. (ambos)
- `[aero2d] [§14.4, p.886]` DEBE reportar `cl,max = 0.77` **a α = 54.7°**, y explicar que el máximo
  es **geométrico**, no por separación viscosa: `N` sigue creciendo hasta α=90° pero `L = N cos α`
  se dobla. *"a large number of practical hypersonic configurations achieve a maximum CL at an angle
  of attack in the neighborhood of [...] around 55°."* (ambos)
- `[performance] [§14.4, p.888]` DEBE implementar el óptimo con fricción:
  `α[(L/D)max] = (cd,0)^{1/3}` (14.23), `(L/D)max = 0.67/(cd,0)^{1/3}` (14.24), y el invariante
  **`cd,w = 2·cd,0` en el punto de máximo L/D** (14.27). (ambos)
- `[compresible] [§14.5, p.892–894]` DEBE implementar las **relaciones de choque hipersónicas
  límite**: `p2/p1 → 2γ/(γ+1)·M1²sin²β`, `ρ2/ρ1 → (γ+1)/(γ−1)`,
  `T2/T1 → 2γ(γ−1)/(γ+1)²·M1²sin²β`, `β/θ → (γ+1)/2` (=1.2θ con γ=1.4),
  `Cp → 4/(γ+1)·sin²β`. Y declarar su uso: *"The value of the relations obtained in the hypersonic
  limit is more for theoretical analysis rather than for the calculation of actual numbers"* — para
  números, usar las exactas del cap. 9. (ambos)
- `[compresible] [§14.5, p.895]` DEBE enseñar **el porqué de Newton**: en el doble límite
  `M∞ → ∞` **y** `γ → 1`, la teoría exacta de choque oblicuo da `ρ2/ρ∞ → ∞`, el choque se pega al
  cuerpo (`β = θ`) y `Cp → 2 sin²θ` — **exactamente la ley de Newton**. Corolario honesto:
  *"the application of newtonian theory to practical hypersonic flow problems, where γ is always
  greater than unity, is theoretically not proper, and the agreement [...] has to be viewed as
  somewhat fortuitous."* (ambos)
- `[compresible] [§14.6, p.896]` DEBE implementar el **principio de independencia de Mach**: a Mach
  alto, `Cp`, `CL`, `CD` y la estructura del campo (forma del choque) se vuelven **casi independientes
  de `M∞`**. Advertencia dura: **solo las cantidades adimensionales**; `p` sí diverge. (ambos)
- `[compresible] [§14.7, p.898]` DEBE declarar por qué el CFD **domina** el diseño hipersónico: no
  existe instalación de tierra que simule simultáneamente Mach, Reynolds y temperatura.
  *"experimental data for the design of hypersonic vehicles is a patchwork of different data taken in
  different facilities under different conditions."* (APRENDER)
- `[estabilidad] [§14.7, p.900]` **CASO DE ALARMA PARA EL CLIENTE.** DEBE mostrar el caso del
  transbordador: la presión casi no cambia entre gas perfecto y aire en equilibrio químico, **pero
  el momento de cabeceo sí** — el diseño usó datos de túnel "frío" (γ=1.4) y en vuelo real la
  deflexión del *body flap* para equilibrar resultó **más del doble** de la prevista. Lección: una
  integral con brazo de momento amplifica diferencias de presión invisibles a simple vista. (ambos)
- `[viscoso] [§14.8.1, p.902]` DEBE implementar el número de Stanton `CH ≡ q̇w/(ρe·ue·(haw−hw))`
  (14.45) y el resultado central `q̇w ≈ ½ρ∞V∞³·CH` (14.51): **el calentamiento va con el CUBO de la
  velocidad**, mientras el arrastre va con el cuadrado. *"This is the connection between aerodynamic
  heating and hypersonic flow."* (ambos)
- `[viscoso] [§14.8.2, p.903]` DEBE implementar la **analogía de Reynolds** `C_H/C_f = ½` (con Pr=1)
  y `dQ/dt = ¼ρ∞V∞³·S·C_f` (14.55). (ambos)
- `[viscoso] [§14.8.2, p.904]` **REQUISITO DE DISEÑO DE PRIMER ORDEN.** DEBE implementar
  `Q_total = ½·(C_f/C_D)·(½ m V_E²)` (14.60) y su conclusión: el calor total es proporcional a la
  **energía cinética inicial** y a la **fracción de fricción en el arrastre**. Por eso
  **el vehículo debe ser ROMO**: cuerpo esbelto → `C_f/C_D ≈ 1`; cuerpo romo → `C_f/C_D << 1`. (ambos)
- `[viscoso] [§14.8.3, p.906]` DEBE implementar `q̇w ∝ 1/√R` (nariz roma baja el calentamiento) y
  la fórmula de ingeniería de **Tauber & Meneses** (14.62) para el punto de estancamiento. (ambos)
- `[viscoso] [§14.8.3, p.907]` DEBE reconciliar la aparente contradicción de densidad: `q̇w ∝ ρ∞`
  en (14.51) **y** `q̇w ∝ √ρ∞` en (14.62), porque `CH ∝ 1/√Re ∝ 1/√ρ∞` en laminar. (APRENDER)
- `[viscoso] [§14.8.3, p.908]` DEBE aprovechar la regla cualitativa: **la distribución de
  calentamiento sobre la superficie tiende a seguir la distribución de presión**. Barato y útil. (ambos)
- `[optimizacion] [§14.9, p.910]` DEBE ofrecer el **waverider** como configuración de crucero
  hipersónico: choque **adherido en todo el borde de ataque**, lo que **impide que la alta presión
  de abajo se fugue** hacia arriba. Consecuencia: mismo `L`, **menor α**, mejor `L/D`. (ambos)
- `[geometria] [§14.9, p.912]` DEBE implementar la **construcción inversa** del waverider: tomar un
  campo conocido (cuña → choque plano; cono a α=0 → choque cónico), trazar una curva arbitraria
  **sobre la superficie del choque**, y usar la **superficie de corriente** que nace de esa curva
  como superficie inferior del vehículo. Por construcción, el choque queda adherido al borde. (ambos)
- `[optimizacion] [§14.9, p.913]` DEBE declarar que el waverider es un **vehículo de punto de
  diseño**: el choque generador corresponde a un `M∞` y una deflexión dados. (ambos)
- `[optimizacion] [§14.9.1, p.914]` DEBE incluir la **fricción DENTRO del lazo de optimización**, no
  sumarla al final: los waveriders tienen mucha superficie mojada y sumar `Cf` a posteriori destruía
  el `L/D` inviscido y desprestigió el concepto. (ambos)
- `[optimizacion] [§14.9.1, p.915]` El lazo DEBE incluir los cinco ingredientes: (1) superficie
  inferior por Taylor-Maccoll, (2) superficie superior de expansión por método de las
  características axisimétrico, (3) capa límite integral con transición laminar→turbulenta,
  (4) bordes de ataque **romos** dimensionados por temperatura admisible con arrastre estimado por
  newtoniano modificado, (5) simplex de Nelder-Mead con **relación de esbeltez `b/l` como
  restricción**. (ambos)
- `[performance] [§14.9.1, p.919]` DEBE implementar las dos correlaciones de barrera:
  Kuchemann `(L/D)max = 4(M∞+3)/M∞` (vehículos convencionales) y
  **waverider viscoso-optimizado `(L/D)max = 6(M∞+2)/M∞`**. La segunda **rompe** la primera. (ambos)
- `[optimizacion] [§14.9.1, p.918]` DEBE reportar el invariante empírico del óptimo: en la mejor
  forma a cualquier `M∞`, **arrastre de onda y de fricción quedan del mismo orden, nunca difiriendo
  por más de un factor de 2**. Debajo del óptimo domina fricción; arriba domina onda. (ambos)

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

> Convención: ASCII. `M∞` = Mach de corriente libre; `γ` = cociente de calores específicos;
> `β` = ángulo de onda; `θ` = deflexión / inclinación local; `μ` = asin(1/M) ángulo de Mach;
> `ν(M)` = función de Prandtl-Meyer.

### 2.1 Ecuaciones de gobierno casi-1D (§10.2, p.693–697)

```
Continuidad  (10.1)   rho1*u1*A1 = rho2*u2*A2
Momento      (10.5)   p1*A1 + rho1*u1^2*A1 + INT(A1..A2) p dA = p2*A2 + rho2*u2^2*A2
Energia      (10.9)   h1 + u1^2/2 = h2 + u2^2/2      <=>   h0 = const   (10.10)
Estado       (10.11)  p = rho*R*T ;  (10.12)  h = cp*T

Formas diferenciales:
  (10.14)  d(rho*u*A) = 0
  (10.18)  dp = -rho*u*du            [Euler]
  (10.19)  dh + u*du = 0
```

**Supuestos:** estable, no viscoso, adiabático, sin fuerzas de cuerpo, gas caloríficamente perfecto,
variación de área **moderada** (para que `v`, `w` << `u`).
**Qué se rompe fuera:** con variación de área brusca el flujo es genuinamente 3-D y las "propiedades
medias" pierden sentido; con fricción/transferencia de calor en la pared la ec. (10.9) deja de valer;
con choques dentro del ducto el flujo **sigue siendo adiabático pero deja de ser isentrópico** —
`p0` cae, `T0` y `a*` se conservan.

**Inconsistencia declarada por el autor** (§10.2, p.698): la continuidad general 3-D reducida a 1-D
da `d(ρu)=0`, incompatible con (10.14). La (10.14) es la **única** forma diferencial de continuidad
que conserva masa bajo el supuesto casi-1D. No mezclar.

### 2.2 Relación área-velocidad y área-Mach (§10.2–10.3, p.699, 702)

```
(10.25)  dA/A = (M^2 - 1) * du/u

(10.32)  (A/A*)^2 = (1/M^2) * [ (2/(g+1)) * (1 + (g-1)/2 * M^2) ]^((g+1)/(g-1))
```

**Lectura de (10.25):**
- `0 ≤ M < 1`: acelerar exige **convergir**; desacelerar exige **divergir**.
- `M > 1`: acelerar exige **divergir**; desacelerar exige **convergir** (exactamente al revés).
- `M = 1`: `dA = 0` con `du` finito → **solo puede haber flujo sónico en un mínimo de área** (garganta).
- `M = 0`: se recupera `A·u = const` (incompresible).

**Rango de (10.32):** flujo **isentrópico** de gas caloríficamente perfecto. Exige `A/A* ≥ 1`;
`A < A*` es **físicamente imposible** en flujo isentrópico. Es **bivaluada**: p.ej. `A/A* = 2` →
`M = 0.31` o `M = 2.2`.
**Qué se rompe fuera:** si hay un choque dentro de la tobera, `A*` **cambia** al cruzarlo (porque
`p0` cae); hay que usar `A*1` aguas arriba y `A*2` aguas abajo. Si el flujo nunca llega a sónico,
`A*` es solo un área de referencia ficticia y `A_t > A*`.

### 2.3 Gasto y flujo ahogado (§10.3.1, p.715–716)

```
(E10.3)  mdot = (p0*Astar/sqrt(T0)) * sqrt( (g/R) * (2/(g+1))^((g+1)/(g-1)) )

(10.33)  mdot  proporcional a  p0*Astar/sqrt(T0)
```

**Rango:** tobera **ahogada** (`M=1` en la garganta), isentrópica hasta la garganta, gas
caloríficamente perfecto.
**Lecturas de diseño (literales, §10.3.1 p.716):** duplicar `p0` duplica `ṁ`; duplicar `A*` duplica
`ṁ`; **cuadruplicar `T0` reduce `ṁ` a la mitad**.
**Qué se rompe fuera:** si no está ahogada (`p_e,3 ≤ p_e ≤ p0`), `ṁ` **también depende de `p_e`** y
(E10.3) no aplica. Anderson prefiere (E10.3) sobre la cadena de pasos porque acumula menos error de
redondeo (§Ej. 10.5, p.715).

### 2.4 Segunda garganta y desarranque del túnel (§10.5, p.722)

```
(10.39)  At2/At1 = p0,1 / p0,2
```

**Derivación:** `a*` es constante en flujo adiabático (aunque cruce choques) y `T*` también, luego
`At2/At1 = ρ*1/ρ*2 = p*1/p*2 = p0,1/p0,2`.
**Rango:** flujo sónico en ambas gargantas, adiabático, gas caloríficamente perfecto.
**Consecuencia dura:** como `p0,2 < p0,1` **siempre** (hay choques), **`At2 > At1` siempre**. Solo
un difusor isentrópico ideal daría `At2 = At1`, y ese no existe.
**Qué se rompe fuera:** si `At2` es menor que ese valor, el difusor **se ahoga**: la naturaleza mete
choques dentro de la tobera, baja el Mach de la sección de pruebas y el túnel queda **desarrancado
(unstarted)**. En el caso extremo un choque normal se para dentro de la tobera y todo el flujo aguas
abajo es subsónico.

### 2.5 Ecuación del potencial de velocidad (§11.2, p.744)

```
(11.12)  (1 - (1/a^2)(dphi/dx)^2) * d2phi/dx2
       + (1 - (1/a^2)(dphi/dy)^2) * d2phi/dy2
       - (2/a^2)*(dphi/dx)*(dphi/dy)*d2phi/dxdy = 0

(11.13)  a^2 = a0^2 - ((g-1)/2) * [ (dphi/dx)^2 + (dphi/dy)^2 ]
```

**Rango:** 2-D, estable, **irrotacional**, isentrópico. **EXACTA** — vale de subsónico a hipersónico
y para cuerpos gruesos o delgados.
**Precio:** es **no lineal**. *"no general analytical solution of Equation (11.12) has been found to
this day"* (p.744). Se resuelve con CFD.
**Qué se rompe fuera:** flujo rotacional (p.ej. detrás de un choque **curvo**, §13.5 p.851) — ahí el
potencial **no existe** y hay que ir a continuidad + momento + energía completas.

### 2.6 Ecuación linealizada del potencial de perturbación (§11.3, p.747)

```
(11.18)  (1 - Minf^2) * d2phihat/dx2 + d2phihat/dy2 = 0

(11.32)  Cp = -2*uhat/Vinf                    [Cp linealizado]
(11.34)  dphihat/dy = Vinf * tan(theta)       [tangencia linealizada]
```

**Supuestos (los dos, simultáneos):**
1. **Perturbaciones pequeñas** — cuerpo delgado a ángulo de ataque pequeño: `û/V∞ << 1`,
   `v̂/V∞ << 1`, `û²/V∞² << 1`, `v̂²/V∞² << 1`.
2. **Mach fuera del transónico y del hipersónico.** El descarte de términos exige, LITERAL (p.747):
   - término #1 despreciable para `0 ≤ M∞ ≤ 0.8` **o** `M∞ ≥ 1.2`
   - término #2 despreciable para `M∞ < 5` (aproximadamente)

**Rango de validez resultante:** `0 ≤ M∞ ≤ 0.8` y `1.2 ≤ M∞ ≤ 5`.
**Qué se rompe fuera (LITERAL, p.748):** *"Equation (11.18) is not valid for thick bodies and for
large angles of attack. Moreover, it cannot be used for transonic flow, where 0.8 < M∞ < 1.2, or for
hypersonic flow, where M∞ > 5."*
La forma correcta en transónico es la **no lineal** (11.69); en hipersónico, teoría newtoniana o CFD.

### 2.7 Prandtl-Glauert (§11.4, p.750–754) — **la corrección estrella**

```
beta = sqrt(1 - Minf^2)

Transformacion:  xi = x ;  eta = beta*y ;  phibar(xi,eta) = beta*phihat(x,y)
  => (11.45)  d2phibar/dxi2 + d2phibar/deta2 = 0     [LAPLACE = flujo incompresible]
  => (11.48)  df/dx = dq/dxi                          [MISMO perfil en ambos espacios]

(11.51)  Cp = Cp0 / sqrt(1 - Minf^2)
(11.52)  cl = cl0 / sqrt(1 - Minf^2)
(11.53)  cm = cm0 / sqrt(1 - Minf^2)
```

**Cómo funciona conceptualmente:** transforma el problema **compresible** en `(x,y)` a un problema
**incompresible** en `(ξ,η)` **sobre el mismo perfil** (eso es lo que dice 11.48). Por eso la
corrección es una simple división por `β`.

**Rango de validez:**
- Hereda **todo** el dominio de (11.18): perfil delgado, α pequeño.
- Es **puramente subsónica** (`β` real exige `M∞ < 1`).
- LITERAL (p.751): *"begins to give inappropriate results at values of M∞ = 0.7 and above."*
- Deja de tener sentido físico **antes** del `M_cr` del perfil grueso, y por supuesto en cuanto
  aparece flujo localmente supersónico con choque.

**Qué se rompe fuera:** en `M∞ → 1`, (11.51) manda `|Cp| → ∞`. **Eso es artefacto de la teoría, no
física.** Fue la fuente histórica del mito de la "barrera del sonido" (§11.7, p.766). Un solver que
imprima ese infinito sin advertencia está mintiendo.

**Precisión conocida (Fig 11.4, NACA 4412 a α=1°53′):** P-G **subpredice** el `|Cp|` experimental;
Karman-Tsien y Laitone quedan más cerca. Los valores exactos de la gráfica → ver §7 NO OBSERVADO.

### 2.8 Correcciones mejoradas (§11.5, p.755)

```
(11.54) Karman-Tsien:
  Cp = Cp0 / [ sqrt(1-Minf^2) + (Minf^2/(1+sqrt(1-Minf^2))) * (Cp0/2) ]

(11.55) Laitone:
  Cp = Cp0 / [ sqrt(1-Minf^2)
             + Minf^2*(1 + ((g-1)/2)*Minf^2) / (2*sqrt(1-Minf^2)) * Cp0 ]
```

**Diferencia clave con P-G:** ambas son **no lineales en `Cp0`** (el `Cp0` aparece en el
denominador). Por eso capturan parte de la no linealidad del flujo. P-G es puramente lineal.
**Rango:** subsónico, perfil delgado. Referencias del libro: K-T = Refs. 27–28, Laitone = Ref. 29.
**Cuál usar:** Anderson usa **Karman-Tsien** cuando quiere un número creíble (Reto Integrado §11.16,
p.806: *"which was widely adopted after World War II"*), y P-G para estimaciones iniciales
(*"Because of their simplicity, Equations (11.51) to (11.53) are still used today for initial
estimates of compressibility effects."*, p.754).

### 2.9 Mach crítico y `Cp` crítico (§11.6, p.758–759)

```
(11.22)  Cp = (2/(g*Minf^2)) * (p/pinf - 1)                    [exacta]

(11.56)  pA/pinf = [ (1 + (g-1)/2 * Minf^2) / (1 + (g-1)/2 * MA^2) ]^(g/(g-1))

(11.58)  Cp,A = (2/(g*Minf^2)) *
         { [ (1 + (g-1)/2 * Minf^2) / (1 + (g-1)/2 * MA^2) ]^(g/(g-1)) - 1 }

(11.60)  Cp,cr = (2/(g*Mcr^2)) *
         { [ (1 + (g-1)/2 * Mcr^2) / (1 + (g-1)/2) ]^(g/(g-1)) - 1 }
```

**(11.58) es el caballo de batalla:** relaciona `Cp` local con `M` local dado `M∞`, en **flujo
isentrópico**. Anderson: *"the compressible flow analogue of Bernoulli's equation."*
**(11.60) es universal:** `Cp,cr` es función **única** de `M_cr`; **no depende de la forma del
perfil**. Se precomputa una vez y sirve para todos.
Sanidad: `Cp,cr = 0` cuando `M_cr = 1` (si la corriente ya es sónica, no hace falta ningún cambio de
presión para llegar a M=1 localmente).

**Procedimiento de estimación de `M_cr` (§11.6, p.759, tres pasos LITERALES):**
1. Obtener `(Cp,0)min` a baja velocidad (experimental o teórico) en el punto de presión mínima.
2. Trazar `Cp(M∞)` con (11.51), (11.54) o (11.55) — curva B.
3. Intersectar con (11.60) — curva C. El `M∞` de la intersección **es** `M_cr`.

**Precisión declarada:** la curva C es **exacta**; la curva B es **aproximada** (es una corrección de
compresibilidad). Por eso el método **estima**, no calcula. Anderson: *"such an estimation is quite
useful for preliminary design, and the results [...] are accurate enough for most applications."*
**Contraste con dato experimental (Ej. 11.3):** cálculo 0.74 vs experimento ≈ 0.73 → ~1 %.

**Supuesto oculto (§11.6.1, p.765):** que la **ubicación** del punto de presión mínima no se mueve al
subir `M∞`. Verificado experimentalmente para el NACA 0012 hasta M∞ = 0.725 (`x/c = 0.11` en los
tres casos).

**Efecto del espesor (§11.6, p.760):** perfil grueso → perturbación fuerte → `|Cp,0|min` grande →
la curva B corta a la C **antes** → `M_cr` menor. Perfil delgado → `M_cr` mayor.

### 2.10 Divergencia de arrastre (§11.7, p.766–768)

**No hay fórmula cerrada en el libro.** Es una definición operativa + hechos cuantificados:

- `M_drag-divergence` = el `M∞` donde `cd` **empieza a subir bruscamente**, un poco arriba de `M_cr`.
- Entre `M_cr` y `M_drag-div` hay una burbuja supersónica pequeña, con **Mach local típicamente
  1.02–1.05** (§11.7, p.766). Ahí `cd` casi no se mueve.
- Pasado `M_drag-div`, `cd` puede crecer **por un factor de 10 o más**.
- El mecanismo: región supersónica extensa terminada en **choque**; en un perfil grueso diseñado
  para baja velocidad el Mach local llega a **1.2 o más**, el choque terminal es fuerte, y el
  gradiente de presión adverso a través del choque **separa** la capa límite → arrastre grande.
  *"By 1940, it was well understood that the almost discontinuous pressure increase across the shock
  wave creates a strong adverse pressure gradient on the airfoil surface, and this adverse pressure
  gradient is responsible for separating the flow."* (§11.12, p.792)
- Acercándose a Mach 1, **ambas superficies** pueden ser supersónicas, cada una con su choque.
- El `cd` hace **pico en o cerca de Mach 1** y **baja** en supersónico.

### 2.11 El ala en flecha (Design Box §11.7, p.769–771; §11.13, p.792)

**Mecanismo geométrico (el que usa Anderson):** para un ala recta con `t1/c1 = 0.15`, al barrerla
`Λ = 45°` la línea de corriente ve el mismo espesor `t2 = t1` pero una cuerda efectiva
`c2 = 1.41·c1`, luego `t2/c2 = 0.106`. **La corriente "ve" un perfil más delgado sin quitar
volumen** → `M_cr` mayor → `M_drag-div` mayor.

**Mecanismo de Busemann (§11.13, p.792, el original de 1935):** el flujo sobre el ala está gobernado
principalmente por la **componente de velocidad perpendicular al borde de ataque**. Si barres lo
suficiente, esa componente es **subsónica** (borde de ataque subsónico) aun en vuelo supersónico →
caída dramática del arrastre de onda.

**Correcciones de compresibilidad a la pendiente de sustentación:**

```
(11.64)  a0,comp = a0 / sqrt(1 - Minf^2)

(11.65)  acomp = a0,comp / (1 + a0,comp/(pi*e1*AR))

(11.66)  acomp = a0 / [ sqrt(1 - Minf^2) + a0/(pi*e1*AR) ]        [ala recta, AR alto]

(11.67)  acomp = a0 / [ sqrt(1 - Minf^2 + (a0/(pi*e1*AR))^2) + a0/(pi*AR) ]
                                                                   [ala recta, AR bajo, Helmbold]

(11.68)  acomp = a0*cos(L) /
         [ sqrt(1 - Minf^2*cos^2(L) + ((a0*cos L)/(pi*AR))^2) + (a0*cos L)/(pi*AR) ]
                                                                   [ala en flecha]
```

donde `e1 = (1+τ)^{-1}` es el factor de eficiencia de envergadura **para la pendiente de
sustentación** (no el `e` del arrastre inducido), `AR` la relación de aspecto y `L = Λ` la flecha de
la **línea de media cuerda**, con `M∞,n = M∞ cos Λ`.
**Rango:** subsónico compresible, hereda P-G (perfil delgado, α pequeño, `M∞ ≲ 0.7`), más los
supuestos de la teoría de línea sustentadora (11.66) o de Helmbold (11.67).
**Reserva:** el alcance del radical en (11.67)/(11.68) quedó ambiguo tras el `pdftotext` — ver §7.

### 2.12 Regla del área (§11.8, p.774; Design Box §12.3, p.821)

**Transónica:** la distribución de área transversal **normal a la corriente**, del avión completo,
debe ser **suave**, sin discontinuidades en `A(x)` ni en `dA/dx`. Resultado: fuselaje "coca-cola" y,
típicamente, **factor 2 de reducción en el pico de arrastre cerca de Mach 1**.
**Supersónica:** el área relevante es la cortada por un **plano oblicuo al ángulo de Mach**
`μ = asin(1/M∞)`, y esa distribución oblicua debe ser suave. Ejemplo del F-16: cumple a
`M∞ = 1.2` (`μ = 56.4°`) y a `M∞ = 1.6` (`μ = 38.7°`).
**Origen:** conocimiento balístico de un siglo — proyectiles con variación suave de área vuelan más
rápido que los de área discontinua.
**Qué NO dice el libro:** no da una métrica cuantitativa de "suavidad" ni un funcional a minimizar.
Cualquier métrica que implementemos es `[EXTENSIÓN DECLARADA]`.

### 2.13 Perfil supercrítico (§11.9, p.775–777)

**Filosofía distinta:** no subir `M_cr`, sino **ensanchar el intervalo `M_cr → M_drag-div`**.
**Geometría LITERAL:** dorso relativamente **plano**; el 60 % delantero tiene **camber negativo**
(lo que quita sustentación) y el 30 % trasero **camber positivo extremo** (que la devuelve) — de ahí
la cúspide característica del intradós cerca del borde de salida.
**Efecto físico:** región supersónica **más pegada a la superficie**, **Mach locales menores**,
**choque terminal más débil** → menos arrastre.
**Motivo del cambio de estrategia:** el espesor tiene piso no aerodinámico —
*"the airfoil requires a certain thickness for structural strength, and there must be room for the
storage of fuel."* (p.775)

### 2.14 Potencial transónico de pequeña perturbación (§11.10, p.778)

```
(11.69)  (1 - Minf^2)*d2phihat/dx2 + d2phihat/dy2
       = Minf^2*(g+1)*(dphihat/dx)*(1/Vinf)*(d2phihat/dx2)
```

Se obtiene de la ec. exacta conservando **solo** el término dominante del lado derecho — el que
**no es pequeño** cerca de M∞ = 1. Sigue siendo **no lineal** (producto de derivadas de la incógnita)
→ exige solución numérica.
**Rango:** transónico, pero todavía con **perturbaciones pequeñas** (perfil delgado, α pequeño).
Para geometría arbitraria hay que subir al potencial completo (11.12), y para choques bien resueltos
a Euler, y para arrastre creíble a Navier-Stokes.

### 2.15 Supersónico linealizado (§12.2–12.3, p.812–818)

```
lambda = sqrt(Minf^2 - 1)

(12.1)   lambda^2 * d2phihat/dx2 - d2phihat/dy2 = 0        [HIPERBOLICA]
(12.2)   phihat = f(x - lambda*y)                          [solucion]
(12.7)   (dy/dx) = 1/sqrt(Minf^2 - 1) = tan(mu)            [lineas de Mach]

(12.15)  Cp = 2*theta / sqrt(Minf^2 - 1)

Placa plana a angulo alpha:
(12.16)  Cp,lower = +2*alpha/sqrt(Minf^2-1)
(12.17)  Cp,upper = -2*alpha/sqrt(Minf^2-1)
(12.19)  cn = 4*alpha/sqrt(Minf^2-1) ;  ca = 0  (espesor cero)
(12.23)  cl = 4*alpha/sqrt(Minf^2-1)
(12.24)  cd = 4*alpha^2/sqrt(Minf^2-1)

Perfil delgado arbitrario:
         cl = 4*alpha/sqrt(Minf^2-1)                       [igual: NO depende de la forma]
         cd = 4/sqrt(Minf^2-1) * (alpha^2 + gc^2 + gt^2)   [gc: camber, gt: espesor]
```

**Rango:** cuerpo 2-D **delgado**, `θ` pequeño, `1.2 ≤ M∞ ≤ 5` (hereda 11.18). Es teoría de
perturbación pequeña: **no admite ondas de fuerza finita**.
**Qué se rompe fuera:** LITERAL (p.814) *"Linearized theory is approximate; one of the consequences
of this approximation is that waves of finite strength (shock and expansion waves) are not
admitted."* Y sin embargo **predice arrastre de onda finito** — resultado no obvio y bonito de
enseñar.
**Precisión medida (Ej. 12.1, α=5°, M=3):** `cl` 0.123 vs exacto 0.125 → **1.6 %**.
**Dónde se degrada:** el Problema 12.1 pide comparar a α = 5°, 15° y 30° contra teoría
choque-expansión exacta. El libro no publica esos números → ver §7.
**Tendencia inversa (p.815):** `Cp ∝ (M∞²−1)^{−1/2}` en supersónico (decrece con M∞) vs
`Cp ∝ (1−M∞²)^{−1/2}` en subsónico (crece con M∞). Ambas divergen en M∞→1 y **ninguna vale ahí**.

### 2.16 Fricción compresible (§12.4, p.822–823)

```
Incompresible:  Cf = 1.328/sqrt(Re_c)   (laminar, 4.86)
                Cf = 0.074/Re_c^(1/5)   (turbulento, 4.88)

Compresible:
(12.25)  Cf = F(Me, Pr, Tw/Te) / sqrt(Re_c)      [laminar]
(12.26)  Cf = G(Me, Pr, Tw/Te) / Re_c^(1/5)      [turbulento]

Pr = mu*cp/k
```

**Lo que cambia con la compresibilidad:** **solo el numerador**; la ley de potencia en Reynolds se
mantiene. `F` y `G` salen de soluciones numéricas de la capa límite (caps. 18–19).
**Tendencia:** `Cf` **baja** al subir `M∞`, y la caída es **más dramática en turbulento**.
**Los valores de `F` y `G` NO están tabulados en mi rango** — viven en la Figura 19.1. Ver §7.

### 2.17 Método de las características (§13.2, p.833–840)

**Existencia de las características:** se prueba resolviendo por Cramer para `∂²φ/∂x∂y`
(ec. 13.4). Cuando el **denominador `D = 0`**, la derivada es indeterminada; para que exista un valor
finito debe cumplirse también `N = 0`. `D = 0` da las **direcciones características**; `N = 0` da las
**ecuaciones de compatibilidad**.

```
(13.10)  (dy/dx)_char = tan(theta -/+ mu)
         => las caracteristicas SON las lineas de Mach:
            C-  a  (theta - mu)   [derecha, right-running]
            C+  a  (theta + mu)   [izquierda, left-running]

(13.14)  dtheta = -/+ sqrt(M^2-1) * dV/V         [= ec. (9.32) de Prandtl-Meyer]

(13.17)  theta + nu(M) = K-   (constante sobre una C- dada)
(13.18)  theta - nu(M) = K+   (constante sobre una C+ dada)

Punto interno (13.23)/(13.24):
   theta3 = 0.5*[ (K-)_1 + (K+)_2 ]
   nu3    = 0.5*[ (K-)_1 - (K+)_2 ]

Punto de pared (13.25)/(13.26):
   (K-)_5 = (K-)_4 = theta4 + nu4 ;  theta5 conocido  =>  nu5 = (K-)_5 - theta5
```

**Rango:** flujo **supersónico**, estable, no viscoso, 2-D, **irrotacional** (para que las
compatibilidades sean **algebraicas**). Anderson: en supersónico general las compatibilidades son
EDOs; *"only in the case of two-dimensional irrotational flow do they further reduce to algebraic
equations."*
**Qué se rompe fuera:** en **subsónico** las características no están definidas de forma práctica
(§13.5, p.850) — la ecuación es elíptica. Con **rotacionalidad** (choque curvo) hay que ir a la
formulación general. Con **choques** el MOC no los captura (es solución isentrópica).
**Error numérico:** viene de aproximar las características curvas por **segmentos rectos** con
pendiente promedio. Exacto solo en el límite de infinitas características.
**Por qué vale la pena:** convierte EDPs no lineales en EDOs (aquí, ecuaciones algebraicas).
*"Finding the solution of such ordinary differential equations is usually much simpler than dealing
with partial differential equations."*

**Diseño de tobera (§13.3, p.840–843):** el paso que el cap. 10 **no puede dar**.
- Convergente subsónica: *"there is no specific contour which is better than any other"* — decisión
  humana.
- Línea sónica **curva** por la 2-D del cuello; empezar aguas abajo de la **característica límite**.
- Sección de **expansión**: `θ` crece hasta `θmax`; forma arbitraria (arco circular de radio grande
  en muchos túneles).
- Sección de **enderezamiento**: `θ` decrece a 0; **calculada** para cancelar las ondas de expansión.
  Como no hay ondas reflejadas, `θ` es constante sobre la característica que la cruza → `θ12 = θ9`.
- Simetría: solo hay que calcular la mitad superior.

### 2.18 Diferencias finitas y MacCormack (§13.4, p.844–849)

```
(13.27)  (du/dx)_ij = (u_{i+1,j} - u_{i,j}) / Dx        [adelantada]
(13.28)  (du/dx)_ij = (u_{i,j} - u_{i-1,j}) / Dx        [atrasada]
(13.29)  (du/dx)_ij = (u_{i+1,j} - u_{i-1,j}) / (2Dx)   [centrada]

Variables de flujo (forma conservativa), (13.39a-d):
   F = rho*u
   G = rho*u^2 + p
   H = rho*u*v
   K = rho*u*(e + V^2/2) + p*u

(13.40)-(13.43):
   dF/dx = -d(rho*v)/dy
   dG/dx = -d(rho*u*v)/dy
   dH/dx = -d(rho*v^2 + p)/dy
   dK/dx = -d( rho*v*(e+V^2/2) + p*v )/dy

Transformacion a malla rectangular (13.47):
   xi = x ;  eta = y/ys  con ys = f(x)
   d/dx = d/dxi - (eta/ys)*(dys/dx)*d/deta
   d/dy = (1/ys)*d/deta

Marchado (13.54a-d):   F_{i+1,j} = F_{i,j} + (dF/dxi)_ave * Dxi
   PREDICTOR  (13.55)/(13.56): (dF/dxi)_{i,j}    con diferencias ADELANTADAS  -> Fbar_{i+1,j}
   CORRECTOR  (13.57):         (dF/dxi)_{i+1,j}  con diferencias ATRASADAS
   PROMEDIO   (13.58):         (dF/dxi)_ave = 0.5*[ (dF/dxi)_{i,j} + (dF/dxi)_{i+1,j} ]
```

**Rango:** flujo **supersónico** en la dirección de marchado (hiperbólico en `x`), no viscoso,
adiabático, estable, sin fuerzas de cuerpo. **Puede ser rotacional** — no importa.
**Qué se rompe fuera:** *"if it were to be used in a locally subsonic region, the calculation would
blow up"* (§13.5, p.850).
**Lo que Anderson NO desarrolla (declarado por él, p.850):** qué valores de `Δη` y `Δξ` mantienen
la **estabilidad numérica**, y cómo se impone la **tangencia en la pared** en diferencias finitas.
Remite al cap. 11 de la Ref. 21. Ver §7.

### 2.19 Técnica dependiente del tiempo (§13.5, p.852–855)

```
(13.59)  drho/dt = -[ d(rho*u)/dx + d(rho*v)/dy ]
(13.60)  du/dt   = -[ u*du/dx + v*du/dy + (1/rho)*dp/dx ]
(13.61)  dv/dt   = -[ u*dv/dx + v*dv/dy + (1/rho)*dp/dy ]
(13.62)  d(e+V^2/2)/dt = -[ u*d(e+V^2/2)/dx + v*d(e+V^2/2)/dy
                          + (1/rho)*d(p*u)/dx + (1/rho)*d(p*v)/dy ]

Transformacion:  xi = (x - b)/(s - b) ;  eta = y
   b = b(y)    -> cuerpo,  xi = 0
   s = s(y,t)  -> choque,  xi = 1     [la forma del choque es INCOGNITA y funcion de t]

(13.63)  rho_{i,j}(t+Dt) = rho_{i,j}(t) + [ (drho/dt)_{i,j} ]_ave * Dt
   PREDICTOR: derivadas espaciales con diferencias ADELANTADAS -> rhobar(t+Dt)
   CORRECTOR: con rhobar, derivadas espaciales ATRASADAS -> (drho/dt) en t+Dt
(13.64)  promedio de las dos
```

**El truco central:** las ecuaciones **no estacionarias** son **hiperbólicas en `t`**, sin importar
si el punto es local subsónico o supersónico. Por eso el mismo algoritmo avanza uniformemente en
**todo** el campo mixto.
**Rango:** flujo mixto subsónico-supersónico de extensión arbitraria; no viscoso.
*"the time-dependent technique is the only approach known today which allows the uniform calculation
of a mixed subsonic-supersonic flow field of arbitrary extent."*
**Costo:** una variable independiente extra (`t`). Anderson lo justifica explícitamente: el
problema es "extremadamente difícil de resolver por un enfoque puramente estacionario".
**Comportamiento observado (Fig 13.12–13.13, cilindro parabólico M∞=4):** la onda se aleja rápido al
inicio, se frena hacia los 300 pasos, y **entre 300 y 500 pasos está prácticamente inmóvil**. La
presión en el punto de estancamiento **oscila fuerte** al principio y luego se asienta
asintóticamente.
**Por qué NO se puede usar potencial:** el choque es **curvo**, cada línea de corriente lo cruza en
un punto distinto y gana entropía distinta (`s_c < s_b < s_a`) → gradiente de entropía normal a las
líneas de corriente → **flujo rotacional**.

### 2.20 Flujo cónico y Taylor-Maccoll (§13.6, p.859–866)

**Definición de flujo cónico:** todas las propiedades son **constantes a lo largo de rayos desde el
vértice**. Justificación física: un cono semi-infinito no tiene longitud de escala, así que la
presión no puede depender de la distancia. **Probado experimentalmente.**

```
Condiciones:  d/dphi = 0  (axisimetrico)  y  d/dr = 0  (flujo conico)

(13.66) Continuidad:
   2*rho*Vr + rho*Vtheta*cot(theta) + rho*dVtheta/dtheta + Vtheta*drho/dtheta = 0

(13.67) Crocco:  T*grad(s) = grad(h0) - V x (curl V)
   Choque RECTO => grad(s) = 0 ; adiabatico estable => grad(h0) = 0  =>  curl V = 0
   => el campo conico es IRROTACIONAL

(13.70) Irrotacionalidad:  Vtheta = dVr/dtheta

(13.73)  a^2 = ((g-1)/2)*(Vmax^2 - Vr^2 - Vtheta^2) ,  Vmax = sqrt(2*h0)

(13.78) TAYLOR-MACCOLL (dimensional):
   ((g-1)/2)*(Vmax^2 - Vr^2 - (dVr/dtheta)^2) *
       [ 2*Vr + (dVr/dtheta)*cot(theta) + d2Vr/dtheta2 ]
   - (dVr/dtheta) * [ Vr*(dVr/dtheta) + (dVr/dtheta)*(d2Vr/dtheta2) ] = 0

(13.80) forma no dimensional con V' = V/Vmax

(13.81)  V' = V/Vmax = [ 2/((g-1)*M^2) + 1 ]^(-1/2)     => V' = f(M) unicamente
```

**Rango:** cono recto circular **afilado**, a **ángulo de ataque cero**, en flujo supersónico con
**choque adherido** (`θc < θc,max`), gas caloríficamente perfecto, no viscoso.
**Qué se rompe fuera:** si `θc > θc,max` **no existe solución de Taylor-Maccoll** — el choque se
desprende y hay que ir al *time-marching* de §13.5. Con ángulo de ataque el flujo deja de ser
axisimétrico. Con choque **curvo** el flujo sería rotacional y Crocco ya no daría `curl V = 0`.

**Procedimiento numérico INVERSO (§13.6.3, p.865):**
1. Suponer `θs` y `M∞` → relaciones de choque oblicuo → `M2` y deflexión `δ`.
2. De `M2` y `δ` (geometría) → `Vr'` y `Vθ'` justo detrás del choque (con `V'` de 13.81).
3. Integrar (13.80) en pasos `Δθ` marchando **desde el choque hacia adentro** (Runge-Kutta), con
   `Vr'` detrás del choque como valor de frontera.
4. En cada paso calcular `Vθ' = dVr'/dθ` (13.79). **Donde `Vθ' = 0`, ahí está la superficie del
   cono:** `θ = θc`. (Velocidad normal nula en pared impermeable.)
5. En cada rayo, `V' = √(Vr'² + Vθ'²)` → `M` por (13.81) → `p`, `ρ`, `T` por las isentrópicas.

Repitiendo con distintos `(M∞, θs)` se generan las tablas. Referencias: **Kopal (Ref. 95)** y
**Sims (Ref. 96)**.

**Efecto de alivio 3-D (§13.6.4, p.868):** frente a la cuña del mismo ángulo, el cono da choque
**más débil**, menor `p`, `T`, `ρ`, `s` en superficie, y **mayor ángulo máximo con choque adherido**.
**Rareza útil (Fig 13.23, p.869):** con `θc` grande pero `< θc,max`, uno de los rayos puede ser
**línea sónica** y el flujo cerca de la superficie del cono llega a subsónico por **compresión
isentrópica**, sin choque. Es de los pocos casos así en la naturaleza.

### 2.21 Teoría newtoniana (§14.3–14.4, p.877–888)

```
Derivacion (14.1)-(14.3):
   flujo masico incidente = rho_inf*(A*sin theta)*V_inf
   cambio de momento normal = (rho_inf*V_inf*A*sin theta)*(V_inf*sin theta)
   N/A = rho_inf*V_inf^2*sin^2(theta)  =  p - p_inf

(14.4)  Cp = 2*sin^2(theta)      [theta: tangente a la superficie vs corriente libre]
(14.5)  Cp = 2*cos^2(phi)        [phi: normal a la superficie vs corriente libre]
(14.7)  Cp = Cp,max * sin^2(theta)                    [NEWTONIANO MODIFICADO]
        Cp,max = (2/(g*Minf^2)) * (p0,2/p_inf - 1)    [teoria exacta de choque normal]

Placa plana a alpha:
(14.8)   Cp,lower = 2*sin^2(alpha)
(14.9)   Cp,upper = 0                    ["sombra": solo actua p_inf]
(14.11)  cn = 2*sin^2(alpha)
(14.14)  cl = 2*sin^2(alpha)*cos(alpha)
(14.15)  cd = 2*sin^3(alpha)
(14.16)  L/D = cot(alpha)
(14.18)  cd ~ 2*alpha^3   (alpha pequeno)   [ojo: CUBICA, no cuadratica]
(14.20)  cl ~ 2*alpha^2   (alpha pequeno)

Con friccion cd,0 constante:
(14.19)  cd = 2*sin^3(alpha) + cd,0
(14.23)  alpha[(L/D)max] = (cd,0)^(1/3)
(14.24)  (L/D)max = 0.67/(cd,0)^(1/3)      [= (2/3)*(cd,0)^(-1/3)]
(14.27)  en ese punto:  cd,wave = 2*cd,0
```

**Interpretación física de `N/A` (§14.3, p.878):** el modelo de Newton supone partículas con
movimiento **puramente dirigido**, sin movimiento aleatorio. Como `p∞` **es** la medida del
movimiento aleatorio, `N/A` debe interpretarse como **`p − p∞`**, no como `p`. Ese es el paso que
convierte un modelo del siglo XVII en una fórmula de ingeniería.

**Independencia de teoría de `L/D = cot α` (§14.4, p.884, y Ej. 14.1 discusión, p.890):**
*"Equation (14.16) is a general result for inviscid supersonic or hypersonic flow over a flat plate.
[...] Hence, Equation (14.16) is not limited to newtonian theory."* Si la resultante es **normal** a
la placa, `L/D = cot α` **por geometría**, sin importar con qué teoría calculaste las presiones.

**Rango de validez de (14.4):** mejora al **subir M∞** y al **subir θ**; **mejor en cuerpos 3-D**
(cono) que 2-D (cuña); **buena para cuerpos romos** en la región de la nariz (con 14.7).
**Qué se rompe fuera:** para cuerpos 2-D delgados con tangentes a ángulo pequeño/moderado —
p.ej. el perfil biconvexo de la Fig 12.3 — la ley del seno cuadrado **no** predice bien la
distribución de presión (Ej. 14.1: error de 29 % abajo y 100 % arriba). **Pero `L/D` sale exacta.**
Referencia dedicada del libro para este tema: **Ref. 73**.

**El máximo de `cl` es geométrico (§14.4, p.886):** `Cp` crece monótonamente hasta α = 90° y `N`
también, pero `L = N cos α`. El máximo cae en α = 54.7° con `cl,max = 0.77`.
Derivación: `dcl/dα = 0` → `sin²α = 2cos²α = 2(1 − sin²α)` → `sin²α = 2/3` → α = 54.7°.
**Contraste con baja velocidad:** `cl,max` hipersónico (0.77) es **pequeño** frente a los valores de
bajo Mach; y la pendiente efectiva es baja.

### 2.22 Relaciones de choque hipersónicas (§14.5, p.892–895)

```
EXACTAS (cap 9), reescritas con Mn1 = M1*sin(beta):
(14.28)  p2/p1 = 1 + (2g/(g+1))*(M1^2*sin^2 beta - 1)
(14.30)  rho2/rho1 = (g+1)*M1^2*sin^2 beta / [ (g-1)*M1^2*sin^2 beta + 2 ]
         T2/T1 = (p2/p1)/(rho2/rho1)
(9.23)   tan(theta) = 2*cot(beta) * (M1^2 sin^2 beta - 1)/(M1^2*(g + cos 2beta) + 2)
(14.38)  Cp = (4/(g+1)) * ( sin^2 beta - 1/M1^2 )

LIMITE M1 -> infinito:
(14.29)  p2/p1   -> (2g/(g+1)) * M1^2 * sin^2 beta        [DIVERGE]
(14.31)  rho2/rho1 -> (g+1)/(g-1)                          [CONSTANTE: 6 con g=1.4]
(14.32)  T2/T1   -> (2g(g-1)/(g+1)^2) * M1^2 * sin^2 beta  [DIVERGE]
(14.39)  Cp      -> (4/(g+1)) * sin^2 beta                 [CONSTANTE]

LIMITE M1 -> infinito Y theta pequeno:
(14.35)  beta/theta -> (g+1)/2
(14.36)  con g=1.4:  beta = 1.2*theta

DOBLE LIMITE M1 -> infinito Y g -> 1:
(14.40)  Cp -> 2*sin^2(beta)
(14.43)  rho2/rho_inf -> infinito   => el choque se PEGA al cuerpo => beta = theta
(14.44)  Cp = 2*sin^2(theta)        == LEY DE NEWTON (14.4)
```

**Para qué sirven (LITERAL, p.894):** *"In terms of actual quantitative results, it is always
recommended that the exact oblique shock equations be used, even for hypersonic flow. [...] The value
of the relations obtained in the hypersonic limit is more for theoretical analysis rather than for
the calculation of actual numbers."*
**Lo que enseñan:** (14.36) demuestra numéricamente la **capa de choque delgada** — a Mach alto sobre
una cuña esbelta, el ángulo de onda es **solo 20 % mayor** que el de la cuña.
Ancla del cap.: cuña de semiángulo 15° a M∞=36 → **β = 18°** (§14.2, p.873).

### 2.23 Independencia de Mach (§14.6, p.896–898)

**Enunciado:** a Mach suficientemente alto, las cantidades **adimensionales** (`Cp`, `CL`, `CD`,
forma del choque, patrones de ondas de Mach) se vuelven **esencialmente independientes de `M∞``.
**Evidencia teórica:** (14.39) muestra `Cp` constante en el límite; `CL` y `CD` son integrales de
`Cp` (ecs. 1.15, 1.16, 1.18, 1.19), luego también son independientes. La teoría newtoniana es el
caso extremo: (14.4) **no contiene M∞ en absoluto**.
**Evidencia experimental (Fig 14.16):** `CD` de esferas y de un cono-cilindro medido en un rango de
balística cruzando subsónico, supersónico e hipersónico: tras el pico transónico y la caída
supersónica, `CD` **se aplana**. La **esfera alcanza la independencia a Mach más bajo** que el
cono-cilindro.
**Advertencia dura (p.897):** *"it is the nondimensional variables that become Mach number
independent. Some of the dimensional variables, such as p, are not Mach number independent; indeed,
p → ∞ and M∞ → ∞."*
**Fundamento matemático (p.898):** las ecuaciones de Euler adimensionalizadas + condiciones de
frontera en el límite hipersónico **no contienen `M∞`** — por definición la solución no depende de él.

### 2.24 Calentamiento aerodinámico (§14.8, p.901–908)

```
(14.45)  CH = qdot_w / [ rho_e * u_e * (h_aw - h_w) ]      [numero de Stanton]

Aproximaciones para placa plana hipersonica:
(14.46)  h_aw ~ h_0        [T_aw es ~12% menor que T0 en laminar de Mach alto]
(14.48)  h_0  ~ V_inf^2/2  [porque h_inf = cp*T_inf es chico frente a V^2/2]
(14.49)  h_0 >> h_w        [la pared debe estar por debajo de su T de fusion]
(14.50)  h_aw - h_w ~ V_inf^2/2

(14.51)  qdot_w ~ 0.5 * rho_inf * V_inf^3 * CH     [CUBO de la velocidad]

Analogia de Reynolds:
(18.50)  CH/Cf = 0.5 * Pr^(-2/3)      [laminar]
(14.54)  CH_bar/Cf_bar = 0.5          [con Pr = 1, integrado]

(14.53)  dQ/dt = 0.5*rho_inf*V_inf^3*S*CH_bar
(14.55)  dQ/dt = 0.25*rho_inf*V_inf^3*S*Cf_bar

Entrada atmosferica (integrando con F = D = -m dV/dt):
(14.60)  Q_total = 0.5 * (Cf_bar/CD) * ( 0.5*m*V_E^2 )

Punto de estancamiento:
(18.83)  qdot_w  proporcional a  1/sqrt(R)          [R = radio de nariz]

(14.61)/(14.62) Tauber & Meneses (Ref. 97):
  qdot_w = rho_inf^0.5 * V_inf^3 * (1.83e-8 * R^(-0.5)) * (1 - h_w/h_0)
  UNIDADES OBLIGATORIAS: qdot_w [W/cm2], V_inf [m/s], rho_inf [kg/m3], R [m]
```

**El resultado que decide el diseño (§14.8.2, p.904–906):**
`Q_total` es proporcional a (a) la **energía cinética inicial** `½ m V_E²` y (b) la **fracción de
fricción en el arrastre** `C̄f/CD`. Como
- cuerpo **esbelto**: `CD ≈ C̄f` → `C̄f/CD ≈ 1`
- cuerpo **romo**: `CD ≈ CD_p` → `C̄f/CD << 1`

la conclusión es literal y en negritas en el libro:
> *"To minimize aerodynamic heating, the vehicle must be a blunt body, i.e., have a blunt nose."*

Y `q̇w ∝ 1/√R` es *"absolute mathematical proof that a blunt body reduces aerodynamic heating."*

**Reconciliación de la dependencia con densidad (§14.8.3, p.907):** (14.51) parece decir
`q̇w ∝ ρ∞`, pero en laminar `CH ∝ 1/√Re ∝ 1/√ρ∞`, luego `q̇w ∝ √ρ∞` — consistente con (14.62).
**Rango de (14.62):** punto de **estancamiento**, capa límite **laminar** (lo es en esa región),
`h_w/h_0` conocido. Los exponentes `M=3`, `N=0.5` y la constante `C` son **específicos del punto de
estancamiento** — el libro no da los de otras estaciones.
**Regla cualitativa barata (p.908):** *"the distribution of the aerodynamic heating rate over a
surface tends to qualitatively follow the distribution of pressure over the surface."*

### 2.25 Waveriders (§14.9, p.908–921)

**Definición:** vehículo supersónico/hipersónico con la onda de choque **adherida en todo el borde de
ataque**. Ventaja: la alta presión bajo el vehículo **no se fuga** al dorso → más sustentación al
mismo α → mismo `L` a **menor α** → mejor `L/D`.
**Matiz honesto del autor (p.911):** a **igual α**, el `L/D` del waverider es mejor "pero no
mucho" (porque también sube el arrastre de onda). La ganancia real viene de **volar a menor α**.

**Construcción inversa (p.911–913):**
1. Elegir un campo generador **conocido**: cuña (choque plano, calculable con el cap. 9, **sin CFD**)
   o cono a α=0 (choque cónico, Taylor-Maccoll §13.6).
2. Trazar una curva **arbitraria** sobre la superficie del choque → esa curva **es** el borde de
   ataque.
3. La **superficie de corriente** generada por las líneas de corriente que nacen en esa curva **es**
   la superficie inferior del vehículo.
4. Con cuña, las superficies resultan planas → sección en **caret** (∧) — el waverider de Nonweiler
   (Ref. 99, 1959). Con cono, hay más libertad de forma — Jones (Ref. 100, 1963).
5. Anderson orienta la cuña generadora con el dorso **paralelo a la corriente**, así que el dorso del
   caret tampoco tiene onda.

**Vehículo de punto de diseño:** el choque generador corresponde a un `M∞` y una deflexión dados.
Volando a ese `M∞` y con esa deflexión, *"nature will make certain that the shock wave is attached
all along the vehicle's leading edge."* Fuera de ahí, deja de ser waverider.

**Optimización viscosa (§14.9.1, p.914–918):** el paso que revivió el concepto. La fricción entra
**dentro** del lazo:
1. superficie inferior: superficie de corriente detrás de choque cónico (Taylor-Maccoll);
2. superficie superior: **superficie de expansión**, calculada con método de las características
   axisimétrico (como un cilindro cónico a α=0);
3. viscosidad: capa límite **integral** siguiendo líneas de corriente superficiales, **con
   transición** laminar→turbulenta;
4. bordes de ataque **romos**: se calcula el radio máximo que da temperatura superficial aceptable, y
   su arrastre se estima con **newtoniano modificado**;
5. optimización: **simplex de Nelder-Mead** (Ref. 108) — no cálculo de variaciones, porque los
   efectos viscosos no tienen forma analítica —, con `b/l` (esbeltez) como **restricción**.

**Estructura del óptimo (p.917–918):** para cada `θs` se busca la curva de borde de ataque que
maximiza `L/D`; luego se barre `θs` y se toma el "óptimo de los óptimos". A M∞=6 con las condiciones
de la Fig 14.27, el mejor es **`θs = 12°`**.
**Invariante empírico:** en la mejor forma a cualquier `M∞`, **arrastre de onda y fricción quedan del
mismo orden — nunca difieren por más de un factor de 2**. Abajo del óptimo (`θs = 11°`) domina la
fricción; arriba (`θs = 13°`, `14°`) domina la onda.
> Compárese con (14.27): en la placa plana newtoniana en `(L/D)max`, `cd,w = 2·cd,0` — **exactamente
> el factor 2**. Anderson lo señala explícitamente. Es un puente bonito entre los dos análisis.

**Las dos correlaciones de barrera (p.919–920):**
```
Kuchemann (Ref. 66), vehiculos convencionales:
   (L/D)max = 4*(Minf + 3)/Minf

Waveriders viscoso-optimizados (Bowcutt/Corda/Anderson, Refs. 106-110):
   (L/D)max = 6*(Minf + 2)/Minf
```
La primera es una **barrera empírica** difícil de romper; la segunda queda **por encima** — eso es lo
que reanimó el interés en el concepto. Confirmado con túnel de viento.
**Anclas de comparación:** placa plana hipersónica laminar M=10, Re=3×10⁶ → `(L/D)max ≈ 6.5`;
Boeing 747 en crucero → `≈ 20` (§14.9, p.909).
**Vehículo real:** el **X-51** (Boeing, USAF), SCRAMjet, Mach 5–6, **es un waverider
viscoso-optimizado**. Vuelo del 1 de mayo de 2013: más de 6 minutos, Mach 5+ durante 210 s — el vuelo
hipersónico con SCRAMjet de mayor duración a la fecha de la edición.

---

## 3. FIXTURES DE TEST

Todos los ejemplos numéricos resueltos de los capítulos 10 a 14, en el formato de la regla 3.
Los ejercicios **sin respuesta publicada** se listan al final como casos de prueba pendientes: no
invento sus salidas.

> **Tolerancias.** Anderson declara su propio método (Ej. 10.5, p.715): *"the author is using a hand
> calculator and usually rounding off to the fourth significant figure."* Además muchos valores se
> **leen de tablas** (Apéndices A, B, C) redondeadas a 2–3 cifras. Por eso las tolerancias van por
> caso: 0.5 % donde el cálculo es cerrado, 1–2 % donde hay lectura de tabla, 3–5 % donde hay lectura
> de **gráfica**.

### 3.1 Capítulo 10 — Toberas, difusores y túneles de viento

```
FIXTURE anderson-ej-10.1 [§10.3, p.710]
entradas: Ae/A* = 10.25, p0 = 5 atm, T0 = 600 R, gamma = 1.4, rama SUPERSONICA
salida esperada: Me = 3.95 ; pe/p0 = 1/142 -> pe = 0.035 atm ;
                 Te/T0 = 1/4.12 = 0.2427 -> Te = 145.6 R
tolerancia: 1% (Me y las razones se leen del Apendice A)
nota: es el uso mas simple de la ec. (10.32): area -> Mach -> isentropicas.
```

```
FIXTURE anderson-ej-10.2a [§10.3, p.711]
entradas: Ae/A* = 2, p0 = 1 atm, T0 = 288 K, gamma = 1.4, salida SUPERSONICA
salida esperada: garganta  Mt = 1.0 ; pt = 0.528*p0 = 0.528 atm ; Tt = 0.833*T0 = 240 K
                 salida    Me = 2.2 ; pe = p0/10.69 = 0.0935 atm ; Te = T0/1.968 = 146 K
tolerancia: 1%
nota: 0.528 y 0.833 son las razones sonicas universales para gamma=1.4 -> deben ser
      constantes del modulo, no numeros magicos.
```

```
FIXTURE anderson-ej-10.2b [§10.3, p.711]
entradas: Ae/A* = 2, p0 = 1 atm, T0 = 288 K, gamma = 1.4,
          flujo SUBSONICO en todos lados salvo M=1 en la garganta
salida esperada: garganta  Mt = 1.0 ; pt = 0.528 atm ; Tt = 240 K   (identico a 10.2a)
                 salida    Me = 0.3 ; pe = p0/1.064 = 0.94 atm ; Te = T0/1.018 = 282.9 K
tolerancia: 2%  (el libro dice "rounded to the nearest entry in Appendix A")
nota: MISMA geometria, MISMA garganta, DOS soluciones. Es el fixture que prueba que el
      solver respeta la bivaluacion de (10.32). pe = 0.94 atm es el p_e,3 de la Fig 10.13.
```

```
FIXTURE anderson-ej-10.3 [§10.3, p.711-712]
entradas: misma tobera (Ae/At = 2), p0 = 1 atm, pe = 0.973 atm
salida esperada: p0/pe = 1.028 -> Me = 0.2 ; Ae/A* = 2.964
                 At/A* = (At/Ae)*(Ae/A*) = 0.5*2.964 = 1.482 -> Mt = 0.44
tolerancia: 2% (dos lecturas encadenadas del Apendice A; "nearest entry")
nota: fixture CLAVE para el bug At vs A*. Como pe = 0.973 > p_e,3 = 0.94 atm, el flujo es
      subsonico en TODA la tobera, la garganta NO esta sonica y A* es solo una referencia
      ficticia: At/A* = 1.482 > 1.
```

```
FIXTURE anderson-ej-10.4a [§10.3, p.712-714]
entradas: motor cohete H2/O2. p0 = 30 atm, T0 = 3500 K, A* = 0.4 m2,
          gamma = 1.22, R = 520 J/(kg K), 1 atm = 1.01e5 N/m2,
          pe = p_inf a 20 km de altitud estandar = 5.5293e3 N/m2 (Apendice D)
salida esperada (cadena completa):
          rho0   = 30*1.01e5/(520*3500)   = 1.665 kg/m3
          rho*/rho0 = (2/(g+1))^(1/(g-1)) = 0.622  -> rho* = 1.036 kg/m3
          T*/T0     = 2/(g+1)             = 0.901  -> T*   = 3154 K
          a*        = sqrt(g*R*T*)                 = 1415 m/s
          mdot      = rho* * a* * A*               = 586.4 kg/s
          1 + ((g-1)/2)*Me^2 = (p0/pe)^((g-1)/g) = (548)^0.18 = 3.111
          Me        = 4.38
          Te        = T0/3.111 = 1125 K
          ae        = sqrt(g*R*Te) = 844.8 m/s
          ue        = Me*ae = 3700 m/s
          T (empuje) = mdot*ue = 2.17e6 N = 487,600 lb  (con 1 N = 0.2247 lb)
tolerancia: 1%
verificacion cruzada que el libro EXIGE: ue por la ecuacion de energia,
          ue^2 = 2*cp*(T0 - Te) con cp = g*R/(g-1) = 2883.6 J/(kg K)
          -> ue^2 = 2*2883.6*(3500-1125) = 1.3697e7 -> ue = 3700 m/s  (coincide)
nota: gamma = 1.22 y R = 520, NO aire. El solver DEBE aceptar gas arbitrario.
      El termino (pe - p_inf)*Ae de (E10.1) se ANULA por diseno (tobera adaptada a 20 km).
```

```
FIXTURE anderson-ej-10.4b [§10.3, p.714-715]
entradas: las de 10.4a, mas Me = 4.38 y gamma = 1.22
salida esperada: (g+1)/(g-1) = 10.1 ; 2/(g+1) = 0.9 ; 1+((g-1)/2)Me^2 = 3.111
                 (Ae/A*)^2 = (1/Me^2)*[0.9*3.111]^10.1 = 1710.8
                 Ae/A* = 41.36  ->  Ae = 41.36*0.4 = 16.5 m2
tolerancia: 1%
nota: prueba (10.32) con gamma != 1.4 y en la rama supersonica de area GRANDE.
      Un cohete de vacio tiene relaciones de area enormes: 41:1.
```

```
FIXTURE anderson-ej-10.5 [§10.3, p.715]
entradas: p0 = 30 atm = 3.03e6 N/m2, T0 = 3500 K, A* = 0.4 m2,
          gamma = 1.22, R = 520 J/(kg K)
salida esperada: gamma/R = 2.346e-3 ; 2/(g+1) = 0.9 ; (g+1)/(g-1) = 10.09
                 mdot = (p0*A*/sqrt(T0)) * sqrt( (g/R)*(2/(g+1))^((g+1)/(g-1)) )
                      = 583.2 kg/s
tolerancia: 0.5% para la formula cerrada; 1% al comparar contra 10.4a
nota: 583.2 vs 586.4 kg/s = 0.55% de diferencia. El libro declara que la CERRADA es la
      mas exacta y que la diferencia es acumulacion de redondeo en la cadena de pasos.
      => en La Forja, implementar la CERRADA como referencia y la cadena como lecciOn.
ERRATA DEL TEXTO: imprime "gamma/R = 1.22/510 = 2.346e-3". El divisor correcto es 520
      (el R del Ej. 10.4). El RESULTADO 2.346e-3 SI corresponde a 1.22/520; el "510"
      es un error tipografico. Usar 520.
```

```
FIXTURE anderson-ej-10.6 [§10.5, p.723]
entradas: tunel supersonico de diseno preliminar a M = 2.0, gamma = 1.4;
          se SUPONE choque normal a la entrada del difusor (condicion de arranque)
salida esperada: p0,2/p0,1 = 0.7209 (Apendice B, M=2)
                 At,2/At,1 = 1/0.7209 = 1.387
tolerancia: 0.5%
nota: la segunda garganta debe ser 38.7% MAS GRANDE que la primera. Si el disenador la
      hace mas chica, el tunel se DESARRANCA.
```

```
FIXTURE anderson-reto-10.8-geometria [§10.8, p.730-731]
entradas: tunel Mach 2; modelo de l = 4 ft, envergadura 2 ft;
          se supone la onda de proa DEBIL, simulada por una onda de Mach
salida esperada: mu = asin(1/2) = 30 deg
                 h/2 = tan(30) = 0.577  ->  h = 1.155 ft
                 altura minima admisible de la seccion de pruebas = 2h = 2.31 ft
                 (eleccion CONSERVADORA del ingeniero: 3.5 ft de alto, 5 ft de largo,
                  3 ft de ancho)
tolerancia: 1% en los numeros calculados; las dimensiones finales son DECISION HUMANA
nota: criterio de Pope & Goin: las ondas del modelo deben reflejarse lo bastante aguas
      abajo para no reincidir sobre el modelo.
```

```
FIXTURE anderson-reto-10.8-presion [§10.8, p.732]
entradas: M = 2, salida del difusor a la atmosfera (p02 = pa = 1 atm),
          "eficiencia de choque normal" como regla de dedo
salida esperada: p0,2/p0,1 = 0.7209  ->  p0,1 = 1/0.7209 = 1.387 atm
                 razon de presion de ARRANQUE elegida conservadoramente ~ 2
tolerancia: 0.5% en 1.387; el "~2" es DECISION HUMANA (el libro dice que la razon de
            arranque se determina EMPIRICAMENTE)
```

```
FIXTURE anderson-reto-10.8-reynolds [§10.8, p.733]
entradas: p0 = 1.387 atm, T0 = 519 R, M = 2 en la seccion de pruebas,
          R = 1716 ft.lb/(slug.R), 1 atm = 2116 lb/ft2, L_modelo = 4 ft
salida esperada: rho0 = 1.387*2116/(1716*519)   = 0.00329 slug/ft3
                 rho0/rho = 4.347 ; T0/T = 1.8  (Apendice A, M=2)
                 rho = 0.00329/4.347            = 7.568e-4 slug/ft3
                 T   = 519/1.8                  = 288 R
                 a   = sqrt(1.4*1716*288)       = 831.8 ft/s
                 V   = 2*831.8                  = 1664 ft/s
                 mu (viscosidad) = 1.05e-5 kg/(m s) leida de la Fig 1.50
                                 = 2.19e-7 slug/(ft s)
                 Re  = 7.568e-4*1664*4/2.19e-7  = 23e6
tolerancia: 5% en Re (la viscosidad se EXTRAPOLA de una GRAFICA)
requisito verificado: Re >= 10e6 -> CUMPLE (23e6)
INCONSISTENCIA DEL TEXTO: calcula T = 288 R y luego escribe "T = 280/1.8 = 155.6 K".
      288 R -> 160.0 K, no 155.6 K. El "280" es un desliz. La viscosidad se lee
      "extrapolating [...] to a temperature of 155 K". Impacto en Re: <2%, no cambia
      la conclusion. DECLARADO, no corregido en el fixture.
```

```
FIXTURE anderson-reto-10.8-gasto-y-tanque [§10.8, p.734-735]
entradas: p0 = 1.387 atm = 2935 lb/ft2, T0 = 519 R, gamma = 1.4,
          R = 1716, M = 2 -> Ae/A* = 1.687 (Apendice A),
          altura de salida de la tobera he = 3.5 ft, ancho = 3 ft,
          tiempo de corrida = 1 min (DECISION HUMANA),
          presion inicial del tanque = 2 atm
salida esperada: h* = 3.5/1.687              = 2.075 ft
                 A* = 2.075*3                = 6.225 ft2
                 mdot (ec. C10.1 = E10.3)    = 0.219 slug/s = 7.05 lbm/s
                 masa descargada en 1 min    = 423 lbm
                 pi/pf = 2/1.387 = 1.44 -> Mi/Mf = 1.44
                 Mi - Mi/1.44 = 423  ->  0.44*Mi = 609.1  ->  Mi = 1384 lbm = 43 slug
                 V_tanque = M*R*T/p = 43*1716*519/(2*2116) = 9049 ft3
                 con d = 12 ft:  h = 4V/(pi*d^2) = 80 ft   <-- DEMASIADO ALTO
                 almacenando a 20 atm en vez de 2:  h = 8 ft  <-- ACEPTABLE
tolerancia: 2%
nota: ESTE es el fixture del ciclo de diseno conceptual completo. La respuesta "80 ft"
      NO es un error: es el resultado que OBLIGA a cambiar una decision (subir la presion
      de almacenamiento x10 y estrangular con valvula). Es el "Wow! This is a tall tank"
      del libro. La Forja debe reproducir ese momento.
```

### 3.2 Capítulo 11 — Prandtl-Glauert, Mach crítico, divergencia de arrastre

```
FIXTURE anderson-ej-11.1 [§11.4, p.755]
entradas: Cp,0 = -0.3 en un punto del perfil (baja velocidad), Minf = 0.6
salida esperada: Cp = -0.3/sqrt(1-0.36) = -0.3/0.8 = -0.375
tolerancia: 0.1% (formula cerrada, sin tablas)
nota: el fixture mas barato y mas util del libro. Un solo test.
```

```
FIXTURE anderson-ej-11.2 [§11.4, p.755]
entradas: perfil delgado simetrico, cl,0 = 2*pi*alpha (teoria del cap. 4), Minf = 0.7
salida esperada: cl = 2*pi*alpha/sqrt(1-0.49) = 2*pi*alpha/0.7141 = 8.8*alpha
                 razon de aumento de la pendiente = 8.8/(2*pi) = 1.4  (+40%)
tolerancia: 0.5%
nota: fixture de la PENDIENTE, no del valor. Prueba que (11.52) se aplica a cl y no
      solo a Cp. Minf = 0.7 es exactamente el borde declarado de validez de P-G.
```

```
FIXTURE anderson-tabla-11.3-Cpcr [§11.6 Ej 11.3, p.762]
entradas: gamma = 1.4, ec. (11.60)
salida esperada (curva UNIVERSAL Cp,cr vs Mcr):
   Mcr    : 0.4     0.5     0.6     0.7      0.8      0.9      1.0
   Cp,cr  : -3.66  -2.13   -1.29   -0.779   -0.435   -0.188    0
tolerancia: 1%
nota: no depende de NINGUN perfil. Se precomputa una vez como LUT. El valor
      Cp,cr(1.0) = 0 es el chequeo de sanidad fisica.
```

```
FIXTURE anderson-tabla-11.3-PG [§11.6 Ej 11.3, p.762]
entradas: NACA 0012 a alpha = 0, (Cp,0)min = -0.43, correccion Prandtl-Glauert
salida esperada:
   Minf      : 0       0.2      0.4      0.6      0.8
   (Cp)min   : -0.43  -0.439   -0.469   -0.538   -0.717
tolerancia: 0.5%
```

```
FIXTURE anderson-ej-11.3-grafico [§11.6, p.762]
entradas: NACA 0012 a alpha = 0, Re = 3.65e6, (Cp,0)min = -0.43 (Fig 11.8, en x/c = 0.11)
salida esperada: interseccion de la curva PG con la curva universal Cp,cr:
                 Mcr = 0.74
tolerancia: 3% (es una lectura GRAFICA; el libro declara 2 cifras)
```

```
FIXTURE anderson-ej-11.3-analitico [§11.6, p.763]
entradas: las mismas; resolver por iteracion la ec. (11.63):
   -0.43/(1-Mcr^2) = (2/(g*Mcr^2)) * { [ (1+((g-1)/2)Mcr^2)/(1+(g-1)/2) ]^(g/(g-1)) - 1 }
salida esperada (tabla de iteracion del libro, lado izq vs lado der):
   Mcr = 0.72    -> -0.6196   vs  -0.6996
   Mcr = 0.73    -> -0.6292   vs  -0.6621
   Mcr = 0.74    -> -0.6393   vs  -0.6260
   Mcr = 0.738   -> -0.6372   vs  -0.6331
   Mcr = 0.737   -> -0.6362   vs  -0.6367
   Mcr = 0.7371  -> -0.6363   vs  -0.6363   <-- RAIZ
   RESULTADO: Mcr = 0.7371  (4 cifras)
tolerancia: 0.1% en la raiz; 1% en cada renglon de la tabla
nota: fixture PERFECTO para un solver de raices. Cada renglon es un test independiente
      de la evaluacion de las dos ramas; la raiz es el test del algoritmo de biseccion
      o Newton. Confirma que la solucion grafica (0.74) y la analitica (0.7371) coinciden
      dentro de la precision del metodo grafico.
```

```
FIXTURE anderson-ej-11.3-validacion [§11.6, p.763-765]
entradas: dato experimental de tunel (Freuler y Gregorek, NASA CP 2045), NACA 0012, alpha=0
salida esperada: a Minf = 0.575 (Re = 4.68e6): Cp,cr = -1.465 ; el Cp medido en TODA la
                 superficie queda POR DEBAJO de esa linea -> flujo subsonico en todos lados
                 -> Minf = 0.575 esta por DEBAJO de Mcr
                 a Minf = 0.725 (Re = 5.34e6): Cp,cr = -0.681 ; el Cp medido queda por
                 encima de Cp,cr en todos lados SALVO en el punto de presion minima,
                 donde (Cp)min ~ Cp,cr -> flujo apenas sonico ahi
                 -> Mcr experimental ~ 0.73
                 ERROR DEL CALCULO: 0.74 vs 0.73 -> "amazingly accurate, to within about
                 one percent"
tolerancia: 1% en Cp,cr; el Mcr experimental es un dato, no un calculo
nota: es el fixture de VALIDACION, no de calculo. Es lo que le da derecho a La Forja a
      decirle al cliente "este numero se puede creer".
```

```
FIXTURE anderson-fig-11.5 [§11.6, p.757; enunciado del Prob. 11.7, p.809]
entradas: un mismo perfil, punto A = punto de presion minima; se SUPONE que la ubicacion
          de A no cambia con Minf y que vale Prandtl-Glauert
salida esperada:
   Minf = 0.30  ->  M_A = 0.435   (valor ARBITRARIO de partida: fija la forma del perfil)
   Minf = 0.50  ->  M_A = 0.772
   Minf = 0.61  ->  M_A = 1.000   ==> Mcr = 0.61 para ese perfil
   Minf = 0.65  ->  region finita de flujo supersonico con linea sonica
tolerancia: 1%
nota: cadena Cp,A(Minf=0.3, M_A=0.435) por (11.58) -> Cp,0 despejando P-G ->
      Cp,A(Minf) -> M_A(Minf) por (11.58) invertida. Prueba (11.58) en AMBOS sentidos.
```

```
FIXTURE anderson-flecha-45 [Design Box §11.7, p.769]
entradas: ala recta con t1/c1 = 0.15, barrida Lambda = 45 deg
salida esperada: t2 = t1 ; c2 = 1.41*c1 ; t2/c2 = 0.106
tolerancia: 1%  (1/cos45 = 1.4142; el libro redondea a 1.41)
nota: fixture de una linea que justifica TODA la flota comercial moderna. La reduccion
      de espesor efectivo es de ~29%.
```

```
FIXTURE anderson-supercritico [§11.9, p.776-777]
entradas: NACA 64_2-A215 vs perfil supercritico de 13.5% de espesor, condiciones de
          crucero (Fig 11.19: 64-series mostrado a Minf = 0.69, supercritico a Minf = 0.79)
salida esperada (Fig 11.20): M_drag-divergence = 0.67 (NACA 64-series)
                             M_drag-divergence = 0.79 (supercritico)
tolerancia: 2% (valores citados en el TEXTO, no leidos de la grafica)
nota: +0.12 de Mach de divergencia con el MISMO orden de espesor. Ese delta es el
      producto entero del perfil supercritico.
```

```
FIXTURE anderson-mcr-cuerpos-romos [Prob. 11.8-11.9, p.809-810]
entradas: cilindro circular y esfera, dato EXPERIMENTAL citado por el autor
salida esperada: Mcr(cilindro) = 0.404 ; Mcr(esfera) = 0.57
                 al aplicar P-G + el Cp incompresible del cilindro, el Mcr calculado cae
                 "dentro del 3.5 por ciento" del experimental
tolerancia: 4% (el propio libro declara 3.5% para el cilindro con P-G)
nota: el autor ADVIERTE que P-G no deberia valer para un cilindro (no es cuerpo delgado)
      y que la concordancia es notable: "Interesting." Es un buen caso negativo/limite
      para la suite: prueba que el solver se atreve a salir del dominio y REPORTA que
      salio.
```

```
FIXTURE anderson-jameson-transonico [§11.10, p.780-782]
entradas: optimizacion CFD de un ala transonica a Minf = 0.83 con espesor CONSTRAINED
salida esperada: reduccion de arrastre = 7.6% ; el ala optimizada queda "virtually shock
                 free" (Cp sin la caida abrupta)
                 (Fig 11.23, Minf = 0.86, codigo SYN107P, valores legibles del recuadro:
                  DESIGN 0  -> alpha = 2.251, CD = 0.01131
                  DESIGN 10 -> alpha = 2.153, CD = 0.01125
                  DESIGN 20 -> alpha = 2.113, CD = 0.01127
                  estaciones de envergadura graficadas: 9.6, 27.2, 44.3, 60.8, 79.1, 95.6 %)
tolerancia: dato de referencia, no calculable con las herramientas de este bloque
nota: NO es un fixture de nuestro solver (requiere Navier-Stokes). Es un fixture de
      EXPECTATIVA: si algun dia La Forja corre optimizacion transonica, este es el orden
      de magnitud de mejora que debe producir.
```

```
FIXTURE anderson-reto-11.16-wingflow [§11.16, p.806-807]
entradas: metodo wing-flow de la NACA (1946). Ala del P-51 en picada a Minf = 0.76;
          Cp,0 minimo sobre el ala = -0.575 (CFD de Lednicer, ocurre en x/c ~ 0.4-0.5);
          correccion de KARMAN-TSIEN (11.54); gamma = 1.4
salida esperada: Cp corregido:
      Cp = -0.575 / [ sqrt(1-0.76^2) + (0.76^2/(1+sqrt(1-0.76^2)))*(-0.575/2) ]
         = -1.0419
   luego, con (11.58) resuelta para M_A:
      -1.0419 = (2/(1.4*0.76^2)) * { [ (1+0.2*0.76^2)/(1+0.2*M_A^2) ]^3.5 - 1 }
      2.4733*{ (1.115/(1+0.2*M_A^2))^3.5 - 1 } = -1.0419
      -> 1.466/(1+0.2*M_A^2)^3.5 = 0.5787
      -> (1+0.2*M_A^2)^3.5 = 2.53326
      -> 1+0.2*M_A^2 = 2.53326^0.2857 = 1.30416
      -> M_A^2 = 1.5208  ->  M_A = 1.23
tolerancia: 1% en la cadena; 8% al comparar contra el dato de vuelo
validacion: Gilruth (1947) reporta que el Mach local subia suavemente de ~0.40 a ~1.15
      cuando el Mach de vuelo iba de 0.30 a 0.76. Calculado 1.23 vs medido 1.15 -> 7%.
nota: FIXTURE DE ORO. Encadena: (a) leer un Cp incompresible del solver de paneles,
      (b) corregir por compresibilidad, (c) invertir la relacion Cp<->M local. Es
      exactamente la cadena que La Forja debe ejecutar en el navegador.
      Ademas es un ejemplo del cliente: instrumentar un avion real como tunel de viento.
```

### 3.3 Capítulo 12 — Supersónico linealizado

```
FIXTURE anderson-ej-12.1 [§12.3, p.818-819]
entradas: placa plana infinitamente delgada, alpha = 5 deg = 0.087 rad, Minf = 3
salida esperada (teoria LINEALIZADA):
      cl = 4*0.087/sqrt(9-1) = 4*0.087/2.8284 = 0.123
      cd = 4*0.087^2/sqrt(8)                  = 0.011
comparacion EXACTA (Ej. 9.11, choque-expansion):
      cl = 0.125 ; cd = 0.011
error: 1.6% en cl
tolerancia: 1% contra los valores linealizados; 2% contra los exactos
nota: fixture DOBLE: prueba (12.23)/(12.24) y ademas cuantifica el error de la teoria
      lineal a alpha moderado. La Forja debe reportar AMBOS numeros y el delta.
```

```
FIXTURE anderson-ej-12.2 [§12.3, p.819-820]
entradas: Lockheed F-104, vuelo nivelado, Minf = 2, altitud 11 km,
          S = 18.21 m2, W = 9400 kgf, 1 kgf = 9.8 N
          atmosfera (Apendice D, 11 km): rho_inf = 0.3648 kg/m3, T_inf = 216.78 K
salida esperada: a_inf = sqrt(1.4*287*216.78) = 295 m/s
                 V_inf = 2*295                = 590 m/s
                 q_inf = 0.5*0.3648*590^2     = 6.35e4 N/m2
                 W     = 9400*9.8             = 9.212e4 N
                 CL    = W/(q_inf*S) = 9.212e4/(6.35e4*18.21) = 0.08
                 alpha = (CL/4)*sqrt(Minf^2-1) = (0.08/4)*sqrt(3) = 0.035 rad = 1.98 deg
tolerancia: 1%
supuesto DECLARADO por el libro: CL(ala) ~ cl(perfil) porque a M=2 el cono de Mach de
      punta tiene semiangulo mu = asin(1/2) = 30 deg y deja gran parte del ala en flujo
      efectivamente bidimensional.
ERRATA DEL TEXTO: imprime "q_inf = 6.35e4 m/s". Las unidades correctas son N/m2 (Pa).
nota: la conclusion de diseno es la valiosa: un caza supersonico en crucero vuela a
      ~2 grados de angulo de ataque -> la teoria lineal SI aplica en el punto de diseno.
```

```
FIXTURE anderson-ej-12.3 [§12.4, p.823-825]
entradas: F-104 en las mismas condiciones (Minf = 2, 11 km, alpha = 0.035 rad),
          cuerda media c = 2.2 m, capa limite TOTALMENTE TURBULENTA
          Sutherland (15.3) con mu0 = 1.7894e-5 kg/(m s), T0 = 288.16 K
salida esperada:
   (a) FRICCION
      mu(216.78 K) = 1.7894e-5*(216.78/288.16)^1.5*(288.16+110)/(216.78+110)
                   = 1.4226e-5 kg/(m s)
      Re = 0.3648*590*2.2/1.4226e-5 = 3.33e7
      Cf (una cara, Fig 19.1, turbulento, M=2, Re=3.33e7) = 2.15e-3
      Cf neto (dos caras) = 2*2.15e-3 = 4.3e-3
   (b) ONDA
      cd = 4*0.035^2/sqrt(3) = 2.83e-3
   (c) TOTAL Y REPARTO
      cd_total = 2.83e-3 + 4.3e-3 = 7.13e-3
      la FRICCION es el 60% del arrastre total
      L/D inviscido = 0.08/2.83e-3 = 28.3
      L/D real      = 0.08/7.13e-3 = 11.2
      alpha de CRUCE (donde onda = friccion): 2.47 deg
tolerancia: 1% en Re, mu, cd de onda y en los cocientes L/D;
            5% en Cf (se LEE de la Figura 19.1)
nota: EL fixture de la leccion "el arrastre que no ves". La friccion DUPLICA con creces
      el arrastre y hunde L/D a 40% de su valor inviscido. Y el arrastre de onda va como
      alpha^2 mientras la friccion no depende (aprox) de alpha -> hay un cruce.
DEPENDENCIA EXTERNA: Cf = 2.15e-3 sale de la Fig 19.1, que NO esta en este rango
      (cap. 19) y ademas es imagen. Ver seccion 7.
```

```
FIXTURE anderson-prob-12.6 [§12.6, p.826 - RESPUESTA PUBLICADA POR EL AUTOR]
entradas: placa plana en flujo supersonico VISCOSO; teoria lineal para cl y cd de onda;
          Cf total constante con el angulo de ataque
salida esperada (respuestas impresas en el libro):
      (a) alpha[(L/D)max] = sqrt(Cf) * (M^2 - 1)^(1/4) / 2
      (b) (cl/cd)max      = Cf^(-1/2) * (M^2 - 1)^(-1/4)
tolerancia: identidad algebraica -> 1e-10
verificacion cruzada con el Ej. 12.3 (Prob. 12.7 pide justo esto):
      con Cf = 4.3e-3 y M = 2:
      alpha = sqrt(4.3e-3)*(3)^0.25/2 = 0.06557*1.3161/2 = 0.04315 rad = 2.47 deg
      (cl/cd)max = 1/(0.06557*1.3161) = 11.59
nota: los numeros de la verificacion cruzada los DERIVO yo de las formulas publicadas del
      Prob. 12.6 aplicadas a los datos publicados del Ej. 12.3. El libro no los imprime.
      [EXTENSION DECLARADA - motivo: cerrar el lazo del Prob. 12.7 con datos del libro.]
      Nota de consistencia: el alpha de cruce onda=friccion (2.47 deg, texto p.825) COINCIDE
      con el alpha de (L/D)max -> es el mismo punto, y ahi cd_onda = cd_friccion.
      OJO: contrastar con (14.27), donde el newtoniano da cd,w = 2*cd,0 en (L/D)max. Son
      resultados DISTINTOS porque el cd de onda es cuadratico en alpha (lineal supersonico)
      contra cubico (newtoniano hipersonico).
```

### 3.4 Capítulo 13 — Métodos numéricos

El capítulo 13 es el único de los cinco **sin ejemplos numéricos resueltos**. Anderson lo declara
(§13.8, p.870):
> *"an extensive practical problem utilizing the finite-difference method requires a large number of
> arithmetic operations and is practical only on a digital computer. [...] The main purpose of the
> present chapter is to present the essence of several numerical methods, not to burden the reader
> with a lot of calculations."*

Lo que sí hay son **invariantes verificables** y un caso de prueba unitario sin respuesta publicada:

```
FIXTURE anderson-moc-invariantes [§13.2, p.837-840]
entradas: cualquier malla de caracteristicas 2-D irrotacional supersonica
invariantes que el solver DEBE cumplir (son la definicion del metodo):
   I1: sobre una C- dada, theta + nu(M) = const
   I2: sobre una C+ dada, theta - nu(M) = const
   I3: en el eje de simetria, theta = 0  ->  nu = K-  directamente
   I4: punto interno: theta3 = 0.5*[(K-)1 + (K+)2] ; nu3 = 0.5*[(K-)1 - (K+)2]
   I5: punto de pared: nu5 = (theta4 + nu4) - theta5
   I6: en la seccion de ENDEREZAMIENTO no hay ondas reflejadas
       ->  theta constante a lo largo de esa caracteristica  ->  theta12 = theta9
   I7: (dy/dx)_char = tan(theta -/+ mu) con mu = asin(1/M)
tolerancia: I1-I6 son identidades -> 1e-9 en aritmetica de doble precision
nota: son EL test del solver de MOC. No necesitan un numero del libro: son estructura.
```

```
CASO DE PRUEBA anderson-prob-13.1 [§13.8, p.870 - SIN RESPUESTA PUBLICADA]
entradas: punto 1 en (x1,y1) = (0, 0.0684) m con u1 = 639 m/s, v1 = 232.6 m/s,
                               p1 = 1 atm, T1 = 288 K
          punto 2 en (x2,y2) = (0.0121, 0) m con u2 = 680 m/s, v2 = 0,
                               p2 = 1 atm, T2 = 288 K
          punto 3 = interseccion de la C+ por el punto 2 y la C- por el punto 1
pedido: u3, v3, p3, T3 y la POSICION de 3, suponiendo caracteristicas rectas entre puntos
salida esperada: NO PUBLICADA EN EL LIBRO. No la invento.
uso: es el "proceso unitario" canonico del MOC. Sirve como caso de humo y como leccion,
     pero NO como fixture de regresion contra el libro.
```

```
FIXTURE anderson-timemarching-comportamiento [§13.5, p.855-857]
entradas: cilindro parabolico en Minf = 4, solucion dependiente del tiempo (Ref. 33)
comportamiento esperado (CUALITATIVO pero verificable):
   - la onda de choque se aleja RAPIDO del cuerpo en los primeros pasos
   - hacia los 300 pasos ya casi no se mueve
   - entre 300 y 500 pasos esta "virtually motionless" -> estado estacionario alcanzado
   - la presion en el punto de estancamiento OSCILA fuerte al principio y luego se
     asienta asintoticamente
   - a Minf = 8 el choque queda MAS CERCA del cuerpo que a Minf = 4
   - la presion es MAXIMA en el estancamiento y decrece al alejarse de el
tolerancia: criterio de convergencia, no numero. Gate sugerido: |drho/dt|_max*Dt/rho < 1e-4
nota: no hay tabla numerica publicada. Los valores de las Figs 13.12-13.15 son imagen.
      Este fixture es de FORMA de la curva, verificable con un agente que VE la imagen
      (patron critic-eye del proyecto).
```

```
FIXTURE anderson-cono-cualitativo [§13.6.4, p.867-869]
entradas: cono recto circular vs cuna, mismo semiangulo, mismo Minf
invariantes esperados:
   C1: para el MISMO Minf y el MISMO angulo, el choque del CONO es mas debil que el de
       la cuna  ->  beta_cono < beta_cuna
   C2: por lo tanto p, T, rho y s en la superficie del cono son MENORES que en la cuna
   C3: theta_c,max (cono) > theta_max (cuna) para el mismo Minf
   C4: para cada (theta_c, Minf) hay DOS soluciones de choque: fuerte y debil; en la
       practica se observa la DEBIL, salvo que se suba la contrapresion en la base
   C5: las lineas de corriente detras del choque conico son CURVAS y solo se vuelven
       paralelas a la superficie del cono asintoticamente en el infinito
       (en la cuna son paralelas INMEDIATAMENTE)
   C6: si theta_c > theta_c,max no existe solucion de Taylor-Maccoll -> choque desprendido
       -> hay que ir al time-marching de §13.5
tolerancia: son relaciones de orden -> comparacion booleana
referencia numerica: Fig 13.20 (diagrama theta_c - theta_s - M) y Fig 13.22 (comparacion
      a Mach 2). Ambas son IMAGEN -> ver seccion 7. Tablas publicadas: Kopal (Ref. 95),
      Sims (Ref. 96) -> nuestra implementacion de Taylor-Maccoll se valida contra ellas,
      no contra este libro.
```

### 3.5 Capítulo 14 — Hipersónico

```
FIXTURE anderson-newtoniano-placa [§14.4, p.886]
entradas: placa plana, teoria newtoniana pura
salida esperada:
      cl(alpha) = 2*sin^2(alpha)*cos(alpha)
      cd(alpha) = 2*sin^3(alpha)
      L/D       = cot(alpha)
      MAXIMO de cl:  sin^2(alpha) = 2/3  ->  alpha = 54.7 deg
                     cl,max = 2*sin^2(54.7)*cos(54.7) = 0.77
      cd(90 deg) = 2 ;  cl(90 deg) = 0
      Cp de estancamiento newtoniano = 2
tolerancia: 0.5% (0.77 esta redondeado a 2 cifras; el valor exacto es 4/(3*sqrt(3)) = 0.7698)
nota: contrastar Cp de estancamiento: 1.0 incompresible, 1.28 en M=1, 1.86 en M->inf con
      gamma = 1.4, 2.0 en el limite newtoniano. Son cuatro asserts de una linea.
```

```
FIXTURE anderson-newtoniano-LDmax [§14.4, p.887-888]
entradas: placa plana hipersonica con arrastre de friccion cd,0 constante
salida esperada (identidades algebraicas):
      alpha[(L/D)max] = (cd,0)^(1/3)
      (L/D)max        = (2/3)*(cd,0)^(-1/3) = 0.67/(cd,0)^(1/3)
      en ese punto:  cd_total = 3*cd,0   y   cd_wave = 2*cd,0
tolerancia: 1e-9 (identidades); 1% si se usa el "0.67" redondeado del libro
nota: el invariante cd,w = 2*cd,0 es un test de una linea, y es el que Anderson vuelve a
      citar en §14.9.1 al hablar del optimo del waverider.
```

```
FIXTURE anderson-ej-14.1a [§14.4.1, p.889-890]
entradas: placa plana infinitamente delgada, alpha = 15 deg, Minf = 8, gamma = 1.4
          teoria EXACTA choque-expansion
salida esperada:
   DORSO (expansion Prandtl-Meyer):
      nu1(M=8) = 95.62 deg ; nu2 = 95.62 + 15 = 110.62 deg -> M2 = 14.32 (Apendice C)
      p01/p1 = 0.9763e4 ; p02/p2 = 0.4808e6 (Apendice A) ; p01 = p02
      p2/p1 = 0.9763e4/0.4808e6 = 0.0203
      Cp2 = (2/(1.4*64))*(0.0203 - 1) = -0.0219
   INTRADOS (choque oblicuo):
      theta-beta-M con M1 = 8, theta = 15 deg  ->  beta = 21 deg
      Mn1 = 8*sin(21) = 2.87  ->  p3/p1 = 9.443 (Apendice B)
      Cp3 = (2/(1.4*64))*(9.443 - 1) = 0.1885
   FUERZAS:
      cn = Cp3 - Cp2 = 0.1885 - (-0.0219) = 0.2104
      ca = 0 (placa de espesor cero)
      cl = 0.2104*cos(15) = 0.2032
      cd = 0.2104*sin(15) = 0.0545
      L/D = 0.2032/0.0545 = 3.73
tolerancia: 2% (M2 se INTERPOLA del Apendice C; beta se lee del diagrama theta-beta-M)
ERRATA DEL TEXTO: la formula de Cp3 aparece impresa como (2/(g*M1^2))*(p3/p2 - 1) pero el
      valor sustituido, 9.443, es p3/p1. El indice correcto es p3/p1.
```

```
FIXTURE anderson-ej-14.1b [§14.4.1, p.890]
entradas: los mismos, teoria NEWTONIANA
salida esperada:
      Cp3 = 2*sin^2(15) = 0.134 ;  Cp2 = 0  (dorso en "sombra")
      cl  = 0.134*cos(15) = 0.1294
      cd  = 0.134*sin(15) = 0.03468
      L/D = 0.1294/0.03468 = 3.73
tolerancia: 1%
ERRATA DEL TEXTO: imprime "L/D = 0.1294/0.3468 = 3.73". El denominador correcto es 0.03468
      (falta el cero). El resultado 3.73 SI es el correcto.
```

```
FIXTURE anderson-ej-14.1-comparacion [§14.4.1, p.890-891]
entradas: comparar 14.1a (exacto) contra 14.1b (newtoniano)
salida esperada (errores del newtoniano, DECLARADOS por el autor):
      Cp intrados : 0.134 vs 0.1885  ->  SUBpredice 29%
      Cp dorso    : 0     vs -0.0219 ->  error del 100%
      cl y cd     : SUBpredice 36.6% AMBOS
      L/D         : 3.73 vs 3.73     ->  EXACTO
tolerancia: 2% en los porcentajes
POR QUE L/D sale exacto (dos razones, ambas del libro):
      (1) cl y cd estan subpredichos por el MISMO factor -> su cociente no se afecta;
      (2) mas de fondo: si la resultante es NORMAL a la placa, L/D = cot(alpha) por
          GEOMETRIA, con cualquier teoria. cot(15) = 3.73.
LECCION GENERALIZABLE (p.891): la ley del seno cuadrado NO predice bien la distribucion
      de presion en cuerpos 2-D delgados con tangentes de angulo pequeno o moderado, PERO
      su prediccion de L/D para formas esbeltas a angulos pequenos/moderados es
      razonablemente exacta. Vale para gamma sustancialmente mayor que 1 (aire, 1.4).
      Newtoniano MEJORA cuando Minf -> inf y gamma -> 1.
```

```
FIXTURE anderson-hipersonico-limites [§14.5, p.892-895]
entradas: gamma = 1.4
salida esperada (identidades limite):
      rho2/rho1 -> (g+1)/(g-1) = 2.4/0.4 = 6.0            [independiente de M1 y beta]
      beta/theta -> (g+1)/2 = 1.2      ->  beta = 1.2*theta
      Cp -> (4/(g+1))*sin^2(beta) = 1.6667*sin^2(beta)
      doble limite (M1->inf Y g->1):  Cp -> 2*sin^2(beta) = 2*sin^2(theta)  == NEWTON
ancla numerica del libro (§14.2, p.873):
      cuna de semiangulo 15 deg a Minf = 36  ->  beta = 18 deg  (choque MUY pegado)
tolerancia: 1e-9 en las identidades; 2% en el ancla (se lee de la Fig 9.9)
nota: el test "rho2/rho1 = 6.0" es un chequeo de sanidad clasico: por fuerte que sea el
      choque en aire caloricamente perfecto, la densidad NO puede subir mas de 6 veces.
      (En el gas real quimicamente reactivo si sube mas -> eso es cap. 16-17 de la Ref. 21.)
```

```
FIXTURE anderson-shock-layer-temperatura [§14.2, p.874-875]
entradas: Minf = 36, altitud estandar 59 km -> T_inf = 258 K,
          detras de la porcion NORMAL del choque de proa
salida esperada:
      con gas CALORICAMENTE PERFECTO gamma=1.4 (Apendice B): Ts/T_inf = 252.9
      ->  Ts = 252.9*258 = 65,248 K   <-- INCORRECTO fisicamente
      con gas QUIMICAMENTE REACTIVO:  Ts ~ 11,000 K
tolerancia: 1% en el calculo de gas perfecto; el 11,000 K es un dato de referencia
nota: fixture de ADVERTENCIA, no de produccion. 65,248 K es "mas de seis veces la
      superficie del Sol" y es el numero que le demuestra al alumno que las tablas de los
      caps. 7-13 SE ROMPEN. La Forja debe calcular los dos y mostrar la brecha.
umbrales quimicos asociados: O2->2O en 2000-4000 K ; N2->2N en 4000-9000 K ;
      ionizacion (N->N+ +e-, O->O+ +e-) arriba de 9000 K.
      Consecuencia practica citada: el "blackout" de comunicaciones en reentrada, por los
      electrones libres en la capa de choque.
```

```
FIXTURE anderson-ej-14.2 [§14.8.3, p.907-908]
entradas: transbordador espacial en el punto de MAXIMO calentamiento en estancamiento
          de su trayectoria de reentrada:
          altitud 68.9 km, rho_inf = 1.075e-4 kg/m3, V_inf = 6.61 km/s = 6610 m/s,
          alpha = 40.2 deg, radio de nariz EFECTIVO R = 1.29 m, Tw = 1110 K,
          cp = 1004.5 J/(kg K)  (aire caloricamente perfecto, del Ej. 7.1)
salida esperada:
      h0 = V_inf^2/2 = 6610^2/2         = 2.185e7 J/kg
      hw = cp*Tw = 1004.5*1110          = 1.115e6 J/kg
      hw/h0                             = 0.051
      qdot_w = rho_inf^0.5 * V_inf^3 * (1.83e-8 * R^-0.5) * (1 - hw/h0)
             = (1.075e-4)^0.5 * 6610^3 * 1.83e-8 * 1.29^-0.5 * (1 - 0.051)
             = 45.78 W/cm2
tolerancia: 1% en la formula; 3% al comparar contra el dato
validacion: Zoby (Ref. 98) cita un maximo MEDIDO de 45 W/cm2 para el transbordador a esa
      altitud y velocidad -> nuestro 45.78 concuerda en 1.7%.
UNIDADES OBLIGATORIAS de (14.62): qdot_w [W/cm2], V_inf [m/s], rho_inf [kg/m3], R [m].
      La constante 1.83e-8 lleva las unidades dentro. Cambiar de sistema SIN cambiar la
      constante es el bug seguro de este fixture.
ERRATA DEL TEXTO: h0 y hw se imprimen con unidades "J/(kg K)". La entalpia es J/kg.
nota: es el fixture que cierra la leccion "por que la nariz es ROMA": con R = 1.29 m el
      calentamiento es 45.8 W/cm2; con R = 0.1 m seria sqrt(12.9) = 3.6 veces mayor.
      [El segundo numero lo derivo yo de q ~ 1/sqrt(R): EXTENSION DECLARADA, motivo:
       hacer palpable la ley. El libro no lo calcula.]
```

```
FIXTURE anderson-waverider-correlaciones [§14.9.1, p.919-920]
entradas: correlaciones empiricas de (L/D)max vs Minf
salida esperada:
      Kuchemann (Ref. 66), vehiculos convencionales: (L/D)max = 4*(Minf+3)/Minf
      Waverider viscoso-optimizado:                  (L/D)max = 6*(Minf+2)/Minf
      evaluadas:
          Minf = 5   ->  Kuchemann 6.40   waverider 8.40
          Minf = 10  ->  Kuchemann 5.20   waverider 7.20
          Minf = 25  ->  Kuchemann 4.48   waverider 6.48
tolerancia: 1e-9 (son formulas cerradas). Los valores evaluados los calculo yo de las
      formulas publicadas [EXTENSION DECLARADA - motivo: dar puntos de anclaje al test;
      el libro solo publica las formulas y la grafica].
anclas independientes citadas en el TEXTO (§14.9, p.909):
      placa plana hipersonica laminar, Minf=10, Re=3e6  ->  (L/D)max ~ 6.5
      Boeing 747 en crucero                             ->  (L/D)max ~ 20
tolerancia de las anclas: 5% (son valores "about")
nota: la correlacion del waverider queda POR ENCIMA de la de Kuchemann en todo el rango.
      Ese es el argumento entero del §14.9.
```

```
FIXTURE anderson-waverider-optimo-M6 [§14.9.1, p.916-918]
entradas (condiciones de vuelo de la Fig 14.27, LEGIBLES en el texto de la figura):
      Minf = 6 ; h = 100,000 ft ; Re_l = 122.4e6 ; Tw = 1100 K ;
      r/l = 0.00005 (radio de borde de ataque) ; b/l = 0.06 (esbeltez, RESTRICCION) ;
      l = 60 m
salida esperada (CUALITATIVA - los valores numericos estan en la grafica):
      el barrido de theta_s va de 10 a 15 deg
      el "optimo de los optimos" ocurre en theta_s = 12 deg   <-- ESTE dato SI esta en texto
      invariante: en la mejor forma, arrastre de onda y friccion difieren por menos de un
      factor de 2; para theta_s = 11 deg domina la FRICCION; para 13 y 14 deg domina la ONDA
      para Minf = 25 la restriccion cambia a b/l = 0.09 y la forma optima tiene MAS flecha
tolerancia: el theta_s = 12 deg es exacto; el resto es estructura
NO OBSERVADO: el valor numerico de (L/D)max en el pico. Los ejes de la Fig 14.27 son
      legibles (L/D de 7.0 a 9.0 ; CL de 0.02 a 0.06 ; eta = V^(2/3)/Sp de 0.09 a 0.14)
      pero la ALTURA del pico es imagen. Ver seccion 7. Cota implicita: 8 < (L/D)max < 9,
      consistente con la correlacion 6*(6+2)/6 = 8.0.
```

### 3.6 Ejercicios de fin de capítulo — casos de prueba SIN respuesta publicada

Estos NO son fixtures (no tengo la salida esperada del libro). Los listo porque son el banco de
regresión natural una vez que el solver esté validado contra los fixtures de arriba, y porque varios
son exactamente el tipo de problema que el cliente le va a poner a sus ingenieros.

| Problema | Qué pide | Nuestro método |
|---|---|---|
| 10.1–10.4 | Tobera con `Ae/A* = 2.193`, `p0 = 5 atm`, `T0 = 520 °R`; `Ae/A*` desde `p0/pe = 1/0.3143`; `Ae/A*` desde lectura de Pitot; `ṁ` con `At = 4 in²` | (10.32) + isentrópicas + (E10.3) |
| 10.5 | **Derivar** la forma cerrada del gasto (E10.3) | álgebra; el resultado sí está publicado |
| 10.7–10.9 | `Ae/A* = 1.616`, `pe/p0 = 0.947`: `M` y `p` en garganta; `ṁ`; y `Ae/A* = 1.53` con **choque normal dentro** para 4 contrapresiones | (10.32) doble rama + relaciones de choque normal |
| 10.10–10.11 | Cuña de 20° con `β = 41.8°` → deducir `Ae/A*` del túnel; Pitot de 1.448 atm con `Ae/A* = 6.79` → `p0` | θ-β-M inverso + Rayleigh Pitot |
| 10.12 | **Diseñar** un túnel Mach 2.8 a nivel del mar con `ṁ = 1 slug/s`: `p0`, `T0`, `A_t`, `A_e`, `A_t2` | cadena completa del cap. 10 |
| 10.13 | Cohete con `ṁ = 287.2 kg/s`, `T0 = 3600 K`, `A* = 0.2 m²`, `γ = 1.2`, `PM = 16` → `p0` de cámara | (E10.3) invertida, con `R = R_u/PM` |
| 10.14 | Eficiencia de difusor `η_D = 1.2` a `M = 3` → `p0` mínima | (10.39) + definición de `η_D` dada en el enunciado |
| 10.17–10.18 | Forma de una línea de corriente **dentro** de un abanico de Prandtl-Meyer centrado, en coordenadas polares | requiere caps. 9 **y** 10 |
| 11.1 | `φ(x,y)` dado explícitamente → `M`, `p`, `T` en un punto | derivar φ → (11.32) → (11.58) |
| 11.2 | `cl` del NACA 2412 a 5° en M = 0.6 usando datos de la Fig 4.5 | (11.52) |
| 11.3 | `Cp` con `Cp,0 = −0.54` a M = 0.58 por P-G, K-T y Laitone | (11.51), (11.54), (11.55) — **tres respuestas comparables** |
| 11.4 | `M_cr` con `Cp,0 = −0.41` usando P-G | (11.60) ∩ (11.51) |
| 11.5 | `p/p∞` en el punto de presión mínima cuando `M_cr = M∞ = 0.8` | (11.56) con `M_A = 1` |
| 11.6 | `Cp` con `M∞ = 0.5` y `M_local = 0.86`, por tablas y por fórmula | (11.58) |
| 11.7 | **Probar** que `M_cr = 0.61` para el perfil de la Fig 11.5 | ver fixture `anderson-fig-11.5` |
| 11.8 | **Explicar físicamente** por qué la esfera tiene `M_cr` mayor que el cilindro | conceptual (alivio 3-D) |
| 12.1–12.3 | `cl`, `cd`, `p/p∞` de placa plana a 5°, 15°, 30° en M = 2.6; perfil diamante `ε = 10°` a α = 15° en M = 3; todos contra choque-expansión exacta | (12.15), (12.23), (12.24) vs cap. 9 |
| 12.4 | ¿El **arrastre** (fuerza) baja con `M∞` aunque `cd` baje? | derivar `D(M∞)` de (12.24) × `q∞` |
| 12.5 | `(L/D)max` de placa plana en flujo **no viscoso** y su α | (12.23)/(12.24) → `L/D = 1/α` → **no acotado** |
| 13.1 | Proceso unitario del MOC (ver arriba) | (13.17)–(13.24) |
| 14.1 | Prob. 9.13 rehecho con newtoniano y newtoniano modificado | (14.4), (14.7) |
| 14.2 | Placa plana a α = 20° en M = 20, newtoniano vs choque-expansión | (14.14), (14.15) |
| 14.3 | Nariz esférica a M = 20, 150,000 ft (`T∞ = 500 °R`, `p∞ = 3.06 lb/ft²`); `p`, `T`, `M`, `V` a 20° del estancamiento | (14.7) + isentrópicas tras choque normal |

---

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero y el software NO debe decidir

Cada renglón cita el pasaje donde Anderson entrega la decisión al humano. En La Forja, cada uno de
estos DEBE ser un control expuesto con un valor por defecto **etiquetado como sugerencia**, nunca un
número escondido en el solver.

### 4.1 Dimensionamiento del túnel y de la tobera (cap 10)

| # | Decisión | Cita |
|---|---|---|
| D1 | **Qué tipo de túnel supersónico construir** (blowdown / indraft / presión-vacío / circuito cerrado) | §10.8, p.733: *"there is no 'right choice' of the type of supersonic tunnel to be made—much like the design of an airplane that depends on a number of technical compromises."* El libro nombra los factores: espacio de laboratorio disponible, equipo ya existente (compresores, tanques, instrumentación) — *"the realities of life in experimental work"*. |
| D2 | **Factor de seguridad sobre la altura de la sección de pruebas** | §10.8, p.731: el cálculo de onda de Mach da 2.31 ft mínimo, pero *"the waves from the model are finite shock and expansion waves, not Mach waves, and the wave angles will be larger"* → *"let us apply a conservative 'factor of safety' [...] let us design the test section height to be 3.5 ft."* El 3.5 es criterio, no física. |
| D3 | **Ancho y largo de la sección de pruebas** | §10.8, p.731: largo 5 ft "para que quepa cómodamente" el modelo de 4 ft; ancho 3 ft "para minimizar efectos de pared lateral". Ambos son juicio. |
| D4 | **Tiempo de corrida** | §10.8, p.734: *"What about running time? This is a matter of choice. It should be long enough to allow all measurements to be made on the test model [...] We choose a running time of one minute."* |
| D5 | **Razón de presión de arranque** (vs la de operación) | §10.8, p.732–733: *"It is difficult to estimate the starting pressure ratio, especially when there is a model mounted in the test section. This is something usually determined empirically."* |
| D6 | **Tamaño máximo del modelo sin bloqueo** | §10.8, p.733: *"The maximum model size allowable is also something usually determined empirically."* Depende de la forma (esbelto vs romo) y del Mach. |
| D7 | **Presión de almacenamiento del tanque** | §10.8, p.736: la elección de 2 atm daba un tanque de 80 ft de alto; el ingeniero decide subir a 20 atm y estrangular con válvula. El software calcula la consecuencia; **el humano toma la decisión de arquitectura**. |
| D8 | **Suponer "eficiencia de choque normal"** para la pérdida de `p0` del difusor | §10.5, p.723 y §10.8, p.732: *"this 'normal shock efficiency' is a rule of thumb frequently used for estimating losses in the supersonic diffuser [...] We will use this rule of thumb here."* Es regla de dedo declarada, no física. Si el ingeniero tiene datos del difusor real, debe poder meterlos. |
| D9 | **Contorno del difusor real** (convergente + garganta de área constante + divergente) | §10.4, p.718: *"The art of diffuser design is to obtain as small a total pressure loss as possible [...] Unfortunately, in most cases, we fall far short of that goal."* El libro **no da un método**; remite a Ref. 21 cap. 5 y Ref. 1 cap. 12. |

### 4.2 Perfil, espesor y flecha (cap 11)

| # | Decisión | Cita |
|---|---|---|
| D10 | **Espesor del perfil** — el compromiso más importante del cap. 11 | §11.9, p.775: *"there is a limit to how thin a practical airfoil can be [...] the airfoil requires a certain thickness for structural strength, and there must be room for the storage of fuel."* El aerodinámico quiere delgado (`M_cr` alto), el estructural y el de combustible quieren grueso. **El software NO debe optimizar espesor solo por aerodinámica.** |
| D11 | **Cuál corrección de compresibilidad aplicar** | §11.4/11.5/11.16: P-G *"for initial estimates"* (p.754); Karman-Tsien *"widely adopted by the aeronautical industry"* (p.755) y es la que el propio Anderson escoge cuando quiere un número creíble (p.806). El ingeniero decide qué precisión compra. |
| D12 | **Subir `M_cr` vs ensanchar `M_cr → M_drag-div`** | §11.9, p.775: son **dos filosofías distintas**. La primera dominó 1945–1965 (perfiles delgados, serie NACA 64); la segunda desde 1965 (supercríticos). No hay una respuesta correcta a priori. |
| D13 | **Ángulo de flecha** | Design Box §11.7, p.769–771: la flecha compra `M_cr` pero el libro no da un óptimo. (Y arrastra consecuencias no tratadas aquí: estructura, peso, comportamiento en pérdida.) |
| D14 | **Espesor de la cola vs el del ala** | Design Box §11.7, p.768: en el X-1 el estabilizador horizontal se hizo **más delgado** (NACA 65-006, 6 %) que el ala (8–10 %) *"to ensure that when the wing encountered major compressibility effects, the horizontal tail and elevator would still be free of such problems and would be functional for stability and control."* Decisión de arquitectura de márgenes, no de aerodinámica pura. |
| D15 | **Cobertura de riesgo con un mecanismo** | Design Box §11.7, p.768: *"hedging their bets, the Bell engineers also made the tail all-moving"* por si el elevador perdía eficacia. Yeager lo usó. Es el patrón "si el análisis puede fallar, dale al piloto una salida". |
| D16 | **Modelo de turbulencia en CFD transónico** | §11.10, p.779: *"some type of turbulence model must be included to deal with turbulent boundary layers, and such turbulent models are frequently the Achilles heel of these calculations."* El software DEBE nombrar qué modelo usó. |
| D17 | **Restricción de la optimización** | §11.10, p.779: la optimización de Jameson *"was subject to the constraint of keeping the wing thickness the same."* Sin restricción declarada, un `−7.6 %` de arrastre no significa nada. |

### 4.3 Métodos numéricos (cap 13)

| # | Decisión | Cita |
|---|---|---|
| D18 | **Contorno de la sección convergente subsónica** | §13.3, p.840: *"For the convergent, subsonic section, there is no specific contour which is better than any other. There are rules of thumb based on experience and guided by subsonic flow theory; however, we are not concerned with the details here."* El software **no puede** entregar un óptimo aquí. |
| D19 | **Forma de la sección de expansión** de la tobera supersónica | §13.3, p.842: *"The shape of the expansion section is somewhat arbitrary; typically, a circular arc of large radius is used for the expansion section of many wind-tunnel nozzles."* El **enderezamiento** sí lo calcula el MOC; la expansión la elige el humano. |
| D20 | **Finura de la malla de características** | §13.2.2, p.840: *"in practice, there are numerical errors associated with the finite grid [...] In principle, the method of characteristics is truly exact only in the limit of an infinite number of characteristic lines."* Malla = costo vs exactitud, decisión del usuario. |
| D21 | **Forma y posición iniciales del choque** en el *time-marching* | §13.5, p.853: *"First, assume a shock-wave shape and location [...] At each of these grid points, assume values of all the flow variables."* Buena suposición = menos pasos. |
| D22 | **Criterio de convergencia al estado estacionario** | §13.5, p.855: *"after a large number of time steps, the calculated flow-field variables approach a steady state."* El libro **no da un umbral numérico**. Cualquier umbral que pongamos es `[EXTENSIÓN DECLARADA]`. |
| D23 | **`Δξ` y `Δη` admisibles para estabilidad numérica** | §13.4, p.850: Anderson lo plantea como pregunta abierta y remite a Ref. 21 cap. 11. **No está resuelto en este libro.** |

### 4.4 Vehículo hipersónico (cap 14)

| # | Decisión | Cita |
|---|---|---|
| D24 | **Romo vs esbelto** — el compromiso central del vehículo hipersónico | §14.8.2, p.906: para minimizar calentamiento hay que ser romo; pero §14.8.2 también dice que en vehículos de crucero sostenido *"the radii of curvature is small because the minimization of drag, hence the maximization of lift-to-drag ratio, also becomes important."* El X-43 es la solución de compromiso: romo, pero poco. |
| D25 | **Punto de diseño del waverider** | §14.9, p.913: el waverider *"is in principle a point-designed vehicle"* — el `M∞` y la deflexión del cuerpo generador **son elegidos por el ingeniero** y definen el vehículo. Fuera de ese punto, el choque se desprende. |
| D26 | **Qué campo generador usar** | §14.9, p.913: *"In principle any shape can be used for the imaginary body producing the flow field."* Cuña (más simple, cerrado con cap. 9), cono (más libertad, requiere Taylor-Maccoll), ojiva de ley de potencia 1/2 (Corda, Ref. 110). |
| D27 | **Curva de borde de ataque sobre el choque** | §14.9.1, p.916: *"An infinite number of such curves can be traced on the conical shock wave"*. Ahí es donde entra la optimización, pero el espacio de búsqueda lo acota el humano. |
| D28 | **Relación de esbeltez `b/l` como restricción** | §14.9.1, p.919: `b/l = 0.06` a M=6 (análogo al Concorde), `b/l = 0.09` a M=25 (análogo a un avión hipersónico de hidrógeno). *"The two different slenderness ratios are chosen on the basis of reality for two different aircraft with two different missions."* **El valor lo pone la misión, no el optimizador.** |
| D29 | **Ubicación de la transición laminar→turbulenta** | §14.9.1, p.921: *"hypersonic vehicle design is sensitive to the location of the transition from laminar to turbulent flow."* Se hicieron experimentos numéricos barriendo desde todo-laminar hasta casi-todo-turbulento; la forma óptima cambia, `(L/D)max` no tanto. |
| D30 | **Radio del borde de ataque** | §14.9.1, p.915: se determina *"the maximum leading-edge radius required to yield acceptable leading-edge surface temperatures"* — el criterio de temperatura aceptable **lo pone el material**, no la aerodinámica. |
| D31 | **Aceptar teoría newtoniana** sabiendo que es teóricamente impropia | §14.5, p.895: *"the application of newtonian theory to practical hypersonic flow problems, where γ is always greater than unity, is theoretically not proper, and the agreement that is frequently obtained with experimental data has to be viewed as somewhat fortuitous."* Es una decisión consciente de "usar lo que funciona", y el software debe decirlo. |
| D32 | **Confiar en un dato de túnel "frío"** para vuelo con gas reactivo | §14.7, p.900–901: **el caso más caro del capítulo**. Los diseñadores del transbordador usaron `γ = 1.4` de túnel para el momento de cabeceo; el vuelo real exigió **más del doble** de deflexión del *body flap*. La decisión de "¿qué tan lejos del régimen real está mi dato?" es del ingeniero, y La Forja debe hacerla explícita. |

### 4.5 Lo que el software SÍ debe decidir (por contraste)

Para que la lista de arriba tenga filo, el complemento:
- resolver (10.32) en la rama correcta una vez que el usuario fijó el régimen;
- iterar (11.63) hasta `M_cr` con la tolerancia pedida;
- integrar el MOC nodo por nodo una vez fijadas la sección de expansión y la finura de malla;
- integrar Taylor-Maccoll hasta `Vθ' = 0`;
- sumar arrastre de onda + fricción y **reportar la partición** (no ocultarla en un solo `cd`);
- **avisar cuando el usuario sale del dominio declarado** de la fórmula que está usando.

Ese último punto es, para este bloque, **el requisito de producto más importante de todos**.

---

## 5. COSTO DE CÓMPUTO

Regla 6 del contrato. Nodo de referencia para `[GPU-VIVO]` y `[PRECÓMPUTO]`: **iangpu**, RTX 4070 Ti.
Referencia para `[NAVEGADOR]`: laptop sin GPU WebGL2 real (SwiftShader) → todo lo `[NAVEGADOR]` debe
correr en **CPU/JS puro**, sin depender de shaders.

### 5.1 Tabla método × costo

| # | Método | § | Costo | Por qué |
|---|---|---|---|---|
| 1 | ISA + isentrópicas + choque normal/oblicuo | 8–10 | `[NAVEGADOR]` | Aritmética cerrada. Nanosegundos. Ya existe en `src/aero/atmosfera.ts`. |
| 2 | Relación área-Mach (10.32) → `M` dado `A/A*` | §10.3 | `[NAVEGADOR]` | Es una raíz escalar monótona en cada rama. Bisección o Newton, ~20 iteraciones. Microsegundos. |
| 3 | Gasto ahogado cerrado (E10.3) | §10.3.1 | `[NAVEGADOR]` | Una línea. |
| 4 | Marcha completa de una tobera casi-1D (100–1000 estaciones) | §10.3 | `[NAVEGADOR]` | 1000 × (una raíz + isentrópicas) ≈ décimas de milisegundo. **Interactivo con slider de `p_B/p0`.** |
| 5 | Localización del choque normal dentro de la tobera | §10.3 | `[NAVEGADOR]` | Raíz anidada: una búsqueda sobre la posición `d` que hace que `p(exit) = p_B`. ~20 evaluaciones del punto 4. Aún milisegundos. |
| 6 | Dimensionamiento de túnel supersónico completo (reto §10.8) | §10.5, §10.8 | `[NAVEGADOR]` | Cadena algebraica cerrada, incluido el volumen del tanque. **Es un formulario con resultados en vivo.** |
| 7 | Apéndices A/B/C (isentrópico, choque normal, Prandtl-Meyer) | caps 8–9 | `[PRECÓMPUTO]` | Se generan una vez a resolución fina y se sirven como `Float64Array` con búsqueda binaria + interpolación. Evita resolver `ν(M)` invertida en caliente miles de veces. Tamaño estimado: ~10 k puntos × 6 columnas ≈ 480 kB → **comprimible, cabe en el bundle**. |
| 8 | Prandtl-Glauert / Karman-Tsien / Laitone (11.51/11.54/11.55) | §11.4–11.5 | `[NAVEGADOR]` | **Una división.** Aplicable a un `Cp` panel por panel: 200 paneles = 200 divisiones. Es el método con mejor relación valor/costo de todo el libro. |
| 9 | Curva universal `Cp,cr = f(M_cr)` (11.60) | §11.6 | `[PRECÓMPUTO]` | No depende del perfil → se tabula una vez (p.ej. `M` de 0.2 a 1.0 en pasos de 0.001) y se reusa para todos los perfiles, para siempre. |
| 10 | `M_cr` por intersección/iteración (11.63) | §11.6 | `[NAVEGADOR]` | Una raíz escalar; el libro converge en **6 iteraciones** a 4 cifras. Microsegundos. **Se puede recalcular en cada tecleo del espesor.** |
| 11 | Relación local `Cp ↔ M` (11.58), ambos sentidos | §11.6 | `[NAVEGADOR]` | Directa cerrada; inversa es una raíz escalar (o una potencia explícita, como en el reto §11.16). |
| 12 | Correcciones de pendiente de sustentación 3-D (11.66)–(11.68) | Design Box §11.7 | `[NAVEGADOR]` | Cerradas. |
| 13 | Distribución de área para regla del área transónica | §11.8 | `[NAVEGADOR]` | Es una integral de secciones sobre la geometría B-Rep que La Forja **ya tiene**. Cortar N planos y medir área: reutiliza el pipeline de `moldGeom()`/secciones. N ≈ 200 planos. |
| 14 | Distribución de área **oblicua** (regla supersónica) | Design Box §12.3 | `[NAVEGADOR]` para un `M∞`; `[PRECÓMPUTO]` para un barrido | Mismo corte, plano inclinado a `μ`. Barrer `M∞` × ángulo de rotación del plano multiplica el costo por ~50; ahí conviene precomputar. |
| 15 | `Cp` supersónico linealizado (12.15) sobre un perfil | §12.2 | `[NAVEGADOR]` | `Cp = 2θ/√(M∞²−1)` panel por panel. **Trivial.** Candidata #1 a correr en vivo mientras el alumno arrastra el borde de ataque. |
| 16 | `cl`, `cd` supersónicos (12.23)/(12.24) | §12.3 | `[NAVEGADOR]` | Dos multiplicaciones. |
| 17 | `(L/D)max` supersónico viscoso (Prob. 12.6) | §12.6 | `[NAVEGADOR]` | Fórmula cerrada publicada. |
| 18 | `Cf(Me, Pr, Tw/Te, Re)` compresible (12.25)/(12.26) | §12.4 | `[PRECÓMPUTO]` | `F` y `G` salen de soluciones numéricas de capa límite (caps. 18–19). Se precomputan como superficie 3-D y se sirven interpoladas. **Hoy los valores no están en el texto** (Fig 19.1 es imagen) → ver §7. |
| 19 | **Método de las características — punto interno / punto de pared** | §13.2.1–13.2.2 | `[NAVEGADOR]` | Sorpresa útil: cada nodo son **4 sumas y 2 divisiones** más una inversión de `ν(M)` (que con el LUT del punto 7 es una búsqueda binaria). Una malla de 50×50 = 2500 nodos ≈ **~1 ms**. |
| 20 | **Diseño completo del contorno de tobera por MOC** | §13.3 | `[NAVEGADOR]` | Con 30–60 características por lado, el contorno sale en milisegundos. **El alumno puede arrastrar `Me` y ver el contorno redibujarse en tiempo real.** Éste es el hallazgo de costo más valioso del capítulo 13. |
| 21 | Familia de contornos de tobera para un catálogo `(Me, γ)` | §13.3 | `[PRECÓMPUTO]` | Barrer `Me` ∈ [1.5, 6] × `γ` ∈ {1.2, 1.3, 1.4} y guardar polilíneas. Sirve de arranque instantáneo. |
| 22 | Diferencias finitas MacCormack, marchado espacial supersónico (2-D) | §13.4 | `[NAVEGADOR]` para mallas chicas; `[GPU-VIVO]` para producción | Malla 100×50 marchando 500 pasos = 2.5 M evaluaciones de nodo con 4 variables de flujo, predictor+corrector → ~20 M flops. En JS: décimas de segundo. Aceptable para una lección. Para mallas 3-D o finas: GPU. |
| 23 | **Time-marching de cuerpo romo (MacCormack no estacionario)** | §13.5 | `[GPU-VIVO]` | Es el método pesado del bloque. Malla mixta subsónico/supersónico × **cientos a miles de pasos de tiempo** hasta el asintótico, más la actualización de la forma del choque en cada paso. El propio libro (Figs 13.12–13.13) usa 500 pasos. Es *embarrassingly parallel* por nodo → encaja perfecto en la 4070 Ti. |
| 24 | Solución de Taylor-Maccoll para **un** `(M∞, θs)` | §13.6.3 | `[NAVEGADOR]` | Una EDO de 2º orden integrada con RK4 en `Δθ` de ~0.05° sobre un rango de pocos grados: **cientos de pasos**. Sub-milisegundo. |
| 25 | **Tablas de cono** (`θc`–`θs`–`M∞`, tipo Kopal/Sims) | §13.6.3 | `[PRECÓMPUTO]` | `M∞` ∈ [1.05, 30] × `θs` ∈ [μ, 90°] con resolución fina = ~10⁵–10⁶ integraciones RK4. En CPU son minutos; en la GPU, segundos. Se sirve como LUT. **Y es exactamente lo que necesita el generador de waveriders.** |
| 26 | `Cp = 2 sin²θ` newtoniano sobre una malla triangulada | §14.3 | `[NAVEGADOR]` | Un producto punto por triángulo. 100 k triángulos = 100 k productos punto ≈ **~1 ms**. Se puede hacer en el shader de la vista 3-D y pintar el cuerpo por presión **en vivo mientras rota**. |
| 27 | Newtoniano modificado (14.7) con `Cp,max` exacto | §14.3 | `[NAVEGADOR]` | Igual, más una evaluación de choque normal para `Cp,max`. |
| 28 | `CL`, `CD`, `CM` por integración de `Cp` newtoniano sobre el cuerpo | §14.4, §14.6 | `[NAVEGADOR]` | Suma sobre triángulos con área y normal. `O(N)`. |
| 29 | Barrido de `CL`, `CD`, `L/D` vs α con newtoniano (polar completa) | §14.4 | `[NAVEGADOR]` | 100 ángulos × 100 k triángulos = 10 M productos punto ≈ décimas de segundo. **Interactivo con barra de progreso.** Si molesta: `[PRECÓMPUTO]` por geometría. |
| 30 | Relaciones de choque hipersónicas límite (14.29)–(14.40) | §14.5 | `[NAVEGADOR]` | Cerradas. |
| 31 | Calentamiento en estancamiento (Tauber-Meneses, 14.62) | §14.8.3 | `[NAVEGADOR]` | Una línea. Es el cálculo de calentamiento más barato que existe y da 1.7 % contra dato de vuelo. |
| 32 | `Q_total` de entrada atmosférica (14.60) | §14.8.2 | `[NAVEGADOR]` | Una línea. |
| 33 | Distribución de `q̇w` sobre toda la superficie (siguiendo líneas de corriente, capa límite integral) | §14.9.1 | `[PRECÓMPUTO]` por geometría | Requiere trazar líneas de corriente superficiales e integrar la capa límite a lo largo de cada una, con transición. Miles de líneas × cientos de estaciones. Minutos en CPU; se sirve como campo sobre la malla. |
| 34 | **Construcción geométrica de un waverider** (dada una curva de borde de ataque) | §14.9 | `[NAVEGADOR]` | Es trazar líneas de corriente en un campo cónico **ya tabulado** (punto 25). Cientos de líneas × cientos de pasos = milisegundos. **El alumno puede dibujar la curva sobre el choque con el ratón y ver el vehículo aparecer.** |
| 35 | **Optimización viscosa de waverider** (simplex + BL integral + bordes romos) | §14.9.1 | `[GPU-VIVO]` | Cada evaluación del simplex = construir la geometría (34) + capa límite integral sobre todas las líneas (33) + arrastre de borde de ataque. Cientos de evaluaciones por `θs`, × un barrido de `θs`. Es el trabajo pesado del cap. 14. |
| 36 | Potencial completo / Euler / Navier-Stokes transónico | §11.10 | `[GPU-VIVO]` | Fuera del alcance de este pliego; se documenta como el escalón 4 del CFD transónico. |

### 5.2 Resumen y lectura estratégica

| Costo | Cuántos métodos | Qué significa |
|---|---|---|
| `[NAVEGADOR]` | **24 de 36** | Dos tercios del contenido de estos cinco capítulos corre **en vivo, en el navegador, en CPU pura**. |
| `[PRECÓMPUTO]` | **7** | Tablas de gas, `Cp,cr`, tablas de cono, catálogo de toberas, superficies de `Cf`, campos de calentamiento. |
| `[GPU-VIVO]` | **5** | Cuerpo romo *time-marching*, mallas finas de MacCormack, optimización de waverider, campos viscosos, CFD transónico. |

**Los tres hallazgos de costo que importan:**

1. **El MOC es barato.** La intuición dice "método numérico → GPU". Falso: en 2-D irrotacional las
   ecuaciones de compatibilidad son **algebraicas**, y una malla de 2500 nodos son ~1 ms. **El diseño
   del contorno de una tobera supersónica cabe entero en el navegador, interactivo.** Es la
   funcionalidad más impresionante/barata que sale del capítulo 13.

2. **Newton es un shader.** `Cp = 2 sin²θ` es un producto punto entre la normal del triángulo y la
   dirección de la corriente. Se puede evaluar **en el fragment shader** mientras el usuario rota el
   vehículo. Presión hipersónica pintada en vivo sobre la geometría, gratis.

3. **Lo único verdaderamente caro es el flujo MIXTO.** El `[GPU-VIVO]` del bloque no es "supersónico"
   ni "hipersónico": es **subsónico-y-supersónico a la vez** (cuerpo romo) y **optimización con
   viscosidad dentro del lazo** (waverider). Todo lo demás, o es cerrado, o es hiperbólico y
   marchable.

### 5.3 Presupuesto de precómputo en iangpu

| Tarea | Tamaño del barrido | Tiempo estimado | Artefacto |
|---|---|---|---|
| Tablas A/B/C a paso 0.001 | ~10⁴ filas | segundos (CPU) | `aero-tablas.bin` ~0.5 MB |
| `Cp,cr(M_cr)` | 10³ puntos | milisegundos | inline en el bundle |
| Tablas de cono Taylor-Maccoll | `M∞` × `θs` ≈ 10⁵–10⁶ integraciones RK4 | **minutos en CPU, segundos en GPU** | `aero-cono.bin` |
| Catálogo de contornos de tobera MOC | ~200 combinaciones `(Me, γ)` | segundos | JSON de polilíneas |
| Superficies `Cf` compresible | bloqueado — falta la Fig 19.1 | — | ver §7 |
| Campos de `q̇w` por geometría | por vehículo | minutos | campo sobre la malla |

> Nota de operación: todo esto es **resumible** y **determinista**, así que encaja con la doctrina de
> "iangpu nunca ocioso" del proyecto. Las tablas de cono son el candidato obvio para un lote nocturno.

---

## 6. ESCUELA — lecciones que salen de este bloque

Regla 7. La escuela **vive dentro del CAD** (`forja-brep.html`): el alumno **DIBUJA** la geometría con
croquis y cotas y la analiza con un **estudio**. No es un simulador de juguete aparte.

Formato de cada lección: **CONSTRUIR → MOVER → VER → VERIFICAR contra el número del libro.**

---

### L1 — "La garganta que se ahoga" *(cap 10, §10.2–10.3)*

- **CONSTRUIR.** Croquis del perfil de media tobera convergente-divergente en el plano XY:
  entrada, garganta, salida. **Cotas obligatorias** (nada de teclear coordenadas): `A_t` (o el radio
  de garganta), `A_e/A_t` como cota derivada, longitudes de la convergente y la divergente.
  **Revolución** alrededor del eje → sólido. La geometría es la que ya sabe hacer el sketcher.
- **MOVER.** Un solo control: la **contrapresión** `p_B/p0`, de 1.0 a 0.0.
- **VER.** Tres gráficas en vivo sobre el corte de la tobera: `M(x)`, `p(x)/p0`, `T(x)/T0`, y encima
  el **gasto `ṁ`** con un marcador. El alumno ve, en este orden:
  1. `p_B` casi 1 → viento suave, `M` sube y **vuelve a bajar**;
  2. `p_B` baja → `M` en la garganta se acerca a 1 y `ṁ` sube;
  3. `p_B = p_e,3` → **`M = 1` en la garganta**;
  4. `p_B` sigue bajando → **`ṁ` NO SE MUEVE MÁS.** La curva de `ṁ` se aplana. Ese es el momento
     de la lección: *la tobera dejó de escuchar lo que pasa aguas abajo.*
  5. Sigue bajando → aparece un **choque normal dentro** que se recorre hacia la salida;
  6. Más abajo → choques oblicuos afuera (sobreexpandida) → adaptada → abanicos (subexpandida).
- **VERIFICAR.** Fixtures `anderson-ej-10.2a`, `anderson-ej-10.2b`, `anderson-ej-10.3`.
  Gate numérico: con `Ae/At = 2`, `p0 = 1 atm`, `T0 = 288 K` debe salir `Me = 2.2`, `pe = 0.0935 atm`,
  `Te = 146 K` en la rama supersónica **y** `Me = 0.3`, `pe = 0.94 atm`, `Te = 282.9 K` en la
  subsónica. **Misma geometría, dos respuestas.** Si el alumno no entiende por qué, no pasa.
- **Trampa que hay que hacerle caer:** pedirle que calcule `A*` cuando el flujo es todo subsónico
  (`p_e = 0.973 atm`). Va a poner `A* = A_t`. El fixture `10.3` le va a decir `A_t/A* = 1.482`.

---

### L2 — "Tu túnel de viento no cabe en el laboratorio" *(cap 10, §10.5, §10.8)*

- **CONSTRUIR.** El alumno **dibuja el modelo** que quiere probar (una configuración esbelta de 4 ft,
  envergadura 2 ft) y luego **dibuja la sección de pruebas** alrededor. El croquis debe llevar las
  **ondas de Mach** desde la nariz como líneas de construcción a `μ = asin(1/M)`.
- **MOVER.** Mach de diseño, longitud del modelo, altura de la sección de pruebas, tiempo de corrida,
  presión de almacenamiento del tanque.
- **VER.** Cuatro consecuencias encadenadas, en vivo:
  `altura mínima` → `A*` → `ṁ` → `masa por corrida` → **`volumen del tanque` → `altura del tanque`**,
  con una silueta a escala del tanque **junto a una silueta de nave industrial de 10 m**. Cuando el
  tanque mide 80 ft, no cabe, y se ve.
- **VERIFICAR.** Fixtures `anderson-ej-10.6`, `anderson-reto-10.8-geometria`,
  `-presion`, `-reynolds`, `-gasto-y-tanque`.
  Gates: `A_t2/A_t1 = 1.387`; `h = 1.155 ft`; `Re = 23×10⁶`; `ṁ = 7.05 lbm/s`; `V = 9049 ft³`;
  `h_tanque = 80 ft` a 2 atm y **8 ft a 20 atm**.
- **Lo que el alumno debe salir sabiendo:** que un requisito de Reynolds y un requisito de tamaño de
  modelo **determinan el tamaño del edificio**. Y que la respuesta "80 ft" no es un error del
  software: es el software haciendo su trabajo.

---

### L3 — "La corrección más barata del libro" *(cap 11, §11.4–11.5)*

- **CONSTRUIR.** El alumno dibuja un perfil con croquis (splines acotadas por espesor máximo y su
  posición) o carga un NACA de 4 dígitos. Corre el **estudio de paneles incompresible que La Forja ya
  tiene** (`src/aero/potencial.ts`) → obtiene `Cp,0(x/c)`.
- **MOVER.** Un solo deslizador: `M∞`, de 0 a 0.9. Y un selector: **P-G / Karman-Tsien / Laitone**.
- **VER.** La curva `Cp(x/c)` **inflándose** al subir `M∞`, con las tres correcciones superpuestas
  separándose entre sí. Y arriba de `M∞ = 0.7`, **la zona se pinta de ámbar** con la leyenda literal
  del libro: *"begins to give inappropriate results at values of M∞ = 0.7 and above."*
  Cuando `M∞ → 1`, `|Cp| → ∞` y la UI **se niega a dibujar** y explica por qué (mito de la barrera).
- **VERIFICAR.** Fixtures `anderson-ej-11.1` (`Cp,0 = −0.3`, `M∞ = 0.6` → `Cp = −0.375`) y
  `anderson-ej-11.2` (`cl = 8.8α` a `M∞ = 0.7`, **+40 % de pendiente**).
- **El "wow" honesto:** el alumno acaba de multiplicar el valor de todo el solver incompresible por
  el costo de una división. Anderson: *"the natural approach to high-speed subsonic aerodynamics was
  to search for methods that would allow relatively simple corrections to existing incompressible
  flow results."*

---

### L4 — "El número que decide el ala" *(cap 11, §11.6–11.7)*

- **CONSTRUIR.** El mismo perfil de L3, pero ahora el alumno **acota el espesor máximo** y puede
  moverlo con una cota.
- **MOVER.** El **espesor** `t/c` (de 6 % a 18 %), con una cota real en el croquis.
- **VER.** Dos curvas en un solo plano `Cp` vs `M∞`:
  - **curva C** (universal, ec. 11.60) — **fija, nunca se mueve**;
  - **curva B** (el `(Cp,0)min` del perfil corregido) — **se hunde** cuando el alumno engorda el
    perfil.
  La intersección `D` **se desplaza a la izquierda** → `M_cr` baja. Y al lado, la curva `cd` vs `M∞`
  con `M_cr` y `M_drag-divergence` marcados, y el salto ×10.
  También: un marcador en `x/c = 0.11` (presión mínima) **y otro en `x/c = 0.3`** (espesor máximo)
  para que vea que **no coinciden**.
- **VERIFICAR.** Fixtures `anderson-tabla-11.3-Cpcr`, `anderson-tabla-11.3-PG`,
  `anderson-ej-11.3-grafico`, `anderson-ej-11.3-analitico`, `anderson-ej-11.3-validacion`.
  Gate duro: NACA 0012 a α = 0 con `(Cp,0)min = −0.43` debe dar **`M_cr = 0.7371`** (analítico) y
  **0.74** (gráfico), contra **0.73 experimental**. Error ~1 %.
- **La frase que se lleva a casa:** *"our intuition would be completely wrong. Nature places the
  maximum velocity at a point which satisfies the physics of the whole flow field."*

---

### L5 — "Por qué las alas van torcidas" *(cap 11, Design Box §11.7)*

- **CONSTRUIR.** El alumno toma el ala del L4 y le pone una **cota de flecha `Λ`** sobre la línea de
  media cuerda, en el croquis del plano de planta. Nada de teclear ángulos: se acota.
- **MOVER.** `Λ` de 0° a 45°.
- **VER.** Un corte **paralelo a la corriente** (no perpendicular al borde de ataque) mostrando cómo
  el perfil que "ve" el aire se **estira**: mismo espesor, cuerda × `1/cos Λ`. El `t/c` efectivo
  bajando en vivo de 0.15 a 0.106. Y `M_cr` de L4 **subiendo** en consecuencia.
- **VERIFICAR.** Fixture `anderson-flecha-45`: `c2 = 1.41·c1`, `t2/c2 = 0.106`.
  Segundo gate: la pendiente de sustentación con (11.68), y que **baja** con la flecha — la flecha
  **cuesta** sustentación. No es gratis.
- **Historia que vale la pena contar (§11.13):** Busemann la presentó en la Conferencia Volta de 1935;
  von Kármán y Dryden cenaron con él esa noche y Crocco dibujó en el reverso de un menú "el avión del
  futuro de Busemann" **como broma**. La Luftwaffe la clasificó un año después. Jones la
  redescubrió solo en 1945 y Theodorsen la llamó *"a snare and a delusion"* y bloqueó la publicación.
  Los ensayos de caída libre de Gilruth mostraron **factor 4 de reducción de arrastre**. Schairer
  mandó la carta a Boeing el 10 de mayo de 1945 → **B-47 → 707 → todo lo que vuela hoy.**

---

### L6 — "cl y cd supersónicos en una línea" *(cap 12)*

- **CONSTRUIR.** Croquis de una placa plana y de un perfil **diamante** (`ε` acotado). El alumno los
  dibuja; la geometría es trivial y ese es el punto: **toda la física está en la inclinación local**.
- **MOVER.** `α` y `M∞`.
- **VER.** Cada panel pintado por su `Cp = 2θ/√(M∞²−1)`, **rojo si la superficie se mete en la
  corriente, azul si se aleja**. Las líneas de Mach dibujadas a `μ` desde cada quiebre, corriendo
  **solo hacia atrás** — el alumno ve, geométricamente, por qué en supersónico nada se entera aguas
  arriba. Al lado, `cl` y `cd` contra la solución exacta de choque-expansión, y el **delta en %**.
- **VERIFICAR.** Fixtures `anderson-ej-12.1` (α=5°, M=3: `cl = 0.123` lineal vs `0.125` exacto →
  **1.6 %**) y `anderson-ej-12.2` (F-104 a M=2, 11 km, 9400 kgf → **α = 1.98°**).
- **La lección de diseño:** un caza supersónico en crucero vuela a **~2°**. La teoría lineal no es un
  juguete de aula: es válida **exactamente en el punto de diseño**.

---

### L7 — "El arrastre que no ves" *(cap 12, §12.4)*

- **CONSTRUIR.** El mismo F-104 del L6, ahora con la **cuerda acotada** (2.2 m) y altitud de vuelo.
- **MOVER.** `α`, y un interruptor **laminar/turbulento**.
- **VER.** Una barra apilada: **arrastre de onda** (crece con `α²`) sobre **fricción** (casi plana).
  A α pequeño, la fricción domina; hay un **cruce**. Y el `L/D` cayendo de 28.3 a 11.2 en cuanto se
  enciende la fricción. La curva `L/D(α)` con su máximo.
- **VERIFICAR.** Fixture `anderson-ej-12.3`: `Re = 3.33×10⁷`, `Cf` neto `= 4.3×10⁻³`,
  `cd_onda = 2.83×10⁻³`, total `7.13×10⁻³`, **fricción = 60 % del total**, `L/D` 28.3 → 11.2,
  cruce en **α = 2.47°**. Y `anderson-prob-12.6` para el óptimo cerrado.
- **Gancho:** *"Clearly, the skin-friction drag greatly diminishes the lift-to-drag ratio."* El
  alumno acaba de aprender que **más de la mitad del arrastre de un caza supersónico es rozamiento**,
  no ondas de choque. Nadie lo espera.

---

### L8 — "Dibuja la tobera que NO tiene choques" *(cap 13, §13.2–13.3)*

Ésta es **la lección de producto** del capítulo 13: es el primer momento del pliego en que el
software **diseña geometría** en vez de analizarla.

- **CONSTRUIR.** El alumno dibuja **solo dos cosas** en el croquis: la convergente subsónica (libre,
  a mano, porque el libro dice que ningún contorno es mejor que otro) y la **sección de expansión**
  (un arco de radio grande, acotado por `θ_max`). **El resto lo calcula el MOC.**
- **MOVER.** `M_e` de diseño y `θ_max`. Y la **finura de la malla** (número de características).
- **VER.** La malla de características **dibujándose sobre el croquis**: las `C+` y `C−`
  entrecruzándose, los nodos apareciendo, y finalmente la **sección de enderezamiento emergiendo**
  como una polilínea que el software añade al croquis. El alumno ve que la pared **no la dibujó él**:
  **salió de la física**. Con la malla gruesa el contorno es angular; al refinarla se suaviza.
- **VERIFICAR.** Invariantes `anderson-moc-invariantes` I1–I7 como asserts duros
  (`θ+ν` constante sobre cada `C−` a 1e-9), y en particular **I6: `θ12 = θ9`** — la firma de que el
  enderezamiento realmente canceló las ondas. Caso de humo: `anderson-prob-13.1`.
- **Gate visual (patrón `critic-eye` del proyecto):** renderizar el flujo dentro de la tobera
  diseñada y **verificar a ojo que no hay choques oblicuos**. Si aparecen, el contorno está mal.
- **Por qué importa (§13 Preview Box):** *"if the contour of that divergent nozzle is not just right,
  undesirable shock waves may form inside the nozzle—shock waves that will reduce the performance of
  the rocket engine."*

---

### L9 — "El problema que nadie sabía resolver" *(cap 13, §13.5)*

- **CONSTRUIR.** El alumno dibuja un **cuerpo romo** (cilindro parabólico, o la nariz de su vehículo)
  con croquis y cotas de radio de nariz.
- **MOVER.** `M∞`, y el **botón de reproducir el tiempo**.
- **VER.** **Ésta es una lección para VER, no para leer un número.** La onda de choque supuesta
  arranca en un lugar arbitrario y **se mueve**: rápido al principio, frenándose, hasta quedar quieta
  hacia los 300–500 pasos. Debajo, la traza de la presión de estancamiento **oscilando y
  asentándose**. El alumno entiende, viéndolo, qué significa "el estacionario es el límite asintótico
  de un transitorio artificial".
  Además: la **línea sónica** dibujada dentro de la capa de choque, separando la región subsónica de
  la supersónica — **la razón de que este problema fuera intratable** hasta finales de los 60.
- **VERIFICAR.** `anderson-timemarching-comportamiento`: la onda queda "virtually motionless" entre
  300 y 500 pasos; a `M∞ = 8` el choque queda **más cerca** que a `M∞ = 4`; la presión es máxima en
  el estancamiento y decrece al alejarse. Comparar el `Cp` calculado contra
  **newtoniano modificado** (14.7) — es la comparación que hace el propio libro (Figs 13.14 y 14.11).
- **Gate:** `|∂ρ/∂t|_max·Δt/ρ < 1e-4` como criterio de convergencia. **`[EXTENSIÓN DECLARADA]` —
  motivo: el libro no publica umbral (D22).**

---

### L10 — "El cono es más amable que la cuña" *(cap 13, §13.6)*

- **CONSTRUIR.** El alumno dibuja **una cuña y un cono del mismo semiángulo**, lado a lado, con la
  misma cota de ángulo.
- **MOVER.** El semiángulo (con la cota) y `M∞`.
- **VER.** Los dos choques dibujados sobre la misma escala: el del cono **visiblemente más pegado**.
  Las líneas de corriente: en la cuña **rectas y paralelas de inmediato**; en el cono **curvándose**
  y acercándose asintóticamente a la superficie. Y los rayos de propiedad constante desde el vértice
  del cono. Al aumentar el ángulo, la cuña **desprende su choque antes** que el cono.
- **VERIFICAR.** Invariantes `anderson-cono-cualitativo` C1–C6. Validación numérica de nuestro
  Taylor-Maccoll contra **Kopal (Ref. 95) / Sims (Ref. 96)** — no contra este libro, cuyas Figs 13.20
  y 13.22 son imagen.
- **Caso raro que hay que mostrar (Fig 13.23):** con `θc` grande pero menor que `θc,max`, uno de los
  rayos es **línea sónica** y el flujo cerca de la superficie llega a subsónico **por compresión
  isentrópica, sin choque**. *"one of the few instances in nature."*
- **Por qué esta lección paga después:** el campo cónico tabulado aquí es **el generador de
  waveriders** del L12.

---

### L11 — "Newton tenía razón, tres siglos tarde" *(cap 14, §14.3–14.5)*

- **CONSTRUIR.** El alumno dibuja una placa plana, y luego un cuerpo romo, y luego su propio vehículo.
  Cualquier geometría triangulada sirve — **ése es el punto**: Newton no necesita malla de flujo,
  solo la **normal de cada triángulo**.
- **MOVER.** `α` de 0° a 90°. Y un interruptor **newtoniano puro / newtoniano modificado**.
- **VER.** El cuerpo **pintado por `Cp` en vivo mientras rota** (es un producto punto por triángulo,
  corre en el shader). Las caras "en la sombra" en `Cp = 0`. Y tres curvas: `cl`, `cd`, `L/D` vs `α`.
  El alumno ve **el máximo de `cl` a 54.7°** y descubre, moviendo el ángulo, que **no es separación**:
  `Cp` sigue creciendo hasta 90°, pero `L = N cos α` se dobla. Es geometría.
- **VERIFICAR.** Fixtures `anderson-newtoniano-placa` (`cl,max = 0.77` en `α = 54.7°`, `cd(90°) = 2`,
  `Cp,estancamiento = 2`), `anderson-newtoniano-LDmax` (`α = cd,0^{1/3}`, `(L/D)max = 0.67/cd,0^{1/3}`,
  **`cd,w = 2·cd,0`**), y sobre todo **`anderson-ej-14.1a/b/comparacion`**: newtoniano subpredice
  `cl` y `cd` en **36.6 %** pero da `L/D = 3.73` **exacto**.
- **La joya conceptual (§14.5):** demostrarle al alumno, con las relaciones de choque exactas, que
  `Cp = 2 sin²θ` **es** el límite exacto cuando `M∞ → ∞` **y** `γ → 1`. Y luego decirle la verdad
  incómoda: en aire `γ = 1.4` siempre, así que usar Newton es *"theoretically not proper"* y su
  acierto es *"somewhat fortuitous"*. **Enseñar a usar una herramienta sabiendo que está fuera de su
  dominio es más valioso que enseñar una herramienta perfecta.**
- **Cierre de independencia de Mach:** barrer `M∞` de 2 a 30 y ver que `Cp`, `CL` y `CD` **se
  aplanan** mientras `p` diverge. Adimensionales sí, dimensionales no.

---

### L12 — "Por qué la nariz es ROMA" *(cap 14, §14.8)*

Es la lección más importante del capítulo 14 y la que tiene el mejor gancho del pliego entero.

- **CONSTRUIR.** El alumno dibuja **dos vehículos de entrada**: uno esbelto puntiagudo (lo que la
  intuición dice que es "aerodinámico") y uno romo. Croquis con **cota del radio de nariz `R`**.
- **MOVER.** El **radio de nariz** con una cota, y la velocidad de entrada `V_E`.
- **VER.** Tres cosas simultáneas:
  1. `q̇w` en el estancamiento, con `q̇w ∝ 1/√R` — **al afilar la nariz, el número se dispara**;
  2. la partición `C̄f/CD`: casi 1 en el esbelto, casi 0 en el romo;
  3. `Q_total = ½(C̄f/CD)(½ m V_E²)` — **el calor total integrado**, que es lo que funde el vehículo.
  El alumno intenta "mejorar" el vehículo afilándolo y **lo destruye**. Ése es el momento.
- **VERIFICAR.** Fixture `anderson-ej-14.2`: transbordador a 68.9 km y 6.61 km/s, `R = 1.29 m`,
  `Tw = 1110 K` → **`q̇w = 45.78 W/cm²`** contra **45 W/cm² medido** (Zoby, Ref. 98). **1.7 %.**
  Y `anderson-shock-layer-temperatura`: `M∞ = 36` a 59 km → **65,248 K con gas perfecto** vs
  **~11,000 K real**. El primer número es absurdo y **está bien que lo sea**: es la prueba de que las
  tablas de los caps. 7–13 se rompen.
- **El cierre histórico (§1.1, referenciado en §14.8.3):** el concepto de cuerpo romo es de
  **H. Julian "Harvey" Allen, 1951**. Y el contraejemplo trágico: **Columbia, 1 de febrero de 2003** —
  daño en las losetas cerca del borde de ataque del ala izquierda, gases calientes penetrando la
  estructura. Anderson lo pone en el libro. Nosotros también.

---

### L13 — "El vehículo que cabalga su propia onda" *(cap 14, §14.9)* — lección de cierre

- **CONSTRUIR.** Ésta es **construcción inversa** y es lo más bonito del bloque. El alumno:
  1. elige un campo generador (cuña o cono) y su `M∞` y ángulo → el software dibuja el **choque**;
  2. **traza con el ratón una curva sobre la superficie del choque** (eso es acotar un croquis 3-D
     sobre una superficie, exactamente lo que hace el sketcher);
  3. el software traza las **líneas de corriente** que nacen de esa curva y las teje en una
     superficie → **ése es el vehículo**.
- **MOVER.** La curva de borde de ataque, `θs`, y `M∞`.
- **VER.** El choque **adherido en todo el borde de ataque** — y luego, moviendo `M∞` **fuera** del
  punto de diseño, el choque **desprendiéndose** y el vehículo dejando de ser waverider. Es la lección
  de "vehículo de punto de diseño" hecha visible. Al lado, la comparación de `L/D` contra la curva de
  Kuchemann.
- **VERIFICAR.** Fixture `anderson-waverider-correlaciones`: nuestro `(L/D)max` debe caer **entre**
  `4(M∞+3)/M∞` y `6(M∞+2)/M∞` para configuraciones razonables, y **encima** de Kuchemann para
  waveriders bien construidos. `anderson-waverider-optimo-M6`: a `M∞ = 6` con `b/l = 0.06`, el óptimo
  cae en **`θs = 12°`**, y el invariante **onda ≈ fricción dentro de un factor 2**.
- **El puente que cierra el pliego:** ese factor 2 es **el mismo** de la ec. (14.27) de la placa plana
  newtoniana (`cd,w = 2·cd,0` en `(L/D)max`). Un resultado de una placa infinitamente delgada del
  §14.4 predice la estructura del óptimo de una optimización numérica de cinco componentes del §14.9.
  **Eso es lo que significa que la física esté bien.**
- **Ancla real:** el **X-51** es un waverider viscoso-optimizado. 1 de mayo de 2013: 6 minutos de
  vuelo, Mach 5+ durante 210 s.

---

### 6.1 Orden sugerido y prerequisitos

```
L1 (tobera ahogada) ──> L2 (tunel)
                          │
L3 (P-G) ──> L4 (Mcr) ──> L5 (flecha)
   │
   └──────> L6 (supersonico lineal) ──> L7 (friccion)
                                          │
L8 (MOC / contorno de tobera) <───────────┘   [requiere L1 y L6]
   │
   ├──> L9 (cuerpo romo time-marching)
   └──> L10 (cono Taylor-Maccoll) ──┐
                                     │
L11 (Newton) ──> L12 (nariz roma) ──┴──> L13 (waverider)   [cierre]
```

- **L1–L2** solo necesitan el cap. 10 y lo que ya existe (`atmosfera.ts`).
- **L3–L5** necesitan el solver de paneles incompresible (`potencial.ts`) **ya funcionando**.
- **L8** necesita las tablas del Apéndice C (Prandtl-Meyer) precomputadas.
- **L10** produce las tablas de cono que **L13 consume**.
- **L13** es el proyecto final: usa geometría de croquis 3-D, campo cónico tabulado, MOC axisimétrico
  y capa límite. Es el examen del bloque.

### 6.2 Gates de la escuela (qué se le exige al alumno)

| Lección | Gate numérico | Gate visual |
|---|---|---|
| L1 | `Me = 2.2` / `Me = 0.3` con la misma geometría; `A_t/A* = 1.482` | la meseta de `ṁ` (choked) visible |
| L2 | `A_t2/A_t1 = 1.387`; `Re = 23×10⁶`; tanque de 9049 ft³ | el tanque de 80 ft junto a la nave |
| L3 | `Cp = −0.375`; `cl = 8.8α` | la zona ámbar arriba de M∞ = 0.7 |
| L4 | `M_cr = 0.7371` (NACA 0012) | curva C fija, curva B hundiéndose con el espesor |
| L5 | `t/c` efectivo 0.15 → 0.106 | el corte paralelo a la corriente, estirado |
| L6 | `cl = 0.123` vs `0.125`; `α = 1.98°` | líneas de Mach **solo hacia atrás** |
| L7 | fricción = 60 % del total; cruce en 2.47° | la barra apilada invirtiéndose |
| L8 | invariantes MOC I1–I7 a 1e-9; `θ12 = θ9` | **cero choques oblicuos** dentro de la tobera |
| L9 | convergencia asintótica; choque más cerca a M=8 | la onda moviéndose y **deteniéndose** |
| L10 | Taylor-Maccoll vs Kopal/Sims | choque del cono más pegado que el de la cuña |
| L11 | `cl,max = 0.77` a 54.7°; `L/D = 3.73` exacto | `Cp` pintado en vivo; caras en sombra a 0 |
| L12 | `q̇w = 45.78 W/cm²` vs 45 medido | el número disparándose al afilar la nariz |
| L13 | `(L/D)max` sobre la curva de Kuchemann; `θs = 12°` a M=6 | choque **adherido** → **desprendido** fuera de diseño |

### 6.3 Conexión con lo que ya existe

- `src/aero/atmosfera.ts` (ISA) → **L2** (`ρ0`, `T0`), **L6/L7** (11 km), **L12** (68.9 km).
- `src/aero/potencial.ts` (flujo potencial, elementos elementales) → **L3, L4** (es el `Cp,0` que
  P-G corrige). **Este es el enganche más importante: el cap. 11 no reemplaza al solver
  incompresible, lo REVALORIZA.**
- `src/aero/cuna-anderson.ts` (Ej. 1.1, integración de `p` y `τ` por paneles) → el patrón exacto que
  hay que repetir en **L6** (paneles con `Cp` de (12.15)) y **L11** (triángulos con `Cp` de (14.4)).
  La estructura ya está probada.
- El sketcher con cotas → **todas** las lecciones. La cota de espesor (L4), de flecha (L5), de radio
  de nariz (L12) y la curva sobre el choque (L13) son croquis, no campos de texto.

---

## 7. NO OBSERVADO

Regla 5. El texto viene de `pdftotext`: figuras, gráficas y tablas que eran **imagen** NO están.
Aquí van por número, con el impacto sobre el pliego. **Ninguna de estas la deduje ni la inventé.**

### 7.1 Bloqueadores duros (impiden implementar algo)

| Figura / Tabla | § | Qué contiene | Impacto |
|---|---|---|---|
| **Figura 19.1** | citada en §12.4 (p.823) y usada en el Ej. 12.3 (p.824) | `Cf` vs `M∞` con Re como parámetro, laminar y turbulento, para `Pr = 0.75` y pared adiabática | **BLOQUEADOR.** Es la fuente de las funciones `F` y `G` de (12.25)/(12.26). Sin ella no puedo tabular el arrastre de fricción compresible. Lo único que tengo es **un punto leído por el autor**: `Cf = 2.15×10⁻³` para turbulento a `M = 2`, `Re = 3.33×10⁷`. Está **fuera de mi rango** (cap. 19) y además es imagen. → Debe cubrirlo el agente del bloque de capas límite, o hay que generarla resolviendo la capa límite compresible. |
| **Apéndice A** (flujo isentrópico) | usado en todos los caps. 10–14 | `A/A*`, `p0/p`, `T0/T`, `ρ0/ρ` vs `M` | **Fuera de mi rango.** Tengo solo los valores citados en los ejemplos: `A/A*=10.25→M=3.95`; `A/A*=2→M=2.2` o `0.3`; `A/A*=2.964↔M=0.2`; `A/A*=1.482↔M=0.44`; `A/A*=1.687↔M=2`; `A/A*=2.637↔M=2.5`; `A/A*=1.53`, `1.616`, `2.193`, `6.79`; `p0/p=142`, `10.69`, `1.064`, `1.028`, `17.09`; `T0/T=4.12`, `1.968`, `1.018`, `1.8`; `ρ0/ρ=4.347`; `p0/p=0.9763×10⁴` (M=8), `0.4808×10⁶` (M=14.32). **Mitigación: (10.32) y las isentrópicas son cerradas — se generan.** |
| **Apéndice B** (choque normal) | §10.5, §14.2, §14.5 | `p2/p1`, `p0,2/p0,1`, `T2/T1`, `M2` vs `M1` | **Fuera de mi rango.** Valores citados: `p0,2/p0,1 = 0.7209` (M=2); `p2/p1 = 7.125` y `M2 = 0.513` (M=2.5); `Ts/T∞ = 252.9` (M=36); `p3/p1 = 9.443` (Mn=2.87). **Mitigación: las relaciones de Rankine-Hugoniot son cerradas.** |
| **Apéndice C** (Prandtl-Meyer) | §13.2, §14.4.1 | `ν(M)` y `μ(M)` | **Fuera de mi rango.** Valores citados: `ν(8) = 95.62°`; `ν = 110.62° → M = 14.32` (interpolado por el autor). **Mitigación: `ν(M)` es cerrada; su inversa se tabula.** **Crítico para el MOC.** |
| **Apéndice D** (atmósfera estándar) | §10.3, §12.3 | `p`, `T`, `ρ` vs altitud | **Fuera de mi rango.** Valores citados: 20 km → `p∞ = 5.5293×10³ N/m²`; 11 km → `ρ∞ = 0.3648 kg/m³`, `T∞ = 216.78 K`; 59 km → `T∞ = 258 K`; 68.9 km → `ρ∞ = 1.075×10⁻⁴ kg/m³`; 150,000 ft → `T∞ = 500 °R`, `p∞ = 3.06 lb/ft²`. **Mitigación: `src/aero/atmosfera.ts` ya implementa ISA hasta 20 km. Arriba de 20 km (59 y 68.9 km del cap. 14) HACE FALTA extender el modelo — es una brecha real del código actual.** |
| **Figura 1.50** | usada en el reto §10.8 (p.733) | `μ` (viscosidad) vs temperatura, en SI | **BLOQUEADOR PARCIAL** para reproducir el reto §10.8. El autor **extrapola** a 155 K y lee `1.05×10⁻⁵ kg/(m·s)`. Fuera de mi rango. **Mitigación: Sutherland (15.3) está transcrita LITERAL en el Ej. 12.3 (p.824) con `μ0 = 1.7894×10⁻⁵` y `T0 = 288.16 K` — se puede usar en su lugar, declarando la sustitución.** |

### 7.2 Figuras cuyo dato numérico rescaté del texto (no bloquean)

| Figura | § | Qué rescaté del texto circundante |
|---|---|---|
| Fig 10.23 | §10.6, p.725 | Etiquetas parcialmente legibles: ángulos 52°, 73°, 11°, 4°, 0°; `M ≈ 1.62`, `1.22`, `1.02`; cota 0.76 in.; razón de presión 0.417 |
| Fig 11.5 | §11.6, p.757 | `M∞ = 0.3 → M_A = 0.435`; `0.5 → 0.772`; `M_cr = 0.61 → M_A = 1.0`; `M∞ = 0.65` con línea sónica |
| Fig 11.8 | §11.6, p.761 | `(Cp,0)min = −0.43`; `Re = 3.65×10⁶`; posición del mínimo `x/c = 0.11`; espesor máximo en `x/c = 0.3` |
| Fig 11.9 | §11.6, p.762 | Las **dos tablas** de la curva B y de la curva C están transcritas en el texto → fixtures completos |
| Fig 11.10 | §11.6, p.764 | `Cp,cr = −1.465` a `M∞ = 0.575` (`Re = 4.68×10⁶`); `Cp,cr = −0.681` a `M∞ = 0.725` (`Re = 5.34×10⁶`) |
| Fig 11.13 | Design Box §11.7, p.769 | Eje `t/c` de 4 a 14 %, Mach de 0 a 3; nombres de aeronaves (A-10, F-86, F-100, MIG-21, F-14, F-15, F-16, F-18, SR-71, Harrier, Hawk, Gnat, Alpha Jet, S.211, MB 339, Mitsubishi F-1). **Los pares (t/c, M) individuales NO son legibles.** |
| Fig 11.20 | §11.9, p.777 | `M_drag-div = 0.67` (NACA 64₂-A215) y `0.79` (supercrítico 13.5 %) — citados en el texto |
| Fig 11.22/11.23 | §11.10, p.781–782 | Recuadro de la Fig 11.23 legible: `SYN107P DESIGN 0/10/20`, `alpha = 2.251/2.153/2.113`, `CD = 0.01131/0.01125/0.01127`; estaciones 9.6, 27.2, 44.3, 60.8, 79.1, 95.6 % de envergadura; `M∞ = 0.86`. La reducción de 7.6 % está en el texto (para el caso `M∞ = 0.83`) |
| Fig 11.38 | §11.16, p.806 | `Cp` mínimo = **−0.575**, en `x/c` entre 0.4 y 0.5 — citado en el texto |
| Fig 14.14 | §14.4, p.885 | `cl,max = 0.77` a `α = 54.7°`; `cd(90°) = 2`; `cl(90°) = 0`; la curva punteada con fricción y `(L/D)max ≈ 6.5` (laminar, M=10, Re=3×10⁶, del §14.9 p.909) |
| Fig 14.21 | §14.8.3, p.909 | Condiciones legibles: altitud 68.8 km, `V∞ = 6.61 km/s`, `ρ∞ = 1.075×10⁻⁴ kg/m³`, `α = 40.2°`, `R_N = 1.29 m`; eje de calor hasta 50 W/cm², eje `x/L` hasta 0.6 |
| Fig 14.27 | §14.9.1, p.917 | Condiciones legibles: `M∞ = 6`, `h = 100,000 ft`, `Re_l = 122.4×10⁶`, `Tw = 1100 K`, `r/l = 0.00005`, `b/l = 0.06`, `l = 60 m`; ejes: `L/D` 7.0–9.0, `CL` 0.02–0.06, `η = V^{2/3}/S_p` 0.09–0.14, `θs` 10–15°; **`θs = 12°` es el óptimo (dicho en texto)** |
| Fig 14.32 | §14.9.1, p.920 | Ejes `(L/D)max` 0–18, Mach 0–30; **las dos correlaciones están como fórmula en la leyenda y en el texto** |

### 7.3 Figuras totalmente no observadas (solo puedo describir su rol)

- **Cap 10:** 10.1 (motor del transbordador), 10.2, 10.3 (túnel de Busemann), 10.4 (túnel hipersónico
  AFWAL), **10.5 (road map)**, 10.6, 10.7, 10.8, **10.9 (ductos convergentes/divergentes)**,
  10.10, 10.11, 10.12, 10.13, **10.14 (`ṁ` vs `p_e` — la curva del choked flow)**, 10.15, 10.16,
  10.17, 10.18, 10.19, **10.20 (esquema del túnel supersónico)**, 10.21, **10.22 (schlieren de la
  interacción choque/capa límite, 4 razones de presión)**, 10.24 (4 tipos de túnel), 10.25.
- **Cap 11:** 11.1 (road map), 11.2, 11.3, **11.4 (P-G vs K-T vs Laitone vs experimento, NACA 4412 a
  α = 1°53′)** ← *la única evidencia cuantitativa de precisión relativa entre las tres correcciones*,
  11.6, **11.7 (efecto del espesor sobre `M_cr`)**, **11.11 (`cd` vs `M∞` con `M_cr` y
  `M_drag-div`)** ← *"schematic only" según el propio autor*, 11.12 (Bell XS-1), 11.14 (flecha),
  11.15 (F-86), 11.16/11.17/11.18 (regla del área), **11.19 (comparación 64-series vs supercrítico
  con sus `Cp`)**, 11.21 (contornos de Mach NACA 0012 a M=0.8, α=2°), 11.24–11.29 (BWB — y el autor
  **declara** que la Fig 11.29 no lleva números *"for proprietary reasons"*), 11.30 (schlieren NACA
  1949), 11.31–11.36 (histórico), **11.34 (polares de Ludwieg 1939, recto vs flecha a M=0.7 y 0.9)**,
  11.37 (P-51 con modelo montado).
- **Cap 12:** **12.2 (`Cp` linealizado vs Mach — "schematic")**, 12.3 (perfil supersónico),
  12.4 (placa plana), 12.5 (F-104), **12.6 y 12.7 (regla del área transónica y supersónica del F-16)**.
- **Cap 13:** 13.1 (road map), 13.2 (mallas), 13.3–13.6 (características), 13.7 (diseño de tobera),
  13.8 (mallas físico/computacional), 13.9–13.11 (cuerpo romo), **13.12 (movimiento temporal del
  choque, 0/100/200/300/400/500 Δt)**, **13.13 (presión de estancamiento vs tiempo)**,
  **13.14 (distribución de presión, M=4 y 8, con newtoniano superpuesto)**,
  **13.15 (formas de choque y líneas sónicas, M=4 y 8)**, 13.16–13.19 (cono),
  **13.20 (diagrama `θc`–`θs`–`M∞` para conos)** ← *el equivalente de la Fig 9.9 para conos; la carta
  de diseño*, 13.21, **13.22 (comparación de ángulos de onda cuña vs cono a Mach 2)**, 13.23.
- **Cap 14:** 14.1/14.2 (X-43), 14.3–14.5, **14.6 (`qc` y `qr` vs velocidad de vuelo)** ← *dónde
  exactamente la radiación toma el mando*, 14.7–14.10, **14.11 (paraboloide M=4: newtoniano modificado
  vs time-marching)**, 14.12/14.13, **14.15 (`Cp` de cuña y cono vs Mach, exacto vs newtoniano —
  la evidencia de independencia de Mach)**, **14.16 (`CD` de esfera y cono-cilindro en rango
  balístico)**, 14.17 (geometría del transbordador; cotas legibles: área en planta 560,000 in²,
  `x_c = 840.7 in`, `L = 1293 in`, 45°, 100°), **14.18 (`p/p∞` en el meridiano de barlovento,
  gas perfecto vs equilibrio, M=23, α=30°)**, **14.19 (`Cm` vs α — el caso del body flap)**,
  14.20, 14.22–14.26, **14.27 (la optimización a Mach 6)**, 14.28–14.31 (formas de waverider),
  **14.32 (la barrera de `L/D`)**, 14.33 (X-51).

### 7.4 Contenido que el autor declara explícitamente FUERA de este libro

No es "no observado" por el `pdftotext`: **el autor dice que no está aquí.** Es igual de importante
declararlo, porque son huecos reales del pliego.

| Tema | Dónde lo dice | A dónde remite |
|---|---|---|
| Teoría transónica | §11.6, p.757 | *"Transonic flow is highly nonlinear [...] The theory of transonic aerodynamics is beyond the scope of this book."* |
| Diseño de difusores supersónicos reales | §10.4, p.718 | Ref. 21 cap. 5; Ref. 1 cap. 12 |
| Métrica cuantitativa de "suavidad" para la regla del área | §11.8 | **No la da.** Solo el criterio cualitativo. Cualquier funcional que implementemos es `[EXTENSIÓN DECLARADA]` |
| Formas de `g_c` y `g_t` en el `cd` supersónico de perfil arbitrario | §12.3, p.818 | Refs. 25 y 26 |
| Estabilidad numérica (`Δξ`, `Δη`) y condición de tangencia en pared para diferencias finitas | §13.4, p.850 | Ref. 21 cap. 11 — *"we do not take the additional space to discuss them here"* |
| MOC rotacional, 3-D y no estacionario | §13.2.2, p.840 | Ref. 21 |
| Cálculo real de un diseño de tobera por MOC (paso a paso completo) | §13.3, p.843 | Refs. 21 y 32 |
| Time-marching en detalle | §13.5, p.855 | Ref. 21 cap. 12 y **Ref. 7** — *"which you should study before attempting to apply this technique"* |
| Ecuaciones de flujo químicamente reactivo | §14.2, p.876 | Ref. 21 caps. 16–17 — *"such matters are beyond the scope of this book"* |
| Transferencia radiativa en capa de choque | §14.2, p.876 | Ref. 34 |
| Tablas de flujo cónico | §13.6.3, p.866 | **Kopal (Ref. 95)** y **Sims (Ref. 96)** |
| Solución exacta de capa límite de estancamiento (ecs. 18.65, 18.70, 18.83) | §14.8.3, p.906 | cap. 18 del mismo libro — **fuera de mi rango** |
| Analogía de Reynolds (ec. 18.50) y `CH ∝ 1/√Re` (ec. 18.54) | §14.8.2, p.903 | cap. 18 — **fuera de mi rango** |
| Ley de Sutherland (ec. 15.3) | §12.4, p.824 | cap. 15 — **pero está transcrita literal en el Ej. 12.3, así que la tengo** |
| Precisión de newtoniano en formas 2-D esbeltas | §14.4.1, p.891 | **Ref. 73** (estudio dedicado) |

### 7.5 Erratas y desajustes tipográficos detectados

Los listo porque **los fixtures dependen de ellos** y otro agente los va a "corregir" mal si no los ve.

| # | Dónde | Texto impreso | Lo correcto | Impacto |
|---|---|---|---|---|
| E1 | Ej. 10.5, p.715 | `γ/R = 1.22/510 = 2.346×10⁻³` | el divisor es **520** (el `R` del Ej. 10.4). El resultado `2.346e-3` **sí** corresponde a `1.22/520` | ninguno en el número; **usar 520** |
| E2 | Reto §10.8, p.733 | `T = 280/1.8 = 155.6 K` | se había calculado `T = 288 °R`, que son **160.0 K** | <2 % en `Re` vía la viscosidad; no cambia la conclusión |
| E3 | Ej. 12.2, p.820 | `q∞ = 6.35×10⁴ m/s` | unidades **N/m² (Pa)** | ninguno numérico |
| E4 | Ej. 14.1(a), p.889 | `Cp3 = (2/γM1²)(p3/p2 − 1)` | el índice correcto es **`p3/p1`**; el valor sustituido (9.443) ya es `p3/p1` | ninguno numérico |
| E5 | Ej. 14.1(b), p.890 | `L/D = 0.1294/0.3468 = 3.73` | el denominador es **0.03468** | ninguno; `3.73` es correcto |
| E6 | Ej. 14.2, p.907–908 | `h0` y `hw` en `J/(kg·K)` | la entalpía es **J/kg** | ninguno numérico |
| E7 | §14.4, p.886 | `dcl/dα = (2 sin² 2)(−sin α) + 4cos²α sin α` | el primer término es `2 sin²α`; el `pdftotext` convirtió `α` en `2` | ninguno; el resultado `sin²α = 2/3` es correcto |
| E8 | §13.6.3, paso 2, p.865 | *"V′ is obtained by inserting M2 into Equation (10.16)"* | debe ser **(13.81)** | confunde al implementador |
| E9 | §13.6.3, paso 3, p.865 | *"solve Equation (13.81) for Vr′"* | debe ser **(13.80)** (la EDO de Taylor-Maccoll) | confunde al implementador |
| E10 | Ej. 10.4, p.714 | `1 N = 0.2247 lb` | el valor estándar es `0.22481` | 0.05 % en el empuje en lb; se usa el del libro en el fixture |
| E11 | §11.6, p.760 | *"as discussed in Section 11.8"* al hablar del perfil supercrítico | el perfil supercrítico es **§11.9**; §11.8 es la regla del área | referencia cruzada |
| E12 | §11.11, p.786 | *"the new centerbody profile in Figure 11.2b"* | debe ser **Figura 11.26b** | referencia cruzada |
| E13 | §11.10, p.778 | *"obtained from Equation (11.6) by dropping all terms on the right-hand side"* | la ecuación con lado derecho no lineal es **(11.16)**, no (11.6) | confunde al implementador de (11.69) |

### 7.6 Brechas del código actual de La Forja que este bloque revela

No es "no observado" del libro, pero es la lista de lo que **hace falta** para implementar el pliego.

1. **`atmosfera.ts` se detiene en 20 km.** El cap. 14 necesita 59 km y 68.9 km, y el reto §10.8
   necesita unidades imperiales. **Extender ISA hasta ~86 km** (mesosfera) es prerequisito de L12.
2. **No hay tablas de gas.** `A/A*`, `p0/p`, `T0/T`, `ν(M)`, relaciones de choque normal y oblicuo.
   Todo lo del cap. 10 y del cap. 13 depende de ellas.
3. **No hay solver de raíces para (10.32) bivaluada.** Requiere selección explícita de rama.
4. **`potencial.ts` da `Cp` incompresible pero nadie lo corrige.** P-G/K-T/Laitone son ~30 líneas y
   multiplican el valor de todo ese módulo.
5. **No hay `Cf` compresible.** Bloqueado por la Fig 19.1 (ver 7.1).
6. **No hay integrador de EDOs (RK4).** Lo necesitan Taylor-Maccoll (L10) y la capa límite integral
   (L13).

---

## 8. LO QUE MÁS ME SORPRENDIÓ

Lo que una lectura lineal se salta y aquí sí importa.

### 8.1 El método numérico más impresionante del bloque es el más barato

Mi expectativa al abrir el capítulo 13 era: "método de las características = CFD = GPU". **Es al
revés.** En 2-D irrotacional las ecuaciones de compatibilidad **colapsan a álgebra**
(`θ ± ν = const`), y un punto interno se resuelve con **dos promedios**. Una malla de 2500 nodos son
milisegundos.

Consecuencia de producto que no esperaba: **el diseño del contorno de una tobera supersónica —
"la" pregunta del capítulo 13, la que decide si un motor de cohete funciona— cabe entero en el
navegador, interactivo, en JS puro.** El alumno puede arrastrar el Mach de salida y ver la pared
redibujarse. Eso es literalmente lo que el cliente compró: diseño conceptual con retroalimentación
inmediata.

Y hay un giro pedagógico dentro: **la pared no la dibuja el alumno.** El alumno dibuja la sección de
expansión (que el libro dice que es arbitraria) y **la sección de enderezamiento EMERGE de la
condición de cancelación de ondas**. Es exactamente la doctrina del proyecto: *la forma emerge de la
física, no se presetea*.

### 8.2 El resultado más valioso de todo el bloque es una división

Prandtl-Glauert es `Cp = Cp,0/√(1−M∞²)`. Una división. Y convierte **toda** la base de datos
incompresible del cliente —y todo el solver de paneles que ya existe en `potencial.ts`— en algo
válido hasta Mach 0.7 con error del orden del 1 %.

Lo que no esperaba es **cómo** funciona. No es un ajuste empírico: la transformación
`ξ = x`, `η = βy`, `φ̄ = βφ̂` convierte la ecuación compresible **en la ecuación de Laplace**, y la
ec. (11.48) demuestra que **el perfil es el mismo en ambos espacios**. Es decir: existe un flujo
incompresible sobre el **mismo** perfil cuya solución, escalada por `β`, **es** la solución
compresible. La corrección no es una aproximación de ingeniería: es un **cambio de coordenadas
exacto** dentro de la teoría linealizada.

Y por eso mismo la paradoja de d'Alembert sobrevive: si escalas todos los `Cp` por la misma
constante, una integral que valía cero sigue valiendo cero. El arrastre de onda **no puede** aparecer
en esta teoría. Aparece solo cuando el flujo se vuelve localmente supersónico — es decir, **cuando
P-G ya dejó de valer**. La teoría te avisa de su propia muerte.

### 8.3 La "barrera del sonido" fue un artefacto de dividir entre cero

Esto me pareció la mejor historia de ingeniería del bloque. En 1936 un ingeniero mira (11.51), ve que
`Cp → ∞` cuando `M∞ → 1`, lo cruza con las primeras mediciones de túnel que muestran el `cd`
disparándose, y concluye que hay un muro. Ese error de razonamiento mató gente: Geoffrey deHavilland
hijo, 27 de septiembre de 1946, DH 108 Swallow — el epígrafe con el que Anderson **abre** el
capítulo 11.

Y el error era de **una línea**: P-G **no es válida en M∞ = 1**. La misma teoría que "predecía" la
barrera declara, en su derivación (p.747), que no aplica en `0.8 < M∞ < 1.2`.

La lección para La Forja es directa y dura: **una fórmula fuera de su dominio no da un número malo,
da una conclusión falsa**. Por eso el requisito de producto más importante que saqué de este bloque no
es una ecuación, es un comportamiento: **el software DEBE avisar cuando el usuario sale del dominio
declarado de la herramienta que está usando.** Y esa advertencia debe llevar la cita literal del libro.

### 8.4 Newton acertó por las razones equivocadas, y Anderson lo dice

`Cp = 2 sin²θ` viene de un modelo de 1687 que es físicamente falso: partículas con movimiento
puramente dirigido, sin movimiento térmico aleatorio. Newton lo aplicó a barcos y se equivocó.

Tres siglos después, resulta que es **el límite exacto** de la teoría de choque oblicuo cuando
`M∞ → ∞` **y** `γ → 1`. En ese doble límite la densidad tras el choque diverge, el choque **se pega
al cuerpo** (`β = θ`), y la ec. (14.38) exacta se convierte, término a término, en la ley del seno
cuadrado.

Pero el aire tiene `γ = 1.4`, no 1. Y Anderson escribe la frase más honesta del libro (p.895):

> *"the application of newtonian theory to practical hypersonic flow problems, where γ is always
> greater than unity, is theoretically not proper, and the agreement that is frequently obtained with
> experimental data has to be viewed as somewhat fortuitous."*

Un profesor habría dicho "y funciona muy bien". El **cliente** dice "funciona, no sabemos bien por
qué, úsalo con cuidado". Ese es exactamente el tono que debe tener la UI de La Forja.

Y el Ej. 14.1 lo cuantifica de una forma que no vi venir: newtoniano subpredice `cl` **y** `cd` en
36.6 %, y sin embargo da `L/D = 3.73` **exacto**. Por dos razones distintas y ambas instructivas:
(a) los dos errores son del mismo factor y se cancelan en el cociente, y (b) más de fondo, si la
resultante es normal a la placa, `L/D = cot α` **por geometría**, con cualquier teoría. Un método
puede estar 36 % equivocado en las magnitudes y ser exacto en la razón que decide el diseño.

### 8.5 En un caza supersónico, más de la mitad del arrastre es rozamiento

Toda la narrativa del vuelo supersónico gira alrededor de las ondas de choque. El Ej. 12.3 dice que
en el F-104 a Mach 2, en crucero, el **arrastre de fricción es el 60 %** del total y hunde `L/D` de
28.3 a **11.2** — a menos de la mitad.

Lo que lo hace estructural y no anecdótico: el arrastre de onda va como `α²`, la fricción no depende
(casi) de `α`. En crucero `α ≈ 2°`, y ahí la fricción domina. El cruce está en 2.47°. **Un avión
supersónico pasa su vida operativa del lado donde manda el rozamiento**, no las ondas.

Y el capítulo 14 lo lleva más lejos: para un vehículo de entrada atmosférica, la ec. (14.60) dice que
el **calor total** es proporcional a `C̄f/C_D`. Es decir, la fracción de fricción en el arrastre no
solo decide tu `L/D`: **decide si te derrites**. La misma cantidad, dos consecuencias en capítulos
distintos.

### 8.6 La forma correcta de resolver un problema estacionario es no resolverlo

El problema del cuerpo romo supersónico estuvo abierto desde los años 40. La razón: las ecuaciones
son **elípticas** donde el flujo es subsónico (detrás del choque, cerca de la nariz) e **hiperbólicas**
donde es supersónico (más afuera), en el mismo campo. Ningún método sabía manejar los dos a la vez.

La solución de finales de los 60 es contraintuitiva: **añadir una variable independiente**. Las
ecuaciones **no estacionarias** son hiperbólicas **en el tiempo** sin importar el Mach local. Así que
inventas un transitorio artificial, avanzas uniformemente en `t`, y **tiras el transitorio**: lo que
querías era el asintótico.

Es una lección de estrategia que va más allá de la aerodinámica: cuando un problema es intratable en
su propia formulación, a veces **agregar una dimensión lo hace fácil**. Y me sorprendió lo tarde que
llegó: 1969, MacCormack, y hasta entonces uno de los problemas más importantes de la aerodinámica
supersónica simplemente no se sabía resolver.

### 8.7 El bug de contabilidad, otra vez

En el pliego de moldes de Kazmer nos encontramos con "el bug de contabilidad": un dato bien calculado
que no llega al juez. Aquí está la versión aeroespacial, y costó mucho más.

Las Figs 14.18 y 14.19: la distribución de presión del transbordador con gas perfecto (`γ = 1.4`) y
con aire en equilibrio químico son **casi idénticas** — la presión es la variable menos afectada por
la química. Un ingeniero mira las dos curvas y concluye "no importa".

Pero el **momento de cabeceo** es la integral de la presión **por un brazo**. Diferencias mínimas en
la distribución (un poco más alta adelante, un poco más baja atrás) **se amplifican** al integrar con
brazo. Resultado: `Cm` sustancialmente distinto, y en los primeros vuelos el transbordador necesitó
**más del doble** de la deflexión prevista del *body flap* para equilibrarse. Anderson lo llama
*"an alarming situation."*

La lección de arquitectura para La Forja: **un juez integral (momento, calor total, `L/D`) puede ser
mucho más sensible que las cantidades locales de las que se calcula.** Comparar campos de presión a
ojo **no basta**. Hay que comparar los agregados que deciden el diseño.

### 8.8 El cliente cortó la punta a un P-51 y voló su túnel de viento

El Reto Integrado §11.16 es el mejor argumento de venta del pliego. 1946: no hay túneles transónicos
confiables y las ecuaciones son no lineales, así que no hay teoría. Los ingenieros de Langley montan
**un modelo pequeño, vertical, sobre el ala de un P-51**, en la burbuja de flujo localmente
supersónico que aparece cuando el caza pasa su Mach crítico en picada. Los instrumentos van en el
compartimento de munición vacío.

El avión **es** el túnel de viento. Con Mach de vuelo 0.76 obtienen Mach local **1.23** sobre el ala.

Y la cadena de cálculo que Anderson usa para verificarlo es **exactamente** la que La Forja debe
ejecutar en el navegador: (a) `Cp` incompresible del solver de paneles → (b) corrección de
Karman-Tsien → (c) inversión de la relación `Cp ↔ M` local. Resultado 1.23 contra 1.15 medido en
vuelo por Gilruth: **7 %**. Tres fórmulas cerradas, microsegundos, y le atinas al 7 % a un dato de
vuelo de 1947.

### 8.9 El puente que no esperaba: el factor 2

El §14.4 analiza una placa infinitamente delgada con la teoría de Newton y saca, en cinco líneas de
álgebra, que en el punto de máximo `L/D` el arrastre de onda es **exactamente el doble** del de
fricción (ec. 14.27).

Setenta páginas después, el §14.9.1 reporta el resultado de una optimización numérica de cinco
componentes (Taylor-Maccoll + método de características axisimétrico + capa límite integral con
transición + bordes romos + simplex de Nelder-Mead) sobre familias enteras de waveriders. Y el
hallazgo empírico es:

> *"the best optimum shape at any given M∞ results in the magnitudes of wave drag and skin-friction
> drag being approximately the same, never differing by more than a factor of 2."*

**El mismo factor 2.** Un resultado analítico trivial de la geometría más simple imaginable predice
la estructura del óptimo de una optimización numérica pesada sobre geometrías complejas.

Eso no es coincidencia: es la señal de que la física está bien planteada. Y es, para mí, el mejor
argumento del pliego a favor de la doctrina del proyecto: **construir desde fórmulas reales, con su
rango de validez declarado, hace que los resultados se ANCLEN unos con otros.** Un solver hecho de
curvas ajustadas nunca produce puentes como éste.

---

*Fin del bloque Anderson caps 10–14.*
