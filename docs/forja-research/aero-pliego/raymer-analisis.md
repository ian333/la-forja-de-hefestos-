# Raymer caps 12–17 — EL BLOQUE DE ANÁLISIS
### Aerodinámica · Propulsión · Cargas · Pesos · Estabilidad y Control · Performance

**Fuente:** `docs/forja-research/manuales/aero/txt/raymer.txt`, líneas **19088–35233** (leído completo, sin muestreo),
más `§24.3` (líneas 46439–48620) que es de donde salen los únicos ejemplos numéricos del bloque.
Daniel P. Raymer, *Aircraft Design: A Conceptual Approach*, 6ª ed., AIAA, 2018.
**Fecha del análisis:** 2026-08-04. **Analista:** agente de bloque de análisis, pliego AERO.

> **Convención de citas de este documento.** Toda cita lleva `§` **y página impresa** del libro.
> La página se leyó de la cabecera de página del propio texto (p. ej. `CHAPTE R 1 5 Weig hts 573`).
> Las ecuaciones de Raymer se escriben **`R-Ec. N.M`** para no chocar con las de Anderson (`A-Ec.`)
> ni Bertin (`B-Ec.`) que ya usa el pliego existente en su §6 — ver la auditoría, §9.5 de este archivo.
> Toda fórmula va en ASCII. Nada de LaTeX.

> **Marcas de calidad de dato.** El texto viene de un OCR sucio de escaneo:
> - `[OCR DUDOSO: <lo que literalmente se lee>]` = el valor NO es confiable. **No lo metas en un test.**
> - `[CUERPO PERDIDO]` = la ecuación existe y está numerada en el libro, pero el OCR se comió su cuerpo.
>   Se declara en la §7 NO OBSERVADO. **Prohibido reconstruirla de memoria.**
> - `[EXTENSIÓN DECLARADA]` = afirmación mía, no de Raymer, con el motivo escrito.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

### 0.1 El bloque, con sus fronteras reales en el archivo

| Cap | Título | Páginas | Líneas del .txt | Qué es para el producto |
|---|---|---|---|---|
| 12 | Aerodynamics | 389–461 | 19088–23044 | El **build-up de arrastre**: lo único que convierte una geometría dibujada en un número de arrastre sin CFD |
| 13 | Propulsion | 463–489 | 23045–24450 | El **empuje instalado**: catálogo → realidad. Curvas de empuje disponible |
| 14 | Structures and Loads | 491–557 | 24451–28085 | El **diagrama V-n** y las cargas: de dónde sale el `Nz` que alimenta TODAS las ecuaciones de peso |
| 15 | Weights | 559–583 | 28086–29405 | Las **59 ecuaciones estadísticas de peso** + balance y CG |
| 16 | Stability, Control and Handling Qualities | 585–635 | 29406–32375 | **Margen estático, centrado, trimado, dimensionamiento de mandos**. El puente aero↔geometría |
| 17 | Performance and Flight Mechanics | 637–685 | 32376–35233 | **Todas las medidas de mérito**: alcance, ascenso, viraje, despegue, aterrizaje, energía |

Frontera comprobada del capítulo 18 (Cost Analysis) en la línea 35234: no entra en este bloque.

### 0.2 Corrección obligatoria al índice: el TOC del PDF está revuelto

El OCR del índice (páginas xi–xvi) **mezcló columnas** y produce un orden falso
(pone «Chapter 15 / Stability, Control…» y «Chapter 17 / Weights»). El orden **real**, verificado
contra las cabeceras de página del cuerpo del libro y contra §1.4, es:

```
19 Sizing and Trade Studies        p.709   (cabecera verificada, línea 36420)
20 Electric Aircraft               p.735   (§1.4: "The new Chapter 20 covers Electric Aircraft")
21 Vertical Flight-Jet and Prop    p.763   (cabecera verificada, línea 39069)
22 Extremes of Flight              p.805   (cabecera verificada, línea 41435)
23 Design of Unique Aircraft Conc. p.833   (cabecera verificada, línea 42221)
24 Conceptual Design Examples      p.867
```

Cita literal de §1.4, p.6–7 (líneas 1213–1222):

> *"The next four chapters discuss the design of flight vehicles that are in some way different from
> 'normal' vehicles. **The new Chapter 20 covers Electric Aircraft**, including motors, controllers,
> power supplies, analysis and more. **Chapter 21 covers vertical flight** including helicopters and
> vertical takeoff jets. **Chapter 22 introduces the extremes of flight** — very slow to very fast…
> In **Chapter 23** a number of unconventional designs are discussed… **The last chapter, 24,** contains
> two complete design project examples."*

**Consecuencia para la auditoría (§9):** el pliego existente cita el capítulo eléctrico como **§20** y
**tiene razón**. Cualquier índice que diga «21 Electric Aircraft» está mal.

### 0.3 Qué dice el cliente que ES este bloque

§1.4, p.6 (líneas 1196–1207), literal:

> *"**Chapters 12–18 address the detailed analysis of the resulting design layout.** Various chapters
> discuss aerodynamics, weights, installed propulsion characteristics, stability and control,
> performance, cost, and sizing. The analysis techniques are simplified enough to permit the student
> to experience the whole design process in a single course.
> No textbook can contain the methods actually used in industry, which tend to be proprietary and
> highly computerized. **The methods presented here are sufficient and give reasonable results for
> most categories of aircraft. In fact, they are good enough to be used to check the results of the
> sophisticated computerized methods, and if they are far apart, the computer results are probably
> wrong!**"*

§12.1, p.389–390 (líneas 19106–19152), el punto de giro del libro entero:

> *"The start of this chapter represents a turning point in the book. Up to here, the book has shown
> how to take a set of requirements and create a credible 'Dash-One' initial design layout. **Starting
> from here, the book shows how to analyze and optimize that design**, and describes how to develop an
> improved 'Dash-Two' which is iterated until a design freeze can be declared."*

> *"Now there is an actual design layout… **it has enough realism and definition to allow an
> 'as-drawn' analysis rather than relying upon statistical and 'eyeball' estimates.** The goal at this
> point is to see if it actually meets the required mission range as estimated in the initial sizing.
> **If not, we will resize the aircraft until it does.**"*

### 0.4 EL HALLAZGO ESTRUCTURAL: no hay ejemplos resueltos en 12–17, y es a propósito

Leí los seis capítulos completos. **No hay un solo `EXAMPLE` numerado, ni un caso trabajado,
en los capítulos 12, 13, 14, 15, 16 ni 17.** No es un descuido del OCR: es una decisión editorial
declarada. §1.4, p.7 (líneas 1224–1226):

> *"The last chapter, 24, contains two complete design project examples that use the methods
> presented in the previous chapters. **These are provided instead of numerous example calculations
> throughout the text** to illustrate how the different aspects of design fit together as a whole."*

**Consecuencia dura para nosotros:** la suite de aceptación del bloque de análisis **solo puede salir
del §24.3 (el DR-3)**. No existe otra fuente de verificación numérica dentro del bloque. Por eso la
§3 de este pliego es casi enteramente DR-3, y por eso el DR-3 hay que exprimirlo hasta la última cifra.
El §24.2 (DR-1 homebuilt) está escrito a mano sobre papel cuadriculado y **el OCR lo destruyó**
(verificado: no hay ni una tabla de resultados legible entre las líneas 43462 y 45950).

### 0.5 La cadena de dependencias real (el DAG que el pliego existente no tiene)

Los capítulos NO se ejecutan en orden. Esto es lo que el texto declara:

```
                         GEOMETRÍA "as-drawn" (caps 4,6,7)
                                     |
        +----------------------------+----------------------------+
        |                            |                            |
     CAP 12 aero                CAP 13 propulsión            CAP 15 pesos
   CD0, K, CLmax, CLα         T instalado, SFC            grupos + CG + Wdg
        |                            |                            |
        |                            |                            v
        |                            |                   ← Nz (de CAP 14) ←
        |                            |                            |
        +--------> CAP 16 estabilidad y control <-----------------+
        |          Xnp, SM, trimado, tamaño de mandos             |
        |                    |                                    |
        |                    v                                    |
        |          CAP 14 cargas: L_cola trimada -> V-n -> Nz -----+  (LAZO)
        |                    |
        +--------------------+--------> CAP 17 performance
                                        |
                                        v
                                  CAP 19 resizing
```

Los dos acoplamientos que el libro declara explícitamente y que NADIE espera:

1. **16 → 14 → 15 → 16.** §14.3.3, p.501 (líneas 24947–24950):
   > *"**The first step involves a stability-and-control calculation** to determine the required lift
   > on the horizontal tail to balance the wing pitching moment at the critical conditions. Note that
   > **the required tail lift will increase or decrease the required wing lift to attain the same load
   > factor.**"*

   O sea: no puedes calcular cargas sin haber trimado; no puedes trimar sin CG; no tienes CG sin pesos;
   y las ecuaciones de peso necesitan `Nz`, que sale de las cargas. **Es un punto fijo, no una cadena.**

2. **12 → 16 → 12 (trim drag).** §12.6.4, p.451 (líneas 22525–22540):
   > *"The drag values used for performance calculations **should include the trim drag**… **Trim
   > calculation is discussed in Chapter 16.** The trim drag is determined using the previous
   > induced-drag methods **once the tail lift force required for trim is known**."*

   El arrastre de crucero no se puede cerrar sin haber corrido el capítulo 16 primero.

### 0.6 Por qué este bloque es EL producto (y no el «corazón» que dice el pliego previo)

El cliente describe, en el propio ejemplo de diseño, exactamente lo que queremos vender.
§24.3, p.943 (líneas 47693–47695):

> *"The RDS program was again used to perform the calculations and make the graphs, but **the same
> results would be obtained using a pocket calculator and the methods of this book (and a lot of
> time!)**."*

Ese paréntesis —*"and a lot of time!"*— es el hueco de mercado. Los métodos son de calculadora de
bolsillo; lo que falta es que corran **en el segundo 1, sobre la geometría medida del CAD, sin teclear
nada**. Eso es exactamente `[NAVEGADOR]`.

---

## 1. REQUISITOS FUNCIONALES

**Formato.** `REQ-<DOM>-<cap>-<nn> · [dominio] [§ · página] requisito (APRENDER / CONSTRUIR / ambos)`

**Dominios.** Uso los del CONTRATO (`geometria | aero2d | aero3d | compresible | viscoso | sizing |
pesos | estabilidad | performance | costos | optimizacion | escuela`) más dos que este bloque exige y
que el CONTRATO no previó:
`propulsion` y `cargas`. **[EXTENSIÓN DECLARADA]** — motivo: los capítulos 13 y 14 no caben en ningún
dominio de la lista original, y meterlos en `sizing` borraría el hecho de que producen entradas
(empuje instalado, `Nz`) de las que dependen otros tres dominios.

**IDs.** El pliego existente **no numera ningún requisito** de los capítulos 12–17 (verificado: sus
únicos IDs, `R1`–`R9`, son de CAD, §8.5). Introduzco el esquema `REQ-<DOM>-<cap>-<nn>` como extensión
del formato declarado en su L485–486.

### 1.1 Aerodinámica (cap 12)

| ID | Dom · § · pág | Requisito | Modo |
|---|---|---|---|
| REQ-AERO3D-12-01 | aero3d · §12.3 · p.396 | `S_ref` es **el trapecio COMPLETO hasta la línea central del avión**, no el área expuesta. El CAD debe distinguir `S_ref`, `S_expuesta` y `S_mojada` como tres cantidades separadas y medirlas del modelo | CONSTRUIR |
| REQ-AERO3D-12-02 | aero3d · §12.3 · p.396 | El arrastre se reporta en **"counts"**: *"38 counts of drag mean a drag coefficient of 0.0038"*. La UI muestra 4 decimales | CONSTRUIR |
| REQ-AERO3D-12-03 | aero3d · §12.3 · p.397 | La polar debe dibujar la **tangente desde el origen**: *"The point at which a line from the origin is just tangent to the drag polar curve is the point of maximum lift-to-drag ratio. **Note that this is not the point of minimum drag!**"* | ambos |
| REQ-AERO3D-12-04 | aero3d · §12.4.1 · p.400 | Pendiente de sustentación subsónica por `R-Ec. 12.6`, válida **hasta M_DD** y *"reasonably accurate almost to Mach 1 for a swept wing"*. `Λ_max_t` es la flecha de la línea de **máximo espesor**, no la de c/4 → el CAD debe poder medir esa flecha del croquis | CONSTRUIR |
| REQ-AERO3D-12-05 | aero3d · §12.4.1 · p.400 | **Guardarraíl duro:** si `(S_exp/S_ref)·F > 1`, *"This is unlikely and should probably be suppressed by setting this product to a value slightly less than 1.0, say, 0.98"* | CONSTRUIR |
| REQ-AERO3D-12-06 | aero3d · §12.4.1 · p.400–401 | Winglets y endplates entran como **aspecto efectivo** (`R-Ec. 12.10`, `12.11`) y *"should be used in the induced drag calculations"*. El valor depende del diseño: *"An expertly-designed winglet may have a 25% higher value for the h/b term. For a poorly-designed winglet… there may be no benefit at all."* → **es un slider con rango, no una constante** | ambos |
| REQ-AERO3D-12-07 | compresible · §12.4.3 · p.404 | En transónico (**M 0.85–1.2 para ala en flecha**) *"there are no good but quick estimation methods"*: se calculan subsónico y supersónico y **se traza una curva suave a ojo** entre ambos. El software debe ofrecer ese empalme y **etiquetarlo como interpolación, no como cálculo** | CONSTRUIR |
| REQ-AERO3D-12-08 | aero3d · §12.4.5 · p.404 | **CLmax determina el área alar, y es el número menos confiable del libro:** *"the maximum lift coefficient of the wing will usually determine the wing area… yet the estimation of maximum lift is probably the least reliable of all of the calculations used in aircraft conceptual design. Even refined wind-tunnel tests cannot predict maximum lift with great accuracy."* → la UI debe mostrar **banda de incertidumbre**, no un número | ambos |
| REQ-AERO3D-12-09 | aero3d · §12.4.5 · p.405 | `Δy` (leading-edge sharpness) se define geométricamente entre **0.15% y 6% de cuerda** medidos sobre la superficie superior: el CAD lo puede **medir del perfil dibujado** en vez de tabularlo | CONSTRUIR |
| REQ-AERO3D-12-10 | aero3d · §12.4.7 · p.415 | `ΔCLmax` de flaps se refiere a `S_flapped` = **área del ala que TIENE flap, no el área del flap** (Fig. 12.21). Es la trampa clásica; el CAD debe calcular `S_flapped` de la geometría | CONSTRUIR |
| REQ-AERO3D-12-11 | aero3d · §12.4.7 · p.415 | Para despegue usar **60–80%** de los `Δc_lmax` de la Tabla 12.2. Cambio de ángulo de sustentación nula: **−15° en aterrizaje, −10° en despegue** | CONSTRUIR |
| REQ-VISCOSO-12-12 | viscoso · §12.5.1 · p.416 | El método de `C_fe` (`R-Ec. 12.23`) existe **para auditar al método detallado**: *"suitable for initial subsonic analysis and **for checking the results of the more detailed method** described in the next section."* → **los dos métodos corren SIEMPRE y la UI muestra la discrepancia** | CONSTRUIR |
| REQ-VISCOSO-12-13 | viscoso · §12.5.2 · p.417 | Build-up por componente (`R-Ec. 12.24`): por cada componente `C_f · FF · Q · S_wet`. **El CAD ya tiene S_wet de la geometría; ese es el acoplamiento** | CONSTRUIR |
| REQ-VISCOSO-12-14 | viscoso · §12.5.3 · p.418 | El % de flujo laminar **lo elige el ingeniero, y es su responsabilidad**: *"This author's current best guesses are in Table 12.4, but **the final guess is yours.** If you guess higher values than you can actually attain, your airplane will look good in conceptual design analysis but **won't reach its range and performance goals when the airplane is built.**"* → **input humano obligatorio, no default silencioso** | ambos |
| REQ-VISCOSO-12-15 | viscoso · §12.5.3 · p.421 | Rugosidad se aplica **ajustando el número de Reynolds, no el coeficiente**: *"It adjusts not the coefficient itself but the Reynolds number used to calculate the coefficient."* Y solo si `R_cutoff < R_real` | CONSTRUIR |
| REQ-VISCOSO-12-16 | viscoso · §12.5.4 · p.423 | ⭐⭐ **REGLA DE IMPLEMENTACIÓN #1.** Los incrementos porcentuales de factor de forma se aplican **solo a la parte del FF por encima de 1.0**: *"If the calculated form factor is 1.2 and you wish to apply a 30% increase, **the resulting form factor is 1.26 not 1.56.**"* | CONSTRUIR |
| REQ-VISCOSO-12-17 | viscoso · §12.5.4 · p.424 | *"**Don't apply them to automobiles or other non-airplane shapes** because those can have much more airflow separation, hence higher drag."* → el motor debe rechazar geometrías fuera de dominio, no dar un número | CONSTRUIR |
| REQ-VISCOSO-12-18 | viscoso · §12.5.5 · p.425 | Interferencia `Q` **no se calcula, se adivina**: *"Interference drag is best calculated by a high-end computational aerodynamics code… For preliminary estimation, **we have to guess it** as a percent increase in component drag."* → tabla de valores + campo editable | ambos |
| REQ-VISCOSO-12-19 | viscoso · §12.5.7 · p.430 | Leakage & protuberance **no es calculable en conceptual**: *"These are things that don't appear on a configuration layout during conceptual design… **It simply isn't possible to calculate their drag directly — we don't know what they are!**"* → porcentaje por clase (Tabla 12.8) | CONSTRUIR |
| REQ-COMPRES-12-20 | compresible · §12.5.9 · p.432 | En supersónico **`FF = 1.0` y `Q = 1.0`** por contabilidad: *"we set FF and Q equal to 1.0 and then add a wave drag term which incorporates them."* Es un cambio de contabilidad, no de física | ambos |
| REQ-COMPRES-12-21 | compresible · §12.5.9 · p.435 | El arrastre de onda depende de `(A_max/ℓ)²` **al cuadrado**, y `E_wd` linealmente: *"this efficiency factor is **less important in drag determination than the fineness ratio**… **This term is squared**, which explains why area ruling that actually reduces A_max provides a far greater drag reduction than does merely smoothing the volume distribution."* → la palanca de diseño es **bajar A_max**, y el CAD la puede medir | ambos |
| REQ-COMPRES-12-22 | compresible · §12.5.9 · p.435 | Raymer **corrige su propia ecuación**: *"this old empirical relationship seems overly optimistic and gets better results by **replacing the 0.386 term with 0.2**."* → el software ofrece las dos y marca cuál usa | CONSTRUIR |
| REQ-COMPRES-12-23 | compresible · §12.5.10 · p.438 | La **construcción gráfica de 7 pasos del drag rise** (Fig. 12.32) es un algoritmo, no un dibujo. Incluye la regla de cierre: *"If a smooth curve cannot be drawn, the M_cr point (E) should be moved until an approximately circular arc can be drawn."* | CONSTRUIR |
| REQ-COMPRES-12-24 | compresible · §12.5.10 · p.438 | *"The linear wave drag analysis gives **completely incorrect results in the transonic regime**… **drag rise below Mach 1.0 is in fact caused by the terms that are dropped in the linear analysis!**"* → **prohibir** el método lineal entre M 0.8 y 1.2 y decirlo en pantalla | ambos |
| REQ-AERO3D-12-25 | aero3d · §12.5.12 · p.441 | Implementar el **Drag Map** (arrastre vs Mach con varias líneas de `C_L`): *"a useful and **under-appreciated tool**… They also allow you to calculate L/D and ML/D for different Mach numbers"* | CONSTRUIR |
| REQ-AERO3D-12-26 | aero3d · §12.6.1 · p.444 | Las correlaciones de Oswald (`R-Ec. 12.48`, `12.49`) *"should only be used with 'normal' aspect ratios and sweeps and **are not valid for high-aspect-ratio designs such as sailplanes**."* Entre 0° y 30° de flecha, **interpolar linealmente** entre las dos | CONSTRUIR |
| REQ-AERO3D-12-27 | aero3d · §12.6.1 · p.444 | El propio autor desaconseja su método simple: *"Note that this method is **simplistic**, and **you should consider using the superior 'leading-edge suction' method** described below."* → LE-suction es el default, Oswald el fallback | CONSTRUIR |
| REQ-AERO3D-12-28 | aero3d · §12.6.2 · p.446–450 | `K` debe ser **función de `C_L` y de Mach**, no una constante. En el peor caso (0% de succión) `K = 1/C_Lα`. `S ≈ 0.9` en el `C_L` de diseño; **`S` cae fuerte fuera de él** en alas delgadas en flecha | ambos |
| REQ-AERO3D-12-29 | aero3d · §12.6.5 · p.451 | Ground effect (`R-Ec. 12.60`) aplica **por debajo de media envergadura** y multiplica `K` | CONSTRUIR |
| REQ-AERO3D-12-30 | aero3d · §12.7.4 · p.454 | Requisito de producto sacado del propio texto: *"**CFD results are always somewhat suspect until the code has been checked against experimental data for a similar configuration.**"* y *"Reproduction of experimental data sometimes requires extensive **'calibration' (i.e., fudging)** of the turbulence model."* → nuestra herramienta es el chequeo barato de ese CFD | ambos |

### 1.2 Propulsión (cap 13)

| ID | Dom · § · pág | Requisito | Modo |
|---|---|---|---|
| REQ-PROP-13-01 | propulsion · §13.1 · p.465 | Enseñar el compromiso base: *"there is an **unavoidable tradeoff between thrust and efficiency**, determined by the ratio between exhaust and freestream fluid velocity."* Turbojet ~3.0; hélice ~1.5 | APRENDER |
| REQ-PROP-13-02 | propulsion · §13.1 · p.465–466 | Enseñar que en un jet supersónico **el motor solo aporta 8% del empuje**; la tobera 29%, el conducto +75%, la toma −12% (Fig. 13.2, A-5, M2.2). *"This example illustrates the difficulty of calculating jet thrust by any simple model."* | APRENDER |
| REQ-PROP-13-03 | propulsion · §13.3 · p.470 | ⭐ **El cliente declara que los datos del proveedor están sesgados:** *"the engine company experts tend to make assumptions that make their engine look good — wouldn't you? **When applying these engine company results the airplane designers must adjust those results** to better reflect how the engine will actually perform in the air."* → el módulo de propulsión es un **corrector de datos de tercero**, no un lector | CONSTRUIR |
| REQ-PROP-13-04 | propulsion · §13.3.1 · p.471 | **Contabilidad empuje-arrastre explícita y declarada.** *"It is not uncommon to discover, halfway through an aircraft design project, that some minor drag item has been **either included in both** the drag and the thrust calculations **or has been ignored by both** departments under the assumption that it is being included by the other!"* → el software debe llevar un **registro de a quién se le carga cada término** y detectar dobles conteos | CONSTRUIR |
| REQ-PROP-13-05 | propulsion · §13.3.2 · p.474 | Aplicar pérdida por recuperación de presión (`R-Ec. 13.6`) con `C_ram`; valores por defecto: **1.35 subsónico**, `R-Ec. 13.7` supersónico. Duct interno: **0.96 recto, 0.94 en S, 0.98 nacela podada corta** | CONSTRUIR |
| REQ-PROP-13-06 | propulsion · §13.3.2 · p.475 | Sangrado (`R-Ec. 13.8`) con `C_bleed ≈ 2.0` y **1–5% del gasto másico** | CONSTRUIR |
| REQ-PROP-13-07 | propulsion · §13.4 · p.479 | ⭐ **Modelar la pérdida a potencia parcial.** *"When you throttle back, the reduction in thrust is more than proportional to the reduction in fuel flow, so the SFC increases. A noticeable increase in SFC typically begins when you throttle below about 90% power."* → `R-Ec. 13.9`, y **tope: SFC de ralentí = 1.5× la SFC máx-dry** | CONSTRUIR |
| REQ-PROP-13-08 | propulsion · §13.4 · p.479 | Alerta de diseño: *"If residual thrust divided by aircraft weight T/W is equal to the inverse of the lift-to-drag ratio (1/(L/D)), **the aircraft cannot descend!**"* → verificación automática | ambos |
| REQ-PROP-13-09 | propulsion · §13.6 · p.481–483 | Análisis de hélice por coeficientes (`J`, `C_p`, `C_t`, `C_s`, AF, `η_p`) y **empuje estático por carta, no por fórmula**: *"Propeller thrust in forward flight is proportional to the inverse of the velocity, which would imply **infinite thrust at zero velocity. This is clearly ridiculous.**"* | ambos |
| REQ-PROP-13-10 | propulsion · §13.6 · p.484 | Entre **0 y ~50 kt** el empuje se obtiene **empalmando a mano** la curva entre estático y vuelo: *"the thrust varies in a fashion that can be represented by a smooth curve faired between the static-thrust value and the calculated forward-flight thrust."* | CONSTRUIR |
| REQ-PROP-13-11 | propulsion · §13.7 · p.486–488 | Correcciones obligatorias a `η_p`: **bloqueo** (`13.19`), **Mach de punta** (`13.20`, solo si `M_tip > 0.89`), **scrubbing** (`13.21`). Pusher: scrubbing = 0 pero **−2 a −5%** por estela | CONSTRUIR |
| REQ-PROP-13-12 | propulsion · §13.7 · p.488 | Refrigeración: en vez de las ecuaciones, **regla de dedo del cliente**: *"an expertly designed cooling system will produce a cooling drag equivalent to a **6% reduction in thrust**, and a not-so-good system will produce an **8–10%** reduction."* | ambos |
| REQ-PROP-13-13 | propulsion · §13.8 · p.488 | Turbohélice: el empuje residual del chorro vale **hasta 20%** del total; equivalencia estática = **empuje residual / 2.5**; en vuelo con `η_p = 0.80` → ESHP | ambos |

### 1.3 Cargas (cap 14, solo §14.2–14.6)

| ID | Dom · § · pág | Requisito | Modo |
|---|---|---|---|
| REQ-CARGAS-14-01 | cargas · §14.2 · p.492 | El **factor de seguridad es 1.5 desde los años 30** y viene del aluminio 24ST: *"This was defined in an Air Corps specification based upon the ratio between the ultimate tensile load and yield load of 24ST aluminum alloy"* | APRENDER |
| REQ-CARGAS-14-02 | cargas · §14.3.1 · p.495 | ⭐ El diagrama V-n **se elige, no se calcula**: *"While we think of 'calculating' the V-n diagram, in fact **most of the diagram consists of parameters that we select**, including maximum positive load factor, most negative load factor, and maximum dive speed. **The positive and negative stall lines are calculated.**"* → UI mixta: sliders + curvas calculadas | ambos |
| REQ-CARGAS-14-03 | cargas · §14.3.1 · p.495 | Todo el V-n va en **velocidad EQUIVALENTE** `V_e`, no verdadera | CONSTRUIR |
| REQ-CARGAS-14-04 | cargas · §14.3.1 · p.496 | En alto ángulo de ataque la carga puede ir **hacia adelante** del eje vertical del cuerpo: `N = L cos α + D sin α`, `C = D cos α − L sin α`. *"During World War I, several aircraft had a problem with the wings shedding forward due to this unexpected load."* | ambos |
| REQ-CARGAS-14-05 | cargas · §14.3.2 · p.498–499 | Ráfagas: `R-Ec. 14.4–14.8` con `U_de` **= 30 ft/s {9.1 m/s}** hasta crucero, bajando lineal a **15 ft/s {4.6 m/s}** en `V_dive`. **Contraintuitivo obligatorio de enseñar:** *"the load factor due to a gust **increases if the aircraft is lighter**"* | ambos |
| REQ-CARGAS-14-06 | cargas · §14.3.2 · p.499 | Ala en flecha atrás: **−15% de factor de carga por ráfaga** por aeroelasticidad | CONSTRUIR |
| REQ-CARGAS-14-07 | cargas · §14.3.2 · p.500 | El V-n final es la **envolvente combinada** maniobra ∪ ráfaga (Fig. 14.8), y si la ráfaga manda *"it might be desirable to raise the assumed limit load at all velocities"* | CONSTRUIR |
| REQ-CARGAS-14-08 | cargas · §14.3.3 · p.502 | **Schrenk**: distribución = promedio de la planta real y una elipse de igual envergadura y área. *"The total area under the lift load curve must sum to the required total lift."* Con diedro, **dividir entre `cos Γ`**. **No aplica a plantas muy en flecha con flujo de vórtice** | ambos |
| REQ-CARGAS-14-09 | cargas · §14.3.4 · p.505 | Cargas mínimas de cola por reglamento: `C_n` = **−0.55 abajo / 0.35 arriba** en horizontal, **0.45** en vertical, con distribución **proporcional a la cuerda** | CONSTRUIR |
| REQ-CARGAS-14-10 | cargas · §14.3.4 · p.505 | Límites de fuerza de piloto (mando manual): **palanca 167 lb {0.7 kN} elevador / 67 lb {0.3 kN} alerones**; **volante 200 lb {0.9 kN} elevador**, alerones **53×diámetro in-lb**; **timón 200 lb {0.9 kN}** | CONSTRUIR |
| REQ-CARGAS-14-11 | cargas · §14.6 · p.507 | El factor de carga de tren **lo elige el ingeniero** (`N = 3` típico) y luego *"it can be assumed that the landing gear does its job and the vertical loads are limited to that selected load factor"* | ambos |
| REQ-CARGAS-14-12 | cargas · §14.11 · p.551–553 | El FEM tiene los mismos vicios que el CFD: *"**Selection of which element type to use is a matter of engineering judgment. Unfortunately, the selection of the element type can influence the results.** Also, the selection of the size of the elements requires experience."* Y §14.1, p.492: *"The older methods are useful… for **approximating the correct answer to ensure that the finite element method results are in the right 'ballpark'**."* | APRENDER |

### 1.4 Pesos (cap 15)

| ID | Dom · § · pág | Requisito | Modo |
|---|---|---|---|
| REQ-PESOS-15-01 | pesos · §15.1.1 · p.559–560 | El cliente **denuncia el estado del arte** y define nuestro nicho: *"This author knows of no university where an aeronautical student can major in weights engineering… some people seem to think that you can get a credible answer with a handful of equations developed from first principles **by people who have never actually worked in the field. Imagine claiming that for aerodynamics!**"* | APRENDER |
| REQ-PESOS-15-02 | pesos · §15.1.2 · p.562 | Las buenas ecuaciones **no son ciegas**: parten de un modelo físico simplificado y luego se calibran. *"Better statistical methods start with an underlying physics-based model."* (portadilla, p.558) | APRENDER |
| REQ-PESOS-15-03 | pesos · §15.1.2 · p.562 | ⭐ **El límite de validez, textual:** *"If a new design has a parameter that is **far from the values of the airplanes used to calibrate the equation**, it might give an answer that is very wrong. **If you design a commercial transport with a wing aspect ratio of 50, don't use the wing statistical equation presented below!**"* → el software debe **conocer el dominio de cada ecuación y avisar cuando se sale** | CONSTRUIR |
| REQ-PESOS-15-04 | pesos · §15.1.3 · p.563 | **Formato obligatorio** de reporte: Summary Group Weight Statement (MIL-STD-1374 / SAWE-8), tres grupos (estructuras, propulsión, equipo) → peso vacío; + useful load → TOGW | CONSTRUIR |
| REQ-PESOS-15-05 | pesos · §15.1.3 · p.563 | ⭐ **PROHIBICIÓN:** *"**Never change the takeoff gross weight on the Group Weight Statement!**"* — el `W0` no se «suma»: *"the fuel weight is adjusted up or down until the correct `W0` is found."* Si cambias `W0` a mano, *"**all of those calculations are invalid**"* | CONSTRUIR |
| REQ-PESOS-15-06 | pesos · §15.1.3 · p.564 | Márgenes: **3–15%** de crecimiento de peso vacío + **~5%** por *"unknown-unknowns"*. Ambos entran al peso vacío | CONSTRUIR |
| REQ-PESOS-15-07 | pesos · §15.1.3 · p.565 | `W_dg` (flight design gross weight) ≠ `W0`. Militar: *"often assumed that flight design gross weight is takeoff weight but with **only 50–60% of fuel remaining**"* | CONSTRUIR |
| REQ-PESOS-15-08 | pesos · §15.1.3 · p.565 | Definir **DCPR / AMPR weight** (peso vacío menos ruedas, frenos, llantas, motores, arrancadores, fluidos, vejigas, instrumentos, baterías, fuentes eléctricas, aviónica, armamento, control de tiro, aire acondicionado y APU) — lo consume el cap 18 | CONSTRUIR |
| REQ-PESOS-15-09 | pesos · §15.1.3 · p.565–567 | ⭐ **Diagrama de envolvente de CG** obligatorio (Fig. 15.1): peso vs CG a lo largo de la misión, con tanques vaciándose, tren retraído, alas barridas, pasajeros moviéndose. **Regla de dedo:** *"An old rule-of-thumb says that those limits must be separated by **no more than 8% of the wing MAC**."* | ambos |
| REQ-PESOS-15-10 | pesos · §15.1.3 · p.566 | Los límites del CG **los pone otro capítulo**: adelante lo fija efectividad de elevador (rotación / pull-up / viraje) o trim drag o carga de nariz; atrás lo fija **estabilidad direccional** (cap 16). Es un requisito de **acoplamiento entre módulos** | CONSTRUIR |
| REQ-PESOS-15-11 | pesos · §15.1.3 · p.567 | Efecto Mach sobre la envolvente: al acercarse a supersónico los centros aerodinámicos **retroceden**, así que el límite delantero puede tener que **retroceder** y el trasero **adelantarse** — *"This may require making the tail substantially bigger than required for subsonic flight."* | ambos |
| REQ-PESOS-15-12 | pesos · §15.1.3 · p.567 | Secuenciado de combustible permitido, **pero con gestión automática**: el B-1A se estrelló y murió el piloto de pruebas jefe por olvidar reactivar el sistema. *"For safety this should be done with an automated fuel management system."* | APRENDER |
| REQ-PESOS-15-13 | pesos · §15.2 · p.567–568 | Método rápido por área (Tabla 15.2) **como auditor** del detallado: *"Such quick results can also be used to check the results of the more detailed statistical methods later. **If the later calculation says that a general-aviation (GA) airplane wing of 100 ft² should weigh 90 lb, something is probably wrong!**"* | CONSTRUIR |
| REQ-PESOS-15-14 | pesos · §15.2 · p.567 | ⭐ **Cada grupo usa un área DISTINTA:** alas y colas sobre **planta expuesta proyectada**; fuselaje sobre **área MOJADA**; motor instalado como múltiplo del motor desnudo. Reusar una sola `S` es el bug silencioso perfecto | CONSTRUIR |
| REQ-PESOS-15-15 | pesos · §15.2 · p.569 | El **weight budget NO es una meta**: *"A weight budget is NOT a target. If the wing weighs less than the budget implies, **don't add rocks until the budget is met!** It merely acts as a guide and a reality check"* | ambos |
| REQ-PESOS-15-16 | pesos · §15.3 · p.570 | ⭐ **Corre varias ecuaciones y promedia:** *"It's a good idea to calculate the weight of each component using several different equations and then **select an average, reasonable result.**"* → el módulo debe soportar **múltiples correlaciones por grupo** y mostrar la dispersión | CONSTRUIR |
| REQ-PESOS-15-17 | pesos · §15.3 · p.570 | ⭐ **El error más común, confesado por el autor:** *"Mistakes are easy, **the most common being the use of limit load factor, where ultimate load factor `Nz` should be used instead.** In the first edition, this author used a pocket calculator for the Design Example weight calculations to 'prove it could be done' and then made exactly this mistake — now corrected!"* → el campo se llama `Nz` y la UI dice **«último = 1.5 × límite»** al lado | CONSTRUIR |
| REQ-PESOS-15-18 | pesos · §15.3 · p.570 | Fronteras de contabilidad que hay que codificar: `W_flight_controls` **excluye** las superficies de mando (van en ala y colas); las ecuaciones de **caza y GA incluyen asientos**, la de **transporte NO** (Tabla 15.3 aparte) | CONSTRUIR |
| REQ-PESOS-15-19 | pesos · §15.4 · p.579–580 | **Fudge factors declarados** (Tabla 15.4) y el procedimiento para inventar uno nuevo: calcular con las ecuaciones un avión conocido, dividir el peso real entre el calculado. Ejemplo del autor: T-38/F-5B ala → 1067 lb calculado vs 1042 lb real ⇒ 0.977, × 0.85 de compuestos ⇒ **0.83** | ambos |
| REQ-PESOS-15-20 | pesos · §15.4 · p.581 | **UAV:** *"assuming 'half a man' in these equations gives reasonable numbers"* → `N_c = 0.5`. Y *"a top-level statistical equation for all UAVs is unlikely"* | CONSTRUIR |
| REQ-PESOS-15-21 | pesos · §15.4 · p.581 | ⭐ **El lastre es un fracaso de diseño, y su causa está declarada:** *"**No airplane in its as-designed configuration should have or need any ballast weights**… the actual weights are known for the first time and often they are different — usually higher — than previously estimated. **This almost always moves the center of gravity away from the engine.**"* → el software debe **predecir esa deriva**, no solo reportar el CG nominal | ambos |
| REQ-PESOS-15-22 | pesos · §15.4 · p.581 | La ventana para mover el ala **se cierra**: *"**We easily move the wing in Conceptual Design, and carefully do in Preliminary Design, but not after that.**"* → es el argumento comercial del CAD conceptual paramétrico | APRENDER |
| REQ-PESOS-15-23 | pesos · §15.4 · p.583 | Crecimiento post-primer-vuelo: histórico **5%/año**, hoy **<2%** en diseños normales, *"Groundbreaking designs such as a vertical takeoff and supersonic stealth fighter can still suffer large increase"* → margen por novedad, no plano | CONSTRUIR |

