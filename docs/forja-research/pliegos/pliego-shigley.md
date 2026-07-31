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

## 8. LOS DIEZ ⭐ DEL NÚCLEO (caps 1–7, 18–20)

*(La lista definitiva del libro completo, escogiendo entre los ~50 ⭐ de todos los capítulos, está en la
sección 13 al final.)*

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

## 9. BARRIDO DE LOS CAPÍTULOS 8–17

Barrido completo hecho sobre los capítulos 8–17. Las notas exhaustivas por bloque (con las ecuaciones,
tablas transcritas y citas literales) quedan como anexos en esta misma carpeta:
`anexo-shigley-caps8-9.md` (1211 líneas) · `anexo-shigley-caps10-11.md` (2155) ·
`anexo-shigley-caps13-15.md` (1090) · `anexo-shigley-caps16-17.md` (~1770).
Aquí va lo condensado y accionable.

### 9.1 Uniones atornilladas (cap 8) y soldadas (cap 9)

**El proceso a mano — junta a tensión con precarga:**
```
kb = Ad·At·E / (Ad·lt + At·ld)                                          [8-17]
km = frustos de α=30° EN SERIE, uno por material y por tramo,
     con D propagándose de un frusto al siguiente                       [8-18..8-20]
     (cerrada 8-22 si es simétrica; Wileman 8-23 SOLO si toda la junta es del mismo material)
C  = kb/(kb+km)   →   Fb = C·P + Fi ,  Fm = (1−C)·P − Fi                [8-24, 8-25]
T  = K·Fi·d , K de (8-26) o Tabla 8-15                                  [8-26]
np = Sp·At/(C·P+Fi)   ·   nL = (Sp·At − Fi)/(C·P)   ·   n0 = Fi/(P(1−C)) [8-28..8-30]
Fi = 0.75·Fp reusable   |   0.90·Fp permanente
```
**Fatiga del perno (§8-11):** σa = C(Pmax−Pmin)/2At, σm = … + Fi/At, σi = Fi/At; Goodman (8-38) general y
(8-45..8-47) para carga repetida; nf con precarga (8-48); tope `Fi ≤ (1−C)·Sut·At` (8-50).

**Soldadura — el método "cordón como línea" (§9-3, §9-4):**
```
garganta = 0.707·h
J = 0.707·h·Ju      I = 0.707·h·Iu         (Ju, Iu de Tablas 9-1 y 9-2, por patrón geométrico)
τ' = V/A            τ'' = M·r/J   ó   M·c/I
τ  = sqrt(τ'² + τ''²)        — todo referido al centroide del grupo de cordones
```
Fatiga de soldadura (§9-7): ka = 12.7·Sut^−0.758 (**siempre el de forjado**), kb = 1, kc = 0.59,
Kfs de la Tabla 9-5, Ssu = 0.67·Sut, Goodman en cortante.

**Reglas de prosa que valen oro:**
- §8-5: *"It is easy to program the numbered equations in this section, and **you should do so**."*
  → El cliente literalmente nos está encargando el módulo.
- §8-5: *"Equation (8-20), or (8-19), **must be solved separately for each frustum** in the joint."*
- §8-5: *"it is very important to note that **the entire joint must be made up of the same material**"*
  (condición de validez de Wileman).
- §8-5: *"If one of the members is a **soft gasket**, its stiffness… is usually so small that… only the
  gasket stiffness [is] used."*
- §8-3: *"The ideal bolt length is one in which only one or two threads project from the nut."*
- §8-3: *"**washers must always be used under the bolt head**. They should be of hardened steel."*
- §8-3: *"you should **NEVER reuse nuts**; in fact, it can be dangerous to do so."*
- §8-6: *"**The grade of the nut should be the grade of the bolt.**"* y *"If such marks are missing,
  assume the bolt strength is unregulated."*
- §8-8: *"**Do not rely too much on wrench torque when the range of acceptable preload is narrow.** If
  high reliability is a requirement, then preload should be determined by **bolt elongation**."*
- §8-10 empaques: espaciamiento `3 ≤ π·Db/(N·d) ≤ 6`.

**⭐ de este bloque (los 10 completos están en `anexo-shigley-caps8-9.md`):**
1. ⭐ **km no es una fórmula, es un ensamble de frustos en serie.** Hay que partir el agarre por material
   **y** por el plano medio de la junta, y el diámetro exterior de cada frusto es el que dejó el anterior.
   En el Ej 8-2 la diferencia es **9.378 vs 14.64 Mlbf/in — 36%**.
2. ⭐ **Las roscas NO comparten la carga: 0.38 / 0.25 / 0.18 / … / 0 en la séptima.** La receta del cliente
   es meter `0.38·F` con `nt = 1` (si hay ≥6 roscas engranadas). Repartir F/nt subestima ~2.3×.
3. ⭐ **Sp ≠ Sy, y los códigos especifican Sp, no Sy.** Fallback documentado: `Sp ≈ 0.85·Sy`.
4. ⭐ **Kf ya viene DENTRO de Se en la Tabla 8-17** (roscas laminadas). Aplicarlo otra vez es doble castigo;
   y si decides aplicarlo a esfuerzos, va a σa **y** a σm o las fórmulas cerradas dejan de valer.
5. ⭐ **El plano de la cara de la tuerca solo es el punto crítico si hay rondana y el runout tiene semicono
   ≤15°.** Los datos: 15% de fallas bajo la cabeza, 20% en el runout, **65% donde el diseñador puso
   atención**. *"It does little good to concentrate on the plane of the nut washer face if it is not the
   weakest location."*
6. ⭐ **El 0.707h y el "todo es cortante" son conservadurismo CALIBRADO, no simplificación.** El análisis
   riguroso da τmax = 1.207·F/(hl); el modelo usa 1.414 — **17% inflado a propósito**, y las pruebas
   validaron ESE número. Un implementador que "corrija" el modelo rompe la calibración experimental.
   Igual con Iu: el libro **reconoce** que usar (d+h) sería más exacto **y lo rechaza** por conservadurismo.
7. ⭐ **En soldadura casi siempre manda el METAL BASE, no el cordón** (τ_base ≤ 0.40·Sy, Tabla 9-4). Y
   **soldar una barra estirada en frío le borra las propiedades de CD y la deja en HR** cerca del cordón:
   la resistencia del miembro **cambia por el hecho de soldarlo**.

