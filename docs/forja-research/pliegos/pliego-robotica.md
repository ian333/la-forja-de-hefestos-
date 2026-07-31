# PLIEGO DE REQUISITOS — ROBÓTICA
## Ejercicio: **los autores son el CLIENTE**. Siempre diseñaron robots a mano, son buenísimos, y nos contrataron para automatizar SU proceso.
### Analista: La Forja · 2026-07-31 · Los libros leídos como entrevista de requisitos, no como textos de estudio

**Fuentes (las 3 entrevistas):**

| # | Fuente | Rol en la entrevista |
|---|---|---|
| **[H]** | Herath, D. & St-Onge, D. (eds.), *Foundations of Robotics: A Multidisciplinary Approach with Python and ROS*, Springer 2022 (549 pp., open access, financiado por Kinova). Caps. relevantes: **3** (Design Thinking, Peng), **7** (Sensors/Actuators/Algorithms, Wang & Herath), **8** (Control/Navigation/Path Planning, Wang & Herath), **10** (Kinematics/Dynamics/Architecture of Robot Arms, **Belzile & St-Onge** — el capítulo madre), **12** (Embedded Design Process, CAD/CAM & Prototyping), **14** (Safety First, Belzile & St-Onge), **17** (Hexapod Build Labs, Hinwood & Herath). | El **cliente principal**: el proceso completo de diseñar un brazo, sus arquitecturas, singularidades y el marco de seguridad. |
| **[F]** | Featherstone, R. & Orin, D. E., *Dynamics*, cap. 2 del **Springer Handbook of Robotics** (31 pp.). | El **algoritmo canónico**. Es la especificación de implementación de la dinámica. Nada de lo que dice es opinable. |
| **[S]** | van der Linde, R. Q. & Schwab, A. L., *Lecture Notes Multibody Dynamics B* (TU Delft, 30 pp.). Caps. 1 (Newton-Euler con restricciones), 2 (Lagrange), 3 (TMT). | El **segundo par de ojos**: la misma física por tres caminos distintos, con casos de verificación cruzada (péndulo doble, grúa de contenedores) y la advertencia sobre *drift* numérico. |

> **Regla de redacción de este pliego:** ningún requisito existe porque suene bien. Cada uno cita la § del libro que lo obliga.
> Si no hay §, no entra. Donde el texto extraído no alcanzó, se dice explícitamente **[no verificado en el texto extraído]**.
> Español mexicano (tú/tienes). Fórmulas en ASCII. Las citas van en inglés, entre comillas, porque cambiar la palabra cambia el requisito.

---

## 0. QUIÉN ES ESTE CLIENTE Y QUÉ NOS ESTÁ PIDIENDO

Los tres clientes coinciden en una cosa que ninguno de nuestros módulos actuales hace: **la dinámica no es un adorno de simulación, es la herramienta de DISEÑO MECÁNICO**. Featherstone lo dice en la primera línea del capítulo, y la palabra "design" aparece antes que "control" y antes que "simulation":

> **[F] §2.1:** *"Robot dynamics provides the relationships between actuation and contact forces, and the acceleration and motion trajectories that result. The dynamic equations of motion provide the basis for a number of computational algorithms that are useful in **mechanical design**, control, and simulation."*

Y para no dejar duda de para qué sirve cada uno de los cuatro algoritmos:

> **[F] §2.1:** *"Inverse dynamics is used in feedforward control. Forward dynamics is required for simulation. The joint-space inertia (mass) matrix is used in analysis, in feedback control to linearize the dynamics, and is an integral part of many forward dynamics formulations. The operational-space inertia matrix is used in control at the task or end-effector level."*

Herath, del lado del diseño de producto, pone el mandato complementario y es igual de tajante — **el proceso de diseño NO es una secuencia**:

> **[H] §12.3:** *"Importantly, the design process is **not a linear process** because at any step during the design process a previous step can be revisited to gather more information or to re-consider the design, etc."*

> **[H] §3.2.2:** *"It is of value to point out that **none of the design thinking models represents a linear process**. 'Cyclical icons' are always added to design thinking models, meaning that you could shift back and forth between these states, generating the new, analysing it, shifting and often, starting the whole process again."*

Y Schwab pone la advertencia que separa un simulador de juguete de uno confiable:

> **[S] §1.5:** *"The mastering of these techniques is crucial since they **can make or break our results**, the motion of the multibody system."*

**Traducción a requisito de producto (los 3 mandatos maestros):**

1. **La dinámica inversa es una herramienta de DIMENSIONADO, no de animación.** Su salida (τ por articulación en función del tiempo) es el insumo que hoy le falta a nuestro dimensionado de cicloidales.
2. **El grafo del diseño tiene retornos.** Cualquier UI que fuerce "wizard de 5 pasos" contradice a los dos clientes de diseño. Se necesita un grafo con estado, no un asistente.
3. **El integrador numérico es parte del entregable, no un detalle.** Un resultado sin su gate de conservación de energía / deriva de restricción no es un resultado.

---

## 1. LOS OCHO AXIOMAS DEL CLIENTE

| # | Axioma | § que lo obliga |
|---|---|---|
| **A1** | **La dinámica es para diseño mecánico ANTES que para control.** Los cuatro algoritmos (ID, FD, JSIM, OSIM) tienen usos distintos y NO son intercambiables. | [F] §2.1 |
| **A2** | **La cinemática es un problema GEOMÉTRICO; la dinámica introduce fuerzas.** Son dos motores distintos y dos momentos distintos del flujo. *"Kinematics are used to describe the motion of a robot **without considering** the dynamics, namely the forces and the torques causing the motion. Therefore, kinematics problems are **geometric** problems."* | [H] §10.4.1 |
| **A3** | **La cinemática directa tiene UNA solución; la inversa tiene VARIAS o NINGUNA.** *"Contrary to the DKP, which give only one EE pose from a set of joint coordinates, there may be **more than one solution** to the IKP... However, an analytical (symbolic and exact) solution to the inverse kinematics is **not necessarily always obtainable**, depending on the architecture."* | [H] §10.4.3 |
| **A4** | **Las singularidades son un HECHO GEOMÉTRICO del diseño, no un bug del solver.** Existen antes de que exista el software y hay que *diseñarlas fuera* del espacio de trabajo útil, no rodearlas en tiempo de ejecución. | [H] §10.4.6 |
| **A5** | **La estructura del árbol cinemático determina el costo computacional Y la estabilidad numérica.** No es un detalle de implementación: la ramificación cambia la esparcidad de H y el mal condicionamiento crece con el número de cuerpos. | [F] §2.5.3, §2.7.5 |
| **A6** | **Un lazo cerrado NO es "un árbol con una restricción extra".** Su movilidad puede VARIAR con la configuración y algunas de sus fuerzas pueden ser INDETERMINADAS. | [F] §2.6 |
| **A7** | **El análisis inicial de riesgo se hace SIN considerar ninguna mitigación, a propósito.** *"No risk mitigation measures should be considered while conducting the initial risk analysis... You can see this as a worst case scenario."* | [H] §14 (ISO 12100) |
| **A8** | **El prototipo físico encuentra lo que el CAD y el FEA no ven.** En el caso de estudio del hexápodo, el único defecto real lo halló el robot caminando. | [H] §12.13 |

---

## 2. EL PROCESO A MANO DEL DISEÑADOR DE ROBOTS

### 2.1 El lazo maestro (síntesis de [H] cap. 3 + cap. 12 + cap. 17)

Los tres capítulos describen el mismo lazo con distintos nombres. Reconstruido y ordenado por **qué decisión cierra a cuál**:

```
[0] ESPECIFICACIÓN DE TAREA  ──── "Briefing and task clarification" [H §12.3]
     ↓  cliente/usuario, mercado, ergonomía, normas, cantidades, COSTO objetivo,
     ↓  y AQUÍ ya se eligen materiales y procesos de manufactura
     ↓
[1] ESPACIO DE TRABAJO       ──── alcance, poses requeridas, obstáculos, cluttering
     ↓
[2] TOPOLOGÍA / DOF          ──── serial vs paralelo; ¿6 DOF? ¿redundante? ¿SCARA/SMG?
     ↓                             ¿muñeca partida (wrist-partitioned) SÍ o NO?
     ↓
[3] DIMENSIONADO DE ESLABONES ─── a_i, d_i, α_i (parámetros DH) + qlim por articulación
     ↓
[4] ═══ AQUÍ ESTÁ EL HUECO ═══ trayectoria → DINÁMICA INVERSA → τ_i(t) por articulación
     ↓
[5] ACTUADORES Y REDUCTORES  ──── par pico, par RMS, velocidad, relación de reducción
     ↓
[6] CONTROL                  ──── PID / feedforward / límites
     ↓
[7] SEGURIDAD                ──── evaluación de riesgo ISO 12100 (su propio lazo interno)
     ↓
[8] PROTOTIPO FÍSICO         ──── lo único que valida de verdad
          │
          └──────── EL LAZO VUELVE A CUALQUIER PASO ANTERIOR ────────┘
```

### 2.2 ¿Qué se decide PRIMERO y qué lo CIERRA? — las tres respuestas duras

**(a) La TOPOLOGÍA cierra la cinemática inversa.** No al revés. El cliente lo dice sin rodeos: si eliges muñeca partida (los ejes de las últimas 3 articulaciones se intersectan, `a4 = a5 = a6 = 0`), tienes solución cerrada; si no la eliges, te condenas a numérico.

> **[H] §10.4.3:** *"The architecture of decoupled serial manipulator (wrist-partitioned) makes it possible to **separate the orientation problem from the position problem**. Therefore, we obtain explicit equations, avoiding the need for a numerical method to solve the IKP."*
> Y para los demás: *"In the case of a serial manipulator without a decoupled wrist, there is **no simple recipe** to solve the IKP."*

⭐ **Requisito de producto:** la elección de arquitectura debe ser una decisión EXPLÍCITA y TEMPRANA en la UI, con la consecuencia visible ("si marcas muñeca partida ganas IK cerrada de 4 soluciones; si no, te toca Newton-Gauss con múltiples semillas"). Un software que "resuelva IK" sin exponer esta bifurcación esconde la decisión de diseño más importante del brazo.

**(b) EL CAD ENTRA TARDE, NO AL INICIO.** Esta es la regla de secuencia más valiosa del cap. 12 y es exactamente lo contrario de lo que hace un CAD que se vende como "empieza dibujando":

> **[H] §12.7:** *"The reason CAD is typically introduced at this stage is because **all the details have been decided** and most importantly **no major fundamental changes are foreseen**."*

Lo que CIERRA el diseño no es el CAD: es el **paso 3 (prototipo a mano)** que valida ergonomía, proporciones, tamaño, funcionalidad y estética:

> **[H] §12.3:** *"a hand-generated workshop prototype is also made to verify design elements such as ergonomics, proportions, size, functionality and aesthetics."*

**(c) El FABRICANTE cierra el lazo de manufactura, no tú.** Las 6 fases del paso 5 [H §12.3]:

| Fase | Qué pasa | Cita |
|---|---|---|
| 1 | Buscar fabricantes y **preguntar qué formato de archivo quieren** | *"Source suitable manufactures and find out what file format(s) they require."* |
| 2 | Enviar archivos + planos + requisitos → cotización **y recomendaciones** | — |
| 3 | **El fabricante te obliga a editar el CAD** | *"Any recommended changes from the manufacturer(s) will require further edits to the CAD model, technical drawings and the manufacturing requirements."* |
| 4 | Prototipo de trabajo en el entorno real | — |
| 5 | **El lazo vuelve entero** | *"If changes are required, the CAD model is updated, and the manufacturing phases are repeated as required."* |
| 6 | Se fabrica | — |

### 2.3 El proceso de riesgo — su propio lazo, con re-entrada obligatoria

Adaptado de **ISO 12100** [H §14, Fig. 14.3]:

```
DETERMINAR LOS LÍMITES de la máquina (uso, espacio, tiempo, ciclo de vida)
      ↓   ← "It is therefore essential to have proceeded, BEFORE the risk
      ↓      identification stage, to a functional design process"
IDENTIFICAR PELIGROS  ── con CERO mitigaciones asumidas (peor caso deliberado)
      ↓
ESTIMAR RIESGO  ── 2 parámetros ISO 12100: severidad del daño + probabilidad
      ↓            (probabilidad = exposición × ocurrencia × evitabilidad)
EVALUAR Y REDUCIR
      ↓
¿Se redujo lo suficiente?  NO → vuelve a reducir
      ↓ SÍ
INTEGRAR Y VALIDAR   ¿Validado (e-stops, etc.)? NO → vuelve
      ↓ SÍ
OPERACIÓN con monitoreo continuo  ¿Opera como se espera? NO → vuelve al ciclo
```

