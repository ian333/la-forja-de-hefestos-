# Digesto maestro CAD/CAE para La Forja

> **Para qué sirve este documento.** Es el mapa de lo *avanzado* (más allá de apretar botones) en las 12 áreas que un CAD/CAE que aspire a superar a Fusion/Ansys debe modelar. Por cada área: **qué enseñan de avanzado**, **la matemática real** (ecuaciones, no hand-waving) y **qué manual leer**. Filosofía La Forja: el wow EMERGE de la corrección. Nada se hardcodea; todo sale de la fórmula real.

> **Atajo de lectura (P0).** Si solo lees 5 cosas: (1) **CalculiX manual** — un solo PDF cubre 7 áreas y es el motor FE abierto que puedes usar de referencia/backend; (2) **Felippa, IFEM Book** — de dónde sale `K·u=f`; (3) **MIT 2.158 Lecture 6** — la matemática NURBS que sostiene toda la geometría; (4) **Code_Aster R5.03.01/02** — el algoritmo Newton + return mapping; (5) **top88.m + 250-líneas** — diseño generativo implementable hoy.

> **Patrón transversal del fundador (operador 𝔄).** Casi todo aquí es un sistema lineal aumentado tipo KKT `[[A, Bᵀ],[B, 0]]·[x; λ] = [f; g]`: rigidez+restricción (ensamble), rigidez+contacto, masa+restricción modal, conductividad+capacidad térmica. Identificar la simetría/estructura de bloque ANTES de codear el solver paga doble.

---

## 1. Modelado avanzado de sólidos (loft, sweep, rib, draft, patrones, ecuaciones de diseño)

**Lo avanzado.** No es el botón "loft", es DOMINAR las superficies de transición y sus restricciones de continuidad, y luego parametrizarlas. Cuatro saltos:
- **Loft/Boundary**: control fino por curvas guía/rails + centerline + restricciones de extremo G0/G1/G2 (normal-to-profile, tangency, curvature). SolidWorks distingue Loft (1 dir perfil + 1 guía) de **Boundary Surface** (Dir1/Dir2 simétricos → clase-A). Matemáticamente es **skinning de NURBS**: hacer las curvas-sección compatibles (mismo grado, knot vector común) y luego interpolar transversalmente.
- **Sweep**: el problema central es el **marco móvil**. Frenet falla en inflexiones (κ=0 → la binormal salta). CAD serio usa **Rotation-Minimizing Frame (RMF)**.
- **Rib/Draft**: rib = offset 2D de croquis abierto extruido hasta la cara siguiente + booleana. Draft = ángulo cónico respecto a la dirección de extracción; lo CAE es **detección de undercuts** por signo de `n·d`.
- **Patrones/Espejo/Ecuaciones**: transformaciones afines + re-booleana; el modelo paramétrico es un **DAG de variables** resuelto en orden topológico.

**Matemática real.**
- Base B-spline (Cox-de Boor): `N_{i,0}=1 si u∈[u_i,u_{i+1})`; `N_{i,p}(u) = (u−u_i)/(u_{i+p}−u_i)·N_{i,p-1} + (u_{i+p+1}−u)/(u_{i+p+1}−u_{i+1})·N_{i+1,p-1}`.
- Superficie producto-tensorial: `S(u,v)=Σ_i Σ_j N_{i,p}(u) N_{j,q}(v) P_{i,j}`.
- Continuidad en uniones: G1 ⇔ `S_u⁻ = α S_u⁺ (α>0)`; G2 ⇔ continuidad del vector de curvatura. Las Start/End Constraints fijan la 1ª/2ª fila de puntos de control.
- Sweep como `S(u,v) = C(u) + R(u)·p(v)`, `R(u)∈SO(3)`. **RMF por double reflection** (Wang et al.): `r' = −(r·T')T`, O(n), error O(h⁴).
- Patrones: lineal `P_n = P_0 + n·Δ`; circular Rodrigues `R = I + sinθ[a]_× + (1−cosθ)[a]_×²`; espejo Householder `I − 2 m mᵀ` (invierte orientación → flip de normales).
- Draft/undercut: cara desmoldable si `n·d ≥ 0`; undercut cuando el signo se invierte.

**Qué leer.** MIT 2.158 Lecture 6 (NURBS, de Boor, Boehm) **[P0]**; Wang et al. RMF double-reflection **[P0]**; OCCT Modeling Algorithms (ThruSections/MakePipe/DraftAngle, implementación) **[P0]**; FreeCAD Manual (flujo humano sketch→pad→pattern) **[P0]**; SCIRP draft-angle (undercuts n·d) [P2].

---

## 2. Superficies y NURBS (boundary, knit, continuidad G0/G1/G2, T-Splines)

