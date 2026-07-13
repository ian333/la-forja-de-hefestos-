# ESCUELA DE AERODINÁMICA — Currícula maestra (Anderson → La Forja)

**Fuentes** (`docs/forja-research/manuales/aero/`):
- **Anderson**, *Fundamentals of Aerodynamics*, 6ª ed. (2017, 20 caps) — **la columna vertebral**, como Bethune lo fue para mecánica. Toda la teoría sale de aquí.
- **Bertin & Cummings**, *Aerodynamics for Engineers*, 6ª ed. (2022, 14 caps) — el complemento APLICADO: capa límite trabajada, high-lift, deltas, diseño de cazas (F-15/F-22/F-35), energía-maneuverabilidad.
- **Raymer**, *Aircraft Design: A Conceptual Approach*, 6ª ed. (2018, 24 caps) — el CAPSTONE: del coeficiente al avión completo (sizing, polar, desempeño).

**Misión:** el curso de aerodinámica COMPLETO como lecciones de La Forja. Cada lección es una clase de
FÍSICA/INGENIERÍA (fórmula real + de dónde sale + qué se rompe si está mal), NO un tutorial de software.
Estilo "desmitificar el número que da miedo": ¿por qué L = 1/2·rho·V²·S·CL? ¿de dónde sale el 2·pi de
CL = 2·pi·alfa? ¿por qué el ala no se cae?

## La regla de oro (heredada de mecánica): UNA lección = UN archivo de datos → TRES salidas

Cada lección vive en `src/escuela/aero/lecciones/<id>.json` (pasos: narración + gestos + checks) y de ahí salen:

1. **CLASE EN VIDEO** — el pipeline de `clase-drive.cjs` maneja el lab real en pantalla mientras Matilda narra.
   Master 4K HEVC 10-bit (MANDATO 4K). YouTube; recortes → reels.
2. **TUTORIAL INTERACTIVO** — el alumno mueve alfa, Re, Mach con SUS manos y ve el flujo responder.
3. **RETO CALIFICADO** — auto-calificación exacta contra teoría o datos publicados.

**El sello de mecánica era "el kernel no miente". El de aerodinámica es "LA FÍSICA NO MIENTE":**
cada lección cierra comparando el número que calculó el alumno contra (a) la solución analítica exacta,
o (b) datos publicados REALES (ordenadas y polares de Abbott & von Doenhoff, apéndices A–D de Anderson,
datos NACA). Los fixtures se transcriben LITERALES del libro — PROHIBIDO inventar curvas o dimensiones
(regla Kazmer). Lo evocativo (humo del NS2D de Stam) se ETIQUETA como cualitativo.

## Las 10 unidades (59 lecciones — mismo tamaño que el libro de mecánica)

### U1 · El lenguaje del aire (Anderson cap 1; Bertin cap 1) — 5 lecciones
| id | Lección | Fuente | Comprobación ("la física no miente") | Estado Forja |
|---|---|---|---|---|
| a1-l1 | Solo hay DOS manos: presión p y cortante tau. TODA fuerza aerodinámica es la integral de p y tau sobre la superficie — no hay magia | And §1.5 | Integrar Cp sobre placa plana inclinada → N' analítico exacto | ⚠️ viz Cp ✅ (`Aerodynamics.tsx`); integrador de superficie = lab chico |
| a1-l2 | El número que da miedo: L = 1/2·rho·V²·S·CL. Buckingham Pi: por qué TODO colapsa en 3 números (CL, Re, M) | And §1.7 | Datos de L a distintas rho, V, S colapsan en UNA curva CL(alfa) | ❌ lab "colapso de datos" (JS puro, chico) |
| a1-l3 | Semejanza: por qué un modelo a escala en túnel PREDICE el avión real (mismo Re, mismo M) + los regímenes de flujo | And §1.8, 1.10-1.11 | Dos flujos con mismo Re y M → mismos coeficientes (test numérico) | ⚠️ mismo lab de a1-l2; NS2D da el cualitativo de Re |
| a1-l4 | La atmósfera estándar ISA: T = 288.15 − 6.5·h [km] hasta 11 km; de ahí sale TODO (rho para la sustentación, a para el Mach) | Bertin §1.2; Raymer Ap. B; And Ap. D | Tabla ISA generada vs valores publicados (Anderson Ap. D, literal) | ❌ `atmosfera.ts` (trivial, una tarde) |
| a1-l5 | Centro de presión y momento de cabeceo: por qué el ala CABECEA y dónde "empuja" la resultante (el cp que se movía volvió locos a los Wright) | And §1.6, 1.13 | x_cp desde la distribución de Cp vs relación M_LE = −x_cp·N' | ⚠️ necesita el integrador de a1-l1 |

