# La Forja — Reproducción de tutoriales (grind autónomo)

**Método:** reproducir cada tutorial de los manuales POR CLICKS dentro de La Forja (arnés `forja-drive.cjs`), construyendo la función que cada tutorial exija. Verificar por **invariantes exactos** (volumen/euler) **+ sight** (comparar 3D vs la figura del libro). Producir un **videotutorial automático** (grabación de la sesión → mp4 recortado).

**Protocolo RAM (iangpu caído, todo en la laptop):**
- UN solo Chrome del arnés a la vez (secuencial, nunca en paralelo).
- Agentes/workflows SOLO para lectura/extracción (ligeros, sin Chrome ni build).
- Vite dev local en :5001 (un proceso). Sin `tsc`/`build` locales.
- Videos recortados con `leadMs` (la laptop tarda ~34s en compilar el wasm de OCCT).

**Pipeline por tutorial:** leer figura (medidas) → plan de gestos → `forja-drive` (1 Chrome, REC) → invariantes + sight → trim video → marcar aquí.

---

## Estado

| # | Tutorial | Objetivo | Función construida | Verif. | Video |
|---|---|---|---|---|---|
| 1 | Fusion c2-T1 | Doble-T + ventana → extrude cavidad (Fig 2-3/2-4) | Dynamic Input línea + multi-lazo/cavidad | vol 30000 ✓ euler 2 | `tut1-videotutorial.mp4` ✓ |
| 2 | Fusion c2-T2 | Bloque + 2 canales R12 (Fig 2-16/2-17) | Dynamic Input arco (Center Point Arc) | vol 11860 ✓ euler 2 | `tut2-videotutorial.mp4` ✓ |
| 3 | Fusion c3-T1 | I-beam (Fig 3-1) → restringir + acotar | **Auto-relaciones H/V al dibujar** + **simétrica ⋈** + ancla + cotas | DOF 34→17→15→11 ✓ mecanismo, **NO 0 aún** | `tut3-videotutorial.mp4` ⚠️ parcial |
| 4 | Fusion c4-T1 | Lever 3 agujeros (Fig 4-1/4-2) | **Círculo con medida** + perfil mixto arcos+tangentes | euler 2, vol 7077.9, 3 holes ✓ | `tut4-videotutorial.mp4` ✓ |
| 3b | Fusion c3-T2 | Spool revolucionado (Fig 3-11) | **Revolve 360° eje Y** (perfil cerrado x=radio) | euler 4 (seams), revolve ✓ | `tut3b-videotutorial.mp4` ✓ |
| 4b | Fusion c4-T2 | Shaft escalonado 180° (Fig 4-16) | **Revolve 180° eje X** (`input-angulo`+`axis-x`) | euler 2, vol 29681 ✓ | `tut4b-videotutorial.mp4` ✓ |
| 5p | Fusion c5 base | croquizar en plano (cilindro YZ) | **PLANE_YZ/XZ + offsetPlane + selector** | com=[6,0,0] orientado en X ✓ | `tut5-plano-yz.mp4` ✓ |
| c3T3 | Fusion c3-T3 | Horquilla U (Fig 3-16/3-17) | arco centro→inicio→fin + 2 círculos | euler 2, vol 14638.9 ✓ | `c3t3-videotutorial-laforja.mp4` ✓ |
| c3T4 | Fusion c3-T4 | Wishbone "Y" (Fig 3-22/3-24/3-25): arco R15 + Ø20 + brazos 135° | **lazo mixto 9 líneas+arco+círculo** por entrada dinámica exacta | euler 2, vol 22820.12 (=área 1901.68×12, a mano 1902.35) ✓ | `c3t4-videotutorial-laforja.mp4` ✓ |
| c4T3a | Fusion c4-T3 **Feature 1** | Placa base U-yoke 130×100×10 + 4×Ø10 + Ø60 central (Fig 4-25/4-26) | rect+5 círculos → extrude + **altura fijada a 10** (input-altura) | euler 2, vol 98584.07 (=exacto a mano) ✓ | `c4t3-base-videotutorial-laforja.mp4` ✓ |

| c3T4📐 | Fusion c3-T4 **AL ESTILO DEL LIBRO** | Wishbone: dibujar A OJO → restringir → **ACOTAR** (cotas visibles, CERO coordenadas) | dibujo con mouse + restricciones + cotas que MANEJAN la geometría | **DOF 0 · "Totalmente restringido ✓"** (arco R15+Ø20 concéntrico+cuellos 25+brazos 135°+tapas 12.5) | `c3t4-CROQUIS-LIBRO-laforja.mp4` ✓ |

