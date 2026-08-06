# Anderson caps 15–20 — PARTE 4: FLUJO VISCOSO (el arrastre real y el stall)

Fuente: `docs/forja-research/manuales/aero/txt/anderson.txt` líneas **43461–53184** (leído completo).
El **cuerpo** de los capítulos ocupa 43461–50777 (págs. 925–1078 del libro); 50778–53184 son
Apéndices A–E, Referencias e Índice (ver §7).
Anderson, *Fundamentals of Aerodynamics*, 6ª ed. — Parte 4, capítulos 15 a 20.
Fecha del análisis: 2026-08-04. Analista: agente de bloque viscoso (La Forja).

Offsets verificados de sección (por si otro agente necesita releer):

| § | línea | § | línea | § | línea |
|---|---|---|---|---|---|
| 15.1 | 43508 | 17.1 | 46902 | 19.1 | 49660 |
| 15.2 | 43565 | 17.2 | 46973 | 19.2 | 49682 |
| 15.3 | 43940 | 17.3 | 47288 | 19.3 | 49939 |
| 15.4 | 44157 | 17.4 | 47480 | 19.4 | 50076 |
| 15.5 | 44330 | 18.1 | 47624 | 20.1 | 50200 |
| 15.6 | 44514 | 18.2 | 47683 | 20.2 | 50209 |
| 15.7 | 44768 | 18.3 | 48022 | 20.3 | 50267 |
| 16.2 | 45100 | 18.4 | 48639 | 20.4 | 50563 |
| 16.3 | 45264 | 18.5 | 48871 | 20.5 | 50756 |
| 16.4 | 46112 | 18.6 | 49166 | Apéndice A | 50778 |

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

El libro abre el capítulo 15 con la cita de **d'Alembert (1768)**:

> *"I do not see then, I admit, how one can explain the resistance of fluids by the theory in a
> satisfactory manner. It seems to me on the contrary that this theory... gives, at least in most
> cases, resistance absolutely zero: a singular paradox which I leave to geometricians to explain."*
> (p.925)

Y en §15.1 (p.926) Anderson dice **exactamente qué le falta a todo lo que hicimos hasta ahora** —
esta frase es el requisito que justifica todo mi bloque:

> *"With the exception of induced drag and supersonic wave drag, which can be obtained from inviscid
> theory, **the calculation of all other forms of drag must explicitly take into account the presence
> of viscosity**, which has not been included in our previous inviscid analyses."* (§15.1, p.926)