### U2 · Las ecuaciones del flujo (Anderson cap 2; Bertin cap 2) — 5 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a2-l1 | El cálculo vectorial que da miedo: gradiente, divergencia, rotacional — qué SIGNIFICAN en un fluido (div = se expande, curl = gira) | And §2.2, 2.12 | div y curl numéricos de campos elementales vs analítico exacto | ✅ `math/modules/calc/VectorFields.tsx` |
| a2-l2 | Continuidad: la masa no se inventa. rho·A·V = const → por qué el aire se ACELERA en el angosto | And §2.4 | Ducto con A variable: A1·V1 = A2·V2 al 0.1% | ⚠️ lab ducto con partículas (motor de partículas ✅) |
| a2-l3 | Momentum: el drag VIVE en la estela. Medir arrastre sin tocar el cuerpo (integral del déficit de velocidad) | And §2.5-2.6 | Wake survey numérico = drag del cuerpo (teorema exacto) | ⚠️ NS2D da la estela; integral de déficit = lab nuevo |
| a2-l4 | Vorticidad y circulación: omega = curl(V), Gamma = integral de V·ds — el número que ES la sustentación | And §2.12-2.13 | Gamma alrededor de un vórtice libre = const (independiente del contorno); omega de rotación sólida = 2·Omega | ⚠️ NS2D calcula omega ✅; integral de línea Gamma = añadir |
| a2-l5 | Función de corriente psi y potencial phi: el flujo como mapa (isolíneas perpendiculares) | And §2.14-2.16 | psi = const y phi = const se cruzan a 90° (test numérico); ambas satisfacen Laplace | ⚠️ sustrato en `ConformalMaps.tsx` + `Aerodynamics.tsx` |

### U3 · Flujo potencial: el LEGO de la aerodinámica (Anderson cap 3; Bertin cap 3) — 6 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a3-l1 | Bernoulli desmitificado: p + 1/2·rho·V² = const — de dónde sale (Euler integrado) y cuándo MIENTE (viscoso, rotacional, compresible) | And §3.2, 3.19 | Derivación numérica: integrar Euler a lo largo de una línea de corriente = Bernoulli exacto | ⚠️ fórmula ya en `Aerodynamics.tsx`; lab Venturi con manómetros ❌ chico |
| a3-l2 | Venturi y Pitot: el túnel de viento subsónico y cómo el avión sabe su velocidad. Qué se rompe si el pitot se tapa: Birgenair 301, AF447 | And §3.3-3.4, IWC 3.23 | V medida por q = 1/2·rho·V² vs V real del campo; diseño conceptual del túnel (IWC de Anderson) reproducido | ❌ lab pitot (chico) |
| a3-l3 | Los LEGO del flujo: uniforme, fuente, sumidero, doblete — sumar soluciones de Laplace es GRATIS (superposición) | And §3.9-3.12 | Fuente + uniforme → óvalo de Rankine con punto de estancamiento en la posición analítica exacta | ⚠️ campo potencial ✅ en `Aerodynamics.tsx`; falta UI de superposición (flujo-lego) |
| a3-l4 | El cilindro: sin circulación (Cp = 1 − 4·sin²theta, simétrico) y con circulación → NACE la sustentación: L' = rho·V·Gamma (Kutta-Joukowski) | And §3.13-3.16 | Integrar Cp(theta) sobre el cilindro = rho·V·Gamma EXACTO; Cp mínimo = −3 en el hombro | ✅ `Aerodynamics.tsx` lo implementa completo |
| a3-l5 | d'Alembert: el arrastre da CERO y no es un error — es la pista de que falta la viscosidad | And §3.18-3.20 | Drag integrado del Cp potencial = 0 (exacto); vs cilindro real Cd ≈ 1.2 (datos And §3.18) | ⚠️ potencial ✅; comparación con datos reales = fixtures |
| a3-l6 | El panel de fuentes: tu PRIMER solver de flujo (N paneles, N ecuaciones, cuerpo arbitrario) | And §3.17 | Source panel sobre cilindro vs Cp(theta) = 1 − 4·sin²theta exacto | ❌ `panel2d.ts` (Hess-Smith) |