**Lo avanzado.** Forma libre controlada por continuidad y por la calidad intrínseca de la superficie. Tres bloques: (1) construcción por curvas (loft, **boundary surface** = loft bidireccional U-V que controla continuidad en los 4 lados, fill/patch tipo Coons, network/Gordon); (2) continuidad **geométrica** G0/G1/G2/G3 (independiente de la parametrización, distinta de C0/C1/C2) verificada con **cebra/curvatura/reflexión**; (3) **knit/sew** (coser superficies con tolerancia) + thicken. La frontera son las **T-Splines** (T-junctions + refinamiento LOCAL sin propagar filas, lo que el tensor-product NURBS no puede) y su uso en **Isogeometric Analysis** (misma base para geometría y FEA).

**Matemática real.**
- NURBS racional: `S(u,v) = [Σ N_i N_j w_{ij} P_{ij}] / [Σ N_i N_j w_{ij}]`. Trabajar con puntos homogéneos `P^w=(wx,wy,wz,w)` en R⁴ y dividir por la 4ª coord.
- **Cónicas exactas**: B-splines polinómicas NO dan círculos; NURBS sí. Arco como NURBS grado 2 con peso central `w=cos(Δθ/2)` (cuarto de círculo: `w=√2/2`).
- 1ª/2ª forma fundamental: `E=S_u·S_u, F=S_u·S_v, G=S_v·S_v`; `L=S_uu·n, M=S_uv·n, N=S_vv·n`. Gaussiana `K=(LN−M²)/(EG−F²)`, media `H=(EN−2FM+GL)/(2(EG−F²))`. G2 ⇔ K y direcciones principales coinciden en la costura.
- Inserción de nudos (Boehm): `Q_i = α_i P_i + (1−α_i)P_{i−1}`, `α_i=(ū−u_i)/(u_{i+p}−u_i)`. Base de h-refinement.
- Parche de Coons (bilineal): `S = (1−v)c1+v·c2 + (1−u)d1+u·d2 − [esquinas bilineales]`; con Hermite para G1.
- Surface filling por energía de flexión: minimizar `∫∫(S_uu²+2S_uv²+S_vv²)du dv` sujeto a restricciones de borde G0/G1/G2 (Euler-Lagrange → sistema lineal sobre los puntos de control).
- T-splines: cada arista lleva un **knot interval** local; el vector de nudos de un control point se INFIERE recorriendo la malla. "Analysis-suitable" garantizan partición de la unidad e independencia lineal.

**Qué leer.** Hughes et al. IGA 2005 (base NURBS = base FEA, refinamiento h/p/k) **[P1]**; Sederberg T-splines & T-NURCCs **[P1]**; Sederberg CAGD course notes (~290 pp, libre) **[P1]**; FreeCAD Surface Filling (G1/G2 con TolAngular/TolCurvature) [P2].

---

## 3. Chapa metálica (bridas, desdoblado/flat pattern, factor K, springback)

**Lo avanzado.** Tres capas. (1) **Desarrollo preciso**: dónde queda el eje neutro en el doblez, reducido a tres métodos intercambiables (factor K, Bend Allowance, Bend Deduction); lo serio es saber CUÁNDO falla el K constante y pasar a **tablas de doblez calibradas con probetas** o a ecuaciones por rango de ángulo. Normas: DIN 6935 (modela adelgazamiento ~20% y radio mínimo ≈4r) vs ANSI (convención del K). (2) **DFM/alivios**: bend/corner relief, hems, unfold temporal vs flat pattern derivado. (3) **Springback por FE** (la frontera premium): plasticidad anisótropa de laminado + return mapping.

**Matemática real.**
- Factor K: `K = δ/T` (δ = cara interior al eje neutro). Radio neutro `R_n = R_i + K·T`.
- Bend Allowance: `BA = θ_rad·(R_i + K·T)`. K despejado de un BA medido: `K = (180·BA)/(π·θ·T) − R_i/T`.
- Bend Deduction: `BD = 2·OSSB − BA`, `OSSB = tan(θ/2)·(R_i+T)`. Plano: `L_flat = (a+b) − BD`.
- Desarrollo total: `L_flat = Σ(rectas) + Σ BA_i`.
- DIN 6935: `L = a + b + ν`, factor de corrección k según r:s.
- Springback (viga elastoplástica): `R_i/R_f = 4(R_iσ_y/ET)³ − 3(R_iσ_y/ET) + 1`. Se compensa por overbending/bottoming.
- Fibra exterior (radio mínimo): `ε = ln(1 + T/(2R_i))`.
- FE de conformado: plasticidad J2 + **Hill'48** (`2f = F(σyy−σzz)²+...+2Nτxy²=1`, calibrado con Lankford r0/r45/r90) + **return mapping** + endurecimiento mixto **Armstrong-Frederick** (`α̇ = C·ε̇^p − γ·α·ε̄̇^p`) para Bauschinger.

