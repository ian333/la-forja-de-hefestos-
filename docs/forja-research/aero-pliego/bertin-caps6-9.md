# Bertin & Cummings, *Aerodynamics for Engineers* 6ª ed. — caps. 6 a 9

**Fuente:** `docs/forja-research/manuales/aero/txt/bertin.txt`, líneas 16967–31417 (leído completo, sin muestreo).
Offsets verificados: cap6 = 16967 (p.294), cap7 = 19673 (p.341), cap8 = 24709 (p.431), cap9 = 28963 (p.505), cap10 = 31418 (no invadido).
**Fecha del análisis:** 2026-08-04. **Autor:** agente de análisis del pliego AERO (bloque Bertin 6–9).
**Contrato:** `docs/forja-research/aero-pliego/CONTRATO.md` — 7 reglas duras. Español mexicano.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

Este bloque es **el motor de cálculo aplicado** del producto. Raymer (el cliente) dice CÓMO se
diseña un avión; Anderson dice DE DÓNDE salen los coeficientes; **Bertin 6–9 dice cómo los
CALCULAS con un programa**. Es el único de los tres libros que entrega un método 3D completo,
paso a paso, con matriz resuelta y números publicados que sirven de prueba.

| Cap | Título | Qué entrega al software |
|---|---|---|
| 6 | *Incompressible Flows Around Airfoils of Infinite Span* (p.294–340) | Teoría de perfil delgado: `Cl`, `Cmac`, `α0l`, centro de presión, desde la LÍNEA DE COMBADURA. Alta sustentación (flaps, slats, ranuras) y sus límites reales. |
| 7 | *Incompressible Flow About Wings of Finite Span* (p.341–430) | **Lifting-line (ecuación del monoplano) + VORTEX-LATTICE completo con ejemplo numérico resuelto.** Efecto de alargamiento, estrechamiento, flecha, torsión. Alas delta (Polhamus). |
| 8 | *Dynamics of a Compressible Flow Field* (p.431–504) | Isentrópico, tobera C-D, Prandtl-Meyer, ondas de choque oblicuas/normales/cónicas, fricción compresible (Spalding-Chi), interacciones choque/capa-límite y choque/choque (Edney). |
| 9 | *Compressible, Subsonic Flows and Transonic Flows* (p.505–549) | Prandtl-Glauert / Karman-Tsien / Laitone, **Mach crítico y Mach de divergencia de resistencia**, perfil supercrítico, flecha, **regla del área** de Whitcomb, ala de flecha hacia adelante. |

**El corazón del bloque, y del producto:** §7.5 (p.379–399). Bertin desarrolla el vortex-lattice
con un ejemplo de 4 paneles cuyos coeficientes de influencia están IMPRESOS uno por uno. Eso
convierte al ejemplo 7.4 en el fixture más valioso de todo el pliego: valida un solver 3D contra
una matriz publicada, número por número, sin ambigüedad.

**Lo que el cliente compra aquí:** un CAD conceptual donde el alumno/ingeniero dibuja una
planta alar con cotas (flecha, estrechamiento, alargamiento, torsión), le corre un estudio, y en
milisegundos ve `CL`, `CDi`, la distribución de sustentación en la envergadura y DÓNDE va a
entrar en pérdida primero. Eso es exactamente el "trade study" que Raymer §2.1.4 dice que los CAD
de alta gama no soportan. El vortex-lattice cabe en el navegador (ver §5).

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§ Bertin] requisito (APRENDER / CONSTRUIR / ambos)`.

### Cap. 6 — perfiles 2D

- `[aero2d] [§6.2, p.296]` El software debe representar la sustentación como CIRCULACIÓN, no como
  "diferencia de presión mágica". El vórtice de arranque es la contraparte que hace válido el
  teorema de Kelvin. (APRENDER)
- `[aero2d] [§6.3, p.298]` El perfil se representa por su **línea de combadura media** cubierta por
  una lámina de vórtices `γ(s)`; el espesor NO entra en la teoría. (ambos)
- `[aero2d] [§6.3, p.299]` La condición de Kutta se implementa como restricción `γ(c) = 0`. Bertin
  la declara explícitamente como **condición de contorno VISCOSA metida en una teoría no viscosa**;
  el software debe etiquetarla así, no como resultado del potencial. (ambos)
- `[aero2d] [§6.4, p.302–304]` Perfil simétrico: `Cl = 2πα`, `Cmc/4 = 0`, `xcp = c/4` independiente
  de α. Es el caso de prueba mínimo del módulo 2D. (CONSTRUIR)
- `[aero2d] [§6.5, p.306–310]` Perfil combado: resolver `A0, A1, A2` por integración de `dz/dx` y
  entregar `Cl = 2π(α − α0l)`, `Cmac = (π/4)(A2 − A1)`, `xcp(Cl)`. **Solo se necesitan A0, A1 y A2**
  aunque la serie sea infinita. (CONSTRUIR)
- `[aero2d] [§6.5, p.310]` El centro aerodinámico teórico es `c/4`; el real cae entre **0.23c y
  0.27c**. El software debe mostrar el rango, no solo el valor teórico. (ambos)
- `[aero2d] [§6.5, p.314–315]` `Clmax` depende del espesor: máximo alrededor de `t/c ≈ 0.12`; por
  debajo de 12% cae rápido. El software debe advertir cuando el usuario adelgaza el perfil.
  (APRENDER)
- `[aero2d] [§6.5, p.315–316]` Sin modelar la estela separada NO se puede predecir `Clmax`. Sin
  capa límite el error crece con α. El estudio 2D debe declarar su techo de validez. (ambos)
- `[viscoso] [§6.6, p.317]` Perfiles laminares: comparación `Cf = 1.328/√ReL` (Blasius) vs
  `Cf = 0.074/ReL^0.2` (Prandtl turbulento) como motivación de la búsqueda de flujo laminar.
  (APRENDER)
- `[viscoso] [§6.6, p.318]` La "cubeta" de resistencia laminar da hasta **25% menos resistencia**
  que un perfil convencional, pero **se pierde con rugosidad de fabricación** (remaches, pernos,
  abolladuras, insectos). El software debe pedir el acabado superficial antes de acreditar el
  beneficio. (ambos)
- `[aero2d] [§6.7, p.321–322]` Alta sustentación de UN elemento: el problema NO es generar
  velocidad, es **desacelerarla sin separar** (Smith 1975). Distribución de Stratford = recuperación
  de presión en la distancia más corta sin separar. (APRENDER)
- `[aero2d] [Concept Box, p.326]` **Regla de diseño dura**: en `α0l = −(1/π)∫(dz/dx)(cos θ − 1)dθ`,
  la combadura en el borde de ataque se multiplica por `(cos 0 − 1) = 0` y la del borde de salida
  por `(cos π − 1) = −2`. **Por eso los dispositivos de sustentación grandes van atrás.** Los del
  borde de ataque NO son dispositivos de sustentación: son **control de separación viscoso**. El
  software debe clasificarlos distinto. (ambos)
- `[aero2d] [§6.8, p.328]` Factores de intercambio de alta sustentación (Meredith 1993) — ver
  FIXTURE `bertin-hl-trade`. Son requisitos de negocio expresados en libras y millas náuticas.
  (CONSTRUIR)
- `[geometria] [§6.8, p.329]` La extensión en cuerda de flaps y slats está limitada por la posición
  de los **largueros** (delantero ≈0.15c, trasero ≈0.60c) y por el volumen de combustible y el
  alojamiento del tren. El CAD debe modelar esas restricciones como cotas, no como decoración.
  (CONSTRUIR)
- `[aero3d] [§6.8, p.330]` El número de ranuras del dispositivo de salida gobierna `CLmax`; **la
  flecha del ala DEGRADA `CLmax`** y obliga a más complejidad. (ambos)
- `[aero3d] [§6.8, p.330, Fig 6.26]` Techo físico: `CLmax ≈ 3` para sistemas NO soplados (con flecha
  típica de 25°); hasta **7** con control de capa límite soplado/succionado. El software debe
  rechazar como imposible cualquier `CLmax` por encima. (CONSTRUIR)
- `[aero2d] [§6.9, p.335]` Perfiles militares: borde de ataque AFILADO (furtividad) y espesor
  **5–8% de cuerda** (eficiencia transónica/supersónica) ⇒ la curva de sustentación **pierde su
  tramo lineal**. Un modelo lineal aplicado a un caza es una mentira. (ambos)

### Cap. 7 — alas 3D

- `[aero3d] [§7.1, p.342]` El ala finita tiene componente de velocidad en la envergadura; la carga
  cae a cero en la punta y se enrollan dos torbellinos de punta. (APRENDER)
- `[aero3d] [§7.3, p.346]` **Rango de validez declarado de lifting-line (PLLT): ala sin flecha o
  con poca flecha, sin diedro, `AR ≥ 4.0`, ángulos de ataque bajos.** Fuera de ahí el software debe
  cambiar a vortex-lattice. (ambos)
- `[aero3d] [§7.3.1, p.350]` El downwash inclina la sustentación hacia atrás: nace la **resistencia
  inducida (vortex drag)**. Es consecuencia de la sustentación, no de la viscosidad. (APRENDER)
- `[aero3d] [§7.3.2, p.352–354]` Distribución elíptica: downwash CONSTANTE en la envergadura,
  `ε = CL/(πAR)`, `CDv = CL²/(πAR)`. Es la cota inferior contra la que se mide cualquier ala.
  (CONSTRUIR)
- `[aero3d] [§7.3.2, p.351]` **La distribución elíptica de SUSTENTACIÓN solo produce distribución
  elíptica de `Cl` si la planta es rectangular** (c constante). El software no debe confundir
  carga con coeficiente. (ambos)
- `[aero3d] [§7.3.2, p.354]` Conversión entre alargamientos: `CD,2 = CD,1 + (CL²/π)(1/AR2 − 1/AR1)`
  y `α2 = α1 + (CL/π)(1/AR2 − 1/AR1)`. Es el trade study de alargamiento en dos líneas. (CONSTRUIR)
- `[aero3d] [§7.3.3, p.357–362]` Ecuación del monoplano por colocación: `m(α − α0l) sin φ =
  Σ An sin nφ (mn + sin φ)`, con `m = c·a0/(8s)`. Resolver N×N. (CONSTRUIR)
- `[aero3d] [§7.3.3, p.360]` Los cinco parámetros que pueden variar con la envergadura: `Γ`, `ε`,
  `c` (estrechamiento), `α` (**torsión geométrica**), `α0l` (**torsión aerodinámica**, perfil que
  cambia). El modelo de datos del ala debe soportar los cinco. (CONSTRUIR)
- `[aero3d] [§7.3.4, p.362]` `CL = A1 π AR` — **solo depende del primer coeficiente**. (CONSTRUIR)
- `[aero3d] [§7.3.5, p.363]` `CDv = (CL²/πAR)(1+δ) = CL²/(π e AR)`, `e = 1/(1+δ)`,
  `δ = Σ n(An/A1)²` para n=3,5,7… Valores típicos de `e`: **0.6 a 0.95**. (CONSTRUIR)
- `[aero3d] [§7.3.5, p.365]` `δ` y `τ` (parámetro de pendiente) son **altos en los dos extremos**
  del estrechamiento (punta en pico y ala rectangular) y **mínimos en λ ≈ 0.3–0.4**. Ese es el
  óptimo que el CAD debe sugerir. (ambos)
- `[aero3d] [§7.3.5, p.365]` Pendiente 3D: `a = a0 / (1 + (a0/πAR)(1+τ))`. (CONSTRUIR)
- `[aero3d] [§7.3.5, p.365, Fig 7.15]` Patrones de entrada en pérdida por estrechamiento:
  rectangular (λ=1) entra por la RAÍZ = bueno; λ≈0.4 entra casi a la vez en todas las secciones;
  punta en pico (λ=0) entra por la PUNTA = pierde los alerones. (ambos)
- `[aero3d] [§7.3.5, p.367]` **Torsión (washout)** y slots/slats hacia la punta son los remedios
  contra la pérdida de punta. El CAD debe permitir cotar la torsión. (CONSTRUIR)
- `[estabilidad] [§7.3.5, p.365]` El estrechamiento reduce el momento flector de raíz y permite
  más espesor absoluto con bajo `t/c`. Es un acoplamiento aero↔estructura que el trade study debe
  mostrar. (ambos)
- `[aero3d] [§7.4, p.375–378]` Métodos de paneles: singularidades sobre paneles cuadriláteros,
  Neumann (análisis, geometría fija) vs Dirichlet (diseño inverso, se busca la forma). El diseño
  inverso es **iterativo y acoplado**, no de un tiro. (ambos)
- `[aero3d] [§7.4, p.378]` Observación empírica citable: **los VLM predicen los datos experimentales
  MEJOR que los métodos de paneles de superficie** porque desprecian a la vez espesor y viscosidad
  y los dos errores se cancelan ("fortuitously"). Justifica elegir VLM para diseño conceptual.
  (ambos)
- `[aero3d] [§7.5, p.379–399]` **VORTEX-LATTICE COMPLETO** — ver §2.4 y §3 (FIXTURE `bertin-ej-7.4`).
  (CONSTRUIR)
- `[aero3d] [§7.5, p.382]` Efecto de la flecha: el vórtice ligado de una semiala induce downwash
  sobre la otra ⇒ **la flecha reduce la sustentación en el centro Y en las puntas** y baja
  `dCL/dα`. (ambos)
- `[aero3d] [§7.5, p.395]` En ala en flecha la carga de secciones exteriores sube ⇒ separación
  prematura de punta ⇒ **pérdida de mando y corrimiento del centro de presión hacia adelante =
  encabritado inestable**. Es una advertencia de seguridad que el software debe emitir. (ambos)
- `[aero3d] [§7.5, p.395–396]` Las **barreras de capa límite** (boundary-layer fences) no eliminan
  el flujo transversal: **dividen el ala en zona interior y exterior**. (APRENDER)
- `[aero3d] [§7.5, p.396–399]` Resistencia inducida a partir del VLM por el método de Multhopp /
  Kalman: ajuste parabólico de `Cl·c` por franja, incidencia inducida `αi`, integración tipo
  Simpson generalizado. (CONSTRUIR)
- `[aero3d] [§7.6, p.401–404]` **Succión de borde de ataque `s`**: 100% = resistencia inducida
  potencial `CL²/(πAR)`; 0% = fuerza resultante normal a la cuerda. Alas afiladas dan **≤50%**
  incluso con poca flecha. Flaps de borde de ataque, alabeo (warp) y **radio de borde de ataque**
  la suben. (ambos)
- `[performance] [§7.6, p.404]` A `CL ≈ 0.30` (vuelo 1g) los aviones reales se acercan a succión
  plena; a `CL ≈ 1.0` (maniobra) caen a la línea de succión CERO. El modelo de polar debe cambiar
  de régimen con `CL`. (CONSTRUIR)
- `[aero3d] [§7.7, p.404–409]` Alas delta: analogía de succión de Polhamus,
  `CL = Kp sinα cos²α + Kv sin²α cosα`. Válida para **bordes afilados, sin combadura ni torsión**.
  (CONSTRUIR)
- `[aero3d] [§7.7, p.408]` Delta plana: `ΔCD = CL tanα`, luego
  `CD = CD0 + Kp sin²α cosα + Kv sin³α`. (CONSTRUIR)
- `[estabilidad] [§7.7, p.409–411]` El delta genera un **momento de picado grande** que crece con
  α ⇒ necesita **canard** (XB-70, Mirage) o borde de salida reflejado/combadura negativa (Orbiter).
  (ambos)
- `[aero3d] [§7.7, p.413]` **Vortex breakdown**: flujo axial inverso y engorde súbito del núcleo;
  limita el avión ágil, produce histéresis dinámica y **buffet de cola** que reduce la vida de la
  estructura. (APRENDER)
- `[aero3d] [§7.8, p.414–418]` Strakes/LEX: el vórtice del strake reenergiza la capa límite del ala
  y da sustentación con **poca área mojada**. F-5E: **+4.4% de área da +38% de `CLmax`**; hay un
  límite práctico de tamaño y **cerca de él ya está el F-5E**. (ambos)
- `[estabilidad] [§7.9, p.418–422]` Torbellinos ASIMÉTRICOS en el fuselaje a α alto: **fuerza
  lateral y momento de guiñada con deslizamiento CERO**. En el F-111 el momento de guiñada inducido
  superaba en **un orden de magnitud** el mando de timón. Se cura con strakes de morro / punta
  redondeada. (ambos)
- `[aero3d] [§7.11, p.424–426]` UAVs: por debajo de cierto tamaño el alargamiento **deja de ser** el
  factor dominante (manda la fricción) ⇒ micro-UAVs de bajo AR. Ley del cuadrado-cubo: peso ∝ b³,
  área ∝ b². (ambos)

### Cap. 8 — compresible

- `[compresible] [§8.1, p.432–435]` Gas perfecto térmica y calóricamente: `cv = 717.6 J/kg·K`,
  `cp = 1005 J/kg·K` para aire **por debajo de ~850 K**; `γ = (n+2)/n`. (CONSTRUIR)
- `[compresible] [§8.1, p.436]` Regla de modelado: el flujo fuera de la capa límite, de estelas y
  de choques planos se trata como **reversible**. Detrás de un choque CURVO solo es isentrópico
  **a lo largo de una línea de corriente**. (ambos)
- `[compresible] [§8.1, p.440–441]` `a = √(γRT)`, `sin μ = 1/M`. Temperatura SIEMPRE absoluta.
  (CONSTRUIR)
- `[compresible] [§8.2–8.3, p.442–447]` Relaciones isentrópicas `Tt/T`, `pt/p`, `ρt/ρ`, `A/A*`.
  (CONSTRUIR)
- `[compresible] [§8.3, p.446, Fig 8.6]` **Rango de validez de Bernoulli**: error <1% si `M ≤ 0.5`;
  error <0.15% si `M ≤ 0.3`. Arriba de 0.5 la presión total ya NO es estática + dinámica. Este es
  el gate numérico que decide si el estudio corre incompresible o compresible. (CONSTRUIR)
- `[compresible] [§8.3, p.449]` Gasto máximo por unidad de área ocurre en el **throat sónico**
  (`M=1`) ⇒ flujo **estrangulado**. (ambos)
- `[compresible] [§8.4, p.451–454]` Tobera convergente-divergente: relación área-velocidad
  `dU/U = −(dA/A)/(1−M²)`; tabla de regímenes; `p/pt = 0.528` en el throat; toberas sobre- y
  sub-expandidas pierden empuje. (ambos)
- `[compresible] [§8.5, p.454–461]` Características y función de Prandtl-Meyer:
  `ν − θ = R` (característica izquierda), `ν + θ = Q` (derecha). (CONSTRUIR)
- `[compresible] [§8.6, p.462–472]` Choques oblicuos: relación θ-δ-M; **dos soluciones** (débil y
  fuerte) por cada δ; si δ supera el máximo, el choque **se desprende**. (CONSTRUIR)
- `[compresible] [§8.6, p.465]` **Principio de flecha (sweepback principle)**: las propiedades a
  través de un choque oblicuo son las de un choque normal calculado con la componente NORMAL del
  Mach; la componente tangencial de la VELOCIDAD no cambia (pero la del MACH sí, porque cambia T).
  (ambos)
- `[compresible] [§8.6, p.464]` `Cp,max → 2.0` en el punto de remanso en el límite hipersónico.
  (APRENDER)
- `[compresible] [§8.6, p.470–473]` Cono ≠ cuña: en el cono las propiedades son constantes sobre
  RAYOS desde el vértice y la presión sube desde el choque hasta la superficie (alivio de presión
  tridimensional). Mismo ángulo de giro ⇒ **choque y presión MENORES en el cono**. (ambos)
- `[viscoso] [§8.7, p.476–479]` Fricción compresible por Spalding-Chi: `Fc(Me, Tw/Te)`,
  `FRe(Me, Tw/Te)`, tablas 8.6–8.8. Alternativa citada: Van Driest (1956). (CONSTRUIR)
- `[viscoso] [§8.8, p.480–482]` Interacción choque/capa-límite: la capa límite **laminar** separa
  mucho más fácil y la interacción es MÁS LARGA; la **turbulenta** aguanta más gradiente adverso.
  El máximo calentamiento ocurre justo después de la readherencia. (ambos)
- `[viscoso] [§8.9, p.482–486]` Interacciones choque/choque, clasificación de Edney (Tipos I–VI).
  El **Tipo IV** produce un chorro supersónico que impacta la superficie ⇒ calentamiento pico
  catastrófico. El Tipo I se resuelve por **prueba y error** imponiendo `p4 = p5` y flujos
  paralelos. (ambos)
- `[compresible] [§8.10, p.486–494]` No existe una sola instalación que duplique el vuelo: hay que
  decidir QUÉ parámetros simular. "El modelado aerodinámico es el arte de la simulación parcial."
  (APRENDER)
- `[compresible] [§8.11, p.494–495]` Bushnell (2006): en 12 transportes comerciales, la predicción
  escalada de resistencia estuvo **hasta 22% baja y 10% alta**. Correcciones típicas: +6% pared,
  −5% Reynolds, +2% rugosidad, −4% sting/aeroelástico ⇒ ~+12% total. **El software debe reportar
  incertidumbre, no un número solo.** (ambos)

### Cap. 9 — subsónico compresible y transónico

- `[compresible] [§9.1.1, p.507–509]` Ecuación del potencial COMPLETA (no lineal) y su
  linealización a Prandtl-Glauert. Se declara **inválida en transónico (M≈1) e hipersónico (M>5)**.
  (ambos)
- `[compresible] [§9.1.2, p.509–511]` Transformación de Göthert: `x' = x/√(1−M∞²)`, `y'=y`, `z'=z`.
  Consecuencia de diseño: **el ala compresible de alargamiento AR equivale al ala incompresible de
  alargamiento `AR·√(1−M∞²)`** — el perfil no cambia, el alargamiento sí. (ambos)
