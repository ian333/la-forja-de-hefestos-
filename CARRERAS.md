# Mapeo Forja → Carreras IPN / UNAM

**Fecha**: 2026-05-12
**Objetivo**: Identificar qué carreras de licenciatura/ingeniería del IPN y la UNAM pueden cursarse parcial o totalmente con los módulos ya construidos en La Forja (`/home/ian/Orkesta/la-forja/src`).

## Inventario Forja (confirmado en repo)

### Química (`src/lib/chem/`, `src/labs/components/`)
- **Tabla periódica + orbitales hidrogenoides ψ_nlm** (`PeriodicTable.tsx`, `MultiElectronAtomView.tsx`, `lib/chem/quantum`)
- **9 moléculas canónicas con VSEPR y MOs**: H₂O, CH₄, NH₃, CO₂, C₂H₄, C₂H₂, HCl, NaCl, C₆H₆ (`MoleculeView.tsx`, `MoleculeOrbitalView.tsx`)
- **9 reacciones cinéticas Arrhenius + RK4 + stiff-solver**: N₂O₅, Haber-Bosch, neutralización HCl+NaOH, descomposición H₂O₂, combustión H₂/CH₄, Fe+CuSO₄, SN2, esterificación Fischer (`reactions.ts`, `kinetics.ts`, `reactors.ts`, `energy-balance.ts`)
- **IR/Raman**: Hessian + Jacobi + frecuencias NIST de H₂, HF, HCl, H₂O, CO₂
- **MD reactiva** con colisiones Arrhenius (`ParticleSandbox.tsx`, `GPUParticleSandbox.tsx`)
- **Fotólisis, compartimentos, balances** (`photolysis.ts`, `compartments.ts`)

### Física (`src/physics/modules/`, `src/lib/physics/`)
- **Astro**: `Schwarzschild.tsx`, `SolarSystem.tsx`
- **EM**: `Fields.tsx` (campos eléctricos/magnéticos con cargas configurables)
- **Mecánica**: `DoublePendulum.tsx`; **engranes** (`src/lib/parts/`: spur gear, planetary, geneva, slider-crank, escapement, involute-gear-sketch, gear-fillet con detección de interferencia)
- **Bio-física**: `ProteinViewer.tsx`, `DoubleHelix.tsx`, `CentralDogma.tsx` (transcripción + traducción reales), `AtomToBond.tsx`, `Docking.tsx` (Vina + Vinardo + Monte Carlo), `BiologyScales.tsx`
- **Nuclear** (`src/lib/physics/nuclear`): Bosch-Hale fusion (D-T, D-D, D-³He), Gamow, criterio Lawson
- **Colisiones, secciones eficaces, SDF, MC** (`collisions.ts`, `cross-section.ts`, `gpu-cross-section.ts`, `mc-worker.ts`)

### Matemáticas (`src/math/modules/`)
- **Cálculo**: `Derivative1D.tsx`, `RiemannIntegral.tsx`, `TangentPlane.tsx`, `TaylorSeries.tsx`, `VectorFields.tsx`
- **Complejo**: `MobiusRiemann.tsx`, `NewtonFractals.tsx`, `ConformalMaps.tsx`
- **EDO**: `PhasePortrait.tsx`
- **Álgebra lineal**: `Matrix3D.tsx`, `EigenVectors3D.tsx`, `PCA.tsx`, `Rotations.tsx`

### Ingeniería / CAD / ML
- OCCT-import-js (lectura STEP), exportación STL/blueprints, reverse-engineering, sketch-engine, perfiles-a-SDF
- Reservoir computing (RIAN integrado en `src/lib/rian/`)
- Theme/Forge stores, ForgeViewport (3D real, R3F + bloom)

---

## Carreras analizadas (16)

## Licenciatura en Química — UNAM (Facultad de Química)
**URL plan**: <https://escolar1.unam.mx/planes/f_quimica/Quim.pdf> · <https://quimica.unam.mx/ensenanza/licenciaturas/quimica/>
**Cobertura Forja**: ~55%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Álgebra Superior | — | falta |
| 1 | Cálculo I | math/calc/Derivative1D, RiemannIntegral | parcial — falta límites/continuidad |
| 1 | Física I | physics/mech/DoublePendulum + EM/Fields | parcial |
| 1 | Química General I | chem/PeriodicTable, AtomView, elements.ts | cubierto |
| 2 | Cálculo II | math/calc/TangentPlane, VectorFields | parcial |
| 2 | Física II | physics/em/Fields | cubierto |
| 2 | Estructura de la Materia | chem/quantum (ψ_nlm), MultiElectronAtomView | cubierto |
| 2 | Termodinámica | lib/chem/energy-balance | parcial — falta entropía formal |
| 2 | Química General II | chem/MoleculeView, MoleculeOrbitalView | cubierto |
| 3 | Ecuaciones Diferenciales | math/diffeq/PhasePortrait | parcial |
| 3 | Equilibrio y Cinética | chem/reactions.ts (9 reacciones + Arrhenius) | cubierto |
| 3 | Fundamentos de Espectroscopia | chem/quantum + Hessian/Jacobi/IR-Raman | cubierto |
| 3 | Química Inorgánica I | chem/elements + NaCl + redox Fe+CuSO₄ | parcial |
| 3 | Química Orgánica I | chem/molecules (CH₄, C₂H₄, C₂H₂, C₆H₆) | parcial — falta nomenclatura |
| 4 | Química Cuántica I | chem/quantum (orbitales hidrogenoides, MOs) | cubierto |
| 4 | Química Analítica I | chem/HCl+NaOH neutralización | parcial |
| 4 | Fisicoquímica Iónica/Electródica | — | falta |
| 4 | Química Inorgánica II | — | falta |
| 4 | Química Orgánica II | chem/Fischer esterificación, SN2 | parcial |
| 5-6 | Q. Analítica II/III, Q. Inorg III/IV, Q. Org III/IV | parcial vía MoleculeView | parcial |
| 6 | Cinética Química | chem/reactions + reactors.ts + RK4 | cubierto |
| 7 | Bioquímica General | physics/bio/CentralDogma, ProteinViewer | parcial |
| 7 | Q. Analítica Instrumental I (IR/UV/MS) | chem/IR-Raman (Hessian/Jacobi NIST) | parcial |
| 7 | Lab Unificado de Fisicoquímica | chem/ParticleSandbox, GPUParticleSandbox | cubierto |

