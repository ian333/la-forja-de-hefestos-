# PLIEGO DE DIBUJO Y GD&T — el cliente es el dibujante

**Fecha:** 2026-07-31
**Ejercicio:** los autores son el CLIENTE. Siempre acotaron y toleraron A MANO, y ahora nos piden el software.
Aquí el cliente es el que DIBUJA y el que define el LENGUAJE de los planos.

**Fuentes leídas (literal, con § citada):**

| Clave | Fuente | Qué aporta |
|---|---|---|
| **B** | Bethune & Brown, *Engineering Design and Graphics with SolidWorks 2023* (Pearson, 1824 pp). Caps 1–9 leídos completos vía `docs/forja-research/manuales/bethune/ch0*.txt` | El PROCESO a mano: croquis→restringir→acotar→feature; vistas; acotado ANSI; tolerancias ± y geométricas; ajustes |
| **M** | Salsbury (Mitutoyo), *GD&T and the new ASME Y14.5-2018* (27 láminas) | Los cambios de 2018, la relación GD&T↔inspección, y la regla que decide cuándo ± ya no sirve |
| **F** | Yorik van Havre, *A FreeCAD manual* — Sketcher / Part Design / Generating 2D drawings | Cómo un CAD libre organiza el modelado paramétrico y la generación de planos |

> **Regla de redacción (heredada del pliego Kazmer):** ningún requisito existe porque se vea bonito.
> Cada uno cita el § que lo obliga. Lo que NO está en las fuentes se marca
> **⟨EXTENSIÓN DECLARADA⟩** y se dice de dónde sale. Nada se inventa en silencio.

---

## 0. LOS SIETE AXIOMAS DEL DIBUJANTE

De dónde sale todo lo demás. Si el software viola uno de estos, el plano no sirve aunque compile.

| # | Axioma | § que lo obliga |
|---|---|---|
| **D1** | **Una cota no es un número: es una INSTRUCCIÓN DE MANUFACTURA con precio.** "Dimension values are not the same as mathematical units. Dimension values are manufacturing instructions and always include a tolerance, even if the tolerance value is not stated." 5.50 y 5.5000 son matemáticamente iguales y **no son la misma instrucción**. | B §7-5 |
| **D2** | **TODA cota tiene tolerancia, escrita o implícita.** Si no está escrita, la impone el bloque de tolerancias generales del plano. No existe la cota "exacta" salvo la BÁSICA. | B §8-1, §8-8 |
| **D3** | **La cota va donde la forma se ve en CONTORNO**, no donde cabe. Barrenos en su vista circular; superficie inclinada en la vista donde se ve inclinada. | B §7-22 |
| **D4** | **Nunca la misma distancia dos veces.** El doble acotado no es feo: es *incorrecto*, porque impide la acumulación de tolerancias. Elegir cuál cota se elimina es decisión de DISEÑO. | B §7-11 regla 8, §8-9 |
| **D5** | **El ± controla TAMAÑO, no FORMA ni ORIENTACIÓN ni POSICIÓN REDONDA.** Una cota de 30 ± 0.5 permite que la cara sea una serie de olas entre 30.5 y 29.5. | B §8-27, §8-35 |
| **D6** | **Un datum es una superficie REAL, medible y acabada** — no una idea. "Datum planes are assumed to be perfectly flat. When assigning a datum status to a surface, be sure that the surface is reasonably flat." Y: "It is considered poor practice to use a centerline as a baseline. Centerlines are imaginary lines that do not exist on the object and would make it more difficult to manufacture and inspect." | B §8-33, §7-15 |
| **D7** | **El plano no es un dibujo: es un DOCUMENTO LEGAL con ciclo de liberación.** "A finished engineering drawing is a legal document that goes through a release process before it becomes final." Dibujante firma DRAWN → revisor firma CHECKED → letra de revisión. | B §5-12 |

---

# 1. EL PROCESO A MANO DEL DIBUJANTE / DISEÑADOR

## 1.1 El lazo del MODELO (parte): croquis → restringir → acotar → feature

La secuencia real del cliente, en orden, tal como la ejecuta el libro capítulo tras capítulo:

```
  ┌─ 1. ELEGIR PLANO DE CROQUIS ──────────────────────────────────────┐
  │    plano base (Top/Front/Right) ó cara del sólido ya existente    │  B §1-2, §3-2
  │    si no hay cara utilizable → PLANO DE REFERENCIA por offset     │  B §3-12
  └───────────────────────────────────────────────────────────────────┘
                │
  ┌─ 2. BOSQUEJAR A OJO ──────────────────────────────────────────────┐
  │    "You can place the two points anywhere, since their correct    │  F Part Design
  │     location will be set in the next step."                       │
  │    el trazo aparece AZUL = sub-restringido                        │  B §1-3
  └───────────────────────────────────────────────────────────────────┘
                │
  ┌─ 3. RESTRINGIR (relaciones, no números) ──────────────────────────┐
  │    coincidencia, tangencia, horizontal/vertical, punto-sobre-punto│  B §1-9, §2-4
  │    muchas las pone el CAD SOLO al trazar (auto-relations)         │  F Part Design
  │    "Sketch Relations … help maintain the DESIGN INTENT"           │  B §1-9
  └───────────────────────────────────────────────────────────────────┘
                │
  ┌─ 4. ACOTAR (Smart Dimension) hasta NEGRO ─────────────────────────┐
  │    "Every circle needs a locational value AND a diameter value    │  B §1-4
  │     to be fully defined."                                         │
  │    anclar al ORIGEN: "All sketches must be referenced to the      │  B §2-3
  │     drawing's origin in order to be fully defined."               │
  └───────────────────────────────────────────────────────────────────┘
                │
  ┌─ 5. FEATURE (extruir / cortar / revolucionar / barreno) ──────────┐
  │    Extruded Boss/Base, Extruded Cut, Hole Wizard, Revolved,       │  B cap 3
  │    Fillet, Chamfer, Loft, Shell, Sweep, Draft, Pattern, Mirror    │
  └───────────────────────────────────────────────────────────────────┘
                │
                └──► volver a 1 sobre una cara NUEVA del sólido, y así
                     "one step on top of the previous one, you are actually
                      building one final solid object."                      F Part Design
```

### 1.1.1 El SEMÁFORO — el cliente lee color, no mensajes de error

Cuatro estados, y son la interfaz completa del sketcher (B §1-3):

| Color | Estado | Qué significa | Qué hace el dibujante |
|---|---|---|---|
| **Negro** | Fully defined | posición Y tamaño conocidos | seguir |
| **Azul** | Under defined | falta información | agregar relación o cota |
| **Rojo** | Over defined | conflicto | quitar una restricción |
| **Amarillo** | Redundant | sobra sin conflictar | quitar la redundante |

FreeCAD dice lo mismo con otras palabras: sketch **verde** = fully constrained; **over-constrained**
"should be avoided, and FreeCAD will notify you if such case occurs" (F, Part Design).

**Matiz humano que el software no debe imponer:** "You are never forced to work with fully
constrained sketches. However, if we are going to print this block in 3D, it will be necessary to
maintain our piece close to the origin point… By adding that constraint we are making sure that
our piece will always stay *anchored*." (F). O sea: el "fully constrained" es una META, no un gate
que bloquee; el gate lo pone el DESTINO de la pieza.

### 1.1.2 Qué se decide en el CROQUIS y qué en el SÓLIDO

Esta separación es la parte que más se confunde y la que el software tiene que hacer explícita.

| Se decide en el CROQUIS | Se decide en el FEATURE (sólido) |
|---|---|
| Perfil 2D y su topología | Profundidad / altura de extrusión (B §3-2) |
| Posición del perfil respecto al origen y a las caras (external geometry, F) | Condición final: Blind / Through All (B §7-6) |
| Diámetro de un círculo que va a ser barreno simple | TODO el barreno normalizado: tipo, estándar, tamaño de tornillo, contrataladro, avellanado, holgura de cabeza (Hole Wizard, B §3-5, §7-7) |
| Simetría / patrón cuando se hace con Sketch Pattern (B §2-19, §2-20) | Patrón cuando se hace con Feature Pattern — se repite el FEATURE, no la geometría (F: "it is a feature of our shape that has been duplicated, the final object is still only one solid object") |
| — | Redondeos y chaflanes de arista (B §3-8, §3-9) |
| — | Vaciado (Shell), ángulo de salida (Draft) (B §3-14, §3-16) |

**Regla de oro del cliente para editar:** "The **Edit Sketch** tool is used to edit entities created
using the Sketch tools, such as holes. The **Edit Features** tool is used to edit entities created
using the Features tools, such as cuts or extrusions." (B §3-25). El diámetro de un barreno se
cambia entrando al croquis; la profundidad del corte se cambia entrando al feature. **La línea de
tiempo debe ofrecer las DOS puertas por separado.**

### 1.1.3 Las cotas del croquis NO son las cotas del plano

Esto es literal y es la separación arquitectónica más importante del pliego:

> "Dimensions will appear in Part documents, but these are **construction dimensions**. These
> sketch dimensions are used to create a part and are used when a sketch is edited. **They will not
> appear on the finished model or in Assembly documents.** … The drawing on the right shows
> dimensions that were created using the Smart Dimension tool in a **Drawing document**. These are
> **defining dimensions** and will appear on the working drawings." — B §7-1

| | Cota de croquis (construcción) | Cota de plano (definitoria) |
|---|---|---|
| Vive en | el documento de parte / la línea de tiempo | el documento de plano |
| Para qué | manejar la geometría, mantener design intent | definir la pieza y guiar la manufactura |
| Refleja | cómo se CONSTRUYÓ | cómo se FABRICA e INSPECCIONA |
| Puede llevar tolerancia | no (es driving) | **sí, siempre** (D2) |
| El dibujante las coloca | donde le conviene para restringir | donde manda la convención ANSI |

**Corolario duro:** "importar cotas del modelo al plano" produce un plano **mal acotado por
construcción**, porque el orden en que se construyó la pieza casi nunca es el orden en que se
fabrica ni desde donde se mide. El propio libro lo confirma para su autocota: "The dimensions
created using the Autodimension tool **are not always in the best locations. The dimensions must be
relocated** to be in compliance with ANSI conventions." (B §7-3, caja *Warning*).

---

## 1.2 El lazo del PLANO: elegir vistas

### 1.2.1 Cuántas vistas

> "More than one orthographic view is needed to define a model **unless the model is of uniform
> thickness**. **Standard practice calls for three orthographic views**, a front, top, and side view,
> although more or fewer views may be used as needed." — B §4-1

Regla operable: **3 vistas por defecto (frontal + superior + lateral derecha en tercer ángulo);
1 vista si la pieza es de espesor uniforme (una placa) más la nota de espesor.**

Nota de la práctica del libro: cuando trabaja con una placa plana con barrenos, usa **una sola
vista superior** y declara el espesor por nota — "The part is 0.50 thick… In this example we will
work with only one view." (B §7-3).

### 1.2.2 Cómo se elige la vista PRINCIPAL

Bethune **no da un algoritmo explícito** para elegir el frente; lo demuestra con ejemplos. Lo que
sí es literal y sirve como criterio:

1. **El frente es el que se elige primero y las demás se PROYECTAN de él** — Model View crea una
   vista y "By default, this will be a front view"; luego Projected View genera las demás
   moviendo el cursor (B §4-4, §4-6).
2. **La posición relativa es crítica y no negociable**: "The positioning of views relative to one
   another is critical. The views must be aligned and positioned as shown." (B §4-3). Se proyecta
   entre frontal y superior con líneas **verticales**, y entre frontal y lateral con **horizontales**
   (B §4-3).
3. **Menos líneas ocultas gana** — se deduce de que el libro insiste en "All surfaces must be shown
   in all views. If an edge or surface is blocked from view by another feature, it is drawn using a
   hidden line" (B §4-3): la vista con menos oculto es la que más informa.

**⟨EXTENSIÓN DECLARADA⟩** El criterio clásico completo — "el frente es la vista que muestra la
forma más característica, en la posición de uso o de manufactura, con el menor número de líneas
ocultas" — **no aparece redactado en Bethune**. Si el software lo usa como heurística para
sugerir la vista principal, debe etiquetarse como *sugerencia*, no como regla del libro.

### 1.2.3 Tercer ángulo vs primer ángulo — es una PROPIEDAD DEL PLANO

| | Tercer ángulo (ANSI, EE. UU.) | Primer ángulo (ISO) |
|---|---|---|
| Plano de proyección | entre el observador y el objeto | más allá del objeto |
| Vista superior | **arriba** de la frontal | **abajo** de la frontal |
| Vista lateral | **derecha**, colocada a la derecha | **izquierda**, colocada a la derecha |
| Norma | ASME Y14.3-2012 | ISO 128-2:2022, 128-3:2022 |

Fuente: B §4-1, §4-2, §4-11.

**Obligación de software:** el símbolo de proyección (el cono truncado) "can be added to a drawing
to help the reader understand which type of projection is being used" (B §4-1, Fig 4-2), y el
estándar general del documento se fija UNA vez (`Overall drafting standard: ANSI | ISO`, B §4-4
paso 7). **Para LATAM el default correcto es ISO / primer ángulo**, y el símbolo debe ser
obligatorio, no opcional — es lo único que impide que el taller lea la pieza espejeada.

Mnemónico del cliente, que vale la pena poner en la UI: mano derecha, talón abajo y pulgar arriba;
girar hasta **palma arriba = tercer ángulo**; **palma abajo = primer ángulo** (B §4-2).

### 1.2.4 Cuándo SECCIÓN, cuándo DETALLE, cuándo AUXILIAR, cuándo ROTURA

| Vista | Disparador (literal) | § |
|---|---|---|
| **Sección** | "Some objects have internal surfaces that are not directly visible in normal orthographic views. Section views are used to expose these surfaces." | B §4-5 |
| **Sección alineada** | objetos circulares: "use an angled cutting plane line to include more features in the section view"; el plano se **gira a vertical antes de proyectar** | B §4-7 |
| **Detalle** | "used to clarify specific areas of a drawing. Usually, an area is enlarged so that small details are easier to see." Lleva círculo delimitador, letra y **escala propia** | B §4-9 |
| **Auxiliar** | superficie inclinada: "Only a view taken 90° to the surface will show its true shape." Ni frontal, ni lateral, ni superior dan la forma verdadera | B §4-10 |
| **Rotura** | "long continuous shapes so that they take up less drawing space"; requiere que la sección transversal sea **constante** en el tramo roto | B §4-8 |

