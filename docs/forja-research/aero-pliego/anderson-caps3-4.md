# Anderson, *Fundamentals of Aerodynamics* 6ª ed., caps. 3–4 — EL MOTOR 2D

**Fuente:** `docs/forja-research/manuales/aero/txt/anderson.txt`, líneas **9868–19627** (leído completo).
Cap. 3 = líneas 9868–15094 = **pp. 205–320**. Cap. 4 = líneas 15095–19627 = **pp. 321–421**.
**Fecha:** 2026-08-04. **Análisis:** agente Forja (bloque Anderson 3–4).

> Cómo leer las citas: `[§3.17, p.286]` = sección 3.17, página 286 del libro impreso. El `.txt`
> conserva los encabezados de página, así que toda página citada es verificable.
> Las ecuaciones llevan **el número del libro** entre paréntesis: `(3.101)`, `(4.18)`, etc.
> Todo lo que va fuera del libro está marcado `[EXTENSIÓN DECLARADA]`.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

El cliente (Raymer) dimensiona aviones a mano y necesita **coeficientes**: `cl`, `cm`, `cd`,
`alpha_L=0`, `cl_max`. Estos dos capítulos son **de dónde salen esos números**. Es la única
parte de los tres manuales que entrega un **solver ejecutable**: el resto describe procesos y
correlaciones; aquí hay un algoritmo que corre en el navegador y devuelve la distribución de
presión sobre una geometría que el usuario **dibujó en el CAD**.

El arco de los dos capítulos es una sola idea sostenida:

1. **Bernoulli** convierte velocidad en presión → `Cp` (§3.2, §3.5).
2. Si el flujo es **irrotacional e incompresible**, todo el campo obedece **la ecuación de
   Laplace** (§3.7), que es **lineal** → puedo **sumar** soluciones.
3. Existen cuatro **soluciones elementales** (uniforme, fuente, doblete, vórtice; §3.9–§3.14)
   que se suman para construir cuerpos: el óvalo, el cilindro (§3.11–§3.13).
4. Ese método es **indirecto**: sumas cosas y ves qué cuerpo sale. Inútil para diseño. §3.17
   lo invierte: **el MÉTODO DE PANELES DE FUENTES** — tú das la geometría, el método
   resuelve las intensidades. Este es **el algoritmo #1 del producto** (`panel2d.ts`).
5. Las fuentes no tienen circulación → **no dan sustentación**. Para eso hacen falta
   **vórtices** (§3.14) y el **teorema de Kutta-Joukowski** `L' = rho·V_inf·Gamma` (§3.16).
6. Pero `Gamma` no está determinada por las matemáticas: hay **infinitas** soluciones
   potenciales válidas (§3.15, §4.5). La naturaleza escoge una: **la condición de Kutta**
   (§4.5), justificada físicamente por el **vórtice de arranque** y el **teorema de Kelvin**
   (§4.6). Esta es la pieza conceptual que el ingeniero del cliente TIENE que entender.
7. Con Kutta impuesta, sale la **teoría del perfil delgado** en forma cerrada (§4.7 simétrico,
   §4.8 con curvatura): `cl = 2·pi·(alpha − alpha_L=0)`, pendiente `2·pi` por radián, centro
   aerodinámico en `c/4`. Es lo que Raymer usa a mano.
8. Y el mismo truco de paneles, ahora con vórtices y con Kutta impuesta numéricamente:
   **§4.10 el MÉTODO DE PANELES DE VÓRTICES** — geometría arbitraria, espesor arbitrario,
   ángulo arbitrario. Este es **el algoritmo #2** y el que de verdad sirve dentro del CAD.
9. Y el capítulo cierra con la **honestidad**: la teoría da **arrastre CERO** (d'Alembert,
   §3.13/§3.20) y **no predice el desplome** (§4.13). §4.12 mete la viscosidad a mano para
   recuperar el arrastre. Ese es el **rango de validez** del motor completo.

**Lo que este bloque NO cubre y hay que ir a buscar a otro lado:** ala finita / 3D (cap. 5),
compresibilidad (caps. 8, 11 — aquí todo es `M < 0.3`), capa límite de verdad (caps. 15–20).

---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§] requisito (APRENDER | CONSTRUIR | AMBOS)`

### aero2d — el solver (el corazón del producto)

| # | § | Requisito | Tipo |
|---|---|---|---|
| R1 | §3.2, §3.5 | Calcular `Cp = 1 − (V/V_inf)²` en cualquier punto y sobre cualquier superficie; `Cp` es **solo función de la forma y la orientación** en flujo incompresible no sustentador (velocidad y densidad son irrelevantes). | AMBOS |
| R2 | §3.7 | El campo se rige por `∇²phi = 0` y `∇²psi = 0`. Por ser **lineal**, la suma de soluciones es solución → el motor debe estar construido sobre **superposición**, no sobre una malla. | AMBOS |
| R3 | §3.9–§3.14 | Implementar los cuatro flujos elementales (uniforme, fuente/sumidero, doblete, vórtice) con `phi`, `psi` y `(V_r, V_theta)` exactos de la Tabla 3.1. | CONSTRUIR |
| R4 | §3.13 | Cilindro sin sustentación: `Cp = 1 − 4·sin²(theta)` exacto. **Fixture de oro** del solver. | CONSTRUIR |
| R5 | §3.15 | Cilindro con circulación: `cl = Gamma/(R·V_inf)`; los puntos de estancamiento migran según `Gamma/(4·pi·V_inf·R)` con tres regímenes distintos (`<1`, `=1`, `>1`). | AMBOS |
| R6 | §3.16 | Kutta-Joukowski `L' = rho_inf·V_inf·Gamma` para **cualquier** sección cilíndrica, con la advertencia de que `Gamma` debe evaluarse sobre una curva **que encierre el cuerpo**. | AMBOS |
| **R7** | **§3.17** | **MÉTODO DE PANELES DE FUENTES**: dada una geometría cerrada arbitraria, discretizarla en `n` paneles rectos, imponer no-penetración en el punto de control (punto medio) de cada panel, armar la matriz `n×n`, resolver las `lambda_j`, y sacar `V_i` y `C_p,i`. Sin sustentación. | CONSTRUIR |
| R8 | §3.17 | Verificación independiente obligatoria del solver de fuentes: `sum(lambda_j · S_j) = 0` — ec. (3.157). Si no da cero, el cuerpo está inyectando o absorbiendo masa. | CONSTRUIR |
| R9 | §4.4, §4.5 | **Condición de Kutta**: `gamma(TE) = 0` — ec. (4.10). Debe ser un objeto explícito del solver, no un detalle enterrado. | AMBOS |
| R10 | §4.6 | Teorema de Kelvin `D(Gamma)/Dt = 0` y **vórtice de arranque**: `Gamma_perfil = −Gamma_arranque`. Es la justificación FÍSICA de R9. | APRENDER |
| R11 | §4.7 | Perfil delgado simétrico: `gamma(theta) = 2·alpha·V_inf·(1+cos theta)/sin theta`, `cl = 2·pi·alpha`, `cm_le = −cl/4`, `cm_c/4 = 0`. | AMBOS |
| R12 | §4.8 | Perfil delgado con curvatura: serie de Fourier `A0, An` a partir de `dz/dx`; `alpha_L=0`, `cl`, `cm_c/4`, `x_cp`. | AMBOS |
| R13 | §4.9 | Centro aerodinámico calculable de datos medidos: `x_ac = −m0/a0 + 0.25` — ec. (4.71). | AMBOS |
| **R14** | **§4.10** | **MÉTODO DE PANELES DE VÓRTICES**: mismo esqueleto que R7 pero con vórtices, **más** la condición de Kutta `gamma_i = −gamma_{i−1}` y el descarte de un punto de control para cerrar el sistema. Salida: `V_i = gamma_i`, `Cp_i`, `Gamma = sum(gamma_j·s_j)`, `L' = rho·V_inf·Gamma`. | CONSTRUIR |
| R15 | §4.10 | Distribución de paneles **no uniforme**: muchos paneles chicos en borde de ataque y borde de salida, pocos y grandes en el centro. Es requisito de exactitud, no cosmético. | CONSTRUIR |
| R16 | §4.10 | Soportar la combinación **fuentes + vórtices** ("fuentes para el espesor, vórtices para la circulación") porque mitiga los problemas numéricos del método de vórtices puro. | CONSTRUIR |

### geometria

| # | § | Requisito | Tipo |
|---|---|---|---|
| R17 | §4.2 | Nomenclatura del perfil como objeto geométrico: línea de curvatura media, línea de cuerda, cuerda `c`, curvatura, espesor, borde de ataque, borde de salida, radio del borde de ataque. | AMBOS |
| R18 | §4.2 | Generador de perfiles NACA (4 dígitos, 5 dígitos, serie 6) a partir de sus dígitos. El NACA 4412 y el NACA 23012 traen su **línea de curvatura media analítica** en el libro (§4.8 Ej. 4.6 y Problema 4.6) — son fixtures exactos. | CONSTRUIR |
| R19 | §3.17, §4.10 | Convertir una **geometría del CAD** (polilínea cerrada del croquis) en paneles con puntos frontera `(X_j, Y_j)`, ángulos `Theta_j`, longitudes `S_j` y normales `n_i`. Esta es la costura CAD↔solver. | CONSTRUIR |

### viscoso — lo que el potencial no ve

| # | § | Requisito | Tipo |
|---|---|---|---|
| R20 | §4.12 | `cd = cd_f + cd_p` (fricción + presión por separación). El motor potencial da `cd_p = 0` y `cd_f = 0`: **ambos hay que meterlos a mano**. | AMBOS |
| R21 | §4.12.1–2 | Estimación de fricción por placa plana: `Cf = 1.328/sqrt(Re_c)` laminar (4.86) y `Cf = 0.074/Re_c^(1/5)` turbulento (4.88), **por una cara**; multiplicar por 2 para el perfil. | CONSTRUIR |
| R22 | §4.12.3 | Transición: `Re_x,cr = rho·V·x_cr/mu` (4.89) y la fórmula compuesta (4.92) para placa mixta laminar+turbulenta. El `Re_cr` **lo aporta el usuario**, no el software. | AMBOS |
| R23 | §4.12.4, §4.13 | Marcar en la UI el **gradiente adverso de presión** (`dp/dx > 0`) sobre la superficie: es el predictor de separación que sale gratis del solver potencial. | CONSTRUIR |
| R24 | §4.13 | Declarar el **límite de validez**: por arriba del ángulo de desplome, el resultado del solver es inválido. Debe salir una advertencia, no un número. | AMBOS |

### escuela

| # | § | Requisito | Tipo |
|---|---|---|---|
| R25 | §3.13, §3.20 | Enseñar **d'Alembert** como el fallo honesto de la teoría: arrastre cero por simetría de la distribución de presión. | APRENDER |
| R26 | §4.5 | Enseñar por qué la condición de Kutta es **física y no matemática**, incluyendo §4.5.1 "sin fricción no habría sustentación". | APRENDER |
| R27 | §4.13 | Enseñar los tres tipos de desplome (borde de ataque, borde de salida, perfil delgado) ligados al **espesor**. | APRENDER |

---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

### 2.0 Los supuestos que cargan TODO el capítulo

Todo lo de estos dos capítulos vive bajo cuatro supuestos simultáneos. Si uno se cae, se cae
el resultado:

1. **Incompresible** (`rho = const`). Válido para `M < 0.3` aproximadamente. Fuera: hay que
   ir al cap. 8 en adelante.
2. **No viscoso** (inviscid). Consecuencia dura: `c_f = 0` y **arrastre = 0**.
3. **Irrotacional** (`∇×V = 0`) en todo el campo salvo en las singularidades. Esto es lo que
   permite `V = ∇phi` y por tanto Laplace.
4. **Estacionario** y **bidimensional**.

---

### 2.0.1 BERNOULLI (§3.2, pp. 209–212)

Cadena de derivación, desde la ecuación de momento (2.113a) sin viscosidad ni fuerzas de cuerpo
y **estacionaria**, aplicada **a lo largo de una línea de corriente**:

```
dp = −rho · V · dV                                                         (3.12)  ← ecuación de EULER
```
*"It applies to an **inviscid flow with no body forces**, and it relates the change in velocity
along a streamline dV to the change in pressure dp along the same streamline."* [p.211].
Nótese: **(3.12) NO exige incompresible.** El supuesto entra al integrar.

Integrando con `rho = const` entre dos puntos 1 y 2 de la misma línea de corriente:

```
p1 + (1/2)·rho·V1² = p2 + (1/2)·rho·V2²                                    (3.13)
p  + (1/2)·rho·V²  = const   (a lo largo de una línea de corriente)        (3.14)
p  + (1/2)·rho·V²  = const   (en TODO el campo, si es irrotacional)        (3.15)
```

**LA CONDICIÓN QUE HABILITA (3.15) — el permiso que usa todo el capítulo** [§3.2, p.211]:

> *"In the derivation of Equations (3.13) and (3.14), **no stipulation has been made as to whether
> the flow is rotational or irrotational—these equations hold along a streamline in either
> case**. For a general, rotational flow, the value of the constant in Equation (3.14) **will
> change from one streamline to the next**. However, **if the flow is irrotational, then
> Bernoulli's equation holds between any two points in the flow, not necessarily just on the same
> streamline.**"*

Supuestos acumulados de (3.13): **no viscoso + sin fuerzas de cuerpo + estacionario +
`rho` constante + misma línea de corriente** (o irrotacional para levantar la última).

**Resumen del §3.21 [p.308]** — cópialo al docstring del módulo:
> *"(a) Applies to inviscid, incompressible flows only. (b) Holds along a streamline for a
> rotational flow. (c) Holds at every point throughout an irrotational flow. (d) In the form
> given above, body forces (such as gravity) are neglected, and steady flow is assumed."*

**La advertencia que Anderson repite tres veces** [§3.4, p.229]:
> *"Experience has shown that some students when first introduced to aerodynamics seem to adopt
> Bernoulli's equation as the gospel and tend to use it for all applications, **including many
> cases where it is not valid.** Hopefully, the repetitive warnings given above will squelch such
> tendencies."*
Lista explícita de lo que se cae con ella fuera del rango incompresible: **(3.26) venturi,
(3.32) túnel de viento, (3.34) Pitot, (3.35) `q = p0 − p1`**.

**Método de 3 pasos que gobierna todo el motor** [§3.8, p.242, literal]:
> *"1. Solve Laplace's equation for phi […] or psi […] along with the proper boundary conditions.
> 2. Obtain the flow velocity from V = ∇phi or u = ∂psi/∂y and v = −∂psi/∂x.
> 3. Obtain the pressure from Bernoulli's equation […] steps 1 to 3 are all that we need to solve
> a given problem **as long as the flow is incompressible and irrotational**."*

Y un ahorro de cómputo justificado por el libro [§3.2, p.212]: *"the energy equation is redundant
for the analysis of inviscid, incompressible flow. For such flows, the continuity and momentum
equations suffice."*

---

### 2.0.2 EL COEFICIENTE DE PRESIÓN (§3.5, pp. 235–237)

```
Cp ≡ (p − p_inf) / q_inf ,      q_inf = (1/2)·rho_inf·V_inf²               (3.36)
Cp = 1 − (V / V_inf)²                                                      (3.38)
p  = p_inf + q_inf · Cp
```

> **(3.36) es una DEFINICIÓN** y *"is used throughout aerodynamics, from incompressible to
> hypersonic flow"* [p.235]. **(3.38) NO**: *"note that the form of Equation (3.38) holds for
> **incompressible flow only**"* [p.235]. Son dos cosas distintas y confundirlas es el error
> clásico. Igual pasa con `q = (1/2)rho V²`, que es definición universal, frente a
> `q1 = p0 − p1` (3.35), que **solo vale incompresible**.

**Cotas de `Cp`** [p.236]:
- En un punto de estancamiento (`V = 0`), incompresible: **`Cp = 1.0` siempre**, y
  *"This is the **highest allowable value of Cp anywhere in the flow field**. (For compressible
  flows, Cp at a stagnation point is greater than 1.0…)"*
- Donde `V > V_inf` o `p < p_inf`, `Cp` es **negativo** (sin cota inferior teórica).

**La invariancia que permite escalar del túnel al vuelo** [p.237]:
> *"Cp will **not change with V_inf or rho_inf as long as the flow can be considered inviscid and
> incompressible**. For such a flow, once the Cp distribution over the body has been determined by
> some means, the same Cp distribution will exist for all freestream values of V_inf and rho_inf."*

**EL GATE DE COMPRESIBILIDAD — y hay que aplicarlo LOCALMENTE** [§3.5, p.237]:
```
M_local < 0.3   ⇒   esencialmente incompresible
a (nivel del mar) = 1117 ft/s
```
El Ejemplo 3.12 es la trampa hecha lección: `M_inf = 300/1117 = 0.269` **pasa** el criterio, pero
sobre el extradós `M_local > 753/1117 = 0.674` y **la respuesta de (3.38) es incorrecta**. El
propio libro lo dice: *"the answer given in part (b) of Example 3.12 is not correct."*

> **REQUISITO DE PRODUCTO (R-gate):** el solver debe evaluar el criterio de incompresibilidad
> con la **velocidad máxima local** (el pico negativo de `Cp`), no con `V_inf`. Con `Cp_min`
> conocido, `V_max = V_inf·sqrt(1 − Cp_min)`. Si `V_max/a > 0.3`, el estudio sale con bandera
> roja de compresibilidad **aunque el ensayo sea de baja velocidad**. Y el libro avisa que
> `a` **baja** en la expansión, así que dividir entre `a_SL` da una **cota inferior** del Mach
> local, no el valor.

Y la condición de incompresibilidad como ecuación de campo [§3.6, p.238]:
```
∇ · V = 0                                                                  (3.39)
```
Único supuesto: `rho = const`. **No** exige no viscoso, ni irrotacional, ni estacionario.

---

### 2.0.3 LAPLACE Y LA SUPERPOSICIÓN (§3.7, pp. 238–242) — la arquitectura del motor

```
∇²phi = 0                                                                  (3.40)
∇²psi = 0     (2D)                                                         (3.46)
```

Formas del operador que da el libro para `phi` [p.239]:
```
cartesianas:  ∂²phi/∂x² + ∂²phi/∂y² + ∂²phi/∂z² = 0                        (3.41)
cilíndricas:  (1/r)·∂/∂r( r·∂phi/∂r ) + (1/r²)·∂²phi/∂theta² + ∂²phi/∂z² = 0  (3.42)
esféricas:    (1/(r²·sin th))·[ ∂/∂r(r²·sin th·∂phi/∂r)
                              + ∂/∂th(sin th·∂phi/∂th)
                              + ∂/∂Phi((1/sin th)·∂phi/∂Phi) ] = 0         (3.43)
```
(`∇²psi = 0` el libro solo la escribe en cartesianas; para cilíndricas remite a reusar (3.42).)

**El teorema en dos direcciones** [p.240]:
> *"1. Any irrotational, incompressible flow has a velocity potential and stream function (for
> two-dimensional flow) that both satisfy Laplace's equation. 2. Conversely, **any solution of
> Laplace's equation represents the velocity potential or stream function (two-dimensional) for
> an irrotational, incompressible flow.**"*

**LA CITA QUE JUSTIFICA TODA LA ARQUITECTURA DEL SOLVER** [§3.7, p.240]:
> *"Note that Laplace's equation is a second-order linear partial differential equation. **The
> fact that it is linear is particularly important, because the sum of any particular solutions
> of a linear differential equation is also a solution** […] we conclude that a complicated flow
> pattern for an irrotational, incompressible flow can be synthesized by adding together a number
> of elementary flows that are also irrotational and incompressible. **Indeed, this establishes
> the grand strategy for the remainder of our discussions on inviscid, incompressible flow.**"*

Y se puede sumar también **el campo de velocidad**, no solo los potenciales [§3.11, p.250]:
> *"not only can we add the values of phi or psi to obtain more complex solutions, **we can add
> their derivatives, that is, the velocities, as well.**"*

**Y qué distingue un cuerpo de otro** [p.240]:
> *"How, then, do we obtain different flows for the different bodies? **The answer is found in
> the boundary conditions.** […] **Boundary conditions are therefore of vital concern in
> aerodynamic analysis.**"*

#### Las condiciones de frontera (§3.7.1–§3.7.2, pp. 241–242)

**En el infinito** (con `V_inf` sobre `+x`):
```
u = ∂phi/∂x =  ∂psi/∂y = V_inf                                             (3.47a)
v = ∂phi/∂y = −∂psi/∂x = 0                                                 (3.47b)
```

**EN LA PARED (no-penetración) — la base del método de paneles.** Cinco formas equivalentes:
```
V · n = (∇phi) · n = 0                                                     (3.48a)
∂phi/∂n = 0                                                                (3.48b)
∂psi/∂s = 0            (s = distancia A LO LARGO de la superficie)         (3.48c)
psi|_(y = y_b) = const  (el contorno del cuerpo ES una línea de corriente)  (3.48d)
(dy_b/dx) = (v/u)|_surface                                                 (3.48e)
```
Justificación literal [p.241]: *"for inviscid flows the velocity at the surface can be finite, but
**because the flow cannot penetrate the surface, the velocity vector must be tangent to the
surface.** […] If the flow is tangent to the surface, then the component of velocity normal to the
surface must be zero."*
Y el alcance de (3.48e) [p.242]: *"is used for **all inviscid flows, incompressible to
hypersonic**, and does not depend on the formulation of the problem in terms of phi or psi."*

---

### 2.0.4 LOS CUATRO FLUJOS ELEMENTALES (§3.9–§3.14, pp. 243–268) — Tabla 3.1

| Flujo | Velocidad | `phi` | `psi` | Ecs. |
|---|---|---|---|---|
| **Uniforme** en `x` | `u = V_inf` | `V_inf·x = V_inf·r·cos(th)` | `V_inf·y = V_inf·r·sin(th)` | (3.53),(3.55),(3.56),(3.57) |
| **Fuente** | `V_r = Lambda/(2·pi·r)`, `V_th = 0` | `(Lambda/(2·pi))·ln(r)` | `(Lambda/(2·pi))·th` | (3.62),(3.67),(3.72) |
| **Vórtice** | `V_th = −Gamma/(2·pi·r)`, `V_r = 0` | `−(Gamma/(2·pi))·th` | `(Gamma/(2·pi))·ln(r)` | (3.105),(3.112),(3.114) |
| **Doblete** | `V_r = −(kappa/(2·pi))·cos(th)/r²`, `V_th = −(kappa/(2·pi))·sin(th)/r²` | `(kappa/(2·pi))·cos(th)/r` | `−(kappa/(2·pi))·sin(th)/r` | (3.87),(3.88) |

**Definiciones y convenciones que hay que respetar al implementar:**

- **`Lambda` (fuente)** [§3.10, p.248]: *"Lambda defines the **source strength**, it is physically
  the **rate of volume flow from the source, per unit depth** perpendicular to the page. Typical
  units of Lambda are **square meters per second** […] **a positive value of Lambda represents a
  source, whereas a negative value represents a sink.**"*
  Singularidad: `∇·V = 0` en todo punto **salvo el origen, donde se hace infinito** [p.245].
  Circulación de la fuente: **cero** [p.249].

- **`Gamma` (vórtice)** [§3.14, pp. 264–266]: con la definición de circulación de Anderson
  `Gamma ≡ −∮_C V·ds` (2.136), sale `V_th = −Gamma/(2·pi·r)` (3.105). **`Gamma` positiva ⇒ giro
  HORARIO** [p.265]. Irrotacional en todas partes **salvo en `r = 0`, donde la vorticidad es
  infinita** [p.266].
  > **GOTCHA DE SIGNO #1 DEL PROYECTO.** Anderson define la circulación **con signo menos**
  > (`Gamma = −∮V·ds`), al revés de la convención matemática usual. Todo el capítulo, incluido
  > Kutta-Joukowski, cuelga de eso. Si tu `circulationIntegral()` integra antihorario, debe dar
  > **`−Gamma`**. (Es exactamente lo que verifica el test actual de `potencial.ts`.)

