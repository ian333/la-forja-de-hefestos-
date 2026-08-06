# Bertin & Cummings, *Aerodynamics for Engineers* 6ª ed. — caps 10–14 — Supersónico, hipersónico, DISEÑO y el CATÁLOGO DE HERRAMIENTAS

Fuente: `docs/forja-research/manuales/aero/txt/bertin.txt`, líneas 31418–46951 (leído completo, sin muestreo).
Fecha del análisis: 2026-08-04. Autor: agente de pliego (bloque caps 10–14).
Contrato: `docs/forja-research/aero-pliego/CONTRATO.md` (7 reglas duras). Español mexicano.

Convención de cita: `[§X.Y, p.NNN]` donde p.NNN es la página impresa del libro (tomada del
encabezado corrido del `pdftotext`). Cuando cito literal, va entre comillas y en inglés; la
traducción viene después, nunca en vez.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

Este bloque cierra el libro. Son cinco capítulos que van de la física más dura (ondas de choque
sobre un perfil delgado) hasta la conversación más directa que el cliente tiene con nosotros:
**qué software usa, cuánto le cuesta, y en qué NO confía.**

| Cap | Título | Páginas | Qué es para el cliente |
|---|---|---|---|
| 10 | Two-Dimensional, Supersonic Flows Around Thin Airfoils | 551–576 | El **motor 2D supersónico**: tres teorías (lineal/Ackeret, Busemann 2º orden, choque-expansión) con el MISMO ejemplo resuelto por las tres. Es el mejor banco de fixtures del bloque. |
| 11 | Supersonic Flows Over Wings and Airplane Configurations | 577–648 | El **motor 3D supersónico**: borde de ataque subsónico vs supersónico, flujo cónico, vortex-lattice supersónico, cuerpo esbelto, drag de base, interacción aerodinámica. Y §11.8: **dónde la teoría lineal MIENTE**. |
| 12 | Hypersonic Flows | 649–710 | El régimen que le abre al cliente reentrada y vehículos de alta velocidad. La aproximación **newtoniana es aritmética pura: corre en el navegador**. Y el capítulo donde el libro admite que la transición de capa límite es incierta por un factor de 3. |
| **13** | **Aerodynamic Design Considerations** | **711–774** | **La entrevista de requisitos.** Alta sustentación, reducción de arrastre, dispositivos de punta de ala, canard vs cola vs sin cola, y cinco historias de caso reales (EA-6B, F-16, F-15, F-22, F-35) donde el libro dice *qué se decidió y por qué*. |
| **14** | **Tools for Defining the Aerodynamic Environment** | **775–791** | **La especificación del producto, dicha por el cliente.** Catálogo completo del oficio: semi-empírico → paneles → Euler → dos capas → Navier-Stokes/PNS, más túnel de viento y vuelo. Con costos relativos, fidelidades, errores típicos y la doctrina de verificación/validación/calibración/certificación. |

**Por qué importa a La Forja.** Raymer nos dio el PROCESO y Anderson el MOTOR. Bertin caps 13–14
nos da **la arquitectura del producto**: el cliente no quiere "un CFD"; quiere una *escalera* de
herramientas donde cada peldaño responde una pregunta distinta a un costo distinto, y quiere saber
en cuál peldaño está parado cada número que le entregamos. El cap 14 es literalmente el índice de
módulos que debemos construir, y el cap 13 es la lista de decisiones que el software **no** debe
tomar por el ingeniero.