**Faltantes críticos**:
1. Fisicoquímica electroquímica (celdas Galvánicas, Nernst)
2. Q. Analítica titulaciones cuantitativas + curvas de valoración
3. Q. Inorgánica de bloques d/f (compuestos de coordinación)
4. Espectroscopia UV-Vis y NMR (solo tenemos IR/Raman)
5. Termodinámica formal (potenciales termodinámicos, Maxwell)

---

## Ingeniería Química — UNAM (Facultad de Química)
**URL plan**: <https://escolares.quimica.unam.mx/planes2021/IQ-21.pdf> · <https://quimica.unam.mx/ensenanza/licenciaturas/ingenieria-quimica/>
**Cobertura Forja**: ~45%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Cálculo I + Álgebra | math/calc + linalg/Matrix3D | parcial |
| 1 | Química General I | chem/PeriodicTable, elements | cubierto |
| 1 | Física I (mecánica) | physics/mech | parcial |
| 2 | Termodinámica | chem/energy-balance | parcial |
| 2 | Estructura de la Materia | chem/quantum, MOs | cubierto |
| 3 | Balance de Materia y Energía | chem/reactors + compartments | parcial |
| 3-4 | Fenómenos de Transporte | — | falta (Navier-Stokes, conducción) |
| 4 | Cinética y Reactores | chem/kinetics + reactors + stiff-solver | cubierto |
| 5 | Operaciones de Separación (destilación) | — | falta |
| 6 | Diseño de Reactores | chem/reactors.ts | cubierto |
| 6-7 | Control de Procesos | — | falta |
| 7-8 | Diseño de Plantas / Equipos | OCCT/STEP-import (CAD) | parcial |

**Faltantes críticos**: fenómenos de transporte (momento, calor, masa), destilación/extracción, control PID, simulación Aspen-like.

---

## Ingeniería Química Industrial — IPN (ESIQIE)
**URL plan**: <https://www.ipn.mx/assets/files/ofertaEducativa/mapa-curricular/superior/escolarizado/Plan_IQI_2010.pdf> · <https://www.esiqie.ipn.mx/oferta-educativa/ver-carrera.html?lg=es&id=20>
**Cobertura Forja**: ~50%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Precálculo | math/calc | parcial |
| 1 | Química General | chem/PeriodicTable + elements | cubierto |
| 1 | Mecánica Clásica | physics/mech/DoublePendulum | parcial |
| 1 | Termodinámica Clásica | chem/energy-balance | parcial |
| 2 | Cálculo Diferencial e Integral | math/calc/Derivative1D, RiemannIntegral | cubierto |
| 2 | Electricidad y Magnetismo | physics/em/Fields | cubierto |
| 2 | Química de Soluciones | chem/HCl+NaOH | parcial |
| 3 | Probabilidad y Estadística | math/linalg/PCA | parcial |
| 3 | Balance de Materia y Energía | chem/reactors + energy-balance | cubierto |
| 3 | Ecuaciones Diferenciales | math/diffeq/PhasePortrait | parcial |
| 3 | Fundamentos de Fenómenos de Transporte | — | falta |
| 3 | Química de Hidrocarburos | chem/CH₄, C₂H₄, C₂H₂, C₆H₆ | cubierto |
| 4 | Métodos Numéricos | math + lib/stiff-solver + RK4 | cubierto |
| 4 | Flujo de Fluidos | — | falta |
| 5 | Cinética y Reactores Homogéneos | chem/reactions + reactors | cubierto |
| 5 | Transferencia de Calor | — | falta |
| 6 | Catálisis y Reactores Heterogéneos | chem/reactors + MD reactiva | parcial |
| 7-8 | Procesos de Separación, Diseño, Control | — | falta |

**Faltantes críticos**: igual a Ing. Química UNAM (transporte, separación, control).

---

