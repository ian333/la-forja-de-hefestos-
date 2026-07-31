# PLIEGO FEA — "los autores son el CLIENTE"
### Ejercicio de requisitos leyendo a los constructores de solvers FEA libres y a los teóricos del método
**Fecha:** 2026-07-31 · **Para:** La Forja (CAD/CAM en navegador, OCCT-WASM) · **Español mexicano**

---

## 0. QUIÉN HABLA Y CON QUÉ AUTORIDAD

Este pliego trata a los autores como si fueran el cliente que nos contrata para construir un solver.
Se leyeron completos o por tramos:

| Fuente | Quién es | Qué aporta |
|---|---|---|
| **Felippa, *Introduction to Finite Element Methods*** (IFEM, U. Colorado, 26 852 líneas) | El teórico-practicante. Da la doctrina y además se queja de que los libros la omiten | Cap. 1 (verificación vs validación), **Cap. 8 (reglas de modelado)**, **Cap. 17 (isoparamétricos, jacobiano, locking cuantificado)**, **Cap. 19 (requisitos de convergencia: completitud, compatibilidad, estabilidad)**, Apéndice C (rango) |
| **Guido Dhondt, *CalculiX CrunchiX User's Manual v2.22*** (40 504 líneas) | El que ESCRIBIÓ un solver libre de producción y lo mantiene | §4 "Golden rules", §6.2 (catálogo de elementos con sus vicios), §6.7.6 (contacto penalidad), §6.10 (criterios de convergencia CON SUS NÚMEROS), §6.11 (cargas equivalentes), §6.12 (estimadores de error), §7.24 (`*CONTROLS`), §10.13 (calidad de malla y remallado) |
| **Code_Aster R5.03.01 / R5.03.02 / R5.01.01 / U2.04.04** | EDF: el solver nuclear francés | No lineal cuasi-estático, plasticidad, solvers modales, **contacto** |
| **Code_Aster R3.01.01** | — | Funciones de forma y puntos de Gauss por tipo de elemento |
| **Babuška & Suri, *On the rates of convergence of the FEM*** | Los matemáticos | Tasas h y p, efecto de singularidades |
| **NAFEMS Benchmarks Guide** | El organismo de validación | Casos con VALOR DE REFERENCIA numérico |
| **fe-safe Fatigue Theory Reference Manual vol.2** | Dassault | Fatiga: qué esfuerzo FEA usar y cómo |
| **Tutorial J2 plasticity** / **Effective modal mass** | — | Radial return; masa modal efectiva |
| **Autodesk University, *Nonlinear Simulation in Fusion 360*** | El que enseña a decidir | Los umbrales de "cuándo dejar de ser lineal" |

> **Nota de honestidad.** Felippa lo dice él mismo (§8, *Notes and Bibliography*):
> *"FEM modeling rules in most textbooks are 'diffuse' if given at all. As noted in Chapter 7,
> most authors lack practical experience and view FEM as a way to solve BVPs of their own choosing."*
> Por eso el peso de este pliego cae sobre CalculiX (código que corre) y sobre los dos capítulos
> donde Felippa sí baja a tierra (8 y 19).

---

## 1. EL PROCESO A MANO DEL ANALISTA FEA

### 1.1 El mapa mental: dos errores distintos que la gente confunde

Felippa §1.3.1 separa dos cosas que un programador junta:

```
                                     ┌── VERIFICACIÓN ──┐  (¿resolví bien las ecuaciones que escribí?)
Sistema     IDEALIZACIÓN+          Modelo        SOLUCIÓN      Solución
 FÍSICO  ──DISCRETIZACIÓN──────►  discreto  ──────────────►    discreta
    └───────────────── VALIDACIÓN ────────────────────────────────┘
                     (¿escribí las ecuaciones correctas?)
```

- **Verificación** = meter la solución discreta de vuelta en el modelo discreto → *solution error*.
  *"This error is not generally important"* (Felippa §1.3.1). Es el residuo del solver.
- **Error de discretización** = comparar contra el modelo matemático ideal (viga, elasticidad exacta).
- **Validación** = comparar contra la realidad medida → *simulation error = modeling + solution error*.
  Y remata: *"As the latter is typically insignificant, the simulation error in practice can be
  identified with the modeling error."*

**Lectura para La Forja:** que el CG converja a 1e-6 (verificación) NO dice nada de si el número
sirve. Los tres errores son independientes y hay que atacarlos con gates distintos.

### 1.2 La secuencia real, paso a paso

Reconstruida de CalculiX §4 ("Golden rules") + Felippa §8 + la práctica que se ve en los ejemplos
de CalculiX §5.18:

**A. Antes de tocar la malla — decidir el modelo (§5 de este pliego: juicios humanos)**
1. **Simplificar la geometría.** Quitar redondeos, chaflanes, roscas y agujeros que no cargan.
   Regla de Felippa §8.1: *"Use the coarsest mesh you think will capture the dominant physical
   behavior of the physical system, particularly in design applications."*
2. **Buscar simetría / antisimetría** (Felippa §8.6). *"Engineers doing finite element analysis
   should be on the lookout for conditions of symmetry or antisymmetry."* Ojo: la carga TAMBIÉN
   tiene que ser simétrica; *"model reduction can be used only if the loading conditions are also
   symmetric or antisymmetric."*
3. **Decidir lineal vs no lineal** (§5.3 abajo). Si hay duda: correr lineal PRIMERO, siempre.
4. **Elegir el tipo de elemento** ANTES de mallar (el mallador y el elemento están acoplados).

**B. Mallar**
5. Malla gruesa primero. Refinar SOLO donde se esperan gradientes altos (Felippa §8.2.1).
6. Verificar la malla en el pre-procesador ANTES de resolver — es la regla #1 de CalculiX:
   *"Check the quality of your mesh in CalculiX GraphiX or by using any other good preprocessor."*

**C. Condiciones de frontera**
7. Empotramientos: el mínimo indispensable. En 3D son **6 grados de libertad** los que hay que
   quitar para matar los movimientos de cuerpo rígido, ni uno más si no es físico (Felippa §8.5.2).
