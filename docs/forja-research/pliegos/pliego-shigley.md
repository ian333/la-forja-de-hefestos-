# PLIEGO DE REQUISITOS — *Shigley's Mechanical Engineering Design*, 2024 Release (Budynas & Nisbett)
## Ejercicio: **el autor es el CLIENTE**. Siempre diseñó a mano, es buenísimo, y nos contrató para automatizar SU proceso.
### Analista: La Forja · 2026-07-31 · Libro leído como entrevista de requisitos, no como libro de texto

> **Regla de redacción:** ningún requisito existe porque suene bien. Cada uno cita la § del libro que lo obliga.
> Si no hay §, no entra. Donde el texto extraído no alcanzó, se dice explícitamente **[no verificado en el texto extraído]**.
> Español mexicano (tú/tienes). Fórmulas en ASCII.

---

## 0. QUIÉN ES ESTE CLIENTE Y QUÉ NOS ESTÁ PIDIENDO

El cliente NO nos pide una calculadora de fórmulas. Nos pide que automaticemos un **proceso de decisión
bajo incertidumbre**, y lo dice desde la primera página del capítulo 1:

- §1-3: *"Design is an iterative process in which we proceed through several steps, evaluate the results,
  and then return to an earlier phase of the procedure as needed."* → **El diseño es un GRAFO CON RETORNOS,
  no un wizard.** La Figura 1-1 dibuja explícitamente la flecha "Iteration" que regresa de *Evaluation* a
  *Synthesis*.
- §1-10: *"Engineers must accommodate uncertainty."* Y da una lista de 12 fuentes de incertidumbre que
  termina, con humor negro deliberado, en *"Uncertainty as to the length of any list of uncertainties."*
- §1-11: *"Guidance on selecting an appropriate design factor is nebulous because it depends on a judicial
  consideration of a multitude of issues."*
- §1-4: *"Computer software is no substitute for the human thought process. The engineer is the driver here;
  the computer is the vehicle."* Y remata: *"It is the engineer's responsibility to assure the validity of
  the results, by checking the application and results carefully, and by performing benchmark testing on
  problems with known solutions."*

**Traducción a requisito de producto:** el software es el vehículo, el ingeniero es el conductor. Toda
pantalla debe (a) mostrar la incertidumbre en vez de esconderla, (b) permitir volver atrás sin perder trabajo,
(c) traer sus propios *benchmarks* contra problemas de solución conocida.

---

## 1. LOS SIETE AXIOMAS DEL CLIENTE

| # | Axioma | § que lo obliga |
|---|---|---|
| **A1** | **El diseño es un grafo con retornos, no una secuencia.** Hay que conocer las dependencias "*allowing the designer to know what parts will be affected by any given change*". | §1-3 Fig 1-1, §1-17, §18-1 |
| **A2** | **El esfuerzo depende de la carga y la geometría; la resistencia depende del material y su proceso.** Son dos objetos distintos y NUNCA se mezclan. *"Stress is independent of the material… Strength is not dependent on the loading or the geometry."* | §1-9 |
| **A3** | **El factor de seguridad NO tiene sentido sin su justificación escrita.** *"a numerical value of factor of safety has useful meaning only when accompanied with the documented rationale behind it."* | §1-11 |
| **A4** | **El factor de diseño (meta, a priori) y el factor de seguridad (realizado, a posteriori) son cosas distintas.** El realizado sale un poco mayor porque redondeas a tamaño comercial. | §1-11, Ej 1-1 |
| **A5** | **Hay MUCHOS factores de seguridad en un mismo diseño; manda el más chico.** *"There will potentially be multiple factors of safety for the same design problem… The smallest factor of safety indicates the critical point."* | §1-11 |
| **A6** | **Aflojar tolerancias es una decisión de ingeniería, no una concesión.** *"the designer should generally be thinking in terms of loosening the tolerances as much as possible, while still achieving the desired functionality."* | §1-14 |
| **A7** | **Las estimaciones burdas al principio son OBLIGATORIAS, no un pecado.** *"rough estimates will need to be made in order to proceed through the process, refining and iterating until a final design is obtained."* | §1-3, §7-4 (Tabla 7-1) |

---

## 2. EL PROCESO A MANO

### 2.1 El lazo maestro del diseño (§1-3)

```
Identificación de la necesidad
        ↓
Definición del problema  ──── especificaciones + las 26 "design considerations"
        ↓
Síntesis (concepto)      ──── varios esquemas competidores
        ↓
Análisis y optimización  ──── estimaciones → modelos matemáticos
        ↓
Evaluación               ──── prototipo, ¿satisface la necesidad?
        ↓                          │
Presentación             ←─────────┘  ITERACIÓN (flecha explícita en Fig 1-1)
```

**Requisito duro:** la etapa de *Definición del problema* no es texto libre. §1-3 enumera **26 design
considerations** que el cliente revisa una por una: 1 Functionality, 2 Strength/stress, 3 Distortion/
deflection/stiffness, 4 Wear, 5 Corrosion, 6 Safety, 7 Reliability, 8 Manufacturability, 9 Utility, 10 Cost,
11 Friction, 12 Weight, 13 Life, 14 Noise, 15 Styling, 16 Shape, 17 Size, 18 Control, 19 Thermal properties,
20 Surface, 21 Lubrication, 22 Marketability, 23 Maintenance, 24 Volume, 25 Liability, 26 Remanufacturing/
resource recovery.

> ⭐ **§1-3, lo que una máquina se salta:** *"Anything that is not specified in the specifications does not
> need to be considered when evaluating a proposed design."* Es decir: la lista de especificaciones también
> define lo que **NO** vas a evaluar. Un software que evalúa todo siempre, sin que el usuario declare el
> alcance, está mintiendo sobre su rigor.

**Restricciones implícitas (§1-3):** *"The manufacturing processes that are available, together with the
facilities of a certain plant, constitute restrictions on a designer's freedom, and hence are a part of the
implied specifications."* → **Requisito:** el proyecto tiene un *perfil de taller* (qué máquinas hay, qué
materiales se consiguen) y el software filtra contra él. Esto es exactamente el caso de uso LATAM.

### 2.2 El lazo maestro de la transmisión de potencia (§18-1) — **el spec de proceso más valioso del libro**

§18-1 abre confesando: *"There is not a precise sequence of steps for any design process… However, much time
can be saved by understanding the dependencies between the parts of the problem."* Y luego da la secuencia:

| # | Paso | Por qué en ese orden (cita §18-1) | Salidas |
|---|---|---|---|
| 1 | **Potencia y par** | *"Power considerations should be addressed first, as this will determine the overall sizing needs for the entire system."* | H, ωi, ωo, razón |
| 2 | **Especificación de engranes** | *"a full force analysis of the shafts is not yet needed, as only the transmitted loads are required to specify the gears"* | z, P/módulo, ancho de cara |
| 3 | **Layout del eje** | *"it is not necessary at this point to size these elements, since their standard sizes allow estimation of stress-concentration factors"* | distancias axiales, tipo de transmisión de par |
| 4 | **Análisis de fuerzas** | ya se conocen diámetros de engrane y posiciones axiales | V(x), M(x), T(x) en 2 planos, reacciones |
| 5 | **Selección de material del eje** | *"Since fatigue design depends so heavily on the material choice, it is usually easier to make a reasonable material selection first, then check"* | Sut, Sy tentativos |
| 6 | **Diseño del eje por esfuerzo** (fatiga + estático) | con Kt estimados de la Tabla 7-1 | diámetros en puntos críticos |
| 7 | **Diseño del eje por deflexión** | *"Since deflection analysis is dependent on the entire shaft geometry, it is saved until this point."* | pendientes y flechas en engranes y cojinetes |
| 8 | **Selección de rodamientos** | *"The diameters can be adjusted slightly as necessary to match the catalog specifications."* | rodamiento de catálogo |
| 9 | **Cuñas y anillos de retención** | *"This should make little change in the overall design if reasonable stress-concentration factors were assumed"* | cuña, anillo |
| 10 | **Análisis final** | *"a complete analysis from start to finish will provide a final check and specific safety factors for the actual system"* | reporte firmado |

> ⭐ **El orden 5 antes que 6 es contraintuitivo y es JUICIO PURO.** Un implementador ingenuo pondría "elige
> material" al final, como resultado de la optimización. El cliente lo pone ANTES del cálculo de esfuerzo
> porque el diseño a fatiga depende tanto del material que sin él no puedes ni empezar. Y §18-6 confiesa que
> en el caso de estudio **cambió** de 1020 CD a 1050 CD a media corrida *"to avoid increasing the shaft
> diameters"*.