**Regla de economía:** una vista auxiliar sola no necesita línea de plano de corte — "Because there
is only one auxiliary view and its origin is obvious, no defining cutting plane line is needed."
(B §4-10). O sea: **la anotación se pone cuando hay ambigüedad, no siempre.**

---

## 1.3 El proceso de ACOTADO — el orden real

### 1.3.1 De adentro hacia afuera

> "In general, **dimensions are applied from the inside out**; that is, starting with the features in
> the middle of the part and working out to the overall dimensions. **Leader lines are generally
> applied last**, as they have more freedom of location." — B §7-6

Secuencia canónica que el software debe poder ejecutar y auditar:

```
1. Marcas de centro y líneas de centro         ── primero, porque de ahí cuelgan las cotas
   (unir centros alineados con UNA línea de centro para que UNA cota los defina)   B §7-3
2. Cotas de LOCALIZACIÓN de features internos  ── barrenos, ranuras, cortes
3. Cotas de TAMAÑO de esos features            ── Ø, R, ancho
4. Cotas intermedias
5. Cotas GENERALES (overall)                   ── SIEMPRE las más lejanas          B §7-11 r.7
6. Leaders y notas de barreno (Hole Callout)   ── al final                         B §7-6
7. Radios repetidos por NOTA global            ── "R.25 TYP" / "R- 4 CORNERS"      B §7-12, §7-6
```

### 1.3.2 Desde qué referencias — los tres esquemas

| Esquema | Cómo | Cuándo el cliente lo usa | § |
|---|---|---|---|
| **Cadena (chain)** | cada feature respecto al siguiente | cuando **la distancia entre features importa más** que su distancia al borde (patrón de barrenos que debe casar con otra pieza) | B §8-10 |
| **Baseline** | todas desde una misma línea base / datum | por defecto. "Baseline dimensions eliminate tolerance buildup and can be related directly to the reference axis of many machines" | B §7-10, §8-10 |
| **Ordenada** | coordenadas X/Y desde un origen, sin líneas de cota ni flechas | "particularly useful when dimensioning an object that includes **many small holes**" | B §7-9 |
| **Tabla de barrenos** | tags + tabla | "parts that have **large numbers of holes** where standard dimensioning may be cluttered" | B §7-10 |

**El número que zanja la discusión (B §8-10, Fig 8-16):** la misma pieza, mismas tolerancias de
2 mm por cota. Superficie A resulta máx **28 mm en cadena** y **27 mm en baseline**. Acumulado total:
**6 mm cadena vs 4 mm baseline.** "So why not always use baseline dimensions? For most applications,
the baseline system is probably better, **but if the distance between the individual features is
more critical than the distance from the feature to the baseline, use the chain system.**"

**Y se combinan:** "Chain and baseline dimensions may be used together" — el centro del grupo
repetitivo se acota desde el borde (baseline) y adentro del grupo se encadena (B §8-10).

### 1.3.3 Qué se acota en QUÉ vista

Del ejemplo trabajado en B §7-22 (Fig 7-70), tres vistas:

- Barrenos → **vista superior** (donde son círculos).
- Ranura → **vista superior** (ahí se ve en contorno).
- Superficie inclinada → **vista frontal** (ahí se ve inclinada).
- Altura de la superficie A → **vista lateral**, "rather than run along extension lines across the
  front view" — es decir: se elige la vista que **evita líneas de extensión largas**.
- Largo de la superficie A → **vista frontal**, que es su vista de contorno.

Y el cierre: "It is considered good practice to **keep dimensions in groups**. This makes it easier
for the viewer to find dimensions."

---

# 2. REGLAS PRESCRIPTIVAS EN PROSA

Todo lo que sigue es cita o paráfrasis cerrada de "should / must / never / avoid / rule / poor
practice". Cada renglón está redactado para ser **implementable como check**.

## 2.1 Las cuatro cajas "Rule" del libro (son las únicas cuatro, y valen doble)

| # | Regla textual | § |
|---|---|---|
| R1 | "Keep dimension lines **aligned and evenly spaced**." | B §7-3 |
| R2 | "**Never locate dimensions on the surface of the part.**" | B §7-3 |
| R3 | "**Never squeeze dimension values.** Dimension values should always be presented clearly and legible." | B §7-3 |
| R4 | "**Never dimension the same distance twice.** This is called double dimensioning." | B §7-3 |

## 2.2 Las ocho reglas de COLOCACIÓN (B §7-11, literal)

