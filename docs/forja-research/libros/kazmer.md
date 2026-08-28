# Kazmer — *Injection Mold Design Engineering* (Hanser) — el libro como CLIENTE de La Forja

> Síntesis de 3 tramos (caps 1-6, 7-11, 12-13+apéndices). Digestos cruzados: `docs/forja-research/kazmer-pliego/` (INDICE-ANALISIS 292 análisis: 132 SÍ / 97 PARCIAL / 62 FALTA), `cruce.md`, `pliego-UI-v2.md`, `MOLDES-INDICE.md`, `PROCESOS-REPETITIVOS-Y-AUTOMATIZACION.md`. Estado del repo verificado por grep el 2026-08-27.

## 0. El autor como cliente

Kazmer no pide un CAD de moldes: pide que el DISEÑO sea una cadena de análisis con números que rindan cuentas. Con cuatro datos (tamaño, pared, material, cantidad) cotizar ANTES de detallar (Fig 1.9, cap 3) y luego, subsistema por subsistema y con retornos, que cada decisión salga de una ecuación con datos del Apéndice A/B: la partición del área proyectada y la expulsabilidad (cap 4), el llenado desdoblado a mano contra la simulación (cap 5), la colada despejada por presupuesto de presión y redondeada steel-safe (cap 6), la compuerta que no corta ni congela antes de empacar (cap 7), el venteo entre h_min y h_max donde el frente termina (cap 8), el agua con ventanas de ⌀/profundidad/paso ruteada sin cruzar nada (cap 9), la contracción que SALE del PvT con banda y responsabilidad (cap 10), la expulsión desde la sección del CAD por el peor de tres criterios (cap 11), el acero que no cede, no fatiga y no abre más que el venteo (cap 12), y un acta firmada con costo/beneficio/riesgo (§13.10). Sus piezas de prueba son cuatro: bezel de laptop, cup, lid y el contenedor 100×160×60 — todo ejemplo del libro se resuelve sobre ellas y esa es la vara de La Forja.

**Lo que YA está hecho y se respeta (no se duplica):** mol-s1-llenado-por-pieza (E4/E5 por pieza, predicadoDeMalla) · mol-s2-intake (§2.1.5) · mol-s3-base-catalogo (retículo HASCO/DME) · molde-l1 (lección 1 v1·6) · EL CICLO DEL DADO E1..E12 para el cubo (gate 236/236) · v1·1..v1·6 primera pieza (E3/draft/cotización/lección por pieza)

## 1. Capítulos y cobertura

| cap | título | ejercicios | Forja | nota |
|---|---|---:|---|---|
| 1 | Introduction | 1 | si | Corte A-A y roles ya en mold-assembly/lamina-seccion; Tabla 1.1 solo como texto |
| 2 | Plastic Part Design | 7 | parcial | DFM literal en dfm.ts; intake HECHO (mol-s2); undercuts por etiqueta; FEA de costillas y tolerancias FALTAN |
| 3 | Mold Cost Estimation | 8 | si | moldcost-detailed.ts reproduce $74,800 y $0.47; falta acabado por zonas y las 4 piezas de Tabla 3.3 |
| 4 | Mold Layout Design | 9 | parcial | base/insertos/máquina SÍ (mol-s3); partición NO plana (loft ≥5°) y factores de acero Eq 4.2-4.3 FALTAN |
| 5 | Cavity Filling Analysis | 9 | parcial | lay-flat, 83.2 MPa, race-tracking y flow leaders SÍ (mol-s1); P(h)→1.36 mm, A_proj del kernel y Tabla 5.1 FALTAN |
| 6 | Feed System Design | 14 | parcial | feed.ts/feed-layouts/colada/threeplate SÍ; balanceo familia, residencia, Dh trapezoidal y anillo FALTAN |
| 7 | Gating Design | 9 | parcial | gating.ts reproduce 111k/132k/1.9/1.5/1.1; sin sólido 3D de compuertas ni cadena η(t) |
| 8 | Venting | 7 | parcial | h_min/h_max y ubicación (jabonera) SÍ; anatomía CAD del venteo FALTA |
| 9 | Cooling System Design | 12 | parcial | 7 pasos SÍ; ruteo/circuito por pieza solo para el CUBO (E8b); conformal y Cu asimétrico FALTAN |
| 10 | Shrinkage and Warpage | 10 | parcial | Tait/contracción/alabeo SÍ (E9); anisotrópica, POM y mapa con empaque FALTAN |
| 11 | Ejection System Design | 16 | parcial | motor de expulsión y side actions SÍ; A_eff medida, sleeve/stripper y llave/interlock FALTAN |
| 12 | Structural System Design | 18 | parcial | placas/cores/interlocks/tornillos SÍ (E11); pilares Eq 12.12-13, área efectiva, Tabla 12.2 e inserción FALTAN |
| 13 | Mold Technologies | 18 | no | solo §13.9 (unscrewing/moldtech.ts) y el acta E12; el resto es descriptivo y FALTA |
| 14 | Apéndices A-F | 3 | parcial | Apéndice B literal en moldbase.ts; Apéndice A solo ABS/PP de 16 |

## 2. Catálogo completo de ejercicios (141)

IDs canónicos `kazmer-c<cap>-<nn>`; los apéndices van como cap 14. `respuesta impresa` SOLO si el libro la imprime (página citada); vacía si no.

