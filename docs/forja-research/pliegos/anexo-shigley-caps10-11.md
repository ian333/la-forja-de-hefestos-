# Shigley cap. 10 (Resortes) + cap. 11 (Rodamientos) — ENTREVISTA DE REQUISITOS

> **Cliente**: Budynas/Nisbett, *Shigley's Mechanical Engineering Design* (2024).
> **Rol de este documento**: transcribir SU proceso a mano como especificación de software.
> **Estado del producto**: nuestro software NO tiene NADA de resortes helicoidales ni de rodamientos.
> **Todo lo de abajo es brecha.**
>
> **Fuente**: texto extraído del PDF, páginas físicas 520–700 (impresas 499–679).
> Archivos: `sh/p_520_580.txt`, `sh/p_580_640.txt`, `sh/p_640_700.txt`.
> **Regla dura aplicada**: si un número/fórmula/tabla NO está en el texto extraído, lo digo
> explícitamente. No hay ni un dato inventado en este documento.

---

## 0. MAPA MENTAL DEL CLIENTE (lo que dice el propio libro de su método)

El cap. 11 abre con un párrafo que ES la arquitectura del módulo de rodamientos (§11 intro,
impresa 590):

> "We begin with an overview of bearing types; then we note that bearing life cannot be described
> in deterministic form. We introduce the invariant, the statistical distribution of bearing life,
> which is described by the Weibull distribution. […] The load-life-reliability relationship
> combines statistical and deterministic relationships, which gives the designer a way to move
> from the desired load and life to the catalog rating **in one equation**."

**Traducción de requisito**: el módulo de rodamientos NO es un solver. Es un **traductor**:
(carga deseada, vida deseada, confiabilidad deseada) → **un número de catálogo C₁₀** → **búsqueda
en tabla** → **iteración porque el rodamiento elegido cambia los factores**.

Y el cap. 10 declara lo contrario para resortes (§10-7, impresa 548):

> "Spring design is an open-ended process. There are many decisions to be made, and many possible
> solution paths as well as solutions. […] There are almost as many ways to create a spring-design
> program as there are programmers. Here, we will suggest one possible design approach."

**Traducción de requisito**: el módulo de resortes SÍ es un **barrido + tabla + inspección + figura
de mérito**. El cliente NO resuelve un óptimo continuo: **construye una tabla de candidatos discretos
(un renglón por diámetro de alambre comercial), tacha los infactibles, y elige por fom.**

---

# PARTE I — CAPÍTULO 10: RESORTES MECÁNICOS

## §10-1 Esfuerzos (impresa 538) — las bases que el motor necesita

| Símbolo | Definición | Ecuación |
|---|---|---|
| D | diámetro medio de la espira | — |
| d | diámetro del alambre | — |
| C | **índice del resorte** | `C = D/d` **(10–1)** |
| Ks | factor de corrección por cortante directo | `Ks = (2C+1)/(2C)` **(10–3)** |
| τ | esfuerzo cortante | `τ = Ks·8FD/(πd³)` **(10–2)** |

⭐ **REGLA EN PROSA (§10-1)**: *"The preferred value of C ranges from 4 to 12."*
→ "El valor preferido de C va de 4 a 12." (Fuente citada: Design Handbook, Associated
Spring-Barnes, 1987.)

⭐ **REGLA EN PROSA (§10-1)**: *"The use of square or rectangular wire is **not recommended** for
springs unless space limitations make it necessary. […] they have not had the benefit of refining
development and hence **may not be as strong** as springs made from round wire. When space is
severely limited, the use of **nested round-wire springs should always be considered**."*
→ "Alambre cuadrado o rectangular NO se recomienda salvo que el espacio te obligue; no está tan
desarrollado y puede ser menos resistente. Si el espacio aprieta mucho, **siempre considera resortes
de alambre redondo anidados** — pueden ganar en economía y en resistencia."

## §10-2 Efecto de curvatura (impresa 539)

| Factor | Ecuación |
|---|---|
| Wahl | `KW = (4C−1)/(4C−4) + 0.615/C` **(10–4)** |
| Bergsträsser | `KB = (4C+2)/(4C−3)` **(10–5)** |
| Solo curvatura | `Kc = KB/Ks = 2C(4C+2)/[(4C−3)(2C+1)]` **(10–6)** |

⭐ **REGLA EN PROSA (§10-2)**: *"For static loading, the curvature factor is **normally neglected**
because any localized yielding leads to localized strain strengthening. **For fatigue applications,
the curvature factor should be included.**"*
→ "En carga estática el factor de curvatura normalmente se desprecia (la fluencia local endurece
por deformación). **En fatiga sí se incluye.**"

⭐ **REGLA EN PROSA (§10-2)**: *"Since the results of these two equations differ by the order of
1 percent, **Equation (10–5) is preferred**."* → El libro usa **KB (Bergsträsser)**, no Wahl.
`τ = KB·8FD/(πd³)` **(10–7)** es LA ecuación de esfuerzo del libro.

⚠️ **Ojo de implementador**: *"Now, Ks, KB or KW, and Kc are simply stress-correction factors applied
multiplicatively to Tr/J at the critical location […] **There is no stress-concentration factor.**"*
→ NO son Kt. No los metas al pipeline de concentración de esfuerzos.

## §10-3 Deflexión (impresa 539)

```
y = (8FD³Na)/(d⁴G) · (1 + 1/(2C²))  ≈  8FD³Na/(d⁴G)      (10–8)
k = F/y ≈ d⁴G/(8D³N)                                      (10–9)
```
"spring rate, also called **the scale of the spring**".

## §10-4 Resortes de compresión: TIPOS DE EXTREMO (impresa 540–541)

Cuatro tipos: **plain**, **squared/closed**, **squared and ground**, **plain and ground**.

### TABLA 10-1 — Características dimensionales (Na = espiras activas) — TRANSCRITA

| Término | Plain | Plain and Ground | Squared or Closed | Squared and Ground |
|---|---|---|---|---|
| Espiras de extremo, Ne | 0 | 1 | 2 | 2 |
| Espiras totales, Nt | Na | Na + 1 | Na + 2 | Na + 2 |
| Longitud libre, L0 | p·Na + d | p(Na + 1) | p·Na + 3d | p·Na + 2d |
| Longitud sólida, Ls | d(Nt + 1) | d·Nt | d(Nt + 1) | d·Nt |
| Paso, p | (L0 − d)/Na | L0/(Na + 1) | (L0 − 3d)/Na | (L0 − 2d)/Na |

*Fuente en el libro: Design Handbook, 1987, p. 32.*

⭐ **REGLA EN PROSA (§10-4)**: *"Springs **should always be both squared and ground** for important
applications, because a better transfer of the load is obtained."*
→ "Para aplicaciones importantes el resorte SIEMPRE debe ir escuadrado Y rectificado: transfiere
mejor la carga."

⭐⭐ **DESCONFIANZA DEL CLIENTE HACIA SU PROPIA TABLA (§10-4)** — puro juicio humano:
> *"Note that the digits 0, 1, 2, and 3 appearing in Table 10–1 are **often used without question.
> Some of these need closer scrutiny as they may not be integers.** This depends on how a springmaker
> forms the ends. Forys pointed out that squared and ground ends give a solid length Ls of
> **Ls = (Nt − a)d** where **a varies, with an average of 0.75**, so the entry dNt in Table 10–1
> **may be overstated**. The way to check these variations is to take springs from a particular
> springmaker, **close them solid, and measure the solid height**. Another way is to look at the
> spring and **count the wire diameters in the solid stack**."*
→ "Los dígitos 0,1,2,3 de la tabla 10-1 se usan sin cuestionarlos, pero no siempre son enteros:
depende de cómo forme los extremos TU fabricante. La forma de checarlo es tomar resortes de ESE
fabricante, cerrarlos a sólido y medir; o contar los diámetros de alambre en la pila."
**REQUISITO**: `a` (0.75 promedio) tiene que ser un **parámetro por proveedor**, no una constante.

### Set removal / presetting / scragging (§10-4, impresa 541)

Proceso: hacer el resorte más largo de lo necesario y comprimirlo hasta fluir parcialmente el alambre
en torsión (normalmente hasta la altura sólida) → residuales benéficos opuestos al esfuerzo de
servicio → fija la longitud libre final.

⭐ **REGLAS EN PROSA (§10-4)**:
- *"Springs to be preset **should be designed so that 10 to 30 percent of the initial free length is
  removed** during the operation."* → "Diseña para quitar 10–30 % de la longitud libre inicial."
- *"**If the stress at the solid height is greater than 1.3 times the torsional yield strength,
  distortion may occur.** If this stress is **much less than 1.1 times, it is difficult to control
  the resulting free length**."* → ventana operativa: **1.1·Ssy ≤ τ_solid ≤ 1.3·Ssy**.
- *"Compression springs are **not always preset**, as the operation **adds an additional cost**."*
- *"Presetting has a particular value when it is desired to **increase the load capacity without
  increasing the size** of the spring. Presetting is especially useful when the spring is used for
  **energy-storage** purposes."*
- ⚠️ *"**Presetting has less influence on the endurance limit, so it is not as beneficial for fatigue
  loading.**"* → "El presetting sirve poco en fatiga."

## §10-5 Estabilidad / pandeo (impresa 541–542)

```
ycr = L0·C'1·[1 − (1 − C'2/λ²eff)^(1/2)]        (10–10)
λeff = α·L0/D                                    (10–11)
C'1 = E/[2(E − G)]
C'2 = 2π²(E − G)/(2G + E)
```

**Estabilidad absoluta** (cuando C'2/λ²eff > 1):
```
L0 < (πD/α)·[2(E − G)/(2G + E)]^(1/2)            (10–12)
Para aceros:  L0 < 2.63·D/α                      (10–13)
```

### TABLA 10-2 — Constantes de condición de extremo α — TRANSCRITA

| Condición de extremo | α |
|---|---|
| Resorte apoyado entre superficies planas paralelas (extremos fijos) | 0.5 |
| Un extremo apoyado en superficie plana ⟂ al eje (fijo); el otro pivotado (articulado) | 0.707 |
| Ambos extremos pivotados (articulados) | 1 |
| Un extremo empotrado; el otro libre | 2 |

\* *"Ends supported by flat surfaces must be squared and ground."*
→ "Los extremos apoyados en superficies planas DEBEN ser escuadrados y rectificados."

⭐ Para squared-and-ground entre planos paralelos, α = 0.5 → el libro escribe
"L0 > 5.26D" (impresa 542) como la frontera; la condición de estabilidad es **L0 < 5.26D**.
(El texto extraído dice literalmente `L0 > 5.26D` en esa línea — lo transcribo tal cual y señalo
que en Ej. 10-1 y en la figura 10-3 el criterio se usa como `L0 < 2.63D/α`, o sea `(L0)cr = 2.63D/α`.)

⭐⭐ **JUICIO HUMANO — ACEPTAR O NO EL PANDEO (Ej. 10-1(g), impresa 547)**:
> *"Mathematically, a free length of 2.06 in is less than 2.10 in, and buckling is unlikely.
> **However, the forming of the ends will control how close α is to 0.5. This has to be investigated
> and an inside rod or exterior tube or hole may be needed.**"*
→ "Matemáticamente no pandea, PERO qué tan cerca esté α de 0.5 lo decide el formado de los extremos.
Hay que investigarlo, y quizá se necesite una **varilla interior, un tubo exterior o un barreno**."
**REQUISITO**: la salida no puede ser un booleano "pandea/no pandea". Debe reportar **margen**
`(L0)cr/L0` y, si el margen es flaco, **proponer guía (rod/hole)** — que además cambia la rama del
diagrama de flujo de §10-7.

## §10-6 Materiales de resorte (impresa 543–546)

⭐ **REGLA EN PROSA (§10-6)**: *"In general, **prehardened wire should not be used if D/d > 4 or if
d > 1/4 in**."* → "En general NO uses alambre pre-endurecido si D/d > 4 o si d > 1/4 in."

⭐ **REGLA EN PROSA (§10-6)**: *"Winding of the spring induces residual stresses through bending, but
these are normal to the direction of the torsional working stresses […] Quite frequently in spring
manufacture, they are **relieved, after winding, by a mild thermal treatment**."*

### TABLA 10-3 — Aceros de alto carbono y aleados (descripción cualitativa) — resumen fiel

| Material | Specs | Notas del cliente (rango de d, límites de temperatura) |
|---|---|---|
| **Music wire** 0.80–0.95C | UNS G10850 / AISI 1085 / ASTM A228-51 | "the best, toughest, and most widely used of all spring materials for small springs"; mayor Sut; d = 0.12–3 mm (0.005–0.125 in). **"Do not use above 120 °C (250 °F) or at subzero temperatures."** |
| **Oil-tempered** 0.60–0.70C | UNS G10650 / AISI 1065 / ASTM 229-41 | uso general donde music wire sale caro y en tamaños mayores. **"Not for shock or impact loading."** d = 3–12 mm (0.125–0.5 in). No arriba de 180 °C (350 °F) ni subcero. |
| **Hard-drawn** 0.60–0.70C | UNS G10660 / AISI 1066 / ASTM A227-47 | "the cheapest general-purpose spring steel and **should be used only where life, accuracy, and deflection are not too important**". d = 0.8–12 mm. No arriba de 120 °C ni subcero. |
| **Chrome-vanadium** | UNS G61500 / AISI 6150 / ASTM 231-41 | "most popular alloy spring steel" para esfuerzos altos, **fatiga y larga vida**; bueno para choque e impacto; válvulas de motor de avión; hasta 220 °C (425 °F). d = 0.8–12 mm. |
| **Chrome-silicon** | UNS G92540 / AISI 9254 | "excellent material for highly stressed springs that require long life and are subjected to **shock loading**"; HRC 50–53; hasta 250 °C (475 °F). d = 0.8–12 mm. |

*Fuente en el libro: Carlson, Mechanical Engineering, vol. 78, 1956.*

### ⭐⭐ TABLA 10-4 — Constantes A y m de `Sut = A/d^m` — **TRANSCRITA COMPLETA**

`Sut = A/d^m` **(10–14)**. Con d en mm → A en MPa·mm^m. Con d en in → A en kpsi·in^m.

| Material | ASTM No. | Exponente m | Diámetro, in | A, kpsi·in^m | Diámetro, mm | A, MPa·mm^m | Costo relativo del alambre |
|---|---|---|---|---|---|---|---|
| Music wire\* | A228 | 0.145 | 0.004–0.256 | 201 | 0.10–6.5 | 2211 | 2.6 |
| OQ&T wire† | A229 | 0.187 | 0.020–0.500 | 147 | 0.5–12.7 | 1855 | 1.3 |
| Hard-drawn wire‡ | A227 | 0.190 | 0.028–0.500 | 140 | 0.7–12.7 | 1783 | 1.0 |
| Chrome-vanadium wire§ | A232 | 0.168 | 0.032–0.437 | 169 | 0.8–11.1 | 2005 | 3.1 |
| Chrome-silicon wire‖ | A401 | 0.108 | 0.063–0.375 | 202 | 1.6–9.5 | 1974 | 4.0 |
| 302 Stainless wire# | A313 | 0.146 | 0.013–0.10 | 169 | 0.3–2.5 | 1867 | 7.6–11 |
| 302 Stainless wire# | A313 | 0.263 | 0.10–0.20 | 128 | 2.5–5 | 2065 | ″ |
| 302 Stainless wire# | A313 | 0.478 | 0.20–0.40 | 90 | 5–10 | 2911 | ″ |
| Phosphor-bronze wire\*\* | B159 | 0 | 0.004–0.022 | 145 | 0.1–0.6 | 1000 | 8.0 |
| Phosphor-bronze wire\*\* | B159 | 0.028 | 0.022–0.075 | 121 | 0.6–2 | 913 | ″ |
| Phosphor-bronze wire\*\* | B159 | 0.064 | 0.075–0.30 | 110 | 2–7.5 | 932 | ″ |

Notas al pie del libro:
\* superficie lisa, sin defectos, acabado brillante. † tiene una capa ligera de tratamiento térmico
que debe removerse antes de platear. ‡ superficie lisa y brillante sin marcas visibles.
§ alambre templado calidad aeronáutica, también en recocido. ‖ templado a Rockwell C49, puede
obtenerse sin templar. # acero inoxidable tipo 302. \*\* temple CA510.
*Fuente en el libro: Design Handbook, 1987, p. 19.*

⭐⭐ **REQUISITO DURO**: A y m son **por material Y por rango de diámetro** (302 stainless y
phosphor-bronze tienen 3 tramos cada uno). El "costo relativo del alambre" **es la columna que
alimenta la figura de mérito** de §10-7. Un implementador que solo copie A y m **se salta el costo
relativo y rompe el criterio de decisión completo.**

### Fracciones de Ssy permisible

Estimación burda vía distorsión-energía suponiendo Sy entre 60 y 90 % de Sut:
```
0.35·Sut ≤ Ssy ≤ 0.52·Sut       (10–15)   [para aceros]
```
Prosa (§10-6): *"Music wire and hard-drawn steel spring wire have a low end of range Ssy = 0.45Sut.
Valve spring wire, Cr-Va, Cr-Si, and other […] hardened and tempered carbon and low-alloy steel
wires as a group have **Ssy ≥ 0.50Sut**. Many nonferrous materials […] as a group have
**Ssy ≥ 0.35Sut**."*

Correlación adicional: *"the tensile yield strength of spring wire in torsion can be estimated from
0.75Sut. The corresponding estimate of the yield strength in shear based on distortion energy theory
is Ssy = 0.577(0.75)Sut = 0.433Sut ≈ 0.45Sut."*

Samónov: `Ssy = τall = 0.56·Sut` **(10–16)** para aceros de resorte de alta resistencia
(especificado por el Draft Standard 2089 de la RFA **cuando se usa la Ec. (10–2) SIN factor de
corrección de esfuerzo** — ⚠️ ese condicional importa).

### ⭐ TABLA 10-6 — Esfuerzos cortantes máximos permisibles, aplicaciones ESTÁTICAS — TRANSCRITA

| Material | **Antes** de set removal (incluye KW o KB) | **Después** de set removal (incluye Ks) |
|---|---|---|
| Music wire y acero al carbono estirado en frío | 45 % | 60–70 % |
| Acero al carbono y baja aleación templado y revenido | 50 % | 65–75 % |
| Aceros inoxidables austeníticos | 35 % | 55–65 % |
| Aleaciones no ferrosas | 35 % | 55–65 % |

(% del Sut; fuente Joerres, Standard Handbook of Machine Design, 3ª ed., 2004.)

⚠️⚠️ **DETALLE QUE UNA MÁQUINA SE SALTA**: la columna "antes" **ya incluye KW o KB**; la columna
"después" **incluye Ks**. O sea: **cambia el factor de corrección de esfuerzo según si hay set
removal o no.** Si copias solo el porcentaje y usas siempre KB, calculas mal el caso set-removed.
(Concuerda con la figura 10-3: rama "set removed" usa `Ssy = 0.65A/d^m` — que es 0.65·Sut — mientras
la rama "as-wound" usa `Ssy = const(A)/d^m` con const de la tabla 10-6.)

Nota Joerres: *"Ssy ≥ 0.65Sut increases strength through cold work, but **at the cost of an additional
operation by the springmaker**. Sometimes the additional operation can be done by the manufacturer
during assembly."*

### TABLA 10-5 — Propiedades mecánicas de algunos alambres — TRANSCRITA

Columnas: límite elástico como % de Sut (tensión / torsión), E y G. **E y G dependen de d** en music
wire y HD spring.

| Material | Elástico % Sut (Tensión) | (Torsión) | Diámetro d, in | E, Mpsi | E, GPa | G, Mpsi | G, GPa |
|---|---|---|---|---|---|---|---|
| Music wire A228 | 65–75 | 45–60 | <0.032 | 29.5 | 203.4 | 12.0 | 82.7 |
| ″ | ″ | ″ | 0.033–0.063 | 29.0 | 200 | 11.85 | 81.7 |
| ″ | ″ | ″ | 0.064–0.125 | 28.5 | 196.5 | 11.75 | 81.0 |
| ″ | ″ | ″ | >0.125 | 28.0 | 193 | 11.6 | 80.0 |
| HD spring A227 | 60–70 | 45–55 | <0.032 | 28.8 | 198.6 | 11.7 | 80.7 |
| ″ | ″ | ″ | 0.033–0.063 | 28.7 | 197.9 | 11.6 | 80.0 |
| ″ | ″ | ″ | 0.064–0.125 | 28.6 | 197.2 | 11.5 | 79.3 |
| ″ | ″ | ″ | >0.125 | 28.5 | 196.5 | 11.4 | 78.6 |
| Oil tempered A239 | 85–90 | 45–50 | — | 28.5 | 196.5 | 11.2 | 77.2 |
| Valve spring A230 | 85–90 | 50–60 | — | 29.5 | 203.4 | 11.2 | 77.2 |
| Chrome-vanadium A231 | 88–93 | 65–75 | — | 29.5 | 203.4 | 11.2 | 77.2 |
| Chrome-vanadium A232 | 88–93 | — | — | 29.5 | 203.4 | 11.2 | 77.2 |
| Chrome-silicon A401 | 85–93 | 65–75 | — | 29.5 | 203.4 | 11.2 | 77.2 |
| Stainless A313\* | 65–75 | 45–55 | — | 28 | 193 | 10 | 69.0 |
| Stainless 17-7PH | 75–80 | 55–60 | — | 29.5 | 208.4 | 11 | 75.8 |
| Stainless 414 | 65–70 | 42–55 | — | 29 | 200 | 11.2 | 77.2 |
| Stainless 420 | 65–75 | 45–55 | — | 29 | 200 | 11.2 | 77.2 |
| Stainless 431 | 72–76 | 50–55 | — | 30 | 206 | 11.5 | 79.3 |
| Phosphor-bronze B159 | 75–80 | 45–50 | — | 15 | 103.4 | 6 | 41.4 |
| Beryllium-copper B197 | 70 | 50 | — | 17 | 117.2 | 6.5 | 44.8 |
| Inconel alloy X-750 | 65–70 | 40–45 | — | 31 | 213.7 | 11.2 | 77.2 |

\* también incluye 302, 304 y 316.
Nota del libro: *"See Table 10–6 for allowable torsional stress design values."*

⭐ **DETALLE**: en el Ej. 10-2 el cliente **anticipa** el valor de G *antes* de conocer d:
*"G = 11.75 Mpsi (**expecting d > 0.064 in**)"*. → G se lee de una tabla **indexada por d**, pero d es
justo la variable de decisión. **Hay que re-leer G en cada renglón del barrido.**

---

## §10-7 ⭐⭐⭐ DISEÑO DE RESORTE DE COMPRESIÓN — SERVICIO ESTÁTICO (impresa 547–553)
### EL CORAZÓN. Transcripción del procedimiento.

### 7.1 Las condiciones recomendadas (LISTA DE CRITERIOS DE ACEPTACIÓN — TRANSCRITA)

Texto literal (impresas 547–548):
> *"The **preferred range of the spring index is 4 ≤ C ≤ 12**, with the **lower indexes being more
> difficult to form (because of the danger of surface cracking)** and springs with **higher indexes
> tending to tangle often enough to require individual packing. This can be the first item of the
> design assessment.** The **recommended range of active turns is 3 ≤ Na ≤ 15**. To maintain linearity
> when a spring is about to close, it is necessary to **avoid the gradual touching of coils** (due to
> nonperfect pitch). […] The spring force is not reproducible for very small deflections, and near
> closure, nonlinear behavior begins as the number of active turns diminishes as coils begin to
> touch. **The designer confines the spring's operating point to the central 75 percent of the curve
> between no load, F = 0, and closure, F = Fs.** Thus, the maximum operating force **should be
> limited to Fmax ≤ (7/8)·Fs**."*

Derivación del **overrun fraccional al cierre ξ**:
```
Fs = (1 + ξ)·Fmax                                   (10–17)
Fs = (1 + ξ)(7/8)Fs  →  ξ = 1/7 = 0.143 ≈ 0.15
"Thus, it is recommended that ξ ≥ 0.15."
```

**LAS CUATRO CONDICIONES DE DISEÑO (ecuaciones 10-18 a 10-21):**

| # | Condición | Ec. | Razón que da el cliente |
|---|---|---|---|
| 1 | **4 ≤ C ≤ 12** | (10–18) | C bajo: difícil de formar, riesgo de **agrietamiento superficial**. C alto: los resortes **se enredan** y hay que empacarlos individualmente. |
| 2 | **3 ≤ Na ≤ 15** | (10–19) | rango recomendado de espiras activas |
| 3 | **ξ ≥ 0.15** | (10–20) | linealidad robusta: operar en el 75 % central de la curva |
| 4 | **ns ≥ 1.2** | (10–21) | ns = factor de seguridad **a cierre (altura sólida)**, NO a Fmax |

⭐⭐ **JUICIO CODIFICADO**: la condición #4 se evalúa **en la altura sólida**, no en la carga de
operación. El resorte se dimensiona para **aguantar que alguien lo cierre por completo** y salir sin
daño permanente. Una máquina lineal pondría el FS en Fmax.

### 7.2 La FIGURA DE MÉRITO (Ec. 10-22)

```
fom = −(costo relativo del material)·γ·π²·d²·Nt·D/4          (10–22)
```
> *"When considering designing a spring for high volume production, the figure of merit can be the
> **cost of the wire from which the spring is wound**. […] For comparisons between steels, the
> specific weight γ **can be omitted**."*

⚠️ Es **negativa** — se maximiza (menos negativo gana). En el Ej. 10-2 se compara −0.417 > −0.438.

### 7.3 ⭐⭐⭐ LA ESTRATEGIA DE DISEÑO (transcripción literal, impresa 548)

> **Design Strategy**
> *"Make the **a priori decisions**, with **hard-drawn steel wire the first choice (relative material
> cost is 1.0)**. Choose a wire size d. With all decisions made, **generate a column of parameters:
> d, D, C, OD or ID, Na, Ls, L0, (L0)cr, ns, and fom**. By **incrementing wire sizes available**, we
> can **scan the table of parameters and apply the design recommendations by inspection**. After wire
> sizes are eliminated, **choose the spring design with the highest figure of merit**. This will give
> the optimal design despite the presence of a **discrete design variable d** and aggregation of
> equality and inequality constraints."*

