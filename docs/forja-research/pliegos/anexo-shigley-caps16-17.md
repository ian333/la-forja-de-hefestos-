# Shigley caps. 16 y 17 — ENTREVISTA DE REQUISITOS

**Cliente:** el autor de *Shigley's Mechanical Engineering Design* (Budynas/Nisbett, 2024).
Diseña embragues, frenos, volantes, bandas y cadenas **a mano** desde siempre. Nos contrató para
automatizar **SU** proceso, no para inventar uno nuevo.

**Alcance:** cap. 16 "Clutches, Brakes, Couplings, and Flywheels" (§16-1 a §16-12, pp. impresas
847–898) y cap. 17 "Flexible Mechanical Elements" (§17-1 a §17-7, pp. impresas 899–952).
Cap. 18 fuera de alcance.

**Regla de este documento:** todo lo que aparece aquí está en el texto extraído. Donde el cliente
NO da un número, se dice explícitamente **"no aparece en el texto extraído"**. Cada regla lleva su §.

---

## 0. LA FILOSOFÍA DEL CLIENTE (lo que dice antes de cualquier ecuación)

### 0.1 El interés del cliente son CUATRO cosas, en ese orden (§16-1, intro cap. 16)

> "In analyzing the performance of these devices we shall be interested in: ∙ The actuating force
> ∙ The torque transmitted ∙ The energy loss ∙ The temperature rise"
>
> *"Al analizar el desempeño de estos dispositivos nos van a interesar: la fuerza de accionamiento,
> el par transmitido, la pérdida de energía y la elevación de temperatura."*

Y viene la partición del problema, que es **la arquitectura del software**:

> "The torque transmitted is related to the actuating force, the coefficient of friction, and the
> geometry of the clutch or brake. This is a problem in statics, which will have to be studied
> separately for each geometric configuration. However, temperature rise is related to energy loss
> and can be studied without regard to the type of brake or clutch, because the geometry of interest
> is that of the heat-dissipating surfaces." (intro cap. 16)
>
> *"El par transmitido se relaciona con la fuerza de accionamiento, el coeficiente de fricción y la
> geometría. Eso es un problema de estática, y hay que estudiarlo por separado para cada
> configuración geométrica. En cambio, la elevación de temperatura se relaciona con la pérdida de
> energía y se puede estudiar sin importar el tipo de freno o embrague, porque la geometría que
> importa es la de las superficies que disipan calor."*

**Requisito de arquitectura:** un módulo de estática POR GEOMETRÍA (zapata interna, zapata externa,
banda, disco axial, disco caliper, cono) + **UN SOLO** módulo térmico compartido por todos.
El cliente ya nos dijo dónde va la costura.

### 0.2 La taxonomía que el cliente usa para clasificar (intro cap. 16)

Rim con zapatas internas expansibles · rim con zapatas externas contractibles · tipo banda ·
disco o axial · tipo cono · misceláneos.

### 0.3 El procedimiento GENERAL de 3 pasos (§16-1) — es el algoritmo maestro

> "Many types of clutches and brakes can be analyzed by following a general procedure. The procedure
> entails the following tasks:
> ∙ Estimate, model, or measure the pressure distribution on the friction surfaces.
> ∙ Find a relationship between the largest pressure and the pressure at any point.
> ∙ Use the conditions of static equilibrium to find the braking force or torque and the support reactions."
>
> *"Estima, modela o mide la distribución de presión sobre las superficies de fricción. Encuentra una
> relación entre la presión máxima y la presión en cualquier punto. Usa las condiciones de equilibrio
> estático para hallar la fuerza o el par de frenado y las reacciones en los apoyos."*

**Lo que una máquina se saltaría:** el paso 1 no es una ecuación, es un **JUICIO DE MODELADO**.
El propio cliente lo demuestra en el Ex. 16-1 (el tope de puerta): resuelve el MISMO problema con
presión uniforme y luego con presión trapezoidal (modelo de "resortitos"), y compara.

Resultado que él mismo subraya (Ex. 16-1, §16-1):
> "The presumption that the pressure was uniform in part (a) (because the pad was small, or because
> the arithmetic would be easier?) underestimated the peak pressure. Modeling the pad as a
> one-dimensional springset is better, but the pad is really a three-dimensional continuum. A theory
> of elasticity approach or a finite element modeling may be overkill, given uncertainties inherent
> in this problem, but it still represents better modeling."
>
> *"Suponer presión uniforme en (a) —¿porque el pad era chico, o porque la aritmética salía más
> fácil?— SUBESTIMÓ la presión pico. Modelar el pad como un juego de resortes en 1D es mejor, pero
> el pad realmente es un continuo 3D. Elasticidad o elemento finito sería exagerado dadas las
> incertidumbres del problema, pero aun así es mejor modelado."*

Números del ejemplo: presión uniforme → pav = pa = 7.207 psi; modelo trapezoidal → pav = 7.132 psi
pero **pa = 8.83 psi, ~24 % arriba del promedio**. La máquina que solo asume uniforme se equivoca
24 % en el valor que se compara contra p_max del material.

### 0.4 Auto-energizado vs auto-bloqueo — la definición del cliente (§16-1)

> "A brake shoe is self-energizing if its moment sense helps set the brake, self-deenergizing if the
> moment resists setting the brake."
>
> *"Una zapata es AUTO-ENERGIZADA si el sentido de su momento AYUDA a aplicar el freno, y
> auto-desenergizada si el momento se OPONE a aplicarlo."*

Criterio de auto-bloqueo, **independiente del modelo de presión** (§16-1, Ec. f):

    f_cr ≥ (c + ū) / a          ū = distancia del centro de presión al borde derecho del pad

> "The conclusion that a self-acting or self-locking phenomenon is present is independent of our
> knowledge of the normal pressure distribution p(u). Our ability to find the critical value of the
> coefficient of friction f_cr is dependent on our knowledge of p(u), from which we derive ū."
>
> *"La conclusión de que existe auto-acción o auto-bloqueo NO depende de conocer p(u). Lo que sí
> depende de conocer p(u) es poder calcular el valor crítico f_cr, porque de ahí sale ū."*

⭐ Esto es requisito de diseño de software: **la CONDICIÓN cualitativa (¿se auto-bloquea?) y el
VALOR f_cr son dos consultas distintas con distintos requisitos de datos.**

---

## 1. EL PROCESO A MANO, TEMA POR TEMA

### §16-2 — FRENO/EMBRAGUE DE ZAPATA INTERNA EXPANSIBLE (rim, internal expanding)

**Modelo de presión (el corazón del método).** La zapata pivota en A y se acciona en el otro extremo.

> "Since the shoe is long, we cannot make the assumption that the distribution of normal forces is
> uniform. The mechanical arrangement permits no pressure to be applied at the heel, and we will
> therefore assume the pressure at this point to be zero." (§16-2)
>
> *"Como la zapata es larga, NO podemos suponer que la distribución de fuerzas normales sea uniforme.
> El arreglo mecánico no permite aplicar presión en el talón, así que ahí suponemos presión cero."*

Deformación ⊥ al rim = h·Δφ·cos(θ/2) = r·Δφ·sin θ → la presión es **proporcional a sin θ**:

    p = pa · sin θ / sin θa                                             (16-1)

**Características de esa distribución que el cliente enumera explícitamente (§16-2):**
- La distribución es sinusoidal en θ.
- Zapata **corta** (θ1 ≤ θ2 ≤ π/2): la presión máxima **pa ocurre en el extremo de la zapata, θ2**.
- Zapata **larga** (θ1 ≤ π/2 ≤ θ2): la presión máxima **pa ocurre en θa = 90°**.

> "Since limitations on friction materials are expressed in terms of the largest allowable pressure
> on the lining, the designer wants to think in terms of pa and not about the amplitude of the
> sinusoidal distribution that addresses locations off the shoe." (§16-2)
>
> *"Como los límites de los materiales de fricción se expresan en presión máxima permisible del
> forro, el diseñador quiere pensar en pa, NO en la amplitud de la senoide que apunta a lugares
> fuera de la zapata."*

⭐ **Requisito duro:** θa no es un dato del usuario, es **derivado** de la geometría con esa regla de
ramas. Una máquina lineal pediría θa como input y el cliente diría que está mal.

**Ecuaciones del método (§16-2):**

    dN = p·b·r·dθ = (pa·b·r/sin θa)·sin θ·dθ                            (b),(c)
    Mf = (f·pa·b·r / sin θa) ∫[θ1..θ2] sin θ (r − a cos θ) dθ           (16-2)
    MN = (pa·b·r·a / sin θa) ∫[θ1..θ2] sin²θ dθ                         (16-3)
    F  = (MN − Mf)/c        ← rotación que auto-energiza                (16-4)
    F  = (MN + Mf)/c        ← rotación contraria, se pierde el auto-energizado  (16-7)
    T  = f·pa·b·r²(cos θ1 − cos θ2)/sin θa                              (16-6)
    A = ∫ sin θ cos θ dθ = [½ sin²θ] ;  B = ∫ sin²θ dθ = [θ/2 − ¼ sin 2θ]  (16-8)
    Rx = (pa·b·r/sin θa)(A − fB) − Fx ;  Ry = (pa·b·r/sin θa)(B + fA) − Fy   (16-9)  [CW]
    Rx = (pa·b·r/sin θa)(A + fB) − Fx ;  Ry = (pa·b·r/sin θa)(B − fA) − Fy   (16-10) [CCW]

**Regla de auto-bloqueo (§16-2, Ec. 16-5):**
> "if we make MN = Mf, self-locking is obtained, and no actuating force is required. This furnishes
> us with a method for obtaining the dimensions for some self-energizing action. **So to avoid
> self-locking, the dimension a in Figure 16–7 must be such that MN > Mf.**"
>
> *"Si haces MN = Mf obtienes auto-bloqueo y no se requiere fuerza de accionamiento. Eso nos da un
> método para dimensionar buscando algo de auto-energizado. Así que **para EVITAR el auto-bloqueo,
> la dimensión `a` tiene que cumplir MN > Mf**."*

⭐ **`a` (distancia del centro del tambor al pasador) es una VARIABLE DE DISEÑO**, no un dato. El
cliente la usa como perilla para dosificar auto-energizado sin caer en auto-bloqueo.

**Convención de ejes (§16-2) — regla que rompe implementaciones ingenuas:**
> "the reference system always has its origin at the center of the drum. The positive x axis is taken
> through the hinge pin. The positive y axis is always in the direction of the shoe, **even if this
> should result in a left-handed system**."
>
> *"El origen SIEMPRE va en el centro del tambor. El eje x positivo pasa por el pasador. El eje y
> positivo SIEMPRE va hacia la zapata, aunque eso produzca un sistema izquierdo."*

**Las 4 suposiciones que el cliente declara (§16-2) — son la hoja de limitaciones del software:**
1. La presión en cualquier punto es proporcional a la distancia al pasador, cero en el talón.
   > "This should be considered from the standpoint that pressures specified by manufacturers are
   > averages rather than maxima."
   > *"Hay que verlo tomando en cuenta que las presiones que especifican los fabricantes son
   > PROMEDIOS, no máximas."* ⭐
2. Se despreció la fuerza centrífuga. En frenos las zapatas no giran, no hay centrífuga.
   > "In clutch design, the effect of this force must be considered in writing the equations of
   > static equilibrium."
   > *"En diseño de EMBRAGUE, esa fuerza sí hay que considerarla en el equilibrio estático."*
3. La zapata se supone rígida. No lo es; habrá deflexión según carga, presión y rigidez, y la
   distribución real de presión puede diferir.
4. Todo el análisis usa un f que no varía con la presión. En realidad varía con temperatura,
   desgaste y ambiente.

**Práctica de manufactura del forro (§16-2):**
> "It is the usual practice to omit the friction material for a short distance away from the heel
> (point A). This eliminates interference, and the material would contribute little to the
> performance anyway... A good design would concentrate as much frictional material as possible in
> the neighborhood of the point of maximum pressure."
>
> *"La práctica usual es OMITIR material de fricción un tramo corto a partir del talón (punto A).
> Eso elimina interferencia, y de todos modos ese material aportaría poco... Un buen diseño
> concentra tanto material de fricción como se pueda cerca del punto de máxima presión."*

Por eso el forro va de θ1 a θ2, **no de 0 a θ2**. Zapata flotante (pasador móvil para dar presión
extra en el talón): mencionada, **no tratada en el libro**, "aunque su diseño sigue los mismos
principios generales".

**Iteración documentada en el Ex. 16-2** (freno de 300 mm, dos zapatas, misma F, molded asbestos
f = 0.32, p_lim = 1000 kPa, b = 32 mm):
1. Identificar cuál zapata es auto-energizada (la derecha).
2. Fijar pa = p_max del material **en esa zapata** (es la que llega primero al límite) → F = 2.28 kN.
3. **Regresar** a la zapata izquierda con esa MISMA F, y despejar SU pa (sale 443 kPa, no 1000).
4. Sumar pares: T = 366 + 162 = 528 N·m.

⭐ **Este ida-y-vuelta es el requisito de flujo más importante de §16-2:** la fuerza la dicta la
zapata auto-energizada; la otra zapata queda con la presión que le toque. **No se pueden resolver
las dos zapatas independientemente.**

**Rediseño que el cliente sugiere al final del Ex. 16-2 (juicio humano puro):**
> "If the left-hand shoe were turned over so as to place the hinge pin at the top, it could apply
> the same torque as the right-hand shoe. This would make the capacity of the brake (2)(366) = 732
> N·m instead of the present 528 N·m, a 30 percent improvement. In addition, some of the friction
> material at the heel could be eliminated without seriously affecting the capacity... This change
> might actually improve the overall design because the additional rim exposure would improve the
> heat-dissipation capacity."
>
> *"Si volteas la zapata izquierda para poner el pasador arriba, aplicaría el mismo par que la
> derecha: 732 N·m en vez de 528, **30 % de mejora**. Además, se podría quitar algo de forro en el
> talón sin afectar seriamente la capacidad... y el cambio podría mejorar el diseño en conjunto,
> porque **más rim expuesto mejora la disipación de calor**."*

⭐ Aquí el cliente conecta TRES dominios en una sola frase: cinemática (voltear la zapata),
material (quitar forro) y térmica (más rim expuesto). Una máquina lineal solo optimiza el par.

---

### §16-3 — ZAPATA EXTERNA CONTRACTIBLE (external contracting)

**Mecanismos de accionamiento que el cliente enumera:** solenoides; palancas, eslabonamientos o
dispositivos de codo (toggle); eslabonamientos con resorte; hidráulicos y neumáticos.

> "Omitting the operating mechanisms from consideration allows us to concentrate on brake and clutch
> performance without the extraneous influences introduced by the need to analyze the statics of the
> control mechanisms." (§16-3)
>
> *"Dejar fuera los mecanismos de accionamiento nos permite concentrarnos en el desempeño del freno
> o embrague sin las influencias ajenas de analizar la estática de los mecanismos de control."*

⭐ **Requisito de frontera del sistema:** el software calcula F en el extremo de la zapata. El
eslabonamiento que produce F es OTRO módulo (§3-1 del libro). No mezclarlos.

**Ecuaciones (§16-3):** Mf y MN son las **mismas** (16-2) y (16-3) que la zapata interna. Cambia el
signo del acoplamiento:

    F  = (MN + Mf)/c   ← rotación CW (Fig. 16-11), NO hay auto-energizado                 (16-11)
    Rx = (pa·b·r/sin θa)(A + fB) − Fx ;  Ry = (pa·b·r/sin θa)(fA − B) + Fy                (16-12)
    F  = (MN − Mf)/c   ← rotación CCW, **aquí sí existe auto-energizado**                 (16-13)
    Rx = (pa·b·r/sin θa)(A − fB) − Fx ;  Ry = (pa·b·r/sin θa)(−fA − B) + Fy               (16-14)