### U4 · Perfiles: por qué el ala no se cae (Anderson cap 4; Bertin caps 5-6) — 8 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a4-l1 | Anatomía del perfil: cuerda, curvatura, espesor. El generador NACA 4 dígitos: 2412 = 2% curvatura al 40%, 12% espesor — la fórmula REAL de 1933 | And §4.2-4.3; Abbott | Ordenadas del NACA 2412 generadas vs tabla publicada de Abbott & von Doenhoff (literal) | ⚠️ espesor 00xx ✅ en `Aerodynamics.tsx`; camber 4/5 dígitos → `naca.ts` |
| a4-l2 | La condición de Kutta: el aire "decide" salir suave por el borde afilado — y esa decisión FIJA la circulación (sin fricción no habría sustentación) | And §4.4-4.5 | Gamma_Kutta = 4·pi·a·V·sin(alfa) en cilindro→Joukowski; borde de salida con velocidades iguales | ✅ `Aerodynamics.tsx` (Kutta implementada) |
| a4-l3 | Kelvin y el vórtice de arranque: la circulación se CONSERVA — el ala deja un vórtice espejo atrás al arrancar | And §4.6 | Gamma_estela = −Gamma_perfil (suma cero); el vórtice de arranque APARECE en la sim | ⚠️ NS2D muestra el vórtice de arranque; guionizar + medir Gamma |
| a4-l4 | Thin airfoil I: de la hoja de vórtices a CL = 2·pi·alfa. ¿De dónde sale el 2·pi? (la integral de Glauert, paso a paso) | And §4.7 | Panel method vs 2·pi·alfa (pendiente al 1%); vs datos NACA 0012 hasta el stall | ⚠️ 2·pi·sin(alfa) ✅ visual; derivación + comparación → `panel2d.ts` |
| a4-l5 | Thin airfoil II: la curvatura regala sustentación a alfa = 0 (alfa_L0 < 0) y fija el centro aerodinámico en c/4 | And §4.8-4.9 | alfa_L0 y Cm_c/4 del NACA 2412 por teoría vs datos de Abbott | ❌ `thin-airfoil.ts` (integrales de Glauert sobre camber de `naca.ts`) |
| a4-l6 | El vortex panel method: Cp(x) sobre CUALQUIER perfil — el XFOIL-lite de La Forja | And §4.10-4.11 | Distribución Cp del NACA 4412 vs datos experimentales publicados (And Fig. 4.25) | ❌ `panel2d.ts` (vórtices + Kutta) |
| a4-l7 | El arrastre del perfil: fricción laminar/turbulenta, transición, separación → el STALL. Por qué CL tiene un máximo y qué se rompe al excederlo | And §4.12-4.13 | Cd placa plana = 1.328/sqrt(Re) laminar vs 0.074/Re^0.2 turbulento; polar CL-Cd del 2412 vs Abbott | ❌ `capa-limite.ts` + polar |
| a4-l8 | High-lift: flaps, slats, multielemento — por qué un 747 de 400 ton aterriza a 150 kt sin caerse | Bertin §6.7-6.9; And design box | Delta_CL de flap simple por teoría thin airfoil (2·(pi−theta_f+sin theta_f)·delta) vs datos | ⚠️ flap analítico = extensión de `thin-airfoil.ts`; multielemento panel ❌ |