- `[compresible] [§9.1.2, p.511]` `Cp = Cp,inc/√(1−M∞²)`; igual para `Cl` y `Cm`; **la posición de
  la fuerza resultante NO cambia** y la resistencia sigue siendo cero mientras no haya choques.
  (CONSTRUIR)
- `[compresible] [§9.1.3, p.512–513]` Correcciones mejoradas: **Karman-Tsien** y **Laitone** (2D) y
  **Lees `Cp = Cp,inc/(1−M∞²)^{3/2}`** para cuerpos esbeltos 3D. El software debe ofrecer las tres
  y mostrar que "la respuesta correcta suele quedar entre Karman-Tsien y Laitone". (ambos)
- `[compresible] [§9.1.5, p.513–515]` `Mcrit` se obtiene INTERSECTANDO la curva de `Cp,crit(M)` con
  la curva de `Cp,min` corregida por compresibilidad. Método gráfico ⇒ trivial de implementar como
  búsqueda de raíz. (CONSTRUIR)
- `[compresible] [§9.1.6, p.516–517]` **En `Mcrit` no pasa nada.** Lo que importa es
  `Mdd` (drag divergence). No hay método analítico confiable; cada fabricante tiene su regla.
  Fórmula empírica de Shevell: `Mdd = Mcrit[1.02 + 0.08(1 − cos Λ)]`. (ambos)
- `[compresible] [§9.2, p.517–520]` Secuencia transónica real (5 estados con Mach identificados):
  el `Cl` **sube ~2× y luego se DESPLOMA** cuando el choque de la superficie inferior llega al borde
  de salida y "aísla" el extradós del intradós. El software debe mostrar la caída, no extrapolar.
  (ambos)
- `[compresible] [§9.2, p.520]` En transónico, forzar la transición con tiras artificiales puede
  ser **insatisfactorio**: la posición del choque y la separación quedan a merced del disparador.
  (APRENDER)
- `[compresible] [§9.3.2, p.526–527]` Perfil supercrítico: extradós APLANADO ⇒ choque más atrás y
  más débil ⇒ menos resistencia; se pierde sustentación en la zona media y **se recupera con
  combadura positiva fuerte en el intradós trasero (cusp)**; radio de borde de ataque grande.
  Restricción: el intradós medio debe seguir SUBCRÍTICO o se separa. (ambos)
- `[compresible] [§9.4, p.527–529]` Principio de flecha: solo la componente NORMAL al borde de
  ataque se acelera hasta sónica ⇒ la flecha retrasa el choque. Válido en rigor solo para ala
  infinita de sección constante. (ambos)
- `[compresible] [§9.4.1, p.529–535]` **Regla del área de Whitcomb**: cerca de M=1 la resistencia
  de onda a sustentación nula depende principalmente del **desarrollo axial del área transversal
  total** (fuselaje + ala + góndolas + empenaje). El CAD conceptual debe graficar `A(x)` en vivo.
  (CONSTRUIR)
- `[compresible] [§9.4.2, p.538–540]` **Regla del área de segundo orden**: con sustentación hay
  expansión supercrítica sobre el ala ⇒ equivale a más espesor ⇒ **hay que indentar MÁS**. Ganancia
  medida: +0.02 en `Mdd`. Carlsen (1995): con función de peso basta con **60%** de lo que prescribe
  la regla sónica clásica. (ambos)
- `[geometria] [§9.4.2, p.539]` El área transversal que exigen tren, sistemas, asientos y altura de
  cabina **choca** con lo que pide la regla del área. Es un conflicto de requisitos que el CAD debe
  exponer, no ocultar. (ambos)
- `[aero3d] [§9.4.3, p.540–543]` Ala de flecha adelante (FSW): mismo choque barrido con **menos
  flecha de borde de ataque** ⇒ mayor pendiente de sustentación y menor resistencia inducida;
  centro aerodinámico más cerca de la raíz ⇒ menor momento flector; **entra en pérdida por la
  RAÍZ** ⇒ conserva alerones. Costo: **divergencia aeroelástica** (hasta −78% de presión dinámica
  de divergencia con flechas de −20° a −60°), que solo se resuelve con laminado compuesto orientado.
  (ambos)
- `[optimizacion] [§9.5, p.543–544]` La ecuación del potencial completa, no Navier-Stokes, sigue
  siendo el punto de partida del diseño transónico porque **se acopla con optimización
  multidisciplinaria (MDO)**. Argumento directo a favor de la arquitectura de La Forja. (ambos)

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

### 2.1 Teoría de perfil delgado (cap. 6)

**Supuestos declarados [§6.3, p.298]:**
1. Las características sustentadoras por debajo de la pérdida no las afecta la capa límite.
2. Ángulo de ataque pequeño.
3. La resultante de presiones apenas la afecta el espesor: combadura máxima pequeña y `t/c` pequeño.
   Bertin da los valores típicos que hacen válido esto: `t/c ≈ 0.12`, combadura media ≈ 0.02c.

**Ecuación fundamental [§6.3, ec. 6.5, p.301]:**
```
(1/2π) ∫[0..c] γ(ξ) dξ / (x − ξ)  =  U∞ (α − dz/dx)
```
Condición de Kutta: `γ(c) = 0`.

**Cambio de variable [ec. 6.7]:** `ξ = (c/2)(1 − cos θ)`, `x = (c/2)(1 − cos θ0)`.

**Distribución de vorticidad [ec. 6.20, p.307]:**
```
γ(θ) = 2 U∞ [ A0 (1 + cos θ)/sin θ  +  Σ_{n=1..∞} An sin(nθ) ]
```

**Coeficientes [ecs. 6.23, 6.24]:**
```
A0 = α − (1/π) ∫[0..π] (dz/dx) dθ
An = (2/π) ∫[0..π] (dz/dx) cos(nθ) dθ
```

**Salidas [ecs. 6.25, 6.29, 6.30, 6.27]:**
```
Cl    = 2π (A0 + A1/2) = 2π (α − α0l)
α0l   = −(1/π) ∫[0..π] (dz/dx)(cos θ − 1) dθ
Cmc/4 = Cmac = (π/4)(A2 − A1) = (1/2)∫[0..π](dz/dx)(cos 2θ − cos θ)dθ
Cm0   = −(π/2)(A0 + A1 − A2/2)
xcp   = (c/4)[ 1 + (π/Cl)(A1 − A2) ]
```
Caso simétrico (`dz/dx ≡ 0`): `A0 = α`, `An = 0`, `γ(θ) = 2αU∞(1+cosθ)/sinθ`, `Cl = 2πα`,
`Cla = 2π /rad = 0.1097 /deg`, `Cm0 = −Cl/4`, `Cmc/4 = 0`, `xcp = c/4` **para todo α**.

**Rango de validez / qué se rompe:**
- Válido **por debajo de la pérdida**. En el ejemplo 6.1 (NACA 0009) el acuerdo es excelente hasta
  **α = 12°**; arriba de eso los efectos viscosos alteran el campo y la teoría deja de ver.
- La teoría **no ve el espesor**: predice `Cla = 2π` para todos. Medido: **6.0 /rad** (NACA 2412,
  −4.5%) y **5.9 /rad** (NACA 2418, −6.1%). El espesor y la capa límite bajan la pendiente.
- Predice **velocidad infinita en el borde de ataque** (placa plana con dos bordes afilados). De ahí
  la "succión de borde de ataque" que cancela exactamente la componente de resistencia. Carlson y
  Mack (1980), citados en p.303: *"Linearized theory places no bounds on the magnitude of the peak
  suction pressure"* — la teoría lineal **no acota** ese pico, y las presiones realizables limitan
  severamente el empuje aunque casi no afecten la fuerza normal.
- Predice `xac = c/4`; real **0.23c–0.27c** (medido 0.239c–0.247c en 2412/2418).
- **No puede predecir `Clmax`**. Para eso hay que modelar capa límite Y estela separada
  (Henderson 1978, Fig. 6.11): solo con ambas hay acuerdo hasta `Clmax`, y solo para perfiles que
  separan gradualmente (tipo GA(W)-1).
- Cita literal de Henderson (1978), p.315: *"Rarely will the boundary layers be thin enough that
  potential flow analysis of the bare geometry will be sufficiently accurate."*

### 2.2 Alta sustentación (cap. 6, §6.7–6.9)

- **Regla del brazo de palanca de la combadura** [Concept Box p.326]: en el integrando de `α0l`,
  el peso es `(cos θ − 1)`, que vale **0 en el borde de ataque** y **−2 en el borde de salida**.
  ⇒ Combadura al frente: no cambia `α0l`. Combadura atrás: máximo efecto.
  ⇒ Consecuencia física: los **flaps de salida generan sustentación**; los **slats/Krueger de
  ataque NO** — controlan separación y retrasan la pérdida (fenómeno viscoso).
- **Criterio de Liebeck (1973)** para perfiles de alta sustentación de un elemento: (1) la capa
  límite no separa; (2) la forma resultante es práctica y realista; (3) se obtiene el `Cl` máximo
  posible. Usa distribución de Stratford (recuperación de presión en la distancia más corta) más
  una **rampa de transición** corta que suaviza la entrada a ese gradiente.
- **Física de los multielemento** [§6.8, p.328–333]: capas límite CONFLUENTES (la estela de un
  elemento se funde con la capa límite del siguiente), flujo en el "cove", flujo por la ranura,
  separación y readherencia, y **efectos de compresibilidad aun a Mach de vuelo bajo** por los
  gradientes de presión enormes.
- Secuencia de cálculo viscoso recomendada por Olson et al. (1978) [p.331]:
  capa límite convencional del elemento principal → estela turbulenta desde su borde de salida →
  fusión con la capa límite del flap = **capa límite confluente** → borde de salida del flap →
  estela a lo largo de una línea de corriente potencial.
- **Efecto de la ranura**: Bertin NO da una fórmula cerrada de incremento de `CLmax` por ranura.
  Da la tendencia cualitativa (Fig. 6.26) y el techo numérico (`≈3` sin soplado, `≈7` con soplado).
  **No inventar coeficientes por ranura**: ver §7 NO OBSERVADO.
- **Efecto Reynolds en alta sustentación** [§6.9, p.336]: para el perfil militar medido, `Clmax` es
  **esencialmente constante por encima de `Re = 9×10⁶`** ⇒ ensayar a `Re ≥ 9×10⁶` basta para
  simular el `Clmax` de vuelo. Debajo de eso el dato NO escala.
- **Advertencia de linealidad** [§6.9, p.335]: con borde de ataque afilado + burbuja de separación,
  la curva de sustentación **no tiene tramo lineal** y el `Clmax` puede ocurrir a **α = 2°**.

### 2.3 Lifting-line de Prandtl (cap. 7, §7.3)

**Supuestos:** cada sección se comporta como perfil 2D aislado (Prandtl-Tietjens); la estela es una
lámina infinitamente delgada y PLANA; la línea sustentadora va en el cuarto de cuerda; los
torbellinos libres se extienden a infinito.

```
l(y)  = ρ∞ U∞ Γ(y)                                     (7.1)   Kutta-Joukowski
w(y1) = (1/4π) ∫[−s..+s] (dΓ/dy)/(y − y1) dy           (7.2)   downwash
ε     ≈ −w/U∞                                          (7.3)
αe    = α − ε                                          (7.4)
dv(y) = −ρ∞ w(y) Γ(y)                                  (7.5)   resistencia inducida local
```

**Caso elíptico** `Γ(y) = Γ0 √(1 − (y/s)²)`:
```
w      = −Γ0/(4s)        (CONSTANTE en toda la envergadura)   (7.10)
L      = (π/4) b ρ∞ U∞ Γ0                                      (7.11)
Γ0     = 2 CL U∞ S/(π b)                                       (7.13)
ε      = CL/(π AR)                                             (7.14)
CDv    = CL²/(π AR)                                            (7.17)
```

**Serie general (ecuación del monoplano)** [ec. 7.21, 7.26]:
```
y/s = −cos φ
Γ(φ) = 4 s U∞ Σ An sin(nφ)
m = c(φ) a0 / (8 s)
m (α − α0l) sin φ = Σ An sin(nφ) [ m·n + sin φ ]
```
Para carga simétrica solo sobreviven los términos IMPARES (n = 1,3,5,7…).

```
CL  = A1 π AR                                                  (7.27)
CDv = π AR Σ n An²  = (CL²/πAR)(1+δ) = CL²/(π e AR)            (7.28, 7.29)
δ   = 3(A3/A1)² + 5(A5/A1)² + 7(A7/A1)² + …      e = 1/(1+δ)
a   = a0 / [ 1 + (a0/πAR)(1+τ) ]                               (7.30)
Cl(φ)/CL para trapecio: Cl(φ) = 2 AR (1+λ) (cr/c(φ)) Σ A(2n−1) sin[(2n−1)φ]   (7.33)
```

