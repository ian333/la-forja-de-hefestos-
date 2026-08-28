# Anderson — Fundamentals of Aerodynamics, 6e (2017) — pliego de supertickets

Fuente: 10 tramos leídos del txt (pdftotext) cruzados con docs/forja-research/aero-pliego/*.md, aero/CURRICULUM-AERO.md, PLAN-ESCUELA-AERO-EN-EL-CAD.md, CRUCE-Y-PLAN.md, pliegos/pliego-aero.md. Estado del repo verificado por ls/grep el 2026-08-27: src/aero/ = atmosfera, cuna-anderson, panel2d, potencial, skin, wing-metrics (+tests); src/forja/sim/viento.ts; lecciones aero existentes: a1-l1, a1-l4; registry.ts sin comandos aero.

## 0. El autor como cliente

Anderson como cliente pide una suite donde TODA fuerza sale de integrar p y τ sobre la piel del sólido del kernel y se reporta como coeficiente con S y l de referencia explícitas y función de (Re, M, α); un contrato de datos con 5 motores baratos que corren en milisegundos dentro del CAD: (1) potencial 2D por paneles fuentes+vórtices + perfil delgado (caps 3-4) acoplado a capa límite (caps 17-19) para que el arrastre EXISTA; (2) línea sustentadora / VLM + polar del avión con e de Oswald (caps 5-6); (3) gas dinámico completo — isentrópicas, choque normal, θ-β-M, Prandtl-Meyer, Rayleigh-Pitot, tobera casi-1D — con las tablas A/B/C como oráculo a 4 cifras (caps 7-10); (4) correcciones P-G/K-T, Mach crítico, regla del área y supersónico lineal SIEMPRE junto al exacto choque-expansión (caps 11-12); (5) hipersónico de ingeniería — newtoniana sobre la malla B-Rep, calentamiento de estancamiento q∝1/√R, MOC para toberas, Taylor-Maccoll (caps 13-14). Exige HONESTIDAD codificada: el solver declara su dominio (M<0.3 incompresible, P-G<0.7, transónico 'no veo', T>2000 K gas real, Re_cr es ENTRADA nunca default, cf turbulento ±20 %) y muestra 'no aplica' en vez de un número falso; y bilingüe SI/inglés porque los problemas mezclan slug, °R y lb/ft² a propósito.

## 1. Capítulos y cobertura

| cap | título | ejercicios | cubierto | nota |
|---|---|---|---|---|
| 1 | Aerodynamics: Some Introductory Thoughts | 29 | parcial | Ej 1.1 y 1.10 hechos (a1-l1, a1-l4, cuna-anderson.ts, atmosfera.ts); falta integrador general 2D (N',A',M,xcp), performance, similitud, hidrostática |
| 2 | Fundamental Principles and Equations | 19 | parcial | skin.ts cierra ∮n̂dS=0 (P2.1); potencial.ts integra líneas y Γ solo Joukowski; falta campo 2D genérico, volumen de control, ψ/φ |
| 3 | Inviscid Incompressible Flow | 36 | parcial | panel2d.ts pasa Ej 3.19 a 4 cifras y el cilindro exacto; NO cableado al CAD; sin cuasi-1D/Pitot/venturi ni fuente/sumidero |
| 4 | Incompressible Flow over Airfoils | 27 | no | potencial.ts solo Joukowski/00xx; sin perfil delgado, paneles de vórtice, ac, Cf/transición ni polares NACA digitalizadas |
| 5 | Incompressible Flow over Finite Wings | 16 | no | wing-metrics.ts mide S/AR/λ/MAC del sólido; sin lifting-line, Biot-Savart ni VLM |
| 6 | Three-Dimensional Incompressible Flow | 5 | no | skin.ts panelea la malla 3D; sin doblete/esfera 3D ni polar de Oswald |
| 7 | Compressible Flow: Preliminary Aspects | 13 | no | atmosfera.ts da a=√γRT; sin T0/p0, Δs, isentrópicas |
| 8 | Normal Shock Waves | 19 | no | solo ISA; sin choque normal, Rayleigh-Pitot ni tablas A/B |
| 9 | Oblique Shock and Expansion Waves | 23 | parcial | cuna-anderson.ts θ-β-M con desprendido explícito + Estudio Viento de cuña; sin Prandtl-Meyer, estado completo (M2,p02), reflexiones ni choque-expansión |
| 10 | Nozzles, Diffusers, Wind Tunnels | 19 | no | ISA hasta 71 km; sin área-Mach, tobera casi-1D, túnel |
| 11 | Subsonic Compressible: Linear Theory | 14 | no | panel2d da Cp0; sin P-G/K-T, Mach crítico, regla del área |
| 12 | Linearized Supersonic Flow | 10 | parcial | viento.ts cuña exacta; sin Cp=2θ/√(M²−1), diamante, Sutherland/Cf |
| 13 | Numerical Techniques Nonlinear Supersonic | 5 | no | sin MOC, MacCormack, time-marching, Taylor-Maccoll |
| 14 | Elements of Hypersonic Flow | 16 | parcial | cuna-anderson.ts β a M=36 OK; skin.ts lista para newtoniana; sin newtoniana.ts, calentamiento, waverider |
| 15 | Viscous Flow: Principles | 5 | no | sin Sutherland, Couette aero, transición |
| 16 | Couette Flow | 5 | no | Couette/Poiseuille existen solo en el molde (fan.ts, cooling-design.ts); nada en aero |
| 17 | Introduction to Boundary Layers | 2 | parcial | panel2d.ts existe para el lazo viscoso-inviscido; sin δ* ni acoplamiento |
| 18 | Laminar Boundary Layers | 9 | no | sin Blasius, T*, estancamiento; viento.ts usa τ=431 s^-0.2 empírico y cita capa-limite.ts inexistente |
| 19 | Turbulent Boundary Layers | 13 | no | sin 0.074/Re^0.2, transición, Baldwin-Lomax |
| 20 | Navier-Stokes Solutions + Apéndices A-E | 13 | parcial | atmosfera.ts reproduce Ap. D (ISO 2533, sin fixture literal); NS2D.tsx es Stam cualitativo; sin RANS; fixture Lombardi solo en doc |

## 2. Catálogo completo de ejercicios (298, deduplicado)

Ids canónicos `anderson-c<cap>-<nn>`. Deduplicación aplicada: problemas 1.15-1.19 (tramo 2 → c1-24..29), P3.18/19/21/22 (tramo 4 → c3-32..35), P4.13-4.16 (tramo 5 → c4-23..26), P12.1/3/6/7 (tramo 8 → c12-05/07/09/10), P15.1/15.2 (tramo 9 → c15-01/02), P19.1-19.7 (tramo 10 → c19-05..11). Cap 0 = Apéndices A-E. 'respuesta impresa' vacía = el libro NO la imprime (oráculo derivado/invariante).

| id | cap | tipo | título | herramientas | oráculo | respuesta impresa | ya_existe | dónde | esf | val |
|---|---|---|---|---|---|---|---|---|---|---|
| anderson-c1-01 | 1 | ejemplo | Ej 1.1 Cuña 5° a Mach 2: D' integrando p y τ | croquis,cotas,extruir,estudio-viento,ISA | D'=1.24e4 N/m ±1%, cd=0.022 ±1.5%, fracción presión 0.85; n=50 dentro de 1% de n=400 | D'=1.052e4+0.1873e4=1.24e4 N/m; cd=0.022 (85% presión) | si | src/aero/cuna-anderson.ts:cunaAnderson; src/forja/sim/viento.ts:estudioVientoSupersonico; lección a1-l1.json | S | 5 |
| anderson-c1-02 | 1 | ejemplo | Ej 1.2 Cono hipersónico newtoniano: CD=Cp referido a la base | croquis,revolve,panel-3D | CD integrado sobre la piel del cono (skin.ts) = 2sin²θc ±1e-3 para θc=5/10/20°; cierre ∮n̂dS≈0 | CD = Cp = 2 sin²θc | parcial | src/aero/skin.ts:integrarPresion (sin campo newtoniano ni UI) | M | 4 |
| anderson-c1-03 | 1 | ejemplo | Ej 1.3 NACA 4412: xcp desde cl y cm,c/4 | perfil-2D,panel-2D | xcp/c=0.356 ±0.5%; simétrico ⇒ 0.25 | xcp/c = 0.25 − (−0.09/0.85) = 0.356 | no | grep xcp src/aero: nada | S | 3 |
| anderson-c1-04 | 1 | ejemplo | Ej 1.4 DC-3: L' y xcp desde dos momentos | perfil-2D,cotas | L'=556.6 lb/ft, xcp=5.774 ft ±0.5%; invariante ec 1.22 | L'=556.6 lb/ft; xcp=5.774 ft | no | sin módulo fuerza-momento | S | 3 |
| anderson-c1-05 | 1 | ejemplo | Ej 1.5 Dos cilindros dinámicamente similares | similitud,panel-2D | Cp(s/d) idénticos punto a punto; /CD1−CD2/<1e-6; Re y M iguales | μ2/μ1=2, a2/a1=2, M2=M1, Re2=Re1 ⇒ CD1=CD2 | no | panel2d.test 'el radio no cambia el Cp' (mitad) | S | 3 |
| anderson-c1-06 | 1 | ejemplo | Ej 1.6 Túnel para modelo 1/50 del 747 | similitud,ISA | V2=577.5 mi/h, p2=11.26 atm ±0.5%; Re2/Re1=M2/M1=1 | V2=577.5 mi/h; p2=23,836 lb/ft²=11.26 atm | no | sin calculadora de túnel | S | 4 |
| anderson-c1-07 | 1 | ejemplo | Ej 1.7 Citation V crucero: CL y L/D | performance,ISA | CL=0.21, L/D=14 ±1%; ρ(33,000 ft)=0.4106 kg/m³ ±0.5% | CL=0.21; L/D=14 | no | grep vstall src/aero: nada | S | 4 |
| anderson-c1-08 | 1 | ejemplo | Ej 1.8 CL,max del Citation V desde Vstall | performance | CL,max=1.81 ±1%; inversa Vstall=146.7 ft/s | CL,max=1.81 | no | sin performance | S | 3 |
| anderson-c1-09 | 1 | ejemplo | Ej 1.9 Globo: flotabilidad y techo | croquis,revolve,ISA,dinámica | B=1082 lb con vol_kernel ±0.5%; a=11.4 ft/s²; h=9842 ft ±1% (ley ρ(h) del libro) | B=1082 lb; a=11.4 ft/s²; techo 9842 ft | parcial | vol_kernel del CAD (ForgeBRepStudio inv.vol_kernel) | S | 3 |
| anderson-c1-10 | 1 | ejemplo | Ej 1.10 Atmósfera estándar a 5 km por hidrostática | ISA | T=255.69 K, p=5.407e4 Pa ±0.2%, ρ=0.7368; geopotencial(5000)=4996 m | T=255.69 K; p=5.407e4 N/m²; ρ=0.7368 kg/m³ | si | src/aero/atmosfera.ts:atmosferaISA/geopotencial; lección a1-l4.json | S | 5 |
| anderson-c1-11 | 1 | ejemplo | Ej 1.11 Barómetro de mercurio 76 cm | hidrostática | Δh=76 cm ±0.5% | Δh=0.76 m; columna sellada más alta | no | grep manometr src: nada | S | 2 |
| anderson-c1-12 | 1 | ejemplo | Ej 1.12 P-35: potencia requerida | performance,ISA | V=377.8 ft/s, D=1026 lb, P=704 hp ±1%; 257.6 vs 260 mi/h | V=377.8 ft/s; D=1026 lb; P=704 hp | no | sin performance | S | 4 |
| anderson-c1-13 | 1 | caso | IWC 1.16 Fuerza axial hacia adelante NACA 2412 a 6° | perfil-2D,panel-2D | ca=−cl sinα+cd cosα=−0.084<0; frontera L/D=cotα | L/D=110 > cot6°=9.52 ⇒ A<0 | parcial | panel2d.ts Cp sin cd ni N/A | M | 3 |
| anderson-c1-14 | 1 | problema | P1.1 Gas ideal en dos unidades | ISA,unidades | ρ=0.326 kg/m³; T=501 °R ±0.5%; ida y vuelta SI/inglés |  | parcial | atmosfera.ts ρ=p/RT; sin bilingüe | S | 2 |
| anderson-c1-15 | 1 | problema | P1.3 Placa supersónica p constante: xcp | perfil-2D | xcp=c/2 exacto ±1e-6 (carga uniforme) |  | parcial | cuna-anderson.ts solo arrastre | S | 3 |
| anderson-c1-16 | 1 | problema | P1.4 Placa 1 m a 10°: N',A',L',D',M'LE,M'c/4,xcp | perfil-2D,croquis | N'=1.123e5, A'=1273.8, M'LE=−3.75e4, xcp=0.334 m; panelizado ≤0.5% del cerrado |  | parcial | skin.ts integra 3D sin momento; ES el fixture del integrador 2D | M | 5 |
| anderson-c1-17 | 1 | problema | P1.5 De (cn,ca) a (cl,cd) a 12° | perfil-2D | cl=1.1675, cd=0.2788 ±1e-4 |  | no | sin rotación N/A↔L/D | S | 2 |
| anderson-c1-18 | 1 | problema | P1.6 NACA 2412: xcp/c(α) desde tabla | perfil-2D,gráfica | xcp/c: −2°→1.09, 0→0.41, 4→0.306, 14→0.266 ±0.5%; >0.25 siempre |  | no | grep 2412 src: nada | S | 3 |
| anderson-c1-19 | 1 | problema | P1.9 ¿Similares a 200 K y 800 K? | similitud | M iguales; Re2/Re1=2.83 ⇒ NO |  | no | sin similitud | S | 3 |
| anderson-c1-20 | 1 | problema | P1.10 Túnel a 1 atm para Lear jet 1/5 | similitud,ISA | ρ2=2.07, T2=170 K, V2=218 m/s ±1% |  | no | sin túnel | S | 4 |
| anderson-c1-21 | 1 | problema | P1.11 Manómetro 20 cm Hg en el ala | hidrostática | p=7.43e4 Pa ±0.5% |  | no |  | S | 2 |
| anderson-c1-22 | 1 | problema | P1.12 Peso del Zeppelin: B+L | croquis,revolve,ISA,performance | ρ(1000m)=1.1117; L=3.85e3 N; B=1.634e5; W=1.673e5 N ±1%; vol_kernel=15,000 m³ |  | parcial | atmosfera.ts + vol_kernel | M | 4 |
| anderson-c1-23 | 1 | problema | P1.13 Cilindro hipersónico Cp=2cos²φ: CD=4/3 | croquis,extruir,panel-3D | CD=4/3 ±0.5% integrando sobre la piel; L=0 por simetría |  | parcial | skin.ts sin campo newtoniano | M | 4 |
| anderson-c1-24 | 1 | problema | P1.15 Cessna Skylane: CL,CD,L/D vs V | performance,gráfica | (L/D)max=13.6 en CL*=0.680, V*=144.8 ft/s ±1 ft/s |  | no | sin performance | S | 4 |
| anderson-c1-25 | 1 | problema | P1.16 dV/dy en pared a Mach 10 | capa-límite,μ(T) | (dV/dy)w=τw/μ=1.576e7 s⁻¹ ±0.5% |  | no | sin μ(T) | S | 2 |
| anderson-c1-26 | 1 | problema | P1.17 dT/dy en pared del Shuttle a Mach 9 | térmico,capa-límite | (dT/dy)w=−1.186e6 K/m ±0.5% |  | no | sin k(T) | S | 2 |
| anderson-c1-27 | 1 | problema | P1.18 Re de raíz: DC-3 vs F-22 | performance,ISA,wing-metrics | Re=2.66e7 y 1.81e8 ±1% con cuerda MEDIDA del sólido |  | parcial | src/aero/wing-metrics.ts:metricasAla; sin función Re | S | 3 |
| anderson-c1-28 | 1 | teoria | P1.20 ¿A' negativa en placa plana? | perfil-2D | A'=∫(τu+τl)dx ≥0 siempre (dy/dx=0) |  | no |  | S | 2 |
| anderson-c1-29 | 1 | problema | P1.19 Wright y la tabla de Lilienthal (3°) | polar-tabular | L/D(3°) máximo de la tabla; Fig 1.65 NO está en el txt (bloqueado) |  | desconocido | figuras-digitalizadas.md no verificado | S | 1 |
| anderson-c2-01 | 2 | ejemplo | Ej 2.1 Pared ondulada: ∇·V en (1/4,1) | campo-2D,divergencia | div numérica=−0.7327 ±1%; =0 en x/l=0,½,1 | ∇·V=−0.7327 s⁻¹ | no | src/math VectorFields.tsx solo campos fijos | S | 3 |
| anderson-c2-02 | 2 | ejemplo | Ej 2.2 Perfil potencial u=(y/δ)^n consistente con Cf laminar | capa-límite,volumen-control | raíces n=2.0166 y 0.2478 ±1%; n=2 cóncavo=no físico | n=2 o 0.25; n=2 nonphysical | no | grep 1.328 src/aero: nada | S | 3 |
| anderson-c2-03 | 2 | ejemplo | Ej 2.3 Derivada sustancial: 358.6 m/s² (36.6 g) | campo-2D,D/Dt | /a/=358.6 ±1%, ambas componentes negativas | ax=−358.56, ay=−0.129 m/s² | no | potencial.ts integrateParcel sin a | S | 3 |
| anderson-c2-04 | 2 | ejemplo | Ej 2.4 Línea de corriente del vórtice por (0,5) | campo-2D,RK4 | polilínea RK4 con /r−5/<1e-3 tras una vuelta | x²+y²=25 | parcial | src/aero/potencial.ts:integrateStreamline (solo Joukowski) | S | 4 |
| anderson-c2-05 | 2 | ejemplo | Ej 2.5 Vorticidad del vórtice puntual = 0 | campo-2D,rotacional | curl<1e-8 fuera de r<0.1; singularidad marcada | ξ=0 salvo origen | parcial | NavierStokes2D.tsx ω en malla | S | 3 |
| anderson-c2-06 | 2 | ejemplo | Ej 2.6 La capa límite es rotacional | capa-límite,rotacional | /ξ/δ/V∞>1e-3 y signo constante en 0<y<δ | rotational | no |  | S | 2 |
| anderson-c2-07 | 2 | ejemplo | Ej 2.7 Pared ondulada no viscosa es irrotacional | campo-2D,rotacional | curl<1e-9·V∞/l en malla 50×50 | ∇×V=0 | no |  | S | 2 |
| anderson-c2-08 | 2 | ejemplo | Ej 2.8 Circulación del vórtice Γ=2π independiente del radio | campo-2D,circulación | Γ=2π ±1e-6 en r=1,2,5,10; signo de Anderson Γ≡−∮V·ds | Γ=2π m²/s | parcial | src/aero/potencial.ts:circulationIntegral (círculo, Joukowski, sin el menos) | S | 5 |
| anderson-c2-09 | 2 | ejemplo | Ej 2.9 Potencial φ de la pared ondulada | campo-2D,φ,isolíneas | ∇φ reproduce (u,v) <1e-6 en malla | φ=V∞x+(V∞h/β)sin(2πx/l)e^(−2πβy/l) | no |  | S | 3 |
| anderson-c2-10 | 2 | ejemplo | Ej 2.10 Esquema explícito FD para continuidad 1D | CFD,diferencias-finitas | gaussiana trasladada u·N·Δt, L2<2% con CFL 0.5 (esquema declarado); orden 2 en Δx | ρ_i^{t+Δt}=ρ_i^t−(Δt/2Δx)[...] (2.178) | parcial | src/forja/mold/mold-thermal-fdm.ts (FD calor) | M | 3 |
| anderson-c2-11 | 2 | caso | §2.6 Arrastre por estela (rastrillo Pitot) | volumen-control,CFD,piel | D'_estela = D'_piel ±3% en estaciones 2c,4c,8c |  | parcial | src/aero/skin.ts (piel) + NS2D; sin integral de déficit | M | 5 |
| anderson-c2-12 | 2 | problema | P2.1 p constante sobre cuerpo cerrado ⇒ F=0 | piel,invariante-kernel | /∮n̂dS/<1e-9·A; V=⅓∮r·n̂dS = vol kernel |  | si | src/aero/skin.ts campo cierre + skin.test.ts inv 1-2 | S | 4 |
| anderson-c2-13 | 2 | problema | P2.2 L' desde presiones en techo y piso del túnel | volumen-control,CFD | L'=∫(p_piso−p_techo)dx = L'_piel ±5% |  | no |  | M | 3 |
| anderson-c2-14 | 2 | problema | P2.3/2.7 Fuente: líneas, ∇·V, ∇×V | campo-2D | rayos θ=cte; div=curl=0 fuera del origen |  | parcial | VectorFields.tsx (F=(x,y), no c/r) | S | 3 |
| anderson-c2-15 | 2 | problema | P2.4/2.8 Vórtice libre: líneas, div, curl, Γ | campo-2D,circulación | círculos; div=curl=0; Γ=2πc si encierra el origen, 0 si no |  | parcial | potencial.ts circulationIntegral solo Joukowski | S | 4 |
| anderson-c2-16 | 2 | problema | P2.5/2.9 Rotación sólida Vθ=cr es rotacional | campo-2D,rotacional | curl=2c ±1e-6 en toda la malla |  | parcial | VectorFields.tsx (voseo línea 122) | S | 3 |
| anderson-c2-17 | 2 | problema | P2.6/2.11 Estancamiento u=cx,v=−cy: ψ, φ, ortogonalidad | campo-2D,ψ,φ | hipérbolas xy=cte; ψ=cxy, φ=c(x²−y²)/2; ∇ψ·∇φ=0; ∇²ψ=∇²φ=0 |  | no | CURRICULUM a2-l5 pendiente | S | 4 |
| anderson-c2-18 | 2 | problema | P2.12 Fuerza sobre tubo en U (momento integral) | volumen-control,ensamble | F=2ρAV²=4830 N ±1% en sentido de la entrada |  | no |  | S | 4 |
| anderson-c2-19 | 2 | teoria | P2.10/2.13/2.14 derivaciones (ψ polares, φ, recta en y→∞) | ψ,φ | 2.14 numérico: v/V∞<1e-6 para y/l≥3 |  | no |  | S | 1 |
| anderson-c3-01 | 3 | ejemplo | Ej 3.1 V en un punto por Bernoulli | Bernoulli | V=142.8 m/s ±0.3 | V=142.8 m/s | no | solo cpValue V→Cp en potencial.ts:127 | S | 2 |
| anderson-c3-02 | 3 | ejemplo | Ej 3.2 p aguas abajo (imperial) | Bernoulli,unidades | p2=2073.2 ±0.2 lb/ft² | p2=2073.2 lb/ft² (errata 2073.1) | no |  | S | 1 |
| anderson-c3-03 | 3 | ejemplo | Ej 3.3 Venturi como velocímetro | croquis,revolve,cuasi-1D | V1=102.3 ft/s ±0.2; A1/A2 del kernel | V1=102.3 ft/s | no | grep venturi src: nada | S | 3 |
| anderson-c3-04 | 3 | ejemplo | Ej 3.4 Manómetro Hg en túnel 12:1 | cuasi-1D,manómetro | Δp=1527 ±2 Pa; h=0.01148 m | p1−p2=1527 N/m²; h=0.01148 m | no |  | S | 3 |
| anderson-c3-05 | 3 | ejemplo | Ej 3.5 Δp máximo por la balanza (1000 lb) | cuasi-1D,planeación | V=328.4 ft/s; Δp=127.3 lb/ft² ±0.2 | V∞=328.4 ft/s; p1−p2=127.3 lb/ft² | no |  | S | 3 |
| anderson-c3-06 | 3 | ejemplo | Ej 3.6 p de reservorio para 100/200 mph | cuasi-1D | p1=1.022e5 y 1.059e5 ±50 Pa | 1.01 atm; 1.048 atm (+3.8%) | no |  | S | 2 |
| anderson-c3-07 | 3 | ejemplo | Ej 3.7 V desde Pitot a nivel del mar | Pitot | V=249.5 ±1 ft/s | V1=250 ft/s | no | grep pitot src: nada | S | 2 |
| anderson-c3-08 | 3 | ejemplo | Ej 3.8 Pitot aguas arriba del modelo | Pitot,cuasi-1D | p0=2244 ±1 lb/ft²; V1=27.4 ft/s | p0=2244 lb/ft²; V1=27.3 ft/s | no |  | S | 2 |
| anderson-c3-09 | 3 | ejemplo | Ej 3.9 P-35 a 4 km desde Pitot (Ap. D) | ISA,Pitot | V=114.2 ±0.3 m/s con atmosferaISA(4000) | V1=114.2 m/s=255 mph | parcial | src/aero/atmosfera.ts:atmosferaISA | S | 3 |
| anderson-c3-10 | 3 | ejemplo | Ej 3.10 Velocidad equivalente (EAS) | ISA,q | q=5343 ±5 Pa; Ve=93.2 ±0.2 m/s | q=5.343e3; Ve=93.2 m/s | parcial | atmosfera.ts:presionDinamica | S | 2 |
| anderson-c3-11 | 3 | ejemplo | Ej 3.11 Cp en un punto | Cp | Cp=−1.25 exacto | Cp=−1.25 | si | src/aero/potencial.ts:127 cpValue | S | 2 |
| anderson-c3-12 | 3 | ejemplo | Ej 3.12 Gate de compresibilidad (Cp=−5.3) | Cp,gate-compresibilidad | V=200.8 y 753 ft/s; (b) ROJO M_local>0.3 | (b) not correct: M_local>0.674 | parcial | atmosfera.ts:mach; sin gate | S | 4 |
| anderson-c3-13 | 3 | ejemplo | Ej 3.13 Dónde p=p∞ sobre el cilindro | panel-2D,Cp | raíces 30,150,210,330° ±0.01°; con 64 paneles ±1° | θ=30°,150°,210°,330° | si | src/aero/panel2d.ts:223 cpCilindroExacto + test | S | 3 |
| anderson-c3-14 | 3 | ejemplo | Ej 3.14 Aceleración de la parcela: 510 g | líneas-corriente,parcela | extremos en 45°+k90° ±1°; /a/max=5000 ±50 m/s² | /a/max=2V∞²/R=5000 m/s²=510 g | parcial | potencial.ts:174 integrateParcel | M | 2 |
| anderson-c3-15 | 3 | ejemplo | Ej 3.15 Intensidad de vórtice desde el viento | vórtice | Γ=18,430 ±10 ft²/s | /Γ/=1.843e4 ft²/s | parcial | término vórtice en flowVelocity | S | 1 |
| anderson-c3-16 | 3 | ejemplo | Ej 3.16 Cp pico con cl=5 | cilindro-circulación | Cp(90°)=−6.82 ±0.01 | Cp=−6.82 | parcial | potencial.ts:84 flowVelocity gamma | S | 3 |
| anderson-c3-17 | 3 | ejemplo | Ej 3.17 Estancamiento y Cp=0 con cl=5 | cilindro-circulación | estanc. 203.4/336.6° ±0.1°; Cp=0 en 5.85/174.1/243.8/296.2° | θ=203.4°,336.6°; Cp=0 en 243.8,296.23,5.85,174.1° | parcial | campo existe; sin buscador | S | 3 |
| anderson-c3-18 | 3 | ejemplo | Ej 3.18 L' de un cilindro girando a 3 km | ISA,Kutta-Joukowski | Γ=39.27 ±0.01; L'=892.7 ±1 N/m | Γ=39.27 m²/s; L'=892.7 N/m | parcial | potencial.ts:48 liftPerSpan; atmosfera.ts | S | 3 |
| anderson-c3-19 | 3 | ejemplo | Ej 3.19 Paneles de fuentes sobre el cilindro (8 paneles) | croquis,panel-2D,gate-masa | I_4,2=0.4018 ±5e-4; 8 λ a 4 cifras; ΣλS<1e-9; Cp<0.05 (8) y <1e-3 (64) | I_4,2=0.4018; λ/(2πV∞)=0.3765,0.2662,0,−0.2662,… | si | src/aero/panel2d.ts + panel2d.test.ts:57-166 (forja-gate vitest-aero); NO cableado al CAD | S | 5 |
| anderson-c3-20 | 3 | caso | Design Box: sonda Pitot-estática (tomas a 8d-16d) | croquis,revolve,panel-axisimétrico | Cp(nariz)=1; Cp_min∈[−1.4,−1.1]; /Cp/<0.02 en x/d∈[8,16] |  | no | panel2d.ts es plano | L | 3 |
| anderson-c3-21 | 3 | ejemplo | §3.18 Cilindro real: cables SPAD y árbol de Hugo (CD(Re)) | CD(Re),ISA | Re a 3 cifras; CD de curva ±10%; D=16,446 ±5% lb | d=4e-7 m; Re=9532 CD=1; Re=8.16e6 CD=0.7 D=16,446 lb | no | Fig 3.44 no digitalizada | M | 3 |
| anderson-c3-22 | 3 | teoria | IWC 3.22 Pérdida de p0 = D'/2 | CFD,estela | ∫(p0in−p0out)dy / D'_estela = 0.5 ±5% | IL=D'/2 | no | NS2D cualitativo | M | 2 |
| anderson-c3-23 | 3 | caso | IWC 3.23 Diseño conceptual de túnel subsónico | dimensionado-túnel,croquis,loft | sección 2×3×3.2; Pt=6.376e6 ±1e4 W; motor 1030 ±2 hp | 3×2×3.2 m; Pt=6.376e6 W; 1030 hp | no | loft en occt.ts | M | 4 |
| anderson-c3-24 | 3 | problema | P3.2 Venturi en fuselaje | cuasi-1D,revolve | V1=154.7 ±0.5 ft/s (derivado) |  | no |  | S | 2 |
| anderson-c3-25 | 3 | problema | P3.3 Vacío máximo del venturi a 90 m/s | cuasi-1D | Δp=1913 ±5 Pa (derivado) |  | no |  | S | 2 |
| anderson-c3-26 | 3 | problema | P3.4 V de sección desde 10 cm Hg | cuasi-1D,manómetro | V2=147.7 ±0.5 m/s (derivado) |  | no |  | S | 2 |
| anderson-c3-27 | 3 | problema | P3.5 Pitot en túnel sellado | Pitot | p0=1.0109e5 ±20 Pa (derivado) |  | no |  | S | 2 |
| anderson-c3-28 | 3 | problema | P3.6/3.7 Pitot 1.07e5 y Cp en el ala | Pitot,Cp | V=98.8 ±0.3 m/s; Cp=−0.73 ±0.01 |  | parcial | cpValue | S | 2 |
| anderson-c3-29 | 3 | problema | P3.12 Semicuerpo (fuente+uniforme) y su Cp | flujo-lego,croquis-generado | semiancho asintótico=π ft; Cp=1 nariz→0; curva ψ=Λ/2 <1e-6 |  | no | sin fuente/sumidero en potencial.ts | M | 4 |
| anderson-c3-30 | 3 | teoria | P3.13 Estancamiento del óvalo de Rankine (3.81) | flujo-lego | V=0 numérico coincide con (3.81) a 1e-6 | OA=sqrt(b²+Λb/(πV∞)) | no |  | S | 2 |
| anderson-c3-31 | 3 | teoria | P3.15 Cp(r,θ) del cilindro | cilindro,Cp | en r=R iguala cpCilindroExacto a 1e-12; →0 en r→∞ |  | parcial | ConformalMaps.tsx / potencial.ts campo | S | 2 |
| anderson-c3-32 | 3 | problema | P3.18 Γ de cilindro con L'=6 N/m | Kutta-Joukowski | Γ=0.1626 ±0.0005 m²/s |  | parcial | potencial.ts:48 liftPerSpan (sin inversa) | S | 1 |
| anderson-c3-33 | 3 | problema | P3.19 Montantes y cables del SPAD vs CD0 | CD(Re),performance | D≈176 lb ±15%; D0=305 lb → ~58% |  | no | sin CD(Re) | M | 3 |
| anderson-c3-34 | 3 | problema | P3.21 Espaciamiento de líneas de corriente | líneas-corriente | r3=1.432R ±0.001 |  | parcial | integrateStreamline (Joukowski) | S | 3 |
| anderson-c3-35 | 3 | problema | P3.22 V de túnel máxima incompresible (cilindro) | gate-compresibilidad | V∞=125 mi/h=55.9 m/s ±0.5; Cp_min=−3 del panel |  | parcial | panel2d.test Cp min −3; sin gate | S | 3 |
| anderson-c3-36 | 3 | teoria | P3.16/3.17 Invariancia de líneas de corriente | líneas-corriente | Hausdorff<1e-9R entre V∞=20 y 40; con Γ fija migran |  | parcial | potencial.test simetría | S | 1 |
| anderson-c4-01 | 4 | ejemplo | Ej 4.1 NACA 2412: de L' a α y D' | perfil-2D,ISA,polar-experimental,panel-2D | q y cl a 3 cifras; α=4 ±0.5°; cd∈[0.0065,0.0072]; D'=13.1 ±0.3 N/m | q=3013.5; cl=0.65; α=4°; Re=3.08e6; cd=0.0068; D'=13.1 N/m | parcial | atmosfera.ts; polar 2412 no digitalizada | M | 5 |
| anderson-c4-02 | 4 | ejemplo | Ej 4.2 Momento sobre el ac | perfil-2D,polar | M'ac=−61.7 ±0.1 N·m | M'ac=−61.7 N·m | no | grep cm_ac: nada | S | 3 |
| anderson-c4-03 | 4 | ejemplo | Ej 4.3 L/D del 2412 a 0,4,8,12° | polar-experimental | tabla ±(0.02,0.0005,3); max entre 4 y 8° | L/D=38.5, 93, 96, 85 | no |  | M | 4 |
| anderson-c4-04 | 4 | ejemplo | Ej 4.4 Vórtice de arranque | potencial-2D | Γ=14.56 ±0.01; Γ_perfil+Γ_arranque=0 | Γ=14.56 m²/s | parcial | potencial.ts:liftPerSpan | S | 2 |
| anderson-c4-05 | 4 | ejemplo | Ej 4.5 Placa plana a 5°: cl, cm_le, cm_c/4, cm_te | perfil-delgado | cl=2πα ±1e-3; cm_le=−cl/4; cm_c/4=0; cm_te=0.411 | cl=0.5485; cm_le=−0.137; cm_c/4=0; cm_te=0.411 | parcial | potencial.ts:liftCoefficient 2π sinα; sin momentos | S | 4 |
| anderson-c4-06 | 4 | ejemplo | Ej 4.6 NACA 23012 por perfil delgado (FIXTURE DE ORO) | croquis,cotas,perfil-delgado | αL0=−1.09 ±0.01°; cl=0.559 ±0.002; A1=0.0954; A2=0.0792; cm_c/4=−0.0127; xcp/c=0.273 | αL0=−1.09°; cl=0.559; cm_c/4=−0.0127; xcp/c=0.273 | no | grep A0/alphaL0 src/aero: nada | M | 5 |
| anderson-c4-07 | 4 | ejemplo | Ej 4.7 Centro aerodinámico del 23012 desde datos | estabilidad | x_ac=0.241 ±0.001 | x_ac=0.241 | no |  | S | 4 |
| anderson-c4-08 | 4 | ejemplo | Ej 4.8 δ y Cf laminar del 2412 (c=1.5 m) | capa-límite | δ=0.00426 m; Net Cf=0.0015 ±1e-5 | δ=0.00426 m; Net Cf=0.0015 | no | grep 1.328: nada | S | 3 |
| anderson-c4-09 | 4 | ejemplo | Ej 4.9 δ y Cf turbulento | capa-límite | δ=0.0279 m; Net Cf=0.00744 ±2e-5 | δ=0.0279 m; Net Cf=0.00744 | no |  | S | 3 |
| anderson-c4-10 | 4 | ejemplo | Ej 4.10 Cf con transición Re_cr=5e5 | capa-límite,transición | Net Cf=0.0063 ±5e-5 con Re_cr como ENTRADA | Net Cf=0.0063 | no |  | S | 4 |
| anderson-c4-11 | 4 | ejemplo | Ej 4.11 Sensibilidad a Re_cr=1e6 | capa-límite,transición | Net Cf=0.00528; 16 ±1% menor | Net Cf=0.00528 (16% menor) | no |  | S | 4 |
| anderson-c4-12 | 4 | ejemplo | x_cr a 50 y 100 m/s | capa-límite,ISA | x_cr=0.145 y 0.0727 m ±0.001 | x_cr=0.145 m; 0.0727 m | parcial | atmosfera.ts ρ/μ | S | 2 |
| anderson-c4-13 | 4 | caso | IWC 4.17 Paredes de túnel: imágenes y paneles | potencial-2D,panel-2D | v(x,0)<1e-9V; Cp_min<−3 y →−3 cuando h/R→∞; ΣλS=0 |  | parcial | panel2d.ts polilínea cerrada; paredes no | M | 3 |
| anderson-c4-14 | 4 | problema | P4.1 2412 a 4°, 50 ft/s, c=2 ft (imperial) | polar,ISA | q=2.971 lb/ft²; L'=3.86 ±0.15; M'c/4≈−0.59 |  | parcial | atmosfera.ts SI | M | 3 |
| anderson-c4-15 | 4 | problema | P4.2 De L'=1353 N/m al α | polar | cl=0.44; α≈1.9 ±0.5° |  | parcial |  | S | 3 |
| anderson-c4-16 | 4 | problema | P4.5 Simétrico a 1.5° | perfil-delgado | cl=0.1645; cm_le=−0.0411 ±1e-4 |  | parcial | liftCoefficient | S | 2 |
| anderson-c4-17 | 4 | problema | P4.6 NACA 4412 por perfil delgado: αL0 y cl(3°) | croquis,perfil-delgado | cuadratura vs analítico <0.1%; ref. literatura αL0≈−4.15° (NO impreso) |  | no |  | M | 4 |
| anderson-c4-18 | 4 | problema | P4.7 4412: cm_c/4 y xcp a 3° | perfil-delgado | cm_c/4=π/4(A2−A1) invariante en α; xcp por (4.66) |  | no |  | M | 4 |
| anderson-c4-19 | 4 | benchmark | P4.8 Teoría vs experimento 4412 (%) | perfil-delgado,polar,reporte | reporte /teo−exp//exp; verde si polar Ref.11 con cita |  | no |  | M | 3 |
| anderson-c4-20 | 4 | problema | P4.10 ac del 2412 desde dos ángulos | estabilidad | x_ac=0.2423 ±0.0005 |  | no |  | S | 3 |
| anderson-c4-21 | 4 | problema | P4.11 2412 a 3 km, 60 m/s: L' | ISA,perfil-2D | ρ(3km)=0.9093; L'=2128 ±5 N/m |  | parcial | atmosfera.ts | S | 3 |
| anderson-c4-22 | 4 | problema | P4.12 Circulación del P4.11 | potencial-2D | Γ=39.0 ±0.1 m²/s |  | si | potencial.ts:liftPerSpan/kuttaGamma | S | 2 |
| anderson-c4-23 | 4 | problema | P4.13 Cilindro Magnus: ω para igual L' | potencial-2D | ω=Γ/(2πR²)=6.21 ±0.05 rad/s |  | parcial | potencial.ts | S | 2 |
| anderson-c4-24 | 4 | problema | P4.14 ¿Vuela un perfil de cabeza? | perfil-2D | cl=0.8; invertido 0.2; α=11° |  | no |  | S | 2 |
| anderson-c4-25 | 4 | problema | P4.15 Spitfire 2213: V para Re=9e6 y Cf turb | ISA,capa-límite | μ(18kft)=3.47e-7; V=277 ±5 ft/s; Net Cf=0.0060 |  | parcial | atmosfera.ts (inglés no) | M | 4 |
| anderson-c4-26 | 4 | problema | P4.16 Spitfire con Re_cr=1e6 | capa-límite,transición | Net Cf=0.00526 ±5e-5; presión≈12% |  | no |  | S | 3 |
| anderson-c4-27 | 4 | teoria | P4.3/4.4/4.9 derivaciones (Kelvin, M'LE, cm_le) | perfil-delgado | cuadratura de (4.35) reproduce (4.36)/(4.62) <1e-6 | M'LE=−qc²πα/2; cm_le=−π/2(A0+A1−A2/2) | no |  | S | 1 |
| anderson-c5-01 | 5 | ejemplo | Ej 5.1 Ala AR=8, λ=0.8 a 5° | panel-3D,lifting-line | CL=0.4335 ±0.5%; CD,i=0.00789 ±1% con δ=τ=0.055 entrada | a=4.97/rad; CL=0.4335; CD,i=0.00789 | no | grep lifting src: cero; wing-metrics.ts solo S/AR/λ | M | 5 |
| anderson-c5-02 | 5 | ejemplo | Ej 5.2 Escalar CD,i de AR=6 a AR=10 | lifting-line | CD,i=0.0076 ±1%; a0=5.989 ±0.2% | CD,i=0.0076 | no |  | S | 4 |
| anderson-c5-03 | 5 | ejemplo | Ej 5.3 α de crucero del jet ejecutivo | lifting-line,performance | α=0.6 ±0.05° | a=4.627/rad; α=0.6° | no |  | S | 3 |
| anderson-c5-04 | 5 | ejemplo | Ej 5.4 Baron 58: el perfil te mintió (ANCLA) | croquis,loft,lifting-line,perfil-2D | CL=0.443 ±1%; CD=0.0148 ±1%; AR del sólido lofteado=7.61 ±0.5% | e=0.99; CL=0.443; CD=0.0065+0.0083=0.0148 | parcial | src/aero/wing-metrics.ts:metricasAla + panel2d.ts | M | 5 |
| anderson-c5-05 | 5 | benchmark | Invariante ala elíptica: δ=0, e=1, a=a0/(1+a0/πAR) | lifting-line | /δ/<1e-6; /e−1/<1e-6; a(AR=8,2π)=5.02655 ±1e-4; w(y) constante | δ=0, e=1; w=−Γ0/2b; a=a0/(1+a0/πAR) | no |  | S | 4 |
| anderson-c5-06 | 5 | problema | P5.1/5.2 Anillo de vórtice (Biot-Savart) | biot-savart | V=Γ/2R centro; ΓR²/(2(R²+A²)^1.5) eje a 1e-6 |  | no |  | S | 3 |
| anderson-c5-07 | 5 | problema | P5.3 Ala 23012 AR=8 λ=0.8 a 7° | lifting-line | cadena a/CL/CD,i con δ(λ,AR) propio ±5% |  | no |  | S | 4 |
| anderson-c5-08 | 5 | problema | P5.4 Piper Cherokee: α de crucero | performance,lifting-line | AR=6.02; CL=W/qS; α por (5.70); L=W |  | parcial | atmosfera.ts:presionDinamica (inglés no) | S | 4 |
| anderson-c5-09 | 5 | problema | P5.5 D_i del avión completo (e=0.64) | performance | dos vías (qSC_L²/πeAR y (W/b)²/πeq) coinciden a 1e-9 |  | no |  | S | 3 |
| anderson-c5-10 | 5 | problema | P5.6/5.7 Pendiente recta vs flecha 45° (AR 6 y 3) | lifting-line,VLM | Kuchemann vs Prandtl; VLM propio <5% a AR=6 |  | no |  | S | 4 |
| anderson-c5-11 | 5 | problema | P5.8 Wright y Lilienthal: corrección por AR | lifting-line | CL,Wright=0.546·a(3.5)/a(6.48) <0.546 |  | no |  | S | 3 |
| anderson-c5-12 | 5 | problema | P5.9 Spitfire a Vmax: CD,i y % | performance,ISA | CD,i=CL²/πAR; D=550ηHP/V; fracción; ρ(18,500 ft) ±0.5% |  | parcial | atmosfera.ts | M | 4 |
| anderson-c5-13 | 5 | problema | P5.10 Spitfire con λ=0.4 | lifting-line | CD,i=(1+δ)CL²/πAR; diferencia ~1-2% vs elíptica |  | no |  | S | 3 |
| anderson-c5-14 | 5 | problema | P5.11 Spitfire aproximación 70 mi/h | performance | CD,i un orden mayor que P5.9 |  | no |  | S | 3 |
| anderson-c5-15 | 5 | benchmark | Ala delta 60°: pendiente 0.05/deg, CLmax 1.3, L/D 9.3/16.5 | VLM,croquis | VLM → πAR/2 sin succión; Polhamus sube hacia 0.05/deg; declara que no reproduce CLmax | slope ~0.05/deg; stall ~35°; CLmax ~1.3; L/D 9.3 / 16.5 | no |  | L | 3 |
| anderson-c5-16 | 5 | benchmark | §5.4 Lifting-line numérico no lineal (post-stall 50°) | lifting-line | lineal: = Fourier <1%; convergencia monótona D=0.05 | within 20 percent | no |  | M | 3 |
| anderson-c6-01 | 6 | ejemplo | Ej 6.1 CD,o del P-35 desde la polar y e de Oswald | polar,performance | e=0.873 ±0.2%; CD,o=0.026 ±1%; Loftin 0.0251 <4% | AR=5.89; e=0.873; CD,o=0.026 | no | grep oswald: cero | S | 5 |
| anderson-c6-02 | 6 | ejemplo | Ej 6.2 (L/D)max del P-35 | polar,performance | 12.46 ±0.5%; en ese punto CD,o=CL²/πeAR | (CL/CD)max=12.46 | no |  | S | 5 |
| anderson-c6-03 | 6 | benchmark | Tabla 6.1 F-16XL CAWAPI: dispersión de 7 códigos | VLM,CFD | VLM del doble-delta cae en [0.438,0.468]; declara CD no predecible | CL 0.370-0.468; CD 0.111-0.162 (26%/42%) | no |  | L | 2 |
| anderson-c6-04 | 6 | problema | P6.3 Esfera y cilindro: dónde poner la toma | panel-3D | θ=48.6° (derivado); Cp,min esfera −1.25, cilindro −3 |  | parcial | panel2d.ts:cpCilindroExacto; esfera no | M | 3 |
| anderson-c6-05 | 6 | benchmark | Esfera: Vθ=1.5V∞sinθ, Cp=1−(9/4)sin²θ | panel-3D | paneles de fuente 3D sobre esfera teselada <2% con ~500 paneles; ΣσA=0 | Vθ=(3/2)V∞sinθ; Cp=1−(9/4)sin²θ; CD 0.4→0.1 en Re 3e5 | parcial | src/aero/skin.ts:pielDeMalla | M | 3 |
| anderson-c7-01 | 7 | ejemplo | Ej 7.1 e y h del aire de un cuarto | gasdinámica | todos ±0.5%; H/E=γ exacto | ρ=1.181; e=2.138e5 J/kg; h=2.993e5; H/E=1.4 | no | grep isentrop src: cero | S | 2 |
| anderson-c7-02 | 7 | ejemplo | Ej 7.2/7.3 Depósito blow-down: dp/dt y tiempo 10→20 atm | gasdinámica | dp/dt=2870 ±0.5%; t=352.3 s ±0.5% | dp/dt=2867.13 N/(m²s); 352.27 s | no |  | S | 2 |
| anderson-c7-03 | 7 | ejemplo | Ej 7.4 747 a 36,000 ft: T isentrópica | ISA,isentrópico | T=372.0 °R ±0.3%; ISA 36,000 ft p=476, T=391 | T=372 °R | parcial | atmosfera.ts (ISA sí) | S | 3 |
| anderson-c7-04 | 7 | ejemplo | Ej 7.5 Expansión 20→1 atm con y sin Δs | gasdinámica | 127.5 K y 175.3 K ±0.3% | (a) 127.5 K; (b) 175.3 K | no |  | S | 3 |
| anderson-c7-05 | 7 | ejemplo | Ej 7.6 Condiciones totales a 1000 m/s | isentrópico | T0=817.8 ±0.2%; p0=26.7 atm ±0.5% | T0=817.8 K; p0=26.7 atm | parcial | atmosfera.ts:mach | S | 4 |
| anderson-c7-06 | 7 | ejemplo | Ej 7.7 Pitot subsónico compresible a 10,000 ft | Pitot-compresible | V∞=862 ft/s ±0.3%; RECHAZA Bernoulli M>0.3 | T0=544.9 °R; V∞=862 ft/s | no |  | S | 4 |
| anderson-c7-07 | 7 | problema | P7.1/7.2 ρ, cp, cv, e, h en estancamiento de misil | gasdinámica | cp=6006, cv=4290 exactos; h/e=γ |  | no |  | S | 2 |
| anderson-c7-08 | 7 | problema | P7.3 Δh, Δe, Δs a través de un choque | gasdinámica,choque-normal | Δs>0; estados = choque normal M≈2.8 |  | no |  | S | 3 |
| anderson-c7-09 | 7 | problema | P7.4/7.5 ρ en el perfil y salida de tobera isentrópica | isentrópico | p/ρ^γ constante a 1e-9 |  | no |  | S | 3 |
| anderson-c7-10 | 7 | problema | P7.6 Compresibilidades τ_T y τ_s | gasdinámica | τ_T/τ_s=γ exacto |  | no |  | S | 1 |
| anderson-c7-11 | 7 | problema | P7.7/7.8 h0 y V de salida adiabática | gasdinámica | V=√(2cp(T0−T))≈896 m/s; h0 constante |  | no |  | S | 2 |
| anderson-c7-12 | 7 | problema | P7.9-7.12 V isentrópica en el perfil y % error Bernoulli | isentrópico,perfil-2D | error crece con la caída de p; banda de aviso |  | no |  | S | 4 |
| anderson-c7-13 | 7 | teoria | P7.13 Bernoulli como límite incompresible | teoría | error <1% a M<0.3 |  | no |  | S | 1 |
| anderson-c8-01 | 8 | ejemplo | Ej 8.1 Mach de un avión a 250 m/s en 3 altitudes | ISA | mach(h,V)=0.735/0.78/0.835 ±0.005 | M=0.735; 0.78; 0.835 | si | src/aero/atmosfera.ts:mach | S | 2 |
| anderson-c8-02 | 8 | ejemplo | Ej 8.7 T0 y p0 desde M=2.79 | isentrópico | T0/T=2.557 ±0.001; p0/p=26.7 ±0.1 | T0=818 K; p0=26.7 atm | no | CURRICULUM a7-l2 ❌ gasdinamica.ts | S | 3 |
| anderson-c8-03 | 8 | ejemplo | Ej 8.8 p0,T0,T*,a*,M* en un punto | isentrópico | p0/p=76.27 ±0.05; T*=T0/1.2; M*²=4.26 ±0.01 | p0=22.9 atm; T0=621 K; T*=517.5 K; a*=456; M*=2.06 | no |  | S | 3 |
| anderson-c8-04 | 8 | ejemplo | Ej 8.9/8.10 M y V local sobre perfil subsónico compresible | isentrópico,perfil-2D | M1=0.90 ±0.005; V1=965 ±2 ft/s | p0=1.276 atm; M1=0.9; V1=965.4 ft/s | no |  | S | 3 |
| anderson-c8-05 | 8 | ejemplo | §8.5 ¿Cuándo compresible? Tobera 350 vs 900 ft/s | isentrópico,tobera | p(350)=1974 ±2; p(900)=1300 ±3 lb/ft²; bandera M>0.3 | 0.2% vs 13%; ρ/ρ0<5% para M<0.32 | no |  | S | 3 |
| anderson-c8-06 | 8 | ejemplo | Ej 8.11 Choque normal: estado aguas abajo | choque-normal | 8.59/8.65/8.67 en M1=2 → 0.5774/4.5/1.6875 ±1e-4; T02=T01 | p2=4.5 atm; T2=486 K; u2=255 m/s | no | grep normal shock src: nada | S | 4 |
| anderson-c8-07 | 8 | ejemplo | Ej 8.12 Pérdida de p0: M=2 vs M=4 | choque-normal | p02/p01=0.7209 y 0.1388 ±5e-4 | pérdida 2.184 atm; 130.7 atm | no |  | S | 3 |
| anderson-c8-08 | 8 | ejemplo | Ej 8.13 Ramjet a Mach 2 en 10 km | choque-normal,isentrópico,toma | p2=1.45e5 ±1%; T2=399 ±1 K | p2=1.45e5 N/m²; T2=399 K | no |  | S | 4 |
| anderson-c8-09 | 8 | ejemplo | Ej 8.14 El mismo ramjet a Mach 10 (SCRAMjet) | choque-normal,toma | p2=32.7 atm ±1%; T2=4653 K; bandera gas perfecto inválido | p2=32.7 atm; T2=4653 K | no |  | S | 3 |
| anderson-c8-10 | 8 | ejemplo | Ej 8.15-8.17 Choque normal INVERSO | choque-normal | inversas por bisección → M1=2/5/3 ±1e-3 | M1=2; 5; 3 | no |  | S | 3 |
| anderson-c8-11 | 8 | ejemplo | Ej 8.22 Pitot compresible: decidir sub/supersónico | Pitot-Rayleigh | umbral 1.893; M=0.6/1.3/3.0 ±0.005 | M=0.6; 1.3; 3.0 | no |  | S | 4 |
| anderson-c8-12 | 8 | ejemplo | Ej 8.23 Estancamiento nariz roma a Mach 8 | Pitot-Rayleigh | p02/p1=82.87 ±0.05; ps=8.07e4 ±0.5% | ps=38.1 atm | no |  | S | 3 |
| anderson-c8-13 | 8 | ejemplo | Ej 8.24 Velocidad del SR-71 desde Pitot a 25 km | Pitot-Rayleigh,ISA | ISA(25000) p=2527 ±3; M=3.40 ±0.01; V=1003 ±3 | M1=3.4; V1=1003 m/s | parcial | atmosfera.ts | S | 4 |
| anderson-c8-14 | 8 | problema | P8.6 Punto sónico a M∞=0.82 en 10,000 ft | ISA,isentrópico | p*=0.5283p0, T*=0.8333T0 ±0.5% |  | parcial | atmosfera.ts | S | 3 |
| anderson-c8-15 | 8 | problema | P8.7 Choque normal M1=2.6 completo + entropía | choque-normal | vs fila Ap.B ±0.5%; T02=T01; ds=−R ln(p02/p01) |  | no |  | S | 4 |
| anderson-c8-16 | 8 | problema | P8.9 M1 desde el salto de entropía | choque-normal | bisección /ds−199.5/<0.1 |  | no |  | S | 3 |
| anderson-c8-17 | 8 | problema | P8.11/8.13 Pitot subsónico y error de Bernoulli | Pitot,isentrópico | p0/p=1.555<1.893; error % reportado |  | no |  | S | 3 |
| anderson-c8-18 | 8 | problema | P8.15 T0 del SR-71 a 2112 mi/h, 80,000 ft | ISA,isentrópico | T0=T·(1+0.2M²) en °F |  | parcial | atmosfera.ts | S | 3 |
| anderson-c8-19 | 8 | problema | P8.17/8.18 Apollo Mach 36: γ efectiva | isentrópico | T0(1.4)=300·(1+0.2·1296); γ para 11,000 K; etiqueta fuera de validez |  | no |  | S | 2 |
| anderson-c9-01 | 9 | ejemplo | Ej 9.1 Cono de Mach y sonic boom | cono-de-Mach | μ=asin(1/M); d=27.71 km ±0.05 | μ=30°; d=27.7 km | parcial | cuna-anderson.ts resolverChoqueOblicuo(M,0) | S | 3 |
| anderson-c9-02 | 9 | ejemplo | Ej 9.2 Choque oblicuo 20° a Mach 2: estado completo | θ-β-M,choque-oblicuo,isentrópico | β=53.4 ±0.3°; M2=1.21 ±0.01; p02=7.00 ±0.05 atm; NO usar p02/p1 | β=53.4°; M2=1.21; p2=2.82 atm; T2=399.7 K; p02=7.00 atm | parcial | cuna-anderson.ts β; viento.ts p2; faltan M2,T2,p02 | S | 5 |
| anderson-c9-03 | 9 | ejemplo | Ej 9.3 Dado β=30° y M1=2.4 | θ-β-M | θ=6.5 ±0.1°; M2=2.11 ±0.02 | θ=6.5°; M2=2.11 | parcial | cuna-anderson.ts:thetaDeBeta | S | 3 |
| anderson-c9-04 | 9 | ejemplo | Ej 9.5 Frenar Mach 3: normal vs oblicuo 40°+normal | toma-supersónica | 0.578/0.3283=1.76 ±0.02 | ratio=1.76 (76% más p0) | no |  | S | 4 |
| anderson-c9-05 | 9 | ejemplo | Ej 9.6 cd de onda de cuña 15° a Mach 5 | croquis,estudio-viento,θ-β-M | Dp/(qc)=0.114 ±0.002 aislando presión | β=24.2°; p2/p1=4.736; cd=0.114 | parcial | viento.ts (suma τ empírico; sin cd presión aislado) | S | 5 |
| anderson-c9-06 | 9 | ejemplo | Ej 9.7 Reflexión de choque en pared | reflexión-de-choque | Φ=17.3 ±0.3°; M3=2.55 ±0.03; p3=9774 ±1% | Φ=17.3°; M3=2.55; p3=9774 lb/ft²; T3=825 °R | no |  | M | 4 |
| anderson-c9-07 | 9 | ejemplo | Ej 9.8 Entropía por línea de corriente tras choque de proa (M=8) | choque-oblicuo,cuerpo-romo | ds=1370 ±5 y 1180 ±10 J/(kg K) | s2−s1=1370; 1180 J/(kg K) | no |  | M | 3 |
| anderson-c9-08 | 9 | ejemplo | Ej 9.9 Expansión Prandtl-Meyer 15° desde M=1.5 | Prandtl-Meyer | ν(1.5)=11.91 ±0.01°; M(26.91°)=2.00; p02=p01; p2=0.469 ±0.003 | M2=2.0; p2=0.469 atm; T2=232 K; p02=3.671 atm | no | grep prandtl src/aero: nada | S | 5 |
| anderson-c9-09 | 9 | ejemplo | Ej 9.10 Compresión isentrópica 15° a Mach 10 | Prandtl-Meyer | M(87.3°)=6.4 ±0.05; p2=18.0 ±0.3 atm | M2=6.4; p2=18.02 atm | no |  | S | 3 |
| anderson-c9-10 | 9 | ejemplo | Ej 9.11 Mismo giro con choque: pérdida 77% de p0 | θ-β-M,Prandtl-Meyer | β=20.0 ±0.3°; M2=5.22 ±0.05; p02/p01=0.232 ±0.003 | β=20°; M2=5.22; p2=13.32 atm; p02=9.85e3 atm | parcial | cuna-anderson.ts β | S | 3 |
| anderson-c9-11 | 9 | ejemplo | Ej 9.12 Placa plana 5° Mach 3: cl y cd por choque-expansión | croquis,shock-expansion | cl=0.125 ±0.003; cd=0.011 ±0.001; cd/cl=tanα exacto | cl=0.125; cd=0.011 | no | viento.ts solo cuña a α=0 | M | 5 |
| anderson-c9-12 | 9 | ejemplo | Ej 9.13 Cola de cuña del X-15: cl placa vs cuña | croquis,shock-expansion | cl_placa=0.126 ±0.004; cl_cuña=0.241 ±0.006; ratio≈2 | cl=0.126 (placa); 0.241 (cuña) | no |  | M | 4 |
| anderson-c9-13 | 9 | caso | IWC 9.14 Sonic boom: onda N, Concorde, F-5E | shock-expansion,sonic-boom | a=968 ±1 ft/s; Δt=0.103 ±0.001 s | a=968 ft/s; V=1936 ft/s; Δt=0.103 s | no |  | L | 3 |
| anderson-c9-14 | 9 | problema | P9.2 Choque β=30° a Mach 4 en 10 km | θ-β-M,choque-oblicuo | Mn1=2 → fila M=2 ±1e-3; T02=T01 |  | parcial | thetaDeBeta | S | 4 |
| anderson-c9-15 | 9 | problema | P9.6 p máxima con choque adherido a Mach 2.4 | θ-β-M | α=θmax(2.4); α+0.01° ⇒ desprendido=true |  | parcial | cuna-anderson.ts:deflexionMaxima | S | 3 |
| anderson-c9-16 | 9 | problema | P9.7 Pitot tras choque de cuña 30.2° a Mach 3.5 | θ-β-M,Pitot-Rayleigh | cadena β→M2→Rayleigh; p_Pitot<p01 |  | parcial | β sí; Rayleigh no | S | 4 |
| anderson-c9-17 | 9 | problema | P9.8 Toma: 1, 2 y 3 choques para Mach 4 | toma-supersónica | recuperación (a)<(b)<(c); Σds=−R ln(p0f/p01) |  | no |  | M | 4 |
| anderson-c9-18 | 9 | problema | P9.9 Reflexión θ=18.2° a Mach 3.2 | reflexión-de-choque | como Ej 9.7; Mach reflection si θ>θmax(M2) |  | no |  | S | 3 |
| anderson-c9-19 | 9 | problema | P9.13 Placa a Mach 2.6: cl, cd_w para 5/15/30° | shock-expansion | cd=cl tanα; 5° ≈ lineal 0.1454 (<5%); 30° vs θmax desprendido |  | no |  | M | 4 |
| anderson-c9-20 | 9 | problema | P9.14 Rombo ε=10° a α=15°, Mach 3 | croquis,shock-expansion | 4 caras; α=0 ⇒ cl=0 y D'=(p2−p3)t |  | no |  | M | 5 |
| anderson-c9-21 | 9 | problema | P9.16 Cilindro (cd=4/3) vs rombo 5° a Mach 5 | shock-expansion,cuerpo-romo | ratio ≫1 (10-30) |  | no |  | S | 3 |
| anderson-c9-22 | 9 | problema | P9.18/9.19 Ducto con pared a 3°/30°: abanico PM vs cuasi-1D | Prandtl-Meyer,tobera-2D | x_A=h0/tan μ1; promedio ∈[M1,M2] |  | no |  | M | 3 |
| anderson-c9-23 | 9 | tutorial | P9.21 Nube del F/A-18: condensación en la expansión | Prandtl-Meyer,choque-normal | 0.2569 ±0.001; 0.2941 ±0.003 (libro 0.2923) | dpH2O/dT=0.256; 0.2923 | no |  | S | 2 |
| anderson-c10-01 | 10 | ejemplo | Ej 10.1 Tobera Ae/A*=10.25 | gasdinámica-1D,tobera | Me=3.95 ±1%; pe=0.035 atm; Te=145.6 R | Me=3.95; pe=0.035 atm; Te=145.6 °R | no | grep areaMach src: nada | S | 4 |
| anderson-c10-02 | 10 | ejemplo | Ej 10.2 Tobera Ae/A*=2: dos soluciones | gasdinámica-1D,tobera | raíces 2.2 y 0.3 ±2%; p*/p0=0.5283, T*/T0=0.8333 exactas | (a) Me=2.2, pe=0.0935 atm; (b) Me=0.3, pe=0.94 atm | no |  | S | 5 |
| anderson-c10-03 | 10 | ejemplo | Ej 10.3 pe=0.973 atm: garganta NO sónica | tobera | Mt=0.44 ±3%; At/A*=1.482>1 | Me=0.2; At/A*=1.482; Mt=0.44 | no |  | S | 4 |
| anderson-c10-04 | 10 | ejemplo | Ej 10.4 Motor cohete H2/O2 (γ=1.22): empuje y Ae | tobera,ISA,revolve | T=2.17e6 N ±1%; Ae=16.5 m² ±1%; ue por energía vs Me·ae <0.5%; p(20 km)=5529 Pa | ṁ=586.4 kg/s; Me=4.38; ue=3700 m/s; T=2.17e6 N; Ae=16.5 m² | parcial | atmosfera.ts (20 km) | M | 5 |
| anderson-c10-05 | 10 | ejemplo | Ej 10.5 Gasto ahogado cerrado (E10.3) | tobera | ṁ=583.2 ±0.5% (ojo: libro usa R=510); /cadena−cerrada/<1% | ṁ=583.2 kg/s | no |  | S | 4 |
| anderson-c10-06 | 10 | ejemplo | Ej 10.6 Segunda garganta de túnel Mach 2 | choque-normal,túnel | At2/At1=1.387 ±0.5% | At,2/At,1=1.387 | no |  | S | 4 |
| anderson-c10-07 | 10 | caso | IWC 10.8 Túnel blowdown Mach 2 completo | túnel,gasdinámica-1D,croquis,planeación | Re=23e6 ±3%; ṁ=7.05 lbm/s ±2%; V_tanque=9049 ft³ ±2%; 2h=2.31 ft | sección 3×3.5 ft; p01=1.387 atm; Re=23e6; ṁ=7.05 lbm/s; tanque 9049 ft³ | no |  | L | 5 |
| anderson-c10-08 | 10 | problema | P10.1 Tobera Ae/A*=2.193: salida completa | tobera | p0e=p0, T0e=T0; ρe cierra <0.5% |  | no |  | S | 3 |
| anderson-c10-09 | 10 | problema | P10.2 Ae/A* desde pe/p0 | gasdinámica-1D | round-trip a 1e-6 |  | no |  | S | 3 |
| anderson-c10-10 | 10 | problema | P10.3 Ae/A* desde Pitot supersónico | choque-normal,gasdinámica-1D | p02/p01=0.4416 → M → A/A*; recompute <1e-5 |  | no |  | M | 3 |
| anderson-c10-11 | 10 | problema | P10.4/10.6 Gasto con At=4 in²: cadena vs cerrada | tobera | coinciden <0.5% |  | no |  | S | 3 |
| anderson-c10-12 | 10 | problema | P10.7/10.8 Ae/A*=1.616 con pe=0.947: Mt y gasto | tobera | Mt<1; ṁ continuidad <1e-6 |  | no |  | S | 3 |
| anderson-c10-13 | 10 | problema | P10.9 Ae/A*=1.53 con cuatro contrapresiones | tobera,choque-normal | clasificación automática; choque interno por bisección /pe−pe_calc/<1e-4 atm |  | no |  | M | 5 |
| anderson-c10-14 | 10 | problema | P10.10 Ae/A* del túnel desde β de una cuña de 20° | choque-oblicuo,croquis | M de thetaDeBeta(M,41.8°)=20°; A/A* supersónico; el alumno DIBUJA la cuña |  | parcial | cuna-anderson.ts:thetaDeBeta | S | 4 |
| anderson-c10-15 | 10 | problema | P10.11 p0 del túnel desde Pitot (Ae/A*=6.79) | choque-normal | round-trip Pitot <1e-5 |  | no |  | S | 3 |
| anderson-c10-16 | 10 | problema | P10.12 Túnel Mach 2.8 con ṁ=1 slug/s | túnel,ISA | p0,T0 exactos; A*, Ae, At2>At |  | parcial | atmosfera.ts | M | 5 |
| anderson-c10-17 | 10 | problema | P10.13 p de cámara de cohete desde ṁ (γ=1.2, PM=16) | tobera | (E10.3) invertida con R=Ru/PM ±0.1% |  | no |  | S | 4 |
| anderson-c10-18 | 10 | problema | P10.14 p0 mínima con η_D=1.2 a Mach 3 | túnel,choque-normal | p0=pa/(η_D·p02/p01(3)) |  | no |  | S | 3 |
| anderson-c10-19 | 10 | problema | P10.17/10.18 Línea de corriente en abanico PM (M 1→1.6) | Prandtl-Meyer,croquis | giro total ν(1.6)−ν(1); tangente continua |  | no |  | M | 2 |
| anderson-c11-01 | 11 | ejemplo | Ej 11.1 Prandtl-Glauert sobre Cp puntual | compresibilidad-PG,panel-2D | Cp=−0.375 ±0.1% | Cp=−0.375 | no | grep glauert: nada; panel2d.ts da Cp0 | S | 4 |
| anderson-c11-02 | 11 | ejemplo | Ej 11.2 Pendiente a M=0.7: +40% | compresibilidad-PG | 8.8/rad ±0.5%; marca borde de validez | cl=8.8α; 1.4× | no |  | S | 4 |
| anderson-c11-03 | 11 | ejemplo | Ej 11.3 Mach crítico del NACA 0012: 0.7371 vs 0.73 | mach-crítico,panel-2D,croquis | raíz de (11.63)=0.7371 ±0.001; Cp,cr(M) ±1%; Cp0,min de panel2d ≈−0.43 ±10% en x/c≈0.1 | Mcr=0.74 (gráfico); 0.7371 (analítico); exp 0.73 | parcial | panel2d.ts + potencial.ts:nacaProfile (00xx) | M | 5 |
| anderson-c11-04 | 11 | caso | IWC 11.16 Wing-flow del P-51: M local 1.23 con K-T | compresibilidad-PG,isentrópico | Cp(K-T)=−1.0419 ±0.1%; M_A=1.23 ±0.5% | Cp=−1.0419; M_A=1.23 (7% vs Gilruth) | no |  | M | 3 |
| anderson-c11-05 | 11 | problema | P11.1 M,p,T desde potencial subsónico dado | isentrópico | exacta (11.27) vs lineal (11.30) <2% |  | no |  | S | 2 |
| anderson-c11-06 | 11 | problema | P11.2 cl del 2412 a 5° y M=0.6 por P-G | compresibilidad-PG,panel-2D | cl0 de panel2d (vs 2π(α−αL0) <5%) → /0.8; 2412 tiene COMBA (nacaProfile solo 00xx) |  | parcial | panel2d.ts; nacaProfile simétrico | S | 4 |
| anderson-c11-07 | 11 | problema | P11.3 P-G, K-T, Laitone sobre Cp0=−0.54 a M=0.58 | compresibilidad-PG | P-G ±0.1%; /Laitone/≥/K-T/≥/P-G/ |  | no |  | S | 4 |
| anderson-c11-08 | 11 | problema | P11.4 Mcr con Cp0,min=−0.41 | mach-crítico | raíz tol 1e-4; Mcr(−0.41)>0.7371 |  | no |  | S | 4 |
| anderson-c11-09 | 11 | problema | P11.5 p/p∞ en el mínimo cuando M∞=Mcr=0.8 | isentrópico,mach-crítico | (11.56) con M_A=1; coherente con Cp,cr(0.8)=−0.435 ±1% |  | no |  | S | 3 |
| anderson-c11-10 | 11 | problema | P11.6 Cp desde M∞=0.5 y M local 0.86 | isentrópico | (11.58) vs tablas <1% |  | no |  | S | 3 |
| anderson-c11-11 | 11 | problema | P11.7 Mcr=0.61 del perfil de la Fig 11.5 | mach-crítico,compresibilidad-PG | M_A(0.5)=0.772 ±1%; M_A(0.61)=1.00 ±1% | M∞=0.5→M_A=0.772; 0.61→1.0 | no |  | S | 4 |
| anderson-c11-12 | 11 | problema | P11.9 Mcr del cilindro: dentro de 3.5% de 0.404 | mach-crítico,panel-2D | Cp0,min=−3; raíz dentro de 3.5% de 0.404 | Mcr cilindro 0.404; esfera 0.57; within 3.5% | parcial | panel2d.ts:cpCilindroExacto, circulo | S | 4 |
| anderson-c11-13 | 11 | caso | Regla del área transónica: A(x) del sólido completo | sección-área,ensamble,loft | ∫A(x)dx=volumen <0.5%; métrica de suavidad menor en area-ruled |  | parcial | occt.ts (cortes, masa-inercia); falta barrido A(x) | M | 5 |
| anderson-c11-14 | 11 | caso | Pendiente compresible de ala finita (11.64-11.68) | performance,compresibilidad-PG | límites M→0 recuperan 5.70/5.81/5.82; t/c efectivo 0.106 a 45° | t2/c2=0.106 para Λ=45° | no | wing-metrics.ts sin pendiente | S | 3 |
| anderson-c12-01 | 12 | ejemplo | Ej 12.1 Placa 5° Mach 3: lineal vs exacto (1.6%) | supersónico-lineal,shock-expansion | cl=0.123 ±0.5%; cd=0.011; /Δcl/≤2% vs exacto | cl=0.123; cd=0.011 (exacto 0.125/0.011) | parcial | cuna-anderson.ts (compresión exacta) | S | 5 |
| anderson-c12-02 | 12 | ejemplo | Ej 12.2 F-104 a Mach 2 y 11 km vuela a 1.98° | supersónico-lineal,ISA,performance | α=0.035 rad ±1%; ISA 11 km ρ=0.3648, T=216.78 ±0.2% | CL=0.08; α=1.98° | parcial | atmosfera.ts | S | 5 |
| anderson-c12-03 | 12 | ejemplo | Ej 12.3 F-104: fricción vs onda; L/D 28.3→11.2 | supersónico-lineal,fricción-compresible,Sutherland | μ=1.4226e-5 ±0.1%; Re=3.33e7; cd,onda=2.83e-3; L/D=11.2 ±1%; α_igualdad=2.47° | Cf=4.3e-3; cd,w=2.83e-3; fricción 60%; L/D 28.3→11.2 | no | skin.ts integra τ dado; sin Cf/Sutherland | M | 4 |
| anderson-c12-04 | 12 | caso | Regla del área SUPERSÓNICA del F-16 (cortes al ángulo de Mach) | sección-área,ensamble | μ=38.7°/56.4° exactos; A_oblicua suave; M→1 recupera A(x) | μ=38.7° (M=1.6); 56.4° (M=1.2) | parcial | occt.ts cortes; sin barrido oblicuo | M | 4 |
| anderson-c12-05 | 12 | problema | P12.1 Placa Mach 2.6 a 5/15/30°: lineal vs exacto | supersónico-lineal,shock-expansion | 5°: 0.1454/0.0127; 15°: 0.4363/0.1142; 30°: 0.8727/0.4569 ±0.1%; L/D=cotα exacto; desprendido avisa |  | parcial | cuna-anderson.ts desprendido | S | 4 |
| anderson-c12-06 | 12 | problema | P12.2 p/p∞ arriba y abajo: lineal vs exacto | supersónico-lineal | p/p∞=1+(γ/2)M²Cp; error de presión > error de cl |  | parcial |  | S | 3 |
| anderson-c12-07 | 12 | problema | P12.3 Diamante ε=10° α=15° Mach 3 lineal | supersónico-lineal,croquis | cl=4α/√8=0.370; cd=(4/√8)(α²+tan²ε)=0.140 ±1%; ε medido del croquis |  | no | viento.ts solo cuña | M | 4 |
| anderson-c12-08 | 12 | teoria | P12.5 (L/D)max de placa no viscosa | supersónico-lineal | L/D=1/α sin máximo (α→0) |  | no |  | S | 2 |
| anderson-c12-09 | 12 | problema | P12.6 α óptimo y (L/D)max con Cf (RESPUESTA IMPRESA) | supersónico-lineal,fricción | fórmulas exactas; barrido coincide <0.1%; cd,onda=Cf en el óptimo | α=(Cf)^½(M²−1)^¼/2; (cl/cd)max=(Cf)^−½(M²−1)^−¼ | no |  | S | 4 |
| anderson-c12-10 | 12 | problema | P12.7 (L/D)max del F-104 plano con Cf=4.3e-3 | supersónico-lineal,performance | α_opt=2.47° ±1%; (L/D)max>11.2 |  | no |  | S | 4 |
| anderson-c13-01 | 13 | problema | P13.1 Proceso unitario del MOC: punto 3 desde 1 y 2 | MOC-2D,Prandtl-Meyer | K± ±1e-9; derivado: θ3=10°, M3≈2.39, (x3,y3)≈(0.089,0.049) m ±2% |  | no | grep moc/caracter src: nada | S | 4 |
| anderson-c13-02 | 13 | caso | Diseño del contorno de tobera supersónica por MOC (§13.3) | MOC-2D,croquis,extruir,plano2D | semialtura salida/garganta = A/A*(Me): 1.6875 (M=2), 2.6367 (M=2.5) ±0.5%; Me uniforme <0.5%; θ_salida=0 |  | no | CRUCE-Y-PLAN fila 8 (plan) | M | 5 |
| anderson-c13-03 | 13 | tutorial | MacCormack marchando en x por ducto divergente (§13.4) | CFD,croquis | ∫ρu dy const ±1e-3; vs MOC y cuasi-1D ±2%; p0,T0 const ±0.5% |  | no |  | L | 3 |
| anderson-c13-04 | 13 | benchmark | Cuerpo romo time-marching: cilindro parabólico M=4 y 8 | CFD,panel-3D | Cp estanc. 1.79 (M=4), 1.83 (M=8) ±2%; choque más cerca a M=8; nariz vs newtoniana ±5% |  | no | ForgeBRepStudio.tsx:2051 post-proceso solo analítico | L | 4 |
| anderson-c13-05 | 13 | benchmark | Taylor-Maccoll: cono por método inverso + carta θc-θs-M | EDO,revolve,aero-3D | β_cono<β_cuña; θc,max cono>cuña; Vθ(θc)=0 ±1e-6; vs Sims ±0.5% |  | no | grep taylor src/aero: nada | M | 4 |
| anderson-c14-01 | 14 | ejemplo | Ej 14.1(a) Placa 15° Mach 8 exacta | shock-expansion,Prandtl-Meyer | impresos ±2%; L/D=cot15°=3.732 ±0.1% | Cp2=−0.0219; Cp3=0.1885; cl=0.2032; cd=0.0545; L/D=3.73 | parcial | cuna-anderson.ts intradós; sin ν(M) | S | 5 |
| anderson-c14-02 | 14 | ejemplo | Ej 14.1(b) La misma placa por Newton | newtoniana | impresos ±1%; errores 29%/100%/36.6% ±2%; L/D exacto | Cp3=0.134; cl=0.1294; cd=0.03468; L/D=3.73 | no | grep newtonian src/aero: nada | S | 4 |
| anderson-c14-03 | 14 | ejemplo | Ej 14.2 Calentamiento de estancamiento del Shuttle (Tauber-Meneses) | térmico,ISA | 45.78 W/cm² ±1%; ±3% vs Zoby 45; unidades W/cm², m/s, kg/m³, m | h0=2.185e7 J/kg; hw/h0=0.051; q_w=45.78 W/cm² (Zoby 45) | parcial | atmosfera.ts hasta 84.852 km | S | 5 |
| anderson-c14-04 | 14 | caso | Cp newtoniano modificado sobre la malla B-Rep de cualquier pieza | panel-3D,piel,revolve,choque-normal | Cp,max 1.79/1.83 ±1%; esfera CD=1, cilindro 4/3, placa 2, cono 2sin²θc ±0.5% |  | parcial | src/aero/skin.ts:pielDeMalla/integrarPresion; newtoniana.ts ❌ | M | 5 |
| anderson-c14-05 | 14 | ejemplo | Curvas newtonianas de placa: cl,max=0.77 a 54.7°, (L/D)max con fricción | newtoniana,optimización | cl,max=4/(3√3)=0.7698; α=54.74°; identidades 14.23-14.27 ±1e-9 | cl,max=0.77 a 54.7°; α*=(cd0)^1/3; (L/D)max=0.67/(cd0)^1/3; cd,w=2cd0 | no |  | S | 3 |
| anderson-c14-06 | 14 | ejemplo | T tras choque normal a M=36: 65,248 K vs 11,000 K | choque-normal,ISA | T2/T1=252.94 → 65,248 K ±0.1%; etiqueta fuera de validez | Ts=65,248 K (gas perfecto); ~11,000 K (reactivo) | parcial | atmosfera.ts (59 km da 248 K, libro 258 K) | S | 3 |
| anderson-c14-07 | 14 | ejemplo | Cuña 15° a M=36: β=18° y límite β=1.2θ | choque-oblicuo | resolverChoqueOblicuo(36,15°)≈18.2° ±2%; ρ2/ρ1→6; Cp→0.163 | β=18°; β=1.2θ | si | src/aero/cuna-anderson.ts:resolverChoqueOblicuo | S | 2 |
| anderson-c14-08 | 14 | benchmark | Independencia de Mach: cuña y cono 15° vs M (Fig 14.15) | choque-oblicuo,EDO,newtoniana | límites ±1e-9; Cp_cono<Cp_cuña; /Cp(M)−Cp(∞)/<5% para M>10 |  | parcial | cuña sí; cono no | M | 3 |
| anderson-c14-09 | 14 | problema | P14.1 Placa Mach 2.6 por Newton y Newton modificado | newtoniana,shock-expansion | Cp,max(2.6)=1.73 ±1%; L/D=cotα; Newton se aparta >30% |  | parcial |  | S | 3 |
| anderson-c14-10 | 14 | problema | P14.2 Placa 20° Mach 20: Newton vs exacto | newtoniana,shock-expansion | cl=0.2199; cd=0.0800; L/D=2.747; dorso Cp2→−0.0036 |  | parcial |  | S | 3 |
| anderson-c14-11 | 14 | problema | P14.3 Nariz esférica M=20 a 150,000 ft: p,T,M,V a 20° | newtoniana,choque-normal,isentrópico | Cp,max≈1.84; p≈1.39e3 lb/ft²; M≈0.43 (derivados ±3%); etiqueta T>2000 K |  | no |  | S | 3 |
| anderson-c14-12 | 14 | caso | Waverider caret de Nonweiler en el CAD | croquis,loft,choque-oblicuo,panel-3D | bordes de ataque en el plano de choque <1e-6·l; Cp intradós uniforme=(14.38); L/D=cotδ; vol=prisma ±1e-6 |  | no | occt.ts sí; generador no | M | 4 |
| anderson-c14-13 | 14 | benchmark | Waverider cónico viscoso-optimizado M=6 (Bowcutt): θs óptimo 12° | EDO,loft,capa-límite,optimización | θs óptimo=12°; 8<(L/D)max<9; D_onda/D_fricción∈[0.5,2] | óptimo en θs=12°; onda/fricción <2× | no |  | L | 4 |
| anderson-c14-14 | 14 | teoria | Barrera L/D: Kuchemann 4(M+3)/M vs waverider 6(M+2)/M | performance | M=5→6.40/8.40; M=10→5.20/7.20; waverider>Kuchemann ∀M | (L/D)max=4(M+3)/M; 6(M+2)/M | no |  | S | 2 |
| anderson-c14-15 | 14 | caso | Dimensionar el radio de nariz: q_w∝1/√R | térmico,revolve,fillet | q_w·√R=52.0 const ±1e-9; R=0.1 m→164 W/cm²; R(30 W/cm²)=3.0 m | q_w∝1/√R; Q_total=½(Cf/CD)(½mVE²) | no | fillet en occt.ts | S | 4 |
| anderson-c14-16 | 14 | benchmark | Orbiter M=23 α=30°: presión y Cm (caso de alarma) | panel-3D,newtoniana,momentos | p/p∞≈170 en el fondo plano ±20%; Cm∈±0.04; brecha gas real declarada |  | parcial | wing-metrics.ts fixture Orbiter + skin.ts | L | 3 |
| anderson-c15-01 | 15 | problema | P15.1 Couette de aire: cortante con Sutherland a 320 K | Couette,Sutherland | u=ue y/h; τ=μue/h igual en ambas; μ(320)=1.94e-5 → τ=0.058 Pa ±1% (derivado) |  | no | grep couette/sutherland src/aero: nada (mold/cojinete = otro dominio) | S | 4 |
| anderson-c15-02 | 15 | teoria | P15.2 Poiseuille plano | Couette | u parabólico; τw=±(h/2)dp/dx; Q=−h³/(12μ)dp/dx |  | parcial | src/forja/mold/fan.ts (Hele-Shaw, otro dominio) | S | 2 |
| anderson-c15-03 | 15 | ejemplo | Re_cr medido: xcr=0.05 m a 120 m/s → 412,000 | transición,estudio-viento | 412,000 ±0.5%; xcr(240)=0.025 m; 4 factores reducen xcr | Re_cr=412,000; xcr=0.025 m a 240 m/s; regla 500,000 | no | viento.ts cita capa-limite.ts inexistente | S | 3 |
| anderson-c15-04 | 15 | teoria | Propiedades de transporte: Sutherland, k=1.45μcp, Pr=0.71 | propiedades,térmico | μ(288.16)=1.7894e-5 exacto; μ(320)=1.939e-5; Pr fijo 0.71 declarando k⇒0.69 | μ/μ0=(T/T0)^1.5(T0+110)/(T+110); k=1.45μcp; Pr=0.71 | no |  | S | 3 |
| anderson-c15-05 | 15 | teoria | Similitud: γ, M, Re, Pr de adimensionalizar NS | similitud,túnel | identidades ±1e-9; escalador 1:10 con (p,T) o declara imposible | 1/(γM²); 1/Re; γ/(Pr Re) | desconocido |  | S | 2 |
| anderson-c16-01 | 16 | ejemplo | Ej 16.1 Couette incompresible imperial | Couette,unidades | 100 ft/s; 0.09 lb/ft²; 519.6 R; 8.97; 521.36 R ±1% | u=100 ft/s; τ=0.09 lb/ft²; Tmax=519.6 R; q_w=8.97; Taw=521.36 R | no |  | S | 3 |
| anderson-c16-02 | 16 | ejemplo | Ej 16.2 Couette compresible Mach 3: q_w por Reynolds | Couette,analogía-Reynolds | q_w=3.68e4 W/m² ±1%; CH/cf=1/(2Pr) exacto | cf=1.13e-4; CH=8e-5; Taw=656 K; q_w=3.68e4 W/m² | no |  | S | 3 |
| anderson-c16-03 | 16 | teoria | Mach al que T0=1000 K (Pr constante) | isentrópico | M=3.5 ±1%; bandera Me>3.5 | M=3.5 | desconocido |  | S | 2 |
| anderson-c16-04 | 16 | benchmark | Couette compresible por shooting: r=Pr y analogía | Couette,shooting-RK4,Sutherland | haw=he+Pr ue²/2 exacto; CH/cf=1/(2Pr) ±0.5%; A=30 → T centro ~5Tw |  | no |  | M | 3 |
| anderson-c16-05 | 16 | benchmark | MacCormack temporal converge al Couette compresible | CFD,NS-2D | salida = shooting ±1%; dt>CFL explota |  | parcial | NavierStokes2D.tsx (Stam, no verificado) | L | 2 |
| anderson-c17-01 | 17 | caso | Acoplamiento viscoso-inviscido: cuerpo efectivo ab+δ* | panel-2D,capa-límite,acoplamiento | placa: δ*=1.72x/√Rex ±1%, 1 iteración; perfil: converge ≤10 it; Cd>0 |  | parcial | src/aero/panel2d.ts sí; capa límite y lazo no (CRUCE-Y-PLAN l.110) | L | 5 |
| anderson-c17-02 | 17 | benchmark | δ, δ*, θ del perfil de Blasius: tres significados | capa-límite,integración | δ*/δ=0.34; θ/δ*=0.39; θ/δ=0.13 ±0.01; Cf=2θ_c/c=1.328/√Rec ±0.5% | δ*=0.34δ; θ=0.39δ*; Cf=2θ_c/c | no |  | S | 4 |
| anderson-c18-01 | 18 | benchmark | Blasius por shooting RK4: las cuatro constantes | capa-límite,shooting-RK4,EDO | 0.332 / 5.0 / 1.72 / 0.664 ±1%; convención η=y√(V/νx) (NO la 0.4696 de Bertin) | f''(0)=0.332; η99=5.0; 1.72; 0.664 | no | find blasius: nada; CURRICULUM a6-l2 ❌ | S | 5 |
| anderson-c18-02 | 18 | ejemplo | Ej 18.1a Placa laminar 100 m/s: 175.6 N | capa-límite,ISA,estudio-viento | D=175.6 N ±1%; aviso Rec>Re_cr | Rec=1.36e7; Cf=3.60e-4; D=175.6 N | parcial | atmosfera.ts + skin.ts:integrarCortante; Cf laminar no | S | 5 |
| anderson-c18-03 | 18 | ejemplo | Ej 18.1b Placa laminar COMPRESIBLE 1000 m/s | capa-límite-compresible | D=5026 N ±1% con F=1.2 alimentado (Fig 18.8 no observada) | Cf√Rec=1.2; D=5026 N | no |  | M | 4 |
| anderson-c18-04 | 18 | caso | El arrastre NO va con V²: ×10 en V da ×28.6 | estudio-viento,barrido | D(1000)/D(100)=28.6 ±0.3; pendiente log-log <2 | factor 28.6 (no 100) | parcial | ForgeBRepStudio.tsx:3661 vientoMach/vientoAltM | S | 3 |
| anderson-c18-05 | 18 | ejemplo | Ej 18.2 Temperatura de referencia (Eckert): 1% | capa-límite-compresible,T*,Sutherland | D=4976 N ±1%; T*=612.7 K; μ*=3.058e-5; Rec*=3.754e7 | r=0.843; T*=612.7 K; Cf*=2.167e-4; D=4976 N | no |  | S | 5 |
| anderson-c18-06 | 18 | ejemplo | Ej 18.3 Meador-Smart laminar: 0.4% | capa-límite-compresible,T* | D=5008 N ±1% (erratas ρ*=0.599, Cf*=2.09e-4) | T*=587.5 K; D=5008 N | no |  | S | 4 |
| anderson-c18-07 | 18 | benchmark | Placa compresible auto-similar: calcular F(Me,Pr,Tw/Te) y G | capa-límite-compresible,shooting-RK4 | Me=0 → Blasius ±0.5%; F(2.94,adiab)=1.2 ±0.05; r=√Pr ±1%; CH/cf=½Pr^-2/3 ±2% | F(2.94)=1.2; r=√Pr; Me=20 aislada >60, fría ~30 | no |  | L | 4 |
| anderson-c18-08 | 18 | caso | Calentamiento de estancamiento: q∝1/√R | térmico,estancamiento,choque-normal | pendiente −0.500 ±0.005; esfera/cilindro=(0.763/0.57)Pr^-0.05; q=0 si Tw=Taw | q_w∝1/√R (18.83) | no |  | M | 4 |
| anderson-c18-09 | 18 | benchmark | Marcha FD de capa límite sobre cuerpo arbitrario (18.84-18.92) | capa-límite,CFD,tridiagonal | placa: cf=0.664/√Rex ±1% en todas las estaciones; τw(0)=0 en estancamiento; refinar ×2 <0.5% |  | no |  | L | 3 |
| anderson-c19-01 | 19 | ejemplo | Ej 19.1a Placa turbulenta incompresible: factor 7.7 | capa-límite,turbulento | D=1352 N ±1%; razón 7.7 ±0.1 | Cf=2.77e-3; D=1352 N; 7.7× | no | grep 0.074 src: nada | S | 5 |
| anderson-c19-02 | 19 | ejemplo | Ej 19.1b Placa turbulenta compresible M=2.94: factor 13 | capa-límite-compresible | D=65,400 N ±1% con Cf=1.34e-3 alimentado (Fig 19.1 no observada) | Cf=1.34e-3; D=65,400 N; 13× | no |  | M | 3 |
| anderson-c19-03 | 19 | ejemplo | Ej 19.2 Turbulento por T*: 20% de discrepancia | T* | D=51,890 N ±1%; banda ±20% reportada | Cf*=2.26e-3; D=51,890 N (20%) | no |  | S | 3 |
| anderson-c19-04 | 19 | ejemplo | Ej 19.3 Meador-Smart turbulento: 14% | T*,Sutherland | D=56,140 N ±1%; ∫0.02296/Rex^0.139 = 0.02667/Rec^0.139 a 1e-6 | T*=581.8 K; Cf*=2.32e-3; D=56,140 N (14%) | no |  | S | 3 |
| anderson-c19-05 | 19 | problema | P19.1 Ala del Cherokee: fricción laminar vs turbulenta | capa-límite,estudio-viento,croquis,extruir | Rec≈6.9e6; D_lam≈38 N, D_turb≈241 N, razón 6.0-6.6 (derivados ±3%) sobre el ala extruida |  | parcial | Estudio Viento + skin.ts; sin Cf ni modo subsónico | M | 5 |
| anderson-c19-06 | 19 | problema | P19.2 δ en el borde de fuga del Cherokee | capa-límite | δ_lam≈3.0 mm; δ_turb≈25 mm ±3%; δ(x) dibujada sobre la cuerda |  | no |  | S | 3 |
| anderson-c19-07 | 19 | problema | P19.3 Cherokee con transición Re_cr=5e5 | capa-límite,transición | D≈222 N ±3% (derivado); D_lam<D<D_turb; límites Re_cr→∞/0 |  | no |  | S | 4 |
| anderson-c19-08 | 19 | problema | P19.4 Mach 4, cuerda 5 in, laminar adiabática | capa-límite-compresible,T* | Eckert vs Meador-Smart <5%; solver c18-07 dentro de 3% |  | no |  | S | 3 |
| anderson-c19-09 | 19 | problema | P19.5 Mach 4 todo turbulento | capa-límite-compresible,T* | D'_turb/D'_lam∈[10,15]; dos T* <15%; banda ±20% |  | no |  | S | 2 |
| anderson-c19-10 | 19 | teoria | P19.6 Crocco: T0 lineal en u con Pr=1 | capa-límite-compresible | /T0−Tw−(T0e−Tw)f'/<1e-4 T0e | T0=Tw+(T0e−Tw)u/ue | no |  | S | 3 |
| anderson-c19-11 | 19 | problema | P19.7 Nariz esférica a 35 km: q a 1500 y 4500 m/s | térmico,estancamiento,ISA,Sutherland | q(4500)/q(1500)∈[20,35]; ISA(35 km)=583.59 Pa, 246.1 K ±0.5%; etiqueta gas real |  | parcial | atmosfera.ts (ISA sí) | M | 4 |
| anderson-c19-12 | 19 | benchmark | Baldwin-Lomax: viscosidad turbulenta algebraica | CFD,turbulencia | constantes literales; y+→∞ da l=ky; placa: Cf ±20% de 0.074/Rec^0.2 | A+=26, Ccp=1.6, CKleb=0.3, Cwk=0.25, k=0.4, K=0.0168; Pr_T=1 | no | NavierStokes2D.tsx sin turbulencia | L | 3 |
| anderson-c19-13 | 19 | caso | Drag buildup 2D: paneles (presión) + placa plana (fricción) | perfil-2D,panel-2D,capa-límite,transición,polar | Cd(α=0) del 0012 ±15% de Abbott; Cd_presión→0 en α=0 |  | parcial | panel2d.ts + wing-metrics.ts; CURRICULUM a6-l6 ❌ | M | 5 |
| anderson-c20-01 | 20 | benchmark | Tabla 20.4 Lombardi: Cf del 0012 capa límite vs tres RANS | perfil-2D,capa-límite,CFD | capa límite acoplada: Cf=5.34e-3 ±5%; RANS en [5.34e-3,7.5e-3] con banda ±20% | Cf×10³: k-ε 7.486; RNG 6.272; RSM 6.792; BL 5.340; 18-40% | parcial | fixture solo en anderson-caps15-20.md:805; panel2d.ts existe | M | 5 |
| anderson-c20-02 | 20 | caso | cf(x/c) sobre el 0012 vs placa plana: el pico tras el LE | perfil-2D,capa-límite,croquis | cf(0)=0; argmax en x/c<0.1; decreciente después; integral = c20-01 ±5% |  | parcial | panel2d.ts da ue(x); sin Thwaites/Head | M | 5 |
| anderson-c20-03 | 20 | caso | Escalón hacia atrás supersónico M=2.19 (recirculación) | CFD,croquis,extruir | celda con u<0 tras el escalón; gradientes <10% del choque; capa límite DEBE fallar |  | no | NS2D Stam incompresible | L | 3 |
| anderson-c20-04 | 20 | caso | Perfil Wortmann Re=1e5: laminar separa, turbulento adhiere | CFD,perfil-2D | laminar cf cruza 0 en ambas caras; turbulento cf>0 |  | no |  | L | 3 |
| anderson-c20-05 | 20 | caso | Interacción choque/capa límite turbulenta M=3 | CFD,térmico | τw=0 en x<x0; meseta de p_w ≥1δ0; τw∈[−120,200] N/m² |  | no |  | L | 3 |
| anderson-c20-06 | 20 | caso | NACA 0015/0012 con protuberancia: quimera y asimetría | CFD,croquis,ensamble | con bulto cl≠0 a α=0 y u<0 tras el bulto; sin bulto cl=0 ±1e-3 |  | no |  | L | 2 |
| anderson-c20-07 | 20 | caso | X-24C: líneas de cortante superficial | CFD,panel-3D | integradas de τw (no de V); convergen en separación |  | no | skin.ts:integrarCortante sin trazado | L | 2 |
| anderson-c20-08 | 20 | teoria | Regla de producto: banda ±20% y malla de pared para cf/q_w | CFD,reporte | cf RANS con banda ±20% y ≤2 cifras; BL sin banda solo si cf>0 en toda la cuerda | no better than about 20 percent accuracy | parcial | regla en anderson-caps15-20.md; no en código | S | 3 |
| anderson-c20-10 | 0 | benchmark | Ap. A Oráculo isentrópico | gasdinámica | error <0.1% fila a fila; A/A* min=1 en M=1 | M=2: 7.824, 4.347, 1.800, 1.687; M=5: 529.1, 88.18, 6.000, 25.00 | no | grep isentrop src: 0 | S | 4 |
| anderson-c20-11 | 0 | benchmark | Ap. B Oráculo de choque normal | gasdinámica | error <0.1%; ρ2/ρ1→6; p02/p01=1 en M=1 y decrece | M1=2: 4.500, 2.667, 1.687, 0.7209, 5.640, 0.5774; M1=3: 10.33, 3.857, 2.679, 0.3283, 12.06, 0.4752 | parcial | cuna-anderson.ts β=90° implícito; sin p02/p01 ni M2 | S | 4 |
| anderson-c20-12 | 0 | benchmark | Ap. C Oráculo de Prandtl-Meyer | gasdinámica | error <0.05°; M(ν(M))=M a 1e-6; ν_max=130.45° | M=2: ν=26.38°, μ=30°; M=3: 49.76°, 19.47°; M=5: 76.92°, 11.54° | no |  | S | 4 |
| anderson-c20-13 | 0 | benchmark | Ap. D Oráculo atmósfera SI (1959 ARDC) | ISA | /Δp//p<0.5%, /ΔT/<0.5 K; h(10 km)=9,984 m | hG=0: 288.16 K, 1.01325e5, 1.2250; 10,000: 223.26, 2.65e4, 0.41351; 20,000: 216.66, 5529.3, 0.088909; 35,000: 246.09, 583.59, 8.262e-3; 50,000: 282.66, 87.858, 1.0829e-3 | si | src/aero/atmosfera.ts:atmosferaISAz + atmosfera.test.ts (falta fixture literal del libro) | S | 3 |
| anderson-c20-14 | 0 | benchmark | Ap. E Oráculo atmósfera unidades inglesas | ISA,unidades | conversión SI→inglés <0.5% | hG=0 ft: 518.69 °R, 2116.2 lb/ft², 2.3769e-3 slug/ft³; 36,000 ft: 390.53 °R, 476.12, 7.1028e-4; μ0=3.7373e-7 slug/(ft s) | parcial | atmosfera.ts solo SI | S | 2 |

