# TÉRMICO + CFD + CHT — pliego como cliente (code_saturne · Code_Aster · OpenFOAM CHT · Ansys APDL Thermal)

**Libro (manuales):** Térmico + CFD + CHT — code_saturne 9.0 Theory Guide (EDF), Code_Aster R5.02.01 (thermique linéaire transitoire), Conjugate Heat Transfer in OpenFOAM (Välikangas, Chalmers), Ansys Mechanical APDL Thermal Analysis Guide 2025 R1 (+ digesto pliego-termica-cfd.md)

**El autor como cliente:** Los constructores de solvers térmicos y de fluidos (EDF R&D, EDF/Code_Aster, Chalmers OS-CFD, ANSYS) NO opinan: prescriben. Su contrato: (1) el solver EMITE su propio balance de energía a redondeo; (2) toda frontera es Dirichlet/Neumann/Robin/pared-pared explícita, acumulada, nunca sobrescrita; (3) h nunca se teclea: viene de correlación o de CFD y se pone en serie con k/(Δ/2) (h_eq armónica, SAT Eq I.5.9); (4) la malla la manda la capa límite térmica, ITS=Δ²/4α; más subpasos en la misma malla = peor (APDL §3.4.3.2); (5) θ≥1/2 incondicionalmente estable, θ=1/2 orden 2 (AST §5.1); (6) cambio de fase = entalpía H(T), rampas, AUTOTS (APDL §3.8); (7) cada análisis se contrasta con su VM (catálogo de verificación ANSYS: VM28/92/94/104/109/110/116/125/161) y con analíticas cerradas.


## Fuentes / capítulos

| # | Fuente | Ejercicios | Cubierto | Nota |
|---|---|---|---|---|
| 1 | Digesto pliego-termica-cfd.md: proceso D0-D9, reglas MUST/SHOULD, analíticas R1-R9, gates G1-G10, brecha medida | 12 | parcial | R5 y MMS gateados; R1-R4/R7-R9, ledger y G4 sin gate (área mojada 2.00× sin resolver) |
| 2 | Ansys APDL Thermal Analysis Guide 2025 R1: estacionario (§2.7 tubo-tanque), transitorio (§3.10 colada, ITS, fase), advección (§4.2), radiación (§5.7-5.10), catálogo VM | 8 | parcial | t_c/series del libro sí; k(T), entalpía, radiación, SUPG no |
| 3 | Code_Aster R5.02.01 thermique linéaire transitoire: BC Dirichlet/relaciones/flujo/échange/échange paroi, θ-método (precisión, estabilidad, θ=0.57), discretización espacial | 3 | parcial | estabilidad/orden cubiertos por campo.ts espectral; échange paroi y partición de fronteras no |
| 4 | code_saturne 9.0 Theory Guide: budget por celda, difusión armónica vs aritmética (§4.3), Dirichlet/Neumann/Robin y h_eq (§5.3), funciones de pared Arpaci-Larsen (§5.4), turbulencia | 4 | parcial | armónica sí (3 sitios); h_eq no (−9.9 %); ley de pared no; cierre de flujos parcial |
| 5 | Conjugate Heat Transfer in OpenFOAM (Välikangas): chtMultiRegionSimpleFoam OF40 vs FE40 vs conjugateHeatSimpleFoam, oneFluidOneSolid2D, AMI, monitor de convergencia, lazos 1:2, tips limitTemperature | 4 | no | no hay fluido resuelto; el agua es un h |

## Catálogo de ejercicios / benchmarks (31)