**El hilo conductor de los cinco capítulos** (y es el mensaje del cliente):
las fórmulas baratas son buenísimas *dentro de su dominio* y catastróficas fuera de él. El libro
lo dice tres veces con tres palabras distintas: linealidad (cap 10–11), independencia de Mach
(cap 12), y "partial simulation" (cap 14).

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§ y página] requisito (APRENDER / CONSTRUIR / ambos)`.

### 1.1 Perfil supersónico 2D (cap 10)

- `[compresible]` `[§10.0, p.552]` El software DEBE exigir **borde de ataque y de salida afilados o
  apenas redondeados, y perfil relativamente delgado** para geometría supersónica. Literal: *"Experience
  has shown that the leading edge and the trailing edge of supersonic airfoils should be sharp (or only
  slightly rounded) and relatively thin. If the leading edge is not sharp, the leading-edge shock wave
  will be detached and relatively strong, causing large wave drag."* → validador de geometría en el
  croquis: si `M_diseño > 1` y el radio de borde de ataque supera un umbral, advertir. (ambos)
- `[compresible]` `[§10.1, p.553]` Implementar **teoría lineal (Ackeret)**: `Cp = 2θ/√(M∞²−1)`, θ positivo
  en compresión. (CONSTRUIR)
- `[compresible]` `[§10.1.1, p.556]` `Cl = 4α/√(M∞²−1)`. **El software debe MOSTRAR que en régimen lineal
  supersónico el Cl NO depende de curvatura ni de espesor, y que α de sustentación nula es cero.** Es el
  choque conceptual del capítulo contra todo lo subsónico. (ambos)
- `[compresible]` `[§10.1.2, p.557]` Descomponer el arrastre en `Cd = Cd,lift + Cd,thickness + Cd,friction`
  con `Cd,lift = 4α²/√(M∞²−1) = αCl` y `Cd,thickness = 2(s̄u²+s̄l²)/√(M∞²−1)`. **`Cd,thickness` es el `Cd0`
  del resto del libro.** (CONSTRUIR)
- `[compresible]` `[§10.1.2, p.557]` Requisito de diseño literal: *"for aerodynamic efficiency to be
  maximized, camber and thickness should be minimized for supersonic airfoils."* → el optimizador
  supersónico debe penalizar curvatura y espesor. (ambos)
- `[compresible]` `[§10.1.3, p.558]` **El centro aerodinámico está a media cuerda** (no a c/4 como en
  incompresible). El software debe cambiar el punto de referencia de momento con el régimen y
  decirlo en pantalla. (ambos)
- `[compresible]` `[§10.2, p.561]` Implementar **Busemann 2º orden**: `Cp = C₁θ + C₂θ²` con
  `C₁ = 2/√(M∞²−1)` y `C₂ = [(γ+1)M∞⁴ − 4M∞² + 4] / [2(M∞²−1)²]`. El término θ² **siempre suma**
  (segundo orden siempre predice más presión que la lineal). Tabla 10.1 (p.562) es la tabla de
  C₁/C₂ para aire, γ=1.4, de M=1.10 a M=∞ → **precomputar como LUT**. (CONSTRUIR)
- `[compresible]` `[§10.3, p.566]` Implementar **choque-expansión** (Ackeret 1925): choque oblicuo donde
  comprime, Prandtl-Meyer donde expande, marchando región por región desde el borde de ataque.
  Es *"exact provided the relevant assumptions are satisfied"* pero **no da forma cerrada** [p.571]. (CONSTRUIR)
- `[escuela]` `[§10.3, p.569-570]` El software debe poder dibujar **las presiones como flechas a escala
  sobre las cuatro facetas** para enseñar que en supersónico la sustentación viene de la ALTA presión
  abajo-adelante, no de la succión arriba como en subsónico. (ambos)
- `[compresible]` `[§10.3, p.571]` Regla de reporte: los tres métodos deben poder correrse **sobre la misma
  geometría y compararse en una tabla** (Tabla 10.2). El libro nota que *"the errors in the local pressure
  coefficients tend to compensate for each other when the aerodynamic coefficients are calculated"* →
  el software debe comparar **también Cp local**, no sólo coeficientes integrados. (ambos)

### 1.2 Ala supersónica 3D (cap 11)

- `[aero3d]` `[§11.1, p.579]` Descomposición obligatoria del arrastre supersónico:
  `CD = CD,friction + CD,thickness + CD,due-to-lift`, y el `CD,due-to-lift` a su vez se parte en
  **vortex drag** (distribución de sustentación en envergadura) + **wave-drag-due-to-lift** (distribución
  longitudinal). El "drag buildup" de la Fig. 11.1 es el layout de nuestro reporte. (CONSTRUIR)
- `[aero3d]` `[§11.1, p.580]` El zero-lift wave drag se calcula por **campo lejano (regla de áreas
  supersónica)** o por **campo cercano (integración de presiones)**. Literal: *"The far-field method offers
  advantages for fuselage optimization according to area-rule concepts. The near-field method is used as
  an analysis tool for applications where the detailed pressure distributions are of interest."* → dos
  modos en el mismo módulo, con distinto propósito. (ambos)
- `[aero3d]` `[§11.1, p.580]` El software debe ofrecer **problema directo (análisis)** e **inverso (diseño)**:
  *"Design—to define the wing-camber-surface shape required to produce a selected lifting-pressure
  distribution"* vs *"Lift analysis—to define the lifting pressure distribution acting on a given
  wing-camber-surface shape"*. (CONSTRUIR)
- `[aero3d]` `[§11.1, p.580]` Dato de diseño: en el CL que maximiza L/D, **el drag-due-to-lift es como la
  mitad del arrastre total**. (APRENDER)
- `[aero3d]` `[§11.2, p.581]` Implementar la clasificación **borde de ataque/salida subsónico vs supersónico**
  (componente de la velocidad libre normal al borde). Es la decisión que gobierna todo el diseño del ala.
  El software debe pintarla sobre la planta. (ambos)
- `[geometria]` `[§11.2, p.582]` Requisito de diseño literal derivado: borde de ataque **supersónico** ⇒
  perfil supersónico, afilado, delgado, sin curvatura (ejemplo: F-104). Borde de ataque **subsónico** ⇒
  se puede usar perfil subsónico, redondeado, más grueso, con algo de curvatura (ejemplo: F-15). (ambos)
- `[aero3d]` `[§11.2, p.582]` Cita del cliente (Hernandez et al. 1993, HSCT): *"The inboard wing panel has a
  leading-edge sweep of 79°, which produces a subsonic normal Mach number at the Mach 3.0 cruise
  condition. Because of the subsonic leading-edge normal Mach number, relatively blunt leading-edges
  were possible without a substantial zero-lift wave drag penalty."* → la flecha COMPRA bluntness. (APRENDER)
- `[aero3d]` `[§11.3, p.583]` **Rango de validez de la teoría lineal supersónica: 1.2 ≤ M∞ ≤ 5.** El software
  debe rechazar/advertir fuera de ese rango. (CONSTRUIR)
- `[aero3d]` `[§11.4, p.584]` **Superposición**: ángulo de ataque + curvatura + espesor son aditivos en
  teoría lineal. El software puede resolver los tres por separado y sumar. (CONSTRUIR)
- `[aero3d]` `[§11.6, p.585]` **Método de flujo cónico**: propiedades invariantes a lo largo de rayos desde
  un vértice. Sirve como *"straightforward comparison checks"* de la solución numérica. → guardarlo como
  **test de regresión analítico**, no como el solver de producción. (CONSTRUIR)
- `[aero3d]` `[§11.6.1, p.586-589]` Ala rectangular: la sustentación dentro del cono de Mach de la punta es
  **la mitad** de la del flujo 2D de igual área (Bonney 1947), con
  `Cp/Cp,2D = (2/π)·sin⁻¹√(tan μ / tan μ)`; y la Tabla 11.1 (p.589) da **CL, CD, CM0 y xcp en forma cerrada**
  para 4 casos (placa plana perfil / placa plana ala / perfil con espesor / ala con espesor). → LUT/fórmula
  directa, cero iteración. (CONSTRUIR)
- `[aero3d]` `[§11.6.1, p.590]` Conclusiones de diseño literales de esa tabla, que el software debe poder
  reproducir como tendencias: bajar AR baja drag-due-to-lift, sustentación y momento **(al revés que en
  subsónico)**; el centro de presión se mueve adelante al bajar AR y al subir espesor; perfiles de igual
  área transversal tienen el mismo xcp; el thickness drag va con el **cuadrado** del espesor relativo;
  *"Airfoils of symmetrical cross section with a maximum thickness at the midchord point will have the
  least drag for a given thickness ratio."* (ambos)
- `[aero3d]` `[§11.6.2, p.593-595]` Ala en flecha infinita: `Me = M∞(1 − sin²Λ cos²α)^0.5`,
  `αe = tan⁻¹(tan α / cos Λ)`, `τe = τ/cos Λ`, y `Cl = Cle(Me/M∞)²`, `Cd = Cde cos Λ (Me/M∞)²`.
  → el software debe poder "desflechar" una sección y correr la teoría 2D del cap 10 sobre ella. (CONSTRUIR)
- `[aero3d]` `[§11.6.2, p.592]` **Penalizaciones de la flecha que el software debe reportar junto al beneficio**:
  menor pendiente de sustentación, mayor drag-due-to-lift, entrada en pérdida en la punta, menor
  efectividad de los hipersustentadores, mayor envergadura estructural y **torsión adicional (posiblemente
  severa) porque las cargas actúan por detrás de la raíz**. (ambos)
- `[aero3d]` `[§11.6.3, p.597]` Alas delta y flecha (arrow): con borde de ataque subsónico pueden acercarse
  a la pendiente 2D (4/β) con **CD/τ² mucho menor**. Tabla 11.2 (p.597) compara rectangular/delta/arrow
  a M=1.5 → fixture. Ventajas del arrow (Wright et al. 1978): menor arrastre inducido por el recorte
  del borde de salida, y poder mantener borde de ataque **subsónico y redondeado** a un AR comparable. (ambos)
- `[aero3d]` `[§11.7, p.598-601]` **Método de distribución de singularidades** (fuente/doblete/vórtice
  supersónicos) con `rc = {(x−x₁)² − β²[(y−y₁)² + z²]}^0.5`, imaginario fuera del cono de Mach ⇒ **influencia
  sólo aguas abajo**. El software debe explotar eso: la matriz de influencia es triangular, se marcha
  de la punta hacia atrás y **nunca hay incógnitas simultáneas**. (CONSTRUIR)
- `[aero3d]` `[§11.7, p.599]` Los **cuatro problemas** que el módulo debe soportar: (1) geometría→presión no
  sustentadora, (2) presión→geometría no sustentadora, (3) presión→pendiente de superficie sustentadora,
  (4) geometría→presión sustentadora con condición de Kutta en bordes de salida subsónicos. 1 y 3 son
  "directos"; 2 y 4 son "inversos". Literal: *"you may encounter any one of the four cases in aircraft
  design work."* (CONSTRUIR)
- `[aero3d]` `[§11.7.1, p.600]` Resultado clave a explotar: **la intensidad de la fuente en un punto es
  proporcional a la pendiente local de la superficie**, `C(x₁,y₁) = U∞λ(x₁,y₁)/π`. (CONSTRUIR)
- `[aero3d]` `[§11.7.2, p.608-613]` **Vortex-lattice supersónico (Carlson & Miller 1974)**: malla en el plano
  (x, βy) donde el semiángulo del cono de Mach es **siempre 45°**; función de influencia R promediada
  [ec. 11.30]; pesos A (borde de ataque), B (borde de salida), C (punta/centro); marcha desde el ápice;
  `R(0,0)=0` ⇒ **un elemento no se influye a sí mismo**; suma en envergadura de R = 0 ⇒ el ala no
  desplaza neto el medio. **Requiere una operación de suavizado** [ec. 11.31–11.32] o el ΔCp oscila.
  **Nota del libro: la ec. (11.31) de Carlson & Miller (1974) tiene un ERROR; la forma correcta es la del
  texto [p.613].** (CONSTRUIR)
- `[aero3d]` `[§11.7.2, p.621-622]` Integración a coeficientes: ec. (11.33) CL, (11.34) CM, (11.35) CD y
  (11.36) área de referencia por conteo de elementos. **Advertencia literal de ec. (11.35): *"This
  relationship does not consider any contribution of the theoretical leading-edge-suction force or of
  any separated flow effects associated with its exclusion and accounts only for the inclination of the
  normal force to the relative wind."*** → el software debe etiquetar ese CD como "sin succión de borde
  de ataque". (CONSTRUIR)
- `[aero3d]` `[§11.7.3, p.622]` **Empuje de borde de ataque (leading-edge thrust)**: existe cuando el borde
  es subsónico (`β cot Λ_LE < 1`). Cita: *"an element at the leading edge near the wing tip of a subsonic
  leading-edge wing... sees a concentrated upwash field. It is this upwash field that makes the subsonic
  leading edge twisted and cambered wing attractive from the standpoint of drag-due-to-lift, since a local
  element may be inclined forward to produce both lift and thrust."* (ambos)
- `[aero3d]` `[§11.7.3, p.622-624]` **Parámetro de succión Ss** [ec. 11.38] como métrica de calidad de un
  diseño de ala, con Ss=0 (placa plana sin empuje de borde) y Ss=1 (carga elíptica) como cotas. Y el
  **método de diseño calibrado de Carlson & Mann (1992)**: `CL,des = KD·CL,cruise` [ec. 11.39],
  `Ss,cruise = KS·(Ss,max)th` [ec. 11.40], y `CD,cruise` por ec. (11.41). Los factores KD y KS vienen de
  las gráficas de la Fig. 11.33 vs M. **Esto es un requisito de calibración empírica del optimizador:
  el software NO debe entregar el óptimo teórico crudo.** (CONSTRUIR)
- `[aero3d]` `[§11.7.3, p.623]` Literal, la razón: *"Experience has shown that the maximum suction parameters
  actually achieved were lower than those predicted by linearized theory. Furthermore, the required
  surface for given design conditions was less severe (smaller departures from a flat surface) than
  that given by the linearized-theory design methods."* (APRENDER)
- `[aero3d]` `[§11.10, p.634-635]` **Teoría de cuerpo esbelto**: `φyy + φzz = 0` — Laplace en el plano
  transversal, resuelto plano a plano de proa a popa. Cp por ec. (11.44), CD0 por ec. (11.46) (integral
  doble de S''(x)S''(ξ)ln|x−ξ|, la regla de áreas de Sears-Haack en su forma cruda), y
  **`CD = CD0 + α²`, `CN = 2α`, `CL ≈ 2α`** [ec. 11.47]. Mejora no lineal de Pitts et al. (1959):
  `CN = sin(2α)cos(α/2) + 2(L/2R(L))sin²α` [ec. 11.48]. (CONSTRUIR)
- `[aero3d]` `[§11.11, p.636-638]` **Drag de base**: la física completa es fea (10 factores listados en p.637-638),
  pero hay una relación de ingeniería utilizable: **`CD,base = 0.25/M∞`** (Fleeman 2006), válida para
  fuselaje de sección circular y **sin** interferencia de aletas ni boattail. Literal: *"accurate prediction
  of base drag should be given a high priority in aerodynamic design."* (CONSTRUIR)
- `[geometria]` `[§11.11, p.638-639]` **Boattail**: reduce el área de base y encoge la burbuja de recirculación,
  pero crea superficie con área proyectada hacia atrás ⇒ **existe un ángulo óptimo**; por arriba de él el
  boattail AUMENTA el arrastre. → parámetro con óptimo interior, buen candidato a barrido en el CAD. (ambos)
- `[aero3d]` `[§11.12, p.639-641]` **Interacción aerodinámica**: la carga total NO es la suma de las partes.
  Ala-sobre-cuerpo (el diferencial de presión se transfiere al fuselaje) y cuerpo-sobre-ala (el upwash
  del fuselaje a ángulo de ataque sube el α efectivo del ala). Caso de Hilton (1951): **+25% de
  sustentación del ala** respecto a lo que darían los efectos de punta sin interacción. Simplificación
  supersónica que el software SÍ puede usar: *"while one may want to consider the effects of the wings
  on the tail, the effects of the tail on the wings can usually be neglected unless they are very close
  to one another."* (ambos)
- `[aero3d]` `[§11.12, p.641-642]` La lista de 7 tareas de Middleton & Lundry (1980) para una configuración
  completa (upwash del fuselaje aislado → campo de las góndolas sobre el ala → volumen asimétrico →
  ala/canard en el upwash → campo del ala sobre góndolas → sustentación del fuselaje en el downwash →
  cola horizontal en el campo de fuselaje+ala → superposición) **es el pipeline de nuestro módulo de
  configuración completa**. (CONSTRUIR)

### 1.3 Hipersónico (cap 12)

- `[compresible]` `[§12.0, p.650]` Las **cinco características** que separan hipersónico de supersónico y que
  el software debe poder diagnosticar y advertir: capa de choque delgada, capa de entropía, interacción
  viscoso-no viscoso, efectos de alta temperatura, y flujos de baja densidad. (ambos)
- `[compresible]` `[§12.0, p.650-651]` Los tres supuestos base: `M∞ ≫ 1` [12.1]; **razón de densidades
  pequeña** `ε = ρ∞/ρ₂ ≪ 1` con `ε = (γ−1)/(γ+1) = 1/6` para aire perfecto [12.3]; y para cuerpos
  esbeltos el **supuesto de choque fuerte** `M∞ sin θb ≫ 1` [12.4], sobre el que descansa el *"Mach
  number independence principle"*. (APRENDER)
- `[compresible]` `[§12.1.1, p.652]` `δ ∝ M∞²/√Re`. **Capa límite gruesa + capa de choque delgada = se tocan.**
  El software debe calcular esa relación y advertir cuando el espesor de capa límite sea comparable al
  de la capa de choque. (ambos)
- `[compresible]` `[§12.1.2, p.653]` **Capa de entropía**: choque curvo ⇒ cada línea de corriente entra con
  entropía distinta ⇒ el campo NO es isentrópico y no se pueden usar las relaciones isentrópicas
  globalmente. (APRENDER)
- `[compresible]` `[§12.1.4, p.654]` Umbrales de gas real que el software debe marcar en el termómetro:
  **>800 K vibración molecular; >2000 K disocia O₂; >4000 K disociación de O₂ completa, disocia N₂ y
  se forma NO (que puede ionizar); >9000 K disociación de N₂ completa y O/N ionizan.** Consecuencia:
  *"most of our basic assumptions about perfect gasses being in equilibrium with a constant ratio of
  specific heats are invalid!"* (ambos)
- `[compresible]` `[§12.1.5, p.655]` **Número de Knudsen** `Kn = λ/L`. Por encima de ~340,000 ft el camino
  libre medio supera 1 ft y `Kn → 1`: **las ecuaciones de Navier-Stokes dejan de valer** y hay que ir a
  Boltzmann o a DSMC (Bird). (APRENDER)
- `[compresible]` `[§12.2, p.657]` **Modelo newtoniano**: `Cp = 2 sin²θb = 2 cos²φ`. **Sin supuesto de ángulo
  pequeño** ⇒ vale hasta en el punto de estancamiento de un cuerpo romo. En las superficies "de sombra"
  (no impactadas por la corriente libre) `Cp = 0`. (CONSTRUIR)
- `[compresible]` `[§12.2, p.657-658]` **Rango de aplicabilidad** (Marconi et al. 1976, Fig. 12.7): newtoniana
  sirve cuando M es grande **y/o** el ángulo de deflexión es grande; la teoría de pequeñas perturbaciones
  sirve sólo para cuerpos esbeltos a ángulo pequeño y M supersónico bajo. El software debe pintar en
  qué zona del mapa (θ, M∞) está el caso. (ambos)
- `[compresible]` `[§12.2, p.658]` **Principio de independencia de Mach**: al crecer M∞ el Cp se vuelve
  independiente de M. Derivado para flujo no viscoso; se espera que valga para cuerpos romos o esbeltos
  a α grande cuando `Re > 10⁵`. (APRENDER)
- `[compresible]` `[§12.4, p.666]` **Newtoniana modificada** (Lees 1955): `Cp = Cp,t2 sin²θb`, con Cp,t2 medido
  o calculado por la fórmula de pitot de Rayleigh. **Es lo que hay que implementar por defecto**, no la
  newtoniana cruda: en el ensayo del USAFA a M=4.38 la newtoniana (coef. 2.0) sobrepredice y la modificada
  (coef. 1.8) *"matches the experimental data extremely well"* [p.667]. (CONSTRUIR)
- `[compresible]` `[§12.4, p.671-672]` Generalización 3D a ángulo de ataque:
  `cos η = cos α sin θ + sin α cos θ cos β`, `Cp = Cp,t2 cos²η` [ec. 12.27–12.28], con `Cp = 0` en la
  región de sombra. **Esto es una función de la NORMAL DEL PANEL y nada más** ⇒ evalúa sobre una malla
  triangular arbitraria en microsegundos. (CONSTRUIR)
- `[compresible]` `[§12.4, p.678]` **Margen estático** `S.M. = (xcp − xcg)/xL`, debe ser positivo para
  vehículos no controlados; *"For high-performance, hypersonic vehicles, the static margin is usually
  3% to 5% of the length of the vehicle."* Y advertencia fina: **el vehículo puede ser estable con
  xcp = xcg si ycp está por debajo de ycg**, porque la fuerza axial aporta el momento restaurador. (ambos)
- `[compresible]` `[§12.4, p.670]` Arrastre de fricción de un cilindro romo en régimen enrarecido:
  `Cd,f = 5.3/Re₂^1.18` para `Re₂ > 10`, con Re₂ evaluado **detrás del choque normal**. El drag total sube
  significativamente cuando `Kn > 0.01`. (CONSTRUIR)
- `[geometria]` `[§12.5, p.682-689]` **Waveriders**: forma derivada de un campo cónico conocido, con el choque
  atado al borde de ataque ⇒ la alta presión no "se fuga" al dorso. **Requisitos duros que el libro impone
  al optimizador**: (a) *"when waveriders are optimized for maximum L/D... the driving parameter that
  alters the L/D ratio is the skin friction drag"* ⇒ **no se puede optimizar sólo con presiones**;
  (b) el radio del borde de ataque es un **compromiso**: grande limita el flujo de calor, chico limita el
  arrastre; (c) *"a waverider by itself doesn't necessarily make a good hypersonic aircraft... attention
  needs to be paid to volumetric efficiency, stability and control, and airframe-engine integration."* (ambos)
- `[compresible]` `[§12.6, p.692-693]` Modelo **NS/IE** (normal shock / isentropic expansion) para cuerpo romo:
  todas las líneas de corriente en el borde de la capa límite pasaron por la porción normal del choque
  ⇒ misma entropía ⇒ `pt2` constante en todas las estaciones y las propiedades locales salen de expandir
  isentrópicamente hasta `ps`. **Los puntos sónicos ocurren donde la pendiente local del cuerpo es 45°**
  (`ps ≈ 0.5 pt2`). (CONSTRUIR)
- `[compresible]` `[§12.6.1, p.695]` **`q̇_axisim = √2 · q̇_2D`** [ec. 12.62]: el calor en el punto de
  estancamiento de una esfera es √2 veces el de un cilindro. (CONSTRUIR)
- `[compresible]` `[§12.6.1, p.696-697]` Correlaciones de calentamiento: **Fay-Riddell** [ec. 12.68] y
  **Detra et al.** [ec. 12.69] `q̇ = (17,600/√RN)(ρ∞/ρSL)^0.5 (U∞/Uc.o.)^3.15` en Btu/ft²·s con RN en pies.
  Rango declarado de la correlación de Fay-Riddell (Le=1): **velocidades 5,800–22,800 ft/s y altitudes
  25,000–120,000 ft**. Y: **por encima de M∞=14 el modelo de gas perfecto ya no da valores realistas
  de q̇**. (CONSTRUIR)
- `[compresible]` `[§12.9, p.702-706]` **Transición de capa límite = la incertidumbre dominante.** Requisitos
  que esto impone al software: (a) la ubicación de transición debe ser un **INPUT explícito del usuario**,
  no un default escondido; (b) el reporte debe mostrar la sensibilidad laminar/turbulento como banda,
  no como número; (c) el libro cuantifica: correlaciones inciertas *"by a factor of three or more"*,
  estimaciones del punto de transición van *"from 20 to 80% along the body"*, y esa suposición
  *"can affect the vehicle gross takeoff weight by a factor of two or more."* (ambos)

### 1.4 Consideraciones de diseño (cap 13) — **la entrevista de requisitos**

- `[sizing]` `[§13.1, p.712]` Punto de partida de todo dimensionamiento: `W = L = ½ρ∞U∞²S·CL`. Para sostener
  el peso a baja velocidad hay **dos** palancas: subir **S** o subir **CL**. (ambos)
- `[geometria]` `[§13.1.1, p.713]` Los flaps tipo Fowler **aumentan el área**. Dato duro: *"the wing can
  increase in area by over 30% when all of the high-lift devices are fully deployed"* (737: suma del
  desplazamiento del flap completo + del flap principal respecto al fore-flap + del flap auxiliar +
  los dispositivos de borde de ataque). → el modelo de área de referencia debe ser **función de la
  deflexión**, no una constante. (CONSTRUIR)
- `[aero2d]` `[§13.1.3, p.716]` **Los cuatro mecanismos por los que un sistema de flaps funciona**
  (Olason & Norton 1966): (1) aumentar el área efectiva, (2) aumentar la curvatura, (3) dar curvatura
  de borde de ataque para evitar la pérdida por borde de ataque, (4) incluir ranuras que actúan sobre
  la capa límite. Y el objetivo declarado: *"a basic goal of the flap system design is to attain the
  highest possible L/D ratio at the highest possible lift coefficient."* (ambos)
- `[aero2d]` `[§13.1.3, p.716]` Cita que enmarca todo: *"if a clean flaps-up wing did not stall, a flap
  system would not be needed, except perhaps to reduce nose-up attitude... in low-speed flight."* (APRENDER)
- `[aero2d]` `[§13.1.4, p.719-720]` **Los cinco efectos de las ranuras (A.M.O. Smith 1975)** — texto literal,
  y es el corazón de por qué un multi-elemento gana:
  1. *Slat effect*: la circulación del elemento delantero reduce los picos de presión del elemento de atrás.
  2. *Circulation effect*: el elemento de atrás pone el borde de salida del delantero en alta velocidad
     inclinada ⇒ induce mucha más circulación en el delantero.
  3. *Dumping effect*: la capa límite del elemento delantero se descarga a velocidad muy por encima de la
     libre ⇒ alivia el gradiente adverso.
  4. *Off-the-surface pressure recovery*: la desaceleración de la estela ocurre **fuera de contacto con
     una pared**, y eso es más eficiente que la mejor desaceleración posible contra pared.
  5. *Fresh-boundary-layer effect*: cada elemento arranca con capa límite nueva y delgada, y las delgadas
     aguantan gradientes más fuertes.
  **Y la corrección al mito**: *"the air through the slot cannot really be called high-energy air, since
  all the air outside the boundary layer has the same total pressure."* (ambos)
- `[viscoso]` `[§13.1.4, p.720]` Requisito de arquitectura: *"Since the viscous boundary layer is a dominant
  factor in determining the aerodynamic performance of a high-lift multi-element airfoil, inviscid theory
  is not sufficient for overall design requirements."* ⇒ el módulo de alta sustentación **debe** acoplar
  potencial + capa límite iterativamente (y eventualmente Navier-Stokes). (CONSTRUIR)
- `[aero2d]` `[§13.1.4, p.722]` **Techos declarados**: con sistemas mecánicos, *"you could expect maximum
  values of CL of 2.5 to 3.5"* en alas de transportes comerciales y militares. Los dos límites físicos:
  la condición de Kutta (fija la circulación) y los efectos viscosos (separación en la superficie
  superior del flap). (ambos)
- `[estabilidad]` `[§13.1.5, p.723]` **Costo escondido del flap**: la curvatura positiva produce momento de
  picada, **especialmente grande cuando se aplica bien atrás en la cuerda**, y produce cargas de torsión
  en la estructura; el momento hay que trimarlo con la cola horizontal ⇒ **trim drag**. Y la trampa:
  *"the flap types which produce the greatest increase in Cl,max usually produce the largest moments."*
  ⇒ el software **debe** reportar Cm y trim drag junto a cualquier ΔCLmax. (ambos)
- `[aero2d]` `[§13.1.5, p.723-725]` Alternativas con energía: **flap soplado interno (IBF)**, **flap soplado
  externo (EBF)**, **soplado sobre el extradós (USB)** — el USB da *"better performance than the externally
  blown flap if the air-turning process is executed properly"* y además **apantalla acústicamente**
  (menos ruido). Y **succión** (LFC de baja velocidad): los aviones de la AVA con succión llegaron a casi
  el doble de CLmax que el Fieseler Storch. (APRENDER)
- `[aero2d]` `[§13.2, p.725-727]` **Circulation Control Wing**: borde de salida romo/redondo fijo + chorro
  tangencial que se pega por efecto Coanda. A Cμ bajo actúa como control de capa límite; a Cμ alto genera
  **supercirculación** sin el límite del borde afilado. (APRENDER)
- `[optimizacion]` `[§13.3, p.727-729]` **El requisito estructurante del diseño de cazas, literal (Bradley 1981)**:
  *"The multiple design point requirement turns out to be the major driver for the designer of fighter
  aircraft. The aerodynamic requirements for each of the design points often present conflicting
  requirements."* Y el conflicto concreto: aceleración/crucero supersónico piden perfil delgado, mucha
  flecha y curvatura para trimar el corrimiento del c.a.; maniobra transónica pide perfil más grueso,
  curvatura para CL alto y **AR alto**. *"Designers are thus faced with a situation of compromise."*
  ⇒ **el software debe soportar MÚLTIPLES puntos de diseño simultáneos y mostrar el conflicto, no
  esconderlo tras un óptimo único.** (ambos)
- `[optimizacion]` `[§13.3, p.729]` **Las dos escuelas de diseño transónico** que el software debe poder
  representar: (1) mantener flujo adherido — acelerar rápido a supercrítico y desacelerar casi
  isentrópicamente evitando choques fuertes; (2) **aceptar la separación y CONTROLARLA con vórtices**
  (estrías/LEX) combinados con curvatura variable. F-16 y F-18 son de la segunda. (ambos)
- `[aero3d]` `[§13.3, p.729-731]` Los regímenes de la Fig. 13.19 que el software debe etiquetar en el mapa
  (CL, M): crucero/aceleración = flujo **adherido**; maniobra sostenida = **mezcla** adherido+separado;
  maniobra instantánea = **separado dominante, con vórtices aprovechados**. (ambos)
- `[optimizacion]` `[§13.4, p.731]` Requisito de programa: *"almost all aircraft development programs require
  drag reduction efforts at some point during the life of the program."* Las cuatro palancas del libro:
  curvatura/torsión variable, control de flujo laminar (LFC), dispositivos de punta de ala, y **forma en
  planta**. (ambos)
- `[aero3d]` `[§13.4.2, p.734-735]` **LFC**: el análisis se parte en tres — (1) campo no viscoso, (2)
  desarrollo natural de la capa límite (3D, con **flujo cruzado**, que hace la capa límite de un ala
  en flecha *más* inestable que la de un ala recta), (3) análisis del sistema de succión. Datos duros
  del X-21A: succión de `0.0001U∞` (gradiente despreciable) a `0.0010U∞` (cerca del borde de ataque),
  laminar de cuerda completa **hasta Re = 45.7×10⁶**. (ambos)
- `[optimizacion]` `[§13.4.2, p.735]` **Tabla 13.1** = matriz de sensibilidad literal (parámetro × figura de
  mérito) para el ala LFC. Ese formato es exactamente el reporte de trade study que le debemos al
  cliente. Resultados: mínimo combustible ⇒ AR alto (lo más importante), t/c bajo (secundario), flecha
  casi irrelevante, M=0.78; máxima productividad ⇒ t/c bajo (lo más importante), luego AR, luego flecha,
  M=0.85. Ahorro estimado de combustible: **27% a 30%** (Jobe et al. 1978), laminarizando hasta 0.70c. (ambos)
- `[optimizacion]` `[§13.4.3, p.737]` **AR óptimo depende de la figura de mérito** (Thomas 1985), literal:
  *"optimal wing aspect ratio for a transport aircraft varies from 7.5 for minimum acquisition cost, to
  9.8 for minimum gross weight, to 12.0 for minimum direct operating cost, and to 15.2 for minimum fuel.
  At present aspect ratios as large as 15.2 are not structurally feasible but the importance of aspect
  ratio is clear."* ⇒ **el software NO debe tener un "AR óptimo"; debe tener CUATRO y preguntar cuál
  figura de mérito.** (ambos)
- `[geometria]` `[§13.4.3, p.739]` **Reglas de diseño de winglets, literales (Thomas 1985)** — son cuatro
  requisitos verificables:
  1. Para desempeño supercrítico el winglet debe ir **estrechado y con flecha atrás**, montado **por detrás
     de la región de mínima presión del ala principal** para minimizar interferencia.
  2. **Filetes suaves** entre la punta y el winglet, o el beneficio se reduce.
  3. Algo de **toe-out**, por los ángulos de entrada de flujo en la punta; además reduce el riesgo de
     entrada en pérdida del winglet en derrape.
  4. La reducción de arrastre **crece menos que linealmente con la altura** ⇒ la altura óptima es un
     compromiso entre aerodinámica y el **momento flector** por el brazo más largo. (ambos)
- `[estabilidad]` `[§13.4.3, p.740]` **Requisito aeroelástico**: *"designs should not be restricted to cruise
  conditions with a rigid wing shape. A fluid-structure coupling should be performed in order to compute
  the performance and structural loading... at cruise conditions, as well as at ultimate structure
  loadings for deformed shapes (i.e. gusts, pull out of a dive, etc.)."* Con la restricción de estudio de
  Streit et al. (2008): **4% de aumento del momento flector en la raíz (wrbm)**; incluir la deformación
  *"actually was crucial for determining the overall benefits of the wing tip devices."* (ambos)
- `[aero3d]` `[§13.4.4, p.740-741]` **Forma en planta** (ala creciente/lunate): +8% de eficiencia de
  envergadura en túnel y CFD (van Dam 1987, van Dam et al. 1991) pero **~1% en otras simulaciones**
  (Smith & Kroo 1993). ⇒ ejemplo perfecto para enseñar dispersión entre fuentes. (APRENDER)
- `[estabilidad]` `[§13.5.1, p.742-745]` **Caso EA-6B — el patrón completo de una modificación**: diagnóstico
  con visualización de flujo (par de vórtices en la unión ala-fuselaje que a la entrada en pérdida suben
  al nivel del estabilizador vertical y, en derrape, lo bañan con sidewash desestabilizador) → paquete de
  cuatro modificaciones (borde de ataque interno caído, estrías en el guante del ala, extensión de deriva,
  frenos/alerones en punta) → resultado medido. **Restricción impuesta por el cliente (la Marina):
  "no major changes were allowed to the main wing or airframe structure."** ⇒ el software debe soportar
  optimización **con la geometría base congelada**. (ambos)
- `[estabilidad]` `[§13.6, p.758-763]` **Canard vs cola vs sin cola** — conclusiones literales de Nicholas et al.
  (1984) como reglas de decisión:
  - Para alas de curvatura variable muy eficientes, el canard sólo gana un poco en subsónico y **exige
    niveles de inestabilidad muy grandes**, acompañados de **menor sustentación máxima** y problemas de
    estabilidad y control a α alto.
  - Las polares subsónicas de canard y sin-cola son **más sensibles al margen estático** que las de cola.
  - En supersónico el canard sí lleva ventaja, porque su polar optimiza a niveles de estabilidad subsónica
    más altos (el canard casi no cambia su fracción de sustentación entre subsónico y supersónico; la cola
    sí, porque el downwash del ala se reduce).
  - El ala delta sin cola puede ganar en **TOGW** por menor arrastre mínimo y menor peso, aun con peor
    forma de polar.
  - ***"Static margin limit is a critical issue in control surface (canard, tail, tailless) selection."***
  - Dato: tanto canard como cola optimizan llevando **~12% de la sustentación total en la superficie de
    control** (M=1.6). Y el ala-cola trabaja bien con margen estático subsónico de **−10% a −15% c̄**,
    mientras el canard querría **−25% c̄** (riesgo alto, beneficio chico). (ambos)
- `[estabilidad]` `[§13.6, p.758-759]` **Ala en flecha hacia adelante (FSW)**: la pérdida progresa de la
  RAÍZ a la punta (al revés que en flecha atrás) ⇒ control lateral con alerones simples en la punta;
  y un **canard acoplado adelante de la raíz** retrasa la pérdida de raíz y evita el pitch-up. (APRENDER)
- `[geometria]` `[§13.7, p.763]` **Caso F-15 — dos correcciones reales que enseñan humildad**: (1) el "snag"
  en el borde de ataque del estabilador movió el centro de presión atrás y quitó masa del borde ⇒
  cumplió el margen de flutter de **800 KCAS +15%**, y ganó a las otras opciones (refuerzo estructural,
  balanceo de masa, pods de punta) por peso y penalización aerodinámica. (2) En el ensayo de cargas en
  vuelo al 80% se descubrió que el momento flector máximo era **3–4% mayor que lo estimado en túnel**;
  cortaron las puntas del ala **en el sitio** y las reemplazaron con puntas raked de **caoba**. (ambos)
- `[costos]` `[§13.8, p.765-766]` **F-22**: *"Many initial 'requirements' which seemed to be no problem turned
  out to be major drivers of weight and/or cost, and, as a result, were substantially changed by the Air
  Force, based on our trade study data."* ⇒ **el trade study es la herramienta que cambia el requisito**,
  no sólo la que lo cumple. Ese es exactamente el hueco de mercado de La Forja. (ambos)
- `[sizing]` `[§13.8, p.765]` Restricción de arquitectura, literal (Dick Hardy): *"everything wants to be at
  the center of gravity"* — las armas para que el avión no cambie de modo estable al soltarlas; el
  combustible para que el c.g. no se corra al vaciarse. (APRENDER)
- `[optimizacion]` `[§13.5.4, p.758]` **Tabla 13.3** (Whitford 1991): requisito operativo → característica de
  diseño primaria. Es un **mapa requisito→parámetro directamente codificable** (despegue corto ⇒ T/W con
  postquemador alto, alta sustentación de flap, W/S bajo, vectorización; persistencia en combate ⇒ sfc
  bajo, buen L/D a g alto, versatilidad de carga de armas; etc.). (CONSTRUIR)
- `[optimizacion]` `[§13.5.4, p.758]` Regla de proceso, literal (Montulli 1986): ***"When establishing airplane
  performance requirements, allow for potential changes in operational requirements. Do not allow a point
  design."*** (ambos)
- `[costos]` `[§13.5.3, p.752-757]` **Carga externa de armamento**: *"The carriage drag of the stores is often
  of the same order of magnitude as the total minimum drag of the aircraft itself."* Tabla 13.2 compara
  4 conceptos (pilón alar / interna / semisumergida / conformal) con ventajas y desventajas. Y el
  requisito que casi nadie modela: las armas **deben separarse limpiamente y seguir una trayectoria
  predecible**, incluso en maniobra y en salvas múltiples donde *"the weapons must not 'fly' into one
  another."* (ambos)
- `[escuela]` `[§13.10, p.770]` La frase de cierre del capítulo, que es la tesis del cliente:
  ***"everything affects everything else."*** (APRENDER)

### 1.5 Herramientas (cap 14) — **la especificación del producto**

Los requisitos del cap 14 están desarrollados completos en la **sección 5** (costo de cómputo) y en la
**sección 4** (decisiones humanas). Aquí sólo el esqueleto normativo:

- `[optimizacion]` `[§14.0, p.775]` **Taxonomía obligatoria de dos ramas**: (a) herramientas analíticas —
  soluciones analíticas exactas, códigos conceptuales de base empírica, y CFD; (b) programas
  experimentales — instalaciones en tierra (túneles) y ensayos en vuelo. **Nuestro software debe
  etiquetar cada número con la rama de la que salió.** (CONSTRUIR)
- `[optimizacion]` `[§14.0, p.776]` Requisito de balance, literal (Kafyeke & Mavriplis 1997): *"Today CFD is
  a principal aerodynamic technology along with wind tunnel testing and flight testing. State-of-the-art
  capabilities in each of these technologies are needed to achieve superior performance with reduced risk
  and low cost."* (APRENDER)
- `[optimizacion]` `[§14.1, p.777]` **Tres cosas que el usuario DEBE entender de cualquier código, aunque no
  lo haya escrito**: (1) el esquema de malla usado para representar el cuerpo y el usado para resolver el
  campo; (2) los algoritmos numéricos; (3) los modelos usados para los fenómenos fluidodinámicos,
  termoquímicos y de propiedades. ⇒ **la UI de un estudio en La Forja debe exponer esas tres cosas,
  no esconderlas.** (CONSTRUIR)
- `[viscoso]` `[§14.0, p.776]` Advertencia dura sobre turbulencia: *"turbulence models are not universal. One
  turbulence model may provide reasonable values for the engineering parameters for a particular class of
  flows, but not work well for another type of flow."* ⇒ el modelo de turbulencia es una **elección del
  ingeniero registrada en el estudio**, nunca un default silencioso. (ambos)
- `[optimizacion]` `[§14.2, p.783-784]` Implementar los **cuatro estados de credibilidad** — verificación,
  validación, calibración, certificación — como metadato de cada solver. Definiciones literales en §4.3
  de este documento. (CONSTRUIR)
- `[optimizacion]` `[§14.3, p.786-787]` **Los nueve parámetros** que el planeador de un ensayo en tierra debe
  considerar (lista literal en §5.4). El software debe calcular cuáles se logran igualar y cuáles no,
  y reportarlo como "simulación parcial". (CONSTRUIR)
- `[optimizacion]` `[§14.3, p.787]` La frase que define la disciplina, atribuida a Potter:
  ***"Aerodynamic modeling is the art of partial simulation."*** (APRENDER)
- `[costos]` `[§14.5, p.789-790]` **Modelo de costo relativo** entre las tres tecnologías (números en §5.5).
  Es un requisito de producto: cuando el usuario pida un resultado, el software debe poder decirle
  **cuál es la herramienta más barata que responde esa pregunta con la fidelidad necesaria.** (CONSTRUIR)

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

Formato de cada entrada: **fórmula** · supuestos · **rango** · *qué se rompe fuera*.

### 2.1 Perfil delgado supersónico 2D

**F-10.1 — Coeficiente de presión lineal (Ackeret)** `[§10.1 ec.10.1c, p.553]`
```
Cp = 2θ / sqrt(M_inf^2 - 1)          θ > 0 en compresión, θ < 0 en expansión
```
Supuestos: ondas de presión tan débiles que se tratan como **ondas de Mach** ⇒ flujo isentrópico en
todo el campo; perturbaciones pequeñas; `dz/dx ≈ tan(pendiente) ≈ pendiente`; perfil delgado, α chico.
Rango: `1.2 ≤ M∞ ≤ 5` (§11.3 p.583); θ de pocos grados.
*Fuera de rango*: cerca de M=1 el denominador →0 y Cp →∞ (transónico, ec. elíptica-hiperbólica mixta);
a M muy alto entra hipersónico y la linealización pierde la física del choque fuerte. Con θ grande el
error contra choque oblicuo/Prandtl-Meyer se vuelve grande y **asimétrico**: en el Ejemplo 10.1–10.3
(θ=20°) la lineal da Cp3=+0.4031 contra 0.660 real (**−39%**) y Cp2=−0.4031 contra −0.2588 (**+56%**).
Nota importante del libro [p.571]: esos dos errores **se compensan** al integrar, y por eso Cl y Cd
salen razonables aun cuando los Cp locales están muy mal. *Nunca uses la lineal para presiones locales
si vas a alimentar una estructura o un sistema de control.*

**F-10.2 — Sustentación lineal** `[§10.1.1 ec.10.8–10.9, p.556]`
```
Cl      = 4*alpha / sqrt(M_inf^2 - 1)
dCl/dα  = 4 / sqrt(M_inf^2 - 1)
```
Supuestos: además de F-10.1, `zu = zl = 0` en borde de ataque y de salida (perfil cerrado).
Consecuencias físicas duras: **Cl no depende de curvatura ni de espesor**, y `α_L=0 = 0`.
Rango: mismo que F-10.1. Punto notable: **para `M∞ ≥ 1.185` la pendiente cae por debajo de 2π/rad**
(el valor incompresible de perfil delgado).
*Fuera de rango*: en flujo real un perfil supersónico con curvatura SÍ tiene Cl≠0 a α=0 — y **de signo
NEGATIVO** [Fig. 10.6, p.571-572], al revés que en subsónico. Literal: *"This is another example
illustrating that you should not apply intuitive ideas from subsonic flow to supersonic flows."*

**F-10.3 — Arrastre de onda** `[§10.1.2 ec.10.16–10.17, p.557]`
```
Cd = 4*alpha^2/sqrt(M^2-1)  +  2*(su_bar^2 + sl_bar^2)/sqrt(M^2-1)
      \___ Cd, due to lift = alpha*Cl __/    \___ Cd, thickness = Cd0 ___/
su_bar^2 = (1/c)*Integral_0^c (dzu/dx)^2 dx      (pendiente cuadrática media)
```
Supuestos: no viscoso, envergadura infinita.
**El hecho físico que hay que enseñar**: *"the drag is not zero even though the airfoil has an infinite
span and the viscous forces have been neglected"* y *"it is not necessary that shock waves be present
for wave drag to exist."*
Rango: mismo. *Fuera*: no incluye fricción (hay que sumarla aparte) ni arrastre de base ni separación.

**F-10.4 — Momento y centro aerodinámico** `[§10.1.3 ec.10.22, p.558]`
```
Cm_x0 = -4*alpha/sqrt(M^2-1) * (1/2 - x0/c)
        + 4/sqrt(M^2-1) * Integral_0^1 (dzc/dx)*((x-x0)/c) d(x/c)