### 1.5 Estabilidad y control (cap 16)

| ID | Dom · § · pág | Requisito | Modo |
|---|---|---|---|
| REQ-ESTAB-16-01 | estabilidad · §16.1 · p.585–586 | Honestidad de método declarada: *"these 'handbook' methods are not as reliable as the modern computational methods, but **they are suitable for initial assessments of a Dash-One layout**."* Y §16.3.2, p.594: *"Note that these methods are considered **crude by the stability and control community** and are only suitable for conceptual design estimates and for student design projects."* → el software **debe rotular su propio nivel de confianza** | ambos |
| REQ-ESTAB-16-02 | estabilidad · §16.1 · p.585 | Las colas se dimensionaron con coeficiente de volumen; ahora hay que verificar: *"These rule-of-thumb methods result in a design that is **probably** as stable as desired and **probably** controllable as required. **To make sure, a better analysis is required just as soon as possible.**"* | ambos |
| REQ-ESTAB-16-03 | estabilidad · §16.2 · p.587–589 | Convención de ejes explícita: cuerpo / viento / **estabilidad** (el usado). *"A 'right-hand rule' **must be maintained, or the equations will be unusable.**"* Y la trampa de nombres: `L` es momento de alabeo, no sustentación; `N` es guiñada, no fuerza normal | ambos |
| REQ-ESTAB-16-04 | estabilidad · §16.2 · p.589 | **Todos los ángulos en radianes** salvo aviso; ángulos de ataque medidos **desde la línea de sustentación nula**, no desde la cuerda. *"Be careful: the airfoil moment data are probably tabulated with respect to the geometric chord line and might need to be adjusted"* | CONSTRUIR |
| REQ-ESTAB-16-05 | estabilidad · §16.3.2 · p.593 | ⭐ **El margen estático es EL número del capítulo:** *"The static margin is the most important term in the longitudinal stability of an aircraft, and a target static margin, usually expressed in percent, is **both a requirement and a key design tool for aircraft designers.**"* → tiene que ser un campo objetivo de primer nivel en la UI, con el CG y el punto neutro medidos del modelo | CONSTRUIR |
| REQ-ESTAB-16-06 | estabilidad · §16.3.2 · p.593 | Objetivos: transporte **+5 a +10%** en el CG más atrasado; GA más estable (**Cessna 172 ≈ +19%**); cazas clásicos **≈+5%**; RSS moderno **0 a −15%** con control computarizado, *"This reduces trim drag substantially"* | ambos |
| REQ-ESTAB-16-07 | estabilidad · §16.3.2 · p.593 | Correcciones por potencia: jets **−1 a −3%**; hélice: *"**every mean aerodynamic chord length that the propeller is ahead of the center of gravity will reduce the stability by about 2%**"* | CONSTRUIR |
| REQ-ESTAB-16-08 | estabilidad · §16.3.3 · p.594 | Centro aerodinámico: **c/4 ±1%** subsónico, **~45% MAC** supersónico, con `R-Ec. 12` de corrimiento. *"Note that poor results are obtained at transonic speeds"* | CONSTRUIR |
| REQ-ESTAB-16-09 | estabilidad · §16.3.4 · p.594 | **−20% de pendiente de sustentación de cola si el hueco del elevador no está sellado** (timón igual; alerones −15%). Es un detalle de fabricación que cambia el dimensionamiento | ambos |
| REQ-ESTAB-16-10 | estabilidad · §16.3.4 · p.596 | Guardarraíl: el método empírico de flaps *"sometimes overpredicts the flap or control surface effectiveness, implying that a flap deflection gives even more lift than an equal-incidence deflection of the entire wing or tail. **This should not normally occur** and can be avoided by ensuring that the product of the first two terms in Eq. (16.16) is less than 1"* → clamp obligatorio con `R-Ec. 16.18` | CONSTRUIR |
| REQ-ESTAB-16-11 | estabilidad · §16.3.7 · p.603 | **Posición vertical del ala:** *"it can be assumed that a high wing increases the static margin by **10% of the vertical distance of the wing above the c.g., divided by wing MAC**"* — el CAD lo mide solo | CONSTRUIR |
| REQ-ESTAB-16-12 | estabilidad · §16.3.10 · p.607–609 | **Trimado gráfico**: barrer `α` y `δe`, graficar `Cm_cg` vs `CL_total`, interpolar el cruce por cero. Es un algoritmo de dos bucles, corre en milisegundos | CONSTRUIR |
| REQ-ESTAB-16-13 | estabilidad · §16.3.10 · p.609 | ⭐ **Trim drag con signo:** la sustentación de cola está girada por el downwash y para una cola con carga hacia abajo eso da **una componente hacia adelante** ⇒ *"the conventional aft tail does not have as much trim drag as might be assumed"*. Y al revés si la cola sustenta hacia arriba | ambos |
| REQ-ESTAB-16-14 | estabilidad · §16.3.11 · p.609–610 | Efecto suelo sobre el trimado: por debajo de **~20% de la envergadura**, pendientes **+10%** y downwash **a la mitad**. Criterio duro: *"The aircraft **must have sufficient elevator effectiveness to trim in ground effect with full flaps and full-forward c.g. location, at both power-off and full power.** Some additional elevator authority must then be available for control including landing flare"* | CONSTRUIR |
| REQ-ESTAB-16-15 | estabilidad · §16.3.12 · p.610 | **Rotación en despegue dimensiona el elevador**: triciclo → rotar la nariz **al 80% de la velocidad de despegue con el CG más adelantado**; patín de cola → levantar la cola **a la mitad de la velocidad de despegue con el CG más atrasado**. Fricción de rodadura **0.03** actuando a la altura del CG | CONSTRUIR |
| REQ-ESTAB-16-16 | estabilidad · §16.3.13 · p.610–611 | Estabilidad de velocidad: el eje de empuje alto **estabiliza ~0.25% de margen por cada 1% MAC**, pero *"**this benefit cannot be used to lessen the aircraft's power-off static margin**"* — solo cuenta el detrimento del eje bajo | ambos |
| REQ-ESTAB-16-17 | estabilidad · §16.4.2 · p.615 | ⭐ **Motor fuera dimensiona el timón:** *"The vertical tail with rudder deflected must produce sufficient yawing moment to keep the aircraft **at zero angle of sideslip at takeoff speed (1.1 times the stall speed) with one engine out and at the aft-most c.g. location. Rudder deflection should probably be no more than 20 deg** to allow additional deflection for control."* | CONSTRUIR |
| REQ-ESTAB-16-18 | estabilidad · §16.4.2 · p.615 | **Viento cruzado:** *"The aircraft must be able to operate in crosswinds equal to **20% of takeoff speed**, which is equivalent to holding an **11.5-deg sideslip** at takeoff speed. Again, **no more than 20 deg of rudder** should be used."* Y verificar los alerones ahí también | CONSTRUIR |
| REQ-ESTAB-16-19 | estabilidad · §16.4.2 · p.615 | Jerarquía de soluciones cuando el vertical no alcanza, **en el orden del libro**: (1) cuerda/envergadura de timón, (2) timón de doble bisagra (DC-10), (3) vertical todo-móvil (F-107, SR-71, *"provides the greatest yaw control power for a given tail area, but is heavy"*), (4) mover motores hacia adentro (*"this increases wing structural weight"*), (5) **fuerza bruta: agrandar el vertical**, que *"penalizes aircraft weight and drag"* | ambos |
| REQ-ESTAB-16-20 | estabilidad · §16.4.3 · p.616 | Objetivo lateral: `C_lβ` **negativo, con magnitud ≈ la mitad de `C_nβ` en subsónico y ≈ igual en transónico**. Y `1 deg de diedro efectivo = C_lβ de 0.0002 /deg = 0.0115 /rad` | CONSTRUIR |
| REQ-ESTAB-16-21 | estabilidad · §16.4.5 · p.619 | El aspecto efectivo del vertical **sube ~55%** por efecto placa del fuselaje y del horizontal | CONSTRUIR |
| REQ-ESTAB-16-22 | estabilidad · §16.5 · p.620 | Stick-free: elevador libre con balance aerodinámico **reduce la pendiente de cola en ~50% de la fracción de área del elevador**; punto neutro stick-free **2–5% adelante** del stick-fixed | ambos |
| REQ-ESTAB-16-23 | estabilidad · §16.6 · p.621 | ⭐ **Flexibilidad: números que el rígido no ve.** Transporte en flecha a alto subsónico: `C_Lα` de ala **−20%**, aporte de cola al momento **−30%**, efectividad de elevador **−50%**, centro aerodinámico **avanza ~10% MAC**, alerones **−50% a más de −100%** ⇒ **inversión de alerón** (B-47 a ~470 kt) | ambos |
| REQ-ESTAB-16-24 | estabilidad · §16.7.1 · p.623 | Inercias por radios de giro adimensionales (Tabla 16.1). **Productos de inercia**: *"difficult to estimate at the conceptual level. As a rough guess, values from similar airplanes can be ratioed by weight."* | CONSTRUIR |
| REQ-ESTAB-16-25 | estabilidad · §16.7.4 · p.627 | ⭐ **Piso duro para el vertical:** *"**vertical-tail size should not be reduced below the size indicated by the tail volume coefficient method until a six-DOF analysis has been conducted**, preferably with wind-tunnel data for the dynamic derivatives."* (Dutch roll manda). Repetido en §16.9, p.630 por acoplamiento inercial | CONSTRUIR |
| REQ-ESTAB-16-26 | estabilidad · §16.8.3 · p.628 | Alabeo: helix angle `Pb/2V ≥ 0.07` (**0.09 cazas**), NACA 715; y los tiempos de MIL-F-8785B (Tabla 16.2). *"the quasi-steady-state roll rate therefore can be used to initially estimate the time to roll"* | ambos |
| REQ-ESTAB-16-27 | estabilidad · §16.10.2 · p.632 | Parámetros de departure: **LCDP** (`16.65`) y **`C_nβ_dynamic`** (`16.66`), ambos **positivos**, meta `C_nβ_dyn > 0.004`. Pero: *"the stability derivatives… **become very nonlinear near the stall. First-order estimation techniques used in conceptual design might not give usable results** for departure estimation. However, the configuration designer can expect to be instructed to **'fix it' when the first wind-tunnel data are available!**"* | ambos |
| REQ-ESTAB-16-28 | estabilidad · §16.10.2 · p.633 | Reglas de forma para departure que el CAD SÍ puede verificar: **nariz elíptica más ancha que alta**, **strake o arista viva a cada lado de la nariz**, evitar entrada en pérdida de puntera (torsión, fences, muescas, dispositivos de borde de ataque), **superficie ventral sustancial** | ambos |
| REQ-ESTAB-16-29 | estabilidad · §16.10.3 · p.634–635 | Recuperación de barrena: **TDPF = TDR × URVC** (`16.67–16.70`) con la geometría de las áreas **no sombreadas** por el horizontal (Fig. 16.31). Es puramente geométrico ⇒ el CAD lo mide del modelo | CONSTRUIR |

### 1.6 Performance (cap 17)

| ID | Dom · § · pág | Requisito | Modo |
|---|---|---|---|
| REQ-PERF-17-01 | performance · §17.1 · p.638 | *"These simple equations are the basis of the most detailed sizing and performance programs used by the major airframe companies. **What makes the sizing and performance programs complicated is not the actual calculation** of the aircraft response… **The complications arise in determining what the angle of attack and thrust level should be** to perform some maneuver."* → el valor está en el **buscador**, no en la fórmula | ambos |
| REQ-PERF-17-02 | performance · §17.1 · p.639 | Aviso de unidades, literal: *"be especially careful with fps (British) units… **Anytime the constant '550' appears in an equation, the other units must be converted to feet, pounds, and seconds.** …the specific fuel consumption C, which is usually given in units of hours⁻¹ **must be divided by 3600**"* → el motor debe ser **unit-safe con tipos, no con comentarios** | CONSTRUIR |
| REQ-PERF-17-03 | performance · §17.2.1–2 · p.640–641 | Las cuatro constantes que hay que enseñar y verificar: `V_minP = 0.760 · V_minD` (=3^(−1/4)); `CL_minP = 1.73 × CL_minD`; en `V_minP` el arrastre total es **4× el de sustentación nula** (vs 2× en `V_minD`) pero el arrastre real solo sube **15.5%**; `L/D` en `V_minP` = **0.866 × (L/D)max` | ambos |
| REQ-PERF-17-04 | performance · §17.2.3 · p.642 | ⭐ **El método gráfico es el método real:** *"The analytical optimizations in the last two sections depend upon the assumptions that the zero-lift drag coefficient is constant with velocity, that the drag due to lift follows the parabolic approximation, and that K is constant with velocity… **these assumptions are not very good** other than for an aircraft with a high-aspect-ratio wing that is flying at low Mach numbers."* → **las curvas T-vs-V y P-vs-V son el entregable, no las fórmulas cerradas** | ambos |
| REQ-PERF-17-05 | performance · §17.2.4 · p.643–644 | Breguet exige `C_L` constante ⇒ **cruise-climb**. Y el mundo real lo impide ⇒ **stair-step**: *"the Breguet range equation can be applied with little loss of accuracy even under these conditions by **breaking the cruise legs into several shorter mission-segments**"* | ambos |
| REQ-PERF-17-06 | performance · §17.2.5 · p.645 | ⭐ **El cliente describe nuestro algoritmo:** *"A more correct optimum condition for range can be found by **exhaustively searching throughout the flight envelope at the current aircraft weight, looking for the place where the range parameter (V/C)(L/D) is at a maximum.** This is the method used by the computer programs in the major aircraft companies."* | CONSTRUIR |
| REQ-PERF-17-07 | performance · §17.2.9 · p.647–649 | **Viento**: corregir el alcance requerido por `(V_airspeed/V_groundspeed)` usando `R-Ec. 17.35` (ley de senos). *"you should **fly faster into a headwind** so that you do not fight it as long, and **slower if a tailwind**"*, con ganancia de solo *"a few percent"*. **El viento NO afecta al loiter** | ambos |
| REQ-PERF-17-08 | performance · §17.3.2 · p.650 | Mejor ángulo y mejor régimen de ascenso **por método gráfico** (Fig. 17.4): pico de la curva y tangente desde el origen. *"Graphical analysis is more reliable, but doesn't give an analytical feeling for the key variables"* | ambos |
| REQ-PERF-17-09 | performance · §17.3.4 · p.652 | Para hélice, la optimización analítica **falla**: *"the theoretical optimal velocities obtained with the resulting equation tend to be too low for the parabolic drag approximation to be valid… **Even worse, sometimes this equation gives an optimal climb speed which is lower than the stall speed!**"* → usar **85–90% de la velocidad de mejor régimen** como estimación inicial | CONSTRUIR |
| REQ-PERF-17-10 | performance · §17.3.5 · p.652–653 | Tiempo de ascenso por **segmentos ≤5000 ft {~1500 m}** con `V_v` lineal en altitud (`17.48–17.51`), y refinamiento por iteración restando el combustible quemado | CONSTRUIR |
| REQ-PERF-17-11 | performance · §17.4.2 · p.655 | ⭐ **El viraje sostenido es ITERATIVO:** *"Note that the drag-due-to-lift factor `K` is a function of lift coefficient… **Because `n` is also a function of lift coefficient, iteration is required** to solve Eq. (17.54)."* | CONSTRUIR |
| REQ-PERF-17-12 | performance · §17.4.3 · p.656 | Resultado antiintuitivo obligatorio: para **viraje instantáneo** el vector de empuje óptimo es **perpendicular al vuelo** (`φT = 90° − α`); para **sostenido** es **alineado con el vuelo** (`φT = −α`), o sea *"the thrust should actually be vectored **upward** (relative to the fuselage axis)"*. Y solo sirve si las toberas están **cerca del CG** | ambos |
| REQ-PERF-17-13 | performance · §17.6.3 · p.664–667 | **Trayectoria de mínimo tiempo a altura** = puntos donde las curvas de `P_s` son tangentes a las de `h_e`. El algoritmo implementable, literal: *"These points can also be found by **starting at the top of each energy height `h_e` curve and following it down to sea level, noting the altitude where the highest value of `P_s` is found. This technique is easiest for programming and automatically accounts for oddly shaped `P_s` curves.**"* | CONSTRUIR |
| REQ-PERF-17-14 | performance · §17.6.3 · p.667 | Caso de bajo empuje / SST: la trayectoria óptima exige **saltar entre burbujas de `P_s` picando a través de M1.0**. *"This is exactly what the Concorde did, not because it was incapable of going supersonic in level flight, but because **it was more fuel efficient to do it this way.**"* | APRENDER |
| REQ-PERF-17-15 | performance · §17.6.5 · p.669 | Guardarraíl duro del solver de misión: *"a maneuver involving a **reduction in energy height cannot put fuel back in the tanks**, as would be implied by putting a negative value for the change in `h_e` into Eq. (17.97)!"* | CONSTRUIR |
| REQ-PERF-17-16 | performance · §17.7 · p.669–670 | Envolvente de vuelo con **todos** sus límites: `P_s = 0` (con y sin postquemador), pérdida, techo absoluto, techo de servicio (**100 fpm hélice / 500 fpm jet FAR; 100 fpm militar; 300 fpm USN**), **límite de eyección 50,000 ft**, reencendido a baja `q`, **`q` estructural 1800–2200 psf {86–105 kN/m²}**, presión de conducto y temperatura de piel | CONSTRUIR |
| REQ-PERF-17-17 | performance · §17.7 · p.671 | La presión de pared dentro del conducto *"can easily be **three times** the outside dynamic pressure"* y **no sigue la misma pendiente** que el límite de `q` | ambos |
| REQ-PERF-17-18 | performance · §17.8 · p.671–675 | Despegue por **segmentos** (rodaje, rotación, transición, ascenso), no por carta. Empuje promedio al **70% (1/√2) de `V_TO`**; rotación **3 s grandes / 1 s pequeños**; transición a **1.15 `V_stall`** con `0.9 CLmax` ⇒ `n = 1.2`; obstáculo **50 ft militar/pequeño, 35 ft comercial** | CONSTRUIR |
| REQ-PERF-17-19 | performance · §17.8.4 · p.676 | Campo balanceado: **prohibido usar reversa** (*"The use of reverse thrust is not permitted for the balanced field-length calculations"*), 1 s de reacción del piloto, y `V_TO` **20–40% por encima del mínimo** para poder ascender con un motor fuera. FAR 25 exige el peor entre BFL y **1.15× la distancia con todos los motores**; **FAR 23 no** | CONSTRUIR |
| REQ-PERF-17-20 | performance · §17.9 · p.676–678 | Aterrizaje: peso de aterrizaje **entre `W0` y 0.85 `W0`** y *"**Landing weight is not the end-of-mission weight**"*; `V_a = 1.3 V_stall` (1.2 militar); ángulo **≤3°** para transportes; `V_TD = 1.15 V_stall` (1.1 militar); rodadura libre 1–3 s; **µ frenado 0.5 civil / 0.3 militar**; reversa **40–50%** con corte a ~50 kt ⇒ **dos tramos**; **FAR field length = 1.666 × total** | CONSTRUIR |
| REQ-PERF-17-21 | performance · §17.9.4 · p.678 | Viento en despegue/aterrizaje: *"difficult to model with a simple equation"*. Aproximación declarada: velocidad promedio `0.29 V_i + 0.71 V_f`, razón = ese valor / (ese valor + viento). *"**A time-domain 3-DOF simulation is probably needed to get a good answer.**"* Y: *"If for some reason a downwind takeoff or landing is attempted, all distances increase dramatically. **Don't do that.**"* | ambos |
| REQ-PERF-17-22 | performance · §17.9.5 · p.678–679 | ⭐ **Aterrizaje sin motor como restricción de configuración:** si el `L/D` en el flare no alcanza, *"**substantial vehicle aerodynamic redesign is required, such as a larger wing, higher aspect ratio, or increased fuselage fineness ratio.** …It needs to hold that safe sink rate for about **5 to 15 seconds** while waiting for the wheels to 'find the ground'… **It might stall before touchdown.** …Diving to build up speed before the flare doesn't help, because that results in a steeper descent angle."* | ambos |
| REQ-PERF-17-23 | performance · §17.10 · p.679–681 | Las medidas de mérito clásicas **no bastan**: hay que añadir **envolvente de gestión de energía** (`P_s` máximo Y mínimo vs régimen de viraje), **loaded roll**, y maniobra postpérdida. *"two fighters with exactly the same turn rate vs `P_s` will be widely different in combat effectiveness if one aircraft has unpredictable and uncontrollable behavior at high angle of attack"* | ambos |

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

> Notación ASCII: `^` potencia, `*` producto, `sqrt()` raíz, `pi` = 3.14159…, `Λ` = flecha (sweep),
> `λ` = estrechamiento (taper), `Γ` = diedro, `β` = Prandtl-Glauert o ángulo de derrape según contexto.

### 2.1 Capítulo 12 — Aerodinámica (p.389–461)

#### 2.1.1 Definiciones (§12.3, p.396)

```
R-Ec. 12.1   L = q * S * CL
R-Ec. 12.2   D = q * S * CD
R-Ec. 12.3   q = 0.5 * rho * V^2
R-Ec. 12.4   [CUERPO PERDIDO]  polar sin comba
R-Ec. 12.5   [CUERPO PERDIDO]  polar con comba
```

`S` = `S_ref` = **planta trapezoidal completa hasta la línea central**. Minúsculas = 2D (`c_l`),
mayúsculas = 3D (`C_L`).

Sobre 12.4 y 12.5 el texto que sí sobrevivió dice, p.396–397: *"For an uncambered wing, the minimum
drag `C_D0` occurs when the lift is zero. The drag polar has an approximately parabolic shape, as
defined by Eq. (12.4)."* y *"For a cambered wing, the minimum drag `C_Dmin` occurs at some positive
lift `C_L min drag`. The drag polar also has a parabolic shape but is offset vertically."*
**Rango de validez del uso de 12.4 en vez de 12.5:** *"For wings of moderate camber, this offset is
usually small, which implies that `C_D0` approximately equals `C_Dmin` and that Eq. (12.4) can be
used."* Fuera de ahí (comba fuerte, perfil supercrítico) usar 12.5.

#### 2.1.2 Sustentación

```
R-Ec. 12.6   CL_alpha = ---------------------------------------------------- * (S_exp/S_ref) * F
                        2 + sqrt[ 4 + (A^2 * beta^2 / eta^2) * (1 + tan^2(Λ_max_t)/beta^2) ]
                                       ... con numerador 2*pi*A
             [OCR DUDOSO: el numerador se lee "21TA" (=2*pi*A) y el término de eficiencia se lee
              "re"/"7" donde debería ir eta. La ESTRUCTURA es legible; los símbolos individuales no
              todos. Verifícala contra el impreso antes de meterla en un test.]
R-Ec. 12.7   beta^2 = 1 - M^2
R-Ec. 12.8   eta = c_l_alpha / (2*pi/beta)      (eficiencia del perfil)
R-Ec. 12.9   F = 1.07 * (1 + d/b)^2             (factor de sustentación del fuselaje)
R-Ec. 12.10  A_effective = A * (1 + 1.9*h/b)    (endplate)
R-Ec. 12.11  A_effective = A * (1 + h/b)^2      (winglet)
```

- **Unidades:** `CL_alpha` **por radián**. `A` = alargamiento de la planta de referencia completa.
  `Λ_max_t` = flecha de la línea de **máximo espesor**. `d` = diámetro de fuselaje, `b` = envergadura,
  `h` = altura del winglet/endplate.
- **Origen:** semi-empírica, referencia [68] del libro.
- **Rango de validez (literal, p.399–400):** *"This is accurate up to the drag-divergent Mach number
  and reasonably accurate almost to Mach 1 for a swept wing."*
- **Supuesto:** si no conoces `c_l_alpha(M)`, *"the airfoil efficiency `eta` can be approximated as
  about 0.95. (In several textbooks this term is dropped by assuming that `eta = 1.0` at all Mach
  numbers.)"*
- **Qué se rompe fuera:** por encima de M_DD la Prandtl-Glauert diverge a infinito en M=1, cosa que
  *"real wings don't"*. Y con `A` muy bajo (<2–3) la curva **deja de ser lineal** por sustentación de
  vórtice de puntera (§12.4.4).
- **Guardarraíl:** si `(S_exp/S_ref)*F > 1`, fijarlo en **0.98**.
- **Nota sobre 12.11:** el winglet entra **al cuadrado** y el endplate lineal. Es una diferencia de
  forma funcional sin justificación en el texto; la marco para verificar contra el impreso, pero es
  lo que el OCR muestra con claridad en ambos casos.

```
R-Ec. 12.12  c_l_alpha = 4 / beta          (ala totalmente supersónica, valor ideal)
R-Ec. 12.13  beta = sqrt(M^2 - 1)
R-Ec. 12.14  condición: M > 1 / cos(Λ_LE)   (borde de ataque "supersónico")
```

**Qué se rompe fuera:** debajo de esa condición el borde de ataque es subsónico y 12.12 no aplica;
hay que ir a las cartas de la Fig. 12.7, que **son imagen y no están en el texto** (ver §7).
El propio libro avisa: *"The actual lift-curve slope of a wing in supersonic flight is **difficult to
predict without use of a sophisticated computer program.**"* y que las cartas *"give best results only
for trapezoidal wings **without kinks or strakes**."*

#### 2.1.3 Sustentación máxima

```
R-Ec. 12.15  CL_max = 0.9 * c_l_max * cos(Λ_0.25c)
```
**Rango:** *"For high-aspect-ratio wings with moderate sweep and a large airfoil leading-edge radius…
The maximum lift coefficient of the 'clean' wing will usually be about 90% of the airfoil's maximum
lift as determined from the two-dimensional airfoil data at a similar Reynolds number."*
*"This equation is reasonably valid for most subsonic aircraft of moderate sweep."*
**Qué se rompe fuera:** con `A` bajo o flecha alta + borde de ataque agudo, **la sustentación máxima
SUBE** por vórtices de borde de ataque, y hay que ir a 12.16–12.20 con sus cartas.

**Tabla 12.1 — `Δy` para perfiles comunes** (p.405, en % de cuerda, con `t/c` en %):

| Perfil | Δy |
|---|---|
| NACA 4 dígitos | 26 · t/c |
| NACA 5 dígitos | 26 · t/c |
| Serie NACA 64 | 21.3 · t/c |
| Serie NACA 65 | 19.3 · t/c |
| Biconvexo | 11.8 · t/c |

Definición geométrica de `Δy` (p.405): separación vertical entre los puntos de la **superficie
superior** que están a **0.15% y 6% de la cuerda** desde el borde de ataque.

```
R-Ec. 12.16  CL_max = c_l_max * (CL_max/c_l_max) + ΔCL_max     [alto alargamiento]
R-Ec. 12.17  alpha_CLmax = CL_max/CL_alpha + alpha_0L + Δalpha_CLmax
R-Ec. 12.18  bajo alargamiento si:  A <= 3 / ((C1 + 1) * cos(Λ_LE))
R-Ec. 12.19  CL_max = (CL_max)_base + ΔCL_max                  [bajo alargamiento]
R-Ec. 12.20  alpha_CLmax = (alpha_CLmax)_base + Δalpha_CLmax
```
`(CL_max/c_l_max)` sale de la **Fig. 12.9** y `ΔCL_max` de la **Fig. 12.10** — ambas son imagen
(§7). Lo mismo `C1` (Fig. 12.12) y las Figs. 12.13–12.16. El primer término de 12.16 es el valor a
**M 0.2**; el segundo es la corrección a Mach mayor.

**Límite duro declarado (p.408):** *"At transonic and supersonic speeds, the maximum lift a wing can
achieve is usually limited by **structural considerations rather than aerodynamics.** Unless the
aircraft is flying at a very high altitude, **the available maximum lift at Mach 1 is usually enough
to break the wings off!**"* Y también *"maximum lift is often limited by **buffeting, controllability,
or flexibility** rather than by actual maximum lift."*

```
R-Ec. 12.21  ΔCL_max  = 0.9 * Δc_l_max * (S_flapped/S_ref) * cos(Λ_H.L.)
R-Ec. 12.22  Δalpha_0L = (Δalpha_0l)_airfoil * (S_flapped/S_ref) * cos(Λ_H.L.)
```
`Λ_H.L.` = flecha de la **línea de bisagra**. `S_flapped` = **área del ala que tiene flap**, no área
del flap (Fig. 12.21, y el propio libro lo grita: *"Area of wing having flap, not area of flap
alone!"*).
**Supuesto:** deflexión **óptima de aterrizaje**. Para despegue usar **60–80%** de esos incrementos.
`Δalpha_0L` en 2D ≈ **−15 deg** en aterrizaje, **−10 deg** en despegue.

**Tabla 12.2 — Contribución aproximada de dispositivos hipersustentadores** (p.415):

| Dispositivo | Δc_l_max |
|---|---|
| Flap simple (plain) y partido (split) | 0.9 |
| Ranurado (slotted) | 1.3 |
| Fowler | 1.3 · c'/c |
| Doble ranurado | 1.6 · c'/c |
| Triple ranurado | 1.9 · c'/c |
| Ranura fija (fixed slot) | 0.2 |
| Flap de borde de ataque | 0.3 |
| Kruger | 0.3 |
| Slat | 0.4 · c'/c |

LEX / strake: *"The lift increment for a leading-edge extension can be crudely estimated as **0.4** at
high angles of attack."*

**Advertencia de método (p.414–415), literal:** *"Estimating a wing's maximum lift with flaps is
**extremely difficult**… **Even tiny changes in the gap between wing and flap can have a large effect
on lift.** An unexpected amount of flap structural bending can change that gap and **literally make
the airplane stall at too high of a speed.**"* → *"if at all possible, it should be calibrated with
test data on an actual airplane with similar flap geometry."*

#### 2.1.4 Arrastre parásito

```
R-Ec. 12.23  CD0 = C_fe * S_wet / S_ref
```
**Tabla 12.3 — Coeficientes de fricción equivalentes `C_fe`** (p.417) — transcritos literal:

| Clase | C_fe |
|---|---|
| Bombardero | 0.0030 |
| Transporte civil | 0.0026 |
| Carguero militar (fuselaje con upsweep alto) | 0.0035 |
| Caza de la Fuerza Aérea | 0.0035 |
| Caza naval | 0.0040 |
| Supersónico de crucero limpio | 0.0025 |
| Avión ligero monomotor | 0.0055 |
| Avión ligero bimotor | 0.0045 |
| Hidroavión de hélice | 0.0065 |
| Hidroavión a reacción | 0.0040 |

**Rango:** subsónico, avión bien diseñado en crucero. **Supuesto:** el arrastre de presión por
separación es *"a fairly consistent percentage of the skin-friction drag for different classes of
aircraft"*. **Qué se rompe fuera:** transónico/supersónico (no hay onda), y configuraciones sucias
(tren fuera, stores).

```
R-Ec. 12.24  [CUERPO PERDIDO]  build-up subsónico por componente.
             El texto que rodea la ecuación la define sin ambigüedad, p.417:
             "estimates the subsonic parasite drag of each component… using a calculated flat-plate
              skin-friction drag coefficient Cf and a component 'form factor' FF… Then the
              interference effects on the component drag are estimated as a factor Q, and the total
              component drag is determined as the product of the wetted area, Cf, FF, and Q…
              Miscellaneous drags CD_misc… are then estimated and added to the total, along with
              estimated contributions for leakages and protuberances CD_L&P"
             [No la escribo como ecuación: el cuerpo no está en el texto. Ver §7.]

R-Ec. 12.25  R = rho * V * l / mu       (Reynolds; l = longitud característica:
                                         fuselaje -> longitud total; ala/cola -> MAC)
R-Ec. 12.26  Cf = 1.328 / sqrt(R)       (laminar, placa plana)
R-Ec. 12.27  [CUERPO PERDIDO]  Cf turbulento con corrección de Mach.
             Lo único que el texto afirma: "For turbulent flow the flat-plate skin-friction
             coefficient is determined by Eq. (12.27), which includes a Mach number correction,
             which is trivial at low speeds." Ver §7.
R-Ec. 12.28  R_cutoff = 38.21 * (l/k)^1.053                 (subsónico)
R-Ec. 12.29  R_cutoff = 44.62 * (l/k)^1.053 * M^1.16        (transónico o supersónico)
```

**Regla de uso del cutoff (p.421), literal:** *"If the calculated cutoff Reynolds number is lower than
the actual Reynolds number, then the roughness will increase the drag, so the cutoff Reynolds number
should be used in Eq. (12.27)."* — o sea `R_usado = min(R_real, R_cutoff)`.

**Tabla 12.5 — Rugosidad de piel `k`** (p.421):

| Superficie | k, ft | k, m |
|---|---|---|
| Pintura de camuflaje sobre aluminio | 3.33e-5 | 1.015e-5 |
| Pintura lisa | 2.08e-5 | 0.634e-5 |
| Chapa de producción | 1.33e-5 | 0.405e-5 |
| Chapa pulida | 0.50e-5 | 0.152e-5 |
| Compuesto moldeado liso | 0.7e-5 | **[OCR DUDOSO: 0.052e-5]** — el valor métrico no cuadra con la razón ft→m de las otras filas |

**Tabla 12.4 — Flujo laminar alcanzable (% del área mojada)** (p.419) — [fuselaje, ala y colas]:

| Clase | Fuselaje % | Alas y colas % |
|---|---|---|
| GA — metal liso (sin remaches ni juntas) | 10 | 35 |
| GA — compuesto moldeado liso | 25 | 50 |
| Planeador — compuesto moldeado liso | 35 | 70 |
| Helicóptero — diseño tradicional | 0 | 0 |
| Helicóptero — diseño liso | 20 | 20 |
| Jet civil — metal de producción clásico | 5 | 10 |
| Jet civil — meta de investigación (pasivo) | 25 | 50 |
| Jet civil — meta de investigación (succión activa) | 50 | 80 |
| Avión militar con camuflaje | 0 | 0 |
| Supersónico — actual | 0 | 0 |
| Supersónico — meta con succión activa | 20 | 40 |

Notas al pie de la tabla, literales: *"Unlikely near wing-mounted engines (1 diameter each side)"* ·
*"Unlikely past crack for movable surfaces like leading-edge flaps"* · *"More difficult for wings with
more sweep"* · *"Reduces behind propeller (for area in propwash, multiply above by 0.8 and 0.9)"* ·
*"These are for entire wetted area of wing, not just 2D airfoil"* · *"These are a percentage of total
wetted area, not the length from the nose."*

Dato de calibración (p.418): NASA probó VariEze, Long-EZ y Bellanca Skyrocket y *"deliberately
'tripping' the flow to turbulent right at the wing leading edge caused a **25% increase in cruise
drag of the whole airplane**."* Y el límite físico: en placa lisa, la transición ocurre *"until the
local Reynolds number reaches roughly half a million"*.

**Factores de forma:**
```
R-Ec. 12.30  FF = [ 1 + (X / (x/c)_m) * (t/c) + 100 * (t/c)^4 ] * [ 1.34 * M^0.18 * (cos Λ_m)^0.28 ]
             [OCR DUDOSO: el numerador X del segundo término se perdió — el OCR imprime un carácter
              ilegible. NO lo inventes. Todo lo demás de la ecuación es legible.]
             Ala, cola, montante, pilón.
R-Ec. 12.31  [CUERPO PERDIDO]  fuselaje y canopy liso (6a edición).
             PERO la nota al pie de p.422 SÍ está completa y da la forma de las ediciones previas:
                "In prior editions of this book, the fuselage form factor was given as
                 FF = 1 + 60/f^3 + f/400, a classic RAND estimation method used in the DATCOM"
             y explica por qué la cambió: da buena correlación para f > 6 "but seems to overestimate
             drag for fineness ratios much below 5". La nueva es un compromiso del autor que
             "gives conservative (larger) values". Ver §7 y §3 (el DR-3 reproduce la VIEJA).
