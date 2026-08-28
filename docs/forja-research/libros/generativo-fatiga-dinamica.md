# Generativo, fatiga y dinamica: topologia (top88), fatiga (fe-safe), modal (masa efectiva), pandeo (MIT) y multicuerpo (Schwab/Featherstone)

**Fuentes:** Manuales P0-P2: top88 (Andreassen et al. 2011), fe-safe Fatigue Theory Vol.2, Irvine Effective Modal Mass, Schwab/van der Linde Multibody Dynamics B, Featherstone & Orin Dynamics (Springer Handbook), Code_Aster R5.01.01, MIT 2.080 Lec.9

**El autor como cliente:** Un ingeniero de simulacion que exige que cada solver se pruebe contra un numero PUBLICADO antes de creerle: la MBB de 88 lineas, los 881/75.2/574 de fe-safe, los 4.78/12.4 Hz de Irvine, el pi^2 EI/l^2 de Euler y el drift del pendulo doble. No acepta "compila": acepta "reproduce la tabla".

## Capitulos / fuentes

| # | Fuente | Ejercicios | Cubierto | Nota |
|---|---|---|---|---|
| 1 | top88 — SIMP/OC con filtros de sensibilidad, densidad, Heaviside y PDE (MBB) | 8 | parcial | topopt.ts es top88 literal en 3D voxel (SIMP+OC+filtros+passive+voladizo); falta Heaviside, benchmark MBB 2D y prueba de independencia de malla |
| 2 | fe-safe Vol.2 — S-N, Miner, medias (Goodman/Gerber), e-N con memoria, Neuber, multiaxial, estadistica | 12 | no | solo basquinSN/goodmanFatigueSafety en src/lib/formulas.ts con Se=0.5Sut y f=0.9 hardcodeados; nada de rainflow/Miner/e-N/plano critico |
| 3 | Irvine — masa efectiva y factores de participacion (2-GDL, avionica 6-GDL, vigas, barra FE) | 7 | no | fea.ts no ensambla matriz de masa; solo naturalFrequency 1-GDL en formulas.ts |
| 4 | Schwab/van der Linde — Newton-Euler con restricciones (DAE), Lagrange, TMT, drift | 6 | no | dinamica.ts es estatica (armStatics/vehicleDynamics); fourbar.ts es cinematica pura |
| 5 | Featherstone & Orin — algebra espacial, RNEA, ABA, CRBA, lazos cerrados | 6 | no | sin RNEA/CRBA/ABA en src/forja/mech (grep rnea|RNEA = 0 hits); grublerMobility si (armgen.ts) |
| 6 | Code_Aster R5.01.01 — solvers modales (Lanczos, IRAM, Bathe-Wilson, QZ), Sturm, bandas | 4 | no | no hay eigen-solver en fea.ts/occt.ts (solo eigen 3x3 del tensor de inercia) |
| 7 | MIT 2.080 Lec.9 — estabilidad elastica: Euler, Rayleigh-Ritz, imperfecciones, esbeltez | 5 | parcial | eulerBucklingLoad con 4 condiciones (formulas.ts:904); falta pandeo por eigenvalores [K+lambda Ks] y Johnson |

## Catalogo de ejercicios / benchmarks (48)