> **[H] §14:** *"It is an **iterative** process, therefore the analysis is conducted again after implementing the risk-reduction measures (mitigation) to validate the desire outcome has been reached."*
> Y: *"it is necessary to carry out a **new** risk assessment if the environment, tasks or operators change (as part of a machine move, for example)."*

---

## 3. REGLAS PRESCRIPTIVAS EN PROSA (lo que NO es ecuación)

### 3.1 Singularidades — cómo evitarlas AL DISEÑAR

**La definición física (no matemática):**
> **[H] §10.4.6:** *"when a manipulator is in a singular posture, or simply in a singularity, it **cannot displace its EE along at least one direction**."*

**Por qué "cerca de" también es un problema — la regla de operación:**
> **[H] §10.4.6:** *"A posture **close to** a singularity is also problematic... as the determinant of its Jacobian matrix will be close to zero, yielding a division by a number close to zero. This will result in **significantly high joint velocities**, which raises **safety concerns** and reduces the **trajectory-tracking accuracy**."*

**La regla de diseño (esta es la que nos importa) — se evita CON GEOMETRÍA, no con software:**
> **[H] §10.4.6 (singularidad de hombro):** *"you will find this type of singularity when one column of J21 is equal to zero, for instance, when e_i and r_1 are parallel, which is commonly called a **shoulder singularity**. This particular case corresponds physically to the wrist center being located on the first joint axis, resulting in the instantaneous loss of one DoF. It can also be true for the second or third joint... but this is **usually avoided by carefully designing the manipulator**."*
> **(singularidad de codo):** *"This includes **elbow singularities**... when the wrist center lies on the plane passing through the second and third axes. This can also happen in theory with the manipulator folded on itself, but **mechanical limits normally prevents this situation from occurring**."*
> **(singularidad de muñeca):** *"an orientation singularity occurs when det(J12) = 0. This can only happen when e4, e5 and e6 are coplanar... it generally occurs when the axes of the **fourth and sixth revolute joints are coincident**. This type of singularity is sometimes called a **wrist singularity**."*

**Taxonomía de las 3 defensas contra singularidad, en orden de preferencia (deducida de las citas):**
1. **Diseñar la geometría para que la singularidad no exista** en el espacio útil (hombro).
2. **Poner límites mecánicos de articulación** que la vuelvan inalcanzable (codo plegado).
3. Rodearla en software — *el libro NUNCA recomienda esto como primera opción*.

**Las singularidades son FRONTERAS entre tipos de configuración:**
> **[H] §10.4.6:** *"the singularities correspond to **boundaries** between these entities [configuration types] within the workspace of the robot."*
> **[H] §10.4.3:** *"Usually, while moving, a manipulator will **keep the same configuration type**, as alternating from one configuration type to another requires **large joint angle variations** to obtain, in the end, the same EE coordinates. Switching configuration can also risk **passing through a singularity**."*

⭐ **Requisito:** el planificador de trayectorias debe declarar el *tipo de configuración* (codo arriba/abajo, muñeca volteada) como una **restricción de la trayectoria completa**, no resolver IK punto por punto eligiendo la solución más cercana. Resolver IK independientemente en cada waypoint es EXACTAMENTE el bug que hace saltar el brazo entre ramas.

**Robots paralelos — la Tipo II es la que mata:**
> **[H] §10.5.4:** *"**Type II**: When J is singular... even for a fixed joint coordinates, an **infinitesimal motion of the end-effector is possible**. This also means that the robot **cannot balance certain external wrenches** applied to the EE, thus resulting in a **loss of control, which must be absolutely avoided**."*
> *"**Type I**: When K is singular... This usually corresponds to a limit of the reachable workspace or an internal limit of the workspace where two branches of solutions to the IKP meet."*
> *"**Type III**: A combination of both... Equation (58) degenerates, resulting in an **unusable EE**."*

### 3.2 Rigidez vs. peso de eslabones, y dónde poner los actuadores

Este es el bloque donde el cliente responde **exactamente lo que le preguntamos**, y lo hace vía la comparación serial-vs-paralelo:

> **[H] §10.3:** *"The former [serial], more common in the manufacturing industry, consist of manipulators made of simple and open kinematic chains. They are known for their **reach and simplicity**. ... The latter, **parallel** manipulators, are based on complex kinematic chains made of at least one loop. They are known for their **structural rigidity, speed and the ability to lift a larger payload with respect to the robot mass**. While for the serial manipulator, **most actuators need to be moved during the robots' motion, the actuators of a parallel manipulator can all be attached rigidly to the base.**"*

**Esa última frase es la respuesta a "¿dónde pongo los actuadores?"** y es la única declaración explícita del libro sobre el tema:
- **Actuador en la articulación (serial):** el motor y su reductor son MASA que las articulaciones aguas arriba tienen que acelerar → penaliza par requerido, velocidad y carga útil.
- **Actuador en la base (paralelo):** rigidez estructural, velocidad y relación carga/masa mayores; costo = lazos cerrados, singularidades Tipo II, FK sin solución cerrada.

**Y el corolario que el libro NO dice pero que el mismo libro obliga:** si mueves el actuador de la articulación a la base, cambias la topología de árbol a lazo cerrado, y con eso **cambias de algoritmo de dinámica** ([F] §2.6 en lugar de §2.5). El costo de "poner el motor en la base" es un costo de SOFTWARE, no solo mecánico.

⭐ **[H] §7.5.1.2 — el único caso donde puedes alejar el actuador SIN penalización:** *"Hydraulic actuators can have their pumps and motors located a considerable distance away with **minimal loss of power**."* Eléctricamente no tienes ese privilegio: el par que pones lejos hay que transmitirlo por un eslabón que se tuerce.

**⚠️ HALLAZGO NEGATIVO IMPORTANTE (verificado por grep sobre las 22,488 líneas del libro completo):**
> Sobre **rigidez torsional, deflexión de eslabones, primera frecuencia natural, relación rigidez/peso con números, y selección de material estructural del brazo** → **[no verificado en el texto extraído]**. Herath NO cubre nada de esto en ningún capítulo, ni siquiera en el 10 ni en el 12. **Ese material tiene que venir de Shigley (`pliego-shigley.md`) y del pliego de FEA (`pliego-fea.md`), no de aquí.**

### 3.3 Backlash, reductores y factores de servicio

**⚠️ HALLAZGO NEGATIVO, y es el más importante del pliego:**

Se hizo `grep` sobre **el libro completo** (no solo el cap. 7 ni el 10) de: `gear`, `backlash`, `harmonic drive`, `cycloidal`, `planetary`, `belt drive`, `torque-speed`, `stall current`, `duty cycle`, `service factor`, `back-driv`, `torsional stiffness`. **Cero apariciones.**

> **[no verificado en el texto extraído]** — **Herath NO habla de reductores, backlash, curva par-velocidad, corriente de stall, ciclo de trabajo, factores de servicio, rigidez torsional ni back-drivability.** Ni una vez. El cap. 7 trata actuadores a nivel de *tipo de dispositivo* (DC/AC/paso a paso/lineal/hidráulico/neumático), no de mecánica de transmisión.

**Lo que esto significa para nosotros (y hay que decirlo sin adornos):** el eslabón "τ requerido → ¿aguanta mi cicloidal?" **no tiene fuente en la bibliografía de robótica que tenemos**. Featherstone te da τ; Herath te dice qué motor existe; **nadie te dice si el reductor sobrevive.** Ese lado del lazo se cierra con:
- `pliego-shigley.md` — engranes, factores de servicio, fatiga, factor de diseño.
- El propio libro de Kazmer no aplica aquí (es moldes).
- **Requisito derivado:** conseguir una fuente de reductores (catálogo Harmonic Drive / Nabtesco, o el capítulo de engranes de Shigley) ANTES de prometer "verificación del reductor".

**Lo que SÍ dice Herath sobre actuadores (cap. 7 §7.5.1), literal y completo:**

| Regla | Cita |
|---|---|
| DC vs AC | *"The speed of a DC motor is directly proportional to the supply voltage with a constant load, whereas, in an AC motor, speed is determined by the frequency of the applied voltage and the number of magnetic poles."* |
| Cuándo AC | *"AC motors are commonly used in servo applications in robotics and in, in-line manufacturing, and other industrial applications where **high repetitions and high precision** are required."* |
| Brushed vs brushless | *"Brushed motors are generally **less expensive and simpler to operate**, while brushless motors are **more reliable, have higher efficiency, and are less noisy**."* |
| Steppers | *"Stepper motors are very versatile, reliable, cost-effective and provide precise motor movements... Most 3D printers, for example, use multiple stepper motors to precisely control the 3D print head."* |
| Lineales (con números) | *"Linear motors can reach very high acceleration, **up to 6 g**, and travel speeds of **up to 13 m/s**."* |
| Hidráulicos | *"A hydraulic actuator can hold force and torque **constant without the pump supplying more fluid or pressure** due to the incompressibility of fluids."* · *"the forces generated by hydraulic actuators are **25 times greater**"* (a igual tamaño de cilindro que neumático) · *"they may **leak fluid**, leading to reduced efficiency"* |
| Neumáticos | *"Most of the benefits... boil down to the **reliability** of the devices and the **safety** aspects. Pneumatic actuators are also highly durable, requiring less maintenance and long operating cycles."* |

### 3.4 Sensores, encoders y límites de articulación

| Regla | Cita [H] §7.3 |
|---|---|
| Precisión típica de encoder rotativo | *"Traditionally, rotary encoders are classified as having accuracies **above ±10 (arcseconds)**."* |
| **Por qué el 2º canal en cuadratura** (⭐ contraintuitivo: es tanto por RUIDO como por dirección) | *"the need to have these sensors closer to the motors often results in them being subject to **electromagnetic noise**. Therefore to improve the encoder's performance **as well as** to decipher the direction of rotation, a second set of light and sensor pair is included with a **90° phase shift**."* |
| IMU | *"they suffer from **bias, drift, and noise**. This requires **regular calibration** of the system before use or sophisticated sensor fusion and filter techniques."* |
| Error de sensor — obligación del ingeniero | *"When this information is not readily available for the sensor selected, **you will need to conduct a thorough error analysis** to isolate and quantify the systematic errors and figure out how to capture the random errors."* |
| Encoder incremental — fórmulas | `PPCM = PPR / (2πr)` ; `L = Pulses / PPCM` ; `S = L / Time` |

**Límites de articulación (`qlim`) — son PARTE DEL MODELO, no una comprobación posterior.** El cliente los pone en la misma tabla que los parámetros DH:

> **[H] §17.3.2:** *"These parameters **also include** the additional qlim parameter (which holds the position limits of each actuator)."*
> **[H] §17.3.4.1:** *"**Joint Limits (qlim_i)** — Set our ith actuator's upper and lower position limits."*

Y los límites **cambian el número de soluciones de la IK**:
> **[H] §10.4.3:** *"Four are shown here, but **more solutions could have been obtained if we did not take into account the joint rotational limitations**."*

⭐ **Requisito:** `qlim` va en la MISMA estructura de datos que `a, d, α, θ`. Un modelo de robot sin límites de articulación es un modelo incompleto, y una IK que devuelve soluciones sin filtrar por `qlim` está mintiendo.

### 3.5 Selección de la solución de IK — la decisión que NO es matemática

> **[H] §10.4.3:** *"One unique solution can be chosen with a **particular criterion**, for instance, to **minimize the joint rotations**, to **minimize the torque generated by joint actuator to lift a payload**, to simply **avoid obstacle**, etc. While the topic of the optimal solution to the IKP will not be covered in this chapter, numerous criteria can be found in the literature."*

⭐ **Esta cita es el permiso explícito del cliente para el módulo que queremos construir.** El propio autor dice "minimizar el par del actuador para levantar la carga" como criterio de selección de IK — y luego declara fuera de alcance el tema. **Ahí está el hueco, nombrado por el cliente.**

### 3.6 Numérico — las reglas duras de implementación

**No calcules la pseudoinversa explícitamente (regla dura, con la razón):**
> **[H] §10.4.5:** *"**You should not compute the generalized inverse per se** with the equation above, since it is known to generate numerical issues (the condition number of Jf^T·Jf is, roughly, the **square** of that of matrix Jf itself, resulting into a badly conditioned system (Forsythe, 1970)). Instead, algorithms such as the **QR decomposition** and the **householder reflections** are used."*

**Doble precisión, obligatoria, en TODOS los pasos:**
> **[F] §2.5.3:** *"Note that H can be **highly ill-conditioned**, reflecting an underlying ill-conditioning of the kinematic tree itself, so it is **recommended to use double-precision arithmetic for every step** in the forward dynamics calculation. (This advice applies also to the ABA.)"*

