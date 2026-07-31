# PLIEGO DE INTERFAZ — derivado del libro (2026-07-31)

He leído los cuatro archivos completos (277 k caracteres) y revisé el código actual del molde en `/home/ian/Orkesta/la-forja/src/forja/mold/` y `/home/ian/Orkesta/la-forja/src/forja/brep/MoldPanels.tsx` para anclar el pliego a lo que ya existe. Aquí va.

---

# PLIEGO DE LA INTERFAZ — La Forja / Módulo Molde
## Cliente: David Kazmer. Operador: ingeniero de moldes LATAM.

> **Regla de redacción de este pliego:** ningún requisito existe porque se vea bonito. Cada uno cita la § del libro que lo obliga. Si no hay §, no entra.

---

## 0. LOS SEIS AXIOMAS DE INTERFAZ (de dónde sale todo lo demás)

| # | Axioma | § que lo obliga |
|---|---|---|
| **A1** | **La pantalla no es un wizard: es un grafo con retornos.** El orden canónico existe (layout→feed→cooling→ejector→structural) pero "*sometimes requires the redesign of previously designed subsystems*". | §1.5 Fig 1.9, §12.5, §4.3 (insertos↔base), §7.3.4, §5.5.2, §9.2.2↔§9.2.7 |
| **A2** | **Ante la duda, la UI expone la duda; NUNCA engorda el molde.** "*The tendency among novice designers, when in doubt, is to over design. This tendency should be avoided.*" El default de un campo desconocido es **INCÓGNITA VISIBLE**, no worst-case silencioso. | §1.2, §12.1.1 |
| **A3** | **Todo número lleva su procedencia y su sesgo pegados.** Receta del libro, sustitución con LOS números de este molde, resultado, y etiqueta de sesgo ("conservador +60%"). | §3.3.1.3, §5.4, §9.2.1 n.2, §11.2.2, §12.2.2, §12.3.1 |
| **A4** | **El entregable no es UNA geometría: es un MENÚ + un PLAN DE TRYOUT + un REGISTRO FIRMADO.** "*the customer can be given more than one design*" / "*specify a smaller gate with the intent that the mold will be tested*" / "*decisions… should be approved and documented between all the involved parties*". | §3.2.2, §7.3.5, §13.10 |
| **A5** | **Los conflictos entre subsistemas son la norma, y el árbitro es el humano.** "*It is up to the mold designer to consider the relative importance of the conflicting requirements.*" El software detecta y cuantifica; NO resuelve en silencio. | §1.2, §9.2.7, §12.2.3, §12.5 |
| **A6** | **La pantalla se diseña para el taller que va a operar el molde, no para el que lo dibuja.** Etiquetas in/out, ≤2 conexiones, pines marcados, componentes rebajados, "diseñar para el abuso". | §9.1.6, §11.1.7, §11.2.6, §11.3.6, §11.3.7, §13.9.1 |

---

# 1. EL MAPA DE PANTALLAS

## 1.1 Por qué NO es un wizard

El proceso del cliente tiene **siete lazos de retorno documentados**, y cada uno tiene que ser navegable en un clic:

| Lazo | Origen → Destino | § |
|---|---|---|
| L1 | Gate "Project OK?" NO → diseño inicial + re-cotizar | §1.5 |
| L2 | Eyectores → rediseño del enfriamiento | §1.5, §11.2.5 |
| L3 | Insertos ↔ base de molde (tallas discretas) — "*iteration… is normal*" | §4.3, §4.2.1 |
| L4 | Espesor mínimo de pared ← depende del feed system → volver al cap 6 | §5.5.2 |
| L5 | Cálculo de gate → **cambiar el TIPO DE MOLDE** (3 placas / cámara caliente) | §7.3.4 |
| L6 | Ruteo de agua imposible → §9.2.2 recalcular Q_line, V̇, ΔT, D (n_lines es entrada Y salida) | §9.2.7→§9.2.2 |
| L7 | Fasteners interfieren con expulsión y enfriamiento → "*iterative redesign of the mold may be required*" | §12.5 |
| L8 | Costo del molde domina el costo/pieza → re-cotizar con arquitectura más barata | §3.4.4, §3.5 |

**Un wizard con "Siguiente" es incompatible con esto.** La navegación es un **tablero de subsistemas siempre visible** (la barra de estado nunca desaparece, en ninguna pantalla) más una **bandeja de demandas**.

## 1.2 Las once pantallas (modos), y qué se ve en cada una

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ P0 LOBBY DE PROYECTOS ── (ya existe: ProjectSwitcher)                         │
└──────────────────────────────────────────────────────────────────────────────┘
   │
   ├─ P1  INTAKE VIVO  ......... worksheets 2.1–2.11, documentos vivos    §2.2
   ├─ P2  TABLERO / EL GRAFO  .. estado de los 9 subsistemas + demandas   §1.5
   │        └─ P2b BANDEJA DE DEMANDAS (inbox de iteraciones)            §1.5,§12.5
   ├─ P3  MENÚ DE DISEÑOS  ..... N candidatos + break-even + veto        §3.2.2
   ├─ P4  BANCO DEL SUBSISTEMA . visor 3D + paneles + timeline (×9)      caps 4–12
   ├─ P5  ARBITRAJE DE CONFLICTOS  .. el humano asigna prioridad         §1.2
   ├─ P6  PLAN DE TRYOUT  ...... steel-safe + despliegue por etapas §6.5.5,§10.2.2
   ├─ P7  REGISTRO DE DECISIONES ... costos/beneficios/riesgos firmados  §13.10
   ├─ P8  PAQUETE DE TALLER  ... planos + hoja de arranque + servicio    §9.1.6
   ├─ P9  BITÁCORA DE TRYOUT  .. lo MEDIDO regresa y desafía a lo calculado §10.1.7
   ├─ P10 SELECTOR DE TECNOLOGÍAS .. el árbol de la Fig 13.1             §13.1
   └─ P11 COTIZACIÓN  .......... desglose + términos + alarma sobrediseño §3.1,§3.4.4
```

### P2 — EL TABLERO (la pantalla de inicio del proyecto)

Es el mapa del grafo, no una lista. Cada subsistema es un nodo con **estado de congelamiento** — necesario porque §1.5 dice literal que solo se compra por adelantado lo que NO está "fuzzy": *"Such concurrent engineering should not be applied to fuzzy aspects of the design."*

**Los cinco estados de un nodo** (colores y semántica, obligatorios):

| Estado | Significa | Se puede comprar acero? (§1.5) |
|---|---|---|
| `VACÍO` | ni sembrado | NO |
| `SEMILLA` | valor de arranque por regla de dedo (§7.3.2 asigna dimensiones ANTES de calcular) | NO |
| `CALCULADO` | pasó sus criterios de aceptación | NO |
| `CONGELADO` | el humano lo firmó; genera orden de compra | SÍ |
| `IMPUGNADO` | otro subsistema le mandó una demanda; **era CONGELADO y dejó de serlo** | NO — y **alerta si ya se compró** |

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  PROYECTO PRJ-2417 · Bezel laptop · ABS MG47 · 500 k pz          ⚠ 3 DEMANDAS ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   ┌──────────┐    ┌──────────┐    ┌──────────┐                               ║
║   │ ① INTAKE │───▶│② PARTICIÓN│──▶│③ LLENADO │                               ║
║   │ ●CONGELADO│   │ ●CONGELADO│   │ ●CALCULADO│                              ║
║   │ 41/58 ⚑2 │    │ §4.1–4.4 │    │ ΔP 96 MPa│                               ║
║   └──────────┘    └────┬─────┘    └────┬─────┘                               ║
║                        │  ▲            │                                     ║
║                        │  └────────────┼───────── L4 §5.5.2 espesor←feed ──┐  ║
║                        ▼               ▼                                  │  ║
║   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐            │  ║
║   │④ ALIMENT.│◀──▶│ ⑤ GATES  │───▶│⑥ VENTEO  │    │⑦ CONTRAC.│            │  ║
║   │ ●CALCULADO│   │ ⚠IMPUGNADO│   │ ○SEMILLA │    │ ○SEMILLA │◀───────────┘  ║
║   │ ΔP 44/50 │    │ L5 §7.3.4│    │ 8 de 36  │    │ s=0.5 %  │               ║
║   └────┬─────┘    └──────────┘    └──────────┘    └──────────┘               ║
║        │                                                                     ║
║        ▼                                                                     ║
║   ┌──────────┐        ⇄        ┌──────────┐        ⇄     ┌──────────┐        ║
║   │⑧ENFRIAM. │◀═══L2 §1.5═════│⑨EXPULSIÓN│◀══L7 §12.5══│⑩ESTRUCT. │        ║
║   │ ⚠IMPUGNADO│    (2 pines)   │ ●CALCULADO│  (SHCS)     │ ●CALCULADO│       ║
║   │ pitch 2.4H│                │ 14 pines │              │ δ 0.36 mm│        ║
║   └──────────┘                └──────────┘              └──────────┘        ║
║                                                                              ║
║   ⚡ 3 CONFLICTOS ABIERTOS  →  [ ABRIR ARBITRAJE P5 ]                         ║
║   💲 costo molde = 71 % del costo/pieza  ⚠ §3.4.4 posible SOBREDISEÑO         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Requisitos duros del tablero:**

- **R2.1** Las aristas del grafo son las **8 demandas canónicas** (L1–L8 arriba), con la § impresa en la arista. Una arista viva (demanda pendiente) parpadea; una arista histórica (demanda ya resuelta) queda gris pero clicable → abre el historial. §1.5, §12.5
- **R2.2** Un nodo `CONGELADO` que recibe demanda **cambia solo** a `IMPUGNADO` y, si tenía orden de compra emitida, dispara la alerta **"ACERO YA COMPRADO"** con el costo de la re-orden. Esto es la traducción literal de §1.5: la concurrencia solo aplica a lo no-fuzzy.
- **R2.3** El tablero muestra permanentemente **el número que juzga al proyecto entero**: la proporción molde-amortizado / material / proceso en el costo por pieza. Si el molde domina → bandera de sobrediseño y botón **"generar alternativa más barata"**. §3.4.4, §3.5
- **R2.4** El orden canónico (§1.5) se dibuja como el camino principal (aristas gruesas). Los retornos son aristas delgadas curvas. El usuario puede entrar a cualquier nodo en cualquier momento: **no hay nodos bloqueados**, solo nodos que muestran de qué dependen y con qué valor semilla están corriendo. Justificación: §2.1.5 — el moldero arranca con 3 datos y ya produce layout + costo + sugerencias de rediseño.

### Cómo se representa VISUALMENTE que un subsistema mandó una demanda a otro

Tres capas simultáneas, no una:

1. **En el grafo (P2):** arista dirigida animada origen→destino, con etiqueta `L2 §1.5`, y el nodo destino en `IMPUGNADO`.
2. **En la bandeja (P2b):** una tarjeta de demanda con estructura fija:

```
┌─ DEMANDA D-07 ────────────────────────────── ⚠ PENDIENTE ── 2 h ─┐
│ ⑨ EXPULSIÓN  ──exige──▶  ⑧ ENFRIAMIENTO                          │
│ §1.5 "the placement of ejector(s) may require a redesign of      │
│       the cooling system"    ·    §11.2.5                        │
│                                                                  │
│ QUÉ PASÓ  Se acercaron 2 pines Ø4.5 a la costilla R-3 para       │
│           empujar donde la pieza se pega (§11.2.5).              │
│ QUÉ ROMPE Línea de agua C-4: claro a pin = 1.8 mm.               │
│           Mínimo §9.2.7 = 0.5·D = 3.18 mm.  FALTAN 1.38 mm.      │
│                                                                  │
│ OPCIONES  ○ a) Bajar Ø del pin 4.5→3.5   §11.2.5 lo autoriza     │
│              ⤷ costo: σ_cortante en la pieza 1.18× límite ✗      │
│           ○ b) Mover la línea C-4 y mantener pitch/H  §9.2.7(2)  │
│              ⤷ costo: ΔT_cara +3.1 °C, ciclo +1.9 s              │
│           ○ c) Agrandar inserto + base  §9.2.7(1)                │
│              ⤷ costo: +$2,140 USD base, +6 días                  │
│           ○ d) RECHAZAR — razón obligatoria ▸                    │
│                                                                  │
│ [ ACEPTAR b ]  [ ARBITRAR EN P5 ]  [ POSPONER (queda IMPUGNADO) ]│
└──────────────────────────────────────────────────────────────────┘
```

3. **En el banco 3D del subsistema destino (P4):** el elemento afectado (la línea C-4) se dibuja con **halo de demanda** y su cota aparece en estado "impugnada" (valor tachado + valor propuesto).

**R2.5** Una demanda NUNCA se auto-aplica. §1.2 y §9.2.7 exigen que el humano decida la importancia relativa. Aceptar, rechazar y posponer son las tres únicas salidas, y **rechazar exige razón escrita** que se copia al registro §13.10.

---

# 2. EL INTAKE VIVO (P1)

## 2.1 Los tres principios que lo definen

- **§2.2** — "*the mold design engineer should not consider these worksheets as static pages, but rather as **living documents** that are linked to design decisions and decision making processes with **routing from and to the right people for information and approval**.*" ⇒ cada campo es un objeto con estado, dueño, historial y ruta de aprobación. **NO es un `<form>`.**
- **§2.1.5** — "*The critical part design information required to begin a mold design includes **just the part size, wall thickness, and expected production quantity**.*" ⇒ con 3 campos el sistema ya debe entregar layout inicial, costo y **sugerencias de mejora al producto**.
- **§2.2.2** — cada campo de la Tabla 2.3 puede ser **restricción del cliente** o **salida a optimizar**. ⇒ **switch por campo**, no un formulario de inputs.

## 2.2 Anatomía de UN campo (el átomo de la interfaz)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Tiempo de ciclo                                    Tabla 2.3 · §2.2.2      │
│ ┌─────────────┐  ⟨ ● RESTRICCIÓN DEL CLIENTE  |  ○ SALIDA A OPTIMIZAR ⟩    │
│ │  22.0   s   │                                                            │
│ └─────────────┘  🔒 lo impuso el cliente  ·  fuente: RFQ-1180 p.3          │
│                                                                            │
│  ⚠ NUESTRO CÁLCULO DA 26.4 s  (§9.2.1 t_c centerline, pared 3 mm)          │
│    → esta restricción NO se cumple con la arquitectura actual              │
│    [ desafiar al cliente ]  [ cambiar arquitectura ]  [ aceptar riesgo ]    │
│                                                                            │
│  ruta: preguntar a → ○ ing. de aplicaciones (interno)  ○ cliente  §2.2.1   │
│  historial: 12-jul ana@ 20 s → 19-jul cliente 22 s ✓aprobó lgr@            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Requisitos por campo:**

| # | Requisito | § |
|---|---|---|
| R1.1 | **Switch RESTRICCIÓN / SALIDA** en todo campo de la Tabla 2.3 (ciclo, nº cavidades, tasa de producción, family mold, nº de moldes). Si está en SALIDA, el campo se vuelve **de solo lectura y lo llena el motor** con su procedencia. | §2.2.2 |
| R1.2 | Un campo en RESTRICCIÓN que el motor no puede cumplir muestra **el choque en el mismo campo** — restricción vs cálculo lado a lado. Nunca en un panel aparte. | §2.2.2 |
| R1.3 | **Ícono de candado + fuente documental** ("RFQ-1180 p.3") en todo dato impuesto. Un dato calculado lleva ícono de fórmula y abre su derivación (patrón `CalcRows` que ya existe en `MoldPanels.tsx`). | §2.2, §2.2.5 |
| R1.4 | **Ruteo de la pregunta**: cada campo tiene destinatario configurable, con default **ing. de aplicaciones interno** para lo trivial. Literal §2.2.1: llamar primero al interno "*so as to avoid continuously contacting the customer regarding what may be considered as potentially trivial issues*". El sistema debe **proteger la relación con el cliente**, y eso es UI. | §2.2.1 |
| R1.5 | **Historial por campo** con autor, fecha y aprobación. Motivado por ISO/regulatorio (§2.2, §2.2.3 Tabla 2.5). | §2.2 |
| R1.6 | **Estado de completitud tri-valuado**: `FALTA` / `SUPUESTO` / `VERIFICADO`. "Supuesto" es obligatorio para propiedades de material no confirmadas con el proveedor: "*document the assumed material properties that govern the mold design*". | §2.2.5 |

## 2.3 Los tres anillos de completitud (cómo se marca lo que falta)

No una barra de progreso. **Tres anillos concéntricos** porque el libro distingue tres niveles de suficiencia:

```
   ANILLO 1 — ARRANQUE (§2.1.5)          3/3 ✓  → habilita layout + costo + DFM
     tamaño · espesor · cantidad

   ANILLO 2 — COTIZACIÓN (§3.3–3.4)     11/14   → faltan: acabado por zona,
     + material, acabado, tolerancia,             tarifa de maquinado negociada,
       volumen anual, abrasividad                 coeficiente de mantenimiento

   ANILLO 3 — DETALLE (§2.1.2)          41/58   → cada componente con material,
     Tablas 2.1–2.11 completas                    forma, acabado, tolerancia,
                                                  PROVEEDOR y costo
