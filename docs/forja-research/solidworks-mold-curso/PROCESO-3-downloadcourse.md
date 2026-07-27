# downloadcourse (curso de moldes, contenido por descubrir)

> **Fuente:** tutorial del canal *CIM DESIGN — A Channel of Industrial Design Engineers* (contacto 8486-9060-46 / +91 8486906046). Duración ~29 min. Mezcla **SOLIDWORKS Premium 2018 x64 (add-in SOLIDWORKS Plastics)** con **Siemens NX 12 (Mold Wizard)**. Síntesis para `docs/forja-research`.

---

## 1. META del tutorial

- **Pieza analizada (SolidWorks):** una **carcasa/housing de plástico** importada (feature `Imported1` + `Body-Move/Copy1`, NO geometría nativa) — caja rectangular con boca circular grande, torres de conector, bosses y pestañas con barrenos. Material final: **ABS**. Trae el **sistema de colada YA modelado como sólido aparte** (mazarote cónico + runner + bajada, en naranja).
- **Molde mostrado (NX):** un **molde de inyección profesional COMPLETO importado como STEP** (`SKT908.243_stp.prt`, junto a `Bike Rear_x_t.prt` — aparentemente el molde de una base/carcasa de asiento trasero de moto). Llega como **cuerpos sueltos** (Body 27/29/43/44/154/170/275), no como componentes. Inserto de cavidad grabado: **`SKT908.243 CAV / H13 HRC50-52`** (acero H13, dureza HRC 50-52), posiciones grabadas 102/103, barrenos de ojo de carga M20 y M16, **2 correderas opuestas** con levas/lifters, latch-locks en las esquinas, conectores de agua IN1/IN2/OUT.
- **Objetivo real del video:** correr la **simulación de llenado Flow + Pack + Warp en SOLIDWORKS Plastics** de la carcasa y, en paralelo, **inspeccionar el molde terminado en NX** (no se modela ni una placa: es demo + análisis CAE + lectura de un diseño real).
- **Veredicto de la sim:** la pieza **se llena con 27.8 MPa**, menos del 66% del límite de la máquina (100 MPa) → diseño de gate viable.

---

## 2. EL PROCESO paso a paso

### Acto I — Overview: sim de llenado (SW) + molde real (NX) [0:00–2:27]

1. **Placa del canal** (0:00) — lista de cursos: AutoCAD, CATIA, SolidWorks, Unigraphics NX, Mold Design, Tool & Die, CNC, ANSYS, Mold Flow.
2. **SOLIDWORKS Plastics ▸ Results ▸ Flow ▸ Fill Time** (0:06) — reproduce la animación de llenado de la carcasa con mazarota+runner: frente de flujo azul (temprano) → rojo (tardío). **Medidas:** Max **2.2175 s** / Min **0.0029 s** (campos: 2.2175 y 0.002899). Panel info: **Type: Shell, Element: 24254, Node: 12079**, ABS genérico. Lista completa de resultados disponibles visible (Pressure at End of Fill, temperaturas, Shear Stress/Rate, Volumetric Shrinkage, Frozen Layer, Cooling Time, Sink Marks, Gate Filling Contribution, Ease of Fill…).
3. **Órbitas con la animación en loop** (0:18) — el sprue vertical llena primero (azul), las esquinas lejanas al final (rojo). Tooltip sobre la pieza: **`Imported1`** (0:51) — es geometría importada.
4. **Salto a NX 12** (1:06) — ensamble del **molde completo cerrado**: placas base, anillo centrador y bebedero, placa de cavidades, core, sufridera, paralelas, placa expulsora. Hover marca `Body(27)` → **el STEP llegó como cuerpos, no componentes**.
5. **Inspección del lado core** (1:15–1:36) — pilares guía, allen, postizo del corazón (etiqueta 103), correderas con guías, pernos inclinados, retenes bronce. Resalta la cavidad completa (`Body(275)`).
6. **Class Selection (Ctrl+B)** (1:33) — diálogo *Select objects to hide* (Select Objects/Select All/Invert Selection) para despejar la vista.
7. **Edit Object Display (Ctrl+J)** (2:03–2:09) — selecciona la **placa superior de amarre** (`Body(29)`) y sube **Translucency = 40** (Layer 101, Line Width 0.13 mm) → la placa queda traslúcida y se ven alojamientos de tornillos, bebedero y barrenos **sin ocultarla ni seccionar**.

### Acto II — Desarme visual del molde en NX [2:30–4:09]