**Traducción operativa para el software:** nuestro método de paneles / flujo potencial da sustentación
y da CERO arrastre (paradoja de d'Alembert). Los capítulos 15–20 son la fuente del arrastre que falta,
y también de la única explicación honesta del **stall**.

| Cap | Título | Qué aporta al producto | Costo |
|---|---|---|---|
| 15 | *Introduction to the Fundamental Principles and Equations of Viscous Flow* | Física base: esfuerzo cortante, no-deslizamiento, separación por gradiente adverso, transición, Navier-Stokes completas, parámetros de similitud (γ, M∞, Re∞, Pr∞) | conceptual |
| 16 | *A Special Case: Couette Flow* | El "walk before you run": soluciones exactas cerradas. De aquí salen **factor de recuperación r**, **analogía de Reynolds**, **temperatura de pared adiabática** — herramientas que se usan luego en la capa límite | `[NAVEGADOR]` |
| 17 | *Introduction to Boundary Layers* | δ, δ\*, θ; ecuaciones de capa límite; **el cuerpo efectivo = cuerpo + δ\*** y el **lazo iterativo viscoso-invíscido** (el truco de XFOIL, §17.2 p.1004) | `[NAVEGADOR]` |
| 18 | *Laminar Boundary Layers* | **BLASIUS**: fórmulas cerradas para δ, δ\*, θ, c_f, C_f. Compresible: método de temperatura de referencia. Calentamiento en punto de estancamiento y por qué las narices son romas | `[NAVEGADOR]` |
| 19 | *Turbulent Boundary Layers* | Correlaciones empíricas de δ y C_f turbulentos; Baldwin-Lomax; la confesión de que **no existe teoría pura de turbulencia** | `[NAVEGADOR]` |
| 20 | *Navier-Stokes Solutions: Some Examples* | Qué SÍ exige un solver completo (separación, choque-capa límite, protuberancias) y **cuánto se equivoca** (18–40 % en C_f) | `[GPU-VIVO]` |

**El mensaje central del bloque, en una línea:** el flujo potencial dice dónde está la presión; la
capa límite dice cuánto arrastre hay y **dónde se despega el flujo** — y cuando se despega, el flujo
potencial que alimentó todo deja de valer.

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§] requisito (APRENDER/CONSTRUIR/ambos)`

### Física base del flujo viscoso

- `[viscoso] [§15.1 p.926]` El software DEBE declarar explícitamente que un análisis invíscido entrega
  arrastre cero para un cuerpo cerrado 2D, y DEBE ofrecer un módulo viscoso separado que sume
  D_f y D_p. Sin ese módulo, el CD reportado es una mentira. (**ambos**)
- `[viscoso] [§15.2 p.928]` Condición de **no deslizamiento**: *"the influence of friction is to create
  V = 0 right at the body surface—this is called the no-slip condition which dominates viscous flow."*
  El post-proceso DEBE dibujar el perfil de velocidad con u(0)=0, nunca con deslizamiento. (**ambos**)
- `[viscoso] [§15.7 p.953]` La condición de no deslizamiento es **más general que la velocidad**: también
  `T = T_w` en la pared (Ec. 15.34). Tres casos de frontera térmica que el solver DEBE soportar:
  (1) T_w constante dado, (2) T_w(t) acoplado al material, (3) **pared adiabática** `(∂T/∂y)_w = 0`
  con T_aw como incógnita. (**CONSTRUIR**)
- `[viscoso] [§15.2 p.930]` Clasificación obligatoria del arrastre viscoso en dos cubetas:
  **D_f** (fricción de piel = integral de τ sobre el cuerpo) y **D_p** (presión por separación, "form
  drag"). `D_f + D_p = profile drag` (2D) = `parasite drag` (3D, avión completo). El reporte de
  arrastre DEBE separarlas: son sensibles a cosas opuestas. (**ambos**)
- `[viscoso] [§15.2 p.929]` **Criterio de separación**: *"The point of separation on the surface...
  occurs where ∂V/∂n = 0 at the surface. Beyond this point, reversed flow occurs."* El solver de capa
  límite DEBE marcar la estación x donde el gradiente de velocidad en la pared se anula, y DEBE
  detenerse ahí (ver §20.3.1: las ecuaciones de capa límite revientan pasada la separación). (**ambos**)
- `[viscoso] [§15.2 p.929]` **Gradiente de presión adverso** = causa de la separación. La UI DEBE
  graficar dp/dx sobre el cuerpo y colorear la región adversa: es el diagnóstico que un ingeniero mira
  ANTES de que el CFD confirme la separación. (**ambos**)
- `[viscoso] [§15.2 p.931]` **STALL**: *"The occurrence of separated flow over an aerodynamic body not
  only increases the drag but also results in a substantial loss of lift. Such separated flow is the
  cause of airfoil stall."* → La teoría de perfil delgado (Cl = 2π·α) DEBE marcarse INVÁLIDA arriba del
  ángulo donde la capa límite se separa. (**ambos**)

### Transición laminar-turbulenta

- `[viscoso] [§15.2 p.932]` El motor DEBE modelar el punto de transición x_cr y permitir tres modos:
  todo laminar, todo turbulento, y **transición en x_cr** (los tres se piden explícitamente en los
  problemas 19.1–19.3, p.1062). (**CONSTRUIR**)
- `[viscoso] [§15.2 p.935]` `Re_cr = ρ∞·V∞·x_cr/μ∞`. Regla de dedo del libro: **Re_cr ≈ 500,000**.
  *"if the flow at a given x station is such that Re is considerably below 500,000, then the flow at
  that station is most likely laminar, and if the value of Re is much larger than 500,000, then the
  flow is most likely turbulent."* (**ambos**)
- `[viscoso] [§15.2 p.934]` Los **cuatro factores que adelantan la transición** (bajan x_cr), a exponer
  como perillas/checklist en la escuela: (1) rugosidad superficial, (2) turbulencia del flujo libre,
  (3) gradiente de presión adverso, (4) calentamiento del fluido por la pared. Y los que la retrasan:
  gradiente favorable, **pared fría**, M∞ alto, Re bajo. (**APRENDER**)
- `[viscoso] [§15.2 p.934]` Requisito de honestidad para el cliente: los perfiles laminares NACA serie 6
  **no cumplen en vuelo** lo que cumplen en el laboratorio — *"manufacturing irregularities and bug
  spots (believe it or not) roughen the surface and promote early transition."* El estimador de arrastre
  DEBE tener un factor de "flujo laminar realizable" y NO asumir laminar por default. (**APRENDER**)
- `[viscoso] [§15.2 p.933]` **El compromiso**: cuerpo esbelto → domina D_f → conviene laminar. Cuerpo
  romo → domina D_p → conviene turbulento (hoyuelos de pelota de golf). *"There is no pat answer; it
  depends on the shape of the body."* (**APRENDER**)

### Capa límite: definiciones y acoplamiento

- `[viscoso] [§17.2 p.1000]` Definición operativa de δ: **la distancia donde u = 0.99·u_e**. El
  post-proceso DEBE usar exactamente ese umbral (no 0.995, no 0.98) o los números no reproducen. (**CONSTRUIR**)
- `[viscoso] [§17.2 p.1000]` Existen DOS espesores: **δ (velocidad)** y **δ_T (térmico, donde
  T = 0.99·T_e)**. Relación por Prandtl: `Pr = 1 → δ = δ_T`; `Pr > 1 → δ_T < δ`; `Pr < 1 → δ_T > δ`.
  Aire estándar Pr = 0.71 ⇒ **la capa térmica es más gruesa que la de velocidad**. (**ambos**)
- `[viscoso] [§17.2 p.1001]` **Espesor de desplazamiento** `δ* = ∫(1 − ρu/(ρe·ue))dy`. Dos lecturas
  físicas obligatorias en la escuela: (a) el "flujo másico faltante", (b) **la distancia que la línea
  de corriente externa se desplaza hacia arriba**. (**ambos**)
- `[viscoso] [§17.2 p.1003]` **CUERPO EFECTIVO** = contorno real + distribución de δ*. *"the freestream
  sees an effective body given by curve ac."* Este es EL requisito que convierte al método de paneles
  en algo con arrastre. (**CONSTRUIR**)
- `[viscoso] [§17.2 p.1004]` **LAZO VISCOSO-INVÍSCIDO — los 5 pasos literales del libro** (ver §2.6):
  el solver acoplado DEBE implementarlos en ese orden, con criterio de convergencia sobre δ*. (**CONSTRUIR**)
- `[viscoso] [§17.2 p.1004]` El libro autoriza **saltarse el lazo** cuando la capa es muy delgada:
  *"In some cases, the boundary layers are so thin that the effective body can be ignored."* Pero lo
  exige *"for highly accurate solutions, and for cases where the boundary-layer thickness is relatively
  large (such as for hypersonic flow)."* → bandera de usuario, no decisión automática. (**ambos**)
- `[viscoso] [§17.2 p.1005]` **Espesor de cantidad de movimiento** `θ = ∫(ρu/ρe·ue)(1 − u/ue)dy`, y su
  propiedad de oro: `θ(x1) ∝ (1/x1)∫c_f dx = C_f`. → **medir θ en el borde de fuga = medir el arrastre
  de fricción**. Para placa plana el libro lo cierra exacto: `C_f = 2·θ(x=c)/c` (Ec. 18.30, p.1021). (**ambos**)
- `[viscoso] [§17.2 p.1006]` `δ*` típicamente `≈ 0.3·δ`, y en flujo turbulento δ, δ* y θ son todos
  mayores que en laminar. (**APRENDER**)

### Ecuaciones y sus límites

- `[viscoso] [§17.3 p.1009]` Las 4 ecuaciones de capa límite (17.28–17.31) + estado (17.32) + h = cp·T
  (17.33) = 5 ecuaciones, 5 incógnitas (u, v, ρ, T, h). El motor DEBE implementarlas en esta forma
  reducida, NO las Navier-Stokes completas, para el caso adherido. (**CONSTRUIR**)
- `[viscoso] [§17.3 p.1008]` `∂p/∂y = 0` **dentro** de la capa: *"the pressure distribution at the outer
  edge of the boundary layer is impressed directly to the surface without change."* → el Cp del método
  de paneles se transfiere tal cual a la pared. Es lo que hace barato el acoplamiento. (**ambos**)
- `[viscoso] [§17.4 p.1010]` Lo que realmente se quiere no son los perfiles: son **τ_w y q̇_w**. Pero
  *"in order to obtain the values for τw and q̇w along the wall... we first have to solve the
  boundary-layer equations for the velocity and temperature profiles... which by themselves usually are
  of lesser practical interest."* → la API expone τ_w(x), q̇_w(x), c_f(x); los perfiles quedan como
  detalle inspeccionable. (**CONSTRUIR**)

### Laminar (Blasius) — el motor barato

- `[viscoso] [§18.2 p.1016]` **Ecuación de Blasius** `2f''' + f·f'' = 0`, con `f' = u/V∞`. Auto-similar:
  el perfil `u(η)` es **el mismo en toda estación x**. El motor DEBE resolverla una sola vez y tabularla. (**CONSTRUIR**)
- `[viscoso] [§18.2 p.1018]` Método de solución: **shooting** (suponer f''(0), integrar Runge-Kutta,
  iterar hasta f'(∞)=1). Valor convergido de referencia: **f''(0) = 0.332**. (**ambos**)
- `[viscoso] [§18.2 pp.1019–1021]` Las cinco fórmulas cerradas de placa plana laminar incompresible —
  **el entregable más valioso de todo mi bloque, todas evaluables en el navegador en microsegundos**
  (detalle y rangos en §2.3). (**CONSTRUIR**)
- `[viscoso] [§18.2 p.1020]` `C_f` de Anderson es **por una sola cara** de la placa. Los ejemplos 18.1,
  18.2, 19.1 duplican explícitamente para las dos caras. La API DEBE decir en el nombre qué devuelve
  (`cfUnaCara` vs `dragTotalDosCaras`) o se paga con un factor 2. (**CONSTRUIR**)

### Compresible y térmico

- `[compresible] [§15.3 p.937]` **Ley de Sutherland** para μ(T) — el motor DEBE usarla, no μ constante,
  en cuanto T\* pase de ~350 K. (**CONSTRUIR**)
- `[compresible] [§15.6 p.951]` Los **4 parámetros de similitud** de un flujo viscoso compresible:
  `γ, M∞, Re∞, Pr∞`. Dos flujos con esos cuatro iguales y cuerpos geométricamente semejantes SON
  dinámicamente semejantes. → la clave de caché/tabla precomputada. (**ambos**)
- `[compresible] [§16.3.3–16.3.4 pp.974–977]` **Temperatura de pared adiabática** y **factor de
  recuperación** `r`: `h_aw = h_e + r·u_e²/2`, `T_aw = T_e + r·u_e²/(2cp)`, y la forma alterna
  `r = (T_aw − T_e)/(T_0 − T_e)`. (**ambos**)
- `[compresible] [§16.3.5 p.978]` **Analogía de Reynolds** `C_H/c_f = ½·Pr^(−1)` (Couette). Convierte
  fricción medida en calentamiento estimado sin resolver la energía otra vez. (**ambos**)
- `[compresible] [§18.4 p.1033]` **MÉTODO DE TEMPERATURA DE REFERENCIA** — usar las fórmulas
  incompresibles evaluando ρ y μ a `T*`. Es la forma barata de tener compresibilidad. Precisión medida
  por el propio libro: **1 %** contra la solución "exacta" (Ej. 18.2). (**CONSTRUIR**)
- `[compresible] [§18.4.1 p.1036]` La variante **Meador-Smart (2005)** es más nueva y **más exacta**
  (0.4 % en el Ej. 18.3). El motor DEBE ofrecer ambas y marcar cuál usó. (**CONSTRUIR**)
- `[compresible] [§18.5 p.1042]` **q̇_w ∝ 1/√R** en el punto de estancamiento ⇒ **las narices y bordes
  de ataque hipersónicos deben ser ROMOS**. *"otherwise the severe aerothermal conditions in the
  stagnation region would quickly melt a sharp leading edge."* El CAD DEBE advertir cuando un usuario
  dibuja un borde afilado en una config de alta velocidad. (**ambos**)
- `[compresible] [§18.5 p.1040]` Esfera calienta MÁS que cilindro (coef. 0.763 vs 0.57) por el
  **efecto de alivio tridimensional** — en 3D el gas tiene tres salidas y en 2D solo dos, la capa es
  más delgada, el gradiente de T mayor. (**APRENDER**)

### Turbulento

- `[viscoso] [§19.1 p.1052]` Requisito de honestidad, literal: *"**no pure theory of turbulent flow
  exists.** Every analysis of turbulent flow requires some type of empirical data in order to obtain a
  practical answer."* La UI DEBE etiquetar todo resultado turbulento como **estimación empírica**. (**ambos**)
- `[viscoso] [§19.2 p.1053]` Correlaciones incompresibles de placa plana turbulenta: `δ = 0.37x/Re_x^0.2`,
  `C_f = 0.074/Re_c^0.2`. (**CONSTRUIR**)
- `[viscoso] [§19.2.2 p.1056]` Variante Meador-Smart turbulenta: `c_f = 0.02296/Re_x^0.139`,
  `C_f = 0.02667/Re_c^0.139`, `r ≈ Pr^(1/3)`. (**CONSTRUIR**)
- `[viscoso] [Ej.19.1 p.1055]` El número que el cliente debe tener tatuado: **turbulento cuesta 7.7×
  el arrastre de fricción laminar a M=0.29, y 13× a M=2.94**. Por eso predecir la transición importa
  tanto. (**APRENDER**)
- `[viscoso] [§19.3.1 pp.1058–1060]` **Modelo Baldwin-Lomax** completo (dos capas, viscosidad de
  remolino algebraica, 6 constantes). Ventaja declarada: se basa en la **vorticidad local**, no en una
  longitud de mezcla ⇒ *"a distinct advantage for the analysis of flows without an obvious mixing
  length, such as separated flows."* (**CONSTRUIR**)
- `[viscoso] [§19.3.1 p.1060]` `k_T = μ_T·cp/Pr_T` con **Pr_T = 1** por convención. (**CONSTRUIR**)

### Navier-Stokes completo y su precio

- `[viscoso] [§20.3.1 p.1065]` *"The calculation of such separated flows is the forte of solutions of
  the complete Navier-Stokes equations. In contrast, the boundary-layer equations... are not suited for
  the analysis of separated flows; **boundary-layer calculations usually 'blow up' in regions of
  separated flow.**"* → regla de ruteo del software: adherido → capa límite; separado → RANS. (**ambos**)
- `[viscoso] [§20.3.2 p.1066]` A **Re = 100,000** el flujo laminar sobre un Wortmann a α=0 se separa en
  AMBAS superficies; con modelo de turbulencia queda completamente adherido. *"turbulent flow resists
  flow separation much more strongly than laminar flow."* Requisito para drones/modelos a bajo Re. (**ambos**)
- `[viscoso] [§20.3.4 p.1069]` **Interacción choque-capa límite**: el choque incidente actúa como
  gradiente adverso severo, la separación ocurre **AGUAS ARRIBA** del punto de impacto (la alta presión
  se propaga hacia adelante por la porción subsónica de la capa), y el punto de readherencia es una
  **zona de calentamiento local alto**. (**ambos**)
- `[viscoso] [§20.4 p.1075]` Las tres causas de imprecisión en τ_w y q̇_w por CFD, a documentar en el
  reporte: malla muy fina en la pared, incertidumbre del modelo de turbulencia, e **incapacidad de la
  mayoría de los modelos para predecir la transición**. (**APRENDER**)
- `[viscoso] [§20.4 p.1076]` **La cifra dura**: *"the ability of Navier-Stokes solutions to predict skin
  friction in a turbulent flow seems to be no better than about **20 percent accuracy**, on the
  average."* Y el estudio de Lombardi da 18–40 %. → el software NO debe presentar C_f de RANS con más
  cifras significativas de las que merece. (**ambos**)
- `[viscoso] [§20.4 p.1073]` Recomendación explícita del autor: *"the use of boundary-layer solutions
  for skin friction and aerodynamic heating is the **preferred engineering approach**"* para flujo
  adherido, y las soluciones Navier-Stokes *"are still not in the category of 'quick engineering
  calculations.'"* → **valida nuestra arquitectura**: capa límite en el navegador, RANS solo cuando hace
  falta. (**ambos**)

### Escuela

- `[escuela] [§18.4 Ej.18.2 vs Ej.18.1b]` Lección de método: comparar SIEMPRE un método barato contra
  uno caro sobre el mismo caso y reportar el % de diferencia. El libro lo hace tres veces seguidas
  (1 %, 0.4 %, 20 %, 14 %) y de ahí sale la intuición del ingeniero. (**APRENDER**)
- `[escuela] [§19.6 pp.1062]` Los 7 problemas del cap. 19 (Piper Cherokee, Mach 4, punto de
  estancamiento a 35 km) son el examen listo para el alumno — **NO vienen resueltos** (§7). (**CONSTRUIR**)

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

### 2.1 Esfuerzo cortante y conducción (§15.3, pp.936–940)

```
tau_yx = mu * du/dy                                              (15.1)
q_y    = -k * dT/dy                                              (15.2)
```
- **Supuesto:** fluido newtoniano. *"There are some specialized fluids which do not obey Equation (15.1)
  or (16.7); they are called non-newtonian fluids—some polymers and blood are two such examples."* (p.966)
  Aire y agua son newtonianos ⇒ válido para todo lo aeronáutico.
- Generalización 3D (Ecs. 15.5–15.7): `tau_xy = tau_yx = mu*(dv/dx + du/dy)`, etc.
- Esfuerzos **normales** viscosos (Ecs. 15.8–15.10): `tau_xx = lambda*(div V) + 2*mu*du/dx`, con
  **hipótesis de Stokes `lambda = -2/3 * mu`** (Ec. 15.11, 1845).
  - **Rango:** despreciables salvo donde los gradientes ∂u/∂x sean enormes. *"An example where the
    normal stress is important is inside the internal structure of a shock wave"* — espesor típico
    10⁻⁵ cm (p.939). **Qué se rompe fuera:** dentro de un choque resuelto, ignorar τ_xx da estructura
    interna equivocada. Para todo lo demás en un CAD conceptual, se pueden ignorar.
  - **Honestidad declarada del libro:** *"To this day, the correct expression for the bulk viscosity is
    still somewhat controversial"* (p.939).

**Ley de Sutherland** (Ec. 15.3, p.937):
```
mu/mu0 = (T/T0)^(3/2) * (T0 + 110)/(T + 110)          [T en KELVIN]
mu0 = 1.7894e-5 kg/(m*s)   a   T0 = 288.16 K   (nivel del mar estándar)
```
- **Rango:** *"Equations (15.3) and (15.4) are only approximate and do not hold at high temperatures."*
  (p.937). El propio libro la usa hasta ~613 K sin objeción (Ej. 18.2).
- **Gotcha de notación pagado por el libro** (p.1035): en la ley de Sutherland `T0` es la **temperatura
  de referencia**, NO la temperatura total. En el mismo ejemplo 18.2 aparecen las dos `T0` con
  significados distintos. En nuestro código: `T_REF_SUTHERLAND` vs `T_total`, jamás `T0`.

```
k = 1.45 * mu * cp        para aire en condiciones estándar,  cp = 1000 J/(kg*K)   (15.4)
```

**Turbulencia como transporte** (p.939): se reemplaza `mu -> mu + eps` y `k -> k + kappa`, donde
eps (viscosidad de remolino) y kappa son **10 a 100 veces mayores** que los valores moleculares, y
**dependen del campo de flujo, no del gas**. Longitud de mezcla de Prandtl (1925):
```
eps = rho * l^2 * |du/dy|        (15.12)        kappa = eps * cp        (15.13)
```
- **Rango:** `l` es una constante empírica distinta para cada aplicación. *"all turbulence models
  require the input of empirical data; no self-contained purely theoretical turbulence model exists
  today."* (p.940)

### 2.2 Navier-Stokes, energía y similitud (§§15.4–15.6)

- Momentum (Ecs. 15.18a-c y su forma expandida 15.19a-c) y energía (Ec. 15.26) — completas, no las
  reproduzco aquí; están en el texto en las líneas 44260–44314 y 44471–44485.
- **La continuidad NO cambia** por ser viscoso (p.947): *"the consideration of the viscous or inviscid
  nature of the flow never enters the derivation—the continuity equation is simply a statement that mass
  is conserved."*
- **Los flujos viscosos son rotacionales** (§15.7, p.953) ⇒ **NO existe potencial de velocidad** dentro
  de la capa. Sí existe función de corriente. **Qué se rompe:** cualquier intento de meter el campo
  viscoso en el mismo solver potencial. Por eso el acoplamiento es por *cuerpo efectivo*, no por
  superposición.
- **Número de Prandtl** (§15.6, p.951): `Pr = mu*cp/k ∝ disipación por fricción / conducción térmica`.
  - **Valor de trabajo: Pr∞ = 0.71 para aire.**
  - **Rango:** *"for air over a reasonable temperature range (up to T∞ = 600 K), it is safe to assume
    Pr∞ = constant = 0.71."* (p.952). El cap.16 lo extiende: los calores específicos son esencialmente
    constantes hasta 1000 K y por tanto Pr también (p.990), lo cual cubre **vuelo hasta M ≈ 3.5**
    (cálculo del propio libro, p.991 — es un fixture, ver §3).
  - **Qué se rompe arriba:** disociación/gas real; el cap. 18.6 cita el cálculo de Blottner con química.

### 2.3 BLASIUS — capa límite laminar incompresible sobre placa plana (§18.2)

**Supuestos** (§18.2, p.1014): incompresible (ρ = cte), μ = cte, `dp_e/dx = 0` (placa plana a α = 0),
2D, estacionario. Más los supuestos de capa límite (§2.5).

Transformación de similitud (Ecs. 18.4, 18.11):
```
eta = y * sqrt(V_inf / (nu * x))          psi = sqrt(nu * x * V_inf) * f(eta)
f'(eta) = u / V_inf                       nu = mu / rho
```

**Ecuación de Blasius (Ec. 18.15, H. Blasius, tesis doctoral 1908):**
```
2*f''' + f*f'' = 0
```
Condiciones de frontera: `eta=0: f=0, f'=0` ; `eta -> inf: f' = 1`.
Método: **shooting** (suponer f''(0), integrar RK, iterar). Constantes numéricas convergidas — **son
fixtures**:
```
f''(0)              = 0.332
eta donde f'=0.99   = 5.0
eta1 - f(eta1)      = 1.72     (constante para todo eta1 > 5.0)
integral de f'(1-f')= 0.664
```

**LAS CINCO FÓRMULAS CERRADAS** (todas `[NAVEGADOR]`, coste ~nanosegundos):

| Cantidad | Fórmula | Ec. | pág |
|---|---|---|---|
| Coef. fricción **local** | `c_f = 0.664 / sqrt(Re_x)` | 18.20 | 1019 |
| Coef. fricción **integrado** (una cara) | `C_f = 1.328 / sqrt(Re_c)` | 18.22 | 1019 |
| Espesor de capa límite | `delta = 5.0*x / sqrt(Re_x)` | 18.23 | 1019 |
| Espesor de **desplazamiento** | `delta* = 1.72*x / sqrt(Re_x)` | 18.26 | 1020 |
| Espesor de **cantidad de movimiento** | `theta = 0.664*x / sqrt(Re_x)` | 18.28 | 1020 |

Relaciones internas (verificables como invariantes de test):
```
delta* = 0.34 * delta      theta = 0.39 * delta*      theta = 0.13 * delta
C_f    = 2 * theta(x=c) / c                                          (18.30)
c_f ∝ Re_x^(-1/2) ∝ x^(-1/2)        delta ∝ x^(1/2)   (crecimiento parabólico)
```

**RANGO DE VALIDEZ y qué se rompe fuera:**
1. **Solo laminar.** Arriba de Re_x ≈ 500,000 (§15.2) el flujo transiciona y estas fórmulas
   **subestiman el arrastre por un factor de ~7.7 a ~13** (Ejs. 19.1a/b). Este es EL error grande.
2. **Solo placa plana, dp/dx = 0.** Para un perfil real hay gradiente de presión; el propio libro
   muestra (Fig. 20.16, p.1077) que sobre un perfil `c_f` **sube** desde cero en el estancamiento hasta
   un pico justo detrás del borde de ataque, y solo después decae como placa plana. Usar Blasius sobre
   un perfil ignora ese pico.
3. **Solo incompresible.** Compresibilidad ⇒ multiplicar por `F(Me, Pr, Tw/Te)`, ver §2.7.
4. **Singularidad en x = 0.** `c_f -> inf` en el borde de ataque. El integrador debe empezar en x > 0.
5. **Adherido.** No dice nada de separación (dp/dx = 0 ⇒ nunca se separa).

### 2.4 Capa límite turbulenta (§19.2)

```
delta = 0.37*x / Re_x^(1/5)                                          (19.1)
C_f   = 0.074 / Re_c^(1/5)                                           (19.2)
```
**Meador-Smart, turbulento** (§19.2.2, p.1056):
```
c_f = 0.02296 / Re_x^0.139        C_f = 0.02667 / Re_c^0.139
r_turbulento ≈ Pr^(1/3)      (= 0.892 para Pr = 0.71)
```

**Comparación de exponentes — esto es lo que el ingeniero debe VER:**

| | laminar | turbulento |
|---|---|---|
| δ vs Re | Re^(−1/2) | Re^(−1/5) |
| δ vs x | x^(1/2) | x^(4/5) |
| C_f vs Re | Re^(−1/2) | Re^(−1/5) |

*"turbulent values of δ grow more rapidly with distance along the surface"* (p.1053).

**RANGO Y QUÉ SE ROMPE:**
- Estas son **correlaciones empíricas, no teoría.** El libro es explícito (§19.1, p.1052).
- Válidas para placa plana, incompresible, pared adiabática. Para compresible: Figura 19.1 (NO
  OBSERVADA) **o** el método de temperatura de referencia (Ec. 19.3).
- **Precisión medida por el propio libro:** en el mismo caso (Ej. 19.1b vs 19.2 vs 19.3) los tres
  métodos dan 65,400 N / 51,890 N / 56,140 N — es decir, **20 % y 14 % de discrepancia entre métodos
  igualmente respetables.** Comentario literal: *"This is not surprising. It simply points out the
  great uncertainty in making calculations of turbulent skin friction."* (p.1055)
- No hay un criterio de separación turbulenta en estos capítulos. Solo la afirmación cualitativa de
  que la capa turbulenta *"remain[s] attached to a surface for much larger distances downstream"*
  (p.1051).

### 2.5 Ecuaciones de capa límite y sus supuestos (§17.3)

Obtenidas por **análisis de órdenes de magnitud** sobre las Navier-Stokes adimensionales, bajo:
```
(A)  delta << c                        (la capa es delgada frente al cuerpo)     (17.15)
(B)  1/Re_inf = O(delta^2)             (Reynolds grande)                         (17.20)
(C)  M_inf "no desmesuradamente grande"                                          (p.1012)
```
Resultado (Ecs. 17.28–17.31):
```
d(rho*u)/dx + d(rho*v)/dy = 0
rho*u*du/dx + rho*v*du/dy = -dpe/dx + d/dy( mu * du/dy )
dp/dy = 0
rho*u*dh/dx + rho*v*dh/dy = d/dy(k*dT/dy) + u*dpe/dx + mu*(du/dy)^2
```
**QUÉ SE ROMPE FUERA DEL RANGO — tres roturas nombradas por el libro:**
1. **Hipersónico**: si `1/(gamma*M_inf^2) = O(delta)`, entonces `∂p'/∂y'` puede ser O(1) y
   *"for very large hypersonic Mach numbers, the assumption that p is constant in the normal direction
   through a boundary layer is not always valid."* (§17.3, p.1008)
2. **Separación**: *"boundary-layer calculations usually 'blow up' in regions of separated flow."*
   (§20.3.1, p.1065)
3. **Interacción choque-capa límite**: exige Navier-Stokes completas (§20.3.4, p.1069).

Son **no lineales** igual que Navier-Stokes (p.1009) — la ganancia es estructural (`dp/dy=0` permite
marchar corriente abajo), no algebraica.

### 2.6 EL ACOPLAMIENTO VISCOSO-INVÍSCIDO (§17.2, pp.1003–1004) — el truco de XFOIL

Este es el corazón práctico de mi bloque. Transcribo la receta **literal** del libro (p.1004), que es
directamente la especificación de implementación:

> 1. *"Carry out an inviscid solution for the given body shape ab. Evaluate ρe, ue, Te, etc., along
>    curve ab."*
> 2. *"Using these values of ρe, ue, Te, etc., solve the boundary-layer equations... for u = u(y),
>    ρ = ρ(y), etc., at various stations along the body."*
> 3. *"Obtain δ\* at these stations from Equation (17.3). This will not be an accurate δ\* because ρe,
>    ue, Te, etc., were evaluated on curve ab, not the proper effective body. Using this intermediate
>    δ\*, calculate an effective body, given by a curve ac' (not shown in Figure 17.6)."*
> 4. *"Carry out an inviscid solution for the flow over the intermediate effective body ac', and
>    evaluate new values of ρe, ue, Te, etc., along ac'."*
> 5. *"Repeat steps 2 to 4 above until the solution at one iteration essentially does not deviate from
>    the solution at the previous iteration."*

**Por qué es barato:** cada iteración es (un método de paneles) + (una marcha de capa límite). Ambos
son `[NAVEGADOR]`. En 3–5 iteraciones se tiene arrastre de fricción, arrastre de forma aproximado y el
punto de separación — sin una sola celda de CFD.

**Los tres ingredientes que lo hacen cerrar** (los tres están en mi bloque):
- `∂p/∂y = 0` (Ec. 17.30) ⇒ el Cp invíscido se imprime sin cambio sobre la pared;
- `δ*` = desplazamiento geométrico real de la línea de corriente (Ec. 17.9) ⇒ el cuerpo efectivo es
  literalmente el contorno + δ*(x);
- `θ` ∝ `C_f` ⇒ el arrastre sale del mismo cálculo, sin integrar τ_w aparte.

**LÍMITE DECLARADO:** el lazo **no** aplica en separación ni con choque-capa límite (§§20.3.1, 20.3.4).
El resultado utilizable es entonces: *"aquí se separa, y hasta aquí mi número vale."* Esa es la
respuesta honesta que le da al ingeniero el ángulo de stall aproximado.

### 2.7 Compresible: temperatura de referencia (§18.4) — la vía barata

**Método clásico (Rubesin-Johnson / Eckert)**, Ec. 18.53 (p.1033):
```
T*/Te = 1 + 0.032*Me^2 + 0.58*(Tw/Te - 1)
```
Con T\* se calculan `rho* = p/(R*T*)` y `mu*` por Sutherland, y se aplican **las fórmulas
incompresibles**:
```
c_f* = 0.664 / sqrt(Re_x*)        C_f* = 1.328 / sqrt(Re_c*)         (18.52 / 18.57)
C_H* = 0.332 / sqrt(Re_x*) * (Pr*)^(-2/3)                            (18.55)
Re_x* = rho* * ue * x / mu*       c_f* = tau_w / (0.5*rho*(ue^2))
```
Y para turbulento (Ec. 19.3, p.1054): `C_f* = 0.074 / (Re_c*)^(1/5)`.

**Meador-Smart (2005)**, Ecs. sin numerar (pp.1036 y 1056):
```
laminar:    T*/Te = 0.45 + 0.55*(Tw/Te) + 0.16 * r * ((gamma-1)/2) * Me^2 ,  r = sqrt(Pr*)
turbulento: T*/Te = 0.5*(1 + Tw/Te)     + 0.16 * r * ((gamma-1)/2) * Me^2 ,  r ≈ Pr^(1/3)
```

**Factores de recuperación — la tabla que hay que codificar:**

| Flujo | r | Ec. | pág |
|---|---|---|---|
| Couette (incompresible y compresible con Pr cte) | `r = Pr` | 16.50 / 16.83 | 977 / 992 |
| Placa plana **laminar** | `r = sqrt(Pr)` = 0.843 | 18.47 | 1030 |
| Placa plana **turbulento** | `r ≈ Pr^(1/3)` = 0.892 | (Ej.19.3) | 1056 |

**Analogía de Reynolds — la otra tabla:**

| Flujo | C_H/c_f | Ec. | pág |
|---|---|---|---|
| Couette (inc. y comp.) | `½ Pr^(−1)` | 16.59 / 16.98 | 978 / 994 |
| Placa plana compresible | `½ Pr^(−2/3)` | 18.50 | 1030 |
| Forma general | `C_H = c_f/(2s)`, `s` = "factor de analogía de Reynolds"; placa plana `s = Pr^(2/3)` | 18.93 | 1048 |

**QUÉ SE ROMPE:** *"Reynolds analogy is **greatly affected by strong pressure gradients** in the flow,
and hence **loses its usefulness as an engineering tool** in such cases."* (§18.6, p.1049). En la región
de la nariz de un cuerpo romo, `C_H` es casi constante mientras `c_f` crece rápido ⇒ `s` deja de ser
constante. La API DEBE bloquear la analogía de Reynolds donde |dp/dx| sea grande.

**Precisión medida (los tres números del libro, mismo caso, Me = 2.94):**

| Método | D total | error vs "exacto" |
|---|---|---|
| Solución exacta de capa límite compresible (Ej. 18.1b, vía Fig. 18.8) | 5026 N | (referencia) |
| Temperatura de referencia clásica (Ej. 18.2) | 4976 N | **1 %** |
| Meador-Smart (Ej. 18.3) | 5008 N | **0.4 %** |

*"a stunning example of the accuracy of the reference temperature method"* (p.1036).

### 2.8 Efectos de compresibilidad sobre la placa plana (§18.3)

Transformación (p.1023): `xi = rho_e*mu_e*u_e*x`, `eta = (u_e/sqrt(2*xi)) * ∫rho dy`, `f' = u/u_e`,
`g = h0/(h0)_e`. Resultado, **dos ODEs acopladas auto-similares**:
```
(C*f'')' + f*f'' = 0                                                    (18.42)
(C/Pr * g')' + f*g' + (ue^2/(h0)e)*[ (1 - 1/Pr) * C * f'*f'' ]' = 0     (18.43)
donde  C = rho*mu/(rho_e*mu_e)
y      ue^2/(h0)e = 2*(gamma-1)*Me^2 / (2 + (gamma-1)*Me^2)
```
Solución por **doble shooting** (suponer f''(0) y g'(0); iterar ambas, y como C acopla las dos,
repetir todo el proceso — es el método del §16.4.1 aplicado dos veces).

