# CRUCE Y PLAN — El módulo de aeronáutica de La Forja

**Fecha:** 2026-08-04 · **Base:** 29,606 líneas de pliego de 15 agentes sobre los 3 manuales del
cliente (Anderson, Bertin, Raymer), el código real de La Forja, el mercado y el estado del arte
en optimización. **332 fixtures de test** extraídos de los libros. Español mexicano.

> Este documento es la Ola 2: el cruce. No repite los pliegos — decide. Cada afirmación
> aquí tiene su respaldo en los `.md` hermanos de esta carpeta.

---

## 1. LA TESIS

**No competimos en fidelidad. Competimos en el CICLO.**

Un STAR-CCM+ cuesta US$29,166/año y resuelve mejor que nosotros cualquier campo de flujo. Eso no
lo vamos a cambiar y no hace falta: **el 777 se diseñó sin Navier-Stokes ni Euler** (Bertin §14).
Los métodos lineales no son el juguete previo al CFD serio — son con lo que se diseñaron los
aviones que la gente vuela.

Lo que sí es nuestro, y está vacío:

1. **Aerodinámica 3D en el navegador no existe.** Medido con evidencia negativa el 2026-08-04:
   `vortex lattice` en el top 20 de GitHub → cero repos en JS/TS/WASM. `webgpu cfd` → 1 repo,
   0 estrellas. (El 2D sí se cerró: FlexFoil, marzo 2026 — ese lo integramos, no lo repetimos.)
2. **El gradiente casi gratis.** Para 1000 paneles y 50 variables, el gradiente completo por
   adjunto cuesta **~8% extra** sobre resolver el flujo, contra ~630× por diferencias finitas —
   porque se reusa la factorización LU. El adjunto de VLM está publicado y validado contra RANS
   (Kontogiannis & Laurendeau, *AIAA J.* 2021) **y nadie lo llevó a un navegador**.
3. **El gate que solo un CAD puede medir.** Raymer exige que un rediseño conserve
   `W₀ / volumen_interno` contra el baseline; si no — literal — *"the revised layout must be a
   fake!"*. Ni una hoja de cálculo ni un CFD conocen el volumen interno del avión. **Un kernel
   B-Rep sí.** Ese es el requisito que obliga al optimizador a vivir DENTRO del CAD.
4. **El cliente vende una herramienta que él mismo prohíbe usar.** RDS-Professional (el software
   de Raymer) cuesta US$23,900 + US$2,800/año y su licencia prohíbe usarlo para diseño real.
   XFLR5 murió el 2026-06-30 y dejó su base huérfana.

**Frase de posicionamiento:** *el detector de mentiras del CFD, que además dibuja el avión.*
Es del propio cliente (Raymer §1.4): sus métodos *"are good enough to be used to check the
results of the sophisticated computerized methods, and if they are far apart, the computer
results are probably wrong!"*

---

## 2. LO QUE NO VAMOS A HACER

Las decisiones negativas valen tanto como las positivas, y estas tienen respaldo:

| No haremos | Por qué |
|---|---|
| Otro XFOIL web | FlexFoil ya lo hizo (WASM, 60 Hz, <500 KB). Se integra. |
| Entrenar redes neuronales de física | **79% (60/76)** de los papers de ML-para-PDEs que dicen ganar se comparan contra baseline débil (*Nature MI* 2024). El NeurIPS 2024 ML4CFD lo ganó **PCA + proceso gaussiano**. |
| RANS/Euler propio | No le ganamos a Fluent y no hace falta. |
| WebGPU para el solver | **No tiene FP64** (issue del spec abierto desde 2022). WebGPU = render. Solver = WASM f64. |
| Optimizar curvatura de perfil con métodos lineales | Carlson & Mack: los errores lineales se compensan en CL y CD **pero no en Cm**, y *"los métodos lineales no indican la superficie de curvatura correcta para minimizar arrastre"*. El adjunto sirve para planta alar, sizing y comparación — **no** para afinar la curvatura. |
| Vender "somos baratos por core" | Ansys copió el modelo de cores ilimitados de Siemens en feb-2025. Ese argumento se muere solo. |