- **`kappa` (doblete)** [§3.12, pp. 253–255]: `kappa ≡ l·Lambda`, límite de un par fuente-sumidero
  con `l → 0` y `l·Lambda` constante (**la fuerza `Lambda` tiende a infinito en el límite**). Las
  líneas de corriente son una **familia de círculos de diámetro `kappa/(2·pi·c)`**.
  **Orientación** [p.255]: *"By convention, we designate the direction of the doublet by an
  **arrow drawn from the sink to the source**"*. Con la flecha hacia `−x` valen (3.87)/(3.88) tal
  cual; con la flecha hacia `+x` **ambos signos se invierten**.
  > **GOTCHA DE SIGNO #2.** En §3.13 el doblete apunta **contra la corriente** (*"The direction
  > of the doublet is upstream, facing into the uniform flow"*, p.256) — por eso `psi` del
  > cilindro sale con `−kappa·sin(th)/(2·pi·r)`.

**LA CITA QUE FUNDA EL MÉTODO DE PANELES** [§3.10, p.246]:
> *"the irrotational, incompressible flow field about an arbitrary body can be visualized as a
> flow induced by a **proper distribution of such singularities over the surface of the body**.
> This concept is fundamental to many theoretical solutions of incompressible flow over airfoils
> and other aerodynamic shapes, and **it is the very heart of modern numerical techniques for the
> solution of such flows.**"*

---

### 2.0.5 CUERPOS POR SUPERPOSICIÓN — el método INDIRECTO (§3.11, pp. 249–253)

**Uniforme + fuente = cuerpo semi-infinito.**
```
psi = V_inf·r·sin(th) + (Lambda/(2·pi))·th                                 (3.74)
V_r  = V_inf·cos(th) + Lambda/(2·pi·r)                                     (3.76)
V_th = −V_inf·sin(th)                                                      (3.77)
```
Un único punto de estancamiento en `(r, th) = ( Lambda/(2·pi·V_inf), pi )` [(3.78)–(3.79), p.250],
o sea **a `Lambda/(2·pi·V_inf)` directamente aguas arriba de la fuente**. La línea divisoria es
`psi = Lambda/2`.

**Uniforme + fuente + sumidero = óvalo de Rankine.**
```
psi = V_inf·r·sin(th) + (Lambda/(2·pi))·(th1 − th2)                        (3.80)
Estancamientos:  OA = OB = sqrt( b² + Lambda·b/(pi·V_inf) )                (3.81)
Línea divisoria (el óvalo):  psi = 0                                       (3.83)
```

**LA FILOSOFÍA "INVERSA" — la cita literal** [§3.11, p.251]:
> *"Since we are dealing with inviscid flow, where the velocity at the surface of a solid body is
> tangent to the body, then **any streamline of the combined flow could be replaced by a solid
> surface of the same shape.** […] **If we want to construct the flow over a solid semi-infinite
> body described by the curve ABC, then all we need to do is take a uniform stream with velocity
> V_inf and add to it a source of strength Lambda at point D.**"*

**Y su límite, que es la razón de existir de §3.17:** funciona al revés de como diseñas. Le das
singularidades y ves qué cuerpo sale. Para diseñar necesitas lo contrario. → §2.4.

---

### 2.1 EL CILINDRO SIN SUSTENTACIÓN — el fixture de oro (§3.13, pp. 255–263)

Flujo uniforme + doblete. Función de corriente [(3.92), p.256]:

```
psi = (V_inf · r · sin(theta)) · (1 − R²/r²)          (3.92)
donde  R² = kappa / (2·pi·V_inf)                       (3.98)
```

Campo de velocidad [(3.93), (3.94), pp. 256–257]:

```
V_r     = (1 − R²/r²) · V_inf · cos(theta)             (3.93)
V_theta = −(1 + R²/r²) · V_inf · sin(theta)            (3.94)
```

Puntos de estancamiento en `(r,theta) = (R, 0)` y `(R, pi)` [(3.95)–(3.96), p.257].
La línea de corriente `psi = 0` pasa por **ambos** y es **el círculo `r = R`** más el eje
horizontal completo [(3.97), p.257]. Esa es la razón por la que se puede sustituir el
interior por un sólido: *"all the flow inside psi = 0 (inside the circle) comes from the
doublet, and all the flow outside psi = 0 (outside the circle) comes from the uniform flow.
Therefore, we can replace the flow inside the circle by a solid body, and the external flow
will not know the difference"* [§3.13, p.257].

**Sobre la superficie** (`r = R`) [(3.99), (3.100), p.258]:

```
V_r     = 0                        (3.99)   ← es la condición de no-penetración, cumplida exacto
V_theta = −2·V_inf·sin(theta)      (3.100)
```

Velocidad máxima `2·V_inf` en `theta = pi/2` y `3·pi/2` (arriba y abajo del cilindro), y son
los puntos de velocidad máxima **de todo el campo** [p.258].

**EL FIXTURE** [(3.101), p.259]:

```
Cp = 1 − 4·sin²(theta)             (3.101)
```

Rango de `Cp`: **de +1.0 en los estancamientos a −3.0 en los puntos de velocidad máxima**
[p.259]. Este es el número contra el que se valida `panel2d.ts` — el propio Anderson lo usa
así en el Ejemplo 3.19.

**Signo de theta (crítico para no equivocarse al implementar)** [§3.13 Ej. 3.14, p.263]: el
sistema polar es el matemático estándar, `theta` crece **antihorario**, `theta = 0` es el
punto de estancamiento **trasero**, `theta = 90°` es **arriba**, `theta = 180°` es el
estancamiento **delantero**, `theta = 270°` es **abajo**. `V_theta` es positiva en la
dirección de `theta` creciente.

**Arrastre y sustentación cero** [(3.102), (3.103), p.260]: por simetría respecto a los dos
ejes, `Cp,l = Cp,u` en estaciones correspondientes → los integrandos son idénticamente cero
→ `cn = ca = 0`.

**Rango de validez / qué se rompe:** el `Cp` teórico coincide con el medido **solo en la
parte delantera** del cilindro; atrás la capa límite se separa y el `Cp` real nunca recupera.
El arrastre real no es cero. Ver §2.10 (d'Alembert) y §3.18.

---

### 2.2 EL CILINDRO CON CIRCULACIÓN (§3.15, pp. 268–282)

Se le suma un vórtice de intensidad `Gamma` [(3.118), p.270]:

```
psi = (V_inf·r·sin(theta))·(1 − R²/r²) + (Gamma/(2·pi))·ln(r/R)     (3.118)
```

Nótese la constante elegida `−(Gamma/2pi)·ln R` [(3.116)] precisamente para que `r = R` siga
siendo `psi = 0`, o sea, siga siendo la superficie del cuerpo.

Velocidades [(3.119), (3.120), p.270]:

```
V_r     = (1 − R²/r²)·V_inf·cos(theta)                              (3.119)
V_theta = −(1 + R²/r²)·V_inf·sin(theta) − Gamma/(2·pi·r)            (3.120)
```

**Los puntos de estancamiento y sus tres regímenes** [(3.123), (3.124), pp. 271–272] — esto
es una máquina de enseñanza excelente:

```
theta = arcsin( −Gamma / (4·pi·V_inf·R) )                           (3.123)
```

- `Gamma/(4·pi·V_inf·R) < 1` → **dos** puntos de estancamiento sobre la superficie, ambos en
  la mitad inferior del cilindro (tercer y cuarto cuadrante).
- `= 1` → **un solo** punto, en `(R, −pi/2)` (el fondo del cilindro).
- `> 1` → (3.123) no tiene sentido; los estancamientos salen de (3.124):
  ```
  r = Gamma/(4·pi·V_inf) ± sqrt( (Gamma/(4·pi·V_inf))² − R² )       (3.124)
  ```
  uno **fuera** del cilindro (el que importa) y uno **dentro** (irrelevante físicamente).

**LA FRASE CLAVE DEL LIBRO — el problema que la condición de Kutta viene a resolver**
[§3.15, p.272]:

> *"From the above discussion, Gamma is clearly a parameter that can be chosen freely. There
> is no single value of Gamma that 'solves' the flow over a circular cylinder; rather, the
> circulation can be any value. Therefore, for the incompressible flow over a circular
> cylinder, there are an infinite number of possible potential flow solutions, corresponding
> to the infinite choices for values of Gamma. **This statement is not limited to flow over
> circular cylinders, but rather, it is a general statement that holds for the incompressible
> potential flow over all smooth two-dimensional bodies.**"*

Velocidad y `Cp` sobre la superficie [(3.125), (3.126), p.272]:

```
V = V_theta = −2·V_inf·sin(theta) − Gamma/(2·pi·R)                          (3.125)

Cp = 1 − 4·sin²(theta) + 2·Gamma·sin(theta)/(pi·R·V_inf) + (Gamma/(2·pi·R·V_inf))²   (3.126)
```

> **Ojo con el signo de (3.126).** El libro imprime el desarrollo con `+` en el término
> cruzado, pero el Ejemplo 3.17 (p.280) evalúa numéricamente `Cp = 0.367 − 3.183·sin(theta)
> − 4·sin²(theta)` con `Gamma/(R·V_inf) = 5`. Reproduciendo: `(Gamma/(2·pi·R·V_inf))² =
> (5/2pi)² = 0.6333`, `1 − 0.6333 = 0.367` ✓, y el término cruzado sale
> `−2·(5)/pi = −3.183` ✓. Es decir, **la forma numéricamente correcta que hay que
> implementar es la del Ejemplo 3.17**: `Cp = 1 − (2·sin(theta) + Gamma/(2·pi·R·V_inf))²`
> desarrollado con el signo de (3.125). Verificar contra el fixture `anderson-ej-3.17`.

**Arrastre cero incluso con circulación** [(3.130)–(3.132), pp. 273–274]:

```
cd = −(1/2)·∫₀^{2pi} Cp·cos(theta) dtheta = 0                      (3.132)
```

*"The drag on a cylinder in an inviscid, incompressible flow is zero, regardless of whether
or not the flow has circulation about the cylinder."* [p.274]

**Sustentación** [(3.136)–(3.138), pp. 274–275]:

```
cl = Gamma / (R · V_inf)                                            (3.138)
```

y con `S = 2R(1)` sale directamente el teorema de Kutta-Joukowski:

```
L' = rho_inf · V_inf · Gamma                                        (3.140)
```

---

### 2.3 KUTTA-JOUKOWSKI Y LA TEORÍA DE LA CIRCULACIÓN (§3.16, pp. 282–284)

Aunque (3.140) se derivó para un cilindro, *"it applies in general to cylindrical bodies of
arbitrary cross section"* [p.282].

**Requisito de implementación:** *"the value of Gamma used in Equation (3.140) must be
evaluated around a closed curve that encloses the body; the curve can be otherwise arbitrary,
but it must have the body inside it"* [§3.16, p.283]. Una curva que **no** encierre el
cuerpo da `Gamma = 0`.

**LA ADVERTENCIA CONCEPTUAL QUE HAY QUE ENSEÑAR** [§3.16, p.284]:

> *"it is not quite proper to say that circulation 'causes' lift. Rather, lift is 'caused' by
> the net imbalance of the surface pressure distribution, and circulation is simply a defined
> quantity determined from the same pressures. […] However, in the theory of incompressible,
> potential flow, it is generally much easier to determine the circulation around the body
> rather than calculate the detailed surface pressure distribution. Therein lies the power of
> the circulation theory of lift."*

Y con eso el libro plantea la pregunta que gobierna todo el capítulo 4: *"How can we calculate
the circulation for a given body in a given incompressible, inviscid flow?"* [p.284].

---

### 2.4 §3.17 — EL MÉTODO DE PANELES DE FUENTES (pp. 284–293) ★ ALGORITMO #1

Esta sección es **la especificación completa de `panel2d.ts` en modo no sustentador**. La
transcribo con detalle de implementación porque el programador no debe volver a abrir el libro.

#### 2.4.1 Por qué existe el método (la motivación de negocio)

[§3.17, p.284]:

> *"this indirect method of starting with a given combination of elementary flows and seeing
> what body shape comes out of it can hardly be used in a practical sense for bodies of
> arbitrary shape. […] **what we want is a direct method; that is, let us specify the shape of
> an arbitrary body and solve for the distribution of singularities which, in combination with
> a uniform stream, produce the flow over the given body.**"*

Y su estatus industrial [p.285]: *"which, since the late 1960s, has become a standard
aerodynamic tool in industry and most research laboratories. In fact, the numerical solution
of potential flows by both source and vortex panel techniques has revolutionized the analysis
of low-speed flows."*

#### 2.4.2 La sábana de fuentes

`lambda = lambda(s)` = intensidad de fuente **por unidad de longitud** a lo largo de `s`
[§3.17, p.285]. Unidades: **m/s** (o ft/s) — porque `Lambda` de una línea-fuente es caudal por
unidad de profundidad (m²/s) y `lambda` es eso además por unidad de longitud de sábana.
`lambda` **puede cambiar de signo** a lo largo de la sábana: *"the 'source' sheet is really a
combination of line sources and line sinks"* [p.286].

Potencial inducido por un trozo `ds` y por la sábana entera de `a` a `b`
[(3.141), (3.142), p.286]:

```
dphi      = (lambda·ds / (2·pi)) · ln(r)                            (3.141)
phi(x,y)  = ∫ₐᵇ (lambda·ds / (2·pi)) · ln(r)                        (3.142)
```

#### 2.4.3 El planteamiento (la ecuación integral y sus incógnitas)

Se cubre la superficie del cuerpo con la sábana y se busca la `lambda(s)` tal que
*"the combined action of the uniform flow and the source sheet makes the airfoil surface a
streamline of the flow"* [§3.17, p.286]. Esa es la **ecuación integral**; se resuelve
numéricamente discretizándola.

**Discretización** [p.286]:
- La sábana se aproxima por `n` **paneles rectos**.
- `lambda_j` es **constante sobre cada panel**, pero varía de panel a panel.
- **Las incógnitas son `lambda_1 … lambda_n`** (n incógnitas).
- **Los paneles pueden tener longitudes distintas** — de hecho conviene.

**La condición de frontera (no-penetración), impuesta numéricamente** [p.286]:
> *"This boundary condition is imposed numerically by defining the **midpoint of each panel to
> be a control point** and by determining the lambda_j's such that the **normal component of
> the flow velocity is zero at each control point**."*

#### 2.4.4 Armado de la matriz de influencia

Potencial en el punto de control `i` debido a todos los paneles [(3.146), (3.147), p.287]:

```
phi(x_i, y_i) = sum_{j=1..n} (lambda_j / (2·pi)) · ∫_j ln(r_ij) ds_j       (3.146)
r_ij          = sqrt( (x_i − x_j)² + (y_i − y_j)² )                        (3.147)
```

Componente normal de la corriente libre sobre el panel `i` [(3.148), p.288]:

```
V_inf,n = V_inf · n_i = V_inf · cos(beta_i)                                (3.148)
```
donde `beta_i` es el ángulo entre `V_inf` y la normal exterior `n_i`. **Positivo hacia
afuera del cuerpo, negativo hacia adentro.** `V_inf` puede venir con incidencia `alpha`
respecto al eje `x`.

Componente normal inducida por los paneles [(3.149), (3.150), p.288]:

```
V_n = ∂/∂n_i [ phi(x_i, y_i) ]                                             (3.149)

V_n = lambda_i/2  +  sum_{j=1..n, j≠i} (lambda_j/(2·pi)) · ∫_j ∂/∂n_i (ln r_ij) ds_j   (3.150)
```

> **EL TÉRMINO DIAGONAL — el gotcha #1 del método.** Cuando `j = i`, en el propio punto de
> control `r_ij = 0` y aparece una singularidad. El libro da el resultado: *"It can be shown
> that when j = i, the contribution to the derivative is simply lambda_i/2"* [p.288]. Es
> decir: **la diagonal de la matriz vale `1/2` (o `pi` si multiplicas toda la fila por `2pi`),
> NO se calcula con la integral.** Físicamente: un panel se auto-induce media intensidad hacia
> afuera.

**La ecuación de frontera** [(3.151)–(3.153), p.288]:

```
V_inf,n + V_n = 0                                                          (3.151)

lambda_i/2 + sum_{j≠i} (lambda_j/(2·pi))·∫_j ∂/∂n_i(ln r_ij) ds_j + V_inf·cos(beta_i) = 0   (3.152)
```

Definiendo `I_ij` = valor de esa integral (punto de control en el panel `i`, integral sobre el
panel `j`):

```
lambda_i/2 + sum_{j≠i} (lambda_j/(2·pi))·I_ij + V_inf·cos(beta_i) = 0      (3.153)
```

> *"Equation (3.152) is the crux of the source panel method. **The values of the integrals in
> Equation (3.152) depend simply on the panel geometry; they are not properties of the flow.**"*
> [§3.17, p.288]
>
> **Consecuencia de ingeniería directa:** la matriz `I_ij` se calcula UNA vez por geometría y
> se **reutiliza para todos los ángulos de ataque**. Solo cambia el lado derecho
> `−V_inf·cos(beta_i)`. Barrer `alpha` cuesta una retro-sustitución, no una factorización.
> Esto es lo que hace el barrido de polar interactivo en el navegador.

Aplicando (3.153) en `i = 1…n` sale un sistema lineal `n×n` que *"can be solved
simultaneously by conventional numerical methods"* [p.289].

#### 2.4.5 La integral geométrica `I_ij` — la fórmula CERRADA (Ej. 3.19, pp. 290–292)

Esta es la parte que casi todos los textos dejan como ejercicio y Anderson sí da. Es
**imprescindible** para implementar.

Con `(x_i, y_i)` = punto de control del panel `i`; `(X_j, Y_j)` y `(X_{j+1}, Y_{j+1})` =
puntos frontera del panel `j`; `Theta_i`, `Theta_j` = ángulos medidos **antihorario desde el
eje x hasta el propio panel** [p.291]:

```
beta_i = Theta_i + pi/2
  ⇒  sin(beta_i) =  cos(Theta_i)                                           (3.160a)
  ⇒  cos(beta_i) = −sin(Theta_i)                                           (3.160b)

Parametrización del panel j:
  x_j = X_j + s_j·cos(Theta_j)                                             (3.161a)
  y_j = Y_j + s_j·sin(Theta_j)                                             (3.161b)
```

El integrando [(3.159), p.291]:

```
∂/∂n_i (ln r_ij) = [ (x_i − x_j)·cos(beta_i) + (y_i − y_j)·sin(beta_i) ]
                   / [ (x_i − x_j)² + (y_i − y_j)² ]                       (3.159)
```

y la integral queda [(3.162), p.292]:

```
I_ij = ∫₀^{S_j}  (C·s_j + D) / (s_j² + 2·A·s_j + B)  ds_j                  (3.162)
```

con los **cinco coeficientes geométricos** [p.292]:

```
A   = −(x_i − X_j)·cos(Theta_j) − (y_i − Y_j)·sin(Theta_j)
B   =  (x_i − X_j)² + (y_i − Y_j)²
C   =  sin(Theta_i − Theta_j)
D   =  (y_i − Y_j)·cos(Theta_i) − (x_i − X_j)·sin(Theta_i)
S_j =  sqrt( (X_{j+1} − X_j)² + (Y_{j+1} − Y_j)² )
E   =  sqrt(B − A²) = (x_i − X_j)·sin(Theta_j) − (y_i − Y_j)·cos(Theta_j)
```

**RESULTADO CERRADO** [(3.163), p.292] — esto se copia tal cual al código:

```
I_ij = (C/2) · ln( (S_j² + 2·A·S_j + B) / B )
     + ((D − A·C)/E) · [ atan((S_j + A)/E) − atan(A/E) ]                   (3.163)
```

> *"Equation (3.163) is a general expression for two arbitrarily oriented panels; **it is not
> restricted to the case of a circular cylinder**."* [p.292]
>
> **Gotcha numérico [EXTENSIÓN DECLARADA]:** `E = sqrt(B − A²)` se anula cuando el punto de
> control es colineal con el panel `j` (paneles alineados, p. ej. una geometría con un tramo
> recto). Ahí (3.163) tiene `0/0` en el segundo término. El libro no lo menciona porque su
> ejemplo es un octágono. Hay que blindarlo con un umbral (`|E| < eps` → término angular = 0).
> Motivo de la extensión: robustez numérica sobre geometría dibujada por el usuario del CAD,
> que sí va a tener tramos rectos.

#### 2.4.6 Salida: velocidad tangencial y `Cp`

Componente tangencial de la corriente libre [(3.154), p.289]:

```
V_inf,s = V_inf · sin(beta_i)                                              (3.154)
```

Inducida por los paneles [(3.155), p.289]:

```
V_s = ∂phi/∂s = sum_{j=1..n} (lambda_j/(2·pi)) · ∫_j ∂/∂s (ln r_ij) ds_j   (3.155)
```

> **Segundo gotcha del término diagonal, y va al revés que el normal:** *"The tangential
> velocity on a flat source panel induced by the panel itself is **zero**; hence, in Equation
> (3.155), the term corresponding to j = i is zero. This is easily seen by intuition, because
> the panel can only emit volume flow from its surface in a direction perpendicular to the
> panel itself."* [p.289]
> Resumen para el implementador: **normal → diagonal = 1/2. Tangencial → diagonal = 0.**

Velocidad total y coeficiente de presión [(3.156) y (3.38), p.289]:

```
V_i  = V_inf·sin(beta_i) + sum_j (lambda_j/(2·pi))·∫_j ∂/∂s(ln r_ij) ds_j  (3.156)
Cp_i = 1 − (V_i / V_inf)²                                                  (3.38)
```

Y la integral tangencial también tiene forma cerrada [(3.165), p.293]:

```
∫_j ∂/∂s (ln r_ij) ds_j = ((D − A·C)/(2·E)) · ln( (S_j² + 2·A·S_j + B) / B )
                          − C · [ atan((S_j + A)/E) − atan(A/E) ]          (3.165)
```

(Nótese la elegancia: son **los mismos** `A,B,C,D,E`, con los papeles de `C` y `(D−A·C)/E`
intercambiados y un factor 2. Un solo bloque de código calcula ambas.)

#### 2.4.7 El verificador independiente — OBLIGATORIO

[(3.157), p.290]:

```
sum_{j=1..n} lambda_j · S_j = 0                                            (3.157)
```

> *"For a closed body […] the sum of all the source and sink strengths must be zero, or else
> the body itself would be adding or absorbing mass from the flow—an impossible situation […]
> **Equation (3.157) provides an independent check on the accuracy of the numerical results.**"*

Esto encaja exactamente con la doctrina de la Forja (`feedback_verification.md`): es un
invariante físico, no un test contra uno mismo. Va como aserción dura del solver.

#### 2.4.8 Cuántos paneles (requisito de exactitud)

[§3.17, p.289]:

> *"the accuracy of the source panel method is amazingly good; **a circular cylinder can be
> accurately represented by as few as 8 panels, and most airfoil shapes, by 50 to 100
> panels.** (For an airfoil, it is desirable to cover the leading-edge region with a number of
> small panels to represent accurately the rapid surface curvature and to use larger panels
> over the relatively flat portions of the body. Note that, in general, all the panels […] can
> be different lengths.)"*

**Rango de validez del método de fuentes:** solo **cuerpos NO sustentadores**. Una fuente tiene
circulación cero, así que ninguna combinación de fuentes puede dar sustentación. Para eso hace
falta §4.10.

---

### 2.4b LA GEOMETRÍA DEL PERFIL Y LA NOMENCLATURA NACA (§4.2, pp. 326–328)

**Definiciones literales** [§4.2, p.326]:

> *"**The mean camber line is the locus of points halfway between the upper and lower surfaces as
> measured perpendicular to the mean camber line itself.** The most forward and rearward points of
> the mean camber line are the **leading and trailing edges**. The straight line connecting the
> leading and trailing edges is the **chord line**, and the precise distance from the leading to
> the trailing edge measured along the chord line is […] the **chord c**. The **camber** is the
> maximum distance between the mean camber line and the chord line, **measured perpendicular to
> the chord line**. The **thickness** is the distance between the upper and lower surfaces, also
> measured perpendicular to the chord line. The shape of the airfoil at the leading edge is
> usually circular, with a **leading-edge radius of approximately 0.02c**."*

> **OJO AL IMPLEMENTAR:** la línea de curvatura media se define midiendo **perpendicular a sí
> misma**, pero `camber` y `thickness` se miden **perpendicular a la línea de cuerda**. Son dos
> convenciones distintas en el mismo párrafo y no coinciden. El libro es explícito.

**LA ESPECIFICACIÓN DEL GENERADOR DE GEOMETRÍA, en una frase** [p.326]:
> *"**The shapes of all standard NACA airfoils are generated by specifying the shape of the mean
> camber line and then wrapping a specified symmetrical thickness distribution around the mean
> camber line.**"*

**Las tres familias** [§4.2, p.327]:

```
NACA de 4 DÍGITOS   —  M P XX
  M  = curvatura máxima en CENTÉSIMAS de cuerda
  P  = posición de la curvatura máxima desde el borde de ataque, en DÉCIMAS de cuerda
  XX = espesor máximo en CENTÉSIMAS de cuerda
  NACA 2412 → 0.02c de curvatura a 0.40c, espesor 0.12c ("2 % a 40 %, 12 % de espesor")
  NACA 0012 → simétrico, espesor 0.12c

NACA de 5 DÍGITOS   —  L PQ XX
  L      × 3/2 = coeficiente de sustentación de DISEÑO, en DÉCIMAS
  PQ / 2       = posición de la curvatura máxima, en CENTÉSIMAS de cuerda
  XX           = espesor máximo en CENTÉSIMAS de cuerda
  NACA 23012 → cl_diseño = 2·(3/2)/10 = 0.3 ; x_camber = 30/2 = 0.15c ; t = 0.12c

SERIE 6 (flujo laminar, desarrollada en la 2ª Guerra Mundial)  —  6 A − B CC
  6   = identifica la serie
  A   = posición de la presión mínima en DÉCIMAS de cuerda
        (para la distribución de espesor simétrica base, a sustentación nula)
  B   = coeficiente de sustentación de diseño en DÉCIMAS
  CC  = espesor máximo en CENTÉSIMAS de cuerda
  NACA 65-218 → p_min a 0.5c ; cl_diseño = 0.2 ; t = 0.18c
```

**Definición del `cl` de diseño** [nota al pie 1, p.327] — importante porque enlaza con Kutta:
> *"The design lift coefficient is the theoretical lift coefficient for the airfoil when **the
> angle of attack is such that the slope of the mean camber line at the leading edge is parallel
> to the freestream velocity**. In terms of the Kutta condition […] this configuration corresponds
> to **the Kutta condition holding at the leading edge as well as the trailing edge**, i.e., **the
> vortex sheet strength at the leading edge must be zero**."*

**Aviones en servicio con perfiles NACA estándar** [tabla sin número, p.328] — útil como catálogo
de arranque del CAD: Beechcraft Sundowner 63A415; Beechcraft Bonanza 23016.5 (raíz) / 23012
(punta); Cessna 150 **2412**; Fairchild A-10 6716 / 6713; Gates Learjet 24D 64A109; General
Dynamics F-16 64A204; Lockheed C-5 Galaxy **0012 (modificado)**. Y: *"many of the large aircraft
companies today design their own special-purpose airfoils; for example, the Boeing 727, 737, 747,
757, 767, and 777 all have specially designed Boeing airfoils."*

> **[NO OBSERVADO — crítico]** El polinomio de la distribución de espesor NACA y las parábolas de
> la línea de curvatura media **NO están en el capítulo**. El libro remite explícitamente a la
> **Referencia 11 (Abbott & von Doenhoff, *Theory of Wing Sections*, 1949)** para *"coordinates
> for the shape of NACA airfoils"*. Lo único constructivo que da es la frase verbal de arriba más
> el radio de borde de ataque ≈ `0.02c`. Ver §7.
> **Sí da, en cambio, dos líneas de curvatura media analíticas concretas**: la del **NACA 23012**
> (Ejemplo 4.6) y la del **NACA 4412** (Problema 4.6). Están en §3 como fixtures.

**Características del perfil** [§4.3, pp. 329–333]:
- Un perfil es una sección del **ala infinita**: *"the properties of the airfoil and the infinite
  wing are identical. Hence, **airfoil data are frequently called infinite wing data**."* [p.329].
  Por eso los coeficientes van en **minúscula** (`cl`, `cd`, `cm`) frente a los del ala finita.
- `a0 ≡ dcl/dalpha` = pendiente de sustentación. `alpha_L=0`: **0 para simétrico**, y *"for all
  airfoils with positive camber […] a negative value, usually **on the order of −2 or −3°**"*
  [p.329].
- **Lo que la teoría no viscosa SÍ y NO da** [p.329, literal]: *"The inviscid flow airfoil theory
  discussed in this chapter allows us to **predict the lift slope a0 and alpha_L=0** for a given
  airfoil. **It does not allow us to calculate cl_max**, which is a difficult viscous flow
  problem."*
- **Dependencia con Reynolds** [pp. 329–331]: *"**The lift slope a0 is not influenced by Re;
  however, cl_max is dependent upon Re.**"* / *"The moment coefficient is also insensitive to Re
  except at large alpha."* / *"**cd is sensitive to Re**, which is to be expected since both skin
  friction and flow separation are viscous effects."*
- `cm` se toma normalmente respecto del **cuarto de cuerda**; y existe el **centro aerodinámico**,
  *"one point on the airfoil about which the moment is independent of angle of attack"* [p.331].
- **Polar de arrastre** [nota al pie 2, p.330]: *"A plot of cd versus cl is called a **drag
  polar**."* → la vista que debe producir el CAD.

---

### 2.4c LA SÁBANA DE VÓRTICES (§4.4, pp. 333–338) — la especificación formal del solver

Del vórtice puntual → filamento recto → **sábana**. `gamma = gamma(s)` = intensidad **por unidad
de longitud** a lo largo de `s`; la intensidad de un trozo `ds` es `gamma·ds` [p.335].

```
dV      = − gamma·ds / (2·pi·r)      (perpendicular a r)                   (4.1)
dphi    = − (gamma·ds/(2·pi))·theta                                        (4.2)
phi(x,z)= − (1/(2·pi))·∫ₐᵇ theta·gamma ds                                  (4.3)
Gamma   = ∫ₐᵇ gamma ds                                                     (4.4)
```

**Guía de uso que da el propio libro** [p.335] — dice exactamente qué ecuación va a qué módulo:
> *"**Equation (4.1) is particularly useful for our discussion of classical thin airfoil theory,
> whereas Equation (4.3) is important for the numerical vortex panel method.**"*

Advertencia numérica [p.335]: `dV` **cambia de dirección** al recorrer la sábana, así que las
contribuciones *"must be added **vectorially**"* — por eso conviene trabajar con `phi`.

**EL SALTO TANGENCIAL — la propiedad que hace que el método de vórtices funcione**
[(4.5)–(4.8), pp. 335–336]:

```
gamma = u1 − u2                                                            (4.8)
```
> *"**Equation (4.8) is important; it states that the local jump in tangential velocity across the
> vortex sheet is equal to the local sheet strength.**"*

Y el contraste con la sábana de **fuentes** [p.335]: la de fuentes tiene salto en la componente
**normal** y continuidad en la tangencial; la de **vórtices** al revés: salto en la **tangencial**,
la normal se conserva. **Por eso las fuentes modelan espesor y los vórtices modelan circulación.**

**LA FILOSOFÍA — el párrafo que ES la especificación del producto** [§4.4, pp. 336–337]:

> *"Consider an airfoil of arbitrary shape and thickness in a freestream with velocity V_inf […]
> **Replace the airfoil surface with a vortex sheet of variable strength gamma(s)** […] **Calculate
> the variation of gamma as a function of s such that the induced velocity field from the vortex
> sheet when added to the uniform velocity of magnitude V_inf will make the vortex sheet (hence
> the airfoil surface) a streamline of the flow.** In turn, the circulation around the airfoil will
> be given by `Gamma = ∮ gamma ds` where the integral is taken around the complete surface of the
> airfoil. Finally, the resulting lift is given by the Kutta-Joukowski theorem:
> `L' = rho_inf·V_inf·Gamma`."*

Su historia y su costo [p.337]: la filosofía es de **Prandtl y su grupo en Göttingen, 1912–1922**,
pero *"**no general analytical solution for gamma = gamma(s) exists** for an airfoil of arbitrary
shape and thickness. Rather, **the strength of the vortex sheet must be found numerically**, and
the practical implementation […] had to wait until the **1960s** with the advent of large digital
computers."*

**No es un truco matemático — tiene significado físico** [§4.4, p.337]:
> *"In real life, there is a **thin boundary layer on the surface** […] a highly viscous region in
> which the large velocity gradients produce substantial vorticity […] Hence, in real life, there
> is a distribution of vorticity along the airfoil surface due to viscous effects, and **our
> philosophy of replacing the airfoil surface with a vortex sheet can be construed as a way of
> modeling this effect in an inviscid flow.**"*

**LA BIFURCACIÓN — superficie vs. línea de curvatura media** [§4.4, p.338]:
> *"Imagine that the airfoil is made very thin. If you were to stand back and look at such a thin
> airfoil from a distance, **the portions of the vortex sheet on the top and bottom surface of the
> airfoil would almost coincide.** This gives rise to a method of approximating a thin airfoil by
> **replacing it with a single vortex sheet distributed over the camber line** […] Although the
> approach […] is **approximate** in comparison with [poner la sábana en la superficie], **it has
> the advantage of yielding a closed-form analytical solution.** This philosophy of thin airfoil
> theory was first developed by **Max Munk, a colleague of Prandtl, in 1922**."*

| Dónde va la sábana | Método | Resultado | Alcance |
|---|---|---|---|
| Sobre la **superficie** (Fig. 4.15) | **Paneles de vórtices** (§4.10) | Solo numérico | Forma, espesor y `alpha` **arbitrarios** |
| Sobre la **línea de curvatura media / cuerda** (Fig. 4.16) | **Perfil delgado** (§4.7–4.8) | **Forma cerrada** | Delgado (≤ ~12 %) y `alpha` pequeño |

Del Preview Box [p.322]: los paneles son *"the **gold standard** for low-speed, inviscid-flow
airfoil calculations, and are used throughout the aeronautical industry"*; el perfil delgado *"is
by far the most tractable means of obtaining analytical solutions for lift and moments"*.
**El producto necesita LOS DOS.**

---

### 2.5 LA CONDICIÓN DE KUTTA (§4.5, pp. 338–342) ★ el punto conceptual

#### 2.5.1 El problema

Igual que con el cilindro, *"for a given airfoil at a given angle of attack, there are an
infinite number of valid theoretical solutions, corresponding to an infinite choice of
Gamma"* [§4.5, p.338]. Pero *"We know from experience that a given airfoil at a given angle of
attack produces a single value of lift […] **although there is an infinite number of possible
potential flow solutions, nature knows how to pick a particular solution.**"* [p.338]

#### 2.5.2 La evidencia experimental (por qué es física y no matemática)

El libro NO deduce la condición: la **observa** en las fotos de Prandtl y Tietjens (Fig. 4.18)
de un perfil arrancado impulsivamente desde el reposo [pp. 338–340]:

- (a) Justo al arrancar, el flujo **intenta doblar el borde de salida** de abajo hacia arriba.
- Pero *"more advanced considerations of inviscid, incompressible flow […] show the theoretical
  result that **the velocity becomes infinitely large at a sharp corner**"* [p.338]. Eso
  *"is not tolerated very long by nature"* [p.341].
- (b) El punto de estancamiento superior **migra hacia el borde de salida**.
- (c) Estado estacionario: *"the flow is smoothly leaving the top and the bottom surfaces of
  the airfoil at the trailing edge"* [p.340].

> *"in establishing the steady flow over a given airfoil at a given angle of attack, **nature
> adopts that particular value of circulation which results in the flow leaving smoothly at the
> trailing edge**. This observation was first made and used in a theoretical analysis by the
> German mathematician M. Wilhelm Kutta in 1902."* [§4.5, p.340]

**Es una OBSERVACIÓN elevada a condición de cierre.** Ese es exactamente el estatus
epistemológico que el ingeniero del cliente debe entender: la matemática del flujo potencial
está *subdeterminada*, y lo que la cierra es un dato experimental.

#### 2.5.3 Los dos casos de borde de salida (§4.5, p.341)

- **Borde de ángulo finito:** si `V_1` (arriba) y `V_2` (abajo) fueran finitas en el punto `a`,
  habría **dos velocidades en dos direcciones distintas en el mismo punto** — imposible. Único
  recurso: `V_1 = V_2 = 0`. **El borde de salida es un punto de estancamiento.**
- **Borde en cúspide (cusped):** `V_1` y `V_2` son colineales, así que pueden ser finitas. Pero
  la presión `p_a` es única, y Bernoulli a ambos lados da
  ```
  p_a + (1/2)·rho·V_1² = p_a + (1/2)·rho·V_2²   ⇒   V_1 = V_2
  ```
  **Velocidades finitas, iguales en magnitud y dirección.**

**Enunciado formal en tres partes** [§4.5, p.341] — cópialo tal cual a la escuela:

1. *"For a given airfoil at a given angle of attack, the value of Gamma around the airfoil is
   such that the flow leaves the trailing edge smoothly."*
2. *"If the trailing-edge angle is finite, then the trailing edge is a stagnation point."*
3. *"If the trailing edge is cusped, then the velocities leaving the top and bottom surfaces at
   the trailing edge are finite and equal in magnitude and direction."*

#### 2.5.4 Su forma implementable

En términos de la sábana de vórtices, con `gamma = u_1 − u_2` [(4.8)]:

```
gamma(TE) = gamma(a) = V_1 − V_2                                           (4.9)
```

- Borde finito: `V_1 = V_2 = 0` ⇒ `gamma(TE) = 0`.
- Borde cúspide: `V_1 = V_2 ≠ 0` ⇒ `gamma(TE) = 0` también.

**En ambos casos** [(4.10), p.342]:

```
gamma(TE) = 0                                                              (4.10)
```

**Esta es la línea de código.** Todo el aparato numérico de §4.10 existe para imponer (4.10).

#### 2.5.5 §4.5.1 "Sin fricción, ¿tendríamos sustentación?" — la lección que hay que contar

Es una sub-sección corta y es de lo mejor del libro [§4.5.1, p.342]:

> *"if we lived in a perfectly inviscid world, an airfoil could not produce lift. Indeed, **the
> presence of friction is the very reason why we have lift**. […] the way that nature insures
> that the flow will leave smoothly at the trailing edge […] is that the **viscous boundary
> layer remains attached to the surface all the way to the trailing edge. Nature enforces the
> Kutta condition by means of friction.** If there were no boundary layer (i.e., no friction),
> there would be no physical mechanism in the real world to achieve the Kutta condition."*

> *"So we are led to the most ironic situation that lift, which is created by the surface
> pressure distribution—an inviscid phenomenon, would not exist in a frictionless (inviscid)
> world."*

Y la justificación de por qué el modelo no viscoso funciona igual [§4.5.1, p.342]: la presión
actúa **normal** a la superficie, y en un perfil eso es esencialmente la dirección de la
sustentación; el esfuerzo cortante actúa **tangencial**, o sea esencialmente en la dirección
del arrastre. *"pressure is the dominant player in the generation of lift, and shear stress has
a negligible effect on lift. It is for this reason that the lift on an airfoil **below the
stall** can be accurately predicted by inviscid theories"*.

**El rango de validez del motor completo, en una frase: BAJO EL DESPLOME.**

---

### 2.6 KELVIN Y EL VÓRTICE DE ARRANQUE (§4.6, pp. 342–345)

Responde: *"How does nature generate this circulation? Does it come from nowhere, or is
circulation somehow conserved over the whole flow field?"* [p.342]

**Teorema de Kelvin** [(4.11), p.343] — para flujo no viscoso, incompresible, sin fuerzas de
cuerpo:

```
D(Gamma)/Dt = 0                                                            (4.11)
```

*"the time rate of change of circulation around a closed curve consisting of the same fluid
elements is zero"*. (Nota al pie 4, p.343: también vale para flujo compresible no viscoso si
`rho = rho(p)`, p. ej. isentrópico.)

