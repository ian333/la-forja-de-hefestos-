# Requisitos de UI — Libro del cliente, capítulos 1–3 (+ arranque del cap. 4)

Fuente: `kazmer-caps1-3.txt` (2,774 líneas, leído completo). Temas: proceso general de desarrollo del molde,
grafo con retornos (Fig. 1.9), requisitos y DFM de la pieza (cap. 2), cotización y costeo (cap. 3), e
introducción del layout (§4 intro). Toda afirmación cita el § del libro; lo que las figuras traían como
imagen (no texto) se declara "no observado" al final. Este tomo NO incluye grabaciones: cero citas de
sesión+minuto aquí.

Formato de cada requisito: `[fase] [§] requisito (APRENDER/REVISAR/ambos)`.

---

## A. DECISIONES humanas → pantallas/menús de decisión

1. [alimentacion] [§1.4.3, Tabla 1.1] Pantalla de decisión "tipo de alimentación": matriz two-plate / three-plate / hot-runner × 6 medidas del libro (flexibilidad de gate, consumo de material, ciclo, inversión inicial, arranque, mantenimiento) con niveles Poor/Good/Excellent literales; se elige por perfil de volumen y capacidades del moldeador. (ambos)
2. [alimentacion] [§1.4] Al considerar two-plate, mostrar sus 6 limitaciones literales (feed atado al plano de partición, gating limitado, espaciado de cavidades restringido, fuerzas extra del feed, desperdicio del runner frío, ciclo extra por plasticar/enfriar el feed) como criterios para escalar de tipo de molde. (APRENDER)
3. [alimentacion] [§1.4.1] Al elegir three-plate, advertir sus 3 problemas: la colada fría se moldea y expulsa CADA ciclo (material+ciclo), placas/componentes extra (costo), y carrera de apertura grande → check contra el "daylight" de la máquina destino. (ambos)
4. [alimentacion] [§1.4.2] Al elegir hot runner, advertir sus 2 desventajas: inversión y control de temperatura extra (no todo moldeador tiene auxiliares/expertise) y purga larga en cambios de resina/color para corridas cortas con requisitos estéticos. (ambos)
5. [alimentacion] [§3.2.2] Capturar la RAZÓN no económica de la decisión de feed cuando aplique: cambio rápido de color (→ evitar hot runner, el libro remite a §6.4.8), capacidad/preferencia del moldeador, estandarización lean de tamaño de molde; la razón queda en el registro de decisiones. (ambos)
6. [revision] [§1.3.2] Número de cavidades = "critical design decision" que impacta tecnología, costo, tamaño y complejidad → pantalla de decisión dedicada alimentada por el método de costos del cap. 3. (ambos)
7. [revision] [§3.2.2] A volúmenes intermedios (~500,000) el óptimo puede ser ni 2 ni 32 sino 4/8/16 cavidades con o sin hot runner: la UI genera y compara MÚLTIPLES escenarios de diseño+costo, y permite entregar más de un diseño al cliente para que elija. (ambos)
8. [particion] [§1.3.2] Guía de layout multi-cavidad: cavidades tan juntas como sea posible SIN sacrificar agua/expulsión → molde más chico, más barato, más fácil para el moldeador y cabe en más máquinas; la UI muestra el trade-off al acomodar. (ambos)
9. [tooling-split] [§3.3.1.2 ejemplo] Selector de material de insertos con el criterio del libro visible (pieza de tolerancia apretada + alto volumen → acero D2 por resistencia a desgaste/abrasión; ρ=7670 kg/m³, 21.4 $/kg) y propiedades desde Apéndice B. (ambos)
10. [base-placas] [§3.3.2, Tabla 3.7 de aceros] Selector de acero de la base DME #1/#2/#3 (SAE 1030 → 3.55 $/kg, AISI 4130 → 4.40, AISI P20 → 5.25). (ambos)
11. [pieza] [§2.2.2] Cada campo de producción distingue su ORIGEN: especificación del cliente vs resultado intermedio calculado (tcycle, cavidades "may not be available at the start... are intermediate results"); si el cliente no los fija, la UI itera diseño con análisis de costos. (ambos)
12. [dfm-draft-escala] [§2.3.7] Pantalla de decisión POR CADA undercut: eliminar vs conservar; criterio literal: NO eliminarlo si la función es vital o si quitarlo obliga a operaciones post-molde o a partir la pieza en varias; alertar al cliente y trabajar con el diseñador de producto. (ambos)
13. [dfm-draft-escala] [§2.3.1–2.3.2] Decisión de espesor: engrosar el nominal vs pared delgada + ribs, con los números del libro en pantalla (pared 30% más gruesa ≈ +15% material y +70% de ciclo vs delgada con ribs de rigidez equivalente). (ambos)
14. [superficies] [§2.3.5, Tablas 2.12–2.13] Selector de acabado: liso SPI (D-3 → A-1 con método y rugosidad) vs textura (arena 50 μm/B, piel 125 μm/C, red 150 μm/C, madera 250 μm/D); la textura exige pre-acabado B (someras) o C (rugosas) y tiempo/equipo dedicado en el plan. (ambos)
15. [expulsion] [§3.3.3, Tabla 3.9] Menú del sistema de expulsión (pines redondos; mezcla pines/cuchillas/camisas; stripper plate; slide o lifter externo; interno; core pull actuado; expulsión inversa) — cada opción arrastra sus 2 coeficientes de costo en vivo. (ambos)
16. [agua] [§3.3.3, Tabla 3.8] Menú del sistema de enfriamiento (líneas rectas c/o-rings; rectas + bubblers/baffles; circuito con plugs; circuito + bubblers/baffles; layout complejo con insertos conductivos o conformados) con coeficientes en vivo. (ambos)
17. [base-placas] [§3.3.3, Tabla 3.10] Menú estructural (sin soporte y partición plana; partición multi-escalonada; partición contorneada compleja; pilares; pilares+interlocks; split cavity) — el sellado core/cavidad cuenta como sistema estructural. (ambos)
18. [revision] [§3.3.3, Tabla 3.11 de misceláneos] Menú de personalizaciones extra (sensores de T y P, gas assist, runner shut-offs, dynamic melt control, insert molding, IML, two-shot, three-shot); default vacío: "for most molds, none of these customizations are required". (ambos)
19. [revision] [§3.4.3, Tabla 3.13 de capacidad] Selector de máquina: 3 clases base (hidráulica vieja 0.8 / estándar 1.0 / eléctrica moderna 1.1) + sumadores apilables (utilidad +0.1, robot+banda +0.05, control hot runner +0.05, gas +0.1, iny-compresión +0.1, operador dedicado +0.15, two-shot +1.0, three-shot +1.4). (ambos)
20. [alimentacion] [§3.4.2, Tabla 3.12] Decisión de regrind: cold runner 1.25 → 1.08 si se usa TODO el regrind (con costo declarado de mano de obra/energía de reciclar); hot runner 1.05 corridas cortas / 1.02 largas. (ambos)
21. [particion] [§4 intro] Flujo guiado del layout en el orden del libro: dirección de apertura → plano de partición → largo/ancho/alto de insertos → selección de base y acomodo "tan simple y compacto como sea posible". (ambos)
22. [pieza] [§2.2.4] Política de valor en la UI de revisión: proponer al cliente mejoras de diseño detectadas (p. ej. quitar un ángulo que crea undercut) en vez de callar para cobrar el core pull — "es estrategia perdedora a largo plazo". (APRENDER)

