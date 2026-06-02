# La Forja — Diseño Generativo de Mecanismos

## hacia un droide barato, diseñado por la máquina

> Documento maestro. Matemática primero. Español mexicano.
> Render en iangpu (RTX 4070 Ti). Cómputo pesado en el clúster propio (RPi/GPU).
> Operador: ian. Misión: barato, accesible, mejor que Fusion, para LATAM.

---

## 0. Resumen ejecutivo (una página)

Hay **dos** diseños generativos y **no son la misma operación**:

- **Generativo-para-cargas** (lo que hace Fusion 360): tienes una pieza que **no se mueve** y repartes material para que sea lo más rígida posible por gramo. La variable es un campo de densidad `ρ(x) ∈ [0,1]`. La cinemática es fija: movilidad `M ≡ 0` por construcción.
- **Generativo-para-mecanismos** (lo que pide el fundador, lo que casi nadie hace): generas el **mecanismo mismo** — cuántos eslabones, qué juntas, qué dimensiones — para que **produzca un movimiento o función deseada**. La variable es un **grafo cinemático** `G` más sus **dimensiones** `d`. La movilidad `M` es **variable de diseño**, no cero.

La tesis del documento: **la topología-opt de cargas es el caso degenerado `M = 0`, geometría fija, del diseño generativo de mecanismos.** Una mata grados de libertad; la otra los diseña. Son ortogonales. Fusion sólo hace el recuadro interior (estructural) sobre una pieza de cinemática **fija**, y **jamás genera el mecanismo**.

El entregable concreto: que La Forja **diseñe generativamente un droide barato real** — un caminante de linkage tipo Jansen/Klann de **1 motor**, imprimible en PLA, útil. La palanca de costo no es el plástico (centavos): son los **actuadores** (servos: caros, pesados, energía). Por eso la meta matemática es **minimizar el número de actuadores `M`** resolviendo la función *en la geometría* en vez de en N motores + control.

La Forja ya tiene casi todas las piezas: la librería `src/lib/parts/` (gear-pair, planetary, escapement, geneva, slider-crank, clock con su matemática), `joints.ts` (cinemática de ensamble + colisión), el FEA real que se cablea (`formulas.ts`: `tet4Element`, `vonMisesStress`, `conjugateGradient`), y el clúster para el cómputo pesado. Falta **cablearlas en un sintetizador**.

---

## 1. La tesis: dos generativas ortogonales

### 1.1 Generativo-para-cargas (estructural, Fusion)

La pieza es un **continuo** de geometría **fija en cinemática** (no se mueve); se reparte material. Dominio fijo `Ω` mallado en `E` elementos, variable = campo de densidad `ρ_e ∈ [0,1]`. Operador físico = **un solo** equilibrio elástico estático `K(ρ)·U = F` (un solve, el `conjugateGradient` ya cableado). El problema es convexo-relajado, continuo y diferenciable:

$$
\min_{\rho}\; c(\rho) = U^\top K(\rho)\,U = F^\top U
\quad\text{s.a.}\quad K(\rho)U = F,\;\; \sum_e \rho_e v_e \le V^*,\;\; 0 \le \rho_e \le 1
$$

con interpolación **SIMP** `E_e(ρ_e) = E_min + ρ_e^p (E_0 − E_min)`, `p ≈ 3`, y `K_e(ρ_e) = (E_e/E_0)·K_e⁰`. La sensibilidad

$$
\frac{\partial c}{\partial \rho_e} = -p\,\rho_e^{\,p-1}(E_0 - E_{\min})\,u_e^\top K_e^0 u_e \;\le\; 0 \quad\text{(siempre)}
$$

es **siempre no-positiva**: el optimizador **sólo añade material donde rigidiza**. Resultado: una **estructura rígida que no se mueve**. La movilidad `M` no es variable — es `0` por construcción (cuerpo único). Objetivo = **máxima rigidez por gramo**.

### 1.2 Generativo-para-mecanismos (síntesis cinemática)

La **cinemática es la variable**. Variable = un **grafo cinemático** `G = (V, E)` discreto (`V` = eslabones/juntas con su tipo R/P, `E` = conexiones) **más** sus **dimensiones** continuas `d` (longitudes, pivotes, fases). Operador físico = la **cinemática de cierre de lazo** `C(θ; G, d) = 0` evaluada sobre **todo el ciclo** del actuador `θ ∈ [0, 2π)` — **no** un solo estado: una **familia** de configuraciones. El problema es **mixto discreto-continuo, NO convexo, con gradiente discontinuo** (defectos de rama/circuito, raíces complejas):

$$
\min_{G\in\mathcal{G},\; d\in\mathbb{R}^q}\; F(G,d) = \mathrm{dist}\big(\Gamma_{\text{gen}}(G,d),\,\Gamma^*\big) + \sum_a \lambda_a\,\text{pen}_a
$$

