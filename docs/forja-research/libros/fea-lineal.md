# FEA LINEAL + NAFEMS — el libro como cliente

**Fuentes:** Felippa IFEM (P0_05, cap 17 P1_18) · CalculiX v2.22 (P0_00) · Code_Aster R3.01.01 (P1_17) · NAFEMS/ESRD LE1-LE11 (P2_35) · Babuška-Szabó (P2_36) · digestos previos pliego-fea.md, pliego-moldflow-nafems.md, simulacion-avanzada.md

**Fecha:** 2026-08-27 · **Dominio:** FEA estructural lineal + verificación


## El autor como cliente

Felippa (el teórico que exige patch test, rango y jacobiano), Dhondt (el que escribió CalculiX y manda "elementos CUADRÁTICOS, versión lineal primero, ΣRF exacto no prueba la malla"), EDF/Code_Aster (tablas de Gauss con suma de pesos = volumen de referencia), NAFEMS/ESRD (el juez: <3 % contra el valor de referencia y discretización <1 %, target nombrado ANTES de resolver) y Babuška (la pendiente de convergencia mide la suavidad de la solución, no tu malla). Contratan a La Forja para que su FEA de un clic deje de ser un heatmap: reacciones, energía, patch test, hexaedros sobre el voxel, GCI con veredicto y CI contra NAFEMS.


## Capítulos (fuentes) y cobertura

| # | Fuente/capítulo | Ejercicios | Forja | Nota |
|---|---|---|---|---|
| 1 | Felippa IFEM cap 2-3 — método directo de rigidez (armadura ejemplo, reacciones) | 4 | parcial | trussStiffness3D existe en src/lib/formulas.ts; sin ensamblador 1D ni recuperación de reacciones |
| 2 | Felippa IFEM cap 8 — modelado: malla, cargas (NbN/EbE), BC y simetría | 3 | parcial | fea.ts reparte carga por NÚMERO de nodos (no EbE) y solo empotra caras completas: no hay BC de simetría |
| 3 | Felippa IFEM cap 13 — elemento de viga Hermitiano + Gauss 1D | 2 | parcial | beamStiffnessEulerBernoulli/Timoshenko en formulas.ts; sin solve ni UI |
| 4 | Felippa IFEM cap 17 — cuadriláteros iso-P, shear locking cuantificado | 4 | parcial | lamina-vonmises.ts tiene Q4 2×2 en 2D (sección del molde); no hay Q4/hex en el FEA 3D |
| 5 | Felippa IFEM cap 19 — requisitos de convergencia: patch test, rango, jacobiano | 3 | parcial | patch test 2D en mold-vonmises-test.cjs; no hay patch test 3D ni gate K·r=0 |
| 6 | Felippa IFEM cap 23-24 — implementación Q4/Q5/Q9/T6 con valores de K impresos | 5 | no | ningún elemento iso-P de orden alto en el repo |
| 7 | CalculiX §4-5 — reglas de oro y ejemplos (cantilever C3D20R, pandeo por frecuencia, B32R, refinamiento) | 5 | parcial | cantilever verificado (fea-cantilever-verify.cjs 30 MPa); sin modal/pandeo/reacciones |
| 8 | CalculiX §6.2/6.12/6.13 — catálogo de elementos, estimador ZZ, esfuerzos en puntos de integración | 3 | parcial | vmElem y vmNodal existen; sin estimador de error ni selector de elemento |
| 9 | Code_Aster R3.01.01 — funciones de forma y puntos de Gauss por elemento | 3 | no | solo tet4 1 punto y Q4 2×2 hardcodeados; sin tablas ni gate de suma de pesos |
| 10 | NAFEMS LE1-LE11 — benchmarks lineales con valor de referencia | 9 | no | ningún benchmark NAFEMS corre en CI; pliego-moldflow-nafems.md los fichó con geometría |
| 11 | Babuška-Szabó — tasas de convergencia h/p y teorema inverso | 4 | parcial | verificacion/gci.ts hace Richardson+GCI+orden observado sobre el solver 2D; no está cableado al FEA 3D |

## Catálogo de ejercicios / benchmarks (45)