**Rango de validez explícito [p.346–347]:** una sola superficie sustentadora, **sin flecha, sin
diedro, `AR ≥ 4.0`, α relativamente bajo**, y hasta que la capa límite se vuelva importante
(separación). La fricción NUNCA está incluida: hay que sumarla aparte (§5.4.6 del libro, fuera de
este bloque). En las figuras 7.8 y 7.19 la diferencia CONSTANTE entre medido y teórico es
exactamente la fricción.

**Qué se rompe fuera:** con flecha, la hipótesis de "cada franja es 2D" falla porque hay flujo
transversal grande; con `AR < 4` el downwash deja de ser localmente 2D. Bertin señala [p.373] que
la lifting-line de Phillips y Snyder (2000) **ES en realidad un vortex-lattice con un solo elemento
en cuerda**: ese es el puente natural entre los dos módulos del software.

**Extensión empírica declarada por el libro** [p.373–375]: Anderson et al. (1980) meten la
**pendiente de sustentación MEDIDA** en lugar de `a0` y así llevan la lifting-line hasta y más allá
de la pérdida (borde de ataque "drooped", cuerda extendida ~10% en un tramo de la envergadura).
Reconocen que el mayor compromiso es usar datos 2D para un flujo 3D separado.

### 2.4 VORTEX-LATTICE — la especificación completa (cap. 7, §7.5, p.379–399)

> Esta subsección está escrita para que un programador la implemente sin volver a abrir el libro.

#### 2.4.1 Qué es

La vorticidad ligada continua sobre el ala se aproxima por un número finito de **vórtices de
herradura** discretos, colocados en paneles trapezoidales. Cada herradura tiene tres tramos:
un **vórtice ligado** (segmento finito A→B) y **dos vórtices libres** semi-infinitos que salen de
A y de B hacia aguas abajo.

#### 2.4.2 Reglas de colocación (las tres que hay que respetar)

1. **El vórtice ligado va en el CUARTO DE CUERDA del panel**, alineado con la flecha local del panel
   [p.380].
2. **El punto de control va en la línea de TRES CUARTOS de cuerda del panel, centrado en la
   envergadura del panel**, a media distancia entre las dos patas libres [p.381].
3. **Los vórtices libres se toman rectos y paralelos al eje x del vehículo** (no al viento) hasta
   infinito [p.380]. Bertin justifica esta elección: los coeficientes de influencia salen más
   simples y **NO cambian cuando cambia el ángulo de ataque** — lo que significa que la matriz se
   construye UNA vez y se reusa para todo el barrido de α. Es la clave del rendimiento en el
   navegador.

**Por qué 1/4 y 3/4** [p.381–382, deducción explícita]: si se pone un filamento de circulación `Γ`
en `c/4` y se pide que el flujo sea tangente a distancia `r` de él,
```
α ≈ ΔU/U∞ = Γ/(2π r U∞)
```
y de `l = ½ρ∞U∞²c·2πα = ρ∞U∞Γ` sale `π ρ∞ U∞² c · Γ/(2π r U∞) = ρ∞ U∞ Γ` ⇒ **`r = c/2`**, es
decir, el punto donde se impone la tangencia queda en `c/4 + c/2 = 3c/4`. Esta pareja 1/4–3/4
reproduce exactamente la teoría de perfil delgado con UN solo panel en cuerda.

#### 2.4.3 Ley de Biot-Savart y el segmento finito

```
dV = Γn (dl × r) / (4π r³)                                     (7.35)
|dV| = Γn sinθ dl / (4π r²)                                    (7.36)
V   = Γn (cos θ1 − cos θ2) / (4π rp)                           (7.37)
```
Con `r0 = AB`, `r1 = AC`, `r2 = BC` (C = punto donde se evalúa):
```
rp = |r1 × r2| / r0 ,   cos θ1 = (r0·r1)/(r0 r1) ,   cos θ2 = (r0·r2)/(r0 r2)
```
y la forma vectorial que se programa directo [**ec. 7.38, p.383**]:
```
V = (Γn/4π) · [ (r1 × r2) / |r1 × r2|² ] · [ r0 · ( r1/r1 − r2/r2 ) ]
```
Comprobación: si el filamento es infinito en ambos sentidos, `θ1=0`, `θ2=π` ⇒ `V = Γn/(2π rp)`.

#### 2.4.4 Las tres contribuciones de una herradura (caso general 3D)

Con `A = (x1n, y1n, z1n)`, `B = (x2n, y2n, z2n)`, punto `C = (x, y, z)`:

**(a) Vórtice ligado A→B** [ec. 7.39a]: `V_AB = (Γn/4π) {Fac1AB}{Fac2AB}`, donde

```
{Fac1AB} = { [ (y−y1n)(z−z2n) − (y−y2n)(z−z1n) ] î
           − [ (x−x1n)(z−z2n) − (x−x2n)(z−z1n) ] ĵ
           + [ (x−x1n)(y−y2n) − (x−x2n)(y−y1n) ] k̂ }
         / { [ (y−y1n)(z−z2n) − (y−y2n)(z−z1n) ]²
           + [ (x−x1n)(z−z2n) − (x−x2n)(z−z1n) ]²
           + [ (x−x1n)(y−y2n) − (x−x2n)(y−y1n) ]² }

{Fac2AB} = [ (x2n−x1n)(x−x1n) + (y2n−y1n)(y−y1n) + (z2n−z1n)(z−z1n) ]
           / √[ (x−x1n)² + (y−y1n)² + (z−z1n)² ]
         − [ (x2n−x1n)(x−x2n) + (y2n−y1n)(y−y2n) + (z2n−z1n)(z−z2n) ]
           / √[ (x−x2n)² + (y−y2n)² + (z−z2n)² ]
```

**(b) Pata libre desde A hasta ∞ (+x)** [ec. 7.39b]:
```
V_A∞ = (Γn/4π) · { [ (z−z1n) ĵ + (y1n−y) k̂ ] / [ (z−z1n)² + (y1n−y)² ] }
       · [ 1 + (x−x1n)/√( (x−x1n)² + (y−y1n)² + (z−z1n)² ) ]
```
(Deducción del libro: se calcula primero el segmento finito D→A con `r0 = DA = (x1n−x3n)î` y se
hace `x3n → ∞`; el primer término de `{Fac2AD}` tiende a 1.0.)

**(c) Pata libre desde B hasta ∞ (+x)** [ec. 7.39c] — igual pero con **signo menos** y el índice 2:
```
V_B∞ = −(Γn/4π) · { [ (z−z2n) ĵ + (y2n−y) k̂ ] / [ (z−z2n)² + (y2n−y)² ] }
       · [ 1 + (x−x2n)/√( (x−x2n)² + (y−y2n)² + (z−z2n)² ) ]
```

Superposición: `V_{m,n} = C_{m,n} Γn` (ec. 7.40) y `V_m = Σ_{n=1..2N} C_{m,n} Γn` (ec. 7.41),
con `2N` = número total de paneles (las dos semialas).

#### 2.4.5 Condición de contorno

General, con diedro `φ` y pendiente de la línea de combadura `δ = arctan(dz/dx)|_m` [ec. 7.42]:
```
−u_m sinδ cosφ − v_m cosδ sinφ + w_m cosφ cosδ + U∞ sin(α−δ) cosφ = 0
```
Aproximación linealizada [ec. 7.43], consistente con la teoría lineal:
```
w_m − v_m tanφ + U∞ [ α − (dz/dx)_m ] = 0
```

#### 2.4.6 Ala PLANA (el caso que se programa primero)

Con `z1n = z2n = 0` y `zm = 0`, **las tres contribuciones son puramente verticales (downwash)** y se
funden en una sola expresión escalar [**ec. 7.45, p.388**]:

```
w_{m,n} = (Γn/4π) · {
    1 / [ (xm−x1n)(ym−y2n) − (xm−x2n)(ym−y1n) ]
  · [   ( (x2n−x1n)(xm−x1n) + (y2n−y1n)(ym−y1n) ) / √( (xm−x1n)² + (ym−y1n)² )
      − ( (x2n−x1n)(xm−x2n) + (y2n−y1n)(ym−y2n) ) / √( (xm−x2n)² + (ym−y2n)² ) ]
  + [ 1/(y1n − ym) ] · [ 1 + (xm−x1n)/√( (xm−x1n)² + (ym−y1n)² ) ]
  − [ 1/(y2n − ym) ] · [ 1 + (xm−x2n)/√( (xm−x2n)² + (ym−y2n)² ) ]
}
```
Los tres renglones son, en orden: **vórtice ligado**, **pata que sale de A**, **pata que sale de B**.

Sistema:
```
w_m = Σ_{n=1..2N} w_{m,n}                                      (7.46)
w_m + U∞ sin α = 0     ⇒     w_m = −U∞ α   (α en radianes)     (7.47, 7.48)
```

#### 2.4.7 Simetría (cómo se corre solo media ala)

Si no hay derrape, el flujo es simétrico respecto al plano `y = 0`. Se resuelven **solo las N
incógnitas de la semiala derecha (estribor)** y se imponen las condiciones de tangencia **solo en
sus puntos de control**, PERO hay que sumar la influencia de las herraduras imagen de la semiala
izquierda [p.389]:
```
w_m = Σ_{n=1..N} w_{m,n,estribor} + Σ_{n=1..N} w_{m,n,babor}
```
**Regla de imagen (crítica, y el libro la muestra por sus números, no por una frase):** la herradura
imagen del panel n tiene
```
A' = ( x2n ,  −y2n , z2n )        B' = ( x1n ,  −y1n , z1n )
```
es decir, **se refleja en y Y SE INTERCAMBIAN los extremos**, para que el vector de vorticidad siga
apuntando en el sentido de `y` creciente. Verificado contra el cálculo de `w_{1,1p}` del libro
(ver FIXTURE `bertin-ej-7.4-imagen`). Si se refleja sin intercambiar, el signo del vórtice ligado
sale invertido y el resultado es basura.

#### 2.4.8 Cargas

```
ln  = ρ∞ U∞ Γn                                                  (7.50)
L   = 2 ∫[0..b/2] ρ∞ U∞ Γ(y) dy  ≈  2 ρ∞ U∞ Σ Γn Δyn            (7.51a, 7.51b)
Cl(panel n) = 2 Γ / (U∞ c_av)                                   (7.52)
```
Con varios paneles en cuerda hay que **sumar los `Γ` de la tira en cuerda** antes de formar `Cl`:
```
Cl·c / c_av = Σ_{j=1..Jmax} ( l / (q∞ c_av) )_j                 (7.53)
CL = ∫[0..1] (Cl c/c_av) d(2y/b)                                (7.54)
```
donde `c_av = S/b`.

**Advertencia de validez del libro [p.389]:** aplicar la condición de no penetración en **un solo
punto en cuerda** es razonable para un ala plana; **NO es adecuado para un ala con combadura ni con
flaps deflectados**. Ahí hacen falta varios paneles en cuerda.

#### 2.4.9 Resistencia inducida desde el VLM (método de Multhopp / Kalman)

```
CDv = (1/S) ∫[−b/2..b/2] Cl c αi dy                              (7.55)
αi  = −(1/8π) ∫[−b/2..b/2] (Cl c) / (y−η)² dη                    (7.56)
```
para carga simétrica [ec. 7.57]:
```
αi = −(1/8π) ∫[0..b/2] [ Cl c/(y−η)² + Cl c/(y+η)² ] dη
```
Discretización: se toma la franja m de semiancho `em` centrada en `η = ym` y se ajusta una
**parábola** [ec. 7.58]:
```
(Cl c / CL c)_m = am η² + bm η + cm
```
con
```
dmi = em + e(m−1)        dmo = em + e(m+1)
cm = (Cl c/CL c)_m − am ηm² − bm ηm
am = [ dmi(Cl c/CL c)_{m+1} − (dmi+dmo)(Cl c/CL c)_m + dmo(Cl c/CL c)_{m−1} ]
     / [ dmi dmo (dmi+dmo) ]
bm = { dmo(2ηm − dmo)[ (Cl c/CL c)_m − (Cl c/CL c)_{m−1} ]
     − dmi(2ηm − dmi)[ (Cl c/CL c)_{m+1} − (Cl c/CL c)_m ] } / [ dmi dmo (dmi+dmo) ]
```
**Condiciones de frontera de la discretización:** en la RAÍZ se toma
`(Cl c/CL c)_{m−1} = (Cl c/CL c)_m` y `e_{m−1} = em`; en la PUNTA se toma
`(Cl c/CL c)_{m+1} = 0` y `e_{m+1} = 0`.

Forma numérica de la incidencia inducida [**ec. 7.59**]:
```
αi(y)/CL = −(1/4π) Σ_{m=1..N} {
     [ y²(ym+em) am + y² bm + (ym+em) cm ] / [ y² − (ym+em)² ]
   − [ y²(ym−em) am + y² bm + (ym−em) cm ] / [ y² − (ym−em)² ]
   + ½ y am ln{ [ (y−em)² − ym² ] / [ (y+em)² − ym² ] }
   + ¼ bm ln{ [ y² − (ym+em)² ] / [ y² − (ym−em)² ] }
   + 2 em am }
```
Luego se ajusta otra parábola al producto `(Cl c/CL c)(αi/CL) = an y² + bn y + cn` [ec. 7.60] y se
integra con una **generalización de la regla de Simpson** [**ec. 7.61**]:
```
CDv/CL² = (4/AR) Σ_{n=1..N} en { [ yn² + (1/3) en² ] an + yn bn + cn }
```

**Nota de validez [p.399]:** en plantas con diedro NO nulo la sustentación a lo largo de los
vórtices ligados en cuerda VARÍA de borde de ataque a borde de salida por la variación longitudinal
del sidewash y del `Γ` local; para momentos de cabeceo y balance de alas generales Bertin remite a
Margason y Lamar (1971) — **fuera de este libro**.

### 2.5 Alas delta y strakes (cap. 7, §7.7–7.8)

```
CL = Kp sinα cos²α + Kv sin²α cosα                              (7.62)
ΔCD = CD − CD0 = CL tanα        (placa plana: resultante normal) (7.63)
CD = CD0 + Kp sin²α cosα + Kv sin³α                             (7.64)
```
`Kp` = pendiente de fuerza normal por flujo potencial; `Kv` se estima de la succión de borde de
ataque potencial. Ambos se leen de las Figs. 7.43 y 7.44 en función de `AR`, `ΛLE` y `a/c`
(ver §7 NO OBSERVADO).

**Rango de validez explícito [p.404–407]:** alas delgadas **sin combadura ni torsión**, con borde de
ataque **suficientemente afilado para fijar la separación en el borde**. La correlación se cae
cuando el flujo deja de readherirse sobre el extradós: bueno hasta **α > 20° para AR = 1.0 y 1.5**;
para **AR = 2.0 hay desviaciones significativas arriba de 15°**.

**Qué rompe el modelo:** bordes de ataque redondeados (la separación se mete hacia adentro) y
espesor (Peckham 1958: **más espesor ⇒ MENOS sustentación neta**). Y sobre todo el **vortex
breakdown**: al crecer α el punto de estallido avanza hacia el ápice, sube la presión en el extradós
bajo los vórtices, y eso ES la pérdida del delta. En movimiento de encabritado la posición del
estallido va corriente abajo de su valor estacionario ⇒ **sobreimpulso de sustentación** cuya
magnitud depende de la flecha de borde de ataque.

**Trayectoria del vórtice [Visbal 1995, p.413]:** el vórtice primario sigue una trayectoria
esencialmente RECTA; su flecha `Λcore` varía muy poco con α y es **apenas mayor que `ΛLE`**; el
ángulo respecto a la superficie `αcore` **crece linealmente con α** hasta que el vórtice llega al
borde de salida.

### 2.6 Compresible (cap. 8) — lo que el software necesita

```
Tt/T   = 1 + ((γ−1)/2) M²                                      (8.34)
pt1/p  = [1 + ((γ−1)/2)M²]^{γ/(γ−1)}                           (8.36)
ρt1/ρ  = [1 + ((γ−1)/2)M²]^{1/(γ−1)}                           (8.37)
A*/A   = M [ (2/(γ+1))(1 + ((γ−1)/2)M²) ]^{−(γ+1)/(2(γ−1))}    (8.43)
q      = (γ/2) p M²                                            (8.62)
Cp     = (2/(γM∞²)) (p/p∞ − 1)                                 (Concept Box p.462)
```
**Rango de validez de Bernoulli [Fig. 8.6, p.446–447]:** expandiendo `pt1/p` en potencias de `M²`,
`pt1/p = 1 + (γ/2)M² + O(M⁴)`. Reteniendo solo `M²` se recupera `pt1 = p + ρU²/2`. Error **<1% para
M ≤ 0.5**, **<0.15% para M ≤ 0.3**. Arriba de `M = 0.5` **la presión total ya no es la suma de la
estática y la dinámica**.

**Prandtl-Meyer** [ec. 8.60]:
```
ν = √((γ+1)/(γ−1)) · arctan[ √((γ−1)/(γ+1)) (M²−1) ] − arctan √(M²−1)
ν − θ = R   (característica izquierda / onda de Mach que corre a la izquierda)
ν + θ = Q   (característica derecha)
μ = arcsin(1/M)
```
Solo se usa cuando el giro es lo bastante suave para no generar choques (flujo isentrópico) y solo
en **flujo supersónico**: una característica **no existe en flujo subsónico**.