### 7.4 ⭐⭐⭐ FIGURA 10-3 — DIAGRAMA DE FLUJO "STATIC SPRING DESIGN" — TRANSCRITO

```
                        STATIC SPRING DESIGN
                             Choose d
                                 |
   +--------------+--------------+--------------+---------------+
   |  Over-a-rod  |            Free            |   In-a-hole    |
   | As-wound o   |  As-wound   |  Set removed |  As-wound o    |
   |     set      |             |              |      set       |
   |              |             |              |                |
 D = d_rod + d    | Ssy = const(A)/d^m †   Ssy = 0.65 A/d^m |  D = d_hole − d
     + allow      |             |              |                − allow
                  |             |              |
                  |   C = (2α−β)/(4β) + sqrt[ ((2α−β)/(4β))² − 3α/(4β) ]
                  |         α = Ssy/ns      β = 8(1+ξ)Fmax/(πd²)
                  |                D = C·d
                  |
                  |   [rama over-a-rod / in-a-hole:]
                  |     D = 8·ns·(1+ξ)·Fmax / (Ssy·π·d³)   ← relación mostrada en la figura
                  |
   +--------------+---------------------------------------------+
                                 |
                            C = D/d
                        KB = (4C+2)/(4C−3)
                    τs = 8·KB·(1+ξ)·Fmax·D/(π d³)
                          ns = Ssy/τs
                            OD = D + d
                            ID = D − d
                    Na = G·d⁴·ymax/(8·D³·Fmax)
                          Nt : Tabla 10–1
                          Ls : Tabla 10–1
                          L0 : Tabla 10–1
                       (L0)cr = 2.63·D/α
                fom = −(rel. cost)·γ·π²·d²·Nt·D/4
                                 |
  Print or display: d, D, C, OD, ID, Na, Nt, Ls, L0, (L0)cr, ns, fom
  Build a table, conduct design assessment by inspection
  Eliminate infeasible designs by showing active constraints
  Choose among satisfactory designs using the figure of merit

  † const is found from Table 10–6.
```

⭐⭐ **TRES RAMAS TOPOLÓGICAS**: **over-a-rod**, **free**, **in-a-hole**. En over-a-rod y in-a-hole,
**D se FIJA por la geometría del entorno** (`D = d_rod + d + allow` o `D = d_hole − d − allow`) y
`ns` **sale como consecuencia**, no como entrada. En "free", `ns` es entrada y `C` sale de la
cuadrática. El libro lo dice explícito en el Ej. 10-2: *"**Had the spring been in a hole or over a
rod, the helix diameter would be chosen without reference to (ns)d.**"*
→ **REQUISITO: el modo de montaje CAMBIA qué es entrada y qué es salida.** Un implementador que
programe una sola fórmula rompe dos de tres casos de uso.

⚠️ *"It is general enough to accommodate to the situations of **as-wound and set-removed springs,
operating over a rod, or in a hole free of rod or hole**."* → 3 topologías × 2 condiciones
(as-wound / set-removed) = **6 combinaciones**.

### 7.5 La cuadrática en C (as-wound) — Ec. 10-23

De (10–7) con τ = Ssy/ns, C = D/d, KB de (10–6) y (10–17):
```
Ssy/ns = KB·8FsD/(πd³) = [(4C+2)/(4C−3)]·[8(1+ξ)Fmax·C/(πd²)]        (a)
α = Ssy/ns                                                            (b)
β = 8(1+ξ)Fmax/(πd²)                                                  (c)

C = (2α − β)/(4β) + sqrt[ ((2α − β)/(4β))² − 3α/(4β) ]               (10–23)
```
> *"Substituting Equations (b) and (c) into (a) and simplifying yields a quadratic equation in C.
> **The larger of the two solutions will yield the spring index.**"*
⚠️ **La raíz MAYOR.** Detalle que se salta cualquiera que solo "resuelva la cuadrática".

### 7.6 Ejemplo 10-2 — el barrido completo (impresa 550–551)

Problema: soportar 20 lbf tras comprimirse 2 in. Ls ≤ 1 in, L0 ≤ 4 in.

**Decisiones a priori (la lista literal):**
- Music wire A228; de tabla 10-4 A = 201 000 psi·in^m, m = 0.145; de tabla 10-5 E = 28.5 Mpsi,
  G = 11.75 Mpsi (**esperando d > 0.064 in**)
- Extremos escuadrados y rectificados
- Función: Fmax = 20 lbf, ymax = 2 in
- Seguridad: factor de diseño **a altura sólida** (ns)d = 1.2
- **Linealidad robusta**: ξ = 0.15
- **Usar resorte as-wound (más barato)**, Ssy = 0.45·Sut de tabla 10-6
- Variable de decisión: d

**La tabla resultante (TRANSCRITA):**

| d | 0.063 | 0.067 | 0.071 | 0.075 | 0.080 | 0.085 | 0.090 | 0.095 |
|---|---|---|---|---|---|---|---|---|
| D | 0.391 | 0.479 | 0.578 | 0.688 | 0.843 | 1.017 | 1.211 | 1.427 |
| C | 6.205 | 7.153 | 8.143 | 9.178 | 10.53 | 11.96 | 13.46 | 15.02 |
| OD | 0.454 | 0.546 | 0.649 | 0.763 | 0.923 | 1.102 | 1.301 | 1.522 |
| Na | 39.1 | 26.9 | 19.3 | 14.2 | 10.1 | 7.3 | 5.4 | 4.1 |
| Ls | 2.587 | 1.936 | 1.513 | 1.219 | 0.964 | 0.790 | 0.668 | 0.581 |
| L0 | 4.887 | 4.236 | 3.813 | 3.519 | 3.264 | 3.090 | 2.968 | 2.881 |
| (L0)cr | 2.06 | 2.52 | 3.04 | 3.62 | 4.43 | 5.35 | 6.37 | 7.51 |
| ns | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 | 1.2 |
| fom | −0.409 | −0.399 | −0.398 | −0.404 | −0.417 | −0.438 | −0.467 | −0.505 |

**El "adequacy assessment" literal — restricción por restricción:**
- `4 ≤ C ≤ 12` descarta diámetros mayores a 0.085
- `3 ≤ Na ≤ 15` descarta diámetros menores a 0.075
- `Ls ≤ 1` descarta menores a 0.080
- `L0 ≤ 4` descarta menores a 0.071
- **criterio de pandeo**: descarta longitudes libres mayores a (L0)cr → descarta menores a 0.075
- *"The factor of safety ns is exactly 1.20 **because the mathematics forced it**."*
- Sobreviven 0.080 y 0.085 → **gana 0.080 por fom (−0.417 > −0.438)**

⚠️ **NÓTESE**: el ganador por fom (−0.417) **NO es el mejor fom de toda la tabla** (−0.398 en 0.071).
**El fom solo decide ENTRE LOS FACTIBLES.** Un optimizador ingenuo que minimice fom sin filtrar
primero da la respuesta equivocada.

### 7.7 ⭐⭐ EL RETORNO AL CATÁLOGO (impresa 552) — el paso que nadie programa

> *"**Having designed a spring, will we have it made to our specifications? Not necessarily.** There
> are vendors who stock **literally thousands of music wire compression springs**. By browsing their
> catalogs, we will usually find several that are close. Maximum deflection and maximum load are
> listed in the display of characteristics. **Check to see if this allows soliding without damage.
> Often it does not.** Spring rates may only be close. At the very least this situation allows a
> small number of springs to be ordered "off the shelf" for testing. **The decision often hinges on
> the economics of special order versus the acceptability of a close match.**"*
→ **REQUISITO**: después de diseñar, el software debe **buscar en catálogo de stock** y presentar el
trade-off "orden especial vs. match cercano". Y **verificar que el resorte de catálogo aguante
cerrarse a sólido sin daño** — "often it does not".

### 7.8 Ejemplo 10-3 — LA OTRA ENTRADA: empezar por C, no por d (impresa 552–553)

> *"Spring design is **not a closed-form approach and requires iteration**. Example 10–2 provided an
> iterative approach […] by first selecting the wire diameter. **The diameter selection can be rather
> arbitrary.** In the next example, we will **first select a value for the spring index C**, which is
> within the recommended range."*

Camino alterno:
```
Ssy = 0.45·(A/d^m)                                                 (1)
τmax = KB·8·Fmax·D/(πd³) = KB·8·Fmax·C/(πd²)                       (2)
KB = (4C+2)/(4C−3)                                                 (3)
(0.45/ns)(A/d^m) = KB·8·Fmax·C/(πd²)·(10⁻³)                        (4)
d = [0.163·KB·C/A]^(1/(2−m))                                       (5)
ns = 7.363·A·d^(2−m)/(KB·C)                                        (6)
```
(Las constantes 0.163 y 7.363 salen de la conversión kpsi/lbf/in del libro; están literales en el texto.)

⭐⭐ **ITERACIÓN EXPLÍCITA (Ej. 10-3)**:
1. C = 10 → KB = 1.135 → d = 0.09160 in
2. Tabla A-25 → calibre W&M 12, d = 0.1055 → ns = 1.55 → *"which is **pretty conservative**"*
3. Se prueba calibre 13, d = 0.0915 → n = 1.198 ≈ 1.2. → *"**Taking a little liberty here** we will
   select the W&M 13-gauge wire."* ⭐ **el cliente redondea 1.198 a 1.2 "tomándose una libertad"**
4. k = F/y = 18/2.25 = 8 lbf/in → **Na = 16.4 turns**
5. ⚠️ *"**This exceeds the recommended range of 3 ≤ Na ≤ 15. To decrease Na, increase C.**"*
   ← **DISPARADOR DE ITERACIÓN NOMBRADO: violación de Na ⇒ subir C.**
6. Repetir con C = 12 → KB = 1.111 → d = 0.1001 → calibre 12 (d = 0.1055) → n = 1.32 aceptable →
   Na = 10.97 ≈ **11 turns** ✔
7. Plain ends → Nt = Na = 11; ys = Fmax/k = 3 in; Ls = d(Nt+1) = 1.266; L0 = 4.266;
   D = C·d = 1.266; OD = 1.372
8. Pandeo: `α < 2.63·D/L0 = 0.780` → *"From Table 10–2, the spring is **stable provided it is
   supported between either fixed-fixed or fixed-hinged ends**."*
   ⭐ **El resultado del chequeo de pandeo es una RESTRICCIÓN DE MONTAJE que sale hacia el ensamble**,
   no un pass/fail interno.

**REQUISITO**: dos modos de entrada al diseñador — *"barrer d"* y *"fijar C"* — y ambos convergen a
la misma tabla de verificación.

---

## §10-8 Frecuencia crítica (impresa 554–555)

