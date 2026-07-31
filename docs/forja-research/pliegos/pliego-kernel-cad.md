# PLIEGO — EL KERNEL CAD (los teóricos de geometría son el CLIENTE)

**Ejercicio:** los autores de estos cinco documentos son el cliente que nos encarga el software.
No son "referencias que consultamos": son quien firma el requisito. Todo lo que aquí está
entrecomillado es literal del corpus. Todo lo que NO está en el corpus va marcado
`[EXTENSIÓN DECLARADA]` con la derivación a la vista.

**Fecha:** 2026-07-31 · **Analista:** PROJECT ANALYST · **Proyecto:** La Forja (CAD/CAM en navegador, kernel OCCT-WASM)

---

## 0. EL CLIENTE Y EL ALCANCE REAL DEL CORPUS

| # | Cliente | Documento | Qué firma |
|---|---------|-----------|-----------|
| A | T.J.R. Hughes, J.A. Cottrell, Y. Bazilevs (ICES, UT Austin) | *Isogeometric analysis: CAD, finite elements, NURBS, exact geometry and mesh refinement*, CMAME **194** (2005) 4135–4195 | El puente geometría↔simulación. h/p/**k**-refinement. Qué cuesta. |
| B | N.M. Patrikalakis (MIT 13.472J/1.128J/2.158J/16.940J) | *Computational Geometry*, Lecture 6: B-splines (uniform and non-uniform), 2003 | La definición dura: nudos, continuidad, De Boor, Boehm, NURBS, parches recortados. |
| C | Wenping Wang, Bert Jüttler, Dayue Zheng, Yang Liu | *Computation of Rotation Minimizing Frames*, ACM TOG **27**(1), art. 2 (2008) | Barridos sin torsión. Robustez numérica contra cancelación. |
| D | E. Andreassen, A. Clausen, M. Schevenels, B.S. Lazarov, O. Sigmund (DTU) | *Efficient topology optimization in MATLAB using 88 lines of code*, SMO **43** (2011) 1–16 | SIMP modificado, filtros, checkerboard, escala mínima. |
| E | Yorik van Havre | *A FreeCAD Manual* — Part Design, Sketcher, Part, Mesh | Cómo un CAD libre real estructura features, historia, referencias y validez. |

### 0.1 Lo que este corpus NO contiene (y por lo tanto no puedo citar)

Sé honesto de entrada, porque el resto del pliego depende de dónde termina la evidencia:

- **No hay números de tolerancia de OCCT.** `Precision::Confusion` (1e-7 mm), `Precision::Angular`,
  el parámetro *fuzzy* de `BRepAlgoAPI_*`, `ShapeFix_Shape` — nada de eso está en el corpus.
  El manual de FreeCAD nombra la herramienta **Check Geometry** del Part Workbench y ya. Los
  valores numéricos que use este pliego para OCCT van marcados como extensión.
- **No hay una regla escrita sobre "filetear antes o después de vaciar".** El ejercicio del Lego
  (cap. *Modeling for product design*) no usa fillets. La regla existe, pero hay que **derivarla**
  de la aritmética de offset — lo hago en §2.1 y va marcada.
- **No hay Euler-Poincaré.** El manual da la escalera topológica completa (Vertex→…→Compound)
  pero nunca escribe la fórmula. Extensión declarada.
- **Hughes NO resuelve superficies recortadas ni mallado volumétrico.** Los lista como problemas
  ABIERTOS en sus conclusiones. Eso no es una laguna del pliego: es el dato central de §3.
- **Wang no cubre auto-intersección del barrido.** Da el marco (frame) sin torsión; que el tubo
  resultante no se coma a sí mismo en una curva muy cerrada es problema aparte.

---

## 1. EL PROCESO A MANO / EL MODELO MENTAL

### 1.1 La escalera topológica — el único invariante que no se negocia

El manual (E) la escribe completa y en orden. Cítala tal cual, porque es el esqueleto del validador:

> "Everything starts with Vertices. With one or two vertices, you form an **Edge** (full circles have
> only one vertex). With one or more Edges, you form a **Wire**. With one or more **closed** Wires, you
> form a **Face** (the additional Wires become 'holes' in the Face). With one or more Faces, you form
> a **Shell**. When a Shell is **fully closed (watertight)**, you can form a **Solid** from it. And finally,
> you can join any number of Shapes of any types together, which is then called a **Compound**."

Tres consecuencias operativas inmediatas:

1. **`isClosed()` es la compuerta de la escalera.** "In order to make a Face, we need closed Wires,
   so it is always a good idea to check that before creating the Face." El manual pone el
   `print(W.isClosed())` explícito antes del `Part.Face(W)`.
2. **Extruir una Face SIEMPRE da un Solid; extruir un Wire da un Shell hueco.** Literal:
   "when extruding a single Face, we always get a Solid. This wouldn't be the case, for example, if
   we had extruded the Wire instead… which will of course give us a hollow shell, with the top and
   bottom faces missing." Si tu `extrude` devuelve Shell, el bug está río arriba, en el Wire.
3. **Geometría base ≠ topología.** "A `Part.Line` (as well as `Part.Circle`, `Part.Arc`,
   `Part.Ellipse` or `Part.BSpline`) does **not** create an Edge, but rather a base geometry on which
   an Edge will be created. Edges are always made from such a base geometry, which is stored in its
   `Curve` attribute." La curva vive aparte del Edge; el Edge es la curva **recortada**. Esa
   separación es exactamente la que hace posible (y frágil) el recorte, §2.6.

Y el detalle que el manual regala y todo el mundo pisa: **"full circles have only one vertex"**.
Cualquier chequeo que exija `edge.vertices.length === 2` reprueba todos tus barrenos.

### 1.2 El modelo paramétrico: features, DAG, recomputación

FreeCAD lo define sin adornos:

> "Parametric objects, in FreeCAD, are in reality **small pieces of a program that run whenever one of
> the parameters has changed**."

Y el objeto puede tener como parámetro **otro objeto** — "This last type allows quickly building
complex chains of operations, each new object being based on a previous one." Eso es la historia:
no una lista, un **grafo dirigido**. Las dos garantías que el kernel da y las dos reglas que impone:

**Garantías**
- *Toda* la cadena intermedia sigue viva y editable: "All the intermediary operations (2D shapes, pad,
  pocket, etc) are still there, and you can still change any of their parameters anytime. The whole
  chain will be rebuilt (recomputed) whenever needed."
- Part Design garantiza **solidez por construcción**: "it can only produce solid shapes (the rule
  number one of Part Design)… you will always obtain a printable object", y "as long as you take care
  of always building **one step on top of the previous one**, you are actually building one final solid
  object."

**Reglas**
- **La recomputación NO es automática.** "Heavy operations… are not performed automatically. Instead,
  the object (and all the objects that depend on it) will be **marked for recomputation**." Hay un
  estado *sucio* explícito y una propagación de marca aguas abajo.
- **El DAG debe ser acíclico.** "The dependency tree must always flow in the same direction. **Loops are
  forbidden.**… you can have many objects that depend on the same object." Y hay una herramienta para
  verlo: *Tools → Dependency graph*. La prohibición es tan dura que en el capítulo de hojas de
  cálculo obliga a **dos** hojas: "We can therefore not use the same spreadsheet to read and write
  values to a 3D object. That would make the object depend on the spreadsheet, which would also
  depend on the object. Instead, we will create another spreadsheet."

### 1.3 Referencias persistentes — el naming topológico, en las palabras del manual

FreeCAD no usa la frase "topological naming" en este manual, pero describe **las dos mitades del
problema y su cura parcial**, y esto es lo más valioso del documento E para nosotros.

**Mitad 1 — la identidad del objeto.** El manual la resuelve, y lo dice con toda claridad:

> "each object, in a FreeCAD document, has an **internal name**, which is unique in the document, and a
> **label**, which is what appears in the tree view… FreeCAD will allow you to give the same label to
> more than one object. This is why **all operations that must identify an object with absolutely no
> doubt, will use the internal name instead of the label**, which could designate more than one object."

Y antes: el Name "is unique in the document and **cannot be edited**". Identidad = **inmutable, emitida
por el sistema, invisible al usuario**. El Label es cosmética. Ésa es la respuesta de un CAD serio a
"¿a qué me estoy refiriendo?" — y aplica igual a subformas.

**Mitad 2 — la identidad de la SUBFORMA (cara/arista), que es donde duele.** El manual la deja
abierta y admite el remiendo:

> "When you create a sketch with a face selected, **a relation is created between that face and the
> sketch**, which is important for further operations. You **can always remap a sketch to another face
> later** with the Map Sketch tool."

Traducción: el vínculo croquis↔cara es una referencia con nombre, y cuando el nombre deja de apuntar
a lo correcto (porque una operación río arriba renumeró las caras) **el remedio es manual: remapear**.
Ése es el estado del arte del CAD libre, dicho sin marketing.

**La tercera pieza — el ancla geométrica.** Part Design evita referencias frágiles anclando el croquis
a algo que no se mueve:

- El Pad **no se puede mover**: "It is attached forever to its sketch. If you want to change the
  position of the pad, you must move the base sketch… this is an additional security."
- Y el croquis se ancla al **origen**, no a una cara: la restricción punto-sobre-punto final
  "was not absolutely necessary… However… By adding that constraint we are making sure that our
  piece will always stay **anchored to that origin point**."
- Para restringir contra la cara sin depender de su geometría real se usa **External geometry**:
  "The external geometry is **not 'real'**, it will be hidden when we leave edit mode. But we can use it
  to place constraints."

**La válvula de escape:** cuando la historia pesa más de lo que aporta, se **hornea**. "There are two
simple ways to get rid of the history, one is using the **Create simple copy** tool… the other way is
**exporting the piece as a STEP file and reimporting it**." El caso de uso que da el manual es exacto
al nuestro: 500 ladrillos en un castillo, no quieres 500 historias.

### 1.4 El proceso a mano, tal como el cliente lo ejecuta

La secuencia del ejercicio del Lego, que es el proceso canónico de Part Design:

1. **Croquis en un plano de referencia** (XY), no en una cara. Rectángulo dibujado *a ojo*: "You can
   place the two points anywhere, since their correct location will be set in the next step."
2. **Restricciones automáticas primero** (vertical/horizontal/coincidencia en las esquinas), luego
   **cotas** (distancia vertical 23.7, horizontal 47.7), y al final **ancla al origen** → croquis
   *fully constrained* (verde).
3. **Pad** 14.4 mm.
4. **Croquis sobre una cara del sólido** + **External geometry** para importar aristas de esa cara +
   cotas contra las aristas importadas → **Pocket** 12.6 mm (deja pared de 1.8).
5. **Feature + patrón**, no copia: "this is not just a duplication of an object, it is a **feature** of
   our shape that has been duplicated, the final object is still only one solid object." Linear
   Pattern: longitud 36 mm, 4 ocurrencias.
6. Repite pad→patrón, pocket→patrón para los pines y sus barrenos.

Dos comentarios del cliente que valen oro y que un lector rápido salta:

- **Sobre la elección de camino:** "We have several possibilities: create a sketch with three circles,
  pad it then pocket it three times, or create a base sketch with one circle inside the other… **Here,
  we will take the safest approach, and do things one step at a time.**" El cliente *prefiere el camino
  con más features y menos riesgo por feature*.
- **Sobre el fracaso:** "as we will advance into more complex objects, **some operations might not give
  the correct result and we often need to try other ways**." El fracaso de una operación es esperado,
  no excepcional. Un kernel serio se diseña alrededor de eso.

### 1.5 El otro modelo mental: parche recortado (el que usa OCCT de verdad)

MIT (B) §6.8.3 define el objeto que realmente puebla nuestro B-Rep:

> "R(u,v) is an **untrimmed patch** in the parametric domain (u,v) ∈ [A,B]×[C,D]. Describe **external
> loop** as a set of edges (i.e. curves in parameter space r_i(t) = [u_i(t_i) v_i(t_i)])… while the
> **internal loop** is made up of curve {r6}."

Una cara de OCCT = **superficie NURBS sin recortar + lazos de recorte en el espacio (u,v)**: un lazo
externo y N lazos internos (los agujeros). Guarda esta imagen: es la que explica por qué la booleana
es cara y frágil (§2.3) y por qué la isogeometría no nos aplica de una (§3).

---

## 2. REGLAS PRESCRIPTIVAS EN PROSA

Numeradas `R-xx` para poder referenciarlas desde el código. Marca de origen:
`[LIT]` = literal del corpus · `[DER]` = derivada con la derivación a la vista · `[EXT]` = extensión declarada.

### 2.1 Orden de operaciones

**R-01 `[LIT]` — Cada feature se construye SOBRE la anterior, nunca al lado.**
"as long as you take care of always building **one step on top of the previous one**, you are actually
building one final solid object." Si un feature no toca al sólido previo, Part Design produce dos
cuerpos y la garantía de solidez se rompe en silencio.

**R-02 `[LIT]` — Croquis base en plano de referencia y anclado al origen; croquis derivados sobre cara
+ External geometry.** El primero fija el objeto en el espacio; los siguientes se restringen contra
aristas importadas, que son referencias **declaradas** y remapeables, no coordenadas tecleadas.

**R-03 `[LIT]` — Ante dos caminos, toma el de más pasos y menos riesgo por paso.**
"Here, we will take the safest approach, and do things one step at a time." Una booleana grande que
puede fallar vale menos que tres chicas que no fallan.

**R-04 `[LIT]` — Prefiere PATRÓN de feature sobre copia de sólido.** El patrón mantiene un solo
sólido y una sola historia; la copia multiplica cuerpos y booleanas.

**R-05 `[DER]` — Vaciar (shell) ANTES de filetear, salvo que quieras el redondeo también por dentro;
en ese caso, filetea afuera con r_ext > t y luego vacía.**
*Derivación (no está en el corpus, es aritmética de offset):* el vaciado es un offset de las caras a
distancia `t`. Si fileteas primero con radio `r`, el offset interior de esa cara de mezcla tiene radio
`r − t`. Si `r < t`, el radio interior es negativo → la superficie se **auto-interseca** y la operación
o truena o entrega basura. Si `r > t`, el fillet interior **emerge solo** con `r_int = r_ext − t`, que
es justo lo que quieres en una pieza de pared constante. Si `r = t`, degenera a arista viva.
Regla operativa: `r_ext ≥ 1.2·t` si fileteas antes de vaciar; si no puedes garantizarlo, **vacía
primero y filetea después**.

**R-06 `[DER]` — Los fillets van LO MÁS TARDE posible en la historia.** Tres razones acumulativas,
todas apoyadas por el corpus:
(a) es la operación más frágil, y "some operations might not give the correct result" `[LIT]` — si
falla al final, pierdes un feature, no el modelo;
(b) un fillet **consume aristas y las sustituye por caras nuevas**, así que renumera todo lo que esté
río abajo → maximiza el daño del naming topológico (§1.3);
(c) filetear al final permite **degradación graciosa**: bajas el radio o saltas la arista y sigues
teniendo una pieza válida.

**R-07 `[DER]` — El desmoldeo (draft) va ANTES de los fillets.** El draft inclina las caras planas; el
fillet mezcla las caras *tal como quedaron*. Si fileteas primero, el draft tiene que inclinar la
superficie de mezcla, que ya no es plana → offset de superficie curva variable, el caso frágil de R-05.

**R-08 `[LIT]` — Cuando la historia deja de aportar, hornéala.** *Create simple copy* o round-trip
STEP. Aplica a: piezas repetidas en ensamble, librerías de partes, y — nuestro caso — el sólido que se
va al mallador.

### 2.2 Tolerancias geométricas del kernel

**R-09 `[LIT]` — La unidad es real y no perdona.** "One millimeter will be one millimeter in real-life.
**Every dimension matters.**"

**R-10 `[LIT]` — La conversión a malla es una DEGRADACIÓN con perilla, y la perilla se audita.**
"some **loss of quality** of your model will unavoidably occur during the process… you must always make
sure this loss of quality stays **below your minimal requirements**." El parámetro es la **desviación**:
default `0.10`, fino `0.01` (el manual muestra las dos triangulaciones lado a lado). Contrato: la
desviación de teselado es una **entrada declarada** del análisis, no un default escondido.

**R-11 `[LIT]` — La geometría curva NO se guarda muestreada, se evalúa.** "in both vectorial images and
BREP data, the position of any point on a curve is **not stored in the geometry but calculated on the
fly, with exact precision**." Corolario para nosotros: nunca dejes que una representación muestreada
(voxel, malla, la superficie r(φ,z) de la rosca) sea la **fuente de verdad**. Es una vista.

**R-12 `[EXT]` — Presupuesto de tolerancia explícito y jerárquico.** *No está en el corpus; viene de
cómo OCCT modela tolerancia (cada Vertex/Edge/Face carga la suya).* Regla propuesta:
`tol(vertex) ≥ tol(edge) ≥ tol(face) ≥ Precision::Confusion`, y **audita el máximo**: si
`max_tol > 1e-3 mm` en un sólido de escala molde, alguna operación río arriba ya "curó" una falla
inflando tolerancia y el sólido es una bomba de tiempo para la siguiente booleana.

**R-13 `[EXT]` — La razón feature-mínimo / tolerancia es el predictor barato de falla.** Si el
detalle más chico de la geometría (espesor de nervadura, luz entre dos caras, radio de fillet) es
menor que ~10× la tolerancia efectiva de las caras involucradas, la operación va a fallar o va a
producir *slivers*. Es exactamente el dolor "las booleanas truenan con geometría fina".

### 2.3 Cuándo una booleana va a fallar

Ésta es la joya del manual (E) y está escondida en un ejercicio de mesa:

**R-14 `[LIT]` — La herramienta de corte DEBE sobresalir. El traslape exacto es el modo de falla.**

> "You will notice that the cylinders are a bit **longer than needed**. This is because, as in all
> solid-based 3D applications, **boolean operations in FreeCAD are sometimes oversensitive to
> face-on-face situations and might fail**. By doing this, we put ourselves on the safe side."

El overshoot **no es descuido, es la técnica**. Regla operativa: toda herramienta de corte
sobresale por ambos extremos ≥ `max(0.1 mm, 3·tol_efectiva)`. Y su corolario incómodo: un validador
que exija "la herramienta toca exactamente la cara" está **pidiendo la falla**.

**R-15 `[LIT]` — El orden de los operandos es semántico, no conmutativo.** "select the first one, that
is, the one that will **stay**, then, with the CTRL key pressed, select the other one, that will be
**subtracted** (the order is important)".

**R-16 `[LIT]` — Los operandos NO desaparecen; siguen en el grafo.** "the newly created object, called
'Cut', **still contains the two cubes** we used as operands… they have merely been hidden and grouped."
Consecuencia de memoria (crítica en WASM): cada booleana **retiene** sus entradas. Una historia larga
de cortes retiene N sólidos vivos. Éste es un sospechoso directo del heap reventado.

**Taxonomía de falla `[DER]`** — el manual da la causa raíz ("face-on-face"), yo la despliego:

| Configuración | Por qué truena | Prevención |
|---|---|---|
| Caras **coplanares** entre operandos | La intersección es un área, no una curva; el clasificador dentro/fuera no tiene signo | Overshoot (R-14) |
| Caras **tangentes** (cilindro que roza plano) | La curva de intersección degenera a un punto/línea de contacto | Desplaza 0.01–0.1 mm, o usa fuzzy |
| Aristas **casi** coincidentes (dentro de tolerancia pero no iguales) | Genera *slivers*: caras de área ~0 que el siguiente paso no sabe clasificar | Snap a rejilla o fuzzy ≥ separación |
| Feature **más fino que la tolerancia** | La sección se pierde; el sólido queda con shell abierto | R-13 |
| Muchos operandos encadenados | Cada paso hereda e infla tolerancia; el error se acumula | Hornea (R-08) entre bloques |

**R-17 `[EXT]` — Reintento con tolerancia inflada, en escalera declarada, y se registra.**
*No está en el corpus; es API de OCCT.* Cuando una booleana falle, el reintento sube la tolerancia
de los operandos en una escalera (1e-7 → 1e-5 → 1e-4 → 1e-3 mm) y **el valor que funcionó se guarda
en el feature**, porque sube la tolerancia del resultado y el siguiente paso tiene que saberlo (R-12).

> ⚠️ **VERIFICADO EN NUESTRO BUILD (2026-07-31):** el camino canónico —
> `BRepAlgoAPI_*::SetFuzzyValue()` — **NO existe aquí**. `BOPAlgo_Options` está sin enlazar
> (`∅ NO EXPUESTO`), `BRepAlgoAPI_Cut_3` no expone **ningún** método `Fuzzy/IsDone/HasErrors`, y
> `BRepAlgoAPI_Check_2` ni siquiera construye (`UnboundTypeError: unbound types: BOPAlgo_Options`).
> **El sustituto sí está disponible y sí funciona:** `ShapeFix_ShapeTolerance`, con
> `SetTolerance(shape, tol)` y `LimitTolerance(...)` — infla la tolerancia de los operandos
> *antes* de la booleana. Es el fuzzy del pobre y es lo único que tenemos. Ver §6.0.

### 2.4 Robustez numérica

Aquí manda Wang (C). El papel entero es una clase magistral de por qué un método "correcto" es
inservible y otro "equivalente" es sólido.

**R-18 `[LIT]` — No uses el marco de Frenet para barridos. Punto.**
"the Frenet frame is **not continuously defined** for a C¹ spine curve, and even for a C² spine curve
the Frenet frame becomes **undefined at an inflection point** (i.e., curvature κ = 0), thus causing
unacceptable discontinuity when used for sweep surface modeling." Y "its rotation about the tangent of
a general spine curve often leads to **undesirable twist**".
En cambio, "the RMF is defined continuously for **any C¹ regular** spine curve."

**R-19 `[LIT]` — El método correcto es DOBLE REFLEXIÓN, y cuesta lo mismo que los malos.**
Global O(h⁴), un paso O(h⁵). Los dos métodos "prevailing" (proyección de Klok, rotación de
Bloomenthal) son O(h²) — "while all these methods have **nearly the same per-frame computational
cost**". Y contra Runge-Kutta de 4º orden: misma precisión, "much simpler and faster".
Algoritmo completo (Tabla I), 9 líneas, sin raíces cuadradas:

```
v1  = x[i+1] - x[i]
c1  = v1·v1
rL  = r[i] - (2/c1)*(v1·r[i])*v1
tL  = t[i] - (2/c1)*(v1·t[i])*v1
v2  = t[i+1] - tL
c2  = v2·v2
r[i+1] = rL - (2/c2)*(v2·rL)*v2
s[i+1] = t[i+1] × r[i+1]
U[i+1] = (r[i+1], s[i+1], t[i+1])
```

**R-20 `[LIT]` — Cero *thresholds*. Si tu código tiene un `if (casi_colineal)`, el método está mal
elegido.**
"the double reflection method is **free of the threshold problem** which plagues the rotation
method… it produces the RMF exactly (or accurately) in a numerically stable manner **even for a
sequence of points on a spine curve which is a straight line** (or nearly a straight line), using the
same unified procedure. Hence, **it does not need threshold testing**."
La razón, y ésta es la lección transferible a *cualquier* rutina geométrica: R1 usa
`v1 = x1 − x0`, que "can be assumed to be a nonzero vector" sin importar colinealidad; y para R2,
cuando t0 y t1 se vuelven colineales, `v2 = t1 − t0L → t1 + t0 ≈ 2t1`, o sea **crece en vez de
colapsar**. El método está construido para que el denominador nunca se acerque a cero.

**R-21 `[LIT]` — Más densidad de muestreo puede EMPEORAR el resultado. La cura es cambiar la fórmula,
no la resolución.**
"when the points x(u_i) are sampled **too densely**, which may make the first reflection vector
v1 = x_{i+1} − x_i **too small** and therefore make computation of the reflection R1 **less stable**."
La solución de los autores usa sólo tangentes:
`v1 = 13(t_i + t_{i+1}) − (t_{i−1} + t_{i+2})`
y la justifican textual: "the computation of v1 in Equation (17) **does not involve subtraction
between two close quantities**, and therefore is numerically robust."
Ésta es LA regla de robustez numérica del pliego: **la cancelación catastrófica se evita
reformulando, no refinando.**

**R-22 `[LIT]` — Si la espina viene como puntos, estima tangentes a 5 puntos o pierdes el orden.**
"The **key requirement** for computing the t_i is that the approximation error of t_i to the true
tangent x′(u_i) is of the order O(h⁵), so the global error… will be of the order O(h⁴)."
Interior: `t_i = x_{i−2} − 8x_{i−1} + 8x_{i+1} − x_{i+2}`.
Frontera: `t_0 = −25x_0 + 48x_1 − 36x_2 + 16x_3 − 3x_4`; `t_1 = −3x_0 − 10x_1 + 18x_2 − 6x_3 + x_4`;
y las simétricas en el otro extremo. Requiere **n ≥ 4** (al menos 5 puntos).
*Advertencia:* una diferencia central de 2 puntos es O(h²) y **degrada el método entero a O(h²)** —
tiras el 4º orden por ahorrar dos multiplicaciones.

**R-23 `[LIT]` — El RMF de una curva CERRADA no cierra.**
"In general, the RMF of a **closed** smooth spine curve **does not form a closed moving frame**.
Therefore, when a closed moving frame with least rotation is needed, it can be generated by adding a
**gradual** [rotation]…" — un ángulo α(s) continuo con α(0)=0 repartido a lo largo del lazo.
Para La Forja esto no es teórico: **los circuitos de enfriamiento de Kazmer son lazos cerrados**. Si
barres el tubo con RMF puro, tienes un **salto de torsión en la costura**. Hay que medir el defecto
angular al cerrar y repartirlo.

**R-24 `[LIT]` — Costo relativo real de las operaciones.** "a `sqrt` or a **division** is about **six
times** more time-consuming than a multiplication; this makes sense because square root and division
are approximated by a truncated series in arithmetic hardware." Presupuesta así, no por conteo de
FLOPs planos.

**R-25 `[LIT]` — La reversibilidad es un test gratis.** El método es simétrico: "the same sequence of
frames in the **reversed order**… will be generated by applying the double reflection method starting
from x_n". Corre el barrido al derecho y al revés; si los marcos no coinciden, tienes un bug.
(Proyección y rotación también son simétricos; **Runge-Kutta no**.)

**R-26 `[LIT]` — Invariancia conforme como test de calidad de método.** "the double reflection method
satisfies this property, while the projection method, the rotation method and the Runge-Kutta method
**do not**." Un método discreto bueno preserva las invariancias del objeto continuo.

**R-27 `[LIT]` — Cox-de Boor: define 0/0 = 0.** MIT: "(set 0/0 = 0 above when it occurs)". Con nudos
repetidos ocurre **siempre**. Es una línea de código y es la diferencia entre NaN y una curva.

**R-28 `[DER]` — El denominador que te va a matar en las derivadas de B-spline.**
MIT ec. 6.24: `d_i = (k−1)·(P_i − P_{i−1}) / (t_{i+k−1} − t_i)`.
Si dos nudos separados **k−1 posiciones** casi coinciden, la derivada **explota** aunque la curva se
vea perfectamente lisa en pantalla. El defecto no está en la geometría: está en la
**parametrización**. Ésta es una causa numérica real y no obvia de que un fillet, un offset o un
mallado truenen sobre una curva "bonita". El validador debe mirar el **vector de nudos**, no sólo la
forma.

### 2.5 Continuidad G0/G1/G2 — cuándo importa y cómo se controla

MIT (B) da la ley exacta. Con orden `k` (grado `p = k−1`):

**R-29 `[LIT]` — Continuidad por multiplicidad de nudo.**
- Nudo simple: la base es `C^{k−2}` = `C^{p−1}`.
- Nudo de multiplicidad ρ: la base es **`C^{k−ρ−1}`** = `C^{p−ρ}`.
Tabla práctica para cúbicas (p=3): ρ=1 → C², ρ=2 → C¹, ρ=3 → C⁰ (esquina viva), ρ=4 → **rota**.

**R-30 `[LIT]` — Techo duro de multiplicidad.** Hughes: "Each unique internal knot value may appear
**no more than p times** or the curve becomes **discontinuous**." Chequeo O(n) y atrapa una clase
entera de geometría inválida importada.

**R-31 `[LIT]` — Repetir un PUNTO DE CONTROL también baja continuidad.** Hughes: "Repeating a knot **or
control point** k times decreases the number of continuous derivatives by k." No basta auditar nudos.

**R-32 `[LIT]` — Vector de nudos abierto (el que usa todo CAD).**
`T = {t0 = … = t_{k−1} < t_k ≤ … ≤ t_n < t_{n+1} = … = t_{n+k}}` — **k valores iguales** en cada punta,
`n−k+1` internos. Total de nudos = **n + k + 1** = (# puntos de control) + orden. Efecto: la curva
**interpola** el primer y último punto de control y es **tangente al polígono de control** ahí.
Restricción de existencia: **`n ≥ k − 1`**.

**R-33 `[LIT]` — Continuidad entre parches (el caso del recorte y del molde).**
- **G0 (posición):** `R⁽¹⁾(1,v) = R⁽²⁾(0,v)`, y en control: `R⁽¹⁾_{3i} = R⁽²⁾_{0i}` — **la fila de
  control se comparte**.
- **G1 (plano tangente / normal):**
  `R⁽²⁾_u(0,v) × R⁽²⁾_v(0,v) = λ(v)·R⁽¹⁾_u(1,v) × R⁽¹⁾_v(1,v)` con **λ(v) > 0**
  (si λ ≤ 0 la normal se **voltea** → cara invertida, §4).
  En control se reduce a **colinealidad**: `R⁽²⁾_{1i} − R⁽²⁾_{0i} = λ(R⁽¹⁾_{3i} − R⁽²⁾_{2i})`.
  Literal: "**collinearity of above polyhedron edges is required**."
Chequeo del validador: **G1 se verifica en los puntos de control, no muestreando la superficie.**
Es O(#control) en vez de O(#muestras), y es exacto.

**Cuándo importa cada una `[DER]` — para nuestro dominio:**
- **G0** siempre. Sin G0 no hay sólido, no hay malla, no hay pieza.
- **G1** manda donde algo **desliza o fluye**: superficies de partición del molde (deslizan bajo
  tonelaje), paredes de canal de enfriamiento (coeficiente de película), trayectoria CAM (una
  discontinuidad de tangente = un tirón del servo = una marca).
  Hughes lo dice para contacto: las mallas facetadas "create problems in **sliding contact**" mientras
  "NURBS geometries can attain **smoothness of real bodies**".
- **G2** manda donde importa la **apariencia especular** (superficie clase A) o donde hay una teoría de
  **placa/cascarón** o de **gradiente de deformación** que derive dos veces. Para placas de molde de
  acero: **G2 es lujo**. Para el volumen barrido de una fresa esférica en 5 ejes: no lo es.
- **k-refinement** (§3) es exactamente la maquinaria para **subir continuidad a voluntad** — Hughes
  logra bases `C^{r+p−1}`.

### 2.6 Parametrización de NURBS

**R-34 `[LIT]` — Pesos estrictamente positivos.** MIT: "where weights **w_i > 0**"; para superficies
"weights **w_ij ≥ 0**". Un peso ≤ 0 rompe partición de unidad y positividad → se pierde la cáscara
convexa y aparecen singularidades (denominador cero). **Chequeo O(n), obligatorio en toda importación.**

**R-35 `[LIT]` — Grado 2 racional es el MÍNIMO para un círculo exacto.** Hughes §4.1: "A **rational
quadratic** basis is the **minimum order** capable of representing a circular hole." Y los datos exactos
(Apéndice A.1–A.2): círculo unitario con **4 segmentos cuadráticos racionales**,
`Ξ = {0,0,0,1,1,2,2,3,3,4,4,4}`, puntos `(1,0), (1,1), (0,1), …` con pesos **`1, 1/√2, 1, 1/√2, …`**.
Si alguien "simplifica" a B-spline polinomial (todos los pesos = 1), **tu barreno deja de ser un
barreno** y ninguna prueba de área lo va a notar hasta que el pin no entre.

**R-36 `[LIT]` — Pesos todos iguales ⇒ es un B-spline polinomial.** Hughes: "If weights are equal,
NURBS become B-splines." Atajo del validador: si `std(w) < eps`, salta la división y usa la ruta
polinomial (más rápida, mejor condicionada).

**R-37 `[LIT]` — Parametriza por longitud de cuerda, y aspira a longitud de arco.**
MIT §6.5, interpolación cúbica: `û_1 = 0`, `û_{i+1} = û_i + |P_{i+1} − P_i|`, normaliza por `d = Σd_i`.
Luego **quita los nudos u_2 y u_{N−1}** "to obtain proper number of degrees of freedom (instead of
having to prescribe boundary conditions)". El sistema resultante es **bandado** → resolución O(n).
Y la nota que cierra: "There are also other more sophisticated ways to choose knot vector and
parameterization attempting to make **u proportional to arc length**." Traducción operativa: una
parametrización lejos de longitud de arco produce spans muy desiguales → R-28.

**R-38 `[LIT]` — Soporte local: quién afecta a qué.**
Curva: `P_i` afecta `[t_i, t_{i+k}]` — **k spans**, ni uno más.
Superficie: `R_ij` afecta `[u_i,u_{i+k}] × [v_j,v_{j+l}]`; y el subparche
`[u_i,u_{i+1}]×[v_j,v_{j+1}]` está afectado por `R_{p,q}` con `(p,q) ∈ [i−k+1..i] × [j−l+1..j]`.
Esto es el mapa exacto de **recomputación mínima** cuando arrastras un punto de control.

**R-39 `[LIT]` — Cáscara convexa FUERTE y disminución de variación.** "Each span is in the convex hull
of the **k vertices contributing to its definition**." Consecuencias gratis:
(a) *rejection test* de intersección barato — si las cáscaras convexas de dos spans no se traslapan,
los spans no se intersecan (base de todo algoritmo de intersección serio);
(b) "**k consecutive vertices are collinear → span is a straight line segment**" — detecta tramos
rectos sin muestrear;
(c) sin oscilación de Gibbs: Hughes, "NURBS behave very differently… the NURBS curves are
**monotone**, illustrating the **variation diminishing property**", frente a Lagrange donde "as the order
is increased, the **amplitude of the oscillations increases**."

**R-40 `[LIT]` — Insertar nudos es EXACTO; usa Boehm.** "Knots may be inserted **without changing a
curve geometrically or parametrically**." Nuevos puntos: `P̂_i = a_i P_i + (1−a_i) P_{i−1}` con
`a_i = 1` si `i ≤ l−k+1`, `a_i = 0` si `i ≥ l+1`, y `a_i = (t̄ − t_i)/(t_{i+k−1} − t_i)` en medio.
Es la herramienta para: refinar sin deformar, **bajar continuidad a propósito** (meter una arista
viva), y **subdividir** (de Boor da los dos polígonos: izquierdo `P⁰₀P¹₁P²₂P³₃`, derecho
`P³₃P²₃P¹₃P⁰₃`).

**R-41 `[LIT]` — Insertar-nudo y elevar-orden NO conmutan, y el orden te cuesta.** Ver §3.2. Es la
diferencia entre `(r+1)n − rp` y `n + r` funciones base — **elevada a la dimensión**.

---

## 3. ISOGEOMETRÍA — LA PREGUNTA ESTRATÉGICA

### 3.1 El diagnóstico del cliente (por qué escribió el papel)

Hughes no arranca con matemáticas, arranca con economía y con una falla física:

- **"It is estimated that about 80% of overall analysis time is devoted to mesh generation in the
  automotive, aerospace, and ship building industries. In the automotive industry, a mesh for an
  entire vehicle takes about four months to create."**
- El mallado es "**costly, time consuming and creates inaccuracies**", y la malla es "a totally
  different geometric description for analysis and one that is **only approximate**."
- Refinar exige volver al CAD **en cada iteración**: "This link is often unavailable, which perhaps
  explains why **adaptive refinement is still primarily an academic endeavor** rather than an
  industrial technology."
- El daño concreto: cascarones delgados pierden carga de pandeo con imperfecciones geométricas de
  **1%, 10% y 50% del espesor** — y una malla facetada **es** una imperfección. En CFD, las
  aproximaciones lineales de la geometría causaban "spurious entropy layers" que "smooth geometry
  **completely eliminated**".

Y el argumento que cierra la puerta, de Szabó et al. `[LIT]`:

> "As solution polynomial order is increased, **the error plateaus at some level and cannot be further
> reduced**… The seriousness of this result is compounded by the fact that computed quantities defined
> **on boundaries** are usually the most important ones in engineering applications, and **this is where
> geometric errors are most harmful**."

Traducido a La Forja: **la aproximación de la geometría pone un PISO al error que ningún refinamiento
del solver atraviesa.** Nuestro mallado por voxelización no es "un poco impreciso": impone un techo
de exactitud, y lo impone justo donde medimos (flujo por la pared del canal, presión sobre la cara de
la cavidad, área proyectada para tonelaje).

### 3.2 Qué promete usar la MISMA representación

1. **La malla más gruesa YA es la geometría exacta.** "The **coarsest mesh encapsulates the exact
   geometry**. This means that mesh refinement is simply accomplished by **reindexing the parametric
   space**." Refinar = insertar nudos. Sin CAD en el lazo. Nunca.
2. **Concepto isoparamétrico con base NURBS:** los campos (desplazamiento, **temperatura**, velocidad)
   se representan con **las mismas** funciones base que la geometría; los coeficientes son las
   *variables de control*.
3. **Elementos = knot spans.** Ensamblado global idéntico a FEM clásico. Cuadratura de Gauss estándar
   sobre el elemento padre.
4. **h-refinement** = inserción de nudos (§R-40, exacta). **p-refinement** = elevación de orden
   (hay que repetir cada nudo único para preservar las discontinuidades de la p-ésima derivada).
5. **k-refinement** — la aportación original, y sale de que las dos operaciones **no conmutan**:
   - *p-refinement clásico* (insertar y luego elevar r veces): **`(r+1)n − rp`** funciones base, todas
     C⁰ en los nudos internos.
   - *k-refinement* (elevar r veces **primero**, luego insertar): **`n + r`** funciones base, con
     continuidad **`C^{r+p−1}`**.
   "This amounts to an **enormous savings** as n+r is considerably smaller than (r+1)n − rp. Keep in
   mind too that **in d dimensions these numbers are raised to the d power**."
6. **Propiedades que FEM no tiene:** partición de unidad; **base no negativa** ⇒ "every entry of the
   NURBS mass matrix is **non-negative**"; **disminución de variación** ⇒ ajustes monótonos, cero Gibbs;
   **covarianza afín** ⇒ movimientos de cuerpo rígido y estados de deformación constante **exactos**,
   y "structures assembled from compatible NURBS patches **pass standard patch tests**".
7. **Resultados medidos (no promesas):**
   - Placa infinita con barreno: tasas de convergencia en norma L² del esfuerzo de **2, 3 y 4** para
     cuadráticas, cúbicas y cuárticas. "This is the best one could reasonably hope for."
   - **Cilindro grueso a presión interna** (el caso más parecido a una placa de molde): error máximo
     en desplazamiento radial de **~1% (malla 1), ~0.1% (malla 2), ~0.01% (malla 3)**; y
     "order elevated solutions employing cubic and quartic NURBS are, **for all practical purposes,
     exact on all meshes**."
   - Condicionamiento: el CG diagonal "converged **without difficulty**" en todos los casos donde el
     solver directo se quedaba sin memoria. Y aquí Hughes es **honesto**: "The evidence we have for
     this is **rather skimpy** but we think it warrants further investigation."
8. **Optimización de forma:** "the finite element geometric description is **inconvenient** for shape
   optimization… NURBS present a more **concise parameterization** of design variables. Optimized NURBS
   descriptions **can be returned to CAD systems for manufacturing**, a distinct advantage."

### 3.3 Qué problemas de mallado DESAPARECEN

- La generación de malla como etapa (80% del tiempo) y el round-trip al CAD por iteración.
- El error geométrico de faceteado, y con él el **piso de Szabó**.
- La sensibilidad a imperfecciones en cascarones delgados.
- Las capas de entropía espuria / gradientes falsos en frontera curva.
- Los problemas de **contacto deslizante** sobre superficies facetadas.
- La reparametrización de variables de diseño para optimización de forma.

### 3.4 Qué CUESTA — lo que el propio Hughes deja abierto

Esto sale de sus **conclusiones**, no de mi escepticismo. Lista textual de lo que faltaba investigar:

- **(4) "developing procedures which account for TRIMMED SURFACE description (this is a
  significant challenge…)"** — ⚠️ **Éste es el bloqueador para nosotros.**
- **(3)** "developing **triangular and tetrahedral** isogeometric elements and associated **unstructured
  meshing** techniques" — o sea: sin eso, sólo hay parches tensor-producto estructurados.
- **(2)** "developing isogeometric **mesh generators**" — sí, IGA también necesita generar sus parches.
- **Refinamiento local:** "Refinement **necessarily propagates from patch to patch**… **Local refinement
  is an important and challenging research topic**." Es la maldición del tensor-producto: refinar
  alrededor de un canal de enfriamiento refina **toda la placa**.
- **Dirichlet:** "the basis **does not interpolate** control points and variables". Empotrar una cara ya
  no es "fija estos nodos"; hay que aproximar con funciones del espacio NURBS, o ecuaciones de
  restricción, o formulación débil. "Dirichlet boundary conditions need to be researched more
  thoroughly to determine optimal strategies."
- **Cuadratura:** la regla usada es una **regla de dedo** ("the rule of thumb that we typically
  employed…"), exacta sólo si los NURBS fueran B-splines y el jacobiano constante. "More research
  needs to be done to determine a **robust strategy** covering all situations." Y ojo:
  "**coarse meshes required more integration points** due to large variations in the geometrical
  mapping" — justo el régimen que nos interesaría (mallas gruesas).
- **Grado mínimo 2:** "in order to represent circles, cylinders and spheres, **rational polynomials of
  at least quadratic order are necessary**". No hay versión lineal barata.
- **Detalle de implementación no obvio:** hay **knot spans de medida CERO** por el vector de nudos
  abierto, y "may be **ignored** in the element formation phase". Un mallador que los trate como
  elementos degenerados reporta falsos positivos en cada parche.

### 3.5 ¿Aplica a La Forja? — el análisis honesto

**Lo que somos:** B-Rep de OCCT. Cada cara es **superficie NURBS + lazos de recorte en (u,v)**
(§1.5). Cada booleana, cada fillet, cada barreno **produce caras recortadas**. Nuestros entregables
son placas de molde (acero, cajas con barrenos, cavidades y circuitos de enfriamiento) y análisis
**térmico lineal / estructural lineal**.

**Los cuatro golpes, en orden de dureza:**

1. **Somos casi 100% geometría recortada; IGA exige parches tensor-producto sin recortar.** El único
   punto donde el papel toca el tema, lo marca como problema abierto y remite a la idea de Höllig
   (funciones de peso sobre rejilla rectangular) como "may be useful". Convertir nuestro B-Rep
   recortado a parches no recortados **es un problema de mallado con otro nombre**, y más duro que el
   tet meshing que ya tenemos.
2. **IGA necesita parches VOLUMÉTRICOS (trivariados) y el CAD sólo da la frontera.** Los "solids" del
   papel son B-splines trivariados con red de control `n×m×l` — un mapeo del **interior**. Nuestro
   B-Rep describe la **cáscara**. Construir un trivariado para una placa con 40 barrenos, dos
   cavidades y un circuito serpenteado es exactamente lo que Hughes lista como investigación
   pendiente. **Estaríamos inventando lo que los autores dijeron que no existía.**
3. **El refinamiento propaga.** Nuestro caso de uso natural (refinar donde está el gradiente térmico:
   pared del canal, esquina de la cavidad) es **precisamente** el que la maldición del tensor-producto
   prohíbe.
4. **Nuestra física no es sensible a la geometría en el sentido del papel.** Los casos donde IGA gana
   por goleada son **cascarones delgados** (pandeo sensible al 1% del espesor) y **capas límite**. Una
   placa de acero de 60 mm bajo tonelaje y una conducción térmica lineal en estado estable **no** están
   en ese régimen. El error de faceteado queda **muy por debajo** de la incertidumbre del coeficiente
   de película `h`, de las condiciones de contacto entre placas y de las propiedades del acero. Aquí
   la precisión geométrica extra **no compra decisión de ingeniería**.

**Y el argumento decisivo:** nuestro dolor no es **exactitud**, es **robustez**. Las booleanas truenan.
`filletAllEdges` revienta el heap del WASM. La isogeometría **no arregla ninguna de esas dos**. Lo que
haría es **añadir una tercera representación** a las dos que ya nos cuesta mantener.

### 3.6 Lo que SÍ nos llevamos de Hughes (tres préstamos baratos)

Tomar la **idea** de geometría exacta sin comprar el solver:

**P1 — Cantidades de frontera desde el B-Rep exacto, nunca desde el voxel.**
Hughes, literal: los valores "defined on boundaries are usually **the most important** ones… and this
is where geometric errors are most harmful." Flujo por la pared del canal, área de contacto, área
proyectada para tonelaje, volumen de la cavidad para el disparo: **todo eso se integra sobre la cara
NURBS**, con cuadratura de Gauss sobre los knot spans, y se le pasa al solver como dato. El voxel
resuelve el **interior**; la **frontera** la evalúa el kernel. Costo: bajo. Ganancia: quita el error
de faceteado exactamente donde más pesa.

**P2 — Frontera CURVA en la malla (super-isoparamétrico).**
Es el truco de la Fig. 2 del papel: "solution space is piecewise linear, while **geometry is piecewise
quadratic**. **Smooth geometry avoids spurious entropy layers**." Mantén los tets, pero sube las caras
de frontera a P2 con los nodos medios **proyectados sobre la cara NURBS**. Geometría cuadrática +
solución lineal. Es una función de proyección punto→superficie que OCCT ya tiene. No cambia el solver.

**P3 — El barrido del canal de enfriamiento en NURBS exacto con RMF de doble reflexión.**
Nada de tubo poligonal. Espina spline + R-19 + cierre de lazo R-23. Es geometría exacta donde de
verdad importa la curvatura, y es trabajo de un día.

### 3.7 VEREDICTO

> **NO adoptar análisis isogeométrico como arquitectura. SÍ adoptar tres préstamos concretos (P1–P3).
> Y correr UN experimento acotado antes de volver a hablar del tema.**

**El experimento** (el único caso donde el trivariado es gratis y el resultado es falsificable):
una **placa de molde rectangular sin recortes** es un solo parche B-spline trivariado **trivial** —
tres vectores de nudos y una red de control regular. Sobre ella: **térmico lineal estacionario**, IGA
cuadrático vs. nuestro voxel/tet, contra la solución analítica.
Métricas: error en el flujo de pared, DOFs para 1% de error, tiempo de armado.
Criterio de paso: **≥ 5× menos DOFs para la misma exactitud en flujo de pared.** Si no lo alcanza,
el tema se cierra por escrito y no se vuelve a abrir.
Si lo alcanza, el siguiente paso **no** es "IGA en todo": es IGA **sólo** en el subdominio de placa
limpia, acoplado al resto. Nada más.

---

## 4. CRITERIOS DE ACEPTACIÓN DE GEOMETRÍA → EL VALIDADOR

### 4.1 La definición de "válido" según el cliente

FreeCAD la enuncia en términos de **fabricación**, que es la definición que nos sirve:

> "you **always need to have a clear notion of which point is inside the material, and which point is
> outside**, because the 3D printer or the CNC machine needs to know **exactly** what is filled with
> material and what is not."

Un sólido es válido si y sólo si **la pregunta "¿este punto está adentro?" tiene respuesta única para
todo punto del espacio**. Todo lo demás son formas de que esa pregunta se rompa: una cáscara abierta
(no sabes), una cara invertida (respuesta contradictoria), una auto-intersección (dos respuestas), un
sliver (respuesta dentro del ruido).

Y el criterio de manufactura: "Making sure that your 3D objects are **solid**… Making sure about the
**dimensions**… **Controlling the degradation**."

### 4.2 El validador — chequeos ordenados por (costo × rendimiento)

Orden de ejecución: **corto-circuita en el primer fallo de nivel A**, porque los niveles siguientes dan
falsos positivos sobre geometría ya rota.

#### NIVEL A — Topología. O(n), microsegundos. Corren SIEMPRE, después de CADA feature.

| ID | Chequeo | Criterio de paso | Origen |
|----|---------|------------------|--------|
| **A0** | `BRepCheck_Analyzer(shape, true).IsValid_2()` | `true`. Es la implementación de referencia de OCCT y está **disponible en nuestro build** (verificado). ⚠️ **NECESARIA PERO NO SUFICIENTE:** probado, un shell abierto de 5 caras devuelve `IsValid = true`. Verifica buena formación de cada sub-forma, **no** estanqueidad. | `[EXT]` verificado |
| **A1** | `ShapeType` del resultado | Debe ser `Solid` (o `CompSolid` declarado). `Shell`/`Compound`/`Face` = **FALLA**. Extruir Face da Solid; si salió Shell, el Wire de entrada estaba abierto. | `[LIT]` E |
| **A2** | Todo Wire cerrado antes de crear Face | `wire.isClosed() === true`. Es la compuerta literal del manual. | `[LIT]` E |
| **A3** | Cáscara estanca — **el test exacto de una línea** | `VolumeProperties(shape, props, onlyClosed=**true**, …)` → `Mass() > 0`. Verificado: caja cerrada → 1000; el mismo shell con una cara menos → **exactamente 0.000** (con `onlyClosed=false` reporta **800**, un número plausible y **falso**). Alternativa/complemento O(n): cada Edge compartida por **exactamente 2** Faces. | `[DER]` de E, verificado |
| **A4** | Orientación coherente | Cada arista compartida se recorre en **sentido opuesto** por sus dos caras. Un solo par en el mismo sentido = cara invertida. | `[EXT]` |
| **A5** | Un solo cuerpo (salvo declaración) | `solids.length === 1`. Dos cuerpos = R-01 violada, un feature quedó flotando. | `[DER]` de E |
| **A6** | Lazos de cara bien formados | 1 lazo externo + N internos; los internos **dentro** del externo en (u,v) y **sin traslape** entre sí. | `[LIT]` B §6.8.3 |
| **A7** | Euler-Poincaré | `V − E + F − H = 2(C − G)` con H = lazos internos, C = cáscaras, G = género. Descuadre = topología corrupta aunque todo lo demás pase. | `[EXT]` |
| **A8** | DAG acíclico | Sin ciclos en la historia. "Loops are forbidden." | `[LIT]` E |

#### NIVEL B — Consistencia geométrica. O(n log n). Corren antes de mallar/exportar/cotizar.

| ID | Chequeo | Criterio de paso | Origen |
|----|---------|------------------|--------|
| **B1** | **Volumen con signo > 0** | `V = (1/3)·∮ x·n dA` sobre las caras. `V ≤ 0` ⇒ orientación global invertida. **El chequeo más barato y más rentable del pliego.** | `[EXT]` (divergencia) |
| **B2** | Volumen B-Rep vs volumen teselado | `\|V_brep − V_mesh\| / V_brep < 3·(desviación/L_car)`. Discrepancia = topología y superficie no cuentan la misma historia. Ata directo a R-10. | `[EXT]` |
| **B3** | Auto-intersección | AABB por par de caras → sólo pares que se traslapan → intersección triángulo-triángulo, **excluyendo** aristas compartidas. Cero intersecciones. | `[EXT]` |
| **B4** | Auditoría de tolerancia | `max(tol) ≤ presupuesto` (arranca en 1e-4 mm para escala molde). Reporta **qué feature** la infló. | `[EXT]` R-12 |
| **B5** | Slivers | Cero caras con `área < (10·tol)²`; cero aristas con `long < 10·tol`; cero ángulos diedros `< 1°` o `> 179°`. | `[EXT]` R-13 |
| **B6** | Detalle mínimo vs tolerancia | `min_feature / tol_efectiva ≥ 10`. Falla = **predicción** de que la siguiente booleana truena. | `[EXT]` R-13 |
| **B7** | Nudos válidos | No decreciente; `#nudos = n + k + 1`; `n ≥ k − 1`; abierto (k iguales en cada punta); **multiplicidad interna ≤ p**. | `[LIT]` A+B |
| **B8** | Pesos válidos | `w_i > 0` para todo i. Y si `std(w) < eps`, marca la superficie como polinomial (ruta rápida). | `[LIT]` B, R-34/36 |
| **B9** | Partición de unidad (auto-test) | Muestrea m puntos por span: `\|Σ N_{i,k}(u) − 1\| < 1e-12` y `N_{i,k}(u) ≥ 0`. Atrapa bugs de evaluador y el 0/0. | `[LIT]` A+B, R-27 |
| **B10** | Span degenerado en parametrización | Reporta si `min_i (t_{i+k−1} − t_i) < 1e-9·rango`. **El derivador explota antes que la geometría se vea mal.** | `[DER]` R-28 |

#### NIVEL C — Manufactura. Corren en la compuerta de entrega.

| ID | Chequeo | Criterio de paso | Origen |
|----|---------|------------------|--------|
| **C1** | Unidades y escala | Todo en mm. Bounding box dentro del sobre de la máquina. "Every dimension matters." | `[LIT]` E |
| **C2** | Degradación de teselado declarada | La desviación usada está registrada en el artefacto y es `≤` el requisito de la pieza. | `[LIT]` E |
| **C3** | Continuidad G1 donde desliza o fluye | Superficie de partición y pared de canal: colinealidad de aristas del poliedro de control con **λ > 0**. | `[LIT]` B, R-33 |
| **C4** | Cierre del barrido cerrado | Defecto angular del RMF al cerrar el lazo **repartido**, no acumulado en la costura. | `[LIT]` C, R-23 |
| **C5** | Croquis sobre-restringido | Cero. "This should be avoided, and FreeCAD will notify you." (Sub-restringido es **advertencia**, no falla: "You are never forced to work with fully constrained sketches".) | `[LIT]` E |

### 4.3 Cómo se reporta

Un fallo sin ubicación no sirve. Cada hallazgo lleva: `{check_id, severidad, feature_id de la historia
que lo introdujo, sub-shape id, coordenada XYZ, valor medido vs umbral}`. La **coordenada** es lo que
permite la nube de alarma visual que ya sabemos hacer (rojo sobre la geometría, `depthTest` off).

Y el invariante temporal, que es el que de verdad te salva:
**corre NIVEL A después de cada feature** y guarda el resultado en el nodo de la historia. Cuando el
sólido final salga inválido, ya sabes **exactamente qué feature lo rompió** sin bisecar a mano. Eso
convierte un bug de booleana de "tarde perdida" en "línea del log".

---

## 5. OPTIMIZACIÓN TOPOLÓGICA

Cliente D. El papel es una implementación de 88 líneas; las reglas son quirúrgicas.

### 5.1 La formulación

**SIMP modificado** (no el clásico):

```
E_e(x_e) = E_min + x_e^p · (E_0 − E_min),      x_e ∈ [0, 1]
```

`E_min` "is a **very small stiffness assigned to void regions** in order to prevent the stiffness matrix
from becoming **singular**". En el código: `E0 = 1`, **`Emin = 1e-9`**, `nu = 0.3`, `p = 3`.

Diferencia con el SIMP clásico y por qué importa: "In the classical SIMP approach, elements with zero
stiffness are avoided by imposing a **lower limit slightly larger than zero** on the densities x_e. The
modified SIMP approach has a number of advantages, most importantly that **it allows for a
straightforward implementation of additional filters**." Es decir: el SIMP modificado deja que
`x_e = 0` de verdad, y eso es lo que habilita los filtros de proyección.

Problema completo:
```
min_x   c(x) = UᵀKU = Σ_e E_e(x_e)·u_eᵀ k_0 u_e
s.a.    V(x)/V_0 = f ;  KU = F ;  0 ≤ x ≤ 1
```
Sensibilidades: `∂c/∂x_e = −p·x_e^{p−1}(E_0 − E_min)·u_eᵀ k_0 u_e` (siempre ≤ 0, la rigidez sólo
mejora con material), y `∂V/∂x_e = 1` **asumiendo volumen unitario por elemento**.

### 5.2 Optimality Criteria — el actualizador

```
x_e^new = clamp( x_e · B_e^η ,  x_e ± m )  ∩  [0,1]
B_e = (−∂c/∂x_e) / (λ · ∂V/∂x_e)
```
con **η = 1/2** (amortiguamiento numérico) y **m = 0.2** (move limit). λ por **bisección**
(`l1=0, l2=1e9`, tolerancia relativa `1e-3`) hasta cumplir volumen.
Paro: **L∞ de la diferencia entre dos diseños consecutivos < 1%** (`change > 0.01`).

### 5.3 Checkerboard y filtros — la parte que no es opcional

> "In order to **ensure existence of solutions** to the topology optimization problem and to **avoid the
> formation of checkerboard patterns**, **some restriction on the design must be imposed**."

No es cosmética: sin filtro el problema **no tiene solución** (no existe el mínimo) y la respuesta
depende de la malla. Tres filtros, en orden de madurez:

**(a) Filtro de sensibilidad** (Sigmund 1994/1997):
```
∂ĉ/∂x_e = 1/(max(γ, x_e)·Σ H_ei) · Σ_{i∈N_e} H_ei · x_i · ∂c/∂x_i
H_ei = max(0, r_min − Δ(e,i))
```
⚠️ **`γ = 1e-3` existe SOLO por el SIMP modificado**: "introduced in order to **avoid division by
zero**. This is a difference as compared to the original paper, where the classical SIMP approach is
used. In the classical SIMP approach, the **density variables cannot become zero**, and the term γ is
not required." Copiar el filtro del código de 99 líneas al de 88 **sin ese `max()`** te da división
entre cero.

**(b) Filtro de densidad** (Bruns-Tortorelli, Bourdin):
```
x̃_e = (Σ H_ei x_i) / (Σ H_ei)
```
Y la regla de reporte que casi todo el mundo viola:
> "the application of a density filter causes the original densities x_e to **loose their physical
> meaning**. One should therefore **always present the filtered density field x̃_e** rather than the
> original density field x_e as the solution."
Regla dura: **el entregable es x̃ (xPhys), nunca x.** Y con filtro de densidad hay que aplicar la
regla de la cadena `∂ψ/∂x_j = Σ_e (1/Σ H_ei) H_je ∂ψ/∂x̃_e` — es el paso que se olvida y da
gradientes inconsistentes.

**(c) Filtro PDE tipo Helmholtz** (Lazarov-Sigmund) — el que nos interesa a nosotros:
```
−r²∇²ψ̃ + ψ̃ = ψ ,   ∂ψ̃/∂n = 0 ,   r = r_min / (2√3)
```
Por qué: "The classical filter **requires information about the neighbor elements**, which **for
irregular meshes and complex geometries is obtained by a relatively expensive search**… the PDE filter
**utilizes the mesh used for the state problem** and does not require any additional information."
Y el costo: el filtro clásico escala con `r_min²` en 2D y **`r_min³` en 3D**; el PDE escala
**linealmente** en `r`. Conclusión textual: "for large filter radius, **especially in 3D**, the PDE
filtering scheme **should be the preferred choice**." Es volumen-preservante.

**Resultado que hay que verificar siempre:** "both sensitivity filtering and density filtering suppress
checkerboard patterns and lead to **mesh independent designs**; **refining the mesh only leads to a
refinement of the solution, not to a different topology**." **Ése es el test de aceptación:** corre a
dos resoluciones (2× elementos, mismo `r_min` **físico**). Si la topología cambia — número de barras,
número de agujeros — **el filtro está mal puesto** y el resultado es basura.

### 5.4 Fabricabilidad — reglas y sus límites reales

**Radio de filtro:** en los ejemplos, `r_min = 0.04 × ancho del dominio` (2.4 / 6 / 16 px para
60×20, 150×50, 300×100). `r_min` **es la escala mínima** y hay que fijarlo en unidades **físicas**
(≈ diámetro de la fresa o espesor mínimo imprimible), no en elementos.

**Blanco y negro / escala mínima — filtro Heaviside** (Guest et al. 2004):
```
x̄_e = 1 − e^{−β x̃_e} + x̃_e e^{−β}
∂x̄_e/∂x̃_e = β e^{−β x̃_e} + e^{−β}
```
**Continuación obligatoria:** β de 1 a 512, **duplicando cada 50 iteraciones o cuando `change ≤ 0.01`**.
Sin continuación caes en mínimos locales. Costo real: no cuesta tiempo por iteración, pero
"the number of iterations becomes **considerably larger**".
Nota práctica del papel: con Heaviside hay que **bajar** `r_min` (0.04 → **0.03**) porque
"the material resource constraint **prohibits** the transformation of the topology… into a
black-and-white design consisting of bars with a **large thickness**".

⚠️ **Y el límite que casi nadie cita:**
> "the minimum length scale imposed on the material distribution **does not prevent the occurrence of
> very small holes**. This can be avoided by using a more advanced filter such as the **morphological
> close-open or open-close** filter (Sigmund, 2007) or by following a **robust** approach in the
> formulation of the optimization problem (Sigmund 2009; Wang et al 2010)."

Es decir: **escala mínima en el SÓLIDO ≠ fabricabilidad.** El Heaviside te garantiza barras gruesas y
te deja agujeritos que ninguna fresa puede hacer. Para CNC/impresión hay que ir a close-open/open-close
o a la formulación robusta (erosión/dilatación, "manufacturing tolerant topology optimization").

**Incompatibilidad declarada:** "the Heaviside projection **relies on the compact support of the
classical filter** function to impose length scale in the solid regions, and therefore the Heaviside
projection **cannot be directly applied with the PDE filter**." → Si eliges PDE (para 3D), **pierdes**
Heaviside tal cual. Hay que elegir con los ojos abiertos.

### 5.5 Implementación — lo que hace la diferencia de 100×

Sin sacrificar legibilidad, el papel llega a **factor 100** (75.19 s → 0.72 s por iteración en
150×50). Las cinco palancas, literales:
1. **Vectorizar** los `for` de ensamble, compliance y filtrado.
2. **Preasignar** todo arreglo que se construya en un loop.
3. **Sacar del lazo** todo lo que no dependa de x (BCs, cargas, `edofMat`, `H`, `Hs`, `KE`).
4. Separar **variables de diseño `x`** de **densidades físicas `xPhys`** — es lo que hace posible el
   filtro de densidad.
5. Ensamblar con `sparse(iK, jK, sK)` (índices repetidos **se suman**), y luego
   **`K = (K+K')/2`** — el papel explica por qué: "ensures the stiffness matrix is **perfectly
   symmetric** in order to avoid that MATLAB uses a **less efficient algorithm**".

Y la nota de memoria, que en WASM es LA restricción: los vectores `iK`, `jK`, `sK` "are relatively
large and **remain in memory throughout the entire optimization loop**… considerably more than the size
of the stiffness matrix itself." El variante `conv2` evita construir `H` y por eso pasó de
**30,000 a 163,100** elementos en la misma máquina. **Para nosotros: filtro por convolución/PDE, nunca
matriz `H` explícita.**

---

## 6. BRECHA CONTRA LA FORJA

### 6.0 ⚠️ CUATRO HALLAZGOS VERIFICADOS EN EL BUILD (2026-07-31)

Antes de la brecha teórica: cuatro cosas que **medí**, no que supuse. Sonda ejecutada contra
`node_modules/opencascade.js@1.1.1/dist/opencascade.wasm.wasm`, el binario que ya enviamos.

**H1 — `volume()` miente sobre los sólidos rotos, y por eso el fillet resiliente no valida nada.**
`src/forja/brep/occt.ts:1362` llama
`BRepGProp.VolumeProperties_1(shape, props, /*onlyClosed=*/ false, false, false)`.
Medido: una caja cerrada de 10³ da **1000**; **la misma caja con una cara quitada** (shell abierto,
sólido inválido) da **800** con `onlyClosed=false` y **exactamente 0.000** con `onlyClosed=true`.
Consecuencia directa: `filletAllEdgesResilient` (`occt.ts:810`) usa **`volume(oc,s) > 0` como su
ÚNICO test de validez** — y ese test **pasa sobre una cáscara rota**. Nuestra única red de seguridad
del fillet está midiendo con una regla que no distingue sólido de cáscara.
**Arreglo:** añadir `volumeClosed(oc, shape)` con `onlyClosed=true` (no mutar `volume()`, hay
llamadores que miden formas abiertas a propósito) y usar **ése** en el test de validez del fillet,
en `keepSolid`, en `solidFromShell` y en la compuerta A3. Es **un argumento booleano** y convierte
un test decorativo en el chequeo de estanqueidad exacto.

**H2 — `BRepCheck_Analyzer` está disponible y nunca lo llamamos. Pero NO basta solo.**
Cero ocurrencias de `BRepCheck*` / `ShapeFix*` / `ShapeAnalysis*` en `src/` y `scripts/`. Están en el
build: `BRepCheck_Analyzer` construye con **2 parámetros** `(shape, geomControls)` y expone
`Init, IsValid_1, IsValid_2, Result`. Medido: `IsValid_2()` = `true` en una caja sana.
⚠️ **Y también `true` en el shell abierto de 5 caras.** El Analyzer verifica que **cada sub-forma esté
bien formada** (aristas con curva, caras con superficie, wires cerrados sobre su cara, orientaciones
coherentes) — **no** verifica que la cáscara encierre volumen. Por eso el validador necesita **A0 +
A3 juntos**: Analyzer para la sanidad local, `onlyClosed=true` para la estanqueidad global. Quien
implemente solo uno de los dos va a tener falsa confianza.

**H3 — `BRepClass3d_SolidClassifier` SÍ está expuesto. El comentario de `fea.ts:23` está equivocado.**
`fea.ts:23` dice *"este build de opencascade.js NO expone BRepClass3d_SolidClassifier — verificado"*.
Medido hoy: `BRepClass3d_SolidClassifier_2(box)` construye, `Perform(pnt, 1e-7)` corre, y clasifica
bien: `(5,5,5) → IN`, `(50,5,5) → OUT`, `(−1,5,5) → OUT`. Rendimiento: **2000 clasificaciones en
1084 ms** creando un clasificador nuevo cada vez (~0.54 ms/punto); reutilizando la instancia baja
mucho más. A `resolution = 16` son 4096 centros de voxel → **~2 s en el peor caso**.
Ese comentario es la causa raíz de que `brepToVolumeTetMesh` clasifique cada voxel por **ray-cast en
+X con Möller-Trumbore sobre la sopa de triángulos de `tessellate()`** — y de que
`mold-flow-cross.cjs` documente un **error de volumen de −34%** cuando las paredes quedan alineadas
al eje y el rayo las toca de canto. **Cambiar el clasificador de rayo a `SolidClassifier` mata ese
−34% de un golpe**, y de paso alinea el mallado con R-11 (la geometría se evalúa, no se muestrea).

**H4 — El barrido de tubos usa marco de FRENET por default. R-18 lo prohíbe explícitamente.**
`occt.ts:1187`: `sweepProfilePipeShell(oc, profile, path3d, frenet = true)` → `mk.SetMode_1(frenet)`,
y el comentario de arriba dice *"espina sin torcerse"* — que es justo lo que Frenet **no** garantiza.
Wang (cliente C) es tajante: Frenet "often leads to **undesirable twist**" y queda **indefinido en
puntos de inflexión (κ = 0)**. Nuestros canales de enfriamiento son curvas con inflexiones.
**Arreglo inmediato:** `frenet = false` — OCCT usa entonces su *corrected Frenet*, que es el marco
de torsión mínima. Es cambiar un default. Y para las trayectorias donde generamos la espina nosotros
(canales, roscas, CAM), la ruta correcta es calcular el marco con **doble reflexión (R-19)** y
alimentar el barrido con marcos explícitos.

### 6.1 Dónde estamos, dicho sin adorno

Kernel: `src/forja/brep/occt.ts` (1975 líneas, `opencascade.js@1.1.1`), 21 módulos TS y ~75 scripts
`.cjs` colgando de él.

| Capacidad | La Forja hoy | El cliente exige | Brecha |
|---|---|---|---|
| Escalera topológica | OCCT la tiene por debajo; `topology()` (`occt.ts:1344`) **calcula** V−E+F y nunca lo afirma | Compuerta explícita en cada paso | **No la verificamos en runtime.** El kernel puede devolver Shell y seguimos como si fuera Solid |
| Validez del sólido | Cero llamadas a `BRepCheck_Analyzer`. La UI (`ForgeBRepStudio.tsx:3779`) calcula topo/volumen/área y **solo los muestra** | "clear notion of which point is inside" | **Toda** — y las APIs ya están en el build (H2). Es **omisión**, no límite de plataforma |
| Booleanas | `occt.ts:487-515`: tres líneas, `new Cut_3(a,b).Shape()`. **Sin `IsDone()`, sin `HasErrors()`, sin try/catch, sin conteo de sólidos posterior** | Overshoot deliberado (R-14) + tolerancia graduada (R-17) | **Regla no codificada.** Y el fuzzy canónico **no existe en este build** — hay que usar `ShapeFix_ShapeTolerance` |
| Reparación | Cero `ShapeFix_*`. (Nota: `ShapeFix_Shape_2` construye pero **no expone métodos** en este build; `ShapeFix_ShapeTolerance` **sí**: `SetTolerance`, `LimitTolerance`) | Camino de reparación | **Toda**, con la ruta reducida a tolerancia |
| Tolerancias | Constantes mágicas dispersas: `1e-6` en `loftSections:1037`, `1e-3` en `shellSolid:934`, `0.01 mm` en `sewFaces:1950`, `0.1` de deflexión en `tessellate:1688` | Presupuesto explícito y auditado (R-12) | **No hay política.** Nadie consulta ni normaliza la tolerancia de una forma |
| `filletAllEdges` | Escalera `[r, .6r, .35r, .2r, min(r,.3), min(r,.15)]`, aborta bajo 0.05 mm, `try{}catch{}` desnudo, degradación limpia con `ok:false` + nota en español. **Bien diseñado** — pero su test de validez es el de H1 | Fillet al final + degradación graciosa (R-06) | **La degradación ya existe y está bien.** Lo que falla es el **juez**. Y el orden no está impuesto |
| Fillet + shell | Bug de kernel documentado en `timeline.ts:200-212`: una forma fileteada en todas las aristas **ya no se puede vaciar** (`wasmTable.get is not a function`). Parche: filtrar a aristas verticales | R-05/R-06 | Es **exactamente** la aritmética de offset de R-05 manifestándose como crash de WASM |
| Referencias | `FilletOp.edges: number[]`, `ShellOp.faces: number[]` = **índices del explorer**. `timeline.ts:184-187` lo documenta: *"los índices de cara BAILAN cuando se edita un paso anterior… Guardar 'cara #7' convierte cualquier edición en una bomba"*. Parche: re-emparejar por normal (score ≥ 0.85) y por verticalidad | Nombre interno **inmutable** (⭐7) | **Estructural.** La deuda más cara que tenemos |
| Mallado | `fea.ts:229` voxeliza el AABB, clasifica por **centro** con ray-cast (por H3, innecesariamente), 6 tets/voxel, `resolution` 16/18/12 | Degradación **declarada y auditada** (R-10) | Escalera de voxel, sin conformidad de superficie, sin métrica de calidad de tet, sin estudio de convergencia. Y −34% de error documentado |
| Croquis | `sketch-solver.ts:232` `rankAndMovable(A, n, 1e-7)` → DOF = nVars − rank(J), `status: 'full' \| 'under' \| 'over'` | C5 (sobre-restricción detectada) | ✅ **Esto ya lo cumplimos.** Único chequeo del pliego que ya está |
| TopOpt | `topopt.ts` = top88 literal: `Emin=1e-9`, `p=3`, `move=0.2`, `tolChange=0.01`, `ft ∈ {1,2}`, `rmin` en **mm** = `max(2·voxel, 0.07·minDim)` (más grande que el clásico, a propósito, para no sacar cuchillos). `topopt-am.ts`: filtro de voladizo 45° | §5 | Falta **`ft=3` Heaviside** con continuación β 1→512, falta **filtro PDE** (el que escala lineal en 3D), y falta **close-open** (⭐10) |
| Geometría vs análisis | B-Rep para dibujar, voxel para simular | Misma representación (IGA) o **frontera exacta** (P1/P2) | Aquí la respuesta honesta es **P1/P2/P3, no IGA** (§3.7, §6.4) |

### 6.2 QUÉ IMPLEMENTAR YA — ordenado por (bugs que atrapa) / (líneas de código)

Los cinco primeros son **día 1**. Los tres primeros suman menos de 60 líneas y ya están verificados
contra el binario que enviamos.

**① `volumeClosed()` — UN argumento booleano. El mejor retorno del pliego entero.**
```ts
export function volumeClosed(oc: OC, shape: Shape): number {
  const props = new oc.GProp_GProps_1();
  oc.BRepGProp.VolumeProperties_1(shape, props, /*onlyClosed=*/ true, false, false);
  const v = props.Mass(); props.delete?.(); return v;
}
```
Medido: caja cerrada → 1000, misma caja sin una cara → **0.000**. Es el test de estanqueidad
**exacto**, gratis y ya disponible. Sustitúyelo en `filletAllEdgesResilient:810`, `keepSolid:681`,
`solidFromShell:1960` y en A3. Hoy, esos cuatro juzgan con `volume()` (`onlyClosed=false`), que
sobre una cáscara rota devuelve **800** en vez de 0 (H1).

**② `A0 + A1 + A3` — el trío de la compuerta, ~40 líneas.**
`BRepCheck_Analyzer(shape, true).IsValid_2()` · `ShapeType === 'Solid'` · `volumeClosed(shape) > 0`.
Los tres juntos porque **ninguno basta solo**: el Analyzer no ve una cáscara abierta (H2), el
`ShapeType` no ve una cara invertida, y el volumen cerrado no ve una arista sin curva. Corren en
microsegundos **después de CADA feature**, y el resultado se guarda **en el nodo del timeline**.
Con eso, "la booleana truena tres pasos después" se convierte en "el feature #4 produjo un shell".

**③ H4 — `frenet = false` en `sweepProfilePipeShell`.**
Un default. Elimina la torsión indeseada y la indefinición en inflexiones que Wang documenta (R-18).
Para espinas que generamos nosotros, marcos explícitos por doble reflexión (R-19).

**④ H3 — cambiar el clasificador de voxel de ray-cast a `BRepClass3d_SolidClassifier`.**
El comentario de `fea.ts:23` que dice que no está expuesto **es falso en este build** (medido: IN/OUT
correctos, ~0.54 ms/punto con instancia nueva, ~2 s para los 4096 centros de `resolution=16`).
Mata el **−34% de error de volumen** documentado en `mold-flow-cross.cjs` cuando las paredes quedan
de canto al rayo. Empieza por **medirlo lado a lado** en esa misma pieza y publica los dos números.

**⑤ `B6` — el predictor de falla ANTES de llamar a la booleana.**
`min_feature / tol_efectiva ≥ 10`, medido sobre los operandos. Es el único chequeo que **previene**
en vez de diagnosticar, y ataca de frente "las booleanas truenan con geometría fina". Si falla:
`ShapeFix_ShapeTolerance.SetTolerance()` en escalera (R-17, porque el fuzzy nativo no existe aquí) o
rechaza la operación diciendo **cuál** detalle es demasiado fino.

**⑥ `R-14` codificada — overshoot automático en toda herramienta de corte.**
No es un chequeo, es un **cambio de API**: que `cut(target, tool)` extienda la herramienta por sí
misma `max(0.1 mm, 3·tol)` cuando el traslape sea coplanar o tangente. El cliente lo dice textual:
"we put ourselves on the safe side." Deja de ser criterio de quien escribe el feature.

**⑦ `B4` — auditoría de tolerancia con atribución.** `max(tol)` por sólido y **cuál feature la
infló**. Hoy las tolerancias son constantes mágicas dispersas (`1e-6`, `1e-3`, `0.01`, `0.1`) y nadie
las consulta. Cuando la tolerancia empieza a subir, el modelo se está pudriendo *antes* de reventar.

**⑧ `B10` — el span de nudos degenerado.** `min(t_{i+k−1} − t_i)` por curva/superficie. Diez líneas.
Detecta la curva "bonita en pantalla, imposible de filetear": el problema **no se ve**, está en la
parametrización (R-28).

**Cómo se despliega, para que no sea otro script muerto:** un solo módulo
`validate(oc, shape) → Hallazgo[]`, llamado (a) al final de cada feature del timeline y de
`ForgeBRepStudio.buildShape`, guardando el resultado **en el nodo**; (b) como compuerta dura antes de
mallar, exportar STEP o cotizar. Y una suite nueva en `scripts/` registrada en el catálogo `SUITES`
de `forja-gate.cjs`, corriendo sobre las **4 piezas del libro** (`kazmer-parts-build.cjs`) y las
**21 piezas Hammond**. **Un chequeo que no está en el gate no existe.**

Nota sobre el gate actual: `occt-brep-test.cjs` ya **exime** Euler = 2 en fillets ("caras periódicas
tienen aristas-costura"). Correcto — y es la razón por la que A7 (Euler-Poincaré) va en NIVEL A pero
con el término de género `G` bien puesto, no como `χ = 2` a secas.

### 6.3 Y lo que hay que arreglar aunque no sea un "chequeo"

- **Identidad de sub-formas — la deuda estructural.** Emitir un **ID inmutable** por cara/arista y
  propagarlo por cada operación (lo que OCCT llama `Modified()` / `Generated()` / `IsDeleted()` sobre
  `BRepBuilderAPI_MakeShape`), y que `FilletOp.edges` / `ShellOp.faces` referencien **ese ID**, no un
  índice del explorer. Hoy el parche es re-emparejar por normal (score ≥ 0.85) y por verticalidad
  (`timeline.ts:188-220`) — heurísticas puntuales, no un esquema. Es la lección literal de
  Name-vs-Label (§1.3, ⭐7).
- **Guardas de parámetro en el Part Studio.** `timeline.ts:92 validate()` protege el camino de la
  receta contra valores degenerados que **corrompen el heap del WASM y matan la sesión**.
  `ForgeBRepStudio.buildShape` **no tiene equivalente**. Es el mismo crash esperando en el camino
  interactivo, que es el que usa el humano.
- **Fillet al final + horneado entre bloques.** R-06 en la máquina de features; y como cada booleana
  **retiene sus operandos** (R-16), hornear con "simple copy"/STEP (R-08) entre bloques de features
  es la palanca directa contra el heap reventado. El bug fillet→shell (`wasmTable.get is not a
  function`) es R-05 manifestándose: el offset interior de la cara de mezcla no cabe.
- **La desviación de teselado como parámetro declarado** del análisis (hoy `0.1` por default en
  `tessellate:1688`), comparada contra el requisito de la pieza (R-10 / C2).
- **TopOpt: cerrar la brecha de fabricabilidad.** Nos falta `ft=3` Heaviside con continuación
  β 1→512 (duplicar cada 50 iteraciones o cuando `change ≤ 0.01`), el **filtro PDE** — el único que
  escala lineal en `r` y por eso el indicado en 3D — y **close-open/open-close morfológico**, porque
  el Heaviside **no impide los agujeritos** (⭐10). Y la advertencia que hay que respetar: Heaviside y
  filtro PDE **no se combinan directamente**; hay que elegir.

### 6.4 Recomendación honesta sobre isogeometría

**No.** No como arquitectura, no este año, y probablemente nunca en la forma del papel de 2005.

Las razones, en una línea cada una:
1. Nuestro B-Rep es **recortado** en casi todas sus caras, y Hughes lista el recorte como problema
   **abierto** en sus propias conclusiones.
2. IGA necesita parches **volumétricos** trivariados; el CAD sólo entrega la frontera, y construirlos
   es investigación pendiente según el mismo autor.
3. El refinamiento **propaga de parche a parche**; nuestro caso de uso (refinar en la pared del canal)
   es justo el prohibido.
4. Nuestra física — acero grueso, térmico lineal, estructural lineal — **no** es del régimen sensible a
   la geometría (cascarón delgado, capa límite) donde IGA gana por goleada.
5. Nuestro dolor real es **robustez**, no exactitud. IGA no arregla una sola booleana y **añade** una
   tercera representación a las dos que ya nos cuesta mantener.

**Pero el diagnóstico de Hughes sí nos aplica**, y hay que actuar sobre él: el **piso de Szabó** es
real, y nuestras cantidades de frontera (flujo de pared, área de contacto, área proyectada) hoy salen
del **voxel**, que es donde el error geométrico más daño hace. La respuesta correcta y barata es
**P1 + P2 + P3** (§3.6): integrar la frontera sobre la cara NURBS exacta, subir las caras de frontera
del tet a P2 con nodos proyectados, y barrer los canales con RMF de doble reflexión.

Y el único experimento que justifica volver a abrir el tema: **placa rectangular limpia, térmico
lineal estacionario, IGA cuadrático vs. voxel/tet, contra la solución analítica; criterio de paso ≥5×
menos DOFs para el mismo error en flujo de pared.** Si no pasa, se cierra por escrito.

**Y el orden importa: H1–H4 van ANTES que cualquier conversación sobre isogeometría.** Un argumento
booleano en `volume()`, una llamada a `BRepCheck_Analyzer` que ya está en el binario, un `false` en
el modo del barrido y un clasificador que creíamos ausente y no lo está — eso es menos de un día de
trabajo y arregla más de lo que arreglaría un año de reescribir el análisis sobre NURBS. **No
cambies de representación mientras la que tienes no se esté midiendo a sí misma.**

---

## 7. LOS 10 ⭐ — LO QUE UNA MÁQUINA LINEAL SE SALTA

**⭐1 — El grado 2 RACIONAL es el mínimo para un círculo, y el peso del arco de 90° es `1/√2`.**
Hughes: "A rational quadratic basis is the **minimum order** capable of representing a circular hole."
Apéndice A.2: pesos `1, 1/√2, 1, …` sobre `Ξ = {0,0,0,1,1,2,2,3,3,4,4,4}`. Si alguien "limpia" la
superficie a B-spline polinomial (todos los pesos = 1), **tu barreno deja de ser un barreno** —
y ninguna prueba de área lo detecta hasta que el pin no entra.

**⭐2 — Un círculo completo tiene UN vértice.**
Literal del manual de FreeCAD: "full circles have only **one** vertex". Todo validador ingenuo escribe
`assert(edge.vertices.length === 2)` y reprueba **todos** los barrenos de un molde.

**⭐3 — La derivada de B-spline explota por la PARAMETRIZACIÓN, no por la forma.**
MIT ec. 6.24: `d_i = (k−1)(P_i − P_{i−1})/(t_{i+k−1} − t_i)`. Si dos nudos separados **k−1** posiciones
casi coinciden, la derivada revienta aunque la curva se vea perfecta en pantalla. Es una causa real y
**invisible** de que un fillet u offset truene. Hay que auditar el **vector de nudos**, no la imagen.

**⭐4 — "Watertight" es la palabra del manual, y nuestro código la mide con una regla que no
distingue estanco de roto.**
El manual pone la compuerta: un Shell **"fully closed (watertight)"** se vuelve Solid. Nuestro
`volume()` (`occt.ts:1362`) llama `VolumeProperties_1(..., onlyClosed = **false**, ...)`.
**Medido hoy:** caja cerrada → `1000`. La misma caja **sin una cara** → **`800`** con
`onlyClosed=false` y **`0.000`** con `onlyClosed=true`. Y `filletAllEdgesResilient` usa
`volume > 0` como su **único** test de validez — o sea que **acepta cáscaras rotas**. Un argumento
booleano separa un test decorativo del chequeo de estanqueidad exacto.
*(De la misma familia: los knot spans de medida CERO **son normales**, vienen del vector de nudos
abierto, y Hughes dice que "may be **ignored** in the element formation phase" — un mallador que los
trate como elementos degenerados reporta un falso positivo en cada parche.)*

**⭐5 — El RMF de una curva CERRADA no cierra.**
Wang §6.3: "the RMF of a closed smooth spine curve **does not form a closed moving frame**." Los
circuitos de enfriamiento de Kazmer **son lazos cerrados**: barrer con RMF puro te deja un **salto de
torsión en la costura**. Hay que medir el defecto angular y **repartirlo** a lo largo del lazo.

**⭐6 — Muestrear MÁS DENSO empeora el barrido; la cura es cambiar la fórmula, no la resolución.**
Wang §6.2: con puntos muy densos `v1 = x_{i+1} − x_i` se hace chico y R1 pierde estabilidad. La
solución de los autores es otro vector de reflexión,
`v1 = 13(t_i + t_{i+1}) − (t_{i−1} + t_{i+2})`, elegido porque "**does not involve subtraction between
two close quantities**". Contra la cancelación catastrófica se **reformula**, no se refina.

**⭐7 — El problema del naming no es de geometría, es de IDENTIDAD — y FreeCAD ya dio la respuesta.**
"each object… has an **internal name**, which is unique… and **cannot be edited**, and a **label**…
This is why **all operations that must identify an object with absolutely no doubt, will use the
internal name instead of the label**." Identidad = inmutable, emitida por el sistema, invisible. Para
sub-formas FreeCAD **no** lo resolvió y lo admite: el remedio es **Map Sketch** (remapeo manual).
Nuestro timeline referencia caras **por índice** y cada booleana renumera. La cura es un **ID inmutable
propagado por el kernel**, no un índice — y nadie va a llegar a esa conclusión leyendo la API de OCCT.

**⭐8 — El overshoot de la herramienta de corte NO es descuido, es LA técnica.**
"the cylinders are a bit **longer than needed**. This is because… **boolean operations are sometimes
oversensitive to face-on-face situations and might fail**. By doing this, **we put ourselves on the safe
side**." Un validador que exija "la herramienta debe tocar exactamente la cara" está **pidiendo la
falla**. Hay que codificar el overshoot en la API, no dejarlo al criterio de quien escribe el feature.

**⭐9 — `γ = 1e-3` en el filtro de sensibilidad existe SOLO porque `E_min = 1e-9`.**
El papel lo explica: con SIMP modificado `x_e` **sí** puede ser 0, "in order to **avoid division by
zero**… In the classical SIMP approach, the density variables cannot become zero, and the term γ is
**not required**." Portar el filtro del código de 99 líneas al de 88 **sin ese `max(γ, x_e)`** te da
división entre cero. Dos constantes que parecen independientes y están acopladas.

**⭐10 — Escala mínima en el sólido ≠ fabricable: el Heaviside deja agujeritos.**
Textual: "the minimum length scale imposed on the material distribution **does not prevent the
occurrence of very small holes**." Te garantiza barras gruesas y te deja huecos que ninguna fresa hace.
Para CNC hace falta **close-open / open-close morfológico** o formulación robusta. Y de pilón, la
incompatibilidad que nadie cita: el Heaviside "**cannot be directly applied with the PDE filter**" —
justo el filtro que necesitas en 3D.

---

## APÉNDICE — FÓRMULAS PARA COPIAR (ASCII, sin LaTeX)

```
COX-DE BOOR                N(i,1,u) = 1 si u en [t_i, t_i+1), si no 0
                           N(i,k,u) = (u-t_i)/(t_i+k-1 - t_i) * N(i,k-1,u)
                                    + (t_i+k - u)/(t_i+k - t_i+1) * N(i+1,k-1,u)
                           OJO: define 0/0 = 0