| id | cap | título | herramientas | oráculo | respuesta impresa | tipo | valor |
|---|---|---|---|---|---|---|---|
| fea-lineal-felippa-01 | 1 | Armadura ejemplo de 3 barras (DSM): desplazamientos y reacciones | ensamblador truss (trussStiffness3D) + solve + recuperar R=K·u | u_x3=0.4, u_y3=-0.2; reacciones f_x1=f_y1=-2, f_y2=1; equilibrio ΣF=0 y ΣM=0 (Ex 3.2) | IFEM §3.3-3.4 ec (3.24)-(3.26): u_x3=0.4, u_y3=-0.2; f_x1=f_y1=-2, f_y2=1 | suite | 4 |
| fea-lineal-felippa-02 | 1 | Fuerzas axiales de la armadura ejemplo (postproceso) | recuperación de fuerza interna p=EA/L·(u_j-u_i) proyectada | p(3)=2·sqrt(2) | IFEM Ex 3.3: p(3)=2√2 | suite | 3 |
| fea-lineal-felippa-03 | 1 | Soporte mal puesto: K reducida SINGULAR (mecanismo) | gate G1/V1 pivote cero + K·r=0 (modos de cuerpo rígido) | det(K_reducida)=0 con u_x2=0 en vez de u_y2=0; el solver DEBE abortar con mensaje "cuerpo rígido libre" | IFEM Ex 3.5: "the reduced stiffness matrix is singular" | suite | 4 |
| fea-lineal-felippa-04 | 1 | Arco-armadura de 2 barras (Ex 3.7): S=8, H=3, E=1000, A=2/4, P=12 | ensamblador truss + BC + reacciones | u_x2, u_y2 del sistema reducido; ΣR+P=0 <1e-10 |  | suite | 3 |
| fea-lineal-felippa-05 | 2 | Cargas nodales equivalentes NbN vs EbE para q lineal (Ex 8.3) | reparto de carga por área tributaria (EbE) — la que hoy NO hace fea.ts | f1=3q/8 (NbN); Σf_i = 6q en ambos esquemas | IFEM Ex 8.3: f1=3q/8 (NbN), Σ=6q | suite | 5 |
| fea-lineal-felippa-06 | 2 | Simetría/antisimetría: disco brasileño, placa con agujero, Flamant (Ex 8.4) | BC de simetría (plano: 1 DOF fijo, NO empotrar) + reducción a 1/4 | mismo σ_max en modelo completo vs 1/4 (<0.5 %); Kt=3.0 Kirsch en la placa con agujero central |  | suite | 5 |
| fea-lineal-felippa-07 | 2 | Relación de aspecto y zonas de refinamiento (Ex 8.1 + §8.2.2) | gate G3 (AR>3 advertir, >10 alarma) + mapa de "trouble spots" (esquinas entrantes, cargas puntuales) | todos los tets del voxel: AR=sqrt(3)=1.73 (pasa); lista de nodos con gradiente alto = esquinas entrantes | IFEM §8.2.2: AR>3 caution, >10 alarm | suite | 3 |
| fea-lineal-felippa-08 | 3 | Cantilever con UN elemento de viga Hermitiano (Ex 13.9) | elemento beam Euler-Bernoulli (beamStiffnessEulerBernoulli) + solve | v_j=PL^3/(3EI), θ_j=PL^2/(2EI) EXACTOS con 1 elemento (cúbica exacta) | IFEM Ex 13.9: v_j=PL³/(3EI), θ_j=PL²/(2EI) | suite | 4 |
| fea-lineal-felippa-09 | 3 | Reglas de Gauss 1D: 1, 2, 3 puntos exactas hasta grado 1, 3, 5 (Ex 13.6) | módulo de cuadratura + gate G19 (suma de pesos=2) | ∫ξ^k en [-1,1] exacto hasta k=2p-1; falla en k=2p | IFEM Ex 13.6: grados 1, 3, 5 | suite | 3 |
| fea-lineal-felippa-10 | 4 | Q4 rectangular: K idéntica para p=2,3,4 y 3 eigenvalores nulos; p=1 da 5 (Ex 17.1) | elemento Q4 iso-P + Gauss p×p + eigen(K) | rank(K)=5 para p≥2 (3 modos rígidos); p=1 → 5 ceros = 2 hourglass | IFEM Ex 17.1: three zero eigenvalues (p≥2), five (p=1) | suite | 4 |
| fea-lineal-felippa-11 | 4 | Shear locking cuantificado: razón de energía r(γ,ν) del Q4 en flexión pura (Ex 17.3) | Q4 en 1 capa bajo momento M; Ubeam=6M²/(Eha²γ³) | r = 2γ²(1-ν²)/(1+2γ²-ν); a=10b, ν=0 → r≈1/50 (2 % de la respuesta) | IFEM (E17.8): r=2γ²(1−ν²)/(1+2γ²−ν); a=10b,ν=0 → r≈1/50 | suite | 5 |
| fea-lineal-felippa-12 | 4 | Techo de una capa: r→1−ν² aunque a→0 (nota 10 de Ex 17.3) — gate "≥4 capas en flexión" | gate de capas a través del espesor menor | acero ν=0.3: r_max=0.91 con 1 capa; el gate exige ≥4 voxeles en la dimensión menor de cualquier cuerpo en flexión | IFEM Ex 17.3 nota 10: r→1−ν² | suite | 4 |
| fea-lineal-felippa-13 | 4 | Integración ponderada β que hace al Q4 x-bending exact (Ex 17.4) | K_β=(1−β)K_1x1+βK_2x2 | β=2γ²(1−ν²)/(1+2γ²−ν) ⇒ r≡1 | IFEM (E17.11) | teoria | 2 |
| fea-lineal-felippa-14 | 5 | PATCH TEST 3D (Irons): campo lineal u=a+B·x sobre parche de tets con nodo interior | gate G6: u interior exacto, σ constante, ΣR=0 | error nodos interiores <1e-10·|u|; (σ_max−σ_min)/σ <1e-10; ΣR<1e-10 |  | suite | 5 |
| fea-lineal-felippa-15 | 5 | Rango mínimo por regla de Gauss: n_E·n_G ≥ n_F − n_R para bricks n=8,20,27,64 (Ex 19.4) | gate G5 tabla elemento×regla | hex8: 1×1×1 → 6<18 (12 modos espurios), 2×2×2 → 48≥18 OK; hex20: 2×2×2 → 48<54 (6 espurios), 3×3×3 OK | IFEM Ex 19.4 vía (19.7) | suite | 3 |
| fea-lineal-felippa-16 | 5 | Nodo al cuarto de lado: J=0 (Ex 19.2 barra de 3 nodos, Ex 19.5 Q9) | gate G1 jacobiano en TODOS los puntos de Gauss + nodos | α=±1/4 anula J en el extremo; deformación axial → ∞ (singularidad de grieta) | IFEM Ex 19.2: α=±1/4 | suite | 3 |
| fea-lineal-felippa-17 | 6 | K del Q4 rectangular 2:1, E=96, ν=1/3, h=1 (§23.3.1) | elemento Q4 iso-P 2×2 Gauss | K(23.6) entrada por entrada (K11=42, K12=18, K22=78…); eigenvalores [223.64 90 78 46.3603 42 0 0 0]; 3×3 y 4×4 la reproducen EXACTA | IFEM (23.6)-(23.7) | suite | 5 |
| fea-lineal-felippa-18 | 6 | Q5 bilineal+burbuja: rango por regla, K22 (Ex 23.1) y "bubble futility" (Ex 23.3) | Q5 + condensación estática | K22=3380 (2×2) y 3588 (3×3); r(E23.1)=γ²(1+ν)(2+γ²(1−ν))/(1+γ²)² sigue lockeando con γ=1/10 | IFEM Ex 23.1: K22=3380/3588 | suite | 3 |
| fea-lineal-felippa-19 | 6 | Q9 biquadrático: 2×2 deja rango deficiente en 3; K11 (Ex 23.4) | elemento Q9 + Gauss 2×2/3×3 + eigen | K11=5395390 (2×2) y 6474468 (3×3); 2×2 → 3 modos espurios | IFEM Ex 23.4: K11=5395390 / 6474468, rank deficiency 3 | suite | 3 |
| fea-lineal-felippa-20 | 6 | Sensibilidad a distorsión: cantilever a=10, b=2, M=1 con 2 Q4 vs 2 Q9 (Ex 23.5-23.6) | malla distorsionada e=0,1,2,3,5; v_beam=Ma²/(2EI) | Q4: g(e)=r(e)/r(0)<1 decreciente; Q9 superparamétrico: r=1 para todo e<a/2 | IFEM Ex 23.6: r=1 for any e<a/2 | suite | 4 |
| fea-lineal-felippa-21 | 6 | T4 de transición (1 nodo lateral) con regla de 3 puntos, E=2880 (Ex 24.1) | triángulo iso-P + cuadratura triangular (suma pesos=1/2) | K11=1980, K18=1440; 8 eigenvalores con 3 ceros | IFEM Ex 24.1: K11=1980, K18=1440 | suite | 2 |
| fea-lineal-ccx-01 | 7 | Cantilever 1×1×8 m, F=9 MN, C3D20R (CCX §5.1) — el "hello world" del solver | hex20 reducido (o el hex8I sobre voxel) + empotramiento de cara + carga en punta | δ_tip vs PL³/(3EI) dentro de 10 % con 1 elemento de espesor (CCX §5.14: "off by 10 %"), <2.4 % con 5 | CCX §5.14: 10 % (1 elem) → 2.4 % (5 elem) | suite | 4 |
| fea-lineal-ccx-02 | 7 | Reglas de oro: *NO ANALYSIS (jacobiano) + versión LINEALIZADA primero (CCX §4, §7.93) | modo "ensayo en seco": ensamblar sin resolver, checar det J y BC | exit 1 si algún tet con V≤0 o si K tiene modo rígido libre; exit 0 sin gastar el solve |  | suite | 3 |
| fea-lineal-ccx-03 | 7 | Frecuencias de la viga 1×1.5×8 con precarga: la 1ª cae a ~0 ⇒ pandeo (CCX §5.2) | modal K·φ=ω²M·φ + K_σ (PERTURBATION) o *BUCKLE | P_cr = 21 × 48.155 = 1011.3 unidades de fuerza; comparar contra Euler π²EI/(KL)² | CCX §5.2: buckling load 21×48.155=1011.3 | suite | 4 |
| fea-lineal-ccx-04 | 7 | Viga B32R de 1 elemento, 100 mm, 2×2 mm², E=100 GPa, F=1 N (CCX §5.14 Tabla 3) | elemento viga cuadrático (o hex20) + lectura en puntos de integración | σ en punto a exacto (M·c/I); δ_tip 10 % alto con 1 elemento; torsión: δ 15 % (Tabla 5) | CCX §5.14: "displacements at the beam tip are off by 10 %"; torsión 15 % | suite | 3 |
| fea-lineal-ccx-05 | 7 | ΣRF exacto vs ∫σ·n dA sobre la cara empotrada — el que SÍ mide la malla (CCX §5.18) | gate G8 (reacciones nodales) + gate G12 (integral de esfuerzos en la cara) | RF_y = −9.000000 exacto; SOF con C3D10 grueso = 7.23 (20 % error) y momento 65.5 vs 72 (9 %); tras *REFINE MESH ambos <5 % | CCX §5.18: RF −9.000000E+00; SOF −7.226251; momento 72.37 vs 72 esperado | suite | 5 |
| fea-lineal-ccx-06 | 8 | Estimador de error Zienkiewicz-Zhu / gradiente ERR por nodo (CCX §6.12) | post: σ* suavizado vs σ_h; mapa de confianza junto al von Mises | en el nodo de σ_vm máx: ERR<0.10 para entregar; >0.30 → "número no reportable"; CCX §5.18 marcaba hasta 30 % en la malla gruesa | CCX §5.18: error estimator up to 30 % | suite | 4 |
| fea-lineal-ccx-07 | 8 | Catálogo de elementos con sus vicios: C3D4 "too stiff", C3D8 shear locking, C3D8I recomendado en flexión, C3D10 buen uso general (CCX §6.2) | tabla elemento→advertencia en la UI + selector de elemento | misma viga con tet4/hex8/hex8I/tet10: δ/δ_exacto = ordenado tet4<hex8<hex8I≈tet10; C3D8I dentro de 3 % | CCX §6.2.3: C3D8I "should be used in all instances in which linear elements are subject to bending" | suite | 5 |
| fea-lineal-ccx-08 | 8 | Esfuerzos en puntos de integración vs extrapolados a nodos (CCX §6.13, §5.14) | reporte de vmElem (verdad) y vmNodal (bonito); FS usa vmElem; dispersión G17 | τ en nodo esquina extrapolado ≠ 0 (falso), en el punto de Gauss = media exacta; dispersión nodal >15 % ⇒ malla inadecuada (fe-safe) | CCX §5.14: "the values at the integration points are exact" | suite | 4 |
| fea-lineal-aster-01 | 9 | Tablas de Gauss por familia (TETRA FPG1/4/5/15, HEXA FPG8/27, QUAD FPG4/9, TRIA) con suma de pesos = volumen de referencia | módulo quadrature.ts + gate G19 | Σw: tetra=1/6, hexa=8, quad=4, tria=1/2; TETRA FPG5 tiene w=−2/15 (válido); FPG4 tetra a=(5−√5)/20, b=(5+3√5)/20, w=1/24 | R3.01.01 §4.1 (TE4/T10) y §4.3 (HE8/H20/H27) | suite | 4 |
| fea-lineal-aster-02 | 9 | Orden de exactitud de cada regla: integrar monomios ξ^a η^b ζ^c hasta que falle | test unitario sobre las tablas | TETRA FPG1/4/5/15 exactas a orden 1/2/3/5; HEXA FPG8 orden 3, FPG27 orden 5; QUAD FPG4 orden 3, FPG9 orden 5 | R3.01.01 tabla de familias | suite | 3 |
| fea-lineal-aster-03 | 9 | Funciones de forma TE4/T10/HE8/H20/H27: ΣN_i=1 y N_i(nodo_j)=δ_ij; numeración NO estándar del TETRA (N1=(0,1,0), N2=(0,0,1), N3=(0,0,0), N4=(1,0,0)) | gate G7 + gate G20 (signo de det J al portar) | ΣN=1 en cada punto de Gauss <1e-14; det J>0 con la numeración de La Forja tras permutar | R3.01.01 §4.1 | suite | 3 |
| fea-lineal-nafems-01 | 10 | LE1 membrana elíptica, esfuerzo plano, p=10 MPa exterior, simetría en AB y DC | elemento 2D esfuerzo plano (Q4/Q8) + frontera curva + BC de simetría | σ_y tangencial en D = 92.7 MPa (±3 %); StressCheck: 4 quads → 92.75, 6 tris → 92.84 | NAFEMS LE1: 92.7 MPa | suite | 5 |
| fea-lineal-nafems-02 | 10 | LE2 patch test de flexión de cascarón cilíndrico (R=1000, t=10 mm, M=1000 N·mm/mm) | elemento shell — 1 SOLO elemento debe dar la respuesta | σ tangencial exterior = 60 MPa; StressCheck 1 elemento → 59.81 (−0.3 %) | NAFEMS LE2: 60 MPa | suite | 3 |
| fea-lineal-nafems-03 | 10 | LE3 hemisferio R=10 m, t=0.04 m, E=68.25 GPa, cargas puntuales ±2 kN | shell + carga nodal (inadmisible para σ, válida para u) | u radial en A = 185 mm (1.85 % de R, aún lineal); StressCheck 16 elem → 184.3 | NAFEMS LE3: 185 mm | suite | 2 |
| fea-lineal-nafems-04 | 10 | LE5 cantilever sección Z, L=10 m, t=0.1 m, par 1.2 MN·m como 2×0.6 MN en los patines | sólido 3D (hexa sobre voxel) + cara X=0 empotrada + cortante distribuido por área (EbE) | σ axial en A (X=2.5, midsurface) = −108 MPa (±3 %); StressCheck hexa 20 elem → −109.8, tetra 136 → −109.3 | NAFEMS LE5: −108 MPa | suite | 5 |
| fea-lineal-nafems-05 | 10 | LE6 placa oblicua t fina bajo presión −0.7 kPa | shell/placa + esquinas singulares (malla graduada) | σ1 máx cara inferior centro = 0.802 MPa; residual 2.2-2.9 % irreducible (singularidades) | NAFEMS LE6: 0.802 MPa | suite | 2 |
| fea-lineal-nafems-06 | 10 | LE7 cilindro/esfera axisimétrico, p_int=1 MPa | axisimétrico (o sector 3D con simetría) | σ axial exterior en R=1.0125, Z=1.4034 = 25.86 MPa; StressCheck 5 quads → 25.27 (−2.3 %) | NAFEMS LE7: 25.86 MPa | suite | 3 |
| fea-lineal-nafems-07 | 10 | LE8 cascarón axisimétrico, p_int=1 MPa | axisimétrico shell | σ hoop exterior a 36° = 94.55 MPa; StressCheck 12 quads → 91.93 (−2.8 %) | NAFEMS LE8: 94.55 MPa | suite | 2 |
| fea-lineal-nafems-08 | 10 | LE10 placa gruesa elíptica bajo p=1 MPa (simetría en 2 caras, Ux=Uy=0 en BCB'C', Uz=0 en el plano medio) | sólido 3D + BC de simetría por cara + restricción de UNA componente (línea → cara) | σ_yy en D = −5.38 MPa (±3 %); StressCheck hexa 32 elem → −5.24 (−2.6 %) | NAFEMS LE10: −5.38 MPa | suite | 5 |
| fea-lineal-nafems-09 | 10 | LE11 cilindro/cono/esfera sólido con gradiente lineal de T, α=2.3e−4/°C | sólido 3D + deformación térmica ε0=αΔT (f_térmico=∫BᵀDε0) + simetrías | σ_yy en A = −105 MPa (±3 %); hexa 8 elem → −105.2 (0.19 %) vs tetra 317 → −105.5 | NAFEMS LE11: −105 MPa | suite | 5 |
| fea-lineal-babuska-01 | 11 | Problema 1: cuadrado en deformación plana con cortante impuesto, cuarto de dominio, E=1 | 2D plane strain + estudio h con 3+ mallas + energía ½uᵀKu | W→0.130680 (ν=0.3), 0.127035 (ν=0.4999); pendiente log-log e vs N = α con 1<α<p ⇒ singularidad en vértices | Babuška-Szabó: W=0.130680 / 0.127035 | suite | 4 |
| fea-lineal-babuska-02 | 11 | Problema 2: panel cuadrado con grieta de borde a tracción unitaria, cuarto de dominio | 2D + refinamiento h + orden observado | W→0.73422 (ν=0.3), 0.60525 (ν=0.4999); tasa en energía = 0.5 (α=1/2, u~√r), independiente de ν | Babuška-Szabó: W=0.73422 / 0.60525; rate 0.5 | suite | 4 |
| fea-lineal-babuska-03 | 11 | Teorema inverso: leer la suavidad de la solución en la pendiente (G14b) | gate G14 (orden observado p, Richardson, GCI vía verificacion/gci.ts) sobre el solver 3D | esquina entrante ν=0.3 → α≈0.76; ν=0.4999 → 0.69; solución suave → 1.0 (p=1); malla casi-incompresible p=1 NO converge | Babuška-Szabó Conclusión 2 + tabla de singularidades | suite | 4 |
| fea-lineal-babuska-04 | 11 | Refinamiento geométrico hacia la singularidad, razón (1−ρ) con ρ=0.62 | malla graduada (progresión geométrica) + p creciente | convergencia exponencial en N vs algebraica O(N^−1/2) uniforme | Babuška-Szabó: ρ=0.62 "golden rule" | teoria | 2 |