```

**R1.7** Las capacidades del sistema se **desbloquean por anillo**, y cada botón deshabilitado dice **qué campo exacto le falta**, no "completa el formulario". §2.1.5 define el anillo 1; §2.1.2 define "detailed design" como "*fully specified in terms of material, geometric form, surface finish, tolerances, supplier, and cost*".

## 2.4 Desafiar una tolerancia sobre-especificada (§2.2.3) — pantalla propia

Es la frase más agresiva del capítulo 2: *"**Just because a tolerance is specified does not mean that it is achievable.** In fact, it is not uncommon for product designers to over-specify the tolerances."*

```
╔════ TABLA 2.6 · TOLERANCIAS ═══════════════════════════════════════════════╗
║ General            ±0.4 %   ← típica §2.2.3                     ✓ normal   ║
║ Crítica 1  L=120   ±0.05 mm = ±0.042 %                          🔴 DESAFÍO  ║
║ Crítica 2  Ø38     ±0.15 mm = ±0.39 %                           ✓ normal   ║
║ Crítica 3  —                                                               ║
║ ──────────────────────────────────────────────────────────────────────────║
║ 🔴 CRÍTICA 1 ESTÁ POR DEBAJO DE LA APRETADA TÍPICA (±0.1 %) §2.2.3          ║
║                                                                            ║
║  Lo que cuesta cumplirla (no lo que cuesta decirla):                       ║
║   • Molde PROTOTIPO para caracterizar contracción  §2.2.3, §10.1.7  +$8,400 ║
║   • Perfilado NO UNIFORME de contracción por zona   §10.2.1        +$1,900 ║
║   • Modificaciones durante commissioning            §2.2.3         +$3,000 ║
║   • Contracción del ABS ±0.5 % ⇒ SOLA saca la pieza de tolerancia §10 int. ║
║   • Expansión térmica del molde 0.05 % a 60 °C, hay que compensarla §10 int.║
║                                                                            ║
║  [ ENVIAR DESAFÍO AL EQUIPO DE PRODUCTO ]   plantilla §2.2.3 precargada     ║
║  [ ACEPTAR Y COTIZAR CON EL COSTO OCULTO ]  → suma $13,300 a la cotización  ║
║  [ MARCAR COMO NEGOCIADA ]  → registro §13.10 con responsable del número    ║
╚════════════════════════════════════════════════════════════════════════════╝
```

**R1.8** El desafío es **una acción de primera clase con plantilla de correo/ticket**, no una advertencia pasiva. §2.2.3 dice que el diseñador "*should discuss… and communicate*" — o sea, hay un mensaje que sale.
**R1.9** Aceptar una tolerancia desafiada **inyecta su costo oculto en la cotización** automáticamente. Si no, el sistema estaría regalando trabajo.

## 2.5 El botón que baja tu propio ticket (§2.2.4) — obligatorio y visible

*"a mold designer may understand that the cost of the mold could be reduced by slightly changing an angle… but remain silent to justify the need for a core pull and a higher priced mold… it is a losing long term strategy."*

**R1.10** El intake corre las checklists DFM (Tabla 2.8) y DFA (Tabla 2.9) y produce un panel **"REDISEÑOS QUE ABARATAN TU MOLDE"** que se envía al cliente, con el ahorro en dólares y el **impacto negativo en nuestro precio impreso al lado**. Es política de negocio del cliente y debe estar en la UI, no en un manual.

```
 REDISEÑOS QUE ABARATAN TU MOLDE  (te lo decimos aunque nos baje el ticket §2.2.4)
 ─────────────────────────────────────────────────────────────────────────────
 ▸ Boss horizontal en pared C  → girar 4° elimina el core pull   −$6,800  (−$4,100 para nosotros)
   pero §2.3.7: NO lo quites si la función es vital o si obliga a operación post-molde
   [ es vital ]  [ acepto el cambio ]  [ comparar: mecanismo vs 2 piezas ]
 ▸ Pared 3.2 mm no uniforme    → 2.4 mm + costillas 70 %          −$1,200/año material
   §2.3.1 escalera de mejora · §2.3.2 rigidez equivalente con 15 % menos material y 70 % menos ciclo
 ▸ Esquinas vivas en 6 aristas → fillet ext 150 % / int 50 % del espesor  §2.3.4
   ⚠ elegir el radio del CATÁLOGO DE CORTADORES disponible, no un número redondo  §2.3.4
```

---

# 3. LA PANTALLA DE CADA SUBSISTEMA (P4)

## 3.0 El esqueleto común: la rejilla de tres columnas

**El patrón que más errores ha cazado en este proyecto es poner receta-vs-realidad juntas en pantalla.** Se formaliza así, y aplica a los nueve subsistemas:

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║ ⑧ ENFRIAMIENTO                                    ●CALCULADO  ⚠1 demanda  §9         ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║                                        │  VISOR 3D                                    ║
║  REGLA (§)   │  ESTE MOLDE  │  REAL    │  ┌───────────────────────────────────────┐  ║
║ ─────────────┼──────────────┼──────────│  │                                       │  ║
║  2D<H<5D     │  H=12.7=2.0D │  —       │  │   mapa de T de la CARA moldeante      │  ║
║  §9.2.5      │      ✓       │          │  │   + líneas de agua con halo de ½D     │  ║
║ ─────────────┼──────────────┼──────────│  │   + sentido de flujo + nº de tapón     │  ║
║  H<W<2H      │  W=25.4=2.0H │  —       │  │                                       │  ║
║  §9.2.6      │   ✓ (límite) │          │  └───────────────────────────────────────┘  ║
║ ─────────────┼──────────────┼──────────│  capas: ☑T_cara ☐flujo ☐esfuerzo ☐choques  ║
║  ΔT ≤ 1 °C   │  0.6 °C      │ 1.4 °C   │                                              ║
║  §9.2.3      │      ✓       │ ⚠tryout  │  LÍNEA DE TIEMPO DE OPERACIONES              ║
║ ─────────────┼──────────────┼──────────│  ├─taladro C1─┬─C2─┬─rimado─┬─tapones─┤     ║
║  Re > 4000   │  11,400      │  —       │       ▲ 1 setup, sin sellos §9.2.7          ║
║  §9.2.4      │      ✓       │          │                                              ║
║ ─────────────┼──────────────┼──────────│  🏷 SESGOS ACTIVOS EN ESTA PANTALLA          ║
║  t_c (Eq 9.5)│  18.9 s      │ 24.1 s   │  • t_c ignora resistencia de contacto:      ║
║  vs 2h²=18 s │              │ (+27 %)  │    la realidad será mayor  §9.2.1 n.1       ║
║  §9.2.1      │              │          │  • Re no es el driver real  §9.2.4          ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
```

**Requisitos del esqueleto:**

- **R4.0.1** Las tres columnas son **REGLA (§) / ESTE MOLDE / REAL-MEDIDO**. La tercera columna se llena desde P9 (bitácora de tryout), desde el proveedor, o desde el taller. Un molde sin tryout tiene la columna vacía — y eso **es información**, no ruido.
- **R4.0.2** Cada fila de "ESTE MOLDE" abre la **sustitución numérica completa** (ya existe como `CalcRows`: fórmula del libro → sustitución con los números de ESTE molde → resultado, en rojo si viola). Se generaliza a todos los subsistemas.
- **R4.0.3** El panel **SESGOS ACTIVOS** es permanente y lista los sesgos que están inflando o desinflando los números de ESTA pantalla, con su magnitud conocida cuando el libro la da.
- **R4.0.4** La línea de tiempo de operaciones no es decorativa: muestra **setups de máquina y sellos**, porque §9.2.7 dice que el criterio ganador de un layout de agua puede ser "*machined in a single setup without any need for seals or gaskets*".

---

## 3.1 PARTICIÓN / LAYOUT (cap 4)

**Números simultáneos obligatorios** (todos en una pantalla, porque el orden de §4.1→§4.3 consume grados de libertad):

| Bloque | Números visibles | § |
|---|---|---|
| Apertura | dirección; área proyectada mayor y si está ∥ al plano; tipo (axial / split cavity / oblicua) + costo declarado de la oblicua | §4.1.1 |
| Línea de partición | longitud en zona visible vs no visible (%); nº de shut-offs vs nº de ventanas de la pieza (deben ser iguales) | §4.1.2, §4.1.4 |
| Interlocks | ángulo de CADA feature del plano (≥5°) | §4.1.3 |
| Inserto | **H_diseño y H_compra por separado** (respaldo→plano vs total con el corazón); L, W; allowance 3·D_cooling por lado; cheek vs profundidad de cavidad; redondeo a ½″/10 mm **hacia arriba**; estado de cara: *flush / proud / hundida* | §4.2.1, §4.2.2, §4.2.3 |
| Layout | ratio ancho:largo del envelope (<2:1); tipo (línea / grid 2ⁿ / circular ≤8); holgura a CADA componente vecino (½·D de ESE componente) | §4.3.1, §4.3.2 |
| Base | A, B, E (=profundidad de pieza), S y C **marcados como "los da el proveedor"**; talla dentro de 200–1000 mm | §4.3.2 |
| Máquina | ancho del molde **incluyendo plugs y conectores** vs 800 mm entre tie bars; altura vs daylight [350, 800]; **shot como % del máximo con la banda cómoda 25–50 % pintada**; tonelaje requerido vs disponible, con aviso de exceso | §4.3.3 |
| Materiales | **dos selectores separados**: inserto (Tabla 4.1) y base (solo 1045/4140/P20) | §4.4.4 |

