# GAIA vs. Ingeniería Mecánica — Mapa, Backlog y Primera Feature

> Generado por workflow Opus 4.8 (`gaia-carrera-tareas`, 2026-06-01), verificado contra el código real del repo.
> **Carrera:** Ingeniería Mecánica — Facultad de Ingeniería, UNAM (Sistema Escolarizado, Plan 2023).
> **Fuente:** https://oferta.unam.mx/planestudios/ingmecanicaplanestudiosfacing13.pdf

---

## TL;DR

- **GAIA cubre hoy ≈ 5-10% de la tarea ENTREGABLE** de la carrera (lo que califica el profe).
- Cubre la **comprensión** de ~60-65% de los temas → GAIA es hoy una **biblioteca de intuición 3D estilo 3Blue1Brown**, no una herramienta que *hace* la tarea.
- Faltan **dos órganos transversales** (P0): **resolvedor simbólico paso a paso** y **generador de reporte de lab en PDF**. Son el chasis del que cuelgan 9 y 6 materias.
- **Conteo:** plenas HOY = 0 · parciales (intuición sólida, falta entregable) = 8 · NO = 4.

---

## 1. Mapa "carrera → GAIA" (12 materias clave)

**HOY** = GAIA ya resuelve la tarea que el chavo entrega · **PARCIAL** = tiene la viz/intuición pero NO el entregable · **NO** = ni intuición ni entregable.

| # | Materia (sem) | Tarea entregable real | GAIA hoy | Por qué |
|---|---|---|---|---|
| 1 | Álgebra (1) | Gauss, raíces de polinomios, complejos polar/De Moivre, determinantes por cofactores | **NO** | No hay solver paso a paso ni álgebra simbólica. Lo live es eigen/matriz contemplativo, nivel avanzado |
| 2 | Cálculo Diferencial (1) | Problemario: límites, derivadas, razón de cambio, optimización | **PARCIAL** | `Derivative1D` + `TangentPlane` dan intuición, pero no resuelven el problemario ni generan reporte |
| 3 | Geometría Analítica (1) | Ecuación de cónica/recta, clasificar por discriminante, graficar | **NO** | No hay módulo de cónicas live; falta solver + graficador entregable |
| 4 | Computación p/ Ingenieros (1) | Programar fenómeno mecánico / método numérico en Python/C | **NO** | El AI panel de Forja es DSL de geometría SDF, no editor de código general |
| 5 | Álgebra Lineal (2) | Gauss-Jordan, inversa, Cramer, determinantes — procedimiento escrito | **PARCIAL** | `Matrix3D`/`Eigen3D`/`PCA` dan la geometría, no el procedimiento paso a paso |
| 6 | Cálculo Integral (2) | Métodos de integración, Riemann, **sólidos de revolución** | **PARCIAL** | `RiemannIntegral` live es fuerte; falta solver de integrales y el módulo de sólidos de revolución |
| 7 | Estática (2) | Mesa de fuerzas, equilibrio de partícula, armaduras/vigas, diagramas | **NO** | No hay solver de armaduras ni mesa de fuerzas |
| 8 | Ecuaciones Diferenciales (3) | EDO, Laplace, sistemas, Fourier — masa-resorte, RLC | **PARCIAL** | `PhasePortrait` (RK4) live; falta solver simbólico EDO, Laplace/Fourier, sim masa-resorte/RLC |
| 9 | Cálculo Vectorial (3) | div/rot/grad, integrales de línea/superficie, conservativos | **PARCIAL** | `VectorFields` con div/curl medible es muy bueno; falta solver de integrales de línea/superficie |
| 10 | Cinemática y Dinámica (3-4) | Reportes lab: MRUA, caída libre, parabólico, fricción, energía, inercia | **PARCIAL** | `DoublePendulum`/`SolarSystem` viz fuerte; faltan las 6 prácticas + reporte de lab |
| 11 | Termodinámica (3) | Reportes lab (12 prácticas), ciclos Otto/Diesel/Rankine, tablas de vapor, T-s/P-v | **PARCIAL** | `IdealGasGPU` cubre gas ideal; faltan ciclos, tablas de vapor y diagramas |
| 12 | Dibujo Mecánico (3) | Proyecciones ortogonales, isométrico, acotado, pieza CAD | **PARCIAL** | Hefestos (SDF/F-Rep) modela en 3D, pero superficie desconectada + sin vistas ortográficas acotadas auto |

---

## 2. Backlog de construcción (priorizado por palanca = cuántas materias desbloquea)

