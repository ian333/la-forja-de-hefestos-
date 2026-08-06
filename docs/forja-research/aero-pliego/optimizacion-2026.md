# Optimización aerodinámica — ESTADO DEL ARTE 2026

> **Mandato del dueño del producto:** *"cómo le competimos a los grandes, la respuesta es
> OPTIMIZACIÓN. Eso es lo que deben investigar. Herramientas del 2026, no de la década pasada."*
>
> **Requisito del cliente (Raymer §2.1.4):** los CAD de alta gama no sirven para diseño
> conceptual porque *"everything will change"*. El ala cambia de flecha después de CADA
> estudio. → **La optimización no es un módulo: es el centro del producto.**

Fecha del análisis: **4 de agosto de 2026**. Método: investigación web (papers, repos,
benchmarks), no memoria. Cada afirmación dura lleva URL. Lo que no verifiqué está marcado
`[NO VERIFICADO]`. La aritmética que hice yo está marcada `[CÁLCULO PROPIO]`.

Contexto técnico de La Forja: React + R3F + **OCCT-WASM**, SPA 100% estática servida por
nginx (**no hay backend**), 472 MB ya servidos desde `public/precomputed/`, una **RTX 4070 Ti
(12 GB GDDR6X, 192-bit, 40 TFLOPS FP32)** para precomputar
([specs NVIDIA](https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4070-family/)).

---

## 0. TL;DR — LA JUGADA EN CINCO LÍNEAS

1. **El adjunto de un solver de paneles/vortex-lattice cuesta ~8% extra sobre la resolución
   del flujo, para 50 variables de diseño.** Es la única familia de métodos adjuntos que
   corre completa en el navegador. Ese es nuestro piso, y es enorme.
2. **El diferenciador real no es el adjunto del aire: es encadenar ese gradiente al ÁRBOL DE
   FEATURES del CAD.** Sensibilidad de la cota de flecha respecto al arrastre. Nadie lo tiene
   en un navegador. La referencia probada de que se puede es **ESP/OpenCSM** (MIT/Syracuse).
3. **NO entrenes un surrogate neural de perfiles: pórtalo.** NeuralFoil ya existe, licencia MIT,
   8 millones de corridas de XFoil destiladas en MLPs de ≤ 6×512. Portarlo a JS son días.
4. **La GPU va a corregir, no a sustituir.** Multi-fidelidad: RANS precomputado en la 4070 Ti
   como *corrector* del panel barato. El artefacto que sirves pesa MEGABYTES, no gigabytes.
5. **Escepticismo:** el 79% de los papers de ML-para-PDEs que dicen ganarle a un método
   numérico se comparan contra una baseline débil. En la competencia NeurIPS ML4CFD de
   aerodinámica **ganó un método clásico (PCA + proceso gaussiano)**, no una red neuronal.

---

## 1. TABLA MAESTRA

Madurez: 🟢 producción · 🟡 usable con cuidado · 🟠 investigación aplicada · 🔴 investigación pura.
Costo: en semanas-persona de nuestro equipo.

| # | Técnica | Qué logra | Costo implementar | Madurez 2026 | ¿Nos aplica? |
|---|---|---|---|---|---|
| A1 | **Adjunto RANS** (SU2, DAFoam, ADflow) | Gradiente vs. cientos de variables al costo de ~1 sim RANS | 20–50 sem + malla + HPC | 🟢 | ❌ **No en el navegador.** Solo como generador de datos offline |
| A2 | **Adjunto de VLM no lineal** | Gradiente de CL/CD vs. todas las variables; validado contra RANS del CRM | 4–8 sem | 🟢 (paper 2021) | ✅✅✅ **SÍ. Núcleo del producto** |
| A3 | **Adjunto de método de paneles** (sub/supersónico) | Sensibilidades de superficie sobre paneles no estructurados | 4–8 sem | 🟡 (paper 2024/25) | ✅✅ **SÍ, es la extensión natural** |
| B1 | **JAX-Fluids / JAX-CFD / XLB** | CFD end-to-end diferenciable en GPU/TPU | 8–20 sem | 🟢 en Python | ⚠️ Solo offline. **No portable al navegador** |
| B2 | **NVIDIA Warp** | Kernels GPU diferenciables desde Python (adjunto discreto por cinta) | 6–15 sem | 🟢 | ⚠️ Offline, para generar datos/campos |
| B3 | **AD por números duales en TypeScript** | Gradiente exacto de NUESTRO código de geometría y solver | 3–6 sem | 🟢 (técnica vieja, uso nuevo) | ✅✅✅ **SÍ. Es la pieza que nadie tiene** |
| C1 | **FNO / operator learning** | Campo completo en ms tras entrenar | 10–25 sem + datos | 🟡 con asteriscos grandes | ⚠️ Sobrevendido. Ver §5 y §11 |
| C2 | **Transformers geométricos** (Transolver, AB-UPT, DoMINO) | Superficie+volumen de geometrías de 10⁸ celdas en segundos | 20–40 sem + datos caros | 🟡 (automotriz), 🟠 (aero) | ❌ Demasiado pesado para el cliente del navegador |
| C3 | **MLP destilado de un solver barato** (tipo NeuralFoil) | Polar viscosa 2D en ~1 ms, C∞, AD-compatible | **1–2 sem si lo portas** | 🟢 MIT, publicado 2025 | ✅✅✅ **SÍ. Portar, no entrenar** |
| D1 | **Optimización bayesiana** (EI, GP) | Encuentra óptimo con pocas evaluaciones caras | 3–6 sem | 🟢 | ⚠️ Solo ≤ ~20 variables. Ver §11 |
| D2 | **Multi-fidelidad / co-kriging** | Corrige el método barato con pocas corridas caras | 5–10 sem | 🟢 | ✅✅✅ **SÍ. El mejor uso de la 4070 Ti** |
| E1 | **OpenMDAO + adjunto acoplado** | Aero+estructura+propulsión con derivadas totales analíticas | 15–30 sem | 🟢 (NASA) | ✅ Como **arquitectura a copiar**, no como dependencia |
| E2 | **OpenAeroStruct** (VLM + viga 1D + adjunto acoplado) | MDO conceptual barato | — (referencia) | 🟢 | ✅✅ **El plano exacto de lo que debemos construir en TS** |
| F1 | **FFD (free-form deformation)** | Deforma cualquier geometría con pocos parámetros | 3–5 sem | 🟢 | ⚠️ Rompe el árbol de features. Ver §8 |
| F2 | **CST / Kulfan** | Perfil con 8–16 coeficientes, suave, derivable | 1–2 sem | 🟢 | ✅✅ **SÍ, para las secciones del ala** |
| F3 | **Sensibilidades analíticas por el ÁRBOL DE FEATURES** (modelo ESP/OpenCSM) | ∂(superficie)/∂(cota del croquis) | 8–16 sem | 🟢 (existe desde 2013, nadie lo copió) | ✅✅✅ **SÍ. ES EL FOSO** |
| G1 | **LBM en GPU** (FluidX3D) | ~5 000 MLUPS en una 4070; 19 M celdas/GB | 4–10 sem | 🟢 | ⚠️ Precómputo/cine, no diseño conceptual |
| G2 | **PyFR / Neko** (alto orden en GPU) | LES/DNS portables a GPU | 10–20 sem | 🟢 | ❌ Fuera de alcance |
| H1 | **WebGPU compute** | Solvers y GEMM en el navegador | 6–12 sem | 🟢 desde ene-2026 (~84% global) | ✅ **Sí, para el LU denso y el raster de campos** |
| H2 | **ONNX Runtime Web / WebGPU** | Inferencia de redes en el navegador | 1–3 sem | 🟢 | ✅ Pero para MLPs chicos, `Float32Array` puro basta |

---

## 2. (A) MÉTODOS ADJUNTOS — LA PARTE QUE SÍ NOS TOCA

### 2.1 El estado del arte pesado (y por qué NO es nuestro camino)