## 3. Features de la suite (consolidadas)

### [P0] Estudio Viento en el CAD (supersónico, cuña medida de la pieza, ISA, θ-β-M, overlay)  — estado: **si**
- Qué hace: Pestaña del Part Studio que mide δ del bbox, corre viento.ts a Mach/altitud y pinta Cp/flechas/choque; base de TODO lo aero en la UI
- Dónde: src/forja/brep/ForgeBRepStudio.tsx:VientoOverlay/VientoStreamlines (~l.2051-2300, estado vientoOn ~3658); src/forja/sim/viento.ts:estudioVientoSupersonico; lecciones a1-l1/a1-l4; forja-gate 'vitest-aero'
- Ejercicios: anderson-c1-01, anderson-c9-05, anderson-c18-04

### [P0] Atmósfera estándar ISA (geopotencial, 7 capas hasta 84.85 km)  — estado: **si**
- Qué hace: T,p,ρ,a,q,M por altitud; falta selector ARDC-1959 vs ISO-2533, unidades inglesas y μ(T)
- Dónde: src/aero/atmosfera.ts:atmosferaISA/atmosferaISAz/geopotencial/mach/presionDinamica + atmosfera.test.ts
- Ejercicios: anderson-c1-10, anderson-c8-01, anderson-c20-13, anderson-c20-14