**Advertencia de embrague externo (§16-3):**
> "when external contracting designs are used as clutches, the effect of centrifugal force is to
> **decrease** the normal force. Thus, as the speed increases, a larger value of the actuating force
> F is required."
>
> *"Cuando los diseños de contracción externa se usan como EMBRAGUES, la fuerza centrífuga
> DISMINUYE la fuerza normal. Al subir la velocidad se requiere MÁS fuerza de accionamiento F."*

⭐ Signo opuesto al del embrague interno expansible (§16-2, que se BENEFICIA de la centrífuga:
"Expanding-ring clutches benefit from centrifugal effects"). La máquina que trate la centrífuga con
un solo signo se equivoca en una de las dos familias.

**Caso especial: zapata pivotada simétrica (Fig. 16-12).** El cliente cambia de MODELO DE PRESIÓN:
razona el desgaste como una fresa avanzando en x → w(θ) = w0 cos θ, y con w = KPVt (Ec. 12-38):

    p(θ) = pa cos θ                                                       (c) de §16-3

Y coloca el pivote donde Mf = 0:

    a = 4r·sin θ2 / (2θ2 + sin 2θ2)                                       (16-15)
    Rx = (pa·b·r/2)(2θ2 + sin 2θ2) = N                                    (16-16)
    Ry = (pa·b·r·f/2)(2θ2 + sin 2θ2) = fN                                 (16-17)
    T  = a·f·N                                                            (16-18)

**Las DOS razones que el cliente da para poner el pivote ahí (§16-3):**
> "First, this ensures that reaction Ry is at the correct location to establish symmetrical wear.
> Second, a cosinusoidal pressure distribution is sustained, preserving our predictive ability."
>
> *"Primera, asegura que la reacción Ry quede en el lugar correcto para que el desgaste sea
> simétrico. Segunda, se sostiene la distribución cosenoidal de presión, **lo que preserva nuestra
> capacidad de predecir**."*

**Consecuencia de equivocarse (§16-3):**
> "Mislocating the pivot makes Mf zero about a different location, so the brake lining adjusts its
> local contact pressure, through wear, to compensate. The result is unsymmetrical wear, retiring
> the shoe lining, hence the shoe, sooner."
>
> *"Poner mal el pivote hace que Mf sea cero respecto a otro punto, y el forro ajusta su presión
> local de contacto por desgaste para compensar. El resultado es **desgaste asimétrico**, que retira
> el forro —y por tanto la zapata— antes de tiempo."*

⭐ El error de posición del pivote **no falla el cálculo: falla la VIDA**. Una máquina que solo
verifica esfuerzos nunca lo detecta.

---

### §16-4 — FRENO/EMBRAGUE DE BANDA

Aplicaciones que el cliente nombra: excavadoras de potencia, izaje y otra maquinaria.

    P1/P2 = e^{fφ}                                                        (16-19)
    T = (P1 − P2)·D/2                                                     (16-20)
    p = P/(b·r) = 2P/(b·D)                                                (16-21)
    pa = 2·P1/(b·D)                                                       (16-22)

**Regla clave (§16-4):**
> "The pressure is therefore proportional to the tension in the band. The maximum pressure pa will
> occur **at the toe** and has the value pa = 2P1/(bD)."
>
> *"La presión es proporcional a la tensión de la banda. La presión máxima pa ocurre **en la punta
> (toe)** y vale 2P1/(bD)."*

⭐ En banda el punto crítico de presión es geométricamente FIJO (la punta, donde la tensión es P1);
en la zapata interna es θa, que depende de si la zapata es corta o larga. **Dos motores de
localización distintos.** P2 es la fuerza de accionamiento y es MENOR que la reacción del pasador P1.

---

### §16-5 — EMBRAGUE AXIAL DE CONTACTO POR FRICCIÓN (disco) — **presión uniforme vs desgaste uniforme**

**Ventajas del disco sobre el cono, según el cliente (§16-5):**
libertad de efectos centrífugos; gran área de fricción en poco espacio; superficies más efectivas de
disipación de calor; distribución de presión favorable.
> "except for relatively simple installations, it [the cone clutch] has been largely displaced by
> the disk clutch"
> *"salvo en instalaciones relativamente simples, el embrague de cono fue desplazado en gran medida
> por el de disco."*

#### La distinción crítica — qué asume el cliente y CUÁNDO

**Es una decisión de CONSTRUCCIÓN, no de gusto (§16-5):**

> "Two methods of solving the problem, **depending upon the construction of the clutch**, are in
> general use. **If the disks are rigid**, then the greatest amount of wear will at first occur in
> the outer areas, since the work of friction is greater in those areas. After a certain amount of
> wear has taken place, the pressure distribution will change so as to permit the wear to be
> uniform. This is the basis of the first method of solution. **Another method of construction
> employs springs to obtain a uniform pressure over the area.** It is this assumption of uniform
> pressure that is used in the second method of solution."
>
> *"Se usan dos métodos, **según la CONSTRUCCIÓN del embrague**. **Si los discos son rígidos**, al
> principio el mayor desgaste ocurre en las zonas exteriores, porque ahí el trabajo de fricción es
> mayor. Después de cierto desgaste, la distribución de presión cambia hasta permitir desgaste
> uniforme: ésa es la base del primer método. **Otra construcción usa RESORTES para obtener presión
> uniforme sobre el área**: esa suposición es la base del segundo método."*

⭐ **Requisito de UI:** la pregunta que hay que hacerle al usuario no es "¿uniform wear o uniform
pressure?" sino **"¿discos rígidos o discos con resortes?"** y **"¿embrague nuevo o rodado?"**
El cliente etiqueta las curvas de la Fig. 16-17 literalmente como
**"Uniform pressure (new clutch)"** y **"Uniform wear (old clutch)"**.

**Desgaste uniforme (§16-5).** De w = KPVt, para w constante → PV constante → **pr constante**.
La presión máxima ocurre donde r es mínimo, **r = d/2**:

    p·r = pa·(d/2)                                                        (a)
    F = π·pa·d·(D − d)/2                                                  (16-23)
    T = π·f·pa·d·(D² − d²)/8                                              (16-24)
    T = F·f·(D + d)/4                                                     (16-25)

**Presión uniforme (§16-5).** p = pa en toda el área:

    F = π·pa·(D² − d²)/4                                                  (16-26)
    T = π·f·pa·(D³ − d³)/12                                               (16-27)
    T = (F·f/3)·(D³ − d³)/(D² − d²)                                       (16-28)

**Alcance de cada ecuación — gotcha que la máquina se salta (§16-5):**
> "In use, Equation (16–23) gives the actuating force for the selected maximum pressure pa. **This
> equation holds for any number of friction pairs or surfaces.** Equation (16–25), however, **gives
> the torque capacity for only a single friction surface.**"
>
> *"La Ec. (16-23) da la fuerza de accionamiento para el pa elegido: **vale para cualquier número de
> pares o superficies de fricción**. Pero la Ec. (16-25) da la capacidad de par para **UNA SOLA
> superficie de fricción**."*

Y lo repite para presión uniforme:
> "It should be noted for both equations that the torque is for a single pair of mating surfaces.
> This value must therefore be multiplied by the number of pairs of surfaces in contact."
> *"En ambas ecuaciones el par es para UN par de superficies en contacto. Hay que multiplicarlo por
> el número de pares en contacto."*

⭐ **F NO se multiplica por el número de superficies; T SÍ.** Es el error #1 de un implementador
literal.

#### Por qué DESGASTE UNIFORME es el conservador — la demostración de Buckingham (§16-5)

El cliente adimensionaliza (método de Buckingham, π-terms π1 = T/(FD), π2 = f, π3 = d/D):

    T/(fFD) = (1 + d/D)/4                     desgaste uniforme (old clutch)   (b)
    T/(fFD) = (1/3)·[1 − (d/D)³]/[1 − (d/D)²] presión uniforme (new clutch)    (c)

> "By examining Figure 16–17 we can conclude that **a new clutch, Equation (c), always transmits
> more torque than an old clutch, Equation (b).** Furthermore, since clutches of this type are
> **typically proportioned to make the diameter ratio d/D fall in the range 0.6 ≤ d/D ≤ 1**, the
> largest discrepancy... [0.400 vs 0.4083] ... so the proportional error is 0.021, or about 2
> percent. **Given the uncertainties in the actual coefficient of friction and the certainty that new
> clutches get old, there is little reason to use anything but Equations (16–23), (16–24), and
> (16–25).**"
>
> *"Examinando la Fig. 16-17 se concluye que **un embrague nuevo (c) SIEMPRE transmite más par que
> uno viejo (b)**. Además, como estos embragues **típicamente se proporcionan con d/D en el rango
> 0.6 ≤ d/D ≤ 1**, la mayor discrepancia da 0.400 contra 0.4083, o sea **~2 % de error**. Dadas las
> incertidumbres del coeficiente de fricción real y la CERTEZA de que los embragues nuevos se hacen
> viejos, **hay poca razón para usar algo que no sean las Ecs. (16-23), (16-24) y (16-25)**"* —
> es decir, **DESGASTE UNIFORME**.

⭐ **La regla de decisión completa, tal como el cliente la razona:**
1. Presión uniforme (nuevo) **siempre** predice MÁS par → es la NO conservadora.
2. Desgaste uniforme (viejo) predice MENOS par → **es la conservadora**.
3. La diferencia en el rango práctico d/D = 0.6…1 es de apenas **~2 %**.
4. Por eso: **usa desgaste uniforme SIEMPRE**, porque los embragues nuevos envejecen y f es incierto.

⭐ El argumento no es "es más exacto", es **"el nuevo se hará viejo"** — un argumento sobre el CICLO
DE VIDA, no sobre la física del instante. **Eso es lo que ninguna máquina lineal reproduce.**
Rango d/D "típico" **0.6 a 1** ← dato duro del texto, no invento.

---

### §16-6 — FRENO DE DISCO (caliper, pad anular y pad circular)

> "there is no fundamental difference between a disk clutch and a disk brake. The analysis of the
> preceding section applies to disk brakes too." (§16-6)

**El argumento contra el auto-energizado en vehículos (§16-6) — números duros:**
> "We have seen that rim or drum brakes can be designed for self-energization. While this feature is
> important in reducing the braking effort required, it also has a disadvantage. When drum brakes are
> used as vehicle brakes, only a slight change in the coefficient of friction will cause a large
> change in the pedal force required for braking. **A not unusual 30 percent reduction in the
> coefficient of friction due to a temperature change or moisture, for example, can result in a 50
> percent change in the pedal force** required to obtain the same braking torque obtainable prior to
> the change. The disk brake has no self-energization, and hence is not so susceptible to changes in
> the coefficient of friction."
>
> *"Los frenos de tambor se pueden diseñar auto-energizados. Eso reduce el esfuerzo de frenado, pero
> tiene una desventaja: en frenos de vehículo, **un cambio pequeño en f causa un cambio grande en la
> fuerza de pedal**. Una reducción nada rara de **30 % en f** por temperatura o humedad **puede
> producir 50 % de cambio en la fuerza de pedal** para el mismo par. El freno de disco NO tiene
> auto-energizado y por eso no es tan susceptible a cambios de f."*

⭐ **JUICIO HUMANO nombrado y cuantificado: 30 % en f → 50 % en pedal.** La decisión "acepto o no
auto-energizado" es un compromiso **sensibilidad vs esfuerzo**, no una optimización de par.

**Ventaja del caliper flotante (§16-6):**
> "The floating action also compensates for wear and ensures a fairly constant pressure over the area
> of the friction pads."

**Pad ANULAR (Fig. 16-19), geometría (θ1, θ2, ri, ro):**

    F  = (θ2 − θ1)∫[ri..ro] p·r dr                                        (16-29)
    T  = (θ2 − θ1)·f·∫[ri..ro] p·r² dr                                    (16-30)
    re = T/(fF) = ∫p r² dr / ∫p r dr                                      (16-31)
    r̄ = Mx/F = [(cos θ1 − cos θ2)/(θ2 − θ1)]·re                          (16-32)

Desgaste uniforme (p = pa·ri/r, **pa ocurre en el radio INTERIOR ri**):

    F  = (θ2 − θ1)·pa·ri·(ro − ri)                                        (16-33)
    T  = ½(θ2 − θ1)·f·pa·ri·(ro² − ri²)                                   (16-34)
    re = (ro + ri)/2                                                      (16-35)
    r̄  = [(cos θ1 − cos θ2)/(θ2 − θ1)]·(ro + ri)/2                       (16-36)

Presión uniforme (**"approximated by a new brake"**, p = pa):

    F  = ½(θ2 − θ1)·pa·(ro² − ri²)                                        (16-37)
    T  = ⅓(θ2 − θ1)·f·pa·(ro³ − ri³)                                      (16-38)
    re = (2/3)(ro³ − ri³)/(ro² − ri²)                                     (16-39)
    r̄  = (2/3)[(ro³−ri³)/(ro²−ri²)]·[(cos θ1 − cos θ2)/(θ2 − θ1)]        (16-40)

**Pad CIRCULAR (button/puck), Fig. 16-20 (§16-6):**
> "Numerical integration is necessary to analyze this brake since the boundaries are difficult to
> handle in closed form. Table 16–1 gives the parameters for this brake as determined by Fazekas."
>
> *"Hace falta integración numérica porque las fronteras son difíciles de manejar en forma cerrada.
> La Tabla 16-1 da los parámetros determinados por Fazekas."*

    re = δ·e                                                              (16-41)
    F  = π·R²·pav                                                         (16-42)
    T  = f·F·re                                                           (16-43)

**Tabla 16-1** indexada por **R/e** (0.0, 0.1, 0.2, 0.3, 0.4, 0.5) → devuelve **δ = re/e** (1.000,
0.983, 0.969, 0.957, 0.947, 0.938) y **pmax/pav** (1.000, 1.093, 1.212, 1.367, 1.578, 1.875).

⭐ **En el pad circular se diseña con pav, pero se VERIFICA con pmax** (Ex. 16-4: pmax/pav = 1.290 a
R/e = 0.25, por interpolación). Una máquina que compare pav contra p_max del material **sobrepasa el
material 29 %**.

**Iteración del Ex. 16-3** (2 pads anulares, T total 13 000 lbf·in): parte con **T/2 por pad**,
despeja pa de (16-34), luego F de (16-33), luego re y r̄, y **cierra con la presión hidráulica**
p = F/A_pistón = 3748/(π·1.5²/4) = 2121 psi. El entregable no es el freno: es la **presión de línea**.

---

### §16-7 — EMBRAGUE Y FRENO DE CONO

**Los parámetros geométricos importantes que el cliente nombra:** el ángulo de cono α, y el diámetro
y ancho de cara del cono.

**Regla dura del ángulo de cono (§16-7):**
> "**If the cone angle is too small, say, less than about 8°, then the force required to disengage
> the clutch may be quite large.** The wedging effect lessens rapidly when larger cone angles are
> used. Depending upon the characteristics of the friction materials, **a good compromise can usually
> be found using cone angles between 10° and 15°.**"
>
> *"**Si el ángulo de cono es muy chico, digamos menos de unos 8°, la fuerza para DESEMBRAGAR puede
> ser muy grande.** El efecto de cuña disminuye rápido con ángulos mayores. Según las
> características del material de fricción, **normalmente se halla un buen compromiso con ángulos de
> cono entre 10° y 15°.**"*

⭐ El límite lo pone el **DESEMBRAGUE**, no el embrague. Una máquina que optimiza par transmitido
empujaría α → 0 y produciría un embrague que no se puede soltar.