CONTINUIDAD                nudo simple      -> C^(k-2)  = C^(p-1)
                           multiplicidad r  -> C^(k-r-1) = C^(p-r)
                           r > p            -> DISCONTINUA (invalido)

CONTEO                     #nudos = n + k + 1 ;  n >= k-1
                           P_i afecta [t_i, t_i+k]  (k spans)

DERIVADA                   P'(u) = suma d_i * N(i,k-1,u)
                           d_i = (k-1)(P_i - P_i-1)/(t_i+k-1 - t_i)     <- ojo denominador

INSERCION DE NUDO (Boehm)  P^_i = a_i P_i + (1-a_i) P_i-1
                           a_i = 1                            si i <= l-k+1
                           a_i = (t^ - t_i)/(t_i+k-1 - t_i)   si l-k+2 <= i <= l
                           a_i = 0                            si i >= l+1

NURBS                      R(u) = suma w_i P_i N(i,k,u) / suma w_i N(i,k,u) ,  w_i > 0
CIRCULO EXACTO             p=2 racional; arco 90 deg: pesos 1, 1/raiz(2), 1

G1 ENTRE PARCHES           Ru2 x Rv2 = lambda * (Ru1 x Rv1) , lambda > 0
                           en control: R2_1i - R2_0i = lambda (R1_3i - R1_2i)  [colineal]