**Y el mal condicionamiento CRECE con el número de cuerpos:**
> **[F] §2.7.5:** *"Rigid-body systems are often ill-conditioned, in the sense that a small change in the applied force (or a model parameter) can produce a **large change in the resulting acceleration**. This phenomenon was studied by Featherstone, who discovered that the ill-conditioning **gets worse with increasing body count**, and that it can grow in proportion to **O(n⁴)** in the worst case."*

**Varias semillas para IK numérica:**
> **[H] §10.4.5:** *"Depending on the value of x1, the algorithm will converge toward **one** feasible solution (if any). To obtain at least some of the other potential solutions (thus different configuration types), **several starting points x1 must be tested**."*

**El *drift* de restricción — la advertencia de Schwab:**
> **[S] §1.5:** *"note 1 will remain since we **do not use the constraint itself but twice differentiated** with respect to time. This phenomenon is called **drift**."*
> Y observaciones textuales de su experimento: *"1-The joints in A and B **come apart**. 2-These gaps **decrease with decreasing step size**. 3-The configuration of the system after 0.5 seconds **differs with the step size** taken."*

⭐ **Consecuencia de diseño:** un simulador que integra la DAE `[M A; B 0]` **abre las articulaciones**, siempre, aunque el paso sea chiquito. Las tres salidas de Schwab: (cap. 2) coordenadas generalizadas independientes vía Lagrange, (cap. 3) transformación **TMT**, o (Featherstone §2.6) estabilización de **Baumgarte**. **Elegir una y declararla en el pliego técnico del módulo.** El cliente Featherstone declara la suya:
> **[F] §2.1.5:** *"Since the loop-closure constraint equations are applied at the acceleration level, standard **Baumgarte stabilization** is used to prevent the accumulation of position and velocity errors."*

### 3.7 Control (PID) — [H] §8.4

| Ganancia | Efecto bueno | **Efecto malo (la parte que se salta un implementador)** |
|---|---|---|
| **Kp ↑** | *"shorter rise time"*, *"can decrease the system's settling time"* | *"**larger overshoots**"*, *"can also lead the drone to display **highly oscillatory or unstable behaviour**"* |
| **Kd ↑** | *"smaller overshoot and a better-damped behaviour"* | ⭐ *"increasing Kd could lead to **larger steady-state errors**"* |
| **Ki ↑** | *"a reduction in the steady-state error (often elimination)"* | *"could lead to **larger oscillations**"* + integral windup |

**La regla dura de sintonía:**
> **[H] §8.4.1.4:** *"it is **not possible to independently tune** the three different gains. Each of them aims to offer the desired response characteristic... but has a **negative effect that must be compensated by re-tuning another gain**. Therefore, PID tuning is a **highly coupled and iterative procedure**... Not all of them have to be present; therefore, we often employ P controllers, PI controllers or PD controllers when a simpler controller yields the desired result."*

**Integral windup y su remedio:**
> **[H] §8.4.1.3:** *"a significant change in the setpoint... results in the integral term accumulating significant errors that cannot be offset by errors in the opposite direction **leading to a loss of control**... One common technique is **setting boundaries for the integral term** depending on the known system limitations, such as **actuator operational range**."*

**[no verificado en el texto extraído]:** *feedforward*, control cinemático vs. dinámico, y computed-torque control no aparecen en Herath cap. 8. Featherstone sí nombra el uso: *"Inverse dynamics is used in **feedforward control**"* [F §2.1] — pero no desarrolla la ley de control.

### 3.8 Planeación de trayectorias — lo que hay y lo que NO hay

**Lo que HAY [H] §8.5 (todo geométrico, para robots MÓVILES):**

| Algoritmo | Entrada | Limitación citada |
|---|---|---|
| **A\*** (Hart 1968) | grafo completo + heurística admisible; `f = g + h` | *"they need a **complete map** of the area... While A* could be used to plan from scratch for every update, this is **computationally expensive**."* |
| **Dijkstra** (1959) | grafo completo, sin heurística | A* *"guides its search towards the most promising states, which can save a significant amount of computational effort"* |
| **D\* Lite / Focussed D\*** | mapa + replanificación incremental | busca de la META hacia el inicio; *"much more effective than the A* algorithm and Dijkstra's"* en entornos desconocidos |
| **Field D\*** | rejilla con nodos en las **esquinas** | permite *"direct, low-cost, **smooth** paths in non-uniform environments"* |
| **PRM** (Kavraki) | muestreo aleatorio del espacio de configuración | ⭐ *"they **cannot always be guaranteed to find the optimal path**"* + *"**narrow corridors** in large environments can rapidly increase the path planning time"* |
| **Bug 1/2, DistBug, TangentBug** | solo sensor local | *"not very reliable in a more complex and cluttered environment"* |
| **VFH** (Borenstein 1991) | histograma polar + rejilla local | *"does **not guarantee the completeness**... problematic to pass through a **narrow passage**... does **not consider the robot's dynamics**"* |

**⚠️ Y ahora lo que NO HAY, verificado por grep:**
> **[no verificado en el texto extraído]:** Herath **no distingue** *path planning* (geométrico) de *trajectory planning* (con tiempo). **No** menciona perfiles trapezoidales de velocidad, **jerk**, **splines**, interpolación temporal, ni límites de velocidad/aceleración como parámetros de planeación. Tampoco RRT desarrollado (solo la referencia bibliográfica a Kuffner & LaValle 2000), ni campos potenciales, ni *dynamic window*.

**Esto es una brecha de FUENTE, no de nuestro entendimiento.** Y es crítica: el módulo que queremos (tarea → trayectoria → τ) necesita **el perfil temporal**, y este libro no lo da. Lo único que dice del tema, en una sola línea, es que el Jacobiano sirve para eso:
> **[H] §10.4.5:** *"The Jacobian is useful to **plan smooth trajectory**, to compute the wrench applied by the EE, to determine singular postures, etc."*

⭐ **Requisito de honestidad:** cuando implementemos el generador de trayectorias, la parte temporal (perfil trapezoidal / S-curve / jerk limitado) **no está respaldada por estos tres libros** y hay que declararla como **extensión de La Forja**, exactamente como se hizo con Kazmer (`feedback_kazmer_no_inventar.md`).

### 3.9 Seguridad — [H] cap. 14

**Normas citadas, con qué obligan:**

| Norma | Qué es |
|---|---|
| **ISO 12100:2010** | *"specifies basic terminology, principles and a methodology for achieving safety in the design of machinery"* — tipo A, aplica a TODA máquina. Es la que da el lazo de riesgo. |
| **ISO 10218-1 / -2:2011** | Robots industriales. *"Part 1 is intended for designers and manufacturers, while Part 2 is intended for integrators and users"*. Ojo: **ISO/DIS 10218-1.2** (2022) cambia el estatus del *safety-rated monitored stop*. |
| **ISO/TS 15066:2016** | Robots colaborativos; complementa 10218-1/-2. **Aquí viven los números de fuerza/presión por región del cuerpo.** |
| **ISO 13857:2019** | Distancias de seguridad. **Los dos únicos números duros que da el libro.** |
| **ISO 13850:2015** | Diseño de paros de emergencia. |
| **ISO 13849-1 / IEC 62061** | Tipo B genéricas, de las que derivan 10218-1/-2. |
| **ANSI/RIA R15.06-2012** + **RIA TR R15.306-2016** | Metodología de evaluación de riesgo **basada en tareas** (la jerarquía de 8 categorías). |
| **ANSI/RIA R15.08 Parts 1-3 (2020)** | Robots móviles industriales (fabricante / integrador / usuario final). |
| **CAN/CSA-Z434-14**, **ANSI/ITSDF B56.5-2019**, **ISO 8373:2021**, **ISO 19649:2017**, **ISO 13482:2014**, **IEEE 7000-2021** | Complementarias. |

**Los NÚMEROS DUROS que sí trae el libro (son solo dos, y hay que ser honesto):**
> **[H] §14 (ISO 13857):** *"a barrier is necessary if the mechanism potentially dangerous... is **lower than 2.5 m above ground**. In this case, the same standard recommends rigid panels... the **minimal height of the panels is 1.8 m, regardless of the system**."*

Sobre fuerza/presión/energía de contacto en N, N/cm² y J: el libro **remite a ISO/TS 15066 sin transcribir la tabla**. Solo da el diagrama cualitativo *"touch sensation → pain sensation (onset) → minor injury → reversible injury → irreversible injury"*. → **[no verificado en el texto extraído]**.

**Los 4 modos de operación colaborativa (y por qué son 3.5):**
1. **Hand guiding** — *"before the operator enters the collaborative workspace, the robot system achieves a safety-rated monitored stop (drive power remains on); operator grasps hand-operated device (includes an enabling device)"*.
2. **Speed and separation monitoring** — *"a **minimum separation distance** between the operator and the cobot must be maintained at all times... If separation distance falls below the established threshold, a **protective stop is required**."*
3. **Power-and-force limiting** — *"physical contact... is possible... the corresponding **forces must be limited**. The contact (quasi-static/pressure or transient/dynamic) must be **detected by sensors** and the cobot must react."*
4. ⭐ **Safety-rated monitored stop** — *"in the new version of ISO 10218-1, which will be published in 2022, it **will no longer be considered a type of collaborative operation**."*

**La jerarquía de reducción de riesgo — orden ESTRICTO (RIA TR R15.306):**
> *"in this precise order: 1. **elimination**; 2. **substitution**; 3. **limit interaction**; 4. **safeguarding and SRP/CS**; 5. complementary protective measures; 6. warnings and awareness means; 7. administrative controls; 8. PPE."*
> Y la regla de obligatoriedad: *"For hazards initially evaluated as **medium and above**... mitigation measures **must include those within the first four categories**, as the four others are **not considered enough** to reduce the risk."*

**El anti-patrón nombrado explícitamente:**
> ⭐ *"you should **avoid a 'one-size-fits-all' solution**, as it may be too restrictive for the application, ultimately leading to **frequent bypass of some safeguards** to accomplish a task."*

**Movimiento por encima de los hombros — la regla que se está suavizando en vivo:**
> *"You **must** prevent contact over the shoulders, and **shall** avoid any of the robot motion above this level. Considering it may not always be realistic, experts on the standardization committee working on ISO 10218 update are proposing to **replace the verb 'shall' with 'should'**, still strongly encouraging to keep the robot's movements below head level."*

**Métodos de validación (lo que se acepta como prueba):**
> *"visual inspection; practical tests; measurement; observation during operation; review of application-specific schematics, circuit diagrams and design material; review of task-based risk assessment; review of specifications and information for use."*

**[no verificado en el texto extraído]:** las definiciones formales de *maximum space / restricted space / operating space* de ISO 10218-1 **no aparecen** en el libro (verificado por grep sobre las 22,488 líneas). El único término de espacio en prosa es *collaborative workspace*, sin definición formal aislada.

### 3.10 CAD paramétrico — reglas duras de modelado [H] §12.7

Estas son de aplicación DIRECTA a `forja-brep` y merecen entrar al gate del kernel:

| Regla | Cita |
|---|---|
| Referencias circulares | *"The problem with circular reference is that they can cause the assembly to **stop regenerating or even become unstable**."* |
| ⭐ **Solo se detectan al regenerar TODO** | *"Most CAD systems will alert you if any circular references have been created; however, this generally **only happens when the whole assembly is regenerated**."* |
| Regenerar seguido | *"it is important to **regularly regenerate the whole assembly** to check for circular references before they become too imbedded in the reference scheme."* |
| **Best practice explícita** | *"The best practice to avoid circular references is to **only take references from files created before the one you are working in**."* |
| ⭐ Referencias prohibidas (repetido 2 veces) | *"**Do not take references from solid features.**"* / *"**Do not take references from rounds, shells and draft angles.**"* |
| ⭐ Orden de features | *"**Create rounds, shells and draft angles last** when modelling your parts."* |
| Reusar > reconstruir | *"It is much faster, less complex... and easier to simply **reassemble the same part** in another location in the assembly than continually rebuilding the part."* |
| Costo de un mal modelo | *"A poorly constructed CAD model can take **considerably more time** to build, edit and regenerate than a well-constructed model."* |
| Intercambio de archivos | *"CAD files must first be converted to formats such as STEP, VDA, STL, etc.... **their parametric associations are lost** leaving limited ability for the files to be edited."* |
| 3D printing — cuándo NO | *"their mechanical properties are **not as good** as parts made using conventional methods... Therefore, 3D printing is **best suited for making parts that are subjected to low structural loads**."* |
| Proyecciones | *"There **must not be a mix** of first and third angle projections in a set of drawings."* |

---

## 4. DINÁMICA INVERSA — LA ESPECIFICACIÓN DE IMPLEMENTACIÓN [F]

Esta sección está escrita para que un implementador la siga sin volver al PDF.

### 4.1 Qué es, qué come, qué escupe