## Licenciatura en Física — UNAM (Facultad de Ciencias)
**URL plan**: <https://oferta.unam.mx/planestudios/fisica-fciencias-planestudios17.pdf> · <https://www.fciencias.unam.mx/estudiar-en-ciencias/estudios/licenciaturas/fisica>
**Cobertura Forja**: ~65%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Física Contemporánea | chem/quantum + physics/nuclear (Bosch-Hale) | parcial |
| 1 | Álgebra | math/linalg/Matrix3D, Rotations | cubierto |
| 1 | Geometría Analítica I | math/calc/TangentPlane | parcial |
| 1 | Cálculo Diferencial e Integral I | math/calc/Derivative1D, RiemannIntegral | cubierto |
| 1 | Computación | (TS/React stack del propio repo) | parcial |
| 2 | Mecánica Vectorial | physics/mech + math/calc/VectorFields | cubierto |
| 2 | Laboratorio de Mecánica | physics/mech/DoublePendulum + engranes | cubierto |
| 2 | Cálculo Diferencial e Integral II | math/calc | cubierto |
| 3 | Fenómenos Colectivos | chem/ParticleSandbox, GPUParticleSandbox | cubierto |
| 3 | Álgebra Lineal I | math/linalg/EigenVectors3D, PCA, Matrix3D | cubierto |
| 3 | Cálculo Diferencial e Integral III | math/calc/TangentPlane, VectorFields | cubierto |
| 4 | Electromagnetismo I | physics/em/Fields | cubierto |
| 4 | Lab de Electromagnetismo | physics/em/Fields (cargas configurables) | cubierto |
| 4 | Ecuaciones Diferenciales I | math/diffeq/PhasePortrait | parcial |
| 4 | Cálculo Diferencial e Integral IV | math/calc/VectorFields | cubierto |
| 5 | Introducción a la Física Cuántica | chem/quantum (ψ_nlm, MOs) | cubierto |
| 5 | Óptica | — | falta |
| 5 | Variable Compleja I | math/complex/MobiusRiemann, ConformalMaps, NewtonFractals | cubierto |
| 6 | Mecánica Analítica | physics/mech/DoublePendulum (Lagrangiano) | parcial |
| 6 | Termodinámica | chem/energy-balance | parcial |
| 6 | Relatividad | physics/astro/Schwarzschild | cubierto |
| 7 | Electromagnetismo II | physics/em/Fields | parcial |
| 7 | Mecánica Cuántica | chem/quantum + orbitales | parcial |
| 7 | Física Computacional | lib/stiff-solver, RK4, mc-worker, sdf-engine | cubierto |
| 8 | Física Estadística | chem/ParticleSandbox + MD reactiva | parcial |
| 9 | Física Nuclear y Subnuclear | physics/nuclear (Bosch-Hale, Gamow, Lawson) | cubierto |

**Faltantes críticos**: Óptica (difracción, polarización), Mecánica Cuántica formal (operadores/Dirac), Materia Condensada, Lab de Electrónica.

---

## Licenciatura en Física y Matemáticas — IPN (ESFM)
**URL plan**: <https://www.ipn.mx/assets/files/ofertaEducativa/mapa-curricular/superior/escolarizado/licenciatura-en-fisica-y-matematicas.pdf> · <https://www.esfm.ipn.mx/oferta-educativa/ver-carrera.html?lg=es&id=30>
**Cobertura Forja**: ~62%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Álgebra I | math/linalg/Matrix3D | parcial |
| 1 | Geometría Analítica | math/calc/TangentPlane | parcial |
| 1 | Cálculo I | math/calc/Derivative1D, RiemannIntegral | cubierto |
| 1 | Física I | physics/mech + em/Fields | cubierto |
| 2 | Cálculo II | math/calc | cubierto |
| 2 | Álgebra II / Lineal | math/linalg/EigenVectors3D, Rotations, PCA | cubierto |
| 2 | Física II (EM) | physics/em/Fields | cubierto |
| 2 | Análisis Vectorial | math/calc/VectorFields | cubierto |
| 3 | Ecuaciones Diferenciales | math/diffeq/PhasePortrait | parcial |
| 3 | Análisis Real (rama Mate) | — | falta |
| 3 | Mecánica Clásica | physics/mech/DoublePendulum | parcial |
| 4 | Variable Compleja | math/complex/MobiusRiemann, Conformal, Newton | cubierto |
| 4 | Mecánica Analítica | physics/mech + math/calc | parcial |
| 4 | Métodos Matemáticos de la Física | math/calc/TaylorSeries + diffeq | parcial |
| 5 | Mecánica Cuántica | chem/quantum (ψ_nlm) | parcial |
| 5 | Termodinámica/Física Estadística | chem/ParticleSandbox + energy-balance | parcial |
| 5 | Electromagnetismo II | physics/em/Fields | parcial |
| 6+ | Estado Sólido, Atómica, Nuclear | physics/nuclear (Bosch-Hale, Gamow) | parcial |

**Faltantes críticos**: Análisis real/funcional, Topología, Álgebra moderna (grupos/anillos), Mecánica Cuántica avanzada, Estado Sólido.

---

## Licenciatura en Matemáticas — UNAM (Facultad de Ciencias)
**URL plan**: <https://escolar1.unam.mx/planes/f_ciencias/Matematicas.pdf> · <https://www.fciencias.unam.mx/estudiar-en-ciencias/estudios/licenciaturas/matematicas>
**Cobertura Forja**: ~35%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Cálculo Diferencial e Integral I | math/calc/Derivative1D, RiemannIntegral | cubierto |
| 1 | Álgebra Superior I | — | falta |
| 1 | Geometría Analítica I | math/calc/TangentPlane | parcial |
| 1 | Geometría Moderna I | — | falta |
| 2 | Cálculo Diferencial e Integral II | math/calc | cubierto |
| 2 | Álgebra Superior II | — | falta |
| 2 | Geometría Analítica II | math/linalg/Rotations + Matrix3D | parcial |
| 3 | Cálculo III | math/calc/TangentPlane, VectorFields | cubierto |
| 3 | Álgebra Lineal I | math/linalg/EigenVectors3D, Matrix3D, PCA | cubierto |
| 4 | Cálculo IV | math/calc/VectorFields | cubierto |
| 4 | Álgebra Lineal II | math/linalg/EigenVectors3D | parcial |
| 4 | Ecuaciones Diferenciales I | math/diffeq/PhasePortrait | parcial |
| 5 | Análisis Matemático I | — | falta |
| 5 | Álgebra Moderna I | — | falta |
| 5 | Variable Compleja I | math/complex/MobiusRiemann, Conformal, NewtonFractals | cubierto |
| 6-8 | Topología, Análisis II, Teoría de la Medida | — | falta |