---

## 3. EL PUENTE QUE FALTA (y bloquea todo lo demás)

Hoy el Estudio Viento del CAD saca el semiángulo de la cuña del **bounding box**. La física es
buena; el puente con la geometría no existe. **Nada de lo demás se puede construir hasta esto:**

| Módulo nuevo | Qué hace | Estado hoy |
|---|---|---|
| `aero/skin.ts` | `tessellate()` → paneles con **normal y área por triángulo**, agrupados por `faceId` | `faceIds` ya viene del kernel; normal/área hay que calcularlas (patrón copiable en `dfm-mesh.ts:110`) |
| `aero/wing-metrics.ts` | Del sólido: **S_ref, AR, MAC, envergadura, flecha, diedro, taper** | **Cero.** `occt.ts` no exporta ni bounding box (3 implementaciones privadas dispersas) |

⚠️ **La trampa de contabilidad, ya identificada:** el área de referencia `S` **sí** incluye la
parte del ala enterrada en el fuselaje (Bertin §5.3), pero la MAC para el Reynolds de fricción
**no** (§5.4.6). Dos definiciones del mismo ala en el mismo capítulo. Y Anderson usa la cuerda
media (`S/b`) donde Bertin exige la MAC (integral de `c²`): con el fixture del Orbiter, **14.8%
de error en Cm** si se mezclan.