### U5 · El ala finita: el precio de la tercera dimensión (Anderson caps 5-6; Bertin cap 7) — 7 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a5-l1 | El ala TERMINA: vórtices de punta, downwash, y el arrastre que no es fricción (inducido). El costo de existir en 3D | And §5.1 | Campo de velocidad del vórtice herradura (Biot-Savart) → downwash w(y) analítico | ⚠️ motor de partículas ✅ para la viz; Biot-Savart = lab nuevo |
| a5-l2 | Biot-Savart y Helmholtz: la misma ley que el campo magnético (¡ya la viste en el átomo!) gobierna los filamentos de vórtice | And §5.2 | w inducida por filamento recto = Gamma/(4·pi·h)·(cos A − cos B) vs numérico | ❌ `biot-savart.ts` (chico; viz B dipolo de CinematicAtom como referencia) |
| a5-l3 | Lifting-line de Prandtl: la distribución ELÍPTICA → CD_i = CL²/(pi·AR). Por qué el Spitfire tiene ala elíptica y los planeadores alas ETERNAS | And §5.3.1, 5.3.3 | Distribución elíptica → alfa_i = CL/(pi·AR) constante (exacto) | ❌ `lifting-line.ts` |
| a5-l4 | Distribución general (serie de Fourier) y el factor de Oswald e: cuánto castiga el taper y el AR | And §5.3.2; Bertin §7.3 | Solver Fourier reproduce e(taper) clásico de Glauert (mínimo delta en taper ≈ 0.35) | ❌ `lifting-line.ts` (mismo módulo) |
| a5-l5 | Vortex lattice (VLM): el ala completa —flecha, taper, twist— en una malla de herraduras | And §5.5; Bertin §7.5 | CL_alfa del VLM vs lifting-line (AR alto) y vs pi·AR/2 (delta esbelta, límite exacto) | ❌ `vlm.ts` |
| a5-l6 | El ala delta: sustentación por VÓRTICE (leading-edge vortex) — por qué el Concorde aterrizaba de nariz parada | And §5.6; Bertin §7.7-7.8 | Analogía de succión de Polhamus vs datos de delta (Bertin Fig. 7.29) | ⚠️ Polhamus = fórmula pura; viz vórtices = motor de partículas ✅ |
| a5-l7 | El avión completo: la polar CD = CD0 + K·CL² y el número sagrado L/D_max = 1/(2·sqrt(CD0·K)) | And §6.7 | Fit de polar a datos publicados (Cessna 172); L/D_max analítico vs gráfico | ❌ `polar-lab.tsx` |

### U6 · Capa límite: donde vive la fricción (Anderson caps 15-19 selección; Bertin cap 4) — 6 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a6-l1 | La idea que salvó a la aerodinámica (Prandtl 1904): TODA la viscosidad vive en una capa delgada. delta, delta*, theta — los tres espesores | And §17.1-17.2; Bertin §4.1 | delta_99 = 5.0·x/sqrt(Re_x) (Blasius); delta*/theta = H = 2.59 laminar | ❌ `capa-limite.ts` |
| a6-l2 | Blasius: la placa plana exacta. Cf = 0.664/sqrt(Re_x) — resolver una EDO no lineal con shooting (f''(0) = 0.4696) | And §18.2; Bertin §4.3 | Shooting RK4 converge a f''(0) = 0.4696; Cd = 1.328/sqrt(Re_L) | ❌ `capa-limite.ts` (mismo módulo) |
| a6-l3 | Turbulencia y transición: Re_crit ≈ 5×10^5, el perfil 1/7, y por qué la pelota de golf tiene hoyitos | And §19.2; Bertin §4.4-4.5 | Cf turbulento = 0.074/Re^0.2 vs laminar: el cruce y el salto en Re_crit; drag crisis del cilindro (datos) | ⚠️ correlaciones = fórmulas puras; NS2D da el cualitativo |
| a6-l4 | Separación: el gradiente adverso mata. Predecir DÓNDE se despega el flujo (Thwaites) — el origen físico del stall | And §4.12.4, 15.2; Bertin §4 | Thwaites (lambda = theta²/nu·dU/dx = −0.09) predice separación en el cilindro ≈ 104° (publicado) | ❌ `capa-limite.ts` (Thwaites) |
| a6-l5 | Navier-Stokes: las ecuaciones del millón de dólares. Couette: el ÚNICO flujo que resuelves a mano | And §15.4, cap 16 | Perfil de Couette lineal exacto u/ue = y/h; NS2D vs analítico en el caso viscoso simple | ⚠️ `NavierStokes2D.tsx` ✅ (cualitativo, etiquetado); Couette exacto = lab chico |
| a6-l6 | El arrastre REAL de un perfil: panel (presión) + capa límite (fricción) = la polar completa. El drag buildup 2D | And §19.2.3; Bertin §4.7 | Cd del NACA 0012 predicho (panel + Cf) vs polar de Abbott | ❌ integra `panel2d.ts` + `capa-limite.ts` |