## Features (estado verificado con grep/ls)

| feature | qué hace | Forja | pri | dónde | ejercicios |
|---|---|---|---|---|---|
| Solver FEA 3D tet4 sobre voxel + CG disperso IC(0) | K·u=f sobre el sólido B-Rep con caras fijas/cargadas desde la UI; von Mises por elemento y nodo; sesión con warm-start | si | P0 | src/forja/brep/fea.ts:runFEA/prepareFeaSession/solveLoadOnSession; UI ForgeBRepStudio.tsx:runFeaAnalysis; scripts/fea-node-test.cjs, fea-cantilever-verify.cjs | fea-lineal-ccx-01, fea-lineal-felippa-07 |
| Reacciones + equilibrio global y de momentos (G8/G9) | Guardar las filas fijas de K antes de eliminar Dirichlet; R=K_orig·u−f; ‖ΣR+ΣF‖/‖ΣF‖<1e−8 y momentos; mostrar diagrama de cuerpo libre | no | P0 | grep "react" en src/forja/brep/fea.ts = 0 resultados; Dirichlet destruye filas fijas | fea-lineal-felippa-01, fea-lineal-felippa-04, fea-lineal-ccx-05 |
| Residuo verdadero + energía + régimen lineal (G10/G11/G15) | ‖f−K·u‖/‖f‖ con matvec extra; ½fᵀu = Σ½εᵀDεV; abortar/etiquetar si max|u|>L/10 o σ_vm>σ_y; converged:false bloquea | no | P0 | fea.ts reporta residuo recursivo del CG; minSafetyFactor<1 se pinta como real | fea-lineal-ccx-02, fea-lineal-ccx-01 |
| Modos de cuerpo rígido K·r=0 + detección de mecanismo (G4/V1) | 6 vectores rígidos sobre la K sin restringir; pivote cero ⇒ "cuerpo rígido libre" con mensaje | no | P0 | sin equivalente en fea.ts ni verificacion/ | fea-lineal-felippa-03, fea-lineal-ccx-02 |
| Patch test 3D + ΣN=1 (G6/G7) | Parche de tets con nodo interior, campo lineal impuesto en frontera ⇒ σ constante y u exacto | parcial | P0 | patch test 2D Q4 en scripts/mold-vonmises-test.cjs (lamina-vonmises.ts); no existe en 3D | fea-lineal-felippa-14, fea-lineal-aster-03 |
| Elemento hexaédrico C3D8I (modos incompatibles) sobre la rejilla de voxeles | El voxel YA es un hexaedro perfecto: ensamblar hex8I en vez de 6 tet4 → quita el shear locking, 6× menos elementos | no | P0 | grep hex8/C3D8 en src/forja = 0; fea.ts: split de Freudenthal 6 tets | fea-lineal-ccx-07, fea-lineal-felippa-11, fea-lineal-nafems-04, fea-lineal-nafems-08 |
| Elementos cuadráticos tet10/hex20 + tablas de Gauss (Code_Aster) | Nodos medios en aristas de la rejilla; FPG4 tetra / FPG8-27 hexa; gate G19 suma de pesos; selector de elemento con advertencias CCX §6.2 | no | P1 | solo tet4 1 punto (formulas.ts:tet4Element) y Q4 2×2 inline (lamina-vonmises.ts) | fea-lineal-aster-01, fea-lineal-aster-02, fea-lineal-felippa-15, fea-lineal-ccx-04 |
| Reparto de carga EbE por área tributaria | Recorrer caras triangulares de frontera de la cara cargada y repartir A/3 por nodo; presión con normal por cara | no | P0 | fea.ts: per = force/loadNodes.length (uniforme por nodo) | fea-lineal-felippa-05, fea-lineal-nafems-04 |
| Condiciones de simetría y restricción por componente | Fijar 1 DOF (normal al plano) en una cara: rodillo/simetría; línea→cara (LE10); reducir a 1/2 o 1/4 | no | P0 | FaceBC solo tiene fixedFaces (3 DOF) y loadFaces | fea-lineal-felippa-06, fea-lineal-nafems-01, fea-lineal-nafems-08, fea-lineal-nafems-09 |
| Estimador de error ZZ/gradiente + dispersión nodal (G13/G17) | Por nodo: (max−min)/prom de σ entre tets incidentes; mapa de confianza; >15 % = malla inadecuada; ERR>0.30 no se reporta | no | P1 | fea.ts acumula vmNodalAcc/vmNodalCnt pero no min/max | fea-lineal-ccx-06, fea-lineal-ccx-08 |
| ∫σ·n dA sobre la cara empotrada (G12) | Integrar el tensor sobre las caras de frontera del conjunto fijo y comparar con la carga: <5 % entrega, <10 % explora | no | P1 | no existe | fea-lineal-ccx-05 |
| Estudio de convergencia con VEREDICTO (GCI/Richardson/orden observado, G14/G14b) | 3 resoluciones → p observado, Richardson, GCI<5 %; interpretar p<teórico como singularidad (Babuška) | parcial | P0 | src/forja/verificacion/gci.ts:gci/richardson/consistenciaOrden + scripts/verif-gci-test.cjs (sobre lamina-vonmises 2D); scripts/fea-convergence.cjs imprime sin juzgar | fea-lineal-babuska-01, fea-lineal-babuska-02, fea-lineal-babuska-03 |
| Gates de calidad de malla (jacobiano, Q de CalculiX, AR de Felippa; G1/G2/G3) | V>0 por tet, Q=(√6/12)L_max/r_in (advertir >3, fallar >10), AR>3/10; capas mínimas a través del espesor | parcial | P1 | voxel garantiza J>0 y Q=1.7071 por construcción; sin métrica explícita ni gate de capas | fea-lineal-felippa-07, fea-lineal-felippa-12, fea-lineal-felippa-16 |
| Esfuerzo plano / deformación plana 2D general (Q4/Q8) con frontera curva | Problema 2D sobre un croquis: LE1, Kirsch, Babuška P1/P2 | parcial | P1 | lamina-vonmises.ts: Q4 plane strain sobre la SECCIÓN del molde (rejilla), Kirsch Kt=3 verificado; no es general ni conforma fronteras curvas | fea-lineal-nafems-01, fea-lineal-babuska-01, fea-lineal-babuska-02, fea-lineal-felippa-17 |
| Carga térmica ε0=αΔT en el sólido (termo-elástico lineal) | f_térmico=∫BᵀDε0 dV con campo T nodal (del módulo térmico Kazmer cap 9) | no | P1 | formulas.ts:thermalStressConstrained es escalar 1D; thermalTet4 es conducción, no acoplamiento | fea-lineal-nafems-09 |
| Pandeo lineal [K+λKσ]φ=0 | Rigidez geométrica desde σ del paso estático; λ1 = BLF; verificación contra Euler y CCX §5.2 | parcial | P1 | formulas.ts:eulerBucklingLoad (fórmula cerrada); sin Kσ ni eigensolver | fea-lineal-ccx-03 |
| Modal K·φ=ω²M·φ con residuo ‖Ku−λMu‖/‖Ku‖<1e−6 y masa efectiva ≥90 % | Lanczos/subespacio + M consistente; verificación Code_Aster R5.01.01 | parcial | P2 | formulas.ts:beamNaturalFrequency (fórmula); sin M ni eigensolver | fea-lineal-ccx-03 |
| Elementos 1D (truss/beam) con ensamblador y UI | Armadura y marco: DSM completo con reacciones y fuerzas internas | parcial | P1 | formulas.ts:trussStiffness3D, beamStiffnessEulerBernoulli, beamStiffnessTimoshenko; sin ensamble/solve/UI | fea-lineal-felippa-01, fea-lineal-felippa-02, fea-lineal-felippa-04, fea-lineal-felippa-08 |
| Shells y axisimétrico (LE2/LE3/LE6/LE7/LE8) | Elemento de cascarón (S4/S8) y CAX4/8 | no | P2 | grep shell/axisym en src/forja = 0 | fea-lineal-nafems-02, fea-lineal-nafems-03, fea-lineal-nafems-05, fea-lineal-nafems-06, fea-lineal-nafems-07 |
| Elementos iso-P de orden alto 2D (Q5/Q9/T6) con K de referencia | Biblioteca de elementos verificable entrada por entrada contra Felippa cap 23-24 | no | P2 | no existe | fea-lineal-felippa-17, fea-lineal-felippa-18, fea-lineal-felippa-19, fea-lineal-felippa-20, fea-lineal-felippa-21 |
| Malla que conforma la frontera (no escalonada) | Marcar nodos de superficie escalonada como no confiables o mallar desde la teselación OCCT (tet conformes) | no | P1 | fea.ts:brepToVolumeTetMesh voxeliza el AABB; el máximo de σ suele caer en un escalón | fea-lineal-nafems-01, fea-lineal-nafems-09, fea-lineal-ccx-06 |
| Lección de escuela "¿Aguanta o se rompe?" (FEA visual) | Lección mec-sim-l1 con voz: empotrar, cargar, n=σ_y/σ_max | si | P2 | public/escuela/lecciones/mec-sim-l1.json; runner scripts/escuela/clase-drive.cjs | fea-lineal-ccx-01 |