**Qué leer.** KETIV Sheet Metal Unfold Rule Equations (BA/BD/K exactos de Inventor) **[P1]**; Code_Aster R5.03.02 (return mapping para springback) **[P0]**; Utah J2 plasticity tutorial [P2]; DB Sheetmetals K-factors (tablas, ANSI/DIN) [P2]; NPTEL Lecture 27 (springback) [P2].

---

## 4. Ensamblajes y restricciones (mates/joints, DOF, contactos, motion study)

**Lo avanzado.** (1) **DOF como álgebra**: cada cuerpo libre tiene 6 DOF; un mate son ecuaciones que los retiran. Contar movilidad con **Chebychev–Grübler–Kutzbach**. El tema profundo es la **sobre-restricción** (redundancias): mates que retiran el mismo DOF dos veces → el mecanismo es indeterminado y el solver no puede repartir reacciones. Onshape lo resuelve con **Mate Connectors** (sistemas de coord locales). (2) **Contacto = complementariedad** (Signorini/KKT) + fricción de Coulomb. (3) **Interferencia = geometría computacional** (BVH/AABB, SAT, GJK). (4) **Motion study en escalera**: cinemática → basic motion → dinámica DAE.

**Matemática real.**
- Restricciones holonómicas `Φ(q,t)=0`, Jacobiano `Φ_q=∂Φ/∂q`. Velocidad: `Φ_q·q̇ = ν`. **DOF = n − rank(Φ_q)**; rango deficiente = redundancia.
- Movilidad espacial: `M = 6(L−1) − Σ(6−f_i)`. Plana: `M = 3(n−1) − 2J1 − J2`.
- Dinámica DAE índice-3: `M(q)·q̈ + Φ_qᵀ·λ = Q`, sujeto a `Φ=0`. λ = reacciones.
- Sistema KKT aumentado: `[[M, Φ_qᵀ],[Φ_q, 0]]·[q̈; λ] = [Q; γ]`. **Invertible sii Φ_q tiene rango fila completo** → por eso la redundancia rompe el reparto de fuerzas.
- Estabilización de Baumgarte: `Φ̈ + 2α·Φ̇ + β²·Φ = 0`.
- Contacto Signorini: `g_N≥0, p_N≥0, p_N·g_N=0`. Penalización `p_N=ε_N·⟨−g_N⟩`; Lagrangiano aumentado (Uzawa) `p_N=⟨λ_k+ε_N·g_N⟩`.
- Coulomb: `‖t_T‖≤μ·p_N`; deslizamiento `t_T=−μp_N·(ġ_T/‖ġ_T‖)`.
- Colisión: broad-phase BVH; narrow-phase **SAT** (15 ejes para 2 OBB) / **GJK** (función soporte sobre Minkowski A⊖B).

**Qué leer.** TU Delft Multibody Dynamics (DAE, Jacobiano, Lagrange) **[P1]**; Code_Aster U2.04.04 contacto (Lagrange vs penalty vs aug-Lagrangiano) **[P1]**; CalculiX manual (MPC, coupling cinemático/distributing) **[P0]**; Featherstone Dynamics handbook (RNEA/ABA/CRBA O(n)) [P2].

---

## 5. FEA estructural estático lineal (K·u=f, elementos, von Mises, FOS, convergencia h/p)

**Lo avanzado.** Más allá de "lee von Mises": (1) **formulación variacional** (forma débil de Galerkin / energía potencial), no ensamble por intuición; (2) **elementos isoparamétricos** (misma N para geometría y campo, cuadratura de Gauss, Jacobiano) — y sus patologías (**locking** por cortante/volumétrico, **hourglass** por integración reducida) y curas (B-bar, modos incompatibles, u/p); (3) **convergencia** a priori (`‖e‖≤Ch^p`) vs a posteriori (estimador ZZ); (4) **singularidades**: en esquinas reentrantes σ→∞ y NO converge — error clásico de principiante; (5) **verificación con benchmarks NAFEMS**.