**Requisito duro que sale de ahí:** *cada resultado estampa la longitud y el área de referencia
con que fue calculado.* Un `CL` sin su `S` es un dato corrupto (Anderson §1.5: *"you must always
know what reference quantities the particular data are based upon"*). Es el mismo bug de
contabilidad que nos mordió en el pliego de moldes: el dato bien calculado que no llega al juez.

---

## 4. LA DEUDA QUE SE PAGA ANTES DE ESCRIBIR CÓDIGO NUEVO

Seis defectos reales encontrados por los agentes en código que **ya existe**:

1. **`src/aero/` no está en el gate.** `forja-gate.cjs` corre `vitest run src/forja`, no `src/`.
   Sus 25 tests nunca corren en el portero. **Fix de una línea. Primero esto.**
2. **`betaChoqueOblicuo()` devuelve 65° en silencio** cuando el choque está desprendido
   (θ>θmax). Probado con 3 casos. Falla callada — la peor clase.
3. **El docstring de `circulationIntegral()` dice lo contrario del test.** Quien lea el comentario
   y "arregle" la función, truena el test.
4. **`atmosfera.ts`**: no distingue altitud geométrica de geopotencial (el libro lo marca con
   "must" dos veces), y **se detiene en 20 km** — el material hipersónico necesita 68.9 km.
5. **La cota alineada no converge en geometría casi-horizontal.** Falla ya con 4 puntos, deja el
   croquis en rojo con `iters=0`. Pivote sobre `1e-12` en `solveDense`. **La cuerda de un perfil
   es casi-horizontal: esto bloquea la primera lección.**
6. **El snap de 10 px fusiona 80 de 80 puntos** de un perfil NACA. Salida: cargar el perfil por
   documento (`loadDoc({smooth:true})`), no por clics.

---

## 5. EL STACK DE SOLVERS — orden por dependencia y valor

Cada uno con su **fixture de aceptación publicado en el libro**. Si reproduce el fixture, está bien.

| # | Módulo | Fixture de oro | Costo |
|---|---|---|---|
| 1 | `panel2d.ts` — Hess-Smith fuentes + vórtices | **Anderson Ej. 3.19**: fila 4 de la matriz 8×8, las 8 intensidades, invariante `Σλ·S=0`, a 4 cifras. Más `Cp = 1−4sin²θ` exacto y pendiente `2π` | `[NAVEGADOR]` |
| 2 | Capa límite acoplada (Blasius + turbulenta + transición) | Anderson §17.2: los 5 pasos literales del acoplamiento = XFOIL. `f''(0)=0.332`, `Re_cr≈5e5` | `[NAVEGADOR]` |
| 3 | Compresibilidad (P-G, Karman-Tsien) | ~30 líneas que revalorizan `potencial.ts`. Dominio literal: `0≤M≤0.8` **o** `1.2≤M≤5` | `[NAVEGADOR]` |
| 4 | `vlm.ts` — vortex-lattice 3D | **Bertin Ej. 7.4**: coeficientes −16.3533/−30.9335/−24.2319, matriz 4×4, `CLα=3.443/rad`. ⚠️ + el fixture aislado de la imagen de babor | `[NAVEGADOR]` ≤200 paneles |
| 5 | Línea sustentadora (Fourier) | Elíptica ⇒ `δ=0.0000`, `e=1.0000`, `a=5.02655/rad` (ya verificado por el agente) | `[NAVEGADOR]` |
| 6 | Supersónico linealizado + θ-β-M + Prandtl-Meyer | `cl=4α/√(M²−1)`. El F-104 crucero Mach 2 vuela a **1.98°**: la teoría lineal vale en el punto de diseño | `[NAVEGADOR]` |
| 7 | Newtoniano modificado | `Cp = Cp,t2·cos²η` — **un producto punto por triángulo**. Vehículo de reentrada a 60 fps | `[NAVEGADOR]` |
| 8 | MOC 2D | Compatibilidades colapsan a álgebra; 2500 nodos ≈ **1 ms**. Tobera supersónica interactiva | `[NAVEGADOR]` |
| 9 | Sizing de Raymer | Lazo con relajación **0.8** (deducido de sus tablas, verificado en 3 corridas), paro a ~0.1% de W₀ | `[NAVEGADOR]` |
| 10 | Análisis de Raymer: arrastre, propulsión, **59 ecuaciones de peso**, punto neutro y trimado, ascenso/planeo/viraje/aceleración | La ec. 13.6 (pérdida de empuje por recuperación de presión) **cierra exacta en las 11 filas** del DR-3 — el mejor test unitario del bloque | `[NAVEGADOR]` |
| 11 | **Adjunto sobre VLM/paneles** | El diferenciador. ~8% sobre el flujo | `[NAVEGADOR]` |

**Balance:** 24 de 36 métodos del corpus son `[NAVEGADOR]`, 7 `[PRECÓMPUTO]`, 5 `[GPU-VIVO]`.

**El hallazgo que hace todo esto interactivo**, confirmado por Anderson y Bertin por separado:
*"the values of the integrals depend simply on the panel geometry; they are not properties of
the flow"*. **La matriz se factoriza una vez por geometría; barrer α es una retro-sustitución.**
Es el mismo patrón caro-una-vez/barato-después que ya usa el FEA (`prepareFeaSession` +
`solveLoadOnSession`). ⚠️ Pero el CG disperso del FEA **no sirve**: la matriz de paneles es
densa y no simétrica. Hace falta LU denso.

---

## 6. LA UI — ESTUDIO VIENTO en `forja-brep.html`

**Decisión tomada por el dueño: vive dentro del Part Studio, no en página aparte.**

Buena noticia medida: **el 70% de la plomería de render ya funciona** — partículas advectadas
(6,000 pts en un draw-call), líneas de corriente, onda de choque, rampa `cpColor`, y detección
de gama de GPU para PCs viejas de LATAM. Lo que está mal es de dónde salen los datos.

**Cómo se integra (opción recomendada por el agente de frontend, medida):** un **puerto de
extensión de ~13 líneas** con 6 puntos de inserción exactos. La opción "cero cambios al
monolito" **no funciona** (`window.__forgeBrep` no expone la malla, y un segundo `<Canvas>`
tendría otro depth buffer → el flujo se dibujaría atravesando la pieza). Balance neto: **el
monolito ENCOGE ~330 líneas** mientras gana la feature, y queda abierto el camino para sacar
el FEA después.

**Riesgos concretos ya localizados:** `window.__forgeBrep` se borra y re-crea en cada una de sus
102 dependencias; el overlay de colores se ignora **en silencio** si la longitud no cuadra; y
`FeaDeformMesh` secuestra el render si el alumno corrió el FEA antes (el Cp no aparecería, sin
mensaje). Los tres necesitan guarda explícita.