RMF DOBLE REFLEXION        v1 = x[i+1]-x[i] ; c1 = v1.v1
                           rL = r[i] - (2/c1)(v1.r[i]) v1
                           tL = t[i] - (2/c1)(v1.t[i]) v1
                           v2 = t[i+1] - tL ; c2 = v2.v2
                           r[i+1] = rL - (2/c2)(v2.rL) v2
                           s[i+1] = t[i+1] x r[i+1]
TANGENTE DE PUNTOS         t_i = x_i-2 - 8 x_i-1 + 8 x_i+1 - x_i+2      (error O(h^5))
MUY DENSO -> usar          v1 = 13(t_i + t_i+1) - (t_i-1 + t_i+2)

SIMP MODIFICADO            E_e = Emin + x_e^p (E0 - Emin) ; Emin=1e-9, p=3, nu=0.3
SENSIBILIDAD               dc/dx_e = -p x_e^(p-1) (E0-Emin) u_e' k0 u_e
FILTRO SENSIBILIDAD        dc^ = 1/(max(gamma,x_e) suma H_ei) * suma H_ei x_i dc/dx_i
                           H_ei = max(0, rmin - dist(e,i)) ; gamma = 1e-3
FILTRO DENSIDAD            x~_e = (suma H_ei x_i)/(suma H_ei)   -> REPORTA x~, no x
FILTRO PDE                 -r^2 lap(psi~) + psi~ = psi ; r = rmin/(2 raiz(3))
HEAVISIDE                  x-_e = 1 - exp(-beta x~_e) + x~_e exp(-beta)
                           beta: 1 -> 512, x2 cada 50 iters o cuando change <= 0.01
OC UPDATE                  eta = 1/2 ; move = 0.2 ; bisec l1=0 l2=1e9 tol 1e-3
PARO                       max|x_new - x| <= 0.01

VOLUMEN CON SIGNO          V = (1/3) * integral_superficie (x . n) dA   ->  V > 0 o INVALIDO

CONVERGENCIA IGA (medida)  tasas L2 de esfuerzo: p=2 -> 2 ; p=3 -> 3 ; p=4 -> 4
k-REFINEMENT vs p          n + r  funciones  vs  (r+1)n - rp   [elevado a la dimension]
```

---

*Pliego basado exclusivamente en los cinco documentos listados en §0. Todo `[EXT]` y `[DER]` está
marcado en el punto de uso. Las tolerancias numéricas de OCCT no provienen de este corpus.*