## B. CÁLCULOS que la UI muestra VIVOS (fórmula + números intermedios + §)

23. [revision] [§3.2.2, Ec. (3.1)] Break-even vivo: Ctotal = Cfixed + ntotal·Cmarginal por escenario; n_breakeven = (Cfixed^HR − Cfixed^CR)/(Cmarginal^CR − Cmarginal^HR); ejemplo reproducible: ($250,000−$10,000)/($0.55−$0.16) = 615,000 piezas; gráfica log-log tipo Fig. 3.4. (ambos)
24. [revision] [§3.3, Ec. (3.2)] Ctotal_mold = Ccavities + Cmold_base + Ccustomization con el desglose del bezel siempre disponible como caso guía ($27,900 + $3,700 + $43,200 ≈ $74,800). (ambos)
25. [tooling-split] [§3.3.1, Ec. (3.3) + Tabla 3.5] Ccavities = (Ccavity·ncavities)·f_discount; descuento por duplicación de juegos: 1 / 0.85 / 0.72 / 0.61 / 0.52 (−15% por doblar, piso en ≥16 juegos). (ambos)
26. [tooling-split] [§3.3.1.1, Ec. (3.4)] Ccavity = materiales + maquinado + acabado, mostrado como suma visible con los 3 sumandos del ejemplo ($435 + $25,800 + $1,700). (ambos)
27. [tooling-split] [§3.3.1.2, Ecs. (3.5)–(3.7)] Dimensiones de insertos auto-estimadas y editables: Lcav = Lpart + max[0.1·Lpart, Hpart]; Wcav ídem; Hcav = max[0.057, 2·Hpart] (metros); volumen → masa → costo del material. (ambos)
28. [tooling-split] [§3.3.1.3, Ecs. (3.8)–(3.10)] Tiempo volumétrico t_vol = Vcavity/R_volumen con tasas de remoción por material (Apéndice B) y costo = t·tarifa. (ambos)
29. [tooling-split] [§3.3.1.3, Ec. (3.11)] Tiempo de área t_area = Apart_surface/R_área; el CAD provee área y volumen exactos de la pieza. (ambos)
30. [tooling-split] [§3.3.1.3, Ec. (3.12) + Tabla 3.3] Factor de complejidad calculado, no opinado: f_complexity = (Apart_surface·hwall)/Vpart, con galería de ejemplos del libro (1.02 / 1.9 / 2.5 / 3.1) para calibrar el ojo. (ambos)
31. [tooling-split] [§3.3.1.3, Tabla 3.4] f_machining = promedio PONDERADO por proporción de uso de procesos (torneado 0.5, taladrado 0.5, fresado 1, rectificado 4, EDM 4) → editor de mezcla de procesos. (ambos)
32. [tooling-split] [§3.3.1.5, Ecs. (3.13)–(3.14) + Tabla 3.6] Acabado por ZONAS: t = Σ Ai/Ri con tasas por nivel (textura 0.0002 m²/h … D-3 0.02 m²/h); la UI resta áreas ya contadas para no duplicar (como el frente del bezel en el ejemplo); recordar que el acabado es 5–30% del costo total del molde. (ambos)
33. [base-placas] [§3.3.2, Ec. de costo de base + Ec. (3.15)] Cmold_base = US$830 + Mmold·κ; Mmold = 1330·L·W + 17200·L·W·H (kg, metros); mostrar la procedencia estadística (regresiones R² = 0.9791 y 0.999 de las notas al pie) como sello de "no inventado". (ambos)
34. [base-placas] [§3.3.2, Ecs. (3.16)–(3.17)] Dimensiones de molde estimadas: Lmold = Lcav·ncav_largo·1.33; Wmold ídem; Hmold = 0.189 + 2·Hcav; rejilla inicial con ceiling(·) sobre el número de cavidades — el libro declara que esta estimación SOBREESTIMA tamaño y costo (etiquetarla así). (ambos)
35. [revision] [§3.3.3, Ec. (3.18)] Ccustomization = Ccavities·Σf_cavity + Cmold_base·Σf_mold sumando sobre i ∈ {alimentación, agua, expulsión, estructura, misceláneos}; recálculo en vivo con cada palomita de tecnología (los factores YA incluyen la compra de componentes: hot runners, fittings, core pulls). (ambos)
36. [revision] [§3.4, Ec. (3.19)] Cpart = (Cmold/part + Cmaterial/part + Cprocess/part) / yield, con los 4 términos visibles (bezel: (0.22+0.06+0.19)/0.98 = $0.48). (ambos)
37. [revision] [§3.4.1, Ec. (3.20) + Tabla 3.11 de mantenimiento] Cmold/part = (Ctotal_mold/ntotal)·f_maintenance; matriz 3×3 visible: molde suave 3/10/20, acero estándar P20 2/5/10, endurecido H13 2/2/3 según plástico (sin carga / viscoso o con partícula / con fibra). (ambos)
38. [revision] [§3.4.2, Ec. (3.21)] Cmaterial/part = Vpart·ρ·κ·f_feed_waste con el factor de la Tabla 3.12 según feed elegido. (ambos)
39. [revision] [§3.4.3, Ecs. (3.22)–(3.23) + Tabla 3.13 de eficiencia] Cprocess/part = (tcycle/ncavities)·R/3600; tcycle = 4 [s/mm²]·hwall²·f_cycle_efficiency (semi-auto c/operador 2.5|3.0, gravedad/robot 1.5|2.0, full-auto 1.0|1.5 para CR|HR). (ambos)
40. [revision] [§3.4.3, Ec. (3.24)] Tarifa de máquina Rmolding = [47.0 + 0.073·Fclamp − 4.7·ln(Fclamp)]·f_machine ($/h, F en toneladas métricas). (ambos)
41. [revision] [§3.4.3, Ec. (3.25)] Tonelaje Fclamp = 75·10⁶ Pa × (ncav·Lpart·Wpart) / 9800 → mTon, siempre etiquetado "estimación conservadora" (presión media supuesta de 75 MPa sobre área proyectada). (ambos)
42. [revision] [§3.4.4, Tabla 3.14] Yield estimado por volumen × exigencia (10k: 0.95|0.90; 100k: 0.98|0.95; 1M: 0.99|0.98) con la nota de arranque: 50–60% en aplicaciones difíciles. (ambos)
43. [revision] [§3.2.1, Tabla 3.1] Tabla comparativa por escenario reproducible en la UI: cavidades, tipo de runner, costo de molde, tcycle, ciclo efectivo por parte, y costos por parte (proceso/molde/material/total). (ambos)

