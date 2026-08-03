# CRUCE — El libro del cliente × las sesiones de sus ingenieros

Síntesis de las dos fuentes trabajando en conjunto. Por cada fase de la taxonomía compartida:
(a) **EL LIBRO DICE** (con §), (b) **LAS SESIONES MUESTRAN** (con sesión @ minuto y costo en minutos),
(c) **NECESIDAD DE UI CONJUNTA** (numerada N-xx; ⭐ = choque libro↔práctica = oportunidad principal).

**Fuentes:** requisitos del libro (`libro-caps1-3.md`, `libro-caps4-6.md`, `libro-caps7-9.md`, `libro-caps10-13.md`)
y 8 fichas etnográficas de sesiones mudas de SolidWorks (004 cuchara 27.5 min, 007 hair clip 31.3, 013 base
multi-cavidad 37.4, 020 crystal cup 31.7, 040 slider 36.9, 028 tres placas/handle 32.1, 048 bottle cap 24.2,
025 bracket 24.3 — total ≈ 245 min muestreados a 1 frame cada 24–37 s). Regla dura: nada inventado; lo no
observado se declara. Los minutos de las sesiones son aproximados (derivan de frames muestreados).

Advertencia de alcance: las 8 sesiones son GRABACIONES MUDAS; la intención del ingeniero solo es visible en
~33 rótulos quemados en total (conteo por ficha: 004:5, 007:7, 013:4, 020:5, 025:3, 028:1, 040:3, 048:5).
Todo "porqué" ausente se trata como ausente, no se rellena.

---

## 1. pieza

**(a) EL LIBRO DICE.** El proyecto arranca con worksheets formales: aplicación con 4 fechas hito y 4 metas de
costo (§2.2.1, Tabla 2.1), producción de 9 campos (§2.2.2, Tabla 2.3), uso final y regulatorio (§2.2.3, Tablas
2.4–2.5), estética con superficies críticas donde knit-lines y marcas están prohibidas (§2.2.3, Tabla 2.7),
ficha de material de 18 propiedades que entrega EL CLIENTE (§2.2.5, Tabla 2.10) y checklists DFM de 9 puntos y
DFA de 6 (§2.2.4, Tablas 2.8–2.9). Con solo 4 datos (dimensiones, espesor, material, cantidad) se arranca layout
y cotización (§1.5 + §2.1.5). Los worksheets son documentos VIVOS con dueño, estado y trazabilidad (§2.2).

**(b) LAS SESIONES MUESTRAN.** Ninguna de las 8 sesiones modela ni revisa la pieza: llega importada o ya está
en el árbol (025 @ 0.4: Insert Part `BRACKET YT`; 007 min 0.5: `HAIR CLIP 1/2` preexistentes; 048 @ 0.4: la tapa
ya existe). Lo único que se ve de "pieza" es el cold-open del resultado terminado (020 @ 0:00, 040 min 0.0,
048 @ 0.0, 025 h1 f0), ~0.5 min por sesión. Cero worksheets, cero ficha de material, cero DFM en pantalla,
en ~245 min de grabación. Material y resina: jamás visibles.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-01** Intake mínimo de 4 campos (§2.1.5) + ficha de material como PRERREQUISITO de flujo: el software no
  deja "arrancar el CAD" sin declarar pieza, resina, cantidad y espesor, porque la práctica observada arranca
  directo en geometría con el material invisible (048 @ 0.4: `Scale1` sin factor legible = consecuencia directa).
  Para APRENDER: el junior ve qué datos gobiernan todo lo demás. Para REVISAR: un lote de 30 modelos sin
  metadatos de material es hoy ilegible — cada modelo carga su ficha o se marca "sin datos".
- **N-02** Checklist DFM/DFA (Tablas 2.8–2.9) corrido AUTOMÁTICO sobre la geometría importada (draft, espesores,
  esquinas, undercuts §2.3.7): ninguna sesión lo hace ni a ojo; el libro lo exige antes de cotizar. En volumen es
  un semáforo por pieza del lote.

---

## 2. dfm-draft-escala

**(a) EL LIBRO DICE.** Draft mínimo 0.5°, 1–2° típico, +1° por cada 20 μm de textura (§2.3.6, Tabla 2.14);
detector de las 4 familias de undercuts (§2.3.7, Fig. 2.7); y el capítulo 10 ENTERO de contracción: condiciones
de proceso precargadas con cita (§10.1.1), cadena PvT Tait viva (§10.1.2–10.1.4, ecs. 10.2–10.13), banda
mín/nominal/máx (§10.1.6), alarma de sobre-empaque s≤0 (§10.1.6), confrontación obligatoria contra 4 fuentes y
ACTA de quién acepta el riesgo (§10.1.7), decisión steel-safe con 3 opciones (§10.2.2). La cavidad DEBE estar
escalada antes de liberar a maquinado o la pieza sale de tolerancia ±0.4%/±0.1% (§10.1, Eq 10.1).