8. **Órbita + zoom del molde SKT908.243** (2:30–2:42) — lee los grabados del inserto: **`SKT908.243 CAV / H13 HRC50-52`**, posiciones **102/103**, barrenos **M20/M16**. El instructor usa el grabado como referencia de material/dureza del molde real.
9. **Edit Object Display sobre el inserto de cavidad** (3:00) — **Translucency = 40** otra vez (Layer 12, Width 0.13 mm) → estudia por dentro: botadores que cruzan, barrenos roscados, líneas de agua, el mecanismo 102/103.
10. **Recorrido general** (3:27–4:09) — columnas guía, tornillería DIN, latch-locks beige, preselección x-ray de cuerpos (`Body(43)`, `Body(154)`). Cierre visual, cero edición.

### Acto III — Setup del estudio Plastics [4:12–7:27]

11. **SolidWorks: activar el add-in** (4:21) — menú Options ▸ **Add-Ins…** → el ribbon de SOLIDWORKS Plastics se habilita (Getting Started Wizard, Solid Mesh (Automatic), Polymer, Fill Settings, Injection Location, Flow, Flow Results…).
12. **PlasticsManager** (4:27) — árbol del estudio: Mesh / Material / Process Parameters / Boundary Conditions / Advisor / Run / Results.
13. **Select Model Type ▸ Shell ▸ OK** (4:30) — malla tipo **cascarón** (pieza de pared delgada, no Solid). Resultado (4:36): **Element = 24254, Node = 12079**, polímero default *Generic material of ABS*.
14. **FeatureManager ▸ Material ▸ Plastics ▸ ABS ▸ Apply + Close** (4:51–5:54) — asigna ABS de la biblioteca estándar (unidades SI - N/mm² (MPa), Linear Elastic Isotropic). **Propiedades literales del ABS:** Elastic Modulus **2000 N/mm²**, Poisson **0.394**, Shear Modulus **318.9 N/mm²**, Density **1020 kg/m³**, Tensile Strength **30 N/mm²**, Thermal Conductivity **0.2256 W/(m·K)**. (Nota del diálogo: la librería default no se edita; hay que copiar a custom library.)
15. **Solid Mesh (Automatic)** (6:24–7:18) — fases *Auto meshing…* → *Hexahedron meshing…* → malla sólida de **1,164,600 elementos / 864,346 nodos** (shell intermedia de 1,450,485 elementos en progreso). El árbol gana nodos nuevos: Mold Wall Temperature, Runner Element, Symmetry Face, Filled Hot Runner, Air Vents, Warp Boundary.
16. **Warning real** (~7:48): *"SOLIDWORKS Resource Monitor: Available system memory is low"* → lo cierra con la X y el mallado sigue sin problema.

### Acto IV — Channel Design (exploración, todo cancelado) [8:12–9:57]

17. **Channel Design** (8:15) — PM con Select Type: **Cooling Channel** (default) / Runner / Runner Wizard. Parámetros: **1st Point D1: 10, 2nd Point D2: 10**.
18. **Cambia a tipo Runner** (8:33) — dropdown **Circle**, checkbox *Use Draft Angle* desmarcado, mismos D1/D2 = 10. Cierra sin aplicar.
19. **Channel Design Wizard** (8:45–9:15) — preview magenta de sprue+runner+gate con 6 miniaturas (tooltips: **Edge Gate**, **Banana Gate**, **1-side layout**). **Defaults literales (mm):** Sprue **SD1 6.0000 / SL 50.0000 / SD2 6.0000** (Element Count 1, Direction +Z); Runner **RT 4.0000 / RL 10.0000 / RW 4.0000** (Direction +X); Gate **GT 2.0000 / GL 10.0000 / GW 2.0000** (Element Count 1). Prueba direcciones **+Z → -Z → +Z** y **+X → -X** (el sistema completo se reorienta). **Cierra sin generar nada**: usará la colada que ya viene modelada como sólido.
20. **Reabre Channel Design (Runner)** (9:18–9:51) — pasea el selector sobre los cuerpos naranjas sin confirmar selección; cancela con la X.
21. **Shell Mesh - Manual** (9:54–10:12) — revisa la malla shell triangular sobre pieza+colada. Secciones del PM: Mesh (Hide Element/Save), Mesh Analysis (Summary/Topology/Group/Quality/Overlap Region), Mesh Triangles (Delete/Flip Normal Vector/Fill Hole/Auto Fill Holes/Subdivide), Mesh Nodes (Merge/Auto Merge/Insert/Adjust/Replace). **Acepta con la palomita** → queda **Shell 24254 / 12079**.

