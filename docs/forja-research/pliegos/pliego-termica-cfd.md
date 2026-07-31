# PLIEGO DE TÉRMICA Y CFD — "los autores son el cliente"

**Fecha:** 2026-07-31 · **Analista:** PROJECT ANALYST · **Operador:** ian

**El cliente son los constructores de solvers térmicos y de fluidos.** No opinan: prescriben. Cada
regla de este pliego cita la fuente que la obliga. Si no hay fuente, no entra.

| Clave | Documento | Rol en este pliego |
|---|---|---|
| **[CHT]** | `P1_24` — *Conjugate Heat Transfer in OpenFOAM*, Turo Välikangas (Chalmers, OS-CFD) | **NUESTRO CASO EXACTO**: plástico ↔ acero ↔ agua. Acople monolítico vs particionado. |
| **[SAT]** | `P0_09` — *code_saturne 9.0 Theory Guide* (EDF R&D), 399 pp | Discretización conservativa, condiciones Robin, `heq`, media armónica, rutina de balance. |
| **[APDL]** | `P2_45` — *Ansys Mechanical APDL Thermal Analysis Guide* (2025 R1) | Estrategia de paso de tiempo (`ITS`), criterios de convergencia, cambio de fase, catálogo de verificación (VM). |
| **[AST]** | `P0_03` — *Code_Aster R5.02.01, Algorithme de thermique linéaire transitoire* | θ-método: precisión, estabilidad, formulación variacional del intercambio y del **intercambio pared-pared**. |
| **[KAZ]** | Kazmer cap. 9 (ya destilado en `docs/forja-research/kazmer-pliego/pliego-caps7-9.md`) | El caso de negocio: t_c, Eq 9.7 (h≈1000), Eq 9.10, Eq 9.22, Fig 9.7. |

> **Este pliego se escribió con el gate `mold-termico3d` ROJO enfrente.** La sección 6 no es teoría:
> son dos defectos MEDIDOS con número, y el gate que los hubiera cazado antes de que llegaran a main.

---

## RESUMEN EJECUTIVO — lo que hay que hacer el lunes

1. **La conservación no se verifica desde afuera; el solver la EMITE.** Un libro mayor de energía por
   paso, con TODOS los compartimentos de almacenamiento y TODOS los flujos de frontera acumulados.
   Tolerancia: **redondeo de máquina**, no ±15 %.
2. **El −99.5 % no es una fuga: es un balance mal planteado sobre un modelo bajo-resuelto.** La
   energía está viva, guardada en `pStack` (las micro-pilas de plástico), que el balance no cuenta.
   Medido: campo 28 J vs "inyectada" 5831 J, y la solución analítica dice que a t=0.05 s sólo pueden
   haber entrado ~94 J. El check pedía el 100 % del disparo en 0.05 s: **es infalsificable, no es un gate.**
3. **Sí hay un defecto físico real, y es del agua**: el área mojada discreta de las líneas de
   refrigeración es **exactamente 2.00× la analítica π·D·L** (1273.6 cm² vs 637.2 cm², medido). El
   molde se está enfriando al doble. Esto lo agrava el rediseño del circuito (más líneas → más celdas).
4. **El hot spot invertido (Δ=−1.0 °C) es un artefacto de malla, no física.** La sub-celda de plástico
   de la zona gruesa (1 mm) tiene `ITS = Δ²/4α = 2.86 s` [APDL §3.4.3.2]; la de la delgada (0.167 mm)
   tiene 0.080 s. Se muestreó a **0.05 s**: la zona delgada resuelve el transitorio y la gruesa no.
   Además la reja de acero de 7 mm no resuelve nada por debajo de **1.50 s**. El test mide ruido de malla.

---

# 1. EL PROCESO A MANO DEL ANALISTA TÉRMICO

Ésta es la secuencia que los cuatro documentos comparten. **Es un grafo con retornos, no un wizard**
(igual que el proceso de Kazmer): cada gate que falla te manda a un paso anterior, no adelante.

```
 D0  ¿QUÉ PREGUNTA CONTESTO?
      │  "t_c del ciclo" ≠ "hot spot en régimen" ≠ "pico en el primer disparo".
      │  Cada una elige un TIPO DE ANÁLISIS distinto.  [APDL §1.2]
      ▼
 D1  DOMINIO: ¿qué cuerpos entran?
      │  ¿el plástico es dominio o es condición de frontera?
      │  ¿el agua es dominio (CFD) o es un h? → decisión de CONJUGADO (§2.6)
      │  Simetrías y periodicidades: media pared adiabática, 1/4 de molde.  [AST §2.2]
      ▼
 D2  FRONTERAS: para CADA cara, uno de {Dirichlet, Neumann, Robin, pared-pared}
      │  [AST §2.1–2.5] · [SAT §5.3] · [APDL §2.5.2]
      │  Regla dura: NINGUNA cara sin condición explícita. "Sin condición" ≠ "adiabática"
      │  por accidente: escríbela.
      ▼
 D3  PROPIEDADES: k, ρ, Cp por material y por temperatura
      │  ¿constantes → problema LINEAL, o k(T)/H(T) → NO LINEAL?  [APDL §3.8, §3.9]
      │  Con cambio de fase: se define ENTALPÍA H(T)=∫ρc(T)dT, NUNCA "cp + calor latente".
      ▼
 D4  MALLA/REJA: el tamaño lo manda la CAPA LÍMITE TÉRMICA, no el CAD
      │  Δ ≤ 2·√(α·t_min) del fenómeno más rápido que quieras ver.  (§2.3)
      │  Malla graduada en la interfaz. Resolución SIMILAR a ambos lados.  [APDL Fig 5.1]
      ▼
 D5  ESTACIONARIO vs TRANSITORIO
      │  "Se hace el estacionario ANTES del transitorio, para establecer condiciones
      │   iniciales" — [APDL cap 2, párrafo 1]. Y el estacionario también puede ser
      │   el ÚLTIMO paso del transitorio, cuando ya se apagó todo.
      │  Ciclado periódico (nuestro caso): estacionario CÍCLICO ≠ estacionario.
      ▼
 D6  PASO DE TIEMPO: ITS = Δ²/(4α)  [APDL §3.4.3.2] + θ del esquema [AST §5.1]
      │  Y el ANTI-criterio: "evita pasos de tiempo extremadamente pequeños,
      │   especialmente al establecer condiciones iniciales" [APDL, Caution].
      ▼
 D7  RESOLVER, con el libro mayor de energía ENCENDIDO desde el paso 1
      ▼
 D8  VERIFICAR (§3) — conservación → analíticas → refinamiento → sanidad física
      │  ✗ conservación   → vuelve a D7 (bug de código)
      │  ✗ analítica      → vuelve a D4/D6 (malla o dt)
      │  ✗ refinamiento   → vuelve a D4
      │  ✗ sanidad física → vuelve a D1/D2/D3 (el MODELO no representa la física)
      ▼
 D9  VALIDAR contra dato real (Fig 9.7 de Kazmer, termopar de tryout) y REPORTAR
      con la incertidumbre y las simplificaciones DECLARADAS.
```

**El paso que las máquinas se saltan es D8→D4.** Un LLM que "arregla" un térmico casi siempre toca
D3 (propiedades) o D7 (el solver) porque ahí está el código. El analista humano, ante una analítica
fallida, sospecha primero de **D4 y D6** — malla y paso — porque el 80 % de los errores térmicos son
de resolución, no de física.

---

# 2. REGLAS PRESCRIPTIVAS

Formato: **MUST** (obligatorio), **SHOULD** (obligatorio salvo justificación escrita),
**TYPICALLY** (el default sensato), **AVOID** (prohibido salvo justificación escrita).

## 2.1 Elegir el coeficiente de convección `h`

- **MUST:** `h` NUNCA es un número que se teclea sin procedencia. Viene de (a) una correlación
  (Dittus-Boelter para el agua turbulenta en la línea), (b) un experimento, o (c) el resultado de un
  CFD previo. [SAT §5.3.3]: *"el coeficiente `hext` se conoce a partir de una correlación analítica o
  experimental"*.
- **MUST:** el `h` que le pasas al solver **NO es el `h` de la correlación** si tu primera celda es
  gorda. Hay que ponerlo en SERIE con la resistencia interna de la celda:
  ```
  h_int = k / d(centro_celda → cara)          [SAT §5.3.1, Eq I.5.3]
  h_eq  = h_int · h_ext / (h_int + h_ext)     [SAT §5.3.3, Eq I.5.9]
  ```
  *"La media armónica viene de sumar RESISTENCIAS en vez de conductancias."* Y el corolario que se
  cita explícito: **`h_ext → ∞` degenera en Dirichlet.** Si tu `h` es enorme comparado con `k/Δ`,
  no estás modelando convección: estás fijando la temperatura de pared y no te diste cuenta.
- **TYPICALLY:** en molde de inyección, `h_c ≈ 1000 W/m²·°C` para agua turbulenta [KAZ Eq 9.7]. Es
  el default del proyecto.
- **AVOID:** un `h` uniforme sobre una superficie donde el flujo no es uniforme (entrada de la línea,
  codos, zonas muertas del baffle). Si te importa esa no-uniformidad, ya no es un `h`: es un CFD (§2.6).
- **SHOULD:** cuando la malla del sólido no resuelve la capa límite, `h` se CORRIGE con una función
  de pared, no se deja el laminar: *"el objetivo de las funciones de pared es aumentar el coeficiente
  de intercambio para reflejar el mayor nivel de mezcla… corregir el coeficiente laminar `h_int = λ/y`
  por una función adimensional `u+`"* [SAT §5.4].

## 2.2 Robin vs Dirichlet vs Neumann