> **[F] §2.1:** *"**inverse dynamics**, in which the required joint actuator torques/forces are computed from a specification of the robot's trajectory (position, velocity, and acceleration)"*

```
ENTRADA:   q (n×1)     posiciones de articulación
           q̇ (n×1)     velocidades
           q̈ (n×1)     aceleraciones
           model       { N_B, jtype(i), p(i), X_L(i), I_i }
           ⁰fᵉ_i        fuerzas externas (opcional, en coords de la base)
SALIDA:    τ (n×1)     par/fuerza requerido en CADA articulación
```

El modelo tiene **exactamente cuatro componentes** — ni uno más:
> **[F] §2.4:** *"A basic rigid-body model of a robot mechanism has four components: a **connectivity graph**, **link and joint geometry parameters**, **link inertia parameters**, and a **set of joint models**."*

### 4.2 Por qué es O(n) y no O(n³) — la respuesta exacta

**La confusión típica es creer que el O(n³) es el "costo de la dinámica". No lo es: es el costo de la dinámica DIRECTA hecha por el camino obvio.**

> **[F] §2.5.3:** *"Forward dynamics, in joint space, is the task of calculating q̈ from q, q̇, and τ. Starting from (2.37), the most obvious way to proceed is to calculate H and Cq̇+τ_g, and then solve the linear equation `Hq̈ = τ − (Cq̇ + τ_g)` for q̈. If the mechanism is a kinematic tree, then **H and Cq̇+τ_g can be computed in O(n²) and O(n) operations**, respectively, and (2.83) **can be solved in O(n³) operations**. Algorithms that take this approach are therefore known collectively as **O(n³) algorithms**."*

**La dinámica INVERSA nunca forma H.** El RNEA:
1. Propaga v y a **hacia afuera** (base → puntas): costo constante por articulación.
2. Calcula la fuerza neta de cada eslabón **localmente** con la ecuación de movimiento espacial `f = I·a + v × I·v` — que es UNA ecuación que ya contiene Newton **y** Euler:
   > **[F] §2.2.12:** *"This single equation incorporates both Newton's and Euler's equations of motion for a rigid body."*
3. Propaga la fuerza **hacia adentro** (puntas → base): costo constante por articulación.
4. Proyecta: `τ_i = Φ_iᵀ f_i`.

**→ 2 pasadas × n articulaciones × aritmética 6-D de tamaño fijo = O(n).** No hay ninguna matriz n×n que armar ni factorizar. Ese es el argumento completo.

**Y la matización que casi nadie cita (⭐):**
> **[F] §2.5.3:** *"this figure of O(n³) should be regarded as the **worst-case** complexity, since the actual complexity depends on the amount of **branching** in the tree. Furthermore, even in the worst case, **the n³ term has a small coefficient, and does not dominate until approximately n = 60**."*

**Para nuestro brazo de 3 eslabones y nuestro hexápodo, n ≪ 60. El argumento O(n) NO es la razón para usar RNEA en La Forja.** La razón es otra, y es mejor: **el RNEA te da τ por articulación directamente**, que es literalmente el número que necesitamos para dimensionar el reductor. La dirección del cálculo importa más que su complejidad.

### 4.3 El álgebra de vectores espaciales (lo mínimo para implementar)

Un vector espacial es 6-D en coordenadas de Plücker: **movimiento** en `M⁶`, **fuerza** en `F⁶`. Se distinguen porque **transforman distinto**.

```
v = (ω ; v_O)          velocidad espacial            [movimiento]
a = v̇ = (ω̇ ; v̇_O)      aceleración ESPACIAL          [movimiento]
f = (n_O ; f)          fuerza espacial               [fuerza]
```

**⭐ La aceleración espacial NO es la aceleración clásica.** Esta es LA trampa de implementación:
> **[F] §2.2.9:** *"a = (ω̇ ; v̇_O) and a′ = (ω̇ ; v̇′_O), where a is the spatial acceleration, a′ is the classical acceleration, v̇_O is the derivative of v_O taking O to be **fixed in space**, and v̇′_O is the derivative of v_O taking O to be **fixed in the body**."*
> Relación: `a′ = a + (0 ; ω × v_O)`

Y la razón por la que vale la pena el cambio de definición:
> **[F] §2.2.9:** *"Observe that spatial accelerations are composed by **addition**, exactly like velocities. **There are no Coriolis or centrifugal terms to worry about.** This is a significant improvement on the formulae for composing classical accelerations."*

**Los objetos y sus fórmulas (Tabla 2.1 de [F]):**

```
S(p) = [[ 0, -pz,  py],       matriz antisimétrica: S(p)·v = p × v
        [ pz,  0, -px],
        [-py, px,   0]]

Transformada de Plücker (movimiento), de A a B:
  ᴮX_A = [[ ᴮR_A            , 0    ],
          [ S(ᴮp_A)·ᴮR_A    , ᴮR_A ]]

Transformada de fuerza:   ᴮX^F_A ≡ (ᴮX_A)^-T ≡ (ᴬX_B)^T

Inercia espacial en el origen del frame (10 parámetros: m, c(3), Ī(6)):
  I_O = [[ Ī_cm + m·S(c)·S(c)^T , m·S(c) ],
         [ m·S(c)^T             , m·1    ]]

Transformación de inercia:   I_A = (ᴮX_A)^T · I_B · ᴮX_A
Composición de cuerpos:      I_tot = I_1 + I_2      ← UNA ecuación, no tres
Energía cinética:            T = ½ · v · I · v

Producto cruz movimiento×movimiento → movimiento:
  m1 × m2 = ( m1_ω × m2_ω ; m1_ω × m2_O + m1_O × m2_ω )
Producto cruz movimiento×fuerza → fuerza:
  m × f   = ( m_ω × f_nO + m_O × f_f ; m_ω × f_f )

ECUACIÓN DE MOVIMIENTO ESPACIAL:   f = I·a + v × I·v
```

> **[F] §2.2.11:** *"If two bodies, having inertias I1 and I2, are rigidly connected to form a single composite body, then the inertia of the composite is the sum... **This single equation takes the place of three equations in the traditional 3-D vector approach**: one to compute the composite mass, one to compute the composite center of mass, and one to compute the composite rotational inertia."*

**Estructuras de datos eficientes (Tabla 2.1) — un tercio de la memoria:**
> **[F] §2.2.13:** *"the suggested data structures for rigid-body inertias and Plücker transforms contain **only a third as many numbers** as the 6×6 matrices they represent. The efficient arithmetic formulae... offer cost savings ranging from a **factor of 1.5 to a factor of 6**."*

| Objeto matemático | 6×6 / 6×1 | Representación compacta |
|---|---|---|
| `v = (ω ; v_O)` | 6×1 | `(ω ; v_O)` → 3+3 |
| `I` | 6×6 | `(m ; h ; Ī)` → 1+3+9 |
| `X` | 6×6 | `(R ; p)` → 9+3 |

**Y el consejo de arquitectura de software (esto es un requisito, no un tip):**
> **[F] §2.2.13:** *"The easiest way to implement spatial vector arithmetic... is to start with an existing matrix arithmetic tool... **This is the recommended approach whenever human productivity is more important than computational efficiency.** If greater efficiency is required, then a more elaborate spatial arithmetic library must be used."*

⭐ **Requisito para La Forja:** **implementa primero con matrices 6×6 densas.** Es literalmente lo que el autor recomienda. Optimizar a `(R;p)` y `(m;h;Ī)` es una segunda pasada CON benchmark de por medio, no la primera versión.

### 4.4 Modelo de articulación y conectividad

**Numeración regular (obligatoria — muchos algoritmos dependen de `p(i) < i`):**
> **[F] §2.4.1:** *"the fixed base is numbered body 0. The other bodies are then numbered from 1 to N_B in any order such that **each body has a higher number than its parent**... **Many algorithms rely on the property p(i) < i** to perform their calculations in the correct order."*

**Movimiento libre de la articulación:**
```
v_rel = Φ_i · q̇_i                    (2.64)   Φ_i es 6 × n_i
a_rel = Φ_i · q̈_i + Φ̇_i · q̇_i        (2.65)
Φ̇_i   = Φ̇°_i + v_i × Φ_i             (2.69)   Φ̇°_i = (∂Φ_i/∂q_i)·q̇_i
τ_i   = Φ_i^T · f_i                  (2.68)
```

**Los valores concretos (los únicos que necesitas para un brazo de revolutas):**
> **[F] §2.4.4:** *"Motion is chosen along (prismatic) or about (revolute) the ẑ_i coordinate axis. In this case, `Φ_i = (0 0 0 0 0 1)^T` for a **prismatic** joint and `Φ_i = (0 0 1 0 0 0)^T` for a **revolute** joint. Also, `Φ̇°_i = 0`."*
> Y para base flotante: *"`Φ_i = 1` (6×6 identity matrix) and `Φ̇°_i = 0`."*

> ⭐ *"For most common joint types, `Φ̇°_i = 0`."* → **el término `pdcalc` se puede omitir del primer corte.** El único caso del libro donde NO es cero es la articulación universal del tobillo humanoide.

**Transformada por articulación:**
```
ⁱX_p(i) = X_J(i) · X_L(i)            (2.61)
   X_L(i) = transformada FIJA del eslabón (p(i) → Ji)      ← constante, del modelo
   X_J(i) = transformada VARIABLE de la articulación (Ji → i)  ← f(q_i)
```

### 4.5 EL ALGORITMO — RNEA en coordenadas de eslabón (Tabla 2.6 de [F])

```
entradas: q, q̇, q̈, model, ⁰fᵉ_i
salida:   τ
datos:    N_B, jtype(i), p(i), X_L(i), I_i

v₀ = 0
a₀ = −a_g                                      ← ¡AQUÍ entra la gravedad!

para i = 1 hasta N_B:                          ← PASADA HACIA AFUERA
    X_J(i) = xjcalc(jtype(i), q_i)
    ⁱX_p(i) = X_J(i) · X_L(i)
    si p(i) ≠ 0:  ⁱX₀ = ⁱX_p(i) · ᵖ⁽ⁱ⁾X₀
    Φ_i  = pcalc(jtype(i), q_i)
    Φ̇°_i = pdcalc(jtype(i), q_i, q̇_i)          ← 0 para revolutas/prismáticas
    v_i = ⁱX_p(i) · v_p(i) + Φ_i·q̇_i                              (2.76)
    ζ_i = Φ̇°_i·q̇_i + v_i × (Φ_i·q̇_i)
    a_i = ⁱX_p(i) · a_p(i) + Φ_i·q̈_i + ζ_i                        (2.77)
    f_i = I_i·a_i + v_i × I_i·v_i − ⁱX₀^{-T}·⁰fᵉ_i                (2.73)+(2.78)
fin

para i = N_B hasta 1:                          ← PASADA HACIA ADENTRO
    τ_i = Φ_i^T · f_i                                             (2.75)
    si p(i) ≠ 0:  f_p(i) = f_p(i) + ⁱX_p(i)^T · f_i               (2.78)
fin
```

**⭐ EL TRUCO DE LA GRAVEDAD — es el detalle más elegante y el que más se malinterpreta:**
> **[F] §2.5.1:** *"The effect of a uniform gravitational field on the mechanism can be simulated by **initializing a₀ to −a_g instead of zero**, where a_g is the gravitational acceleration vector. In this case, **a_i is NOT the true acceleration of link i**, but the sum of its true acceleration and −a_g."*
> Y el porqué: *"the effects of gravity on each link are efficiently included in the equations by **accelerating the base of the mechanism upward**."*

Herath describe el mismo truco desde el otro libro:
> **[H] §10.6.2:** *"To simplify the procedure while still obtaining an equivalent solution, we use a simple trick. Here, we suppose a **virtual acceleration −g at the base of the robot**... even though the base is fixed and not moving, we have `[c̈₀]₁ = [−g]₁`."*

**Los `a_i` intermedios NO son físicos. No los grafiques como aceleraciones.** Es exactamente el tipo de bug silencioso que pasa todos los tests numéricos y produce una animación de telemetría mentirosa.

### 4.6 La versión 3-D (Tabla 2.7 de [F]) — más rápida, solo revolutas en z

Si `n` es chico y todas las articulaciones son revolutas en `ẑ`, esta versión es **ligeramente más rápida** por una razón sutil y bonita:

```
ω₀ = 0 ; ω̇₀ = 0 ; v̇′₀ = −v̇′_g
para i = 1..N_B:
    ⁱR_p(i) = rotz(q_i) · R_L(i)
    ω_i  = ⁱR_p(i)·ω_p(i) + ẑ_i·q̇_i
    ω̇_i  = ⁱR_p(i)·ω̇_p(i) + (ⁱR_p(i)·ω_p(i)) × ẑ_i·q̇_i + ẑ_i·q̈_i
    v̇′_i = ⁱR_p(i)·( v̇′_p(i) + ω̇_p(i) × ᵖ⁽ⁱ⁾p_i + ω_p(i) × (ω_p(i) × ᵖ⁽ⁱ⁾p_i) )
    f_i  = m_i·( v̇′_i + ω̇_i × c_i + ω_i × (ω_i × c_i) )
    n_i  = Ī^cm_i·ω̇_i + ω_i × Ī^cm_i·ω_i + c_i × f_i
para i = N_B..1:
    τ_i = ẑ_i^T · n_i
    si p(i) ≠ 0:
        f_p(i) = f_p(i) + ⁱR^T_p(i)·f_i
        n_p(i) = n_p(i) + ⁱR^T_p(i)·n_i + ᵖ⁽ⁱ⁾p_i × ⁱR^T_p(i)·f_i
```

> ⭐ **[F] §2.5.1:** *"The conversion from spatial to classical acceleration has one interesting side-effect: **v_i cancels out of the equation of motion, and therefore does not need to be calculated.** As a result, the 3-D version of the algorithm has a slight speed advantage over the spatial version."*

Nótese que en la Tabla 2.7 **no aparece `v_i` en ningún lado**. Solo `ω_i`. Eso no es una omisión: es el resultado.

### 4.7 Los otros tres algoritmos (para cuando los necesitemos)

**CRBA — matriz de inercia H (§2.5.3), O(n²):**
```
H = 0
para i = 1..N_B:  I^C_i = I_i
para i = N_B..1:
    F = I^C_i · Φ_i ;  H_ii = Φ_i^T · F
    si p(i) ≠ 0:  I^C_p(i) = I^C_p(i) + ⁱX^T_p(i) · I^C_i · ⁱX_p(i)
    j = i
    mientras p(j) ≠ 0:
        F = ʲX^T_p(j) · F ;  j = p(j)
        H_ij = F^T · Φ_j ;  H_ji = H_ij^T
```
**⭐ El truco que ahorra medio algoritmo:** `Cq̇ + τ_g` se obtiene GRATIS del RNEA:
> **[F] §2.5.3:** *"`ID(q, q̇, q̈) = τ = Hq̈ + Cq̇ + τ_g`, so **`Cq̇ + τ_g = ID(q, q̇, 0)`**. Thus, the value of Cq̇+τ_g for a kinematic tree can be calculated efficiently using the RNEA with q̈ = 0."*

**Y la columna j de H también sale del RNEA:** `H[:,j] = ID(q, 0, e_j) − ID(q, 0, 0)`. Verificado numéricamente en §5.3 de este pliego.

**Esparcidad inducida por ramas (⭐ relevante para el hexápodo, que tiene 6 ramas):**
> **[F] §2.5.3:** *"Equation (2.85) implies that some elements of H will **automatically be zero if there are branches** in the kinematic tree... Observe that **nearly half of the elements are zero**. ... Depending on the amount of branching in the tree, the **sparse algorithms can run many times faster** than the standard algorithms."*

**ABA — dinámica directa (§2.5.2), O(n).** 3 pasadas: afuera (velocidades) → adentro (inercias articuladas `I^A_i` y fuerzas de sesgo `p^A_i`) → afuera (aceleraciones). Ver Tabla 2.8 de [F].

**OSIM (§2.5.4).** Para n ≲ 6, el camino O(n³) es el más eficiente: `1. H via CRBA → 2. Cholesky H = LL^T → 3. Y = L⁻¹J^T → 4. Λ⁻¹ = Y^T Y → 5. factorizar (opcional)`.

### 4.8 Lazos cerrados — porque un reductor cicloidal ES un lazo cerrado

**Esto es directamente relevante a La Forja y probablemente lo pasaríamos por alto.** Nuestros cicloidales print-in-place son mecanismos de lazo cerrado, y Featherstone advierte por qué eso es cualitativamente distinto:

> **[F] §2.6:** *"Systems with closed kinematic loops exhibit more complicated dynamics than kinematic trees. For example:*
> *1. The degree of motion freedom of a kinematic tree is fixed, but that of a closed-loop system **can vary**.*
> *2. The degree of instantaneous motion freedom is always the same as the degree of finite motion freedom in a kinematic tree, but they **can be different** in a closed-loop system.*
> *3. Every force in a kinematic tree can be determined, but **some forces in a closed-loop system can be indeterminate**. This occurs whenever a closed-loop system is **overconstrained**."*

**⭐ Y los mecanismos PLANARES son SIEMPRE sobre-restringidos:**
> **[F] §2.6:** *"Both these mechanisms are planar, and are therefore **overconstrained**. As a result, the out-of-plane components of the joint constraint forces are **indeterminate**. This kind of indeterminacy has **no effect on the motions** of these mechanisms, but it does **complicate the calculation of their dynamics**."*

**El remedio del propio cliente (elimina filas de L a mano, y no es hacer trampa):**
> **[F] §2.6.1:** *"It is often possible to **identify redundant constraints in advance**. For example, if a kinematic loop is known to be planar, then the out-of-plane loop-closure constraints are redundant. In these circumstances, it is **advantageous to remove the corresponding rows of L** and elements of l and λ. The removed elements of λ can be assigned a value of zero."*

**Formulación:**
```
Ecuación de movimiento del lazo cerrado:    Hq̈ + Cq̇ + τ_g = τ + τᵃ + τᶜ        (2.92)
Restricción de cierre (a nivel aceleración): L·q̈ = l                            (2.93)
Fuerzas de restricción:                      τᶜ = L^T·λ                          (2.96)
Sistema:  [[H, L^T],[L, 0]] · [q̈; −λ] = [τ + τᵃ − (Cq̇+τ_g) ; l]                (2.97)
Movilidad:  mobility = n − rank(L)                                              (2.95)
```
Los 3 métodos de solución: **(1)** directo, O((n+n_c)³), el más simple y el menos eficiente; **(2)** resolver λ primero — *"particularly useful if n ≫ n_c"*, O(n·n_c² + n_c³); **(3)** eliminar τᶜ vía espacio nulo — *"most efficient if n − n_c is small. It is also reported to be **more stable** than method 1"*.

**Y para cortar el lazo (Fig. 2.10):** inserta una articulación de 0 DOF y corta AHÍ, repartiendo la inercia: `I₁ + I₂ = I`. *"There is no loss of generality with this assumption: one simply breaks open the loops by **cutting links instead of joints**."*

---

## 5. CASOS DE VERIFICACIÓN — LOS GATES

**Todos los valores de esta sección fueron VERIFICADOS numéricamente** implementando el RNEA espacial de la Tabla 2.6 de [F] y comparándolo contra la forma cerrada `H(q)q̈ + C(q,q̇)q̇ + τ_g(q)`. Script de referencia: `scratchpad/rnea_check.py` (transferible a `tests/` cuando se implemente el módulo).

### 5.1 Modelo de referencia — brazo 2R planar (el "péndulo doble accionado")

```
l1 = l2 = 1.000 m        m1 = m2 = 1.000 kg
r1 = r2 = 0.500 m        (CoM al centro de cada eslabón)
I1 = I2 = m·l²/12 = 0.0833333 kg·m²   (varilla delgada, respecto a su CoM)
g = 9.81 m/s², apuntando en −y
θ1 medido desde +x ; θ2 relativo al eslabón 1
```

### 5.2 GATE 1 — los cinco casos con valor de referencia

| # | Caso | q [rad] | q̇ [rad/s] | q̈ [rad/s²] | g | **τ1 [N·m]** | **τ2 [N·m]** | Verificación independiente |
|---|---|---|---|---|---|---|---|---|
| **A** | Estático, brazo extendido horizontal | `[0, 0]` | `[0,0]` | `[0,0]` | 9.81 | **19.6200** | **4.9050** | Masa total 2 kg, CoM combinado en x = 1.000 m → τ1 = 2·9.81·1.0 = 19.62 ✔ ; τ2 = 1·9.81·0.5 = 4.905 ✔ |
| **B** | Inercia pura, sin gravedad | `[0, 0]` | `[0,0]` | `[1,0]` | 0 | **2.666667** | **0.833333** | τ1 = I de varilla de 2 m y 2 kg girando en un extremo = (1/3)·2·2² = **8/3** ✔ ; τ2 = I2·α + m2·a·r2 = 0.08333 + 1.5·0.5 = **5/6** ✔ |
| **C** | Centrífugo puro, codo a 90° | `[0, π/2]` | `[1,0]` | `[0,0]` | 0 | **0.000000** | **0.500000** | Todo el sistema gira rígido a ω=1 → fuerzas centrípetas TODAS centrales al origen → momento cero en la base ✔ ; en la muñeca, r×F = 0.5·1 = 0.5 ✔ |
| **D** | Mixto (nada se cancela) | `[0.3, 0.7]` | `[1.1,−0.4]` | `[0.5,2.0]` | 9.81 | **19.587141** | **4.064478** | RNEA vs. forma cerrada: diferencia máx. **0.00e+00** |
| **E** | Estático, codo a 90° | `[0, π/2]` | `[0,0]` | `[0,0]` | 9.81 | **14.7150** | **0.000000** | El eslabón 2 apunta hacia arriba → su peso no genera momento en la muñeca ✔ ; τ1 = (0.5+1)·9.81 = 14.715 ✔ |

**Criterio de aprobación:** `max |τ_RNEA − τ_referencia| < 1e-9 N·m` en los 5 casos. Medido: **≤ 4.4e-16**.

⭐ **Por qué estos cinco y no otros:** cada uno aísla UN término de `Hq̈ + Cq̇ + τ_g`. **A** y **E** aíslan `τ_g`. **B** aísla `H`. **C** aísla `C` (y es el único que atrapa el bug clásico de signo en el producto cruz espacial). **D** los mezcla para que ningún error se cancele por simetría. Un test que solo corra el caso D pasa aunque tengas dos bugs que se compensen.

### 5.3 GATE 2 — la matriz de inercia H y sus propiedades

`H(q)` obtenida por RNEA (`H[:,j] = ID(q,0,e_j) − ID(q,0,0)`), en `q = [0,0]`:

```
H(0,0) = [[ 2.666667 , 0.833333 ],
          [ 0.833333 , 0.333333 ]]
```
- `H11 = 8/3` = (1/3)·M·L² con M=2 kg, L=2 m ✔
- `H22 = 1/3` = (1/3)·m·l² con m=1 kg, l=1 m ✔
- **Simétrica:** `max|H − Hᵀ| = 0.00e+00` ✔
- **Definida positiva** (obligatorio, [F] §2.3.1: *"H is an n×n symmetric, positive-definite matrix"*): en `q=[0.3,0.7]` los eigenvalores son `[0.112425, 2.652417]`, ambos > 0 ✔

### 5.4 GATE 3 — la propiedad de anti-simetría (el test que atrapa errores de C)

> **[F] §2.3.1:** *"it is possible to show that the matrix `N = Ḣ(q) − 2C(q,q̇)` is **skew-symmetric**. Thus, for any n×1 vector α, `α^T·N·α = 0`."* Y para α = q̇: `q̇^T·N·q̇ = 0`.
> *"By applying the principle of **conservation of energy**, it can be shown that (2.47) holds for **any** choice of the matrix C."*

Medido en `q = [0.3, 0.7]`, `q̇ = [1.1, −0.4]`, con Ḣ por diferencias centradas (ε = 1e-6):
```
q̇^T · (Ḣ − 2C) · q̇  =  −1.302e-10      (debe ser 0)
```
**Criterio de aprobación:** `|q̇ᵀ(Ḣ−2C)q̇| < 1e-6 · ‖q̇‖² · ‖H‖`.

⭐ **Este gate es especial: es el ÚNICO que verifica `C` sin necesitar la forma cerrada de `C`.** Es válido para cualquier robot, de cualquier número de eslabones, sin tener que derivar símbolos de Christoffel a mano. **Es el gate que hay que correr sobre el brazo de 3 eslabones y el hexápodo**, donde no vamos a tener forma cerrada.

### 5.5 GATE 4 — conservación de energía del péndulo doble libre (Schwab / [S] §1.5)

Péndulo doble en caída libre desde horizontal (`q=[0,0]`, `q̇=[0,0]`, τ=0), integrado con RK4 sobre `q̈ = H⁻¹(τ − Cq̇ − τ_g)`:

| Δt | E₀ [J] | T_max [J] | Deriva absoluta máx. [J] | Deriva / T_max |
|---|---|---|---|---|
| 1e-3 | 0.000000 | 19.4841 | 3.453e-09 | **1.77e-10** |
| 1e-4 | 0.000000 | 19.6106 | 1.855e-12 | **9.46e-14** |

Estado de referencia a **t = 2.000 s** (idéntico para ambos pasos, a 6 decimales):
```
q  = [ −1.653555 ,  0.490120 ]  rad
q̇  = [ −0.961145 , 12.860100 ]  rad/s
```