### U7 · Flujo compresible: cuando el aire se entera (Anderson caps 7-8, 10; Bertin cap 8) — 6 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a7-l1 | La velocidad del sonido: a = sqrt(gamma·R·T) — la velocidad a la que el aire "avisa". Mach no es velocidad, es RELACIÓN | And §7.2, 8.3 | a en cada altitud ISA vs tabla; a nivel del mar = 340.3 m/s | ⚠️ termodinámica ✅ sustrato (`thermo/`); fórmula pura + `atmosfera.ts` |
| a7-l2 | Condiciones totales: T0/T = 1 + (gamma−1)/2·M² — el termómetro que se equivoca a Mach 2 | And §7.5, 8.4 | Reproducir la tabla isentrópica (Anderson Ap. A) al 4º decimal | ❌ `gasdinamica.ts` |
| a7-l3 | La onda de choque normal: el aire frena DE GOLPE en micras. Las relaciones de Rankine-Hugoniot y por qué la entropía solo SUBE | And §8.2-8.6 | Relaciones de choque vs Anderson Ap. B (literal); s2−s1 > 0 siempre (M1 > 1) | ❌ `gasdinamica.ts` |
| a7-l4 | Medir velocidad supersónica: el pitot con su propio choque (fórmula de Rayleigh) | And §8.7 | Fórmula de Rayleigh-Pitot vs tablas; error si ignoras el choque = motivación | ❌ `gasdinamica.ts` (mismo módulo) |
| a7-l5 | Toberas: por qué los cohetes tienen campana. A/A* = f(M), flujo estrangulado (choked), el "más angosto = más rápido" se INVIERTE en supersónico | And §10.3; Bertin §8.4 | A/A* reproduce Ap. A; masa máxima en M = 1 en la garganta (exacto) | ❌ `gasdinamica.ts` + viz tobera 1D (motor de partículas ✅) |
| a7-l6 | El túnel supersónico: tobera + sección de prueba + difusor — diseño conceptual completo (el IWC de Anderson) | And §10.4-10.8 | Reproducir los números del diseño IWC 10.8 de Anderson | ❌ usa `gasdinamica.ts`; lección de diseño guiado |