**Las 2 lecciones AERO ya grabadas:** `a1-l4` (ISA) sobrevive intacta. `a1-l1 p04-p06` sobrevive
**si** el medidor de paneles excluye la base roma y las tapas de envergadura. **`a1-l1 p07` se
rompe** si se redefine `nPaneles`. Camino doble + gate de migración.

**Paleta:** el CSS ya migró a DS v2 (acento cian `#41C7D4`); el panel de viento sigue metiendo
dorado inline. El módulo aero va a `--ds-accent` — además es semánticamente correcto para el
estudio de AIRE.

---

## 7. QUÉ PRECOMPUTA IANGPU

No hay backend y **no hace falta**: `public/precomputed/` ya sirve 472 MB de `.bin`/`.json` por
nginx con su propio `location`. Todo esto entra ahí, cada `.bin` con su `.json` de rangos de
validez y error de validación.

| Qué | Por qué | Prioridad |
|---|---|---|
| **Benchmark real de la 4070 Ti** | El rendimiento citado en el pliego es **interpolación entre dos modelos vecinos**, declarado no verificado. Medirlo es el primer entregable | ⭐ primero |
| Carta θ-β-M | Reemplaza la figura que el propio Anderson lee mal (Ej. 9.13: 23.5° impreso vs 21.60° exacto) | alta |
| Inversa de Prandtl-Meyer `M(ν)` | ~100 kB, ν de 0° a 130.45° paso 0.01° | alta |
| Funciones F y G de compresibilidad | **Resolver las ecs. 18.42/18.43 en vez de digitalizar** las Figs. 18.8/18.9 — desbloquea 2 fixtures | alta |
| Campo `δ(λ,AR)` de línea sustentadora | Ec. 5.60 | media |
| Tablas de cono (Taylor-Maccoll) | Insumo del generador de waveriders. Bertin no lo trae: sale de Anderson | media |
| Base UIUC de perfiles + polares NeuralFoil | NeuralFoil = 8M corridas de XFoil destiladas, 0.37% de error en arrastre | media |
| Corrector multi-fidelidad `δ = verdad − barato` | GP con ~800 muestras RANS ≈ **2.6 MB**, predice en submilisegundo. **Degrada con gracia**: fuera de dominio queda el VLM, física correcta, no alucinación | fase tardía |

**La regla que sale de los números:** un **corrector** necesita 10² muestras y pesa MB; un
**sustituto global** necesita 10³–10⁷ y pesa cientos de MB. Construimos correctores.

---

## 8. FASES Y GATES

Cada fase cierra con fixtures del libro como criterio de aceptación **visible al usuario** —
que el ingeniero vea contra qué número publicado se validó lo que está usando.

**F0 — Cimientos.** Deuda (§4) + `skin.ts` + `wing-metrics.ts` + `panel2d.ts`.
*Gate:* Ej. 3.19 de Anderson a 4 cifras + `Cp=1−4sin²θ` + `src/aero` dentro de `forja-gate.cjs`.

**F1 — El Estudio Viento real.** Cp sobre la piel real (no bbox), capa límite acoplada,
Prandtl-Glauert, polar CL(α) interactiva por retro-sustitución.
*Gate:* NACA 23012 del Ej. 4.6 calculado-vs-experimento + las 2 lecciones migradas.

**F2 — El ala.** VLM 3D + línea sustentadora + métricas del kernel.
*Gate:* Ej. 7.4 de Bertin (`CLα=3.443/rad`) + elíptica ⇒ `e=1.0000` + el fixture de la imagen de babor.