| Prio | Item | Qué es | Materias que lo necesitan | Esfuerzo |
|---|---|---|---|---|
| **P0** | **Resolvedor simbólico paso a paso** | Motor (mathjs/nerdamer/Algebrite) que resuelve y muestra cada paso: Gauss-Jordan, determinantes, raíces, derivadas, integrales, EDO 1er orden, Laplace | **9 de 12** | **XL** |
| **P0** | **Generador de reporte de lab en PDF** | Plantilla (datos, marco teórico, datos medidos, gráficas, % error, conclusiones, refs) que exporta los entregables | **6 de 12** | **M** (jsPDF + html2canvas) |
| **P1** | Graficador 2D entregable (cónicas + funciones) | Plano cartesiano que grafica y rotula cónicas/rectas/curvas, exporta a imagen/PDF | 3: Geo Analítica, Cálc Dif, Cálc Integral | M |
| **P1** | Sólidos de revolución | Curva → girar eje → sólido 3D + volumen por integral. Encaja con Hefestos | 2: Cálc Integral (proyecto estrella), Dibujo | M |
| **P1** | Solver/sim de Estática (cuerpo rígido 2D) | Mesa de fuerzas, equilibrio, armaduras (nodos), cuerpo libre, cortante/momento | 2: Estática (+ base Resistencia) | L |
| **P2** | Suite de Ecuaciones Diferenciales aplicada | Sim masa-resorte/RLC con sliders + Laplace/Fourier (sobre P0) | 1+: Ec Dif | M |
| **P2** | Sims de prácticas Cinemática/Dinámica | MRUA, caída libre, parabólico, fricción, energía, inercia — datos exportables al PDF | 1: Cinemática/Dinámica (6 prácticas) | L |
| **P2** | Termo: ciclos + tablas de vapor | Otto/Diesel/Rankine/refrigeración, T-s y P-v, tablas de vapor interpoladas | 1: Termodinámica | L |
| **P2** | Vistas ortográficas auto + acotado en Hefestos | Del modelo SDF generar 3 vistas acotadas, sistema europeo | 1: Dibujo Mecánico | L (depende de arreglar superficie) |
| **P3** | Sandbox de código numérico (Pyodide en navegador) | Editor + Python para métodos numéricos | 1: Computación | L |
| **P3** | Integrales de línea/superficie entregables | Sobre `VectorFields`: trabajo ∫F·dr, flujo, conservativo, potencial paso a paso | 1: Cálc Vectorial | M (sobre P0) |

**Patrón clave:** los dos P0 (solver + PDF) **no son features de una materia, son el chasis transversal**. Construirlos primero multiplica el valor de cada módulo contemplativo que ya existe.

---

## 3. Primera feature recomendada: Resolvedor simbólico paso a paso

Arrancar por **Gauss-Jordan, determinantes, derivadas e integrales básicas**, cada uno mostrando el procedimiento completo línea por línea (lo que el profe pide entregar).

**Por qué es la de mayor palanca de adopción:**
1. **Desbloquea 9 de 12 materias** — la palanca más alta, lejos.
2. **Cierra el gap que mata la adopción hoy:** el chavo no abre una herramienta para contemplar; la abre para **entregar la serie del viernes**. El solver convierte a GAIA de "museo bonito" a "herramienta que uso cada semana".
3. **Es el momento de hábito (recurrencia), no de descubrimiento.** Los reels son el funnel gratis; el solver es lo que hace que **regrese cada semana** — el motor del SKU personal que aún falta en Stripe.
4. **Apalanca lo ya construido:** cada paso simbólico puede enlazar al módulo 3D existente ("mira tu Gauss-Jordan como transformación en `Matrix3D`"). Nada se desperdicia.
5. **El PDF (otro P0) depende de tener algo que reportar:** el solver genera el contenido, el PDF lo empaqueta. Solver primero, PDF segundo → juntos = MVP de adopción.

**Riesgo a vigilar:** un solver simbólico genérico choca con la regla dura de corrección física/matemática del proyecto. **Mitigación:** cada operación validada con casos canónicos (igual que las viz: Mercurio 43″/siglo, ΔE/E<1e-12). Correcto y con pasos verificables, no caja negra.

---

## ✅ Validación cruzada (2º run independiente, Plan 2016)

Una segunda corrida Opus independiente (UNAM Plan 2016, 406 créditos) **confirmó el mismo diagnóstico**: "GAIA **contempla, no entrega**" — motores y visuales correctos (FEM real `trussStiffness3D`/`vonMisesStress`, CAD F-Rep, `mech.ts`, álgebra lineal 3D, blueprints SVG) pero **falta la capa de entrega de tarea**. 0/12 materias resueltas de punta a punta, ~12-15% de cobertura ponderada. Computación (C/git) = único bloque fuera de alcance, no invertir.

**Diferencia clave (decisión de orden):** el 2º run pone el **Generador de PDF como el P0 #1** (no el solver), con este argumento:
- **Universal 11/12 materias** — la *salida* (PDF entregable) es idéntica en toda materia, mientras la lógica de resolver cambia por materia.
- **Capitaliza lo que YA funciona** — hoy los resultados de los motores correctos "se quedan en pantalla y se pierden"; el PDF los vuelve entregables.
- **Es el evento de activación del funnel** — el artefacto que cruza de "lo vi" a "lo usé para mi tarea" = justifica el SKU personal de Stripe.
- **Esfuerzo M, riesgo bajo** (1 dep: jsPDF), shippeable YA y midiendo activación mientras el solver (L) se construye en paralelo.

**Secuencia recomendada por el 2º run:** **PDF (P0) → Solver simbólico (P1) → Plotter/export CSV (P2).** Esas 3 piezas horizontales tocan **11/12 materias** y convierten GAIA de "museo" a "hace mi tarea". El solver ya está en construcción (workflow `wuctmaj0k`).

## Archivos de referencia
- Registro matemáticas (13 módulos live, todos contemplativos): `src/math/registry.ts`
- Registro física (22 live / 34 planned): `src/physics/registry.ts`
- CAD Hefestos (SDF/F-Rep + AI DSL): `src/forja/` (`api.ts`, `AIPanel.tsx`, `scene.ts`, `runner.ts`)
- **Confirmado ausentes en `package.json`:** no hay jsPDF/html2canvas ni mathjs/nerdamer/Algebrite → los dos P0 son construcción desde cero.