**(b) LAS SESIONES MUESTRAN.** La contracción existe en la práctica como UN feature `Scale1` que en 7 de 8
sesiones ya viene heredado de una sesión anterior (004 F3, 007 min 0.5, 013 min 0.6, 020 @ 0:32, 040 min 13.6
historia enrollada, 048 @ 0.4, 028 preexistente). Solo 025 lo muestra en vivo: panel Scale "Uniform scaling"
durante ~24 segundos (min 1.2–1.6) y el FACTOR NO ES LEGIBLE. Draft Analysis como herramienta: no observado en
ninguna sesión (025 lo declara explícito; en 040 min 17.9 la pestaña Evaluate está abierta pero el comando no es
legible). Cero PvT, cero banda, cero acta, cero comparación con dato del proveedor en ~245 min.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-03** ⭐ **Contracción trazable**: el libro pide una cadena de cálculo con acta de responsabilidad (§10.1.2–
  §10.1.7) y la práctica es un Scale de 24 segundos con factor invisible (025 min 1.2). El software calcula el
  factor (material→PvT→s→banda) y ESE número alimenta el Scale del CAD con su cita; el junior aprende de dónde
  sale; el revisor batch verifica en cada modelo del lote: ¿existe Scale?, ¿el factor coincide con la resina
  declarada?, ¿quedó el acta de §10.1.7? Hoy nada de eso es verificable ni mirando el video.
- **N-04** Check de draft servido por Tabla 2.14 + §2.3.6 corrido sobre el modelo antes de partir: en las
  sesiones el semáforo de draft solo aparece incidentalmente dentro del preview de Parting Line (025 h1 f6) y
  nadie lo consulta como paso propio.
- **N-05** Detector de undercuts (§2.3.7) que además MAPEE cada undercut a su mecanismo y costo (§3.3.3, Tabla
  3.9): en 040 y 007 el slider ya existe cuando arranca la grabación — la decisión "esta pieza necesita
  corredera" nunca es visible; el software la hace explícita y auditable.

---

## 3. particion

**(a) EL LIBRO DICE.** Dirección de apertura con 2 criterios (mayor área paralela al plano de partición +
expulsabilidad, §4.1.1); parting line en borde inferior o no-visual porque SIEMPRE deja witness line (§4.1.2);
parting line no plano = costo de complejidad mostrado al elegir, no después (§4.1.3, R-123); flujo guiado del
layout en el orden del libro (§4 intro). El venteo vive en el plano de partición (cap 8, §8.2.2: mapa de
candidatos, obligatorio/opcional/diferido-a-tryout).

**(b) LAS SESIONES MUESTRAN.** La partición se hace en sesiones PREVIAS no grabadas en 7 de 8 casos (`Parting
Line1` heredada: 004 F11, 007 min 0.5, 013 min 0.6, 020 @ 0:32, 028 h1-f4, 040 min 13.6, 048 @ 0.4). Solo 025 la
ejecuta en vivo (min 2.0–3.2, ~1.2 min): Parting Line sobre Top Plane con 1.00° y la ADVERTENCIA amarilla
literal *"The parting line is complete, but the mold cannot be separated into core and cavity. You may need to
create shut-off surfaces"* — que el experto BRINCA sin resolver visiblemente (025 min 2.0, dolor D2). Ningún
criterio del libro (visibilidad del witness, área mayor) aparece en pantalla. Venteo: CERO evidencia en las 8
sesiones — ni un vent de plano de partición en ~245 min.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-06** Asistente de dirección de apertura + parting line que muestre los 2 criterios de §4.1.1 y pinte la
  línea candidata sobre la pieza pidiendo confirmar visibilidad (§4.1.2): la práctica salta directo al split y
  el porqué queda en la cabeza del experto — exactamente lo que un junior no puede heredar de un video mudo.
- **N-07** ⭐ El warning de shut-off convertido en GATE explicado: el mensaje amarillo de 025 min 2.0 es hoy
  ruido que el experto ignora y que a un nuevo lo deja perdido (¿es fatal o esperado?); el software lo convierte
  en check con diagnóstico (ventanas sin shut-off vs partición plana que lo resuelve) y en batch reporta
  "parting line completa + shut-offs cerrados" por modelo — cruce directo de §4.1.4 con el dolor observado.

---

## 4. superficies

**(a) EL LIBRO DICE.** Interlocks del parting plane inclinados ≥5° o desgaste/bloqueo (§4.1.3, R-064); número de
shut-offs = número de ventanas de la pieza, cada uno con parting line en zona no visible (§4.1.4, R-065); para el
bezel, superficies lofted con draft ≥5° tejidas al parting plane (§4.1.2–4.1.4, R-127).

**(b) LAS SESIONES MUESTRAN.** La superficie de partición se construye A MANO cuando se ve: 025 min 3.2–4.4
(~1.2 min) croquis rectangular + diagonales + Convert Entities de las líneas de partición + superficie plana —
las herramientas Shut-off Surfaces y Parting Surfaces de Mold Tools NO se observan en ninguna sesión (025 lo
declara; 048 ni siquiera usa superficies: separación 100% booleana Indent/Combine/Split, hallazgo rector). En
007 solo retoques a `Boundary-Surface13` (min 2.6 y 15.0–15.5, ~1 min). El resto: heredado.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-08** Generación automática de la superficie de partición plana (el caso que 025 resuelve a mano en 1.2 min
  es trivialmente automatizable) con escalera declarada hacia los casos no planos, advirtiendo el costo de
  complejidad de §4.1.3 al momento de elegir.
- **N-09** Check de conteo shut-offs vs ventanas (§4.1.4) + inclinación de interlocks ≥5° (§4.1.3) como
  semáforos: hoy no existe NINGUNA verificación de esto en pantalla — en 004 el bolsillo del candado lateral
  ("Side Straight Block", 15:52) se croquiza sin que ningún criterio de ángulo sea visible.

---

## 5. tooling-split

