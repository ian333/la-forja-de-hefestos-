# Plan maestro: CAM generativo por clicks para La Forja

## 1. Propósito

Darle a La Forja la capa de **manufactura (CAM)** que hoy no existe: del modelo B-Rep que ya sabemos construir, llegar a **G-code válido y simulado sin colisión por clicks**, más un módulo de **molde de plástico** que cierra el evaluador de CAD. Reutilizar OSS permisivo donde se pueda, construir solo el hueco real, y mantener la misión: navegador, español mexicano, gratis/ultra-barato, accesible para LATAM.

---

## 2. Pipeline CAM universal (destilado del libro)

Mismo flujo para torno, fresa, láser y aditivo (cap. 18 lo confirma como invariante):

1. **CAD / modelo** — pieza final en B-Rep; opcional *defeaturing* y *spun profile* (axisimétrico) para simplificar.
2. **Setup** — elegir tecnología (torno/fresa/láser/aditivo); cada una cambia operaciones y parámetros disponibles.
3. **Stock** — definir el bruto (cilindro/tubo/caja/chapa/modelo) con sobre-medida; fixed o relative.
4. **WCS / origen** — fijar cero y orientación (right-handed obligatorio en torno), offset G54…, plano Safe Z y plano de mandril (Danger Z).
5. **Herramienta** — elegir del catálogo por código ISO (inserto + shank/holder), geometría (radio nariz, KAPR, rake) y datos de corte.
6. **Estrategia / operación** — face, profiling rough/finish, groove, thread, drill (torno); face, adaptive clearing, pocket, contour, drill+pecking, thread mill, morphed spiral (fresa); perfil 2D + tabs + kerf (láser); orientación + soportes + infill (aditivo).
7. **Trayectoria (toolpath)** — generar pasadas respetando ap/ae, feeds & speeds, tolerancia de discretización, climb vs conventional, lead-in/out, retracts.
8. **Simular** — remoción de material; detectar colisión (herramienta/shank vs stock/chuck/fixture), gouge, corte en aire; verificación por color (verde/azul/rojo).
9. **Post-procesar** — traducir trayectorias al dialecto G-code de la máquina (G0/G1/M3/M5, G54, ciclos enlatados) desde la cinemática de la máquina.
10. **G-code** — archivo final, parseable por un intérprete real (grbl/LinuxCNC) y verificable en visor.

---

## 3. La Forja HOY vs el pipeline (gap honesto)

| Etapa | Estado | Detalle |
|---|---|---|
| CAD / modelo | ✅ **Maduro** | OCCT-WASM completo (occt.ts, 1611 LOC): primitivas, extrude/revolve/loft/sweep, booleanas, fillet/chamfer/shell, STEP I/O, inspección (volumen, masa, inercia), `enumerateFaces` clasifica plane/cyl/cone/sphere. |
| Setup | ⚠️ **Parcial** | `machine-config.ts` parsea `.mch` de Fusion (cinemática 3/4/5-ej, torno, FDM). Importa máquina, no arma setup CAM. |
| Stock | ⚠️ **Sustrato sí, UI no** | `brepToVolumeTetMesh` voxeliza AABB; `makeBox`/`makeCylinder` dan el bruto. Falta el objeto Setup→Stock por clicks. |
| WCS / origen | ❌ Falta | No hay editor WCS, Safe Z, ni offsets. |
| Herramienta | ❌ Falta | Sin biblioteca de tools, sin parser ISO, sin datos de corte. |
| Estrategia | ❌ Falta | Cero estrategias de pasada. |
| Trayectoria | ❌ **Hueco total** | Confirmado por grep: cero offset de contorno a radio, cero pasadas. |
| Simular | ⚠️ **Sustrato sí** | `cut` + `sweepProfileAlong` permiten simular remoción (stock − volumen barrido) sin código nuevo; falta orquestarlo. |
| Post / G-code | ❌ **Hueco total** | Cero emisión G-code. Los 4 botones de "Fabricación" en ForgePage están `disabled:true`, acción vacía. |
| **Molde** | ⚠️ **Cercano** | `subtractFrom` = bloque − pieza = cavidad (booleana cruda). Falta draft, línea de partición, undercuts. |
| Generativo | ✅ **Maduro** | topopt SIMP+OC (top88 literal) + AM overhang filter, sobre el FEA verificado. |
| Planos 2D | ✅ Maduro | drawing.ts: HLR real, vistas, cotas, SVG, puro/testeable. |
| Sketcher 2D | ⚠️ A medias | sketch-solver + SketchEditor; faltan ~50 funciones (trim, offset, cotas). |