| id | cap | § / pág | título | herramientas | oráculo | respuesta impresa | ya_existe · dónde | esf | val |
|---|---|---|---|---|---|---|---|---|---|
| kazmer-c1-01 | 1 | §1.3.3 Fig 1.6 p.7-9 | Corte A-A del molde de dos placas con componentes rotulados | ensamble plano2D molde-E3 lamina-seccion | El ensamble contiene los 12 componentes por rol (mold-assembly) y el corte HLR los intersecta; 0 interferencias (collision.ts) | — | **si** · src/forja/mold/lamina-seccion.ts:MoldSectionReveal · mold-assembly.ts · mold-drawing-set.ts | S | 3 |
| kazmer-c2-01 | 2 | §2.3.2 Fig 2.3 p.29 | Costilla eficiente 70 % / 4x / 10x con 2° de draft | croquis extruir patrón FEA-estático molde-E1 cotas | checkDFM sin errores §2.3.2; V(1.3t)/V(costillas)=1.15±0.03 (kernel); tc(1.3t)/tc(t)=1.69±0.05 Eq 9.5; FEA deflexión ±15 % | rigidez equivalente a la pieza 30 % más gruesa; +15 % material, +70 % ciclo (§2.3.2 p.29) | **parcial** · src/forja/mold/dfm.ts (§2.3.2); FEA von Mises occt.ts sin banco de costillas | M | 4 |
| kazmer-c2-02 | 2 | §2.3.3 Fig 2.4 p.29-30 | Tres diseños de boss con gussets (120° / 90° / libre) | croquis extruir patrón molde-E1 | checkDFM 0 errores §2.3.3 con boss ≤70 %; control negativo boss 100 % → 1 error | — | **parcial** · src/forja/mold/dfm.ts:DFMBoss (solo espesor; no gussets) | S | 3 |
| kazmer-c2-03 | 2 | §2.3.4 Fig 2.5-2.6 p.30-31 | Filetes 150 %/50 % y chaflán ½ antes del shell | fillet chamfer shell molde-E1 sonda | Espesor en la esquina = t ±5 % (sonda); checkDFM §2.3.4 ok; esquina viva → error | — | **si** · src/forja/mold/dfm.ts §2.3.4; occt.ts fillet/chamfer/shell | S | 3 |
| kazmer-c2-04 | 2 | §2.3.6 Tabla 2.14 p.33-34 | Draft requerido por acabado y resina | draft molde-E1 cotas | draftForFinish reproduce las 5 filas; la sonda mide el ángulo en la cara = valor ±0.05° | 0.5° / 1.5° / 2° / 4° / 7.5° (Tabla 2.14 p.34) | **si** · src/forja/mold/dfm.ts:DRAFT_TABLE_214,draftForFinish; E1 sonda de draft | S | 4 |
| kazmer-c2-05 | 2 | §2.3.7 Fig 2.7 p.34-35 | Detectar las cuatro familias de undercut | croquis extruir molde-E1 molde-E10 sideactions | Detector reporta exactamente 4 features atrapadas en Z (control sin features → 0); cada una con mecanismo de mechanism-catalog | — | **parcial** · src/forja/mold/dfm.ts:DFMUndercut (por etiqueta); E1 'caras atrapadas'; sideactions.ts, mechanism-catalog.ts | M | 4 |
| kazmer-c2-06 | 2 | §2.2.3 Tabla 2.6 p.23-24 | Tolerancia general ±0.4 % y crítica ±0.1 % en el plano | plano2D cotas GD&T molde-E9 | Cota impresa = nominal×% exacto; >3 críticas o crítica < contracción alcanzable → alarma | 100 ± 0.4 mm; 10 ± 0.01 mm (§2.2.3 p.23) | **desconocido** · INDICE A-004 FALTA; drawing.ts no verificado | S | 2 |
| kazmer-c2-07 | 2 | §2.1.5 + Tablas 2.1-2.11 p.19-27 | Intake mínimo: tamaño, pared, material, cantidad | molde-E1 planeación | Con pared declarada la cotización del STEP macizo cae a la del v1-gate; sin pared/material el intake bloquea E4 | — | **si** · public/escuela/lecciones/mol-s2-intake.json; estudio-molde-datos.ts:estacion1 (HECHO en mol-s2) | S | 3 |
| kazmer-c3-01 | 3 | §3.2.2 Eq 3.1 Tabla 3.1 p.40-42 | Break-even colada fría 2 cav vs hot runner 32 cav | molde-E2 planeación | breakEven=615,385±500; cold@50k 0.75; hot@5M 0.21; chooseMold frío a 100k, caliente a 1M | n_breakeven = 615,000 piezas; $0.75/pza a 50k; $0.21/pza a 5M (p.40-41) | **si** · src/forja/mold/cost.ts:breakEven · scripts/mold-cost-test.cjs | S | 4 |
| kazmer-c3-02 | 3 | §3.3.1.2 Eq 3.5-3.7 p.45-46 | Dimensiones y costo de material de los insertos del bezel | molde-E2 molde-E3 | cavityInsertDims=(0.268,0.176,0.057); materialUSD=435±3 (errata 0.264 en el volumen) | Lcav 0.268, Wcav 0.176, Hcav 0.057 m; V=2.65e-3 m3; $435 (p.46) | **si** · src/forja/mold/moldcost-detailed.ts:cavityInsertDims,estimateMoldCost | S | 4 |
| kazmer-c3-03 | 3 | §3.3.1.3 Eq 3.8-3.12 p.46-50 | Tiempo y costo de maquinado de los insertos del bezel | molde-E2 masa-inercia | complexity 2.49±0.02; tMachiningH 258±2; $25,800±200; A y V del kernel de la pieza real | t_vol 3.78 h; t_area 2.69 h; f_complexity 2.5; 258 h; $25,800 (p.50) | **si** · src/forja/mold/moldcost-detailed.ts (MACHINING_FACTOR, Eq 3.12) | S | 4 |
| kazmer-c3-04 | 3 | §3.3.1.5 Eq 3.13-3.14 Tabla 3.6 p.51-52 | Costo de acabado por zonas (B-3 + A-1 frontal) | molde-E2 selección-de-caras | ΣA_i/R_i = 34.3±0.3 h con áreas por cara del kernel; $1,700±20 | t_finishing 34 h; $1,700 (p.52) | **parcial** · src/forja/mold/moldcost-detailed.ts:FINISH_RATE (un solo acabado; A-031 FALTA) | M | 3 |
| kazmer-c3-05 | 3 | §3.3.2 Eq 3.14-3.17 p.53-55 | Masa y costo del mold base del bezel | molde-E2 molde-E3 | M=538±5 kg; base $3,700±30 | Lmold 0.351, Wmold 0.234, Hmold 0.30 m; 538 kg; $3,700 (p.55) | **si** · src/forja/mold/moldcost-detailed.ts:MOLD_STEEL_COEF; plate-cost.ts | S | 4 |
| kazmer-c3-06 | 3 | §3.3.3 Eq 3.18 Tablas 3.7-3.11 p.55-59 | Customización por subsistema y costo total del molde | molde-E2 molde-E12 | customization 43,200±100; total 74,800±200; cada coeficiente ligado a una decisión del acta E12 | C_customization $43,200; C_total ≈ $74,800 (p.59) | **si** · src/forja/mold/moldcost-detailed.ts:CUSTOM_FACTORS,estimateMoldCost | S | 4 |
| kazmer-c3-07 | 3 | §3.4 Eq 3.19-3.25 p.60-66 | Costo por pieza del bezel: molde, material, proceso, yield | molde-E2 molde-E12 | cycleTimeEstimate 13.5; moldingMachineRate(294,1.2)=50.1±0.2; partUSD∈[0.47,0.48]; veredicto SOBREDISEÑO si molde/pza > 3× material | $0.22 molde; $0.063 material; 13.5 s; 294 mTon; $50.1/h; $0.19 proceso; C_part $0.48/$0.47 (p.60/66) | **si** · src/forja/mold/moldcost-detailed.ts:estimatePartCost,moldingMachineRate,cycleTimeEstimate | S | 4 |
| kazmer-c3-08 | 3 | §3.3.1.3 Eq 3.12 Tabla 3.3 p.49 | Factor de complejidad de cuatro piezas medido en el kernel | masa-inercia molde-E2 croquis extruir | placa maciza f=1.00-1.05; bezel 2.5±0.1; monotonía f1<f2<f3<f4 | 1.02 / 1.9 / 2.5 / 3.1 (Tabla 3.3 p.49); bezel 2.5 (p.50) | **parcial** · Eq 3.12 en moldcost-detailed.ts; las 4 piezas de Tabla 3.3 no están en el banco | M | 3 |
| kazmer-c4-01 | 4 | §4.1.1 Fig 4.2-4.5 p.67-70 | Dirección de apertura: cup axial vs radial (split) y bezel | molde-E3 visibilidad masa-inercia | Eje = normal del máx área proyectada Y 0 caras atrapadas; eje radial del cup → ≥1 atrapada → 'split cavity' f 0.5/1.0 | — | **parcial** · INDICE A-060 PARCIAL; src/forja/mold/visibilidad.ts; E1 caras atrapadas | M | 4 |
| kazmer-c4-02 | 4 | §4.1.2 Fig 4.6-4.7 p.70-71 | Línea de partición del cup en la base del rim, no en el labio | molde-E3 parting visibilidad | partingLoops devuelve el lazo en la base del rim; test v1·3 'la BOCA cae EN la partición'; candidato del labio marcado 'visible' | — | **parcial** · src/forja/mold/parting.ts:partingLoops; scripts/ciclo-dado-test.cjs v1·3 | S | 4 |
| kazmer-c4-03 | 4 | §4.1.3 Fig 4.9-4.10 p.71-73 | Superficie de partición no plana del bezel por loft ≥5° y knit | loft superficies knit molde-E3 parting | Superficie cerrada y manifold; ángulo mín ≥5° (lamina-particion-angulo); V_cav+V_core+V_pieza = V_bloque ±0.1 % | — | **parcial** · src/forja/mold/parting.ts:splitNoPlano; lamina-particion-angulo.ts; PROCESOS-REPETITIVOS §4 = automatización #1 | L | 5 |
| kazmer-c4-04 | 4 | §4.1.4 Fig 4.11-4.12 p.73 | Shut-off de la ventana del display del bezel | molde-E3 parting superficies | n_shutoffs == n_ventanas pasantes (bezel 1, cup 0); parting.ts reporta 'ventana tapada' | — | **si** · src/forja/mold/parting.ts (shut-off), mold.ts:ShutOffBox | S | 4 |
| kazmer-c4-05 | 4 | §4.2 Fig 4.13-4.16 p.74-77 | Dimensionar insertos: 3⌀ de agua, cheek = profundidad, redondeo a placa | molde-E3 revolve extruir moldbase | sizeInserts: cup driver 'estructural', bezel 'refrigeración'; alturas múltiplo de 10; V medido = L×W×H ±0.1 % | — | **si** · src/forja/mold/moldbase.ts:coolingLineDia,sizeInserts | S | 4 |
| kazmer-c4-06 | 4 | §4.3.1 Fig 4.17-4.20 p.77-79 | Layouts de cavidades: línea, grid, círculo, híbrido de 6 | patrón molde-E3 feed-layouts | aspecto(línea 8)>2 rechazado; grid 8 ≤2; área(círculo)>área(grid); 0 colisiones inserto-inserto/guide pins | — | **parcial** · src/forja/mold/feed-layouts.ts (feed); layout de cavidades por aspecto A-069 PARCIAL | M | 3 |
| kazmer-c4-07 | 4 | §4.3.2 Fig 4.21-4.22 p.79-81 | Seleccionar base estándar: área usable, A, B, S, E y stack | molde-E3 moldbase ensamble | Test 'Fig 4.21 el inserto cabe'; selectMoldBase = menor retículo HASCO/DME (cubo 196×196; pieza chica 156×156) | — | **si** · src/forja/mold/moldbase.ts:selectMoldBase,STANDARD_BASES; platesizing.ts:snapToCommercialPlate; lección mol-s3 (HECHO) | S | 4 |
| kazmer-c4-08 | 4 | §4.3.3 Fig 4.23-4.24 p.81-82 | Compatibilidad con la Battenfeld HM320 | molde-E3 molde-E4 machinesizing | checkMachine: 900 mm → no pasa; stack 300 → no cierra; stack+carrera>800 → no abre; shot 25-50 %; clamp ≤326 t | 3200 kN = 326 metric tons = 360 English tons (p.82) | **si** · src/forja/mold/moldbase.ts:MACHINES,checkMachine; machinesizing.ts | S | 4 |
| kazmer-c4-09 | 4 | §4.4 Eq 4.1-4.3 Tabla 4.1 p.84-89 | Selección del acero: difusividad, fatiga, Brinell y factores de costo | molde-E3 materials | f_making(P20)=f_operating(P20)=1; Al<1 ambos; SS420 operating≈1.8; H13 making > D2 > P20; Tabla 4.1 ABS 1M → {Cu,P20,SS420}; vidrio 1M → {H13} | — | **parcial** · src/forja/mold/moldbase.ts:MOLD_METALS,selectMetal (reglas); Eq 4.2-4.3 no calculados (A-078 FALTA) | M | 3 |
| kazmer-c5-01 | 5 | §5.3.1-5.3.2 Eq 5.2, 5.7 p.94-96 | Corte, esfuerzo, fuerza y gradiente de presión en canal plano | molde-E4 | shearRate 66.7±0.5; τ 6,667±50; F 133-135; 2τ/H 17.33; ΔP 3.47±0.05 | γ̇ 67 1/s; τ 6,700 Pa; F 135 N; dP/dL 17.3 MPa/m; ΔP 3.5 MPa (p.94-96) | **parcial** · src/forja/mold/filling.ts:shearRateNewtonian,pressureDropSegment (sin test) | S | 2 |
| kazmer-c5-02 | 5 | §5.3.3-5.3.5 Eq 5.8-5.22 p.96-101 | Curva Cross-WLF vs Newtoniano vs power-law para PC | molde-E4 materials | viscosityCrossWLF(PC,100,280)=350±10 %; (1e4)=80±10 %; eta0(270)/eta0(290)=2.64±0.1; ∫perfil = caudal | 350 Pa·s a 100 1/s y 80 a 10,000 (280 °C); η0 250 @290, 660 @270 (p.97) | **parcial** · src/forja/mold/filling.ts:CrossWLF,ABS_CROSS,PP_CROSS (falta PC del Apéndice A) | S | 3 |
| kazmer-c5-03 | 5 | §5.5.1 Eq 5.23-5.25 Fig 5.11 p.104-106 | Velocidad de inyección recomendada del bezel con convergencia | molde-E4 | convergeVelocityTraced reproduce 0.69/0.77/0.80/0.82±0.01; η(2000,239)=120±3; Vdot 125±5 | 0.5→0.69→0.77→0.80→0.82 m/s; 0.25 s; 125 cc/s (p.105-106) | **si** · src/forja/mold/filling.ts:convergeVelocityTraced; ciclo-dado-test 'η(γ̇=2000)≈120' | S | 4 |
| kazmer-c5-04 | 5 | §5.5.2 Eq 5.22 Fig 5.12 p.107-108 | Presión de llenado del bezel por lay-flat power-law | molde-E4 layflat | fillingPressure=83.2±0.5 (test existente); variante A/B/C > tira única | ΔP = 83.2 MPa = 12,060 psi (p.108) | **si** · src/forja/mold/filling.ts:fillingPressure,ABS_MG47; layflat.ts | S | 5 |
| kazmer-c5-05 | 5 | §5.5.2 Fig 5.13 p.108-109 | Espesor mínimo de pared por la curva P(h) a 100 MPa | molde-E4 barrido | h_min(100 MPa)=1.36±0.03; P(h) monótona; P(1.5)=83.2 | espesor mínimo = 1.36 mm (p.108) | **no** · grep '1.36' src/forja/mold = 0 hits; A-095 FALTA | S | 4 |
| kazmer-c5-06 | 5 | §5.5.3 Eq 5.26-5.29 p.109-111 | Tonelaje al fin del llenado, inicio del empaque y bezel completo | molde-E4 masa-inercia machinesizing | clampForceN(50e6,0.2×0.012)=120 kN; 180 kN; A_proj del kernel = 9,724±100 mm2 → 99±1 t | 120 kN = 12.2 t; 180 kN = 18.3 t; bezel 972,000 N = 99 t (p.110-111) | **parcial** · src/forja/mold/filling.ts:clampForceN; área proyectada del kernel A-096 PARCIAL | S | 4 |
| kazmer-c5-07 | 5 | §5.5.3 Tabla 5.1 p.111-112 | Contraste análisis a mano vs Moldflow MPI 5.1 del bezel | molde-E4 FAN benchmark | solver 3D (FAN/flowlen) del bezel: P ∈ [100,121] MPa; F_fill 486-570 kN; 0<ΔT<5 °C | Tabla 5.1 (p.111) | **no** · A-107 FALTA; bezel en banco sin esta comparación | M | 4 |
| kazmer-c5-08 | 5 | §5.5.4 Fig 5.15-5.17 p.112-114 | Patrón de llenado del contenedor por arcos y phantom gates | molde-E4 layflat molde-E7 | veredictoRace=true; L_side 210 < L_center 280; máscara de soldadura en pared opuesta; gas trap fuera de partición (E7) | race-tracking porque 60 > ½·100; weld line y gas trap en la pared opuesta (p.113-114) | **si** · src/forja/mold/layflat.ts:contenedorKazmer,phantomGates,veredictoRace; flowlen.ts:computeWeldMask | S | 5 |
| kazmer-c5-09 | 5 | §5.5.5 Eq 5.30-5.35 p.114-116 | Flow leader: adelgazar paredes laterales para matar el race-tracking | molde-E4 layflat shell-variable | remedioFlowLeader=1.50±0.02; veredictoRace=false; masa −10 %±3 | H_side = 1.5 mm; v_side 75 %; +10 % presión, −10 % peso (p.115-116) | **si** · src/forja/mold/layflat.ts:remedioFlowLeader; flowleaders.ts | S | 5 |
| kazmer-c6-01 | 6 | §6.4 Eq 6.1 p.132-133 | Regla de velocidad constante D_down = D_up/√n (contraejemplo) | molde-E5 feed | 4.243 mm; velocidades iguales ±0.01; V_feed(Eq 6.1) > V_feed(Eq 6.8) a igual ΔP | D = 4.24 mm; v 1.77 m/s (p.133) | **parcial** · src/forja/mold/feed-layouts.ts:146 (Eq 6.1 radial) | S | 2 |
| kazmer-c6-02 | 6 | §6.4.3-6.4.4 Eq 6.2-6.6 Fig 6.18 p.138-141 | ΔP y volumen del hot runner del bezel segmento a segmento | molde-E5 feed | pressureDropRunner 5.9/8.8/16.7±0.2, suma 31.4±0.3; feedVolume 37.0±0.5; reynolds<1 | 5.9 + 8.8 + 16.7 = 31.4 MPa; V 37 cc; Re ~0.1 (p.138-141) | **parcial** · src/forja/mold/feed.ts:reynolds,pressureDropRunner,feedVolume (sin test 31.4/37) | S | 4 |
| kazmer-c6-03 | 6 | §6.4.5 Eq 6.7-6.9 Fig 6.19 p.141-145 | Radios mínimos por presupuesto de ΔP repartido por longitud | molde-E5 feed barrido | minRunnerRadius 5.0/4.4/4.4±0.05 y 4.0/3.5/3.5; V 35±0.5 y 21.3±0.3; R_manifold==R_nozzle | 30 MPa: R 5/4.4/4.4, V 35 cc; 50 MPa: 4/3.5/3.5, 21.3 cc (p.143-144) | **parcial** · src/forja/mold/feed.ts:minRunnerRadius,designFeedSystem; barrido Fig 6.19 A-118 FALTA | S | 5 |
| kazmer-c6-04 | 6 | §6.4.6 p.145-148 | Balanceo artificial del molde familia cup + lid | molde-E5 feed ensamble | 16.8/15.4±0.3; radios ±0.05; ΔP_total ambas ramas 46.8±0.5; regrind 3.5±0.3 % | ΔP_cup 16.8; ΔP_lid 15.4; R 1.5/1.25/2.7 mm; regrind 3.5 % (p.146-148) | **no** · A-119 FALTA; grep 'famil' en feed.ts = 0 | M | 5 |
| kazmer-c6-05 | 6 | §6.4.7 Tabla 6.2 p.148-149 | El sprue no debe alargar el ciclo: t_c cup vs t_c sprue | molde-E5 molde-E8 térmico | tira 18.9±0.3 (test E8); cilindro: el 26.7 NO reproduce (feed.ts:63 → 17.3 s); veredicto 'sprue domina' si t_sprue>t_cup | t_c cup 18.9 s; sprue 26.7 s (p.149) | **si** · src/forja/mold/feed.ts:runnerCoolingTimeS,designSprueFeed; ciclo-dado-test E8 | S | 4 |
| kazmer-c6-06 | 6 | §6.4.8 Eq 6.10-6.11 p.149-150 | Vueltas y tiempo de residencia del hot runner | molde-E5 feed | 0.77±0.01; 24±0.5 s; alarma si n_turns>10 o t_res > límite | n_turns 0.77; t_residence 24 s (p.150) | **no** · grep 'residenc|nTurns' src/forja/mold → solo comentarios; A-123 FALTA | S | 3 |
| kazmer-c6-07 | 6 | §6.5.1 Eq 6.12-6.13 Tabla 6.3 p.150-152 | Runner trapezoidal: diámetro hidráulico y ΔP | molde-E5 croquis sweep feed | Dh 7.04±0.02; ΔP 3.9±0.1; sweep del perfil reproduce Dh=4A/p ±1 % | Dh 7.04 mm; ΔP 3.9 MPa (p.152) | **no** · grep 'trapez|hydraulic' src/forja/mold = 0 (INDICE A-124 marca SÍ: desactualizado) | S | 3 |
| kazmer-c6-08 | 6 | §6.5.1 Eq 6.14-6.15 Fig 6.21 p.153 | Sección anular de la boquilla con valve pin | molde-E5 feed | 24.5±0.2 MPa Eq 6.14; Eq 6.15 power-law ≥ Newtoniana | ΔP = 24.5 MPa (p.153) | **no** · grep 'anul' src/forja/mold = 0; A-125 | S | 2 |
| kazmer-c6-09 | 6 | §6.5.4-6.5.5 p.157-158 | Redondear a cortador estándar HACIA ABAJO (steel-safe) | molde-E5 feed CAM | steelSafeDiaMm(4.6)=4.5; ΔP(4.5)>ΔP(4.6); V(4.5)<V(4.6); cortador existe en catálogo CAM | 4.5 mm o 4 mm; no 5 mm (p.157) | **si** · src/forja/mold/feed.ts:STANDARD_RUNNER_DIAMM,steelSafeDiaMm | S | 3 |
| kazmer-c6-10 | 6 | §6.3.2 Tabla 6.1 p.125-129 | Molde de tres placas: apertura en 2 fases, stripper bolts y daylight | ensamble cinemática molde-E3 molde-E10 threeplate | threePlateLayout 308/250/558; daylightNeededMm(264,75)=339; moldOpeningVelocity(100)≈210; openingSequence sin colisiones | daylight 339 vs 558 mm; apertura 0.36 vs 1.2 s (p.128-129) | **si** · src/forja/mold/threeplate.ts; moldbase.ts:checkMachine; MoldOpenDriver | M | 4 |
| kazmer-c6-11 | 6 | §6.5.2 Fig 6.22 p.154-155 | Sucker pins: diámetro, altura y conicidad | croquis revolve ensamble molde-E5 molde-E10 | suckerPinDesign(D): dia<D, depth=D/2, cono 5°; pin no invade runner; slots mismo ángulo | altura ½ del diámetro del runner y 5° (p.154) | **parcial** · src/forja/mold/threeplate.ts:suckerPinDesign; A-134 PARCIAL | S | 2 |
| kazmer-c6-12 | 6 | §6.3.1 + §6.4.2 Fig 6.13-6.17 p.123-138 | Layouts de colada con caudales (serie, ramificado, radial, híbrido) | molde-E5 feed-layouts sweep ensamble | Σ hijos = padre ±1e-9; híbrido V_feed < ramificado y ΔP igual por rama (<1 %); diámetros monótonos aguas abajo | 50/25/12.5 cc/s (p.123) | **si** · src/forja/mold/feed-layouts.ts:layoutBranched/Radial/Series/Hybrid; monotonía A-129 FALTA | S | 4 |
| kazmer-c6-13 | 6 | §6.3.1 Fig 6.4-6.5 p.123-125 | Colada sólida del molde de dos placas: sprue con contra-cono, runners y puller | revolve sweep booleanas ensamble molde-E5 colada | verificacionColada: declarado≈medido; rBase>rTop; colada∩macho=∅; V vóxeles≈analítico≈OCC | — | **si** · src/forja/mold/colada.ts:construirColada,verificacionColada; ciclo-dado-test | S | 4 |
| kazmer-c6-14 | 6 | §6.4.1 Tabla 6.2 + §1.4 Tabla 1.1 p.12-13, 121-134 | Elegir el tipo de colada y su presupuesto de ΔP y volumen | molde-E2 molde-E5 planeación | designFeedSystem maxDpMPa=min(50,0.5·P_cav); warn regrind>30 %; E2 corre 3 arquitecturas citando Tabla 6.2 | feed ≤ 50 MPa; regrind 30 % → 15 cc; hot runner 50 cc (p.121-122) | **parcial** · src/forja/mold/feed.ts:designSprueFeed; moldmachine.ts; A-108/A-109 PARCIAL | S | 3 |
| kazmer-c7-01 | 7 | §7.3.2 Tabla 7.2 p.177 | Tasa de corte en las dos edge gates del bezel | molde-E5 compuerta reología | shearRateStrip=111,000±500 y ROJO; con W 14 ≤ 50,000 | γ = 111,000 s^-1 (p.177) | **si** · src/forja/mold/gating.ts:shearRateStrip · scripts/mold-gating-test.cjs | S | 4 |
| kazmer-c7-02 | 7 | §7.3.2 p.177-178 | Tasa de corte de la pin-point del vaso y despeje del radio | molde-E5 compuerta | shearRateCyl 132,000±1,500; gateRadiusForShear 1.03±0.01 | γ = 132,000; R = 1.03 mm (p.177-178) | **si** · src/forja/mold/gating.ts:shearRateCyl,gateRadiusForShear | S | 4 |
| kazmer-c7-03 | 7 | §7.3.3 Tabla 7.3 p.178-179 | Caída de presión del fan gate del bezel (power-law) | molde-E5 compuerta reología | gateDropStripPL 1.9±0.1; VERDE (<6 MPa) | ΔP = 1.9 MPa (p.179) | **si** · src/forja/mold/gating.ts:gateDropStripPL | S | 3 |
| kazmer-c7-04 | 7 | §7.3.3 p.179 | ΔP de la pin-point con Cross-WLF a la tasa de corte | molde-E5 compuerta reología | viscosityCrossWLF(ABS,132000,T_mid)=5.4±0.5 → 1.9±0.1; a 50,000 → 11.2±1 y 1.3±0.1 | ΔP 1.9 MPa (⌀1.5) y 1.3 MPa (⌀2) (p.179) | **parcial** · gating.ts:gateDropCylNewt + filling.ts:viscosityCrossWLF (no encadenados; A-146) | S | 3 |
| kazmer-c7-05 | 7 | §7.3.4 Tabla 7.4 p.181 | Tiempo de congelamiento del fan gate del bezel | molde-E5 compuerta térmico | gateFreezeStripS=1.5±0.05; bandera 'gatea a sección delgada' | t_s = 1.5 s (p.181) | **si** · src/forja/mold/gating.ts:gateFreezeStripS (bandera PARCIAL) | S | 3 |
| kazmer-c7-06 | 7 | §7.3.4 p.181 | Congelamiento de la pin-point ⌀2 vs solidificación del vaso de 3 mm | molde-E5 compuerta térmico | gateFreezeCylS 1.1±0.05; gateFreezeStripS(3) 24±0.5; ROJO | gate 1.1 s vs vaso 24 s (p.181) | **si** · src/forja/mold/gating.ts:gateFreezeCylS,designGateProcess | S | 4 |
| kazmer-c7-07 | 7 | §7.2.7 Figs 7.11-7.13 · Tabla 7.1 p.170-176 | Modelar el tunnel gate de la tapa en el inserto y verificar sus tres ángulos | croquis revolve corte molde-E5 ensamble plano2D | sólido del túnel 45±1°, cono ≥20°, ≥3⌀ (juez geométrico); colada del lado del macho tras apertura | — | **parcial** · src/forja/mold/lamina-compuerta.ts (veredictos V7.7, mallaTronco) — sin sólido OCC | M | 4 |
| kazmer-c7-08 | 7 | §7.2.5-7.2.6 Figs 7.8-7.10 p.168-169 | Fan gate como loft círculo→rectángulo y diafragma como tira W = π·D | loft croquis molde-E5 compuerta molde-E4 | V del loft = ∫secciones ±2 %; frente E4 plano (<5 % del ancho); γ diafragma < γ_max | — | **no** · A-145/A-153 FALTA; fan.ts es Hele-Shaw | M | 3 |
| kazmer-c7-09 | 7 | §7.3.4 Fig 7.18 p.180 | Historia T/η de la compuerta → tiempo mínimo de empaque | térmico reología molde-E5 | t(η=1e5)=2.2±0.2 s con serie de Fourier del cilindro + viscosityCrossWLF | pack time = 2.2 s (p.180) | **parcial** · thermal-series.ts:cylinderCenterTheta + filling.ts:viscosityCrossWLF (no encadenados) | S | 2 |
| kazmer-c8-01 | 8 | §8.2.1-8.2.3 p.186-189 | Caudal de aire del bezel y su reparto conservador | molde-E7 venteo | el plan asigna 62.5e-6 a cada venteo | 62.5 cc/s por venteo (p.189) | **si** · src/forja/mold/venting.ts:ventDesign | S | 2 |
| kazmer-c8-02 | 8 | §8.2.2 Figs 8.1-8.5 p.186-189 | Mapa de ubicaciones de venteo del bezel: 3 tipos → 8 iniciales | molde-E4 molde-E7 venteo | enumerarVenteos sobre el bezel: 3 tipos; 4 fin de flujo 'obligatorio'; lista 'maquinar' = 8 | ~36 consideradas; 8 especificadas (p.189) | **parcial** · src/forja/mold/venting-locations.ts:enumerarVenteos (jabonera probada; bezel no) | M | 4 |
| kazmer-c8-03 | 8 | §8.2.3 Eq 8.2 p.190 | Espesor mínimo del venteo | molde-E7 venteo | ventMinThickness(100e-6,0.01,0.01,0.1e6)=0.06±0.002 | h_min = 0.06 mm (p.190) | **si** · src/forja/mold/venting.ts:ventMinThickness · ciclo-dado-test E7 | S | 4 |
| kazmer-c8-04 | 8 | §8.2.3 Eqs 8.3-8.4 p.191 | Espesor máximo del venteo por rebaba | molde-E7 venteo | ventMaxThickness(0.0002) ∈ [0.06,0.09] (redondeo declarado) | H_max 0.08 mm; banda 0.06-0.08 (p.191) | **si** · src/forja/mold/venting.ts:ventMaxThickness,VENT_TABLE_MM | S | 3 |
| kazmer-c8-05 | 8 | §8.3.1 Figs 8.6-8.7 p.192-194 | Anatomía CAD del venteo en partición (bezel) y anillo perimetral (tapa) | croquis extruir corte molde-E7 plano2D cotas | volumen removido = W·L·h ±5 %; land-canal-barreno conectados (una cavidad de aire, chequeo topológico) | — | **no** · A-169 FALTA; venting.ts solo dimensiona | M | 3 |
| kazmer-c8-06 | 8 | §8.3.2 Fig 8.8 p.194-195 | Venteo por la holgura del pin eyector y del blade | molde-E7 molde-E10 ajustes corte | ejectorHole=⌀+0.13; h_vent 0.065; ventMinThickness local ≤ 0.065 → VERDE | 0.065 mm (p.194) | **si** · src/forja/mold/fits.ts:EJECTOR_DIAM_CLEARANCE_MM (cono 3D no modelado) | S | 3 |
| kazmer-c8-07 | 8 | §8.3.3 Figs 8.9-8.10 p.196-197 | Inserto venteado en bolsa muerta y venteo sinterizado | croquis extruir corte molde-E7 molde-E10 | inserto cabe (interferencia 0); venteo conecta; juez propone blade si hay costilla | — | **no** · A-171 FALTA | M | 2 |
| kazmer-c9-01 | 9 | §9.2.1 Eqs 9.5-9.6 p.203 | Tiempo de enfriamiento del molde familia y del runner | molde-E8 térmico | coolingTimePlate(0.002)=8.4±0.05; (0.003)=18.9; coolingTimeRod(0.00476)=22.9 | lid 8.4 s; cup 18.9 s; runner 22.9 s (p.203) | **si** · src/forja/mold/cooling.ts:coolingTimePlate,coolingTimeRod · ciclo-dado-test E8 | S | 5 |
| kazmer-c9-02 | 9 | §9.2.1 Eqs 9.7-9.9 Figs 9.2-9.3 p.204-206 | Regla 2·h² y frontera convectiva 1000 W/°C | molde-E8 térmico FDM-1D | coolingTimeRuleOfThumb(3)=18; tcSlabSeriesS 19.2±0.3; FDM Robin 1000 → 24±1.5 | 18 s (regla); 19.2 s; 24 s convectivo (p.206) | **parcial** · cooling.ts:coolingTimeRuleOfThumb; thermal-series.ts; thermal-layers.ts:makeLayeredFDM (24 s sin gate, A-178) | S | 3 |
| kazmer-c9-03 | 9 | §9.2.2 Eqs 9.10-9.12 p.207 | Calor a extraer y potencia por línea (vaso/tapa) | molde-E8 térmico masa | heatPerShotJ 20,900±100; Q_line 260±5; masa del kernel ±3 % | 20,900 J; 1,050 W; 260 W/línea; 500 W/lado (p.207) | **si** · src/forja/mold/cooling-design.ts:heatPerShotJ,coolingDesign | S | 3 |
| kazmer-c9-04 | 9 | §9.2.3 Eq 9.13 Tabla 9.1 p.208-209 | Caudal de refrigerante por línea vs controlador VacTherm | molde-E8 térmico | coolantFlowRate(260,1)=6.2e-5±0.1e-5; total ≤1e-3 → VERDE | 6.2e-5 m3/s ≈ 1 GPM; total 2.5e-4 (p.208-209) | **si** · src/forja/mold/coolinglines.ts:coolantFlowRate,CONTROLLERS | S | 3 |
| kazmer-c9-05 | 9 | §9.2.4 Eqs 9.14-9.17 Tabla 9.2 p.209-211 | Ventana de ⌀ de línea: turbulencia y ΔP → plug estándar | molde-E8 térmico | maxLineDiameter 20±0.5; minLineDiameter 3.7±0.15; plug ∈ Tabla 9.2 | D_max 20; D_min 3.7; elegido 6.35 mm (p.209-211) | **si** · src/forja/mold/coolinglines.ts:maxLineDiameter,minLineDiameter,COOLING_PLUGS | S | 4 |
| kazmer-c9-06 | 9 | §9.2.5 Eqs 9.19-9.22 Fig 9.4 p.211-213 | Profundidad de la línea: concentración de esfuerzo vs calor | molde-E8 fatiga térmico | maxMeltPressureMPa(456,SCF(4))=175±1; (166,SCF(1))=50±1; hLineMaxM(32)=0.032 | 175 MPa (P20 4D); 50 MPa (Al 1D); H<32 mm (p.212-213) | **si** · src/forja/mold/cooling-design.ts:stressConcentration,maxMeltPressureMPa,hLineMaxM | S | 4 |
| kazmer-c9-07 | 9 | §9.2.6-9.2.7 Eqs 9.23-9.24 Figs 9.5-9.10 p.213-218 | Paso entre líneas y primer ruteo del vaso/tapa (infactible → factible) | molde-E8 ensamble interferencia térmico FEA-térmico | heatFluxVariation(2)<5 %; interferencia lista cruces (≥1 Fig 9.9, 0 Fig 9.10); campo 6±1.5 °C | ΔQ<5 % hasta W/H=2; gradiente 6 °C (p.214, 218-219) | **parcial** · cooling-design.ts:heatFluxVariation; thermal-steady.ts; ruteo A-198 PARCIAL; E8b useMoldStudio.ts:1237 solo CUBO | L | 5 |
| kazmer-c9-08 | 9 | §9.3.4 Figs 9.18-9.19 p.223-224 | Core de Cu 940 vs P20: gradiente del core y esquina interior | molde-E8 FEA-térmico materiales | gradiente ≤0.45× P20; esquina 5±1 vs 1±0.5 °C | ≈60 %; 5 °C vs 1 °C (p.223-224) | **parcial** · thermal-steady.ts + mold-thermal-fdm.ts; material asimétrico A-202 FALTA | M | 4 |
| kazmer-c9-09 | 9 | §9.3.1 Figs 9.12-9.15 p.219-221 | Redes de enfriamiento del bezel: serie → paralelo → manifold interno → periférico | molde-E8 ensamble corte interferencia planeación | ΔP_serie=8·ΔP; ΔT_serie=8·ΔT; conexiones 16/8/2/2 emergentes del grafo; tapones = extremos ciegos | — | **parcial** · useMoldStudio.ts:1237-1262 (E8b cubo); A-204 FALTA genérico | L | 4 |
| kazmer-c9-10 | 9 | §9.3.2-9.3.3 Figs 9.16-9.17 p.222-223 | Inserto de core con canal fresado + gasket y conformal helicoidal | sweep hélice croquis corte ensamble molde-E8 FEA-térmico | un solo camino IN→OUT; distancia canal-superficie ≥2⌀; gradiente ≤1 °C | — | **no** · grep conformal src/forja/mold = 0 | L | 3 |
| kazmer-c9-11 | 9 | §9.3.5 Tabla 9.3 p.225-230 | Selector de enfriamiento para núcleo esbelto: core 60 → baffle 12 | molde-E8 corte ensamble térmico | chooseSlenderCoreCooling(60)='baffle', barreno ∈[6,25]; campo axi con baffle reduce gradiente | baffle 12 mm en core de 60 mm (p.226) | **si** · src/forja/mold/slendercore.ts; lamina-nucleo-enfriamiento.ts · mold-nucleo-enfriamiento-test.cjs | S | 3 |
| kazmer-c9-12 | 9 | §9.3.6 Fig 9.27 p.231-232 | Flujo de calor por UN lado: two-shot ABS sobre PC | molde-E8 térmico planeación | tiempoUnSoloLado(3,ABS)=75.6±1; PC 13.5±0.5; la capa delgada va segunda | t_c ABS 75.6 s; PC 13.5 s (p.231-232) | **parcial** · lamina-nucleo-enfriamiento.ts:tiempoUnSoloLado (75.6 ✓); PC 13.5 y orden A-182 FALTA | S | 2 |
| kazmer-c10-01 | 10 | §10 Eq 10.1 p.234 | Contracción nominal y longitud de pieza desde la cavidad | molde-E9 cotas escalado | moldScale=1/(1−s); acero escalado mide 100.5±0.01 | s 0.75 %; 297.6 mm; 100.5 mm (p.234-235) | **si** · src/forja/mold/shrinkage.ts:shrinkage; useMoldStudio.ts:1285 E9 | S | 2 |
| kazmer-c10-02 | 10 | §10.1.2 Eqs 10.2-10.9 Fig 10.2 p.236-237 | PvT Tait de ABS: densidad, CVTE y compresibilidad | molde-E9 materiales gráfica | 1/specificVolume(293,0)=1047±3; CVTE ±0.2e-4; β ±0.3e-4; |ρ−1044|<1 % | ρ 1047; CVTE 3.1e-4; β −2.5e-4 (p.236-237) | **parcial** · src/forja/mold/shrinkage.ts:specificVolume,ABS_TAIT; sanidad vs proveedor A-211 FALTA | S | 3 |
| kazmer-c10-03 | 10 | §10.1.1-10.1.4 Eqs 10.10-10.13 p.235-241 | Contracción volumétrica y lineal isotrópica del bezel | molde-E9 materiales | shrinkage(ABS_TAIT,405,66) rv 0.991±0.001; s 0.31±0.03 % | T_t 386 K; rv 0.9907; s = 0.31 % (p.239-241) | **si** · src/forja/mold/shrinkage.ts:shrinkage · mold-shrinkage-test.cjs · ciclo-dado-test E9 | S | 5 |
| kazmer-c10-04 | 10 | §10.1.5 Eqs 10.14-10.16 p.243-244 | Contracción anisotrópica del bezel en ABS 15 % GF | molde-E9 materiales escalado-anisotrópico | s=0.00352→0.00351; escalado X ×1/(1−0.0018), Y/Z ×1/(1−0.0035) medido en kernel | p≈6 %; rv 0.9912; s 0.35 % cruz, 0.18 % flujo (p.243-244) | **no** · grep anisotr shrinkage.ts = 0 (A-213/A-222 FALTA) | S | 3 |
| kazmer-c10-05 | 10 | §10.1.6 p.244-245 | Banda de contracción del bezel: sobre-empaque vs empaque corto | molde-E9 materiales | shrinkageRecommendation(83) low −0.2±0.05 con alarma; high 1.9±0.1 | s −0.2 % (sobre-empaque); 1.9 % (p.244-245) | **si** · src/forja/mold/shrinkage.ts:shrinkageRecommendation · ciclo-dado-test E9 | S | 4 |
| kazmer-c10-06 | 10 | §10.2.1/10.2.3 Figs 10.8-10.9, 10.12 p.247-250 | Mapa de contracción no uniforme: 2 vs 4 compuertas y perfil de empaque | molde-E4 molde-E9 empaque CFD-Hele-Shaw mapa | s(x,y): mediana 0.6±0.15, máx >0.9 en borde lejano; 4 gates baja máx ≥0.15 y media ≥0.05 | 0.3/0.6/>1 % (2 gates); máx 0.9, media 0.5 (4 gates) — Moldflow (p.247-248) | **no** · A-218/A-220 FALTA; fan.ts llena, no empaca | L | 4 |
| kazmer-c10-07 | 10 | §10.2.2 Fig 10.10 p.249 | Steel-safe: cavidad 0.4 % y macho 0.6 % para s 0.5 % | molde-E9 escalado cotas ensamble | cavidad ×1.004, macho ×1.006 ±1e-4 en kernel; descalce registrado como spotting | cavidad 0.4 %, macho 0.6 % (Fig 10.10) | **si** · useMoldStudio.ts:1285-1325 (E9 steel-safe MEDIDO) | S | 3 |
| kazmer-c10-08 | 10 | §10.2.4 Fig 10.13 p.250-251 | Semicristalino: acetal Delrin 500 contrae 3.5 % | molde-E9 materiales | specificVolume POM 0.77/0.69±0.01; s 3.5±0.2; bandera semicristalino | rv 0.90; s 3.5 % (p.251) | **parcial** · shrinkage.ts (Tait con vT); solo ABS_TAIT; A-221 | S | 2 |
| kazmer-c10-09 | 10 | §10.3.1 Eqs 10.17-10.18 Fig 10.14 p.253-254 | Alabeo del bezel por gradiente de 2 °C a través del espesor | molde-E9 alabeo FEA-térmico | alabeoPorEspesor → R 9050±300, δ 1.6±0.1; (100/102 °C, 0 MPa) → 2.1±0.15 | R 9050 mm; δ 1.6 mm (errata sin(120/1050)); 2.1 mm a 0 MPa (p.253-254) | **si** · src/forja/mold/warpage.ts:alabeoPorEspesor (sin test con 9050/1.6) | S | 4 |
| kazmer-c10-10 | 10 | §10.3.1 Eqs 10.19-10.20 Fig 10.15 p.255 | Pandeo de la tapa center-gated por contracción diferencial | molde-E9 alabeo pandeo | alabeoPorArea → criterio TRUE y δ 6.6±0.2 | 0.0135 > 0.0011 → pandea; δ 6.6 mm (p.255) | **si** · src/forja/mold/warpage.ts:alabeoPorArea | S | 4 |
| kazmer-c11-01 | 11 | §11.2.2 Eq 11.7 Fig 11.6 p.267 | Fuerza de expulsión del vaso desde la sección del CAD | molde-E10 sección masa-inercia expulsión | ejectionForce=1800±60; A_eff medida en la sección = 526±5 % | F_eject ≈ 1,800 N (p.267) | **si** · src/forja/mold/ejection.ts:ejectionForce · mold-ejection-test.cjs (A_eff tecleada) | S | 5 |
| kazmer-c11-02 | 11 | §11.2.2 Eq 11.8 Fig 11.7 p.267-269 | Área efectiva del bezel con costillas y sanity vs máquina | molde-E10 expulsión máquina | effectiveArea 1.3e-3±2 %; 4700±150 N; F/clamp ≤0.02 | A_eff 1.3e-3 m²; F ≈ 4,700 N; 0.5 % vs 2 % (p.268-269) | **si** · src/forja/mold/ejection.ts:effectiveArea,ejectionForce | S | 4 |
| kazmer-c11-03 | 11 | §11.2.3 Eqs 11.9-11.12 p.270-271 | Área de empuje y perímetro mínimo de 20 pines | molde-E10 expulsión | ejectorPinSizing → pushArea 10.4±0.3, dShear 2.23±0.06, dComp 0.8±0.05 | A>10.4 mm² → ⌀≥0.8; Ω>0.14 m → ⌀≥2.23 (p.270-271) | **si** · src/forja/mold/ejection.ts:ejectorPinSizing | S | 4 |
| kazmer-c11-04 | 11 | §11.2.4-11.2.5 Fig 11.9 p.272-273 | 10 pines ⌀4.5 vs 40 ⌀1.125; layout Fig 11.9 rechazado | molde-E10 expulsión layout interferencia | ⌀(10)=4.46±0.05, σ 30±1; ⌀(40)=1.11, σ 100±3; juez de acero ROJO a 1 mm | 10: ⌀4.5, 30 MPa; 40: ⌀1.125, 100 MPa (p.272) | **parcial** · mold-ejection-auto.ts:maxPinDiaForSteelMm,autoEjectionPlan; A-236 PARCIAL | S | 3 |
| kazmer-c11-05 | 11 | §11.2.5 Figs 11.10-11.13 p.273-275 | Layout de expulsores junto al agarre: pad y pin contorneado | molde-E10 layout malla interferencia molde-E8 | distancia pin→agarre ≤2⌀; acero ≥1⌀; sin colisión con agua; deflexión FEA <0.1 mm | — | **parcial** · src/forja/mold/eject-layout.ts:gripEjectorLayout; A-239 PARCIAL | M | 4 |
| kazmer-c11-06 | 11 | §11.2.6 Figs 11.14-11.15 p.276-277 | Detallado del pin eyector en el ensamble de placas | ensamble corte chaflán ajustes molde-E10 plano2D cotas | interfaz pin↔core 0.13, pin↔support +0.5, cabeza↔retainer holgada 'esperado'; DOF rotacional 0 (dowel) | — | **parcial** · src/forja/mold/fits.ts; collision.ts:classifyInterface; A-252 PARCIAL | M | 3 |
| kazmer-c11-07 | 11 | §11.3.1 Eqs 11.13-11.16 p.278-279 | Pandeo del pin eyector (Euler, columna 0.7L) | molde-E10 pandeo expulsión | pinBuckling(1.86,200,235,K 0.7).sf≈1.0±0.05; K=2 default = DESVIACIÓN DECLARADA | R>0.93 → ⌀1.86 → 2 mm (p.279) | **parcial** · src/forja/mold/ejection.ts:pinBuckling (default K=2) | S | 3 |
| kazmer-c11-08 | 11 | §11.3.2 Eqs 11.17-11.19 p.280-281 | Largo máximo del ejector blade del bezel | molde-E10 pandeo expulsión | bladeMaxLengthMm(235,6,1)=93±1; checkEjectorBlade(93.8) ok=false | L<93 mm; real 93.8 (p.281) | **si** · src/forja/mold/ejectortypes.ts:bladeMaxLengthMm,checkEjectorBlade | S | 3 |
| kazmer-c11-09 | 11 | §11.3.3 Fig 11.18 p.282-283 | Ensamble de ejector sleeve sobre core pin fijo (boss) | ensamble revolve ajustes tolerancias molde-E10 cinemática | sleeve recorre la carrera sin colisión; stack-up ≤ tolerancia de pared del boss | — | **no** · chooseEjectorType='sleeve' sin geometría (A-245 FALTA) | M | 3 |
| kazmer-c11-10 | 11 | §11.3.4 Figs 11.19-11.21 p.283-285 | Molde con stripper plate para vaso y tapa | ensamble corte molde-E10 cinemática plano2D | desbalance F_eject <50 % o refuerzo; apertura sin colisión; borde de empuje ≥90° o bandera | — | **parcial** · ejectortypes.ts:chooseEjectorType('stripper'); mold-ejection-auto.ts; sin placa flotante | L | 3 |
| kazmer-c11-11 | 11 | §11.3.5 Eqs 11.20-11.23 p.285-287 | Expulsión elástica de la tapa con undercut | molde-E10 expulsión undercut | undercutStrain 0.013; undercutEjectForceN 1200±15; undercutShearMPa 1.7±0.1 | ε 1.3 %; F 1,200 N; τ 1.7 MPa (p.286-287) | **si** · src/forja/mold/ejectortypes.ts:undercutStrain,undercutEjectForceN,checkUndercut | S | 4 |
| kazmer-c11-12 | 11 | §11.3.6 Eq 11.24 p.289 | Fuerza que debe sostener el core pull del bezel | molde-E10 side-action | corePullForce(200e6,220e-6)=44,000; A_proj del sólido ≥220 mm² | 44,000 N ≈ 4 t (p.289) | **si** · src/forja/mold/sideactions.ts:corePullForce | S | 3 |
| kazmer-c11-13 | 11 | §11.3.6 Eq 11.25 Figs 11.25-11.26 p.290-291 | Cilindro hidráulico del core pull: bore y carrera estándar | molde-E10 side-action ensamble catálogo | hydraulicBore 75±0.5; pickStdBore 82.55; carrera ≥15 | D_bore 75 → 82.55×25.4 mm (p.291) | **si** · src/forja/mold/sideactions.ts:hydraulicBore,pickStdBore; risers A-249 PARCIAL | S | 3 |
| kazmer-c11-14 | 11 | §11.3.6 Figs 11.23-11.25 p.287-289 | Layout del core móvil del bezel: llave, interlock y claros | ensamble corte croquis extruir interferencia molde-E10 cinemática | barrido 15 mm sin colisión salvo contactos declarados; interlock 0 juego vertical; claro frontal >0 | — | **parcial** · src/forja/mold/mold-sideaction-gen.ts:planSideAction,sideActionVerdicts (sin llave/interlock) | L | 4 |
| kazmer-c11-15 | 11 | §11.3.7 Eq 11.26 Figs 11.27-11.28 p.291-293 | Slide con perno ángulo: largo para 12 mm a 20° | molde-E10 side-action cinemática ensamble | anglePinDesign(12,20,25) → 35±0.5, 60±1; slide recorre 12 cuando placa recorre L·cos φ | L 35 mm; total ≈60 (p.293) | **si** · src/forja/mold/sideactions.ts:anglePinDesign | S | 3 |
| kazmer-c11-16 | 11 | §11.3.8 Figs 11.29-11.30 p.294-295 | Retorno temprano: rod roscado vs resortes | molde-E10 resortes ensamble | springReturnCheck: compresión ≤0.40; >4⌀ → pin; F ≈0.25·F_eject ±20 % | — | **si** · src/forja/mold/sideactions.ts:springReturnCheck (A-251 PARCIAL) | S | 2 |
| kazmer-c12-01 | 12 | §12.1.1 p.302-303 | Esfuerzo límite: dos caminos excluyentes y el aluminio sin límite de fatiga | molde-E11 fatiga materiales | limiteMaterial('QC7',N) 545/370/170; P20 456; nunca f y peor caso juntos (control negativo) | QC7 545/370/170 MPa; P20 ≈450 (Fig 12.5: 456) (p.303) | **si** · src/forja/mold/lamina-vonmises.ts:limiteMaterial; ciclo-dado-test E11 R69 | S | 4 |
| kazmer-c12-02 | 12 | §12.1.1-12.1.2 p.300-305 | FEA del molde del bezel a 150 MPa: von Mises y apertura de 0.36 mm | FEA-estático molde-E11 ensamble | FEA tet: separación 0.36±0.06; viga Eq 12.10 ≈2.3× el FEA | 0.36 mm (0.014 in); platina 0.04 (p.304) | **parcial** · src/forja/mold/mold-fea.ts:runMoldFea (sin lado fijo); lamina-vonmises.ts:seccionBezelLibro | L | 4 |
| kazmer-c12-03 | 12 | §12.2.1 p.307 | Cambio de altura del stack del bezel con 200 t | molde-E11 cotas | plateCompression σ 17±0.3, δ 0.03±0.003; L y A del ensamble real | σ 17 MPa; ε 8.3e-5; δ 0.03 mm (p.307) | **si** · src/forja/mold/structural.ts:plateCompression | S | 3 |
| kazmer-c12-04 | 12 | §12.2.1 p.308-309 | Compresión de la placa A alrededor de la cavidad | molde-E11 ensamble kernel-área | área de cara menos barrenos medida por kernel 0.069±0.002; σ 28.5±0.5 | A 0.069 m²; σ 28.5; δ 0.002 mm (p.308-309) | **parcial** · src/forja/mold/structural.ts:plateCompression (A no descontada del ensamble; A-257) | M | 3 |
| kazmer-c12-05 | 12 | §12.2.2 p.310 | Cortante perimetral en core insert + placa de soporte | molde-E11 | shearArea/shearStress 0.090 y 21.8±0.3 | A_shear 0.090 m²; τ 21.8 MPa (p.310) | **si** · src/forja/mold/structural.ts:shearArea,shearStress | S | 2 |
| kazmer-c12-06 | 12 | §12.2.2 p.311 | Flexión de placa como viga con carga central (bezel) | molde-E11 FEA-estático | plateBending 0.056±0.003; runMoldFea 0.4-0.5× viga; flash si δ>0.02 | I 3.6e-5; δ 0.056; FEA 0.024 (p.311) | **si** · src/forja/mold/structural.ts:plateBending; mold-fea.ts; platesizing.ts | S | 4 |
| kazmer-c12-07 | 12 | §12.2.3 p.315-317 | Pilar de soporte del bezel para δ_total < 0.1 mm | molde-E11 ensamble cotas | σ 297/167±1.5; δ_comp 0.07±0.005; δ_bend 0.02±0.003; δ_max Eq 12.13; pilar sin chocar pines/KO | ⌀37.5 σ 297 δ 0.13; ⌀50 σ 167 δ 0.07; δ_bend 0.02; 88.97 mm (p.316-317) | **parcial** · platesizing.ts:sizeSupportPlate (solo claro); mold-plano-set.ts:supportPillarPositions; E11 R75 (297/167); A-260 FALTA | M | 5 |
| kazmer-c12-08 | 12 | §12.2.4 p.317-318 | Mejilla (cheek) del vaso: cortante y deflexión | molde-E11 molde-E2 cotas | τ 89±1; δ 0.04±0.004; cota cheek CUMPLE/VIOLA vs max(3⌀,0.73H,H) | τ 89 MPa; δ 0.04 mm; W>0.73H (p.318) | **si** · src/forja/mold/mold-analysis.ts; lamina-seccion.ts V4.8/V12.10 | S | 4 |
| kazmer-c12-09 | 12 | §12.2.5 p.320-321 | Cortante en el interlock ⌀19 de la cavidad del vaso | molde-E11 ensamble | interlockShear 19,050 y 67±1; interlock en partición sin comerse la mejilla | F 19,050 N; τ 67 MPa (p.321) | **si** · src/forja/mold/mold-interlocks.ts:interlockShear,planInterlocks | S | 3 |
| kazmer-c12-10 | 12 | §12.2.6 p.323 | Distancia mínima de línea de agua ⌀9.5 a la cavidad en H13 a 200 MPa | molde-E8 molde-E11 térmico | H_hole 11.1±0.1; E8 respeta H≥11.1; K(1.5⌀)=3.40 | K 3.8; H_hole 11.1 mm (p.323) | **parcial** · lamina-vonmises.ts:kBarrenoLibro (directa); cooling-design.ts:stressConcentration usa OTRA curva; sin despeje (A-265) | S | 4 |
| kazmer-c12-11 | 12 | §12.2.6 p.324-325 | Barreno de expulsor ⌀4 con 0.5 mm de QC7 a 100 MPa | molde-E10 molde-E11 FEA-estático fatiga | K 5.3±0.05; yieldOk true, fatigaOk false, vida ≈1e3; FEA 0.10±0.03 | K 5.3; σ 530; ε 0.73 %; δ 0.03; FEA 0.10 (p.324-325) | **parcial** · estudio-molde-datos.ts:estacion11Dado mkB; lamina-vonmises.ts V12.12; sin δ_hole ni vida (A-266) | M | 4 |
| kazmer-c12-12 | 12 | §12.3.1 p.326-327 | Deflexión vertical del core hueco del vaso por compresión axial | molde-E11 molde-E8 | axialStress 216±2; δ 0.06±0.005; bore del baffle de la E8 real | σ 216; ε 0.11 %; δ 0.06 mm (p.326-327) | **si** · src/forja/mold/cores.ts:axialStress,designCore | S | 3 |
| kazmer-c12-13 | 12 | §12.3.2 p.328-329 | Hoop del core del vaso y ⌀ interno máximo en QC7 (doble vara) | molde-E11 molde-E8 | hoopStress 240; maxInnerDiameter 31/38±0.5; govBy fatiga | 240 MPa; 31 mm vs 38 → 31 (p.328-329) | **si** · src/forja/mold/cores.ts:hoopStress,maxInnerDiameter; ciclo-dado-test E11 hoop | S | 4 |
| kazmer-c12-14 | 12 | §12.3.3 p.330 | Flexión del core del vaso por ΔP=40 MPa | molde-E11 molde-E5 molde-E4 | coreInertiaM4 5.1e-7±2 %; δ 0.03±0.003; interlocked → 0.003; ΔP debería salir de E4 (A-270) | I 5.1e-7; δ 0.03 mm (p.330) | **si** · src/forja/mold/cores.ts:coreInertiaM4,coreBendingMm | S | 3 |
| kazmer-c12-15 | 12 | §12.4.1 p.334 | Tolerancias FN1 para el core insert cuadrado 88.90 mm | molde-E3 cotas plano2D GD&T | interferenceFit(88.9,'FN1') ±0.001; cota con límites en el plano | inserto 88.96–88.98; barreno 88.90–88.92 (p.334) | **si** · src/forja/mold/fits.ts:apparentDia,interferenceFit | S | 4 |
| kazmer-c12-16 | 12 | §12.4.1 p.335 | Fuerza de inserción del core insert FN1 | molde-E3 cotas planeación | σ 69±1; F 808±10 kN; si F>prensa → LN1-LN3 | σ 69 MPa; F 808 kN (p.335) | **no** · grep insercion/insertionForce = 0; A-272 FALTA | S | 3 |
| kazmer-c12-17 | 12 | §12.4.2 p.336-338 | Tornillos SHCS que unen las mitades: peor caso de izaje | molde-E11 ensamble catálogo DIN | 362±2 kg; 47 kN±2 %; DIN 912 M10; masa bloque vs ensamble <2× | M 362 kg; F 47,000 N; D 8.65 → M10 (p.336-338) | **si** · src/forja/mold/fasteners.ts; mold-fasteners.ts:fastenerPlan | S | 3 |
| kazmer-c12-18 | 12 | §12.4.3 p.339-340 | Dowel ⌀12 LT3: juego esperado y peor interferencia | molde-E3 cotas plano2D | límites ±0.001; F 50±1 kN; plano con LT3 | dowel 12.002–12.013; barreno 12.000–12.018; σ 111; F 50 kN (p.339-340) | **no** · fits.ts solo Tabla 12.1; LT3/LC1 = 0 hits; A-274 FALTA | S | 3 |
| kazmer-c13-01 | 13 | §13.1 Fig 13.1 p.344 | Selector de tecnología de molde (árbol Fig 13.1) | molde-E1 planeación | tabla de verdad: cada hoja alcanzable con su combinación; banco → two-plate/hot-runner; vaso con rosca → rotating | — | **parcial** · src/forja/mold/moldtech.ts:chooseMoldTechnology (solo §13.9); A-276 | M | 4 |
| kazmer-c13-02 | 13 | §13.5 p.359 | Multi-shot: segunda capa 40 % más delgada (flujo de calor a UN lado) | térmico molde-E8 molde-E1 | FDM adiabático: t_cool(0.6h1, un lado) ≈ t_cool(h1, dos lados) ±10 % | la segunda capa 40 % más delgada (p.359) | **desconocido** · thermal-layers.ts / mold-thermal-fdm.ts (frontera adiabática no verificada); A-279 | M | 3 |
| kazmer-c13-03 | 13 | §13.6.2 p.365-367 | Stack mold de 2 niveles: mismo clamp, doble cavidades | molde-E2 molde-E6 dimensionado-máquina ensamble | machineSizing(2 niveles): clamp igual ±1 %, shot ×2, stack >; daylight check | — | **no** · machinesizing.ts sin niveles; moldbase.ts sin placa central; A-282 | L | 3 |
| kazmer-c13-04 | 13 | §13.6.1 p.364-365 | Insulated runner: piel congelada de 6 mm en ⌀25 a 60 s | térmico molde-E6 | espesor congelado a 60 s = 6±1.5 mm | ⌀≈25, 60 s, piel ≈6 mm (p.365) | **no** · grep insulated = 0; A-281 | M | 2 |
| kazmer-c13-05 | 13 | §13.7.1 p.373 | Pulsed cooling: energía y costo por ciclo de 100 kg de P20 | térmico molde-E6 costo | 10 MJ exacto; 2.78 kWh; $0.28-0.30 con masa del ensamble | 10 MJ ≈ 3 kWh; $0.30 (p.373) | **no** · grep pulsed = 0; A-284 | S | 2 |
| kazmer-c13-06 | 13 | §13.7.2 p.374-375 | Conduction heating: potencia entregada vs drenada | térmico circuito molde-E8 | R=ρL/A 450 μΩ; P=I²R 112.5; q 28 kW/m² ±3 %; 113<420 | R 450 μΩ; 113 W; 28 kW/m²; ≥420 W (p.374-375) | **no** · grep conduction = 0; A-285 | S | 2 |
| kazmer-c13-07 | 13 | §13.7.3-13.7.4 p.375-378 | Ventana de inducción y capa aislante pasiva | térmico | FDM multicapa: ΔT_sup(10 s) ≈50 °C ±30 % | ≈1000 W/cm² sube 50 °C en 10 s (p.376) | **no** · thermal-layers.ts sin fuente superficial; A-286 | M | 1 |
| kazmer-c13-08 | 13 | §13.9.2 p.383-384 | Collapsible core comercial: colapso ≈6 % del ⌀ | molde-E10 ensamble cinemática | collapsibleCoreCheck ok ⇔ 0.06⌀ ≥ 2·undercut; fuera de 13-90 → no comercial | 13-90 mm; ≈6 % (p.384) | **si** · src/forja/mold/unscrewing.ts:collapsibleCoreCheck | S | 3 |
| kazmer-c13-09 | 13 | §13.9.3 p.385-387 | Rotating core: hélice vs planetario para 64 tapas y anti-rotación | molde-E10 cinemática ensamble mecanismos | unscrewTurns/helixDrive coherentes; torque < capacidad; ≥1 feature anti-rotación | — | **parcial** · src/forja/mold/unscrewing.ts:unscrewTurns,unscrewTorque,helixDrive (sin planetario); A-289 | M | 3 |
| kazmer-c13-10 | 13 | §13.9.1 p.381-383 | Split cavity del bolo: mitades, angle pins, gibs y cheek ≈ profundidad | molde-E10 ensamble cinemática molde-E11 molde-E8 | separación de mitades ≥ undercut+holgura; cheek CUMPLE V13.4; sin interferencia gibs↔pins | — | **parcial** · moldtech.ts (selección); lamina-seccion.ts V13.4; sin geometría de cavidad partida | L | 3 |
| kazmer-c13-11 | 13 | §13.9.4 p.387-388 | Reverse ejection: cavidad al móvil, core y expulsores al fijo | molde-E10 molde-E2 ensamble | base invertida pasa E2..E11 espejo; ninguna marca en cara 'estética' (visibilidad.ts) | — | **parcial** · moldtech.ts (selección); visibilidad.ts; sin base invertida en moldbase.ts | L | 3 |
| kazmer-c13-12 | 13 | §13.2.3 p.347-349 | Gas/water assist: canales gruesos que guían el fluido | molde-E4 molde-E1 materiales | E4 con 2a fase: ≥90 % del hueco dentro del canal; SS420 si water | — | **no** · grep gas.assist = 0; A-278 | L | 2 |
| kazmer-c13-13 | 13 | §13.6.3 p.368-369 | Desbalance térmico en runners simétricos (Melt Flipper) | molde-E5 CFD | flujo a 4 cav difiere >5 % sin flipper y <2 % con cambio de nivel | — | **no** · feed.ts balancea solo por geometría; A-283 | L | 2 |
| kazmer-c13-14 | 13 | §13.3.3 p.353-355 | Lost core: el core Bi58/Sn42 (138 °C) como sumidero de calor | térmico molde-E8 ensamble | FDM con contacto: T_sup core <138 °C durante llenado+empaque | 58 % Bi / 42 % Sn funde a ≈138 °C (p.355) | **no** · grep lost.core = 0 | M | 2 |
| kazmer-c13-15 | 13 | §13.8.1 p.379 | In-mold labeling: film 0.15 mm contra cortante y calor | molde-E4 térmico | τ_pared E4 < τ_adm; 1D funde la cara (T>T_nf) sin el espesor completo | film ≈0.15 mm (p.379) | **no** · A-287 FALTA | M | 2 |
| kazmer-c13-16 | 13 | §13.2.2 p.346-347 | Coinyección: meta-material por capas y llenar con el más viscoso | molde-E4 molde-E8 molde-E9 materiales | E4 con η máx; E8/E9 ponderados; resultados entre los puros | — | **no** · grep coinyec = 0; A-277 | M | 2 |
| kazmer-c13-17 | 13 | §13.6.4 p.369-371 | Válvula autorregulada: P_out = F_control/A_válvula (100:1) | control molde-E5 | P_out = P_act·A_act/A_head ±5 % | ≈100:1 (p.371) | **no** · grep autorregul = 0 | S | 1 |
| kazmer-c13-18 | 13 | §13.10 p.388 | El acta: toda decisión aprobada con costos, beneficios y riesgos | planeación molde-E12 | estacion12Dado FIRMADO solo si todas las estaciones y decisiones completas; omitir una ⇒ INCOMPLETO | — | **si** · src/forja/mold/estudio-molde-datos.ts:estacion12Dado; ciclo-dado-test E12 (HECHO) | S | 4 |
| kazmer-c14-01 | 14 | Apéndice A p.390-393 | Base de datos de 16 plásticos (Cross-WLF + Tait + contracción) con oráculo interno | materiales molde-E4 molde-E9 | por material: η0_WLF(T_mid) ±5 %; α ±2 %; ABS Tait 0.31 % | ABS η0 2210 Pa·s, α 8.73e-8, s 0.4-0.8 % (p.390-393) | **parcial** · filling.ts:ABS_CROSS,PP_CROSS; shrinkage.ts:ABS_TAIT; solo ABS/PP de 16 | M | 4 |
| kazmer-c14-02 | 14 | Apéndice B + §12.2.6 p.323, 394-397 | Selección del metal por límite de fatiga, K del barreno y maquinado | molde-E1 molde-E11 materiales costo | filtro σ_fat ≥ 3P: P=200 → {A6,D2,H13}; P=80 incluye P20/4140; cost.ts cambia con la tasa | 'high melt pressures … A6, D2, or H13' (p.323) | **si** · src/forja/mold/moldbase.ts:MOLD_METALS,metalByKey; selector por K·P A-291 PARCIAL; cooling-design.ts H13=690 vs 760 INCONSISTENTE | S | 4 |
| kazmer-c14-03 | 14 | Apéndice F p.405-407 | Velocidad de fundido que balancea corte vs pérdida de calor (power-law → Newton) | molde-E4 | forma general en n=1 coincide ±1e-9; recommendedVelocity reproduce Eq 5.23 | v Newtoniano = √(5(Tmelt−Twall)κ/3μ) (p.407) | **parcial** · src/forja/mold/filling.ts:recommendedVelocity (solo Newtoniana) | S | 1 |