Los resultados se empaquetan como **correcciones sobre las fórmulas incompresibles**:
```
C_f   = (1.328 / sqrt(Re_c)) * F(Me, Pr, Tw/Te)                         (18.44)
c_f   = (0.664 / sqrt(Re_x)) * F(Me, Pr, Tw/Te)                         (18.51)
delta = (5.0*x / sqrt(Re_x)) * G(Me, Pr, Tw/Te)                         (18.45)
```
**F y G solo existen como Figuras 18.8 y 18.9 — NO LEGIBLES (ver §7).** Lo que sí queda del texto:
- `F` **decrece** al subir Me y también al calentar la pared ⇒ compresibilidad y pared caliente
  **reducen** C_f.
- `G` **crece** al subir Me y con pared caliente ⇒ compresibilidad y pared caliente **engordan** la capa.
- **Pared fría adelgaza la capa** (explicación física, p.1026): T menor ⇒ a presión constante ρ mayor ⇒
  el mismo gasto másico cabe en menos espesor.
- Un solo punto numérico rescatable de la Fig. 18.8: **`C_f*sqrt(Re_c) = 1.2` para Me = 2.94, pared
  adiabática, Pr = 0.75** (Ej. 18.1b, p.1031).
- Y uno de la Fig. 19.1: **`C_f = 1.34e-3` para Re_c = 1.36e8, M∞ = 2.94, turbulento, pared
  adiabática** (Ej. 19.1b, p.1055).