## Supertickets (líneas Temis listas para pegar)


### fea-lineal-gates-baratos — Los gates que cuestan 20 líneas: reacciones, energía, cuerpo rígido, régimen

**Objetivo:** Que runFEA no pueda devolver un número sin: ΣR+ΣF=0 y ΣM=0 (con K original), residuo verdadero, trabajo externo = energía de deformación, K·r=0 para 6 modos rígidos, abortar si hay mecanismo, y etiquetar "fuera de régimen lineal" si u>L/10 o σ_vm>σ_y. La lección muestra el diagrama de cuerpo libre sobre la ménsula.

**Capítulos:** [1, 7, 9] · **Esfuerzo:** M · **Valor:** 5/5 · **Sprint:** 1 · **Depende de:** (nada)

**Ya existe:** fea.ts:runFEA/solveLoadOnSession (solver CSR+IC(0), vmElem+vmNodal); formulas.ts:trussStiffness3D; scripts/fea-node-test.cjs (tensión + cantilever); gci.ts:trabajo() (½fᵀu)

## EJERCICIOS
- fea-lineal-felippa-01 · Armadura ejemplo de 3 barras (DSM): desplazamientos y reacciones · ensamblador truss (trussStiffness3D) + solve + recuperar R=K·u · u_x3=0.4, u_y3=-0.2; reacciones f_x1=f_y1=-2, f_y2=1; equilibrio ΣF=0 y ΣM=0 (Ex 3.2)
- fea-lineal-felippa-03 · Soporte mal puesto: K reducida SINGULAR (mecanismo) · gate G1/V1 pivote cero + K·r=0 (modos de cuerpo rígido) · det(K_reducida)=0 con u_x2=0 en vez de u_y2=0; el solver DEBE abortar con mensaje "cuerpo rígido libre"
- fea-lineal-felippa-04 · Arco-armadura de 2 barras (Ex 3.7): S=8, H=3, E=1000, A=2/4, P=12 · ensamblador truss + BC + reacciones · u_x2, u_y2 del sistema reducido; ΣR+P=0 <1e-10
- fea-lineal-ccx-02 · Reglas de oro: *NO ANALYSIS (jacobiano) + versión LINEALIZADA primero (CCX §4, §7.93) · modo "ensayo en seco": ensamblar sin resolver, checar det J y BC · exit 1 si algún tet con V≤0 o si K tiene modo rígido libre; exit 0 sin gastar el solve
- fea-lineal-ccx-05 · ΣRF exacto vs ∫σ·n dA sobre la cara empotrada — el que SÍ mide la malla (CCX §5.18) · gate G8 (reacciones nodales) + gate G12 (integral de esfuerzos en la cara) · RF_y = −9.000000 exacto; SOF con C3D10 grueso = 7.23 (20 % error) y momento 65.5 vs 72 (9 %); tras *REFINE MESH ambos <5 %
- fea-lineal-aster-01 · Tablas de Gauss por familia (TETRA FPG1/4/5/15, HEXA FPG8/27, QUAD FPG4/9, TRIA) con suma de pesos = volumen de referencia · módulo quadrature.ts + gate G19 · Σw: tetra=1/6, hexa=8, quad=4, tria=1/2; TETRA FPG5 tiene w=−2/15 (válido); FPG4 tetra a=(5−√5)/20, b=(5+3√5)/20, w=1/24
- fea-lineal-ccx-08 · Esfuerzos en puntos de integración vs extrapolados a nodos (CCX §6.13, §5.14) · reporte de vmElem (verdad) y vmNodal (bonito); FS usa vmElem; dispersión G17 · τ en nodo esquina extrapolado ≠ 0 (falso), en el punto de Gauss = media exacta; dispersión nodal >15 % ⇒ malla inadecuada (fe-safe)