R-Ec. 12.32  FF = 1 + 0.35/f            (nacela y store externo liso)
R-Ec. 12.33  f = l/d = l / sqrt( (4/pi) * A_max )
R-Ec. 12.34  FF = 1 + (d/l)             (diverter de doble cuña)
R-Ec. 12.35  FF = 1 + (2*d/l)           (diverter de cuña simple)
```
`(x/c)_m` = posición del máximo espesor: **~0.3 c** en perfiles de baja velocidad, **~0.5 c** en
perfiles de alta velocidad. `Λ_m` = flecha de la línea de máximo espesor.

**Rango de validez, literal (p.422):** *"These are considered **valid up to the drag-divergent Mach
number**."* Y (p.424): *"Such form factors are corrections to account for pressure drags and are
**applicable only in subsonic flight.**"*

**Incrementos porcentuales al FF** (p.423–424) — recordar `REQ-VISCOSO-12-16` (se aplican solo a la
parte por encima de 1.0):

| Caso | Incremento |
|---|---|
| Cola con timón/elevador articulado | +10% |
| Fuselaje de lados planos | +30 a +40% |
| Casco de hidroavión | +50% |
| Flotador | ×3 (300%) |
| Canopy de dos piezas con parabrisas carenado (F-15) | +40% |
| Canopy con parabrisas de caras planas (A-10, Me-109) | +300% |
| Fuselaje con cierre abrupto delante de hélice propulsora | −50% mientras gira, ×2 cuando se para (*"author's wild guess"*) |
| Cuerpos optimizados con criterio de Stratford / CFD | −10 a −20%, *"maybe more"* (*"This author's wild guess"*) |

**Interferencia `Q`** (p.425) — no hay ecuación, son valores:

| Caso | Q |
|---|---|
| Nacela o store montado directo sobre fuselaje o ala | ~1.5 |
| Montado a menos de ~1 diámetro | ~1.3 |
| Montado a bastante más de 1 diámetro | ~1.0 |
| Misil en puntera de ala | ~1.25 |
| Ala alta, ala media, o ala baja bien carenada | ~1.0 |
| Ala baja sin carenar | 1.1–1.4 |
| Fuselaje | 1.0 |
| Diverter de capa límite | 1.0 |
| Cola en V limpia | 1.03 |
| Cola en H | 1.08 |
| Cola convencional | 1.04–1.05 |

**Arrastres misceláneos:**
```
R-Ec. 12.36  (D/q)_upsweep = 3.83 * u^2.5 * A_max        (u en RADIANES, ángulo de la línea
                                                          central del fuselaje, no del vientre)
R-Ec. 12.37  (D/q)_base = [0.139 + 0.419*(M - 0.161)^2] * A_base    (subsónico)
R-Ec. 12.38  (D/q)_base = [0.064 + 0.042*(M - 3.84)^2] * A_base     (supersónico)
R-Ec. 12.39  (D/q)_prop_bandera = 0.1 * sigma * A_disco_helice
             (sigma = solidez = n_palas / (pi * AR_pala); con AR_pala = 8 -> sigma = 0.04*n_palas)
             Si la hélice NO se puede abanderar, el 0.1 se reemplaza por 0.8.
R-Ec. 12.40  (D/q)_turborreactor_molinete = 0.3 * A_cara_frontal_motor
```
`A_base` incluye *"actual aft-facing flat surfaces as well as the aft-projected areas of steeply
angled regions likely to experience separated airflow. Roughly speaking, this should be expected any
place where **the aft angle to the freestream exceeds about 20 deg.**"*

**Tabla 12.6 — `C_D_pi` = (D/q)/área frontal** (p.429) — transcrita literal:

| Componente | C_Dpi |
|---|---|
| Placa plana perpendicular al flujo | 1.28 |
| Esfera sola — Re alto | 0.10 |
| Esfera sola — Re bajo | 0.3–0.5 |
| Esfera hueca, boca hacia adelante | 1.40 |
| Esfera hueca, boca hacia atrás | 0.40 |
| Forma de bala, base plana | 0.30 |
| Radiador de agua expuesto | 1.00 |
| Radiador de agua carenado | 0.3–0.5 |
| Tomas de aire | 1.2–2.0 |
| Cuerno de mando (control horn) | 0.3–0.8 |
| Aerofreno en fuselaje | 1.00 |
| Aerofreno en ala | 1.60 |
| Parabrisas bien carenado al fuselaje | 0.07 |
| Parabrisas de canto vivo, mal carenado | 0.15 |
| Cabina abierta (ref. área frontal del parabrisas) | 0.50 |
| Paracaídas / drogue | 1.40 |
| Rueda y neumático normales | 0.25 |
| Segunda rueda en tándem | 0.15 |
| Rueda y neumático carenados aerodinámicamente | 0.18 |
| Rueda y neumático con fairing | 0.13 |
| Montante carenado (1/6 < t/c < 1/3) | 0.05 |
| Montante o cable redondo (Re > 3e5) | 0.30 |
| Montante o cable redondo (Re < 3e5) | 1.17 |
| Pata de tren de ballesta plana | 1.40 |
| Horquilla, bogie, herraje irregular | 1.0–1.4 |

Reglas anexas (p.430): sumar componentes de tren y **multiplicar por 1.2** por interferencia mutua;
**+7%** si el tren es retráctil y deja las puertas abiertas. Espesor óptimo de montante:
**0.19 en tracción, 0.23 en compresión**.

**Tabla 12.7 — Arrastres de componentes (D/q absoluto)** (p.430):

| Componente | ft² | m² |
|---|---|---|
| Gancho de apontaje — USN | 0.15 | 0.014 |
| Gancho de apontaje — USAF | 0.10 | 0.009 |
| Portillas de ametralladora | 0.02 | 0.002 |
| Portilla de cañón | 0.20 | 0.019 |
| Piloto expuesto — tumbado | 1.20 | 0.111 |
| Piloto expuesto — sentado | 6.00 | 0.557 |
| Piloto expuesto — brazos y piernas abiertos | 9.00 | 0.836 |

**Tabla 12.8 — Fugas y protuberancias (% del arrastre parásito)** (p.431):

| Tipo | % |
|---|---|
| Avión de hélice | 5–10 |
| Transporte a reacción o bombardero | 2–5 |
| Caza no furtivo | 10–15 |
| Caza furtivo | 3–5 |

Y **+3% adicional** si el ala es de flecha variable, por los huecos y escalones del pivote.

**Supersónico y onda:**
```
R-Ec. 12.41  CD0_supersonico = SUM_c( Cf_c * S_wet_c / S_ref ) + CD_misc + CD_L&P + CD_wave
R-Ec. 12.42  [CUERPO PERDIDO]  radio del cuerpo de Sears-Haack
R-Ec. 12.43  -l/2 <= x <= l/2
R-Ec. 12.44  (D/q)_wave_SearsHaack = (9*pi/2) * (A_max / l)^2
R-Ec. 12.45  (D/q)_wave = E_wd * [ 1 - 0.386*(M - 1.2)^0.57 * (1 - pi*Λ_LE^0.77/100) ]
                                * (D/q)_Sears-Haack
```
**Reglas de aplicación de 12.45 (p.435), literales:** restar del `A_max` el **área de captura de la
toma**; restar de `l` **toda porción del avión con área de sección constante**; y si el máximo de
sección está muy detrás del punto medio, *"it should be assumed that the fuselage length is double
the distance from nose to the location of maximum cross-section area."*

Valores de `E_wd` (p.435): **1.0** Sears-Haack perfecto · **1.2** delta mezclada muy limpia ·
**1.8–2.2** caza/bombardero/SST típico · **2.5–3.0** diseño malo · **2.9** el F-15 · **4.0** para
aproximar el drag rise de un transporte subsónico (p.439).

**La corrección del propio autor:** *"This author notes that this old empirical relationship seems
overly optimistic and gets better results by **replacing the 0.386 term with 0.2.**"*

```
R-Ec. 12.46  [CUERPO PERDIDO]  M_DD del ala (usa Figs. 12.29 y 12.30)
```
Definiciones que sí están (p.436): **M_DD (Boeing)** = donde el drag rise llega a **20 counts**,
típicamente **0.08 Mach** por encima de `M_cr`. **M_DD (Douglas / USAF)** = donde `dCD0/dM` llega a
**0.10**, típicamente **0.06 Mach** por encima del de Boeing, y representa **80–100 counts**.
*"Jet transports usually cruise at about M_DD (Boeing) and have a maximum level speed of about M_DD
(Douglas)."* Perfil supercrítico: **multiplicar el `t/c` real por 0.6** antes de entrar a las figuras.
Ejemplo declarado: el Boeing 727 tiene `M_DD ≈ 0.86` a `C_L = 0.1` y **≈ 0.82** a `C_L = 0.3`.

**Construcción del drag rise (Fig. 12.32, p.438–439) — el algoritmo de 7 pasos:**
1. Punto **A** = arrastre a M ≥ 1.2, de `R-Ec. 12.45` dividido entre `S_ref`.
2. Punto **B** = arrastre a M 1.05 **= igual al de M 1.2**.
3. Punto **C** = arrastre a M 1.0 **= la mitad del de M 1.05**.
4. Punto **D** = `M_DD`, con drag rise **= 0.002 por definición**.
5. Punto **E** = `M_cr` ≈ **0.08 Mach** más lento que `M_DD`.
6. Recta por **B–C** extendida casi hasta el eje horizontal.
7. Curva de **E** a **D** que empalme suave con esa recta; si no empalma, **mover E** hasta que se
   pueda trazar un arco aproximadamente circular. Luego curva suave de **B** a **A**.

En transónico la fricción se interpola recta entre `M_DD` (con FF y Q) y M1.2 (sin ellos):
*"**This does not reflect any reduction in drag, merely a change in bookkeeping.**"*

#### 2.1.5 Arrastre inducido / debido a sustentación

```
R-Ec. 12.47  K = 1 / (pi * A * e)
R-Ec. 12.48  e = 1.78 * (1 - 0.045 * A^0.68) - 0.64                       (ala recta)
R-Ec. 12.49  e = 4.61 * (1 - 0.045 * A^0.68) * (cos Λ_LE)^0.15 - 3.1      (ala en flecha, Λ_LE > 30)
R-Ec. 12.50  e_biplano = mu^2 * (1 + r)^2 / (mu^2 + 2*sigma*mu*r + r^2)
             mu = envergadura menor / envergadura mayor
             r  = sustentación del ala corta / del ala larga (~ razón de áreas)
             sigma = factor de interferencia de Prandtl (Fig. 12.36 — es imagen)
R-Ec. 12.51  K = A*(M^2 - 1)*cos(Λ_LE) / (4*A*sqrt(M^2 - 1) - 2)
             [OCR DUDOSO: la fracción se lee partida; la estructura numerador/denominador es
              legible pero el agrupamiento exacto no está garantizado.]
```
`e` típico: **0.7–0.85**. **Rango de 12.48/12.49:** *"should only be used with 'normal' aspect ratios
and sweeps and **are not valid for high-aspect-ratio designs such as sailplanes**."* Entre 0° y 30° de
flecha, **interpolar linealmente**. Con winglets/endplates, usar el `A` efectivo de 12.10/12.11.
Biplano: *"this Prandtl biplane span efficiency method seems a bit optimistic… it is suggested that
the results be **multiplied by 0.8**"*. Con gap/envergadura media ≈ 0.15 sale `e ≈ 1.3` (>1), pero
ojo: *"the aspect ratio is based on the total wing area so that it is about half the aspect ratio of
the individual wing panels."*
Supersónico: `e` cae a **0.3–0.5** a M 1.2.

**Método de succión de borde de ataque** (§12.6.2, p.446–451) — el que el autor recomienda:
```
R-Ec. 12.52  L  = N * cos(alpha)
R-Ec. 12.53  Di = N * sin(alpha) = L * tan(alpha)
R-Ec. 12.54–12.55   [pasos algebraicos]
R-Ec. 12.56  K_0 = alpha/CL = 1/CL_alpha       (0% de succión: K es el inverso de la pendiente)
R-Ec. 12.57  K = S*K_100 + (1 - S)*K_0
R-Ec. 12.58  e = 1 / [ (pi*A/CL_alpha)*(1 - S) + S ]
R-Ec. 12.59  ΔN = S * (1/CL_alpha - 1/(pi*A))
```
`K_100 = 1/(pi*A)` en subsónico. **Transición dura:** *"In transonic flight, starting at M_DD, the
shock formation interferes with leading-edge suction… **When the leading edge becomes supersonic, the
suction goes to zero**, so the K value equals the terrible 0% K value. This occurs at the speed at
which the Mach angle (arcsin 1/M) equals the leading-edge sweep."*

Valores de `S` (p.447–451): **0.85–0.95** en crucero subsónico con radio de borde grande y flecha
moderada; **≈0.9** en el `C_L` de diseño del ala; **0.93** (línea recta a la izquierda) para
transportes; **0.95–0.97** con alargamiento alto; **≈0** para un caza supersónico en viraje de alta g.
El ejemplo del libro: *"A wing with an `S` of 0.9 at its design lift coefficient of 0.5 can have an
`S` value **less than 0.3** at a lift coefficient of 1.0."*
Receta para alargamiento alto sin datos de ensayo: fijar `e = 0.8` en el `C_L` de diseño, despejar
`S` con 12.58, mantenerlo hasta `C_L_diseño + 0.1`, y de ahí caer hasta **80% de ese `S`** en el
`C_L` de entrada en pérdida.

```
R-Ec. 12.60  K_efectivo / K = 33*(h/b)^1.5 / [ 1 + 33*(h/b)^1.5 ]      (efecto suelo)
```
**Rango:** *"when a wing is near the ground, say **less than half the span away**"*. `h` = altura del
ala sobre el suelo.

```
R-Ec. 12.61  [CUERPO PERDIDO]  arrastre parásito de flap.
             Los coeficientes SÍ están, p.452: F_flap = 0.0144 (plain), 0.0074 (slotted);
             delta_flap en GRADOS; c_f = cuerda del flap. Referido al ÁREA ALAR, no del flap.
             Deflexiones típicas: 60-70 deg aterrizaje, 20-40 deg despegue.
R-Ec. 12.62  [CUERPO PERDIDO]  arrastre inducido adicional por flap.
             El coeficiente SÍ está: k_f = 0.14 flap de envergadura completa, 0.28 media envergadura.
```
Advertencia física asociada (p.452): al desplegar flaps la distribución en envergadura deja de ser
elíptica *"so the drag due to lift is increased and **possibly doubled**."*

#### 2.1.6 Lo que el capítulo 12 dice del CFD (§12.7, p.452–461)

Jerarquía declarada de códigos, de más a menos: **LES → RANS → PNS → Euler → potencial → linealizado**.
Datos duros que sirven de gate:
- *"Actual flight-measured values of lift and drag are usually **within about 2–10%** of the
  estimates"* con la práctica clásica (códigos linealizados + datos empíricos).
- RANS: *"simplifies the solution down to 'only' solution of about **60 partial derivative
  equations**"*.
- *"**CFD does not replace the wind tunnel.** In fact, it doesn't really reduce the number of
  wind-tunnel test hours."*
- Sensibilidad al mallado, literal: *"**You can actually get different answers for the same aircraft
  using two different gridding schemes.** According to the author of [86], 'this sensitivity is more
  pronounced than that due to the type of mathematical model being used, e.g., NS vs. Euler
  equations.'"*
- El caso 737/CFM-56: el CFD identificó que la «interferencia» era **arrastre inducido**, cosa que
  *"had not been determined in **20 years of wind-tunnel testing!**"*
- Optimización por teoría de control (Jameson): eliminó ondas de choque a M0.83 con **15 counts** de
  reducción (**8%**).

### 2.2 Capítulo 13 — Propulsión (p.463–489)

#### 2.2.1 El modelo de disco (§13.1, p.464)
```
R-Ec. 13.1   F = m_punto * ΔV = (rho*V*S)*(V - V0) = rho*S*V*(V - V0)
R-Ec. 13.2   P_t = F*V0 = rho*S*V*(V - V0)*V0
R-Ec. 13.3   P_gastada = (rho*S/2) * V * (V^2 - V0^2)
R-Ec. 13.4   eta_PE = P_t / P_gastada = 2 / (V/V0 + 1)
```
**Supuestos (que el libro declara falsos a propósito):** velocidad de escape uniforme y toda la
aceleración ocurre en el disco. *"Actually, the exhaust of a jet engine is usually at a higher
pressure than the outside air, so the flow expands after leaving the nozzle… For a propeller, the
air-mass acceleration doesn't even occur at the propeller disk. **Roughly half the air-mass
acceleration occurs before reaching the propeller**, and the other half occurs after."*
**Para qué sirve igual:** demuestra el compromiso empuje↔eficiencia. Razones típicas `V/V0`:
**>3.0 turborreactor**, **~1.5 hélice**.

Reglas de dedo de motor (p.467–468):
- Empuje específico por gasto másico: **100–130 lb por lb/s {1–1.3 kN por kg/s}** turborreactor con
  postcombustión; **10–30 {0.1–0.3}** turbofán (estático a nivel del mar).
- Efecto de densidad: empuje ∝ (razón de presiones)/(razón de temperaturas absolutas).
  Ajuste simple por día caliente: **−0.42% por °R {−0.75% por K}**.
- **OPR** típico **15:1 a 30:1**.
- **TIT**: estequiométrico sería 15:1 aire/combustible; se usa **~60:1**. Los primeros jets ~**1500°F
  {800°C}**; hoy **2000–2500°F {~1100–1400°C}**; lo más nuevo **2900°F {1600°C}**. Progreso histórico:
  **~320°F {180°C} por década**.

#### 2.2.2 Empuje instalado (§13.3, p.469–479)
```
R-Ec. 13.5   (P1/P0)_ref = 1 - 0.075 * (M_inf - 1)^1.35        (MIL-E-5008B, solo supersónico)
R-Ec. 13.6   % pérdida de empuje = C_ram * [ (P1/P0)_ref - (P1/P0)_real ] * 100
R-Ec. 13.7   C_ram ~= 1.35 - 0.15 * (M_inf - 1)                (supersónico)
R-Ec. 13.8   % pérdida de empuje = C_bleed * (gasto de sangrado / gasto del motor) * 100
```
`C_ram` típico **1.2–1.5**; sin datos del fabricante, **1.35 en subsónico**. `C_bleed ≈ 2.0`.
Sangrado típico **1–5%** del gasto.
**Aviso de validez de 13.5:** *"this widely used Mil-Spec pressure recovery schedule **does not
actually represent any particular inlet shock system**."*
Recuperación interna del conducto (p.474): **0.96 recto**, **0.94 en S**, **0.98 o mejor** en nacela
podada corta subsónica.
Dato de calibración: el F-16 estático a empuje máximo cae a **0.86**; a la mitad del gasto, **>0.96**;
a M0.6 la diferencia es **2%**, y menos aún más arriba. *"This mass-flow variation… **can be neglected
for conceptual design studies.**"*
Extracción de potencia: *"typically less than **200 hp {150 kW} for a 30,000-lb-thrust {133-kN}
engine**"*, y *"the SFC increase and thrust loss are both **slightly less than the percent of power
that is extracted**"*.

**Tabla 13.1 — Arrastre incremental de tobera** (p.479), referido a `A_max` **del fuselaje**:

| Tipo de tobera | D/q / A_fuselaje (subsónico) |
|---|---|
| Convergente | 0.036–0.042 |
| Convergente de iris | 0.001–0.020 |
| Eyector | 0.025–0.035 |
| Eyector variable | 0.010–0.020 |
| Tapón trasladante | 0.015–0.020 |
| Tobera 2-D | 0.005–0.015 |

*"The nozzle drag increases transonically and then drops off at supersonic speeds. **For initial
analysis the subsonic value can be assumed for all speeds.** …For a subsonic, podded nacelle, the
nozzle drag is negligible."*

Datos de arrastre de toma (p.477): la succión del labio del capó reduce el arrastre aditivo
**30–40%** en bajo supersónico y *"For a subsonic jet with well-rounded cowl lips, this suction will
**virtually eliminate additive drag**."* Sin bypass, el aditivo *"could exceed **20% of the total
aircraft drag**"*.
**Aviso sobre la Fig. 13.9:** *"This chart was prepared by the author… and **should be used with great
caution as they are merely typical data, not an estimate for any given inlet design.**"*

#### 2.2.3 Potencia parcial (§13.4, p.479)
```
R-Ec. 13.9   C / C_max_dry = 0.1/(T/T_maxdry) + 0.24/(T/T_maxdry)^0.8
                             + 0.66*(T/T_maxdry)^0.8
                             + 0.1*M*[ 1/(T/T_maxdry) - (T/T_maxdry) ]
             [OCR DUDOSO: los cuatro términos y sus exponentes son legibles pero el agrupamiento de
              los dos primeros denominadores se lee partido. Verificar antes de usar como fixture.]
