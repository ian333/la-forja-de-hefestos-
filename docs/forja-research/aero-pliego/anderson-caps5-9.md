# Anderson, *Fundamentals of Aerodynamics* 6ª ed., caps. 5–9 — De un perfil a un ala de verdad, y de ahí al supersónico

Fuente: `docs/forja-research/manuales/aero/txt/anderson.txt`, líneas 19628–31513 (leídas COMPLETAS, sin muestreo).
Cubre: cap. 5 (pp. 423–498), cap. 6 (pp. 499–524), cap. 7 (pp. 527–560), cap. 8 (pp. 561–612), cap. 9 (pp. 613–687).
Fecha del análisis: 2026-08-04. Autor del análisis: agente Opus (bloque Anderson 5–9) para el pliego AERO.

> **Aviso de método.** Todo lo que aquí se afirma cita § y página. Lo que NO está en el libro y yo agrego
> va marcado `[EXTENSIÓN DECLARADA]` con su motivo. Todo cálculo que hice para verificar al libro está
> reportado con su número, incluidos los tres casos donde **el libro no cuadra consigo mismo** (§3.9, §7).

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

Estos cinco capítulos son **la bisagra del libro**. El cap. 4 dejó al alumno con un perfil (2D). El cap. 5
lo convierte en un ala (3D) y le cobra el precio: el **arrastre inducido**. Los caps. 7–9 abren el mundo
compresible y le dan al ingeniero las relaciones exactas de choque y expansión.

| Cap. | Título | Qué le entrega al cliente |
|---|---|---|
| 5 | Incompressible Flow over Finite Wings (p.423) | **La teoría de línea sustentadora de Prandtl**: la ecuación integro-diferencial, su solución en serie de Fourier, C_L, C_Di, el factor e, el efecto del alargamiento AR y del estrechamiento λ. Más: método numérico no lineal (post-pérdida), teoría de superficie sustentadora, **vortex-lattice**, alas delta. |
| 6 | Three-Dimensional Incompressible Flow (p.499) | El **efecto de alivio tridimensional** (el 3D "sufre menos" que el 2D). La polar del avión completo C_D = C_D,o + C_L²/(πeAR), el factor de Oswald (fórmula empírica de **Raymer**), y (L/D)max en forma cerrada. |
| 7 | Compressible Flow: Preliminary Aspects (p.527) | La termodinámica mínima: gas perfecto, gas caloríficamente perfecto, 1ª y 2ª ley, entropía, **relaciones isentrópicas**, compresibilidad τ, condiciones totales (de remanso) T₀ p₀ ρ₀, y **el criterio M>0.3**. |
| 8 | Normal Shock Waves (p.561) | Velocidad del sonido, formas alternas de la ecuación de energía, y las **relaciones exactas del choque normal** en función de un solo parámetro: M₁. Más el tubo de Pitot supersónico (Rayleigh). |
| 9 | Oblique Shock and Expansion Waves (p.613) | **La relación θ-β-M** (Ec. 9.23), la abanico de **Prandtl-Meyer** (Ec. 9.42/9.43), reflexiones e intersecciones de choques, choque desprendido, **teoría choque-expansión** para perfiles supersónicos, y el diseño de la cola de cuña del X-15. |

**Por qué le importa al cliente (una empresa que diseña aeronaves):** Raymer (el cliente principal) le pide
al ingeniero de diseño conceptual un C_L y un C_D del ala en segundos, para hacer estudios de compromiso.
Anderson caps. 5–6 es **de dónde salen esos números**. Y caps. 7–9 es de dónde sale todo lo supersónico:
la entrada del motor, el arrastre de onda, el estampido sónico.

**El gancho pedagógico del cap. 5 está en su propia Preview Box (p.424):** el Beechcraft Baron 58 con su
perfil NACA 23015 a 4° tiene c_l = 0.54 y c_d = 0.0068. ¿El ALA tiene C_L = 0.54 y C_D = 0.0068?

> *"The answer is a resounding NO! Not even close!"* [Preview Box, p.424]

La respuesta correcta (Ej. 5.4, p.462) es C_L = 0.443 (18 % MENOS) y C_D = 0.0148 (más del DOBLE). Esa
sorpresa es la lección #1 de este bloque y es el arranque natural de la escuela.

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§] requisito (APRENDER / CONSTRUIR / ambos)`

### aero3d — línea sustentadora y arrastre inducido

| # | dominio | § | Requisito | Rol |
|---|---|---|---|---|
| R-01 | aero3d | §5.1 p.427 | El software debe distinguir **ángulo geométrico α**, **ángulo inducido α_i** y **ángulo efectivo α_eff = α − α_i** (Ec. 5.1) como tres cantidades separadas y mostrables por estación de envergadura. | ambos |
| R-02 | aero3d | §5.1 p.431 | El arrastre total del ala debe reportarse SIEMPRE partido: `C_D = c_d + C_D,i` (Ec. 5.4). c_d viene de datos de perfil; C_D,i lo calcula la teoría. Nunca un solo número opaco. | CONSTRUIR |
| R-03 | aero3d | §5.2 p.432 | Implementar la **ley de Biot-Savart** (Ec. 5.5) como primitiva del motor: velocidad inducida por un filamento de vórtice. Es el ladrillo de TODO lo 3D. | CONSTRUIR |
| R-04 | aero3d | §5.2 p.435 | Respetar los **teoremas de Helmholtz**: (1) la intensidad Γ de un filamento es constante a lo largo de él; (2) un filamento **no puede terminar en el fluido** — llega a la frontera o se cierra. Es la restricción que obliga a la herradura. | ambos |
| R-05 | aero3d | §5.3 p.441 | Implementar la **ecuación fundamental de Prandtl** (Ec. 5.23) como el solver de referencia del ala recta de alargamiento moderado/alto. | CONSTRUIR |
| R-06 | aero3d | §5.3.2 p.447 | Resolver Ec. (5.23) por **serie de Fourier** (Ec. 5.48) evaluada en N estaciones → sistema lineal de N×N en los A_n. | CONSTRUIR |
| R-07 | aero3d | §5.3.2 p.448 | `C_L = A₁·π·AR` (Ec. 5.53): **C_L depende SOLO del primer coeficiente**, pero hay que resolver todos los A_n a la vez para obtener A₁. El software debe advertirlo (es el error clásico del alumno). | ambos |
| R-08 | aero3d | §5.3.2 p.449 | `C_D,i = C_L²/(πAR)·(1+δ)` con `δ = Σ_{2..N} n(A_n/A₁)²` (Ecs. 5.60–5.61) y `e = 1/(1+δ)` (Ec. 5.62). δ ≥ 0 SIEMPRE. | CONSTRUIR |
| R-09 | aero3d | §5.3.1 p.444 | Caso distribución elíptica: `w = −Γ₀/2b` constante (Ec. 5.35), `α_i = C_L/(πAR)` constante (Ec. 5.42), `C_D,i = C_L²/(πAR)` (Ec. 5.43). Es el **caso de prueba analítico exacto** del solver: debe dar δ=0, e=1. | CONSTRUIR |
| R-10 | aero3d | §5.3.2 p.449 | Enunciar como resultado del software, no como dogma: *"the lift distribution which yields minimum induced drag is the elliptical lift distribution"* [p.449]. | APRENDER |
| R-11 | aero3d | §5.3.1 p.446 | Planta elíptica ⇒ distribución elíptica SOLO si no hay torcimiento geométrico ni aerodinámico (Ec. 5.45, p.446). El software debe verificar esa precondición antes de aplicar el atajo. | ambos |
| R-12 | aero3d | §5.3.3 p.451 | Pendiente de sustentación del ala finita: elíptica `a = a₀/(1+a₀/πAR)` (Ec. 5.69); general `a = a₀/(1+(a₀/πAR)(1+τ))` (Ec. 5.70). El ala SIEMPRE tiene menos pendiente que su perfil: **a < a₀**. | ambos |
| R-13 | aero3d | §5.3.3 p.452 | Escalado entre alargamientos a igual C_L: Ec. (5.65). Permite reusar datos de túnel de un AR en otro. | CONSTRUIR |
| R-14 | aero3d | §5.3.3 p.451 | *"the primary design factor for minimizing induced drag is not the closeness to an elliptical lift distribution, but rather, the ability to make the aspect ratio as large as possible"* [p.451]. **AR pesa mucho más que λ.** | APRENDER |
| R-15 | aero3d | Design Box p.464 | El **arrastre inducido como FUERZA** en vuelo recto y nivelado no depende de AR sino de la **carga de envergadura W/b**: `D_i = (1/πeq∞)(W/b)²` (Ec. 5.74). Distinguir C_D,i (coeficiente) de D_i (fuerza) es requisito duro. | ambos |
| R-16 | aero3d | Design Box p.464 | Presupuesto de arrastre: el inducido es *"about 25 percent of the total drag at cruise, but can be 60 percent or more of the total drag at takeoff"* [p.465]. El software debe graficar ese reparto en función de C_L. | CONSTRUIR |
| R-17 | aero3d | §5.4 p.465 | Método **numérico no lineal** de línea sustentadora (9 pasos, p.465-467) para α más allá de la pérdida, usando la curva c_l(α_eff) REAL del perfil, con amortiguamiento D≈0.05 y 50–150 iteraciones. | CONSTRUIR |
| R-18 | aero3d | §5.4 p.468 | Advertir el límite: a α alto *"the flow is highly three-dimensional... the basic assumptions of lifting-line theory, classical or numerical, cannot properly account for such three-dimensional flows"* [p.469]. Precisión ~20 % post-pérdida. | ambos |
| R-19 | aero3d | §5.5 p.469 | Para **AR bajo, ala en flecha y ala delta**, la línea sustentadora clásica NO aplica (Fig. 5.32); usar teoría de superficie sustentadora / **vortex-lattice**. El software debe DETECTAR el caso y avisar. | ambos |
| R-20 | aero3d | §5.5 p.473 | Vortex-lattice: panel trapezoidal, vórtice de herradura con el segmento ligado a **l/4** del frente del panel y **punto de control a 3l/4**, condición de tangencia en cada punto de control → sistema lineal en Γ_n. | CONSTRUIR |
| R-21 | aero3d | Design Box p.474 | **Helmbold** para AR bajo: `a = a₀/(√(1+(a₀/πAR)²) + a₀/(πAR))` (Ec. 5.81), *"remarkably accurate for wings with AR < 4"*. Regla de dedo del libro: la línea sustentadora simple vale solo para **AR > 4**. | ambos |
| R-22 | aero3d | Design Box p.474 | **Küchemann** para ala en flecha: Ec. (5.82) con Λ referida a la **línea de medias cuerdas** (Fig. 5.38). Válida solo incompresible. | CONSTRUIR |
| R-23 | aero3d | §5.6 p.476 | Ala delta a baja velocidad: vórtices de borde de ataque, succión, `dC_L/dα ≈ 0.05/°`, pérdida a ~35°, C_L,max ≈ 1.3, (L/D)max ≈ 9.3 con borde afilado vs 16.5 con borde redondeado. | APRENDER |
| R-24 | aero3d | §5.6 p.485 | Ruptura de vórtice (*vortex breakdown*): al romperse, *"the lift and pitching moment of the delta wing decrease, the flow becomes unsteady, and buffeting of the wing occurs"* [p.485]. | APRENDER |

### aero3d — avión completo (cap. 6)

| # | dominio | § | Requisito | Rol |
|---|---|---|---|---|
| R-25 | aero3d | §6.4 p.506 | **Efecto de alivio 3D**: esfera `V_θ = 1.5 V∞ sinθ` (Ec. 6.19) y `C_p = 1 − (9/4)sin²θ` (Ec. 6.20) vs cilindro `2V∞` y `1−4sin²θ`. El 3D "sufre menos". | ambos |
| R-26 | aero3d | §6.7.1 p.513 | La sustentación de la combinación ala-fuselaje **NO es la suma**, pero para subsónico se puede tomar como la del ala completa (incluida la parte tapada por el fuselaje) para d/b de 0 a 6. | CONSTRUIR |
| R-27 | aero3d | §6.7.1 p.513 | *"There is no accurate analytical equation that can predict the lift of a wing-body combination"* [p.513]. **El software NO debe fingir precisión aquí**: túnel, CFD o vuelo. | ambos |
| R-28 | aero3d | §6.7.2 p.515 | Polar del avión: `C_D = C_D,o + C_L²/(πeAR)` (Ec. 6.24), con **e = factor de Oswald del avión** (0.7–0.85 típico), distinto del factor de envergadura del ala (0.9–1.0). Nombrarlos distinto en el código o habrá bugs. | CONSTRUIR |
| R-29 | aero3d | §6.7.2 p.515 | Oswald empírico de **Raymer** (Ref. 113): `e = 1.78(1 − 0.045·AR^0.68) − 0.64` (Ec. 6.25). **NO usar para AR ≳ 25** (planeadores). | CONSTRUIR |
| R-30 | aero3d | §6.7.2 p.518 | En (L/D)max se cumple `C_D,o = C_L²/(πeAR)` (Ec. 6.27): **el arrastre parásito iguala al inducido**. Y `(L/D)max = √(πeAR·C_D,o)/(2C_D,o)` (Ec. 6.29). | ambos |
| R-31 | aero3d | §6.7.3 p.521 | Referencia dura sobre CFD: en el caso CAWAPI (F-16XL, M=0.36, α=11.85°), 7 códigos dieron **6.7 % de dispersión en C_L pero 21.5 % en C_D** (Tabla 6.1). El software debe declarar esa asimetría de confianza. | APRENDER |

### compresible — termodinámica, choques, expansiones

| # | dominio | § | Requisito | Rol |
|---|---|---|---|---|
| R-32 | compresible | §7.2.1 p.530 | Gas perfecto `p = ρRT` (Ec. 7.1), R_aire = 287 J/(kg·K) = 1716 ft·lb/(slug·°R). | CONSTRUIR |
| R-33 | compresible | §7.2.2 p.531 | Gas **caloríficamente** perfecto: `e = c_v T`, `h = c_p T` (Ecs. 7.6a,b), `c_p = γR/(γ−1)` (7.9), `c_v = R/(γ−1)` (7.10). Válido para aire **T < 1000 K**. | ambos |
| R-34 | compresible | §7.2.5 p.539 | Isentrópico: `p₂/p₁ = (ρ₂/ρ₁)^γ = (T₂/T₁)^(γ/(γ−1))` (Ec. 7.32). *"make certain to brand it on your mind"* [p.539]. | CONSTRUIR |
| R-35 | compresible | §7.4 p.545 | **Bernoulli PROHIBIDO en flujo compresible.** *"Do not do it!"* [p.545]. El software debe bloquear el uso de Bernoulli cuando M > 0.3 y explicar por qué. | ambos |
| R-36 | compresible | §7.5 p.547 | `h + V²/2 = h₀ = const` (Ec. 7.54) a lo largo de una línea de corriente en flujo estacionario, adiabático, no viscoso. Si todas las líneas vienen de la misma corriente libre, **h₀ constante en todo el campo** (Ec. 7.55). | CONSTRUIR |
| R-37 | compresible | §7.5 p.548 | Distinguir 4 escenarios (Fig. 7.4): adiabático/no-adiabático (h₀, T₀) e isentrópico/no-isentrópico (p₀, ρ₀). h₀ se conserva en el choque; **p₀ NO**. | ambos |
| R-38 | compresible | §8.3 p.570 | `a = √(∂p/∂ρ)_s` (Ec. 8.18) → gas caloríficamente perfecto: `a = √(γRT)` (Ec. 8.25). **La velocidad del sonido depende SOLO de T.** a_nivel_mar = 340.9 m/s = 1117 ft/s. | ambos |
| R-39 | compresible | §8.3 p.571 | `a = √(1/(ρτ_s))` (Ec. 8.27): a mayor compresibilidad, menor velocidad del sonido. Fluido incompresible ⇒ a = ∞ ⇒ M = 0. **Los caps. 3–6 son flujos de Mach cero.** | APRENDER |
| R-40 | compresible | §8.4 p.579 | `T₀/T = 1 + ((γ−1)/2)M²` (8.40), `p₀/p = [·]^(γ/(γ−1))` (8.42), `ρ₀/ρ = [·]^(1/(γ−1))` (8.43). Estas tres son función de **M y γ únicamente**. | CONSTRUIR |
| R-41 | compresible | §8.4 p.580 | Valores sónicos para γ=1.4: `T*/T₀ = 0.833`, `p*/p₀ = 0.528`, `ρ*/ρ₀ = 0.634`. | CONSTRUIR |
| R-42 | compresible | §8.5 p.586 | Criterio de compresibilidad: **M > 0.3 ⇒ compresible**. Justificación: para M<0.32 la densidad se desvía menos de 5 % (Fig. 8.6). *"Incompressible flow is really a myth"* [p.584]. | ambos |
| R-43 | compresible | §8.6 p.588 | **Relación de Prandtl** `a*² = u₁u₂` (Ec. 8.55) ⇒ `M*₂ = 1/M*₁` (8.57). Es el corazón algebraico del choque normal. | APRENDER |
| R-44 | compresible | §8.6 p.588-589 | Choque normal, todo en función de M₁ ÚNICAMENTE: M₂ (8.59), ρ₂/ρ₁ = u₁/u₂ (8.61), p₂/p₁ (8.65), T₂/T₁ (8.67), Δs (8.68), p₀,₂/p₀,₁ = e^(−Δs/R) (8.73). | CONSTRUIR |
| R-45 | compresible | §8.6 p.591 | **La 2ª ley prohíbe M₁ < 1.** Con M₁<1 la Ec. (8.68) da Δs<0. *"normal shock waves can occur only in supersonic flow"* [p.591]. El software debe rechazar M₁<1, no devolver un número. | ambos |
| R-46 | compresible | §8.6 p.590 | Límites M₁→∞ (γ=1.4): M₂ → 0.378, ρ₂/ρ₁ → 6, pero p₂/p₁ → ∞ y T₂/T₁ → ∞. **La densidad satura; la presión y temperatura no.** | APRENDER |
| R-47 | compresible | §8.7.2 p.605 | **Fórmula de Rayleigh del tubo de Pitot** (Ec. 8.80): en supersónico el Pitot lee p₀,₂ (detrás del choque), no p₀,₁. Un Pitot mal interpretado da una velocidad falsa. | ambos |
| R-48 | compresible | §9.1 p.618 | **Ángulo de Mach** `μ = arcsin(1/M)` (Ec. 9.1). Una onda de Mach es un choque oblicuo infinitamente débil. | CONSTRUIR |
| R-49 | compresible | §9.2 p.623 | *"changes across an oblique shock wave are governed only by the component of velocity normal to the wave"*, con `M_n,1 = M₁ sin β` (Ec. 9.13). **Reusar TODAS las relaciones del choque normal cambiando M₁ → M_n,1.** | ambos |
| R-50 | compresible | §9.2 p.621 | `w₁ = w₂` (Ec. 9.5): la componente tangencial NO cambia al cruzar el choque oblicuo. | APRENDER |
| R-51 | compresible | §9.2 p.624 | **La relación θ-β-M** (Ec. 9.23). El software debe implementarla, no leer la Figura 9.9. | CONSTRUIR |
| R-52 | compresible | §9.2 p.624 | Existe **θ_max(M₁)**: si θ > θ_max no hay solución de choque recto adherido → **choque curvo desprendido** (Fig. 9.10). El software debe DEVOLVER ESE ESTADO, no un número. θ_max → 45.5° cuando M₁→∞. | ambos |
| R-53 | compresible | §9.2 p.627 | Para cada θ < θ_max hay **DOS** soluciones: débil (β menor) y fuerte (β mayor). *"In nature, the weak shock solution usually prevails"* [p.628]. Detrás del débil M₂>1 casi siempre; detrás del fuerte M₂<1 siempre. | ambos |
| R-54 | compresible | §9.2 p.628 | A θ fijo, si M₁ ↑ entonces β ↓ **pero el choque se hace MÁS FUERTE** (M_n,1 ↑). Es contraintuitivo y hay que enseñarlo. | APRENDER |
| R-55 | compresible | §9.2 p.630 | **Prohibido** usar la columna `p₀,₂/p₁` del Apéndice B con M_n,1 en un choque oblicuo: da un resultado *"totally incorrect"* (3.805 atm en vez de 7.00 atm en el Ej. 9.2). La columna `p₀,₂/p₀,₁` SÍ se puede usar con M_n,1. | ambos |
| R-56 | compresible | §9.3 p.635 | **Cuña ≠ cono.** A igual semiángulo 20° y M=2: cuña β=53.3°, cono β=37°; el cono desvía solo 8° y las líneas de corriente se CURVAN entre el choque y la superficie. La teoría del cap. 9 es exacta para la cuña, NO para el cono. | ambos |
| R-57 | compresible | §9.4 p.640 | Reflexión de choque en pared: el choque reflejado es **más débil** que el incidente (ve un M₂ menor a igual θ) ⇒ Φ ≠ β₁, la reflexión **no es especular**. | ambos |
| R-58 | compresible | §9.4 p.641 | Si M₂ ya no admite la deflexión θ, la reflexión regular es imposible → **reflexión de Mach** (Fig. 9.20): choque normal en la pared + choque reflejado curvo. Requiere métodos numéricos. | ambos |
| R-59 | compresible | §9.5.1 p.648 | Detrás de un choque CURVO hay **gradiente de entropía** ⇒ por el teorema de Crocco `T∇s = ∇h₀ − V×(∇×V)`, con ∇h₀=0, la **vorticidad es finita**: no existe potencial de velocidad. El software no puede usar φ ahí. | ambos |
| R-60 | compresible | §9.6 p.653 | **Función de Prandtl-Meyer** ν(M) (Ec. 9.42) y `θ = ν(M₂) − ν(M₁)` (Ec. 9.43). La expansión es **isentrópica**: p₀ y T₀ constantes. | CONSTRUIR |
| R-61 | compresible | §9.6 p.649 | El abanico está acotado por μ₁ = arcsin(1/M₁) aguas arriba y μ₂ = arcsin(1/M₂) aguas abajo. El software debe dibujar ambas líneas de Mach. | CONSTRUIR |
| R-62 | compresible | §9.6 Design Box p.658 | La **compresión isentrópica** usa la MISMA Ec. (9.42) con ν decreciente. Es mucho más eficiente que el choque, pero *"the contour of the body surface must be a specific shape for a specific upstream Mach number"*; fuera de diseño degenera en choques. | ambos |
| R-63 | compresible | §9.7 p.661 | **Teoría choque-expansión**: para cuerpos de segmentos rectos sin choque desprendido, la presión superficial es EXACTA. Placa plana: L' = (p₃−p₂)c·cosα (9.47), D' = (p₃−p₂)c·sinα (9.48). Rombo: D' = (p₂−p₃)t (9.49). | CONSTRUIR |
| R-64 | compresible | §9.7 p.663 | **En supersónico NO hay paradoja de d'Alembert**: el arrastre de onda es finito y viene del aumento de entropía / pérdida de p₀ a través de los choques. | ambos |
| R-65 | compresible | §9.3.1 p.638 y §9.8 p.664 | Para flujo no viscoso, `c_l` y `c_d` dependen SOLO de forma, α y M∞ — no hacen falta p∞ ni V∞. Es la verificación del análisis dimensional. | ambos |
| R-66 | compresible | §9.9 p.664 | Caso de diseño real: la **cola de cuña de 10° del X-15** da ~2× la fuerza lateral de un perfil delgado a igual α porque arranca ya con deflexión ⇒ β mayor ⇒ p/p₁ mayor (la presión escala ≈ con el cuadrado del ángulo de onda). | ambos |
| R-67 | viscoso | §9.10 p.669 | **Interacción choque / capa límite**: el choque impone un gradiente adverso severo → separación AGUAS ARRIBA del punto de impacto teórico (≈ 4 espesores de capa límite, Fig. 9.41a), choque de separación, choque de readherencia, y **pico de transferencia de calor en la readherencia** (hasta un orden de magnitud). | ambos |
| R-68 | compresible | §9.14 p.678 | **Estampido sónico**: onda en N (Fig. 9.43). Δt entre booms = λ/V∞; si Δt < ~0.1 s el oído humano oye uno solo. Límite de diseño histórico Δp = 2 lb/ft²; *"This was an error in judgment"* [p.679]. Mitigación por forma: nariz afilada, fuselaje esbelto, estrechamiento tipo regla de áreas, y **suavizar el tiempo de subida**. | ambos |
| R-69 | escuela | §5.1, §5.3, §9.7 | Cada lección debe cerrar contra un **número del libro** (ver §3 FIXTURES). Ningún módulo se da por terminado sin su fixture verde. | CONSTRUIR |

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

### 2.1 LA TEORÍA DE LÍNEA SUSTENTADORA DE PRANDTL — formulación completa e implementable

Esto es el corazón del bloque. Queda escrito para implementarse **sin reabrir el libro**.

#### 2.1.1 Los ladrillos

**Ley de Biot-Savart** [Ec. 5.5, §5.2 p.432]:

```
dV = (Γ/4π) · (dl × r)/|r|³
```

Casos cerrados que el libro deriva y que necesitas:

| Caso | Resultado | Ec. | Página |
|---|---|---|---|
| Filamento recto INFINITO, distancia perpendicular h | `V = Γ/(2πh)` | 5.10 | 434 |
| Filamento recto SEMI-INFINITO desde A, P en el plano ⊥ por A | `V = Γ/(4πh)` | 5.11 | 435 |

Nota: la Ec. (5.10) coincide con el vórtice puntual 2D, Ec. (3.105). El factor **1/2** entre (5.10) y (5.11)
es lo que hace que la línea sustentadora tenga su 1/4π característico.

**Teoremas de Helmholtz** [§5.2 p.435]:
1. La intensidad de un filamento de vórtice es constante a lo largo de él.
2. Un filamento de vórtice **no puede terminar en el fluido**; llega hasta las fronteras (que pueden ser ±∞) o forma un camino cerrado.

Es (2) lo que obliga a que el vórtice ligado que representa al ala se prolongue como dos vórtices libres
aguas abajo: el **vórtice de herradura** [Fig. 5.12, p.436].

#### 2.1.2 Por qué una sola herradura NO sirve

Con una sola herradura de intensidad Γ y envergadura b, el downwash sobre la línea ligada es
[Ecs. 5.12–5.13, p.437]:

```
w(y) = − Γ/(4π(b/2 + y)) − Γ/(4π(b/2 − y))  =  − (Γ/4π) · b/((b/2)² − y²)
```

que **tiende a −∞ en las puntas** (y → ±b/2). Físicamente imposible. El libro dice que *"this problem
perplexed Prandtl and his colleagues"* durante varios años [p.437].

#### 2.1.3 La línea sustentadora

La solución: superponer **infinitas herraduras de intensidad infinitesimal dΓ**, todas con sus segmentos
ligados sobre una misma recta — la **línea sustentadora** [Fig. 5.14–5.15, pp. 438-439]. Entonces:

- Γ = Γ(y) varía continuamente a lo largo de la envergadura.
- La intensidad del vórtice libre que sale en y es exactamente **dΓ = (dΓ/dy) dy**.
- La estela es una **lámina de vórtices** paralela a V∞, de intensidad neta cero integrada en la envergadura.

Downwash inducido en y₀ por toda la lámina [Ec. 5.15, p.439]:

```
                1     ⌠ b/2  (dΓ/dy) dy
   w(y₀) = − ────── ⌡ −b/2  ──────────
               4π                y₀ − y