> ⭐ **El paso 7 (deflexión) va HASTA EL FINAL y eso es una decisión de arquitectura de software.** §7-5:
> *"Deflection analysis at even a single point of interest requires complete geometry information for the
> entire shaft."* Es decir: el análisis de esfuerzo es LOCAL (punto a punto) y el de deflexión es GLOBAL
> (necesita el eje completo). Dos motores distintos, dos momentos distintos del flujo. §18-8 remata:
> *"In a first iteration of this case study, with longer shafts due to using gears with hubs, the deflections
> were more critical than the stresses."*

### 2.3 El lazo de falla estática (cap 5) — **es un árbol de decisión, no una fórmula**

La Figura 5-21 es literalmente un diagrama de flujo implementable:

```
                       ¿εf (deformación real a la fractura) ?
                    /                                        \
            εf < 0.05                                      εf ≥ 0.05
          (comportamiento frágil)                      (comportamiento dúctil)
              /        \                                  /          \
     ¿conservador?    ¿conservador?               ¿Syt ≈ Syc?      ¿Syt ≈ Syc?
        NO              SÍ                            NO              SÍ
         |               |                             |               |
   Mohr modificado   Coulomb-Mohr frágil      Coulomb-Mohr dúctil   ¿conservador?
     (MM) Ec 5-32       (BCM) Ec 5-31           (DCM) Ec 5-26        /        \
                                                                  NO          SÍ
                                                                   |           |
                                                        Energía de distorsión  Cortante máximo
                                                          (DE) Ec 5-15/5-19      (MSS) Ec 5-3
```

**Reglas de prosa que acompañan al árbol:**
- §5-11: *"For ductile behavior the preferred criterion is the distortion-energy theory, although some
  designers also apply the maximum-shear-stress theory because of its simplicity and conservative nature."*
- §5-7: *"For design purposes the maximum-shear-stress theory is easy, quick to use, and conservative. If the
  problem is to learn why a part failed, then the distortion-energy theory may be the best to use."*
  → **⭐ El criterio DEPENDE DE PARA QUÉ preguntas: diseñar (MSS, conservador) vs. hacer forense (DE, ajusta
  mejor a los datos).** Un software que solo expone "von Mises" perdió la mitad del proceso del cliente.
- §5-7, la advertencia estadística: *"though a failure curve passing through the center of the experimental
  data is typical of the data, its reliability from a statistical standpoint is about 50 percent. For design
  purposes, a larger factor of safety may be warranted when using such a failure theory."*
  → **⭐ Usar DE (que ajusta al centro de los datos) implica ~50% de confiabilidad, y por eso exige un factor
  de seguridad MÁS GRANDE.** El software debe acoplar la elección de criterio con la sugerencia de `nd`.
- §5-10 excluye explícitamente el esfuerzo normal máximo del árbol: *"the maximum-normal-stress theory is
  excluded from Figure 5-21 as the other theories better represent the experimental data."*

**Y la regla que rompe a los implementadores lineales (§5-2):**
> *"This is the reason designers do not apply Kt in static loading of a ductile material loaded elastically,
> instead setting Kt = 1."*
> ⭐ **En carga ESTÁTICA con material DÚCTIL, el concentrador de esfuerzos se pone en 1.** El material fluye
> localmente en la muesca, endurece por deformación y la pieza aguanta. Pero §5-2 pone la contra-advertencia:
> *"be careful to assure yourself that the material is not susceptible to brittle fracture… in the environment
> of use."* Y una segunda excepción: en materiales frágiles con microdiscontinuidades intrínsecas (hierro gris
> con hojuelas de grafito, piezas de arena), **tampoco** se aplica Kt porque el ensayo de tensión ya lo trae
> incluido. Tres casos distintos, uno solo de los cuales usa Kt.

### 2.4 El lazo de fatiga (cap 6) — el cliente lo dividió en TRES categorías y así hay que construirlo

§6-16 lo dice sin rodeos: *"It may be helpful to think of fatigue problems as being in three categories:
completely reversing simple loads · fluctuating simple loads · combinations of loading modes."*
§6-19 da el *road map* de cada una. **Esa tricotomía es la arquitectura del módulo.**

#### Categoría A — Carga simple completamente invertida (§6-19)
```
1. Se' = 0.5·Sut            si Sut ≤ 200 kpsi (1400 MPa)          [Ec 6-10]
        = 100 kpsi / 700 MPa si Sut mayor
2. Se = ka·kb·kc·kd·ke·Se'                                        [Ec 6-17]
3. Kf = 1 + q(Kt − 1)   ó   Kf = 1 + (Kt−1)/(1+√a/√r)             [Ec 6-32 / 6-34]
4. σa = Kf·σa0
5. f  = 1.06 − 2.8e−3·Sut + 6.9e−6·Sut²   (kpsi, 70<Sut<200)      [Ec 6-11]
   a = (f·Sut)²/Se ;  b = −(1/3)·log(f·Sut/Se)                    [Ec 6-13, 6-14]
6. Sf = a·N^b     ó     N = (σar/a)^(1/b)                         [Ec 6-12, 6-15]
```

#### Categoría B — Carga fluctuante simple (§6-19)
```
1. σa = |σmax − σmin|/2 ;  σm = (σmax + σmin)/2 ;  aplicar Kf A LAS DOS
2. Vida infinita: nf = (σa/Se + σm/Sut)^−1     si σm ≥ 0          [Ec 6-41, Goodman]
                  nf = Se/σa                   si σm < 0          [Ec 6-42]
3. Fluencia localizada: ny = Sy/(σa + |σm|)                       [Ec 6-43]
4. Vida finita: σar por Goodman / Morrow / SWT / Walker → N=(σar/a)^(1/b)
```
> ⭐ **El paso 2 y el paso 4 usan CRITERIOS DISTINTOS y esa es la trampa más fina del capítulo.** Para el
> factor de seguridad a vida infinita, §6-13 recomienda **Goodman** (*"simple, conservative, and good for
> design purposes"*). Para estimar la VIDA FINITA equivalente, §6-14 dice que Goodman *"is very inaccurate
> for the purpose of estimating an equivalent completely reversed stress"* y da el orden de preferencia
> **Walker > Morrow > SWT > Goodman**. Un implementador lineal usa un solo criterio para todo y produce
> vidas absurdamente conservadoras.

> ⭐ **El paso 3 (fluencia localizada) es un cheque SEPARADO que no sale de la curva de fatiga.** Es fácil
> olvidarlo porque el criterio de Goodman ya "se ve" como una envolvente. No lo es: hay que cruzar también
> la línea de Langer.

#### Categoría C — Combinación de modos de carga (§6-16, §6-19)
```
σ'a = { [ (Kf)flex·σa0_flex + (Kf)axial·σa0_axial ]² + 3[ (Kfs)tors·τa0 ]² }^(1/2)   [Ec 6-66]
σ'm = { [ (Kf)flex·σm0_flex + (Kf)axial·σm0_axial ]² + 3[ (Kfs)tors·τm0 ]² }^(1/2)   [Ec 6-67]
```
Con tres reglas de mano que ningún generador de código adivina (§6-16):
1. **NO apliques kc.** *"When determining Se, do not use kc."* El efecto de torsión ya está dentro del von Mises.
2. **kb: usa el MENOR de los que apliquen.** *"A safe and simple approach is to use the lowest value of kb predicted."*
3. **Axial: usa kc = 1 salvo que el axial DOMINE**, en cuyo caso 0.85. *"a simpler approach is to simply use
   the load factor of 1 unless the axial stress is the dominant stress."*

### 2.5 El lazo del eje (cap 7)

§7-3 es un **reglamento de layout**, no un cálculo. Extraído íntegro en §3.4 de este pliego.
§7-4 define **dónde** buscar: *"It is not necessary to evaluate the stresses in a shaft at every point; a few
potentially critical locations will suffice. Critical locations will usually be on the outer surface, at axial
locations where the bending moment is large, where the torque is present, and where stress concentrations exist."*

Y luego da las ecuaciones DE-Goodman / DE-Morrow / DE-Gerber / DE-SWT ya despejadas **para el diámetro**
(Ec 7-8, 7-10, 7-12, 7-14), con el par auxiliar:
```
A = sqrt( 4(Kf·Ma)² + 3(Kfs·Ta)² )
B = sqrt( 4(Kf·Mm)² + 3(Kfs·Tm)² )                                [Ec 7-6]
n = (π·d³/16) · ( A/Se + B/Sut )^−1                               [Ec 7-7  DE-Goodman]
d = ( (16n/π) · ( A/Se + B/Sut ) )^(1/3)                          [Ec 7-8]
```
> ⭐ **§7-4 dice explícitamente por qué existen las versiones despejadas:** *"in an analysis situation in which
> the diameter is known and the factor of safety is desired… it is always still valid to calculate the
> alternating and mean stresses… In a design situation, however, having the equations pre-solved for diameter
> is quite helpful."* → **El software necesita LOS DOS MODOS: análisis (dado d, dame n) y diseño (dado n, dame
> d).** Son el mismo modelo pero distinta pregunta, y el cliente los distingue.