| Condición | Se usa cuando | Qué queda como INCÓGNITA | Fuente |
|---|---|---|---|
| **Dirichlet** `T = T_w` | Conoces la temperatura de pared (termopar, baño, contacto perfecto con un reservorio infinito) | el flujo `q_w` (resultado) | [SAT §5.3.1], [AST §2.1] |
| **Neumann** `−q·n = f` | Conoces el flujo (resistencia eléctrica, flux medido, cara adiabática con f=0) | la temperatura de pared | [SAT §5.3.2], [AST §2.3] |
| **Robin/mixta** `−q·n = h(T_ext − T)` | Conoces un ambiente lejano y un `h` | AMBAS: `T_w` y `q_w` | [SAT §5.3.3], [AST §2.4] |
| **Pared-pared** `∂T₁/∂n = h(T₂−T₁)` | Dos sólidos con **resistencia de interfaz** | ambas caras acopladas | **[AST §2.5]** |

- **MUST:** líneas de agua = **Robin**, jamás Dirichlet. Poner el agua a T fija es un sumidero
  infinito: te comes el gradiente radial en el acero y sobre-enfrías. (Es el caso `h_ext → ∞`.)
- **MUST:** el par plástico↔acero se modela con **`echange paroi`** [AST §2.5] o interfaz conjugada
  (§2.6) — **no** con un Robin de un solo lado. Un Robin de un solo lado supone que el otro cuerpo es
  un reservorio a temperatura fija, y el plástico se enfría: no lo es.
- **MUST:** los coeficientes de frontera se ACUMULAN por cara, nunca se SOBRESCRIBEN. Si dos parches
  tocan la misma celda, la conductancia total es la suma. Sobrescribir = perder una frontera en
  silencio. *(La Forja hace `cool[idx] = ...` en vez de `+=` — ver §6.2.)*
- **AVOID:** dejar una cara sin condición esperando "adiabática por default". [AST] obliga a que
  Γ = Γ₁ ∪ Γ₂ ∪ Γ₃ sea una **partición** de la frontera: cada cara pertenece a exactamente una.
- **SHOULD:** las condiciones fuertemente no lineales (radiación, cambios grandes de `h`) se
  aplican **RAMPEADAS**, no escalonadas: *"debido a la naturaleza altamente no lineal de la
  radiación, deberías especificar condiciones de frontera rampeadas (comando KBC)"* [APDL §5.5.1.5].
- **AVOID:** borrar una carga. *"Si necesitas borrar cargas (excepto restricciones de temperatura),
  ponlas a cero en un intervalo pequeño en vez de borrarlas"* [APDL §3.4.3.1]. Una carga que
  desaparece de golpe es una discontinuidad que el integrador no puede seguir.

## 2.3 Tamaño de celda vs capa límite térmica

La regla maestra es la de [APDL §3.4.3.2], leída **al revés**:

```
   ITS = Δ² / (4·α)        ← el paso de tiempo mínimo útil para una celda de tamaño Δ
   ⇒  Δ ≤ 2·√(α · t)       ← el tamaño de celda para RESOLVER un fenómeno de duración t
```

`Δ` es *"la longitud conductora del elemento en la dirección del flujo de calor, en el gradiente de
temperatura más alto esperado"*. Y la sanción por violarla, textual: *"el programa típicamente
calcula oscilaciones no deseadas y temperaturas fuera del rango físicamente posible."*

- **MUST:** dimensionar la celda de interfaz por la **profundidad de penetración** `δ(t) = √(α·t)`
  del fenómeno más rápido que declares querer ver. Números de La Forja:

  | Material | α (m²/s) | δ(0.05 s) | δ(1 s) | δ(19 s) |
  |---|---|---|---|---|
  | Acero P20 | 8.184e−6 | 0.64 mm | 2.86 mm | 12.5 mm |
  | ABS fundido | 8.731e−8 | **0.066 mm** | 0.295 mm | 1.29 mm |

  **La capa límite térmica del ABS en el primer segundo es de 0.3 mm.** Cualquier celda de plástico
  más gorda que eso NO puede reportar el flujo de contacto del primer segundo. Ni con el mejor
  integrador del mundo.
- **MUST:** malla **GRADUADA** en la interfaz: la celda más fina pegada al contacto, creciendo hacia
  adentro. Una pila uniforme (como `PCELLS=6` repartidos parejo) desperdicia celdas en el centro
  (donde no pasa nada en 19 s) y muere de hambre en la piel (donde pasa todo).
- **MUST:** *"mantén la resolución de malla lo más similar posible"* entre parches acoplados
  [APDL Fig 5.1]. Una interfaz con 0.1 mm de un lado y 7 mm del otro es una interfaz que miente.
- **SHOULD:** si las mallas no son conformes en la interfaz, se interpola: *"se sugiere usar
  `nearestPatchFaceAMI`… así los valores se interpolan entre parches y no hay problemas de
  discontinuidad"* [CHT §2.2].
- **TYPICALLY:** ≥ 5 celdas dentro de `δ(t_min)` para reportar el flujo con 2 cifras.
- **AVOID:** *"usar más subpasos para la misma malla frecuentemente da PEORES resultados"*
  [APDL §3.4.3.2]. Refinar el tiempo sin refinar el espacio es contraproducente. Esto es exactamente
  lo contrario de la intuición ingenua, y es la trampa #1.

## 2.4 Estabilidad y paso de tiempo

El θ-método [AST §5]: `(y_{n+1} − y_n)/Δt = θ·f(t_{n+1}, y_{n+1}) + (1−θ)·f(t_n, y_n)`

- **Precisión** [AST §5.1.1]: orden 1 en tiempo si θ ≠ 1/2; **orden 2 si θ = 1/2** (Crank-Nicolson).
- **Estabilidad** [AST §5.1.2], con `|r(λΔt)| ≤ 1` y `r(x) = (1 − (1−θ)x)/(1 + θx)`:
  ```
  θ ≥ 1/2  →  INCONDICIONALMENTE estable, cualquier Δt
  θ < 1/2  →  estable sólo si  Δt ≤ 2 / ((1 − 2θ)·λ)
  ```
  Con θ=0 (explícito) y λ = el mayor valor propio del laplaciano discreto, eso se reduce al conocido
  `Δt ≤ Δx²/(6α)` en 3D.
- **TYPICALLY:** `θ = 0.57` — el default de `THER_LINEAIRE`. Y una lección de honestidad intelectual
  que hay que copiar: [AST §5.1.2] dice literal *"esta valor tiene fama de ser preferible a
  Crank-Nicolson (0.5) y 'óptimo' para interpolaciones cuadráticas, pero no encontramos rastro de las
  justificaciones."* **El manual documenta que no sabe por qué su default es su default.** Eso es lo
  que debe hacer nuestro código con cada constante mágica.
- **MUST:** estabilidad ≠ precisión. Un esquema incondicionalmente estable (implícito, exponencial,
  espectral) **no te exime de `ITS`**. Puedes dar un paso de 10 s sin explotar y el resultado ser
  basura. Este es el error que La Forja cometió al escribir `// ya solo informativo: el espectral
  no lo necesita` sobre `dtMax` (§6.3).
- **MUST:** cuando se hace *operator splitting* (difusión ↔ fuente ↔ Robin, como en nuestro FDM),
  el error de splitting Lie-Trotter es **O(Δt)** aunque cada sub-paso sea exacto. Se sube a O(Δt²)
  con **Strang**: medio paso de fuente → paso completo de difusión → medio paso de fuente.
- **SHOULD:** paso de tiempo automático con **cotas superior E INFERIOR** [APDL §3.4.4]: *"para la
  mayoría de los problemas deberías encender el paso automático y poner límites superior e inferior."*
  El criterio de adaptación es el **valor propio térmico**: eigenvalor chico → paso grande.
- **AVOID:** *"pasos de tiempo extremadamente pequeños, especialmente al establecer condiciones
  iniciales. Los números muy pequeños causan errores de cálculo. En una escala de tiempo de orden
  unidad, pasos menores que 1e−10 causan errores numéricos."* [APDL §3.4.3.2, Caution].
- **SHOULD:** para minimizar imprecisiones puedes poner θ (`THETA`) = 1.0 (Euler implícito puro):
  paga orden de precisión a cambio de amortiguar oscilaciones espurias [APDL §3.4.4].

## 2.5 Biot y Fourier como criterios

| Número | Definición | Qué decide | Umbral |
|---|---|---|---|
| **Bi de celda** | `Bi_c = h·(Δ/2)/k` | ¿la celda de frontera puede tratarse como isoterma (lumped)? | `Bi_c ≲ 0.1` |
| **Bi de cuerpo** | `Bi = h·L_c/k`, `L_c = V/A` | ¿el cuerpo entero es lumped, o hay gradiente interno? | `Bi < 0.1` → lumped legítimo |
| **Fo de celda** | `Fo_c = α·Δt/Δ²` | estabilidad explícita y difusión por paso | explícito 3D: `Fo_c ≤ 1/6` |
| **Fo de proceso** | `Fo = α·t/L²` | ¿el cuerpo "ya se enteró"? | `Fo < 0.05` → semi-infinito válido; `Fo > 0.2` → régimen de un término |
| **Pe de elemento** | `Pe = ρ·c·u·Δ/k` | ¿hace falta upwind en advección? | los elementos viejos exigen `Pe < 1` [APDL cap 4] |

Anclado a La Forja (celda 7 mm, P20, h=1000):