### fea-lineal-patch-y-elemento — El elemento se prueba solo: patch test 3D, rango, jacobiano y las K impresas de Felippa

**Objetivo:** Biblioteca de elementos (tet4, Q4, hex8, Q9/T6 opcionales) con cuadratura tabulada (Code_Aster) y tres tests unitarios por elemento: ΣN=1 y Σw=volumen de referencia (G7/G19), rango correcto por regla (G5, Ex 17.1/19.4/23.4), patch test de Irons (G6). La K del Q4 2:1 con E=96, ν=1/3 se compara entrada por entrada contra (23.6).

**Capítulos:** [4, 5, 6, 9] · **Esfuerzo:** L · **Valor:** 4/5 · **Sprint:** 2 · **Depende de:** fea-lineal-gates-baratos

**Ya existe:** lamina-vonmises.ts: Q4 2×2 plane strain + patch test 2D + Kirsch Kt=3 (scripts/mold-vonmises-test.cjs); formulas.ts:tet4Element/planeStressMatrix/planeStrainMatrix; verificacion/matricula.ts (volumen firmado)

## EJERCICIOS
- fea-lineal-felippa-14 · PATCH TEST 3D (Irons): campo lineal u=a+B·x sobre parche de tets con nodo interior · gate G6: u interior exacto, σ constante, ΣR=0 · error nodos interiores <1e-10·|u|; (σ_max−σ_min)/σ <1e-10; ΣR<1e-10
- fea-lineal-felippa-17 · K del Q4 rectangular 2:1, E=96, ν=1/3, h=1 (§23.3.1) · elemento Q4 iso-P 2×2 Gauss · K(23.6) entrada por entrada (K11=42, K12=18, K22=78…); eigenvalores [223.64 90 78 46.3603 42 0 0 0]; 3×3 y 4×4 la reproducen EXACTA
- fea-lineal-felippa-10 · Q4 rectangular: K idéntica para p=2,3,4 y 3 eigenvalores nulos; p=1 da 5 (Ex 17.1) · elemento Q4 iso-P + Gauss p×p + eigen(K) · rank(K)=5 para p≥2 (3 modos rígidos); p=1 → 5 ceros = 2 hourglass
- fea-lineal-felippa-15 · Rango mínimo por regla de Gauss: n_E·n_G ≥ n_F − n_R para bricks n=8,20,27,64 (Ex 19.4) · gate G5 tabla elemento×regla · hex8: 1×1×1 → 6<18 (12 modos espurios), 2×2×2 → 48≥18 OK; hex20: 2×2×2 → 48<54 (6 espurios), 3×3×3 OK
- fea-lineal-felippa-19 · Q9 biquadrático: 2×2 deja rango deficiente en 3; K11 (Ex 23.4) · elemento Q9 + Gauss 2×2/3×3 + eigen · K11=5395390 (2×2) y 6474468 (3×3); 2×2 → 3 modos espurios
- fea-lineal-felippa-16 · Nodo al cuarto de lado: J=0 (Ex 19.2 barra de 3 nodos, Ex 19.5 Q9) · gate G1 jacobiano en TODOS los puntos de Gauss + nodos · α=±1/4 anula J en el extremo; deformación axial → ∞ (singularidad de grieta)
- fea-lineal-aster-02 · Orden de exactitud de cada regla: integrar monomios ξ^a η^b ζ^c hasta que falle · test unitario sobre las tablas · TETRA FPG1/4/5/15 exactas a orden 1/2/3/5; HEXA FPG8 orden 3, FPG27 orden 5; QUAD FPG4 orden 3, FPG9 orden 5
- fea-lineal-aster-03 · Funciones de forma TE4/T10/HE8/H20/H27: ΣN_i=1 y N_i(nodo_j)=δ_ij; numeración NO estándar del TETRA (N1=(0,1,0), N2=(0,0,1), N3=(0,0,0), N4=(1,0,0)) · gate G7 + gate G20 (signo de det J al portar) · ΣN=1 en cada punto de Gauss <1e-14; det J>0 con la numeración de La Forja tras permutar