1. Coloca las cotas **cerca de los features que definen**.
2. **No** coloques cotas **sobre la superficie** del objeto.
3. **Alinea y agrupa** las cotas para que se vean ordenadas y sean fáciles de entender.
4. **Evita cruzar líneas de extensión.** ("Sometimes it is impossible not to cross extension lines
   because of the complex shape of the object, but whenever possible, avoid crossing.")
5. **No cruces líneas de cota.**
6. Coloca las cotas **cortas más cerca** del objeto que las largas.
7. Coloca **siempre las cotas generales lo más lejos** del objeto.
8. **No acotes la misma distancia dos veces.**

## 2.3 Convenciones de trazo de cota (B §7-2)

| Regla | Valor / criterio |
|---|---|
| Separación entre líneas de cota | **uniforme, ≈ 1/2 in ó 15 mm** |
| Distancia mínima del objeto a la primera línea de cota | **≥ 1/2 in ó 15 mm** |
| Hueco objeto ↔ inicio de línea de extensión | **hueco visible obligatorio** ("noticeable gap"), como quiebre visual |
| Línea de centro usada como línea de extensión | **sin hueco** cuando se prolonga más allá de la arista |
| Leader a barreno | la punta de flecha **apunta al centro** del barreno |
| Alineación | alinear líneas de cota siempre que se pueda |
| Prolongación de líneas de centro | "Centerlines **should extend beyond the edges** of the part" (B §7-6) |

## 2.4 Errores comunes a evitar (B §7-2, "Common Errors to Avoid")

- Evita cruzar líneas de extensión: **las cotas largas van más lejos que las cortas.**
- **No pongas cotas dentro de recortes**; usa siempre líneas de extensión.
- **No pongas ninguna cota cerca del objeto** (≥ 15 mm).
- **Evita líneas de extensión largas**: localiza la cota en la misma zona general del feature.

## 2.5 Redundancia y acumulación — el corazón del acotado

**El caso canónico (B §8-9):** pieza acotada 30 + 30 + 30 y además 90 general, tolerancia ±1 mm.

- Por la cadena: 90 ± 3 → **93 máx / 87 mín**
- Por la general: 90 ± 1 → **91 máx / 89 mín**

"The two dimensions are mathematically equal but are **not equal when tolerances are considered**."

**Dos salidas, y elegir cuál es DECISIÓN DE DISEÑO:**

1. **Eliminar una cota** y dejar que esa distancia "flote", absorbiendo la acumulación.
   "The choice of which 30mm dimension to eliminate **depends on the design objectives of the part**."
2. **Volver la general una cota de REFERENCIA**: se escribe entre paréntesis `(90)`. "A reference
   dimension is used only for mathematical convenience. **It is not used during the manufacturing or
   inspection process.**"

Nota complementaria (B §7-6, Fig 7-33): `4 × 20 (= 80)` — el `(= 80)` es referencia, por conveniencia.

Y el criterio funcional para elegir (B §7-14): cuando la distancia entre barrenos importa más que
el largo total, se acota **desde la línea de centro** y **el largo total se vuelve referencia**.

## 2.6 Formas especiales — lo que NO se acota

| Forma | Qué NO se acota | § |
|---|---|---|
| **Ranura interna (slot)** | los radios de los extremos **no llevan valor numérico**: se anota `R- 2 PLACES` y se acota el ANCHO; "it is assumed that the radius of the rounded ends is exactly half of the stated width" | B §7-13 |
| **Extremos redondeados externos** | igual: se indica el radio sin valor, se acota el ancho, el radio se implica = mitad | B §7-14 |
| **Extremos parcialmente redondeados** | se acotan los radios; **el centro se implica en la línea de centro**; la cota general va y **no es referencia** salvo que se den los radios explícitos | B §7-14 |
| **Redondeos y chaflanes uniformes** | no se acotan uno por uno: **una nota global**; solo se acota individualmente el que tenga radio distinto | B §7-12 |
| **Patrón circular uniforme** | una sola cota angular + nota `Ø10 − 4 HOLES` + una sola cota del círculo de pernos; patrón NO uniforme → cada barreno acotado por separado | B §7-8 |
| **Objeto simétrico** | "If an object is symmetrical, **only half the object needs to be dimensioned.** The other dimensions are implied by the symmetry note or symbol." | B §7-19 |
| **Punto de fondo cónico de barreno ciego** | "The conical point is **not included** in the hole's depth dimension." | B §7-6 |
| **Superficie tangente** | no se dibuja línea de tangencia en las vistas ortográficas (§2.9) — y por tanto no se acota | B §4-3 |

**Ojo con la simetría (B §7-19):** el símbolo de simetría y el de línea de centro **no son
intercambiables**. "Use the centerline symbol when a line is a centerline, but **do not use it in
place of the symmetry symbol**." Un objeto puede tener línea de centro y no ser simétrico.

## 2.7 Callouts — el orden es el orden de MANUFACTURA

> "Counterbored holes are dimensioned **in the sequence of their manufacture**. First the hole's
> diameter is given, then the counterbore diameter, then the depth of the counterbore." — B §7-7

Y el caso con rosca: "Convention calls for the note to read in the sequence of manufacture. **The
threaded hole is cut first and then the counterbore is added; therefore, the thread callout should
come before the counterbore callout.**" (B §7-7).

**Esto es un check automático fuerte:** el callout de un barreno compuesto tiene un ORDEN CORRECTO
derivable de la línea de tiempo de features. Si el usuario lo escribe al revés, el software lo sabe.

Otros:
- Barreno pasante: no requiere especificación de profundidad; `THRU` es **opcional** ("Some
  companies require it and some do not") (B §7-3, §7-6).
- Barreno ciego: lleva **símbolo de profundidad + valor** (B §7-6).
- En vista de sección, de tres métodos, "**the single line note version is the preferred method**"
  (B §7-6).
- Roscas: `M10 × 30` (paso grueso implícito), `M10 × 1.25 × 30` (paso explícito porque no es
  estándar); "For metric threads **the pitch is specified, not the number of threads per
  millimeter**" (B §6-3). En pulgadas: `.500-13 UNC-2A × 3.00 LONG`; forma abreviada `.500-13 × 3.00`
  aceptada pero **"not universally accepted. When in doubt, use a complete thread callout"** (B §6-4).

## 2.8 Unidades y notación (B §7-5, §8-3)

| Regla | Milímetros | Pulgadas decimales |
|---|---|---|
| Cero a la izquierda para valores < 1 | (n/a) | **no lleva**: `.50`, no `0.50` |
| Ceros a la derecha | **no requiere**: `32`, no `32.00` | los que definen la precisión |
| Símbolo de unidad en la cota | **nunca**; "the units will be defined in the title block" | **nunca** |
| Tolerancia unilateral con cero | un solo `0` | mismo número de decimales que la cota: `.500 +.005/−.000` |
| Tolerancia bilateral | los dos valores **pueden** tener distinto número de decimales: `32 +0.25/−0.10` | los dos valores **deben** tener el mismo: `32.00 +.25/−.00` |
| Grados, bilateral | mismo número de decimales en cota y tolerancia | igual |
| Grados, unilateral | un solo `0` permitido | igual |

**Texto:** todos los valores se escriben **horizontales**, incluso en cotas verticales y en cotas
alineadas a una superficie inclinada — se llama **acotado unidireccional** (B §7-3, §7-5). "Fonts
for drawings should always be **easy to read and not too stylistic**" (B §7-3).

## 2.9 Tipos de línea y su precedencia

**Precedencia (B §4-3, literal):**

> "A **solid line (object or continuous) takes precedence over a hidden line**, and a **hidden line
> takes precedence over a centerline**."

**Reglas de línea que sí están en el libro:**

| Situación | Regla | § |
|---|---|---|
| Arista bloqueada | línea oculta; **todas las superficies deben mostrarse en todas las vistas** | B §4-3 |
| Arista parcialmente oculta | el tramo oculto con patrón de oculta, el visible sólido, en la MISMA arista | B §4-3 |
| Transición redondeado↔plano | **sin línea de tangencia** en las vistas ortográficas. SolidWorks las dibuja en el isométrico y en el 3D pero **no en las ortográficas** ni en el render | B §4-3 |
| Redondeado sin porción vertical o sin tangencia | **no se dibuja línea** | B §4-3 |
| Objeto que se funde exactamente en el punto más ancho del redondeo | **no se requiere línea** | B §4-3 |
| Vista de sección | **sin líneas ocultas** | B §4-5 |
| Perfil unilateral / runout unilateral | se indica con **línea fantasma** del lado al que aplica la tolerancia | B §8-38, §8-39 |
| Piezas vecinas de referencia | línea fantasma ("Draw the wheels in their relative positions using **phantom lines**") | B P8-19 |

**⟨EXTENSIÓN DECLARADA — espesor de línea⟩** Bethune **no da espesores numéricos de línea**; lo más
cercano es sugerir distinguir tipos por color ("The visual difference between the line types can be
enhanced by using different colors", B §7-2) y en FreeCAD, subir `Line Width` a 0.5 (F, Generating
2D drawings). La convención ISO 128 / ASME Y14.2 de dos grosores (**gruesa ≈ 0.5–0.7 mm para
contorno visible y plano de corte; fina ≈ la mitad para ocultas, ejes, extensión, cota y rayado**)
es la práctica de la industria pero **no proviene de estas fuentes**. Si La Forja la implementa,
debe ir marcada como default configurable, no como "regla del libro".

## 2.10 Secciones — rayado y qué se raya

**Lo que sí dice el cliente:**

| Regla | § |
|---|---|
| "Any material cut when a section view is defined **is hatched using section lines**." | B §4-5 |
| "The general style is **evenly spaced 45° lines**. This style is defined as **ANSI 31** and will be applied automatically." | B §4-5 |
| "Section views **do not include hidden lines**." | B §4-5 |
| "**All surfaces directly visible must be shown** in a section view" — lo que está detrás del plano de corte y se ve, se dibuja | B §4-5 |
| "Section views are **always located behind the arrows**; that is, the arrows point **toward** the section view. Think of the arrows as your eyes looking at the section view." | B §4-6 |
| El plano de corte se nombra `A-A` y la vista `SECTION A-A`; puede haber más de una sección del mismo modelo | B §4-6 |
| Al acotar una sección: "The section lines should be drawn at an angle that allows the viewer to **clearly distinguish between the section lines and the extension lines**." | B §7-21 |
| Sección alineada: el plano quebrado **se gira a vertical antes de proyectar** | B §4-7 |

**⟨EXTENSIÓN DECLARADA — qué NO se secciona⟩** Bethune **no enuncia** la convención de que
tornillos, tuercas, remaches, pasadores, ejes macizos, chavetas, nervaduras (ribs), almas (webs) y
brazos (spokes) **no se rayan** aunque el plano de corte los atraviese. Es convención universal
(ASME Y14.3 / ISO 128) y es **crítica para moldes** (un perno guía o un expulsor seccionado y
rayado hace ilegible el plano). Si La Forja la implementa, debe declararse como extensión y ser
una **lista de tipos exentos** editable, no una regla cableada.

**⟨EXTENSIÓN DECLARADA — rayado por material⟩** Bethune ofrece 5 estilos de display de sección
(B §4-6) pero **no mapea patrón de rayado ↔ material**. La convención de patrón por material
(acero, bronce, aluminio, plástico…) no sale de estas fuentes.

## 2.11 Escalas (B §7-4)

**Formatos válidos, literales:**

```
SCALE: 1 = 1
SCALE: FULL
SCALE: 1000 = 1
SCALE: .25 = 1
```

- Valor izquierdo = factor de escala. **> 1 ⇒ el dibujo es más grande que la pieza. < 1 ⇒ más chico.**
- **"Regardless of the drawing scale selected, the dimension values must be TRUE SIZE."** La misma
  pieza a 1=1 y a 2=1 lleva la MISMA cota `3.00`.
- La vista de detalle puede tener **escala propia** distinta a la de la hoja (B §4-9).
- **Por qué importa:** la nota `DO NOT SCALE DRAWING` del bloque de aplicación es "a reminder not to
  measure the views on the drawing. If a dimension is missing, **do not measure the distance on the
  drawing**, because the drawing may not have been reproduced at the exact 100% scale of the
  original." (B §5-12).

## 2.12 Hoja, bloques y notas del plano

**Tamaños de hoja (B §4-4):** pulgadas → A = 8.5 × 11 in (y B, C… en el listado de Fig 4-28);
métrico → **A4 = 210 × 297 mm** (y A3). El libro pide en sus proyectos: "Create all drawings using
either an **A4 or A3** drawing sheet, as needed. **Include a title block on all drawing sheets.**"

**Los cinco bloques de la plantilla (B §4-4, §5-12):**

| Bloque | Contenido | Regla |
|---|---|---|
| **Cajetín (title block)** | nombre de la empresa, nombre del dibujo, **número de parte**, **escala**, **letra de revisión** | "The information presented in a title block varies from company to company but usually includes…" |
| **Bloque de liberación (release)** | `DRAWN` (dibujante, iniciales+fecha) → `CHECKED` (revisor, firma+fecha) | documenta el proceso de liberación de un **documento legal** |
| **Bloque de tolerancias** | tolerancias generales por número de decimales | ver §2.13 |
| **Bloque de aplicación** | dibujos relacionados donde se usa esta pieza ("used on ME-312A, EK131-46") — "makes it easier to access related drawings that can be checked for interfaces" | |
| **Nota fija** | `DO NOT SCALE DRAWING` | |

**Trampa que el software debe evitar:** "SolidWorks automatically enters the **file name** of the
document as the part number… The title block will have to be edited and the **correct part number
entered**." (B §5-12). **Nombre de archivo ≠ número de parte.** Un plano cuyo número de parte es el
nombre del archivo está mal.

**Letras de revisión:** "As a drawing goes through its production cycle, changes are sometimes
made… As the changes are incorporated into the drawing, **a new revision letter is added**"
(B §5-12).

## 2.13 Tolerancias generales — el bloque que hace que el plano cierre

> "Most manufacturers establish a set of standard tolerances that are applied to **any dimension
> that does not include a specific tolerance**… Standard tolerances are usually listed **on the first
> page of a drawing to the left of the title block**, but this location may vary." — B §8-8

**Cómo se leen (literal, B §8-8):** "The `X` value used when specifying standard tolerances means
**any X stated in that format**. A dimension value of 52.00 would have an implied tolerance of ±.01
because the stated standard tolerance is `.XX ± .01`. Thus, **any dimension value with two decimal
places has a standard implied tolerance of ±.01**. A dimension value of 52.000 would have an
implied tolerance of ±.001."

**Consecuencia de software:** *el número de decimales con que se escribe una cota SELECCIONA su
tolerancia*. Escribir `52.000` en vez de `52.00` multiplica el costo por 10 sin que nadie lo note.
El editor de cotas debe mostrar, junto al valor, **la tolerancia implícita que acaba de heredar**.

---

# 3. GD&T COMO LENGUAJE

## 3.1 Qué es y por qué existe

> "Geometric tolerancing is a dimensioning and tolerancing system **based on the geometric shape of
> an object**… Geometric tolerances allow a **more exact definition** of the shape of an object than do
> conventional coordinate-type tolerances. Objects can be toleranced in a manner **more closely
> related to their design function**, or so that their features and surfaces are more directly
> related to each other." — B §8-25

## 3.2 El vocabulario — las características

Las que el cliente enseña, por familia (B §8-26 … §8-40):

| Familia | Característica | Necesita datum | Qué controla |
|---|---|---|---|
| **Forma** (§8-26) | Planitud (flatness) | **NO** | variación de una superficie plana respecto a sí misma; zona = dos planos paralelos |
| | Rectitud (straightness) | **NO** | variación a lo largo de **una línea** en una dirección; o del eje si se aplica a la línea de centro |
| | Circularidad / redondez | **NO** | variación en **cada sección transversal** individual; no relaciona secciones entre sí |
| | Cilindricidad | **NO** | zona entre **dos cilindros concéntricos**: sección Y longitud a la vez |
| **Orientación** (§8-34) | Perpendicularidad | **SÍ** | zona entre dos planos perpendiculares al datum |
| | Paralelismo | **SÍ** | zona entre dos planos paralelos al datum |
| | Angularidad | **SÍ** | zona a un ángulo respecto al datum |
| **Perfil** (§8-38) | Perfil de superficie | sí/no | toda la superficie irregular entre dos superficies envolventes |
| | Perfil de línea | sí/no | una sola línea a través de la superficie |
| **Runout** (§8-39) | Runout circular | **SÍ (eje)** | indicador FIJO mientras la pieza gira |
| | Runout total | **SÍ (eje)** | indicador que **se mueve** sobre la superficie que gira |
| **Localización** (§8-40) | **Posición** | **SÍ** | zona **CILÍNDRICA** para el centro de un barreno |

**Analogías que el cliente usa para enseñar (y que el software debería usar en su UI):**

- Planitud : rectitud :: cilindricidad : circularidad. Las primeras de cada par cubren **toda la
  superficie**; las segundas, **una sola línea o un solo corte** (B §8-31).
- Perfil de superficie : perfil de línea :: planitud : rectitud (B §8-38).
- Planitud vs paralelismo: "flatness applies only **within** the surface… **Parallelism defines every
  point in the surface relative to ANOTHER surface**." (B §8-34).

**⚠️ MUERTAS en ASME Y14.5-2018 (M, láminas "Significant Changes", A-8.4):**

> "**Concentricity and symmetry tolerances have been removed** (term, symbol, and concept)."
> Por qué: "*Eliminate the confusion that surrounds these symbols and their misapplication.*"
> "Many organizations had **banned** the use of these tolerances decades ago."
> Sustitutos: "**Position and runout are better options** for controlling location of coaxial features."

**Un software que nace en 2026 y ofrece concentricidad y simetría nace viejo.** No las implementes.

## 3.3 El marco de control (feature control frame)

Estructura, tal como el cliente la construye paso a paso en SolidWorks (B §8-33, §8-41):

```
┌────┬───────────────┬─────┬─────┬─────┐
│ ⌖  │  Ø 0.05  (M)  │  A  │  B  │  C  │
└────┴───────────────┴─────┴─────┴─────┘
  │         │    │      └─────┴─────┴── datums: primario, secundario, terciario (EN ORDEN)
  │         │    └── modificador de condición de material: (M)=MMC, (L)=LMC, nada=RFS
  │         └── valor de tolerancia, precedido de Ø si la zona es cilíndrica
  └── símbolo de la característica
```

Orden de armado en la UI del cliente (B §8-41): **símbolo → tolerancia → símbolo Ø → condición de
material → datums → Done → colocar**. La lectura resultante, en palabras del propio libro: *"Apply a
.001 positional tolerance about the hole's centerpoint at the maximum material condition."*

Tres formas de colgarlo (B §8-32, Fig 8-62): sobre una **línea de extensión**, con **leader** a la
superficie, o **debajo de la cota del feature** (`No Leader` + colocación manual).

### 3.3.1 ⭐ El símbolo Ø dentro del marco NO es decorativo

> "**The inclusion of the Ø symbol in a geometric tolerance is CRITICAL to its interpretation.**
> If the Ø symbol is not included, **the tolerance applies only to the view in which it is written**.
> This means that the tolerance zone is shaped like **a rectangular slice, not a cylinder**, as would
> be the case if the Ø symbol were included. In general it is better to **always include the Ø symbol
> for cylindrical features** because it generates a tolerance zone more like that used in positional
> tolerancing." — B §8-35

Un carácter cambia la zona de rebanada plana a cilindro. **El software debe advertir cuando se
aplica una tolerancia geométrica a un feature cilíndrico sin Ø.**

## 3.4 Datums — cómo se eligen y por qué en ese orden

### 3.4.1 Qué es

> "A datum is a **point, axis, or surface** used as a **starting reference point** for dimensions and
> tolerances." — B §8-33

Tres planos etiquetados **A, B, C = primario, secundario, terciario**, y "The three datum planes
are, **by definition, exactly 90° to one another**." (B §8-33). Para piezas cilíndricas existe el
**marco de datum cilíndrico**: dos planos X e Y perpendiculares entre sí, y el plano base A
perpendicular al eje que forman (B §8-33, Fig 8-66).

### 3.4.2 Las reglas duras de elección — las que un software puede verificar

| # | Regla | Fuente |
|---|---|---|
| DT1 | **El datum debe ser una superficie real de la pieza, no una construcción imaginaria.** "It is considered **poor practice to use a centerline as a baseline**. Centerlines are **imaginary lines that do not exist on the object** and would make it **more difficult to manufacture and inspect** the finished objects." | B §7-15 |
| DT2 | **El datum debe ser razonablemente plano.** "Datum planes are **assumed to be perfectly flat**. When assigning a datum status to a surface, **be sure that the surface is reasonably flat**." | B §8-33 |
| DT3 | **El datum debe llevar acabado superficial controlado.** "**Datum surfaces should be toleranced using surface finishes** or created using machine techniques that produce flat surfaces." Y el número: "**A 0.8-μm surface finish is generally considered the minimum acceptable finish for datums.**" | B §8-33, §8-22 |
| DT4 | **El datum debe llevar además su propio control de FORMA.** El acabado no basta: "The surface finish value of 16 defines the **smoothness** of the surface **but not the straightness**. Think of surface finish as **waves**, and straightness as an **angle**." → al datum A se le agrega su rectitud/planitud. | B §8-33 |
| DT5 | **El datum debe ser funcional y MEDIBLE en la práctica**, y hay que verificar que el inspector mida el correcto. Caso real: el inspector midió la superficie B en lugar del datum A y dijo "so what". Pasó por casualidad (tolerancia grande de 0.4 mm), pero **el plano no lo impidió**. | M, "The inspector who said so what" |
| DT6 | **Un datum puede ser un PATRÓN de features (p. ej. dos barrenos juntos)** — y entonces "the bonus is quite complicated… **bonus tolerance from Datum B must be SHARED**". Patrones, requisitos simultáneos y datums de features "**can create measurement challenges**". | M, "And sometimes measurement is a real challenge" |
| DT7 | **El orden A-B-C es el orden en que la pieza se asienta.** Bethune lo llama primario / secundario / terciario (B §8-33) pero **no redacta la regla 3-2-1** de puntos de contacto. **⟨EXTENSIÓN DECLARADA⟩** — el criterio "el primario asienta 3 puntos, el secundario 2, el terciario 1, y se elige por cómo la pieza se monta y funciona en el ensamble" es ASME Y14.5 y práctica de industria; **no sale de estas fuentes**. |

### 3.4.3 Regla de convivencia con las cotas de localización

> "Orientation tolerances are used **with** locational tolerances. A feature is **first located, then
> it is oriented within the locational tolerances**. This means that **the orientation tolerance must
> always be LESS than the locational tolerances**." — B §8-34

Y el ejemplo de por qué (B §8-35): con `40 ± 1` de localización, poner perpendicularidad de 1.5 es
inútil — "The locational tolerance would prevent the variation from ever reaching the limits
specified by such a large perpendicularity tolerance." **Un marco de control con tolerancia ≥ la
tolerancia de localización de la misma superficie es LETRA MUERTA. Check automático.**

## 3.5 Condiciones de material: RFS, MMC — y el bonus

### 3.5.1 Definiciones (B §8-29)

- **RFS (regardless of feature size)** — la tolerancia geométrica se aplica **igual** a cualquier
  tamaño del feature. **"RFS condition applies if no material condition is specified."** Es el
  DEFAULT.
- **MMC (maximum material condition)** — la tolerancia se aplica **solo en la condición de máximo
  material**, y luego "**allows the tolerance zone to GROW**" conforme el feature se aleja del MMC.
  - **Eje / feature externo:** MMC = **diámetro máximo**.
  - **Barreno / feature interno:** MMC = **diámetro mínimo**.

### 3.5.2 El bonus, con el número del libro (B §8-29, Fig 8-56)

Cilindro `Ø20 ±1` (19 a 21) con rectitud `0.05 (M)`:

```
Condición virtual = MMC + tol. geométrica = 21 + 0.05 = 21.05   (constante, siempre)

Ø real = 21 (MMC)  → zona = 21.05 − 21 = 0.05   ← solo la tolerancia especificada
Ø real = 20        → zona = 21.05 − 20 = 1.05   ← bonus de 1.00
Ø real = 19 (LMC)  → zona = 21.05 − 19 = 2.05   ← bonus de 2.00 (tol. de tamaño + tol. geométrica)
```

> "In all variations **the virtual size remains the same**, so at any given cylinder diameter value,
> the size of the tolerance zone can be determined by **subtracting the cylinder's diameter value
> from the virtual condition**."

**Fórmula implementable directa:** `zona(d) = |condición_virtual − d|`.

### 3.5.3 Condición virtual (B §8-42)

| | Fórmula | Ejemplo del libro |
|---|---|---|
| Feature **externo** (eje) | `VC = MMC + tol. geométrica` | 25.5 + 0.3 = **25.8** |
| Feature **interno** (barreno) | `VC = MMC − tol. geométrica` | 24.5 − 0.3 = **24.2** |

Caso extremo: tolerancia `0.000 (M)` significa "the shaft would have to be **perfectly straight at
MMC**… A 0.000 tolerance means that **the MMC and the virtual conditions are equal**" — pero la zona
sigue creciendo conforme el tamaño se aleja del MMC (B §8-29).

### 3.5.4 Cuándo NO usar MMC — el juicio humano

> "This does **not** mean that straightness tolerances should always be applied at MMC. **If
> straightness is critical to the design integrity or function of the part, then straightness should
> be applied in the RFS condition.**" — B §8-29

Y la restricción dura: a **circularidad NO se le puede aplicar MMC**. "It also means that
qualifications such as MMC **cannot be applied**" — porque la circularidad se mide en cortes
individuales y no relaciona secciones (B §8-30).

**⟨EXTENSIÓN DECLARADA — LMC⟩** Bethune trata RFS y MMC. **LMC (least material condition) no
aparece desarrollada** en los capítulos leídos. Si se implementa (`Ⓛ`), debe declararse como
extensión: su uso típico es garantizar **espesor mínimo de pared** o distancia mínima al borde, no
el ensamble.

### 3.5.5 Calificador de longitud (B §8-29)

`0.002/1.000` en un eje largo: "the total straightness may vary over the **entire length** by .003
but the variation is limited to **.002 per 1.000 of shaft length**" — limita la ondulación local
además de la global. Es un segundo par de valores en el marco, no un valor suelto.

## 3.6 Posición — el argumento completo de por qué GD&T gana

### 3.6.1 La zona rectangular es un defecto de las cotas ±

> "**Linear tolerances generate a square or rectangular tolerance zone.**" — B §8-13, nota
>
> "Positional tolerances create a **circular tolerance zone** for hole centerpoint locations, in
> contrast with the rectangular tolerance zone created by linear coordinate dimensions. …Note how
> **some of the possible hole centerpoints fall in an area outside the rectangular tolerance zone but
> are still within the circular tolerance zone.** If the hole had been located using linear
> coordinate dimensions, centerpoints located beyond the rectangular tolerance zone **would have been
> rejected as beyond tolerance, and yet holes produced using these locations would FUNCTION CORRECTLY
> from a design standpoint**. …**The finished hole is round, so a round tolerance zone is appropriate.
> The rectangular tolerance zone rejects some holes unnecessarily.**" — B §8-40

**Traducción de negocio para el taller LATAM:** acotar barrenos con ± tira a la basura piezas buenas.
La zona circular circunscrita a la rectangular es **≈57% más grande en área** (círculo de diámetro
igual a la diagonal vs el rectángulo). Es dinero.

### 3.6.2 Cotas BÁSICAS son obligatorias con posición

> "The locating dimensions are enclosed in **rectangular boxes** and are called **BASIC dimensions**.
> **Basic dimensions are assumed to be exact.**" — B §8-40
>
> "**Geometric positional tolerances MUST include basic dimensions.** Basic dimensions are assumed to
> be perfect. **The locational tolerance associated with locating dimensions has been MOVED to the
> geometric positional tolerance.**" — B §8-41, caja *Tip*

**Y el efecto colateral que resuelve el problema de la §2.5:**

> "Because **basic dimensions are exact, they do NOT have tolerances that accumulate; that is, there
> is NO TOLERANCE BUILDUP**." — B §8-40

**Tres checks automáticos duros salen de aquí:**
1. Si hay un marco de posición ⌖, las cotas que localizan ese feature **deben ser básicas** (en caja).
2. Una cota básica **no puede llevar ±** ni tolerancia general implícita.
3. Cotas básicas en cadena **no violan** la regla de doble acotado por acumulación (pero siguen sin
   poder duplicar la misma distancia).

### 3.6.3 Las fórmulas de ensamble — todas implementables

**Con cotas lineales (zona rectangular) — B §8-14:**
```
DTZ = √(tolX_total² + tolY_total²)      ← diagonal de la zona rectangular
Smax = Hmin − DTZ                        ← eje máximo que SIEMPRE entra
```
Ejemplo del libro: DTZ = √(.4² + .6²) = .72 ; Smax = 11.95 − .72 = **11.23**.

**Con tolerancia posicional — sujetador FLOTANTE (pasa libre por las dos piezas) — B §8-43:**
```
H − T = F        H = barreno en MMC, T = tol. posicional, F = perno en MMC
```
Ejemplo: 11.97 − .02 = **11.95**. Inverso: `H = F + T` (B §8-44): .260 + .030 = **.290**.

**Con tolerancia posicional — sujetador FIJO (roscado o prensado en una de las piezas) — B §8-46:**
```
H − 2T = F       "The tolerance zone is CUT IN HALF for each part."
```
Ejemplo: H = .260 + 2(.030) = **.320**. O al revés: 11.97 − 11.95 = 2T ⇒ T = **.01**, la mitad del
flotante.

**Y su equivalente con zonas rectangulares (condición fija) — B §8-24:**
```
Smax + DTSZ = Hmin − DTZ      ; si ambas zonas son iguales →  Smax = Hmin − 2·DTZ
```

**Comparación numérica que el libro hace explícita (B §8-48):** misma pieza, 50 nominal entre
centros, Ø20 nominal, .03 de diagonal/tolerancia.
- Rectangular: distancia mínima entre centros **49.98**, máxima **50.02**.
- Posicional: mínima **49.97**, máxima **50.03**.
- "The size of the **circular tolerance zone is LARGER** because the hole tolerances are assigned at
  MMC… As the hole's feature tolerance increases from 20.00 to 20.02, the size of the tolerance zone
  increases."

## 3.7 ⭐ CUÁNDO GD&T ES OBLIGATORIO EN VEZ DE ±

Esta es la sección que decide el subconjunto mínimo. Las razones, ordenadas por fuerza.

### 3.7.1 La regla del calibrador (la más operable de todas)

> "**Only use plus/minus tolerances for SIZE on features that you can GRAB with the outside or inside
> jaws of a caliper.**" — M, lámina "Good Practice to Eliminate Ambiguity"

Un vernier agarra: un diámetro externo, un diámetro interno, un espesor entre dos caras paralelas,
un ancho de ranura. **Todo lo demás — posición, orientación, forma, perfil, runout — no lo agarra un
vernier, y por lo tanto el ± ahí es ambiguo.**

Esta sola regla es un **check automático de primera clase**: por cada cota ± del plano, preguntar
"¿es una distancia entre dos caras opuestas del mismo feature de tamaño?". Si no, marcarla.

### 3.7.2 Porque el ± no controla la FORMA

> Pieza `30 ± 0.5`: "Without additional tolerances the surface could look like **a series of waves**
> varying between 30.5 and 29.5." — B §8-27

Con planitud 0.3 la altura sigue variando 30±0.5 **pero la cara no puede ondular más de 0.3**. Son
controles **independientes y acumulables**, no alternativas.

Aplicaciones concretas donde se vuelve obligatorio (B §8-21, §8-28):
- **Superficies de datum** → si el datum ondula, todas las medidas que cuelgan de él mienten.
- **Superficies de apoyo / rodamiento** → la Fig 8-34 muestra un tornillo apoyado en dos crestas de
  onda: "the entire bearing load is concentrated on the two peaks. This situation could cause
  **stress cracks and greatly weaken the surface**."
- **Superficies en movimiento relativo** → "excess wear to both surfaces because the surfaces touch
  only on the peaks… **Excess vibration** can also result."
- **Ejes y piezas que casan** → rectitud "to help ensure that the parts are **not barreled or warped**
  within the given feature tolerance range and, therefore, do not fit together well."

### 3.7.3 Porque la zona de posición debe ser REDONDA

Ver §3.6.1. Todo barreno cuyo propósito es **recibir un sujetador o un perno de ensamble** debe ir
con ⌖ posición + cotas básicas, no con ±X ±Y. El ± ahí rechaza piezas funcionales.

### 3.7.4 Porque el ± no controla la ORIENTACIÓN

`40 ± 1` "controls the location of the edge — how far away or how close it can be to the left edge —
**but does not directly control the SHAPE of the edge. Any shape that falls within the specified
tolerance range is acceptable.**" (B §8-35). Si se requiere una cara escuadrada, hay que decirlo con
⊥.

### 3.7.5 Porque el ± acumula y el básico no

Ver §3.6.2. Cuando hay 3+ features en línea que deben casar con otra pieza, el ± en cadena mata el
ensamble; las cotas básicas + posición no acumulan.

### 3.7.6 Porque el ± en RADIOS es ambiguo (Y14.5-2018, cambio 5.16)

> "Ambiguous, R ≠ ½D. **Tolerance zone tapers to zero.** Measurement repeatability problems due to
> ambiguity." — M, "Poor definition: Y14.5-2009 radius"
>
> "a radius tolerance really creates a **nonuniform profile tolerance with a zone that tapers to zero
> at the ends**. But that sort of sucks, so we generally ignore it." — M
>
> Cambio de 2018: "**When the center of the radius is located via dimension(s), the arcs are
> concentric.**" — y "If the center is dimensioned, the radius tolerance creates **an entirely
> different profile tolerance zone**." — M

**Regla operable:** si el radio es crítico, **usa perfil (⌓) en vez de R ± tol** — la propia
lámina M lo propone ("Replace +/- radius with profile?", citando ISO 14405-2). Y si La Forja acota
el centro de un arco, debe saber que **acaba de cambiar el significado de la tolerancia del radio**.

### 3.7.7 Por qué el software NO puede decidirlo solo

> "The size and location of a tolerance depend on **the design objectives of the object, how it will
> be manufactured, and how it will be inspected**. Even objects that have similar shapes may be
> dimensioned and toleranced very differently." — B §8-9

**El software propone; el ingeniero decide. Nunca al revés.**

## 3.8 Lo que GD&T NO resuelve — la advertencia de metrología

Esto lo trae la fuente **M** y es lo que separa un software que "pone símbolos" de uno que sirve:

| Advertencia | Cita |
|---|---|
| **Y14.5 no es una norma de medición.** "This document is not intended as a gaging standard." Define **zonas de tolerancia únicamente**; "reporting any measured value **requires assumptions beyond the standard**." | M |
| **Divergencia de métodos.** El mismo círculo da resultados distintos según el ajuste: mínimos cuadrados, zona mínima, máximo inscrito, mínimo circunscrito. "Different experts may argue one method or another is 'correct'." En 1988 una alerta GIDEP **detuvo el uso de CMM para GD&T** en algunas industrias porque el paralelismo se reportaba **sin** el error de forma. | M |
| **El filtrado cambia el número.** La misma medición de redondez: 15 UPR → 52 µm, 50 UPR → 60 µm, 500 UPR → 79 µm. "Does Y14.5 give the designer the necessary tools?" | M |
| **Cambiar de instrumento reprueba piezas buenas.** Caso: planitud del datum A medida con puntos de contacto; al introducir interferometría "suddenly **good parts failed**". | M |
| **A veces el plano copia el proceso, no la función.** "In some cases, the drawing simply attempts to capture the functional manufacturing and measurement process. **Which came first — a functional part or the drawing?**" | M |

**Los tres cambios de Y14.5-2018 que un motor nuevo debe respetar desde el día 1 (M):**

1. **4.1 (q)** — "the **as-designed dimension value does NOT establish a functional or manufacturing
   target**." Ejemplo de la lámina: con `32 +0.02/−0.00`, el 32 **no** es el objetivo; **32.01, el
   centro de la zona, sería la 'mejor' pieza**. → La UI **no debe** presentar el nominal como target.
2. **4.1 (s)** — "elements of a surface **include surface texture and flaws (e.g. burrs and
   scratches)**. **All** elements of a surface shall be within the applicable specified tolerance zone
   boundaries." → tamaño ⊃ forma ⊃ rugosidad son **anidados**, no independientes (la lámina lo dibuja
   como `14 ±0.05` conteniendo la forma, conteniendo la rugosidad 0.8).