```
Bi_celda = 1000 · 0.0035 / 32 = 0.109   ← JUSTO en el límite. El Robin lumped por vóxel
                                          es defendible, pero por los pelos: h_eq (§2.1)
                                          corrige un 9.9 % que hoy no se aplica.
Fo_celda(Δt=1 s) = 8.184e−6 · 1 / 4.9e−5 = 0.167
ITS_acero(Δ=7 mm) = 4.9e−5 / (4·8.184e−6) = 1.50 s   ← el piso temporal de la reja
Fo_ABS(pared 2 mm, t=19 s) = 8.731e−8·19 / 1e−6 = 1.66  ← ya NO es semi-infinita
Fo_ABS(pared 12 mm, t=19 s) = 8.731e−8·19 / 3.6e−5 = 0.046 ← SÍ sigue semi-infinita
```

- **MUST:** publicar `Bi_celda`, `Fo_celda` e `ITS` en el reporte de cada corrida. Son tres divisiones;
  el que no las publica es porque no las miró.
- **MUST:** el **`ITS` de la malla es el piso temporal del resultado**. Ninguna aserción sobre el
  campo a `t < ITS` es admisible. *(La Forja asertaba a t=0.05 s sobre una reja con ITS=1.50 s.)*
- **SHOULD:** cuando `Bi < 0.1` en un cuerpo entero, sustitúyelo por una **masa concentrada**
  (`MASS71` en [APDL §1.1.4]) en vez de mallarlo. Es más barato Y más exacto que mallarlo mal.

## 2.6 Acoplamiento conjugado: cuándo resolver el fluido y cuándo basta `h`

[CHT] es la referencia central. Hay tres arquitecturas, y la elección no es de gusto:

**(a) Un solo dominio con Robin (`h`).** El fluido no existe; su efecto es `h·(T_ext − T)`.
- **Úsalo cuando:** el fluido es un reservorio grande, bien mezclado, cuyo `T_bulk` **no cambia** por
  lo que le pasa al sólido; y `h` se conoce por correlación.
- **Test cuantitativo del "no cambia":** `ΔT_bulk = Q_total / (ṁ·c_p)`. Si `ΔT_bulk` es una fracción
  no despreciable de `(T_pared − T_bulk)`, el `h` con `T_bulk` constante **miente** y hay que al
  menos hacer el fluido 1D (marchar el `T_bulk` a lo largo de la línea).
  *Para nuestro molde: Kazmer §9.2.2 fija ΔT del agua ≤ 3 °C precisamente para que esta hipótesis
  aguante. Es una decisión de DISEÑO tomada para que el MODELO sea válido — hay que respetarla.*

**(b) Conjugado particionado (segregado).** Se resuelve fluido, se resuelve sólido, se intercambian
temperaturas y flujos en la interfaz, se itera. Es `chtMultiRegionSimpleFoam`.
- El acople es un parche `mappedWall` con `sampleMode nearestPatchFace` [CHT §2.2].
- **El costo documentado:** *"uno de los problemas principales de los solvers de OpenFOAM es la
  velocidad de convergencia MUY LENTA comparada con los solvers conjugados comerciales"* [CHT §1.2].
- **La palanca:** desbalancear los lazos internos. `chtCustomMultiRegionSimpleFoam` con
  **1 lazo de fluido : 2 lazos de sólido** por iteración convergió más rápido que 1:1 y que 1:5
  [CHT §5.1, §6.2]. Hay un óptimo, y no es "más lazos = mejor".

**(c) Conjugado monolítico (acoplado en bloque).** Las dos ecuaciones de energía en **UNA matriz**.
Es `conjugateHeatSimpleFoam` con `coupledFvScalarMatrix TEqns(2)` y parche `regionCouple` [CHT §4.1.1].
- **El veredicto medido:** *"`conjugateHeatSimpleFoam` es SUPERIOR a todos los demás solvers en
  velocidad de convergencia, como se esperaba"* [CHT §6.2]. Y el segregado de FOAM-extend fue
  *"3-4 veces más rápido"* que el de la Foundation.
- **Por qué importa para conservación:** en el monolítico la continuidad de flujo en la interfaz es
  una propiedad **estructural de la matriz**, no algo a lo que iteras. En el particionado, si cortas
  las iteraciones de acople antes de tiempo, **te quedas con un salto de flujo en la interfaz** =
  energía creada o destruida.

- **MUST:** si eliges (b), el criterio de paro NO es "hice N lazos": es **el desbalance de flujo en
  la interfaz** por debajo de tolerancia. `|q_sólido − q_fluido| / q_ref < tol`.
- **MUST:** la conductividad en la interfaz se interpola por **MEDIA ARMÓNICA**, nunca aritmética:
  ```
  K_f = K_c·K_c' / (α·K_c + (1−α)·K_c')          [SAT Eq I.4.30]
  ```
  *"Nótese que para asegurar la CONTINUIDAD DEL FLUJO en las caras internas, se debe usar la media
  armónica, mientras que la aritmética es el default por ser numéricamente más robusta."* [SAT §4.3]
  Con k_ABS=0.19 y k_P20=32 (razón 168:1) la aritmética da 16.1 en vez de 0.378: **un error de 43×**
  en la conductancia de contacto. Aquí la media aritmética no es "menos exacta", es catastrófica.
- **SHOULD:** en el sólido, resuelve la **ENTALPÍA `h`**, no la temperatura. [CHT §2.1.2]: el
  `hEqn` de `solveSolid.H` es un laplaciano en `h` con `α = k/(ρ·C_p)`, y `thermo.correct()` recupera
  T al final. La entalpía es la cantidad conservada; T es derivada. **Un solver que integra T y
  reconstruye la energía sumando ρc_pΔT sólo conserva si ρc_p es constante.**
- **AVOID:** dejar que un solver conjugado diverja sin red. [CHT §6.3] prescribe `limitTemperature`
  en `fvOptions` con `Tmin`/`Tmax`: *"previene que la simulación diverja y por tanto que truene."*
  **Pero:** clipar DESTRUYE la conservación. Regla nuestra: si clipas, **contabiliza la energía
  clipada en el libro mayor** y falla el gate si supera 1e−6 del total. Un clip silencioso es una
  fuga con permiso.
- **AVOID (gotcha de operación):** [CHT §6.3] *"usa siempre `changeDictionary` para poner las
  condiciones de frontera y los valores iniciales."* Y [CHT §4.2]: al descomponer para paralelo,
  `decomposePar` **pierde** la opción `bridgeOverlap true` y la pone en `false`. Herramientas que
  reescriben tu configuración en silencio: hay que verificar la config DESPUÉS del preprocesamiento,
  no antes.

## 2.7 Propiedades dependientes de la temperatura

- **MUST:** con cambio de fase se define **ENTALPÍA `H(T) = ∫ρ·c(T)·dT`** en unidades de
  calor/volumen, tabulada [APDL §3.8]. **Nunca** un `c_p` efectivo con el latente embarrado: el
  latente es un salto en H, y un c_p promediado a mano no conserva energía a través de la meseta.
  El ejemplo de referencia (solidificación de una fundición) tabula `ENTH` en 4 puntos y `KXX` en 4
  puntos [APDL §3.10.2] — y ojo: **la conductividad del acero NO es monótona** (1.44 → 1.54 → 1.22
  → 1.22 Btu/hr·in·°F): sube y luego baja. Una interpolación que asuma monotonía se rompe.
- **MUST:** en cambio de fase, **elementos de orden bajo** (PLANE55/SOLID70) o, si usas orden alto,
  **matriz de calor específico DIAGONALIZADA** (lumped) por KEYOPT [APDL §3.8]. Con matriz de masa
  consistente y un frente de fase, salen sobre/sub-oscilaciones.
- **SHOULD:** paso de tiempo automático **obligatorio** en cambio de fase, *"para que el programa
  pueda ajustar el paso antes, durante y después del cambio de fase"* [APDL §3.8]. Y búsqueda de
  línea (`LNSRCH`) para ayudar a la convergencia.
- **TYPICALLY:** el método **QUASI** (Picard, reformando la matriz sólo si las propiedades cambiaron
  más de un umbral) con tolerancia de reforma **5 % por default**, tabla rápida de 64 puntos entre
  T_min y T_max [APDL §3.9.2]. Es la aproximación barata. *"No es tan exacto cuando la no linealidad
  es fuerte. Para minimizar la imprecisión, usa pasos de tiempo pequeños."*
- **SHOULD:** en el conjugado, la conductividad se actualiza **dentro** del lazo, antes de re-acoplar:
  `solidThermo.correct(); kSolid = solidThermo.k(); … kSolid.correctBoundaryConditions();` [CHT §4.1].
  Y hay un gotcha citado [CHT §4.3]: la `k` del directorio `0/` es la que se usa para **corregir el
  acople en la frontera**, y la del directorio `constant/` es la que se usa para **el campo**. Dos
  copias del mismo número en dos lugares = van a divergir. En La Forja: `K_STEEL` vive en
  `mold-thermal-fdm.ts:27` y `o.kSteel ?? 32` en `thermal-steady.ts:59`, y `RHO/CP` están duplicados
  otra vez en el test. **Ya divergieron** (§6.4).
- **AVOID:** propiedades dependientes de T **sin declarar el rango de validez**. Fuera de la tabla se
  extrapola plano y nadie te avisa.

---

# 3. ⭐ VERIFICACIÓN — EL CORAZÓN DE ESTE PLIEGO

> Verificación = *"¿resolví bien las ecuaciones?"* — contra matemáticas.
> Validación = *"¿resolví las ecuaciones correctas?"* — contra el mundo.
> **Este capítulo es de VERIFICACIÓN.** Un solver que no pasa verificación no merece validación.

## 3.0 El axioma

**La conservación de energía en un esquema conservativo no es "aproximada": es EXACTA hasta el
redondeo de máquina.** Es una identidad algebraica, no un resultado físico.