**(a) EL LIBRO DICE.** Dimensionado de insertos con reglas: colchón de 3 diámetros de línea de agua (§4.2.1–
4.2.2), cheek ≥ profundidad de cavidad (§4.2.2 + §12.2.4, ec. 12.15), redondeo HACIA ARRIBA a incrementos
estándar de placa (§4.2.1); forma del inserto por manufactura (§4.2.3); material por matriz aplicación×volumen
(§4.4.4, Tabla 4.1) con alarma anti-default-P20 (§4.4); fits CALCULADOS: λ = 0.001·C·D^⅓ con tablas LN/FN y
dimensiones mín/máx que bajan al plano (§12.4.1, ecs. 12.27–12.31), con la trampa de la fuerza de inserción
(FN1 = 808 kN, §12.4.1).

**(b) LAS SESIONES MUESTRAN.** El split viene heredado en 7 de 8 sesiones. 025 lo ejecuta en vivo: Tooling Split
con Block Size 40/60 mm TECLEADO sin referencia visible de dónde salen los números (min 4.8, dolor D6) — total
~1.2 min más la segunda extracción con Core (min 21.6–22.4). 048 usa la escuela booleana sin Mold Tools (Indent/
Combine/Split ya en árbol @ 0.4). Y el hallazgo de oro: las holguras se aplican con **Move Face offset 0.50 mm,
cara por cara, a mano** (020 @ 13:20 una cara; @ 19:44 seis caras a la vez) — una regla numérica sin registro,
que un nuevo no conoce ni en valor ni en alcance (020, insumo APRENDER). En 048 un barreno terminado se corrige
con Move Face +10 mm como parche (048 @ 16.4).

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-10** ⭐ **Dimensionador de insertos que PRODUCE el Block Size**: las reglas de §4.2.1–4.2.2 (3×D agua,
  cheek≥profundidad, redondeo a incremento estándar) calculan los 40/60 que hoy salen de la memoria del experto
  (025 min 4.8); la UI muestra CUÁL restricción domina (agua vs estructura, R-033) y en batch mide los colchones
  reales de cada modelo del lote contra la regla.
- **N-11** ⭐ **Fits calculados en vez de Move Face 0.50**: el libro da el método exacto (§12.4.1, Tabla 12.1) y
  la práctica aplica un offset plano de 0.50 mm a mano sin registro (020 @ 13:20/19:44). El software asigna el
  fit por FUNCIÓN de la interfaz (localización/interferencia/deslizante), calcula mín/máx, los aplica y los baja
  al plano — y alarma la fuerza de inserción imposible (§12.4.1: 808 kN) que ningún Move Face va a delatar.
- **N-12** Selector de material de insertos con la matriz de Tabla 4.1 y los factores vivos (§4.4.3): en ~245 min
  de sesiones el material NUNCA aparece — ni una decisión de acero es visible; para revisar en volumen, cada
  modelo declara material o queda en rojo.

---

## 6. mecanismos

**(a) EL LIBRO DICE.** Core pulls: F = P·A proyectada — un corazón de 22×10 mm son ~4 toneladas (§11.3.6, ec.
11.24); actuador hidráulico con bore calculado y limit switches en AMBAS posiciones integrados a la máquina
(§11.3.6); slides con perno ángel ≤20° o se atasca, stroke = L·sin(φ) + ~25 mm de acoplamiento, la fuerza la
carga el HEEL BLOCK no el perno (§11.3.7, ec. 11.26); resorte que mantenga el slide afuera + limit switch porque
"un operador curioso" lo mueve y el perno se dobla (§11.3.7); collapsible/rotating/split cavity con sus criterios
(§13.9.1–13.9.3).

**(b) LAS SESIONES MUESTRAN.** Los mecanismos son el corazón de 2 sesiones y aparecen en 2 más (~23 min
agregados): 040 dedica ~10 min al slider (17.3–31.5): pocket por Convert Entities, croquis inclinado con cota
13.00 y **el barreno del perno inclinado taladrado por Cut-Revolve sobre eje inclinado** (min 28.4–29.0, dolor
D7) — el ángulo NO es legible y ninguna referencia de dónde sale el claro es visible. 007 construye SLIDE +
LOCKING BLOCK por Boss-Extrude (min 21.2–23.3, ~2 min; identidad confirmada solo por el renombrado posterior).
004 hace el "Pocket for Side Straight Block" (15:52–17:16, ~1.4 min). 025 pasa 5+ min en ranura + Cut-Revolve a
7.31° + patrón en el core SIN ninguna pista del porqué (16.0–21.2, dolor D7). Cero cálculo de stroke, ángulo,
fuerza o carrera en pantalla. Resortes y limit switches: no observados.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-13** ⭐ **Slider por regla, no a pulso**: el libro da la geometría cerrada (ángulo ≤20°, stroke ec. 11.26,
  heel block) y la práctica son 4 cotas a pulso y un Cut-Revolve de experto (040 min 28.4–29.0). La UI genera el
  perno/bolsillo/candado desde el undercut detectado (cruce con N-05) mostrando cada número con su §; en batch
  recomputa carrera-vs-ángulo-vs-pocket y marca los moldes donde el slider NO libra el undercut — hoy eso no lo
  verifica nadie ni a ojo.
- **N-14** Checklist de seguridad de mecanismo (§11.3.6–11.3.7: limit switches, resorte, a-prueba-de-abuso) como
  criterio de cierre de fase: invisible en todas las sesiones; el libro lo declara obligatorio; en volumen es un
  semáforo por molde-con-slider.

---

## 7. base-placas