3. **A-8.4** — concentricidad y simetría **eliminadas**.

## 3.9 ASME vs ISO — no son intercambiables

| Punto | Cita |
|---|---|
| Foster (1994): "90 to 95% agreement between ASME and ISO"; Krulikowski (2010): "**about 65% of the possible tolerances are either specified or interpreted DIFFERENTLY**". "Though so much 'looks the same', the difference in fundamental design principles **continues to grow every year**." | M |
| **Tolerancia de tamaño:** en ASME Y14.5 controla el **actual mating size Y el local size**; en ISO 1101 controla **solo el 2-point size**, salvo que se ponga el símbolo de envolvente **Ⓔ**. | M |
| **Concentricidad:** ISO controla el **eje**; ASME controla **puntos medios opuestos**. Y "many commercially available measurement softwares use ISO 1101 terms but evaluate concentricity like a **Y14.5 position** tolerance??" | M |

**Obligación de software:** el plano debe declarar **cuál norma usa**, y el motor debe cambiar de
semántica con ella, no solo de glifo. "**You need to know which standard you are using.**" (M).

---

# 4. CRITERIOS DE ACEPTACIÓN — LA CHECKLIST DEL PLANO COMPLETO

Esto es lo que el cliente corre antes de soltar el plano al taller. Cada renglón trae su § y su
**verificabilidad**: 🟢 = automatizable hoy con la geometría que ya tenemos; 🟡 = automatizable con
heurística (falso positivo posible, requiere revisión humana); 🔴 = juicio humano puro.

## 4.1 Bloque A — COMPLETITUD GEOMÉTRICA