**Matemática real.**
- Forma fuerte: `∇·σ + b = 0`, `σ=D:ε`, `ε=½(∇u+∇uᵀ)`.
- Energía potencial: `Π(u)=½∫εᵀDε − ∫uᵀb − ∫_Γt uᵀt̄`. Discretizar `u≈N·d`, `ε=B·d`.
- **`K_e = ∫_Ωe Bᵀ D B dV`**, ensamble `K = A_e K_e`. Sistema `K·u=f`.
- D isótropo lleva factor `1/(1−2ν)` → revela el volumetric locking en `ν→0.5`.
- Isoparamétrico: `x=Σ N_i x_i`, `J=∂x/∂ξ`, `∂N/∂x=J⁻¹∂N/∂ξ`, `dV=det(J)dξdηdζ`.
- Gauss: `K_e ≈ Σ_g w_g Bᵀ(ξ_g)D B(ξ_g) det(J(ξ_g))`. n puntos → exacto grado 2n−1.
- **von Mises**: `σ_vM=√(3J₂)=√(½[(σ1−σ2)²+(σ2−σ3)²+(σ3−σ1)²])`. **FOS = Sy/σ_vM** (solo válido en elasticidad).
- Convergencia: `‖u−u_h‖_E ≤ C h^p`; en singularidad `r^λ (λ<1)` → tasa cae a `h^λ`, σ puntual no converge.
- Estimador ZZ: `η_e² = ∫_Ωe (σ*−σ_h)ᵀ D⁻¹ (σ*−σ_h) dV`, refinar donde η alto.

**Qué leer.** Felippa IFEM Book completo (rigidez directo + variacional + isoparamétrico) **[P0]**; CalculiX manual (elementos C3D*, von Mises) **[P0]**; Code_Aster R3.01.01 (funciones de forma + Gauss) [P1]; IFEM Ch.17 quads [P1]; ESRD NAFEMS benchmarks (validar el solver) [P2]; Babuška-Suri convergencia [P2].

---

## 6. Análisis Modal / Vibraciones (GEP K·φ=ω²M·φ, modos, respuesta, amortiguamiento)

**Lo avanzado.** (1) **El eigenproblema a escala**: NO se factoriza la matriz completa, se usan subespacios de Krylov (Block Lanczos, IRAM/Sorensen, shift-and-invert para apuntar a una banda). (2) **Verificar modos** con **test de Sturm** (cuenta de pivotes negativos). (3) **Masa modal efectiva**: truncar capturando ≥80-90% de la masa total (regla aeroespacial). (4) **Amortiguamiento**: proporcional (Rayleigh, desacopla) vs no-proporcional → **problema cuadrático (QEP)** con modos complejos. (5) **Respuesta forzada**: armónica completa vs superposición modal; transitoria Newmark/HHT-α. (6) **Gran escala**: pre-tensado, Craig-Bampton, simetría cíclica.

**Matemática real.**
- GEP: `K·φ_i = ω_i²·M·φ_i`. Característica: `det(K − ω²M)=0`.
- Ortogonalidad: `φ_iᵀMφ_j=0, φ_iᵀKφ_j=0 (i≠j)`. Mass-normalized: `φ_iᵀMφ_i=1 ⇒ φ_iᵀKφ_i=ω_i²`. Desacopla en N osciladores SDOF.
- Participación `Γ_i = φ_iᵀMr / (φ_iᵀMφ_i)`; masa efectiva `m_eff,i = Γ_i²·m_i`; `Σ m_eff,i = masa total`.
- Shift-invert: resolver `(K−σM)⁻¹M·φ = μ·φ`, `μ=1/(λ−σ)` → modos cerca de σ se vuelven dominantes.
- Sturm: nº de modos < σ = nº de pivotes negativos en `LDLᵀ(K−σM)`.
- QEP amortiguado: `(λ²M+λC+K)φ=0`. Linealización a estado 2n; `λ=−ζω±iω√(1−ζ²)` (modos complejos).
- Rayleigh: `C=αM+βK ⇒ ζ_i=α/(2ω_i)+βω_i/2`.
- SDOF modal: `q̈_i + 2ζ_iω_i q̇_i + ω_i² q_i = Q_i`.
- Armónica completa: `[−ω²M+iωC+K]·û = F̂`. Modal: `q̂_j=Q̂_j/(ω_j²−ω²+2iζ_jω_jω)` (resonancia en ω→ω_j).
- Newmark (γ=½,β=¼) incondicionalmente estable; HHT-α añade disipación numérica.
- Pandeo hermano: `([K]+λ[S])φ=0` (S = rigidez geométrica).

**Qué leer.** Code_Aster R5.01.01 (taxonomía COMPLETA de solvers modales + Sturm + shift-invert) **[P0]**; CalculiX manual (*FREQUENCY, GEP no condensado) **[P0]**; Irvine Modal Mass (truncación 80-90%) [P1]; Code_Aster curso 01-modal-analysis [P1].

---

## 7. Análisis térmico CAE (conducción/convección/radiación, transitorio, termo-estructural)