**Qué se dibuja en 3D:**
- La **jaula de la máquina** alrededor del molde: tie bars como cuatro columnas reales y el daylight como dos platos. Ver que "cabe" tiene que ser visual, no un ✓. §4.3.3
- **Máscara de visibilidad de la pieza**: superficies visibles/funcionales en rojo. Poner la línea de partición ahí es un error de §4.1.2, y la máscara lo hace obvio. Overlay complementario: "aristas candidatas no visuales" en verde.
- **Halos de holgura** de ½·D alrededor de leader pins, guide bushings, return pins, SHCS, líneas de agua, expulsores y pilares. §4.3.2 — "*mold bases are often sized larger than what would first be considered*": el halo es el que hace crecer la base y hay que **verlo**.
- Superficies **lofted** del plano de partición no plano, con su draft, y las zonas de posible impacto corazón↔cavidad marcadas. §4.1.3

**Qué va como texto:** la tabla de la Tabla 4.1 (matriz material × ciclos × presión) con la celda activa resaltada; el SLA del proveedor (quick-ship, ≤1 semana, antes de mediodía = mismo día) como checklist verificable §4.3.4; y el criterio de recepción "*finish ground, heat treated, and ready for machining*" §4.3.4 como ítem de la orden de compra.

**Alarmas propias:** molde **demasiado chico** para la máquina (no genera tonelaje) y tonelaje **excesivo** sobre molde subdimensionado (lo destruye) — los dos extremos fallan §4.3.3.

---

## 3.2 LLENADO (cap 5)

**Simultáneos:**

- **La convergencia visible.** §5.5.1 exige iterar v↔γ̇↔μ ("0.5 → 0.69 → 0.77 → 0.80 → 0.82 m/s"). La UI **muestra la escalera de iteraciones**, no solo el 0.82 final. Un número sin su convergencia no es auditable.
- **ΔP con DOS techos y DOS pisos:** la barra va de 0 a 200 MPa (máquina) con línea de diseño en 100 MPa (§5.1) **y zona roja inferior** porque ΔP demasiado baja reprueba: "*very low melt pressures are indicative of a poor molded part design*" (§5.1). Ver §4.4 de este pliego (alarmas contraintuitivas).
- **Curva P(h)** con la intersección contra la línea de 100 MPa marcando el **espesor mínimo de pared**, y una nota fija: "*el espesor mínimo también depende del feed system*" con enlace a ④ (§5.5.2 = lazo L4).
- **Tabla del lay-flat** editable: segmento, ancho, espesor, longitud, μ, ΔP parcial, ΔP acumulada. Segmentación **obligatoria por cambio de espesor**, opcional por ancho (§5.5.2). Tres niveles de fidelidad seleccionables (A / B+C / fino) porque §5.5.2 dice que agrupar es criterio del diseñador.
- **Tonelaje en llenado Y en packing**, lado a lado, con el mayor resaltado (§5.5.3: "*It can be difficult to discern…*"), calculado sobre **área proyectada** (con el área proyectada dibujada y el descuento por ventanas visible — §3.4.3 advierte que el bezel con ventana grande sobreestima) y con **piso duro de 50 MPa** (§5.5.3), etiquetado: "el moldeador empacará aquí aunque el análisis diga menos".
- Velocidad lineal contra la banda 0.01–1 m/s (§5.5.1).
- Contraste con simulación cuando exista: 100 vs 110 MPa, 486 vs 519 kN (7 %) — Tabla 5.1.

**3D / overlays:**
- **Isócronas de llenado** (arcos) desde los gates reales + *phantom gates*; **última zona en llenar** marcada con un pin que **se propaga automáticamente a ⑥ VENTEO y ⑨ EXPULSIÓN** (§5.2.3 lo dice literal: vents y/o expulsores ahí).
- **Race-tracking**: el criterio es geométrico (perímetro < línea central, §5.5.4) — dibujar ambas longitudes sobre la pieza con sus números.
- **Gas traps**: esferas. Las que caen en **pared lateral** en rojo severo: "*especially problematic since it is difficult to vent… the trapped air will likely combust, causing a burn mark*" (§5.5.4).
- **Weld lines** como curvas, con el mapa de "zonas aceptables" que el diseñador pinta a mano (§5.2.3: el humano decide qué es menos importante estética/estructuralmente).

**Panel de remedios ordenado** (§5.2.1, la escalera del moldeador, en su orden real): subir T_molde y T_melt → agrandar runners → resina de menor viscosidad → **y hasta el final** cambiar espesor. La UI presenta los remedios **en ese orden** y marca el último como "el más caro". Y el espejo: si el molde es muy fácil de llenar, "el moldeador va a bajar temperaturas y subir velocidad" — o sea, **tu margen se lo va a comer el ciclo**.

---

## 3.3 ALIMENTACIÓN (cap 6)

**El contrato del feed system son tres presupuestos** (§6.4). Se dibujan como **tres barras de presupuesto**, siempre visibles:

```
 ΔP feed    ████████████░░░░░░  44.0 / 50.0 MPa     (min(50 % ΔP_cav, 50 MPa))  §6.2.2
 V feed     ██████░░░░░░░░░░░░  13.1 / 15.0 cc      (30 % de V_cav = regrind)   §6.2.3
 t_c feed   ███████████████░░░  26.7 / 18.9 s  ⚠    ("greatly exceeds"?)        §6.4.7
```

**R4.3.1** La tercera barra **no falla por exceder, falla por "exceder mucho"** — el libro acepta 26.7 vs 18.9 s con matiz ("*the runner need not be as rigid as the part*", §9.2.1). La UI usa un umbral **ámbar con texto de juicio**, no un ✗ automático. Es un caso donde un booleano mentiría.

**Otros números simultáneos:**
- **ΔP TOTAL desde el fondo del sprue hasta el final de CADA cavidad**, en una tabla por rama. §6.4.6: el balanceo artificial iguala el total (cavidad+rama), no el ΔP del runner. Es el ⭐8 del corpus caps 4–6 y balancear solo runners da un molde desbalanceado.
- Diámetros aguas abajo **monótonos decrecientes**, con la única excepción marcada explícitamente: `nozzle_orifice < sprue_inlet` (§6.3.1), y la alarma de "sprue break" si se invierte.
- **Catálogo de cortadores** (1/32″…1/2″, 2/3/4/4.5/5/6/8/10/12 mm) como *snap* del control deslizante, **con puerta de escape declarada** (§6.5.4: "*if non-standard runner sizes provide for less material utilization and more balanced melt flow, then non-standard runner diameters can and should be specified*"). O sea: el catálogo imanta, no encarcela — y salirse deja una nota justificatoria.
- **Steel-safe del runner**: el control redondea **hacia abajo** 1–2 tallas (4.6 → 4.5 o 4.0, nunca 5.0) §6.5.5, y muestra el costo de equivocarse hacia arriba (pocket milling + inserto + soldadura + rehacer el feed).
- Eficiencia por sección: round 100 %, round-bottom trap 87.9 %, trapezoidal 78.5 %, half-round 61.2 % (§6.5.1), y el recordatorio de que **los 5° de salida ya están horneados** en las fórmulas de D_h.
- Hot runner: `n_turns` con umbrales 1 y 10 (§6.4.8), residencia (1+n_turns)·t_ciclo contra 15 min, y la advertencia asimétrica: **"reducir diámetros en hot runner es CARO"** — el sesgo steel-safe no aplica igual (§6.2.3).
- Sucker pins: D_sucker < D_runner, altura ≈ D/2, taper 5°, tope alineado al fondo del runner, y **orientación angular de cada ranura como cota** (§6.5.2 — ranuras al azar traban el runner y matan el ciclo automático).

**3D:** el árbol del feed con diámetro real, coloreado por **ΔP acumulada** (no por diámetro), y las cavidades coloreadas por **tiempo de llenado de su rama** — para ver el desbalance, no para leerlo.

**Anti-patrón cazado por la UI:** si el usuario (o un preset) pide `D_abajo = D_arriba/√n`, el sistema lo marca en rojo con la cita: §6.4 — "*the resulting designs are inferior with respect to the imposed pressure drops and the consumed plastic material*". Kazmer **rechaza** esa regla clásica; la UI también.

---

## 3.4 GATES (cap 7)

**El tipo de gate NO es un enum plano.** Se muestra como una tarjeta con **cinco atributos consultables** (§7.3.1 Tabla 7.1 + notas):

```
┌ GATE G-1 · EDGE ────────────────────────────────────────────────────┐
│ runner      FRÍO          degatado  MANUAL (pinzas del operador)     │
│ cortante    MODERADO ~40k s⁻¹        flujo     RADIAL                │
│ ⭐AGRANDABLE  SÍ → hasta 14 mm de ancho; más allá CAMBIA DE TIPO      │
│              a FAN GATE  §7.3.2                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**R4.4.1** El atributo **"agrandable"** es de primera clase porque §7.3.5 dice que el tipo se elige, entre otras cosas, por si se puede abrir después. Ningún catálogo comercial trae esa columna; el libro sí.

**R4.4.2** Cuando una dimensión cruza el límite de su clase, la UI **propone el cambio de clase** ("14 mm de ancho ⇒ ya es un fan gate, §7.3.2") y, un nivel más arriba, el **cambio de tipo de molde**: §7.3.4 — "*this edge gate design does gate into a thinner section… For this reason, a three-plate mold or hot runner mold should be considered*". Ese salto de dos niveles de abstracción es el lazo L5 del grafo y **se dispara desde la pantalla del gate**.

**Simultáneos:**

| Número | Referencia visible al lado | § |
|---|---|---|
| γ̇ calculado | γ̇max del material **con bandera de confianza**: "el apéndice orienta, el proveedor manda; muchas veces se puede más" | §7.1.4, §7.4 |
| ΔP del gate | escala con **tres marcas**: 2 MPa típico · 6 MPa sospechoso · 10 MPa mal diseñado (muy delgado o muy largo) | §7.1.4, §7.3.3 |
| t_freeze del gate | **contra t_pack requerido por la pieza**, uno junto al otro, con el aviso: las ecuaciones dan **MÍNIMOS** (ignoran convección) ⇒ "*expected to be significantly longer*" | §7.3.4 |
| espesor del gate | contra el espesor de pared **en el punto del gate** y contra la sección que debe empacar (gatear a sección delgada = ✗) | §7.3.2, §7.3.4 |
| semilla | mostrar de dónde salió la dimensión inicial: pared (gates gruesos) o ½ pared (gates delgados); ancho = 2× espesor | §7.3.2 |

**R4.4.3** El pack time puede **invalidar un gate que ya pasó cortante y presión**: la UI debe permitir que la fila de t_freeze reprueba el conjunto aunque las otras dos estén en verde. §7.1.5 literal: "*the dimensions should be adjusted even if the shear rates and pressure drops were found acceptable*".

**3D:** el **vestigio** renderizado a escala sobre la pieza, cruzado con dos máscaras: superficies visibles (§7.1.3) y **superficies de acople del ensamble** (§7.1.3: "*any significant gate vestige may interfere with mating surfaces*" — no es solo estética, es función). Más el **cono de acceso de las pinzas** del operador, porque en el edge gate la longitud la fija la mano, no la física (§7.2.3).

**Checklist geométrico del tunnel gate** con los tres números dibujados en 3D: 45° al plano de partición, cono incluido ≥20°, ≥3 diámetros fuera del plano — **más la dependencia externa**: sucker pins presentes en el runner, o el degatado automático no existe (§7.2.7). Si faltan los sucker pins, el gate **no puede quedar en CALCULADO**, aunque toda su geometría pase. Y el modo de falla se declara: **desgaste progresivo** (pasa el tryout, falla en producción).

**Panel "no balancees con gates"** (§7.3.5): si el usuario intenta variar dimensiones de gate entre cavidades para balancear, la UI lo bloquea con la cita y redirige a ④ ALIMENTACIÓN.

---

## 3.5 VENTEO (cap 8)

**El entregable son DOS LISTAS**, y la pantalla debe hacerlas coexistir (§8.1 y §8.4):

```
╔ ⑥ VENTEO ═══════════════════════════════════════════════════════════════╗
║  CANDIDATOS 36        MAQUINADOS 8        RESERVADOS 28      §8.2.2       ║
║ ─────────────────────────────────────────────────────────────────────────║
║  ● final de flujo (plano)      4/4   ✓ los 4 SÍ van  §8.2.2               ║
║  ○ esquinas                    0/4   descartado: "flujo radial, no atrapa"║
║      ⤷ ⚠ §8.2.2 permite maquinarlos igual como SEGURO contra un cambio    ║
║        de molde futuro   [ maquinar de todos modos ]  costo +$180         ║
║  ● convergencia de frentes     3/3   → son EXPULSORES  §8.2.2             ║
║  ○ bolsas muertas (bosses,     1/20  ⚠ 19 con riesgo ACEPTADO y firmado   ║
║     topes de costilla,               (cada uno con su razón, §13.10)      ║
║     esquinas con recorte)                                                 ║
║ ─────────────────────────────────────────────────────────────────────────║
║  ✓ EL MOLDE ADMITE los 28 reservados sin rehacer placas  (verificado 3D)  ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**R4.5.1** El **espacio reservado** es un criterio de aceptación verificable en 3D, no una intención: §8.1 — "*ensure that the mold may accommodate additional vents when required*".