**Tablas de catálogo:** 8-9 SAE / 8-10 ASTM / 8-11 métrica — **indexadas por grado × RANGO DE DIÁMETRO**
(grado 5: 85/120/92 kpsi hasta 1 in, pero 74/105/81 de 1⅛–1½; clase 8.8: 600/830/660 MPa M16–M36).
8-8 Wileman (A, B por material). 8-15 K por acabado (0.30 negro … 0.09 Bowman-Grip). 8-16 Kf y 8-17 Se ya
corregida, por grado × tamaño. 9-1/9-2 Ju/Iu por patrón (6 y 9 casos). 9-3 electrodos E60xx–E120xx.
9-4 AISC (tensión 0.60Sy, aplastamiento 0.90Sy, cortante 0.30Sut, tope 0.40Sy en base). 9-5 Kfs por tipo de
junta (1.2 / 1.5 / **2.7** / 2.0). **9-6-B tamaño mínimo de filete por el espesor de la parte más GRUESA.**

### 9.2 Resortes (cap 10) y rodamientos (cap 11)

**Resorte de compresión, servicio estático (§10-7).** El cliente **barre `d` sobre el catálogo discreto de
alambre** y llena una tabla; no optimiza continuo.
```
A priori: material (hard-drawn primero, costo relativo 1.0) · tipo de extremo · ξ = 0.15 ·
          (ns)d = 1.2 · as-wound vs set-removed · topología (over-a-rod / free / in-a-hole)
POR CADA d DEL CATÁLOGO (Fig 10-3):
  Ssy = const(A)/d^m   (ó 0.65·A/d^m si set-removed)
  α = Ssy/ns ;  β = 8(1+ξ)Fmax/(π d²)
  C ← Ec (10-23), RAÍZ MAYOR        →  D = C·d  →  KB  →  τs  →  ns
  OD / ID
  Na = G·d⁴·ymax/(8·D³·Fmax)  →  Nt, Ls, L0 (Tabla 10-1)
  (L0)cr = 2.63·D/α
  fom = −(costo relativo)·γ·π²·d²·Nt·D/4
LUEGO: tabla completa → inspección → TACHAR LOS INFACTIBLES → la fom decide entre los que quedan
```
**Fatiga (§10-10):** el mismo esqueleto con **un solo cambio** — la Ec (10-23) se reusa con `α = Sse/nf` y
`β = 8·Fa/(π d²)`. Datos de Zimmerli (10-28): sin granallar Ssa = 35 / Ssm = 55 kpsi; granallado 57.5 / 77.5.
`Ssu = 0.67·Sut`. Sse por Gerber (10-29b), Goodman (10-29a) o Sines (Sse = Ssa).

**Criterios de aceptación del resorte (§10-7, lista explícita del cliente):**
`4 ≤ C ≤ 12` (10-18, y el autor lo llama *"the first item of the design assessment"*) · `3 ≤ Na ≤ 15`
(10-19) · `ξ ≥ 0.15` (10-20) · `ns ≥ 1.2` **a altura sólida** (10-21) · `(L0)cr > L0` (no pandea, 10-13) ·
`fn ≥ 15–20 ×` la frecuencia de excitación (§10-8).

**Rodamientos (§11-5, §11-8, §11-9):**
```
C10 = af · FD · [ xD / (x0 + (θ − x0)(1 − RD)^(1/b)) ]^(1/a)
  a = 3 (bolas) | 10/3 (rodillos) · xD = 60·ℒD·nD/LR · RD = ⁿ√(R_conjunto)
BOLAS CON EMPUJE: iterar Y2 → C10 → rodamiento de catálogo → C0 → Y2 nuevo …
  PARAR cuando SE REPITE EL MISMO RODAMIENTO
CÓNICOS: Fi = 0.47·Fr/K (semilla K ≈ 1.5 radial, 0.75 ángulo pronunciado); X = 0.4 y V = 1 siempre; Y = K
  Etiqueta A = el rodamiento QUE EL EMPUJE EXTERNO APRIETA
  si FiA ≤ (FiB + Fae):  FeA = 0.4·FrA + KA(FiB + Fae) ,  FeB = FrB      (si no, al revés)
  Fe = max(Fe, Fr)                     ← regla de piso
  Trial 2 con los K REALES del catálogo
```

**⭐ de este bloque (los 10 completos en `anexo-shigley-caps10-11.md`):**
1. ⭐ **La figura de mérito decide SOLO ENTRE LOS FACTIBLES.** En el Ej 10-2 el mejor fom global
   (−0.398 en d = 0.071) **pierde**; gana −0.417 en d = 0.080 porque los mejores están descartados por
   restricción. **Un optimizador con penalizaciones blandas da la respuesta equivocada.**
2. ⭐ **"Ninguno cumple" es un resultado NORMAL, y la respuesta correcta es NEGOCIAR.** El Ej 10-5 termina
   sin solución factible y el cliente **jerarquiza las restricciones**: C = 12.14 se tolera, Ls = 1.116 hay
   que preguntarle al ensamble, y si dicen que no → aceptar C = 14, empacar los resortes individualmente y
   reconsiderar el soporte. **El software tiene que modelar la NEGOCIABILIDAD de cada restricción**, no
   solo si se cumple.
3. ⭐ **El factor de seguridad del resorte se evalúa a ALTURA SÓLIDA, no a la carga de operación.**
   `ns = Ssy/τs` con τs en `Fs = (1+ξ)·Fmax`. El resorte se dimensiona **para sobrevivir a que alguien lo
   cierre por completo**.
4. ⭐ **La Tabla 10-6 cambia el FACTOR DE CORRECCIÓN, no solo el porcentaje:** "antes de set removal"
   incluye KW o KB; "después" incluye **Ks**. Copiar el % y usar siempre KB rompe el caso set-removed.
5. ⭐ **El modo de montaje INVIERTE entradas y salidas.** En *over-a-rod* / *in-a-hole*, D lo fija la
   geometría y ns sale como consecuencia; en *free*, ns es entrada y C sale de la cuadrática. *"Had the
   spring been in a hole or over a rod, the helix diameter would be chosen without reference to (ns)d."*
6. ⭐ **El gancho del resorte de extensión tiene DOS radios en planos PERPENDICULARES:** r1 en el plano de
   la espira (flexión, punto A) y r2 a 90° (torsión, punto B) — y en fatiga **su línea de carga arranca en
   τi, no en el origen**: `r = τa/(τm − τi)`.