| # | Check | § | |
|---|---|---|---|
| A1 | Toda arista/superficie del modelo aparece en **alguna** vista (visible u oculta). "All surfaces must be shown in all views." | B §4-3 | 🟢 |
| A2 | Cada feature del árbol (barreno, ranura, corte, redondeo, chaflán, rosca) tiene **al menos una cota de TAMAÑO** en el plano | B §7-6 | 🟢 |
| A3 | Cada feature tiene **cotas de LOCALIZACIÓN suficientes** (2 en el plano de la cara, o básicas + ⌖) | B §7-6, §8-40 | 🟢 |
| A4 | La pieza tiene sus **tres cotas generales** (largo × ancho × alto) o justificación de por qué no (pieza de espesor uniforme + nota) | B §7-11 r.7, §4-1 | 🟢 |
| A5 | **Ninguna distancia está acotada dos veces** (doble acotado) — o la duplicada está entre paréntesis como REFERENCIA | B §7-11 r.8, §8-9 | 🟢 |
| A6 | Cada cadena de cotas cierra: Σ(parciales) = general, **o** falta exactamente una parcial (la que flota) | B §8-9 | 🟢 |
| A7 | Barrenos alineados comparten **una** línea de centro y **una sola** cota los localiza en ese eje | B §7-3 | 🟢 |
| A8 | Patrón uniforme: acotado con nota `n × Ø…` y una sola cota angular / de círculo de pernos; patrón NO uniforme: cada elemento acotado | B §7-8 | 🟡 |
| A9 | Ranuras y extremos redondeados: ancho acotado + `R- n PLACES` **sin valor** | B §7-13, §7-14 | 🟡 |
| A10 | Redondeos/chaflanes uniformes cubiertos por **nota global**; los distintos, acotados individualmente | B §7-12 | 🟢 |
| A11 | Pieza simétrica: media pieza acotada + símbolo/nota de simetría (no la línea de centro sola) | B §7-19 | 🔴 |

## 4.2 Bloque B — CORRECCIÓN DE COLOCACIÓN

| # | Check | § | |
|---|---|---|---|
| B1 | **Ninguna cota cae sobre la superficie de la pieza** | B §7-3 (R2), §7-11 r.2 | 🟢 |
| B2 | Ninguna cota está dentro de un recorte | B §7-2 | 🟢 |
| B3 | Toda línea de cota está a **≥ 15 mm (0.5 in)** del borde de la pieza | B §7-2, §7-11 | 🟢 |
| B4 | Separación entre líneas de cota paralelas **uniforme ≈ 15 mm** | B §7-2 (R1) | 🟢 |
| B5 | **Cotas cortas más cerca**, largas más lejos, **generales las más lejanas** | B §7-11 r.6-7 | 🟢 |
| B6 | **Cero líneas de cota cruzadas** | B §7-11 r.5 | 🟢 |
| B7 | Líneas de extensión cruzadas: **cero, o justificadas** por la complejidad de la forma | B §7-11 r.4 | 🟡 |
| B8 | Ningún texto de cota **apretado** entre sus líneas de extensión (si no cabe, sale afuera) | B §7-3 (R3) | 🟢 |
| B9 | Ningún texto de cota **traslapa** otro texto, una línea de cota, una arista o un rayado | B §7-3 | 🟢 |
| B10 | Hay hueco visible entre la arista y el inicio de cada línea de extensión; **no** lo hay cuando la extensión es una línea de centro | B §7-2 | 🟢 |
| B11 | Todo texto de cota es **horizontal** (unidireccional), incluidos verticales y alineados | B §7-3, §7-5 | 🟢 |
| B12 | Flechas de leader de barreno **apuntan al centro** del barreno | B §7-2 | 🟢 |
| B13 | Líneas de centro **sobresalen** del borde de la pieza | B §7-6 | 🟢 |
| B14 | Cotas **agrupadas** por zona / por feature | B §7-22 | 🟡 |

## 4.3 Bloque C — VISTAS

| # | Check | § | |
|---|---|---|---|
| C1 | Las vistas están **alineadas y proyectadas** correctamente (vertical frontal↔superior, horizontal frontal↔lateral) | B §4-3 | 🟢 |
| C2 | El plano declara **primer o tercer ángulo** y lleva el **símbolo de proyección** | B §4-1 | 🟢 |
| C3 | El plano tiene **3 vistas**, o **menos con justificación** (espesor uniforme) | B §4-1 | 🟡 |
| C4 | Cada cota está en la **vista de contorno** de su feature (barrenos en su vista circular) | B §7-22 | 🟡 |
| C5 | Toda superficie inclinada que necesita forma verdadera tiene **vista auxiliar** | B §4-10 | 🟡 |
| C6 | Toda vista de sección: **cero líneas ocultas**, todo lo visible detrás del corte dibujado, rayado ANSI 31 a 45° uniforme | B §4-5 | 🟢 |
| C7 | Las flechas del plano de corte **apuntan hacia** la vista de sección, y el rótulo casa (`A-A` ↔ `SECTION A-A`) | B §4-6 | 🟢 |
| C8 | El ángulo del rayado **no se confunde** con las líneas de extensión de la sección acotada | B §7-21 | 🟡 |
| C9 | Vista de detalle: círculo delimitador + letra + **su propia escala rotulada** | B §4-9 | 🟢 |
| C10 | Vista de rotura: solo donde la sección transversal es **constante** | B §4-8 | 🟡 |
| C11 | **Cero líneas de tangencia** en las vistas ortográficas | B §4-3 | 🟢 |
| C12 | Precedencia respetada: sólida > oculta > eje | B §4-3 | 🟢 |
| C13 | Todo feature interno importante que no se ve queda expuesto por una sección | B §4-5 | 🔴 |

## 4.4 Bloque D — TOLERANCIAS

| # | Check | § | |
|---|---|---|---|
| D1 | El plano tiene **bloque de tolerancias generales** (por número de decimales) | B §8-8 | 🟢 |
| D2 | Toda cota cae bajo una tolerancia: explícita o cubierta por el bloque general | B §8-1 | 🟢 |
| D3 | Formato ± correcto por unidad: mm sin cero a la izquierda innecesario; pulgadas **mismo n.º de decimales** en cota y en las dos ramas de la tolerancia bilateral | B §8-3 | 🟢 |
| D4 | Cero unilateral: `0` en mm, `.000` en pulgadas con el mismo n.º de decimales | B §8-3 | 🟢 |
| D5 | **Ninguna cota lleva símbolo de unidad**; la unidad está en el cajetín | B §7-5 | 🟢 |
| D6 | El n.º de decimales de cada cota es **deliberado** (selecciona su tolerancia implícita y su precio) | B §7-5, §8-8 | 🟡 |
| D7 | El **estudio de tolerancias** de las distancias no acotadas (que "flotan") está hecho: máx/mín calculados | B §8-11 | 🟢 |
| D8 | Los ajustes eje/barreno usan **notación estándar** (`H7/g6`, `LC5`) y valores de tabla; hueco primero en MAYÚSCULA, eje después en minúscula | B §8-18, §9-6 | 🟢 |
| D9 | Se usaron **tamaños preferidos**. "A 42mm diameter hole is not a preferred size… It would be wise to reconsider the design to see if a 40mm diameter hole could be used." | B §8-20 | 🟡 |
| D10 | Superficies de datum llevan **acabado especificado ≤ 0.8 µm** | B §8-22, §8-33 | 🟢 |
| D11 | Superficies de apoyo, rodamiento y de contacto en movimiento llevan acabado especificado | B §8-21 | 🔴 |

## 4.5 Bloque E — GD&T (si hay marcos de control)

| # | Check | § | |
|---|---|---|---|
| E1 | Todo datum referenciado en un marco **está definido** en el plano con su símbolo de datum | B §8-33 | 🟢 |
| E2 | Todo datum definido **se usa** en al menos un marco (si no, sobra) | B §8-33 | 🟢 |
| E3 | Ningún datum es una **línea de centro / plano medio construido** usado como línea base | B §7-15 | 🟢 |
| E4 | Todo datum lleva **acabado superficial** y **control de forma propio** (planitud o rectitud) | B §8-33 | 🟢 |
| E5 | Orden A→B→C correlativo, sin saltos (no existe C sin B) | B §8-33 | 🟢 |
| E6 | Toda característica de **orientación** (⊥ ∥ ∠) y de **runout** referencia al menos un datum | B §8-34, §8-39 | 🟢 |
| E7 | Toda característica de **forma** (planitud, rectitud, circularidad, cilindricidad) **NO** referencia datum | B §8-26 | 🟢 |
| E8 | Feature cilíndrico con tolerancia geométrica: **lleva Ø** en el marco (o advertencia explícita) | B §8-35 | 🟢 |
| E9 | Tolerancia de **orientación < tolerancia de localización** de la misma superficie | B §8-34, §8-35 | 🟢 |
| E10 | Todo ⌖ posición tiene sus cotas de localización en **BÁSICA** (caja) | B §8-41 | 🟢 |
| E11 | **Ninguna cota básica lleva ±** ni hereda tolerancia general | B §8-40 | 🟢 |
| E12 | **Cero concentricidad, cero simetría** si el plano declara ASME Y14.5-2018 | M, A-8.4 | 🟢 |
| E13 | Circularidad **sin modificador MMC** (no aplica) | B §8-30 | 🟢 |
| E14 | Condición virtual calculada y **verificada contra el ensamble** (`H−T=F` flotante / `H−2T=F` fijo) | B §8-42, §8-43, §8-46 | 🟢 |
| E15 | El plano declara **qué norma** usa (ASME Y14.5-2009 / -2018 / ISO 1101) | M | 🟢 |
| E16 | Cada datum elegido es **funcional**: la superficie por la que la pieza realmente se asienta o se monta | B §8-33, M | 🔴 |
| E17 | Cada característica GD&T es **medible con el equipo del taller** | M | 🔴 |

## 4.6 Bloque F — DOCUMENTO

| # | Check | § | |
|---|---|---|---|
| F1 | Cajetín completo: empresa, nombre del dibujo, **número de parte** (≠ nombre de archivo), escala, revisión | B §5-12 | 🟢 |
| F2 | Escala rotulada en formato válido (`1 = 1`, `FULL`, `.25 = 1`…) y **las cotas son de tamaño real** | B §7-4 | 🟢 |
| F3 | Unidades declaradas en el cajetín | B §7-5 | 🟢 |
| F4 | Bloque de liberación con `DRAWN` y `CHECKED` | B §5-12 | 🟢 |
| F5 | Nota `DO NOT SCALE DRAWING` | B §5-12 | 🟢 |
| F6 | Bloque de aplicación con los ensambles donde se usa | B §5-12 | 🟡 |
| F7 | Cajetín en **todas** las hojas | B (proyectos cap 6) | 🟢 |
| F8 | Tamaño de hoja estándar (A4/A3 métrico; A/B/C pulgadas) | B §4-4 | 🟢 |
| F9 | Tipografía legible, no estilística; altura de texto consistente | B §7-3 | 🟡 |
| F10 | Abreviaturas: "should be used **very carefully**. Whenever possible, write out the full word" | B §7-18 | 🟡 |

**Conteo: 76 checks — A:11 · B:14 · C:13 · D:11 · E:17 · F:10.
De ellos 🟢 57 automatizables, 🟡 11 con heurística, 🔴 8 de juicio humano puro.**

---

# 5. ITERACIONES Y JUICIOS HUMANOS

## 5.1 Lo que se REHACE (y el software debe hacer barato rehacer)

| Qué se rehace | Cita / § |
|---|---|
| **La colocación de las cotas automáticas.** "The dimensions created using the Autodimension tool are **not always in the best locations**. The dimensions **must be relocated**." Y para ordenada: "if some of the created dimensions are located on the surface of the part, this would be **a violation of the convention**". | B §7-3 |
| **Las tolerancias, por iteración numérica.** "**Assigning tolerances is an ITERATION PROCESS**; that is, a tolerance is selected and other tolerance values are calculated from the selected initial values. **If the results are not satisfactory, go back and modify the initial value and calculate the other values again.** As your experience grows you will become better at selecting realistic initial values." | B §8-24 |
| **El resultado de holgura, si es excesivo.** Con el ejemplo del libro: la holgura mínima queda .01 pero la máxima llega a .08. "**If this much clearance is not acceptable, then the assigned tolerances will have to be reevaluated.**" | B §8-24 |
| **El tamaño nominal, si no es preferido.** "It would be wise to **reconsider the design** to see if a 40mm diameter hole could be used, and if not, possibly a 45mm." | B §8-20 |
| **La geometría de la pieza, cuando el componente comprado no cabe.** El barreno Ø1.00 "is **not acceptable. It must be edited**" al descubrir que el buje comprado mide Ø.75 de exterior → se edita el croquis del feature aguas arriba. | B §9-3 |
| **La rotura, si no quedó bien.** "If the break is not satisfactory, **undo the break and insert a new one**." | B §4-8 |
| **El plano, por revisión.** Cada cambio incorporado **suma una letra de revisión**. | B §5-12 |

## 5.2 Lo que se DECIDE CON CRITERIO (y el software NO debe decidir)

| Decisión | Por qué es humana |
|---|---|
| **Cuál cota se elimina** para romper el doble acotado — o sea **quién absorbe la acumulación**. "depends on the design objectives of the part" (B §8-9). | Define qué distancia queda garantizada y cuál flota. Es funcional. |
| **Cadena o baseline.** "if the distance between the individual features is more critical than the distance from the feature to the baseline, use the chain system" (B §8-10). | Solo el diseñador sabe qué interfaz manda. |
| **RFS o MMC.** "If straightness is critical to the design integrity or function of the part, then straightness should be applied in the RFS condition" (B §8-29). | MMC regala tolerancia; si la función la necesita, no se puede regalar. |
| **El valor inicial de la tolerancia** en el lazo iterativo (B §8-24). | Experiencia. |
| **Cuánta holgura es "demasiada"** (B §8-24). | Requisito del producto. |
| **Cuál superficie es el datum A** (B §8-33 + M). | Es cómo la pieza se monta y funciona; ninguna geometría lo dice sola. |
| **Si la sección "acabada" ya expone lo suficiente**, o falta otra. | Lectura del taller. |
| **`THRU` sí o no** — "Some companies require it and some do not" (B §7-3). | Política de la empresa. |
| **Callout de rosca completo o abreviado** — "The shortened callout form is **not universally accepted**. When in doubt, use a complete thread callout" (B §6-4). | Riesgo vs limpieza. |
| **Si el plano describe la FUNCIÓN o solo copia el PROCESO** — "Which came first — a functional part or the drawing?" (M). | Es la pregunta de diseño de fondo. |