### 2.9 Calentamiento en el punto de estancamiento (§18.5)

Ecuaciones auto-similares (Ecs. 18.63/18.64 cilindro, 18.68/18.69 esfera). Correlaciones finales
(Referencia 78 = Van Driest, *The Problem of Aerodynamic Heating*, 1956):
```
Cilindro (2D):  q_w = 0.57  * Pr^(-0.60) * (rho_e*mu_e)^(1/2) * sqrt(du_e/dx) * (h_aw - h_w)   (18.65)
Esfera   (3D):  q_w = 0.763 * Pr^(-0.65) * (rho_e*mu_e)^(1/2) * sqrt(du_e/dx) * (h_aw - h_w)   (18.70)
```
> **[RECONSTRUCCIÓN DECLARADA]** El radical sobre `du_e/dx` se perdió en el `pdftotext` (quedó una
> línea vacía sobre "du_e / dx"). Lo reconstruyo **desde el propio libro, no desde memoria**: el libro
> deriva `du_e/dx = (1/R)*sqrt(2*(pe - p_inf)/rho_e)` (Ec. 18.82) y concluye `q_w ∝ 1/sqrt(R)`
> (Ec. 18.83) — lo cual solo es consistente si `du_e/dx` entra bajo raíz. Además, el exponente `1/2`
> sobre `(rho_e*mu_e)` también se perdió en la línea de la esfera; el texto dice *"The equations are the
> same except for the leading coefficient"*, así que es el mismo `1/2`.

Derivación de `du_e/dx` en el estancamiento (Ecs. 18.71–18.82, con distribución de presión newtoniana
`Cp = 2*cos^2(phi)`):
```
du_e/dx = (1/R) * sqrt( 2*(pe - p_inf) / rho_e )                        (18.82)
=>  q_w ∝ 1 / sqrt(R)                                                   (18.83)
```
**Verificación experimental citada:** Fig. 18.12 — datos de Boylan (AEDC, M=21), Ferri-Zakkay (M=8) y
Koppenwallner (DFVLR, M=21) en log-log con **pendiente −0.5**, confirmando `q_w ∝ 1/sqrt(R)` (p.1042).

**Detalle contraintuitivo que el software debe manejar** (§18.5, p.1037): en el punto de estancamiento
`u_e = 0` y `T_e = T_0`, pero **la capa límite existe y tiene espesor finito**; `u/u_e = 0/0` es una
indeterminación con valor finito en cada punto. Y `tau_w = 0` exactamente en el punto de estancamiento
*"it is obvious by inspection. Along the wall above point A the shear stress acts upward, and below
point A it acts downward."*

### 2.10 Couette — las soluciones exactas (§16)

Reducción exacta (no aproximada) de Navier-Stokes bajo `v=w=0`, `∂/∂x = 0`, estacionario (Ecs. 16.1–16.3).
**Presión constante en todo el campo** — el flujo lo mantiene el esfuerzo cortante, no un gradiente de
presión (p.963). Resultados incompresibles:
```
u = ue * (y/D)             perfil LINEAL                                (16.6)
tau = mu * ue / D          CONSTANTE a través del flujo                 (16.9)
c_f = 2 / Re,   Re = rho_e*ue*D/mu                                      (16.54)
C_H = 1/(Re*Pr)                                                         (16.58)
h = hw + [he - hw + (Pr/2)ue^2]*(y/D) - (Pr/2)*ue^2*(y/D)^2  -> PARABÓLICO  (16.16)
q = -mu*[ (he-hw)/Pr + ue^2/2 ]*(1/D) + tau*u                           (16.21)
```
- `q` **no** es constante a través del flujo (a diferencia de `tau`); varía linealmente por la
  **disipación viscosa** `tau*u`.
- Paredes a igual temperatura: `T_max = Tw + Pr*ue^2/(8*cp)` en `y = D/2` (16.34); `q_w = tau*ue/2` (16.37).
- Pared adiabática: `h_aw = he + Pr*ue^2/2` (16.39), `T_aw = Te + Pr*ue^2/(2*cp)` (16.40).

**Compresible** (§16.4): `tau` sigue constante, pero `mu = mu(y)` ⇒ `du/dy` **NO** es constante.
Requiere solución numérica de `d/dy(k*dT/dy) + tau*du/dy = 0` (Ec. 16.64), problema de valores de
frontera en dos puntos. Dos métodos, ambos descritos paso a paso:
- **§16.4.1 Shooting** (7 pasos, dos iteraciones menores anidadas en una mayor) — la plantilla que se
  reusa tal cual para Blasius (§18.2) y para la placa plana compresible (§18.3).
- **§16.4.2 Diferencias finitas dependientes del tiempo** (MacCormack predictor-corrector, Ecs.
  16.70–16.73) con **criterio CFL** `dt = min(dx/(u+a), dy/(v+a))` (Ec. 16.74) — la plantilla del cap. 20.