## 3. Features de la suite (consolidadas)

| prioridad | feature | estado | dónde | qué hace | ejercicios |
|---|---|---|---|---|---|
| P0 | Partición completa: dirección, línea por visibilidad, superficie loft ≥5°, shut-offs, tooling split | parcial | src/forja/mold/parting.ts:partingLoops,splitNoPlano · lamina-particion-angulo.ts · mold.ts:ShutOffBox · visibilidad.ts | Propone el eje (máx área proyectada + expulsable), la línea en borde no visible, la superficie no plana por loft/knit ≥5°, un shut-off por ventana y parte el bloque en cavidad/macho sin residuo | kazmer-c4-01, kazmer-c4-02, kazmer-c4-03, kazmer-c4-04, kazmer-c2-05 |
| P0 | Ruteo y circuito de agua en el CAD por pieza (½⌀ de claro, tapones, manifold, baffle, K de barreno) | parcial | src/forja/brep/useMoldStudio.ts:1237-1262 (E8b solo CUBO) · collision.ts:classifyInterface · cooling-design.ts | Líneas como grafo IN→OUT con extremos ciegos, cruces con O-ring, colisión contra sprue/insertos/pines, ΔP/ΔT serie-paralelo, distancia mínima por Eq 12.19 | kazmer-c9-07, kazmer-c9-09, kazmer-c9-11, kazmer-c12-10 |
| P0 | Reología y llenado lay-flat (Cross-WLF, velocidad, ΔP, P(h), tonelaje, arcos, flow leaders) | parcial | src/forja/mold/filling.ts · layflat.ts · flowleaders.ts · flowlen.ts (mol-s1 HECHO) | Todo el cap 5 encadenado; faltan P(h)→h_min, A_proj del kernel y PC del Apéndice A | kazmer-c5-01, kazmer-c5-02, kazmer-c5-03, kazmer-c5-04, kazmer-c5-05, kazmer-c5-06, kazmer-c5-08, kazmer-c5-09 |
| P0 | Diseñador de colada: ΔP por segmento, radios por presupuesto ∝L, balanceo familia, Dh, residencia, steel-safe | parcial | src/forja/mold/feed.ts:minRunnerRadius,steelSafeDiaMm,designFeedSystem · feed-layouts.ts · colada.ts | Eq 6.3-6.11 + Tabla 6.3; faltan balanceo artificial de molde familia, Dh trapezoidal, anillo y residencia | kazmer-c6-02, kazmer-c6-03, kazmer-c6-04, kazmer-c6-06, kazmer-c6-07, kazmer-c6-08, kazmer-c6-09, kazmer-c6-12 |
| P1 | Revisor DFM literal §2.3 + detección geométrica de draft/undercuts sobre el B-Rep | parcial | src/forja/mold/dfm.ts:checkDFM,DRAFT_TABLE_214 · E1 sonda de draft · sideactions.ts · mechanism-catalog.ts | Pared, costillas 70/4x/10x, bosses, filetes, draft Tabla 2.14, 4 familias de undercut mapeadas a mecanismo y costo Tabla 3.9 | kazmer-c2-01, kazmer-c2-02, kazmer-c2-03, kazmer-c2-04, kazmer-c2-05 |
| P1 | Cotizador causal del molde y de la pieza (Eq 3.1-3.25) con break-even y sobrediseño | si | src/forja/mold/moldcost-detailed.ts · cost.ts:breakEven · plate-cost.ts · scripts/mold-cost-test.cjs | Insertos, maquinado con complejidad A·h/V, acabado, base, customización, costo/pieza, arquitecturas; falta acabado por zonas | kazmer-c3-01, kazmer-c3-02, kazmer-c3-03, kazmer-c3-04, kazmer-c3-05, kazmer-c3-06, kazmer-c3-07, kazmer-c3-08 |
| P1 | Métricas de forma del kernel: A_surface, V, A_proj en la apertura, A_eff de sección, área de placa neta | parcial | occt.ts masa-inercia/sección; A_proj A-096 PARCIAL; ejection.ts:effectiveArea tecleada; structural.ts:plateCompression recibe A | Del B-Rep sin teclear: alimenta E2 (complejidad), E4 (tonelaje), E10 (F_eject) y E11 (área de soporte) | kazmer-c3-08, kazmer-c5-06, kazmer-c11-01, kazmer-c12-04 |
| P1 | Insertos, layout de cavidades, base estándar y compatibilidad con máquina (§4.2-4.3) | si | src/forja/mold/moldbase.ts · platesizing.ts · machinesizing.ts · threeplate.ts (mol-s3 HECHO) | sizeInserts, aspecto <2:1, retículo HASCO/DME, checkMachine (tie bars, daylight, shot, clamp), tres placas | kazmer-c4-05, kazmer-c4-06, kazmer-c4-07, kazmer-c4-08, kazmer-c6-10 |
| P1 | Calculadora de compuerta cerrada + geometría 3D de compuertas en el inserto | parcial | src/forja/mold/gating.ts (cálculo SÍ) · lamina-compuerta.ts (veredictos, sin sólido) | Tabla 7.1-7.4: tipo, corte, ΔP, congelamiento, steel-safe; sólidos OCC del túnel 45°/20°/3⌀, fan loft, diafragma | kazmer-c7-01, kazmer-c7-02, kazmer-c7-03, kazmer-c7-04, kazmer-c7-05, kazmer-c7-06, kazmer-c7-07, kazmer-c7-08, kazmer-c7-09 |
| P1 | Flujo de enfriamiento de 7 pasos (t_c → Q → caudal → ⌀ → profundidad → paso) con tablas | si | src/forja/mold/cooling.ts · cooling-design.ts · coolinglines.ts · slendercore.ts | Eqs 9.5-9.24, Tabla 9.1/9.2/9.3, SCF, variación de flujo por paso, núcleo esbelto | kazmer-c9-01, kazmer-c9-03, kazmer-c9-04, kazmer-c9-05, kazmer-c9-06, kazmer-c9-11 |
| P1 | Campo térmico del molde (transitorio 1D convectivo, estacionario 3D, materiales asimétricos, conformal, un lado) | parcial | src/forja/mold/thermal-layers.ts · thermal-series.ts · thermal-steady.ts · mold-thermal-fdm.ts · lamina-nucleo-enfriamiento.ts | FDM por capas con Robin, solveSteadyMoldField, core Cu 940, hélice conformal, frontera adiabática (two-shot) | kazmer-c9-02, kazmer-c9-08, kazmer-c9-10, kazmer-c9-12, kazmer-c13-02 |
| P1 | Contracción desde PvT (Tait) con banda, alarma, steel-safe cav/core, anisotrópica, semicristalinos y alabeo | parcial | src/forja/mold/shrinkage.ts · warpage.ts · useMoldStudio.ts:1285 (E9) · fan.ts (llena, no empaca) | shrinkage.ts + warpage.ts SÍ; anisotrópica Eq 10.14-16, POM Tait y mapa s(x,y) con empaque FALTAN | kazmer-c10-01, kazmer-c10-02, kazmer-c10-03, kazmer-c10-04, kazmer-c10-05, kazmer-c10-06, kazmer-c10-07, kazmer-c10-08, kazmer-c10-09, kazmer-c10-10 |
| P1 | Motor de expulsión + layout por agarre + tipo por rasgo + detallado en placas | parcial | src/forja/mold/ejection.ts · ejectortypes.ts · eject-layout.ts · mold-ejection-auto.ts · fits.ts | Eq 11.7-11.23, gripEjectorLayout, chooseEjectorType, regla 1⌀ de acero, conflicto con agua; sleeve/stripper sin geometría | kazmer-c11-01, kazmer-c11-02, kazmer-c11-03, kazmer-c11-04, kazmer-c11-05, kazmer-c11-06, kazmer-c11-07, kazmer-c11-08, kazmer-c11-09, kazmer-c11-10, kazmer-c11-11 |
| P1 | Side actions: core pull hidráulico y slide con perno ángulo con geometría de llave/interlock/gib | parcial | src/forja/mold/sideactions.ts · mold-sideaction-gen.ts · scripts/mold-sideactions-test.cjs | corePullForce, hydraulicBore, anglePinDesign, planSideAction SÍ; llave/interlock/claros como geometría FALTAN | kazmer-c11-12, kazmer-c11-13, kazmer-c11-14, kazmer-c11-15, kazmer-c11-16 |
| P1 | Juez estructural: placas, pilares Eq 12.12-13, mejilla, interlocks, K de barrenos, cores, con contraste FEA | parcial | src/forja/mold/structural.ts · platesizing.ts · mold-fea.ts · lamina-vonmises.ts · cores.ts · mold-interlocks.ts · mold-analysis.ts | Tres veredictos (yield, fatiga, δ<venteo); pilares con superposición y pre-carga FALTAN; dos K y dos H13 conviven | kazmer-c12-01, kazmer-c12-02, kazmer-c12-03, kazmer-c12-04, kazmer-c12-05, kazmer-c12-06, kazmer-c12-07, kazmer-c12-08, kazmer-c12-09, kazmer-c12-10, kazmer-c12-11, kazmer-c12-12, kazmer-c12-13, kazmer-c12-14 |
| P1 | Ajustes ANSI B4.1 completos (Tabla 12.1 + 12.2), fuerza de inserción y tornillería por izaje | parcial | src/forja/mold/fits.ts · fasteners.ts · mold-fasteners.ts | interferenceFit (LN/FN) y fasteners SÍ; LC/LT dowels y Eq 12.29-12.31 FALTAN | kazmer-c12-15, kazmer-c12-16, kazmer-c12-17, kazmer-c12-18 |
| P1 | Bases de datos Apéndice A (16 plásticos) y B (11 metales) con selector de metal por K·P y costo | parcial | src/forja/mold/moldbase.ts:MOLD_METALS · filling.ts:ABS_CROSS,PP_CROSS · shrinkage.ts:ABS_TAIT | Apéndice B literal; Apéndice A solo ABS/PP; selector automático PARCIAL; factores Eq 4.2-4.3 FALTAN | kazmer-c14-01, kazmer-c14-02, kazmer-c4-09 |
| P2 | Venteo: h_min/h_max, ubicación desde el campo de llenado y anatomía CAD (land/alivio/salida, pin, inserto) | parcial | src/forja/mold/venting.ts · venting-locations.ts · fits.ts:EJECTOR_DIAM_CLEARANCE_MM | Eq 8.2-8.4 y enumerarVenteos SÍ; anatomía cortada en el inserto FALTA | kazmer-c8-01, kazmer-c8-02, kazmer-c8-03, kazmer-c8-04, kazmer-c8-05, kazmer-c8-06, kazmer-c8-07 |
| P2 | Selector de tecnología (Fig 13.1) + variantes de base (split, reverse, rotating, collapsible, stack) + acta | parcial | src/forja/mold/moldtech.ts · unscrewing.ts · estudio-molde-datos.ts:estacion12Dado | moldtech.ts solo §13.9; unscrewing.ts ecuaciones; acta E12 HECHA; variantes sin geometría | kazmer-c13-01, kazmer-c13-03, kazmer-c13-08, kazmer-c13-09, kazmer-c13-10, kazmer-c13-11, kazmer-c13-18 |
| P2 | Procesos especiales (coinyección, gas/water, lost core, IML, insulated, Melt Flipper, wall-temp) | no | grep coinyec/gas.assist/lost.core/insulated/pulsed en src/forja/mold = 0 | Extensiones de E4/E8/E9 con dos materiales o fases; nada en el repo | kazmer-c13-04, kazmer-c13-05, kazmer-c13-06, kazmer-c13-07, kazmer-c13-12, kazmer-c13-13, kazmer-c13-14, kazmer-c13-15, kazmer-c13-16, kazmer-c13-17 |
| P2 | Intake §2.1.5 + worksheets vivos + tolerancias ±0.4 %/±0.1 % + cotización por arquitectura | parcial | public/escuela/lecciones/mol-s2-intake.json · estudio-molde-datos.ts:estacion1 | Intake HECHO en mol-s2; tolerancias A-004 y regulatorio/estética A-005 FALTAN | kazmer-c2-06, kazmer-c2-07, kazmer-c6-14, kazmer-c1-01 |