Desgaste uniforme (p = pa·d/(2r), dA = 2πr·dr/sin α):

    F = π·pa·d·(D − d)/2         ← **idéntica a (16-23), no depende de α**  (16-44)
    T = π·f·pa·d·(D² − d²)/(8 sin α)                                       (16-45)
    T = F·f·(D + d)/(4 sin α)                                              (16-46)

Presión uniforme:

    F = π·pa·(D² − d²)/4                                                   (16-47)
    T = π·f·pa·(D³ − d³)/(12 sin α)                                        (16-48)
    T = (F·f/(3 sin α))·(D³ − d³)/(D² − d²)                                (16-49)

> "Note that Equation (16–24) is a special case of Equation (16–45), with α = 90°."
> *"La Ec. (16-24) es un caso especial de la (16-45) con α = 90°."*

⭐ **Requisito de implementación:** el disco axial es el cono con α = 90°. **UN solo motor**, no dos.

Adimensionalización con 4 π-terms (T/FD, f, sin α, d/D):
> "The plots and conclusions are the same. There is little reason for using equations other than
> Equations (16–44), (16–45), and (16–46)."
> *"Las gráficas y conclusiones son las mismas. Hay poca razón para usar otras ecuaciones."* →
> **desgaste uniforme otra vez.**

---

### §16-8 — CONSIDERACIONES DE ENERGÍA

> "The capacity of a clutch is therefore limited by two factors, the characteristics of the material
> and the ability of the clutch to dissipate heat." (§16-8)
> *"La capacidad de un embrague está limitada por DOS factores: las características del material y la
> capacidad del embrague para disipar calor."*

> "the character of the load may be such that, if this torque value is permitted, **the clutch or
> brake may be destroyed by its own generated heat**."
> *"el carácter de la carga puede ser tal que, si se permite ese valor de par, **el embrague o freno
> se destruya por su propio calor generado**."*

Modelo de dos inercias, par de embrague constante, ejes rígidos:

    θ̇ = ω1 − ω2 − [(I1/I2 + 1)/I1]·T·t                                    (16-50)
    t1 = [I1/(I1/I2 + 1)]·(ω1 − ω2)/T                                      (16-51)
    E  = [I1/(I1/I2 + 1)]·(ω1 − ω2)²/2                                     (16-52)
    H  = E/9336   [Btu, con I en lbf·in·s², E en in·lbf]                   (16-53)

**Tres lecturas que el cliente hace de esas ecuaciones (§16-8):**
- "the time required for the engagement operation is directly proportional to the velocity difference
  and inversely proportional to the torque."
- "the energy-dissipation rate is greatest at the start, when t = 0."
- "**the energy dissipated is proportional to the velocity difference squared and is independent of
  the clutch torque.**"
  *"La energía disipada es proporcional al CUADRADO de la diferencia de velocidad y es
  **independiente del par del embrague**."*

⭐ Consecuencia de diseño: **subir el par NO reduce el calor total, solo lo concentra en menos
tiempo.** Manejo de la forma de I2 → ∞ para frenos: la Ec. (16-50) está escrita en esa forma a
propósito ("mathematically works well for clutches... and for brakes (where the inertia of the
grounded body, I2, can be set to infinity)"). En SI, inercias en kg·m² y energía en joules.

---

### §16-9 — ELEVACIÓN DE TEMPERATURA

    ΔT = H/(Cp·W)   [°F, Cp = 0.12 Btu/(lbm·°F) para acero o hierro colado]  (16-54)
    ΔT = E/(Cp·m)   [°C, Cp = 500 J/(kg·°C) para acero o hierro colado]      (16-55)
    (T − T∞)/(T1 − T∞) = exp[−(ħCR·A/(W·Cp))·t]   Newton                     (16-56)
    Hloss = ħCR·A·(T − T∞) = (hr + fv·hc)·A·(T − T∞)                         (16-57)
    E = (1/2)(I/9336)(ωo² − ωf²)  [Btu]                                      (16-58)
    ΔT = E/(W·C)                                                             (16-59)
    Tmax = T∞ + ΔT/[1 − exp(−β·t1)],  β = ħCR·A/(W·Cp)                       (16-60)

**Advertencia honesta del cliente sobre su propio modelo (§16-9) — oro puro:**
> "there are so many variables involved that **it would be most unlikely that such an analysis would
> even approximate experimental results**. For this reason such analyses are **most useful, for
> repetitive cycling, in pinpointing those design parameters that have the greatest effect on
> performance.**"
>
> *"hay tantas variables que **sería muy poco probable que un análisis así ni siquiera se aproxime a
> los resultados experimentales**. Por eso estos análisis son **más útiles, para ciclado repetitivo,
> en SEÑALAR cuáles parámetros de diseño tienen mayor efecto en el desempeño.**"*

⭐ **Requisito de producto:** el módulo térmico **no es una calculadora de predicción, es un motor de
SENSIBILIDAD.** Debe entregar "qué mueve la aguja", no "la temperatura será X". Reportar un número
solo, sin contexto de sensibilidad, contradice al cliente.

**Cuándo importa el análisis de temperatura (§16-9):**
> "For repetitive brake applications, subsequent temperature peaks T3, T4, ... may be higher than the
> previous peaks **if insufficient cooling has occurred between applications**. If this is a
> production situation with brake applications every t1 seconds, then a steady state develops in
> which all the peaks Tmax and all the valleys Tmin are repetitive."
>
> *"En aplicaciones repetitivas los picos T3, T4... pueden ser MÁS ALTOS que los anteriores **si no
> hubo enfriamiento suficiente entre aplicaciones**. Si es producción con frenadas cada t1 segundos,
> se desarrolla un estado estable con Tmax y Tmin repetitivos."*

> "The heat-dissipation capacity of disk brakes has to be planned to **avoid reaching disk and pad
> temperatures that are detrimental to the parts**."

**Fuentes de los coeficientes:** hr y hc de la **Fig. 16-24a**, indexada por la elevación de
temperatura (T − T∞) hasta 700 °F; fv (factor de ventilación) de la **Fig. 16-24b**, indexado por
velocidad de ventilación forzada (ft/s), hasta ~80 ft/s con multiplicador hasta ~8.

**LA ITERACIÓN MÁS EXPLÍCITA DE TODO EL CAPÍTULO (Ex. 16-5):**
1. **Suponer** una elevación: "Assuming a temperature rise of Tmax − T∞ = 200 °F".
2. Leer hr = 3.0e−6, hc = 2.0e−6 de Fig. 16-24a; fv = 4.8 de Fig. 16-24b (25 ft/s).
3. Calcular: ħCR = 12.6e−6, ΔT = 49.3 °F, **Tmax = 209 °F**.
4. **Comparar contra lo supuesto:** predicho Tmax − T∞ = 139 °F ≠ 200 °F supuesto.
5. > "**Iterating with revised values of hr and hc from Fig. 16–24a, we can make the solution converge
   > to Tmax = 220 °F and Tmin = 171 °F.**"
6. **Cerrar contra la Tabla 16-3:** "Table 16–3 for dry sintered metal pads gives a continuous
   operating maximum temperature of 570−660 °F. **There is no danger of overheating.**"

⭐ **Punto fijo explícito:** hr y hc dependen de (T − T∞), que es lo que se está calculando. El
software TIENE que iterar. Y el criterio de aceptación no es "converge": es
**"Tmax ≤ Max Continuous Temperature del material (Tabla 16-3)"**.

---

### §16-10 — MATERIALES DE FRICCIÓN

**Las 7 características que el cliente exige de un forro (§16-10)** —
"to a degree that is **dependent on the severity of service**" (*en grado dependiente de la
SEVERIDAD DEL SERVICIO*):
1. Coeficiente de fricción alto **y reproducible**.
2. Impermeabilidad a condiciones ambientales, como humedad.
3. Capacidad de aguantar altas temperaturas, junto con buena conductividad y difusividad térmica y
   alta capacidad calorífica específica.
4. Buena resiliencia.
5. Alta resistencia al desgaste, rayado (scoring) y agarrotamiento (galling).
6. Compatible con el ambiente.
7. Flexibilidad.

**El límite explícito de la automatización (§16-10) — el cliente lo dice él mismo:**
> "The manufacture of friction materials is a highly specialized process, and **it is advisable to
> consult manufacturers' catalogs and handbooks, as well as manufacturers directly, in selecting
> friction materials for specific applications. Selection involves a consideration of the many
> characteristics as well as the standard sizes available.**"
>
> *"La fabricación de materiales de fricción es un proceso muy especializado, y **es aconsejable
> consultar catálogos y manuales de fabricantes, y a los fabricantes directamente**, para elegir
> materiales para aplicaciones específicas. La selección implica considerar las muchas
> características **así como los TAMAÑOS ESTÁNDAR DISPONIBLES.**"*

⭐ El software puede FILTRAR y RANQUEAR candidatos, pero el cliente no acepta que decida solo. Y hay
una restricción que la física no ve: **disponibilidad de tamaños estándar**.

**Notas de material que el cliente da en prosa (§16-10):**
- Woven cotton: tela impregnada de resinas, polimerizada; sobre todo maquinaria pesada; rollos hasta
  **50 ft**, espesores de **1/8 a 1 in**, anchos hasta **~12 in**.
- Woven asbestos: similar al de algodón, puede llevar partículas metálicas; **no tan flexible** que
  el de algodón, y **menor rango de tamaños**.
- Molded-asbestos linings: fibra + modificadores de fricción, polímero termofijo con calor, moldeo
  rígido o semirígido. Uso principal: **frenos de tambor**.
- Molded-asbestos pads: como los linings pero **sin flexibilidad**; embragues y frenos.
- Sintered-metal pads: mezcla de cobre y/o hierro con modificadores, moldeados a alta presión y
  fundidos a alta temperatura; frenos y embragues **de servicio pesado**.
- Cermet pads: como sintered-metal pero con **contenido cerámico sustancial**.

**Correr en aceite (regla de compromiso, §16-10):**
> "Some of these materials may be run wet by allowing them to dip in oil or to be sprayed by oil.
> **This reduces the coefficient of friction somewhat but carries away more heat and permits higher
> pressures to be used.**"
>
> *"Algunos materiales se pueden correr en HÚMEDO, sumergidos o rociados con aceite. **Eso baja algo
> el coeficiente de fricción pero se lleva más calor y permite usar presiones más altas.**"*

⭐ Wet/dry no es un flag: es un **trade-off de tres variables (f ↓, calor ↑↑, p_max ↑)** que se ve
directo en las tablas 16-3 y 16-5. Ej. sintered metal: dry f = 0.29–0.33 con pmax = 300–400 psi;
wet f = 0.06–0.08 con pmax = 500 psi.

---

### §16-11 — EMBRAGUES Y ACOPLES MISCELÁNEOS (contexto, no cálculo)

**Embrague de quijada cuadrada (positive-contact), 5 características (§16-11):**
- No patinan. · No generan calor. · **No se pueden engranar a alta velocidad.**
- **A veces no se pueden engranar con ambos ejes en reposo.**
- **El engrane a cualquier velocidad va acompañado de choque.**

Para alargar el tiempo de acción de cambio, las quijadas pueden ser de trinquete, espirales o forma
de diente de engrane. Aplicaciones donde se requiere operación síncrona: prensas de potencia,
screw-downs de molinos de laminación.

**Embrague de liberación por sobrecarga (§16-11):**
> "These clutches are usually spring-loaded so as to release at a predetermined torque. **The
> clicking sound that is heard when the overload point is reached is considered to be a desirable
> signal.**"
> *"...el CLIC que se oye al llegar al punto de sobrecarga se considera una señal DESEABLE."*

⭐ Un requisito funcional que es **acústico**. Ninguna ecuación lo captura.

> "Both fatigue and shock loads must be considered... In addition, wear must generally be considered."

**Overrunning clutch:** rodillos o balines entre manga exterior y miembro interior con planos de leva;
equivale a trinquete con infinitos dientes; sin deslizamiento, la única pérdida es fricción de
rodamientos y windage; capacidades hasta cientos de HP.

---

### §16-12 — VOLANTES (FLYWHEELS)

**Lo que el cliente declara que quiere saber (§16-12) — define el API:**
> "we are not really interested in the instantaneous values of these terms at all. Primarily we want
> to know **the overall performance of the flywheel. What should its moment of inertia be? How do we
> match the power source to the load? And what are the resulting performance characteristics of the
> system that we have selected?**"
>
> *"realmente no nos interesan los valores instantáneos. Lo que queremos saber es **el desempeño
> global del volante: ¿cuál debe ser su momento de inercia? ¿cómo casamos la fuente de potencia con
> la carga? ¿y cuáles son las características de desempeño del sistema elegido?**"*

    Iθ̈ = Ti(θ, ω) − To(θ, ω)   [eje rígido: θi = θo = θ, ωi = ωo = ω]      (b)
    E2 − E1 = ½·I·(ω2² − ω1²)                                              (16-61)
    Cs = (ω2 − ω1)/ω          ← coeficiente de fluctuación de velocidad    (16-62)
    ω  = (ω2 + ω1)/2          ← velocidad angular nominal                  (16-63)
    E2 − E1 = Cs·I·ω²         ← **la ecuación de dimensionamiento**        (16-64)

**Procedimiento a mano (Ex. 16-6), tal cual lo ejecuta:**
1. Tabular T(θ) por un ciclo (Tabla 16-6, 48 intervalos de Δθ = 4π/48 para un motor de 4 tiempos,
   θ de 0 a 720°). **La curva tiene parte negativa** →
   > "the flywheel must return part of the energy back to the engine."