7. ⭐ **El rodamiento cónico ES UNA BOMBA de aceite**, y el sentido depende del montaje directo o indirecto.
   Eso determina **por dónde perforas el conducto en la carcasa**. Ninguna ecuación de C10 lo revela.
8. ⭐ **El aro FIJO se monta con ajuste deslizante A PROPÓSITO**, para que repte y empareje el desgaste; el
   aro que GIRA va a presión. **El juego es intencional, no un defecto** — un verificador de ajustes
   ingenuo lo marcaría como error.
9. ⭐ **La convergencia de la selección de rodamiento es la IDENTIDAD del rodamiento**, no una tolerancia
   numérica: *"If the same bearing is obtained, stop."* Punto fijo sobre un conjunto **discreto**.
10. ⭐ **(LR, x0, θ, b) de Weibull es una TUPLA POR FABRICANTE.** Timken: 90(10⁶) rev, 0, 4.48, 1.5.
    Fabricante 2: 1(10⁶), 0.02, 4.459, 1.483. **Mezclarlas mete un factor 90 en la vida, en silencio.**

**Y una regla de sistema (§11-5):** la confiabilidad es **del conjunto**, `R = Π Ri`, no rodamiento por
rodamiento; el reparto es libre (√R como arranque) y si un rodamiento sobra se *"round down"* en el otro.
Cuando no se llega a la meta, **se sube un tamaño el más cargado, no los dos**.

**Tablas de catálogo:** 10-1 (Ne, Nt, L0, Ls, p) por **tipo de extremo** · 10-2 (α) por condición de apoyo ·
**10-4 (A, m y COSTO RELATIVO del alambre) por material × RANGO DE DIÁMETRO** — el costo relativo es lo que
hace funcionar la fom · 10-5 (E, G) por material **y por diámetro** (en music wire y HD cambian con d, que
es justo la variable de barrido) · 10-6 (τ permisible) por material × antes/después de set removal ·
10-7 / 10-9 / 10-10 para extensión y torsión · **11-1 (e, X1, Y1, X2, Y2) por Fa/C0** con interpolación
lineal y clamp en 0.014 · 11-2 (serie 02 bolas) y 11-3 (cilíndricos 02/03) por barreno ·
**11-4 vida recomendada por CONSECUENCIA DE LA FALLA**, no por tipo de máquina · 11-5 af por nivel de
impacto (rango, no valor) · **11-6 (LR, x0, θ, b) por FABRICANTE** · Fig 11-15 catálogo Timken con rating
radial **y** de empuje, K y centro efectivo a₂.

**Cap 12 (cojinetes de deslizamiento), en breve:** 5 regímenes; `μN/P ≥ 1.7e-6` para lubricación estable;
4 variables controladas (μ, W/P, N, r-c-β-l) contra 4 dependientes (f, ΔT, Q, h0); los **4 criterios de
Trumpler** (`h0 ≥ 0.0002 + 0.00004·d`, `Tmax ≤ 250 °F`, `Wst/(l·D) ≤ 300 psi`, `nd ≥ 2`); y la regla de
⭐ **diseñar la holgura en la zona sombreada porque el desgaste mueve el punto de operación a la derecha**.
`l/d ≈ 1` es la práctica actual.

### 9.3 Engranes (caps 13, 14, 15)

**El proceso a mano — §14-19 *Design of a Gear Mesh*.** El cliente separa las variables en clases y esa
partición **es** la arquitectura del módulo:

- **A priori** (las fija la función o el criterio, no el cálculo): carga, velocidad, razón mG, vida, Ko;
  el riesgo no cuantificable (SF, SH); el sistema de dientes (ϕ, ψ, addendum, dedendum, radio de raíz);
  NP y NG; la calidad Qv.
- **De diseño, y el cliente las ordena POR COSTO DE RETRABAJO:**
  **① paso P → ② ancho de cara F → ③ material y durezas del piñón → ④ material y durezas del engrane.**
- **A posteriori** (salen del cálculo): esfuerzos, los factores de seguridad, la dureza requerida, el tamaño.

```
escoge P
  └→ examina implicaciones en F, diámetros y material
       ├─ ¿no satisface? ──────────────→ REGRESA A P
       └→ material y dureza del piñón (revisa núcleo y capa)
            ├─ ¿no satisface? ─────────→ REGRESA A P
            └→ material y dureza del engrane
                 └─ ¿no satisface? ────→ REGRESA A P
CRITERIO DE PARO: "iterate until no decisions are changed"
```

> ⭐ **El criterio de paro es un PUNTO FIJO SOBRE LAS DECISIONES, no sobre los esfuerzos.** *"iterate until
> no decisions are changed."* Un optimizador numérico converge cuando el residual baja; el cliente converge
> cuando **deja de cambiar de opinión**. Eso se implementa distinto: hay que guardar el vector de
> decisiones y compararlo iteración contra iteración.

**Detalles del procedimiento:** F de arranque = 4π/P (rango 3p–5p) → despeja el St necesario → escoge
material y dureza que lo den → si F sale fuera del rango disponible, **cambia P** (no F). Luego flexión del
engrane (solo cambia J), después desgaste del piñón y desgaste del engrane. **Son CUATRO factores de
seguridad, no dos.**

> ⭐ **Y el cierre es una regla de ingeniería de consecuencias, no de optimización:** el cliente
> **deliberadamente NO iguala los cuatro factores**. Deja el de flexión alto a propósito, porque un diente
> roto dobla las flechas y traba la caja, mientras que la picadura solo degrada. **Un optimizador que
> minimice material igualando los cuatro FS produce una caja peor.**

Las cuatro ecuaciones madre (cap 14): σ_flexión (14-15), σ_contacto (14-16), σ_all,flexión (14-17),
σ_all,contacto (14-18); y de ahí SF y SH.

**Ecuaciones de curva-ajuste de resistencia verificadas en el texto** (Brinell → psi):
`St = 77.3·HB + 12 800` (templado y revenido, grado 1) · `St = 102·HB + 16 400` (grado 2) ·
`Sc = 322·HB + 29 100` (grado 1) · `Sc = 349·HB + 34 300` (grado 2).
Nitrurados: 4140/4340 `82.3·HB + 12 150` (g1) y `108.6·HB + 15 890` (g2); Nitralloy `86.2·HB + 12 730` (g1)
y `113.8·HB + 16 650` (g2). Cónicos: `sac = 341·HB + 23 620` (g1), `sat = 44·HB + 2100` (g1).