| id | título | fuente | herramientas | oráculo | respuesta impresa | tipo | valor | ya existe | dónde |
|---|---|---|---|---|---|---|---|---|---|
| termica-cfd-pliego-01 | R1 · Pared plana estacionaria Dirichlet-Dirichlet (patch test térmico, VM92) | pliego §3.4 R1 / APDL VM92 | estudio térmico estacionario sobre placa P20 50 mm, T1=200/T2=100 | q = k·ΔT/L = 64 000 W/m² y T(x) lineal, error relativo < 1e-12 | pliego §3.4 R1: q = 32·100/0.05 = 64 000 W/m² | benchmark | 5 | parcial | scripts/verif-mms-termico-test.cjs M3 (patch lineal) |
| termica-cfd-pliego-02 | R2 · Pared plana con Robin en ambas caras (valida h_eq) | pliego §3.4 R2 / SAT §5.3.3 | placa P20 L=50 mm, h1=h2=1000, T∞1=200, T∞2=20 | q = ΔT/(1/h1+L/k+1/h2) = 50 526 W/m²; T_pared1 = 149.47 °C; error < 0.5 % (si sale ~10 % falta h_eq) | pliego §3.4 R2: q = 50 526 W/m², T_pared_1 = 149.47 °C | benchmark | 5 | no |  |
| termica-cfd-pliego-03 | R3 · Sólido semi-infinito, escalón de temperatura superficial (VM28/VM110/VM114) | pliego §3.4 R3 / APDL VM28 | transitorio 1D P20, T_s escalón, malla graduada δ=√(αt) | T(x,t)=T_s+(T_i−T_s)·erf(x/2√(αt)) < 2 % en 5 puntos dentro de δ; Q(t)=(2/√π)·e·ΔT·√t < 1 % (forma √t, NO lineal) | pliego §3.4 R3: e_P20 = 11 186 J/(m²·K·√s), α = 8.184e-6 m²/s | benchmark | 5 | parcial | src/forja/mold/fan.ts:51 (erf imágenes, placa) — sin gate semi-infinito |
| termica-cfd-pliego-04 | R4 · Contacto de dos semi-infinitos ABS 239 °C ↔ P20 60 °C (efusividad) | pliego §3.4 R4 | FDM 3D del molde (createThermalSim) + contactTemperature() | T_contacto = (e1T1+e2T2)/(e1+e2) = 69.73 °C constante ±0.5 °C; Q(t) = 122 817·√t J/m² < 3 % en t∈[0.1,5] s; independiente del espesor (12 vs 2 mm iguales antes de ~3 s) | pliego §3.4 R4: T_contacto = 69.73 °C; Q(1 s)=122 817 J/m²; Q(19 s)=535 348 J/m² | benchmark | 5 | parcial | src/forja/mold/thermal-layers.ts:29 contactTemperature (valor 69.73 sin gate; scripts/kazmer-termica-3d-test.cjs:39) |
| termica-cfd-pliego-05 | R5 · Placa finita, tiempo de enfriamiento Eq 9.5 (VM110/VM116) | pliego §3.4 R5 / Kazmer Eq 9.5 | tcPlateS + serie completa Fourier + FDM | t_c = (h²/π²α)·ln((4/π)(Tm−Tc)/(Te−Tc)); ABS 2 mm: 11.3 s; ejemplos Kazmer 8.4/18.9 s < 5 %; ley t_c ∝ h² = 4.000× | pliego §3.4 R5: t_c = 11.3 s (ABS, 2 mm, 239/60/80) | benchmark | 4 | si | src/forja/mold/cooling-design.ts:79 tcPlateS; scripts/termico-cross.cjs; scripts/kazmer-termica-test.cjs |
| termica-cfd-pliego-06 | R6 · Cilindro/esfera: lumped vs serie de Bessel (VM109/VM111/VM112/VM108) | pliego §3.4 R6 / APDL VM109 | pin/núcleo cilíndrico enfriado por convección h | Bi<0.1: (T−T∞)/(T0−T∞)=exp(−hAt/ρcV) < 1 %; Bi>0.1: serie J0 con raíces λJ1(λ)=Bi·J0(λ) < 2 % |  | benchmark | 3 | parcial | src/forja/mold/thermal-series.ts (series Bessel del libro; sin gate cilindro-h) |
| termica-cfd-pliego-07 | R7 · Placa con generación volumétrica (parábola, VM94/VM115/VM58) | pliego §3.4 R7 / APDL VM94 | fuente q''' distribuida en el FDM/estacionario CG | T(x)=T_s+q'''(L²−x²)/2k EXACTO a < 1e-10 (cuadrática en reja uniforme 2º orden) |  | benchmark | 4 | no |  |
| termica-cfd-pliego-08 | R8 · Factor de forma: fila de cilindros bajo plano isotermo (el circuito de agua) | pliego §3.4 R8 / Holman T3-1 / Incropera T4.1 | circuito de agua del molde (cooling-design + FDM 3D) | S/L = 2π/ln[(2W/πD)·sinh(2πH/W)]; q' = k·(S/L)·ΔT; D=6.35, P20, ΔT=40: W25/H25 → 1 236 W/m; W50.8/H25 → 1 998 W/m; W75/H35 → 1 891 W/m; tolerancia 8 % | pliego §3.4 R8 tabla: 1 236 / 891 / 1 998 / 1 528 / 2 363 / 1 891 W/m | benchmark | 5 | no |  |
| termica-cfd-pliego-09 | R9 · Onda térmica periódica del ciclo (estacionario cíclico) | pliego §3.4 R9 | FDM 3D del molde ciclado N ciclos, P=30 s | d=√(2α/ω)=8.84 mm; amplitud a x=d cae a 1/e ±5 %; E_store(t+P)=E_store(t) y ∫Q_in=∫Q_out por ciclo < 0.5 % | pliego §3.4 R9: d = 8.84 mm (P20, P=30 s, ω=0.2094 rad/s) | benchmark | 4 | desconocido | src/forja/sim/cycle-engine.ts (ciclo) — periodicidad térmica no verificada |
| termica-cfd-pliego-10 | G4 · Auditoría geométrica de fronteras (área mojada discreta vs π·D·L) | pliego §3.2 / §6.2 | auditGeometria(sim) pura sobre la reja del molde | ratio área mojada discreta/analítica = 1.00 ± 0.02 y ratio volumen plástico = 1.00 ± 0.02 (hoy medido 2.00 → FALLA) | pliego §6.2: 1273.6 cm² vs 637.2 cm² = 2.00× | gate | 5 | no |  |
| termica-cfd-pliego-11 | G1 · Libro mayor de energía emitido por el solver | pliego §3.1 / SAT balance | sim.ledger() dentro de step(), float64 | \|E_acero+E_plastico − Q_fuente + Q_agua\| / Q_fuente < 1e-10 en cada paso; adiabático: deriva < 1e-12 |  | gate | 5 | no |  |
| termica-cfd-pliego-12 | G9 · Refinamiento de Richardson / orden observado (MMS) | pliego §3.3 G9 / Roache 2002 | verif-mms sobre cubo y sobre molde real | orden observado p = 2.0 ± 0.2 en Δ, Δ/2, Δ/4; control negativo (signo cambiado) degrada p |  | gate | 4 | si | scripts/verif-mms-termico-test.cjs M4 (orden 3D Dirichlet), M13 controles negativos |
| termica-cfd-apdl-01 | APDL §2.7 · Junta tubo-tanque, estacionario con k(T) y h(T) (1/4 de simetría) | APDL §2.7 (pp. 24-27) | modelar 2 cilindros + boolean, malla mapeada, propiedades tabuladas, 50 substeps | cierre de balance: Σ q_conv tanque + Σ q_conv tubo = 0 (±0.5 %); 100 °F ≤ T ≤ 450 °F en todo el dominio; k(T) por interpolación de la Tabla 2.13 (8.35…10.23 Btu/hr-ft-°F) | APDL Tabla 2.13: h_tanque = 250 Btu/hr-ft²-°F (1420 W/m²K); h_tubo(T) = 426/405/352/275/221 | tutorial | 4 | no |  |
| termica-cfd-apdl-02 | APDL §3.10 · Solidificación de colada de acero en molde de arena en L (3 h) | APDL §3.10 (pp. 62-66) | transitorio no lineal con ENTALPÍA H(T), AUTOTS, media simetría, convección al ambiente | energía liberada por el acero = ∫ρ·ΔH = H(2875)−H(T_final) por volumen (174.2 Btu/in³ tabla); tiempo de solidificación = instante en que max T_acero < 2643 °F; balance ledger < 1 % | APDL §3.10.2: H(0)=0, H(2643)=128.1, H(2750)=163.8, H(2875)=174.2 Btu/in³; k_arena=0.025 Btu/hr-in-°F; h=0.014 Btu/hr-in²-°F | tutorial | 4 | parcial | src/forja/mold/colada.ts (menciona entalpía/latente; sin H(T) tabulada ni gate) |
| termica-cfd-apdl-03 | APDL §3.4.3.2 · ITS = Δ²/4α: control negativo de oscilación por paso demasiado chico | APDL §3.4.3.2 (Caution) | FDM implícito/espectral con Δt < ITS sobre reja 7 mm P20 | con Δt = ITS/20 aparecen T fuera de rango [T_min,T_max] iniciales (oscilación); con Δt ≥ ITS no; ITS(7 mm, P20) = 1.497 s | pliego apéndice: reja 7 mm ITS = 1.497 s | gate | 3 | no |  |
| termica-cfd-apdl-04 | APDL §4.2 · Advección a Pe=1e6, flujo oblicuo 30° en cuadrado unitario (SUPG + DC) | APDL §4.2 (pp. 71-77) | advección-difusión con upwind/SUPG sobre reja 10×10 | overshoot T_max−1 < 0.1 (más de un orden bajo la entrada) con upwind; sin estabilización el Galerkin oscila (control) | APDL §4.2.2: overshoot 'more than an order of magnitude smaller than the inlet temperature'; DC3 lo reduce >4 órdenes | tutorial | 2 | no |  |
| termica-cfd-apdl-05 | APDL §5.7 · Radiación entre dos anillos (ε=0.9 a 1500 °F, ε=0.7 a 100 °F, espacio 70 °F) | APDL §5.7 (pp. 96-98) | radiación gris entre superficies concéntricas (radiosidad) | q por unidad de longitud = σ(T1⁴−T2⁴)/(1/ε1·A1 + (1/ε2−1)/A2) con r1=0.5, r2=0.75 in (VM125); error < 3 % | APDL §5.7.1: ε_int=0.9 T=1500 °F; ε_ext=0.7 T=100 °F; T_espacio=70 °F | tutorial | 2 | no |  |
| termica-cfd-apdl-06 | APDL §5.10 · Cilindros concéntricos 12/13 mm, 1000 °C ↔ ambiente 500 °C, con solución analítica | APDL §5.10 (pp. 104-108) | radiación ε=1 + factores de vista actualizados con desplazamiento radial | q_interior→exterior = σ·(T1⁴−T2⁴)·2πr1 por unidad de longitud (ε=1); T_cilindro exterior del balance radiación-radiación con 500 °C; comparar contra 'analytical solution' del ejemplo II citado | APDL §5.10: r_int=12 mm, r_ext=13 mm, e=1 mm, T_int=1000 °C, T_amb=500 °C, ε=1, k=8 | tutorial | 2 | no |  |
| termica-cfd-apdl-07 | VM97/VM161 · Aleta recta y tubo aislado (radio crítico) — resistencias en serie | APDL Verification Manual VM97, VM161 | thermal-resistance.ts rCyl/rConv/rSeries | aleta: T(x)=T∞+(Tb−T∞)·cosh(m(L−x))/cosh(mL), m=√(hP/kA); tubo: q'=ΔT/(ln(r2/r1)/2πk + 1/(2πr2h)), r_crit = k/h; < 1 % |  | benchmark | 3 | parcial | src/forja/mold/thermal-resistance.ts:25-37 rPlate/rCyl/rConv/rSeries (sin gate contra VM) |
| termica-cfd-apdl-08 | VM104 · Cambio de fase líquido-sólido (problema de Stefan/Neumann) | APDL VM104 / §3.8 | entalpía H(T) con calor latente, malla lumped, AUTOTS | frente de solidificación X(t)=2λ√(αt) con λ de la ecuación trascendente de Neumann; error < 3 % en X(t) |  | benchmark | 3 | no |  |
| termica-cfd-aster-01 | AST §5.1 · θ-método: orden 2 con θ=1/2, orden 1 con θ≠1/2, estabilidad incondicional θ≥1/2 | Code_Aster R5.02.01 §5.1.1-5.1.2 | integrador temporal con θ seleccionable (0, 0.5, 0.57, 1) | pendiente log(err) vs log(Δt) = 2.0±0.1 con θ=0.5 y 1.0±0.1 con θ=1; θ=0 diverge si Δt > 2/λ_max = Δx²/6α (3D); θ=0.57 default Aster estable | AST §5.1.2: 'si θ ≥ 1/2 inconditionnellement stable; si θ < 1/2 Δt ≤ 2/((1−2θ)λ)'; default THER_LINEAIRE θ = 0.57 | teoria | 3 | parcial | src/forja/campo/campo.ts operador espectral exacto en dt (no θ-método); explícito comparado en gate campo-operador |
| termica-cfd-aster-02 | AST §2.5 · Echange paroi: resistencia de interfaz plástico↔acero (aire/desmoldante) | Code_Aster R5.02.01 §2.5 / §4 | dos sólidos acoplados por h_interfaz (pared-pared), no Robin de un lado | salto T2−T1 = q/h_int en la interfaz; con h_int→∞ recupera R4 (69.73 °C); con h_int = 2000 W/m²K el T de superficie de acero cae y el t_c sube ≥ Kazmer (declarado) |  | benchmark | 4 | no |  |
| termica-cfd-aster-03 | AST §2 · Partición de la frontera Γ=Γ1∪Γ2∪Γ3: ninguna cara sin condición | Code_Aster R5.02.01 §2.1-2.4 | auditoría de BC por cara de la reja del molde | cada cara de frontera clasificada en exactamente {Dirichlet, Neumann, Robin, pared-pared}; caras 'huérfanas' = 0; acumulación += (dos parches sobre una celda suman conductancia) |  | gate | 4 | no |  |
| termica-cfd-sat-01 | SAT §5.3.3 · h_eq armónica: Robin con h_int=k/(Δ/2) en serie con h_ext; límite h_ext→∞ = Dirichlet | code_saturne 9.0 §5.3.1-5.3.3 Eq I.5.3/I.5.9 | Robin por vóxel del FDM (cool[idx]) | h_eq = h_int·h_ext/(h_int+h_ext); reja 7 mm P20: h_int=9143, h_eq(1000)=901.4 (−9.9 %); con h_ext=1e9 el flujo iguala al de Dirichlet a < 0.1 % | pliego apéndice: h_int = 9143 W/m²K, h_eq = 901.4 | benchmark | 5 | no |  |
| termica-cfd-sat-02 | SAT §4.3 · Media armónica vs aritmética de k en la cara ABS/P20 (razón 168:1) | code_saturne 9.0 §4.3 Eq I.4.30/I.4.31 | barra bicapa ABS 2 mm + P20 50 mm, Dirichlet-Dirichlet | q con armónica = q analítico de resistencias en serie (< 1e-10); con aritmética error ×43 (control negativo); continuidad de flujo en la cara |  | benchmark | 4 | si | src/forja/mold/thermal-layers.ts:56, mold-thermal-fdm.ts:282 gInt, thermal-steady.ts:79 harm; scripts/verif-termico-cortado-test.cjs |
| termica-cfd-sat-03 | SAT §5.4 · Función de pared: u+=y+ (y+<1/κ) y u+=(1/κ)ln y+ + 5.2; h de línea de agua vs Dittus-Boelter | code_saturne 9.0 §5.4.1-5.4.3 Eq I.5.16-I.5.19 | hCoolant(Re) + ley de pared para agua en línea Ø6.35 mm | Nu=0.023·Re^0.8·Pr^0.4 vs h de la ley de pared (Arpaci-Larsen 3 capas) dentro de 20 % para Re∈[1e4,1e5]; laminar Re<2300 marcado | SAT §5.4.2: Clog = 5.2; y+_lim = 1/κ | benchmark | 3 | parcial | src/forja/mold/thermal-resistance.ts:32 hCoolant; cooling-design.ts:87 reynoldsLine (sin ley de pared) |
| termica-cfd-sat-04 | SAT §4 · Balance de flujos: Σ flujos de frontera + Σ fuentes = 0 en estacionario (rutina de balance) | code_saturne 9.0 §4.1/§4.3 (budget explícito por celda) | solveSteadyMoldField + suma de flujos de frontera | \|Σ_caras q·A + Σ q'''V\| / max(\|q·A\|) < 1e-8 tras convergencia CG con residual relativo < 1e-8 |  | gate | 4 | parcial | src/forja/mold/thermal-steady.ts:236 residualRel (sin cierre de potencia por fronteras) |
| termica-cfd-cht-01 | CHT §1.3/§6 · oneFluidOneSolid2D: sólido a 350 K abajo, aire 300 K a 1 m/s arriba, tapa periódica | Välikangas §1.3, §6.1-6.2 | CHT particionado: fluido con h o resuelto + sólido conducción; monitor T_min sólido vs tiempo | continuidad en la interfaz: k_s·∂T/∂n\|_s = k_f·∂T/∂n\|_f (< 1 %); 300 K < T_interfaz < 350 K; lazo 1 fluido : 2 sólido converge más rápido que 1:5 y que 1:1 (monitor) | CHT §6.2: 1 fluid loop + 2 solid loops converge fastest; FE chtMultiRegion 3-4× más rápido que OF foundation | tutorial | 3 | no |  |
| termica-cfd-cht-02 | CHT §2.2 · Interfaz no conforme (nearestPatchFaceAMI): interpolación conservativa entre mallas | Välikangas §2.2 / §6.3 | reja plástico fina (0.17 mm) vs acero gruesa (7 mm) con remapeo | flujo total a través de la interfaz idéntico en ambos lados < 0.5 %; sin discontinuidad de T; ratio de resolución 'lo más similar posible' (APDL Fig 5.1) |  | gate | 3 | no |  |
| termica-cfd-cht-03 | CHT §2.1.2 · Entalpía vs temperatura con ρc(T) variable: deriva del balance | Välikangas §2.1.2 (ecuación en h) / APDL §3.8 | integrar h=∫ρc dT en vez de T con c(T) del acero de APDL Tabla 2.13 | con ρc(T) variable, integrar T deriva ∝ rango de T; integrar h cierra el ledger < 1e-8 (control A/B) |  | gate | 3 | no |  |
| termica-cfd-cht-04 | CHT §4.1 · Boussinesq: convección natural sólo para ΔT pequeña (límite declarado) | Välikangas §4.1 (chtMultiRegionSimpleBoussinesqFoam) | cavidad cerrada calentada, Ra 1e4-1e6 | Nu de cavidad cuadrada vs de Vahl Davis (Ra=1e4: 2.243; 1e5: 4.519; 1e6: 8.800) < 5 %; fuera de β·ΔT ≪ 1 se marca inválido |  | benchmark | 2 | no |  |

## Features (estado verificado con grep/ls)

| feature | qué hace | estado | prioridad | ejercicios | dónde |
|---|---|---|---|---|---|
| Libro mayor de energía (ledger) emitido por el solver | sim.ledger() en float64 dentro de step(): E_acero, E_plastico, Q_agua, Q_fuente, residualRel; gate < 1e-10 | no | P0 | termica-cfd-pliego-11, termica-cfd-apdl-02, termica-cfd-cht-03 | grep 'ledger|auditGeom' src/forja/mold scripts → 0 hits |
| Auditoría geométrica de fronteras G4 | función pura: área mojada discreta / π·D·L y volumen plástico discreto / malla; ratios 1.00±0.02 | no | P0 | termica-cfd-pliego-10, termica-cfd-aster-03 | grep → 0 hits (pliego §6.2 mide 2.00×) |
| Robin con h_eq armónica (SAT Eq I.5.9) y acumulación += | h_eq = h_int·h_ext/(h_int+h_ext) con h_int=k/(Δ/2); cool[idx] += en vez de = | no | P0 | termica-cfd-pliego-02, termica-cfd-sat-01 | src/forja/mold/mold-thermal-fdm.ts (Robin exacto exp(−cool·dt) sin h_eq; pliego §6.4 −9.9 %) |
| Suite de analíticas cerradas R1-R9 como gates | patch lineal, Robin doble, semi-infinito erf, contacto efusividad, t_c placa, Bessel, parábola de generación, factor de forma, onda periódica | parcial | P0 | termica-cfd-pliego-01, termica-cfd-pliego-03, termica-cfd-pliego-04, termica-cfd-pliego-05, termica-cfd-pliego-06, termica-cfd-pliego-07, termica-cfd-pliego-08, termica-cfd-pliego-09 | src/forja/mold/thermal-layers.ts:29 contactTemperature; cooling-design.ts:79 tcPlateS; thermal-series.ts; scripts/termico-cross.cjs + kazmer-termica-test.cjs (R5 sí); R1/R2/R3/R7/R8/R9 sin gate |
| Factor de forma del circuito de agua (fila de cilindros) | S/L = 2π/ln[(2W/πD)·sinh(2πH/W)] contra la extracción del FDM 3D | no | P0 | termica-cfd-pliego-08 | grep 'sinh(' src/forja/mold → 0 hits |
| FDM 3D transitorio del molde con depósito por forma de pieza | createThermalSim(spec): plástico↔acero↔agua, hot spot 3D, isosuperficie, slices | si | P0 | termica-cfd-pliego-04, termica-cfd-pliego-09 | src/forja/mold/mold-thermal-fdm.ts:111 createThermalSim; scripts/mold-termico3d-test.cjs (gate forja-gate:140) |
| Estacionario CG matrix-free del molde + celda cortada | solveSteadyMoldField con interfaz material cortada (sdf) y residual relativo | si | P0 | termica-cfd-sat-02, termica-cfd-sat-04 | src/forja/mold/thermal-steady.ts:49; scripts/verif-termico-cortado-test.cjs (gate forja-gate:114) |
| Verificación MMS / orden observado | soluciones manufacturadas, paridad con el solver real, controles negativos | si | P1 | termica-cfd-pliego-12 | scripts/verif-mms-termico-test.cjs M1-M13 |
| Operador espectral 𝔄 de difusión (paso exacto en dt) | DST-I Dirichlet, LUTs 1D, reproduce Eq 9.5 8.40 s | si | P1 | termica-cfd-aster-01, termica-cfd-apdl-03 | src/forja/campo/campo.ts (gate campo-operador forja-gate:156) |
| Malla graduada por capa límite térmica + ITS | Δ ≤ 2√(α·t_min) en la interfaz; control negativo de oscilación con Δt<ITS | no | P1 | termica-cfd-apdl-03, termica-cfd-pliego-03 | pliego §6.3: PCELLS=6 uniforme; reja acero 7 mm; sin malla graduada |
| Propiedades k(T), c(T) y entalpía H(T) con cambio de fase | tablas por temperatura, H=∫ρc dT, AUTOTS, rampas KBC | parcial | P1 | termica-cfd-apdl-01, termica-cfd-apdl-02, termica-cfd-apdl-08, termica-cfd-cht-03 | src/forja/mold/colada.ts y mold-thermal-fdm.ts mencionan entalpía; thermal-layers.ts propiedades CONSTANTES; sin H(T) tabulada |
| Pared-pared (echange paroi): resistencia de interfaz plástico↔acero | dos sólidos acoplados por h_interfaz; límite h→∞ = contacto perfecto | no | P1 | termica-cfd-aster-02 | grep → sin conductancia de interfaz distinta de la armónica |
| Coeficiente h de línea de agua: Dittus-Boelter + ley de pared | Nu=0.023Re^0.8Pr^0.4; u+ log-law Clog=5.2 (SAT §5.4) | parcial | P1 | termica-cfd-sat-03, termica-cfd-apdl-07 | src/forja/mold/thermal-resistance.ts:32 hCoolant(Re); cooling-design.ts:87 reynoldsLine; sin ley de pared |
| Estacionario cíclico (régimen periódico del molde) + validación Fig 9.7 | N ciclos hasta E_store(t+P)=E_store(t); onda d=√(2α/ω) | desconocido | P1 | termica-cfd-pliego-09 | src/forja/sim/cycle-engine.ts existe; periodicidad térmica no verificada por grep |
| Advección / SUPG (transporte de masa a Pe alto) | upwind + captura de discontinuidad; Pe de elemento < 1 o estabilización | no | P2 | termica-cfd-apdl-04 | grep 'upwind|SUPG|Peclet' → 0 hits en src/forja |
| Radiación gris (radiosidad / factores de vista) | q=σε(T⁴−T∞⁴), VM125/VM228 cilindros concéntricos | no | P2 | termica-cfd-apdl-05, termica-cfd-apdl-06 | grep 'radiac|Boltzmann|sigmaSB' src/forja → 0 hits |
| CHT con fluido resuelto (agua/aire) + interfaz AMI | chtMultiRegion-like: fluido NS + sólido, lazos 1:2, interpolación conservativa | no | P2 | termica-cfd-cht-01, termica-cfd-cht-02, termica-cfd-cht-04 | src/forja/sim/viento.ts = cuña supersónica inviscida (Anderson), no NS ni CHT |
| Piel congelada N2 (erf × WLF × power-law) en el llenado | estrangulador de cara k→k·(h_eff/h)³·η0(Tm)/η0(Tc) | si | P1 |  | src/forja/mold/fan.ts:51 erf imágenes; filling.ts:130 CrossWLF; ordenes/2026-08-17-n2-termico.md |

## Supertickets (líneas Temis listas para pegar)

### `termica-cfd-analiticas-gate` — Las 7 analíticas cerradas como gates del térmico (R1-R4, R7, R9 + MMS)

- **Capítulos:** [1, 2, 4] · **Esfuerzo:** M · **Valor:** 5/5 · **Sprint:** 1
- **Objetivo:** Que el solver térmico de La Forja (FDM 3D + estacionario CG) reproduzca las soluciones cerradas de los manuales con tolerancia declarada, ANTES de creerle un solo hot spot del molde; cada una con video de lección y still del perfil vs analítica.
- **Ya existe:** R5 t_c placa: cooling-design.ts:79 + termico-cross.cjs (8.4/18.9 s); contactTemperature thermal-layers.ts:29 (69.73 °C sin gate); MMS verif-mms-termico-test.cjs (orden 3D); media armónica en 3 sitios (thermal-layers:56, fdm:282, steady:79)
- **Dependencias:** (ninguna)

```
## EJERCICIOS
- termica-cfd-pliego-01 · R1 · Pared plana estacionaria Dirichlet-Dirichlet (patch test térmico, VM92) · estudio térmico estacionario sobre placa P20 50 mm, T1=200/T2=100 · q = k·ΔT/L = 64 000 W/m² y T(x) lineal, error relativo < 1e-12
- termica-cfd-pliego-02 · R2 · Pared plana con Robin en ambas caras (valida h_eq) · placa P20 L=50 mm, h1=h2=1000, T∞1=200, T∞2=20 · q = ΔT/(1/h1+L/k+1/h2) = 50 526 W/m²; T_pared1 = 149.47 °C; error < 0.5 % (si sale ~10 % falta h_eq)
- termica-cfd-pliego-03 · R3 · Sólido semi-infinito, escalón de temperatura superficial (VM28/VM110/VM114) · transitorio 1D P20, T_s escalón, malla graduada δ=√(αt) · T(x,t)=T_s+(T_i−T_s)·erf(x/2√(αt)) < 2 % en 5 puntos dentro de δ; Q(t)=(2/√π)·e·ΔT·√t < 1 % (forma √t, NO lineal)
- termica-cfd-pliego-04 · R4 · Contacto de dos semi-infinitos ABS 239 °C ↔ P20 60 °C (efusividad) · FDM 3D del molde (createThermalSim) + contactTemperature() · T_contacto = (e1T1+e2T2)/(e1+e2) = 69.73 °C constante ±0.5 °C; Q(t) = 122 817·√t J/m² < 3 % en t∈[0.1,5] s; independiente del espesor (12 vs 2 mm iguales antes de ~3 s)
- termica-cfd-pliego-07 · R7 · Placa con generación volumétrica (parábola, VM94/VM115/VM58) · fuente q''' distribuida en el FDM/estacionario CG · T(x)=T_s+q'''(L²−x²)/2k EXACTO a < 1e-10 (cuadrática en reja uniforme 2º orden)
- termica-cfd-pliego-09 · R9 · Onda térmica periódica del ciclo (estacionario cíclico) · FDM 3D del molde ciclado N ciclos, P=30 s · d=√(2α/ω)=8.84 mm; amplitud a x=d cae a 1/e ±5 %; E_store(t+P)=E_store(t) y ∫Q_in=∫Q_out por ciclo < 0.5 %
- termica-cfd-pliego-12 · G9 · Refinamiento de Richardson / orden observado (MMS) · verif-mms sobre cubo y sobre molde real · orden observado p = 2.0 ± 0.2 en Δ, Δ/2, Δ/4; control negativo (signo cambiado) degrada p
```

### `termica-cfd-ledger-geometria` — El solver EMITE su balance: ledger de energía, auditoría geométrica y BC acumuladas

- **Capítulos:** [1, 3, 4] · **Esfuerzo:** L · **Valor:** 5/5 · **Sprint:** 1
- **Objetivo:** Cazar los factores enteros (área mojada 2.00×) y el falso −99.5 % con gates mecánicos: ledger float64 dentro de step(), auditGeometria(), partición de fronteras sin caras huérfanas, h_eq armónica y control negativo de ITS.
- **Ya existe:** residualRel en thermal-steady.ts:236; Robin exacto exponencial por vóxel en mold-thermal-fdm.ts; operador espectral conserva (deriva 1.19e-5 float32, pliego §6.5)
- **Dependencias:** termica-cfd-analiticas-gate

```
## EJERCICIOS
- termica-cfd-pliego-10 · G4 · Auditoría geométrica de fronteras (área mojada discreta vs π·D·L) · auditGeometria(sim) pura sobre la reja del molde · ratio área mojada discreta/analítica = 1.00 ± 0.02 y ratio volumen plástico = 1.00 ± 0.02 (hoy medido 2.00 → FALLA)
- termica-cfd-pliego-11 · G1 · Libro mayor de energía emitido por el solver · sim.ledger() dentro de step(), float64 · |E_acero+E_plastico − Q_fuente + Q_agua| / Q_fuente < 1e-10 en cada paso; adiabático: deriva < 1e-12
- termica-cfd-aster-03 · AST §2 · Partición de la frontera Γ=Γ1∪Γ2∪Γ3: ninguna cara sin condición · auditoría de BC por cara de la reja del molde · cada cara de frontera clasificada en exactamente {Dirichlet, Neumann, Robin, pared-pared}; caras 'huérfanas' = 0; acumulación += (dos parches sobre una celda suman conductancia)
- termica-cfd-sat-01 · SAT §5.3.3 · h_eq armónica: Robin con h_int=k/(Δ/2) en serie con h_ext; límite h_ext→∞ = Dirichlet · Robin por vóxel del FDM (cool[idx]) · h_eq = h_int·h_ext/(h_int+h_ext); reja 7 mm P20: h_int=9143, h_eq(1000)=901.4 (−9.9 %); con h_ext=1e9 el flujo iguala al de Dirichlet a < 0.1 %
- termica-cfd-sat-04 · SAT §4 · Balance de flujos: Σ flujos de frontera + Σ fuentes = 0 en estacionario (rutina de balance) · solveSteadyMoldField + suma de flujos de frontera · |Σ_caras q·A + Σ q'''V| / max(|q·A|) < 1e-8 tras convergencia CG con residual relativo < 1e-8
- termica-cfd-apdl-03 · APDL §3.4.3.2 · ITS = Δ²/4α: control negativo de oscilación por paso demasiado chico · FDM implícito/espectral con Δt < ITS sobre reja 7 mm P20 · con Δt = ITS/20 aparecen T fuera de rango [T_min,T_max] iniciales (oscilación); con Δt ≥ ITS no; ITS(7 mm, P20) = 1.497 s
- termica-cfd-cht-03 · CHT §2.1.2 · Entalpía vs temperatura con ρc(T) variable: deriva del balance · integrar h=∫ρc dT en vez de T con c(T) del acero de APDL Tabla 2.13 · con ρc(T) variable, integrar T deriva ∝ rango de T; integrar h cierra el ledger < 1e-8 (control A/B)
```

### `termica-cfd-circuito-agua` — El circuito de agua con número: factor de forma, h de línea, resistencias y t_c

- **Capítulos:** [1, 2, 4] · **Esfuerzo:** M · **Valor:** 4/5 · **Sprint:** 2
- **Objetivo:** Que el rediseño de líneas de enfriamiento (4 por lado, baffles) se juzgue contra q' = k·(S/L)·ΔT y contra Dittus-Boelter/ley de pared, no contra 'se ve azul'; cerrar A-185/A-207 del índice Kazmer con oráculo.
- **Ya existe:** coolingDesign() cooling-design.ts:195 (Re, ΔP, hLineMax, Tabla 9.3); hCoolant thermal-resistance.ts:32; rCyl/rConv/rSeries thermal-resistance.ts:25-37; verif-termico-cortado (interfaz armónica)
- **Dependencias:** termica-cfd-ledger-geometria

```
## EJERCICIOS
- termica-cfd-pliego-08 · R8 · Factor de forma: fila de cilindros bajo plano isotermo (el circuito de agua) · circuito de agua del molde (cooling-design + FDM 3D) · S/L = 2π/ln[(2W/πD)·sinh(2πH/W)]; q' = k·(S/L)·ΔT; D=6.35, P20, ΔT=40: W25/H25 → 1 236 W/m; W50.8/H25 → 1 998 W/m; W75/H35 → 1 891 W/m; tolerancia 8 %
- termica-cfd-sat-03 · SAT §5.4 · Función de pared: u+=y+ (y+<1/κ) y u+=(1/κ)ln y+ + 5.2; h de línea de agua vs Dittus-Boelter · hCoolant(Re) + ley de pared para agua en línea Ø6.35 mm · Nu=0.023·Re^0.8·Pr^0.4 vs h de la ley de pared (Arpaci-Larsen 3 capas) dentro de 20 % para Re∈[1e4,1e5]; laminar Re<2300 marcado
- termica-cfd-apdl-07 · VM97/VM161 · Aleta recta y tubo aislado (radio crítico) — resistencias en serie · thermal-resistance.ts rCyl/rConv/rSeries · aleta: T(x)=T∞+(Tb−T∞)·cosh(m(L−x))/cosh(mL), m=√(hP/kA); tubo: q'=ΔT/(ln(r2/r1)/2πk + 1/(2πr2h)), r_crit = k/h; < 1 %
- termica-cfd-pliego-05 · R5 · Placa finita, tiempo de enfriamiento Eq 9.5 (VM110/VM116) · tcPlateS + serie completa Fourier + FDM · t_c = (h²/π²α)·ln((4/π)(Tm−Tc)/(Te−Tc)); ABS 2 mm: 11.3 s; ejemplos Kazmer 8.4/18.9 s < 5 %; ley t_c ∝ h² = 4.000×
- termica-cfd-pliego-06 · R6 · Cilindro/esfera: lumped vs serie de Bessel (VM109/VM111/VM112/VM108) · pin/núcleo cilíndrico enfriado por convección h · Bi<0.1: (T−T∞)/(T0−T∞)=exp(−hAt/ρcV) < 1 %; Bi>0.1: serie J0 con raíces λJ1(λ)=Bi·J0(λ) < 2 %
- termica-cfd-sat-02 · SAT §4.3 · Media armónica vs aritmética de k en la cara ABS/P20 (razón 168:1) · barra bicapa ABS 2 mm + P20 50 mm, Dirichlet-Dirichlet · q con armónica = q analítico de resistencias en serie (< 1e-10); con aritmética error ×43 (control negativo); continuidad de flujo en la cara
```

### `termica-cfd-no-lineal-fase` — Térmico no lineal: k(T), entalpía con cambio de fase, θ-método y pared-pared

- **Capítulos:** [2, 3, 5] · **Esfuerzo:** L · **Valor:** 3/5 · **Sprint:** 3
- **Objetivo:** Extender el solver a propiedades tabuladas y entalpía H(T) (colada APDL §3.10, Stefan VM104), integrador θ seleccionable con orden medido y resistencia de interfaz plástico↔acero (AST §2.5) — cada uno con su analítica o su tabla del manual.
- **Ya existe:** campo.ts operador exacto en dt (compara explícito vs espectral); colada.ts (menciona entalpía, sin H(T)); TM_* constantes en thermal-layers.ts:22-24
- **Dependencias:** termica-cfd-ledger-geometria

```
## EJERCICIOS
- termica-cfd-apdl-01 · APDL §2.7 · Junta tubo-tanque, estacionario con k(T) y h(T) (1/4 de simetría) · modelar 2 cilindros + boolean, malla mapeada, propiedades tabuladas, 50 substeps · cierre de balance: Σ q_conv tanque + Σ q_conv tubo = 0 (±0.5 %); 100 °F ≤ T ≤ 450 °F en todo el dominio; k(T) por interpolación de la Tabla 2.13 (8.35…10.23 Btu/hr-ft-°F)
- termica-cfd-apdl-02 · APDL §3.10 · Solidificación de colada de acero en molde de arena en L (3 h) · transitorio no lineal con ENTALPÍA H(T), AUTOTS, media simetría, convección al ambiente · energía liberada por el acero = ∫ρ·ΔH = H(2875)−H(T_final) por volumen (174.2 Btu/in³ tabla); tiempo de solidificación = instante en que max T_acero < 2643 °F; balance ledger < 1 %
- termica-cfd-apdl-08 · VM104 · Cambio de fase líquido-sólido (problema de Stefan/Neumann) · entalpía H(T) con calor latente, malla lumped, AUTOTS · frente de solidificación X(t)=2λ√(αt) con λ de la ecuación trascendente de Neumann; error < 3 % en X(t)
- termica-cfd-aster-01 · AST §5.1 · θ-método: orden 2 con θ=1/2, orden 1 con θ≠1/2, estabilidad incondicional θ≥1/2 · integrador temporal con θ seleccionable (0, 0.5, 0.57, 1) · pendiente log(err) vs log(Δt) = 2.0±0.1 con θ=0.5 y 1.0±0.1 con θ=1; θ=0 diverge si Δt > 2/λ_max = Δx²/6α (3D); θ=0.57 default Aster estable
- termica-cfd-aster-02 · AST §2.5 · Echange paroi: resistencia de interfaz plástico↔acero (aire/desmoldante) · dos sólidos acoplados por h_interfaz (pared-pared), no Robin de un lado · salto T2−T1 = q/h_int en la interfaz; con h_int→∞ recupera R4 (69.73 °C); con h_int = 2000 W/m²K el T de superficie de acero cae y el t_c sube ≥ Kazmer (declarado)
```

### `termica-cfd-cht-fluido` — Conjugado con fluido resuelto: oneFluidOneSolid, AMI, advección, radiación y Boussinesq

- **Capítulos:** [2, 5] · **Esfuerzo:** XL · **Valor:** 3/5 · **Sprint:** 4
- **Objetivo:** Primer CHT real de La Forja (sólido + fluido a 1 m/s) con continuidad de flujo en la interfaz, lazos 1:2, interpolación conservativa entre rejas de distinta resolución, y los extras del manual ANSYS (SUPG Pe=1e6, radiación entre cilindros) — todo contra benchmark.
- **Ya existe:** viento.ts (choque oblicuo, paneles) — no NS; campo.ts Campo3/CampoVec3 grad/div/lap verificados
- **Dependencias:** termica-cfd-no-lineal-fase, termica-cfd-circuito-agua

```
## EJERCICIOS
- termica-cfd-cht-01 · CHT §1.3/§6 · oneFluidOneSolid2D: sólido a 350 K abajo, aire 300 K a 1 m/s arriba, tapa periódica · CHT particionado: fluido con h o resuelto + sólido conducción; monitor T_min sólido vs tiempo · continuidad en la interfaz: k_s·∂T/∂n|_s = k_f·∂T/∂n|_f (< 1 %); 300 K < T_interfaz < 350 K; lazo 1 fluido : 2 sólido converge más rápido que 1:5 y que 1:1 (monitor)
- termica-cfd-cht-02 · CHT §2.2 · Interfaz no conforme (nearestPatchFaceAMI): interpolación conservativa entre mallas · reja plástico fina (0.17 mm) vs acero gruesa (7 mm) con remapeo · flujo total a través de la interfaz idéntico en ambos lados < 0.5 %; sin discontinuidad de T; ratio de resolución 'lo más similar posible' (APDL Fig 5.1)
- termica-cfd-apdl-04 · APDL §4.2 · Advección a Pe=1e6, flujo oblicuo 30° en cuadrado unitario (SUPG + DC) · advección-difusión con upwind/SUPG sobre reja 10×10 · overshoot T_max−1 < 0.1 (más de un orden bajo la entrada) con upwind; sin estabilización el Galerkin oscila (control)
- termica-cfd-apdl-05 · APDL §5.7 · Radiación entre dos anillos (ε=0.9 a 1500 °F, ε=0.7 a 100 °F, espacio 70 °F) · radiación gris entre superficies concéntricas (radiosidad) · q por unidad de longitud = σ(T1⁴−T2⁴)/(1/ε1·A1 + (1/ε2−1)/A2) con r1=0.5, r2=0.75 in (VM125); error < 3 %
- termica-cfd-apdl-06 · APDL §5.10 · Cilindros concéntricos 12/13 mm, 1000 °C ↔ ambiente 500 °C, con solución analítica · radiación ε=1 + factores de vista actualizados con desplazamiento radial · q_interior→exterior = σ·(T1⁴−T2⁴)·2πr1 por unidad de longitud (ε=1); T_cilindro exterior del balance radiación-radiación con 500 °C; comparar contra 'analytical solution' del ejemplo II citado
- termica-cfd-cht-04 · CHT §4.1 · Boussinesq: convección natural sólo para ΔT pequeña (límite declarado) · cavidad cerrada calentada, Ra 1e4-1e6 · Nu de cavidad cuadrada vs de Vahl Davis (Ra=1e4: 2.243; 1e5: 4.519; 1e6: 8.800) < 5 %; fuera de β·ΔT ≪ 1 se marca inválido
```


## Brechas vs Fusion / SolidWorks / Ansys / Moldflow

| brecha | competencia | el libro | prioridad |
|---|---|---|---|
| Catálogo de verificación (VM) como contrato del solver | Ansys publica ~300 casos VM (VM28/92/94/104/109/110/116/125/161 térmicos) y cada release los corre; Fusion/SolidWorks Simulation publican validaciones NAFEMS | APDL §2.10/§3.11 remiten a la Verification Manual; el pliego lista R1-R9 con valores | P0 |
| Balance de energía como salida del solver | code_saturne y OpenFOAM imprimen budgets/continuity errors por paso; Moldflow Cool reporta el balance por circuito | SAT §4.1 budget explícito por celda; pliego §3.1 ledger a redondeo (La Forja: check infalsificable −99.5 %) | P0 |
| Análisis del circuito de refrigeración con número | Moldflow Cool / SolidWorks Plastics dan q por circuito, ΔT del refrigerante, Re, eficiencia por línea | pliego R8 factor de forma + SAT h_eq + Dittus-Boelter; Kazmer Eq 9.11/9.12 | P0 |
| Malla graduada y control de paso de tiempo automático (AUTOTS/ITS) | Ansys AUTOTS, Fusion adaptativo; capas de inflación en la interfaz | APDL §3.4.3.2 ITS=Δ²/4α y 'más subpasos = peor'; APDL Fig 5.1 resolución similar | P1 |
| Propiedades dependientes de T y cambio de fase (entalpía) | Ansys/Abaqus/Fusion aceptan tablas k(T), c(T), H(T) con latente | APDL §2.7 Tabla 2.13, §3.8 H=∫ρc dT, §3.10 colada | P1 |
| Resistencia de contacto entre cuerpos (TCC) | Ansys contact TCC, SolidWorks 'thermal resistance' entre partes, Fusion contact | AST §2.5 échange paroi; pliego §5 (aire/desmoldante) | P1 |
| Radiación superficie-superficie | Ansys radiosidad/factores de vista, Fusion y SolidWorks radiación ambiente | APDL cap 5 (VM125, §5.10 analítico) | P2 |
| CHT con fluido resuelto (Flow Simulation / Fluent / chtMultiRegion) | SolidWorks Flow Simulation y Ansys Fluent resuelven agua+acero; OpenFOAM chtMultiRegion | CHT §1.3 oneFluidOneSolid, §6.2 lazos 1:2, SAT §5.4 ley de pared | P2 |
| Advección/transporte de masa estabilizado | Ansys SUPG+DC, todo CFD comercial | APDL cap 4 Pe=1e6 30° | P2 |

## Notas de honestidad
- `respuesta_impresa` vacía = el manual NO imprime el número; el oráculo es una analítica cerrada o un invariante del ledger.
- Los manuales P0_09/P0_03/P1_24 son guías de teoría/tutorial: casi no imprimen resultados numéricos; los valores con número vienen del digesto (pliego §3.4, apéndice) y de las tablas de APDL §2.7/§3.10.
- Verificado por grep: sin `ledger`, `auditGeom`, `sinh(`, `radiac|Boltzmann`, `upwind|SUPG` en src/forja; `viento.ts` es cuña supersónica inviscida, no CHT.