## 5.3 El lazo completo, dibujado

```
   modelo 3D
       │
       ▼
   elegir vistas ────────────────────┐
       │                             │  ¿falta forma verdadera? → auxiliar
       ▼                             │  ¿interior invisible?    → sección
   acotar adentro→afuera             │  ¿detalle chico?         → detalle
       │                             │  ¿largo constante?       → rotura
       ▼                             │
   ¿doble acotado? ──sí──► ELEGIR cuál se va (juicio) ──┐
       │no                                              │
       ▼                                                │
   asignar tolerancias iniciales ◄──────────────────────┘
       │
       ▼
   estudio de tolerancias (máx/mín de lo que flota)
       │
       ▼
   ¿el ensamble siempre entra?  H−T=F / H−2T=F
       │no ──────────────────► volver a tolerancias (o al nominal, o a GD&T)
       │sí
       ▼
   ¿el ± controla lo que importa?  ── no ──► GD&T: datums → forma → orientación → posición
       │sí                                        │
       ▼                                          │
   ¿tamaños preferidos? ── no ──► volver al nominal (y al modelo 3D)
       │sí                                        │
       ▼◄─────────────────────────────────────────┘
   checklist (§4)
       │
       ▼
   DRAWN → CHECKED → revisión letra ──► taller
```

---

# 6. BRECHA CONTRA LA FORJA

> Estado del motor **verificado contra el código** (exploración completa del repo, 2026-07-31).
> Todas las rutas son absolutas y todos los símbolos son exports reales.

## 6.0 Hallazgo que cambia el plan

**Las ocho lecciones de tolerancias y GD&T YA ESTÁN ESCRITAS y ya llaman al botón del motor**, pero el
motor solo tiene una **demo cableada**:

| Lección | Título | Estado |
|---|---|---|
| `public/escuela/lecciones/mec-u8-l1.json` | El plano promete, la tolerancia cumple (± y límites) | escrita, sin motor |
| `mec-u8-l2.json` | La tolerancia angular (error = R·Δθ) | escrita, sin motor |
| `mec-u8-l3.json` | El estudio de tolerancias (peor caso Σ± vs RSS √Σ±²) | escrita, sin motor |
| `mec-u8-l4.json` | H7/g6 — ISO 286 (Ø25 H7 = +21/0 µm, g6 = −7/−20 µm) | escrita, sin tablas ISO 286 |
| `mec-u8-l5.json` | Ra: la piel de la pieza (ISO 1302) | escrita, sin símbolos |
| `mec-u8-l6.json` | **GD&T I — Planitud** (§8-25…8-32) | escrita, **usa `btn-plano-gdt`** |
| `mec-u8-l7.json` | **GD&T II — Datums** (§8-33…8-39) | escrita, **usa `btn-plano-gdt`** |
| `mec-u8-l8.json` | **GD&T III — Posición y MMC** (§8-40…8-48) | escrita, **usa `btn-plano-gdt`** |

Y `docs/forja-research/bethune/CURRICULUM.md` ya se autodiagnostica: **U8 completa ❌ salvo U8-L4 ⚠️**,
con la nota *"U8 exige anotaciones en drawing.ts — features nuevas"*.

**Conclusión operativa: no hay que crear el formato de lección ni el contenido. Hay que hacer que el
motor haga de verdad lo que la clase ya narra.** Eso invierte la prioridad: **el trabajo es motor,
no curriculum.**

## 6.1 Lo que YA cumple — con archivo y símbolo

### Motor de planos genérico
**`/home/ian/Orkesta/la-forja/src/forja/brep/drawing.ts`** (483 líneas, PURO — sin OCCT ni three, testeable en node).
Entrypoint único: `generateDrawing(input: DrawingInput, meta?: DrawingMeta): DrawingResult`.

| Capacidad real | Renglones del pliego que cubre |
|---|---|
| **HLR de verdad** — `occluded()` hace raycast Möller–Trumbore del punto medio de cada segmento hacia el ojo. Clasifica visible/oculta. | A1, C12 |
| **3 vistas ortográficas** (`VIEWS`, línea 66): `front`/ALZADO, `top`/PLANTA, `right`/LATERAL, con `u`,`v`,`eye` exactos | C1 parcial |
| **Primer vs tercer ángulo** — `meta.projection: 'first'|'third'`, cambia el acomodo (líneas 210-221) | **C2 parcial** (falta el símbolo en `drawing.ts`; sí existe en `mold-drawings.ts`) |
| **Vista de DETALLE** — `meta.detailView` (líneas 357-392): círculo punteado "A" + recuadro ×2.2 con clipPath, `data-view="detail"` | **C9** (le falta rotular su escala propia) |
| **Detección de barrenos** — `detectCircles()` con ajuste Kåsa; acepta si residual ≤ 3% r, r ≥ 1% diag, hueco angular ≤ 90° | A2 parcial, base de todo GD&T de posición |
| **Escalas "bonitas"** — `niceScale()`: 1:1,2,2.5,4,5,10,20,50,100,200,500 / N:1 | **F2 parcial** (falta validar el formato de rótulo) |
| **Capas con `data-*`** — `data-line="visible"|"hidden"|"center"`, `data-dim=…`, `data-note="tol"|"ra"` | **habilita TODOS los checks 🟢 de §4 sin tocar el motor** |
| Cajetín propio (90×32 mm): nombre, MATERIAL, MASA, ESCALA, UNID, 3er/1er áng | F1 parcial, F3 |

**Grosores de línea reales, ya diferenciados** (esto sí cumple el espíritu de §2.9 aunque el libro no
los numere): visible `0.55`, oculta `0.3` con dash, eje `0.22` dash-dot, cota `0.3`, marco `0.6`.

### Motor de planos de MOLDE
**`/home/ian/Orkesta/la-forja/src/forja/mold/mold-drawings.ts`** (378 líneas) — data-driven, no B-Rep.

| Capacidad | Cubre |
|---|---|
| **Cajetín ISO 7200 de verdad** (150×40): `titleBlock()` con MATERIAL, ACABADO (`Ra 0.8 cavidad · Ra 3.2 resto`), **TOLERANCIA GENERAL `ISO 2768-mK`**, **BARRENOS `H7 · roscas 6H`**, ESCALA, UNIDADES, DIBUJÓ, HOJA | **F1, F3, D1 (¡el bloque de tolerancias generales YA EXISTE aquí!)**, D10 parcial |
| **Símbolo de proyección de 3er ángulo ISO 128** — `data-testid="projection-symbol"` | **C2** |
| **`hatchRect(parts, r, flip, pitch=2.6)`** — el único rayado del repo: 45°, sentido alternado por componente, `data-hatch="1"` | **C6 parcial, C8** |
| **`renderAssemblySection`** — corte del stack con globos (`data-balloon`), BOM (`data-testid="bom-table"`), líneas de partición dash-dot (`data-parting="1"`) | C6, C7 parcial |
| **`renderPlateDrawing`** — planta acotada + cruces de centro + **TABLA DE BARRENOS** (`data-testid="hole-table"`: Nº/X/Y/⌀/PROF/TIPO) + lateral + circuito de enfriamiento | **A8 vía tabla**, la alternativa del libro a acotar 40 barrenos (B §7-10) |
| `dimLine()` — cota lineal con flechas | B parcial |

**⚠️ Importante:** la sección de molde se dibuja a partir de **rectángulos declarados**
(`StackComp.rects: SectionRect[]`), **no** de una intersección B-Rep. Es honesta para placas
prismáticas y **no escala** a geometría orgánica.

### Croquis y restricciones
**`/home/ian/Orkesta/la-forja/src/forja/brep/sketch-solver.ts`** (339 líneas, matemática pura):
- Solver **Levenberg–Marquardt** sobre Jacobiano numérico; ecuaciones normales `(JᵀJ + λ·diag)Δ = −Jᵀr`.
- **`rankAndMovable(J, n, tol)`** hace RREF y devuelve rango + espacio nulo → `dof = nVars − rank(J)`.
- `SolveResult.status: 'full' | 'under' | 'over'` y **`free: { points: boolean[]; circles: boolean[] }`**
  → **DOF POR ENTIDAD**, que es exactamente el semáforo de B §1-3 pero mejor: en vez de teñir el
  croquis entero, tiñe **la entidad libre**.
- 21 restricciones, y **las cotas SON restricciones** (`distance`, `distX`, `distY`, `radius`,
  `diameter`, `arcRadius`, `angle`) → driving dimensions reales (§1.1.3 lado "construcción" ✅).

**`/home/ian/Orkesta/la-forja/src/forja/brep/SketchEditor.tsx`** (1701 líneas):
`DimAnnotations` (línea 1402) dibuja `dist`/`rad`/`diam`/`arcrad`; barra `data-testid="sk-dof"` con
verde/azul/rojo; herramienta `dim` **contextual como Fusion**; `window.__sketchEditor` expone
`dof` y `status` para los checks de las lecciones.

### Línea de tiempo
Dos, independientes y ambas sirven:
- **Pieza:** `/home/ian/Orkesta/la-forja/src/forja/brep/ForgeBRepStudio.tsx` — `OpType` (línea 435) con
  `extrude|hole|fillet|chamfer|shell|draft|revolve|loft|sweep|pattern|pocket`; `OpBase` con `name` y
  `suppressed` (rename + supresión estilo Fusion); API en `window.__forgeBrep`.
- **Molde:** `/home/ian/Orkesta/la-forja/src/forja/mold/timeline.ts` — `rebuild(K, oc, timeline)` **puro**;
  `Feature.why` = **la cita del libro que justifica el paso** (el mismo espíritu de este pliego);
  `validate(f)` es un portero anti-corrupción de heap OCCT.

### ⭐ El precedente que hay que copiar: `verifyDims`
**`/home/ian/Orkesta/la-forja/src/forja/mold/mold-dimensions.ts`** (156 líneas):

```ts
export interface Dim3D { id; label; kind: 'lineal'|'diametro'|'espesor'|'coordenada';
                         a; b; value; measured?; ok?; why?; critical? }
export function verifyDims(dims, measure?, tolMm = 0.6): DimVerdict   // RECETA vs REALIDAD
```

Su filosofía, ya escrita en el archivo: *"una cota que solo repite el parámetro es decoración; una
que enfrenta receta contra realidad es un detector."*

**Esa es exactamente la arquitectura que necesita GD&T** (§6.3.5). El render vive en
`/home/ian/Orkesta/la-forja/src/forja/brep/MoldCotas3D.tsx` (verde OK / rojo MAL / ámbar sin medir,
labels en divs HUD porque `drei <Text>` crashea con EffectComposer).

### Tolerancias que ya existen
**`/home/ian/Orkesta/la-forja/src/forja/mold/fits.ts`** (138 líneas) — **ANSI B4.1 / Kazmer, literal**:
`fitAtTemp()`, `EJECTOR_DIAM_CLEARANCE_MM = 0.13`, `ejectorPinFit()`, `InterferenceFit = LN1|LN2|LN3|FN1|FN2|FN3`,
`apparentDia = √(a·b)` (Eq 12.29), `interferenceFit()`, `PILLAR_SLIDE_CLEARANCE_MM = 1.0`,
`LEADER_PIN_CLEARANCE_MM = 0.03`, `GUIDE_SEAT_CLEARANCE_MM = 0.4`, `guideGeom()`.
Regla dura ya anotada ahí: *"un barreno y lo que entra en él NUNCA miden lo mismo"*.

### Gates y tests
- **`/home/ian/Orkesta/la-forja/scripts/forja-gate.cjs`** (261 líneas) — catálogo `SUITES[]` con
  `{group, n, why, cmd, args}`, `--only`, `--json`, exit 1. **Ya incluye `kernel/mold-drawings` y
  `unit/vitest-forja` (que corre "planos (HLR)").**
- **`/home/ian/Orkesta/la-forja/src/forja/brep/drawing.test.ts`** (274 líneas, vitest) — verifica bbox,
  3 vistas, detección de barrenos, baseline `pos-x`/`pos-y`, `data-dim="depth"`, `tolNote`, `raNote`,
  `detailView`, `gdtDemo`, 1er vs 3er ángulo, oclusión HLR, escala, SVG bien formado, cajetín.
- `/home/ian/Orkesta/la-forja/scripts/drawing-test.ts` — HLR **numérico** (perímetros exactos 104/120/64 mm).
- `/home/ian/Orkesta/la-forja/scripts/plano-verify.cjs` — Playwright sobre la UI real, 0 errores de consola.
- `/home/ian/Orkesta/la-forja/scripts/mold-drawings-test.cjs` — tabla de barrenos, BOM, globos, achurado, partición.

## 6.2 Lo que FALTA — inventario honesto

### En el plano 2D (`drawing.ts`)

| Falta | Impacto en la checklist |
|---|---|
| ❌ **Vista de SECCIÓN 2D.** `grep -i section drawing.ts` = 0. El corte existe en 3D (`THREE.Plane` clipping, `SectionGizmo`, `btn-section-tool`) y **nunca llega al plano**. En moldes existe pero por rectángulos declarados. | **C6, C7, C8, C13 imposibles hoy en pieza genérica** |
| ❌ Vistas **auxiliares** y **rotas** | C5, C10 |
| ❌ Cota **radial (R)** — `detectCircles` **descarta arcos** (`maxAngularGap > π/2`) | A9, A10 |
| ❌ Cota **angular** — la restricción `angle` existe en el solver pero **no se dibuja** ni en el croquis ni en el plano | A8 |
| ❌ Cota de **chaflán**, **ordenada**, **cadena**, **leader con nota libre** | §1.3.2 completo, A10 |
| ❌ **Callouts de barreno**: ⌴ contrataladro, ⌵ avellanado, ↧ profundidad, `4× Ø10`, rosca | §2.7 completo, A2 |
| ❌ **Colocación manual/editable** de cotas — todo es auto y no hay UI de acotación | §5.1 "el humano recoloca", ⭐3 |
| ❌ **Tolerancia por cota** (±, límites, básica, referencia, ajuste pegado) | **D3, D4, D7, E10, E11** |
| ⚠️ Límite duro: solo acota barrenos `if (circles.length >= 1 && <= 4)` | A3 en piezas reales |
| ⚠️ `tolNote`/`raNote` **hardcodeados** en `ForgeBRepStudio.tsx:5056` (`'±0.1 · ISO 2768-m'`, `'Ra 3.2'`) | D1 sin control del usuario |
| ⚠️ HLR es **O(segmentos × triángulos) sin BVH** — fuerza bruta | escalabilidad, no corrección |