**Reglas de prosa clave:**
- §14-19 declara faltante la función objetivo: *"a figure of merit in gear design is complex… because
  material and processing costs vary. The possibility of using a process depends on the manufacturing
  facility if gears are made in house."* → ⭐ **el cliente NO tiene función de costo y nos la está pidiendo
  como hueco abierto.** Para LATAM esto es la oportunidad: la figura de mérito es local.
- Número mínimo de dientes: **13** (par 1:1, 20°), **16** (mG = 4), **18** (cremallera o generado con hob),
  y se entra **por la razón**, no por el número de dientes (Tabla 13-1 col. 4). En cónicos otra tabla
  (16/16, 15/17, 14/20, 13/30). En sinfín otra más (Tabla 15-10, por ϕn).
- Ancho de cara **3p ≤ F ≤ 5p** — y §13-2/§14-1 aclaran que **no es física, es disponibilidad comercial**.
- Razón por etapa: hasta **10:1** con un par (§18-3); compuesto revertido llega a 100:1.
- Carga invertida (ruedas locas): **70% de la resistencia** (§14-4, §15-3) — es una regla de **tren**, no de
  par de engranes, y ninguna ecuación la contiene.
- CH aplica **solo al engrane, nunca al piñón**; y si fP > 64 μin, CH = 1.

**⭐ de este bloque (los 10 completos en `anexo-shigley-caps13-15.md`):**
1. ⭐ **F (ancho de cara) NO es una variable independiente: aparece en TRES lugares.** Está en Ks (14-29), en
   Cpf→Km (14-32/14-30) **y** en el denominador del esfuerzo. El Ej 14-8 recalcula Ks (1.137→1.147) y Km
   (1.242→1.259) al pasar F de 3.0 a 3.5 in. "Solo dividir entre F" da mal.
2. ⭐ **nb y nc NO son comparables tal cual.** *"the ratio of loads is the ratio of stresses squared"*
   (§14-2). En cap 14 se corrige con `nc,linear = nc^i` (i=2 lineal/helicoidal, i=3 esférico/coronado); en
   cap 15 la comparación directa es **√SH contra SF**. Un traductor de ecuaciones reporta `min(nb,nc)` y
   **nombra mal el modo que amenaza**.
3. ⭐ **El factor de diseño entra por lados OPUESTOS según el tipo de engrane.** Rectos/helicoidales: SF y SH
   **dividen la resistencia**. Cónicos: SF = nd pero **SH = √nd**. Sinfín: **nd MULTIPLICA LA CARGA**
   (15-58), y encima convive con un Ka aparte. Un solo campo "factor de seguridad" está mal en 2 de 3 casos.
4. ⭐ **Cp acero = 2300 √psi en el cap 14 y 2290 √psi en el cap 15.** Mismo material, dos estándares AGMA
   (2001-D04 vs 2003-B97), dos números. Igual el exponente de CH: −0.0112 vs −0.0122. **No es errata: los
   estándares no se hablan. El sistema debe versionar el factor por estándar.**
5. ⭐ **YN y ZN se evalúan en CICLOS DISTINTOS para piñón y engrane**: (YN)P con N, **(YN)G con N/mG**. Y en
   la zona sombreada de las curvas, el valor **es un juicio** (velocidad de línea de paso, limpieza,
   esfuerzo residual, ductilidad, tenacidad), no un cálculo.
6. ⭐ **El chequeo del RIN (KB) va al final y puede tirar todo el diseño.** El Ej 14-8 corre completo con
   *"Assume mB ≥ 1.2… KB = 1"* y hasta el último párrafo verifica tR, con la instrucción *"if it does not,
   review and modify this mesh design"*. Precondición asumida al inicio, verificable solo al final.
7. ⭐ **En rectos JG > JP, pero en cónicos JP > JG: la amenaza de flexión CAMBIA DE MIEMBRO.** El que hereda
   la intuición de rectos endurece el engrane equivocado.
8. ⭐ **El propio texto tiene erratas que un implementador copiaría** (Ej 15-1 imprime "Ko = 100" por 1.00;
   Ej 14-7 usa 29 200 donde la Fig 14-5 dice 29 100). **El cliente no es un oráculo: hay que validar sus
   números contra sus propias figuras.**

**Advertencias que el cliente hace sobre SUS PROPIOS métodos** (hay que propagarlas a la UI, no esconderlas):
- §14-1 (Lewis): *"this is a rough estimate, and **this approach must not be used for important
  applications**."* y *"these results should be accepted only as **preliminary estimates**."*
  → ⭐ Nuestro `gear-mechanics.ts` **ya implementa Lewis** y hoy lo presenta como si fuera un resultado.
  Hay que etiquetarlo como estimación preliminar, tal como el autor exige.
- §14-1: *"**Dynamic factor Kv has been redefined as the reciprocal of that used in previous AGMA
  standards. It is now greater than 1.0.** … Care must be taken in referring to work done prior to this
  change."* → ⭐ **El mismo símbolo significa cosas inversas según la edición del estándar.** Versionar.
- §14-5: *"the form factor Y in Equation (14-20) **is not the Lewis factor at all**."* → dos "Y" distintas.
- §14-5: precauciones sobre Eq 14-25 (si alguno de los dos primeros términos del corchete excede al tercero,
  **se reemplaza por el tercero**; y el radio exterior efectivo puede ser menor que r+a por desbarbado).
- §14-5: los helicoidales de baja relación de contacto (mF ≤ 1) **no están cubiertos**; la aproximación de mN
  exige **mF > 2.0**.
- §14-10: *"**There is no rationale to use Equation (14-29) for contact stress**"* — y sin embargo los
  ejemplos 14-4/14-5/14-8 **sí** meten Ks en σc. ⭐ Contradicción real del texto: el sistema debe hacerla
  explícita y dejar la política al usuario, no elegirla en silencio.

**Los factores AGMA y qué los indexa** (todos son catálogo duro, la mayoría en tablas o figuras):
Ko (fuente de potencia × máquina conducida) · Kv y (Vt)max (Qv + velocidad de línea de paso; **hay que
VALIDAR** que V < (Vt)max) · Ks (por-engrane, vía Y(z), F y P) · KH/Km (Cmc, Cpf con F y d, Cpm, Cma por
tipo de unidad, Ce) · ZR/Cf · ZW/CH (razón de durezas, solo al engrane) · YN/ZN (ciclos, distintos por
miembro) · YZ/KR (confiabilidad) · Yθ/KT (temperatura) · KB (razón de espesor de rin mB) · ZE/Cp (par de
materiales, **versionado por estándar**) · I y J (geometría, de figuras) · St y Sc (dureza Brinell × grado
1/2, con ecuaciones de curva-ajuste).