**F3 — El avión.** Sizing de Raymer, diagrama de restricciones, carpet plots, arrastre de Shevell
con los factores de forma ya digitalizados, las 59 ecuaciones de peso, punto neutro y trimado.
*Gate:* las 25 filas de sizing del DR-3 + la ec. 13.6 exacta en sus 11 filas + el gate anti-fraude
`W₀/volumen`.
⚠️ **El gate tiene una trampa deliberada: el DR-3 FALLA su propio requisito de aceleración**
(42.2 s contra 30 s exigidos). **Un test que reproduzca el DR-3 y salga todo verde está mal.**
Y ojo: el DR-3 corre con la ecuación de factor de forma de **ediciones previas**, no con la 12.31
de la 6ª edición — quien implemente "la del libro" y trate de reproducir el caso, falla.

**F4 — El diferenciador.** Adjunto sobre VLM + árbol de features diferenciable (números duales).
*Gate:* gradiente adjunto vs diferencias finitas a 1e-6, y el ciclo completo bajo 16 ms.

---

## 9. LOS REQUISITOS DE COMPORTAMIENTO (los que una máquina lineal se salta)

Salieron del cruce y son de producto, no de ecuación. Van a `aero-contratos.ts` (patrón
`mold-contratos.ts`):

1. **Avisar cuando el usuario sale del dominio de la herramienta.** La "barrera del sonido" fue
   Prandtl-Glauert evaluada donde su propia derivación dice que no vale — **y mató gente**
   (deHavilland hijo, 1946; es el epígrafe con que Anderson abre el cap. 11). Cada solver declara
   su rango y el software lo hace cumplir.
2. **No tener "un óptimo".** El AR óptimo de un transporte es **7.5 / 9.8 / 12.0 / 15.2** según
   la figura de mérito. El software pregunta cuál persigues.
3. **Mostrar el conflicto, no esconderlo.** Los puntos de diseño de un caza tienen requisitos
   contrarios (Bertin §13). Dos de los tres manuales piden lo mismo: **muéstrame el espacio de
   diseño, no me des una respuesta.**
4. **Las restricciones son salida del diálogo, no entrada.** Raymer, al ver que el alargamiento
   se le iba a cero, escribió a mano *"THEREFORE, WE NEED SOME REQUIREMENT BASED ON MANEUVERING"*
   e inventó el requisito. **Un optimizador que solo acepta restricciones al arrancar está
   construido contra el cliente.**
5. **Estampar siempre las cantidades de referencia** (§3).
6. **Enseñar a elegir método, no un método.** La lección de cierre construye **una sola ala** y
   cambia el selector seis veces, mostrando tiempo de cálculo y la lista de lo que cada método no
   ve. Con el dato que lo hace honesto: **un método lineal corregido le ganó a un código de
   Euler** en alas con vórtice de borde de ataque. La fidelidad no está ordenada por costo.

---

## 9-bis. ESTADO (2026-08-04) — F0 CERRADO

**Construido y verde (245 tests en `src/aero` + `src/forja`; `src/aero` pasó de 25 a 98):**
- Los 6 defectos de §4, pagados. El del croquis **no era** el pivote del solver denso sino el
  amortiguamiento de Levenberg-Marquardt, que escalaba cada diagonal por su propia magnitud y
  por tanto no regularizaba: con la cuerda de un perfil el paso salía con Δy≈44,000. Verificado
  revirtiendo. Ahora el solver es además invariante a las unidades.
- `skin.ts` — la piel, validada por `∮n̂dS=0` y por el volumen de divergencia contra el kernel.
- `wing-metrics.ts` — S exacta por proyección (sin muestreo), y MAC/MGC separadas por nombre.
- `panel2d.ts` — **el Ejemplo 3.19 completo pasa**: los 6 coeficientes, la fila 4 de la matriz,
  las 8 intensidades y `Σλ·S=0`. Medido de más: en los puntos de control la solución es EXACTA
  a precisión de máquina ya con 8 paneles (Anderson comparaba la curva completa, donde sí hay
  error de discretización). `prepararPaneles`/`resolverAlpha` implementan la separación
  caro-una-vez/barato-después, con test de que barrer 41 α reusando la LU da bit a bit lo mismo.