**La secuencia física** [§4.6, pp. 344–345]:

1. Perfil en reposo: `Gamma_1 = 0` sobre la curva `C_1`.
2. Al arrancar, el flujo dobla el borde de salida → gradientes de velocidad enormes → **región
   de vorticidad intensa** pegada a esos elementos de fluido.
3. Esa región es arrastrada aguas abajo, es inestable, **se enrolla** y forma el **vórtice de
   arranque** (starting vortex), con circulación **antihoraria** (negativa).
4. Kelvin: la curva `C_2` que encierra perfil + vórtice de arranque sigue con `Gamma_2 = 0`.
   Partiendo `C_2` en `C_3` (vórtice) y `C_4` (perfil): `Gamma_3 + Gamma_4 = Gamma_2 = 0`.

```
Gamma_perfil = − Gamma_arranque
```

5. **El lazo de realimentación**, que es lo que hay que animar en la escuela: más vorticidad
   desprendida → vórtice de arranque más fuerte → circulación horaria del perfil más fuerte →
   el flujo en el borde de salida se acerca más a Kutta → se desprende **menos** vorticidad…
   hasta que *"the starting vortex builds up to just the right strength such that the
   equal-and-opposite clockwise circulation around the airfoil leads to smooth flow from the
   trailing edge (the Kutta condition is exactly satisfied). When this happens, the vorticity
   shed from the trailing edge becomes zero, the starting vortex no longer grows in strength,
   and a steady circulation exists around the airfoil."* [p.345]

**Honestidad del autor sobre su utilidad práctica** [§4.6, Ej. 4.4, p.346]:

> *"In this author's experience, **no practical aerodynamic calculation requires the strength of
> a starting vortex.** The starting vortex is simply a theoretical construct that is consistent
> with the generation of circulation around a lifting two-dimensional body."*

**Decisión de producto que se sigue:** el vórtice de arranque es **contenido de escuela y
animación**, NO una variable del solver. No lo metas en `panel2d.ts`.

---

### 2.7 TEORÍA DEL PERFIL DELGADO — SIMÉTRICO (§4.7, pp. 346–356)

#### 2.7.1 La ecuación fundamental

La sábana de vórtices se coloca **sobre la línea de cuerda** (no sobre la de curvatura media),
pero se exige que sea **la línea de curvatura media** la que resulte línea de corriente
[§4.7, pp. 347–348]. Aproximaciones declaradas:

- Perfil delgado ⇒ línea de curvatura cerca de la cuerda.
- `alpha` pequeño y `dz/dx` pequeño ⇒ `sin(x) ≈ tan(x) ≈ x` (¡en **radianes**!) [p.349].
- `w'(s) ≈ w(x)` [(4.15), p.349].

Condición de tangencia [(4.12)–(4.14)]:

```
V_inf,n + w'(s) = 0                                                        (4.12)
V_inf,n = V_inf·[ alpha + atan(−dz/dx) ]                                   (4.13)
V_inf,n ≈ V_inf·( alpha − dz/dx )        [alpha en RADIANES]               (4.14)
```

Velocidad inducida por la sábana [(4.16), (4.17), p.349]:

```
dw   = − gamma(xi)·dxi / (2·pi·(x − xi))                                   (4.16)
w(x) = − ∫₀^c gamma(xi) dxi / (2·pi·(x − xi))                              (4.17)
```

**LA ECUACIÓN FUNDAMENTAL DE LA TEORÍA DEL PERFIL DELGADO** [(4.18), p.350]:

```
(1/(2·pi)) · ∫₀^c  gamma(xi) dxi / (x − xi)  =  V_inf · ( alpha − dz/dx )  (4.18)
```

> *"the fundamental equation of thin airfoil theory; **it is simply a statement that the camber
> line is a streamline of the flow**."* [p.350]
>
> *"the only unknown in Equation (4.18) is the vortex strength gamma(xi). Hence, Equation
> (4.18) is an integral equation […] **The central problem of thin airfoil theory is to solve
> Equation (4.18) for gamma(xi), subject to the Kutta condition, namely, gamma(c) = 0.**"*

#### 2.7.2 Caso simétrico

Simétrico ⇒ sin curvatura ⇒ `dz/dx = 0` [(4.19), p.350]:

```
(1/(2·pi)) · ∫₀^c gamma(xi) dxi / (x − xi) = V_inf · alpha                 (4.19)
```

> *"within the framework of thin airfoil theory, **a symmetric airfoil is treated the same as a
> flat plate**; note that our theoretical development does not account for the airfoil thickness
> distribution. **Equation (4.19) is an exact expression for the inviscid, incompressible flow
> over a flat plate at a small angle of attack.**"* [§4.7, p.350]

#### 2.7.3 La transformación y la solución

Cambio de variable [(4.20)–(4.22), p.350]:

```
xi = (c/2)·(1 − cos(theta))                                                (4.20)
x  = (c/2)·(1 − cos(theta_0))     ← el punto fijo donde se evalúa           (4.21)
dxi = (c/2)·sin(theta) dtheta                                              (4.22)
```
Límites: `theta = 0` en el borde de ataque (`xi = 0`), `theta = pi` en el borde de salida
(`xi = c`).

```
(1/(2·pi)) · ∫₀^{pi} gamma(theta)·sin(theta) dtheta / (cos(theta) − cos(theta_0)) = V_inf·alpha   (4.23)
```

**LA SOLUCIÓN** [(4.24), p.351]:

```
gamma(theta) = 2·alpha·V_inf · (1 + cos(theta)) / sin(theta)               (4.24)
```

**La integral estándar que aparece por todo el capítulo** [(4.26), p.351]:

```
∫₀^{pi} cos(n·theta) dtheta / (cos(theta) − cos(theta_0)) = pi·sin(n·theta_0)/sin(theta_0)   (4.26)
```

Verificación de Kutta: en `theta = pi` (borde de salida), (4.24) da `0/0`; por L'Hôpital
`gamma(pi) = 2·alpha·V_inf·(−sin pi)/(cos pi) = 0` ✓ [p.351].

#### 2.7.4 Los resultados cerrados

Circulación [(4.28)–(4.30), p.352]:

```
Gamma = ∫₀^c gamma(xi) dxi = (c/2)·∫₀^{pi} gamma(theta)·sin(theta) dtheta
      = alpha·c·V_inf·∫₀^{pi}(1+cos theta) dtheta = pi·alpha·c·V_inf       (4.30)
```

Sustentación y coeficientes [(4.31)–(4.34), p.352]:

```
L'  = rho_inf·V_inf·Gamma = pi·alpha·c·rho_inf·V_inf²                      (4.31)
cl  = 2·pi·alpha            [alpha en RADIANES]                            (4.33)
dcl/dalpha = 2·pi  por radián  = 0.11 por grado                            (4.34)
```

> *"They also state that the theoretical lift slope is equal to 2·pi rad⁻¹, which is 0.11
> degree⁻¹."* [p.352]  (`2·pi/57.3 = 0.1097`.)

Momento [(4.35)–(4.41), pp. 353–354]:

```
M'_LE   = −rho_inf·V_inf·∫₀^c xi·gamma(xi) dxi                             (4.35)
M'_LE   = −q_inf·c²·(pi·alpha/2)                                           (4.36)
cm_le   = M'_LE/(q_inf·c²) = −pi·alpha/2                                   (4.37)
cm_le   = −cl/4                                                            (4.39)
cm_c/4  = cm_le + cl/4                                                     (4.40)  [de (1.22)]
cm_c/4  = 0                                                                (4.41)
```

**Resumen del caso simétrico** [p.355]:
1. `cl = 2·pi·alpha`
2. Pendiente `= 2·pi`
3. **Centro de presión Y centro aerodinámico, ambos en `c/4`.**

**Validación contra experimento** [p.352]: la Fig. 4.25 compara con datos del NACA 0012 (perfil
simétrico usado en colas y palas de helicóptero) y *"Equation (4.33) accurately predicts cl
over a large range of angle of attack"*, y `cm_c/4` medido es **constante** en un rango amplio
de `alpha`, confirmando que el centro aerodinámico real está esencialmente en `c/4` [p.354].

---

### 2.8 TEORÍA DEL PERFIL DELGADO — CON CURVATURA (§4.8, pp. 356–364)

Ahora `dz/dx ≠ 0`. La ec. (4.18) transformada [(4.42), p.356]:

```
(1/(2·pi))·∫₀^{pi} gamma(theta)·sin(theta) dtheta / (cos theta − cos theta_0)
      = V_inf·( alpha − dz/dx )                                            (4.42)
```

**La solución en serie de Fourier** [(4.43), p.357]:

```
gamma(theta) = 2·V_inf · [ A0·(1 + cos theta)/sin theta  +  sum_{n=1..inf} An·sin(n·theta) ]   (4.43)
```

El primer término es el del perfil simétrico (4.24); el resto es una **serie de senos** que
también se anula en `theta = pi` ⇒ **(4.43) satisface Kutta automáticamente** [p.358].

Segunda integral estándar [(4.45), p.357]:

```
∫₀^{pi} sin(n·theta)·sin(theta) dtheta / (cos theta − cos theta_0) = −pi·cos(n·theta_0)   (4.45)
```

Sustituyendo, (4.42) se reduce a una **serie de cosenos de Fourier para `dz/dx`**
[(4.46), p.357]:

```
dz/dx = (alpha − A0) + sum_{n=1..inf} An·cos(n·theta_0)                    (4.46)
```

y por análisis de Fourier estándar [(4.47)–(4.51), p.358]:

```
A0 = alpha − (1/pi)·∫₀^{pi} (dz/dx) dtheta_0                               (4.50)
An = (2/pi)·∫₀^{pi} (dz/dx)·cos(n·theta_0) dtheta_0                        (4.51)
```

> **La estructura que hay que codificar:** `A0` depende de `alpha` **y** de la forma;
> `An` (n ≥ 1) dependen **solo de la forma** [p.358]. Por eso la pendiente es `2pi` siempre y
> lo único que cambia con la curvatura es el corrimiento `alpha_L=0`, y por eso `cm_c/4` no
> depende de `alpha`.

#### 2.8.1 Coeficientes

Circulación [(4.52)–(4.54), pp. 358–359], usando
`∫₀^{pi}(1+cos theta)dtheta = pi` y `∫₀^{pi} sin(n theta)·sin(theta) dtheta = pi/2` si `n=1`,
`0` si `n≠1`:

```
Gamma = c·V_inf·( pi·A0 + (pi/2)·A1 )                                      (4.54)
L'    = rho_inf·V_inf²·c·( pi·A0 + (pi/2)·A1 )                             (4.55)
cl    = pi·(2·A0 + A1)                                                     (4.56)
```

**Forma explícita** [(4.57), p.359]:

```
cl = 2·pi·[ alpha + (1/pi)·∫₀^{pi} (dz/dx)·(cos theta_0 − 1) dtheta_0 ]    (4.57)
dcl/dalpha = 2·pi                                                          (4.58)
```

> *"**It is a general result from thin airfoil theory that dcl/dalpha = 2·pi for any shape
> airfoil.**"* [p.359]

**El ángulo de sustentación nula** [(4.59)–(4.61), pp. 359–360]:

```
cl = 2·pi·( alpha − alpha_L=0 )                                            (4.60)

alpha_L=0 = −(1/pi)·∫₀^{pi} (dz/dx)·(cos theta_0 − 1) dtheta_0             (4.61)
```

> *"thin airfoil theory provides a means to predict the angle of zero lift. […] Equation (4.61)
> yields `alpha_L=0 = 0` for a symmetric airfoil […] Also, note that **the more highly cambered
> the airfoil, the larger will be the absolute magnitude of alpha_L=0**."* [p.360]

**Momentos** [(4.62)–(4.66), p.360]:

```
cm_le   = −(pi/2)·( A0 + A1 − A2/2 )                                       (4.62)
cm_le   = −[ cl/4 + (pi/4)·(A1 − A2) ]                                     (4.63)
cm_c/4  = (pi/4)·( A2 − A1 )                                               (4.64)
x_cp    = −M'_LE/L' = −cm_le·c/cl                                          (4.65)
x_cp    = (c/4)·[ 1 + (pi/cl)·(A1 − A2) ]                                  (4.66)
```

**Consecuencias que la UI debe reflejar** [p.360]:
- `cm_c/4` es **finito** para perfil con curvatura ⇒ el cuarto de cuerda **NO** es el centro de
  presión.
- Pero `A1` y `A2` **no dependen de `alpha`** ⇒ `cm_c/4` es independiente de `alpha` ⇒ **el
  cuarto de cuerda SÍ es el centro aerodinámico**.
- `x_cp` **se mueve con `cl`**: *"as the lift approaches zero, x_cp moves toward infinity; that
  is, **it leaves the airfoil**. For this reason, the center of pressure is not always a
  convenient point at which to draw the force system on an airfoil."* [p.361]
  → **Decisión de UI: reportar fuerzas en el centro aerodinámico, no en el centro de presión.**
- Con `dz/dx = 0`: `A1 = A2 = 0` y (4.63) se reduce a (4.39). El simétrico es caso particular ✓.

**Validación (Ej. 4.6, NACA 23012, p.363):** calculado vs. experimento →
`alpha_L=0`: −1.09° vs −1.1°; `cl(4°)`: 0.559 vs 0.55; `cm_c/4`: −0.0127 vs −0.01.
*"the results from thin airfoil theory for a cambered airfoil agree very well with the
experimental data"* [p.365].

**Rango de validez de la teoría del perfil delgado** [§4.10, p.369, textual]:
> *"it applies only to thin airfoils at small angles of attack. […] the results compare
> favorably with experimental data **for airfoils of about 12 percent thickness or less**.
> However, the airfoils on many low-speed airplanes are thicker than 12 percent. Moreover, we
> are frequently interested in high angles of attack, such as occur during takeoff and
> landing."*

Y no ve nada de: espesor, `cl_max`, desplome, arrastre.

---

### 2.9 EL CENTRO AERODINÁMICO A PARTIR DE DATOS (§4.9, pp. 365–369)

Tomando momentos respecto del punto `c·x̄_ac` [(4.67)–(4.71)]:

```
M'_ac  = L'·(c·x̄_ac − c/4) + M'_c/4                                       (4.67)
cm_ac  = cl·(x̄_ac − 0.25) + cm_c/4                                        (4.68)
d(cm_ac)/dalpha = 0  (por definición del centro aerodinámico)              (4.69–4.70)

con  a0 ≡ dcl/dalpha  y  m0 ≡ d(cm_c/4)/dalpha :

x̄_ac = −m0/a0 + 0.25                                                      (4.71)
```

> *"Equation (4.71) proves that, **for a body with linear lift and moment curves**, that is,
> where a0 and m0 are fixed values, the aerodynamic center exists as a fixed point on the
> airfoil."* [p.367]
>
> Rango de validez explícito: *"**For airfoils below the stalling angle of attack**, the slopes
> of the lift coefficient and moment coefficient curves are constant."* [p.366]

**Del DESIGN BOX [pp. 368–369]** — dato de diseño que el CAD debe exponer:
- El centro aerodinámico está **cerca** del cuarto de cuerda, no exactamente ahí.
- Familia **NACA 230XX**: `x̄_ac` **delante** de `c/4`, y se va **más adelante** al aumentar el
  espesor (Fig. 4.31a).
- Familia **NACA 64-2XX**: `x̄_ac` **detrás** de `c/4`, y se va **más atrás** al aumentar el
  espesor (Fig. 4.31b).
- *"in flight dynamics, and in particular the consideration of the stability and control of
  flight vehicles, placing the lift and drag at, and dealing with the moment about, the
  aerodynamic center, is particularly convenient. The fact that M'_ac for a flight vehicle is
  independent of angle of attack simplifies the analysis of the stability and control
  characteristics"*. → **Es la costura con el bloque de estabilidad de Raymer.**

---

### 2.10 §4.10 — EL MÉTODO DE PANELES DE VÓRTICES (pp. 369–375) ★ ALGORITMO #2

Este es **el** solver del producto. Es §3.17 con vórtices en lugar de fuentes, **más** la
condición de Kutta.

#### 2.10.1 Por qué

> *"because a source has zero circulation, source panels are useful only for nonlifting cases.
> In contrast, vortices have circulation, and hence vortex panels can be used for lifting
> cases."* [§4.10, p.369]

Se vuelve a envolver **toda la superficie del cuerpo** con la sábana (no la línea de curvatura,
como en la teoría del perfil delgado). *"There exists no closed-form analytical solution for
gamma(s); rather, the solution must be obtained numerically."* [p.370]

#### 2.10.2 Discretización e incógnitas

Idénticas a §3.17 [p.370]:
- `n` paneles rectos; `gamma_j` **constante sobre cada panel**, variable de panel a panel.
- **Incógnitas: `gamma_1 … gamma_n`.**
- **Punto de control = punto medio de cada panel.**
- *"the main thrust of the panel technique is to solve for gamma_j, j = 1 to n, such that the
  body surface becomes a streamline of the flow **and such that the Kutta condition is
  satisfied**."*

#### 2.10.3 Ecuaciones

Potencial de un vórtice-panel [(4.72)–(4.75), p.370]:

```
phi_j        = −(1/(2·pi))·∫_j theta_pj · gamma_j ds_j                     (4.72)
theta_pj     = atan( (y − y_j) / (x − x_j) )                               (4.73)
phi(P)       = −sum_j (gamma_j/(2·pi))·∫_j theta_pj ds_j                   (4.74)
theta_ij     = atan( (y_i − y_j)/(x_i − x_j) )
phi(x_i,y_i) = −sum_j (gamma_j/(2·pi))·∫_j theta_ij ds_j                   (4.75)
```

Condición de frontera de no-penetración [(3.148), (4.76)–(4.79), p.371]:

```
V_inf,n = V_inf·cos(beta_i)                                                (3.148)
V_n     = ∂/∂n_i [ phi(x_i,y_i) ] = −sum_j (gamma_j/(2·pi))·∫_j (∂theta_ij/∂n_i) ds_j   (4.77)
V_inf,n + V_n = 0                                                          (4.78)

V_inf·cos(beta_i) − sum_{j=1..n} (gamma_j/(2·pi))·∫_j (∂theta_ij/∂n_i) ds_j = 0   (4.79)
```

> *"Equation (4.79) is the crux of the vortex panel method. **The values of the integrals in
> Equation (4.79) depend simply on the panel geometry; they are not properties of the flow.**"*
> [p.371] — otra vez: la matriz se calcula una vez por geometría.

Con `J_ij` = esa integral [(4.80), p.371]:

```
V_inf·cos(beta_i) − sum_{j=1..n} (gamma_j/(2·pi))·J_ij = 0                 (4.80)
```

> **Nota de implementación [EXTENSIÓN DECLARADA]:** Anderson **no da** la forma cerrada de
> `J_ij` (sí dio la de `I_ij` en (3.163)). Se deduce por el mismo procedimiento y con los
> **mismos** coeficientes `A,B,C,D,E,S_j` de §3.17, porque la geometría es idéntica; los
> integrandos normal/tangencial de fuente y vórtice están relacionados por un giro de 90°.
> Consecuencia práctica: **implementa un solo núcleo geométrico** que devuelva las dos
> integrales de (3.163) y (3.165), y arma con ellas tanto el operador de fuentes como el de
> vórtices. Motivo de la extensión: el libro remite explícitamente a la literatura
> (References 14, 15, 62, 63 — Katz & Plotkin) para el detalle numérico; ver §7 NO OBSERVADO.

#### 2.10.4 La condición de Kutta, impuesta numéricamente — el corazón del método

Aquí está la diferencia real con §3.17. [§4.10, pp. 371–372]:

> *"For the source panel method, the n equations for the n unknown source strengths are
> routinely solved […] In contrast, for the lifting case with vortex panels, **in addition to
> the n equations given by Equation (4.80) applied at all the panels, we must also satisfy the
> Kutta condition**. This can be done in several ways."*

La receta que da el libro:

1. Los **dos paneles del borde de salida** (`i` e `i−1`, Fig. 4.32) se hacen **muy pequeños**.
2. Kutta exacta es `gamma(TE) = 0`. Numéricamente, si `i` e `i−1` están suficientemente cerca
   del borde de salida:
   ```
   gamma_i = − gamma_{i−1}                                                 (4.81)
   ```
   *"such that the strengths of the two vortex panels i and i − 1 exactly cancel at the point
   where they touch at the trailing edge."*
3. **El sistema queda sobredeterminado**: `n` incógnitas con `n + 1` ecuaciones (las `n` de
   (4.80) más (4.81)).
4. **Fix del libro:** *"to obtain a determined system, Equation (4.80) is **not evaluated at one
   of the control points on the body**. That is, we choose to ignore one of the control points,
   and we evaluate Equation (4.80) at the other n − 1 control points."*

> **Esta arbitrariedad es un defecto conocido y el libro lo dice de frente** [p.373]:
> *"The need to ignore one of the control points in order to have a determined system […]
> introduces some arbitrariness in the numerical solution. **Which control point do you
> ignore? Different choices sometimes yield different numerical answers** for the distribution
> of gamma over the surface."*
>
> **Requisito de producto que se sigue:** el punto de control descartado tiene que ser un
> parámetro **explícito y reproducible** del solver (guardado en la cápsula del estudio), no un
> índice mágico. Y el estudio debe reportar la sensibilidad si el usuario lo cambia.

#### 2.10.5 Salida: cómo se sacan Cp, cl y cm

**La joya del método de vórtices** [§4.10, pp. 372–373]: se impone velocidad **cero dentro** del
cuerpo (Fig. 4.33). Entonces en (4.8), `u_2 = 0`, y

```
gamma = u_1 − u_2 = u_1 − 0 = u_1
```

> *"the local velocities tangential to the airfoil surface are **equal to the local values of
> gamma**. In turn, the local pressure distribution can be obtained from Bernoulli's equation."*

Es decir: **`V_i = gamma_i` directamente**. No hay que hacer una segunda pasada de integrales
tangenciales como en §3.17 (§2.4.6). Luego:

```
Cp_i = 1 − (gamma_i / V_inf)²                        [de (3.38)]
```

Circulación y sustentación [(4.82), (4.83), p.373]:

```
Gamma = sum_{j=1..n} gamma_j · s_j                                         (4.82)
L'    = rho_inf · V_inf · sum_{j=1..n} gamma_j · s_j                       (4.83)
```

`cl = L'/(q_inf·c)`. Y `cm` sale integrando `Cp_i` con el brazo de cada panel respecto del punto
elegido — el libro no da la fórmula discreta de `cm`, pero (3.102)/(3.103) y (1.15)/(1.16) dan
la receta: integrar `Cp` sobre la superficie. **[EXTENSIÓN DECLARADA]** el paso de `Cp_i` a
`cm_c/4` discreto es aritmética directa (sumar `Cp_i · (componente) · (brazo)`), no está escrito
en el libro; márcalo como tal en el código.

#### 2.10.6 Orden del método, y por qué existe el de segundo orden

[§4.10, pp. 373–375]:

- El método descrito es **de primer orden**: `gamma` **constante** sobre cada panel.
- **De segundo orden**: `gamma` con **variación lineal** sobre cada panel (Fig. 4.34); el valor
  de `gamma` en los bordes de cada panel se **empalma** con el vecino, y **las incógnitas pasan
  a ser los `gamma` en los puntos frontera**. La condición de tangencia se sigue imponiendo en
  el punto de control de cada panel.
- Validación mostrada: `Cp` sobre un **NACA 0012 a 9° de ángulo de ataque**, paneles de segundo
  orden (Universidad de Maryland) vs. resultados NACA de la Ref. 11 → *"Excellent agreement is
  obtained."* [p.375, Fig. 4.35].

#### 2.10.7 Los gotchas que el libro entrega gratis

> *"Although the method may appear to be straightforward, **its numerical implementation can
> sometimes be frustrating.**"* [p.373]

| Problema | Cita | Qué hace el producto |
|---|---|---|
| Sensible al **número** de paneles | *"the results for a given body are sensitive to the number of panels used"* | Convergencia de malla como gate: correr `n` y `2n`, exigir `Δcl < tol`. |
| Sensible a los **tamaños** y a la **distribución** | *"it is usually advantageous to place a large number of small panels near the leading and trailing edges of an airfoil and a smaller number of larger panels in the middle"* | Distribución tipo coseno por defecto, no uniforme. Ya está en `nacaProfile()`. |
| Arbitrariedad del punto de control descartado | *"Different choices sometimes yield different numerical answers"* | Parámetro explícito + reportado. |
| **Oscilaciones** en `gamma` panel a panel | *"the resulting numerical distributions for gamma are not always smooth, but rather, they have oscillations from one panel to the next as a result of numerical inaccuracies"* | Detectar y avisar; opción de segundo orden. |
| Mitigación recomendada | *"what is more common today is to use a **combination of both source and vortex panels** (source panels to basically simulate the airfoil thickness and vortex panels to introduce circulation) in a panel solution. This combination helps to mitigate some of the practical numerical problems just discussed."* [p.373] | **Arquitectura objetivo de `panel2d.ts`.** |

---

### 2.11 D'ALEMBERT: EL ARRASTRE CERO (§3.13 p.258, §3.20, §4.12 p.379)

**El resultado.** En flujo no viscoso incompresible sobre un cilindro, la distribución de
presión es simétrica respecto de **ambos** ejes ⇒ la presión sobre el frente está exactamente
equilibrada por la de atrás ⇒ **arrastre neto cero**. Y sigue siendo cero **aunque haya
circulación** [(3.132), p.274].

**La cita completa** [§3.13, p.258]:

> *"In real life, the result of zero lift is easy to accept, **but the result of zero drag
> makes no sense.** We know that any aerodynamic body immersed in a real flow will experience a
> drag. This paradox between the theoretical result of zero drag, and the knowledge that in
> real life the drag is finite, was encountered in the year 1744 by the Frenchman Jean Le Rond
> d'Alembert—and it has been known as **d'Alembert's paradox** ever since. For d'Alembert and
> other fluid dynamic researchers during the eighteenth and nineteenth centuries, this paradox
> was unexplained and perplexing. **Of course, today we know that the drag is due to viscous
> effects** which generate frictional shear stress at the body surface and which cause the flow
> to separate from the surface on the back of the body, thus creating a large wake downstream
> of the body and **destroying the symmetry of the flow about the vertical axis**."*

**Qué le falta exactamente al modelo — dos cosas, no una** [§4.12, p.380]:

> *"The paradox is immediately removed when viscosity (friction) is included in the flow.
> Indeed, viscosity in the flow is totally responsible for the aerodynamic drag on an airfoil.
> It acts through two mechanisms:*
> 1. *Skin-friction drag, due to the shear stress acting on the surface*
> 2. *Pressure drag due to flow separation, sometimes called form drag"*

**Y la ironía que cierra el círculo:** la misma viscosidad que el modelo desprecia (y que le
cuesta el arrastre) es la que **hace cumplir la condición de Kutta** y por tanto le **regala la
sustentación correcta** (§4.5.1). El modelo no viscoso es correcto en sustentación *gracias* a
lo que ignora, e incorrecto en arrastre *por* lo que ignora.

**Cómo se dice esto en el producto:** el solver de paneles debe reportar
`cd_potencial = 0 (d'Alembert — este número NO es el arrastre)` de forma **explícita y con
etiqueta**, nunca como `cd = 0`. Es el ejemplo más limpio del proyecto de "el wow emerge de la
corrección": mostrar el cero y explicarlo.

---

### 2.11b EL CILINDRO REAL — DÓNDE MUERE LA TEORÍA, MEDIDO (§3.18, pp. 294–302)

Esta sección es el **contraejemplo cuantificado** del §2.1. Mismo cuerpo, misma `Cp` teórica, y
el mundo real haciendo otra cosa. Es el mejor material de escuela del capítulo 3.

```
Re = rho_inf · V_inf · d / mu_inf        (d = diámetro)
C_D = f(Re)                              (Figura 3.44)
```

**LOS SEIS REGÍMENES, con sus números** [§3.18, pp. 295–299]:

| Re | Régimen | Qué pasa | `C_D` |
|---|---|---|---|
| `0 < Re < 4` | **Flujo de Stokes** | *"streamlines are almost (but not exactly) symmetrical, and the flow is attached"*; *"near balance of pressure forces with friction forces"* | muy grande |
| `4 < Re < 40` | **Dos vórtices fijos** | *"the flow becomes separated on the back […] forming two distinct, **stable** vortices that remain in position"* | — |
| `Re > 40` | **Calle de vórtices de Kármán** | *"the vortices […] now are **alternately shed** from the body in a regular fashion"*. Nombrada por Theodor von Kármán, que la estudió desde **1911** en Göttingen | — |
| `Re ~ 10⁵` | **Estela turbulenta, separación laminar** | *"The laminar boundary layer […] separates from the surface on the forward face, **at a point about 80° from the stagnation point**"* | ≈1, *"relatively constant value near unity for 10³ < Re < 3×10⁵"* |
| `3×10⁵ < Re < 3×10⁶` | **LA CRISIS DEL ARRASTRE** | separa laminar en la cara delantera, **transita a turbulento en la capa libre**, **reatacha** en la cara trasera y vuelve a separar *"at about **120°** around the body"*. Estela **más delgada** | **cae de ≈1 a ≈0.3** |
| `Re > 3×10⁶` | **Turbulento desde la cara delantera** | separa *"slightly less than 120°"*; los puntos de separación se acercan al tope y al fondo → **estela más gorda** | **vuelve a subir**, ≈0.6 a `Re = 10⁷` |

Rango de la Figura 3.44: `Re` de `10⁻¹` a `10⁷`.

**La causa de la caída súbita** [p.294]:
> *"the phenomenon is caused by a **sudden transition of laminar flow within the boundary layer at
> the lower values of Re to a turbulent boundary layer at the higher values of Re.**"*

**LA RESOLUCIÓN DE LA PARADOJA, en una frase** [§3.18, p.299]:
> *"the real flow over a circular cylinder is dominated by friction effects, namely, **the
> separation of the flow over the rearward face of the cylinder. In turn, a finite pressure drag
> is created on the cylinder, and d'Alembert's paradox is resolved.**"*

**`Cp` teórico vs. `Cp` medido** [Fig. 3.49, p.300] — el gráfico que hay que reproducir en el CAD:
> *"theory and experiment **agree well on the forward face** of the cylinder, but that **dramatic
> differences occur over the rearward face**. […] In contrast, in the real case where flow
> separation occurs, **the pressures are relatively constant in the separated region over the
> rearward face and have values slightly less than freestream pressure**. […] **There is a net
> imbalance of the pressure distribution between the front and back faces, with the pressures on
> the front being higher than on the back, and this imbalance produces the drag on the
> cylinder.**"*