### 9.4 Embragues, frenos, volantes (cap 16) y elementos flexibles (cap 17)

**La costura arquitectónica nos la dio el cliente, literal (intro cap 16):**
> *"The torque transmitted… is a problem in statics, which will have to be studied **separately for each
> geometric configuration**. However, temperature rise… **can be studied without regard to the type of brake
> or clutch**, because the geometry of interest is that of the heat-dissipating surfaces."*

→ **Requisito:** un módulo de estática **por geometría** (zapata interna, zapata externa, banda, disco
axial, caliper, cono) + **UN SOLO** módulo térmico compartido.

**El algoritmo maestro (§16-1), tres pasos:**
```
1. Estima, MODELA o mide la distribución de presión p(u)   ← esto es un JUICIO, no una ecuación
2. Relaciona la presión máxima con la presión en cualquier punto
3. Equilibrio estático → fuerza de frenado, par y reacciones en los apoyos
```

**El procedimiento de banda plana (§17-2, 9 pasos)** y **el de banda en V (§17-3, 4 pasos)** están
transcritos completos en `anexo-shigley-caps16-17.md`. El de cadena (§17-5) y el de cable (§17-6) también.

**⭐ de este bloque (los 10 completos en `anexo-shigley-caps16-17.md`):**
1. ⭐ **El modelo de presión es un JUICIO, no un default.** El cliente resuelve el mismo problema dos veces
   (Ej 16-1) y demuestra que suponer presión uniforme **subestima el pico 24%**, burlándose del atajo:
   *"because the pad was small, or because the arithmetic would be easier?"*
2. ⭐ **"El nuevo se hará viejo".** Presión uniforme siempre predice MÁS par ⇒ no conservadora. En el rango
   típico la diferencia es ~2%. Pero el argumento decisivo del cliente **no es numérico**: *"the certainty
   that new clutches get old"*. Es razonamiento de **ciclo de vida**. Y la pregunta correcta al usuario no
   es "¿desgaste o presión uniforme?" sino **"¿discos rígidos o con resortes? ¿nuevo o rodado?"**
3. ⭐ **F no se multiplica por el número de superficies; T SÍ.** (16-23) vale para cualquier número de pares;
   (16-25) es **por un solo par**. La trampa más fácil del capítulo.
4. ⭐ **Dónde ocurre la presión máxima cambia con la GEOMETRÍA:** zapata interna corta → θ2; larga →
   **θa = 90°**; banda → **en la punta (toe)**; pad anular → **en ri**; pad circular → pav × (pmax/pav) de la
   Tabla 16-1, **hasta 1.875×**. Comparar el valor equivocado contra p_max del material rompe el diseño en
   silencio.
5. ⭐ **El auto-energizado se DOSIFICA con la dimensión `a`** y hay que evitar activamente el auto-bloqueo
   (MN > Mf). Precio cuantificado: **30% de caída en f → 50% de cambio en la fuerza de pedal**. Y el signo
   se **invierte** entre zapata interna y externa según el sentido de giro. Además: la **condición**
   cualitativa de auto-bloqueo no depende de conocer p(u), pero el **valor** de f_cr sí.
6. ⭐ **La térmica es un motor de SENSIBILIDAD y es un PUNTO FIJO.** El cliente dice de su propio modelo:
   *"it would be most unlikely that such an analysis would even approximate experimental results… most
   useful in pinpointing those design parameters that have the greatest effect."* Y hr/hc dependen de
   (T − T∞), que es la incógnita: el Ej 16-5 **itera** de 209 °F a 220 °F y **cierra contra la Tmax continua
   de la Tabla 16-3**.
7. ⭐ **`f′ < f` es lo que separa un diseño que funciona de uno que patina.** Los pasos 1–7 dan tensiones que
   "aguantan"; el paso 8 pregunta otra cosa: **¿la fricción REQUERIDA por esas tensiones existe?** Y la
   fórmula de f′ **cambia** entre banda elastomérica (con Fc) y banda metálica (sin Fc).