```
⇒ **centro aerodinámico a x/c = 0.5** (contra 0.25 en incompresible).
Rango: mismo. *Fuera*: la comparación con datos [Fig. 10.6] muestra que el momento medido tiene la
dependencia con α que predice choque-expansión **pero difiere en magnitud** — de las tres cantidades,
el momento es la peor predicha. Corolario para el software: **nunca cerrar el diseño de la superficie
de control con el Cm de teoría lineal.**

**F-10.5 — Busemann (2º orden)** `[§10.2 ec.10.23, p.561]`
```
Cp = C1*theta + C2*theta^2
C1 = 2/sqrt(M^2-1)
C2 = [ (gamma+1)*M^4 - 4*M^2 + 4 ] / [ 2*(M^2-1)^2 ]
```
Supuestos: mismos que la lineal (ondas de Mach, isentrópico) + un término más de la serie de Taylor.
**El término θ² siempre es positivo** ⇒ 2º orden siempre predice más presión que la lineal.
Rango: mismo, y explícitamente *"since the pressure waves are treated as Mach waves, the turning angles
must be small."*
*Fuera*: C2 explota cerca de M=1 (Tabla 10.1: C2 = 30.316 a M=1.10 y baja a 1.200 en M→∞).
Detalle valioso para el software: **C2 tiende a un límite finito (1.20) mientras C1→0**, o sea que en
hipersónico el término cuadrático DOMINA — que es exactamente la forma newtoniana `Cp ∝ θ²`.

**F-10.6 — Choque-expansión** `[§10.3, p.566]`
Método, no fórmula: marchar región por región desde el borde de ataque; choque oblicuo donde comprime
(no isentrópico, cae pt), Prandtl-Meyer donde expande (isentrópico, `dν = ∓dθ`), y referir siempre
`Cp = (2/γM∞²)(p/p∞ − 1)` a las condiciones libres encadenando razones.
Supuestos duros: **onda de choque de borde de ataque ATADA y PLANA** ⇒ el flujo detrás es isentrópico.
Rango: hasta el ángulo de deflexión máximo con choque atado; el libro pide en el Problema 10.5
determinar *"the maximum angle of attack at which this airfoil can be placed and still generate a weak
shock wave"* ⇒ **ese chequeo es un gate del solver**.
*Fuera*: si el choque se desprende, todo el método muere (y con él la premisa de que el dorso y el
vientre son independientes).
Desventaja declarada: *"it is essentially a numerical method which does not give a closed-form solution."*

### 2.2 Ala supersónica

**F-11.1 — Ecuación gobernante linealizada** `[§11.3 ec.11.4, p.583]`
```
(M_inf^2 - 1) * phi_xx  -  phi_yy  -  phi_zz  = 0        (HIPERBÓLICA)
```
Contra el caso subsónico [ec. 9.13] que es **elíptica**. Consecuencia física y computacional: en
supersónico la influencia existe **sólo dentro del cono de Mach aguas abajo** ⇒ el solver marcha,
no itera globalmente.
Condiciones de frontera: tangencia `(∂φ/∂z)_{z=0} = U∞ dzs/dx` [ec. 11.7], más **condición de Kutta
`Cp_ute = Cp_lte` sólo en bordes de salida SUBSÓNICOS** [ec. 11.8] (físicamente: la sustentación
local en un borde de salida subsónico es cero).
Rango declarado: **1.2 ≤ M∞ ≤ 5**, derivado de las nueve desigualdades de la ec. (11.3).
*Fuera*: transónico (M→1) y hipersónico rompen las desigualdades; el libro lo dice explícitamente.

**F-11.2 — Borde subsónico/supersónico** `[§11.2, p.581]`
Criterio: componente de la velocidad libre **normal al borde**. Equivalente operativo usado en todo
el capítulo: `β cot Λ_LE` con `β = sqrt(M∞²−1)`; `β cot Λ_LE > 1` ⇒ borde supersónico,
`< 1` ⇒ borde subsónico.
Consecuencia física: en la región limitada por bordes **supersónicos**, el dorso y el vientre **no se
comunican** ⇒ se puede usar la teoría 2D del cap 10. En bordes **subsónicos** sí se comunican ⇒ hay que
usar teoría subsónica (caps 7 y 9) y aparece el empuje de borde de ataque.

**F-11.3 — Ala en flecha infinita** `[§11.6.2 ec.11.9–11.16, p.594]`
```
Me   = M_inf * (1 - sin^2(Lambda) * cos^2(alpha))^0.5
αe   = atan( tan(alpha) / cos(Lambda) )
τe   = τ / cos(Lambda)
Cl   = Cle * (Me/M_inf)^2
Cd   = Cde * cos(Lambda) * (Me/M_inf)^2
```
Supuestos: envergadura infinita, viscosidad despreciada (la componente tangente al borde *"is unaffected
by the presence of the wing (if we neglect viscous effects)"*).
*Fuera*: el mismo libro advierte en §11.8 que **el flujo en envergadura engrosa la capa límite hacia la
punta** ⇒ el supuesto "la componente tangencial no hace nada" falla justo donde importa (separación).
Nota fina: las curvas de la Fig. 11.16 se construyeron con las relaciones **exactas** (11.15)/(11.16) +
choque-expansión, **no** con teoría lineal, y con `Cd,friction = 0.006` supuesto.

**F-11.4 — Singularidades supersónicas** `[§11.7 ec.11.19, p.598]`
```
fuente:   phi_s = -Q/rc
doblete:  phi_d = +Q*z*beta^2 / rc^3
vórtice:  phi_v = -Q*z*nu_c / rc
rc  = { (x-x1)^2 - beta^2*[(y-y1)^2 + z^2] }^0.5
nu_c = (x-x1) / [ (y-y1)^2 + z^2 ]
beta^2 = M_inf^2 - 1
```
Propiedad clave: **rc es imaginario fuera del cono de Mach** ⇒ influencia acotada a la zona de acción.
Y `C(x₁,y₁) = U∞·λ(x₁,y₁)/π` [ec. 11.23c]: la fuerza de la fuente es proporcional a la **pendiente
local**. Una fuente induce velocidad vertical **sólo en su propio punto**.

**F-11.5 — Vortex-lattice supersónico, función de influencia** `[§11.7.2 ec.11.30, p.611]`
```
Rbar(L*-L, N*-N) =
   [ (L*-L+0.5)^2 - (N*-N-0.5)^2 ]^0.5 / [ (L*-L+0.5)*(N*-N-0.5) ]
 - [ (L*-L+0.5)^2 - (N*-N+0.5)^2 ]^0.5 / [ (L*-L+0.5)*(N*-N+0.5) ]
```
Invariantes que el solver DEBE verificar como test (el libro las señala como propiedades):
`Rbar(0,0) = 0` (un elemento no se influye a sí mismo) y **la suma en envergadura de Rbar para un
`L*−L` fijo es cero** (upwash y downwash se balancean; el ala no desplaza neto el medio).
Interpretación física de Middleton & Lundry: para sustentación positiva, **los elementos directamente
adelante del punto de campo sólo aportan downwash; todos los demás aportan upwash**.
Rango: teoría lineal, espesor despreciable, ala aprox. en `z = 0`.
*Fuera*: no captura el vórtice de borde de ataque (ver §8), ni el empuje de succión, ni separación.

**F-11.6 — Parámetro de succión** `[§11.7.3 ec.11.38, p.622]`
```
Ss = [ CL*tan(CL/CL_alpha) - (CD - CD0) ] / [ CL*tan(CL/CL_alpha) - CL^2/(pi*AR) ]
```
Cotas: `Ss = 0` ⇒ ala plana sin empuje de borde ni fuerzas de vórtice; `Ss = 1` ⇒ carga elíptica con
todo el empuje de borde. **Advertencia**: `Ss = 1` es *"a carryover from subsonic flows"* y en la
práctica el wave-drag-due-to-lift supersónico impide acercarse; se conserva por simplicidad y
repetibilidad. *No es un objetivo alcanzable, es una normalización.*

**F-11.7 — Cuerpo esbelto** `[§11.10 ec.11.42–11.48, p.634-635]`
```
supuesto:  phi_xx  <<  phi_yy, phi_zz
=>         phi_yy + phi_zz = 0                (Laplace en el plano transversal)
Cp(x) = (S''(x)/pi)*ln( 2/(R(x)*sqrt(M^2-1)) )
        + (1/pi)*d/dx Integral_0^x S''(xi)*ln(x-xi) dxi
        - (dR/dx)^2
CD0   = -(1/(2*pi*S(L))) * Int_0^L Int_0^L S''(xi)*S''(x)*ln|x-xi| dxi dx
CD = CD0 + alpha^2      CN = 2*alpha      CL ~= 2*alpha
CN (mejorado, Pitts 1959) = sin(2a)cos(a/2) + 2*(L/2R(L))*sin^2(a)
```
Supuestos: cuerpo largo y esbelto de revolución, α pequeño, sólo se integran efectos aguas arriba.
*Fuera*: cuerpos gruesos o con cambios bruscos de sección; α grande (por eso existe la corrección
no lineal de Pitts, que agrega el término `sin²α` de crossflow); no incluye el arrastre de base.

**F-11.8 — Drag de base** `[§11.11, p.638]`
```
CD_base = 0.25 / M_inf
```
Supuestos EXPLÍCITOS del libro: sección transversal circular **y sin interferencia de aletas ni
boattail**. *Fuera*: cualquier aleta, boattail o chorro de propulsión invalida el número. La lista de
p.637-638 enumera diez efectos que la relación no captura (el choque de readherencia, la curvatura de
línea de corriente, el gradiente adverso en la readherencia, la estructura de turbulencia a alto Mach
convectivo, etc.).
Relación física a enseñar, **contraintuitiva**: *"small separated regions cause larger base drag than
large regions"* — una burbuja chica hace girar el flujo más bruscamente ⇒ expansión más fuerte ⇒
presión de base más baja.

### 2.3 Hipersónico

**F-12.1 — Razón de densidades y choque fuerte** `[§12.0 ec.12.2–12.4, p.650-651]`
```
epsilon = rho_inf/rho_2  <<  1 ;   para gas perfecto en choque normal con M->inf:
epsilon = (gamma-1)/(gamma+1)  =  1/6   (aire perfecto)
supuesto de choque fuerte (cuerpos esbeltos):  M_inf * sin(theta_b)  >>  1
```
Dato de anclaje real: **en la reentrada del Módulo de Comando del Apollo la razón se acercó a 1/20**
(gas real, no perfecto). Los túneles hipersónicos típicos, en cambio, operan donde el gas de ensayo
se aproxima bien con gas perfecto ⇒ **el túnel NO reproduce ese ε**.

**F-12.2 — Espesor de capa límite hipersónica** `[§12.1.1, p.652]`
```
delta ~ M_inf^2 / sqrt(Re)
```
Re alto adelgaza; **M alto engrosa, y va al CUADRADO**. Como el vuelo hipersónico es de altura alta
(Re bajo) y M alto, las capas límite son **gruesas** mientras la capa de choque es **delgada** ⇒
interactúan y suben fricción y calentamiento.
*Qué se rompe*: el desacople viscoso/no viscoso que justificaba usar tablas de cuña y cono.
Los límites del uso de teoría de cuña/cono en hipersónico los fijó Lees (1951, 1953) vía un
**parámetro de similitud hipersónica**, y dependen de la esbeltez y del Mach.

**F-12.3 — Newtoniana y newtoniana modificada** `[§12.2 ec.12.6, §12.4 ec.12.17, p.657 y 666]`
```
newtoniana:            Cp = 2 * sin^2(theta_b) = 2 * cos^2(phi)
newtoniana modificada: Cp = Cp_t2 * sin^2(theta_b) = Cp_t2 * cos^2(phi)
Cp_t2 = (2/(gamma*M1^2)) * ( pt2/p1 - 1 )       [Rayleigh pitot]
3D con alpha:  cos(eta) = cos(a)*sin(theta) + sin(a)*cos(theta)*cos(beta)
               Cp = Cp_t2 * cos^2(eta) ;  Cp = 0 en la región de sombra
```
Supuestos: capa de choque muy delgada ⇒ las partículas conservan velocidad y dirección hasta impactar
la superficie; la componente **normal** de cantidad de movimiento se borra, la **tangencial** se conserva.
**No hay supuesto de ángulo pequeño.**
Rango: M grande y/o deflexión grande (Fig. 12.7, Marconi 1976). Válido para el punto de estancamiento
de cuerpos romos. Cuantitativamente: para un cilindro circular romo, el Cd de presión **alcanza su
valor límite hipersónico ya en M∞ = 4** [Fig. 12.16, p.670].
*Fuera*: cuerpos esbeltos a ángulo pequeño en supersónico bajo (ahí manda teoría lineal); régimen
enrarecido `Kn > 0.01` donde la fricción deja de ser despreciable; y la newtoniana **cruda** sobrepredice
el estancamiento ~10% (Ejemplo 12.1) — usar siempre la modificada con Cp,t2 real.
**Valores de Cp,t2 a tener a mano** [Fig. 12.13, p.665]: M1=4 ⇒ ≈1.8 (igual perfecto y equilibrio);
M1=24 ⇒ **1.932 aire en equilibrio, 1.838 aire perfecto, 2.000 newtoniano**.

**F-12.4 — Coeficientes por integración newtoniana** `[§12.4, p.669-677]`
```
esfera:                CD = Cp_t2 / 2                                  [ec. 12.21]
cilindro circular 2D:  Cd_p = (2/3) * Cp_t2                            [ec. 12.22]
cono afilado, |alpha| <= theta_c:
  CA = Cp_t2*[ sin^2(tc) + 0.5*sin^2(a)*(1 - 3*sin^2(tc)) ]            [ec. 12.34]
  CN = (Cp_t2/2) * sin(2a) * cos^2(tc)                                 [ec. 12.36]
  CL = Cp_t2*sin(a)*[ cos^2(a)*cos^2(tc) - sin^2(tc)
                      - 0.5*sin^2(a)*(1-3*sin^2(tc)) ]                 [ec. 12.37]
  CD = Cp_t2*cos(a)*[ sin^2(a)*cos^2(tc) + sin^2(tc)
                      + 0.5*sin^2(a)*(1-3*sin^2(tc)) ]                 [ec. 12.38]
  CM0 = - Cp_t2 * sin(2a) / (3*tan(tc))                                [ec. 12.44]
  xcp = (2/3)*xL                                                       [ec. 12.52]
  ycp = sin(2a)*sin^2(tc)*xL / { 3*[ sin^2(tc) + 0.5*sin^2(a)*(1-3sin^2 tc) ] }  [ec.12.53]
```
Referencia de área: `π Rb²`, `Rb = xL tan θc`. Supuestos: sin fricción, `Cp,base = 0`, `−θc ≤ α ≤ θc`.
*Fuera*: fuera de ese rango de α parte del cono entra en sombra y los límites de integración cambian;
la fricción y la presión de base NO están (el Ejemplo 12.4 muestra que la fricción vale **28%** del
arrastre total de ese cono, y la base **−1.5%**).

**F-12.5 — Gradiente de velocidad y calentamiento en estancamiento** `[§12.6.1, p.695-697]`
```
(du_e/dx)_t2 = (1/RN) * sqrt( 2*(pt2 - p_inf)/rho_t2 )                 [ec. 12.67]
q_axisim = sqrt(2) * q_2D                                              [ec. 12.62]
Fay-Riddell (Le=1):
q_t,ref = (0.67/Pr_t2)*(rho_t2*mu_t2)^0.4*(rho_w*mu_w)^0.1*(Ht2 - h_w)
          * [ (1/RN)*sqrt(2*(pt2-p_inf)/rho_t2) ]^0.5                  [ec. 12.68]
Detra et al. (1957), unidades imperiales, RN en pies, q en Btu/ft^2-s:
q_t,ref = (17600/sqrt(RN)) * (rho_inf/rho_SL)^0.5 * (U_inf/U_c.o.)^3.15 [ec. 12.69]
```
Supuestos de Fay-Riddell: número de Lewis ≈ 1, capa de gas caliente en **equilibrio químico**,
temperatura de pared mucho menor que la de la corriente externa; correlación ajustada para
**5,800–22,800 ft/s** y **25,000–120,000 ft**.
Lo que hay que enseñar: **`q̇ ∝ 1/√RN`** ⇒ la nariz roma es lo que salva al vehículo, y por eso
un waverider (bordes afilados) tiene el problema térmico que tiene.
*Fuera*: **por encima de M∞ = 14 el modelo de aire perfecto ya no da valores realistas de q̇**
[Fig. 12.37, p.696-697] — hay que ir a aire en equilibrio.

**F-12.6 — Choque normal con gas real** `[§12.3, p.660-665]`
Las ecuaciones de conservación (12.7)–(12.9) **NO** están restringidas a gas perfecto y sí valen en
hipersónico; lo que falla son las relaciones cerradas (12.12)–(12.16), que sólo valen si el gas es
térmica y caloríficamente perfecto.
```
gas perfecto:  p2/p1 = f(M1, gamma)                 (2 parámetros)
gas real en equilibrio: p2/p1 = f(U1, p1, T1)       (3 parámetros: velocidad + 2 termodinámicas)
```
Efectos cualitativos del gas real que el software debe reportar: **baja** T estática, velocidad del
sonido y velocidad en la capa de choque; **sube ligeramente** la presión estática; **sube mucho** la
densidad ⇒ **la capa de choque se adelgaza**.
Umbrales de disociación (Hansen 1957, a 150,000 ft): **O₂ empieza cerca de Mach 7; N₂ cerca de Mach 18**;
y a toda presión *"the dissociation of oxygen is essentially complete before the dissociation of
nitrogen begins."*

### 2.4 Diseño (cap 13) — relaciones que sí son fórmulas

**F-13.1 — Vuelo recto y nivelado** `[§13.1 ec.13.1, p.712]` `W = L = ½ρ∞U∞²S·CL`.
**F-13.2 — Coeficiente de momento de soplado (CCW)** `[§13.2, p.726]`
`Cμ = ṁ·Vj/(q·S)`, con el balance presión-fuerza centrífuga `Δp/h = ρVj²/(r+h)` que sostiene el
chorro pegado (Coanda).
**F-13.3 — Criterio de transición usado por el propio libro** `[§13.6 Problema 13.6, p.771]`
`x_tr = Re_x,tr·μ∞/(ρ∞U∞)` con `Re_x,tr = 500,000` como valor de trabajo. **Es una convención
declarada, no una ley** — el cap 12 acaba de decir que la transición es incierta por un factor de 3.
**F-13.4 — Criterios anti-separación para alas muy en flecha (Kulfan & Sigalla 1978)** `[§11.8, p.626-627]`
Estos son cuatro **criterios de rechazo** codificables (nótese que viven en el cap 11 pero son
requisitos de diseño puros, y el propio libro remite a §13.3):
1. *Separación de borde de ataque*: **rechazar diseños donde la presión de succión teórica exceda el
   70% de la presión de vacío.**
2. *Separación por flujo en envergadura*: **usar puntas delgadas** (y, nota del libro, "washout" —
   menor incidencia de sección en las puntas).
3. *Separación por choque interior*: **contornear el fuselaje para mantener el salto de presión a
   través del choque interior por debajo del 50%.**
4. *Separación por choque de borde de salida*: **mantener la razón de presiones por debajo de
   `1 + 0.3·M1²`**, usando el Mach normal local `MN1 = M1 cos Λ_TE` en bordes en flecha.
**Rango/advertencia literal**: *"Application of these criteria does not guarantee that the flow will not
separate, however, and wind-tunnel tests of proposed designs must be undertaken. This is particularly
true for military or sport aircraft designed for maneuvering at high load factors."*

---

## 3. FIXTURES DE TEST

Todos los ejemplos resueltos de los caps 10–14, más las tablas numéricas y las respuestas a problemas
seleccionados (p.809–810), que el libro publica y por lo tanto son verificables.

> **La geometría compartida de los Ejemplos 10.1 / 10.2 / 10.3** (Fig. 10.5, p.564): perfil de doble
> cuña **simétrico**, semiángulo `δw = 10°`, espesor máximo a media cuerda ⇒ `t = 0.176c`;
> `M∞ = 2.0`; `α = 10°`. Cuatro facetas numeradas: 1 = dorso delantero (paralela a la corriente,
> θ₁ = 0), 2 = dorso trasero (θ₂ = −20°, expansión), 3 = vientre delantero (θ₃ = +20°, compresión),
> 4 = vientre trasero (θ₄ = 0). El ángulo de onda de choque es `θw = 53.5°`.
> **Advertencia del propio libro**: este perfil es mucho más grueso que uno supersónico real
> (`t ≈ 0.05c`), y por eso el L/D sale bajo. Se usó *"in order to clearly illustrate the calculation
> procedures."*

```
FIXTURE bertin-ej-10.1  [§10.1, p.558-560]  teoría LINEAL (Ackeret)
entradas: M_inf=2.0, alpha=10 deg, doble cuña simétrica delta_w=10 deg (t=0.176c),
          gamma=1.4, no viscoso
salida esperada:
  Cl       = 0.4031
  Cd       = 0.1407
  L/D      = 2.865
  Cm_c/2   = 0.0000     (perfil simétrico => línea de curvatura media zc = 0)
  Cp1 = 0.0000 ; Cp2 = -0.4031 ; Cp3 = +0.4031 ; Cp4 = 0.0000
tolerancia: 1% (el libro redondea a 4 cifras)
notas: verifica ec.(10.8) Cl=4a/sqrt(M^2-1) y ec.(10.16) con su_bar^2=sl_bar^2=delta_w^2
       (delta_w en radianes = 10/57.296)
```

```
FIXTURE bertin-ej-10.2  [§10.2, p.561-563]  BUSEMANN 2do orden
entradas: idénticas a bertin-ej-10.1
salida esperada:
  Cp1 = 0.0000
  Cp2 = -0.4031 + 0.1787 = -0.2244     (theta = -20 deg)
  Cp3 = +0.4031 + 0.1787 = +0.5818     (theta = +20 deg)
  Cp4 = 0.0000
  Cl      = 0.3846
  Cd      = 0.1400
  Cm_c/2  = 0.04329
tolerancia: 1%
notas: (a) el termino cuadratico vale +0.1787 en AMBAS facetas (siempre positivo);
       (b) integracion por ec.(10.24b) Cl = (1/(2 cos dw)) * Sum(Cp cos theta)
           y ec.(10.25b) Cd = (1/(2 cos dw)) * Sum(Cp sin theta);
       (c) momento por ec.(10.27), que CONSERVA los terminos en tan^2(delta_w);
       (d) Cm_c/2 != 0 => "the aerodynamic center is not at the midchord, but is only
           a small distance away".
```

```
FIXTURE bertin-ej-10.3  [§10.3, p.566-569]  CHOQUE-EXPANSION (referencia "exacta")
entradas: idénticas a bertin-ej-10.1
cadena esperada (region por region):
  region 1: M1 = 2.0   nu1 = 26.380 deg  theta1 = 0     Cp1 = 0.0
            mu_a = asin(1/M) = 30 deg
  region 2: theta2 = -20 deg -> nu2 = nu1 + 20 = 46.380 deg -> M2 = 2.83
            p2/pt = 0.0352 ; ptinf/pinf usa 0.1278 -> Cp2 = -0.2588
  region 3: giro de +20 deg a traves del choque oblicuo; theta_w = 53.5 deg
            M_inf*sin(theta_w) = 1.608 -> p3/p_inf = 2.848 -> Cp3 = 0.66
            M3 = 1.20 ; nu3 = 3.558 deg
  region 4: theta4 = 0 -> nu4 = nu3 + 20 = 23.558 deg -> M4 = 1.90
            p4/p3 via pt3=pt4 (0.1492/0.4124) -> Cp4 = +0.0108
  angulos de Mach de los abanicos:
            mu_lb = 30.0 deg ; mu_tb = 20.7 deg ; mu_ld = 56.4 deg ; mu_td = 31.8 deg
  razones de presion sobre las 4 facetas (p/p_inf): 1.000 / 0.275 / 2.848 / 1.030
salida esperada:
  Cl      = 0.4438
  Cd      = 0.1595
  L/D     = 2.782
  Cm_c/2  = 0.04728
tolerancia: 1% en coeficientes; 0.5 deg en angulos
notas: M4 < M_inf porque el choque disipa (pt3 < pt_inf). ESTA es la salida de referencia
       contra la que se miden las otras dos teorias.
```

```
FIXTURE bertin-tabla-10.2  [§10.3, p.571]  comparacion de las TRES teorias
entradas: idénticas a bertin-ej-10.1
salida esperada (Lineal / Busemann / Choque-expansion):
  Cp1     :  0.0000  /  0.0000  /  0.0000
  Cp2     : -0.4031  / -0.2244  / -0.2588
  Cp3     : +0.4031  / +0.5818  / +0.6600
  Cp4     :  0.0000  /  0.0000  / +0.0108
  Cl      :  0.4031  /  0.3846  /  0.4438
  Cd      :  0.1407  /  0.1400  /  0.1595
  Cm_0.5c :  0.0000  /  0.04329 /  0.04728
tolerancia: 1%
uso: es el test de "escalera de fidelidad" del motor 2D supersonico. El error en Cl de la
     lineal vs choque-expansion es -9.2%; en Cd, -11.8%; en Cp3 local, -39%.
```

```
FIXTURE bertin-tabla-10.1  [§10.2, p.562]  coeficientes de Busemann (LUT, aire gamma=1.4)
salida esperada (extracto verificable; la tabla completa va de M=1.10 a M=inf):
  M=1.10 -> C1=4.364 C2=30.316      M=1.50 -> C1=1.789 C2=2.288
  M=1.20 -> C1=3.015 C2= 8.307      M=2.00 -> C1=1.155 C2=1.467
  M=1.30 -> C1=2.408 C2= 4.300      M=3.00 -> C1=0.707 C2=1.269
  M=1.40 -> C1=2.041 C2= 2.919      M=4.00 -> C1=0.516 C2=1.232
                                    M=5.00 -> C1=0.408 C2=1.219
                                    M=10.0 -> C1=0.201 C2=1.204
                                    M=inf  -> C1=0.000 C2=1.200
tolerancia: exacta (es una tabla; nuestro codigo debe REPRODUCIRLA desde ec.(10.23a))
```

```
FIXTURE bertin-tabla-11.1  [§11.6.1, p.589]  flujo conico, ala rectangular (Bonney 1947)
formulas cerradas a implementar y verificar (beta = sqrt(M^2-1), alpha en radianes):
  Perfil placa plana:  CL = 4a/beta                 CD = 4a^2/beta + CD_friction
  Ala   placa plana:   CL = (4a/beta)*(1 - 1/(2*AR*beta))
                       CD = (4a^2/beta)*(1 - 1/(2*AR*beta)) + CD_friction
                       CM0 = (2a/(AR*beta))*(AR*beta - 2/3) ... [ver texto]
                       xcp/c = ... (AR*beta - 2/3)/(2*AR*beta - 1) ...
  Perfil con espesor:  CD = 4a^2/beta + K1*tau^2/beta + CD_friction
  Ala   con espesor:   incluye el factor (1 - C3*A) sobre el termino de punta
  C3 = [ gamma*M^4 + (M^2-2)^2 ] / [ 2*(M^2-1)^(3/2) ]
  A  = area transversal del perfil / cuerda^2
  valores de (A, K1):  doble cuña        A = tau/2      K1 = 4
                       doble cuña modif. A = 2*tau/3    K1 = 6
                       biconvexo         A = 2*tau/3    K1 = 5.33