**Resumen:** el CAD está al ~7/10; el CAM está al ~0.5/10 (solo importa cinemática). Estamos al ~1/100 de "un tornillo limpio por clicks". El kernel da **casi todo el sustrato geométrico** que CAM necesita — reusar, no reinventar.

---

## 4. Tabla de reutilización open-source

| Pieza | Licencia | Browser | Qué nos resuelve | Veredicto |
|---|---|---|---|---|
| **Clipper2-WASM** | Boost (BSL-1.0) | ✅ WASM | Offset de polígonos = pasadas de fresado, contornos, pocketing, kerf láser. El ladrillo base 2D. | **ADOPTAR** — permisiva total, estándar 15 años. |
| **Kiri:Moto** (grid-apps) | MIT | ✅ JS puro | Motor CAM completo: fresado 2.5/3D + láser + slicing FDM + G-code + posts. | **ADOPTAR (forkear)** — única pieza permisiva batteries-included; arranque de semanas. |
| **manifold** (manifold-3d) | Apache-2.0 | ✅ WASM | Booleanas sólidas robustas 2-manifold; corte de planos de capa; cavidad de molde. | **ADOPTAR** — permisiva, motor CSG de OpenSCAD/Blender. |
| **three-bvh-csg + three-mesh-bvh** | MIT | ✅ R3F nativo | Booleanas y queries en vivo en la UI; draft analysis acelerado por BVH. | **ADOPTAR** — feedback interactivo. |
| **opencascade.js / occt** (ya en stack) | LGPL + excepción OCCT | ✅ WASM | Kernel B-Rep exacto; HLR/silueta = línea de partición; BRepOffset/Section para molde. | **YA ADOPTADO** — reusar, no sumar dependencia. |
| **SVGnest** | MIT | ✅ | Nesting de piezas láser (genético + NFP). | **ADOPTAR** para P3. |
| **Deepnest (deepnest-next)** | MIT | ⚠️ Worker | Nesting de producción, motor C más rápido. | **ADOPTAR** en Worker cuando haga falta velocidad. |
| **gcode-parser / gcode-toolpath** (cncjs) | MIT | ✅ | Parsear y visualizar/simular G-code = gate de verificación. | **ADOPTAR** — cierra el lazo de inspección. |
| **PathKit** (Skia) | BSD-3 | ✅ WASM | Respaldo permisivo a Clipper para paths vectoriales láser. | **RESPALDO** opcional. |
| **OpenCAMLib** | LGPL | ✅ WASM | Acabado 3D de superficie (dropcutter/waterline) que Clipper 2D no cubre. | **CON CUIDADO** — solo WASM enlazado dinámico; riesgo medio para bundling estático. |
| **cura-wasm / CuraEngine** | AGPL-3.0 | ✅ WASM | Slicing FDM de referencia en calidad. | **SOLO BENCHMARK** — AGPL envenena SaaS; medir calidad, no embeber. |
| **jscut** | GPLv3 | ✅ | CAM 2D pionero. | **DESCARTAR** (referencia de algoritmos) — copyleft. |
| **LaserWeb4** | AGPLv3 | ✅ | CAM láser+CNC completo. | **DESCARTAR** (referencia) — AGPL = peor caso SaaS. |
| **CAMotics** | GPLv2 | ❌ desktop | Simulador de remoción 3-axis. | **DESCARTAR** (referencia) — copyleft + no browser. |
| **PrusaSlicer / Orca** | AGPL-3.0 | ❌ | Algoritmos de oro (Arachne, ironing). | **MINAR ALGORITMOS**, no código. |

**Regla de licencia dura:** La Forja es SaaS servido por web → servir JS modificado = distribución. **Cero AGPL/GPL embebido.** Cuadrilla segura: MIT + Boost + Apache + BSD + (LGPL OCCT con excepción).

---

## 5 y 6. Roadmap por fases

> Cada fase: entregable, qué reutilizar vs construir, dificultad/riesgo real, evaluador, y verificación por sight con `forja-drive.cjs` (Claude maneja la UI real en iangpu:5001 viendo screenshots).

### P0 — Molde de plástico por clicks (CAD) — *empezar aquí*

**Por qué primero:** es el evaluador de CAD que ya está a medias (`subtractFrom` da la cavidad cruda), no necesita motor de trayectorias, y reutiliza occt.ts + drawing.ts + fea.ts sin sumar dependencias. Cierra una promesa vieja del proyecto.

**Entregable:** flujo por clicks que toma una pieza, define dirección de extracción, **pinta draft (verde/amarillo/rojo)**, extrae **línea de partición**, marca **undercuts**, y genera **cavidad + núcleo** partidos en la superficie de partición, exportables a STEP.