### U8 · Choques oblicuos y vuelo supersónico (Anderson caps 9, 11-12; Bertin caps 9-11) — 7 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a8-l1 | El choque oblicuo: la relación theta-beta-M (el diagrama que gobierna TODO el vuelo supersónico) — cuña, choque pegado o desprendido | And §9.2-9.3 | Reproducir el diagrama theta-beta-M; cuña de 15° a M=2 vs valores tabulados | ❌ `gasdinamica.ts` (oblicuo) |
| a8-l2 | La expansión de Prandtl-Meyer: la esquina que ACELERA el flujo sin pérdidas. La función nu(M) | And §9.6 | nu(M) vs Anderson Ap. C (literal) | ❌ `gasdinamica.ts` (mismo módulo) |
| a8-l3 | Shock-expansion: el perfil diamante completo — lift y drag EXACTOS de un perfil supersónico con 4 regiones | And §9.7-9.9 | cl y cd del diamante por shock-expansion vs teoría lineal (límite alfa chico) | ❌ combina a8-l1/l2; viz de ondas = escena R3F nueva ⚠️ |
| a8-l4 | Prandtl-Glauert: Cp = Cp0/sqrt(1−M²) — estira tu solución incompresible hasta M ≈ 0.7 GRATIS | And §11.4-11.5; Bertin §9.1 | Datos NACA a Mach creciente colapsan con P-G (And Fig. 11.5) | ⚠️ una línea SOBRE `panel2d.ts` (❌ dependiente) |
| a8-l5 | Mach crítico y drag-divergence: la "barrera del sonido" es un pico de drag, no un muro. Por qué las alas van EN FLECHA | And §11.6-11.7, 11.13 | M_cr del cruce Cp_min (P-G) con Cp_cr(M) analítico; efecto flecha: M_cr_efectivo = M_cr/cos(Lambda) | ❌ `gasdinamica.ts` + `panel2d.ts` |
| a8-l6 | Teoría lineal supersónica: Cp = 2·theta/sqrt(M²−1). La placa plana supersónica: cl = 4·alfa/sqrt(M²−1) y el drag de onda que NO perdona | And §12.2-12.4; Bertin §10.1 | Placa plana lineal vs shock-expansion exacto (converge a alfa chico) | ❌ fórmulas puras chicas (mismo `gasdinamica.ts`) |
| a8-l7 | El área rule y el perfil supercrítico: la genialidad de Whitcomb ×2 — distribución de áreas suave = menos drag de onda (D_onda ~ Vol²/l⁴, Sears-Haack) | And §11.8-11.9, 11.14 | Distribución de secciones A(x) de un fuselaje medida por el kernel vs Sears-Haack ideal | ⚠️ el kernel OCCT YA corta secciones y mide áreas (section-tool) — conexión CAD real |

### U9 · Hipersónica: M > 5 (Anderson cap 14; Bertin cap 12) — 3 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a9-l1 | Newton tenía razón… 280 años después: Cp = 2·sin²(theta). El modelo de 1687 que falló en subsónico gobierna el M→infinito | And §14.3-14.5; Bertin §12.2-12.4 | Placa plana newtoniana L/D = cot(alfa) vs relaciones exactas M→inf; Cp sobre malla B-Rep de CUALQUIER pieza del kernel | ⚠️ `newtoniana.ts` chico: kernel da mallas con normales ✅ |
| a9-l2 | Calentamiento aerodinámico: q ~ sqrt(rho/R_nariz)·V³ — por qué las cápsulas son ROMAS (la nariz afilada se DERRITE) | And §14.8; Bertin §12.6 | Escalamiento Sutton-Graves vs datos de reentrada Apollo; blunt vs slender comparado | ❌ fórmulas puras + fixtures; viz reentrada = cine |
| a9-l3 | Waveriders: surfear tu propio choque. El techo L/D_max ≈ 4·(M+3)/M y cómo romperlo | And §14.9; Bertin §12.5 | Newtoniana modificada sobre la forma; curva del "L/D barrier" vs puntos de diseño publicados | ❌ teoría + viz (generador de waveriders fuera de alcance v1) |