## C. CHECKLISTS / criterios de aceptación (modo REVISAR: semáforo)

44. [pieza] [§2.2.1, Tabla 2.1] Worksheet de aplicación: nombre/número de proyecto, 4 fechas hito (inicio, cavidades maquinadas, prueba de molde, producción en volumen) y 4 metas de costo por parte (material, molde, proceso, total) → semáforo vivo de meta vs estimado. (ambos)
45. [pieza] [§2.2.1, Tabla 2.2] Contactos: técnico del cliente + ingeniero interno de ventas/aplicaciones (canal para no molestar al cliente con dudas "potencialmente triviales"). (REVISAR)
46. [pieza] [§2.2.2, Tabla 2.3] Worksheet de producción de 9 campos: vida de la aplicación, cantidad total, horas de moldeo/año/máquina, tasas mín/máx de producción, tcycle esperado, cavidades por molde, family mold sí/no + número de partes, número de moldes. (ambos)
47. [pieza] [§2.2.3, Tabla 2.4] Worksheet de uso final de 8 campos (temperatura, carga, deflexión permisible, esfuerzo de cedencia, deformación a falla, impacto, absorción de agua, resistencia química). (REVISAR)
48. [pieza] [§2.2.3, Tabla 2.5] Worksheet regulatorio (ANSI, FDA, IEC, MIL-SPEC, ISO, UL); el cliente debe entregar copia con lo que afecta al molde resaltado — si no hay, se declara "sin regulación aplicable declarada". (REVISAR)
49. [pieza] [§2.2.3, Tabla 2.6] Tolerancias: UNA general en % (típica ±0.4%, apretada ±0.1%) + máximo unas POCAS críticas (la tabla da 3 renglones); más críticas que eso = bandera de sobre-especificación. (ambos)
50. [pieza] [§2.2.3, Tabla 2.7] Estética: sistema de color (DIN/RAL/Munsell/AFNOR/NCS/Pantone), match entre componentes, % de gloss, acabado SPI, textura (proveedor/número) y SUPERFICIES CRÍTICAS donde knit-lines, marca de gate, sink y witness marks están prohibidos. (ambos)
51. [dfm-draft-escala] [§2.2.4, Tabla 2.8] Checklist DFM de 9 puntos con semáforo individual: espesor uniforme/mínimo, sin esquinas vivas, ribs efectivos, bosses efectivos, draft aplicado, sin undercuts, tolerancias alcanzables, gates especificados, longitud de flujo requerida. (ambos)
52. [pieza] [§2.2.4, Tabla 2.9] Checklist DFA de 6 puntos: partes minimizadas, ensamble top-down, snaps diseñados/evitados, sujetador uniforme, simetría u asimetría obvia, requisitos de take-out. (REVISAR)
53. [pieza] [§2.2.5, Tablas 2.10–2.11] Ficha de material plástico (la da el CLIENTE; 18 propiedades incl. viscosidad y PvT) y ficha de metal del molde (la elige el DISEÑADOR; verificar con proveedor y DOCUMENTAR los supuestos que gobiernan el diseño). (ambos)
54. [dfm-draft-escala] [§2.3.2, Fig. 2.3] Check paramétrico de rib: base = 70% de pared, altura = 4× pared, paso = 10× pared, draft 2°; violación de 70% → ver trampa de sink (req. 78). (ambos)
55. [dfm-draft-escala] [§2.3.3, Fig. 2.4] Check de boss: boss/rib/gusset al 70% del nominal; debe resistir torque de inserción del tornillo autorroscante y pull-out de uso; gussets a 90°/120° según posición; en estos features chicos se acepta menos draft para ganar rigidez sin subir mucho la fuerza de expulsión. (ambos)
56. [dfm-draft-escala] [§2.3.4, Figs. 2.5–2.6] Check de esquinas: fillet exterior = 150% de pared e interior = 50% (espesor constante en la vuelta); chamfer interno = ½ pared a 45°; sugerir radios que existan en herramienta estándar para no fabricar cortadores custom. (ambos)
57. [dfm-draft-escala] [§2.3.6, Tabla 2.14] Check de draft: mínimo 0.5°, 1–2° típico por recomendación de proveedor de resina, +1° por cada 20 μm de rugosidad/profundidad de textura; subir para vidrio/mica y baja contracción, bajar para flexibles (PVC suave); ejemplos: A-1 acrílico 0.5° … piel sobre ABS 7.5°. (ambos)
58. [dfm-draft-escala] [§2.3.7, Fig. 2.7] Detector de las 4 familias de undercuts del libro: ventana en pared lateral, voladizo sobre pared de fondo, boss horizontal, dedo de snap. (ambos)
59. [revision] [§2.2] Los worksheets NO son páginas estáticas: son documentos VIVOS ligados a decisiones, con ruteo a las personas correctas para información y APROBACIÓN (ISO/regulación exige documentación formal) → cada campo con dueño, estado y trazabilidad. (ambos)