La razón está en [SAT §4.1.1, Eq I.4.3]: los términos de divergencia se integran con Green de modo
que aparecen **flujos de cara**, `∫_Vc div(Y)dV = Σ_f Y_f·S_{c>c'}`, y *"la relación es EXACTA."*
Cada cara interior aparece **dos veces con signo opuesto** (`S_{c>c'} = −S_{c'>c}`), así que al sumar
sobre todas las celdas del dominio, **todo se telescopa** y sólo sobrevive la frontera.

**Consecuencia práctica dura:** un gate de conservación con tolerancia **±15 % no es un gate de
conservación.** Es un gate de plausibilidad. El número correcto es **1e−12 en float64** y
**~1e−6 acumulado en float32**. Si tu conservación falla por 15 %, no tienes un problema de
precisión: tienes un bug, o tienes un balance mal planteado.

## 3.1 El libro mayor de energía (`energy ledger`) — REQUISITO #1

**MUST: el solver EMITE su balance; el test no lo reconstruye desde afuera.**

Esto es lo que hace ANSYS: el listado de la corrida de verificación imprime literalmente
`Temperature | Heat Flux | Energy balance` por cada substep [APDL §5.10.2/5.10.3], junto a la
solución analítica. **El balance es una salida de primera clase del solver, no un post-proceso.**

Lo que la lleva la contabilidad:

```
ALMACENAMIENTO (todos los compartimentos, sin excepción)
   E_store(t) = Σ_todos_los_compartimentos  ρ_i · c_i · V_i · (T_i(t) − T_ref)
                └─ vóxeles de acero
                └─ vóxeles/pilas de plástico          ← EL QUE SE OLVIDÓ (§6.1)
                └─ masas concentradas, insertos, elementos 1D
   (con cambio de fase: E_store = Σ V_i · [H_i(T_i(t)) − H_i(T_ref)] , NO ρcΔT)

FLUJOS ACUMULADOS (integrados en el tiempo, con signo, uno por TIPO de frontera)
   Q_in(t)     = ∫ potencia de fuentes volumétricas + Neumann entrantes
   Q_robin(t)  = ∫ Σ_celdas h_eq·A·(T_ext − T)·dt        ← el agua
   Q_dir(t)    = ∫ Σ_caras (flujo de reacción de los Dirichlet)
   Q_clip(t)   = ∫ energía destruida por clipping/limitTemperature  (debe ser 0)

RESIDUAL
   r(t) = [E_store(t) − E_store(0)] − [Q_in + Q_robin + Q_dir − Q_clip]
   ρ_r  = |r(t)| / max( |E_store(0)|, ∫|Q| , ε )
```

**GATE G1 — CONSERVACIÓN GLOBAL:** `ρ_r < 1e−10` (float64) / `< 1e−5` (float32, tras 200 pasos).
Se corre en **cada** paso, no al final. El paso en que se rompe te dice qué término lo rompió.

**Regla de implementación que hace G1 estructural:** *nunca escribas una fuente en una sola celda.*
Todo intercambio se escribe como **par**:
```
  const dE = g * (T[a] - T[b]) * dt;
  E[a] -= dE;  E[b] += dE;        // conservación por construcción, no por suerte
```
Si el término no tiene contraparte (es una frontera), su energía va a un **acumulador con nombre**.
No hay tercera opción. Un `T[v] += algo` suelto en el código es un agujero de conservación
esperando a suceder.

## 3.2 Flujo neto en fronteras — REQUISITO #2

**GATE G2 — CIERRE EN ESTACIONARIO:** en estado estacionario, `Σ Q_frontera = Q_fuentes` con
`< 0.1 %`. Sin almacenamiento, todo lo que entra sale.
*Para `thermal-steady.ts`: la extracción total del Robin del agua DEBE igualar `qTotalW`
(el `Q` de Kazmer Eq 9.10) al 0.1 %. Hoy no se comprueba.*

**GATE G3 — SIGNO Y MONOTONÍA POR FRONTERA:** con `T_campo > T_agua`, `Q_robin` es estrictamente
positivo (extraído) y monótono creciente. Un solo paso con signo invertido = BC con el signo al revés.
[SAT §5.3.3] avisa explícito: *"Cuidado, un flujo saliente se cuenta positivamente."* Los signos de
las fronteras son la fuente #1 de errores silenciosos, porque el campo se ve "razonable" igual.

**GATE G4 — IDENTIDAD GEOMÉTRICA DE LOS COEFICIENTES DE FRONTERA.**
Esto es la lección de la **suma-de-filas** de ANSYS, trasplantada. [APDL §5.5.1.3]:
*"Para asegurar un buen balance de energía, necesitas satisfacer tanto la relación de SUMA DE FILAS
como la de RECIPROCIDAD de la matriz de factores de vista. Para un recinto perfecto, cada fila debe
sumar 1."* — es decir: **los coeficientes discretos de una frontera deben satisfacer una identidad
exacta conocida a priori, y esa identidad se AUDITA.**

Nuestra versión:
```
Σ_celdas_marcadas  A_mojada_celda   ==   π · D · L_total     (±2 %)
Σ_columnas  A_columna · espesor     ==   volumen real de la pieza (±2 %)
Σ_caras_Dirichlet  A_cara           ==   área real del parche  (±1 %)
```
**Este es el gate que hay que escribir primero** (§6.6). Es una suma de un renglón, corre en
milisegundos, no necesita resolver nada, y ya está en rojo con factor **2.00×** (medido, §6.2).

## 3.3 Conservación en régimen transitorio — REQUISITO #3

**GATE G5 — EL TEST ADIABÁTICO (el más barato y el más brutal).**
Apaga TODAS las fronteras y TODAS las fuentes. Inicializa con un campo cualquiera. Corre 10 000 pasos.
```
  |ΣρcT(t) − ΣρcT(0)| / ΣρcT(0)  <  1e−12  (float64)
```
Si esto falla, el operador de difusión tiene un bug y **nada más de lo que hagas importa**. No hay
excusa de modelado posible: en un sistema aislado la energía no cambia. *(La Forja: el operador
espectral Neumann pasa con 1.19e−5 en float32 tras 200 pasos — es redondeo, no fuga. Medido, §6.3.)*

**GATE G6 — PRINCIPIO DEL MÁXIMO DISCRETO.**
Sin fuentes, `T(t) ∈ [min(T(0), T_frontera), max(T(0), T_frontera)]` para todo t y toda celda. Es la
formalización de lo que ANSYS llama *"temperaturas fuera del rango físicamente posible"*
[APDL §3.4.3.2]. Un overshoot es diagnóstico, no cosmético: **te dice que violaste `ITS`.**
*Nota: los esquemas espectrales pueden dar Gibbs en discontinuidades; si G6 falla justo donde hay
un salto de material, el problema es que estás aplicando un operador global a un medio heterogéneo.*

**GATE G7 — PARCHE CONSTANTE.** `T ≡ const` en todo el dominio, todas las fronteras al mismo valor.
Después de N pasos, `T ≡ const` **exactamente** (bit a bit en float64). Caza: estenciles asimétricos,
celdas fantasma mal puestas, un `+=` que debía ser `=`, un Robin con el signo cambiado, un factor de
volumen olvidado en una celda de esquina.

**GATE G8 — PARCHE LINEAL.** `T = a + b·x`, caras y/z adiabáticas, Dirichlet en x=0 y x=L.
El laplaciano discreto debe dar **exactamente 0** en el interior, y el estacionario debe reproducir
la recta a redondeo. Con `k` variable, el análogo es que el **flujo** sea constante a lo largo de x
(ahí es donde la media aritmética se cae y la armónica pasa — [SAT §4.3]).

**GATE G9 — REFINAMIENTO (Richardson).** Corre en (Δ, Δ/2, Δ/4) contra una analítica de §3.4:
```
  orden observado  p = log2( |e(Δ) − e(Δ/2)| / |e(Δ/2) − e(Δ/4)| )
  difusión FDM centrada:   p ≈ 2.0 ± 0.2
  splitting Lie-Trotter en dt:  p ≈ 1.0 ;  Strang:  p ≈ 2.0
```
**Si `p` sale ~0, la solución no está convergiendo a nada: hay un bug, no un error de discretización.**
Éste es el gate que separa "impreciso" de "roto", y es el que casi nadie escribe.

**GATE G10 — CONVERGENCIA DEL SOLVER LINEAL, NORMALIZADA.**
[APDL §3.4.4]: el criterio es `VALUE × TOLER`, con `VALUE` un **valor típico del problema**.
*"Para tasas de flujo de calor, el programa compara el vector de carga DESBALANCEADA con el criterio
de convergencia. El vector de desbalance representa la diferencia entre los flujos aplicados y los
internos calculados."* → **el residual del solver ES un desbalance de energía.**
```
  ‖r‖ / ‖b‖  <  1e−8       (RELATIVO, nunca absoluto)
```
*`thermal-steady.ts:121` usa `tol = 1e−3` sobre `‖r‖₂` **absoluto en watts**: depende del número de
celdas y de la escala del problema. Cambias la reja y cambias, sin querer, la exigencia.*

## 3.4 Soluciones analíticas de referencia — con fórmula y con valor

Éstas son las que **hay que codificar** como gates. Todas tienen forma cerrada, cero ambigüedad, y
las tres primeras están en el catálogo de verificación de ANSYS por nombre.

---

### R1 · Pared plana, estacionario, Dirichlet–Dirichlet — *el patch test térmico*
```
   T(x) = T₁ + (T₂ − T₁)·x/L                q = k·(T₁ − T₂)/L
```
**Valor P20, L=50 mm, ΔT=100 °C:** `q = 32·100/0.05 = 64 000 W/m²`.
**Criterio: error < 1e−12 (relativo).** Es un campo lineal en reja uniforme: el FDM lo reproduce
EXACTO. Cualquier desviación es un bug, no discretización. *(Este es G8 con número.)*
→ ANSYS **VM92** (Insulated Wall Temperature).