### [P0] Integrador 2D de superficie p(s),τ(s) → N',A',L',D',M'LE,M'c/4,xcp (ecs 1.7-1.22)  — estado: **parcial**
- Qué hace: Sobre el contorno del croquis con distribuciones arbitrarias; paneles con convención de signos del libro; convergencia en n
- Dónde: src/aero/cuna-anderson.ts:cunaAnderson (solo D' de cuña); panel2d.ts da Cp sin integrar fuerzas
- Ejercicios: anderson-c1-01, anderson-c1-03, anderson-c1-04, anderson-c1-13, anderson-c1-15, anderson-c1-16, anderson-c1-17, anderson-c1-28

### [P0] Integrador 3D sobre la piel B-Rep con cierre y volumen + campos analíticos (newtoniano, constante por cara)  — estado: **parcial**
- Qué hace: ∮(−p n̂+τ t̂)dS sobre la malla del kernel; verifica ∮n̂dS≈0 y V; alimentado por campos de libro
- Dónde: src/aero/skin.ts:pielDeMalla/integrarPresion/integrarCortante/ReferenciaAero + skin.test.ts; SIN consumidor en UI ni campo newtoniano
- Ejercicios: anderson-c1-02, anderson-c1-23, anderson-c2-12, anderson-c14-04

### [P0] Método de paneles fuentes (Hess-Smith) + vórtices/Kutta CABLEADO al CAD (Estudio Viento subsónico)  — estado: **parcial**
- Qué hace: Toma la polilínea del croquis, LU una vez, α barato; añade paneles de vórtice + Kutta para cl, cm, Γ; Cp sobre la piel, slider α, gate de compresibilidad local
- Dónde: src/aero/panel2d.ts (solo fuentes; Ej 3.19 a 4 cifras en panel2d.test.ts); cero imports fuera de src/aero; registry.ts sin comando aero
- Ejercicios: anderson-c3-19, anderson-c3-13, anderson-c4-01, anderson-c4-06, anderson-c4-13, anderson-c3-35

### [P0] Teoría del perfil delgado (Glauert): A0,An,cl,αL0,cm_c/4,xcp + generador NACA 4/5 dígitos con comba  — estado: **parcial**
- Qué hace: Cuadratura de dz/dx(θ); línea media literal del 23012/4412; espesor perpendicular a la línea media; exporta al sketcher y a panel2d
- Dónde: src/aero/potencial.ts:nacaProfile (solo 00xx) y liftCoefficient=2π sinα; grep A0/alphaL0: nada
- Ejercicios: anderson-c4-05, anderson-c4-06, anderson-c4-16, anderson-c4-17, anderson-c4-18, anderson-c4-24

### [P1] Polares experimentales NACA digitalizadas (Abbott) + centro aerodinámico desde datos + sistema fuerza-momento  — estado: **no**
- Qué hace: cl/cd/cm vs α para 2412/0012/23012/4412; inversa cl→α; x_ac=−m0/a0+0.25; transferencias LE/c4/ac/cp
- Dónde: docs/forja-research/aero-pliego/figuras/ solo trae Figs 1.58, 18.7-18.9; grep aeroCenter: nada
- Ejercicios: anderson-c4-01, anderson-c4-02, anderson-c4-03, anderson-c4-07, anderson-c4-14, anderson-c4-15, anderson-c4-20, anderson-c1-18

### [P0] Capa límite de placa plana: Blasius (shooting) + turbulenta + transición Re_cr + tres espesores  — estado: **no**
- Qué hace: cf=0.664/√Rex, Cf=1.328/√Rec, δ=5x/√Rex, δ*=1.72, θ=0.664; 0.074/Re^0.2; compuesta con Re_cr ENTRADA; fricción de la pieza en el Estudio Viento (sustituye τ=431 s^-0.2)
- Dónde: find blasius/capa-limite: nada; viento.ts cita capa-limite.ts inexistente; CURRICULUM a6-l2 ❌
- Ejercicios: anderson-c18-01, anderson-c18-02, anderson-c19-01, anderson-c19-05, anderson-c19-06, anderson-c19-07, anderson-c4-08, anderson-c4-09, anderson-c4-10, anderson-c4-11, anderson-c17-02

### [P1] Propiedades de transporte y capa límite compresible: Sutherland μ(T), k, Pr, temperatura de referencia (Eckert/Meador-Smart), auto-similar F,G  — estado: **no**
- Qué hace: μ/μ0=(T/T0)^1.5(T0+110)/(T+110); T*; Cf* laminar (1 %) y turbulento (±20 %); solver auto-similar que sustituye Figs 18.8/19.1
- Dónde: grep sutherland src: 0 hits
- Ejercicios: anderson-c15-04, anderson-c18-05, anderson-c18-06, anderson-c18-07, anderson-c19-03, anderson-c19-04, anderson-c19-08, anderson-c12-03, anderson-c1-25

### [P0] Acoplamiento viscoso-inviscido (cuerpo efectivo ab+δ*) + drag buildup 2D = polar completa  — estado: **parcial**
- Qué hace: Lazo de 5 pasos de §17.2 sobre panel2d; Thwaites/Head; cf(x), separación, Cd=presión+fricción vs Abbott; fixture Lombardi 5.34e-3
- Dónde: src/aero/panel2d.ts sí; δ*/lazo no; CRUCE-Y-PLAN l.110 requisito 2 y F1
- Ejercicios: anderson-c17-01, anderson-c19-13, anderson-c20-01, anderson-c20-02

### [P0] lifting-line.ts (Prandtl/Fourier) + campo δ(λ,AR),τ + Helmbold/Kuchemann + Biot-Savart + VLM  — estado: **no**
- Qué hace: Γ(θ), A_n, CL=A1πAR, δ, e, α_i(y), escalado entre AR; vlm.ts con herraduras a l/4 para baja AR/flecha/delta; carta de McCormick precomputada
- Dónde: grep lifting|lattice|biot src: cero; solo wing-metrics.ts (S,b,AR,λ,MAC del sólido); CRUCE-Y-PLAN F2
- Ejercicios: anderson-c5-01, anderson-c5-02, anderson-c5-03, anderson-c5-04, anderson-c5-05, anderson-c5-06, anderson-c5-07, anderson-c5-10, anderson-c5-13, anderson-c5-15

### [P0] polar.ts + performance: CD=CDo+CL²/(πeAR), e de Oswald, (L/D)max, Vstall, Vmax, P requerida, CL(V)  — estado: **no**
- Qué hace: La piedra angular del diseño conceptual; distingue e de envergadura vs Oswald; vuelo nivelado L=W, T=D; bilingüe
- Dónde: grep oswald|vstall|potencia requerida src: cero
- Ejercicios: anderson-c6-01, anderson-c6-02, anderson-c1-07, anderson-c1-08, anderson-c1-12, anderson-c1-24, anderson-c5-08, anderson-c5-09, anderson-c5-12, anderson-c5-14

### [P1] Métricas del ala desde el kernel (S,b,AR,λ,MAC,mojada) y referencia explícita de coeficientes  — estado: **si**
- Qué hace: Estampa S y l junto a cada coeficiente; falta flecha a media cuerda y torsión
- Dónde: src/aero/wing-metrics.ts:metricasAla/macTrapezoidal + tests; skin.ts:ReferenciaAero
- Ejercicios: anderson-c1-27, anderson-c5-04, anderson-c6-01

### [P1] Similitud dinámica y calculadora de túnel (mismo Re y M) + cuasi-1D venturi/túnel/manómetro/Pitot/EAS + diseño conceptual de túnel  — estado: **no**
- Qué hace: V,T,ρ,p del túnel para un modelo a escala; A1V1=A2V2 + Bernoulli; IWC 3.23 (sección, Pt=½ρAV³, ER)
- Dónde: grep similitud|venturi|pitot|manometr src: nada
- Ejercicios: anderson-c1-05, anderson-c1-06, anderson-c1-19, anderson-c1-20, anderson-c3-03, anderson-c3-04, anderson-c3-05, anderson-c3-07, anderson-c3-09, anderson-c3-23, anderson-c15-05

### [P1] Campo 2D genérico + operadores (∇·,∇×,D/Dt) + líneas de corriente/trayectoria RK4 sobre campo arbitrario + Γ con signo de Anderson + ψ/φ + volumen de control  — estado: **parcial**
- Qué hace: Sustrato del cap 2: el usuario define u(x,y) o lo toma del solver; Γ≡−∮V·ds sobre contorno arbitrario; rastrillo Pitot D'=∫ρu(u1−u)dy vs piel
- Dónde: src/aero/potencial.ts:integrateStreamline/integrateParcel/circulationIntegral (solo Joukowski, ∮u·dl sin el menos); src/math VectorFields.tsx (campos fijos, voseo l.122)
- Ejercicios: anderson-c2-01, anderson-c2-03, anderson-c2-04, anderson-c2-08, anderson-c2-11, anderson-c2-15, anderson-c2-17, anderson-c2-18

### [P1] Flujo-LEGO: fuente/sumidero/doblete/vórtice, semicuerpo, Rankine, cilindro con circulación (3 regímenes), esfera 3D  — estado: **parcial**
- Qué hace: φ,ψ,Vr,Vθ de la Tabla 3.1; línea divisoria como CROQUIS generado; estancamientos; Cp=1−(9/4)sin²θ; CD(Re) del cilindro real
- Dónde: potencial.ts:flowVelocity (uniforme+doblete+vórtice), panel2d.ts:cpCilindroExacto; fuente/sumidero/esfera no
- Ejercicios: anderson-c3-16, anderson-c3-17, anderson-c3-18, anderson-c3-29, anderson-c3-30, anderson-c6-04, anderson-c6-05, anderson-c3-21

### [P0] gasdinamica.ts: isentrópicas (T0,p0,ρ0,T*,a*,M*, A/A* bivaluada) + choque normal directo/inverso + Rayleigh-Pitot + Prandtl-Meyer ν(M)/M(ν) + tablas A/B/C como oráculo  — estado: **no**
- Qué hace: Funciones cerradas con inversas por bisección, γ y R/PM arbitrarios; bandera M>0.3 y T0>2000 K; 'Bernoulli prohibido'
- Dónde: grep isentrop|normal shock|prandtl|rayleigh src/aero: nada; CURRICULUM a7-l2/a7-l5 ❌; atmosfera.ts:mach es lo único
- Ejercicios: anderson-c7-05, anderson-c7-06, anderson-c8-02, anderson-c8-06, anderson-c8-10, anderson-c8-11, anderson-c9-08, anderson-c10-02, anderson-c20-10, anderson-c20-11, anderson-c20-12

### [P0] Estado completo tras choque oblicuo (M2,T2,p02 vía Mn1) + reflexiones/intersecciones + tomas multichoque + choque-expansión sobre polígono del croquis  — estado: **parcial**
- Qué hace: Reusa choque normal con Mn1; NUNCA p02/p1; cadena oblicuo(s)+normal para inlets/SCRAMjet; placa/rombo/cuña/X-15 → cl, cd_w; overlay de ondas
- Dónde: src/aero/cuna-anderson.ts:resolverChoqueOblicuo/thetaDeBeta/deflexionMaxima (θ-β-M con desprendido) + viento.ts (p2 de cuña a α=0)
- Ejercicios: anderson-c9-02, anderson-c9-04, anderson-c9-06, anderson-c9-11, anderson-c9-12, anderson-c9-17, anderson-c9-19, anderson-c9-20, anderson-c12-05

### [P1] Tobera casi-1D con contrapresión (régimen automático, choque interno) + gasto ahogado + empuje + dimensionador de túnel supersónico + tobera como PIEZA del CAD  — estado: **no**
- Qué hace: M(x),p(x),T(x) de A(x) medida del sólido revolucionado; T=ṁue+(pe−p∞)Ae; segunda garganta At2/At1=p01/p02; Re, ṁ, tanque
- Dónde: grep tobera|nozzle src/aero: nada (los 'nozzle' de src/forja son de impresora/molde); revolve en occt.ts
- Ejercicios: anderson-c10-02, anderson-c10-04, anderson-c10-05, anderson-c10-07, anderson-c10-13, anderson-c10-16, anderson-c10-17

### [P0] Corrección de compresibilidad P-G/K-T/Laitone + Mach crítico (Cp,cr(M) ∩ corrección) + pendiente compresible de ala  — estado: **no**
- Qué hace: Una división sobre el Cp de panel2d; raíz de (11.63); declara rango (P-G≲0.7; transónico 'no veo')
- Dónde: grep glauert|tsien|Mcr src: nada; panel2d.ts da Cp0
- Ejercicios: anderson-c11-01, anderson-c11-02, anderson-c11-03, anderson-c11-07, anderson-c11-08, anderson-c11-12, anderson-c11-14

### [P1] Regla del área transónica/supersónica: barrido de cortes del sólido (normales y al ángulo de Mach μ)  — estado: **parcial**
- Qué hace: A(x) del ensamble completo con métrica de suavidad; invariante ∫A dx = volumen; cortes oblicuos (F-16)
- Dónde: src/forja/brep/occt.ts (booleanas/cortes/masa-inercia); sin barrido
- Ejercicios: anderson-c11-13, anderson-c12-04

### [P0] Supersónico linealizado sobre el perfil croquizado: Cp=2θ/√(M²−1), cl, cd_w, L/D con Cf, SIEMPRE junto al exacto  — estado: **parcial**
- Qué hace: θ local por panel; error vs choque-expansión; α óptimo P12.6
- Dónde: viento.ts + cuna-anderson.ts (cuña exacta); lineal no
- Ejercicios: anderson-c12-01, anderson-c12-02, anderson-c12-05, anderson-c12-07, anderson-c12-09, anderson-c12-10

### [P1] MOC 2D + diseñador de tobera supersónica (contorno → croquis → extruir + plano)  — estado: **no**
- Qué hace: Proceso unitario θ±ν=K±; sección de enderezamiento por cancelación de ondas; oráculo A/A*(Me) del kernel
- Dónde: grep moc|caracter src: nada; CRUCE-Y-PLAN fila 8 [NAVEGADOR]
- Ejercicios: anderson-c13-01, anderson-c13-02

### [P1] Newtoniana / newtoniana modificada sobre la piel B-Rep + calentamiento de estancamiento (Tauber-Meneses, q∝1/√R) + Taylor-Maccoll + waverider caret  — estado: **parcial**
- Qué hace: Cp=Cp,max sin²θ por panel con sombra; L,D,Cm; casos analíticos; radio de nariz mínimo con fillet del CAD; cono por EDO inversa; caret desde el plano de choque
- Dónde: src/aero/skin.ts (piel lista); CURRICULUM fila 160 newtoniana.ts ❌; grep heating|tauber|taylor: nada
- Ejercicios: anderson-c14-01, anderson-c14-02, anderson-c14-03, anderson-c14-04, anderson-c14-05, anderson-c14-08, anderson-c14-12, anderson-c14-15, anderson-c13-05, anderson-c18-08, anderson-c19-11

### [P2] Couette/Poiseuille exactos (banco de calibración) + MacCormack/time-marching/RANS Baldwin-Lomax + banda ±20 % declarada  — estado: **parcial**
- Qué hace: u lineal, T parabólica, r=Pr, CH/cf=1/(2Pr); shooting compresible; solvers Euler/NS solo como [GPU-VIVO] con incertidumbre rotulada
- Dónde: src/physics/modules/fluids/NavierStokes2D.tsx (Stam cualitativo, fuera de src/forja); Couette solo en molde (fan.ts, cojinete-jaula.ts)
- Ejercicios: anderson-c15-01, anderson-c16-01, anderson-c16-02, anderson-c16-04, anderson-c19-12, anderson-c20-03, anderson-c20-08, anderson-c13-04

### [P2] Capa de unidades dual SI / inglesas (slug, °R, lb/ft², mi/h, hp, atm=2116 lb/ft²) + tabla de calibración de magnitudes típicas §1.12  — estado: **desconocido**
- Qué hace: Cada entrada lleva unidad; sanity-check contra CD 2.0/1.2/0.12, cd 0.004-0.006, L/D 10-21
- Dónde: src/aero/* trabaja en SI (grep slug src/aero = 0); no verifiqué el CAD
- Ejercicios: anderson-c1-14, anderson-c3-02, anderson-c4-14, anderson-c5-08, anderson-c7-06, anderson-c10-07, anderson-c16-01

### [P1] Escuela AERO: lecciones U1-U9 con clase-drive (a1-l1, a1-l4 HECHAS; a1-l2/l3/l5, a2-*, a3-*, a5-*, a6-*, a7-*, a8-*, a9-* pendientes)  — estado: **parcial**
- Qué hace: Cada ejercicio resuelto EN el CAD con voz + stills + oráculo; runner scripts/escuela/clase-drive.cjs + parrilla.sh
- Dónde: public/escuela/lecciones/a1-l1.json, a1-l4.json (ls); docs/forja-research/aero/CURRICULUM-AERO.md define el resto
- Ejercicios: anderson-c1-01, anderson-c1-10, anderson-c3-19, anderson-c4-06, anderson-c5-04, anderson-c9-02, anderson-c18-01, anderson-c19-01

## 4. Supertickets propuestos

Respetados como HECHOS: a1-l1 (Ej 1.1 cuña) y a1-l4 (Ej 1.10 ISA). Cada bloque `## EJERCICIOS` está listo para pegar en una orden de Temis.

### `anderson-u1-fuerzas-momentos` — U1 · De p y τ a fuerzas, momentos y xcp (el contrato de datos)
- caps: [1] · esfuerzo **M** · valor **5** · sprint **1**
- objetivo: Generalizar cuna-anderson.ts a un integrador 2D de paneles con p(s),τ(s) arbitrarios que entregue N',A',L',D',M'LE,M'c/4,xcp y coeficientes con S,l explícitas; cierra el cap 1 y prepara paneles/perfil delgado. a1-l1 y a1-l4 YA HECHAS: no se repiten.
- ya_existe: src/aero/cuna-anderson.ts:cunaAnderson (D' de cuña, 25 tests); src/aero/skin.ts:integrarPresion/integrarCortante (3D, sin momento); public/escuela/lecciones/a1-l1.json (Ej 1.1 HECHO); public/escuela/lecciones/a1-l4.json (Ej 1.10 HECHO)
- dependencias: (ninguna)

## EJERCICIOS
- anderson-c1-16 · P1.4 Placa 1 m a 10°: N',A',L',D',M'LE,M'c/4,xcp · perfil-2D,croquis · N'=1.123e5, A'=1273.8, M'LE=−3.75e4, xcp=0.334 m; panelizado ≤0.5% del cerrado
- anderson-c1-15 · P1.3 Placa supersónica p constante: xcp · perfil-2D · xcp=c/2 exacto ±1e-6 (carga uniforme)
- anderson-c1-03 · Ej 1.3 NACA 4412: xcp desde cl y cm,c/4 · perfil-2D,panel-2D · xcp/c=0.356 ±0.5%; simétrico ⇒ 0.25
- anderson-c1-04 · Ej 1.4 DC-3: L' y xcp desde dos momentos · perfil-2D,cotas · L'=556.6 lb/ft, xcp=5.774 ft ±0.5%; invariante ec 1.22
- anderson-c1-13 · IWC 1.16 Fuerza axial hacia adelante NACA 2412 a 6° · perfil-2D,panel-2D · ca=−cl sinα+cd cosα=−0.084<0; frontera L/D=cotα
- anderson-c1-17 · P1.5 De (cn,ca) a (cl,cd) a 12° · perfil-2D · cl=1.1675, cd=0.2788 ±1e-4
- anderson-c1-23 · P1.13 Cilindro hipersónico Cp=2cos²φ: CD=4/3 · croquis,extruir,panel-3D · CD=4/3 ±0.5% integrando sobre la piel; L=0 por simetría
- anderson-c1-02 · Ej 1.2 Cono hipersónico newtoniano: CD=Cp referido a la base · croquis,revolve,panel-3D · CD integrado sobre la piel del cono (skin.ts) = 2sin²θc ±1e-3 para θc=5/10/20°; cierre ∮n̂dS≈0

### `anderson-u3-paneles-en-el-cad` — U3 · Paneles de fuentes CABLEADOS al Estudio Viento subsónico
- caps: [3] · esfuerzo **M** · valor **5** · sprint **1**
- objetivo: El hueco real del cap 3: panel2d.ts pasa el Ej 3.19 a 4 cifras pero nadie lo llama desde el CAD. Comando en registry.ts, modo subsónico del VientoOverlay: polilínea del croquis → Cp sobre la piel → líneas de corriente; gate de compresibilidad local; flujo-LEGO mínimo (fuente/sumidero) para el semicuerpo.
- ya_existe: src/aero/panel2d.ts:construirPaneles/influencia/prepararPaneles/resolverAlpha/cpCilindroExacto/circulo (+panel2d.test.ts en forja-gate vitest-aero); src/forja/brep/ForgeBRepStudio.tsx:VientoOverlay (solo supersónico); src/aero/potencial.ts:cpValue/flowVelocity
- dependencias: anderson-u1-fuerzas-momentos

## EJERCICIOS
- anderson-c3-19 · Ej 3.19 Paneles de fuentes sobre el cilindro (8 paneles) · croquis,panel-2D,gate-masa · I_4,2=0.4018 ±5e-4; 8 λ a 4 cifras; ΣλS<1e-9; Cp<0.05 (8) y <1e-3 (64)
- anderson-c3-13 · Ej 3.13 Dónde p=p∞ sobre el cilindro · panel-2D,Cp · raíces 30,150,210,330° ±0.01°; con 64 paneles ±1°
- anderson-c3-12 · Ej 3.12 Gate de compresibilidad (Cp=−5.3) · Cp,gate-compresibilidad · V=200.8 y 753 ft/s; (b) ROJO M_local>0.3
- anderson-c3-35 · P3.22 V de túnel máxima incompresible (cilindro) · gate-compresibilidad · V∞=125 mi/h=55.9 m/s ±0.5; Cp_min=−3 del panel
- anderson-c3-16 · Ej 3.16 Cp pico con cl=5 · cilindro-circulación · Cp(90°)=−6.82 ±0.01
- anderson-c3-17 · Ej 3.17 Estancamiento y Cp=0 con cl=5 · cilindro-circulación · estanc. 203.4/336.6° ±0.1°; Cp=0 en 5.85/174.1/243.8/296.2°
- anderson-c3-29 · P3.12 Semicuerpo (fuente+uniforme) y su Cp · flujo-lego,croquis-generado · semiancho asintótico=π ft; Cp=1 nariz→0; curva ψ=Λ/2 <1e-6
- anderson-c3-14 · Ej 3.14 Aceleración de la parcela: 510 g · líneas-corriente,parcela · extremos en 45°+k90° ±1°; |a|max=5000 ±50 m/s²

### `anderson-u7-gasdinamica-tablas` — U7 · gasdinamica.ts: isentrópicas, choque normal, Rayleigh-Pitot y tablas A/B/C
- caps: [7, 8, 20] · esfuerzo **M** · valor **5** · sprint **1**
- objetivo: El módulo que consumen los caps 8-14 y que hoy NO existe: T0/p0/ρ0/T*/a*/M*, choque normal directo e inverso, entropía, p02/p01, Pitot con umbral 1.893, ν(M) e inversa; generador de Ap. A/B/C al 4º decimal (modo exacto vs 'nearest entry'); banderas M>0.3 y T0>2000 K. Lecciones a7-l1..l4.
- ya_existe: src/aero/atmosfera.ts:mach (a=√γRT); src/aero/cuna-anderson.ts:resolverChoqueOblicuo (β=90° implícito)
- dependencias: (ninguna)

## EJERCICIOS
- anderson-c20-10 · Ap. A Oráculo isentrópico · gasdinámica · error <0.1% fila a fila; A/A* min=1 en M=1
- anderson-c20-11 · Ap. B Oráculo de choque normal · gasdinámica · error <0.1%; ρ2/ρ1→6; p02/p01=1 en M=1 y decrece
- anderson-c20-12 · Ap. C Oráculo de Prandtl-Meyer · gasdinámica · error <0.05°; M(ν(M))=M a 1e-6; ν_max=130.45°
- anderson-c8-06 · Ej 8.11 Choque normal: estado aguas abajo · choque-normal · 8.59/8.65/8.67 en M1=2 → 0.5774/4.5/1.6875 ±1e-4; T02=T01
- anderson-c8-10 · Ej 8.15-8.17 Choque normal INVERSO · choque-normal · inversas por bisección → M1=2/5/3 ±1e-3
- anderson-c8-11 · Ej 8.22 Pitot compresible: decidir sub/supersónico · Pitot-Rayleigh · umbral 1.893; M=0.6/1.3/3.0 ±0.005
- anderson-c7-06 · Ej 7.7 Pitot subsónico compresible a 10,000 ft · Pitot-compresible · V∞=862 ft/s ±0.3%; RECHAZA Bernoulli M>0.3
- anderson-c8-13 · Ej 8.24 Velocidad del SR-71 desde Pitot a 25 km · Pitot-Rayleigh,ISA · ISA(25000) p=2527 ±3; M=3.40 ±0.01; V=1003 ±3

### `anderson-u8-choque-expansion-croquis` — U8 · Choque-expansión exacta sobre el polígono del croquis (placa, rombo, cuña, X-15)
- caps: [9, 12] · esfuerzo **M** · valor **5** · sprint **1**
- objetivo: Extender viento.ts: α≠0, cara a cara (giro hacia el flujo=oblicuo, alejándose=Prandtl-Meyer), estado completo detrás (M2,T2,p02 vía Mn1, nunca p02/p1), cl y cd_w, desprendido por cara, overlay de ondas; supersónico lineal Cp=2θ/√(M²−1) SIEMPRE al lado con su error; tomas multichoque y reflexiones.
- ya_existe: src/aero/cuna-anderson.ts:thetaDeBeta/deflexionMaxima/resolverChoqueOblicuo/betaChoqueOblicuo (15 tests); src/forja/sim/viento.ts:estudioVientoSupersonico (cuña a α=0); src/forja/brep/ForgeBRepStudio.tsx:useWedgeFrame (~l.2111)
- dependencias: anderson-u7-gasdinamica-tablas

## EJERCICIOS
- anderson-c9-02 · Ej 9.2 Choque oblicuo 20° a Mach 2: estado completo · θ-β-M,choque-oblicuo,isentrópico · β=53.4 ±0.3°; M2=1.21 ±0.01; p02=7.00 ±0.05 atm; NO usar p02/p1
- anderson-c9-08 · Ej 9.9 Expansión Prandtl-Meyer 15° desde M=1.5 · Prandtl-Meyer · ν(1.5)=11.91 ±0.01°; M(26.91°)=2.00; p02=p01; p2=0.469 ±0.003
- anderson-c9-11 · Ej 9.12 Placa plana 5° Mach 3: cl y cd por choque-expansión · croquis,shock-expansion · cl=0.125 ±0.003; cd=0.011 ±0.001; cd/cl=tanα exacto
- anderson-c9-05 · Ej 9.6 cd de onda de cuña 15° a Mach 5 · croquis,estudio-viento,θ-β-M · Dp/(qc)=0.114 ±0.002 aislando presión
- anderson-c9-20 · P9.14 Rombo ε=10° a α=15°, Mach 3 · croquis,shock-expansion · 4 caras; α=0 ⇒ cl=0 y D'=(p2−p3)t
- anderson-c9-12 · Ej 9.13 Cola de cuña del X-15: cl placa vs cuña · croquis,shock-expansion · cl_placa=0.126 ±0.004; cl_cuña=0.241 ±0.006; ratio≈2
- anderson-c12-01 · Ej 12.1 Placa 5° Mach 3: lineal vs exacto (1.6%) · supersónico-lineal,shock-expansion · cl=0.123 ±0.5%; cd=0.011; |Δcl|≤2% vs exacto
- anderson-c9-04 · Ej 9.5 Frenar Mach 3: normal vs oblicuo 40°+normal · toma-supersónica · 0.578/0.3283=1.76 ±0.02

### `anderson-u4-perfil-delgado-naca` — U4 · Perfil delgado + generador NACA con comba (fixture de oro Ej 4.6)
- caps: [4] · esfuerzo **M** · valor **5** · sprint **2**
- objetivo: nacaProfile con 4/5 dígitos y línea media literal del 23012/4412; Glauert A0,An → cl, αL0, cm_c/4, xcp; ac desde datos; el perfil sale como croquis al sketcher y a panel2d (snap de 10 px ya pagado).
- ya_existe: src/aero/potencial.ts:nacaProfile (00xx)/liftCoefficient/liftPerSpan/kuttaGamma
- dependencias: anderson-u3-paneles-en-el-cad

## EJERCICIOS
- anderson-c4-06 · Ej 4.6 NACA 23012 por perfil delgado (FIXTURE DE ORO) · croquis,cotas,perfil-delgado · αL0=−1.09 ±0.01°; cl=0.559 ±0.002; A1=0.0954; A2=0.0792; cm_c/4=−0.0127; xcp/c=0.273
- anderson-c4-05 · Ej 4.5 Placa plana a 5°: cl, cm_le, cm_c/4, cm_te · perfil-delgado · cl=2πα ±1e-3; cm_le=−cl/4; cm_c/4=0; cm_te=0.411
- anderson-c4-17 · P4.6 NACA 4412 por perfil delgado: αL0 y cl(3°) · croquis,perfil-delgado · cuadratura vs analítico <0.1%; ref. literatura αL0≈−4.15° (NO impreso)
- anderson-c4-18 · P4.7 4412: cm_c/4 y xcp a 3° · perfil-delgado · cm_c/4=π/4(A2−A1) invariante en α; xcp por (4.66)
- anderson-c4-07 · Ej 4.7 Centro aerodinámico del 23012 desde datos · estabilidad · x_ac=0.241 ±0.001
- anderson-c4-20 · P4.10 ac del 2412 desde dos ángulos · estabilidad · x_ac=0.2423 ±0.0005
- anderson-c4-24 · P4.14 ¿Vuela un perfil de cabeza? · perfil-2D · cl=0.8; invertido 0.2; α=11°
- anderson-c4-04 · Ej 4.4 Vórtice de arranque · potencial-2D · Γ=14.56 ±0.01; Γ_perfil+Γ_arranque=0

### `anderson-u5-lifting-line-baron` — U5 · Línea sustentadora: el Baron 58 y el perfil que te mintió
- caps: [5] · esfuerzo **L** · valor **5** · sprint **2**
- objetivo: lifting-line.ts (Fourier N×N, δ, τ, e, α_i(y)), campo δ(λ,AR) precomputado, Biot-Savart, Helmbold/Kuchemann; el ala se loftea en el kernel y wing-metrics.ts entrega S,b,AR; gate 'elíptica ⇒ e=1.0000'. Lecciones a5-l1..l7.
- ya_existe: src/aero/wing-metrics.ts:metricasAla/macTrapezoidal (F0 cerrado); src/aero/skin.ts:pielDeMalla (sustrato del VLM)
- dependencias: anderson-u4-perfil-delgado-naca

## EJERCICIOS
- anderson-c5-05 · Invariante ala elíptica: δ=0, e=1, a=a0/(1+a0/πAR) · lifting-line · |δ|<1e-6; |e−1|<1e-6; a(AR=8,2π)=5.02655 ±1e-4; w(y) constante
- anderson-c5-01 · Ej 5.1 Ala AR=8, λ=0.8 a 5° · panel-3D,lifting-line · CL=0.4335 ±0.5%; CD,i=0.00789 ±1% con δ=τ=0.055 entrada
- anderson-c5-02 · Ej 5.2 Escalar CD,i de AR=6 a AR=10 · lifting-line · CD,i=0.0076 ±1%; a0=5.989 ±0.2%
- anderson-c5-04 · Ej 5.4 Baron 58: el perfil te mintió (ANCLA) · croquis,loft,lifting-line,perfil-2D · CL=0.443 ±1%; CD=0.0148 ±1%; AR del sólido lofteado=7.61 ±0.5%
- anderson-c5-03 · Ej 5.3 α de crucero del jet ejecutivo · lifting-line,performance · α=0.6 ±0.05°
- anderson-c5-07 · P5.3 Ala 23012 AR=8 λ=0.8 a 7° · lifting-line · cadena a/CL/CD,i con δ(λ,AR) propio ±5%
- anderson-c5-10 · P5.6/5.7 Pendiente recta vs flecha 45° (AR 6 y 3) · lifting-line,VLM · Kuchemann vs Prandtl; VLM propio <5% a AR=6
- anderson-c5-06 · P5.1/5.2 Anillo de vórtice (Biot-Savart) · biot-savart · V=Γ/2R centro; ΓR²/(2(R²+A²)^1.5) eje a 1e-6

### `anderson-u6-blasius-capa-limite` — U6 · capa-limite.ts: Blasius, turbulento, transición — el arrastre existe
- caps: [17, 18, 19, 4] · esfuerzo **M** · valor **5** · sprint **2**
- objetivo: Shooting RK4 de Blasius (0.332/5.0/1.72/0.664, convención η=y√(V/νx)); correlaciones turbulentas; transición con Re_cr como ENTRADA; sustituye τ=431 s^-0.2 en viento.ts e integra con skin.ts sobre el ala del Cherokee extruida; factores 7.7 y 28.6. Lecciones a6-l1/a6-l2/a4-l7.
- ya_existe: src/forja/sim/viento.ts (τ empírico etiquetado; cita capa-limite.ts); src/aero/skin.ts:integrarCortante; src/aero/atmosfera.ts
- dependencias: anderson-u1-fuerzas-momentos

## EJERCICIOS
- anderson-c18-01 · Blasius por shooting RK4: las cuatro constantes · capa-límite,shooting-RK4,EDO · 0.332 / 5.0 / 1.72 / 0.664 ±1%; convención η=y√(V/νx) (NO la 0.4696 de Bertin)
- anderson-c17-02 · δ, δ*, θ del perfil de Blasius: tres significados · capa-límite,integración · δ*/δ=0.34; θ/δ*=0.39; θ/δ=0.13 ±0.01; Cf=2θ_c/c=1.328/√Rec ±0.5%
- anderson-c18-02 · Ej 18.1a Placa laminar 100 m/s: 175.6 N · capa-límite,ISA,estudio-viento · D=175.6 N ±1%; aviso Rec>Re_cr
- anderson-c19-01 · Ej 19.1a Placa turbulenta incompresible: factor 7.7 · capa-límite,turbulento · D=1352 N ±1%; razón 7.7 ±0.1
- anderson-c19-05 · P19.1 Ala del Cherokee: fricción laminar vs turbulenta · capa-límite,estudio-viento,croquis,extruir · Rec≈6.9e6; D_lam≈38 N, D_turb≈241 N, razón 6.0-6.6 (derivados ±3%) sobre el ala extruida
- anderson-c19-07 · P19.3 Cherokee con transición Re_cr=5e5 · capa-límite,transición · D≈222 N ±3% (derivado); D_lam<D<D_turb; límites Re_cr→∞/0
- anderson-c4-10 · Ej 4.10 Cf con transición Re_cr=5e5 · capa-límite,transición · Net Cf=0.0063 ±5e-5 con Re_cr como ENTRADA
- anderson-c18-04 · El arrastre NO va con V²: ×10 en V da ×28.6 · estudio-viento,barrido · D(1000)/D(100)=28.6 ±0.3; pendiente log-log <2

### `anderson-u1-performance-similitud` — U1 · Vuelo nivelado, similitud y túnel: los números del diseñador
- caps: [1, 3, 6] · esfuerzo **M** · valor **4** · sprint **2**
- objetivo: polar.ts + performance.ts (L=W, T=D, Vstall, (L/D)max, P) y similitud.ts (mismo Re y M para un modelo a escala) sobre atmosfera.ts; lecciones a1-l2/a1-l3 del currículo.
- ya_existe: src/aero/atmosfera.ts:atmosferaISA/presionDinamica/mach
- dependencias: anderson-u1-fuerzas-momentos

## EJERCICIOS
- anderson-c1-07 · Ej 1.7 Citation V crucero: CL y L/D · performance,ISA · CL=0.21, L/D=14 ±1%; ρ(33,000 ft)=0.4106 kg/m³ ±0.5%
- anderson-c1-08 · Ej 1.8 CL,max del Citation V desde Vstall · performance · CL,max=1.81 ±1%; inversa Vstall=146.7 ft/s
- anderson-c1-12 · Ej 1.12 P-35: potencia requerida · performance,ISA · V=377.8 ft/s, D=1026 lb, P=704 hp ±1%; 257.6 vs 260 mi/h
- anderson-c1-24 · P1.15 Cessna Skylane: CL,CD,L/D vs V · performance,gráfica · (L/D)max=13.6 en CL*=0.680, V*=144.8 ft/s ±1 ft/s
- anderson-c1-06 · Ej 1.6 Túnel para modelo 1/50 del 747 · similitud,ISA · V2=577.5 mi/h, p2=11.26 atm ±0.5%; Re2/Re1=M2/M1=1
- anderson-c1-20 · P1.10 Túnel a 1 atm para Lear jet 1/5 · similitud,ISA · ρ2=2.07, T2=170 K, V2=218 m/s ±1%
- anderson-c1-05 · Ej 1.5 Dos cilindros dinámicamente similares · similitud,panel-2D · Cp(s/d) idénticos punto a punto; |CD1−CD2|<1e-6; Re y M iguales
- anderson-c1-19 · P1.9 ¿Similares a 200 K y 800 K? · similitud · M iguales; Re2/Re1=2.83 ⇒ NO

### `anderson-u6-polar-avion-oswald` — U6 · Polar del avión completo: e de Oswald y (L/D)max
- caps: [6, 5, 1] · esfuerzo **S** · valor **5** · sprint **3**
- objetivo: polar.ts: CD=CDo+CL²/(πeAR), e=1.78(1−0.045AR^0.68)−0.64, (L/D)max=(πeAR CDo)^½/2CDo; P-35 vs Loftin; Spitfire (inducido 25 % crucero / 60 % aproximación); Cherokee. Nombra distinto e_envergadura y e_Oswald.
- ya_existe: src/aero/atmosfera.ts; src/aero/wing-metrics.ts
- dependencias: anderson-u5-lifting-line-baron, anderson-u1-performance-similitud

## EJERCICIOS
- anderson-c6-01 · Ej 6.1 CD,o del P-35 desde la polar y e de Oswald · polar,performance · e=0.873 ±0.2%; CD,o=0.026 ±1%; Loftin 0.0251 <4%
- anderson-c6-02 · Ej 6.2 (L/D)max del P-35 · polar,performance · 12.46 ±0.5%; en ese punto CD,o=CL²/πeAR
- anderson-c5-08 · P5.4 Piper Cherokee: α de crucero · performance,lifting-line · AR=6.02; CL=W/qS; α por (5.70); L=W
- anderson-c5-09 · P5.5 D_i del avión completo (e=0.64) · performance · dos vías (qSC_L²/πeAR y (W/b)²/πeq) coinciden a 1e-9
- anderson-c5-12 · P5.9 Spitfire a Vmax: CD,i y % · performance,ISA · CD,i=CL²/πAR; D=550ηHP/V; fracción; ρ(18,500 ft) ±0.5%
- anderson-c5-14 · P5.11 Spitfire aproximación 70 mi/h · performance · CD,i un orden mayor que P5.9
- anderson-c5-11 · P5.8 Wright y Lilienthal: corrección por AR · lifting-line · CL,Wright=0.546·a(3.5)/a(6.48) <0.546
- anderson-c1-24 · P1.15 Cessna Skylane: CL,CD,L/D vs V · performance,gráfica · (L/D)max=13.6 en CL*=0.680, V*=144.8 ft/s ±1 ft/s

### `anderson-u4-vortices-kutta-polares` — U4 · Paneles de vórtice + Kutta + polares NACA digitalizadas
- caps: [4] · esfuerzo **L** · valor **4** · sprint **3**
- objetivo: Hess-Smith completo (fuentes+vórtices, γ_i=−γ_{i−1}) para cl con espesor; polares de Abbott (2412/0012/23012/4412) trazadas a 300-400 dpi como oráculo citado; L/D vs α y lectura inversa cl→α; lecciones a1-l5..l7.
- ya_existe: src/aero/panel2d.ts (solo fuentes); docs/forja-research/aero-pliego/figuras-digitalizadas.md (método píxel a píxel)
- dependencias: anderson-u3-paneles-en-el-cad, anderson-u4-perfil-delgado-naca

## EJERCICIOS
- anderson-c4-01 · Ej 4.1 NACA 2412: de L' a α y D' · perfil-2D,ISA,polar-experimental,panel-2D · q y cl a 3 cifras; α=4 ±0.5°; cd∈[0.0065,0.0072]; D'=13.1 ±0.3 N/m
- anderson-c4-02 · Ej 4.2 Momento sobre el ac · perfil-2D,polar · M'ac=−61.7 ±0.1 N·m
- anderson-c4-03 · Ej 4.3 L/D del 2412 a 0,4,8,12° · polar-experimental · tabla ±(0.02,0.0005,3); max entre 4 y 8°
- anderson-c4-14 · P4.1 2412 a 4°, 50 ft/s, c=2 ft (imperial) · polar,ISA · q=2.971 lb/ft²; L'=3.86 ±0.15; M'c/4≈−0.59
- anderson-c4-15 · P4.2 De L'=1353 N/m al α · polar · cl=0.44; α≈1.9 ±0.5°
- anderson-c4-13 · IWC 4.17 Paredes de túnel: imágenes y paneles · potencial-2D,panel-2D · v(x,0)<1e-9V; Cp_min<−3 y →−3 cuando h/R→∞; ΣλS=0
- anderson-c1-18 · P1.6 NACA 2412: xcp/c(α) desde tabla · perfil-2D,gráfica · xcp/c: −2°→1.09, 0→0.41, 4→0.306, 14→0.266 ±0.5%; >0.25 siempre
- anderson-c4-19 · P4.8 Teoría vs experimento 4412 (%) · perfil-delgado,polar,reporte · reporte |teo−exp|/exp; verde si polar Ref.11 con cita

### `anderson-u7-tobera-tunel` — U7 · Tobera casi-1D con contrapresión y túnel supersónico (tobera como PIEZA)
- caps: [10] · esfuerzo **L** · valor **4** · sprint **3**
- objetivo: A(x) medida del sólido revolucionado; régimen automático (subsónico/ahogado/choque interno/salida); ṁ ahogado; empuje del cohete γ=1.22; segunda garganta y IWC 10.8 completo; colormap = DATO sobre el sólido. Lecciones a7-l5/a7-l6.
- ya_existe: src/aero/atmosfera.ts (p a 20 km); src/forja/brep/occt.ts (revolve, cortes); src/aero/cuna-anderson.ts:thetaDeBeta (P10.10)
- dependencias: anderson-u7-gasdinamica-tablas

## EJERCICIOS
- anderson-c10-02 · Ej 10.2 Tobera Ae/A*=2: dos soluciones · gasdinámica-1D,tobera · raíces 2.2 y 0.3 ±2%; p*/p0=0.5283, T*/T0=0.8333 exactas
- anderson-c10-03 · Ej 10.3 pe=0.973 atm: garganta NO sónica · tobera · Mt=0.44 ±3%; At/A*=1.482>1
- anderson-c10-04 · Ej 10.4 Motor cohete H2/O2 (γ=1.22): empuje y Ae · tobera,ISA,revolve · T=2.17e6 N ±1%; Ae=16.5 m² ±1%; ue por energía vs Me·ae <0.5%; p(20 km)=5529 Pa
- anderson-c10-05 · Ej 10.5 Gasto ahogado cerrado (E10.3) · tobera · ṁ=583.2 ±0.5% (ojo: libro usa R=510); |cadena−cerrada|<1%
- anderson-c10-13 · P10.9 Ae/A*=1.53 con cuatro contrapresiones · tobera,choque-normal · clasificación automática; choque interno por bisección |pe−pe_calc|<1e-4 atm
- anderson-c10-06 · Ej 10.6 Segunda garganta de túnel Mach 2 · choque-normal,túnel · At2/At1=1.387 ±0.5%
- anderson-c10-07 · IWC 10.8 Túnel blowdown Mach 2 completo · túnel,gasdinámica-1D,croquis,planeación · Re=23e6 ±3%; ṁ=7.05 lbm/s ±2%; V_tanque=9049 ft³ ±2%; 2h=2.31 ft
- anderson-c10-14 · P10.10 Ae/A* del túnel desde β de una cuña de 20° · choque-oblicuo,croquis · M de thetaDeBeta(M,41.8°)=20°; A/A* supersónico; el alumno DIBUJA la cuña

### `anderson-u3-cuasi-1d-pitot` — U3 · Bernoulli cuasi-1D: venturi, túnel, manómetro, Pitot, EAS
- caps: [3] · esfuerzo **S** · valor **3** · sprint **3**
- objetivo: Calculadora de ingeniería sobre atmosfera.ts con A1/A2 medido del venturi revolucionado en el kernel; bilingüe SI/inglés; lecciones a3-l1/a3-l2.
- ya_existe: src/aero/atmosfera.ts:presionDinamica/mach; src/forja/brep/occt.ts (revolve, área de sección)
- dependencias: (ninguna)

## EJERCICIOS
- anderson-c3-01 · Ej 3.1 V en un punto por Bernoulli · Bernoulli · V=142.8 m/s ±0.3
- anderson-c3-03 · Ej 3.3 Venturi como velocímetro · croquis,revolve,cuasi-1D · V1=102.3 ft/s ±0.2; A1/A2 del kernel
- anderson-c3-04 · Ej 3.4 Manómetro Hg en túnel 12:1 · cuasi-1D,manómetro · Δp=1527 ±2 Pa; h=0.01148 m
- anderson-c3-05 · Ej 3.5 Δp máximo por la balanza (1000 lb) · cuasi-1D,planeación · V=328.4 ft/s; Δp=127.3 lb/ft² ±0.2
- anderson-c3-07 · Ej 3.7 V desde Pitot a nivel del mar · Pitot · V=249.5 ±1 ft/s
- anderson-c3-09 · Ej 3.9 P-35 a 4 km desde Pitot (Ap. D) · ISA,Pitot · V=114.2 ±0.3 m/s con atmosferaISA(4000)
- anderson-c3-10 · Ej 3.10 Velocidad equivalente (EAS) · ISA,q · q=5343 ±5 Pa; Ve=93.2 ±0.2 m/s
- anderson-c3-23 · IWC 3.23 Diseño conceptual de túnel subsónico · dimensionado-túnel,croquis,loft · sección 2×3×3.2; Pt=6.376e6 ±1e4 W; motor 1030 ±2 hp

### `anderson-u8-prandtl-glauert-mcr` — U8 · Prandtl-Glauert, Mach crítico y regla del área
- caps: [11, 12] · esfuerzo **M** · valor **4** · sprint **4**
- objetivo: Una división sobre el Cp de panel2d (+K-T/Laitone); Cp,cr(M) ∩ corrección → Mcr por bisección (0012: 0.7371); drag-divergence como decisión espesor/flecha; barrido A(x) del sólido (normal y al ángulo de Mach). Lecciones a8-l4/a8-l5.
- ya_existe: src/aero/panel2d.ts:resolverAlpha (Cp0); src/aero/potencial.ts:nacaProfile (0012); src/forja/brep/occt.ts (cortes/masa-inercia)
- dependencias: anderson-u3-paneles-en-el-cad, anderson-u7-gasdinamica-tablas

## EJERCICIOS
- anderson-c11-01 · Ej 11.1 Prandtl-Glauert sobre Cp puntual · compresibilidad-PG,panel-2D · Cp=−0.375 ±0.1%
- anderson-c11-02 · Ej 11.2 Pendiente a M=0.7: +40% · compresibilidad-PG · 8.8/rad ±0.5%; marca borde de validez
- anderson-c11-03 · Ej 11.3 Mach crítico del NACA 0012: 0.7371 vs 0.73 · mach-crítico,panel-2D,croquis · raíz de (11.63)=0.7371 ±0.001; Cp,cr(M) ±1%; Cp0,min de panel2d ≈−0.43 ±10% en x/c≈0.1
- anderson-c11-07 · P11.3 P-G, K-T, Laitone sobre Cp0=−0.54 a M=0.58 · compresibilidad-PG · P-G ±0.1%; |Laitone|≥|K-T|≥|P-G|
- anderson-c11-08 · P11.4 Mcr con Cp0,min=−0.41 · mach-crítico · raíz tol 1e-4; Mcr(−0.41)>0.7371
- anderson-c11-12 · P11.9 Mcr del cilindro: dentro de 3.5% de 0.404 · mach-crítico,panel-2D · Cp0,min=−3; raíz dentro de 3.5% de 0.404
- anderson-c11-13 · Regla del área transónica: A(x) del sólido completo · sección-área,ensamble,loft · ∫A(x)dx=volumen <0.5%; métrica de suavidad menor en area-ruled
- anderson-c12-04 · Regla del área SUPERSÓNICA del F-16 (cortes al ángulo de Mach) · sección-área,ensamble · μ=38.7°/56.4° exactos; A_oblicua suave; M→1 recupera A(x)

### `anderson-u6-compresible-sutherland` — U6 · Sutherland, temperatura de referencia y Couette: fricción compresible con banda ±20 %
- caps: [15, 16, 18, 19, 12] · esfuerzo **M** · valor **4** · sprint **4**
- objetivo: Propiedades μ(T),k,Pr; T* de Eckert/Meador-Smart laminar (1 %) y turbulento (±20 % declarado); Couette 1D exacto como banco; F-104: fricción 60 % del arrastre; sustituye Figs 18.8/19.1 con el solver auto-similar (benchmark).
- ya_existe: src/aero/atmosfera.ts; src/forja/mold/fan.ts (Hele-Shaw, otro dominio, solo referencia)
- dependencias: anderson-u6-blasius-capa-limite, anderson-u7-gasdinamica-tablas

## EJERCICIOS
- anderson-c15-04 · Propiedades de transporte: Sutherland, k=1.45μcp, Pr=0.71 · propiedades,térmico · μ(288.16)=1.7894e-5 exacto; μ(320)=1.939e-5; Pr fijo 0.71 declarando k⇒0.69
- anderson-c18-05 · Ej 18.2 Temperatura de referencia (Eckert): 1% · capa-límite-compresible,T*,Sutherland · D=4976 N ±1%; T*=612.7 K; μ*=3.058e-5; Rec*=3.754e7
- anderson-c18-06 · Ej 18.3 Meador-Smart laminar: 0.4% · capa-límite-compresible,T* · D=5008 N ±1% (erratas ρ*=0.599, Cf*=2.09e-4)
- anderson-c19-03 · Ej 19.2 Turbulento por T*: 20% de discrepancia · T* · D=51,890 N ±1%; banda ±20% reportada
- anderson-c19-04 · Ej 19.3 Meador-Smart turbulento: 14% · T*,Sutherland · D=56,140 N ±1%; ∫0.02296/Rex^0.139 = 0.02667/Rec^0.139 a 1e-6
- anderson-c12-03 · Ej 12.3 F-104: fricción vs onda; L/D 28.3→11.2 · supersónico-lineal,fricción-compresible,Sutherland · μ=1.4226e-5 ±0.1%; Re=3.33e7; cd,onda=2.83e-3; L/D=11.2 ±1%; α_igualdad=2.47°
- anderson-c16-01 · Ej 16.1 Couette incompresible imperial · Couette,unidades · 100 ft/s; 0.09 lb/ft²; 519.6 R; 8.97; 521.36 R ±1%
- anderson-c16-02 · Ej 16.2 Couette compresible Mach 3: q_w por Reynolds · Couette,analogía-Reynolds · q_w=3.68e4 W/m² ±1%; CH/cf=1/(2Pr) exacto

### `anderson-u2-campos-circulacion` — U2 · Campos, vorticidad, Γ de Anderson y volumen de control
- caps: [2] · esfuerzo **M** · valor **3** · sprint **4**
- objetivo: Campo 2D definido por el usuario con ∇·,∇×,D/Dt; RK4 sobre campo arbitrario; circulacionAnderson=−∮V·ds sobre contorno dibujado; ψ/φ con test de ortogonalidad; rastrillo Pitot D'_estela vs D'_piel. Lecciones a2-l1..l5.
- ya_existe: src/aero/potencial.ts:integrateStreamline/integrateParcel/circulationIntegral; src/aero/skin.ts campo cierre (P2.1 HECHO); src/math/modules/calc/VectorFields.tsx (voseo l.122: corregir)
- dependencias: (ninguna)

## EJERCICIOS
- anderson-c2-01 · Ej 2.1 Pared ondulada: ∇·V en (1/4,1) · campo-2D,divergencia · div numérica=−0.7327 ±1%; =0 en x/l=0,½,1
- anderson-c2-03 · Ej 2.3 Derivada sustancial: 358.6 m/s² (36.6 g) · campo-2D,D/Dt · |a|=358.6 ±1%, ambas componentes negativas
- anderson-c2-04 · Ej 2.4 Línea de corriente del vórtice por (0,5) · campo-2D,RK4 · polilínea RK4 con |r−5|<1e-3 tras una vuelta
- anderson-c2-08 · Ej 2.8 Circulación del vórtice Γ=2π independiente del radio · campo-2D,circulación · Γ=2π ±1e-6 en r=1,2,5,10; signo de Anderson Γ≡−∮V·ds
- anderson-c2-15 · P2.4/2.8 Vórtice libre: líneas, div, curl, Γ · campo-2D,circulación · círculos; div=curl=0; Γ=2πc si encierra el origen, 0 si no
- anderson-c2-17 · P2.6/2.11 Estancamiento u=cx,v=−cy: ψ, φ, ortogonalidad · campo-2D,ψ,φ · hipérbolas xy=cte; ψ=cxy, φ=c(x²−y²)/2; ∇ψ·∇φ=0; ∇²ψ=∇²φ=0
- anderson-c2-18 · P2.12 Fuerza sobre tubo en U (momento integral) · volumen-control,ensamble · F=2ρAV²=4830 N ±1% en sentido de la entrada
- anderson-c2-11 · §2.6 Arrastre por estela (rastrillo Pitot) · volumen-control,CFD,piel · D'_estela = D'_piel ±3% en estaciones 2c,4c,8c

### `anderson-u6-polar-completa-xfoil` — U6 · Acoplamiento viscoso-inviscido: la polar completa (el truco de XFOIL)
- caps: [17, 19, 20] · esfuerzo **L** · valor **5** · sprint **5**
- objetivo: Cuerpo efectivo ab+δ* sobre panel2d con lazo de 5 pasos; Thwaites/Head; cf(x/c) con pico tras el LE; Cd=presión+fricción vs Abbott; fixture Lombardi 5.34e-3 con banda; regla de producto ±20 %. Lección a6-l6.
- ya_existe: src/aero/panel2d.ts:prepararPaneles/resolverAlpha; src/aero/skin.ts:integrarCortante
- dependencias: anderson-u6-blasius-capa-limite, anderson-u4-vortices-kutta-polares

## EJERCICIOS
- anderson-c17-01 · Acoplamiento viscoso-inviscido: cuerpo efectivo ab+δ* · panel-2D,capa-límite,acoplamiento · placa: δ*=1.72x/√Rex ±1%, 1 iteración; perfil: converge ≤10 it; Cd>0
- anderson-c20-02 · cf(x/c) sobre el 0012 vs placa plana: el pico tras el LE · perfil-2D,capa-límite,croquis · cf(0)=0; argmax en x/c<0.1; decreciente después; integral = c20-01 ±5%
- anderson-c20-01 · Tabla 20.4 Lombardi: Cf del 0012 capa límite vs tres RANS · perfil-2D,capa-límite,CFD · capa límite acoplada: Cf=5.34e-3 ±5%; RANS en [5.34e-3,7.5e-3] con banda ±20%
- anderson-c19-13 · Drag buildup 2D: paneles (presión) + placa plana (fricción) · perfil-2D,panel-2D,capa-límite,transición,polar · Cd(α=0) del 0012 ±15% de Abbott; Cd_presión→0 en α=0
- anderson-c20-08 · Regla de producto: banda ±20% y malla de pared para cf/q_w · CFD,reporte · cf RANS con banda ±20% y ≤2 cifras; BL sin banda solo si cf>0 en toda la cuerda
- anderson-c15-03 · Re_cr medido: xcr=0.05 m a 120 m/s → 412,000 · transición,estudio-viento · 412,000 ±0.5%; xcr(240)=0.025 m; 4 factores reducen xcr

### `anderson-u9-hipersonico-newtoniana` — U9 · Newtoniana sobre la piel B-Rep + calentamiento: por qué la nariz es roma
- caps: [14, 18, 19] · esfuerzo **M** · valor **4** · sprint **5**
- objetivo: newtoniana.ts: Cp=Cp,max sin²θ por panel de skin.ts con sombra; L,D,Cm de TU pieza; Tauber-Meneses 45.78 W/cm² vs Zoby 45; q∝1/√R con el fillet del CAD; gate T>2000 K; waverider caret con el kernel. Lecciones a9-l1..l3.
- ya_existe: src/aero/skin.ts:pielDeMalla/integrarPresion (piel + integración lista); src/aero/cuna-anderson.ts:resolverChoqueOblicuo (β a M=36 OK); src/aero/atmosfera.ts (hasta 84.852 km); src/forja/brep/occt.ts (fillet, loft)
- dependencias: anderson-u7-gasdinamica-tablas, anderson-u8-choque-expansion-croquis

## EJERCICIOS
- anderson-c14-04 · Cp newtoniano modificado sobre la malla B-Rep de cualquier pieza · panel-3D,piel,revolve,choque-normal · Cp,max 1.79/1.83 ±1%; esfera CD=1, cilindro 4/3, placa 2, cono 2sin²θc ±0.5%
- anderson-c14-01 · Ej 14.1(a) Placa 15° Mach 8 exacta · shock-expansion,Prandtl-Meyer · impresos ±2%; L/D=cot15°=3.732 ±0.1%
- anderson-c14-02 · Ej 14.1(b) La misma placa por Newton · newtoniana · impresos ±1%; errores 29%/100%/36.6% ±2%; L/D exacto
- anderson-c14-03 · Ej 14.2 Calentamiento de estancamiento del Shuttle (Tauber-Meneses) · térmico,ISA · 45.78 W/cm² ±1%; ±3% vs Zoby 45; unidades W/cm², m/s, kg/m³, m
- anderson-c14-15 · Dimensionar el radio de nariz: q_w∝1/√R · térmico,revolve,fillet · q_w·√R=52.0 const ±1e-9; R=0.1 m→164 W/cm²; R(30 W/cm²)=3.0 m
- anderson-c14-05 · Curvas newtonianas de placa: cl,max=0.77 a 54.7°, (L/D)max con fricción · newtoniana,optimización · cl,max=4/(3√3)=0.7698; α=54.74°; identidades 14.23-14.27 ±1e-9
- anderson-c14-12 · Waverider caret de Nonweiler en el CAD · croquis,loft,choque-oblicuo,panel-3D · bordes de ataque en el plano de choque <1e-6·l; Cp intradós uniforme=(14.38); L/D=cotδ; vol=prisma ±1e-6
- anderson-c19-11 · P19.7 Nariz esférica a 35 km: q a 1500 y 4500 m/s · térmico,estancamiento,ISA,Sutherland · q(4500)/q(1500)∈[20,35]; ISA(35 km)=583.59 Pa, 246.1 K ±0.5%; etiqueta gas real

### `anderson-u9-moc-taylor-maccoll` — U9 · MOC: diseñar la tobera sin choques + Taylor-Maccoll (cuña vs cono)
- caps: [13, 14] · esfuerzo **L** · valor **3** · sprint **6**
- objetivo: Proceso unitario θ±ν=K±, contorno de enderezamiento → croquis → extruir + plano acotado con oráculo A/A*(Me) del kernel; EDO de Taylor-Maccoll para que el Estudio Viento distinga revolve (cono) de extrude (cuña); independencia de Mach.
- ya_existe: src/aero/cuna-anderson.ts; src/forja/brep/occt.ts + drawing.ts (extruir, plano)
- dependencias: anderson-u7-gasdinamica-tablas, anderson-u8-choque-expansion-croquis

## EJERCICIOS
- anderson-c13-01 · P13.1 Proceso unitario del MOC: punto 3 desde 1 y 2 · MOC-2D,Prandtl-Meyer · K± ±1e-9; derivado: θ3=10°, M3≈2.39, (x3,y3)≈(0.089,0.049) m ±2%
- anderson-c13-02 · Diseño del contorno de tobera supersónica por MOC (§13.3) · MOC-2D,croquis,extruir,plano2D · semialtura salida/garganta = A/A*(Me): 1.6875 (M=2), 2.6367 (M=2.5) ±0.5%; Me uniforme <0.5%; θ_salida=0
- anderson-c13-05 · Taylor-Maccoll: cono por método inverso + carta θc-θs-M · EDO,revolve,aero-3D · β_cono<β_cuña; θc,max cono>cuña; Vθ(θc)=0 ±1e-6; vs Sims ±0.5%
- anderson-c14-08 · Independencia de Mach: cuña y cono 15° vs M (Fig 14.15) · choque-oblicuo,EDO,newtoniana · límites ±1e-9; Cp_cono<Cp_cuña; |Cp(M)−Cp(∞)|<5% para M>10
- anderson-c14-07 · Cuña 15° a M=36: β=18° y límite β=1.2θ · choque-oblicuo · resolverChoqueOblicuo(36,15°)≈18.2° ±2%; ρ2/ρ1→6; Cp→0.163
- anderson-c10-19 · P10.17/10.18 Línea de corriente en abanico PM (M 1→1.6) · Prandtl-Meyer,croquis · giro total ν(1.6)−ν(1); tangente continua

## 5. Brechas vs Fusion / competencia

| prioridad | brecha | qué dice el libro | qué hace la competencia |
|---|---|---|---|
| P0 | Arrastre de fricción y separación: la suite es 100 % inviscida (Cd=0, d'Alembert) | Caps 4.12, 17-19: Cf=1.328/√Re, 0.074/Re^0.2, transición Re_cr como entrada, cuerpo efectivo ab+δ*; 'take it seriously' (§19.2.3) | XFOIL/XFLR5: paneles + capa límite integral + e^N acoplados; SolidWorks Flow Simulation y Autodesk CFD (Fusion) por CFD volumétrico |
| P0 | Paneles 2D con Kutta y perfiles NACA nativos dentro del CAD (hoy panel2d.ts vive sin UI y solo fuentes) | §3.17, §4.2, §4.8, §4.10: fuentes+vórtices, línea media literal del 23012, cl=π(2A0+A1) | XFLR5/XFoil/JavaFoil generan NACA 4/5 dígitos y resuelven paneles de vórtice; Fusion/SolidWorks solo por add-ins de importación .dat |
| P0 | Gas dinámico completo (isentrópicas, choque normal, Prandtl-Meyer, tablas A/B/C, Pitot supersónico) | Caps 7-9 y Apéndices: 'las tablas son el oráculo'; NUNCA p02/p1 con Mn1 en oblicuos; Bernoulli prohibido si M>0.3 | MATLAB Aerospace Toolbox (flowisentropic/flownormalshock/flowprandtlmeyer), calculadoras NASA/VT; Fluent density-based captura choques |
| P0 | Ala finita y polar del avión: lifting-line, VLM, e de Oswald, (L/D)max | Caps 5-6: 'la polar CDo+CL²/πeAR es la piedra angular del diseño conceptual'; el factor #1 es el AR | AVL, OpenVSP/VSPAERO, Tornado, XFLR5 (LLT/VLM); Raymer RDS; cero en navegador |
| P1 | Tobera casi-1D y túnel supersónico sobre la pieza revolucionada | Cap 10: área-Mach bivaluada, régimen por contrapresión, ṁ∝p0A*/√T0, segunda garganta At2/At1=p01/p02, IWC 10.8 | Ansys Fluent/SolidWorks Flow (CFD, minutos-horas); RPA y NASA CEA para cohetes; hojas de Pope & Goin para túneles |
| P1 | Compresibilidad subsónica: P-G/K-T, Mach crítico, regla del área (cortes normales y al ángulo de Mach) | Caps 11-12: Cp=Cp0/√(1−M²); Mcr por (11.63); A(x) suave ⇒ ½ del pico de drag; F-16 area-ruled a M=1.6 | XFoil aplica Karman-Tsien por defecto; OpenVSP tiene Wave Drag con cortes a planos de Mach; Fusion/SolidWorks: sección manual |
| P1 | Hipersónico de ingeniería: newtoniana sobre malla, calentamiento de estancamiento, MOC, Taylor-Maccoll, waveriders | Caps 13-14: Cp=Cp,max sin²θ para diseño preliminar; q∝V³/√R domina el diseño (nariz roma); MOC diseña el contorno sin choques | NASA CBAERO / S-HABP / TPSX, MAXWARP, tablas de Sims; ningún CAD comercial |
| P1 | Campos 2D genéricos con operadores, líneas de corriente sobre campo arbitrario, Γ con signo del libro, volumen de control | Cap 2: Γ≡−∮V·ds (horario positivo); D'=∫ρu2(u1−u2)dy (rastrillo Pitot); ψ⊥φ | ParaView (Calculator, StreamTracer, ParticleTracer), Fluent 'Surface Integrals'; ninguno cruza estela-vs-piel como invariante |
| P1 | Honestidad codificada: dominios de validez, bandas de incertidumbre (cf turbulento ±20 %), gate T>2000 K, Re_cr sin default | §3.5 Ej 3.12, §7.4, §14.2, §20.4: 'no better than about 20 percent'; 'not even close below M=5'; epígrafe deHavilland | Nadie la declara: Fluent/Flow Simulation no avisan; XFLR5 avisa poco. Es la tesis de posicionamiento de CRUCE-Y-PLAN §1 |
| P2 | Unidades duales SI/inglesas (slug, °R, lb/ft², mi/h, hp) y Apéndice E | Problemas de los caps 1-10 y 19 mezclan sistemas a propósito ('which system to use will be self-evident') | Fusion/SolidWorks: unidades por documento conmutables; XFLR5 pide ρ/ν a mano |
| P2 | CFD viscoso compresible (MacCormack, RANS Baldwin-Lomax, mallado O/C, quimera) y transónico | Caps 13, 16, 20: único camino para 0.8<M<1.2, cuerpos romos, separación masiva, choque/capa límite; [GPU-VIVO] | Ansys Fluent, SU2, OpenFOAM, Autodesk CFD, SolidWorks Flow Simulation; La Forja debe DECIR 'aquí no veo' (CURRICULUM l.162) |

## 6. Tramos faltantes, gotchas y notas

- Cobertura: los 10 tramos cubren el libro completo (caps 1-20 + apéndices). No falta tramo. Cap 13 y cap 20 no traen ejemplos resueltos; sus oráculos son invariantes/derivados.
- Figuras con DATO que el txt no trae (bloquean fixtures hasta digitalizar): 1.65 (Lilienthal), 3.44 (CD(Re) cilindro), 4.10/4.11/4.25/4.28/4.51 (polares NACA), 5.2 (23015), 5.20 (δ McCormick), 9.9 (θ-β-M: La Forja YA la reproduce), 11.4/11.8/11.10, 18.8/18.9, 19.1, 20.7/20.15/20.16. Solo están digitalizadas 1.58 y 18.7-18.9 en aero-pliego/figuras/.
- Erratas del libro ya cazadas (ver notas por tramo): Ej 1.7 ρ, Ej 3.2 2073.1, Ej 3.12 cita 3.4, IWC 3.23 Pc 7.682e6, Ej 4.10 'Ej 4.7', Ej 7.2 unidad, Ej 8.23/8.24, Ej 9.4/9.11, Ej 10.5 R=510, Ej 12.2 q en m/s, Ej 14.1 L/D 0.3468, Ej 14.2 J/(kg·K), Ej 18.3 ρ*/Cf*, Ej 19.3 μ*, Ap. D −3,700 m T=212.22.
- Convenciones que hay que fijar en código: Γ≡−∮V·ds (horario +); θ del cilindro desde el estancamiento trasero; Blasius con η=y√(V/νx) → f''(0)=0.332 (NO 0.4696 de Bertin/CURRICULUM a6-l2); dos 'e' (envergadura vs Oswald), dos 'δ', dos 'τ'; Pr=0.71 fijo declarando k=1.45μcp ⇒ 0.69; T0=288.16/R=287/g=9.80 (ARDC) vs ISO 2533.
- Registro de comandos: el Estudio Viento se enciende por estado local del Studio, no por el bus `ui.run` (grep viento|aero registry.ts = 0). Si clase-drive lo maneja, conviene registrarlo (S3 de paneles lo hace).
- Sprint 1 = lo que más valor da con lo que ya funciona: `anderson-u3-paneles-en-el-cad` (cablear panel2d), `anderson-u7-gasdinamica-tablas` (gasdinamica.ts, prerequisito de todo lo compresible), `anderson-u8-choque-expansion-croquis` (extiende viento.ts que YA está en la UI), `anderson-u1-fuerzas-momentos` (generaliza cuna-anderson.ts).
- Doctrina: cada superticket cierra con VIDEO (clase-drive + parrilla.sh) + stills + oráculo; el estado verde/rojo lo escribe la producción.