**Resultado conceptual importante** (§16.4.3, p.990): *"there is no discontinuous change in the flow-field
behavior in going from subsonic to supersonic [para flujo viscoso] as is the case for an inviscid flow.
Qualitatively, a supersonic viscous flow is similar to a subsonic viscous flow."* Razón física: la
información viscosa se transporta por difusión molecular (μ, k), no por ondas de presión. **Pero
cuantitativamente cambia enormemente**: a A = (γ−1)·Pr·Me² = 30 (Me ≈ 10) la temperatura en el medio
del flujo es casi **cinco veces** la de la pared (caso pared fría) y más de **quince veces** en el caso
adiabático.

---

## 3. FIXTURES DE TEST

Todos los ejemplos numéricos resueltos de los capítulos 15–20, más las constantes universales.

```
FIXTURE anderson-const-blasius  [§18.2, pp.1018–1021]
entradas: resolver 2*f''' + f*f'' = 0 con f(0)=0, f'(0)=0, f'(inf)=1
salida esperada:
  f''(0)                    = 0.332
  eta tal que f' = 0.99     = 5.0
  eta1 - f(eta1)  (eta1>5)  = 1.72
  integral_0^eta1 f'*(1-f') = 0.664
  invariantes: delta* = 0.34*delta ; theta = 0.39*delta* ; theta = 0.13*delta
tolerancia: 1 % (el libro da 3 cifras)
```

```
FIXTURE anderson-transicion-15.2  [§15.2, p.935]
entradas: rho_inf = 1.23 kg/m3, mu_inf = 1.79e-5 kg/(m*s), V_inf = 120 m/s, x_cr medido = 0.05 m
salida esperada: Re_cr = 412,000
caso B: mismo Re_cr, V_inf = 240 m/s  =>  x_cr = 0.025 m
tolerancia: 1 %
nota: es el ejemplo de calibración del criterio de transición; la regla de dedo del libro es
      Re_cr ~= 500,000 y este caso real da 412,000  => la regla es aproximada por diseño
```

```
FIXTURE anderson-ej-16.1  [§16.3.6 EXAMPLE 16.1, pp.979–980]
Couette incompresible, unidades imperiales
entradas: ue = 200 ft/s, D = 0.01 in = 8.33e-4 ft, aire,
          Tw = Te = 519 R, mu = 3.7373e-7 slug/(ft*s), Pr = 0.71, cp = 6006 (ft*lb)/(slug*R)
salidas esperadas:
  (a) u en y = D/2                 = 100 ft/s
  (b) tau_w                        = 0.09 lb/ft2
  (c) T_max (en y/D = 0.5)         = 519.6 R      (Tw + Pr*ue^2/(8*cp) = 519 + 0.6)
  (d) q_w (ambas paredes)          = 8.97 (ft*lb)/(ft2*s) = 0.0115 Btu/(ft2*s)
  (e) T_aw (pared inferior adiab.) = 521.36 R     (519 + 2.36)
      Me del plato superior        = 0.18
tolerancia: 1 %
nota: T_aw (521.36) > T_max del caso pared fría (519.6). El libro lo generaliza:
      "for cold wall cases, the viscous dissipation in the flow is not sufficient to heat the gas
       anywhere in the flow to a temperature as high as the adiabatic wall temperature"
```

```
FIXTURE anderson-ej-16.2  [§16.4.4 EXAMPLE 16.2, pp.994–995]
Couette compresible, SI
entradas: D = 0.01 in, Tw = Te = 288 K, p = 1 atm = 1.01e5 N/m2, Me = 3, tau_w = 72 N/m2,
          cp = 1004.5 J/(kg*K), Pr = 0.71, R = 287
salidas esperadas:
  ue    = 1020 m/s
  rho_e = 1.22 kg/m3
  c_f   = 1.13e-4
  C_H   = 8e-5          (via analogia de Reynolds C_H = c_f/(2*Pr))
  h_aw  = 6.59e5 J/kg   =>  T_aw = 656 K
  h_w   = 2.89e5 J/kg
  q_w   = 3.68e4 W/m2
tolerancia: 1 %
```

```
FIXTURE anderson-mach-limite-Pr  [§16.4.4, p.991]
entradas: T_estatica = 288 K, T0 objetivo = 1000 K, gamma = 1.4
salida esperada: M = 3.5
significado: hasta M ~= 3.5 la temperatura dentro de la capa viscosa no pasa de 1000 K, y por tanto
             Pr ~= 0.71 constante es defendible. "A Mach number of 3.5 or less encompasses virtually
             all operational aircraft today"
tolerancia: 1 %
```

```
FIXTURE anderson-ej-18.1a  [§18.3 EXAMPLE 18.1a, p.1031]  -- LAMINAR INCOMPRESIBLE
entradas: placa plana alpha=0, nivel del mar (p_inf = 1.01e5 N/m2, T_inf = 288 K),
          c = 2 m, S = 40 m2 (por cara), mu_inf = 1.7894e-5 kg/(m*s), pared adiabatica,
          V_inf = 100 m/s
salidas esperadas:
  rho_inf = 1.22 kg/m3 ; a_inf = 340.2 m/s ; M_inf = 0.29
  Re_c    = 1.36e7
  C_f     = 3.60e-4              (= 1.328/sqrt(Re_c))
  D_f     = 87.8 N               (UNA cara)
  D total = 175.6 N              (DOS caras)
tolerancia: 1 %
```

```
FIXTURE anderson-ej-18.1b  [§18.3 EXAMPLE 18.1b, pp.1031–1032]  -- LAMINAR COMPRESIBLE
entradas: iguales, pero V_inf = 1000 m/s
salidas esperadas:
  M_inf = 2.94 ; Re_c = 1.36e8
  C_f*sqrt(Re_c) = 1.2           <-- LEIDO DE LA FIGURA 18.8 (NO OBSERVADA, ver §7)
  C_f     = 1.03e-4
  D_f     = 2513 N ; D total = 5026 N
tolerancia: 1 % sobre los numeros, PERO el dato de entrada 1.2 no es reproducible sin la Figura 18.8.
DEPENDENCIA DE FIGURA: este fixture solo cierra si alimentamos 1.2 a mano, o si precomputamos
                       nosotros la funcion F(Me, Pr, Tw/Te) resolviendo las Ecs. 18.42/18.43.
```

```
FIXTURE anderson-ej-18.1-noVcuadrado  [§18.3.1, p.1032]  -- LECCION, no solo numero
entradas: los dos casos anteriores
salida esperada: al multiplicar V_inf por 10, el arrastre NO se multiplica por 100 (17,560 N)
                 sino por 28.6 (5026 N)
razon: C_f cae porque (1) sube Re y (2) sube Me
tolerancia: exacta (es una comparacion)
```

```
FIXTURE anderson-ej-18.2  [§18.4 EXAMPLE 18.2, pp.1034–1036]  -- TEMPERATURA DE REFERENCIA
entradas: mismo caso que 18.1b (Me = 2.94, Te = 288 K, p = 1.01e5, c = 2 m, S = 40 m2,
          pared adiabatica, Pr = Pr* = 0.71)
pasos y salidas esperadas:
  r = sqrt(Pr) = 0.843
  T0/Te  = 2.74          <-- del Apendice A (fila M = 2.95; ver NOTA)
  Taw/Te = 1 + r*(T0/Te - 1) = 2.467
  T*/Te  = 1 + 0.032*Me^2 + 0.58*(Taw/Te - 1) = 2.1275  =>  T* = 612.7 K
  rho*   = 0.574 kg/m3
  mu*/mu0 = 1.709  =>  mu* = 3.058e-5 kg/(m*s)     (Sutherland, mu0=1.7894e-5, T0ref=288 K)
  Re_c*  = 3.754e7
  C_f*   = 2.167e-4      (= 1.328/sqrt(Re_c*))
  D_f    = 2488 N ; D total = 4976 N
  error vs Ej. 18.1b (5026 N): 1 %
tolerancia: 1 %
NOTA / ERRATA DECLARADA: el libro toma T0/Te = 2.74, que es la fila M = 2.95 del Apendice A
  (linea 50778+ del txt). El valor isentropico EXACTO a Me = 2.94 es 1 + 0.2*2.94^2 = 2.7287.
  La diferencia propaga ~0.3 % a T* y ~0.1 % a C_f, absorbida por la tolerancia de 1 %.
  Nuestro codigo debe usar el valor EXACTO y el test debe tolerarlo, o el fixture falla en silencio.
```

```
FIXTURE anderson-ej-18.3  [§18.4.1 EXAMPLE 18.3, pp.1036–1037]  -- MEADOR-SMART LAMINAR
entradas: iguales a 18.2
formula: T*/Te = 0.45 + 0.55*(Tw/Te) + 0.16*r*((gamma-1)/2)*Me^2 , r = sqrt(Pr*) = 0.843
pasos y salidas esperadas:
  T*/Te   = 1.807 + 0.027*Me^2 = 2.04   =>  T* = 587.5 K
  rho*    = 0.599 kg/m3
  mu*/mu0 = 1.664  =>  mu* = 2.978e-5
  Re_c*   = 4.02e7
  C_f*    = 2.09e-4
  D_f     = 2504 N ; D total = 5008 N
  error vs Ej. 18.1b (5026 N): 0.4 %
tolerancia: 1 %
ERRATAS DEL LIBRO DECLARADAS (comprobadas por aritmetica, NO inventadas):
  (1) al calcular Re_c* el libro escribe "(0.500)(1000)(2)" cuando rho* = 0.599. El resultado
      impreso 4.02e7 SI corresponde a 0.599 => el 0.500 es un error tipografico.
  (2) el libro imprime "C_f* = 2.09 x 10^4"; debe ser 2.09e-4 (con 2.09e4 el arrastre seria absurdo,
      y el D_f = 2504 N impreso corresponde a 2.09e-4).
```

```
FIXTURE anderson-ej-19.1a  [§19.2 EXAMPLE 19.1a, p.1054]  -- TURBULENTO INCOMPRESIBLE
entradas: mismo caso que 18.1a (Re_c = 1.36e7, rho_inf = 1.22, S = 40 m2, V_inf = 100 m/s)
salidas esperadas:
  Re_c^(1/5) = 26.71
  C_f     = 0.074/26.71 = 2.77e-3
  D_f     = 675.9 N ; D total = 1352 N
  RAZON turbulento/laminar = 1352/175.6 = 7.7
tolerancia: 1 %
```

```
FIXTURE anderson-ej-19.1b  [§19.2 EXAMPLE 19.1b, p.1055]  -- TURBULENTO COMPRESIBLE
entradas: Re_c = 1.36e8, M_inf = 2.94, rho_inf = 1.22, S = 40 m2, V_inf = 1000 m/s
salidas esperadas:
  C_f     = 1.34e-3               <-- LEIDO DE LA FIGURA 19.1 (NO OBSERVADA, ver §7)
  D_f     = 32,700 N ; D total = 65,400 N
  RAZON turbulento/laminar = 65,400/5026 = 13
tolerancia: 1 %
DEPENDENCIA DE FIGURA: igual que 18.1b.
LECCION: "The difference between the drag for laminar and turbulent flow is more pronounced at
         higher speeds" (7.7x a M=0.29 -> 13x a M=2.94)
```

```
FIXTURE anderson-ej-19.2  [§19.2.1 EXAMPLE 19.2, p.1055]  -- TURBULENTO POR TEMP. DE REFERENCIA
entradas: se reusan Re_c* = 3.754e7 y rho* = 0.574 del Ej. 18.2 (el libro asume el mismo T*,
          reconociendo explicitamente que el factor de recuperacion turbulento es distinto y que
          "we will not account for that difference")
salidas esperadas:
  C_f*    = 0.074/(3.754e7)^(1/5) = 2.26e-3
  D_f     = 25,945 N ; D total = 51,890 N
  discrepancia vs Ej. 19.1b (65,400 N): 20 %
tolerancia: 1 % sobre el numero, pero el 20 % ES el resultado que hay que enseniar
```