## D. RETORNOS / iteraciones → navegación e invalidación río abajo

60. [revision] [§1.5, Fig. 1.9] Gate "Project OK?": si NO → regresar a "Develop preliminary mold design & quote" / "Review part design and specifications"; nada del lado derecho (diseño en serio) se habilita sin este OK. (ambos)
61. [revision] [§1.5, Fig. 1.9] Gate "Moldings OK?": si NO → regresar a maquinado/pulido/ensamble/pruebas; la UI distingue "tweak" (lo usual: ajustar molde y proceso) de "fatal flaw" (desechar el molde y rediseño completo). (ambos)
62. [revision] [§1.5] Diseñar un subsistema puede exigir REdiseñar uno ya hecho — cita literal: "the placement of ejector(s) may require a redesign of the cooling system" → al editar expulsión, marcar el agua (y aguas abajo) como STALE, no borrar en silencio. (ambos)
63. [revision] [§2.1, Fig. 2.1] Toll-gates del proceso de producto (5 aprobaciones: concepto→diseño→desarrollo→scale-up→launch); el presupuesto mayor solo se libera tras cada review — estados del proyecto en la UI. (APRENDER)
64. [revision] [§3.4.4 ejemplo] Veredicto de SOBRE-DISEÑO automático: si el costo amortizado de molde domina material+proceso (bezel: 0.22 vs 0.06+0.19), la UI recomienda regresar a re-cotizar con cold runner u otra cavitación — cita: "the mold may have been over designed. Further cost analyses should be performed". (REVISAR)
65. [base-placas] [§4 intro] Las bases vienen en tamaños DISCRETOS: "iteration between the inserts' sizing and mold base selection is normal" → la UI soporta el ida-y-vuelta; y congelar layout es un gate porque "these dimensions are quite expensive to change once the mold making process has begun". (ambos)
66. [revision] [§1.5] Ingeniería concurrente: ordenar base/placas al confirmar la orden acelera, PERO "should not be applied to fuzzy aspects of the design" → la UI marca explícitamente qué dimensiones están FIRMES para compra y cuáles siguen difusas. (ambos)
67. [revision] [§1.5, Fig. 1.9] Columna vertebral de navegación del diseño en el orden del libro: Layout → Alimentación → Agua → Expulsión → Estructura → Maquinado/pulido/ensamble/pruebas, con los dos gates de las Figs. 1.9. (ambos)