### R2 · Pared plana con Robin en ambas caras — *valida `h_eq`*
```
   q = (T∞₁ − T∞₂) / ( 1/h₁ + L/k + 1/h₂ )        T_pared = T∞₁ − q/h₁
```
**Valor:** L=50 mm, k=32, h₁=1000, h₂=1000, T∞₁=200, T∞₂=20:
`R = 0.001 + 0.0015625 + 0.001 = 0.0035625` → `q = 180/0.0035625 = 50 526 W/m²`,
`T_pared_1 = 200 − 50.53 = 149.47 °C`.
**Criterio: < 0.5 %.** Si falla por ~10 %, es que **no aplicaste `h_eq` = h_int·h_ext/(h_int+h_ext)**
[SAT Eq I.5.9] — que es exactamente el error de 9.9 % que tiene La Forja hoy (§6.4).

### R3 · Sólido semi-infinito con escalón de temperatura superficial ⭐
```
   T(x,t) = T_s + (T_i − T_s)·erf( x / (2√(α·t)) )
   q_s(t) = k·(T_s − T_i) / √(π·α·t)
   Q(t)   = ∫q = 2·(T_s − T_i)·√(k·ρ·c·t/π) = (2/√π)·e·(T_s−T_i)·√t     con e = √(kρc)
```
**Valor P20:** `α = 8.184e−6 m²/s`, `e = √(32·7820·500) = 11 186 J/(m²·K·√s)`.
**Criterio: perfil `T(x,t)` con < 2 % de error en 5 puntos dentro de `δ = √(αt)`, Y `Q(t)` con < 1 %.**
→ ANSYS **VM28** (Transient Heat Transfer in an Infinite Slab), **VM110**, **VM114**.

**Por qué es LA referencia para nosotros:** el arranque de la inyección es exactamente esto. Y la
forma `Q ∝ √t` es el diagnóstico: si tu solver da `Q` lineal en t al principio, tu primera celda es
demasiado gorda y estás midiendo la conductancia de la celda, no la del material.

### R4 · Contacto de dos semi-infinitos — LA prueba plástico↔acero ⭐⭐
```
   e_i = √(k_i·ρ_i·c_i)                     (efusividad térmica)
   T_contacto = (e₁·T₁ + e₂·T₂)/(e₁ + e₂)   ← CONSTANTE en el tiempo
   q(t)  = (T₁ − T₂)·e₁·e₂ / ((e₁+e₂)·√(π·t))
   Q(t)  = 2·(T₁ − T₂)·[e₁·e₂/(e₁+e₂)]·√(t/π)
```
**Valores La Forja** (ABS 239 °C `k=0.19, ρ=930, c=2340` ↔ P20 60 °C `k=32, ρ=7820, c=500`):

| Magnitud | Valor |
|---|---|
| `e_ABS` | **643.0** J/(m²·K·√s) |
| `e_P20` | **11 185.7** J/(m²·K·√s) |
| **`T_contacto`** | **69.73 °C** ← *ya implementado en `thermal-layers.ts:29`* |
| `b = e₁e₂/(e₁+e₂)` | 608.1 |
| `Q(t)` | **122 817·√t J/m²** |
| `Q(0.05 s)` | 27 463 J/m² · `q = 274 628 W/m²` |
| `Q(1 s)` | 122 817 J/m² · `q = 61 409 W/m²` |
| `Q(19 s)` | 535 348 J/m² · `q = 14 088 W/m²` |

**Criterio: `T_superficie_acero → 69.7 ± 0.5 °C` y se QUEDA ahí mientras `√(αt) ≪ espesor`; `Q(t)`
con < 3 % en t ∈ [0.1, 5] s.**
**Esta es la referencia que hay que gatear primero en La Forja.** Es nuestro caso literal, tiene
forma cerrada, el módulo `contactTemperature()` ya existe, y el valor 69.7 ya aparece —
sin gate — en `scripts/kazmer-termica-3d-test.cjs:39`.

**Y da el veredicto sobre el hot spot:** `T_contacto` **NO depende del espesor**. Ambas zonas
(12 mm y 2 mm) deben arrancar en 69.7 °C. La diferencia entre gruesa y delgada emerge **después**,
cuando la delgada agota su entalpía y la gruesa sigue alimentando. El tiempo característico de ese
agotamiento es `t* = (espesor/2)²/α_p`: **11.5 s** para 2 mm, **412 s** para 12 mm. **Antes de ~3 s
las dos zonas son indistinguibles por física.** Cualquier Δ que midas a 0.05 s es malla.

### R5 · Pared plana finita, enfriamiento — la de Kazmer
```
   t_c = (h_pieza²/(π²·α_p)) · ln( (4/π)·(T_melt − T_mold)/(T_eject − T_mold) )
```
**Valor** (ABS, pared 2 mm, T_melt=239, T_mold=60, T_eject=80): `h²/(π²α) = 4.642`,
`ln(1.2732·8.95) = 2.433` → **t_c = 11.3 s**. La suite del libro ya reproduce el ejemplo de Kazmer
(19.3 vs 18.9 s). **Criterio: < 5 % contra la fórmula, y la serie completa (no sólo el primer
término) cuando `Fo < 0.2`.**
→ ANSYS **VM110/VM116** (Heat Conducting Plate with Sudden Cooling).

### R6 · Cilindro / esfera — respuesta concentrada y distribuida
```
   Lumped (Bi<0.1):  (T−T∞)/(T₀−T∞) = exp( −h·A·t/(ρ·c·V) )
   Cilindro 1D:      serie de Bessel J₀,  raíces de  λ·J₁(λ) = Bi·J₀(λ)
```
**Criterio:** el lumped con < 1 % cuando `Bi < 0.1`, y la serie con < 2 % cuando `Bi > 0.1`.
→ ANSYS **VM109** (Suddenly Cooled Wire), **VM111/VM112** (Cooling of a Spherical Body),
**VM108** (Temperature Gradient Across a Solid Cylinder).

### R7 · Generación volumétrica en placa — valida el término fuente
```
   T(x) = T_s + q'''·(L² − x²)/(2k)          T_max − T_s = q'''·L²/(2k)
```
**Criterio: < 1e−10.** Es cuadrático: el FDM de 2º orden lo da EXACTO en reja uniforme.
Éste es **el gate del depósito de energía**: si tu fuente distribuida no reproduce esta parábola a
redondeo, tu fuente no está entregando la energía que crees.
→ ANSYS **VM94** (Heat Generating Plate), **VM115**, **VM58**.

### R8 · Factor de forma: fila de cilindros bajo una superficie isoterma ⭐
**Ésta es la analítica que gatea EL CIRCUITO DE AGUA** — la geometría que el rediseño cambió.
Para una fila de cilindros isotermos de diámetro D, ejes a profundidad H bajo un plano isotermo,
paso W entre ejes (Holman Tabla 3-1 / Incropera Tabla 4.1, caso "row of parallel cylinders"):
```
   S/L = 2π / ln[ (2W/(π·D)) · sinh(2π·H/W) ]
   q'  = k · (S/L) · (T_superficie − T_agua)          [W por metro de línea]
```
**Valores para D = 6.35 mm, P20 (k=32), ΔT = 40 °C:**

| W (paso) | H (profundidad) | S/L | q' (W/m) |
|---|---|---|---|
| 25 mm | 25 mm | 0.9653 | 1 236 |
| 25 mm | 35 mm | 0.6964 | 891 |
| 50.8 mm | 25 mm | 1.5611 | 1 998 |
| 50.8 mm | 35 mm | 1.1937 | 1 528 |
| 75 mm | 25 mm | 1.8461 | 2 363 |
| 75 mm | 35 mm | 1.4771 | 1 891 |

**Criterio: < 8 %** (una reja FDM de 7 mm no puede hacer mejor con un cilindro de 6.35 mm).
**Esto es exactamente lo que hay que correr contra el circuito rediseñado.** Es la única forma de
saber si "4 líneas por lado en vez de 1" extrae la potencia que la teoría dice, o el doble (§6.2).

### R9 · Régimen periódico establecido — nuestro estado real
Onda térmica de superficie de periodo `P` en semi-infinito:
```
   T(x,t) = T̄ + ΔT·exp(−x/d)·cos(ω·t − x/d)      con  d = √(2α/ω),  ω = 2π/P
```
**Valor P20, ciclo de 30 s:** `ω = 0.2094 rad/s`, `d = √(2·8.184e−6/0.2094) = 8.84 mm`.
→ **la oscilación cíclica del molde sólo se siente en ~9 mm de acero**; más adentro es el promedio.
**Criterio: amplitud a x=d debe caer a `1/e = 0.368` de la de superficie, ±5 %.**
**Y el gate de periodicidad, que es de conservación:** en el ciclo límite,
`E_store(t+P) = E_store(t)` y `∫_ciclo Q_in = ∫_ciclo Q_out` con **< 0.5 %**. Si el molde deriva de
ciclo a ciclo, o no convergiste, o tienes una fuga.

---

## 3.5 ⭐ CÓMO SE CAZA (Y SE EVITA) UNA PÉRDIDA DE 99.5 %

Éste es el procedimiento, en orden. **Cada paso descarta una familia entera de causas.** No brinques
pasos: el orden está elegido para que lo más barato descarte lo más caro.