tolerancia: exacta en A y K1 (Problemas 10.8 y 11.2 piden DEMOSTRARLOS)
test derivado (Problema 10.8): Cd_thickness = 4*tau^2/sqrt(M^2-1) para doble cuña simétrica
                               Cd_thickness = 5.33*tau^2/sqrt(M^2-1) para biconvexo
```

```
FIXTURE bertin-tabla-11.2  [§11.6.3, p.597]  rectangular vs delta vs arrow, M = 1.50
entradas comunes: M_inf = 1.50 ; Lambda = 70 deg (delta y arrow) ; b*cot(Lambda) = 0.4
                  delta: a = 0 ; arrow: a = 0.25 ; ambos con b = 0.2
                  rectangular: AR = 1 ; espesor de raiz tau = 0.10
salida esperada:            Rectangular   Delta     Arrow
  (beta/4)*dCL/dalpha          0.554        -        0.591
  dCL/dalpha                   1.98        1.94      2.11
  area relativa S              1.00        1.018     0.938
  cuerda de raiz relativa l    1.00        1.69      1.26
  espesor de raiz tau          0.10        0.059     0.080
  CD_thickness                 0.0119      0.0048    0.0070
  CD_friction                  0.0060      0.0060    0.0060
  CD0                          0.0179      0.0108    0.0130
  (CL/CD)_max                  5.25        8.6       9.3
tolerancia: 1%
uso: es el fixture de "seleccion de planta" para el modulo de configuracion supersonica.
```

```
FIXTURE bertin-ej-11.1  [§11.7.1, p.601-605]  delta de cuña simple, alpha = 0 (Puckett 1946)
entradas: delta con borde de ataque en flecha Lambda_LE, seccion de cuña simple de pendiente
          constante lambda, alpha = 0, borde de salida romo
salida esperada (forma cerrada, VERIFICABLE simbolicamente):
  u(x,y,0) = -(lambda*U_inf/pi) * ( 2/[ (tan^2(LE)/beta^2) - 1 ]^0.5 )
             * cosh^-1{ (tan(LE)/beta) * [ (1-(beta*y/x)^2) / (1-(y^2 tan^2 LE)/x^2) ]^0.5 }
  Cp(x,y,0) = -2u/U_inf
propiedad a verificar: Cp es INVARIANTE a lo largo de rayos y/x = const  => es un flujo CONICO
CD_wave por ec.(11.25):  CDw = 2 * Int_Su Cpu(x,y)*lambda_u(x,y) dx dy
tolerancia: simbolica
```

```
FIXTURE bertin-ej-11.2  [§11.7.1, p.606-608]  distribucion de presion en delta de cuña simple
entradas: Lambda_LE = 60 deg ; M_inf = 2.2 ; t/c en el plano de simetria = 0.04
          => pendiente de superficie lambda = 0.02
salida esperada:
  mu    = asin(1/2.2)      = 27.04 deg     (onda de Mach del apice)
  beta  = sqrt(2.2^2 - 1)  = 1.9596
  n     = tan(60)/beta     = 0.88388        (n<1 => borde de ataque SUPERSONICO)
  Cp*beta/lambda           = 2/sqrt(1-n^2) = 4.276
  Cp (region entre borde de ataque y onda de Mach) = 0.0436   (constante, valor 2D)
  la onda de Mach corta el borde de salida en y = 0.442*b
  => el plano y = 0.450*b queda ENTERO en la region 2D: Cp = 0.0436 independiente de x
  en el resto: Cp = (4*lambda/(beta*pi*sqrt(1-n^2))) * Real{ pi/2 - asin( sqrt((n^2-s^2)/(1-s^2)) ) }
               con s = tan(Lambda_LE) * y/x  (s=0 plano de simetria, s=1 borde de ataque, s=n onda de Mach)
  estaciones pedidas: y = 0.125b, 0.250b, 0.375b, 0.450b
tolerancia: 1% en Cp; 0.05 deg en mu
```

```
FIXTURE bertin-ej-11.3  [§11.7.2, p.613-618]  VORTEX-LATTICE SUPERSONICO, delta placa plana
entradas: M_inf = 1.5 ; placa plana (curvatura cero) ; beta*cot(Lambda_LE) = 0.6
          => beta = 1.118 ; Lambda_LE = 61.78 deg
          en el plano (x, beta*y) el borde forma 59.04 deg con el eje beta*y
          Nmax = 4 ; xLE = beta*y/0.6 ; xTE = Nmax/(beta*cot LE) = 6.6667
          dzc/dx = -tan(alpha) ~= -alpha
pesos esperados A(L,N)  (fila N vs columna L=1..7):
  N=0  : 1.0000 1.0000 1.0000 1.0000 1.0000 1.0000 1.0000
  N=+-1: 0.0000 0.3333 1.0000 1.0000 1.0000 1.0000 1.0000
  N=+-2: 0.0000 0.0000 0.0000 0.6667 1.0000 1.0000 1.0000
  N=+-3: 0.0000 0.0000 0.0000 0.0000 0.0000 1.0000 1.0000
  N=+-4: 0.0000 0.0000 0.0000 0.0000 0.0000 0.0000 0.3333
  B(7,N) = 0.6667 ; B = 1 en el resto
  C(7,+-4) = 0.5  ; C = 1 en el resto
salida esperada (todo en unidades de alpha/beta):
  dCp_a(1,0) = 4.0000     dCp_b(1,0) = -0.8016     dCp(1,0) = 2.7996
  dCp_a(2,0) = 0.6393     dCp_b(2,0) = +2.0128     dCp(2,0) = 0.9827
  dCp_a(2,1) = 5.6804     dCp_b(2,1) = +3.3820     dCp(2,1) = 3.9730 = dCp(2,-1)
tolerancia: 0.5% (los valores del libro traen 4-5 cifras)
invariantes que el solver DEBE cumplir (test independiente del numero):
  Rbar(0,0) = 0                          (un elemento no se influye a si mismo)
  Sum_N Rbar(L*-L, N*-N) = 0             (upwash = downwash; sin desplazamiento neto)
gotcha registrado por el libro: en la fila L* del propio punto de campo se usan los valores
  PRELIMINARES dCp_a (p.ej. dCp_a(2,0)=0.6393, NO dCp(2,0)=0.9827); para filas anteriores se
  usan los valores FINALES promediados. Es una convencion de Carlson & Miller (1974) que hay
  que replicar exactamente o los numeros no salen.
gotcha 2: la ec.(11.31) publicada en Carlson & Miller (1974) esta MAL; la version correcta es
  la del texto de Bertin [p.613], corregida segun Carlson & Mack (1978).
problemas de continuacion (sin respuesta publicada, pero mismo caso):
  11.14 -> dCp(3,0) ; 11.15 -> dCp(3,+-1)
```

```
FIXTURE bertin-ej-12.1  [§12.2, p.659]  hemisferio, newtoniana vs experimento
entradas: hemisferio en el Trisonic Wind Tunnel de la USAFA, M = 4.38, alpha = 0
medicion:  Cp(theta_b = 0 deg)  = 0.0237      (tope del hemisferio)
           Cp(theta_b = 90 deg) = 1.818       (punto de estancamiento)
prediccion newtoniana (Cp = 2 sin^2 theta_b):
           Cp(0 deg)  = 0.0
           Cp(90 deg) = 2.0
salida esperada del test: la newtoniana SOBREPREDICE el estancamiento ~10%
tolerancia: el 10% es el resultado, no el error admisible
corolario de test: con newtoniana MODIFICADA y Cp_t2 = 1.8 [concept box, p.667] la prediccion
  "matches the experimental data extremely well" en las 10 tomas de presion del modelo.
```

```
FIXTURE bertin-ej-12.2  [§12.4, p.668-669]  arrastre de presion de una ESFERA (newtoniana mod.)
entradas: esfera, sin friccion, Cp = Cp_t2 * sin^2(theta_b), Cp = 0 en la sombra
          y = (2xR - x^2)^0.5 ; limites 0 <= x <= R
salida esperada (derivacion simbolica cerrada):
  D  = (Cp_t2/2) * q_inf * pi * R^2
  CD = D/(q_inf*pi*R^2) = Cp_t2 / 2
tolerancia: exacta (simbolica)
```

```
FIXTURE bertin-cilindro-12.22  [§12.4, p.669-670]  cilindro circular recto (eje normal al flujo)
salida esperada:  Cd_p = (2/3) * Cp_t2                       [ec. 12.22]
                  (el Problema 12.6 pide demostrarla)
verificacion experimental [Fig. 12.16, Koppenwallner 1969]: acuerdo "outstanding", y el Cd de
  presion alcanza su valor limite hipersonico ya en M_inf = 4.
friccion en regimen enrarecido: Cd_f = 5.3 / Re_2^1.18   para Re_2 > 10
  con Re_2 = rho_2*U_2*d/mu_2 (condiciones DETRAS del choque normal)
umbral: el drag total sube significativamente cuando Kn = lambda/d > 0.01  [Fig. 12.17]
```

```
FIXTURE bertin-ej-12.3  [§12.4, p.672-678]  CONO AFILADO, coeficientes newtonianos modificados
entradas: cono de semiangulo theta_c, -theta_c <= alpha <= theta_c, sin friccion,
          Cp_base = 0, area de referencia pi*Rb^2, Rb = xL*tan(theta_c)
salida esperada: ecuaciones (12.34) CA, (12.36) CN, (12.37) CL, (12.38) CD, (12.44) CM0,
                 (12.52) xcp = (2/3)*xL, (12.53) ycp    [ver seccion 2, F-12.4]
verificaciones simbolicas incluidas en el ejemplo:
  - el termino de momento de ALABEO es identicamente cero (fuerzas de presion pasan por el eje)
  - CM0,N = CN * (-2/3 * xL/Rb)                                  [ec. 12.48]
  - CM0 = CM0,N + CM0,A  y  CM0 = -CN*(xcp/Rb) - CA*(ycp/Rb)     [ec. 12.45, 12.51]
respuestas publicadas de los problemas derivados (p.810):
  12.11 (medio cono):  L/D = 2/(pi*tan(theta_c))   para alpha = 0
  12.12:               xcp = 2*xL/3
tolerancia: simbolica
casos numericos pedidos por el libro (M_inf=10, theta_c=10 deg, -10<=alpha<=10):
  Problema 12.7 CD(alpha) ; 12.8 CL(alpha) ; 12.9 L/D(alpha) ; 12.10 CM(alpha) y
  estabilidad estatica si xcg = 0.6*xL  -> son barridos de regresion para el modulo hipersonico.
```

```
FIXTURE bertin-ej-12.4  [§12.4, p.678-682]  ARRASTRE TOTAL de un cono afilado (Tunel B, AEDC)
entradas: theta_c = 10 deg ; M_inf = 8 ; Tt1 = 1350 R ; pt1 = 850 psia ; Tw = 600 R ;
          alpha = 0 ; Rb = 3.0 in  => xL = 17.014 in ; longitud mojada lc = 17.276 in
cadena esperada:
  Me = 6 ; Cp_e = 0.07                        [Figs. 8.15b,c para cono de 10 deg a M=8]
  p1 = (p1/pt1)*pt1 = (102e-6)*(850) = 0.0867 psia
       [OJO: el texto imprime "0.867 psia" en una linea y usa 0.0867 en la siguiente.
        102e-6 * 850 = 0.0867. El 0.867 es una ERRATA/OCR. Usar 0.0867.]
  pe = p1*(1 + (gamma/2)*M1^2*Cp_e) = 0.0867*[1 + 0.7*64*0.07] = 0.3586 psia
  Te = (Te/Tte)*Tte = 0.12195*1350 = 164.63 R
  Re_l = 5.226e6 * l   (l en pies, a lo largo de la generatriz)
  Re_lc = 7.523e6      -> puede haber transicion, "probably within the first one-half of the
                          cone length"
  pb/pe = 0.02  [Fig. 12.24, correlacion de Cassanto 1973 para RN/Rb <= 0.1, turbulento]
  pb = 0.00717 psi
  Cp_b = (pb/pe)*(pe/p1) - 1) * 2/(gamma*M1^2) = -0.0205
         (compara con el supuesto newtoniano Cp_b = 0: "very close")
  T* (Eckert) = 0.5*(Te+Tw) + 0.22*r*(Tte - Te), r = Pr^(1/3) = 0.888 para Pr = 0.70
     T* = 0.5*(164.63+600) + 0.22*0.888*(1350-164.63) = 613.89 R
  Re*_l = 4.353e5 * l
  Cf = 0.0583/(Re*_l)^0.2 = 0.004344 / l^0.2
  tau = Cf*(gamma/2)*pe*Me^2 = 0.03926 / l^0.2   lbf/in^2
salida esperada (desglose del arrastre):
  D_presion  = pe*pi*Rb^2                        = +10.139 lbf   (73.0%)
  D_friccion = 0.04218 * lc^1.8 / 1.8            = + 3.956 lbf   (28.5%)
  D_base     = -pb*pi*Rb^2                       = - 0.203 lbf   (-1.5%)
  D_total                                        =  13.892 lbf
tolerancia: 1%
uso: es EL fixture del pipeline hipersonico completo (presion + base + friccion con
     temperatura de referencia de Eckert). Cubre 3 modulos de un jalon.
problema derivado 12.14: repetir con theta_c = 20 deg (mismo tunel) -> segundo caso de regresion.
```

```
FIXTURE bertin-choque-real-12.3  [§12.3, p.663]  gas perfecto vs aire en equilibrio
entradas: M1 = 14, altitud 150,000 ft (45,721 m), U.S. Standard Atmosphere 1976
salida esperada:
  Ht1 = h1 + 0.5*U1^2 = Ht2 = 4636.77 Btu/lbm         (vale para AMBOS modelos)
  aire en equilibrio termodinamico:  pt2 = 0.3386 atm (716.57 lbf/ft^2)   Tt2 = 8,969.6 R
  aire perfecto (ec. 12.12-12.16):   pt2 = 0.3256 atm (689.12 lbf/ft^2)   Tt2 = 19,325 R
tolerancia: 1% en pt2 ; 1% en Tt2
lectura fisica del test: la presion difiere ~4% pero la TEMPERATURA difiere por un factor de
  2.15 -> "the energy absorbed by the dissociation process causes the real-gas equilibrium
  temperature to be markedly lower than the perfect-gas value".
  => un codigo de gas perfecto puede dar cargas aceptables y calentamiento absurdo.
fixture acompanante [Fig. 12.13, p.665]:
  Cp_t2 en M1=24: 1.932 (equilibrio) / 1.838 (perfecto) / 2.000 (newtoniano)
  Cp_t2 en M1=4 : ~1.8 para ambos modelos de aire
umbrales de disociacion a 150,000 ft (Hansen 1957): O2 empieza ~Mach 7 ; N2 empieza ~Mach 18
```

```
FIXTURE bertin-shuttle-gasreal-12.8  [§12.8, p.700-702]  anomalia hipersonica del Orbiter
entradas: Space Shuttle Orbiter, STS-1, alpha = 40 deg
prediccion del Aerodynamics Design Data Book: deflexion de body flap de 7.5 deg para trimar
realidad en vuelo: delta_BF ~ 16 deg
explicacion cuantificada:
  gas perfecto (gamma=1.4):        rho2 = 6*rho1
  aire en equilibrio (gamma=1.14): rho2 = 15*rho1
  => capa de choque mas delgada, onda mas tumbada, presiones de POPA menores y de PROA mayores
  => CM se corre a POSITIVO (nariz arriba) con gas real  [Fig. 12.42, M_inf = 23]
  a Mach 8 los datos de vuelo y el ADDB SI coinciden
uso: es el caso canonico de "el codigo estaba bien y el modelo de gas estaba mal". Debe ser
     una leccion en la escuela.
```

```
FIXTURE bertin-reentryF-12.9  [§12.9, p.703]  transicion: la incertidumbre dominante
entradas: Reentry F, cono de berilio de 3.96 m (13 ft), semiangulo 5 deg, alpha ~ 0,
          punta de grafito RN inicial 0.25 cm (0.1 in), pico M ~ 20, entalpia total ~18 MJ/kg
salida publicada:
  para casar el calculo con el vuelo hubo que SUPONER transicion instantanea en x/L = 0.625
  exactitud tipica declarada (Hamilton): 20-25% turbulento ; 15-20% laminar
bandas de incertidumbre que el software DEBE propagar:
  correlaciones de inicio y extension de transicion: inciertas "by a factor of three or more"
  estimaciones del punto de transicion (DSB 1988): entre 20% y 80% a lo largo del cuerpo
  impacto: "can affect the vehicle gross takeoff weight by a factor of two or more"
caso NASP [Fig. 12.44, Whitehead 1989]:
  capa limite totalmente LAMINAR   -> ~ -6% de arrastre
  capa limite totalmente TURBULENTA -> ~ +8% de arrastre
  con laminar sustancial en el morro: +60% a +70% de carga util
```

```
FIXTURE bertin-waverider-12.5  [§12.5, p.687-689]  waverider Mach 4 en el UPWT de NASA Langley
entradas: 4 configuraciones (waverider M4, flat-top, waverider invertido, flat-bottom),
          M_inf = 4 ; Re_inf/ft = 2e6 ; granalla de 0.0215 in a 4.0 in del borde de ataque
          area mojada: flat-top 897.6 in^2 ; waverider 915.2 in^2
salida esperada:
  el waverider M4 es el de mayor CL_alpha; las flat-bottom muestran -7% en CL_alpha
  el waverider M4 tiene +15% de CL_alpha respecto a si mismo invertido
  drag de base = 25% a 30% del arrastre total
  friccion ~ 25% del arrastre total de proa
  (CD0)_p del flat-top/flat-bottom = 13% MENOR que la del waverider
  (L/D)_max del waverider = 13% MENOR que lo predicho por el codigo de diseno
  (L/D)_max del flat-top  = 5%  MAYOR que la del waverider
  PERO: "the waverider has higher L/D values than the flat-top configuration for CL > 0.16"
  causa declarada del deficit: "slight shock detachment that was observed at the design Mach
  number and angle of attack"
dato de penalizacion por punta roma (Eggers & Radespiel 1993): espesor de borde de ataque de
  10/5000 de la longitud del vehiculo -> L/D no viscoso cae ~25%
```

```
FIXTURE bertin-hipercrucero-12.7  [§12.7, p.697-699]  Mach 10 global reach (Bogar et al. 1996b)
entradas/salidas publicadas (fixture de sizing conceptual):
  alcance objetivo: 8,500 nmi en < 90 min desde el despegue
  longitud ~200 ft ; area de referencia ~10,000 ft^2 ; peso bruto al despegue ~500,000 lb
  desglose de arrastre en crucero: presion/onda 78% ; viscoso 15% ; resto = borde de ataque + base
  limite de combustible: Mach ~8 es el techo de enfriamiento con hidrocarburo endotermico
  hidrogeno: mas capacidad de enfriamiento; su alcance MAXIMIZA cerca de Mach 10
  Harris (1992): Mach > 10-15 no mejora significativamente el tiempo de bloque
      (Mach 10 => alcance global en 3 h de tiempo de bloque)
  conclusion de forma (Bogar 1996a): "At Mach 10 cruise conditions, lifting bodies and
      waveriders provide comparable performance."
```

```
FIXTURE bertin-ea6b-13.5  [§13.5.1, p.742-747]  EA-6B, paquete de mejora aerodinamica
entradas: EA-6B Prowler, >54,000 lb de peso bruto, 10,000 lb mas pesado que el A-6,
          pérdida cerca de alpha = 16 deg, maniobra de referencia: viraje 2g con 60 deg de
          alabeo a 250 kt
modificaciones: borde de ataque interior caido, estrias en el guante, extension de deriva,
          frenos/alerones de punta, bordes de ataque y salida recontorneados
salida esperada (medida):
  la caracteristica direccional inestable se corre +6 deg en alpha
  aumento de CL_max utilizable en configuracion de crucero: +22% a Mach bajo, +30% a Mach alto
  con recontorneo + estrias + borde caido: +25% de CL_trim [Fig. 13.36]
  la deriva extendida se dimensiono para dar al EA-6B la MISMA estabilidad direccional a alpha
  bajo que tenia el A-6 (compensando el fuselaje mas largo)
restriccion del cliente: "no major changes were allowed to the main wing or airframe structure"
```

```
FIXTURE bertin-f16-13.5.2  [§13.5.2, p.750-751]  seleccion de planta del YF-16
salida publicada (Buckner et al. 1974):
  relacion de estrechamiento (taper ratio) seleccionada: 0.227
  alargamiento (AR) seleccionado: 3.0  (minimiza el peso de inicio de combate)
  flecha: el peso es relativamente insensible entre 35 y 40 deg; ensayos limitados a 35-45 deg
          (mas flecha mejora supersonico; 45 deg penaliza tamano y favorece la reversion de alerones)
  espesor relativo: t/c = 0.04 (el mas delgado practico, limitado por flutter y reversion de aleron)
tension de diseno registrada: "a lighter weight airplane results with a thicker wing, but
  supersonic maneuverability improves with thinner wings"
```

```
FIXTURE bertin-stores-13.5.3  [§13.5.3, p.756-757]  carga conformal vs convencional
entradas: MK-82 en un caza; barrido M = 0.7 a 1.2
salida esperada:
  14 bombas MK-82 en carga CONFORMAL vs 12 MK-82 en pilon/rack multiple:
     -48% de CD en la parte baja del barrido ; -35% en la parte alta
beneficios adicionales declarados: mas armas, mas flexibilidad, mayor velocidad de penetracion,
  limites de maniobra mas altos, mejor persistencia supersonica, y "Lateral directional
  stability is actually improved with the weapons on."
```

```
FIXTURE bertin-f16xl-13.5.3  [§13.5.3, p.757]  beneficios del F-16XL (SCAMP)
salida publicada (Hillaker 1982):
  -40% a -85% de arrastre con carga de armas integrada
  +50% de L/D supersonica, sin penalizacion subsonica
  -17% de arrastre de onda
  +83% de combustible interno
  objetivo del programa: >= +50% de L/D supersonica reteniendo L/D subsonica alta
  primer vuelo: 3 de julio de 1982, Carswell AFB
```

```
FIXTURE bertin-f22-13.8  [§13.8, p.766-767]  geometria externa del F-22
salida publicada (Mullin 1992):
  area de referencia del ala: 840 ft^2
  envergadura: 44.6 ft  (compatible con los refugios existentes -> RESTRICCION de infraestructura)
  alargamiento: 2.37
  superficies: flaps de borde de ataque de cuerda constante, alerones y flaperones
  horas de tunel de viento en dem/val (1986-1989): 20,000
```

```
FIXTURE bertin-f18e-protuberancias-14.3  [§14.3, p.785-786]  drag de protuberancias, F/A-18E
salida publicada (Niewald & Parker 2000):
  94 tipos de protuberancia -> 386 items individuales
  88,340 sujetadores externos ; 2,180 ft lineales de juntas/gaps
  71% del drag de protuberancias se baso en datos de tunel (modelo al 8%)
  convencion: 1 "drag count" = un CD de 0.0001
  el item mas caro de la lista: tapa de bisagra de aleron (~5 counts) [Fig. 14.2]
  resultado del programa: se eliminaron 60 vuelos del plan de evaluacion de performance
uso: es el fixture del modulo de "drag de excrecencias" y demuestra por que ese modulo existe.
```

```
FIXTURE bertin-costos-14.5  [§14.5, p.789-790]  modelo de costo relativo de las herramientas
salida publicada (ordenes de magnitud, al momento de escritura del libro):
  1 punto de ensayo en vuelo de separacion de armamento:   ~ $1 M
  programa extenso de separacion/despliegue en vuelo:      ~ $50 M
  1 vuelo de I+D para base tecnologica de un vehiculo M10: ~ $50 M
  programa de tunel para vehiculo de alto desempeno:       ~ $250 K a $900 K (modelo + ocupacion)
  correr un codigo, varias condiciones:                    ~ $50 K
regla de escala declarada:
  vuelo  =  2 ordenes de magnitud mas caro que  tunel
  tunel  =  1 orden de magnitud  mas caro que  CFD
advertencia literal: "these numbers are very approximate and highly dependent on the types of
  testing being used", y el costo del CFD es DESPUES de desarrollar el codigo (que puede llevar
  varios anos) y sin contar la generacion de malla (que "may take months").
```

```
FIXTURE bertin-cfd-crecimiento-13.9  [§13.9, p.768]  crecimiento de la capacidad CFD (AEDC)
salida publicada (Skelley et al. 2007):
  1988: F-15E, ecuaciones de EULER, ~1,000,000 puntos de malla, 4 SEMANAS de vuelta
        (malla + solucion + post-proceso)
  2007: JSF,   ecuaciones de NAVIER-STOKES, 25,000,000 puntos, 2 SEMANAS de vuelta
  mejora declarada: "nearly four order of magnitude improvement over the 1988 capability"
uso: es el fixture de "cuanto cuesta hoy" y la justificacion de por que el precomputo en GPU
     tiene sentido para nosotros.
```

```
FIXTURE bertin-shuttle-tunel-11.13  [§11.13, p.642]  cuando NO hay modelo de flujo utilizable
salida publicada (Whitnah & Hillje 1984):
  Space Shuttle, fase C/D: 493 ensayos de tunel de viento, 52,993 horas
  razon declarada: "the complex nature of the flow field made it impossible to develop realistic
    flow models for numerical solutions"
  caso de referencia fotografiado: M_inf = 1.25, alpha = 10 deg, con
    dE,L = -18.8 deg ; dE,R = +14.4 deg ; dSB = -87.2 deg ; dR = -25 deg ; dBF = 23.7 deg