## 4. Supertickets propuestos (ordenados por sprint)

Formato Temis: `- <id> · <título> · <herramientas> · <oráculo>`. El estado verde/rojo lo escribe la producción.

### `kazmer-s4-partir-tu-pieza` — Tu pieza se PARTE: apertura, línea, superficie no plana y shut-offs

- sprint 1 · esfuerzo L · valor 5/5 · caps [4, 2] · depende de: mol-s1-llenado-por-pieza, mol-s3-base-catalogo
- OBJETIVO: Que la pieza del árbol (no el cubo) salga de E3 con dirección de apertura elegida por área proyectada, línea de partición en borde no visible, superficie de partición por loft ≥5° cosida, un shut-off por ventana y tooling split con conservación de volumen; undercuts detectados geométricamente. Es la automatización #1 de PROCESOS-REPETITIVOS y desbloquea el bezel y las piezas de los cursos.

## EJERCICIOS
- kazmer-c4-01 · Dirección de apertura: cup axial vs radial (split) y bezel · molde-E3 visibilidad masa-inercia · Eje = normal del máx área proyectada Y 0 caras atrapadas; eje radial del cup → ≥1 atrapada → 'split cavity' f 0.5/1.0
- kazmer-c4-02 · Línea de partición del cup en la base del rim, no en el labio · molde-E3 parting visibilidad · partingLoops devuelve el lazo en la base del rim; test v1·3 'la BOCA cae EN la partición'; candidato del labio marcado 'visible'
- kazmer-c4-03 · Superficie de partición no plana del bezel por loft ≥5° y knit · loft superficies knit molde-E3 parting · Superficie cerrada y manifold; ángulo mín ≥5° (lamina-particion-angulo); V_cav+V_core+V_pieza = V_bloque ±0.1 %
- kazmer-c4-04 · Shut-off de la ventana del display del bezel · molde-E3 parting superficies · n_shutoffs == n_ventanas pasantes (bezel 1, cup 0); parting.ts reporta 'ventana tapada'
- kazmer-c2-05 · Detectar las cuatro familias de undercut · croquis extruir molde-E1 molde-E10 sideactions · Detector reporta exactamente 4 features atrapadas en Z (control sin features → 0); cada una con mecanismo de mechanism-catalog
- kazmer-c4-05 · Dimensionar insertos: 3⌀ de agua, cheek = profundidad, redondeo a placa · molde-E3 revolve extruir moldbase · sizeInserts: cup driver 'estructural', bezel 'refrigeración'; alturas múltiplo de 10; V medido = L×W×H ±0.1 %
- kazmer-c4-06 · Layouts de cavidades: línea, grid, círculo, híbrido de 6 · patrón molde-E3 feed-layouts · aspecto(línea 8)>2 rechazado; grid 8 ≤2; área(círculo)>área(grid); 0 colisiones inserto-inserto/guide pins

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/parting.ts:partingLoops,splitNoPlano (plana y quebrada por pasos)
- src/forja/mold/lamina-particion-angulo.ts (ángulo ≥5° medido)
- src/forja/mold/mold.ts:ShutOffBox
- src/forja/mold/visibilidad.ts
- src/forja/mold/dfm.ts:DFMUndercut (por etiqueta)
- v1·3 'la BOCA cae EN la partición' (ciclo-dado-test)