**Simplificación que el cliente aplica de rutina (§7-4):** *"For a rotating shaft with constant bending and
torsion, the bending stress is completely reversed and the torsion is steady."* → Mm = 0 y Ta = 0. El caso
por defecto de un eje de transmisión.

---

## 3. REGLAS PRESCRIPTIVAS EN PROSA (el oro) — catalogadas por § para implementarlas como *linter* de diseño

### 3.1 Factor de diseño y confiabilidad (cap 1)

| § | Regla (inglés) | Traducción / requisito |
|---|---|---|
| §1-11 | *"A factor of safety less than unity predicts failure."* | n<1 es FALLA, no advertencia. |
| §1-11 | *"In neither case is there any information about a statistical percentage of failures."* | El método determinista **no** te da confiabilidad. No la inventes en la UI. |
| §1-11 | Tres categorías para elegir nd: *"Accuracy of the prediction… Cost of overachieving the requirements… Consequences of failure"* | El selector de nd tiene **3 ejes**, no un *slider*. |
| §1-11 | *"We may use a design factor of 20 on a bolt, while using a design factor of 1.5 on an airplane part for which extra weight is costly."* | ⭐ nd=20 y nd=1.5 son AMBOS correctos. El número sale del contexto económico, no de la física. |
| §1-11 | *"When safety is at stake, there will usually be relevant industry codes that specify the design factor… These codes may be mandated by law."* | Si la app detecta un dominio normado, debe exigir el código, no proponer un nd. |
| §1-14 | *"Excessive precision by the designer may seem like an easy way to achieve functionality, but it is actually a poor design choice in that it limits the manufacturing options and drives up the cost."* | Apretar tolerancias sin justificación = defecto de diseño, detectable. |
| §1-14 | *"the designer should make this determination, not the manufacturer"* (sobre cuáles cotas especificar) | ⭐ La elección de CUÁLES tres cotas poner (Fig 1-9) es funcional, no estética. |
| §1-14 | *"the cumulative effect of the individual specified tolerances must be allowed to accumulate somewhere"* | Tolerance stack-up: la app debe decir DÓNDE se acumula. |
| §1-8 | *"The best approaches to the prevention of product liability are good engineering in analysis and design, quality control, and comprehensive testing procedures."* | El registro de decisiones es defensa legal, no burocracia. |

### 3.2 Materiales (cap 2)

| § | Regla | Requisito |
|---|---|---|
| §2-22 | *"1020 steel is always a good candidate because of its many positive attributes"* | Default razonable declarado por el cliente. |
| §2-22 | Método de listas: lista propiedades importantes → pondera → ordena materiales por cada propiedad → toma la cabeza de cada lista → **intersecta** | Algoritmo explícito de preselección. |
| §2-22 | Método Ashby: índice de material M (ej. M = E^(1/2)/ρ para viga en voladizo ligera y rígida, Ec 2-46) | ⭐ El índice **se DERIVA** del caso de carga (Ec 2-40..2-46), no se escoge de una lista. |
| §7-2 | *"A good practice is to start with an inexpensive, low or medium carbon steel for the first time through the design calculations. If strength considerations turn out to dominate over deflection, then a higher strength material should be tried."* | Estrategia de arranque explícita para ejes. |
| §7-2 | *"Deflection is not affected by strength, but rather by stiffness… for steel shafts, rigidity cannot be controlled by material decisions, but only by geometric decisions."* | ⭐ **Si el problema es deflexión, cambiar de acero NO SIRVE.** E es prácticamente el mismo. La app debe decirlo en vez de dejarte barrer materiales inútilmente. |
| §7-2 | *"Significant strengthening from heat treatment and high alloy content are often not warranted. Fatigue failure is reduced moderately by increase in strength, and then only to a certain level before adverse effects in endurance limit and notch sensitivity begin to counteract the benefits."* | ⭐ Hay **rendimientos decrecientes y luego negativos** al subir Sut: sube ka bajando (Fig 6-24 castiga más a los aceros fuertes) y sube q (mayor sensibilidad a la muesca). |
| §7-2 | *"Cold-drawn steel is usually used for diameters under about 3 inches… Hot-rolled steel should be machined all over."* | Regla de proceso ligada al diámetro. |
| §7-2 | *"For large shafts requiring much material removal, the residual stresses may tend to cause warping. If concentricity is important, it may be necessary to rough machine, then heat treat…, then finish machine."* | Secuencia de manufactura como salida del diseño. |
| §6-9 | *"Rolled or drawn parts… have an endurance limit in the transverse direction that may be 10 to 20 percent less than the endurance limit in the longitudinal direction."* | Anisotropía por proceso. |
| §6-9 | *"if the residual stress in the surface of the part is compression, the endurance limit is improved… shot peening, hammering, and cold rolling… Of course, the material must not be worked to exhaustion."* | Granallado como variable de diseño. |

### 3.3 Fatiga (cap 6)

| § | Regla | Requisito |
|---|---|---|
| §6-8 | *"fatigue is not as clean and predictable as many other facets of engineering"* | La UI debe mostrar dispersión, no un número. |
| §6-9 | *"The multiplicative combination of the various effects has not been thoroughly tested and proven, particularly in capturing the actual impact of interactions between different effects. However, limited testing has shown it to be reasonable for the rough approximations expected."* | ⭐ **El propio cliente declara que Marin es una aproximación burda cuya multiplicatividad no está probada.** El software debe etiquetarlo así y NO presentar Se con 4 decimales. |
| §6-9 | *"Bringing critical stress locations to at least a machined finish is certainly worth consideration as a cost-effective substantial improvement in fatigue life."* | Recomendación accionable de manufactura. |
| §6-9 (ka) | *"the curves are thought to represent the lower bounds of the spread of the data, and are therefore likely to be conservative"* | ka ya trae sesgo conservador. |
| §6-9 (ka) | *"When machining a forged part to improve its surface factor, it is important to machine to a depth that will remove the decarburized layer."* | ⭐ El factor de forjado no es rugosidad: es **descarburización**. Maquinar superficial no lo arregla. |
| §6-9 (ka) | McKelvey: *"recommends a surface factor for the as-forged surface that is at least as high as the hot-rolled curve"* | El dato de forjado de Lipson-Noll (1940s) está obsoleto; hay que ofrecer la corrección moderna. |
| §6-9 (kb) | *"For d less than 0.3 inches (7.62 mm), the data is quite scattered. Unless more specific data is available… kb = 1 is recommended."* | Piso explícito. |
| §6-9 (kb) | *"For axial loading there is no size effect, so kb = 1, but see kc."* | El efecto se movió a kc, no desapareció. |
| §6-9 (kb) | Barra NO rotatoria en flexión → diámetro efectivo `de = 0.370·d` (Ec 6-23); rectangular `de = 0.808·√(hb)` (Ec 6-24); Tabla 6-3 para perfiles estructurales | ⭐ **Rotatorio vs no rotatorio cambia kb.** El volumen al 95% del esfuerzo máximo es distinto. Casi nadie lo implementa. |
| §6-9 (kc) | *"use the torsion load factor only for pure torsional fatigue loading. When torsion is combined with other loading… set kc = 1"* | Regla de exclusión mutua. |
| §6-9 (kd) | *"if the endurance limit is available or being estimated based on the ultimate strength at the operating temperature, it needs no further adjustment and kd should be set to unity."* | ⭐ **Doble conteo:** o corriges Sut por temperatura, o aplicas kd. **Nunca las dos.** |
| §6-9 (kd) | *"High temperature fatigue is primarily a concern for temperatures above about 40 percent of the absolute (Kelvin) melting temperature"* y *"When temperatures exceed about 50 percent… creep becomes a predominant factor, and the stress-life approach is no longer reasonable."* | Límite de validez del método completo, en función de T_fusión. |
| §6-9 (ke) | *"The reliability factor accounts only for the scatter in the endurance limit fatigue data and is not part of a complete stochastic analysis."* | ke ≠ confiabilidad del sistema. |
| §6-9 (ke) | *"A true reliability for fatigue life can only be reasonably attempted with actual part testing."* | Honestidad obligatoria en la UI. |
| §6-9 | Piezas cementadas: *"Parts that are case-hardened may fail at the surface or at the maximum core radius, depending upon the stress gradient."* (Fig 6-25) | ⭐ Hay que evaluar **dos** ubicaciones con **dos** Se distintos (caso y núcleo). |
| §6-9 | Corrosión: *"in time any part will fail when subjected to repeated stressing"* en atmósfera corrosiva | No hay límite de fatiga con corrosión: prohibir "vida infinita". |
| §6-10 | *"because of this scatter it is always safe to use Kf = Kt if there is any doubt about the true value of q"* | Default seguro explícito. |
| §6-10 | *"note that q is not far from unity for large notch radii"* | Sanity check. |
| §6-10 | *"The notch sensitivity of cast irons is very low, varying from 0 to about 0.20… it is recommended that the value q = 0.20 be used for all grades of cast iron."* | Valor duro para hierro fundido. |
| §6-13 | *"There is not one best infinite-life fatigue criteria, as each has value for different applications."* | El criterio es una **entrada del usuario**, con recomendación por defecto. |
| §6-13 | Goodman *"is only applicable for positive mean stress, as it is nonconservative if applied to negative mean stress"*; Gerber *"only applies to positive mean stress"* | El signo de σm cambia de criterio. |
| §6-13 | Soderberg: *"Its sole purpose is to provide a simple, conservative line that checks for infinite-life fatigue and yielding at the same time. It removes the need for a separate yield check."* | Soderberg no es "más conservador porque sí": **fusiona dos chequeos en uno**. |
| §6-13 | ASME-elíptico: *"in trying to do two things at once, they suffer some consequences"* / *"it is the criterion specified in the ANSI/ASME Standard B106.1M-1985 for design of transmission shafting"* | Se usa por norma, no por precisión. |
| §6-13 (cortante puro) | Sustituir σ→τ, aplicar kc=0.59, `Ssy = 0.577·Sy`, `Ssu = 0.67·Sut` (Ec 6-58) *"Lacking specific information justifying a higher value"* | Receta completa para el caso de cortante puro. |
| §6-14 | Orden de preferencia para vida finita: **Walker > Morrow > SWT > Goodman** | Ver ⭐ arriba. |
| §6-17 | Miner: *"The parameter c has been determined by experiment; it is usually found in the range 0.7 < c < 2.2 with an average value near unity."* | ⭐ El daño acumulado tiene un factor c con un rango de **3x**. Reportar D=0.97 como "pasa" es falso rigor. |
| §6-17 | Conteo de ciclos: el "**ciclo escondido**" (Fig 6-40). *"To ensure that the hidden cycle is not lost, begin on the snapshot with the largest (or smallest) stress and add previous history to the right side."* Y *"The most damaging cycle is number 1. It could have been lost."* | ⭐ El conteo rainflow no es cosmético: **el ciclo más dañino es justo el que se pierde** si cuentas ingenuamente. |