sujeto a `M(G) = M*` (mínimo), validez de rama `cos φ(θ) ∈ [−1,1] ∀θ`, Grashof, ángulo de transmisión, no-colisión, imprimibilidad. Objetivo = que el **movimiento generado** iguale una **tarea prescrita**, con el **mínimo de actuadores** `M`.

### 1.3 La diferencia formal, en una línea

| | **Cargas (estructural)** | **Mecanismos (cinemático)** |
|---|---|---|
| Variable de diseño | densidad `ρ ∈ [0,1]` (continua) | grafo `G` (discreto) + dimensiones `d` |
| Operador físico | un equilibrio `K U = F` | familia `{C(θ; G, d) = 0}_{θ∈[0,2π)}` |
| Movilidad `M` | `≡ 0` (FIJA, por construcción) | **variable** (restricción/objetivo) |
| Objetivo | `min ‖rigidez⁻¹‖` | `min dist(movimiento, tarea)` |
| Sensibilidad | `∂c/∂ρ ≤ 0` (sólo añade) | de **cualquier signo** (añade y quita) |
| Geometría | fija | **se crea** |
| Naturaleza | convexo-relajado, diferenciable | no-convexo, gradiente discontinuo |

> La estructural **esculpe** un campo de densidad para **anular** movimiento; la cinemática **elige** topología + dimensiones para **crear** un movimiento específico. Por eso *topología-opt de cargas* ⊊ *diseño generativo de mecanismos*: la primera es el **caso degenerado `M = 0`, geometría fija**, de la segunda.

### 1.4 Por qué importa y por qué casi nadie lo hace

- **Importa** porque el movimiento es el producto. Un droide, un brazo, una pata, un gripper: lo que vale es el **movimiento**, no el bloque rígido. Y porque el costo de un robot lo dominan los **actuadores**: cada grado de libertad que resuelves *en la geometría* (linkage de 1 GDL que ya "sabe" caminar) es un servo + driver + control + energía que **no compras**.
- **Casi nadie lo hace** porque es difícil de verdad: el espacio es **mixto** (un grafo discreto no tiene gradiente respecto a "añadir un eslabón") y el operador cinemático tiene **gradiente discontinuo** (saltos de rama, zonas NaN donde la junta se desarma). Fusion y compañía se quedaron en lo continuo-diferenciable (cargas) porque ahí el descenso de gradiente *simplemente funciona*. La síntesis de mecanismos exige separar lo discreto de lo continuo y un gate de validez cinemática — es ingeniería + matemática, no un solver llave-en-mano.

---

## 2. Las matemáticas de la síntesis generativa

### 2.1 Variables de diseño (espacio mixto `x = (G, d)`)

**Topología `G ∈ 𝒢`** — grafo cinemático, codificación canónica estilo LInK/LinkD:

- matriz de adyacencia triangular-inferior `E ∈ {0,1,−1}^{n×n}` (el signo codifica tipo de junta R/P sobre la arista),
- vector de tipo de nodo `T ∈ {0,1,−1}^n` (`T_i = 1` = fijo a tierra),
- vector de validez `V ∈ {0,1}^n` (padding hasta `n_max ≈ 20`).

Equivalentemente, el **assortment** `[n₂, n₃, n₄, …]` (número de eslabones binarios, ternarios, …). `𝒢` es **discreto y combinatorio**.

**Dimensiones `d ∈ ℝ^q`** — posiciones de juntas en pose inicial `X⁰ ∈ ℝ^{n×2}`, longitudes `ℓ_ij = ‖X_i⁰ − X_j⁰‖`, brazo y fase del actuador. `q` crece con `n`.

### 2.2 Operador cinemático forward (lo que el objetivo mide)

Para cada ángulo de motor `θ ∈ {θ₁ … θ_S}` (`S ≈ 200` muestras del ciclo), se resuelven posiciones por **trilateración nodo-a-nodo** (díada): si el nodo `i` tiene dos vecinos ya resueltos `j, k`,

$$
X_i(\theta) = X_j(\theta) + \ell_{ij}\,R(\varphi)\,\frac{X_k(\theta) - X_j(\theta)}{\|X_k(\theta) - X_j(\theta)\|},
\qquad
\cos\varphi = \frac{\ell_{ij}^2 + G_{ik}^2 - G_{jk}^2}{2\,\ell_{ij}\,G_{ik}}
$$

(ley de cosenos; `G_ik = ‖X_i − X_k‖` momentánea). El **signo de `φ`** lo fija el producto cruz en la pose inicial — esto es la **selección de rama**. El operador es **puro y diferenciable** en `X⁰`, y **vectorizable como tensor** `(mecanismos × θ × nodos)` → **batch GPU del clúster**.

**Validez de rama (gate duro):** `cos φ(θ) ∈ [−1, 1] ∀θ`. Si se sale del intervalo, la junta **se desarma** → mecanismo infactible, gradiente = NaN.