**Choque oblicuo** [ecs. 8.73–8.79]:
```
cot δ = tanθ [ (γ+1)M1² / (2(M1² sin²θ − 1)) − 1 ]
p2/p1 = [ 2γ M1² sin²θ − (γ−1) ] / (γ+1)
ρ2/ρ1 = (γ+1)M1² sin²θ / [ (γ−1)M1² sin²θ + 2 ]
T2/T1 = [2γM1²sin²θ − (γ−1)][(γ−1)M1²sin²θ + 2] / [ (γ+1)² M1² sin²θ ]
M2²   = [ (γ−1)M1²sin²θ + 2 ] / { [2γM1²sin²θ − (γ−1)] sin²(θ−δ) }
pt2/pt1 = e^{−Δs/R}
Cp    = 4(M1² sin²θ − 1) / [ (γ+1) M1² ]
u1    = U1 sin θ
```
**Trampas declaradas por el libro:**
- Para cada δ hay **dos** θ. En aerodinámica externa se toma la **débil**; la **fuerte** aparece si
  la presión aguas abajo es alta (túneles, tomas de aire, conductos).
- Si δ supera el máximo, el choque **se desprende** (ejemplo del libro: a `M=3.0` el máximo es
  **34°**; a 35° ya hay bow shock curvo con campo mixto sub/supersónico detrás).
- **La tabla 8.5 (choque normal) SÍ se puede usar para el oblicuo** sustituyendo `M1` por
  `M1 sinθ` en la primera columna — **pero NO para sacar `M2`**, porque lo que se conserva es la
  componente TANGENCIAL DE LA VELOCIDAD, no del Mach. Para `M2` hay que reconstruir
  `U2 = √(u2² + v2²)` usando `T2` para el nuevo `a`.

**Fricción compresible (Spalding-Chi, 1964)** [p.478]:
```
Cf = Cf( Rex , Me , Tw/Te )                                     (8.80)
```
Procedimiento: con `Me` y `Tw/Te` se leen `Fc` (Tabla 8.6) y `FRe` (Tabla 8.7); se forma el producto
`FRe·Rex`; con él se lee `Fc·Cf` (Tabla 8.8); se despeja `Cf`. Alternativa citada: **Van Driest
(1956)**.

**Interacción choque/capa-límite [§8.8]:** el salto de presión se propaga aguas ARRIBA por la parte
SUBSÓNICA de la capa límite. Laminar ⇒ subcapa subsónica gruesa ⇒ interacción larga, estructura de
choque en λ, separación fácil. Turbulenta ⇒ subcapa subsónica delgada y partículas con más cantidad
de movimiento ⇒ interacción **mucho más corta** y hace falta **mucho más salto de presión** para
separar. El **máximo calentamiento** está justo donde la capa límite readhiere y su espesor es
mínimo.

### 2.7 Compresible subsónico y transónico (cap. 9)

**Potencial completo (no lineal, válido en transónico)** [ec. 9.4b]:
```
(1 − Φx²/a²)Φxx + (1 − Φy²/a²)Φyy + (1 − Φz²/a²)Φzz
  − 2(ΦxΦy/a²)Φxy − 2(ΦyΦz/a²)Φyz − 2(ΦzΦx/a²)Φzx = 0
```
**Linealizado (Prandtl-Glauert)** [ec. 9.13]: `(1 − M∞²)φxx + φyy + φzz = 0`.

**Correcciones de compresibilidad** (con `β = √(1 − M∞²)`):
```
Prandtl-Glauert :  Cp = Cp,inc / β
Karman-Tsien    :  Cp = Cp,inc / [ β + (M∞²/(1+β)) (Cp,inc/2) ]                (9.17)
Laitone         :  Cp = Cp,inc / { β + (M∞²/β)[1 + ((γ−1)/2)M∞²](Cp,inc/2) }   (9.18)
Lees (esbeltos) :  Cp = Cp,inc / (1 − M∞²)^{3/2}                               (9.19)
```
**Rango y qué se rompe:** las tres 2D valen mientras el flujo sea **completamente subsónico** y el
cuerpo delgado a α pequeño. Bertin advierte, citando a Jones y Cohen (1960), que Prandtl-Glauert
**subestima** el efecto de compresibilidad en perfiles de espesor finito, y que al acercarse
`M∞ → 1` el factor `1/β → ∞` hace que las perturbaciones diverjan ⇒ **las desviaciones respecto a
la realidad crecen conforme M∞ → 1**, y cuánto depende del espesor y del ángulo de ataque.
Para cuerpos esbeltos 3D, las correcciones 2D **no aplican**: hay que usar Lees, que es "una
desviación significativa" respecto a las 2D.

**Presión crítica y Mach crítico** [ecs. 9.20, 9.21]:
```
Cp,crit = (2/(γM∞²)) { [ (1 + ((γ−1)/2)M∞²) / (1 + (γ−1)/2) ]^{γ/(γ−1)} − 1 }
```
Es una relación **puramente isentrópica**: no depende de la geometría. `Mcrit` es la raíz de
`Cp,corregido(M∞) = Cp,crit(M∞)`. **Riesgo declarado:** para perfiles delgados con `Cp,min` bajo, la
dispersión entre las tres correcciones es **grande** (Fig. 9.8) ⇒ el software debe reportar una
banda, no un número.

**Mach de divergencia de resistencia** [ec. 9.22, Shevell 1988]:
```
Mdd = Mcrit [ 1.02 + 0.08 (1 − cos Λ) ]
```
Base declarada: pendiente `dCD/dM∞ = 0.05`. Bertin advierte explícitamente que **no hay método
analítico confiable** y que cada fabricante usa su propia definición de la pendiente (0.03, 0.05 o
0.10) o un porcentaje sobre `Mcrit` (2%–4%).

**Ecuaciones transónicas de pequeñas perturbaciones** (para referencia histórica y para saber por
qué no se usan hoy):
```
(1 − M∞²)φxx + φyy + φzz = K φx φxx ,  K = (2/U∞)(1 + ((γ−1)/2)M∞²) M∞²    (9.23)
(1 − M∞²)φxx + φyy + φzz = ∂/∂x[ ((γ+1)/2) M∞ⁿ φx² ]                        (9.24)
(1 − M∞²)φxx + φyy + φzz − (γ+1)M∞ⁿφxφxx
      = 2M∞²φyφxy + (γ−1)M∞²φxφyy + ((γ+1)/2)M∞²φx²φxx                       (9.25)
```
**Trampa numérica declarada [p.545–546]:** el término `(1 − M∞²)` **cambia de signo** al pasar de
subsónico a supersónico ⇒ la EDP **cambia de tipo, de elíptica a hiperbólica**, y hace falta un
esquema distinto según las condiciones LOCALES (Murman y Cole 1971). La ec. 9.24 lleva un exponente
`n` que Bailey y Ballhaus (1975) admiten que "puede ajustarse para aproximar mejor el coeficiente
de presión sónico exacto" ⇒ **la ecuación no es única**. Los términos cruzados `φyφxy` y `φxφyy` de
la ec. 9.25 son los que permiten representar choques MUY barridos; sin ellos, en alas con flecha
moderada a grande el choque de raíz se propaga demasiado lejos en la envergadura (discrepancia
mostrada en la Fig. 9.35: el cálculo lleva el choque hasta `2y/b = 0.60`, el experimento lo disipa
antes).

**Regla del área** [§9.4.1–9.4.2]: cita literal de Whitcomb (1956), p.531:
> *"near the speed of sound, the zero-lift drag rise of a low-aspect-ratio thin-wing/body
> combination is primarily dependent on the axial development of the cross-sectional areas normal
> to the air stream."*

Segundo orden, cita literal de Whitcomb (1976), p.538:
> *"For lifting conditions at near sonic speeds there is a substantial local region of supercritical
> flow above the wing surface which results in local expansions of the streamtube areas... this
> expansion is equivalent to an increase in the physical thickness of the wing. To compensate for
> this effect the fuselage indentation required to eliminate the far-field effects of the wing must
> be increased."*

Ganancia declarada: **+0.02 en el Mach de divergencia** respecto a la indentación basada en
sustentación nula.

Corrección transónica de Carlsen (1995), cita literal p.540:
> *"In transonic flow, dissipation of disturbances occurs in the subsonic regions and the
> stream-tube areas are no longer invariant. As a result of this dissipation, it is erroneous to
> subtract the total wing volume from the fuselage."*

Método: aplicar una **función de peso** al integrar el área del ala cortada por cada plano de Mach 1
— el área cerca de la punta pesa MENOS que la de la raíz. Resultado declarado: se obtiene el mismo
retraso de la divergencia modificando el avión **solo el 60%** de lo que prescribe la regla sónica
clásica.

---

## 3. FIXTURES DE TEST

Los 11 ejemplos numéricos resueltos del bloque, más los datos tabulados que sirven de prueba.
**Tolerancia general: 1%** salvo donde se indique otra (el libro redondea a 4 cifras y varias
entradas se leen de gráficas).

---

### FIXTURE bertin-ej-6.2 — Perfil combado NACA 2412, teoría de perfil delgado [§6.5, p.311–312]

```
entradas:
  línea de combadura NACA 2412 (combadura máx. 2% de c en x = 0.4c):
    0 ≤ x/c ≤ 0.4 :  z/c = 0.125 [ 0.8(x/c) − (x/c)² ]
    0.4 ≤ x/c ≤ 1 :  z/c = 0.0555 [ 0.2 + 0.8(x/c) − (x/c)² ]
  pendientes en coordenada θ (con ξ = (c/2)(1−cos θ)):
    (dz/dx)_fore = 0.1 − 0.25(x/c) = 0.125 cos θ − 0.025
    (dz/dx)_aft  = 0.0444 − 0.1110(x/c) = 0.0555 cos θ − 0.0111
  límite de integración: x = 0.4c  ⇒  θ = 78.463° = 1.3694 rad
salida esperada:
  A0    = α − 0.004517        (α en radianes)
  A1    = 0.08146
  A2    = 0.01387
  Cl    = 2πα + 0.2297
  α0l   = −0.2297/(2π) rad = −0.036557 rad = −2.095°
  Cmac  = Cmc/4 = (π/4)(A2 − A1) = −0.05309
  xac(teórico) = 0.25 c
tolerancia: 1% en A1, A2, Cl, Cmac ; 0.01° en α0l
contraste experimental (Abbott y von Doenhoff 1949, para calibrar el error del MODELO, no del código):
  Cla medido : 6.0 /rad (NACA 2412, −4.5% vs 2π) ; 5.9 /rad (NACA 2418, −6.1%)
  Cmac medido: −0.045 (2412) ; −0.050 (2418)   vs   −0.053 teórico
  xac medido : 0.239c–0.247c   vs   0.250c teórico
```
**Valor para el software:** es la prueba de aceptación del módulo 2D completo (integración de la
línea de combadura → A0,A1,A2 → Cl, α0l, Cmac). Si tu integrador numérico da `A1 = 0.08146` y
`A2 = 0.01387` con una línea de combadura definida por tramos con un quiebre en 0.4c, el módulo
está bien.

---

### FIXTURE bertin-ej-6.1 — NACA 0009 simétrico [§6.4–6.5, p.305–306]

```
entradas: perfil simétrico NACA 0009 (t = 0.09c en x = 0.3c), flujo incompresible
salida esperada (teoría): Cl = 2πα ; Cla = 2π /rad = 0.1097 /deg ; Cmc/4 = 0 ; xcp = 0.25c
rango de validez verificado por el libro: acuerdo EXCELENTE con datos hasta α = 12°
tolerancia: cualitativa/estructural — este fixture prueba el CASO LÍMITE simétrico del ej. 6.2
             (A0 = α, A1 = A2 = ... = 0)
```

---

### FIXTURE bertin-hl-trade — Factores de intercambio de alta sustentación [§6.8, p.328, Meredith 1993]

Cita literal (requisito de negocio dicho en prosa):
> *"A 0.10 increase in lift coefficient at constant angle of attack is equivalent to reducing the
> approach attitude by about one degree. For a given aft body-to-ground clearance angle, the landing
> gear may be shortened resulting in a weight savings of 1400 lb. A 1.5% increase in the maximum lift
> coefficient is equivalent to a 6600 lb increase in payload at a fixed approach speed. A 1% increase
> in take-off L/D is equivalent to a 2800 lb increase in payload or a 150 nm increase in range."*

```
configuración de referencia: transporte grande bimotor genérico
  ΔCL = +0.10 a α constante   →  −1° de actitud de aproximación  →  −1400 lb (tren más corto)
  ΔCLmax = +1.5%              →  +6600 lb de carga de pago a velocidad de aproximación fija
  Δ(L/D)despegue = +1%        →  +2800 lb de carga de pago  ó  +150 nm de alcance
tolerancia: exactos (son los números del cliente, no un cálculo)
techo físico [Fig. 6.26]: CLmax ≈ 3 sin soplado (con flecha típica 25°) ; hasta 7 con BLC activo
```
**Uso en el software:** convertir cualquier `ΔCLmax` calculado por el módulo de alta sustentación a
**libras de carga de pago**. Ese es el número que le importa al cliente, no el coeficiente.

---

### FIXTURE bertin-hl-militar — Perfil militar multielemento [§6.9, p.335–336, Hobbs et al. 1996]

```
entradas:
  perfil de 5.75% de espesor
  flap de borde de ataque simple (plain LE flap) : 14.07% de cuerda, δn = 34°
  flap de borde de salida ranurado simple        : 30% de cuerda,    δf = 35°
  shroud                                          : 8.78% de cuerda, δs = 22.94°
  M = 0.20 ; Rec = 15.9 × 10⁶
salida esperada:
  Clmax ≈ 2.2  a  α = 2°
  la curva de sustentación NO tiene tramo lineal (burbuja de separación de borde de ataque)
  separación total a α = 10°, con caída brusca de Cl
  Clmax esencialmente CONSTANTE para Re > 9 × 10⁶
tolerancia: 5% en Clmax (leído de figura), 1° en el α de Clmax
```
**Regla de ensayo derivada (requisito para el módulo de ensayos):** ensayar a `Re ≥ 9×10⁶` es
suficiente para simular el `Clmax` de vuelo a escala real de este flujo; por debajo, el dato NO
escala.

---

### FIXTURE bertin-hl-gaw1 — Perfil GA(W)-1 vs serie NACA 65 [§6.7, p.325, McGhee y Beasley 1973]

```
entradas: NASA GA(W)-1, 17% de espesor, morro romo, intradós con cusp cerca del borde de salida
          M∞ = 0.20 ; Rec = 6 × 10⁶
          comparación contra NACA 65₂-415 y NACA 65₃-418
          (GA(W)-1 y NACA 65₃-418 tienen el MISMO Cl de diseño = 0.40)
salida esperada:
  Clmax(GA(W)-1) ≈ +30% respecto a la serie NACA 65 a Re = 6×10⁶
  a Cl = 0.90 :  L/D ≈ 70  para GA(W)-1,  que es +50% respecto al NACA 65₃-418
tolerancia: 5% (leído de figura)
```

---

### FIXTURE bertin-liebeck — Perfil de alta sustentación de UN elemento [§6.7, p.323–324, Liebeck 1973]

```
entradas: Rec = 3 × 10⁶ ; tmax = 0.125 c ; Cl de diseño = 1.35
salida esperada:
  dCl/dα ≈ 0.12 /deg  (Fig. 6.21)
  flujo adherido hasta el borde de salida; a la pérdida, TODA la región de recuperación separa
  de golpe; bajar α menos de 0.5° readhiere instantáneamente  ⇒  SIN histéresis
  l/d alcanzable en la familia: 600  (perfiles de baja velocidad típicos: ≈ 100)
tolerancia: 5%
```

---

### FIXTURE bertin-ej-7.1 — Cessna 172, distribución elíptica [§7.3.2, p.355–356]

```
entradas:
  S = 174 ft² ; W = 2450 lb ; AR = 7.32 ; V = 100 mile/h ; día estándar a nivel del mar
  ρ∞ = 0.002377 slug/ft³
  hipótesis: vuelo recto y nivelado (L = W), distribución elíptica, TODA la sustentación en el ala
pasos intermedios verificables:
  U∞ = (100 mile/h)(5280 ft/mile)/(3600 s/h) = 146.7 ft/s
salida esperada:
  CL  = 2450 / [ ½(0.002377)(146.7)²(174) ] = 0.551
  CDv = CL²/(πAR) = (0.551)²/(7.32π) = 0.0132
tolerancia: 1%
```

---

### FIXTURE bertin-ej-7.2 — Ecuación del monoplano, colocación de 4 términos [§7.3.3, p.367–371]

**El fixture de referencia del módulo lifting-line.**