8. ⭐ **Los catálogos son dominios DISCRETOS y cada elemento redondea distinto:** ancho de banda plana → al
   siguiente disponible; Nb de bandas V → entero **hacia arriba** (con la advertencia de que *"an undersized
   belt set that is augmented by one belt can be substantially oversized"*); longitud de cadena → al **PAR**
   más cercano hacia arriba (evita eslabón especial); dientes del piñón → **impar preferible**. Un
   optimizador continuo viola las cuatro.
9. ⭐ **Los guardarraíles de validez y los estados "no sé" son REQUISITOS, no cortesías.** Vida de banda V:
   el Ej 17-4 calcula 11×10⁹ pasadas y **reporta ">10⁹"**, *"without placing confidence in numerical values
   beyond the validity interval"*. Lubricación de cadena tipo **C′** no es un resultado: es *"submit design
   to manufacturer for evaluation"*. Y el cable *"implies that a wire rope has a fatigue limit; **but this
   is not true at all**"*. El software debe **saturar, marcar, escalar al fabricante y advertir sin número**.
10. ⭐ **Más grueso no es más seguro, y el desempate final es COSTO.** En cable nf = (Ff − Fb)/Ft con Ff ∝ d
    pero **Fb ∝ d³**, así que *"for each m the factor of safety exhibits a maximum"* — subir d
    monótonamente **empeora** nf pasado el óptimo. Y el cierre no lo da el FS: *"The costs include not only
    the wires, but the grooved winch drums."* Igual en banda plana: hay que ver *"which of the satisfactory
    alternatives is best"*. **Satisfactorio ≠ mejor: el cliente quiere un CONJUNTO de alternativas
    satisfactorias ordenado por costo, no una respuesta.**

**Mención transversal que aplica a TODO el producto:** el entregable del cliente incluye **mantenimiento**.
Intro cap 17 pide calendario de inspección y reemplazo *"at the first sign of deterioration"*; §17-2 exige
que Fi sea *"(1) provided, (2) sustained, (3) in the proper amount, and (4) maintained by routine
inspection"*; §17-6 dice *"it is extremely important that the designer specify and insist"* en la
inspección periódica. **Un plano sin plan de mantenimiento es un entregable incompleto.**

**Tablas de catálogo (cap 16):** 16-1 por R/e → δ y pmax/pav · 16-2 por *duty cycle × tipo de freno* →
in²/(Btu/s) · **16-3 por material → f, pmax, T instantánea, T continua, Vmax** (14 filas) · 16-4 por
construcción del forro · 16-5 por *par de materiales* → **f wet vs f dry** · Figs 16-24a/b por (T−T∞) y por
velocidad de ventilación.
**(cap 17):** 17-9 por sección A–E → d_min de sheave y rango de HP · 17-12 Htab por sección × diámetro de
paso × velocidad · 17-13 K1 por (D−d)/C con **dos columnas VV / V-flat** · 17-14 K2 por sección × longitud ·
**17-15 Ks por máquina conducida × fuente de potencia → RANGOS (1.0–1.8), no valores** (y sirve también para
banda plana y redonda) · 17-19/17-20 cadenas ANSI por número y rpm — **y la zona de la tabla determina la
clase de lubricación A/B/C/C′** · 17-22 K1 por N1 con **dos columnas pre/post-extreme** · 17-23 K2 por
torones (1→1.0, 2→1.7, 3→2.5, 4→3.3, 6→4.6, 8→6.0) · 17-25 FS de cable por aplicación (3.2–11.9, **con la
nota de que no descarta falla por fatiga**).

---

## 10. LOS SIETE PATRONES TRANSVERSALES — lo que se repite en TODOS los capítulos

Estos son los requisitos de arquitectura de verdad. No salen de un capítulo: salen de ver los diez juntos.

### P1 — Todo dominio de diseño es DISCRETO, y cada elemento redondea con su propia regla
El cliente **nunca** optimiza continuo. Barre catálogos.

| Elemento | Dominio discreto | Regla de redondeo | § |
|---|---|---|---|
| Eje | tamaños preferentes (Tabla A-17) | al siguiente arriba, y **recalcular n** | §1-11 |
| Resorte | diámetros de alambre de catálogo | **barrido**, tabla, tachar infactibles | §10-7 |
| Rodamiento | catálogo del fabricante | **identidad** del rodamiento | §11-8 |
| Perno | longitudes de existencias | al siguiente, y **re-dispara kb** | §8-4, Tabla 8-7 |
| Engrane | dientes **enteros** | *"increase the pinion size to the next integer and try again"* | §13-13 |
| Banda plana | anchos disponibles | al siguiente, y **re-verificar f′** | §17-2 |
| Banda V | número de bandas Nb | entero **arriba** (ojo con el sobredimensionado) | §17-3 |
| Cadena | longitud L/p | al **PAR** más cercano arriba (evita eslabón especial) | §17-5 |
| Cadena | dientes del piñón | **impar preferible** | §17-5 |
| Resorte de torsión | Nb con parte fraccionaria fija (…5.3, 6.3, 7.3) | **no se redondea libre** | §10-12 |

> ⭐⭐ **Y por eso el criterio de convergencia NO es numérico.** §14-19: *"iterate until no decisions are
> changed."* §11-8: *"If the same bearing is obtained, stop."* **Punto fijo sobre DECISIONES y sobre
> IDENTIDADES de catálogo, no sobre un residual.** Esto cambia por completo cómo se escribe el bucle: hay
> que serializar el vector de decisiones y compararlo entre iteraciones.

### P2 — "Ninguna opción cumple" es un resultado NORMAL, y la salida correcta es NEGOCIAR
El Ej 10-5 termina **sin solución factible** y el cliente jerarquiza qué restricción aflojar y a quién
preguntarle. Requisito: cada restricción lleva un atributo de **negociabilidad** y un **dueño** (¿es del
ensamble? ¿del cliente? ¿es física?). El software propone el orden de negociación, no dice "infactible".

### P3 — Los factores de seguridad de distintos modos NO son comparables sin transformarlos
- §14-2: *"the ratio of loads is the ratio of stresses squared."*
- Cap 14: `nc,linear = nc^i` (i = 2 lineal/helicoidal, 3 esférico/coronado).
- Cap 15: la comparación válida es **√SH contra SF**.
- Cap 16 y 17: el FS de cable tiene **dos definiciones** ((Fu−Fb)/Ft o Fu/Ft) y "5" significa dos cosas.

> **Requisito:** cada factor de seguridad se guarda con **su base declarada** (¿contra esfuerzo o contra
> carga? ¿qué exponente?) y el sistema **se niega a comparar** dos factores de bases distintas sin
> convertirlos. Y `min(n_i)` **solo se calcula sobre factores homogéneos** — si no, nombra mal la amenaza.

### P4 — Los factores hay que VERSIONARLOS por estándar y por fabricante
- `Cp` acero = **2300 √psi** (AGMA 2001-D04, cap 14) vs **2290 √psi** (AGMA 2003-B97, cap 15).
- Exponente de CH: **−0.0112** (rectos) vs **−0.0122** (cónicos).
- Ventana del diámetro del sinfín: `C^0.875/1.7` (§13-11) vs `C^0.875/1.6` (§15-6).
- `Kv` **fue redefinido como el recíproco** del de estándares AGMA anteriores: *"Care must be taken in
  referring to work done prior to this change."*
- La tupla Weibull `(LR, x0, θ, b)` es **por fabricante**; mezclarlas mete **un factor 90** en la vida.

> **Requisito:** no existe "el" valor de un factor. Existe `factor(nombre, estándar, edición, fabricante)`.
> Un `const CP_ACERO = 2300` global es un bug esperando su turno.

### P5 — Guardarraíles de validez y estados "no sé" son REQUISITOS de primera clase
| Situación | Qué exige el cliente | § |
|---|---|---|
| NP > 10⁹ pasadas de banda V | **reportar ">10⁹"**, no el número | §17-3 |
| Lubricación de cadena tipo C′ | *"submit design to manufacturer for evaluation"* | §17-5 |
| Cable de acero | *"implies that a wire rope has a fatigue limit; **but this is not true at all**"* | §17-6 |
| Ambiente corrosivo | **no existe vida infinita** | §6-9 |
| T > 40% de T_fusión absoluta | el método esfuerzo-vida **ya no aplica** | §6-9 |
| V ≥ (Vt)max | el Kv calculado **no aplica**; sube Qv | §14-7 |
| mF ≤ 1 (helicoidal de baja relación) | *"will not be considered here"* | §14-5 |
| Resortes Belleville | *"beyond the scope of this book"* | §10-13 |
| Condiciones de operación malas | *"life will be much shorter"* — **advertencia SIN número** | §17-5 |

> **Requisito:** el motor de cálculo devuelve un valor **o** un estado (`saturado`, `fuera-de-validez`,
> `escalar-al-fabricante`, `sin-número-pero-peor`). Nunca un número silencioso fuera de su rango.

### P6 — El desempate final es COSTO, y el cliente NO TIENE función de costo: nos la está pidiendo
§14-19 lo declara hueco abierto: *"a figure of merit in gear design is complex… because material and
processing costs vary. **The possibility of using a process depends on the manufacturing facility if gears
are made in house.**"* §17-6: *"The costs include not only the wires, but the grooved winch drums."*
§17-2: hay que ver *"which of the satisfactory alternatives is best"*.

> ⭐⭐ **Aquí está la oportunidad de producto para LATAM.** La función de costo del cliente depende del
> taller, y por eso él no la puede escribir en un libro. Nosotros SÍ podemos: el *perfil de taller* que
> §1-3 ya exige como "implied specification" (qué máquinas hay, qué material se consigue, a qué precio)
> **es exactamente la figura de mérito que falta**. Ese es el diferenciador contra un Fusion de $12k que
> asume costos de otro país.
> **Y el entregable no es "una respuesta": es un CONJUNTO de alternativas satisfactorias ordenado por costo.**

### P7 — El entregable incluye MANTENIMIENTO, no solo geometría
- Intro cap 17: calendario de inspección y reemplazo *"at the first sign of deterioration"*.
- §17-2: la tensión inicial debe ser *"(1) provided, (2) sustained, (3) in the proper amount, and
  (4) maintained by routine inspection"* — **sin Fi no hay par transmitido, punto**.
- §17-6: *"it is extremely important that the designer specify and insist"* en la inspección periódica.
- §11-10: rutas y volumen de lubricante suficientes para mantener la temperatura de operación.
- §1-18 (especificación del caso de estudio): revisión de lubricación cada 2000 h, cambio cada 8000 h,
  acceso a drenar y rellenar **sin desarmar ni abrir juntas con empaque**.

> **Requisito:** todo diseño emite un **plan de mantenimiento** junto con el plano. Un plano sin él es un
> entregable incompleto según este cliente.

---

## 11. BRECHA CONTRA LA FORJA

> Base: inventario técnico del repo `/home/ian/Orkesta/la-forja` (auditoría hecha para este pliego).
> Leyenda: ✅ existe y sirve · 🟡 existe parcial / hay que extender · ❌ no existe.

### 11.1 Lo que YA TENEMOS y el cliente reconocería como suyo

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

### 11.2 Lo que se puede construir CON LO QUE HAY (semanas, no meses)

| Qué | Con qué se apalanca | § |
|---|---|---|
| 🟡 **Módulo de fatiga completo** (Marin ka..ke, q/Kf de Neuber, Basquin, Goodman/Morrow/Gerber/Soderberg/ASME/SWT/Walker, Miner, rainflow) | ya hay `basquinSN` y `goodmanFatigueSafety` en `formulas.ts` (con Se'=0.5Sut hardcodeado y f=0.9 fijo — hay que **corregirlos**, no extenderlos); `MATERIAL_DATABASE` da Sut/Sy | §6 completo |
| 🟡 **Fatiga sobre el FEA que ya tenemos** | `prepareFeaSession` + `solveLoadOnSession` YA resuelve N cargas sobre una K ensamblada una vez → correr caso `max` y caso `min`, sacar σa y σm nodales, aplicar Marin/Goodman por nodo y pintar un **mapa de nf** en vez de un mapa de FS estático | §6-16, §19 |
| 🟡 **Árbol de selección de criterio de falla estática (Fig 5-21)** | tenemos von Mises y principales; falta Coulomb-Mohr, Mohr modificado y el ÁRBOL | §5-11 |
| 🟡 **Euler + J. B. Johnson con transición** | `eulerBucklingLoad` ya existe con 4 condiciones de extremo; falta la parábola de Johnson y el corte en (l/k)₁ = (2π²CE/Sy)^½ | §4-12, §4-13 |
| 🟡 **Diagramas V(x), M(x), T(x) + deflexión de eje escalonado** | `beamStiffnessEulerBernoulli`, `beamStiffnessTimoshenko` y el solver CG ya están; falta el ensamblador 1-D de vigas por tramos y las funciones de singularidad | §3-2, §4-6, §7-5 |
| 🟡 **AGMA de engranes rectos** | `gear-mechanics.ts` ya trae Lewis Y(z) y `gear-pair.ts` la relación de contacto; falta la maquinaria de factores AGMA | §14 |
| 🟡 **Cuñas** | tenemos catálogo DIN y roscas; la cuña es una tabla indexada por diámetro + un cheque de aplastamiento | §7-7, §18-10 |

### 11.3 Lo que FALTA POR COMPLETO

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

### 11.4 Lo que el cliente NOS PIDE que NO hagamos (y hoy podríamos estar haciendo mal)

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

## 12. PLAN DE CONSTRUCCIÓN — qué módulo primero y por qué

### 12.1 La decisión

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

### 12.2 Orden propuesto

| Orden | Módulo | Depende de | Gate (verificación contra el libro) |
|---|---|---|---|
| **0** | `nucleo.ts` — **la capa transversal de los patrones P1–P7**: tipo `Catalogo<T>` con su regla de redondeo; tipo `Restriccion` con negociabilidad y dueño; tipo `FactorSeguridad` con **base declarada** (esfuerzo vs carga, exponente) que **se niega a compararse** con otra base; `Factor` versionado por `(estándar, edición, fabricante)`; y el tipo `Resultado<T> = Valor \| Saturado \| FueraDeValidez \| EscalarAFabricante`. Más el bucle de **punto fijo sobre el vector de DECISIONES** | — | los invariantes: `min()` rechaza bases mixtas; Cp devuelve 2300 con 2001-D04 y 2290 con 2003-B97; NP se satura a 10⁹ |
| **1** | `fatiga.ts` — Se' (6-10), Marin ka..ke (6-17..6-28), f (6-11), a/b (6-13,6-14), q/Kf Neuber (6-33..6-36), los 7 criterios (6-40..6-57), σar equivalente (6-59..6-62), Miner + rainflow (6-68,6-69) | 0, `MATERIAL_DATABASE` | Ej 6-2..6-18 + los 4 n del Ej 7-1 |
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

> **Por qué el módulo 0 va antes que todo:** los cuatro barridos de capítulos independientes (8-9, 10-11,
> 13-15, 16-17) llegaron **por separado** a los mismos siete patrones. Eso no es coincidencia: es la forma
> del proceso del cliente. Si `fatiga.ts` se escribe sin la capa transversal, va a nacer con un
> `const CP = 2300` global, un `Math.min(nb, nc)` que nombra mal la amenaza, y un `while (|Δ| < tol)` que
> nunca converge sobre un catálogo discreto. Son **tres bugs estructurales** que después hay que sacar de
> siete módulos a la vez. La capa 0 es chica (un archivo de tipos y cuatro helpers) y evita eso.

### 12.3 El diferenciador de producto que salió de este ejercicio

El cliente **declara explícitamente que le falta la función de costo** (§14-19) y que **el taller disponible
es una especificación implícita del problema** (§1-3). Nadie puede escribir esa función en un libro porque
depende del taller. **Nosotros sí, y para México/LATAM eso es exactamente lo que un Fusion de $12k USD no
tiene**: sus defaults asumen costos, materiales y procesos de otro país.

**Requisito de producto derivado:** el proyecto tiene un **perfil de taller** (máquinas, materiales que se
consiguen, precios, procesos disponibles) y ese perfil **es** la figura de mérito. Toda pantalla de
selección devuelve un **conjunto de alternativas satisfactorias ordenado por costo local**, no una respuesta
única. Es lo que el cliente hace a mano y lo que ningún libro puede traer de fábrica.

### 12.4 Cómo se engancha a lo que ya existe

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


---

## 13. LOS DIEZ ⭐ DEFINITIVOS — escogidos entre los ~50 de todo el libro

Criterio de selección: que un implementador competente que traduce ecuaciones **lo haga mal sin darse
cuenta**, y que el error **no se vea** en el resultado.

1. ⭐ **§5-2 — En carga estática con material dúctil, Kt = 1.** El material fluye en la muesca y endurece.
   Tres excepciones que hay que codificar (fractura frágil posible · hierro fundido, que ya trae la muesca
   dentro del ensayo · carga no estática). Es la regla que más se implementa al revés.
2. ⭐ **§6-13 vs §6-14 — El criterio de fatiga cambia según la PREGUNTA.** Goodman para el factor de
   seguridad a vida infinita; **Walker > Morrow > SWT > Goodman** para estimar vida finita, donde Goodman
   es *"very inaccurate"*. Un criterio para todo produce vidas absurdamente conservadoras.
3. ⭐ **Doble conteo en fatiga (§6-9, §6-16).** O corriges Sut por temperatura **o** aplicas kd, nunca las
   dos. Y con torsión combinada, kc = 1 porque el von Mises ya lo contó. Dos trampas que dan un número
   plausible y falso.
4. ⭐ **§6-17 — El ciclo escondido.** *"The most damaging cycle is number 1. It could have been lost."* El
   conteo ingenuo de picos pierde **justo** el ciclo que rompe la pieza. Y el `c` de Miner va de 0.7 a 2.2:
   reportar D = 0.97 como "pasa" es falso rigor.
5. ⭐ **§14-19 / §11-8 — El criterio de convergencia NO es numérico.** *"iterate until no decisions are
   changed"* y *"If the same bearing is obtained, stop."* Punto fijo sobre **decisiones** y sobre
   **identidades de catálogo**, no sobre un residual. Un `while (|Δ| < tol)` nunca converge sobre un
   dominio discreto.
6. ⭐ **§10-7 / §10-10 — La figura de mérito decide SOLO ENTRE LOS FACTIBLES, y "ninguno cumple" es normal.**
   En el Ej 10-2 el mejor fom global **pierde** contra uno peor que sí es factible. Y el Ej 10-5 termina sin
   solución y el cliente **negocia por jerarquía de restricciones**. Un optimizador con penalizaciones
   blandas contesta mal las dos veces.
7. ⭐ **§14-2 / §14-18 / §15-3 — Los factores de seguridad de distintos modos no son comparables.** *"the
   ratio of loads is the ratio of stresses squared."* `nc,linear = nc^i` en rectos, **√SH vs SF** en
   cónicos. Un `min(nb, nc)` ingenuo **nombra mal el modo que amenaza** y endurece la pieza equivocada.
8. ⭐ **§16-1 / §16-5 — El modelo de presión es un JUICIO, y el argumento decisivo no es numérico.** Suponer
   presión uniforme subestima el pico **24%**; y el cliente elige desgaste uniforme por *"the certainty that
   new clutches get old"* — razonamiento de ciclo de vida, no de física del instante.
9. ⭐ **§9-2 / §9-5 — El 0.707h y el "todo es cortante" son conservadurismo CALIBRADO, no simplificación.**
   El análisis riguroso da 1.207·F/(hl) y el modelo usa 1.414 — **17% inflado a propósito**, validado por
   prueba. Y en Iu el libro **reconoce** que (d+h) sería más exacto **y lo rechaza**. Un implementador que
   "corrige" el modelo hacia el análisis exacto **rompe la calibración experimental**.
10. ⭐ **P4 — No existe "el" valor de un factor: hay que versionarlo.** Cp acero = 2300 √psi en el cap 14 y
    **2290 en el cap 15** (dos estándares AGMA que no se hablan); Kv **fue redefinido como el recíproco** del
    de ediciones previas; y la tupla Weibull (LR, x0, θ, b) es **por fabricante** — mezclarlas mete **un
    factor 90 en la vida, en silencio**.

**Los que se quedaron a un pelo:** el hueco del extractor y el hombro "de relleno" flojo (§7-3, §18-4) · la
regla d/10 entre concentradores (§7-7) · el 65% de las fallas de perno *"donde el diseñador puso atención"*
(§8-6) · el rodamiento cónico **como bomba de aceite** que decide dónde perforas el conducto (§11-10) · el
aro fijo montado deslizante **a propósito** para emparejar el desgaste (§11-12) · que una transición brusca
de malla **fabrica** un concentrador que la pieza no tiene (§19-4) · y que **soldar una barra estirada en
frío la devuelve a HR** cerca del cordón (§9-5).