| id | titulo | herramientas | oraculo | respuesta impresa | tipo | valor |
|---|---|---|---|---|---|---|
| `generativo-fatiga-dinamica-top88-01` | Media viga MBB 60x20, volfrac 0.5, penal 3, rmin 2.4, filtro de sensibilidad (ft=1) | generativo SIMP+OC, filtro sensibilidad | topologia = Fig.3(a) arriba (2 diagonales + cordon superior); mean(xPhys)=0.5 +-1e-3 en cada iteracion; c monotono decreciente | Fig. 3 (top88 §3.6) — imagen, sin numero impreso | cad | 5 |
| `generativo-fatiga-dinamica-top88-02` | MBB 60x20 con filtro de densidad (ft=2) | generativo SIMP+OC, filtro densidad | topologia = Fig.3(a) abajo; borde gris de ancho ~rmin; volumen 0.5 exacto sobre xPhys (no sobre x) | Fig. 3 (abajo) | cad | 4 |
| `generativo-fatiga-dinamica-top88-03` | Independencia de malla: MBB 60x20 / 150x50 / 300x100 con rmin escalado (0.04*nelx) | generativo SIMP, refinamiento | misma topologia (numero de barras) en las 3 mallas (Fig.3 a/b/c); sin checkerboard | Fig. 3 a/b/c; Tabla 1 tiempos/iteracion | cad | 4 |
| `generativo-fatiga-dinamica-top88-04` | MBB con proyeccion Heaviside (beta se dobla cada 50 iter o al converger) | generativo SIMP + Heaviside | diseño casi 0/1: fraccion de celdas con 0.1<x<0.9 < 5%; topologia = Fig.5 | Fig. 5; Tabla 3 tiempos | cad | 4 |
| `generativo-fatiga-dinamica-top88-05` | Variante con filtro PDE (Helmholtz) en vez de kernel H | generativo SIMP, filtro PDE | misma topologia que ft=2 (Fig.4); volumen conservado (el filtro PDE preserva volumen) | Fig. 4 | cad | 2 |
| `generativo-fatiga-dinamica-top88-06` | Cantilever 3D (test de rigor de La Forja: invariantes I1-I5) | generativo SIMP 3D voxel | I1 c baja; I2 mean(xPhys)=volfrac; I3 change<=tol; I4 0<=x<=1; I5 void real >0 |  | cad | 4 |
| `generativo-fatiga-dinamica-top88-07` | 6 piezas reales (mensula, brazo, base motor, cartabon, columna excentrica, viga biempotrada) | generativo SIMP 3D + malla suave | 6/6 invariantes; compliance -70..-93%; volumen objetivo +-3e-4 (docs/forja-research/generativo-piezas-reales.md) |  | cad | 4 |
| `generativo-fatiga-dinamica-top88-08` | Elementos pasivos (keep-in/keep-out) y cargas multiples (extensiones §3.7 del paper) | generativo SIMP, passive, multi-load | celdas void quedan x=0 y solid x=1 en TODAS las iteraciones; c = suma de compliances por caso |  | cad | 3 |
| `generativo-fatiga-dinamica-fesafe-01` | Ej 1.1 Miner: 10 ciclos a 100 kN (N=1e4) + 2000 ciclos a 10 kN (N=1e6) | fatiga S-N, Miner | D = 0.001 + 0.002 = 0.003 por bloque -> 333 repeticiones | 333 repeticiones (fe-safe Vol.2 §1, Ej 1.1, p.1-5) | cae | 5 |
| `generativo-fatiga-dinamica-fesafe-02` | Ej 2.1 historial de deformacion local A..F en SAE1045 (sf=948, b=-0.092, K=1258, n=0.208, ef=0.26, c=-0.445, E=202000) | fatiga e-N, Ramberg-Osgood ciclico, memoria de material, rainflow, Coffin-Manson, SWT | esfuerzos en A..F = 321.1/-225.2/189.9/-301.1/239.1/-176 MPa; 3 ciclos cerrados (B-C, E-F, A-D); vida e-N = 85,500 repeticiones; daño SWT = 1.273e-5 | 85500 repeticiones (strain-life); 1.273e-5 daño SWT (§2.7, Ej 2.1, p.2-20..2-21) | cae | 5 |
| `generativo-fatiga-dinamica-fesafe-03` | Daño S-N sin correccion de media: Sa=800*Nf^-0.086, espectro rainflow de 6 niveles (340..190 MPa) | fatiga S-N, Miner, histograma | D = 1.135e-3 -> 881 repeticiones del espectro | 881 repeticiones (§5.3, p.5-10) | cae | 5 |
| `generativo-fatiga-dinamica-fesafe-04` | Mismo espectro con correccion Goodman (Sao = Sa/(1-Sm/UTS), UTS~800) | fatiga S-N, Goodman | D = 1.329e-2 -> 75.2 repeticiones | 75.2 repeticiones (§5.3, p.5-10) | cae | 5 |
| `generativo-fatiga-dinamica-fesafe-05` | Mismo espectro con correccion Gerber (Sao = Sa/(1-(Sm/UTS)^2)) | fatiga S-N, Gerber | D = 1.740e-3 -> 574 repeticiones | 574 repeticiones (§5.3, p.5-11) | cae | 4 |
| `generativo-fatiga-dinamica-fesafe-06` | Ej 7.1 biaxial: e1 0->800 ue con transversal restringida, nu=0.3 | fatiga multiaxial, Mohr 3D | e3 = -343 ue; gamma_max = 1140 ue; e_n = 229 ue | e3=-343, gmax=1140, en=229 ue (§7.4, Ej 7.1, p.7-26) | cae | 4 |
| `generativo-fatiga-dinamica-fesafe-07` | Ej 7.2 torsion pura gamma 0->800 ue | fatiga multiaxial | e1 = +400 ue, e2 = -400 ue | e1=400, e2=-400 ue (Ej 7.2, p.7-27) | cae | 3 |
| `generativo-fatiga-dinamica-fesafe-08` | Ej 7.3 torsion + directa en fase (ex y gxy 0->800 ue) | fatiga multiaxial, plano critico | plano critico = donde el daño (Brown-Miller) es maximo; combinacion coherente con 7.1+7.2 | (Ej 7.3, p.7-28: procedimiento, sin numero final en el texto extraido) | cae | 3 |
| `generativo-fatiga-dinamica-fesafe-09` | Ej 9.1 estadistica: 9 probetas (2.0..4.2 x1e5 ciclos), p=k/(n+1) | fatiga estadistica, log-normal | vida media 2.95e5 ciclos (log10=5.47); desv. std log s = 0.12 | 2.95e5 ciclos, s=0.12 (§9.2, Ej 9.1) | cae | 3 |
| `generativo-fatiga-dinamica-fesafe-10` | Regla de Neuber en entalla con Kt (§2.9): S nominal -> hiperbola Kt^2 S e = sigma eps sobre R-O ciclico | fatiga e-N, Neuber | punto (sigma,eps) satisface sigma*eps = (Kt*S)^2/E y la curva R-O simultaneamente (residuo < 1e-6) |  | cae | 4 |
| `generativo-fatiga-dinamica-fesafe-11` | §8.3 modelo FE elastico lineal + historial de carga unitario -> mapa nodal de vida | fatiga sobre FEA, superposicion | vida minima en el nodo de sigma max; en carga constante coincide con calculo a mano (Ej 5.x) |  | cae | 5 |
| `generativo-fatiga-dinamica-fesafe-12` | §4.2 conteo rainflow del historial del Ej 2.1 | rainflow | 3 ciclos: B-C (0.0024), E-F (0.0024), A-D (0.0055); conteo ASTM E1049 identico | 3 ciclos (Fig. 2.33) | cae | 4 |
| `generativo-fatiga-dinamica-irvine-01` | 2-GDL m1=2, m2=1 kg; k1=1000, k2=2000, k3=3000 N/m | modal GEP, masa efectiva | f1=4.78 Hz, f2=12.4 Hz; meff = 2.944 + 0.056 = 3.0 kg (100% de la masa) | f1=4.78, f2=12.4 Hz; meff1=2.944, meff2=0.056 kg (Irvine Ec.12,15,30,32) | cae | 5 |
| `generativo-fatiga-dinamica-irvine-02` | Apendice A: componente de avionica sobre aisladores (6 GDL cuerpo rigido) M=4.28 lbm, Jx=44.9, Jy=39.9, Jz=18.8 lbm in^2 | modal 6-GDL, masa efectiva por eje | frecuencias 7.338/12.02/27.04/27.47/63.06/83.19 Hz; masa modal total x=y=z=0.0111 lbf s^2/in | 7.338..83.19 Hz; total 0.0111 (App. A) | cae | 4 |
| `generativo-fatiga-dinamica-irvine-03` | Tabla D-1 viga simplemente apoyada: masa efectiva por modo | modal viga Euler-Bernoulli | meff_n = 8 rho L/(n^2 pi^2) modos impares, 0 pares; 7 modos = 95% de la masa | 8/pi^2 rho L modo 1; 95% con 7 modos (Tabla D-1) | cae | 4 |
| `generativo-fatiga-dinamica-irvine-04` | Tabla D-2 viga empotrada-libre: beta1=1.87510, meff1=0.6131 rho L | modal viga en voladizo | participacion 0.7830/0.4339/0.2544/0.1818 sqrt(rho L); meff 0.6131/0.1883/0.06474/0.03306 rho L; 4 modos=90% | 0.6131 rho L; 90% con 4 modos (Tabla D-2) | cae | 5 |
| `generativo-fatiga-dinamica-irvine-05` | Tabla E-1 barra fija-libre longitudinal: meff1 = 8 rho L/pi^2 | modal barra axial | meff_n = 8 rho L/((2n-1)^2 pi^2) | 8/pi^2 (Tabla E-1) | cae | 3 |
| `generativo-fatiga-dinamica-irvine-06` | Apendice F: barra de aluminio D=1 in, L=48 in, 4 elementos FE con masa consistente | modal FE, masa consistente, participacion | fn = 1029.9/3248.8/5901.6/8534.3 Hz; meff = 0.0075/0.0005/0.0001/0.0000; total 3.14 lbm = 83% de 3.77 lbm | 1029.9 Hz ...; 83% de la masa (App. F) | cae | 5 |
| `generativo-fatiga-dinamica-irvine-07` | Regla de truncamiento: modos hasta capturar >=90% de la masa efectiva total | modal, criterio de truncamiento | suma(meff)/M_total >= 0.9 decide cuantos modos guardar | >= 90% (Irvine p.1) | cae | 3 |
| `generativo-fatiga-dinamica-schwab-01` | Ej 1 cap.1: pendulo doble por Newton-Euler + restricciones (DAE indice 3), integrador de Euler dt=0.1/0.05/0.02/0.01 s, 0.5 s | multicuerpo DAE, Newton-Euler, integracion | DRIFT: las juntas A y B se abren; |Phi| a t=0.5 s decrece con dt (~O(dt)); configuracion final distinta por dt (Fig. cap.1 p.1-12) | Fig. 1-12: las juntas se abren; los gaps bajan con dt | cae | 5 |
| `generativo-fatiga-dinamica-schwab-02` | Ej 2 cap.2: pendulo doble en coordenadas generalizadas (phi1, phi2) por Lagrange | multicuerpo Lagrange | cero drift (restricciones cumplidas por construccion); energia total conservada < 1e-6 relativo con RK4 |  | cae | 5 |
| `generativo-fatiga-dinamica-schwab-03` | Ej 3 cap.1: cuerpo rigido (m, J) con restriccion, x=[l/2,0,0]: matriz de restricciones D y su transpuesta = fuerzas | multicuerpo, jacobiano de restricciones | columnas de D_k,i son fuerzas aplicadas; rank(Phi_q) = numero de restricciones independientes |  | cae | 3 |
| `generativo-fatiga-dinamica-schwab-04` | Ej 1 cap.2: grua de contenedores (carro x + pendulo phi, masa puntual) | multicuerpo Lagrange, 2 GDL | EoM (vb1.6..): [m, ml cos phi; ml cos phi, ml^2][x..;phi..] + ... ; linealizado con carro fijo: omega = sqrt(g/l) | T = 1/2 m(x.^2 + 2 x. l phi. cos phi + l^2 phi.^2), V = -mgl cos phi (vb1.4-1.5) | cae | 4 |
| `generativo-fatiga-dinamica-schwab-05` | Cap.3 TMT: mismo pendulo doble por transformacion T^T M T | multicuerpo TMT | aceleraciones identicas a Newton-Euler (cap.1) y Lagrange (cap.2) en t=0 (< 1e-9) |  | cae | 4 |
| `generativo-fatiga-dinamica-schwab-06` | Estabilizacion de Baumgarte sobre el DAE del Ej 1 (Featherstone §2.6 la declara) | multicuerpo DAE + Baumgarte | |Phi| acotado (< 1e-6) durante 10 s; sin Baumgarte crece |  | cae | 4 |
| `generativo-fatiga-dinamica-feather-01` | RNEA (Alg. §2.5.1): dinamica inversa del pendulo doble planar | robotica RNEA, dinamica inversa | tau(q,qd,qdd) = Lagrange cerrado de Schwab Ej 2 (< 1e-9) |  | cae | 5 |
| `generativo-fatiga-dinamica-feather-02` | CRBA (§2.5.3): matriz de masa H del brazo de 3 eslabones de La Forja | robotica CRBA | H simetrica, definida positiva; cond(H) reportado por paso (alerta §2.7.5 O(n^4)) |  | cae | 4 |
| `generativo-fatiga-dinamica-feather-03` | ABA (§2.5.2): dinamica directa O(n) vs qdd = H^-1(tau - C) | robotica ABA | qdd identicas (< 1e-9) para n=3 y n=7; costo lineal en n |  | cae | 3 |
| `generativo-fatiga-dinamica-feather-04` | Humanoide Fig.2.3 / Tablas 2.2-2.3: conectividad, lazos cerrados y raices de lazo | estructura de datos de mecanismo | tabla de padres lambda(i), juntas que cierran lazo y raices coinciden con Tablas 2.2-2.3 | Tablas 2.2 y 2.3 (conectividad del humanoide) | cae | 2 |
| `generativo-fatiga-dinamica-feather-05` | Lazo cerrado §2.6: cicloidal print-in-place como mecanismo con restriccion de lazo | robotica lazo cerrado, Baumgarte | restriccion de lazo cumplida (< 1e-6) durante 1 vuelta; par de salida = tau_in * i (11:1) |  | cae | 4 |
| `generativo-fatiga-dinamica-feather-06` | Tabla 2.1 aritmetica espacial: transformacion X e inercia espacial con ejes paralelos | algebra espacial 6x6 | I_espacial de un solido occt = [Ic + m c x c x^T, m c x; m c x^T, m 1] con Ic del kernel (masa-inercia) | Tabla 2.1 | cae | 3 |
| `generativo-fatiga-dinamica-aster-01` | Test de Sturm: numero de modos bajo sigma = pivotes negativos de LDL^T(K - sigma M) | modal, Sturm | cuenta de Sturm = modos encontrados en la banda (rod FE de Irvine: 4 bajo 9000 Hz, 2 bajo 4000 Hz) |  | cae | 4 |
| `generativo-fatiga-dinamica-aster-02` | Lanczos shift-invert (TRI_DIAG) vs QZ/Jacobi sobre el GEP 4x4 del rod de Irvine | modal, Lanczos | frecuencias identicas a QZ (< 1e-6 rel) = 1029.9/3248.8/5901.6/8534.3 Hz |  | cae | 4 |
| `generativo-fatiga-dinamica-aster-03` | OPTION=BANDE partida en sub-bandas: union de los modos por sub-banda = espectro completo | modal, bandas | sin modos repetidos ni faltantes (Sturm por sub-banda) |  | cae | 2 |
| `generativo-fatiga-dinamica-aster-04` | Bathe & Wilson (JACOBI) iteracion de subespacio: tests de convergencia §8.2 | modal, subespacio | convergencia monotona de cada eigenvalor; error < 1e-8 vs Lanczos |  | cae | 2 |
| `generativo-fatiga-dinamica-mit-01` | Columna pin-pin: Pc = pi^2 EI/l^2, sigma_c = pi^2 E/beta^2, beta_c = pi sqrt(E/sigma_y) | pandeo lineal [K + lambda Ks], Euler | lambda1 * P_aplicada = Pc de Euler (< 2% con 20 elementos); sigma_c vs beta hiperbola Fig. 9.12 | Ec. 9.68-9.70 | cae | 5 |
| `generativo-fatiga-dinamica-mit-02` | Cociente de Rayleigh-Ritz con forma de prueba (Ec. 9.27): cota superior | pandeo energetico | Nc(phi) >= Pc exacto; con phi = sin(pi x/l) da exactamente pi^2 EI/l^2 | Ec. 9.27: siempre cota superior | teoria | 3 |
| `generativo-fatiga-dinamica-mit-03` | Columna imperfecta (angulo theta0 / curvatura inicial): amplificacion 1/(1 - P/Pc) | pandeo no lineal, imperfeccion | w_max = w0/(1-P/Pc); familia de curvas Fig. 9.8; sin bifurcacion, punto limite | Fig. 9.8; factor 1/(1-P/Pc) | cae | 4 |
| `generativo-fatiga-dinamica-mit-04` | Columna de Euler discreta (barra rigida + resorte rotacional, Fig. 9.3): bifurcacion y trayectoria secundaria | estabilidad, energia potencial | delta^2 Pi cambia de signo en Pc; trayectoria secundaria Fig. 9.5 | Fig. 9.2-9.5 | teoria | 2 |
| `generativo-fatiga-dinamica-mit-05` | Estriccion de Considere (Ec. 9.66): sigma = dsigma/deps en el maximo de carga | plasticidad, inestabilidad material | instante de estriccion = donde la tangente de la curva sigma-eps verdadera iguala sigma | Ec. 9.66 | teoria | 1 |

