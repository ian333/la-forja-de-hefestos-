# 10 · ¿Qué existe ya y qué hace falta para imprimir SEGURO?

> Agente 10 · 2026-11-05 · números en `scripts/investigacion-arco/10_estado_del_arte_seguridad.py` → `.out`.
> Fuentes numeradas [n] en §8. Lo que viene «de memoria» o sin texto completo está marcado.

## 1. La pregunta

¿Es cierto que «no hay nada hecho» en soltar la gota por resonancia, oírla en el voltaje del arco e imprimir gota a gota sin gas? ¿Qué falta para hacerlo seguro en interiores con E71T-GS?

## 2. La respuesta corta

- **«No hay nada hecho» es FALSO para el núcleo físico.** Desde 1997 se publica cómo excitar la oscilación de la gota con la corriente y soltarla en fase (Univ. de Kentucky, patentes US6013896 y US6008470, ya **expiradas**) [1–6]. Harbin soltó gotas por **resonancia** con el electrodo vibrando: 60 Hz, 0.315 mm, a **33 A** [8, 9]. En 2023 midió **el tamaño de la gota en línea por la frecuencia de su oscilación en el voltaje del arco** [10]. Hirata (2006) predijo con simulación que la corriente pulsada a la frecuencia natural suelta la gota [11].
- **Lo que no encontré publicado** es el paquete de ustedes:
  - el «oído» en lazo cerrado: lock-in tras golpecitos, más un chirp que adelanta el disparo según el ritmo de crecimiento;
  - la medición a dos corrientes base para separar el tamaño de β;
  - la excitación resonante **por corriente** de varios ciclos, medida en experimento (no solo simulada);
  - apuntar con el modo l=1 usando un campo B temporizado;
  - todo esto con alambre **autoprotegido (FCAW-S) en DCEN**, con un buck de 48 V y gota a gota.

  Veredicto: **INCIERTO tirando a nuevo como combinación**. Las piezas sueltas tienen antecedente cercano, así que la novedad patentable sería angosta.
- **Productos comerciales que controlan la gota:**

  | Producto | Cómo controla la gota | Precio |
  |---|---|---|
  | CMT de Fronius [15] | Retrae el alambre hasta 130–170 Hz | USD 23 768 de lista (paquete TPS 320i C CMT) [16] |
  | STT de Lincoln [17] | Detecta el cuello por dV/dt y baja la corriente | USD 10 500–12 400 la S350 base, sin el módulo STT [18] |
  | RMD de Miller [19] | Controla la forma de onda en corto | Sin precio encontrado |
  | coldArc de EWM [20] | Igual que RMD | Sin precio encontrado |

  Ninguno usa la resonancia de la gota. Drop-on-demand de metal sí existe, pero sin arco:
  - MHD de Vader/Xerox ElemX: aluminio, 50–550 µm, 40–1000 Hz [24, 25].
  - Neumático de Bremen: acero a 1600 °C, 300–1350 µm [26].
- **El riesgo n.º 1 de seguridad es el HUMO CON MANGANESO, no la electricidad.**
  - Escenario central del script: 1 % de humo y 5 % de Mn a 3 m/min dan **317 mg/h de Mn**.
  - Diluirlo hasta el TLV de ACGIH (0.02 mg/m³) pide **15 800 m³/h**; hasta la NOM-010 (0.2 mg/m³), **1 600 m³/h**. En el mejor escenario siguen siendo 3 200 m³/h para ACGIH.
  - En un cuarto de 22.5 m³ con 2 renovaciones/h quedan **7 mg/m³ (350× ACGIH)**. Con solo **5 min de arco al día** el promedio de 8 h ya es **3.7× ACGIH**.
  - Por eso hace falta una **caja cerrada con extracción al exterior**, de ≥98–99.7 % de captura. Una campana abierta no alcanza.
- **48 V DC es un voltaje bajo (<60 V de ES1/SELV en seco)**. Calculé 18–56 mA por el cuerpo; normalmente no mata.
  - La LRS-1200-48 **solo acepta 180–305 V de AC** [48]. En México eso es un contacto de 220 V de **2 fases vivas**, así que el PARO tiene que abrir **los dos polos**.
  - La OVP de la LRS dispara a **57–67 V** y el drenaje del MOSFET ve picos de 78–96 V (simulación de La Pluma). Por eso todo el lado de potencia va **tapado**.
- **UV:** la corriente pico del campanazo es de 70 A. Eso pide sombra **10 mínima y 11 sugerida** (AWS F2.2) [44]. A 0.5 m del arco basta con **0.2–5.9 s/día** sin protección para pasarse del límite [45]. Los humos y el UV de soldadura son cancerígenos del **Grupo 1 de IARC** [41].

## 3. El método

- **Búsqueda web** (patentes en Google Patents, ScienceDirect, Welding Journal, repositorios de las universidades, fichas de datos y normas). ScienceDirect y ResearchGate devolvieron 403. Por eso los papers de Harbin y los de Kentucky los leí **por su resumen oficial** en las páginas de Harbin y la UKy, más el texto completo de las patentes. **No leí** el texto completo de [8–10].
- **Aritmética de ventilación** (script, §2–§6 del `.out`). Todo sale de balances de masa con supuestos declarados:
  - fracción de humo (FFR) de 0.5–3 % de la masa del alambre: FCAW-S es el proceso que más humo emite por kg [40];
  - Mn en el humo de 2–10 %: el humo de alambre autoprotegido trae 1.75 % y el de otros FCAW 9.1 % [39];
  - F en el humo de 5–15 %: el alambre trae CaF₂ <6 % [38];
  - campana con la fórmula de Dalla Valle Q = V(10X²+A), ×0.75 con brida (ACGIH Industrial Ventilation, **de memoria**);
  - velocidad de captura para soldadura de 0.5–1.0 m/s [43] (OSHA pide 100 fpm = 0.5 m/s [42]).
- **Eléctrica:** la impedancia del cuerpo de ~1 kΩ (mojado) y ~2.6 kΩ (seco) viene de la IEC 60479-1, **de memoria y sin verificar**. Los datos de la LRS salen de su hoja [48].
- **Lente del operador:** separé «probado por otros» (con fuente) de «aporte nuestro». Un aporte cuenta solo si (a) no aparece en la búsqueda y (b) cambia una medición. Vale «acuerdo o silencio»: donde no leí el texto completo, el veredicto es INCIERTO.

## 4. Resultados

### 4.1 Estado del arte: qué hace cada uno y cómo controla la gota