Para el **four-bar puro** el operador colapsa a Freudenstein y se vuelve cuadrática en `t = tan(θ₄/2)` (dos ramas: montaje abierto/cruzado).

### 2.3 Cierre de lazo y Freudenstein (la base, four-bar)

Cierre de lazo vectorial / complejo:

$$
a_2 e^{i\theta_2} + a_3 e^{i\theta_3} = a_1 + a_4 e^{i\theta_4}
$$

Eliminando el eslabón acoplador `θ₃` se obtiene la **ecuación de Freudenstein** (generación de función):

$$
K_1\cos\theta_4 - K_2\cos\theta_2 + K_3 = \cos(\theta_2 - \theta_4),
\quad
K_1 = \frac{a_1}{a_4},\;\; K_2 = \frac{a_1}{a_2},\;\; K_3 = \frac{a_2^2 + a_4^2 - a_3^2 - a_1^2}{2\,a_2 a_4}
$$

Con **3 puntos de precisión** `(θ₂, θ₄)`, esto es un **sistema lineal 3×3** en `(K_1, K_2, K_3)` → se invierte y se leen las longitudes. Solución por medio-tangente `t = tan(θ₄/2)` → `A t² + B t + C = 0` (dos ramas).

### 2.4 Objetivo: error del movimiento generado vs. deseado

Tres sabores, según la tarea:

**(a) Generación de función** — `m` puntos de precisión:

$$
f = \sum_{i=1}^{m}\big[\psi_{\text{gen}}(\varphi_i) - \psi^*(\varphi_i)\big]^2
$$

con error estructural `ε(x) = ψ_gen − ψ*`, **nulo en los puntos de precisión**.

**(b) Generación de trayectoria** — invariante a (traslación, rotación, escala, fase, reparametrización). Dos métricas SOTA:

- **Descriptores de Fourier:**

$$
C_k = \frac{1}{N}\sum_p z_p\,e^{-i 2\pi k p/N},\quad z_p = x_p + i y_p,
\qquad f = \sum_k \big\|\hat C_k^{\text{gen}} - \hat C_k^{*}\big\|^2
$$

normalizando por `C₀` (traslación), `|C₁|` (escala), `arg C₁` (rotación). Para el four-bar: 9 parámetros → 5 invariantes.

- **Híbrida ordenada + Chamfer (LInK):**

$$
d = \gamma_1\, d_{\text{OD}} + \gamma_2\, d_{\text{CD}},\quad \gamma_1 = 0.25,\;\gamma_2 = 1.0
$$

con `d_OD = min_{o∈{cw,ccw}} (2π/N) Σ_i ‖X_o(i) − X*_i‖²`, `d_CD` = Chamfer simétrico, tras Procrustes `X_norm = (X − X̄)/√((1/N)Σ‖X_i − X̄‖²)`.

**(c) Generación de movimiento (poses)** — lo que un brazo/pata necesita: error sobre `SE(2)`, `δ_j = P_j − P_1`, `α_j` = orientación. Se resuelve por **Burmester** (§2.6).

### 2.5 Restricciones — el "lint" del mecanismo (gates duros)

Análogo al `critic-gate` del render: corre **siempre** y es **barato**. Rechaza el mecanismo **antes** de gastar cómputo.

| | Restricción | Ecuación |
|---|---|---|
| **R1** | Movilidad = # actuadores (Chebyshev–Grübler–Kutzbach) | `M = 3(n−1) − 2j₁ − j₂ = M*` (planar); general `M = d(n−1−g) + Σf_i`, `d=3` planar / `6` espacial |
| **R1'** | Movilidad **real** (Grübler miente en geometrías especiales) | `M = rank ker(Jacobiano de tornillos) = λ(n−1−g) + Σf_i + ν − ζ`. Bennett: Grübler `= −2` pero `M_real = 1` |
| **R2** | Sin defecto de rama/circuito/orden | `sign det(Jacobiano)` no cambia en `θ∈[0,2π)` ⇔ `cos φ(θ) ∈ [−1,1] ∀θ` |
| **R3** | Grashof (motor rotativo continuo, 1 actuador barato) | `s + l ≤ p + q`, con la entrada = eslabón más corto (manivela) |
| **R4** | Ángulo de transmisión (no se traba) | `40° ≲ μ(θ) ≲ 140° ∀θ` |
| **R5** | Rango de movimiento | el actuador recorre `φ ∈ [φ₀, φ_f]` |
| **R6** | No-interferencia / no-colisión | eslabones no se cruzan (**ya en `joints.ts`**) |
| **R7** | Imprimibilidad 3D | `ℓ_ij ≥ ℓ_min`, espesores manufacturables |

**Síntesis de número (diofántico)** — para movilidad `M = M*`:

$$
\sum_{i\ge 2}(3 - i)\,n_i = 3 - M^*, \qquad 2g = \sum_{i\ge 2} i\,n_i
$$