## Features (estado verificado con grep/ls)

| feature | que hace | estado | prioridad | donde | ejercicios |
|---|---|---|---|---|---|
| SIMP + OC + filtros (sensibilidad/densidad) sobre voxeles 3D | top88 literal: E_e=Emin+x^p(E0-Emin), sensibilidad, OC con biseccion, filtro H con rmin/minMemberMm, passive keep-in/out, filtro de voladizo AM | si | P0 | src/forja/brep/topopt.ts:runTopOpt, src/forja/brep/topopt-am.ts:amOverhangFilter/passiveMask; UI ForgeBRepStudio.tsx:GenerativeVoxels/GenerativeSurface; scripts/topopt-node-test.cjs, scripts/generative-farm.cjs | top88-01, top88-02, top88-06, top88-07, top88-08 |
| Proyeccion Heaviside (beta continuation) y filtro PDE | diseño 0/1 nitido (§3.5 top88) y filtro Helmholtz volumen-preservante | no | P1 | grep -i heaviside src/forja/brep/topopt.ts = 0 hits | top88-04, top88-05 |
| Benchmark MBB 2D + prueba de independencia de malla | reproducir Fig.3 a/b/c del paper (60x20, 150x50, 300x100) con rmin escalado y contar barras | parcial | P0 | solo cantilever 3D (scripts/topopt-node-test.cjs I1-I5); sin MBB ni escalera de mallas | top88-01, top88-03 |
| Optimizador MMA / TO con restriccion de pandeo (KS) | sustituir OC por MMA y agregar lambda_pandeo >= lambda_min via Kreisselmeier-Steinhauser (Ferrari-Sigmund-Guest) | no | P2 | no existe | mit-01 |
| Motor de fatiga S-N: Basquin parametrizado, Marin, Goodman/Gerber/Soderberg/SWT/Walker, Miner | Sa=A*Nf^b de datos, correccion de media, daño por bloque y vida en repeticiones | parcial | P0 | src/lib/formulas.ts:basquinSN (Se=0.5Sut, f=0.9 fijos), goodmanFatigueSafety; sin Miner ni Gerber ni Marin | fesafe-01, fesafe-03, fesafe-04, fesafe-05 |
| Rainflow (ASTM E1049) sobre historial de esfuerzo/deformacion | conteo de ciclos cerrados con memoria de material; histograma Sa/Sm/n | no | P0 | grep -ri rainflow src/ = 0 hits | fesafe-12, fesafe-03 |
| Fatiga e-N: Ramberg-Osgood ciclico, lazos de histeresis (Masing), Coffin-Manson, SWT, Neuber | seguir A..F por la curva ciclica y sus lazos, cerrar ciclos, vida por strain-life y SWT; entalla por Neuber | no | P1 | no existe (pliego-shigley H1 lo pide como src/forja/maquinas/fatiga.ts) | fesafe-02, fesafe-10 |
| Fatiga multiaxial: Mohr 3D de deformaciones, Brown-Miller, plano critico, Dang Van | e3 por Poisson efectivo, gamma_max, eps_n; daño por plano | no | P2 | no existe | fesafe-06, fesafe-07, fesafe-08 |
| Fatiga sobre el FEA existente (mapa nodal de vida) | carga unitaria en prepareFeaSession + historial -> sigma(t) por nodo -> rainflow+S-N -> mapa de vida (fe-safe §8.3) | parcial | P1 | infra si: src/forja/brep/fea.ts:prepareFeaSession/solveLoadOnSession; capa de fatiga no | fesafe-11 |
| Estadistica de fatiga (log-normal / Weibull, p=k/(n+1)) | vida media y desviacion log de probetas; vida a probabilidad de falla | no | P2 | no existe | fesafe-09 |
| Matriz de masa consistente + eigensolver GEP (Lanczos shift-invert / Jacobi) + test de Sturm | K phi = w^2 M phi sobre la malla tet4 de fea.ts; banda de frecuencias con verificacion de Sturm | no | P0 | fea.ts sin masa (grep massMatrix|lumped = 0); occt.ts solo eigen 3x3 de inercia | irvine-06, aster-01, aster-02, aster-03, aster-04 |
| Masa efectiva y factores de participacion (truncamiento >= 90%) | Gamma_i = phi^T M r, meff = Gamma^2/m_i por eje; suma = masa total | no | P0 | formulas.ts:naturalFrequency es 1-GDL | irvine-01, irvine-02, irvine-03, irvine-04, irvine-05, irvine-07 |
| Pandeo lineal por eigenvalores [K + lambda Ks] + Euler/Johnson | rigidez geometrica de la solucion estatica, lambda1 = BLF; verificar con Euler pin-pin y esbeltez critica | parcial | P0 | src/lib/formulas.ts:eulerBucklingLoad (4 condiciones); sin Ks ni eigen | mit-01, mit-02, mit-03 |
| Multicuerpo DAE: Newton-Euler + restricciones, Lagrange, TMT, Baumgarte | [M Phi_q^T; Phi_q 0][qdd; lambda] = [Q; gamma], integradores, medicion de drift, cross-check por 3 formulaciones | no | P1 | src/forja/mech/dinamica.ts = estatica (armStatics/vehicleDynamics); fourbar.ts cinematica | schwab-01, schwab-02, schwab-03, schwab-04, schwab-05, schwab-06 |
| RNEA / CRBA / ABA (algebra espacial de Featherstone) | tau requerido por eslabon, matriz H con cond(H), dinamica directa O(n); lazos cerrados para el cicloidal | no | P1 | grep -rn "rnea|RNEA" src/forja/mech = 0; armgen.ts:grublerMobility si | feather-01, feather-02, feather-03, feather-05, feather-06 |
| Lecciones de escuela (video 4K con voz) para generativo/fatiga/modal/pandeo/MBD | public/escuela/lecciones/*.json + clase-drive.cjs | no | P1 | ls public/escuela/lecciones: mec-u*, mol-s*, a1-l*; ninguna de topologia/fatiga/modal | top88-01, fesafe-01, irvine-01, mit-01, schwab-01 |

## Supertickets (lineas listas para pegar en `ordenes/<fecha>-<slug>.md`)

### `generativo-fatiga-dinamica-top88-mbb` — La viga MBB: el generativo se mide contra el paper de 88 lineas

- Capitulos: [1] · Esfuerzo: M · Valor: 5/5 · Sprint: 1
- Objetivo: Reproducir top88 §3.6 (Fig.3/5) DENTRO del generativo de La Forja: MBB 60x20/150x50/300x100, filtros de sensibilidad, densidad y Heaviside; independencia de malla y diseño 0/1, con volumen exacto por iteracion.
- Ya existe: src/forja/brep/topopt.ts:runTopOpt (SIMP+OC+ft 1|2+passive+voladizo); scripts/topopt-node-test.cjs (cantilever 3D I1-I5); scripts/generative-farm.cjs (6 piezas 6/6); ForgeBRepStudio.tsx:GenerativeVoxels/GenerativeSurface
- Dependencias: malla 2D-en-3D de 1 voxel de espesor o modo plano en fea.ts; Heaviside beta continuation en topopt.ts

```
## EJERCICIOS
- generativo-fatiga-dinamica-top88-01 · MBB 60x20 ft=1 · generativo SIMP+OC, filtro sensibilidad, rmin 2.4 · topologia Fig.3a arriba; mean(xPhys)=0.5+-1e-3; c monotono · impreso: Fig.3
- generativo-fatiga-dinamica-top88-02 · MBB 60x20 ft=2 (densidad) · generativo, filtro densidad · topologia Fig.3a abajo; volumen sobre xPhys = 0.5 · impreso: Fig.3
- generativo-fatiga-dinamica-top88-03 · Escalera de mallas 60x20/150x50/300x100, rmin=0.04 nelx · generativo, refinamiento · mismo numero de barras en las 3 mallas; sin checkerboard · impreso: Fig.3 a/b/c
- generativo-fatiga-dinamica-top88-04 · Heaviside con beta doblado cada 50 iter · generativo + Heaviside · celdas grises (0.1<x<0.9) < 5%; topologia Fig.5 · impreso: Fig.5
- generativo-fatiga-dinamica-top88-08 · Keep-out + 2 casos de carga · generativo passive/multiload · void permanece 0 en todas las iteraciones; c = suma por caso
- generativo-fatiga-dinamica-top88-06 · Cantilever 3D I1-I5 (regresion) · generativo 3D voxel · I1..I5 verdes en scripts/topopt-node-test.cjs
```

### `generativo-fatiga-dinamica-fesafe-sn` — Fatiga S-N: Miner, Goodman y Gerber contra los ejemplos de fe-safe

- Capitulos: [2] · Esfuerzo: M · Valor: 5/5 · Sprint: 1
- Objetivo: Motor de fatiga esfuerzo-vida con curva Sa=A Nf^b de DATOS (no Se=0.5Sut fijo), correccion de media y daño acumulado; los 3 numeros impresos de fe-safe §5.3 (881 / 75.2 / 574) y el 333 del Ej 1.1 salen exactos.
- Ya existe: src/lib/formulas.ts:basquinSN (Se=0.5Sut, f=0.9 hardcodeados — corregir, no extender); src/lib/formulas.ts:goodmanFatigueSafety; src/forja/brep/fea.ts:prepareFeaSession/solveLoadOnSession (N cargas sobre una K)
- Dependencias: modulo nuevo src/forja/maquinas/fatiga.ts (pliego-shigley H1) — CREA declarado en la orden; comandos fatiga.* en registry.ts

```
## EJERCICIOS
- generativo-fatiga-dinamica-fesafe-01 · Ej 1.1 Miner dos bloques · fatiga S-N, Miner · 333 repeticiones · impreso: 333 (p.1-5)
- generativo-fatiga-dinamica-fesafe-03 · Espectro 6 niveles sin correccion · fatiga S-N, Miner · D=1.135e-3 -> 881 · impreso: 881 (p.5-10)
- generativo-fatiga-dinamica-fesafe-04 · Espectro con Goodman · fatiga S-N, Goodman · D=1.329e-2 -> 75.2 · impreso: 75.2 (p.5-10)
- generativo-fatiga-dinamica-fesafe-05 · Espectro con Gerber · fatiga S-N, Gerber · D=1.740e-3 -> 574 · impreso: 574 (p.5-11)
- generativo-fatiga-dinamica-fesafe-12 · Rainflow del historial A..F · rainflow ASTM E1049 · 3 ciclos B-C, E-F, A-D · impreso: Fig.2.33
- generativo-fatiga-dinamica-fesafe-09 · Ej 9.1 estadistica de 9 probetas · log-normal, p=k/(n+1) · media 2.95e5, s=0.12 · impreso: 2.95e5; 0.12
- generativo-fatiga-dinamica-fesafe-11 · Mapa de vida sobre el FEA (carga unitaria + historial) · fatiga sobre fea.ts · vida minima en nodo de sigma max = calculo a mano
```

### `generativo-fatiga-dinamica-fesafe-en` — Fatiga e-N: el lazo de histeresis con memoria, Neuber y biaxial (Ej 2.1 y 7.x)

- Capitulos: [2] · Esfuerzo: L · Valor: 4/5 · Sprint: 2
- Objetivo: Deformacion-vida local: Ramberg-Osgood ciclico, lazos de Masing con memoria de material, cierre de ciclos, Coffin-Manson y SWT, Neuber en entalla y Mohr 3D de deformaciones; el Ej 2.1 de fe-safe reproduce los 6 esfuerzos y 85,500 repeticiones.
- Ya existe: nada de e-N en el repo (verificado: grep Coffin|Neuber|rainflow src/ = 0)
- Dependencias: generativo-fatiga-dinamica-fesafe-sn (motor S-N y rainflow); propiedades ciclicas sf,b,ef,c,K,n en MATERIAL_DATABASE (pliego-shigley H13)

```
## EJERCICIOS
- generativo-fatiga-dinamica-fesafe-02 · Ej 2.1 SAE1045 A..F · e-N, R-O ciclico, memoria, Coffin-Manson, SWT · 321.1/-225.2/189.9/-301.1/239.1/-176 MPa; 85,500 rep; D_SWT=1.273e-5 · impreso: 85500; 1.273e-5 (p.2-21)
- generativo-fatiga-dinamica-fesafe-10 · Neuber en entalla con Kt · Neuber + R-O · sigma*eps=(Kt S)^2/E y R-O simultaneos, residuo<1e-6
- generativo-fatiga-dinamica-fesafe-06 · Ej 7.1 directa con transversal restringida · Mohr 3D deformaciones · e3=-343, gmax=1140, en=229 ue · impreso: p.7-26
- generativo-fatiga-dinamica-fesafe-07 · Ej 7.2 torsion pura · Mohr · e1=400, e2=-400 ue · impreso: p.7-27
- generativo-fatiga-dinamica-fesafe-08 · Ej 7.3 combinado en fase · plano critico Brown-Miller · plano de daño maximo coherente con 7.1+7.2
- generativo-fatiga-dinamica-fesafe-12 · Rainflow con memoria = mismos 3 ciclos · rainflow · B-C, E-F, A-D · impreso: Fig.2.33
```

### `generativo-fatiga-dinamica-modal-irvine` — Modal con masa efectiva: del 2-GDL de Irvine a la barra FE y la avionica

- Capitulos: [3, 6] · Esfuerzo: L · Valor: 5/5 · Sprint: 2
- Objetivo: Ensamblar la matriz de masa consistente en fea.ts, resolver K phi = w^2 M phi (Lanczos shift-invert + Sturm) y reportar participacion y masa efectiva por eje con regla del 90%; los numeros de Irvine salen literales.
- Ya existe: src/lib/formulas.ts:naturalFrequency (1-GDL), beamNaturalFrequency; src/forja/brep/fea.ts:sparseCG/K tet4 (sin M); occt.ts masa-inercia (eigen 3x3)
- Dependencias: matriz de masa consistente tet4 en fea.ts; eigensolver (Lanczos + LDL^T) nuevo

```
## EJERCICIOS
- generativo-fatiga-dinamica-irvine-01 · 2-GDL m=2,1 k=1000,2000,3000 · GEP, masa efectiva · 4.78 y 12.4 Hz; meff 2.944+0.056=3 kg · impreso: Ec.12,15,30,32
- generativo-fatiga-dinamica-irvine-06 · Barra Al 1in x 48in, 4 elementos · masa consistente, GEP · 1029.9/3248.8/5901.6/8534.3 Hz; 83% de 3.77 lbm · impreso: App.F
- generativo-fatiga-dinamica-irvine-04 · Viga empotrada-libre (tet4 de fea.ts) · modal 3D · beta1=1.87510 (<2%); meff1 ~0.6131 rho L; 4 modos >= 90% · impreso: Tabla D-2
- generativo-fatiga-dinamica-irvine-03 · Viga simplemente apoyada · modal 3D · meff1 = 8/pi^2 rho L; pares = 0 · impreso: Tabla D-1
- generativo-fatiga-dinamica-irvine-02 · Avionica 6-GDL sobre aisladores · cuerpo rigido + resortes · 7.338..83.19 Hz; total 0.0111 por eje · impreso: App.A
- generativo-fatiga-dinamica-aster-01 · Test de Sturm sobre el rod · LDL^T(K - sigma M) · pivotes negativos = modos bajo sigma
- generativo-fatiga-dinamica-aster-02 · Lanczos shift-invert vs QZ · eigensolver · frecuencias identicas <1e-6 rel
```

### `generativo-fatiga-dinamica-pandeo-mit` — Pandeo por eigenvalores: Euler, Rayleigh-Ritz e imperfeccion (MIT 2.080 Lec.9)

- Capitulos: [7, 1] · Esfuerzo: L · Valor: 4/5 · Sprint: 3
- Objetivo: Rigidez geometrica Ks de la solucion estatica y [K + lambda Ks] phi = 0 sobre la malla de fea.ts; verificar contra Euler pin-pin, la esbeltez critica y la amplificacion 1/(1-P/Pc); dejar el gancho para TO con restriccion de pandeo.
- Ya existe: src/lib/formulas.ts:eulerBucklingLoad (4 condiciones); fea.ts estatico lineal (base para Ks)
- Dependencias: generativo-fatiga-dinamica-modal-irvine (eigensolver compartido)

```
## EJERCICIOS
- generativo-fatiga-dinamica-mit-01 · Columna pin-pin FE vs Euler · pandeo lineal, Ks · lambda1 P = pi^2 EI/l^2 (<2%); sigma_c = pi^2 E/beta^2 · impreso: Ec.9.68-9.70
- generativo-fatiga-dinamica-mit-01 · 4 condiciones de extremo (fijo-libre, pin-pin, fijo-pin, fijo-fijo) · pandeo lineal · C = 2, 1, 0.7, 0.5 vs eulerBucklingLoad
- generativo-fatiga-dinamica-mit-02 · Rayleigh-Ritz con phi de prueba · energia · cota superior; sin(pi x/l) exacto · impreso: Ec.9.27
- generativo-fatiga-dinamica-mit-03 · Columna imperfecta · no lineal geometrico · w_max = w0/(1-P/Pc) (<3%) · impreso: Fig.9.8
- generativo-fatiga-dinamica-mit-01 · Esbeltez critica beta_c = pi sqrt(E/sigma_y) · esbeltez · transicion Euler/fluencia en beta_c · impreso: Fig.9.12
- generativo-fatiga-dinamica-top88-06 · Cantilever generativo: BLF del diseño final · generativo + pandeo · lambda1 >= 1 reportado (gancho para TO+pandeo)
```

### `generativo-fatiga-dinamica-mbd-schwab` — Multicuerpo real: el pendulo doble por 3 caminos, drift, grua y RNEA

- Capitulos: [4, 5] · Esfuerzo: XL · Valor: 4/5 · Sprint: 3
- Objetivo: Que dinamica.ts deje de ser estatica: DAE con multiplicadores, Lagrange en coordenadas independientes y TMT dan las MISMAS aceleraciones; el drift se mide y se corrige (Baumgarte); RNEA/CRBA cierran el lazo tau requerido -> brazo/cicloidal.
- Ya existe: src/forja/mech/dinamica.ts:armStatics/vehicleDynamics (estatica); src/forja/mech/armgen.ts:grublerMobility; src/forja/mech/fourbar.ts (cinematica); src/forja/mech/brazo.ts, cycloidal.ts (geometria)
- Dependencias: integrador RK4 + LDL/KKT solver pequeño denso; algebra espacial 6x6 (Tabla 2.1)

```
## EJERCICIOS
- generativo-fatiga-dinamica-schwab-01 · Pendulo doble DAE con Euler dt 0.1..0.01 · Newton-Euler + restricciones · |Phi|(0.5 s) decrece ~O(dt); juntas se abren · impreso: Fig. p.1-12
- generativo-fatiga-dinamica-schwab-02 · Pendulo doble Lagrange (phi1,phi2) · Lagrange · cero drift; energia conservada <1e-6 (RK4)
- generativo-fatiga-dinamica-schwab-05 · Pendulo doble TMT · TMT · qdd(t=0) identicas a DAE y Lagrange <1e-9
- generativo-fatiga-dinamica-schwab-06 · Baumgarte sobre el DAE · estabilizacion · |Phi| < 1e-6 durante 10 s
- generativo-fatiga-dinamica-schwab-04 · Grua de contenedores (carro + pendulo) · Lagrange 2 GDL · EoM vb1.6; omega=sqrt(g/l) con carro fijo · impreso: vb1.4-1.5
- generativo-fatiga-dinamica-feather-01 · RNEA del pendulo doble · dinamica inversa · tau = Lagrange cerrado <1e-9
- generativo-fatiga-dinamica-feather-02 · CRBA del brazo 3 eslabones de La Forja · matriz de masa · H simetrica PD; cond(H) por paso
- generativo-fatiga-dinamica-feather-05 · Cicloidal como lazo cerrado · lazo cerrado + Baumgarte · restriccion de lazo <1e-6 por vuelta; tau_out = 11 tau_in
```

## Brechas vs Fusion / SolidWorks / Ansys

| brecha | prioridad | que dice el libro | que hace la competencia |
|---|---|---|---|
| Analisis modal (frecuencias + modos + masa efectiva) | P0 | Irvine: truncar modos hasta >=90% de masa efectiva; Code_Aster: Lanczos/IRAM con Sturm para no perder modos | Fusion Simulation "Modal Frequencies" y SolidWorks Frequency dan modos y masa participativa; Ansys reporta ratio de masa efectiva por eje. La Forja: 0 (fea.ts sin matriz de masa). |
| Pandeo lineal por eigenvalores | P0 | MIT 2.080: Pc = pi^2 EI/l^2 es el caso de verificacion; imperfecciones bajan la carga real | Fusion "Structural Buckling" y SolidWorks Buckling dan BLF y modo; La Forja solo la formula de Euler 1-D (formulas.ts). |
| Fatiga con rainflow + Miner + correccion de media + e-N | P1 | fe-safe Vol.2: S-N con Goodman/Gerber, e-N con memoria de material y SWT, Neuber en entalla, plano critico | SolidWorks Simulation Fatigue (S-N, Goodman/Gerber/Soderberg, rainflow); Ansys Fatigue Tool / nCode (e-N, multiaxial). Fusion NO tiene fatiga — oportunidad. La Forja: basquin/goodman hardcodeados. |
| Generativo con diseño 0/1 y verificacion contra benchmark publicado | P1 | top88: Heaviside + independencia de malla (Fig.3/5) son la prueba de que el optimizador es correcto | Fusion Generative Design entrega solidos limpios (con voladizo/AM) tras pago de la extension; La Forja ya corre SIMP gratis en CPU con voladizo, pero sin Heaviside ni MBB reproducido. |
| Simulacion de movimiento dinamica (DAE, fuerzas de reaccion, tau requerido) | P1 | Schwab: sin tratar las restricciones a nivel de coordenadas hay drift; Featherstone: RNEA/ABA O(n), cond(H) crece O(n^4) | SolidWorks Motion (ADAMS) y Fusion Event Simulation dan reacciones y pares; La Forja: dinamica.ts estatica y fourbar cinematico. |
| TO con restriccion de pandeo y optimizador MMA | P2 | Digesto §11 (Ferrari-Sigmund-Guest): sensibilidad de eigenvalores + KS | Ninguna suite comercial de escritorio lo ofrece al usuario comun — diferenciador premium. |