| # | Quién / qué | Cómo controla la gota | Hardware | Costo | Cercanía a lo nuestro |
|---|---|---|---|---|---|
| A | **Kentucky (Y.M. Zhang, L. E, Kovacevic), 1997–2002**: «active metal transfer control» [1–4] | Pico (220–250 A, ~12 ms) para crecer la gota → baja a la base (40–50 A) para **excitar la oscilación** → sube **en fase** con el movimiento hacia abajo → suelta 1 gota/pulso **por debajo** de la corriente de transición (~350 A). Elige el instante con cámara a 800–3000 fps **o con el voltaje del arco** [2]. Lazo adaptativo con 33 Hz de transferencia constante. Gota/alambre 0.8–1.4 | Miller Maxtron 450, alambre de 1.2 mm, Ar/5 % CO₂ | Inversor industrial | **Muy alta**: es el «soltar en fase con el empujón» del canon, con un solo escalón |
| B | **Kentucky/Shandong 2004–2014**: modelos masa-resorte y forma de onda «enhanced» [5–7] | Optimiza la duración del pico excitador, el retardo de fase excitador y el de desprendimiento. Masa-resorte con k y amortiguamiento **calibrados en experimento** | Igual que A | — | Alta: es el gemelo digital de la oscilación |
| C | **Harbin (X. Zhang, H. Gao, G. Zhang), 2020–2021**: «current-independent metal transfer by droplet resonance» [8, 9] | **Electrodo vibrando** (mecánico) a 60 Hz con 0.315 mm de amplitud. La gota crece, su f natural baja hasta la de la excitación y **resuena** → se suelta por inercia, a **32.5–33 A** | Fuente CV, ER70S-6, mezcla rica en Ar | Vibrador del electrodo (no publicado) | **Muy alta** en el principio («la gota crece hacia la resonancia»). Distinto actuador: mecánico, no corriente |
| D | **Harbin 2023**: «online measurement of droplet size by actively exciting droplet oscillation in GMAW and **GMAW-AM**» [10] | Excita la oscilación libre y lee el **voltaje** (baja cuando la gota sube, sube cuando baja). Un **análisis en frecuencia** da el tamaño | Bajo costo: el voltaje que ya mide la fuente | — | **Es el «oído»** en su forma básica (FFT, sin lock-in ni chirp ni dos bases, por lo que dice el resumen) |
| E | **Hirata y otros (Osaka/Delft), 2006** [11]; **Delft 2003–2004** [12] | Simulación VOF: la **corriente pulsada a la frecuencia natural** puede soltar la gota (numérico). Delft monitorea la oscilación de la gota colgada en GMAW pulsado | Simulación + banco | — | Alta. **Advertencia de Delft:** en gotas grandes, la f que se lee en el voltaje sale **más alta** que la del video, porque el arco cambia y V deja de ser proporcional al largo |
| F | **Wu y Kovacevic (SMU), 2002** [13] | Alimentador que **oscila el alambre** con un paso a paso (hasta 150 Hz y 65 g). Lo mejor fue a 85 Hz: spray proyectado a menor corriente | Alambre de 1.2 mm ER70S-6, Ar/CO₂ | Alimentador + paso a paso | Media: el alimentador de la SOMI podría hacer esto |
| G | **Fronius CMT** [15] | Detecta el corto → **retrae el alambre** (hasta 130–170 Hz) con corriente baja. Hay un modo «Cycle Step» para **puntos gota a gota** [29] | TPS/i + antorcha push-pull + regulador | **USD 23 768** de lista [16] | Media: controla la gota mecánicamente; el punto gota a gota ya existe (con gas) |
| H | **Lincoln STT** [17] | Corto controlado: detecta el cuello por **dV/dt** («dV/dt detect»), corta la corriente antes de que reviente y luego da el pico de reencendido. Patente de umbral adaptativo con meta de reencendido de ~50 µs [17] | Power Wave S350 + módulo STT | **USD 10 500–12 400** la base [18] | Alta en el **sensado**: es la detección de cuello de La Pluma |
| I | **Miller RMD** [19], **EWM coldArc** [20] | Forma de onda programada por fases del corto; DSP que vigila el cuello en µs | Fuente inversora | Sin precio | Media |
| J | **GMAW pulsado de una gota por pulso (ODPP)**, patentes de dV/dt [21, 22]; simulación de Hu y Tsai [51] | Pulso por encima de la transición; detecta el desprendimiento por el cambio de signo de dV/dt [21] o por el pico de la derivada [22] | Todas las fuentes pulsadas | — | Alta en sensado |
| K | **Láser que dirige la gota**: Chen, Jia, Xiao y Huang (BJUT), 2020 [14] | El retroceso del láser **empuja la gota hacia donde se quiere** | 2 láseres | Alto | **Es el «apuntar»** con otro actuador |
| L | **Campos B externos en GMAW/WAAM** [32] | Campo transversal o axial continuo: desvía el arco, cambia la tasa de gotas. A 24 mT pasa de corto a meso-spray | Bobinas | Bajo | Media: nadie lo **temporiza al modo l=1** (no encontrado) |
| M | **WAAM gota a gota (dot-by-dot)**: MX3D / U. Bologna [29] | Puntos sucesivos que forman barras de celosía, alambre de 1 mm ER308LSi, con gas | Robot + CMT | Industrial | Alta en la **aplicación** («imprimir con gotas») |
| N | **WAAM sin gas con FCAW-S**: proyecto HES de la Marina de EE.UU., AWS 2024 [30] | Evalúa alambres autoprotegidos para WAAM a bordo; usa **limpieza de escoria entre capas con husillo** | Robot híbrido | Industrial | Alta en **material** (sin gas) |
| O | **Drop-on-demand MHD de Vader/Xerox ElemX** [24, 25] | Una bobina pulsada induce corriente en Al líquido; la fuerza de Lorentz expulsa la gota. 50–550 µm, 40–1000 Hz (ráfagas de 5000), 1–10 m/s, crisol a 850–950 °C con Ar | Impresora de ~2.7 m, en 2023 pasó a ADDiTEC | Precio no publicado | Media: es gota por demanda con campo, pero **sin arco y solo Al** |
| P | **Drop-on-demand neumático** de Bremen (Imani Moqadam y otros, 2019) [26] | Pulso de gas sobre crisol de alúmina; **acero AISI 52100 a 1600 °C**, gotas de 300–1350 µm | Horno de crisol | Laboratorio | Baja |
| Q | **Impresora de metal open-source con MIG** (Pearce, Michigan Tech, 2013) [27]; **monitor V-I open-source** [28] | No controla la gota: MIG comercial (Millermatic 140/190) en una delta RepRap. Monitor con Arduino de **< USD 100** | MIG comercial | **< USD 1 200** con la soldadora | Media: es el antecedente open-source. **Nadie ahí controla la forma de onda** |
| R | **Toque y distancia por la línea**: touch sensing / TAST de los robots [33]; **medición de CTWD** de Fronius Additive [33] | El voltaje cae al tocar → contacto. El arco con oscilación lateral → seguimiento de la junta. Fronius mide la distancia boquilla-pieza por la línea | En las fuentes y robots comerciales | — | **Alta**: el «sensado sin sensores» de contacto y distancia ya existe |
| S | **Oscilación del charco para sensar la penetración** (Xiao y den Ouden, años 90) [34] | Golpes de corriente → FFT del voltaje → la f del charco da la penetración. **En GMAW lo estorban las gotas** que caen [34] | GTA | — | Antecedente del «oído», y **advertencia**: el charco también suena en el voltaje |

