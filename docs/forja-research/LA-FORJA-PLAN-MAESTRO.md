# EL PLAN MAESTRO DE LA FORJA

**CAD/CAE web — gratis, en español, IA-asistido, con análisis-mientras-diseñas.**
Documento para el fundador. Denso, accionable, sin relleno. Une los cuatro pilares en una sola estrategia: **(I)** el motor de análisis vivo, **(II)** el árbol de módulos CAD/CAE, **(III)** el puente ECAD→MCAD (PCB), y **(IV)** la jugada de mercado LATAM. Todo se apoya en lo ya construido y en el corpus de investigación citado (`docs/forja-research/`).

> **Filosofía dura, no negociable, transversal a todo:** el humano **DISEÑA**, la IA **ASISTE**, el análisis ocurre **MIENTRAS** diseñas. Nada de "aprieta el botón final y espera". La física es real (fórmula de manual citado, nunca curva inventada). Compila ≠ funciona: cada pieza pasa un gate analítico antes de mostrarse. Español mexicano en todo lo que el usuario lee. No builds locales (todo a iangpu).

---

## 1. TESIS — por qué GANAMOS LATAM (no por qué igualamos a Autodesk)

Fusion 360 cuesta ~$1,500 USD/año (≈ $26,000 MXN). En LATAM eso no es "caro": es **prohibitivo institucionalmente**. Las escuelas técnicas no lo licencian → no hay base instalada → no hay talento de diseño → no hay industria de diseño. **El bucle se rompe por el PRECIO, no por las features.**

No competimos en cobertura de features (perderíamos 20 años de OCCT/ACIS/Parasolid). Ganamos en **cuatro ejes donde Autodesk es estructuralmente débil para LATAM**:

1. **Precio = $0 para el estudiante.** El tier "gratis para estudiantes" ya existe en `src/escuela/EscuelaPortal.tsx:554`; el value-metering al corporativo ya está en la doctrina "La Escalera". Autodesk no puede igualar $0 sin canibalizar su negocio core. Una cuenta del estudiante (=emprendedor en México) al corporativo; el estudiante **nunca paga, sin tarjeta**.
2. **Cero instalación.** Corre en el navegador (R3F + OCCT-WASM + SDF/B-Rep, ya en producción en `university.gaiaprime.com.mx`). Una netbook de secundaria técnica en Oaxaca abre La Forja; **no** abre Fusion.
3. **Español de verdad** — no UI traducida, sino doctrina, tooltips, errores, tutoriales **y la IA hablando español mexicano** (tú/tienes/elevas, nunca voseo).
4. **IA-asistida + análisis-mientras-diseñas** — el diferenciador que ni Fusion básico hace bien. En lugar de *diseña → exporta → configura estudio FEA → corre → interpreta*, La Forja **te dice si la pieza aguanta mientras la sigues estirando**. Autodesk tiene la física, pero la esconde tras un workspace separado y un paywall (Simulation Extension).

**El gancho (no enumeración de features):**
> *Autodesk te vende un programa de $26,000 pesos que tienes que instalar, configurar y aprender solo. La Forja te abre en el navegador, te habla en español, te arma el esqueleto si se lo pides, y te avisa en vivo si tu pieza se va a romper — gratis, porque eres estudiante. No competimos por features: competimos por las manos que nunca pudieron tocar un CAD.*

**Los tres enemigos del usuario LATAM** que el plan mata (de `docs/forja-research/referencias-cad.md §3` y `forja-carencias-click.md`):
- **Enemigo 1 — fricción del ritual.** El 80% de cualquier tutorial CAD es el mismo ciclo de 7 pasos (plano → croquis → dibujar → acotar → salir → extruir → editar sobre cara). Cada paso es un punto de abandono. Lo horneamos a una tecla o a un default inteligente.
- **Enemigo 2 — miedo a la página en blanco.** Lo matamos con plantillas + la IA copiloto en español.
- **Enemigo 3 — opacidad del análisis.** "¿Aguanta?" es LA pregunta de ingeniería y el CAD tradicional la esconde. La matamos con análisis pasivo, continuo, en vivo (semáforo de FOS sin abrir nada).

---

## 2. ARQUITECTURA DEL MOTOR LIVE-ANALYSIS (el corazón del producto)