> **REQUISITO DE ESCUELA Y DE UI:** superponer en la misma gráfica `Cp = 1 − 4·sin²(theta)`
> (teórico), el resultado del método de paneles, y la curva experimental subcrítica/supercrítica.
> Es la lámina que enseña de un golpe qué hace bien y qué hace mal el motor.

**Por qué a un aeronáutico le importa el Re bajo: casi nunca** [p.300]: para `Re ≈ 1` a 30 m/s a
nivel del mar hace falta `d ≈ 4×10⁻⁷ m`, *"only slightly larger than the **mean free path at
standard sea level, which is 6.6×10⁻⁸ m**. Clearly, Reynolds numbers on the order of unity are of
little practical aerodynamic importance."*

---

### 2.12 EL ARRASTRE REAL (§4.12, pp. 379–395)

```
cd = cd_f (fricción) + cd_p (presión por separación)          [profile drag]
```

#### 2.12.1 El modelo: placa plana a ángulo de ataque cero

> *"As a first approximation, we assume that skin-friction drag on an airfoil is essentially the
> same as the skin-friction drag on a flat plate at zero angle of attack […] **Obviously, this
> approximation becomes more accurate the thinner the airfoil and the smaller the angle of
> attack.**"* [§4.12.1, p.380]

**Validación de esa aproximación** [§4.12.5, p.394]: comparando CFD de Lombardi et al. (Ref. 88)
para el NACA 0012 a `alpha = 0` con la placa plana, las distribuciones de `c_f = tau_w/q_inf`
*"are remarkably close; clearly, for the purpose of the present section the modeling of the
airfoil skin friction drag by use of flat plate results is reasonable."*

#### 2.12.2 Laminar (§4.12.1, pp. 380–382)

```
delta = 5.0·x / sqrt(Re_x)                                                 (4.84)
Re_x  = rho_e·V_inf·x / mu_inf
```
`delta ∝ sqrt(x)` — la capa límite laminar crece **parabólicamente**.

```
C_f ≡ D_f,top/(q_inf·S) = D_f,bottom/(q_inf·S) = 1.328 / sqrt(Re_c)        (4.85), (4.86)
Re_c = rho_inf·V_inf·c / mu_inf
```

> **`C_f` de (4.86) es POR UNA CARA.** Para el perfil: `Net C_f = 2·C_f`. `D_f = 2·D_f,top`.
> Es el error de factor 2 más fácil de cometer.

#### 2.12.3 Turbulento (§4.12.2, pp. 382–383)

```
delta = 0.37·x / Re_x^(1/5)                                                (4.87)
C_f   = 0.074 / Re_c^(1/5)                                                 (4.88)
```

**Rango de validez declarado explícitamente** [p.383]:
> *"We emphasize again that **Equations (4.87) and (4.88) are only approximate results, and they
> represent only one set of results among a myriad of different turbulent flow analyses** for
> the flat plate boundary layer."* Y: *"there are no exact analytical solutions for turbulent
> flow […] **All analyses of turbulent flow are approximate.**"* [p.382]

Nota estructural: laminar va como `Re^(−1/2)`, turbulento como `Re^(−1/5)`.

#### 2.12.4 Transición (§4.12.3, pp. 384–385)

```
Re_x,cr = rho_inf·V_inf·x_cr / mu_inf                                      (4.89)
```

**Cálculo compuesto laminar+turbulento** (Ej. 4.10, pp. 386–387). La sutileza clave:

> *"Because the Reynolds number in the equations for skin friction drag coefficient is **always
> based on length measured from the leading edge**, we cannot simply calculate the turbulent
> skin friction drag coefficient for region 2 by using Equation (4.88) with a Reynolds number
> based on x2."*

La receta correcta [(4.90)–(4.93)]:

```
D_f = q_inf·x1·(C_f,1)_lam + q_inf·c·(C_f,c)_turb − q_inf·x1·(C_f,1)_turb  (4.90)
C_f = D_f/(q_inf·c)                                                        (4.91)

C_f = (x1/c)·(C_f,1)_lam + (C_f,c)_turb − (x1/c)·(C_f,1)_turb              (4.92)
```
donde `(C_f,1)` se evalúa con `Re_x1` y `(C_f,c)` con `Re_c`. Es decir: **turbulento sobre toda
la placa, menos el turbulento del tramo 1, más el laminar del tramo 1.**

**Y la advertencia dura sobre quién aporta `Re_cr`** [p.385]:

> *"an accurate value for Re_x,cr applicable to your problem **must come from somewhere—
> experiment, free flight, or some semi-empirical theory—and this may be difficult to obtain.**"*

Sensibilidad medida por el propio libro [p.388]: pasar `Re_cr` de 500,000 a 1,000,000 baja el
`C_f` calculado **16 %**. *"This difference underscores the importance of knowing where
transition takes place on a surface for the calculation of skin friction drag."*

#### 2.12.5 Reparto fricción/presión (§4.12.3, p.389)

Del NACA 0012 con CFD (Lombardi et al., Ref. 88), `Re_c = 3×10⁶`, con modelo de transición:
`cd_total = 0.00623`, `cd_f = 0.00534` ⇒ **presión por separación = 15 % del total**.

> *"For a streamlined body, this drag breakdown is reasonable […] **it is reasonable to expect
> 80 percent of the drag to be skin friction drag and 20 percent to be pressure drag due to
> flow separation.**"* [p.389]
>
> Y el contrapunto: *"as the body becomes less streamlined (more like a blunt body), **the
> pressure drag becomes the dominant factor**."*

#### 2.12.6 Separación y gradiente adverso (§4.12.4, pp. 389–394)

**Definición** [p.390]: *"By definition, an **adverse pressure gradient** is a region where the
pressure increases in the flow direction, that is, […] the region where `dp/dx` is positive."*

**El mecanismo físico** [p.394] — esto es lo que hay que animar:

> *"in a region of adverse pressure gradient the fluid elements moving along a streamline have
> to work their way 'uphill' against an increasing pressure. […] consider a fluid element deep
> inside the boundary layer. **Its velocity is already small because it is retarded by friction
> forces.** The fluid element still encounters the same adverse pressure gradient because the
> pressure is transmitted without change normal to the wall, but **its velocity is too low to
> negotiate the increasing pressure. As a result, the element comes to a stop somewhere
> downstream and reverses its direction.**"*

**Las dos consecuencias de separar** [p.393]:
1. *"A drastic loss of lift (stalling)."*
2. *"A major increase in drag, caused by pressure drag due to flow separation."*

Datos concretos del NASA LS(1)-0417 [Figs. 4.45, 4.46, pp. 390–391]:
- A `alpha = 0`: `Cp = 1.0` en el estancamiento, mínimo de presión a **~10 % de la cuerda**,
  recuperación **gradual** hasta un valor ligeramente sobre `p_inf` en el borde de salida.
  Gradiente adverso *"moderate"*, flujo adherido.
- A `alpha = 18.4°`, cálculo **no viscoso** (artificial): `Cp` baja hasta **casi −9** y luego
  sube brutalmente. Gradiente adverso *"severe"*. El flujo real **separa**: el `Cp` real ni baja
  tanto ni recupera por encima de `p_inf`.

> **Requisito de UI que sale de aquí (R23):** el solver de paneles calcula `Cp(x)` gratis. Pintar
> `dCp/dx` y marcar en rojo la zona de gradiente adverso fuerte le da al ingeniero **el aviso de
> separación que el propio modelo no puede dar**. Es honestidad convertida en feature.

---

### 2.13 EL DESPLOME Y EL EFECTO DEL ESPESOR (§4.13, pp. 395–406)

#### 2.13.1 Los tres tipos de desplome

| Tipo | Perfil de ejemplo | Espesor | Comportamiento |
|---|---|---|---|
| **Borde de ataque** (leading-edge stall) | **NACA 4412** | *"relatively thin airfoils with thickness ratios between **10 and 16 percent** of the chord length"* [p.397] | Separación **súbita y total** originada en el borde de ataque. Curva `cl` con **pico agudo** y caída **precipitada**. `cl_max` **alto**. |
| **Borde de salida** (trailing-edge stall) | **NACA 4421** | más grueso (21 %) | *"a progressive and gradual movement of separation from the trailing edge toward the leading edge as alpha is increased"* [p.397]. Curva se **dobla suave**; *"The stall is 'soft'"*. `cl_max` **menor** que el anterior. |
| **Perfil delgado** (thin-airfoil stall) | placa plana (2 % de espesor) | extremadamente delgado | Burbuja de separación en el borde de ataque **desde ángulos muy bajos** (≈3°), que crece hasta cubrir la placa. Desplome muy suave y `cl_max` **considerablemente menor** que los dos NACA. |

**El dato de diseño más valioso de la sección** [§4.13, p.397]:

> *"For both the NACA 4412 and 4421 airfoils, **the shape of the mean camber line is the same**.
> From the thin airfoil theory discussed in this chapter, the linear lift slope and the zero-lift
> angle of attack should be the same for both airfoils; **this is confirmed by the experimental
> data** in Figure 4.51. The only difference between the two airfoils is that one is thicker than
> the other. Hence […] **the major effect of thickness of the airfoil is its effect on the value
> of `cl_max`**"*.

Es decir: **la teoría del perfil delgado acierta en pendiente y `alpha_L=0` aunque el espesor
cambie el doble** — pero es **ciega** a `cl_max`, que es puro efecto del espesor.

**La curva de `cl_max` vs. espesor** [Fig. 4.53, pp. 400–401, serie NACA 63-2XX]:
> *"as the thickness ratio increases from a small value, `cl_max` first increases, reaches a
> **maximum value at a thickness ratio of about 12 percent**, and then decreases at larger
> thickness ratios."*
Y: *"`cl_max` for a given airfoil is clearly a function of Re, with **higher values of `cl_max`
corresponding to higher Reynolds numbers**."*

#### 2.13.2 Condiciones de los ensayos citados

Figuras 4.49 (NACA 4412), 4.50 (NACA 4421), 4.52 (placa plana): datos experimentales de
Nakayama (*Visualized Flow*, JSME, 1988), **`Re = 2.1 × 10⁵`, `V_inf = 8 m/s` en aire**
[pp. 396, 398]. Los valores de `cl` anotados en las figuras se listan como fixtures en §3.

#### 2.13.3 Las dos figuras de mérito de un perfil [§4.13, p.401]

> *"there are two figures of merit that are primarily used to judge the quality of a given
> airfoil: 1. **The lift-to-drag ratio L/D** […] the range of the vehicle is directly
> proportional to the L/D ratio. 2. **The maximum lift coefficient `cl_max`**."*

Y el enlace con Raymer [(1.47), p.401]:
```
V_stall = sqrt( 2·W / (rho_inf · S · C_L,max) )                            (1.47)
```

#### 2.13.4 Dispositivos hipersustentadores (§4.13, pp. 402–405)

- **Flap de borde de salida:** aumenta la **curvatura efectiva** ⇒ por (4.61) `alpha_L=0` se hace
  **más negativa** ⇒ *"this lift curve simply **translates to the left**"* [p.402]. Sube `cl_max`,
  pero *"the angle of attack at which `cl_max` occurs is slightly decreased"*.
  **La teoría del perfil delgado SÍ predice esto** — es su aplicación de diseño más directa.
- **Slat de borde de ataque:** flujo secundario por la ranura que **mitiga el gradiente adverso**
  y retrasa la separación. *"There is **no change in alpha_L=0**; rather, the lift curve is simply
  extended to a higher stalling angle of attack"* [p.404]. NACA 4412: ángulo de desplome pasa de
  **~15° a ~30°** con el slat extendido [p.404].
- **Combinado** (slat + flap multielemento, `alpha = 25°`, Fig. 4.58): aunque el flujo principal
  sobre el extradós está esencialmente separado, el flujo local por las ranuras sigue adherido, y
  *"the lift coefficient is still quite high, **on the order of 4.5**"* [p.405].

#### 2.13.5 El veredicto sobre el rango de validez del capítulo entero

[§4.13, p.405]:

> *"the real flow at high angles of attack is dominated by flow separation—**a phenomenon that is
> not properly modeled by the inviscid theories presented in this chapter**. On the other hand,
> **at lower angles of attack, such as those associated with the cruise conditions of an
> airplane, the inviscid theories presented here do an excellent job of predicting both lift and
> moments** on an airfoil."*

---

### 2.14 PERFILES MODERNOS (§4.11, pp. 375–377)

Nacieron **del método de paneles**, lo cual es el mejor argumento de venta del producto:

> *"the new NASA airfoils were **designed on a computer using a numerical technique similar to
> the source and vortex panel methods discussed earlier**, along with numerical predictions of
> the viscous flow behavior (skin friction and flow separation). Wind-tunnel tests were then
> conducted to verify the computer-designed profiles"* [§4.11, p.375]

**NASA LS(1)-0417** (antes GA(W)-1), primer avión de producción que lo usó: **Piper PA-38
Tomahawk** [p.377]. Rasgos de diseño y su por qué [p.376]:
- **Radio de borde de ataque grande: `0.08c` frente al estándar `0.02c`** — *"in order to flatten
  the usual peak in pressure coefficient near the nose"*.
- **Intradós con cúspide cerca del borde de salida** — *"in order to increase the camber and hence
  the aerodynamic loading in that region"*.
- Ambos rasgos *"tend to discourage flow separation over the top surface at high angle of attack,
  hence yielding higher values of the maximum lift coefficient"*.
- Espesor máximo **17 %**, `cl` de diseño **0.4**.

**Ganancias medidas de la familia LS(1)-04xx frente a los NACA del mismo espesor** [p.376]:
1. *"Approximately **30 percent higher `cl_max`**."*
2. *"Approximately a **50 percent increase in the ratio of lift to drag (L/D) at a lift
   coefficient of 1.0**."* (`cl = 1.0` es típico del ascenso en aviación general.)

**DESIGN BOX — problema directo vs. problema inverso** [pp. 377–379]. Esto define el roadmap del
producto:

> *"**the direct problem, wherein the shape of the body is given, and the surface pressure
> distribution (for example) is calculated.** For design purposes, it is desirable to turn this
> process inside-out; it is desirable to **specify the surface pressure distribution** […] and
> calculate the shape of the airfoil that will produce the specified pressure distribution. This
> approach is called the **inverse problem**."*

Y el cierre que justifica que el producto lleve **las dos** cosas [p.379]:

> *"keep in mind that **the simpler analytical approach of thin airfoil theory** discussed in the
> present chapter, and especially the simple practical results of this theory, **will continue to
> be part of the whole 'toolbox' of procedures to be used by the designer in the future.**"*

---

## 3. FIXTURES DE TEST

Todos los ejemplos numéricos resueltos de los caps. 3 y 4. Salvo aviso, la tolerancia sugerida
es **1 %** porque el libro redondea a 3–4 cifras. Los que dependen de **leer una gráfica** llevan
banda ancha y están marcados `[LECTURA DE FIGURA]`.

### 3.0 INVARIANTES ANALÍTICOS — los tests que no dependen de ningún ejemplo

```
FIXTURE anderson-inv-cilindro-cp [§3.13, p.259, ec. (3.101)]
entradas: cilindro circular de radio R, flujo no viscoso incompresible sin circulación
salida esperada: Cp(theta) = 1 - 4*sin(theta)^2 EXACTO en toda la superficie
                 Cp = +1.0 en theta = 0 y pi (estancamientos)
                 Cp = -3.0 en theta = pi/2 y 3pi/2 (velocidad maxima 2*V_inf)
                 V_r = 0 en r = R (no-penetracion exacta)
                 cl = 0 ; cd = 0
tolerancia: el solver de paneles con 8 paneles debe dar |Cp_panel - Cp_exacto| pequeño
            (Anderson: "a circular cylinder can be accurately represented by as few as
            8 panels"); con 64 paneles exigir < 1e-3
ES EL FIXTURE DE ORO de panel2d.ts
```

```
FIXTURE anderson-inv-masa-cero [§3.17, p.290, ec. (3.157)]
entradas: cualquier cuerpo CERRADO resuelto con paneles de fuentes
salida esperada: sum_j (lambda_j * S_j) = 0
tolerancia: |sum| / (V_inf * perimetro) < 1e-10   (es exacto hasta redondeo de la
            factorizacion; si no da cero, el cuerpo esta creando o tragando masa)
ASERCION DURA del solver, no test opcional
```

```
FIXTURE anderson-inv-pendiente-2pi [§4.7-4.8, pp.352 y 359, ecs. (4.34) y (4.58)]
entradas: CUALQUIER perfil delgado, simetrico o con curvatura
salida esperada: dcl/dalpha = 2*pi por radian = 0.11 por grado
                 (2*pi/57.3 = 0.1097)
tolerancia: 1 % ; el libro escribe explicitamente "0.11 degree^-1"
literal: "It is a general result from thin airfoil theory that dcl/dalpha = 2*pi
         for any shape airfoil." [p.359]
```

```
FIXTURE anderson-inv-simetrico [§4.7, p.355]
entradas: perfil simetrico (dz/dx = 0) a angulo alpha [rad]
salida esperada: gamma(theta) = 2*alpha*V_inf*(1+cos theta)/sin theta   (4.24)
                 gamma(pi) = 0                       (condicion de Kutta, por L'Hopital)
                 Gamma  = pi*alpha*c*V_inf                              (4.30)
                 cl     = 2*pi*alpha                                    (4.33)
                 cm_le  = -cl/4                                         (4.39)
                 cm_c/4 = 0                                             (4.41)
                 alpha_L=0 = 0                                          (de (4.61))
                 centro de presion = centro aerodinamico = c/4
tolerancia: exacto (analitico)
```

```
FIXTURE anderson-inv-kutta-joukowski [§3.16, p.283, ec. (3.140)]
entradas: cualquier cuerpo 2D con circulacion Gamma
salida esperada: L' = rho_inf * V_inf * Gamma
requisito adicional LITERAL: "the value of Gamma used in Equation (3.140) must be
  evaluated around a closed curve that ENCLOSES the body; the curve can be otherwise
  arbitrary, but it must have the body inside it"
test derivado: la integral de circulacion sobre DOS lazos distintos que encierren el
  cuerpo debe dar el MISMO Gamma; sobre un lazo que NO lo encierre debe dar 0.
tolerancia: 1 % con 4000 puntos de cuadratura
```

### 3.1 Bernoulli, ductos, Pitot, Cp (§3.2–§3.5)

```
FIXTURE anderson-ej-3.1 [§3.2, p.212]
entradas: nivel del mar estandar; V_inf = 50 m/s; rho_inf = 1.23 kg/m^3;
          p_inf = 1.01e5 N/m^2; p (en un punto del perfil) = 0.9e5 N/m^2
salida esperada: V = 142.8 m/s
tolerancia: 1 % (recalculo exacto 142.78 m/s)
```

```
FIXTURE anderson-ej-3.2 [§3.2, p.213]
entradas: rho = 0.002377 slug/ft^3; punto 1: p1 = 2116 lb/ft^2, V1 = 10 ft/s;
          punto 2 (misma linea de corriente): V2 = 190 ft/s
salida esperada: p2 = 2073.2 lb/ft^2 ; caida = 42.8 lb/ft^2 = 2 % de p1
                 mientras la velocidad crece un factor 19 (1900 %)
tolerancia: 0.1 % en p2
NOTA: el libro escribe 2073.2 en el desarrollo y 2073.1 tres lineas despues.
      El valor correcto es 2073.2 (2116 - 42.786).
```

```
FIXTURE anderson-ej-3.3 [§3.3, p.222]
entradas: venturi con A2/A1 = 0.8; rho = 0.002377 slug/ft^3; p1 - p2 = 7 lb/ft^2
ecuacion (3.26): V1 = sqrt( 2*(p1-p2) / (rho*[(A1/A2)^2 - 1]) )
salida esperada: V1 = 102.3 ft/s
tolerancia: 1 %
```

```
FIXTURE anderson-ej-3.4 [§3.3, pp.222-223]
entradas: tunel subsonico, contraccion 12:1 (A2/A1 = 1/12); V2 = 50 m/s;
          rho_aire = 1.23 kg/m^3; manometro de mercurio rho_Hg = 1.36e4 kg/m^3; g = 9.8
salida esperada: p1 - p2 = 1527 N/m^2 ; w = 1.33e5 (N/m^3) ; h = 0.01148 m
tolerancia: 1 %
TRAMPA DE UNIDADES declarada por el libro: la rho del manometro es la del LIQUIDO;
  la rho de (3.32) es la del AIRE. Dos densidades distintas (1.36e4 vs 1.23) en la
  misma cadena. El libro imprime las unidades de w como N/m^2; siendo peso por unidad
  de VOLUMEN deben ser N/m^3.
```

```
FIXTURE anderson-ej-3.5 [§3.3, pp.223-224]
entradas: contraccion 12:1; C_L,max del modelo = 1.3; S = 6 ft^2;
          balanza con L_max = 1000 lb; rho_inf = 0.002377 slug/ft^3
salida esperada: V_inf = 328.4 ft/s ; p1 - p2 = 127.3 lb/ft^2
tolerancia: 1 %
```

```
FIXTURE anderson-ej-3.6 [§3.3, pp.224-225]  (dos partes)
entradas comunes: seccion de prueba ventilada, p2 = p_atm = 1.01e5 N/m^2;
          rho = 1.23 kg/m^3; contraccion 10:1; 1 mi/h = 0.447 m/s
(a) V2 = 100 mph = 44.7 m/s  -> p1 - p2 = 0.01217e5 N/m^2 ; p1 = 1.022e5 = 1.01 atm
(b) V2 = 200 mph = 89.4 m/s  -> p1 - p2 = 0.0487e5  N/m^2 ; p1 = 1.059e5 = 1.048 atm
conclusion literal: al duplicar la velocidad, la presion del deposito solo sube
          0.038 atm (3.8 %)
tolerancia: 1 %
```

```
FIXTURE anderson-ej-3.7 [§3.4, p.229]
entradas: nivel del mar; Pitot p0 = 2190 lb/ft^2; p1 = 2116 lb/ft^2;
          rho = 0.002377 slug/ft^3
ecuacion (3.34): V1 = sqrt(2*(p0-p1)/rho)
salida esperada: V1 = 250 ft/s
tolerancia: 1 % (exacto 249.53; el libro redondea)
```

```
FIXTURE anderson-ej-3.8 [§3.4, pp.229-230]
entradas: condiciones del Ej. 3.5 (V_inf = 328.4 ft/s, rho = 0.002377,
          p_inf = 2116 lb/ft^2, contraccion 12:1)
salida esperada: q_inf = 128.2 lb/ft^2 ; p0 = 2244 lb/ft^2 ; V1 (camara) = 27.3 ft/s
tolerancia: 0.5 %
observacion del libro: q_inf (128.2) es < 1 % mayor que p1-p2 (127.3) del Ej.3.5
  "Because the velocity in the settling chamber V1 is so small that p1 is close to
  the total pressure of the flow."
```

```
FIXTURE anderson-ej-3.9 [§3.4, p.230]
entradas: altitud estandar 4 km; Pitot p0 = 6.7e4 N/m^2;
          Apendice D a 4 km: p_inf = 6.166e4 N/m^2, rho = 0.81935 kg/m^3
salida esperada: V1 = 114.2 m/s = 255 mph
tolerancia: 1 %
```

```
FIXTURE anderson-ej-3.10 [§3.4, pp.230-231]
entradas: V1 = 114.2 m/s a 4 km (rho = 0.81935); rho a nivel del mar = 1.23 kg/m^3
salida esperada: q1 = 5.343e3 N/m^2 ; velocidad equivalente Ve = 93.2 m/s
tolerancia: 0.5 %
definicion literal: "Consider an airplane flying at some true airspeed at some
  altitude. Its EQUIVALENT AIRSPEED at this condition is defined as the velocity at
  which it would have to fly at standard sea level to experience the same dynamic
  pressure."
```