Ecuación de onda: `∂²u/∂x² = (W/(k·g·l))·∂²u/∂t²` **(10–24)**

```
ω = mπ·sqrt(k·g/W)      m = 1,2,3,…
f = (1/2)·sqrt(k·g/W)                         (10–25)  ambos extremos contra placas planas
f = (1/4)·sqrt(k·g/W)                         (10–26)  un extremo contra placa, otro LIBRE
W = A·L·γ = (πd²/4)(πD·Na)(γ) = π²d²D·Na·γ/4  (10–27)  peso de la parte ACTIVA
```
Nota: la Ec. (10–25) también aplica cuando **un extremo va contra placa plana y el otro se excita con
movimiento senoidal**.

⭐⭐ **REGLA EN PROSA (§10-8)**: *"The **fundamental critical frequency should be greater than 15 to
20 times** the frequency of the force or motion of the spring in order to **avoid resonance with the
harmonics**. **If the frequency is not high enough, the spring should be redesigned to increase k or
decrease W.**"*
→ "La frecuencia crítica fundamental debe ser **15 a 20 veces** la frecuencia de la fuerza o del
movimiento. Si no alcanza, **rediseña para subir k o bajar W**."
**ITERACIÓN NOMBRADA**: fn insuficiente ⇒ regresar y **subir k o bajar W**.

⭐ Contexto de por qué le importa: *"Spring manufacturers have taken slow-motion movies of automotive
valve-spring surge. These pictures show a **very violent surging, with the spring actually jumping
out of contact with the end plates**."* Figura 10-4 es la **foto de una falla real** de resorte de
válvula (fractura a 45°, torsión pura).

---

## §10-9 Fatiga de resortes helicoidales de compresión (impresa 555–560)

### Shot peening
⭐ *"To improve the fatigue strength of dynamically loaded springs, **shot peening can be used** to
induce compressive stresses on the surface of the wire. It **can increase the torsional fatigue
strength by 20 percent or more**. **Shot size is about 1/64 in**, so **spring coil wire diameter and
pitch must allow for complete coverage of the spring surface**."*
→ "El granallado sube la resistencia a fatiga en torsión ≥ 20 %. El perdigón mide ~1/64 in, así que
el diámetro de alambre y el paso **tienen que permitir cobertura completa**." ⚠️ **Restricción
geométrica que sale del proceso de manufactura, no de la mecánica.**

### Por qué NO usa el cap. 6
> *"The methods from Chapter 6 could be used to estimate the endurance limit, but **they are not
> ideal for helical coil springs**. The endurance limit estimates from Chapter 6 are based on
> **completely reversed bending** stresses. The stresses in helical coil springs are **torsional shear
> stresses, and are never completely reversed**. Helical springs are loaded from a minimum preload
> (perhaps zero) to a maximum load, creating a **positive mean shear stress that is always equal to
> or greater than the alternating shear stress**."*

### ⭐⭐ DATOS DE ZIMMERLI (Ec. 10-28)
> *"He discovered the **surprising fact** that for springs cycled between a minimum and maximum load,
> the **size, material, and tensile strength have no effect on the endurance limits (infinite life
> only)** of spring steels in sizes **under 3/8 in (10 mm)**. […] he **preloaded unpeened springs at
> 20 kpsi**, and tested to find the repeatedly applied maximum stress that would produce fatigue
> failure at 10⁶ cycles. He found this **maximum stress to be 90 kpsi**, regardless of wire size for
> any of the standard spring steels. **For peened springs, the maximum was found to be 135 kpsi.**"*

```
Unpeened (sin granallar):
    Ssa = 35 kpsi (241 MPa)      Ssm = 55 kpsi (379 MPa)      (10–28a)
Peened (granallado):
    Ssa = 57.5 kpsi (398 MPa)    Ssm = 77.5 kpsi (534 MPa)    (10–28b)
```
Rango probado: unpeened 20→90 kpsi; peened 20→135 kpsi. Corresponde a la **frontera entre vida finita
e infinita, o sea 10⁶ ciclos** para aceros de resorte. Aplica **para cualquier acero de resorte con
d < 3/8 in (10 mm)**.

⚠️⚠️ **ADVERTENCIA DEL CLIENTE**: *"To be clear, **Zimmerli's constant endurance limit applies
specifically to the loading condition of a spring, and is therefore NOT the same as the usual
endurance limit associated with completely reversed loading**."*

### Ssu y los criterios en cortante
```
Ssu = 0.67·Sut                                              (10–30)  módulo de ruptura en torsión
Sse = Ssa / (1 − Ssm/Ssu)                                   (10–29a) GOODMAN
Sse = Ssa / (1 − (Ssm/Ssu)²)                                (10–29b) GERBER
```
> *"**The Gerber criterion is one of the more commonly used for springs.**"*
> Ejemplo numérico del libro: con Ssu = 211.5 kpsi, unpeened → Gerber da Sse = 37.5 kpsi;
> Goodman daría **47.3 kpsi**.
> ⚠️ *"**An oddity of this approach is that an increased ultimate strength leads to a smaller,
> completely reversed endurance limit.** However, in actual spring loading, the mean stress is always
> equal to or greater than the alternating stress, so the load line never comes close to the
> completely reversed condition."*

### Criterio de Sines
> *"An extended study of available literature regarding torsional fatigue found that **for polished,
> notch-free, cylindrical specimens** subjected to torsional shear stress, the **maximum alternating
> stress that may be imposed without causing failure is constant and independent of the mean stress**
> in the cycle **provided that the maximum stress range does not equal or exceed the torsional yield
> strength**. **With notches and abrupt section changes this consistency is not found. Springs are
> free of notches and surfaces are often very smooth.**"*
→ Sines: `nf = Ssa/τa` (ignora Ssm).

### Esfuerzos
```
Fa = (Fmax − Fmin)/2                            (10–31a)
Fm = (Fmax + Fmin)/2                            (10–31b)
τa = KB·8·Fa·D/(πd³)                            (10–32)
τm = KB·8·Fm·D/(πd³)                            (10–33)
```
> *"Helical springs […] are **never used as both compression and extension springs**. In fact, they
> are usually assembled with a **preload** so that the working load is additional. […] **The worst
> condition, then, would occur when there is no preload, that is, when τmin = 0.**"*

### ⭐⭐ EL VEREDICTO SOBRE CUÁL CRITERIO USAR (impresa 560) — puro juicio humano
> *"We used three approaches […] The results, in order of smallest to largest, were **1.18 (Sines),
> 1.21 (Gerber), and 1.23 (Goodman)**. Although the results were very close to one another, **using
> the Zimmerli data as we have, the Sines criterion will always be the most conservative and the
> Goodman the least. If we perform a fatigue analysis using strength properties as was done in
> Chapter 6, different results would be obtained, but here the Goodman criterion would be more
> conservative than the Gerber criterion.** **Be prepared to see designers or design software using
> any one of these techniques.** This is why we cover them. **Which criterion is correct? Remember,
> we are performing estimates and only testing will reveal the truth—statistically.**"*
→ **REQUISITO**: el software debe soportar **los tres criterios como opción del usuario** y advertir
que el ORDEN de conservadurismo **se invierte** según se usen datos Zimmerli o propiedades del cap. 6.
**No hay "el correcto".**

---

## §10-10 ⭐⭐⭐ DISEÑO PARA CARGA DE FATIGA (impresa 560–563)

El libro NO da un diagrama de flujo nuevo. Lo declara así (§10-10, primer párrafo):
> *"Let us begin with the statement of a problem. **In order to compare a static spring to a dynamic
> spring, we shall design the spring in Example 10–2 for dynamic service.**"*

Es decir: **mismo esqueleto de §10-7 (barrer d, tabla, inspección, fom), sustituyendo la ecuación de
resistencia**.

### 10.1 Decisiones a priori (Ej. 10-5, lista literal)

Problema: música, **vida infinita**, carga dinámica de 5 a 20 lbf **a 5 Hz**, deflexión de 1/2 a 2 in.
Ls ≤ 1 in, L0 ≤ 4 in. **Tamaños en stock del fabricante: 0.069, 0.071, 0.080, 0.085, 0.090, 0.095,
0.105, 0.112 in.** ⭐ (el catálogo del proveedor es una ENTRADA, no una tabla universal)

- Material y condición: music wire, A = 201 kpsi·in^m, m = 0.145, G = 11.75(10⁶) psi, **costo
  relativo 2.6**
- **Tratamiento superficial: unpeened**
- **Tratamiento de extremos: squared and ground**
- **Linealidad robusta: ξ = 0.15**
- **Set: usar en condición as-wound**
- **Seguro a fatiga: nf = 1.5** usando el criterio **Sines-Zimmerli**
- Función: Fmin = 5, Fmax = 20 lbf, ymin = 0.5, ymax = 2 in, **el resorte opera libre (sin varilla ni
  barreno)**
- Variable de decisión: **tamaño de alambre d**
- fom = costo del alambre, Ec. (10–22) **sin densidad**
- *"The design strategy will be to **set wire size d, build a table, inspect the table, and choose
  the satisfactory spring with the highest figure of merit**."*

### 10.2 ⭐⭐ EL TRUCO CLAVE: reutilizar la Ec. (10-23) con SUSTITUCIONES

> *"**Equation (10–23) can be used to determine C with Sse, nf, and Fa in place of Ssy, ns, and
> (1+ξ)Fmax, respectively.**"*

```
α = Sse/nf              (en vez de Ssy/ns)
β = 8·Fa/(πd²)          (en vez de 8(1+ξ)Fmax/(πd²))
C = (2α − β)/(4β) + sqrt[ ((2α−β)/(4β))² − 3α/(4β) ]     (10–23), raíz mayor
```
⭐⭐⭐ **ESTE ES EL "1 CAMBIO" ENTRE ESTÁTICO Y FATIGA.** El mismo motor con otro par (α, β).
Un implementador que escriba dos solvers separados duplica código y diverge.

### 10.3 La secuencia de cálculo por renglón (Ej. 10-5, literal)

```
Fa = (Fmax − Fmin)/2                    Fm = (Fmax + Fmin)/2
k  = Fmax/ymax
Sut = A/d^m       Ssu = 0.67·Sut        Ssy = 0.45·Sut
Sse = Ssa = 35 kpsi          [Sines + Zimmerli unpeened]
α = Sse/nf ;  β = 8Fa/(πd²) ;  C por (10–23)
D = C·d
Fs = (1 + ξ)·Fmax
Na = d⁴G/(8·D³·k)                       ← ¡con k, no con Fmax!
Nt = Na + 2                             [squared and ground]
Ls = d·Nt
L0 = Ls + Fs/k
ID = D − d ;  OD = D + d
ys = L0 − Ls
(L0)cr = 2.63·D/α_end                   [α_end = 0.5]
KB = (4C+2)/(4C−3)
W  = π²d²·D·Na·γ/4                      [γ = 0.284 lbf/in³ para acero en el ejemplo]
fn = 0.5·sqrt(386·k/W)                  [Hz, unidades in-lbf-s]
τa = KB·8·Fa·D/(πd³)
τm = τa·(Fm/Fa)
τs = τa·(Fs/Fa)                         ← truco: escalar por relación de fuerzas
nf = Ssa/τa                             [Sines]
ns = Ssy/τs                             ← FS a cierre, TAMBIÉN se verifica en fatiga
fom = −(costo rel.)·π²·d²·Nt·D/4
```
⭐ **DETALLE**: `τm` y `τs` se obtienen **escalando τa por la razón de fuerzas** (`τa·Fm/Fa`,
`τa·Fs/Fa`), no recalculando. Barato y consistente.

### 10.4 La tabla del Ej. 10-5 — TRANSCRITA

| d: | 0.069 | 0.071 | 0.080 | 0.085 | 0.090 | 0.095 | 0.105 | 0.112 |
|---|---|---|---|---|---|---|---|---|
| D | 0.297 | 0.332 | 0.512 | 0.632 | 0.767 | 0.919 | 1.274 | 1.569 |
| ID | 0.228 | 0.261 | 0.432 | 0.547 | 0.677 | 0.824 | 1.169 | 1.457 |
| OD | 0.366 | 0.403 | 0.592 | 0.717 | 0.857 | 1.014 | 1.379 | 1.681 |
| C | 4.33 | 4.67 | 6.40 | 7.44 | 8.53 | 9.67 | 12.14 | 14.00 |
| Na | 127.2 | 102.4 | 44.8 | 30.5 | 21.3 | 15.4 | 8.63 | 6.0 |
| Ls | 8.916 | 7.414 | 3.740 | 2.750 | 2.100 | 1.655 | 1.116 | 0.895 |
| L0 | 11.216 | 9.714 | 6.040 | 5.050 | 4.400 | 3.955 | 3.416 | 3.195 |
| (L0)cr | 1.562 | 1.744 | 2.964 | 3.325 | 4.036 | 4.833 | 6.703 | 8.250 |
| nf | 1.50 | 1.50 | 1.50 | 1.50 | 1.50 | 1.50 | 1.50 | 1.50 |
| ns | 1.86 | 1.85 | 1.82 | 1.81 | 1.79 | 1.78 | 1.75 | 1.74 |
| fn | 87.5 | 89.7 | 96.9 | 99.7 | 101.9 | 103.8 | 106.6 | 108 |
| fom | −1.17 | −1.12 | −0.983 | −0.948 | −0.930 | −0.927 | −0.958 | −1.01 |

### 10.5 ⭐⭐ LAS DOS FAMILIAS DE RESTRICCIONES (transcritas literalmente)

**Restricciones específicas del problema** (vienen del cliente/ensamble):
```
Ls ≤ 1 in
L0 ≤ 4 in
fn ≥ 5(20) = 100 Hz            ← ¡el "20×" de §10-8 aplicado a los 5 Hz de excitación!
```
**Restricciones generales** (del método, siempre):
```
3 ≤ Na ≤ 15
4 ≤ C ≤ 12
(L0)cr > L0
```
⭐⭐ **REQUISITO DE ARQUITECTURA**: el motor debe distinguir **restricciones del problema** de
**restricciones del método**. El cliente negocia unas y no las otras (ver abajo).

### 10.6 ⭐⭐⭐ EL DESENLACE — LA NEGOCIACIÓN (impresa 562, literal)

> *"**We see that none of the diameters satisfy the given constraints.** The 0.105-in-diameter wire is
> the closest to satisfying all requirements. **The value of C = 12.14 is not a serious deviation and
> can be tolerated.** However, the **tight constraint on Ls needs to be addressed**. **If the assembly
> conditions can be relaxed to accept a solid height of 1.116 in, we have a solution. If not, the only
> other possibility is to use the 0.112-in diameter and accept a value C = 14, individually package
> the springs, and possibly reconsider supporting the spring in service.**"*

→ Traducción: "Ningún diámetro cumple. El de 0.105 in es el que más se acerca. **C = 12.14 no es
desviación seria y se tolera.** Pero Ls aprieta: **si el ensamble acepta 1.116 in de altura sólida,
ya tenemos solución. Si no, la única otra posibilidad es 0.112 in, aceptar C = 14, empacar los
resortes individualmente, y posiblemente reconsiderar cómo se apoya el resorte en servicio.**"

⭐⭐⭐ **ESTO ES EL ORO DEL CAPÍTULO 10.** Requisitos que salen de aquí:
1. El resultado normal es **"ninguno cumple"** — el software NO puede fallar con "sin solución".
2. Debe reportar **el más cercano** y **por cuánto viola cada restricción**.
3. Debe saber que **C = 12.14 se tolera** pero **Ls = 1.116 vs 1 in hay que negociarlo con el
   ensamble**. → **jerarquía de "negociabilidad" por restricción**.
4. Debe **encadenar consecuencias**: aceptar C = 14 **implica empacar individualmente** (la razón
   original de la cota C ≤ 12) **y reconsiderar el soporte** (porque (L0)cr y α cambian el juego).
5. La salida útil es un **conjunto Pareto con violaciones etiquetadas**, no un ganador único.

---

## §10-11 Resortes de extensión (impresa 563–570)

### Diferencias declaradas
> *"Extension springs differ from compression springs in that they **carry tensile loading**, they
> **require some means of transferring the load** from the support to the body of the spring, and the
> spring body is **wound with an initial tension**."*
> *"The load transfer can be done with a threaded plug or a swivel hook; **both of these add to the
> cost** of the finished product."*
> ⭐ *"Stresses in the body of the extension spring are handled the **same as compression springs**.
> **In designing a spring with a hook end, bending and torsion in the hook must be included in the
> analysis.**"*

### ⭐⭐ LOS DOS PUNTOS DEL GANCHO — A y B

**Punto A — flexión + carga axial (en el plano de la espira final):**
```
σA = F·[ (K)A·16D/(πd³) + 4/(πd²) ]                     (10–34)
(K)A = (4C₁² − C₁ − 1)/(4C₁(C₁ − 1)) ,    C₁ = 2r₁/d    (10–35)
```
**Punto B — torsión (a 90° del plano de la espira final):**
```
τB = (K)B·8FD/(πd³)                                     (10–36)
(K)B = (4C₂ − 1)/(4C₂ − 4) ,               C₂ = 2r₂/d   (10–37)
```
⭐⭐ **DETALLE GEOMÉTRICO CRÍTICO (nota de la Fig. 10-6, literal)**: *"Radius **r₁ is in the plane of
the end coil** for curved beam bending stress. Radius **r₂ is at a right angle to the end coil** for
torsional shear stress."*
→ **r₁ y r₂ son DOS radios distintos, en planos perpendiculares.** Un implementador que use "el radio
del gancho" (uno solo) calcula mal uno de los dos puntos.

⭐ *"Figures 10–6c and d show an **improved design due to a reduced coil diameter**."*
→ **Existe una variante de diseño de gancho que reduce el esfuerzo bajando el diámetro de la espira
del extremo.**

⭐ En el Ej. 10-6: nA = 1.27 (flexión en A) vs nB = 1.35 (torsión en B) →
*"**Yield due to bending of the end hook will occur first.**"* → El gancho manda, no el cuerpo
(n_cuerpo = 1.45).

### Tensión inicial y geometría
```
F = Fi + k·y                                            (10–38)
L0 = 2(D − d) + (Nb + 1)d = (2C − 1 + Nb)·d             (10–39)
Na = Nb + G/E                                           (10–40)  ← ¡corrección por deflexión de los lazos!
```
⭐ *"Spring manufacturers **prefer some initial tension in close-wound springs in order to hold the
free length more accurately**."*
⭐ *"The initial tension […] is created in the winding process by twisting the wire as it is wound
onto the mandrel. **When the spring is completed and removed from the mandrel, the initial tension is
locked in because the spring cannot get any shorter.**"*