```
entradas:
  ala trapezoidal sin flecha en c/4, SIN torsión
  AR = 9.00 ; λ = ct/cr = 0.40
  perfil NACA 65-210 en toda la envergadura  ⇒  α0l = −1.2° constante
  a0 = 2π /rad (pendiente 2D supuesta)
  geometría física (Fig. 7.16): b = 7.500 ft (2.286 m), cr = 2.381 ft (0.726 m),
    ct = 0.953 ft (0.290 m), ΛLE = 2.72°, ΛTE = −8.13°
  α = 4°  (⇒ α − α0l = 5.2° = 0.090757 rad)
  4 estaciones de colocación en la semiala de babor: φ = 22.5°, 45°, 67.5°, 90°
parámetro m:
  m = a0 [1 + (λ−1) cos φ] / [ 2(1+λ) AR ] = 0.24933 (1 − 0.6 cos φ)
tabla 7.1 (valores por estación, y/s = −cos φ):
  φ=22.5° : cosφ=0.92388  sinφ=0.38268  sin3φ=0.92388  sin5φ=0.92388  sin7φ=0.38268  m=0.11112
  φ=45.0° : cosφ=0.70711  sinφ=0.70711  sin3φ=0.70711  sin5φ=−0.70711 sin7φ=−0.70711 m=0.14355
  φ=67.5° : cosφ=0.38268  sinφ=0.92388  sin3φ=−0.38268 sin5φ=−0.38268 sin7φ=0.92388  m=0.19208
  φ=90.0° : cosφ=0.00000  sinφ=1.00000  sin3φ=−1.00000 sin5φ=1.00000  sin7φ=−1.00000 m=0.24933
sistema 4×4 esperado (ec. 7.32 evaluada en las 4 estaciones, α = 4°):
  0.00386 = 0.18897 A1 + 0.66154 A3 + 0.86686 A5 + 0.44411 A7
  0.00921 = 0.60150 A1 + 0.80451 A3 − 1.00752 A5 − 1.21053 A7
  0.01611 = 1.03101 A1 − 0.57407 A3 − 0.72109 A5 + 2.09577 A7
  0.02263 = 1.24933 A1 − 1.74799 A3 + 2.24665 A5 − 2.74531 A7
salida esperada:
  A1 =  1.6459e−2
  A3 =  7.3218e−5
  A5 =  8.5787e−4
  A7 = −9.6964e−5
  CL   = A1 π AR = 0.4654
  δ    = 3(A3/A1)² + 5(A5/A1)² + 7(A7/A1)² = 0.0136
  CDv  = CL²/(πAR) · (1+δ) = 0.00766 × 1.0136 = 0.00776
tolerancia: 1% en CL y CDv ; 2% en A3, A5, A7 (son órdenes de magnitud más chicos que A1)
contraste experimental (Sivells 1947, Rec ≈ 4.4×10⁶, M ≈ 0.17, el ala real tiene 3° de diedro
  que la teoría NO modela): acuerdo "muy bueno" en CL; en CD la diferencia es CONSTANTE y es la
  fricción, que la teoría no incluye.
nota de convergencia [Fig. 7.20, Rasmussen y Smith 1999]: δ converge a ≈0.0163 con 6–8 términos;
  con 4 términos (este fixture) da 0.0136. El libro declara que "las soluciones numéricas de CL y
  CDv fueron esencialmente iguales con 4 términos que con 10" para esta geometría.
```

---

### FIXTURE bertin-ej-7.3 — Atajo con δ y τ leídos de gráfica [§7.3.5, p.371–372]

```
entradas: la MISMA ala del ej. 7.2 (AR = 9, λ = 0.4, α0l = −1.2°, a0 = 2π /rad, α = 4°)
          τ ≈ 0.06  y  δ ≈ 0.015  leídos de la Fig. 7.14
salida esperada:
  CLα = 2π / [ 1 + (2π/(9π))(1.06) ] = 5.085 /rad = 0.0888 /deg
  CL  = CLα (α − α0l) = 0.0888 (4 + 1.2) = 0.4618
  CDv = CL²/(πAR)(1+δ) = (0.4618²/(9π))(1.015) = 0.00766
tolerancia: 2% (τ y δ se LEEN de una gráfica)
comparación cruzada obligatoria: CL = 0.4618 (atajo) vs 0.4654 (colocación) → 0.8% de diferencia
```
**Valor de este fixture:** es el **modo rápido** del software para trade studies. Bertin lo
recomienda explícitamente: *"if used for conceptual design studies where trends are often the most
important result, this approach supplies reasonable results very quickly."* Ese es literalmente el
caso de uso de La Forja.

---

### FIXTURE bertin-ej-7.4 — VORTEX-LATTICE, ala en flecha 45°, retícula 4×1 [§7.5.3, p.389–394]

> **El fixture más valioso de todo el proyecto.** Valida el solver 3D contra una matriz publicada.

#### 7.4.a — Geometría

```
entradas:
  AR = 5 ; λ = 1 (cr = ct) ; perfil SIN combadura (placa plana)
  flecha 45° en TODAS las líneas (borde de ataque, c/4, 3c/4 y borde de salida, porque λ = 1)
  ⇒ S = b c  y  AR = b²/S = b/c = 5  ⇒  c = 0.2 b
  4 paneles por semiala, cada panel del borde de ataque al de salida (1 división en cuerda)
  Δyn = 0.125 b por panel
  las coordenadas se expresan en múltiplos de b: NO hace falta conocer las dimensiones físicas
TABLA 7.2 — coordenadas de la semiala de ESTRIBOR (derecha), z = 0:
  panel   xm        ym        x1n       y1n       x2n       y2n
    1     0.2125b   0.0625b   0.0500b   0.0000b   0.1750b   0.1250b
    2     0.3375b   0.1875b   0.1750b   0.1250b   0.3000b   0.2500b
    3     0.4625b   0.3125b   0.3000b   0.2500b   0.4250b   0.3750b
    4     0.5875b   0.4375b   0.4250b   0.3750b   0.5500b   0.5000b
verificación de la geometría (debe reproducirla tu generador de retícula):
  borde de ataque en y : x_LE = y  (flecha 45°)
  vórtice ligado       : x1n = y1n + 0.05b   (c/4 = 0.05b por delante... ver nota)
  punto de control     : xm = ym + 0.15b     (3c/4 = 0.15b detrás del LE en esa estación)
```

#### 7.4.b — Coeficientes de influencia individuales (los tres que el libro imprime)

**(1) `w_{1,1s}` — panel 1 de estribor sobre su propio punto de control:**
```
w_{1,1s} = (Γ1/4π) { 1/[(0.1625b)(−0.0625b) − (0.0375b)(0.0625b)]
                     · [ ((0.1250b)(0.1625b)+(0.1250b)(0.0625b)) / √((0.1625b)²+(0.0625b)²)
                       − ((0.1250b)(0.0375b)+(0.1250b)(−0.0625b)) / √((0.0375b)²+(−0.0625b)²) ]
                   + (1/−0.0625b)[ 1 + 0.1625b/√((0.1625b)²+(0.0625b)²) ]
                   − (1/ 0.0625b)[ 1 + 0.0375b/√((0.0375b)²+(−0.0625b)²) ] }
salida esperada por término:
  vórtice ligado  = −16.3533   (Γ1/4πb)
  pata desde A    = −30.9335   (Γ1/4πb)   ← la de MAYOR magnitud
  pata desde B    = −24.2319   (Γ1/4πb)
  TOTAL           = −71.5187   (Γ1/4πb)
```
**Prueba de cordura obligatoria:** los tres términos deben salir NEGATIVOS (downwash). El libro
insiste: *"You should visualize the flow induced by each segment of the horseshoe vortex to verify
that a negative value for each of the components is intuitively correct."*

**(2) `w_{1,1p}` — herradura IMAGEN del panel 1 (babor) sobre el punto de control 1 de estribor:**
```
coordenadas de la imagen:  A' = (0.1750b, −0.1250b)   B' = (0.0500b, 0.0000b)
  (nótese: reflejada en y  Y  con los extremos intercambiados)
salida esperada por término:
  vórtice ligado  =  −6.0392   (Γ1/4πb)
  pata desde A'   =  −6.3793   (Γ1/4πb)
  pata desde B'   = +30.9335   (Γ1/4πb)
  TOTAL           = +18.5150   (Γ1/4πb)      ← POSITIVO: upwash neto
```
**FIXTURE `bertin-ej-7.4-imagen`** — este es el test que atrapa el error #1 de implementación: si
reflejas la herramienta imagen **sin intercambiar A y B**, el vórtice ligado sale con signo
invertido y el total ya no da +18.5150.

**(3) `w_{2,4s}` — panel 4 de estribor sobre el punto de control 2:**
```
salida esperada por término:
  vórtice ligado = −0.60167  (Γ4/4πb)
  pata desde A   = +3.07795  (Γ4/4πb)
  pata desde B   = −1.40061  (Γ4/4πb)
  TOTAL          = +1.0757   (Γ4/4πb)
```

#### 7.4.c — Matriz completa de coeficientes de influencia

```
w1 = (1/4πb)[ (−71.5187 Γ1 + 11.2933 Γ2 +  1.0757 Γ3 + 0.3775 Γ4)_estribor
            + (+18.5150 Γ1 +  2.0504 Γ2 +  0.5887 Γ3 + 0.2659 Γ4)_babor ]
w2 = (1/4πb)[ (+20.2174 Γ1 − 71.5187 Γ2 + 11.2933 Γ3 + 1.0757 Γ4)_estribor
            + ( +3.6144 Γ1 +  1.1742 Γ2 +  0.4903 Γ3 + 0.2503 Γ4)_babor ]
w3 = (1/4πb)[ ( +3.8792 Γ1 + 20.2174 Γ2 − 71.5187 Γ3 + 11.2933 Γ4)_estribor
            + ( +1.5480 Γ1 +  0.7227 Γ2 +  0.3776 Γ3 + 0.2179 Γ4)_babor ]
w4 = (1/4πb)[ ( +1.6334 Γ1 +  3.8792 Γ2 + 20.2174 Γ3 − 71.5187 Γ4)_estribor
            + ( +0.8609 Γ1 +  0.4834 Γ2 +  0.2895 Γ3 + 0.1836 Γ4)_babor ]
```
**Invariante estructural:** la matriz de estribor es de **Toeplitz por bandas** — la diagonal vale
−71.5187 en los cuatro paneles, la primera subdiagonal 20.2174, la primera superdiagonal 11.2933.
Es consecuencia de que λ = 1 y la flecha es constante: todos los paneles son idénticos y
equiespaciados. **Es un test barato y potente de tu generador de retícula.**

#### 7.4.d — Sistema resuelto

```
Aplicando w_m = −U∞ α (ec. 7.48) y sumando estribor + babor:
  −53.0037 Γ1 + 13.3437 Γ2 +  1.6644 Γ3 +  0.6434 Γ4 = −4π b U∞ α
  +23.8318 Γ1 − 70.3445 Γ2 + 11.7836 Γ3 +  1.3260 Γ4 = −4π b U∞ α
   +5.4272 Γ1 + 20.9401 Γ2 − 71.1411 Γ3 + 11.5112 Γ4 = −4π b U∞ α
   +2.4943 Γ1 +  4.3626 Γ2 + 20.5069 Γ3 − 71.3351 Γ4 = −4π b U∞ α
solución esperada:
  Γ1 = +0.0273 (4π b U∞ α)
  Γ2 = +0.0287 (4π b U∞ α)
  Γ3 = +0.0286 (4π b U∞ α)
  Γ4 = +0.0250 (4π b U∞ α)
tolerancia: 1%
```
**Lectura física obligatoria del resultado (el software debe graficarla):** el máximo de circulación
**NO está en la raíz** (Γ2 y Γ3 > Γ1). Eso es exactamente el efecto de flecha de §7.5: el vórtice
ligado de una semiala induce downwash sobre la otra, y ese downwash es máximo en el CENTRO.

#### 7.4.e — Cargas y coeficientes

```
L  = 2 ρ∞ U∞ Σ Γn Δyn
   = 2 ρ∞ U∞ (4π b U∞ α)(0.0273+0.0287+0.0286+0.0250)(0.1250 b)
   = ρ∞ U∞² b² π α (0.1096)
CL = L/(q∞ S)  con  S = b c  y  b = 5c
   = 1.096 π α
CLα = dCL/dα = 3.443 /rad = 0.0601 /deg
tolerancia: 1%
contraste experimental: Weber y Brebner (1958), ala de cuerda y sección constantes, flecha 45°,
  AR = 5. El libro califica el acuerdo de "bueno".
distribución en la envergadura: Fig. 7.34 compara VLM 4×1 contra datos a α = 4.2°; la carga de las
  secciones EXTERIORES sale aumentada.
```

**Comparación cruzada que el software debe poder hacer sola:** `CLα = 3.443 /rad` (flecha 45°,
AR = 5) contra `CLα = 5.085 /rad` (sin flecha, AR = 9, ej. 7.3). **La flecha cuesta pendiente de
sustentación.** Ese es un trade study de una sola pantalla.

---

### FIXTURE bertin-vlm-derivaciones — Problemas del libro que sirven de test adicional [p.427–428]

Bertin deja explícitamente como problemas casos que son extensiones directas del ej. 7.4 y que
sirven como suite de regresión del solver (sin respuesta impresa, pero con el resultado CUALITATIVO
declarado):

```
P7.8  : calcular w del panel 4 inducido por la herradura del panel 1 de estribor (ej. 7.4)
P7.9  : mismo método, AR = 8, λ = 1, flecha 45°.
        RESULTADO ESPERADO CUALITATIVO: CLα mayor que con AR = 5, consistente con la Fig. 7.10.
P7.10 : AR = 5, λ = 0.5, c/4 con flecha 45°.
        ATENCIÓN: con λ ≠ 1 el borde de ataque, c/4, 3c/4 y borde de salida tienen flechas
        DISTINTAS. Es el test que revienta un generador de retícula que asume flecha única.
P7.11 : ala de flecha ADELANTE de la Fig. 7.24b: Λc/4 = −45°, AR = 3.55, λ = 0.5,
        NACA 64A112 con α0l = −0.94° y Cl,α = 6.09 /rad. Suponer ala plana para la condición
        de no penetración.
P7.12 : ala delta de AR = 1.5. ATENCIÓN: c/4 y 3c/4 tienen flechas distintas.
        Comparar contra los datos de la Fig. 7.45.
P7.4  : lifting-line 4 términos, NACA 0012, AR = 7.0, λ = 0.4/0.5/0.6/1.0 — barrido de
        estrechamiento; comparar CL, CDv y la distribución en la envergadura.
P7.5  : lifting-line 4 términos con TORSIÓN: W = 10000 N, 185 km/h, 3.0 km, S = 16.3 m²,
        AR = 7.52, λ = 0.69, NACA 2412, incidencia de raíz +1.5°, de punta −1.5°
        (washout de −3°). Es el test del soporte de torsión geométrica.
```

---

### FIXTURE bertin-ej-8.1 — Túnel supersónico de aspiración [§8.2, p.443–444]

```
entradas: aire ambiente a nivel del mar estándar como cámara de remanso
          T1 = 288.15 K ; U1 = 0 ; cp = 1004.7 J/(kg·K)
          condición límite: expansión hasta h2 = 0 (T2 = 0 K)
salida esperada: U2,max = √(2 cp T1) = √(2 × 1004.7 × 288.15) = 760.9 m/s
tolerancia: 0.1%
nota de validez declarada: el límite es FÍSICAMENTE INALCANZABLE (el vapor de agua licuaría antes);
  vale solo como cota superior conceptual.
```

---

### FIXTURE bertin-ej-8.2 — Campo de flujo del Orbiter (expansión isentrópica) [§8.2, p.444–445]

```
entradas:
  Orbiter a 3964 ft/s, 100,000 ft de altitud
  punto 2 (remanso, tras el choque de proa): p2 = 490.2 lbf/ft² ; T2 = 1716.0 °R
  punto 3: p3 = 259.0 lbf/ft²   ;   punto 4: p4 = 147.1 lbf/ft²
  los tres puntos fuera de la capa límite; se supone expansión ISENTRÓPICA de 2 a 3 a 4
  cp = 0.2404 Btu/(lbm·°R) ; a = 49.02 √T (unidades inglesas)
salida esperada:
  T3 = 1716.0 (p3/p2)^{(γ−1)/γ} = 1716.0 × 0.83337 = 1430.1 °R
  T4 = 1716.0 × 0.70899 = 1216.6 °R
  U3 = [2 cp (T2 − T3)]^0.5 = 1855.2 ft/s      M3 = 1855.2/(49.02 √1430.1) = 1.001
  U4 = 2451.9 ft/s                              M4 = 2451.9/(49.02 √1216.6) = 1.434
tolerancia: 1%
advertencia declarada: como el choque de proa es CURVO, la entropía varía a través de la capa de
  choque; la hipótesis de expansión isentrópica DEBE verificarse para cada aplicación.
```

---

### FIXTURE bertin-ej-8.3 — Perfil parabólico supersónico por Prandtl-Meyer [§8.5, p.459–462]