```
FIXTURE anderson-ej-3.11 [§3.5, p.236]
entradas: V_inf = 150 ft/s ; V (en un punto) = 225 ft/s
salida esperada: Cp = 1 - (225/150)^2 = -1.25
tolerancia: exacto
```

```
FIXTURE anderson-ej-3.12 [§3.5, pp.236-237]   ** FIXTURE DE GATE, NO DE VALOR **
entradas: pico Cp = -5.3 sobre el extrados; V = sqrt(V_inf^2 * (1 - Cp))
(a) V_inf = 80 ft/s   -> V = 200.8 ft/s   [VALIDO]
(b) V_inf = 300 ft/s  -> V = 753 ft/s     [LA FORMULA DA ESTO, PERO ES INVALIDO]
gate de validez impuesto por el propio libro:
   a_SL = 1117 ft/s ; M_inf = 300/1117 = 0.269  -> pasa M < 0.3
   M_local > 753/1117 = 0.674                   -> NO pasa
   veredicto literal: "the answer given in part (b) of Example 3.12 is NOT CORRECT."
tolerancia: 1 % en el valor; el test DEBE ademas exigir que el solver levante
   bandera de compresibilidad en el caso (b). Es el test de honestidad del motor.
```

### 3.2 Cilindro (§3.13–§3.15)

```
FIXTURE anderson-ej-3.13 [§3.13, p.260]
entradas: cilindro sin sustentacion; buscar donde p = p_inf (Cp = 0)
ecuacion (3.101): 0 = 1 - 4*sin(theta)^2  ->  sin(theta) = +-1/2
salida esperada: theta = 30, 150, 210, 330 grados
                 en el estancamiento p = p_inf + q_inf
                 en el tope/fondo    p = p_inf - 3*q_inf   (Cp = -3)
tolerancia: exacto
```

```
FIXTURE anderson-ej-3.14 [§3.13, pp.261-264]
entradas: cilindro sin sustentacion; R = 1 m; V_inf = 50 m/s
derivacion: dV_theta/dt = (2*V_inf^2/R) * sin(2*theta)                    (E3.6)
salida esperada: extremos de aceleracion en theta = 45, 135, 225, 315 grados
                 valores: +2V^2/R, -2V^2/R, +2V^2/R, -2V^2/R              (E3.9)
                 |a|_max = 2*(50)^2/1 = 5000 m/s^2 = 510.2 g   (g = 9.8 m/s^2)
                 theta=135 y 225 -> aceleracion maxima; theta=45 y 315 -> deceleracion
tolerancia: 0.5 %
```

```
FIXTURE anderson-ej-3.15 [§3.14, p.268]
entradas: vortice; r = 20 ft; V_theta = 100 mi/h  (88 ft/s = 60 mi/h)
salida esperada: |Gamma| = 2*pi*r*V_theta = 2*pi*(20)*(100)*(88/60) = 1.843e4 ft^2/s
tolerancia: 1 %
```

```
FIXTURE anderson-ej-3.16 [§3.15, p.278]
entradas: cilindro con sustentacion; cl = 5
cadena: Gamma/(R*V_inf) = cl = 5 ; V_tope = -2*V_inf - Gamma/(2*pi*R) = -2.796*V_inf
salida esperada: Cp_pico = 1 - (2.796)^2 = -6.82
tolerancia: 1 %
LECCION LITERAL: "for the case of lifting flow, the distribution of Cp over the
  surface is a function of ONE ADDITIONAL PARAMETER - namely, the lift coefficient
  [...] the value of Cp at any point on the surface follows directly from the value
  of lift coefficient." (p.279)
```

```
FIXTURE anderson-ej-3.17 [§3.15, pp.279-280]  ** el que fija el signo de (3.126) **
entradas: mismas del Ej. 3.16 (Gamma/(R*V_inf) = 5)
Cp de superficie desarrollado por el libro:
   Cp = 0.367 - 3.183*sin(theta) - 4*sin(theta)^2
   (verificacion: 1 - (5/(2*pi))^2 = 0.367 ; -2*5/pi = -3.183)
salidas esperadas:
   estancamientos: theta = arcsin(-5/(4*pi)) -> 203.4 y 336.6 grados
   Cp = 0 en: theta = 243.8, 296.23, 5.85, 174.1 grados
   Cp(theta = 90)  = -6.82   (coincide con el Ej. 3.16 -> auto-chequeo del libro)
   Cp(theta = 270) = -0.45   ->  p = p_inf - 0.45*q_inf  (minimo LOCAL en el fondo)
tolerancia: 0.5 % ; los angulos a +-0.2 grados
```

```
FIXTURE anderson-ej-3.18 [§3.15, pp.281-282]
entradas: cilindro con sustentacion; d = 0.5 m (R = 0.25 m); V_inf = 25 m/s;
          V_max en la superficie = 75 m/s; altitud estandar 3 km -> rho = 0.90926 kg/m^3
cadena: Gamma = -2*pi*R*(V_theta + 2*V_inf) con V_theta = -75 m/s
salida esperada: Gamma = 39.27 m^2/s  (= 422.5 ft^2/s)
                 L' = rho*V_inf*Gamma = (0.90926)(25)(39.27) = 892.7 N/m
tolerancia: 0.5 %
```

### 3.3 EL MÉTODO DE PANELES DE FUENTES — Ejemplo 3.19 (§3.17, pp. 290–293) ★

Es **el fixture más valioso de todo el bloque**: valida la geometría, la integral cerrada, el
armado de la matriz, la solución y el chequeo de masa, todo con números impresos.

```
FIXTURE anderson-ej-3.19-Iij [§3.17, pp.292, ec. (3.163)]
entradas: cilindro de RADIO UNITARIO discretizado en 8 paneles IGUALES (Figura 3.41);
          V_inf en direccion +x (alpha = 0)
  panel i = 4 (punto de control): x_i = 0.6533 ; y_i = 0.6533 ; Theta_i = 315 grados
  panel j = 2 (integracion):      X_j = -0.9239 ; X_{j+1} = -0.3827
                                  Y_j =  0.3827 ; Y_{j+1} =  0.9239 ; Theta_j = 45 grados
coeficientes intermedios esperados (todos deben reproducirse):
  A = -1.3065 ; B = 2.5607 ; C = -1 ; D = 1.3065 ; S_j = 0.7654 ; E = 0.9239
salida esperada: I_4,2 = 0.4018
otras integrales de la fila 4:
  I_4,1 = 0.4074 ; I_4,3 = 0.3528 ; I_4,5 = 0.3528
  I_4,6 = 0.4018 ; I_4,7 = 0.4074 ; I_4,8 = 0.4084
tolerancia: 0.5 % (el libro imprime 4 cifras)
NOTA: el propio libro subraya que (3.163) "is a general expression for two arbitrarily
  oriented panels; it is NOT restricted to the case of a circular cylinder."
```

```
FIXTURE anderson-ej-3.19-fila4 [§3.17, p.293, ec. (3.164)]
entradas: las I_4,j de arriba; beta_i = 45 grados para el panel 4
ecuacion (3.153) multiplicada por 2 y con los I ya sustituidos:
  0.4074*l1 + 0.4018*l2 + 0.3528*l3 + pi*l4 + 0.3528*l5
      + 0.4018*l6 + 0.4074*l7 + 0.4084*l8 = -0.7071 * 2*pi*V_inf
salida esperada: esa es EXACTAMENTE la fila 4 de la matriz 8x8 que debe armar el codigo
tolerancia: coeficientes a 4 cifras; el termino independiente a 0.5 %
OJO: el coeficiente de la DIAGONAL es pi (= 2*pi * 1/2), consistente con
  "when j = i, the contribution to the derivative is simply lambda_i/2"
```

```
FIXTURE anderson-ej-3.19-solucion [§3.17, p.293]
entradas: sistema 8x8 completo (ec. 3.153 aplicada en i = 1..8)
salida esperada (intensidades adimensionalizadas):
  lambda_1/(2*pi*V_inf) =  0.3765
  lambda_2/(2*pi*V_inf) =  0.2662
  lambda_3/(2*pi*V_inf) =  0
  lambda_4/(2*pi*V_inf) = -0.2662
  lambda_5/(2*pi*V_inf) = -0.3765
  lambda_6/(2*pi*V_inf) = -0.2662
  lambda_7/(2*pi*V_inf) =  0
  lambda_8/(2*pi*V_inf) =  0.2662
tolerancia: 1 %
CHEQUEOS QUE EL LIBRO EXIGE:
  1. simetria: "Note the symmetrical distribution of the lambda's, which is to be
     expected for the nonlifting circular cylinder."
  2. conservacion de masa (3.157): como todos los paneles miden lo mismo, se reduce a
     sum(lambda_j) = 0, y "the equation is identically satisfied."
```

```
FIXTURE anderson-ej-3.19-cp [§3.17, p.293, ecs. (3.156), (3.165), (3.38)]
entradas: las lambda_j de arriba; integral tangencial cerrada (3.165)
salida esperada: Cp_1 .. Cp_8 comparables con Cp = 1 - 4*sin(theta)^2 (Figura 3.43)
veredicto literal del libro: "Amazingly enough, in spite of the relatively crude
  paneling shown in Figure 3.41, the numerical pressure coefficient results are
  EXCELLENT."
tolerancia: [LECTURA DE FIGURA] los valores individuales de Cp_i NO estan impresos.
  Test practico: exigir |Cp_i(panel) - Cp_exacto(theta_i)| < 0.05 con 8 paneles y
  < 1e-3 con 64 paneles.
```

### 3.4 El cilindro REAL (§3.18) y los Integrated Work Challenge

```
FIXTURE anderson-§3.18-a [§3.18, p.300]   (diametro para Re = 1)
entradas: V_inf = 30 m/s; nivel del mar: rho = 1.23 kg/m^3, mu = 1.79e-5 kg/(m*s)
salida esperada (LITERAL): d = 4e-7 m
tolerancia: 20 % -- el cociente exacto es 4.85e-7 m; el libro redondea a "4 x 10^-7".
            Usa 4.85e-7 si tu test es estricto y marca el 4e-7 como redondeo del autor.
comparacion citada: camino libre medio a nivel del mar = 6.6e-8 m
```

```
FIXTURE anderson-§3.18-b [§3.18, pp.300-301]   (alambres del SPAD XIII)
entradas: d = 3/32 in = 0.0024 m; V_inf = 130 mi/h = 57.8 m/s;
          rho = 1.23 kg/m^3, mu = 1.79e-5 kg/(m*s)
salida esperada: Re = 9532 ; C_D = 1  [LECTURA DE FIGURA 3.44]
tolerancia: Re +-0.5 % ; C_D +-0.1
```

```
FIXTURE anderson-§3.18-c [§3.18, pp.301-302]   (huracan Hugo vs. pino)
entradas: cilindro L = 60 ft, d = 5 ft; V = 175 mi/h = 256.7 ft/s;
          rho = 0.002377 slug/ft^3 ; mu = 3.7373e-7 slug/(ft*s)
salida esperada: Re = 8.16e6 ; C_D = 0.7 [LECTURA DE FIGURA 3.44]
                 D = 0.5*rho*V^2*(d*L)*C_D = 16,446 lb
tolerancia: 1 %
supuestos declarados por el autor: se desprecian efectos de punta del cilindro y no se
  corrige la densidad por la caida barometrica dentro del huracan
```

```
FIXTURE anderson-iwc-3.22 [§3.22, pp.311-314]   (drag <-> perdida de presion total)
planteamiento: relacionar el arrastre sobre un cuerpo con la perdida de presion TOTAL
  en el campo (volumen de control de la Figura 2.20a)
salida esperada: IL = (1/2) * D'                                          (C3.8)
  literal: "this integrated loss of total pressure is equal to ONE-HALF of the
  aerodynamic drag per unit span exerted on the body"
tolerancia: exacto (identidad algebraica)
ERRATAS del texto: (C3.3) impresa con u1^2 donde va u2^2; "(3.4)" donde va "(C3.4)"
```

```
FIXTURE anderson-iwc-3.23 [§3.23, pp.314-318]   (diseno conceptual de tunel subsonico)
entradas: V_test max = 120 m/s; envergadura del modelo 2 m; Re (dir. de flujo) = 25e6;
          circuito cerrado; nivel del mar: T = 288.16 K, rho = 1.225 kg/m^3,
          mu = 1.7894e-5 kg/(m*s)
reglas de diseno CITADAS (Barlow, Rae & Pope, 3a ed., 1999):
  - "the maximum wing span of a model be LESS THAN 0.8 of the tunnel width in order to
     minimize the effects of the tunnel walls"  (el autor elige 0.7)
  - "for testing airplane models, a rectangular test section with a width-to-height
     ratio of about 1.5 will minimize the wall correction factor"
cadena: width = 2/0.7 = 2.86 -> 3 m ; height = 3/1.5 = 2 m
        L = mu*Re/(rho*V) = 3.046 m -> se elige 3.2 m
        Pt = 0.5*rho*A*V^3 = 0.5*(1.23)*(2*3)*(120)^3 = 6.376e6 W
        energy ratio ER = 8.3 (Univ. of Washington 8x12 ft, el mas alto de la tabla)
        Pc = Pt/ER = 7.682e5 W = 1030 hp   (746 W = 1 hp)
salida esperada: seccion de prueba 2 m x 3 m x 3.2 m ; 120 m/s ; motor 1030 hp
tolerancia: L +-1 % ; potencia +-1 %
supuesto declarado: 100 % de eficiencia de motor y ventilador
ERRATAS del texto: imprime "Pc = 7.682 x 10^6 W" donde va 10^5; cita (C3.9) donde va
  (C3.12); usa rho = 1.23 aunque la especificacion fija 1.225
```

### 3.5 Perfiles: datos experimentales y teoría (§4.3, §4.6–§4.9)

```
FIXTURE anderson-ref-4.3 [§4.3, pp.330-331]   ** constantes del NACA 2412 **
De la Figura 4.10 (datos de Abbott & von Doenhoff, 1949):
   alpha_L=0 = -2.1 grados
   cl_max    ~ 1.6
   desplome  en alpha ~ 16 grados
De la Figura 4.11:
   cm_ac = -0.05  (constante en un rango amplio de alpha; pitch-down)
   cd(alpha=0, Re=3.1e6) = 0.0065
   cd(alpha=4, Re=3.1e6) = 0.0068 (Ej.4.1) / 0.0070 (Ej.4.3)  <- el libro reporta AMBOS
tolerancia: [LECTURA DE FIGURA] usa banda [0.0065, 0.0072] para cd a alpha = 4
```

```
FIXTURE anderson-ej-4.1 [§4.3, pp.331-332]
entradas: NACA 2412; c = 0.64 m; nivel del mar; V_inf = 70 m/s;
          L' = 1254 N/m; rho = 1.23 kg/m^3; mu = 1.789e-5 kg/(m*s)
salida esperada: q_inf = 3013.5 N/m^2 ; cl = 0.65 ; alpha = 4 grados [FIGURA 4.10]
                 Re = 3.08e6 ; cd = 0.0068 [FIGURA 4.11] ; D' = 13.1 N/m
tolerancia: q_inf/cl/Re/D' a 3 cifras; alpha +-0.5 grados; cd +-0.0005
```

```
FIXTURE anderson-ej-4.2 [§4.3, p.332]
entradas: condiciones del Ej. 4.1; cm_ac = -0.05
salida esperada: M'_ac = q_inf * c * c * cm_ac = (3013.5)(0.64)(0.64)(-0.05) = -61.7 N*m
tolerancia: +-0.1 N*m
signo: negativo = momento de PICADA, tiende a reducir el angulo de ataque
```

```
FIXTURE anderson-ej-4.3 [§4.3, pp.332-333]   ** la polar L/D del NACA 2412 **
entradas: NACA 2412, Re = 3.1e6
  alpha[deg]   cl     cd       cl/cd
      0       0.25   0.0065     38.5
      4       0.65   0.0070     93
      8       1.08   0.0112     96
     12       1.44   0.017      85
tolerancia: [LECTURA DE FIGURA] cl +-0.02 ; cd +-0.0005 ; cociente +-3
conclusion literal: "as the angle of attack increases, the lift-to-drag ratio first
  increases, reaches a maximum, and then decreases [...] The values of L/D for airfoils
  are quite large numbers in comparison to that for a complete airplane. Due to the
  extra drag associated with all parts of the airplane, values of (L/D)max for real
  airplanes are on the order of 10 to 20."
```

```
FIXTURE anderson-ej-4.4 [§4.6, pp.345-346]   (vortice de arranque)
entradas: condiciones del Ej. 4.1: L' = 1254 N/m; V_inf = 70 m/s; rho_inf = 1.23 kg/m^3
salida esperada: Gamma = L'/(rho*V_inf) = 1254/((1.23)(70)) = 14.56 m^2/s
                 intensidad del vortice de arranque = -14.56 m^2/s (igual y opuesta)
tolerancia: 0.5 %
ADVERTENCIA DEL AUTOR sobre su utilidad: "In this author's experience, NO PRACTICAL
  AERODYNAMIC CALCULATION REQUIRES THE STRENGTH OF A STARTING VORTEX. The starting
  vortex is simply a theoretical construct."
```

```
FIXTURE anderson-ej-4.5 [§4.7, pp.355-356]   (placa plana a 5 grados)
entradas: placa plana delgada; alpha = 5 grados = 5/57.3 = 0.0873 rad
salida esperada: cl      = 2*pi*(0.0873) = 0.5485
                 cm_le   = -cl/4 = -0.137
                 cm_c/4  = 0
                 cm_te   = (3/4)*cl + cm_c/4 = (3/4)(0.5485) = 0.411
tolerancia: 1 %
supuesto usado explicitamente: cos(alpha) ~ 1, asi que el brazo del c/4 al borde de
  salida se toma como (3/4)c
```

```
FIXTURE anderson-ej-4.6 [§4.8, pp.357-364]   ** EL FIXTURE DE ORO DEL PERFIL DELGADO **
entradas: NACA 23012, linea de curvatura media LITERAL del libro:
  z/c = 2.6595*(x/c)^3 - 0.6075*(x/c)^2 + 0.1147*(x/c)     para 0    <= x/c <= 0.2025
  z/c = 0.02208*(1 - x/c)                                  para 0.2025 <= x/c <= 1.0
derivadas:
  dz/dx = 2.6595*(3*(x/c)^2 - 1.215*(x/c) + 0.1147)        para 0 <= x/c <= 0.2025
  dz/dx = -0.02208                                         para 0.2025 <= x/c <= 1.0
transformadas con x = (c/2)(1 - cos theta):
  dz/dx = 0.6840 - 2.3736*cos(theta) + 1.995*cos(theta)^2  para 0      <= theta <= 0.9335 rad
  dz/dx = -0.02208                                         para 0.9335 <= theta <= pi
salidas esperadas:
  alpha_L=0 = -0.0191 rad = -1.09 grados                   [ec. (4.61)]
  cl (alpha = 4 grados = 0.0698 rad) = 2*pi*(0.0698+0.0191) = 0.559   [ec. (4.60)]
  A1 = 0.0954   ;   A2 = 0.0792                            [ec. (4.51)]
  cm_c/4 = (pi/4)*(A2 - A1) = -0.0127                      [ec. (4.64)]
  x_cp/c = (1/4)*[1 + (pi/0.559)*(0.0954-0.0792)] = 0.273  [ec. (4.66)]
tolerancia: 1 % (0.5 % en alpha_L=0 y cl)
COMPARACION CONTRA EXPERIMENTO que el propio libro tabula [p.363]:
                     calculado    experimento
   alpha_L=0          -1.09 deg    -1.1 deg
   cl (alpha = 4)      0.559        0.55
   cm_c/4             -0.0127      -0.01
  -> exige que la implementacion caiga dentro del 3 % del experimento
```

```
FIXTURE anderson-prob-4.6 [§4.18, Problema 4.6, p.420]  ** LINEA MEDIA DEL NACA 4412 **
La ecuacion LITERAL del libro (fixture de geometria + fixture de teoria en uno):
  z/c = 0.25 * [ 0.8*(x/c) - (x/c)^2 ]                     para 0   <= x/c <= 0.4
  z/c = 0.111 * [ 0.2 + 0.8*(x/c) - (x/c)^2 ]              para 0.4 <= x/c <= 1
tarea (Problema 4.6): calcular alpha_L=0 y cl para alpha = 3 grados con perfil delgado
tarea (Problema 4.7): calcular cm_c/4 y x_cp/c para alpha = 3 grados
tarea (Problema 4.8): comparar con datos experimentales del NACA 4412 (Referencia 11)
salida esperada: NO IMPRESA en el libro (es problema, no ejemplo).
  El test es de CONSISTENCIA CRUZADA: al derivar z/c y meterla en (4.61) debe salir un
  alpha_L=0 negativo del orden de -3 a -4 grados (el 4412 tiene 4 % de curvatura, el
  doble que el 2412 cuyo alpha_L=0 medido es -2.1 grados, §4.3 p.330).
  Verificar tambien que la linea media es CONTINUA y de derivada continua en x/c = 0.4
  (ambas ramas dan z/c = 0.0400 y dz/dx = 0 ahi) -> test de geometria puro y EXACTO.
```

```
FIXTURE anderson-ej-4.7 [§4.9, pp.367-368]   (centro aerodinamico de datos medidos)
entradas: NACA 23012 experimental (Figura 4.28 / Referencia 11):
          alpha = 4 grados  -> cl = 0.55 , cm_c/4 = -0.005
          alpha = -4 grados -> cm_c/4 = -0.0125
          alpha_L=0 = -1.1 grados
cadena: a0 = (0.55-0)/(4-(-1.1)) = 0.1078 por grado
        m0 = (-0.005-(-0.0125))/(4-(-4)) = 9.375e-4 por grado
        x_ac = -m0/a0 + 0.25                                     [ec. (4.71)]
salida esperada: x_ac = 0.241
tolerancia: 0.5 %
validacion del libro: "The result agrees EXACTLY with the measured value quoted on
  page 183 of Abbott and Von Doenhoff (Reference 11)."
```

```
FIXTURE anderson-prob-4.10 [§4.18, Problema 4.10, p.420]  (centro aerodinamico NACA 2412)
entradas: alpha = -6 grados -> cl = -0.39 , cm_c/4 = -0.045
          alpha = +4 grados -> cl =  0.65 , cm_c/4 = -0.037
tarea: calcular la posicion del centro aerodinamico con (4.71)
salida esperada: NO IMPRESA. Consistencia cruzada:
  a0 = (0.65-(-0.39))/(4-(-6)) = 0.104 por grado
  m0 = (-0.037-(-0.045))/10    = 8.0e-4 por grado
  x_ac = -8.0e-4/0.104 + 0.25  = 0.2423
  -> el valor debe caer muy cerca de 0.25 (y por delante de el, como el 23012)
```

```
FIXTURE anderson-prob-4.2 [§4.18, Problema 4.2, p.419]
entradas: NACA 2412; c = 2 m; V_inf = 50 m/s; nivel del mar (rho = 1.23 kg/m^3);
          L' = 1353 N/m
tarea: hallar alpha
cadena: q_inf = 0.5*(1.23)*(50)^2 = 1537.5 N/m^2 ; cl = 1353/(1537.5*2) = 0.44
        alpha se lee de la Figura 4.10 [LECTURA DE FIGURA]
salida esperada: NO IMPRESA. Con la teoria del perfil delgado y alpha_L=0 = -2.1 deg:
        alpha = cl/(2*pi) + alpha_L=0 = 0.44/0.1097 - 2.1 = 1.9 grados
        -> util como test cruzado teoria-vs-datos
```