### Acto V — Materiales y proceso [10:18–12:27]

22. **Add Virtual Mold** (10:18) — cubo de molde virtual translúcido, **Scale Factor: 4**. Lo revisa y lo descarta.
23. **Material ▸ Polymer ▸ Open Database** (10:27–10:57) — árbol de polímeros (2-ABS con 5 grados, 3-CAP, 4-DFMT, 5-NYLON 12, 6-PBT, 7-PET, 8-PMMA, 9-PolyCarbonate, 10-POM, 11-PPS…). Pestañas de curvas: Viscosity, PVT, Specific Heat, etc. (viscosidad ~1.000e+01 a 3.162e+05 Pa·s vs shear rate 1.000e-04→1.000e+02). **Palomea `1 (P) ASAHI CHEM / R240A` (ABS)** → info del modelo cambia a Material: ABS, Product: (P) ASAHI CHEM / R240A.
24. **Material ▸ Mold** (11:03–11:09) — base de datos del acero del molde: default **`126 Steel - 420SS`** → lo **cambia a `125 Steel - 414SS`** (gráfica Specific Heat ~4.60e+06 erg/g·°C, plana entre 190.0 y 250.0 °C) y OK.
25. **Fill Settings** (11:18–12:03) — defaults: **Filling Time 1.71 s** (auto), Melt 240 °C, Mold 52 °C, **Injection Pressure Limit 100 MPa**, **Clamp Force Limit 100 Tonne**, Short Shots 105 °C, Fiber Orientation 20% (gris). **Edita: Melt Temperature 240 → 260 °C; Mold Temperature 52 → 60 °C.** En Advanced: Flow/Pack Switch Point **100%** Filled Volume, control Automatic, gravedad **-Y**. Acepta.
26. **Pack Settings** (12:06–12:24) — **Pressure Holding Time 4.52 s** (auto), **Pure Cooling Time 17.68 s**, *Residual Stress Calculation* marcado. **Deja los defaults** y acepta.

### Acto VI — Condiciones de frontera y advisors [12:30–14:57]

27. **Warp Settings** (12:33) — **Ambient Temperature 30 °C**, gravedad **-Y**. Confirma sin cambios.
28. **Injection Location** (12:51–13:21) — pica la cara superior del sprue: **`1. Location (0.0524, 64.8135, 64.79…)`**, **Pointer Diameter 3 mm**, Material1 (ABS) rango 0–100. Activa **Predict Flow Pattern**: plot azul→verde-amarillo (leyenda 0.0000–1.0000) que verifica llenado balanceado desde ese gate ANTES de correr nada. Confirma.
29. **Clamp Force** (13:27) — muestra la triada X/Y/Z para la dirección de máquina; **cierra sin definir**.
30. **Flow Injection Factor** (13:36) — plot azul uniforme, factor **1.0000** en toda la pieza (Max=Min=1.0000); **no aplica factores locales**.
31. **Modify Local Thickness** (13:51–14:27) — diálogo *"Do you want to calculate thickness automatically?"* → **Yes** → *Auto Calculate Thickness* → plot **Thickness Distribution: Max 9.4108 mm / Min 0.1195 mm** (leyenda 9.4108 / 7.5526 / 5.6943 / 3.8360 / 1.9778 / 0.1195). El máximo (~9.4 mm) está en la colada/sprue; la pared nominal ronda 2 mm. Campo Thickness: 1 mm (no aplicado). Report Options ▸ **Node List** vacío (tooltip: *"Use Measure Tool to add nodes here"*).
32. **Advisor ▸ Nominal Wall Thickness** (14:39–14:45) — **nominal 2.04 mm**. Modo **By Percentage**: la pieza sale ROJA casi completa (desviación > ±30%; escalas ±10/±20/±30%) — colada y bosses gruesos son los peores. Modo **By Value**: mismo mapa en mm (9.4108/0.1195). Texto del advisor: espesor lo más uniforme posible; nervaduras en zonas de esfuerzo en vez de engrosar pared; menos ciclo, menos peso de disparo, enfriamiento más rápido.

### Acto VII — Run Flow + Pack + Warp y monitoreo en vivo [15:00–20:00+]