```
entradas:
  perfil infinitamente delgado x² = −(c²/zmax)(z − zmax) con zmax = 0.10c
  M∞ = 2.059 ; la pendiente del borde de ataque es PARALELA a la corriente libre (α efectivo = 0)
  se discretiza en 5 segmentos rectos de Δx = 0.2c con pendientes:
    a = −1.145°  b = −3.607°  c = −5.740°  d = −8.048°  e = −10.370°
  corriente libre: ν∞ = 28.000° ; p∞/pt1 = 0.11653 ; θ∞ = 0°
tabla de resultados por segmento (salida esperada):
  seg   νu        Mu       pu/pt1     νl        Ml       pl/pt1
   a    29.145°   2.1018   0.1091     26.855°   2.0173   0.1244
   b    31.607°   2.1952   0.0942     24.393°   1.9286   0.1428
   c    33.740°   2.2784   0.0827     22.260°   1.8534   0.1604
   d    36.048°   2.3713   0.0715     19.952°   1.7733   0.1813
   e    38.370°   2.4679   0.0615     17.630°   1.6940   0.2045
incrementos de fuerza (normalizados por p∞):
  seg   pl/p∞    pu/p∞    dl/p∞        dd/p∞
   a    1.070    0.939    0.0262c      0.000524c
   b    1.226    0.810    0.0832c      0.004992c
   c    1.380    0.710    0.1340c      0.01340c
   d    1.559    0.614    0.1890c      0.0264c
   e    1.759    0.529    0.2460c      0.0443c
   Σ                      0.6784c      0.0896c
salida esperada final:
  q∞ = (γ/2) p∞ M∞² = 0.7 × 4.24 × p∞ = 2.968 p∞
  Cl = 0.6784c / (0.7 × 4.24 × c) = 0.2286
  Cd = 0.0896c / (0.7 × 4.24 × c) = 0.0302
  l/d = Cl/Cd = 7.57
tolerancia: 1%
lección obligatoria del libro: L/D = 7.57 es MUY BAJO. Los perfiles de baja velocidad llegan a
  ~100.  "supersonic airfoils are much less efficient than subsonic airfoils."
regla de signos verificable: en el extradós ν − θ = R (dν = −dθ), en el intradós ν + θ = Q (dν = dθ)
```

---

### FIXTURE bertin-ej-8.4 — Cono afilado a 0° de ataque [§8.6, p.472–473]

```
entradas: semiángulo del cono δc = 10° ; M∞ = M1 = 2.0 ; γ = 1.4
salida esperada:
  θc = 31°  (ángulo del choque cónico, Fig. 8.16a)
  p2/p1 = [2γ M1² sin²θ − (γ−1)]/(γ+1) = [2.8×4×(0.5150)² − 0.4]/2.4 = 1.07   (justo tras el choque)
  pc/p1 = 1.29   (en la SUPERFICIE del cono, Fig. 8.16b)
comparación obligatoria con la CUÑA del mismo giro (10°):
  θw = 39°  ;  pw/p1 = 1.70
tolerancia: 2% (los ángulos se leen de gráfica)
lección física: el cono da choque MÁS DÉBIL y presión MENOR que la cuña del mismo giro, por el
  alivio de presión tridimensional (el flujo puede rodear el cono). La presión CRECE desde el
  choque hasta la superficie moviéndose paralelo al eje.
```

---

### FIXTURE bertin-ej-8.5 — Fricción compresible turbulenta (Spalding-Chi) [§8.7, p.479–480]

```
entradas: Me = 2.5 ; Rex = 6.142 × 10⁶ ; Tw = 3.0 Te ; placa plana, capa límite turbulenta
pasos intermedios verificables:
  Fc  = 2.056     (Tabla 8.6, interpolando entre Me=2 → 1.9836 y Me=3 → 2.1278 en Tw/Te = 3)
  FRe = 0.1729    (Tabla 8.7, entre Me=2 → 0.1512 y Me=3 → 0.1947)
  Rex·FRe = 1.062 × 10⁶
  Fc·Cf   = 0.0035   (Tabla 8.8)
salida esperada: Cf = 0.0035/2.056 = 1.70 × 10⁻³
tolerancia: 2% (hay interpolación en dos tablas)
```

---

### FIXTURE bertin-ej-8.6 — Interacción choque/choque Tipo I de Edney [§8.9, p.484–485]

```
entradas: M1 = 6.0 ; p1 = 10⁻³ atm ; δ12 = 15° (rampa superior) ; δ13 = 5° (rampa inferior)
pasos intermedios verificables:
  M2 = 4.00   Cp2 = 0.200   ⇒  p2/p1 = 1 + Cp2 γ M1²/2 = 6.04   ⇒  p2 = 6.04×10⁻³ atm
  M3 = 5.32   Cp3 = 0.043   ⇒  p3/p1 = 2.08                     ⇒  p3 = 2.08×10⁻³ atm
condición de cierre del problema (la que hace falta iterar):
  las regiones 4 y 5 deben tener LA MISMA PRESIÓN y ser PARALELAS, pero NO el mismo Mach
  (por eso nace la línea de deslizamiento / capa de cortadura)
salida esperada (iterando θf a la décima de grado):
  θf,4 = θf,5 = −9.7°   ;   δ24 = 5.3°   ;   δ35 = 14.7°
  p4 = p5 = 0.0103 atm  ;   M4 = 3.60
  reflexión en la pared (el flujo en 4 va a −9.7° y la pared a −15° ⇒ giro de 5.3°):
    M6 = 3.33 ; Cp6 = 0.062 ; p6/p4 = 1.56 ; p6 = 0.0161 atm
tolerancia: 2% en presiones, 0.1° en ángulos
advertencia declarada: la reflexión REAL en la pared NO es limpia — el choque interactúa con la
  capa límite y forma un choque normal cerca de la superficie más un choque reflejado curvo lejos
  de ella. El análisis de arriba es NO VISCOSO por decisión explícita.
```

---

### FIXTURE bertin-ej-8.7 — Simulación en túnel de un misil supersónico [§8.10, p.492–494]

```
CONDICIÓN DE VUELO:
  M∞ = 3.5 ; altitud 27,432 m (90,000 ft) ; misil de d = 20.0 cm (7.874 in), L = 10 d
  U∞ = 1050 m/s ; p∞ = 1.7379×10⁻² p_SL = 1760.9 N/m² ; T∞ = 224 K
  Re∞,d = 3.936 × 10⁵
CONDICIÓN DE TÚNEL (Vought High-Speed Wind Tunnel):
  d_wt = 4.183 cm (1.6468 in) por bloqueo admisible
  Tt = 311 K (560 °R) ; pt1 = 5.516×10⁵ N/m² (80 psia)
  ⇒ T∞ = 90.18 K (162.32 °R) ; p∞ = 7.231×10³ N/m² (1.049 psia) ; U∞ = 665 m/s
  unidad de Reynolds MÍNIMA alcanzable a M = 3.5 ≈ 9.0×10⁶ /ft
  ⇒ con d = 4.183 cm : Re∞,d = 1.235×10⁶  >  el valor de vuelo
  ⇒ para IGUALAR Re∞,d = 3.936×10⁵ haría falta d = 1.333 cm
tolerancia: 1%
LECCIÓN DE INGENIERÍA (el requisito real): en flujo supersónico el Reynolds de túnel resulta
  DEMASIADO ALTO, al revés que en subsónico donde siempre es demasiado bajo. Hay que ELEGIR qué
  parámetro igualar. Aquí Bertin elige igualar MACH y no Reynolds, porque los coeficientes de
  presión y las interacciones de choque en las superficies de mando dependen del Mach en ese rango.
  Nótese también U∞ = 665 m/s en el túnel contra 1050 m/s en vuelo con el MISMO Mach 3.5: la
  temperatura de túnel es baja (cerca de la licuefacción del oxígeno) y por eso el sonido es lento.
```

---

### FIXTURE bertin-mdd-f4c — Mach de divergencia del F-4C [§9.1.6, p.516–517]

```
entradas: Mcrit = 0.90 (leído de la curva de CD0 del F-4C, Fig. 9.9) ; flecha Λ = 40°
fórmula: Mdd = Mcrit [1.02 + 0.08(1 − cos Λ)]     (Shevell 1988, base dCD/dM∞ = 0.05)
salida esperada: Mdd = 0.90 [1.02 + 0.08(1 − 0.76604)] = 0.90 × 1.03872 = 0.935
contraste: los datos de vuelo del F-4C (35,000 ft, aceleración nivelada, W = 38,924 lb con
  4 misiles AIM-7) muestran CD0 constante en subsónico y subida marcada por encima de M ≈ 0.92
tolerancia: 1% en Mdd
advertencia declarada: la fórmula NO es teoría, es correlación empírica; distintas casas usan
  dCD/dM∞ = 0.03, 0.05 ó 0.10, o bien 2%–4% por encima de Mcrit.
```

---

### FIXTURE bertin-cpcrit — Coeficiente de presión crítico (relación puramente isentrópica) [§9.1.5, p.514]

```
fórmula: Cp,crit(M∞) = (2/(γM∞²)) { [ (1 + ((γ−1)/2)M∞²) / (1 + (γ−1)/2) ]^{γ/(γ−1)} − 1 }
valores de comprobación (γ = 1.4), evaluados de la propia fórmula por este análisis
[EXTENSIÓN DECLARADA: el libro grafica esta curva (Figs. 9.7 y 9.8) pero NO tabula los números;
 los de abajo salen de evaluar la ecuación 9.21 del propio libro, no de otra fuente]:
  M∞ = 0.20 → Cp,crit = −16.31
  M∞ = 0.50 → Cp,crit =  −2.133
  M∞ = 0.60 → Cp,crit =  −1.2946
  M∞ = 0.70 → Cp,crit =  −0.7791
  M∞ = 0.80 → Cp,crit =  −0.4346
  M∞ = 0.90 → Cp,crit =  −0.1878
  M∞ = 1.00 → Cp,crit =   0
tolerancia: 0.5%
comprobación cruzada con la figura: en la Fig. 9.7 la curva de −Cp,crit arranca cerca de 16 en
  M∞ = 0.2 y baja a 0 en M∞ = 1 — consistente con los valores de arriba.
INVARIANTE DURO (este es el test que importa, y no depende de leer ninguna gráfica):
  Cp,crit(M∞ = 1) = 0 EXACTAMENTE, y Cp,crit es MONÓTONA CRECIENTE (menos negativa) con M∞.
  La curva NO depende de ninguna geometría: es la misma para todo perfil.
método de Mcrit: raíz de   Cp,min,corregido(M∞) − Cp,crit(M∞) = 0
  usando Prandtl-Glauert, Karman-Tsien o Laitone. El libro muestra (Fig. 9.8) que para perfiles
  delgados la DISPERSIÓN entre las tres es grande y que "la respuesta correcta suele quedar entre
  Karman-Tsien y Laitone".
```

---

### FIXTURE bertin-tablas — Tablas numéricas del cap. 8 (para incrustar en el motor)

El libro imprime tablas completas que sirven de tabla de verdad para el módulo compresible.
**Puntos de anclaje verificables (γ = 1.4):**

```
Tabla 8.1 — flujo isentrópico:
  M      A/A*      p/pt1      ρ/ρt1      T/Tt
  0.50   1.3398    0.84302    0.88517    0.95238
  1.00   1.00000   0.52828    0.63394    0.83333
  2.00   1.6875    0.12780    0.23005    0.55556
  3.00   4.2346    0.02722    0.07623    0.35714
  5.00   25.000    1.89e−3    0.01134    0.16667
Tabla 8.3 — Prandtl-Meyer:
  ν=0.0°   → M=1.000  μ=90.000°
  ν=28.0°  → M=2.059  μ=29.052°       (el usado en el ej. 8.3)
  ν=50.0°  → M=3.013  μ=19.386°
  ν=100.0° → M=9.210  μ= 6.233°
Tabla 8.5 — choque NORMAL:
  M1     M2        p2/p1     ρ2/ρ1     T2/T1     pt2/pt1
  1.00   1.00000   1.00000   1.00000   1.00000   1.00000
  2.00   0.57735   4.5000    2.6666    1.6875    0.72088
  3.00   0.47519   10.333    3.8571    2.6790    0.32834
  5.00   0.41523   29.000    5.0000    5.8000    0.06172
  ∞      0.37796   ∞         6.000     ∞         0
INVARIANTES DUROS para el test:
  ρ2/ρ1 → 6.000 cuando M1 → ∞  (límite de compresión de un gas con γ = 1.4)
  M2 → 0.37796 cuando M1 → ∞
  pt2/pt1 → 0  cuando M1 → ∞ ; pt2/pt1 = 1 EXACTAMENTE en M1 = 1
Tabla 8.6/8.7 — Spalding-Chi, anclajes:
  Fc (Me=0, Tw/Te=1) = 1.0000   ;   FRe (Me=0, Tw/Te=1) = 1.0000
  (el caso incompresible adiabático debe reducirse a la identidad — test de consistencia)
tolerancia: la del redondeo impreso (5 cifras)
```

---

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero y el software NO debe decidir

Estas son las bifurcaciones donde Bertin declara explícitamente que hay compromiso, criterio o
prioridad de misión. El software debe **presentar el trade-off y pedir la decisión**, nunca
resolverla en silencio.

1. **Elección del alargamiento** [§7.12, p.426]. Cita: *"the choice of aspect ratio requires a trade
   study in which the designer may chose to emphasize one criterion at the expense of another."*
   Más `AR` = menos resistencia inducida y más pendiente de sustentación (bueno para despegue y
   aterrizaje), PERO más momento flector de raíz ⇒ **más peso**. Y la flecha añade envergadura
   estructural, o sea más peso todavía. El software calcula ambos lados; el ingeniero elige.

2. **Estrechamiento: eficiencia contra seguridad** [§7.3.5, p.365–367]. `λ ≈ 0.3–0.4` minimiza `δ` y
   `τ` (mejor aerodinámica) y baja el momento flector, pero **carga más las puntas** y acerca la
   pérdida de punta. `λ = 1` entra en pérdida por la raíz (patrón favorable) pero es peor
   aerodinámicamente. El remedio (torsión/washout) cuesta actuación en crucero. Decisión humana.

3. **Cuánta torsión (washout) meter** [§7.3.5, p.367; §7.12, p.426]. El libro dice que la torsión
   *"may be used either to reduce local loading or to prevent tip stalling"* — dos objetivos
   distintos que dan valores distintos. El software no sabe cuál pesa más en esta misión.

4. **Krueger contra slat** [§6.8, p.330, Flaig y Hilbig 1993]. Cita: el Krueger de nariz plegable
   *"generally offers greater design freedom... and thus gains a little in L/D and CLmax. But,
   trade-off studies carried out in the past for A320 and A340 have shown that this advantage for
   the Krueger flap is compromised by a more complex and heavier support structure."* Aero dice
   Krueger, estructura y mantenimiento dicen slat. **Es una decisión de programa, no de física.**

5. **Complejidad del sistema hipersustentador** [§6.8, p.328–330]. Meredith: *"the goal of the
   high-lift system designer is to design a high-lift system which minimizes these penalties
   (weight, cost, complexity) while providing the required airplane take-off and landing
   performance."* Cuántas ranuras es una decisión de costo de ciclo de vida.

6. **Geometría fija por crucero** [§6.8, p.329]. La cuerda y la distribución de espesor las FIJA el
   crucero; al diseñador de alta sustentación solo le quedan **tipo, forma, extensión en envergadura
   y reglaje**. El software debe mostrar qué está congelado y qué es libre — congelar mal es el
   error de proceso más caro.

7. **Igualar Mach o igualar Reynolds en ensayo** [§8.10, p.488 y Ej. 8.7]. Cita de Trimmer et al.
   (1986): *"Aerodynamic modeling is the art of partial simulation."* Y Matthews et al. (1985):
   *"A precisely defined test objective coupled with comprehensive pretest planning are essential
   for a successful test program."* El software **no debe** elegir el parámetro a simular.

8. **Débil o fuerte en el choque oblicuo** [§8.6, p.465]. Para cada δ hay dos soluciones. La
   selección depende de la presión aguas abajo, o sea de la instalación (túnel, toma de aire,
   conducto) o del campo externo. Es información que solo tiene el ingeniero.

9. **Definición de `Mdd`** [§9.1.6, p.517]. No hay método analítico; cada empresa usa su propia
   pendiente umbral o su propio porcentaje sobre `Mcrit`. **La Forja debe dejar configurable el
   criterio y registrar cuál se usó**, porque los números no son comparables entre criterios.

10. **Cuánto indentar por regla del área** [§9.4.2, p.539–540]. La regla clásica choca contra tren,
    sistemas, asientos y altura de cabina. Carlsen dice que basta el 60%. Cuánto se cede de cada
    lado es decisión de configuración.

11. **Flecha adelante: aero contra aeroelasticidad** [§9.4.3, p.541–542]. La FSW gana en pendiente,
    resistencia inducida, momento flector y control de alerones en pérdida; pierde en divergencia
    aeroelástica (hasta −78%) y obliga a laminado compuesto orientado. Es la decisión de programa
    completa del X-29.

12. **Geometría variable (swing-wing)** [§9.4, p.529]. Factores negativos declarados: complejidad,
    pérdida de volumen interno de combustible, y **el peso considerable de la estructura del pivote**.
    Ninguno lo puede pesar un solver aerodinámico.

13. **La aerodinámica es UNO de los parámetros, no el único** [§7.7, p.404]. Bertin lo dice
    literalmente con el caso del Me 262: la flecha exterior del ala se introdujo **para mover el
    centro de gravedad** cuando los turborreactores salieron más pesados, NO para reducir
    compresibilidad. *"many parameters enter into the design of an airplane; aerodynamics is only
    one of them. The final configuration will always reflect design priorities and trade-offs."*
    Ésta es la frase que debe encabezar la pantalla de trade studies del producto.

---

## 5. COSTO DE CÓMPUTO