### En GD&T

**Existe una DEMO, no un modelo.** `drawing.ts` líneas 394-435, tras `if (meta.gdtDemo)`:
closures locales `frame(x, y, cells: string[], tag)` y `datumFlag(x, y, letter)` que emiten
**exactamente 4 cosas con valores literales**: datum A (borde inferior del ALZADO), datum B (borde
izquierdo), `['⏥','0.1']`, `['⊥','0.1','A']`, y `['⌖','⌀0.2 Ⓜ','A','B']` por barreno (máx 4).

Lo que **no existe en ninguna parte del repo**:
- ❌ Tipos `FeatureControlFrame`, `DatumRef`, `GeometricTolerance`, `MaterialCondition`. **El GD&T es
  cadena de strings → SVG, no una estructura de datos.**
- ❌ Archivo `tolerance.ts` / `gdt.ts`. No existen.
- ❌ **Tablas ISO 286 / grados IT.** `H7`, `g6`, `6H` aparecen **solo como texto**. No hay
  `itGrade()` ni desviaciones fundamentales. `LEADER_PIN_CLEARANCE_MM = 0.03` es un número plano
  etiquetado "≈ H7/g6". **La lección `mec-u8-l4.json` enseña ISO 286 y el motor no la tiene.**
- ❌ Rectitud, circularidad, **cilindricidad**, perfil, angularidad, paralelismo, runout.
- ❌ Cálculo de **MMC/LMC/condición virtual/bonus**, ni `H−T=F` / `H−2T=F`.
- ❌ **Verificación geométrica**: nada mide la planitud real de una cara contra su tolerancia.
- ❌ Stack-up (Σ± peor caso ni RSS) en código — `mec-u8-l3.json` lo narra sin lab.
- ❌ Símbolos de acabado superficial ISO 1302 (solo la nota global de texto).

> Falso positivo a ignorar: `flatness` en `/home/ian/Orkesta/la-forja/src/lib/reverse-engineer.ts:512`
> es un **ratio de aspecto de bbox** para clasificar formas. No tiene nada que ver con GD&T.

## 6.3 EL PLAN — por anillos, una cosa a la vez

### Anillo 0 — `gate-plano.cjs`: la checklist que se corre YA, sin tocar el motor

**Esto es el entregable de mañana.** El motor **ya emite todos los `data-*` que hacen falta**
(`data-line`, `data-dim`, `data-note`, `data-hatch`, `data-parting`, `data-view`, `data-gdt`,
`data-datum`, `data-testid`) y `drawing.test.ts` ya demuestra el patrón de *sniffing* del SVG.

Se copia el patrón de `scripts/critic-gate.cjs` (capturar → medir → exit 1) y de
`scripts/drawing-test.ts` (verificación numérica) y se agrega a `SUITES[]` de `forja-gate.cjs`
como `kernel/gate-plano`.

**Checks puramente geométricos sobre el SVG, sin datos nuevos (18):**

```
  B1   cota sobre la superficie de la pieza     bbox(text) ∩ polígono de la vista
  B2   cota dentro de un recorte                bbox ∩ hueco del polígono
  B3   línea de cota a < 15 mm del borde        distancia mínima (el SVG está en mm de hoja: directo)
  B4   separación no uniforme                   desviación estándar de los offsets paralelos
  B5   orden por longitud roto                  cota larga más cerca que una corta
  B6   líneas de cota cruzadas                  intersección segmento-segmento
  B8   texto apretado entre extensiones         ancho(texto) > separación de extensiones
  B9   traslape de textos                       bbox ∩ bbox
  B10  falta el hueco arista↔extensión          distancia == 0 y no es data-line="center"
  B11  texto no horizontal                      transform con rotate != 0 (hoy la cota vertical
                                                 SÍ rota −90° → ⚠️ VIOLA B11 / ⭐ del acotado
                                                 unidireccional. Primer bug que encuentra el gate.)
  B13  línea de centro que no sobresale         extremo dentro del bbox de la vista
  C1   vistas desalineadas                      Δx/Δy entre vistas proyectadas
  C6   oculta dentro de una sección             data-line="hidden" dentro de una vista de sección
  C7   flechas del corte al lado malo           signo del vector vs posición de la sección
  C11  tangencia en vista ortográfica           kind de arista == smooth/tangent
  C12  precedencia rota                         oculta dibujada sobre visible colineal
  F2   escala en formato inválido               regex sobre el rótulo
  F5   falta DO NOT SCALE DRAWING               texto ausente
```