**Comportamiento de FCAW-S.** El estudio de polaridad (J. Manuf. Process. 58 (2020) 478–488, visto solo por su resumen, sin URL verificada) dice que en **DCEN** la fuerza electromagnética **ayuda** a soltar la gota y la transferencia se acerca al spray; en DCEP la gota es repelida. Liu y otros (2008) [31] reportan en alambre autoprotegido **transferencia en puente sin interrumpir el arco**: la columna de fundente toca el charco. Eso importa para el «oído».

### 4.2 Lo nuestro contra lo publicado

| Pieza del diseño | ¿Publicado? | Por quién | Veredicto «nadie lo ha hecho» |
|---|---|---|---|
| Soltar la gota excitando su oscilación con la **corriente** y disparar en fase | Sí, 1997–2014 | Kentucky [1–6] | **FALSA** |
| Desprendimiento por **resonancia** (la gota crece hacia la f de excitación) | Sí, con actuador **mecánico** (2020–21); con corriente, **solo simulado** (2006) | Harbin [8, 9]; Hirata [11] | **FALSA** en el principio. **INCIERTA** la versión experimental por corriente con 5–7 ciclos a f₂ |
| Tamaño de gota por la **f en el voltaje** del arco | Sí (2023, también para GMAW-AM) | Harbin [10]; Delft [12] | **FALSA** |
| «Oído» en lazo cerrado: lock-in tras golpecitos de 10 A, **chirp** que adelanta el disparo según el ritmo de crecimiento | No encontrado | — | **INCIERTA → posible aporte**. Hay que leer el texto completo de [10] |
| Medir a **dos corrientes base** para separar el tamaño de β (rigidez magnética) | No encontrado | — | **PASA (no encontrado)**. Es un aporte de medición, no de máquina |
| **Apuntar** la gota (modo l=1) con B transversal temporizado | No encontrado. Hay láser [14] y B continuo [32] | — | **INCIERTA → posible aporte**. El arc blow no está modelado |
| Detección del **cuello** por R o dV/dt y crowbar | Sí, desde los 80–90 | STT [17], [21] | **FALSA** |
| Contacto y distancia **sin sensores** | Sí | Touch sense, TAST, CTWD de Fronius [33] | **FALSA**. La temperatura del stickout por R queda **INCIERTA** |
| Fuente **buck de 48 V barata** con forma de onda programable, open-source | No encontrado (Pearce usa MIG comercial + monitor [27, 28]) | — | **PASA (no encontrado)**. Es aporte de costo y apertura, **no** invento: un buck es de libro |
| Imprimir **gota a gota** | Sí, con gas (CMT y dot-by-dot) [29]; DoD sin arco [24, 26] | MX3D, Fronius, Vader | **FALSA** en general |
| Gota a gota con **FCAW-S en DCEN, sin gas** | WAAM con FCAW-S sí [30]; gota a gota con FCAW-S no encontrado | — | **PASA (no encontrado)** |
| Campos y transferencia **calculados** (gemelo digital) | Sí: masa-resorte [5–7], VOF [11], Hu y Tsai [51] | — | **FALSA**. Lo nuestro es ponerlo en vivo en el CAD, que no es patentable |

**Lente del operador:**
- **Probado por otros:**
  - el canal l=2 o axial **existe y se excita con la corriente**;
  - la f baja con el tamaño;
  - el voltaje la escucha;
  - soltar en fase baja la corriente necesaria.
- **Aporte posible:**
  - el **disparo predictivo** (fase más ritmo de crecimiento);
  - la **separación tamaño/β**;
  - el **canal l=1 con B**;
  - la **combinación FCAW-S/DCEN/48 V**.

  El marco (postulado de canal) acertó en que cada modo necesita su actuador; la literatura lo confirma de lado (Harbin le da a l=2 un actuador mecánico propio).

**Advertencia de física que trae la literatura:**
- Kentucky, Harbin y Wu usan un **rebote axial masa-resorte de la gota colgada**, con f de decenas a ~200 Hz para gotas de alambre de 1.2 mm. El canon usa el **l=2 de Rayleigh de gota libre** (668 Hz a a = 0.46 mm).
- Según el `.out` §9, Rayleigh pondría la resonancia de Harbin a 60 Hz en una gota de **4.6 mm** de diámetro. Eso es posible a 33 A (globular), pero no está probado que sea el mismo modo.
- **No sé cuál de los dos modos ve el voltaje en una gota apenas más gorda que el alambre (a/r_w ≈ 1.15). Veredicto: INCIERTO.** Lo decide el barrido del §7.

### 4.3 Patentes con riesgo evidente (solo señalarlo: **no es asesoría legal**; las patentes son territoriales y en México hay que buscar en IMPI)