```

Ángulo inducido, con la aproximación de ángulo pequeño [Ecs. 5.16–5.18, p.440]:

```
   α_i(y₀) = arctan(−w(y₀)/V∞) ≈ −w(y₀)/V∞

                 1      ⌠ b/2  (dΓ/dy) dy
   α_i(y₀) = ───────  ⌡ −b/2  ──────────
              4π V∞                y₀ − y
```

**Rango de validez de esa aproximación:** *"Generally, w is much smaller than V∞, and hence α_i is a small
angle, on the order of a few degrees at most"* [p.440]. Se rompe con AR muy bajo y/o C_L muy alto, donde
α_i deja de ser pequeño (ej.: U-2 en crucero, C_L cerca de la pérdida).

#### 2.1.4 LA ECUACIÓN FUNDAMENTAL

Uniendo α_eff = α − α_i (5.1), el perfil local c_l = a₀(α_eff − α_L=0) (5.19), y Kutta-Joukowski
L' = ρ∞V∞Γ = ½ρ∞V∞²c·c_l (5.20):

```
                    Γ(y₀)                        1      ⌠ b/2  (dΓ/dy) dy
   α(y₀)  =  ───────────────  +  α_L=0(y₀)  +  ───────  ⌡ −b/2  ──────────         (5.23)
              π V∞ c(y₀)                        4π V∞                y₀ − y
```

**Ecuación integro-diferencial. Única incógnita: Γ(y).** Todo lo demás (α, c, V∞, α_L=0) es dato de la
geometría del ala. En palabras del libro: *"it simply states that the geometric angle of attack is equal
to the sum of the effective angle plus the induced angle of attack"* [p.441].

> **Cuidado con el 2π escondido.** El término `Γ/(πV∞c)` sale de haber sustituido **a₀ = 2π** (teoría de
> perfil delgado) en la Ec. (5.19): *"the local section lift slope a₀ has been replaced by the thin airfoil
> theoretical value of 2π (rad⁻¹)"* [p.440]. Para un a₀ medido distinto de 2π hay que usar
> `2Γ/(a₀V∞c)` en su lugar. `[EXTENSIÓN DECLARADA — generalización directa de la Ec. (5.19)
> sustituyendo a₀ en vez de 2π; motivo: el cliente usa perfiles NACA reales con a₀ ≈ 5.7–6.5 /rad, no 2π.]`

**Qué sale de la solución Γ(y)** [pp. 441-442]:

| Cantidad | Fórmula | Ec. |
|---|---|---|
| Distribución de sustentación | `L'(y₀) = ρ∞ V∞ Γ(y₀)` | 5.24 |
| Sustentación total | `L = ρ∞V∞ ∫ Γ dy` | 5.25 |
| Coeficiente de sustentación | `C_L = (2/(V∞S)) ∫ Γ dy` | 5.26 |
| Arrastre inducido | `D_i = ρ∞V∞ ∫ Γ(y)α_i(y) dy` | 5.29 |
| Coef. arrastre inducido | `C_D,i = (2/(V∞S)) ∫ Γ α_i dy` | 5.30 |

#### 2.1.5 Caso cerrado: distribución elíptica

Postulando `Γ(y) = Γ₀ √(1 − (2y/b)²)` [Ec. 5.31, p.442] — no se DERIVA, se ESTIPULA — sale, usando la
integral estándar de Glauert (Ec. 4.26):

| Resultado | Fórmula | Ec. | p. |
|---|---|---|---|
| Downwash **constante** en toda la envergadura | `w = −Γ₀/(2b)` | 5.35 | 443 |
| Ángulo inducido **constante** | `α_i = Γ₀/(2bV∞) = C_L/(πAR)` | 5.36 / 5.42 | 443-444 |
| Γ₀ en función de C_L | `Γ₀ = 2V∞ S C_L/(bπ)` | 5.40 | 444 |
| **Arrastre inducido** | `C_D,i = C_L²/(πAR)` | 5.43 | 444 |
| Pendiente del ala | `a = a₀/(1 + a₀/(πAR))` | 5.69 | 455 |

con **AR ≡ b²/S** [p.444].

Consecuencia geométrica [Ec. 5.45, p.446]: si además NO hay torcimiento geométrico (α constante) ni
aerodinámico (α_L=0 constante), entonces c_l es constante en la envergadura y **la cuerda debe variar
elípticamente** ⇒ planta elíptica. **Ese "si" es una precondición dura, no un adorno.**

**Qué se rompe fuera:** con torcimiento (washout/washin) o con perfiles distintos a lo largo de la
envergadura, la planta elíptica ya NO produce distribución elíptica, y las Ecs. (5.42)/(5.43) dejan de valer.

#### 2.1.6 Caso general: LA SERIE DE FOURIER — el algoritmo

Cambio de variable [Ec. 5.46, p.447]: `y = −(b/2) cos θ`, con θ ∈ [0, π]. En esa variable la elíptica es
`Γ = Γ₀ sin θ` (5.47) — lo que sugiere una serie de senos:

```
                    N
   Γ(θ) = 2 b V∞   Σ  A_n sin(n θ)                                                  (5.48)
                   n=1
```

Sustituyendo (5.48) y su derivada (5.49) en la ecuación fundamental (5.23) y usando otra vez la integral
de Glauert, se obtiene **la ecuación de colocación** [Ec. 5.51, p.447]:

```
              2b     N                          N            sin(nθ₀)
   α(θ₀) = ────────  Σ A_n sin(nθ₀) + α_L=0(θ₀) + Σ  n A_n · ─────────              (5.51)
            π c(θ₀) n=1                        n=1            sin(θ₀)
```

**El algoritmo, paso a paso** (esto es lo implementable):

1. Elige N términos. Escoge N estaciones de colocación θ₀,k ∈ (0, π).
   Para un ala **simétrica sin torcimiento** solo sobreviven los armónicos IMPARES: usa
   `n = 1, 3, 5, …, 2N−1` y coloca en `θ₀,k = k·(π/2)/N`, k = 1…N (semiala).
   `[EXTENSIÓN DECLARADA — el libro dice "let us choose N different spanwise stations" (p.447) sin
   especificar cuáles; la elección impar+semiala es la práctica estándar y la verifiqué numéricamente.]`
2. Arma la matriz M[k][i] con n = n_i, θ₀ = θ₀,k:
   ```
   M[k][i] = (4b/(a₀ c(θ₀,k))) · sin(n_i θ₀,k)  +  n_i · sin(n_i θ₀,k)/sin(θ₀,k)
   ```
   (con a₀ = 2π queda el `2b/(πc)` del libro).
3. Lado derecho: `rhs[k] = α(θ₀,k) − α_L=0(θ₀,k)`. **Aquí entran el torcimiento geométrico y el
   aerodinámico**, uno por estación.
4. Resuelve el sistema lineal N×N → los A_n.
5. Cosecha:
   ```
   C_L   = A₁ · π · AR                                                   (5.53)
   δ     = Σ_{n=2..N}  n (A_n/A₁)²                                       (5.60)
   e     = 1/(1 + δ)                                                     (5.62)
   C_D,i = C_L²(1+δ)/(πAR) = C_L²/(π e AR)                               (5.61)/(5.62)
   α_i(θ) = Σ n A_n sin(nθ)/sin(θ)                                       (5.57)
   Γ(θ)  = 2bV∞ Σ A_n sin(nθ)                                            (5.48)
   L'(y) = ρ∞ V∞ Γ                                                       (5.24)
   ```

**Geometría del ala estrechada, en variable θ** `[EXTENSIÓN DECLARADA — álgebra elemental a partir de
AR ≡ b²/S (p.444) y de la definición de estrechamiento λ ≡ c_t/c_r (p.450 y Fig. 5.38)]`:

```
   c_r = 2b/(AR(1+λ))
   c(θ) = c_r [1 − (1−λ)|cos θ|]
   2b/(π c(θ)) = AR(1+λ) / (π(1 − (1−λ)|cos θ|))
```

**Verificación que YO corrí** (implementé el algoritmo y lo probé):

| Caso | δ calculado | e calculado | a calculado | Contraste |
|---|---|---|---|---|
| Planta **elíptica**, AR=8 | **0.0000** | **1.0000** | **5.0265 /rad** | Ec. (5.69) da exactamente 5.0265 ✅ |
| AR=8, λ=0.8 | 0.0444 | 0.9575 | 4.8919 | libro (Fig. 5.20): δ=0.055 |
| AR=7.61, λ=0.45 | 0.0137 | 0.9865 | 4.9222 | libro (Fig. 5.20): δ=0.01 |
| AR=10, rectangular | 0.0859 | 0.9209 | 5.0468 | libro (Ej. 5.2): δ=0.105 |

El caso elíptico cierra **exacto** contra la Ec. (5.69) — esa es la prueba de aceptación del solver.
Los casos estrechados quedan del mismo orden que los que el libro **lee de la Figura 5.20**, pero
sistemáticamente ~15–20 % por debajo. **La Figura 5.20 es imagen y NO la pude leer** (ver §7): no puedo
resolver la discrepancia desde el texto. Recomendación al cliente: **calcular δ con la Ec. (5.60)** (que es
del propio libro y es autoconsistente) y exponer el δ de carta como override manual.

Convergencia medida (AR=7.61, λ=0.45): N=2 → δ=0.0050; N=4 → 0.0121; N=8 → 0.0138; N=16 → 0.0137;
N=32 → 0.0137. **Con N=8 términos impares ya converge a 3 decimales.** (Glauert usó 4 términos en 1926;
McCormick usó el equivalente a 50 [p.450].)

#### 2.1.7 El factor τ — un hueco del libro que sí se puede tapar