33. **Run ▸ Flow + Pack + Warp** (15:00–15:03) — aviso *"FLOW results exists. Do you want to replace it?"* → OK. **Analysis Manager**: `SHELL - FLOW/PACK` **Running**, `SHELL - WARP` **Pending**. Checkboxes: Show Log, **Display Partial Results**, Close after finished, Always on top.
34. **Preprocesado** (15:06–15:33) — log: *Shell FLOW-PACK V2018 analysis is beginning*; **Thickness Factor = 1.00, Coordinate Factor = 1.00**; Model Processing 1–4 (10%→100%). **Volúmenes: Total 43.98 cm³ (1.49 oz) = Part 43.98 cm³; Sprue/Runner 0.00 cm³** (la colada se malló como dominio de la pieza, no como runner aparte).
35. **Llenado en vivo** (16:03–22:27) — con *Display Partial Results* el viewport pinta **FLOW/Fill Time** conforme el solver avanza:

   | % lleno | t (s) | P máx inyección |
   |---|---|---|
   | 10% | 0.27 | 13.77 MPa (2.00e+003 psi) |
   | 20% | 0.37 | 14.41 MPa (2.09e+003 psi) |
   | 50% | 0.81 | 16.00 MPa (2.32e+003 psi) |
   | 60% | 1.01 | 17.17 MPa (2.49e+003 psi) |
   | 70% | 1.19 | 19.05 MPa (2.76e+003 psi) |
   | 90% | 1.52 | 23.65 MPa |
   | post-filling 100% | 2.28 | 22.24 MPa (baja luego a 15.20 y 0.10 MPa) |

   Las leyendas se re-escalan solas (0.1067 → 0.1477 → 0.3253 → 0.4035 → 0.4764…). Resultados a disco: `C:\Users\Admin\OneDrive\Desktop\New folder (15)\PART FILE\Default\Default.FR2`.
36. **Results Adviser** (al terminar FLOW) — veredicto: **la pieza se llena con 27.8 MPa, menos del 66% del límite** (100 MPa); teoría de fill time y de reposicionar el injection location si hiciera falta.

### Acto VIII — Post-proceso completo de resultados [~22:30–28:33]

37. **Recorre TODOS los plots de llenado** (rotando la pieza en cada uno para leer hotspots):
   - **Fill Time:** máx **1.7079 s**
   - **Pressure at End of Fill:** máx **27.7961 MPa** (volumen llenado 100%)
   - **Central / Average / Bulk / Flow Front Central Temperature:** **260.71 / 243.39 / 264.19 / 260.83 °C**
   - **Temperature Growth:** **4.04 °C**
   - **Shear Stress at End of Fill:** **0.38 MPa**
   - **Shear Rate:** **1.039e4 1/s**
   - **Volumetric Shrinkage:** **9.38%** (concentrada en bosses)
   - **Frozen Layer Fraction:** **0.9655**
   - **Cooling Time:** **39.56 s**
   - **Temperature at End of Cooling:** **196.11 °C** (sprue = hotspot)
   - **Sink Marks:** **0.0198 mm** (hundimientos tras nervaduras)
   - **Gate Filling Contribution:** 1→0 (una sola compuerta domina todo)
   - **Ease of Fill:** todo verde = *Easy*
   - Extras: Velocity Vectors al fin de llenado, orientación de fibra (piel/núcleo/promediada), **Weld Lines** y **Air Traps** — correlaciona los atrapamientos de aire con las zonas de llenado tardío del Fill Time.
38. **Mientras tanto corre el WARP** — **72,474 DOF**, log *"Solving In-mold/Demolding Residual Stress"*.
39. **Corte a NX Mold Wizard** (28:33) — regresa al molde SKT908.243: **oculta 297 componentes** de la mitad superior, aísla la placa de cavidad translúcida (inserto H13 HRC50-52 a la vista), luego oculta placa superior y de cavidades para exponer pilares guía, botadores, resortes, pernos de retorno, correderas e insertos del núcleo.
40. **Cierre** — último paseo de cámara al ensamble completo (mitad móvil + sistema de expulsión) y placa promocional del canal. Fin.

---

## 3. Tabla-resumen del flujo