⭐⭐ **RANGO PREFERIDO DE TENSIÓN INICIAL (Ec. 10-41)** — esto es capacidad de manufactura codificada:
```
τi = 33 500/exp(0.105·C) ± 1000·(4 − (C − 3)/6.5)   psi         (10–41)
```
> *"The amount of initial tension that a springmaker **can routinely incorporate** is as shown in
> Figure 10–7c."*
Y la figura 10-7c etiqueta zonas: **"Preferred range"**, **"Available upon special request from
springmaker"**, **"Difficult to attain"** (arriba), **"Difficult to control"** (abajo).
→ **REQUISITO**: el software debe clasificar τi en esas 4 zonas, no solo aceptar/rechazar.

### ⭐ TABLA 10-7 — Esfuerzos máximos permisibles (corregidos por KW o KB), extensión ESTÁTICA — TRANSCRITA

| Materiales | En torsión — Cuerpo | En torsión — Extremo | En flexión — Extremo |
|---|---|---|---|
| Aceros al carbono y baja aleación, patentados/estirados en frío o templados y revenidos | 45–50 % | 40 % | 75 % |
| Inoxidable austenítico y aleaciones no ferrosas | 35 % | 30 % | 55 % |

(% de la resistencia a tensión.) Condiciones: *"set not removed and low temperature heat treatment
applied. **For springs that require high initial tension, use the same percent of tensile strength as
for end.**"*
⭐⭐ **TRES resistencias distintas para UN resorte**: cuerpo-torsión, extremo-torsión, extremo-flexión.

### Fatiga de resortes de extensión (Ej. 10-7)
Cuatro factores de seguridad separados: **(a) fatiga del cuerpo, (b) fluencia del cuerpo, (c) fatiga
por flexión del gancho en A, (d) fatiga por torsión del gancho en B.**
⭐⭐ **Línea de carga con tensión inicial (impresa 568, literal)**: *"**The load-line for the coil body
begins at Ssm = τi and has a slope r = τa/(τm − τi).** It can be shown that the intersection with the
yield line is given by **(Ssa)y = [r/(r + 1)]·(Ssy − τi)**."*
→ **La línea de carga NO sale del origen.** Sale de la tensión inicial. Puro detalle que se salta un
traductor de ecuaciones.
Para el gancho en A: `Se = Sse/0.577` (pasar de cortante a tensión por distorsión-energía).

---

## §10-12 Resortes de torsión helicoidales (impresa 570–577)

⭐ *"The most frequently encountered (and **least expensive**) end is the **straight torsion end**."*
⭐ *"**If intercoil friction is to be avoided completely, the spring can be wound with a pitch that
just separates the body coils.**"*
⭐ *"Helical coil torsion springs are **usually used with a rod or arbor** for reactive support when
ends cannot be built in, to maintain alignment, and to **provide buckling resistance** if necessary."*
⭐ *"The bending mode in the coil might seem to invite square- or rectangular-cross-section wire, but
**cost, range of materials, and availability discourage its use**."*
⭐ *"There are **many stock springs that can be purchased off-the-shelf** from a vendor. This selection
can add **economy of scale to small projects, avoiding the cost of custom design and small-run
manufacture**."*

### ⭐⭐ EL RESORTE SE APRIETA EN SERVICIO — la regla direccional
> *"The springs are **designed to wind tighter in service**. As the applied torque increases, **the
> inside diameter of the coil decreases**. **Care must be taken so that the coils do not interfere
> with the pin, rod, or arbor.**"*
> *"[…] residual stresses built in during winding are in the **same direction but of opposite sign**
> to the working stresses […] The strain-strengthening **locks in residual stresses opposing working
> stresses PROVIDED THE LOAD IS ALWAYS APPLIED IN THE WINDING SENSE**. **Torsion springs can operate
> at bending stresses exceeding the yield strength of the wire from which it was wound.**"*
→ ⭐⭐ **REQUISITO**: hay un **sentido de carga** obligatorio. Si el software permite cargar en el
sentido de desenrollar, **el residual se vuelve en contra y toda la premisa se cae**.

### Ubicación de extremos
```
Nb = entero + β/360° = entero + Np
```
⚠️⚠️ *"The above equation means that **Nb takes on noninteger, discrete values such as 5.3, 6.3,
7.3, …, with successive differences of 1** as possibilities in designing a specific spring."*
→ **Nb es una variable DISCRETA con parte fraccionaria FIJA** determinada por el ángulo β entre
extremos. No puedes redondear Nb libremente. Y luego (Ec. 10-56) *"This angle **may not be in
agreement with the necessary partial-turn remainder**. Thus the **diametral clearance may be exceeded
but not equaled**."*

**TABLA 10-9 — Tolerancias de posición de extremos** (para D/d hasta 16 inclusive) — TRANSCRITA:

| Espiras totales | Tolerancia: ± grados |
|---|---|
| Hasta 3 | 8 |
| Más de 3–10 | 10 |
| Más de 10–20 | 15 |
| Más de 20–30 | 20 |
| Más de 30 | 25 |

\* *"Closer tolerances available on request."*

### Esfuerzo de flexión
```
Ki = (4C² − C − 1)/(4C(C − 1))       Ko = (4C² + C − 1)/(4C(C + 1))      (10–43)
σ = Ki·32·F·r/(πd³)                                                       (10–44)
```
⭐ *"**In view of the fact that Ko is always less than unity, we shall use Ki** to estimate the
stresses."*

### Deflexión y razón
```
θe = 64·M·l/(3πd⁴E)                                       (10–46)  corrección por extremo recto
θt = (64MD/d⁴E)·(Nb + (l₁+l₂)/(3πD))                      (10–47)
Na = Nb + (l₁ + l₂)/(3πD)                                 (10–48)
k = M/θt = d⁴E/(64·D·Na)                                  (10–49)  [torque/radián]
k' = d⁴E/(10.2·D·Na)                                      (10–50)  [torque/vuelta, teórico]
k' = d⁴E/(10.8·D·Na)                                      (10–51)  ⭐ CORREGIDO POR FRICCIÓN
θ't = (10.8·M·D/(d⁴E))·(Nb + (l₁+l₂)/(3πD))               (10–52)
```
⭐⭐ *"**Tests show that the effect of friction between the coils and arbor is such that the constant
10.2 should be increased to 10.8.** […] **Equation (10–51) gives better results.**"*
→ **Constante empírica que sustituye a la teórica. Un implementador que derive de primeros principios
usa 10.2 y se equivoca sistemáticamente ~6 %.**

### Interferencia con el perno (¡el chequeo que se olvida!)
```
D' = Nb·D/(Nb + θ'c)                                      (10–53)
θ'c = 10.8·M·D·Nb/(d⁴E)                                   (10–54)
Δ = D' − d − Dp = Nb·D/(Nb + θ'c) − d − Dp                (10–55)
Nb = θ'c(Δ + d + Dp)/(D − Δ − d − Dp)                     (10–56)
```
> *"It is necessary to ensure that the **inside diameter of the coil never becomes equal to or less
> than the diameter of the pin, in which case loss of spring function would ensue**."*

### Resistencia estática (Ec. 10-57) — entradas de la tabla 10-6 divididas entre 0.577
```
Sy = 0.78·Sut   → music wire y aceros al carbono estirados en frío
Sy = 0.87·Sut   → aceros al carbono y baja aleación OQ&T
Sy = 0.61·Sut   → inoxidable austenítico y aleaciones no ferrosas
```

### Resistencia a fatiga
⭐⭐ *"**Since the spring wire is in bending, the Sines equation is not applicable. The Sines model is
in the presence of pure torsion. Since Zimmerli's results were for compression springs (wire in pure
torsion)**, we will use the **repeated bending stress (R = 0)** values provided by Associated Spring
in Table 10–10."*
```
Se = (Sr/2) / (1 − (Sr/2 / Sut)²)                         (10–58)   [Gerber]
nf = (1/2)(Sut/σm)²(σa/Se)·[−1 + sqrt(1 + (2σm·Se/(Sut·σa))²)]   (10–59)
```

### ⭐ TABLA 10-10 — Esfuerzos de flexión máximos recomendados (corregidos por KB), % de Sut — TRANSCRITA

| Vida a fatiga, ciclos | A228 y 302 SS, **no** granallado | A228 y 302 SS, **granallado**\* | A230/A232, **no** granallado | A230/A232, **granallado**\* |
|---|---|---|---|---|
| 10⁵ | 53 | 62 | 55 | 64 |
| 10⁶ | 50 | 60 | 53 | 62 |

Condiciones: *"**no surging**, springs are in the **as-stress-relieved** condition."*
\* *"Not always possible."*
Y: *"The value of Sr (and Se) has been **corrected for size, surface condition, and type of loading,
but NOT for temperature or miscellaneous effects**."*
⚠️ **Un implementador aplicaría ka·kb·kc·kd·ke del cap. 6 encima → doble corrección.**

---

## §10-13 Resortes Belleville (impresa 577)

> *"Although the **mathematical treatment is beyond the scope of this book**, you should at least
> become familiar with the **remarkable characteristics** of these springs."*
> **NO hay ecuaciones de Belleville en el texto extraído.** Solo la figura 10-11 (curvas
> carga-deflexión) y estas reglas:

⭐ *"variation in the **h/t ratio** will produce a wide variety of load-deflection curve shapes":*
- **h/t ≥ 2.83** → *"gives an **S curve** that might be useful for **snap-acting mechanisms**"*
- **1.41 ≤ h/t ≤ 2.1** → *"causes the **central portion of the curve to become horizontal**, which
  means that **the load is constant over a considerable deflection range**"*
- (la figura 10-11 grafica h/t = 0, 0.7, 1.41, 2.1, 2.83, 3.50)

⭐ *"A **higher load** for a given deflection may be obtained by **nesting**, that is, by stacking the
springs **in parallel**. On the other hand, stacking **in series** provides a **larger deflection** for
the same load, but **in this case there is danger of instability**."*
⭐ *"a Belleville spring **occupies only a small space**"*

---

## §10-14 Resortes misceláneos (impresa 578–580) — breve

- **Constant-force spring** (Fig. 10-12): tira de acero ligeramente curvada, no plana → fuerza
  constante al desenrollar = **razón de resorte cero**. *"Such springs can also be manufactured having
  either a positive or a negative spring rate."*
- **Volute spring** (Fig. 10-13a): tira ancha y delgada enrollada de plano, las espiras caben una
  dentro de otra → **la altura sólida es el ancho de la tira**. Escala variable por contacto con el
  apoyo (Na disminuye con la deflexión). ⭐ Ventaja única: *"if the coils are wound so as to contact or
  slide on one another during action, the **sliding friction will serve to damp out vibrations** or
  other unwanted transient disturbances."*
- **Conical spring**: *"can be wound so that the **solid height is only a single wire diameter**."*
- **Flat triangular (constant-stress) spring** (Fig. 10-13b): h constante, b variable.
  ```
  b = 6Fx/(hσ²)  … el libro escribe b = 6Fx/(h²σ)  → b0 = 6Fl/(h²σ)      (10–60)
  y = 6Fl³/(b0·h³·E)                                                       (10–61)
  k = b0·h³·E/(6·l³)                                                       (10–62)
  ```
  ⚠️ Nota al pie 14 del libro: *"because of shear, the **width of the beam cannot be zero at x = 0**.
  So, **there is already some simplification in the design model**."*

## §10-15 Resumen (impresa 580)

> *"For compression springs undergoing static and fatigue loads, **the complete design process was
> presented. This was NOT done for extension and torsion springs**, as the process is the same,
> although the governing conditions are not. **The governing conditions, however, were provided** and
> extension to the design process […] should be straightforward."*
→ **REQUISITO**: el motor de barrido-tabla-fom es UNO, parametrizado por (ecuación de resistencia,
condiciones gobernantes, lista de chequeos). Compresión estática y fatiga son las dos instancias
documentadas; **extensión y torsión son instancias por construir con los mismos huesos.**

---
---

# PARTE II — CAPÍTULO 11: RODAMIENTOS DE CONTACTO RODANTE

## §11-1 Tipos (impresa 590–593)

⭐ *"From the mechanical designer's standpoint, the study of antifriction bearings differs in several
respects […] because **the bearings they specify have already been designed**."*
→ **No diseñamos rodamientos: SELECCIONAMOS de catálogo.** Toda la arquitectura del módulo cambia.

Partes esenciales (Fig. 11-1): **outer ring, inner ring, balls/rolling elements, separator**.
*"In low-priced bearings, the separator is sometimes omitted, but it has the important function of
separating the elements so that rubbing contact will not occur."*

**Bolas (Fig. 11-2)**: (a) deep groove, (b) filling notch, (c) angular contact, (d) shielded,
(e) sealed, (f) external self-aligning, (g) double row, (h) self-aligning, (i) thrust,
(j) self-aligning thrust.
**Rodillos (Fig. 11-3)**: (a) straight roller, (b) spherical roller thrust, (c) tapered roller thrust,
(d) needle, (e) tapered roller, (f) steep-angle tapered roller.

Reglas de selección de TIPO en prosa (§11-1):
- Deep groove: *"will take radial load as well as **some** thrust load"*
- Filling notch: *"enables a greater number of balls to be inserted, thus **increasing the load
  capacity**. **The thrust capacity is decreased**, however, because of the bumping of the balls
  against the edge of the notch when thrust loads are present."*
- Angular contact: *"provides a **greater thrust capacity**"*
- Shields: *"**not a complete closure** but do offer a measure of protection against dirt"*
- Sealed: *"When the seals are on both sides, the bearings are **lubricated at the factory**. Although
  a sealed bearing is supposed to be **lubricated for life**, a method of relubrication is sometimes
  provided."*
- *"Single-row bearings will withstand a **small amount of shaft misalignment**[…] but where this is
  severe, **self-aligning bearings may be used**."*
- *"**a double-row bearing will generally require fewer parts and occupy less space**"* que dos de una
  fila
- Straight roller: *"will carry a **greater radial load** than ball bearings of the same size because
  of the greater contact area. However, they have the disadvantage of **requiring almost perfect
  geometry of the raceways and rollers. A slight misalignment will cause the rollers to skew and get
  out of line. For this reason, the retainer must be heavy.** Straight roller bearings will **not**,
  of course, **take thrust loads**."*
- Helical rollers: *"Because of the inherent flexibility, they will **take considerable
  misalignment**. If necessary, **the shaft and housing can be used for raceways** instead of separate
  inner and outer races. This is especially important if **radial space is limited**."*
- Spherical-roller thrust: *"useful where **heavy loads and misalignment** occur. The spherical
  elements have the advantage of **increasing their contact area as the load is increased**."*
- Needle: *"very useful where **radial space is limited**. They have a **high load capacity when
  separators are used**, but may be obtained without separators."*
- Tapered roller: *"combine the advantages of ball and straight roller bearings, since they can take
  **either radial or thrust loads or any combination of the two**, and in addition, they have the
  **high load-carrying capacity of straight roller bearings**. […] designed so that **all elements in
  the roller surface and the raceways intersect at a common point on the bearing axis**."*

⭐ *"**You should include a survey of bearing manufacturers' literature in your studies of this
section.**"*

## §11-2 Vida del rodamiento (impresa 593–594)

⭐ **PRECONDICIÓN QUE VALIDA TODO EL MÉTODO** (literal): *"**If a bearing is clean and properly
lubricated, is mounted and sealed against the entrance of dust and dirt, is maintained in this
condition, and is operated at reasonable temperatures, then metal fatigue will be the only cause of
failure.**"*
→ **REQUISITO**: el módulo debe declarar esta precondición. Fuera de ella, **el número que calcula no
significa nada**.

Medidas de vida:
- número de revoluciones del aro interior (exterior fijo) hasta **la primera evidencia tangible de
  fatiga**
- número de horas de uso a velocidad angular estándar hasta lo mismo

Criterios de falla:
- ABMA: *"the failure criterion is the **first evidence of fatigue**"*
- ⭐ Timken: *"the **spalling or pitting of an area of 0.01 in²**. Timken also observes that **the
  useful life of the bearing may extend considerably beyond this point**."*

**Rating life / L10 / B10 / minimum life**: *"the number of revolutions (or hours at a constant speed)
that **90 percent** of a group of bearings will achieve or exceed before the failure criterion
develops"* = **percentil 10** de la distribución.

⚠️ *"**Median life** is the 50th percentile […] The term **average life** has been used as a synonym
for median life, **contributing to confusion**. When many groups of bearings are tested, **the median
life is between 4 and 5 times the L10 life**."*

⭐⭐ **VIDA NOMINAL POR FABRICANTE (¡indexación de catálogo!)**:
> *"**Each bearing manufacturer will choose a specific rating life** for which load ratings of its
> bearings are reported. The most commonly used rating life is **10⁶ revolutions**. **The Timken
> Company is a well-known exception, rating its bearings at 3000 hours at 500 rev/min, which is
> 90(10⁶) revolutions.** These levels of rating life are actually **quite low for today's bearings**,
> but since rating life is an **arbitrary reference point**, the traditional values have generally been
> maintained."*
→ **REQUISITO**: `L_R` es **un atributo del catálogo/fabricante**, no una constante global.
10⁶ vs 90(10⁶) es un factor de 90 en la vida — errarle es catastrófico.

## §11-3 Vida-carga a confiabilidad nominal (impresa 594–595)

```
F·L^(1/a) = constante                                    (11–1)
a = 3      para rodamientos de BOLAS
a = 10/3   para rodamientos de RODILLOS (cilíndricos y cónicos)
F1·L1^(1/a) = F2·L2^(1/a)                                (11–2)
L = 60·ℒ·n     (ℒ en horas, n en rev/min)                (b)
C10 = FR = FD·(LD/LR)^(1/a) = FD·(ℒD·nD·60/(ℒR·nR·60))^(1/a)     (11–3)
xD = LD/LR      (múltiplo adimensional de la vida nominal)
```
⭐ *"A catalog load rating is defined as **the radial load that causes 10 percent of a group of
bearings to fail at the bearing manufacturer's rating life**."* = **C₁₀** = *"Basic Dynamic Load
Rating"* (o solo *"Basic Load Rating"*) si la vida nominal es 10⁶ rev.
⚠️⚠️ *"**The radial load that would be necessary to cause failure at such a low life would be
unrealistically high. Consequently, the Basic Load Rating should be viewed as a REFERENCE VALUE, and
NOT as an actual load to be achieved by a bearing.**"*