**Faltantes críticos**: Álgebra moderna (grupos, anillos, cuerpos), Análisis real (Lebesgue), Topología general, Teoría de números, Lógica matemática.

---

## Licenciatura en Matemáticas Aplicadas — UNAM (Facultad de Ciencias)
**URL plan**: <https://oferta.unam.mx/planestudios/matematicasaplicadasplanestudiosfciencias.pdf> · <https://www.fciencias.unam.mx/estudiar-en-ciencias/estudios/licenciaturas/maplicadas>
**Cobertura Forja**: ~55%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1-2 | Cálculo I-II, Álgebra Lineal | math/calc + linalg/Matrix3D, EigenVectors3D | cubierto |
| 3 | Probabilidad | math/linalg/PCA + RIAN | parcial |
| 3 | Cálculo III + EDO | math/calc + diffeq/PhasePortrait | cubierto |
| 4 | Análisis Numérico | lib/stiff-solver, RK4, sdf-engine | cubierto |
| 4 | Variable Compleja | math/complex/MobiusRiemann, Conformal | cubierto |
| 5 | EDP | math/calc/VectorFields | parcial |
| 5-6 | Modelos Matemáticos | physics/mech, chem/reactors | cubierto |
| 6 | Optimización | lib/sketch-fitting + reverse-engineer | parcial |
| 6 | Investigación de Operaciones | — | falta |
| 7-8 | Aprendizaje Estadístico / ML | lib/rian (reservoir computing) | parcial |

**Faltantes críticos**: EDP formales (separación de variables, transformadas), Optimización convexa, Series temporales, Análisis funcional aplicado.

---

## Licenciatura en Actuaría — UNAM (Facultad de Ciencias)
**URL plan**: <https://oferta.unam.mx/planestudios/actuaria-fciencias-planestudios17.pdf> · <https://www.fciencias.unam.mx/estudiar-en-ciencias/estudios/licenciaturas/actuaria>
**Cobertura Forja**: ~25%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Cálculo I | math/calc/Derivative1D, RiemannIntegral | cubierto |
| 1 | Álgebra Superior I | — | falta |
| 1 | Algoritmos y Programación | (stack TS del repo) | parcial |
| 2 | Cálculo II | math/calc | cubierto |
| 2 | Bases de Datos | — | falta |
| 3 | Cálculo III | math/calc/TangentPlane | cubierto |
| 3 | Álgebra Lineal I | math/linalg/Matrix3D, EigenVectors3D | cubierto |
| 3 | Probabilidad I | — | falta (no hay módulo formal) |
| 4 | Cálculo IV | math/calc/VectorFields | cubierto |
| 4 | Estadística I | math/linalg/PCA | parcial |
| 5+ | Ecuaciones Dif, Probabilidad II, Estadística II, Mate Actuariales, Finanzas | math/diffeq | parcial |
| 6-8 | Riesgo, Pensiones, Seguros, Demografía | — | falta |

**Faltantes críticos**: Probabilidad axiomática + variables aleatorias, Estadística inferencial, Procesos estocásticos, Mate financieras, Tablas de mortalidad.

---

## Licenciatura en Ciencias de la Computación — UNAM (Facultad de Ciencias)
**URL plan**: <https://oferta.unam.mx/planestudios/cienciascomputacion-fciencias-planestudios17.pdf> · <https://www.fciencias.unam.mx/estudiar-en-ciencias/estudios/licenciaturas/ccomputacion>
**Cobertura Forja**: ~30%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Álgebra Superior I | — | falta |
| 1 | Estructuras Discretas | — | falta |
| 1 | Mate para C. Aplicadas I | math/calc | cubierto |
| 1 | Intro a Ciencias de la Computación | (stack del repo) | parcial |
| 2 | Estructuras de Datos | — | falta |
| 2 | Gráficas y Juegos | lib/ForgeViewport, R3F | parcial |
| 3 | Álgebra Lineal I | math/linalg/Matrix3D, EigenVectors3D | cubierto |
| 3 | Probabilidad I | — | falta |
| 4 | Autómatas y Lenguajes Formales | — | falta |
| 5 | Análisis de Algoritmos | — | falta |
| 6 | Inteligencia Artificial | lib/rian (reservoir) + lib/mc-worker | parcial |
| 6 | Sistemas Operativos | — | falta |
| 7-8 | Compiladores, Redes, Criptografía | — | falta |

**Faltantes críticos**: Estructuras de datos, Algoritmos clásicos, Lógica computacional, Compiladores, Sistemas operativos.

---