| Método | § | Clasificación | Por qué |
|---|---|---|---|
| Perfil delgado: `A0,A1,A2` → `Cl, α0l, Cmac, xcp` | 6.4–6.5 | `[NAVEGADOR]` | Tres cuadraturas de una función 1D. Microsegundos. Se recalcula en cada tecleo de una cota. |
| Barrido α para curva `Cl(α)` 2D | 6.5 | `[NAVEGADOR]` | `Cl` es lineal en α: se evalúan `A0,A1,A2` UNA vez y la curva sale gratis. |
| Lifting-line elíptica (`CDv = CL²/πAR`) | 7.3.2 | `[NAVEGADOR]` | Cerrada. Instantánea. |
| Ecuación del monoplano, colocación N×N (N = 4…10) | 7.3.3 | `[NAVEGADOR]` | Matriz 4×4 a 10×10 densa. Resolución directa. **Sub-milisegundo.** Es el motor del modo interactivo. |
| Atajo con `δ` y `τ` de gráfica | 7.3.5 | `[NAVEGADOR]` | Dos evaluaciones. Requiere **tabular** las Figs. 7.14a/b (ver §7 NO OBSERVADO). |
| **Vortex-lattice, ala plana, retícula ≤ 20×10** | 7.5 | `[NAVEGADOR]` | 200 paneles ⇒ matriz 200×200 densa (~40 k coeficientes) + LU. En WASM/JS son **milisegundos**. Y la matriz **NO depende de α** (ec. 7.39 con estelas paralelas al eje x) ⇒ se factoriza una vez y todo el barrido de α es una sustitución hacia atrás. **Éste es el hallazgo que hace posible el producto.** |
| Vortex-lattice con retícula fina (≥100×20 = 2000 paneles) | 7.5 | `[PRECÓMPUTO]` | Matriz 2000×2000 ≈ 4 M entradas, LU ≈ O(n³) ≈ 10⁹ flops. Se corre una vez en iangpu por geometría y se sirve la solución. |
| Resistencia inducida por Multhopp/Kalman (ecs. 7.59, 7.61) | 7.5 | `[NAVEGADOR]` | Post-proceso `O(N²)` sobre las franjas ya resueltas. Barato. |
| Polhamus (delta, ec. 7.62–7.64) | 7.7 | `[NAVEGADOR]` | Dos funciones trigonométricas. Requiere **tabular** `Kp` y `Kv` de las Figs. 7.43/7.44. |
| Relaciones isentrópicas y de choque (caps. 8) | 8.2–8.6 | `[NAVEGADOR]` | Cerradas. La única iteración es θ(δ,M) del choque oblicuo: Newton de 3–4 pasos. |
| Prandtl-Meyer inversa (`M` dada `ν`) | 8.5 | `[NAVEGADOR]` | Newton sobre ec. 8.60, monótona ⇒ converge siempre. |
| Spalding-Chi (`Cf` compresible) | 8.7 | `[NAVEGADOR]` | Tres interpolaciones en tablas incrustadas (8.6, 8.7, 8.8). |
| Interacción Tipo I de Edney (iteración `p4 = p5`) | 8.9 | `[NAVEGADOR]` | Iteración escalar sobre `θf` a la décima de grado. Decenas de evaluaciones. |
| Correcciones de compresibilidad (PG / K-T / Laitone / Lees) | 9.1.2–9.1.3 | `[NAVEGADOR]` | Cerradas. |
| `Mcrit` (raíz de `Cp,corr = Cp,crit`) | 9.1.5 | `[NAVEGADOR]` | Bisección sobre una función monótona. Milisegundos, **incluyendo las 3 correcciones para dar la banda**. |
| `Mdd` (Shevell) | 9.1.6 | `[NAVEGADOR]` | Una línea. |
| Distribución axial de área `A(x)` (regla del área) | 9.4.1 | `[NAVEGADOR]` | Es una sección del sólido B-Rep por planos ⇒ el kernel de La Forja **ya lo sabe hacer** (ver `MoldSectionReveal` y `moldGeom()`). Recalcular a 200 estaciones es barato. |
| Regla del área de 2º orden (función de peso de Carlsen) | 9.4.2 | `[NAVEGADOR]` | Ponderación en la integral de área. Mismo costo. |
| Potencial completo transónico (ec. 9.4b) | 9.5 | `[GPU-VIVO]` | EDP no lineal de tipo MIXTO (elíptica/hiperbólica según el Mach LOCAL), relajación iterativa en malla 3D (el ejemplo del libro: 91×59×27 = 145 k nodos). No cabe en un ciclo interactivo. |
| Euler / Navier-Stokes 3D (Cobalt60, TranAir) | 9.5 | `[GPU-VIVO]` | Fuera del alcance del CAD conceptual. Solo para verificación puntual. |

**Conclusión de arquitectura:** todo lo que el cliente necesita para diseño CONCEPTUAL —
perfil 2D, lifting-line, **vortex-lattice**, compresibilidad subsónica, `Mcrit`/`Mdd`, regla del
área — cabe entero en `[NAVEGADOR]`. iangpu solo hace falta para (a) retículas VLM finas, (b)
transónico no lineal, (c) los videos. Esto encaja con la doctrina del proyecto: lo que se pueda
precomputar, se precomputa; lo demás corre a 60 fps mientras el usuario arrastra una cota.

---

## 6. ESCUELA — lecciones que salen de este bloque

Formato de cada lección: **construir → mover → ver → verificar contra el número del libro**.
Todas viven **dentro del CAD** (`forja-brep.html`): el alumno dibuja con croquis y cotas y corre un
estudio; no hay simulador de juguete aparte.

### L1 — "Tu perfil es una línea, no un bulto" (§6.3–6.5)
- **Construir:** el alumno dibuja la línea de combadura media de un NACA 2412 con dos arcos y una
  cota en `x = 0.4c` (posición de combadura máxima) y otra de `0.02c` (combadura máxima).
- **Mover:** arrastra la cota de POSICIÓN de la combadura de 0.1c a 0.9c.
- **Ver:** `α0l` se hace cada vez más negativo conforme la combadura se va hacia atrás, y **no pasa
  casi nada cuando la mueve hacia adelante**. La barra de `Cmac` crece en magnitud negativa.
- **Verificar:** con la combadura en 0.4c debe salir `α0l = −2.095°` y `Cmac = −0.05309`
  (FIXTURE `bertin-ej-6.2`).
- **Lo que aprende:** el peso `(cos θ − 1)` es cero en el borde de ataque y −2 en el de salida. Por
  eso los flaps van ATRÁS. Esto lo descubre moviendo la cota, no leyéndolo.

### L2 — "El flap es sustentación, el slat es viscosidad" (§6.7–6.8, Concept Box p.326)
- **Construir:** al mismo perfil le añade un flap simple de 0.20c y lo deflecta 25°.
- **Mover:** ángulo de flap 0°→40°; luego añade un slat de borde de ataque y lo deflecta.
- **Ver:** el flap **traslada la curva `Cl(α)` hacia la izquierda sin cambiar la pendiente**; el
  slat **no traslada nada, pero corre el punto de pérdida hacia α mayor**.
- **Verificar:** techo declarado por el libro — `CLmax ≈ 3` sin soplado, `≈7` con control de capa
  límite activo (Fig. 6.26). Si el alumno acumula dispositivos hasta pasar 3, la lección debe
  **fallar el gate** y explicar por qué.
- **Traducción a dinero:** aplicar `bertin-hl-trade` — mostrar `ΔCLmax` en **libras de carga de
  pago**, no en coeficientes.

### L3 — "El ala finita paga por sustentar" (§7.3.2)
- **Construir:** planta rectangular, cota de envergadura y cota de cuerda.
- **Mover:** solo la envergadura (área constante ⇒ mueve `AR` de 2 a 12).
- **Ver:** el downwash constante, la sustentación inclinada hacia atrás, y `CDv` cayendo como
  `1/AR`. Simultáneamente el momento flector de raíz SUBIENDO. Las dos barras en pantalla a la vez.
- **Verificar:** Cessna 172 (FIXTURE `bertin-ej-7.1`): `CL = 0.551`, `CDv = 0.0132`.
- **Lo que aprende:** por qué un planeador tiene alas largas y un caza no, y que el límite lo pone
  la estructura, no la aerodinámica.

### L4 — "Dónde entra en pérdida tu ala" (§7.3.3–7.3.5)
- **Construir:** ala trapezoidal con cotas de `AR`, `λ` y torsión de punta.
- **Mover:** `λ` de 1.0 a 0.0.
- **Ver:** la curva `Cl(y)/CL` en la envergadura cambiando de forma; una **zona roja** marcando
  dónde `Cl` local alcanza el `Clmax` de la sección; el punto rojo migrando de la raíz a la punta;
  y un aviso: "los alerones están en la zona de pérdida".
- **Mover otra vez:** meter washout de −3° y ver la zona roja regresar hacia adentro.
- **Verificar:** `AR = 9`, `λ = 0.4`, `α = 4°` debe dar `CL = 0.4654`, `CDv = 0.00776`, `δ = 0.0136`
  (FIXTURE `bertin-ej-7.2`), y el modo rápido `CL = 0.4618` (FIXTURE `bertin-ej-7.3`) con menos de
  1% de diferencia.
- **Lo que aprende:** `λ ≈ 0.3–0.4` es el óptimo de `δ` y `τ`; y que el óptimo aerodinámico y el
  patrón de pérdida seguro **no son la misma cosa**.

### L5 — "Construye el vortex-lattice con tus manos" (§7.5) — **la lección insignia**
- **Construir:** el alumno dibuja la planta del ejemplo 7.4 con cotas: `AR = 5`, `λ = 1`,
  flecha 45°. Luego elige **4 paneles**.
- **Ver primero la RETÍCULA, no los resultados:** el CAD dibuja las 4 herraduras: vórtice ligado
  sobre `c/4` (en color), patas libres saliendo paralelas a `x` (en otro color), puntos de control
  en `3c/4` (puntos sólidos), y **la imagen especular de babor en gris**.
- **Mover:** el alumno hace clic en el punto de control 1 y el CAD le muestra **los tres términos**
  de la ec. 7.45 por separado, con su signo, como tres flechas de longitud proporcional.
- **Verificar (paso a paso, no de un tiro):**
  1. `w_{1,1s}` = `(−16.3533 − 30.9335 − 24.2319) = −71.5187` en unidades `Γ1/4πb`.
  2. `w_{1,1p}` = `(−6.0392 − 6.3793 + 30.9335) = +18.5150` — y el alumno debe explicar por qué el
     TOTAL es positivo (upwash de la pata derecha de la herradura imagen).
  3. La matriz completa (diagonal −53.0037 / −70.3445 / −71.1411 / −71.3351).
  4. `Γ1..Γ4 = 0.0273, 0.0287, 0.0286, 0.0250` × `(4πbU∞α)`.
  5. `CLα = 3.443 /rad = 0.0601 /deg`.
- **Lo que aprende y no olvida:** que el máximo de `Γ` **no está en la raíz**, y que ese es el
  efecto de la flecha. Y que la flecha le costó pendiente de sustentación: 3.443 contra 5.085 del
  ala sin flecha de la L4.
- **Ejercicios de la misma lección** (FIXTURE `bertin-vlm-derivaciones`): P7.9 (AR=8), P7.10 (λ=0.5
  ⇒ **cuatro flechas distintas**), P7.11 (flecha adelante), P7.12 (delta).

### L6 — "El Concorde no es un avión con alas raras" (§7.7–7.8)
- **Construir:** ala delta con cota de `ΛLE`.
- **Mover:** α de 0° a 30°.
- **Ver:** el par de vórtices primarios naciendo del borde afilado, su trayectoria recta con
  `Λcore` apenas mayor que `ΛLE`, `αcore` creciendo LINEALMENTE con α, y la curva `CL(α)` con su
  término no lineal `Kv sin²α cosα` separándose visiblemente del término potencial.
- **Verificar:** rango de validez — bueno hasta α > 20° para `AR = 1.0` y `1.5`; **se cae por
  encima de 15° para `AR = 2.0`**. La lección debe MOSTRAR la divergencia, no esconderla.
- **Segunda parte:** añadir un strake y ver `CLmax` subir. Anclaje numérico F-5E: `+4.4%` de área
  da `+38%` de `CLmax`, y Northrop dice que **el F-5E ya está cerca del límite práctico**.

### L7 — "Cuándo deja de servir Bernoulli" (§8.3, Fig. 8.6)
- **Construir:** un tubo de corriente / una toma de presión sobre el perfil de la L1.
- **Mover:** el Mach de vuelo de 0.1 a 0.9.
- **Ver:** dos curvas de presión superpuestas (incompresible y compresible) y **la barra de error
  porcentual** entre ellas.
- **Verificar:** el error cruza el **1% en `M = 0.5`** y está por debajo de **0.15% en `M = 0.3`**.
- **Lo que aprende:** el número exacto donde su intuición de baja velocidad deja de ser legal. Y que
  arriba de 0.5 **la presión total ya no es estática más dinámica**.

### L8 — "Encuentra tu Mach crítico" (§9.1.5–9.1.6)
- **Construir:** el perfil de la L1; el estudio 2D le da `Cp,min` incompresible.
- **Mover:** el espesor `t/c` con una cota.
- **Ver:** **dos curvas en la misma gráfica** — `Cp,crit(M∞)` (que no depende de nada) y
  `Cp,min` corregido por las tres reglas (Prandtl-Glauert, Karman-Tsien, Laitone) como una **banda**.
  Donde la banda cruza la curva crítica está `Mcrit`, y el ancho de la intersección **es la
  incertidumbre honesta**.
- **Verificar:** `Cp,crit(M∞ = 1) = 0` exactamente; F-4C: `Mcrit = 0.90`, `Λ = 40°` ⇒
  `Mdd = 0.935` (FIXTURE `bertin-mdd-f4c`), contra la subida de resistencia medida en vuelo a
  `M ≈ 0.92`.
- **Lo que aprende:** que en `Mcrit` **no pasa nada**, y que lo que le cuesta combustible es `Mdd`.

### L9 — "Adelgaza el avión donde va el ala" (§9.4.1–9.4.2)
- **Construir:** fuselaje de revolución + ala en flecha + góndolas, todo con cotas, en el CAD.
- **Mover:** arrastrar las góndolas a lo largo del eje x (escalonarlas), y arrastrar la cintura del
  fuselaje.
- **Ver:** la gráfica de **`A(x)` total en vivo**, descompuesta por componente (fuselaje, ala,
  góndolas, empenaje) como en la Fig. 9.26. Los picos y escalones se ven al instante.
- **Verificar:** reproducir cualitativamente la historia del B-58 (MX-1626 → PARD → MX-1964): la
  configuración final tiene a la vez **progresión suave** y **el mínimo valor del área máxima**.
  Anclaje de Hillaker (1994): en el B-58 la regla del área **obligó** a que la cara de entrada de la
  góndola exterior empezara en el plano de salida de la interior, aunque las góndolas siamesas
  pesaran menos: *"the higher drag more than offset the lower weight."*
- **Segunda parte:** activar la corrección de 2º orden y ver que hay que indentar MÁS (+0.02 en
  `Mdd`), y luego la función de peso de Carlsen que baja el material removido al **60%**.

### L10 — "Elige qué simular" (§8.10, Ej. 8.7)
- **Construir:** el misil del ejemplo 8.7 y un modelo de túnel a escala.
- **Mover:** el diámetro del modelo.
- **Ver:** dos indicadores — `M` igualado y `Re` igualado — y que **no se pueden encender los dos**
  con el tamaño de modelo que cabe en el túnel.
- **Verificar:** con `d = 4.183 cm` sale `Re = 1.235×10⁶` (demasiado ALTO frente a `3.936×10⁵` de
  vuelo); para igualar Reynolds haría falta `d = 1.333 cm`.
- **Lo que aprende:** *"Aerodynamic modeling is the art of partial simulation"*, y que en supersónico
  el problema es al revés que en subsónico. Y el cierre honesto de Bushnell (2006): las predicciones
  escaladas de resistencia de 12 transportes comerciales estuvieron **hasta 22% bajas y 10% altas**.

### Puente con lo que ya existe en La Forja
- `src/aero/atmosfera.ts` (ISA) ya alimenta L7, L8 y L10 (necesitan `T∞`, `p∞`, `a∞`, `ρ∞`).
- `src/aero/potencial.ts` (elementos elementales) es la base directa de la lámina de vórtices de L1
  y de la ley de Biot-Savart de L5 — **el vórtice puntual 2D es el caso degenerado del filamento
  infinito**, `V = Γ/(2πr)`, que Bertin recupera de la ec. 7.37 con `θ1 = 0`, `θ2 = π`.
- `src/aero/cuna-anderson.ts` (Ej. 1.1 supersónico de Anderson) empalma con L7 y con los fixtures
  8.3/8.4/8.6 de este bloque: mismo motor de choques y expansiones.
- Falta construir: `src/aero/perfil-delgado.ts` (L1, L2), `src/aero/lifting-line.ts` (L3, L4),
  **`src/aero/vlm.ts` (L5, la pieza central)**, `src/aero/delta.ts` (L6),
  `src/aero/compresibilidad.ts` (L7, L8), `src/aero/regla-area.ts` (L9).

---

## 7. NO OBSERVADO

El texto viene de `pdftotext`: las figuras, fotos y curvas que eran IMAGEN no están. Lo siguiente
**no lo pude leer** y por lo tanto **no debe implementarse hasta conseguir el dato**. Ninguno de
estos valores está inventado ni deducido en este documento.

### Curvas que el software NECESITA tabular y no puedo leer