Ej. 11-1: SKF (LR = 10⁶), 5000 h a 1725 rev/min, 400 lbf, R = 0.90 → C10 = 3211 lbf = 14.3 kN.

## §11-4 Confiabilidad vs. vida — la distribución de WEIBULL (impresa 596–597)

⭐ *"At constant load, the life measure distribution of rolling-contact bearings is **right skewed**.
Because of its **robust ability to adjust to varying amounts of skewness**, the **three-parameter
Weibull distribution is used exclusively** for expressing the reliability of rolling-contact
bearings."*

```
R = exp[ −((x − x0)/(θ − x0))^b ]                        (11–4)
```
Los tres parámetros (literal):
- **x0** = *"guaranteed, or 'minimum,' value of x"*
- **θ** = *"characteristic parameter. For rolling-contact bearings, this corresponds to the
  **63.2121 percentile** value of x"*
- **b** = *"shape parameter that controls the skewness. For rolling-contact bearings, **b ≈ 1.5**"*
- **x = L/L10** (adimensional)

```
f(x) = (b/(θ−x0))·((x−x0)/(θ−x0))^(b−1)·exp[−((x−x0)/(θ−x0))^b]   , x ≥ x0 ≥ 0   (11–5)
f(x) = 0                                                          , x < x0
μx = x0 + (θ − x0)·Γ(1 + 1/b)                                     (11–6)
σ̂x = (θ − x0)·sqrt[ Γ(1 + 2/b) − Γ²(1 + 1/b) ]                    (11–7)
x = x0 + (θ − x0)·(ln(1/R))^(1/b)                                 (11–8)
```
(Γ tabulada en Tabla A-34 — **no está en el texto extraído**.)