**Reutilizar:** OCCT (`BRepAlgoAPI_Cut` para bloque−pieza, `BRepAlgoAPI_Section` para partir; HLR de drawing.ts para silueta exacta); three-mesh-bvh para draft en vivo; three-bvh-csg para preview interactivo; manifold para la cavidad robusta del entregable.

**Construir:**
- Draft analysis sobre malla: `signo(dot(normal, pull))` → verde si `≥ sin(ang_min)`, amarillo si positivo-insuficiente, rojo si negativo. Vertex-colors en R3F.
- Línea de partición = silueta donde `normal·pull = 0` (vía HLR OCCT, reusa drawing.ts).
- Detector de undercut = regiones rojas sin acción lateral → marcar lifters/correderas.
- UI: picker de dirección de extracción, slider de ángulo mínimo, generar core/cavity.

**Dificultad/riesgo:** **Media.** Matemática barata (draft/silueta son signos de producto punto). Riesgo: HLR de líneas de partición en piezas con caras tangentes; mitigable cayendo a malla. Cero dependencias nuevas.

**Evaluador (extiende el existente):** cargar pieza con draft conocido + un undercut → el sistema marca exactamente las caras rojas esperadas; la línea de partición coincide con la silueta teórica; core+cavity al re-unir reproducen el bloque menos la pieza dentro de tolerancia; STEP re-importable.

**Verificación por sight:** `forja-drive.cjs` maneja la UI — elige cara de pull, ve el mapa verde/rojo en screenshot, dispara partición, juzga visualmente que la cavidad es la pieza invertida. Métrica (caras rojas correctas) es cross-check, no el volante.

---

### P1 — CAM fresado mínimo (3 ejes)

**Por qué segundo:** es el grueso del libro (cap. 6-10), el dominio con más OSS maduro reutilizable, y **activa los 4 botones disabled de Fabricación**. Máximo desbloqueo de valor.

**Entregable:** por clicks — Setup → Stock (caja relativa) → WCS/G54 → herramienta del catálogo → **face + 2D adaptive clearing + 2D contour + drill** → trayectoria → simular sin colisión → **G-code parseable por grbl/LinuxCNC**.

**Reutilizar:**
- **Kiri:Moto forkeado** como motor de arranque (face, pocket/adaptive, contour, drill, posts) — la ruta de semanas, no meses.
- **Clipper2-WASM** para offsets de contorno/pasadas (el núcleo propio que escala sin pedir permiso).
- `enumerateFaces` (ya existe) para detección de features: planas→face, cilindros→drill/contour, bolsas→pocket.
- `cut` + `sweepProfileAlong` (ya existen) para **simular remoción** sin código nuevo.
- `machine-config.ts` (ya existe) como **target del post-procesador**.
- gcode-parser/gcode-toolpath para el visor de verificación.

**Construir (el hueco real, donde no hay ni una línea):**
- Envolver `BRepOffsetAPI_MakeOffset` en occt.ts (igual que loft/sweep ya envueltos) → offset de wires a radio de herramienta.
- Objeto Setup/Stock/WCS por clicks (Safe Z, Danger Z, G54).
- Biblioteca de herramientas + datos de corte (feeds & speeds con fórmulas reales: `Vc=π·D·n/1000`, `vf=fz·z·n`, potencia `Pc` y **torque**).
- Linking (lead-in/out, retracts, rapidos), orden de operaciones, climb.
- Post-procesador G-code que lea machine-config (G0/G1/M3/M5/G54).
- Simulación de remoción orquestada sobre cut+sweep + verificación color.

**Decisión de arquitectura:** forkear Kiri:Moto para velocidad **y en paralelo** cimentar el CAM propio sobre Clipper2 (control total, diferenciador). Empezar por el mínimo que prende los botones: MakeOffset + contorno 2D a profundidad Z + post trivial.

**Dificultad/riesgo:** **Alta.** Es el módulo más grande. Riesgo: integrar el modelo de datos de Kiri:Moto con nuestro árbol de features; la simulación de colisión shank/fixture es exigente. Mitigación: arrancar con contorno 2D simple antes que adaptive 3D.

**Evaluador:** "fresar una placa por clicks" — bloque 110×110×45, face que cubre la cara (Pass Extension fuera del stock, Stepover correcto, climb), adaptive clearing con carga ~constante respetando regla de oro (ae≠Ø/2), drill+pecking de N barrenos (Select Same Diameter). Invariantes: trayectoria dentro del stock, 0 colisiones (Stop on collision), potencia Y torque ≤ límites de máquina, resultado VERDE vs modelo, G-code corre en grbl/LinuxCNC sin error de sintaxis con G54.