### U10 · Del ala al avión: diseño conceptual (Raymer caps 3-6, 12, 17; Bertin caps 1, 13) — 6 lecciones ← capstone
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| a10-l1 | La ecuación de sizing: W0 = (W_tripulación + W_carga)/(1 − Wf/W0 − We/W0) — el lazo iterativo con el que NACE todo avión | Raymer cap 3 | Reproducir el ejemplo ASW de Raymer (números literales del libro) | ❌ `sizing.ts` |
| a10-l2 | Las dos perillas maestras: T/W y carga alar W/S — velocidad de stall, despegue, crucero y viraje salen de AHÍ (constraint diagram) | Raymer cap 5 | V_stall = sqrt(2·(W/S)/(rho·CL_max)) vs datos de aviones reales; diagrama de restricciones | ❌ `sizing.ts` (mismo módulo) + viz |
| a10-l3 | Elegir perfil y geometría del ala: AR, taper, flecha, twist — cada número contra la misión. El ala 3D REAL por loft del kernel | Raymer cap 4 | Ala generada: secciones `naca.ts` → loft OCCT → volumen/área medidos por el kernel (el kernel no miente) | ⚠️ loft ✅ kernel; secciones NACA → `naca.ts` |
| a10-l4 | Drag buildup del avión completo: método de componentes (Cf × FF × Q × S_wet/S_ref, sumado) — el CD0 sale de las ÁREAS MOJADAS | Raymer §12.5 | CD0 tipo Cessna 172 desde áreas mojadas (medidas por el kernel sobre el modelo) vs ~0.028 publicado | ❌ `drag-buildup.ts`; kernel mide áreas ✅ |
| a10-l5 | Desempeño: alcance de Breguet R = (V/c)·(L/D)·ln(W0/W1), subida, techo, viraje y la energía-maneuverabilidad Ps de Boyd | Raymer cap 17; Bertin §1.1 | Breguet de un 737-like vs alcance real publicado; contornos Ps del F-5 (ejemplo Bertin, literal) | ❌ `performance.ts` + `polar-lab.tsx` |
| a10-l6 | EXAMEN AERODINAMICISTA: diseña tu avión — misión → sizing → geometría → polar → desempeño, auto-calificado por invariantes | Raymer cap 24 | Pipeline completo; calificación exacta: ¿cumple alcance, stall, despegue con TU geometría? | ❌ integra todo (mismo patrón del examen Forjador) |

## Orden de producción (por valor y por sustrato existente)

1. **U1 + `atmosfera.ts`** — casi todo son fórmulas puras y labs chicos; `Aerodynamics.tsx` ya da el gancho
   visual. Valida el pipeline de clases de aero (mismo `clase-drive.cjs`).
2. **`naca.ts` + `panel2d.ts` → U4 + U3** — EL CORAZÓN y el diferenciador: un XFOIL-lite en el navegador
   con verificación contra datos NACA publicados. Nadie más enseña "de dónde sale el 2·pi" con el solver
   corriendo en vivo. (`Aerodynamics.tsx` ya aporta Joukowski + Kutta + líneas de corriente RK4.)
3. **`tunel-viento.tsx` + U2** — el escenario visual transversal (el "Part Studio" de aero): humo de
   partículas advectadas sobre el campo del panel method, knobs alfa/Re/V, balanza L/D en vivo.
4. **`capa-limite.ts` → U6** — módulo chico (Blasius shooting + Thwaites + correlaciones) que cierra el
   drag REAL y desbloquea la polar 2D completa (a4-l7, a6 entera).
5. **`lifting-line.ts` + `vlm.ts` → U5** — el ala finita; con la polar completa ya hay avión.
6. **`gasdinamica.ts` → U7 + U8** — el módulo MÁS testeable del curso: los apéndices A-C de Anderson son
   literalmente los tests. Funciones puras, cero UI de entrada.