**(a) EL LIBRO DICE.** El mold base se ESPECIFICA y se COMPRA estándar: tamaño 200–1000 mm, alturas A/B/S,
carrera E; la altura "S" y "C" normalmente las asigna EL PROVEEDOR (§4.3.2); selección de proveedor con 7
criterios, entrega de custom ≤1 semana (§4.3.4); los mold bases estándar solo vienen en 1045/4140/P20 (§4.4.4);
layout de cavidades con envolvente <2:1 (§4.3.1) y holguras ≥½ diámetro alrededor de cada componente (§4.3.2);
4 semáforos de compatibilidad con máquina (§4.3.3); gate de compra: nada se ordena hasta que layout + colchones
+ máquina estén en verde porque "any mistakes in the mold base selection can consume significant time and
expense" (§4.3, R-090); estructural: pilares donde se genera fuerza, deflexión vs venteo, tornillo M10 por peor
caso de grúa (§12.2.2–12.4.2).

**(b) LAS SESIONES MUESTRAN.** Es LA fase dominante del trabajo real: ~118 de ~245 min (≈48%) entre las 8
sesiones. Y el 100% se hace A MANO: cada placa nace como croquis rectángulo → diagonales para centrar → Boss-
Extrude, repetido placa por placa (013 min 18.5–27.8, ~10 min de geometría prismática, dolor 1; 048 min
19.2–23.6, ~4.4 min para 5 placas; 040 1/15 placa 180×250; 028 placa de 471.889457 mm — cota con 6 decimales,
dolor 6). En NINGÚN frame de NINGUNA sesión aparece una biblioteca DME/HASCO/Toolbox (013, 007, 040, 048 lo
declaran explícito). Las dimensiones salen de memoria: 007 min 25.8 muestra el dropdown de valores recientes
(246/266/286 mm) como único "catálogo". Encima corre el maratón de tornillería: Hole Wizard abierto en 21 de 59
frames en 004, ≥18 de 60 en 020, ≥12 en 040; cada familia de barreno (CBORE M5–M16, tapped M8–M24, clearance,
dowel Ø16, armella M20) se especifica y posiciona una por una con cotas en Modify, y se espeja a mano — 040
acumula **19 Mirrors**, 020 llega a Mirror12, 004 ≥7 espejos (olvidar uno = placa asimétrica y nada lo delata,
020 dolor 4). La coordinación entre placas es a ojo: vistas de sección wireframe (004 @ 21:56), zoom a anillos
concéntricos (020 @ 25:04), translúcido (040 min 21.6/32.7). El Feature Scope "Selected bodies" se setea en
silencio en cada corte — olvidarlo perfora placas ajenas (040 dolor D3, 028 @ 6:56).

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-15** ⭐⭐ **Base paramétrica de catálogo** — la oportunidad #1 del software por minutos observados: el
  libro manda especificar base estándar (§4.3.2, §4.3.4) y los ingenieros la MODELAN desde cero ~10 min por
  molde con números de memoria (013 dolor 1, 007 dolor 5, 048 dolor 1). La UI genera el stack completo (placas,
  risers, housing) desde la spec de §4.3.2 (L×W, A/B/S, carrera E) contra catálogo; en batch, valida espesores y
  anchos de cada modelo del lote contra la tabla de la familia — hoy se comparan contra la memoria de cada
  ingeniero.
- **N-16** ⭐⭐ **Hardware por receta funcional**: cada barreno del molde tiene una FUNCIÓN que el libro nombra
  (unión de placas §12.4.2, dowels §12.4.3, retorno+resorte §11.3.8, agua Rc §9.1.6, armella por peor caso de
  grúa §12.4.2) y que la práctica ejecuta como ~20 min de Hole Wizard por sesión, barreno por barreno (004 dolor
  1: "es trabajo repetitivo de catálogo, no de diseño"). La UI coloca FAMILIAS de hardware por receta (patrón de
  4 esquinas, retícula de expulsión, puertos de agua) con posición derivada y § visible; el junior aprende la
  función de cada rosca (por qué Rc cónica para agua y métrica para unión — pregunta que 3 fichas declaran
  ilegible: 007, 013, 048).