advertencia que acompana: "because wind-tunnel flows are also simulations (limited in model
  scale, high-temperature effects, etc.), wind-tunnel measurements should be correlated with the
  corresponding computed values based on solution techniques employing adequate flow models
  before extrapolating to flight."
```

```
FIXTURE bertin-lfc-13.4.2  [§13.4.2, p.735-736]  control de flujo laminar
X-21A (dos WB-66 modificados, 1960):
  ala de 30 deg de flecha, AR = 7, t/c ~ 10%
  velocidades de succion: 0.0001*U_inf (gradiente despreciable) a 0.0010*U_inf (borde de ataque)
  laminar de CUERDA COMPLETA hasta Re = 45.7e6
Jobe et al. (1978), transporte militar subsonico grande con LFC hasta 0.70c:
  ahorro de combustible: 27% a 30%
  avion de minimo combustible: AR el mas alto, t/c el mas bajo, flecha de c/4 ~12 deg, M = 0.78
  avion de maxima productividad: t/c el mas bajo (lo dominante), luego AR, luego flecha, M = 0.85
  sensibilidad (Tabla 13.1): minimo combustible -> AR alto (dominante), t/c bajo (secundario),
    flecha "no es consideracion mayor"
F-16XL-2 con guante de titanio: >10,000,000 de agujeros, 45 vuelos entre oct-1995 y nov-1996
```

```
FIXTURE bertin-holloman-14.3  [§14.3, p.788]  Holloman High Speed Test Track
salida publicada (USAF 846th Test Squadron):
  longitud de la via: 50,788 ft
  record 2003: 9,465 ft/s = 6,453 mph  (> Mach 9)
  motor Super Roadrunner: 228,000 lbf de empuje durante 1.4 s, peso 1,100 lb
  aceleracion maxima del trineo: 157 g
  energia de impacto de la carga util: 363 MJ (= un auto contra un muro a 2,020 mph)
uso: es el "cuarto banco" que el libro no lista en su taxonomia de dos ramas pero si describe:
     ni tunel ni vuelo. Relevante para nosotros como recordatorio de que la taxonomia tiene fugas.
```

```
FIXTURE bertin-x51-12.5  [§12.5, p.690-691]  X-51A Waverider (scramjet)
salida publicada (USAF, mayo 2010):
  lanzado desde un B-52 a 50,000 ft
  booster de cohete solido -> ~Mach 4.8 en 4 s, luego jettison
  el scramjet quemo > 200 s y acelero el vehiculo a Mach 5
  fue el vuelo hipersonico con scramjet mas largo hasta entonces
```

### 3.1 Respuestas publicadas a problemas (p.809–810) — fixtures adicionales

Son casos resueltos por el libro con respuesta impresa; sirven como test de regresión barato.

```
FIXTURE bertin-prob-10.2  [p.809]  perfil parabolico infinitesimalmente delgado, teoria lineal
  Cl = (4/sqrt(M^2-1)) * (zmax/c)
  Cd = (1/sqrt(M^2-1)) * ( 4*alpha^2 + (2/3)*(zmax/c)^2 )
  Cm = (1/sqrt(M^2-1)) * ( -2*alpha - (2/3)*(zmax/c) )
  (comparar contra el Ejemplo 8.3 del mismo libro, M_inf = 2.059, zmax = 0.1c)
```
```
FIXTURE bertin-prob-10.3/10.4/10.5/10.6  [p.809]  doble cuña, tau = 0.04, M = 2.0, 12 km
  alpha = 5 deg:
    10.3 teoria LINEAL :  Cl = 0.20153  Cd = 0.02128  Cl/Cd = 9.47  Cm = -0.10077
    10.4 BUSEMANN      :  Cl = 0.20041  Cd = 0.02124  Cl/Cd = 9.44  Cm = -0.09565
    10.5 CHOQUE-EXPANS.:  Cl = 0.20026  Cd = 0.02129  Cl/Cd = 9.41  Cm = -0.09566
    10.6 INCOMPRESIBLE :  Cl = 0.5483   Cd = 0.0      Cm = -0.1371
  LECTURA CRITICA: con tau = 0.04 (perfil realista) las TRES teorias supersonicas coinciden
  dentro de 0.6% en Cl y 0.2% en Cd -- al reves que en los Ejemplos 10.1-10.3 (tau = 0.176),
  donde diferian 9-12%. Este par de fixtures DEMUESTRA el rango de validez de la linealizacion
  y debe usarse como leccion de escuela.
  Y el caso incompresible da 2.7x mas Cl con Cd = 0: es la medida del precio del supersonico.
```
```
FIXTURE bertin-prob-10.9  [p.809]  diamante simetrico, M = 2.20, t = 0.07c, alpha = 6 deg
  tunel: pt1 = 125 psia, Tt = 600 R
  CA = 0.0096 ; CN = 0.192 ; Cl = 0.19 ; Cd = 0.03 ; Cm_c/2 = 0.008
FIXTURE bertin-prob-10.12  [p.809]  biconvexo, M = 2.2, t = 0.07L, alpha = 6 deg, LINEAL
  Cp_u = 1.021*[ 0.14*(1 - 2x) - 0.1047 ]
  Cp_l = 1.021*[ 0.14*(1 - 2x) + 0.1047 ]
```
```
FIXTURE bertin-prob-11.3  [p.809]  ala rectangular AR = 4, seccion de la Fig. 10.5, M = 2, a = 10 deg
  CL = 0.3804 ; CD = 0.1382 + CD_friction      (via Tabla 11.1, Bonney)
  comparar con el Cl 2D = 0.4031 -> el efecto de punta cuesta -5.6% de sustentacion
FIXTURE bertin-prob-11.4  [p.809]  ala rectangular AR = 2.75, biconvexa tau = 0.05, M = 1.50
  CL = 0.05315*alpha  (alpha en grados)   ;   CD = CL*alpha + 0.0270
FIXTURE bertin-prob-11.5  [p.809]  ala del Northrop F-5E: el borde de c/4 es sonico en M = 1.095
FIXTURE bertin-prob-11.20  [p.809]  perfil biconvexo 2D, R(x) = 2*t*(x/L)*(1 - x/L)
  Cp = 4*(t/L)*(1 - 2*(x/L)) / sqrt(M_inf^2 - 1)
  (el Problema 11.19 pide el cuerpo de revolucion del MISMO perfil, por teoria de cuerpo
   esbelto -> el par 11.19/11.20 es el test 2D-vs-axisimetrico)
```
```
FIXTURE bertin-prob-12.4  [p.810]  cuña de 30 deg a M = 6 -> Cp = 0.4545 (via Fig. 8.13b)
  newtoniana daria Cp = 2*sin^2(30) = 0.500  -> +10% de sobreprediccion
FIXTURE bertin-prob-12.5  [p.810]  cono afilado de 30 deg a M = 6
  Cp = 0.535 (correlaciones de la Fig. 8.16b) ; Cp = 0.500 (newtoniana)
  -> aqui la newtoniana SUBpredice 6.5%. El signo del error DEPENDE de la geometria.
FIXTURE bertin-prob-13.5  [p.810]  T-41 (Cessna 172), 125 kt, 10,000 ft, Re_x,tr = 500,000
  x_tr = 1.36 ft   (cuerda = 7 ft => la capa limite NO permanece laminar; transiciona al 19% de c)
FIXTURE bertin-prob-13.1  [p.810]  crucero a altitud y velocidad constantes consumiendo combustible
  alpha = alpha_0l + W/(q_inf * S * CL_alpha)   -> alpha DISMINUYE conforme baja W