Ej. 11-2 (02-30 mm deep groove, x0 = 0.020, θ = 4.459, b = 1.483):
μx = **4.033** ("la vida promedio es 4.033·L10"), mediana **3.487·L10**, x0.10 ≈ **1** ("as it should
be" — chequeo de sanidad ⭐), σ̂x = **2.755**, CV = **0.683**.

### ⭐⭐ TABLA 11-6 — Parámetros Weibull típicos de DOS fabricantes — TRANSCRITA

> ⚠️ **Nota de la tarea**: se pidió "tabla 11-1: fabricantes 1 y 2". En esta edición esa tabla es la
> **Tabla 11-6**, y aparece en el preámbulo de los PROBLEMAS del cap. 11 (impresa 627), no en el
> cuerpo. La **Tabla 11-1** de esta edición es la de factores X e Y (ver §11-6).

| Fabricante | Vida nominal, revoluciones | x0 | θ | b |
|---|---|---|---|---|
| **1** | 90(10⁶) | **0** | **4.48** | **1.5** |
| **2** | 1(10⁶) | **0.02** | **4.459** | **1.483** |

Nota del libro: *"**Tables 11–2 and 11–3 are based on manufacturer 2.**"*
Y el preámbulo: *"Since each bearing manufacturer makes individual decisions with respect to
materials, treatments, and manufacturing processes, **manufacturers' experiences with bearing life
distribution differ**."*

⭐ Además, en §11-9 (impresa 616): *"**Timken uses a Weibull model with x0 = 0, θ = 4.48, and
b = 3/2.**"* → **Timken = fabricante 1.**

⭐⭐ **REQUISITO DE MODELO DE DATOS**: `(L_R, x0, θ, b)` es una **tupla por fabricante**, ligada al
catálogo del que sacas C₁₀. **Mezclarlas produce basura silenciosa.**

## §11-5 ⭐⭐ RELACIONAR CARGA, VIDA Y CONFIABILIDAD (impresa 597–599) — "the designer's problem"

> *"**This is the designer's problem.** The desired load is not the manufacturer's test load or
> catalog entry. The desired speed is different from the vendor's test speed, and **the reliability
> expectation is typically much higher than the 0.90 accompanying the catalog entry.**"*

El razonamiento gráfico (Fig. 11-5): del punto de diseño **D** (FD, xD, R = RD) hay que llegar al punto
de catálogo **A** (C10, x = 1, R = 0.90) **pasando por B**:
- **BD** = contorno de confiabilidad constante → aplica (11–2)
- **AB** = línea de carga constante → aplica (11–4)

```
xB = x0 + (θ − x0)·(ln(1/RD))^(1/b)

C10 = af·FD·[ xD / (x0 + (θ − x0)·(ln(1/RD))^(1/b)) ]^(1/a)          (11–9)

Simplificación:  ln(1/RD) ≈ 1 − RD = pf

C10 ≈ af·FD·[ xD / (x0 + (θ − x0)·(1 − RD)^(1/b)) ]^(1/a)   ,  R ≥ 0.90   (11–10)
```
⭐ *"Note that when **RD = 0.90, the denominator is equal to one**, and the equation reduces to
Equation (11–3)."* ← **chequeo de consistencia obligatorio en tests.**
⚠️ La Ec. (11–10) **solo vale para R ≥ 0.90**.
⭐ *"**The Weibull parameters are usually provided in the manufacturer's catalog.**"*

### El factor de aplicación af
> *"**The application factor serves as a factor of safety to increase the design load to take into
> account overload, dynamic loading, and uncertainty.**"*

### ⭐⭐⭐ REPARTO DE CONFIABILIDAD ENTRE DOS RODAMIENTOS (impresa 599) — juicio puro
> *"Shafts generally have two bearings. **Often these bearings are different.** If the bearing
> reliability of the shaft with its pair of bearings is to be R, then **R = RA·RB**.
> **First**, we observe that if the product RA·RB equals R, then, in general, **RA and RB are both
> greater than R**. Since the failure of either or both of the bearings results in the shutdown of the
> shaft, then A or B or both can create a failure.
> **Second**, in sizing bearings one can begin by **making RA and RB equal to the square root of the
> reliability goal, √R**. […] The bearings selected are **discrete in their reliability property**, so
> the selection procedure **"rounds up," and the overall reliability exceeds the goal R**.
> **Third**, it may be possible, **if RA > √R, to round DOWN on B** yet have the product RA·RB still
> exceed the goal R."*

⭐⭐ Y en el Ej. 11-7 con CUATRO rodamientos (dos ejes): *"The individual bearing reliabilities, if
equal, must be at least **⁴√0.96 = 0.98985 ≈ 0.99**."* → **la raíz es de orden n = número total de
rodamientos del conjunto**, no siempre 2.

⭐⭐ Y el remate en el Ej. 11-10: *"**When two bearings are made identical for simplicity, or reducing
the number of spares, or other stipulation, and the loading is not the same, BOTH can be made smaller
and still meet a reliability goal. If the loading is disparate, then the more heavily loaded bearing
can be chosen for a reliability goal just slightly larger than the overall goal.**"*
→ **REQUISITO**: el reparto de confiabilidad es una **variable de optimización**, no una constante
√R. Y hay una **razón NO técnica** para hacerlos idénticos: *"reducing the number of spares"*
(refacciones).

## §11-6 ⭐⭐ CARGA RADIAL Y AXIAL COMBINADA (impresa 599–604)

```
Fe/(V·Fr) = 1                    cuando  Fa/(V·Fr) ≤ e        (11–11a)
Fe/(V·Fr) = X + Y·Fa/(V·Fr)      cuando  Fa/(V·Fr) > e        (11–11b)

Fe = Xi·V·Fr + Yi·Fa                                          (11–12)
     i = 1 si Fa/(V·Fr) ≤ e ;   i = 2 si Fa/(V·Fr) > e
```

### ⭐ EL FACTOR DE ROTACIÓN V
> *"A rotation factor V is defined such that **V = 1 when the inner ring rotates and V = 1.2 when the
> outer ring rotates**."*
> *"the rotation factor V is intended to correct for the rotating-ring conditions. **The factor of 1.2
> for outer-ring rotation is simply an acknowledgment that the fatigue life is reduced under these
> conditions.** **Self-aligning bearings are an exception: they have V = 1 for rotation of either
> ring.**"*
⭐ *"Since **straight or cylindrical roller bearings will take no axial load, or very little, the Y
factor is always zero**."*

### ⭐⭐ TABLA 11-1 — Factores de carga radial equivalente para rodamientos de BOLAS — TRANSCRITA

Indexada por **Fa/C0** (C0 = basic static load rating).

| Fa/C0 | e | X1 | Y1 | X2 | Y2 |
|---|---|---|---|---|---|
| 0.014\* | 0.19 | 1.00 | 0 | 0.56 | 2.30 |
| 0.021 | 0.21 | 1.00 | 0 | 0.56 | 2.15 |
| 0.028 | 0.22 | 1.00 | 0 | 0.56 | 1.99 |
| 0.042 | 0.24 | 1.00 | 0 | 0.56 | 1.85 |
| 0.056 | 0.26 | 1.00 | 0 | 0.56 | 1.71 |
| 0.070 | 0.27 | 1.00 | 0 | 0.56 | 1.63 |
| 0.084 | 0.28 | 1.00 | 0 | 0.56 | 1.55 |
| 0.110 | 0.30 | 1.00 | 0 | 0.56 | 1.45 |
| 0.17 | 0.34 | 1.00 | 0 | 0.56 | 1.31 |
| 0.28 | 0.38 | 1.00 | 0 | 0.56 | 1.15 |
| 0.42 | 0.42 | 1.00 | 0 | 0.56 | 1.04 |
| 0.56 | 0.44 | 1.00 | 0 | 0.56 | 1.00 |

\* **"Use 0.014 if Fa/C0 < 0.014."** ← clamp inferior explícito.

⭐ **Se INTERPOLA linealmente** dentro de la tabla (así lo hace el libro en Ej. 11-4 y 11-7:
"Interpolate for e", "we find Y2 by interpolation"). **X2 = 0.56 constante; X1 = 1.00; Y1 = 0.**

### C0 — Basic Static Load Rating (definición literal)
> *"**The basic static load rating is the load that will produce a total permanent deformation in the
> raceway and rolling element at any contact point of 0.0001 times the diameter of the rolling
> element.**"* Se tabula junto con C10 en las publicaciones del fabricante.

### ⭐ EL LAZO CIRCULAR (¡de aquí sale la iteración de §11-8!)
**Y depende de e, e depende de Fa/C0, C0 depende del rodamiento elegido, y el rodamiento elegido
depende de C10, que depende de Fe, que depende de Y.** → **iteración obligatoria.**

### Plan ABMA de dimensiones límite (Fig. 11-7)
> *"The ABMA has established **standard boundary dimensions** for bearings, which define the **bearing
> bore, the outside diameter (OD), the width, and the fillet sizes on the shaft and housing
> shoulders**. The basic plan covers **all ball and straight roller bearings in the metric sizes**."*
> *"The bearings are identified by a **two-digit number called the dimension-series code**. The first
> number is from the **width series, 0,1,2,3,4,5,6**. The second number is from the **diameter series
> (outside), 8,9,0,1,2,3,4**."*
⚠️ *"Since the dimension-series code **does not reveal the dimensions directly, it is necessary to
resort to tabulations**."*
⚠️ **La Fig. 11-7 NO aplica a rodamientos de bolas en serie pulgada ni a rodamientos cónicos.**

### ⭐ TABLA 11-2 — 02-Series, bolas ranura profunda y contacto angular — TRANSCRITA

| Bore, mm | OD, mm | Width, mm | Fillet radius, mm | dS, mm | dH, mm | DG C10, kN | DG C0, kN | AC C10, kN | AC C0, kN |
|---|---|---|---|---|---|---|---|---|---|
| 10 | 30 | 9 | 0.6 | 12.5 | 27 | 5.07 | 2.24 | 4.94 | 2.12 |
| 12 | 32 | 10 | 0.6 | 14.5 | 28 | 6.89 | 3.10 | 7.02 | 3.05 |
| 15 | 35 | 11 | 0.6 | 17.5 | 31 | 7.80 | 3.55 | 8.06 | 3.65 |
| 17 | 40 | 12 | 0.6 | 19.5 | 34 | 9.56 | 4.50 | 9.95 | 4.75 |
| 20 | 47 | 14 | 1.0 | 25 | 41 | 12.7 | 6.20 | 13.3 | 6.55 |
| 25 | 52 | 15 | 1.0 | 30 | 47 | 14.0 | 6.95 | 14.8 | 7.65 |
| 30 | 62 | 16 | 1.0 | 35 | 55 | 19.5 | 10.0 | 20.3 | 11.0 |
| 35 | 72 | 17 | 1.0 | 41 | 65 | 25.5 | 13.7 | 27.0 | 15.0 |
| 40 | 80 | 18 | 1.0 | 46 | 72 | 30.7 | 16.6 | 31.9 | 18.6 |
| 45 | 85 | 19 | 1.0 | 52 | 77 | 33.2 | 18.6 | 35.8 | 21.2 |
| 50 | 90 | 20 | 1.0 | 56 | 82 | 35.1 | 19.6 | 37.7 | 22.8 |
| 55 | 100 | 21 | 1.5 | 63 | 90 | 43.6 | 25.0 | 46.2 | 28.5 |
| 60 | 110 | 22 | 1.5 | 70 | 99 | 47.5 | 28.0 | 55.9 | 35.5 |
| 65 | 120 | 23 | 1.5 | 74 | 109 | 55.9 | 34.0 | 63.7 | 41.5 |
| 70 | 125 | 24 | 1.5 | 79 | 114 | 61.8 | 37.5 | 68.9 | 45.5 |
| 75 | 130 | 25 | 1.5 | 86 | 119 | 66.3 | 40.5 | 71.5 | 49.0 |
| 80 | 140 | 26 | 2.0 | 93 | 127 | 70.2 | 45.0 | 80.6 | 55.0 |
| 85 | 150 | 28 | 2.0 | 99 | 136 | 83.2 | 53.0 | 90.4 | 63.0 |
| 90 | 160 | 30 | 2.0 | 104 | 146 | 95.6 | 62.0 | 106 | 73.5 |
| 95 | 170 | 32 | 2.0 | 110 | 156 | 108 | 69.5 | 121 | 85.0 |

(DG = deep groove, AC = angular contact. dS = diámetro de hombro del eje, dH = diámetro de hombro de
la caja.)

⭐ *"The **housing and shaft shoulder diameters listed in the tables should be used whenever possible**
to secure adequate support for the bearing and to **resist the maximum thrust loads**."*

### ⭐ TABLA 11-3 — Rodamientos de rodillos cilíndricos, series 02 y 03 — TRANSCRITA

| Bore, mm | 02: OD | 02: Width | 02: C10, kN | 02: C0, kN | 03: OD | 03: Width | 03: C10, kN | 03: C0, kN |
|---|---|---|---|---|---|---|---|---|
| 25 | 52 | 15 | 16.8 | 8.8 | 62 | 17 | 28.6 | 15.0 |
| 30 | 62 | 16 | 22.4 | 12.0 | 72 | 19 | 36.9 | 20.0 |
| 35 | 72 | 17 | 31.9 | 17.6 | 80 | 21 | 44.6 | 27.1 |
| 40 | 80 | 18 | 41.8 | 24.0 | 90 | 23 | 56.1 | 32.5 |
| 45 | 85 | 19 | 44.0 | 25.5 | 100 | 25 | 72.1 | 45.4 |
| 50 | 90 | 20 | 45.7 | 27.5 | 110 | 27 | 88.0 | 52.0 |
| 55 | 100 | 21 | 56.1 | 34.0 | 120 | 29 | 102 | 67.2 |
| 60 | 110 | 22 | 64.4 | 43.1 | 130 | 31 | 123 | 76.5 |
| 65 | 120 | 23 | 76.5 | 51.2 | 140 | 33 | 138 | 85.0 |
| 70 | 125 | 24 | 79.2 | 51.2 | 150 | 35 | 151 | 102 |
| 75 | 130 | 25 | 93.1 | 63.2 | 160 | 37 | 183 | 125 |
| 80 | 140 | 26 | 106 | 69.4 | 170 | 39 | 190 | 125 |
| 85 | 150 | 28 | 119 | 78.3 | 180 | 41 | 212 | 149 |
| 90 | 160 | 30 | 142 | 100 | 190 | 43 | 242 | 160 |
| 95 | 170 | 32 | 165 | 112 | 200 | 45 | 264 | 189 |
| 100 | 180 | 34 | 183 | 125 | 215 | 47 | 303 | 220 |
| 110 | 200 | 38 | 229 | 167 | 240 | 50 | 391 | 304 |
| 120 | 215 | 40 | 260 | 183 | 260 | 55 | 457 | 340 |
| 130 | 230 | 40 | 270 | 193 | 280 | 58 | 539 | 408 |
| 140 | 250 | 42 | 319 | 240 | 300 | 62 | 682 | 454 |
| 150 | 270 | 45 | 446 | 260 | 320 | 65 | 781 | 502 |

### ⭐⭐ TABLA 11-4 — Vida recomendada por clase de máquina — TRANSCRITA

| Tipo de aplicación | Vida, kh |
|---|---|
| Instrumentos y aparatos de uso **infrecuente** | Hasta 0.5 |
| **Motores de avión** | 0.5–2 |
| Máquinas de operación corta o intermitente donde **la interrupción del servicio es de importancia menor** | 4–8 |
| Máquinas de servicio intermitente donde **la operación confiable es de gran importancia** | 8–14 |
| Máquinas de servicio de 8 h **no siempre plenamente utilizadas** | 14–20 |
| Máquinas de servicio de 8 h **plenamente utilizadas** | 20–30 |
| Máquinas de **servicio continuo 24 h** | 50–60 |
| Máquinas de servicio continuo 24 h **donde la confiabilidad es de extrema importancia** | 100–200 |

⭐ **Fíjate en el eje de clasificación: NO es el tipo de máquina, es la CONSECUENCIA DE QUE FALLE.**
"importancia menor" vs "gran importancia" vs "extrema importancia". Puro juicio de riesgo.

### ⭐⭐ TABLA 11-5 — Factores de aplicación af — TRANSCRITA

| Tipo de aplicación | Factor de carga |
|---|---|
| **Engranaje de precisión** | 1.0–1.1 |
| **Engranaje comercial** | 1.1–1.3 |
| **Aplicaciones con sellos de rodamiento deficientes** | 1.2 |
| Maquinaria **sin impacto** | 1.0–1.2 |
| Maquinaria con **impacto ligero** | 1.2–1.5 |
| Maquinaria con **impacto moderado** | 1.5–3.0 |

⭐ *"The load-application factors in Table 11–5 **serve the same purpose as factors of safety**; use
them to **increase the equivalent load BEFORE selecting a bearing**."*
⭐⭐ Ojo: *"Applications with **poor bearing seals** → 1.2"*. **La CALIDAD DEL SELLO entra como factor
de carga.** Un implementador jamás lo adivinaría.

⭐⭐ **REGLA EN PROSA (impresa 602)**: *"most of the manufacturers' handbooks contain data on bearing
life for many classes of machinery, as well as information on load-application factors. **Such
information has been accumulated the hard way, that is, by experience, and the beginner designer
should utilize this information UNTIL ENOUGH EXPERIENCE IS GAINED TO KNOW WHEN DEVIATIONS ARE
POSSIBLE.**"*
→ "Esta información se acumuló a la mala, por experiencia, y **el diseñador principiante debe usarla
hasta ganar suficiente experiencia para saber cuándo se puede desviar de ella.**"
**REQUISITO**: el software debe tener **modo "principiante" (tablas obligatorias) y modo "experto"
(desviaciones permitidas con justificación registrada)**.

### Ej. 11-4 (SKF 6210, angular contact, anillo exterior estacionario)
V = 1 (interior gira). Fa/C0 = 400/4450 = 0.090 → interpola e = 0.285. Fa/(V·Fr) = 0.8 > 0.285 →
interpola Y2 = 1.527. Fe = 0.56(1)(500) + 1.527(400) = 890.8 lbf. ℒ10 = 16 150 h.

## §11-7 Carga variable (impresa 604–607)

Hipótesis de **daño lineal** (Palmgren 1924 / Miner 1945).
```
F^a·L = constante = K                                                        (a)
D = Fe1^a·l1 + Fe2^a·l2 + Fe3^a·l3                                           (b)
Feq = [ Σ fi·Fei^a ]^(1/a)      , fi = fracción de revoluciones            (11–13)
Feq = [ Σ ni·ti·Fei^a / Σ ni·ti ]^(1/a)                                     (11–14)
Feq = [ Σ fi·(af_i·Fei)^a ]^(1/a) ,   Leq = K/Feq^a                         (11–15)
Σ li/Li = 1                                                                  (11–16)   [Palmgren-Miner]
Feq = [ (1/φ)·∫₀^φ F^a dθ ]^(1/a) ,   Leq = K/Feq^a                         (11–17)   [carga continua]
```
⭐⭐ *"**The character of the individual loads can change**, so an application factor (af) can be
prefixed to EACH Fei as (af_i·Fei)^a"*. → **af por tramo, no global.** El Ej. 11-5 muestra la columna
8 con af = 1.10, 1.25, 1.10, 1.25 en distintos tramos.
⭐ Tres patrones nombrados: *"Piecewise constant loading in a cyclic pattern / Continuously variable
loading in a repeatable cyclic pattern / **Random variation**"*.
⭐ *"The value of φ is often 2π, although other values occur. **Numerical integration is often
useful** to carry out the indicated integration, particularly when **a is not an integer** and
trigonometric functions are involved."* (a = 10/3 para rodillos ⇒ integración numérica.)

### ⭐ Ej. 11-6 — af DERIVADO para carga senoidal (tabla del libro, TRANSCRITA)
Con F = F̄ + A·sin θ y a = 3: `af = [1 + (3/2)(A/F̄)²]^(1/3)`

| A/F̄ | af |
|---|---|
| 0 | 1 |
| 0.2 | 1.02 |
| 0.4 | 1.07 |
| 0.6 | 1.15 |
| 0.8 | 1.25 |
| 1.0 | 1.36 |

⭐ **Requisito**: af no siempre se lee de tabla — a veces **se DERIVA de la forma de onda**.

## §11-8 ⭐⭐⭐ SELECCIÓN DE RODAMIENTOS DE BOLAS Y RODILLOS CILÍNDRICOS (impresa 607–610)

### El procedimiento paso a paso — TRANSCRITO LITERALMENTE (Ej. 11-7b)

> *"The ball bearing at C involves a thrust component. **This selection procedure requires an iterative
> procedure. Assuming Fa/(V·Fr) > e**,
> **1** Choose Y2 from Table 11–1.
> **2** Find C10.
> **3** Tentatively identify a suitable bearing from Table 11–2, **note C0**.
> **4** Using Fa/C0 enter Table 11–1 to obtain a **new value of Y2**.
> **5** Find C10.
> **6** **If the same bearing is obtained, stop.**
> **7** **If not, take next bearing and go to step 4.**"*

⭐⭐ **CRITERIO DE CONVERGENCIA**: *"**if the same bearing is obtained**"* — **NO es una tolerancia
numérica, es la IDENTIDAD DEL RODAMIENTO SELECCIONADO.** Punto fijo sobre un conjunto discreto.
Un implementador pondría `|ΔC10| < ε` y se equivocaría de estructura.

⭐ **Semilla**: *"As a first approximation, **take the middle entry from Table 11–1**: X2 = 0.56,
Y2 = 1.63."* (la fila Fa/C0 = 0.070)

⭐ *"**The absence of a thrust component makes the selection procedure simple.**"* (caso cilíndrico:
sin iteración).

### Secuencia completa del Ej. 11-7 (los pasos previos que sí importan)
1. Torque T = 595(4.04) = 2404 lbf·in
2. `nD = 63 025·H/T` = 63 025(25)/2404 = 655.4 rev/min ← **la velocidad sale de la potencia nominal**
3. Cargas radiales por composición vectorial de reacciones: `Fr = sqrt(Ry² + Rz²)`
4. Meta de confiabilidad del conjunto: R = 0.96 para **4 rodamientos (dos ejes)** →
   `⁴√0.96 = 0.98985 ≈ 0.99` ⭐ **redondeo hacia arriba**
5. `xD = 60·ℒD·nD/L10` = 60(10 000)(655.4)/10⁶ = 393.2
6. Ec. (11–10) con a = 10/3 (rodillo) o a = 3 (bola)
7. Buscar en tabla 11-2 / 11-3 el que **iguale o exceda** C10

⭐ *"Choose a **02-25 mm series, OR a 03-25 mm series** cylindrical roller bearing"* → **hay múltiples
soluciones válidas; la elección final es del diseñador (espacio, costo).**

⭐⭐ **DETALLE DE UNIDADES QUE MATA**: en el paso 4 el libro escribe `Fa/C0 = 344(4.45)10⁻³/35.5` —
**convierte lbf a kN a mano** porque C0 está en kN y Fa en lbf. **Un bug de unidades aquí es
silencioso** (da un Y2 plausible pero equivocado).

⭐ *"The prior calculation for C10 **changes only in Fe**, so C10 = (3.97/3.65)·53.2 = 57.9 kN"* →
**re-escalado, no recálculo.** Truco de eficiencia del cliente.

## §11-9 ⭐⭐⭐ SELECCIÓN DE RODAMIENTOS CÓNICOS (impresa 610–618)

⭐ Advertencias de entrada (literal): *"Tapered roller bearings have a number of features that make
them **complicated**. […] **bearing and cup combinations are not necessarily priced in proportion to
capacity.** Any catalog displays a mix of **high-production, low-production, and successful
special-order designs**. Bearing suppliers have **computer programs** that will take your problem
descriptions, give intermediate design assessment information, and **list a number of satisfactory
cup-and-cone combinations in order of decreasing cost**."*
⭐ *"**It is strongly recommended that the designer become familiar with the specifics of the
supplier.** It will usually utilize a similar approach as presented here, but **may include various
modifying factors for such things as temperature and lubrication.**"*
⭐ *"At a large original equipment manufacturer's plant, **there may be a resident bearing company
representative**."*

### Los 4 componentes
1 **Cone** (aro interior) · 2 **Cup** (aro exterior) · 3 **Tapered rollers** · 4 **Cage**
(espaciador-retén).
Dos partes separables: (1) el **ensamble de cono** (cono + rodillos + jaula) y (2) la **copa**.
*"Bearings can be made as single-row, two-row, four-row, and thrust-bearing assemblies."*

### ⭐ Punto G — centro de carga efectivo
> *"Point G is the location of the **effective load center**; **use this point to estimate the radial
> bearing load**."*
> *"In addition to the usual ratings and geometry information, **catalog data for tapered roller
> bearings will include the location of the effective force center**."*
En el Ej. 11-8: *"the effective load center is located at **a = −5.8 mm**, that is, **5.8 mm into the
cup from the back**. Thus the **shoulder-to-shoulder dimension should be 150 − 2(5.8) = 138.4 mm**."*
⭐⭐ **La selección del rodamiento CAMBIA la geometría del eje.** Realimentación al CAD.

### ⭐⭐ MONTAJE DIRECTO vs INDIRECTO
> *"Two bearings can be mounted with the **cone backs facing each other**, in a configuration called
> **direct mounting**, or with the **cone fronts facing each other**, in what is called **indirect
> mounting**."*
> *"For the shaft as a beam, **the span is ae, the effective spread**. […] **The geometric spread ag
> for the direct mounting is greater than for the indirect mounting.** With indirect mounting the
> bearings are closer together compared to the direct mounting; **however, the system stability is
> the same (ae is the same in both cases). Thus direct and indirect mounting involve space and
> compactness needed or desired, but with the same system stability.**"*
⭐⭐ **Corrige una intuición falsa**: mucha gente cree que directo = más estable. **No: ae es igual.**
La decisión es de **espacio y compacidad**.

### ⭐⭐ CARGA AXIAL INDUCIDA (Ec. 11-18)
> *"even when an **external thrust load is not present, the radial load will induce a thrust reaction
> within the bearing because of the taper**. **To avoid the separation of the races and the rollers,
> this thrust must be resisted by an equal and opposite force.** One way of generating this force is
> to **always use at least two tapered roller bearings on a shaft**."*
> *"**The load zone includes about half the rollers and subtends an angle of approximately 180°.**
> Using the symbol Fi for the induced thrust load from a radial load with a 180° load zone, Timken
> provides the equation"*
```
Fi = 0.47·Fr / K                                                              (11–18)
```
> *"where **the K factor is geometry-specific, and is the ratio of the radial load rating to the
> thrust load rating**. The K factor can be **first approximated with 1.5 for a radial bearing and
> 0.75 for a steep angle bearing in the preliminary selection process**. After a possible bearing is
> identified, **the exact value of K for each bearing can be found in the bearing catalog**."*

### ⭐ Carga equivalente en cónicos
> *"Following the form of Equation (11–12), where Fe = X·V·Fr + Y·Fa, **Timken recommends using
> X = 0.4 and V = 1 for ALL cases, and using the K factor for the specific bearing for Y**."*
```
Fe = 0.4·Fr + K·Fa                                                            (a)
```
⭐⭐ **X = 0.4 y V = 1 SIEMPRE en cónicos.** Nada de tabla 11-1. Y **Y = K**, que sale del catálogo.

### ⭐⭐⭐ QUIÉN CARGA EL EMPUJE — EL JUICIO CODIFICADO (transcripción del método)

El libro reconoce que Timken lo resuelve con tabla de casos, y **ofrece un método equivalente pero
más entendible**:

> *"Timken handles it with **a table containing each of the configurations and a sign convention on
> the external loads**. It further requires the application to be **oriented horizontally with left
> and right bearings that must match the left and right sign conventions.** **Here, we will present a
> method that gives equivalent results, but that is perhaps more conducive to visualizing and
> understanding the logic behind it.**"*

⚠️ **NOTA HONESTA**: la tarea pedía *"los casos de carga IA/IB/IIA/IIB — TRANSCRIBE esa tabla"*.
**Esa tabla NO aparece en el texto extraído.** El libro **la menciona** (la tabla de configuraciones
con convención de signos de Timken) pero **la sustituye deliberadamente** por el método A/B que sigue.
Lo que sí está, y es su reemplazo exacto, son las **Ecs. (11-19) y (11-20)** con los dos casos.

**PASO 1 — etiquetar A y B (literal):**
> *"**First, determine visually which bearing is being "squeezed" by the external thrust load, and
> label it as bearing A. Label the other bearing as bearing B.** For example, in Figure 11–16, the
> external thrust Fae causes the shaft to push to the left against the cone of the left bearing,
> **squeezing it against the rollers and the cup**. On the other hand, **it tends to pull apart the cup
> from the right bearing.** The left bearing is therefore labeled as bearing A. **If the direction of
> Fae were reversed, then the right bearing would be labeled as bearing A.**
> This approach […] is applied similarly **regardless of whether the bearings are mounted directly or
> indirectly, regardless of whether the shaft or the housing carries the external thrust, and
> regardless of the orientation of the assembly.**
> **If there is no external thrust, then either bearing can arbitrarily be labeled as bearing A.**"*

Ejemplos de la Fig. 11-17: (a) empuje externo hacia arriba sobre **eje rotatorio** → **el rodamiento
SUPERIOR es A**. (b) empuje externo hacia arriba sobre **cilindro exterior rotatorio con eje fijo** →
**el rodamiento INFERIOR es A**. ⭐ **Mismo empuje, mismo montaje directo, A cambia de lugar.**

**PASO 2 — quién carga realmente el empuje neto (literal):**
> *"Second, determine which bearing actually carries the net axial load. **Generally, it would be
> expected that bearing A would carry the axial load**, since the external thrust Fae is directed
> toward A, along with the induced thrust FiB from bearing B. **However, if the induced thrust FiA
> from bearing A happens to be larger than the combination of the external thrust and the thrust
> induced by bearing B, then bearing B will carry the net thrust load.** […] **Timken recommends
> leaving the other bearing at its original radial load, rather than reducing it due to the negative
> net thrust load.**"*

### ⭐⭐⭐ LOS DOS CASOS — Ecuaciones (11-19) y (11-20) — TRANSCRITAS

```
CASO 1:   Si  FiA ≤ (FiB + Fae):
              FeA = 0.4·FrA + KA·(FiB + Fae)                          (11–19a)
              FeB = FrB                                               (11–19b)

CASO 2:   Si  FiA > (FiB + Fae):
              FeB = 0.4·FrB + KB·(FiA + Fae)                          (11–20a)
              FeA = FrA                                               (11–20b)
```
⭐⭐ **REGLA DE PISO (literal)**: *"**In any case, if the equivalent radial load is ever less than the
original radial load, then the original radial load should be used.**"*
→ `Fe = max(Fe_calculado, Fr)`. **Detalle que se salta cualquiera.**

⭐ *"Once the equivalent radial loads are determined, they should be used to find the catalog rating
load using **any of Equations (11–3), (11–9), or (11–10)** as before. **Timken uses a Weibull model
with x0 = 0, θ = 4.48, and b = 3/2.** Note that **since KA and KB are dependent on the specific bearing
chosen, it may be necessary to ITERATE the process.**"*

### El procedimiento completo (Ej. 11-8) — ordenado

```
0. Reacciones del eje en los planos xy y xz (con los CENTROS EFECTIVOS G, no los hombros)
1. FrA, FrB = suma vectorial de reacciones
2. TRIAL 1: K = 1.5 (radial) o 0.75 (ángulo pronunciado) para ambos
3. FiA = 0.47·FrA/KA ;  FiB = 0.47·FrB/KB
4. Etiquetar A (el "apretado" por Fae) — PASO VISUAL
5. Comparar FiA vs (FiB + Fae) → escoger Ec. (11-19) o (11-20)
6. Fe = max(Fe_calc, Fr) para cada uno
7. xD = 60·ℒD·nD / LR       [con LR = 90(10⁶) para Timken]
8. RD = √R (o ⁿ√R)
9. C10 = af·Fe·[ xD / (θ·(1 − RD)^(1/b)) ]^(3/10)     ← a = 10/3 para cónicos
       (con x0 = 0 la fórmula se reduce a esto; el libro escribe el denominador
        como (4.48)(1 − 0.995)^(2/3) )
10. Buscar cono+copa en catálogo (Fig. 11-15) que cumpla C10 → leer el K REAL
11. TRIAL 2: repetir 3–10 con los K reales
12. Verificar reliability real (Ec. 11-24) y R = RA·RB ≥ meta
13. Ajustar la dimensión hombro-a-hombro por el offset "a" del centro efectivo
```

⭐ En el Ej. 11-8 la iteración da C10 = 12 195 N contra una selección de 12 100 N, y el cliente decide:
*"**Although this catalog entry exceeds slightly the tentative selection for bearing A, WE WILL KEEP
IT since the reliability of bearing B exceeds 0.995.** In the next section we will quantitatively show
that the combined reliability of bearing A and B will exceed the reliability goal of 0.99."*
⭐⭐ **JUICIO PURO: se acepta un rodamiento "insuficiente" porque el compañero sobra.** El criterio
real es **R_conjunto ≥ meta**, no `C10_catálogo ≥ C10_requerido` rodamiento por rodamiento.

⭐ Truco de cálculo del cliente: *"Note that in each iteration of Equation (11–10) to find the catalog
load rating, **the bracketed portion of the equation is identical and need not be re-entered on a
calculator each time.**"*

### ⭐ Figura 11-15 — estructura del catálogo Timken (columnas, TRANSCRITAS)
`bore d` · `outside diameter D` · `width T` · **rating at 500 rpm for 3000 hours L10: one-row radial
(N y lbf), thrust (N y lbf)** · **factor K** · **eff. load center a₂** · **part numbers: cone, cup** ·
cono: `max shaft fillet radius R1`, `width B`, backing shoulder diameters `db, da` · copa: `max
housing fillet radius r1`, `width C`, backing shoulder diameters `Db, Da`.
⭐⭐ **DOS ratings distintos por rodamiento: RADIAL y THRUST.** En el Ej. 11-11 (empuje puro) el
cliente **busca en la columna de thrust**: *"If we set KA = 1, we can find C10 in the thrust column
and avoid iteration."* ⭐ **Truco: forzar K = 1 para leer directo en la columna de empuje.**

## §11-10 Evaluación del diseño (impresa 618–622)

### ⭐⭐ El manifiesto del cliente sobre iteración (literal)
> *"In textbooks, machine elements typically are treated singly. **This can lead the reader to the
> presumption that a design assessment involves only that element.** The immediately adjacent elements
> (the **shaft journal and the housing bore**) have immediate influence on the performance. Other
> elements, further removed (**gears producing the bearing load**), also have influence. Just as some
> say, **"If you pull on something in the environment, you find that it is attached to everything
> else."**
> […] **All this points out the necessary iterative nature of designing, say, a speed reducer.** If
> power, speed, and reduction are stipulated, then **gear sets can be roughed in, their sizes,
> geometry, and location estimated, shaft forces and moments identified, bearings tentatively
> selected, seals identified; the bulk is beginning to make itself evident, the housing and
> lubricating scheme as well as the cooling considerations become clearer, shaft overhangs and
> coupling accommodations appear. IT IS TIME TO ITERATE, now addressing each element again, knowing
> much more about all of the others.**
> **In the meantime you do as much of the design assessment as you can, avoiding bad selections, even
> if tentative. Always keep in mind that you eventually have to do it all in order to pronounce your
> completed design satisfactory.**"*

⭐⭐⭐ **ESTE PÁRRAFO ES LA ESPECIFICACIÓN DE ARQUITECTURA DEL PRODUCTO ENTERO.** El rodamiento no es
una función pura `(F, L, R) → C10`. Es un **nodo en un grafo de diseño con retornos**.

### ⭐⭐ CRITERIOS DE ACEPTACIÓN DEL RODAMIENTO — LISTA LITERAL
> *"An outline of a design assessment for a rolling contact bearing includes, **at a minimum**,"*
1. **Bearing reliability for the load imposed and life expected**
2. **Shouldering on shaft and housing satisfactory**
3. **Journal finish, diameter and tolerance compatible**
4. **Housing finish, diameter and tolerance compatible**
5. **Lubricant type according to manufacturer's recommendations; lubricant paths and volume supplied
   to keep operating temperature satisfactory**
6. **Preloads, if required, are supplied**

> *"Since we are focusing on rolling-contact bearings, **we can address bearing reliability
> quantitatively, as well as shouldering. Other quantitative treatment will have to wait until the
> materials for shaft and housing, surface quality, and diameters and tolerances are known.**"*
⭐ **4 de las 6 verificaciones NO son calculables con lo que hay en el capítulo.** Deben ser
**checklist obligatorio con estado pendiente**, no ignoradas.

### Confiabilidad resultante (invertir 11-9 / 11-10)
```
R = exp{ −[ (xD·(af·FD/C10)^a − x0) / (θ − x0) ]^b }                        (11–21)
R ≈ 1 −  [ (xD·(af·FD/C10)^a − x0) / (θ − x0) ]^b        , R ≥ 0.90         (11–22)

Weibull de DOS parámetros (cónicos, x0 = 0, θ = 4.48, b = 3/2):
R = exp{ −[ xD / (4.48·(C10/(af·FD))^(10/3)) ]^(3/2) }                      (11–23)
R ≈ 1 −  [ xD / (4.48·(C10/(af·FD))^(10/3)) ]^(3/2)                         (11–24)
```
Ej. 11-9: subir de 02-40 mm a 02-70 mm (por requisito de barreno ≥ 70 mm) lleva R de 0.99 a
**0.999 963**. ⭐ *"which, as expected, is much higher"*.
Ej. 11-10: RA = 0.994 791, RB = 0.999 766, R = **0.994 558** > 0.99 ✔
Ej. 11-11 (empuje puro 8000 N): RA = 0.963 > 0.95 ✔ ; **RB = 1** porque FD = 0 ⭐ (el rodamiento B no
carga nada → *"the cheapest bearing of this bore size will do, including a ball or roller bearing"*).

### ⭐⭐ Matters of Fit — reglas de hombros (literal)
- *"The **shaft shoulder can be greater than dS but not enough to obstruct the annulus**. It is
  important to maintain **concentricity and perpendicularity** with the shaft centerline, and to that
  end **the shoulder diameter should equal or exceed dS**."*
- *"The housing shoulder diameter **dH is to be equal to or less than dH** to maintain concentricity
  and perpendicularity with the housing bore axis."* (así aparece en el texto, refiriéndose al valor
  tabulado)