## E. ENTREGABLES → pantallas de salida

68. [revision] [§3.1] Cotización con términos de pago del acuerdo típico: 1/3 al aceptar la quote (se compra base y materiales clave), 1/3 a mitad del proyecto (insertos de cavidad maquinados), 1/3 al aceptar la CALIDAD de las piezas moldeadas; más términos de entrega. (ambos)
69. [revision] [§3.1, Fig. 3.1] Calendario de desembolsos mensuales del proyecto: pagos del molde, trials ~mes 3 (con ~100 piezas de preproducción para marketing/pruebas), costos de producción y mantenimiento intermitente. (REVISAR)
70. [revision] [§1.5] Campos de garantía en la cotización: los clientes "increasingly requiring guarantees on mold delivery and quality, with penalties" → fechas garantizadas y penalizaciones como parte del documento de salida. (REVISAR)
71. [revision] [§3.2, Figs. 3.2–3.3] Pantalla de desglose de drivers de costo (material / molde amortizado / proceso, con sub-árbol: base, maquinado, acabado, rework, cantidad, yield, regrind, tarifa...) y comparación commodity vs specialty. (ambos)
72. [revision] [§3.5] Reporte comparativo de MÚLTIPLES estimados de costo por diseño candidato "until an effective mold specification is established" — la especificación del molde ES el entregable que alimenta el layout del cap. 4. (ambos)
73. [pieza] [§2.2.1] El número de parte/proyecto se estampa en TODA la documentación generada por el sistema. (REVISAR)
74. [revision] [§3.4.4] Catálogo de defectos del libro para clasificar rechazos y alimentar el yield: short shot, flash, contaminación, color fuera, splay/blush, warpage/dimensional, quemaduras, gloss pobre. (ambos)