| Patente | Dueño | Qué cubre | Estado (Google Patents, no es dictamen) | Riesgo para nosotros |
|---|---|---|---|---|
| US6013896 [1] | Univ. Kentucky RF | Crecer → bajar para oscilar → subir para soltar | **Expirada** (2004, falta de pago) | Ninguno: es arte previo libre. Además **nos protege**: nadie puede patentar ya ese núcleo |
| US6008470 [2] | Zhang y E | Lo mismo + **voltaje del arco** para el instante + lazo adaptativo | **Expirada** (anticipada a 2018) | Ninguno; arte previo libre |
| US6025573 [21] | Lincoln | Desprendimiento por cambio de signo de dV/dt en el pulso | **Expirada** (2018) | Ninguno |
| US9616514 [22] | Lincoln | Pico de la derivada (dV/dt, dR/dt, dP/dt) para detectar el desprendimiento en spray o pulsado **con gas**; usa la duración para ajustar el ciclo siguiente | **Activa** hasta ~2033 | **Medio-bajo.** Si el firmware detecta el desprendimiento por el pico de dV/dt **y** usa esa duración para corregir el pulso siguiente, se parece. Lo nuestro es sin gas y cabe evitar esa combinación exacta. Revisar las reivindicaciones si se vende |
| US 2013/0264323 / WO2013150366 [17] | Lincoln | Umbral **adaptativo** de detección del cuello (dv/dt, ohms, V) según el tiempo de reencendido | Estado **sin verificar** | Medio si el firmware adapta el umbral de los +8 mΩ según el reencendido. Revisar |
| US10974337 [23] | ITW (Miller) | AM con gotas + oscilación **mecánica** (motor, leva y pistón) de la herramienta | **Activa** hasta ~2037 | Bajo mientras no se oscile la antorcha con leva. Si el alimentador de la SOMI oscila o retrae el alambre, revisar |
| Familia CMT | Fronius | Retracción del alambre sincronizada con el corto | Sin verificar (la familia es de ~2004–06) | Solo si se retrae alambre |
| US9593403, US10639718 [24] | Vader/Xerox | Expulsión MHD desde un crisol | Activas | No aplica (sin arco) |
| Harbin (resonancia, tamaño por voltaje) | — | Posibles patentes CN | **No encontradas** | Desconocido; en CN no obligan en México salvo que se hayan extendido |

**Lectura práctica:** el núcleo (excitar con la corriente, soltar en fase, oír por el voltaje) es **de dominio público** por las patentes expiradas de Kentucky y Lincoln de 1998. Eso es bueno para construir y malo para patentar: lo patentable sería angosto (el chirp predictivo, la separación tamaño/β, el apuntado l=1 temporizado).

### 4.4 Seguridad: límites y números

**Límites de exposición:**

| Agente | ACGIH TLV | OSHA PEL | NIOSH REL | NOM-010-STPS-2014 |
|---|---|---|---|---|
| Mn y compuestos inorgánicos (como Mn) | **0.02 mg/m³ respirable**, 0.1 inhalable [35] | 5 mg/m³ **techo** [35] | 1 mg/m³ TWA, 3 mg/m³ STEL [35] | **0.2 mg/m³** VLE-PPT [36] |
| Fluoruros (como F) | 2.5 mg/m³ [37] | 2.5 mg/m³ [37] | 2.5 mg/m³ | Sin verificar en la tabla (probablemente 2.5) |
| Humo de soldadura y UV de soldadura | — | — | — | **IARC Grupo 1** (cancerígeno), 2017 [41] |

- Nivel de acción de la NOM: la mitad del VLE, o sea **0.1 mg/m³ de Mn**.
- La hoja de seguridad de Forney E71T-GS (rev. 2025) [38] lista CaF₂ < 6 %, Mn en el depósito ~1.75 % y Al ~1.8 % (columna de la tabla E71T-11/GS). Todavía dice «IARC 2B», que **está desactualizado**.
- La de **Truper 13750 no la encontré**. Hay que pedirla (NOM-018-STPS-2015). «GS» no fija la química: solo el fabricante sabe la composición [50]. En particular, falta confirmar si trae **bario**: TWI advierte de bario soluble en algunos autoprotegidos [40].

**Cuánto humo sale (`.out` §1–§4).**

Base: alambre de 0.8 mm a 3 m/min, que funde **0.176 g/s = 0.63 kg/h** con el arco encendido. Las 75 gotas/s del canon (29 mm³/s) cuadran con los 25 mm³/s de alambre.

| Escenario | Humo | Mn | Q de dilución para ACGIH 0.02 | Para NOM 0.2 |
|---|---|---|---|---|
| Optimista (0.5 % humo, 2 % Mn) | 0.88 mg/s | 63 mg/h | **3 170 m³/h** | 317 m³/h |
| Central (1 %, 5 %) | 1.76 mg/s (6.3 g/h) | 317 mg/h | **15 800 m³/h** | 1 580 m³/h |
| Pesimista (3 %, 10 %) | 5.28 mg/s | 1 900 mg/h | **95 000 m³/h** | 9 500 m³/h |

Fluoruros: con 1 % de humo y 10 % de F salen 633 mg/h, que piden 253 m³/h para quedar en 2.5 mg/m³. **El Mn manda**, no el F.

**Cuarto de 22.5 m³ sin captura (escenario central).** τ es el tiempo que tarda el humo en irse.

| Renovaciones/h | Q (m³/h) | C de Mn estacionaria | × ACGIH | × NOM | τ |
|---|---|---|---|---|---|
| 0.5 (cerrado) | 11 | 28 mg/m³ | 1 407 | 141 | 120 min |
| 2 | 45 | 7.0 mg/m³ | 352 | 35 | 30 min |
| 20 (ventilador de ventana) | 450 | 0.70 mg/m³ | 35 | 3.5 | 3 min |

Promedio de 8 h con 2 renovaciones/h: 5 min de arco al día dan **3.7×** ACGIH; 30 min, **22×**. Esto vale aunque el arco sea corto, porque la exposición integrada es M/Q si uno se queda en el cuarto.

**Captura necesaria:**
- Cuarto con 45 m³/h: ACGIH pide **η ≥ 99.7 %** y la NOM ≥ 97.2 %.
- Con 300 m³/h: ACGIH pide **≥ 98.1 %** y la NOM ≥ 81 %.

Una campana abierta típica no garantiza 98 %. **Conclusión: CAJA CERRADA con extracción al exterior.** Y respirador mientras se valida.

**Campana contra caja (`.out` §5–§6):**
- Una campana redonda de Ø100 mm a 0.5 m/s pide 59 m³/h a 5 cm del arco, 194 m³/h a 10 cm y **734 m³/h a 20 cm**. El caudal crece con X²: si la campana se aleja, se pierde.
- Una **caja de 60×40×40 cm** con 100–150 cm² de entradas a ≥1 m/s se resuelve con **36–54 m³/h**. Con un ventilador de **150 m³/h**:
  - la caja se recambia cada ~2.3 s;
  - el aire de salida se calienta solo **+16 K** con 800 W de arco;
  - un ducto de **Ø75 mm** lleva 9.4 m/s (≈ los 10 m/s que se suelen pedir para humo de soldadura); uno de Ø100 mm, 5.3 m/s.
- Además, la caja ES la cortina UV y el corralito de chispas.

**UV y ojos:**
- Con 40 A de base + 30 A de onda, el pico de 70 A cae en la fila **60–160 A**: sombra mínima **10**, sugerida **11**. Por debajo de 60 A el mínimo es 7 (sugerido 10) [44].
- Tiempo permitido sin protección [45], escalado con 1/r²: **0.2–5.9 s/día a 0.5 m**, 0.9–24 s a 1 m, 8–212 s a 3 m. Cualquiera que pase por el cuarto se quema los ojos («ojo de soldador») si el arco no está encerrado.