**Los números que contrastan:**

- **h_min (aire) vs h_max (rebaba) vs práctica recomendada**, los tres en la misma regla, con el ganador señalado:
```
  0.015 ── 0.02 ────── 0.06 ─────── 0.08 ──── mm
   │        │           │            │
   │    RECOMENDADO  h_min aire   h_max rebaba
   │    §8.3.1       §8.2.3       §8.2.3 (0.4·L_flash)
   Menges 2000               ⇒ MANDA EL MÁXIMO, no el mínimo §8.2.3
```
  y la nota de por qué la práctica (0.02) **contradice al cálculo** (0.06) y está bien: es steel-safe, se abre en el tryout (§8.3.1).
- **Tabla 8.1 con sus tres épocas** (Glanvill 1965 / Rosato 1986 / Menges 2000) y la **regla derivada** impresa: más presión de inyección + resina más fluida ⇒ vent más delgado. §8.2.3: no son opiniones, son épocas distintas del proceso.
- **El caudal NO se divide**: cada vent se dimensiona para **todo el flujo local** (62.5 cc/s completos, no 62.5/4). La UI muestra el cálculo con esa nota fija, porque "dividir entre el número de vents" es exactamente lo que haría cualquier implementación razonable y subdimensiona todo el molde. §8.2.3
- **Vent del expulsor = 0.065 mm a propósito** (claro diametral de taller 0.13 mm), más grueso que el recomendado, por tres razones que **no son de venteo**: fricción y pandeo del pin, imposibilidad de rebaba por flexión (va por acero sólido), y testigo en cara no estética. §8.3.2. La UI etiqueta ese número como **"deliberadamente holgado"**, o alguien lo va a "optimizar" y va a trabar el expulsor.
- **El contraste estrella de todo el capítulo**, que cruza con ⑩ ESTRUCTURAL: **deflexión de placas vs espesor de vent**. §12.1.2 da 0.36 mm de separación contra un vent de 0.02 mm ⇒ flash garantizado. Esa comparación va **en pantalla, con las dos cifras juntas**, en el subsistema de venteo Y en el estructural.

**3D:** cada vent con su **cadena completa**: vent delgado → canal de alivio → salida al exterior del inserto, y detección de choque del canal contra líneas de agua (§8.3.2: el vent cede el paso al agua alargándose "*to a location that is convenient*").

**Reglas de forma que la UI verifica:** transición cónica al barreno nominal en vents de expulsor (es para **armado**, no para aire — §8.3.2); sin transición suave en insertos venteados (no hay pin que guiar — §8.3.3); vents sinterizados **al ras y solo en superficies planas** porque su cara no se puede maquinar, y marcados como **no limpiables in situ** (§8.3.3).

**Recomendación económica automática:** cuando el usuario coloque un inserto venteado, la UI ofrece la **cuchilla expulsora** con la cita: "*could have been provided at lower cost while also facilitating the ejection… venting inserts are not especially common*" (§8.3.3).

---

## 3.6 ENFRIAMIENTO (cap 9)

El subsistema con más números simultáneos, porque es donde todo choca (§9.2.7). Bloques obligatorios:

**(a) Ciclo:** t_c por centerline (conservador y respaldado por teoría de flexión, §9.2.1 n.2) sobre **la sección más gruesa**, contra la regla de dedo 2·h², contra el valor con convección (+25 %), y contra el t_c del **runner** (que puede dominar el ciclo, §9.2.1). En family molds, los t_c de cada pieza lado a lado con el veredicto de negocio (§9.2.1: dos moldes es mejor física, pero se pierde color matching y ensamble a pie de prensa).

**(b) Potencia y refrigerante:** Q_moldings (piezas **+ runners fríos**), Q_line, V̇, ΔT_coolant contra 1 °C (0.1 °C en precisión), y **la verificación contra un controlador comercial real** — gasto, presión, rango de temperatura (Tabla 9.1). Si el requisito excede al controlador: "**se necesitan 2 controladores**" como salida explícita (§9.2.3).

**(c) Diámetro:** Dmin (ΔP) < D < Dmax (turbulencia), con **el catálogo de plugs DME como el que realmente manda** (§9.2.4: "*select a cooling line diameter that satisfies the above analysis **and is a standard size***"). Dos notas fijas: **solo la mitad de la presión del controlador es tuya** (§9.2.4) y **la longitud en serie se suma** (dos de 302 mm ⇒ L = 0.6 m).

**(d) Geometría:** 2D<H<5D (§9.2.5) y H<W<2H (§9.2.6), **modulados por la tolerancia del producto** (commodity 2–3×H, precisión 1×H). Junto: K_t = 3.3 a 1D / 2.6 a 4D ⇒ P_melt admisible por fatiga, con la sentencia de vida útil: "*the mold will likely not operate for a long life without developing cracks emanating from the cooling lines*" (§9.2.5).

**(e) Ruteo:** claro **≥ ½·D a TODO componente** — lista literal que el detector debe conocer: cavidad, insertos de cavidad y núcleo, **return pins**, guide pins, sprue bushing, tornillos, expulsores, canales de vent (§9.2.7, §8.3.2).

**(f) Usabilidad — el bloque de operador (§9.1.6), ver sección 6 de este pliego.**

**Overlays / mapas de color obligatorios:**

| Overlay | Qué muestra | § |
|---|---|---|
| `T_cara` | temperatura de la **cara moldeante**, no del bloque. Es lo que produce el alabeo. | §9.1.2, §9.2.6 |
| `Δgradiente` | diferencia núcleo↔cavidad **a través del espesor** (5 °C con P20/P20 → 1 °C con Cu 940 en el núcleo) | §9.3.4 |
| `uniformidad` | variación de flujo de calor vs pitch, con el punto de quiebre a W = 2H marcado | §9.2.6 |
| `choques` | halos de ½D y colisiones resueltas/no resueltas | §9.2.7 |
| `circuito` | esquema plano tipo metro con sentido, tapones numerados y conexiones externas | §9.3.1, §9.1.6 |

**Las tres trampas del capítulo, en la UI:**

1. **El cobre EMPEORA la uniformidad** (§9.2.6). Si el usuario cambia el material a Cu/Al y luego afloja el pitch, la UI bloquea con la cita: "*does not directly allow for a wider pitch and a reduced number of cooling lines*". La receta correcta se ofrece como acción: profundidad grande + pitch = 2× esa profundidad + material conductivo encima.
2. **Material por LADO, la simetría es anti-patrón** (§9.3.4). El selector de material es **doble** (núcleo / cavidad) y **advierte al simetrizar**: "*would not have been as uniform if both… were made from Cu 940*". Razón física impresa en el panel: la cavidad drena ~2× el calor que el núcleo.
3. **Alargar el ciclo no quita el gradiente** (§9.2.6). Si el pitch está flojo y alguien sube el tiempo de ciclo, la UI responde con la cita: "*does not reduce the temperature gradients… until the entire molded part approaches the coolant temperature*" y propone apretar el pitch.

**Selector de núcleos esbeltos** = Tabla 9.3 como filtro por Ø de núcleo y Ø de barreno, con **"baffle" preseleccionado** porque el "clearly preferred" del capítulo es baffle sobre cooling insert por disponibilidad, costo y riesgo (§9.3.5.2). Y el **conductive pin marcado como AISLANTE** a partir de cierto L/D (§9.3.5.5: "*act primarily as insulators*") — no como opción "baja pero válida".

**Regla del gasket:** cualquier expulsor dentro del área sellada = fuga garantizada ⇒ la UI lo detecta y propone **stripper plate** (§9.3.2).

**Two-shot:** el orden de los disparos es una decisión de enfriamiento; la UI compara 75.6 s vs 13.5 s y recomienda **la capa delgada al final** (§9.3.6), con la regla de §13.5: el segundo disparo **40 % más delgado**.

---

## 3.7 CONTRACCIÓN Y ALABEO (cap 10)

**El bloque de las 4 fuentes** — la encarnación pura del patrón receta-vs-medido:

```
╔ CONTRACCIÓN — s recomendada = 0.50 %  ⟨responsable del número: ____ §10.1.7⟩ ╗
║ FUENTE                       s        confianza   costo    quién      fecha  ║
║ ─────────────────────────────────────────────────────────────────────────── ║
║ ① Análisis PvT (este motor)  0.52 %   ○ nunca solo          motor    hoy     ║
║      §10.1.7 "should be used to VERIFY estimates from other sources"         ║
║ ② Proveedor / laboratorio    0.45 %   ◐ ¿probaron ESTE      Cycolac  12-jun  ║
║      material o uno "parecido"? ¿mismo espesor? §10.1.7                      ║
║ ③ Molde previo + moldeador   0.58 %   ● alta        —       Plásticos MX     ║
║      ⭐ ¿corriste en TUS condiciones preferidas, aunque las piezas            ║
║        salieran fuera de especificación?  §10.1.7   [ pedir corrida ]        ║
║ ④ Simulación                 0.49 %   ◐ mismos errores de material           ║
║      pero da el mapa NO UNIFORME por zona  §10.1.7                           ║
║ ─────────────────────────────────────────────────────────────────────────── ║
║ RANGO OPERATIVO  §10.1.6                                                     ║
║   inferior 0.31 %  ← pack largo, P=max(1.2·Pinj, 100 MPa)                    ║
║   superior 1.90 %  ← pack corto, P=min(0.4·Pinj, 30 MPa), T=(Tnf+Tm)/2       ║
║   ⚠ el superior es 6× el inferior → recomendar al moldeador PACK EXTENDIDO   ║
║     con presiones altas  §10.1.6                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**R4.7.1** El campo **"responsable del número"** es obligatorio antes de congelar. §10.1.7: "*In some contracts, the final shrinkage recommendation is the responsibility of the mold's customer… In other cases, no party is willing to accept responsibility… so the parties agree that a prototype molding project is necessary.*" Si nadie firma, la UI **propone el molde prototipo como salida contractual**, no como opción técnica.

**R4.7.2 — Las DOS escuelas de steel-safe, ambas ofrecidas** (§10.2.2):

```
 ○ ESCUELA A — STEEL SAFE ASIMÉTRICO      cavidad 0.4 % · corazón 0.6 %
   + el molde se puede agrandar si la pieza sale chica
   − GARANTIZA retrabajo: el nominal sale fuera de tolerancia a propósito
 ○ ESCUELA B — VALOR MEDIO CONSTANTE      cavidad 0.5 % · corazón 0.5 %
   + el nominal cae en tolerancia; se confía en que el moldeador ajuste
   − si la contracción real difiere, hay que meter acero (soldadura) = caro
   §10.2.2 "many mold designers prefer to use a constant but mid-range estimate"
```

Ninguna es el default del software. **El humano elige y firma** (§13.10).

**R4.7.3 — La segunda cara del steel-safe es de CRONOGRAMA** (§10.2.2): bosses, snap-fits y detalles críticos se dejan **semi-acabados** hasta después del tryout. Eso no es geometría: es una **capa de estado en el árbol de componentes** (`SEMI-ACABADO · se termina tras T-02`) y una **barra en la línea de tiempo del proyecto**. Ver P6.

**Alarma dura:** `s ≤ 0` **no es excelente, es una falla** — sin contracción positiva la pieza no se despega de la cavidad ni sale de costillas y bosses (§10.1.6). Ver §4.5.

**Alabeo — lo que se dibuja:**
- Mapa de contracción por zona (0.3 % delgado / 0.6 % grueso / >1 % cerca del fin de llenado, §10.2.1) sobre la pieza.
- **La topología decide, no el mapa** (§10.3.1): la UI clasifica la pieza como **área cerrada** (alabea, y aplica el criterio de pandeo `s_borde − s_centro > 0.44·(h/W)²`) o **marco con ventana** (mecánicamente desacoplado: solo alabea si lados **opuestos** difieren). Etiqueta visible: `TOPOLOGÍA: MARCO ABIERTO — desacoplado §10.3.1`.
- La deformada amplificada ×N con el **factor de amplificación impreso** y la advertencia de plausibilidad: §10.3.1 el propio autor descarta su resultado de 6.6 mm por irreal. La UI ofrece **"marcar resultado como implausible"** con razón — un juicio que se registra.

**Los tres niveles de mitigación en su orden** (§10.3.2), como tres pestañas y no como una lista revuelta: **1) molde** (multi-gate, feed balanceado, pitch apretado + insertos conductivos, y **exigir al diseñador de la pieza** espesor uniforme y fillets generosos) → **2) proceso** (llenar rápido; subir pack **hasta que el peso deje de aumentar** — criterio medible que va a la hoja de arranque; perfilar presión; **refrigerante a distinta temperatura por lado**) → **3) acero** (más gates; costillas someras; y al final **contornear la cavidad para que alabee hacia la forma correcta**, marcado como "**fuera del margen steel-safe, alto riesgo**").

**Nota de costo de la iteración tardía** (§10.2.1): pasar de manifold de 2 drops a 4 puede exigir manifold nuevo + barrenos nuevos en el lado A + **re-rutear el agua**. La UI cotiza esa consecuencia **antes** de recomendar "agrega gates".

---

## 3.8 EXPULSIÓN (cap 11)

**Simultáneos, y el orden importa porque el que manda no es el obvio:**

```
 F_eject = 12.4 kN   §11.2.2  (A_eff = sección transversal, NO área proyectada)
   ├ validación: 0.5 % del clamp; la máquina da ~2 %  → orden correcto ✓ §11.2.2
   └ 🏷 SESGO: análisis conservador → NO aplicar factor de seguridad encima §11.2.2

 ¿QUÉ RESTRICCIÓN MANDA?   ← la UI lo dice, no lo esconde
   compresión en el pin     Ø ≥ 0.80 mm   (σ_fatiga 450 MPa conservador / 800 real)
   CORTANTE EN LA PIEZA     Ø ≥ 2.23 mm  ◀ MANDA  §11.2.3
   pandeo Euler (L=210 mm)  Ø ≥ 1.90 mm
   §11.2.3: "driven more by the yield stresses exerted on the plastic molding"
   §11.3.1: "confirm the driving constraint" — cambia con el largo del pin

 ⚠ ESTO ES UN LÍMITE INFERIOR, no un diseño  §11.2.4
   "The mold designer can always add ejectors or increase the ejector size"