El insight central: **separar el análisis en tres relojes con latencias distintas**, cada uno disparado por un tipo de cambio del usuario. Fusion tiene un solo reloj, lento; nosotros tres.

```
RELOJ A — "drag"   (< 50 ms, 20+ fps)   → el usuario ARRASTRA una cota/carga/punto de croquis
RELOJ B — "edit"   (< 500 ms)           → cambia un parámetro discreto (material, una operación)
RELOJ C — "verify" (segundos, en bg)    → la topología cambió (nuevo barreno, fillet) → malla nueva + convergencia
```

**Regla de UX (nunca mentir sobre la precisión):** mientras A entrega un valor aproximado, un badge dice **"≈ estimado"**; cuando C confirma, pasa a **"✓ verificado"**. El usuario ve la pieza cambiar de color en tiempo real y sabe que el número exacto llega en un segundo.

**El patrón transversal del fundador (operador 𝔄), citado en `simulacion-avanzada.md §intro`:** todo aquí es el sistema `K·u=f` (caso particular del KKT `[[K,Cᵀ],[C,0]]`). La estrategia incremental ES la explotación de estructura de bloque: separar lo que NO cambia (interior de la pieza → factorización persistente) de lo que SÍ cambia (frontera/carga → update de bajo rango). Identificar la simetría ANTES de codear paga doble. Aparece literal en: solver del sketcher (rigidez+restricción), ensamble (rigidez+contacto), modal (masa+restricción), surface-fill (puntos de control).

### Cómo se construye el motor incremental (las 5 rebanadas, ordenadas por ROI)

El solver `src/forja/brep/fea.ts` HOY es **batch disfrazado**: cada click re-tessella, re-voxeliza, re-clasifica inside/outside (ray-cast Möller-Trumbore, lo más caro), re-ensambla `K`, y resuelve PCG desde `u=0`. Las 5 rebanadas lo vuelven vivo:

| # | Rebanada | Reloj | Ataca | Matemática / manual | Dif. | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | **Cache de `K` + warm-start CG** | B | Solver frío, re-ensamble | `K·u=f` lineal → superposición; `sparseCG(u0)`; Bathe §8.5 | Baja | 2-3 d |
| 2 | **IC(0) persistente + test de Sturm** | B/C | PCG lento, rigid-body no detectado | Cholesky/LDLᵀ SPD (§intro); Sturm cuenta pivotes negativos → avisa "te falta fijar algo"; Felippa IFEM | Media | 4-6 d |
| 3 | **von Mises al arrastrar una COTA** (la joya) | **A** | Es batch, no tiempo real | Woodbury KKT (§intro); `K=A_e∫BᵀDB` ⇒ solo cambian los `Ke` locales; reusa conectividad de malla, re-clasifica solo la banda de frontera (<5% voxeles) | **Alta** | 2-3 sem |
| 4 | **Mallado adaptativo ZZ** | C | Malla uniforme, hot-spot subresuelto | Estimador `η_e²=∫(σ*−σ_h)ᵀD⁻¹(σ*−σ_h)dV` (§5); Dörfler; **detectar singularidad reentrante** (σ→∞, "pon un filete") | Media-Alta | 1.5-2 sem |
| 5 | **La IA pone las condiciones de borde** | todos | El humano debe saber FEA | `FOS=Sy/σ_vM` (§5, solo elasticidad); `F=mg`; mates/DOF (§4); traduce intención↔BC↔resultado en español | Media | 1-2 sem |

**Orden recomendado: 1 → 2 → 5 → 3 → 4.** La 5 se adelanta porque da el mayor salto de FACILIDAD (la misión) con dificultad media; y porque 1+2 ya hacen el re-solve lo bastante rápido para que el slider de carga + lenguaje natural se sientan vivos sin necesitar todavía el reanálisis geométrico completo de la 3.

**Reglas duras del motor:** (1) el gate analítico NUNCA se rompe — cantilever (`σ=Mc/I`, `δ=PL³/3EI`) y barra a tensión (`σ=F/A`, `δ=FL/AE`) de `scripts/fea-*-verify.cjs` corren antes de cada merge; el incremental debe coincidir (±banda) con el solve frío al soltar. (2) Etiquetar lo no-válido (FOS solo elasticidad; singularidad ≠ σ infinito disfrazado de dato). (3) La física la corre el motor, no la IA. Backend de referencia/contrato de capacidades = **CalculiX** (`manuales/P0_00`), benchmarks **NAFEMS** (`P2_35`) como gate.