```

---

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero y el software NO debe decidir

Esta sección es el contrato de humildad del producto. Cada entrada es un punto donde el libro dice
explícitamente que la respuesta la pone una persona.

### 4.1 La frase que gobierna todo el bloque

`[§14.5, p.790]` — **cierre del capítulo 14, y por lo tanto del libro:**
> *"All of the tools available to the aircraft designer, whether analytical/computational or
> experimental, require that he or she bring judgment born of experience to the application of these
> tools in the design process. **Good judgment comes from experience; experience comes from bad
> judgment.**"*

Y `[§14.5, p.790]`, Mullin (1992):
> *"the most important factor in successful aeronautical engineering has not changed: making technical
> decisions based on analysis, test data, and good engineering judgement... the paramount obligation
> of aeronautical engineers is to make critical technical decisions. The increasingly dominant role of
> digital computers in aircraft design and analysis has tended to confuse some of our engineering
> colleagues, but the truth of the matter is inescapable."*

**Requisito de producto que sale de aquí**: La Forja **jamás** debe presentar un resultado sin su
procedencia y su banda de validez. El software propone; el ingeniero decide y firma.

### 4.2 Decisiones que el software debe PEDIR, no calcular

| # | Decisión | Dónde lo dice el libro | Por qué no es automatizable |
|---|---|---|---|
| D-1 | **Elegir el método** (lineal / 2º orden / choque-expansión / paneles / Euler / RANS) | `[§14.1, p.777]` toda la sección está estructurada como "en orden creciente de sofisticación" | El costo y la fidelidad son un trade que depende de la pregunta, no del caso |
| D-2 | **Elegir el modelo de turbulencia** | `[§14.0, p.776]` *"turbulence models are not universal"* | El libro dice que un modelo bueno para una clase de flujo puede fallar en otra |
| D-3 | **Fijar la ubicación de la transición** laminar-turbulenta | `[§12.9, p.703-706]`, `[§14.3, p.787]` | Incierta por factor de 3; depende de gradiente de presión, rugosidad, ruido del túnel, tridimensionalidad. Y la elección mueve el GTOW por un factor de 2 |
| D-4 | **Decidir qué parámetros de similitud sacrificar** en un ensayo | `[§14.3, p.787]` *"Aerodynamic modeling is the art of partial simulation"* | La simulación completa casi nunca se logra; hay que elegir cuál importa para ESTE objetivo |
| D-5 | **Elegir la figura de mérito** del optimizador | `[§13.4.3, p.737]` AR óptimo = 7.5 / 9.8 / 12.0 / 15.2 según la figura de mérito | Cuatro respuestas correctas y distintas para el mismo avión |
| D-6 | **Fijar el nivel de inestabilidad (margen estático) permitido** | `[§13.6, p.763]` *"Static margin limit is a critical issue in control surface selection"* | Depende del sistema de control, de la certificación y del apetito de riesgo |
| D-7 | **Cerrar el compromiso multipunto** de un caza | `[§13.3, p.727-729]` *"Designers are thus faced with a situation of compromise"* | El libro dice que los requisitos de los distintos puntos son **contrarios**; no existe el óptimo único |
| D-8 | **Aceptar o rechazar la variable-geometría** | `[§13.3, p.729]` *"Although this is a satisfactory aerodynamic solution, in many cases the resultant weight increases to a configuration can be prohibitive"* | Es una decisión aero-estructural-de-costo, no aerodinámica |
| D-9 | **Elegir el radio del borde de ataque de un waverider** | `[§12.5, p.689]` *"leads to the need for compromise"* | Grande = menos calor, más arrastre. Chico = al revés. No hay óptimo sin criterio de misión |
| D-10 | **Elegir el ángulo del boattail** | `[§11.11, p.639]` *"boattails, therefore, have an optimal angle"* | Óptimo interior sensible a la configuración (aletas, chorro) que la fórmula no ve |
| D-11 | **Decidir si el diseño va a túnel** aunque pase los criterios | `[§11.8, p.627]` *"Application of these criteria does not guarantee that the flow will not separate, however, and wind-tunnel tests of proposed designs must be undertaken"* | Los criterios anti-separación son necesarios, no suficientes |
| D-12 | **Elegir los casos de validación** | `[§14.2, p.783]` Barber (1996): la elección de casos *"frequently is not appropriate for minimizing the risk of faulty data for a given design process"* | Elegirlos "desde la perspectiva del investigador" en vez de la del usuario final es el error típico |
| D-13 | **Decidir el reparto de sustentación entre ala y superficie de control** | `[§13.6, p.763]` ~12% es el óptimo medido, pero acompaña un margen estático concreto | Es un acoplamiento aero-control-certificación |
| D-14 | **Determinar si el flujo está separado** en el punto de diseño | `[§13.3, p.729]` las dos escuelas (mantener adherido vs controlar la separación) | Es una postura de diseño, no un resultado de cálculo |

### 4.3 Los cuatro estados de credibilidad de un código — definiciones literales

Esto no es filosofía: es un **modelo de datos** que La Forja debe implementar como metadato de cada
solver y de cada estudio.

**Validación** `[§14.2, p.783]` — Bradley (1988), literal:
> *"CFD code validation implies detailed surface and flow field comparisons with experimental data to
> verify the code's ability to accurately model the critical physics of the flow. Validation can occur
> only when the accuracy and limitations of the experimental data are known and thoroughly understood
> and when the accuracy and limitations of the code's numerical algorithms, grid-density effects, and
> physical basis are equally known and understood over a range of specified parameters."*

**Calibración** `[§14.2, p.783-784]` — Bradley (1988), literal:
> *"CFD code calibration implies the comparison of CFD code results with experimental data for
> realistic geometries that are similar to the ones of design interest, made in order to provide a
> measure of the code's ability to predict specific parameters that are of importance to the design
> objectives **without necessarily verifying that all the features of the flow are correctly modeled**."*

**Verificación** `[§14.2, p.784]` — Barber (1996), Rizzi & Vos (1996):
establece que el código genera soluciones numéricas **para el conjunto específico de ecuaciones y
condiciones de frontera** que dice resolver. Se hace con **experimentos puramente numéricos**:
estudios de refinamiento de malla y comparación contra problemas con solución analítica exacta.
*(Nota: verificación = "resolví bien las ecuaciones"; validación = "resolví las ecuaciones correctas".)*

**Certificación** `[§14.2, p.784]`:
cuestiones de programación — chequeos lógicos, estilo, documentación, aseguramiento de calidad.
Los casos de certificación se corren **antes de liberar una versión nueva** para verificar que no se
introdujeron errores nuevos en la versión previamente certificada.
→ **Esto es literalmente nuestra suite de regresión y nuestro gate de CI.**

**Reparto de responsabilidades, literal** `[§14.2, p.784]` (Rizzi & Vos 1996):
> *"the code developers are responsible for building a credible code and verifying and certifying that
> code. Experts with a strong background in developing numerical models to represent physical processes
> carry out the tasks of validating and of calibrating the code. The code is then passed on to the users,
> who are experts neither in code development nor in numerical modeling."*

**Y el requisito de quién corre la validación** `[§14.2, p.784]` (Cosner 1995), literal:
> *"The skill level of the user should be representative of the engineering (user) environment.
> Therefore, it is preferable that this validation should be performed by representative engineers
> from the user community, **not by the experts in the code or technology which is being tested**."*

→ Traducción a La Forja: nuestros gates de calidad deben correrse con un usuario "normal" del CAD,
no por quien escribió el solver. Es el mismo principio de nuestro arnés `forja-drive`.

**Advertencia sobre calibración** `[§14.2, p.784-785]` (Bradley 1995), literal:
> *"Calibration and validation should not be confused. Calibration provides an error band or correction
> factor to enhance the ability of a particular code to predict specific parameters... For example, one
> might calibrate a code's ability to predict shock location and lift and moment on a wing without any
> assurance that the flowfield off the surface and the wake behind the wing are properly modeled...
> Although the use of calibrated CFD solutions is dangerous because of the subtle viscous interactions
> that are extremely sensitive to geometry and flowfield, skilled engineers can often obtain useful
> design information and guidance from relatively immature codes."*

### 4.4 Errores que el libro nombra explícitamente como culpa del usuario, no del código

`[§14.2, p.783]` — Shang (1995), literal:
> *"Poor numerical approximations to physical phenomena can result from solving over-simplified
> governing equations. **Common mistakes have been made in using Euler equations to investigate
> viscous dominated flows, and employing the thin-layer approximation to Navier-Stokes equations for
> flowfield containing catastrophic separation.** Under these circumstances, no meaningful
> quantification of errors for the numerical procedure can be achieved. The physically correct value
> and the implementation of initial and/or boundary conditions are another major source of error in
> numerical procedures in which the appropriate placement and type of boundary/initial conditions have
> a determining effect on numerical accuracy."*

`[§14.2, p.783]` — Neumann (1988), literal:
> *"The codes are NOT an end in themselves... They represent engineering tools; tools that require
> engineering to use and critical appraisal to understand... CFD represents the framework for that
> modeling study and experiments represent the technique for introducing physical reality into the
> modeling process. Finally, classical analytical theory and the trend information produced by theory
> gives us the direction with which to assemble the point data from these numerical solutions in an
> efficient and meaningful way."*

→ **Requisito derivado, fuerte**: los métodos analíticos de los caps 10–12 no son "el modo barato";
son **el mapa** con el que se interpretan los puntos que escupe el CFD. La Forja debe presentar
siempre la curva teórica junto a los puntos calculados.

### 4.5 El caso Pegasus™ — por qué "sólo CFD" no basta

`[§14.1.6, p.781-782]`, Mendenhall et al. (1990). El diseño aerodinámico del Pegasus™ se hizo
**sin ningún ensayo de túnel**, usando toda la escalera de códigos (empírico → PNS → Navier-Stokes
axisimétrico → Navier-Stokes 3D). Los primeros lanzamientos fueron exitosos. Después de un fallo de
lanzamiento surgió la disputa de si la aerodinámica estaba mal predicha o si el control era
demasiado sensible.
**Diagnóstico publicado**: el problema estaba en las características **laterales-direccionales**, que
*"the methods of the day predicted to be slightly stable, while the actual vehicle turned out to be
slightly unstable."*
Conclusión literal: *"Understanding the uncertainties in the analysis required careful evaluation
since no prediction is exact."*

→ **Lección de producto**: el signo de una derivada de estabilidad cerca de cero es exactamente el
lugar donde la incertidumbre del método se vuelve una decisión de ingeniería. La Forja debe **marcar
en rojo** cualquier derivada de estabilidad cuyo valor caiga dentro de la banda de incertidumbre
declarada del método.

---

## 5. COSTO DE CÓMPUTO — tabla método × [NAVEGADOR | PRECÓMPUTO | GPU-VIVO]

### 5.1 La escalera del cap 14, clasificada

Orden del propio libro, de menor a mayor sofisticación `[§14.1, p.777-781]`.

| # | Herramienta | § | Qué pregunta responde | Fidelidad | Errores típicos | **Costo** |
|---|---|---|---|---|---|---|
| 1 | **Métodos semi-empíricos / base de datos** (MISL3, Missile Datcom, S/HABP) | §14.1.1 p.777-778 | ¿Cuáles son las fuerzas y momentos de una configuración *parecida a las de la base de datos*? | Buena dentro del dominio de la base; nula fuera | Extrapolar fuera del dominio; interferencia entre superficies no tabulada. MISL3 está **limitado a M ≤ 5** | **[NAVEGADOR]** — es interpolación en tablas |
| 2 | **Métodos de impacto / expansión** (newtoniana, newtoniana modificada, tangent-cone, Prandtl-Meyer) sobre paneles planos | §14.1.1 p.778, §12.2, §12.4 | ¿Cp, fuerzas, momentos y punto de estancamiento de un vehículo hipersónico? | Sorprendentemente buena para cuerpos romos a M alto (±10% o mejor con Cp,t2 real) | Falla en cuerpos esbeltos a M supersónico bajo; no ve la interacción viscosa; `Cp = 0` en sombra es una idealización | **[NAVEGADOR]** — `Cp = Cp,t2·cos²η` es **una raíz y un producto punto por triángulo**. Una malla de 50 k triángulos se evalúa en milisegundos en WebGL/WASM. **Este es el hallazgo de arquitectura del bloque.** |
| 3 | **Teoría lineal 2D (Ackeret) y Busemann** | §10.1, §10.2 | ¿Cl, Cd, Cm de un perfil supersónico? | ±10% en coeficientes para τ≈0.18; **<1% para τ≈0.04** | Cp locales muy malos con giros grandes; el momento es el peor predicho | **[NAVEGADOR]** — forma cerrada. Busemann usa LUT de 20 filas (Tabla 10.1) |
| 4 | **Choque-expansión** | §10.3 | ¿Cuál es la respuesta "exacta" no viscosa de un perfil de facetas? | Exacta bajo sus supuestos (choque atado y plano) | Muere si el choque se desprende; no da forma cerrada | **[NAVEGADOR]** — es una marcha de 4–20 regiones con inversiones de Prandtl-Meyer (Newton de 3–4 iteraciones cada una). Sub-milisegundo |
| 5 | **Flujo cónico** (Bonney, Puckett, Tabla 11.1) | §11.6 | ¿CL, CD, CM, xcp de alas rectangulares/delta/arrow en forma cerrada? | Analítica bajo linealidad | Requiere `β·AR ≥ 1`; ignora separación; secundarios de punta despreciados | **[NAVEGADOR]** — Tabla 11.1 son fórmulas algebraicas |
| 6 | **Métodos de paneles / singularidades de superficie** (VLM, PAN AIR, TRANAIR) | §14.1.2 p.778-779, §7, §11.7 | ¿Distribución de sustentación, CL y Cm a α bajo de una configuración compleja? ¿Wave drag supersónico? | Buena para crucero; *"the lift and pitch moment coefficients generated using these codes are best for low angles of attack"* | **No modelan la capa límite** ⇒ no dan fricción; **no modelan la interacción choque/capa límite** ⇒ no dan el drag inducido por separación en transónico; una elección mala de la variación de vórtice *"can lead to large source gradients and inaccuracies"* | **[NAVEGADOR]** para mallas chicas (≲2 k paneles: resolver un sistema denso 2 k×2 k en WASM es ~segundos) · **[PRECÓMPUTO]** para barridos de α/M. Literal del libro: *"since the computational intensity for panel methods is very low, the cost of computing the lift and pitch moment is relatively inexpensive"* |
| 6b | **VLM supersónico de Carlson & Miller** | §11.7.2 | Igual, pero supersónico | Buena; comparada contra teoría lineal exacta en Figs. 11.30–11.31 | El suavizado es obligatorio o el ΔCp oscila; sin succión de borde de ataque | **[NAVEGADOR]** — la matriz es **triangular por el cono de Mach**: se marcha del ápice hacia atrás, cero inversión de matriz. Ejemplo 11.3 usa ~2000 elementos |
| 7 | **Teoría de cuerpo esbelto / regla de áreas** | §11.10 | ¿Wave drag de volumen de un fuselaje? ¿Distribución de áreas óptima? | Buena para cuerpos largos y esbeltos a α chico | No para cuerpos gruesos ni cambios bruscos; sin base drag | **[NAVEGADOR]** — es una integral doble 1D sobre S''(x) |
| 8 | **Códigos de Euler** | §14.1.3 p.779 | ¿Campo no viscoso completo, con choques y entropía, sub/trans/supersónico? | Buena para vehículos esbeltos a α chico con capa límite delgada | **No dan esfuerzo cortante ni transferencia de calor**; Wood & Miller (1985) reportan que *"one Euler code was not well suited for the analysis of wings with separated flow at high lift and low supersonic speeds"* `[§11.0, p.578]` | **[PRECÓMPUTO]** — el cuello de botella declarado es la **malla ajustada al cuerpo**: *"The job of creating a surface definition... is much easier than the generation of a body-fitted grid that is needed for an Euler-based code"* |
| 9 | **Modelo de dos capas** (no viscoso + capa límite acoplados iterativamente) | §14.1.4 p.779-780 | ¿Fricción y calor sobre la superficie, con la geometría efectiva desplazada por δ*? | Buena si la capa límite es delgada y no altera el campo externo | **NO sirve** si hay interacción choque/capa límite ni separación extensa ⇒ **no usar en transónico con choque separador ni a α alto** | **[PRECÓMPUTO]** — 2 a 4 iteraciones de (no viscoso + capa límite). Cada iteración es barata; el acoplamiento se cachea por condición de vuelo |
| 10 | **PNS (Navier-Stokes parabolizadas)** | §14.1.5 p.781 | ¿Campo viscoso de un vehículo hipersónico esbelto, marchando en x? | Alta, con *"tremendous reduction in computing time and in storage requirements"* vs no estacionario | Requiere **flujo supersónico en la dirección de marcha y SIN separación en la corriente** (la separación en el flujo transversal sí se permite); necesita una solución de arranque (Mendenhall usó un código de Euler) | **[GPU-VIVO]** para casos nuevos · **[PRECÓMPUTO]** para el catálogo de trayectoria |
| 11 | **Navier-Stokes / RANS completas** | §14.1.5 p.780-781 | Todo lo demás: separación, interacción viscoso-no viscoso, base flows, alta α | La más alta disponible, **acotada por el modelo de turbulencia** | Modelo de turbulencia no universal; sensibilidad a malla; condiciones de frontera mal puestas | **[GPU-VIVO]** — 25 M de puntos, 2 semanas de vuelta en 2007 `[§13.9, p.768]`. En nuestra 4070 Ti: casos 2D/2.5D acotados, sí; configuración completa 3D, no |
| 12 | **DES / DSMC / Boltzmann** | §11.11 p.636 (Forsythe et al. 2002, DES para base flow); §12.1.5 p.655 (DSMC de Bird) | ¿Base flow no estacionario? ¿Régimen enrarecido `Kn → 1`? | La única opción válida en esos regímenes | Costosísimo; el propio libro sólo lo cita | **[GPU-VIVO]** — fuera de alcance para el producto interactivo |

### 5.2 Instalaciones experimentales, clasificadas para nosotros

| Herramienta | § | Qué da | Qué NO da | Costo | Nuestro análogo |
|---|---|---|---|---|---|
| **Túnel de viento** | §14.3 p.785-787 | *"the ground testing facilities can easily measure the global aerodynamic force and moment... the data-generating process is the most efficient among all simulation techniques"* (Shang 1995) | Simulación completa; el Re de modelo pequeño es bajo ⇒ capa límite laminar o transicional donde en vuelo es turbulenta | $250 K – $900 K por programa | **[PRECÓMPUTO]** — sustituto: catálogo de coeficientes barrido en (α, β, M, δ) precomputado en iangpu y servido como campo/tabla al navegador. **Ése es nuestro "túnel virtual".** |
| **Vuelo** | §14.4 p.788-789 | El único que da el entorno verdadero a escala completa | Instrumentación limitada por tamaño/peso/fragilidad; definir las condiciones de corriente libre con exactitud es difícil (sobre todo a gran altitud e hipersónico) | ~$1 M por punto de ensayo | Sin análogo. Es la referencia externa |

### 5.3 Regla de decisión de La Forja (derivada, `[EXTENSIÓN DECLARADA]`)

> **Motivo de la extensión**: el libro describe la escalera y sus costos relativos pero no da una regla
> de selección explícita. La siguiente regla es **nuestra**, construida sólo con criterios que el libro
> sí enuncia (§14.1 orden de sofisticación, §14.3 sensibilidad al Re, §14.5 costos).

1. **¿La pregunta es sustentación o momento de cabeceo a α bajo?** → paneles/VLM. `[§14.3, p.787]`:
   *"lift and pitching moments are usually not too sensitive to Reynolds number up to the onset of
   buffet"* ⇒ el número barato sirve. **[NAVEGADOR]**
2. **¿La pregunta es arrastre, subida de arrastre, sustentación máxima o frontera de buffet?** → NO
   basta lo barato. `[§14.3, p.787]`: *"buffet boundary, maximum lift, drag, and drag rise are usually
   very sensitive to Reynolds number."* Se requiere túnel (o su sustituto precomputado) + corrección
   empírica. **[PRECÓMPUTO]** mínimo.
3. **¿Hay choque interactuando con la capa límite, o separación extensa?** → prohibido dos capas y
   prohibido paneles. `[§14.1.4, p.780]` lo dice explícitamente. **[GPU-VIVO]**.
4. **¿M∞ ≥ 5 y cuerpo romo?** → newtoniana modificada, y punto. **[NAVEGADOR]**.
5. **¿El resultado depende de dónde transiciona la capa límite?** → no entregar un número; entregar
   **la banda laminar↔turbulento**. `[§12.9]`.

### 5.4 Los nueve parámetros de un ensayo — literal `[§14.3, p.786-787]`

El planeador de un programa en tierra debe considerar:
1. el Mach de corriente libre;
2. el Reynolds de corriente libre (**y su influencia en el carácter de la capa límite**);
3. la velocidad de corriente libre;
4. la altitud de presión;
5. la razón temperatura de pared / temperatura total;
6. la entalpía total del flujo;
7. la razón de densidades a través de la onda de choque;
8. el gas de ensayo;
9. la termoquímica del campo de flujo.

Los últimos tres **sólo importan en hipersónico**. Varios están interrelacionados (velocidad, Mach y
Reynolds). **Requisito**: el software debe calcular cuáles se igualan y cuáles no, y reportar el
resultado como *simulación parcial* con la lista de lo sacrificado.

Y el requisito de práctica sobre la transición `[§14.3, p.787]` (Laster et al. 1998):
> *"Because the boundary layer is mostly turbulent in flight, experience has shown that forcing the
> model boundary layer to be turbulent in the wind tunnel makes the task easier in accounting for
> Reynolds number effects."* y *"the prediction of the untripped transition location is important to
> assure that the boundary-layer trips are placed ahead of the location where transition occurs
> 'naturally' in the test facility."*

### 5.5 Los seis objetivos de un programa en tierra — literal `[§14.3, p.785]`

1. Obtener datos de fuerzas, momentos y/o distribuciones de transferencia de calor, **especialmente
   para configuraciones completas cuyos campos de flujo resisten el modelado computacional**.
2. Usar configuraciones **parciales** para datos de fenómenos locales (interacción choque/capa límite
   con una aleta o ala montada sobre una superficie plana).
3. Determinar el efecto de rasgos de diseño específicos sobre los coeficientes globales
   (p. ej. el incremento de arrastre por **protuberancias** del avión a escala completa).
4. **Certificar motores** de respiración de aire.
5. Obtener datos detallados de campo para **desarrollar modelos de flujo** para un algoritmo
   computacional (datos de **validación**).
6. Obtener mediciones (calor, arrastre total) para comparar contra soluciones calculadas sobre un
   rango de geometrías y condiciones (datos de **calibración**).

→ Nótese que 5 y 6 son objetivos **al servicio del software**. El túnel no compite con el CFD: lo
alimenta. Ése es el argumento del cliente para que existamos.

### 5.6 Las cinco razones (+3) para ensayar en vuelo — literal `[§14.4, p.788-789]`

Draper et al. (1983): demostrar tecnologías interactivas e identificar problemas no anticipados;
formar un catalizador/foco para la tecnología; ganar conocimiento **no sólo de los vuelos sino del
proceso de desarrollo**; demostrar la tecnología en vuelo para que sea creíble a mayor escala.
Neumann agrega: verificar los datos de tierra y/o entender el puente entre la simulación en tierra y
el vuelo real; validar el desempeño global del sistema; generar información no disponible en tierra.

Y las tres maniobras de un programa de vuelo, con su compromiso `[§14.4, p.789]` (F/A-18E):
- **estacionaria** (crucero a M y altitud constantes): la más exacta, pero **1 min de estabilización +
  3 min de adquisición para UN punto de la polar**;
- **cuasi-estacionaria** (ascensos a M constante): más puntos, más incertidumbre;
- **dinámica** (roller coaster / pitch up-down): cubre α inalcanzables de otro modo, pero exige
  instrumentación y sincronización muy precisas; **en el F/A-18E se descartaron por eso**.

---

## 6. ESCUELA — lecciones que salen de este bloque

Regla del contrato: la escuela **vive dentro del CAD** (`forja-brep.html`). El alumno **dibuja** la
geometría con croquis y cotas y la analiza con un **estudio**. Formato de cada lección:
**CONSTRUIR → MOVER → VER → VERIFICAR contra el número del libro**.

---

### L-AERO-10.1 — "El perfil que hace sustentación con el vientre"
- **CONSTRUIR**: croquis de la doble cuña simétrica del Ejemplo 10.1. Cotas LITERALES: cuerda `c`,
  semiángulo `δw = 10°` acotado como ángulo, espesor máximo a `0.5c`. Restricción de simetría respecto
  al eje de cuerda.
- **MOVER**: el ángulo de ataque `α` (slider 0°→12°) y el Mach (1.2→5).
- **VER**: las **flechas de presión a escala** sobre las 4 facetas (la figura del concept box p.570).
  El alumno debe ver que la flecha grande está en la faceta 3 (vientre delantero) y que las facetas 1
  y 4 casi no aportan. Al lado, el mismo dibujo para un perfil subsónico (Eppler E64 a 2°) donde la
  succión está arriba y adelante.
- **VERIFICAR**: `Cl = 0.4031`, `Cd = 0.1407`, `L/D = 2.865` (FIXTURE bertin-ej-10.1). Y la razón de
  presiones sobre las cuatro facetas: `1.000 / 0.275 / 2.848 / 1.030` (FIXTURE bertin-ej-10.3).
- **La pregunta que da miedo**: *¿por qué un perfil supersónico tiene L/D < 10 y uno subsónico ~100?*
  Respuesta del libro `[p.570]`: no sólo por el arrastre de onda — **también hace menos sustentación**,
  porque el mecanismo (comprimir con el vientre) es mucho peor que el subsónico (acelerar por arriba).

### L-AERO-10.2 — "El error se compensa: por qué las teorías baratas sobreviven"
- **CONSTRUIR**: la misma doble cuña, pero con el espesor relativo como **cota paramétrica** τ.
- **MOVER**: τ de 0.04 a 0.18.
- **VER**: dos gráficas lado a lado — (a) `Cp` local en cada faceta por las tres teorías; (b) `Cl` y
  `Cd` integrados por las tres teorías. El alumno ve que en (a) las curvas se separan brutalmente al
  crecer τ mientras en (b) casi no se separan.
- **VERIFICAR**: en τ=0.176 (Tabla 10.2) el Cp3 lineal está **39% abajo** del exacto pero el Cl sólo
  **9.2% abajo**; en τ=0.04 (Problemas 10.3/10.4/10.5) las tres teorías coinciden en **0.6% en Cl y
  0.2% en Cd**.
- **Lección de oficio**: *"the errors in the local pressure coefficients tend to compensate for each
  other when the aerodynamic coefficients are calculated"* `[p.571]`. **Nunca uses una teoría
  integrada para alimentar una estructura o un control.**

### L-AERO-11.1 — "La flecha decide qué perfil puedes usar"
- **CONSTRUIR**: planta de ala delta con `Λ_LE` como cota angular; sección de perfil como croquis
  aparte, con radio de borde de ataque como cota.
- **MOVER**: `Λ_LE` (40°→80°) y `M∞` (1.2→3.0).
- **VER**: el cono de Mach dibujado **sobre la planta**, con los bordes coloreados en dos colores:
  rojo = borde supersónico, azul = borde subsónico. Y una alerta que aparece/desaparece: *"borde
  supersónico ⇒ tu radio de borde de ataque debe ser ≈0"*.
- **VERIFICAR**: `β cot Λ_LE = 1` marca el cambio de color. Ejemplo 11.2: a `Λ=60°, M=2.2`,
  `n = tan Λ/β = 0.88388 < 1` ⇒ **supersónico**, y `μ = 27.04°`. Ejemplo 11.3: `β cot Λ = 0.6` ⇒
  `Λ = 61.78°` a M=1.5 ⇒ **subsónico**.
- **Cierre**: el HSCT con `Λ = 79°` a M=3.0 tiene borde subsónico y por eso *"relatively blunt
  leading-edges were possible without a substantial zero-lift wave drag penalty"* `[p.582]`.
  El F-104 (borde supersónico) tuvo que aterrizar a **~200 nudos** con flaps soplados y paracaídas.

### L-AERO-11.2 — "El vortex-lattice supersónico a mano"
- **CONSTRUIR**: la malla del Ejemplo 11.3 en el plano (x, βy), con `Nmax = 4`. El alumno **cuenta**
  los elementos parciales y calcula los pesos A, B, C.
- **MOVER**: elemento por elemento, marchando del ápice hacia atrás.
- **VER**: el cono de Mach a **45° exactos** en el plano transformado, y cómo cada elemento nuevo sólo
  "ve" los que caen dentro de su cono aguas arriba. Ver también el mapa de la función R (Fig. 11.27):
  los elementos justo adelante dan downwash, todos los demás dan upwash.
- **VERIFICAR**, en unidades de α/β: `ΔCp(1,0) = 2.7996`, `ΔCp(2,0) = 0.9827`, `ΔCp(2,±1) = 3.9730`
  (FIXTURE bertin-ej-11.3). Y los dos invariantes: `R̄(0,0)=0` y `Σ_N R̄ = 0`.
- **Gate de la lección**: el alumno debe **descubrir por qué el ΔCp del elemento de punta es el más
  grande** y conectar eso con el empuje de borde de ataque de §11.7.3.

### L-AERO-11.3 — "Los cuatro criterios que matan un diseño"
- **CONSTRUIR**: ala en flecha con estudio de presiones (VLM supersónico ya construido en L-AERO-11.2).
- **MOVER**: α, flecha de borde de salida, radio de nariz, contorneo del fuselaje.
- **VER**: cuatro semáforos, uno por criterio de Kulfan & Sigalla `[§11.8, p.626-627]`, encendiéndose
  en rojo cuando se cruza el umbral.
- **VERIFICAR**: succión teórica > 70% de la presión de vacío; salto de presión en el choque interior
  > 50%; razón de presiones en el choque de borde de salida > `1 + 0.3 MN1²` con `MN1 = M1 cos Λ_TE`.
- **Cierre honesto (obligatorio en pantalla)**: *"Application of these criteria does not guarantee that
  the flow will not separate... wind-tunnel tests of proposed designs must be undertaken."*

### L-AERO-12.1 — "La ley más barata del libro: newtoniana en el navegador"
- **CONSTRUIR**: cuerpo de revolución (esfera, cono, cápsula tipo Apollo) por revolución de un croquis.
- **MOVER**: α, semiángulo del cono, radio de nariz, y **rotar la vista**.
- **VER**: el campo `Cp = Cp,t2 cos²η` pintado sobre la malla **en tiempo real a 60 fps**, con la
  **región de sombra en negro** (`Cp = 0`) moviéndose al girar α. El alumno ve, literalmente, que el
  Cp depende **sólo de la normal del triángulo**.
- **VERIFICAR**: esfera ⇒ `CD = Cp,t2/2`; cilindro 2D ⇒ `Cd,p = (2/3)Cp,t2`; cono afilado ⇒ las
  ec. (12.34)–(12.38) y `xcp = (2/3)xL`. Contra experimento: hemisferio a M=4.38 mide
  `Cp = 1.818` en estancamiento contra `2.0` newtoniano (**+10%**) y con `Cp,t2 = 1.8` la modificada
  clava los 10 puntos de presión.
- **Por qué esta lección importa al negocio**: le abre al cliente **todo el rango de reentrada** con
  un solver que corre en el navegador del alumno, sin GPU.

### L-AERO-12.2 — "El vehículo que se equilibra con la fuerza axial"
- **CONSTRUIR**: cono afilado con `xcg` como cota móvil a lo largo del eje, y `ycg` como cota vertical.
- **MOVER**: α y las dos cotas del c.g.
- **VER**: el vector fuerza normal N y el axial A dibujados en el centro de presión, con el momento
  resultante como flecha curva que cambia de sentido.
- **VERIFICAR**: `S.M. = (xcp − xcg)/xL` debe ser positivo; para vehículos hipersónicos de alto
  desempeño el libro dice **3% a 5% de la longitud**. Y el caso raro: **con `xcp = xcg` el vehículo
  aún es estable si `ycp < ycg`**, porque la fuerza axial da el momento restaurador `[p.678]`.
- **Momento "ajá"**: en subsónico nadie piensa en la fuerza axial para estabilidad. Aquí sí.

### L-AERO-12.3 — "El arrastre completo de un cono: los tres sumandos"
- **CONSTRUIR**: el cono del Ejemplo 12.4 (θc=10°, Rb=3.0 in) con las condiciones del Túnel B del AEDC.
- **MOVER**: θc y la posición de transición supuesta.
- **VER**: una barra apilada con presión / fricción / base, que cambia de proporciones.
- **VERIFICAR**: `D = 10.139 + 3.956 − 0.203 = 13.892 lbf`, o sea **73% presión, 28.5% fricción,
  −1.5% base**. Y `Cp,b = −0.0205` contra el supuesto newtoniano `Cp,b = 0` ("very close").
- **Gate**: el alumno debe calcular `T* = 613.89 °R` por Eckert y `Cf = 0.004344/l^0.2` **a mano** antes
  de que el software se lo dé.

### L-AERO-12.4 — "El número que nadie sabe: dónde transiciona"
- **CONSTRUIR**: el cono de Reentry F (5°, 13 ft, punta de grafito RN=0.1 in).
- **MOVER**: **la ubicación de transición**, de x/L = 0.20 a 0.80 (el rango que reporta la DSB).
- **VER**: la curva de `q̇w` vs x/L cambiando de forma, con la banda laminar y la banda turbulenta
  sombreadas, y **el peso del sistema de protección térmica** actualizándose al lado.
- **VERIFICAR**: la curva casa el vuelo con transición en `x/L = 0.625`; exactitud típica 20–25%
  turbulento y 15–20% laminar. Y el impacto: correlaciones inciertas **por un factor de 3**, y el
  supuesto *"can affect the vehicle gross takeoff weight by a factor of two or more."*
- **Ésta es la lección de humildad del bloque.** El alumno debe salir sabiendo que **hay un número en
  su diseño que él eligió, no que calculó**.

### L-AERO-13.1 — "El flap no te regala nada: el trim drag"
- **CONSTRUIR**: perfil con flap ranurado tipo Fowler (multi-elemento) en croquis, con `δf` acotado y
  el riel de despliegue como restricción geométrica real.
- **MOVER**: `δf` de 0° a 40°.
- **VER**: tres cosas al mismo tiempo — `CL` subiendo, **el área de referencia creciendo** (hasta +30%),
  y `Cm` haciéndose **más negativo**, con el ΔCD de la cola horizontal necesario para trimar apareciendo
  como una barra roja que come parte de la ganancia.
- **VERIFICAR**: `Cl` del GA(W)-1 con Fowler ranurado vs `δf` (Fig. 13.10, Wentz & Seetharam 1974);
  el techo declarado `CL,max = 2.5 a 3.5` para sistemas mecánicos `[p.722]`; y el crecimiento de área
  del 737 (Fig. 13.3).
- **Cita para la pantalla**: *"the flap types which produce the greatest increase in Cl,max usually
  produce the largest moments."*

### L-AERO-13.2 — "Los cinco efectos de la ranura (y el mito del aire de alta energía)"
- **CONSTRUIR**: perfil de dos elementos con **gap** y **overlap** como cotas independientes.
- **MOVER**: gap y overlap.
- **VER**: distribución de `Cp` de ambos elementos, con anotaciones que se encienden nombrando cada uno
  de los cinco efectos de Smith cuando ocurren (pico del elemento trasero bajando = *slat effect*;
  circulación del delantero subiendo = *circulation effect*; velocidad en el borde de salida del
  delantero por encima de la libre = *dumping effect*; etc.).
- **VERIFICAR**: contra el `Cp` medido y calculado del GA(W)-1 a `α = 5°, δf = 30°` (Fig. 13.11).
- **Desmitificar**, literal en pantalla: *"the air through the slot cannot really be called high-energy
  air, since all the air outside the boundary layer has the same total pressure."* — el mito de que la
  ranura "energiza" la capa límite es falso, y el libro lo dice.

### L-AERO-13.3 — "El óptimo no existe: elige tu figura de mérito"
- **CONSTRUIR**: ala de transporte con AR, t/c y flecha como cotas paramétricas.
- **MOVER**: las tres cotas.
- **VER**: **cuatro medidores simultáneos** — costo de adquisición, peso bruto, costo operativo directo,
  y combustible — cada uno con su propio óptimo marcado sobre el eje de AR.
- **VERIFICAR**: los cuatro óptimos publicados: `AR = 7.5 / 9.8 / 12.0 / 15.2` `[§13.4.3, p.737]`.
  Y la nota estructural: *"At present aspect ratios as large as 15.2 are not structurally feasible."*
- **Lección**: el alumno debe experimentar que **mover el slider no revela "el mejor avión"; revela que
  la pregunta estaba mal planteada.** Esto es exactamente el hueco de mercado de Raymer §2.1.4.

### L-AERO-13.4 — "El winglet, cuatro reglas y un momento flector"
- **CONSTRUIR**: winglet sobre la punta del ala, con altura, estrechamiento, flecha, cant y **toe-out**
  como cotas; filete entre punta y winglet como radio acotado.
- **MOVER**: las cinco cotas.
- **VER**: `ΔCD` bajando con la altura **de forma sublineal**, y al lado el **momento flector de raíz
  (wrbm)** subiendo. Zona verde hasta +4% de wrbm, zona roja después.
- **VERIFICAR**: las cuatro reglas de Thomas (1985) como checklist `[§13.4.3, p.739]` y la restricción
  del 4% de wrbm de Streit et al. (2008) `[Fig. 13.28, p.740]`.
- **Extra obligatorio**: correr el caso **rígido** y el **deformado**. El libro dice que incluir la
  deformación *"actually was crucial for determining the overall benefits of the wing tip devices."*

### L-AERO-13.5 — "Reparar un avión que ya existe: el EA-6B"
- **CONSTRUIR**: el paquete de cuatro modificaciones sobre una geometría base **congelada** (el ala
  principal y el fuselaje no se pueden tocar — restricción real de la Marina).
- **MOVER**: activar/desactivar cada modificación por separado y en combinación.
- **VER**: el par de vórtices de la unión ala-fuselaje, subiendo hacia la deriva conforme sube α, y en
  derrape bañándola con sidewash que cambia de signo. Y la curva `Cnβ` vs α.
- **VERIFICAR**: la inestabilidad direccional se corre **+6° en α**; `CL,max` sube **+22% a Mach bajo y
  +30% a Mach alto**; el paquete completo da **+25% de `CL,trim`**.
- **Lección de proceso**: se diagnosticó con **visualización de flujo**, no con un número. La escuela
  debe enseñar a mirar.

### L-AERO-14.1 — "La escalera de herramientas: la misma ala, seis veces"
- **CONSTRUIR**: **un solo** ala (la del F-16 o la delta del Ejemplo 11.3), una sola vez, con croquis
  y cotas.
- **MOVER**: el **selector de método**: newtoniana → lineal → Busemann → choque-expansión →
  paneles/VLM → dos capas → (Euler precomputado).
- **VER**: la misma geometría con seis campos de presión distintos, el tiempo de cálculo en pantalla
  (ms → s → min → "precomputado en iangpu"), y **la lista de lo que cada método NO ve** encendida en
  gris al lado.
- **VERIFICAR**: contra la Tabla 10.2 (tres teorías, mismo perfil) y contra la Fig. 11.31 (VLM vs
  teoría lineal exacta para delta).
- **Ésta es LA lección del bloque.** El objetivo no es que el alumno aprenda un método; es que aprenda
  **a elegir**. Cierre en pantalla: *"Aerodynamic modeling is the art of partial simulation."*

### L-AERO-14.2 — "Verificar, validar, calibrar, certificar"
- **CONSTRUIR**: no se construye geometría. Se construye un **estudio** con su ficha de procedencia.
- **MOVER**: refinar la malla (estudio de convergencia), cambiar el modelo de turbulencia, cambiar la
  condición de frontera.
- **VER**: cuatro sellos que se encienden en la ficha del estudio: **VERIFICADO** (convergencia de
  malla + caso analítico exacto), **VALIDADO** (comparación detallada de superficie y campo contra
  experimento), **CALIBRADO** (banda de error / factor de corrección para *este* parámetro),
  **CERTIFICADO** (la suite de regresión pasó).
- **VERIFICAR**: cada sello contra su definición literal de `[§14.2, p.783-784]`, reproducida en la
  lección.
- **Gate duro de la lección**: el alumno **no puede exportar un reporte** de un estudio que no tenga al
  menos el sello de verificación. Y quien corre la validación debe ser *"representative engineers from
  the user community, not... the experts in the code."*

### L-AERO-14.3 — "¿Cuánto cuesta esa respuesta?"
- **CONSTRUIR**: un plan de campaña para responder tres preguntas (¿CL de crucero? ¿arrastre de
  crucero? ¿frontera de buffet?).
- **MOVER**: asignar cada pregunta a una herramienta.
- **VER**: el costo acumulado del plan y la incertidumbre resultante, como dos barras que se pelean.
- **VERIFICAR**: contra el modelo de costos de `[§14.5, p.789-790]` (vuelo = 100× túnel = 1000× CFD)
  y contra la regla de sensibilidad al Reynolds de `[§14.3, p.787]`: sustentación y momento **no** son
  muy sensibles hasta el buffet; arrastre, subida de arrastre, `CL,max` y frontera de buffet **sí lo son**.
- **Resultado esperado**: el alumno descubre solo que preguntar "CL de crucero" con RANS es tirar
  dinero, y que preguntar "frontera de buffet" con paneles es tirar el avión.

### 6.1 Orden sugerido del currículo (dentro de `CURRICULUM-AERO.md`)

```
L-AERO-10.1  ->  L-AERO-10.2  ->  L-AERO-11.1  ->  L-AERO-11.2  ->  L-AERO-11.3
                                                           |
L-AERO-12.1  ->  L-AERO-12.2  ->  L-AERO-12.3  ->  L-AERO-12.4
                                                           |
L-AERO-13.1  ->  L-AERO-13.2  ->  L-AERO-13.3  ->  L-AERO-13.4  ->  L-AERO-13.5
                                                           |
                              L-AERO-14.1  ->  L-AERO-14.2  ->  L-AERO-14.3   (CIERRE)