```

**Mapa 3D obligatorio: DÓNDE SE PEGA LA PIEZA.** §11.2.5 nombra el anti-patrón: "*A common but ineffective layout arises when ejector pins are uniformly distributed across the mold cavity*". Entonces la UI dibuja el **mapa de fuerza de agarre** (costillas y bosses que contraen sobre el corazón) y superpone los pines. Un layout uniforme sobre un mapa no uniforme **se ve mal de inmediato**; leído en una tabla, no.

**Otros números en pantalla:**
- Claro mínimo **1 diámetro de pin** entre barreno y superficie de cavidad (§11.2.5). Con 1 mm el libro rechaza su propio layout: barrenos ovalados, pines trabados, grietas.
- Claro de venteo 0.02 mm por 2–3 diámetros, escalón a diámetro mayor, **chaflán obligatorio** (o el pin se atora en la arista viva durante el ensamble) §11.2.6.
- Holgura mayor **0.5 mm** por stack-up de tolerancias de barrenado (~0.25 mm) §11.2.6.
- Pines: **mismo largo y mismo diámetro siempre que se pueda** §11.2.6.
- Blades: recorrido entre el hombro cónico y el barreno angosto **> carrera máxima** del sistema, o el moldeador atasca y destruye los blades (§11.3.2). Land = 2× el ancho del blade para minimizar EDM.
- Sleeves: **minimizar el claro de venteo** porque la concentricidad de la pared del boss depende del stack-up (§11.3.3) — nota el conflicto directo con venteo, que quiere claro.
- Stripper plate: actuación en **dos puntos alineados con el eje de las cavidades**, no uno central (§11.3.4).
- Core pull: F = P·A_proyectada con **P = 200 MPa conservador**; cilindro dimensionado a **10 MPa** (no a los 20.7 nominales) y **redondeado a cilindro estándar** (§11.3.6).
- Slide: ángulo ≤ **20°**, +25 mm de acople; y el reparto de fuerzas contraintuitivo — **el heel block aguanta, el angle pin solo mueve** (§11.3.7). Esto va dibujado con flechas de fuerza, porque leerlo no basta.
- Retorno: **positivo > resortes** con las 4 razones del libro; si resortes: pin de soporte cuando la longitud libre > 4× el diámetro, compresión ≤ 40 % de la longitud libre, fuerza ≈ ¼ de la de expulsión (§11.3.8).

**Overlay de WITNESS MARKS:** las marcas de cada componente proyectadas sobre la superficie de la pieza, cruzadas con la máscara estética y con las superficies de acople (§11.1.6: reducen calidad visual, **interfieren con superficies de ensamble** y **bajan resistencia estructural**). Y la acción de oro: **"hacer coincidir el testigo con una arista existente"** (§11.1.6) — la UI sugiere features candidatas.

**Modo ABUSO (§11.3.6, §11.3.7):** una vista de simulación donde el operador "curioso" mueve el slide a mano y el molde cierra. La UI verifica que **no se destruya nada**: "*molders greatly appreciate a robust mold design that can withstand intermittent abuse*". Salidas: resorte de compresión que mantiene el slide afuera, limit switches, y **switches en serie** si hay varios corazones (§11.3.7).

---

## 3.9 ESTRUCTURAL (cap 12)

**El bloque que define el límite (§12.1.1), con su prohibición impresa:**

```
 σ_limit = min( σ_yield / f , σ_endurance )
   ○ MÉTODO A   σ_yield  +  peor caso (200 MPa)
   ○ MÉTODO B   σ_yield/f +  presión esperada (100 MPa)      f: 1.5 …6.0 (hoist rings)
   ⛔ PROHIBIDO COMBINAR AMBOS — "should not jointly apply a factor of safety
      with the worst case scenario"  §12.1.1  → eso es SOBREDISEÑO §1.2

 VIDA DEL MOLDE  [ 1e6 ciclos ▾ ]   ← ENTRADA de diseño, no resultado
   acero P20: endurance 456 MPa (≈½ del yield)
   ⚠ ALUMINIO QC7 NO TIENE LÍMITE DE FATIGA §12.1.1
      1e3 → 545 MPa · 1e4 → 370 MPa · 1e6 → 170 MPa
      todo esfuerzo cíclico terminará por romperlo
```

**R4.9.1** El selector de acero muestra, junto al material, **"cambiar de acero NO reduce la deflexión"** — todos los aceros tienen E ≈ 200 GPa (§12.1.3). La deflexión solo se cambia con **geometría**. Es el error #1 que comete quien confunde resistencia con rigidez, y la UI tiene que atajarlo en el punto de decisión.

**El criterio de deflexión NO es un número abstracto: es el espesor del vent** (§12.1.2):

```
 δ_corazón 0.24 + δ_cavidad 0.12 = 0.36 mm de separación
 ────────────────────────────────────────────────────────
 vent especificado en ⑥:            0.02 mm
 ⇒ 18× el vent  →  FLASH GARANTIZADO  →  "The mold design must be improved" §12.1.2
 ⇒ y la rebaba DESGASTA el plano de partición: hay que resuperficiarlo §8.1.2
```

Esa comparación cruzada aparece **en las dos pantallas** (⑥ y ⑩) porque es donde el proyecto se cae y ninguna de las dos sola lo ve.

**Números simultáneos adicionales:** compresión de placa (y la excepción: **profundizar la cavidad** si hay tolerancia cerrada en el espesor de una pieza profunda, §12.2.1); flexión con **H efectivo que EXCLUYE el grueso de los corazones** (§12.2.2); área de soporte **restando cavidad, leader pins y guide bushings** (§12.2.1); cheek con `W > 2·H_cav·sqrt(P/σ)` y su deflexión **∝ H⁴** (§12.2.4); interlocks que duplican la rigidez del costado, con la advertencia de **no debilitar la pared al alojarlos** (§12.2.5); K nunca baja de 3 por lejos que pongas el agua (§12.2.6); hoop **con DOS cargas** — fatiga a presión de operación y **sobrepresión de un solo ciclo** contra el yield (§12.3.2); flexión de corazón **∝ H⁴** con ΔP a juicio (50 % corto / 10 % largo, §12.3.3).

**Pilares — la pantalla tiene tres cosas que nadie pondría:**
1. **El anti-patrón dibujado**: un pilar central grande "*will not greatly reduce the deflection*" y además choca con el knock-out rod central de la máquina (§12.2.3).
2. **La superposición**: δ_max ocurre **en el pilar o a media distancia entre pilar y riel**, no donde uno cree; se grafica δ(x) completa (§12.2.3).
3. ⭐ **PRE-CARGA**: fabricar el pilar **88.97 mm para que quede en 88.9 bajo carga** (§12.2.3). Es una cota con dos valores (fabricado / en operación) y se dibuja así en el plano. La deflexión no se elimina: se **cancela**.
   Y el remate económico: después de meter pilares, **regresar a adelgazar las placas** (§12.2.3).

**Ajustes y sujetadores — dos verificaciones que no son de tolerancia:**
- **Fuerza de inserción**: FN1 de Ø88.9 pide **808 kN = 180,000 lb**. La UI pregunta **"¿tu taller tiene prensa de esa capacidad?"** y si no, propone bajar a LN (§12.4.1).
- **Desarmabilidad para servicio**: un dowel LT3 en su **peor caso** de tolerancia (no el promedio) pide 50 kN ⇒ *"separation of the mold plates can not be accomplished manually"* (§12.4.3). Bandera de mantenimiento, no de cálculo.
- SHCS con el peor caso completo (§12.4.2): molde como bloque sólido, colgado de **un solo tornillo**, sujeto a **una sola platina**, con **ng = 10 por el choque de la grúa**. El resultado se redondea hacia arriba a medida comercial. Etiqueta: "*failure may result in loss of equipment or life*".
- Y siempre: **tornillos en altura**, sea LN o FN — los fits no retienen en Z (§12.4.1).

**Y la iteración de cierre, que es una arista del grafo:** §12.5 — "*the provision of fasteners may interfere with other subsystems of the mold including part ejection and mold cooling… iterative redesign of the mold may be required*" ⇒ lazo L7, y **la deflexión gana sobre el layout de expulsión** cuando es crítica: "*If mold deflection is a critical issue, then the ejector layout can be adjusted to provide space for several large support pillars*" (§12.2.3). Esa jerarquía **se propone en la UI, pero la firma el humano** (§1.2).

---

# 4. LOS PATRONES DE INTERACCIÓN QUE EXIGE EL LIBRO

## 4.1 Menú de opciones con trade-offs (la TARJETA DE DECISIÓN)

**Fundamento:** §3.2.2 — "*If necessary, the customer can be given more than one design to select the design that they think will ultimately be best*"; §3.5 — "*multiple cost estimates be developed for different mold designs **until an effective mold specification is established***". Y los catálogos de opciones con pros/contras del libro: Tabla 1.1 (feed), Tabla 6.2 (frío/3-placas/aislado/caliente/stack), Tabla 7.1 (10 tipos de gate), Tabla 9.3 (5 soluciones de núcleo esbelto), Fig 13.1 (el árbol de tecnologías).

**Anatomía obligatoria** (ya existe un germen en el código: `fp.criterion` + "Candidatos evaluados" en `MoldPanels.tsx` — se generaliza a TODA decisión):

```
╔ DECISIÓN D-03 · ARQUITECTURA DE ALIMENTACIÓN ══════════ criterio: costo/pieza a 500 k ╗
║                                                                                      ║
║ ★ GANADOR ─────────────────────────────────────────────────────────────────────────  ║
║   HOT RUNNER 8 CAV     $/pz 0.084   molde $71,400   ciclo 19 s   break-even 310 k pz ║
║   why: 20 % menos ciclo y 20 % menos scrap §6.3.3 · sin regrind · gatea al centro     ║
║   riesgos: inversión alta; "not all molders have the auxiliary equipment             ║
║            or expertise" §1.4.2; purga larga en cambio de resina                     ║
║                                                                                      ║
║ ○ 2-PLACAS FRÍO 4 CAV  $/pz 0.097   molde $28,900   ciclo 24 s                       ║
║   descartado: pierde por costo/pieza a este volumen                                  ║
║   ⚠ PERO: menor inversión, TODOS los moldeadores lo operan §6.4.1,                   ║
║           y §3.4.4 avisa que si el molde domina el costo/pieza, esto puede ganar     ║
║ ○ 3-PLACAS 8 CAV       $/pz 0.092   molde $47,100   ciclo 26 s                       ║
║   descartado: runner frío cada ciclo + daylight 558 vs 339 mm §6.3.3 Tabla 6.1       ║
║   y la tendencia declarada del mercado es ALEJARSE de 3 placas §1.4.3                ║
║ ○ STACK 16 CAV         $/pz 0.071   molde $186,000  ciclo 19 s                       ║
║   descartado: payback fuera del horizonte; "daunting to some molders" §6.4.1         ║
║                                                                                      ║
║ ⛔ VETOS NO ECONÓMICOS  §3.2.2 — pueden tumbar al ganador del break-even:            ║
║    ☑ el cliente hace cambios de color frecuentes → veta hot runner §6.4.8            ║
║    ☐ capacidad del moldeador: "maximize the molder's capability" §3.2.2              ║
║    ☐ estandarización lean del moldeador en un tipo/tamaño de molde                   ║
║    ☐ payback exigido por el moldeador                                                ║
║   ⚠ CON EL VETO DE COLOR ACTIVO, EL GANADOR CAMBIA A: 2-PLACAS FRÍO 4 CAV            ║
║                                                                                      ║
║ [ ENTREGAR AL CLIENTE 2 DISEÑOS ] §3.2.2   [ FIRMAR ELECCIÓN → P7 ] §13.10           ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
```

**Requisitos:**
- **R5.1.1** Los descartados **no desaparecen nunca**. Quedan en la tarjeta, con su razón, y se exportan al registro. El comprador va a preguntar (§3.1: "*prospective mold purchasers should ask about the details of the provided quotes*").
- **R5.1.2** Los **vetos no económicos** son casillas del humano y **recalculan el ganador en vivo**. §3.2.2 los enumera: cambios de color, capacidad del moldeador, estandarización lean, payback.
- **R5.1.3** "Entregar dos diseños al cliente" es un **botón real** que produce el paquete comparativo (§3.2.2).
- **R5.1.4** El break-even se grafica (costo total vs cantidad), porque §3.2.2 dice que a volúmenes intermedios el óptimo no es ni 2 ni 32 cavidades: hay que **ver** dónde se cruzan las curvas.
- **R5.1.5** Cada candidato lleva su `why` **en el lenguaje del libro y con §**, no un score. §6.4.5 rechaza explícitamente la caja negra: la optimización multivariable "*requires time to implement and validate while **hiding the details of the analysis from the designer***".

## 4.2 Plan de tryout — la cota que va a crecer (steel-safe)

**Fundamento acumulado:** §6.5.5 (runners: redondear **abajo** 1–2 tallas), §7.3.5 y §7.4 (gates: especificar chico, agrandar tras el tryout; **elegir el tipo por si se puede agrandar**), §8.3.1 (vents: arrancar en 0.02 mm y abrir), §10.2.2 (cavidad 0.4 / corazón 0.6, y **features semi-acabados**), §11.2.5 (pin contorneado con **múltiples ajustes de longitud**).

**R5.2.1 — La cota steel-safe tiene DOS valores y se dibuja distinto de una cota final.** En 3D:

```
        ┌──── cota FINAL ────┐          ┌──── cota STEEL-SAFE ────┐
        │                    │          │                         │
   ├────────── 12.70 ────────┤     ├────── 4.00 ▸▸ 4.60 ──────┤
        (línea llena, flecha         (línea llena hasta 4.00 +
         doble estándar)              PUNTEADO hasta 4.60 +
                                      doble flecha de crecimiento ▸▸
                                      + chip  SS-T01 )