2. Integrar numéricamente → E = 3368 in·lbf (energía entregable a la carga).
3. **Tm = E/(4π) = 268 lbf·in** (par medio, dividiendo por el ciclo completo 4π).
4. **Localizar el lazo positivo más grande de T − Tm** ("The largest positive loop on the
   torque-displacement diagram occurs between θ = 0° and θ = 180°. **We select this loop as yielding
   the largest speed change**").
5. Restar Tm de esos valores e **integrar T − Tm** → E2 − E1 = 3531 lbf·in.
6. Elegir Cs (en el ejemplo, **Cs = 0.1**) → I = (E2 − E1)/(Cs·ω²) = 3531/[0.1·250²] = **0.565 lbf·s²·in**.
7. Recuperar ω2 = (ω/2)(2 + Cs) = 262.5 y ω1 = 2ω − ω2 = 237.5 rad/s, y ubicar **dónde ocurren**
   (θ = 180° y θ = 0°).

⭐ **El paso 4 es JUICIO HUMANO puro: "elegimos ESTE lazo".** El cliente lee la gráfica y escoge.
Automatizar esto = buscar el máximo de la integral acumulada de (T − Tm) sobre TODOS los lazos, no
solo el primero que aparezca.
⭐ Cs es **una entrada de diseño, no una salida.** En el texto extraído **no aparece ninguna tabla de
Cs recomendado por tipo de máquina**; el único valor dado es Cs = 0.1 en Ex. 16-6, y en problemas
Cs = 0.30 (prob. de motocicleta) y un problema que pide estimar Cs a partir de "240 a 260 rev/min".

**Prensa punzonadora (§16-12) — segunda receta, distinta:**

    T(θ1 − 0) = ½·I·(ω1² − ω2²) = E2 − E1
    W = ½·I·(ωmax² − ωmin²) = I·Cs·ω̄·ω0 ;  con fluctuación baja ω0 ≈ ω̄ →  I = W/(Cs·ω̄²)

> "The motor and flywheel **must be sized for the most demanding service, which is steady punching.**"
> *"El motor y el volante deben dimensionarse para el servicio MÁS EXIGENTE, que es punzonar de
> forma continua."*

Motor de inducción, característica lineal TM = aω + b:

    a = −Tr/(ωs − ωr) ;  b = Tr·ωs/(ωs − ωr)                               (16-65)
    t2 − t1 = (I/a)·ln(T2/Tr)                                              (16-66)
    t1 = (I/a)·ln[(Tr − TL)/(T2 − TL)]                                     (16-67)
    T2/Tr = [(TL − Tr)/(TL − T2)]^{(t2−t1)/t1}   ← resolver numéricamente  (16-68)
    I = a(t2 − t1)/ln(T2/Tr)                                               (16-69)

**Gotcha de unidades que el cliente escribe expresamente (§16-12):**
> "**It is important that a be in units of lbf·in·s/rad so that I has proper units. The constant a
> should not be in lbf·in per rev/min or lbf·in per rev/s.**"
> *"Es importante que `a` esté en lbf·in·s/rad para que I tenga las unidades correctas. La constante
> `a` NO debe estar en lbf·in por rev/min ni por rev/s."*

⭐ El cliente ya se quemó con esto. **Requisito: unidades tipadas, no floats desnudos.**
Ejemplo trabajado en el texto: motor 3 hp trifásico jaula de ardilla, ωs de 1200 rev/min, nominal
1125 rev/min → Tr = 63025(3)/1125 = 168.1 lbf·in, ωr = 117.81, ωs = 125.66 rad/s,
a = −21.41 lbf·in·s/rad, b = 2690.9 lbf·in.

---

## 2. CAPÍTULO 17 — ELEMENTOS MECÁNICOS FLEXIBLES

### §17-1 — BANDAS (contexto y reglas generales)

**Regla de mantenimiento que abre el capítulo (intro cap. 17):**
> "Most flexible elements do not have an infinite life. When they are used, **it is important to
> establish an inspection schedule to guard against wear, aging, and loss of elasticity. The elements
> should be replaced at the first sign of deterioration.**"
>
> *"La mayoría de los elementos flexibles NO tienen vida infinita. Cuando se usan, **es importante
> establecer un CALENDARIO DE INSPECCIÓN contra desgaste, envejecimiento y pérdida de elasticidad.
> Los elementos deben reemplazarse a la PRIMERA señal de deterioro.**"*

⭐ **El entregable de una banda no es una banda: es una banda + un calendario de inspección.**

**Tabla 17-1** (características de los 4 tipos de banda), indexada por **tipo de banda** → columnas
Figura, **Joint (¿tiene junta?)**, **rango de tamaño**, **distancia entre centros**:
- Flat: joint **sí**; t = 0.03 a 0.20 in (0.75 a 5 mm); **sin límite superior** de centros.
- Round: joint **sí**; d = 1/8 a 3/4 in; **sin límite superior**.
- V: joint **ninguna**; b = 0.31 a 0.91 in (8 a 19 mm); centros **limitados**.
- Timing: joint **ninguna**; p = 2 mm y más; centros **limitados**.

Otras características que el cliente enumera (§17-1):
- Se pueden usar para distancias largas entre centros.
- **"Except for timing belts, there is some slip and creep, and so the angular-velocity ratio between
  the driving and driven shafts is neither constant nor exactly equal to the ratio of the pulley
  diameters."** *(salvo las dentadas, hay deslizamiento y creep: la relación de velocidades NO es
  constante ni exactamente igual a la relación de diámetros)*
- Un idler o polea tensora puede evitar ajustes de centros por edad o bandas nuevas.
- **"In all cases, the pulley axes must be separated by a certain minimum distance, depending upon
  the belt type and size, to operate properly."**
- Poleas coronadas (crowned) para banda plana; poleas ranuradas (sheaves) para redonda y V; ruedas
  dentadas (sprockets) para timing.
- Lado flojo: **"Although the top is preferred for the loose side of the belt"** para banda plana;
  para otros tipos arriba o abajo, porque su tensión instalada suele ser mayor.
- Bandas cruzadas: **"Crossed belts must be separated to prevent rubbing if high-friction materials
  are used."**
- Fuera de plano (Fig. 17-3): **"The pulleys must be positioned so that the belt leaves each pulley
  in the midplane of the other pulley face."** *(la banda debe SALIR de cada polea en el plano medio
  de la cara de la otra polea)*; si no, hacen falta poleas guía.
- Banda plana: eficiencia ~98 % (como engranes); banda V: **70 a 96 %** (§17-2).
- Timing: eficiencia **97 a 99 %**, sin lubricación, más silenciosa que cadena, sin variación de
  velocidad cordal, **no requiere tensión inicial** → **centros fijos** (§17-1, §17-4).
  Desventajas: costo inicial de la banda, necesidad de ranurar los sprockets, y las fluctuaciones
  dinámicas a la frecuencia de engrane de los dientes.

---

### §17-2 — BANDAS PLANAS Y REDONDAS

**Geometría:**

    φd = π − 2·asin[(D − d)/(2C)] ;  φD = π + 2·asin[(D − d)/(2C)]   abierta   (17-1)
    L = [4C² − (D − d)²]^½ + ½(D·φD + d·φd)                                     (17-2)
    φ = π + 2·asin[(D + d)/(2C)]                                     cruzada   (17-3)
    L = [4C² − (D + d)²]^½ + ½(D + d)·φ                                         (17-4)

**Teoría (Firbank), lo que el cliente cita en prosa:**
> "substantially more power is transmitted by static friction than sliding friction. He also found
> that the coefficient of friction for a belt having a nylon core and leather surface was **typically
> 0.7, but that it could be raised to 0.9 by employing special surface finishes.**"
>
> *"se transmite sustancialmente más potencia por fricción ESTÁTICA que por deslizante. También halló
> que f para banda con núcleo de nylon y superficie de piel era **típicamente 0.7, pero se puede
> subir a 0.9 con acabados superficiales especiales.**"*

El ángulo de abrazo se compone de **arco efectivo** (donde se transmite potencia) + **arco ocioso**
(idle arc). La banda entra con F1 y V1 = velocidad superficial de la polea, pasa el arco ocioso sin
cambio, luego empieza el creep y sale con F2 y V2 reducida.

**Ecuación de banda (belting equation) con centrífuga:**

    dS = m·V²·dθ = Fc·dθ ;  Fc = m·r²·ω²                                        (a)
    F = (F2 − m r²ω²)·exp(fθ) + m r²ω²                                          (17-5)
    (F1 − Fc)/(F2 − Fc) = exp(fφ)          ← **la belting equation**            (17-7)
    F1 − F2 = (F1 − Fc)·[exp(fφ) − 1]/exp(fφ)                                   (17-8)
    Fc = (w/g)·(V/60)²   [w en lbf/ft, V en ft/min, w = 12·γ·b·t]               (e)
    F1 = Fi + Fc + T/d ;  F2 = Fi + Fc − T/d ;  F1 − F2 = 2T/d                  (f),(g),(h)
    Fi = (F1 + F2)/2 − Fc                                                       (i)
    Fi = (T/d)·[exp(fφ) + 1]/[exp(fφ) − 1]                                      (17-9)
    F1 = Fc + Fi·2exp(fφ)/[exp(fφ) + 1]                                         (17-10)
    F2 = Fc + Fi·2/[exp(fφ) + 1]                                                (17-11)
    H = (F1 − F2)V/33000                                                        (j)
    (F1)a = b·Fa·Cp·Cv                                                          (17-12)
    dip = C²·w/(96·Fi)   [catenaria; dip e C en in, w en lbf/ft, Fi en lbf]     (17-13)

**LA REGLA MÁS FUERTE DEL §17-2 — la tensión inicial:**
> "Equation (17–9) give us a fundamental insight into flat belting. **If Fi equals zero, then T equals
> zero: no initial tension, no torque transmitted.** The torque is in proportion to the initial
> tension. This means that if there is to be a satisfactory flat-belt drive, **the initial tension
> must be (1) provided, (2) sustained, (3) in the proper amount, and (4) maintained by routine
> inspection.**"
>
> *"**Si Fi = 0 entonces T = 0: sin tensión inicial no se transmite par.** El par es proporcional a la
> tensión inicial. Eso significa que para tener una transmisión de banda plana satisfactoria, la
> tensión inicial debe (1) proveerse, (2) sostenerse, (3) estar en la cantidad correcta y (4)
> mantenerse por INSPECCIÓN DE RUTINA."*

Y remata en el Ex. 17-1: **"If the initial tension is maintained, the capacity is the design power
of 20.6 hp."** — la capacidad está **condicionada al mantenimiento**.

**Los 3 esquemas de mantener Fi que el cliente da (§17-2, Fig. 17-11):**
(a) Polea loca con peso (weighted idler). (b) Montaje del motor pivotado — el peso del motor, polea,
placa y parte de la banda induce y mantiene la tensión correcta. (c) Tensión por catenaria — medir el
**dip** contra un alambre de piano tensado.
> "Both of these methods accommodate to temporary or permanent belt stretch."

**EL PROCEDIMIENTO DE 9 PASOS DE BANDA PLANA (§17-2, literal):**
1. Hallar exp(fφ) de la geometría del drive y la fricción de la **Tabla 17-2**.
2. De geometría, material (Tabla 17-2) y velocidad, hallar Fc con la Ec. (e).
3. Con H = Hd = Hnom·Ks·nd, hallar el par **T = 63025·Hnom·Ks·nd/n**.
4. De T, la necesaria **(F1)a − F2 = 2T/d**.
5. De las Tablas 17-2 y 17-4 y la Ec. (17-12), determinar **(F1)a = b·Fa·Cp·Cv**.
6. **F2 = (F1)a − [(F1)a − F2]**.
7. De la Ec. (i), la tensión inicial necesaria **Fi = (F1 + F2)/2 − Fc**.
8. **Verificar el desarrollo de fricción: f′ < f**, con f′ = (1/φ)·ln[((F1)a − Fc)/(F2 − Fc)].
9. Factor de seguridad **nfs = Ha/(Hnom·Ks)**.

⭐ **El paso 8 es el criterio de aceptación que una máquina se salta.** No basta con que aguanten las
tensiones: **la fricción REQUERIDA (f′) tiene que ser menor que la DISPONIBLE (f)**, si no, patina.
Ex. 17-1: f′ = 0.328 < f = 0.8 → "there is no danger of slipping".

**El régimen de trabajo del cliente respecto de los catálogos (§17-2) — filosofía de producto:**
> "It is unfortunate that many of the available data on belting are from sources in which they are
> presented in a very simplistic manner. These sources use a variety of charts, nomographs, and
> tables **to enable someone who knows nothing about belting to apply them.** Little, if any,
> computation is needed... **Since a basic understanding of the process, in many cases, is lacking,
> there is no way this person can vary the steps in the process to obtain a better design.**"
>
> *"Es una lástima que muchos de los datos disponibles vengan de fuentes que los presentan de forma
> muy simplista, con gráficas, nomogramas y tablas **para que alguien que no sabe nada de bandas
> pueda aplicarlos**. Casi no se necesita cálculo... **Como falta el entendimiento básico del
> proceso, esa persona NO puede variar los pasos para obtener un mejor diseño.**"*

⭐⭐ **ESTA ES LA DECLARACIÓN DE MISIÓN DEL PROYECTO EN LABIOS DEL CLIENTE.** No quiere un selector de
catálogo que escupa una respuesta: quiere una herramienta que le deje **variar los pasos**. Advierte
además que **"the results from the analysis presented here will not correspond exactly with those of
the sources from which they were obtained"** — si validamos contra el catálogo del fabricante y no
cuadra al decimal, **no es un bug**.

**EL "DECISION SET" — así organiza el cliente un diseño (§17-2), y en ese orden:**
- Función: potencia, velocidad, durabilidad, reducción, **factor de servicio**, distancia entre centros
- Factor de diseño: nd
- **Mantenimiento de la tensión inicial** ← es una DECISIÓN DE DISEÑO, al mismo nivel que el material
- Material de la banda
- Geometría del drive: d, D
- Espesor de la banda: t
- Ancho de la banda: b

> "Depending on the problem, some or all of the last four could be design variables. **Belt
> cross-sectional area is really the design decision, but available belt thicknesses and widths are
> discrete choices. Available dimensions are found in suppliers' catalogs.**"
>
> *"El ÁREA de sección transversal es realmente la decisión de diseño, pero los espesores y anchos
> disponibles son opciones DISCRETAS. Las dimensiones disponibles están en catálogos de proveedores."*

⭐ **Variable continua de diseño (área) + dominio discreto (catálogo).** Ex. 17-2: b calculada = 8.40
in, **"the next available larger width is 10 in"** → se usa 10 in.

**La iteración de Ex. 17-2 (diseño desde cero):** decide d = 16 in y D = 2.25d = 36 in; decide
polyamide A-3 (t = 0.13, Cv = 1); deja b como incógnita; **plantea todo en función de b** y despeja
**b al cual la fricción queda plenamente desarrollada** (b = 8.40 in) →
> "A belt width greater than 8.40 in will develop friction less than f = 0.80."
Luego sube al ancho disponible (10 in) y **re-verifica f′ = 0.479 < 0.8** ✓.
Y deja la iteración abierta:
> "Had a 9-in belt width been available, the analysis would show (F1)a = 846 lbf, F2 = 182 lbf,
> Fi = 448 lbf, and f′ = 0.63. **With a figure of merit available reflecting cost, thicker belts (A-4
> or A-5) could be examined to ascertain which of the satisfactory alternatives is best.**"
>
> *"Con una figura de mérito que refleje COSTO, se podrían examinar bandas más gruesas (A-4 o A-5)
> para saber cuál de las alternativas satisfactorias es la MEJOR."*

⭐ **"Satisfactorio" ≠ "mejor".** El cliente pide explícitamente un **espacio de alternativas
satisfactorias ordenado por una figura de mérito de costo.** Un solo resultado no le sirve.

**Coronado de poleas (§17-2) — reglas duras:**
> "**Flat-belt pulleys should be crowned to keep belts from running off the pulleys. If only one
> pulley is crowned, it should be the larger one. Both pulleys must be crowned whenever the pulley
> axes are not in a horizontal position.** Use Table 17-5 for the crown height."
>
> *"Las poleas de banda plana **deben coronarse** para que la banda no se salga. **Si solo se corona
> una, debe ser la MÁS GRANDE. Ambas deben coronarse siempre que los ejes de las poleas no estén en
> posición horizontal.**"*
Y en la nota al pie de la Tabla 17-5: **"Crown should be rounded, not angled; maximum roughness is
Ra = AA 63 μin."** *(la corona debe ser REDONDEADA, no en ángulo; rugosidad máxima Ra = 63 μin.)*

⭐ Tres reglas encadenadas + un requisito de acabado superficial. Nada de esto es una ecuación.

**Velocidad y correcciones (§17-2):**
- Fa tabulada está **a 600 ft/min**. **"Speed in excess of 600 ft/min and its effect on life is
  reflected in a velocity correction factor Cv."**
- **Cv = 1 para polyamide y urethane.** Para piel, **Fig. 17-9** (indexada por velocidad hasta 6000
  ft/min y por espesor: 11/64, 13/64, 18/64+20/64, 25/64 in).
- Cp (Tabla 17-4) refleja la severidad del flexeo en la polea y su efecto en la vida; **depende del
  tamaño Y del material.** **Cp = 1.0 para urethane.**
- **"The service factors Ks for V-belt drives, given in Table 17-15 in Section 17-3, are also
  recommended here for flat- and round-belt drives."** ← ⭐ **una sola tabla de Ks para bandas planas,
  redondas y V.**