**Lo avanzado.** (1) **No-linealidad** es la regla: `k(T)`, radiación `T⁴` (Newton-Raphson obligatorio), **cambio de fase** vía entalpía `H(T)`. (2) **Transitorio bien hecho**: theta-method con estabilidad/precisión y dt crítico ligado a `α=k/(ρCp)`. (3) **Radiación geométrica**: factores de vista + radiosidad de cavidad gris difusa. (4) **CHT**: acoplar conducción sólido + convección REAL del fluido (Navier-Stokes), no un h "a mano". (5) **Termo-estructural**: secuencial (T→carga térmica) o directo (matriz monolítica). (6) **Contacto térmico** (TCC).

**Matemática real.**
- Balance: `ρCp·∂T/∂t = −div(q) + s`. Fourier: `q = −k·∇T`. Estable: `div(k∇T)+s=0`. Difusividad `α=k/(ρCp)`, Fourier `Fo=αt/L²`.
- BC: Dirichlet `T=T_imp`; Neumann `−k∂T/∂n=q_imp`; Robin/convección `−k∂T/∂n=h(T−T∞)`; radiación `−k∂T/∂n=εσ(T⁴−T_amb⁴)`, `σ=5.67e-8`.
- Semi-discreto: `[C]·{Ṫ} + [K]·{T} = {F}`, `[C]_ij=∫ρCp N_iN_j`, `[K]_ij=∫k∇N_i·∇N_j + ∫_Γc h N_iN_j`.
- **Theta-method**: `([C]/Δt + θ[K])T_{n+1} = ([C]/Δt − (1−θ)[K])T_n + θF_{n+1} + (1−θ)F_n`. θ=0 explícito (`Δt≤2/λ_max`), θ=1 implícito (incond. estable), θ=½ Crank-Nicolson (2º orden).
- Radiación NR: jacobiano `∂R_rad/∂T = 4εσT³`.
- Cambio de fase: `H(T)=∫ρCp dT + ρL·f_liq(T)`, resolver `ρ∂H/∂t=div(k∇T)+s`.
- Factor de vista `F_{i→j}=(1/A_i)∫∫(cosθ_i cosθ_j)/(πr²)dA`, reciprocidad `A_iF_{ij}=A_jF_{ji}`. Radiosidad `J_i=ε_iσT_i⁴+(1−ε_i)Σ_j F_{ij}J_j`.
- Termo-estructural: `ε_th=α(T−T_ref)I`, `σ=D:(ε−ε_th)`. Secuencial: `F_th=∫BᵀD·ε_th dΩ`.