### `kazmer-s5-llenado-que-decide` — El llenado DECIDE: espesor mínimo, tonelaje del kernel y benchmark Tabla 5.1

- sprint 1 · esfuerzo M · valor 4/5 · caps [5] · depende de: mol-s1-llenado-por-pieza
- OBJETIVO: Cerrar el cap 5 sobre el bezel: curva P(h) → 1.36 mm, área proyectada medida por el kernel → 99 t, PC del Apéndice A, y el solver FAN contrastado contra Moldflow (Tabla 5.1) como vara ≤10 %.

## EJERCICIOS
- kazmer-c5-05 · Espesor mínimo de pared por la curva P(h) a 100 MPa · molde-E4 barrido · h_min(100 MPa)=1.36±0.03; P(h) monótona; P(1.5)=83.2
- kazmer-c5-06 · Tonelaje al fin del llenado, inicio del empaque y bezel completo · molde-E4 masa-inercia machinesizing · clampForceN(50e6,0.2×0.012)=120 kN; 180 kN; A_proj del kernel = 9,724±100 mm2 → 99±1 t
- kazmer-c5-02 · Curva Cross-WLF vs Newtoniano vs power-law para PC · molde-E4 materials · viscosityCrossWLF(PC,100,280)=350±10 %; (1e4)=80±10 %; eta0(270)/eta0(290)=2.64±0.1; ∫perfil = caudal
- kazmer-c5-01 · Corte, esfuerzo, fuerza y gradiente de presión en canal plano · molde-E4 · shearRate 66.7±0.5; τ 6,667±50; F 133-135; 2τ/H 17.33; ΔP 3.47±0.05
- kazmer-c5-03 · Velocidad de inyección recomendada del bezel con convergencia · molde-E4 · convergeVelocityTraced reproduce 0.69/0.77/0.80/0.82±0.01; η(2000,239)=120±3; Vdot 125±5
- kazmer-c5-04 · Presión de llenado del bezel por lay-flat power-law · molde-E4 layflat · fillingPressure=83.2±0.5 (test existente); variante A/B/C > tira única
- kazmer-c5-07 · Contraste análisis a mano vs Moldflow MPI 5.1 del bezel · molde-E4 FAN benchmark · solver 3D (FAN/flowlen) del bezel: P ∈ [100,121] MPa; F_fill 486-570 kN; 0<ΔT<5 °C
- kazmer-c14-03 · Velocidad de fundido que balancea corte vs pérdida de calor (power-law → Newton) · molde-E4 · forma general en n=1 coincide ±1e-9; recommendedVelocity reproduce Eq 5.23

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/filling.ts:fillingPressure (83.2 ✓),convergeVelocityTraced,clampForceN
- src/forja/mold/layflat.ts (contenedor, race, flow leader ✓ en mol-s1)
- src/forja/mold/flowlen.ts:predicadoDeMalla (mol-s1)