### 3.4 Layout de ejes (§7-3) — reglamento completo, implementable como validador geométrico

| Regla (inglés, §7-3) | Requisito verificable |
|---|---|
| *"it is best to support load-carrying components between bearings… rather than cantilevered outboard"* | Detectar voladizos; advertir. |
| *"The length of the cantilever should be kept short to minimize the deflection."* | Métrica: longitud de voladizo / claro. |
| *"Only two bearings should be used in most cases."* | >2 cojinetes ⇒ exigir justificación + alerta de alineación. |
| *"Shafts should be kept short to minimize bending moments and deflections."* | Objetivo de optimización declarado. |
| *"Some axial space between components is desirable to allow for lubricant flow and to provide access space for disassembly of components with a puller."* | ⭐ Hay que reservar hueco para el **extractor**, no solo para la pieza. Nadie lo modela. |
| *"Load-bearing components should be placed near the bearings"* | Reduce M en los puntos con concentradores. |
| *"It is generally best to have only one bearing carry the axial load, to allow greater tolerances on shaft length dimensions, and to prevent binding if the shaft expands due to temperature changes."* | ⭐ Regla de **un solo cojinete fijo axialmente**. Es una restricción topológica del ensamble. |
| *"This generally requires the largest diameter in the center of the shaft, with progressively smaller diameters toward the ends to allow components to be slid on from the ends."* | Monotonía del escalonado ⇒ regla de armabilidad verificable. |
| *"If a shoulder is needed on both sides of a component, one of them must be created by such means as a retaining ring or by a sleeve"* | Imposibilidad geométrica detectable. |
| *"When components are to be press-fit to the shaft, the shaft should be designed so that it is not necessary to press the component down a long length of shaft."* | ⭐ Un escalón EXTRA que parece desperdicio en realidad **abarata**: acorta el tramo con tolerancia cerrada. |
| §18-4: *"It is extremely important to keep axial distances small. Even small forces can create large bending moments if the moment arms are large. Also, recall that beam deflection equations typically include length terms raised to the third power."* | El costo de la longitud es **cúbico** en deflexión. |
| §18-4: *"a little extra space is provided between them to accommodate any housing that extends behind the bearing, and to allow for a bearing puller"* | Idem extractor. |
| §18-4: *"The extra change in diameter between the bearings and the gears allows the shoulder height for the bearing and the bore size for the gear to be different. This diameter can have loose tolerances and a large fillet radius."* | ⭐ Diámetro "de relleno" deliberadamente **flojo** = ahorro. |
| §7-7 | *"Setscrews should have a length of about half of the shaft diameter. Note that this practice also provides a rough rule for the radial thickness of a hub or collar."* | Regla dimensional derivada. |
| §7-7 | Cuñero: *"Keeping the end of a keyseat at least a distance of d/10 from the start of the shoulder fillet will prevent the two stress concentrations from combining with each other."* | ⭐ **Regla de separación entre concentradores: d/10.** Verificable geométricamente y casi nadie la implementa. |
| §7-7 | Anillos de retención: *"Care should be taken in using retaining rings, particularly in locations with high bending stresses."* (Kt ≈ 5 flexión / 3 torsión) | Alerta si hay ranura de anillo donde M es alto. |
| §7-7 | Setscrews: *"Typical factors of safety are 1.5 to 2.0 for static loads and 4 to 8 for various dynamic loads."* | Rango duro de nd para prisioneros. |
| §7-5 | *"bearing and gear catalogs should be used for guidance on allowable misalignment for specific bearings and gears"* antes que la Tabla 7-2 | La tabla es "rough guideline"; el catálogo manda. |

### 3.5 Cuñas (§7-7, §18-10)

- §18-10: *"For a square key, it turns out that checking only the crushing failure is adequate, since the
  shearing failure will be less critical according to the distortion energy failure theory, and equal
  according to the maximum shear stress failure theory."*
  → ⭐ **Para cuña cuadrada basta revisar aplastamiento.** Pero ojo: eso vale para cuña CUADRADA y depende del
  criterio de falla elegido (con MSS empatan). Con cuña rectangular hay que revisar las dos.
- §18-10: *"The cross-sectional size of the key will be dictated to correlate with the shaft size (Tables 7-6
  y 7-8), and must certainly match an integral keyway in the gear bore. The design decision includes the
  length of the key, and if necessary an upgrade in material choice."*
  → ⭐ **La sección de la cuña NO es variable de diseño: la dicta el diámetro del eje.** Las dos únicas
  variables libres son **longitud** y **material**. Un optimizador que barra w y h está resolviendo un
  problema que el cliente no tiene.
- §7-7: material típico de cuña = acero dulce estirado en frío, ej. UNS G10180 con Sy = 54 kpsi (Ej 7-6),
  deliberadamente **más débil** que el eje.

### 3.6 FEA (cap 19) — reglas de modelado que aplican DIRECTO a nuestro solver