Para `M = 1`: `n` par, `n₂ ≥ 4`, `L = (n−2)/2` lazos.

### 2.6 Conteo de libertades — Burmester (lo que el generativo barre)

Síntesis dimensional por **díada en complejos** (forma estándar Sandor–Erdman), por pose `j` relativa a `1`:

$$
W(e^{i\beta_j} - 1) + Z(e^{i\alpha_j} - 1) = \delta_j, \qquad \delta_j = P_j - P_1
$$

| Poses | Sistema | Soluciones |
|---|---|---|
| **3** | lineal 2×2 en `(W, Z)` | `∞²` díadas (cerrado, **instantáneo**, sin clúster) |
| **4** | curva de Burmester (puntos-centro = cúbica circular) | `∞¹` |
| **5** | sistema polinómico → homotopía en el clúster | `≤ 4` puntos de Burmester ⇒ `≤ 6` four-bars exactos |

Esto **demuestra** que el espacio de soluciones es un **continuo** (`≤ 4` poses) o un conjunto **finito** (`5` poses). El generativo optimiza sobre él.

**Cota de expresividad (Kempe):** toda curva algebraica plana acotada es trazable por un bar-linkage ⇒ el límite **nunca** es expresividad, sólo **número de eslabones / costo**. (La curva acopladora del four-bar es una séxtica, grado 6.)

### 2.7 El método de solución — dos etapas (por qué el gradiente puro no basta)

**Limitación honesta** (la que define todo el campo): el simulador cinemático tiene gradiente **estable sólo cerca de un mecanismo válido**, y **discontinuo entre ramas** (saltos de raíz, zonas NaN). Y `G` es discreto → no hay gradiente respecto a "añadir un eslabón". **Ningún método serio usa descenso de gradiente puro desde cero.** Se separa lo discreto de lo continuo:

**Etapa 1 — síntesis de tipo/número (discreta, en el clúster):**

1. Resolver el sistema **diofántico** → enumera assortments `[n₂, n₃, …]` con `M = M*`.
2. Enumerar grafos **no-isomorfos** por assortment; **deduplicar** por invariantes espectrales de la adyacencia `A' = P A Pᵀ` (`det(A − xI)`, eigenvalores). Atlas 1-DOF: `n=4→1`, `n=6→2` (Watt/Stephenson), `n=8→16`, `n=10→230`.
3. Podar con **grupos de Assur** (subcadenas `M = 0`): pegar grupos de Assur a un eslabón motriz = **gramática generativa que preserva `M` por construcción**.

→ produce un conjunto finito de **topologías candidatas** + inicialización.

**Etapa 2 — síntesis dimensional (continua, por topología fija):**

- **Ruta A — cerrada, instantánea, sin clúster** (3 puntos / 3 poses): sistema **lineal**. Función → Freudenstein 3×3. Movimiento → díada compleja 2×2. Puntos de precisión en **espaciado de Chebyshev** (minimax del error estructural):

$$
x_j = \tfrac12(x_0 + x_f) - \tfrac12(x_f - x_0)\cos\!\Big[\tfrac{(2j-1)\pi}{2n}\Big]
$$

Es el **primer entregable**: encaja con la convención `useMemo` / loop-closure ya usada en `slider-crank.ts` y `gear-pair.ts`.

- **Ruta B — Burmester completo (clúster)** (4–5 poses): resolver curvas de puntos-centro/círculo o los `≤ 4` puntos de Burmester por **homotopía polinómica / monodromía numérica** (explora todas las raíces complejas; aquí el clúster GPU brilla).

- **Ruta C — aproximado (`> 5` poses o sin solución exacta):**
  - **Evolutivo híbrido GA–DE** (sin gradiente, robusto a la discontinuidad): población `~100`, mutación diferencial `v = x_best + F·(x_r1 − x_r2)`, error con penalización por defecto de Grashof/orden/rama (Cabrera, Bulatović). Una topología a la vez, lento sin warm-start.
  - **Diferenciable con warm-start (SOTA, LInK):** contrastive-learning CLIP grafo↔curva (InfoNCE) entrena un **espacio latente conjunto** sobre un dataset propio generado con el simulador (costo marginal `~0` en el clúster). Dada `Γ*`, **recuperar** candidatos por vecino-más-cercano latente, luego **refinar** sólo `X⁰` por BFGS/L-BFGS vectorizado (`~150` pasos GPU) minimizando `d = γ₁ d_OD + γ₂ d_CD`; infactibilidad = NaN. (Reportado: ~28× menos error, 75 s vs 45 min RL.) Alternativa: difusión autoregresiva sobre grafos (LinkD), validación cinemática post-hoc por ley de cosenos.