- *"**Neither the shaft shoulder nor the housing shoulder features should allow interference with the
  free movement of lubricant through the bearing annulus.**"*
- Cónicos: *"the **cup housing shoulder diameter should be equal to or less than Db**. The **shaft
  shoulder for the cone should be equal to or greater than db**."*

### ⭐⭐⭐ EL BOMBEO DE ACEITE DE LOS CÓNICOS — detalle brutal (literal)
> *"In **splash lubrication**, common in speed reducers, the lubricant is thrown to the housing cover
> (ceiling) and is directed in its draining **by ribs** to a bearing. **In direct mounting, a tapered
> roller bearing PUMPS OIL from outboard to inboard. An oil passageway to the outboard side of the
> bearing needs to be provided. The oil returns to the sump as a consequence of bearing pump action.
> With an indirect mount, the oil is directed to the inboard annulus, the bearing pumping it to the
> outboard side. An oil passage from the outboard side to the sump has to be provided.**"*
→ **El rodamiento cónico ES UNA BOMBA, y el sentido del bombeo depende de directo/indirecto. Eso
determina POR DÓNDE tiene que ir el conducto de aceite en la carcasa.** Un implementador de ecuaciones
jamás produciría este requisito geométrico.

## §11-11 Lubricación (impresa 622–623)

**EHD/EHL**: *"the phenomenon that occurs when a lubricant is introduced between surfaces that are in
**pure rolling contact** […] a **tremendous increase in the pressure** within the lubricant film
occurs. But **viscosity is exponentially related to pressure**, and so a **very large increase in
viscosity** occurs."*
⭐ Leibensperger: *"the change in viscosity in and out of contact pressure is **equivalent to the
difference between cold asphalt and light sewing machine oil**."*

**Propósitos del lubricante (los 4):**
1. Proveer una película entre superficies deslizantes y rodantes
2. Ayudar a distribuir y disipar calor
3. Prevenir corrosión de las superficies
4. Proteger de la entrada de materia extraña

### ⭐⭐ GRASA vs ACEITE — TABLA DE DECISIÓN TRANSCRITA

| **Usa GRASA cuando…** | **Usa ACEITE cuando…** |
|---|---|
| La temperatura **no pasa de 200 °F** | Las **velocidades son altas** |
| La **velocidad es baja** | Las **temperaturas son altas** |
| Se requiere **protección inusual** contra entrada de materia extraña | Se pueden emplear fácilmente **sellos herméticos al aceite** |
| Se desean **cerramientos simples** | El **tipo de rodamiento no es adecuado** para lubricación con grasa |
| Se desea **operación por periodos largos sin atención** | El rodamiento se lubrica desde un **suministro central** que también sirve a otras partes de la máquina |

## §11-12 Montaje y cierre (impresa 623–627)

⭐ *"There are so many methods of mounting antifriction bearings that **each new design is a real
challenge to the ingenuity of the designer**. **The housing bore and shaft outside diameter must be
held to very close limits, which of course is expensive.** There are usually one or more counterboring
operations, several facing operations and drilling, tapping, and threading operations […] **Each of
these operations contributes to the cost of production**, so that the designer, in ferreting out a
**trouble-free and low-cost mounting**, is faced with a **difficult and important problem**."*

### ⭐⭐⭐ QUIÉN FIJA AXIALMENTE — LA DECISIÓN
> *"The most frequently encountered mounting problem is that which requires **one bearing at each end
> of a shaft**. Such a design might use **one ball bearing at each end, one tapered roller bearing at
> each end, or a ball bearing at one end and a straight roller bearing at the other**. **ONE OF THE
> BEARINGS USUALLY HAS THE ADDED FUNCTION OF POSITIONING OR AXIALLY LOCATING THE SHAFT.**"*

**Fig. 11-20 (montaje común):** aros interiores respaldados contra hombros del eje, sujetos por tuercas
redondas roscadas al eje. **El aro exterior del rodamiento IZQUIERDO** va respaldado contra un hombro
de la carcasa y retenido. **El aro exterior del rodamiento DERECHO FLOTA en la carcasa.**
Variantes: *"the function of the shaft shoulder may be performed by **retaining rings, by the hub of a
gear or pulley, or by spacing tubes or rings**. The round nuts may be replaced by **retaining rings or
by washers locked in position by screws, cotters, or taper pins**. The housing shoulder may be
replaced by a retaining ring; the outer ring of the bearing may be **grooved for a retaining ring**,
or a **flanged outer ring** may be used."*
*"The force against the outer ring of the left-hand bearing is usually applied by the cover plate, but
**if no thrust is present, the ring may be held in place by retaining rings**."*

**Fig. 11-21 (alternativa):** aros exteriores completamente retenidos, sin dispositivos de retención en
el eje. *"**This eliminates the grooves or threads, which cause stress concentration on the
overhanging end, but it requires accurate dimensions in an axial direction or the employment of
adjusting means.**"*
⚠️⚠️ *"This method has the disadvantage that **if the distance between the bearings is great, the
temperature rise during operation may EXPAND THE SHAFT ENOUGH TO DESTROY THE BEARINGS**."*
→ ⭐⭐ **DILATACIÓN TÉRMICA DEL EJE. Requisito que ningún cálculo de C10 revela.**

### Duplexing (Fig. 11-24)
> *"When **maximum stiffness and resistance to shaft misalignment** is desired, **pairs of
> angular-contact ball bearings** are often used in an arrangement called **duplexing**. Bearings
> manufactured for duplex mounting have **their rings ground with an offset, so that when a pair of
> bearings is tightly clamped together, a PRELOAD IS AUTOMATICALLY ESTABLISHED.**"*

| Arreglo | Nombre | Característica (literal) |
|---|---|---|
| Cara a cara | **DF** | *"will take heavy radial loads and thrust loads from either direction"* |
| Espalda con espalda | **DB** | *"has the **greatest aligning stiffness** and is also good for heavy radial loads and thrust loads from either direction"* |
| Tándem | **DT** | *"used where the **thrust is always in the same direction**; since the two bearings have their thrust functions in the same direction, **a preload, if required, must be obtained in some other manner**"* |

### ⭐⭐⭐ LA REGLA DE AJUSTE DE AROS (literal, impresa 625)
> *"**Bearings are usually mounted with the ROTATING RING A PRESS FIT, whether it be the inner or
> outer ring. The STATIONARY RING is then mounted with a PUSH FIT. This permits the stationary ring to
> CREEP in its mounting slightly, bringing new portions of the ring into the load-bearing zone to
> EQUALIZE WEAR.**"*
→ "El aro que GIRA va con ajuste a presión; el aro FIJO va con ajuste deslizante, para que **repte** un
poco y meta nuevas porciones a la zona de carga y **el desgaste se empareje**."
⭐⭐ **El "juego" del aro fijo es INTENCIONAL.** Un implementador lo trataría como defecto.

### Precarga — los 3 objetivos (literal)
1. **Remover el juego interno** que normalmente traen los rodamientos
2. **Aumentar la vida a fatiga**
3. **Disminuir la pendiente del eje en el rodamiento**

Precarga de rodillos rectos, 3 métodos:
- Montar el rodamiento **sobre un eje o manguito cónico** para expandir el aro interior
- Usar **ajuste de interferencia para el aro exterior**
- Comprar un rodamiento con el **aro exterior pre-encogido sobre los rodillos**

Bolas: *"usually preloaded by the **axial load built in during assembly**. However, the bearings of
Figure 11–24a and b are preloaded in assembly **because of the differences in widths of the inner and
outer rings**."*

⭐⭐ **REGLA DURA**: *"**It is always good practice to follow manufacturers' recommendations in
determining preload, since TOO MUCH WILL LEAD TO EARLY FAILURE.**"*
→ "Siempre sigue las recomendaciones del fabricante para la precarga: **demasiada lleva a falla
temprana**." **La precarga tiene óptimo, no es "más = mejor".**

### Alineación
> *"The permissible misalignment in bearings **depends on the type of bearing and the geometric and
> material properties of the specific bearing. Manufacturers' catalogs should be referenced.** In
> general, **cylindrical and tapered roller bearings require alignments that are CLOSER than
> deep-groove ball bearings. Spherical ball bearings and self-aligning bearings are the most
> forgiving.** **Table 7–2 gives typical maximum ranges for each type of bearing.** **The life of the
> bearing decreases significantly when the misalignment exceeds the allowable limits.**"*
⚠️ **La Tabla 7-2 NO está en el texto extraído** (es del cap. 7, Ejes).

⭐⭐ *"Additional protection against misalignment is obtained by providing the **full shoulders**
recommended by the manufacturer. Also, **if there is any misalignment at all, IT IS GOOD PRACTICE TO
PROVIDE A SAFETY FACTOR OF AROUND 2 to account for possible increases during assembly.**"*
→ "Si hay algo de desalineación, **buena práctica: factor de seguridad de ~2** para cubrir aumentos
durante el ensamble."

### Cierres / sellos — los 3 métodos
> *"To exclude dirt and foreign matter and to retain the lubricant, **the bearing mountings must
> include a seal**."*

1. **Felt seal (fieltro)**: *"may be used with **grease lubrication when the speeds are low**. The
   **rubbing surfaces should have a high polish**. Felt seals **should be protected from dirt by
   placing them in machined grooves or by using metal stampings as shields**."*
2. **Commercial seal**: elemento de frote + resorte de respaldo en camisa de lámina. *"usually made by
   **press fitting them into a counterbored hole in the bearing cover**. Since they obtain the sealing
   action by rubbing, **they should NOT be used for high speeds**."*
3. **Labyrinth seal**: *"especially effective for **high-speed installations** and may be used with
   **either oil or grease**. It is sometimes used with **flingers**. **At least three grooves should
   be used**, and they may be cut on **either the bore or the outside diameter**. **The clearance may
   vary from 0.010 to 0.040 in, depending upon the speed and temperature.**"*

---
---

# PARTE III — CAPÍTULO 12: LUBRICACIÓN Y COJINETES DE DESLIZAMIENTO (resumen breve)

**El proceso del cliente en 12 líneas:**

1. **Clasificar el régimen (§12-1)**: cinco formas distintas — **hidrodinámica, hidrostática,
   elastohidrodinámica (EHL, dura y suave), de frontera (boundary), de película sólida**. La
   hidrodinámica *"does not depend upon the introduction of the lubricant under pressure […] but it
   does require the existence of an **adequate supply at all times**"*.
2. **Viscosidad (§12-2)** → **Ecuación de Petroff (§12-3)** como modelo de arranque.
3. **Verificar estabilidad (§12-4)**: la curva de McKee de f vs. el **módulo del cojinete μN/P**.
   A la derecha de BA la lubricación es **estable** (autocorrectiva); a la izquierda, **inestable**
   (se compone el error). ⭐ **Regla citable dura**: *"**Designers keep μN/P ≥ 1.7(10⁻⁶)**, which
   corresponds to **ZN/P ≥ 150**."*
4. **Teoría hidrodinámica (§12-6)** y **cartas de Raimondi y Boyd (§12-8)** — 45 gráficas, indexadas
   por **número de Sommerfeld S** y por **razón l/d (1:4, 1:2, 1 e ∞)**. Se **interpola** para otras
   l/d con la fórmula de Raimondi-Boyd (válida en ∞ > l/d > 1/4).
5. **§12-7 — LA ESTRUCTURA DEL PROBLEMA (lo más reusable del capítulo):**
   **Grupo 1 — variables que el diseñador CONTROLA (las decisiones):** (1) viscosidad μ,
   (2) carga W o presión nominal P, (3) velocidad N, (4) dimensiones r, c, β, l.
   ⭐ *"the designer usually **has no control over the speed**, because it is specified by the overall
   design of the machine. Sometimes **the viscosity is specified in advance**, as when the oil is
   stored in a sump and is used for lubricating and cooling a variety of bearings."*
   ⭐ *"**When these four decisions are made, the design is complete.**"*
   **Grupo 2 — variables DEPENDIENTES (factores de desempeño):** (1) coeficiente de fricción f,
   (2) elevación de temperatura ΔT, (3) caudal de aceite Q, (4) **espesor mínimo de película h0**.
   ⭐ *"**The fundamental problem in bearing design, therefore, is to DEFINE SATISFACTORY LIMITS for
   the second group of variables and then to DECIDE UPON VALUES for the first group such that these
   limitations are not exceeded.**"*
6. ⭐⭐ **§12-7 — LOS 4 CRITERIOS DE TRUMPLER (las reglas más citables del capítulo, transcritas):**
   ```
   (a) h0 ≥ 0.0002 + 0.000 04·d       in      [d = diámetro del muñón en pulgadas]
   (b) Tmax ≤ 250 °F                          [para aceites ligeros]
   (c) Wst/(l·D) ≤ 300 psi                    [carga DE ARRANQUE / área proyectada]
   (d) nd ≥ 2                                 [factor de diseño sobre la carga EN OPERACIÓN,
                                               NO sobre la carga de arranque de (c)]
   ```
   Razones: (a) *"Trumpler […] provides a **throat of at least 200 μin to pass particles from ground
   surfaces**"* y el término 0.000 04·d cubre que *"tolerances tend to increase with size"*.
   (b) el aceite **vaporiza los componentes ligeros** → sube viscosidad → sube calor → *"**This sets
   the stage for future failure.**"* ⭐ *"Some oils can operate at slightly higher temperatures.
   **Always check with the lubricant manufacturer.**"*
   (c) en arranque hay **contacto metal-metal y generación de partículas de desgaste** que con el
   tiempo cambian la geometría del buje.
   (d) ⭐ *"Since **ground vibration due to passing trucks, trains, and earth tremors is often
   present**, Trumpler used a design factor of 2 or more on the **running** load."*
   ⭐⭐ Y el cierre: *"**Many of Trumpler's designs are operating today, long after his consulting
   career was over; clearly they constitute good advice to the beginning designer.**"*
7. **§12-10 Holgura**: se **grafica el desempeño contra un RANGO de c**, no un valor.
   ⭐⭐ *"**New bearings should be designed for the shaded zone, because WEAR WILL MOVE THE OPERATING
   POINT TO THE RIGHT**"* (hacia c mayor). → **Se diseña descentrado a propósito para que el desgaste
   te lleve al óptimo.** Tabla 12-3 da holguras máx/mín/promedio por **tipo de ajuste ISO**
   (H8/f7 close-running, H9/d9 free-running) para un muñón de 1.5 in.