### `kazmer-s6-colada-por-presupuesto` — La colada se DESPEJA: radios por presupuesto, familia balanceada y cortador steel-safe

- sprint 2 · esfuerzo M · valor 5/5 · caps [6] · depende de: mol-s1-llenado-por-pieza
- OBJETIVO: Que E5 despeje los radios por ΔP ∝ longitud, balancee artificialmente el molde familia cup+lid (46.8 MPa por ambas ramas), calcule residencia/vueltas, maneje secciones trapezoidales (Dh) y anulares, y redondee HACIA ABAJO al cortador; con la colada sólida verificada.

## EJERCICIOS
- kazmer-c6-03 · Radios mínimos por presupuesto de ΔP repartido por longitud · molde-E5 feed barrido · minRunnerRadius 5.0/4.4/4.4±0.05 y 4.0/3.5/3.5; V 35±0.5 y 21.3±0.3; R_manifold==R_nozzle
- kazmer-c6-04 · Balanceo artificial del molde familia cup + lid · molde-E5 feed ensamble · 16.8/15.4±0.3; radios ±0.05; ΔP_total ambas ramas 46.8±0.5; regrind 3.5±0.3 %
- kazmer-c6-02 · ΔP y volumen del hot runner del bezel segmento a segmento · molde-E5 feed · pressureDropRunner 5.9/8.8/16.7±0.2, suma 31.4±0.3; feedVolume 37.0±0.5; reynolds<1
- kazmer-c6-06 · Vueltas y tiempo de residencia del hot runner · molde-E5 feed · 0.77±0.01; 24±0.5 s; alarma si n_turns>10 o t_res > límite
- kazmer-c6-07 · Runner trapezoidal: diámetro hidráulico y ΔP · molde-E5 croquis sweep feed · Dh 7.04±0.02; ΔP 3.9±0.1; sweep del perfil reproduce Dh=4A/p ±1 %
- kazmer-c6-08 · Sección anular de la boquilla con valve pin · molde-E5 feed · 24.5±0.2 MPa Eq 6.14; Eq 6.15 power-law ≥ Newtoniana
- kazmer-c6-09 · Redondear a cortador estándar HACIA ABAJO (steel-safe) · molde-E5 feed CAM · steelSafeDiaMm(4.6)=4.5; ΔP(4.5)>ΔP(4.6); V(4.5)<V(4.6); cortador existe en catálogo CAM
- kazmer-c6-13 · Colada sólida del molde de dos placas: sprue con contra-cono, runners y puller · revolve sweep booleanas ensamble molde-E5 colada · verificacionColada: declarado≈medido; rBase>rTop; colada∩macho=∅; V vóxeles≈analítico≈OCC

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/feed.ts:minRunnerRadius,pressureDropRunner,feedVolume,steelSafeDiaMm,designFeedSystem
- src/forja/mold/feed-layouts.ts (serie/ramificado/radial/híbrido)
- src/forja/mold/colada.ts:construirColada,verificacionColada (medida 3 fuentes)
- src/forja/mold/threeplate.ts

### `kazmer-s9-agua-en-tu-molde` — El agua VIVE en tu molde: ruteo por pieza, redes, baffle y el gradiente que deja

- sprint 2 · esfuerzo L · valor 5/5 · caps [9, 12] · depende de: kazmer-s4-partir-tu-pieza
- OBJETIVO: Sacar el circuito E8b del cubo y hacerlo por pieza: 7 pasos con ventanas numéricas, ruteo con ½⌀ de claro y K de barreno Eq 12.19 (unificar las dos K del repo), redes serie/paralelo/manifold con tapones, baffle en core esbelto, y el campo estacionario que muestra el gradiente (6 °C) en el vaso.

## EJERCICIOS
- kazmer-c9-07 · Paso entre líneas y primer ruteo del vaso/tapa (infactible → factible) · molde-E8 ensamble interferencia térmico FEA-térmico · heatFluxVariation(2)<5 %; interferencia lista cruces (≥1 Fig 9.9, 0 Fig 9.10); campo 6±1.5 °C
- kazmer-c9-09 · Redes de enfriamiento del bezel: serie → paralelo → manifold interno → periférico · molde-E8 ensamble corte interferencia planeación · ΔP_serie=8·ΔP; ΔT_serie=8·ΔT; conexiones 16/8/2/2 emergentes del grafo; tapones = extremos ciegos
- kazmer-c9-05 · Ventana de ⌀ de línea: turbulencia y ΔP → plug estándar · molde-E8 térmico · maxLineDiameter 20±0.5; minLineDiameter 3.7±0.15; plug ∈ Tabla 9.2
- kazmer-c9-06 · Profundidad de la línea: concentración de esfuerzo vs calor · molde-E8 fatiga térmico · maxMeltPressureMPa(456,SCF(4))=175±1; (166,SCF(1))=50±1; hLineMaxM(32)=0.032
- kazmer-c12-10 · Distancia mínima de línea de agua ⌀9.5 a la cavidad en H13 a 200 MPa · molde-E8 molde-E11 térmico · H_hole 11.1±0.1; E8 respeta H≥11.1; K(1.5⌀)=3.40
- kazmer-c9-11 · Selector de enfriamiento para núcleo esbelto: core 60 → baffle 12 · molde-E8 corte ensamble térmico · chooseSlenderCoreCooling(60)='baffle', barreno ∈[6,25]; campo axi con baffle reduce gradiente
- kazmer-c9-01 · Tiempo de enfriamiento del molde familia y del runner · molde-E8 térmico · coolingTimePlate(0.002)=8.4±0.05; (0.003)=18.9; coolingTimeRod(0.00476)=22.9
- kazmer-c9-04 · Caudal de refrigerante por línea vs controlador VacTherm · molde-E8 térmico · coolantFlowRate(260,1)=6.2e-5±0.1e-5; total ≤1e-3 → VERDE

## YA-EXISTE (prueba de ausencia)
- src/forja/brep/useMoldStudio.ts:1237-1262 (E8b anillo+serpentina+baffle+tapones+O-rings del CUBO)
- src/forja/mold/cooling-design.ts:heatFluxVariation,stressConcentration,PLUGS_DME
- src/forja/mold/coolinglines.ts:designCoolingLines
- src/forja/mold/thermal-steady.ts:solveSteadyMoldField
- src/forja/mold/slendercore.ts · lamina-nucleo-enfriamiento.ts
- src/forja/mold/lamina-vonmises.ts:kBarrenoLibro (K 3.40 exacto)

### `kazmer-s7-compuerta-en-el-inserto` — La compuerta se CORTA en el inserto: tipo, corte, ΔP, congelamiento y el túnel a 45°

- sprint 2 · esfuerzo M · valor 4/5 · caps [7] · depende de: kazmer-s6-colada-por-presupuesto
- OBJETIVO: La calculadora de compuerta (ya reproduce 111k/132k/1.9/1.5/1.1) encadenada con Cross-WLF a la tasa de corte y con la historia η(t) → 2.2 s, y la geometría 3D de las compuertas (túnel 45°/20°/3⌀, fan por loft, diafragma) cortada en cavidad/core con juez geométrico y apertura animada.

## EJERCICIOS
- kazmer-c7-07 · Modelar el tunnel gate de la tapa en el inserto y verificar sus tres ángulos · croquis revolve corte molde-E5 ensamble plano2D · sólido del túnel 45±1°, cono ≥20°, ≥3⌀ (juez geométrico); colada del lado del macho tras apertura
- kazmer-c7-08 · Fan gate como loft círculo→rectángulo y diafragma como tira W = π·D · loft croquis molde-E5 compuerta molde-E4 · V del loft = ∫secciones ±2 %; frente E4 plano (<5 % del ancho); γ diafragma < γ_max
- kazmer-c7-04 · ΔP de la pin-point con Cross-WLF a la tasa de corte · molde-E5 compuerta reología · viscosityCrossWLF(ABS,132000,T_mid)=5.4±0.5 → 1.9±0.1; a 50,000 → 11.2±1 y 1.3±0.1
- kazmer-c7-09 · Historia T/η de la compuerta → tiempo mínimo de empaque · térmico reología molde-E5 · t(η=1e5)=2.2±0.2 s con serie de Fourier del cilindro + viscosityCrossWLF
- kazmer-c7-01 · Tasa de corte en las dos edge gates del bezel · molde-E5 compuerta reología · shearRateStrip=111,000±500 y ROJO; con W 14 ≤ 50,000
- kazmer-c7-02 · Tasa de corte de la pin-point del vaso y despeje del radio · molde-E5 compuerta · shearRateCyl 132,000±1,500; gateRadiusForShear 1.03±0.01
- kazmer-c7-05 · Tiempo de congelamiento del fan gate del bezel · molde-E5 compuerta térmico · gateFreezeStripS=1.5±0.05; bandera 'gatea a sección delgada'
- kazmer-c7-06 · Congelamiento de la pin-point ⌀2 vs solidificación del vaso de 3 mm · molde-E5 compuerta térmico · gateFreezeCylS 1.1±0.05; gateFreezeStripS(3) 24±0.5; ROJO

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/gating.ts (Tablas 7.2-7.4 con test mold-gating-test.cjs)
- src/forja/mold/lamina-compuerta.ts (veredictos V7.7, mallaTronco)
- src/forja/mold/thermal-series.ts:cylinderCenterTheta

### `kazmer-s11-expulsion-por-regla` — La expulsión por REGLA: A_eff de la sección, el peor de tres criterios y pines junto al agarre

- sprint 3 · esfuerzo M · valor 5/5 · caps [11] · depende de: kazmer-s9-agua-en-tu-molde
- OBJETIVO: Cerrar la cadena Eq 11.7→11.10/11.12→Euler con la A_eff MEDIDA en la sección del CAD (no tecleada), layout automático junto a costillas/paredes con regla 1⌀ de acero y sin chocar agua, pandeo con K=0.7 literal, blade y undercut elástico; detallado del pin a través de las placas.

## EJERCICIOS
- kazmer-c11-01 · Fuerza de expulsión del vaso desde la sección del CAD · molde-E10 sección masa-inercia expulsión · ejectionForce=1800±60; A_eff medida en la sección = 526±5 %
- kazmer-c11-02 · Área efectiva del bezel con costillas y sanity vs máquina · molde-E10 expulsión máquina · effectiveArea 1.3e-3±2 %; 4700±150 N; F/clamp ≤0.02
- kazmer-c11-03 · Área de empuje y perímetro mínimo de 20 pines · molde-E10 expulsión · ejectorPinSizing → pushArea 10.4±0.3, dShear 2.23±0.06, dComp 0.8±0.05
- kazmer-c11-04 · 10 pines ⌀4.5 vs 40 ⌀1.125; layout Fig 11.9 rechazado · molde-E10 expulsión layout interferencia · ⌀(10)=4.46±0.05, σ 30±1; ⌀(40)=1.11, σ 100±3; juez de acero ROJO a 1 mm
- kazmer-c11-05 · Layout de expulsores junto al agarre: pad y pin contorneado · molde-E10 layout malla interferencia molde-E8 · distancia pin→agarre ≤2⌀; acero ≥1⌀; sin colisión con agua; deflexión FEA <0.1 mm
- kazmer-c11-07 · Pandeo del pin eyector (Euler, columna 0.7L) · molde-E10 pandeo expulsión · pinBuckling(1.86,200,235,K 0.7).sf≈1.0±0.05; K=2 default = DESVIACIÓN DECLARADA
- kazmer-c11-08 · Largo máximo del ejector blade del bezel · molde-E10 pandeo expulsión · bladeMaxLengthMm(235,6,1)=93±1; checkEjectorBlade(93.8) ok=false
- kazmer-c11-06 · Detallado del pin eyector en el ensamble de placas · ensamble corte chaflán ajustes molde-E10 plano2D cotas · interfaz pin↔core 0.13, pin↔support +0.5, cabeza↔retainer holgada 'esperado'; DOF rotacional 0 (dowel)

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/ejection.ts:ejectionForce,effectiveArea,ejectorPinSizing,pinBuckling (K=2 default)
- src/forja/mold/eject-layout.ts:gripEjectorLayout
- src/forja/mold/mold-ejection-auto.ts:maxPinDiaForSteelMm,autoEjectionPlan
- src/forja/mold/ejectortypes.ts:bladeMaxLengthMm,checkUndercut
- E10 del cubo (pines escalonados, useMoldStudio.ts:1332)