El libro da `a = a₀/(1 + (a₀/πAR)(1+τ))` [Ec. 5.70, p.455] y dice solamente: *"τ is a function of the
Fourier coefficients A_n. Values of τ were first calculated by Glauert... Values of τ typically range
between 0.05 and 0.25"* [p.456]. **No da la fórmula de τ.** Por eso los Ejemplos 5.1, 5.2 y 5.4 tienen que
suponer `δ = τ`.

`[EXTENSIÓN DECLARADA]` Despejando τ de la Ec. (5.70) con la `a` que ya sale del solver de Fourier:

```
   τ = (a₀/a − 1)·(π AR/a₀) − 1
```

Valores que obtuve con el solver:

| AR | λ | a₀ | a | δ (5.60) | **τ (derivado)** |
|---|---|---|---|---|---|
| 8 | 0.8 | 2π | 4.8919 | 0.0444 | **0.1376** |
| 7.61 | 0.45 | 6.47 | 5.0373 | 0.0131 | **0.0510** |
| 6 | 1.0 | 2π | 4.5304 | 0.0483 | **0.1607** |
| 10 | 1.0 | 2π | 5.0468 | 0.0859 | **0.2249** |
| 7.96 | 1.0 | 5.73 | 4.4890 | 0.0744 | **0.2065** |

Todos caen **dentro del rango 0.05–0.25 que declara el libro** ✅ — eso valida la derivación. Y muestran
que **τ ≈ 3δ**, es decir: **la suposición δ = τ que el libro usa en sus ejemplos NO es física**, es una
comodidad por no tener la fórmula. Impacto: en el Ej. 5.4 con τ=0.051 real en vez de 0.01, a pasa de
5.08 a 5.04 /rad y C_L de 0.443 a 0.4395 (~1 %). A AR bajo el error crece.

#### 2.1.8 Efecto del alargamiento y del estrechamiento — la lección de diseño

- `C_D,i ∝ 1/AR` [Ec. 5.43/5.62]. *"to reduce the induced drag, we want a finite wing with the highest
  possible aspect ratio"* [p.445]. Pero: *"the design of very high aspect ratio wings with sufficient
  structural strength is difficult"* [p.445]. Compromiso: AR típico **6 a 8** en aviones subsónicos
  convencionales; U-2 = 14.3; planeadores hasta 51.3 (ETA, 2000).
- δ varía **solo ~10 %** en el rango práctico de λ, mientras AR va de 6 a 22 [p.451]. Conclusión del libro:
  *"the primary design factor... is not the closeness to an elliptical lift distribution, but rather, the
  ability to make the aspect ratio as large as possible"* [p.451].
- `C_D,i ∝ C_L²` ⇒ el inducido explota a baja velocidad. *"Even at relatively high cruising speeds,
  induced drag is typically 25 percent of the total drag"* [p.445] y **60 % o más en despegue** [p.465].
- Mi barrido δ(λ) para AR=8 (sustituto calculable de la Figura 5.20 que no pude leer):

  | λ | 0.0 | 0.1 | 0.2 | **0.3** | **0.4** | 0.5 | 0.6 | 0.8 | 1.0 |
  |---|---|---|---|---|---|---|---|---|---|
  | δ | 0.156 | 0.057 | 0.025 | **0.014** | **0.013** | 0.017 | 0.025 | 0.044 | 0.068 |

  **El mínimo está cerca de λ ≈ 0.35–0.4** y ahí δ ≈ 0.013 ⇒ e ≈ 0.987, es decir a **1.3 % del óptimo
  elíptico**. Eso confirma cuantitativamente lo que el libro afirma en prosa: *"the tapered wing... can
  yield a near-optimum lift distribution, with induced drag coefficients only a few percent higher than
  the elliptical wing"* [Design Box, p.462].

**Por qué el Spitfire tuvo ala elíptica** [Design Box, p.462]: **no fue por aerodinámica.** Mitchell
necesitaba cuerda suficiente lejos del eje para meter ocho ametralladoras 0.303 fuera del disco de la
hélice. La eficiencia aerodinámica fue *"only a by-product of a practical design solution"*, y el ala
elíptica *"contributed to production delays in the critical months before the beginning of World War II"*.
Beneficio secundario real: la cuerda grande permitió perfil delgado (13 % raíz, 7 % punta) manteniendo
espesor absoluto estructural ⇒ mayor Mach crítico ⇒ el Spitfire alcanzaba M=0.92 en picada.

#### 2.1.9 El arrastre inducido: de dónde sale, físicamente

Tres explicaciones del mismo fenómeno [§5.1, pp. 428-430]:

1. **Vector de sustentación inclinado.** El downwash inclina el viento relativo local hacia abajo un
   ángulo α_i; la sustentación local es ⊥ a ESE viento, así que tiene componente en dirección de V∞.
2. **Desequilibrio de presión.** El campo 3D de los vórtices de punta altera la distribución de presión
   de tal forma que queda un desbalance neto en dirección de V∞. En ese sentido es un **arrastre de presión**.
3. **Energía.** *"The wing-tip vortices contain a large amount of translational and rotational kinetic
   energy. This energy has to come from somewhere; indeed, it is ultimately provided by the aircraft
   engine... Since the energy of the vortices serves no useful purpose, this power is essentially lost"* [p.430].

Y el remate conceptual [p.430]: con flujo **no viscoso e incompresible**, un ala finita **igual tiene
arrastre**. `d'Alembert’s paradox does not occur for a finite wing.`

**El giro de la Design Box (p.464) que casi nadie enseña:** en vuelo recto y nivelado, la **fuerza** de
arrastre inducido no depende explícitamente de AR:

```
   D_i = (1/(π e q∞)) · (W/b)²                                                       (5.74)
```

`W/b` es la **carga de envergadura**. Como S suele quedar fijada por la velocidad de pérdida
(Ec. 1.47: `V_stall = √(2W/(ρ∞ S C_L,max))`), aumentar b sube AR y baja D_i a la vez — pero el parámetro
que manda en la FUERZA es W/b. *"this is the message in Equation (5.74)"* [p.464].

### 2.2 EL VORTEX-LATTICE

**Lo que el libro SÍ da** [§5.5, pp. 469-474]:

- La **superficie sustentadora** es el modelo correcto para AR bajo, flecha y delta (Fig. 5.32/5.33):
  dos láminas de vórtices, γ(x,y) con líneas paralelas a y, y δ(x,y) con líneas paralelas a x, más la
  estela δ_w(y) que ya no cambia con x.
- La ecuación central de la teoría de superficie sustentadora [Ec. 5.80, p.472]:
  ```
                  1   ⌠⌠   (x−ξ)γ(ξ,η) + (y−η)δ(ξ,η)              1   ⌠⌠      (y−η)δ_w(η)
   w(x,y) = − ───── ⌡⌡ ───────────────────────── dξdη  − ───── ⌡⌡ ──────────────────── dξdη
                 4π   S   [(x−ξ)² + (y−η)²]^(3/2)            4π   W  [(x−ξ)² + (y−η)²]^(3/2)
  ```
  con la condición de tangencia: `w(x,y) + componente normal de V∞ = 0` en toda la planta.