**Paso 0 — ¿Es una fuga o es el balance?**
Antes de tocar el solver: **suma la energía de TODOS los buffers, no sólo del campo principal.**
Un solver moderno tiene varios almacenes (campo, pilas 1D, masas concentradas, historia de
fronteras). El déficit va a ser **exactamente igual al compartimento olvidado**. Diagnóstico de 5
minutos que ahorra 5 días.
*(Nuestro caso: 5831 − 28 = 5803 J estaban en `pStack`. No se perdió nada.)*

**Paso 1 — ¿El 100 % era alcanzable?**
Pon el número contra la analítica **antes** de llamarlo fuga. La R4 dice que a t=0.05 s el acero
puede haber recibido, como máximo físico con contacto perfecto, `Q = 27 463 J/m²` — que sobre nuestra
huella son ~94 J, **el 1.6 % del disparo.** El check pedía el 100 %. **Un gate que la física no puede
pasar no es un gate: es un bug en el test.** Esto vale por sí solo: *antes de acusar al solver,
calcula cuál sería la respuesta CORRECTA.*

**Paso 2 — Test adiabático (G5).** Apaga todo. Si la energía deriva, la fuga está en el **operador de
difusión** y no hay que buscar en ningún otro lado. Si no deriva, el operador está limpio y puedes
descartar toda esa familia.
*(Nuestro caso: 1.19e−5 en float32 tras 200 pasos = redondeo. Operador limpio.)*

**Paso 3 — Encender fronteras de una en una.** Con el ledger corriendo, activa Robin sola, luego
Dirichlet sola, luego fuente sola. La que rompe el balance es la culpable, y ya sabes su nombre.

**Paso 4 — Auditar las identidades geométricas (G4).** Suma las áreas discretas y compáralas con las
analíticas. Aquí es donde salen los factores enteros: **2×, 3×, 6×.** Un factor entero limpio casi
siempre es *"una cara/celda se contó N veces"* o *"se usó el diámetro en vez del radio"*.
*(Nuestro caso: área mojada = 2.00× la analítica. Factor entero limpio.)*

**Paso 5 — Auditar la simetría del estencil (G7).** Parche constante. Si `T ≡ 60` no se queda en 60,
tienes un estencil que no es simétrico y estás bombeando o drenando energía en las esquinas.

**Paso 6 — Buscar los `+=` huérfanos.** Grep literal en el solver por escrituras al campo que **no**
tengan contraparte:
```bash
grep -nE '\bT\[[^]]+\]\s*(\+=|-=|=)' src/forja/mold/*.ts
```
Cada acierto tiene que caer en una de tres categorías: (a) par conservativo con su contraparte,
(b) frontera con acumulador nombrado, (c) **bug**. No hay (d).
*(Nuestro caso: `mold-thermal-fdm.ts:339` `T[v] += eJm2/(ρ·cp·dx)` es categoría (a) sin contraparte
contabilizada — la contraparte vive en `pStack` pero nadie la suma.)*

**Paso 7 — Refinar (G9).** Si el balance cierra pero el resultado no coincide con la analítica, y al
refinar el error NO baja como Δ², no es discretización: es modelo o bug.

---

### Las siete formas de perder energía en un FDM — checklist

| # | Mecanismo | Firma en el ledger | Cómo se previene |
|---|---|---|---|
| 1 | **Compartimento no contabilizado** (nuestro caso) | déficit ENORME (>90 %), estable, = a la masa olvidada | inventario explícito de almacenes; el ledger falla si un buffer no está registrado |
| 2 | **Coeficiente de frontera sobrescrito en vez de acumulado** | déficit chico y dependiente de la reja | `+=` obligatorio en el ensamble de BC; G4 lo caza |
| 3 | **Área/volumen discreto ≠ geométrico** | factor ENTERO limpio (2×, 4×) | G4: identidad geométrica auditada |
| 4 | **Clipping silencioso** (`limitTemperature`, `Math.max`) | déficit que aparece sólo cuando el campo es extremo | contabilizar `Q_clip`; gate en 1e−6 |
| 5 | **Interpolación no conservativa** entre mallas / entre etapas | déficit que crece con cada remapeo | interpolación conservativa (área-ponderada) + re-escalar al total |
| 6 | **ρ·c_p distinto entre el solver y el post-proceso** | error sistemático fijo, típicamente 5–20 % | UNA fuente de verdad para las propiedades; prohibido duplicar constantes |
| 7 | **Integrar T en vez de entalpía con ρc(T) variable** | deriva lenta, crece con el rango de T | resolver `h` (entalpía) como [CHT §2.1.2] |

---

# 4. ITERACIONES — cuándo refinar, cuándo el dt está mal, cuándo el modelo no representa la física

**El árbol de decisión.** Un solo síntoma casi nunca identifica la causa; la combinación sí.

| Síntoma | Diagnóstico | Acción |
|---|---|---|
| Conservación falla (G1/G5) | **BUG.** No es física, no es malla, no es dt. | §3.5, paso por paso |
| Conservación OK, oscilaciones / T fuera de rango físico (G6) | **`Δt < ITS`**: paso demasiado chico para la malla | **agrandar Δt o refinar Δ**. Textual [APDL §3.4.3.2]: *"usar más subpasos para la misma malla frecuentemente da peores resultados."* |
| Conservación OK, campo suave, error grande vs analítica, **baja como Δ²** | discretización sana, malla insuficiente | **refinar Δ** hasta que G9 dé error < tolerancia |
| Conservación OK, error grande, **NO baja al refinar** (`p ≈ 0`) | el modelo converge a la respuesta EQUIVOCADA | **volver a D1/D2/D3**: física faltante o BC mal puesta |
| Error baja al refinar la malla pero **NO al refinar Δt** | error de **splitting** dominante | Strang splitting, o reducir Δt del acople |
| Estacionario nunca converge, residual estancado | matriz mal condicionada / criterio absoluto | residual **relativo** (G10) + precondicionador; revisa razones de k extremas |
| Conjugado converge lentísimo | segregado con lazos desbalanceados | 1 fluido : 2 sólido [CHT §5.1]; o **monolítico** [CHT §4.1.1] |
| El campo se ve bien pero el flujo en la interfaz no cierra | acople particionado cortado antes de tiempo | criterio de paro = desbalance de flujo, no conteo de lazos |
| Solución depende del orden en que aplicas las BC | estás **sobrescribiendo** BC | acumular, no asignar (§2.2) |
| Salta entre dos valores cada iteración | Picard/QUASI sin relajación | relajación bajo 1.0, o pasar a Newton FULL [APDL §3.9.1] |
| Se rompe justo en el cambio de fase | `c_p` embarrado o matriz de masa consistente | ENTALPÍA + masa lumped + AUTOTS [APDL §3.8] |

**Cuándo refinar (y cuánto):** refina **donde está el gradiente**, no uniforme. El criterio es
`Δ_local ≤ 2√(α·t_local)` con `t_local` el tiempo característico local. Refinar uniforme un factor 2
en 3D cuesta 8× memoria y 8–16× tiempo; refinar sólo la interfaz cuesta ~1.2×.

**Cuándo el modelo NO representa la física** — las cinco señales:
1. `p ≈ 0` en G9 (refinar no ayuda).
2. Un parámetro "de ajuste" hace falta para pegarle al dato. Si tienes que tocar `h` a 3000 para que
   salga, tu modelo no tiene el mecanismo que domina.
3. El resultado depende de algo que la física dice que no debería (el hot spot dependiendo del
   número de sub-celdas y no del espesor: **eso es La Forja hoy**).
4. Un número adimensional está fuera del régimen del modelo (Bi>0.1 con lumped; Pe>1 con Galerkin).
5. El balance cierra perfecto y el resultado sigue mal. Conservas energía **de la ecuación
   equivocada**. ⭐ *Un solver puede ser perfectamente conservativo y perfectamente falso.*

---

# 5. JUICIOS HUMANOS — simplificaciones legítimas y sus límites

| Simplificación | Legítima cuando | Deja de valerte cuando | Fuente |
|---|---|---|---|
| **Fluido → `h`** | `ΔT_bulk ≪ (T_pared−T_bulk)`; `h` de correlación válida | el fluido se calienta a lo largo del recorrido; hay recirculación/zonas muertas | [SAT §5.3.3], [KAZ §9.2.2] |
| **Cuerpo → masa concentrada** | `Bi = hL_c/k < 0.1` | necesitas el gradiente interno (esfuerzos térmicos, hot spot) | [APDL §1.1.4] |
| **Semi-infinito** | `Fo = αt/L² < 0.05` | ABS 2 mm ya no lo es a los 3 s | R3/R4 |
| **Estacionario en vez de transitorio** | *"los efectos de almacenamiento que varían en el tiempo pueden ignorarse"* | ciclado (el molde SIEMPRE cicla): usa estacionario **cíclico** | [APDL §1.2] |
| **Estacionario como condición inicial del transitorio** | práctica RECOMENDADA | el arranque real es de molde frío | [APDL cap 2, ¶1] |
| **k, ρ, c constantes** | rango de T estrecho, sin cambio de fase | el acero del ejemplo de ANSYS cambia k **no monótonamente** con T | [APDL §3.10.2] |
| **Media aritmética de k en caras** | materiales con k comparable | razón 168:1 (ABS/P20) → **error de 43×**. USA ARMÓNICA | [SAT §4.3] |
| **Simetría / media pared adiabática** | la geometría Y las BC son simétricas | el circuito de agua rompe la simetría | [AST §2.2] |
| **Ignorar radiación** | `T < ~400 °C` y superficies encerradas | fundición, tratamiento térmico | [APDL cap 5] |
| **Ignorar contacto imperfecto** | contacto a presión, superficies pulidas | hay aire/desmoldante: es una `echange paroi` real | [AST §2.5] |
| **Boussinesq para flotación** | *"sólo puede calcularse con precisión para flujos inducidos por DIFERENCIAS DE TEMPERATURA PEQUEÑAS"* | ΔT grande | [CHT §4.1] |
| **Malla gruesa + funciones de pared** | el perfil de pared es el canónico | separación, gradiente adverso | [SAT §5.4] |