8. Cargas: convertir distribuidas a nodales por **EbE** (element-by-element), no por NbN, salvo
   que la carga varíe lento (Felippa §8.3.2: *"If applicable, the EbE procedure is more accurate
   than NbN lumping"*).

**D. Correr, pero por escalones**
9. **`*NO ANALYSIS` primero** (CalculiX §7.93): *"requests the no analysis procedure, in which the
   set of equations is built but not solved (the Jacobian determinant is checked)."*
   Es un ensayo en seco que checa geometría e input deck sin gastar el solve. ⭐
10. **Correr la versión LINEALIZADA** (CalculiX Golden rule #2, en mayúsculas en el original):
    *"If you are dealing with a nonlinear problem, RUN A LINEARIZED VERSION FIRST: eliminate large
    deformations (drop NLGEOM), use a linear elastic material and drop all other nonlinearities such
    as contact. If the linear version doesn't run, the nonlinear problem won't run either. The linear
    version allows you to check easily whether the boundary conditions are correct (no unrestrained
    rigid body modes), the loading is the one you meant to apply etc. Furthermore, you get a feeling
    what the solution should look like."*
11. Resolver.

**E. VERIFICAR — en este orden (lo importante)**

El orden importa porque cada escalón sólo tiene sentido si pasó el anterior:

| # | Qué se verifica | Qué lo delata si falla | Costo |
|---|---|---|---|
| V1 | **La matriz existe y no es singular** | pivote cero / no positiva definida → falta restringir un cuerpo rígido, o hay un mecanismo | gratis |
| V2 | **Jacobiano positivo en todos los puntos de integración** | elementos volteados o degenerados | gratis |
| V3 | **El solver convergió** | residuo relativo > tol | gratis |
| V4 | **Equilibrio: ΣReacciones + ΣCargas = 0** | error de ensamble, DOF fijos mal aplicados | ~gratis |
| V5 | **La deformada tiene sentido** (ojo humano, factor de escala 1×) | BC equivocadas, unidades equivocadas | 1 min |
| V6 | **Las reacciones valen lo que deben** físicamente | carga mal repartida | 1 min |
| V7 | **∫σ·n dA sobre la cara empotrada ≈ carga aplicada** | ESTE sí mide la malla (ver ⭐2) | barato |
| V8 | **Estimador de error de discretización** (ZZ o gradiente) bajo donde importa | malla gruesa en la zona crítica | barato |
| V9 | **Convergencia de malla**: 3 mallas, la cantidad de interés se estabiliza | discretización insuficiente | caro |
| V10 | **Contra teoría / benchmark** (viga, NAFEMS, ensayo) | el modelo entero | caro |

> **Por qué V4 no sustituye a V7 (el punto más fino de todo el pliego).** CalculiX §5.18 corre una
> ménsula curva con C3D10 y pide las reacciones de DOS maneras: `*NODE PRINT RF` (suma de fuerzas
> nodales) y `*SECTION PRINT SOF,SOM` (integral de los esfuerzos sobre la superficie). Resultado
> textual: *"the reaction force obtained by the \*NODE PRINT statement is very accurate, however,
> the integration across the surface of the stresses is rather inaccurate: instead of 9 force units
> one obtains 7.23 units. The moment about the center of gravity is 65.5 [force][length] instead of
> the expected 72."* Con el estimador de error marcando hasta **30 %**.
> **ΣRF = 9.000000 exacto y aun así la malla era basura.** La suma de reacciones es exacta por
> construcción (es K·u redistribuido); es un test de ENSAMBLE, no de MALLA. La integral de esfuerzos
> sobre la cara es el que sí mide discretización: se equivocó **20 % en fuerza y 9 % en momento**.

**F. Interpretar**
12. Leer esfuerzos en los **puntos de integración**, no en los nodos. CalculiX §6.13:
    *"Notice that element variables are more accurate at the integration points. The values at the
    nodes are extrapolated values and consequently less accurate. For example, the von Mises stress
    and the equivalent plastic strain at the integration points have to lie on the stress-strain
    curve defined by the user underneath the \*PLASTIC card, the extrapolated values at the nodes
    do not have to."* ⭐
13. Desconfiar del máximo puntual. Los picos en esquinas entrantes y bajo cargas puntuales son
    **singularidades**: no convergen, crecen sin límite al refinar.

---

## 2. REGLAS PRESCRIPTIVAS EN PROSA

Todo lo que sigue es cita o paráfrasis fiel. Los **números** son los que dan las fuentes.

### 2.1 Las reglas madre

**Felippa §8.1 — General Recommendations** (recuadro literal del libro):

> - *Use the simplest type of finite element that will do the job.*
> - *Never, never, never mess around with complicated or special elements, unless you are absolutely
>   sure of what you are doing.*
> - *Use the coarsest mesh you think will capture the dominant physical behavior of the physical
>   system, particularly in design applications.*

Y el porqué: *"Three word summary: keep it simple. Initial FE models may have to be substantially
revised to accommodate design changes, and there is little point in using complicated models that
will not survive design iterations. The time for refined models is when the design has stabilized."*

**CalculiX §4 — Golden rules** (las 7, condensadas):
1. Checar la calidad de la malla en un pre-procesador.
2. Correr una versión LINEALIZADA primero.
3. **USAR ELEMENTOS CUADRÁTICOS** (mayúsculas del original), salvo dinámica explícita.
4. En shells/beams pedir `OUTPUT=3D` para ver la sección expandida y verificar espesores.
5. Con contacto + elementos cuadráticos: face-to-face penalty o mortar, NUNCA node-to-face.
6. Dinámica explícita: elementos lineales + node-to-face + mass scaling.
7. Numeración compacta: la memoria depende del número de nodo/elemento MÁS ALTO, no de cuántos hay.

### 2.2 Calidad de malla

**Relación de aspecto (Felippa §8.2.2)** — literal:
> *"try to avoid finite elements of high aspect ratios: elongated or 'skinny' elements... (The aspect
> ratio of a two- or three-dimensional element is the ratio between its largest and smallest dimension.)
> As a rough guideline, elements with **aspect ratios exceeding 3 should be viewed with caution** and
> those **exceeding 10 with alarm**. Such elements will not necessarily produce bad results — that
> depends on the loading and boundary conditions of the problem — but do introduce the potential for
> trouble."*

Con su excepción declarada (REMARK 8.1): en estructuras delgadas modeladas como sólidos, los
elementos "flacos" son **inevitables por economía** (ej. compuestos laminados). No es un pecado
absoluto: es una bandera.

**Jacobiano (Felippa §19.4.2 — "Jacobian Positiveness")** — es un REQUISITO DE ESTABILIDAD, no un
consejo:
> *"The geometry of the element must be such that the determinant J = det J of the Jacobian matrix
> ... is positive everywhere."*

- Triángulo/tet lineal: `J` es CONSTANTE, `J = 2A`. *"The requirement J > 0 is equivalent to saying
  that corner nodes must be positioned and numbered so that a positive area A > 0 results. This is
  called a convexity condition. It is easily checked by a finite element program."*
- Cuadrilátero de 4 nodos: al mover un nodo hacia dentro el elemento pasa de convexo a no convexo;
  en el caso límite (triángulo degenerado) **J = 0 en ese nodo**. Felippa remata contra un mito común:
  *"This contradicts the (erroneous) advise of some FE books, which state that quadrilaterals can be
  reduced to triangles as special cases, thereby rendering triangular elements unnecessary."* ⭐
- Elementos de orden alto: no basta con las esquinas. *"The non-corner nodes (midside, interior, etc.)
  must be placed sufficiently close to their natural locations (midpoints, centroids, etc.) to avoid
  violent local distortions."*
- **El cuarto de lado**: mover el nodo medio 5 de un cuadrilátero de 9 nodos tangencialmente hasta el
  **punto de cuarto** del lado 1-2 hace que **J = 0 en la esquina 2**. *"Although this is disastrous
  in ordinary FE work, it has applications in the construction of special 'crack' elements for linear
  fracture mechanics."* ⭐ (o sea: el mismo defecto es una herramienta si lo pones a propósito).
- Mover nodos medios **normal** al lado es mucho más perdonable que moverlos **tangencialmente**:
  un triángulo de 6 nodos aguanta deformarse hasta en un "círculo parabólico" sin que la métrica
  reviente.

**La métrica de calidad de tetraedro que CalculiX SÍ implementa** (§10.13, `meshquality.f`):

```
        √6 · L_max · Σ(áreas de las 4 caras)
Q  =  ──────────────────────────────────────      ;  r_inscrito = 3V / ΣS
              12 · 3 · max(V, 1e-30)

  ⇔   Q = (√6/12) · (L_max / r_inscrito)
```
> *"The factor √6/12 is such that the quality of an equilateral tetrahedron is 1. For all other
> tetrahedra it exceeds 1. **The larger the value, the worse the element.**"*

Y el umbral de muerte, en `removesliver.f`: un **sliver** (tet de volumen casi nulo con caras de área
finita) se ELIMINA si todos sus nodos son externos **Y `Q > 10`** Y no contiene una arista viva Y
tiene al menos 4 aristas externas.

**Para elementos cuadráticos** CalculiX usa otra métrica (`quadmeshquality.f`), basada en la
**dispersión del jacobiano entre puntos de integración**:
```
Q* = (J_max − J_min)/(J_max + J_min) · ⟨J_min⟩/|J_min|  +  1e30 · (1−J_min) · ⟨−J_min⟩/|J_min|
```
El segundo término (1e30) se dispara en cuanto **cualquier** J es negativo → el elemento es
inaceptable, punto. ⭐ La idea transferible: **para un elemento curvo, la calidad es qué tanto varía
el jacobiano dentro del elemento**, no una relación de lados.

Y su regla operativa al remallar: *"Each time a node is moved, the Jacobian determinant of all
elements belonging to its ball is checked for positivity. If any Jacobian is negative, the size of
the motion for this node in this iteration is decreased by half. If after three reductions there is
still an element with a negative Jacobian the node is not moved at all."*

### 2.3 Dónde refinar (Felippa §8.2.1)

> *"Use a relatively fine (coarse) discretization in regions where you expect a high (low) gradient
> of strains and/or stresses. Regions to watch out for high gradients are:*
> - *Near entrant corners, or sharply curved edges.*
> - *In the vicinity of concentrated (point) loads, concentrated reactions, cracks and cutouts.*
> - *In the interior of structures with abrupt changes in thickness, material properties or cross
>   sectional areas."*

La figura 8.1 marca en rojo: recortes, grietas, esquinas entrantes, soldaduras, transferencia de
carga (juntas pegadas, anclajes, varilla de refuerzo), cambios bruscos de espesor, interfaces de
material, vecindad de carga puntual y áreas de contacto agudo.

**Interfaces (Felippa §8.2.3), regla dura:** *"A physical interface, resulting for example from a
change in material, should also be an interelement boundary. That is, **elements must not cross
interfaces**."*

**Refinamiento automático (CalculiX §5.18):** `*REFINE MESH, LIMIT=x` refina con base en un campo
(p.ej. `S` = von Mises). Detalles operativos que valen oro:
- *"In the current version of CalculiX up to **three iterations** are performed, each of which allows
  for a refinement **by a factor of two**"* → refinamiento local máximo ×8.
- *"The refinements are always applied to a version of the original mesh in which any quadratic
  elements are replaced by linear ones (C3D10 by C3D4)"*, y al final se re-generan los nodos medios
  y **se proyectan sobre las caras de la malla original** → la geometría queda definida por la
  superficie exterior de la malla de entrada. ⭐
- **Resultado medido:** el error global casi no bajó, pero *"at those locations where the stress is
  high, the error is now low, **about 5 % instead of 30 %**. These are the locations of interest."*
  → El criterio de éxito del refinamiento NO es el error promedio; es el error **donde el esfuerzo
  es alto**.

### 2.4 Qué elemento usar y dónde NO

**Felippa §8.2.4 — Preferred Shapes:**
> *"In two-dimensional FE modeling, if you have a choice between triangles and quadrilaterals with
> similar nodal arrangement, **prefer quadrilaterals**. ... In three dimensional FE modeling, **prefer
> strongly bricks over wedges, and wedges over tetrahedra. The latter should be used only if there is
> no viable alternative.** The main problem with tetrahedra and wedges is that they can produce **wrong
> stress results even if the displacement solution looks reasonable**."* ⭐

Con la nota al pie amarga: *"Unfortunately, many existing space-filling automatic mesh generators in
three dimensions produce tetrahedral meshes. There are generators that try to produce bricks, but
these often fail in geometrically complicated regions."*

**El catálogo de CalculiX §6.2, con sus vicios declarados** — esto es una tabla de contraindicaciones:

| Elemento | Puntos de Gauss | Veredicto textual |
|---|---|---|
| **C3D8** (hexa lineal, integración completa) | 2×2×2 | *"should not be used"* cuando: (a) *"the element will behave badly for isochoric material behavior, i.e. for high values of Poisson's coefficient or plastic behavior"*; (b) *"the element tends to be too stiff in bending, e.g. for slender beams or thin plates under bending"* |
| **C3D8R** (hexa lineal reducido) | 1 | Sin locking, pero: *"not stiff enough in bending"*; el único punto de integración está **en el centro** → *"small elements are required to capture a stress concentration at the boundary"*; **12 modos espurios de energía cero** → *"massive hourglassing ... the displacements are completely wrong. Since the zero energy modes do not lead to any stresses, the stress field is still correct."* ⭐ Desde v2.3 el control de hourglass es automático |
| **C3D8I** (hexa lineal + modos incompatibles) | — | *"shear locking is removed and volumetric locking is much reduced ... The **C3D8I element should be used in all instances in which linear elements are subject to bending**."* Malo en torsión |
| **C3D20** (hexa cuadrático completo) | 3×3×3 | *"An excellent element for linear elastic calculations. Due to the location of the integration points, stress concentrations at the surface of a structure are well captured."* Pero hereda los vicios del C3D8 en no lineal, "albeit to a much lesser extent" |
| **C3D20R** (hexa cuadrático reducido) | 2×2×2 | El campeón: *"if you are setting off for a long journey and you are allowed to take only one element type with you, that's the one to take"*. Los puntos reducidos son **superconvergentes**. Dos advertencias: los puntos están a ~¼ del tamaño del elemento de la frontera y la extrapolación a nodos es trilineal → *"high stress concentrations at the surface of a structure might not be captured if the mesh is too coarse"*; y todos los cuadráticos dan problemas en contacto node-to-face |
| **C3D4** (tet lineal) | 1 | *"This element is included for completeness, however, **it is not suited for structural calculations unless a lot of them are used (the element is too stiff)**. Please use the 10-node tetrahedral element instead."* ⭐ |
| **C3D10** (tet cuadrático) | 4 | *"The element behaves very well and is a good general purpose element, although the C3D20R element yields still better results for the same number of degrees of freedom. The C3D10 element is especially attractive because of the existence of fully automatic tetrahedral meshers."* |
| **C3D10T** | 4 | Igual al C3D10 pero interpola **linealmente** las temperaturas iniciales. El C3D10 normal interpola T cuadráticamente y u cuadráticamente → deformación térmica cuadrática vs total lineal → *"This discrepancy may lead to a **checkerboard pattern in the stresses**, which is observed especially in the presence of high initial temperature gradients."* ⭐ (relevantísimo para moldes con canales de enfriamiento) |
| **C3D6** (cuña lineal) | 2 | *"probably not very well suited for structural calculations unless a lot of them are used"* |

**Recomendación general de CalculiX §6.2** (literal): *"In general, one can say that the quadratic
elements are the most stable and robust elements in CalculiX. **If you are not a finite element
specialist the use of quadratic elements is strongly suggested.**"* La lista: C3D20R, C3D10, CAX8R,
CPS8R, CPE8R, S8R, B32R. Y: *"Other elements frequently exhibit unsatisfactory behavior in certain
instances, e.g. the C3D8 element in bending states. **Unless you are a specialist, do not use such
elements.**"*

**El argumento de fondo por el que hay que usar cuadráticos** (Golden rule #3, muy honesto):
> *"The standard shape functions for quadratic elements are very good. Most finite element programs
> use these standard functions. For linear elements this is not the case: linear elements exhibit all
> kind of weird behavior such as shear locking and volumetric locking. Therefore, most finite element
> programs modify the standard shape functions for linear elements to alleviate these problems.
> However, **there is no standard way of doing this, so each vendor has created his own modifications
> without necessarily publishing them.** This leads to a larger variation in the results if you use
> linear elements. Since CalculiX uses the standard shape functions for linear elements too, the
> results must be considered with care."* ⭐

### 2.5 Integración reducida, rango y hourglassing

**Felippa §19.4.1 — Rank Sufficiency** (requisito de estabilidad):
> *"The element stiffness matrix must not possess any zero-energy kinematic mode other than rigid
> body modes."*

Con la fórmula operativa que permite ELEGIR la regla de Gauss:
```
r = min(n_F − n_R , n_E · n_G)        y se exige      n_E · n_G  ≥  n_F − n_R
```
donde `n_F` = GDL del elemento, `n_R` = modos de cuerpo rígido, `n_E` = orden de la matriz E
(3 en tensión plana, **6 en 3D**), `n_G` = número de puntos de Gauss. Deficiencia de rango
`d = (n_F − n_R) − r`.

Tabla 19.1 de Felippa (tensión plana, n_E = 3, n_R = 3):

| Elemento | n | n_F | n_F − 3 | n_G mínimo | Regla recomendada |
|---|---|---|---|---|---|
| triángulo 3 nodos | 3 | 6 | 3 | 1 | centroide |
| triángulo 6 nodos | 6 | 12 | 9 | 3 | reglas de 3 puntos |
| triángulo 10 nodos | 10 | 20 | 17 | 6 | regla de 6 puntos |
| cuadrilátero 4 nodos | 4 | 8 | 5 | 2 | **2×2** |
| cuadrilátero 8 nodos | 8 | 16 | 13 | 5 | **3×3** |
| cuadrilátero 9 nodos | 9 | 18 | 15 | 5 | **3×3** |
| cuadrilátero 16 nodos | 16 | 32 | 29 | 10 | 4×4 |

Ejemplo trabajado: el cuadrilátero bicuadrático de 9 nodos necesita `n_G ≥ 5`; **la regla 2×2 (n_G=4)
es insuficiente** y hay que ir a 3×3.

**Extensión a 3D** (misma fórmula, n_E = 6, n_R = 6):
- **tet4**: n_F = 12, n_F − n_R = 6, con 1 punto → 6·1 = 6 ≥ 6 ✔ **exactamente suficiente, sin margen**.
- **tet10**: n_F = 30, n_F − n_R = 24, se necesita n_G ≥ 4 → **los 4 puntos del C3D10 son el mínimo justo**.
- **hex8**: n_F = 24, n_F − n_R = 18, se necesita n_G ≥ 3 → **1 punto (C3D8R) da rango 6 ⇒ deficiencia 12**,
  que es exactamente lo que CalculiX reporta: *"There are 12 spurious zero energy modes"*. ⭐
  La teoría de Felippa PREDICE el número que Dhondt observó en el código.
- **hex20 reducido 2×2×2**: n_F = 60, n_F − n_R = 54, 6·8 = 48 < 54 → deficiencia 6 en teoría,
  y sin embargo CalculiX dice que *"rarely exhibits hourglassing"* — porque en un ensamble los modos
  espurios de elementos vecinos no se comunican. Aquí la teoría es conservadora y la práctica manda.

**Qué es hourglassing, en palabras de Dhondt:** *"hourglassing generally occurs when not enough
integration points are used for numerical integration and spurious modes pop up resulting in
**crazy displacement fields but correct stress fields**"*. ⭐ El síntoma es una deformada en zigzag
con esfuerzos que se ven perfectos — por eso engaña.

**Regla práctica de vigas/shells esbeltos (CalculiX §6.2.14 y §6.2.20):** *"If the aspect ratio of
the beams is very large (slender beams, aspect ratio of **40 or more**) reduced integration will give
you far better results than full integration. However, due to the small thickness hourglassing can
[occur]."* Para shells reducidos usan un esquema **Gauss-Kronrod 2×5×5** que contiene al Gauss
reducido como subconjunto: si el elemento no está muy distorsionado usan el Gauss reducido barato,
y sólo *"in the rare cases that hourglassing occurs"* pagan el Kronrod.

### 2.6 Locking — con NÚMEROS

Felippa Ejercicio 17.3 es la única parte del libro que **cuantifica** el locking, y es demoledora.
Viga de Bernoulli-Euler en flexión pura, modelada con **una capa** de cuadriláteros bilineales de
4 nodos a lo alto. Relación de aspecto `γ = b/a` (alto de elemento / largo). La razón de energía
absorbida (modelo 2D / exacta) sale en cerrado:

```
                2 γ² (1 − ν²)
r(γ, ν)  =  ───────────────────          r = 1 → exacto ;  r < 1 → SOBRE-RÍGIDO
                1 + 2γ² − ν
```

Valores (calculados de la fórmula):

| γ = b/a | ν = 0 | ν = 0.3 (acero) |
|---|---|---|
| 0.1 (elemento 10× más largo que alto) | **0.0196** | 0.0253 |
| 0.5 | 0.333 | 0.379 |
| **1.0 (elemento CÚBICO)** | 0.667 | **0.674** |
| 2.0 | 0.889 | 0.837 |
| → ∞ | 1.000 | **0.910** |

Lecturas:
- Con `a = 10b` y `ν = 0`: *"r ≈ 1/50, and the 2D model gives only about **2 %** of the correct
  solution."* ⭐
- Un elemento **cúbico** (γ=1, el caso de una malla por voxeles) captura apenas **67 %** de la
  energía de flexión → el modelo sale ~1.5× demasiado rígido POR CAPA.
- El remate (nota al pie 10): *"**even if we make a → 0 and γ = b/a → ∞ by taking an infinite number
  of rectangular elements along x, the energy ratio r remains less than one if ν > 0 since r → 1−ν².
  Thus the 2D model would not generally converge to the correct solution if we keep one layer through
  the height.**"* ⭐⭐ Para acero (ν=0.3) el techo es **0.91: 9 % de error que NO se va refinando en la
  dirección equivocada.** Refinar a lo largo del claro no arregla nada; hay que meter **capas a través
  del espesor**.
- El nombre y la causa: *"This phenomenon is referred to in the FEM literature as shear locking,
  because overstiffness is due to the bending motion triggering spurious shear energy in the element."*

> **Ojo con la convención al citar.** El libro completo (IFEM cap. 17, ejercicio 17.3, ec. E17.8) define
> `r = U_quad/U_beam` con `γ = b/a`, de modo que **r < 1 = sobre-rígido**. El capítulo 17 suelto que
> también está en el corpus imprime el **recíproco** (`r = (1 + 2/γ² − ν)/((2/γ²)(1−ν²))`, con
> **r > 1 = sobre-rígido**, y "a = 10b, ν = 0 → r ≈ 50"). Son la misma física; verifica el sentido antes
> de codificar el gate.

**Locking volumétrico:** aparece con *"isochoric material behavior, i.e. for high values of Poisson's
coefficient or plastic behavior"* (CalculiX §6.2.1). El caso extremo: *"Rubber materials are virtually
incompressible... Perfectly incompressible materials require the use of hybrid finite elements"*
(§*HYPERELASTIC). Para plasticidad completamente desarrollada el flujo plástico ES isocórico → **un
solver plástico con elementos lineales de integración completa se traba**.

**Los remedios, en orden de preferencia según las fuentes:**
1. Elementos cuadráticos (C3D20R / C3D10). — la recomendación #1 de CalculiX.
2. Modos incompatibles (C3D8I) si estás obligado a lineales en flexión.
3. Integración reducida + control de hourglass.
4. Integración selectiva (partir E en parte volumétrica y desviadora, integrar la volumétrica con
   menos puntos) — Felippa §17.6.2. Es más efectiva que la integración ponderada.
5. Integración ponderada `K_β = (1−β)K_1×1 + β K_2×2` con `β = 2γ²(1−ν²)/(1+2γ²−ν)` hace el elemento
   **exacto en flexión en x** — pero Felippa la descarta: *"A deficiency of this idea is that it does
   not make it y-bending exact... Moreover the device is not easily extended to non-rectangular
   geometries or non-isotropic material."* ⭐ (una "cura" que sólo funciona en el eje que la calibraste).

### 2.7 Cargas y condiciones de frontera

**Soportes mínimos (Felippa §8.5):** en 2D el mínimo son **3** restricciones (2 traslaciones + 1
rotación); en 3D **6**. Si pones un rodillo cuya dirección de rodado es normal a AB, no restringe
la rotación infinitesimal: *"The configuration of 8.6(c) is called a **kinematic mechanism**, and will
be flagged by a singular modified stiffness matrix."*

**Antisimetría:** *"For the antisymmetric loading case, one node point has to be constrained against
vertical motion. If there are no actual physical supports, the choice is arbitrary... The important
thing is **not to overconstrain the structure by applying more than one y constraint**."* ⭐

**Lumping de cargas distribuidas (Felippa §8.3):**
- **NbN (nodo por nodo / región tributaria)**: cada nodo se lleva la carga de la mitad del camino a
  sus vecinos. Ventaja: no hay que calcular centroides. *"It should be avoided, however, when the
  applied forces vary rapidly (within element length scales) or act only over portions of the
  tributary regions."*
- **EbE (elemento por elemento)**: la resultante por elemento se reparte a los nodos **por estática**.
  *"If applicable, the EbE procedure is more accurate than NbN lumping. In fact **it agrees with the
  consistent node lumping for simple elements that possess only corner nodes**."* No aplica si el
  elemento tiene nodos medios/internos o GDL rotacionales → ahí hay que usar el consistente variacional.

**Las fuerzas nodales equivalentes de una presión uniforme (CalculiX §6.11.2)** — esto rompe la
intuición de cualquiera:

| Elemento | Cara cargada con presión unitaria → fuerza por nodo |
|---|---|
| C3D8(R) | **1/4 en cada uno de los 4 nodos** (lo intuitivo) |
| **C3D10** | **1/3 en cada nodo MEDIO, 0 en las esquinas** ⭐ |
| **C3D20(R)** | **1/3 en cada nodo medio, −1/12 (¡NEGATIVA!) en cada esquina** ⭐ |

Literal: *"Notice that the force is zero (C3D10) or has the **opposite sign** (C3D20(R)) for quadratic
elements."* Consecuencia práctica que Dhondt saca de ahí (§6.7.6): esas fuerzas de TRACCIÓN en las
esquinas *"usually lead to divergence if this node belongs to a node-to-face contact element"*, y por
eso CalculiX **falsea** los pesos a **24/100 y 1/100** en contacto. ⭐

**Reacciones — la trampa de `RF` (CalculiX §6.11.5):**
> *"Summarizing, selecting RF gives you **the sum of the reaction forces and the loading forces**.
> This is equal to the reaction forces only if the elements belonging to the selected nodes are not
> loaded by a \*DLOAD card, and the nodes themselves are not loaded by a \*CLOAD card."* ⭐

El ejemplo: una placa empotrada en todo el borde con presión 1. La suma de reacciones es −1, pero
las fuerzas de carga en los nodos del borde suman 5/12, así que `RF` reporta **−7/12** y sólo tiende
a −1 al refinar. **Si haces el gate de equilibrio sin separar reacción de carga, te da un número
falso que además "mejora" con la malla y parece convergencia.**

**Presión en grandes deformaciones:** *"In a large deformation analysis the pressure is applied to the
deformed face of the element. Thus, if you pull a rod with a constant pressure, the total force will
decrease due to the decrease of the cross-sectional area of the rod. This effect may or may not be
intended."* ⭐

### 2.8 Convergencia del solver no lineal — LOS NÚMEROS DE CALCULIX

CalculiX §6.10.1 define Newton-Raphson con estas cantidades por campo α:

| Símbolo | Definición |
|---|---|
| `q̄ᵢ` | flujo **promedio** al final de la iteración i = Σ\|q\| sobre todos los nodos de todos los elementos / cuenta |
| `q̃ᵢ` | promedio de `q̄` sobre **todas las iteraciones previas** del incremento actual |
| `rᵢ,max` | **mayor residuo** (en valor absoluto) por GDL |
| `Δuᵢ,max` | **mayor cambio de la solución en el INCREMENTO** |
| `cᵢ,max` | **mayor cambio de la solución en la ITERACIÓN** |

Y las constantes con sus **defaults** (`*CONTROLS, PARAMETERS=FIELD`):

| Parámetro | Default | Qué es |
|---|---|---|
| `Rₙ` | **0.005** | tolerancia del residuo relativo (residuo máx / fuerza promedio), primeras iteraciones |
| `Rₚ` | **0.02** | tolerancia relajada, se usa después de la iteración `I_P` |
| `Cₙ` | **0.01** (§7.24) / 0.02 (§6.10) | tolerancia del cambio de solución relativo |
| `ε` | **1e−5** | umbral de "flujo cero" (`q̄ᵢ ≤ ε q̃ᵢ`) |
| `C_ε` | **1e−3** | tolerancia de solución bajo flujo cero |
| `R_l` | **1e−8** | si el residuo es menor que esto, el incremento se declara LINEAL y NO se checa la solución |
| `q₀` | 0.01 en el primer step | valor inicial de la fuerza promedio |

**La condición de convergencia (ec. 844-845), literal en estructura:**
```
CONVERGE  ⟺   r_i,max ≤ c1·q̃_i          (residuo)
            Y (en térmico) ΔT ≤ DELTMX
            Y al menos UNA de:
                 c_i,max ≤ c2 · Δu_i,max                                   (la solución ya no cambia)
                 r_i,max · c_i,max / min(r_{i−1,max}, r_{i−2,max}) < c2·Δu_i,max   (predicción de la
                       próxima corrección — "an estimate of the largest solution correction in the
                       next iteration")
                 r_i,max ≤ R_l · q̃_i        (1e−8: el incremento es lineal)
                 q̄_i ≤ ε · q̃_i             (flujo cero)
                 c_i,max < 1e−8
```
con `c1 = Rₙ` (0.005) y `c2 = Cₙ` mientras `i ≤ I_P`, y `c1 = Rₚ` (0.02) después.

⭐ **Lo importante:** son DOS criterios acoplados (residuo Y solución), no uno; y hay un **caso
especial explícito de "carga cero"** — si el flujo promedio es < 1e−5 del histórico, la tolerancia de
residuo se vuelve absoluta porque dividir entre cero no tiene sentido. Un solver casero que sólo
mira `‖r‖/‖f‖` falla justo cuando `f → 0`.

**Control de incremento (`*CONTROLS, PARAMETERS=TIME INCREMENTATION`), defaults:**

| Símbolo | Default | Qué dispara |
|---|---|---|
| `I₀` | **4** | iteración a partir de la cual se checa si el residuo crece dos veces seguidas → se reintenta con `D_f` |
| `I_R` | **8** | iteración a partir de la cual se hace la extrapolación logarítmica |
| `I_P` | **9** | a partir de aquí se usa `Rₚ` en vez de `Rₙ` |
| `I_C` | **16** | **máximo de iteraciones**; si se pasa, CalculiX **para con error** |
| `I_L` | **10** | si se necesitaron más de 10 iteraciones, el SIGUIENTE incremento se reduce |
| `I_G` | **4** | si dos incrementos seguidos convergieron en ≤4, el siguiente se agranda |
| `I_A` | **5** | máximo de *cutbacks* por incremento |
| `D_f` | **0.25** | factor de corte si parece divergir |
| `D_C` | **0.5** | factor de corte si la extrapolación logarítmica predice demasiadas iteraciones |
| `D_B` | **0.75** | factor de corte del siguiente incremento si se pasó de `I_L` |
| `D_A` | **0.85** | factor si ΔT excede DELTMX (× DELTMX/ΔT) |
| `D_D` | **1.5** | factor de crecimiento |

**La prueba de divergencia** (la parte más copiable): se declara divergencia si
`i ≥ I₀` Y `r_i,max > 1e−20` Y `c_i,max > 1e−20` Y **`r_{i−1,max} > r_{i−2,max}` Y `r_i,max > r_{i−2,max}`**
Y `r_i,max > c1·q̃_i`. O sea: **el residuo tiene que haber subido en DOS iteraciones consecutivas**,
no en una. ⭐ Una sola subida no es divergencia — es Newton haciendo su trabajo.

**La extrapolación logarítmica** (ec. 846-847): a partir de `I_R = 8`, se estima cuántas iteraciones
`x` faltan suponiendo convergencia lineal del residuo:
```
r_i,max · (r_i,max / r_{i−1,max})^x = Rₙ · q̃_i
```
y si `i + ln(Rₙ q̃ᵢ / rᵢ,max) / ln(rᵢ,max/r_{i−1,max}) > I_C`, se corta el incremento a la mitad.
⭐ Esto es **abortar antes de fallar**: no esperas a gastar 16 iteraciones, predices que no vas a
llegar y reinicias el incremento más chico.

**Line search (§6.10.3),** sólo con contacto face-to-face: se escala `Δu` por λ tal que
`Δu · R(u + λΔu) = 0`, aproximando linealmente entre λ=0 (residuo conocido del incremento previo)
y λ=1 (residuo actual) → **λ sale sin cálculos extra**. Defaults: **λ_min = 0.25, λ_max = 1.01**.

### 2.9 Contacto (CalculiX §6.7.6 — Code_Aster va en §6.1, que es mucho más prescriptivo)

**Elección del método (Golden rule #5):** *"If you include contact in your calculations and you are
using quadratic elements, use the **face-to-face penalty** contact method or the **mortar** method...
In general, for contact between faces the face-to-face penalty method and the mortar method will
converge much better than the node-to-face method."* Y: *"In general, node-to-face contact is **not
recommended for quadratic elements**."* (mortar en CalculiX: sólo estático).

**Maestro y esclavo:** *"The dependent surface (= slave) may be defined based on nodes or element
faces, the independent surface (= master) **must consist of element faces**... **Usually, the mesh on
the dependent side should be at least as fine as on the independent side.**"* ⭐
Restricción topológica del maestro: *"any edge of any face has at most one neighboring face."*

**Rigidez de penalidad — los números:**
```
p = K·d · [ ½ + (1/π)·atan(d/ε) ]        (relación lineal presión-penetración)
```
> *"A large value of K leads to hard contact. **To obtain good results K should typically be 5 to 50
> times the E-modulus of the adjacent materials.** If one knows the roughness of the contact surfaces
> in the form of a peak-to-valley distance d_pv and the maximum pressure p_max to expect, one might
> estimate the spring constant by **K = p_max / d_pv**. The units of K are [Force]/[Length]³."* ⭐

> *"Notice that for a large negative overclosure a tension σ∞ results, equal to Kε/π. ... **A good
> value is about 0.25 % of the maximum expected stress in the model.** CalculiX calculates ε from
> σ∞ and K."* ⭐ (el "contacto lineal" tiene una tracción parásita; el usuario elige cuánta).

**Distancia de generación de elementos de contacto:** `c₀·√(área del resorte)`, con **c₀ = 1e−3**
por default (adimensional), o 1e−10 si el área es cero.

**Contacto exponencial:** `p = p₀ exp(βd)` con `β = ln(100)/c₀`, donde c₀ es la holgura a la que la
presión vale 1 % de p₀. *"A large value of c₀ leads to soft contact... **hard contact is modeled by a
small value of c₀. Hard contact leads to slower convergence than soft contact.**"* ⭐ Y
*"In general, a linear contact spring formulation will converge more easily than an exponential behavior."*

**Fricción:** *"the friction coefficient μ which is dimensionless and **usually takes values between
0.1 and 0.5** and the stick slope λ which has the dimension of force per unit of volume and **should be
chosen about 100 times smaller than the spring constant**."* ⭐

**Área tributaria del nodo esclavo:** ¼ (cara cuadrilátera lineal) o ⅓ (triangular lineal) de las
caras esclavas a las que pertenece. Para caras cuadriláteras cuadráticas: **24/100** nodos medios y
**1/100** esquinas (el "arreglo" contra las fuerzas negativas). Para triangulares cuadráticas: ⅓ y **0**.

**Apareamiento (pairing):** con `SMALL SLIDING` se hace **una vez por incremento**. Sin él,
*"the pairing is checked every iteration for all iterations below 9, for iterations 9 and higher the
contact elements are frozen to improve convergence."* ⭐ (congelar el estado de contacto después de
9 iteraciones es un truco de estabilidad puro).

**Convergencia CON contacto (§6.10.2) — las modificaciones:**
- Se define `iflagact = 1` si el número de elementos de contacto cambió **significativamente** entre
  iteraciones. "Significativamente" = más de `delcon` = **0.001 (0.1 %)** relativo. ⭐
- **No se declara convergencia mecánica si `iflagact ≠ 0`** — o sea, aunque el residuo esté bien,
  si el conjunto de contactos sigue cambiando NO convergiste.
- Con node-to-face: si `iflagact=1` se **resetean** los contadores `I₀` e `I_R` y se **incrementa `I_C`**.
- Con face-to-face: se desactiva el chequeo de "demasiadas iteraciones" y la prueba de divergencia
  sólo corre si (a) el residuo pasa de **1e9**, o (b) `iflagact = 0`, o (c) el número de contactos
  **oscila** entre las dos últimas iteraciones sin cambio significativo del residuo — *"Physically
  this means that solution is alternating between two states."* ⭐
- **Salir de un mínimo local:** si el residuo crece pero la solución casi no cambia, se pone la
  bandera *aleatoric* y se remueve **un 10 % de los contactos AL AZAR** *"in order to stir the complete
  structure."* ⭐⭐ (un solver de producción, libre y serio, tiene un sacudón aleatorio documentado).
- **Si diverge:** además de reducir el paso, se dividen la rigidez del resorte y la pendiente de
  adherencia por **100** (`kscalemax`), y se restauran a 1 al converger.
- Techo duro: **60 iteraciones** por incremento en face-to-face (`itf2f`) antes de aplicar el escalado.

### 2.10 Diagnóstico de resultados malos

**El árbol de CalculiX §4 ("If you experience problems you can:"):**
1. Leer la salida en pantalla: *"the convergence information for nonlinear calculations may indicate
   the source of your problem."*
2. El archivo **`.sta`**: iteraciones por incremento.
3. El archivo **`.cvg`**: *"a very fast overview of the number of contact elements, the residual force
   and the largest change in solution in each iteration (**no matter whether convergent or not**)."* ⭐
4. La opción **"last iterations"**: escribe `ResultsForLastIterations.frd` con la deformada de
   **todas las iteraciones NO convergidas** desde el último incremento bueno. ⭐⭐ Poder VER la
   deformada del intento fallido es la herramienta de diagnóstico más potente del manual.
5. La opción **"contact elements"**: `jobname.cel` con todos los elementos de contacto en todas las
   iteraciones, visualizable.

**Los estimadores de error de CalculiX (§6.12) — dos, con filosofías distintas:**

**(a) Zienkiewicz-Zhu (`ZZS`)**: reconstruye un esfuerzo "mejorado" por mínimos cuadrados sobre un
parche de elementos, ajustando un polinomio a los valores en los **puntos de integración reducida**,
que son *"superconvergent points, i.e. points at which the stress is an order of magnitude more
accurate than in any other point within the element"*. El error = esfuerzo FE − esfuerzo mejorado.
Limitación declarada: sólo aplica de verdad a **C3D20R** (los demás usan sus puntos ordinarios), y
sólo para tets y hexas.

**(b) Estimador de gradiente (`ERR` → campo `STR` en %)**: mucho más barato y **directamente
implementable en La Forja**:
> *"A different error estimator is based on the difference between the maximum and minimum of an
> elementwise-selected principal stress at the integration points in the elements belonging to one
> and the same node."*

Receta exacta:
1. Por elemento: elegir el esfuerzo principal **1° o 3°** — se toma el mayor si
   `max|σ₁| > max|σ₃|` sobre los puntos de integración del elemento; si no, el menor.
2. Por elemento: `Δ = ` mayor diferencia de ese principal entre sus puntos de integración.
3. **Valor relativo del elemento** = `Δ / max|principal seleccionado en el elemento|`.
4. **Valor nodal** = **máximo** del valor relativo sobre todos los elementos que tocan el nodo.
5. Una **relación heurística** (calibrada contra muchos casos de error conocido) traduce ese valor
   relativo a un **error en %** por tipo de elemento. Si el nodo toca varios tipos, se toma el peor.

Y la confesión: *"In a strict sense **this is not an error estimator, it is just a measure for the
variation** of the elementwise-selected principal stress across all elements belonging to the node."* ⭐
Aun así CalculiX lo reporta en porcentaje y lo usa para decidir refinamiento — y funciona
(30 % → 5 % en la zona crítica del ejemplo §5.18).

**El error de extrapolación de cortante (CalculiX §5.14) — el caso escuela de "el número correcto
en el lugar equivocado":** viga cuadrada en flexión con **un solo C3D20R**:

| Resultado | CalculiX | Referencia analítica |
|---|---|---|
| σ_zz en el punto de integración *a* | 34.151 | **34.151** ✔ exacto |
| σ_xz en el punto de integración *a* | −0.25 | **−0.25** ✔ exacto |
| F_xx | −1. | −1. ✔ |
| M_yy | 100. | 100. ✔ |
| σ_zz en el nodo *b* (extrapolado) | 75. | 75. ✔ |
| **σ_xz en el nodo *b* (extrapolado)** | **−0.25** | **0.** ✘ |
| u_x (punta) | 2.25 | 2.50 (**−10 %**) |

La explicación: *"For a beam the shear stress varies parabolically across the section. A quadratic
volumetric element can simulate only a linear stress variation across the section. Therefore, the
parabolic variation is approximated by a constant shear stress across the section. **Since the reduced
integration points (at ±1/√3) happen to be points at which the parabolic stress variation attains its
mean value the values at the integration points are exact!** The extrapolated values to the nodes take
the same constant value and are **naturally wrong since the exact value at the corners is zero**."* ⭐⭐

Y con 5 elementos el desplazamiento pasa de −10 % a **−2.4 %**, pero **σ_xz en el nodo sigue siendo
−0.25 en vez de 0** — el error de extrapolación NO converge con la malla, es estructural.
En torsión: el par sale perfecto, el giro **−15 %**, y *"the shear stresses at node b are definitely
not correct (there is no shear stress at a corner node), however, the integration of the values
interpolated from the nodes at the facial integration points yields the exact torque!"*

**Solvers (CalculiX §7.122):** *"The iterative methods perform well for truly three-dimensional
structures. For instance, calculations for a hemisphere were about **nine times faster** with the
ITERATIVE SCALING solver, and **three times faster** with the ITERATIVE CHOLESKY solver than with
SPOOLES. **For two-dimensional structures such as plates or shells, the performance might break down
drastically and convergence often requires the use of Cholesky pre-conditioning.**"* ⭐
Traducción para La Forja: CG con precondicionador diagonal se va a arrastrar justamente en **placas
de molde** (geometría tipo placa); el IC(0) que ya tienen es obligatorio, no un lujo.

---

## 3. LO QUE HACE CREÍBLE UN RESULTADO — GATES NUMÉRICOS

Esta es la sección accionable. Cada gate = una función que devuelve PASA/FALLA con un número.

### 3.1 Los cuatro pilares (Felippa §19)

Un modelo converge si es **consistente** (completitud + compatibilidad) y **estable** (rango
suficiente + jacobiano positivo). *"The famous Lax-Wendroff theorem says that consistency and
stability imply convergence."* Y el matiz honesto: *"completeness is necessary for convergence whereas
failure of the other requirements does not necessarily preclude it. Nonetheless, the satisfaction of
the three criteria guarantees convergence and may therefore be regarded as a safe choice."*

**Índice variacional `m`** = derivada espacial más alta en el funcional de energía.
Barra / tensión plana / **elasticidad 3D → m = 1**. Viga / placa → m = 2.

**Completitud (§19.3.1):** *"The element shape functions must represent exactly all polynomial terms
of order ≤ m in the Cartesian coordinates."* Para m = 1 (nuestro caso) hay que reproducir exactamente
```
u_x = α₀ + α₁x + α₂y + α₃z     (y análogo en y, z)
```
y Felippa da el atajo de verificación: *"completeness is satisfied if **the sum of the shape functions
is unity** and the element is compatible."*

**Compatibilidad (§19.3.2):** *"Patch trial functions must be C^(m−1) continuous between
interconnected elements, and C^m piecewise differentiable inside each element."* Para m=1: **C⁰ entre
elementos**. Si falla, *"such gaps would multiply and may absorb or release spurious energy."* ⭐

### 3.2 CATÁLOGO DE GATES IMPLEMENTABLES

| # | Gate | Criterio numérico | Costo | Detecta |
|---|---|---|---|---|
| **G1** | **Jacobiano / volumen positivo** | `det J > 0` en TODOS los puntos de integración de TODOS los elementos. Para tet4: `V = det[b−a, c−a, d−a]/6 > 0`. **Falla dura, aborta.** | O(nElem), gratis | tets volteados, numeración invertida, degenerados |
| **G2** | **Calidad de tetraedro (CalculiX)** | `Q = (√6/12)·L_max/r_in`, `r_in = 3V/ΣS`. Q=1 perfecto. **Advertir Q>3, FALLAR Q>10** (umbral literal de `removesliver.f`) | O(nElem) | slivers, elementos aplastados |
| **G3** | **Relación de aspecto (Felippa)** | `AR = L_max/L_min`. **Advertir AR>3, alarma AR>10** | O(nElem) | elementos flacos |
| **G4** | **Modos de cuerpo rígido: K·r = 0** | Construir los 6 vectores de cuerpo rígido (3 traslaciones + 3 rotaciones infinitesimales) SOBRE LA K SIN RESTRINGIR y exigir `‖K·r‖/(‖K‖_F·‖r‖) < 1e−10`. Equivalente: energía `½rᵀKr / (E·V) < 1e−12` | O(6·nnz) | **errores de ensamble**, B mal construida, unidades mezcladas |
| **G5** | **Rango suficiente (Felippa §19.4.1)** | `n_E·n_G ≥ n_F − n_R` por tipo de elemento. 3D: `n_E=6`, `n_R=6`. tet4: 6·1 ≥ 6 ✔; hex8 con 1 punto: 6 < 18 ✘ (12 modos espurios) | constante | hourglassing por diseño |
| **G6** | **PATCH TEST** (Irons) | Sobre un parche de ≥5 elementos con al menos un nodo interior: imponer en TODOS los nodos de frontera `u = a + B·x` (campo lineal arbitrario). Exigir: (a) los nodos **interiores** salen del solve con el mismo campo lineal, error `< 1e−10·‖u‖`; (b) **σ es CONSTANTE** en todos los elementos, `(σ_max−σ_min)/σ_medio < 1e−10`; (c) las reacciones suman cero | un solve chico | completitud, compatibilidad, integración, condiciones de frontera — **todo de un jalón** |
| **G7** | **Suma de funciones de forma** | `Σ Nᵢ(ξ) = 1` en cada punto de integración, `< 1e−14` | trivial | completitud (atajo de Felippa) |
| **G8** | **Equilibrio global** | `‖ΣR + ΣF_aplicada‖ / ‖ΣF_aplicada‖ < 1e−8`. **R se calcula con la K ORIGINAL: `R = K_orig·u − f`, filas fijas.** Y hay que **separar reacción de carga** en los nodos que tienen ambas (§2.7) | O(nnz) | ensamble, aplicación de Dirichlet |
| **G9** | **Equilibrio de MOMENTOS** | `‖Σ(xᵢ × Rᵢ) + Σ(xᵢ × Fᵢ)‖ / (L_ref·‖ΣF‖) < 1e−8` | O(n) | cargas repartidas asimétricamente, torsión parásita |
| **G10** | **Residuo VERDADERO del solver** | Al salir del CG, **recalcular** `‖f − K·u‖/‖f‖` (no confiar en el residuo recursivo, que se desvía). Exigir `< tol` con `tol = 1e−8` para producción | 1 matvec | estancamiento del CG, pérdida de ortogonalidad |
| **G11** | **Energía: trabajo externo = energía de deformación** | `abs(½·fᵀu − Σₑ ½·εᵀDε·Vₑ) / (½·fᵀu) < 1e−10` | O(nElem) | recuperación de esfuerzos inconsistente con el ensamble |
| **G12** | **∫σ·n dA sobre la cara de reacción ≈ carga** | Integrar el tensor de esfuerzos sobre la superficie empotrada. **NO es 1e−8: es un test de MALLA.** Criterio: `< 5 %` para entregar, `< 10 %` para explorar. (Referencia: CalculiX §5.18 falló al 20 % con malla gruesa y 30 % de estimador) | O(nCaras) | **discretización insuficiente** — el único gate barato que la mide |
| **G13** | **Estimador de gradiente (`ERR` de CalculiX)** | Por nodo: `max sobre elementos incidentes de [ (max−min del principal seleccionado en los ptos de integración) / max\|principal\| ]`. Criterio operativo: **el valor en el nodo donde σ_vm es máximo debe ser < 0.10**; si es > 0.30 el número no se reporta | O(nElem) | malla gruesa **donde importa** |
| **G14** | **Convergencia de malla (3 niveles)** | Refinar `h, h/2, h/4` (o r=1.5). Con `Q_h` la cantidad de interés: **orden observado** `p = ln((Q_h − Q_{h/2})/(Q_{h/2} − Q_{h/4})) / ln(r)`; **extrapolación de Richardson** `Q_ext = Q_{h/4} + (Q_{h/4} − Q_{h/2})/(r^p − 1)`; **GCI** = `1.25·\|Q_{h/4}−Q_{h/2}\|/(\|Q_{h/4}\|(r^p−1))`. Criterios: **GCI < 5 %** y `p` cercano al teórico. Equivalente en log-log (la forma que usa Babuška): `α_obs = log(e₁/e₂)/log(N₂/N₁)` | 3 solves | discretización, y **delata singularidades** (p sale bajo) |
| **G14b** | **Interpretar el orden observado** (teorema inverso de Babuška) | Con elementos de orden `p`: si `α_obs ≈ p` → solución suave, todo bien. Si `α_obs < p` → **hay singularidad y la solución sólo está en `H^(1+α)`**. Referencias medidas: grieta LEFM → **0.5**; esquina entrante en elasticidad con ν=0.3 → **0.76**; ν=0.4999 → **0.69** | ninguno extra | **que el modelo, no la malla, sea el problema** |
| **G15** | **Cordura del régimen lineal** | (a) `max‖u‖ / L_característica < 1/10` → si no, el resultado lineal no vale (regla del 1/10); (b) rotación estimada `< 10°`; (c) **`max σ_vm < σ_y`** → si se pasa, el número reportado NO existe y el "factor de seguridad" es ficción | trivial | uso del solver fuera de su dominio |
| **G16** | **Benchmark contra referencia** | Un caso con solución cerrada (viga) + casos NAFEMS. **Criterio del propio documento NAFEMS: < 3 % contra el valor de referencia, y error de discretización estimado < 1 %.** Candidatos para nosotros: **LE1** (92.7 MPa) y **LE11** (−105 MPa, 3D térmico) | CI | todo |
| **G17** | **Dispersión promediado vs sin promediar** (fe-safe) | Por nodo: `(σ_max − σ_min)` entre los elementos incidentes, relativo al promedio. **Criterio literal: > 15 % indica malla inadecuada.** Es primo hermano de G13 pero sobre la componente que se reporta | ~gratis | malla insuficiente, medida donde se lee el número |
| **G18** | **Esfuerzo fuera de plano en la superficie** (fe-safe) | En un nodo de superficie libre, la componente directa **normal a la superficie debe ser ≈ 0**. *"A significant out-of-plane stress is an indication of inadequate meshing."* | barato | malla insuficiente **y** condición de frontera natural mal impuesta |
| **G19** | **Suma de pesos de la cuadratura** (Code_Aster) | La suma de los pesos de Gauss debe dar el volumen del elemento de referencia: hexa → **8**, quad → **4**, triángulo → **1/2**, **tetraedro → 1/6**. Ojo: hay reglas correctas con **pesos negativos** (TETRA FPG5 usa −2/15) | trivial | tablas de cuadratura mal transcritas |
| **G20** | **Signo del jacobiano al portar** | Al copiar funciones de forma de otro código, verificar la **numeración de nodos**. Code_Aster numera el TETRA como N1=(0,1,0), N2=(0,0,1), N3=(0,0,0), N4=(1,0,0) — **no es la estándar** y voltea el signo de `det J` | trivial | volúmenes negativos silenciosos |

> **Procedencia de G14.** El marco `‖e‖_E = C·N^(−α)` y el teorema inverso son de Babuška & Szabó.
> **La extrapolación de Richardson y el GCI NO están en ese paper** (ni la palabra "Richardson" aparece).
> Son la consecuencia estándar y directa de ese marco, pero hay que marcarlas en el código como
> **derivadas**, no como cita.

**Nota sobre G6 (patch test).** Es el gate con mejor relación valor/costo de toda la lista y el que
más cosas cubre a la vez. Históricamente es la invención de Irons (Felippa §1.7.2: *"the invention of
the isoparametric formulation and related tools (numerical integration, fitted natural coordinates,
shape functions, **patch test**) by Irons and coworkers"*). La versión fuerte pide además que el
parche mezcle tipos de elementos (Felippa Fig. 19.1(b)(c) muestra parches con triángulos +
cuadriláteros + barras) — *"one needs to check the possible connection of matching elements of
different types and possibly different dimensionality."*

**Nota sobre G4.** Es el gate más barato que existe y detecta la clase de bug más cara: si `K·r ≠ 0`
para una traslación rígida, el ensamble está mal y TODOS los resultados anteriores son basura,
incluida cualquier "validación" que haya coincidido por suerte.

---

## 4. ITERACIONES: CUÁNDO REMALLAR, CUÁNDO CAMBIAR DE ELEMENTO, CUÁNDO EL MODELO ESTÁ MAL

### 4.1 Cuándo se REMALLA
- **G13 alto donde importa**: el estimador supera ~10 % en la zona de esfuerzo máximo. Es el gatillo
  literal de CalculiX (`*REFINE MESH, LIMIT=`), y el criterio de éxito es *el error DONDE el esfuerzo
  es alto*, no el promedio.
- **G12 falla** (∫σ·n dA se aleja de la carga más de 5 %).
- **G14 no está en régimen asintótico**: el orden observado `p` no se parece al teórico.
- **La deformada tiene escalones** o el mapa de von Mises tiene **patrón de tablero de ajedrez**
  (checkerboard) — CalculiX lo documenta como síntoma de inconsistencia de interpolación (C3D10 con
  gradientes térmicos).
- **Elementos que fallan G1/G2/G3** en la zona de interés.
- **La geometría no está resuelta**: menos de ~3 elementos cuadráticos (o 6 lineales) a través del
  espesor en flexión — ver §2.6.

Y el contra-criterio, que es igual de importante: **NO se remalla globalmente**. CalculiX refina
localmente hasta ×8 en 3 pasadas; refinar todo multiplica el costo por 8 en 3D sin mover el número
que te importa.

### 4.2 Cuándo se CAMBIA DE ELEMENTO (no de malla)
Esto es lo que una máquina lineal nunca hace: cuando refinar **no** arregla el problema.
- **Flexión con elementos lineales**: la razón de energía `r(γ,ν)` tiende a `1−ν²` con UNA capa, o sea
  que **refinar en la dirección del claro no converge**. Cambia a C3D8I, o a cuadráticos, o mete capas
  a través del espesor. ⭐
- **Poisson alto / plasticidad / hiperelástico**: locking volumétrico → cuadráticos con integración
  reducida, o formulación híbrida/mixta (obligatoria para incompresible perfecto).
- **Deformada en zigzag con esfuerzos "buenos"**: hourglassing → hay que subir puntos de Gauss o
  activar control de hourglass. Refinar NO lo arregla (los modos espurios escalan con la malla).
- **Concentración de esfuerzo en la superficie que no aparece**: con C3D8R (punto en el centro) o
  C3D20R (puntos a ¼ del borde) los picos superficiales se pierden. Cambiar a integración completa
  cerca de la superficie o refinar mucho ahí.
- **Contacto que no converge con elementos cuadráticos**: cambiar node-to-face → face-to-face/mortar
  (Golden rule #5). El problema son las **fuerzas nodales negativas** en las esquinas, no la malla.
- **Tets lineales en cualquier cálculo estructural**: cambiar a tet10 o a hexas. CalculiX es explícito.

### 4.3 Cuándo el MODELO ENTERO está mal planteado
Señales de que no hay malla que salve:
- **Matriz singular / pivote cero** con las BC puestas → mecanismo cinemático (Felippa §8.5.1) o
  cuerpo rígido sin restringir. **Antes de tocar nada, resolver esto.**
- **La deformada no se parece a lo que pensabas**. CalculiX Golden rule #2 existe exactamente para
  esto: la corrida lineal te da *"a feeling what the solution should look like"*.
- **El esfuerzo máximo crece sin límite al refinar** → estás midiendo una **singularidad**
  (esquina entrante viva, carga puntual, apoyo puntual). El número no existe: hay que redondear la
  esquina, repartir la carga o pasar a un criterio integral (mecánica de fractura / esfuerzo a
  distancia). ⭐
- **`max σ_vm > σ_y`** en un modelo lineal → el resultado es aritmética, no física. El material se
  habría plastificado y redistribuido.
- **`max‖u‖ > L/10`** o rotaciones > 10° → el modelo lineal no aplica (regla del 1/10).
- **Cambios brutales de rigidez** en el ensamble (acero contra espuma) → *"will likely result in
  errors or failure of the analysis to complete"*.
- **Las reacciones no dan lo que la estática dice** → las BC son otra cosa de lo que creías.
- **Sensibilidad extrema a un detalle arbitrario** (dónde exactamente pusiste el empotramiento) →
  el modelo está sobrerrestringido: un empotramiento perfecto es una ficción infinitamente rígida.

---

## 5. LOS JUICIOS HUMANOS

Lo que decide la persona y ningún gate puede decidir por ella.

### 5.1 Qué se simplifica de la geometría
Felippa §1.3 lo enmarca: la idealización **precede** a la discretización, y el error de modelado
domina al de solución. La regla práctica: quitar todo detalle cuyo tamaño sea mucho menor que la
zona de interés, **excepto** si el detalle ES la zona de interés (un filete que concentra esfuerzo).
La decisión es: *¿este redondeo cambia el número que voy a reportar?* Si sí, se queda y se malla fino;
si no, estorba.

El contrapunto duro: **quitar un redondeo CREA una singularidad**. Una esquina viva en el modelo da
esfuerzo infinito. O sea que "simplificar" puede volver el resultado no convergente. ⭐

### 5.2 Simetría
Felippa §8.6: hay que estar "a la caza" de simetría/antisimetría. Pero el juicio es doble:
- ¿La geometría ES simétrica **y** la carga también? Si no, no aplica.
- Y una advertencia que Felippa mete en nota al pie: *"**Even if the conditions are not explicitly
  applied through BCs, they provide valuable checks on the computed solution.**"* ⭐ — o sea, si NO
  usas la simetría para reducir el modelo, úsala como **gate**: la solución completa debe salir
  simétrica. Es un test gratis de todo el pipeline.
- Riesgo: la simetría **elimina modos** en análisis modal y pandeo (los modos antisimétricos
  desaparecen). Nunca se usa simetría en modal sin saber qué estás borrando.

### 5.3 Lineal vs no lineal
Los umbrales que se pueden defender (Autodesk University, *Nonlinear Simulation in Fusion 360*):
- **Regla del 1/10**: *"I tend to utilize the 1/10th rule, where if my displacement is 1/10th of the
  characteristic length of my geometry, I am going to solve it with a nonlinear analysis."*
- **Rotación**: *"if your rotation exceeds any more than about 10 degrees, then it is likely time to
  start considering a nonlinear solution."*
- **Más allá de la fluencia**: *"if using this material model and you obtain stress or strain values
  beyond the yield, the values tell you that you have exceeded the yield, but **are likely inaccurate**
  and you should change to a nonlinear material model."* ⭐
- **Rigidez cambiante en el tiempo** (stress stiffening: la cuerda de guitarra que sube de tono al
  tensarse) o **cambios brutales de rigidez entre partes**.
- Y el truco de diagnóstico inverso: *"if I have an analysis that is having some difficulty converging
  and uses one of the complex material models, on occasion I will **temporarily switch parts to linear
  isotropic** to see if this analysis runs."* ⭐

### 5.4 Dónde importa la precisión
El analista decide **una cantidad de interés** antes de correr (la deflexión de la placa en el centro;
el esfuerzo en el filete del pilar; la primera frecuencia). Todo el estudio de convergencia se hace
sobre ESA cantidad, no sobre "el máximo de von Mises del modelo" — que suele vivir en una
singularidad y nunca converge. ⭐

### 5.5 Cuánto sobre-restringir
Un empotramiento (`u = 0` en toda una cara) es infinitamente rígido y **siempre** genera una
concentración de esfuerzo artificial en su borde. El juicio: ¿ese pico es el que me interesa? Si sí,
el empotramiento es el modelo equivocado (hay que modelar el tornillo, el asiento, el contacto).
Felippa §8.5 insiste en el **mínimo** de restricciones, y en antisimetría advierte explícitamente
contra sobrerrestringir.

### 5.6 Qué elemento — el juicio del "no seas héroe"
*"Never, never, never mess around with complicated or special elements, unless you are absolutely
sure of what you are doing."* Y CalculiX: *"Unless you are a specialist, do not use such elements."*
El juicio no es "cuál es el mejor elemento" sino "cuál es el más simple que no me va a mentir".

### 5.7 Cuándo parar
Felippa §8.1: *"Initial FE models may have to be substantially revised to accommodate design changes,
and there is little point in using complicated models that will not survive design iterations.
**The time for refined models is when the design has stabilized** and you have a better view picture
of the underlying physics, possibly reinforced by experiments or observation."* ⭐

---

## 6. LO QUE APORTA CADA FUENTE ESPECIALIZADA (números duros)

### 6.1 Code_Aster U2.04.04 — CONTACTO: el documento más prescriptivo del corpus

Este documento es literalmente un manual de decisiones. Es lo más cercano a un pliego que existe.

**Quién es MAESTRO y quién es ESCLAVO — NO es simétrico y NO es opcional.**
*"When one of these conditions is joined together… then this one **must** be selected like surface Master"*:

| Debe ser MAESTRA la superficie que… | Debe ser ESCLAVA la superficie que… |
|---|---|
| (a) es **rígida** | (a) es **curva** |
| (b) **recubre** a la otra | (b) es la **más pequeña** |
| (c) tiene **rigidez aparente mucho mayor** — *"one does not speak about the Young moduli but about the stiffness in N·m⁻¹"* | (c) tiene **rigidez aparente menor** |
| (d) está mallada **mucho más groseramente** | (d) está mallada **más finamente** |
| | (e) **lleva un ángulo vivo** |

Y cuando las reglas se contradicen: *"In these situations **'the art of the engineer' must prevail**."* ⭐

**Reglas duras de topología:** las zonas de contacto deben ser disjuntas; dentro de una zona la
intersección maestro∩esclavo debe ser vacía o *"computation is stopped"*; en formulación continua las
superficies esclavas deben ser disjuntas dos a dos; todos los nodos de contacto deben portar los GDL
de desplazamiento (*"An error message stops the user"*).

**El costo es asimétrico:** *"One should **not hesitate to describe broad contact zones** to avoid any
interpenetration. **It is the number of nodes of the surface slave which is determinant in the cost**
of computation. Surface Master can be as large as it is wished."* ⭐

**Normales:** *"It is **paramount always to direct the norms** of contact surfaces so that they are
outgoing."* Con verificación automática (`VERI_NORM`) que **detiene al usuario**.

**Malla en contacto — diagnóstico literal, es un gate:**
> *"When at the end of a computation one notices **a strong rate of interpenetration** of the main nodes
> inside surfaces slaves… that generally means that the **mesh of one or two surfaces is too coarse** or
> that there is a **too great difference of smoothness** between the two meshes. One can then either
> **refine**, or **reverse main and slave**."*

Y para superficies curvas: *"one does not make repositioning of nodes nor of projections on splines;
a too coarse mesh will then cause a **strong oscillation of the contact pressure (detection of the
contact a node on two)**."* ⭐ (el patrón "un nodo sí, uno no" es la firma visual de malla insuficiente
en contacto). Además: *"one will prefer modelize rather **a fillet than a sharp angle**"* porque los
algoritmos de apareamiento funcionan peor con esquinas vivas, y con mallas distorsionadas
*"**the unicity of projection is not guaranteed any more**"*.

**Criterio geométrico (bucle de punto fijo) — números:**

| Parámetro | Default |
|---|---|
| `RESI_GEOM`, punto fijo | **1 %** del desplazamiento desde el inicio del paso |
| `RESI_GEOM`, Newton generalizado | **1e−6 (0.0001 %)** |
| endurecer (ejemplo del doc) | 0.005 = **0.5 %** |
| `ITER_GEOM_MAXI` (ejemplo) | 20 |

Y el diagnóstico causal más limpio del corpus: *"When following a computation, one observes an
interpenetration of the nodes slaves in surface Master, **only the explication is a NON-checking of
the geometrical criterion**."* ⭐ Nota: con el punto fijo *"one thus makes **always at least two
iterations of geometry**"* por cómo está definido el criterio.

**"El cálculo no converge: cicla" — 3 causas ordenadas por frecuencia:**
1. *"the **most current explanation is a bad discretization of contact surfaces**"* (malla gruesa,
   diferencia de finura, **mala elección maestro/esclavo**);
2. superficies curvas con malla gruesa → discontinuidad de la normal (facetización); *"**The activation
   of the lissage then facilitates very often convergence.** That should not however prevent the user
   from re-examining his mesh"*;
3. caso patológico → forzar `n` reactualizaciones de geometría.

**Penalización — la receta numérica LITERAL:**
> *"One generally chooses E_N by successive tests: first of all one will start by taking a value equal
> to **10 times the largest Young modulus of structure multiplied by a length characteristic** of this
> one; if given computation one result (satisfying or not), one each time **increases then the value by
> multiplying it by 10 until obtaining result stable in terms of displacements and especially in terms
> of stresses**."* ⭐

O sea `E_N₀ = 10·E_max·L_car`, luego ×10 hasta estabilidad **en TENSIONES**, no sólo en
desplazamientos. Con el precio declarado: *"a sensitivity to the coefficient of penalization which
implies systematically to conduct a **parametric study before launching out in long computations**."*

Compárese con CalculiX (`K = 5..50 × E`, unidades F/L³) — son consistentes: Code_Aster usa `E·L`
porque su `E_N` es rigidez (N/m); CalculiX usa `K` como presión/penetración (N/m³).

**GCP (gradiente conjugado proyectado):** `RESI_ABSO` = interpenetración máxima tolerada, en unidades
de la malla, **obligatoria**. *"One advises to initially use a criterion equal to **10⁻³ time the
average interpenetration when the contact is not taken into account**"* — y da la manera de medirla:
correr con `RESOLUTION='NON'`. ⭐ (calibrar el gate midiendo primero el problema SIN resolverlo).

**Tabla de decisión (§3.4) — directamente traducible a código:**

| Condición | Elección prescrita |
|---|---|
| **< 500 GDL en contacto**, sin fricción | discreta + `ALGO_CONT='CONTRAINTE'` (sin ajuste, convergencia demostrada) |
| < 500 GDL, **con fricción** | formulación `CONTINUE` |
| **> 500 GDL en contacto** | `GCP`; con fricción → `CONTINUE` |
| discreta (excepto penalización) | **solo solvers DIRECTOS** |
| continua, **> 100 000 GDL** | solver iterativo + precondicionador + Newton-Krylov |

El límite de 500 es duro y está justificado: `CONTRAINTE` usa complemento de Schur y *"the problem
thus transformed has the size amongst nodes slaves and **it is full**… the factorization of a full
matrix very quickly becomes crippling."* ⭐

**Fricción:**
- *"if the coefficient of kinetic friction is very low, **it is advised to neglect frictions**. In
  addition, it is advised in the studies **to initially treat only the contact**, this in order to
  introduce non-linearities the ones after the others."* ⭐ (la doctrina de "una no-linealidad a la vez")
- Lagrangiano discreto: bien en 2D; *"For problems 3D, convergence appears more difficult in particular
  **as soon as the coefficient of kinetic friction becomes larger than 0.1**."*
- Continua: *"**It is the method of choice** when one must deal with a problem of contact-friction:
  it is most robust; moreover it **tolerates the great coefficients of kinetic friction well (larger
  than 0.3)**."* Newton generalizado da **hasta 80 % de ahorro** frente al punto fijo con resultados
  idénticos, a costa de **matriz tangente no simétrica**.
- `COEF_FROT` default **100**, rango a probar **1e−6 … 1e6**; valores **más bajos** si domina la
  adherencia, **más altos** si domina el deslizamiento.
- Ojo con la penalización de fricción: *"the phase of dependancy strictly speaking **disappears**
  (as soon as the contact is activated there is interpenetration, in friction **there is always
  sliding**)."* ⭐

**Modos de cuerpo rígido bloqueados por el contacto (§4.2):** sólo en estática. 3D → 6 modos,
2D deformación/tensión plana → 3, axisimétrico → **1**. Y el consejo primero: *"When one notes the
existence of rigid body motions… **one will always start by checking that it does not exist symmetries**
in structure and his loading."* Tolerancia interna para decidir si hay juego o interpenetración inicial:
**1e−6 × la arista no nula más pequeña de la malla**. ⭐ (una tolerancia geométrica escalada por la malla,
no absoluta).

**El procedimiento de desacople ante fallo (§4.3) — es el árbol de diagnóstico completo:**
1. Cálculo **elástico HPP con contacto activo**. Si falla → normales / maestro-esclavo / algoritmo.
2. Cálculo con **ley no lineal SIN contacto**. Si falla → el problema es la integración del comportamiento.
3. Cálculo en **grandes desplazamientos sin contacto ni material no lineal**.

Con la explicación de la causa raíz: *"by the '**abrupt' correction of the contact** [it is possible] to
start in the constitutive law mechanisms (left the elastic domain, discharges) which should not be
active in the final solution and which are likely to **degrade the tangent matrix (until making it
noninvertible)**."* ⭐ Ajustes recomendados: `REAC_ITER=1`, `PREDICTION='ELASTIQUE'`, y `SYME='NON'`
si la formulación da tangente asimétrica.

**Trampas de post-proceso (§4.7)** — puro oficio:
- Factor de amplificación de la deformada ≠ 1 *"can result in **visualizing nonreal
  interpenetrations**"*. ⭐
- El estado de contacto vale **0 = sin contacto, 1 = adherente, 2 = deslizante**, y
  *"**The adherent state is not possible except in the presence of friction**: if one visualizes such a
  value for a computation of contact without friction it is that there is **interpolation of the field**"*
  — o sea, si ves un "1" en un caso sin fricción, tu visualizador está mintiendo por interpolación. ⭐
- La presión de contacto en formulación discreta no es un GDL: hay que sacarla de Cauchy en el borde,
  **p = σ·n·n**, y *"It happens sometimes that the contact pressure raised by this method present
  **oscillations, in particular for curved geometries**."*
- En grandes deformaciones el multiplicador `LAGS_C` *"is in fact only a **density of force of contact
  per unit of area expressed on the reference configuration**… one cannot any more qualify it pressure."*

### 6.2 Code_Aster R5.03.01 — NO LINEAL CUASI-ESTÁTICO: los cuatro criterios

| Criterio | Fórmula | Default |
|---|---|---|
| `RESI_GLOB_MAXI` | `‖Qᵀσ − L_méca‖∞ ≤ γ` | sin default |
| **`RESI_GLOB_RELA`** (el que se usa) | `‖Qᵀσ − L_méca‖∞ / ‖L_méca + L_varc‖∞ ≤ η` | **η = 1e−6** |
| `RESI_REFE_RELA` | por GDL: `\|(Qᵀσ − L)_j\| ≤ ε·F_j^ref` | ε del usuario |
| `RESI_COMP_RELA` | por componente física | — |

- **Norma infinita, no euclidiana**: *"The infinite standard corresponds simply to the maximum
  component of the absolute value of the vector."* ⭐ (La Forja usa norma 2 relativa; Code_Aster usa
  el **peor GDL**, que es mucho más estricto y más informativo — te dice DÓNDE está el problema).
- Advertencia sobre el criterio absoluto: *"It is **not advised to use this criterion alone**, because
  one cannot easily have an idea of the acceptable orders of magnitude absolute."*
- **EL CASO DE CARGA CERO, con su fallback automático** (esto es oro):
  > *"the criterion can become singular if the external loading becomes null. This can arrive in the
  > event of **total discharge** of the structure. If such a case arises (i.e. **loading 10⁻⁶ time
  > smaller than the smallest loading observed until this increment**), the code uses the criterion then
  > **RESI_GLOB_MAXI with like value that observed with the convergence of the preceding increment**.
  > When the loading becomes again not null, one returns to the initial criterion."* ⭐⭐
- **Componentes que se EXCLUYEN de la norma** — si no las excluyes, el gate miente:
  - GDL con condiciones cinemáticas eliminadas (*"the degree of freedom concerned is ignored… because
    the procedure of elimination of the unknowns does not make it possible to reach the reactions"*);
  - multiplicadores de contacto `LAGS_C`/`LAGS_F` (*"these terms are **dimensionally incoherent** with
    those relating to displacements"*). ⭐
- **Combinación:** *"Convergence is issued carried out when **all the criteria specified by the user are
  checked simultaneously**. By default, one makes a test on the relative total residue and the maximum
  number of iterations of Newton."*
- **Convergencia cuadrática, con el número medible:** *"the number of zeros after the comma in the error
  **doubles with each iteration** (0.19 – 0.036 – 0.0013 – 0.0000017 for example)."* ⭐ Un gate real:
  si tu Newton no cuadra los ceros, tu matriz tangente **no es la coherente**.
- **Tangente verdadera ≠ siempre mejor**: *"If the increment is large, the tangent (known as coherent
  or consistent) **can lead to divergences of the algorithm**."*
- **Distinción crítica de operadores**: `RIGI_MECA_TANG` es la tangente del **problema continuo en
  tiempo (problema de velocidad)**; `FULL_MECA` es la del **problema discretizado en tiempo**. No son
  la misma matriz.
- **Validez de pequeñas deformaciones — dos gates numéricos**: *"the assumption of the small
  deformations can be applied as long as **the square of the modulus of deformation remains lower than
  the precision of calculations**… the assumption of small rotations can be applied as long as the
  **product between the square of the swing angle and the modulus of deformation** remains lower than
  the precision."* ⭐
- `PETIT_REAC` sólo si: comportamiento isótropo, deformaciones elásticas pequeñas frente a las
  plásticas, **rotaciones < 10°**, discretización temporal fina.
- **Line search:** `ITER_LINE_MAXI` default **0 → desactivada, ρ = 1**; `RESI_LINE_RELA` default
  **η = 0.1**. Consejo: *"Linear research is to some extent an '**insurance**'… When direction of
  research is 'bad' (**if the tangent matrix is too flexible**), the linear algorithm leads to a low
  value of ρ… **It is not necessary to do many iterations (two or three are enough to avoid the
  catastrophes)** because each one is rather expensive."* ⭐ Método de cuerda: orden de convergencia
  **≈1.6**; método mixto: bracketing con `ρ_{n+1} = 3ρ_n` desde ρ₀=1.
- **Newton-Krylov (tolerancia adaptativa del solver lineal)** — copiable tal cual a un CG:
  `η_{n+1}^Res = γ·‖Rⁿ‖²/‖R^{n−1}‖²` con **γ = 0.1**, `η₀ = 0.9`, y el limitador
  `η_{n+1} = max( min(0.4·η_n, η^Res), η_min )` si `(1−γ)η_n² ≤ 0.2`. ⭐⭐ **La tolerancia del solver
  lineal se AFLOJA cuando estás lejos y se APRIETA cuando te acercas.** Resolver el primer Newton a
  1e−6 es tirar tiempo.

### 6.3 Code_Aster R5.03.02 — PLASTICIDAD J2 (+ el tutorial de Brannon)

**El algoritmo de retorno radial, en su forma más limpia** (Brannon, verificado contra Code_Aster):

```
1) PREDICTOR ELÁSTICO
   σ_trial = σ_beg + Δt·[ 2G·dev(ε̇) + 3K·iso(ε̇) ]

2) TEST:   fac = ‖dev(σ_trial)‖ / (√2 · τ_y)
   fac ≤ 1  →  ELÁSTICO:  σ_end = σ_trial ,  ε̇ᵖ = 0
   fac > 1  →  PLÁSTICO (retorno radial):
       σ_end = iso(σ_trial) + dev(σ_trial)/fac     ← escala SÓLO el desviador
       σ̇     = (σ_end − σ_beg)/Δt
       ε̇ᵉ    = iso(σ̇)/(3K) + dev(σ̇)/(2G)
       ε̇ᵖ    = ε̇ − ε̇ᵉ
```
- Criterio: `J₂ = ½ s:s = (1/6)[(σ₁−σ₂)² + (σ₂−σ₃)² + (σ₃−σ₁)²] = k²`. Superficie = **cilindro de radio
  k√2** con eje en [1,1,1]. Calibración: cortante puro `k = τ_y`; **uniaxial `k = Y/√3`**.
  Con la advertencia: *"the relationship τ_y = Y/√3 **does not apply in general** — it is a direct
  consequence of the von Mises criterion."*
- **Condición de consistencia, en palabras**: *"the stress rate will be exactly what it would have been
  under Hooke's law **except that the part of this 'trial elastic stress rate' that is normal to the
  yield surface is discarded**."* Dividir el desviador entre `fac` ES eso. La presión no se toca. ⭐
- Limitaciones declaradas: *"radial return applies in **strain-control, but not stress-control**"* y
  *"gives grossly inaccurate results for the majority of more realistic (non von Mises) models."*

**Code_Aster: es IMPLÍCITO y CERRADO, no iterativo.** *"The method of integration used is based on a
direct implicit formulation."*
- `VMIS_ISOT_LINE` — solución cerrada exacta: **Δp = (σ_eq^e − σ_y − R'p⁻)/(R' + 3μ)** con
  **R' = E·E_T/(E − E_T)**.
- `VMIS_ISOT_TRAC` — exacta por tramos aprovechando la linealidad a trozos de la curva.
- `VMIS_ISOT_PUIS` — la única iterativa (secante), con el gate numérico: *"the derivative R' … **is
  infinite in p = 0**. Thus if p < p₀, one replaces R(p) by [una recta]… **In practice, one chooses
  p₀ = 10⁻¹⁰**."* ⭐
- Cinemático lineal: **Δp = (σ_eq^e − σ_y)/(3μ + 3C/2)** con **C = (2/3)E·E_T/(E − E_T)**, cerrada.
- **El test de coherencia de la matriz tangente** (gate de implementación literal):
  > *"It is noted that the tangent operator with the system resulting from the implicit discretization
  > differs from the tangent operator to the problem of speed. **One finds it while making Δp = 0** in
  > the expressions of C_p and a."* ⭐ → *test automático: la tangente consistente evaluada en Δp = 0
  > debe reproducir exactamente la de velocidad.*
  Con `a = 1 + 3μΔp/R(p⁻+Δp)` y `C_p = (9μ²/σ_eq²)(1 − R'Δp/σ_eq)/(R' + 3μ)`.
- **Validación de los datos de material** — dos gates sobre la curva de tracción:
  1. *"the X-coordinates (deformations) are **strictly increasing**"*;
  2. *"the **slope between 2 successive points is lower than the elastic slope** between 0 and the first
     point of the curve."* ⭐
  Y: *"To avoid generating important errors of approximation… **it is better not to use linear
  prolongation**."*
- **Vacío declarado:** este documento **no define error de integración ni criterio de tamaño de
  incremento** — precisamente porque estas leyes se integran en forma cerrada. El único control de
  precisión explícito es `p₀ = 1e−10`. Un solver casero con return-mapping cerrado **no necesita**
  tolerancia de integración local; ése es un argumento a favor de empezar por J2 isótropo lineal.

**Los dos tests de verificación de plasticidad que Brannon dice correr SIEMPRE:**
1. **Deformación uniaxial**: antes de fluir `σ_A = C·ε_A` con `C = K + 4G/3`; fluencia en
   `σ_HEL = C·Y/(2G)`; **después de fluir la pendiente pasa a ser exactamente K** (el módulo
   volumétrico), tanto en axial como en lateral. ⭐ Un gráfico con dos pendientes conocidas.
2. **Rapideces isocóricas ortogonales**: el estado gira alrededor del cilindro **sin cambiar la
   presión**. Recomendación: poner `K = 10G` para que cualquier presión espuria salte a la vista.

### 6.4 Code_Aster R5.01.01 — MODAL: verificación de una base modal

**Las DOS post-verificaciones obligatorias, ambas activadas por default y ambas ABORTAN:**

**(A) Norma del residuo** (con la normalización previa por norma infinita del vector propio):
```
u ← u/‖u‖∞
si |λ| > SEUIL_FREQ  →  ‖Au − λBu‖₂ / ‖Au‖₂  ≤  SEUIL     (relativo)
si no                →  ‖Au − λBu‖₂          ≤  SEUIL     (absoluto)
```
Defaults: **`SEUIL` = 1e−6**, **`SEUIL_FREQ` = 1e−2**. El conmutador existe para no dividir entre
casi-cero en los modos rígidos. ⭐ Órdenes de magnitud sanos medidos en los casos-test del propio
Code_Aster: **1e−11 … 1e−15**.
Y el comentario del autor sobre desactivarlo: *"**On ne saurait bien sûr que trop recommander de ne pas
désactiver ce paramètre passe-droit!**"*

**(B) Test de Sturm** — el conteo. Sólo para matrices reales simétricas. Verifica *"que le nombre de
valeurs propres contenues dans une bande test [λ₁,λ₂] est égal au nombre détecté par l'algorithme"*.
Banda test construida con `PREC_SHIFT` = **5e−3**. El mensaje de fallo real declara la causa raíz:
> *"dans l'intervalle [...] il y a théoriquement **6 fréquence(s) propres** et on en a calculé **5**.
> Ce problème peut apparaître lorsqu'il y a des **modes multiples (structure avec symétries)** ou une
> **forte densité modale**."* ⭐

**(C) Ortogonalidad.** Con A y B reales simétricas: `uᵢᵀBuⱼ = δᵢⱼaⱼ` y `uᵢᵀAuⱼ = λⱼδᵢⱼaⱼ`. Gate: las
matrices generalizadas deben salir **diagonales**. Con la advertencia: *"**L'orthogonalité par rapport
aux matrices ne signifie surtout pas que les vecteurs propres sont orthogonaux pour la norme
euclidienne classique.**"* ⭐

**Cuántos modos / dimensión del subespacio:**

| Método | Dimensión del subespacio para p modos pedidos |
|---|---|
| Lanczos | `m = min(max(4p, p+7), n_activos)` |
| **Sorensen/IRAM (default)** | `m = min(max(2p, p+2), n_activos)` |
| Bathe & Wilson | `q = min(p+8, 2p)`, y **`r = p + q/2`** para verificar convergencia — porque *"r = p ne soit pas suffisant: on peut trouver les bonnes valeurs propres **mais les vecteurs propres ne sont pas corrects** (la convergence est plus lente pour les vecteurs propres que pour les valeurs propres)"* ⭐ |

Y la única perilla real: *"pour améliorer la qualité d'un mode, **le paramètre fondamental est la
dimension du sous-espace**."*

**Límites de tamaño por método:** QZ es la referencia exacta pero **O(30n³)** en tiempo y **O(n²)** en
memoria → *"à réserver aux petits GEPs (**inférieur à 10³ degrés de liberté**)"*. IRAM es el default
por robustez y por *"**contrôle de la qualité des modes**"*.
**Estrategia HPC prescrita:** trocear en subbandas; *"**Un paquet de l'ordre de quarante modes semble
être un optimum empirique en séquentiel. En parallèle… jusqu'à la quinzaine**"*, con ganancia declarada
de **×10 a ×10⁴ en el error medio de los modos**. ⭐

**Modos rígidos:** se detectan por **pivotes nulos** de la matriz de rigidez, se bloquean, y se resuelve
un sistema lineal cuyas soluciones son los vectores propios asociados. Síntoma histórico si no se hace:
*"**des modes fantômes apparaissaient correspondant à des multiplicités ratées!**"*

**Filtrado de modos espurios (QZ) — gates numéricos duros:** si `|β| ≈ precisión de máquina` el modo se
descarta (*"il correspond sans doute à un ddl bloqué ou à un Lagrange de blocage"*); si `|α| ≥ ‖A‖` o
`|β| ≥ ‖B‖` se descarta; en GEP simétrico real toda parte imaginaria debe ser **< 1e−2**. ⭐

**Vacío declarado:** R5.01.01 **no trata masa modal efectiva** — sólo define la masa modal como escalar
de normalización. Eso viene de la fuente siguiente.

### 6.5 Masa modal efectiva (Irvine) — el criterio del 90 %

```
m̂  = ΦᵀMΦ          (masa generalizada)
L  = ΦᵀM r         (r = vector de influencia: desplazamientos de las masas ante un
                    desplazamiento unitario del suelo → movimiento de cuerpo rígido)
Γᵢ = Lᵢ / m̂ᵢᵢ      (factor de participación modal)
m_eff,i = Lᵢ² / m̂ᵢᵢ  (MASA MODAL EFECTIVA)
```
Con modos normalizados a masa (`m̂ᵢᵢ = 1`): `Γᵢ = Lᵢ` y `m_eff,i = Lᵢ²`.

**El criterio, cita literal:**
> *"How many modes should be included in the analysis? Perhaps the number should be enough so that the
> **total effective modal mass of the model is at least 90 % of the actual mass**."*

⚠️ **HONESTIDAD DE FUENTE:** este documento **NO cita NRC ni ASCE ni ninguna norma** para el 90 %. Lo
da como regla de dedo (*"Perhaps the number should be…"*). Si se necesita respaldo normativo hay que
traer NRC Reg. Guide 1.92 / ASCE 4 / ASME III — **no atribuirlo a esta fuente.** ⭐

**Invariante de test que sí es exacto:** la suma de masas efectivas = masa total. Verificado en el
ejemplo de 2 GDL del propio documento: 2.944 + 0.056 = **3.000 kg** exacto.

**Valores analíticos para tests del solver:**

| Caso | Modos | Masa capturada | Fórmula |
|---|---|---|---|
| Viga biapoyada, flexión | 7 primeros | **95.27 %** | `m_eff,n = 8ρL/(n²π²)`, modos pares = 0 |
| Viga empotrada-libre | 4 primeros | **89.92 %** | `m_eff,1 = 0.6131ρL`, `0.1883`, `0.06474`, `0.03306` |
| Barra fija-libre, longitudinal | 3 primeros | **93.30 %** | `f_n = (n−½)c/L`, `m_eff,n = 8ρL/((2n−1)²π²)` |

⭐ Nótese que **una ménsula necesita 4 modos para llegar apenas al 90 %** — el primer modo solo captura
el 61 %. Un análisis modal con "los 3 primeros modos" de una placa en voladizo no cumple el criterio.

### 6.6 Babuška & Szabó — TASAS DE CONVERGENCIA

Marco: `‖e‖_E ≈ C·N^(−α)` con N = grados de libertad.

**Teorema 2 (versión h, mallas cuasiuniformes, p fijo):**
```
‖u − u_FE‖_E ≤ C · N^(−½·min(k−1, p)) · ‖u‖_{H^k}       ⇔  en 2D:  ‖e‖_E ≤ C·h^min(k−1, p)
```
**Conclusión 2, literal:** *"In the h-version of the finite element method the **rate of convergence is
the smaller of p and k−1** if uniform or quasiuniform mesh refinement is used."*

Traducción operativa (solución suave, `k−1 ≥ p`), en **norma de energía**:

| Elemento | ‖e‖_E | Error relativo en ENERGÍA |
|---|---|---|
| lineal (p=1) | `O(h¹) = O(N^−1/2)` | `O(h²)` |
| cuadrático (p=2) | `O(h²) = O(N^−1)` | `O(h⁴)` |

**EL TEOREMA INVERSO — el resultado más útil y el que nadie usa.** Si observas
`‖e‖_E ≤ C·N^(−α/2)` en mallas cuasiuniformes con p fijo:
1. `1 < α < p` → **`u ∈ H^(1+α−ε)`** — la solución NO es suave y te acabas de enterar de cuánto.
2. `α > p` → **u es un polinomio**.
3. `α = p` → `u ∈ H^(1+α)`.

⭐⭐ **La pendiente de tu estudio de convergencia no mide tu malla: mide la SUAVIDAD de la solución
exacta.** Si sale más baja que el orden teórico del elemento, no es que tu solver esté mal — es que
hay una singularidad y tu geometría/BC la metió.

**Singularidades:** `v = Re[r^γ (log r)^δ f(θ)]` con `Re[γ] = α` → `v ∈ H^s` para todo `s < α+1`,
o sea **`k = 1 + α`**.

| Caso | α | k | **Tasa asintótica en energía (h, p=1)** |
|---|---|---|---|
| **Grieta LEFM (modo I)**, `u ~ √r` | **1/2** | 3/2 | **0.5** — independiente de ν |
| **Esquina entrante en elasticidad**, ν = 0.3 | ~0.76 | ≈1.76 | **0.76** (medido en el paper) |
| Esquina entrante, ν = 0.4999 | 0.69 | 1.69 | **0.69** |
| Solución suave | — | ≥2 | 1.0 |

**Versión p:** *"The rate of convergence of the **p-version is twice that of the h-version** when the
singularity is at element boundaries and quasiuniform meshes are used."* ⭐ Y nunca peor: *"the
p-version cannot have lower rate of convergence than the h version."*

**Casi incompresible (ν → ½):** *"**mesh refinement will not reduce the error when p = 1**, on the other
hand **use of p ≥ 3 essentially eliminates this difficulty**."* ⭐ (otro caso donde refinar no sirve;
hay que subir el orden).

**Refinamiento geométrico óptimo:** lados de los triángulos en la singularidad en **progresión
geométrica de razón (1−ρ) con ρ = 0.62 ("golden rule")**, con p creciente alejándose → convergencia
que puede ser **exponencial**.

**Energías exactas de referencia** (para tests): Problema 1 (cuadrado con cortante impuesto, cuarto de
dominio) `W = 0.130680` con ν=0.3, `0.127035` con ν=0.4999. Problema 2 (panel con grieta de borde a
tracción, cuarto de dominio) `W = 0.73422` con ν=0.3, `0.60525` con ν=0.4999.

⚠️ **VACÍOS DECLARADOS de este paper:** NO contiene extrapolación de Richardson (ni la palabra), NI
ninguna fórmula de estimador a posteriori. Las fórmulas de Richardson/GCI del gate **G14** son
**derivadas** del marco `e = C·N^−α` (legitimado por el teorema inverso), no citas de Babuška.
Hay que marcarlo así en el código.

### 6.7 NAFEMS — benchmarks con valor de referencia

⚠️ **Alcance real del PDF del corpus:** contiene **sólo 9 benchmarks lineales elásticos: LE1, LE2, LE3,
LE5, LE6, LE7, LE8, LE10, LE11.** **NO trae LE4, LE9, ningún FV (vibración libre) ni T1–T4 (térmicos).**
Y la geometría dimensional exacta vive en las FIGURAS, que `pdftotext` perdió — hay que sacarla del
NAFEMS Rev. 3 original. Salvo LE3, todos con **E = 210 GPa, ν = 0.3**.

| ID | Caso | Carga | **VALOR DE REFERENCIA** |
|---|---|---|---|
| **LE1** | Membrana elíptica, esfuerzo plano | presión exterior 10 MPa | **σ_y tangencial en D = 92.7 MPa** |
| **LE2** | Sector 30° de cascarón cilíndrico, t=10 mm | momento 1000 N·mm/long. | **σ tangencial exterior = 60 MPa** |
| **LE3** | Cascarón hemisférico R=10 m, t=0.04 m, E=68.25 GPa | 2 cargas puntuales de 2 kN | **desplazamiento radial en A = 185 mm** |
| **LE5** | Voladizo en Z, torsión | par 1.2 MN·m | **σ axial en A = −108 MPa** |
| **LE6** | Placa oblicua bajo presión | −0.7 kPa | **σ principal máx. cara inferior centro = 0.802 MPa** |
| **LE7** | Recipiente axisimétrico cilindro/esfera | presión interna 1.0 MPa | **σ axial exterior = 25.86 MPa** |
| **LE8** | Cascarón axisimétrico | presión interna 1.0 MPa | **σ circunferencial exterior a 36° = 94.55 MPa** |
| **LE10** | Placa gruesa bajo presión | 1.0 MPa cara superior | **σ_yy en D = −5.38 MPa** |
| **LE11** | Sólido cilindro/cono/esfera, térmico, α=2.3e−4/°C | gradiente lineal de T | **σ_yy en A = −105 MPa** |

**Las dos tolerancias que el propio documento usa como gate:**
- *"Minimum Mesh"* = la malla menos refinada que **converge dentro del 1 %** del target.
- *"the **discretization error** was reported to be **< 1 %** for all StressCheck results"*.
- *"the StressCheck results and the NAFEMS reference benchmark solutions **differed by < 3 %** for all
  benchmarks"*.
→ **Gate propuesto: 3 % contra el valor NAFEMS y error de discretización estimado < 1 %.**

**Advertencias que afectan la implementación de los tests:**
- LE3: *"**Point loads are inadmissible input data** … because the strain energy associated with a point
  load is not finite"* — el desplazamiento sí compara bien, el esfuerzo no. ⭐
- LE6: *"There are **multiple corner singularities** in the problem description that required graded
  meshing techniques for convergence"* → de ahí el 2.2–2.9 % residual irreducible.
- LE10: *"**constraints along a line are incompatible with 3D-elasticity**"* → hubo que fijar toda una
  cara. ⭐ (una restricción sobre una línea, en un sólido 3D, es una singularidad).
- **LE1 y LE11 son los mejores candidatos para La Forja**: LE1 es esfuerzo plano puro (0.00–0.15 % de
  error alcanzable) y LE11 es un sólido 3D térmico donde los hexaedros dieron **0.19 %** con sólo
  **8 elementos** mientras los tetraedros necesitaron **317** para 0.48 %. ⭐ (evidencia numérica directa
  de "prefiere ladrillos sobre tetraedros").

### 6.8 fe-safe — FATIGA: qué esfuerzo usar y con qué malla

Esta sección importa aunque la fatiga esté lejos, porque **contradice frontalmente lo que La Forja
reporta hoy.**

**🔴 von Mises está REPROBADO para fatiga, con tres citas independientes:**
> *"The von Mises criteria are **not successful**."*
> *"von Mises strain. **Not recommended.**"*
> *"**von Mises stress is not an adequate parameter for fatigue analysis**"* — los contornos de von Mises
> no indican de forma confiable los sitios de iniciación.

Y hay una razón estructural, no de opinión: *"the von Mises stress or strain is **always positive**…
and so **Rainflow cycle counting cannot be applied directly**."* ⭐⭐

**Y el esfuerzo principal tampoco es el reemplazo obvio:** *"principal stresses should only be used for
fatigue analysis of '**brittle**' metals, for example cast irons and very high strength steels. A fatigue
analysis using principal stresses gives **very unsafe** fatigue life predictions for more ductile metals
including most commonly used steels."* ⭐

**Los tres criterios que el manual SÍ recomienda:**
> *"**Brown-Miller**, with mean stress corrections, for **ductile** metals. **Principal (or axial) strain**,
> with mean stress corrections, for **brittle** metals. **Dang Van** for infinite life design."*
```
Brown-Miller:  Δγmax/2 + Δεn/2 = 1.65·(σ'f/E)·(2Nf)^b + 1.75·ε'f·(2Nf)^c
SWT:           (Δε/2)·σmax     = (σ'f²/E)·(2Nf)^2b + σ'f·ε'f·(2Nf)^(b+c)
Morrow:        Δε/2 = ((σ'f−σm)/E)·(2Nf)^b + ε'f·(2Nf)^c
Basquin+CM:    Δε/2 = (σ'f/E)·(2Nf)^b + ε'f·(2Nf)^c        ← la vida va en REVERSALS 2Nf
```
Validación SAE en ejes con entalla: Brown-Miller *"the most successful, with the least scatter, and most
life predictions were **within a factor of ±3**"*.

**🔴 QUÉ ESFUERZO LEER DEL FEA — contradice a CalculiX, y con razón:**
> *"**Surface stresses are required** for the analysis of fatigue crack initiation from the surface…
> There will always be nodes at the surface of the FE model and so **nodal stresses should be used for
> the fatigue calculation rather than integration point stresses.**"* ⭐

No es una contradicción real: CalculiX habla de **exactitud** (los puntos de Gauss son más exactos);
fe-safe habla de **ubicación** (la fatiga nace en la superficie y ahí no hay puntos de Gauss). La
resolución práctica: usar valores nodales **sin promediar**, y usar la dispersión entre ellos como
medida de calidad. Que es justo el siguiente punto.

**🔴 LOS DOS GATES DE MALLA PARA FATIGA — números directos:**
> *"The difference between the **averaged and un-averaged stresses at a node** is an indication of the
> quality of the finite element mesh, a large difference indicating an inadequate mesh. Although it is
> difficult to generalise, **differences of more than perhaps 15 % in the un-averaged stresses at a
> particular node could indicate an inadequate mesh.**"* ⭐⭐

> *"The out-of-plane direct stress… **should be approximately zero on the surface** of the component.
> A significant out-of-plane stress is an indication of inadequate meshing."* ⭐

Ambos son **implementables hoy en La Forja** y ninguno requiere fatiga. El primero es prácticamente
gratis: ya se calcula `vmElem` por tet y se promedia a nodos; la **dispersión** entre los tets
incidentes es el número.

Preferencia adicional: *"if fatigue lives are calculated from **un-averaged** nodal stresses and then
plotted with some averaging of the **lives**, the results can be more realistic than if the lives are
calculated from averaged nodal stresses."* ⭐ (promediar al final, no al principio).

**Otros números del manual:**
- **Miner:** falla en `Σ n/N = 1`. **No aparece 0.3 ni 0.5** en este manual. Realidad medida: *"narrow
  band signals give Miner's summations close to 1.0, and **Miner's summation reduces as the signal
  becomes broader band**"*. Y: **~50 % del daño total lo causan ciclos por debajo del límite de fatiga**;
  omitirlos duplica la vida calculada. Sólo se pueden descartar ciclos con amplitud **< 25 %** del
  límite de fatiga de amplitud constante.
- **Expectativa realista de exactitud:** *"for many components made from conventional steels, achieved
  fatigue lives will be **between 50 % and 200 % of the calculated life**."* ⭐ (un factor de 4 de
  incertidumbre en el mejor caso — ponerlo en la UI antes de que alguien crea el número).
- **Constantes por defecto (método de Seeger)**, aceros al carbono/baja aleación:
  **σ'f = 1.5σu**, **ε'f = 0.59a**, **b = −0.087**, **c = −0.58**, **n' = 0.15**, **K' = 1.65σu**
  (con `a = 1.0` si `σu/E < 0.003`, si no `a = 1.375 − 125σu/E`). Aleaciones Al/Ti: 1.67σu, 0.35,
  −0.095, −0.69, 0.11, 1.61σu. Universal Slopes: **b = −0.12, c = −0.6** para todo.
  Con la advertencia: *"only the estimates of σ'f showed any correlation with test values. **Estimates
  of ε'f, b and c showed large errors.**"*
- **Rainflow:** regla de cierre = *"the range between the two most recent peak/valleys must be greater
  than the preceding range"*. Requisito de arranque: **empezar en el máximo absoluto** de la señal.
  Gate de histéresis: **1 % del rango máximo** de la señal.
- **Kt/Kf:** `q = (Kf−1)/(Kt−1)`; *"For many steels in general engineering use, **q has a value between
  0.9 and 1.0**"* → usar Kt en lugar de Kf *"is not excessively conservative"*.
- **Límite de fatiga (aceros, probeta lisa pulida, R=−1):** ≈ **50 % del UTS** (rango 30–60 %) si
  UTS < 1000 MPa; **500 MPa típico** si UTS > 1000 MPa. Amplitud a 1000 ciclos ≈ **90 % del UTS**.
  Aluminio **no tiene** límite de fatiga.
- **Plano crítico obligatorio:** *"**If the direction of principal stresses is not constant, a critical
  plane analysis must be carried out** to determine the most damaged plane at each node."* ⭐
- **NO existe** en el manual ninguna regla del tipo "N elementos a lo largo del radio de la entalla".
  Sus criterios de malla son exactamente los dos numéricos de arriba.

### 6.9 Code_Aster R3.01.01 — puntos de Gauss por tipo de elemento

Convención: **la suma de los pesos = el "volumen" del elemento de referencia** (gate de implementación
trivial y muy efectivo: hexaedro → 8, cuadrángulo → 4, triángulo → ½, tetraedro → **1/6**).

**Gauss 1D (Felippa Tabla 17.1):** p puntos integran exactamente polinomios de orden **2p − 1**.

| p | Abscisas | Pesos |
|---|---|---|
| 1 | 0 | 2 |
| 2 | ±1/√3 = ±0.577350269189626 | 1, 1 |
| 3 | ±√(3/5) = ±0.774596669241483, 0 | 5/9, 8/9, 5/9 |
| 4 | ±0.339981043584856, ±0.861136311594053 | 0.652145154862546, 0.347854845137454 |

Para p > 6 las abscisas **no son expresables en radicales** — sólo punto flotante.

**Familias por tipo de elemento (Code_Aster):**

| Elemento | Familias | Nº puntos | Orden exacto |
|---|---|---|---|
| QUAD4/8/9 | FPG1, **FPG4 (2×2)**, **FPG9 (3×3)** | 1, 4, 9 | 1, 3, 5 |
| **TETRA4/10** | **FPG1, FPG4, FPG5, FPG15** | 1, 4, 5, 15 | **1, 2, 3, 5** |
| **HEXA8/20/27** | **FPG8 (2×2×2)**, **FPG27 (3×3×3)** | 8, 27 | **3, 5** |
| PENTA6/15/18 | FPG6, FPG8, FPG21 | 6, 8, 21 | 3, 3, 5 |
| PYRAM5/13 | FPG5, FPG6, FPG27 | 5, 6, 27 | — |

**Tetraedros (volumen de referencia = 1/6)** — lo que La Forja necesitaría para tet10:
```
FPG1  (orden 1): (¼,¼,¼),  w = 1/6
FPG4  (orden 2): permutaciones de (a,a,a),(a,a,b),(a,b,a),(b,a,a)
                 a = (5−√5)/20,  b = (5+3√5)/20,   w = 1/24 cada uno    ← los 4 puntos del C3D10
FPG5  (orden 3): (¼,¼,¼) con w = −2/15   ← ¡PESO NEGATIVO, no es un bug!
                 (b,b,b) y permutaciones, b = 1/6, c = ½,  w = 3/40
FPG15 (orden 5): a=¼ → 8/405 ; b₁=(7+√15)/34, c₁=(13−3√15)/34 → (2665−14√15)/226800 ;
                 b₂=(7−√15)/34, c₂=(13+3√15)/34 → (2665+14√15)/226800 ;
                 d=(5−√15)/20, e=(5+√15)/20 → 5/567
```
⭐ **Hay reglas de cuadratura con PESOS NEGATIVOS** (TETRA FPG5, TRIA FPG4, PENTA FPG8). Una validación
ingenua tipo "todos los pesos deben ser positivos" rechazaría reglas correctas y publicadas.

**Hexaedros:** FPG8 = (±1/√3, ±1/√3, ±1/√3) con **w = 1.0** cada uno (suma 8 ✔). FPG27 = coordenadas
en {−√(3/5), 0, +√(3/5)} con pesos producto de 5/9 y 8/9: `c1³` en las 8 esquinas, `c1²c2` en las 12
aristas, `c1c2²` en las 6 caras, `c2³` en el centro.

⚠️ **Numeración de nodos del TETRA en Code_Aster: N1=(0,1,0), N2=(0,0,1), N3=(0,0,0), N4=(1,0,0)** —
**no es la numeración estándar**. Al portar fórmulas entre códigos, esto invierte el signo del
jacobiano. ⭐

## 7. BRECHA CONTRA LA FORJA

### 7.1 Qué tenemos hoy (leído del código, no del README)

`src/forja/brep/fea.ts` (1 191 líneas) + `src/forja/mold/mold-fea.ts` + `src/forja/mold/structural.ts`.

| Pieza | Estado real |
|---|---|
| Malla | **Voxelización del AABB**, clasificación inside/outside por **ray-cast del CENTRO del voxel** contra la malla teselada; `resolution` = voxeles en el lado más largo (default 16) |
| Elemento | **tet4** (`tet4Element` de `lib/formulas.ts`), 1 punto de integración, deformación constante |
| Partición del voxel | **Freudenthal de 6 tets** compartiendo siempre la diagonal n0→n6. El comentario del código documenta que el split de Kuhn de 5 tets daba **~17 % de error y NO convergía** |
| Solver | CG disperso CSR + precondicionador **IC(0)** (con caída a Jacobi), `tol = 1e−6` sobre `‖r‖/‖f‖` **recursivo**, `maxIter = max(2000, 4·nDOF)`, **warm-start** para el modo vivo |
| Dirichlet | eliminación simétrica: fila/columna = `e_d`, `f[d]=0` — **destruye las filas fijas de K** |
| Cargas | `totalForce` repartida **por partes iguales entre los nodos de la cara**; o `pressure` × **área OCCT exacta** de la cara → misma repartición uniforme |
| Post | von Mises por elemento; nodal = **promedio aritmético de los tets incidentes**; `minSafetyFactor = σ_y / max σ_vm` |
| Verificación | `scripts/fea-node-test.cjs` (tensión + ménsula, σ<3 %, δ<15 %), `scripts/fea-convergence.cjs` (barra a tensión, 4 resoluciones), `scripts/fea-cantilever-verify.cjs` (por la UI con Playwright) |

### 7.2 Qué YA cumple los criterios del pliego (y hay que reconocerlo)

✅ **Compatibilidad (Felippa §19.3.2).** El split de Freudenthal conforme es exactamente el requisito
de compatibilidad, y el equipo lo descubrió **empíricamente pagando 17 % de error**: Kuhn-5 con el
mismo patrón en todos los cubos no tría las caras compartidas igual desde ambos lados → **gaps
interelemento** → *"such gaps would multiply and may absorb or release spurious energy"*. La cita de
Felippa explica el bug que ya arreglaron. **No tocar esa decisión.**

✅ **Calidad de malla (G2, G3).** Calculado sobre el split de Freudenthal del voxel unitario: los
**6 tets son congruentes** con `Q = 1.7071` cada uno (perfecto = 1, sliver = 10) y `AR = √3 ≈ 1.73`.
**La malla pasa el gate de calidad de CalculiX con margen enorme.** El problema de La Forja **no es
la forma de los elementos** — conviene decirlo para no gastar esfuerzo ahí.

✅ **Jacobiano positivo (G1).** Por construcción: voxeles rectangulares con conectividad fija.

✅ **Rango suficiente (G5).** tet4 con 1 punto: `n_E·n_G = 6·1 = 6 = n_F − n_R = 12 − 6`. Justo en el
límite, sin modos espurios. **No hay hourglassing posible.**

✅ **Área exacta para presión.** Usar el área OCCT de la cara en vez del área de la malla escalonada
es correcto y es más de lo que hacen muchos.

✅ **Precondicionador IC(0).** CalculiX advierte que el escalado diagonal se cae *"drastically"* en
geometrías tipo placa — que es EL caso de los moldes. Tener IC(0) es la decisión correcta.

✅ **Warm-start del CG.** Legítimo (CG es exacto en aritmética exacta, el warm-start sólo cambia
iteraciones).

### 7.3 Qué NO cumple — ordenado por (valor / costo)

#### NIVEL 0 — gates baratos, se implementan hoy

| Gate | Por qué falta y qué cuesta |
|---|---|
| **G8 equilibrio de reacciones** | **Imposible hoy**: la eliminación de Dirichlet borra las filas fijas de K, así que `R = K_orig·u − f` no se puede recuperar. **Arreglo de ~20 líneas**: guardar una copia de las filas fijas ANTES de eliminarlas (son pocas), y calcular `R_d = Σ_j K_orig[d][j]·u[j]` para cada DOF fijo. Después: `‖ΣR + ΣF‖/‖ΣF‖ < 1e−8`. **Este es el gate #1 que falta.** |
| **G10 residuo verdadero** | Hoy se reporta el residuo **recursivo** (`r -= α·Kp`), que se desvía del verdadero por acumulación en flotante. Un matvec extra al salir: `‖f − K·u‖/‖f‖`. |
| **`converged: false` no bloquea nada** | `runFEA` devuelve el resultado igual y la UI lo pinta. Debe **lanzar o marcar el resultado como inválido**. |
| **G15 cordura del régimen** | 3 comparaciones: `max‖u‖ vs L/10`, `max σ_vm vs σ_y`. Hoy `minSafetyFactor` puede salir 0.3 y se reporta como si el número fuera real. **Si SF < 1, el resultado lineal no describe la pieza** — hay que decirlo en la UI. |
| **G4 K·r = 0** | 6 matvecs sobre la K sin restringir. Detecta cualquier bug de ensamble futuro. Es un test unitario, no runtime. |
| **G11 energía** | `½fᵀu` contra `Σ ½εᵀDε V`. Los dos números ya existen en el flujo. |
| **G13 estimador de gradiente** | **Casi gratis y de altísimo valor.** Hoy ya se recorren los tets calculando σ; sólo falta, por nodo, el `max−min` del principal seleccionado entre los tets incidentes, dividido entre `max\|principal\|`. Da un **mapa de confianza** que se puede pintar al lado del von Mises. Además hace de gatillo automático de refinamiento. |
| **G17 dispersión 15 %** | El **más barato de todos**: `runFEA` ya acumula `vmNodalAcc/vmNodalCnt` para promediar; basta guardar también min y max. Si `(max−min)/prom > 0.15` en el nodo crítico, la malla es inadecuada **según fe-safe, con número literal**. Dos líneas. |
| **G12 ∫σ·n dA** | Sumar `σ·n·A` sobre las caras triangulares de frontera del conjunto empotrado. Es EL gate que mide malla. Criterio 5 %. |

#### NIVEL 1 — mejoras de modelo, alto retorno

| Cambio | Justificación de las fuentes | Impacto |
|---|---|---|
| **Repartir la carga por ÁREA TRIBUTARIA (EbE), no por número de nodos** | Felippa §8.3.2. Hoy `per = force/loadNodes.length` sobrecarga los nodos del borde de la cara (menos área tributaria). Sospecho que **es la causa del "δ sale ~10 % alto"** que el propio `fea-node-test.cjs` documenta y atribuye a "carga en las esquinas". Arreglo: recorrer las caras triangulares de frontera del conjunto cargado y repartir `A/3` a cada nodo. | δ correcto sin cambiar nada más |
| **⭐ USAR HEXAEDROS, NO TETRAEDROS** | Es la brecha grande. **La malla YA ES una rejilla de hexaedros perfectos** y la estamos partiendo en 6 tets lineales. Felippa: *"prefer strongly bricks over wedges, and wedges over tetrahedra. The latter should be used only if there is **no viable alternative**"* — **aquí SÍ hay alternativa, está literalmente ahí**. CalculiX sobre el C3D4: *"not suited for structural calculations unless a lot of them are used (the element is too stiff)"*. Y sobre el **C3D8I**: *"shear locking is removed and volumetric locking is much reduced ... **should be used in all instances in which linear elements are subject to bending**"*. Los modos incompatibles son EXACTOS en elementos rectangulares — y los voxeles son rectangulares por construcción. | Flexión de placa de molde: pasa de "67 % de la energía por capa (cota optimista, tet4 es peor)" a prácticamente exacto. **6× menos elementos que ensamblar.** Mismos nodos, mismo solver, mismo sparse |
| **Alternativa/complemento: tet10** | Si prefieren no reescribir el elemento: meter nodos medios en las aristas (trivial en rejilla) → C3D10, 4 puntos de Gauss. CalculiX: *"behaves very well and is a good general purpose element"* | quita el locking, pero ×~7 GDL |
| **Reportar σ en los puntos de integración, no promediado a nodos** | CalculiX §6.13. Con tet4 el promedio nodal de deformación constante suaviza el pico real. Guardar ambos: `vmElem` (verdad) y `vmNodal` (bonito), y que el **factor de seguridad use `vmElem`** | ya se guardan los dos; es política de reporte |
| **Marcar los nodos de superficie escalonada como NO CONFIABLES** | El voxelizado da una superficie en escalones. Cada escalón es una **esquina entrante viva** → singularidad → Felippa §8.2.1 la lista como zona de gradiente alto. **El máximo de von Mises de la pieza casi siempre cae en un escalón artificial.** Mitigación honesta: reportar el σ_vm máximo **del interior** o de una banda a ≥1 voxel de la frontera, y etiquetar el máximo superficial como "geometría escalonada" | evita reportar un pico inventado como si fuera el crítico |
| **Capas a través del espesor** | Con `resolution=16` sobre el lado más largo, una placa de molde de 30 mm en un molde de 250 mm tiene **~2 voxeles de espesor**. Felippa E17.8: **una capa nunca converge en flexión** (techo `1−ν² = 0.91` para acero, y eso con bilineales; tet4 es peor). **Gate: exigir ≥4 elementos a través de la dimensión menor de cualquier cuerpo en flexión**, o abortar con mensaje | es lo que distingue un número de un dibujo |
| **G14 estudio de convergencia formal** | Ya existe `fea-convergence.cjs` (barra a tensión, 4 resoluciones) pero **imprime, no juzga**. Falta: orden observado `p`, Richardson, GCI, y **FALLAR si GCI > 5 %** | convierte un script informativo en un gate |

#### NIVEL 2 — capacidades que faltan, ORDENADAS POR VALOR PARA MOLDES

1. **CONTACTO** — el que más vale, con diferencia. Un molde **es** un ensamble de placas apiladas
   que se tocan, con la línea de partición abriéndose bajo presión de fundido. Hoy `mold-fea.ts`
   **fusiona** las placas con `K.fuse` y empotra los rieles — o sea, modela como monolítico algo que
   está atornillado y en contacto. El criterio de negocio ya está en `structural.ts`:
   `flashRisk = δ > 0.02 mm` (venteo). **Ese es un problema de contacto/separación, no de flexión de
   una viga fusionada.**

   **Camino de menor riesgo, con los números de las fuentes:**
   - Empezar **sin fricción** — Code_Aster: *"it is advised in the studies to initially treat only the
     contact, this in order to introduce non-linearities the ones after the others."*
   - **Contacto de penalidad normal**, nodo a nodo, aprovechando que los voxeles de placas apiladas se
     pueden **alinear** (mallas coincidentes ⇒ el apareamiento es trivial y desaparece la mitad de los
     problemas del documento de Code_Aster).
   - Rigidez inicial: CalculiX `K = 5..50 × E` (unidades F/L³) ó Code_Aster `E_N₀ = 10·E·L_car`
     (unidades F/L). **Luego ×10 hasta que se estabilicen los ESFUERZOS, no sólo los desplazamientos.**
   - `σ∞ ≈ 0.25 %` del esfuerzo máximo esperado (la tracción parásita del resorte lineal).
   - Esclavo = la malla **más fina**, la superficie **más pequeña**, la **menos rígida**. Aquí es la
     placa que se abre; maestro = el paquete rígido.
   - **Estamos por debajo del límite duro de 500 GDL en contacto** si sólo se maneja la línea de
     partición de una placa a resolución 16 → alcanza el algoritmo simple sin ajuste.
   - Gate obligado desde el día 1: **medir la interpenetración residual**. Code_Aster:
     *"only the explication [de la interpenetración] is a NON-checking of the geometrical criterion"*,
     y su criterio por default es **1 % del desplazamiento del paso**, endurecible a 0.5 %.
   - Y el que nos aplica directísimo: un patrón de presión de contacto **"un nodo sí, uno no"** es la
     firma de malla demasiado gruesa en la zona de contacto.
2. **PANDEO / rigidez geométrica** — los pilares de soporte (support pillars) bajo la placa trasera
   son **columnas a compresión**. Hoy sólo se checa σ. Un pilar esbelto falla por pandeo mucho antes
   que por fluencia. `*BUCKLE` de CalculiX (Lanczos, precisión default 0.01) sobre la K geométrica.
   **Barato de agregar y directamente aplicable al producto que ya vendemos.**
3. **TÉRMICO-ESTRUCTURAL** — el molde tiene canales de enfriamiento (ya está el módulo térmico
   Kazmer cap. 9 en el repo). El acoplamiento térmico→esfuerzo es real y **la advertencia del C3D10T
   aplica directo**: interpolar T cuadrática y u cuadrática con tet10 da **tablero de ajedrez en los
   esfuerzos** con gradientes térmicos fuertes. Si se va a tet10, **interpolar T linealmente**.
4. **MODAL** — valor bajo para moldes estáticos, pero es el gate de rigidez más rápido que existe:
   la primera frecuencia es un escalar sensible a TODA la rigidez del modelo. Como test de regresión
   vale más que como producto. Si se hace, se hace con las **dos post-verificaciones obligatorias** de
   Code_Aster: **norma del residuo `‖Ku − λMu‖/‖Ku‖ < 1e−6`** (normalizando antes por `‖u‖∞`, con el
   conmutador a criterio absoluto si `|λ| < 1e−2` para no dividir entre casi-cero) **y conteo de modos**.
   Criterio de suficiencia: **≥ 90 % de masa modal efectiva** — recordando que una ménsula necesita
   **4 modos** para llegar apenas al 89.9 % (el primero solo capta el 61 %).
5. **PLASTICIDAD (J2)** — valor bajo en moldes: el acero P20/H13 se diseña **elástico**, y si se
   plastifica el molde ya se arruinó. Su valor real es **decir la verdad**: hoy cuando `σ_vm > σ_y`
   se reporta un factor de seguridad ficticio. Con G15 (barato) se resuelve el 90 % del daño sin
   implementar plasticidad. Si algún día se hace, el argumento a favor de **J2 isótropo lineal** es que
   el retorno radial tiene **solución CERRADA** (`Δp = (σ_eq^e − σ_y − R'p⁻)/(R' + 3μ)`): no hay
   iteración local, no hay tolerancia de integración que calibrar, y el propio Code_Aster no documenta
   ninguna porque no la necesita.
6. **FATIGA** — un molde hace 10⁵–10⁶ ciclos de apertura/cierre y `structural.ts` ya cita el límite de
   fatiga del P20 (456 MPa). Es la capacidad de **mayor valor comercial a largo plazo** (predecir
   vida del molde en número de disparos), pero **el manual de fe-safe nos dice que el número que hoy
   reportamos —von Mises— es precisamente el que NO sirve**, y que ni siquiera se le puede aplicar
   rainflow porque siempre es positivo. Prerrequisitos, en orden: (a) esfuerzos **superficiales**
   confiables ⟹ arreglar la superficie escalonada; (b) guardar el **tensor completo** por nodo, no sólo
   el escalar; (c) criterio de **plano crítico** si las direcciones principales rotan; (d) ciclo de carga
   + rainflow. Y poner en la UI la expectativa honesta del manual: **la vida real cae entre el 50 % y el
   200 % de la calculada**.

**Orden recomendado: NIVEL 0 completo (empezando por G8 reacciones, G17 dispersión y G15 cordura, que son
los tres más baratos) → EbE por área tributaria → hexa C3D8I → G14 con GCI → LE1/LE11 de NAFEMS en CI →
contacto normal sin fricción → pandeo.**

---

## 8. LOS 10 ⭐ — LO QUE UNA MÁQUINA LINEAL SE SALTA

**⭐1 — Que el solver converja no dice NADA de si el número sirve.**
Felippa §1.3.1 separa tres errores: solución, discretización y modelado. *"[el error de solución] is
not generally important... the simulation error in practice can be identified with the modeling
error."* Una máquina reporta `residual: 1e-7, converged: true` y se siente validada. Los tres errores
son ortogonales; el que domina es el que **nadie mide**.

**⭐2 — La suma de reacciones es exacta por construcción; NO valida la malla.**
CalculiX §5.18, medido: con una malla tan mala que el estimador marcaba 30 %, `ΣRF = 9.000000` exacto,
mientras `∫σ·n dA` sobre la misma cara daba **7.23 en vez de 9 (−20 %)** y el momento **65.5 en vez de
72 (−9 %)**. El gate de equilibrio nodal prueba el ENSAMBLE. El gate que prueba la MALLA es la
integral de esfuerzos sobre la superficie. Una máquina implementa el primero, lo ve pasar, y declara
el modelo verificado.

**⭐3 — Refinar en la dirección equivocada NO converge, nunca.**
Felippa Ex. 17.3, nota 10: *"even if we make a → 0 and γ → ∞ by taking an **infinite** number of
rectangular elements along x, the energy ratio r remains less than one if ν > 0 since r → 1 − ν²."*
Para acero (ν = 0.3) el techo es **0.91**: 9 % de error irreducible con **una capa** a través del
espesor, con infinitos elementos a lo largo. La máquina refina globalmente, ve que el error baja un
poco y se estanca, y concluye "convergió". La respuesta correcta no es más elementos: es **capas a
través del espesor** o **otro elemento**.

**⭐4 — Los modos espurios dan desplazamientos absurdos con esfuerzos CORRECTOS.**
CalculiX §6.2.2 sobre el C3D8R: *"There are 12 spurious zero energy modes leading to massive
hourglassing... **the displacements are completely wrong. Since the zero energy modes do not lead to
any stresses, the stress field is still correct.**"* Un verificador automático que mira el campo de
esfuerzos (que es lo que se reporta) **pasa el modelo**. Sólo el ojo humano viendo la deformada en
zigzag lo cacha. Y la teoría lo predecía: Felippa `n_E·n_G ≥ n_F − n_R` da exactamente `18 − 6 = 12`.

**⭐5 — Una presión uniforme produce fuerzas nodales NEGATIVAS.**
CalculiX §6.11.2: en una cara de C3D20(R), presión unitaria → **1/3 en los nodos medios y −1/12 en
las esquinas**; en C3D10 → **1/3 en los medios y 0 en las esquinas**. Cualquier repartición
"intuitiva" (fuerza total / número de nodos, que es exactamente lo que hace La Forja) está mal para
elementos cuadráticos, y es la causa documentada de divergencia en contacto — tanto que CalculiX
**falsea** los pesos a 24/100 y 1/100 para que el contacto no reviente.

**⭐6 — `RF` mezcla reacción con carga, y el error "mejora" con la malla, imitando convergencia.**
CalculiX §6.11.5: en una placa empotrada con presión, `RF` reporta **−7/12** en vez de −1, y
*"by selecting an even finer mesh the sum of the external forces at the border nodes will approach
−1."* Un gate de equilibrio ingenuo ve un residuo que baja al refinar y lo lee como convergencia de
malla, cuando es un **error conceptual de contabilidad** que se diluye.

**⭐7 — El esfuerzo puede ser EXACTO en el punto de integración y estar completamente mal en el nodo,
para siempre.**
CalculiX §5.14: viga en flexión, `σ_xz` = −0.25 exacto en el punto de integración (los puntos
reducidos a ±1/√3 caen justo donde la parábola vale su promedio) y `σ_xz` = −0.25 extrapolado al nodo
de esquina, donde **el valor exacto es 0**. Con 5 elementos el desplazamiento mejora de −10 % a −2.4 %
y **el cortante nodal sigue igual de mal**. La máquina promedia a nodos porque es lo que se pinta, y
ese error NO converge.

**⭐8 — El único número que reportamos, von Mises, es exactamente el que NO sirve para fatiga —
y ni siquiera se le puede aplicar rainflow.**
fe-safe, tres veces y con distintas palabras: *"The von Mises criteria are **not successful**"*,
*"von Mises strain. **Not recommended**"*, *"**von Mises stress is not an adequate parameter for fatigue
analysis**"*. Y la razón estructural, no de opinión: *"the von Mises stress or strain is **always
positive**… and so **Rainflow cycle counting cannot be applied directly**."* Peor: el reemplazo
"obvio" tampoco sirve — el esfuerzo principal *"gives **very unsafe** fatigue life predictions for more
ductile metals including most commonly used steels"*. Una máquina reporta el escalar que ya tiene y le
pone un "factor de seguridad" encima. Lo correcto es guardar el **tensor completo por nodo** y decidir
el criterio (Brown-Miller para dúctiles) según el material. Corolario del mismo manual, igual de
incómodo: hay que usar valores **nodales sin promediar** para la superficie —donde no hay puntos de
Gauss—, aunque sean menos exactos, y usar su **dispersión (> 15 % = malla mala)** como medida de
calidad. Precisión y ubicación tiran en direcciones opuestas, y el analista elige.

**⭐9 — Simplificar la geometría CREA singularidades; el máximo de von Mises deja de existir.**
Quitar un filete para "aligerar la malla" mete una esquina entrante viva. El esfuerzo ahí no converge:
crece indefinidamente al refinar. Una máquina refina, ve que `max σ_vm` **sube**, y refina más.
El analista sabe que ese número no existe y elige otra cantidad de interés (deflexión, esfuerzo a
distancia, energía). Felippa §8.2.1 lista las esquinas entrantes como la primera "zona de peligro" —
no para reportarlas, para **no creerles**.

**⭐10 — La convergencia real tiene paciencia, memoria, predicción, azar deliberado, y CAMBIA DE
CRITERIO cuando la carga se va a cero.**
Cuatro cosas que ningún `if (residual < tol)` contiene:
1. **Divergencia sólo si el residuo subió en DOS iteraciones consecutivas** (CalculiX: `r_{i−1} > r_{i−2}`
   Y `r_i > r_{i−2}`), no en una. Una subida es Newton haciendo su trabajo.
2. **Abortar antes de fallar**: desde la iteración `I_R = 8` se **extrapola logarítmicamente** cuántas
   iteraciones faltan; si la predicción pasa de `I_C = 16`, el incremento se corta a la mitad **sin
   llegar a agotar el presupuesto**.
3. **Sacudón aleatorio documentado**: si el residuo crece pero la solución casi no cambia (mínimo local
   del contacto), CalculiX remueve *"a percentage of the contacts (default: 10 %) **in an aleatoric way
   in order to stir the complete structure**"*.
4. **El criterio relativo se rompe con carga cero, y hay que preverlo**. Code_Aster R5.03.01:
   *"the criterion can become singular if the external loading becomes null… If such a case arises
   (i.e. **loading 10⁻⁶ time smaller than the smallest loading observed until this increment**), the code
   uses the criterion then **RESI_GLOB_MAXI with like value that observed with the convergence of the
   preceding increment**. When the loading becomes again not null, one returns to the initial criterion."*
   Un solver casero que sólo mira `‖r‖/‖f‖` **falla exactamente cuando `f → 0`**, que es el caso de la
   descarga total — o sea, el momento más común de todos.

Y como coda del mismo espíritu: la tolerancia del solver lineal **no debe ser fija**. Newton-Krylov afloja
el CG cuando estás lejos (`η₀ = 0.9`) y lo aprieta cuadráticamente al acercarte
(`η_{n+1} = γ‖Rⁿ‖²/‖R^{n−1}‖²`, `γ = 0.1`). Resolver la primera iteración de Newton a 1e−6 es tiempo
tirado a la basura.

---

### Menciones de honor (⭐ que no cupieron en el top 10, todas desarrolladas arriba)

- **J = 0 es un bug o una herramienta según la intención**: colapsar un cuadrilátero a triángulo es un
  error (*"This contradicts the (erroneous) advise of some FE books"*), pero mover el nodo medio al
  **punto de cuarto** anula J a propósito y produce un **elemento de grieta** válido para LEFM (§2.2).
- **Maestro y esclavo NO son simétricos**: 8 reglas duras de Code_Aster, y cuando se contradicen
  *"the art of the engineer must prevail"* (§6.1).
- **La pendiente del estudio de convergencia mide la SUAVIDAD de la solución, no la calidad de tu malla**
  (teorema inverso de Babuška, §6.6).
- **Hay reglas de cuadratura correctas con pesos NEGATIVOS** (TETRA FPG5 usa −2/15) — un validador
  ingenuo las rechazaría (§6.9).
- **Un factor de amplificación de deformada ≠ 1 hace "ver" interpenetraciones que no existen** (§6.1).
- **La suma de masas modales efectivas de los 3 primeros modos de una ménsula NO llega al 90 %**;
  el primer modo capta apenas el 61 % (§6.5).

---