- La **discretización que define el método** [Fig. 5.35–5.36, p.473]:
  - La planta se divide en paneles trapezoidales (*"The panel is a trapezoid; it does not have to be a
    square, or even a rectangle"* [p.473]).
  - En cada panel se pone **un vórtice de herradura `abcd` de intensidad Γ_n**, con el segmento ligado
    `bc` a **l/4 del frente del panel**, donde l es la longitud del panel en dirección del flujo.
  - El **punto de control** va en la línea media del panel, a **3l/4 del frente**.
  - La velocidad inducida por cada herradura en cada punto de control se calcula con Biot-Savart
    tratando **cada filamento (ab, bc, cd) por separado** [p.473].
  - Aplicar tangencia en TODOS los puntos de control ⇒ sistema de ecuaciones algebraicas simultáneas
    en las Γ_n.

**Lo que el libro NO da** [p.474]: *"only the flavor of the method is given above; you are encouraged to
read the volumes of literature... In particular, Reference 13 has an excellent introductory discussion on
the vortex lattice method, including a worked example."* La **Referencia 13 es Bertin** — el otro manual
del cliente. Las fórmulas explícitas del coeficiente de influencia **le tocan al bloque Bertin**.

**Lo que YO agrego** `[EXTENSIÓN DECLARADA — derivado por integración directa de la Ec. (5.5) del propio
libro; motivo: el requisito del cliente es un solver 3D que corra sobre el ala EXTRUIDA en el CAD, y sin
estas fórmulas no se puede escribir el código]`:

Velocidad inducida en P por un **segmento recto A→B** de circulación Γ:

```
   r₁ = P − A ,  r₂ = P − B ,  r₀ = B − A
                Γ      r₁ × r₂     ⎛  r₀·r₁     r₀·r₂ ⎞
   V(P) = ───────── ───────────── ⎜ ─────── − ─────── ⎟
              4π    |r₁ × r₂|²     ⎝  |r₁|      |r₂|  ⎠
```
Si `|r₁ × r₂|² < ε` (P sobre la línea del filamento), la contribución es cero (núcleo de desingularización).

**Cola semi-infinita** desde A hacia +x: mismo cálculo con B = A + (L_estela, 0, 0), con L_estela grande
comparada con la envergadura. **Gotcha medido:** si L_estela es un número fijo enorme (1e7) y la cuerda es
pequeña (AR muy alto), el condicionamiento se destruye — a AR=1000 mi solver devolvió a = 109 /rad (basura).
**L_estela debe escalarse con la cuerda/envergadura, no fijarse.**

**Herradura completa:** ∞→A (cola entrante), A→B (ligado), B→∞ (cola saliente).

**Ensamble y solución:**
```
   AIC[k][m] = componente z de la velocidad inducida en P_k por la herradura m con Γ=1
   Σ_m AIC[k][m] Γ_m = −V∞ sin α          (para ala plana; con curvatura/torcimiento, −V∞·n̂_k)
   → resolver → Γ_m
   L = ρ∞ V∞ Σ_m Γ_m Δy_m         (Kutta-Joukowski por panel)
   C_L = 2 Σ Γ_m Δy_m / (V∞ S)
```

**Verificación que YO corrí** (con S y AR medidos de la geometría, como pide el cliente):

| Prueba | Resultado obtenido | Criterio | Veredicto |
|---|---|---|---|
| Límite 2D: AR=200, Ny=80, Nx=4 | a = 6.16 /rad | debe → a₀ = 2π = 6.283 | ✅ 2 % |
| AR bajo: AR=1 | a = 1.497 /rad | Helmbold Ec. (5.81) = 1.483 | ✅ 0.9 % |
| AR=2 | a = 2.526 | Helmbold = 2.603 | ✅ 3 % |
| AR=4 | a = 3.670 | Helmbold = 3.883 | ⚠️ 5.5 % |
| AR=6 (convergido, Ny=120, Nx=10) | a = 4.230 | Helmbold = 4.529 / LL = 4.530 | ⚠️ 6.6 % bajo |
| Flecha Λ=45°, AR=6 | a = 3.370 | Küchemann Ec. (5.82) = 3.517 | ✅ tendencia correcta, 4 % |
| **C_D,i por campo cercano, ala elíptica** | **e = 0.87–0.94** | **debe dar e = 1.00** | ❌ **NO PASA** |
| C_D,i por campo cercano, ala rectangular | e ≈ 1.00 | debe dar e < 1 | ❌ **NO PASA** |

**Reporte honesto:** el **C_L del vortex-lattice está validado**; el **C_D,i NO**. El post-proceso de
arrastre inducido por campo cercano invierte el orden físico (la elíptica sale peor que la rectangular),
lo cual es imposible según la Ec. (5.62). Debe calcularse en el **plano de Trefftz** y calibrarse contra
la prueba de aceptación `elíptica ⇒ e = 1`. **Lo dejo como PENDIENTE ABIERTO del bloque Bertin**, no como
receta validada. Es preferible entregar un hueco declarado que una fórmula que se ve bien y da un número
falso.

Para el arrastre inducido interino, la recomendación es: **usar la línea sustentadora (§2.1.6), que sí
verifiqué contra el caso elíptico exacto**, y usar el vortex-lattice solo para C_L y para la distribución
de sustentación en alas en flecha / AR bajo.

### 2.3 Termodinámica y flujo isentrópico (cap. 7)

| Concepto | Fórmula | Ec. | Rango / supuesto | Qué se rompe fuera |
|---|---|---|---|---|
| Gas perfecto | `p = ρRT` | 7.1 | partículas separadas >~10 diámetros moleculares [p.530] | gases densos / criogénicos |
| Gas caloríficamente perfecto | `e = c_vT`, `h = c_pT` | 7.6a,b | **aire T < 1000 K** [p.531] | a T alta c_p y c_v dejan de ser constantes; disociación e ionización (ver Prob. 8.18: el Apolo a M=36 tuvo T₀ real de 11 000 K, no lo que predice γ=1.4) |
| Relación c_p, c_v | `c_p − c_v = R`, `c_p = γR/(γ−1)`, `c_v = R/(γ−1)` | 7.7, 7.9, 7.10 | γ = 1.4 aire estándar | γ = 1.67 monoatómico (He, ver Ej. 8.6) |
| 1ª ley | `δq + δw = de`; `Tds = de + p dv`; `Tds = dh − v dp` | 7.11, 7.18, 7.20 | — | — |
| Entropía (gas cal. perfecto) | `s₂−s₁ = c_p ln(T₂/T₁) − R ln(p₂/p₁)` | 7.25 | — | — |
| **Isentrópico** | `p₂/p₁ = (ρ₂/ρ₁)^γ = (T₂/T₁)^(γ/(γ−1))` | 7.32 | adiabático **Y** reversible | dentro de la capa límite y a través de choques NO vale |
| Compresibilidad | `τ = −(1/v)(dv/dp)`; isotérmica `τ_T = 1/p`; isentrópica `τ_s = 1/(γp)` | 7.33-7.35 / E8.4-E8.5 | gas perfecto | — |

**Por qué el flujo isentrópico sirve tanto** [p.540]: fuera de la capa límite los efectos disipativos son
despreciables y no hay transferencia de calor ⇒ el elemento fluido es adiabático y reversible. *"In the
vast majority of practical applications, the viscous boundary layer adjacent to the surface is thin
compared with the entire flow field, and hence large regions of the flow can be assumed isentropic."*

**Condiciones totales** [§7.5, pp. 545-550]:
- **T₀, h₀**: lo que tendría el elemento si se frenara **adiabáticamente** a V=0.
- **p₀, ρ₀**: lo que tendría si se frenara **isentrópicamente** a V=0.
- `h + V²/2 = h₀` [Ec. 7.54] vale **localmente en cualquier punto**, aun en un flujo global no adiabático.
  Lo que NO vale en un flujo no adiabático es h₀ = const entre dos puntos (Fig. 7.4a).
- `T*`: temperatura que tendría el elemento llevado **adiabáticamente a Mach 1** (acelerándolo si es
  subsónico, frenándolo si es supersónico). `a* = √(γRT*)`.

### 2.4 Choque normal (cap. 8)

**Ecuaciones básicas** [§8.2, pp. 565-566] — válidas para cualquier flujo **unidimensional, estacionario,
adiabático, no viscoso**, no solo choques:

```
   ρ₁u₁ = ρ₂u₂                     (8.2)   continuidad
   p₁ + ρ₁u₁² = p₂ + ρ₂u₂²         (8.6)   cantidad de movimiento
   h₁ + u₁²/2 = h₂ + u₂²/2         (8.10)  energía
```

**Formas alternas de la energía** [§8.4, pp. 577-578] — todas equivalentes, todas útiles:

```
   a²/(γ−1) + u²/2 = a₀²/(γ−1)                      (8.33)
   a²/(γ−1) + u²/2 = ((γ+1)/(2(γ−1))) a*²           (8.35)
   ((γ+1)/(2(γ−1))) a*² = a₀²/(γ−1)                 (8.37)
   M*² = (γ+1)M² / (2 + (γ−1)M²)                    (8.48)   M* ≡ u/a*
```
Nota clave: `M* → √((γ+1)/(γ−1)) = 2.449` (γ=1.4) cuando M → ∞. **M* satura, M no.**

**El resultado maestro** [Ec. 8.55, p.588]: **relación de Prandtl** `a*² = u₁u₂` ⇒ `M*₂ = 1/M*₁` (8.57).

**Todo en función de M₁ ÚNICAMENTE:**

```
   M₂² = (1 + ((γ−1)/2)M₁²) / (γM₁² − (γ−1)/2)                       (8.59)
   ρ₂/ρ₁ = u₁/u₂ = (γ+1)M₁² / (2 + (γ−1)M₁²)                         (8.61)
   p₂/p₁ = 1 + (2γ/(γ+1))(M₁² − 1)                                   (8.65)
   T₂/T₁ = h₂/h₁ = [1 + (2γ/(γ+1))(M₁²−1)]·[(2+(γ−1)M₁²)/((γ+1)M₁²)] (8.67)
   Δs = c_p ln(T₂/T₁) − R ln(p₂/p₁)                                  (8.68)
   p₀,₂/p₀,₁ = e^(−Δs/R)                                             (8.73)
   T₀,₂ = T₀,₁   SIEMPRE (adiabático)                                (8.69)
```

**Rango de validez y qué se rompe:**
- **M₁ ≥ 1 obligatorio.** Con M₁ < 1 las ecuaciones tienen solución matemática pero dan **Δs < 0**, que la
  2ª ley prohíbe [p.591]. `[REQUISITO: el software debe lanzar error, no devolver el número.]`
- **γ constante.** A M₁ muy alto la temperatura detrás del choque dispara disociación/ionización y
  γ=1.4 deja de valer (ver Probs. 8.17/8.18: el Apolo a M=36 con γ=1.4 predice mal; hay que usar un
  "gamma efectivo").
- Límites M₁→∞ (γ=1.4): **M₂ → 0.378, ρ₂/ρ₁ → 6** (satura), pero **p₂/p₁ → ∞, T₂/T₁ → ∞**.

**Por qué crece la entropía** [p.591]: dentro del choque (espesor ~10⁻⁵ cm) hay gradientes enormes de
velocidad y temperatura ⇒ **fricción y conducción térmica intensas** dentro de la propia onda. El
mecanismo irreversible está ahí adentro, no afuera.

**Tubo de Pitot** [§8.7, pp. 603-605]:
- Subsónico: `M₁² = (2/(γ−1))[(p₀,₁/p₁)^((γ−1)/γ) − 1]` (8.74). Para la VELOCIDAD hace falta además a₁
  (o sea T₁): `u₁² = (2a₁²/(γ−1))[...]` (8.75).
- Supersónico: el Pitot lee **p₀,₂**, no p₀,₁ (hay una onda de proa). **Fórmula de Rayleigh** (8.80):
  ```
   p₀,₂/p₁ = [ (γ+1)²M₁² / (4γM₁² − 2(γ−1)) ]^(γ/(γ−1)) · [ (1 − γ + 2γM₁²)/(γ+1) ]
  ```
- **Frontera práctica:** a M=1 el Pitot mide p₀ = p/0.528 = 1.893p. Si la lectura es < 1.893p el flujo es
  subsónico; si es > 1.893p es supersónico [Ej. 8.22, p.606]. **Ese test debe ir en el código.**

### 2.5 Choque oblicuo y expansión (cap. 9) — lo supersónico exacto

**Ángulo de Mach** `μ = arcsin(1/M)` [Ec. 9.1, p.618].

**El principio que ahorra la mitad del trabajo** [p.623]: las ecuaciones del choque oblicuo (9.2), (9.7),
(9.12) son **idénticas** a las del choque normal (8.2), (8.6), (8.10), solo que con la componente NORMAL.
Además `w₁ = w₂` (Ec. 9.5): la componente tangencial no cambia. Por lo tanto:

```
   M_n,1 = M₁ sin β                                                    (9.13)
   → aplicar (8.59), (8.61), (8.65), (8.67), (8.73) con M_n,1
   → M₂ = M_n,2 / sin(β − θ)                                           (9.18)
```

**LA RELACIÓN θ-β-M** [Ec. 9.23, p.624] — *"This relation is vital to the analysis of oblique shock waves"*:

```
                          M₁² sin²β − 1
   tan θ = 2 cot β · ────────────────────────
                      M₁²(γ + cos 2β) + 2
```

**Propiedades que el software DEBE codificar** [pp. 624-630]:

1. **θ_max(M₁)**: si θ > θ_max **no hay solución de choque recto adherido** ⇒ choque curvo desprendido.
   θ_max → 45.5° cuando M₁ → ∞ (γ=1.4).
2. **Dos soluciones por θ**: débil (β pequeño) y fuerte (β grande). *"In nature, the weak shock solution
   usually prevails... It is safe to make this assumption, unless you have specific information to the
   contrary"* [p.628]. Detrás de la débil, M₂>1 casi siempre; detrás de la fuerte, M₂<1 siempre.
3. **θ = 0 ⇒ β = 90° (choque normal) o β = μ (onda de Mach).** El choque normal pertenece a la familia
   de soluciones FUERTES.
4. **A θ fijo, M₁ ↑ ⇒ β ↓ pero el choque se hace MÁS FUERTE.** Ejemplo del libro [Fig. 9.12, p.629]:
   θ=20°, M₁=2 → β=53.3°, M_n,1=1.60, p₂/p₁=2.82; M₁=5 → β=29.9°, M_n,1=2.49, p₂/p₁=7.07.
5. **A M₁ fijo, θ ↑ ⇒ β ↑ y el choque se hace más fuerte**, hasta desprenderse en θ_max
   [Fig. 9.13, p.629: para M₁=2 el desprendimiento ocurre en θ > 23°].

**Valores θ_max y β en θ_max que calculé** (útiles como tabla de precómputo y como test):

| M₁ | 1.5 | 2 | 3 | 4 | 5 | 7 | 10 | 20 | ∞ |
|---|---|---|---|---|---|---|---|---|---|
| θ_max [°] | 12.11 | 22.97 | 34.07 | 38.77 | 41.12 | 43.25 | 44.43 | 45.29 | **45.58** |
| β en θ_max [°] | 66.59 | 64.67 | 65.24 | 66.06 | 66.58 | 67.13 | 67.45 | 67.71 | **67.79** |

(El límite 45.58° concuerda con el "45.5°" que declara el libro [p.627] ✅.)

**ONDA DE EXPANSIÓN DE PRANDTL-MEYER** [§9.6, pp. 648-653]:

El abanico es una sucesión continua de ondas de Mach, cada una con ds = 0 ⇒ **la expansión es ISENTRÓPICA**.
*"This is in direct contrast to flow across an oblique shock, which always experiences an entropy increase.
The fact that the flow through an expansion wave is isentropic is a greatly simplifying aspect"* [p.649].

```
                ⌠M₂  √(M²−1)     dM
   θ  =  ⌡M₁  ───────────── ·────                                     (9.40)
              1 + ((γ−1)/2)M²    M

              ┌──────                ┌──────
   ν(M) =  ╲│(γ+1)/(γ−1) · arctan ╲│((γ−1)/(γ+1))(M²−1)  −  arctan √(M²−1)     (9.42)

   θ = ν(M₂) − ν(M₁)                                                  (9.43)
```
con la constante de integración escogida para que **ν(1) = 0**.

**Receta de 4 pasos** [p.653]:
1. Obtén ν(M₁).
2. ν(M₂) = ν(M₁) + θ.  (**Compresión isentrópica: ν(M₂) = ν(M₁) − θ**, Ej. 9.10.)
3. Invierte ν para obtener M₂ (implícita: bisección o tabla).
4. Como es isentrópico, p₀ y T₀ son constantes:
   ```
   T₂/T₁ = (1 + ((γ−1)/2)M₁²)/(1 + ((γ−1)/2)M₂²)                     (9.44)
   p₂/p₁ = [ (1 + ((γ−1)/2)M₁²)/(1 + ((γ−1)/2)M₂²) ]^(γ/(γ−1))       (9.45)
   ```
5. Dibuja el abanico entre μ₁ = arcsin(1/M₁) y μ₂ = arcsin(1/M₂).

**Límite duro**: `ν_max = 90°(√((γ+1)/(γ−1)) − 1) = 130.45°` para γ=1.4 — es la deflexión máxima posible
expandiendo desde M=1 hasta M=∞ (esto es exactamente el Problema 9.15). Más allá el gas se separaría del
contorno (vacío).

Valores de ν(M) que calculé (para la tabla de precómputo):

| M | 1 | 1.5 | 2 | 3 | 5 | 7 | 10 | ∞ |
|---|---|---|---|---|---|---|---|---|
| ν [°] | 0.000 | 11.905 | 26.380 | 49.757 | 76.920 | 90.973 | 102.316 | 130.454 |
| μ [°] | 90.00 | 41.81 | 30.00 | 19.47 | 11.54 | 8.21 | 5.74 | 0 |

**TEORÍA CHOQUE-EXPANSIÓN** [§9.7, pp. 660-663]:

*"Whenever we have a body made up of straight-line segments and the deflection angles are small enough
so that no detached shock waves occur, the flow over the body goes through a series of distinct oblique
shock and expansion waves, and the pressure distribution on the surface... can be obtained EXACTLY"* [p.661].

Placa plana a α [Fig. 9.36]: expansión arriba (p₂ < p₁), choque abajo (p₃ > p₁).
```
   L' = (p₃ − p₂) c cos α        (9.47)
   D' = (p₃ − p₂) c sin α        (9.48)
   c_d/c_l = tan α               [p.664]
```
Perfil rómbico a α=0 [Fig. 9.37]: `D' = (p₂ − p₃) t` (9.49) — **sustentación cero, arrastre finito.**

**En supersónico no hay paradoja de d'Alembert.** *"This new source of drag is called wave drag... The
existence of wave drag is inherently related to the increase in entropy and consequently to the loss of
total pressure across the oblique shock waves"* [p.663].

**Relación cuantitativa arrastre de onda ↔ entropía** [§9.13 "Integrated Work Challenge", pp. 675-678]:
el libro deriva, con volumen de control (Fig. 9.42),
```
       ⌠ ⎧ 2γp₁ ⎡        γ−1  ⎛ p₀,₂ ⎞^((γ−1)/γ)     ⎤   2γp₂ ⎡         γ−1  ⎛ p₀,₁ ⎞^((γ−1)/γ)    ⎤⎫
   D' = ⌡ ⎨ ──── ⎢(e^(Δs/R))^─── ⎜──── ⎟           − 1 ⎥ − ──── ⎢(e^(−Δs/R))^─── ⎜──── ⎟          − 1⎥⎬ dy   (C9.9)
         ⎩ γ−1  ⎣          γ   ⎝  p₁  ⎠               ⎦   γ−1  ⎣           γ   ⎝  p₂  ⎠              ⎦⎭
```
Conclusión: **Δs > 0 sube el primer término y baja el segundo — ambos aumentan D'.** Y si Δs=0 (isentrópico)
entonces D' = 0. **El arrastre de onda y el aumento de entropía van de la mano.**

### 2.6 Efecto de alivio tridimensional (cap. 6)

| Cantidad | Cilindro 2D | Esfera 3D | Ec. |
|---|---|---|---|
| Velocidad máxima superficial | `2 V∞` (3.100) | `1.5 V∞` (6.19) | 6.19 |
| C_p | `1 − 4 sin²θ` (3.101) | `1 − (9/4) sin²θ` (6.20) | 6.20 |
| C_D subcrítico | ≈ 1.0 | ≈ 0.4 | Figs. 3.44 / 6.11 |
| C_D supercrítico | ≈ 0.3 | ≈ 0.1 | Figs. 3.44 / 6.11 |
| Re crítico | ~3×10⁵ | ~3×10⁵ | — |

Explicación física [§6.4.1, p.506]: el cilindro obliga al flujo a esquivarlo solo por arriba y por abajo;
la esfera también deja irse por los lados. *"The flow is 'less stressed'; it moves around the sphere in a
more relaxed fashion — it is 'relieved'."*

Y **ese mismo alivio** explica por qué el cono tiene choque más débil que la cuña al mismo semiángulo
[§9.3, p.635] — es la misma física en supersónico.

**Aviso del libro sobre Re crítico** [p.512]: *"the value of the critical Reynolds number... is not a
fixed, universal number"* — depende de la turbulencia de la corriente libre. De hecho, se usan esferas
calibradas para MEDIR la turbulencia de un túnel a partir del Re crítico observado.

---

## 3. FIXTURES DE TEST

Todos los ejemplos numéricos resueltos del rango, en el formato de la Regla 3. Yo **recalculé cada uno**;
las notas marcan las discrepancias que encontré.

### Capítulo 5 — línea sustentadora

```
FIXTURE anderson-ej-5.1 [§5.3.4, p.457-458]
entradas: AR=8, taper λ=0.8, perfil delgado y simétrico (a0=2π, α_L=0=0°), α=5°,
          δ=0.055 (leído de Fig. 5.20), suposición δ=τ
salida esperada: a = 4.97 rad⁻¹ = 0.0867 deg⁻¹ ; C_L = 0.4335 ; C_D,i = 0.00789
tolerancia: 0.5 % (recalculado: a=4.9719, C_L=0.43349, C_D,i=0.0078876)
NOTA: δ=0.055 sale de una FIGURA que no pude leer. Mi solver de Fourier da δ=0.0444 y τ=0.1376.
      Con esos valores: a=4.8919, C_L=0.4270, C_D,i=0.00757 (−4 % en C_D,i).
```

```
FIXTURE anderson-ej-5.2 [§5.3.4, p.458-459]
entradas: ala rectangular AR=6, δ=τ=0.055, α_L=0=−2°, α=3.4°, C_D,i=0.01
          → escalar a un ala igual con AR=10 (δ=τ=0.105) al MISMO α
salida esperada: C_L(AR=6)=0.423 ; a(AR=6)=0.078/deg=4.485/rad ; a0=5.989/rad ;
                 a(AR=10)=4.95/rad=0.086/deg ; C_L(AR=10)=0.464 ; C_D,i(AR=10)=0.0076
tolerancia: 1 % (recalculado: C_L=0.42269, a=4.4885, a0=5.9887, a2=4.9469, C_L2=0.46440, C_Di=0.0075732)
LECCIÓN QUE EL LIBRO SUBRAYA: a MISMO C_L la Ec. (5.65) resuelve el escalado directo; a MISMO α
hay que pasar por el efecto del AR sobre la pendiente. No confundir los dos casos.
```

```
FIXTURE anderson-ej-5.3 [§5.3.4, p.459-460]
entradas: α_L=0=−2°, a0=0.1/deg=5.73/rad, τ=0.04, AR=7.96, C_L crucero=0.21 (del Ej.1.6)
salida esperada: a = 4.627/rad = 0.0808/deg ; α = 0.6°
tolerancia: 1 % (recalculado: a=4.6272 /rad, 0.080754 /deg, α=0.5996°)
```

```
FIXTURE anderson-ej-5.4 [§5.3.4, p.460-462]  ← EL FIXTURE ANCLA DEL CAPÍTULO
entradas: Beechcraft Baron 58, AR=7.61, λ=0.45, α=4°, perfil NACA 23015 (Fig. 5.2):
          α_L=0=−1°, a0=0.113/deg=6.47/rad ; δ=0.01 (Fig. 5.20) ⇒ e=0.99 ; τ=δ
salida esperada: a=5.08/rad=0.0887/deg ; C_L=0.443 ; α_i=0.0185 rad=1.06° ; α_eff≈3° ;
                 c_l(perfil)=0.452 ; c_d=0.0065 (Fig. 5.2b) ; C_D = 0.0065+0.0083 = 0.0148
tolerancia: 1 %  (recalculado: a=5.0797, 0.088651/deg, C_L=0.44326, α_i=0.018541 rad=1.0623°,
                  C_D = 0.0065 + 0.008295 = 0.014795)
COMPARACIÓN OBLIGATORIA (la lección del capítulo, Preview Box p.424 y cierre p.462):
   perfil: c_l=0.54  c_d=0.0068     |     ALA: C_L=0.443  C_D=0.0148
   → C_L es 18 % MENOR ; C_D es MÁS DEL DOBLE
DEPENDENCIA NO OBSERVADA: c_d=0.0065 y a0=0.113/deg vienen de la Figura 5.2 (imagen).
```

### Capítulo 6 — avión completo

```
FIXTURE anderson-ej-6.1 [§6.7.2, p.516]
entradas: Seversky P-35, S=220 ft², b=36 ft, C_D=0.0275 cuando C_L=0.15 (datos del XP-41, Fig.1.58)
salida esperada: AR=5.89 ; e_Oswald(Ec. 6.25)=0.873 ; C_D,o = 0.026
tolerancia: 1 % (recalculado: AR=5.8909, e=0.87246, C_D,o=0.026107)
CONTRASTE INDEPENDIENTE que da el libro: Loftin (Ref. 45) tabula C_D,o=0.0251 → 3.6 % de diferencia.
```

```
FIXTURE anderson-ej-6.2 [§6.7.2, p.519]
entradas: C_D,o=0.026, e=0.873, AR=5.89
salida esperada: (L/D)max = 12.46
tolerancia: 1 % (recalculado: 12.462)
CONTRASTE: Loftin tabula (L/D)max = 11.8 → 5 % de diferencia. El libro lo declara explícitamente.
```

### Capítulo 7 — termodinámica

```
FIXTURE anderson-ej-7.1 [§7.2.2, p.532-533]
entradas: cuarto de 5 m × 7 m × 3.3 m, p=1 atm=1.01e5 Pa, T=25 °C=298 K, aire
salida esperada: ρ=1.181 kg/m³ ; M=136.4 kg ; c_v=717.5 J/(kg·K) ; e=2.138e5 J/kg ; E=2.92e7 J ;
                 c_p=1004.5 J/(kg·K) ; h=2.993e5 J/kg ; H=4.08e7 J ; H/E = γ = 1.4
tolerancia: 0.5 % (recalculado: ρ=1.18093, M=136.40, e=2.13815e5, E=2.9164e7, h=2.99341e5, H=4.0830e7)
CHEQUEO INTERNO QUE EL PROPIO LIBRO USA: H/E debe dar exactamente γ=1.4.
```

```
FIXTURE anderson-ej-7.2 [§7.2.2, p.534]
entradas: depósito V=30 m³ constante, T=300 K constante, se bombea 1 kg/s, instante en que p=10 atm
salida esperada: dρ/dt = 0.0333 kg/(m³·s) ; dp/dt = 2867.13 N/(m²·s)
tolerancia: 0.5 % (recalculado con dρ/dt=1/30 exacto: dp/dt=2870.0; el libro truncó a 0.0333)
```

```
FIXTURE anderson-ej-7.3 [§7.2.2, p.534-535]
entradas: mismo depósito, dp/dt = 2867.13 N/(m²·s) constante, de 10 atm a 20 atm
salida esperada: t = 352.27 s = 5.87 min
tolerancia: 0.5 % (recalculado: 352.25 s)
```

```
FIXTURE anderson-ej-7.4 [§7.2.5, p.540]
entradas: Boeing 747 a 36 000 ft (Ap. E: p∞=476 lb/ft², T∞=391 °R), punto del ala con p=400 lb/ft²,
          flujo isentrópico
salida esperada: T = 372 °R
tolerancia: 0.5 % (recalculado: 372.0 °R)
```

```
FIXTURE anderson-ej-7.5 [§7.2.5, p.540-541]
entradas: depósito p₁=20 atm, T₁=300 K; punto del ducto con p₂=1 atm
salida esperada: (a) isentrópico: T₂ = 127.5 K ; (b) con Δs=+320 J/(kg·K): T₂ = 175.3 K
tolerancia: 0.5 % (recalculado: (a) 127.45 K ; (b) 175.30 K)
LECCIÓN: el aumento de entropía SUBE la temperatura final a la misma presión final.
```

```
FIXTURE anderson-ej-7.6 [§7.5, p.550]
entradas: p=1 atm, T=320 K, V=1000 m/s
salida esperada: T₀ = 817.8 K ; p₀ = 26.7 atm
tolerancia: 0.5 % (recalculado: T₀=817.76 K, p₀=26.688 atm)
```

```
FIXTURE anderson-ej-7.7 [§7.5, p.551]
entradas: 10 000 ft (Ap. E: p∞=1455.6 lb/ft², T∞=483.04 °R), Pitot lee p₀=2220 lb/ft², compresible
salida esperada: T₀ = 544.9 °R ; c_p = 6006 ft·lb/(slug·°R) ; V∞ = 862 ft/s
tolerancia: 0.5 % (recalculado: T₀=544.94, V∞=862.0)
AVISO DEL LIBRO: NO se puede usar Bernoulli aquí.
```

### Capítulo 8 — choque normal

```
FIXTURE anderson-ej-8.1 [§8.3, p.571-572]
entradas: V=250 m/s a (a) nivel del mar T=288 K, (b) 5 km T=255.7 K, (c) 10 km T=223.3 K
salida esperada: (a) a=340.2 m/s, M=0.735 ; (b) a=320.5, M=0.78 ; (c) a=299.5, M=0.835
tolerancia: 0.5 % (recalculado: 340.14/0.7350 ; 320.52/0.78 ; 299.53/0.8347)
LECCIÓN: la misma velocidad da Mach distinto según la altitud.
```

```
FIXTURE anderson-ej-8.2 [§8.3, p.572]  |  FIXTURE anderson-ej-8.7 [§8.4, p.581]
entradas: T=320 K, V=1000 m/s
salida esperada: a=358.6 m/s ; M=2.79 ; luego T₀/T=2.557 → T₀=818 K ; p₀/p=26.7 → p₀=26.7 atm
tolerancia: 0.5 % (recalculado: a=358.57, M=2.7887, T₀/T=2.5568, T₀=818.2 K, p₀/p=26.745)
VALOR PEDAGÓGICO: el Ej. 8.7 obtiene lo mismo que el 7.6 pero VÍA MACH. El libro dice que esa
ruta es "philosophically, more fundamental" [p.581].
```

```
FIXTURE anderson-ej-8.3 [§8.3, p.572-573]
entradas: M=2 y M=20
salida esperada: (V²/2)/e = γ(γ−1)M²/2 → 1.12 y 112
tolerancia: 0.5 % (exacto)
LECCIÓN: en hipersónico la energía cinética es cien veces la interna. Eso define "hipersónico".
```

```
FIXTURE anderson-ej-8.4 [§8.3, p.573-574]
entradas: aire, p=0.7 atm, ρ=0.0019 slug/ft³
salida esperada: τ_s = 1/(γp) = 1.02 atm⁻¹ = 4.82e−4 (lb/ft²)⁻¹ ; a = √(1/(ρτ_s)) = 1045 ft/s
verificación cruzada del libro: T = p/(ρR) = 454.3 °R → a = √(γRT) = 1045 ft/s ✅
tolerancia: 0.5 % (recalculado: τ_s=1.0204 atm⁻¹, a=1044.7 ft/s por ambas rutas)
```

```
FIXTURE anderson-ej-8.5 [§8.3, p.574-575]  ← EL ERROR DE NEWTON
entradas: nivel del mar p=2116 lb/ft², ρ=0.002377 slug/ft³; SUPONER isotérmico (τ_T = 1/p) como Newton
salida esperada: a_T = √(p/ρ) = 943.5 ft/s ; Newton publicó 979 ft/s ; el valor real es 1117 ft/s
                 razón de errores: a_T/a = γ^(−1/2) = 0.845 → 15 % bajo
tolerancia: 0.5 % (recalculado: 943.46 ft/s)
LECCIÓN HISTÓRICA: Newton culpó al polvo y al vapor de agua. Laplace corrigió un siglo después
al suponer, correctamente, que la onda de sonido es ADIABÁTICA y no isotérmica.
```

```
FIXTURE anderson-ej-8.6 [§8.3, p.576]
entradas: tubo de 300 m a T=320 K; (a) aire γ=1.4 R=287 ; (b) helio γ=1.67 R=2078.5
salida esperada: (a) a=358.6 m/s, t=0.837 s ; (b) a=1054 m/s, t=0.285 s
tolerancia: 0.5 % (recalculado: 358.57/0.83666 ; 1053.9/0.28466)
LECCIÓN: el helio es más rápido sobre todo por su peso molecular (R = ℛ/M), no solo por γ.
```

```
FIXTURE anderson-ej-8.8 [§8.4, p.582]
entradas: M=3.5, p=0.3 atm, T=180 K
salida esperada: p₀=22.9 atm ; T₀=621 K ; T*=517.5 K ; a*=456 m/s ; M*=2.06
verificación cruzada: Ec. (8.48) da M*²=4.26 → M*=2.06 ✅
tolerancia: 1 % (recalculado: p₀=22.881, T₀=621.0, T*=517.5, a*=456.0, a=268.9, V=941.1, M*=2.0636;
            por Ec. 8.48: M*=2.0642)
```

```
FIXTURE anderson-ej-8.9 [§8.4, p.582-583]
entradas: M∞=0.6, p∞=1 atm, punto del perfil con p₁=0.7545 atm, isentrópico
salida esperada: p₀,∞=1.276 atm ; p₀,₁/p₁=1.691 → M₁ = 0.9
tolerancia: 1 % (recalculado: 1.69119)
ANÁLOGO COMPRESIBLE DEL EJ. 3.1: aquí NO se puede usar Bernoulli.
```

```
FIXTURE anderson-ej-8.10 [§8.4, p.583-584]
entradas: mismas condiciones del Ej. 8.9 con T∞ = 59 °F = 519 °R
salida esperada: T₁ = 478.9 °R ; a₁ = 1072.6 ft/s ; V₁ = 965.4 ft/s
tolerancia: 0.5 % (recalculado: T₁=478.87, a₁=1072.6, V₁=965.3)
LECCIÓN: para la VELOCIDAD (no el Mach) siempre hace falta el nivel de temperatura.
```

```
FIXTURE anderson-ej-8.11 [§8.6, p.593-594]
entradas: choque normal, u₁=680 m/s, T₁=288 K, p₁=1 atm
salida esperada: a₁=340 m/s ; M₁=2 ; p₂=4.5 atm ; T₂=486 K ; M₂=0.5774 ; a₂=442 m/s ; u₂=255 m/s
tolerancia: 0.5 % (recalculado: a₁=340.14, M₁=1.9992, p₂/p₁=4.5, T₂=485.9, a₂=441.9, u₂=255.2)
```

```
FIXTURE anderson-ej-8.12 [§8.6, p.594-595]
entradas: choque normal con p₁=1 atm, (a) M₁=2, (b) M₁=4
salida esperada: (a) p₀,₁=7.824 atm, p₀,₂=5.64 atm, pérdida=2.184 atm
                 (b) p₀,₁=151.8 atm, p₀,₂=21.07 atm, pérdida=130.7 atm
tolerancia: 1 % (recalculado: 5.6403/2.1837 ; 21.070/130.73)
LECCIÓN DE DISEÑO: al DOBLAR el Mach la pérdida de p₀ se multiplicó por 60.
"if you are going to suffer a normal shock wave in a flow... you want the normal shock to occur
at the lowest possible upstream Mach number" [p.595]
```

```
FIXTURE anderson-ej-8.13 [§8.6, p.595-596]  ← EL RAMJET QUE SÍ FUNCIONA
entradas: ramjet a M∞=2, 10 km (p∞=2.65e4 N/m², T∞=223.3 K), choque normal en la toma,
          isentrópico de 1 a 2, M₂=0.2 en el combustor
salida esperada: p₀,∞=2.07e5 ; T₀,∞=401.9 K ; p₀,₁=1.49e5 ; p₂=1.45e5 N/m²=1.42 atm ; T₂=399 K
tolerancia: 1 % (recalculado: 2.0734e5 ; 401.94 ; 1.4947e5 ; 1.4540e5 = 1.4255 atm ; 398.75 K)
```

```
FIXTURE anderson-ej-8.14 [§8.6, p.596-598]  ← POR QUÉ EXISTE EL SCRAMJET
entradas: idéntico al Ej. 8.13 pero M∞=10
salida esperada: p₀,∞=1.125e9 ; T₀,∞=4690 K ; p₀,₁=3.43e6 ; p₂=3.34e6 N/m²=32.7 atm ; T₂=4653 K
tolerancia: 1 % (recalculado: 1.1246e9 ; 4689.3 K ; 3.4255e6 ; 3.3323e6 = 32.67 atm ; 4652.7 K)
CONCLUSIÓN DEL LIBRO: "The temperature is so hot that the fuel injected into the combustor will
decompose rather than burn, with little or no thrust being produced" [p.597]. Un ramjet
convencional NO FUNCIONA en hipersónico → hay que quemar en flujo supersónico (SCRAMjet).
```

```
FIXTURE anderson-ej-8.15/8.16/8.17 [§8.6, p.598-599]  — tabla inversa del choque normal
8.15: dado p₂/p₁=4.5   → M₁=2,  M₂=0.5774, ρ₂/ρ₁=2.667, T₂/T₁=1.687
8.16: dado T₂/T₁=5.8   → M₁=5,  M₂=0.4152, ρ₂/ρ₁=5,     p₂/p₁=29
8.17: dado M₂=0.4752   → M₁=3,  ρ₂/ρ₁=3.857, p₂/p₁=10.33, T₂/T₁=2.679
tolerancia: 0.5 %
REQUISITO IMPLÍCITO: el software debe permitir invertir el choque normal desde CUALQUIERA de
sus razones, no solo desde M₁.
```

```
FIXTURE anderson-ej-8.18 [§8.6, p.599]
entradas: u₁=1215 m/s, T₁=300 K
salida esperada: a₁=347.2 ; M₁=3.5 ; T₂=994.5 K ; a₂=632.1 ; u₂=285.2 m/s
tolerancia: 0.5 % (recalculado: a₁=347.19, M₁=3.4996, T₂=994.5, a₂=632.1, u₂=285.2)
LECCIÓN: una velocidad SOLA no define el choque; hacen falta DOS cantidades (u y T, o el Mach).
```

```
FIXTURE anderson-ej-8.19/8.20/8.21 [§8.6, p.600-602]  — interpolar vs entrada más cercana
8.19: u₂=329 m/s, T₂=1500 K → M₂=0.4238 → interpolando M₁=4.4898, T₂/T₁=4.856, u₁=1581.5 m/s
8.20: mismo caso con "entrada más cercana": u₁=1582 m/s → error de 0.06 %
8.21: M₁=3.53 → M₂: entrada cercana 0.4492 ; interpolado 0.45 ; EXACTO Ec.(8.59) 0.45
tolerancia: 0.5 %
CONCLUSIÓN DEL LIBRO: "For all practical purposes, all three approaches yield almost identical
results" [p.602]. Para NUESTRO software da igual: implementamos las ecuaciones exactas.
```

```
FIXTURE anderson-ej-8.22 [§8.7.2, p.605-606]  ← EL TEST SUBSÓNICO/SUPERSÓNICO
entradas: p_estática = 1 atm; el Pitot lee (a) 1.276 atm, (b) 2.714 atm, (c) 12.06 atm
salida esperada: umbral p₀/p a M=1 es 1/0.528 = 1.893
                 (a) 1.276 < 1.893 → SUBSÓNICO, M=0.6 (Ap. A)
                 (b) 2.714 > 1.893 → SUPERSÓNICO, M₁=1.3 (Rayleigh, Ap. B)
                 (c) 12.06 > 1.893 → SUPERSÓNICO, M₁=3.0
tolerancia: 1 %
```

```
FIXTURE anderson-ej-8.23 [§8.7.2, p.606-607]
entradas: misil romo a M=8, 20 000 ft, p₁=973.3 lb/ft²
salida esperada: p_estancamiento = p₀,₂ = 82.87 × 973.3 = 8.07e4 lb/ft² = 38.1 atm
verificación cruzada del libro (dos rutas): p₀,₁=9.502e6 y p₀,₂/p₀,₁=0.8488e−2 → 8.07e4 ✅
tolerancia: 1 % (recalculado: 80 657 lb/ft² = 38.12 atm)
```

```
FIXTURE anderson-ej-8.24 [§8.7.2, p.607-608]
entradas: SR-71 a 25 km (p=2.5273e3 N/m², T=216.66 K), Pitot lee 3.88e4 N/m²
salida esperada: p₀,₁/p₁ = 15.35 → M₁ = 3.4 ; a₁ = 295 m/s ; V₁ = 1003 m/s
tolerancia: 1 % (recalculado: 15.352 ; a₁=295.02 ; V₁=1003.1)
```

### Capítulo 9 — choque oblicuo y expansión

```
FIXTURE anderson-ej-9.1 [§9.1, p.619-620]
entradas: avión a M=2, altitud 16 km, la onda de Mach llega al suelo
salida esperada: μ = arcsin(1/2) = 30° ; distancia horizontal d = 16/tan(30°) = 27.7 km
tolerancia: 0.5 % (recalculado: 27.713 km)
```

```
FIXTURE anderson-ej-9.2 [§9.2, p.630-631]  ← EL FIXTURE ANCLA DEL CHOQUE OBLICUO
entradas: M₁=2, p₁=1 atm, T₁=288 K, esquina de compresión θ=20°
salida esperada: β=53.4° (Fig. 9.9) ; M_n,1=1.606 ; M_n,2=0.6684 ; p₂/p₁=2.82 ; T₂/T₁=1.388 ;
                 p₀,₂/p₀,₁=0.8952 ; M₂=1.21 ; p₂=2.82 atm ; T₂=399.7 K ; p₀,₂=7.00 atm ; T₀,₂=518.4 K
tolerancia: 1 %  (β exacto por Ec. 9.23: 53.423° — la lectura de la carta del libro es excelente)
TRAMPA QUE EL LIBRO SEÑALA EXPLÍCITAMENTE [p.630-631]: usar la columna p₀,₂/p₁ del Apéndice B
con M_n,1=1.60 da 3.805 atm — "a totally incorrect result compared with the correct value of
7.00 atm". La Ec. (8.80) NO vale para choque oblicuo. La columna p₀,₂/p₀,₁ SÍ vale con M_n,1.
```

```
FIXTURE anderson-ej-9.3 [§9.2, p.631]
entradas: M₁=2.4, β=30°
salida esperada: θ=6.5° ; M_n,1=1.2 ; p₂/p₁=1.513 ; T₂/T₁=1.128 ; M_n,2=0.8422 ; M₂=2.11
tolerancia: 1 % (θ exacto por Ec. 9.23: 6.716° → el libro lee 6.5° de la Fig. 9.9, 3 % bajo;
            con θ=6.716 el M₂ exacto es 2.1044 vs 2.1121 del libro — dentro de tolerancia)
```

```
FIXTURE anderson-ej-9.4 [§9.2, p.632]
entradas: β=35°, p₂/p₁=3
salida esperada: M_n,1=1.64 → M₁ = 2.86
tolerancia: 1 % (recalculado con M_n,1=1.64: M₁=2.859 ✅ coincide con la respuesta del libro)
⚠️ ERRATA DEL TEXTO: la línea de cálculo dice "M₁ = M_n,1/sin β = 1.66/sin 35°" — el 1.66 es un
   error tipográfico/OCR; con 1.66 saldría 2.894, no el 2.86 que el propio libro reporta.
   EL SOFTWARE DEBE USAR 1.64.
```

```
FIXTURE anderson-ej-9.5 [§9.2, p.632-633]  ← POR QUÉ LAS TOMAS SON DE CHOQUE OBLICUO
entradas: M=3; (1) un choque normal solo; (2) oblicuo con β=40° seguido de choque normal
salida esperada: (1) p₀,₂/p₀,₁ = 0.3283
                 (2) M_n,1=1.93 → p₀,₂/p₀,₁=0.7535, M_n,2=0.588, θ=22°, M₂=1.90
                     → normal a M=1.9: p₀,₃/p₀,₂=0.7674 → producto = 0.578
                 razón (2)/(1) = 1.76
tolerancia: 1 % (θ exacto para M=3, β=40°: 21.846° vs 22° del libro ✅)
LECCIÓN DE DISEÑO [Fig. 9.15, p.634]: la toma de choque oblicuo conserva 76 % MÁS presión total.
"This, of course, is why most modern supersonic aircraft have oblique shock inlets."
```

```
FIXTURE anderson-ej-9.6 [§9.3, p.636-637]  ← ARRASTRE DE ONDA DE UNA CUÑA
entradas: cuña de semiángulo 15° a M=5, base a p∞
salida esperada: β=24.2° ; M_n,1=2.05 ; p₂/p₁=4.736 ;
                 c_d = (4 tan θ/(γM₁²))(p₂/p₁ − 1) = 0.114
tolerancia: 1 % (recalculado: β exacto=24.322°, c_d=0.11441)
LECCIÓN: c_d salió SOLO de la forma, α y M∞ — sin p∞ ni V∞. Es la verificación del análisis
dimensional (§9.3.1, p.637-638). Y el arrastre es FINITO en flujo no viscoso: es arrastre de onda.
```

```
FIXTURE anderson-ej-9.7 [§9.4, p.643-644]  ← REFLEXIÓN DE CHOQUE
entradas: esquina de compresión θ=10°, M₁=3.6, nivel del mar (p₁=2116 lb/ft², T₁=519 °R),
          pared recta arriba
salida esperada: β₁=24° ; M_n,1=1.464 ; M_n,2=0.7157 ; p₂/p₁=2.32 ; T₂/T₁=1.294 ; M₂=2.96
                 reflejado: β₂=27.3° ; Φ = β₂ − θ = 17.3° ; M_n=1.358 ; p₃/p₂=1.991 ;
                 T₃/T₂=1.229 ; M₃=2.55 ; p₃=9774 lb/ft² ; T₃=825 °R
tolerancia: 1 % (β₁ exacto=23.899°; p₃=9774.6, T₃=825.4)
LECCIÓN: el choque reflejado es MÁS DÉBIL (p₃/p₂=1.991 < p₂/p₁=2.32) y Φ ≠ β₁: la reflexión NO
es especular.
```

```
FIXTURE anderson-ej-9.8 [§9.5, p.646-647]  ← ENTROPÍA A TRAVÉS DE UN CHOQUE CURVO
entradas: cuerpo romo parabólico a M∞=8; línea de corriente a con β=90°, línea b con β=60°
salida esperada: (a) M_n,1=8 → p₂/p₁=74.5, T₂/T₁=13.39 → Δs = 1370 J/(kg·K)
                 (b) M_n,1=6.928 → p₂/p₁=55.38, T₂/T₁=10.2 → Δs = 1180 J/(kg·K)
tolerancia: 1 % (recalculado: 1369.0 y 1180.7)
LECCIÓN → §9.5.1: hay GRADIENTE de entropía ⇒ por Crocco (T∇s = ∇h₀ − V×(∇×V)) con ∇h₀=0,
la VORTICIDAD es finita ⇒ no existe potencial de velocidad detrás de un choque curvo.
```

```
FIXTURE anderson-ej-9.9 [§9.6, p.653-654]  ← FIXTURE ANCLA DE PRANDTL-MEYER
entradas: M₁=1.5, p₁=1 atm, T₁=288 K, esquina de expansión θ=15°
salida esperada: ν₁=11.91° ; ν₂=26.91° → M₂=2.0 ; p₂=0.469 atm ; T₂=232 K ;
                 p₀,₂=p₀,₁=3.671 atm ; T₀,₂=T₀,₁=417.6 K
                 línea de Mach delantera: μ₁=41.81° ; trasera: μ₂−θ = 30−15 = 15°
tolerancia: 1 % (recalculado: ν(1.5)=11.905°, ν(2.0)=26.380° — con ν₂=26.91 el M₂ exacto es
            ~2.021; el libro redondea a la entrada de tabla M=2.0; p₂=0.46921, T₂=232.0)
```

```
FIXTURE anderson-ej-9.10 [§9.6, p.658-659]  ← COMPRESIÓN ISENTRÓPICA (SCRAMjet)
entradas: M₁=10, p₁=1 atm, superficie de compresión isentrópica que gira 15°
salida esperada: ν₁=102.3° ; ν₂ = ν₁ − θ = 87.3° → M₂=6.4 ; p₂ = 18.02 atm
tolerancia: 1 % (recalculado: ν(10)=102.316°, ν(6.4)=87.561°)
LA CLAVE: la MISMA función ν, con signo menos. La compresión isentrópica no pierde p₀.
```

```
FIXTURE anderson-ej-9.11 [§9.6, p.659-660]  ← EL MISMO GIRO PERO CON CHOQUE
entradas: M₁=10, p₁=1 atm, esquina AFILADA de 15° (choque oblicuo)
salida esperada: β=20° ; M_n,1=3.42 ; p₂/p₁=13.32 ; p₀,₂/p₀,₁=0.2322 ; M_n,2=0.4552 ;
                 M₂=5.22 ; p₂=13.32 atm ; p₀,₂=9.85e3 atm
tolerancia: 1 % (β exacto=19.942°)
⚠️ ERRATA DEL TEXTO: "Mn,1 = M1 sin β = (10) sin 20° = 34.2" — debe ser 3.42 (OCR: punto perdido).
COMPARACIÓN 9.10 vs 9.11 (la lección):
   isentrópico: M₂=6.4, p₂=18.02 atm, sin pérdida de p₀
   con choque : M₂=5.22, p₂=13.32 atm, p₀ cae 77 %
"designers of supersonic and hypersonic inlets would love to have the compression process carried
out via isentropic compression waves. However... it is a point design for the given upstream Mach
number. At off-design Mach numbers, even the best-designed compression contour will result in
shocks." [p.660]
```

```
FIXTURE anderson-ej-9.12 [§9.7, p.663-664]  ← PLACA PLANA SUPERSÓNICA
entradas: placa plana, α=5°, M=3
salida esperada: arriba: ν₁=49.76°, ν₂=54.76° → M₂=3.27, p₂/p₁ = 36.73/55 = 0.668
                 abajo:  β=23.1°, M_n,1=1.177, p₃/p₁=1.458
                 c_l = (2/(γM₁²))(p₃/p₁ − p₂/p₁) cos α = 0.125
                 c_d = c_l tan α = 0.011
tolerancia: 1 % (recalculado: ν(3)=49.757°, β exacto=23.13°, c_l=0.12492, c_d=0.010936)
```

```
FIXTURE anderson-ej-9.13 [§9.9, p.665-668]  ← LA COLA DE CUÑA DEL X-15
entradas: M=7, α=10°; (a) placa plana ; (b) cuña de ángulo INCLUIDO 10° (semiángulo 5°)
salida esperada del libro: (a) c_l = 0.126 ; (b) c_l = 0.241 → la cuña da el DOBLE
tolerancia: ⚠️ VER NOTA — usar 20 %, NO 1 %
⚠️ DISCREPANCIA GRANDE QUE ENCONTRÉ. El libro lee de la Figura 9.9 que para M=7, θ=15° el ángulo
   de onda es β=23.5°. La Ec. (9.23) EXACTA da β = 21.60° (1.9° de diferencia — la peor lectura
   de carta de todo el capítulo; en los otros 11 casos que verifiqué el error es ≤ 0.12°).
   Eso propaga: p₃/p₁ = 8.915 (libro) vs 7.579 (exacto).
   Recálculo exacto completo:
      placa: ν(7)=90.973°, ν₂=100.973° → M₂=9.527, p₂/p₁=0.1346, β=16.38°, M_n,1=1.974,
             p₃/p₁=4.381 → c_l = 0.1238 (sin cos α) ó 0.1219 (con cos α)   [libro: 0.126]
      cuña : M₂=8.085, p₂/p₁=0.3958, β=21.60°, M_n,1=2.577, p₃/p₁=7.579 → c_l = 0.2027
             [libro: 0.241]
      RAZÓN cuña/placa = 1.61  (el libro dice ≈ 2.0)
   VEREDICTO: la CONCLUSIÓN DE DISEÑO sobrevive (la cuña da bastante más fuerza lateral y por eso
   el X-15 la lleva), pero EL NÚMERO NO. El fixture debe registrar AMBOS: 0.241 como "valor del
   libro" y 0.2027 como "valor exacto de la Ec. (9.23)".
⚠️ INCONSISTENCIA INTERNA ADICIONAL: en el Ej. 9.12 el libro incluye el factor cos α en c_l;
   en el Ej. 9.13(a) lo omite. El software debe fijar UNA convención (con cos α, que es la
   Ec. 9.47) y documentarla.
```

### Fixtures de la propiedad, no de un ejemplo (invariantes que el software debe cumplir)

```
FIXTURE anderson-inv-elipse [§5.3.1-5.3.2, pp.443-449]
entradas: cualquier AR, planta elíptica, sin torcimiento, a0=2π
salida esperada: δ = 0 EXACTO ; e = 1 EXACTO ; a = a0/(1+a0/(πAR)) EXACTO ; α_i constante en y
tolerancia: 1e−6 en δ ; 1e−4 en a
VERIFICADO por mí con el solver de Fourier: AR=8 → δ=0.0000, e=1.0000, a=5.02655 vs
Ec.(5.69)=5.02655 ✅ Este es EL test de aceptación de la línea sustentadora.
```

```
FIXTURE anderson-inv-shock-2aley [§8.6, p.591]
entradas: M₁ < 1 en las Ecs. (8.59)-(8.68)
salida esperada: el software LANZA ERROR ("no existe choque normal en flujo subsónico"),
                 NO devuelve un número
motivo: Δs < 0 viola la 2ª ley
```

```
FIXTURE anderson-inv-thetamax [§9.2, p.624-627]
entradas: θ > θ_max(M₁) en la Ec. (9.23)
salida esperada: el software devuelve el ESTADO "choque desprendido", NO un ángulo β
casos de prueba: (M=2, θ=30°) ; (M=1.5, θ=20°) ; (M=3, θ=40°) — todos desprendidos
θ_max de referencia: M=1.5→12.11° ; M=2→22.97° ; M=3→34.07° ; M=5→41.12° ; M=10→44.43° ; M→∞→45.58°
(el libro declara el límite 45.5° en p.627 ✅)
```

```
FIXTURE anderson-inv-limites-M-inf [§8.6, p.590]
entradas: M₁ → ∞, γ=1.4
salida esperada: M₂ → 0.378 ; ρ₂/ρ₁ → 6.0 ; p₂/p₁ → ∞ ; T₂/T₁ → ∞
tolerancia: 0.5 % (recalculado: √((γ−1)/2γ)=0.37796 ; (γ+1)/(γ−1)=6.0)
```

```
FIXTURE anderson-inv-numax [§9.6 y Prob. 9.15, p.653 y p.683]
entradas: γ=1.4
salida esperada: ν_max = 90°(√((γ+1)/(γ−1)) − 1) = 130.45°
tolerancia: 0.01° (recalculado: 130.454°)
```

```
FIXTURE anderson-inv-sonicas [§8.4, p.580]
entradas: γ=1.4
salida esperada: T*/T₀=0.833 ; p*/p₀=0.528 ; ρ*/ρ₀=0.634
tolerancia: 0.2 %
```

---

## 4. DECISIONES HUMANAS — dónde juzga el ingeniero y el software NO debe decidir

| # | § | La decisión | Por qué el software NO debe tomarla |
|---|---|---|---|
| D-01 | §5.3.3 p.445 | **Cuánto alargamiento AR.** | *"the design of very high aspect ratio wings with sufficient structural strength is difficult... the aspect ratio of a conventional aircraft is a compromise between conflicting aerodynamic and structural requirements"* [p.445]. La aerodinámica pide AR grande, la estructura pide AR chico. **Es un compromiso multidisciplinario, no un óptimo aerodinámico.** El software debe MOSTRAR la curva C_D,i(AR) y el peso estructural, y dejar que el ingeniero elija. |
| D-02 | Design Box p.462 | **Planta elíptica vs estrechada.** | El caso Spitfire lo demuestra: la elíptica se eligió **por razones de armamento y manufactura**, no aerodinámicas, y *"contributed to production delays"*. El software puede decir cuánto δ cuesta cada λ; no puede saber qué cabe adentro del ala ni qué cuesta fabricarla. |
| D-03 | Design Box p.463 | **Punto de diseño de la misión.** | El U-2 tiene AR=14.3 porque su misión es crucero a 70 000 ft con C_L altísimo. *"it was a point design"*. El punto de diseño es una decisión del cliente, no del solver. |
| D-04 | §5.3.3 p.451 | **Cuánto perseguir la distribución elíptica.** | El libro es explícito: AR pesa mucho más que δ. Un software que "optimiza δ" está optimizando la variable equivocada. **Advertir al usuario.** |
| D-05 | §5.4 p.467 | **El factor de amortiguamiento D de la iteración no lineal.** | *"Experience has found that the iterative procedure requires heavy damping, with typical values of D on the order of 0.05"* [p.467]. Es un parámetro de EXPERIENCIA. El software debe exponerlo, con 0.05 por defecto, y reportar si no convergió en 150 iteraciones. |
| D-06 | §5.4 p.468 | **Confiar o no en el resultado post-pérdida.** | ~20 % de acuerdo con experimento, y la física real es tridimensional con separación en hongo (Fig. 5.31). El software debe MARCAR el resultado como "orientativo" arriba de la pérdida y jamás presentarlo con la misma confianza que el régimen lineal. |
| D-07 | §6.7.1 p.513 | **La sustentación de la combinación ala-fuselaje.** | *"There is no accurate analytical equation... Either the configuration must be tested in a wind tunnel, or a computational fluid dynamic calculation must be made. We cannot even say in advance whether the combined lift will be greater or smaller than the sum of the two parts"* [p.513]. |
| D-08 | §6.7.2 p.514 | **El arrastre de interferencia.** | *"the drag is usually higher than the sum of the separate drag forces on the wing and the body, giving rise to an extra drag component called interference drag"*. El libro remite a Hoerner (Ref. 112): *"The subject of drag prediction is so complex that whole books have been written about it"*. |
| D-09 | §6.7.2 p.515 | **e de Oswald: usar la fórmula de Raymer o un dato medido.** | Raymer da un ajuste empírico *"based on data obtained from actual airplanes"*, y advierte *"should be used for conventional aspect ratios for normal airplanes, and not for the very large aspect ratios (on the order of 25 or higher) associated with sailplanes"* [p.515]. El software debe pedir confirmación fuera del rango. |
| D-10 | §6.7.3 p.521 | **Cuánto creerle a un C_D de CFD.** | Los datos del CAWAPI: 6.7 % de dispersión en C_L pero **21.5 % en C_D** entre 7 códigos. Las tres razones (malla en la pared, modelo de turbulencia, predicción de la separación) están en p.522. **El ingeniero decide la barra de error; el software la declara.** |
| D-11 | §5.6 p.484 | **Radio del borde de ataque en ala delta.** | Redondear el borde sube (L/D)max de 9.3 a 16.5 en subsónico, pero *"leading edges with large radii are not appropriate for supersonic aircraft"* por el arrastre de onda. La excepción del transbordador (calentamiento ∝ 1/√R, y se QUIERE arrastre para frenar) muestra que la decisión depende de la misión completa. |
| D-12 | §9.2 p.628 | **Solución débil o fuerte del choque oblicuo.** | *"In nature, the weak shock solution usually prevails... It is safe to make this assumption, unless you have specific information to the contrary"* [p.628]. El software debe **devolver la débil por defecto y ofrecer la fuerte explícitamente**, nunca escoger en silencio. |
| D-13 | §9.6 Design Box p.660 | **Compresión isentrópica vs choques en una toma supersónica.** | La isentrópica es mejor pero *"it is a point design for the given upstream Mach number"* y en la práctica *"have usually resulted in the wave prematurely coalescing into several weak shock waves"*. Elegir es aceptar un rango de Mach de operación. |
| D-14 | §9.14 p.679-680 | **Nivel aceptable de estampido sónico.** | *"At the time of the design of the Concorde SST during the 1960s, a maximum value of Δp = 2 lb/ft² was considered acceptable. This was an error in judgment"* — y costó la prohibición de vuelo supersónico sobre tierra. El software calcula Δp; **el umbral aceptable es regulatorio y social**. |
| D-15 | §9.10 p.670 | **Aceptar o evitar la interacción choque/capa límite.** | *"usually should be avoided as much as possible... However, this is easier said than done"*, y además *"modern creative ideas have led to the beneficial use of the separated flow... So the picture is not entirely black"*. |
| D-16 | §5.3.4 / §5.4 | **Usar la línea sustentadora o el vortex-lattice.** | El criterio del libro es AR > 4 y ala recta [Design Box, p.474]. En la zona gris (AR 3–5, flecha moderada) el software debe correr AMBOS y mostrar la diferencia, no elegir. |

---

## 5. COSTO DE CÓMPUTO

| Método | § | Costo | Por qué |
|---|---|---|---|
| Relaciones isentrópicas T₀/T, p₀/p, ρ₀/ρ | 8.40-8.43 | **[NAVEGADOR]** | Tres potencias. Microsegundos. |
| Velocidad del sonido `a = √(γRT)` | 8.25 | **[NAVEGADOR]** | Una raíz. |
| Choque normal completo desde M₁ | 8.59-8.73 | **[NAVEGADOR]** | Todas explícitas en M₁. Nanosegundos. |
| Choque normal INVERSO (dado p₂/p₁, T₂/T₁ o M₂ → M₁) | Ej. 8.15-8.19 | **[NAVEGADOR]** | Ec. (8.65) se invierte en cerrado para p₂/p₁; para T₂/T₁ y M₂, bisección de ~40 iteraciones. Sigue siendo microsegundos. |
| Choque oblicuo dado (M₁, β) | 9.13-9.18 | **[NAVEGADOR]** | Directo: β → M_n,1 → todo. |
| **θ-β-M dado (M₁, θ) → β** | 9.23 | **[NAVEGADOR]** para un caso ; **[PRECÓMPUTO]** para la carta | Bisección: ~50 iteraciones = microsegundos. Pero la **carta θ-β-M completa** (la Figura 9.9, que el alumno necesita VER, con rama débil, rama fuerte, locus de θ_max y locus de M₂=1) son ~10⁶ evaluaciones → **precomputar una vez en GPU y servirla como campo/tabla**, con interpolación bilineal en el navegador. Es candidata #1 de precómputo del bloque. |
| **Función de Prandtl-Meyer ν(M)** | 9.42 | **[NAVEGADOR]** directa ; **[PRECÓMPUTO]** la inversa | ν(M) es cerrada. **La inversa M(ν) es implícita** y se necesita en TODA aplicación de expansión. Precomputar `M(ν)` en malla fina de ν ∈ [0°, 130.45°] con paso 0.01° = 13 046 entradas ≈ 100 kB → **búsqueda + interpolación en O(1) en el navegador**. Candidata #2 de precómputo. |
| Tablas de los Apéndices A / B / C | §8.6.1 p.602 | **[PRECÓMPUTO]** | El propio libro dice que las tablas son *"a quick and convenient tool"* y que el equivalente moderno es programar las ecuaciones. Precomputamos las tres tablas completas y las servimos; así reproducimos exactamente los números de los ejemplos. |
| Teoría choque-expansión sobre un perfil de segmentos rectos | §9.7 | **[NAVEGADOR]** | Un choque y una expansión por cara. Decenas de operaciones. **Interactivo con slider de α y de M∞.** |
| **Línea sustentadora, serie de Fourier, N ≤ 64** | 5.51 | **[NAVEGADOR]** | Sistema denso 64×64 → Gauss O(N³) ≈ 2.6e5 flops. **Milisegundos.** Verificado: converge con N=8. Se puede recalcular en cada arrastre de un slider de λ o AR. |
| Línea sustentadora numérica NO LINEAL (post-pérdida) | §5.4 | **[NAVEGADOR]** con paciencia | 50–150 iteraciones × integral de Simpson sobre k+1 estaciones. Con k=101 son ~1.5e6 operaciones → decenas de ms. Aceptable interactivo, pero con barra de progreso. |
| **Barrido δ(λ, AR)** para sustituir la Figura 5.20 | 5.60 | **[PRECÓMPUTO]** | ~50 λ × 30 AR × (solve 64×64) = 1500 solves ≈ segundos en CPU. Se precomputa una vez y se sirve como campo. **Elimina la dependencia de una figura que no podemos leer.** |
| **Vortex-lattice, malla M×N paneles** | §5.5 | **[NAVEGADOR]** hasta ~400 paneles ; **[GPU-VIVO]** arriba de ~2000 | Matriz densa de influencia N×N. N=400 → 160 000 evaluaciones de Biot-Savart + Gauss O(N³)=6.4e7 → ~0.3 s en JS. Medido: Ny=40, Nx=4 (=160 paneles) corre al instante; Ny=120, Nx=10 (=1200 paneles) ya tarda. Para el ala EXTRUIDA en el CAD con malla fina y barridos de α: **iangpu**. |
| Ensamble de la matriz de influencia | §5.5 | **[GPU-VIVO]** si N grande | Es vergonzosamente paralelo (cada AIC[k][m] es independiente) → mapea perfecto a la RTX 4070 Ti. |
| Barrido de polar C_L(α), C_D(α) del ala con VLM | §5.5 / §6.7.2 | **[PRECÓMPUTO]** | La matriz de influencia NO depende de α (ala plana): se **factoriza LU una vez** y se resuelve para cada α con una sustitución O(N²). 40 ángulos ≈ gratis después de la primera factorización. **Este es el truco que hace la polar interactiva.** |
| Flujo sobre cono supersónico (Taylor-Maccoll) | §9.3 / §13.6 | **[PRECÓMPUTO]** | El libro remite al cap. 13. Es una ODE por integrar; precomputar la tabla (M∞, semiángulo) → (β, p_cono). |
| Interacción choque/capa límite | §9.10 | **[GPU-VIVO]** | Exige RANS con modelo de turbulencia (Baldwin-Lomax en la Fig. 9.41). Fuera de alcance del navegador. |
| Onda N del estampido sónico en campo lejano | §9.14 | **[GPU-VIVO]** | *"computational fluid dynamic codes are being developed for calculating both the near field and far field structures of the sonic boom"* [p.681] — problema abierto. |

**Resumen para el arquitecto:** todo el cap. 7, 8 y 9 (salvo el cono y la capa límite) cabe en el navegador
en tiempo real. El cap. 5 cabe en el navegador con la línea sustentadora, y el vortex-lattice cabe hasta
~400 paneles. **Lo que hay que precomputar en la 4070 Ti son tres cosas: la carta θ-β-M, la inversa de
Prandtl-Meyer, y el campo δ(λ, AR)** — las tres reemplazan figuras del libro que no podemos leer.

---

## 6. ESCUELA — lecciones que salen de este bloque

Formato de cada lección: **CONSTRUIR** (qué dibuja el alumno en `forja-brep.html`) → **MOVER** (qué
parámetro toca) → **VER** (qué debe observar) → **VERIFICAR** (contra qué número del libro).

### Unidad AERO-3D: de un perfil a un ala

**L1 — "Tu perfil te mintió"** (el gancho del capítulo)
- **CONSTRUIR:** el alumno croquiza el perfil NACA 23015 y lo EXTRUYE en un ala del Baron 58 (AR=7.61, λ=0.45). El kernel OCCT mide S y b de la geometría real y calcula AR = b²/S.
- **MOVER:** el ángulo de ataque de 0° a 8°.
- **VER:** dos curvas superpuestas — c_l(α) del perfil y C_L(α) del ala. **La del ala tiene menos pendiente y va por debajo.**
- **VERIFICAR:** a α=4°, el perfil da c_l=0.54 y el ala da **C_L=0.443** — 18 % menos. Y C_D pasa de 0.0068 a **0.0148**, más del doble. `FIXTURE anderson-ej-5.4`.

**L2 — "El vórtice que no puede terminar"**
- **CONSTRUIR:** una sola herradura sobre la envergadura del ala del alumno.
- **MOVER:** la posición y a lo largo de la línea ligada.
- **VER:** el downwash w(y) de la Ec. (5.13) **disparándose a −∞ en las puntas**. Es visualmente absurdo.
- **VERIFICAR:** w(y=0) = −Γ/(πb) por la Ec. (5.13). Luego el alumno agrega 3, 10, 100 herraduras y ve la singularidad DISOLVERSE en la distribución continua de la Fig. 5.15. **Esa es la reproducción del descubrimiento de Prandtl.**

**L3 — "El precio de volar: el arrastre inducido"**
- **CONSTRUIR:** el mismo ala.
- **MOVER:** el alargamiento AR de 4 a 20 manteniendo S constante (el CAD estira la envergadura y encoge la cuerda).
- **VER:** tres cosas al mismo tiempo — (1) C_D,i cae como 1/AR; (2) la barra de arrastre parásito NO cambia; (3) el ala se ve cada vez más como un listón de persiana veneciana.
- **VERIFICAR:** `C_D,i = C_L²/(πeAR)`. Con AR=8, λ=0.8, α=5° → C_D,i = 0.00789. `FIXTURE anderson-ej-5.1`.
- **REMATE:** el alumno lee la cita de p.451: el factor #1 NO es parecerse a la elipse, es subir AR.

**L4 — "La elipse es el óptimo, y casi no vale la pena perseguirla"**
- **CONSTRUIR:** dos alas de la MISMA S y el MISMO AR: una elíptica, una estrechada con λ ajustable.
- **MOVER:** λ de 0 a 1.
- **VER:** la distribución L'(y) del ala estrechada acercándose y alejándose de la elipse, y el número e subiendo hacia 1.
- **VERIFICAR:** la elíptica DEBE dar **δ = 0 y e = 1 exactos** (`FIXTURE anderson-inv-elipse`, verificado por mí a 1e−6). Y el mínimo de δ debe aparecer cerca de **λ ≈ 0.35–0.4** con e ≈ 0.987 — es decir, a **1.3 % del óptimo**. Ahí el alumno entiende por qué casi ningún avión tiene ala elíptica.
- **HISTORIA:** el Spitfire la tuvo por las ametralladoras, no por aerodinámica [Design Box, p.462].

**L5 — "Coeficiente ≠ fuerza"**
- **CONSTRUIR:** un avión completo con peso W dado.
- **MOVER:** la envergadura b manteniendo S fija.
- **VER:** C_D,i baja (∝1/AR) **y al mismo tiempo** la FUERZA D_i baja como (W/b)².
- **VERIFICAR:** `D_i = (1/(πe q∞))(W/b)²` (Ec. 5.74). El alumno debe poder explicar por qué el AR no aparece explícitamente ahí.
- **REMATE:** la gráfica de barras de la Fig. 5.27 — inducido ≈ 25 % del arrastre en crucero, **≥ 60 % en despegue**.

**L6 — "Cuando la línea sustentadora deja de ver"**
- **CONSTRUIR:** un ala de AR=2 y un ala delta.
- **MOVER:** el AR de 8 hacia 1.
- **VER:** las tres curvas de pendiente separándose: Prandtl (5.69), Helmbold (5.81) y el vortex-lattice.
- **VERIFICAR:** a AR=1, Helmbold da **1.483 /rad** y el VLM da **1.497** (0.9 %), mientras Prandtl da 2.094 (¡41 % alto!). Verificado por mí. La regla de dedo del libro (**AR > 4**) queda demostrada, no memorizada.

### Unidad COMPRESIBLE: cuando la densidad deja de ser constante

**L7 — "¿Cuándo se acaba Bernoulli?"**
- **CONSTRUIR:** una tobera convergente en el CAD.
- **MOVER:** la velocidad de salida de 0 a 900 ft/s.
- **VER:** las dos curvas de presión (Bernoulli vs energía compresible) separándose.
- **VERIFICAR:** el ejemplo de p.586 — a 350 ft/s (M=0.317) la diferencia es **0.2 %** (1970 vs 1974 lb/ft²); a 900 ft/s (M=0.86) es **13 %** (1153 vs 1300). `M > 0.3 ⇒ compresible` queda ganado con números.

**L8 — "El error de Newton"**
- **CONSTRUIR:** nada; es una lección de historia con cálculo.
- **MOVER:** el supuesto — isotérmico vs isentrópico.
- **VER:** un factor √γ entre las dos respuestas.
- **VERIFICAR:** `FIXTURE anderson-ej-8.5`. Isotérmico da 943.5 ft/s, 15 % bajo del real 1117 ft/s. Newton publicó 979 y culpó al polvo. **Laplace tardó un siglo en darse cuenta de que la onda es adiabática.**

**L9 — "El choque normal en un solo parámetro"**
- **CONSTRUIR:** un ducto con un choque normal adentro.
- **MOVER:** M₁ de 1 a 10.
- **VER:** la Fig. 8.8 dibujándose en vivo: p₂/p₁ y T₂/T₁ disparándose; ρ₂/ρ₁ **saturando en 6**; M₂ saturando en 0.378; **p₀,₂/p₀,₁ desplomándose**.
- **VERIFICAR:** `FIXTURE anderson-ej-8.11` (M₁=2: p₂=4.5 atm, T₂=486 K, u₂=255 m/s) y `FIXTURE anderson-inv-limites-M-inf`.
- **PRUEBA DE LA 2ª LEY:** el alumno mete M₁ = 0.8. **El software debe negarse** y mostrar que Δs saldría negativo.

**L10 — "Por qué existe el SCRAMjet"** ← lección estelar del cap. 8
- **CONSTRUIR:** el ducto de un ramjet (toma, combustor, tobera) en el CAD.
- **MOVER:** el Mach de vuelo de 2 a 10.
- **VER:** la temperatura del aire que ENTRA al combustor subiendo de 399 K a 4653 K, y la presión de 1.42 atm a 32.7 atm.
- **VERIFICAR:** `FIXTURE anderson-ej-8.13` y `anderson-ej-8.14`.
- **REMATE:** a 4653 K el combustible **se descompone en vez de quemarse**. La única salida es no frenar el flujo a subsónico ⇒ combustión supersónica ⇒ SCRAMjet ⇒ X-43 (Mach 10, 2004) y X-51.

**L11 — "θ-β-M: la carta que gobierna lo supersónico"** ← lección estelar del cap. 9
- **CONSTRUIR:** una cuña en el croquis con semiángulo acotado.
- **MOVER:** el semiángulo θ y el Mach M₁.
- **VER:** el choque oblicuo dibujado en la escena, **la carta θ-β-M con el punto de operación moviéndose**, las dos ramas (débil y fuerte), y el momento en que el punto cruza θ_max y **el choque se desprende y se curva**.
- **VERIFICAR:** `FIXTURE anderson-ej-9.2` (M=2, θ=20° → β=53.4°, p₂=2.82 atm) y `FIXTURE anderson-inv-thetamax` (M=2 → θ_max=22.97°; el libro dice que a M=2 se desprende arriba de 23° [p.630] ✅).
- **LO CONTRAINTUITIVO QUE HAY QUE VER:** el alumno fija θ=20° y sube M de 2 a 5. **β BAJA de 53.4° a 29.9° pero p₂/p₁ SUBE de 2.82 a 7.07.** Menos ángulo, choque más fuerte. Ese momento vale la lección entera.

**L12 — "La toma de aire que no tira la presión"**
- **CONSTRUIR:** dos tomas supersónicas: una de choque normal, una con cono de choque oblicuo (Fig. 9.15).
- **MOVER:** M∞.
- **VER:** las dos pérdidas de p₀ lado a lado.
- **VERIFICAR:** `FIXTURE anderson-ej-9.5` — el sistema oblicuo+normal conserva **76 % más presión total** que el normal solo, a M=3. Y `FIXTURE anderson-ej-9.11` vs `9.10`: la compresión isentrópica no pierde NADA de p₀, pero solo funciona en su Mach de diseño.

**L13 — "El abanico de Prandtl-Meyer"**
- **CONSTRUIR:** una esquina convexa.
- **MOVER:** el ángulo de deflexión θ.
- **VER:** el abanico abriéndose entre μ₁ y μ₂; M subiendo; p, T, ρ bajando; **p₀ y T₀ QUIETOS** (es isentrópico).
- **VERIFICAR:** `FIXTURE anderson-ej-9.9` — M=1.5→2.0, p de 1 a 0.469 atm, T de 288 a 232 K, μ₁=41.81°, línea trasera a 15°.
- **LÍMITE:** el alumno sigue expandiendo hasta ν_max = **130.45°** y ve que el gas ya no puede seguir la pared. `FIXTURE anderson-inv-numax`.

**L14 — "Arrastre sin viscosidad"**
- **CONSTRUIR:** un perfil rómbico supersónico con espesor y ángulo variables, dibujado con cotas en el croquis.
- **MOVER:** α y M∞.
- **VER:** las presiones sobre las cuatro caras; la resultante; **y que a α=0 la sustentación es CERO pero el arrastre NO**.
- **VERIFICAR:** `FIXTURE anderson-ej-9.12` (placa plana M=3, α=5° → c_l=0.125, c_d=0.011) y `FIXTURE anderson-ej-9.6` (cuña 15° a M=5 → c_d=0.114).
- **REMATE:** el alumno debe poder decir con sus palabras: *en supersónico no hay paradoja de d'Alembert; el arrastre de onda es el precio de la entropía que generan los choques.*

**L15 — "La cola de cuña del X-15"** ← lección de cierre, historia + diseño
- **CONSTRUIR:** dos colas verticales: perfil delgado y **cuña de 10° incluido**.
- **MOVER:** el ángulo de deslizamiento (yaw).
- **VER:** la fuerza lateral restauradora de cada una.
- **VERIFICAR:** el libro reporta c_l = 0.126 (placa) vs 0.241 (cuña) a M=7, α=10°. **⚠️ Yo recalculé con la Ec. (9.23) exacta y da 0.122 vs 0.203 (razón 1.61, no 2.0).** La lección de diseño no cambia; el número sí. **Esta lección debe enseñar AMBOS y por qué difieren** — es la mejor oportunidad de todo el curso para enseñar que *leer una carta no es lo mismo que resolver la ecuación*.
- **HISTORIA:** C. H. McLellan del NACA Langley calculó esto años antes; el equipo del X-15 lo sacó del estante para resolver un problema de estabilidad que había hundido al X-1 y al X-2. *"theoretical aerodynamic research, done to extend the aerodynamic state of the art, was taken off the library shelves later on to solve a show-stopping problem"* [p.668].

**L16 — "El estampido sónico"** (lección de impacto)
- **CONSTRUIR:** el perfil rómbico de L14 volando a altitud h.
- **MOVER:** M∞ y h.
- **VER:** la onda en N propagándose al suelo; Δt = λ/V∞ entre los dos booms.
- **VERIFICAR:** el Concorde a M=2 y 50 000 ft: a = √(1.4·1716·390) = 968 ft/s, V∞ = 1936 ft/s, con λ=200 ft → **Δt = 0.103 s**, justo en el umbral del oído humano [p.679].
- **REMATE:** Δp = 2 lb/ft² se consideró aceptable en los 60 y **fue un error de juicio que le costó al Concorde la prohibición de vuelo supersónico sobre tierra**. La mitigación de hoy es por FORMA (Fig. 9.44-9.46).

### Lecciones transversales

**LT-1 — "El coeficiente no necesita ni la presión ni la velocidad"** [§9.3.1 p.637, §9.8 p.664]
El alumno resuelve el Ej. 9.6 y descubre que solo necesitó forma, α y M∞. Es la verificación viva del
análisis dimensional del cap. 1.

**LT-2 — "El alivio tridimensional"** [§6.4.1 p.506, §9.3 p.635]
Misma física, dos escenarios: esfera vs cilindro (V_max 1.5V∞ vs 2V∞) y cono vs cuña (β=37° vs 53.3°).
Verificar con `C_p = 1 − (9/4)sin²θ` (Ec. 6.20).

**LT-3 — "Cuánto le crees a un número de CFD"** [§6.7.3 p.521]
Tabla 6.1 en pantalla: 7 códigos, 6.7 % de dispersión en C_L, **21.5 % en C_D**. El ingeniero debe salir
sabiendo que **la sustentación se calcula bien y el arrastre no**.

---

## 7. NO OBSERVADO — figuras y tablas que eran imagen

El texto viene de `pdftotext`. Lo siguiente **NO lo pude leer** y **no lo inventé**:

### Figuras cuyos DATOS son necesarios para reproducir ejemplos del libro

| Figura | p. | Qué contiene | Impacto |
|---|---|---|---|
| **Fig. 5.2 a/b** | 425-426 | Datos de túnel del perfil **NACA 23015**: c_l(α), c_m,c/4(α), c_d(c_l), c_m,ac(c_l) a Re = 2.6e5, 6e5, 8.9e5. | **ALTO.** El Ej. 5.4 saca de ahí α_L=0 = −1°, a₀ = 0.113/deg y c_d = 0.0065. Sin la figura, esos tres valores son ENTRADAS del fixture, no derivables. La posición del centro aerodinámico SÍ está en texto (tabla embebida: x/c = .231/.239/.243, y/c = .050/.043/.021). |
| **Fig. 5.20** | 452 | **δ (factor de arrastre inducido) vs razón de estrechamiento λ, para distintos AR.** Cálculo de McCormick con ~50 términos. | **ALTO — la peor pérdida del bloque.** Los Ejs. 5.1 (δ=0.055) y 5.4 (δ=0.01) leen de ahí. Yo calculé δ con la Ec. (5.60) del propio libro y obtuve 0.0444 y 0.0137 — mismo orden pero ~15–20 % abajo, y **no puedo determinar si el error es mío o de la lectura de carta del libro**. `MITIGACIÓN: precomputar el campo δ(λ, AR) con la Ec. (5.60) (§5) y usarlo como fuente propia, exponiendo el δ de carta como override.` |
| **Fig. 9.9 a/b** | 625-626 | **El diagrama θ-β-M** (NACA Report 1135). Dos páginas de gráfica. | **MEDIO-BAJO.** La Ec. (9.23) está completa en el texto, así que la figura es reemplazable al 100 % por cálculo — y de hecho la reemplacé y la usé para AUDITAR las lecturas del libro (encontré el error de 1.9° del Ej. 9.13). Sin embargo, los valores exactos de los loci de θ_max y de M₂=1 que el libro dibuja no los pude leer; los recalculé (ver §2.5). |
| **Apéndices A, B, C** | — | Tablas de flujo isentrópico, choque normal y Prandtl-Meyer para γ=1.4. **Están fuera de mi rango de líneas.** | **BAJO.** Todas las ecuaciones que generan esas tablas están en el texto (8.40, 8.42, 8.43, 8.59, 8.61, 8.65, 8.67, 8.73, 8.80, 9.42). Las regeneramos nosotros. `NOTA: los ejemplos del libro usan la "entrada más cercana" de tabla, así que reproducirlos exactamente exige o bien redondear igual, o bien aceptar diferencias de ~0.5 %.` |
| **Apéndices D, E** | — | Atmósfera estándar (SI y English). Fuera de rango. | **NINGUNO.** Ya tenemos `src/aero/atmosfera.ts` (ISA). Los valores usados en los ejemplos (10 km: p=2.65e4 N/m², T=223.3 K; 25 km: p=2.5273e3, T=216.66 K; 36 000 ft: p=476 lb/ft², T=391 °R; 10 000 ft: p=1455.6 lb/ft², T=483.04 °R; 20 000 ft: p=973.3 lb/ft²) los cité del texto de los propios ejemplos. |
| **Fig. 1.58** | — | Desglose de arrastre del Seversky XP-41 (18 condiciones). Fuera de rango. | **MEDIO** para el Ej. 6.1. Los dos números que se usan (C_D=0.0275, C_L=0.15, condición 18) SÍ están en el texto del ejemplo. |

### Figuras cualitativas (no bloquean nada, pero se pierden como material didáctico)

Fig. 5.1 (tres vistas Baron 58) · 5.3 (flujo sobre ala finita) · 5.4 (vórtices de punta) · 5.5 (foto de
vórtices) · 5.6 (efecto del downwash — **contiene la definición gráfica de α, α_i, α_eff que SÍ está
transcrita en texto**) · 5.7 (mapa del cap.) · 5.8–5.10 (Biot-Savart) · 5.11 (distribución de sustentación)
· 5.12–5.15 (herradura y línea sustentadora) · 5.16 (AR alto vs bajo) · 5.17 (elipse-elipse-downwash
constante) · 5.18 (plantas rectas) · 5.19 (tres vistas Spitfire) · **5.21/5.22 (datos clásicos de Prandtl
1915: C_L vs C_D para AR 1 a 7, y escalados a AR=5)** · 5.23 (curvas de sustentación infinita vs finita) ·
**5.24/5.25 (C_L vs α de Prandtl para AR 1 a 7, y escalados)** · 5.26 (tres vistas U-2) · **5.27 (barras de
inducido vs parásito en crucero y despegue — los porcentajes 25 % y 60 % SÍ están en texto)** · 5.28
(estaciones numéricas) · 5.29/5.30 (comparación teoría-numérico y C_L hasta 50°) · 5.31 (foto de flujo con
aceite en ala en pérdida) · 5.32/5.33 (plantas donde no vale LL; superficie sustentadora) · 5.34 (velocidad
inducida) · **5.35/5.36 (LA MALLA DE HERRADURAS — las reglas l/4 y 3l/4 SÍ están en texto)** · **5.37
(pendiente vs AR: Helmbold vs Prandtl vs experimento)** · 5.38 (geometría de ala en flecha) · 5.39/5.40
(F-102A, transbordador, cuatro deltas) · 5.41–5.49 (vórtices de borde de ataque en delta, C_p spanwise,
C_L vs α, L/D, ruptura de vórtice, CFD a 5/15/40°) · 5.50/5.51 (dibujo de Lanchester, retrato de Prandtl).

Fig. 6.1–6.5 (fuente 3D, doblete, esfera) · **6.6 (C_p esfera vs cilindro — las ECUACIONES 6.19/6.20 SÍ
están)** · 6.7/6.8 (paneles 3D; el 747 con el transbordador) · 6.9/6.10 (fotos laminar/turbulento sobre
esfera) · **6.11 (C_D vs Re de la esfera — los valores 0.4 → 0.1 y Re_crit ≈ 3e5 SÍ están en texto)** ·
6.12 (ala-fuselaje) · **6.13 (C_L, C_D y L/D típicos vs α)** · 6.14 (tres vistas F-16XL).
**Tabla 6.1 SÍ está transcrita completa** (7 investigadores, C_L y C_D) ✅

Fig. 7.1–7.6 (mapa, sistema termodinámico, compresibilidad, adiabático/isentrópico, choques oblicuo y
normal, schlieren de Mercury/X-15/transbordador/X-43).

Fig. 8.1–8.5, 8.7 (mapa, choque normal, onda de sonido, ejemplo de perfil, condiciones totales) ·
**8.6 (ρ/ρ₀ vs M — el criterio "5 % a M=0.32" SÍ está en texto)** · **8.8 (todas las propiedades del choque
normal vs M₁ — todas las ECUACIONES están)** · 8.9 (ramjet) · 8.10 (Pitot sub y supersónico) · 8.11 (SR-71).

Fig. 9.1 (patrón de ondas del transporte supersónico a M=1.7) · 9.2–9.8 (esquinas, propagación de
perturbaciones, "beeper", ángulo de Mach, mapa del cap., geometría del choque oblicuo) · 9.10–9.15
(adherido/desprendido, débil/fuerte, efectos de M y θ, ejemplo, tomas) · 9.16 (cuña vs cono) · 9.17 (cuña
del Ej. 9.6) · 9.18 (foto X-15) · 9.19–9.25 (reflexiones, intersecciones, cuerpo romo, θ-β-M del romo,
Prandtl-Meyer) · 9.26–9.28 (expansión) · 9.29–9.35 (X-51, X-43, vehículo hipersónico genérico, flujo por
el SCRAMjet, diseño conceptual de Billig, tres vistas X-43, compresión isentrópica vs choque) · 9.36/9.37
(placa plana y rombo — **las ECUACIONES 9.46-9.49 SÍ están**) · 9.38/9.39 (cola de cuña del X-15 y su
esquema de flujo) · 9.40/9.41 (interacción choque/capa límite y sus distribuciones de p y τ_w — **el dato
"4 espesores aguas arriba" SÍ está en texto**) · 9.42/9.43 (volumen de control y onda N) ·
9.44–9.46 (planta de bajo boom, nariz conformada, comparación de firmas — **los valores 1.2 → 0.8 lb/ft²
y 20 ms SÍ están en texto**).

**Tabla del Design Box de SCRAMjet (p.657)** — SÍ está transcrita: M∞ = 7/10/15/20 con altitud, M₄, A₀/A₄,
p₄/p∞, p₄, T₄, V₄. **Es un fixture aprovechable para el bloque de propulsión.** ✅

---

## 8. LO QUE MÁS ME SORPRENDIÓ

**1. El libro se equivoca al leer su propia carta, y se equivoca justo en el ejemplo estrella.**
Verifiqué 12 lecturas de la Figura 9.9 contra la Ec. (9.23) exacta. Once salieron a ≤ 0.12°. Una —la del
Ejemplo 9.13, la cola de cuña del X-15, el ejemplo de diseño que cierra el capítulo— salió a **1.9°**
(β=23.5° leído vs 21.60° exacto). Eso propaga a un c_l 16 % alto y convierte la conclusión "la cuña da el
DOBLE" en "la cuña da 1.6 veces". La conclusión de ingeniería sobrevive; el número no. **Una máquina que
solo transcribe habría copiado 0.241 como verdad.** El valor de recalcular todo no es pedantería: es que
el cliente va a construir software con estos números.

**2. El libro usa `δ = τ` como muleta, y no es cierto.** Los Ejemplos 5.1, 5.2 y 5.4 dicen "assume that
δ = τ" porque el libro **nunca da la fórmula de τ**, solo dice que suele valer entre 0.05 y 0.25. Despejé
τ de la Ec. (5.70) usando la `a` que sale del solver de Fourier y obtuve valores de 0.047 a 0.225 —
**exactamente el rango que el libro declara**, lo que valida la derivación— y resultó que **τ ≈ 3δ**. La
suposición del libro es una comodidad pedagógica, no física. En el Ej. 5.4 el efecto es de ~1 %; a AR bajo
sería mayor.

**3. El arrastre inducido como FUERZA no depende del alargamiento.** Todo el capítulo martilla que
`C_D,i ∝ 1/AR`, y luego una Design Box en la p.464 revela que en vuelo recto y nivelado
`D_i = (1/πeq∞)(W/b)²` — **la carga de envergadura, no el AR**. Como S suele estar fijada por la velocidad
de pérdida, subir b sube AR y baja D_i simultáneamente, y por eso el resultado se confunde con el otro.
Es la distinción coeficiente/fuerza más sutil del libro y **una máquina lineal la resume como "el AR baja
el arrastre inducido" y pierde la mitad de la física**.

**4. El ala elíptica del Spitfire no fue por aerodinámica.** Fue porque Mitchell tenía que meter ocho
ametralladoras 0.303 fuera del disco de la hélice y el ala estrechada no tenía cuerda suficiente ahí.
La eficiencia aerodinámica fue *"only a by-product of a practical design solution"* y el ala elíptica
**retrasó la producción justo antes de la guerra**. El ícono aerodinámico más famoso de la historia es en
realidad un caso de restricción de armamento. Esto es exactamente lo que el CONTRATO llama "requisito
funcional dicho en prosa": el software debe permitir restricciones geométricas de empaquetado, no solo
optimizar δ.

**5. El vortex-lattice da bien la sustentación y mal el arrastre — y lo mismo le pasa al CFD moderno.**
Implementé el VLM y verifiqué el C_L contra tres referencias independientes (límite 2D → 2π; Helmbold a
AR bajo; tendencia de Küchemann con flecha). Todo bien. Luego calculé el C_D,i por campo cercano y
**falló la prueba más elemental: el ala elíptica salió PEOR que la rectangular**, lo cual es imposible.
Y 40 años después, la Tabla 6.1 del libro muestra siete códigos CFD modernos sobre el F-16XL con
**6.7 % de dispersión en C_L y 21.5 % en C_D**. Es el mismo patrón, del método más simple al más caro:
**la sustentación se calcula; el arrastre se estima.** Prefiero entregar ese hueco declarado que una
fórmula bonita que devuelva un número falso.

**6. La "física" del cap. 8 es en realidad una lección sobre la 2ª ley.** Las ecuaciones del choque normal
son perfectamente felices con M₁ < 1 — continuidad, cantidad de movimiento y energía no tienen opinión.
Lo único que prohíbe el choque de expansión es **la entropía**. El libro lo dice en una sola frase
[p.591] pero es el punto más profundo del capítulo: hay soluciones matemáticas que la naturaleza rechaza,
y el software tiene que rechazarlas también, con un error explícito y no con un número.

**7. Newton se equivocó por 15 % y culpó al polvo.** Newton midió bien (los artilleros del siglo XVII ya
tenían 1140 ft/s, contra 1117 real) y calculó mal por suponer la onda **isotérmica** en vez de adiabática.
El error es exactamente √γ = 1.183. Cuando su cálculo dio 943 ft/s en vez de 1140, *"Newton tried to
explain away the differences as due to the presence of dust particles and water vapor in the atmosphere"*.
Tardó **un siglo** hasta que Laplace corrigió el supuesto. Es la mejor lección de humildad del libro y
merece una lección propia en la escuela.

**8. El SCRAMjet no es una moda: es aritmética.** Los Ejemplos 8.13 y 8.14 son el mismo motor a M=2 y M=10.
A M=2 el aire entra al combustor a 399 K y 1.42 atm — cómodo. A M=10 entra a **4653 K y 32.7 atm** — el
combustible se descompone antes de quemarse y la cámara tendría que ser un tanque de presión. Dos cuentas
de tres líneas cada una y queda demostrado que **el ramjet convencional no puede existir en hipersónico**.
Esa es la clase de argumento que convence a un ingeniero.

**9. El estampido sónico fue un error de juicio documentado.** *"a maximum value of Δp = 2 lb/ft² was
considered acceptable. This was an error in judgment because soon after the Concorde went into service...
nations all over the world began to ban supersonic flight of the Concorde over land, severely hurting the
economic value of the airplane"* [p.679]. Y el remate: al momento de escribirse el libro, **las
prohibiciones siguen vigentes**. Un umbral mal puesto mató comercialmente al avión. El software puede
calcular Δp; el umbral es una decisión con consecuencias de décadas.

**10. La investigación "inútil" del NACA salvó al X-15.** C. H. McLellan calculó por teoría el efecto de
la forma del perfil sobre la fuerza normal en hipersónico, sin una aplicación concreta. Años después el
X-15 se topó con el mismo problema de estabilidad direccional que había atormentado al X-1 y al X-2, y la
solución **estaba en el estante**: la cola de cuña de 10°. *"theoretical aerodynamic research, done to
extend the aerodynamic state of the art, was taken off the library shelves later on to solve a
show-stopping problem of major importance to the practical design of a pioneering airplane"* [p.668].

---

## Apéndice A — Auditoría del código que ya existe: `src/aero/cuna-anderson.ts`

El contrato pide no reinventar. Revisé `betaChoqueOblicuo()` contra el cap. 9.

**Lo que está BIEN** ✅
- La Ec. (9.23) está implementada **literalmente correcta**, sin inventos.
- La bisección converge y **reproduce el θ pedido con error < 1e−3°** en los 13 casos que probé.
- Los valores concuerdan con las lecturas del libro: M=2,θ=20°→53.42° (libro 53.4) · M=3.6,θ=10°→23.90°
  (libro 24) · M=5,θ=15°→24.32° (libro 24.2) · M=10,θ=15°→19.94° (libro 20) · M=3,θ=5°→23.13° (libro 23.1).
- Escoge correctamente la **rama débil**, que es lo que manda el libro [p.628].

**Dos defectos que MEDÍ y hay que arreglar** ⚠️

1. **No detecta el choque desprendido.** Si θ > θ_max la función **devuelve 65.000° en silencio** — el
   tope del bracket— y ese β no satisface nada. Casos que reproduje:
   | Entrada | `betaChoqueOblicuo` devuelve | θ real de ese β | Debería |
   |---|---|---|---|
   | M=2, θ=30° | 65.000° | 22.97° | ERROR: desprendido (θ_max=22.97°) |
   | M=1.5, θ=20° | 65.000° | 12.06° | ERROR: desprendido (θ_max=12.11°) |
   | M=3, θ=40° | 65.000° | 34.07° | ERROR: desprendido (θ_max=34.07°) |
   Esto viola el requisito **R-52** y la física de la Fig. 9.10. Es el bug más peligroso: devuelve un
   número plausible para una situación imposible.

2. **El bracket superior de 65° recorta soluciones válidas.** El β de θ_max vale **66.6°** a M=1.5, **66.1°**
   a M=4, **67.5°** a M=10 y **67.8°** en el límite M→∞. Todo lo que caiga entre 65° y ese valor es
   inalcanzable. Medido: M=10, θ=44.3° → la función da 65.000° cuando el correcto es **65.47°**.

**Corrección propuesta** (mínima, sin reescribir):
```ts
// 1) calcular beta en theta_max (maximo de theta(beta) en la rama debil) por
//    busqueda dorada/ternaria en beta ∈ (asin(1/M), 90°)
// 2) si theta > thetaMax  ->  devolver null / lanzar "choque desprendido"
// 3) bisecar en [asin(1/M), betaEnThetaMax]  (rama DEBIL)
//    y opcionalmente en [betaEnThetaMax, 90°] para la rama FUERTE (requisito R-53)
```
Tabla de referencia para la prueba: θ_max = 12.11° (M=1.5) · 22.97° (M=2) · 34.07° (M=3) · 38.77° (M=4) ·
41.12° (M=5) · 43.25° (M=7) · 44.43° (M=10) · 45.29° (M=20) · **45.58° (M→∞, el libro declara 45.5° ✅)**.

**Lo demás del archivo** (`cunaAnderson()`, integración de p y τ por paneles, Ej. 1.1) queda fuera de mi
rango de capítulos y no lo audité.

---

## Apéndice B — Índice rápido de ecuaciones del bloque

| Ec. | p. | Qué es |
|---|---|---|
| 5.1 | 428 | α_eff = α − α_i |
| 5.4 | 432 | C_D = c_d + C_D,i |
| 5.5 | 432 | **Biot-Savart** |
| 5.10 / 5.11 | 434/435 | Filamento infinito Γ/2πh / semi-infinito Γ/4πh |
| 5.15 | 439 | Downwash de la lámina de estela |
| 5.18 | 440 | α_i(y₀) en función de dΓ/dy |
| **5.23** | **441** | **ECUACIÓN FUNDAMENTAL de la línea sustentadora** |
| 5.26 / 5.30 | 441/442 | C_L y C_D,i a partir de Γ |
| 5.31 | 442 | Distribución elíptica |
| 5.35 / 5.42 / 5.43 | 443/444/444 | w constante / α_i = C_L/πAR / **C_D,i = C_L²/πAR** |
| **5.48** | **447** | **Serie de Fourier para Γ** |
| **5.51** | **447** | **Ecuación de colocación (la que se resuelve)** |
| 5.53 | 448 | C_L = A₁·π·AR |
| 5.57 | 449 | α_i(θ) de los A_n |
| **5.60 / 5.61 / 5.62** | **449** | **δ = Σn(A_n/A₁)² / C_D,i(1+δ) / C_D,i = C_L²/πeAR** |
| 5.65 | 452 | Escalado entre alargamientos |
| **5.69 / 5.70** | **455** | **a elíptica / a general con τ** |
| 5.74 | 464 | **D_i = (1/πeq∞)(W/b)²** |
| 5.75/5.76 | 466 | Método numérico no lineal (Simpson) |
| 5.80 | 472 | Superficie sustentadora |
| **5.81 / 5.82** | **474** | **Helmbold (AR bajo) / Küchemann (flecha)** |
| 6.19 / 6.20 | 506 | Esfera: V_θ = 1.5V∞ sinθ / C_p = 1−(9/4)sin²θ |
| **6.24 / 6.25** | **515** | **Polar del avión / e de Oswald (Raymer)** |
| 6.27 / 6.29 | 518/519 | C_D,o = C_L²/πeAR en (L/D)max / **(L/D)max** |
| 7.1 / 7.6 / 7.9 / 7.10 | 530/531/532 | p=ρRT / e=c_vT, h=c_pT / c_p / c_v |
| 7.25 / 7.26 | 538 | Δs (T,p) / Δs (T,v) |
| **7.32** | **539** | **Relaciones isentrópicas** |
| 7.54 / 7.55 | 547 | h + V²/2 = h₀ / h₀ = const |
| **8.18 / 8.23 / 8.25** | **570** | **a = √(∂p/∂ρ)_s / √(γp/ρ) / √(γRT)** |
| 8.27 | 571 | a = √(1/ρτ_s) |
| 8.33 / 8.35 / 8.37 | 577/578 | Energía con a₀ / con a* / relación a₀-a* |
| **8.40 / 8.42 / 8.43** | **579** | **T₀/T, p₀/p, ρ₀/ρ en función de M** |
| 8.44-8.46 | 580 | T*/T₀, p*/p₀, ρ*/ρ₀ |
| 8.48 | 581 | M*² en función de M² |
| **8.55 / 8.57** | **588** | **Relación de Prandtl a*²=u₁u₂ / M*₂=1/M*₁** |
| **8.59 / 8.61 / 8.65 / 8.67** | **588-589** | **Choque normal: M₂, ρ₂/ρ₁, p₂/p₁, T₂/T₁** |
| 8.68 / 8.73 | 590/592 | Δs / p₀,₂/p₀,₁ = e^(−Δs/R) |
| 8.74 / **8.80** | 603/**605** | Pitot subsónico / **Rayleigh supersónico** |
| **9.1** | **618** | **μ = arcsin(1/M)** |
| 9.5 / **9.13** | 621/**623** | w₁=w₂ / **M_n,1 = M₁ sin β** |
| 9.14-9.17 | 623 | Choque oblicuo vía M_n,1 |
| 9.18 | 623 | M₂ = M_n,2/sin(β−θ) |
| **9.23** | **624** | **θ-β-M** |
| **9.42 / 9.43** | **653** | **ν(M) de Prandtl-Meyer / θ = ν(M₂)−ν(M₁)** |
| 9.44 / 9.45 | 653 | T₂/T₁ y p₂/p₁ a través de la expansión |
| **9.46-9.49** | **661-662** | **Choque-expansión: placa plana y rombo** |
| C9.9 | 677 | Arrastre de onda ↔ aumento de entropía |
| — | 648 | **Crocco:** T∇s = ∇h₀ − V×(∇×V) |