**Criterio de aprobación:** `deriva / T_max < 1e-6` con RK4 a Δt = 1e-3.
⭐ **Nota:** E₀ = 0 exactamente porque el brazo arranca horizontal (V = 0) y en reposo (T = 0). Por eso **el criterio se normaliza contra T_max, no contra E₀** — un test que dividiera entre E₀ explotaría. Es el tipo de detalle que hace que un gate pase o truene por la razón equivocada.

⭐ **Este gate es la contrapartida directa a la advertencia de Schwab.** Él demuestra que integrando la DAE `[M A; B 0]` **las articulaciones se abren** ([S] §1.5, nota 1: *"The joints in A and B come apart"*). Con coordenadas independientes + RK4 (que es el camino de [S] cap. 2/3 y de [F] §2.5), la restricción está **incorporada** en el modelo y esa deriva no existe. Los números de arriba lo prueban: 9.46e-14. **El gate documenta la ventaja de la elección arquitectónica.**

### 5.6 GATE 5 — EL BRAZO REAL DE LA FORJA (y el hallazgo que justifica el módulo entero)

Parámetros tomados **literalmente del código existente** (`src/forja/mech/brazo.ts` + `scripts/brazo-test.ts`):
```
L = [0.450, 0.400, 0.350] m        alcance = 1.200 m
tubo PLA:  OD 35 mm, pared 3 mm, ρ = 1240 kg/m³   [beamMass() en brazo.ts]
→ m = [0.16829, 0.14959, 0.13089] kg   (masa del brazo = 0.44877 kg)
carga útil = 0.500 kg en la punta        g = 9.81 m/s²
I_i = m_i·(L_i²/12 + (r_o²+r_i²)/4)      (tubo, respecto a su CoM)
```

**(a) Estático, extendido horizontal — reproduce EXACTAMENTE los objetivos hardcodeados:**

| Articulación | **τ_estático [N·m] (RNEA)** | Objetivo en `evolucion.ts` / `evo-overnight.ts` |
|---|---|---|
| 1 hombro | **8.5275** | `torqueTarget_Nm: 8.5` |
| 2 codo | **4.7106** | `4.7` |
| 3 muñeca | **1.9415** | `1.9` |

⭐ **Coincidencia a 3 cifras. Esto PRUEBA que los tres números contra los que el algoritmo genético optimiza salieron de la estática de pose fija — y de nada más.** El GA está persiguiendo un blanco correcto para un robot que no se mueve.

**(b) La componente que HOY NO EXISTE — inercia pura (sin gravedad):**

| q̈ en las 3 articulaciones | τ_inercial [N·m] |
|---|---|
| 1 rad/s² | `[1.7203, 1.0296, 0.4472]` |
| 2 rad/s² | `[3.4405, 2.0592, 0.8944]` |
| 5 rad/s² | `[8.6013, 5.1480, 2.2361]` |

**(c) El número de diseño real = estático + dinámico:**

| q̈ | τ_total [N·m] | **Subestimación del modelo actual** |
|---|---|---|
| 1 rad/s² | `[10.2477, 5.7402, 2.3887]` | **+20.2 % / +21.9 % / +23.0 %** |
| 2 rad/s² | `[11.9680, 6.7698, 2.8359]` | **+40.3 % / +43.7 % / +46.1 %** |
| 5 rad/s² | `[17.1287, 9.8586, 4.1775]` | **+100.9 % / +109.3 % / +115.2 %** |

A **5 rad/s²** —una aceleración modesta, medio segundo para llegar a 60 rpm— **el par del hombro se DUPLICA**. El factor de seguridad `SF = 2.5` que usa `sizeArm()` se lo come completo la dinámica, y lo que creíamos margen contra incertidumbre de material era en realidad el término que faltaba de la ecuación.

**(d) El caso que remata el argumento — Coriolis/centrífugo, hombro a 60 rpm, codo a 90°:**

```
q  = [0°, −90°, 0°]          (eslabones 2 y 3 colgando verticales)
q̇  = [6.2832, 0, 0] rad/s    (60 rpm en el hombro)
```

| Componente | τ1 | **τ2** | τ3 |
|---|---|---|---|
| Solo gravedad (lo que calcula `armStatics` hoy) | 3.8169 | **0.0000** | 0.0000 |
| Solo producto de velocidad (Coriolis + centrífugo) | −0.0000 | **−8.5305** | −3.5159 |
| **Total** | **3.8169** | **−8.5305** | **−3.5159** |

⭐⭐ **En esa pose el codo aguanta 8.53 N·m puramente por fuerza centrífuga — el mismo orden que el par estático MÁXIMO de todo el brazo — y el modelo actual reporta CERO.** Verificado a mano: la carga de 0.5 kg gira a radio 0.4925 m con ω = 6.2832 rad/s → `a_c = ω²·r = 19.44 m/s²`, casi **2 g**, que a 0.75 m de brazo de palanca da −6.66 N·m; sumando eslabones 2 y 3 da −8.53 ✔.

**Este es el argumento completo del pliego en una tabla.** No es que falte precisión: falta un término entero.

**Criterio de aprobación del gate:** `|τ_RNEA(q,0,0) − jointTorques(spec)|` de `brazo.ts` debe coincidir a < 1e-3 N·m en la pose extendida (compatibilidad hacia atrás con el módulo existente), Y `τ_RNEA` debe ser distinto de cero en el caso (d) donde el módulo actual da cero.

### 5.9 GATE 8 — barrido del espacio de trabajo (¿cuál es la PEOR pose?)

Barrido estático de 73³ = 389,017 poses en `q ∈ [−π, π]³`:
```
|τ1| máximo = 8.5275 N·m  en q = [±180°, 0°, 0°]
```
**La peor pose estática ES el brazo extendido horizontal** — que es la que `armStatics` ya asume, y por eso el modelo actual acierta en estática. Confirmado por barrido exhaustivo, no por intuición.

⭐ **Y eso es justo lo que hace peligroso el hueco:** el modelo estático es *correcto y completo dentro de su alcance*, así que nada en el sistema grita que falta algo. El error no se manifiesta como un número raro; se manifiesta como un reductor que se rompe en el prototipo.

### 5.7 GATE 6 — cinemática directa de la pata de hexápodo [H] Tabla 17.1

Los parámetros DH reales del proyecto del libro (convención estándar: `A_i = Rz(q_i)·Tz(d_i)·Tx(a_i)·Rx(α_i)`):

| i | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **a_i [m]** | 0.071 | 0.104 | 0.048 | 0.041 |
| **d_i** | 0 | 0 | 0 | 0 |
| **α_i** | π/2 | 0 | 0 | −π/2 |
| **qlim** | (−2π/9, 2π/9) | (−π/2, π/2) | (−π/2, π/2) | (−π/2, π/2) |

**Valores de referencia calculados:**

| q [rad] | p_EE [m] |
|---|---|
| `[0, 0, 0, 0]` | **`[0.264000, 0.000000, 0.000000]`**, con `R = I₃` |
| `[0, −π/2, 0, 0]` | **`[0.071000, 0.000000, −0.193000]`** |
| `[π/9, −π/4, π/4, −π/4]` | **`[0.208171, 0.075768, −0.102530]`** |

**Alcance máximo** = Σ a_i = **0.264 m** ✔ (coincide exactamente con `p` en q=0, que es la prueba de que la cadena está bien montada).

**Criterio de aprobación:** `‖p_calculado − p_referencia‖ < 1e-6 m` en los 3 casos.

⭐ **Bonus del cliente — el test de validación de IK que él mismo prescribe:**
> **[H] §17.3.3.3:** *"**Validate your inverse kinematics algorithm.** Validation can occur by running through the workspace of the leg and **comparing outputs from your direct and inverse kinematic solutions**."*
> **Gate 6b (round-trip):** para N poses aleatorias dentro de `qlim`, `‖FK(IK(FK(q))) − FK(q)‖ < tol`. Nótese que NO se compara `q` contra `IK(FK(q))` — porque hay VARIAS soluciones válidas. Se compara en el espacio de la POSE. Un implementador que compare ángulos va a "fallar" tests correctos.

### 5.8 GATE 7 — la grúa de contenedores [S] §2, Ejemplo 1

Carro + péndulo de masa puntual, 2 GDL `q = (x, φ)`. Ecuación de referencia:
```
[[ m         , m·l·cos φ ]] [ ẍ ]   [ Q_x + m·l·φ̇²·sin φ ]
[[ m·l·cos φ , m·l²      ]] [ φ̈ ] = [ Q_φ − m·g·l·sin φ  ]
```
⭐ **La pregunta trampa que el propio autor deja abierta:**
> **[S] §2.1:** *"Note the mass matrix being **singular at φ = 0 + kπ**, can you explain this in physical terms?"*

**Respuesta (y por qué es un gate y no una curiosidad):** con el péndulo colgando vertical, un impulso horizontal instantáneo en el carro **no puede** cambiar la velocidad angular del péndulo al primer orden — la masa está directamente debajo del pivote. La matriz de masa **pierde rango**, y `H` deja de ser definida positiva.

**Este caso pertenece al gate porque es un CONTRAEJEMPLO al axioma A5/[F] §2.3.1** (*"H is symmetric, positive-definite"*). Featherstone dice positiva definida para **árboles cinemáticos con masas distribuidas**; en cuanto metes masas puntuales o coordenadas mal elegidas, se degenera. **Requisito:** el módulo debe verificar `cond(H)` en cada paso y alertar, no invertir a ciegas. Es la manifestación concreta del `O(n⁴)` de mal condicionamiento de [F] §2.7.5.

---

## 6. ITERACIONES Y JUICIOS HUMANOS

### 6.1 Lo que se decide con CRITERIO, no con fórmula

| Decisión | Qué la hace no-automatizable | Cita |
|---|---|---|
| **Cuál de las N soluciones de IK usar** | Los criterios compiten: mínima rotación vs. mínimo par vs. evitar obstáculo. No hay óptimo universal. | [H] §10.4.3 *"One unique solution can be chosen with a particular criterion..."* |
| **Serial vs. paralelo** | Trade-off entre alcance/simplicidad y rigidez/velocidad/carga. Depende de la tarea, no del cálculo. | [H] §10.3 |
| **La convención de nombres de archivos** | *"the first thing is to decide on a naming convention for all the files"* — antes de modelar nada. | [H] §12.7 |
| **La estructura de referencias del ensamble** | *"considerable planning is required to ensure that the model, features and files are properly structured to avoid problems as the model evolves"* | [H] §12.6 |
| **Qué norma aplicar** | *"it is important to refer to the standards in your country to see which one is preferred"* — repetido para proyección, escalas, tamaño de hoja. El libro se niega a dar una regla universal. | [H] §12.8 |
| **La escala de la matriz de decisión** | *"For the scoring system, you can choose different systems"* (1–5, 5 = bueno). La asigna el equipo humano. | [H] §3.3.4.1 |
| **Elección de proceso de manufactura** | En el hexápodo: PLA/FDM para prototipo *"because of their low cost... and the process is simple"*, pero SLS-Nylon 12 para el final, **y SLA para la cubierta específicamente por `"the almost transparent look"`** — criterio estético explícito. | [H] §12.13 |
| **El factor de exploración vs. explotación** | En RL: *"A higher [β] yields a higher tendency to explore"*. Es una perilla, no un resultado. | [H] §15 |

### 6.2 Lo que se REHACE — casos documentados

**⭐ El caso del hexápodo (el más valioso del libro, [H] §12.13):**
> *"The tests only found one issue with the design, where **the bolts around the joints would unscrewing themselves**."*

Ni el CAD, ni la verificación de ajuste entre partes, ni el FEA (estático y dinámico) predijeron el auto-aflojamiento vibratorio. **Lo encontró el robot caminando.** El rediseño consecuente: agregar baleros en las articulaciones → nueva iteración completa de CAD + planos + manufactura.

**El ciclo de prototipado es explícitamente oscilatorio:**
> **[H] §3.3.3 (Dow et al. 2009):** *"Practices **oscillate** between creation and feedback: creative hypotheses lead to prototypes, leading to open questions, leading to **observations of failures**, leading to new ideas and so on."*

**Y la sintonía del PID es iterativa por construcción, no por torpeza:**
> **[H] §8.4.1.4:** *"PID tuning is a **highly coupled and iterative procedure**."*

### 6.3 El elefante en la sala — el software no sustituye al ingeniero

Los tres clientes lo dicen de formas distintas:
- **[F] §2.2.13:** *"This is the recommended approach whenever **human productivity is more important than computational efficiency**."* — el autor del algoritmo más eficiente del campo te dice que empieces con el lento.
- **[H] §12.6:** el modelado paramétrico *"requires specialised operators with expert skills and knowledge that takes considerable time and training to acquire"*.
- **[H] §3.3.1:** *"you need to learn to put yourself into the users' shoes and see things 'with a fresh set of eyes'"*.