```

En el **plano 2D** (§8 del pliego de taller):

```
   Ø4.00 ⌀ SS
   ┌──────────────────────────────────────────────┐
   │ STEEL SAFE — §6.5.5                          │
   │ Maquinar 4.00. Abrir hasta 4.60 máx tras     │
   │ tryout T-01 si ΔP feed > 50 MPa.             │
   │ NO maquinar 4.60 de origen: corregir hacia   │
   │ abajo exige pocket milling + inserto +       │
   │ soldadura + rehacer el feed.                 │
   └──────────────────────────────────────────────┘
```

**R5.2.2 — Pantalla P6 = el plan de tryout como documento entregable**, con tres tablas:

```
╔ P6 · PLAN DE TRYOUT ═════════════════════════════════════════════════════════╗
║ A) COTAS DELIBERADAMENTE CHICAS                                              ║
║  id     qué              maquinar  crece a   disparador de apertura      §   ║
║  SS-01  runner primario  4.00 mm   4.60 mm   ΔP feed > 50 MPa          6.5.5 ║
║  SS-02  gate G-1 edge    1.50 mm   2.00 mm   γ̇ > γ̇max o short shot     7.3.5 ║
║  SS-03  vents plano (8)  0.02 mm   0.06 mm   burn marks / short shot   8.3.1 ║
║  SS-04  cavidad          s=0.40 %  —         pieza chica → quitar acero 10.2.2║
║  SS-05  corazón          s=0.60 %  —         (par de SS-04)            10.2.2║
║  SS-06  pin contorneado  L nominal ±3 pasos  flash o compresión        11.2.5║
║                                                                              ║
║ B) FEATURES EN DESPLIEGUE POR ETAPAS  §10.2.2                                ║
║  bosses B1–B4, snap-fits S1–S2 → SEMI-ACABADOS hasta T-02                    ║
║  ⏱ impacto en cronograma: +9 días de construcción                            ║
║  ✓ beneficio: tolerancia final más cerrada, menor riesgo de desarrollo       ║
║                                                                              ║
║ C) QUÉ SE MIDE EN CADA TRYOUT (y a dónde regresa el dato)                    ║
║  T-01  peso de disparo vs pack (hasta que deje de subir §10.3.2) → ⑦        ║
║        ΔP real, short shots, burn marks → ③ ⑥                               ║
║  T-02  contracción medida por zona (acero vs pieza §10.1.7) → ⑦             ║
║        ⭐ pedir corrida en las condiciones PREFERIDAS del moldeador           ║
║           aunque las piezas salgan fuera de especificación §10.1.7           ║
║  T-03  ΔT del refrigerante entrada/salida, ciclo real → ⑧                   ║
║        marcas de expulsor, distorsión "push pin" → ⑨                        ║
║        flash en el plano de partición (¿deflexión? §12.1.2) → ⑩             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**R5.2.3** Todo lo que sale del tryout **entra por P9 y llena la tercera columna** (REAL) de cada subsistema. Ese es el circuito que cierra el patrón receta-vs-medido.

**R5.2.4 — Asimetría del steel-safe:** en hot runner, la UI **desactiva** la sugerencia de redondear hacia abajo y la sustituye por una advertencia: §6.2.3 — "*unlike a steel-safe designed cold runner system, **high costs may be incurred to reduce the diameters of a hot runner system***". El mismo patrón no vale igual en todos lados y la UI tiene que saberlo.

## 4.3 Sesgos declarados

**Fundamento:** §3.3.1.3 (volumen a remover = TODO el inserto; eficiencia de maquinado 25 %; tarifa **facturada**, no salario), §3.3.2 (ceiling(√n) infla el molde), §3.4.3 (clamp a 75 MPa sobre área proyectada — sobreestima con ventanas), §5.4 ("*all the models always over predicted the filling pressures*"), §9.2.1 n.2 (centerline por conservador), §11.2.2 (conservador **⇒ no sumar factor de seguridad**), §12.2.2 (carga puntual ⇒ +60 % sobre FEA), §12.3.1 (asumir que el cooling insert **no da soporte**), §8.2.3 (todo el aire por cada vent).

**R5.3.1 — El chip de sesgo.** Todo número con sesgo conocido lleva un chip clicable pegado, del mismo tamaño que el número, con tres datos: **dirección** (↑ sobreestima / ↓ subestima), **magnitud si el libro la da**, y **la razón citada**.

```
   ΔP llenado  96 MPa  🏷↑CONS       δ flexión  0.048 mm  🏷↑CONS +60 %
   ─────────────────────────         ────────────────────────────────────
   §5.4 todos los modelos            §12.2.2 carga puntual central vs
   sobre-predicen la presión →       distribuida; FEA da 0.024 mm.
   la pieza saldrá más gruesa        "on the correct order of magnitude
   de lo estrictamente necesario     and should lead to robust designs"
```

**R5.3.2 — Alarma de SESGOS APILADOS.** Cuando dos sesgos conservadores se multiplican sobre el mismo número, la UI lo grita, porque eso es literalmente lo que §1.2 y §12.1.1 prohíben:

```
 ⛔ SOBREDISEÑO APILADO — §1.2 + §12.1.1
    Estás usando σ_yield/6.0 (factor de seguridad) CON presión de peor caso 200 MPa.
    "the mold designer should not jointly apply a factor of safety with the
     worst case scenario"  →  elige UN método.     [ método A ]  [ método B ]
```

Otros apilamientos que la UI debe cazar: factor de seguridad sobre F_eject (§11.2.2 ya es conservador); worst-case de clamp con el área proyectada sin descontar ventanas (§3.4.3); ceiling(√n) + inserto agrandado "por si acaso" (§3.3.2 + §4.2.3).

**R5.3.3 — Todo coeficiente es sobreescribible por dato del taller**, y al sobreescribirlo el chip cambia de "DEFAULT DEL LIBRO" a "DATO DEL TALLER · fuente · fecha". Mandato repetido tres veces en §3.3, §3.3.1.3, §3.3.1.4: "*the negotiated machinist's rate should be used if this data is available*".

## 4.4 Iteraciones y demandas

Ya especificado en §1.2 (tarjeta de demanda). Se agrega:

**R5.4.1 — Historial navegable del proyecto** como línea de tiempo horizontal con **las demandas como eventos**, no como un log de texto:

```
 12-jul ●─────●──────●────────●───────●─────────●─────────▶
        │     │      │        │       │         │
        │     │      │        │       │         └ D-07 eyectores→agua  PENDIENTE
        │     │      │        │       └ D-06 gate→tipo de molde §7.3.4  ACEPTADA
        │     │      │        └ D-05 base 200→250  §4.3 (insertos↔base) ACEPTADA
        │     │      └ D-04 cotización #2: molde domina §3.4.4  ACEPTADA
        │     └ D-02 tolerancia crítica desafiada §2.2.3        RECHAZADA por cliente
        └ D-01 undercut boss horizontal §2.3.7                  RECHAZADA "función vital"
```

**R5.4.2** Cada evento del historial guarda el **estado congelado del molde antes y después** (diff de cotas), para poder contestar "¿por qué esta línea de agua está aquí?" seis semanas después.

**R5.4.3 — Fatal flaw.** §1.5 contempla que "*fatal flaws… may necessitate the scrapping of the mold and a complete redesign*". La UI tiene ese estado terminal en el proyecto, con su registro de causa. No es un error del software: es un desenlace del negocio y hay que poder anotarlo.

## 4.5 Alarmas contraintuitivas — "verde que en realidad es rojo"

**R5.5.1 — Estado visual propio, distinto de OK y de ERROR.** Tres estados no bastan. Se necesita un cuarto:

| Estado | Glifo | Color | Semántica |
|---|---|---|---|
| CUMPLE | ✓ | verde | pasa el criterio |
| ADVERTENCIA | ⚠ | ámbar | cerca del límite |
| VIOLA | ✗ | rojo | incumple |
| **PASA PERO REPRUEBA** | **◑** | **ámbar sobre verde (medio disco)** | **el número es "bueno" y por eso está mal** |

El glifo `◑` es deliberadamente raro para que el ojo se detenga. Cada `◑` **obliga** a texto de explicación y remedio; no puede existir sin ellos.

**Catálogo mínimo de alarmas `◑` (todas del libro):**

```
 ◑ CONTRACCIÓN s = 0.02 %  — casi cero, ¡NO es precisión!            §10.1.6
   Se NECESITA contracción positiva para que la pieza se despegue de la
   cavidad y quede en el corazón. s ≤ 0 = sobre-empaque: la pieza no sale
   de costillas ni bosses.  Remedio: bajar pack / revisar el rango §10.1.6.

 ◑ ΔP DE LLENADO = 31 MPa  — muy holgado, y eso REPRUEBA               §5.1
   "very low melt pressures are indicative of a poor molded part design":
   pared demasiado gruesa → material de más y ciclo largo.
   Remedio §5.1: ADELGAZAR la pared y poner costillas al 70 % §2.3.2.
   (Mismo criterio en el runner: el trapezoidal 6×8 se RECHAZA por dar ΔP baja §6.5.1)

 ◑ MOLDE = 71 % DEL COSTO POR PIEZA                                   §3.4.4
   "The large cost of the mold relative to the material and processing costs
    indicates that the mold may have been OVER DESIGNED."
   [ generar alternativa más barata y comparar ] ← acción automática §3.4.4,§3.5

 ◑ TODO EL MOLDE EN Cu 940 — peor que solo el núcleo                  §9.3.4
   "would not have been as uniform if both the core and cavity inserts
    were made from Cu 940". La asimetría del material corrige la asimetría
    térmica; simetrizar la reintroduce.

 ◑ MATERIAL CONDUCTIVO + PITCH FLOJO                                  §9.2.6
   El cobre AUMENTA la variación de flujo de calor. No autoriza menos líneas.
   Receta correcta: H grande + W = 2H + material conductivo encima.

 ◑ PIN CONDUCTIVO EN NÚCLEO L/D ALTO — está AISLANDO                  §9.3.5.5
   "the core pins prevent the flow of heat down the length of the core pins
    and act primarily as insulators."

 ◑ FACTOR DE SEGURIDAD + PEOR CASO                                    §12.1.1
 ◑ AJUSTE FN1 "CORRECTO" QUE PIDE 808 kN DE PRENSA                    §12.4.1
 ◑ DOWEL LT3 QUE NO SE DESARMA A MANO (50 kN peor caso)               §12.4.3
 ◑ DOS PINES EXPULSORES QUE DIFIEREN 0.4 mm                           §11.2.6
 ◑ SOBRE-DISEÑO GENÉRICO: el sistema no sabe y engordó el molde        §1.2
```

**R5.5.2** Toda alarma `◑` lleva **su acción**: no se puede cerrar sin decidir. Las opciones son siempre: aplicar el remedio del libro / aceptar con razón escrita (va al registro §13.10) / abrir arbitraje.

## 4.6 Registro de decisiones firmado (P7)

**Fundamento:** §13.10 — "*critical decisions about the mold design and related technologies **should be approved and documented between all the involved parties with a common understanding of the costs, benefits, and risks***." Reforzado por §2.2 (ruteo y aprobación de worksheets), §10.1.7 (responsabilidad del número de contracción) y §3.1 (el pago final se libera contra aceptación de la calidad de las piezas).