| § | Regla | Requisito |
|---|---|---|
| §19-4 | *"If there is a minimal change in the maximum stress value, it is reasonable to presume that the solution has converged."* (ejemplo: 4110 → 4185 psi, +1.8% ⇒ convergido) | ⭐ **Criterio de convergencia por remallado con un número concreto (~2%).** Nuestro `fea-convergence.cjs` debe reportarlo así. |
| §19-4 | *"the mesh density needs to be increased only in the region around the stress concentration and that the transition mesh… be gradual. An abrupt mesh transition, in itself, will have the same effect as a stress concentration."* | ⭐ **Una transición brusca de malla FABRICA un concentrador falso.** Es un defecto detectable en la malla, no en el resultado. |
| §19-5 | Saint-Venant: *"the analyst should not be surprised, or concerned, when reviewing the results and the stresses in the vicinity of the load application point are found to be very large."* | La UI debe **excluir o marcar** la vecindad del punto de carga al reportar σmax. |
| §19-5 | *"Concentrated moments cannot be applied to truss, two-dimensional plane elastic, axisymmetric, or brick elements. They do not support rotational degrees of freedom."* | Validación de BC por tipo de elemento (nuestro tet4 **no** tiene DOF rotacional). |
| §19-6 | *"The simulation of boundary conditions… is probably the single most difficult part of the accurate modeling."* | Donde va la mayor inversión de UX. |
| §19-6 | *"we have modeled shafts with bearings as being simply supported. It is more likely that the support is something between simply supported and fixed, and we could analyze both constraints to establish the limits. However, by assuming simply supported, the results… are conservative."* | ⭐ **Correr los DOS extremos (simplemente apoyado y empotrado) y reportar la BANDA**, no un número. |
| §19-7 | *"much unnecessary time can be spent on a very complex model when a much simpler model will do. The complex model may not even provide an accurate solution, whereas a simpler one will."* | ⭐ El sólido con 56 384 elementos **no gana** contra 5 elementos viga si solo quieres deflexiones (Fig 19-7 vs 19-8). |
| §19-7 | *"What is important is what solution the analyst is looking for: deflections, stresses, or both?"* | La pregunta define el modelo. Debe ser el **primer** campo del formulario de FEA. |
| §19-7 | *"Nodes are necessary wherever boundary conditions, applied forces, and changes in cross section and/or material occur."* | Regla de sembrado de nodos. |

### 3.7 GD&T (cap 20) — proceso de 5 pasos (§20-7)

```
1. Selecciona las superficies de referencia (datums)  ── por FUNCIÓN, no por cómo se va a maquinar
2. Controla los datums                                 ── el datum físico es imperfecto y también se tolera
3. Localiza las features                               ── cotas BÁSICAS + control geométrico
4. Dimensiona y localiza las features de tamaño        ── (a) posición básica del eje/plano medio,
                                                          (b) tamaño con ±, (c) control de posición
5. Refina orientación y forma SOLO si hace falta
```
- §20-7: *"The datum features should be selected based on the functional use of the part first, rather than on
  the anticipated manufacturing method."* ⭐
- §20-7: *"by applying profile of a surface to a feature, the bounding envelope… also automatically controls
  orientation characteristics… and form characteristics. Consequently, most of the geometric characteristics
  can be controlled by a few controls, and refinements are only added as necessary."*
  → ⭐ **Menos controles, mejor plano.** El perfil de superficie subsume paralelismo, perpendicularidad,
  planitud y cilindricidad. Un generador que estampa todos los símbolos hace un plano peor.
- §20-7: *"when a feature of size is used as a datum feature, the size tolerance automatically provides form
  control through Rule #1"* → hay implicaciones automáticas que NO hay que volver a escribir.

### 3.8 Límites y ajustes (§7-8)

- Sistema **base agujero** (desviación fundamental H) es el que el cliente presenta; el de base eje se omite
  deliberadamente: *"The shaft-basis system is not included here."*
- Solo se necesitan los grados **IT6 a IT11** para los ajustes preferentes: *"These range from IT0 to IT16, but
  only grades IT6 to IT11 are needed for the preferred fits."* ⭐ **El catálogo útil es 6 grados, no 17.**
- Mayúsculas = agujero, minúsculas = eje. Tabla 7-9 da los ajustes preferentes (H11/c11 *loose running*,
  H9/d9 *free running*, H8/f7 *close running*, H7/g6 *sliding*, …).
- §1-14: *"the diameter of a shaft does not generally need a tight tolerance, except for the portions that must
  fit with components like bearings or gears."* ⭐ **Tolerancia cerrada SOLO en las zonas de ajuste.**

---

## 4. ITERACIONES — el mapa de lazos de retorno y qué los dispara

| Lazo | Origen → Destino | Disparador | § |
|---|---|---|---|
| **L1** | Evaluación → Síntesis | el prototipo no satisface la necesidad | §1-3 Fig 1-1 |
| **L2** | Análisis → Síntesis | *"we may synthesize several components of a system, analyze and optimize them, and return to synthesis to see what effect this has on the remaining parts"* | §1-3 |
| **L3** | Tamaño comercial → recálculo de n | redondeaste d al tamaño preferente (Tabla A-17) ⇒ n real ≠ nd | §1-11 Ej 1-1 |
| **L4** | Diseño por esfuerzo → **cambio de material** | los diámetros crecen más de lo aceptable | §18-7: *"The material choice was changed in the course of this phase, choosing to pay for a higher strength to limit the shaft diameter to 2 in."* |
| **L5** | Diseño del eje → **rediseño de los engranes** | *"If it becomes necessary to increase the shaft diameter any more, the gearing specification will need to be redesigned."* (el barreno del piñón chico ya no da) | §18-7 ⭐ |
| **L6** | Deflexión → layout del eje | pendiente o flecha fuera de la Tabla 7-2; *"In a first iteration… with longer shafts due to using gears with hubs, the deflections were more critical than the stresses."* | §18-8 ⭐ |
| **L7** | Selección de rodamiento → ajuste del diámetro del eje | *"The diameters can be adjusted slightly as necessary to match the catalog specifications."* | §18-1, §18-9 |
| **L8** | Cotas reales conocidas → **recalcular Kt** | la Tabla 7-1 dice: *"Do not use these once actual dimensions are available."* | §7-4 ⭐ |
| **L9** | Kt del hombro crítico → **cambiar el rodamiento o rebajar el hombro** | *"the designer should plan to select a bearing with generous fillet radius, or consider providing for a larger fillet radius on the shaft by relieving it into the base of the shoulder"* (Fig 7-9 a/b/c) | §7-4 ⭐ |
| **L10** | Engranes de catálogo → recuento de dientes | *"If stock gears are to be used, their availability in prescribed numbers of teeth with anticipated diametral pitch should be checked at this time. If necessary, iterate the design for numbers of teeth that are available."* | §18-3 |
| **L11** | Tamaño del paquete → recuento de dientes | *"A difference of one tooth on the smallest gear can result in a significant increase in size of the overall package."* | §18-3 ⭐ |
| **L12** | Convergencia de malla → remallado | cambio de σmax > ~2% al refinar | §19-4 |
| **L13** | Vida finita detectada → cambiar de criterio | Goodman sirve para el n de vida infinita pero es malísimo para estimar N | §6-14 |
| **L14** | Hub de engrane → longitud del eje → todo | *"Originally, gears with hubs were considered… However, the extra hub lengths added several inches to the shaft lengths and the gearbox housing."* | §18-4 ⭐ |

---

## 5. JUICIOS HUMANOS — lo que el software NO debe resolver en silencio

| Juicio | Qué lo gobierna | § |
|---|---|---|
| **Cuánto vale nd** | 3 ejes: exactitud de la predicción, costo de sobrediseñar, consecuencias de la falla | §1-11 |
| **Determinista vs estocástico** | *"The deterministic method… attempts to determine a value… The stochastic method… allowing a prediction of the percent probability of success."* | §1-10 |
| **Qué criterio de falla estática** | diseñar (MSS, conservador) vs. forense (DE, mejor ajuste) | §5-7, §5-11 |
| **Qué criterio de fatiga** | conservadurismo aceptable vs. mejor ajuste; y distinto para vida infinita vs vida finita | §6-13, §6-14 |
| **Qué confiabilidad** | Tabla 6-4 (ke) va de 50% a 99.99%; el cliente advierte que ke solo cubre la dispersión del límite de fatiga | §6-9 |
| **Elegir material** | listas ponderadas o índice de Ashby derivado del caso de carga; y para ejes, empezar barato | §2-22, §7-2 |
| **Cuándo un análisis basta** | *"What is important is what solution the analyst is looking for: deflections, stresses, or both?"* | §19-7 |
| **Cuáles cotas especificar** | funcional: *"the designer should make this determination, not the manufacturer"* | §1-14 |
| **Elegir datums** | por función, no por manufactura | §20-7 |
| **Aceptar o no el voladizo** | poleas y catarinas *"often need to be mounted outboard for ease of installation of the belt or chain"* — a veces el voladizo GANA | §7-3 ⭐ |
| **Cuántos escalones tiene el eje** | *"There are no absolute rules for specifying the general layout"* | §7-3 |
| **Modelar el cojinete como apoyo simple o empotramiento** | correr ambos y acotar | §19-6 |

---

## 6. CRITERIOS DE ACEPTACIÓN — la lista de verificación antes de firmar

### 6.1 Genéricos (cap 1)
- [ ] Todos los n calculados son > 1, y el **mínimo** está identificado y documentado (§1-11 A5).
- [ ] Cada n trae escrito **por qué** ese valor (§1-11 A3).
- [ ] Los n se compararon en **el mismo punto**, del **mismo tipo** (normal vs cortante) y en las **mismas
      unidades** (§1-11).