| # | Etapa | Herramienta / Feature | Parámetros clave |
|---|---|---|---|
| 1 | Pieza | `Imported1` + `Body-Move/Copy1` (SW) | Carcasa importada + colada modelada como sólido |
| 2 | Add-in | Options ▸ Add-Ins ▸ SOLIDWORKS Plastics | Habilita ribbon Plastics |
| 3 | Malla | Select Model Type ▸ **Shell** | 24,254 elem / 12,079 nodos (sólida de prueba: 1,164,600 / 864,346) |
| 4 | Material pieza | Material ▸ Plastics ▸ **ABS** | E 2000 N/mm², ν 0.394, ρ 1020 kg/m³, k 0.2256 W/(m·K) |
| 5 | Canales | Channel Design (Wizard) | Defaults sprue 6/50/6, runner 4/10/4, gate 2/10/2 mm — **cancelado**, usa colada sólida |
| 6 | Polímero | Polymer DB | **ABS (P) ASAHI CHEM / R240A** |
| 7 | Acero molde | Mold DB | 420SS → **Steel 414SS** |
| 8 | Fill | Fill Settings | Fill 1.71 s auto; **Melt 260 °C**, **Mold 60 °C**; límites 100 MPa / 100 Tonne; short shot 105 °C; switch 100% |
| 9 | Pack | Pack Settings | Holding **4.52 s**, cooling **17.68 s**, residual stress ON |
| 10 | Warp | Warp Settings | Ambiente 30 °C, gravedad -Y |
| 11 | Gate | Injection Location | Nodo (0.0524, 64.8135, 64.79), pointer 3 mm + **Predict Flow Pattern** |
| 12 | Espesores | Modify Local Thickness (auto) | Max 9.4108 / Min 0.1195 mm; nominal advisor **2.04 mm** |
| 13 | Run | **Flow + Pack + Warp** | Vol. 43.98 cm³; llena en 1.7079 s con 27.80 MPa (<66% del límite) |
| 14 | Resultados | 16 plots + weld lines + air traps | Shrinkage 9.38%, cooling 39.56 s, sink 0.0198 mm, frozen 0.9655 |
| 15 | Molde real | NX 12 (STEP SKT908.243) | Inserto **H13 HRC50-52**, 2 correderas, Translucency 40 para inspección |

---

## 4. Trucos / gotchas del instructor

1. **Translucency 40 en vez de Hide/Section** — Edit Object Display (Ctrl+J) con el slider a 40 deja ver botadores, aguas y barrenos DENTRO de una placa sin ocultarla ni cortarla. Lo usa dos veces (placa de amarre y placa/inserto de cavidad). Es SU técnica estrella de inspección de moldes.
2. **Leer el grabado del inserto como spec** — `SKT908.243 CAV / H13 HRC50-52` le da material y dureza del molde real sin abrir un solo plano; M20/M16 = ojos de carga; 102/103 = posiciones de componentes.
3. **Colada modelada > wizard** — abre el Channel Design Wizard, enseña todos los defaults y tipos de gate (Edge/Banana, layouts)… y lo **cancela**: la colada como sólido propio da control total. Consecuencia medible: el log reporta *Sprue/Runner Volume = 0.00* (todo cuenta como pieza).
4. **Shell para pared delgada** — elige malla Shell (24 K elementos, segundos) sobre la sólida (1.16 M elementos, minutos y warning de RAM) para iterar rápido; la sólida solo la genera para demostrarla.
5. **Predict Flow Pattern antes de correr** — checkbox dentro de Injection Location que estima el patrón de llenado al instante; valida el gate ANTES de pagar el costo del solver.
6. **Display Partial Results** — el plot Fill Time se pinta EN VIVO con cada % de llenado; se supervisa presión y frente de flujo sin esperar al final (y detectas un short shot temprano).
7. **Advisor By Percentage vs By Value** — el mismo mapa de espesores leído dos veces: % de desviación contra el nominal (2.04 mm) delata de golpe las zonas problemáticas (rojo = >±30%), el modo mm da el número exacto.
8. **Correlacionar plots** — air traps encimados sobre Fill Time: los atrapamientos caen exactamente en las zonas de llenado tardío. Sink marks contra nervaduras/bosses gruesos.
9. **Warning de memoria ≠ pánico** — el *Resource Monitor: memory is low* se cierra con la X y el mallado de 1.16 M elementos termina bien.
10. **Dos herramientas, una historia** — la sim de llenado (SolidWorks Plastics) y el molde terminado (NX) son de la MISMA filosofía de curso: primero validar el llenado de la pieza, luego estudiar el herramental real (placas, correderas, expulsión) que la produce.
11. **Material de pieza ≠ polímero del estudio** — asigna ABS dos veces: en el FeatureManager (propiedades mecánicas del CAD) y en la base de datos de Plastics (grado reológico ASAHI R240A con curvas de viscosidad/PVT). Son independientes.
12. **Pendiente por descubrir** — el video NUNCA modela el molde: partición de placas, corazones, correderas y expulsión del SKT908.243 quedan como referencia visual. Si hay más partes del curso, ahí estaría el Mold Wizard de NX paso a paso.