**SU2** implementa el adjunto discreto por diferenciación algorítmica con la librería CoDiPack,
con preacumulación para bajar memoria, y —esto es notable— **soporta adjunto de RANS sin la
simplificación de "viscosidad turbulenta congelada"**
([Scientific Computing RPTU / SU2 AD](https://scicomp.rptu.de/software/su2/)).
Versiones recientes traen `FGCRODR` en vez de GMRES para el adjunto Newton-Krylov y adjunto
termo-elástico ([SU2 releases](https://github.com/su2code/SU2/releases)); el paralelismo
híbrido del adjunto discreto se publicó en 2024
([Computers & Fluids](https://www.sciencedirect.com/science/article/pii/S0045793024003591)).

**DAFoam** (adjunto discreto sobre OpenFOAM) reporta adjunto implementado para 8 solvers
primales, 5 modelos de turbulencia, escalabilidad **hasta 10 millones de celdas y 1536 núcleos**,
con **error promedio de las derivadas adjuntas < 0.1%**, y resultados como 3.7% de reducción de
arrastre en un ala de UAV multipunto y 3.6% en un CRM ala-fuselaje-cola
([DAFoam](https://dafoam.github.io/), [AIAA J. 10.2514/1.J058853](https://dx.doi.org/10.2514/1.J058853)).

**MACH-Aero** (MDO Lab, Michigan) integra ADflow y DAFoam bajo OpenMDAO
([MACH-Aero docs](https://mdolab-mach-aero.readthedocs-hosted.com/en/latest/machFramework/MACH-Aero.html)).
El MDO Lab es explícito en el porqué del adjunto: *"gradient-based optimization, which is
necessary to handle the hundreds of shape variables involved"*
([MDO Lab wiki](https://mdolab.engin.umich.edu/wiki/aerodynamic-shape-optimization.html)).

**Lo que cuesta:** malla de volumen de calidad, deformación de malla (RBF o IDW), memoria del
adjunto (documentada como problemática: el ONERA M6 con ~500 k elementos ya dispara el uso de
memoria del adjunto discreto frente al primal —
[SU2 issue #594](https://github.com/su2code/SU2/issues/594)), y diferenciar el modelo de
turbulencia. **Nada de eso cabe en un navegador. Punto.**

### 2.2 EL HALLAZGO: el adjunto de un solver lineal denso sí es casi gratis

El mandato preguntaba si existe versión ligera aplicable a paneles/vortex-lattice. **Existe, está
publicada y validada:**

- **Kontogiannis & Laurendeau, "Adjoint State of Nonlinear Vortex-Lattice Method for Aerodynamic
  Design and Control", AIAA Journal 59(4), abril 2021**
  ([DOI 10.2514/1.J059796](https://arc.aiaa.org/doi/10.2514/1.J059796)).
  VLM no lineal + polares seccionales 2.5D RANS, corrección de compresibilidad Prandtl-Glauert,
  regularizado para recuperar soluciones post-pérdida. Linealizan con Newton y obtienen el estado
  adjunto **para funcionales de sustentación, arrastre y diseño inverso**. Cita clave del abstract:
  *"the aerodynamic model approximates well the forces predicted by three-dimensional (3D) RANS
  simulations for the Common Research Model wing, and that the adjoint-state gradients agree well
  with finite difference tests"*. Y lo presentan como **"an interactive method for preliminary
  aerodynamic design"** — o sea, exactamente nuestro caso de uso.

- **"Application of the Adjoint Method to an Unstructured Subsonic/Supersonic Panel Method",
  Journal of Aircraft** ([DOI 10.2514/1.C038478](https://doi.org/10.2514/1.C038478)) — primera
  aplicación del adjunto a un método de paneles no estructurado para sensibilidades de superficie
  en subsónico y supersónico. `[NO VERIFICADO en texto completo: el artículo está tras muro de pago
  (403). Verifiqué título, revista y DOI, no los números internos.]`

### 2.3 Por qué es barato — la aritmética, hecha a mano

El VLM y los paneles son un sistema lineal **denso**: `A(x)·Γ = b(x)`, con `n` paneles.
Para un funcional `J(Γ, x)`:

```
Adjunto:     Aᵀ ψ = (∂J/∂Γ)ᵀ                    ← UNA sola resolución transpuesta
Gradiente:   dJ/dx_i = ∂J/∂x_i − ψᵀ ( ∂A/∂x_i · Γ − ∂b/∂x_i )
```

La clave: **si ya factorizaste `A = LU` para resolver el primal, la resolución transpuesta reusa
la MISMA factorización** (`Aᵀ = Uᵀ Lᵀ`). El adjunto no cuesta otra factorización: cuesta dos
sustituciones triangulares.

`[CÁLCULO PROPIO]` con `n = 1000` paneles y `N = 50` variables de diseño, contando flops:

| Etapa | Flops | Comentario |
|---|---|---|
| Factorización LU del primal | (2/3)·n³ = **6.7 × 10⁸** | se paga una vez |
| Resolución adjunta (Lᵀ, Uᵀ) | 2·n² = **2 × 10⁶** | 0.3% del primal |
| Ensamblar `∂A/∂x_i·Γ` × 50 DVs | N·n² = **5 × 10⁷** | 7.5% del primal |
| **Gradiente COMPLETO vs. 50 variables** | **≈ 5.2 × 10⁷** | **≈ 8% extra sobre el primal** |
| Comparación: diferencias finitas | N·(2/3)n³ = **3.3 × 10¹⁰** | **~630× más caro** |

Supuestos declarados: `A` densa, se re-ensambla la matriz completa por variable (cota superior:
si mover un punto de control solo toca unos cuantos paneles, `∂A/∂x_i` es rala y baja más),
diferencias finitas hacia adelante re-factorizando porque la geometría cambia `A`.

Contraste de escala: para `n = 200` paneles (un perfil 2D típico de XFOIL) la factorización son
~5 × 10⁶ flops, del orden de **milisegundos en WASM**. Es consistente con el objetivo publicado de
FlexFoil: *"Inviscid solve: < 16ms for 200 panels (60 Hz capable)"*
([repo FlexFoil](https://github.com/flexcompute/flexfoil)).

> **Conclusión operativa:** en nuestro régimen (n de 200 a 1500 paneles), el gradiente respecto a
> TODAS las variables de diseño se obtiene por menos del 10% del costo de un análisis, y el
> análisis mismo cabe en un frame de 16 ms. **La optimización interactiva en el navegador es
> físicamente posible hoy.** Esto es lo que los grandes no ofrecen en conceptual.

---

## 3. (B) DIFERENCIACIÓN AUTOMÁTICA Y SOLVERS DIFERENCIABLES

### 3.1 Qué existe en 2026

- **JAX-Fluids 2.0** — solver CFD compresible bifásico, totalmente diferenciable, publicado en
  *Computer Physics Communications* (marzo 2025). Escala **hasta 512 GPUs A100 y 1024 núcleos TPU
  v3**, con diferenciación automática a través de simulaciones distribuidas
  ([arXiv 2402.05193](https://arxiv.org/abs/2402.05193v1),
  [CPC](https://www.sciencedirect.com/science/article/pii/S0010465524003564),
  [repo](https://github.com/tumaer/JAXFLUIDS)).
- **XLB / JAX-LaB** — Lattice Boltzmann diferenciable en JAX, multi-GPU
  ([JAX-LaB, JAMES 2026](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025MS005313)).
- **JAX-FEM** — elementos finitos 3D diferenciable en GPU para diseño inverso
  ([CPC](https://www.sciencedirect.com/science/article/abs/pii/S0010465523001479)).
- **NVIDIA Warp** — kernels GPU escritos en Python, compilados JIT a CUDA, con
  **auto-diferenciación en modo reverso implementada como método adjunto discreto usando una cinta
  que graba las llamadas a kernels**
  ([docs de diferenciabilidad](https://nvidia.github.io/warp/modules/differentiability.html),
  [NVIDIA Warp](https://developer.nvidia.com/warp-python)).
- **Motor aeroelástico diferenciable en JAX** para dinámica de aeronaves, que acepta matrices de
  coeficientes de influencia de UVLM/DLM
  ([CPC 2025](https://www.sciencedirect.com/science/article/pii/S0010465525000505)).

### 3.2 ¿Portable al navegador?

**No, y hay que decirlo sin rodeos.** JAX depende de XLA; XLA no tiene backend WebGPU de
producción. Warp depende de CUDA. Ninguno de estos corre en el cliente.

**Pero la técnica sí es portable, y ahí está nuestra jugada:** nuestro solver no lo escribió
Google, lo escribimos nosotros, en TypeScript, con unos cuantos miles de líneas. **Diferenciarlo
con números duales (forward-mode AD) es un ejercicio de una tarde por operador.** Y para el
solver lineal ni siquiera hace falta AD: el adjunto de §2.3 es analítico.

La división correcta:

| Capa | Técnica | Dónde corre |
|---|---|---|
| Geometría (croquis → cotas → superficie) | **Números duales en TS** (forward-mode, pocas variables) | Navegador |
| Solver lineal (VLM/paneles) | **Adjunto analítico** (reverse, muchas salidas→una) | Navegador |
| Corrección viscosa/compresible | MLP destilado, C∞, derivable a mano | Navegador |
| Generación de datos de alta fidelidad | JAX-Fluids / SU2 / Warp | **iangpu, offline** |

Nota técnica sobre el modo: forward-mode (duales) cuesta *una pasada por variable de entrada*;
reverse (adjunto) cuesta *una pasada por salida*. Por eso la geometría (pocas cotas) va en
forward y el solver (un CD, mil paneles) va en adjunto. Mezclarlos así es exactamente lo que
hace la ecuación unificada de derivadas de OpenMDAO
([Springer](https://link.springer.com/article/10.1007/s00158-019-02211-z)).

---

## 4. (C) SURROGATES NEURALES / OPERATOR LEARNING

### 4.1 El panorama honesto

**Lo que la literatura reporta como logros reales:**

- **AB-UPT** (Emmi AI / JKU, TMLR 2025) — transformers de física con ramas separadas para
  geometría y predicción, campo latente de baja dimensión y decodificadores de campo neural
  anclados. Maneja mallas **de 33 mil a 150 millones de celdas**, se entrena **en una sola GPU en
  menos de un día**, y predice campos de superficie y volumen **en segundos**
  ([arXiv 2502.09692](https://arxiv.org/abs/2502.09692),
  [HTML](https://arxiv.org/html/2502.09692v2),
  [repo](https://github.com/Emmi-AI/anchored-branched-universal-physics-transformers)).
  `[Los valores exactos de error en CD/CL no los pude extraer: el PDF no se dejó parsear. La
  frase publicada es "near-perfect accuracy in drag and lift coefficients", que es marketing
  hasta que uno vea la tabla.]`
- **DoMINO / GeoTransolver** de NVIDIA PhysicsNeMo, con **checkpoints preentrenados publicados en
  Hugging Face** bajo los repos `nvidia/*_drivaerml`
  ([physicsnemo-cfd](https://github.com/NVIDIA/physicsnemo-cfd),
  [blog PhysicsNeMo](https://nvidia.github.io/physicsnemo/blog/2026/05/29/physicsnemo-cfd/),
  [GeoTransolver arXiv 2512.20399](https://arxiv.org/html/2512.20399v3)).
- **Sensibilidades de diseño desde el surrogate**: PhysicsNeMo trae un flujo que toma una malla
  STL, predice presión y esfuerzo cortante con DoMINO, y **auto-diferencia para obtener el
  gradiente del arrastre respecto a cada punto de la malla**
  ([workflow](https://github.com/NVIDIA/physicsnemo-cfd/blob/main/workflows/domino_design_sensitivities/README.md)).
  Es "adjunto sin CFD". El propio README pone los límites: válido solo para *"small, smooth
  deformations"*, con conectividad de malla fija, y exige activaciones suaves.
- **FNO modificado para transónico**: reporta **error de arrastre de ~1 drag count** en validación
  y mejor generalización extrapolativa que modelos convolucionales
  ([Sci. China Phys. Mech. Astron. 2025](https://ui.adsabs.harvard.edu/abs/2025SCPMA..6914604T/abstract)).

**Cuántas muestras hacen falta de verdad:**

| Dataset / caso | Muestras | Fuente |
|---|---|---|
| AirfRANS (RANS 2D incompresible, perfiles NACA) | **1000** (800 train / 200 test) | [arXiv 2212.07564](https://arxiv.org/abs/2212.07564), [OpenReview](https://openreview.net/forum?id=Zp8YmiQ_bDC) |
| DrivAerML (automotriz, HRLES) | **500** variantes morfeadas, 140 M celdas c/u | [AB-UPT](https://arxiv.org/html/2502.09692v2) |
| Régimen "escaso" industrial | **200** (AirfRANS) / **100** (NASA CRM) | [NASA/Bekemeyer et al. 2025](https://rotorcraft.arc.nasa.gov/Publications/files/bekemeyer_etal_2025.pdf) |
| Multi-fidelidad con transfer learning | pre-entreno Euler masivo + **700** muestras RANS de ajuste fino | [Appl. Sci. 15(19):10820](https://doi.org/10.3390/app151910820) |
| **NeuralFoil (destilación de XFoil)** | **~8 millones** de corridas de XFoil | [arXiv 2503.16323](https://arxiv.org/abs/2503.16323) |

Léelo bien: **el orden de magnitud va de 10² (corregir con RANS) a 10⁷ (destilar un solver
barato)**. Esa diferencia decide toda la arquitectura del precómputo — ver §9.

### 4.2 El precedente que nos importa más que todos los FNO juntos: NeuralFoil

**NeuralFoil** (Peter Sharpe y R. John Hansman, MIT, 2025) es una herramienta de análisis de
perfiles construida como **destilación de XFoil en MLPs pequeñas con física embebida en la
arquitectura** (simetrías estructurales, ingeniería de características por conocimiento de
dominio, extrapolación garantizada a casos límite conocidos)
([arXiv 2503.16323](https://arxiv.org/abs/2503.16323),
[repo](https://github.com/peterdsharpe/NeuralFoil)).

Números publicados en el repo:

| Aspecto | Valor |
|---|---|
| Arquitecturas | 8 tamaños: de `xxsmall` (2 capas × 48) a `xxxlarge` (6 capas × 512) |
| Precisión `xxxlarge` vs. XFoil | MAE: CL **0.012**, ln(CD) **0.020**, CM **0.002** |
| Precisión `xxsmall` | MAE: CL **0.040**, ln(CD) **0.078** |
| Error relativo medio de arrastre | **0.37%** en casos simples; **2.0%** incluyendo post-pérdida y transicionales |
| Velocidad | **~30×** XFoil en análisis único, **~1000×** en multipunto (1.2–6.1 ms vs 73 ms) |
| Rango | α de −25° a 25°; Re de ~10³ a 10⁷ |
| Implementación | **Python + NumPy puro** (entrenado en PyTorch, ejecutado en NumPy) |
| Licencia | **MIT** |
| Ventaja para optimizar | *"C∞-continuous solutions, automatic-differentiation-compatibility, and bounded computational cost without non-convergence"* |

`[CÁLCULO PROPIO, aproximado]` La variante `xxxlarge` (6 × 512) son del orden de **1.3 M
parámetros ≈ 5 MB en fp32**; la variante `medium` (4 × 64) son **~18 k parámetros ≈ 72 KB**.
No verifiqué el conteo exacto de parámetros; la arquitectura sí está publicada.

> **Implicación estratégica, sin ambigüedad:** un MLP de 4 capas × 64 en `Float32Array` son ~200
> líneas de TypeScript y corre en microsegundos. **Portar NeuralFoil a JS son días. Entrenar
> nuestro propio FNO son meses y va a salir peor.** No hay debate aquí.

Y el complemento: **FlexFoil** ya reimplementó XFOIL completo (panel de vorticidad lineal, capa
límite integral, transición e^N, acoplamiento viscoso-invíscido por Newton global) en **Rust →
WebAssembly, licencia MIT, con bindings WASM y objetivo de bundle < 500 KB gzip**
([repo](https://github.com/flexcompute/flexfoil),
[blog](https://hs.flexcompute.com/blog/flexfoil)). Verificación: 365 tests contra el Fortran
original. **La verdad viscosa 2D en el navegador ya está resuelta por terceros con licencia
permisiva. No la reconstruyas.**

---

## 5. (D) BAYESIANA Y MULTI-FIDELIDAD — la jugada realista para la GPU

La revisión de referencia es
[**"Multi-fidelity Bayesian Optimization: A Review", arXiv 2311.13050**](https://arxiv.org/html/2311.13050v3).
Taxonomía de sustitutos multi-fidelidad que reporta:

1. **Modelo auto-regresivo (Kennedy–O'Hagan)**: `f_H(x) = b₁·f_L(x) + δ(x)` — el alta fidelidad es
   el baja fidelidad escalado más una discrepancia gaussiana. **Este es el modelo que nos toca:
   `f_L` = nuestro VLM/panel, `δ` = lo que el RANS sabe y el panel no.**
2. **Hierarchical Kriging / recursivos** — para fidelidades ordenadas.
3. **Linear Model of Coregionalization** — más general, costo cúbico en muestras totales.
4. **Deep GP / auto-regresivo no lineal (NARGP)** — cuando la relación entre fidelidades no es
   lineal.
5. **Aumento de entrada** — la fidelidad como variable de entrada más.
6. **Grafo de fidelidades** — cuando no hay jerarquía única.

Funciones de adquisición multi-fidelidad: desde el *augmented expected improvement* heurístico
hasta selección secuencial en dos etapas (dónde muestrear, luego a qué fidelidad), balanceando
costo. La revisión es clara: el desarrollo de adquisiciones multi-fidelidad **sigue siendo área
activa**, y las limitaciones abiertas son restricciones complejas, alta dimensión,
optimización bajo incertidumbre y multi-objetivo.

**Evidencia específica de aero que respalda esta ruta:**

- **"Inductive transfer-learning of high-fidelity aerodynamics from inviscid panel methods"**
  (*Advances in Aerodynamics*, 2024) — **exactamente nuestro caso**: entrenan sobre método de
  paneles invíscido y transfieren a alta fidelidad con mapeo residual, "reteniendo el conocimiento
  previo del modelo invíscido y extendiéndose localmente hacia distribuciones de alta fidelidad,
  como ajustes finos al pico de succión o la influencia viscosa en el borde de salida". Reportan
  que **el costo de una evaluación de flujo potencial es ~0.2% del de una CFD RANS**
  ([Springer Open](https://aia.springeropen.com/articles/10.1186/s42774-024-00186-0)).
- **Multi-fidelidad con transfer learning para perfiles**: pre-entreno con Euler barato + **700
  muestras RANS** de ajuste fino basta para predecir bien distribuciones de presión y coeficientes
  ([Appl. Sci. 2025](https://doi.org/10.3390/app151910820)).
- **Transfer learning activo multi-fidelidad para UAV**: combina transfer learning con muestreo
  activo para maximizar ganancia de información bajo presupuesto de etiquetado estrictamente
  limitado ([Drones 10(4):290](https://www.mdpi.com/2504-446X/10/4/290)).
- **BO multi-fidelidad con restricciones aplicada a diseño de ala**, AIAA AVIATION 2025
  ([10.2514/6.2025-3474](https://arc.aiaa.org/doi/abs/10.2514/6.2025-3474)).

**El límite duro que hay que respetar:** la BO *"typically involve[s] more than 20 variables"*
como umbral de la maldición de la dimensionalidad
([Scaling BO, AIAA J](https://arc.aiaa.org/doi/10.2514/1.J065252);
[arXiv 2412.15679](https://arxiv.org/pdf/2412.15679)). Con ≥ 30 variables de forma, **BO deja de
servir y el gradiente adjunto gana**. Por eso BO en nuestro producto es para el *sizing* de alto
nivel (5–15 variables de Raymer: alargamiento, carga alar, T/W, estrechamiento, flecha), NO para
la forma detallada del perfil.

---

## 6. (E) MDO — la arquitectura a copiar

**OpenMDAO** (NASA) se construye sobre la **ecuación unificada de derivadas (UDE)**, que agrupa
en un solo formalismo diferencias finitas, paso complejo, AD, método directo y **adjunto,
incluyendo derivadas de sistemas multidisciplinarios acoplados**, explotando la esparsidad del
problema ([Springer, SMO 2019](https://link.springer.com/article/10.1007/s00158-019-02211-z)).

**OpenAeroStruct** es el ejemplar que debemos estudiar línea por línea: **método de vortex-lattice
+ viga espacial 3D de 6 GDL por nodo, acoplados, con derivadas por adjunto acoplado**, tan barato
que sirve tanto en conceptual como en MDO, y ya integrado en **Aviary** de NASA
([repo](https://github.com/mdolab/OpenAeroStruct),
[SMO 2018](https://link.springer.com/article/10.1007/s00158-018-1912-8),
[docs](https://mdolab-openaerostruct.readthedocs-hosted.com/)).

**Aviary** (NASA, open source desde diciembre 2023) hereda las ecuaciones de dimensionamiento de
GASP y FLOPS sobre OpenMDAO, con **gradientes analíticos** para diseño simultáneo de aeronave y
subsistemas ([repo](https://github.com/openmdao/Aviary),
[AIAA 2024-4219](https://arc.aiaa.org/doi/10.2514/6.2024-4219),
[NTRS](https://ntrs.nasa.gov/api/citations/20230015940/downloads/Aviation_24_Aviary_abstract_final_name_update.pdf)).
Se usa en cursos de diseño senior, dentro de NASA y con socios de industria.

**Y OpenVSP** es la competencia directa en geometría conceptual: paramétrico, con VSPAERO (VLM +
paneles) integrado, "de boceto a análisis aerodinámico sin exportar a otra herramienta"; la
versión 3.44.0 (15 de julio 2025) añadió chequeos de interferencia y envolvente de CG
([NASA](https://www.nasa.gov/software/openvsp-ground-school/),
[wiki](https://en.wikipedia.org/wiki/OpenVSP)).

> **Lectura competitiva:** OpenVSP tiene geometría paramétrica + VLM, y es de NASA y gratis.
> **Lo que NO tiene: gradientes a través de su árbol de construcción, y no vive en el navegador.**
> Aviary tiene gradientes analíticos, pero de ecuaciones de sizing, no de la geometría.
> **El hueco entre los dos es exactamente donde cabe La Forja.**

---

## 7. (F) PARAMETRIZACIÓN Y "CAD-IN-THE-LOOP" — AQUÍ ESTÁ EL FOSO

### 7.1 El menú de parametrizaciones

- **CST / Kulfan**: función de clase × función de forma; 8–16 coeficientes por perfil; suave por
  construcción; derivadas analíticas triviales.
- **FFD (Sederberg & Parry, 1986)**: caja de puntos de control que deforma lo que sea adentro. Es
  el estándar en MACH-Aero y DAFoam ([tutorial FFD de DAFoam](https://dafoam.github.io/docs/FFD/main.pdf)).
  La revisión de 2025 de métodos de parametrización de perfiles reporta que **FFD logra deformación
  flexible y precisa con la menor cantidad de parámetros**, y que reducir variables acelera la
  convergencia ([Progress in Aerospace Sciences 2025](https://www.sciencedirect.com/science/article/pii/S0376042125000661))
  `[NO VERIFICADO en texto completo: 403 en ScienceDirect. Verifiqué el resumen vía buscador.]`
- **B-splines, PARSEC, Hicks-Henne, GAN/autoencoders** — el resto del catálogo.

### 7.2 El problema real de Raymer

> *"cambia la flecha del ala y que los largueros y costillas se regeneren solos"*

FFD **no resuelve esto**: FFD deforma una malla, no re-ejecuta un árbol de features. Si la caja
FFD mueve el borde de ataque, los largueros no se enteran. FFD es la herramienta correcta para
optimización de forma de alta fidelidad; es la herramienta **equivocada** para diseño conceptual
con historial.

### 7.3 La respuesta existe y se llama ESP / OpenCSM

**Engineering Sketch Pad (ESP)** — Haimes (MIT) y Dannenhoffer (Syracuse):

- **OpenCSM** es un modelador sólido paramétrico basado en features, asociativo. La entrada es un
  archivo `.csm` legible donde el modelo se describe como **una serie de Parámetros de diseño y un
  Feature Tree** ([AIAA 2024-1315](https://acdl.mit.edu/ESP/Publications/AIAApaper2024-1315.pdf)).
- **La capacidad que lo diferencia de todo lo comercial son las sensibilidades.** La documentación
  oficial: *"the geometric sensitivity tells you how the local surface normal will change; this is
  generally computed exactly in ESP by actually differentiating the build process"*
  ([manual de ESP](https://flexcompute.github.io/EngineeringSketchPad/EngSketchPad/ESP/ESP-help.html)).
- Se calculan **analíticamente**, ya sea diferenciando a mano los algoritmos que generan la
  geometría o **por sobrecarga de operadores en C++**; **solo donde el algoritmo es incognoscible
  (por ejemplo un FILLET) se recurre a diferencias finitas**. Dos tipos: **sensibilidad
  geométrica** (movimiento normal a la superficie / perpendicular a una curva / de un nodo) y
  **sensibilidad de teselado** (cómo se mueven los puntos de la malla).
- ESP **ya es cliente-servidor con interfaz web**: `serveESP` hace el cómputo, el cliente es
  JavaScript + WebGL en Firefox/Chrome/Safari/Edge. La sensibilidad se visualiza a color: **rojo =
  la superficie se moverá hacia afuera, azul = hacia adentro**.
- **CAPS** (Computational Aircraft Prototype Syntheses) es la capa que orquesta geometría ↔
  análisis, con el objetivo declarado de *"providing geometric and analysis parametric
  sensitivities for gradient based optimization"*
  ([overview CAPS SciTech 2024](https://acdl.mit.edu/ESP/Publications/AIAA2024_SciTech_Special_Session/Overview_CAPS_SciTech2024.pdf),
  [charla NAS 2024](https://www.nas.nasa.gov/assets/nas/pdf/ams/2024/AMS_20240829_Dannenhoffer.pdf)).

Otras rutas de investigación al mismo problema, para conocerlas: **XVoxel** (voxels semánticos que
mapean modelo de features ↔ modelo de análisis, JCAD 2023,
[arXiv 2303.15316](https://arxiv.org/pdf/2303.15316)) y la exploración interactiva del espacio de
diseño de modelos CAD de MIT CSAIL
([Schulz et al.](https://people.csail.mit.edu/aschulz/optCAD/a11-schulz.pdf)).

> **La conclusión que importa:** ESP **prueba que se puede** diferenciar analíticamente un árbol de
> features, y prueba cuál es el atajo honesto (FD solo donde el algoritmo es opaco, como los
> redondeos). ESP corre su cómputo **en un servidor**. Nosotros no tenemos servidor —
> pero tampoco tenemos su problema: **el 90% de nuestra geometría conceptual la genera NUESTRO
> código en TypeScript** (croquis con cotas → spline del perfil → loft/extrusión). Diferenciar
> nuestro propio código con números duales es directo. Solo las operaciones que delegamos a OCCT
> (fillets, booleanas complejas) necesitan el fallback de diferencias finitas — **el mismísimo
> compromiso que ESP declara.**
>
> **Esto es el foso: un CAD conceptual, en el navegador, donde `∂(arrastre)/∂(cota de flecha)`
> es un número que aparece junto a la cota.** Nadie lo vende.

---

## 8. (G) LO QUE RINDE UNA GPU DE CONSUMO — NÚMEROS, NO MARKETING

Los únicos números publicados, reproducibles y por GPU específica que encontré son los de
**FluidX3D** (LBM, [repo con tabla de benchmark](https://github.com/ProjectPhysX/FluidX3D)), en
MLUPS (millones de actualizaciones de celda por segundo):

| GPU | FP32/FP32 | FP32/FP16S | FP32/FP16C |
|---|---|---|---|
| RTX 4090 | 5 624 | 11 091 | 11 496 |
| RTX 4080 Super | 4 089 | 7 660 | 8 218 |
| RTX 4080 | 3 914 | 7 626 | 7 933 |
| **RTX 4070 Ti Super** | **3 694** | 6 435 | **7 295** |
| RTX 4070 Super | 2 751 | 5 149 | 5 554 |
| **RTX 4070** | **2 646** | 4 548 | **5 016** |

`[INTERPOLACIÓN MÍA, NO VERIFICADA]` La **RTX 4070 Ti** (12 GB, 192-bit) no aparece en el extracto
que leí de esa tabla; por ancho de banda y núcleos cae entre la 4070 y la 4070 Ti Super, o sea
del orden de **~3 000 MLUPS en FP32 y ~6 000 MLUPS con almacenamiento FP16**. No lo tomes como
dato duro: **córranlo ustedes en iangpu antes de citarlo.**

Memoria: FluidX3D reporta **55 bytes/celda con Esoteric-Pull + FP16** contra ~344 bytes/celda de
implementaciones tradicionales, o sea **~19 millones de celdas por GB** de VRAM (vs 3 M). Con
12 GB: del orden de **200 millones de celdas** teóricas.

Otros solvers GPU-nativos: **PyFR** (reconstrucción de flujo, Python, arquitecturas de streaming)
y **Neko** (alto orden, portado a A100, MI100, FPGA Stratix 10 y SX-Aurora —
[Computers & Fluids 2024](https://www.sciencedirect.com/science/article/pii/S0045793024000756),
[arXiv 2107.01243](https://arxiv.org/pdf/2107.01243)).

**El aterrizaje honesto:** LBM en GPU es espectacular para flujo transitorio, visualización y
cine. **Pero el RANS estacionario de un perfil o un ala —lo que el diseño conceptual necesita—
sigue siendo un problema de solver implícito que corre en CPU (SU2, OpenFOAM), y una 4070 Ti no
lo acelera de forma dramática.** La 4070 Ti nos sirve para: (a) **entrenar** correctores y
sustitutos, (b) correr **lotes** de casos en paralelo, (c) LBM/visualización. No para "hacer CFD
más rápido" en el sentido que insinúa el marketing.

---

## 9. (H) WEBGPU — EL TECHO DEL PRODUCTO

**Estado verificado (fuente autoritativa: wiki del grupo de trabajo GPU for the Web,
[Implementation Status](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status)):**

| Navegador | Estado |
|---|---|
| Chrome/Edge | Mac, Windows x86/x64, ChromeOS: **113+**. Android: **121+**. Linux Intel Gen12+: **144+**. Linux NVIDIA con Wayland: **147+**. Detrás de flag: otras GPUs en Linux, Windows ARM64 |
| Firefox | Windows: **141+**. macOS Apple Silicon: **145+**. macOS todas: **147+**. **Linux y Android: aún no** |
| Safari | macOS, iOS/iPadOS, visionOS **26+**, habilitado por defecto |

Cobertura global según [caniuse](https://caniuse.com/webgpu): **83.63%** (la fila de Firefox de
caniuse va atrasada respecto a la wiki del WG — usa la wiki como fuente).

**Inferencia neural en el navegador:** ONNX Runtime Web con execution provider WebGPU, con
*graph capture* para modelos de forma estática e *IO binding* para mantener tensores en GPU
([docs](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)); la propia documentación
recomienda WebGPU **para modelos con cómputo intensivo**, no para modelos ligeros.
Transformers.js expone modelos ONNX de Hugging Face en el navegador.

> **Decisión de arquitectura, y es contraintuitiva:** para MLPs del tamaño de NeuralFoil
> (≤ 1.3 M parámetros), **meter ONNX Runtime Web es peso muerto**. Un producto matriz-vector con
> `Float32Array` en JS puro le gana en latencia de arranque, en tamaño de bundle y en
> depurabilidad, y además **te deja escribir la derivada a mano** (que es lo que necesitamos para
> el gradiente). WebGPU sí vale la pena para: (1) la **factorización LU densa** si crecemos a
> n > 2000 paneles, (2) el raster de campos, (3) barridos de miles de casos en paralelo para las
> polares. **WebGPU como acelerador de nuestro solver, no como runtime de un modelo grande.**

---

## 10. LA JUGADA

Esta es la recomendación, priorizada y elegida. No es un menú.

### La tesis en una frase

> **Construimos el único CAD conceptual del mundo donde el gradiente atraviesa el árbol de
> features, en el navegador, sin servidor. La cota de flecha del croquis lleva junto a ella el
> número `∂CD/∂Λ`, y el optimizador mueve LA COTA — con lo que largueros y costillas se
> regeneran solos porque son features aguas abajo.**

Eso es literalmente la petición de Raymer, y ninguno de los grandes lo puede hacer sin romper su
modelo de negocio (sus kernels de geometría no son diferenciables y su CFD no cabe en un cliente).

### Por qué ESTO y no lo otro

| Alternativa | Por qué NO es la jugada |
|---|---|
| **Adjunto RANS propio** | 20–50 semanas, exige malla, memoria y HPC. Y aunque lo lográramos, **corre en servidor y nosotros no tenemos servidor.** El cliente pide conceptual, no producción |
| **Surrogate neural global (FNO/Transolver) como producto** | Necesita 10²–10³ simulaciones caras por familia geométrica, no generaliza fuera de distribución (§11), y **cada configuración nueva del cliente rompe la distribución de entrenamiento**. En conceptual "everything will change" es precisamente el caso donde el surrogate falla |
| **Optimización bayesiana como motor principal** | Muere arriba de ~20 variables ([AIAA J](https://arc.aiaa.org/doi/10.2514/1.J065252)). La forma de un ala tiene 50–200 |
| **FFD sobre la malla** | Deforma la malla, no el modelo. **Rompe la asociatividad que es toda la propuesta de valor del CAD paramétrico** |
| **Depender de OpenVSP/Aviary/OpenMDAO** | Son Python de escritorio. Nuestro producto es una SPA estática. Se copian las ideas, no se importan los binarios |

### Prioridad de construcción

---

#### **F0 — El adjunto del VLM en el navegador** (la base; ~6–8 semanas)

Construir en TS, sobre lo que ya existe en `src/aero/potencial.ts`:

1. **VLM 3D** con anillos de vórtices, `A·Γ = b`, factorización LU con pivoteo parcial guardada.
2. **Adjunto analítico** (§2.3): `Aᵀψ = (∂J/∂Γ)ᵀ` reusando la LU; funcionales CL, CD_inducido y
   diseño inverso (los tres que Kontogiannis & Laurendeau resuelven).
3. **Verificación obligatoria**: `dJ/dx` adjunto vs. diferencias finitas centradas, error relativo
   < 1e-6, como test unitario. *Es el mismo check que reporta el paper de AIAA J.* Sin ese test,
   el módulo no existe.
4. Presentación: **flechas de sensibilidad sobre el ala en la escena 3D** — rojo hacia afuera,
   azul hacia adentro, tal cual lo hace ESP.

**Criterio de éxito visible:** mueves una cota, la polar se actualiza en < 16 ms, y las flechas
de sensibilidad se redibujan en el mismo frame.

---

#### **F1 — Números duales sobre el árbol de features** (EL FOSO; ~8–12 semanas)

La regla de la cadena completa:

```
dJ/d(cota)  =  [ dJ/d(puntos de superficie) ]  ·  [ d(puntos de superficie)/d(cota) ]
                        ↑ adjunto del VLM (F0)          ↑ AD forward sobre NUESTRO árbol
```

1. Tipo `Dual` en TS (`{v: number, d: Float64Array}`) y sobrecarga de las operaciones del solver
   de croquis, del spline del perfil, y de las transformaciones de loft/extrusión.
2. Forward-mode porque las variables de diseño conceptual son pocas (5–40 cotas): el costo es
   *una pasada por cota*, y cada pasada es geometría pura, microsegundos.
3. **Fallback declarado a diferencias finitas para lo que vive dentro de OCCT** (fillets,
   booleanas) — exactamente la decisión documentada de ESP. Marcarlo en la UI: la sensibilidad
   analítica y la aproximada se pintan distinto.
4. El manifiesto del modelo declara qué cotas son variables de diseño, cuáles están fijas y
   cuáles son restricciones (es el rol del `.csm` de OpenCSM).

**Criterio de éxito visible:** junto a la cota "flecha = 25°" aparece `∂CD/∂Λ = −1.4e-4 /grado`,
y al pedir "optimiza", **la cota cambia sola y el modelo entero se reconstruye** — largueros y
costillas incluidos, porque son features hijas.

---

#### **F2 — Portar NeuralFoil y FlexFoil** (el realismo viscoso; ~2–4 semanas)

**No entrenar nada.** Portar:

- **NeuralFoil** (MIT): tomar los pesos publicados, exportarlos a `.bin` en
  `public/precomputed/aero/neuralfoil-<size>.bin`, y escribir el forward pass en TS
  (`Float32Array`, ~200 líneas). **Escribir la derivada analítica del MLP a mano** (es una
  cadena de GEMV y activaciones: trivial y exacta) → tenemos `∂CD_perfil/∂(coeficientes CST)`
  gratis, C∞, sin no-convergencia.
- **FlexFoil** (MIT, Rust→WASM, < 500 KB gzip) como el **oráculo de verdad** para cuando el alumno
  quiera el XFOIL de verdad, y como generador de datos.
- Acoplar: VLM 3D (F0) + polares seccionales de NeuralFoil = **la misma arquitectura que
  Kontogiannis & Laurendeau validaron contra RANS 3D del CRM**, pero con el 2.5D RANS sustituido
  por la destilación de XFoil. Barato, derivable, honesto sobre su rango.

**Criterio de éxito:** reproducir los fixtures numéricos de Anderson y Bertin del pliego, dentro
de la tolerancia que ya define `CONTRATO.md` regla 3.

---

#### **F3 — Aero-estructura acoplada** (lo que vuelve MDO al producto; ~10–14 semanas)

Copiar el diseño de **OpenAeroStruct**: VLM + viga espacial de 6 GDL por nodo + **adjunto
acoplado**. Con eso el alumno optimiza **peso estructural y arrastre a la vez**, que es el trade
study central de Raymer. La UDE de OpenMDAO es el marco teórico a seguir; la implementación es
nuestra, en TS.

---

#### **F4 — El corrector multi-fidelidad precomputado en la 4070 Ti** (~8–12 semanas)

Y **solo aquí** entra la GPU y la estadística. Modelo auto-regresivo de Kennedy–O'Hagan:

```
CD_verdad(x)  ≈  b₁ · CD_VLM+NeuralFoil(x)  +  δ(x),     δ ~ GP
```

`δ` se aprende de un DOE de 300–800 corridas RANS hechas offline. **No sustituimos el solver:
lo corregimos.** Ventajas frente a un surrogate global:
- degrada con gracia: fuera del dominio del GP, `δ → 0` y te queda el VLM, que **sigue siendo
  física correcta**, no una alucinación;
- el artefacto pesa **megabytes** (§11 vs §12), no gigabytes;
- se puede reportar **incertidumbre** al alumno, que es honestidad pedagógica.

---

### Lo que explícitamente NO construimos

- Adjunto RANS propio.
- FNO, DeepONet o transformer geométrico entrenado por nosotros.
- Solver CFD de volumen en el navegador.
- Runtime de inferencia genérico (ONNX Runtime Web) para modelos de 20 k parámetros.

---

## 11. ARQUITECTURA DEL PRECÓMPUTO: 4070 Ti → `public/precomputed/`

El patrón ya está probado en el repo (472 MB de `.bin`/`.json` sirviéndose hoy). La regla nueva es
de **selección de artefacto**, y sale de los números de §4.1:

> **El costo del precómputo escala con la ambición del sustituto. Un CORRECTOR necesita 10²
> muestras y pesa MB. Un SUSTITUTO GLOBAL necesita 10³–10⁷ muestras y pesa cientos de MB.
> Elegimos corrector.**

### Qué se precomputa y qué pesa

| Artefacto | Cómo se genera en iangpu | Muestras | Tamaño servido | Prioridad |
|---|---|---|---|---|
| **Pesos de NeuralFoil** (portados) | ninguno — ya entrenados, MIT | 0 | `medium` ~72 KB, `xxxlarge` ~5 MB `[CÁLCULO PROPIO]` | **F2** |
| **Corrector GP `δ(x)`** aero conceptual | SU2/OpenFOAM RANS en lote, DOE en 5–8 dims (Λ, AR, λ, torsión, M, Re, CL) | 300–800 | **~1–4 MB** (puntos + Cholesky precomputado) | **F4** |
| **Tablas de compresibilidad / divergencia de Mach** | barrido paramétrico | 10³–10⁴ (baratos) | ~1–5 MB | F4 |
| **Bases POD de campos** para visualización del flujo | snapshots RANS/LBM + SVD | 100–300 | ~10–40 MB | opcional |
| **Fixtures de verificación** (Anderson/Bertin) | corridas de referencia | ~50 | < 1 MB | **F0, gate** |

`[CÁLCULO PROPIO]` El GP corrector: 800 muestras × 8 dims de entrada = 6 400 flotantes, más el
factor de Cholesky 800×800 = 640 000 flotantes = **2.6 MB en fp32**. La predicción en el navegador
es una sustitución triangular de 800: ~640 k flops, **submilisegundo**. Ese es el punto: **el
artefacto multi-fidelidad es ridículamente barato de servir.**

### El pipeline

```
iangpu (RTX 4070 Ti + CPU)                          public/precomputed/aero/     navegador
─────────────────────────────                       ───────────────────────      ─────────
1. DOE en el espacio de diseño del cliente
   (rangos que salen de Raymer, no inventados)
2. Malla + SU2/OpenFOAM RANS por lote      ──┐
   [resumable, un caso por proceso,          │
    NUNCA pkill global — ver CLAUDE.md]      │
3. Evaluar el MISMO DOE con VLM+NeuralFoil  ─┤
4. δ = verdad − barato                       ├──►  delta-gp-<caso>.bin   ──►  corrector, <1 ms
5. Ajustar GP / co-kriging (scikit/GPyTorch) │     delta-gp-<caso>.json  ──►  manifiesto: rangos,
6. Exportar: puntos + Cholesky + hiperparám. ─┘                               unidades, R², n
7. Validación cruzada dejando-uno-fuera      ──►  QA-<caso>.json         ──►  la UI MUESTRA el
                                                                              error esperado
```

**Reglas duras del pipeline (heredadas de `CLAUDE.md`):**
- rsync del source a iangpu **antes** de cada corrida, o el lote sale con código viejo;
- cada caso es un proceso aislado y **resumable**; matar por PID, nunca `pkill` global;
- **cada `.bin` va con su `.json` de manifiesto** declarando rangos de validez, unidades, número
  de muestras y error de validación cruzada. Un sustituto sin su rango declarado **es una mentira
  futura** (regla 4 del `CONTRATO.md`), y la UI tiene que poder decirle al alumno "estás fuera del
  dominio en el que este corrector fue entrenado".

---

## 12. ESCEPTICISMO HONESTO — dónde falla esto y qué promete el marketing

### 12.1 La bomba: el 79%

**McGreivy & Hakim, "Weak baselines and reporting biases lead to overoptimism in machine learning
for fluid-related partial differential equations", *Nature Machine Intelligence* 6(10):1256–1269,
2024** ([Nature](https://www.nature.com/articles/s42256-024-00897-5),
[arXiv 2407.07218](https://arxiv.org/abs/2407.07218)).

Revisión sistemática de 76 artículos que dicen usar ML para resolver una PDE de fluidos y superar
a un método numérico estándar: **el 79% (60/76) se compara contra una baseline débil.** Además
encuentran sesgo de reporte de resultados y sesgo de publicación generalizados, y concluyen que la
investigación de ML-para-PDEs **es sobre-optimista**. Atribuyen la causa a *"researcher degrees of
freedom and a bias towards positive results"*.

**Traducción para nosotros: cuando un paper dice "1000× más rápido que CFD", asume que el "CFD"
contra el que compara estaba mal configurado hasta que se demuestre lo contrario.**

### 12.2 Ganó el método clásico

En la **competencia NeurIPS 2024 ML4CFD** sobre AirfRANS
([retrospectiva, arXiv 2506.08516](https://arxiv.org/html/2506.08516v1)):

- **Ganó MMGP** — *Mesh Morphing Gaussian Process*: **reducción de dimensión por PCA + proceso
  gaussiano**. O sea, estadística clásica, no aprendizaje profundo. (Más lenta en inferencia, pero
  el puntaje pesaba precisión 75% vs velocidad 25%.)
- Los métodos de aprendizaje profundo lograron **300×–600× de aceleración** frente a CFD
  tradicional (OB-GNN reportó 318.9×), **pero el esquema de puntuación ponderado por precisión
  favoreció al enfoque clásico**.
- Fallas documentadas: **extrapolación en número de Reynolds** (modelos entrenados en Re de 3–5
  millones sufren en 2–3 y 5–6 millones), y **la capa límite**: *"all methods struggled with sharp
  velocity gradients near airfoil surfaces"*.
- Crítica del protocolo por los propios organizadores: la métrica de speed-up incluía overhead de
  evaluación, la agregación lineal de tres categorías no refleja prioridades de despliegue, y hubo
  validación estadística limitada de la estocasticidad de los modelos.

### 12.3 El "zero-shot super-resolution" es falso

**"The False Promise of Zero-Shot Super-Resolution in Machine-Learned Operators"**
([arXiv 2510.06646](https://arxiv.org/abs/2510.06646)). Los operadores neuronales **no** pueden
inferir a resoluciones mayores que las de entrenamiento sin reentrenar. Descomponen el fallo en
extrapolación a frecuencias nuevas e interpolación entre resoluciones, y muestran empíricamente
que **fallan en ambas de forma zero-shot**, quedando *"brittle and susceptible to aliasing"*.
Los modelos están, en la práctica, **atados a la resolución con la que los entrenaste.**

Esto tumba directamente el argumento de venta más citado del FNO ("aprende el operador, es
independiente de la malla").

### 12.4 Los surrogates dentro del lazo de optimización

**ShapeBench** (arXiv 2605.20763, mayo–junio 2026,
[abs](https://arxiv.org/abs/2605.20763)) — 103 tareas de optimización de forma en 8 categorías,
con baselines a presupuesto igualado. El hallazgo demoledor: **correlación media por pares
Spearman ρ = 0.013 entre tareas**. Es decir: **los resultados de una sola tarea no transfieren a
otras clases de problema.** Cualquier paper que muestre "nuestro método ganó en el RAE2822" no te
está diciendo nada sobre tu caso.

Y las limitaciones del propio flujo de sensibilidades neurales de NVIDIA, en sus palabras: válido
solo bajo *"small, smooth deformations"*, con conectividad de malla fija, exigiendo activaciones
suaves y perturbaciones suficientemente pequeñas
([README](https://github.com/NVIDIA/physicsnemo-cfd/blob/main/workflows/domino_design_sensitivities/README.md)).
El propio blog de NVIDIA se titula **"Don't Yet Trust the Model, Test the Physics"**
([PhysicsNeMo blog, mayo 2026](https://nvidia.github.io/physicsnemo/blog/2026/05/29/physicsnemo-cfd/)).

Además, la crítica estructural al FNO en aero: **el FNO depende de mallas uniformes para que la
FFT sea eficiente, lo que limita su aplicabilidad a las mallas no estructuradas típicas de
aerodinámica**, y **la curvatura local extrema genera gradientes de presión muy pronunciados
difíciles de generalizar fuera de la distribución de entrenamiento, en particular el pico de
succión** ([Neural fields for rapid aircraft aerodynamics simulations, *Scientific Reports*
2024](https://www.nature.com/articles/s41598-024-76983-w)).

### 12.5 Donde el gradiente también falla

- **Multimodalidad**: la optimización de forma de alta fidelidad con muchas variables *"has the
  potential to have multiple local minima"*, y los algoritmos de gradiente convergen a uno solo,
  exigiendo múltiples puntos de arranque
  ([MDO Lab](https://mdolab.engin.umich.edu/wiki/aerodynamic-shape-optimization.html)). Pero la
  conclusión de Bons, He, Mader & Martins (*AIAA J* 57(3), 2019) es matizada y hay que citarla
  completa: **"multimodality should not always be assumed in aerodynamic-shape-optimization
  problems"** ([10.2514/1.J057294](https://arc.aiaa.org/doi/10.2514/1.J057294)). *Traducción: no
  descartes el gradiente por miedo a mínimos locales, pero arranca desde varios puntos y muéstralo.*
- **El gradiente es tan bueno como el modelo.** Un adjunto exacto de un VLM sigue siendo un VLM: no
  ve separación, no ve ondas de choque, no ve la capa límite. **Optimizar hasta el último dígito un
  modelo que no ve la física relevante es la peor trampa de todas** y es donde una escuela debe
  gritarle al alumno.
- **BO**: muere arriba de ~20 variables (§5).
- **Adjunto RANS**: memoria (SU2 issue #594), y la calidad del gradiente depende de la malla.

### 12.6 Lo que el marketing promete y la literatura no sostiene

| Promesa | Realidad verificada |
|---|---|
| "1000× más rápido que CFD" | El número excluye la generación de datos de entrenamiento. DrivAerML son 500 simulaciones HRLES de 140 M celdas. Ese costo existe y es enorme |
| "El operador neuronal es independiente de la malla / resolución" | Falso en zero-shot ([arXiv 2510.06646](https://arxiv.org/abs/2510.06646)) |
| "Precisión casi perfecta en CD y CL" | Frase del abstract de AB-UPT. No pude verificar las tablas: el PDF no se dejó parsear |
| "El deep learning superó a los métodos clásicos en CFD" | En la competencia de aerodinámica de NeurIPS 2024 **ganó PCA + proceso gaussiano** |
| "Nuestro método gana en el benchmark X" | ShapeBench: ρ = 0.013 de correlación entre tareas. Un benchmark no predice otro |
| "Optimización generativa con IA" | Los propios investigadores señalan que muchas formas generadas por la parametrización son anómalas y no aportan información al sustituto ([geometric filtering, AIAA J](https://arc.aiaa.org/doi/10.2514/1.J059254)) |

---

## 13. LO QUE NO VERIFIQUÉ (declarado, regla 5 del CONTRATO)

1. **Números internos de AB-UPT** (R², MAE en drag counts, tiempo exacto de inferencia, GPU
   específica): el PDF de arXiv no se dejó extraer. Solo verifiqué el abstract y las cifras de
   rango de malla (33 k–150 M celdas) y "una GPU, menos de un día".
2. **Texto completo del adjunto de paneles** (J. Aircraft, DOI 10.2514/1.C038478): 403 tras muro
   de pago. Verifiqué título, revista y DOI.
3. **Revisión 2025 de parametrizaciones** (Prog. Aerospace Sci., S0376042125000661): 403. La
   afirmación de que FFD logra buena deformación con menos parámetros viene del resumen indexado,
   no del texto.
4. **MLUPS de la RTX 4070 Ti exacta**: no está en el extracto de la tabla de FluidX3D que leí.
   La cifra de ~3 000 / ~6 000 MLUPS es **interpolación mía** entre la 4070 y la 4070 Ti Super.
   **Medirla en iangpu antes de citarla en cualquier lado.**
5. **Conteo exacto de parámetros de NeuralFoil**: calculé ~1.3 M para `xxxlarge` a partir de la
   arquitectura publicada (6 capas × 512). No conté los pesos del archivo real.
6. **Errores de AirfRANS por modelo**: el paper original está en arXiv 2212.07564 pero el abstract
   no trae la tabla; OpenReview bloqueó la extracción. Los números de la competencia sí los tomé
   de la retrospectiva (arXiv 2506.08516).
7. **Rendimiento real de nuestro LU denso en WASM**: toda la aritmética de §2.3 es conteo de flops
   `[CÁLCULO PROPIO]`, no medición. **El primer entregable de F0 debe ser el benchmark real.**

---

## 14. LO QUE MÁS ME SORPRENDIÓ

1. **El adjunto barato ya estaba publicado y nadie lo llevó al navegador.** Kontogiannis &
   Laurendeau (2021) literalmente presentan el adjunto del VLM como *"an interactive method for
   preliminary aerodynamic design"* y validan contra RANS 3D del CRM. Lleva cinco años ahí. La
   pieza que falta no es la matemática: es **el CAD paramétrico en el cliente**, que es justo lo
   que nosotros ya tenemos.
2. **ESP resolvió el problema difícil hace más de una década y el mercado no lo copió.**
   Sensibilidades analíticas por el árbol de features, con fallback de FD solo en los fillets. Es
   la respuesta exacta a Raymer, publicada, con manual. Los CAD comerciales no la ofrecen porque su
   negocio es diseño de producción, no conceptual — que es *textualmente* la queja del cliente.
3. **En la competencia de ML de aerodinámica ganó PCA + proceso gaussiano.** Después de tres años
   de titulares sobre operadores neuronales, el ganador fue estadística de los años noventa
   aplicada bien.
4. **El artefacto de multi-fidelidad pesa megabytes.** Todo el discurso de "surrogates" empuja
   hacia datasets gigantescos, cuando la corrección de un modelo físico correcto con 500 puntos
   cabe en menos de lo que pesa uno solo de nuestros `.bin` de moléculas.
5. **La verdad viscosa 2D en el navegador ya es software libre.** NeuralFoil (MIT, 8 M corridas de
   XFoil destiladas) y FlexFoil (MIT, XFOIL en Rust→WASM, < 500 KB) existen. El instinto de
   "entrenamos nuestro propio modelo" habría quemado meses para llegar a algo peor.

---

## 15. ESCUELA — qué sale de aquí para el alumno (regla 7 del CONTRATO)

| Lección | Construye | Mueve | Ve pasar | Verifica contra |
|---|---|---|---|---|
| **Qué es una sensibilidad** | ala rectangular en croquis | la cota de torsión | flechas rojas/azules sobre la superficie | derivada por diferencias finitas que él mismo calcula |
| **Por qué el adjunto no es diferencias finitas** | mismo modelo, 30 cotas | pide gradiente completo | contador de tiempo: 8% vs 630% | el conteo de flops de §2.3 |
| **El gradiente es tan bueno como el modelo** | perfil a α alto | sube α hasta la pérdida | el VLM predice CL creciendo, NeuralFoil predice la caída | dato experimental del libro |
| **Multi-fidelidad** | ala en régimen transónico | Mach hacia la divergencia | el corrector `δ` se activa y la banda de incertidumbre se abre | el RANS precomputado |
| **Fuera de rango se miente** | cualquier caso | Re fuera del DOE | la UI marca "extrapolando" | los rangos declarados en el `.json` |
| **Trade study al estilo Raymer** | avión completo | AR, carga alar, T/W | frontera de Pareto peso-arrastre | los métodos a mano del libro |

---

**Fin del documento.** Todo lo citado tiene URL. Lo no verificado está en §13.