**Bandas metálicas delgadas (§17-2).** Espesores hasta 0.002 in, anchos hasta 0.026 in; perforaciones
para no-slip. Propiedades: alta relación resistencia/peso; estabilidad dimensional; timing exacto;
útiles hasta **700 °F**; buena conducción eléctrica y térmica; inoxidables "inertes" no absorbentes
para ambientes hostiles y esterilizables (alimentos/farma).
> "Crowned pulleys are used to compensate for tracking errors."
> "with the hoop tension due to centrifugal force **typically neglected** for the very thin metal belts"

    σb = E·t/[(1 − ν²)·D] = E/[(1 − ν²)(D/t)]   ← plane STRAIN, no plane stress   (17-14)
    σ = 15.16(10⁶)·Np^(−0.412)    [301/302 stainless, r² = 0.9303]                (17-15)

> "Although the belts are of simple geometry, **the method of Marin is not used because the condition
> of the butt weldment (to form the loop) is not accurately known, and the testing of weld coupons is
> difficult. The belts are run to failure on two equal-sized pulleys.**"
>
> *"Aunque la geometría es simple, **NO se usa el método de Marin porque la condición de la soldadura
> a tope (que forma el lazo) no se conoce con exactitud y probar cupones de soldadura es difícil. Las
> bandas se corren hasta la falla sobre dos poleas del mismo tamaño.**"*

⭐ El cliente **abandona a propósito el método de fatiga de su propio libro** y usa datos empíricos.
Requisito: el motor de fatiga de bandas metálicas es **tabla/regresión**, NO Marin.

**Procedimiento de 9 pasos, banda metálica (§17-2):**
1. exp(fφ) de geometría y fricción. 2. Resistencia a fatiga: Sf = 15.16e6·Np^−0.412 (301/302 stainless)
o **Sf = Sy/3 (los demás)**. 3. (F1)a = [Sf − E·t/((1−ν²)D)]·t·b = a·b. 4. ΔF = 2T/D.
5. F2 = a·b − ΔF. 6. Fi = a·b − ΔF/2. 7. **bmin = (ΔF/a)·exp(fφ)/[exp(fφ) − 1]**.
8. Elegir **b > bmin** y recalcular. 9. **Verificar f′ = (1/φ)·ln[(F1)a/F2] < f**.

Nota: en bandas metálicas el paso 9 **omite Fc** (la centrífuga se desprecia), a diferencia del
paso 8 de banda plana elastomérica. ⭐ Dos fórmulas de f′ distintas — no unificarlas a ciegas.

---

### §17-3 — BANDAS EN V (el procedimiento de catálogo)

**Designación y tablas base:**
- **Tabla 17-9** indexada por **letra de sección (A, B, C, D, E)** → ancho a, espesor b, **diámetro
  mínimo de sheave** y **rango de HP (una o más bandas)**. Ángulo de la banda αb = 40°.
  - A: 1/2 × 11/32 in, **d_min 3.0 in**, **1/4–10 hp**
  - B: 21/32 × 7/16 in, **d_min 5.4 in**, **1–25 hp**
  - C: 7/8 × 17/32 in, **d_min 9.0 in**, **15–100 hp**
  - D: 1¼ × 3/4 in, **d_min 13.0 in**, **50–250 hp**
  - E: 1½ × 1 in, **d_min 21.6 in**, **100 hp y más**
- **Tabla 17-10**: circunferencias interiores estándar por sección (la lista discreta de longitudes).
- **Tabla 17-11**: cantidad a **sumar a la circunferencia interior para obtener la longitud de paso**:
  A 1.3, B 1.8, C 2.9, D 3.3, E 4.5 in. (Ej.: B75 → Lp = 76.8 in.)
- **"Calculations involving the belt length are usually based on the pitch length"** y las relaciones
  de velocidad se hacen con **diámetros de paso**; *"the stated diameters are usually understood to be
  the pitch diameters even though they are not always so specified"*. ⭐ trampa de nomenclatura.

**Ángulo de la ranura (§17-3) — juicio de fabricación:**
> "The groove angle of a sheave, αs, is made **somewhat smaller** than the belt-section angle, αb.
> This causes the belt to wedge itself into the groove, thus increasing friction. The exact value...
> depends on the belt section, the sheave diameter, and the angle of wrap. **If it is made too much
> smaller than the belt, the force required to pull the belt out of the groove as the belt leaves the
> pulley will be excessive. Optimum values are given in the commercial literature.**"
>
> *"El ángulo de ranura αs se hace ALGO menor que el ángulo de la banda αb: eso hace que la banda se
> acuñe y aumente la fricción. **Si se hace demasiado menor, la fuerza para SACAR la banda de la
> ranura al salir de la polea será excesiva. Los valores óptimos vienen en la literatura comercial.**"*

⭐ Mismo patrón que el ángulo de cono (§16-7): **el límite lo pone la SALIDA, no la entrada.**
Y el valor óptimo el cliente lo delega al fabricante — **no está en el texto extraído**.

**VELOCIDAD RECOMENDADA (regla de oro del cliente, §17-3):**
> "**For best results, a V belt should be run quite fast: 4000 ft/min is a good speed. Trouble may be
> encountered if the belt runs much faster than 5000 ft/min or much slower than 1000 ft/min.**"
>
> *"**Para mejores resultados, la banda V debe correr bastante rápido: 4000 ft/min es una buena
> velocidad. Puede haber problemas si corre mucho más rápido que 5000 ft/min o mucho más lento que
> 1000 ft/min.**"*

⭐ Ventana **1000–5000 ft/min, óptimo ~4000**. Contraintuitivo: la máquina que minimiza velocidad
para "reducir desgaste" sale de la ventana por abajo.

**DISTANCIA ENTRE CENTROS (§17-3):**
> "**Long center-to-center distances are not recommended for V belts because the excessive vibration
> of the slack side will shorten the belt life materially. In general, the center-to-center distance
> should be no greater than three times the sum of the sheave diameters and no less than the diameter
> of the larger sheave.** Link-type V belts have less vibration, because of better balance, and hence
> may be used with longer center-to-center distances."
>
> *"**No se recomiendan distancias entre centros largas en banda V, porque la vibración excesiva del
> lado flojo acorta materialmente la vida de la banda. En general, la distancia entre centros no debe
> ser MAYOR que tres veces la suma de los diámetros de las poleas ni MENOR que el diámetro de la
> polea mayor.**"*

    D_mayor ≤ C ≤ 3(D + d)      ← ventana dura de C
    Lp = 2C + π(D + d)/2 + (D − d)²/(4C)                                       (17-16a)
    C  = 0.25{[Lp − π(D+d)/2] + √([Lp − π(D+d)/2]² − 2(D − d)²)}               (17-16b)

**Base de los ratings y sus ajustes (§17-3):**
> "The basis for power ratings of V belts depends somewhat on the manufacturer; it is not often
> mentioned quantitatively in vendors' literature but is available from vendors. The basis may be a
> number of hours, **24 000 h**, for example, or a life of **10⁸ or 10⁹ belt passes.** Since the
> number of belts must be an integer, **an undersized belt set that is augmented by one belt can be
> substantially oversized.**"
>
> *"...Como el número de bandas debe ser ENTERO, **un juego de bandas subdimensionado al que le sumas
> una banda puede quedar sustancialmente sobredimensionado.**"*

> "**The rating... is for a belt running on equal-diameter sheaves (180° of wrap), of moderate length,
> and transmitting a steady load. Deviations from these laboratory test conditions are acknowledged
> by multiplicative adjustments.**"

    Ha = K1·K2·Htab                                                            (17-17)
    Hd = Hnom·Ks·nd                                                            (17-19)
    Nb ≥ Hd/Ha ,  Nb entero, redondeando hacia ARRIBA                          (17-20)

> "**Designers work on a per-belt basis.**" *(Los diseñadores trabajan POR BANDA.)*

**Fricción efectiva del canal (§17-3):**
> "In a V belt the effective coefficient of friction f′ is f/sin(αs/2), which amounts to **an
> augmentation by a factor of about 3 due to the grooves.** The effective coefficient of friction f′
> is sometimes tabulated against sheave groove angles of αs = 30°, 34°, and 38°. The corresponding
> tabulated values are **f′ = 0.50, 0.45, and 0.40**, respectively, revealing a **belt material-on-metal
> coefficient of friction of f = 0.13** for each case. **The Gates Rubber Company declares its
> effective coefficient of friction to be 0.5123 for grooves.**"

    (F1 − Fc)/(F2 − Fc) = exp(0.5123·φ)                                        (17-18)

⭐ El **0.5123** es un valor de FABRICANTE (Gates), no una constante universal. La ranura multiplica
la fricción **~3×** — la máquina que use f = 0.13 sin dividir entre sin(αs/2) se equivoca por 3.

**Tensiones y vida (§17-3):**

    Fc = Kc·(V/1000)²                          Kc de la Tabla 17-16           (17-21)
    ΔF = 63025·Hd/Nb / [n·(d/2)]                                              (17-22)
    F1 = Fc + ΔF·exp(f′φ)/[exp(f′φ) − 1]                                      (17-23)
    F2 = F1 − ΔF                                                              (17-24)
    Fi = (F1 + F2)/2 − Fc                                                     (17-25)
    nfs = Ha·Nb/(Hnom·Ks)                                                     (17-26)
    T1 = F1 + Kb/d ;  T2 = F1 + Kb/D           Kb de la Tabla 17-16
    NP = [(T1/K)^(−b) + (T2/K)^(−b)]^(−1)      ← regla de MINER, 2 picos      (17-27)
    t = NP·Lp/(720·V)   [horas]                                               (17-28)

⭐ **T2 = F1 + Kb/D, no F2 + Kb/D** — así está escrito en el texto (§17-3). Los DOS picos de tensión
por pasada (uno por cada polea) se suman con **Miner**, no se toma el peor.

**Guardarraíl de validez que el cliente escribe explícitamente (§17-3):**
> "The constants K and b have their ranges of validity. **If NP > 10⁹, report that NP = 10⁹ and
> t > NP·Lp/(720V) without placing confidence in numerical values beyond the validity interval.**"
>
> *"**Si NP > 10⁹, reporta NP = 10⁹ y t > NP·Lp/(720V), SIN darle confianza a valores numéricos fuera
> del intervalo de validez.**"*
Ex. 17-4 lo aplica: NP calculado = 11(10⁹) → se reporta **"greater than 10⁹ passes"** y
**"t > 46 600 h"**.

⭐⭐ **Requisito de producto:** el software debe **saturar y marcar** el resultado, no imprimir
11 000 000 000. Un implementador literal imprimiría el número y mentiría.

**EL PROCEDIMIENTO DE 4 PASOS DE BANDA V (§17-3, literal):**
1. Hallar **V, Lp, C, φ y exp(0.5123φ)**.
2. Hallar **Hd, Ha y Nb = ceil(Hd/Ha)**.
3. Hallar **Fc, ΔF, F1, F2, Fi y nfs**.
4. Hallar **la vida de la banda en pasadas, o en horas, si es posible.**

("if possible" — el propio cliente admite que el paso 4 puede no ser computable.)

**Ex. 17-4 — juicio humano sobre el factor de servicio, textual:**
> "**The service factor of 1.2 was augmented by 0.1 because of the continuous-duty requirement.**"
> *(El factor de servicio 1.2 se AUMENTÓ en 0.1 por el requisito de servicio continuo.)*
Y en el cálculo: Hd = 10(1.2 + 0.1)(1) = 13 hp.

⭐ **Ks de tabla NO es final.** El cliente le suma un delta por servicio 24 h que **no está en la
Tabla 17-15**. Requisito: Ks editable + campo de justificación. El mismo patrón en Ex. 17-5 (cadena):
"an abnormally long 18-hour day, poor lubrication, cold temperatures, dirty surroundings".

---

### §17-4 — BANDAS DENTADAS (TIMING)

Construcción: tela cauchutada recubierta de nylon, **alambre de acero adentro** para tomar la tensión.
> "**The steel wire, the tension member of a timing belt, is located at the belt pitch line. Thus the
> pitch length is the same regardless of the thickness of the backing.**"
> *"El alambre de acero, el miembro a tensión, está en la LÍNEA DE PASO de la banda. Por eso la
> longitud de paso es la misma sin importar el espesor del respaldo."*

**Tabla 17-18** indexada por **servicio** → designación y paso p:
Extra light **XL 1/5 in** · Light **L 3/8 in** · Heavy **H 1/2 in** · Extra heavy **XH 7/8 in** ·
Double extra heavy **XXH 1¼ in**.

Longitudes de paso estándar de **6 a 180 in**; poleas de **0.60 in** de diámetro de paso hasta
**35.8 in**, con **10 a 120** dientes.

**Y aquí el cliente NO nos da el procedimiento (§17-4) — dato de alcance:**
> "**The design and selection process for timing belts is so similar to that for V belts that the
> process will not be presented here.** As in the case of other belt drives, the manufacturers will
> provide an ample supply of information and details on sizes and strengths."
>
> *"El proceso de diseño y selección de bandas dentadas es TAN PARECIDO al de bandas V que no se
> presenta aquí. Como en otras transmisiones por banda, los fabricantes darán amplia información y
> detalles de tamaños y resistencias."*

⭐ **Requisito de alcance explícito:** para timing belts el motor es **el de banda V, reparametrizado**
+ tablas del fabricante. **Tablas de Htab, Ks, K1, K2 para timing NO aparecen en el texto extraído.**

---

### §17-5 — CADENA DE RODILLOS

**Ventajas base:** relación constante (sin deslizamiento ni creep); vida larga; capacidad de mover
varios ejes desde una sola fuente.

    D = p/sin(180°/N)                                                          (17-29)
    V = N·p·n/12   [ft/min]                                                    (17-30)
    ΔV/V = (π/N)·[1/sin(180°/N) − 1/tan(180°/N)]   ← variación cordal          (17-31)
    L/p ≈ 2C/p + (N1 + N2)/2 + (N2 − N1)²/(4π²·C/p)                            (17-34)
    C = (p/4)·[−A + √(A² − 8((N2 − N1)/(2π))²)]                                (17-35)
    A = (N1 + N2)/2 − L/p                                                      (17-36)
    Ha = K1·K2·Htab                                                            (17-37)
    Hd = Hnom·Ks·nd                                                            (17-38)

**Ángulo de articulación (§17-5):**
> "Rotation of the link through this angle causes impact between the rollers and the sprocket teeth
> and also wear in the chain joint. Since the life of a properly selected drive is a function of the
> wear and the surface fatigue strength of the rollers, **it is important to reduce the angle of
> articulation as much as possible.**"

**NÚMERO MÍNIMO DE DIENTES DEL PIÑÓN — regla dura (§17-5):**
> "Although a large number of teeth is considered desirable for the driving sprocket, in the usual
> case it is advantageous to obtain as small a sprocket as possible... **For smooth operation at
> moderate and high speeds it is considered good practice to use a driving sprocket with at least 17
> teeth; 19 or 21 will, of course, give a better life expectancy with less chain noise. Where space
> limitations are severe or for very slow speeds, smaller tooth numbers may be used by sacrificing
> the life expectancy of the chain.**"
>
> *"**Para operación suave a velocidades moderadas y altas se considera buena práctica usar un piñón
> motriz de AL MENOS 17 dientes; 19 o 21 darán mejor expectativa de vida con menos ruido de cadena.
> Donde las limitaciones de espacio sean severas o para velocidades muy bajas, se pueden usar menos
> dientes SACRIFICANDO la expectativa de vida.**"*

⭐ **17 mínimo, 19 o 21 mejor.** No es una restricción dura: es un **trade-off explícito
espacio ↔ vida ↔ ruido** que el usuario debe poder tomar conscientemente.