## F. TRAMPAS contraintuitivas → alarmas de la UI

75. [dfm-draft-escala] [§2.3.1, Fig. 2.2] Flujo de sección DELGADA a GRUESA = jetting y mal control dimensional (la delgada solidifica antes y ya no empaca la gruesa): alarma DIRECCIONAL según posición del gate; mejor grueso→delgado y con transición gradual. (ambos)
76. [dfm-draft-escala] [§2.3.2] El rib "más fuerte" (>70% de pared) EMPEORA la pieza: jala material y produce sink/voids en la cara opuesta; excepción declarada del libro: materiales muy cargados en aplicaciones no estéticas. (ambos)
77. [pieza] [§2.2.3] Tolerancia especificada ≠ alcanzable; sobre-especificar es común ("not uncommon for product designers to over-specify") → alarma + guion de conversación: prototipo para caracterizar contracción, perfilado no uniforme de contracciones, modificaciones al comisionar. (ambos)
78. [superficies] [§2.3.5] Doble trampa del espejo: el costo escala porque hay que aplicar TODOS los niveles inferiores de acabado antes (C-3 requiere blasts previos + piedra #320), Y el acabado fino hace MÁS visibles los defectos de moldeo (costo de proceso y mantenimiento sube). (ambos)
79. [superficies] [§2.3.5 + §2.3.6 + §3.3.1.5] Un solo selector de acabado debe propagar TRES efectos a la vez: pre-acabado requerido (B/C para textura), draft extra (+1°/20 μm) y costo/tiempo de acabado (Tabla 3.6) — si la UI los separa, el usuario olvida alguno. (ambos)
80. [dfm-draft-escala] [§2.3.6] Draft de ½–1° "se ve razonable" pero puede atorar la pieza; mica/vidrio con baja contracción y alta rugosidad lo agravan — el draft permisible es función de material + proceso + acabado, no un número fijo. (ambos)
81. [tooling-split] [§3.3.1.3] Eficiencia de maquinado: teoría 100%, realidad "rarely exceeds 50%", el libro RECOMIENDA 25% para costeo → un estimado con eficiencia optimista se ve profesional y queda 4× corto; la UI usa 25% por default y exige justificar cambios. (ambos)
82. [tooling-split] [§3.3.1.3] Salario directo del matricero ($23.94/h en EUA) ≠ tarifa facturada (~$100/h con prestaciones, planta, herramienta, overhead, utilidad): cotizar con salario = error clásico; la UI etiqueta cuál usa. (ambos)
83. [tooling-split] [§3.3.1.3] Asumir remover TODO el volumen del inserto "parece exagerado pero no lo es" (se desbasta fuera del core y dentro de la cavidad) — la UI defiende el supuesto con esta cita cuando el usuario intente "corregirlo". (APRENDER)
84. [base-placas] [§3.3.1.2 nota + §3.3.2] UNIDADES: "all dimensions must be stated in meters" o los coeficientes estadísticos (830, 1330, 17200, 0.057, 0.189) revientan — la UI fija SI internamente y convierte solo en la vista. (ambos)
85. [revision] [§3.4.1] "Maintenance costs can far exceed the purchase cost" del molde en su vida útil; combinación letal: molde suave + plástico con fibra = f_maintenance 20; mostrar la matriz al elegir el acero, no después. (ambos)
86. [revision] [§3.4.3, Ec. (3.23)] El espesor entra AL CUADRADO en el ciclo: 3 mm no es el doble de 1.5 mm, es ~4× — alarma cuando el usuario suba espesor "para ganar rigidez" sin ver el ciclo. (ambos)
87. [revision] [§3.4.3 ejemplo] El tonelaje con área proyectada completa es deliberadamente conservador (la ventana del bezel reduce el real: "likely less than 294 mTon") — etiquetar "conservador", no tratarlo como error ni recortarlo sin análisis. (ambos)
88. [revision] [§3.1] Maquillar la cotización según hambre/saturación del taller "should be avoided since the provided quote does not represent the true costs" → la UI separa COSTO verdadero de PRECIO comercial. (APRENDER)
89. [alimentacion] [§3.4.2, Tabla 3.12] Hot runner NO siempre ahorra material: en corridas cortas la purga de arranque lo sube a 1.05 (vs 1.02 en largas) y el cold runner con regrind total queda en 1.08 — la ventaja depende del tamaño de corrida. (ambos)
90. [revision] [§1.2] Anti-sobre-diseño: "the tendency among novice designers, when in doubt, is to over design... leads to large, costly, and inefficient molds"; los conflictos (agua vs pines de expulsión) se resuelven por importancia RELATIVA, no sumando todo. (APRENDER)
91. [revision] [§3.2] Los drivers de costo NO incluyen indirectos (overhead/utilidad): se absorben ajustando tarifas horarias → no sumarlos dos veces en la cotización. (ambos)
92. [revision] [§3.4, Ec. (3.19)] El yield DIVIDE el costo completo (molde+material+proceso), no solo el material: con yield 0.5 de arranque, TODO cuesta el doble por pieza buena. (ambos)
93. [revision] [§3.2.2] La cantidad de producción real "no se conoce con precisión" → mostrar sensibilidad/banda alrededor del break-even, nunca un solo número que decida solo. (ambos)

## G. Qué APRENDE un junior con las piezas y ejemplos del libro

94. [pieza] [§3.3–3.4, Tabla 3.2 y Fig. 3.5] Pieza guía end-to-end: bezel de laptop ABS, 1,000,000 piezas, 240×160×10 mm, pared 1.5 mm → molde $74,800 → parte $0.47–0.48; el modo APRENDER hace que el junior reproduzca CADA número intermedio del capítulo. (APRENDER)
95. [revision] [§3.2, Fig. 3.3] Cable tie (10M piezas) vs conector custom (100k): mismo peso, estructura de costos opuesta — lección de que el volumen manda sobre la geometría. (APRENDER)
96. [revision] [§3.2.1, Tabla 3.1] 2 cavidades cold runner $0.75/parte vs 32 cavidades hot runner $0.21/parte — pero el hot runner solo gana después de 615,000 piezas (conectar con req. 23). (APRENDER)
97. [pieza] [§1.1, Fig. 1.2] Línea de tiempo del ciclo (pieza ~2 mm): el ENFRIAMIENTO domina el ciclo (difusividad térmica baja del plástico), el llenado se optimiza para presión/esfuerzos, el packing termina con freeze-off del gate, y el reset "provides negligible added value". (APRENDER)
98. [pieza] [§1.2, Fig. 1.3] Jerarquía de funciones del molde (contener el melt / transferir calor / expulsar) con sus funciones secundarias y CONFLICTOS entre ramas como ejercicio interactivo. (APRENDER)
99. [pieza] [§1.3.1] Glosario visual de componentes con los nombres MÚLTIPLES del libro (placa "A" = retén de insertos de cavidad; ejector housing = rear clamp plate; risers/rails), anillo centrador estándar 100 mm, toe clamps, guías y bujes. (APRENDER)
100. [pieza] [§1.3.3, Fig. 1.6] Recorrido del melt animado sobre la sección A-A: nozzle → sprue bushing → runners en el plano de partición → gates → cavidades; y qué componente trabaja en cada etapa del ciclo. (APRENDER)
101. [expulsion] [§1.3.3] Por qué la pieza queda del lado MÓVIL: "the moldings stay with the moving half since they have shrunken onto the core"; secuencia apertura → placa ejectora → pines → caída/robot → cierre. (APRENDER)
102. [alimentacion] [§1.4.1, Fig. 1.7] Cinemática del three-plate: sprue pullers retienen la colada, stripper bolts jalan placas en secuencia → degating AUTOMÁTICO que habilita ciclo full-auto. (APRENDER)
103. [alimentacion] [§1.4.2] Gates térmicos del hot runner: solidifican para sellar al abrir el molde y la presión interna los ROMPE al arrancar el siguiente ciclo. (APRENDER)
104. [revision] [§1.5 + §2.1.5] Con solo 4 datos (dimensiones generales, espesor de pared, material, cantidad de producción) se arranca layout preliminar + cotización → el formulario de entrada mínimo del sistema es de 4 campos, lo demás puede llegar después. (ambos)
105. [dfm-draft-escala] [§2.3.4] La esquina viva castiga TRES veces: concentra esfuerzo (falla frágil), complica el maquinado (herramientas decrecientes/procesos especiales) y desbalancea el enfriamiento core-caliente/cavidad-fría → contracción diferencial y warpage. (APRENDER)
106. [dfm-draft-escala] [§2.3.4] Tip de CAD del libro: filetear las aristas EXTERIORES antes del shell y el fillet interno (ext−espesor) sale solo. (APRENDER)
107. [tooling-split] [§3.3.1.4, Tabla 3.5] Curva de aprendizaje del taller: −15% por cada duplicación de juegos de cavidades, tope a 16 (base: investigación de factores humanos; sustituible por datos propios). (APRENDER)
108. [mecanismos] [§2.3.7 + §3.3.3, Tabla 3.9] Cada undercut detectado mapea a su mecanismo (slide/lifter externo o interno, core pull actuado) y ARRASTRA su coeficiente de costo a la cotización viva — el junior VE cuánto cuesta cada feature del diseño. (ambos)
109. [pieza] [§2.1.3–2.1.4] Estados alpha (piezas del herramental real, batería de pruebas) y beta (producción piloto a clientes clave) como hitos del proyecto en la UI. (APRENDER)
110. [tooling-split] [§4 intro] El material del molde es decisión de DOBLE efecto: determina tiempo/costo de fabricación Y el desempeño estructural/térmico del molde en operación. (APRENDER)
111. [revision] [§3.1] Realidad del quoting: RFQs regresan con variación de 3× o más; preguntar detalles, explorar si el rediseño baja el costo; lista de proveedores calificados y modo "cost plus" en asociaciones de confianza. (APRENDER)

---

## H. Notas de fuente (para no inventar)

- **Numeración duplicada EN EL LIBRO**: hay dos "Tabla 3.7" (aceros de base y coeficientes de feed), dos "Tabla 3.11" (misceláneos y mantenimiento), dos "Tabla 3.13" (eficiencia de ciclo y capacidad de máquina) y dos "Ec. (3.14)" (tiempo de acabado y costo de base). La UI y los docs deben citar por NOMBRE + §, nunca solo por número.
- **Ec. (3.17)**: en el texto plano quedó "ceiling(ncavities)" — el símbolo de raíz no sobrevivió a la extracción; lo verificable es que el libro la declara estimación de rejilla que "will tend to make the mold have larger size and cost than might actually be realized". Se transcribe con esa salvedad; el símbolo exacto: no observado en esta fuente.
- **Figuras**: las imágenes de las Figs. 1.1–3.5 no vienen en el texto plano; solo se usaron sus descripciones textuales. El contenido puramente gráfico (p. ej. hatch patterns de la Fig. 1.6, fotos de texturas de la Tabla 2.13) queda como no observado.
- **Cap. 4**: este tomo solo trae la introducción del layout (últimas líneas); partición, dimensionado de insertos y selección de base en detalle quedan para el siguiente tomo.
- **Grabaciones de sesiones**: no forman parte de esta fuente; ningún requisito de este archivo cita sesión+minuto.