| c3T3📐 | Fusion c3-T3 **AL ESTILO DEL LIBRO** | Clevis/horquilla U (Fig 3-16/3-17): 5 arcos tangentes + ranura U + 2 barrenos Ø8 | dibujar a ojo (5 líneas+5 arcos+2 círculos) + tangencias/radios-iguales + cotas | forma CALCADA, convergido AZUL 18 GDL (cotas R10/R7.5/15/20/Ø8 visibles) | `c3t3-CLEVIS-LIBRO-laforja.mp4` ✓ (con mouse) |

| c4T4📐 | Fusion c4-T4 **RUEDA DE TREN — Feature 1 (revolve)** | Perfil de media sección (7 líneas+3 arcos: R15 rim+2×R5 rebaje) → **Revolve 360° eje Y** | dibujado a ojo + R15/R5/rebaje-15 + revolve; borrar auto-extrude → revolve limpio | rueda válida (vol 548454, cubo+barreno+canal+rim) | `c4t4-RUEDA-TREN-revolve-laforja.mp4` ✓ (mouse) |

> **c4-T4 progreso: Feature 1 (revolve) + Feature 4 (perno) HECHOS.** El **perno Crank Pin** (Ø28×50, Join a 65mm) se hizo croquizando sobre la CARA de la rueda — para lo cual se programaron 2 tools nuevos: **input de OFFSET de plano** (`input-plane-offset`, croquizar sobre una cara desplazada; también desbloquea las paredes de c4-T3) y **profundidad de componente de croquis** (`input-comp-depth`, el perno son 50mm). vol 548454→579192 (+30738 = cilindro Ø28×50 exacto).
> **c4-T4 COMPLETA (4/4 features) 🚂 — Fig 4-45.** revolve + **6 rayos** (corte sector Ø70-Ø120/30°/15° + patrón circular ×6) + **perno Crank Pin** (Ø28×50 Join). `c4t4-RUEDA-TREN-COMPLETA-laforja.mp4`. El BUG del corte era MÍO: mi patrón llamaba `transformShape` SIN `translate` → "undefined is not iterable"; + la dirección del extrude (normal de XZ = −Y, así que offset −20 pone el plano en Y=+20 y baja a través del web). Aislado probando el sector como base-extrude (vol 7444 ✓) → el perfil servía, el bug era el patrón/dirección.
> **UI DESPEJADA (el user: "está todo amontonado"):** toolbar con `flex-wrap` + botones más chicos + grupos etiquetados **"Croquis en" / "Features"** + separador (antes 17 botones en 1 fila se cortaban); panel de componente-de-croquis muestra solo Profundidad+Patrón (antes Radio/Altura basura). Se ve en 2 filas limpias.
> **LECCIÓN (el user, de nuevo): VER las imágenes + seguir el libro literal.** Me cachó sin mirar Fig 4-39. Al VERLA quedó claro el corte. [[feedback_verification]]
> **c4-T4 — 3 TOOLS NUEVOS.** Se programaron: `input-plane-offset` (croquis sobre cara), `input-comp-depth` (profundidad de componente), y **`input-comp-patn` (patrón CIRCULAR de componente ×N rotado en Y)** — el tool que faltaba para los rayos (el patrón viejo fusionaba el cuerpo entero). El sector Ø70-Ø120 (30°, a 15°) SE DIBUJA bien (2 líneas+2 arcos, lazo cerrado) y patternCount=6 está cableado, PERO el **corte-sector no intersecta el cuerpo** (vol sin cambio): bug en la extracción del perfil-sector-con-arcos como componente, o la dirección del extrude sobre el plano offset. Es la última pieza — necesita 1 pasada de depuración (probar el sector como base-extrude para aislar si el bug es el perfil o la composición del corte).
> **Arnés — ZOOM-FIT para piezas grandes (2026-06-30):** env `TZOOM=N` hace N scroll-out antes del turntable (la rueda Ø185 no cabía en el frame por defecto). `TZOOM=9` la encuadró.

> **VIDEOS CON MOUSE VISIBLE (2026-06-30):** el arnés ahora dibuja un cursor SVG que se DESLIZA a cada objetivo + pulso ámbar al clic (se pidió para que se vea en los videos). En `forja-drive.cjs`: inyecta `#__cur` al body (z-index máx) que sigue mousemove; `glide()`/`glideEl()` mueven el mouse en pasos antes de cada gesto.