## Ingeniería Mecatrónica — UNAM (Facultad de Ingeniería)
**URL plan**: <https://www.ingenieria.unam.mx/programas_academicos/licenciatura/mecatronica_plan2023.php> · <https://oferta.unam.mx/planestudios/ingmecatronicaplanestudiosfacing13.pdf>
**Cobertura Forja**: ~55%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Álgebra | math/linalg/Matrix3D | parcial |
| 1 | Cálculo Diferencial | math/calc/Derivative1D | cubierto |
| 1 | Geometría Analítica | math/calc/TangentPlane | parcial |
| 1 | Computación para Ingenieros | (stack) | parcial |
| 2 | Álgebra Lineal | math/linalg/EigenVectors3D, Rotations | cubierto |
| 2 | Cálculo Integral | math/calc/RiemannIntegral | cubierto |
| 2 | Estática | physics/mech | parcial |
| 3 | Ecuaciones Diferenciales | math/diffeq/PhasePortrait | parcial |
| 3 | Cálculo Vectorial | math/calc/VectorFields, TangentPlane | cubierto |
| 3 | Cinemática y Dinámica | physics/mech/DoublePendulum + engranes | cubierto |
| 3 | Termodinámica | chem/energy-balance | parcial |
| 3 | Dibujo Mecánico e Industrial | lib/sketch-engine, OCCT/STEP-import | cubierto |
| 4 | Electricidad y Magnetismo | physics/em/Fields | cubierto |
| 4 | Análisis Numérico | lib/stiff-solver, RK4 | cubierto |
| 4 | Probabilidad y Estadística | math/linalg/PCA | parcial |
| 5 | Mecánica de Sólidos | lib/parts (gear-fillet interferencia) | parcial |
| 5 | Mecánica de Fluidos I | — | falta |
| 5 | Ingeniería de Materiales | — | falta |
| 6 | Mecanismos | lib/parts (geneva, slider-crank, planetary, escapement) | cubierto |
| 6 | Modelado de Sistemas Físicos | physics/mech + math/diffeq | cubierto |
| 7 | Diseño de Elementos de Máquinas | lib/parts/involute-gear-sketch + gear-fillet | cubierto |
| 7 | Circuitos Digitales | — | falta |
| 8 | Control Automático | math/diffeq/PhasePortrait | parcial |
| 8 | CAD/CAM | OCCT-import + STL-export + sketch-engine | cubierto |
| 9 | Diseño Mecatrónico | lib/parts + ForgeViewport + reverse-engineer | cubierto |
| 9 | Robótica | math/linalg/Rotations + physics/mech | parcial |

**Faltantes críticos**: Mecánica de fluidos, Circuitos digitales, Sistemas embebidos, Control PID, Visión por computadora.

---

## Ingeniería Mecánica — UNAM (Facultad de Ingeniería)
**URL plan**: <https://www.ingenieria.unam.mx/programas_academicos/licenciatura/mecanica.php> · <https://oferta.unam.mx/planestudios/ingmecanicaplanestudiosfacing13.pdf>
**Cobertura Forja**: ~55%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Álgebra, Cálculo Dif, Geo. Analítica | math/calc + math/linalg | cubierto |
| 2 | Álgebra Lineal, Cálculo Int | math/linalg/EigenVectors3D + math/calc/RiemannIntegral | cubierto |
| 2 | Estática | physics/mech | parcial |
| 3 | Ecuaciones Dif, Cálculo Vec, Cinem. y Din. | math + physics/mech + lib/parts | cubierto |
| 3 | Termodinámica | chem/energy-balance | parcial |
| 4 | Termodinámica Aplicada | — | falta |
| 4 | Electricidad y Magnetismo | physics/em/Fields | cubierto |
| 5 | Mecánica de Materiales | lib/parts (gear-fillet) | parcial |
| 5 | Mecánica de Fluidos | — | falta |
| 6 | Ciencia de Materiales | chem/elements (parcial) | parcial |
| 6 | Mecanismos | lib/parts (todos: spur, planetary, geneva, slider-crank, escapement) | cubierto |
| 7 | Diseño de Elementos de Máquinas | lib/parts/involute-gear-sketch + gear-fillet (interferencia) | cubierto |
| 7 | Transferencia de Calor | — | falta |
| 8 | Manufactura | OCCT-import (STEP) + STL-export | parcial |
| 8 | CAD | ForgeViewport + sketch-engine | cubierto |
| 9 | Diseño de Máquinas / Proyecto | reverse-engineer + feature-recognition + parts | cubierto |

**Faltantes críticos**: Mecánica de fluidos (CFD), Transferencia de calor, Procesos de manufactura, Vibraciones mecánicas.

---

## Licenciatura en Biología — UNAM (Facultad de Ciencias)
**URL plan**: <http://oferta.unam.mx/planestudios/biologia-fciencias-planestudios16.pdf> · <https://www.fciencias.unam.mx/estudiar-en-ciencias/estudios/licenciaturas/biologia>
**Cobertura Forja**: ~35%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Matemáticas I | math/calc/Derivative1D | parcial |
| 1 | Física | physics/mech + em/Fields | parcial |
| 1 | Química | chem/PeriodicTable, MoleculeView | cubierto |
| 1 | Biología de Procariontes | physics/bio/CentralDogma (procariota) | parcial |
| 2 | Química Orgánica | chem/CH₄, C₂H₄, C₂H₂, C₆H₆ | parcial |
| 2 | Biología Molecular de la Célula I | physics/bio/CentralDogma + DoubleHelix | cubierto |
| 2 | Matemáticas II | math/calc/RiemannIntegral | parcial |
| 3 | Biología Molecular de la Célula II | physics/bio/CentralDogma + ProteinViewer + AtomToBond | cubierto |
| 3 | Bioestadística | math/linalg/PCA | parcial |
| 4 | Biología Molecular de la Célula III | physics/bio + Docking | parcial |
| 5 | Genética I | physics/bio/DoubleHelix + CentralDogma | parcial |
| 6 | Biotecnología I | physics/bio/Docking (Vina+Vinardo+MC) | parcial |
| 7-8 | Evolución, Ecología, Talleres | — | falta |