**Rescate de figuras y ecuaciones (4 tandas, método validado):** el procedimiento que funciona
es renderizar a 300-400 dpi y **trazar las curvas pixel por pixel con scripts**, no leerlas a
ojo (±1% en vez de ±5%), más **auditoría de cobertura**: pintar los píxeles de tinta que ninguna
curva trazada explica. Cuatro figuras salieron con 0.00% de tinta sin explicar. Y siempre
verificación cruzada contra un número que el propio libro imprima.

**Lo que el rescate cambió del plan:**
1. **La Ec. 12.27 (Cf turbulento con corrección de Mach) NO ESTÁ IMPRESA en la 6ª edición** —
   verificado por tres vías. El libro la referencia 4 veces y nunca la da. Se recuperó por
   evidencia (la Fig. 12.22 se graficó con ella y reproduce `0.455/(log10 R)^2.58` a −0.6/+1.9%).
   El factor de Mach de ediciones previas quedó marcado **sin verificar**.
2. **El offset de página de Raymer NO es constante**: +30 hasta PDF 619, +32 después. Ver el
   LEEME del corpus. **Verificar el folio impreso** antes de transcribir, siempre.
3. **No hay ejemplo numérico de build-up de arrastre resuelto en el cap. 12**, ni ejemplos que
   lean valores de figuras en el 16 → F3 arranca **sin caso de regresión publicado** para esos
   módulos; hay que construir la validación con los invariantes, no con un número del libro.
4. **Erratas confirmadas que muerden**: rugosidad del compuesto moldeado (el valor en pies perdió
   un dígito; con el impreso, un compuesto sale más rugoso que el metal pulido); Ec. 17.49 con el
   signo invertido (da tiempo de ascenso NEGATIVO); el momento total de la tabla de pesos omite
   el payload aunque el peso sí lo incluye (mismo *bug de contabilidad* del pliego de moldes);
   una curva rotulada "Design CL=0.8" cuyo máximo está en 0.72.
5. **Trampa de unidades sin declarar**: `Cm_α` del fuselaje sale **por grado** y el punto neutro
   lo consume **por radián**. Factor 57.3, y el libro no lo dice.
6. **Un dato anómalo que NO es errata**: la fila del entrenador militar en la tabla de radios de
   giro se juzgó con el teorema de ejes perpendiculares sobre las 12 filas — da −4.3% de error,
   *mejor* que el promedio. Viene así de la fuente original: bandera `OUTLIER`, jamás sustituir
   en silencio.
7. **Coeficientes de rodadura**: la celda perdida era un **rango 0.03–0.05**, no un escalar.
   Usar el 0.03 del cuerpo del texto subestima µ hasta 67%.

---

## 10. DECISIONES ABIERTAS

1. **¿F4 (el adjunto) se adelanta?** Es el diferenciador y nadie lo tiene, pero necesita F2. La
   alternativa es un F1.5 con adjunto sobre `panel2d` solo (2D), que da el efecto "arrastra y ve
   el gradiente" antes.
2. **El corrector multi-fidelidad exige un generador de verdad** (SU2 en iangpu) para las ~800
   muestras. Es un proyecto propio. ¿Va en F4 o se pospone?
3. **La infraestructura de curvas escaneadas es un proyecto propio.** Raymer trae **~20 familias
   de curvas** (factores de forma, empuje instalado, pesos, derivadas de estabilidad) que son
   imagen. El método ya está probado —trazado pixel por pixel con scripts, no a ojo, validado
   contra los números que el propio libro imprime— pero 20 familias es una tanda dedicada, no un
   pendiente suelto. ¿Va antes de F3 o en paralelo?
4. **Las ecs. 18.8, 18.10–18.13 de Raymer** (costos) están destruidas por el OCR: coeficientes
   legibles, agrupación no. Mismo remedio: renderizar esas páginas del PDF.
5. **Cuánto de Raymer se cita y cuánto se implementa.** El agente marcó **31 valores
   `[OCR DUDOSO]`** y **43 `[CUERPO PERDIDO]`** en vez de adivinarlos, y detectó 4 ecuaciones que
   el pliego previo daba por completas pero que no son legibles en el texto. La regla #1 obliga a
   marcarles procedencia antes de convertirlas en código.