### `kazmer-s12-juez-estructural` — El acero RINDE CUENTAS: tres veredictos, pilares con pre-carga y el barreno que ovala

- sprint 3 · esfuerzo M · valor 5/5 · caps [12] · depende de: kazmer-s9-agua-en-tu-molde
- OBJETIVO: Juez estructural del molde por pieza con tres veredictos independientes (yield en sobrepresión, fatiga, δ<0.02 mm=flash): área de soporte neta medida, viga vs FEA (2×), pilares con superposición Eq 12.12-13 y pre-carga, K de barrenos con vida S-N y ovalización, cores huecos.

## EJERCICIOS
- kazmer-c12-07 · Pilar de soporte del bezel para δ_total < 0.1 mm · molde-E11 ensamble cotas · σ 297/167±1.5; δ_comp 0.07±0.005; δ_bend 0.02±0.003; δ_max Eq 12.13; pilar sin chocar pines/KO
- kazmer-c12-04 · Compresión de la placa A alrededor de la cavidad · molde-E11 ensamble kernel-área · área de cara menos barrenos medida por kernel 0.069±0.002; σ 28.5±0.5
- kazmer-c12-06 · Flexión de placa como viga con carga central (bezel) · molde-E11 FEA-estático · plateBending 0.056±0.003; runMoldFea 0.4-0.5× viga; flash si δ>0.02
- kazmer-c12-11 · Barreno de expulsor ⌀4 con 0.5 mm de QC7 a 100 MPa · molde-E10 molde-E11 FEA-estático fatiga · K 5.3±0.05; yieldOk true, fatigaOk false, vida ≈1e3; FEA 0.10±0.03
- kazmer-c12-02 · FEA del molde del bezel a 150 MPa: von Mises y apertura de 0.36 mm · FEA-estático molde-E11 ensamble · FEA tet: separación 0.36±0.06; viga Eq 12.10 ≈2.3× el FEA
- kazmer-c12-13 · Hoop del core del vaso y ⌀ interno máximo en QC7 (doble vara) · molde-E11 molde-E8 · hoopStress 240; maxInnerDiameter 31/38±0.5; govBy fatiga
- kazmer-c12-14 · Flexión del core del vaso por ΔP=40 MPa · molde-E11 molde-E5 molde-E4 · coreInertiaM4 5.1e-7±2 %; δ 0.03±0.003; interlocked → 0.003; ΔP debería salir de E4 (A-270)
- kazmer-c12-01 · Esfuerzo límite: dos caminos excluyentes y el aluminio sin límite de fatiga · molde-E11 fatiga materiales · limiteMaterial('QC7',N) 545/370/170; P20 456; nunca f y peor caso juntos (control negativo)

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/structural.ts:plateCompression,plateBending,shearStress
- src/forja/mold/platesizing.ts:sizeSupportPlate,optimizeSupportPlate (solo claro)
- src/forja/mold/mold-fea.ts:runMoldFea (B+soporte+rieles)
- src/forja/mold/cores.ts:designCore (cup exacto)
- src/forja/mold/lamina-vonmises.ts:limiteMaterial,kBarrenoLibro
- E11 del cubo R90 firmado (gate 181)

### `kazmer-s10-contraccion-y-alabeo` — La pieza ENCOGE y se TUERCE: banda PvT, steel-safe, anisotropía y alabeo

- sprint 3 · esfuerzo M · valor 4/5 · caps [10] · depende de: kazmer-s5-llenado-que-decide
- OBJETIVO: E9 por pieza: contracción desde Tait con banda min/max y alarma, steel-safe cav/core medido, anisotrópica con fibra y escalado por eje, POM semicristalino, y los dos alabeos (espesor 1.6 mm, área 6.6 mm) con los números impresos en el gate.

## EJERCICIOS
- kazmer-c10-03 · Contracción volumétrica y lineal isotrópica del bezel · molde-E9 materiales · shrinkage(ABS_TAIT,405,66) rv 0.991±0.001; s 0.31±0.03 %
- kazmer-c10-05 · Banda de contracción del bezel: sobre-empaque vs empaque corto · molde-E9 materiales · shrinkageRecommendation(83) low −0.2±0.05 con alarma; high 1.9±0.1
- kazmer-c10-07 · Steel-safe: cavidad 0.4 % y macho 0.6 % para s 0.5 % · molde-E9 escalado cotas ensamble · cavidad ×1.004, macho ×1.006 ±1e-4 en kernel; descalce registrado como spotting
- kazmer-c10-04 · Contracción anisotrópica del bezel en ABS 15 % GF · molde-E9 materiales escalado-anisotrópico · s=0.00352→0.00351; escalado X ×1/(1−0.0018), Y/Z ×1/(1−0.0035) medido en kernel
- kazmer-c10-08 · Semicristalino: acetal Delrin 500 contrae 3.5 % · molde-E9 materiales · specificVolume POM 0.77/0.69±0.01; s 3.5±0.2; bandera semicristalino
- kazmer-c10-09 · Alabeo del bezel por gradiente de 2 °C a través del espesor · molde-E9 alabeo FEA-térmico · alabeoPorEspesor → R 9050±300, δ 1.6±0.1; (100/102 °C, 0 MPa) → 2.1±0.15
- kazmer-c10-10 · Pandeo de la tapa center-gated por contracción diferencial · molde-E9 alabeo pandeo · alabeoPorArea → criterio TRUE y δ 6.6±0.2
- kazmer-c10-02 · PvT Tait de ABS: densidad, CVTE y compresibilidad · molde-E9 materiales gráfica · 1/specificVolume(293,0)=1047±3; CVTE ±0.2e-4; β ±0.3e-4; |ρ−1044|<1 %

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/shrinkage.ts:specificVolume,shrinkage,shrinkageRecommendation (0.31 % ✓, alarma ✓)
- src/forja/mold/warpage.ts:alabeoPorEspesor,alabeoPorArea (sin test con 9050/1.6/6.6)
- src/forja/brep/useMoldStudio.ts:1285-1325 (E9 steel-safe medido)

### `kazmer-s11b-side-actions-y-placas` — Lo que se MUEVE: core pull, slide con perno, sleeve, stripper y retorno

- sprint 4 · esfuerzo L · valor 4/5 · caps [11, 13] · depende de: kazmer-s11-expulsion-por-regla, kazmer-s4-partir-tu-pieza
- OBJETIVO: Geometría y cinemática de los mecanismos: core pull hidráulico con llave/interlock/claros y barrido sin colisión, slide con perno a 20° con gib/heel block, sleeve sobre core pin con stack-up, stripper plate flotante, retorno por resortes, y collapsible/rotating core para roscas.

## EJERCICIOS
- kazmer-c11-14 · Layout del core móvil del bezel: llave, interlock y claros · ensamble corte croquis extruir interferencia molde-E10 cinemática · barrido 15 mm sin colisión salvo contactos declarados; interlock 0 juego vertical; claro frontal >0
- kazmer-c11-15 · Slide con perno ángulo: largo para 12 mm a 20° · molde-E10 side-action cinemática ensamble · anglePinDesign(12,20,25) → 35±0.5, 60±1; slide recorre 12 cuando placa recorre L·cos φ
- kazmer-c11-12 · Fuerza que debe sostener el core pull del bezel · molde-E10 side-action · corePullForce(200e6,220e-6)=44,000; A_proj del sólido ≥220 mm²
- kazmer-c11-13 · Cilindro hidráulico del core pull: bore y carrera estándar · molde-E10 side-action ensamble catálogo · hydraulicBore 75±0.5; pickStdBore 82.55; carrera ≥15
- kazmer-c11-09 · Ensamble de ejector sleeve sobre core pin fijo (boss) · ensamble revolve ajustes tolerancias molde-E10 cinemática · sleeve recorre la carrera sin colisión; stack-up ≤ tolerancia de pared del boss
- kazmer-c11-10 · Molde con stripper plate para vaso y tapa · ensamble corte molde-E10 cinemática plano2D · desbalance F_eject <50 % o refuerzo; apertura sin colisión; borde de empuje ≥90° o bandera
- kazmer-c11-16 · Retorno temprano: rod roscado vs resortes · molde-E10 resortes ensamble · springReturnCheck: compresión ≤0.40; >4⌀ → pin; F ≈0.25·F_eject ±20 %
- kazmer-c13-08 · Collapsible core comercial: colapso ≈6 % del ⌀ · molde-E10 ensamble cinemática · collapsibleCoreCheck ok ⇔ 0.06⌀ ≥ 2·undercut; fuera de 13-90 → no comercial

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/sideactions.ts:corePullForce,hydraulicBore,anglePinDesign,springReturnCheck (44 kN, 75→82.55, 35 mm ✓)
- src/forja/mold/mold-sideaction-gen.ts:planSideAction,sideActionVerdicts
- src/forja/mold/ejectortypes.ts:chooseEjectorType
- src/forja/mold/unscrewing.ts:collapsibleCoreCheck

### `kazmer-s8-venteo-con-anatomia` — El aire SALE: ubicación desde el llenado y la anatomía del venteo cortada en el inserto

- sprint 4 · esfuerzo M · valor 3/5 · caps [8] · depende de: kazmer-s5-llenado-que-decide, kazmer-s11-expulsion-por-regla
- OBJETIVO: Correr enumerarVenteos sobre el bezel (3 tipos, ~36 → 8), dimensionar h entre h_min y h_max sin prorratear, y cortar en el inserto la anatomía land/alivio/salida, el anillo perimetral, la holgura de pin con cono y el inserto venteado en bolsa muerta con chequeo topológico de conectividad.

## EJERCICIOS
- kazmer-c8-02 · Mapa de ubicaciones de venteo del bezel: 3 tipos → 8 iniciales · molde-E4 molde-E7 venteo · enumerarVenteos sobre el bezel: 3 tipos; 4 fin de flujo 'obligatorio'; lista 'maquinar' = 8
- kazmer-c8-03 · Espesor mínimo del venteo · molde-E7 venteo · ventMinThickness(100e-6,0.01,0.01,0.1e6)=0.06±0.002
- kazmer-c8-04 · Espesor máximo del venteo por rebaba · molde-E7 venteo · ventMaxThickness(0.0002) ∈ [0.06,0.09] (redondeo declarado)
- kazmer-c8-01 · Caudal de aire del bezel y su reparto conservador · molde-E7 venteo · el plan asigna 62.5e-6 a cada venteo
- kazmer-c8-05 · Anatomía CAD del venteo en partición (bezel) y anillo perimetral (tapa) · croquis extruir corte molde-E7 plano2D cotas · volumen removido = W·L·h ±5 %; land-canal-barreno conectados (una cavidad de aire, chequeo topológico)
- kazmer-c8-06 · Venteo por la holgura del pin eyector y del blade · molde-E7 molde-E10 ajustes corte · ejectorHole=⌀+0.13; h_vent 0.065; ventMinThickness local ≤ 0.065 → VERDE
- kazmer-c8-07 · Inserto venteado en bolsa muerta y venteo sinterizado · croquis extruir corte molde-E7 molde-E10 · inserto cabe (interferencia 0); venteo conecta; juez propone blade si hay costilla

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/venting.ts:ventMinThickness,ventMaxThickness,ventDesign (E7 exacto)
- src/forja/mold/venting-locations.ts:enumerarVenteos (jabonera)
- src/forja/mold/fits.ts:EJECTOR_DIAM_CLEARANCE_MM 0.13

### `kazmer-s12b-ajustes-tornillos-metal` — Se SUJETA y se COMPRA: ajustes ANSI, inserción, tornillos por izaje y el metal por K·P

- sprint 4 · esfuerzo S · valor 3/5 · caps [12, 14, 4] · depende de: kazmer-s12-juez-estructural
- OBJETIVO: Completar Tabla 12.2 (dowels LC/LT) y la fuerza de inserción contra la prensa del taller, mejilla e interlocks acotados en el plano, tornillos DIN 912 por izaje, y el selector de metal (Apéndice B + factores Eq 4.2-4.3) unificando H13 690/760.

## EJERCICIOS
- kazmer-c12-15 · Tolerancias FN1 para el core insert cuadrado 88.90 mm · molde-E3 cotas plano2D GD&T · interferenceFit(88.9,'FN1') ±0.001; cota con límites en el plano
- kazmer-c12-16 · Fuerza de inserción del core insert FN1 · molde-E3 cotas planeación · σ 69±1; F 808±10 kN; si F>prensa → LN1-LN3
- kazmer-c12-18 · Dowel ⌀12 LT3: juego esperado y peor interferencia · molde-E3 cotas plano2D · límites ±0.001; F 50±1 kN; plano con LT3
- kazmer-c12-17 · Tornillos SHCS que unen las mitades: peor caso de izaje · molde-E11 ensamble catálogo DIN · 362±2 kg; 47 kN±2 %; DIN 912 M10; masa bloque vs ensamble <2×
- kazmer-c12-08 · Mejilla (cheek) del vaso: cortante y deflexión · molde-E11 molde-E2 cotas · τ 89±1; δ 0.04±0.004; cota cheek CUMPLE/VIOLA vs max(3⌀,0.73H,H)
- kazmer-c12-09 · Cortante en el interlock ⌀19 de la cavidad del vaso · molde-E11 ensamble · interlockShear 19,050 y 67±1; interlock en partición sin comerse la mejilla
- kazmer-c14-02 · Selección del metal por límite de fatiga, K del barreno y maquinado · molde-E1 molde-E11 materiales costo · filtro σ_fat ≥ 3P: P=200 → {A6,D2,H13}; P=80 incluye P20/4140; cost.ts cambia con la tasa
- kazmer-c4-09 · Selección del acero: difusividad, fatiga, Brinell y factores de costo · molde-E3 materials · f_making(P20)=f_operating(P20)=1; Al<1 ambos; SS420 operating≈1.8; H13 making > D2 > P20; Tabla 4.1 ABS 1M → {Cu,P20,SS420}; vidrio 1M → {H13}

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/fits.ts:interferenceFit (Tabla 12.1 literal)
- src/forja/mold/fasteners.ts · mold-fasteners.ts:fastenerPlan
- src/forja/mold/mold-interlocks.ts · mold-analysis.ts (cheek)
- src/forja/mold/moldbase.ts:MOLD_METALS (Apéndice B literal)

### `kazmer-s2-dfm-y-cotizacion` — La pieza se REVISA y se COTIZA: costillas por FEA, acabado por cara y complejidad del kernel

- sprint 5 · esfuerzo M · valor 3/5 · caps [2, 3] · depende de: mol-s2-intake
- OBJETIVO: Cerrar los huecos de caps 2-3: banco de costillas con FEA (+15 % material, +70 % ciclo), bosses con gussets, tolerancias ±0.4/±0.1 % en el plano con alarma vs E9, acabado por CARA (34 h), factor de complejidad de 4 piezas medido en el kernel; el resto del cotizador ya reproduce $74,800/$0.47.

## EJERCICIOS
- kazmer-c2-01 · Costilla eficiente 70 % / 4x / 10x con 2° de draft · croquis extruir patrón FEA-estático molde-E1 cotas · checkDFM sin errores §2.3.2; V(1.3t)/V(costillas)=1.15±0.03 (kernel); tc(1.3t)/tc(t)=1.69±0.05 Eq 9.5; FEA deflexión ±15 %
- kazmer-c2-02 · Tres diseños de boss con gussets (120° / 90° / libre) · croquis extruir patrón molde-E1 · checkDFM 0 errores §2.3.3 con boss ≤70 %; control negativo boss 100 % → 1 error
- kazmer-c2-03 · Filetes 150 %/50 % y chaflán ½ antes del shell · fillet chamfer shell molde-E1 sonda · Espesor en la esquina = t ±5 % (sonda); checkDFM §2.3.4 ok; esquina viva → error
- kazmer-c2-04 · Draft requerido por acabado y resina · draft molde-E1 cotas · draftForFinish reproduce las 5 filas; la sonda mide el ángulo en la cara = valor ±0.05°
- kazmer-c2-06 · Tolerancia general ±0.4 % y crítica ±0.1 % en el plano · plano2D cotas GD&T molde-E9 · Cota impresa = nominal×% exacto; >3 críticas o crítica < contracción alcanzable → alarma
- kazmer-c3-04 · Costo de acabado por zonas (B-3 + A-1 frontal) · molde-E2 selección-de-caras · ΣA_i/R_i = 34.3±0.3 h con áreas por cara del kernel; $1,700±20
- kazmer-c3-08 · Factor de complejidad de cuatro piezas medido en el kernel · masa-inercia molde-E2 croquis extruir · placa maciza f=1.00-1.05; bezel 2.5±0.1; monotonía f1<f2<f3<f4
- kazmer-c3-07 · Costo por pieza del bezel: molde, material, proceso, yield · molde-E2 molde-E12 · cycleTimeEstimate 13.5; moldingMachineRate(294,1.2)=50.1±0.2; partUSD∈[0.47,0.48]; veredicto SOBREDISEÑO si molde/pza > 3× material

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/dfm.ts:checkDFM,DRAFT_TABLE_214,draftForFinish
- src/forja/mold/moldcost-detailed.ts (EXACTO $74,800; FINISH_RATE único)
- mol-s2-intake (HECHO)
- scripts/mold-cost-test.cjs, mold-cost-detailed-test.cjs