**Faltantes críticos**: Ecología cuantitativa, Sistemática filogenética, Fisiología comparada, Microbiología experimental.

---

## Licenciatura en Ciencias Genómicas — UNAM (LCG/ENES Juriquilla)
**URL plan**: <https://www.lcg.unam.mx/plan-de-estudios/> · <https://intranet.lcg.unam.mx/materias.html> · <https://oferta.unam.mx/planestudios/ciengeno-ccgenomicas-planestudios14.pdf>
**Cobertura Forja**: ~60%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Matemáticas 1 (Discretas) | — | falta |
| 1 | Principios de Programación | (stack del repo) | parcial |
| 1 | Biología Celular | physics/bio/AtomToBond + BiologyScales | parcial |
| 1 | Bioquímica | chem/molecules + physics/bio | parcial |
| 1 | Biología Molecular | physics/bio/CentralDogma + DoubleHelix | cubierto |
| 2 | Matemáticas 2 (Álgebra Lineal) | math/linalg/Matrix3D, EigenVectors3D, PCA | cubierto |
| 2 | Computación | (stack) | parcial |
| 2 | Principios de Estadística | math/linalg/PCA | parcial |
| 2 | Genética | physics/bio/CentralDogma + DoubleHelix | cubierto |
| 2 | Principios de Evolución | — | falta |
| 3 | Matemáticas 3 (Cálculo) | math/calc/Derivative1D, RiemannIntegral | cubierto |
| 3 | Bioinformática y Estadística 1 | physics/bio/Docking + lib/rian | parcial |
| 3 | Genómica Funcional 1 | physics/bio/CentralDogma | parcial |
| 3 | Genómica Evolutiva 1 | — | falta |
| 3 | Modelos Genómicos | physics/bio (humano implícito) | parcial |
| 4 | Matemáticas 4 (EDO) | math/diffeq/PhasePortrait | parcial |
| 4 | Bioinformática y Estadística 2 | physics/bio/Docking (Vina/Vinardo/MC) | cubierto |
| 4 | Genómica Humana | physics/bio/CentralDogma | parcial |
| 5-6 | Fronteras / Aplicaciones de Genómica | physics/bio/Docking + ProteinViewer | parcial |
| 7-8 | Tesis / Investigación | (todo el stack) | parcial |

**Faltantes críticos**: Matemáticas discretas, Alineamiento de secuencias (BLAST/HMMER), Análisis filogenético formal, RNA-seq, Single-cell genomics.

---

## QFB (Química Farmacéutico Biológica) — UNAM (Facultad de Química)
**URL plan**: <https://escolar1.unam.mx/planes/f_quimica/QFB.pdf> · <https://quimica.unam.mx/ensenanza/licenciaturas/quimica-farmaceutico-biologica/>
**Cobertura Forja**: ~45%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Cálculo I, Álgebra Superior | math/calc + linalg/Matrix3D | parcial |
| 1 | Física I, Química General I | physics/mech + chem/PeriodicTable | cubierto |
| 2 | Estructura de la Materia | chem/quantum (orbitales) + MultiElectronAtomView | cubierto |
| 2 | Termodinámica | chem/energy-balance | parcial |
| 2 | Biología Celular | physics/bio/AtomToBond, BiologyScales | parcial |
| 3 | Fisiología | physics/bio/CentralDogma | parcial |
| 3 | Equilibrio y Cinética | chem/reactions + kinetics | cubierto |
| 3 | Química Inorgánica I, Orgánica I | chem/molecules (canónicas) | parcial |
| 4 | Q. Analítica I | chem/HCl+NaOH | parcial |
| 4 | Farmacología I | physics/bio/Docking | parcial |
| 4 | Microbiología General | physics/bio/CentralDogma (procariota) | parcial |
| 5 | Bioquímica | physics/bio + chem/molecules | cubierto |
| 5 | Q. Orgánica III, Analítica II, Farmacología II | chem + Docking | parcial |
| 6 | Genética y Biología Molecular | physics/bio/CentralDogma + DoubleHelix | cubierto |
| 6 | Toxicología | physics/bio/Docking | parcial |
| 7 | Análisis de Medicamentos | chem/IR-Raman (NIST) | parcial |
| 7 | Biofarmacia | physics/bio + chem/compartments | parcial |
| 8 | Introducción a la Genómica | physics/bio/CentralDogma | parcial |
| 8 | Bioquímica Clínica | — | falta |

**Faltantes críticos**: Farmacocinética/PK, Diseño racional de fármacos, Microbiología clínica, Inmunología, Bioquímica clínica diagnóstica.

---