8. **§12-12 Cargas y materiales**: ⭐ *"**Current practice is to use an l/d ratio of about unity**, in
   general, and then to **increase this ratio if thin-film lubrication is likely to occur** and to
   **decrease it for thick-film lubrication or high temperatures**. **If shaft deflection is likely to
   be severe, a short bearing should be used** to prevent metal-to-metal contact at the ends."*
   ⭐ *"**You should always consider the use of a PARTIAL bearing if high temperatures are a problem**,
   because relieving the non-load-bearing area can very substantially reduce the heat generated."*
   ⭐⭐ **El conflicto de material (literal)**: *"The **two conflicting requirements** of a good bearing
   material are that **it must have satisfactory compressive and fatigue strength to resist the loads**
   and that **it must be SOFT and have a LOW MELTING POINT and a LOW MODULUS OF ELASTICITY**. The
   second set is necessary to permit the material to **wear or break in**, since the material can then
   **conform to slight irregularities and ABSORB AND RELEASE FOREIGN PARTICLES**."*
   **Tabla 12-5 (rangos de carga unitaria en uso actual)** — indexada por aplicación: motores diésel
   (main 900–1700 psi, crankpin 1150–2300, wristpin 2000–2300), motores eléctricos 120–250,
   turbinas de vapor 120–250, reductores 120–250, motores automotrices (main 600–750, crankpin
   1700–2300), compresores de aire (main 140–280, crankpin 280–500), bombas centrífugas 100–180.
   **Tabla 12-6 (materiales) — mencionada pero su contenido NO está en el texto extraído.**

---
---

# PARTE IV — SÍNTESIS PARA EL EQUIPO

## A. ITERACIONES: dónde REGRESA el cliente y qué lo dispara

| # | Módulo | Disparador | A qué regresa | Cita |
|---|---|---|---|---|
| 1 | Resorte est. | ningún d de la lista es factible | **negociar la restricción con el ensamble** | §10-10 Ej. 10-5 |
| 2 | Resorte est./fat. | `Na > 15` | **subir C** y recalcular d | §10-7 Ej. 10-3 |
| 3 | Resorte | ns sale demasiado conservador (1.55) | **bajar un calibre de alambre** | §10-7 Ej. 10-3 |
| 4 | Resorte | `fn < 15–20×` la frecuencia de excitación | **rediseñar: subir k o bajar W** | §10-8 |
| 5 | Resorte | `L0 > (L0)cr` (pandea) | cambiar α (**agregar varilla/tubo/barreno**) o bajar L0 | §10-5, Ej. 10-1(g) |
| 6 | Resorte | el diseño no existe en catálogo de stock | **evaluar orden especial vs. match cercano** | §10-7 |
| 7 | Rodamiento bolas | el rodamiento tentativo cambia C0, que cambia Y2 | **paso 4→7 hasta que el rodamiento se repita** | §11-8 |
| 8 | Rodamiento cónico | K estimado (1.5/0.75) ≠ K real del catálogo | **Trial 2 con los K reales** | §11-9 Ej. 11-8 |
| 9 | Rodamiento | R_conjunto < meta | **subir un tamaño el más cargado**, no ambos | §11-5, Ej. 11-10 |
| 10 | Rodamiento | restricción geométrica externa (barreno ≥ 70 mm) | **aceptar el más grande y RE-REPORTAR R** | Ej. 11-9 |
| 11 | Rodamiento | el offset del centro efectivo `a` cambia el claro entre hombros | **volver al CAD del eje** | Ej. 11-8 |
| 12 | Reductor completo | "el bulto empieza a hacerse evidente" | **volver a TODOS los elementos** | §11-10 |
| 13 | Cojinete | h0/Tmax/Pst/nd violan Trumpler | volver a las 4 decisiones (μ, P, N, r/c/β/l) | §12-7 |

## B. JUICIOS HUMANOS explícitos que el software debe SOLICITAR, no decidir

1. **Elegir material de resorte** — arranca en hard-drawn (costo relativo 1.0, §10-7 "first choice"),
   pero música/Cr-Va/Cr-Si según **fatiga, temperatura y choque** (tabla 10-3), con **costo relativo
   2.6/3.1/4.0/8.0/7.6-11** como contrapeso.
2. **As-wound vs. set-removed** — set removal sube capacidad **pero cuesta una operación extra** y
   **sirve poco en fatiga** (§10-4). *"Use as-wound spring (cheaper)"* es la decisión por default del
   cliente.
3. **Peened vs. unpeened** — +20 % en fatiga torsional pero **restringe d y paso** por cobertura del
   perdigón (§10-9); en torsión, tabla 10-10 marca peened como *"Not always possible"*.
4. **Cuál criterio de fatiga** (Sines / Gerber / Goodman) — *"Which criterion is correct? […] only
   testing will reveal the truth"* (§10-9).
5. **Aceptar o no el pandeo** — no es booleano: depende de qué tan cerca esté α real de 0.5, lo cual
   **lo controla el formado de los extremos**; el remedio es un **rod/tube/hole** (§10-5).
6. **Qué restricción negociar cuando ninguna opción cumple** — C = 12.14 sí, Ls = 1.116 hay que
   preguntarle al ensamble (§10-10).
7. **Confiabilidad del rodamiento** — la meta del conjunto se reparte, y **el reparto es libre**:
   √R como arranque, luego *"round down on B"* si RA sobra (§11-5).
8. **Vida objetivo L10** — se elige por **consecuencia de la falla** (tabla 11-4), no por tipo de
   máquina.
9. **Factor de aplicación af** — rango, no valor (tabla 11-5); o **derivado de la forma de onda**
   (Ej. 11-6).
10. **Cuál rodamiento fija axialmente el eje** — *"one of the bearings usually has the added function
    of positioning or axially locating the shaft"*; el otro **flota** (§11-12).
11. **Directo vs. indirecto en cónicos** — misma estabilidad (ae igual); se decide por **espacio y
    compacidad** — y **cambia por dónde va el conducto de aceite** (§11-9, §11-10).
12. **Hacer los dos rodamientos idénticos** — por **simplicidad y refacciones**, aunque las cargas
    difieran (§11-10 Ej. 11-10).
13. **Grasa vs. aceite** — 5 criterios contra 5 criterios (§11-11).
14. **Diseñar el resorte vs. comprarlo de stock** — *"the economics of special order versus the
    acceptability of a close match"* (§10-7); en torsión, *"economy of scale to small projects"*
    (§10-12).

## C. CRITERIOS DE ACEPTACIÓN — las dos listas de verificación

### Resorte de compresión (§10-7 + §10-8 + §10-10)
```
GENERALES (del método):
  [ ] 4 ≤ C ≤ 12                          (10–18)   ← "first item of the design assessment"
  [ ] 3 ≤ Na ≤ 15                         (10–19)
  [ ] ξ ≥ 0.15                            (10–20)
  [ ] ns ≥ 1.2  (a ALTURA SÓLIDA)         (10–21)
  [ ] (L0)cr > L0   (no pandea)           (10–13)
ESPECÍFICOS DEL PROBLEMA (del ensamble/cliente):
  [ ] Ls ≤ (límite de altura sólida del ensamble)
  [ ] L0 ≤ (límite de longitud libre del ensamble)
  [ ] OD ≤ (barreno) / ID ≥ (varilla), con allowance
  [ ] fn ≥ 15–20 × (frecuencia de excitación)      §10-8
SI ES FATIGA:
  [ ] nf ≥ objetivo, con criterio declarado (Sines/Gerber/Goodman) sobre datos Zimmerli
  [ ] ns a cierre TAMBIÉN se verifica
SI ES PRESETTING:
  [ ] 10–30 % de la L0 inicial se remueve
  [ ] 1.1·Ssy ≤ τ_solid ≤ 1.3·Ssy
SI ES GRANALLADO:
  [ ] d y paso permiten cobertura completa con perdigón de ~1/64 in
DESPUÉS:
  [ ] fom máxima ENTRE LOS FACTIBLES (no global)
  [ ] ¿existe en catálogo de stock? ¿aguanta cerrarse a sólido sin daño?
```
### Resorte de extensión (§10-11) — adicionales
```
  [ ] n del CUERPO en torsión           (tabla 10-7: 45–50 % Sut)
  [ ] n del GANCHO en flexión, punto A  (tabla 10-7: 75 % Sut) — r1 EN el plano de la espira
  [ ] n del GANCHO en torsión, punto B  (tabla 10-7: 40 % Sut) — r2 A 90° del plano
  [ ] τi dentro del "preferred range" de la Ec. (10–41) / Fig. 10-7c
```
### Resorte de torsión (§10-12) — adicionales
```
  [ ] la carga se aplica SIEMPRE en el sentido de enrollar
  [ ] Δ = D' − d − Dp > 0  (la espira no aprieta el perno al cargarse)
  [ ] Nb respeta la parte fraccionaria impuesta por β (valores discretos …5.3, 6.3, 7.3…)
  [ ] tolerancia angular de extremos según tabla 10-9
  [ ] usar k' con la constante 10.8 (no 10.2)
```
### Rodamiento (§11-10, LITERAL)
```
  [ ] Confiabilidad del rodamiento para la carga impuesta y la vida esperada
  [ ] Hombros en eje y carcasa satisfactorios (dS ≤ hombro_eje ; hombro_carcasa ≤ dH ;
      cónicos: hombro_cono ≥ db , hombro_copa ≤ Db ; sin obstruir el anillo de lubricante)
  [ ] Acabado, diámetro y tolerancia del muñón compatibles
  [ ] Acabado, diámetro y tolerancia de la carcasa compatibles
  [ ] Tipo de lubricante según fabricante; RUTAS y VOLUMEN de lubricante suficientes para
      mantener la temperatura de operación
  [ ] Precargas suministradas, si se requieren
+ implícitos del capítulo:
  [ ] R_conjunto = Π Ri ≥ meta            (no rodamiento por rodamiento)
  [ ] desalineación dentro de límite del tipo; con FS ≈ 2 si hay algo de desalineación
  [ ] Fe ≥ Fr siempre (regla de piso en cónicos)
  [ ] precondición declarada: limpio, bien lubricado, sellado, temperatura razonable
```

## D. CATÁLOGO DURO: qué tablas existen y qué las indexa

| Tabla | Qué contiene | INDEXADA POR |
|---|---|---|
| **10-1** | Ne, Nt, L0, Ls, p | **tipo de extremo** (4) |
| **10-2** | α (condición de extremo) | **4 condiciones de apoyo** |
| **10-3** | descripción cualitativa, rango de d, límites de temperatura | **material** (5 aceros) |
| **10-4** ⭐ | **A, m, costo relativo del alambre** | **material × RANGO DE DIÁMETRO** (302SS y P-bronze: 3 tramos c/u) |
| **10-5** | % límite elástico (tensión/torsión), **E, G** | **material** y, en music wire/HD, **rango de d** |
| **10-6** ⭐ | τ permisible estático, % Sut | **material × (antes/después de set removal)**; ⚠️ cambia el K incluido |
| **10-7** | esfuerzos permisibles extensión estática | **material × (cuerpo-torsión / extremo-torsión / extremo-flexión)** |
| **10-9** | tolerancia angular de extremos, ±° | **espiras totales** (5 rangos), para D/d ≤ 16 |
| **10-10** | esfuerzo de flexión recomendado torsión cíclica, % Sut | **vida (10⁵/10⁶) × material × peened/no** |
| **A-25** | ⚠️ **diámetros de alambre preferidos** (calibres music wire y W&M) — **NO está en el texto extraído**, solo se cita | calibre |
| **A-34** | ⚠️ función gamma Γ — **NO está en el texto extraído** | argumento |
| **11-1** ⭐ | **e, X1, Y1, X2, Y2** | **Fa/C0** (12 filas, interpolación lineal, clamp en 0.014) |
| **11-2** ⭐ | OD, ancho, radio de filete, dS, dH, **C10 y C0 de deep-groove Y de angular-contact** | **barreno (mm), serie 02** |
| **11-3** ⭐ | OD, ancho, C10, C0 | **barreno (mm) × serie (02 / 03)**, rodillos cilíndricos |
| **11-4** ⭐ | vida recomendada, kh | **clase de máquina / CONSECUENCIA DE LA FALLA** (8 filas) |
| **11-5** ⭐ | factor de aplicación af | **tipo de aplicación / nivel de impacto** (6 filas) |
| **11-6** ⭐ | **L_R, x0, θ, b (Weibull)** | **FABRICANTE** (1: 90e6/0/4.48/1.5 · 2: 1e6/0.02/4.459/1.483) |
| **Fig. 11-15** ⭐ | catálogo Timken cónicos: d, D, T, **rating radial Y rating thrust**, **K**, **centro efectivo a₂**, part numbers cono/copa, radios de filete máx, anchos B y C, hombros db/da/Db/Da | **barreno × combinación cono-copa** |
| **12-3** | holgura máx/prom/mín | **tipo de ajuste ISO** (H8/f7, H9/d9), para muñón 1.5 in |
| **12-5** | rango de carga unitaria, psi y MPa | **aplicación** (9 filas) |
| **12-6** | materiales de cojinete — ⚠️ contenido **NO está en el texto extraído** | material |
| **7-2** | rangos máximos de desalineación por tipo — ⚠️ **NO está en el texto extraído** (cap. 7) | tipo de rodamiento |

## E. ⭐ LAS DIEZ QUE UNA MÁQUINA LINEAL SE SALTARÍA

1. **La fom decide SOLO ENTRE LOS FACTIBLES.** En el Ej. 10-2 el mejor fom global (−0.398 @ d=0.071)
   **pierde**; gana −0.417 @ d=0.080 porque los mejores están descartados. Un optimizador que minimice
   fom con penalizaciones blandas da la respuesta equivocada. §10-7.
2. **"Ninguno cumple" es el resultado NORMAL, y la respuesta correcta es NEGOCIAR.** El Ej. 10-5
   termina sin solución factible y el cliente **jerarquiza**: C = 12.14 se tolera, Ls = 1.116 hay que
   preguntarle al ensamble, y si dicen que no, **aceptar C = 14 + empacar individualmente +
   reconsiderar el soporte**. El software debe modelar la negociabilidad por restricción. §10-10.
3. **El factor de seguridad del resorte va a ALTURA SÓLIDA, no a la carga de operación.** ns = Ssy/τs
   con τs evaluado en Fs = (1+ξ)Fmax. El resorte se dimensiona para sobrevivir a que alguien lo cierre.
   §10-7 Ec. (10–21).
4. **La tabla 10-6 cambia el FACTOR DE CORRECCIÓN, no solo el porcentaje**: "antes de set removal"
   incluye KW o KB; "después" incluye **Ks**. Copiar el % y usar siempre KB rompe el caso set-removed.
   §10-6.
5. **El modo de montaje INVIERTE entradas y salidas.** En "over-a-rod" / "in-a-hole", D lo fija la
   geometría y ns sale como consecuencia; en "free", ns es entrada y C sale de la cuadrática
   (**raíz mayor**). *"Had the spring been in a hole or over a rod, the helix diameter would be chosen
   without reference to (ns)d."* §10-7 Fig. 10-3.
6. **El gancho de extensión tiene DOS radios en planos PERPENDICULARES**: r1 en el plano de la espira
   final (flexión, punto A) y r2 a 90° (torsión, punto B). Y su **línea de carga en fatiga arranca en
   τi, no en el origen**: r = τa/(τm − τi). §10-11.
7. **El rodamiento cónico ES UNA BOMBA de aceite**, y el sentido depende de directo/indirecto — eso
   determina **por dónde perforas el conducto en la carcasa**. Ninguna ecuación de C10 lo revela.
   §11-10 "Matters of Fit".
8. **El aro FIJO se monta con ajuste deslizante A PROPÓSITO** para que repte y **empareje el
   desgaste**; el aro que GIRA va a presión. El "juego" es intencional, no defecto. §11-12.
9. **La convergencia de la selección de rodamiento es la IDENTIDAD del rodamiento**, no una tolerancia
   numérica: *"If the same bearing is obtained, stop."* Punto fijo sobre un conjunto discreto. §11-8.
10. **(L_R, x0, θ, b) es una TUPLA POR FABRICANTE.** Timken: 90(10⁶) rev, x0 = 0, θ = 4.48, b = 1.5.
    Fabricante 2: 1(10⁶), 0.02, 4.459, 1.483. Mezclarlas mete un factor 90 en la vida, silenciosamente.
    §11-4 / Tabla 11-6 / §11-9.

**Menciones honoríficas (11–15):**
- El **costo relativo del alambre** (columna de la tabla 10-4) es lo que hace funcionar la fom. Sin él,
  no hay criterio de decisión.
- La constante **10.8 (no 10.2)** en la razón de resorte de torsión: corrección empírica por fricción
  con el árbol. Derivar de primeros principios te da 10.2 y un error sistemático.
- **G y E dependen del diámetro** en music wire y HD spring (tabla 10-5), y d es justo la variable de
  barrido → hay que re-leerlos por renglón.
- **`Fe = max(Fe_calculado, Fr)`** en cónicos: *"if the equivalent radial load is ever less than the
  original radial load, then the original radial load should be used."* §11-9.
- **Nb en resortes de torsión es discreto con parte fraccionaria fija** (…5.3, 6.3, 7.3…) impuesta por
  el ángulo β entre extremos. No se redondea libremente. §10-12.

---

## F. LO QUE PIDIÓ LA TAREA Y **NO** ESTÁ EN EL TEXTO EXTRAÍDO (declarado)

1. **La tabla de casos IA / IB / IIA / IIB de Timken** para rodamientos cónicos. El libro **la
   menciona** (*"Timken handles it with a table containing each of the configurations and a sign
   convention on the external loads"*) pero **deliberadamente NO la reproduce**: la sustituye por el
   método "etiqueta A al que se aprieta" + Ecs. (11-19)/(11-20). Lo transcrito arriba **es** el
   reemplazo completo y equivalente.
2. **Tabla A-25** (diámetros de alambre preferidos, calibres music wire y W&M). Solo se **cita** en los
   ejemplos (d = 0.037 in para music wire #16; W&M 12-gauge = 0.1055 in; W&M 13-gauge = 0.0915 in).
   Esos cuatro valores sí están; la tabla completa está en el apéndice, fuera del rango extraído.
3. **Tabla A-34** (función gamma Γ). Solo citada.
4. **Tabla 7-2** (rangos máximos de desalineación por tipo de rodamiento). Es del cap. 7.
5. **Ecuaciones de resortes Belleville.** El libro dice explícitamente *"the mathematical treatment is
   beyond the scope of this book"*. Solo hay las reglas de h/t y de apilado.
6. **Tabla 12-6** (materiales de cojinete de deslizamiento con composición y características).
   Mencionada, contenido fuera del rango extraído.
7. **Las cartas de Raimondi y Boyd (Figs. 12-15 a 12-23)** son gráficas; en el texto extraído solo
   aparecen los valores leídos en los ejemplos.
8. **Tabla 11-6 vs "Tabla 11-1"**: la tarea llamó "tabla 11-1" a la de parámetros Weibull; en esta
   edición esa es la **Tabla 11-6** (en el preámbulo de problemas). La **Tabla 11-1** es la de X, Y, e.
   Ambas transcritas arriba.