```
FIXTURE anderson-ej-19.3  [§19.2.2 EXAMPLE 19.3, pp.1056–1057]  -- MEADOR-SMART TURBULENTO
entradas: Me = 2.94, Te = 288 K, p = 1.01e5, c = 2 m, S = 40 m2, pared adiabatica, Pr = 0.71
formula: T*/Te = 0.5*(1 + Tw/Te) + 0.16*r*((gamma-1)/2)*Me^2 , r = Pr^(1/3) = 0.892
pasos y salidas esperadas:
  T0/Te   = 2.74 ; Taw/Te = 1 + 0.892*1.74 = 2.55
  T*/Te   = 0.5*(1+2.55) + 0.2467 = 2.02  =>  T* = 581.8 K
  rho*    = 0.605 kg/m3
  mu*/mu0 = 1.651  =>  mu* = 2.95e-5 kg/(m*s)
  Re_c*   = 4.1e7
  C_f*    = 0.02667/(4.1e7)^0.139 = 2.32e-3
  D_f     = 28,070 N ; D total = 56,140 N
  discrepancia vs Ej. 19.1b: 14 %  (mejor que el 20 % del metodo clasico)
tolerancia: 1 %
ERRATA DEL LIBRO DECLARADA: imprime "mu* = 2.05e-5" pero acto seguido usa 2.95e-5 en Re_c*.
  1.651 * 1.7894e-5 = 2.954e-5  => 2.95e-5 es el correcto; 2.05e-5 es tipografico.
```

```
FIXTURE anderson-tabla-20.4  [§20.4, p.1076, estudio de Lombardi et al., Referencia 88]
entradas: NACA 0012, alpha = 0, baja velocidad, Re = 3e6
salidas esperadas (C_f x 10^3):
  Navier-Stokes (k-epsilon estandar)   7.486    ->  +40 % vs baseline
  Navier-Stokes (RNG k-epsilon)        6.272    ->  +18 % vs baseline
  Navier-Stokes (Reynolds stress)      6.792    ->  +27 % vs baseline
  Solucion de capa limite (validada)   5.340    ->  BASELINE
conclusion del libro: "the accuracy of the various Navier-Stokes calculations ranged from
                      18 percent to 40 percent"
tolerancia: exacta (son numeros tabulados)
USO: este es el fixture de HONESTIDAD del producto. Cualquier C_f turbulento que reportemos por
     CFD debe venir con una banda de +-20 %.
```

### Fixtures que el libro deja como problemas (NO resueltos — no son fixtures hasta que los resolvamos)

`§19.6, p.1062` — los enunciados son excelentes ejercicios de escuela, pero **el libro no da la
respuesta**; marcarlos como tales:
- **19.1** Ala del Piper Cherokee: rectangular, envergadura 9.75 m, cuerda 1.6 m, crucero 141 mi/h a
  nivel del mar. Arrastre de fricción (a) todo laminar, (b) todo turbulento.
- **19.2** Espesor de capa límite en el borde de fuga para (a) y (b).
- **19.3** Igual con **transición a Re = 5e5**.
- **19.4** Mach 4, nivel del mar, cuerda 5 in, todo laminar, pared adiabática, arrastre por unidad de
  envergadura. **19.5** igual pero turbulento.
- **19.6** Demostrar `T0 = Tw + (T0,e − Tw)·(u/ue)` para Pr = 1 y gas caloríficamente perfecto.
- **19.7** Calentamiento en punto de estancamiento a 35 km (p = 583.59 N/m², T = 246.1 K), nariz
  esférica R = 2.54 cm, Pr = 0.72, cp = 1008 J/(kg·K), Tw = 400 K, r = 1.0, para V = 1500 y 4500 m/s.

También quedan como problemas los del cap.15 (`§15.9, p.957`): **15.1** Couette con placas separadas h,
T = 320 K, ue = 30 m/s, h = 0.01 m → esfuerzo en ambas placas; **15.2** flujo de Poiseuille con
dp/dx = cte.

---

## 4. DECISIONES HUMANAS — dónde juzga el ingeniero y el software NO debe decidir

1. **Laminar vs turbulento: no hay respuesta automática.** §15.2, p.933:
   *"For the flow over a body, is laminar or turbulent flow preferable? **There is no pat answer; it
   depends on the shape of the body.** ... The above comments are not all-inclusive; they simply state
   general trends, and for any given body, the aerodynamic virtues of laminar versus turbulent flow
   **must always be assessed**."*
   → El software presenta los dos números (D_f laminar, D_f turbulento, y la estimación de D_p) y el
   ingeniero elige la estrategia. Nunca "optimizar" solo.

2. **Dónde poner la transición.** §15.2, p.935: *"The value of Re_cr for a given body under specified
   conditions is **difficult to predict**; indeed, the analysis of transition is still a very active
   area of modern aerodynamic research."* La regla de 500,000 es **regla de dedo**, no física.
   → x_cr debe ser un **input con default declarado**, con las cuatro perillas de §15.2 visibles.

3. **Cuánto flujo laminar es realizable en fabricación.** §15.2, p.934: irregularidades de manufactura
   y manchas de insectos arruinan el laminar de los NACA serie 6. → Es una decisión de programa
   (acabado superficial, mantenimiento), no de aerodinámica.

4. **Si vale la pena el lazo viscoso-invíscido.** §17.2, p.1004: el libro dice que en capas muy
   delgadas *"the effective body can be ignored"*, pero que para alta precisión o capas gruesas
   (hipersónico) *"the iterative procedure described above **should** be carried out."*
   → Interruptor de usuario, con el criterio (δ/c) a la vista.

5. **La viscosidad de volumen λ.** §15.3, p.939: *"the correct expression for the bulk viscosity is
   still somewhat controversial."* Usamos Stokes (λ = −⅔μ) por convención declarada.

6. **Elegir modelo de turbulencia.** §19.3.1, p.1059: las seis constantes de Baldwin-Lomax se dan *"with
   the understanding that, **while they are not precisely the correct constants for most flows in
   general**, they have been used successfully for a number of different applications."* Y §20.4 muestra
   que tres modelos distintos dan 18 %, 27 % y 40 % de error sobre el mismo perfil.
   → El modelo de turbulencia lo elige el ingeniero, y el reporte DEBE nombrarlo.

7. **Cuándo NO usar la analogía de Reynolds.** §18.6, p.1049: *"Reynolds analogy is greatly affected by
   strong pressure gradients in the flow, and hence loses its usefulness as an engineering tool in such
   cases."* → El software puede advertir, pero la decisión de aceptar el estimado es del ingeniero.

8. **Cuándo escalar de capa límite a Navier-Stokes.** §20.4, p.1073: capa límite es *"the preferred
   engineering approach"*; Navier-Stokes *"still not in the category of 'quick engineering
   calculations.'"* → Regla dura sugerida: si el solver de capa límite reporta separación, ya no se
   puede confiar en su número — es momento de decidir (rediseñar o pagar CFD).

9. **Cuántas cifras significativas publicar.** §20.4, p.1076: 20 % de exactitud en C_f turbulento por
   RANS. → Presentar `C_f = 6.3e-3 ± 20 %`, no `C_f = 6.272e-3`.

---

## 5. COSTO DE CÓMPUTO

| Método | § | Costo | Por qué |
|---|---|---|---|
| Ley de Sutherland μ(T), k = 1.45·μ·cp | 15.3 | `[NAVEGADOR]` | Dos potencias. Nanosegundos. |
| Blasius: δ, δ\*, θ, c_f, C_f (5 fórmulas cerradas) | 18.2 | `[NAVEGADOR]` | Una raíz cuadrada cada una. **Esto es lo que le suma arrastre al método de paneles en tiempo real.** |
| Perfil de Blasius f'(η) por RK4 + shooting | 18.2 | `[PRECÓMPUTO]` (1 vez, se sirve como tabla) | El perfil es **universal**: no depende de x ni de Re. Se resuelve una vez y se guarda como LUT de ~200 puntos. Recalcularlo en cada frame es desperdicio. |
| Correlaciones turbulentas δ, C_f (0.37/0.074) | 19.2 | `[NAVEGADOR]` | Una potencia. |
| Meador-Smart lam./turb. (T\*, c_f, C_f) | 18.4.1 / 19.2.2 | `[NAVEGADOR]` | Álgebra pura. |
| Método de temperatura de referencia completo | 18.4 | `[NAVEGADOR]` | T\* → ρ\* → Sutherland → Re\* → fórmula incompresible. ~10 operaciones. |
| Factor de recuperación + analogía de Reynolds → q̇_w | 16.3.4/16.3.5, 18.3 | `[NAVEGADOR]` | Dos multiplicaciones. |
| Calentamiento en punto de estancamiento (18.65/18.70) | 18.5 | `[NAVEGADOR]` | Cerrada, una vez conocido du_e/dx (que sale de la Ec. 18.82 o del método de paneles). |
| Couette incompresible completo (perfiles, τ, q̇) | 16.3 | `[NAVEGADOR]` | Todo analítico. Ideal para la primera lección. |
| Couette compresible por shooting | 16.4.1 | `[NAVEGADOR]` | ODE 2º orden, ~200 pasos, doble iteración. Milisegundos. |
| **Placa plana compresible auto-similar (18.42/18.43) → F(Me,Pr,Tw/Te) y G(...)** | 18.3 | `[PRECÓMPUTO]` **(prioridad alta)** | Dos ODEs acopladas con doble shooting: ~segundos por punto. Pero **solo depende de 3 parámetros**. Barremos (Me: 0–20 × Pr: 0.7–0.75 × Tw/Te: 0.25–4) en la 4070 Ti y servimos la tabla. **Esto reemplaza las Figuras 18.8 y 18.9 que no podemos leer** (§7) y desbloquea los fixtures 18.1b y 19.1b. |
| Capa límite no similar, marcha en diferencias finitas (18.84–18.86) | 18.6 | `[NAVEGADOR]` | Marcha corriente abajo: O(N_x·N_y) con N_x≈200, N_y≈100 = 20k celdas por barrido. Explícito (θ=0) es directo; implícito (θ=½ Crank-Nicolson, θ=1) exige resolver matrices tridiagonales por bloques — sigue siendo milisegundos en JS. |
| **Lazo viscoso-invíscido completo (5 pasos de §17.2)** | 17.2 | `[NAVEGADOR]` | (paneles + marcha de capa límite) × 3–5 iteraciones. **El producto entero cabe en el navegador.** Este es el hallazgo arquitectónico de mi bloque. |
| Baldwin-Lomax (μ_T algebraico) | 19.3.1 | `[NAVEGADOR]` como modelo, pero exige un solver que le dé ω y ρ | Es álgebra (Ecs. 19.6–19.14). El costo está en el solver anfitrión, no en el modelo. |
| MacCormack dependiente del tiempo sobre Couette | 16.4.2 | `[PRECÓMPUTO]` | Cientos a miles de pasos de tiempo con CFL. Como demo educativa: precomputar la animación. |
| **Navier-Stokes completas (RANS) 2D sobre perfil** | 20.3.2 | `[GPU-VIVO]` | Malla curvilínea ajustada al cuerpo, refinamiento de pared, modelo de turbulencia, marcha temporal hasta estado estacionario. |
| **Navier-Stokes 3D avión completo / choque-capa límite / protuberancia** | 20.3.3–20.3.5 | `[GPU-VIVO]` | El libro: *"anywhere from thousands to close to a million grid points... these are problems that must be solved on large-scale digital computers"* (p.1065). Malla quimera con parches solapados (Figs. 20.8–20.11). |