**LÍMITE SUPERIOR y relación de velocidades (§17-5):**
> "**Driven sprockets are not made in standard sizes over 120 teeth, because the pitch elongation
> will eventually cause the chain to 'ride' high long before the chain is worn out. The most
> successful drives have velocity ratios up to 6:1, but higher ratios may be used at the sacrifice of
> chain life.**"
>
> *"**Las ruedas conducidas no se hacen en tamaños estándar arriba de 120 dientes, porque la
> elongación del paso hará que la cadena 'monte' alto mucho antes de que la cadena esté gastada. Las
> transmisiones más exitosas tienen relaciones de velocidad hasta 6:1, pero se pueden usar mayores
> sacrificando la vida de la cadena.**"*

**PARIDAD (§17-5):**
> "**It is preferable to have an odd number of teeth on the driving sprocket (17, 19, . . .) and an
> even number of pitches in the chain to avoid a special link.**"
> *"**Es preferible tener número IMPAR de dientes en el piñón motriz (17, 19...) y número PAR de
> pasos en la cadena, para evitar un eslabón especial.**"*

⭐ Restricción de **PARIDAD**, no de magnitud. Ex. 17-5: L/p = 75.79 → **"Use 76 pitches"**
(par, y hacia arriba). Un optimizador continuo jamás la respeta.

**Modo de falla (§17-5):**
> "**Roller chains seldom fail because they lack tensile strength; they more often fail because they
> have been subjected to a great many hours of service. Actual failure may be due either to wear of
> the rollers on the pins or to fatigue of the surfaces of the rollers.**"
> *"Las cadenas de rodillos rara vez fallan por falta de resistencia a tensión; fallan más seguido
> por muchísimas horas de servicio: desgaste de rodillos sobre pernos, o fatiga de la superficie de
> los rodillos."*

**LAS 9 CONDICIONES BASE DE LOS RATINGS DE CADENA (§17-5) — la letra chica del catálogo:**
∙ **15 000 h a plena carga** ∙ **Un solo torón** ∙ **Proporciones ANSI**
∙ **Factor de servicio unitario** ∙ **100 pasos de longitud** ∙ **Lubricación recomendada**
∙ **Elongación máxima de 3 %** ∙ **Ejes horizontales** ∙ **Dos ruedas de 17 dientes**

⭐ **"Elongation maximum of 3 percent"** es el criterio de retiro de la cadena, y
**"horizontal shafts"** es una condición que casi nadie recuerda: **ejes verticales invalidan la
tabla.** Ninguna de las 9 es una ecuación; todas son precondiciones del dato tabulado.

**Las dos ecuaciones tras la tabla (§17-5):**

    H1 = 0.004·N1^1.08 · n1^0.9 · p^(3 − 0.07p)   [hp]  ← límite por FATIGA DE PLACAS  (17-32)
    H2 = 1000·Kr·N1^1.5·p^0.8 / n1^1.5            [hp]  ← límite por RODILLOS/IMPACTO  (17-33)
    Htab = min(H1, H2)
    Kr = 29 para cadenas 25, 35 ; 3.4 para 41 ; 17 para 40–240
    La constante 0.004 en (17-32) **pasa a 0.0022 para la cadena no. 41 lightweight**

> "Equation (17-32) is the basis of the **pre-extreme** power entries (vertical entries)... and the
> chain power is limited by **link-plate fatigue**. Equation (17-33) is the basis for the
> **post-extreme** power entries... limited by **impact fatigue**."

**Corrección por desviación de las condiciones base (§17-5):**

    H2 = 1000·[Kr·(N1^1.5/n1)·p^0.8·(Lp/100)^0.4·(15000/h)^0.4]                (17-39)
    H2^2.5·h / (N1^3.75·Lp) = constante      ← forma de trade-off              (17-40)
    (si se usa K1, omitir el término N1^3.75)

> "In Equation (17-40) one would expect the h/Lp term because **doubling the hours can require
> doubling the chain length**, other conditions constant, for the same number of cycles. Our
> experience with contact stresses leads us to expect a load (tension) life relation of the form
> F^a·L = constant. In the more complex circumstance of roller-bushing impact, **the Diamond Chain
> Company has identified a = 2.5.**"

**Límite de velocidad por GALLING (§17-5):**

    n1 ≤ 1000·[82.5 / (7.95^p · 1.0278^N1 · 1.323^(F/1000))]^(1/(1.59·log p + 1.873))  rev/min

> "**The maximum speed (rev/min) for a chain drive is limited by galling between the pin and the
> bushing. Tests suggest** [la ecuación de arriba], where F is the chain tension in lbf."

⭐ Es un límite **empírico**, aparte de H1 y H2, y **depende de la TENSIÓN F** — o sea, hay
acoplamiento: la velocidad máxima depende de la carga.

**LUBRICACIÓN — tipo A / B / C / C′ (§17-5, notas de Tabla 17-20):**
- **Tipo A** — lubricación **manual o por goteo**.
- **Tipo B** — **baño o disco**.
- **Tipo C** — **chorro de aceite** (oil-stream).
- **Tipo C′** — *"type C, but this is a galling region; **submit design to manufacturer for
  evaluation**."* *(zona de galling: manda el diseño al fabricante para que lo evalúe.)*

⭐⭐ **El tipo de lubricación NO es un input: es un OUTPUT de la selección.** Cae de la zona de la
Tabla 17-20 donde aterrizó el punto (chain number, rpm). Y **C′ no es un resultado válido: es un
"consulta al fabricante"** — un estado de terminación que el software debe poder emitir.

**Regla de aceite (§17-5, cierre):**
> "**Lubrication of roller chains is essential in order to obtain a long and trouble-free life.**
> Either a drip feed or a shallow bath in the lubricant is satisfactory. **A medium or light mineral
> oil, without additives, should be used. Except for unusual conditions, heavy oils and greases are
> not recommended, because they are too viscous to enter the small clearances in the chain parts.**"
>
> *"**La lubricación es ESENCIAL** para vida larga y sin problemas. Goteo o baño somero sirven. **Debe
> usarse aceite mineral medio o ligero, SIN aditivos. Salvo condiciones inusuales, NO se recomiendan
> aceites pesados ni grasas, porque son demasiado viscosos para entrar en los claros pequeños de las
> partes de la cadena.**"*

**El procedimiento del Ex. 17-5 (selección de cadena, tal cual):**
1. Función: Hnom, n1, C/p. 2. Elegir nd (1.5). 3. **Elegir Ks (1.3 "for moderate shock")**.
4. Fijar N1 = 17, N2 = 34; K1 = 1.
5. **Barrer el número de torones**: Htab = nd·Ks·Hnom/(K1·K2) para K2 = 1, 1.7, 2.5, 3.3 y **armar
   una TABLA de {torones, Htab requerido, chain number, tipo de lubricación}**.
6. **Decidir** (3 torones de cadena no. 140).
7. Calcular L/p, **redondear a par (76)**, y de ahí sacar C.
8. Reportar la lubricación (Tipo B).
9. **Comentario final honesto:** *"This is operating on the pre-extreme portion of the power, so
   durability estimates other than 15 000 h are not available. **Given the poor operating conditions,
   life will be much shorter.**"*

⭐ **El paso 5 es un BARRIDO, no un cálculo:** el cliente genera un abanico de alternativas
(1/2/3/4 torones ↔ cadena 200/160/140/140 ↔ lubricación C′/C/B/B) y **elige a ojo**, considerando que
más torones baja el número de cadena y **mejora la clase de lubricación requerida**.
⭐ Y el paso 9: el software debe poder decir **"no tengo estimación de durabilidad aquí"** y
**"con estas condiciones, la vida será mucho más corta"** — una advertencia cualitativa sin número.

---

### §17-6 — CABLE DE ACERO (WIRE ROPE)

**Torcido (§17-6):**
- **Regular lay** (el estándar aceptado): alambres torcidos en un sentido para formar los torones,
  torones en sentido opuesto para formar el cable; los alambres visibles quedan ~paralelos al eje.
  **"Regular-lay ropes do not kink or untwist and are easy to handle."**
- **Lang lay**: alambres y torones en el MISMO sentido. **"Lang-lay ropes are more resistant to
  abrasive wear and failure due to fatigue than are regular-lay ropes, but they are more likely to
  kink and untwist."** *(más resistentes a abrasión y fatiga, pero más propensos a acodarse y
  destorcerse.)*

**Alma (§17-6):**
> "Standard ropes are made with a hemp core, which supports and lubricates the strands. **When the
> rope is subjected to heat, either a steel center or a wire-strand center must be used.**"
> *"El alma estándar es de cáñamo, que soporta y lubrica los torones. **Cuando el cable se somete a
> CALOR, hay que usar centro de acero o de torón de alambre.**"*

Designación: 1⅛-in **6 × 7** haulage rope = diámetro × (torones) × (alambres por torón).
Área de metal aproximada de hoisting/haulage estándar: **Am ≈ 0.38·d²**.

    σ = Er·dw/D                                                                (c)
    Fb = σ·Am = Er·dw·Am/D          ← carga equivalente de flexión             (17-41)
    P  = 2F/(d·D)                   ← presión de apoyo en la garganta          (17-42)
    Su = 2000F/(d·D)                ← de imponer p/Su < 0.001                  (17-43)
    Ff = (p/Su)·Su·d·D/2            ← tensión permisible a fatiga              (17-44)
    nf = (Ff − Fb)/Ft                                                          (17-45)
    ns = (Fu − Fb)/Ft   ["sometimes defined as Fu/Ft"]                         (17-46)
    Ft = (W/m + w·l)·(1 + a/g)                                                 (17-47)

**RELACIÓN DE DIÁMETROS D/dw — regla dura (§17-6):**
> "This equation reveals the importance of using a large-diameter sheave. **The suggested minimum
> sheave diameters in Table 17-24 are based on a D/dw ratio of 400. If possible, the sheaves should be
> designed for a larger ratio. For elevators and mine hoists, D/dw is usually taken from 800 to 1000.
> If the ratio is less than 200, heavy loads will often cause a permanent set in the rope.**"
>
> *"**Los diámetros mínimos sugeridos de la Tabla 17-24 se basan en D/dw = 400. Si se puede, diseña
> para una relación MAYOR. Para elevadores y malacates de mina, D/dw se toma usualmente de 800 a
> 1000. Si la relación es menor a 200, las cargas pesadas suelen causar deformación permanente en el
> cable.**"*