**Y las tres reglas de honestidad que hay que copiarles a los manuales:**

1. **Documenta lo que no sabes.** [AST §5.1.2] dice de su propio default: *"tiene fama de ser
   preferible… pero no encontramos rastro de las justificaciones."* Cada constante mágica de nuestro
   código lleva su procedencia o lleva su confesión.
2. **Documenta lo que no explicas.** [CHT §6.1]: *"El autor no encontró explicación de por qué los
   campos de temperatura son tan diferentes entre FOAM-extend y la versión Foundation."* Una
   discrepancia sin explicar se REPORTA, no se esconde bajo un promedio.
3. **La simplificación se ETIQUETA en el entregable.** Un resultado con `h` en vez de CFD dice
   "modelo Robin, h=1000 de Eq 9.7, válido para ΔT_agua ≤ 3 °C" — en el reporte, no en un comentario.

---

# 6. BRECHA CONTRA LA FORJA — diagnóstico MEDIDO

Corrida real de hoy, `node --import tsx scripts/mold-termico3d-test.cjs`:
```
tras inyección: acero sobre GRUESA 60.1 °C vs DELGADA 61.1 °C
 ❌ HOT SPOT 3D: acero sobre zona gruesa MÁS caliente — Δ=-1.0 °C
energía: campo 28 J vs inyectada 5831 J
 ❌ CONSERVACIÓN de energía (±15%) — -99.5%
```

## 6.1 El −99.5 % — VEREDICTO: balance mal planteado, no fuga

`scripts/mold-termico3d-test.cjs:97-101` calcula `eIn` como **la entalpía COMPLETA del disparo**
(`ρ_p·c_p·(239−60)·espesor·área`) y la compara contra el campo de acero a **t = 0.05 s**.

Pero el commit `5a5dcac` (F2b, "EL PLÁSTICO EXISTE") cambió el modelo de **depósito instantáneo** a
**conducción gradual por micro-pilas** (`mold-thermal-fdm.ts:261-298`). Ahora la energía vive en
`pStack` y entra al acero a su ritmo físico. **El test nunca se actualizó** (`git log` sobre él
devuelve un solo commit, `0d9bbb2`).

Los 5803 J que "faltan" **están en `pStack`**. El balance correcto es:
```
   E_plástico(t) + E_acero(t) + Q_agua_acumulado(t)  ==  E_plástico(0) + E_acero(0)
```
y con ese balance el residual es de redondeo.

**Y encima el gate era infalsificable:** R4 dice que el máximo físico a 0.05 s con contacto perfecto
es `Q = 27 463 J/m²` → ~94 J sobre nuestra huella, **el 1.6 % del disparo**. Un check que exige el
100 % en 0.05 s **no lo puede pasar ninguna física.** El código da 28 J (3.4× por debajo de los 94 J
correctos, por bajo-resolución — §6.3), pero incluso un solver perfecto habría reportado −98.4 %.

## 6.2 ⭐ EL DEFECTO REAL: el agua enfría **exactamente al doble**

Medido con sonda directa sobre `createThermalSim(bezel)`:
```
celdas Robin 912 · cell 7 mm · segs 9 · L 1597 mm/plano · planos 2
área mojada DISCRETA 1273.6 cm²  vs  ANALÍTICA π·D·L 637.2 cm²  →  factor 1.999
```

**Causa,** `mold-thermal-fdm.ts:252-255`:
```ts
if (dd <= cc.diaMm / 2 + cell / 2) {
  const a = Math.PI * (cc.diaMm / 1000) * dx;          // ← área COMPLETA…
  cool[idx(i, j, kL)] = (H_COOL * a) / (RHO_STEEL * CP_STEEL * dx * dx * dx);
}
```
El radio de captura es `6.35/2 + 7/2 = 6.675 mm`, y con centros de celda a paso de 7 mm caen
**dos** celdas transversales dentro del criterio. **Cada una recibe el perímetro mojado COMPLETO
`π·D·dx`** → factor 2. Es el mecanismo #3 de la tabla de §3.5: *área discreta ≠ geométrica, factor
entero limpio*.