**Esquema de un asiento del registro (campos obligatorios):**

```
┌ REG-014 · Material del núcleo: Cu 940 en lugar de P20 ───────────────────┐
│ § que lo motiva     §9.3.4 (cavidad drena 2× el calor del núcleo)        │
│ ALTERNATIVAS        P20/P20 (5 °C de gradiente) · Cu/Cu (◑ peor) · baffle │
│ COSTO               +$3,850 USD inserto + $600 de desgaste anual         │
│ BENEFICIO           gradiente 5 °C → 1 °C · ciclo −1.4 s · alabeo −60 %  │
│ RIESGO              Cu 940 es más blando y se desgasta §9.3.4;           │
│                     aplica solo a volumen alto, presión baja-moderada    │
│                     y resina NO abrasiva §9.3.4                          │
│ SESGOS APLICADOS    ninguno                                              │
│ APROBACIONES        diseñador ✓ lgr@ 19-jul                              │
│                     moldeador ✓ Plásticos MX 22-jul                      │
│                     cliente final ⏳ pendiente                            │
│ RESPONSABLE DEL NÚMERO (si aplica §10.1.7)  —                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Requisitos:**
- **R5.6.1** Se genera un asiento **automáticamente** en: cada elección de tarjeta de decisión (§3.2.2), cada demanda aceptada o rechazada (§1.5), cada alarma `◑` aceptada, cada tolerancia desafiada y aceptada (§2.2.3), cada cota steel-safe (§6.5.5 et al.), cada riesgo de venteo aceptado (§8.2.2), y la recomendación final de contracción (§10.1.7).
- **R5.6.2** **Tres firmas posibles**: diseñador, moldeador, cliente final. §13.10 dice "*between all the involved parties*". El estado del proyecto muestra cuántos asientos están sin firmar.
- **R5.6.3** **Exportable como PDF anexo del contrato**, con el número de proyecto en cada página (§2.2.1: "*This number should be referenced in all documentation*").
- **R5.6.4** El registro es la fuente de la **hoja de arranque del moldeador** (P8) y del **plan de tryout** (P6): son vistas del mismo dato, no documentos paralelos.

---

# 5. LA VISTA DE CONFLICTOS Y ARBITRAJE (P5)

## 5.1 Por qué existe

§1.2 es explícito: el enfriamiento ideal quiere líneas pegadas y juntas; la expulsión quiere pines exactamente ahí; **"It is up to the mold designer to consider the relative importance of the conflicting requirements."** El software **no** decide. Detecta, cuantifica el daño de cada lado, y **cobra la decisión al humano**.

## 5.2 Catálogo de conflictos que la UI debe conocer por nombre

| # | Conflicto | § |
|---|---|---|
| C1 | Enfriamiento ↔ expulsión (pines donde van las líneas) | §1.2, §11.2.5, §11.1.5 |
| C2 | Agua ↔ **todo** (cavidad, insertos, return pins, guide pins, sprue bushing, tornillos) | §9.2.7 |
| C3 | Pilares de soporte ↔ expulsores y knock-out rod central | §12.2.3 |
| C4 | Fasteners (SHCS/dowels) ↔ expulsión y enfriamiento | §12.5 |
| C5 | Canales de vent ↔ líneas de agua | §8.3.2 |
| C6 | Cheek ancha (estructura) ↔ tamaño y costo de la base | §12.2.4, §4.2.3 |
| C7 | Rendimiento térmico ↔ manufacturabilidad (1 setup, cero sellos) | §9.2.7 |
| C8 | Gasket del cooling insert ↔ expulsores internos (fuga garantizada) | §9.3.2 |
| C9 | Stripper plate: punto estructural ↔ línea de testigo aceptable | §11.3.4 |
| C10 | Steel-safe asimétrico ↔ nominal dentro de tolerancia | §10.2.2 |
| C11 | Draft de eyección ↔ estética y volumen interno del producto | §2.3.6 |
| C12 | Vent grueso (aire) ↔ vent delgado (rebaba) | §8.2.3, §8.1.2 |
| C13 | Claro de venteo del sleeve ↔ concentricidad de la pared del boss | §11.3.3, §11.2.6 |
| C14 | Pines chicos y muchos (uniformidad, venteo) ↔ pocos y grandes (costo, mantenimiento) | §11.2.4 |
| C15 | Balanceo de llenado ↔ balanceo de packing (diámetros chicos congelan antes) | §6.2.4 |

## 5.3 La pantalla de arbitraje

```
╔ P5 · ARBITRAJE ══════════════════════════════════ 3 conflictos abiertos ═════╗
║                                                                              ║
║ ┌ C1-a  ENFRIAMIENTO ⚔ EXPULSIÓN   §1.2 · §11.2.5 ────────────────────────┐  ║
║ │                                                                         │  ║
║ │  ┌──────── VISTA LOCALIZADA ─────────┐  el conflicto en el punto        │  ║
║ │  │  costilla R-3, corte X = 41.5 mm  │  exacto (no el molde entero)     │  ║
║ │  │   ○ pin E-07 Ø4.5                 │  cámara: aislar {C-4, E-07,      │  ║
║ │  │   ═ línea C-4 Ø6.35               │  núcleo}, vista FRE, rayos X     │  ║
║ │  │   ░ traslape 1.38 mm              │  (mismo contrato que auditMold)  │  ║
║ │  └───────────────────────────────────┘                                  │  ║
║ │                                                                         │  ║
║ │  SI GANA EL AGUA (mover/quitar pin)      SI GANA LA EXPULSIÓN            │  ║
║ │  ─────────────────────────────────       ────────────────────────────    │  ║
║ │  σ_cortante en la pieza 1.18× límite     ΔT de cara +3.1 °C              │  ║
║ │    → distorsión "push pin" §11.2.3       ciclo +1.9 s → +$0.006/pz       │  ║
║ │  la costilla se pega y no despega        gradiente 2 → 5.1 °C            │  ║
% │    §11.2.5                                 → alabeo estimado +0.9 mm §10.3.1║
║ │  riesgo: pieza deformada / rota          riesgo: pieza fuera de plano    │  ║
║ │                                                                         │  ║
║ │  ⚖ PRIORIDAD RELATIVA (la asignas TÚ — §1.2 dice que es tu decisión)     │  ║
║ │     AGUA  ◄──────────────●──────────────►  EXPULSIÓN                     │  ║
║ │                    (actual: expulsión 60/40)                             │  ║
║ │                                                                         │  ║
║ │  TERCERAS VÍAS QUE EL LIBRO OFRECE                                       │  ║
║ │   ○ bajar Ø del pin 4.5→3.5 para que quepa la línea      §11.2.5        │  ║
║ │   ○ agrandar inserto + base (caro pero a veces justificado) §9.2.7(1)   │  ║
║ │   ○ alejar líneas manteniendo el ratio pitch/profundidad  §9.2.7(2)     │  ║
║ │     ⚠ "poor cooling performance… but quite common": 1 setup, sin sellos │  ║
║ │   ○ más líneas de menor diámetro                          §9.1.4        │  ║
║ │   ○ inserto conductivo SOLO en el núcleo                  §9.3.4        │  ║
║ │                                                                         │  ║
║ │  [ RESOLVER Y FIRMAR → REG-0xx ]     [ ESCALAR AL MOLDEADOR ] §2.2.1     │  ║
║ └─────────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Requisitos:**
- **R6.1** El conflicto se muestra **localizado en 3D** (aislar los 2–3 componentes en pugna, vista sugerida, rayos X). Ya existe el contrato: `Finding.camera = { isolate, view, xray }` en `mold-audit.ts`. **El arbitraje reutiliza ese contrato.**
- **R6.2** **Ambos lados muestran su daño cuantificado en la misma unidad de consecuencia** (esfuerzo vs límite, °C, segundos de ciclo, dólares por pieza, mm de alabeo). Un conflicto sin costo de cada lado es una discusión, no una decisión.
- **R6.3** El control de prioridad es un **peso explícito y persistente**, no un botón "resolver". El peso se guarda por proyecto y **puede pre-sembrarse** desde el intake: si la Tabla 2.6 trae tolerancia crítica, el peso arranca sesgado a enfriamiento/uniformidad (§9.2.6 dice literal que la tolerancia modula el pitch).
- **R6.4** **Terceras vías del libro siempre presentes.** Un conflicto casi nunca es binario: §9.2.7 da dos estrategias de rescate y §11.2.5 una tercera. La UI las lista con su costo.
- **R6.5** Resolver **firma un asiento** en P7 (§13.10) y, si aplica, **emite una demanda** al subsistema perdedor (que pasa a `IMPUGNADO`).
- **R6.6 — Conflictos que el libro YA arbitró** vienen con recomendación por default y su cita, pero **siguen siendo editables**:
  - C3: si la deflexión es crítica, **el layout de expulsores cede ante los pilares** (§12.2.3).
  - C8: expulsor dentro del gasket ⇒ **stripper plate** (§9.3.2).
  - C12: **"fewer and smaller vents are preferred"** (§8.1.2).
  - C9: si el testigo no se puede acomodar, **pedir rediseño de la pieza** es salida legítima (§11.3.4).
- **R6.7** **El escalamiento respeta el ruteo de §2.2.1**: lo trivial al ingeniero de aplicaciones interno; lo de fondo al cliente. El botón de escalar pregunta a quién y precarga el mensaje.

---

# 6. USABILIDAD DE TALLER — requisitos de UI de PLANOS y REPORTE

§9.1.6 es literal sobre esto y no habla de geometría: habla de que el operador no se equivoque. Estos requisitos aplican a **lo que se imprime y a lo que se ve en pantalla**, no al sólido.

## 6.1 Agua (§9.1.6, §9.3.1)

- **R7.1** **Contador de conexiones externas por mitad**, siempre visible, con semáforo: **≤2 verde (1 in + 1 out), >2 ámbar**. Literal: "*preferably two (one inlet and one outlet) per mold half*".
- **R7.2** Si hay >2, la UI **obliga** a etiquetas `IN` / `OUT` — y las etiqueta en tres lugares: el modelo 3D (texto grabado en la cara del molde), el plano, y el diagrama de circuito. Razón citada: "*to help the operator avoid forming a dead circuit*".
- **R7.3** **Verificador de circuito muerto**: recorre el grafo del agua y prueba **todas** las permutaciones de conexión que el operador podría hacer. Si alguna deja un ramal sin flujo, es un hallazgo `CRÍTICO`. §9.1.6.
- **R7.4** **Diagrama de circuito tipo metro** (esquema plano, no isométrico) como página propia del paquete: entradas, salidas, tapones numerados, sentido del flujo, longitud en serie acumulada, y ΔP por tramo. Es lo que el operador pega junto a la máquina. Motivado por §9.3.1 (manifold interno = "*very little added cost while delivering both increased performance and **ease of use***", con lean manufacturing citado explícitamente).
- **R7.5** **Verificación de componentes rebajados**: nada externo debe sobresalir del plano de la placa. "*all external components should be recessed to avoid direct contact with tie bars, work tables, or other items*" (§9.1.6). Se verifica en 3D contra el plano de la platina y contra las tie bars, y se **reporta como cota** en el plano ("plug JP-251 rebajado 3 mm").
- **R7.6** El ancho que se compara contra las tie bars **incluye plugs y conectores de hot runner**, menos holgura de inserción (§4.3.3). El plano lleva esa cota con la nota.

## 6.2 Expulsores (§11.1.7, §11.2.6)

- **R7.7** **Cada pin tiene clave** (`E-01`…`E-14`) y esa clave aparece **en cuatro lugares idénticos**: el 3D, el plano del inserto, la **placa retenedora** (grabada, marcada en el plano) y la lista de partes. Literal: "*key and label each ejector pin **and matching location on the ejector retainer plate***".
- **R7.8 — Detector de pines casi-iguales.** Tabla de expulsores ordenada por (Ø, L, tipo, contorno) con marca roja cuando dos difieren por debajo de un umbral configurable (default 1.0 mm en Ø o L, o contornos distintos con misma sección). §11.2.6: "*always avoid designing ejector pins that vary only slightly in their design, since similar pins may accidentally be considered interchangeable by the molder. The incorrect assembly… may cause damage to the pins as well as the opposing mold cavity surfaces.*" Acción ofrecida: **unificar** (mismo largo y diámetro siempre que se pueda, §11.2.6) o **diferenciar visiblemente** (clave grabada + contorno distinto).
- **R7.9** Los pines **contorneados** llevan cota de **orientación angular** (plano en la cabeza, ranura paralela, dowel localizador) — §11.2.6 — igual que las **ranuras de los sucker pins** del runner (§6.5.2, o el runner se traba y muere el ciclo automático).
- **R7.10** Cotas de ensamble obligatorias en el plano: claro de venteo 0.02 mm por 2–3 diámetros, escalón, **chaflán** en la transición (o el pin se atora en la arista viva), chaflán generoso en la interfaz inserto↔placa de soporte, y **holgura 0.5 mm** en las placas por stack-up (§11.2.6).

## 6.3 Servicio y mantenimiento (transversal)