**Gate de validez** (entre las dos etapas, siempre, barato): tras cada candidato `(G, d)` verificar Grashof + `cos φ(θ) ∈ [−1,1] ∀θ` + `40° ≤ μ ≤ 140°` + no-colisión + `ℓ ≥ ℓ_min`. El espaciado de Chebyshev y estos filtros son `O(barato)` y son el **lint duro** del mecanismo.

**Arquitectura neta:** Etapa-1 discreta (enumeración + isomorfismo + Assur, clúster) → topologías; Etapa-2 continua por topología (A cerrada / B homotopía / C GA–DE o BFGS con warm-start latente) → dimensiones; gate de validez entre ambas. **El generativo profundo NO sustituye la verificación cinemática rigurosa**: propone topología + inicialización, el gradiente/homotopía afina, el gate valida.

---

## 3. Cómo lo construye La Forja reusando lo que ya tiene

La Forja **no parte de cero**. El sintetizador es un cableado nuevo sobre cuatro activos existentes.

### 3.1 La librería `src/lib/parts/` = el operador forward, ya escrito

Cada parte ya implementa su matemática cinemática con la convención `useMemo` + loop-closure:

- `slider-crank.ts` → cierre de lazo manivela-corredera. **Es el patrón exacto** del operador forward de la Ruta A.
- `gear-pair.ts` → relación cinemática + engrane de involuta.
- `planetary.ts` → ecuación de Willis (el diferencial sub-actuado de §4.6 sale de aquí).
- `escapement.ts`, `geneva.ts`, `clock.ts` → movimiento intermitente / temporización.

**Reuso:** generalizar el cierre de lazo de `slider-crank.ts` a la **trilateración díada** genérica de §2.2 (un nodo se resuelve de dos vecinos por ley de cosenos). Eso convierte la librería de "partes fijas" en un **evaluador de mecanismos arbitrarios** parametrizado por `(G, d)`. El mismo tensor `(mecanismos × θ × nodos)` se evalúa en batch.

### 3.2 `joints.ts` = el gate R6 (no-colisión) + ensamble, ya escrito

`joints.ts` ya hace cinemática de ensamble y **detección de colisión**. Es directamente la restricción **R6** del gate de validez. Reuso: llamar su test de no-interferencia dentro del lint, sobre cada muestra `θ` del ciclo.

### 3.3 El FEA (`formulas.ts`) = el nivel estructural del co-diseño

El motor que se cablea al CAD provee exactamente lo que el nivel estructural necesita:

- `tet4Element` (`formulas.ts:514`) → `K_e⁰` elemental.
- `conjugateGradient` (`formulas.ts:1138`) → resuelve `K U = F` (y, reusado, el **rango del Jacobiano** de R1').
- `vonMisesStress` (`formulas.ts:296`) → restricción de esfuerzo `σ_vM ≤ σ_lim` (agregada por KS).

**Reuso:** el mismo `conjugateGradient` sirve para (a) los solves estructurales por eslabón × caso de carga, y (b) verificar movilidad **real** R1' por el rango del espacio nulo del Jacobiano de tornillos.

### 3.4 El clúster (RPi/GPU) = el cómputo pesado

Donde se va el tiempo y donde el clúster paga:

- **Etapa 1 discreta:** enumeración de grafos + deduplicación por isomorfismo + grupos de Assur (combinatorio, paralelizable).
- **Ruta B:** homotopía polinómica / monodromía (raíces complejas).
- **Ruta C:** generar el dataset (simulador, costo marginal ~0), entrenar el latente CLIP, y el refinamiento BFGS vectorizado.
- **Co-diseño:** los múltiples solves `K U = F` (estructural, por eslabón × caso del ciclo).

El operador forward es un **tensor batch** `(mecanismos × θ × nodos)` → mapea 1-a-1 a la GPU del clúster, igual que el render headless por beat mapea a iangpu.

### 3.5 El gate de validez = el `critic-gate` del CAD

Misma filosofía que el portero del render 4K: **falla barato antes de gastar caro**. Un `mechanism-gate.cjs` que, dado `(G, d)`, devuelve `pass/fail` sobre Grashof + rama + transmisión + colisión + `ℓ_min`. Corre **antes** de cualquier refinamiento costoso.

---

## 4. El droide barato concreto: caminante de 1 motor (Klann/Jansen)

**Objetivo realista:** un **robot caminante de linkage de 1 GDL** — una pata tipo **Jansen** (8 barras) o **Klann** (6 barras) — accionada por **un solo motor** de rotación continua. Imprimible en PLA. Útil (se mueve, carga sensores ligeros, didáctico y de campo).

### 4.1 Por qué un linkage caminante y no patas servo-actuadas

Un cuadrúpedo "normal" usa 3 servos por pata × 4 = **12 actuadores**. Un caminante de linkage Jansen/Klann resuelve el andar **en la geometría**: la curva del pie (apoyo plano + retorno alto) está *codificada en las longitudes de las barras*. Un motor por lado, dos lados sincronizados → **1–2 motores totales**. La función "caminar" vive en `(G, d)`, no en N servos + controlador.

### 4.2 Movilidad: el conteo que lo hace de 1 motor

Una pata Jansen es una cadena de **8 barras**. Por Chebyshev–Grübler–Kutzbach (planar, sólo pares R):

$$
M = 3(n - 1) - 2 j_1 - j_2
$$

Para la pata Jansen `n = 8`, `j₁ = 10` (juntas R), `j₂ = 0`:

$$
M = 3(8 - 1) - 2(10) - 0 = 21 - 20 = 1 \quad\checkmark
$$

**1 GDL** → **1 actuador**. (Klann: `n = 6`, `j₁ = 7` → `M = 3·5 − 14 = 1`.) El motor gira la **manivela** (eslabón más corto); todo lo demás es pasivo. El criterio diofántico `Σ(3−i)n_i = 3 − 1 = 2` lo confirma: con `M = 1`, `n` par, `n₂ ≥ 4`.

### 4.3 La curva del pie (el efector) — qué tiene que producir el linkage

La tarea `Γ*` es la **curva del pie**: un perfil cerrado con dos tramos cualitativos —

1. **Fase de apoyo** (`stance`): el pie traza un segmento **aproximadamente recto y horizontal** mientras toca el suelo → el cuerpo avanza sin subir/bajar (eficiencia, no rebota).
2. **Fase de retorno** (`swing`): el pie se **levanta** y vuelve por arriba, librando obstáculos.

Matemáticamente, `Γ*` es una curva cerrada en el plano con: tramo inferior de **curvatura casi nula y tangente horizontal** (porción `~40–50%` del ciclo) + arco superior de altura `h_step`. La curva acopladora de un four-bar es una **séxtica** (grado 6); la pata Jansen encadena díadas para esculpir justo este perfil. El **largo de zancada** `L_stride` y la **altura de paso** `h_step` son los dos números de diseño.

### 4.4 Cómo se sintetiza/optimiza generativamente

**Generación de trayectoria** con la curva del pie como `Γ*`:

1. **Etapa 1 (tipo/número):** fijamos `M = 1`. El diofántico + atlas dan los assortments de `n = 6` (Klann, Watt/Stephenson) y `n = 8`. Se siembra con la topología Jansen/Klann conocida (warm-start de literatura) **y** se barre el atlas vecino por si una topología no-obvia traza mejor curva.

2. **Etapa 2 (dimensional):**
   - **Ruta C** (es trayectoria, `> 5` puntos): minimizar `f = γ₁ d_OD + γ₂ d_CD` (híbrida ordenada + Chamfer) entre la curva generada y `Γ*`, sobre las **longitudes de las 8 barras** `X⁰`. Warm-start con el latente CLIP (recupera candidatos cercanos) → refinar por **BFGS vectorizado** en el clúster.
   - Equivalente con **descriptores de Fourier** `f = Σ‖Ĉ_k^gen − Ĉ_k*‖²` si se quiere invariancia limpia a escala/rotación.

3. **Gate de validez (lint, siempre):**
   - **Grashof** `s + l ≤ p + q` con la manivela como eslabón más corto → **rotación continua de 1 motor** garantizada.
   - **Ángulo de transmisión** `40° ≤ μ(θ) ≤ 140° ∀θ` → no se traba bajo carga.
   - **Rama** `cos φ(θ) ∈ [−1,1] ∀θ` → ensamblable todo el ciclo.
   - **No-colisión** (`joints.ts`, R6) → las 8 barras no se cruzan.
   - **`ℓ_ij ≥ ℓ_min`** → imprimible en PLA.

4. **Co-diseño estructural (anidado):** una vez fija la cinemática, cada barra se aligera con topología-opt multi-caso usando las **reacciones del ciclo** como casos de carga:

$$
\min_{\rho}\; \sum_\theta w_\theta\, U_\theta^\top K(\rho) U_\theta
\quad\text{s.a.}\quad K(\rho)U_\theta = F_e^{(\theta)},\;\; \sum_e \rho_e v_e \le V^*,\;\; \sigma_{vM}(\rho) \le \sigma_{\lim}
$$

resuelto con `tet4Element` + `conjugateGradient` + `vonMisesStress`. Barras más ligeras → menor inercia → motor más chico → más barato.

5. **Puente imprimible (PRBM):** donde convenga monolítico, reemplazar pines por **flexuras** con junta pseudo-rígida a `γℓ` del empotre, `γ ≈ 0.85`, `K_Θ ≈ 2.65`, resorte torsional `K = γ K_Θ EI/ℓ`. Menos pernos, menos ensamble, una pieza imprimible.

### 4.5 BOM aproximado (por qué es barato — economía formal)

El BOM lo dominan los **actuadores**, no el plástico. Para un caminante bípedo-de-linkage / cuadrúpedo de 2 lados:

| Ítem | Cantidad | Costo aprox. (USD) | Nota |
|---|---|---|---|
| Motorreductor DC / NEMA pequeño | **1–2** | $6 – $18 | la palanca de costo; minimizar `M` |
| Driver de motor (L298N / TB6612) | 1 | $2 – $4 | |
| Eslabones / barras impresas (PLA) | ~16–24 | **~$1–3 total** | centavos de filamento |
| Pernos / pasadores M3 (o flexuras = $0) | ~20 | $1 – $3 | PRBM elimina varios |
| Micro (ESP32 / RPi Pico) | 1 | $3 – $6 | |
| Batería (18650 + holder) | 1 | $4 – $8 | |
| **Total** | | **≈ $20 – $40** | |

Comparación: un cuadrúpedo servo-actuado son **12 servos × ~$8 = ~$96 sólo en servos**, más driver de 16 canales, más batería mayor. **Minimizar `M` (cinemática) es la palanca de costo dominante.**

### 4.6 Las matemáticas de "barato", explícitas

- **Sub-actuación.** Sistema `q̈ = f₁(q, q̇, t) + f₂(q, q̇, t)·u`, **sub-actuado** ⟺ `rank[f₂] < dim[q]`. Un motor mueve muchos GDL vía acoplamiento mecánico pasivo. Para un gripper auto-adaptativo: **diferencial** `Σ w_k q_k = q_in` (1 entrada → `k−1` GDL pasivos que se adaptan al objeto). Esta es la `planetary.ts`/Willis ya existente.
- **Costo de transporte.** `COT = E / (m g d)`. Un caminante pasivo bien diseñado llega a `COT ≈ 0.20` (como un humano); ASIMO `≈ 20×` peor. Aligerar barras (estructural) baja `m` → baja `COT` → motor más chico → más barato. **Las dos generativas se multiplican en el costo:** mínimo `M` (cinemática) × mínimo material por eslabón (estructural) × juntas→flexuras (PRBM).

### 4.7 El co-diseño es un bucle anidado (honesto)

El droide **no** es "un mecanismo" ni "una pieza topo-optimizada": es un **mecanismo cuyos eslabones son piezas estructuralmente optimizadas**. Cinemática **afuera** (decide qué se mueve y cómo), estructural **adentro** por eslabón (lo aligera con las cargas del ciclo). El acople es **secuencial-iterativo**: aligerar un eslabón cambia su masa/inercia → altera la dinámica → cambia las reacciones `F_e^(θ)` → re-optimizar. Converge iterando **cinemática ↔ estructura** (co-diseño). El clúster cubre el cuello de botella (los muchos `K U = F` + la homotopía/BFGS).

---

## 5. Roadmap por fases (qué construir, en orden, reusando)

**Fase 0 — Operador forward genérico** *(reusa `slider-crank.ts`)*
Generalizar el cierre de lazo a la **trilateración díada** de §2.2: dado `(G, d)` y `θ`, devolver `X(θ)` para todos los nodos, vectorizado en `(mecanismos × θ × nodos)`. Salida: un evaluador puro y diferenciable. *Entregable: la curva del pie de una pata Jansen hardcodeada se traza correctamente en el viewer.*

**Fase 1 — Gate de validez** *(reusa `joints.ts`)*
`mechanism-gate.cjs`: Grashof + rama (`cos φ ∈ [−1,1]`) + transmisión (`40°–140°`) + no-colisión + `ℓ_min`. Falla barato. *Entregable: el gate rechaza un four-bar no-Grashof y acepta un crank-rocker válido.*

**Fase 2 — Ruta A (síntesis cerrada)** *(reusa convención `useMemo`)*
Freudenstein 3×3 (función) + díada compleja 2×2 (movimiento, 3 poses) + espaciado de Chebyshev. **Instantáneo, sin clúster, sin ML.** *Entregable: el usuario da 3 poses de un efector y La Forja escupe un four-bar exacto que las clava, en el viewer.* **Esto ya supera a Fusion** (Fusion no hace esto).

**Fase 3 — Etapa 1 discreta (síntesis de tipo/número)** *(clúster)*
Diofántico → assortments; enumeración de grafos no-isomorfos; dedup por invariantes espectrales; grupos de Assur. *Entregable: para `M = 1`, La Forja lista las topologías candidatas de `n = 6` y `n = 8`.*

**Fase 4 — Ruta B (Burmester completo)** *(clúster)*
4–5 poses por homotopía polinómica. *Entregable: dadas 5 poses, los `≤ 6` four-bars exactos.*

**Fase 5 — Ruta C (aproximado, trayectoria)** *(clúster, GPU)*
GA–DE robusto primero (sin entrenar); luego dataset + latente CLIP + refinamiento BFGS vectorizado. *Entregable: el usuario dibuja la curva del pie y La Forja sintetiza el linkage caminante.* **Aquí nace el droide diseñado por la máquina.**

**Fase 6 — Co-diseño estructural** *(reusa FEA `formulas.ts`)*
Topología-opt multi-caso por eslabón con las reacciones del ciclo. + PRBM (pines → flexuras). *Entregable: pata Jansen aligerada, σ acotado, imprimible monolítica.*

**Fase 7 — Bucle de co-diseño + fabricación**
Iterar cinemática ↔ estructura hasta converger; exportar STL imprimible + BOM. *Entregable: el droide caminante de `~$20–40`, diseñado de punta a punta por La Forja, imprime y camina.*

> El orden es **valor temprano primero**: Fases 0–2 dan un sintetizador exacto (Ruta A) sin tocar el clúster ni ML — ya es algo que Fusion no tiene. Las Fases 3–5 abren el generativo real. La 6–7 cierran el droide.

---

## 6. Veredicto honesto

### 6.1 Factible **ya** (ingeniería, no investigación)

- **Operador forward genérico** (Fase 0) — generalización directa de `slider-crank.ts`.
- **Gate de validez** (Fase 1) — Grashof/transmisión/rama/colisión son fórmulas cerradas + `joints.ts`.
- **Ruta A: síntesis cerrada** (Fase 2) — Freudenstein 3×3 y díada 2×2 son **álgebra lineal**; instantáneo, determinista, sin clúster. **Esto ya es un sintetizador de mecanismos funcional.**
- **Co-diseño estructural por eslabón** (Fase 6) — el FEA ya se cablea; topología-opt SIMP es estándar.

### 6.2 Investigación / ingeniería seria (pero acotada)

- **Etapa 1 discreta a gran `n`** — enumeración de grafos + isomorfismo es **combinatorio** (`n=10 → 230` cadenas); manejable hasta `n` moderado, pesado más allá. Clúster.
- **Ruta B (homotopía)** — madura en la literatura, pero implementar monodromía robusta es trabajo serio.
- **Ruta C (latente CLIP + BFGS)** — **es SOTA reciente (LInK/LINKS/LinkD)**; requiere generar dataset propio y entrenar. Factible con el clúster, pero es **el frente de investigación**, no un commit de una tarde.
- **Bucle de co-diseño cinemática↔estructura** — el acople es secuencial-iterativo; la convergencia formal del co-diseño dinámico (masa/inercia ↔ reacciones) es problema abierto en general. Se ataca con iteración pragmática.

### 6.3 Por qué esto **sí** sería "mejor que Fusion"

Fusion 360 hace **generativo-de-cargas**: topología-opt estructural sobre una pieza de **cinemática fija**. **No genera mecanismos.** No te da el linkage que camina; te da el recuadro interior de una pieza que ya no se mueve. En el marco de §1, Fusion vive en el **caso degenerado `M = 0`**.

La Forja, al hacer **síntesis cinemática generativa**, ataca el problema **del que Fusion es un sub-caso**: genera **topología + dimensiones + movilidad** para producir un **movimiento**. Y luego **anida** el generativo-de-cargas de Fusion *dentro* (cada eslabón aligerado) — es decir, **La Forja contiene a Fusion como su nivel interior** y le agrega el nivel que Fusion no tiene. Eso no es "otra feature": es un **superconjunto estricto**.

Honestidad: no toda la pila está hecha. Pero la **Ruta A ya entrega** un sintetizador exacto que Fusion no tiene, **hoy**, reusando lo que ya existe. El resto es roadmap con activos reales (parts/, joints.ts, FEA, clúster) — no humo.

---

## 7. Qué significa para LATAM

El costo de un robot lo dominan los **actuadores** y el **software de diseño**. La Forja ataca los dos:

- **Menos actuadores por matemática.** Resolver el movimiento *en la geometría* (linkage de 1 motor que ya sabe caminar) en vez de en 12 servos + controlador. Un droide útil de **~$20–40** en vez de cientos. Imprimible en cualquier impresora PLA de barrio.
- **El diseño lo hace la máquina, gratis.** Fusion generativo es caro y de suscripción, y **ni siquiera hace esto**. La Forja corre en navegador, con el cómputo pesado en un clúster propio (RPi/GPU) que ya existe. Un estudiante en Oaxaca, un técnico en Lima, un maker en Bogotá: dibujan la curva del pie / dan las poses del efector, y **la máquina les diseña el mecanismo** — topología, dimensiones, validado, aligerado, listo para imprimir.

El diferenciador no es estético: es **matemático**. La Forja diseña **el mecanismo mismo**, no sólo el relleno de una pieza fija. Eso —síntesis cinemática generativa, accesible, en español, barata, corriendo sobre hardware modesto— es lo que pone **droides diseñados por la máquina** al alcance de quien hoy no puede pagar ni los servos ni la licencia. **Barato, accesible, mejor que Fusion. Para LATAM.**