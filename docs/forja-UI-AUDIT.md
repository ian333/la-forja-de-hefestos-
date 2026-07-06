# La Forja — AUDITORÍA VISUAL de la interfaz (2026-07-02)

> Juicio del user: "el peor diseño de CAM y CAD que he visto en mi vida, todo parece
> juguete... hasta la calidad de las piezas: en los círculos se alcanzan a ver las caras".
> Auditoría hecha VIENDO los frames de los 6 videos CAM + drives. El user tiene razón
> en todo. Orden = del defecto que más grita al que menos.

## 1. EL MODELO SE VE DE JUGUETE (el peor — y es DOBLE)
- **Los círculos tienen caras.** Causa A (kernel): `tessCircle` en SketchEditor convierte
  todo círculo dibujado en POLÍGONO de N lados ANTES de llegar a OCCT → la ranura ⌀80 es
  un prisma de ~60 caras planas EN EL B-REP (por eso faces=71 en vez de ~9). Ninguna
  normal suaviza caras planas separadas. Causa B (display): `tessellate(shape, 0.25, 0.5)`
  — deflexión angular 0.5 rad = 28.6° → un cilindro VERDADERO (makeCylinder de los
  barrenos) se dibuja con ~13 segmentos = octágonos visibles en silueta.
- **Material de plastilina**: gris mate plano, sin reflejo ambiental; un CAD pro se ve
  "maquinado" (metal con envMap sutil). La selección de cara inunda de AMARILLO crema
  (MS Paint); Fusion tiñe de azul translúcido.
- FIX: perfiles circulares → arista `gp_Circ` REAL (como ya hace extrudeSpline con
  B-splines); display angular 0.5→0.2; material metálico + selección azul.

## 2. LA TOOLBAR (la señal #1 de "juguete")
- **EMOJIS como iconos** (⛏ 🛢 📐 ✂ 🧩 ⚙ 🌟). Ningún CAD serio usa emoji. Deben ser
  iconos vectoriales monocromos de 16px, trazo consistente.
- **28 botones-píldora en 2 filas, todos del mismo peso visual**, sin agrupación real ni
  jerarquía (Fusion agrupa SOLID/SURFACE/… con dropdowns y separadores).
- **Idiomas mezclados**: Extrude/Hole/Fillet/Shell/Loft/Sweep (EN) junto a
  Caja/Corte/Patrón/Sección/Encuadrar (ES). Escoger ESPAÑOL y ser consistente.
- **El CAM no cabe ahí**: las 6 ops CAM (⛏…) engordan la barra de MODELADO. Deben vivir
  en un WORKSPACE aparte (pestaña DISEÑO | MANUFACTURA, como Fusion).

## 3. PANEL DERECHO: SLIDERS para dimensiones = juguete #2
- Un CAD se maneja con CAMPOS NUMÉRICOS con unidades (+ scrub opcional), no con un
  range-slider de bolita amarilla (parece ecualizador). El user YA lo había pedido.
  (Hoy además nos mordió: step=1 del slider rechazaba ⌀6.8.)
- Tipografía: labels uppercase 10px con tracking ancho por todos lados = dashboard
  cripto; valores flotan lejos del label.

## 4. SIDEBAR / TIMELINE
- Tarjetas gordas con emoji en vez de árbol compacto con iconos vectoriales + timeline
  abajo (Fusion). "Sketch 1 · Perfil L" cuando es un RECTÁNGULO (label mentiroso).
  "COMPONENTES · ENSAMBLE" para features de corte = nombre confuso.

## 5. SKETCHER (lo menos malo, pero)
- Iconos-glifo mudos (▭ ⚓ ⌒) sin tooltip visible; fila RESTRINGIR ilegible.
- La cota flotante es una píldora pelona SIN líneas de extensión ni flechas (una cota
  real dibuja extension lines + arrowheads + valor SOBRE la línea).
- Texto explicativo quemado permanente ("azul = se mueve · blanco = clavado") = amateur;
  eso va en un tooltip/onboarding, no fijo en pantalla.

## 6. MODALES CAM/PLANO
- Sheet BLANCO quirúrgico dentro de UI oscura = flashazo. Debe ser papel gris suave.
- El texto de stats SE DESBORDA del SVG (se ve cortado "· f" en los videos).
- El toolpath se dibuja como rayitas del mismo grosor: falta el ANCHO DE HERRAMIENTA
  barrido (sombra del material removido) que es como un CAM pro comunica la pasada.