- [ ] Se redondeó a tamaños preferentes (Tabla A-17) y se recalculó n (§1-11 Ej 1-1).
- [ ] Se revisó el stack-up de tolerancias en el ensamble (§1-14 Ej 1-5).

### 6.2 Eje (caps 7 y 18)
- [ ] Fatiga a vida infinita en cada ubicación crítica: hombro, cuñero, ranura de anillo (§7-4).
      ⭐ §18-7: *"It turns out that the keyway is the critical location. It seems that shoulders often get the
      most attention. This example demonstrates the danger of neglecting other stress concentration sources."*
- [ ] Fluencia en el **primer ciclo** con σ'max (Ec 7-15, 7-16) — *"It is always necessary to consider the
      possibility of static failure in the first load cycle."* (§7-4)
- [ ] Deflexión y pendiente contra la Tabla 7-2 en **cada engrane y cada cojinete** (§7-5).
- [ ] Primera velocidad crítica ≥ **2×** la de operación — *"Designers seek first critical speeds at least
      twice the operating speed."* (§7-6) ⭐
- [ ] Cuña: aplastamiento (y cortante si no es cuadrada) (§18-10).
- [ ] Ajustes especificados donde hay montaje de rodamiento/engrane (§7-8, §18-11).
- [ ] Kt recalculados con las cotas REALES, no con la Tabla 7-1 (§7-4).

### 6.3 Fatiga (cap 6)
- [ ] ¿Ambiente corrosivo? Entonces **no existe vida infinita** (§6-9).
- [ ] ¿T > 40% de T_fusión absoluta? El método esfuerzo-vida ya no aplica (§6-9).
- [ ] ¿Pieza cementada? Evaluar caso **y** núcleo (§6-9, Fig 6-25).
- [ ] ¿Se aplicó kc **y** von Mises a la vez? Es doble conteo (§6-16).
- [ ] ¿Se corrigió Sut por temperatura **y** se aplicó kd? Doble conteo (§6-9).
- [ ] Chequeo de fluencia localizada aparte del de fatiga (§6-19 paso 3).

### 6.4 FEA (cap 19)
- [ ] Estudio de convergencia con dos mallas; Δσmax ≲ 2% (§19-4).
- [ ] Sin transiciones bruscas de malla (§19-4).
- [ ] σmax reportado excluye la vecindad del punto de carga (Saint-Venant, §19-5).
- [ ] BC contrastadas contra los dos extremos plausibles (§19-6).
- [ ] Benchmark contra un problema de solución conocida (§1-4).

---

## 7. TABLAS Y FACTORES DE CATÁLOGO DURO — dónde viven y qué los indexa

### 7.1 Lo que SÍ es tabla numérica (parseable directo del PDF)

| Tabla | Contenido | Indexada por |
|---|---|---|
| A-5 | Constantes físicas de materiales (E, G, ν, ρ) | material |
| A-6 / A-7 / A-8 | Ángulos, canales y tubo redondo estructural | designación |
| **A-9** | **Cortante, momento y deflexión de vigas** (≈8 páginas) | caso de carga + apoyos |
| A-10 | CDF normal Φ(z) | z |
| A-11 … A-14 | Grados IT y desviaciones fundamentales (métrico e inglés) | tamaño básico + grado/letra |
| **A-16** | Kt / Kts de barra o tubo redondo con **barreno transversal** | a/D y d/D |
| A-17 | Tamaños preferentes y serie Renard | — |
| A-18 | Propiedades geométricas de secciones | forma |
| A-19 | Tubería estándar americana | tamaño nominal |
| **A-20** | Sut y Sy mínimos ASTM de aceros **HR y CD** | UNS/AISI + condición |
| **A-21** | Propiedades medias de aceros **tratados térmicamente** | AISI + temperatura de revenido |
| A-22 | Resultados de ensayos de tensión | material |
| **A-23** | Propiedades monotónicas y **cíclicas** (σ'f, b, ε'f, c) | acero |
| A-24 | Tres metales no-acero (incluye límites de fatiga de hierros fundidos y **resistencias a 5·10⁸ ciclos de aluminios**) | material |
| A-25 | Equivalentes decimales de calibres de alambre y lámina | calibre |
| A-26 … A-30 | Dimensiones de tornillos, tuercas y arandelas | tamaño |
| A-31 | Función gamma | x |
| 6-2 | Parámetros a y b de ka | acabado superficial |
| 6-3 | Áreas A_0.95σ de perfiles no rotatorios en flexión | forma de sección |
| 6-4 | ke por confiabilidad | % confiabilidad (za) |
| **7-1** | **Kt/Kts de PRIMERA ITERACIÓN** | tipo de feature (hombro agudo/redondeado, cuñero, ranura de anillo) |
| 7-2 | Pendientes y flechas máximas típicas | tipo de rodamiento / paso diametral del engrane |
| 7-4 | Par de asiento y capacidad de retención de prisioneros | tamaño en pulgadas |
| 7-6 / 7-8 | Dimensiones de cuña cuadrada/rectangular y Woodruff | diámetro del eje |
| 7-9 | Ajustes preferentes base agujero | tipo de ajuste |
| 20-1 | Controles geométricos GD&T | característica |

### 7.2 ⭐ Lo que **NO** es tabla: son GRÁFICAS y ese es un problema de implementación real

| Fuente | Qué es | Consecuencia |
|---|---|---|
| **Tabla A-15** (7 páginas, Figs A-15-1 … A-15-17) | **Cartas de Kt teórico** de Peterson: barra con barreno, barra ranurada, eje escalonado en flexión/torsión/axial, ranura de fondo plano, etc. | El PDF solo entrega ejes y etiquetas de curva. **Los valores hay que digitalizarlos o usar ajustes publicados (Peterson/Pilkey).** El cliente los lee **a ojo** — esa es una operación humana que hay que reemplazar con curvas ajustadas, y declarar el error del ajuste. |
| Fig 6-24 | Tendencias de ka | Ya resuelto: el libro da el ajuste `ka = a·Sut^b` (Tabla 6-2). |
| Fig 6-23 | Fracción f a 10³ ciclos | Resuelto: Ec 6-11. |
| Figs 6-26 / 6-27 | Sensibilidad a la muesca q y qs | Resuelto: Neuber, Ec 6-33 + 6-35/6-36. |
| Fig 6-22 | Se' vs Sut | Resuelto: Ec 6-10. |
| Fig 2-23 / 2-25 | Cartas de Ashby E vs ρ | No hay datos numéricos; hay que construir la base propia. |

> **Requisito derivado:** el módulo de concentradores necesita una **capa de digitalización de las cartas
> A-15** con su incertidumbre declarada. Es el único lugar del libro donde el cliente depende de leer una
> gráfica a ojo, y es el input que más pesa en el resultado de fatiga.

---

## 8. LOS DIEZ ⭐ — los detalles que una máquina lineal se salta

1. **§5-2 — En carga estática con material dúctil, Kt = 1.** El material fluye en la muesca y endurece. Con
   tres excepciones que hay que codificar: fractura frágil posible, hierro fundido (ya trae la muesca en el
   ensayo), y carga no estática.
2. **§6-13 vs §6-14 — El criterio de fatiga cambia según la pregunta.** Goodman para el factor de seguridad a
   vida infinita; **Walker > Morrow > SWT > Goodman** para estimar vida finita. Goodman aquí es *"very
   inaccurate"*.
3. **§6-9 kd + §6-16 kc — Doble conteo.** O corriges Sut por temperatura **o** aplicas kd, nunca ambos. Y si
   combinas torsión con flexión, kc = 1 porque el von Mises ya lo contó.
4. **§6-9 kb — Rotatorio ≠ no rotatorio.** `de = 0.370·d` para redondo no rotatorio en flexión;
   `de = 0.808·√(hb)` para rectangular. Cambia Se sin que cambie ni la carga ni el material.
5. **§6-17 — El ciclo escondido.** *"The most damaging cycle is number 1. It could have been lost."* El conteo
   ingenuo de picos pierde justo el ciclo que rompe la pieza. Y el `c` de Miner varía de 0.7 a 2.2.
6. **§7-2 — Si el problema es deflexión, cambiar de acero no sirve.** E es prácticamente constante entre
   aceros. Solo la geometría arregla rigidez. Corolario: subir Sut tiene rendimientos **negativos** en fatiga
   porque castiga ka y sube q.
7. **§7-4 Tabla 7-1 — Los Kt de primera iteración son andamio, y el libro grita que hay que tirarlos:**
   *"Warning: These factors are only estimates… Do not use these once actual dimensions are available."*