> **c3-T3 — etiquetas de cota ARREGLADAS (2026-06-30):** ahora dibuja **R10, R7.5, R7.5(U), Ø8×2, 15, 20** correctas (calcado de Fig 3-17). Se programó: tipo de restricción **`diameter`** (rotula Ø), **`arcRadius`** (rotula R en arcos), y render de **`distX/distY`** (cotas H/V alineadas) en DimAnnotations. Video re-entregado con esas etiquetas + mouse.
> **c3-T3 pendientes honestos (no bloquean el video):** (1) la cadena de **5 arcos tangentes** NO llega a DOF 0 limpio (quedó AZUL 18 GDL, forma correcta): a precisión de PIXEL del trazo las 10 tangencias se sobredeterminan y el solver marca conflicto; para el verde falta dibujo sub-pixel o simetría por centerline. (2) Las cotas verticales **40 y 20** del libro apuntan al TOP del prong (punto medio de arco) → falta **acotar a cuadrante/tangente de arco**.

> **HITO 2026-06-30 — el método CORRECTO (cotas, no coordenadas).** El user cachó que yo construía con coordenadas; el libro dibuja a ojo y ACOTA. Rehecho bien. Para lograrlo se construyó/arregló el MOTOR del croquis (durable, reusable en TODOS los tutoriales):
> - **Cotas nuevas** (solver+UI): angular, **diámetro Ø**, radio-de-arco, y **lineal H/V alineada**. (Ya había distancia+radio.)
> - **Restricciones nuevas**: Tangente línea↔arco (con LADO fijo, no flipea), Igual arcos/círculos.
> - **3 bugs de solver arreglados**: ángulo medido en el **vértice compartido** (no el agudo a→b) + **rama fija por signo** (evita 135↔−45); tangente con **lado fijo** (evita volar el cuello).
> - **Arnés fiable** (`forja-drive.cjs`): acciones `hook`/`pick`/`dimDist`/`dimAngle`/`dimArcR`/`dimDiam`/`clickmm`/`clickarc`/`clickcircle` → seleccionar y acotar POR ÍNDICE (nada de adivinar pixeles). Dibujar sigue siendo mouse (clickmm).
> - **UI más intuitiva (vs manual/Fusion)**: atajos de teclado REALES (L/C/R/A/D/V/P/F/X/Esc), toolbar agrupado y etiquetado (Dibujar·Acotar·Restringir), tooltips que enseñan, indicador "Totalmente restringido ✓". Se arregló que el grupo Restringir chocaba con las pastillas de modo.
> - **Truco de convergencia**: dibujar cerca de la forma final (cuenca correcta) + set MÍNIMO no-redundante (angle+perp+cap+parallel por brazo = 4 en 4, exacto).

> **c4-T3 TERMINADO (base + 2 paredes) 2026-06-30** — con el `input-plane-offset` nuevo YA se pueden croquizar las paredes sobre las caras x=±65. base 130×100×10 (Ø60 + 4×Ø10) + **2 paredes laterales** (pentágono 120×100 con esquina achaflanada 55/35 + 2×Ø10 c/u), croquis en plano YZ offset ±65, Join 10mm. `c4t3-U-YOKE-completo-laforja.mp4`. Honesto: vio la Fig 4-24/4-27 para clavar la orientación (paredes perpendiculares a la base, U hacia arriba). Pendiente cosmético: chamfer 2×45 en la arista de la base; y verificar cotas exactas de pared (el encuadre del turntable es pobre para piezas altas de 120mm). El bloqueo real (croquis-sobre-cara) YA está resuelto.
> **[obsoleto] c4-T3 quedaba PARCIAL:** entregada la placa base (Feature 1) fiel y verificada.
> Las paredes (Feature 2), el mirror (Feature 3) y el chamfer de arista (Feature 5) EXIGEN tools que
> La Forja aún no tiene por UI — este tutorial las DESTAPA (lo que el user pidió surfacear):
> 1. **Input de OFFSET de plano / croquis-sobre-cara** (el kernel ya tiene `offsetPlane`+`planeOffset`, falta el input en la barra de planos para poner el croquis en la cara x=±65).
> 2. **Mirror de FEATURE** respecto a un plano (YZ) — hoy solo hay patrón.
> 3. **Extrude Two-Sides** (Side1/Side2 independientes) + operación Join como cuerpo.
> 4. **Chamfer por ARISTA seleccionada** (hoy `btn-chamfer` bisela TODAS las aristas; falta edge-picking).
> Siguiente paso de PROGRAMACIÓN: (1) es el más chico y desbloquea las paredes → construir el input de offset primero.

## Cola (orden: diseño Fusion → molde SolidWorks → CAM Cimo)