```
Las tres del cap 14 van **al final** a propósito: sólo tienen sentido después de que el alumno haya
sufrido las limitaciones de cada método por su cuenta.

---

## 7. NO OBSERVADO — figuras y tablas que eran imagen y no pude leer

El texto viene de `pdftotext`. Las gráficas y algunas tablas quedaron como cascarones: se ven los
rótulos de ejes y los números de las marcas, pero **no las curvas**. Lo siguiente NO se puede
reconstruir de este `.txt` y **no debe inventarse**:

### Cap 10
- **Fig. 10.2** (p.554) — Cp vs ángulo de deflexión para las tres teorías, familias `M∞ = 1.3, 2.0,
  3.0, 4.0`. Se leen ejes (Cp de −0.3 a +0.3; θ de 0° a 8°) pero **no las curvas**. Es la figura que
  cuantifica "para deflexiones pequeñas la teoría lineal da valores adecuados para cálculos de
  ingeniería". *Falta el umbral numérico de θ donde deja de servir.*
- **Fig. 10.5** (p.564) — patrón de ondas de la doble cuña. Los valores numéricos SÍ están en el texto
  del Ejemplo 10.3; sólo falta el dibujo.
- **Fig. 10.6** (p.572) — Cl, Cd y Cm0.5c teóricos vs experimentales, `M∞ = 2.13`, `τ = 0.063`
  (Pope 1958). Sólo se leen los rangos de ejes. **Falta el dato experimental** que muestra `Cl < 0` a
  `α = 0` para el perfil con curvatura. El Problema 10.7 pide verificarla ⇒ **no podemos generar ese
  fixture**.
- **Fig. 10.1, 10.3, 10.4** — croquis de geometría, sin datos numéricos perdidos.
- **Figs. P10.1, P10.3, P10.9, P10.10** — croquis de los problemas. Para P10.9 y P10.10 el texto da
  todas las cotas; para P10.1 faltan las proporciones `a1`, `a2` (son variables del problema, ok).

### Cap 11
- **Fig. 11.9** (p.587) — distribución de presión en la punta de un ala rectangular (Bonney).
  La **ecuación sí está en el texto**; falta sólo la curva. Recuperable.
- **Fig. 11.10, 11.11** (p.588) — mapa de regiones donde aplica flujo cónico según `β·AR`. Los tres
  casos (`>2`, `1..2`, `<1`) están descritos en el texto; falta el dibujo.
- **Tabla 11.1** (p.589) — **PARCIALMENTE ILEGIBLE.** El `pdftotext` desordenó la tabla: las fórmulas
  de `CL`, `CD`, `CM0` y `xcp` para los cuatro casos aparecen fragmentadas y con los denominadores
  desalineados. Los valores de `A` y `K1` (doble cuña ½τ/4, doble cuña modificada ⅔τ/6, biconvexo
  ⅔τ/5.33) y la definición de `C3` **sí** se leen con confianza. **Las expresiones completas de CM0 y
  xcp del caso "ala con espesor" NO son confiables desde este texto** — hay que ir al PDF original o
  rederivarlas (el Problema 11.1 pide justamente derivarlas).
- **Fig. 11.12** (p.590) — comparación teoría/datos para ala rectangular AR=4, sección triangular
  isósceles 5%, `M=1.53`, `Rec = 0.75×10⁶` (Nielsen et al. 1948). Ejes legibles, curvas no.
- **Fig. 11.16 (a)–(d)** (p.595-596) — L/D vs CL con la flecha como parámetro (Λ = 0°, 15°, 30°, 45°,
  60°) a M = 1.5, 2.0, 4.0, y (d) pendiente de sustentación vs flecha. `τe = 0.10`,
  `Cd,friction = 0.006`. **Las curvas no son legibles**; es una pena porque cuantifican exactamente
  cuánto compra la flecha.
- **Fig. 11.18** (p.597) — arrastre inducido de delta vs arrow contra la flecha de borde de ataque.
  Sólo se lee la tendencia cualitativa descrita en el texto.
- **Fig. 11.21 (a)(b)(c)** (p.604-605) — **soluciones teóricas de Puckett para el delta**:
  (a) `Cpβ/λ` vs `s` con `n` como parámetro; (b) y (c) `CDβ/τ²` vs `β` para el delta de doble cuña.
  Las mallas de números de las curvas (n = 0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.3, ...) **sí** se leen, pero
  **no los valores de las curvas**. El Ejemplo 11.2 nos da un punto de anclaje (`Cpβ/λ = 4.276` para
  `n = 0.88388`) y la fórmula, así que el módulo es reconstruible; **la figura, no**.
- **Fig. 11.24** (p.608) — las cuatro distribuciones de presión del Ejemplo 11.2. **Los valores de las
  curvas NO se leen.** Sólo tenemos el valor de la región 2D (`Cp = 0.0436`) y la fórmula.
- **Fig. 11.27** (p.611) — representación numérica del factor R. Superficie 3D; ilegible. Las
  propiedades cualitativas SÍ están en el texto.
- **Fig. 11.29, 11.30, 11.31** (p.619-620) — resultados numéricos del VLM supersónico y comparación
  con teoría lineal exacta. **Ilegibles.** La Fig. 11.31 (`βdCL/dα` vs `β cot Λ`) sería un fixture
  excelente y **no lo podemos extraer**.
- **Fig. 11.33 (a) y (b)** (p.624) — **CRÍTICO: los factores empíricos `KD(M)` y `KS(M)` de Carlson &
  Mann (1992).** Sólo se lee que el eje vertical va de 0.0 a 1.0 y el horizontal de M=1 a M=4. **Sin
  estas dos curvas no se puede implementar el método de diseño calibrado de las ec. (11.39)–(11.41).**
  Es el hueco más caro de todo el bloque.
- **Fig. 11.34** (p.626) — tipos de flujo sobre alas muy en flecha (Squire & Stanbrook, Kulfan &
  Sigalla). Croquis; la clasificación textual sí la tenemos.
- **Fig. 11.35** (p.628) — comparación predicción/medición para ala arrow de 72.65° a M=2.6,
  `CL_diseño = 0.12` (Carlson & Mack 1980). Ejes legibles, curvas no.
- **Fig. 11.37** (p.632) — clasificación de aeronaves por régimen (semienvergadura/longitud vs Mach,
  Harris 1992). **Los rótulos y los rangos SÍ se leen** (fighters de flecha fija 0.25–0.35;
  Concorde/Tu-144/XB-70/SR-71 ≈0.2; el eje va de 0.1 a 0.5 y de M=0.6 a M=25); las curvas no.
  La regla de división supersónico/hipersónico **sí** está en el texto: `b/2ℓ = tan μ = 1/√(M²−1)`.
- **Fig. 11.38** (p.633) — patrones de choque del SR-71 a M=1.5, 3.2, 3.8 (Cobalt60). Imágenes.
- **Fig. 11.41, 11.42** (p.636) — Cp y `CD` vs M para cuerpos de serie de potencias `R(x) = ε·x^a`
  con `ε = 0.1`, `a = 0.7, 1.0, 1.5`. Ejes legibles (`CD` de 0 a 0.14; M de 0 a 7), **curvas no**.
- **Fig. 11.43–11.47** — visualizaciones de flujo y fotos.

### Cap 12
- **Fig. 12.1** (p.651) — trayectorias típicas (Hirschel 1991). Las **etiquetas de régimen sí se leen**
  (efectos de gas real fuertes, baja densidad, radiación de superficie, transición, ionización, etc.);
  las fronteras entre regímenes, no.
- **Fig. 12.5** (p.655) — **incertidumbres de las estimaciones de calentamiento pre-vuelo del Orbiter.**
  Los **porcentajes SÍ se leen** y son un fixture valiosísimo: nariz ±15%; **borde de ataque del ala
  ±101%**; otras estaciones ±10%, 12%, 21%, 26%, 34%, 41%; y laminar/turbulento por separado
  (15%/36%, 12%/23%, 15%/23%). Lo que NO se lee es **a qué punto del vehículo corresponde cada
  porcentaje**. → *No inventar la asignación.*
- **Fig. 12.7** (p.658) — **regiones de aplicabilidad de las teorías no viscosas** (Marconi 1976).
  Ejes legibles (ángulo de deflexión 0–40°; M∞ de 3 a 15) y los tres rótulos (transónico, lineal,
  newtoniana), **pero no las fronteras.** Es la figura que fijaría numéricamente el gate de nuestro
  selector de método. **Hueco importante.**
- **Fig. 12.8** (p.659) — Cp vs M∞ para cuña y cono de 15° y valor newtoniano. Ejes legibles
  (Cp de 0 a 0.80, M de 0 a 14), curvas no.
- **Fig. 12.10** (p.662) — carta de Mollier de aire en equilibrio (Moeckel & Weston 1958).
  **Completamente ilegible como carta.** Sólo se leen algunos rótulos de isolíneas. Los dos puntos que
  necesitamos (M1=14 a 150,000 ft) **sí** están en el texto.
- **Figs. 12.11, 12.12, 12.13** (p.663-665) — `Tt2/T1`, `pt2/p1` y `Cp,t2` vs M1, perfecto vs
  equilibrio, esfera RN=0.3048 m a 45,721 m. **Los puntos citados en el texto sí los tenemos**
  (M=4 y M=24); el resto de las curvas no.
- **Fig. 12.14** (p.666) — correlación `Cp/Cp,max` vs pendiente local (Isaacson & Jones 1968), datos de
  M=1.97 a 4.76. Los valores de M **sí** se leen; los puntos no.
- **Fig. 12.16, 12.17** (p.670-671) — `Cd,p` y `Cd` total vs M∞ y vs Kn para cilindro (Koppenwallner
  1969). Rango de ejes legible; puntos no.
- **Fig. 12.24** (p.680) — **razón de presión de base vs Mach local** (Cassanto 1973), con dos
  correlaciones según `RN/Rb ≤ 0.1` o `> 0.1`. Ejes legibles (`pb/pe` de 0 a 0.8; Me de 0 a 11).
  **La curva no.** El único punto que tenemos es el del Ejemplo 12.4 (`pb/pe = 0.02` a `Me = 6`).
- **Figs. 12.26, 12.30–12.32** (p.684, 687-688) — regímenes de flujo en delta delgada (Squire 1976a) y
  resultados de los waveriders Mach 4. **Los porcentajes citados en el texto sí los tenemos**; las
  gráficas no.
- **Fig. 12.35** (p.693) — presiones newtonianas modificadas vs experimento para el Apollo a α=0,
  `M≈10`, `Re∞,D = 1.1×10⁶`. Ejes legibles (`ps/pt2` de 0 a 1.0; `S/Rb` de −1.2 a 1.2) y los dos
  quiebres geométricos (`S/Rb = 0.965` tangencia, `1.082` radio máximo). **Las curvas no.**
- **Fig. 12.37** (p.696) — `q̇t,ref` vs M∞ para las tres correlaciones. Ejes legibles (1 a 1000 W/cm²,
  M de 0 a 24). **Curvas no.** Sólo tenemos el umbral M∞=14.
- **Fig. 12.39** (p.699) — desglose de `CD,min` vs Mach del crucero Mach 10. Los porcentajes de crucero
  **sí** están en el texto (78% presión, 15% viscoso); el resto de la curva no.
- **Fig. 12.43** (p.703) — distribución de `q̇w` de Reentry F. Ejes legibles (0 a 400 Btu/ft²·s;
  x/L de 0 a 1) y el punto de transición supuesto (0.625) **sí** está anotado. Las curvas, no.
- **Fig. 12.44** (p.704) — carga útil/peso bruto vs cambio porcentual de arrastre para el NASP.
  Ejes legibles (0.005 a 0.020; −10% a +10%) y los dos extremos (**−6% laminar, +8% turbulento**)
  están en el texto. Las curvas, no.
- **Fig. 12.45** (p.705) — `Re_x,t` vs `Me`, la nube de dispersión de datos de transición
  (Beckwith & Bertram 1972). **Los rangos de ejes sí** (`5×10⁴` a `2×10⁷`; Me de 0 a 7) y la leyenda
  de símbolos sí. **La nube de puntos, no.** Es exactamente la figura que justifica el "factor de 3".

### Cap 13
- **Figs. 13.3, 13.4, 13.5** (p.715-716) — crecimiento de área con `δf`; historia de `CL,max` no
  aumentado (1900–1970); historia del coeficiente de arrastre parásito. **Las leyendas de aeronaves
  SÍ se leen completas** (A: Wright Flyer … N: C-5A y A: Wright Flyer … U: C-5A) y los rangos de ejes
  también (`CL,max` de 0 a 12 con el "límite teórico 4π" marcado; `CD,parásito` de 0.00 a 0.02).
  **Las posiciones de los puntos, no.** Perdemos los valores individuales por avión.
- **Figs. 13.8, 13.9** (p.718-719) — `Cp` con flap partido y `Cl` vs α para flap simple y partido,
  NACA 23012, `Rec = 6×10⁵`, `δf = 0/15/30/45/60°`. Ejes legibles (`Cl` de −0.8 a 2.4; α de −16° a 32°).
  **Curvas no.**
- **Figs. 13.10, 13.11** (p.721-722) — `Cl` vs α del GA(W)-1 con Fowler ranurado (`δf` hasta 40°) y
  comparación teoría/experimento de `Cp` a `α=5°, δf=30°`. Ejes legibles (`Cl` de 0 a 4; `Cp` de
  −7 a +1). **Curvas no.** Serían fixtures excelentes.
- **Fig. 13.13(d)** (p.724) — polares de IBF/EBF/USB con `cj = 2.0`, cuatro motores. Se lee que llegan
  a `CL ≈ 8` con `δf = 40°/60°`, y el rango de `CD` (−1.0 a 3.0). **Curvas no.**
- **Fig. 13.14** (p.725) — `CL` vs α de tres aviones STOL con y sin succión (AF1 `δf=45°`, AF2 `δf=48°`,
  Fi 156 `δf=40°`). Ejes legibles (`CL` 0 a 4). **Curvas no.** El texto sí dice "casi el doble" del
  Storch y da el rango de velocidad del Storch (51–174 km/h, carrera de aterrizaje 16 m con 13 km/h
  de viento).
- **Fig. 13.17** (p.727) — `Cl` vs α del CCW/supercrítico 17%, con `Cμ = 0 … 0.40` y `r/c = 0.009`.
  Ejes legibles (`Cl` 0 a 8; α −4° a 20°) y **los valores de Cμ de cada curva sí se leen**
  (0.0, 0.05, 0.10, 0.15, 0.20, 0.30, 0.40). **Las curvas, no.**
- **Figs. 13.18, 13.19** (p.728) — mapa de desempeño y de regímenes de flujo de un caza. **Los rótulos
  sí se leen** (despegue/aterrizaje, crucero subsónico, maniobra sostenida, maniobra instantánea,
  aceleración, crucero supersónico, maniobra supersónica; y las zonas ADHERIDO/MEZCLADO/SEPARADO).
  Rango de ejes: `CL` 0 a 1.6, M 0 a 2.0. **Las fronteras, no.**
- **Fig. 13.21** (p.730) — beneficios del strake + flap de borde variable en el YF-16 a `M=0.8`.
  Ejes legibles (`CL,trim` 0 a 1.6; α 0–30°; `CD,trim` 0 a 0.7) y las **tres configuraciones de la
  leyenda sí** (variable+strake, fijo+strake, fijo+sin strake). **Curvas no.**
- **Fig. 13.23** (p.734) — efecto de torsión y curvatura, `M∞ = 0.80`, `Rec = 7.4×10⁶`. **El texto sí
  da el resultado clave**: `(L/D)max = 18` en `CL = 0.4`. Las curvas, no.
- **Fig. 13.25** (p.738) — polares del Learjet M28/29 (con winglets) vs M25D/F a M=0.7 y 0.8.
  Ejes legibles (`CL` 0 a 0.6; `CD` 0.03 a 0.06). **Curvas no**, así que **no podemos cuantificar el
  beneficio del winglet**; el texto sólo dice que la mayor mejora está en el Mach menor.
- **Fig. 13.27** (p.739) — **los nueve dispositivos de punta de ala. Los NOMBRES SÍ se leen completos**
  (767-400 raked tip; blended winglet; 747-400 canted winglet; C-17 canted winglet; MD-11 up/down;
  MD-12 up/down; spiroid; tip feathers; A310 tip fence). Los dibujos, no. **La lista es utilizable.**
- **Fig. 13.28** (p.740) — `ΔCD` vs aumento de wrbm, rígido vs deformado. **El umbral del 4% sí** está
  en el texto y en el rótulo; las curvas no.
- **Fig. 13.29** (p.741) — alas crecientes y su factor de eficiencia de envergadura vs `xt`.
  **Los ejes sí se leen** (`e` de 0.90 a 1.10; `xt` de 0 a 2.0) y los valores del parámetro
  (0, 0.25, 0.5, 1.0, 1.5). **Las curvas, no** — sólo tenemos el "+8%" del texto.
- **Figs. 13.31, 13.34, 13.35, 13.36** (p.743, 746-747) — curvas del EA-6B. **Los porcentajes clave
  (22%, 30%, 25%, +6° en α) SÍ están en el texto o en los rótulos.** Las curvas, no. Los pesos sí:
  A-6 @ 36,000 lb; EA-6B @ 45,500 lb; ADVCAP @ 47,500 lb.
- **Fig. 13.38** (p.750) — cobertura de α, Mach y Reynolds de los ensayos del YF-16. Se leen los
  túneles (1/9 Ames 11-TWT, 1/9 y 1/15 Calspan 8-TWT, 1/15 ARC 6×6, 1/15 LRC 4') y los rangos
  (α 0–30°, M 0.5–2.0, `Rec` de 1×10⁶ a 100×10⁶). **Las envolventes, no.**
- **Fig. 13.40** (p.754) — carga externa/peso vacío por avión. **La lista de aviones SÍ se lee**
  (MiG-15, F-86F, Hunter FGA9, A-10, AMX, MB 339K, Jaguar, A-7D, Alpha Jet, F-16, Hawk 200) y el
  eje va de 0 a 1.0. **Las posiciones, no** — pero el texto da el dato clave: el Hawk 200 llega al
  **85%** de su peso vacío.
- **Fig. 13.41** (p.755) — el cartel de armas certificadas del F-16. Imagen.
- **Figs. 13.42, 13.43** (p.756-757) — arrastre de cargas externas y conformal vs convencional.
  **Los porcentajes (48% y 35%) sí** están rotulados; las curvas no. La configuración de la Fig. 13.42
  sí se lee: 2×AIM-9, ALQ-119-12, tanque de 300 gal, 2×(6 MK-82 en MER-10).
- **Figs. 13.46–13.49** (p.760-762) — el estudio canard/cola/sin-cola. **La descripción del modelo SÍ
  se lee completa** (ala: `S = 1.11109 ft²`, `c̄ = 9.176 in`, `AR = 2.5`, `Λ = 44°`, `λ = 0.2`, perfil
  64A0XX, `t/c` 0.06 raíz / 0.04 punta; superficie de control: `S = 0.18 ft²`, `c̄ = 3.691 in`,
  `AR = 1.1167`, `Λ = 51.7°`, `λ = 0.2`, biconvexo, mismos `t/c`). **Las curvas de `CD` vs margen
  estático a M = 0.4, 0.8, 1.6, 2.0, no.** Los números que el texto sí da (−10 a −15%c̄ para cola,
  −21%c̄ canard vs −27%c̄ cola en supersónico, ~12% de sustentación en la superficie de control) son
  utilizables.
- **Fig. 13.51** (p.766) — configuración externa del F-22. Se leen tres cotas (42', 44.6', 62.1' y
  16.5') pero **el `pdftotext` las imprimió sin unidades ni asignación clara** ("42", "446", "165",
  "621"). Sólo confío en las dos que el texto confirma: **envergadura 44.6 ft y `Sref` 840 ft²**.
  *No inventar las otras.*
- **Figs. P13.4(a)–(f)** (p.770-771) — las seis plantas de avión que el alumno debe identificar.
  **Imágenes; no se puede resolver el problema desde el texto.** Es una pena porque sería un ejercicio
  precioso de escuela.

### Cap 14
- **Fig. 14.1** (p.782) — **mapa `α` vs `M∞` con la herramienta usada en cada zona para el Pegasus™.**
  Los **nombres de las herramientas SÍ se leen** (SUBDL, SUPDL, SUPDL/NASTRAN, Missile Datcom,
  MISL3/Pegasus, SHABP/MADM, EULER/PNS, Euler, Navier-Stokes, "Nonlinear aero") y los rangos de ejes
  también (α de −5° a 25°, M de 0 a 8, t de 0 a 80 s). **Las fronteras entre zonas, no.**
  → **Ésta es la figura más valiosa del capítulo para nosotros y la tenemos a medias.** Tenemos el
  catálogo, no el mapa. *No inventar las fronteras.*
- **Fig. 14.2** (p.786) — desglose de arrastre de protuberancias del F/A-18E. **La lista completa de
  items SÍ se lee** (tapa de bisagra de alerón, carenado ALQ-50, bisagras de flap interior/exterior,
  toma de bahía de motor, gaps y desalineaciones, bisagra de alerón exterior, entrada de venteo de
  combustible, sujetadores externos, difusor de cañón, radomo ALR-67, tratamientos superficiales,
  antena ALR-67 RWR, puerta del carenado de plegado, antenas VHF/UHF ×3) **en orden descendente de
  contribución**, y el eje va de 0 a 5 counts. **El valor individual de cada item, no.**
  Sólo puedo afirmar el orden y el techo (~5 counts para el primero).

### Tablas que sí quedaron legibles y por lo tanto NO están en esta lista
Tabla 10.1 (Busemann C1/C2, completa), Tabla 10.2 (comparación de teorías, completa),
Tabla 11.2 (rectangular/delta/arrow, completa), Tabla 13.1 (LFC, completa),
Tabla 13.2 (conceptos de carga de armas, completa), Tabla 13.3 (requisito→característica, completa),
y las Respuestas a Problemas Seleccionados (p.809-810).

### Advertencia de errata detectada
- `[§12.4, Ejemplo 12.4, p.679]` el texto imprime `p1 = ... = 0.867 psia` y en el renglón siguiente usa
  `0.0867`. La aritmética `(102×10⁻⁶)(850) = 0.0867` confirma que **0.867 es la errata**. Nuestro
  fixture usa 0.0867.
- `[§11.7.2, p.613]` el propio libro señala que **la ec. (11.31) publicada en Carlson & Miller (1974)
  está mal**; la forma correcta es la de Bertin, según Carlson & Mack (1978).
- `[§11.1, p.579]` el texto dice *"Reference temperature methods can be used in the calculation of
  skin-friction coefficients for compressible flows (as we discussed in Chapter 12)"* — pero el método
  de temperatura de referencia de Eckert se presenta en el **cap 4** y se aplica en el **Ejemplo 12.4**.
  La referencia cruzada parece equivocada. No afecta el contenido técnico.

---

## 8. LO QUE MÁS ME SORPRENDIÓ — lo que una máquina lineal se salta y aquí sí importa

### 8.1 EL HALLAZGO CENTRAL: dónde el vortex-lattice MIENTE, y por qué

Este es el punto que el bloque entero justifica. La Forja ya tiene (o va a tener) un vortex-lattice.
El libro dice, con nombre y apellido, **exactamente en qué condiciones ese solver entrega números
falsos**, y es importante escribirlo antes de que alguien confíe en él.

**Mentira 1 — El vórtice de borde de ataque no existe para los métodos lineales.**
`[§11.8, p.625-626]` Un ala muy en flecha con borde de ataque **subsónico** y **afilado** separa el
flujo en el borde a ángulos de ataque **muy pequeños**, formando una **lámina de vórtice enrollada**
(coiled vortex sheet) sobre el extradós. El libro:
> *"for highly swept wings with subsonic leading edges, separation can occur quite readily even for
> small values of wing angle of attack; this is particularly true if the leading edge is sharp. The
> observed flow from the leading edge is very similar to that for the delta wing in subsonic flow...
> The coiled vortices that form at the leading edges affect the flow below the wing as well, since
> the leading edge is subsonic, and therefore the top and bottom surfaces can 'communicate.'"*

El vortex-lattice **no tiene ninguna representación de eso**. Modela el ala como una lámina plana con
flujo adherido. La sustentación real que aporta el vórtice (**sustentación no lineal**, que crece más
rápido que α) simplemente **no aparece**.

**Mentira 2 — La teoría lineal no sabe cuánta succión de borde de ataque se recupera.**
`[§11.7.2, p.621]`, advertencia literal sobre la ec. (11.35) de arrastre:
> *"This relationship does not consider any contribution of the theoretical leading-edge-suction force
> or of any separated flow effects associated with its exclusion and accounts only for the inclination
> of the normal force to the relative wind."*

O sea: el CD del VLM supersónico es el de **"cero succión de borde de ataque"** — la cota superior.
La realidad está entre esa cota y la elíptica ideal, y **el propio libro no sabe dónde**: por eso
existe el **parámetro de succión Ss** `[§11.7.3, p.622]` y los factores empíricos `KD`, `KS`
`[§11.7.3, p.623-624]`. Literal:
> *"Experience has shown that the maximum suction parameters actually achieved were lower than those
> predicted by linearized theory."*

**Mentira 3 — El error NO se reparte parejo entre CL, CD y Cm.**
`[§11.8, p.627]`, Carlson & Mack (1980), literal — y esto es lo que más me sorprendió del bloque:
> *"there are compensatory errors in linearized theory and the failure to account for nonlinearities
> may introduce little error in prediction of lift and drag. **However, significant errors in the
> prediction of the pitching moment are common, especially for wings that depart from a delta planform.**
> Additionally, for wings with twist and camber, appreciable errors in the prediction of drag due to
> the surface distortion (camber drag) often occur. **In particular, linearized-theory methods do not
> indicate the proper camber surface for drag minimization** (a function of the design lift coefficient)."*

Traducción operativa para nosotros, y es un requisito duro:
- **CL de un VLM: usable.**
- **CD de un VLM: usable con reserva** (falta succión de borde; falla en alas con torsión/curvatura).
- **Cm de un VLM: NO usable para cerrar diseño**, y menos si la planta se aparta del delta.
- **El VLM NO debe usarse como optimizador de la superficie de curvatura.** Dice el libro que
  *"linearized-theory methods do not indicate the proper camber surface for drag minimization."*
  Esto es exactamente la tentación que tendríamos al escribir un optimizador de ala.

**Mentira 4 — Y Euler tampoco salva.**
`[§11.0, p.578]` Wood & Miller (1985): comparando cálculos contra datos experimentales,
> *"(at least) one Euler code was not well suited for the analysis of wings with separated flow at
> high lift and low supersonic speeds. Instead, a code based on a linearized-theory method that was
> modified to account for both nonlinear attached-flow effects (lower surface) and nonlinear separated
> flow (upper surface) [Carlson and Mack (1980)] provided the best correlation with the experimentally
> measured vortex strength, vortex position, and total lifting characteristics."*

**Un método lineal CORREGIDO le ganó a un código de Euler.** Ése es el resultado más contraintuitivo
del bloque, y es la mejor noticia posible para La Forja: **la fidelidad no está monótonamente ordenada
por costo.** Un modelo barato con la corrección correcta puede vencer a uno caro sin ella. Y el libro
lo cierra con la advertencia de método `[p.579]`:
> *"it is important to develop an understanding of the general features of supersonic flows and their
> analysis before blindly using an analytic, semi-empirical, or computational approach."*

**Mentira 5 — El diseño de cazas VIVE en el régimen donde el VLM no aplica.**
`[§13.3, p.729]` Bradley: la maniobra instantánea (CL alto) es **flujo separado dominante**, y los
diseños actuales **lo aprovechan** formando flujo de vórtice a propósito (strakes/LEX del F-16 y F-18).
La maniobra sostenida es **mezcla**. Sólo crucero y aceleración son flujo adherido.
⇒ **El vortex-lattice sirve para el 30% del mapa de vuelo de un caza, y es justo el 30% que no decide
el combate.** Si La Forja va a vender diseño conceptual de cazas, este límite tiene que estar impreso
en la UI, no escondido en la documentación.

**Y el corolario positivo:** la corrección al VLM ya existe y es implementable — es el método de
Carlson & Mack (1980) + el parámetro de succión + los factores KD/KS. **Es un modelo barato calibrado
empíricamente, exactamente el tipo de cosa que un CAD conceptual debe llevar dentro.** Lo único que
nos falta para implementarlo son las dos curvas de la Fig. 11.33 (ver §7 — **es el hueco más caro del
bloque**).

### 8.2 La newtoniana es una función de la normal del triángulo — y eso lo cambia todo

`Cp = Cp,t2 · cos²η` donde `cos η = cos α sin θ + sin α cos θ cos β`. **No hay sistema lineal. No hay
malla de volumen. No hay iteración. No hay condición de Kutta.** Es un producto punto por triángulo
y una condición de visibilidad (sombra).

Eso significa que **un vehículo de reentrada completo se puede analizar en el navegador a 60 fps**
mientras el alumno gira el ángulo de ataque con el mouse. Y no es un juguete: contra el hemisferio del
USAFA a M=4.38 la versión modificada *"matches the experimental data extremely well"*; contra el
cilindro de Koppenwallner el acuerdo es *"outstanding"*; y el Cd de presión llega a su valor límite
hipersónico ya en **M = 4**.

Me sorprendió que la herramienta **más barata** del libro entero sea también la de mejor relación
fidelidad/costo en su dominio. Newton, 1687, corriendo en WebGL. Es el mejor regalo del bloque.

### 8.3 La independencia de Mach: hay un punto donde subir la velocidad deja de cambiar el problema

`[§12.2, p.658]` Conforme `M∞ → ∞`, el `Cp` **se vuelve independiente de M∞**. La cuña, el cono y la
newtoniana convergen al mismo valor. Físicamente: *"at hypersonic speeds the pressure coefficient for
these simple shapes depends primarily on the flow deflection angle."*

Para un CAD conceptual esto es enorme: **una tabla precomputada en `(θ, α)` cubre todo el rango
hipersónico**. No hay que barrer Mach. Es un colapso de dimensionalidad regalado por la física.

### 8.4 El grade... perdón, el GAS: el código estaba bien, el modelo estaba mal

`[§12.8, p.700-702]` La "anomalía hipersónica" del Space Shuttle: predijeron 7.5° de body flap para
trimar, y en vuelo hicieron falta ~16°. **No era un bug numérico.** Era que `γ` no vale 1.4 a esas
temperaturas: con aire en equilibrio (`γ ≈ 1.14`) la densidad detrás del choque normal es **15ρ₁** en
vez de 6ρ₁, la capa de choque se adelgaza, la onda se tumba, la presión de popa baja y la de proa sube,
y **el Cm se corre a positivo**.

Lo que me sorprendió: **el CN casi no cambia.** *"there is little difference in the normal force
coefficients"*. Las presiones se compensan al integrar la fuerza — pero **no al integrar el momento**,
porque suben adelante y bajan atrás. Es el mismo patrón que la Mentira 3: **el momento es el canario
de la mina.** Cuando un modelo físico está mal, la fuerza puede salir bien y el momento delata.

**Requisito derivado**: en cualquier reporte de La Forja, el `Cm` debe llevar una banda de
incertidumbre **más ancha** que la de `CL` y `CD`, y debe llevarla explícita.

### 8.5 El vuelo supersónico invierte varias intuiciones subsónicas

Lista, para el material de escuela — cada una está en el texto y cada una rompe algo que el alumno
"ya sabía":
1. La sustentación **no** depende de la curvatura ni del espesor `[§10.1.1]`.
2. El centro aerodinámico está a **c/2**, no a **c/4** `[§10.1.3]`.
3. Existe arrastre **sin viscosidad y sin envergadura finita** — y **sin ondas de choque**
   `[§10.1.2]`.
4. Un perfil con curvatura tiene `Cl` **negativo** a `α = 0` `[Fig. 10.6, p.571]`.
5. **Bajar el alargamiento BAJA el drag-due-to-lift** — al revés que en subsónico `[§11.6.1, p.590]`.
6. Una burbuja de recirculación **más chica** produce **más** arrastre de base `[§11.11, p.637]`.
7. El **borde de ataque romo es legal** si está suficientemente en flecha `[§11.2, p.582]`.
8. En hipersónico, la **fuerza axial** puede estabilizar el vehículo `[§12.4, p.678]`.
9. La sustentación la hace el **vientre comprimiendo**, no el dorso succionando `[§10.3, p.569-570]`.
10. Un cuerpo **más romo** sobrevive mejor: `q̇ ∝ 1/√RN` `[§12.6.1, p.696]`.

### 8.6 El costo de una decisión que nadie calcula

El cap 12 dice que **dónde transiciona la capa límite** puede cambiar el peso bruto al despegue **por
un factor de dos**. Y el cap 14 dice que ese número es **una suposición del ingeniero**, incierta por
un factor de tres, que ni el túnel ni el CFD resuelven.

Lo que me sorprendió no es la incertidumbre: es que **la industria la vive con eso y aun así vuela**.
La respuesta del libro no es "necesitamos mejor CFD"; es la doctrina de §14.5: analizar, ensayar,
volar, y **traer juicio nacido de la experiencia**. Un CAD conceptual honesto no promete quitar esa
incertidumbre — promete **hacerla visible y barata de explorar**. Ése es exactamente el producto que
Raymer §2.1.4 dice que no existe.

### 8.7 El cliente ya nos dijo qué software quiere, en una frase

`[§14.3, p.787]`, atribuida a Potter:
> ***"Aerodynamic modeling is the art of partial simulation."***

Y `[§13.10, p.770]`:
> ***"everything affects everything else."***

Un CAD que trate cada análisis como "la verdad" viola la primera. Un CAD que trate cada disciplina como
un silo viola la segunda. La Forja tiene que ser un **gestor de simulaciones parciales acopladas, con
procedencia**. Eso es lo que el cap 14 pide, y es lo que ningún CAD de producción hace.

---

## ANEXO A — CAP 14 EN DETALLE: el mapa del software que estamos construyendo

> Este anexo es adicional a las 9 secciones obligatorias. El cap 14 es corto (17 páginas) pero es la
> **especificación funcional del producto dicha por el cliente**, y merece quedar transcrito casi
> entero. Todo lo de aquí está también resumido en §1.5, §4.3 y §5; esto es la versión con detalle.

### A.1 La taxonomía, tal como el cliente la dicta `[§14.0, p.775]`

> *"Aircraft designers have a wide variety of tools available to them for understanding the
> aerodynamics of a vehicle. We will divide the tools into two categories:
> • **Analytical tools**, which include exact analytical solutions, empirical-based conceptual design
>   codes, and computational fluid dynamics (CFD) codes
> • **Experimental programs**, which employ either ground-based test facilities (e.g., wind tunnels)
>   or flight tests"*

Y el factor que decide el reparto `[p.776]`:
> *"The division between the usage of analytical tools and experimental programs depends on the
> organization's history of design practices (i.e., experience), on the facilities (computational and
> experimental) available to the designers, and on the personnel resources of the organization."*

→ **Requisito de producto**: el reparto es **configurable por organización**, no un default nuestro.
La Forja debe permitir que un equipo declare de qué herramientas dispone y qué prácticas sigue, y el
selector de método debe respetarlo.

### A.2 Qué NO es CFD `[§14.1, p.776]`

> *"CFD is not purely theoretical analysis. CFD changes the fundamental nature of the analysis from
> calculus to arithmetic and from the continuum domain to the discrete domain so that the problem of
> interest can be solved using a computer."*

Y de qué se alimenta realmente el fluidodinamicista computacional:
> *"The computational fluid dynamicist often relies on the mathematical analysis of simpler,
> linearized formulations, and on heuristic reasoning, physical intuition, data from experimental
> programs, and trial-and-error procedures. Furthermore, the numerical algorithms that are chosen
> depend heavily on the dominant physics of the specific application."*

Y el rango de las aproximaciones que **todo** código lleva dentro, incluso el más riguroso:
> *"The approximations range from the model used to generate numerical values for the absolute
> viscosity as a function of pressure and temperature to the numerical algorithm used to model the
> turbulent boundary layer."*

→ **Requisito**: La Forja debe exponer la **cadena completa de modelos** de un estudio, desde la ley
de viscosidad hasta el modelo de turbulencia. Nada de "resuelve Navier-Stokes" a secas.

### A.3 Las tres preguntas que el usuario debe poder contestar `[§14.1, p.777]`

Literal, y aplica **use o no use el código que él escribió**:
> *"it is important that you understand (1) the grid scheme that is used to represent the body and the
> grid scheme that is used in the solution of the flow field; (2) the numerical algorithms used to
> obtain the flow-field solution; and (3) the models used to represent fluid mechanic phenomena,
> thermochemical phenomena, and flow properties."*

→ **Ficha de estudio de La Forja, campos obligatorios**: esquema de malla de superficie · esquema de
malla de volumen · algoritmo numérico · modelo de turbulencia · modelo termoquímico · ley de
propiedades. Seis campos, siempre visibles, siempre exportados con el reporte.

### A.4 Los seis peldaños, en el orden del libro

**Peldaño 1 — Semi-empírico `[§14.1.1, p.777-778]`.**
Ejemplo canónico: **MISL3** (Lesieutre et al. 1989), *"a combination of theoretical methods with
nonlinear corrections for the body and an extensive experimental database for wing and tail fin loads"*.
Lo que la base de datos **incluye inherentemente**: *"viscous and compressibility effects as well as
fin-body gap effects... Mutual interference between control surfaces is also considered in the data
base."* **Límite declarado: Mach 5 o menos.**
Para hipersónico: **S/HABP** (Supersonic/Hypersonic Arbitrary Body Program, Gentry et al. 1973).
Su pipeline, que es el nuestro para el módulo hipersónico:
1. dividir la geometría en **paneles elementales planos**;
2. calcular la presión no viscosa de cada panel por **métodos de impacto o de expansión**;
3. con la distribución de presión, usar **correlaciones de capa límite** para estimar fricción y calor;
4. **integrar** presiones y cortantes para fuerzas y momentos.
Literal: *"These types of methods have been widely used over the years on a variety of aircraft
programs."*
→ **[NAVEGADOR]**. Y es, palabra por palabra, la arquitectura del módulo hipersónico de La Forja.

**Peldaño 2 — Paneles de superficie `[§14.1.2, p.778-779]`.**
En desarrollo desde los años 60. Usan las ecuaciones de flujo potencial linealizado.
Mecánica del VLM subsónico, literal: *"vortex lattice methods (VLMs) combine the basic building blocks
of the constant source panel and the vortex lattice methods, representing thickness effects with
source panels and lift effects with vortex panels. Every panel has some form of source singularity
imposed upon it, whether it is a lifting or nonlifting component."*
**Y el gotcha que hay que registrar**: *"There are an infinite number of combinations of vortex
singularity variations that will provide lift and satisfy the boundary conditions. Therefore, a
numerical technique must be developed to generate a unique solution. This is done by prescribing an
assumed chordwise variation and spanwise variation of vortex strength, then solving both for the
source strengths and for the vortex strengths, subject to the Kutta condition. **The particular
variation of the vortex singularity chosen impacts the resulting magnitudes of the source strengths.
An improper choice can lead to large source gradients and inaccuracies in the solution.**"*
→ La elección de la variación de vórtice es una **decisión de diseño del solver que puede arruinarlo**.
Debe quedar registrada en la ficha del estudio.
**PAN AIR** (Towne et al. 1983): subsónico **y** supersónico, ecuaciones de Prandtl-Glauert;
*"uses a linear source distribution and a quadratic doublet distribution on each panel to reduce the
number of panels needed to attain a given accuracy."*
**TRANAIR** (Everson et al. 1987): nace porque *"panel methods have long been able to handle complex
configurations and boundary conditions, but they are limited to linear flows."* Resuelve la ecuación
de **potencial completo**. Su truco de arquitectura: *"The key to the ability to handle complex
configurations is the use of a **rectangular grid rather than a surface fitted grid**"* — malla híbrida
de paneles de superficie + puntos de campo. **Ése es un patrón que nos conviene copiar: evita el
infierno del mallado ajustado al cuerpo.**
**Lo que estos tres NO dan, literal `[p.779]`**:
> *"Since the VLM, the PAN AIR code, and the TRANAIR code all are inviscid codes, they do not model
> the boundary layer. So, these codes do not provide estimates for the skin-friction component of the
> drag coefficient. Furthermore, they do not model the shock-wave/boundary-layer interactions that
> produce the separation-induced-drag component of the drag coefficient at transonic speeds. However,
> these codes provide reasonable estimates of the wave drag for supersonic flows. The lift and pitch
> moment coefficients generated using these codes are best for low angles of attack (i.e., cruise
> applications)."*
Y la ventaja que nos importa:
> *"because only a surface discretization scheme is required, very complex configurations can be
> modeled in which the panel density is adjustable to the desired accuracy. Therefore, since the
> computational intensity for panel methods is very low, the cost of computing the lift and pitch
> moment is relatively inexpensive for those conditions where these methods are applicable."*

**Peldaño 3 — Euler `[§14.1.3, p.779]`.**
Se obtiene despreciando los términos viscosos de Navier-Stokes.
> *"Since the Euler equations neglect all viscous terms, the solutions cannot be used to compute
> either the shear forces or the heat transfer to the surface of the vehicle. However, they can
> provide solutions for the unsteady, inviscid flow field over the configuration in either subsonic,
> transonic, or supersonic streams."*
**El cuello de botella declarado es la malla, no el solver**:
> *"one of the difficulties of numerically solving the Euler equations involves generating a
> body-fitted, discrete grid about the configuration geometry... The job of creating a surface
> definition for a complicated three-dimensional geometry that is needed for panel methods is much
> easier than the generation of a body-fitted grid that is needed for an Euler-based code."*
Y la tendencia que el libro registra: *"Euler codes are available to even the smallest design groups...
Since the costs for use continue to decrease, more and more organizations are using Euler codes to
generate the lift and pitch moment for those applications where these aerodynamic coefficients were
formerly computed using the surface panel methods."*
→ **Lectura estratégica**: el cliente nos dice que Euler está desplazando a paneles para CL y Cm.
Nuestro diferenciador no puede ser "tenemos paneles"; tiene que ser **la escalera completa con
procedencia** y el **precómputo**.

**Peldaño 4 — Dos capas `[§14.1.4, p.779-780]`.**
Procedimiento exacto, para implementar tal cual:
1. Euler o paneles genera el campo no viscoso ⇒ condiciones en el borde de la capa límite.
2. Condiciones de pared: `u = 0` (no deslizamiento) y `v = 0` (sin flujo a través) **o** condición de
   transpiración. Térmica: **`Tw` dada (isotérmica)** o **`∂T/∂y = 0` (pared adiabática)**.
3. Se resuelve la capa límite con esas condiciones + los modelos de transición/turbulencia.
4. **Segunda iteración**: se recalcula el campo no viscoso reemplazando la configuración real por la
   **configuración efectiva** = coordenada de superficie + **espesor de desplazamiento** de la primera
   iteración. Y se recalcula la capa límite sobre ese campo.
**Dominio de validez, literal**: *"Two-layer flow models can be used for applications where the viscous
boundary layer near the surface is thin and does not significantly alter the inviscid-region flow
field. Therefore, this procedure would not apply to flow fields for which there are shock-wave/
boundary-layer interactions or significant regions of separated flow. So, the two-layer method would
not be the proper tool to generate solutions for a transonic flow, where shock-wave/boundary-layer
interactions cause the boundary layer to separate or for flows where the vehicle is at large angles
of attack, so that there are extensive regions of separated flow."*
→ **Éste es el peldaño más rentable para nosotros**: da fricción y calor, converge en 2–4 pasadas, y
cada pasada es barata. **[PRECÓMPUTO]**.

**Peldaño 5 — Tratamiento unificado (Navier-Stokes) `[§14.1.5, p.780-781]`.**
Los **siete pasos de Li (1989)**, literal — es un checklist de proyecto:
> 1. *Select the physical processes to be considered.*
> 2. *Decide upon the mathematical and topographical models.*
> 3. *Build body geometry and space grid.*
> 4. *Develop a numerical solution method.*
> 5. *Incorporate the above into a computer code.*
> 6. *Calibrate and validate the code against benchmark data.*
> 7. *Predict aerodynamic coefficients, flow properties, and aeroheatings.*
**Mallas**: estructuradas o no estructuradas, *"there are no a priori requirements on how grids are to
be oriented"* — **pero** hay un acoplamiento con el modelo físico: *"since turbulence models are often
formulated in terms of the distance normal to the surface, the grid schemes utilized for these
turbulent boundary-layer models employ surface-oriented coordinates, where one of the coordinate axes
is locally perpendicular to the body surface."*
**Refinamiento adaptativo** (Aftosmis & Baron 1989), literal:
> *"Adaptive grid embedding provides a promising alternative to more traditional clustering techniques.
> This method locally refines the computational mesh by sub-dividing existing computational cells based
> on information from developing solutions. By responding to the resolution demands of chemical
> relaxation, viscous transport, or other features, adaptation provides additional mesh refinement only
> where actually required by the developing solution."*
**PNS (Navier-Stokes parabolizadas)** — se obtiene despreciando los términos no estacionarios y las
derivadas viscosas en la dirección de la corriente. Condiciones para poder hacerlo (Deiwert et al. 1988):
**sin inversión de flujo** y **porción no viscosa supersónica en la dirección de la corriente**;
razonable para **Re alto** sobre cuerpos **sin variaciones geométricas severas** en la corriente.
Límite práctico: *"there is no streamwise separation, but crossflow separation is allowed."*
Ganancia: *"a tremendous reduction in computing time and in storage requirements is possible over that
required for the time-dependent approaches"* porque las ecuaciones quedan **parabólicas** ⇒ se marcha
espacialmente. Necesita **solución de arranque** en una superficie donde el flujo no viscoso ya sea
supersónico (Mendenhall usó un código de Euler para generarla).

**Peldaño 6 — Integrar la escalera `[§14.1.6, p.781-782]`: el caso Pegasus™.**
Diseño aerodinámico basado en técnicas probadas de vehículos existentes. **Cero ensayos de túnel.**
Se usaron *"readily available computational codes"* para todos los análisis, y **todos los niveles**,
*"ranging in complexity from empirical data-based methods to three-dimensional Navier-Stokes codes"*:
- **PNS** para las distribuciones de presión del fuselaje;
- **Navier-Stokes axisimétrico** para explorar separación inducida por la pluma del cohete cerca de las
  superficies de control de cola;
- **Navier-Stokes 3D** para el campo completo en condiciones críticas, *"to check details of the flow,
  which may have been missed by the simpler methods"*;
- los resultados alimentaron el **entorno de calentamiento** para el diseño de la protección térmica.
**Y el desenlace, que es la lección** `[p.782]`: los primeros lanzamientos fueron exitosos, pero tras
un fallo posterior surgió la disputa de si la aerodinámica estaba mal predicha o si el control era
demasiado sensible. El problema era **lateral-direccional**: los métodos de la época lo predecían
*"slightly stable"* y el vehículo real resultó *"slightly unstable"*.
> *"Understanding the uncertainties in the analysis required careful evaluation since no prediction
> is exact."*

### A.5 Instalaciones en tierra — el detalle `[§14.3]`

**Regla de arranque, literal** (Matthews et al. 1985):
> *"A precisely defined test objective coupled with comprehensive pretest planning are essential for
> a successful test program."*

Los **seis objetivos** están en §5.5. Los **nueve parámetros** están en §5.4.

**La limitación fundamental**, Shang (1995) `[p.777]`:
> *"like CFD, experimental simulation does not necessarily reproduce accurate results in flight. The
> inherent limitation is derived from the principle of dynamic similarity—the scaling rule. Even if a
> perfect match to flight conditions is reached in dimensionless similarity parameters of Mach,
> Reynolds, and Eckert numbers, the small-scale model still may not describe the fine-scale surface
> features. If the flow fields under study are strongly influenced by fine-scale turbulence and
> laminar-turbulent transition, the accuracy of simulations to flow physics is uncertain."*

**Reynolds: qué es sensible y qué no**, Laster et al. (1998) `[p.787]` — es la regla de decisión más
accionable del capítulo:
> *"Experience has shown that lift and pitching moments are usually not too sensitive to Reynolds
> number up to the onset of buffet; but, buffet boundary, maximum lift, drag, and drag rise are usually
> very sensitive to Reynolds number... Because of little sensitivity of lift and pitching moment to
> Reynolds number below buffet onset, in most cases, the engineer has been able to directly use low
> Reynolds number wind tunnel measurements of lift and pitching moment in his/her design without having
> to resort to Reynolds number corrections. **However, this is not necessarily true for wings with high
> aft loading.**"*

**El caso F/A-18E como modelo de programa** (Niewald & Parker 2000) `[p.786]`, literal:
> *"Development of a credible preflight database for accurate aircraft predictions requires commitment
> and resources... The commitment was made at the outset to develop and implement test techniques that
> would properly account for each item impacting aircraft performance either by wind-tunnel testing or
> by estimation. Adequate resources allowed the development of high-fidelity models, use of large,
> interference-free wind-tunnels, comprehensive test programs, and integration of CFD methods to ensure
> first-time quality test results. **Front loading the project resources to the wind-tunnel program were
> beneficial to the subsequent performance flight test program.** The excellent agreement between
> wind-tunnel and flight results allowed the performance flight evaluation plan to be reduced by 60
> flights and eliminated aircraft development flight testing for drag reduction as a result of
> optimistic predictions."*
→ **60 vuelos ahorrados** por hacer bien el trabajo aguas arriba. Ése es el argumento comercial de un
CAD conceptual que se toma en serio la procedencia.

### A.6 Vuelo `[§14.4]`

Razones (Draper + Neumann) en §5.6. Y la advertencia sobre el instrumental `[p.777]`:
> *"because of their size, their weight, and their fragile nature, many of the types of instrumentation
> available to the wind-tunnel-test engineer are not available to the flight-test engineer."*

Y Saltzman & Ayers (1982) `[p.789]`:
> *"Although aircraft designers must depend heavily upon model data and theory, their confidence in
> each should occasionally be bolstered by a flight demonstration to evaluate whether ground-based
> tools can indeed simulate real-world aerodynamic phenomena. Over the years as the increments of
> improvement in performance have become smaller and aircraft development costs have risen, casual
> model-to-flight drag comparisons have sometimes given way to very comprehensive correlation efforts
> involving even more precise sensors, the careful control of variables, and great attention to detail
> on behalf of both tunnel experimenters and their flight counterparts."*

### A.7 Traducción a arquitectura de La Forja

| Elemento del cap 14 | Módulo de La Forja | Estado |
|---|---|---|
| Semi-empírico / S/HABP (paneles planos + impacto/expansión + correlaciones de capa límite) | `src/aero/hipersonico.ts` — newtoniana modificada sobre malla triangular + Eckert | **por construir** — [NAVEGADOR] |
| Teoría lineal / Busemann / choque-expansión 2D | `src/aero/perfil-supersonico.ts` (extiende `cuna-anderson.ts`) | **por construir** — [NAVEGADOR] |
| Flujo cónico (Tabla 11.1) | LUT de fórmulas cerradas para planta rectangular/delta/arrow | **por construir** — [NAVEGADOR] |
| Paneles / VLM (subsónico y supersónico) | extiende `src/aero/potencial.ts` | parcial |
| Cuerpo esbelto / regla de áreas | `src/aero/cuerpo-esbelto.ts` | **por construir** — [NAVEGADOR] |
| Dos capas (no viscoso + capa límite, con δ*) | acople iterativo sobre el módulo anterior | **por construir** — [PRECÓMPUTO] |
| Euler / PNS / RANS | trabajos en iangpu, servidos como campos/tablas | [PRECÓMPUTO] / [GPU-VIVO] |
| Túnel de viento | **sustituto**: catálogo precomputado barrido en (α, β, M, δ) | [PRECÓMPUTO] |
| Verificación / validación / calibración / certificación | **metadato obligatorio del estudio** + suite de regresión con los fixtures de §3 | **por construir** |
| Los nueve parámetros de similitud | reporte de "simulación parcial" con lo sacrificado | **por construir** |
| Costo relativo (vuelo 100× túnel 1000× CFD) | selector de método que sugiere la herramienta más barata suficiente | **por construir** |