---

## 7. BRECHA / OPORTUNIDAD — EL MÓDULO QUE CIERRA EL LAZO

### 7.1 Dónde estamos exactamente (inventario verificado del repo)

| Etapa del proceso a mano | La Forja hoy | Archivo |
|---|---|---|
| [0] Especificación de tarea | ⚠️ parcial | — |
| [1] Espacio de trabajo | ⚠️ solo `reach` y `workspace()` planar 2D | `src/forja/mech/armgen.ts` |
| [2] Topología / DOF | ✅ 3 eslabones + `grublerMobility()` | `src/forja/mech/armgen.ts` |
| [3] Dimensionado de eslabones | ✅ `beamMass`, `armKinematics`; ❌ **sin DH 3D, sin `qlim`** | `src/forja/mech/brazo.ts` |
| [3b] Cinemática | ⚠️ **FK planar 2D solamente**; ❌ FK 3D, ❌ **IK**, ❌ **Jacobiano**, ❌ singularidades | `src/forja/mech/armgen.ts:forwardKinematics` |
| **[4] Trayectoria → dinámica inversa → τ_i(t)** | ❌ **EL HUECO** — `dinamica.ts` es **estática pura pese al nombre** | `src/forja/mech/dinamica.ts` |
| [5] Actuadores y reductores | ⚠️ `cycloidalCapacity` es un **proxy de orden de magnitud** `T ≈ κ·N·t·R²·σ` con κ=0.04 *"calibrable con el print"* | `src/forja/mech/brazo.ts` |
| [6] Control | ❌ | — |
| [7] Seguridad | ❌ | — |
| [8] Prototipo físico | ✅ print-in-place, primer print 10/10 | — |

**Y hay tres piezas que ya existen y que el módulo nuevo debe REUSAR, no reinventar:**
- **RK4 lagrangiano de péndulo doble ya implementado**: `src/lib/physics/mech.ts` → `dpDerivatives`, `dpStep`, `dpEnergy`. **Es la contraparte independiente del GATE 4 (§5.5)** — dos implementaciones distintas de la misma física que deben coincidir.
- **`grublerMobility()`** ya existe en `armgen.ts` (los libros no la dan; [F] §2.6.1 da la versión numérica `mobility = n − rank(L)`, que la generaliza a lazos cerrados).
- **Todo el tribunal del GA**: `factor-seguridad.ts`, `ensamble.ts`, `cojinete-continuo.ts`, `contacto-conforme.ts`, `printinplace.ts`.

### 7.1b El diagnóstico, con nombre y apellido

**El bug de fondo no es que falte dinámica. Es que `evolucion.ts` optimiza contra un número TECLEADO.**

```ts
// src/forja/mech/evolucion.ts
export const DEFAULT_PROBLEM: Problem = { torqueTarget_Nm: 8.5, rpmIn: 200, ... };
// scripts/evo-overnight.ts  →  hombro 8.5, codo 4.7, muñeca 1.9
```

En §5.6(a) demostramos que esos tres números **son exactamente la estática de pose extendida** (8.5275 / 4.7106 / 1.9415). O sea: el lazo *casi* está cerrado — alguien hizo la cuenta a mano una vez y la escribió como constante. **Lo que falta no es la conexión: es el término dinámico y que la conexión sea VIVA.**

Tres consecuencias medidas, no supuestas:
1. A 5 rad/s² el requisito del hombro **se duplica** (17.13 vs 8.53 N·m) → el `SF = 2.5` de `sizeArm()` se evapora.
2. Con el codo a 90° y el hombro a 60 rpm, el codo ve **8.53 N·m de puro centrífugo** donde el modelo dice **0**.
3. `torqueTarget_Nm` es un escalar. El requisito real es `τ_pico` **y** `τ_rms` **y** `ω_max` **y** el ciclo de trabajo — cuatro números, no uno. `cycloidalCapacity` solo puede responder al primero.

**En una frase:** tenemos la geometría arriba y el fierro abajo, y entre las dos pasa **una constante**, no una fuerza.

### 7.2 El módulo propuesto: `src/forja/mech/robot*` — la cadena tarea → τ

> Vive **junto a** `brazo.ts`, `cycloidal.ts`, `evolucion.ts`, no en un directorio nuevo. El acoplamiento
> con el GA es el punto, no un efecto secundario.