**Eléctrico (`.out` §7) [47, 48]:**
- El límite SELV es 120 V DC sin rizo [47], y el umbral de toque en seco es **60 V DC** (ES1 de IEC 62368) [47]. La salida de la LRS va de 48 a 56 V: está debajo.
- Corriente por el cuerpo: **18–21 mA en seco** y **48–56 mA con la mano mojada**. Duele y puede hacer soltar mal o caer, pero normalmente no mata. Impedancias de memoria.
- Lo que **sí** pasa de 60 V:
  - la OVP de la LRS, que dispara a 57–67 V;
  - los picos de V_ds del MOSFET, de 78–96 V en simulación;
  - **la entrada de 220 V AC**.
- Energía guardada:
  - capacitores: 1.6–15.7 J con 1–10 mF a 56 V (chispa y quemadura en los dedos);
  - choque de 41 µH: 33–100 mJ (despreciable).
- La LRS **limita a 37.5 A (150 %) y se apaga a los 5 s**; hay que re-encenderla para recuperarla [48]. Un corto sostenido no la quema, pero sí un cable delgado.
- Su control remoto **RC+/RC− con 3.3–10 V = APAGADA** [48] sirve de segundo canal del PARO.

**Incendio y quemaduras:**
- Hay que quitar lo combustible a **11 m (35 ft)** o protegerlo (OSHA 1910.252 / NFPA 51B, de memoria) [42].
- **Extintor ABC a ≤ 7 m** (NOM-027-STPS-2008) [46].
- **Vigilancia ≥ 30 min** después del último arco (OSHA 1910.252) [42].
- La placa de 100×50×3 mm llega a cientos de °C.
- El PLA se ablanda a ~55–60 °C: nada de PLA dentro de la caja ni en la Torre sobre la LRS caliente (mejor PETG o ASA).

## 5. Veredictos por hipótesis

| # | Hipótesis | Veredicto | Qué lo decide |
|---|---|---|---|
| H1 | «Nadie ha soltado gotas excitando su oscilación con la corriente» | **FALSA** [1–6] | — (patentes expiradas, publicado) |
| H2 | «Nadie ha soltado gotas por resonancia» | **FALSA** (mecánico [8, 9]). Por corriente con varios ciclos: **INCIERTA** (solo simulado [11]) | Leer el texto completo de [8–10]; buscar en CNKI «熔滴 共振 脉冲电流» |
| H3 | «Nadie mide el tamaño de la gota por el voltaje» | **FALSA** [10, 12] | — |
| H4 | «El oído con lock-in + chirp predictivo es nuevo» | **INCIERTA** | El texto completo de [10]: si ellos ya predicen el instante de disparo con el ritmo de crecimiento, cae a FALSA |
| H5 | «Separar tamaño de β con dos corrientes base es nuevo» | **PASA** (no encontrado) | Búsqueda en Scopus/CNKI. Y el banco: si a 30 y 50 A de base la f cambia ~2 % a tamaño fijo, como dice el canon, tiene valor |
| H6 | «Apuntar con B temporizado al modo l=1 es nuevo» | **INCIERTA** | Que funcione sin arc blow (lo cubre otro agente). Arte previo cercano: el láser [14] |
| H7 | «Sensar contacto, distancia y temperatura sin sensores es nuevo» | **FALSA** para contacto y distancia [33]. **INCIERTA** para la temperatura del stickout por R | — |
| H8 | «Una fuente open-source de 48 V con forma de onda para arco no existe» | **PASA** (no encontrado). Novedad de costo, no de invento | — |
| H9 | «Gota a gota con FCAW-S sin gas no existe» | **PASA** (no encontrado; FCAW-S WAAM sí existe [30]) | — |
| H10 | «El voltaje oye la gota y no el charco o la columna de fundente» | **INCIERTA**: Delft [12] y den Ouden [34] advierten interferencias; FCAW-S hace puente [31] | El experimento del §7, E1 |
| H11 | «Imprimir en interiores es seguro con una campana o ventilador» | **FALSA** (§4.4: hacen falta ≥98–99.7 % de captura) | E2 (prueba de humo de la caja) |
| H12 | «48 V DC no electrocuta» | **PASA con condiciones** (≤56 V; 18–56 mA). Las condiciones: lado AC de 2 polos tapado, nodo de conmutación tapado y relés con capacidad DC | — |

## 6. Qué cambia en el banco, el circuito, el firmware y la lista de componentes

- **Agrega una CAJA DE ARCO:**
  - lámina de acero negro o aluminio, **no galvanizada** (el zinc caliente da fiebre de humos metálicos), de ~60×40×40 cm sobre la loseta;
  - ventana de **vidrio sombra 11** (el de la careta, 50.8×108 mm) para el Ojo/celular;
  - entradas de aire abajo de 100–150 cm² en total;
  - salida arriba con **malla apagachispas** → **ventilador metálico ≥150 m³/h** → ducto de **Ø75–100 mm al exterior**.

  No recircular. Si no hay salida, HEPA H13 + carbón, sabiendo que el HF gaseoso pasa.
- **El PARO, en hardware y de 3 canales (estilo IEC 60204-1 categoría 0 / ISO 13850, de memoria):**
  1. Hongo NC con enclave → **contactor de 2 polos ≥16 A en la entrada de 220 V** (México: las dos líneas están vivas). La LRS consume 6–7 A y arranca con 60 A.
  2. El mismo hongo, en un segundo contacto, pone **3.3–10 V en RC+/RC−** de la LRS y lleva a alto el **SD del IR2110**.
  3. El Pico pierde el watchdog → duty 0.

  Además: el PARO **también para el motor del alimentador**. Y si algún relé corta DC, debe tener **capacidad DC ≥ 60 V / 40 A**: un relé de «30 A 250 VAC» corta unos ~30 V DC.
- **Agrega** en el bus de 48 V un **fusible DC de 40 A tipo MIDI/ANL (≥58 V DC)** pegado a la LRS, cable cal 10 y terminales crimpadas.
- **La Torre** (la caja impresa sobre la LRS) va en **PETG o ASA**, no PLA, con las ventilas de la LRS libres. La Garra y el Ojo, si son de PLA, **fuera** de la caja de arco o detrás de lámina.
- **El firmware hace:**
  - tiempo máximo de arco por disparo y por sesión;
  - corte si hay arco sin avance de alambre (más de N ms) o si R queda baja sostenida (pegado);
  - log de V e I crudos a archivo en cada sesión (telemetría);
  - buzzer/LED de «ARCO VIVO» y de «CAJA SIN EXTRACCIÓN»: el arco no arranca si el ventilador no gira (un tacómetro o la corriente del ventilador como permiso).