## 7. COLOR
- El DORADO se usa para TODO (marca, selección, valores, bordes, hints, chips) → cero
  disciplina de acento. Regla pro: cromo neutro; UN acento para selección/primario;
  dorado SOLO marca; semánticos (verde/rojo/ámbar) reservados a estado.

## ORDEN DE EJECUCIÓN (paridad de dolor)
1. ✅ **HECHO 2026-07-02** — Círculos reales en kernel: `SketchEditor.extractProfileAndHoles`
   reporta `circle{x,y,r}` cuando el perfil es un círculo dibujado; `Component.circle` +
   `sketch.customCircle` → `extrudeCircle` (gp_Circ, cilindro EXACTO) en corte/saliente/
   extras/base; display `tessellate(0.25, 0.5→0.2)`. VERIFICADO: la pieza del libro pasó
   de **80 caras a 17** (V28−E42+F17=3), vol exacto con π (2 ppm), círculos REDONDOS por
   sight, las 6 ops CAM siguen verdes. Video `forja-circulos-REALES-fix.mp4`. PENDIENTE
   fase 2: ARCOS en perfiles mixtos (media-luna, ranuras) siguen teselados → wire
   línea+GC_MakeArcOfCircle.
2. ✅ **HECHO 2026-07-02 (DS v2)** — Toolbar de DOS FILAS (contexto+tabs / herramientas,
   como el CommandManager): pestañas **DISEÑO | MANUFACTURA** (`tab-diseno`/`tab-manufactura`,
   API `setWorkspace`), **~28 iconos SVG vectoriales propios** (componente `Ic`, glifos CAD
   literales 16×16 trazo 1.4, CERO emoji), español consistente (Extruir/Revolución/Transición/
   Barrido/Redondeo/Chaflán/Vaciado/Cajera/Mandrinado/Desbaste 3D), segmented controls para
   XY/YZ/XZ y Base/Unir/Cortar. GOTCHA descubierto: si la fila excede el ancho, Playwright
   ajusta el scrollLeft del ROOT y CORRE toda la UI (clics de pixel al vacío, doc muerto) →
   la fila de herramientas scrollea POR DENTRO (`overflow-x:auto` propio) y la densidad se
   compactó para caber en 1600px. Los drives por botón CAM ahora clickean la pestaña antes.
3. ✅ **HECHO** — Sliders → **campos numéricos** con unidad (mono, right-aligned) + scrub
   arrastrando el label (gesto Blender/Fusion). Mismos data-testid (fill del arnés intacto).