- **R7.11 — Hoja de SERVICIO** en el paquete, generada de la geometría, con cuatro columnas:

```
 QUÉ SE DESARMA A MANO      placas A/B, retenedor            §12.4.3 verificado
 QUÉ NECESITA PRENSA        inserto de cavidad FN1: 808 kN   ⚠ ¿tienes prensa? §12.4.1
 QUÉ SE REEMPLAZA           gibs (con lubricidad), wear plates §13.9.1
                            insertos de vent sinterizado (no se limpian in situ) §8.3.3
 QUÉ SE LIMPIA CADA CORRIDA vents (se tapan RÁPIDO con desmoldante) §8.1.3
                            ⤷ "incorporating vent cleaning as part of a preventive
                               maintenance program"  §8.1.3
```

- **R7.12** Marcar en el plano los vents **autolimpiables** (los de expulsor: "*the actuation of the ejector serves to at least partially clear the venting channel*" §8.3.2) vs los que exigen limpieza manual. Es información de mantenimiento que solo se puede dar en el plano.
- **R7.13** Los **candidatos de vent reservados** (los 28 que no se maquinaron) van dibujados en el plano en **línea fantasma**, con su cota lista. §8.2.2 y §8.4: el molde debe admitirlos sin rehacer placas, y el que los abra dentro de dos años necesita saber dónde iban.

## 6.4 Hoja de arranque del moldeador (documento del paquete)

Sale del registro y del plan de tryout. Contenido obligatorio, todo con §:

```
 ARRANQUE — PRJ-2417                                    molde 2417 · rev C
 ─────────────────────────────────────────────────────────────────────────
 T_melt       239 °C   (mid-range del proveedor: tienes margen arriba
                        y abajo a propósito)                    §5.5.1, §10.1.1
 T_molde      punto medio del rango de refrigerante             §10.1.1
 P_pack       inicial 80 % de la presión de llenado = 77 MPa    §10.1.2
              perfilar: alto al inicio, bajar al congelar
              cerca de la puerta                                §10.2.3
 Fin de pack  cuando el PESO DE LA PIEZA DEJE DE AUMENTAR       §10.3.2
              (freeze-off del gate ≈ 1.1 s calculado, pero la
               ecuación da MÍNIMOS: espera más)                 §7.3.4
 Tonelaje     294 t requeridas (conservador: el área proyectada
              no descuenta la ventana)                          §3.4.3, §5.5.3
 Ciclo        19 s esperado; enfriamiento ≈ mitad del ciclo     §9.2.1
 Refrigerante ΔT objetivo ≤ 1 °C; V̇ = 1.1e-3 m³/s; verificado
              contra controlador VacTherm                       §9.2.3
 Conexiones   2 por mitad, etiquetadas IN/OUT (ver esquema)     §9.1.6
 Secuencia    limit switches: core pull retraído → apertura;
              slides afuera (switches EN SERIE); reset de
              expulsores confirmado antes de cerrar             §11.1.1, §11.3.7, §11.3.8
 Rechazo      quemaduras en superficie estética → RECHAZAR pieza §8.1.1
              rebaba persistente → PARA: desgasta el plano       §8.1.2
 ─────────────────────────────────────────────────────────────────────────
 SI NO LLENA (en este orden §5.2.1): sube T_molde y T_melt → agranda runners →
 resina de menor viscosidad → y hasta el final, cambio físico del molde.
 SI LLENA MUY FÁCIL: baja temperaturas y sube velocidad para acortar ciclo.
```

## 6.5 Reglas de plano heredadas de otros capítulos

- **R7.14** La **cota de compra** del inserto (altura total con el corazón) va en la lista de materiales; la **cota de diseño** (respaldo→plano de partición) va en el plano del inserto. **Son dos números distintos con el mismo nombre** y confundirlos compra acero de menos (§4.2.1).
- **R7.15** El estado **flush / slightly proud** de la cara del inserto respecto a las placas A/B es una **nota de plano**, no una tolerancia: §4.2.1 exige redondear hacia arriba y quedar a ras o ligeramente sobresaliente.
- **R7.16** La **pre-carga del pilar** se acota con sus dos valores: `FABRICAR 88.97 / EN OPERACIÓN 88.90` con la nota §12.2.3.
- **R7.17** Los diámetros de runner y de línea de agua llevan **la herramienta o el plug de catálogo** al lado (broca de 1/4″, plug DME JP-251), y si el valor es no-estándar, la **justificación** obligatoria (§6.5.4, §9.2.4).
- **R7.18** Toda página lleva **el número de proyecto** (§2.2.1).

---

# 7. LOS 10 ⭐ ELEMENTOS DE UI QUE NADIE DISEÑARÍA MIRANDO SOLO LA LISTA DE FEATURES

> Criterio de selección: si sale de una lista de features de CAD/CAM, no entra. Solo entran los que salen del libro y **contradicen** lo que haría una implementación razonable.

### ⭐1 — El switch RESTRICCIÓN / SALIDA en cada campo del intake
**§2.2.2.** Cualquiera construye un formulario donde el tiempo de ciclo es un input. El libro dice que ese mismo campo puede ser **una restricción que el cliente impone** o **un resultado que nosotros optimizamos**, y que si no viene, "*the mold designer should perform iterative design with cost analyses*". Un solo interruptor cambia el sentido del programa entero: en RESTRICCIÓN el motor valida contra él; en SALIDA el motor lo produce. Nadie lo diseñaría sin haber leído §2.2.2.

### ⭐2 — La cota de doble valor: DISEÑO vs COMPRA, y FABRICADO vs EN OPERACIÓN
**§4.2.1 y §12.2.3.** Dos casos donde una sola cota es una mentira:
- Altura del inserto: la de diseño va del respaldo al plano de partición; la de **compra y cotización** incluye el corazón que sobresale. Un pipeline con un solo número compra acero de menos.
- Pilar de soporte: se **fabrica en 88.97 mm** para que bajo presión de inyección quede en 88.90 y **la cavidad quede plana**. La deflexión no se elimina: se cancela.

La UI necesita un tipo de dato "cota con dos valores y una razón", y dibujarlo distinto. Un CAD normal no tiene eso.

### ⭐3 — La cota que va a crecer (steel-safe dibujado, no anotado)
**§6.5.5, §7.3.5, §8.3.1, §10.2.2, §11.2.5.** Un optimizador resuelve para γ̇max y entrega el diámetro exacto. Kazmer entrega **el más chico a propósito**, y hasta **elige el tipo de gate por si se puede agrandar**. La UI necesita: una cota con punteado de crecimiento y doble flecha, un chip `SS-nn`, un disparador de apertura declarado, y la advertencia asimétrica de que **en hot runner esto no aplica** (§6.2.3). Y su segunda cara, que es de cronograma: bosses y snap-fits **semi-acabados** hasta el tryout (§10.2.2) como estado del árbol de componentes y barra en el calendario.

### ⭐4 — El contador de conexiones + el diagrama de agua tipo metro con IN/OUT
**§9.1.6.** Ningún CAD cuenta conexiones externas. El libro pone un número: **dos por mitad**, y si hay más, **etiquetadas** para que el operador no arme un circuito muerto — más el verificador que prueba todas las permutaciones de conexión que un humano cansado podría hacer. Esto es diseño de interfaz para una persona que no va a abrir el software nunca.

### ⭐5 — El detector de pines casi-iguales
**§11.2.6.** "*always avoid designing ejector pins that vary only slightly in their design, since similar pins may accidentally be considered interchangeable by the molder*". Es una regla de diseño motivada por **error humano**, no por física. La UI la implementa como una tabla ordenada con umbral de similitud y dos acciones: unificar o diferenciar. Ningún generador de listas de partes lo haría.

### ⭐6 — El chip de sesgo, con dirección y magnitud — y la alarma de sesgos apilados
**§3.3.1.3, §5.4, §9.2.1 n.2, §11.2.2, §12.2.2, §12.3.1 / §1.2, §12.1.1.** El libro no esconde que sus métodos sobre-predicen: dice **cuánto** (carga puntual +60 % sobre FEA), **por qué** (conservador), y **prohíbe apilar** ("*should not jointly apply a factor of safety with the worst case scenario*"). La UI muestra el sesgo pegado al número, y grita cuando dos se multiplican. Es lo contrario de lo que hace todo software de ingeniería, que presenta el número desnudo.

### ⭐7 — El estado `◑` PASA PERO REPRUEBA
**§10.1.6, §5.1, §3.4.4, §1.2, §9.2.6, §9.3.4, §9.3.5.5.** Contracción cero se ve como precisión y es **una pieza que no se puede expulsar**. ΔP baja se ve como margen y es **pared engordada**. Un molde carísimo se ve como calidad y es **la señal de sobrediseño** (§3.4.4). Todo cobre se ve como el máximo enfriamiento y es **peor que cobre solo en el núcleo**. Se necesita un cuarto estado visual, con glifo propio, que no se puede cerrar sin decidir.

### ⭐8 — Los candidatos DESCARTADOS que nunca se borran, con sus vetos no económicos
**§3.2.2.** El software promedio muestra el resultado. El libro entrega un **menú**, dice que se le pueden dar al cliente **más de un diseño**, y enumera factores que **vetan al ganador del break-even**: cambios rápidos de color, capacidad y preferencia del moldeador, estandarización lean. Las casillas de veto **recalculan el ganador en vivo**, y los perdedores quedan visibles con su razón porque el comprador va a preguntar (§3.1).

### ⭐9 — El panel "esto abarata TU molde" (aunque nos baje el ticket)
**§2.2.4.** *"a mold designer may understand that the cost of the mold could be reduced… but remain silent to justify… a higher priced mold… it is a losing long term strategy."* Es una política de negocio que solo existe si tiene **su propio panel en la pantalla del cliente**, con el ahorro para él y el costo para nosotros impresos lado a lado. Ninguna máquina que optimice margen llega ahí — y por eso hay que ponerlo en la UI, no en un manual.

### ⭐10 — El comparador de las 4 fuentes de contracción, con su RESPONSABLE
**§10.1.7.** Cuatro fuentes en la misma tabla (motor / proveedor / molde previo+moldeador / simulación), con confiabilidad y costo, la advertencia de que **el análisis nunca decide solo** ("*should be used to verify the shrinkage estimates coming from other sources*"), el botón ⭐ **"pedir corrida en las condiciones preferidas del moldeador aunque las piezas salgan fuera de especificación"**, y un campo obligatorio: **quién responde por el número**. Si nadie firma, la salida no es un número: es "hace falta un molde prototipo" como acuerdo contractual.

**Casi entran (implementarlos también):** el ruteo trivial→ingeniero interno / de fondo→cliente para proteger la relación (§2.2.1); el **modo abuso** que simula al operador curioso moviendo el slide (§11.3.6-7); el radio de fillet elegido **del catálogo de cortadores** en vez de un número redondo (§2.3.4); el **pin conductivo marcado como AISLANTE** por L/D (§9.3.5.5); la pregunta "**¿tu taller tiene prensa de 808 kN?**" antes de aprobar un FN1 (§12.4.1); y el "**¿se desarma a mano para dar servicio?**" del dowel LT3 en peor caso (§12.4.3).

---

# ANEXO — Anclaje al código existente (para que esto sea construible mañana)

| Requisito del pliego | Ya existe | Archivo |
|---|---|---|
| Regla → sustitución numérica → resultado (rojo si viola) | `CalcRows` / `CalcPaso` | `/home/ian/Orkesta/la-forja/src/forja/brep/MoldPanels.tsx` |
| Hallazgo con cámara sugerida (aislar + vista + rayos X) → **la reutiliza el arbitraje P5** | `Finding { sev, check, role, detail, camera }` | `/home/ian/Orkesta/la-forja/src/forja/mold/mold-audit.ts` |
| Candidatos evaluados con criterio (germen de la tarjeta de decisión ⭐8) | `fp.criterion` + bloque "📋 Candidatos evaluados" | `/home/ian/Orkesta/la-forja/src/forja/brep/MoldPanels.tsx` |
| Variantes 2/3-placas × cavidades + break-even + veredicto | `moldMachine()` → `{ variantes, breakEven, veredicto }` | `/home/ian/Orkesta/la-forja/src/forja/mold/moldmachine.ts` |
| Intake mínimo + presets (base del P1) | `MoldMachinePanel` con `MachineSpec` y `feedPref` | `/home/ian/Orkesta/la-forja/src/forja/mold/MoldMachinePanel.tsx` |
| Estudio por placa, t_c local, FEA, estructural (columna "ESTE MOLDE") | `MoldTreePanel` | `/home/ian/Orkesta/la-forja/src/forja/brep/MoldPanels.tsx` |
| Paquete de planos (base del P8) | `mold-plano-set.ts`, `mold-drawing-set.ts`, `mold-drawings.ts` | `/home/ian/Orkesta/la-forja/src/forja/mold/` |

**Lo que NO existe y este pliego pide construir:** el grafo con estados de congelamiento (P2), la bandeja de demandas (P2b), el switch restricción/salida por campo (P1), la tercera columna REAL-MEDIDO alimentada desde el tryout (P9), el arbitraje con prioridad asignable (P5), el plan de tryout como documento con cotas de doble valor (P6), el registro firmado (P7), y los cuatro estados visuales con `◑` incluido.