```
┌─────────────────────────────────────────────────────────────────────┐
│  mech/robot-modelo.ts  El MODELO de 4 componentes de [F] §2.4       │
│    RobotModel = {                                                    │
│      NB, parent: p(i)[], jtype: ('R'|'P')[],                        │
│      XL: SE3[],            // transformada fija del eslabón          │
│      I:  SpatialInertia[], // (m, c, Icm) → 10 params por eslabón    │
│      qlim: [min,max][],    // ⭐ va AQUÍ, no en un validador aparte  │
│      dh?: { a, d, alpha, theta }[]  // conveniencia → genera XL      │
│    }                                                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               ↓
┌──────────────────────────────┴──────────────────────────────────────┐
│  mech/espacial.ts     Álgebra de vectores espaciales [F] §2.2        │
│    S(p), Xrot, Xtrans, spatialInertia, crm, crf, XtIX               │
│    ⚠️ Matrices 6×6 DENSAS en v1. El autor lo recomienda.             │
└──────────────────────────────┬──────────────────────────────────────┘
                               ↓
┌──────────────────────────────┴──────────────────────────────────────┐
│  mech/rnea.ts        ⭐ EL CORAZÓN — Tabla 2.6 de [F] ← EMPIEZA AQUÍ  │
│    rnea(model, q, qd, qdd, fext?) → tau[]                           │
│    jsim(model, q) → H          via columnas del RNEA (§5.3)          │
│    bias(model, q, qd) → Cq̇+τg  = rnea(q, qd, 0)   [F] (2.84)        │
│    fd(model, q, qd, tau) → qdd  = H⁻¹(τ − bias)                     │
│    ✔ regresión: rnea(q,0,0) ≡ brazo.ts:jointTorques()   (§5.6a)     │
└──────────────────────────────┬──────────────────────────────────────┘
                               ↓
┌──────────────────────────────┴──────────────────────────────────────┐
│  mech/robot-cinematica.ts  FK 3D (DH) + Jacobiano + IK               │
│    fk(model,q)→SE3 · jacobian(model,q)→6×n                          │
│    ikNumerica(...)  ← Newton-Gauss con QR, NO pseudoinversa [H]      │
│    detectarSingularidad(J) → {tipo:'hombro'|'codo'|'muñeca', σ_min}  │
│    (hoy solo hay FK PLANAR 2D en armgen.ts; IK y J no existen)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               ↓
┌──────────────────────────────┴──────────────────────────────────────┐
│  mech/trayectoria.ts  ⚠️ EXTENSIÓN DECLARADA (no está en los libros) │
│    perfil trapezoidal / S-curve con límites v_max, a_max, j_max      │
│    → muestrea q(t), q̇(t), q̈(t) a paso fijo                          │
│    ⚠️ El tipo de configuración se fija UNA VEZ para toda la          │
│       trayectoria, no punto por punto [H] §10.4.3                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               ↓
┌──────────────────────────────┴──────────────────────────────────────┐
│  mech/dimensionar.ts  ⭐ EL CIERRE DEL LAZO                          │
│    dimensionar(model, trayectoria, carga) → por articulación:        │
│      τ_pico, τ_rms, ω_max, P_pico, ciclo de trabajo                  │
│    → alimenta evolucion.ts:Problem  (¡adiós torqueTarget_Nm: 8.5!)   │
│    ⚠️ El VEREDICTO del reductor sale de pliego-shigley.md,           │
│       NO de estos tres libros (ver §3.3 y §9)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.3 ¿QUÉ CONSTRUIRÍA PRIMERO? — `src/forja/mech/rnea.ts` + su gate, y nada más

**Un solo archivo, con las verificaciones de §5.2–5.6 en verde. Sin UI, sin trayectorias, sin IK.**

Siguiendo el patrón de la casa (`reference_forja_gate.md`, el carril Kazmer), son **5 artefactos**:

| # | Artefacto | Copiado de |
|---|---|---|
| 1 | `src/forja/mech/rnea.ts` — módulo puro, header citando [F] Tabla 2.6 | `src/forja/mold/feed.ts` |
| 2 | `src/forja/mech/rnea.test.ts` — vitest al lado (`vitest.config.ts` incluye `src/**/*.test.ts`) | `src/forja/mech/dinamica.test.ts` |
| 3 | `scripts/featherstone-rnea-test.cjs` — gate contra el libro con `T(nombre, got, want, tolPct)` y `process.exit(fail===0?0:1)` | `scripts/kazmer-canales-test.cjs` |
| 4 | Una entrada en `SUITES` de `scripts/forja-gate.cjs` (grupo `unit` o nuevo grupo `robot`) | ídem |
| 5 | `reg({ id:'robot.rnea', domain:'robot', eq:'[F] Tabla 2.6', status:'implementado', summary:'τ = ID(q,q̇,q̈)', run:(p)=>rnea(...) })` en `src/forja/commands/registry.ts` — **primer comando del dominio `robot`** (hoy los 15 dominios son todos de molde) | `registry.ts:131` (`clamp.force`) |

**Las seis razones, en orden:**

1. **Es el eslabón faltante literal, y ya sabemos exactamente cuánto vale.** §5.6 mide el hueco: **+20 % a +115 %** de par según la aceleración, y **8.53 N·m donde hoy se reporta 0**.

2. **Es el único módulo con verificación INDEPENDIENTE de la fuente.** Los cinco casos de §5.2 tienen referencia derivable a mano en tres líneas de física de prepa: `τ1 = 19.62 N·m` sale de `2 kg × 9.81 × 1.0 m`, no de creerle al libro. Los gates de Kazmer dependen de haber leído bien la página; **este no**.

3. **Trae su propio test de regresión gratis.** `rnea(model, q, 0, 0)` debe reproducir `jointTorques()` de `brazo.ts` a < 1e-3 N·m (§5.6a: 8.5275 / 4.7106 / 1.9415). **El módulo nuevo se valida contra el viejo**, y luego lo supera.

4. **Cabe en un día.** Tabla 2.6 son 20 líneas. El álgebra espacial son 6 funciones. `Φ = (0,0,1,0,0,0)` constante para revolutas, `Φ̇° = 0`. La versión 6×6 densa es la que recomienda el propio autor [F] §2.2.13.

5. **Desbloquea todo lo demás gratis:** `H` = RNEA corrido n+1 veces (§5.3). `Cq̇+τ_g = rnea(q,q̇,0)` [F] (2.84). Dinámica directa = `H⁻¹(τ−bias)`. El gate de anti-simetría (§5.4) sale de esos dos. **Un algoritmo, cinco capacidades.**

6. **Y el argumento de La Forja:** el gate de energía (§5.5) es una **simulación** del péndulo doble cayendo, con `1.855e-12 J` de deriva de telemetría dura para el overlay (`feedback_telemetria_videos_sim.md`) — y **cruzable contra `dpStep`/`dpEnergy` que ya existen en `src/lib/physics/mech.ts`**. Video el mismo día (`feedback_siempre_videos.md`), con dos implementaciones independientes coincidiendo.

**SEGUNDO — `dimensionar.ts`, solo estático.** `rnea(q,0,0)` barriendo el espacio de trabajo → mapa de par por pose (§5.9 ya lo corrió: 389,017 poses, peor caso confirmado). Y el cambio de una línea que cierra el lazo de verdad:
```ts
// evolucion.ts — ANTES:
export const DEFAULT_PROBLEM = { torqueTarget_Nm: 8.5, ... };
// DESPUÉS:
export const problemFromTask = (arm, task) => ({ torqueTarget_Nm: peakTorque(arm, task), ... });
```
**Ese diff es el módulo entero justificándose.** El GA deja de perseguir una constante y empieza a perseguir la tarea.

**TERCERO — `trayectoria.ts`**, con perfil temporal, para pasar de τ estático a `τ_pico` y `τ_rms`. Es la parte **sin respaldo bibliográfico** (§3.8) y va al final a propósito: sacas el 80 % del valor con el 20 % del riesgo de inventar.

**CUARTO — el veredicto del reductor**, y solo cuando ya tengamos fuente (§3.3, §9). Hoy `cycloidalCapacity` con κ=0.04 *"calibrable con el print"* es honesto sobre ser un proxy; convertirlo en veredicto sin fuente sería exactamente el pecado que `feedback_kazmer_no_inventar.md` prohíbe.

### 7.4 Requisitos NO negociables del módulo (todos con su §)

| # | Requisito | § |
|---|---|---|
| R1 | `qlim` vive en `RobotModel`, no en un validador aparte | [H] §17.3.2 |
| R2 | Doble precisión en todos los pasos; reportar `cond(H)` | [F] §2.5.3, §2.7.5 |
| R3 | Numeración regular obligatoria: `p(i) < i`, validado al construir | [F] §2.4.1 |
| R4 | El campo `a_i` del RNEA **NO se expone como aceleración física** (lleva −a_g dentro) | [F] §2.5.1 |
| R5 | IK numérica con QR/Householder; **nunca** `(JᵀJ)⁻¹Jᵀ` explícita | [H] §10.4.5 |
| R6 | IK numérica con múltiples semillas; devolver TODAS las ramas, filtradas por `qlim` | [H] §10.4.5, §10.4.3 |
| R7 | El tipo de configuración es restricción de la trayectoria COMPLETA | [H] §10.4.3 |
| R8 | Detección de singularidad = alerta de DISEÑO (con nombre: hombro/codo/muñeca), no solo `det≈0` | [H] §10.4.6 |
| R9 | Los lazos cerrados (cicloidal) usan §2.6, no §2.5; declarar restricciones redundantes fuera de plano | [F] §2.6, §2.6.1 |
| R10 | El generador de trayectoria temporal se marca **[EXTENSIÓN LA FORJA]** en código y en UI | §3.8 de este pliego |
| R11 | Todo veredicto de reductor cita su fuente (`pliego-shigley.md`), nunca "estos libros" | §3.3 de este pliego |
| R12 | El gate de energía se normaliza contra `T_max`, no contra `E₀` | §5.5 de este pliego |

---

## 8. ⭐ LOS 10 DETALLES QUE UNA MÁQUINA LINEAL SE SALTARÍA

**⭐ 1 — El truco de la gravedad: se pone acelerando la BASE hacia arriba, y con eso los `a_i` intermedios dejan de ser físicos.**
[F] §2.5.1: *"a_i is **not the true acceleration** of link i, but the sum of its true acceleration and −a_g."* Un implementador lineal añadiría `m·g` como fuerza externa a cada eslabón (funciona, pero es más lento y más código), o —peor— graficaría `a_i` como telemetría de aceleración y publicaría un número mentiroso. **El mismo truco aparece independientemente en [H] §10.6.2**, lo que confirma que es la práctica canónica y no una idiosincrasia.

**⭐ 2 — El O(n³) NO domina hasta n ≈ 60, así que el argumento "usa RNEA porque es O(n)" es FALSO para nuestros robots.**
[F] §2.5.3: *"even in the worst case, the n³ term has a **small coefficient**, and **does not dominate until approximately n = 60**."* Para n=3 (nuestro brazo) o n=4 (pata de hexápodo), la complejidad asintótica es irrelevante. La razón real para usar RNEA es **la dirección del cálculo**: te da τ por articulación, que es el número de diseño. Una máquina que optimice por big-O elegiría bien por la razón equivocada — y luego no sabría defender la decisión cuando alguien proponga CRBA.

**⭐ 3 — La versión 3-D del RNEA es MÁS RÁPIDA que la espacial porque `v_i` se cancela y no hay que calcularla.**
[F] §2.5.1: *"vi **cancels out** of the equation of motion, and therefore **does not need to be calculated**."* Contraintuitivo hasta lo absurdo: la notación "elegante y compacta" de 6-D es ligeramente **más lenta** que expandirla a 3-D para el caso restringido de revolutas en z. La elegancia cuesta. Una máquina lineal asumiría que la abstracción superior siempre gana.

**⭐ 4 — Las singularidades se eliminan CON GEOMETRÍA y CON LÍMITES MECÁNICOS, no con software.**
[H] §10.4.6: la singularidad de hombro *"is **usually avoided by carefully designing the manipulator**"*; la de codo plegado *"**mechanical limits normally prevents** this situation from occurring"*. Un implementador construiría un "evasor de singularidades" en tiempo real (que es lo que sale en los papers) sin darse cuenta de que el cliente resuelve el 90% del problema en la mesa de dibujo, **antes de que exista el controlador**. Y hay una tercera capa que se salta: las singularidades son **fronteras entre tipos de configuración**, así que evitarlas y mantener el tipo de configuración son **el mismo requisito**.

**⭐ 5 — Los mecanismos PLANARES son siempre sobre-restringidos, y sus fuerzas fuera de plano son INDETERMINADAS.**
[F] §2.6: *"Both these mechanisms are planar, and are therefore **overconstrained**. As a result, the out-of-plane components of the joint constraint forces are **indeterminate**. This kind of indeterminacy has **no effect on the motions**... but it does **complicate the calculation** of their dynamics."* Y el remedio es *quitar filas de L a mano* ([F] §2.6.1). **Nuestros cicloidales son exactamente esto.** Una máquina lineal metería el sistema completo a un solver de mínimos cuadrados, obtendría fuerzas de restricción numéricamente basura pero movimiento correcto, y no sabría cuáles de sus números creer.

**⭐ 6 — La matriz de masa PUEDE ser singular, y cuando pasa hay una razón física exacta.**
[S] §2.1, grúa de contenedores: *"Note the mass matrix being **singular at φ = 0 + kπ**, can you explain this in physical terms?"* El autor deja la pregunta abierta a propósito. La respuesta —con el péndulo vertical, un impulso horizontal no puede cambiar φ̇ al primer orden— es un contraejemplo directo al *"H is symmetric, positive-definite"* de [F] §2.3.1. Una máquina lineal leería el axioma en un libro, lo tomaría como invariante, e invertiría H a ciegas. **Requisito derivado: `cond(H)` se reporta, no se asume.**

**⭐ 7 — El *drift* de restricción NO se arregla achicando el paso.**
[S] §1.5: *"note 1 will remain **since we do not use the constraint itself but twice differentiated** with respect to time."* Sus tres observaciones son quirúrgicas: las articulaciones se abren, los huecos **disminuyen** con Δt, pero **nunca desaparecen**. Y el estado a los 0.5 s cambia con Δt. Una máquina lineal ve el error bajar de 0.1 a 0.01 a 0.001, extrapola a cero, y **está equivocada**: es un sesgo estructural, no error de truncamiento. La salida es arquitectónica (coordenadas independientes / TMT / Baumgarte), no de tolerancia.

**⭐ 8 — El propio autor del algoritmo más eficiente te dice que lo implementes de la forma LENTA primero.**
[F] §2.2.13: *"This is the **recommended approach** whenever human productivity is more important than computational efficiency"* — refiriéndose a matrices 6×6 densas sobre una librería de matrices existente. La tabla de estructuras compactas `(m;h;Ī)`, `(R;p)` que da ahorros de 1.5× a 6× está en la MISMA página, y aun así la recomendación es no usarla al principio. Una máquina lineal implementaría la versión optimizada desde el minuto uno, porque está ahí, y se pasaría el doble de tiempo depurando aritmética compacta sin un baseline correcto contra el cual comparar.

**⭐ 9 — Herath NO habla de reductores, backlash, ni curvas par-velocidad. En ningún capítulo. Ni una vez.**
Verificado por grep sobre las 22,488 líneas del libro completo. Es el hallazgo negativo más importante de esta entrevista, y una máquina lineal lo habría alucinado: es tan "obvio" que un libro de fundamentos de robótica hable de backlash que el riesgo de inventarlo es altísimo. **El eslabón "τ requerido → ¿aguanta mi cicloidal?" no tiene fuente en la bibliografía de robótica que tenemos.** Se cierra con Shigley o con catálogo de fabricante, y hay que decirlo en voz alta en el pliego en vez de escribir una regla plausible sin cita. (Igual para: rigidez torsional, deflexión de eslabón, primera frecuencia natural, back-drivability, factores de servicio, corriente de stall, ciclo de trabajo.)

**⭐ 10 — Una solución de seguridad DEMASIADO restrictiva es en sí misma un riesgo, porque la gente la burla.**
[H] §14: *"you should **avoid a 'one-size-fits-all' solution**, as it may be too restrictive for the application, ultimately leading to **frequent bypass of some safeguards** to accomplish a task."* El diseño de seguridad óptimo **no es el más restrictivo posible**. Una máquina lineal optimizaría monótonamente hacia "más seguro", que es exactamente el error. Va con dos hermanos del mismo capítulo: (a) el análisis inicial se hace asumiendo **cero** mitigaciones y operador **no calificado** *a propósito* (*"You can see this as a worst case scenario"*), aunque en la realidad ya haya medidas; y (b) la taxonomía misma se mueve bajo tus pies — el *safety-rated monitored stop* deja de ser modo colaborativo en ISO 10218-1:2022, y el comité está debatiendo cambiar *"shall"* por *"should"* en el límite de movimiento sobre los hombros. **La norma no es una constante; es un objeto versionado.**

---

## 9. QUÉ **NO** ESTÁ EN ESTOS LIBROS (declaración de alcance, para no inventar)

Igual que hicimos con Kazmer (`feedback_kazmer_no_inventar.md`), aquí va la lista explícita de lo que un implementador NO puede citar de este pliego. Todo verificado por `grep` sobre el texto extraído completo.

| Tema | Estado | De dónde tiene que salir |
|---|---|---|
| Backlash, harmonic drive, cicloidal, planetario, correas | ❌ **cero apariciones en [H]** | `pliego-shigley.md` / catálogo de fabricante |
| Curva par-velocidad, corriente de stall, ciclo de trabajo, factores de servicio | ❌ **cero apariciones** | Hoja de datos del motor / Shigley |
| Rigidez torsional, back-drivability | ❌ **cero apariciones** | Shigley / FEA |
| Deflexión de eslabón, primera frecuencia natural, rigidez vs. peso con números | ❌ **cero apariciones** | `pliego-fea.md` / `pliego-shigley.md` |
| Perfil trapezoidal / S-curve, jerk, splines, interpolación temporal | ❌ **no está en [H] cap. 8** | **EXTENSIÓN LA FORJA declarada** |
| RRT (desarrollado), campos potenciales, dynamic window | ❌ solo referencia bibliográfica a Kuffner & LaValle 2000 | Fuente externa si se necesita |
| Feedforward / computed-torque control | ❌ [F] nombra el uso; nadie da la ley | Fuente externa |
| Números de fuerza/presión de ISO/TS 15066 (N, N/cm², J por región del cuerpo) | ❌ [H] remite a la norma sin transcribirla | ISO/TS 15066 directo |
| Definiciones formales de maximum/restricted/operating space (ISO 10218-1) | ❌ **cero apariciones en [H]** | ISO 10218-1 directo |
| Simulación de contacto / colisión | ⚠️ [F] §2.3.4 da solo el **modelo de impulso** (`Λ·Δv = f′`, `H·Δq̇ = τ′`); [S] §1.4 da la **ley de restitución de Newton** con coeficiente `e`. **No hay detección de colisión ni modelo de fricción de contacto.** | Extensión / fuente externa |
| Grübler / Chebychev-Kutzbach (fórmula de movilidad) | ❌ no aparece; [F] §2.6.1 da `mobility = n − rank(L)`, que es la versión numérica | [F] §2.6.1 sirve |
| Tolerancias de impresión 3D en mm, factores de seguridad numéricos, precios | ❌ **cero en [H] cap. 12** | Fuente externa |

---

## 10. RESUMEN EJECUTIVO — LOS 6 REQUISITOS QUE DEFINEN EL MÓDULO

1. **`robot/rnea.ts` con los 7 gates de §5 en verde, primero. Un día de trabajo, valor inmediato, verificación independiente de la fuente.**
2. **`qlim` y la topología viven en el MODELO** (`p(i) < i` validado al construir), no en capas de validación posteriores. [F] §2.4.1, [H] §17.3.2
3. **La gravedad entra como `a₀ = −a_g`, y los `a_i` intermedios jamás se exponen como aceleración física.** [F] §2.5.1
4. **Matrices 6×6 densas en v1.** La optimización a `(m;h;Ī)`/`(R;p)` es una segunda pasada con benchmark. Lo dice el autor. [F] §2.2.13
5. **Singularidad = alerta de DISEÑO con nombre propio** (hombro / codo / muñeca), y el tipo de configuración es restricción de la trayectoria COMPLETA. [H] §10.4.6, §10.4.3
6. **El veredicto del reductor cita `pliego-shigley.md`, nunca este pliego.** El par requerido lo damos nosotros; si el cicloidal aguanta, lo dice otro libro. Decirlo en la UI. §3.3, §9

---

*Fin del pliego. Valores numéricos de §5 verificados con `scratchpad/rnea_check.py` y `scratchpad/dp2.py` (RNEA espacial vs. forma cerrada 2R, diferencia máx. 4.4e-16). Hallazgos negativos verificados por `grep` sobre el texto extraído completo de los tres documentos.*