## Ingeniería Bioquímica — IPN (ENCB)
**URL plan**: <https://www.ipn.mx/assets/files/ofertaEducativa/mapa-curricular/superior/escolarizado/ENCB-P-2018-Ingenier%C3%ADa-Bioqu%C3%ADmica.pdf> · <https://www.encb.ipn.mx/assets/files/encb/docs/licenciatura/ibq/plan/plan-2019-ibq.pdf>
**Cobertura Forja**: ~50%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Cálculo Diferencial e Integral | math/calc | cubierto |
| 1 | Química Inorgánica | chem/PeriodicTable + elements | cubierto |
| 1 | Biología Celular y Ecosistemas | physics/bio + BiologyScales | parcial |
| 1 | Física General | physics/mech + em/Fields | cubierto |
| 2 | Cálculo Vectorial | math/calc/VectorFields + TangentPlane | cubierto |
| 2 | Química Orgánica | chem/molecules canónicas | parcial |
| 2 | Principios de Fisicoquímica | chem/energy-balance + reactions | parcial |
| 2 | Bioestadística | math/linalg/PCA | parcial |
| 3 | Bioquímica | physics/bio + chem | cubierto |
| 3 | Ecuaciones Diferenciales | math/diffeq/PhasePortrait | parcial |
| 3 | Ing. Termodinámica + Balances | chem/energy-balance + reactors | cubierto |
| 4 | Q. Analítica, Métodos Numéricos | chem + lib/stiff-solver, RK4 | cubierto |
| 4 | Operaciones Transf. de Momento | — | falta |
| 5 | Bioquímica Metabolismo Microbiano | physics/bio/CentralDogma | parcial |
| 5 | Transferencia de Calor | — | falta |
| 6 | Genética Molecular | physics/bio/CentralDogma + DoubleHelix | cubierto |
| 6 | Ingeniería de Biorreacción | chem/reactors + kinetics | cubierto |
| 7-9 | Procesos Biotecnológicos, Diseño Bioplantas | — | falta |

**Faltantes críticos**: Fenómenos de transporte aplicados a bioreactores, Diseño de bioplantas, Tecnología de alimentos, Microbiología industrial.

---

## Ingeniería Biotecnológica — IPN (UPIBI)
**URL plan**: <https://www.upibi.ipn.mx/assets/files/upibi/docs/Estudiantes/Gesti%C3%B3n%20Escolar/plandeestudiosdeingenieriabiotecnologica.pdf>
**Cobertura Forja**: ~45%
Muy similar a IBQ ENCB. Cubre: matemáticas básicas, química general/orgánica, bioquímica, biología molecular, fisicoquímica, ingeniería de bioprocesos en niveles 1-4. Forja cubre la parte de fundamentos (química canónica, ψ_nlm, CentralDogma, Docking) pero falta la parte fuerte de ingeniería de procesos (transporte, control, escalamiento, downstream).

**Faltantes críticos**: idem IBQ; además Fermentaciones industriales, Downstream processing.

---

## Ingeniería en Sistemas Biomédicos — UNAM (Facultad de Ingeniería)
**URL plan**: <https://www.ingenieria.unam.mx/programas_academicos/licenciatura/sistemas_biomedicos.php> · <https://oferta.unam.mx/planestudios/ingenieriaensistemasbiomedicos-plan-de-estudios.pdf>
**Cobertura Forja**: ~50%
| Semestre | Materia | Módulo Forja | Estado |
|---|---|---|---|
| 1 | Álgebra, Cálculo y Geo. Analítica | math/calc + linalg | cubierto |
| 1 | Fundamentos de Programación | (stack TS/React) | parcial |
| 1 | Química | chem/PeriodicTable + MoleculeView | cubierto |
| 2 | Álgebra Lineal, Cálculo Integral | math/linalg + math/calc | cubierto |
| 2 | Estática | physics/mech | parcial |
| 2 | Manufactura I | OCCT/STEP-import + STL-export | parcial |
| 3 | Bioquímica | chem/molecules + physics/bio | cubierto |
| 3 | Cálculo Vectorial, Cinem. y Dinámica | math/calc + physics/mech | cubierto |
| 3 | Ecuaciones Diferenciales | math/diffeq/PhasePortrait | parcial |
| 3 | Dibujo Mecánico Industrial | lib/sketch-engine + ForgeViewport | cubierto |
| 4 | Biología Celular y Tisular | physics/bio/AtomToBond + BiologyScales | parcial |
| 4 | Electricidad y Magnetismo | physics/em/Fields | cubierto |
| 4 | Análisis Numérico, Termodinámica | lib/stiff-solver + chem/energy-balance | cubierto |
| 5 | Análisis de Circuitos | physics/em/Fields | parcial |
| 5 | Anatomía y Fisiología I-II | physics/bio (limitado) | parcial |
| 5 | Estadística | math/linalg/PCA | parcial |
| 5 | Ingeniería de Materiales | — | falta |
| 6 | Electrónica Básica | — | falta |
| 6 | Mecánica de Sólidos | lib/parts/gear-fillet | parcial |
| 7-8 | Instrumentación Biomédica, Imagen Médica | — | falta |

**Faltantes críticos**: Anatomía/Fisiología detallada, Instrumentación biomédica (ECG, EEG), Imagen médica (CT/MRI), Biomateriales, Bioética clínica.

---

## Síntesis Global

### TOP 10 carreras donde Forja cubre >50%

| # | Carrera | Universidad | Cobertura |
|---|---|---|---|
| 1 | Licenciatura en Física | UNAM Fac. Ciencias | ~65% |
| 2 | Licenciatura en Física y Matemáticas | IPN ESFM | ~62% |
| 3 | Licenciatura en Ciencias Genómicas | UNAM LCG | ~60% |
| 4 | Licenciatura en Química | UNAM Fac. Química | ~55% |
| 5 | Licenciatura en Matemáticas Aplicadas | UNAM Fac. Ciencias | ~55% |
| 6 | Ingeniería Mecánica | UNAM Fac. Ingeniería | ~55% |
| 7 | Ingeniería Mecatrónica | UNAM Fac. Ingeniería | ~55% |
| 8 | Ingeniería Química Industrial | IPN ESIQIE | ~50% |
| 9 | Ingeniería Bioquímica | IPN ENCB | ~50% |
| 10 | Ingeniería en Sistemas Biomédicos | UNAM Fac. Ing. | ~50% |