### `kazmer-s9b-campo-termico-avanzado` — El calor por DONDE puede: convectivo, Cu 940 asimétrico, conformal y un solo lado

- sprint 5 · esfuerzo L · valor 3/5 · caps [9, 13] · depende de: kazmer-s9-agua-en-tu-molde
- OBJETIVO: Campo térmico más allá del cubo: FDM convectivo 1000 W/°C (24 s), core Cu 940 vs P20 (esquina 5→1 °C), inserto fresado con gasket y hélice conformal, flujo de calor a un lado (two-shot 75.6/13.5 s y la 2a capa 0.6·h1).

## EJERCICIOS
- kazmer-c9-02 · Regla 2·h² y frontera convectiva 1000 W/°C · molde-E8 térmico FDM-1D · coolingTimeRuleOfThumb(3)=18; tcSlabSeriesS 19.2±0.3; FDM Robin 1000 → 24±1.5
- kazmer-c9-08 · Core de Cu 940 vs P20: gradiente del core y esquina interior · molde-E8 FEA-térmico materiales · gradiente ≤0.45× P20; esquina 5±1 vs 1±0.5 °C
- kazmer-c9-10 · Inserto de core con canal fresado + gasket y conformal helicoidal · sweep hélice croquis corte ensamble molde-E8 FEA-térmico · un solo camino IN→OUT; distancia canal-superficie ≥2⌀; gradiente ≤1 °C
- kazmer-c9-12 · Flujo de calor por UN lado: two-shot ABS sobre PC · molde-E8 térmico planeación · tiempoUnSoloLado(3,ABS)=75.6±1; PC 13.5±0.5; la capa delgada va segunda
- kazmer-c13-02 · Multi-shot: segunda capa 40 % más delgada (flujo de calor a UN lado) · térmico molde-E8 molde-E1 · FDM adiabático: t_cool(0.6h1, un lado) ≈ t_cool(h1, dos lados) ±10 %
- kazmer-c9-03 · Calor a extraer y potencia por línea (vaso/tapa) · molde-E8 térmico masa · heatPerShotJ 20,900±100; Q_line 260±5; masa del kernel ±3 %

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/thermal-layers.ts:makeLayeredFDM (hC existe)
- src/forja/mold/thermal-series.ts:tcSlabSeriesS
- src/forja/mold/thermal-steady.ts · mold-thermal-fdm.ts
- src/forja/mold/lamina-nucleo-enfriamiento.ts:tiempoUnSoloLado (75.6 ✓)

### `kazmer-s10b-empaque-y-materiales` — El EMPAQUE que Moldflow ve: mapa s(x,y), 2 vs 4 compuertas y los 16 plásticos

- sprint 5 · esfuerzo XL · valor 3/5 · caps [10, 5, 14] · depende de: kazmer-s10-contraccion-y-alabeo, kazmer-s5-llenado-que-decide
- OBJETIVO: Extender el solver Hele-Shaw a la fase de empaque con decaimiento de presión para obtener s(x,y) del bezel (0.3/0.6/>1 %), comparar 2 vs 4 gates y perfil de empaque, y cargar los 16 plásticos del Apéndice A con oráculos internos (η0=WLF(T_mid), α=k/ρcp).

## EJERCICIOS
- kazmer-c10-06 · Mapa de contracción no uniforme: 2 vs 4 compuertas y perfil de empaque · molde-E4 molde-E9 empaque CFD-Hele-Shaw mapa · s(x,y): mediana 0.6±0.15, máx >0.9 en borde lejano; 4 gates baja máx ≥0.15 y media ≥0.05
- kazmer-c14-01 · Base de datos de 16 plásticos (Cross-WLF + Tait + contracción) con oráculo interno · materiales molde-E4 molde-E9 · por material: η0_WLF(T_mid) ±5 %; α ±2 %; ABS Tait 0.31 %
- kazmer-c5-07 · Contraste análisis a mano vs Moldflow MPI 5.1 del bezel · molde-E4 FAN benchmark · solver 3D (FAN/flowlen) del bezel: P ∈ [100,121] MPa; F_fill 486-570 kN; 0<ΔT<5 °C
- kazmer-c10-04 · Contracción anisotrópica del bezel en ABS 15 % GF · molde-E9 materiales escalado-anisotrópico · s=0.00352→0.00351; escalado X ×1/(1−0.0018), Y/Z ×1/(1−0.0035) medido en kernel
- kazmer-c10-08 · Semicristalino: acetal Delrin 500 contrae 3.5 % · molde-E9 materiales · specificVolume POM 0.77/0.69±0.01; s 3.5±0.2; bandera semicristalino

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/fan.ts:resolverLlenadoFAN (llena, no empaca)
- src/forja/mold/filling.ts:ABS_CROSS,PP_CROSS · shrinkage.ts:ABS_TAIT
- memoria N2b 'pvT sink para empaque' (DESPUES-DE-V1)

### `kazmer-s13-tecnologias-y-variantes` — Otros MOLDES: el árbol de la Fig 13.1, tres placas, split, reverse, rotating y stack

- sprint 6 · esfuerzo L · valor 3/5 · caps [13, 1, 6] · depende de: kazmer-s11b-side-actions-y-placas
- OBJETIVO: Selector de tecnología completo desde el intake con la lista de análisis a modificar, y las variantes de base con geometría: tres placas animado, split cavity con angle pins, reverse ejection, rotating core planetario y stack de 2 niveles; todas pasan el ciclo E2..E11 y cierran en el acta.

## EJERCICIOS
- kazmer-c13-01 · Selector de tecnología de molde (árbol Fig 13.1) · molde-E1 planeación · tabla de verdad: cada hoja alcanzable con su combinación; banco → two-plate/hot-runner; vaso con rosca → rotating
- kazmer-c6-10 · Molde de tres placas: apertura en 2 fases, stripper bolts y daylight · ensamble cinemática molde-E3 molde-E10 threeplate · threePlateLayout 308/250/558; daylightNeededMm(264,75)=339; moldOpeningVelocity(100)≈210; openingSequence sin colisiones
- kazmer-c13-10 · Split cavity del bolo: mitades, angle pins, gibs y cheek ≈ profundidad · molde-E10 ensamble cinemática molde-E11 molde-E8 · separación de mitades ≥ undercut+holgura; cheek CUMPLE V13.4; sin interferencia gibs↔pins
- kazmer-c13-11 · Reverse ejection: cavidad al móvil, core y expulsores al fijo · molde-E10 molde-E2 ensamble · base invertida pasa E2..E11 espejo; ninguna marca en cara 'estética' (visibilidad.ts)
- kazmer-c13-09 · Rotating core: hélice vs planetario para 64 tapas y anti-rotación · molde-E10 cinemática ensamble mecanismos · unscrewTurns/helixDrive coherentes; torque < capacidad; ≥1 feature anti-rotación
- kazmer-c13-03 · Stack mold de 2 niveles: mismo clamp, doble cavidades · molde-E2 molde-E6 dimensionado-máquina ensamble · machineSizing(2 niveles): clamp igual ±1 %, shot ×2, stack >; daylight check
- kazmer-c1-01 · Corte A-A del molde de dos placas con componentes rotulados · ensamble plano2D molde-E3 lamina-seccion · El ensamble contiene los 12 componentes por rol (mold-assembly) y el corte HLR los intersecta; 0 interferencias (collision.ts)
- kazmer-c13-18 · El acta: toda decisión aprobada con costos, beneficios y riesgos · planeación molde-E12 · estacion12Dado FIRMADO solo si todas las estaciones y decisiones completas; omitir una ⇒ INCOMPLETO

## YA-EXISTE (prueba de ausencia)
- src/forja/mold/moldtech.ts:chooseMoldTechnology (§13.9)
- src/forja/mold/threeplate.ts (308/250/558 ✓)
- src/forja/mold/unscrewing.ts:unscrewTurns,helixDrive
- src/forja/mold/mold-assembly.ts · lamina-seccion.ts (corte A-A)
- estacion12Dado (acta HECHA)

### `kazmer-s13b-procesos-especiales` — Procesos ESPECIALES (congelado): coinyección, gas, lost core, IML, wall-temp, Melt Flipper

- sprint 6 · esfuerzo XL · valor 1/5 · caps [13] · depende de: kazmer-s9b-campo-termico-avanzado, kazmer-s6-colada-por-presupuesto
- OBJETIVO: Extensiones de E4/E8/E9 con dos materiales o fases y control térmico de pared. Descriptivo en el libro, sin respuesta impresa reproducible salvo cifras sueltas; se declara congelado hasta que una pieza real lo pida.

## EJERCICIOS
- kazmer-c13-16 · Coinyección: meta-material por capas y llenar con el más viscoso · molde-E4 molde-E8 molde-E9 materiales · E4 con η máx; E8/E9 ponderados; resultados entre los puros
- kazmer-c13-12 · Gas/water assist: canales gruesos que guían el fluido · molde-E4 molde-E1 materiales · E4 con 2a fase: ≥90 % del hueco dentro del canal; SS420 si water
- kazmer-c13-14 · Lost core: el core Bi58/Sn42 (138 °C) como sumidero de calor · térmico molde-E8 ensamble · FDM con contacto: T_sup core <138 °C durante llenado+empaque
- kazmer-c13-15 · In-mold labeling: film 0.15 mm contra cortante y calor · molde-E4 térmico · τ_pared E4 < τ_adm; 1D funde la cara (T>T_nf) sin el espesor completo
- kazmer-c13-04 · Insulated runner: piel congelada de 6 mm en ⌀25 a 60 s · térmico molde-E6 · espesor congelado a 60 s = 6±1.5 mm
- kazmer-c13-05 · Pulsed cooling: energía y costo por ciclo de 100 kg de P20 · térmico molde-E6 costo · 10 MJ exacto; 2.78 kWh; $0.28-0.30 con masa del ensamble
- kazmer-c13-06 · Conduction heating: potencia entregada vs drenada · térmico circuito molde-E8 · R=ρL/A 450 μΩ; P=I²R 112.5; q 28 kW/m² ±3 %; 113<420
- kazmer-c13-13 · Desbalance térmico en runners simétricos (Melt Flipper) · molde-E5 CFD · flujo a 4 cav difiere >5 % sin flipper y <2 % con cambio de nivel

## YA-EXISTE (prueba de ausencia)
- nada en src/forja/mold (grep coinyec/gas.assist/lost.core/insulated/pulsed = 0)

## 5. Brechas vs Fusion / SolidWorks / Moldflow

| prioridad | brecha | el libro | la competencia |
|---|---|---|---|
| P0 | Partición NO plana automática (Parting Lines → Shut-off → Parting Surface → Tooling Split) | §4.1.3 loft con inclinación ≥5° y knit; §4.1.4 un shut-off por ventana | SolidWorks Mold Tools lo hace en 4 comandos (aún picando 87 aristas); Fusion Mold Design workspace; NX Mold Wizard. La Forja: splitNoPlano por pasos, sin loft ni knit |
| P0 | Cooling channel features con plugs/fittings y análisis de circuito por pieza | cap 9 completo: ⌀/profundidad/paso, ½⌀ de claro, tapones y manifold; Eq 12.19 para el barreno | NX/SolidWorks Mold Tools: cooling lines con O-rings y tapones de catálogo; Moldflow Cool: Re/ΔP por circuito. La Forja: solo el circuito del CUBO (E8b) |
| P1 | Simulación de empaque y mapa de contracción/alabeo | §10.2 Figs 10.8-10.12: s no uniforme 0.3/0.6/>1 %, 4 gates, perfil de empaque | Moldflow Pack+Warp, Moldex3D, SolidWorks Plastics. La Forja: fan.ts llena pero no empaca |
| P1 | Runner balance de molde familia y secciones reales (trapezoidal, anular) | §6.4.6 balanceo artificial cup+lid; §6.5.1 Dh Tabla 6.3, Eq 6.14-6.15 | Moldflow Runner Balance; SolidWorks Plastics runner design; Melt Flipper. La Forja: solo balance geométrico en serie |
| P1 | Librería paramétrica de compuertas, venteos y componentes de expulsión (sleeve, stripper, slides con gib/heel) | §7.2 geometrías de gate; §8.3 anatomía del venteo; §11.3 sleeve/stripper/slide | NX Mold Wizard, Cimatron, SolidWorks Toolbox DME/HASCO/Progressive: features paramétricos de catálogo. La Forja: cálculo sí, sólido no |
| P1 | Base de datos de materiales (miles de grados Cross-WLF/Tait) y metales con fatiga | Apéndice A 16 plásticos; Apéndice B 11 metales | Moldflow: miles de grados; SolidWorks Plastics DB. La Forja: ABS/PP y los 11 metales |
| P1 | FEA del molde completo (lado fijo, platinas) con contacto y core shift | §12.1.2 FEA 0.36 mm de apertura; §12.3.3 flexión del core | SolidWorks/Fusion Simulation genérico; Moldflow core shift acoplado. La Forja: mold-fea.ts solo B+soporte+rieles |
| P2 | Conformal cooling y variantes de base (stack, reverse, split) como ensambles | §9.3.3 SLS conformal; §13.6.2 stack; §13.9 split/reverse | Fusion/nTopology generativo para SLM; catálogos de stack molds. La Forja: nada |
| P0 | Lo que NINGUNA suite hace y el libro exige (foso de La Forja) | cotización causal cap 3, fuerza de expulsión cap 11, juez estructural cap 12 con δ<venteo, acta §13.10, selector de tecnología Fig 13.1 | Nadie: es know-how de mold shop. La Forja ya tiene E2/E10/E11/E12 para el cubo — la ventaja es hacerlo por PIEZA con evidencia |

## 6. Tramos faltantes, erratas y notas

- **Cobertura del texto:** los 3 tramos cubren el libro completo (caps 1-13 + apéndices A-F). No hay problemas de fin de capítulo: los ejercicios son los `Example:` inline y los casos de diseño sobre bezel/cup/lid/contenedor. Cap 1 y cap 13 casi sin números: sus ejercicios son casos con oráculo de invariante.
- **Ejercicios no asignados a superticket:** kazmer-c2-07, kazmer-c3-01, kazmer-c3-02, kazmer-c3-03, kazmer-c3-05, kazmer-c3-06, kazmer-c4-07, kazmer-c4-08, kazmer-c5-08, kazmer-c5-09, kazmer-c6-01, kazmer-c6-05, kazmer-c6-11, kazmer-c6-12, kazmer-c6-14, kazmer-c7-03, kazmer-c10-01, kazmer-c11-11, kazmer-c12-03, kazmer-c12-05, kazmer-c12-12, kazmer-c13-07, kazmer-c13-17 (se quedan en el catálogo: casi todos ya tienen 'si' con test en scripts/mold-*-test.cjs o son de valor ≤2; entran como regresión, no como sprint).
- **Erratas impresas que los oráculos DECLARAN (no corrigen en silencio):** Eq 3.7 Lcav 0.268 pero el volumen usa 0.264; t_c del sprue 26.7 s no reproduce (feed.ts:63 → 17.3); C_part $0.48 (p.60) vs $0.47 (p.66); p.203 runner ⌀6.25 en texto vs 0.00476 en la cuenta; p.253 sin(120/1050) debe ser 9050; p.267 cos(10°) con draft 1°; p.286 A_eff 80 mm² vs 725e-6; p.191 h_max 0.073 real vs 0.08 impreso; §12.1.1 endurance P20 450 vs 456 (Fig 12.5); p.339 'dowel 12.075' = 12.0075; ejemplo del pilar dice F/2 pero calcula con F.
- **Numeración duplicada del libro (citar por página):** dos Table 3.7, 3.11, 3.13, 6.2; Eq 3.14 usada dos veces.
- **Figuras que el texto no trae** (reconstruir del enunciado): Tabla 3.3 (4 piezas), Fig 4.4-4.16, 6.20-6.23, 7.2-7.17, 8.1-8.10, 9.9-9.17, 9.20-9.25, 10.8-10.12, 11.1-11.30, 12.7/12.10/12.14/12.20-12.34, todas las 13.x (patentes). Fig 4.25-4.27 y 5.9-5.10 solo como trazo → recomputar con Apéndice B / digitalizar.
- **INDICE-ANALISIS desactualizado** en: A-124 (Dh trapezoidal marca SÍ, grep = 0), A-125 (anillo PARCIAL, grep = 0). Corregir al abrir kazmer-s6.
- **Inconsistencias del repo a ordenar ANTES de kazmer-s9/s12:** dos K de barreno (cooling-design.ts Fig 9.4 3.3→2.6 vs lamina-vonmises.ts Eq 12.19 K≥3.1); dos H13 (cooling-design.ts 690 vs moldbase.ts 760 = Apéndice B); pinBuckling default K=2 vs 0.7 del libro (DESVIACIÓN DECLARADA, el 1.86 mm exige K explícito).
- **Unidades:** cap 3 en metros con Apéndices A/B/D; toneladas con 9800-9807 N/t (machinesizing 9806.65); ABS MG47 power-law k 17,070/n 0.348 (cap 5) vs 17,000/0.35 (cap 6+); Tait v en m³/kg.
- **Regla del proyecto (memoria Kazmer):** el libro = SOLO 4 ejemplos; cotas LITERALES; toda extensión DECLARADA; la unidad de trabajo es la PRUEBA (video + stills + oráculo) — cada superticket de arriba es una orden `ordenes/<fecha>-<slug>.md` con evidencia en `public/evidencia/<slug>/`.