**Verificación por sight:** harness arma el setup gesto a gesto, ve la trayectoria dibujada (entrada roja/salida verde/pasadas azules), corre la sim y juzga el color del stock; luego carga el G-code en gcode-preview y compara la geometría reconstruida con la sim.

---

### P2 — Torneado (2 ejes)

**Por qué después de fresado:** es el **diferenciador que nadie regala** (ni Kiri:Moto ni OpenCAMLib lo hacen bien; no hay app de navegador madura). Pero la geometría es un perfil 2D de revolución → barato sobre lo ya construido.

**Entregable:** Setup de torno (stock cilíndrico, WCS con z=eje rotación right-handed, Safe Z + Danger Z) → herramienta (inserto ISO) → **facing → roughing longitudinal → finishing/profiling → groove → thread → drill coaxial → part/tronzado** → simular → G-code de torno.

**Reutilizar:**
- **Sin lib de torno** (no existe madura): construir con perfil 2D de revolución + offsets de **Clipper2** (desbaste por capas Z + acabado siguiendo el perfil).
- OCCT `BRepAlgoAPI_Section` por el plano del eje → **spun profile** (defeaturing axisimétrico) y extracción del contorno.
- Reusar el Setup/WCS/post/sim de P1 (mismo esqueleto).
- Tablas ISO de rosca (datos abiertos) para el asistente de roscado.

**Construir:**
- Workspace cilíndrico (radial/axial/ángulo), clasificador externo/interno.
- Selector de estrategia que fija dirección feed/ap automáticamente.
- Calculadora `Vc↔RPM↔D` (con Vc→0 en el eje), CSS, specs de rosca ISO (P, H, Dp, Dmin), reducción de feed cerca del eje, Edge Break.
- Post de torno (2 ejes, coords radial/axial, ciclos G76/G71/G74).

**Dificultad/riesgo:** **Media-alta.** El sustrato (perfil + Clipper) es barato; lo fino es roscado (13 pasadas, infeed reducido) y tronzado (Vc→0). Riesgo: rosca cosmética da rojo esperado en sim (no es colisión).

**Evaluador:** reproducir el eje del libro por clicks — barra Ø55 → facing → rough → finish → rosca M42×4.5 → barreno coaxial Ø16 → ranura circlip → tronzado. Invariantes: clasificación externo/interno correcta, taladrado RECHAZADO si el eje no coincide con rotación, Thread Depth = H de la rosca, ancho de tool ≤ ancho de ranura, sim VERDE (salvo rojo cosmético de rosca), G-code de torno parseable.

**Verificación por sight:** harness define el stock cilíndrico, ve el perfil de revolución, ejecuta cada estrategia y juzga que las pasadas longitudinales/contorno/ranura se ven correctas; valida la rosca contra la spec.

---

### P3 — Láser (nesting + corte 2D)

**Por qué cuarto:** el más acotado (2D), con OSS de nesting MIT listo. Buen ROI por simplicidad.

**Entregable:** importar/dibujar perfiles 2D → selector material+espesor (base de datos) → **nesting** → compensación de kerf → orden de corte (interiores antes que exterior) → tabs → G-code láser / DXF.

**Reutilizar:** **SVGnest** (MIT, navegador) y **Deepnest** (MIT, Worker) para nesting; **Clipper2** para compensación de kerf (offset ±kerf/2) y clasificación de loops; dxf-parser/writer (MIT) para I/O; sketcher 2D existente para perfiles; gcode-parser para preview.

**Construir:** selector material/espesor → receta de parámetros; clasificador loop interior/exterior; generador de tabs (width/distance); orden de corte; candado stack-size=1 (láser no apila); post de láser (M3/M5/S potencia).

**Dificultad/riesgo:** **Media-baja.** Casi todo es ensamblar OSS. Riesgo: line side de kerf (offset del lado correcto), regla de orden de corte.

**Evaluador:** kit de N piezas + chapa → layout sin solape dentro del marco con separación ≥ item separation; conteo = BOM×Job Qty; kerf compensado al lado correcto (medible); interiores cortados antes que exterior; tabs presentes; nesting batch ≤ kit-por-kit; DXF/G-code válido por parser independiente; eficiencia ≥ yield objetivo.

**Verificación por sight:** harness dibuja perfiles, corre nesting, ve el layout y el % de aprovechamiento, juzga que no hay solapes y que las piezas caen en la chapa; previsualiza la ruta 2D.

---

### P4 — Aditivo (slicing FDM → G-code)