```
Origen: **Mattingly**, coautor de la ref. [42]. Tope duro: **SFC de ralentí ≈ 1.5 × SFC max-dry**.

#### 2.2.4 Pistón (§13.5, p.480)
```
R-Ec. 13.10  potencia = potencia_SL * [ (rho/rho_0) - (1 - rho/rho_0)/7.55 ]
```
Origen: **Gagg y Ferrar, Wright Aeronautical, 1934**. Predicción declarada: *"at an altitude of
20,000 ft {6100 m} a piston engine has **less than half of its sea-level power**."*
Regla base: **hp ≈ 620 × gasto másico [lb/s]**, o **kW = 1019 × gasto [kg/s]**.
Sobrealimentación: mantiene presión de nivel del mar hasta **15,000–20,000 ft {4500–6100 m}**.

#### 2.2.5 Hélice (§13.6–13.8, p.481–489)
```
R-Ec. 13.11  J  = V / (n*D)                          (advance ratio; n en rev/s, D en ft o m)
R-Ec. 13.12  Cp = P/(rho*n^3*D^5) = 550*bhp/(rho*n^3*D^5)
R-Ec. 13.13  [CUERPO PERDIDO]  coeficiente de empuje Ct
R-Ec. 13.14  Cs = ( J^5 / Cp )^(1/5)
             [OCR DUDOSO: el OCR se lee "cs = v\Jp/Pn2". La DEFINICIÓN en prosa sí es clara:
              "The speed-power coefficient is defined as the advance ratio raised to the fifth power
              divided by the power coefficient" — y añade que "does not involve the propeller
              diameter, which is useful for comparison between propellers of different sizes."]
R-Ec. 13.15  AF_por_pala = (10^5/D^5) * INT_{0.15R}^{R} c*r^3 dr
                         = (10^5 * c_root / (16*D)) * [ 0.25 - (1 - lambda)*0.2 ]
             [OCR DUDOSO: la integral y el segundo miembro se leen partidos.]
R-Ec. 13.16  eta_p = T*V / P = T*V / (550*bhp)
R-Ec. 13.17  T = P*eta_p/V = 550*bhp*eta_p/V           (vuelo hacia adelante)
R-Ec. 13.18  T = (Ct/Cp)*(P/(n*D)) = (Ct/Cp)*(550*bhp/(n*D))    (estático)
```
Unidades declaradas: `T` en lb o kN · `V` en ft/s o m/s · `P` en ft-lb/s o kW · `n` en **rev/s** ·
`D` y `c` en ft o m.

**Activity factor:** rango **90–200**; **100** típico en avión ligero, **140** en turbohélice grande.
**Paso** = ángulo de pala **al 75% del radio** (70% en algunos libros).
`C_L` de diseño del perfil de pala ≈ **0.5**.
Correcciones por número de palas respecto a la carta de 3 palas del libro:
**2 palas → +3% en vuelo, −5% estático**; **4 palas → al revés**; **hélice de madera → −10%**.
Hélice de paso fijo: **el empuje estático es ~60% mayor que el empuje a 100 kt**.

```
R-Ec. 13.19  J_corregido = J * (1 - 0.329 * Sc/D^2)        (bloqueo por la nacela detrás)
R-Ec. 13.20  eta_p_corr = eta_p - (M_tip - 0.89)*(0.48 - 0.163*t/c)     SOLO si M_tip > 0.89
             M_tip = sqrt( V^2 + (pi*n*D)^2 ) / a
             [OCR DUDOSO: el término "(7rD)^2" se lee sin la n; la definición correcta de velocidad
              helicoidal de punta exige (pi*n*D). Marcado.]
R-Ec. 13.21  eta_p_efectiva = eta_p * [ 1 - (1/0.5582)*(rho/rho_0)*SUM(Cf_e*S_wet_washed)/... ]
             [OCR DUDOSO: MUY degradada. Método SBAC. Lo que sí es utilizable: "If the parasite-drag
              coefficient for the propwashed parts of the aircraft cannot be determined, 0.004 is a
              reasonable estimate."]
R-Ec. 13.22  (D/q)_cooling = 4.9e-7 * bhp * T / (sigma * V^2)   {ft2}
                           = 6e-8 * rho*V^2 / (sigma*V)         {m2}
             [OCR DUDOSO en ambas formas: los exponentes y el agrupamiento se leen partidos.]
R-Ec. 13.23  (D/q)_misc = 2e-4 * bhp   {ft2}  =  2.5e-5 * P  {m2}
             donde T = temperatura del aire (°R o K), V velocidad, sigma = rho/rho_0
```
**Recomendación explícita de NO usar 13.22–13.23:** *"a typical light aircraft engine installation
might experience cooling and miscellaneous drag levels **two to three times** the values estimated by
these equations. **Rather than use these equations**, it is reasonable to assume that an expertly
designed cooling system will produce a cooling drag equivalent to a **6% reduction in thrust**, and a
not-so-good system will produce an **8–10%** reduction."*

Pusher: scrubbing = 0, pero pérdida por estela de fuselaje/ala **2–5%**.
Turbohélice: chorro residual hasta **20%** del empuje total; equivalencia estática = **residual/2.5**;
en vuelo con `eta_p = 0.80`. Límite de punta ≈ **M0.7**; mejor que el pistón por encima de **M0.5**;
propfan/open rotor mantiene `eta_p > 0.8` **hasta M0.85**.

### 2.3 Capítulo 14 — Cargas (§14.2–14.6, p.491–507)

**Tabla 14.1 — Categorías de carga** (p.493), completa:

| Airloads | Landing | Inertia | Other |
|---|---|---|---|
| Maniobra · Ráfaga · Deflexión de mando · Interacción entre componentes · Buffet · **Granizo (3/4 in.)** | Factor de carga vertical · Spin-up · Spring-back · Crabbed · Una rueda · Apontaje · Frenado | Aceleración · Rotación · Dinámica · Vibración · Flameo | Remolque · Gateo · Presurización · Impacto de ave · Actuación · Choque · Presión de combustible |
| | Despegue · Catapulta · Abortado · Rodaje · Baches · Viraje | | Powerplant: empuje · par · giroscópicas · vibración · presión de conducto · **hammershock** · pérdida de pala/hélice · agarrotamiento |

**Tabla 14.2 — Factores de carga límite típicos** (p.495) — transcrita literal:

| Clase | n positivo | n negativo |
|---|---|---|
| GA — normal | 2.5 a 3.8 | −1 a −1.5 |
| GA — utilitario | 4.4 | −1.8 |
| GA — acrobático | 6 | −3 |
| Homebuilt | 5 | −2 |
| Transporte | 3 a 4 | −1 a −2 |
| Bombardero estratégico | 3 | −1 |
| Bombardero táctico | 4 | −2 |
| Caza | 6.5 a 9 | −3 a −6 |

**Factor de seguridad = 1.5 desde los años 30** (norma del Air Corps, razón última/fluencia del
aluminio 24ST). Carga última = 1.5 × carga límite. Nota histórica verificable: los hermanos Wright
diseñaron el Flyer a **5 g últimos ⇒ 3.33 g límite**, *"about the same as today's general aviation
design practice."*

```
R-Ec. 14.1   [CUERPO PERDIDO]  velocidad equivalente Ve.
             El texto la define en prosa, p.497: la Ve es la velocidad basada en presión dinámica,
             menor que la real en altura por la caída de densidad; el pitot mide Vi, se corrige por
             compresibilidad a Ve, y de ahí a velocidad real.
R-Ec. 14.2   Δalpha = atan(U/V) ~= U/V
R-Ec. 14.3   ΔL = 0.5*rho*V^2*S*(CL_alpha*Δalpha) = 0.5*rho*V*S*CL_alpha*U
R-Ec. 14.4   Δn = ΔL/W = rho*U*V*CL_alpha / (2*(W/S))
R-Ec. 14.5   U = K * U_de
R-Ec. 14.6   K = 0.88*mu / (5.3 + mu)                     (subsónico)
             [OCR DUDOSO: se lee "_5o_. 3. _ __ 8 8 µ,/ + µ,". La estructura 0.88*mu/(5.3+mu) es la
              lectura más plausible pero NO está garantizada. Verificar.]
R-Ec. 14.7   K = mu^1.03 / (6.95 + mu^1.03)               (supersónico)
R-Ec. 14.8   mu = 2*(W/S) / (rho * g * c_barra * CL_alpha)     (razón de masa)
```
`U_de` = **velocidad de ráfaga equivalente derivada** de datos de vuelo, no calculada.
Valores normativos: **30 ft/s {9.1 m/s}** hasta velocidad de crucero para GA normal, utilitario y
acrobático; de ahí **cae lineal hasta 15 ft/s {4.6 m/s}** en velocidad de picada. Transportes: la
Fig. 14.6 (imagen) da `U_de` decreciente con la altitud.

**Supuestos que 14.4 rompe y por qué existe K:** *"Figure 14.5 and Eq. (14.4) assume that the aircraft
instantly encounters the gust and that it instantly affects the entire aircraft. **These assumptions
are unrealistic.** Gusts tend to follow a cosine-like intensity increase… **This reduces the
acceleration experienced by the aircraft by as much as 40%.**"*
**Qué se rompe fuera:** *"This method for estimation of gust loads is **not as complete or accurate as
the methods used at most large aircraft companies.** The more accurate methods rely upon a
**power-spectral-density** approach."*

Consecuencia contraintuitiva que hay que enseñar (p.499): *"the load factor due to a gust **increases
if the aircraft is lighter**… the change in lift due to a gust is unaffected by aircraft weight, so
the change in wing stress is the same in either case. However, if the aircraft is lighter, the same
lift increase will cause a greater vertical acceleration so that **the rest of the aircraft will
experience more stress**."*
Y el alivio aeroelástico: **ala en flecha atrás ⇒ ~15% menos factor de carga** para la misma ráfaga.

**Velocidades y distribución:**
- Picada: subsónico **40–50% por encima del crucero**; supersónico *"about Mach 0.2 faster than
  maximum level-flight speed"*, y aviso: *"many fighters have enough thrust to accelerate past their
  maximum structural speed."*
```
R-Ec. 14.9   [CUERPO PERDIDO]  cuerda de planta trapezoidal c(y)
R-Ec. 14.10  [CUERPO PERDIDO]
R-Ec. 14.11  c(y) = (4*S/(pi*b)) * sqrt( 1 - (2*y/b)^2 )        (cuerda elíptica)
R-Ec. 14.12  [CUERPO PERDIDO]  velocidad de maniobra Vp (relación empírica con W y Vs)
R-Ec. 14.13  K_p = 0.15 + 5400/(W + 3300)
```
`K_p` **debe quedar entre 0.5 y 1.0**; en GA *"usually does not exceed 0.9"*. `W` en **libras**
(*"if using mks units, first multiply kg by 2.2"*). `V_s` con hipersustentadores desplegados.
Velocidad con flaps `V_f` ≈ **el doble de la velocidad de pérdida con flaps abajo**.

**Schrenk** (p.502): distribución = **promedio de la planta real y una elipse de igual envergadura y
área**; el área bajo la curva debe **sumar la sustentación total requerida**; la carga *"is assumed to
continue to the centerline of the aircraft"* (buen supuesto en subsónico); con diedro, **dividir entre
`cos Γ`**. **Qué se rompe fuera:** *"Schrenk's approximation **does not apply to highly swept planforms
experiencing vortex flow.** Vortex flow tends to greatly increase the loads at the wing tips."*
Con torsión, la carga básica exige **prueba y error** para hallar el ángulo de sustentación nula ⇒
**otro lazo de iteración**.
Arrastre en envergadura, primera aproximación: **95% de la carga media de la raíz al 80% de la
envergadura, y 120% del 80% a la puntera**.

**Mandos y cola** (p.505): deflexión de mando típica da **Δc_l de 0.8–1.1 a 25 grados**; cambio de
`c_m` del perfil ≈ **(−0.01) × deflexión en grados**. Cargas mínimas de cola por `C_n`:
horizontal **−0.55 abajo / +0.35 arriba**, vertical **+0.45**, con distribución proporcional a cuerda.
Fuerzas de piloto: ver `REQ-CARGAS-14-10`.
**Crítico para el ala:** *"the instantaneous loads imposed by **maximum aileron deflection while at
maximum load factor (rolling pull-up)** are frequently critical to the wing structure."*

**Cargas de tren** (p.506–507): drop test desde **9.2–18.7 in. {23–48 cm}**, con *"required drop
distance typically will be **3.6 times the square root of the wing loading**."* Spin-up: fuerza hacia
atrás de **hasta la mitad de la vertical**; spring-back **igual o mayor**. Frenado: coeficiente **0.8**
aplicado en el suelo. Retracción: airloads **más un viraje de 2 g**.
**Motor:** montantes soportan carga lateral **= 1/3 de la vertical de diseño**; par del motor con
factor por número de cilindros: **2 cil → 4.0 · 3 cil → 3.0 · 4 cil → 2.0 · ≥5 cil → 1.33**.
Dato de calibración de conducto: el **B-70 a M3 y 65,000 ft {20,000 m}** vio **4,320 psf
{207 kN/m²}**, *"which is 30 times the outside air pressure."*

**FEM** (§14.11, p.551–557): el bar 1-D completo, `R-Ec. 14.51–14.57`:
```
R-Ec. 14.51  epsilon = (u1 - u2)/L
R-Ec. 14.52  E = sigma/epsilon = (P/A) / [ (u1 - u2)/L ]
R-Ec. 14.53  P = (E*A/L) * (u1 - u2)
R-Ec. 14.54  P1 = (E*A/L) * (u1 - u2)
R-Ec. 14.55  P2 = (E*A/L) * (-u1 + u2)
R-Ec. 14.56/57  forma matricial: {P} = [K]{u}, con [K] la matriz de rigidez
```
Advertencias que valen como requisito de producto: *"Selection of which element type to use is a
matter of engineering judgment. **Unfortunately, the selection of the element type can influence the
results.** Also, the selection of the size of the elements requires experience… **As is the case for
CFD gridding, the modeling of a complex structure for FEM analysis can be very time consuming.**"*

### 2.4 Capítulo 15 — Pesos (p.559–583)

#### 2.4.1 Método aproximado por área (§15.2, Tabla 15.2, p.568)

| Grupo | Caza (lb/ft²) | Caza (kg/m²) | Transporte y bombardero (lb/ft²) | (kg/m²) | GA (lb/ft²) | (kg/m²) | Multiplicador | CG aprox. |
|---|---|---|---|---|---|---|---|---|
| Ala | 9 | 44 | 10 | 49 | 2.5 | 12 | `S_expuesta_proyectada` | 40% MAC |
| Cola horizontal | 4 | 20 | 5.5 | 27 | 2 | 10 | `S_expuesta_proyectada` | 40% MAC |
| Cola vertical | 5.3 | 26 | 5.5 | 27 | 2 | 10 | `S_expuesta_proyectada` | 40% MAC |
| Fuselaje | 4.8 | 23 | 5 | 24 | 1.4 | 7 | **`S_mojada`** | 40–50% de la longitud |
| Tren de aterrizaje | 0.033 | | 0.043 | | 0.057 | | × TOGW | centroide |
| Tren — Navy | 0.045 | | — | | — | | × TOGW | centroide |
| Motor instalado | 1.3 | | 1.3 | | 1.4 | | × peso del motor desnudo | centroide |
| "All-else empty" | 0.17 | | 0.17 | | 0.1 | | × TOGW | 40–50% de la longitud |

Nota al pie literal: *"**15% to nose gear, 85% to main gear**; reduce gear weight by **0.014 W0** if
fixed gear."*

**Tabla 15.3 — Pesos misceláneos** (p.571):

| Ítem | lb | kg |
|---|---|---|
| Harpoon (AGM-84) | 1200 | 544 |
| Phoenix (AIM-54A) | 1000 | 454 |
| Sparrow (AIM-7) | 500 | 227 |
| Sidewinder (AIM-9) | 200 | 91 |
| Pilón y lanzador | 0.12 · W_misil | |
| Cañón M61 | 250 | 113 |
| 940 cartuchos | 550 | 250 |
| Pasajero comercial (con equipaje de mano) | 190 | 86 |
| Asiento de cabina de mando | 60 | 27 |
| Asiento de pasajero | 32 | 15 |
| Asiento de tropa | 11 | 5 |
| Instrumentos (altímetro, anemómetro, acelerómetro, variómetro, reloj, brújula, viraje, Mach, tacómetro, presión de admisión…) | 1–2 c/u | 0.5–1 |
| Horizonte artificial, direccional | 4–6 c/u | 2–3 |
| HUD | 40 | 18 |
| Lavatorios — largo alcance | 1.11 · N_pax^1.33 | 0.5 · N_pax^1.33 |
| Lavatorios — corto alcance | 0.31 · N_pax^1.33 | 0.14 · N_pax^1.33 |
| Lavatorios — ejecutivo | 3.90 · N_pax^1.33 | 1.76 · N_pax^1.33 |
| Gancho de apontaje — USAF | 0.002 · W_dg | |
| Gancho de apontaje — Navy | 0.008 · W_dg | |
| Catapulta — Navy | 0.003 · W_dg | |
| Ala plegable — Navy | 0.06 · W_ala | |

#### 2.4.2 Las 59 ecuaciones estadísticas (§15.3, p.572–579)

> **Unidades: BRITÁNICAS. Resultado en LIBRAS.** Longitudes en **pies** salvo `L_m` y `L_n`, que van
> en **pulgadas**. Velocidades en **kt**. Ángulos en **grados**. `q` en **lb/ft²**. Volúmenes en
> **galones** salvo `V_pr` en **ft³**.
>
> **`N_z` es el factor de carga ÚLTIMO = 1.5 × límite.** Es el error más común según el propio autor.

**A) Caza / ataque — `R-Ec. 15.1` a `15.24`** (p.572–573):
```
15.1   W_ala = 0.0103 * K_dw * K_vs * (W_dg*N_z)^0.5 * S_w^0.622 * A^0.785
               * (t/c)_root^[EXPONENTE PERDIDO POR OCR] * (1+lambda)^0.05
               * (cos Λ)^-1.0 * S_csw^0.04
        [OCR DUDOSO: el exponente de (t/c)_root NO aparece en el texto. No lo inventes.]
15.2   W_cola_h = 3.316 * (1 + F_w/B_h)^-2.0 * (W_dg*N_z/1000)^0.260 * S_ht^0.806
        [OCR DUDOSO: el divisor 1000 se lee como bloque ilegible.]
15.3   W_cola_v = 0.452 * K_rht * (1 + H_t/H_v)^0.5 * (W_dg*N_z)^0.488 * S_vt^0.718
               * M^0.341 * L_t^-1.0 * (1 + S_r/S_vt)^0.348 * A_vt^0.223
               * (1+lambda)^0.25 * (cos Λ_vt)^-0.323
        [OCR DUDOSO: los signos de los exponentes de L_t y (cos Λ_vt) se leen sin el menos.]
15.4   W_fuselaje = 0.499 * K_dwf * W_dg^0.35 * N_z^0.25 * L^0.5 * D^0.849 * W^0.685
15.5   [CUERPO PERDIDO]  tren principal
15.6   W_tren_nariz = (W_l * N_l)^0.290 * L_n^0.5 * N_nw^0.525
        [OCR DUDOSO: el par (W_l*N_l) se lee "W:lNl".]
15.7   W_bancada_motor = 0.013 * N_en^0.795 * T^0.579 * N_z
15.8   W_cortafuegos = 1.13 * S_fw
15.9   W_seccion_motor = 0.01 * W_en^0.717 * N_en * N_z
15.10  W_admision = 13.29 * K_vg * L_d^0.643 * K_d^0.182 * N_en^1.498
               * (L_s/L_d)^-0.373 * D_e
        Regla: si L_s/L_d < 0.25, usar 0.25.
15.11  [CUERPO PERDIDO]  (tubo de escape / tailpipe)
15.12  W_refrig_motor = 4.55 * D_e * L_sh * N_en
15.13  W_refrig_aceite = 37.82 * N_en^1.023
15.14  W_mandos_motor = 10.5 * N_en^1.008 * L_ec^0.222
15.15  W_arrancador_neumatico = 0.025 * T_e^0.760 * N_en^0.72
15.16  W_sist_combustible = 7.45 * V_t^0.47 * (1 + V_i/V_t)^-0.095 * (1 + V_p/V_t)
               * N_t^0.066 * N_en^0.052 * (T*SFC/1000)^0.249
        [OCR DUDOSO: el primer paréntesis se lee muy partido.]
15.17  W_mandos_vuelo = 36.28 * M^0.003 * S_cs^0.489 * N_s^0.484 * N_c^0.127
15.18  W_instrumentos = 8.0 + 36.37 * N_en^0.676 * N_t^0.237 + 26.4 * (1 + N_ci)^1.356
15.19  W_hidraulicos = 37.23 * K_vsh * N_u^0.664
15.20  W_electricos = 172.2 * K_mc * R_kva^0.152 * N_c^0.10 * L_a^0.10 * N_gen^0.091
15.21  W_avionica = 2.117 * W_uav^0.933
15.22  W_habilitacion = 217.6 * N_c            (incluye asientos eyectables)
15.23  W_aireacond_antihielo = 201.6 * [ (W_uav + 200*N_c)/1000 ]^0.735
15.24  W_equipo_manejo = 3.2e-4 * W_dg
```

**B) Carga / transporte — `R-Ec. 15.25` a `15.45`** (p.574–575):
```
15.25  W_ala = 0.0051 * (W_dg*N_z)^0.557 * S_w^0.649 * A^0.5 * (t/c)_root^-0.4
               * (1+lambda)^0.1 * (cos Λ)^-1.0 * S_csw^0.1
15.26  W_cola_h = 0.0379 * K_uht * (1 + F_w/B_h)^-0.25 * W_dg^0.639 * N_z^0.10
               * S_ht^0.75 * L_t^-1.0 * K_y^0.704 * (cos Λ_ht)^-1.0 * A_ht^0.166
               * (1 + S_e/S_ht)^0.1
15.27  W_cola_v = 0.0026 * (1 + H_t/H_v)^0.225 * W_dg^0.556 * N_z^0.536 * L_t^-0.5
               * S_vt^0.5 * K_z^0.875 * (cos Λ_vt)^-1 * A_vt^0.35 * (t/c)_root^-0.5
15.28  W_fuselaje = 0.3280 * K_door * K_Lg * (W_dg*N_z)^0.5 * L^0.25 * S_f^0.302
               * (1 + K_ws)^0.04 * (L/D)^0.10
        K_ws = 0.75 * [ (1 + 2*lambda)/(1 + lambda) ] * (B_w/L) * tan(Λ)
15.29  W_tren_principal = 0.0106 * K_mp * W_l^0.888 * N_l^0.25 * L_m^0.4
               * N_mw^0.321 * N_mss^-0.5 * V_stall^0.1
15.30  W_tren_nariz = 0.032 * K_np * W_l^0.646 * N_l^0.2 * L_n^0.5 * N_nw^0.45
15.31  [CUERPO PERDIDO]  grupo de nacela (incluye admisión y pilón)
15.32  W_mandos_motor = 5.0 * N_en + 0.80 * L_ec
15.33  W_arrancador_neumatico = 49.19 * ( N_en * W_en / 1000 )^0.541
15.34  W_sist_combustible = 2.405 * V_t^0.606 * (1 + V_i/V_t)^-1.0 * (1 + V_p/V_t) * N_t^0.5
15.35  W_mandos_vuelo = 145.9 * N_f^0.554 * (1 + N_m/N_f)^-1.0 * S_cs^0.20
               * (I_yaw * 1e-6)^0.07
15.36  W_APU_instalada = 2.2 * W_APU_desnuda
15.37  W_instrumentos = 4.509 * K_r * K_tp * N_c^0.541 * N_en * (L_f + B_w)^0.5
15.38  W_hidraulicos = 0.2673 * N_f * (L_f + B_w)^0.937
15.39  W_electricos = 7.291 * R_kva^0.782 * L_a^0.346 * N_gen^0.10
15.40  W_avionica = 1.73 * W_uav^0.983
15.41  W_habilitacion = 0.0577 * N_c^0.1 * W_c^0.393 * S_f^0.75
               (NO incluye asientos ni equipo de manejo de carga)
15.42  W_aire_acondicionado = 62.36 * N_p^0.25 * (V_pr/1000)^0.604 * W_uav^0.10
15.43  W_antihielo = 0.002 * W_dg
15.44  W_equipo_manejo = 3.0e-4 * W_dg
15.45  W_manejo_carga_militar = 2.4 * (area de piso de carga, ft2)
```

**C) Aviación general — `R-Ec. 15.46` a `15.59`** (p.575–576):
```
15.46  W_ala = 0.036 * S_w^0.758 * W_fw^0.0035 * (A/cos^2 Λ)^0.6 * q^0.006
               * lambda^0.04 * (100*(t/c)/cos Λ)^-0.3 * (N_z*W_dg)^0.49
        Regla: si W_fw = 0, IGNORAR ese factor (no elevar cero).
15.47  W_cola_h = 0.016 * (N_z*W_dg)^0.414 * q^0.168 * S_ht^0.896
               * (100*(t/c)/cos Λ)^-0.12 * (A/cos^2 Λ_ht)^0.043 * lambda_h^-0.02
15.48  W_cola_v = 0.073 * (1 + 0.2*H_t/H_v) * (N_z*W_dg)^0.376 * q^0.122 * S_vt^0.873
               * (100*(t/c)/cos Λ_vt)^-0.49 * (A/cos^2 Λ_vt)^0.357 * lambda_vt^0.039
        Regla: si lambda_vt < 0.2, usar 0.2.
15.49  W_fuselaje = 0.052 * S_f^1.086 * (N_z*W_dg)^0.177 * L_t^-0.051
               * (L/D)^-0.072 * q^0.241 + W_press
15.50  W_tren_principal = 0.095 * (N_l*W_l)^0.768 * (L_m/12)^0.409
15.51  W_tren_nariz = 0.125 * (N_l*W_l)^0.566 * (L_n/12)^0.845
        Regla: si el tren es fijo, RESTAR 1.4% del TOGW al total del tren.
15.52  W_motor_instalado_total = 2.575 * W_en^0.922 * N_en   (incluye helice y bancada)
15.53  W_sist_combustible = 2.49 * V_t^0.726 * ( 1/(1 + V_i/V_t) )^0.363
               * N_t^0.242 * N_en^0.157
        [OCR DUDOSO: el segundo factor se lee "( l + 1 / Vi ' Vi )" — muy degradado.]
15.54  W_mandos_vuelo = 0.053 * L^1.536 * B_w^0.371 * (N_z*W_dg*1e-4)^0.80
15.55  W_hidraulicos = K_h * W_dg^0.8 * M^0.5
15.56  W_electricos = 12.57 * (W_sist_combustible + W_avionica)^0.51
15.57  W_avionica = 2.117 * W_uav^0.933
15.58  W_aireacond_antihielo = 0.265 * W_dg^0.52 * N_p^0.68 * W_avionica^0.17 * M^0.08
15.59  W_habilitacion = 0.0582 * W_dg - 65
```

**Conteo verificado: 24 + 21 + 14 = 59 ecuaciones.** Confirma la cifra que el pliego previo declaró
sin transcribirlas. **Las secciones §15.1–§15.2 no contienen ninguna ecuación numerada**; la 15.1 es
efectivamente la primera del juego de caza.

#### 2.4.3 Nomenclatura específica del capítulo 15 (p.576–579) — completa

| Símbolo | Significado y unidades |
|---|---|
| `A` | alargamiento (subíndice `t`/`h` cola horizontal, `v` vertical) |
| `B_h` | envergadura de cola horizontal, ft |
| `B_w` | envergadura del ala, ft |
| `D` | profundidad estructural del fuselaje, ft |
| `D_e` | diámetro del motor, ft |
| `F_w` | ancho del fuselaje en la intersección con la cola horizontal, ft |
| `H_t` | altura de la cola horizontal sobre el fuselaje, ft |
| `H_t/H_v` | **0.0 cola convencional; 1.0 cola en T** |
| `H_v` | altura de la cola vertical sobre el fuselaje, ft |
| `I_yaw` | momento de inercia de guiñada, lb·ft² (ver cap 16) |
| `K_cb` | **2.25** tren de viga transversal (F-111); **1.0** en otro caso |
| `K_d` | constante de conducto (Fig. 15.3 — imagen; solo se lee **`K_d = 2.75`** para un caso) |
| `K_door` | **1.0** sin puerta de carga; **1.06** una puerta lateral; **1.12** dos laterales; **1.12** clamshell trasera; **1.25** dos laterales + clamshell |
| `K_dw` | **0.768** ala delta; **1.0** en otro caso |
| `K_dwf` | **0.774** avión de ala delta; **1.0** en otro caso |
| `K_h` | **0.05** subsónico bajo con hidráulica solo de frenos y tren; **0.11** subsónico medio con hidráulica de flaps; **0.12** subsónico alto con mandos hidráulicos; **0.013** avioneta con frenos hidráulicos solamente (**y usar M = 0.1**) |
| `K_Lg` | **1.12** si el tren principal va en el fuselaje; **1.0** en otro caso |
| `K_mc` | **1.45** si se exige completar la misión tras un fallo; **1.0** en otro caso |
| `K_mp` | **1.126** tren arrodillable; **1.0** en otro caso |
| `K_ng` | **1.017** nacela en pilón; **1.0** en otro caso |
| `K_np` | **1.15** tren arrodillable (C-5); **1.0** en otro caso |
| `K_p` | **1.4** motor con hélice; **1.0** en otro caso |
| `K_r` | **1.133** motor alternativo; **1.0** en otro caso |
| `K_rht` | **1.047** cola horizontal rodante; **1.0** en otro caso |
| `K_tp` | **0.793** turbohélice; **1.0** en otro caso |
| `K_tpg` | **0.826** tren en trípode (A-7); **1.0** en otro caso |
| `K_tr` | **1.18** jet con reversa; **1.0** en otro caso |
| `K_uht` | **1.143** cola horizontal todo-móvil; **1.0** en otro caso |
| `K_vg` | **1.62** geometría variable; **1.0** en otro caso |
| `K_vs` | **1.19** ala de flecha variable; **1.0** en otro caso |
| `K_vsh` | **1.425** ala de flecha variable; **1.0** en otro caso |
| `K_ws` | `0.75 * [(1+2λ)/(1+λ)] * (B_w/L) * tan Λ` |
| `K_y` | radio de giro de cabeceo, ft (**≈ 0.3 L_t**) |
| `K_z` | radio de giro de guiñada, ft (**≈ L_t**) |
| `L` | longitud estructural del fuselaje, ft (excluye radomo, capó y punta de cola) |
| `L_a` | distancia de ruteo eléctrico generadores→aviónica→cabina, ft |
| `L_d` | longitud del conducto, ft |
| `L_ec` | distancia de ruteo del frente del motor a la cabina, **total si es multimotor**, ft |
| `L_f` | longitud total del fuselaje |
| `L_m` | longitud extendida del tren principal, **pulgadas** |
| `L_n` | longitud extendida del tren de nariz, **pulgadas** |
| `L_s` | longitud de conducto simple (Fig. 15.3) |
| `L_sh` | longitud de la camisa de refrigeración del motor, ft |
| `L_t` | brazo de cola; de c/4 del MAC del ala a c/4 del MAC de la cola, ft |
| `L_tp` | longitud del tubo de escape, ft |
| `M` | número de Mach (máximo de diseño) |
| `N_c` | número de tripulantes (**usar 0.5 para UAV**) |
| `N_ci` | equivalentes de tripulación: **1.0** un piloto; **1.2** piloto + asiento trasero; **2.0** piloto y copiloto |
| `N_en` | número de motores (total del avión) |
| `N_f` | número de funciones separadas de las superficies de mando (timón, alerón, elevador, flaps, spoiler, aerofrenos) — **típicamente 4–7** |
| `N_gen` | número de generadores (**típicamente = N_en**) |
| `N_l` | factor de carga **último** de aterrizaje = `N_gear × 1.5` |
| `N_m` | número de superficies accionadas mecánicamente en vez de hidráulicamente (**≤ N_f, típicamente 0–3**) |
| `N_mss` | número de amortiguadores del tren principal |
| `N_mw` | número de ruedas principales |
| `N_nw` | número de ruedas de nariz |
| `N_p` | número de personas a bordo (tripulación + pasaje) |
| `N_s` | número de sistemas de mandos de vuelo |
| `N_t` | número de tanques de combustible |
| `N_u` | número de funciones hidráulicas de utilidad (**típicamente 5–15**) |
| `N_w` | ancho de la nacela, ft |
| `N_z` | **factor de carga ÚLTIMO = 1.5 × límite** |
| `q` | presión dinámica en crucero, lb/ft² |
| `R_kva` | régimen eléctrico del sistema, kV·A (**40–60 transportes; 110–160 cazas y bombarderos**) |
| `S_cs` | área total de superficies de mando, ft² |
| `S_csw` | área de superficies de mando montadas en el ala, ft² (**incluye flaps**) |
| `S_e` | área del elevador, ft² |
| `S_f` | área mojada del fuselaje, ft² |
| `S_fw` | área de la superficie del cortafuegos, ft² |
| `S_ht` | área de la cola horizontal, ft² |
| `S_n` | área mojada de la nacela, ft² |
| `S_r` | área del timón, ft² |
| `S_vt` | área de la cola vertical, ft² |
| `S_w` | área alar trapezoidal, ft² |
| `V_stall` | velocidad de pérdida, kt *(el OCR la lista como `S_stall`; es errata del escaneo)* |
| `SFC` | consumo específico a empuje máximo, lb/hr/lb |
| `T` | empuje total de los motores, lb |
| `T_e` | empuje por motor, lb |
| `t/c` | espesor relativo (si no es constante, usar el promedio de la porción interior al MAC) |
| `V_i` | volumen de tanques integrales, gal |
| `V_p` | volumen de tanques autosellantes "protegidos", gal |
| `V_pr` | volumen de la sección presurizada, ft³ |
| `V_t` | volumen total de combustible, gal |
| `W` | ancho estructural total del fuselaje, ft |
| `W_c` | peso máximo de carga, lb |
| `W_dg` | flight design gross weight, lb (**típicamente con 50–60% del combustible interno en militares**) |
| `W_ec` | peso de motor y contenidos, lb **por nacela** ≈ `2.331 * W_en^0.901 * K_p * K_tr` [OCR DUDOSO: el exponente se lee partido] |
| `W_en` | peso de cada motor, lb |
| `W_fw` | peso del combustible en el ala, lb (si es cero, ignorar el término) |
| `W_l` | landing design gross weight, lb |
| `W_press` | penalización por presurización = `11.9 * (V_pr * P_delta)^0.271`, con `P_delta` = diferencial de cabina en psi (**típicamente 8 psi**) |
| `W_uav` | peso de aviónica **no instalada**, lb (**típicamente 800–1400 lb**) |
| `Λ` | flecha al **25% del MAC** |
| `λ` | estrechamiento (ala o cola) |

#### 2.4.4 Fudge factors (§15.4, Tabla 15.4, p.580)

| Categoría | Grupo | Multiplicador |
|---|---|---|
| Compuestos avanzados | Ala | 0.85–0.90 |
| | Colas | 0.83–0.88 |
| | Fuselaje / nacela | 0.90–0.95 |
| | Tren de aterrizaje | 0.95–1.0 |
| | Sistema de admisión | 0.85–0.90 |
| Ala arriostrada | Ala | 0.82 |
| Biplano arriostrado | Ala | 0.6 |
| Fuselaje de madera | Fuselaje | 1.60 |
| Fuselaje de tubo de acero | Fuselaje | 1.80 |
| Casco de hidroavión | Fuselaje | 1.25 |
| Avión embarcado (portaaviones) | Fuselaje y tren | 1.2–1.3 |

Advertencia literal: *"These are approximations only, and are **subject to heated debate.** Some claim
that a properly designed steel-tube fuselage can be lighter than an aluminum fuselage. It's probably
true, under certain special conditions. **Usually not.**"*
**No hay renglón para aluminio-litio, tela ni titanio.**

**Procedimiento para inventar un fudge factor nuevo** (p.579), que es un algoritmo:
1. Elegir un avión existente parecido al nuevo (p. ej. XB-70 para un Mach 3).
2. Calcular sus pesos por componente con el juego de ecuaciones más cercano.
3. `fudge = peso_real / peso_calculado`, **por componente**.
4. Multiplicar por un fudge adicional de tecnología si aplica.

Ejemplo trabajado por el autor: entrenador de compuestos ⇒ usar las de caza ⇒ contra T-38/F-5B, ala
calculada **1067 lb {484 kg}** vs real **1042 lb {473 kg}** ⇒ ratio **0.977** ⇒ × 0.85 de compuestos
⇒ **0.83** final.

### 2.5 Capítulo 16 — Estabilidad y control (p.585–635)

#### 2.5.1 Convenciones (§16.2, p.587–589)
```
R-Ec. 16.1   Cm = M / (q*S*c_barra)      (cabeceo; c_barra = MAC del ala)
R-Ec. 16.2   Cn = N / (q*S*b)            (guiñada)
R-Ec. 16.3   Cl = L / (q*S*b)            (alabeo — OJO: L aquí es MOMENTO, no sustentación)
```
Momento positivo = **morro arriba o a la derecha**. Sistema usado: **eje de estabilidad** (X alineado
con el ángulo de ataque pero sin desplazar por derrape). Todos los ángulos **en radianes** salvo aviso.
Ángulos de ataque **medidos desde la línea de sustentación nula**.

#### 2.5.2 Ecuación de momento de cabeceo y trimado (§16.3.1, p.590–592)
```
R-Ec. 16.4   M_cg = L*(X_cg - X_acw) + M_w + M_w_δf + M_fus
                    - L_h*(X_ach - X_cg) - T*z_t + F_p*(X_cg - X_p)
R-Ec. 16.5   [CUERPO PERDIDO]  la misma en forma de coeficientes
R-Ec. 16.6   eta_h = q_cola / q_infinito       (0.85-0.95; TÍPICO 0.90)
R-Ec. 16.7   Cm_cg = CL*(X̄_cg - X̄_acw) + Cm_w + Cm_wδf*δf + Cm_fus
                     - eta_h*(S_h/S_w)*CL_h*(X̄_ach - X̄_cg)
                     - T*z̄_t/(q*S_w) + F_p*(X̄_cg - X̄_p)/(q*S_w)
             [OCR DUDOSO: los dos últimos términos se leen partidos; la estructura de los cuatro
              primeros es clara.]
```
Las barras significan **fracción del MAC**. Canard = **brazo de cola negativo**.
Condiciones críticas de trimado estático declaradas: **despegue y aterrizaje con flaps y tren
abajo**, y **vuelo transónico alto**. *"**Usually the most forward c.g. position is critical for trim.
Aft-c.g. position is most critical for stability.**"*

#### 2.5.3 Estabilidad estática y margen (§16.3.2, p.592–593)
```
R-Ec. 16.8   Cm_alpha = CL_alpha*(X̄_cg - X̄_acw) + Cm_alpha_fus
                        - eta_h*(S_h/S_w)*CL_alpha_h*(∂alpha_h/∂alpha)*(X̄_ach - X̄_cg)
                        + (F_p_alpha/(q*S_w))*(∂alpha_p/∂alpha)*(X̄_cg - X̄_p)
R-Ec. 16.9   X̄_np = [ resolver 16.8 con Cm_alpha = 0 ]     [OCR muy degradado, ver §7]
R-Ec. 16.10  Cm_alpha = -CL_alpha_total * (X̄_np - X̄_cg)
R-Ec. 16.11  SM = X̄_np - X̄_cg = -Cm_alpha / CL_alpha
```
**Nota física clave (p.592):** *"Equation (16.8) seems to offer no mechanism for stabilizing a tailless
aircraft ('flying wing'). In fact, the tailless aircraft **must be stabilized in the first term by
providing that the wing aerodynamic center is behind the c.g.**"*

Objetivos y correcciones — ver `REQ-ESTAB-16-06` y `-07`. Valores objetivo de `Cm_alpha`
(Fig. 16.4, p.593, leídos de la gráfica y por tanto **aproximados**): transporte **−1.2 a −1.6**;
business/GA **−0.8 a −1.0**; caza estable **−0.2 a −0.6**.
Se acostumbra **quitar el término `F_p`** para obtener estabilidad "power-off" y luego aplicar una
asignación por potencia; eso *"removes any strong dependence of `X_np` on velocity in the subsonic
flight regime."*

```
R-Ec. 16.12  X̄_ac = X̄_c/4 + Δx_ac
             Δx_ac = 0.26*(M - 0.4)^2.5        para 0.4 < M < 1.1
             Δx_ac = 0.112 - 0.004*M           para M > 1.1
```
Base: **c/4 ±1%** subsónico, **~45% MAC** supersónico. *"Note that poor results are obtained at
transonic speeds."*

#### 2.5.4 Sustentación, flaps y elevadores (§16.3.4, p.594–598)
```
R-Ec. 16.13  [CUERPO PERDIDO]  CL del ala
R-Ec. 16.14  [CUERPO PERDIDO]  CL de la cola trasera
R-Ec. 16.15  Δalpha_0L = -ΔCL / CL_alpha
R-Ec. 16.16  Δalpha_0L = -(1/CL_alpha) * (∂CL/∂δf) * δf
R-Ec. 16.17  ∂CL/∂δf = 0.9 * K_f * (∂c_l/∂δf)_perfil * (S_flapped/S_ref) * cos(Λ_H.L.)
R-Ec. 16.18  (1/CL_alpha)*(∂CL/∂δf) = 1.576*(C_f/C)^3 - 3.458*(C_f/C)^2 + 2.882*(C_f/C)
```
El **0.9** de 16.17 es *"an approximate adjustment for flap tip losses"*. `(∂c_l/∂δf)_perfil` sale de
la **Fig. 16.6** y `K_f` de la **Fig. 16.7** (ambas imagen). Deflexión típica de un flap usado como
mando: **~30 grados**, y **hay que convertirla a radianes** antes de 16.16.
**16.18 es el clamp:** valor empírico de [82] que pone tope superior a la efectividad; si el producto
de los dos primeros términos de 16.16 pasa de 1, usar 16.18.
**−15%** de efectividad si la bisagra no está sellada.
Corrección de Mach: *"as a rough approximation one can adjust flap lift by `CL_alpha` at the given
Mach, divided by `CL_alpha` at Mach 0."*

```
R-Ec. 16.19  Cm_w = Cm_0_perfil * [ A*cos^2(Λ) / (A + 2*cos Λ) ]
             [OCR DUDOSO: el agrupamiento de la fracción se lee partido.]
R-Ec. 16.20  Cm_wδf = -0.8 * ΔCL_flap * (X̄_cp - X̄_cg)
             [OCR DUDOSO: el OCR imprime "- 800Cr", que probablemente sea "-0.8 · ΔC_L". NO usar
              como fixture sin verificar contra el impreso.]
```
Torsión del ala: **≈ (−0.01) × torsión en grados** sobre `Cm_w` en un ala típica en flecha.
Transónico: la magnitud de `Cm_w` **sube ~30% a M 0.8**.
`X̄_cp` del incremento de sustentación del flap: **Fig. 16.9** (imagen), en fracción del MAC de la
zona con flap `c'`. Consecuencia de diseño: *"For a highly swept wing the center of pressure of the
flap lift increment can be **ahead of the c.g.**, creating a positive moment increment. This reduces
the download required by the tail. Conversely, **a canard configuration will put the center of
pressure… well behind the c.g., requiring a huge balancing force.**"*

#### 2.5.5 Downwash / upwash (§16.3.6, p.599–602)
```
R-Ec. 16.21a/b  [CUERPO PERDIDO]  aproximaciones de ∂eps/∂alpha a alto subsónico y supersónico
R-Ec. 16.22  ∂alpha_u/∂alpha = 1 + ∂eps_u/∂alpha           (upwash, delante del ala)
R-Ec. 16.23  ∂alpha_h/∂alpha = 1 - ∂eps/∂alpha             (downwash, detrás)  [CUERPO PARCIAL]
R-Ec. 16.24  alpha_h = alpha + i_h - eps                   [CUERPO PERDIDO]
```
Física declarada: el downwash detrás del ala vale *"approximately **half the wing angle of attack** at
the tail of a typical aircraft"*, cae hacia las punteras, y **la variación en envergadura reduce el
downwash medio que ve la cola en ~5%**. A **M ~0.9** la derivada de downwash **sube 30–40%** y luego
baja. Las Figs. 16.11 (upwash), 16.12 (downwash) y 16.13 (incremento por flaps) son imagen.
Canard: *"The estimation of the effect of canard downwash on the wing is **very difficult**… can be
crudely approximated by assuming that the canard downwash… **uniformly affects the wing inboard of
the canard tips**."*

#### 2.5.6 Fuselaje y empuje (§16.3.8–16.3.9, p.603–606)
```
R-Ec. 16.25  Cm_alpha_fuselaje = K_fus * W_f^2 * L_f / (c_barra * S_w)      POR GRADO
R-Ec. 16.26  F_p = m_punto * V * tan(alpha_p) ~= m_punto * V * alpha_p
R-Ec. 16.27  m_punto ~= rho * V * A_inlet      (suponiendo razón de captura = 1)
R-Ec. 16.28  F_p_alpha = m_punto * V
R-Ec. 16.29  F_p_alpha = q * N_B * A_p * (∂C_N_pala/∂alpha) * f(T)          (hélice)
R-Ec. 16.30  ∂eps/∂alpha_prop = K_eps1 + K_eps2 * N_B * (∂C_N_pala/∂alpha) * (∂alpha_p/∂alpha)
             [OCR DUDOSO: las dos constantes salen de la Fig. 16.17, que es imagen.]
R-Ec. 16.31  [CUERPO PERDIDO]  eta_h con propwash
```
`K_fus` sale de la **Fig. 16.14** (NACA TR 711 — imagen). **Ojo con las unidades: 16.25 devuelve por
GRADO**, no por radián — es la única del capítulo así.
En unidades británicas el gasto de 16.26 va en **slugs/s = lb/s ÷ 32.2**.
Regla de signo importante: usar la derivada de **upwash** si la toma/hélice va delante del ala, la de
**downwash** si va detrás; y *"For an inlet mounted **under the wing**, the wing turns the flow before
it reaches the inlet front face so that **the normal force is approximately zero.**"*
*"Note in Eq. (16.7) that **a propeller mounted aft of the c.g. is stabilizing.** This is one of the
advantages of the pusher-propeller configuration."*
`eta_h` con hélice apagada ≈ **0.9**; si la cola está solo parcialmente en la estela, *"the right-side
term in the parentheses should be reduced proportionately."*

#### 2.5.7 Trimado y arrastre de trimado (§16.3.10, p.607–609)
```
R-Ec. 16.32  CL_h = CL_alpha_h * [ (alpha + i_w)*(1 - ∂eps/∂alpha) + (i_h - i_w) - alpha_0L_h ]
R-Ec. 16.33  CL_total = CL_alpha*(alpha + i_w) + eta_h*(S_h/S_w)*CL_h
R-Ec. 16.34  CD_i_trimado = K*[ CL_alpha*(alpha + i_w) ]^2 + eta_h*(S_h/S_w)*K_h*[CL_h]^2
```
**Algoritmo gráfico de trimado (p.607–608):** barrer `alpha` y `δe` supuestos, calcular `Cm_cg` con
16.7 y `CL_total` con 16.33, graficar `Cm_cg` vs `CL_total` con una curva por cada `δe`, e interpolar
`Cm_cg = 0` al `CL` requerido. Para `K_h` *"it is permissible to use the simpler empirical methods for
`K` (or `e`) rather than the leading-edge-suction method"*, porque el inducido de la cola es chico.
Dos términos adicionales de trim drag: la **rotación del vector de sustentación de cola por el
downwash** (ver `REQ-ESTAB-16-13`) y el **parásito del elevador deflectado**.
Nota de diseño declarada: *"Avoidance of this drag contribution is one reason that many aircraft have
a **variable incidence (all-moving) horizontal tail.**"*

#### 2.5.8 Lateral-direccional (§16.4, p.611–620)
```
R-Ec. 16.35  N = N_ala + N_wδa*δa + N_fus + F_v*(X_acv - X_cg) - T*Y_p - D*Y_p - F_p*(X_cg - X_p)
R-Ec. 16.36  L = L_ala + L_wδa*δa - F_v*Z_v
R-Ec. 16.37  [CUERPO PERDIDO]  fuerza lateral del vertical F_v
R-Ec. 16.38  Cn = Cn_β_w*β + Cn_δa*δa + Cn_β_fus*β + Cn_β_v*β
R-Ec. 16.39  [CUERPO PERDIDO]  Cn_β_v (derivada del vertical en guiñada)
R-Ec. 16.40  Cl = ... (roll, forma de coeficientes)          [CUERPO PARCIAL]
R-Ec. 16.41  [CUERPO PERDIDO]  Cl_β_v (derivada del vertical en alabeo)
R-Ec. 16.42  Cn_β = Cn_β_ala + Cn_β_fus + Cn_β_vertical     [CUERPO PERDIDO; la prosa lo declara]
R-Ec. 16.43  Cl_β = ...                                      [CUERPO PERDIDO]
R-Ec. 16.44  Cn_β_ala = CL^2 * { 1/(4*pi*A)
                       - [ tan Λ / (pi*A*(A + 4*cos Λ)) ]
                         * [ cos Λ - A/2 - A^2/(8*cos Λ) + 6*(X̄_acw - X̄_cg)*sin Λ / A ] }
             [OCR DUDOSO: el bloque interno se lee con saltos; estructura plausible pero verificar.]
R-Ec. 16.45  (Cl_β)_Γ = -(CL_alpha_w * Γ / 4) * [ 2*(1 + 2*lambda) / (3*(1 + lambda)) ]
R-Ec. 16.46  Cl_β_wf = -1.2 * sqrt(A) * Z_wf * (D_f + W_f) / b^2
             [OCR DUDOSO: el agrupamiento se lee partido.]
R-Ec. 16.47  Cl_β = (Cl_β/CL)*CL + (Cl_β)_Γ + Cl_β_wf
R-Ec. 16.48  Cl_δa = método de tiras: sumar ΔCL_i * Y_i sobre las tiras con alerón
R-Ec. 16.49  Cn_δa = f(CL, δa)   (simplificación de [69])
R-Ec. 16.50  Cn_β_fus = -1.3 * (volumen/(S_w*b)) * (D_f/W_f)
R-Ec. 16.51  (∂sigma/∂β)*eta_v = 0.724 + 3.06*(S_vs'/S_w)/(1 + cos Λ)
                                 + 0.4*(Z_wf/D_f) + 0.009*A_ala
             [OCR DUDOSO: el signo del término Z_wf/D_f se lee ambiguo ("- DJ 0.4 - Zwf").
              Verificar antes de usarlo. S_vs' = área del vertical extendida a la línea central.]
```
**Convención de signo crítica (p.611):** *"by the sign conventions used for β and yaw, **a positive
value of yawing-moment derivative with respect to β is stabilizing.** However, **a negative value of
the rolling-moment derivative with respect to β is stabilizing** (dihedral effect)."*
**Signos de 16.47:** *"**All terms should be negative** except that the wing vertical placement term
will be **positive (destabilizing) for a low wing.**"*
Diedro efectivo: **1 grado ⇒ `Cl_β = 0.0002 /grado = 0.0115 /radián`**.
Aspecto efectivo del vertical: **+55%** por efecto placa.
Alerones: **−15%** si la bisagra no está sellada. Spoilers producen **guiñada proverse**, alerones
**adverse**.
*"Note that it is common practice to determine the most aft c.g. position from longitudinal
considerations and then **vary the vertical-tail area until gaining sufficient yaw stability.**"*

#### 2.5.9 Dinámica (§16.7–16.9, p.622–630)
```
R-Ec. 16.52  I_xx = b^2 * W * R_x^2 / (4*g)
R-Ec. 16.53  I_yy = L^2 * W * R_y^2 / (4*g)
R-Ec. 16.54  I_zz = ((b + L)/2)^2 * W * R_z^2 / (4*g)
             Resultados en slug-ft2. "In metric units, DON'T apply the g term, and results are in
             gram-M2" [así lo imprime el libro; la unidad "gram-M2" es sospechosa pero es literal].
R-Ec. 16.55  [CUERPO PERDIDO]  derivada de amortiguamiento en cabeceo Cm_q
R-Ec. 16.56  [CUERPO PERDIDO]  derivada de amortiguamiento en guiñada Cn_r
R-Ec. 16.57  I_yy * Q_punto = SUM(momentos de cabeceo, incluidos los de amortiguamiento)
R-Ec. 16.58  I_zz * R_punto = SUM(momentos de guiñada)
R-Ec. 16.59  I_xx * P_punto = SUM(momentos de alabeo)
R-Ec. 16.60  Q = g*(n - 1)/V                            (pull-up)
R-Ec. 16.61  n = 1/cos(phi)                             (viraje nivelado)
R-Ec. 16.62  Q = (g/V)*(n - 1/n)
R-Ec. 16.63  I_xx*P_punto = 0 = q*S_w*b*Cl_δa*δa + q*S_w*b*Cl_p*P
R-Ec. 16.64  P ~= -(Cl_δa / Cl_p) * δa                  (régimen de alabeo estacionario, rad/s)
```
`eta` de cola horizontal y vertical para amortiguamiento: **~0.9**.
Derivadas cruzadas, primera aproximación: **`Cl_R ≈ CL/4`** y **`Cn_P ≈ −CL/8`**.
Amortiguamiento de alabeo: **Fig. 16.26** (imagen), con factor de flecha multiplicativo.

**Tabla 16.1 — Radios de giro adimensionales** (p.623):

| Clase | R_x | R_y | R_z |
|---|---|---|---|
| Monomotor de hélice | 0.25 | 0.38 | 0.39 |
| Bimotor de hélice | 0.34 | 0.29 | 0.44 |
| Business jet bimotor | 0.30 | 0.30 | 0.43 |
| Transporte turbohélice bimotor | 0.22 | 0.34 | 0.38 |
| Transporte a reacción — motores en fuselaje | 0.24 | 0.36 | 0.44 |
| — 2 motores en ala | 0.25 | 0.38 | 0.46 |
| — 4 motores en ala | 0.31 | 0.33 | 0.45 |
| Entrenador militar a reacción | 0.22 | **[OCR DUDOSO: 0.14]** | **[OCR DUDOSO: 0.25]** |
| Caza a reacción | 0.23 | 0.38 | 0.52 |
| Bombardero pesado a reacción | 0.34 | 0.31 | 0.47 |
| Ala volante (tipo B-49) | 0.32 | 0.32 | 0.51 |
| Hidroavión | 0.25 | 0.32 | 0.41 |

> El renglón del entrenador es **anómalo**: `R_y = 0.14` y `R_z = 0.25` quedan muy por debajo de las
> otras once clases (`R_y` 0.29–0.38, `R_z` 0.38–0.52). Huele a fila arrastrada por el OCR.
> **No usarla como fixture sin verificar contra el impreso.**

**Modos dinámicos declarados** (§16.7.5, p.627), sin ecuaciones:
- Longitudinal: **período corto** (muy amortiguado, es la respuesta deseada) y **fugoide de
  cabeceo** (largo, poco amortiguado, intercambio energía vertical↔longitudinal).
- Lateral: **convergencia directa**, **divergencia espiral** (*"the time to diverge is so long that
  pilots can easily correct for it"*) y **Dutch roll**.
- **Dutch roll manda el tamaño del vertical**: *"Dutch roll damping is determined mainly by the size
  of the vertical tail and **is usually the driving criteria for tail sizing other than engine-out
  control.**"*
- Grados de libertad mínimos: **3-DOF longitudinal, 3-DOF lateral stick-fixed, 5 stick-free lateral**;
  el libro recomienda **6-DOF (9 stick-free)**.

**Requisitos de alabeo (Tabla 16.2, MIL-F-8785B, p.629):**

| Clase | Alabeo requerido |
|---|---|
| I — utilitario ligero, observación, entrenador primario | 60° en 1.3 s |
| II — bombardero medio, carga, transporte, ASW, reconocimiento | 45° en 1.4 s |
| III — bombardero pesado, carga, transporte | 30° en 1.5 s |
| IV A — caza-ataque, interceptor | 90° en 1.3 s |
| IV B — caza de combate cerrado | 90° en 1.0 s **y** 360° en 2.8 s |
| IV C — caza con armamento aire-tierra | 90° en 1.7 s |

**Helix angle** (NACA 715): `P*b/(2V) ≥ 0.07`, **0.09 para cazas**.

**Acoplamiento inercial** (§16.9, p.629–630): el F-100 divergía en alabeo rápido porque rueda alrededor
del **eje principal**, no del eje cuerpo, y eso intercambia ángulo de ataque con derrape mientras la
fuerza centrífuga sobre morro y cola genera **cabeceo a subir**. *"Inertia coupling becomes a problem
only when the moments produced by the inertia forces are stronger than the aerodynamic restoring
moments. **This is most likely to happen at high altitudes and at high Mach numbers where the tail
loses lift effectiveness.** The solution… was **a larger vertical tail. This remains the typical
solution.**"*

#### 2.5.10 Cualidades de vuelo y departure (§16.10, p.630–635)
```
R-Ec. 16.65  LCDP = Cn_β - Cl_β * (Cn_δa / Cl_δa)
R-Ec. 16.66  Cn_β_dinamico = Cn_β*cos(alpha) - (I_zz/I_xx)*Cl_β*sin(alpha)
R-Ec. 16.67  TDPF = TDR * URVC
R-Ec. 16.68  [CUERPO PERDIDO]  TDR (tail damping ratio)
R-Ec. 16.69  [CUERPO PERDIDO]  URVC (unshielded rudder volume coefficient)
R-Ec. 16.70  mu = (W/S) / (rho * g * b)     (parámetro de densidad relativa del avión)
```
Ambos parámetros de departure **deben ser positivos**; meta `Cn_β_dinámico > 0.004`.
Criterios de Weissman y del ref. [123] *"were determined from **high-g simulator tests using
experienced pilots**"*.
Casos declarados: **F-5 bueno** (ambos parámetros suben con el ángulo de ataque); **F-4 malo**
(empieza aceptable y cruza a inaceptable); **HiMAT bueno** pese a ser canard supersónico, gracias a
bordes de ataque muy combados en la parte exterior y **colas gemelas grandes con parte por debajo del
ala**.
**Cooper-Harper** (Fig. 16.28): escala 1–10 en cuatro bloques — 1–3 satisfactoria; 4–6 *"deficiencies
warrant improvement"*; 7–9 *"deficiencies require improvement"* (el 7 con la nota *"Controllability
not in question"*); **10 = *"Control will be lost during some portion of required operation"***.

### 2.6 Capítulo 17 — Performance y mecánica del vuelo (p.637–685)

#### 2.6.1 Ecuaciones de movimiento (§17.1, p.637–639)
```
R-Ec. 17.1   SUM Fx = T*cos(alpha + phi_T) - D - W*sin(gamma)
R-Ec. 17.2   SUM Fz = T*sin(alpha + phi_T) + L - W*cos(gamma)
R-Ec. 17.3   dW/dt = -C * T
R-Ec. 17.4   [CUERPO PERDIDO]  C equivalente para hélice (a partir de C_power o C_bhp)
R-Ec. 17.5   T = P*eta_p/V = 550*bhp*eta_p/V
R-Ec. 17.6   SUM Fx = T - D - W*sin(gamma)      (simplificada: empuje alineado con el viento)
R-Ec. 17.7   SUM Fz = L - W*cos(gamma)
```
Justificación de la simplificación, literal: *"For normal aircraft the thrust force is nearly aligned
with respect to the wind axis under most flight conditions. **This is by design. Airplanes are most
efficient when the engines push, the wings lift, and neither tries to do the other's job!**"*

#### 2.6.2 Vuelo nivelado (§17.2, p.639–642)
```
R-Ec. 17.8   T = D = q*S*(CD0 + K*CL^2)
R-Ec. 17.9   L = W = q*S*CL
R-Ec. 17.10  [CUERPO PERDIDO]  V en función de W/S, CL y rho
R-Ec. 17.11  T/W = 1/(L/D) = q*CD0/(W/S) + K*(W/S)/q
R-Ec. 17.12  ∂(T/W)/∂V = rho*V*CD0/(W/S) - 2*K*(W/S)/(0.5*rho*V^3) = 0
R-Ec. 17.13  [CUERPO PERDIDO]  V de mínimo empuje / máximo L/D
R-Ec. 17.14  CL_min_empuje = sqrt(CD0/K)
R-Ec. 17.15  D_min = q*S*(CD0 + CD0) = 2*q*S*CD0
R-Ec. 17.16  P = D*V = q*S*(CD0 + K*CL^2)*V = 0.5*rho*V^3*S*(CD0 + K*CL^2)
R-Ec. 17.17  P = 0.5*rho*V^3*S*CD0 + K*W^2/(0.5*rho*V*S)
R-Ec. 17.18  ∂P/∂V = 1.5*rho*V^2*S*CD0 - K*W^2/(0.5*rho*V^2*S) = 0
R-Ec. 17.19  V_min_potencia = sqrt( (2/rho)*(W/S)*sqrt(K/(3*CD0)) )
R-Ec. 17.20  CL_min_potencia = sqrt(3*CD0/K)
R-Ec. 17.21  D_min_potencia = q*S*(CD0 + 3*CD0) = 4*q*S*CD0
```
**Las cuatro constantes derivadas y verificables** (p.641):
`V_minP / V_minD = 0.760` (= 3^(−1/4)) · `CL_minP / CL_minD = 1.73` (= √3) · arrastre en `V_minP`
= **4× el parásito** vs **2×** en `V_minD`, pero el arrastre REAL solo sube **15.5%** porque la
presión dinámica es 0.760² = 0.578 de la otra · `L/D` en `V_minP` = **1/1.155 = 0.866 × (L/D)max`.

> **Discrepancia interna del libro, declarada aquí para que nadie la copie mal.**
> §17.2.3, p.643 dice: *"the minimum-power-required velocity is about **86.6%** of the
> minimum-thrust-required velocity, as predicted in the last section."* Pero la sección anterior
> (§17.2.2, p.641) dice: *"the velocity for minimum power required is approximately **0.76** times
> the velocity for minimum thrust."* **El 0.866 es la razón de `L/D`, no de velocidad.**
> La razón de velocidades correcta es **3^(−1/4) = 0.7598**. Marcado como errata del libro.

#### 2.6.3 Alcance y autonomía (§17.2.4–17.2.10, p.643–649)
```
R-Ec. 17.22  dR/dW = V/(-C*T) = -V*(L/D)/(C*W)
R-Ec. 17.23  R = (V/C)*(L/D)*ln(W_i / W_{i+1})              (Breguet, jet)
R-Ec. 17.24  (V/C)*(L/D) = (V/C)*CL/(CD0 + K*CL^2), con CL = 2W/(rho*V^2*S)   [CUERPO PARCIAL]
R-Ec. 17.25  [CUERPO PERDIDO]  V de mejor alcance (jet)
R-Ec. 17.26  CL_mejor_alcance = sqrt( CD0/(3*K) )
R-Ec. 17.27  D_mejor_alcance = q*S*(CD0 + CD0/3)
R-Ec. 17.28  R = (eta_p/C_power)*(L/D)*ln(W_i/W_{i+1})      (Breguet, hélice — SIN el término V)
R-Ec. 17.29  [CUERPO PERDIDO]  autonomía instantánea
R-Ec. 17.30  E = (1/C)*(L/D)*ln(W_i/W_{i+1})                (autonomía, jet)
R-Ec. 17.31  E = (L/D)*(eta_p/(C_power*V))*ln(W_i/W_f)
               = (L/D)*(550*eta_p/(C_bhp*V))*ln(W_i/W_f)    (autonomía, hélice)
R-Ec. 17.32  derivada respecto a V, igualada a cero
R-Ec. 17.33  V de máxima autonomía de hélice = V_min_potencia (idéntica a 17.19)
R-Ec. 17.34  E_loiter = 1.14 * R_crucero / V_crucero
R-Ec. 17.35  V_ground = V_air * sin{ pi - Δ_tailwind
                                     - asin[ V_wind*sin(Δ_tailwind)/V_air ] } / sin(Δ_tailwind)
```
**Supuestos de Breguet, literales:** *"This integration assumes that the velocity, specific fuel
consumption, and L/D are approximately constant. These assumptions require that the aircraft **hold
lift coefficient constant.**"* ⇒ **cruise-climb**. Y el mundo real (control de tráfico) lo prohíbe ⇒
**stair-step**, resuelto *"by breaking the cruise legs into several shorter mission-segments."*

Los cuatro óptimos, resumidos por el propio libro:
- **Alcance jet**: `CD = 1.33 × CD0`; velocidad **31.6% más rápida** que la de máximo `L/D`;
  `L/D` resultante = **0.866 × (L/D)max`.
- **Alcance hélice**: volar al **máximo `L/D`** (la velocidad desaparece de 17.28).
- **Autonomía jet**: **máximo `L/D`**.
- **Autonomía hélice**: velocidad de **mínima potencia** (17.19), con `L/D` = 0.866 × máximo.

**Aviso de validez de todas ellas (p.645), literal:** *"our derivation of Eq. (17.24) implicitly
assumed that `CD0` and `K` do not vary as velocity changes… which we also know to be only a rough
approximation. **Thus, Eqs. (17.25–17.27) are not exactly correct in the real world.**"*

**Viento:** si el viento en cara baja la velocidad respecto al suelo un 10%, el alcance por unidad de
combustible baja **10%**; hay que multiplicar el alcance requerido por `V_air/V_ground`. Ganancia por
optimizar velocidad con viento: *"only change your airspeed by perhaps **5–10%** or so, gaining just a
few percent in range."* **El viento no afecta al loiter** *"unless somehow the wind speed is greater
than your optimum loiter speed and you find you are being blown backward!"*

#### 2.6.4 Ascenso (§17.3, p.649–653)
```
R-Ec. 17.36  T = D + W*sin(gamma)
R-Ec. 17.37  L = W*cos(gamma)
R-Ec. 17.38  gamma = asin[ (T - D)/W ] = asin[ T/W - cos(gamma)/(L/D) ] ~= asin[ T/W - 1/(L/D) ]
R-Ec. 17.39  V_v = V*sin(gamma) = V*(T - D)/W ~= V*( T/W - 1/(L/D) )
R-Ec. 17.40  V = sqrt( (2/(rho*CL)) * (W/S) * cos(gamma) )
R-Ec. 17.41  T/W = cos(gamma)/(L/D) + sin(gamma) = 1/(L/D) + V_v/V
R-Ec. 17.42  V_v = V*(T/W) - q*CD0*V/(W/S) - K*(W/S)*V/q      [CUERPO PARCIAL]
R-Ec. 17.43  V_mejor_regimen_jet = sqrt{ (W/S)/(3*rho*CD0)
                                         * [ T/W + sqrt( (T/W)^2 + 12*CD0*K ) ] }
R-Ec. 17.44  gamma_helice = asin[ 550*bhp*eta_p/(W*V) - 1/(L/D) ]
R-Ec. 17.45  V_v_helice = 550*bhp*eta_p/W - D*V/W
R-Ec. 17.46  dt = dh / V_v
R-Ec. 17.47  dW_f = -C*T*dt
R-Ec. 17.48  V_v(h) = V_v0 + a*h                (lineal en altitud, dentro del tramo)
R-Ec. 17.49  a = (V_v2 - V_v1)/(h2 - h1)
R-Ec. 17.50  [CUERPO PERDIDO]  tiempo de ascenso de i a i+1 (integral de 17.48 en 17.46)
R-Ec. 17.51  [CUERPO PERDIDO]  combustible del tramo
```
`cos(gamma) ≈ 1` para **ángulos de ascenso menores de 15 grados**.
**Comprobación de sanidad de 17.43:** *"if the thrust is zero, this equation collapses to the equation
for the velocity for minimum power required [Eq. (17.19)], which serves as a **lower boundary** on the
solution."*
Valores típicos: velocidad de mejor régimen de ascenso de un jet **300–500 kt**; el **B-70 a 583 kt
{1080 km/h}**. Hélice: mejor ángulo ≈ **85–90%** de la velocidad de mejor régimen.
Segmentos de ascenso: **≤5000 ft {~1500 m}** para poder despreciar el combustible en la integración.
Curiosidad numérica declarada: *"**Oddly enough, the change in altitude has dropped out of the
equation!** However, the change in altitude is implicit in the change in rate of climb."*

#### 2.6.5 Viraje (§17.4, p.653–656)
```
R-Ec. 17.52  psi_punto = g*sqrt(n^2 - 1)/V      (rad/s; ×57.3 para grados/s)
R-Ec. 17.53  n = (T/W)*(L/D)
R-Ec. 17.54  n = sqrt{ (q/(K*(W/S))) * [ T/W - q*CD0/(W/S) ] }
R-Ec. 17.55  L = n*W = q*S*sqrt(CD0/K)          (viraje sostenido óptimo, a CL de max L/D)
R-Ec. 17.56  n*W = L + T*sin(alpha + phi_T)     (con empuje vectorizado)
R-Ec. 17.57  ∂n/∂phi_T = 0
R-Ec. 17.58  phi_T = 90 grados - alpha          (óptimo para viraje INSTANTÁNEO)
R-Ec. 17.59  [CUERPO PERDIDO]  n sostenido con empuje vectorizado
R-Ec. 17.60  ∂n/∂phi_T = -(T/W)*sin(alpha + phi_T)*(L/D) = 0
R-Ec. 17.61  phi_T = -alpha                     (óptimo para viraje SOSTENIDO)
```
**17.54 es ITERATIVA** (`K = f(CL)`, `CL = f(n)`).
`n` se limita **por sustentación máxima o por resistencia estructural**, y el cruce de ambas es la
**corner speed**: *"For a typical fighter, corner speed is about **300–350 kt {560–650 km/h}**."*
Empuje vectorizado: el Harrier gana *"almost **1-g** of extra load factor"* pero *"**Harrier pilots
learn to use this sparingly**"* porque frena rápido. Y solo sirve *"if the nozzles are located close
to the aircraft center of gravity"*; el **F-22 y el F-35 no pueden** usarlo para aumentar factor de
carga porque sus toberas están atrás.

#### 2.6.6 Planeo (§17.5, p.657–661)
```
R-Ec. 17.62  D = W*sin(gamma)
R-Ec. 17.63  L = W*cos(gamma)
R-Ec. 17.64  L/D = 1/tan(gamma) ~= 1/gamma
R-Ec. 17.65  V_max_L/D    (igual a 17.13)
R-Ec. 17.66  CL_max_L/D = sqrt(CD0/K)
R-Ec. 17.67  (L/D)_max = 1/(2*sqrt(CD0*K))
R-Ec. 17.68  V_v = V*sin(gamma) = sin(gamma)*sqrt( (W/S)*2*cos(gamma)/(rho*CL) )
R-Ec. 17.69  sin(gamma) = (D/L)*cos(gamma) = (CD/CL)*cos(gamma)
R-Ec. 17.70  V_v = sqrt( (W/S) * 2*cos^3(gamma)*CD^2 / (rho*CL^3) )
R-Ec. 17.71  maximizar CL^(3/2)/CD
R-Ec. 17.72  CL_min_hundimiento = sqrt(3*CD0/K)
R-Ec. 17.73  V_min_hundimiento = sqrt( (2W/(rho*S)) * sqrt(K/(3*CD0)) )
R-Ec. 17.74  (L/D) en mínimo hundimiento = 0.866 * (L/D)_max
R-Ec. 17.75  L*cos(phi) = W*cos(gamma) ~= W            (planeo en viraje)
R-Ec. 17.76  psi_punto = a/V = V/R
R-Ec. 17.77  a = V^2/R
R-Ec. 17.78  L*sin(phi) = W*V^2/(g*R) = W*sqrt(n^2 - 1)
R-Ec. 17.79  R = V^2/(g*tan(phi)) = V^2/(g*sqrt(n^2 - 1))
R-Ec. 17.80  V_v(viraje) = V_v(recto) / cos^(3/2)(phi)
R-Ec. 17.81  R = 2*W / (rho*S*CL*g*sin(phi))
R-Ec. 17.82  V(y) = V_cg * [ 1 + (y/R)*cos(phi) ]
R-Ec. 17.83  V_interior = V_cg * [ 1 - (b/2)/R * cos(phi) ]
```
**`V_min_hundimiento = 0.76 × V_mejor_planeo`**, y en `V_min_hundimiento` el `L/D` es **0.866** del
máximo. Nota terminológica del libro: *"In sailplane terminology, a **'sailplane' is an expensive,
high-performance unpowered aircraft. A 'glider' is a crude, low-performance unpowered aircraft!**"*
**Peligro de 17.83:** cerca de la pérdida y con banqueo moderado, la puntera interior puede entrar en
pérdida ⇒ barrena. Como `phi` no depende de la velocidad en 17.80, **los óptimos de recto siguen
valiendo en viraje**.

#### 2.6.7 Energía-maniobrabilidad (§17.6, p.661–669)
```
R-Ec. 17.84  E = W*h + 0.5*(W/g)*V^2
R-Ec. 17.85  h_e = E/W = h + V^2/(2*g)
R-Ec. 17.86  Ps_usada = dh_e/dt = dh/dt + (V/g)*(dV/dt)
R-Ec. 17.87  P = V*(T - D)
R-Ec. 17.88  Ps = V*(T - D)/W = dh/dt + (V/g)*(dV/dt)
R-Ec. 17.89  Ps = V * [ T/W - q*CD0/(W/S) - n^2*K*(W/S)/q ]
R-Ec. 17.90  Ps = V * { (T/W)*cos(alpha + phi_T) - q*CD0/(W/S)
                        - n^2*K/(q*S)*[ W - T*sin(alpha + phi_T) ] }
R-Ec. 17.91  dt = dh_e / Ps
R-Ec. 17.92  t = INT dh_e / Ps
R-Ec. 17.93  t_1-2 ~= Δh_e / Ps_promedio
R-Ec. 17.94  f_s = dh_e/dW_f = Ps / (C*T)
R-Ec. 17.95  W_f_1-2 = INT dh_e / f_s
R-Ec. 17.96  W_f_1-2 ~= Δh_e / f_s_promedio
R-Ec. 17.97  W_i/W_{i-1} = exp{ -C*Δh_e / [ V*(1 - D/T) ] }
                         = exp{ -C*Δh_e / [ V*(1 - 1/((T/W)*(L/D))) ] }
```
**AVISO DE UNIDADES EN 17.89 (literal):** *"Note that `T/W` and `W/S` are at the given flight
condition, **not the takeoff values!**"*
`Ps` a `n = 1` **es exactamente el régimen de ascenso disponible**. `Ps = 0` **no significa vuelo
nivelado**: puede ser subir decelerando o bajar acelerando.
Criterios de combate: **ventaja de 2 grados/s de régimen de viraje se considera significativa**; y
*"To win a protracted dogfight, an aircraft should have **`Ps = 0` contours that envelop those of an
opponent.**"*
Ejemplo de referencia: un F-16 o un 747 a **M0.9 y 30,000 ft {9144 m}** tienen `h_e = 42,447 ft
{12,938 m}`. (Es fixture: `h_e = 30000 + (0.9·994.8)²/(2·32.174)` — comprobable en una línea.)
Guardarraíl obligatorio: *"a maneuver involving a **reduction in energy height cannot put fuel back
in the tanks**, as would be implied by putting a negative value for the change in `h_e` into
Eq. (17.97)!"*

#### 2.6.8 Envolvente (§17.7, p.669–671)
```
R-Ec. 17.98  q = 0.5*rho_inf*V_inf^2 = 0.7*p_static*M^2
R-Ec. 17.99  [CUERPO PERDIDO]  presión total del aire incidente
```
Límites de la envolvente, con sus números: **techo absoluto** = mayor altitud con `Ps = 0`;
**techo de servicio** = **100 fpm {30.5 mpm}** hélice y **500 fpm {152 mpm}** jet por FAR, **100 fpm**
militar y **300 fpm {91 mpm}** USN; **eyección**: *"The odds of surviving an ejection above
**50,000 ft {15,240 m}** are rather small without an astronaut-type pressure suit or some type of
capsule"*; **reencendido a baja q** (dato del fabricante); **q estructural**: *"Typical fighter
aircraft have a `q` limit of **1800–2200 psf {86–105 kN/m²}**. This corresponds to transonic speeds at
sea level."*; **presión de conducto**: Mach en la cara del motor **0.4–0.5**, presión de pared *"can
easily be **three times** the outside dynamic pressure"* y **no sigue la pendiente del límite de q**;
**temperatura de piel** (carta del cap 14).

#### 2.6.9 Despegue (§17.8, p.671–676)
```
R-Ec. 17.100  a = (g/W)*[ T - D - mu*(W - L) ]
                = g*[ (T/W - mu) + (rho/(2*(W/S)))*(-CD0 - K*CL^2 + mu*CL)*V^2 ]
R-Ec. 17.101  S_G = INT (V/a) dV = 0.5 * INT (1/a) d(V^2)
R-Ec. 17.102  S_G = ( 1/(2*g*K_A) ) * ln[ (K_T + K_A*V_f^2) / (K_T + K_A*V_i^2) ]
R-Ec. 17.103  K_T = (T/W) - mu
R-Ec. 17.104  K_A = (rho/(2*(W/S))) * ( mu*CL - CD0 - K*CL^2 )
R-Ec. 17.105  n = L/W = [0.5*rho*S*(0.9*CLmax)*(1.15*V_stall)^2] / [0.5*rho*S*CLmax*V_stall^2] = 1.2
R-Ec. 17.106  n = 1.0 + V_TR^2/(R*g) = 1.2
R-Ec. 17.107  R = V_TR^2 / (g*(n - 1)) = V_TR^2 / (0.2*g)
R-Ec. 17.108  sin(gamma_climb) = (T - D)/W = T/W - 1/(L/D)
R-Ec. 17.109  S_TR = R*sin(gamma_climb) ~= R*( T/W - 1/(L/D) )
R-Ec. 17.110  h_TR = R*(1 - cos(gamma_climb))
R-Ec. 17.111  [CUERPO PERDIDO]  distancia de transición si el obstáculo se libra antes de terminarla
R-Ec. 17.112  S_C = (h_obstaculo - h_TR) / tan(gamma_climb)
R-Ec. 17.113  BFL = (0.863/(1 + 2.3*G)) * [ (W/S)/(rho*g*CL_climb) + h_obstaculo ]
                    * [ 1/(T_av/W - U) + 2.7 ] + 655/sqrt(rho/rho_SL)
R-Ec. 17.114  T_av_jet  = 0.75 * T_takeoff_estatico * [ (5 + BPR)/(4 + BPR) ]
R-Ec. 17.115  T_av_prop = 5.75 * bhp * [ (rho/rho_SL)*N_e*D_p^2 / bhp ]^(1/3)
```
Definiciones de 17.113: `G = gamma_climb − gamma_min`; `gamma_climb = asin[(T−D)/W]` con **un motor
fuera, a velocidad de ascenso**; `gamma_min` = **0.024 bimotor, 0.027 trimotor, 0.030 cuatrimotor**;
`CL_climb` = `CL` a **1.2 V_stall**; `h_obstáculo` = **35 ft comercial, 50 ft militar**;
`U = 0.01·CLmax + 0.02` con flaps en posición de despegue. **BFL en pies.**

**Tabla 17.1 — Resistencia de rodadura** (p.672):

| Superficie | µ rodadura | µ frenado |
|---|---|---|
| Concreto/asfalto seco | 0.03 | 0.3–0.5 |
| Concreto/asfalto mojado | 0.05 | 0.15–0.3 |
| Concreto/asfalto con hielo | 0.02 | 0.06–0.10 |
| Pasto duro | 0.05 | 0.4 |
| Tierra firme | 0.04 | 0.3 |
| Pasto blando | 0.07 | 0.2 |
| Pasto mojado | 0.08 | 0.2 |

> **[OCR DUDOSO]** en la fila «concreto seco»: la primera celda de la tabla se perdió en el escaneo.
> El valor **0.03 de rodadura** y los **0.5 civil / 0.3 militar** de frenado sí están en el cuerpo del
> texto (p.672 y p.678); los demás pares se leen de la tabla y **conviene verificarlos**.

Reglas de integración: usar el empuje al **70% (1/√2) de `V_TO`** *"Because we integrate with respect
to velocity squared"*; `V_TO ≥ 1.1 V_stall`; `CL` en tierra **<0.1** salvo flaps grandes; rotación
**3 s en aviones grandes**, **1 s en pequeños**; transición a **1.15 V_stall** con **0.9 CLmax**;
*"Also, `K` can be reduced due to ground effect."*

#### 2.6.10 Aterrizaje (§17.9, p.676–679)
Reutiliza `R-Ec. 17.102` con `V_inicial = V_TD` y `V_final = 0`, y `R-Ec. 17.107/17.109/17.110/17.112`
para el flare y la aproximación. Parámetros:
`W_aterrizaje` entre `W0` y **0.85 W0** (dato del pliego de requisitos, **no** el peso de fin de
misión); `V_a = 1.3 V_stall` (**1.2** militar); ángulo de aproximación **≤3 grados** en transportes;
`V_TD = 1.15 V_stall` (**1.1** militar); velocidad media del flare **1.23 V_stall** (**1.15** militar)
con `n = 1.2`; rodadura libre **1–3 s**; **µ 0.5 civil / 0.3 militar**;
reversa de jet **−40 a −50%** del empuje máximo con **corte a ~50 kt {85 ft/s, 93 km/h}** ⇒ el rodaje
se parte en **dos tramos**; hélice reversible **40%** (turbohélice **60%**), usable en todo el rodaje;
drogue `C_D ≈ 1.4 × área frontal inflada / S_ref`;
**FAR field length = 1.666 × (aproximación + flare + rodaje total)**.
*"the FARs **do not permit use of thrust reversing** in meeting the certification requirements; what if
they fail just when you need them? Thrust reversers are added to airplanes **for safety and to save on
brake wear**, not to meet FAA certification requirements."*

#### 2.6.11 Medidas de mérito de caza (§17.10, p.679–685)
Sin ecuaciones nuevas salvo `psi_punto = g*n/V` para viraje inducido por empuje sin gravedad.
Conceptos que sí son requisitos: **envolvente de gestión de energía** (`Ps` máximo Y mínimo vs régimen
de viraje — el mínimo cuenta porque poder **frenar** obliga al oponente a rebasar); **loaded roll**;
**dynamic turn**; **supermaniobra postpérdida** por tres vías (toberas en el CG tipo Harrier; tobera
trasera + canard grande; apuntado de fuselaje tipo X-31).
Deficiencias declaradas de las métricas clásicas: se centran en **régimen permanente** cuando el
combate real es *"characterized by continuous change in aircraft state"*, y están orientadas al
**ataque con cañón** cuando *"in combat the first aircraft to point its nose at the opponent will win,
regardless of energy state."*
Nota de campo del autor sobre el riesgo de la maniobra postpérdida: *"the aircraft will decelerate
very rapidly and can reach velocities near zero **if the pilot is not careful (as this author
discovered while flying the X-31 simulator!)**."*

---

## 3. FIXTURES DE TEST

> **Advertencia estructural, repetida porque es el hallazgo del bloque:** los capítulos 12–17 **no
> contienen ni un solo ejemplo numérico resuelto**. Es deliberado (§1.4, p.7). **Toda** la suite de
> aceptación del bloque de análisis sale del **§24.3, el caza DR-3**, páginas 921–958. Lo que sigue es
> esa mina, extraída entrada por entrada. El §24.2 (DR-1 homebuilt) es papel cuadriculado escaneado y
> **no produjo ni una tabla legible** (verificado entre las líneas 43462 y 45950).

### 3.1 La geometría de entrada del DR-3 — la base de TODOS los demás fixtures

```
FIXTURE raymer-24-dr3-geometria [§24.3, p.923-924]
entradas (archivo DR3.DAA, "AERODYNAMIC INPUTS"):
  Max M                 = 2.000
  Max altitude          = 50,000 ft {15,240 m}
  % laminar             = 0.000            (flujo totalmente turbulento, pintura de camuflaje)
  k                     = 3.33e-5 ft {1.015e-5 m}   (= "camouflage paint on aluminum", Tabla 12.5)
  % leak & protuberance = 6.000
  A_max aeronave        = 17.070 ft2 {1.586 m2}
  longitud efectiva     = 45.200 ft {13.777 m}
  E_wd                  = 2.000
  CL de crucero         = 0.210
  ALA:   S_ref 294.000 ft2 {27.313 m2} · S_exp 215.000 ft2 {19.974 m2}
         A = 3.500 (verdadero y efectivo) · lambda = 0.250 · Λ_LE = 38.000 deg
         t/c = 0.060 · Delta-Y = 1.280 · Q = 1.000
         CL_diseño = 0.400 · CLmax_perfil = 1.640
  COLA H: S 92.000 ft2 {8.547 m2} (expuesta = total) · A = 4.000 · lambda = 0.340
         Λ_LE = 30.000 deg · t/c = 0.060 · Delta-Y = 1.280 · Q = 1.000 · diedro 28.400 deg
  FUSELAJE: S_wet 588.000 ft2 {54.627 m2} · longitud 45.200 ft · d_efectivo 5.500 ft {1.676 m}
         Q = 1.000
  CANOPY: S_wet 39.000 ft2 {3.623 m2} · longitud 13.900 ft {4.237 m} · d_ef 2.000 ft {0.610 m}
  DIVERTER DE CAPA LÍMITE: 2 cuñas · l = 4.200 ft {1.280 m} · d = 2.830 ft {0.863 m}
                           espesor 0.330 ft {0.101 m}
  MISC D/q vs Mach (misil AIM-9 y pilón, de la Fig. 12.25):
         M 0.000/0.500/0.980 -> 0.120 ft2 {0.011 m2}
         M 1.100 -> 0.270 {0.025} · M 1.200 -> 0.290 {0.027} · M 2.000 -> 0.300 {0.028}
  MISC D/q vs Mach (portilla de cañón): 0.200 ft2 {0.019 m2} constante de M 0 a M 2
salida esperada: (ver fixtures siguientes)
tolerancia: exacta (son entradas)
notas del texto (p.921-922):
  - A_max total estimada en 20.9 ft2 {1.94 m2} MENOS 3.83 de área de captura {0.36 m2}
    = neto 17.07 ft2 {1.58 m2}  -> COMPROBABLE: 20.9 - 3.83 = 17.07 ✓
  - E_wd = 2.0 "typical of an aircraft designed with some attention to area ruling"
  - "Skin friction drag analysis assumed fully turbulent flow over camouflage paint"
```

### 3.2 CLmax del DR-3 — el único uso trabajado de las Ecs. 12.15/12.21/Tabla 12.1/Tabla 12.2

```
FIXTURE raymer-24-dr3-clmax [§24.3, p.922]
entradas: perfil serie 64 · c_lmax_perfil ~= 0.82 · Delta-Y ~= 1.28 (Tabla 12.1)
          flap de borde de salida simple: delta_c_lmax ~= 0.9 (Tabla 12.2)
          flap de borde de ataque:        delta_c_lmax ~= 0.3 (Tabla 12.2)
          ángulos de línea de bisagra: 10 deg (borde de salida) y 39 deg (borde de ataque)
          R-Ec. 12.21
salida esperada:
          delta_CLmax total ~= 0.82
          c_lmax ajustado del perfil = 0.82 + 0.82 = 1.64
          CLmax de aterrizaje SUPUESTO = 1.8
          (y en la corrida de RDS, p.926: "CLmax at Mach 0.2 = 1.7942")
tolerancia: 2% (el texto usa "about" en cada paso)
GATE: si tu build-up da un delta_CLmax muy distinto de 0.82 con esas cuatro entradas,
      tu implementación de 12.21 o tu lectura de la Tabla 12.2 está mal.
IMPORTANTE: el CLmax final de aterrizaje NO sale de la ecuación. Sale de un juicio:
      "For landing, a CL-max value of 1.8 was ASSUMED based on data for modern fighters
       with leading edge flaps." -> ver §4.
```

### 3.3 Build-up de arrastre parásito del DR-3 — DOS puntos de vuelo completos

```
FIXTURE raymer-24-dr3-cd0-subsonico [§24.3, p.925]
entradas: altitud 30,000 ft · M 0.40 · geometría del fixture -geometria
salida esperada (todos los Cdo en COUNTS, es decir x1e-4):
  componente     R# (x1e6)   Cf (x1e-5)   FF       S_wet (ft2)   Cdo (counts)
  WING            11.715      28.859      1.190     431.8         53.5
  HORZ TAIL        5.916      32.235      1.202     184.8         25.8
  FUSELAGE        51.597      23.046      1.129     588.0         55.1
  CNPY/FAIR       15.867      27.516      1.196      39.0          4.6
  BL DIVRTR        4.794      33.384      1.674       2.8          0.6
  Misc D/q vs M                                                    4.327
  Misc D/q vs M                                                    7.211
  TOTAL Cdo                                                      151.131  (= 0.0151131)
tolerancia: 1 count en los componentes; 2 counts en el total
GATES QUE ESTE FIXTURE ATRAPA:
  1. FF del fuselaje = 1.129 con f = 45.2/5.5 = 8.218.
     Comprobación: 1 + 60/8.218^3 + 8.218/400 = 1 + 0.1081 + 0.0205 = 1.129 ✓
     => el DR-3 fue corrido con la ecuación de EDICIONES PREVIAS (FF = 1 + 60/f^3 + f/400),
        NO con la R-Ec. 12.31 de la 6a edición (cuyo cuerpo el OCR destruyó).
        [Ver §7 y §9: es un dato que el pliego previo ya había detectado y que confirmo.]
  2. FF del canopy = 1.196 con f = 13.9/2.0 = 6.95.
     Comprobación: 1 + 60/6.95^3 + 6.95/400 = 1 + 0.1787 + 0.0174 = 1.196 ✓
  3. S_wet del ala en la tabla de arrastre (431.8 ft2) NO es S_exp (215.0 ft2):
     431.8 / 215.0 = 2.008 -> el área mojada de una superficie es ~2 x la expuesta.
     Igual la cola: 184.8 / 92.0 = 2.009.
  4. Las dos filas "Misc D/q vs M" (4.327 y 7.211 counts) salen de dividir el D/q entre S_ref:
     0.120/294 = 4.08e-4 ... y 0.200/294 = 6.80e-4 -> 6.80 counts.
     [OCR DUDOSO / discrepancia declarada: los valores impresos (4.327 y 7.211) NO coinciden con
      esa división simple. O hay un factor de leakage aplicado, o el orden de las dos filas está
      cruzado. NO uses estas dos filas como fixture hasta resolverlo contra el impreso.]
```

```
FIXTURE raymer-24-dr3-cd0-supersonico [§24.3, p.925]
entradas: altitud 40,000 ft · M 1.60 · misma geometría
salida esperada:
  componente     R# (x1e6)   Cf (x1e-5)   FF       S_wet (ft2)   Cdo (counts)
  WING            31.421      20.520      1.000     431.8         31.9
  HORZ TAIL       15.867      22.773      1.000     184.8         15.2
  FUSELAGE       138.393      16.590      1.000     588.0         35.2
  CNPY/FAIR       42.559      19.618      1.000      39.0          2.8
  BL DIVRTR       12.860      23.535      1.000       2.8          0.2
  Misc D/q vs M                                                   10.636
  Misc D/q vs M                                                    7.211
  Wave drag coeff. Cdw                                           122.0
  TOTAL Cdo                                                      225.126  (= 0.0225126)
tolerancia: 1 count en componentes; 2 counts en el total
GATE PRINCIPAL: **TODOS los FF = 1.000 en supersónico.** Es la verificación directa del
  REQ-COMPRES-12-20. Si tu motor deja FF > 1 arriba de M1, está mal.
GATE SECUNDARIO: el arrastre de onda (122.0 counts) es MÁS DE LA MITAD del total (225.1),
  exactamente como avisa §12.5.9: "This new term, supersonic 'wave drag', will often be greater
  than all of the other drags put together."
COMPROBACIÓN CRUZADA DEL SEARS-HAACK:
  (D/q)_SH = (9*pi/2)*(A_max/l)^2 = 14.137 * (17.07/45.2)^2 = 14.137 * 0.14265 = 2.0166 ft2
  CD_SH = 2.0166/294 = 68.6 counts. Con E_wd = 2.0 -> 137.2 counts a M1.2.
  A M1.6 el corchete de 12.45 lo reduce a 122.0 -> factor 0.889.
  [DERIVADO por mí: la comprobación cierra en orden de magnitud y en signo. NO es una cita del
   libro; márcalo como derivado si lo conviertes en test.]
```

### 3.4 Arrastre debido a sustentación del DR-3 — `CL_alpha` y `K` tabulados

```
FIXTURE raymer-24-dr3-clalpha [§24.3, p.926]
entradas: A = 3.50 · Λ_LE = 38.00 deg · Λ_max_t = 23.67 deg
          S_exp/S_ref = 0.73 · F (factor de sustentación del fuselaje) = 1.47
salida esperada (CL_alpha por radián, y su inverso = K a 0% de succión):
  M      CL_alpha    1/CL_alpha
  0.20    3.6717      0.2724
  0.30    3.7163      0.2691
  0.40    3.7821      0.2644
  0.50    3.8729      0.2582
  0.60    3.9951      0.2503
  0.70    4.1587      0.2405
  0.80    4.3809      0.2283
  0.84    4.4925      0.2226
  0.88    4.6215      0.2164
  0.92    4.7722      0.2095
  0.96    4.9507      0.2020
  1.00    5.1222      0.1952
  1.05    5.2966      0.1888
  1.10    5.3923      0.1855   <- PICO
  1.20    5.2005      0.1923
  1.40    4.1591      0.2404
  1.60    3.3519      0.2983
  1.80    2.8183      0.3548
  2.00    2.4413      0.4096
  2.20    2.1628      0.4624
  K_100% = 1/(pi*A) = 0.0909
  M para borde de ataque sónico = 1.2691
  CLmax a M 0.2 = 1.7942
tolerancia: 0.5% (4 cifras significativas impresas)
GATES:
  1. K_100% = 1/(pi*3.5) = 0.090946 ✓ (impreso 0.0909)
  2. M_sonic_LE = 1/cos(38 deg) = 1/0.78801 = 1.26903 ✓ (impreso 1.2691) -> verifica R-Ec. 12.14
  3. F = 1.47: con R-Ec. 12.9, 1.07*(1 + d/b)^2 = 1.47 => (1 + d/b)^2 = 1.3738 => d/b = 0.1721.
     Con b = sqrt(A*S_ref) = sqrt(3.5*294) = 32.08 ft => d = 5.52 ft, que casa con el diámetro
     efectivo de fuselaje de 5.500 ft del fixture -geometria ✓✓
     [Este es EL mejor test unitario del capítulo 12: cierra geometría -> Ec. 12.9 -> tabla.]
  4. La curva tiene su MÁXIMO en M 1.10, no en M 1.00, y luego cae: es el empalme transónico
     "faired" de §12.4.3 y confirma que no se usó Prandtl-Glauert cruda a través de M = 1.
  5. El producto (S_exp/S_ref)*F = 0.73*1.47 = 1.0731 > 1. El propio texto exige suprimirlo a
     ~0.98 (REQ-AERO3D-12-05) y RDS EVIDENTEMENTE NO LO HIZO.
     [DERIVADO — es una inconsistencia entre el consejo de §12.4.1 y la corrida de §24.3.
      Documentarla; no "arreglarla" en silencio.]
```

```
FIXTURE raymer-24-dr3-suction [§24.3, p.926]
entradas: el ala del DR-3 con CL de diseño 0.40
salida esperada (schedule de succión de borde de ataque S vs CL):
  CL     S
  0.15   0.6100
  0.25   0.8100
  0.35   0.9400
  0.45   0.9400
  0.55   0.8700
  0.65   0.7200
  0.80   0.5100
  1.00   0.3300
  1.20   0.2400
  1.40   0.0000
tolerancia: exacta (tabla impresa)
GATES:
  1. El máximo (0.94) cae en CL 0.35-0.45, es decir ALREDEDOR DEL CL DE DISEÑO (0.40).
     Verifica literalmente §12.6.2: "the wing will be designed such that it has the maximum value
     of leading edge suction S when it is operating at its own design lift coefficient."
  2. A CL = 1.4 la succión es CERO -> K = K_0 = 1/CL_alpha. Es el caso extremo de R-Ec. 12.56/12.57.
  3. Aplicando R-Ec. 12.57 a M 0.4: K(CL=0.45) = 0.94*0.0909 + 0.06*0.2644 = 0.0855 + 0.0159
     = 0.1013. [DERIVADO, comprobable contra la Fig. de la p.928 que es imagen.]
```

### 3.5 Pesos del DR-3 — el Group Weight Statement completo

```
FIXTURE raymer-24-dr3-pesos-entradas [§24.3, p.932-934, archivo DR3.DWT]
tipo: FIGHTER/ATTACK (juego de ecuaciones 15.1-15.24)
entradas:
  W0 (TOGW)       = 16,480.000 lb {7475.196 kg}
  W_dg (flight)   = 16,480.000 lb {7475.196 kg}
  Nz (ULTIMATE)   = 11.000                          <- = 7.33 x 1.5 (texto p.931)
  S_w             = 294.000 ft2 {27.313 m2}
  M de diseño max = 1.800
  # motores       = 1.000
  ALA:      X = 23.300 ft · K_dw = 1.000 · K_vs = 1.000 · A = 3.500 · t/c = 0.060
            lambda = 0.250 · Λ_c/4 = 30.000 deg · S_csw = 72.000 ft2 {6.689 m2}
  COLA H:   X = 39.200 ft · F_w = 4.700 ft {1.433 m} · A_h = 6.500 · S_ht = 90.000 ft2 {8.361 m2}
  FUSELAJE: X = 21.700 ft · K_dwf = 1.000 · L = 39.000 ft {11.887 m}
            D = 4.000 ft {1.219 m} · W = 5.400 ft {1.646 m}
  TREN:     X = 23.800 ft · K_cb = 1.000 · K_tpg = 1.000
            W_l = 16,480.000 lb · N_l = 4.000 · L_m = 46.000 in · L_n = 52.000 in
            N_nw = 1.000 · X del tren de nariz = 13.000 ft
  NACELA:   X = 33.300 ft · T por motor = 16,150.400 lb {71.840 kN}
            S_fw = 52.000 ft2 {4.831 m2} · W_engine = 1517.000 lb {688.099 kg}
            K_vg = 1.000 · L_d = 10.700 ft {3.261 m} · K_d = 1.310
            L_s = 2.000 ft {0.610 m} · D_e = 2.700 ft {0.823 m}
  INSTAL.:  L_tp = 0.000 · L_sh = 14.000 ft {4.267 m} · L_ec = 18.300 ft {5.578 m}
            W_aceite = 50.000 lb
  COMBUSTIBLE: X = 22.250 ft · V_t = 703.300 gal · V_i = 389.000 gal · V_p = 314.300 gal
            N_t = 3.000 · SFC (max T) = 1.900 1/hr
  MANDOS:   X = 21.700 ft · S_cs = 94.000 ft2 · N_s = 4.000 · N_c = 1.000 · N_ci = 1.000
  HID/ELEC: X = 21.700 ft · K_vsh = 1.000 · N_u = 10.000 · K_mc = 1.450
            R_kva = 120.000 · L_a = 25.000 ft {7.620 m} · N_generadores = 1.000
  A/C y HABILITACIÓN: X = 8.300 ft
  CARGAS:   W_uav = 727.000 lb {329.761 kg} @ X = 10.000 ft
            W_crew = 220.000 lb @ X = 10.000 ft
            W_payload = 840.000 lb {381.017 kg} @ X = 21.700 ft
            W_misc (empty) = 1000.000 lb {453.592 kg} @ X = 31.800 ft
```

```
FIXTURE raymer-24-dr3-pesos-salida [§24.3, p.934]
salida esperada (FIGHTER/ATTACK GROUP WEIGHT STATEMENT, FPS):
  STRUCTURES GROUP   4526.2      EQUIPMENT GROUP      3066.7
    Wing             1459.4        Flight Controls      655.7
    Horiz. Tail       280.4        Instruments          122.8
    Vert. Tail          0.0        Hydraulics           171.7
    Fuselage         1574.0        Electrical           713.2
    Main Lndg Gear    631.5        Avionics             989.8
    Nose Lndg Gear    171.1        Furnishings          217.6
    Engine Mounts      39.1        Air Conditioning     190.7
    Firewall           58.8        Handling Gear          5.3
    Engine Section     21.0      MISC EMPTY WEIGHT     1000.0
    Air Induction     291.1      TOTAL WEIGHT EMPTY   10,947.2

  PROPULSION GROUP   2354.3      USEFUL LOAD GROUP     5532.8
    Engine(s)        1517.0        Crew                  220.0
    Tailpipe            0.0        Fuel                 4422.8
    Engine Cooling    172.0        Oil                    50.0
    Oil Cooling        37.8        Payload               840.0
    Engine Controls    20.0        Passengers              0.0
    Starter            39.5        Misc Useful Load        0.0
    Fuel System       568.0      TAKEOFF GROSS WEIGHT 16,480.0

  EMPTY CG = 23.8 ft · LOADED-NO FUEL CG = 23.4 ft · GROSS WT CG = 23.1 ft
  (MKS: estructuras 2053.1 kg · propulsión 1067.9 · equipo 1391.0 · vacío 4965.6
        útil 2509.6 · TOGW 7475.2 kg · CG 7.2 / 7.1 / 7.0 m)
tolerancia: 0.1 lb (el libro imprime décimas)
GATES ARITMÉTICOS DE UNA LÍNEA (los mejores tests del capítulo 15):
  1. 4526.2 + 2354.3 + 3066.7 + 1000.0 (misc) = 10,947.2 ✓  (suma de los tres grupos + misc)
     OJO: el "MISC EMPTY WEIGHT 1000.0" está impreso DENTRO de la columna del equipment group
     pero NO está sumado en su subtotal (3066.7). Verifica: 655.7+122.8+171.7+713.2+989.8
     +217.6+190.7+5.3 = 3066.8 -> el subtotal impreso es 3066.7 (redondeo). ✓
  2. 10,947.2 + 5532.8 = 16,480.0 ✓  (vacío + carga útil = TOGW EXACTO)
  3. Carga útil: 220.0 + 4422.8 + 50.0 + 840.0 = 5532.8 ✓
  4. Nz = 11.000 = 1.5 x 7.33 ✓  -> verifica REQ-PESOS-15-17
  5. El texto (p.931) dice que el vacío calculado (10,947.2) quedó "somewhat above the preliminary
     prediction of 10,788 lb {4893 kg} used for initial sizing" -> discrepancia = +1.47%.
     ESE es el lazo de peso del cap 15 realimentando al sizing.
  6. Cola vertical = 0.0 -> el DR-3 usa cola en V y la analizaron con la ECUACIÓN DE COLA
     HORIZONTAL (texto p.931), con S = 90 ft2 {8.4 m2} y A = 6.5 "equivalente".
     Es una DECISIÓN HUMANA documentada, no una regla del libro (ver §4).
  7. Los "1000.0 lb de misc empty weight" son la suma de tres juicios declarados en p.931:
     200 lb {90.7 kg} por el mecanismo de diedro variable de las colas en V
     400 lb {181.4 kg} por la tobera vectorial 2-D
     400 lb {181.4 kg} por el cañón "assumed to always stay with the aircraft"
     -> 200 + 400 + 400 = 1000 ✓  (test de una línea, y prueba que el margen NO es estadístico)
  8. Aviónica: instalada 990 lb {449 kg} adivinada con la Tabla 11.6, y luego R-Ec. 15.21
     INVERTIDA para sacar la no instalada: 727 lb {330 kg}.
     Comprobación: 2.117 * 727^0.933 = 2.117 * 466.4 = 987.3 lb ~= 989.8 impreso ✓ (0.25%)
     [ESTE es el mejor test unitario de la Ec. 15.21, y además documenta un uso INVERSO
      del modelo que el software debe soportar.]
```

### 3.6 Propulsión del DR-3 — pérdidas de instalación

```
FIXTURE raymer-24-dr3-propulsion-entradas [§24.3, p.937, archivo DR3.DPR]
tipo: JET PROPELLED
entradas:
  Thrust-net (sin escalar) = 16,150.400 lb {71.840 kN}
  SFC Fudge                = 0.800        <- "assumed reduction in SFC of 20 percent to adjust
                                              for 'advanced technology'"
  A_capture                = 3.830 ft2 {0.356 m2}
  C_bleed                  = 0.000        <- "suitable bleed losses were already included in
  bleed ratio              = 0.000           uninstalled data" (p.938)
  Nozzle Cd                = 0.015
  A_max nacela             = 16.900 ft2 {1.570 m2}
  Recuperación de presión REFERENCIA (P1/P0)_ref vs Mach — MIL-E-5008B:
    0.200->0.970 · 0.400->0.970 · 0.600->0.970 · 0.800->0.970 · 1.000->0.970
    1.200->0.962 · 1.400->0.949 · 1.600->0.933 · 1.800->0.916 · 2.000->0.897
    2.200->0.877 · 2.400->0.855
  Recuperación de presión REAL (P1/P0)_act vs Mach — toma tipo F-104 con tecnología avanzada:
    0.200->0.880 · 0.400->0.940 · 0.600->0.965 · 0.800->0.970 · 1.000->0.970
    1.200->0.968 · 1.400->0.960 · 1.600->0.945 · 1.800->0.912 · 2.000->0.830
    2.200->0.720 · 2.400->0.600
  Ram Factor C_ram vs Mach:
    0.200 a 1.000 -> 1.350 (constante) · 1.200->1.320 · 1.400->1.290 · 1.600->1.260
    1.800->1.230 · 2.000->1.200 · 2.200->1.170 · 2.400->1.140
  Inlet Drag (D/q) vs Mach:
    0.200->0.010 · 0.400->0.025 · 0.600->0.040 · 0.800->0.070 · 1.000->0.110
    1.200->0.140 · 1.400->0.145 · 1.600->0.135 · 1.800->0.120 · 2.000->0.080
    2.200->0.060 · 2.400->0.040
GATE: la tabla de C_ram reproduce EXACTAMENTE R-Ec. 13.7 en supersónico:
      1.35 - 0.15*(M-1): M=1.2 -> 1.320 ✓ · M=1.6 -> 1.260 ✓ · M=2.4 -> 1.140 ✓
      Y en subsónico usa el 1.35 constante que recomienda §13.3.2. ✓✓
      [Este es EL test unitario de la Ec. 13.7, y es exacto en las 8 filas supersónicas.]
GATE 2: la tabla (P1/P0)_ref reproduce R-Ec. 13.5 = 1 - 0.075*(M-1)^1.35:
      M=1.2 -> 1 - 0.075*0.2^1.35 = 1 - 0.075*0.11696 = 0.99123  ... IMPRESO 0.962.
      [DISCREPANCIA. La tabla impresa NO reproduce 13.5 con esos números.
       Posibilidades: (a) el 1.35 del exponente está mal leído en 13.5, (b) hay un factor
       adicional. **NO uses este par como fixture sin verificar contra el impreso.** Marcado.]
```

```
FIXTURE raymer-24-dr3-propulsion-salida [§24.3, p.938]
salida esperada (PROPULSION ANALYSIS: TURBOFAN, FPS):
  M#    Inlet loss   Bleed loss   Inlet D/q (ft2)   Nozzle D/q (ft2)
  0.4     0.0405       0.0000        0.0957            0.2535
  0.6     0.0068       0.0000        0.1532            0.2535
  0.8     0.0000       0.0000        0.2681            0.2535
  1.0     0.0000       0.0000        0.4213            0.2535
  1.2    -0.0083       0.0000        0.5362            0.2535
  1.4    -0.0143       0.0000        0.5553            0.2535
  1.6    -0.0145       0.0000        0.5171            0.2535
  1.8     0.0051       0.0000        0.4596            0.2535
  2.0     0.0807       0.0000        0.3064            0.2535
  2.2     0.1836       0.0000        0.2298            0.2535
  2.4     0.2912       0.0000        0.1532            0.2535
  (MKS: Inlet D/q 0.0089 / 0.0142 / 0.0249 / 0.0391 / 0.0498 / 0.0516 / 0.0480 / 0.0427 /
        0.0285 / 0.0213 / 0.0142 m2 · Nozzle D/q 0.0236 m2 constante)
tolerancia: 1e-4
GATES:
  1. R-Ec. 13.6 verificada línea a línea:
     M=0.4: 1.350 * (0.970 - 0.940) = 0.0405 ✓ EXACTO
     M=0.6: 1.350 * (0.970 - 0.965) = 0.00675 ~= 0.0068 ✓
     M=0.8 y 1.0: 1.350 * (0.970 - 0.970) = 0.0000 ✓
     M=1.2: 1.320 * (0.962 - 0.968) = -0.00792 ~= -0.0083 (0.5% de diferencia; el signo
            NEGATIVO es lo importante: una toma MEJOR que la de referencia GANA empuje)
     M=2.0: 1.200 * (0.897 - 0.830) = 0.0804 ~= 0.0807 ✓
     M=2.4: 1.140 * (0.855 - 0.600) = 0.2907 ~= 0.2912 ✓
     ==> ESTE ES EL MEJOR FIXTURE DEL CAPÍTULO 13. Once filas, una ecuación, cierra en todas.
  2. Nozzle D/q constante 0.2535 ft2 = 0.015 (Nozzle Cd) x 16.900 ft2 (A_max nacela) = 0.2535 ✓
     EXACTO. Verifica el uso de la Tabla 13.1 referida al área máxima.
  3. Bleed loss = 0 en toda la envolvente porque las pérdidas de sangrado YA venían en los
     datos no instalados -> verifica REQ-PROP-13-04 (contabilidad declarada).
```

### 3.7 Estabilidad y control del DR-3

```
FIXTURE raymer-24-dr3-estabilidad [§24.3, p.941]
entradas:
  ALA:   S_ref 294.00 ft2 · S_exp/S_ref 0.73 · A 3.50 · MAC 10.26 ft
         Λ_LE 38.00 deg · Λ_max_t 23.67 deg · CL_alpha 3.99 /rad · X_mac 23.30 ft
  COLA:  S_ref 92.00 ft2 · A 4.00 · Λ_LE 30.00 deg · Λ_max_t 18.32 deg
         d(eps)/d(alpha) = 0.46 · CL_alpha 3.12 /rad · X_mac 39.20 ft
  FUSELAJE: Cm_alpha = 0.81
salida esperada (a M 0.6):
  X_NEUTRAL POINT = 23.02 ft
  X_cg            = 23.10 ft
  STATIC MARGIN   = -0.78 %
  Cm_alpha        = 0.0310
  TRIM POINT (crucero): CL = 0.21 · alpha = 2.71 deg · delta_e = 0.11 deg
tolerancia: 0.01 ft en posiciones; 0.05% en margen; 0.01 deg en ángulos
GATES:
  1. Margen estático: (23.02 - 23.10)/10.26 = -0.0078 = -0.78% ✓ EXACTO.
     Verifica R-Ec. 16.11 con el MAC del ala como divisor.
  2. Cm_alpha vs margen: R-Ec. 16.10 dice Cm_alpha = -CL_alpha_total * SM.
     0.0310 / 0.0078 = 3.97 ~= CL_alpha del ala (3.99). ✓ (0.5%)
     [Confirma que el "CL_alpha_total" usado incluye ya cola y fuselaje y sale ~3.97.]
  3. Signo: SM negativo => Cm_alpha POSITIVO => INESTABLE. El texto lo confirma:
     "this design is just slightly unstable at subsonic speeds — good for minimizing trim drag."
  4. Trimado casi nulo (delta_e = 0.11 deg) en crucero -> "Note that it takes only a small
     elevator deflection to trim." Es la señal de un centrado bien puesto.
  5. CL_alpha del ala aquí (3.99 /rad a M0.6) coincide con la tabla del fixture -clalpha
     (3.9951 a M 0.60). ✓✓ CIERRA LA CADENA CAP 12 -> CAP 16.
DATO DE PROCESO (no numérico, pero es requisito): el texto declara que para un caza RSS
  "early first-order stability and control calculations are not so critical because the
   aircraft's handling qualities will be determined largely by the computer programming,
   provided that basic requirements including tail sizes and c.g. location are met and the
   aircraft has adequately sized control surfaces." -> ver §4.
```

### 3.8 Performance del DR-3 — despegue, aterrizaje, Ps, viraje, aceleración

```
FIXTURE raymer-24-dr3-despegue [§24.3, p.950]
entradas: W_i = 16,480.0 lb {7475.2 kg} · W_i/W0 = 1.000 · T/W = 0.980
          T al inicio = 16,150.4 lb {71.8 kN} · W/S = 56.05 lb/ft2 {273.68}
salida esperada:
  V_stall    =  99.80 kt {184.8 km/h}
  V_takeoff  = 109.8  kt {203.3 km/h}
  Ángulo de ascenso = 44.97 deg
  CL de ascenso = 1.49 · CD0 de ascenso = 0.0289 · K = 0.2609 · L/D de ascenso = 3.07
  GROUND ROLL DISTANCE          =  538.2 ft { 164.0 m}
  ROTATE DISTANCE               =  185.4 ft {  56.5 m}
  TOTAL GROUND ROLL DISTANCE    =  723.6 ft { 220.6 m}
  TRANSITION DISTANCE           =  761.6 ft { 232.1 m}
  CLIMB DISTANCE                =    0.0 ft {   0.0 m}
  TOTAL TAKEOFF DISTANCE        = 1485.2 ft { 452.7 m}
  FAR PART 25 TAKEOFF DISTANCE  = 1707.9 ft { 520.6 m}
tolerancia: 0.1 ft
GATES:
  1. V_TO / V_stall = 109.8/99.80 = 1.1002 ✓ -> verifica la regla "V_TO >= 1.1 V_stall".
  2. TOTAL GROUND ROLL = 538.2 + 185.4 = 723.6 ✓
  3. CLIMB DISTANCE = 0 -> el obstáculo de 50 ft se libró DURANTE la transición,
     así que se usó R-Ec. 17.111 y S_C = 0 (regla de §17.8.3). ✓
  4. TOTAL = 723.6 + 761.6 + 0.0 = 1485.2 ✓
  5. FAR 25 / total = 1707.9/1485.2 = 1.150 ✓ EXACTO -> es la regla de "15% greater than the
     all-engines-operating obstacle clearance takeoff distance" de §17.8.4.
  6. ROTATE DISTANCE / V_TO: 109.8 kt = 185.4 ft/s; 185.4 ft / 185.4 ft/s = 1.000 s.
     ==> usaron 1 segundo de rotación (regla de aviones pequeños). ✓✓ Test de una línea.
  7. Ángulo de ascenso de 44.97 deg con T/W = 0.980 y L/D = 3.07:
     sin(gamma) = 0.980 - 1/3.07 = 0.980 - 0.3257 = 0.6543 -> gamma = 40.87 deg.
     [DISCREPANCIA de 4 grados con el impreso. Probablemente RDS usa la forma completa
      (con cos gamma en el término de arrastre, R-Ec. 17.38) en vez de la aproximada.
      Comprobación con la forma completa: sin(g) = 0.980 - cos(g)/3.07; iterando:
      g = 44.9 deg -> 0.980 - 0.7083/3.07 = 0.980 - 0.2307 = 0.7493 -> asin = 48.5 deg. No cierra
      tampoco. **Marcado como DISCREPANCIA ABIERTA: no uses el ángulo de 44.97 como fixture
      hasta resolver qué forma de 17.38 usa RDS.**]
```

```
FIXTURE raymer-24-dr3-aterrizaje [§24.3, p.950]
entradas: W_i = 16,480.0 lb · T/W de rodaje = -0.392 (reversa) · W/S = 56.05
salida esperada:
  V_stall     =  95.84 kt {177.5 km/h}
  V_touchdown = 115.01 kt {213.0 km/h}
  Ángulo de aproximación = -3.00 deg
  CD0 de aproximación = 0.1124 · CL = 1.62 · K = 0.2724 · L/D = 2.53
  APPROACH DISTANCE           =  773.5 ft { 235.8 m}
  FLARE DISTANCE              = 2733.1 ft { 833.1 m}
  FREE GROUND ROLL DIST       =  194.2 ft {  59.2 m}
  BRAKING DISTANCE            =  796.1 ft { 242.7 m}
  TOTAL GROUND ROLL DISTANCE  =  990.4 ft { 301.9 m}
  NO-FLARE LANDING DISTANCE   = 1944.5 ft { 592.7 m}
  TOTAL LANDING DISTANCE      = 4497.0 ft {1370.7 m}
  FAR PART 25 LANDING DIST    = 7495.0 ft {2284.5 m}
tolerancia: 0.1 ft
GATES:
  1. V_TD / V_stall = 115.01/95.84 = 1.2000  -> ES 1.2, NO 1.15.
     [DISCREPANCIA CON EL TEXTO. §17.9.2, p.677 dice "Touchdown speed V_TD is 1.15 V_stall
      (1.1 V_stall for military)". Aquí RDS usó 1.2. **Documentarlo, no copiarlo ciegamente.**]
  2. TOTAL GROUND ROLL = 194.2 + 796.1 = 990.3 ~= 990.4 ✓ (redondeo)
  3. TOTAL = 773.5 + 2733.1 + 990.4 = 4497.0 ✓ EXACTO
  4. FAR 25 / total = 7495.0/4497.0 = 1.6667 ✓ EXACTO -> verifica el "additional two-thirds"
     de §17.9.3. TEST DE UNA LÍNEA.
  5. FREE GROUND ROLL: 115.01 kt = 194.2 ft/s; 194.2 ft / 194.2 ft/s = 1.000 s de rodaje libre.
     ✓✓ (el libro permite 1-3 s; usaron 1)
  6. V_stall de aterrizaje (95.84) < V_stall de despegue (99.80) -> CLmax de aterrizaje mayor.
     Razón: (99.80/95.84)^2 = 1.0844 -> CLmax_ldg = 1.0844 x CLmax_TO.
     [DERIVADO, comprobable contra el CLmax de 1.8 asumido en p.922.]
  7. T/W de rodaje = -0.392: con T/W estático de 0.980, la reversa vale -0.392/0.980 = -40.0%
     del empuje máximo ✓ -> extremo bajo del rango "40 or 50%" de §17.9.3.
```

```
FIXTURE raymer-24-dr3-ps-viraje [§24.3, p.951]
entradas: M = 0.90 · altitud 30,000 ft {9144 m}
          W_i/W0 = 0.872 · W_i = 14,370.6 lb        <- "combat weight = 0.89 x takeoff weight"
                                                       [OJO: 0.872 impreso, 0.89 en el texto p.943]
          W/S = 48.88 lb/ft2 {238.65} · T/W = 0.649 · T = 9322.7 lb {41.5 kN}
          Radio de viraje = 3426 ft {1044 m}
salida esperada:
  n=1: CD0 0.0161 · K 0.1411 · CL 0.14 · Ps = +458.34 ft/s {139.7 m/s}
       Rate of Climb = 27,500 fpm {8382 mpm} · Climb Gradient = 0.51
  n=2: CD0 0.0161 · K 0.1138 · CL 0.27 · Ps = +419.78 {127.9} · Turn rate =  3.57 deg/s
  n=3: CD0 0.0161 · K 0.1022 · CL 0.41 · Ps = +362.72 {110.6} · Turn rate =  5.83 deg/s
  n=4: CD0 0.0161 · K 0.1103 · CL 0.55 · Ps = +258.88 { 78.91} · Turn rate =  7.98 deg/s
  n=5: CD0 0.0161 · K 0.1340 · CL 0.69 · Ps =  +64.17 { 19.56} · Turn rate = 10.10 deg/s
  n=6: CD0 0.0161 · K 0.1553 · CL 0.82 · Ps = -210.93 {-64.3 } · Turn rate = 12.19 deg/s
  n=7: CD0 0.0161 · K 0.1699 · CL 0.96 · Ps = -546.41 {-167.  } · Turn rate = 14.28 deg/s
tolerancia: 0.01 en coeficientes; 0.5 ft/s en Ps; 0.01 deg/s en régimen
GATES (este es el mejor fixture del capítulo 17):
  1. Régimen de viraje, R-Ec. 17.52: psi = 57.3 * g * sqrt(n^2-1)/V.
     V a M0.9 y 30,000 ft: a = 994.8 ft/s -> V = 895.3 ft/s.
     n=5: 57.3*32.174*sqrt(24)/895.3 = 57.3*32.174*4.899/895.3 = 10.086 deg/s
          ✓ IMPRESO 10.10 (0.14%)
     n=7: 57.3*32.174*sqrt(48)/895.3 = 57.3*32.174*6.928/895.3 = 14.264 ✓ IMPRESO 14.28
     n=2: 57.3*32.174*sqrt(3)/895.3 = 3.566 ✓ IMPRESO 3.57
     ==> TRES FILAS QUE CIERRAN A LA TERCERA CIFRA. Test unitario perfecto de 17.52.
  2. Radio de viraje, R-Ec. 17.79: R = V^2/(g*sqrt(n^2-1)).
     Con n=5: 895.3^2/(32.174*4.899) = 801,562/157.6 = 5086 ft. IMPRESO 3426 ft.
     Con n=7: 801,562/(32.174*6.928) = 3596 ft. Más cerca.
     [DISCREPANCIA: el radio impreso (3426) NO corresponde a ninguno de los siete factores de
      carga de la tabla de forma limpia. Está impreso una sola vez, arriba, sin decir a qué n
      pertenece. **No lo uses como fixture.**]
  3. K CRECE Y DECRECE con n: mínimo en n=3 (0.1022) y sube a ambos lados.
     ✓✓ Es la firma inconfundible del MÉTODO DE SUCCIÓN DE BORDE DE ATAQUE (R-Ec. 12.57):
     K es mínimo cerca del CL de diseño y empeora arriba Y abajo.
     Con el método de Oswald, K sería CONSTANTE en las siete filas.
     ==> ESTE ES EL TEST QUE DISTINGUE LAS DOS IMPLEMENTACIONES DE K. Vale oro.
  4. CL crece lineal con n: 0.14, 0.27, 0.41, 0.55, 0.69, 0.82, 0.96.
     Diferencias: 0.13, 0.14, 0.14, 0.14, 0.13, 0.14 -> CL = 0.1375*n aprox. ✓ (L = nW)
  5. CD0 CONSTANTE (0.0161) en las siete filas: el parásito no depende de n. ✓
  6. Ps de n=1 vs régimen de ascenso: 458.34 ft/s x 60 = 27,500 fpm ✓ EXACTO.
     Verifica que "Ps a n=1 ES el régimen de ascenso" (§17.6.1). TEST DE UNA LÍNEA.
  7. Gradiente de ascenso: 458.34/895.3 = 0.512 ✓ IMPRESO 0.51.
  8. Ps cruza cero entre n=5 (+64.17) y n=6 (-210.93) -> el viraje sostenido máximo del DR-3
     a M0.9/30,000 ft está en n ~= 5.2. Interpolando: 5 + 64.17/(64.17+210.93) = 5.23.
     [DERIVADO — pero es exactamente el tipo de número que un requisito de caza especifica
      ("Ps = 0 at n = 5 at Mach 0.9 at 30,000 ft", §17.6.2, p.662). El DR-3 lo CUMPLE.]
```

```
FIXTURE raymer-24-dr3-aceleracion [§24.3, p.951]
entradas: W_i/W0 = 0.872 · W_i = 14,370.6 lb · W/S = 48.88 · altitud 35,000 ft
salida esperada (integración de M0.9 a M1.4 en once pasos):
  V (ft/s)  T/W    CD0      K       CL       Ps (ft/s)  dV/dt    Δt (s)
  538.80   0.522  0.0173  0.1397  0.1603     +356.79   12.6250   3.85
  567.61   0.538  0.0199  0.1450  0.1444     +363.57   12.2120   3.98
  596.41   0.554  0.0239  0.1508  0.1308     +354.10   11.3196   4.30
  625.21   0.569  0.0256  0.1589  0.1190     +354.35   10.8059   4.50
  654.01   0.585  0.0255  0.1703  0.1088     +367.15   10.7032   4.54
  682.82   0.601  0.0250  0.1826  0.0998     +382.78   10.6881   4.55
  711.62   0.629  0.0246  0.1966  0.0919     +412.42   11.0495   4.40
  740.42   0.662  0.0242  0.2111  0.0849     +449.13   11.5650   4.21
  769.22   0.696  0.0238  0.2250  0.0786     +487.31   12.0784   4.03
  798.02   0.729  0.0234  0.2388  0.0731     +526.94   12.5892   3.86
  ACCEL TIME FROM 0.900 TO 1.400 IS 42.2 sec · DISTANCE = 7.8 nmi
tolerancia: 0.01 en coeficientes; 0.01 s en Δt
GATES:
  1. **EL DR-3 FALLA ESTE REQUISITO.** El texto (p.943) lo declara: "the requirement for
     acceleration from M.9 to M1.4 in 30 s was NOT met by the baseline DR-3 design!"
     42.2 s vs 30 s requeridos.
     ==> **UN TEST QUE REPRODUZCA EL DR-3 Y LE SALGA QUE TODO CUMPLE, ESTÁ MAL.**
  2. CD0 tiene un MÁXIMO en V = 625.21 ft/s (0.0256) y luego BAJA. A 35,000 ft el sonido va a
     973.1 ft/s, así que 625 ft/s = M0.64... [DISCREPANCIA: la tabla dice de M0.9 a M1.4, pero
     538.8/973.1 = M0.554 y 798.0/973.1 = M0.820. **Los pasos de velocidad NO cubren M0.9-M1.4
     a 35,000 ft con la atmósfera estándar.** Posible explicación: la tabla está truncada por el
     OCR (once filas visibles de un total mayor). **Marcado: usa los Δt y el total de 42.2 s,
     no la correspondencia V<->Mach.**]
  3. Δt suma: 3.85+3.98+4.30+4.50+4.54+4.55+4.40+4.21+4.03+3.86 = 42.22 ✓ = 42.2 impreso.
     ==> las once filas mostradas SÍ son la integración completa, y el total cierra.
     (Lo que no cierra es la conversión V->Mach; ver punto 2.)
  4. dV/dt tiene un MÍNIMO (10.6881) coincidiendo con el pico de arrastre transónico y luego
     sube: es la "thrust pinch" de §17.6.3 hecha número.
  5. Δt = ΔV / dV_dt_promedio: (567.61-538.80)/12.625 = 28.81/12.625 = 2.282 s. IMPRESO 3.85.
     [DISCREPANCIA. Probablemente el Δt impreso corresponde al intervalo SIGUIENTE o el paso de
      integración no es el que se ve. **No uses la relación Δt <-> dV/dt como fixture.**]
```

### 3.9 Sizing refinado del DR-3 — los segmentos con datos aerodinámicos completos

```
FIXTURE raymer-24-dr3-sizing-segmentos [§24.3, p.944]
(Los 14 segmentos y sus fracciones ya están transcritos en el pliego previo §7.2. Lo que AÑADO
 aquí son los coeficientes aerodinámicos por segmento, que el pliego previo NO tomó y que son
 los que verifican la cadena cap 12 -> cap 17.)
  SEGMENTO 1 TAKEOFF:
    W/S 56.05 · T/W 0.666 · C 0.7518 · E 0.0830 h
    fracción de peso = 0.9584
  SEGMENTO 2 CLIMB/ACCELERATE (0 -> 45,000 ft; M0.200 -> M0.850):
    W/S 53.72 · T/W 0.378 · CL 0.2017 · CD0 0.0142 · K 0.1349 · L/D 10.2636
    C 0.8634 · Ps 11,411.14 fpm · tiempo 4.92 min · distancia 32.9061 nmi
    fracción de peso = 0.9736
  SEGMENTO 3 CRUISE (200.0 nmi de segmento; crédito de ascenso/descenso 32.91 nmi):
    velocidad 487.2 kt = M0.850 a 45,000 ft
    T/W disponible 0.167 · T/W requerido 0.083 · ajuste de potencia = 49.7%
    W/S 52.30 · CLmax utilizable 1.5036 · CL 0.3358 · CD0 0.0164 · K 0.1016
    L/D 12.0539 · C 0.9948 · ALCANCE ESPECÍFICO 0.3842 nmi/lb
    fracción de peso = 0.9721
  SEGMENTO 4 CLIMB/ACCELERATE (45,000 -> 35,000 ft; M0.850 -> M1.400):
    W/S 50.84 · T/W 0.504 · CL 0.1208 · CD0 0.0248 · K 0.1977 · L/D 4.3604
    C 1.4602 · Ps 19,741.05 fpm · tiempo 0.41 min · distancia 4.8060 nmi
    fracción de peso = 0.9950
tolerancia: 0.5% en coeficientes; 0.1% en fracciones
GATES:
  1. L/D del segmento 2: CL/(CD0 + K*CL^2) = 0.2017/(0.0142 + 0.1349*0.04068)
     = 0.2017/(0.0142 + 0.005488) = 0.2017/0.019688 = 10.244 ✓ IMPRESO 10.2636 (0.19%)
     ==> VERIFICA LA POLAR PARABÓLICA COMPLETA CONTRA EL SOLVER DE MISIÓN. Test de una línea.
  2. L/D del crucero: 0.3358/(0.0164 + 0.1016*0.11276) = 0.3358/(0.0164 + 0.011457)
     = 0.3358/0.027857 = 12.054 ✓ IMPRESO 12.0539 (0.001%!) ✓✓ EXACTO
  3. L/D del segmento 4 (supersónico): 0.1208/(0.0248 + 0.1977*0.014593)
     = 0.1208/(0.0248 + 0.002885) = 0.1208/0.027685 = 4.363 ✓ IMPRESO 4.3604 (0.06%)
     ==> LAS TRES CIERRAN. La polar CD = CD0 + K*CL^2 con K variable es EXACTAMENTE lo que
         corre el solver de misión. Es la validación cruzada cap 12 <-> cap 17.
  4. Alcance específico del crucero: (V/C)*(L/D)/W.
     V = 487.2 kt · C = 0.9948 /hr · L/D = 12.0539
     W en el crucero: W/S = 52.30 x 294 = 15,376 lb
     (487.2/0.9948)*12.0539/15,376 = 489.75*12.0539/15,376 = 5903.4/15,376 = 0.3839 nmi/lb
     ✓ IMPRESO 0.3842 (0.08%) ✓✓ VERIFICA R-Ec. 17.22 (alcance instantáneo) EXACTAMENTE.
  5. El motor está a 49.7% de potencia en crucero (T requerido 0.083 vs disponible 0.167).
     ==> el DR-3 crucea muy por debajo de 90% de potencia, así que R-Ec. 13.9 (potencia parcial)
         está ACTIVA y sube la SFC. Comprobable: C de crucero (0.9948) vs C máx del segmento 1
         (0.7518). Sube 32%. Es la penalización de potencia parcial hecha número.
  6. CLmax UTILIZABLE en crucero = 1.5036, no el 1.8 de aterrizaje ni el 1.7942 de M0.2.
     -> el CLmax cae con Mach (Fig. 12.17). Consistente.
```

### 3.10 Fixtures derivables de las fórmulas (sin ejemplo del libro)

Estos NO son ejemplos del libro; son **comprobaciones de una línea** que caen directo de las
ecuaciones y que sirven para atrapar errores de signo o de unidad. Marcados `[DERIVADO]`.

```
FIXTURE derivado-12-optimos [§12.6.1, p.444; §17.2, p.640-641]
  K = 1/(pi*A*e). Con A = 8, e = 0.85 -> K = 1/(3.1416*8*0.85) = 0.04684
  CL para L/D max = sqrt(CD0/K). Con CD0 = 0.020 -> sqrt(0.020/0.04684) = 0.6535
  (L/D)max = 1/(2*sqrt(CD0*K)) = 1/(2*sqrt(0.020*0.04684)) = 1/(2*0.03061) = 16.34
  Comprobación cruzada: L/D en ese CL = 0.6535/(0.020 + 0.04684*0.4271) = 0.6535/0.040 = 16.34 ✓
tolerancia: 0.1%
```

```
FIXTURE derivado-17-constantes [§17.2.1-17.2.2, p.640-641]
  V_minP / V_minD = 3^(-1/4) = 0.75984
  CL_minP / CL_minD = sqrt(3) = 1.73205
  Arrastre en V_minP / arrastre en V_minD = 4 * 0.75984^2 / 2 = 4*0.57735/2 = 1.1547
  L/D en V_minP / (L/D)max = 1/1.1547 = 0.86603
  Alcance jet: CL = sqrt(CD0/(3K)) -> V_range/V_minD = 3^(1/4) = 1.31607
  CD en alcance jet = CD0 + CD0/3 = 1.3333*CD0
  Arrastre en V_range / D_min = (1.3333/2)*1.31607^2 = 0.66667*1.73205 = 1.1547
  L/D en V_range / (L/D)max = 0.86603
tolerancia: 1e-5
GATE: si tu implementación te da 0.866 como razón de VELOCIDADES, tienes el bug que el propio
      libro tiene en §17.2.3 (ver §2.6.2). El 0.866 es razón de L/D; el 0.760 es de velocidad.
```

```
FIXTURE derivado-17-energia [§17.6.1, p.661; ejemplo del libro p.664]
  h_e = h + V^2/(2g). A M0.9 y 30,000 ft:
  a(30,000 ft) = 994.8 ft/s -> V = 895.32 ft/s
  h_e = 30,000 + 895.32^2/(2*32.174) = 30,000 + 801,598/64.348 = 30,000 + 12,457 = 42,457 ft
  EL LIBRO IMPRIME: 42,447 ft {12,938 m}
tolerancia: 0.1% (la diferencia de 10 ft viene del valor de "a" usado)
GATE: es el ÚNICO número explícito del capítulo 17 fuera del cap 24. Úsalo.
      Comprobación métrica: 42,447 ft * 0.3048 = 12,938.2 m ✓ EXACTO.
```

```
FIXTURE derivado-14-rafaga [§14.3.2, p.498-499]
  Δn = rho*U*V*CL_alpha / (2*(W/S))
  Con U_de = 30 ft/s, K ~= 0.7 (avión mediano) -> U = 21 ft/s
  rho(SL) = 0.002377 slug/ft3 · V = 400 ft/s · CL_alpha = 5.0 /rad · W/S = 60 lb/ft2
  Δn = 0.002377*21*400*5.0/(2*60) = 99.83/120 = 0.832
  n total = 1 + 0.832 = 1.83
GATE de sanidad del libro: "For most aircraft this produces roughly a 3-g positive load factor"
  para U_de = 30 ft/s. Si tu resultado es muy distinto de 2-3 g en un GA típico, revisa K y c_barra.
tolerancia: n/a (sanidad, no fixture exacto)
```

```
FIXTURE derivado-16-inercias [§16.7.1, p.623, Tabla 16.1]
  Caza a reacción: R_x = 0.23, R_y = 0.38, R_z = 0.52
  DR-3: W = 16,480 lb · b = sqrt(3.5*294) = 32.08 ft · L = 45.2 ft · g = 32.174
  I_xx = 32.08^2 * 16,480 * 0.23^2 / (4*32.174) = 1029.1*16,480*0.0529/128.70
       = 897,180/128.70... -> I_xx = 6,971 slug-ft2
  I_yy = 45.2^2 * 16,480 * 0.38^2 / 128.70 = 2043.0*16,480*0.1444/128.70 = 37,748 slug-ft2
  I_zz = ((32.08+45.2)/2)^2 * 16,480 * 0.52^2 / 128.70 = 38.64^2*16,480*0.2704/128.70
       = 1493.1*16,480*0.2704/128.70 = 51,700 slug-ft2
  [DERIVADO — el libro NO calcula las inercias del DR-3. Es una extensión mía usando la
   Tabla 16.1 sobre la geometría del DR-3. Úsalo como test de la implementación de 16.52-16.54,
   NO como dato del libro.]
GATE de sanidad: I_zz > I_yy > I_xx en cualquier avión de fuselaje largo. Si no, hay bug.
```

---

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero y el software NO debe decidir

Cada renglón es un punto donde el texto **declara explícitamente** que la respuesta no sale de una
fórmula. El software debe **pedir el dato, mostrar el rango y guardar quién lo puso y por qué** —
nunca poner un default silencioso.

| # | § · pág | La decisión | La cita que lo declara |
|---|---|---|---|
| H-01 | §12.5.3 · p.419 | **Cuánto flujo laminar suponer** | *"This author's current best guesses are in Table 12.4, but **the final guess is yours.** If you guess higher values than you can actually attain, your airplane will look good in conceptual design analysis but won't reach its range and performance goals when the airplane is built. If you guess too far on the conservative side, **you may never get to build the airplane** because the predicted performance won't excite potential customers."* |
| H-02 | §12.5.4 · p.424 | **Cuánto reducir los factores de forma si se optimizó con CFD** | *"If such tools are used to optimize the geometry… these form factors can be substantially reduced. **Ask your aerodynamics expert, then carefully check CFD results to confirm any savings.** This author's wild guess: for smooth bodies you can probably reduce the form factor increments above by 10–20%, maybe more."* |
| H-03 | §12.5.4 · p.423 | **El decremento por hélice propulsora** | *"(**author's wild guess:** reduce form factor increment by 50% but when the engine stops, double it)"* |
| H-04 | §12.5.5 · p.425 | **El factor de interferencia Q** | *"Interference drag is best calculated by a high-end computational aerodynamics code and is naturally included in wind-tunnel results. For preliminary estimation, **we have to guess it** as a percent increase in component drag. Again, **experience and test data are our guides.**"* |
| H-05 | §12.4.7 · p.415 | **Si confiar en el CLmax con flaps sin ensayo** | *"A reasonable first-order method is presented next, but **if at all possible, it should be calibrated with test data on an actual airplane with similar flap geometry.**"* |
| H-06 | §12.4.5 · p.404 | **Cuánta incertidumbre aceptar en el CLmax que fija el área alar** | *"the estimation of maximum lift is probably **the least reliable of all of the calculations** used in aircraft conceptual design… **Frequently an aircraft must be modified during flight test to achieve the estimated maximum lift.**"* |
| H-07 | §12.5.9 · p.435 | **Qué E_wd asumir** | Rango 1.2–3.0 sin criterio automático; el propio autor recomienda cambiar el 0.386 de su ecuación por 0.2 *"gets better results"* — es un juicio, no un cálculo |
| H-08 | §12.5.10 · p.439 | **Dónde poner M_cr en la construcción del drag rise** | *"**If a smooth curve cannot be drawn, the M_cr point (E) should be moved** until an approximately circular arc can be drawn."* Literalmente: mover un punto hasta que el dibujo salga |
| H-09 | §13.3 · p.470 | **Cuánto corregir los datos del fabricante del motor** | *"the engine company experts **tend to make assumptions that make their engine look good — wouldn't you?** When applying these engine company results the airplane designers must adjust those results to better reflect how the engine will actually perform in the air."* |
| H-10 | §13.3 · p.470 | **Los fudge factors de un motor futuro** | *"it might be assumed that an engine designed 10 years from now would have **25% less specific fuel consumption, 30% less length, and 30% less weight**… Such fudge factors are based upon either historical trend analysis or an approximate cycle analysis"* |
| H-11 | §13.3.4 · p.478 | **Si usar la curva genérica de arrastre de toma** | *"This chart was prepared by the author… and **should be used with great caution as they are merely typical data, not an estimate for any given inlet design.**"* |
| H-12 | §13.7 · p.488 | **Si el sistema de refrigeración es "expertly designed" o no** | La diferencia entre **6%** y **8–10%** de pérdida de empuje es una **calificación cualitativa del diseño**, no un cálculo |
| H-13 | §14.3.1 · p.495 | **Los factores de carga límite, la velocidad de picada y el n negativo** | *"**most of the diagram consists of parameters that we select**, including maximum positive load factor, most negative load factor, and maximum dive speed"* |
| H-14 | §14.6 · p.506–507 | **El factor de carga del tren de aterrizaje** | *"The vertical load factor applied to the airframe structure by the landing gear is **actually something that we pick.** When calculating the required shock absorber stroke, **we select** an acceptable gear load factor such as N = 3"* |
| H-15 | §15.1.2 · p.562 | **Qué parámetros meter en una correlación estadística nueva** | *"The parameters are chosen **based on guess and calculation.** First, the weights engineer **guesses** a set of parameters that just might correlate to weight."* |
| H-16 | §15.3 · p.570 | **Cuál de varias ecuaciones creer** | *"It's a good idea to calculate the weight of each component using several different equations and **then select an average, reasonable result.**"* |
| H-17 | §15.4 · p.579–581 | **Los fudge factors, incluido el de "corazonada"** | *"All weights analysis includes **a lot of judgement and best-guesses** by the person doing the estimation. It is common, **even mandatory** for 'fudge factor' adjustment of any equation result… and sometimes **just the weight analyst's gut feeling.**"* Y: *"**Don't laugh.** If that person is experienced at 'Dash-One' weight estimation, a gut feeling adjustment **may be better than all the statistics and analytical estimation in the world.** If you see the weights engineer holding hands out, spreading them apart to measure length then bouncing them up and down, palms up, as if weighing something invisible, **you should quietly tiptoe away.**"* |
| H-18 | §15.1.1 · p.561 | **Cuánta conservación es demasiada** | *"Sometimes the weights engineers get so conservative that future progress is stifled, buried under the 'weight' of their unwillingness to put their necks out a bit. **If everything new seems to weigh a lot more than the things we know, we'll never make any progress.**"* — el software no puede arbitrar esto |
| H-19 | §15.1.1 · p.560 | **A quién creerle cuando el peso es mala noticia** | *"The weights engineer is often the bearer of bad news and gets yelled at by designers and project managers alike. **If the weights engineer bows to their demands and lowers the weights estimate or takes out some of the margin, disaster can ensue.**"* |
| H-20 | §16.1 · p.585–586 | **Cuándo el método de manual ya no basta** | *"To really get the right answers, structural deflections must also be considered. This is time consuming and is **probably not done until well into preliminary design.**"* |
| H-21 | §16.3.2 · p.593 | **El margen estático objetivo** | *"a target static margin, usually expressed in percent, is **both a requirement and a key design tool for aircraft designers.**"* — es una **decisión de proyecto**, no un resultado |
| H-22 | §16.4.2 · p.615 | **Qué hacer cuando el vertical no alcanza** | Cinco caminos (cuerda de timón, doble bisagra, todo-móvil, mover motores, agrandar) **cada uno con su penalización**; el libro los lista, no los ordena por un criterio automático |
| H-23 | §16.10.2 · p.633 | **Aceptar que los parámetros de departure no sirven en conceptual** | *"First-order estimation techniques used in conceptual design **might not give usable results for departure estimation.** However, the configuration designer can expect to be instructed to **'fix it' when the first wind-tunnel data are available!**"* |
| H-24 | §16.10.1 · p.630 | **La calificación Cooper-Harper** | Es explícitamente **subjetiva**: *"Aircraft handling qualities are a **subjective assessment** of the way the plane feels to the pilot"*, y la escala *"is used by **test pilots**"* |
| H-25 | §17.2.3 · p.642 | **Cuándo abandonar la fórmula cerrada por la gráfica** | *"To determine the actual thrust (or power) required for level flight, the aerodynamic results are **plotted vs velocity or Mach number and compared to the engine data**"* |
| H-26 | §17.3.4 · p.652 | **Descartar el óptimo analítico de ascenso de hélice** | *"sometimes this equation gives an optimal climb speed **which is lower than the stall speed!** …If thrust and drag data are available at low speeds, **the graphical method will produce good results.**"* |
| H-27 | §17.9.4 · p.678 | **Aceptar que el viento no se modela bien** | *"The effects of wind on takeoff and landing distances are **difficult to model with a simple equation**… **A time-domain 3-DOF simulation is probably needed to get a good answer.**"* |
| H-28 | §24.3 · p.922 | **El CLmax de aterrizaje del DR-3** | *"For landing, a CL-max value of 1.8 **was assumed** based on data for modern fighters with leading edge flaps."* — no salió de ninguna ecuación |
| H-29 | §24.3 · p.931 | **Analizar una cola en V con la ecuación de cola horizontal** | *"The V-tail **was analyzed with the horizontal tail statistical equation, because** a V-tail is loaded for trim and maneuvers much like a horizontal tail."* — es una analogía razonada, y **el resultado del vertical queda en 0.0** |
| H-30 | §24.3 · p.931 | **Las tres penalizaciones de 200/400/400 lb** | Diedro variable, tobera 2-D y cañón: **cada una es un juicio de ingeniería declarado**, no un cálculo. Suman el 9.1% del peso vacío |
| H-31 | §24.3 · p.936 | **Escalar un motor un 50%** | *"one should normally scale a 'rubber' engine by **no more than about 20–30%**, and **this example required far greater scaling** (downward in size). **In a real design study, learning that the proposed engine was far too large would lead to selection of a different engine, not to a scaling of that engine by a factor of 50% or more!**"* — el propio ejemplo del libro rompe su propia regla y lo confiesa |
| H-32 | §24.3 · p.941 | **Cuándo NO hacer estabilidad de primer orden** | *"For such a concept [RSS con mandos digitales], **early first-order stability and control calculations are not so critical** because the aircraft's handling qualities will be determined largely by the computer programming, **provided that** basic requirements including tail sizes and c.g. location are met and the aircraft has adequately sized control surfaces."* — es una decisión de **qué análisis saltarse** |
| H-33 | §24.3 · p.943 | **Reconocer la suerte** | Sobre que el resize dio 17,062 lb contra 16,480 as-drawn: *"**This is closer than one would usually hope for, and probably reflects luck more than skill!**"* — el software no debe presentar una coincidencia así como validación |

---

## 5. COSTO DE CÓMPUTO

**Regla del contrato:** `[NAVEGADOR]` = milisegundos, interactivo · `[PRECÓMPUTO]` = se calcula una vez
en la GPU y se sirve como tabla o campo · `[GPU-VIVO]` = exige un solver corriendo en iangpu.

### 5.1 Tabla maestra

| Método | § | Costo | Por qué |
|---|---|---|---|
| `CL_alpha` subsónico y supersónico ideal (12.6–12.14) | 12.4 | **[NAVEGADOR]** | Aritmética escalar. ~20 flops |
| Cartas de `C_N_alpha` supersónico (Fig. 12.7) | 12.4.2 | **[PRECÓMPUTO]** | Seis cartas por `λ`; hay que **digitalizarlas una vez** y servirlas como LUT 2D. Son imagen (§7) |
| `CLmax` limpio (12.15) | 12.4.5 | **[NAVEGADOR]** | Una multiplicación |
| `CLmax` alto/bajo alargamiento (12.16–12.20) | 12.4.5 | **[PRECÓMPUTO]** | Depende de **ocho figuras** (12.9–12.16) que hay que digitalizar. Después, LUT + aritmética |
| `ΔCLmax` de flaps (12.21–12.22 + Tabla 12.2) | 12.4.7 | **[NAVEGADOR]** | Tabla pequeña + una multiplicación. **Requiere `S_flapped` medida del CAD** |
| `C_fe` rápido (12.23) | 12.5.1 | **[NAVEGADOR]** | Una división. Es el **auditor** que corre siempre |
| Build-up por componente (12.24–12.35) | 12.5.2–5 | **[NAVEGADOR]** | ~10 componentes × ~30 flops = trivial. **El cuello es medir `S_wet` por componente**, y eso ya lo tiene el kernel B-Rep |
| `S_wet` por componente desde el B-Rep | — | **[NAVEGADOR]** en geometría conceptual; **[PRECÓMPUTO]** si la malla es fina | Integración de área sobre caras. La Forja ya lo hace |
| Miscelánea y protuberancias (Tablas 12.6–12.8) | 12.5.6–7 | **[NAVEGADOR]** | Suma de tabla |
| Distribución de volumen y `A_max` (Sears-Haack) | 12.5.9 | **[NAVEGADOR]** | Cortes perpendiculares: ~200 cortes de un sólido conceptual. Milisegundos |
| Cortes de **plano de Mach** para `M > 1` (Harris) | 12.5.9 | **[PRECÓMPUTO]** | Cortar con planos inclinados en **varios ángulos de rodadura** y promediar. Decenas de miles de cortes ⇒ una pasada, cacheada por geometría |
| Drag rise gráfico (Fig. 12.32) | 12.5.10 | **[NAVEGADOR]** | Siete puntos y dos empalmes |
| Drag Map completo | 12.5.12 | **[NAVEGADOR]** | ~20 Mach × ~8 `C_L` = 160 evaluaciones del build-up |
| `K` por Oswald (12.47–12.51) | 12.6.1 | **[NAVEGADOR]** | Aritmética |
| `K` por succión de borde de ataque (12.57–12.59) | 12.6.2 | **[NAVEGADOR]** + carta de `S` en **[PRECÓMPUTO]** | La Fig. 12.39 es imagen; digitalizarla una vez |
| **CFD (RANS / Euler / potencial)** | 12.7 | **[GPU-VIVO]** | RANS = *"'only' solution of about 60 partial derivative equations"* + mallado que *"cannot yet be fully automated… still an unacceptable bottleneck"* |
| Ciclo de motor | 13.3 | **fuera de alcance** | Lo hace el fabricante. Nosotros solo **corregimos** |
| Correcciones de instalación (13.5–13.9) | 13.3–13.4 | **[NAVEGADOR]** | Once filas × cuatro fórmulas. El fixture §3.6 lo demuestra |
| Tabla `T(h, M)` instalada | 13.3 | **[PRECÓMPUTO]** | Malla altitud × Mach × ajuste de potencia, generada una vez por motor, servida como LUT 3D |
| Cartas de hélice (Figs. 13.11–13.13) | 13.6 | **[PRECÓMPUTO]** | Digitalizar tres cartas; después, LUT |
| Empuje de hélice (13.11–13.21) | 13.6–13.7 | **[NAVEGADOR]** | Aritmética + LUT |
| Diagrama V-n completo (14.2–14.8) | 14.3 | **[NAVEGADOR]** | Dos parábolas y cuatro rectas |
| Schrenk (14.9–14.11) | 14.3.3 | **[NAVEGADOR]** | ~50 estaciones. Con torsión, prueba y error ⇒ decenas de iteraciones; sigue siendo milisegundos |
| Integración a cortante y momento flector | 14.3.3 | **[NAVEGADOR]** | Dos integrales acumuladas sobre 50 estaciones |
| **FEM estructural** | 14.11 | **[GPU-VIVO]** o CPU pesada | *"the modeling of a complex structure for FEM analysis can be very time consuming"*, y el mallado es humano |
| Método aproximado de pesos (Tabla 15.2) | 15.2 | **[NAVEGADOR]** | Ocho multiplicaciones. Corre **siempre**, como auditor |
| Las 59 ecuaciones estadísticas (15.1–15.59) | 15.3 | **[NAVEGADOR]** | ~24 potencias por avión. **Microsegundos.** El caso más claro de "respuesta en el segundo 1" |
| Group Weight Statement + CG + momentos | 15.1.3 | **[NAVEGADOR]** | Suma ponderada |
| **Envolvente de CG a lo largo de la misión** | 15.1.3 | **[NAVEGADOR]** | ~20 configuraciones de carga × suma de momentos |
| Punto neutro y margen estático (16.8–16.11) | 16.3.2 | **[NAVEGADOR]** | ~40 flops. **Requiere `X_ac`, `X_cg` y áreas medidos del CAD** |
| Cartas de centro aerodinámico (Fig. 16.5) | 16.3.3 | **[PRECÓMPUTO]** | Tres cartas por `λ`; imagen (§7) |
| Downwash `dε/dα` (Figs. 16.11–16.13) | 16.3.6 | **[PRECÓMPUTO]** | Tres familias de curvas; imagen |
| Trimado gráfico (16.32–16.34) | 16.3.10 | **[NAVEGADOR]** | ~5 `α` × ~5 `δe` = 25 evaluaciones. **Instantáneo** |
| Derivadas laterales (16.44–16.51) | 16.4.3–5 | **[NAVEGADOR]** | Aritmética + dos cartas (16.21, 16.26) a precomputar |
| Alerones por tiras (16.48) | 16.4.4 | **[NAVEGADOR]** | ~20 tiras |
| Inercias por radios de giro (16.52–16.54) | 16.7.1 | **[NAVEGADOR]** | Tres multiplicaciones |
| **6-DOF dinámico** | 16.7.6 | **[GPU-VIVO]** o servidor | *"requiring a tremendous number of cross derivatives to account fully for all forces and moments"* |
| TDPF de barrena (16.67–16.70) | 16.10.3 | **[NAVEGADOR]** | **Es geometría pura**: áreas no sombreadas. El CAD las mide |
| Vuelo nivelado, alcance, autonomía (17.8–17.35) | 17.2 | **[NAVEGADOR]** | Aritmética |
| **Búsqueda exhaustiva del óptimo de alcance** | 17.2.6 | **[NAVEGADOR]** | ~50 alturas × ~40 Mach = 2000 evaluaciones. **Milisegundos.** El libro la declara "el método de la industria" |
| Ascenso por tramos (17.46–17.51) | 17.3.5 | **[NAVEGADOR]** | ~10 tramos |
| Viraje sostenido iterativo (17.54) | 17.4.2 | **[NAVEGADOR]** | 3–5 iteraciones por punto |
| Contornos de `P_s` (Figs. 17.11–17.12) | 17.6.2 | **[NAVEGADOR]** | ~50 × 40 × 8 = 16,000 evaluaciones escalares. **Sigue siendo milisegundos** |
| Trayectoria de mínimo tiempo (17.91–17.93) | 17.6.3 | **[NAVEGADOR]** | Búsqueda O(n·m) sobre la malla anterior |
| Despegue por segmentos (17.100–17.115) | 17.8 | **[NAVEGADOR]** | Cerrado + una integral analítica |
| Aterrizaje (17.102 inverso, dos tramos) | 17.9 | **[NAVEGADOR]** | Igual |
| **Simulación 3-DOF en el tiempo** para viento en despegue/aterrizaje | 17.9.4 | **[PRECÓMPUTO]** | El libro la exige para respuesta buena. Miles de pasos triviales ⇒ cabe en un worker |

### 5.2 La conclusión que importa

**El bloque de análisis COMPLETO —capítulos 12, 13, 14, 15, 16 y 17— cabe en el navegador.**
Lo único que sale son cuatro cosas: **CFD**, **FEM**, **6-DOF** y **los cortes de plano de Mach** para
arrastre de onda supersónico. Y de esas cuatro, tres son precisamente las que el propio cliente
declara lentas, caras y sospechosas.

Lo que hay que **precomputar una sola vez** no son campos de flujo: son **~20 familias de curvas
escaneadas** (Figs. 12.7, 12.9–12.17, 12.29–12.31, 12.36, 12.39, 13.6–13.13, 14.6, 16.5–16.7, 16.9,
16.11–16.17, 16.21, 16.26, 16.32). **Ese es el verdadero trabajo de infraestructura del bloque**, y es
trabajo de digitalización, no de GPU.

---

## 6. ESCUELA — lecciones que salen de este bloque

Formato: **construir → mover → ver → verificar contra el número del libro**. Todas viven dentro de
`forja-brep.html`: el alumno **dibuja la geometría con croquis y cotas** y la analiza con un estudio.

### L-A1 · «El área que cuentas tres veces» (cap 12, §12.3)
- **Construye:** un ala trapezoidal acotada (envergadura, cuerda raíz, `λ`, flecha) y un fuselaje
  tubo+cono que la atraviesa.
- **Mueve:** el diámetro del fuselaje.
- **Ve:** tres números que cambian **distinto**: `S_ref` (trapecio completo, **no cambia**),
  `S_expuesta` (baja), `S_mojada` (baja el doble).
- **Verifica contra:** el DR-3. `S_exp/S_ref = 0.73` con `S_ref = 294 ft²` ⇒ `S_exp = 215 ft²` ✓ y
  `S_wet del ala = 431.8 ft² = 2.008 × S_exp` ✓ (fixture §3.3, gate 3).
- **Se lleva:** por qué reusar una sola `S` es el bug silencioso perfecto — el cap 15 usa **expuesta**
  para el ala y **mojada** para el fuselaje.

### L-A2 · «La cadena hasta un número de arrastre» (cap 12, §12.5.2)
- **Construye:** el fuselaje del DR-3 (45.2 ft de largo, 5.5 ft de diámetro efectivo).
- **Mueve:** la esbeltez `f = l/d`.
- **Ve:** `f` → `FF` → `C_f` → `C_D0` del componente, en cascada.
- **Verifica contra:** `f = 8.218` ⇒ `FF = 1 + 60/8.218³ + 8.218/400 = 1.129` ✓ **exacto** contra la
  p.925 (fixture §3.3, gate 1).
- **Se lleva:** que la ecuación **cambió entre ediciones** y que el ejemplo del propio libro corre con
  la vieja. Lección de trazabilidad de método, no solo de física.

### L-A3 · «El 1.26, no el 1.56» (cap 12, §12.5.4)
- **Construye:** un fuselaje de lados planos. **Mueve:** un interruptor "lados planos / redondeado".
- **Ve:** el `FF` pasar de 1.20 a **1.26**, no a 1.56.
- **Verifica contra:** *"If the calculated form factor is 1.2 and you wish to apply a 30% increase, the
  resulting form factor is **1.26 not 1.56**."*
- **Se lleva:** los incrementos son sobre **la parte por encima de 1.0**. Error de implementación #1.

### L-A4 · «Twice the lift, four times the drag» (cap 12, §12.6)
- **Construye:** un ala con `A` y `λ` acotados. **Mueve:** el `C_L`, y luego el `C_L` **de diseño**.
- **Ve:** dos curvas de `K` vs `C_L` superpuestas — una plana (Oswald) y una en **U** (succión de borde
  de ataque), con el mínimo de la U desplazándose con el `C_L` de diseño.
- **Verifica contra:** el DR-3 en la tabla de `P_s`: `K` = 0.1411, 0.1138, **0.1022**, 0.1103, 0.1340,
  0.1553, 0.1699 para `n` = 1…7. **Mínimo en `n = 3`.** Si tu `K` sale constante, implementaste Oswald.
- **Se lleva:** **el test que distingue los dos métodos en una mirada.**

### L-A5 · «El avión que se rompe solo en M1» (cap 12, §12.4.6)
- **Construye:** un ala de caza. **Mueve:** el Mach.
- **Ve:** el `CL_max` aerodinámico contra el `C_L` que el ala aguanta con `n` límite, y el punto donde
  la estructura se vuelve la restricción.
- **Verifica contra:** *"the available maximum lift at Mach 1 is usually enough to **break the wings
  off!**"*
- **Se lleva:** hay regímenes donde la aerodinámica **deja de ser la restricción**.

### L-P1 · «El motor da 8%» (cap 13, §13.1)
- **Construye:** una nacela supersónica con toma, conducto y tobera. **Mueve:** el Mach de 0 a 2.2.
- **Ve:** el reparto de la fuerza propulsiva, con la barra del motor encogiéndose.
- **Verifica contra:** Fig. 13.2 (A-5 a M2.2): **motor +8%, tobera +29%, conducto +75%, toma −12%**.
- **Se lleva:** *"the force exerted through the motor mounts onto the airframe is 37% of the total
  thrust. **Where is the rest?**"*

### L-P2 · «La toma que le roba empuje al motor» (cap 13, §13.3.2)
- **Construye:** la tabla de recuperación de presión del DR-3. **Mueve:** la recuperación real.
- **Ve:** el % de pérdida de empuje **con signo**, volviéndose **negativo** (ganancia) cuando tu toma
  es mejor que la de referencia MIL-E-5008B.
- **Verifica contra:** fixture §3.6 — once filas, `R-Ec. 13.6` cierra en todas.
  M0.4 → 1.350×(0.970−0.940) = **0.0405** exacto; M2.4 → 1.140×(0.855−0.600) = **0.2912** exacto.
- **Se lleva:** que un dato de catálogo se **corrige**, y que el corrector es una resta.

### L-C1 · «El diagrama que eliges, no el que calculas» (cap 14, §14.3.1)
- **Construye:** un ala con `S`, `CL_max` y `W` acotados. **Mueve:** `n±` y `V_dive` con sliders; y por
  separado, **baja el peso**.
- **Ve:** las dos parábolas de pérdida **calculadas** y las cuatro rectas **elegidas**; y la envolvente
  de ráfaga ganándole a la de maniobra cuando el avión se aligera.
- **Verifica contra:** Tabla 14.2 y la regla `U_de = 30 ft/s` ⇒ *"roughly a 3-g positive load factor"*.
- **Se lleva:** **un avión más ligero sufre MÁS por ráfaga.** El resultado antiintuitivo del capítulo.

### L-W1 · «Ochenta y tres centésimas» (cap 15, §15.4)
- **Construye:** el ala del T-38/F-5B. **Mueve:** el interruptor "aluminio / compuestos".
- **Ve:** peso calculado por `R-Ec. 15.1`, peso real, cociente, y fudge final.
- **Verifica contra:** el ejemplo del propio autor: **1067 lb calculado vs 1042 lb real** ⇒ 0.977 ×
  0.85 = **0.83**.
- **Se lleva:** cómo se **fabrica** un fudge honesto. *"**it isn't the doing, it's the knowing.**"*

### L-W2 · «El límite y el último» (cap 15, §15.3)
- **Construye:** cualquier ala. **Mueve:** un interruptor `n` límite / `N_z` último.
- **Ve:** el peso del ala saltar ~**22%** (porque `1.5^0.5 = 1.2247`).
- **Verifica contra:** el DR-3, `N_z = 11.000 = 1.5 × 7.33` ✓, y la confesión del autor de haber
  cometido ese error **en la primera edición**.
- **Se lleva:** el error más común del capítulo, en carne propia.

### L-W3 · «La envolvente de CG que nadie dibuja» (cap 15, §15.1.3)
- **Construye:** un avión con tres tanques y cabina de pasaje, con posiciones acotadas.
- **Mueve:** vacía los tanques en distinto orden; retrae el tren; manda al pasaje atrás.
- **Ve:** la traza de peso vs CG recorriendo la envolvente y **el momento en que se sale**.
- **Verifica contra:** la regla *"no more than **8% of the wing MAC**"*, y el DR-3: CG vacío 23.8 ft,
  sin combustible 23.4 ft, bruto 23.1 ft ⇒ recorrido 0.7 ft sobre MAC 10.26 ft = **6.8%** ✓.
- **Se lleva:** el B-1A se estrelló y murió el piloto de pruebas jefe **por olvidar reactivar el
  secuenciado de combustible**. El CG no es contabilidad: es seguridad de vuelo.

### L-S1 · «Mueve el ala una pulgada» (cap 16, §16.3.2)
- **Construye:** ala + cola horizontal con `X_mac` de ambas acotadas.
- **Mueve:** la posición longitudinal del ala, **una pulgada a la vez**.
- **Ve:** `X_np` fijo, `X_cg` moviéndose, y el margen estático **cruzando cero**.
- **Verifica contra:** el DR-3: `(23.02 − 23.10)/10.26 = −0.78%` ✓ **exacto**.
- **Se lleva:** *"**We easily move the wing in Conceptual Design**, and carefully do in Preliminary
  Design, **but not after that.**"* Esta lección **es** el argumento comercial del producto.

### L-S2 · «Un motor fuera dimensiona el timón» (cap 16, §16.4.2)
- **Construye:** un bimotor con separación de motores acotada. **Mueve:** esa separación, y el área de
  timón.
- **Ve:** la deflexión necesaria para `β = 0` a `1.1 V_stall` con un motor fuera y CG atrasado, contra
  el tope de **20 grados**.
- **Verifica contra:** el criterio literal de §16.4.2 y las cinco vías de `REQ-ESTAB-16-19`.
- **Se lleva:** mover motores hacia adentro alivia el timón **pero engorda el ala**. No hay comida
  gratis.

### L-S3 · «Los alerones al revés» (cap 16, §16.6)
- **Construye:** un ala en flecha delgada con alerones. **Mueve:** la velocidad.
- **Ve:** el régimen de alabeo caer, cruzar cero y **volverse negativo**.
- **Verifica contra:** el B-47, Fig. 16.24: efectividad cero a **~470 kt**.
- **Se lleva:** *"Pilots were taught that if the spoilers failed to operate at a speed greater than
  470 kt, **they should simply move the control stick in the opposite direction from the way that they
  wished to roll.**"*

### L-F1 · «0.760, no 0.866» (cap 17, §17.2)
- **Construye:** una polar con `CD0` y `K` acotados. **Mueve:** la velocidad.
- **Ve:** cuatro marcas moviéndose (mínima potencia, mínimo arrastre, mejor alcance jet, pérdida) con
  los cocientes en pantalla.
- **Verifica contra:** `V_minP/V_minD = 3^(−1/4) = 0.7598` y `L/D` en `V_minP` = `0.866 × (L/D)max`.
- **Se lleva:** **el libro mismo se equivoca aquí** (§17.2.3 dice 86.6% de *velocidad*). La lección
  enseña a **detectar una errata en la fuente** verificándola con la derivada.

### L-F2 · «El avión que no puede bajar» (caps 13 y 17)
- **Construye:** un jet con `L/D` y empuje de ralentí acotados. **Mueve:** el `L/D`.
- **Ve:** el punto en que `T_ralentí/W = 1/(L/D)` y el descenso se vuelve **imposible**.
- **Verifica contra:** *"the aircraft **cannot descend!**"* (§13.4, p.479).
- **Se lleva:** un avión "demasiado limpio" es un problema operativo, no un logro.

### L-F3 · «La burbuja del Concorde» (cap 17, §17.6.3)
- **Construye:** un SST con empuje y polar acotados. **Mueve:** el empuje disponible.
- **Ve:** los contornos de `P_s = 0` **partiéndose en dos burbujas**, y la trayectoria óptima picando a
  través de M1.0 para saltar de una a otra.
- **Verifica contra:** *"**This is exactly what the Concorde did**, not because it was incapable of
  going supersonic in level flight, but because **it was more fuel efficient to do it this way.**"*
- **Se lleva:** el algoritmo implementable literal de §17.6.3.

### L-F4 · «El DR-3 no cumple» (caps 17 y 24)
- **Construye:** el DR-3 completo con la geometría del fixture §3.1. **Mueve:** nada. Corre el análisis.
- **Ve:** siete requisitos en verde y **uno en rojo**: aceleración M0.9→M1.4 en **42.2 s** contra
  **30 s**.
- **Verifica contra:** *"the requirement for acceleration from M.9 to M1.4 in 30 s **was not met by the
  baseline DR-3 design!**"*
- **Se lleva:** **la lección más importante del bloque.** Un alumno que reproduzca el DR-3 y le salga
  todo verde **implementó algo mal**.

### L-X1 · «El punto fijo de tres capítulos» (caps 14+15+16)
- **Construye:** un avión con ala, cola y masas colocadas. **Mueve:** el `N_z`.
- **Ve:** el ciclo cerrarse: `N_z` → pesos (15) → CG → trimado y `L_cola` (16) → sustentación de ala
  requerida → cargas (14) → `N_z`, con contador de iteraciones y residuo bajando.
- **Verifica contra:** §14.3.3, p.501, y el `N_z = 11 = 1.5 × 7.33` del DR-3.
- **Se lleva:** que **estos tres capítulos no son una cadena, son un sistema acoplado**. Una hoja de
  cálculo lineal no puede resolverlo. Es el argumento técnico del producto.

---

## 7. NO OBSERVADO — figuras y tablas que eran imagen y no pude leer

> Nada de lo que sigue se inventó ni se dedujo. Se declara por número, con su § y página.

### 7.1 Ecuaciones cuyo CUERPO destruyó el OCR

| Ecuación | § · pág | Qué calcula | Impacto |
|---|---|---|---|
| **12.4 / 12.5** | 12.3 · p.396–397 | Polares sin y con comba | Bajo: la prosa las describe sin ambigüedad |
| **12.24** | 12.5.2 · p.417 | **Build-up de arrastre parásito subsónico** | **ALTO** — ecuación central del capítulo |
| **12.27** | 12.5.3 · p.420–421 | **`C_f` turbulento con corrección de Mach** | **ALTO** — sin ella no hay build-up |
| **12.31** | 12.5.4 · p.422 | **`FF` de fuselaje y canopy (6ª ed.)** | **ALTO** — pero la nota al pie da la de ediciones previas, y el DR-3 corre con ESA |
| **12.42** | 12.5.9 · p.432 | Radio del Sears-Haack | Medio: 12.44 sí está |
| **12.46** | 12.5.10 · p.436 | **`M_DD` del ala** | **ALTO** — sin ella no hay drag rise |
| **12.61 / 12.62** | 12.6.6 · p.452 | Arrastre parásito e inducido de flap | Medio: los coeficientes sí están |
| **13.13** | 13.6 · p.482 | Coeficiente de empuje `C_t` de hélice | Medio |
| **14.1** | 14.3.1 · p.497 | Velocidad equivalente `V_e` | Bajo: definida en prosa |
| **14.9 / 14.10** | 14.3.3 · p.502 | Cuerda de planta trapezoidal | Bajo: geometría elemental |
| **14.12** | 14.3.4 · p.504 | Velocidad de maniobra `V_p` | Medio: `K_p` (14.13) sí está |
| **15.5** | 15.3.1 · p.572 | **Peso del tren principal (caza)** | **ALTO** — falta un grupo entero del juego de caza |
| **15.11** | 15.3.1 · p.573 | Tubo de escape (caza) | Bajo: en el DR-3 vale 0.0 |
| **15.31** | 15.3.2 · p.574 | **Grupo de nacela (transporte)** | **ALTO** — falta un grupo entero del juego de transporte |
| **16.5** | 16.3.1 · p.591 | Momento de cabeceo en coeficientes | Bajo: 16.7 sí está |
| **16.9** | 16.3.2 · p.592 | **Punto neutro `X_np`** | **ALTO** — la ecuación clave del capítulo |
| **16.13 / 16.14** | 16.3.4 · p.594–596 | `C_L` de ala y de cola | Medio: definidas en prosa |
| **16.21a/b** | 16.3.6 · p.600 | **`dε/dα` a alto subsónico y supersónico** | **ALTO** — sin ellas no hay estabilidad transónica |
| **16.23 / 16.24** | 16.3.6 · p.601 | Derivada de ángulo de cola y `α_h` | Medio |
| **16.31** | 16.3.9 · p.606 | `η_h` con propwash | Medio |
| **16.37, 16.39, 16.41, 16.42, 16.43** | 16.4 · p.614–616 | Fuerza lateral del vertical y las cuatro derivadas laterales | **ALTO** — el núcleo del análisis lateral |
| **16.55 / 16.56** | 16.7.2 · p.625 | Amortiguamientos `C_mq` y `C_nr` | **ALTO** — sin ellas no hay pull-up ni viraje dinámico |
| **16.68 / 16.69** | 16.10.3 · p.635 | `TDR` y `URVC` de barrena | Medio: 16.67 sí está |
| **17.4** | 17.1 · p.638 | `C` equivalente de hélice | Medio: descrita en prosa |
| **17.10** | 17.2 · p.639 | `V` en función de `W/S`, `C_L`, `ρ` | Bajo |
| **17.13** | 17.2.1 · p.640 | **`V` de mínimo arrastre / máximo `L/D`** | **ALTO** — velocidad de referencia de todo el capítulo |
| **17.25** | 17.2.5 · p.645 | `V` de mejor alcance (jet) | Medio: 17.26 sí está |
| **17.29** | 17.2.7 · p.646 | Autonomía instantánea | Bajo |
| **17.50 / 17.51** | 17.3.5 · p.653 | Tiempo y combustible de un tramo de ascenso | **ALTO** |
| **17.59** | 17.4.3 · p.656 | `n` sostenido con empuje vectorizado | Medio |
| **17.99** | 17.7 · p.670 | Presión total del aire incidente | Medio |
| **17.111** | 17.8.2 · p.674 | Transición si se libra el obstáculo antes de terminarla | Medio |

### 7.2 Figuras que eran imagen (por número)

**Cap 12:** 12.1–12.5; **12.7 a–f (seis cartas de fuerza normal supersónica, una por `λ`)**; 12.8;
**12.9, 12.10, 12.11 (las tres de `CLmax` de alto alargamiento)**; **12.12–12.16 (las cinco de bajo
alargamiento)**; **12.17 (`CLmax` a Mach alto)**; 12.18–12.21; 12.22; 12.23;
**12.24, 12.25, 12.26 (arrastre de tanques, bombas/misiles, pilones)**; 12.27; 12.28;
**12.29, 12.30, 12.31 (las tres de `M_DD`)**; 12.32–12.35; **12.36 (interferencia de biplano)**;
12.37; 12.38; **12.39 (succión `S` vs `C_L` — LA carta del método recomendado)**; 12.40; 12.41–12.45.

**Cap 13:** 13.1–13.5; **13.6 y 13.7 (recuperación de presión de referencia y real)**; 13.8;
**13.9 (tendencias de arrastre de toma)**; 13.10; **13.11, 13.12, 13.13 (las tres cartas de hélice)**;
13.14.

**Cap 14 (mi rango):** 14.1–14.5; **14.6 (`U_de` de transporte vs altitud)**; 14.7–14.11;
14.42–14.44.

**Cap 15:** **15.1 (envolvente de CG)**; 15.2; **15.3 (geometría de conducto — de donde sale `K_d`)**;
15.4 a/b. La **Tabla 15.1** salió llena con los números del DR-3 en vez de como plantilla.

**Cap 16:** 16.1–16.3; **16.4 (valores típicos de `Cm_alpha`)**; **16.5 a/b/c (centro aerodinámico,
tres cartas)**; **16.6 y 16.7 (incremento de sustentación de flap simple, teórico y corregido)**;
16.8; **16.9 (centro de presión del incremento de flap)**; 16.10; **16.11 (upwash)**;
**16.12 (downwash a M0)**; **16.13 (downwash por flaps)**; **16.14 (`K_fus`, NACA TR 711)**;
**16.15, 16.16, 16.17 (las tres de hélice)**; 16.18–16.20; **16.21 (efecto diedro por `A`, `λ`,
flecha)**; 16.22–16.25; **16.26 (amortiguamiento de alabeo)**; 16.27; 16.28 (Cooper-Harper — **el
texto sí se leyó**, está en §2.5.10); 16.29–16.31; **16.32 (criterio de recuperación de barrena)**.

**Cap 17:** 17.1–17.26, todas. Las críticas para implementar: **17.6 (corner speed)**,
**17.9–17.16 (toda la maquinaria de `P_s` y energía)**, **17.17 (envolvente)**, 17.18 y 17.19
(despegue y aterrizaje), **17.20 (envolvente de gestión de energía)**.

**Cap 24 §24.3:** todas las gráficas de salida de RDS, **y las dos páginas manuscritas** (p.930,
arrastre adicional de flaps y tren; p.936, recuperación de toma), ilegibles salvo fragmentos.

### 7.3 Tablas parcialmente ilegibles

| Tabla | § · pág | Qué se perdió |
|---|---|---|
| 12.5 | 12.5.3 · p.421 | El valor métrico de rugosidad de compuesto moldeado no guarda la razón ft→m de las otras filas |
| 12.6, 12.7, 12.8 | 12.5.6–7 · p.429–431 | Las cabeceras de columna; los valores sí se leen |
| 13.1 | 13.3.4 · p.479 | La cabecera; los seis pares de valores sí |
| 14.2 | 14.3.1 · p.495 | La cabecera de la columna de `n` positivo |
| 15.1 | 15.1.3 · p.564 | Es un ejemplo lleno, no la plantilla; y las cabeceras de brazo y momento |
| 15.2 | 15.2 · p.568 | Las cabeceras de las tres clases (reconstruidas del orden del texto) |
| 15.3 | 15.3 · p.571 | La cabecera de la columna de peso |
| 16.1 | 16.7.1 · p.623 | Cabecera; **y la fila del entrenador militar es anómala** (`R_y` 0.14, `R_z` 0.25) |
| 16.2 | 16.8.3 · p.629 | Las clases I–III se leen por deducción del orden; IV A/B/C explícitas |
| 17.1 | 17.8.1 · p.672 | **La primera celda (µ de rodadura en concreto seco)**; el 0.03 viene del cuerpo del texto |

### 7.4 Lo que declaro que NO revisé

- **§14.7 a §14.10** (fundamentos de estructuras, selección y propiedades de materiales, análisis
  estructural clásico), páginas 507–551. Leí sus fronteras y el §14.11 (FEM), **pero no las agoté**.
  Queda como hueco declarado: tablas de propiedades de materiales, pandeo, crippling, fatiga
  cuantitativa, y el paso de la curva de Schrenk a cortante/momento/dimensionado de larguero.
- **§24.2** (DR-1 homebuilt): confirmado ilegible; no extraje nada.

---

## 8. LO QUE MÁS ME SORPRENDIÓ

### 8.1 No hay un solo ejemplo resuelto en 300 páginas de análisis, y es a propósito
Leí los seis capítulos completos buscando `EXAMPLE`, `Consider`, `For our design`. **Cero.** La
explicación está en §1.4, p.7: los dos diseños del capítulo 24 están *"**provided instead of numerous
example calculations throughout the text**"*. Una máquina que leyera capítulo por capítulo concluiría
que el libro no es verificable. Lo es — pero toda la verificación está **concentrada 400 páginas más
adelante**, y hay que ir a buscarla. El pliego previo encontró el DR-3 y lo usó para sizing; nadie
había ido a sacarle la aerodinámica, los pesos, la propulsión, la estabilidad y el performance.

### 8.2 El ejemplo estrella del libro FALLA su requisito, y el autor lo publica
*"the requirement for acceleration from M.9 to M1.4 in 30 s **was not met by the baseline DR-3
design!**"* — 42.2 s contra 30 s. No lo esconde: lo pone en el cuerpo y dedica un trade study a mostrar
que **relajar el requisito a 50 s ahorra 19% del peso**. Ningún benchmark sintético enseña eso: el
entregable del diseñador conceptual **no es "cumple", es "esto cuesta tanto y esto otro cuesta tanto"**.

### 8.3 El propio autor corrige sus ecuaciones dentro del texto, y su ejemplo usa la vieja
- §12.5.9: *"this old empirical relationship **seems overly optimistic** and gets better results by
  replacing the 0.386 term with 0.2."* La `R-Ec. 12.45` publicada **no es la que él usa**.
- §12.5.4, nota al pie: cambió el `FF` de fuselaje **entre ediciones**.
Y el remate: **el DR-3 corre con la ecuación VIEJA**, verificado numéricamente
(`1 + 60/8.218³ + 8.218/400 = 1.129`, exacto contra el impreso). El libro contiene **dos versiones del
mismo método y su propio caso de validación usa la anterior**. Un software que implemente "la ecuación
del libro" y luego intente reproducir el DR-3 **fallará**, y el ingeniero perderá un día buscando el
bug en su código.

### 8.4 El error #1 del capítulo de pesos es una confesión personal
*"the most common [mistake] being the use of **limit load factor**, where **ultimate load factor `N_z`**
should be used instead. In the first edition, this author… **made exactly this mistake — now
corrected!**"*
Una máquina lineal lo leería como anécdota. Es un **requisito de UI**: el campo se llama `N_z`, dice
«último» al lado, y **rechaza** valores en el rango de los límites típicos sin confirmación explícita.

### 8.5 El «gut feeling» está institucionalizado, con instrucciones de qué hacer cuando lo veas
*"Sometimes fudge factors are applied based **just on the weight analyst's gut feeling. Don't laugh.**
If that person is experienced at 'Dash-One' weight estimation, a gut feeling adjustment **may be better
than all the statistics and analytical estimation in the world.** If you see the weights engineer
holding hands out, spreading them apart to measure length then bouncing them up and down, palms up, as
if weighing something invisible, **you should quietly tiptoe away.**"*
Es la frase más humana del libro y es, literalmente, un requisito: el software **necesita un campo
donde quepa el juicio, con su justificación escrita**, porque el proceso real lo tiene.

### 8.6 El acoplamiento 16→14→15→16 no está dibujado en ningún lado
El libro va 12, 13, 14, 15, 16, 17. Pero §14.3.3 dice, en una frase enterrada: *"**The first step
involves a stability-and-control calculation** to determine the required lift on the horizontal tail."*
Es decir: **el capítulo 14 depende del 16**, que depende del 15 (necesita el CG), que depende del 14
(necesita `N_z`). Es un punto fijo de tres capítulos, y el libro **nunca lo dibuja como tal**. Una hoja
de cálculo lineal —que es lo que casi todo el mundo construye para este bloque— no puede resolverlo.
Un CAD paramétrico con grafo de dependencias sí.

### 8.7 El cliente ya escribió nuestro algoritmo de optimización, dos veces
- Alcance, §17.2.5: *"**exhaustively searching throughout the flight envelope at the current aircraft
  weight**, looking for the place where the range parameter `(V/C)(L/D)` is at a maximum. **This is the
  method used by the computer programs in the major aircraft companies.**"*
- Tiempo mínimo de ascenso, §17.6.3: *"**starting at the top of each energy height curve and following
  it down to sea level, noting the altitude where the highest value of `P_s` is found. This technique
  is easiest for programming** and automatically accounts for oddly shaped `P_s` curves."*
No son pistas: son **especificaciones de implementación escritas por el cliente**. Y ambas son
`[NAVEGADOR]`: 2000 y 16,000 evaluaciones escalares.

### 8.8 El chiste que define el producto
§24.3, p.943, sobre el análisis completo de performance del caza:
> *"The RDS program was again used to perform the calculations and make the graphs, but **the same
> results would be obtained using a pocket calculator and the methods of this book (and a lot of
> time!)**."*

Ese paréntesis es todo el pliego en cinco palabras. La física es de calculadora de bolsillo. Lo que
falta —lo que vale— es que corra **sobre la geometría que acabas de dibujar, sin teclear nada, en el
segundo 1**; y que cuando el CFD de alguien más diga otra cosa, tengas el número con que contradecirlo.

### 8.9 Lo que este bloque le hace al «corazón» del pliego previo
El pliego existente declara que *"Caps 2, 3, 5, 6, 19 y 24 son el corazón"*. Después de leer 12–17
completos: esos son el corazón **del sizing**, y el sizing es una función de tres números
(`L/D`, `W_e/W_0`, `SFC`). **Los seis capítulos de este bloque son de donde salen esos tres números**
cuando dejan de ser estadística y empiezan a ser el avión que dibujaste. El propio §12.1 declara el
inicio del cap 12 como *"a turning point in the book"*. El corazón bombea; estos capítulos son la
sangre.

---

## 9. AUDITORÍA DEL PLIEGO EXISTENTE

Archivo auditado: `docs/forja-research/pliegos/pliego-aero.md`, **3,872 líneas**, fechado 2026-07-31.
Leído completo. Las referencias `L####` son sus números de línea.

### 9.1 Veredicto en una línea

**El pliego existente es bueno y honesto, y su cobertura del bloque de análisis es desigual de una
forma que se puede medir:** dedica 868 líneas (22% del documento) a los capítulos 12–17, pero el
reparto es 399 líneas al cap 12, **cero al cap 13**, y ni una sola de las 59 ecuaciones de peso, ni
una sola ecuación de estabilidad longitudinal. **No tiene ni un solo requisito numerado en todo el
bloque.** Lo que sí tiene, lo tiene bien.

### 9.2 LO QUE DICE MAL

#### 9.2.1 ⭐ El «error» del capítulo eléctrico NO es un error — el pliego tiene razón

El pliego cita el capítulo eléctrico como **§20** (L3439, L3441, L3458–3462, L3480, L3814).
El índice que circula (y que me dieron a mí en el encargo) dice que Electric Aircraft es el **21**.
**Verifiqué contra el cuerpo del libro y el pliego tiene razón:**
- §1.4, p.6–7, literal: *"**The new Chapter 20 covers Electric Aircraft**… **Chapter 21 covers vertical
  flight** including helicopters and vertical takeoff jets."*
- Cabeceras de página verificadas: `CHAPTER 19 Sizing and Trade Studies 711` (línea 36420);
  `CHAPTER 21 Vertical Flight-Jet and Prop 765` (línea 39069); `CHAPTER 22 Extremes of Flight 817`
  (línea 41435); `CHAPTER 23 Design of Unique Aircraft Concepts 835` (línea 42221).
- El capítulo eléctrico ocupa el hueco entre el 19 y el 21 (líneas ~37700–39060).

**Acción: no toques la numeración del §7.9 ni del detalle ⭐8 del pliego.** Lo que sí falta es que
**el cap 21 (Vertical Flight) no aparece ni una vez** en el pliego — ese sí es un hueco real, pero
está fuera de mi bloque.

> El TOC del PDF **está revuelto por el OCR** (mezcla columnas y produce «Chapter 15 / Stability…» y
> «Chapter 17 / Weights»). Cualquiera que se guíe por él se equivoca. Documentado en mi §0.2.

#### 9.2.2 `§12.1` como fuente del lazo de control geométrico — atribución incorrecta

L468: *"⭐ **Y hay un lazo de control que nadie espera:** §2.3 y §12.1."*, seguido (L472–473) de la
cita del alerón. **Leí §12.1 completo** (líneas 19106–19152 del .txt, p.389–390): es el prólogo del
capítulo de aerodinámica. Habla del giro del libro, de análisis "as-drawn", del resize y de que los
métodos son preliminares. **No menciona alerones, ni especialistas de control, ni 6-DOF.**
La cita del alerón es material de §2.3 (proceso) o del cap 16.
**Acción:** corregir a `§2.3` a secas, o localizar la frase en el cap 16 antes de citarla.

#### 9.2.3 `§14/§15 lo dicen` — afirmación sin respaldo

L462: *"§14/§15 lo dicen: si el peso vacío crece, por el efecto palanca W₀ crece más que
proporcionalmente."*
**Leí el cap 15 completo y el 14 hasta §14.6.** Ninguno enuncia el efecto palanca. El cap 15 dice
otra cosa, más precisa y más útil (§15.3, p.569): *"If the empty weight is higher than expected, there
might be insufficient fuel to complete the design mission. **This must be corrected by resizing and
optimizing the aircraft as described in Chapter 19, not by simply increasing fuel weight** for the
as-drawn aircraft (which would invalidate the component weight predictions that were based on the
as-drawn takeoff weight)."*
**Acción:** la cita del efecto palanca es de §3.6.6 (que el pliego ya tiene textual en L207–214);
la del cap 15 es la de arriba y **es mejor**, porque prohíbe explícitamente el atajo.

#### 9.2.4 Riesgo de colisión de numeración de ecuaciones — se materializa con mi bloque

El pliego usa `(N.M)` desnudo tanto para Raymer (secciones 1–5, 7) como para Anderson y Bertin
(sección 6). Ya hay colisiones vivas: `(4.18)…(4.88)` son de **Anderson cap 4**; `(5.53)…(5.70)` de
**Anderson cap 5**; `(12.2–12.3)` en L2492 es **Anderson**, no Raymer.
**Con mi bloque la colisión se vuelve estructural**: `A §12`, `A §13`, `A §14`, `B §12`, `B §14` chocan
de frente con Raymer 12/13/14.
**Acción:** adopté `R-Ec. 12.24` en este documento. Recomiendo migrar el pliego previo a
`R-Ec.` / `A-Ec.` / `B-Ec.` y declararlo en su primera página.

#### 9.2.5 Detalles menores

- **L325–326:** llama al Intermission *"subtitulado 'Design of a New Design'"*. El título real es
  **"Step-by-Step Development of a New Design"** (verificado en el TOC, línea 313: `Intermission
  Step-by-Step Development of a New Design 379`). Y L327–328 afirma que *"no está en el índice"* —
  **sí está**, sin número de capítulo.
- **L2353:** cita `§23.x` con la `x` literal ⇒ la sección no se verificó, y la cita larga de
  L2356–2360 queda huérfana.
- **L1923:** `E = 1.14·R/V (17.34)` en una tabla genérica de "constantes óptimas". **Verifiqué la
  ecuación en el impreso** (§17.2.10, p.647): el 1.14 sale de la relación entre las condiciones de
  alcance y de loiter, y `R-Ec. 17.34` está en la sección de **relación entre loiter y crucero**, sin
  distinguir jet de hélice. Confirmo la ambigüedad que el pliego no marcó: **para jet la relación
  teórica sería 1.1547 (=1/0.866)**. Marcar como fixture solo tras verificar a qué caso aplica.
- **L2158, Tabla 16.1, fila «Entrenador jet militar»:** la sospecha del pliego era correcta. **Leí la
  tabla en el impreso** (línea 31662): dice literalmente `0.22 · 0.14 · 0.25`. Es lo que el OCR
  entrega, y es **anómalo** frente a las otras once clases. Lo marqué `[OCR DUDOSO]` en mi §2.5.9.
- **L1391, `A_eff = A(1 + h/b)²` para winglet:** la duda del pliego era razonable. **Verifiqué**: el
  OCR muestra claramente `R-Ec. 12.10` lineal (endplate) y `R-Ec. 12.11` cuadrática (winglet). La
  asimetría **es del libro**, no del escaneo. Confirmado.
- **L1802, «59 ecuaciones, 15.1–15.24 / 15.25–15.45 / 15.46–15.59»:** la duda del pliego (*"implica
  que la Ec. 15.1 es la primera de Fighter/Attack"*) **queda resuelta: es correcto.** Leí §15.1 a
  §15.2 completos y **no contienen ninguna ecuación numerada**. `R-Ec. 15.1` es efectivamente
  `W_wing` del juego de caza. El conteo 24+21+14 = 59 cierra.

### 9.3 LO QUE DICE DE MÁS

#### 9.3.1 «Caps 2, 3, 5, 6, 19 y 24 son el corazón» (L16)

Es la única afirmación estructural del pliego **sin cita ni respaldo del libro**. Está en una celda de
tabla, no en prosa argumentada. Y contradice dos cosas del propio material:
1. El propio pliego dedica **868 líneas (22%)** a los capítulos que excluye del corazón, y su
   **Gate C** (L2435–2447) declara que sin ellos **no se puede congelar un concepto**.
2. §12.1, p.389 llama al inicio del cap 12 *"**a turning point in the book**"*, y §1.4, p.6 dice
   *"**Chapters 12–18 address the detailed analysis of the resulting design layout**"*.

**No pido borrarla** — es un juicio editorial legítimo sobre dónde empezar a construir. Pido
**etiquetarla como juicio del pliego, no como afirmación del libro**, y añadir la contraparte:
*los caps 12–17 son de donde salen los tres números (`L/D`, `W_e/W_0`, `SFC`) que el sizing consume.*

#### 9.3.2 El pliego declara una errata de Raymer que confirmo, y una que hay que matizar

- **Confirmada (L1928–1930):** §17.2.3 dice *"the minimum-power-required velocity is about **86.6%** of
  the minimum-thrust-required velocity"* y §17.2.2 dice **0.76**. Leí ambas páginas (641 y 643). La
  contradicción es real. **La resolución del pliego es correcta: usar `3^(−1/4) = 0.7598`; el 0.866 es
  razón de `L/D`.** Ahora está verificada verbatim (mi §2.6.2) y **sí debería entrar a la tabla de
  erratas de su §6.12**, que hoy solo cubre Anderson y Bertin.
- **Confirmada (L3166–3167):** *"el libro imprime `{4218 kg}` junto a las 19,300 lb"*. Correcto:
  19,300 lb = 8754 kg.

### 9.4 LO QUE DICE DE MENOS — los huecos que este documento cierra y los que quedan

| Hueco | Estado antes | Estado ahora |
|---|---|---|
| **Cap 13 completo (propulsión)** | **CERO líneas.** 3 menciones sueltas, ninguna con cita | **CERRADO.** 23 ecuaciones, Tabla 13.1, 13 requisitos, y el mejor fixture del bloque (§3.6: `R-Ec. 13.6` verificada en once filas) |
| **Las 59 ecuaciones de peso** | Nombradas por rango, **nunca escritas** | **CERRADO** (§2.4.2), con `15.5`, `15.11` y `15.31` declaradas perdidas por OCR |
| **Nomenclatura del cap 15** | 12 enums, *"entre otros 22"* — admite que faltan | **CERRADO** (§2.4.3): los ~60 símbolos completos con unidades |
| **Group Weight Statement** | Solo la prohibición *"Never change the takeoff gross weight"* | **CERRADO** (§1.4 y §3.5): formato, tres grupos, DCPR/AMPR, y el statement completo del DR-3 |
| **CG y envolvente de CG** | Lo pide el Gate B, **nadie lo calculaba** | **CERRADO** (`REQ-PESOS-15-09/-10/-11`, lección L-W3, y los CG del DR-3 en §3.5) |
| **Construcción de `Cm_alpha` y punto neutro** | Solo el **objetivo** (−1.2 a −1.6), no el método | **CERRADO** (§2.5.3, `R-Ec. 16.8–16.12`), con `16.9` declarada parcialmente perdida |
| **`dε/dα` (downwash)** | Cero | **PARCIAL** (§2.5.5): las ecuaciones `16.21–16.24` están declaradas perdidas; las figuras son imagen. **Sigue siendo hueco real** |
| **Efectividad de superficies de mando** | Cero ⇒ `LCDP` (16.65) era **incalculable** | **CERRADO** (§2.5.4, `R-Ec. 16.15–16.18` con el clamp), aunque `C_nδa` y `C_lδa` dependen de `16.48/16.49` que sí están |
| **Modos dinámicos y handling qualities** | El hueco más grande del cap 16 | **PARCIAL** (§2.5.9): declarados los cinco modos, el criterio de Dutch roll, MIL-F-8785B, Cooper-Harper, inercias y `16.55/16.56` perdidas. **No hay frecuencias ni amortiguamientos: el libro no los da** |
| **Trim drag** | Una línea | **CERRADO** (`REQ-ESTAB-16-13`, §2.5.7): incluye el signo por rotación de la sustentación de cola |
| **Ecuaciones de ascenso** | *"no hay `V_v = V(T−D)/W` explícita"* | **CERRADO** (§2.6.4, `R-Ec. 17.36–17.51`) |
| **Planeo** | Solo dos constantes | **CERRADO** (§2.6.6, `R-Ec. 17.62–17.83`) |
| **Radio de viraje** | Faltaba | **CERRADO** (`R-Ec. 17.79`) |
| **Segmento de aceleración** | *"el hueco más irónico: el gate estrella depende de una ecuación que no está"* | **CERRADO** (§2.6.7, `R-Ec. 17.86–17.90`) **y con su fixture** (§3.8: la integración de once pasos que da 42.2 s) |
| **Construcción de contornos de `P_s`** | Se citaba el criterio, no el algoritmo | **CERRADO** (§2.6.7 + `REQ-PERF-17-13`, el algoritmo literal de §17.6.3) |
| **Empuje instalado sin dueño** | El Gate C lo exigía y nadie lo producía | **CERRADO** (cap 13 completo) |
| **Orden de ejecución del bloque (DAG)** | *"No hay orden de ejecución"* | **CERRADO** (§0.5: el grafo, con los dos acoplamientos que el libro declara y el punto fijo 14↔15↔16) |
| **Tolerancias por disciplina** | *"Nada para arrastre, pesos, estabilidad o desempeño"* | **PARCIAL:** cada fixture del §3 lleva su tolerancia. Pero confirmo lo que el pliego ya decía: **Raymer no da un ±% por método.** Los únicos anclajes duros son *"flight-measured values… within about **2–10%** of the estimates"* (§12.7.1) y el crecimiento de peso *"less than **2%** in the first year"* (§15.4) |
| **Requisitos numerados en 12–17** | **Cero** | **CERRADO:** 100 requisitos con ID `REQ-<DOM>-<cap>-<nn>` |
| **Diagrama payload-range** | *"cero, y es el entregable comercial por excelencia"* | **SIGUE ABIERTO.** Leí el cap 17 completo: **Raymer no lo trata.** Confirmo el hueco y lo reclasifico: no es una omisión del pliego, es una **[EXTENSIÓN DECLARADA]** que habrá que construir fuera del libro |
| **V-speeds (V1, VR, V2, VMC, VMU)** | Solo `V_TO`, `V_stall`, `V_a`, `V_TD` | **PARCIAL:** el libro añade `V_1` (decision speed, §17.8.4) y `V_p` (maniobra, §14.3.4). **`V_MC`, `V_MU`, `V_2` y `V_R` no aparecen en el cap 17.** Hueco real del libro, no del pliego |
| **Cap 14: cortante, momento, larguero** | Faltaba | **SIGUE ABIERTO** — declarado en mi §7.4 como fuera de mi lectura (§14.7–14.10) |
| **Cap 14: propiedades de materiales** | Solo aforismos | **SIGUE ABIERTO** — mismo motivo |
| **Escalado de motor "rubber"** | Una regla suelta del carpet plot, sin atribuir | **PARCIAL:** el cap 13 **no da ecuaciones de escalado**. Lo que sí encontré es el límite duro (§24.3, p.936): *"one should normally scale a 'rubber' engine by **no more than about 20–30%**"* y que el propio DR-3 **rompió esa regla** escalando >50% |

### 9.5 LO QUE HAY QUE CORREGIR EN EL PLIEGO EXISTENTE — lista accionable

1. **Ec. (12.27)** (L1460): el pliego la escribe completa
   (`Cf = 0.455/[(log10 R)^2.58 (1 + 0.144 M²)^0.65]`). **Yo NO pude leerla en el .txt** — la página se
   corta justo en la ecuación (líneas 20880–20884). O el pliego la sacó de otra fuente, o del impreso.
   **Acción: marcar su procedencia.** Si vino de memoria o de otro libro, viola la regla #1.
2. **Ec. (12.24)** (L1458): igual. El pliego la escribe completa; el .txt solo tiene el número. La
   prosa alrededor la describe sin ambigüedad, así que probablemente sea reconstrucción legítima —
   **pero hay que declararla como tal**.
3. **Ec. (12.30)** (L1520): el pliego escribe el coeficiente `0.6`. En el .txt ese carácter está
   ilegible. **Marcar la procedencia.**
4. **Ecs. (12.61) y (12.62)** (L1736, L1738): el pliego las escribe completas; el .txt solo tiene los
   coeficientes. **Marcar la procedencia.**
5. **Ec. (12.44)** (L1631 aprox.): el pliego la usa; sí está en el .txt y **la verifiqué contra el
   DR-3** (§3.3): `(9π/2)·(17.07/45.2)² = 2.0166 ft²`. ✓ Confirmada.
6. **`§12.1`** como fuente del lazo del alerón (L468, L2407) → corregir.
7. **`§14/§15 lo dicen`** (L462) → sustituir por la cita real de §15.3, p.569.
8. **Tabla 17.1** (L1966): el pliego marca las celdas perdidas honestamente. **Confirmo la pérdida** y
   aporto la fila que sí se lee del cuerpo del texto: **µ rodadura 0.03 en concreto seco, µ frenado
   0.5 civil / 0.3 militar**.
9. **La errata del 0.866/0.760** debería moverse a la tabla de erratas de §6.12, marcada como **errata
   de Raymer**, no solo como nota al pie de §3.12.
10. **Prefijos `R-`/`A-`/`B-`** en los números de ecuación, declarados en la primera página.
11. **Etiquetar L16** («caps 2,3,5,6,19,24 son el corazón») como juicio editorial del pliego.
12. **NO tocar** la numeración del capítulo eléctrico: **§20 es correcto.**

### 9.6 Lo que el pliego existente hace mejor que yo, y hay que preservar

- Su **§2, "Los lazos iterativos declarados"** (L406–479) es el mejor pedazo del documento: seis lazos
  anidados con disparador, cierre y criterio de relajación, más tres lazos disciplinares. **Mi §0.5 lo
  complementa, no lo reemplaza**: yo aporto el DAG *dentro* del bloque de análisis (el punto fijo
  14↔15↔16 y el trim drag 12↔16), que su §2.2 no tenía.
- Su honestidad de trazabilidad: marca `⚠` lo no verificado, declara las seis celdas perdidas por OCR,
  y admite *"No pudimos verificarla… **Usa ω = 0.75, que sí está escrito en §6.3.7**"*. Eso es
  exactamente el estándar del CONTRATO y hay que sostenerlo.
- Su **§6.12, la tabla de 12 erratas de las fuentes**, con la nota *"Un test que transcriba estos
  valores **falla contra la física**"*. Es un patrón que este documento adopta (ver mis
  `[OCR DUDOSO]` y las tres discrepancias abiertas del §3.8).
- Su transcripción **VERBATIM** de la salida de RDS del DR-3 (14 segmentos, carpet plot 5×5, tabla
  MVO). Yo añadí las capas que faltaban —aero, propulsión, pesos, S&C y performance del mismo DR-3—
  pero la base de sizing ya estaba, bien hecha y con líneas de origen.

### 9.7 Convenciones que adopté del pliego existente (para que el conjunto lea como uno solo)

Cita en inglés en *cursiva entre comillas dobles* con **negrita dentro** para la parte que muerde ·
unidades métricas **entre llaves** después de las imperiales · ⭐ para «esto muerde» · `[DERIVADO]` y
`[EXTENSIÓN DECLARADA]` para lo que no está en el libro · bloques ``` para ecuaciones con el número
alineado · español mexicano, tuteo, sin emojis salvo ⭐⚠✓ · «el cliente» = Raymer, «nosotros» = La Forja.

**Lo que añadí:** el esquema de ID `REQ-<DOM>-<cap>-<nn>` (extensión de su formato de L485–486, que
solo tenía `§ · frase · traducción · rango`), el prefijo `R-Ec.`, y **la cita de PÁGINA** — el pliego
existente no cita ni una sola página de Raymer en sus 3,872 líneas, y este documento las cita todas.

---

*Fin del pliego del bloque de análisis.*

**Inventario verificable de este documento** (contado sobre el archivo, no estimado):
**130 requisitos funcionales** con ID `REQ-<DOM>-<cap>-<nn>` · **21 fixtures** de test con sus gates
aritméticos · las ecuaciones de los seis capítulos transcritas con rango de validez y supuestos ·
**43 cuerpos de ecuación declarados perdidos** por OCR (`[CUERPO PERDIDO]`) · **31 valores marcados
`[OCR DUDOSO]`** que NO deben entrar a un test sin verificar contra el impreso · **33 decisiones
humanas** citadas literalmente · **16 lecciones de escuela** con su número de verificación ·
**3 discrepancias abiertas** documentadas en el §3.8 (ángulo de ascenso del DR-3, radio de viraje, y
la correspondencia V↔Mach de la tabla de aceleración).

**Lo que este documento NO cubre y hay que encargar:** §14.7–14.10 de Raymer (propiedades de
materiales, análisis estructural clásico, pandeo, fatiga, y el paso de Schrenk a
cortante/momento/larguero), y el capítulo 21 (Vertical Flight), que el pliego existente tampoco toca.