**Conclusión de arquitectura, defendible con cita:** todo lo que el cliente necesita para diseño
conceptual — arrastre de fricción, espesores, calentamiento, punto de separación aproximado — es
`[NAVEGADOR]`. Lo confirma el propio autor (§20.4, p.1073): *"the use of boundary-layer solutions for
skin friction and aerodynamic heating is the preferred engineering approach."* El `[GPU-VIVO]` se
reserva para verificación puntual y para lo que la capa límite estructuralmente no puede: separación
extensa, choque-capa límite, protuberancias.

---

## 6. ESCUELA — lecciones de este bloque

Todas viven **dentro del CAD** (`forja-brep.html`): el alumno DIBUJA la geometría con croquis y cotas y
la analiza con un estudio. No hay simulador de juguete aparte.

### L-V1 — "El arrastre que el flujo potencial te escondió"
- **Construir:** una placa plana con croquis (cuerda acotada, 2 m). Estudio: flujo potencial → CD = 0.
- **Mover:** activar el módulo viscoso; deslizar V∞ de 10 a 100 m/s.
- **Ver:** el CD deja de ser cero; aparece la capa límite dibujada a escala real con u(0) = 0.
- **Verificar contra el número:** `anderson-ej-18.1a` → D total = **175.6 N** a V∞ = 100 m/s, S = 40 m².
- **Cita que se le muestra al alumno:** *"the calculation of all other forms of drag must explicitly
  take into account the presence of viscosity"* (§15.1, p.926).

### L-V2 — "δ, δ\* y θ: tres espesores, tres significados"
- **Construir:** la misma placa; el alumno acota tres estaciones x (0.5, 1.0, 2.0 m).
- **Mover:** V∞ (⇒ Re_x) y ver los tres espesores crecer como x^(1/2).
- **Ver:** δ\* dibujado como el **desplazamiento real de la línea de corriente externa** (Fig. 17.5), no
  como una curva abstracta.
- **Verificar:** invariantes `δ* = 0.34δ`, `θ = 0.39δ*`, `θ = 0.13δ` (fixture `anderson-const-blasius`),
  y `C_f = 2·θ(c)/c` (Ec. 18.30).

### L-V3 — "El cuerpo efectivo: cómo el paneles aprende a tener arrastre"
- **Construir:** un perfil (NACA 0012) con croquis.
- **Mover:** botón "acoplar capa límite" que ejecuta los **5 pasos de §17.2** iterando en vivo, mostrando
  el contorno efectivo (cuerpo + δ\*) separándose del contorno real en cada iteración.
- **Ver:** el Cp cambiar entre iteración 1 y la convergida; el δ\* engordando hacia el borde de fuga.
- **Verificar:** con dp/dx = 0 forzado (placa plana) el lazo debe reproducir Blasius exactamente
  (`c_f = 0.664/√Re_x`). Es el test de consistencia del acoplamiento.

### L-V4 — "El acantilado: cuándo tu ala deja de creerle a la teoría"
- **Construir:** perfil con ángulo de ataque acotado.
- **Mover:** subir α de 0° a 20° en pasos de 1°.
- **Ver:** (a) el gradiente de presión coloreado, con la zona **adversa** en rojo creciendo hacia el
  borde de ataque; (b) el punto donde `∂u/∂y|_w = 0` (criterio de §15.2, p.929) marchando hacia
  adelante; (c) la curva Cl(α) de perfil delgado (2π·α) volviéndose **línea punteada** desde el α donde
  aparece la separación, con la etiqueta "aquí la teoría deja de ver".
- **Verificar:** el propio libro no da un α de stall numérico en estos capítulos (§7). El número lo pone
  otro bloque (Anderson §4.3, fuera de mi rango). Lo que SÍ se verifica aquí es el **mecanismo**:
  §20.3.2, p.1066 — a Re = 100,000 el flujo laminar sobre un Wortmann a **α = 0** ya se separa en ambas
  caras, y con turbulencia queda adherido. El alumno debe reproducir ese contraste.
- **Cita:** *"Such separated flow is the cause of airfoil stall"* (§15.2, p.931).

### L-V5 — "El factor 7.7: la transición vale dinero"
- **Construir:** el ala del Piper Cherokee del problema 19.1 (rectangular, 9.75 m × 1.6 m).
- **Mover:** un cursor de x_cr desde 0 (todo turbulento) hasta c (todo laminar).
- **Ver:** la barra de arrastre de fricción cambiar en tiempo real; el punto de transición dibujado
  sobre el ala.
- **Verificar:** con la placa de los ejemplos, `anderson-ej-19.1a` → **D_turbulento/D_laminar = 7.7**
  a M = 0.29, y `anderson-ej-19.1b` → **13** a M = 2.94.
- **Cita:** *"You can easily see why the understanding of, and prediction of, turbulent flow, especially
  the prediction of when the flow will transist from laminar to turbulent flow, is so important."* (p.1055)

### L-V6 — "Cuatro perillas que mueven la transición"
- **Construir:** placa plana; panel con las cuatro perillas de §15.2 (rugosidad, turbulencia del flujo
  libre, gradiente de presión, temperatura de pared).
- **Mover:** cada una.
- **Ver:** x_cr moviéndose; explicación con el caso real de los NACA serie 6.
- **Verificar:** `anderson-transicion-15.2` → Re_cr = **412,000** con V∞ = 120 m/s, x_cr = 0.05 m; y al
  duplicar V∞, x_cr se parte a la mitad manteniendo Re_cr.

### L-V7 — "Compresibilidad barata: el método de temperatura de referencia"
- **Construir:** la placa de 2 m del Ej. 18.1.
- **Mover:** M∞ de 0.3 a 5, con selector de tres métodos (incompresible, T\* clásico, Meador-Smart).
- **Ver:** las tres curvas de C_f divergiendo con M∞; la temperatura de pared adiabática subiendo.
- **Verificar:** `anderson-ej-18.2` → D = **4976 N** (1 % del exacto) y `anderson-ej-18.3` → D =
  **5008 N** (0.4 %). El alumno debe **medir el error él mismo** contra 5026 N.

### L-V8 — "Por qué las naves reentran de nariz gorda"
- **Construir:** una nariz roma con croquis; **el radio R es la cota que el alumno mueve**.
- **Mover:** R de 1 cm a 50 cm.
- **Ver:** q̇_w cayendo como 1/√R; una escala de material ("aquí funde el acero, aquí no").
- **Verificar:** que la curva log-log tenga **pendiente −0.5** (Ec. 18.83, confirmada
  experimentalmente en Fig. 18.12). Y que la esfera caliente más que el cilindro (0.763 vs 0.57,
  Ecs. 18.70 / 18.65) — con la explicación del **alivio tridimensional** (p.1040).

### L-V9 — "La honestidad del CFD" (lección de criterio, no de cálculo)
- **Construir:** NACA 0012 a α = 0, Re = 3e6.
- **Mover:** selector de método: capa límite / RANS con tres modelos de turbulencia.
- **Ver:** las cuatro respuestas de `anderson-tabla-20.4` una al lado de otra, con la de capa límite
  marcada como **validada experimentalmente**.
- **Verificar:** el alumno debe calcular los errores (18 %, 27 %, 40 %) y responder: *¿con cuántas
  cifras significativas puedes publicar tu C_f?*
- **Cita:** *"the ability of Navier-Stokes solutions to predict skin friction in a turbulent flow seems
  to be no better than about 20 percent accuracy, on the average"* (p.1076).

### L-V10 — "Couette: el laboratorio de bolsillo" (lección de entrada, la más simple)
- **Construir:** dos placas paralelas con la separación D acotada.
- **Mover:** u_e y las dos temperaturas de pared.
- **Ver:** perfil de velocidad **lineal**, perfil de temperatura **parabólico**, τ constante y q̇
  **variable** (por disipación viscosa). Botón "hacer adiabática la pared inferior" → T_aw aparece.
- **Verificar:** `anderson-ej-16.1` (τ_w = 0.09 lb/ft², T_max = 519.6 °R, T_aw = 521.36 °R) y
  `anderson-ej-16.2` (q̇_w = 3.68e4 W/m², T_aw = 656 K a Me = 3).
- **Por qué primero:** es la única parte del bloque con solución **cerrada exacta** de Navier-Stokes.
  Regala los conceptos (recuperación, analogía de Reynolds, pared adiabática) sin geometría encima.
  El libro lo dice: *"you must learn to walk before you can run"* (p.959).

---

## 7. NO OBSERVADO

El `.txt` viene de `pdftotext`: **todas las figuras eran imagen y no están**. Listo las que soportan un
requisito o un fixture, separando las que son solo esquemas (recuperables del texto) de las que
contienen **datos que no puedo reconstruir**.

### 🔴 CRÍTICAS — contienen datos que un fixture necesita y no puedo obtener

| Figura | Pág | Qué contiene | Impacto |
|---|---|---|---|
| **18.8** | 1029 | `C_f·√Re_c` vs Me, paramétrico en Tw/Te, Pr = 0.75 (cálculos de van Driest, NACA TN 2597) | **Bloquea el fixture `anderson-ej-18.1b`.** Solo rescato UN punto del ejemplo resuelto: `C_f·√Re_c = 1.2` en Me = 2.94, pared adiabática. Es la función `F(Me, Pr, Tw/Te)` de las Ecs. 18.44/18.51. |
| **19.1** | 1053 | `C_f` vs Re∞ paramétrico en M∞, laminar y turbulento, pared adiabática Pr = 0.75 (van Driest 1951) | **Bloquea `anderson-ej-19.1b`.** Solo rescato: `C_f = 1.34e-3` en Re_c = 1.36e8, M∞ = 2.94. |
| **18.9** | 1029 | `δ·√Re_x/x` vs Me paramétrico en Tw/Te | Es la función `G(...)` de la Ec. 18.45. Del texto solo la tendencia: G crece con Me y con pared caliente. Ningún valor numérico. |
| **16.9 / 16.10** | 988 / 989 | Perfiles u/ue y T/Tw de Couette compresible vs y/D, paramétricos en `A = (γ−1)·Pr·Me²` (de White, Ref. 41) | Del texto rescato solo: a A = 30 (Me≈10) el T central es ~5× Tw (pared fría) y >15× Te (adiabática). Sin curvas. |
| **16.11** | 990 | μ, k y Pr del aire vs T (de Schetz, Ref. 50) | Sostiene la afirmación "Pr ≈ 0.71 constante hasta ~1000 K". Uso la afirmación textual, no la gráfica. |
| **18.4 / 18.5 / 18.6 / 18.7** | 1025–1028 | Perfiles de velocidad y temperatura en capa límite compresible, Me = 0…20, pared aislada y pared fría (van Driest, NACA TN 2579) | Los ejes SÍ sobrevivieron parcialmente en el `.txt` (marcas de Me = 0,2,4,6,8,12,16,20 y escalas `(y/x)√Re_x` hasta 80 y `T/Te` hasta 80). Del texto rescato la comparación cuantitativa: a Me=20 la capa aislada llega a `(y/x)√Re_x > 60`, la fría a **≈ 30**. Curvas no legibles. |
| **18.12** | 1042 | `C_H` de estancamiento vs Re_2r, log-log, datos de Boylan (M=21), Ferri-Zakkay (M=8), Koppenwallner (M=21) | El texto declara **pendiente −0.5**; eso es lo verificable. Puntos individuales no legibles. |
| **18.14 / 18.15** | 1047–1048 | Perfiles y distribuciones de C_H y c_f sobre hiperboloide axisimétrico a 20,000 ft/s, 100,000 ft, Tw = 1000 K (Blottner, Ref. 80) | Del texto: τ_w = 0 en el estancamiento, sube a un máximo y decae; C_H casi constante en la nariz y luego decae; `C_H/c_f ≈ 1` corriente abajo. Sin números. |
| **20.7** | 1071 | `p_w/p0∞` y `τ_w` vs `(x−x0)/δ0` en interacción choque-capa límite, M=3, Re_δ0 ≈ 10⁶, datos de Reda-Murphy vs cálculo Baldwin-Lomax | Rescato del eje τ_w el rango impreso: −120 a 200 N/m², y `(x−x0)/δ0` de −6 a 6. Curvas no legibles. |
| **20.15 / 20.16** | 1076–1077 | `c_f(x/c)` sobre NACA 0012, tres modelos RANS vs capa límite; y comparación con placa plana | La **tabla** de C_f integrados sí está en el texto (fixture `anderson-tabla-20.4`). Las distribuciones espaciales, no. Del texto: todos los RANS **sobreestiman el pico** justo detrás del borde de ataque y **subestiman** cerca del borde de fuga. Escalas: c_f de 0 a 0.01, x/c de 0 a 1. |