| Figura | Qué contiene | Impacto en el software |
|---|---|---|
| **Fig. 7.14a** (p.366) | **Parámetro de resistencia inducida `δ` vs. `λ`**, para AR = 4, 6, 8, 10 | **BLOQUEANTE del modo rápido.** Del ejemplo 7.3 solo tengo UN punto leído: `δ ≈ 0.015` en AR = 9, λ = 0.4. Sin la tabla completa, el atajo de trade study no se puede implementar; hay que caer siempre a colocación (que sí es barata, así que no es fatal). |
| **Fig. 7.14b** (p.366) | **Parámetro de pendiente `τ` vs. `λ`**, para AR = 6, 8, 10, 12 | Igual. Único punto leído: `τ ≈ 0.06` en AR = 9, λ = 0.4. |
| **Fig. 7.43** (p.406) | **`Kp` vs. AR** para `ΛLE` = 45°…75° y `a/c` = −0.50, 0.00, 0.25, 0.50 | **BLOQUEANTE del módulo delta (ec. 7.62).** Sin `Kp` no hay Polhamus. Los ejes se leen (AR de 0 a 4, `Kp` de 0 a 3) pero las curvas no. |
| **Fig. 7.44** (p.407) | **`Kv` vs. AR**, mismos parámetros (`Kv` de 0 a 5) | Igual: BLOQUEANTE del módulo delta. |
| **Fig. 6.10** (p.315) | `Clmax` vs. `t/c` para la serie NACA 24XX, curvas por `Rec` de 0.5×10⁶ a 8×10⁶ | Solo tengo la afirmación textual: el máximo está cerca de `t/c ≈ 0.12` y por debajo de 12% cae rápido. Los valores numéricos de `Clmax` NO. |
| **Fig. 6.26** (p.331) | `CLmax,1g` vs. complejidad del sistema hipersustentador, con aviones nombrados (A320, B747, C-17, YC-14…) | Tengo los dos techos textuales (≈3 sin soplado, ≈7 con soplado) pero **NO el incremento por ranura**, que es justo lo que pediría un módulo de alta sustentación. **No lo inventes.** |
| **Fig. 6.30** (p.334) | Evolución histórica de sistemas de borde de salida Boeing/Douglas vs. Airbus 1957–1997 | Cualitativa. Sin impacto en cálculo. |
| **Fig. 7.13** (p.364) | `Cl/CL` en la envergadura para λ = 0.00, 0.40, 0.60, 1.00 (AR = 7.28, NACA 2412) | Es la validación gráfica de L4. Puedo calcularla con la ec. 7.33, pero **no puedo contrastar contra la curva impresa**. |
| **Fig. 7.18** (p.371) | `Cl/CL` en la envergadura del ala del ej. 7.2 | Igual. |
| **Fig. 7.20** (p.373) | Convergencia de `δ` vs. número de términos (3 a 9), Rasmussen y Smith vs. colocación | Leí el rango del eje (0.013–0.017) y la tendencia; el valor asintótico exacto **no**. |
| **Fig. 7.34** (p.396) | `Cl/CL` en la envergadura del ala en flecha del ej. 7.4, VLM vs. datos a α = 4.2° | Validación gráfica de L5. |
| **Fig. 7.37, 7.38, 7.39, 7.40** (p.401–403) | **Succión efectiva de borde de ataque `s`** vs. `Rec` y vs. `ΛLE`; efecto de flaps de ataque, alabeo y radio de borde de ataque; parámetro `∂CD/∂CL²` vs. `CL` | Tengo las afirmaciones textuales (≤50% con borde afilado; el radio explica 2/3 del aumento de `(L/D)max` de 8 a 12; a `CL≈0.30` se acerca a succión plena y a `CL≈1.0` cae a succión cero) pero **ningún valor numérico de `s`**. |
| **Fig. 7.45–7.49** (p.408–411) | `CL`, `CD`, `CM` medidos en deltas (AR 1.0/1.5/2.0, bordes biselado/elíptico/redondo) | Datos de validación del módulo delta. |
| **Fig. 7.55** (p.418) | Efecto de LEX en `αmax` y `CLmax` de la familia F-5 vs. `SLEX/Swing` | Tengo el punto textual F-5E: +4.4% de área → +38% de `CLmax`. El resto de la curva **no**. |
| **Fig. 8.13a/b/c** (p.466–468) | **θ-δ-M del choque oblicuo**, `Cp` y `M2` | NO es bloqueante: las ecuaciones 8.73–8.79 son cerradas y las tengo completas. La figura solo sirve de lectura rápida. |
| **Fig. 8.16a/b/c** (p.471–473) | **Choque CÓNICO**: `θc`, `Cp` en la superficie y `Mc` vs. semiángulo y `M1` | **BLOQUEANTE del módulo cónico.** Bertin **no da la ecuación de Taylor-Maccoll**; el cono se resuelve enteramente por gráfica. Tengo solo los puntos del ej. 8.4 (`δc = 10°`, `M = 2` → `θc = 31°`, `pc/p1 = 1.29`) y del ej. 8.21 (`δc = 12°`, `M = 11.5` → `θ ≈ 14.3°` teórico contra 14.6° medido). **Habrá que sacar Taylor-Maccoll de Anderson, no de aquí.** |
| **Fig. 8.25** (p.493) | Unidad de Reynolds del Vought High-Speed Wind Tunnel vs. Mach y presión de remanso | Específica de esa instalación. Sin impacto. |
| **Fig. 9.5** (p.511) | `dCl/dα` vs. Mach por Prandtl-Glauert | Reproducible con la fórmula: `2π/√(1−M²)`. |
| **Fig. 9.7 y 9.8** (p.515) | `Cp,crit` y las tres correcciones; dispersión de `Mcrit` | La curva de `Cp,crit` la reproduzco con la ec. 9.21 (ver FIXTURE `bertin-cpcrit`). La **dispersión concreta** entre reglas para el perfil de la Fig. 9.8 **no**. |
| **Fig. 9.9** (p.516) | `CD0` del F-4C vs. Mach, de vuelo | Leí que `CD0 ≈ 0.028` en subsónico y que sube marcadamente arriba de `M ≈ 0.92`, con pico cerca de `M ≈ 1.1`. Los valores exactos del pico **no**. |
| **Fig. 9.6** (p.514) | Curva de resistencia del P-38 en el túnel de Ames | Solo el rango del eje (CD hasta 0.14) y la nota "estimado arriba de M = 0.83". |
| **Fig. 9.10–9.12** (p.518–519) | `Cl` vs. Mach transónico y distribuciones de presión en los 5 estados (a)–(e) | Tengo los 5 Mach identificados y la descripción física completa de cada estado. Los **valores numéricos de `Cl`** en cada punto: solo la relación textual (a `M = 0.81` el `Cl` es ≈2× el de baja velocidad; a `M = 0.75` es ≈60% mayor). |
| **Fig. 9.17, 9.18, 9.21, 9.22** (p.524–531) | `CL(α)` y polares de ala rectangular AR = 2.75 y delta AR = 2.31, y comparación recta/flecha 45° a M = 0.7 y 0.9 | Datos de validación transónica. Solo tengo los rangos de los ejes. |
| **Fig. 9.20** (p.528) | Distribución de presión medida en un perfil supercrítico, `M = 0.80`, `Cl = 0.54`, `Rec = 3×10⁶` | Las condiciones SÍ están en el pie de figura; la curva no. |
| **Fig. 9.35** (p.547) | `Cp` calculado vs. medido, ala/fuselaje en flecha 45°, `M∞ = 0.93`, AR = 4, λ = 0.6, NACA 65A006, `Rec = 2×10⁶`, malla 91×59×27 | Las condiciones SÍ; las curvas no. Sirve como caso de referencia si algún día se hace el solver transónico. |

### Tablas que SÍ pude leer completas (no están en esta lista por eso)
Tabla 7.1, Tabla 7.2, Tabla 8.1, Tabla 8.2, Tabla 8.3, Tabla 8.4, Tabla 8.5, Tabla 8.6, Tabla 8.7,
Tabla 8.8 y Tabla 7.3 están íntegras en el texto extraído y sus valores están recogidos en §3.

### Temas que este bloque NO cubre (y por eso no hay requisitos de ellos)

- **EFECTO SUELO.** El foco #3 del encargo lo pedía. **Bertin caps. 6–9 no lo tratan.** La única
  aparición de "ground effect" en todo el libro está en la **línea 35738**, fuera de mi rango
  (capítulo 11 o posterior). **No lo inventé ni lo deduje.** Hay que pedírselo al agente del bloque
  correspondiente, o a Raymer, que sí trae la corrección clásica de diseño conceptual.
- **Winglets / dispositivos de punta.** §7.1 (p.342) los menciona y remite explícitamente a
  **§13.4.3**, fuera de mi rango (aparecen en las líneas 41897–41989). Ahí Bertin dice que el efecto
  de un winglet **se calcula con el propio vortex-lattice** de §7.5 — o sea, el módulo que sale de
  este bloque es la base, pero las reglas de diseño del winglet están en el cap. 13.
- **Detalles de sistemas hipersustentadores por avión.** §6.8 (p.334) remite a **§13.1**.
- **Control de capa límite (succión/soplado).** §6.6 (p.318) remite a **§13.4.2**.
- **Métodos de panel modernos / CFD.** §6.1 (p.295) remite al **cap. 14**.
- **Gas real / disociación.** §8.1 (p.432) y §8.6 (p.465) remiten al **cap. 12**. Advertencia
  explícita: el modelo de gas perfecto **no sirve** para calcular a través del choque en reentrada
  (Problema 8.20 lo dice literalmente: *"many of the perfect-gas theoretical values for the
  shock-flow properties will not even be close to the actual values"*).
- **Fricción incompresible y arrastre parásito.** §7.3 (p.347) remite a **§5.4.6**.
- **Ecuación de Taylor-Maccoll (cono supersónico).** No aparece en este bloque; el cono se resuelve
  solo por las Figs. 8.16.

---

## 8. LO QUE MÁS ME SORPRENDIÓ

**1. El vortex-lattice cabe en el navegador — y la razón es una decisión de convención, no de
hardware.** Bertin elige poner las estelas **paralelas al eje del vehículo** y NO al viento, y
justifica la elección con dos frases [p.380]: los coeficientes de influencia salen más simples *"and
furthermore, these geometric coefficients do not change as the angle of attack is changed."* Eso
significa que la matriz de influencia —la parte cara, `O(n²)` para construirla y `O(n³)` para
factorizarla— **se calcula UNA sola vez por geometría** y todo el barrido de ángulo de ataque es una
sustitución hacia atrás. Un solver que reconstruyera la matriz por cada α sería 50 veces más lento y
funcionalmente idéntico. Una máquina lineal que copie la ecuación 7.38 sin leer ese párrafo se
pierde el hallazgo que hace viable el producto entero.

**2. El VLM le gana a los métodos de paneles porque tiene DOS errores que se cancelan.** Margason et
al. (1985), citado en p.378: *"The VLM predicts the experimental data very well, due to the fact
that vortex lattice methods neglect both thickness and viscosity effects. For most cases, the effect
of viscosity offsets the effect of thickness, **fortuitously** yielding good agreement between the
VLM and experiment."* Cinco métodos de paneles de superficie —más caros, más sofisticados, con
espesor real— **sobrepredicen consistentemente** los datos. El método más simple gana por accidente
afortunado. Esto es exactamente lo contrario de la intuición de "más física = mejor respuesta", y es
un argumento durísimo a favor de la arquitectura de La Forja: para diseño conceptual, el modelo
barato **no es una aproximación del caro, es a veces mejor**.

**3. Los dispositivos de borde de ataque NO generan sustentación.** El Concept Box de la p.326 lo
demuestra con el integrando de `α0l`: la combadura en el borde de ataque se multiplica por
`(cos 0 − 1) = 0`. Cero. Da igual cuánto deflectes el slat, la teoría no lineal dice que no
contribuye. Y sin embargo TODOS los aviones grandes los llevan. La respuesta de Bertin es que son
**dispositivos de control de flujo VISCOSO**: retrasan la separación. Un catálogo de software que
meta slats y flaps en la misma lista de "dispositivos hipersustentadores" y les asigne un `ΔCL`
a cada uno está mintiendo sobre la física. Hay que modelarlos en categorías **distintas**: el flap
mueve `α0l`, el slat mueve `αstall`.

**4. En el ala en flecha, la circulación máxima NO está en la raíz.** En el ejemplo 7.4 sale
`Γ1 = 0.0273`, `Γ2 = 0.0287`, `Γ3 = 0.0286`, `Γ4 = 0.0250`. El máximo está en los paneles 2 y 3.
Bertin lo explica [p.382]: los vórtices ligados de una semiala inducen downwash sobre la OTRA, y ese
efecto es máximo en el centro; los vórtices libres hacen lo suyo en las puntas. Resultado: **la
flecha le quita sustentación al ala en el centro Y en las puntas a la vez**. Es un resultado que
ninguna intuición de "el ala carga más donde es más ancha" produce, y sale gratis de resolver una
matriz de 4×4.

**5. El Mach crítico no importa.** Todo el aparato de `Cp,crit`, Prandtl-Glauert, Karman-Tsien y
Laitone converge en calcular `Mcrit`... y entonces Bertin dice [p.516]: *"While the critical Mach
number, Mcrit, is the gateway to the transonic speed regime, **nothing earth shattering actually
happens at Mcrit**."* Lo que cuesta dinero es `Mdd`, unos puntos más arriba. Y para `Mdd` **no hay
teoría**: cada fabricante tiene su regla empírica, y ni siquiera se ponen de acuerdo en la pendiente
umbral (0.03, 0.05 ó 0.10). Un producto que reporte `Mcrit` con cuatro decimales y no `Mdd` está
midiendo lo que se puede medir en lugar de lo que importa.

**6. En supersónico el túnel tiene DEMASIADO Reynolds.** Toda la intuición del ingeniero de baja
velocidad es que el túnel se queda corto de Reynolds y hay que extrapolar hacia arriba. En el
ejemplo 8.7 pasa lo contrario: el Reynolds mínimo alcanzable en el túnel a `M = 3.5` es **tres veces
el de vuelo**, y para igualarlo habría que hacer el modelo tan chico que ya no cabe la
instrumentación. Bertin lo señala explícitamente: *"This is much different than the typical subsonic
flow."* Y remata con algo más incómodo: con el MISMO Mach 3.5, la velocidad de vuelo es 1050 m/s y
la de túnel 665 m/s, porque el túnel opera cerca de la licuefacción del oxígeno y ahí el sonido es
lento.

**7. Un vórtice puede tener más autoridad que el timón — en un factor de 10.** §7.9 (p.422):
*"the wind-tunnel test results for the F-111 ... show the vortex-induced yawing moment to exceed, by
an order of magnitude, the available control capability through full rudder deflection."* Y el X-31
llegó a `Cn0 = −0.063` a α = 57° **con deslizamiento cero**. Peor: cuando intentaron arreglarlo
poniendo tiras de transición, **la asimetría EMPEORÓ** (a −0.078). Lo que funcionó fue redondear la
punta del morro y poner strakes. Es el recordatorio más brutal del bloque de que a alto ángulo de
ataque la geometría del MORRO gobierna la direccional, no las superficies de mando.

**8. La regla del área obligó a un avión entero a rediseñarse alrededor de una GRÁFICA.** El B-58:
los modelos del MX-1626 original tenían un `CD` pico casi **el doble** de lo predicho y **no pasaron
Mach 1**. La explicación no salió de un cálculo de resistencia sino de dibujar `A(x)` y comparar con
un cuerpo de revolución equivalente. Y la consecuencia fue estructural: Hillaker (1994) cuenta que
la regla del área **obligó** a escalonar las góndolas (la cara de entrada de la exterior en el mismo
plano que la salida de la interior) aunque las góndolas siamesas pesaran menos — *"the higher drag
more than offset the lower weight."* Una gráfica de una integral de área derrotó a un argumento de
peso estructural. Eso es exactamente el tipo de trade study que Raymer dice que ningún CAD de alta
gama soporta, y en La Forja es una sección del B-Rep por planos: **el kernel ya sabe hacerlo**.

**9. Los aviones perdieron complejidad conforme mejoró el cálculo.** [§6.8, p.334] La evolución fue
triple-ranurado (B-737) → doble-ranurado (B-777) → **simple-ranurado** (A380, B-787). El 777 se
diseñó con código de superficie sustentadora 3D en anteproyecto, códigos 2D viscoso-no viscoso
acoplados para las secciones y códigos de paneles 3D para interacciones — **y sin Navier-Stokes ni
Euler** [Brune y McMasters 1990; Nield 1995]. Mejor predicción no dio un avión más complicado: dio
uno **más simple, más barato y más eficiente**. Ese es el argumento comercial del producto dicho por
el propio libro.

**10. El libro admite que las predicciones escaladas están mal, y por cuánto.** Bushnell (2006),
citado en §8.11: en 12 transportes comerciales de tres fabricantes en 20 años, las predicciones de
resistencia estuvieron **hasta 22% bajas y 10% altas** — seis bajas, cuatro altas, dos exactas. Y
las correcciones típicas suman ~+12% (pared +6%, Reynolds −5%, rugosidad +2%, sting/aeroelástico
−4%). Un producto honesto **no reporta un número**: reporta una banda con la lista de correcciones
aplicadas. Que un libro de texto imprima el tamaño de su propio error es lo más raro —y lo más
valioso— de todo este bloque.