### fea-lineal-locking-hexaedros — Matar el shear locking: hex8I sobre el voxel, EbE y el cantilever de CalculiX

**Objetivo:** El voxel ya es un hexaedro: ensamblar C3D8I (modos incompatibles, exactos en rectángulos) en lugar de 6 tet4, repartir la carga por área tributaria (EbE) y exigir ≥4 capas en la dimensión menor. Se mide r(γ,ν) de E17.8 con 1 capa de Q4 vs hex8I, y el cantilever 1×1×8 de CalculiX cae de 10 % a <3 %. La flecha de la viga de 100×10×20 (30 MPa, 0.145 mm) deja de salir 10 % alta.

**Capítulos:** [3, 4, 6, 7, 8] · **Esfuerzo:** L · **Valor:** 5/5 · **Sprint:** 2 · **Depende de:** fea-lineal-gates-baratos, fea-lineal-patch-y-elemento

**Ya existe:** fea.ts: rejilla de voxeles (Freudenthal 6 tets), área OCCT exacta para presión, warm-start; scripts/fea-cantilever-verify.cjs (30 MPa, δ=0.14512 mm por UI); scripts/fea-live-verify.cjs (linealidad σ(400)=2σ(200)); formulas.ts:beamStiffnessEulerBernoulli, cantileverDeflection

## EJERCICIOS
- fea-lineal-felippa-11 · Shear locking cuantificado: razón de energía r(γ,ν) del Q4 en flexión pura (Ex 17.3) · Q4 en 1 capa bajo momento M; Ubeam=6M²/(Eha²γ³) · r = 2γ²(1-ν²)/(1+2γ²-ν); a=10b, ν=0 → r≈1/50 (2 % de la respuesta)
- fea-lineal-felippa-12 · Techo de una capa: r→1−ν² aunque a→0 (nota 10 de Ex 17.3) — gate "≥4 capas en flexión" · gate de capas a través del espesor menor · acero ν=0.3: r_max=0.91 con 1 capa; el gate exige ≥4 voxeles en la dimensión menor de cualquier cuerpo en flexión
- fea-lineal-felippa-05 · Cargas nodales equivalentes NbN vs EbE para q lineal (Ex 8.3) · reparto de carga por área tributaria (EbE) — la que hoy NO hace fea.ts · f1=3q/8 (NbN); Σf_i = 6q en ambos esquemas
- fea-lineal-ccx-07 · Catálogo de elementos con sus vicios: C3D4 "too stiff", C3D8 shear locking, C3D8I recomendado en flexión, C3D10 buen uso general (CCX §6.2) · tabla elemento→advertencia en la UI + selector de elemento · misma viga con tet4/hex8/hex8I/tet10: δ/δ_exacto = ordenado tet4<hex8<hex8I≈tet10; C3D8I dentro de 3 %
- fea-lineal-ccx-01 · Cantilever 1×1×8 m, F=9 MN, C3D20R (CCX §5.1) — el "hello world" del solver · hex20 reducido (o el hex8I sobre voxel) + empotramiento de cara + carga en punta · δ_tip vs PL³/(3EI) dentro de 10 % con 1 elemento de espesor (CCX §5.14: "off by 10 %"), <2.4 % con 5
- fea-lineal-felippa-20 · Sensibilidad a distorsión: cantilever a=10, b=2, M=1 con 2 Q4 vs 2 Q9 (Ex 23.5-23.6) · malla distorsionada e=0,1,2,3,5; v_beam=Ma²/(2EI) · Q4: g(e)=r(e)/r(0)<1 decreciente; Q9 superparamétrico: r=1 para todo e<a/2
- fea-lineal-felippa-08 · Cantilever con UN elemento de viga Hermitiano (Ex 13.9) · elemento beam Euler-Bernoulli (beamStiffnessEulerBernoulli) + solve · v_j=PL^3/(3EI), θ_j=PL^2/(2EI) EXACTOS con 1 elemento (cúbica exacta)
- fea-lineal-ccx-04 · Viga B32R de 1 elemento, 100 mm, 2×2 mm², E=100 GPa, F=1 N (CCX §5.14 Tabla 3) · elemento viga cuadrático (o hex20) + lectura en puntos de integración · σ en punto a exacto (M·c/I); δ_tip 10 % alto con 1 elemento; torsión: δ 15 % (Tabla 5)