- **Pide a Truper** la HDS del 13750 (NOM-018-STPS-2015): Mn, fluoruros, bario.
- **Si se vende:** antes de usar «pico de dV/dt para ajustar el ciclo siguiente» o «umbral de cuello adaptativo», que un abogado de patentes revise US9616514 y US 2013/0264323 en IMPI. El núcleo de Kentucky es libre.

### 6.1 LISTA DE VERIFICACIÓN del banco de ian (antes de cada sesión)

**Instalación (una vez)**
- [ ] Contacto de **220 V** dedicado con pastilla de 15–20 A; la LRS no arranca con 127 V. Tierra física al FG de la LRS.
- [ ] Contactor de **2 polos** en la entrada AC, mandado por el hongo de PARO (NC, con enclave, rojo sobre amarillo, a la mano y a la vista).
- [ ] Segundo canal del PARO → RC+/RC− de la LRS + SD del IR2110. Tercer canal: watchdog del Pico.
- [ ] El PARO también corta el motor del alimentador.
- [ ] Fusible DC de 40 A (≥58 V DC) en el bus; cable cal 10; nada atornillado flojo; lado de potencia y capacitores **tapados**.
- [ ] Caja de arco cerrada (no galvanizada) + apagachispas + ventilador ≥150 m³/h + ducto al **exterior**.
- [ ] **Prueba de humo**: incienso dentro, ventilador encendido → 0 humo fuera. Velocidad en las entradas **≥1 m/s** con un anemómetro de USD 15–25.
- [ ] Extintor **ABC a ≤7 m**. Recipiente metálico para escoria y puntas de alambre.
- [ ] Nada combustible en el radio del banco: papel, cartón, filamento, trapos con solvente. **Ningún solvente clorado** cerca (el UV los vuelve fosgeno).
- [ ] HDS de Truper 13750 archivada.

**Cada sesión**
- [ ] Ventilador encendido **antes** del primer arco (permiso en firmware).
- [ ] Careta o vidrio **sombra 10 mínimo (11 sugerido)**; lentes de seguridad debajo; ropa de algodón o mezclilla de manga larga; guantes de soldador secos; zapato cerrado.
- [ ] Respirador de media cara **P100/P3** mientras la caja no esté validada y al abrirla caliente.
- [ ] Nadie más en el cuarto sin careta (niños, mascotas); la caja cerrada mientras haya arco.
- [ ] Probar el PARO: al presionarlo, I → 0 en <1 ms y la salida de la LRS baja (anotar cuánto tarda en llegar a <5 V).
- [ ] Polaridad (DCEN para E71T-GS) anotada en la bitácora.
- [ ] Placa con **pinzas**; letrero «CALIENTE».

**Al terminar**
- [ ] Ventilador encendido ≥ τ_caja·5 (segundos) y luego hasta que no haya olor.
- [ ] **Vigilancia de 30 min** (mejor 60) de la caja, el ducto y el piso, buscando brasas.
- [ ] Desconectar el 220 V; esperar a que los capacitores bajen de 5 V antes de meter las manos.
- [ ] Guardar el log de V/I de la sesión.

## 7. El experimento más barato que lo decide

**E1 · ¿El voltaje oye la gota, el charco o la columna de fundente?** Decide H4 y H10, que es donde está el aporte. No hace falta hardware nuevo, solo el banco con caja y extracción.

1. **Arco a 40 A sobre la placa con el alambre PARADO, 1–2 s** (solo charco). Golpecitos de 10 A cada 20 ms; ADC a 500 kS/s; espectro del voltaje en ventanas de 10–20 ms.
2. **Lo mismo con el alambre avanzando a 3 m/min.**
3. **Barrido de excitación de 200 a 1200 Hz** a 30 A AC, para saber qué modo responde.

**Predicción si el oído funciona como en el canon y en [10]:**
- en (2) aparece un pico que **baja con el tiempo** dentro de cada ciclo de gota; para gotas de a = 0.30 → 0.46 mm, eso es de **~1270 a ~670 Hz** si es el l=2 libre;
- ese pico **no está** en (1);
- en (3) la respuesta máxima cae cerca de f₂ del tamaño en el que se suelta.

**Predicción si es falso:**
- picos **fijos** en 100–400 Hz que están igual en (1), por el charco (un charco de 1 mm de radio daría ~200 Hz según el `.out` §9);
- o un espectro sin estructura por la columna de fundente o el puente [31];
- o el pico a **~0.3–0.6 × f₂**, si lo que se oye es el rebote axial de gota colgada de la literatura. En ese caso hay que recalibrar el canon, no tirarlo.

**E2 · La caja contiene el humo** (decide H11). Incienso dentro, ventilador de 150 m³/h, entradas de 100 cm².
- **Si es cierto:** v = 150/3600/0.01 = **4.2 m/s** en las entradas y 0 humo visible fuera.
- **Si hay fugas:** v < 1 m/s en alguna entrada o humo por las juntas → sellar antes del primer arco.

Costo: incienso y un anemómetro de USD 15–25.

## 8. Fuentes