Dos agravantes en el mismo bloque:
- **`cool[...] = ` en vez de `+=`** (mecanismo #2): si dos segmentos del circuito pasan por la misma
  celda, la segunda escritura **borra** la primera. El rediseño `b88feb9` subió de 4 a 5 líneas por
  lado y las alargó en X → más traslapes y más celdas capturadas. **El rediseño no rompió el test,
  pero sí empeoró este defecto.**
- **`thermal-steady.ts:86` hereda la misma máscara `cool`** (`gWater = hC·π·D·dx`), con `lineDiaM`
  por default **0.00953 m** mientras el FDM usa 6.35 mm — dos diámetros distintos para la misma línea.

**Impacto:** el molde se enfría al doble → `T_molde` baja → `t_c` sale corto → la Fig 9.7 de Kazmer
se reproduce por compensación de errores, no por corrección.

## 6.3 ⭐ El hot spot invertido es **artefacto de malla**, no física

`ITS = Δ²/(4α)` [APDL §3.4.3.2] aplicado a las sub-pilas de plástico (`pDx = max(0.15 mm, th/12)`):

| Zona | `dxp` | `ITS` (piso temporal) | ¿resuelve t=0.05 s? |
|---|---|---|---|
| Gruesa (12 mm) | 1.000 mm | **2.86 s** | NO — 57× por encima |
| Delgada (2 mm) | 0.167 mm | **0.080 s** | casi |
| Reja de acero | 7 mm | **1.50 s** | NO — 30× por encima |

Y la penetración térmica en ABS a 0.05 s es **0.066 mm** — más fina que las dos sub-celdas.
Resultado: la zona delgada, con sub-celda 6× más fina, entrega mucho más flujo en el instante
muestreado; la gruesa está limitada por su propia celda. **El "hot spot" que mide el test es el
inverso del cociente de tamaños de celda.**

Confirmación por R4: `T_contacto = 69.73 °C` **no depende del espesor**. Las dos zonas deben arrancar
iguales, y sólo divergen cuando la delgada agota su entalpía (`t* = 11.5 s`) mientras la gruesa sigue
(`t* = 412 s`). **El gate del hot spot debe medirse a t ≈ 10–20 s, no a 0.05 s.**

**Y el comentario `mold-thermal-fdm.ts:260`:**
```ts
const dtMax = (dx*dx)/(6*ALPHA)*0.9;   // ya solo informativo: el espectral no lo necesita
```
Es verdad para la ESTABILIDAD y falso para la PRECISIÓN. Ese `dtMax` (0.998 s) es primo hermano del
`ITS` (1.50 s) y sigue siendo el **piso de resolución** de la reja. Estabilidad ≠ precisión (§2.4).

## 6.4 Inconsistencias de propiedades (mecanismo #6) — error sistemático de 18.9 %

| Constante | Solver | Test | Δ |
|---|---|---|---|
| `ρ·c_p` acero | `7820·500` (`mold-thermal-fdm.ts:27`) | `7800·460` (test:96) | **−8.2 %** |
| `ρ·c_p` ABS | `930·2340` (`:30`) | `1050·2345` (test:99) | **+13.1 %** |
| `k` ABS | `0.19` (`:30`) | — (implícito en el modelo viejo `0.25`) | 24 % |
| `⌀` línea | `cc.diaMm = 6.35` | `thermal-steady.ts:55` default `9.53 mm` | 50 % |

Combinado: **−18.9 % sistemático**, ya fuera de la banda ±15 % **aunque el modelo fuera perfecto.**
`thermal-layers.ts:22-24` ya es la fuente de verdad (`TM_ABS_MELT`, `TM_P20`) con las constantes
literales del Apéndice A/B de Kazmer. **Nadie más debe escribir un `ρ` o un `c_p` a mano.**

## 6.5 Lo que SÍ está bien (para no romperlo)

- **El operador espectral Neumann conserva.** Medido: deriva relativa **1.19e−5** tras 200 pasos en
  float32 — eso es redondeo de precisión simple, no fuga. **La difusión no es el problema.**
- **La media armónica está en los tres lugares correctos:** `thermal-layers.ts:56`,
  `mold-thermal-fdm.ts:282` (`gInt`), `thermal-steady.ts:79` (`harm`). Es justo lo que exige
  [SAT §4.3] y lo que el comentario del propio archivo llama *"el bug clásico de los FDM ingenuos
  multicapa"*. Bien visto.
- **`contactTemperature()` (R4) ya existe** y da 69.73 °C. Sólo falta **gatearla**.
- **El Robin exacto por vóxel** `T ← T_c + (T−T_c)·exp(−cool·dt)` es incondicionalmente estable y
  correcto en forma. El bug está en el **coeficiente** (§6.2), no en el integrador.
- **CG matrix-free** en `thermal-steady.ts` es la elección correcta. Sólo hay que **normalizar el
  residual** (G10) y **verificar el cierre de potencia** (G2).

## 6.6 ⭐ QUÉ IMPLEMENTAR PRIMERO — orden de ataque

**#1 · G4: identidad geométrica de fronteras.** *(horas, no días)*
Una función pura, sin resolver nada:
```ts
export function auditGeometria(sim): { areaMojadaDiscreta, areaMojadaAnalitica, ratio,
                                       volPlasticoDiscreto, volPlasticoMalla, ratioVol }
```
Gate: ambos ratios en `1.00 ± 0.02`. **Hoy sale 2.00 y falla.** Es el gate con mejor relación
señal/costo de todo el pliego: caza los factores enteros, corre en milisegundos, y no depende del
solver ni del test.

**#2 · G1: el libro mayor de energía como salida del solver.**
`sim.ledger()` → `{ E_acero, E_plastico, Q_agua_acum, Q_fuente_acum, residual, residualRel }`, en
**float64**, actualizado dentro de `step()`. Cambiar la asignación cruda de
`mold-thermal-fdm.ts:339` por un par contabilizado. Gate: `|residualRel| < 1e−10`.
**Con esto, el −99.5 % se convierte en un número verdadero, y el test se vuelve reescribible.**

**#3 · G5 + G7: adiabático y parche constante.** Dos tests de 20 líneas cada uno sobre una caja de
16×12×10. Corren en <1 s. Blindan el operador para siempre.

**#4 · R4 (contacto por efusividad) como gate real.** La superficie del acero bajo plástico debe
llegar a **69.7 ± 1.0 °C** y quedarse, y `Q(t)` seguir `122 817·√t J/m²` con < 5 % en t ∈ [0.1, 5] s.
**Ésta reemplaza al check de conservación roto** y es la analítica correcta para nuestro caso.

**#5 · R8 (factor de forma) como gate del circuito de agua.** `q' = k·(S/L)·ΔT` con
`S/L = 2π/ln[(2W/πD)·sinh(2πH/W)]`, tolerancia 8 %. **Es el gate que le faltaba al rediseño
`b88feb9`** y la única manera de saber si "4 líneas por lado" extrae la potencia teórica.

**#6 · R1 + R7 (parches lineal y cuadrático).** Barato, y R7 valida el término fuente que es
justo el que se sospechaba.

**#7 · Reescribir el test roto** con `ITS` respetado (`t ≥ 2 s`, no 0.05 s), leyendo las propiedades
de `thermal-layers.ts` y comparando contra R4/R5, no contra la entalpía total del disparo.

**#8 · `h_eq` en el Robin** (`h_int = k/(dx/2) = 9143`, `h_eq = 901.4`, −9.9 %) y `+=` en el ensamble
de `cool`.

### Las mejores analíticas para gatearnos, en una línea
> **R4 (contacto por efusividad, 69.73 °C y `Q = 122 817·√t`)** porque es LITERALMENTE nuestro caso y
> ya tenemos el módulo · **R8 (factor de forma, tabla de §3.4)** porque gatea la geometría que el
> rediseño cambió y que hoy está al 200 % · **R7 (parábola de generación)** porque debe salir a
> redondeo y valida el depósito de energía · **R3 (semi-infinito, `Q ∝ √t`)** porque su FORMA
> funcional delata la bajo-resolución sin necesidad de un valor de referencia.

---

# 7. ⭐ LOS 10 DETALLES QUE UNA MÁQUINA LINEAL SE SALTARÍA

**⭐1 · "Conservación ±15 %" no es conservación.**
La conservación en un esquema conservativo es una identidad algebraica de flujos telescopados
[SAT Eq I.4.3], no un resultado físico aproximado. El número correcto es **1e−12**, no 15 %. Una
máquina ve "±15 %" y ajusta la tolerancia; el analista ve que **el gate estaba mal desde el día 1**.

**⭐2 · Antes de acusar al solver, calcula cuál sería la respuesta CORRECTA.**
R4 dice que a 0.05 s el máximo físico es ~94 J, el 1.6 % del disparo. **El check pedía el 100 %:
era infalsificable.** Una máquina lineal lee "−99.5 %" y va a buscar la fuga en el código. La fuga
no existe: el test pedía lo imposible.

**⭐3 · La energía "perdida" casi siempre está viva en un compartimento que el balance no cuenta.**
5803 J estaban en `pStack`. **Inventaría los almacenes ANTES de auditar los flujos.** Es un
diagnóstico de 5 minutos que sustituye días de bisección. Una máquina audita el operador de difusión
(el sospechoso obvio) y pierde el día.

**⭐4 · Estabilidad ≠ precisión. Un integrador incondicionalmente estable NO te exime de `ITS`.**
El comentario `// ya solo informativo: el espectral no lo necesita` es media verdad, y la media que
falta es la que rompió el gate. `ITS = Δ²/(4α)` sigue siendo el **piso de resolución** de la reja
aunque el integrador sea exacto. La Forja asertaba a 0.05 s sobre una reja con ITS de 1.50 s.

**⭐5 · Refinar el TIEMPO sin refinar el ESPACIO empeora el resultado.**
Textual [APDL §3.4.3.2]: *"usar más subpasos para la misma malla frecuentemente da PEORES
resultados."* Es contra-intuitivo y es la trampa #1 de cualquiera que "afine" un térmico. La
respuesta instintiva ante un resultado feo (bajar dt) es exactamente la equivocada.

**⭐6 · Un resultado que depende del tamaño de celda y no del parámetro físico es un artefacto.**
El hot spot de La Forja se invierte porque la sub-celda de la zona delgada es 6× más fina, no porque
la pieza sea más delgada. **R4 demuestra que `T_contacto` NO depende del espesor.** Una máquina ve
"Δ = −1.0 °C, el signo está al revés" e invierte una comparación. El analista pregunta *"¿de qué
depende este número?"* y descubre que depende de la malla.

**⭐7 · Los factores ENTEROS limpios (2×, 4×, 6×) son geometría, nunca física.**
Área mojada = **1.999×**. Ningún fenómeno físico da 2.000. Un factor entero es siempre *"se contó N
veces"* o *"radio vs diámetro"*. Y se caza con una suma de un renglón (G4), sin resolver nada.
**Auditar la identidad geométrica de los coeficientes de frontera es el gate más barato que existe.**
Es la traducción de la regla de suma-de-filas de la matriz de factores de vista de ANSYS.

**⭐8 · Los coeficientes de frontera se ACUMULAN (`+=`), jamás se asignan (`=`).**
`cool[idx] = ...` hace que el último parche que toque una celda **borre** a los anteriores. El bug
es invisible en geometrías simples y aparece cuando el circuito se vuelve denso — justo lo que hizo
el rediseño. La solución no depende del orden de ensamble sólo si acumulas.

**⭐9 · Con razones de `k` extremas, la media aritmética no es "menos exacta": es catastrófica.**
ABS/P20 = 168:1. Aritmética → 16.1; armónica → 0.378. **Error de 43×.** [SAT §4.3] dice que la
aritmética es el default *"por ser más robusta numéricamente"* — un default que para nuestro caso
sería desastroso. **Los defaults de los solvers grandes están calibrados para SUS casos típicos,
no para el tuyo.** (La Forja ya lo hace bien; no romperlo.)

**⭐10 · Un solver puede ser perfectamente conservativo y perfectamente falso.**
Conservar la energía de la ecuación equivocada es fácil. Por eso la verificación tiene DOS piernas:
conservación (§3.1–3.3) **y** soluciones analíticas (§3.4). La primera dice "el código hace lo que
el esquema dice"; la segunda dice "el esquema resuelve la ecuación que crees". Un gate de
conservación solo te da falsa confianza. *Corolario doloroso: el balance de La Forja podría cerrar
en 1e−12 mañana y el hot spot seguiría invertido.*

**Bonus ⭐ · Documenta lo que no sabes y lo que no explicas.**
[AST §5.1.2] sobre su propio default θ=0.57: *"tiene fama de ser preferible… pero no encontramos
rastro de las justificaciones."* [CHT §6.1]: *"el autor no encontró explicación de por qué los campos
son tan diferentes."* Dos manuales de referencia industriales confesando ignorancia por escrito.
**Un LLM nunca escribe eso** — siempre inventa una justificación plausible. Es, quizá, la diferencia
más importante entre un documento de ingeniería y un texto generado.

---

## APÉNDICE — constantes verificadas de La Forja

```
Acero P20   k=32 W/m·K    ρ=7820 kg/m³   c=500  J/kg·K   α=8.1841e−6 m²/s   e=11 185.7
ABS fundido k=0.19        ρ=930          c=2340           α=8.7308e−8       e=   643.0
T_contacto(ABS 239 °C ↔ P20 60 °C) = 69.73 °C        b = e₁e₂/(e₁+e₂) = 608.1
Q_contacto(t) = 122 817·√t J/m²      q_contacto(t) = 108 850/√(π·t) W/m²

reja 7 mm:  ITS = 1.497 s   ·  dt_explícito = Δ²/6α = 0.998 s  ·  Fo(Δt=1 s) = 0.167
Robin:      h_int = k/(Δ/2) = 9143 W/m²K  ·  h_eq(h_ext=1000) = 901.4  (−9.9 %)
            Bi_celda = h·Δ/(2k) = 0.109
onda cíclica (P=30 s): d = √(2α/ω) = 8.84 mm  (ω = 0.2094 rad/s)
penetración: acero δ(0.05 s)=0.640 mm ; ABS δ(0.05 s)=0.066 mm
```

**Fuentes primarias en** `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/`:
`P1_24` (CHT/OpenFOAM) · `P2_45` (ANSYS APDL Thermal) · `P0_09` (code_saturne Theory) ·
`P0_03` (Code_Aster R5.02.01).

**Código auditado:** `src/forja/mold/mold-thermal-fdm.ts` · `src/forja/mold/thermal-steady.ts` ·
`src/forja/mold/thermal-layers.ts` · `src/forja/mold/mold-drawing-set.ts` ·
`src/forja/mold/cooling-design.ts` · `src/forja/campo/campo.ts` ·
`scripts/mold-termico3d-test.cjs` · `scripts/forja-gate.cjs:110`