### fea-lineal-convergencia-babuska — La pendiente mide la suavidad: GCI con veredicto, ZZ, ∫σ·n dA y los problemas de Babuška

**Objetivo:** Cablear verificacion/gci.ts al FEA 3D: 3 resoluciones → orden observado, Richardson, GCI<5 % como gate (fea-convergence.cjs deja de imprimir y juzga). Agregar estimador de gradiente/ZZ por nodo y dispersión >15 %, y el ∫σ·n dA sobre la cara fija (5 %). Los problemas 1 y 2 de Babuška (W=0.130680, 0.73422) enseñan que p_obs=0.5 en la grieta y ≈0.76 en la esquina entrante NO son bugs.

**Capítulos:** [2, 7, 8, 11] · **Esfuerzo:** M · **Valor:** 4/5 · **Sprint:** 3 · **Depende de:** fea-lineal-gates-baratos

**Ya existe:** verificacion/gci.ts:gci/gciDeMallas/richardson/consistenciaOrden + scripts/verif-gci-test.cjs (controles negativos, Betti); verificacion/mms.ts:ordenObservado; scripts/fea-convergence.cjs (4 resoluciones, barra a tensión, sin juicio)

## EJERCICIOS
- fea-lineal-babuska-01 · Problema 1: cuadrado en deformación plana con cortante impuesto, cuarto de dominio, E=1 · 2D plane strain + estudio h con 3+ mallas + energía ½uᵀKu · W→0.130680 (ν=0.3), 0.127035 (ν=0.4999); pendiente log-log e vs N = α con 1<α<p ⇒ singularidad en vértices
- fea-lineal-babuska-02 · Problema 2: panel cuadrado con grieta de borde a tracción unitaria, cuarto de dominio · 2D + refinamiento h + orden observado · W→0.73422 (ν=0.3), 0.60525 (ν=0.4999); tasa en energía = 0.5 (α=1/2, u~√r), independiente de ν
- fea-lineal-babuska-03 · Teorema inverso: leer la suavidad de la solución en la pendiente (G14b) · gate G14 (orden observado p, Richardson, GCI vía verificacion/gci.ts) sobre el solver 3D · esquina entrante ν=0.3 → α≈0.76; ν=0.4999 → 0.69; solución suave → 1.0 (p=1); malla casi-incompresible p=1 NO converge
- fea-lineal-ccx-06 · Estimador de error Zienkiewicz-Zhu / gradiente ERR por nodo (CCX §6.12) · post: σ* suavizado vs σ_h; mapa de confianza junto al von Mises · en el nodo de σ_vm máx: ERR<0.10 para entregar; >0.30 → "número no reportable"; CCX §5.18 marcaba hasta 30 % en la malla gruesa
- fea-lineal-ccx-05 · ΣRF exacto vs ∫σ·n dA sobre la cara empotrada — el que SÍ mide la malla (CCX §5.18) · gate G8 (reacciones nodales) + gate G12 (integral de esfuerzos en la cara) · RF_y = −9.000000 exacto; SOF con C3D10 grueso = 7.23 (20 % error) y momento 65.5 vs 72 (9 %); tras *REFINE MESH ambos <5 %
- fea-lineal-felippa-07 · Relación de aspecto y zonas de refinamiento (Ex 8.1 + §8.2.2) · gate G3 (AR>3 advertir, >10 alarma) + mapa de "trouble spots" (esquinas entrantes, cargas puntuales) · todos los tets del voxel: AR=sqrt(3)=1.73 (pasa); lista de nodos con gradiente alto = esquinas entrantes
- fea-lineal-babuska-04 · Refinamiento geométrico hacia la singularidad, razón (1−ρ) con ρ=0.62 · malla graduada (progresión geométrica) + p creciente · convergencia exponencial en N vs algebraica O(N^−1/2) uniforme

### fea-lineal-nafems-solidos — NAFEMS en CI: LE1, LE5, LE10, LE11 (+LE7) dentro del 3 %

**Objetivo:** Los cuatro benchmarks que un sólido 3D/2D puede correr sin shells: LE5 (Z cantilever, todo plano y ortogonal → el candidato), LE10 (placa gruesa, simetría + Uz en plano medio), LE11 (térmico, ε0=αΔT), LE1 (esfuerzo plano con frontera elíptica) y LE7 como sector sólido. Cada uno nombra el target ANTES de resolver, reporta la corrida real (no la extrapolada), malla mínima vs densa, y pasa con <3 % contra la referencia y GCI<1 %. Requiere BC de simetría por componente y carga térmica.

**Capítulos:** [2, 10] · **Esfuerzo:** XL · **Valor:** 5/5 · **Sprint:** 4 · **Depende de:** fea-lineal-locking-hexaedros, fea-lineal-convergencia-babuska

**Ya existe:** docs/forja-research/pliegos/pliego-moldflow-nafems.md §2.4 (fichas con geometría de los 9 LE); lamina-vonmises.ts (Q4 2D, Kirsch); formulas.ts:thermalStressConstrained (escalar), thermalTet4 (conducción)

## EJERCICIOS
- fea-lineal-nafems-04 · LE5 cantilever sección Z, L=10 m, t=0.1 m, par 1.2 MN·m como 2×0.6 MN en los patines · sólido 3D (hexa sobre voxel) + cara X=0 empotrada + cortante distribuido por área (EbE) · σ axial en A (X=2.5, midsurface) = −108 MPa (±3 %); StressCheck hexa 20 elem → −109.8, tetra 136 → −109.3
- fea-lineal-nafems-08 · LE10 placa gruesa elíptica bajo p=1 MPa (simetría en 2 caras, Ux=Uy=0 en BCB'C', Uz=0 en el plano medio) · sólido 3D + BC de simetría por cara + restricción de UNA componente (línea → cara) · σ_yy en D = −5.38 MPa (±3 %); StressCheck hexa 32 elem → −5.24 (−2.6 %)
- fea-lineal-nafems-09 · LE11 cilindro/cono/esfera sólido con gradiente lineal de T, α=2.3e−4/°C · sólido 3D + deformación térmica ε0=αΔT (f_térmico=∫BᵀDε0) + simetrías · σ_yy en A = −105 MPa (±3 %); hexa 8 elem → −105.2 (0.19 %) vs tetra 317 → −105.5
- fea-lineal-nafems-01 · LE1 membrana elíptica, esfuerzo plano, p=10 MPa exterior, simetría en AB y DC · elemento 2D esfuerzo plano (Q4/Q8) + frontera curva + BC de simetría · σ_y tangencial en D = 92.7 MPa (±3 %); StressCheck: 4 quads → 92.75, 6 tris → 92.84
- fea-lineal-nafems-06 · LE7 cilindro/esfera axisimétrico, p_int=1 MPa · axisimétrico (o sector 3D con simetría) · σ axial exterior en R=1.0125, Z=1.4034 = 25.86 MPa; StressCheck 5 quads → 25.27 (−2.3 %)
- fea-lineal-felippa-06 · Simetría/antisimetría: disco brasileño, placa con agujero, Flamant (Ex 8.4) · BC de simetría (plano: 1 DOF fijo, NO empotrar) + reducción a 1/4 · mismo σ_max en modelo completo vs 1/4 (<0.5 %); Kt=3.0 Kirsch en la placa con agujero central