8. **§7-7 — La regla d/10 entre concentradores.** El extremo del cuñero debe quedar a ≥ d/10 del inicio del
   filete del hombro para que los dos Kt no se sumen. Es puramente geométrica y verificable.
9. **§7-3 / §18-4 — Hay que modelar el hueco del EXTRACTOR y el hombro "de relleno" flojo.** Espacio que
   parece desperdicio y que en realidad es armabilidad y ahorro. Y un solo cojinete fijo axialmente por eje,
   para no agarrotar con la dilatación térmica.
10. **§19-7 / §19-4 — El modelo más caro no es el mejor.** 5 elementos viga empatan con 56 384 tets para
    deflexiones. Y una transición brusca de malla **fabrica** un concentrador que no existe en la pieza.

*(Ver también los ⭐ de engranes, resortes, rodamientos, uniones y frenos en las secciones aportadas por el
barrido de los capítulos 8–17, más abajo.)*

---

## 8.5 BARRIDO DE LOS CAPÍTULOS 8–17

<!--MARCADOR-CAPS-8-17-->

---

## 9. BRECHA CONTRA LA FORJA

> Base: inventario técnico del repo `/home/ian/Orkesta/la-forja` (auditoría hecha para este pliego).
> Leyenda: ✅ existe y sirve · 🟡 existe parcial / hay que extender · ❌ no existe.

### 9.1 Lo que YA TENEMOS y el cliente reconocería como suyo

| Capacidad | Dónde vive | Qué § de Shigley cubre |
|---|---|---|
| ✅ **FEA tet4 + CG disperso + von Mises + FS** | `src/forja/brep/fea.ts` (`brepToVolumeTetMesh`, `sparseCG`, `runFEA`, `prepareFeaSession`/`solveLoadOnSession`) | §5 (dúctil, DE) y §19 parcialmente |
| ✅ **Formulario mecánico** (tet4, vigas Euler-Bernoulli y Timoshenko, von Mises, principales, cortante máximo, Euler, secciones, Lamé) | `src/lib/formulas.ts` (1457 líneas) | §3, §4 parcial |
| ✅ **Base de materiales** (E, ν, ρ, Sy, Sut, k, cp, α, G) — 17 materiales | `src/lib/formulas.ts` `MATERIAL_DATABASE` | §2, Tabla A-5/A-20 parcial |
| ✅ **Tornillería a tensión**: Fp = At·Sp, longitud de engrane FED-STD-H28, precarga 0.75·At·Sp, par T = 0.2·Fi·d | `src/forja/mold/mold-fasteners.ts`, `fasteners.ts` | §8-6, §8-8 parcial |
| ✅ **Catálogo DIN + roscas ISO 68-1 procedurales** | `src/lib/parts/fasteners/`, `src/forja/mold/mold-threads.ts`, `src/forja/brep/thread.ts` | §8-1, Tablas A-26..A-30 |
| ✅ **Involuta, módulo, Lewis, relación de contacto, planetario, cremallera, cicloidales** | `src/lib/parts/{involute-gear-sketch,gear-pair,gear-mechanics,planetary}.ts`, `src/forja/mech/cycloidal.ts` | §13-2..13-6, §13-13, §14-1 |
| ✅ **Ajustes y tolerancias** (Kazmer, literal) | `src/forja/mold/fits.ts` | §7-8, Tablas A-11..A-14 |
| ✅ **Planos ISO con HLR real**, 1er/3er ángulo, ISO 2768/1302/7200 | `src/forja/brep/drawing.ts`, `isoview.ts` | §1-14, §20 parcial |
| ✅ **Bus de comandos** `ui.run` (61 comandos, 15 dominios, con campo `eq` de trazabilidad al libro) | `src/forja/commands/registry.ts` | — (infraestructura) |
| ✅ **Patrón libro→módulo→test→gate** con ~40 suites | `src/forja/mold/*` + `scripts/*-test.cjs` + `scripts/forja-gate.cjs` | — (infraestructura) |
| ✅ **Presión de interferencia** (Lamé) | `src/lib/formulas.ts` `lameThickCylinder` | §3-16 (falta despejar p de δ, Ec 3-60/3-61) |

### 9.2 Lo que se puede construir CON LO QUE HAY (semanas, no meses)