(Justo abajo: QFB UNAM 45%, Ing. Química UNAM 45%, Ing. Biotecnológica IPN 45%, Lic. Matemáticas UNAM 35%, Biología UNAM 35%, Ciencias Computación UNAM 30%, Actuaría UNAM 25%.)

### TOP 10 materias faltantes que abrirían más carreras

Ordenadas por cuántas de las 16 carreras se desbloquean al construir cada módulo:

1. **Fenómenos de Transporte (momento + calor + masa)** — desbloquea Ing. Química UNAM, ESIQIE IPN, Ing. Bioquímica IPN, Biotecnología UPIBI, Ing. Mecánica, Ing. Mecatrónica, Ing. Biomédica (7 carreras).
2. **Probabilidad axiomática + variables aleatorias + Estadística inferencial** — Actuaría, C. Computación, Ciencias Genómicas, Bioestadística para Biología/QFB/IBQ (7+ carreras).
3. **Análisis Real (sucesiones, series, Lebesgue) + Topología** — Lic. Matemáticas UNAM, ESFM IPN, Mate Aplicadas (3, pero crítico para profundizar).
4. **Álgebra Moderna (grupos, anillos, cuerpos)** — Lic. Matemáticas UNAM, ESFM IPN (2, pero base para criptografía y geometría algebraica).
5. **Estructuras de Datos + Algoritmos clásicos** — C. Computación UNAM, Actuaría, Ciencias Genómicas, Bioinformática (4+).
6. **Mecánica Cuántica formal (operadores, Dirac, Heisenberg)** — Física UNAM, ESFM IPN, Q. Cuántica de Química UNAM (3, profundiza lo que hay).
7. **Óptica (difracción, polarización, interferencia)** — Física UNAM, ESFM IPN, Ing. Biomédica imagen (3).
8. **Control Automático (PID, espacio de estados, Bode/Nyquist)** — Mecatrónica, Mecánica, Ing. Química procesos, Biomédica (4).
9. **Electrónica analógica + digital (BJT, opamps, lógica combinacional)** — Mecatrónica, Eléctrica, Biomédica, ESIME IPN (4).
10. **Termodinámica formal (entropía, potenciales, Maxwell, ciclos)** — Química UNAM, QFB, Ing. Química UNAM, ESIQIE, Mecánica, Mecatrónica, IBQ (7+).

(Mención honorífica: **alineamiento de secuencias / BLAST / HMMER** desbloquea de golpe Ciencias Genómicas, Biotecnología y Biología cuando complementa lo que ya tenemos en `physics/bio/CentralDogma`.)

### Hipótesis sobre estructura del portal

1. **Por carrera (vertical)** — Ruta "Soy estudiante de Ing. Mecatrónica UNAM, sem 3": el portal arma un dashboard con `Cinemática y Dinámica → physics/mech + lib/parts`, `EDO → math/diffeq`, `Cálculo Vec → math/calc/VectorFields`. Ventaja: máxima motivación, el usuario ve "se cubre el 55% de mi semestre". Desventaja: requiere mantener mapeos por institución que cambian con cada plan.

2. **Por materia (horizontal)** — Ruta "Hoy quiero entender Cinética Química": el portal lleva directo al módulo `chem/reactions` con las 9 reacciones canónicas y tabs de teoría/sandbox/quiz. Ventaja: composable, escala por temas, agnóstico a la institución. Desventaja: pierde el "gancho" de "esta es tu carrera".

3. **Por tema/concepto (red)** — Ruta tipo grafo: nodos = conceptos (Arrhenius, VSEPR, eigenvectores, Lagrangiano, transcripción), aristas = prerrequisitos. El usuario navega un mapa de "qué cosa lleva a qué", con módulos Forja anclados a nodos. Ventaja: refleja cómo de verdad se conecta el conocimiento (un módulo de Arrhenius sirve a Q. UNAM y a IBQ IPN sin duplicar). Desventaja: requiere curación pesada y onboarding.

**Recomendación de arranque**: capa **Por materia** primero (canónica, lo que ya está); encima una **vista Por carrera** que sea solo un filtro/playlist (cards "Tu plan: Física UNAM sem 3" → links a las materias). La capa **Por tema** sigue al final cuando el catálogo crezca: es la que más diferencia a Forja de Coursera/edX.

### Hallazgos clave

- La química canónica de Forja (orbitales, 9 moléculas, 9 reacciones, IR/Raman) es lo más completo que tenemos: cubre íntegramente Q. Cuántica I, Equilibrio y Cinética y Estructura de la Materia. Es el módulo que más carreras toca.
- El cuello de botella para abrir ingenierías de proceso (Química UNAM, ESIQIE, IBQ, Biotec) es **Fenómenos de Transporte**. Un solo módulo nuevo (Navier-Stokes + conducción + difusión) destraba ~7 carreras de golpe.
- Las dos licenciaturas con mayor cobertura inmediata son **Física UNAM (~65%)** y **Física-Matemáticas IPN (~62%)**: el stack matemático + cuantos + EM ya está casi todo.
- Las carreras con menor cobertura (Actuaría 25%, C. Computación 30%) requieren un módulo formal de probabilidad/estadística + estructuras de datos. Buen candidato para el siguiente sprint si se quiere ampliar audiencia.
- Para biomédicas y genómicas, el módulo `physics/bio/Docking` (Vina+Vinardo+MC) más `CentralDogma` ya son fuertes; el siguiente paso natural es **alineamiento de secuencias + análisis filogenético** para subir LCG UNAM de 60% a 80%+.