### 🟡 ESQUEMAS — recuperables del texto, no bloquean nada
Fig. 15.1 (mapa de ruta), 15.2 (esfuerzo cortante y flujo separado), 15.3 (gradiente adverso), 15.4
(distribuciones de presión adherido vs separado — **solo cualitativa**), 15.5 (líneas de trayectoria
laminar/turbulenta), 15.6 (perfiles laminar vs turbulento), 15.7 (cuerpos esbeltos vs romos), 15.8
(transición), 15.9–15.12 (elemento de fluido, esfuerzos, flujos de energía); 16.1–16.8 (modelo de
Couette, perfiles, malla); 17.1 (fotografía shadowgraph), 17.2–17.7 (definiciones de capa límite,
cuerpo efectivo, hipótesis δ≪c); 18.1–18.3 (mapa, perfil de Blasius, auto-similitud), 18.10–18.11
(región de estancamiento), 18.13 (malla de diferencias finitas); 19.2 (render de perfiles); 20.1–20.6,
20.8–20.14 (vectores de velocidad, contornos, mallas quimera).

### 🟡 Tablas numéricas ausentes
- **Tabla de f, f', f'' vs η de Blasius**: el libro NO la incluye — *"Numerical values of f, f', and f''
  tabulated versus η can be found in Reference 40"* (Schlichting, *Boundary Layer Theory*, 7ª ed., p.1018).
  Solo tenemos los cuatro valores clave (f''(0)=0.332, η_δ=5.0, 1.72, 0.664). **Acción:** resolverla
  nosotros con RK4 + shooting; `f''(0) = 0.332` es el test de aceptación.

### 🟢 SÍ presentes en el `.txt` (no confundir con ausentes)
Los **Apéndices A–E** (líneas 50778–51842+) están completos como texto:
- **A** (50778): propiedades de flujo isentrópico — usada en Ej. 18.2 para `T0/Te` a Me = 2.94.
  Formato `0.2950 + 01` = 2.950; pasos de 0.05 en el rango supersónico. **Verificado.**
- **B** (51033), **C** (51231), **D** (51332), **E** (51843): tablas de choque normal, Prandtl-Meyer y
  las dos tablas restantes. Referencias (52200+) e Índice (52480+).

### 🟡 Referencias cruzadas FUERA de mi rango (las cubre otro bloque, no las invento)
- **§4.3** — stall de perfiles. Anderson lo cita en §15.2 (p.931) como la explicación completa del stall.
  **Mi bloque aporta el MECANISMO (separación por gradiente adverso), no el número de α_stall.**
- **§4.12 y §12.4** — predicción de arrastre de perfil en baja velocidad y supersónico usando
  precisamente los resultados de placa plana de los caps. 18–19. §19.2.3 (p.1057) insiste:
  *"they can be considered integral sections of Part 4 of this book... Take it seriously."*
- **§1.11, §9.10, §10.6, §12.4** — secciones viscosas sueltas en capítulos anteriores.
- **§9.9 y §10.6** — primera discusión de interacción choque-capa límite.
- **§13.5** — método de MacCormack dependiente del tiempo (el cap. 16 y el 20 lo dan por leído).
- **§14.4** — distribución de presión newtoniana `Cp = 2·sin²θ`, usada en la Ec. 18.73.
- **§2.17.2** — expresiones de diferencias finitas usadas en §18.6.1.

---

## 8. LO QUE MÁS ME SORPRENDIÓ

**1. El libro entero de flujo potencial da arrastre cero, y el autor lo pone en la portada del
capítulo.** No como nota al pie: como **epígrafe de d'Alembert de 1768**. Una máquina que lee linealmente
se lleva las fórmulas de sustentación de la Parte 2 y siente que ya tiene aerodinámica. No la tiene:
tiene la mitad que no cobra. La frase que lo cierra (§15.1, p.926) es que **todo el arrastre salvo el
inducido y el de onda** exige viscosidad explícita.

**2. El acoplamiento viscoso-invíscido es literalmente cinco pasos de prosa, y cabe en el navegador.**
Esperaba encontrar algo que justificara una GPU. Lo que hay es: corre paneles, corre capa límite, engorda
el cuerpo con δ\*, vuelve a correr paneles, repite hasta que no cambie. Eso es XFOIL. Y el autor, en el
capítulo de Navier-Stokes (§20.4, p.1073), **recomienda ese camino sobre el CFD** para flujo adherido.
Es el permiso explícito del cliente para que nuestro CAD conceptual no tenga solver pesado.

**3. El libro se autoevalúa cuatro veces y publica sus propios errores.** Ej. 18.2 → 1 %. Ej. 18.3 →
0.4 %. Ej. 19.2 → **20 % de discrepancia entre dos métodos igualmente legítimos**. §20.4 → 18–40 % del
CFD de última generación contra un código de capa límite validado. Un libro de texto normal esconde eso.
Anderson lo tabula. **Eso convierte cada método en un contrato con banda de error, no en una fórmula.**
Nuestro reporte de arrastre debe imitar esa costumbre.

**4. Turbulento cuesta 7.7× a M = 0.29 y 13× a M = 2.94.** No es un ajuste fino: es la diferencia entre
que el avión cierre o no cierre. Y la posición de la transición —de la que depende todo ese factor— la
predice una **regla de dedo** (Re_cr ≈ 500,000) que en el propio ejemplo del libro sale 412,000. El
cliente debe entrenar a sus ingenieros para que traten x_cr como un **rango**, no como un número.

**5. Las manchas de insectos.** §15.2, p.934: los perfiles laminares NACA serie 6 no dan en vuelo el
laminar que dan en el túnel porque *"manufacturing irregularities and **bug spots (believe it or not)**
roughen the surface and promote early transition."* Un modelo lineal descarta ese paréntesis como color.
Es un requisito de producto: el estimador de arrastre no debe asumir laminar por default, y el CAD debe
tener un parámetro de acabado superficial que el ingeniero de manufactura pueda tocar.

**6. `∂p/∂y = 0` es el regalo escondido.** La ecuación más aburrida de la lista (17.30) es la que hace
posible todo lo barato: significa que **el Cp que calculó el método de paneles se imprime tal cual sobre
la pared**, sin corrección. Sin eso, no hay acoplamiento; con eso, dos solvers separados se hablan por
una sola variable. Y el libro marca exactamente dónde deja de valer: hipersónico alto, cuando
`1/(γM∞²) = O(δ)`.

**7. La pared fría adelgaza la capa límite, y la razón es la ecuación de estado.** T menor ⇒ a presión
constante ρ mayor ⇒ el mismo gasto másico cabe en menos espesor (p.1026). Tres líneas de razonamiento
que conectan termodinámica con geometría del flujo. Es exactamente el tipo de cadena causal corta que
hay que enseñar, y que no aparece si uno solo memoriza `δ = 5x/√Re`.

**8. El punto de estancamiento tiene capa límite aunque la velocidad sea cero.** `u/u_e = 0/0` es
indeterminado pero finito punto a punto, y `τ_w = 0` exactamente ahí *"by inspection"* porque el
cortante apunta hacia arriba de un lado y hacia abajo del otro. De ahí sale `q̇_w ∝ 1/√R` y de ahí sale
que **las naves de reentrada tengan nariz gorda**. Una decisión de forma de miles de millones de dólares
que se deriva en dos páginas.

**9. El autor admite dos veces que su campo tiene un agujero.** §19.1, p.1052: *"no pure theory of
turbulent flow exists."* Y §19.3.1: las seis constantes de Baldwin-Lomax son *"not precisely the correct
constants for most flows in general."* Un extractor mecánico copiaría las constantes y las trataría como
física. **Son ajuste de curvas con 40 años de suerte.** El software debe etiquetarlas así.

**10. La errata que solo se ve haciendo la aritmética.** En el Ej. 18.3 el libro escribe `(0.500)(1000)(2)`
donde ρ\* = 0.599, y en el 19.3 escribe `μ* = 2.05e-5` y a la línea siguiente usa `2.95e-5`. Los
resultados finales son correctos: los intermedios impresos no. Si convertimos estos ejemplos en tests
copiando los números intermedios, **los tests fallan y culpamos a nuestro código**. Un extractor lineal
copia; hay que recalcular cada paso.

---

### Anexo — Referencias que el libro señala para profundizar (verificadas en la lista, líneas 52250–52380)

| # | Obra | Para qué |
|---|---|---|
| 40 | Schlichting, H.: *Boundary Layer Theory*, 7ª ed., McGraw-Hill, 1979 | *"The most complete and authoritative book"* (§17.4). **Contiene la tabla de Blasius que aquí falta.** |
| 41 | White, F. M.: *Viscous Fluid Flow*, McGraw-Hill, 1974 | Origen de los datos de Couette compresible (Figs. 16.9/16.10) y de las soluciones auto-similares compresibles |
| 42 | Cebeci & Smith: *Analysis of Turbulent Boundary Layers*, Academic Press, 1974 | Métodos integrales turbulentos |
| 43 / 83 | Bradshaw, Cebeci & Whitelaw: *Engineering Calculation Methods for Turbulent Flow*, 1981 | Modelos de 1 y 2 ecuaciones |
| 75 | Van Driest: "Investigation of Laminar Boundary Layer in Compressible Fluids Using the Crocco Method", NACA TN 2579, 1952 | **Origen de Figs. 18.4–18.7** — si conseguimos este TN, recuperamos los perfiles |
| 76 | Rubesin & Johnson, Trans. ASME 71(4), 1949 | Origen del método de temperatura de referencia |
| 77 | Eckert, Trans. ASME 78(6), 1956 | Variante de entalpía de referencia |
| 78 | Van Driest: "The Problem of Aerodynamic Heating", 1956 | **Origen de las Ecs. 18.65 y 18.70** (estancamiento) |
| 82 | Baldwin & Lomax, AIAA Paper 78-257, 1978 | El modelo de turbulencia completo, con su justificación |
| 88 | Lombardi, Salvetti & Pinelli, *J. Aircraft* 37(2), 2000 | **El estudio de exactitud del fixture `anderson-tabla-20.4`** |