| Qué | Con qué se apalanca | § |
|---|---|---|
| 🟡 **Módulo de fatiga completo** (Marin ka..ke, q/Kf de Neuber, Basquin, Goodman/Morrow/Gerber/Soderberg/ASME/SWT/Walker, Miner, rainflow) | ya hay `basquinSN` y `goodmanFatigueSafety` en `formulas.ts` (con Se'=0.5Sut hardcodeado y f=0.9 fijo — hay que **corregirlos**, no extenderlos); `MATERIAL_DATABASE` da Sut/Sy | §6 completo |
| 🟡 **Fatiga sobre el FEA que ya tenemos** | `prepareFeaSession` + `solveLoadOnSession` YA resuelve N cargas sobre una K ensamblada una vez → correr caso `max` y caso `min`, sacar σa y σm nodales, aplicar Marin/Goodman por nodo y pintar un **mapa de nf** en vez de un mapa de FS estático | §6-16, §19 |
| 🟡 **Árbol de selección de criterio de falla estática (Fig 5-21)** | tenemos von Mises y principales; falta Coulomb-Mohr, Mohr modificado y el ÁRBOL | §5-11 |
| 🟡 **Euler + J. B. Johnson con transición** | `eulerBucklingLoad` ya existe con 4 condiciones de extremo; falta la parábola de Johnson y el corte en (l/k)₁ = (2π²CE/Sy)^½ | §4-12, §4-13 |
| 🟡 **Diagramas V(x), M(x), T(x) + deflexión de eje escalonado** | `beamStiffnessEulerBernoulli`, `beamStiffnessTimoshenko` y el solver CG ya están; falta el ensamblador 1-D de vigas por tramos y las funciones de singularidad | §3-2, §4-6, §7-5 |
| 🟡 **AGMA de engranes rectos** | `gear-mechanics.ts` ya trae Lewis Y(z) y `gear-pair.ts` la relación de contacto; falta la maquinaria de factores AGMA | §14 |
| 🟡 **Cuñas** | tenemos catálogo DIN y roscas; la cuña es una tabla indexada por diámetro + un cheque de aplastamiento | §7-7, §18-10 |

### 9.3 Lo que FALTA POR COMPLETO

| # | Hueco | Impacto para un taller LATAM | § |
|---|---|---|---|
| **H1** | **Fatiga con Marin.** No existe ka/kb/kc/kd/ke, ni q/Kf, ni criterios de esfuerzo medio más allá de un Goodman suelto, ni Miner, ni rainflow. | **Crítico.** Es la columna vertebral: ejes, engranes, resortes, tornillos y soldadura la usan. Sin esto solo sabemos decir "no fluye", que es la mitad del trabajo. | §6 |
| **H2** | **Diseño de ejes.** No hay V/M, ni DE-Goodman despejado para d, ni Tabla 7-1, ni Tabla 7-2, ni velocidad crítica, ni cuñas, ni anillos. | **Crítico.** "Diséñame este eje" es de lo que más se cobra. | §7, §18 |
| **H3** | **Rodamientos.** Cero. No hay L10, ni C/P, ni Weibull, ni X/Y, ni catálogo, ni el árbol de casos IA/IB/IIA/IIB de cónicos. | **Alto.** Sin esto la caja de engranes no cierra. | §11 |
| **H4** | **Resortes helicoidales.** Cero. No hay Wahl, ni C = D/d, ni k = Gd⁴/(8D³Na), ni pandeo, ni Sut = A/d^m, ni Zimmerli. | **Alto.** Es de los trabajos más pedidos y más fáciles de cobrar. | §10 |
| **H5** | **Soldadura.** Cero. Lo que el repo llama `weld` son líneas de flujo de plástico y fusión FDM. No hay garganta, ni cordón-como-línea, ni electrodos, ni fatiga de soldadura. | **Alto.** En LATAM medio catálogo de piezas es soldado. | §9 |
| **H6** | **Rigidez de junta atornillada.** Tenemos el tornillo como barra a tensión, pero no kb, km (frusta 30°), C = kb/(kb+km), separación de junta ni fatiga del perno. | **Medio-alto.** Sin C, la precarga que ya calculamos no sabe repartir la carga externa. | §8-4, §8-5, §8-9, §8-11 |
| **H7** | **Kt de catálogo (Tabla A-15).** Solo tenemos `ktPlateWithHole`. Faltan filete de eje escalonado (flexión/torsión/axial), ranura, cuñero, ranura de anillo. **Y viven en GRÁFICAS, hay que digitalizarlas.** | **Crítico** (bloquea H1 y H2). | §3-13, Tabla A-15/A-16 |
| **H8** | **AGMA completo** (Ko, Kv/Qv, Ks, KH, ZR, ZW, YN/ZN, YZ, Yθ, KB, ZE, I, J, St/Sc por dureza y grado). Helicoidales, cónicos y sinfín. | **Alto.** Lewis solo no vende una caja. | §14, §15 |
| **H9** | **Embragues, frenos y volantes.** Cero. | **Medio.** Nicho, pero se cobra caro. | §16 |
| **H10** | **Bandas y cadenas.** Cero. | **Medio-alto.** Es el trabajo diario de un taller de transmisiones. | §17 |
| **H11** | **Esfuerzos de contacto de Hertz.** Cero. Es la base de la fatiga superficial de engranes y rodamientos. | **Medio** (habilitador de H3 y H8). | §3-19, §6-18 |
| **H12** | **Confiabilidad / estadística.** No hay Φ(z), ni la relación nd↔R de §1-13, ni Weibull. | **Medio.** El cliente lo usa para justificar el nd. | §1-12, §1-13, §11-4 |
| **H13** | **Aceros del libro** (Tablas A-20/A-21/A-23: HR/CD por UNS, tratados térmicos por temperatura de revenido, y **propiedades cíclicas σ'f, b, ε'f, c**). Tenemos 17 materiales; el libro trae decenas y con los datos que la fatiga necesita. | **Alto** (habilitador de H1). | Tablas A-20..A-24 |
| **H14** | **Fractura (LEFM)**: KIc, damage-tolerant design. | **Bajo** para taller LATAM. | §5-12, §6-5 |
| **H15** | **Cojinetes de deslizamiento (journal)**: tenemos tribología propia (`cojinete-continuo.ts`, `cojinete-jaula.ts`) pero no las cartas de Raimondi-Boyd del cap 12. | **Bajo-medio.** | §12 |

### 9.4 Lo que el cliente NOS PIDE que NO hagamos (y hoy podríamos estar haciendo mal)

1. **§6-9 — No presentes Se con precisión falsa.** El propio autor dice que la multiplicatividad de Marin
   *"has not been thoroughly tested and proven"*. Nuestro `FEAResult.minSafetyFactor` hoy sale como un número
   pelón; en fatiga eso sería peor.
2. **§1-11 — No inventes confiabilidad a partir del método determinista.** *"In neither case is there any
   information about a statistical percentage of failures."*
3. **§19-7 — No metas más malla porque sí.** Nuestro `brepToVolumeTetMesh` tiene `resolution`: la UI debe
   preguntar primero *¿deflexión, esfuerzo, o ambos?* y recomendar el modelo, no maximizar elementos.
4. **§7-4 Tabla 7-1 — No dejes vivos los Kt de arranque.** Si el flujo estima Kt=2.7 en la iteración 1, el
   sistema tiene que **exigir** que se recalculen cuando aparezcan r y D reales.

---

## 10. PLAN DE CONSTRUCCIÓN — qué módulo primero y por qué

### 10.1 La decisión

> **Módulo #1 = `src/forja/maquinas/fatiga.ts` — el motor de fatiga esfuerzo-vida completo del capítulo 6.**

**Por qué ése y no el de ejes (que es lo que más se cobra):**

1. **Es la columna vertebral.** Ejes (§7), engranes (§14-4 con YN/ZN), resortes (§10-9/10-10), tornillos
   (§8-11) y soldadura (§9-7) **todos** cuelgan de Se, Kf y de un criterio de esfuerzo medio. Si construyes
   ejes primero, construyes fatiga a medias y enterrada adentro; después la vas a tener que sacar.
2. **Es puro TypeScript sin OCCT ni React**, exactamente el perfil del patrón que ya funciona
   (`src/forja/mold/structural.ts` → `scripts/mold-structural-test.cjs` → alta en `forja-gate.cjs`).
3. **Se verifica contra números literales del libro.** El cap 6 trae ejemplos resueltos numerados (Ej 6-2 a
   6-18) y el cap 7 trae el Ej 7-1 con **cuatro** factores de seguridad para el mismo eje
   (DE-Goodman 1.52 · DE-Morrow 1.60 · DE-Gerber 1.73 · DE-SWT 1.38). Ese ejemplo solo es un gate de cuatro
   invariantes en una línea, del mismo estilo que los gates de Kazmer.
4. **Convierte el FEA que ya tenemos en un producto distinto.** `prepareFeaSession` + `solveLoadOnSession` ya
   resuelven N casos de carga sobre una sola K ensamblada. Con fatiga encima, dos corridas (carga máxima y
   mínima) producen un **mapa nodal de factor de seguridad a fatiga** en lugar del mapa estático de hoy.
   Eso es una capacidad que Fusion cobra en su nivel de simulación de pago.
5. **Arregla deuda existente.** Hoy `basquinSN` tiene Se' = 0.5·Sut y f = 0.9 clavados, sin Marin. Eso está
   **mal** según §6-8/§6-9 y hay que corregirlo, no envolverlo.

### 10.2 Orden propuesto

| Orden | Módulo | Depende de | Gate (verificación contra el libro) |
|---|---|---|---|
| **1** | `fatiga.ts` — Se' (6-10), Marin ka..ke (6-17..6-28), f (6-11), a/b (6-13,6-14), q/Kf Neuber (6-33..6-36), los 7 criterios (6-40..6-57), σar equivalente (6-59..6-62), Miner + rainflow (6-68,6-69) | `MATERIAL_DATABASE` | Ej 6-2..6-18 + los 4 n del Ej 7-1 |
| **1b** | `kt.ts` — digitalización de las cartas A-15 + Tabla A-16 numérica + Tabla 7-1 | — | Tabla A-16 literal; A-15 con error de ajuste declarado |
| **1c** | `aceros.ts` — Tablas A-20, A-21, A-23, A-24 | — | valores literales |
| **2** | `eje.ts` — V(x)/M(x)/T(x), DE-* despejadas para d (7-6..7-16), Tabla 7-1, Tabla 7-2, velocidad crítica (7-22,7-23), cuña (Tabla 7-6 + aplastamiento), anillos, ajustes (7-9) | 1, 1b, 1c | Ej 7-1, Ej 7-2, Ej 7-3, Ej 7-6 y el caso de estudio del cap 18 completo |
| **3** | `rodamiento.ts` — L10, Weibull 3P, X/Y, af, cónicos IA/IB/IIA/IIB | 1 | Ejemplos del cap 11 + caso de estudio §18-9 |
| **4** | `resorte.ts` — estático (10-7) y fatiga (10-10) | 1 | procedimientos §10-7/§10-10 |
| **5** | `union.ts` — kb/km/C, separación, fatiga del perno (§8) + soldadura cordón-como-línea (§9) | 1 | Tablas 9-1/9-2 + ejemplos |
| **6** | `agma.ts` — engrane recto y helicoidal | 1, 11 (Hertz) | §14-19 diseño de malla |
| **7** | `transmision.ts` — el ORQUESTADOR del §18-1: el grafo de 10 pasos con sus 14 lazos de retorno | 2,3,4,6 | caso de estudio cap 18 de punta a punta |

> El paso **7 es el producto de verdad**. Los pasos 1–6 son piezas; §18-1 es lo que el cliente hace. Y el
> caso de estudio del capítulo 18 (reductor de 20 hp, 1750→85 rpm, con sus especificaciones completas en
> §1-18) es el **test de aceptación de todo el sistema**: si La Forja lo reproduce de punta a punta y
> coincide con las respuestas del libro, el módulo está terminado.

### 10.3 Cómo se engancha a lo que ya existe

- **Registro en el bus** (`src/forja/commands/registry.ts`) con dominio nuevo `fatiga` y el campo `eq`
  apuntando a la ecuación de Shigley, igual que hoy `clamp.force` apunta a `Eq 5.29` de Kazmer:
  ```
  reg({ id: 'fatiga.marin', domain: 'fatiga', eq: 'Ec 6-17', status: 'implementado',
        summary: 'Se = ka·kb·kc·kd·ke·Se\'', run: (p) => marin(p) })
  ```
- **Gate**: una suite por módulo en `scripts/forja-gate.cjs`, grupo nuevo `shigley`, con el `why` citando el
  ejemplo del libro que verifica.
- **Materiales**: extender `MATERIAL_DATABASE` con los campos que la fatiga necesita y hoy no están
  (acabado superficial por defecto, σ'f, b, ε'f, c, dureza HB) — o crear `aceros.ts` aparte y cruzarlo.