7. **U10 (capstone Raymer)** — necesita todo lo anterior; el examen final es el "diseña tu avión".
8. **U9 (hipersónica)** — corta; `newtoniana.ts` sobre mallas del kernel es un reel jugoso ("el Cp
   hipersónico de TU pieza") y puede adelantarse como cine sin bloquear nada.

## Features por construir (ordenadas por lecciones que desbloquean)

| # | Feature | Qué es | Lecciones que desbloquea | Esfuerzo |
|---|---|---|---|---|
| 1 | **`panel2d.ts`** — panel method Hess-Smith 2D | Fuentes por panel + vórtice + condición de Kutta; N ≈ 100 paneles → sistema lineal denso 101×101 (trivial en JS puro). Da Cp(x), Cl, Cm de cualquier perfil | ~12 (a3-l6, a4-l4..l8, a6-l6, a8-l4/l5, upgrades a1-l1/l5) | Medio (el solver es chico; la validación vs datos es el trabajo) |
| 2 | **`naca.ts`** — generador NACA 4/5 dígitos | Camber + espesor exactos (fórmulas de 1933), ordenadas; fixtures = tablas de Abbott & von Doenhoff transcritas LITERALES | ~10 (U4 entera, U5-l3+, a10-l3) | Chico |
| 3 | **`gasdinamica.ts`** — relaciones compresibles | Isentrópicas, choque normal/oblicuo (theta-beta-M), Prandtl-Meyer, A/A*, Rayleigh-Pitot. Funciones puras; tests = apéndices A-C de Anderson al 4º decimal | ~11 (U7 entera, a8-l1..l6) | Chico-medio |
| 4 | **`capa-limite.ts`** — capa límite integral | Blasius por shooting RK4 (f''(0) = 0.4696), Thwaites (separación), Cf laminar/turbulento, transición | ~7 (U6 entera, a4-l7) | Chico |
| 5 | **`tunel-viento.tsx`** — túnel de viento visual R3F | Partículas/humo advectados por el campo de `panel2d.ts` (cuantitativo) o NS2D (cualitativo, etiquetado); knobs alfa/Re/V; balanza de L y D en vivo. El ESCENARIO de U3-U6 | transversal (~20 lecciones lo usan de escenario) | Medio (el sustrato — motor de partículas, RK4 streamlines — ya existe) |
| 6 | **`lifting-line.ts` + `vlm.ts`** — el ala finita | Prandtl por serie de Fourier + vortex lattice básico (herraduras en malla) | ~6 (U5) | Medio |
| 7 | **`polar-lab.tsx`** — la polar interactiva | CD = CD0 + K·CL², L/D_max, Breguet, Ps; fit a datos de aviones reales | ~4 (a5-l7, a10-l4..l6) | Chico |
| 8 | **`sizing.ts` + `drag-buildup.ts`** — Raymer loop | Sizing iterativo W0 + component buildup con áreas mojadas MEDIDAS por el kernel OCCT | ~5 (U10) | Medio |
| 9 | **`atmosfera.ts`** — ISA estándar | T(h), p(h), rho(h), a(h) troposfera + estratosfera; test = Ap. D de Anderson | 1 directa (a1-l4) + insumo de U7/U10 | Trivial (una tarde) |
| 10 | **`newtoniana.ts`** — Cp hipersónico sobre B-Rep | Cp = 2·sin²(theta) sobre las normales de la malla de CUALQUIER sólido del kernel → L/D hipersónico de tu pieza | ~2 (U9) + reels | Chico (jugoso para cine) |

**Fuera de alcance v1 (se marca, no se finge):** CFD Euler/RANS cuantitativo (2D o 3D), transónico no
lineal, panel 3D completo, modelos de turbulencia más allá de correlaciones de placa plana,
aeroelasticidad. `NavierStokes2D.tsx` (Stam) se queda como herramienta VISUAL cualitativa y siempre se
etiqueta como tal — la regla de física real del proyecto: lo evocativo se declara evocativo.

## Reglas de autoría de las clases (heredan del proyecto)

- Español mexicano (tú/tienes). Narración con aire (~0.6 s entre frases). Fórmulas en ASCII en consola/subtítulos.
- Gancho en los primeros 5 s: el número que da miedo o el mito que vamos a romper ("Bernoulli no explica
  el ala como te lo contaron"; "este perfil se diseñó en 1933 y sigue volando").
- Toda curva que aparezca en pantalla es CALCULADA en vivo o transcrita de datos publicados — jamás dibujada a ojo.
- Verificación SIEMPRE: cada lección cierra con su comprobación ("la física no miente") — el número del
  alumno contra el analítico exacto o el dato publicado, con la fuente citada en pantalla.
- Historia como gancho, no como relleno: los Wright y su túnel de 1901, d'Alembert y su paradoja,
  Prandtl 1904, Whitcomb y el área rule, Boyd y la energía-maneuverabilidad (Anderson y Bertin traen
  las notas históricas listas).
- Master 4K (3840×2160 horizontal para clases) HEVC 10-bit NVENC. 1080 solo preview.