- **N-17** ⭐ **Simetría/patrón DECLARATIVO con auditor**: los 19 Mirrors de 040 y los Mirror2–12 de 020 son
  contabilidad manual de una propiedad que debería declararse una vez ("esta placa es simétrica respecto a
  Front/Right"); el software la impone y el revisor batch detecta features sin espejo o cavidades sin su patrón
  (048: gate por LPattern ×4 — "fácil que a una cavidad le falte").
- **N-18** Verificador del stack + gate de compra: alineación/concentricidad de cada barreno a través de las
  placas que atraviesa (hoy: sección + ojo, 004 @ 21:56, 028 @ 21:52), cortes que invaden cuerpos ajenos (el
  riesgo del Feature Scope, 040 dolor D3), holguras ≥½D (§4.3.2), y los 4 semáforos de máquina (§4.3.3) que
  NINGUNA sesión corre — todo como reporte por modelo antes de liberar la orden del mold base (R-090).

---

## 8. alimentacion

**(a) EL LIBRO DICE.** Un método CALCULADO de punta a punta: presupuesto de ΔP (≤50% de presión de cavidad o
≤50 MPa, §6.2.2/§6.4); solver de diámetros por restricción con reparto proporcional a longitud (ecs. 6.7–6.9);
redondeo a diámetro estándar de cortador y luego STEEL-SAFE HACIA ABAJO (§6.5.4–6.5.5); triple semáforo del feed
(ΔP, volumen ≤30% CR/≤100% HR, no extender enfriamiento, §6.4); gates con tres semáforos INDEPENDIENTES — shear
(Tabla 7.2), ΔP (Tabla 7.3, >10 MPa = rojo §7.3.3) y freeze vs pack (Tabla 7.4, el gate de 1.1 s con pared de
24 s = pieza mal empacada aunque todo lo demás pase, §7.3.4); geometría del túnel 45°/taper ≥20°/3D (§7.2.7);
balanceo artificial con sus trampas (§6.4.6, §6.2.4).

**(b) LAS SESIONES MUESTRAN.** ~21 min agregados de PURA GEOMETRÍA, cero cálculo visible: 007 talla el runner
obround (R3.00, 10.00, 30.00, offset 2 mm — min 0.5–2.1) y el gate triangular que replica por CirPattern de 2
instancias (min 16.0–17.1), ~7 min; 013 graba el canal en S con el rótulo "Runner & Gate" (min 13.6–17.9),
balance confiado a la simetría del dibujo; 028 hace 3 visitas (drops cónicos con plano offset a 55 mm cuyo
porqué jamás se ve — min 3.12; runner en X como sólido con 12 fillets seleccionados a mano — h2-f23 min 12:16;
perfil del sprue/sucker con 30° dibujado SOBRE la vista de sección — h3-f44 min 23:28); 048 hace el point gate
con cotas 2.50 mm/~20° por Cut-Revolve + Linear Pattern ×4 (m 0.8–3.6) y un buje de colada por Boss-Extrude
(m 16.8–18.4). Números de memoria en todos los casos. En 004, 020, 025 y 040 la alimentación NO se observa.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-19** ⭐ **El solver del libro alimenta las cotas del CAD**: la cadena caudal→ΔP→diámetro por segmento→
  estándar→steel-safe (ecs. 6.7–6.9, §6.5.4–6.5.5) sustituye las cotas mágicas observadas (R3×10×30 en 007,
  2.50/20° en 048, 30° en 028); cada cota del runner lleva su fórmula y sus números intermedios visibles (modo
  APRENDER sin caja negra) y el registro steel-safe queda en el plan de tryout (§7.3.2).
- **N-20** Verificación batch del feed: longitudes de trayecto por rama medidas del modelo (balance real, no
  simetría del croquis — el libro advierte que el balanceado geométrico NO garantiza balance térmico, §13.6.3),
  taper de drops/sprue ≥ umbral, fillets presentes en todo el runner (028 los pone arista por arista, dolor 5),
  gate presente y dimensionado en las N cavidades (048).
- **N-21** Los 3 semáforos de gate (shear/ΔP/freeze) como pantalla obligatoria de cierre: la práctica no calcula
  NINGUNO; el libro documenta que pueden discrepar entre sí (§7.3.3: shear 132,000 s⁻¹ "fatal" con ΔP aceptable;
  §7.3.4: todo verde y la pieza mal empacada) — exactamente el tipo de error que un video mudo jamás enseñaría.

---

## 9. agua

**(a) EL LIBRO DICE.** Un flujo de 7 pasos calculado: t_enfriamiento → potencia → caudal → diámetro → profundidad
→ pitch → ruteo (§9.2); checks duros: D dentro de [D_min, D_max] y estándar (§9.2.4), profundidad 2D–5D (§9.2.5),
pitch W entre H y 2H (§9.2.6), ½ diámetro de acero contra CUALQUIER componente (§9.2.7), ≤2 conexiones por mitad
o etiquetar in/out (§9.1.6), compatibilidad con controlador (Tabla 9.1); remedios de core profundo por diámetro
(Tabla 9.3: baffle/bubbler/heat pipe); trampas: enfriamiento agresivo desparejo = warpage que el ciclo NO cura
(§9.1.2, §9.2.6), 2 °C de gradiente = 1.6 mm de alabeo (§10.3.1).

**(b) LAS SESIONES MUESTRAN.** La práctica del agua se reduce a BARRENOS + ROSCAS colocados uno por uno: 007
gasta ~8 min (25% de la sesión, dolor 1) en el ritual Hole Wizard "Tapered Pipe Tap 1/8" + punto + Fix + cotas
sueltas (41/65/20/40/45) repetido ≥6 veces, con zoom extremo a wireframe para picar un punto (min 11.4, dolor 2);
013 espeja las "1/8 G Tapped Hole" (min 16.0) y la ÚNICA verificación del circuito serpenteante es mirarlo por
transparencia (min 30.9); 020 enfría los insertos macho con barrenos centrales estilo bubbler ("Hole for Cooling
Insert Core" @ 18:08, "In-Out" @ 22:24) y completa los circuitos por Mirror manual (@ 22:56); 028, 040 y 048 solo
muestran los puertos Rc/NPT; 004 y 025: nada de agua (004 declara el circuito no observado; 025 no existe).
NINGÚN cálculo (t_c, potencia, caudal, Re, pitch, distancia a cavidad) en ~245 min. Ninguna etiqueta in/out.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-22** ⭐ **El circuito como OBJETO calculado, no barrenos sueltos**: el capítulo 9 completo está ausente de
  la práctica; la UI traza el circuito (líneas, plugs, in/out) como entidad de primera clase dimensionada por los
  7 pasos de §9.2, con cada número derivado del anterior (la cadena 20,900 J → 1,050 W → 260 W/línea → 1 GPM →
  D∈[3.7,20] → 6.35 estándar del ejemplo cup/lid como lección guía).
- **N-23** ⭐ Checks batch de agua que hoy NADIE corre: continuidad del circuito taladrado, ½D de acero contra
  cavidad/barrenos/expulsores (§9.2.7 — cruce directo con el dolor de verificar por transparencia, 013 min 30.9),
  profundidad y pitch en rango (§9.2.5–9.2.6), roscas de conexión presentes en ambas mitades y accesibles
  (007, 048), etiquetado in/out (§9.1.6).
- **N-24** Selector de enfriamiento de core esbelto por diámetro (Tabla 9.3): 020 lo hace de memoria (barreno
  central + in/out en el inserto macho); la UI nombra la solución (bubbler/baffle) y su criterio, y verifica el
  gradiente esperado del core (§9.2.7: 6 °C → remedios §9.3).

---

## 10. expulsion

**(a) EL LIBRO DICE.** Fuerza de expulsión calculada (ec. 11.7, con Aeff "tipo liga elástica", NO el área
proyectada, §11.2.2); área y perímetro mínimos de pines con el CORTANTE EN EL PLÁSTICO gobernando (ecs.
11.10/11.12, §11.2.3); pandeo de Euler y cuál de los 3 límites domina (§11.3.1); layout CERCA de donde se genera
la fricción — "uniformemente repartido" es la falla común (§11.2.5); pines keyed + etiquetados, PROHIBIDO
intercambiables (§11.1.7); el pin expulsor como VENT en knit lines internas (§8.3.2, claro 0.13 mm); retorno
positivo vs resortes con sus límites (§11.3.8).

**(b) LAS SESIONES MUESTRAN.** ~24 min agregados, todo posicionamiento manual sin un solo cálculo: 004 coloca
los barrenos de expulsores CON EL CURSOR SOBRE LA SILUETA de la cuchara, a ojo (F49 @ 22:52), y los return pins
+ resortes por rótulo quemado (@ 14:00); 013 dedica ~7.5 min a retículas de pines con Hole Position + Mirror
(22.2–29.7); 025 hace sleeve/guías/retorno+resorte por letreros (min 7.6, 9.6, 12.0) con cotas 97/112/51 de
memoria; 020 solo "Hole for Coil Spring" Ø23 (@ 21:20); 028 double ejection: dos placas de retícula trabajadas
con Isolate (h3-f50/f51); 040 resortes modelados y "Hole for Spring" con 40 mm entre centros (min 1.2). Diámetro,
número y posición de pines: experiencia pura, jamás una fórmula.

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-25** ⭐ **Expulsión por regla**: Feject desde contracción+geometría (ec. 11.7 — el dato de contracción
  viaja de la fase dfm, §10.4/R30), diámetro por el peor de compresión/cortante/pandeo (§11.2.3/§11.3.1), y
  layout guiado por el mapa de fricción (costillas/paredes, §11.2.5) en vez del clic a ojo sobre la silueta
  (004 @ 22:52). El junior ve POR QUÉ el pin va ahí y de qué tamaño.
- **N-26** Checks batch de expulsión: cada pin dentro de la silueta y no sobre pared delgada (004, implicación
  REVISAR), acero ≥1 diámetro entre barreno y cavidad (§11.2.4), conflicto pin↔línea de agua detectado (§11.2.5,
  R50), venteo presente en last-to-fill vía pin (§5.2.3 + §8.3.2), conteo de retorno/resortes contra la receta de
  la familia (004).
- **N-27** Tabla de eyectores generada (keyed + etiquetados, §11.1.7): entregable que el libro exige y que en la
  práctica ni existe — los cuerpos terminan como `Boss-Extrude7` anónimos hasta el renombrado final.

---

## 11. planos

**(a) EL LIBRO DICE.** Los límites dimensionales de fits calculados (mín/máx de inserto y bolsillo, dowels) y la
tabla de eyectores bajan AUTOMÁTICAMENTE al plano de cada placa, sin retecleo (§12.4.1/§12.4.3/§11.2.6, R122);
la calidad de dibujos es criterio de selección de proveedor (§4.3.4).

**(b) LAS SESIONES MUESTRAN.** CERO. Ni un solo frame de drawing en 8 sesiones y ~245 minutos (declarado
explícitamente en las 8 fichas). La entrega observada termina en otra cosa: renombrar cuerpos y exportar
partes (ver fase revision).

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-28** Generación automática de plano por placa con los fits/límites del libro ya vaciados (R122): necesidad
  respaldada por el LIBRO y por la AUSENCIA en la práctica — si los planos se hacen, ocurren fuera de cámara con
  costo desconocido; si no se hacen, el taller trabaja sin límites dimensionales formales. Declarado: el costo
  real de esta fase en la práctica del cliente es **no observado** — es el hueco de evidencia más grande del
  corpus y merece pedir al cliente una grabación de esa etapa.

---

## 12. revision

**(a) EL LIBRO DICE.** Gates formales de proyecto ("Project OK?"/"Moldings OK?", §1.5, Fig. 1.9); checklists de
cierre por subsistema (§7.4 gates, §8.4 venteo, §9.4 agua, §12.5 estructural — 3 veredictos independientes:
yield, fatiga, deflexión-vs-flash); editar un subsistema marca STALE lo de río abajo (§1.5: "the placement of
ejectors may require a redesign of the cooling system"); registro de decisiones + plan de tryout steel-safe
unificado (§7.3.2 + §8.3.1 + §9.2.7, transversal 119); acta de decisiones de tecnología aprobada entre las
partes (§13.10, R92).

**(b) LAS SESIONES MUESTRAN.** La revisión REAL es 100% ocular y artesanal: isos translúcidos (013 min 3.7),
rayos-X del bloque de 14 cuerpos (013 @ 32.1), Section View del stack mirando que sprue/drops/pines crucen bien
(028 @ 21:52–22:24), zoom a anillos concéntricos (020 @ 25:04), wireframe denso girado (028 @ 26:08, 040 min
36.4), Isolate cuerpo por cuerpo decenas de veces (020 dolor 5). **Interference Detection: cero veces en 8
sesiones** (013 y 025 lo declaran explícito). El cierre observado es ADMINISTRATIVO: renombrar 14 cuerpos uno a
uno (007 min 27.9–30.0, ~2.5 min; 013 @ 32.7 con F2, ~4.3 min de cierre) y Save Bodies → un .SLDPRT por placa
(007 min 31.0: 15 archivos; 013 @ 36.4) — los nombres de cuerpo SON la estructura de entrega. Higiene precaria:
croquis "Under Defined" crónicos (048 dolor 5; 020 4+ veces; 025 en 8 frames; 004 @ 19:36), save reminders de
20+ min sin guardar (020 @ 1:36, 028 @ 15:28, 040 ~min 20.3), cotas de 6 decimales (028: 471.889457). Y 020
termina cortada a media operación: sin planos, sin ensamble, sin verificación formal (dolor 9).

**(c) NECESIDAD DE UI CONJUNTA.**
- **N-29** ⭐⭐ **El modo REVISAR EN VOLUMEN es exactamente el hueco entre (a) y (b)**: los checklists del libro
  (§7.4/§8.4/§9.4/§12.5 + semáforos de máquina §4.3.3) corridos AUTOMÁTICOS por modelo sobre el lote, con
  interferencias, alineación de stack, simetría, colchones y fases faltantes (025: "esta sesión no tiene
  alimentación, agua ni planos" — un revisor batch lo reporta por archivo). Hoy la inspección es el ojo del
  experto girando un wireframe.
- **N-30** Contact-sheet de auditoría automática: las MISMAS vistas que el experto genera a mano como firma de
  cierre (sección por el bebedero + top alámbrico + translúcido del stack, 040 implicación 6) producidas en lote
  por modelo, para que el revisor humano vea 30 moldes en el tiempo que hoy le toma UNO.
- **N-31** Cierre administrativo automatizado: nomenclatura de cuerpos por convención (MAIN CORE, CAVITY PLATE,
  RISER L/R — la que 007/013 aplican a mano al final), Save Bodies + manifiesto de archivos verificado (un
  .SLDPRT por cuerpo), y linter de higiene: under-defined = 0, guardados, sin cotas no-redondas sin justificar.
  ~4 min por molde de trabajo 100% mecanizable observado (013 dolor 5).
- **N-32** Invalidación río abajo (STALE) + registro de decisiones: el libro la exige (§1.5, R29, R90) y la
  práctica multicuerpo la vuelve crítica — en un part de 60+ features (020 dolor 8) nadie sabe qué invalidó qué;
  la UI marca las fases afectadas al editar y guarda el porqué de cada decisión (§13.10) en vez de dejarlo en
  rótulos quemados por el editor del video.

---

# Mapa de tiempo agregado — ¿dónde se van los minutos?

Minutos aproximados por fase, sumados sobre las 8 sesiones (~245 min muestreados; estimaciones desde frames a
24–37 s — los tramos "entre frames" se asignan a la fase dominante del tramo):

| Fase | Min aprox | % | Sesiones que la muestran en vivo |
|---|---|---|---|
| base-placas (placas a mano + tornillería Hole Wizard) | ~118 | ~48% | TODAS (dominante en 004≈21, 013≈22, 020≈24, 040≈20, 028≈17) |
| mecanismos (sliders, candados, detalle de core) | ~23 | ~9% | 040≈11, 025≈10, 007≈2, 004≈1.4 |
| alimentacion (runner/gate/sprue tallados) | ~21 | ~9% | 007≈7, 028≈6, 013≈4.3, 048≈4 |
| expulsion (retículas de pines, retorno, resortes) | ~24 | ~10% | 013≈7.5, 004≈5, 028≈4, 025≈2.7, 048≈2.4, 020≈1, 040≈1.5 |
| agua (taps Rc + barrenos uno por uno) | ~17 | ~7% | 007≈8 (25% de su sesión), 020≈3, 013≈2, 028≈2, 048≈1, 040≈1 |
| revision (a ojo transversal + cierre renombrar/exportar) | ~15 | ~6% | 013≈5.5, 007≈4, 025≈2, 028≈1.5 |
| particion + superficies + tooling-split EN VIVO | ~8 | ~3% | casi todo en 025 (≈3.6) y 048 (detalle ≈4.4); resto HEREDADO de sesiones no grabadas |
| pieza (solo previews del resultado) | ~2 | ~1% | intro de 020/040/048/025 |
| dfm-draft-escala | ~0.4 | ~0.2% | solo 025 (panel Scale 24 s) |
| planos | 0 | 0% | NINGUNA |

**Lectura:** casi la MITAD del tiempo del ingeniero se va en geometría prismática de placas y en teclear
barrenos de catálogo — trabajo que el libro resuelve con una spec de compra (§4.3.2) y que no diseña nada.
Las fases donde el libro concentra su ingeniería (cálculo de alimentación, agua, expulsión, contracción,
estructura) consumen minutos de TALLADO pero CERO minutos de CÁLCULO en pantalla. Y las fases de mayor riesgo
conceptual (partición/split) casi no se graban: viven en sesiones previas heredadas.

---

# Top-10 de necesidades de UI (dolor observado × respaldo del libro)

1. **N-15 Base paramétrica de catálogo** — ~10 min/molde de placas a mano, en 8/8 sesiones, contra §4.3.2/§4.3.4
   que mandan comprarla estándar. El desperdicio más grande y el fix más claro.
2. **N-16 Hardware por receta funcional** — el Hole Wizard es LA actividad de la práctica (21/59 frames en 004);
   el libro da la función y regla de cada familia de barreno (§12.4.2, §12.4.3, §11.3.8, §9.1.6).
3. **N-29 Revisión batch con los checklists del libro** — checklists §7.4/§8.4/§9.4/§12.5 + §4.3.3 vs cero
   Interference Detection y pura inspección ocular en 8 sesiones: es LA promesa de "revisar decenas de modelos".
4. **N-22/N-23 Agua calculada + verificada** — capítulo 9 completo ausente de la práctica; 25% de una sesión en
   barrenos a pulso verificados por transparencia; el warpage por mal pitch NO se cura con ciclo (§9.2.6).
5. **N-19 Solver de alimentación alimentando el CAD** — ecs. 6.7–6.9 + steel-safe §6.5.5 vs cotas de memoria
   (R3×10×30, 20°, 30°) sin un solo cálculo en 4 sesiones que tallan feed.
6. **N-17 Simetría declarativa + auditor de espejos/patrones** — 19 Mirrors a mano en 040; §4.3.1; el olvido es
   silencioso e indetectable a ojo.
7. **N-25 Expulsión por regla** — pines a ojo sobre la silueta (004 @ 22:52) vs cadena ec. 11.7→11.10/11.12→
   Euler del cap. 11; el cortante en el plástico gobierna y nadie lo calcula.
8. **N-03 Contracción trazable con acta** — Scale de 24 s con factor ilegible vs cap. 10 completo + acta de
   responsabilidad §10.1.7; en batch: factor vs resina por modelo.
9. **N-13 Slider por regla** — Cut-Revolve a pulso con ángulo ilegible (040) vs geometría cerrada de §11.3.7;
   en batch: carrera vs undercut por molde.
10. **N-31 Cierre administrativo automatizado + linter** — ~4 min/molde de renombrar/exportar 100% mecanizables
    (013, 007) + under-defined crónico y saves de 20 min: higiene que el lote exige y el libro presupone.

---

# Huecos declarados (no rellenados)

**Fases/temas del LIBRO que NINGUNA sesión muestra:**
- **Venteo (cap. 8 COMPLETO)**: ni un vent de partición, pin ranurado o dead pocket en ~245 min. El libro le
  dedica un capítulo con banda h_min–h_max (§8.2.3). No observado en la práctica — no se sabe si se hace en
  sesiones no grabadas o no se hace.
- **Cotización y costeo (cap. 3 completo)**: break-even, escenarios de cavidades, tarifas — cero evidencia.
- **Worksheets de pieza y DFM formal (cap. 2)**: la pieza llega importada sin requisitos visibles.
- **Análisis de llenado (cap. 5)** y **cálculos de gate (cap. 7)**: la pestaña SOLIDWORKS Plastics existe en el
  ribbon (004, 013) y JAMÁS se abre.
- **Estructural calculado (cap. 12)**: pilares, deflexión-vs-venteo, cheeks — nada; solo la placa aparece.
- **Selección de máquina (§4.3.3)** y **contracción calculada (cap. 10)**: no observadas.
- **Planos (R122)**: cero drawings.
- **Gates de proyecto y actas (§1.5, §13.10)**: sin rastro.
- **Piezas del libro (bezel/cup/lid)**: las sesiones usan otras piezas (cuchara, clip, copa, tapa…); ninguna
  sesión reproduce los ejemplos numéricos del libro.

**Prácticas de las SESIONES que el libro NO cubre (el libro no prescribe método CAD):**
- El **flujo multicuerpo → renombrar cuerpos → Save Bodies → un .SLDPRT por placa** (007 min 27.9–31.0, 013 @
  32.7–37.0) — es EL esqueleto de entrega del taller y no tiene § en el libro; cualquier soporte de UI aquí es
  [EXTENSIÓN DECLARADA] sobre práctica observada.
- La disciplina **Feature Scope "Selected bodies"** en cada corte (040 D3, 028) y la navegación **Isolate/Exit
  Isolate** constante — gestión de multicuerpo pura, sin contraparte en el libro.
- **Move Face / Direct Editing como parche** (020 @ 13:20, 048 @ 16.4) — el libro prescribe fits calculados;
  la técnica del parche es del taller.
- El **orden real del detallado** (agua primero en 028; resortes primero en 040; runner primero en 007) varía
  por familia y no coincide con ningún orden prescrito §-por-§ — documentarlo exigiría más sesiones por familia.
- **Qué pasó en las sesiones previas heredadas** (escala/partición/split de 004, 007, 013, 020, 040, 048): las
  familias tienen videos hermanos en el catálogo (008, 012, 021, 029/030, 036, 052…) que NO se analizaron aquí
  — declarado como evidencia pendiente, no como ausencia del proceso.