---

## 3. ÁRBOL DE MÓDULOS — secuencia P0→P2 y el manual que respalda cada uno

El orden NO es alfabético: cada módulo desbloquea al siguiente. La geometría rica (M1) alimenta moldes (M4) y CNC (M5); el grafo de DOF (M2) alimenta el generativo (M3) y la inyección (M6).

```
M1  Modelado avanzado          ← geometría rica (desbloquea M4/M5/M6)
     ├─ M1a Loft/Boundary (skinning NURBS)
     ├─ M1b Sweep (RMF) + Rib/Draft + Patrón/Espejo
     ├─ M1c Superficies NURBS + continuidad G0/G1/G2 + knit
     └─ M1d Chapa metálica (brida → flat pattern → springback)
M2  Ensamblajes / mates / motion   ← grafo de DOF 6N (reusa el solver del sketcher)
M3  Diseño GENERATIVO / opt. topológica  ← reusa el FEA que YA existe
M4  Moldes de plástico             ← necesita M1 (draft, superficies) + Moldflow
M5  Máquinas CNC (CAM)             ← necesita M1 + M2 (geometría + fixtures)
M6  Máquinas de INYECCIÓN          ← capstone: M4 + M2 + M3 + térmico
```

| # | Módulo | Qué necesita (nuevo) | Prioridad | Dif. | Manual ancla |
|---|---|---|---|---|---|
| **M1a** | Loft/Boundary | `BRepOffsetAPI_ThruSections` + compat. de knots (Boehm) | **P0** | Media-alta | `P0_14` MIT 2.158 L6 (NURBS, de Boor) |
| **M1b** | Sweep/Rib/Draft/Patrón | RMF double-reflection (Frenet falla en κ=0), `n·d` draft | **P0** | Media | `P0_12` Wang RMF |
| **M1c** | Superficies NURBS + knit | Coons, fill por energía `∫∫(S_uu²+2S_uv²+S_vv²)`, cebra G0/G1/G2 | P1 | Alta | `P1_28` IGA-NURBS |
| **M1d** | Chapa metálica | K-factor `BA=θ(R_i+K·T)`, flat pattern, springback FE (J2+Hill'48) | P1 | Media→Alta | `P1_23` KETIV / `P0_02` return mapping |
| **M2** | Ensamblajes/Motion | DOF 6N (`M=6(L−1)−Σ(6−f_i)`), redundancia KKT, GJK/SAT, DAE+Baumgarte | **P0** | Media→Alta | `P1_16` TU Delft MBD / `P1_15` contacto |
| **M3** | Generativo/TO | SIMP (`E_e=E_min+ρ_e^p·…`, p≈3) + OC + filtro Sigmund; TO+pandeo (KS) | P1 | Media→Alta | `P0_06` top88 + 250-líneas |
| **M4** | Moldes plástico | Parting line (`n·d=0`), Hele-Shaw `∇·(S∇p)=0`, Cross-WLF | P2 | Alta | `P2_42` Moldflow |
| **M5** | CNC/CAM | Trayectorias, scallop `h≈s²/8R`, G-code RS274NGC | P2 | Media→Alta | `P1_22` NIST RS274NGC |
| **M6** | Inyección (capstone) | Composición M4+M2+M3+térmico (toggle de cierre = MBD) | P2 | Alta (composición) | `P1_16`+`P2_42`+`P0_03` |

**Ruta crítica:** M1a → M1b (desbloquea draft, base de M4/M5) → **M2** (barato, reusa el solver de DOF subiéndolo de 2D a 6-DOF 3D) → **M3** (reusa el FEA) → M1d (springback reusa la plasticidad) → M1c → M4 → M5 → **M6**.

**Por qué es barato:** el kernel `src/forja/brep/occt.ts` (OCCT-WASM) **ya tiene** extrude, revolve, fuse/cut/common, fillet/chamfer, shell, drillHole, STEP in/out, tessellate, massProperties, enumerateFaces/Edges, transformShape, makeCompound. M1 son operaciones encima de primitivas de OCCT que ya están integradas; el riesgo es la compatibilización de knots (M1a) y el RMF (M1b), no el kernel. **Recomendación de backend:** NURBS desde día 1 (nunca mallas como representación primaria); CalculiX como contrato FE de referencia.

Cada módulo encarna la filosofía: **draft analysis** (verde desmoldable / rojo undercut por `n·d`) en M1b/M4, **DOF coloring** azul→negro→rojo en M2 (igual que el sketcher 2D), **fill front** animado en M4, **viruta** removiéndose en M5 — todo recalculado al arrastrar, "el análisis debajo de la mano".

---

## 4. PCB / EasyEDA — el puente ECAD→MCAD vivo

**Tesis del pilar:** no escribimos un autorouter ni un solver de integridad de señal (10 años-hombre; KiCad ya lo hace libre y bien). **Absorbemos** el ruteo: el usuario rutea GRATIS en KiCad o EasyEDA (LCSC/JLCPCB lo regala, enorme en LATAM), y La Forja **importa la placa como un sólido B-Rep real** y la mete al ensamble mecánico. El humano DISEÑA el circuito en la herramienta que ya domina; La Forja ASISTE convirtiéndolo en geometría mecánica y ANALIZA (cabe-en-la-caja, masa, térmica de cobre) MIENTRAS lo arrastra.

**La palanca (por qué es barato):** un PCB es geometría trivial para el kernel que ya existe. El 70% del pilar es un **parser de dos formatos abiertos** que produce un IR neutro (`PcbDoc`, todo en mm) + un **generador** que llama a funciones que YA están en `occt.ts`:

| Pieza del PCB | Operación que YA existe | 
|---|---|
| Cuerpo del board (outline+grosor) | `extrudePolygon(pts, thickness, PLANE_XY)` |
| Barrenos / vías / drills | `drillHole` / `cut` (A−B booleana) |
| Bodies de footprint (altura) | `extrudePolygon(courtyard)` + `fuse` |
| Modelos 3D de componentes | `importSTEP` + `transformShape` + `makeCompound` (instanciado y cacheado) |
| Masa de la placa poblada | `massProperties` (GProp + ejes paralelos) |
| Cabe-en-la-caja | `common(pcb, carcasa) ≈ ∅` |
| Roundtrip al MCAD | `exportSTEP` |

**Formatos (investigados desde doc oficial):** KiCad `.kicad_pcb` (s-expr, **todo en mm**, tokens `gr_line`/`gr_arc`/`gr_poly` en `Edge.Cuts`, `footprint`/`pad`/`model`, grosor del `stackup` default 1.6 mm) — formato primario. EasyEDA JSON (`shape[]` delimitado por `~`, **unidad 10 mil → mm = val·0.254**, capa `BoardOutLine`=10) — secundario. **Ambos se normalizan al IR único `PcbDoc`** (mm, Z+ arriba); el resto del pilar no distingue de dónde vino.

**Rebanadas (ROI-ordenadas, cada una con gate):**
1. **Board como sólido** (★★) — KiCad rectas → wire → face → prisma → restar drills. Gate: `volume ≈ área·thickness − Σπr²·thickness`; Euler tras cortes. *Wow inmediato:* botón "Importar PCB", arrastras, aparece en 2 s.
2. **Footprints con altura + colocación** (★★★) — courtyard → body por `extrudePolygon`, posicionado con `transformShape` (reusa el mate de engranes); flip 180°X para cara bottom. Gate: ningún componente penetra el board.
3. **Modelos 3D reales** (★★★) — resolver `(model "...step")` con `importSTEP` + offset/rotate/scale; cachear por path (100 resistencias = 1 STEP instanciado). Sube de "caja gris" a geometría real.
4. **Puente al ensamble + colisión/masa en vivo** (★★★★, el diferenciador) — la placa es ciudadano de primera del ensamble; mate por agujeros de montaje. **Cabe-en-la-caja** = `common` continuo en `useFrame` (broad-phase AABB → booleana solo en candidatos); masa+CG en vivo. Gate: mover 5 mm dispara alerta <100 ms.
5. **Térmica + ampacidad de cobre** (★★★★★, premium físico) — parsear tracks/zones → FEM 2D `div(k∇T)+s=0` (reusa `fea.ts`), fuentes `I²R`, `R=ρ_Cu·L/(w·t_cu)` (ρ=1.68e-8, 1 oz=35 µm), ampacidad IPC-2221 `I=k·ΔT^0.44·A^0.725`. Pista sub-ampacidad → roja. Gate: `R` vs analítico, ampacidad vs tabla IPC.

**Riesgo transversal:** unidades (KiCad mm vs EasyEDA 10 mil). Centralizar la conversión en el parser y escribir `scripts/pcb-units-roundtrip.cjs` (placa 50×30 conocida → ambos formatos → mismo sólido ±1µm) como gate ANTES de tocar geometría. **Archivos a crear:** `src/forja/pcb/{pcb-ir,parse-kicad,parse-easyeda,board-solid,thermal-copper,PcbStudio}.ts/tsx`. Cero kernel nuevo.

---

## 5. ROADMAP POR FASES — hitos VERIFICABLES

Cuatro fases. Cada feature pasa un gate (visual o de invariante). "Importa sin crashear" ≠ "importó bien".

### FASE 1 — "El ritual a cero fricción" (~2-3 semanas) — el mayor ROI de UX
Motor y matemática ya existen; es **cablear y quitar diálogos**.
- **1.1 Click-to-place del barreno (P0, dif. 1).** `onPickFace: (i, p?)` — ya tienes `e.point` + `faceId` en `ForgeBRepStudio.tsx:985`. **Hito verificable:** clicas la cara, el barreno aparece donde clicaste; sliders X/Y bajan a ajuste fino.
- **1.2 Keymap bilingüe + paleta "S" (dif. 2).** C=Círculo/Circle, B=Barreno/Boring (idénticas en ambos idiomas). **Hito:** despachador `keydown` mapea a handlers existentes; ignora foco en input; `ShortcutOverlay.tsx` ya existe.
- **1.3 Hornear el espinazo — matar 4 diálogos (dif. 3).** Plano default inteligente; entrar-al-croquis se funde con dibujar; E cierra croquis y auto-selecciona regiones. **Hito:** ciclo completo sketch→extrude→barreno sin un solo diálogo modal.
- **1.4 Tanda visual P0 (dif. 2-3).** ViewCube + triada (drei `GizmoHelper`); **color del croquis azul/negro/rojo por DOF** (el solver ya lo da); FEA con turbo + normalización por **percentil** (no máximo, un nodo singular no aplana el campo) + material con luz. **Hito:** still 4K que un agente Opus juzgue "esto es CAD de verdad", no demo de hobby.

### FASE 2 — "El copiloto en español" (~3-4 semanas) — IA ASISTE, no diseña
- **2.1 Auto-constraint por inferencia (dif. 3).** El solver propone H/V/coincident/tangent + snapping mientras dibujas; glifo de restricción-propuesta. **Hito:** dibujar "a ojo" deja el croquis fully-defined (negro) sin que el usuario elija restricciones.
- **2.2 IA conversacional que MODELA (dif. 3).** Apalanca `api.ts`/`scene.ts` (Claude ya edita el DSL, HMR re-renderiza). Cuadro de texto en español → "placa 80×40 con 4 barrenos M6 en esquinas" → DSL → render → el humano ajusta con las manos. **Hito:** describir en español produce geometría editable; la IA propone, el humano confirma.
- **2.3 El tutor que explica el FEA (dif. 3).** "El esfuerzo se concentra en el filete reentrante; sube el radio o baja la carga; tu FOS es 0.8". **Hito:** todo número de física viene con una acción concreta y una mini-lección en español mexicano.
- **2.4 Reparación de conflictos guiada (dif. 3).** Croquis rojo → señalar restricciones en conflicto (rango deficiente del Jacobiano) y proponer cuál quitar. **Hito:** el novato nunca se atora con un croquis rojo sin saber por qué.

### FASE 3 — "Análisis MIENTRAS diseñas" (~4-6 semanas) — el diferenciador premium
- **3.1 FEA pasivo en vivo — semáforo de FOS (dif. 4).** Toggle "Análisis en vivo": definida cara fija + carga, recalcula FOS en cada cambio (debounced, malla gruesa, refina con ZZ bajo demanda). Semáforo verde≥2 / ámbar 1-2 / rojo <1. **Hito verificable:** estiras la pieza y ves el rojo crecer en tiempo real; el valor coincide (±banda) con el solve frío. Backend de contrato: CalculiX + NAFEMS.
- **3.2 Draft/espesor pasivo (dif. 3).** Sombrear undercut (`n·d` invertido) y pared problemática en vivo. **Hito:** el color dice "esto no se fabrica así" antes de la fábrica.
- **3.3 Modal pasivo (dif. 4, opcional).** `K·φ=ω²M·φ`, primeras frecuencias (Block Lanczos, test de Sturm, masa modal ≥80%). **Hito:** "tu pieza resuena a 240 Hz".

### FASE 4 — "Gratis-para-estudiantes a escala" (continuo, paralelo) — motor de adopción
- **4.1 Onboarding de 90 s (dif. 2).** Tutorial interactivo horneado en el espinazo de Fase 1, en español, sin video. **Hito:** el usuario produce una pieza real (con semáforo verde) en su primer minuto.
- **4.2 Plantillas (dif. 2).** Galería parametrizada (placa, soporte en L, engrane, brida) que el usuario clona. **Hito:** mata la página en blanco.
- **4.3 Tier estudiante $0 sin tarjeta (dif. 2-3, mayormente negocio).** Plomería en `gaia-access.ts` (`SubStatus`, `active_plans`) ya existe. **Hito:** abrir navegador → diseñar, sin tarjeta/instalación/licencia.
- **4.4 Exportar STEP/STL (dif. 3).** Vía OCCT (ya cargado). **Hito:** lo que diseñas, lo fabricas (impresión 3D/CNC); cierra el ciclo, cero lock-in.

---

## 6. LO YA CONSTRUIDO — y qué sigue

**El plan NO arranca de cero. Arranca de conectar lo desconectado** (la carencia recurrente del proyecto: la información existe, se está tirando) y de subir la calidad percibida + la facilidad.

| Pieza | Archivo | Estado | Lo que da gratis al plan |
|---|---|---|---|
| **Sketcher 2D + solver de restricciones** | `src/forja/brep/sketch-solver.ts` + `SketchEditor.tsx` | ✅ 13 restricciones, **Levenberg-Marquardt**, **DOF = nVars − rank(J)**, dibujar/acotar/arrastrar/barrenos | El corazón paramétrico "como humano"; el color azul/negro/rojo por DOF; sube a 6-DOF en M2 |
| **Kernel B-Rep (OCCT-WASM)** | `src/forja/brep/occt.ts` | ✅ extrude/revolve/fuse/cut/common/fillet/chamfer/shell/drillHole/STEP/tessellate/massProps/transform/compound | M1 y todo PCB son operaciones encima de esto; **falta loft/sweep/sheet-metal/draft/patrón** |
| **FEA von Mises real** | `src/forja/brep/fea.ts` + `src/lib/formulas.ts` | ✅ voxel + ray-cast Möller-Trumbore inside-test + Tet4 (`Ke` 12×12, 1 pto Gauss) + **K·u=f** sparse PCG-Jacobi + Shepard transfer + von Mises/FOS; **validado contra cantilever `σ=Mc/I`** | El motor del "análisis mientras diseñas" YA existe; las 5 rebanadas del §2 lo vuelven incremental |
| **Click-to-place (info ya disponible)** | `ForgeBRepStudio.tsx:985` | ✅ raycast de cara con `faceId` + `e.point` | Feature 1.1 es cablear, no construir |
| **Keymap bilingüe** | `forja-keymap.json` + `ShortcutOverlay.tsx` | ✅ definido (C/B idénticas ES/EN) | Feature 1.2 es el despachador |
| **DSL IA-driven** | `src/forja/api.ts` + `scene.ts` + `runner.ts` + `AIPanel.tsx` | ✅ Claude edita `scene.ts`, HMR re-renderiza, "copiar contexto" | El puente humano↔IA de Fase 2 |
| **Mecanismos** | `src/forja/mech/fourbar.ts` + `ForgeMechStudio.tsx` | ✅ Freudenstein, Grashof, Grübler, sweep del acoplador | Base de cinemática/ensamblajes M2 |
| **Auth + billing + tier estudiante** | `lib/gaia-access.ts`, `PreciosPortal`, `EscuelaPortal:554`, Stripe/magic-link | ✅ funcional, "gratis para estudiantes" con plomería | Fase 4.3 es mayormente producto/negocio |
| **Corpus de investigación** | `docs/forja-research/` (`simulacion-avanzada.md` §1-12, `referencias-cad.md`, `forja-carencias-*.md`, `manuales/P0-P2`) | ✅ matemática + manuales por área, carencias CAD oficiales | El respaldo de CADA fórmula del plan; leer de aquí, no re-correr workflows |

### Qué sigue (lo inmediato, en orden)
1. **Fase 1 completa** — el espinazo a cero fricción (1.1 click-to-place primero: dif. 1, ROI máximo). Sin esto, lo demás no importa: el novato abandona en el primer diálogo.
2. **Rebanadas 1+2 del motor** (cache `K` + warm-start, IC(0)) — barato, vuelve el re-solve lo bastante rápido para que Fase 2/3 se sientan vivas.
3. **Rebanada 5 del motor + Fase 2.2/2.3** — la IA pone BC y explica en español; el mayor salto de FACILIDAD.
4. **M1a/M1b + M2** — geometría rica y ensamblajes (M2 barato, reusa el solver del sketcher).
5. **Rebanada 3 del motor (von Mises al arrastrar) + Fase 3.1 (semáforo FOS)** — el diferenciador premium; "el CAD que piensa en física contigo".
6. **PCB R1-R4** — el puente ECAD→MCAD; nadie en LATAM ofrece molde+máquina+proceso ni placa-en-ensamble-vivo en un solo lienzo web.

### Reglas duras para quien construya (resumen ejecutivo)
1. **El humano DISEÑA, la IA ASISTE.** La IA propone (DSL, restricciones, explicaciones, BC); el humano confirma y da la forma. Nunca un "diseño mágico" inentendible. Si la IA aprieta el botón final, falla la filosofía.
2. **El análisis es pasivo y continuo**, no un workspace separado. Tres relojes, badge "≈ estimado" → "✓ verificado".
3. **Física real, etiquetada.** Cada FOS, frecuencia, draft, R de pista sale de fórmula de manual citado. Lo evocativo se etiqueta. El wow emerge de la corrección.
4. **Compila ≠ funciona.** Cada solver pasa su gate (cantilever, NAFEMS, roundtrip de unidades PCB) antes de mostrarse.
5. **NO abrumar.** Cada feature de Fase 2/3 arranca apagada o como semáforo silencioso; el novato ve 3 botones, no 30 (progressive disclosure).
6. **Español mexicano** en todo lo legible. **No builds locales** (TS/build/render a iangpu).

---

### Archivos clave (rutas absolutas)
- Corpus: `/home/ian/Orkesta/la-forja/docs/forja-research/{simulacion-avanzada.md, referencias-cad.md, forja-carencias-click.md, forja-carencias-visual.md, forja-keymap.json, manuales/}`
- Cimientos a extender: `/home/ian/Orkesta/la-forja/src/forja/brep/{occt.ts, sketch-solver.ts, fea.ts, SketchEditor.tsx, ForgeBRepStudio.tsx}` · `/home/ian/Orkesta/la-forja/src/lib/formulas.ts` · `/home/ian/Orkesta/la-forja/src/forja/mech/fourbar.ts`
- IA-driven: `/home/ian/Orkesta/la-forja/src/forja/{api.ts, scene.ts, runner.ts, AIPanel.tsx}`
- A crear (PCB): `/home/ian/Orkesta/la-forja/src/forja/pcb/{pcb-ir,parse-kicad,parse-easyeda,board-solid,thermal-copper,PcbStudio}.ts/tsx`
- Gates: `/home/ian/Orkesta/la-forja/scripts/{fea-cantilever-verify,fea-convergence,fea-node-test,pcb-units-roundtrip,pcb-board-invariant}.cjs`
- Negocio/tier: `/home/ian/Orkesta/la-forja/src/lib/gaia-access.ts` · `/home/ian/Orkesta/la-forja/src/escuela/EscuelaPortal.tsx` · `/home/ian/Orkesta/la-forja/src/precios/PreciosPortal.tsx`