### fea-lineal-pandeo-modal — La viga de CalculiX que pandea: Kσ, *BUCKLE y las frecuencias con precarga

**Objetivo:** Rigidez geométrica Kσ desde el σ del paso estático y eigensolver (subespacio/Lanczos) para [K+λKσ]φ=0 y K·φ=ω²M·φ. Se reproduce CCX §5.2: la primera frecuencia cae a ~0 con 21×48.155=1011.3 y coincide con *BUCKLE y con Euler. Aplica directo a los pilares de soporte del molde (Kazmer cap 12) que hoy solo se checan por σ.

**Capítulos:** [3, 7] · **Esfuerzo:** L · **Valor:** 3/5 · **Sprint:** 5 · **Depende de:** fea-lineal-locking-hexaedros

**Ya existe:** formulas.ts:eulerBucklingLoad, beamNaturalFrequency (fórmulas cerradas); mold/structural.ts (compresión/flexión de placas Kazmer cap 12); simulacion-avanzada.md §6/§11 (GEP, Kσ, Sturm, masa efectiva)

## EJERCICIOS
- fea-lineal-ccx-03 · Frecuencias de la viga 1×1.5×8 con precarga: la 1ª cae a ~0 ⇒ pandeo (CCX §5.2) · modal K·φ=ω²M·φ + K_σ (PERTURBATION) o *BUCKLE · P_cr = 21 × 48.155 = 1011.3 unidades de fuerza; comparar contra Euler π²EI/(KL)²
- fea-lineal-felippa-08 · Cantilever con UN elemento de viga Hermitiano (Ex 13.9) · elemento beam Euler-Bernoulli (beamStiffnessEulerBernoulli) + solve · v_j=PL^3/(3EI), θ_j=PL^2/(2EI) EXACTOS con 1 elemento (cúbica exacta)
- fea-lineal-ccx-04 · Viga B32R de 1 elemento, 100 mm, 2×2 mm², E=100 GPa, F=1 N (CCX §5.14 Tabla 3) · elemento viga cuadrático (o hex20) + lectura en puntos de integración · σ en punto a exacto (M·c/I); δ_tip 10 % alto con 1 elemento; torsión: δ 15 % (Tabla 5)
- fea-lineal-ccx-01 · Cantilever 1×1×8 m, F=9 MN, C3D20R (CCX §5.1) — el "hello world" del solver · hex20 reducido (o el hex8I sobre voxel) + empotramiento de cara + carga en punta · δ_tip vs PL³/(3EI) dentro de 10 % con 1 elemento de espesor (CCX §5.14: "off by 10 %"), <2.4 % con 5
- fea-lineal-felippa-09 · Reglas de Gauss 1D: 1, 2, 3 puntos exactas hasta grado 1, 3, 5 (Ex 13.6) · módulo de cuadratura + gate G19 (suma de pesos=2) · ∫ξ^k en [-1,1] exacto hasta k=2p-1; falla en k=2p

## Brechas vs Fusion / SolidWorks / Ansys

| brecha | pri | qué dice el libro | qué hace la competencia |
|---|---|---|---|
| Elementos: tet4 lineal único (sin hex8I/tet10/hex20, sin shells/beams/axisimétrico) | P0 | CCX golden rule #3: "USE QUADRATIC ELEMENTS"; C3D4 "too stiff"; C3D8I "should be used in all instances in which linear elements are subject to bending"; Felippa E17.8: 1 capa de Q4 da 2 % de la flecha con a=10b | Fusion/SolidWorks/Ansys mallan tet10 por defecto (parabólico), Ansys ofrece hex20/hex8 con modos incompatibles, shells y vigas |
| Sin reacciones ni diagrama de cuerpo libre; sin chequeo de equilibrio | P0 | Felippa §3.4.1: f=K·u recupera reacciones; CCX §5.18: RF exacto (ensamble) vs SOF (malla) | SolidWorks "Result Force", Ansys "Force Reaction" probes y free body diagram por cara |
| Sin condiciones de simetría/rodillo por componente (solo empotrar caras) | P0 | Felippa §8.6 + Ex 8.4; NAFEMS LE1/LE10/LE11 exigen simetría; LE10 "constraints along a line are incompatible with 3D-elasticity" | Fusion/SolidWorks: "Symmetry", "Roller/Slider", "Fixed Geometry" por cara; Ansys frictionless support |
| Malla voxelizada escalonada (no conforma la frontera) → picos falsos en escalones | P0 | Felippa §8.2.1: esquinas entrantes = gradiente alto; Babuška: singularidad → p_obs<1 | Malladores conformes (Delaunay/advancing front) con curvatura y refinamiento local |
| Convergencia de malla informativa, no gate; sin estimador de error ni adaptividad | P1 | NAFEMS: malla mínima = converge dentro del 1 %; CCX §6.12 ZZ + *REFINE MESH; G14 GCI<5 % | SolidWorks h/p-adaptive, Ansys convergence tool sobre un resultado, Fusion "adaptive mesh refinement" |
| Carga por número de nodos (no EbE); sin carga térmica; sin momento/torque remoto | P1 | Felippa §8.3.2 EbE más preciso; NAFEMS LE11 térmico; LE5 par como cortantes distribuidos | Cargas consistentes por cara, remote load/moment, thermal condition importada |
| Sin pandeo lineal ni modal | P1 | CCX §5.2 *BUCKLE / frecuencias con PERTURBATION; Code_Aster R5.01.01 residuo modal <1e−6; masa efectiva 90 % | Fusion/SolidWorks/Ansys: linear buckling (BLF) y modal en el mismo estudio |
| Sin esfuerzo plano/deformación plana general ni axisimétrico sobre croquis | P1 | NAFEMS LE1 (plane stress), LE7/LE8 (axisym); Babuška P1/P2 en plane strain | SolidWorks 2D simplification (plane stress/strain/axisymmetric); Ansys 2D |
| Sin verificación contra NAFEMS ni reporte "target/malla mínima/densa/%" | P1 | NAFEMS: target nombrado antes; reporta la corrida real; <3 % y discretización <1 % | Ansys/Abaqus publican Verification Manuals con casos NAFEMS; SolidWorks Simulation Validation |
| FS ficticio cuando σ_vm>σ_y; sin aviso de régimen | P0 | G15: si SF<1 el resultado lineal no describe la pieza; Autodesk U: umbrales para dejar de ser lineal | Fusion avisa "results exceed yield"; Ansys sugiere no lineal |

## Notas de honestidad

- Todo valor en "respuesta impresa" está literal en el PDF citado (§/Ex/Tabla). Las cadenas vacías = el libro NO imprime la respuesta.
- El PDF NAFEMS del corpus trae SOLO LE1, LE2, LE3, LE5, LE6, LE7, LE8, LE10, LE11 (sin LE4/LE9/FV/T); la geometría exacta vive en figuras rasterizadas — LE5 tiene la posición transversal de A pendiente de NAFEMS Rev.3.
- Richardson/GCI NO están en Babuška-Szabó: son derivados del marco e=C·N^−α (ya marcado así en verificacion/gci.ts, que cita Roache/ASME V&V 20).
- Estado "parcial"/"no" verificado hoy con grep en src/forja/brep/fea.ts, src/lib/formulas.ts, src/forja/verificacion/, src/forja/mold/lamina-vonmises.ts, scripts/fea-*.cjs.