**⚠️ Nota de hallazgo:** el texto de las cotas verticales en `drawing.ts` **se rota −90°**. Eso
**contradice** B §7-3/§7-5 (acotado **unidireccional**: "the dimension values for the vertical
dimensions are written **horizontally**. This is in compliance with ANSI standards"). Es un bug real
y el check B11 lo atrapa el primer día.

**Checks de completitud, usando el árbol de features que ya tenemos (9):**

```
  A2   feature sin cota de tamaño       recorrer Op[]/Feature[] ∩ cotas del SVG
  A3   feature sin localización         grados de libertad del feature no fijados en el plano
  A4   faltan cotas generales           bbox del sólido vs cotas presentes
  A5 ★ DOBLE ACOTADO                    ver abajo
  A6   cadena que no cierra             Σ parciales vs general
  A7   barrenos alineados duplicados
  D1   falta bloque de tolerancias generales (drawing.ts NO lo tiene; mold-drawings.ts SÍ)
  D2   cota sin tolerancia ni bloque
  D3/D4/D5  formato de ± y unidades      regex
```

**★ A5 es el check estrella y tiene solución exacta, no heurística.** Se modela como **grafo**:

```
vértices = planos/caras de referencia paralelos (por eje)
aristas  = cotas entre ellos

  ciclo en el grafo            ⇒ DOBLE ACOTADO (redundante)     ← B §7-11 r.8, §8-9
  componente sin llegar al datum ⇒ feature NO localizado         ← A3
  árbol de expansión           ⇒ acotado correcto y mínimo
```

Es teoría de grafos, da resultado **exacto**, y es la regla que más planos malos atrapa.
**Excepción a codificar:** las cotas `basic` (en caja) **no acumulan** (B §8-40) → se marcan como
un tipo de arista distinto que no dispara el ciclo por acumulación (pero sí por duplicación literal).

### Anillo 1 — tolerancias dimensionales (todavía sin GD&T)

| Paso | Archivo | Esfuerzo |
|---|---|---|
| Tipo `Tolerance` y campo en la cota: `{ kind: 'none'\|'bilateral'\|'symmetric'\|'unilateral'\|'limits'\|'basic'\|'reference'\|'fit' }` | nuevo `src/forja/brep/tolerance.ts` | bajo |
| **Sacar `tolNote`/`raNote` del hardcode** de `ForgeBRepStudio.tsx:5056` a un bloque de tolerancias generales editable — y **portar el `titleBlock()` de `mold-drawings.ts` a `drawing.ts`** (ahí ya está `ISO 2768-mK` + `H7 · roscas 6H`) | `drawing.ts`, `mold-drawings.ts` | bajo |
| **Herencia por número de decimales** (B §8-8) + aviso en la UI: *"3 decimales ⇒ heredaste ±0.001"* | editor de cotas | bajo |
| Render de la cota con tolerancia: límites arriba/abajo, **caja para BÁSICA**, **paréntesis para REFERENCIA** | `dim()` en `drawing.ts:290` | bajo |
| **Cota radial y angular** — desbloquear arcos en `detectCircles` + dibujar la restricción `angle` que el solver ya resuelve | `drawing.ts`, `SketchEditor.tsx:1402` | medio |
| **Estudio de tolerancias** (§4 D7, B §8-11): máx/mín de toda distancia no acotada, sobre el grafo de A5 | nuevo | medio |
| **Tablas ISO 286** (lo pide `mec-u8-l4.json`): `itGrade(nominal, grade)`, `holeDeviation`, `shaftDeviation` | nuevo, junto a `fits.ts` | medio |
| Verificador de ensamble `H−T=F` / `H−2T=F` | junto a `fits.ts` | medio |

### Anillo 2 — GD&T: ver §6.4

### Anillo 3 — el resto
Sección 2D real en `drawing.ts` (el corte 3D ya existe: falta llevar el plano de corte a la
proyección y reusar `hatchRect` de `mold-drawings.ts`), vistas auxiliares, roturas, acotado
ordenado, callouts de barreno, símbolos ISO 1302 por cara, lista de tipos exentos de rayado.

## 6.4 ⭐ POR DÓNDE ENTRAR A GD&T — el subconjunto mínimo para MOLDES

El encargo pide **planitud, perpendicularidad, posición, cilindricidad**. Coinciden con lo que un
molde necesita, y con lo que la demo de `drawing.ts` ya dibuja (le falta cilindricidad).

### 6.4.1 Por qué esas cuatro, y a qué feature del molde se le pone

| Símbolo | Feature del molde (con su archivo) | Por qué el ± NO basta |
|---|---|---|
| **⏥ Planitud** | **plano de partición** — `/home/ian/Orkesta/la-forja/src/forja/mold/parting.ts` (`PartingLoop`, `partingLoops`, `splitNoPlano`); caras de apoyo de placas — `buildPlateSolid()` en `mold-plano-set.ts:76` | si la partición ondula, **rebaba**. El ± del espesor permite ondulación libre dentro de la banda (B §8-27). Y es prerequisito del datum (DT2, DT4). |
| **⊥ Perpendicularidad** | barrenos de **poste guía** — `guideGeom()` en `fits.ts:124`, `standardHoles()` en `mold-drawing-set.ts:492`; paredes de cavidad vs línea de apertura | si el guía no está a escuadra con la partición, el molde **se agarrota o marca**. El ± localiza pero "does not directly control the SHAPE" (B §8-35). |
| **⌖ Posición** | **la más importante**: postes↔bujes guía (`guideGeom`), pines de expulsor y retorno (`ejectorPinFit`, `standardHoles` con `'holgura pin de retorno (0.13mm)'`), tornillería (`mold-fasteners.ts`), líneas de agua entre placas (`coolingCircuit()`) | son ensambles **fijo y flotante**. El ± da zona cuadrada y **rechaza piezas buenas** (§3.6.1); en cadena **acumula** (§3.6.2). Aquí viven `H−T=F` y `H−2T=F`. |
| **⌭ Cilindricidad** | bore de poste guía, barrenos de expulsor, casquillo de bebedero | son ajustes **deslizantes**: "a tolerance zone both around individual circular cross sections **and also along its length**" (B §8-31). Un barreno abarrilado agarrota el expulsor aunque los dos extremos midan bien. |

Superficies adicionales ya modeladas y listas para recibir GD&T: asiento del inserto
(`insertDims()`, `carvedInserts()`), aberturas de cavidad (`cavityOpenings()`, `cavityGrid()`),
side actions (`sideactions.ts`), interlocks (`mold-interlocks.ts`).

### 6.4.2 El orden — cinco pasos, cada uno verificable

```
PASO 1 — DATUMS.  Sin datum no hay ⊥ ni ⌖.
   Refactor mínimo:  sacar frame() y datumFlag() de la closure de renderSVG a
   funciones EXPORTADAS de drawing.ts, y cambiar en DrawingMeta:
        gdtDemo?: boolean        ──►   gdt?: { datums: Datum[]; frames: FeatureControlFrame[] }
   El datum se ancla a una CARA del B-Rep (enumerateFaces() de occt.ts), no a una arista dibujada.
   Enciende:  E1 E2 E3 E5.
   Verificación:  el triángulo aparece en la vista correcta y sigue a la cara al rotar/reconstruir.

PASO 2 — ⏥ PLANITUD.  Única de las cuatro SIN datum ⇒ cero dependencias.  FCF de un compartimento.
   Enciende:  E7, DT4.
   Regla dura:  al declarar un datum, el software EXIGE su planitud (B §8-33).

PASO 3 — ⊥ PERPENDICULARIDAD.  Primer FCF con datum.
   Enciende:  E6, E8 (el Ø de §3.3.1), E9 (orientación < localización — aritmética trivial).

PASO 4 — ⌖ POSICIÓN + COTAS BÁSICAS.  La de mayor valor y la más cara.  Requiere:
     · cota BÁSICA: caja, sin ±, NO hereda del bloque general      → E10, E11
     · Ⓜ MMC y bonus:   zona(d) = |VC − d|                          → §3.5.2
     · condición virtual VC = MMC ± tol                             → §3.5.3
     · verificador de ensamble  H−T=F (flotante) / H−2T=F (fijo)    → E14
   Y el visualizador que VENDE el módulo:  la zona CUADRADA y la CIRCULAR
   superpuestas sobre la misma pieza, con el conteo de "piezas buenas que el ± tira".
   (Reusa el patrón de MoldCotas3D.tsx: líneas + labels en divs HUD, verde/rojo/ámbar.)

PASO 5 — ⌭ CILINDRICIDAD.  Forma, sin datum, sobre cara cilíndrica.
   Prohibir Ⓜ  → E13 (misma razón que circularidad, B §8-30).
```

### 6.4.3 La forma del dato (para que nazca bien)

```ts
// src/forja/brep/gdt.ts  — PURO, testeable en node, como drawing.ts y sketch-solver.ts

type MaterialCondition = 'RFS' | 'MMC' | 'LMC'      // RFS = default (B §8-29); LMC = extensión declarada

type GdtSymbol =
  | 'flatness' | 'straightness' | 'circularity' | 'cylindricity'   // forma      — SIN datum
  | 'perpendicularity' | 'parallelism' | 'angularity'              // orientación — CON datum
  | 'profileSurface' | 'profileLine'
  | 'runoutCircular' | 'runoutTotal'                               // CON datum (eje)
  | 'position'                                                     // CON datum
  // PROHIBIDOS por ASME Y14.5-2018 A-8.4:  'concentricity' | 'symmetry'

interface Datum { letter: 'A'|'B'|'C'|'D'|'E'|'F'; faceId: FaceId
                  kind: 'plane' | 'axis' | 'point' }

interface FeatureControlFrame {
  symbol:    GdtSymbol
  value:     number
  diametral: boolean                              // el Ø de §3.3.1 — cilindro vs rebanada
  material:  MaterialCondition
  perUnit?:  { value: number; length: number }    // el .002/1.000 de §3.5.5
  datums:    Datum['letter'][]                    // [] para forma; ordenados primario→terciario
  attachTo:  { kind: 'face'|'axis'|'extensionLine'|'underDimension'; id: string }
}
```

**Invariantes que el TIPO debe hacer imposibles** (impedir, no validar después):

| Invariante | Check que enciende |
|---|---|
| `symbol ∈ forma` ⟹ `datums.length === 0` | E7 |
| `symbol ∈ {orientación, runout, position}` ⟹ `datums.length ≥ 1` | E6 |
| `symbol === 'circularity'` ⟹ `material === 'RFS'` | E13 (B §8-30) |
| `symbol === 'position'` ⟹ toda cota de localización de ese feature es `basic` | E10 |
| ninguna cota `basic` lleva ± ni hereda del bloque general | E11 |
| `datums` sin saltos: no existe `C` sin `B` | E5 |
| cara cilíndrica ∧ `!diametral` ⟹ **advertencia** (no error: B §8-35 dice "in general it is better") | E8 |
| `tol_orientación < tol_localización` de la misma cara | E9 |
| todo datum tiene su ⏥ propia y su acabado ≤ 0.8 µm | E4, D10 |

### 6.4.4 ⭐ La verificación — copiar `verifyDims`, no inventar

Este es el paso que separa "dibujar símbolos" de "servir". Ya tenemos el patrón exacto en
`mold-dimensions.ts`: **receta vs realidad**, con `measured?`, `ok?` y `why?`.

```ts
// gdt-verify.ts  — el mismo contrato que verifyDims(), pero geométrico
export interface GdtVerdict { frame: FeatureControlFrame; measured: number
                              ok: boolean; why: string }

export function verifyGdt(frames, tessellation, faces): GdtVerdict[]
```

Con la teselación que `occt.ts:tessellate()` ya produce, **estas tres se calculan hoy**:

| Característica | Cómo se mide sobre la teselación |
|---|---|
| **⏥ Planitud** | ajustar plano por mínimos cuadrados a los vértices de la cara → `max(d) − min(d)` a ese plano. Es la **zona mínima aproximada**; declarar el método (§3.8: la divergencia de métodos es real y hay que decir cuál se usa). |
| **⊥ Perpendicularidad** | normal de la cara vs normal del datum → desviación angular × longitud de la cara = ancho de zona |
| **⌭ Cilindricidad** | ajustar eje por mínimos cuadrados → `max(r) − min(r)` de todos los vértices |
| **⌖ Posición** | centro medido del barreno (ya lo da `detectCircles`/`fitCircle`) vs posición básica → `2 × distancia` = diámetro de zona usado; comparar con `tol + bonus(d)` |

**Y hay que declarar el algoritmo de ajuste en la UI.** La lámina M lo advierte: mínimos cuadrados,
zona mínima, máximo inscrito y mínimo circunscrito **dan números distintos**, y en 1988 una alerta
GIDEP detuvo el uso de CMM por eso. Un software que reporta "planitud = 0.08" sin decir con qué
método está mintiendo por omisión.

### 6.4.5 Lo que NO hay que implementar

- **Concentricidad y simetría** (Y14.5-2018 A-8.4). Si un cliente las pide: `legacy: 'Y14.5-2009'`
  explícito, nunca default.
- **Ⓔ (envelope)** hasta que el plano pueda declarar norma ISO (§3.9).
- **Modo "gaging"**. Y14.5 **no es** norma de medición (§3.8): el software define zonas y reporta un
  método declarado, no dictamina cómo debe medir el taller.

## 6.5 Dónde engancha con lo que ya existe

| Ya existe | Cómo se conecta |
|---|---|
| `scripts/forja-gate.cjs` con `SUITES[]` | agregar `kernel/gate-plano` con su `why` — el gate corre solo |
| `src/forja/brep/drawing.test.ts` (274 líneas) | ya hace *sniffing* de `data-gdt` y `data-datum`; los nuevos asserts van ahí |
| `scripts/plano-verify.cjs` (Playwright GPU) | ya abre el overlay y valida 0 errores de consola; agregar los botones nuevos |
| `data-*` en todo el SVG | **el gate no necesita instrumentación nueva** — ya está todo marcado |
| `src/forja/mold/fits.ts` (ANSI B4.1 Kazmer) | fuente de D8 y del callout de ajuste; ya trae hueco/eje |
| `src/forja/mold/mold-dimensions.ts` → `verifyDims()` | **el molde de `verifyGdt()`** |
| `src/forja/brep/MoldCotas3D.tsx` | el render verde/rojo/ámbar y el truco de labels en divs HUD |
| `titleBlock()` de `mold-drawings.ts` (ISO 7200 + ISO 2768-mK + H7) | **portarlo a `drawing.ts`** resuelve D1/F1 de un jalón |
| `hatchRect()` de `mold-drawings.ts` | reusarlo cuando `drawing.ts` tenga sección 2D |
| `public/escuela/lecciones/mec-u8-l1…l8.json` | **el contenido ya está escrito**; cada paso del anillo desbloquea una lección |
| `docs/forja-research/bethune/CURRICULUM.md` | ya lleva la columna "Estado Forja" — actualizarla es el marcador de avance |
| Bus de comandos `ui.run` | exponer `plano.verificar`, `gdt.datum`, `gdt.fcf`, `gdt.verificar`, `tol.estudio` |
| `src/forja/mold/moldmachine.ts` → `moldMachine(spec)` | cada placa que salga debe pasar el gate de plano: aquí se juntan este pliego y el de Kazmer |

## 6.6 El primer bug que este pliego ya encontró — VERIFICADO

**Las cotas verticales de `drawing.ts` rotan su texto −90°.**
`/home/ian/Orkesta/la-forja/src/forja/brep/drawing.ts`, **línea 302**, rama `else` de `dim()`:

```
<text x="…" y="…" font-size="3" fill="#1a5fb4" text-anchor="middle"
      transform="rotate(-90 …)">${txt}</text>
```

B §7-3 y §7-5 son explícitos y es cumplimiento ANSI:

> "Note that the dimension values for the vertical dimensions **are written horizontally**. This is in
> compliance with ANSI standards." — B §7-3
>
> "The units for aligned dimensions **should be written horizontally**. This is called
> **unidirectional dimensioning**." — B §7-5

El check **B11** lo atrapa el primer día y **el fix es borrar el `transform`** (y recolocar el `x` para
que el texto quede a la izquierda de la línea de cota en vez de sobre ella).

Un pliego que no encuentra al menos un bug real no leyó el libro.

---

# 7. ⭐ LOS 10 DETALLES QUE UNA MÁQUINA LINEAL SE SALTARÍA

Diez cosas que sí o sí se pierden si el software "solo pone cotas donde caben".

---

### ⭐1 — La regla del calibrador decide GD&T, no el gusto

> "Only use plus/minus tolerances for **size** on features that you can **grab with the outside or
> inside jaws of a caliper**." — M

Una máquina lineal pone ± en todo porque ± siempre "cabe". El cliente pregunta primero **si un
vernier puede agarrar esa distancia**. Si no puede — posición, orientación, forma, perfil, runout —
el ± es ambiguo y hay que usar GD&T. Es la regla más operable de todo el pliego y se puede correr
como check sobre cada cota del plano.

---

### ⭐2 — La cota va en la vista de CONTORNO, no donde cabe

Barrenos en su vista **circular**. Ranura donde se ve la ranura. Superficie inclinada donde se ve
inclinada. La altura de una cara en la **vista lateral** "rather than run along extension lines
across the front view" (B §7-22). Un algoritmo de colocación optimiza espacio libre; el dibujante
optimiza **comprensión** — y son objetivos distintos que a veces se contradicen.

---

### ⭐3 — El acotado tiene ORDEN y JERARQUÍA de distancia

De **adentro hacia afuera**; leaders **al final**; **cortas cerca, largas lejos, generales las más
lejanas** (B §7-6, §7-11). No es estética: es que la cota general es la que el taller busca primero
y la que menos debe cruzarse con nada. Una máquina que coloca cotas en el orden en que las encuentra
en el árbol produce un plano legalmente correcto e ilegible.

---

### ⭐4 — La cota que NO se pone es la decisión más importante del plano

Tres cotas de 30 más una general de 90, ±1 cada una: la cadena da 90±3, la general da 90±1
(B §8-9). **Hay que borrar una.** Cuál se borra define **quién absorbe la acumulación** — y eso
"depends on the design objectives of the part". La alternativa es volverla **referencia entre
paréntesis `(90)`**, que "is **not used during the manufacturing or inspection process**". Una
máquina lineal acota todo y produce un plano contradictorio; o borra la última y elige mal.

---

### ⭐5 — Un carácter Ø cambia la zona de rebanada a cilindro

> "The inclusion of the Ø symbol in a geometric tolerance is **CRITICAL to its interpretation**. If
> the Ø symbol is not included, the tolerance applies **only to the view in which it is written**…
> the tolerance zone is shaped like a **rectangular slice, not a cylinder**." — B §8-35

Un editor de FCF que trata el Ø como decoración produce planos que significan otra cosa. Es un check
de una línea (`cara cilíndrica ∧ ¬diametral ⇒ advertir`) y nadie lo pone.

---

### ⭐6 — La tolerancia de orientación SIEMPRE menor que la de localización

> "A feature is **first located, then it is oriented within the locational tolerances**. This means
> that the orientation tolerance **must always be less** than the locational tolerances." — B §8-34

Con `40 ± 1`, una perpendicularidad de 1.5 es **letra muerta**: la cota de localización nunca deja
que la variación llegue ahí (B §8-35). El símbolo está en el plano, el taller lo lee, el inspector
lo mide, y no controla nada. Check aritmético trivial que ningún CAD hace.

---

### ⭐7 — Un datum es una superficie real, acabada y medible — nunca una línea imaginaria

Cuatro condiciones simultáneas, y las cuatro son citas:
1. **real**: "poor practice to use a **centerline as a baseline**. Centerlines are **imaginary lines
   that do not exist on the object**" (B §7-15);
2. **plana de verdad**: "be sure that the surface is **reasonably flat**" (B §8-33);
3. **acabada**: "**0.8-μm** surface finish is generally considered the **minimum acceptable finish
   for datums**" (B §8-22);
4. **con su propio control de forma**: el acabado "defines the smoothness… **but not the
   straightness**" (B §8-33).

Y encima **medible en la práctica**: el caso del inspector que midió la superficie B en vez del
datum A y dijo "so what" — pasó de milagro (M). Un software que deja marcar cualquier cara como
datum A está firmando planos que no se pueden inspeccionar.

---

### ⭐8 — 5.50 ≠ 5.5000: los ceros son dinero, no decoración

> "Mathematically these two values are equal, but **they are not the same manufacturing
> instruction**. The 5.50 value could have a standard tolerance of ±.01, whereas the 5.5000 value
> could have a standard tolerance of ±.0005. A tolerance of ±.0005 is **more difficult and therefore
> more expensive** to manufacture." — B §7-5

El número de decimales **selecciona** la tolerancia del bloque general (B §8-8). Un campo numérico
que formatea a 3 decimales "porque se ve parejo" multiplica el costo de la pieza sin que nadie tome
la decisión. El editor de cotas debe mostrar, **al lado del valor, la tolerancia que acaba de
heredar**.

---

### ⭐9 — La gramática de la sección: flechas hacia la vista, cero ocultas

> "Section views are **always located behind the arrows**; that is, **the arrows point TOWARD the
> section view**. Think of the arrows as your eyes looking at the section view." — B §4-6

Y: "Section views **do not include hidden lines**" (B §4-5), pero **sí** todo lo visible detrás del
corte (B §4-5), y el rayado ANSI 31 a 45° debe ir **a un ángulo que no se confunda con las líneas de
extensión** cuando la sección se acota (B §7-21). Cuatro reglas independientes en una sola vista.
Un generador que solo "corta y raya" produce secciones que se leen al revés.

---

### ⭐10 — Y14.5-2018 mató dos símbolos y cambió qué es el "objetivo"

Tres cosas que un motor que nace en 2026 no puede ignorar (M):

1. **A-8.4:** "Concentricity and symmetry tolerances **have been removed** (term, symbol, and
   concept)." Sustitutos: **posición y runout**. Un software nuevo que las ofrezca nace viejo.
2. **4.1 (q):** "the as-designed dimension value **does NOT establish a functional or manufacturing
   target**." Con `32 +0.02/−0.00`, el "mejor" valor es **32.01**, el centro de la zona — no el 32.
   La UI **no debe** presentar el nominal como objetivo.
3. **4.1 (s):** "elements of a surface **include surface texture and flaws (e.g. burrs and
   scratches). ALL elements** of a surface shall be within the applicable specified tolerance zone."
   Tamaño ⊃ forma ⊃ rugosidad son **anidados**, no independientes.

Y de yapa, porque es el error caro: **el bonus de un datum que es un PATRÓN de features "must be
SHARED"** entre ellos (M) — no se reparte por feature.

---

## Apéndice — dónde está cada cosa

| Fuente | Ruta |
|---|---|
| Bethune, capítulos extraídos | `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/bethune/ch01.txt … ch11.txt` |
| Bethune, texto completo | `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/bethune/full.txt` |
| Bethune, PDF (1824 pp) | `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/bethune/bethune-solidworks-2023.pdf` |
| GD&T / Y14.5-2018 (Mitutoyo) | `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/P2_43_gd-t-and-the-new-asme-y14-5-2018-salsbury-mituto.pdf` |
| Manual FreeCAD | `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/P0_08_a-freecad-manual-yorik-van-havre-part-design-ske.pdf` |
| Pliego hermano (Kazmer, moldes) | `/home/ian/Orkesta/la-forja/docs/forja-research/kazmer-pliego/` |

**Capítulos de Bethune por tema, para volver a la fuente rápido:**
cap 1 = arranque y semáforo · cap 2 = entidades de croquis · cap 3 = features · **cap 4 = vistas
ortográficas, secciones, auxiliares, roturas, detalles** · cap 5 = ensambles, cajetín, bloques ·
cap 6 = roscas y sujetadores · **cap 7 = acotado** · **cap 8 = tolerancias y GD&T** ·
**cap 9 = ajustes** · cap 10 = engranes · cap 11 = examen CSWA.