1. US6013896A, Zhang, E, Kovacevic (Univ. Kentucky RF), «Method of gas metal arc welding», 1998, expirada — https://patents.google.com/patent/US6013896A/en
2. US6008470A, Zhang y E, «Method and system for gas metal arc welding», 1998, expirada — https://patents.google.com/patent/US6008470A/en ; también https://uknowledge.uky.edu/ece_patents/13
3. Zhang, E, Kovacevic, «Active metal transfer control by monitoring excited droplet oscillation», Welding J. 77(9) 388-s, 1998 — https://scholars.uky.edu/en/publications/active-metal-transfer-control-by-monitoring-excited-droplet-oscil/
4. Zhang, E, Walcott, «Robust control of pulsed gas metal arc welding», J. Dyn. Sys. Meas. Control 124(2) 281–289, 2002, doi 10.1115/1.1470173 — https://scholars.uky.edu/en/publications/robust-control-of-pulsed-gas-metal-arc-welding/
5. Xiao, G.J. Zhang, W.J. Zhang, Y.M. Zhang, «Active metal transfer control by utilizing enhanced droplet oscillation, part II», Welding J. 93(9) 321s–330s, 2014 — https://scholars.uky.edu/en/publications/active-metal-transfer-control-by-utilizing-enhanced-droplet-oscil/
6. Chen, Wu, Li, Zhang, «Analysis of active control of metal transfer in modified pulsed GMAW», STWJ 12(1) 10–14, 2007 — https://scholars.uky.edu/en/publications/analysis-of-active-control-of-metal-transfer-in-modified-pulsed-g/
7. Wu, Chen, Li, «Analysis of excited droplet oscillation and detachment in active control of metal transfer», Comput. Mater. Sci. 31(1) 147–154, 2004 — https://vufind.lboro.ac.uk/PrimoRecord/cdi_proquest_miscellaneous_28287285
8. X. Zhang, H. Gao, G. Zhang, «Current-independent metal transfer by utilizing droplet resonance in GMAW», J. Mater. Process. Technol. 279, 116571, 2020 — https://hit.globalimpact.cn/en/publications/current-independent-metal-transfer-by-utilizing-droplet-resonance/ ; números (33 A, 60 Hz, 0.315 mm): resumen AWS 2021 https://www.programmaster.org/PM/PM.nsf/ApprovedAbstracts/A25BEFB4AFD20DC7852586D5002E5E51 ; https://advanceseng.com/current-independent-metal-transfer-utilizing-droplet-resonance-gas-metal-arc-welding/
9. X. Zhang, H. Gao, Z. Li, «Forces analysis of droplets and accurate control of metal transfer in GMAW by utilizing droplet resonance», J. Manuf. Process. 70, 121–131, 2021 — https://hit.globalimpact.cn/en/publications/forces-analysis-of-droplets-and-accurate-control-of-metal-transfe/
10. X. Zhang, Z. Li, H. Gao, «Online measurement of droplet size by actively exciting droplet oscillation in GMAW and GMAW-AM», J. Manuf. Process. 85, 1144–1153, 2023, doi 10.1016/j.jmapro.2022.12.040 — https://hit.globalimpact.cn/en/publications/online-measurement-of-droplet-size-by-actively-exciting-droplet-o/
11. Hirata, Tsujimura, Yudodibroto, Hermans, Richardson, «Modeling of molten drop oscillation in gas shielded metal arc welding», Thermec 2006 — https://research.tudelft.nl/en/publications/modeling-of-molten-drop-oscillation-in-gas-shielded-metal-arc-wel
12. Yudodibroto, Hermans y otros, «Monitoring pendant droplet oscillation during pulsed current GMAW», 2004 — https://research.tudelft.nl/en/publications/monitoring-pendant-droplet-oscillation-during-pulsed-current-gmaw ; https://research.tudelft.nl/en/publications/oscillatory-behaviour-of-the-pendant-droplet-during-pulsed-curren
13. Wu y Kovacevic, «Mechanically assisted droplet transfer process in GMAW», Proc. IMechE B 216, 555–564, 2002 — https://www.smu.edu/-/media/Site/Lyle/RCAM/Publications/3-Mechanically-Assisted-DropletTransfer-Process-in-Gas-Met.ashx?la=en
14. Chen, Jia, Xiao, Huang, «Laser-driven programmable metal transfer in GMAW», Welding J. 99, 2020 — https://s3.amazonaws.com/WJ-www.aws.org/supplement/2020.99.009.pdf
15. Fronius CMT — https://www.fronius.com/en/welding/products/process-technologies/cmt ; folleto https://www.fronius.com/~/downloads/Perfect%20Welding/Brochures/PW_BRO_CMT_EN.pdf
16. Fronius, catálogo industrial EE.UU. 2025 (precios de lista) — https://www.fronius.com/-/media/usa/pw/downloads/iws_industrial_welding_catalog_2025.pdf
17. Lincoln STT: manual IM649, apéndice — https://homeappliance.manualsonline.com/manuals/mfg/lincoln_electric/im649.html?p=56 ; WO2013150366 / US 2013/0264323 — https://patents.google.com/patent/WO2013150366
18. Lincoln Power Wave S350 — https://bakersgas.com/products/lincoln-k2823-3 ; módulo STT https://westermans.com/lincoln-s350-powerwave-with-stt-module.aspx
19. Miller RMD — https://news.thomasnet.com/fullstory/welding-software-overcomes-short-circuit-mig-limitations-31631 ; https://contentauthor.millerwelds.com/resources/article-library/pipeline-contractors-turn-to-welding-process-for-productivity-and-quality
20. EWM coldArc — https://www.ewm-sales.com/en/EWM_welding_processes/coldArc--82.html ; https://www.binzel-abicor.com/FI/fin/yritys/abicor-binzel/innovationspreis/2006/1st-place/
21. US6025573A, Lincoln (Stava), detección de desprendimiento por dv/dt, expirada — https://patents.google.com/patent/US6025573A/en
22. US9616514B2, Lincoln (Hearn, Peters), «System and method to detect droplet detachment», activa hasta ~2033 — https://patents.google.com/patent/US9616514B2/en
23. US10974337B2, ITW (Holverson, Hsu), «Additive manufacturing systems and methods», activa hasta ~2037 — https://patents.google.com/patent/US10974337B2/en
24. Sukhotskiy, Vishnoi, Karampelas, Vader, Vader, Furlani, «Magnetohydrodynamic drop-on-demand liquid metal AM», FFHMT'18 paper 155 — https://avestia.com/FFHMT2018_Proceedings/files/paper/FFHMT_155.pdf ; patentes https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9593403 , https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10639718
25. Folleto de Xerox ElemX — https://xerox.com/downloads/usa/en/3d-printing/ElemX-3D-Printer-Brochure.pdf ; venta a ADDiTEC — https://www.metal-am.com/additec-acquires-elem-additive-solutions-from-xerox/
26. Imani Moqadam, Mädler, Ellendt, «A high temperature drop-on-demand droplet generator for metallic melts», Micromachines 10, 477, 2019 — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6680520/
27. Anzalone, Zhang, Wijnen, Sanders, Pearce, «A low-cost open-source metal 3-D printer», IEEE Access, 2013 — https://digitalcommons.mtu.edu/materials_fp/120 ; https://www.mtu.edu/news/stories/2013/november/scientists-build-low-cost-open-source-3d-metal-printer.html
28. Nilsiam y otros, Machines 3(4) 339–351, 2015 — https://doaj.org/article/12bdb1144dde409d804495ec8fe18db5 ; monitor V-I open-source < USD 100 (Millermatic 140/190) — https://www.doi.org/10.1155/2015/876714 ; https://osf.io/k2jcv
29. WAAM dot-by-dot (U. Bologna / MX3D) — https://structurae.net/en/literature/journal-article/wireandarc-additive-manufacturing-for-lattice-steel-structures-overview-of-the-experimental-characterization-on-dotbydot-rods ; CMT Cycle Step para puntos — https://cris.unibo.it/retrieve/c16bfe23-f81f-4877-a199-fa5f3f364c44/2024%20-%20LNME%20WAAM%20proof.pdf
30. McNeil, Carney, Shoemaker, Smith, Harwig, «New HES WA-DED process for on-board & expeditionary applications», AWS 2024 — https://programmaster.org/PM/PM.nsf/ApprovedAbstracts/F239D1A8A4F171C385258B490042ED5C
31. Liu y otros, transferencia en alambre autoprotegido (puente, globular repelida), STWJ 2008 — https://doi.org/10.1179/174329308X380354 ; polaridad en FCAW-S: J. Manuf. Process. 58 (2020) 478–488 (visto por resumen; sin URL verificada)
32. Campo B externo en GMA — https://informaticsjournals.com/index.php/IWJ/article/view/39085 ; WAAM 316L con campo transversal — https://link.springer.com/10.1007/s00170-021-08089-w
33. Touch sensing: US5650079 — https://patents.google.com/patent/US5650079 ; https://blog.binzel-abicor.com/how-seam-tracking-solutions-compare ; Fronius Additive (medición de CTWD) — https://www.fronius.com/de/schweisstechnik/produkt-informationen/fronius-additive
34. Oscilación del charco para sensar la penetración — https://www.osti.gov/biblio/443008 ; Hermans/den Ouden, Welding J. — https://app.aws.org/wj/supplement/Hermans/ARTICLE4.pdf
35. Mn: NIOSH NPG — https://www.cdc.gov/niosh/npg/npgd0379.html ; cambio del TLV de ACGIH — https://www.thefabricator.com/article/arcwelding/new-guideline-reduces-manganese-exposure-limit-dramatically ; Lincoln — https://prodcd.lincolnelectric.com/en/Welding-and-Cutting-Resource-Center/Weld-Fume/Controlling-Exposure-to-Manganese-in-Welding-Fume
36. NOM-010-STPS-2014 — https://dof.gob.mx/normasOficiales/5359/stps2a11_C/stps2a11_C.html ; https://www.gob.mx/cms/uploads/attachment/file/680155/NOM-010-STPS-2014.pdf
37. Fluoruros (como F), OSHA — https://www.osha.gov/chemicaldata/806
38. SDS de Forney «Flux-Core Welding Wire» E71T-GS, rev. 4/3/2025 — https://www.forneyind.com/site/SDS%20Files/Current%20SDS%20Sheets%20Posted%20on%20Forneyind.com/Flux-Core%20Welding%20Wire
39. Metales totales y solubles en humos de FCAW (Mn 1.75 % en autoprotegido) — https://www.tandfonline.com/doi/full/10.1080/02786820902773669
40. Tasas de humo (FCAW-S hasta 97 mg/s) — https://www.imt.uoradea.ro/auo.fmte/files-2011-v2/TCM/Moisa%20Rau%20L2.pdf ; TWI 242/1984 (ranking; bario soluble) — https://twi-global.com/what-we-do/research-and-technology/research-programmes/core-research-programme/report-abstracts/assessment-of-the-particulate-welding-fume-associated-with-the-flux-cored-arc-welding-of-carbon-manganese-steels-242-1984
41. IARC vol. 118, humos y UV de soldadura en el Grupo 1 — https://ohsonline.com/Articles/2017/04/25/IARC-Classifies-Welding-Fumes-and-UV-Radiation-as-Group-1-Carcinogens.aspx ; https://prodcd.lincolnelectric.com/en/Safety-Resources/IARC-Classification-Change-Statement
42. OSHA 1910.252 — https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.252 ; lista del Ejército de EE.UU. (2000 cfm por soldador, 100 fpm) — https://ph.health.mil/PHC%20Resource%20Library/Welding_Operations_Design_Review_Checklist_2016.pdf ; https://ehs.vt.edu/programs/occupational-safety/welding-cutting-brazing-and-soldering/ventilation.html
43. Velocidades de captura (soldadura, 100–200 fpm), Penn State ME405 — https://www.me.psu.edu/cimbala/me405/Links/Chapter_06_Tables_and_figures.pdf
44. Sombras AWS F2.2 — https://www.aws.org/magazines-and-media/welding-digest/wd-nov-2025--complete-welding-lens-shade-chart--safety-guide-for-eye-protection/ ; extracto de Tweco — https://www.manualsdir.com/manuals/595228/tweco-141i-fabricator.html?page=8
45. Nakashima, Utsunomiya, Takahashi, Fujii, Okuno, «Hazard of ultraviolet radiation emitted in GMAW of mild steel», J. Occup. Health 58(5) 452–459, 2016 — https://www.jstage.jst.go.jp/article/joh/58/5/58_16-0065-OA/_article/-char/en
46. NOM-027-STPS-2008 (soldadura y corte) — https://www.dof.gob.mx/normasOficiales/3536/stps1/stps1.htm ; https://www.gob.mx/cms/uploads/attachment/file/680160/NOM-027-STPS-2008.pdf ; resumen (extintor ABC a ≤7 m) — https://idconline.mx/laboral/2018/10/19/evita-accidentes-por-soldadura-y-corte
47. SELV en Electropedia — https://electropedia.org/iev/iev.nsf/17127c61f2426ed8c1257cb5003c9bec/20d4f4e4236e3696c125764d002f7568 ; comparación ES1/SELV (60 V en seco) — https://www.ieee802.org/3/ad_hoc/PDCC/public/2021/ES1_LPS_SELV_1_0821.pdf
48. Hoja de datos de Mean Well LRS-1200 (entrada 180–305 VAC, 48–56 V de ajuste, OVP 57–67 V, 150 % → apagado a los 5 s, RC 3.3–10 V = apagada) — https://www.meanwell.com/Upload/PDF/LRS-1200/LRS-1200-SPEC.PDF
49. Ficha de Truper del MICRO-5 (13751, E71T-GS 0.8 mm; el 13750 es la caja de 1 kg) — https://www.truper.com/ficha_merca/ficha-print.php?code=13751
50. Foro de la AWS: «GS» no fija la química — https://app.aws.org/forum/topic_show.pl?tid=5226
51. Hu y Tsai, simulación de ODPP en GMAW, J. Appl. Phys. 2006 — https://scholarsmine.mst.edu/mec_aereng_facwork/1491

**De memoria, sin verificar aquí:**
- la fórmula de Dalla Valle y el ×0.75 con brida (ACGIH Industrial Ventilation);
- la impedancia del cuerpo (IEC 60479-1);
- las categorías de paro (IEC 60204-1 / ISO 13850);
- los 11 m de NFPA 51B;
- el límite de fluoruros en la NOM-010 (probablemente 2.5 mg/m³);
- que un relé de «30 A 250 VAC» corta ~30 V DC.