```
FIXTURE anderson-prob-4.14 [§4.18, Problema 4.14, p.421]  ** "puede volar de cabeza?" **
entradas: perfil con curvatura positiva; alpha_L=0 = -3 grados; pendiente 0.1 por grado
(a) cl a alpha = 5 grados                  -> cl = 0.1*(5-(-3)) = 0.8
(b) el MISMO perfil INVERTIDO a alpha = 5  -> invertido alpha_L=0 = +3 grados
                                           -> cl = 0.1*(5-3) = 0.2
(c) alpha del perfil invertido para dar el mismo cl = 0.8
                                           -> alpha = 0.8/0.1 + 3 = 11 grados
salida esperada: NO IMPRESA. Los valores de arriba son la aplicacion directa de (4.59).
LECCION: si, vuela de cabeza, pero necesita MAS del doble de angulo de ataque.
  Excelente lamina de escuela.
```

### 3.6 Arrastre viscoso (§4.12)

```
FIXTURE anderson-ej-4.8 [§4.12.1, p.382]   (capa limite LAMINAR)
entradas: NACA 2412 modelado como placa plana; Re_c = 3.1e6 ; c = 1.5 m
salida esperada: delta(TE) = 5.0*c/sqrt(Re_c) = (5.0)(1.5)/sqrt(3.1e6) = 0.00426 m
                 Cf (una cara) = 1.328/sqrt(3.1e6) = 7.54e-4
                 Net Cf = 2*(7.54e-4) = 0.0015
tolerancia: 1 %
contraste que el libro hace de inmediato: el cd MEDIDO del perfil a alpha=0, Re=3.1e6
  es 0.0068, "about 4.5 times higher" -> el calculo laminar NO aplica a ese Re
```

```
FIXTURE anderson-ej-4.9 [§4.12.2, p.383]   (capa limite TURBULENTA)
entradas: mismas del Ej. 4.8
salida esperada: delta(TE) = 0.37*c/Re_c^(1/5) = 0.37*(1.5)/(3.1e6)^0.2 = 0.0279 m
                 Cf (una cara) = 0.074/(3.1e6)^0.2 = 0.00372
                 Net Cf = 0.00744
tolerancia: 1 %
comparacion: la capa turbulenta es 2.79 cm vs 0.426 cm de la laminar; el Cf es
  "a factor of five larger". Y 0.00744 SOBREESTIMA el cd medido total de 0.0068.
```

```
FIXTURE anderson-ej-4.10 [§4.12.3, pp.385-388]   (transicion, Re_cr = 500,000)
entradas: Re_c = 3.1e6 ; Re_x,cr = 5e5
cadena: x1/c = Re_cr/Re_c = 5e5/3.1e6 = 0.1613
        (Cf,1)_lam  = 1.328/sqrt(5e5)   = 0.00188
        (Cf,c)_turb = 0.074/(3.1e6)^0.2 = 0.00372
        (Cf,1)_turb = 0.074/(5e5)^0.2   = 0.00536
        Cf = 0.1613*(0.00188) + 0.00372 - 0.1613*(0.00536) = 0.003158   [ec. (4.93)]
salida esperada: Net Cf = 2*(0.003158) = 0.0063
tolerancia: 1 %
implicacion: con cd medido = 0.0068, el arrastre de presion por separacion seria
  el 7.4 % del total
```

```
FIXTURE anderson-ej-4.11 [§4.12.3, p.388]   (transicion, Re_cr = 1,000,000)
entradas: Re_c = 3.1e6 ; Re_x,cr = 1e6
cadena: x1/c = 1e6/3.1e6 = 0.3226
        (Cf,1)_lam  = 1.328/sqrt(1e6) = 0.001328
        (Cf,c)_turb = 0.00372
        (Cf,1)_turb = 0.074/(1e6)^0.2 = 0.004669
        Cf = 0.3226*(0.001328) + 0.00372 - 0.3226*(0.004669) = 0.002642
salida esperada: Net Cf = 0.00528
tolerancia: 1 %
LECCION CUANTIFICADA: duplicar Re_cr (5e5 -> 1e6) baja el Cf calculado un 16 %.
  "This difference underscores the importance of knowing where transition takes
  place on a surface for the calculation of skin friction drag."
implicacion: el arrastre de presion pasaria a ser el 22 % del total
```

```
FIXTURE anderson-ref-4.12 [§4.12.3, p.389]  (reparto friccion/presion, CFD de referencia)
fuente: Lombardi et al., Referencia 88; NACA 0012, Re_c = 3e6, con modelo de transicion
salida esperada: cd_total = 0.00623 ; cd_friccion = 0.00534
                 -> arrastre de presion por separacion = 15 % del total
regla de dedo del libro: "it is reasonable to expect 80 percent of the drag to be skin
  friction drag and 20 percent to be pressure drag due to flow separation" para un
  cuerpo aerodinamico (streamlined). Para cuerpos romos, la presion DOMINA.
```

```
FIXTURE anderson-ej-transicion [§4.12.3, p.385]  (posicion de la transicion)
entradas: nivel del mar: rho = 1.23 kg/m^3, mu = 1.789e-5 kg/(m*s); Re_x,cr = 5e5
(a) V_inf = 50 m/s  -> x_cr = mu*Re_cr/(rho*V) = 0.145 m
(b) V_inf = 100 m/s -> x_cr = 0.0727 m
tolerancia: 1 %
LECCION: al duplicar la velocidad, el punto de transicion se acerca a la mitad de la
  distancia al borde de ataque
ADVERTENCIA LITERAL: "an accurate value for Re_x,cr applicable to your problem MUST
  COME FROM SOMEWHERE - experiment, free flight, or some semi-empirical theory - and
  this may be difficult to obtain."
```

```
FIXTURE anderson-prob-4.15-16 [§4.18, Problemas 4.15 y 4.16, p.421]  (Spitfire)
entradas: NACA 2213 en la raiz (cuerda 8.33 ft), NACA 2205 en la punta;
          cd de perfil MEDIDO del NACA 2213 = 0.006 a Re = 9e6;
          crucero a 18,000 ft; suponer que mu varia como la raiz de la temperatura
tareas: (4.15a) velocidad para que Re en la raiz sea 9e6
        (4.15b) Cf suponiendo flujo TOTALMENTE turbulento; comparar con 0.006 y sacar
                el PORCENTAJE del arrastre de perfil que es arrastre de PRESION
        (4.16)  repetir suponiendo transicion con Re_cr = 1e6
salida esperada: NO IMPRESA. Consistencia: con (4.88), Cf(una cara) = 0.074/(9e6)^0.2
        = 0.00300 -> Net Cf = 0.00600, es decir practicamente TODO el cd medido
        -> el ejercicio esta disenado para que el alumno vea que el 100 % turbulento
        sobreestima y que hay que meter transicion (Problema 4.16)
```

---

## 4. DECISIONES HUMANAS — dónde juzga el ingeniero y el software NO debe decidir

| # | § / p. | La decisión | Por qué el software no puede tomarla |
|---|---|---|---|
| D1 | §3.1, p.205 (Preview) | **Si la aproximación no-viscosa/incompresible aplica al caso.** *"in real life there is always friction […] so in nature there is, strictly speaking, no inviscid flow. […] every flow is compressible to some greater or lesser degree"* | El libro solo da una referencia: *"at air velocities between 0 and 300 mi/h the air density remains essentially constant, varying by only a few percent"* [p.206]. Es criterio, no umbral. |
| D2 | §3.5, p.237 | **El gate de compresibilidad `M_local < 0.3`** | El software **sí puede** calcular `M_local` a partir de `Cp_min`, pero la decisión de seguir adelante con un resultado marginal es del ingeniero. El caso del Ejemplo 3.12 muestra que el `M_inf` engaña. |
| D3 | §3.3, p.213 | **Si la variación de área es "moderada"** para justificar quasi-1D | *"in many applications, the variation of area A = A(x) is **moderate**, and for such cases it is **reasonable** to assume…"* — no hay umbral numérico, y *"the results are **sufficiently accurate** for many aerodynamic applications"*. |
| D4 | §3.3, p.220 | **Qué fenómeno despreciado importa en tu caso** | *"Such equations can sometimes lead to misleading results **when the neglected phenomena are in reality important**."* El libro no lista cuáles ni cuándo. |
| D5 | §3.17, p.289 / §4.10, p.373 | **Cuántos paneles y cómo distribuirlos** | *"it is desirable to cover the leading-edge region with a number of small panels […] and to use larger panels over the relatively flat portions"*, y *"the results for a given body are **sensitive to the number of panels used, their various sizes, and the way they are distributed**"*. El software propone un default; el juicio de refinamiento es humano. |
| D6 | §4.10, p.373 | **Cuál punto de control se descarta** para cerrar el sistema | *"**Which control point do you ignore? Different choices sometimes yield different numerical answers**"*. El libro no da regla. El software debe exponerlo, no esconderlo. |
| D7 | §4.12.3, p.385 | **El número de Reynolds crítico de transición** | *"an accurate value for Re_x,cr applicable to your problem **must come from somewhere—experiment, free flight, or some semi-empirical theory**—and this may be difficult to obtain."* Y el impacto es del 16 % en `Cf` (Ejs. 4.10 vs 4.11). **El software NO debe elegir un `Re_cr` por defecto en silencio.** |
| D8 | §4.13, p.401 | **Qué figura de mérito optimizar: `L/D` o `cl_max`** | Son objetivos en tensión. El libro las nombra como *"two figures of merit"* sin jerarquizarlas: depende de la misión (crucero vs. despegue/aterrizaje). |
| D9 | §4.9 DESIGN BOX, pp. 368–369 | **Dónde referenciar el sistema de fuerzas y momentos** | El centro aerodinámico *"is not more useful than placing the lift and drag at any other point"* **desde la aerodinámica pura**; solo se vuelve conveniente cuando entras a estabilidad y control. Es decisión de la disciplina que consume el dato. |
| D10 | §3.4 DESIGN BOX, p.234 | **Dónde va la toma de presión estática en el fuselaje** | *"the proper location on the fuselage of a given airplane **must be found experimentally**, and it is different for different airplanes."* |
| D11 | §4.11 DESIGN BOX, p.377 | **Problema directo o problema inverso** | El directo (geometría → presión) es lo que el solver hace. El inverso (presión deseada → geometría) es diseño, es iterativo y es donde el ingeniero pone la intención. |
| D12 | §4.13, p.405 | **Si el resultado del solver es válido en este `alpha`** | El solver siempre devuelve un número. Solo el ingeniero (o un modelo viscoso) sabe si ya se separó. El software debe **advertir**, no decidir. |

---

## 5. COSTO DE CÓMPUTO

| Método | § | Costo | Clase | Por qué |
|---|---|---|---|---|
| Bernoulli, `Cp`, atmósfera, venturi, Pitot | §3.2–§3.5 | ns | **[NAVEGADOR]** | Aritmética escalar. |
| Flujos elementales (`phi`, `psi`, `V`) en un punto | §3.9–§3.14 | ns | **[NAVEGADOR]** | Fórmula cerrada. |
| Campo completo de líneas de corriente (superposición, RK4) | §3.11–§3.15 | ~1–20 ms por 100 líneas × 500 pasos | **[NAVEGADOR]** | Ya está corriendo en `potencial.ts` en tiempo real. |
| Cilindro analítico (`Cp = 1 − 4sin²θ`, `cl = Γ/RV`) | §3.13, §3.15 | ns | **[NAVEGADOR]** | Cerrado. |
| **Matriz de influencia de paneles `I_ij` / `J_ij`** | §3.17, §4.10 | `O(n²)` evaluaciones de (3.163): con `n = 200` son 40,000 llamadas ≈ **1–3 ms** | **[NAVEGADOR]** | Es la parte cara y **se calcula UNA vez por geometría**. Literal: *"depend simply on the panel geometry; they are not properties of the flow."* |
| **Resolver el sistema `n×n`** (LU denso) | §3.17, §4.10 | `O(n³)/3`: `n = 200` → ~2.7 M flops ≈ **2–5 ms**; `n = 400` → ~20 ms | **[NAVEGADOR]** | Trivial en JS moderno. No hace falta GPU ni WASM para `n ≤ 400`. |
| **Barrido de `alpha` (la polar completa)** | §3.17, §4.10 | **Una retro-sustitución `O(n²)` por ángulo**, ~0.1 ms cada uno | **[NAVEGADOR]** | Factorizas la matriz una vez y resuelves 40 ángulos en **< 5 ms**. Esta es la razón por la que la polar es interactiva. |
| **Convergencia de malla** (`n` y `2n`) | §4.10 | 2× lo anterior | **[NAVEGADOR]** | Gate de calidad automático, no le cuesta nada al usuario. |
| Teoría del perfil delgado (`A0`, `An` por cuadratura) | §4.7–§4.8 | `O(N_theta · N_modos)` con `N_theta ≈ 200`, `N_modos ≤ 4` ≈ **< 1 ms** | **[NAVEGADOR]** | Cerrado salvo dos integrales 1D. Es la vía **instantánea** para el modo "trade study" de Raymer. |
| `x_ac` de datos medidos (4.71) | §4.9 | ns | **[NAVEGADOR]** | Dos restas y una división. |
| Estimación de arrastre viscoso (4.86–4.93) | §4.12 | ns | **[NAVEGADOR]** | Correlaciones algebraicas. |
| **Catálogo de perfiles precalculado** (polares de la familia NACA 4/5 dígitos × `alpha` × `Re`) | §4.2, §4.10, §4.12 | Miles de resoluciones de paneles + correlaciones | **[PRECÓMPUTO]** | Se hornea una vez en iangpu y se sirve como tabla JSON. Da autocompletado y comparación instantánea en el CAD. Raymer trabaja **eligiendo de catálogo**, no resolviendo. |
| **Curva `C_D` vs `Re` del cilindro y datos experimentales `cl_max(t/c, Re)`** | §3.18, §4.13 | — | **[PRECÓMPUTO]** (tabla) | **No son calculables** con este motor. Son datos empíricos (Figs. 3.44 y 4.53). Van como tabla, citada y con su fuente. |
| Paneles de **segundo orden** (`gamma` lineal) | §4.10 | Mismo orden `O(n³)`, matriz un poco más densa | **[NAVEGADOR]** | Sigue siendo interactivo. |
| Paneles con **paredes del túnel** (modelo + paredes) | §4.17 | `n` sube 3–5× → `n³` sube 30–100× → **0.1–2 s** | **[NAVEGADOR]** (al límite) o **[PRECÓMPUTO]** | El propio libro advierte: *"The use of computational fluid dynamics, such as panel methods, for wind tunnel wall corrections can be **expensive and time consuming**, so the many empirical methods developed over the years are still in vogue."* |
| Navier-Stokes / CFD viscoso (separación, `cl_max`, `cd` real) | §4.12–§4.13 | horas | **[GPU-VIVO]** — **y fuera del alcance de estos capítulos** | El libro lo delega a los caps. 15–20 y a la Ref. 88. Aquí solo se usan sus **resultados** como fixtures. |

**Conclusión de arquitectura:** **todo el motor del cap. 3–4 cabe en el navegador.** La RTX 4070 Ti
no hace falta para resolver; sirve para **hornear el catálogo** de perfiles y para renderizar. Esto
es exactamente lo que el cliente pidió en su queja sobre los CAD de producción: velocidad de
iteración en diseño conceptual.

---

## 6. ESCUELA — lecciones que salen de este bloque

Formato: **construir → mover → ver → verificar contra el número del libro.** Todas viven dentro de
`forja-brep.html`: el alumno **dibuja la geometría con croquis y cotas** y la analiza con un
estudio; no hay simulador de juguete aparte.

### L1 — "El cilindro que no tiene arrastre" (§3.13, §3.18)
- **Construye:** un círculo acotado en el croquis (cota de diámetro). Un estudio "flujo potencial 2D".
- **Mueve:** el diámetro y la velocidad de la corriente.
- **Ve:** las líneas de corriente cerrando **perfectamente simétricas** detrás del cuerpo, y la
  gráfica de `Cp(theta)` idéntica adelante y atrás.
- **Verifica:** `Cp(90°) = −3.0`, `Cp(0°) = +1.0`, `Cp = 0` en 30°/150°/210°/330°
  (`anderson-ej-3.13`); `cd = 0` exacto.
- **El golpe:** superponer la curva **experimental** de la Fig. 3.49. Adelante coinciden; atrás la
  real se queda plana y por debajo de `p_inf`. *"There is a net imbalance […] and this imbalance
  produces the drag on the cylinder."* Ahí se explica d'Alembert **viéndolo**, no contándolo.

### L2 — "La circulación que la naturaleza elige" (§3.15, §4.5, §4.6)
- **Construye:** el mismo cilindro, ahora con un vórtice superpuesto.
- **Mueve:** un deslizador de `Gamma` (**libre**, como dice el libro).
- **Ve:** los puntos de estancamiento migrando por la mitad inferior, fundiéndose en uno solo, y
  finalmente **despegándose de la superficie** — los tres regímenes de la Fig. 3.33.
- **Verifica:** el umbral `Gamma/(4·pi·V_inf·R) = 1` exacto; y con `cl = 5`, `Cp_pico = −6.82`
  y estancamientos en 203.4°/336.6° (`anderson-ej-3.16`, `anderson-ej-3.17`).
- **La pregunta que abre la siguiente lección:** *"There is no single value of Gamma that 'solves'
  the flow […] there are an infinite number of possible potential flow solutions."* ¿Cuál es la
  buena? → L3.

### L3 — "Kutta: la física cerrando lo que la matemática dejó abierto" (§4.5, §4.6)
- **Construye:** un perfil (empieza con placa plana) a `alpha` fijo.
- **Mueve:** `Gamma` a mano, otra vez libre.
- **Ve:** con `Gamma` de menos, el flujo **doblando el borde de salida** con velocidad que dispara;
  con `Gamma` de más, un punto de estancamiento sobre el extradós. Solo hay **un** valor con salida
  limpia.
- **Verifica:** el valor que deja `gamma(TE) = 0` es el mismo que da `cl = 2·pi·alpha`.
  Con la placa a 5°: `cl = 0.5485` (`anderson-ej-4.5`).
- **El cierre honesto (§4.5.1):** *"**Nature enforces the Kutta condition by means of friction.** If
  there were no boundary layer […] there would be no physical mechanism in the real world to
  achieve the Kutta condition."* Y la ironía: **sin fricción no habría sustentación**, aunque la
  sustentación sea un fenómeno de presión.
- **Animación acompañante:** el vórtice de arranque (§4.6) desprendiéndose y el lazo de
  realimentación hasta el estado estacionario. Con `anderson-ej-4.4`: `Gamma = 14.56 m²/s`,
  vórtice de arranque `= −14.56 m²/s`.

### L4 — "Construye el método de paneles con tus manos" (§3.17) ★ la lección insignia
- **Construye:** el cilindro **con 8 paneles**, exactamente como la Fig. 3.41.
- **Mueve:** el número de paneles: 4 → 8 → 16 → 64.
- **Ve:** la tabla de `I_ij` de la fila 4 llenándose; la matriz 8×8; el vector `lambda`; y `Cp`
  del panel acercándose a la curva analítica.
- **Verifica, en tres niveles:**
  1. `I_4,2 = 0.4018`, y `A = −1.3065`, `B = 2.5607`, `C = −1`, `D = 1.3065`, `S_j = 0.7654`,
     `E = 0.9239` (`anderson-ej-3.19-Iij`).
  2. `lambda_1/(2·pi·V_inf) = 0.3765`, `lambda_3 = 0`, `lambda_5 = −0.3765` y la **simetría**
     (`anderson-ej-3.19-solucion`).
  3. `sum(lambda_j·S_j) = 0` — el **invariante de masa** (`anderson-inv-masa-cero`).
- **El punto pedagógico:** con **8 paneles** ya sale bien. El alumno ve que un método "numérico"
  no es una caja negra: son 8 números que salen de resolver 8 ecuaciones que él mismo armó.

### L5 — "Perfil delgado a mano: de la forma al coeficiente" (§4.7, §4.8)
- **Construye:** la línea de curvatura media del **NACA 23012** con su ecuación literal, o la del
  **NACA 4412** (Problema 4.6). Dibujada con croquis y acotada.
- **Mueve:** `alpha`, y la curvatura (arrastrando la línea media).
- **Ve:** la curva `cl` vs `alpha` **trasladándose horizontalmente** al cambiar la curvatura, con
  la **pendiente intacta**. Eso es (4.58) y (4.60) hechos imagen.
- **Verifica:** NACA 23012 → `alpha_L=0 = −1.09°` (medido −1.1°), `cl(4°) = 0.559` (medido 0.55),
  `A1 = 0.0954`, `A2 = 0.0792`, `cm_c/4 = −0.0127` (medido −0.01), `x_cp/c = 0.273`
  (`anderson-ej-4.6`).
- **Extensión:** el flap de borde de salida es **solo más curvatura** → `alpha_L=0` más negativa
  (§4.13, p.402). La lección predice el efecto del flap **con la misma fórmula**.

### L6 — "El centro de presión se escapa; el centro aerodinámico no" (§4.8, §4.9)
- **Construye:** perfil con curvatura, sistema de fuerzas dibujado.
- **Mueve:** `alpha` hasta acercarse a sustentación nula.
- **Ve:** el centro de presión **corriéndose hacia atrás y saliéndose del perfil**
  (`x_cp → infinito` cuando `cl → 0`, ec. 4.66), mientras el centro aerodinámico **no se mueve**.
- **Verifica:** `x_ac = −m0/a0 + 0.25 = 0.241` para el NACA 23012 con datos medidos
  (`anderson-ej-4.7`), *"agrees exactly with the measured value"* de la Ref. 11.
- **Por qué importa:** enlaza con el bloque de estabilidad y control de Raymer.

### L7 — "Dónde deja de ver el motor: el desplome" (§4.13)
- **Construye:** **NACA 4412** y **NACA 4421** — *misma línea de curvatura media, distinto espesor.*
- **Mueve:** `alpha` de 0° a 25°.
- **Ve:** las dos curvas `cl` **superpuestas en la zona lineal** (misma pendiente, mismo
  `alpha_L=0`) y **separándose brutalmente** cerca del máximo: el 4412 con pico agudo y caída
  precipitada (desplome de borde de ataque), el 4421 doblándose suave (desplome de borde de
  salida). Y la placa plana con `cl_max` mucho menor.
- **Verifica:** que el solver de paneles **acierta la parte lineal de las dos** y **falla igual en
  las dos** por arriba. El error no es del código: es del modelo.
- **La frase que se lleva el alumno** [§4.13, p.397]: *"the major effect of thickness of the
  airfoil is its effect on the value of `cl_max`"* — y `cl_max` **no lo da esta teoría**.

### L8 — "El arrastre que hay que meter a mano" (§4.12)
- **Construye:** el mismo perfil; estudio de arrastre.
- **Mueve:** el número de Reynolds crítico de transición.
- **Ve:** el punto de transición corriéndose sobre la cuerda y `Cf` cambiando.
- **Verifica:** laminar puro `Net Cf = 0.0015`; turbulento puro `0.00744`; con transición a
  `Re_cr = 5×10⁵` → `0.0063`; a `10⁶` → `0.00528` (Ejs. 4.8–4.11). Y el medido total del
  NACA 2412 es `0.0068`.
- **La lección de humildad cuantificada:** cambiar un dato que **nadie te dio** (el `Re_cr`) mueve
  el resultado 16 %. El software **no debe inventarlo**.

### L9 — "El gate de compresibilidad que engaña" (§3.5, Ej. 3.12)
- **Construye:** perfil en túnel de baja velocidad.
- **Mueve:** `V_inf` de 80 a 300 ft/s.
- **Ve:** `M_inf` quedándose cómodo bajo 0.3 **mientras** el `M_local` en el pico de succión pasa
  de 0.674.
- **Verifica:** la fórmula da `V = 753 ft/s` y **el libro dice que ese número es incorrecto**.
- **Lección de producto:** el estudio debe levantar la bandera roja **solo** cuando el gate local
  falla. Es el ejemplo perfecto de que un número correcto puede ser una respuesta falsa.

---