4. ✅ parcial — **Selección AZUL** (#4C9FFF cara translúcida + aristas + chips); chips de
   selección vacíos invisibles (siguen en DOM para el arnés). PENDIENTE: material metálico
   con environment (RoomEnvironment, sin red) + grid sobrio.
5. ✅ parcial — Modales: papel gris #E9ECF0 (adiós flashazo) + **stats en la BARRA del modal**
   (`cam-stats`, wrap natural — dentro del SVG se desbordaban). PENDIENTE: swath del ancho
   de herramienta bajo la línea de centro.
6. PENDIENTE: sidebar árbol compacto (aún tarjetas gordas), acentos dorados residuales del
   panel (Espejar/Bloque·Cilindro), cotas del sketcher con extension lines + flechas,
   iconos del sketcher (siguen siendo glifos), menú Opciones (emojis quitados ✓).

**Verificación DS v2**: drive completo de 53 pasos (pieza cap 9+10 + 6 ops CAM) VERDE con
la UI nueva, vol 515,228.158 / 17 caras idénticos. Video `forja-UI-v2-rediseno.mp4`.

## TELEMETRÍA REAL (17 drives del libro, 669 gestos) — 2026-07-02
Ranking de uso que ORDENA la toolbar (pedido del user: "analiza la telemetría"):
- **El croquis es el 55% del trabajo**: sk-finish 48 · btn-sketch 38 · herramientas de
  dibujo 55 (línea 23, círculo 20, rect 9, arco 3) · cotas 25 (sk-dim-input 15 + dimDiam 10).
- **Núcleo de modelado**: input-comp-depth 23 · sketch-op-cut 17 · sketch-op-join 14 ·
  input-plane-offset 14 · extruir 11+11 · encuadrar 11 · croquis-en-cara 10 (por API) ·
  revolución 6+5 · patrón 6 · agujero-en-cara 5.
- **CERO clicks en tutoriales** → menú "Más": Transición, Barrido, Barreno, Engrane,
  Cicloidal, Vaciado, Cajera, Parámetros, Componente (btn-fillet/chamfer tampoco, pero
  son núcleo CAD conceptual → quedan visibles).
Aplicado en DS v2.1: **Croquis = botón PRIMARIO** (acento agua), fila = núcleo por uso,
cola → "Más ▾" (mismos data-testid dentro del menú).

## DS v2.1 (paleta nebulosa + zonas) — 2026-07-02
- **Paleta NATURALEZA** (pedido: "colores que hipnoticen — plantas/agua/cielo/nebulosa"):
  fondo espacio profundo (azul medianoche #0A101C→paneles #0F1725), acento AGUA #41C7D4,
  cielo #58A6FF, aurora #5DDB8C, nebulosa #8E7CFF, dorado SOLO marca. Viewport con
  gradiente radial de espacio profundo (#16283F→#050A14) + grid azul-agua oceánico.
- **ZONAS**: rieles REALES (flex columns) — izquierdo: Documento+Caras+Simulación;
  derecho: Propiedades+Análisis. fb-sim ya NO flota invadiendo el viewport. Paneles
  con mismo estilo (radio 10, borde, blur, sombra) = áreas definidas.
- ✅ CAM 3D (parcial): **stock translúcido agua** (bbox + 1.5 sobrematerial, bordes teal)
  + **toolpath 3D sobre la pieza** (cortes ámbar / rápidos agua, hélices muestreadas) en
  workspace MANUFACTURA; generar una op te lleva a esa pestaña. PENDIENTE simulación:
  remoción de material animada (motor heightmap listo), Setup/WCS, Verify, Stock editable.

## DS v2.2 — VENTANAS FLOTANTES (2026-07-02)
Pedido del user: "define espacios… y que las ventanas sean flotantes y se puedan mover".
- Cada panel (Documento/Caras/Simulación/Parámetros/Análisis) arranca DOCKED en su riel
  (zonas limpias por default) y se **JALA de la cabecera** para flotar donde quieras
  (position:fixed + persistencia en localStorage `forja-winpos`); **doble clic en la
  cabecera lo re-anida** al riel. Cursor grab/grabbing. Verificado con drags reales del
  arnés (video `forja-UI-v4-ventanas-flotantes.mp4`).
- Caras/Simulación/Análisis arrancan COLAPSADOS (la telemetría los marca poco usados)
  → menos amontonamiento por default.
- ✅ (a) RESUELTO: umbral de 4px — clic limpio colapsa fiable, el drag solo arranca
  con movimiento real. (b) pendiente: alto de ventana flotante al contenido; (c) al
  user NO le gusta el diseño de los PLANOS de taller (SVG) — anotado, "no vital".

## DS v3 — RIBBON "lo mejor de Fusion + SolidWorks" (2026-07-02, pedido del user)
Estudié ambas UIs (docs oficiales) y esto se adoptó:
- **De Fusion**: app bar ÚNICA delgada (marca + nombre de pieza + workspaces con subrayado
  de acento + estado + undo + Opciones) — header y fila de contexto FUSIONADOS: el cromo
  pasó de 3 bandas (~122px) a 2 (~118px pero una es el ribbon útil).
- **De SolidWorks**: ribbon **CommandManager** — botones GRANDES icono-arriba-label
  agrupados con **caption del grupo debajo** (CROQUIS · CREAR · MODIFICAR · DOCUMENTAR;
  MANUFACTURA: FRESADO · CIMO CAP 9-10), y la **heads-up view bar** flotando arriba-centro
  del viewport (Encuadrar/ISO/SUP/FRE/Sección) — las ops de vista YA NO engordan el ribbon.
- El contexto del croquis (XY/YZ/XZ + offset + Base/Unir/Cortar) vive DENTRO del grupo
  CROQUIS como mini-stack de 2 líneas (como el PropertyManager compacto de SW).
- Verificado: drive completo 57 pasos verde, geometría idéntica. Video
  `forja-UI-v5-ribbon-fusion-solidworks.mp4`.
- Sigue del pulido: chip de selección vs heads-up (misma banda, separarlos), dorados
  residuales del panel (Espejar/headers), alto de ventana flotante, planos de taller.