**Qué leer.** Code_Aster R5.02.01 (deriva ecuación del calor + theta-method, rigor puro) **[P0]**; CalculiX manual (*HEAT TRANSFER/*FILM/*RADIATE, termomecánico) **[P0]**; Howell catálogo de factores de vista (>300 geometrías) [P1]; Chalmers CHT/chtMultiRegionFoam [P1]; Ansys APDL Thermal (radiosity, fase, coupled-field) [P2].

---

## 8. FEA no-lineal (grandes deformaciones, contacto, plasticidad, hiperelasticidad, Newton-Raphson)

**Lo avanzado.** Todo se vuelve incremental y dependiente del estado. Tres no-linealidades: **geométrica** (cinemática finita F, TL/UL), **material** (plasticidad J2/Tresca, endurecimiento Chaboche, hiperelasticidad Mooney-Rivlin/Ogden) y **contacto** (Signorini+Coulomb). Hilo conductor: **Newton-Raphson** con **matriz tangente consistente** (no continua) + control de paso (**arc-length/Riks** para snap-through). Para plasticidad el corazón es el **return mapping**. Para casi-incompresibilidad: formulaciones **mixtas u/p**.

**Matemática real.**
- Cinemática: `F=∂x/∂X=I+∂u/∂X`, `J=det F>0`, `C=FᵀF`, Green-Lagrange `E=½(FᵀF−I)`.
- Tensiones conjugadas: Cauchy σ; PK1 `P=J σ F⁻ᵀ`; PK2 `S=JF⁻¹σF⁻ᵀ` (conjugado de E).
- PTV: `∫_V S:δE dV = ∫b·δu + ∫t·δu`. Residuo `R(u)=F_int(u)−F_ext=0`.
- **Newton**: `K_T Δu = −R(u)`, `K_T = ∫BᵀDB + ∫Gᵀ[S]G` (material + geométrica). El 2º término es lo que distingue del lineal.
- Convergencia: fuerza `‖R‖/‖F_ext‖<tol`, desplazamiento, energía `R·Δu<tol`.
- von Mises J2: `f=√(3J2)−σ_y`, flujo `ε̇^p=λ̇·(3/2)(s/σ_vM)`, KKT `λ̇≥0, f≤0, λ̇f=0`.
- Endurecimiento: isótropo `σ_y=σ_y0+H·ε_p`; cinemático (back-stress α); **Chaboche** `α̇_i=(2/3)C_iε̇^p − γ_iα_i ṗ`.
- **Return mapping** (radial return): predictor `σ^tr`; corrector escalar `f(Δγ)=σ_vM^tr − 3G·Δγ − σ_y=0`; actualización `s_{n+1}=s^tr(1−3GΔγ/σ_vM^tr)`.
- **Tangente consistente** (Simo-Taylor): `D^alg=∂Δσ/∂Δε` tras el return mapping; usar el continuo arruina la convergencia cuadrática.
- Hiperelasticidad: `S=2∂W/∂C`. Neo-Hooke `W=C10(Ī1−3)`; Mooney-Rivlin `W=C10(Ī1−3)+C01(Ī2−3)+(1/D1)(J−1)²`; Ogden en estiramientos principales. Split isocórico `Ī=J^{−2/3}I`.
- Plasticidad finita: descomposición de Lee `F=F_e·F_p`, deformación logarítmica de Hencky.
- Arc-length (Riks): `ΔuᵀΔu + ψ²Δλ²qᵀq = Δl²` para pasar puntos límite donde K_T es singular.

**Qué leer.** Code_Aster R5.03.01 (algoritmo Newton + line-search + convergencia) **[P0]**; Code_Aster R5.03.02 (return mapping + tangente consistente) **[P0]**; CalculiX manual (*PLASTIC/*HYPERELASTIC/*CONTACT) **[P0]**; MIT 2.092 Lec.10 Bathe (TL/UL) [P1]; deal.II step-44 (u/p tres campos) [P1].

---

## 9. Fatiga y durabilidad (S-N, ε-N, Goodman/Gerber/Soderberg, Miner, Kt/Kf)

**Lo avanzado.** Cuatro saltos de rigor: (1) de **S-N nominal** (HCF elástico) a **ε-N local** (Coffin-Manson + Ramberg-Osgood cíclico + Neuber para LCF en la raíz del concentrador); (2) **carga real**: conteo **rainflow** + daño acumulado **Miner**; (3) **tensión media**: Goodman/Gerber/Soderberg (S-N), Morrow/SWT (ε-N); (4) **multiaxial**: planos críticos (Dang Van, Crossland, Fatemi-Socie) + Kf con sensibilidad a la entalla + factores de Marin + Paris-Erdogan para propagación.

**Matemática real.**
- Basquin: `σ_a = σ_f'·(2N_f)^b`.
- Límite corregido (Marin): `S_e = ka·kb·kc·kd·ke·S_e'`, `S_e'≈0.5 S_ut`.
- Coffin-Manson-Basquin: `Δε/2 = (σ_f'/E)(2N_f)^b + ε_f'(2N_f)^c`.
- Ramberg-Osgood cíclico: `ε_a = σ_a/E + (σ_a/K')^{1/n'}`.
- Neuber: `(K_t·S)²/E = σ·ε` (resuelto con R-O).
- Goodman `σ_a/S_e + σ_m/S_ut = 1`; Gerber `σ_a/S_e + (σ_m/S_ut)² = 1`; Soderberg `σ_a/S_e + σ_m/S_y = 1`.
- SWT: `σ_max·ε_a = (σ_f'²/E)(2N_f)^{2b} + σ_f'ε_f'(2N_f)^{b+c}`.
- **Miner**: `D = Σ(n_i/N_i)`, falla `D≥1`.
- Kf, sensibilidad `q=(Kf−1)/(Kt−1)`; Peterson `q=1/(1+a/r)`.
- Multiaxial Crossland `√J2,a + α·σ_H,max ≤ β`; Dang Van `max[τ(t)+a·σ_H(t)] ≤ b`.
- Paris-Erdogan `da/dN = C(ΔK)^m`, vida `N=∫_{a0}^{af} da/[C(ΔK)^m]`.

**Qué leer.** fe-safe Fatigue Theory Vol.2 (referencia completa, gratis) **[P0]**; Code_Aster R7.04.04 (multiaxial Dang Van/Crossland) [P1]; Irvine Miner+rainflow [P1]; MIT 3.35 total-life + crack growth [P2].

---

## 10. CFD / fluidos (Navier-Stokes, volumen finito, turbulencia, CHT)

**Lo avanzado.** (1) **FVM** sobre mallas no estructuradas/poliédricas con esquemas de alto orden (upwind, QUICK, TVD/limitadores) + correcciones de no-ortogonalidad. (2) **Acoplamiento presión-velocidad**: SIMPLE/PISO/PIMPLE + **interpolación Rhie-Chow** (mata el checkerboard en mallas co-localizadas). (3) **Turbulencia**: jerarquía RANS (Spalart-Allmaras → k-ε → k-ω → **k-ω SST de Menter** con F1/F2) → LES → híbridos DES. Tratamiento de pared (wall functions vs low-Re, control de y+). (4) **CHT** multi-región. (5) **Mallado**: capas de prisma + métricas de calidad que dominan la estabilidad.

**Matemática real.**
- Incompresible: `div(u)=0`; `ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u + f`.
- Transporte FVM (Gauss): `Σ_f F_f = Σ_f (ρ_f u_f·S_f)φ_f − Σ_f (Γ_f ∇φ|_f·S_f)`.
- Boussinesq: `−ρ⟨u'_iu'_j⟩ = μ_t(∂U_i/∂x_j+∂U_j/∂x_i) − (2/3)ρk δ_ij`.
- k-ε: `μ_t=C_μ k²/ε`, `C_μ=0.09, C1=1.44, C2=1.92`.
- **k-ω SST**: `ν_t = a1·k/max(a1·ω, S·F2)`, `a1=0.31`; difusión cruzada `2(1−F1)σ_w2(1/ω)∇k·∇ω`; `F1=tanh(arg1⁴)`, `F2=tanh(arg2²)` cambian de k-ω (pared) a k-ε (lejos).
- SIMPLE: Poisson de corrección `a_P p' = Σ a_nb p'_nb + b'`, `b'=−Σ_f(ρu*·S)_f`, sub-relajación α_u, α_p. PISO añade correctores; PIMPLE = PISO+SIMPLE por paso.
- CHT interfaz: `T_f=T_s` y `k_f(∂T/∂n)_f = k_s(∂T/∂n)_s`; acoplamiento Dirichlet-Neumann iterado.
- Adimensionales: `Re`, `Pr`, `CFL=u·dt/dx<1`, `y+ ~1` (low-Re) o 30-300 (wall functions).

**Qué leer.** code_saturne 9.0 Theory Guide (rigor matemático completo) **[P0]**; NASA TMR SST page (ecuaciones canónicas) **[P0]**; CFD Direct General Principles (libro abierto legible) [P1]; Chalmers CHT [P1].

---

## 11. Pandeo + Optimización topológica / diseño generativo

**Lo avanzado.** **Pandeo**: (1) lineal por eigenvalores `[K+λKσ]φ=0` (barato pero SOBREESTIMA la carga ideal); (2) no-lineal/post-pandeo con arc-length para snap-through + sensibilidad a imperfecciones (sembrar el modo lineal escalado); (3) distinguir bifurcación (perfecta) de punto-límite (real). **Topología**: (1) **SIMP** (pseudo-densidad penalizada, min compliance); (2) patologías (checkerboard, dependencia de malla) → filtros + proyección Heaviside; (3) Level-Set / ESO; (4) **restricciones de manufactura** (overhang, escala mínima) — lo que separa generativo industrial de TO académica; (5) **TO con restricción de pandeo** (santo grial): sensibilidad de eigenvalores + agregación KS.

**Matemática real.**
- Pandeo: `[K + λ·Kσ]·φ = 0`, `Kσ=∫Gᵀ·S·G`. Menor `λ1 = BLF`, `P_cr=λ1·P_aplicada`.
- Euler (verificación): `P_cr=π²EI/(KL)²`, `σ_cr=π²E/(L/r)²`.
- Arc-length: `‖Δu‖²+ψ²Δλ²‖F_ext‖²=Δl²` para ramas con `dλ/ds<0`.
- **SIMP**: `min_ρ c(ρ)=Σ ρ_e^p u_eᵀk0u_e` s.a. `K(ρ)U=F`, `V(ρ)/V0=f`. `E_e(ρ_e)=E_min+ρ_e^p(E_0−E_min)`, p≈3.
- Sensibilidad: `∂c/∂ρ_e=−p ρ_e^{p−1} u_eᵀk0u_e ≤ 0`. OC: `ρ_e^new=clamp(ρ_e·B_e^η)`, `B_e=(−∂c/∂ρ_e)/(λ∂V/∂ρ_e)`.
- Filtro sensibilidad (Sigmund): `∂̂c/∂ρ_e = 1/(ρ_e ΣH_ei)·Σ_i H_ei ρ_i ∂c/∂ρ_i`, `H_ei=max(0, r_min−dist)`.
- Proyección Heaviside: `ρ̄=(tanh(βη)+tanh(β(ρ̃−η)))/(tanh(βη)+tanh(β(1−η)))`.
- Level-set: `Ω={x:φ(x)≥0}`, `∂φ/∂t + V·|∇φ|=0`, derivada topológica para crear huecos.
- TO+pandeo: sensibilidad `∂λ_i/∂ρ_e = φ_iᵀ(∂K/∂ρ_e + λ_i ∂Kσ/∂ρ_e)φ_i`; modos múltiples → **Kreisselmeier-Steinhauser** `μ_KS=μ_1+(1/P)ln Σ exp(P(μ_i−μ_1))` (C¹, aproxima el máx).

**Qué leer.** top88.m (SIMP+OC+filtros, código completo) **[P0]**; Ferrari-Sigmund-Guest 250-líneas (TO+pandeo, Kσ vectorizado, KS) **[P0]**; arXiv 2204.07333 (overhang/escala AM) [P2]; MIT 2.080 Lec.9 (Euler) [P2]; CalculiX *BUCKLE [P0 vía manual].

---

## 12. Dinámica multicuerpo + Manufactura (CAM, Moldflow, GD&T)

**Lo avanzado.** **MBD**: DAE índice-3 con multiplicadores de Lagrange + integradores rígidos (GSTIFF/BDF) + detección de redundancias + algoritmos O(n) de robótica + cuerpos flexibles (Craig-Bampton). **CAM**: trayectorias 3-5 ejes (scallop/cusp, trochoidal por engagement constante) + post-procesador (cinemática inversa de la máquina) + simulación de remoción. **Moldflow**: fill/pack/cool/warp de fluido no-newtoniano en cavidad delgada (Hele-Shaw 2.5D o 3D) con **Cross-WLF** + PVT + alabeo. **GD&T**: definición matemática (ASME Y14.5.1) de zonas de tolerancia + MMC/LMC + stack-up worst-case/RSS/Monte Carlo.

**Matemática real.**
- MBD: `M(q)q̈ + Φ_qᵀλ = Q`, `Φ=0`. Aumentado: `[[M,Φ_qᵀ],[Φ_q,0]][q̈;λ]=[Q;γ]`.
- Newton-Euler: `F=m·a_cm`, `M_cm=I_cm ω̇ + ω×(I_cm ω)`.
- Featherstone espacial: `f=I·a + v×*(I·v)`; ABA es O(n).
- Flujo de molde: `∇·v=0`; `ρ(∂v/∂t+v·∇v)=−∇p+∇·(η(γ̇,T,p)(∇v+∇vᵀ))`; energía con `η·γ̇²`.
- Hele-Shaw 2.5D: `∇·(S·∇p)=0`, fluidez `S=∫_0^{h/2}(z²/η)dz`.
- **Cross-WLF**: `η = η₀/[1+(η₀γ̇/τ*)^{1−n}]`, `η₀=D1·exp[−A1(T−T*)/(A2+(T−T*))]`.
- PVT Tait dos dominios: `v(T,p)=v0(T)[1−C·ln(1+p/B(T))]+vt`.
- Alabeo: problema termo-estructural con `ε_shrink` anisótropo → `K·u=f_residual`.
- CAM scallop: altura `h≈s²/(8R)` (R radio fresa, s stepover).
- GD&T posición (Y14.5.1): eje dentro de cilindro `Ø=t` en true position; MMC bonifica `t_total=t+|size−MMC|`.
- Stack-up: worst-case `T=Σ|∂f/∂x_i|t_i`; RSS `T=√(Σ(∂f/∂x_i·t_i)²)`.

**Qué leer.** TU Delft MBD (DAE/Lagrange) **[P1]**; NIST RS274NGC (G-code canónico, base LinuxCNC) [P1]; Moldflow Cross-WLF help [P1]; FreeCAD CAM postprocessor [referencia]; Mitutoyo ASME Y14.5-2018 (GD&T) [P2]; Featherstone (MBD O(n)) [P2].

---

## Recomendación de construcción para La Forja

1. **Backend FE de referencia = CalculiX.** Un solo binario abierto cubre estático/no-lineal/modal/térmico/contacto/pandeo. Usa su manual como contrato de capacidades y sus benchmarks NAFEMS para el gate de verificación (compila ≠ funciona).
2. **Geometría = NURBS desde el día 1** (no mallas). MIT 2.158 + Sederberg + OCCT son el núcleo. El sketcher 2D con solver de restricciones (Newton-Raphson sobre el residuo geométrico, DOF = 2·puntos − restricciones) es el flujo humano que falta — alineado con la memoria CAD-flujo-humano.
3. **Orden de los módulos CAE por ROI**: estático lineal (Felippa) → modal (Code_Aster R5.01.01) → térmico (R5.02.01) → no-lineal/contacto (R5.03.01/02) → fatiga (fe-safe) → CFD (code_saturne) → generativo con pandeo (top88 + 250-líneas).
4. **Diferenciador premium**: TO con restricción de pandeo (Ferrari-Sigmund-Guest) + springback por FE en chapa + draft analysis por `n·d`. Eso es lo que Fusion básico NO hace bien.
5. **Regla dura del proyecto**: cada ecuación de este digesto sale de una fuente citada. Implementar la fórmula real, etiquetar lo evocativo, validar contra benchmark. El wow emerge de la corrección.