## 7. NO OBSERVADO — figuras, tablas y datos que eran imagen

El `.txt` viene de `pdftotext`: **ninguna curva de figura es legible**. Solo tengo pies de figura
y lo que el texto cita en prosa. Lo declarado abajo **no lo inventé ni lo deduje**.

### 7.1 Figuras cuyo CONTENIDO NUMÉRICO hace falta y no se puede leer

| Figura | p. | Qué contiene | Impacto en el producto |
|---|---|---|---|
| **3.44** | 295 | **`C_D` vs `Re` del cilindro, de `Re = 10⁻¹` a `10⁷`** (fuente: Panton, *Incompressible Flow*, Wiley-Interscience, 1984) | **Alto.** Es dato empírico irremplazable. Del texto rescaté los puntos: `C_D ≈ 1` para `10³<Re<3×10⁵`; caída a `≈0.3` en `Re = 3×10⁵`; recuperación a `≈0.6` en `10⁷`; `C_D = 1` a `Re = 9532`; `C_D = 0.7` a `Re = 8.16×10⁶`. **Con eso NO se reconstruye la curva.** Hay que tabularla de la fuente original. |
| **3.43** | 294 | `Cp` del método de paneles vs. teoría sobre el cilindro | Medio. Los `Cp_i` de los 8 paneles del Ej. 3.19 **no están impresos**; el libro solo dice que son *"excellent"*. Por eso el fixture `anderson-ej-3.19-cp` se formula como cota, no como valores. |
| **3.45a–e** | 296–299 | Los cinco esquemas de régimen del cilindro | Bajo (los describí desde el texto). |
| **3.49** | 300 | **`Cp` teórico vs. experimental subcrítico vs. supercrítico** sobre el cilindro | **Alto para la escuela (L1).** El texto describe la forma pero no da valores. |
| **4.10** | 330 | **`cl` y `cm_c/4` del NACA 2412 vs. `alpha`, dos `Re`** (Abbott & von Doenhoff, 1949) | **Alto.** Del texto solo hay: `alpha_L=0 = −2.1°`, `cl_max ≈ 1.6`, desplome a `alpha ≈ 16°`, y los pares del Ej. 4.3. |
| **4.11** | 331 | **`cd` de perfil y `cm_ac` del NACA 2412 vs. `alpha`, dos `Re`** | **Alto.** Rescatado del texto: `cm_ac = −0.05`; `cd(0°) = 0.0065`; `cd(4°) = 0.0068`/`0.0070`; `cd(8°) = 0.0112`; `cd(12°) = 0.017`. |
| **4.25** | 353 | `cl` y `cm` del **NACA 0012** vs. teoría | Medio. El texto solo afirma la concordancia. |
| **4.28** | 364 | `cl` y `cm` del **NACA 23012** | Bajo: los tres valores clave sí están tabulados en prosa (Ej. 4.6). |
| **4.31a/b** | 368 | **`x_ac` vs. espesor** para NACA 230XX y NACA 64-2XX | Medio. El texto da la **tendencia** (230XX adelante de `c/4` y alejándose; 64-2XX detrás y alejándose) pero **ningún valor**. Los ejes muestran 0.22–0.26 y 0.24–0.28 respectivamente, con espesor 0–24 %. |
| **4.35** | 374 | `Cp` del **NACA 0012 a 9°**, paneles de 2º orden vs. NACA | Medio. Sería el fixture perfecto del solver de vórtices. **No hay números.** |
| **4.37** | 376 | LS(1)-0417 vs. NACA 2412 | Bajo (el texto da +30 % `cl_max`, +50 % `L/D` a `cl = 1.0`). |
| **4.45 / 4.46** | 390–391 | **`Cp` sobre el extradós del NASA LS(1)-0417 a 0° y a 18.4°**, con y sin separación | Medio-alto para L7. Rescatado: `Cp = 1.0` en el estancamiento, mínimo a **~10 % de cuerda**, y `Cp ≈ −9` en el caso no viscoso a 18.4°. |
| **4.48** | 395 | `c_f(x/c)` del NACA 0012 vs. placa plana (Lombardi, Ref. 88) | Bajo. El texto dice *"remarkably close"* y los ejes van 0–0.008. |
| **4.51** | 399 | **`cl` vs `alpha` de NACA 4412 / NACA 4421 / placa plana** en la misma gráfica | **Alto para L7.** Del texto y de las anotaciones de las Figs. 4.49/4.50/4.52 rescaté pares sueltos, pero no las curvas. |
| **4.53** | 400 | **`cl_max` vs. espesor de la serie NACA 63-2XX, con `Re` como parámetro** | **Alto.** El texto da la forma (máximo alrededor del **12 %** de espesor) y la tendencia con `Re`, pero **ningún valor de `cl_max`**. |
| **4.54a / 4.55** | 402–403 | Efecto de flap (±10°) y de slat sobre la curva `cl` | Medio. Rescatado del texto: el slat lleva el desplome del NACA 4412 de **~15° a ~30°**; la configuración completa a 25° da `cl ≈ 4.5`. |
| **3.13b** | 231 | `Cp(x)` a lo largo de una sonda Pitot-estática | Bajo. Del texto: `Cp = 1.0` en la nariz, mínimo `≈ −1.25` justo detrás, `≈ 0` desde ~8d. |
| **3.17** | 234 | `Cp(x/l)` medido sobre un cuerpo fuselado de esbeltez 3 | Bajo. El texto solo dice que hay **dos estaciones con `Cp = 0`**, sin sus `x/l`. |

Los valores de `cl` anotados junto a las fotos de las Figs. 4.49/4.50/4.52 (`Re = 2.1×10⁵`,
`V_inf = 8 m/s`) aparecen en el `.txt` como texto suelto y **no puedo garantizar la asociación
ángulo↔valor**, así que **no los uso como fixture**.

### 7.2 Contenido que el libro NO trae en estos capítulos (buscarlo en otra fuente)

1. **La ecuación algebraica de la forma NACA** (polinomio de espesor `y_t(x)`, parábolas de la
   línea media de 4 y 5 dígitos). El libro remite a la **Ref. 11 (Abbott & von Doenhoff, 1949)**
   para *"coordinates for the shape of NACA airfoils"*. **`nacaProfile()` en `potencial.ts` ya usa
   el polinomio de espesor — está fuera de Anderson y hay que declararlo con su fuente.**
   *Excepción:* sí da la línea media del **NACA 23012** (Ej. 4.6) y del **NACA 4412** (Prob. 4.6).
2. **La forma cerrada de `J_ij`** del método de paneles de vórtices. Anderson da la de `I_ij`
   (3.163) pero **no** la de vórtices; remite a **Refs. 14, 15, 62 y 63 (Katz & Plotkin)**.
3. **Número de Strouhal / frecuencia de desprendimiento** — la palabra "Strouhal" no aparece.
   El desprendimiento se describe solo cualitativamente (*"in a regular fashion"*).
4. **La frase "adverse pressure gradient" no aparece en §3.18**; el mecanismo se difiere al
   cap. 4 (donde sí está, §4.12.4) y a la Parte 4.
5. **La regla explícita minúscula (2D) vs. mayúscula (3D)** de los subíndices se **ejerce** en
   todo el capítulo pero se **enuncia** en §1.5, fuera del rango.
6. **La deducción general de Kutta-Joukowski para sección arbitraria** — *"can be carried out using
   the method of complex variables. **Such mathematics is beyond the scope of this book**"*
   [§3.16, p.283]. **Corolario importante: la transformación de Joukowski `z = zeta + a²/zeta` que
   usa `potencial.ts` NO está en Anderson.**
7. **La solución rigurosa de las ecuaciones integrales (4.23) y (4.42)** — *"A rigorous solution
   […] can be obtained from the mathematical theory of integral equations, which is beyond the
   scope of this book."* El libro **enuncia y verifica** (4.24) y (4.43), no las deriva.
8. **Respuestas numéricas de los Problemas §3.24 y §4.18** — ninguna está impresa.
9. **La cita textual de d'Alembert** sobre su paradoja: difiere al inicio del cap. 15.
10. **La derivación de (3.36)/(3.38) de `cn` y `ca`** a partir de (1.15)/(1.16) — están en §1.5.
11. **Apéndice D (atmósfera estándar)** y **Apéndice E de la Ref. 9** (donde se derivan las
    integrales estándar (4.26) y (4.45)) — fuera del rango.

### 7.3 Corrupciones de `pdftotext` verificadas (para cualquier re-extracción automática)

Estos patrones afectan a cualquier parser que vuelva a leer el `.txt`. Están **confirmados por
aritmética**, no supuestos:

- **`Lambda` (Λ), `Gamma` (Γ) y `Phi` (Φ) mayúsculas se perdieron en todo el archivo.**
  `grep -c "Γ" anderson.txt` → **0**. Aparecen como espacio en blanco en los numeradores. `kappa`
  (κ) sí sobrevivió (~50 ocurrencias). Los signos `√`, `∫` y `∮` también se degradaron.
- (3.100) impresa como `V∞ = −2V∞ sin θ`; debe ser **`V_theta`**.
- Regla de 5 dígitos: `3/2` colapsado a **"32"**.
- (3.29) tercer término impreso con exponente 3 (`V3^3`); debe ser `V3²`.
- (3.16)/(3.19): `rho` renderizada como `p`.
- Fracciones desarmadas: `(1/0.8)²` → `( 0.8 1 2 )`; `753/1117` → `1117 753`.
- Faltan radicales: `V = sqrt(V_inf²(1−Cp))` impreso sin `√`.

### 7.4 Erratas del propio libro (no del extractor)

1. **p.318 (§3.23):** `Pc = 6.376e6/8.3 = 7.682 × 10⁶ W` → el exponente correcto es **10⁵** (la
   línea siguiente ya usa `7.682e5` para sacar los 1030 hp).
2. **p.312 (§3.22):** `p02 = p2 + ½ρu₁²` → debe ser **`u₂²`**.
3. **p.313:** cita "Equation (3.4)" donde va **(C3.4)**; p.318 cita (C3.9) donde va **(C3.12)**.
4. **p.213 (Ej. 3.2):** `2073.2` en el desarrollo y `2073.1` tres líneas después. El correcto es
   **2073.2**.
5. **p.236 (Ej. 3.12):** dice *"the airplane model in Example 3.4"*, pero el modelo con `C_L,max`
   está en el **Ejemplo 3.5**.
6. **p.222 (Ej. 3.4):** unidades de `w` impresas como `N/m²`; siendo peso por unidad de **volumen**
   deben ser **`N/m³`**.
7. **p.316/318 (§3.23):** especifica `rho_inf = 1.225` pero calcula con **1.23**.
8. **p.331 vs. p.333:** `cd` del NACA 2412 a `alpha = 4°`, `Re = 3.1×10⁶` aparece como **0.0068**
   (Ej. 4.1) y **0.0070** (Ej. 4.3). Es imprecisión de lectura de gráfica: usa la banda
   `[0.0065, 0.0072]`.
9. **p.300 (§3.18):** `d = 4×10⁻⁷ m` cuando el cociente exacto da `4.85×10⁻⁷ m`.
10. **p.272/§3.15 (3.126):** el desarrollo impreso lleva `+` en el término cruzado, pero el
    Ejemplo 3.17 evalúa con `−`. **Implementa la del Ejemplo 3.17.** (Ver §2.2.)

---

## 8. LO QUE MÁS ME SORPRENDIÓ

**1. La condición de Kutta no se deduce: se observa en una fotografía.**
Todo el edificio cuantitativo de la aerodinámica 2D —`cl = 2·pi·alpha`, la sustentación de un ala,
el diseño de perfiles— cuelga de que Kutta miró unas fotos de Prandtl en 1902 y decidió que
*"nature adopts that particular value of circulation which results in the flow leaving smoothly at
the trailing edge"*. Una máquina que lee linealmente ve `gamma(TE) = 0` como una línea de código
más. Lo que hay ahí es una **ecuación de cierre empírica** metida dentro de una teoría que por lo
demás es puramente matemática. Sin ella el problema está **subdeterminado y tiene infinitas
soluciones** — y el libro lo dice de frente, dos veces (§3.15 p.272 y §4.5 p.338). Es el ejemplo
más limpio que he visto de física entrando por la puerta de atrás a cerrar un sistema matemático.

**2. La ironía de §4.5.1 es una lección de epistemología, no de aerodinámica.**
*"Without friction we could not have lift."* La sustentación es un fenómeno de **presión** (no
viscoso), pero el mecanismo que la fija —la capa límite adherida hasta el borde de salida— es
**viscoso**. Es decir: el modelo no viscoso acierta la sustentación **gracias a** un efecto que
desprecia, y falla el arrastre **por** el mismo efecto. Una máquina que optimiza "el modelo más
completo" nunca escribiría eso; lo trataría como una inconsistencia a resolver. Es lo contrario:
es el punto donde el libro es más honesto.

**3. Anderson publica los defectos de su propio método.**
En §4.10 (p.373) hay un párrafo completo diciendo que el método de paneles *"can sometimes be
frustrating"*, que es sensible al número/tamaño/distribución de paneles, que **hay que ignorar un
punto de control y no hay regla para decidir cuál**, que *"different choices sometimes yield
different numerical answers"*, y que `gamma` sale con **oscilaciones panel a panel**. Un texto
promocional habría omitido eso. Aquí está la clave: **esos cuatro párrafos son la lista de
requisitos no funcionales del solver**. Todo lo que el libro confiesa, el producto tiene que
exponer al usuario en vez de esconder.

**4. La matriz de influencia no depende del flujo — y eso es todo el modelo de negocio.**
La frase *"the values of the integrals depend simply on the panel geometry; **they are not
properties of the flow**"* aparece dos veces, casi idéntica (§3.17 p.288 y §4.10 p.371). En el
libro parece una observación menor. En el producto es lo que convierte un barrido de polar
completo en **una retro-sustitución por ángulo** — o sea, la diferencia entre "esperar" y
"arrastrar un deslizador". El cliente se quejó de que los CAD de alta gama *"are too good"* para
diseño conceptual; esta línea de 1968 es la razón técnica por la que se le puede dar algo mejor.

**5. El fixture más valioso del libro está escondido dentro de un ejemplo.**
El Ejemplo 3.19 no se anuncia como test suite, pero trae: los seis coeficientes geométricos
(`A = −1.3065`, `B = 2.5607`, `C = −1`, `D = 1.3065`, `S_j = 0.7654`, `E = 0.9239`), la integral
`I_4,2 = 0.4018`, las otras siete de la fila, la fila completa de la matriz, las ocho `lambda`
adimensionalizadas y el invariante de masa. Es una **prueba de aceptación end-to-end publicada en
1984**, con números a cuatro cifras. Nadie la llama así.

**6. `Cp = 1 − 4·sin²(theta)` no depende de nada.**
Ni de la velocidad, ni de la densidad, ni del radio. Solo del ángulo. Es el fixture perfecto:
sin unidades, sin parámetros, sin tolerancia física. Si `panel2d.ts` no reproduce eso, está mal —
punto. Es raro tener un test así de limpio en un dominio físico.

**7. El espesor no cambia la pendiente pero decide el desplome.**
El NACA 4412 y el 4421 tienen **la misma línea de curvatura media** y el doble de espesor uno que
otro. La teoría del perfil delgado dice que deben tener idéntica pendiente e idéntico
`alpha_L=0` — y el experimento lo confirma. Pero uno desploma con un pico agudo y el otro se dobla
suave, y sus `cl_max` no se parecen. Es la separación más nítida que he visto entre "lo que el
modelo ve" y "lo que el modelo no ve", con **evidencia controlada** (una sola variable cambia).
Como diseño experimental es impecable, y como lección de límites de validez es insuperable.

**8. Un cambio del 16 % en el arrastre viene de un dato que nadie te da.**
Ejemplos 4.10 y 4.11: el mismo perfil, el mismo `Re`, las mismas fórmulas — y `Cf` cambia 16 %
solo por mover `Re_cr` de `5×10⁵` a `10⁶`. Y el libro admite: *"We do not know what the critical
Reynolds number is for the experiments on which the data in Figure 4.11 are based."* La
consecuencia de producto es dura: **cualquier `Re_cr` por defecto que el software elija en silencio
es una mentira del 16 %.** Tiene que ser una entrada explícita, con su procedencia.

---

## Apéndice A — Estado de `src/aero/potencial.ts` frente a Anderson caps. 3–4

### A.1 Qué coincide con el libro

| En `potencial.ts` | Anderson | Veredicto |
|---|---|---|
| `cpValue = 1 − (u²+v²)/U²` | (3.38), p.235 | ✅ Exacto. |
| `liftPerSpan = rho·U·Gamma` | (3.140), p.275 — Kutta-Joukowski | ✅ Exacto. |
| `kuttaGamma = 4·pi·U·a·sin(alpha)` con cuerda `c = 4a` | (4.30): `Gamma = pi·alpha·c·V_inf` ⇒ con `c = 4a`: `4·pi·a·alpha·V_inf` | ✅ Coincide a primer orden. `potencial.ts` usa `sin(alpha)` (resultado exacto de Joukowski); Anderson usa `alpha` (linealizado). Convergen para `alpha` pequeño, **que es justo el rango de validez que Anderson declara**. |
| `liftCoefficient = 2·pi·sin(alpha)` | (4.33): `cl = 2·pi·alpha` | ✅ Misma relación, versión no linealizada. **Documentar la diferencia**, no "corregirla". |
| `circulationIntegral()` verificando `∮u·dl` sobre un lazo que **encierra** el cuerpo | §3.16, p.283: *"must be evaluated around a closed curve that encloses the body"* | ✅ Y el test `∮ = −Gamma` es **correcto con la convención de Anderson** (`Gamma ≡ −∮V·ds`, ec. 2.136; `Gamma` positiva ⇒ giro horario, §3.14 p.265). |
| El test *"con `Gamma = 0` la velocidad en el borde de salida explota"* | §4.5, p.338: *"the velocity becomes infinitely large at a sharp corner"* | ✅ Es exactamente el fenómeno que motiva la condición de Kutta. Excelente test. |
| El comentario del bug `iΓ/(2πζ̄)` cazado por `∮u·dl` | §3.16 | ✅ Es la práctica correcta: verificar contra un **invariante físico**, no contra sí mismo. |

### A.2 Qué está FUERA de Anderson caps. 3–4 y hay que declararlo

| Elemento | Situación |
|---|---|
| **La transformación de Joukowski `z = zeta + a²/zeta`** | **NO está en Anderson caps. 3–4.** El libro dice explícitamente que el método de variable compleja *"is beyond the scope of this book"* [§3.16, p.283] y remite a la Referencia 9. El encabezado de `potencial.ts` ya cita Kuethe & Chow — **correcto, mantener y reforzar**. Marcar como `[EXTENSIÓN DECLARADA]`. |
| **`nacaProfile()` — el polinomio de espesor `5t(0.2969√x − 0.1260x − 0.3516x² + 0.2843x³ − 0.1015x⁴)`** | **NO está en Anderson.** El libro remite a la **Ref. 11 (Abbott & von Doenhoff, 1949)** para las coordenadas NACA (§4.2, p.327). Hay que **citar la fuente en el código**. Ver §7.2. |
| **El `gamma` sobrescribible para mostrar el flujo "falso"** | ✅ Bien fundamentado: Anderson §3.15 p.272 dice que **todas** las `Gamma` son soluciones potenciales válidas. Que el cine muestre `Gamma = 0` **no es inventar**: es la otra solución matemática, y el libro la dibuja (Fig. 4.17, izquierda). Mantener, con la cita. |

### A.3 Qué FALTA para llegar al método de paneles

`potencial.ts` resuelve **un** cuerpo (la placa/perfil de Joukowski) por **mapeo conforme**. El
método de paneles resuelve **cualquier** cuerpo por **álgebra lineal**. Son caminos distintos: el
segundo no reutiliza casi nada del primero salvo `cpValue` y `liftPerSpan`.

**Lo que hay que construir, en orden de dependencia:**

1. **`geom2panels(polilínea cerrada) → Panel[]`** — la costura CAD↔solver (R19). Cada panel
   necesita: puntos frontera `(X_j, Y_j)`/`(X_{j+1}, Y_{j+1})`, punto de control (punto medio),
   ángulo `Theta_j` (antihorario desde `+x` hasta el panel), longitud `S_j` y normal exterior
   `n_i` con `beta_i = Theta_i + pi/2`. Orientación consistente (recorrido único) es obligatoria.
2. **`panelKernel(i, j) → { I_ij, T_ij }`** — un solo núcleo geométrico que devuelva las dos
   integrales cerradas (3.163) y (3.165) desde los mismos `A, B, C, D, E, S_j`. **Con el blindaje
   de `|E| → 0`** (§2.4.5, extensión declarada).
3. **`solveLinear(A, b)`** — LU denso con pivoteo parcial, `n ≤ 400`. **No existe hoy en el repo.**
   Guardar la factorización para reusarla en el barrido de `alpha`.
4. **`sourcePanel(panels, V_inf, alpha) → { lambda[], V[], Cp[] }`** — §3.17. Diagonal normal
   `= 1/2`, diagonal tangencial `= 0`. Verificador `sum(lambda_j·S_j) = 0` como aserción dura.
   **Gate: reproducir `anderson-ej-3.19` completo.**
5. **`vortexPanel(panels, V_inf, alpha) → { gamma[], Cp[], Gamma, cl }`** — §4.10. Kutta
   `gamma_i = −gamma_{i−1}`, punto de control descartado **como parámetro explícito**,
   `V_i = gamma_i`, `Cp_i = 1 − (gamma_i/V_inf)²`, `Gamma = sum(gamma_j·s_j)`, `L' = rho·V_inf·Gamma`.
6. **`sourceVortexPanel()`** — la combinación que el libro recomienda (fuentes para espesor,
   vórtices para circulación) porque *"helps to mitigate some of the practical numerical
   problems"* (R16).
7. **`thinAirfoil(dz/dx, alpha) → { A0, An, cl, alpha_L0, cm_c4, x_cp }`** — §4.7–§4.8, por
   cuadratura de (4.50)/(4.51). **Gate: reproducir `anderson-ej-4.6` (NACA 23012) dentro del 1 %.**
8. **`nacaCamberLine(digits)`** — con las dos líneas medias **literales** del libro (23012 y 4412)
   como fixtures exactos, y el resto de la familia citando la Ref. 11.
9. **`aeroCenter(cl_data, cm_data)`** — (4.71). Trivial pero es el enlace con estabilidad.
10. **`profileDrag(Re_c, Re_cr, ...)`** — §4.12, con `Re_cr` como **entrada obligatoria sin valor
    por defecto** (D7).
11. **Gate de compresibilidad local** a partir de `Cp_min` (D2, `anderson-ej-3.12`).
12. **Convergencia de malla automática** (`n` vs `2n`) como parte del reporte del estudio (D5).

**Lo que NO hay que tocar:** el flujo de Joukowski actual es el motor **del cine** y funciona
(9 tests verdes, con un invariante físico real). Que siga siendo la escena; el solver de paneles
es un módulo **nuevo y separado** (`panel2d.ts`), no un refactor de `potencial.ts`.

### A.4 Los tres tests que faltan en `potencial.test.ts` y que el libro exige

```
1. anderson-inv-cilindro-cp     — el cilindro con Cp = 1 − 4·sin²(theta) EXACTO.
                                  Hoy no hay ningún test contra el cilindro, que es
                                  el fixture de oro del capítulo 3.
2. anderson-inv-pendiente-2pi   — barrer alpha y verificar dcl/dalpha = 2·pi por radián
                                  (0.11 por grado) sobre el modelo actual.
3. anderson-ej-3.16 / 3.17      — cilindro con circulación: cl = 5 → Cp_pico = −6.82 y
                                  estancamientos en 203.4°/336.6°. Valida el signo del
                                  vórtice, que ya causó un bug documentado.
```