**Por qué último:** el proyecto ya tiene cultura de impresión 3D (cicloidales impresos) y print-in-place math; el slicing es el componente nuevo. Reutilizable casi entero de Kiri:Moto.

**Entregable:** Setup aditivo (máquina+volumen) → orientación (auto-orient minimiza soporte) → detección de overhang + soportes → infill (gyroid) + brim → slicing por capas → **G-code FDM** + visor capa por capa.

**Reutilizar:** **Kiri:Moto** (MIT) motor de slicing FDM completo en navegador (ya produce G-code); **manifold** para corte de planos 2-manifold; **Clipper2** para perímetros/skin/infill/brim; topopt-am.ts (ya existe) para razonar manufacturabilidad/voladizo; OCCT BRepMesh para tesselar; gcode-preview para el visor. **cura-wasm solo como benchmark de calidad.**

**Construir (poco):** UI de orientación por clicks (snap-face-to-bed), calificador de orientación contra las 3 reglas (soporte/área de contacto/anisotropía), chequeo de volumen de construcción, presets de material/velocidad/jerk, particionado split-to-fit.

**Dificultad/riesgo:** **Media.** Riesgo principal es **licencia**: NO embeber CuraEngine/Prusa (AGPL); construir solo con Kiri:Moto+Clipper2+manifold. Auto-orient (tipo Tweaker-3, minar algoritmo) es lo más nuevo.

**Evaluador:** "imprimir pieza por clicks" — cargar sólido, orientar, soportar solo donde hay overhang >45°, infill gyroid, brim, slicing → G-code no vacío bien formado; bounding box dentro del volumen (rechaza si excede); cero capas en el aire sin soporte; gap soporte-pieza ~0.3mm; auto-orient devuelve ranks por volumen de soporte creciente; round-trip en gcode-preview reconstruye volumen consistente.

**Verificación por sight:** harness orienta la pieza, ve overhangs/área de contacto, genera soporte mínimo, rebana y navega capa por capa juzgando que cada capa se apoya y que la primera tiene footprint suficiente.

---

### Transversal — Generativo (topopt) → CAM

`topopt.ts` + `topopt-am.ts` ya producen geometría optimizada con restricciones de manufactura (min member, keep-in/out, self-support). **Integración:** la salida de topopt alimenta P0 (pieza a moldear), P1/P2 (pieza a maquinar) y P4 (pieza a imprimir sin soportes). No es fase aparte; es el upstream que demuestra "análisis MIENTRAS diseñas". **Construir:** puente densityToMesh → B-Rep maquinable/imprimible (la malla de topopt necesita reconstrucción a superficie limpia antes de CAM exacto — riesgo real, posible cuello de botella).

---

## 7. Decisiones abiertas (requieren al user)

1. **Kiri:Moto: ¿forkear y embeber, o solo minar algoritmos?** Forkear acelera P1/P4 a semanas pero ata mantenimiento a su arquitectura JS. Construir sobre Clipper2 da control total pero es más lento. Recomiendo híbrido — ¿confirmas?
2. **Orden P0 vs P1.** El prompt sugiere molde primero; coincido (cierra evaluador CAD con cero dependencias). Pero si la prioridad comercial es CNC/nearshoring (T-MEC, doc PIVOT-MX-CHINA), P1 fresado da más valor de mercado. ¿Cuál pesa más?
3. **¿Qué máquina(s) reales son el target del post-procesador?** machine-config tiene HAAS/Brother/GROB/Bambu. ¿Hay un CNC/láser/impresora física concreta para cerrar el lazo "G-code → pieza real", o validamos solo contra grbl/LinuxCNC sim por ahora?
4. **Torneado: ¿lo construimos completo (P2) o basta fresado para el evaluador CAM?** El evaluador CAM pide "maquinar una pieza real → G-code sin colisión"; fresado lo cumple. Torno es diferenciador de mercado pero más esfuerzo. ¿Prioridad?
5. **OpenCAMLib (LGPL) para acabado 3D de superficie:** ¿aceptamos el riesgo de bundling LGPL vía WASM enlazado dinámico, o nos limitamos a 2.5D con Clipper2 y posponemos acabado 3D complejo?
6. **Sketcher 2D incompleto (~50 funciones):** P3 (láser) y los perfiles de torno dependen del croquis. ¿Terminamos el sketcher antes de P2/P3, o usamos importación DXF como atajo?
7. **Puente topopt→B-Rep maquinable:** reconstruir superficie limpia desde malla de densidades es no trivial. ¿Invertimos en ese puente, o el generativo alimenta solo aditivo (que tolera malla) por ahora?