⭐ **Tres umbrales: 400 (mínimo tabulado), 800–1000 (elevadores/mina), <200 (deformación permanente).**
Ojo: aquí es D/**dw** (diámetro del ALAMBRE), no D/d (diámetro del cable) — el D/d de la Fig. 17-20 y
Fig. 17-22 es otra cosa.

**Composición de la carga estática (§17-6) — los 4 sumandos:**
∙ el peso conocido o muerto ∙ cargas adicionales por **arranques o paros súbitos** ∙ **cargas de
choque** ∙ **fricción de los rodamientos de las poleas**.

> "the ultimate strength used in this determination **must be reduced by the strength loss that
> occurs when the rope passes over a curved surface** such as a stationary sheave or a pin; see
> Figure 17-20."
> *(hay que REDUCIR la resistencia última por la pérdida al pasar sobre superficie curva.)*
**Fig. 17-20:** % de pérdida de resistencia vs **D/d ratio** (0 a 40), derivada de datos de ensayo
estándar para cables clase 6×19 y 6×17.

**FACTORES DE SEGURIDAD (§17-6):**
> "**For an average operation, use a factor of safety of 5. Factors of safety up to 8 or 9 are used if
> there is danger to human life and for very critical situations.**"
> *"**Para una operación promedio, usa un factor de seguridad de 5. Se usan factores hasta 8 o 9 si
> hay peligro para la vida humana y en situaciones muy críticas.**"*

Nota al pie de la Tabla 17-25: **"Use of these factors does not preclude a fatigue failure."**
*(Usar estos factores NO descarta una falla por fatiga.)* ⭐

**Fatiga — la lectura de la Fig. 17-21 (§17-6):**
> "**The curve implies that a wire rope has a fatigue limit; but this is not true at all. A wire rope
> that is used over sheaves will eventually fail in fatigue or in wear.** However, the graph does show
> that **the rope will have a long life if the ratio p/Su is less than 0.001.**"
>
> *"**La curva sugiere que el cable tiene límite de fatiga; eso no es cierto para nada. Un cable
> usado sobre poleas eventualmente FALLARÁ por fatiga o por desgaste.** Pero la gráfica sí muestra
> que el cable tendrá vida larga si p/Su < 0.001."*

⭐ El cliente advierte contra la lectura ingenua de SU PROPIA gráfica. **Requisito de UI: no ofrecer
"vida infinita" en cable de acero, jamás.**

**Presión de apoyo permisible — advertencia (§17-6):**
> "**The allowable pressures given in Table 17-26 are to be used only as a rough guide; they may not
> prevent a fatigue failure or severe wear. They are presented here because they represent past
> practice and furnish a starting point in design.**"
> *"Las presiones permisibles de la Tabla 17-26 son solo una guía burda; **puede que no eviten una
> falla por fatiga ni un desgaste severo.** Se presentan porque representan la práctica pasada y dan
> un punto de partida."*

**Guías de resistencia del ALAMBRE (§17-6), cuando el vendedor solo da tensión última del CABLE:**
- Improved plow steel (monitor): **240 < Su < 280 kpsi**
- Plow steel: **210 < Su < 240 kpsi**
- Mild plow steel: **180 < Su < 210 kpsi**

Y el consejo de laboratorio:
> "**Practicing engineers who desire to solve Equation (17-43) should determine the wire strength Su
> for the rope under consideration by unraveling enough wire to test for the Brinell hardness.**
> Then Su can be found using Equation (2-21)."
> *"Los ingenieros en ejercicio que quieran resolver la Ec. (17-43) deben determinar Su
> **destorciendo suficiente alambre para probarlo en dureza Brinell.**"*

**Ambigüedad de definición del FS — trampa que el cliente marca (§17-6):**
> "**Be careful when comparing recommended static factors of safety to Equation (17-46), as ns is
> sometimes defined as Fu/Ft.** ... When using factors of safety expressed in codes, standards,
> corporate design manuals, or wire-rope manufacturers' recommendations or from the literature, **be
> sure to ascertain upon which basis the factor of safety is to be evaluated, and proceed
> accordingly.**"
>
> *"**Ten cuidado al comparar factores de seguridad estáticos recomendados contra la Ec. (17-46),
> porque ns a veces se define como Fu/Ft.** ... Al usar factores de códigos, normas, manuales
> corporativos o recomendaciones de fabricantes, **asegúrate de sobre QUÉ BASE se debe evaluar el
> factor de seguridad, y procede en consecuencia.**"*

⭐⭐ **El mismo símbolo `n = 5` significa dos cosas distintas** según si el Fb se resta o no. Requisito:
la definición del FS es un **campo del modelo**, no una constante del código.

**Detección de falla (§17-6) — ventaja operativa:**
> "**Fatigue failure in wire rope is not sudden, as in solid bodies, but progressive, and shows as
> the breaking of an outside wire. This means that the beginning of fatigue can be detected by
> periodic routine inspection.**"

> "In view of the fact that the life of wire rope used over sheaves is only finite, **it is extremely
> important that the designer specify and insist that periodic inspection, lubrication, and
> maintenance procedures be carried out during the life of the rope.**"
> *"...es EXTREMADAMENTE importante que el diseñador **especifique e insista** en que se lleven a cabo
> procedimientos periódicos de inspección, lubricación y mantenimiento durante la vida del cable."*

⭐ El entregable de un cable incluye un **procedimiento de inspección** que el diseñador debe
ESPECIFICAR. El software debe emitirlo, no solo el diámetro.

**Ex. 17-6 (malacate de mina) — el barrido que hace el cliente:** tabula nf contra **d** (0.25 a 1.0
in) × **m** (1 a 4 cables), y observa:
> "Wire rope sizes are discrete, as is the number of supporting ropes. **Note that for each m the
> factor of safety exhibits a MAXIMUM.** Predictably the largest factor of safety increases with m.
> If the required factor of safety were to be 6, only three or four ropes could meet the requirement.
> The sizes are different: ⅝-in ropes with three ropes or ⅜-in ropes with four ropes. **The costs
> include not only the wires, but the grooved winch drums.**"

⭐⭐ **nf tiene un MÁXIMO en d** (porque Fb ∝ d³ crece más rápido que Ff ∝ d). **Más grueso NO siempre
es más seguro.** Un optimizador monótono ("sube d hasta pasar") elige mal. Y el criterio de desempate
final es **COSTO, incluyendo los tambores ranurados del malacate**, no solo el cable.

---

### §17-7 — FLECHAS FLEXIBLES

Dos tipos: **power-drive** (potencia en un solo sentido) y **remote-control / manual-control** (movimiento
en cualquier sentido).

> "**For the power-drive shaft, rotation should be in a direction such that the outer layer is wound
> up.** Remote-control cables have a different lay of the wires forming the cable, with more wires in
> each layer, so that the torsional deflection is approximately the same for either direction of
> rotation."
> *"**En la flecha de potencia, la rotación debe ir en el sentido que ENROLLE la capa exterior.**"*

> "Flexible shafts are rated by specifying the torque corresponding to various radii of curvature of
> the casing. **A 15-in radius of curvature, for example, will give from 2 to 5 times more torque
> capacity than a 7-in radius.**"

> "**When flexible shafts are used in a drive in which gears are also used, the gears should be placed
> so that the flexible shaft runs at as high a speed as possible. This permits the transmission of
> the maximum amount of horsepower.**"
> *"Cuando se usan flechas flexibles junto con engranes, los engranes deben colocarse para que la
> flecha flexible corra **lo más rápido posible**: eso permite transmitir la máxima potencia."*

⭐ Regla de **arquitectura del tren**, no de la pieza: el reductor va **antes o después** según dónde
quede la flecha flexible.

---

## 3. ÍNDICE DE ITERACIONES (dónde el cliente REGRESA y qué lo dispara)

| # | § | Regresa a cambiar… | Disparador |
|---|---|---|---|
| 1 | §16-1 (Ex. 16-1) | El **modelo de presión** (uniforme → trapezoidal) | Sospecha de que pa >> pav; el error resultó 24 % |
| 2 | §16-2 (Ex. 16-2) | La presión pa de la **segunda zapata** | F la fija la zapata auto-energizada; la otra queda subordinada |
| 3 | §16-2 (Ex. 16-2, cierre) | **Voltear la zapata** y quitar forro en el talón | 30 % más capacidad + mejor disipación |
| 4 | §16-2 (16-5) | La dimensión **`a`** del pasador | Debe cumplir MN > Mf para no auto-bloquear |
| 5 | §16-3 (16-15) | La posición **`a` del pivote** simétrico | Si está mal → desgaste asimétrico, forro retirado antes |
| 6 | §16-9 (Ex. 16-5) | **hr y hc** re-leídos de Fig. 16-24a | (T−T∞) supuesto (200 °F) ≠ calculado (139 °F); converge a 220/171 °F |
| 7 | §16-9 (Ex. 16-5) | Cierre contra **Tabla 16-3** | Tmax vs Max Continuous Temperature del material |
| 8 | §17-2 (Ex. 17-2) | El **ancho b** al siguiente disponible | b calculado 8.40 in no existe en catálogo → 10 in, y **re-verificar f′** |
| 9 | §17-2 (Ex. 17-2, cierre) | **Espesor de banda** (A-4, A-5) | Buscar el mejor entre los satisfactorios, con figura de mérito de costo |
| 10 | §17-3 (Ex. 17-4) | **Ks** aumentado en +0.1 | Requisito de servicio continuo 24 h — no está en la Tabla 17-15 |
| 11 | §17-3 (17-27) | **Truncar NP a 10⁹** | Fuera del intervalo de validez de K y b |
| 12 | §17-5 (Ex. 17-5) | **Número de torones** (barrido 1→4) | Baja el chain number Y mejora la clase de lubricación |
| 13 | §17-5 (Ex. 17-5) | **L/p redondeado a par** (75.79 → 76) | Evitar eslabón especial |
| 14 | §17-6 (Ex. 17-6) | Barrido **d × m** | nf tiene un MÁXIMO en d; el desempate lo da el costo (cable + tambores) |
| 15 | §16-12 (Ex. 16-6) | Elegir **cuál lazo** de T−Tm integrar | El de mayor cambio de velocidad, leído de la gráfica |

---

## 4. JUICIOS HUMANOS (lo que el cliente decide, no calcula)

1. **Qué modelo de presión usar** (§16-1). Depende de qué tan chico sea el pad y de cuánto importe el
   pico. El cliente se burla del atajo: *"because the pad was small, or because the arithmetic would
   be easier?"*
2. **Uniforme wear vs uniform pressure** (§16-5). Es una pregunta de **construcción** (rígido vs con
   resortes) y de **edad** (nuevo vs viejo). El cliente resuelve: **siempre desgaste uniforme**,
   porque los nuevos envejecen y f es incierto, y la penalización es ~2 %.
3. **Aceptar o no auto-energizado** (§16-2, §16-6). Ganas capacidad (hasta 30 % en Ex. 16-2) pero
   pierdes robustez ante f (30 % en f → 50 % en pedal). En vehículos el cliente prefiere disco.
4. **Elegir el material de fricción** (§16-10). Siete características ponderadas *"a degree that is
   dependent on the severity of service"*, más **tamaños estándar disponibles**, más wet/dry, y con
   la instrucción explícita de **consultar catálogos y a los fabricantes directamente.**
5. **Wet o dry** (§16-10). f baja, pero saca más calor y permite más presión.
6. **Cuándo importa la temperatura** (§16-8/§16-9): cuando hay **ciclado repetitivo** sin enfriamiento
   suficiente entre aplicaciones. Y aun entonces, el análisis sirve para **señalar parámetros
   sensibles**, no para predecir.
7. **Qué factor de servicio** (§17-3 Tabla 17-15, §17-5). Rangos, no valores: "1.2 to 1.4". El cliente
   escoge dentro del rango y le **suma deltas por condiciones no tabuladas** (servicio 24 h,
   lubricación pobre, frío, suciedad).
8. **Cs del volante** (§16-12). Entrada de diseño. Sin tabla en el texto extraído.
9. **Cuál lazo del diagrama T−θ integrar** (§16-12). Lectura de gráfica.
10. **Cómo mantener la tensión inicial** (§17-2): idler con peso / motor pivotado / catenaria. Es un
    ítem del decision set, no un accesorio.
11. **Ángulo de cono α** (§16-7): 10°–15° por compromiso, sabiendo que <8° hace el desembrague brutal.
12. **Sobre qué base está definido el factor de seguridad del cable** (§17-6): (Fu − Fb)/Ft o Fu/Ft.
13. **Aceptar menos de 17 dientes en el piñón** (§17-5) a cambio de vida, cuando el espacio aprieta.
14. **Qué combinación de d y m** en cable (§17-6): el desempate es **costo total**, incluidos los
    tambores ranurados.

---

## 5. CRITERIOS DE ACEPTACIÓN (qué revisa antes de dar por bueno)

**Frenos y embragues (cap. 16):**
- [ ] pa (máxima, en el punto correcto: θa en zapata interna, la punta/toe en banda, ri en pad anular,
      pmax = pav·(pmax/pav) en pad circular) **≤ p_max del material (Tabla 16-3 / 16-4 / 16-5)**.
- [ ] **f del material** tomado de la tabla, con la advertencia de que varía con temperatura, desgaste
      y ambiente (§16-2, suposición 4).
- [ ] **MN > Mf** si NO se quiere auto-bloqueo (§16-2, Ec. 16-5); o f < f_cr = (c+ū)/a (§16-1).
- [ ] Pivote de zapata simétrica en **a = 4r sin θ2/(2θ2 + sin 2θ2)** (§16-3), o se acepta desgaste
      asimétrico y vida corta.
- [ ] **Par total** = suma sobre zapatas / pares de superficies, con la presión REAL de cada una.
- [ ] Reacciones de pasador calculadas y reportadas (§16-2 Ec. 16-9/16-10) — dimensionan el pasador.
- [ ] **Tmax de estado estable ≤ Max Continuous Temperature del material (Tabla 16-3)** (§16-9,
      Ex. 16-5 lo cierra así explícitamente).
- [ ] **Vmax del material (Tabla 16-3) ≥ velocidad de rim**; y para papel resiliente, **PV < 500 000
      psi·ft/min**.
- [ ] **Área de fricción ≥ Tabla 16-2** para el ciclo de trabajo y la potencia media de frenado.
- [ ] Volante: **Cs objetivo alcanzado**, con ω2 y ω1 reportados y **localizados en θ**.
- [ ] Unidades: `a` del motor en **lbf·in·s/rad** (§16-12).

**Elementos flexibles (cap. 17):**
- [ ] **f′ < f** — la fricción REQUERIDA menor que la disponible (§17-2 paso 8; metal paso 9). Sin
      esto, patina aunque las tensiones estén bien.
- [ ] **nfs = Ha/(Hnom·Ks) ≥ 1** (banda plana, paso 9) / **nfs = Ha·Nb/(Hnom·Ks)** (banda V, 17-26).
- [ ] Tensión inicial **Fi** especificada, con su método de mantenimiento y su **dip** medible (17-13).
- [ ] Poleas planas **coronadas** según Tabla 17-5 (la mayor si solo una; ambas si los ejes no son
      horizontales); corona **redondeada**, Ra ≤ 63 μin.
- [ ] Diámetro de polea **≥ mínimo de Tabla 17-2 / 17-3 / 17-7** (según material).
- [ ] Banda V: **1000 ≤ V ≤ 5000 ft/min** (óptimo ~4000); **D_mayor ≤ C ≤ 3(D+d)**;
      d ≥ **diámetro mínimo de sheave** de Tabla 17-9 y de Tabla 17-17.
- [ ] **Nb entero** hacia arriba, y verificado que no quede grotescamente sobredimensionado.
- [ ] Vida NP **saturada a 10⁹** y marcada si se sale del intervalo de validez.
- [ ] Cadena: **N1 ≥ 17 (impar preferible)**, **N2 ≤ 120**, **relación ≤ 6:1**, **L/p par**,
      **tipo de lubricación reportado** (y si sale **C′ → mandar al fabricante**).
- [ ] Cadena: las **9 condiciones base** verificadas o corregidas (100 pasos, ejes horizontales,
      elongación 3 %, 15 000 h, etc.).
- [ ] Cadena: **n1 ≤ límite de galling** (ecuación empírica que depende de F).
- [ ] Cable: **D/dw ≥ 400** (mejor 800–1000 en elevadores/mina; **nunca < 200**).
- [ ] Cable: **ns y nf** calculados, **con la definición de FS declarada**; comparar contra Tabla 17-25
      sabiendo que **"no descarta falla por fatiga"**.
- [ ] Cable: presión de apoyo P ≤ Tabla 17-26 (**solo como guía burda**).
- [ ] Cable: **procedimiento de inspección/lubricación/mantenimiento especificado**.
- [ ] Todo elemento flexible: **calendario de inspección** y regla de reemplazo *"at the first sign of
      deterioration"* (intro cap. 17).

---

## 6. TABLAS Y CATÁLOGO DURO — QUÉ EXISTE Y QUÉ LO INDEXA

### Capítulo 16

| Tabla | Contenido | **Índice (clave de búsqueda)** | Devuelve |
|---|---|---|---|
| **16-1** | Pad circular caliper (Fazekas) | **R/e** (0.0…0.5) | δ = re/e ; **pmax/pav** |
| **16-2** | Área de material de fricción requerida | **Duty cycle** (Infrequent / Intermittent / Heavy-duty) × **tipo de freno** (band&drum / plate disk / caliper disk) | in²/(Btu/s): 0.85/2.8/0.28 · 2.8/7.1/0.70 · 5.6–6.9/13.6/1.41 |
| **16-3** | **Características de materiales de fricción** | **Material** (14 filas: cermet, sintered metal dry/wet, rigid molded asbestos dry/wet, rigid molded asbestos pads, rigid molded nonasbestos, semirigid/flexible molded asbestos, wound/woven asbestos yarn&wire, woven cotton, resilient paper wet) | **f** · **pmax (psi)** · **Tmax instantánea (°F)** · **Tmax continua (°F)** · **Vmax (ft/min)** · aplicaciones |
| **16-4** | Propiedades de forros de freno | **Tipo de construcción** (Woven / Molded / Rigid block) | Resistencia a compresión y tensión (kpsi y MPa) · Tmax (°F/°C) · Vmax (ft/min, m/s) · pmax (psi/kPa) · **f medio** |
| **16-5** | **Materiales de fricción para embragues** | **Par de materiales** (11 filas: cast iron on cast iron, powdered metal on cast iron / on hard steel, wood, leather, cork, felt, woven/molded/impregnated asbestos, carbon graphite on steel) | **f wet** · **f dry** · Tmax (°F/°C) · pmax (psi/kPa) |
| **16-6** | Datos T(θ) del motor de 1 cilindro | **θ** (0…720° cada 15°) | T en lbf·in (para el ejemplo del volante) |
| Fig. 16-24a | hr y hc en aire quieto | **(T − T∞)** hasta 700 °F | Btu/(in²·s·°F) |
| Fig. 16-24b | Factor de ventilación fv | **velocidad de ventilación forzada (ft/s)** hasta ~80 | multiplicador hasta ~8 |
| Fig. 16-17 | T/(fFD) vs d/D | **d/D** | curvas uniform pressure (new) y uniform wear (old) |

Valores extraídos de la Tabla 16-3 (los más citados): **Cermet** f = 0.32, pmax 150 psi, Tinst 1500 °F,
Tcont 750 °F. **Sintered metal (dry)** f = 0.29–0.33, pmax 300–400, Tinst 930–1020, **Tcont 570–660**,
Vmax 3600. **Sintered metal (wet)** f = 0.06–0.08, pmax 500. **Rigid molded asbestos pads**
f = 0.31–0.49, **pmax 750**, Vmax 4800. **Rigid molded nonasbestos** f = 0.33–0.63, pmax 100–150,
Tcont 500–750, **Vmax 4800–7500**. **Woven cotton** f = 0.47, pmax 100, Tcont 170 °F.
**Resilient paper (wet)** f = 0.09–0.15, pmax 400, **PV < 500 000 psi·ft/min**.
Nota al pie de la Tabla 16-5: *"The friction coefficient can be maintained with ±5 percent for
specific materials in this group."*

**NO existe en el texto extraído:** tabla de Cs recomendado por tipo de máquina; tabla de p_max por
severidad de servicio distinta de la 16-3/16-4/16-5.

### Capítulo 17

| Tabla | Contenido | **Índice (clave de búsqueda)** | Devuelve |
|---|---|---|---|
| **17-1** | Tipos de banda | **Tipo** (flat/round/V/timing) | junta sí-no · rango de tamaño · límite de centros |
| **17-2** | **Propiedades de banda plana y redonda** | **Material** × **especificación/espesor** (Leather 1-ply/2-ply; Polyamide F-0…A-5; Urethane flat/round) | **d_min de polea** · **tensión permisible por unidad de ancho a 600 ft/min (lbf/in)** · peso específico (lbf/in³) · **f** |
| **17-3** | Poleas mínimas, urethane | **Estilo (flat/round) × tamaño de banda × relación velocidad-de-polea/longitud-de-banda** (≤250, 250–499, 500–1000 rev/(ft·min)) | diámetro de polea (in) |
| **17-4** | **Factor de corrección de polea Cp** | **Material** (Leather, Polyamide F-0…A-5) × **diámetro de la polea CHICA** (1.6–4, 4.5–8, 9–12.5, 14–16, 18–31.5, >31.5 in) | Cp (0.5 … 1.0); guiones donde no aplica |
| **17-5** | Altura de corona | **Diámetro ISO de polea** × **w ≤ 10 in o w > 10 in** | crown height (in); nota: redondeada, Ra ≤ 63 μin |
| **17-6** | Vida de banda metálica inox | **D/t** (625, 400, 333, 200) | pasadas (≥10⁶, 0.500e6, 0.165e6, 0.085e6) |
| **17-7** | Polea mínima, banda metálica | **espesor de banda** (0.002…0.040 in) | D_min (1.2…25.0 in) |
| **17-8** | Propiedades de bandas metálicas | **Aleación** (301/302 SS, BeCu, 1075/1095, Titanio, Inconel) | Sy (kpsi) · E (Mpsi) · ν |
| **17-9** | **Secciones estándar de banda V** | **Letra de sección A–E** | ancho a · espesor b · **d_min de sheave** · **rango de HP** |
| **17-10** | Circunferencias interiores estándar | **Sección A–E** | lista discreta de circunferencias (in) |
| **17-11** | Conversión a longitud de paso | **Sección A–E** | sumar 1.3 / 1.8 / 2.9 / 3.3 / 4.5 in |
| **17-12** | **Htab, potencia nominal de banda V** | **Sección** × **diámetro de paso de la sheave** × **velocidad de banda (1000/2000/3000/4000/5000 ft/min)** | hp por banda (interpolar) |
| **17-13** | **K1, factor de ángulo de abrazo** | **(D − d)/C** (0.00…1.50) o **φ en grados** | K1 para **VV** y para **V-flat** (columnas distintas); curva-ajuste K1 = 0.143543 + 0.007468φ − 0.000015052φ², válida 90° ≤ φ ≤ 180° |
| **17-14** | **K2, factor de longitud de banda** | **Sección A–E** × **longitud nominal (in)** | K2 = 0.85 … 1.20 |
| **17-15** | **Ks, factores de servicio** (V, y también flat/round) | **Maquinaria conducida** (Uniform / Light shock / Medium shock / Heavy shock) × **Fuente de potencia** (Normal torque / High or nonuniform torque) | **1.0–1.2 · 1.1–1.3 // 1.1–1.3 · 1.2–1.4 // 1.2–1.4 · 1.4–1.6 // 1.3–1.5 · 1.5–1.8** (RANGOS, no valores) |
| **17-16** | Parámetros Kb y Kc | **Sección de banda** (A,B,C,D,E,3V,5V,8V) | Kb (220…10850) · Kc (0.425…5.041) |
| **17-17** | **Durabilidad de banda V** | **Sección** × **rango de picos de fuerza (10⁸–10⁹ o 10⁹–10¹⁰)** | K y b · **diámetro mínimo de sheave** |
| **17-18** | Pasos estándar de timing belt | **Servicio** (extra light…double extra heavy) | designación XL/L/H/XH/XXH y paso p |
| **17-19** | **Cadenas ANSI, una hebra** | **ANSI chain number** (25, 35, 41, 40, 50, 60, 80, 100, 120, 140, 160, 180, 200, 240) | **paso** · ancho · **resistencia mínima a tensión** · peso/ft · diámetro de rodillo · **espaciamiento entre hebras** |
| **17-20** | **Htab de cadena, sprocket de 17 dientes** | **ANSI chain number** × **velocidad del sprocket (rev/min, 50…3000)** | hp; **y la ZONA determina el tipo de lubricación A / B / C / C′** |
| **17-21** | Conteos de dientes disponibles | **ANSI chain number** | lista discreta de dientes disponibles de un proveedor |
| **17-22** | **K1, corrección por dientes** | **N1 (dientes del piñón motriz)**, 11…20 y fórmula general | **dos columnas: pre-extreme (N1/17)^1.08 y post-extreme (N1/17)^1.5** |
| **17-23** | **K2, factor de multi-hebra** | **número de torones** (1,2,3,4,5,6,8) | 1.0 / 1.7 / 2.5 / 3.3 / 3.9 / 4.6 / 6.0 |
| **17-24** | **Datos de cable de acero** | **Construcción del cable** (6×7, 6×19, 6×37, 8×19, 7×7, 7×9, 19-wire aircraft) × **material** (monitor / plow / mild plow / corrosion-resistant / carbon steel) | peso/ft · **diámetro mínimo de sheave (múltiplo de d)** · tamaños estándar · **tamaño del alambre exterior** · E (Mpsi) · **resistencia (kpsi)** |
| **17-25** | **FS mínimos para cable** | **Aplicación** (track cables, guys, mine shafts por profundidad, hoisting, haulage, cranes/derricks, electric hoists, hand/private elevators, dumbwaiters, grain elevators) **+ elevadores por ft/min** | FS 3.2 … 11.90; nota: **no descarta falla por fatiga** |
| **17-26** | **Presión de apoyo permisible** | **Construcción del cable** (6×7/6×19/6×37/8×19) × **lay (regular/Lang)** × **material de la sheave** (wood, cast iron, cast steel, chilled cast iron, manganese steel) | psi (150 … 3500) |
| **17-27** | Propiedades útiles 6×7/6×19/6×37 | **Construcción** | peso/ft (con y sin alma) · **D_min** · **"Better" sheave diameter** · dw · **Am** · **Er** |
| Fig. 17-9 | Cv, banda de piel | **velocidad (ft/min)** × **espesor (11/64, 13/64, 18/64+20/64, 25/64)** | Cv (0.7…1.0) |
| Fig. 17-20 | Pérdida de resistencia | **D/d ratio** (0–40) | % de pérdida |
| Fig. 17-21 | Fatiga de cable | **construcción (6×12, 6×19, 6×24, 6×37)** × **número de flexiones a la falla** | p/Su |
| Fig. 17-22 | Vida relativa | **D/d ratio** | % de vida relativa (D/d = 48 → el doble que 33) |
| Fig. 17-18 | Variación cordal | **número de dientes N** | % de variación |

⭐ **Dos tablas tienen DOS columnas para la misma entrada** y elegir mal es un error silencioso:
**17-13** (VV vs V-flat) y **17-22** (pre-extreme vs post-extreme). La segunda es peor: cuál columna
usar depende de en qué **lado del pico** de la Tabla 17-20 esté el punto de operación.

---

## 7. ⭐⭐ LOS DIEZ DETALLES QUE UNA MÁQUINA LINEAL SE SALTARÍA

**⭐1 — El modelo de presión es un JUICIO, no un default (§16-1, §16-5, §16-6).**
El cliente resuelve el mismo problema dos veces (Ex. 16-1) y demuestra que la suposición cómoda de
presión uniforme **subestima el pico 24 %**. Y en §16-5 la pregunta correcta al usuario no es
"¿uniform wear o uniform pressure?", es **"¿discos rígidos o con resortes? ¿nuevo o rodado?"**.
El implementador literal codifica una fórmula; el cliente codifica una decisión.

**⭐2 — "El nuevo se hará viejo": por qué desgaste uniforme siempre (§16-5).**
Presión uniforme SIEMPRE predice más par → no conservadora. La diferencia en d/D ∈ [0.6, 1] es de
solo ~2 %. Pero el argumento decisivo del cliente no es numérico: *"the certainty that new clutches
get old"*. Es un razonamiento de **ciclo de vida**, no de física del instante. Ninguna máquina que
solo traduce ecuaciones llega ahí.

**⭐3 — F NO se multiplica por el número de superficies; T SÍ (§16-5).**
La Ec. (16-23) *"holds for any number of friction pairs or surfaces"*; la (16-25) es **por un solo par
en contacto** y hay que multiplicarla. Es la trampa más fácil de todo el capítulo 16.

**⭐4 — Dónde ocurre la presión máxima cambia con la GEOMETRÍA, no es un punto fijo (§16-2, §16-4, §16-6).**
Zapata interna corta → pa en θ2. Zapata interna larga → pa en **θa = 90°**. Banda → **en la punta
(toe)**. Pad anular con desgaste uniforme → **en ri**. Pad circular → pav × (pmax/pav) de la
**Tabla 16-1** (hasta **1.875×** a R/e = 0.5). Comparar el valor equivocado contra p_max del material
rompe el diseño en silencio.

**⭐5 — El auto-energizado se DOSIFICA con la dimensión `a`, y hay que evitar activamente el
auto-bloqueo (§16-1, §16-2, §16-3).**
*"So to avoid self-locking, the dimension a must be such that MN > Mf"*. `a` es variable de diseño,
no dato. Y la decisión de aceptarlo tiene precio cuantificado: **30 % de caída en f → 50 % de cambio
en la fuerza de pedal** (§16-6). Y el signo del auto-energizado se **invierte** entre zapata interna
y externa según el sentido de giro.

**⭐6 — El análisis térmico es un motor de SENSIBILIDAD, y es un PUNTO FIJO (§16-9).**
El cliente dice de su propio modelo: *"it would be most unlikely that such an analysis would even
approximate experimental results... most useful in pinpointing those design parameters that have the
greatest effect"*. Y hr/hc dependen de (T − T∞), que es la incógnita → **el Ex. 16-5 itera de 209 °F
a 220 °F**. Una máquina imprime un número sin iterar y sin advertencia; el cliente itera y luego
**cierra contra la Tmax continua de la Tabla 16-3**.

**⭐7 — El paso "f′ < f" es lo que separa un diseño que funciona de uno que patina (§17-2, §17-3).**
Los pasos 1–7 dan tensiones que "aguantan". El paso 8 pregunta otra cosa: **¿la fricción REQUERIDA
por esas tensiones existe realmente?** Ex. 17-1: f′ = 0.328 < 0.8 ✓. Ex. 17-2: se despeja el ancho
**al cual la fricción queda justo plenamente desarrollada** (b = 8.40 in) y se sube al disponible
(10 in) porque *"a belt width greater than 8.40 in will develop friction less than f = 0.80"*.
Y ojo: la fórmula de f′ **cambia** entre banda elastomérica (con Fc) y banda metálica (sin Fc).

**⭐8 — Los catálogos son dominios DISCRETOS y el redondeo tiene REGLAS, distintas en cada elemento
(§17-2, §17-3, §17-5).**
Ancho de banda plana → **al siguiente disponible** (8.40 → 10 in). Nb de bandas V → **entero hacia
arriba**, con la advertencia de que *"an undersized belt set that is augmented by one belt can be
substantially oversized"*. Longitud de cadena → **al PAR más cercano hacia arriba** (75.79 → 76) para
evitar eslabón especial. Dientes del piñón → **impar preferible**. Un optimizador continuo viola las
cuatro.

**⭐9 — Los guardarraíles de validez y los estados "no sé" son requisitos, no cortesías
(§17-3, §17-5, §17-6).**
Vida de banda V: *"If NP > 10⁹, report that NP = 10⁹ ... **without placing confidence in numerical
values beyond the validity interval**"* → el Ex. 17-4 calcula 11×10⁹ y **reporta ">10⁹"**.
Lubricación de cadena tipo **C′** no es un resultado: es *"submit design to manufacturer for
evaluation"*. Ex. 17-5 cierra con *"durability estimates other than 15 000 h are not available...
given the poor operating conditions, **life will be much shorter**"*. Cable: la Fig. 17-21 *"implies
that a wire rope has a fatigue limit; **but this is not true at all**"*. El software debe poder
**saturar, marcar, escalar al fabricante y advertir sin número.**

**⭐10 — Más grueso no es más seguro, y el desempate final es COSTO (§17-6, §17-2).**
En cable, nf = (Ff − Fb)/Ft con Ff ∝ d y **Fb ∝ d³** → *"for each m the factor of safety exhibits a
maximum"*. Subir d monótonamente **empeora** nf pasado el óptimo. Y el criterio de cierre no es el
FS: *"The costs include not only the wires, but the grooved winch drums"*. Igual en banda plana:
*"With a figure of merit available reflecting cost, thicker belts (A-4 or A-5) could be examined to
ascertain **which of the satisfactory alternatives is best**"*. **Satisfactorio ≠ mejor.** El cliente
quiere un **conjunto de alternativas satisfactorias ordenado por costo**, no una respuesta.

### Menciones honoríficas (casi entran al top 10)

- **El entregable incluye MANTENIMIENTO.** Intro cap. 17: calendario de inspección + reemplazo *"at
  the first sign of deterioration"*. §17-2: Fi debe ser *"(1) provided, (2) sustained, (3) in the
  proper amount, and (4) maintained by routine inspection"* — **sin Fi no hay par, punto**. §17-6:
  *"it is extremely important that the designer specify and insist"* en inspección periódica.
- **Ks de tabla no es final.** Ex. 17-4 le suma +0.1 por servicio continuo; Ex. 17-5 acumula
  condiciones no tabuladas (18 h/día, mala lubricación, frío, suciedad).
- **Las 9 condiciones base del rating de cadena** — sobre todo *"horizontal shafts"* y
  *"elongation maximum of 3 percent"*.
- **La ambigüedad del FS de cable**: ns = (Fu − Fb)/Ft **o** Fu/Ft. El mismo "5" significa dos cosas.
- **El coronado de poleas**: la mayor si solo una; ambas si los ejes no son horizontales; redondeada
  y con Ra ≤ 63 μin.
- **La banda V quiere correr RÁPIDO**: 1000–5000 ft/min, óptimo 4000. Contraintuitivo.
- **El límite del cono lo pone el DESEMBRAGUE** (α < 8° → fuerza de desembrague enorme), igual que el
  límite del ángulo de ranura de la sheave lo pone la SALIDA de la banda.
- **El disco axial es el cono con α = 90°** — un solo motor, no dos.
- **Bandas metálicas: se abandona Marin a propósito** por la incertidumbre de la soldadura a tope.

---

## 8. LO QUE **NO APARECE** EN EL TEXTO EXTRAÍDO (para no inventarlo)

- **Tabla de Cs (coeficiente de fluctuación) recomendado por tipo de máquina.** Solo hay Cs = 0.1
  usado en el Ex. 16-6 y Cs = 0.30 en un enunciado de problema.
- **Valores óptimos del ángulo de ranura αs** de la sheave: el cliente los delega a *"the commercial
  literature"* (§17-3).
- **Procedimiento de selección y tablas de potencia para bandas dentadas (timing):** el cliente lo
  omite a propósito (§17-4).
- **Tablas de diseño para flechas flexibles (§17-7):** solo la relación cualitativa "radio de 15 in da
  de 2 a 5 veces más par que radio de 7 in".
- **Constantes m y A para resolver la Ec. (10-14) de Su del alambre de cable** — el cliente dice
  explícitamente *"the constants m and A needed to solve Equation (10-14), for Su are lacking"* y
  manda a medir dureza Brinell (§17-6).
- **Tratamiento de zapatas flotantes (floating shoes)** — mencionadas y explícitamente excluidas del
  libro (§16-2).
- **Análisis de la estática de los mecanismos de accionamiento** (solenoides, palancas, toggles) —
  remitido al cap. 3 (§16-3).
- **Tablas métricas de bandas V** — mencionadas, no incluidas; *"the procedure for analyzing and
  designing them is the same"* (§17-3).