- [~] Fusion c3-T1 — auto-relaciones (HECHO) + cotas (mecanismo HECHO); **falta** llevarlo a DOF=0 (faltan ~11 cotas; el libro usa restricciones 'equal'/symmetric para reducirlas → construir 'igual' por clic + 'simétrico')
- [ ] Fusion c3-T2 — más restricciones + cotas
- [ ] Fusion c4-T1, c4-T2 — Advanced Modeling I (extrude/revolve/hole/fillet/chamfer/shell)
- [ ] Fusion c5-T1, c5-T2 — Reference Geometry (planos/ejes/puntos)
- [ ] Fusion c6-T1, c6-T2 — Advanced Modeling II (sweep/loft/rib/pattern/mirror)
- [ ] Fusion c7 — Ensamble (joints)
- [ ] Fusion c8 — Planos 2D de taller (drawing.ts) + animación
- [ ] Fusion c9 — Chapa
- [ ] Fusion c10 — 3D printing / exportar
- [ ] SolidWorks c6 — **MOLDE de plástico** (el evaluador): draft→scale→shut-off→parting→tooling split
- [ ] SolidWorks c1 (superficies), c3 (chapa), c7 (FEA), c8 (weldments)
- [ ] Cimo CAM c1-18 — torneado/fresado/láser/aditivo (fase posterior)

## 20 VIDEOS entregados (Downloads) — meta del user cumplida
Tanda 1 (tutoriales fieles): tut1·tut2·tut3·tut3b·tut4·tut4b·tut5-plano-yz·multifeature·tut6·mold-cavity (10).
Tanda 2 (features por op, base+modificador, sin picking): **fillet · chamfer · patron · loft · sweep · gear (engrane involuta) · hex · washer (revolve anular) · tuerca (hex−barreno)** (10). Total = **20**.
Gotchas: revolve con arista SOBRE el eje falla (cono) → usar perfil anular; shell con faces:[] no abre (necesita picking de cara); gearbox cicloidal = screenshot timeout (pesado).
Pendiente real (cada uno = build grande, en la lista de tareas): ensamble(c7) · planos2D(c8) · chapa(c9) · slicing(c10) · molde COMPLETO (draft+parting+tooling split) · CAM. Y mejorar UX croquis→feature (no auto-extrude forzado).

## Tanda grind 2026-06-30 — 10 videos en Downloads
tut1 (doble-T+cavidad) · tut2 (canales R12) · tut3 (auto-relaciones+cotas) · tut3b (spool revolve Y) · tut4 (lever 3 agujeros) · tut4b (shaft revolve X 180°) · tut5-plano-yz (croquis YZ) · multifeature-demo (base+unir+cortar) · tut6 (bracket multi-feature) · **mold-cavity (placa-molde con cavidad en L = EVALUADOR, keystone Cavidad)**.
Funciones nuevas usadas: revolve (X/Y, ángulo numérico) · planos XY/YZ/XZ+offset · **multi-feature (croquis-componente unir/cortar)** · **Cavidad de molde (block−part)**.
Falta para molde COMPLETO: draft analysis + parting line/surface + tooling split (core+cavity). El keystone (cavidad) ✓.

## Funciones construidas (acumulado)
- Dynamic Input línea (L+ángulo / X,Y) — c2-T1
- Multi-lazo → cavidad (`extrudePolygonWithHoles`) — c2-T1
- Dynamic Input arco (centro→inicio→fin) — c2-T2
- Arranque limpio (doc vacío) + rename Croquis→**Planos** + arnés: `fill`/`tclick`/`clickpt`/`clickline`/`REC`/`leadMs`
- **Auto-relaciones H/V al dibujar** (DOF baja solo) — c3-T1
- **Restricción simétrica** ⋈ (solver + UI, 2 puntos + eje) — c3-T1 (para definir con la mitad de cotas)
- **Círculo con medida exacta** (entrada dinámica centro→radio) — c4-T1

## Pendientes destapados (construir cuando un tutorial los exija de nuevo)
- [ ] **TRIM** (recortar arcos/líneas en intersecciones) — c4 lo evadí dibujando los arcos/tangentes directo (resultado fiel); construir el TRIM interactivo
- [ ] **Botón tangente** (línea+círculo → `tangentLC`, ya en solver)

## c5-T1 = EL MURO GRANDE (Fig 5-4): modelo de 8 features
Bases que destapó (voy construyéndolas):
- [x] **Croquizar en plano SELECCIONADO** (XY/YZ/XZ) — HECHO: `PLANE_YZ/XZ` + `offsetPlane` en occt + selector UI + verificado (cilindro en YZ sale orientado en X, com=[6,0,0]). Clip `tut5-plano-yz.mp4`
- [x] **Planos de referencia a offset** (`offsetPlane`) — HECHO en kernel; falta UI de "plano a distancia"
- [ ] **Extrude de CORTE** desde croquis (no solo Hole cilíndrico)
- [ ] **Extrude dos lados** (Side1/Side2 distancias distintas) + simétrico Half/Whole
- [ ] **Árbol multi-feature** (croquis→feature→croquis→feature encadenados en planos distintos)
Esta es la base gorda del modelado 3D real; varios tutoriales (5,6,7) la van a exigir.
