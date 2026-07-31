# PLIEGO CAM — el maquinista es el cliente (2026-07-31)

> **Ejercicio:** los autores de los manuales son el CLIENTE. Siempre hicieron esto A MANO y ahora
> nos piden el software. Aquí el cliente es el **maquinista / programador CNC** del taller LATAM
> que va a maquinar las placas, insertos, barrenos y cavidades que La Forja ya genera.

## Fuentes leídas (íntegras) y qué aporta cada una

| # | Documento | Qué es realmente | Qué aporta al pliego |
|---|---|---|---|
| F1 | `manuales/P1_22_the-nist-rs274ngc-interpreter-v3-nistir-6556-g-c.pdf` — NISTIR 6556, Kramer/Proctor/Messina, 2000-08-17 | La **especificación formal** del G-code RS274/NGC + el manual completo del intérprete | §3 completa: gramática, grupos modales, orden de ejecución, sistemas de coordenadas, compensación de radio, ciclos fijos, y **la lista de errores que un intérprete DEBE rechazar** |
| F2 | `10-HERRAMIENTA DE CORTE PARA MAQUINADO.pdf` (Weston Tools, capítulo 10, págs. 146–170) | **Catálogo de distribuidor**, no manual de proceso | La base de datos de herramienta real disponible en México: Ø, largo de corte, largo total, zanco, # de filos, hélice, recubrimiento, tope de dureza (HRC), materiales recomendados, geometría de inserto ISO |
| F3 | `manuales/P2_34_nptel-lecture-27-sheet-metal-working-bending-spr.pdf` — NPTEL/IIT Kharagpur, Prof. R. N. Ghosh | Lección de **deformación plástica** (no de doblado de lámina propiamente) | Flow stress, Zener–Hollomon, trabajo frío vs caliente, recristalización a 0.5·Tm, workability por diagrama de fases, y la definición de la **razón de deformación en maquinado** |
| F4 | `manuales/P2_33_din-6935-k-factors-bending-information-for-solid.pdf` — DB Sheetmetals Ltd | Tabla de factores K **medidos en un taller real** + guía de doblado | Tablas K por material/espesor/radio, tipos de doblado (aire/fondo/acuñado), springback, y las reglas DFM duras de lámina |
| F5 | `manuales/P1_23_ketiv-autodesk-virtual-academy-sheet-metal-unfol.pdf` — KETIV AVA, "Sheet Metal Unfold Rule Equations" | Las **ecuaciones** del desdoblado, con derivación | BA / BD / setback / K, DIN 6935 K_DIN, Lockheed, Machinery's Handbook, tablas de bend deduction |

**Regla de redacción:** cada requisito cita su fuente. Lo que NO está en los manuales va marcado
**⟨EXTENSIÓN DECLARADA⟩** con el hueco explícito. **No se inventa un solo número de corte.**

---

## 0. LOS SIETE AXIOMAS DEL MAQUINISTA

| # | Axioma | Fuente |
|---|---|---|
| **M1** | **El G-code es un contrato, no un dibujo.** Toda entrada no permitida explícitamente es ilegal y se rechaza. *"Any input not explicitly allowed is illegal and will cause the Interpreter to signal an error."* | F1 §3.3 |
| **M2** | **El orden dentro de la línea es de SEGURIDAD, no de estilo.** *"The order of execution of items on a line is critical to safe and effective machine operation."* Refrigerante antes de mover, cambio de herramienta antes de encender husillo, movimiento hasta el paso 20 de 21. | F1 §3.8, Tabla 8 |
| **M3** | **Callar un error geométrico es peor que fallar.** El intérprete NIST rechaza esquina cóncava donde la fresa no cabe; *"other controllers… often allow these errors silently and either gouge the part or round the corner."* | F1 App. B.5.1 |
| **M4** | **La máquina obedece; el error de juicio es del programador.** El intérprete NO revisa sobre-recorrido de ejes, ni avances/velocidades excesivas, ni *"machining a fixture"*. Eso lo tenemos que revisar NOSOTROS. | F1 App. A |
| **M5** | **El estado es modal y persiste — hasta que M2/M30 lo resetea.** Un programa que asume el estado anterior es una colisión esperando su turno. | F1 §3.3.7, §3.4, §3.6.1 |
| **M6** | **El número de fábrica no sustituye al número medido.** Para K de doblado: *"The only truly effective way of working out the correct bend allowance is to reverse engineer it by taking a measured strip of material, bending it, and then measuring it."* | F4 |
| **M7** | **La herramienta que existe en el cargador manda sobre la que quisieras.** El catálogo es finito: hay Ø, largo de corte y hélice concretos, y con esos hay que salir. | F2 (todas las tablas) |

---

# 1. EL PROCESO A MANO DEL MAQUINISTA

## 1.1 La secuencia real de decisiones (del plano al fierro)

Esta secuencia NO viene escrita como lista en ningún manual — está **implícita** en la estructura de
F1 (el orden de ejecución, la tabla de herramientas, los ciclos fijos) y en la organización de F2
(desbaste → semiacabado → acabado → rimado/escariado → rebabeo). La marco como reconstrucción
declarada, con la evidencia que la sostiene.

```
0. LEER EL PLANO Y DECIDIR EL DATUM
   └─ ¿desde dónde se cota todo? → ese es el origen del sistema de coordenadas de trabajo
      (G54…G59.3). F1 §3.2.2: hay UN sistema absoluto de máquina y NUEVE de programa.
      El absoluto no se puede seleccionar directamente — solo se llega con G53.

1. DECIDIR EL BLOQUE DE PARTIDA
   └─ material, sobre-medida, y si viene rectificado o en bruto.
      Kazmer §3.3.1.3 supone (conservador, declarado) que se remueve TODO el volumen
      del inserto. En el taller real se parte de placa a medida.

2. DECIDIR CUÁNTOS SETUPS  ← LA decisión cara
   └─ cada setup = re-referenciar = acumular error. Todo lo que comparte una cara
      se hace en un solo amarre. El indicio en F1: existen NUEVE sistemas de coordenadas
      de programa precisamente porque una pieza puede vivir en varias posiciones/
      fixturas dentro del mismo programa (§3.2.2, §3.5.5 G10 L2 P1..P9).

3. SUJETAR (work holding)
   └─ la sujeción define qué caras son inalcanzables → define el setup siguiente.
      F1 App. A avisa que el intérprete NO detecta "machining a fixture" — o sea:
      el modelo de la mordaza/bridas es responsabilidad del CAM, no del control.

4. DESBASTE (roughing)
   └─ quitar masa rápido, dejar sobre-material parejo (stock to leave).
      F2 tiene familia dedicada: "Cortador para Desbaste" — Co M42 y AlTiCrN,
      "realiza un despeje suave y pequeñas virutas en los materiales más duros",
      "mayores velocidades y avances mientras elimina vibración", hélice 20°.

5. SEMIACABADO
   └─ emparejar el sobre-material para que el acabado tenga carga CONSTANTE.
      F2 lo nombra explícito en toda la línea de insertos: CCMT / CNMG / DCMT /
      DNMG = "para acero y procesos de semiacabado".

6. ACABADO (finishing)
   └─ pasada ligera, herramienta nueva o dedicada, radio de esquina que cumple el plano.
      F2: MGMN / RNMA / SEHT = "para acabados y semiacabados de acero";
      "Cortador Vertical Radial" (esquina radial) = el que deja el radio en el fondo.

7. BARRENOS — en su propio orden (§1.4)

8. RIMADO / ESCARIADO (tolerancia fina)
   └─ F2 "Rima de Máquina … Tolerancia H7 / Tolerancia H8". El barreno se TALADRA
      primero y se RIMA después: la rima corrige, no genera.

9. ROSCADO
   └─ F1 §3.5.16.5 ciclo G84, con la restricción dura de sincronía (§2.6 de este pliego).

10. REBABEO / CHAFLÁN
    └─ F2 familia completa de limas rotativas SA…SM y avellanadores 82°/90°.

11. RECTIFICADO / EDM  ← lo que la fresa NO puede
    └─ Kazmer §3.3.1.3 los cobra a factor 4 (vs fresado 1). Aquí es donde el
       DFM de maquinabilidad se convierte en DINERO (§6.3).
```

## 1.2 Sujeción y setups — lo que el maquinista decide y el software no ve

- **La sujeción es parte de la geometría del problema.** F1 App. A es explícito en su límite:
  *"The Interpreter also does not detect situations where a legal command does something
  unfortunate, such as machining a fixture."* Traducción de cliente: *"tu simulador tiene que
  tener la mordaza adentro, porque el control no me va a avisar."*
- **Nueve sistemas de coordenadas de programa** (G54…G59.3) existen para que una pieza con
  varios amarres, o varias piezas en la mesa, vivan en un solo programa (F1 §3.2.2).
- **G92 desplaza los NUEVE a la vez.** *"The axis offsets are always used when motion is specified
  in absolute distance mode using any of the nine coordinate systems… Thus all nine coordinate
  systems are affected by G92."* (F1 §3.5.18). Es una trampa clásica: crees que corriges un amarre
  y corriste todos.
- **Los offsets sobreviven al programa.** F1 §3.5.18 documenta el flujo de dos programas: el
  primero pone G92, no usa G92.1, y el segundo arranca con G92.3 para recuperarlos del archivo
  de parámetros. **El estado de la máquina es persistente entre trabajos.**
- **El palpado sustituye al reloj comparador.** F1 §3.5.9 + Tabla 6: rutina completa de 35 líneas
  para hallar centro y diámetro de un barreno con G38.2, dejando el centro en `#1041`/`#1022`.
  Precondiciones humanas que el manual pone: *"the probe shank must be well-aligned with the
  Z-axis, the cross section of the probe tip at its widest point must be very circular, and the
  probe tip radius must be known precisely."* Si el radio de la punta solo se conoce aproximado,
  **el centro sigue siendo exacto pero el diámetro NO** — matiz que un CAM lineal se salta.

## 1.3 El orden de las operaciones — las reglas duras que sí están escritas

| Regla | Texto / evidencia | Fuente |
|---|---|---|
| El taladrado profundo se hace **con retracción** para romper y sacar viruta | G83 *"often called peck drilling… The retracts in this cycle clear the hole of chips and cut off any long stringers (which are common when drilling in aluminum)"* | F1 §3.5.16.4 |
| La **pausa** es una herramienta de proceso, no un desperdicio | *"The most common use of dwell is to break and clear chips, so the spindle is usually turning during a dwell."* | F1 §2.1.2.8 |
| El **mandrinado** con pausa al fondo existe para limpiar la marca | G82/G86/G88/G89 llevan P = segundos de pausa al fondo antes de retraer | F1 §3.5.16.3, .7, .9, .10 |
| Retracción **al nivel R** vs **al Z inicial** es decisión de si hay obstáculos en el camino | G99 = retrae a R; G98 = retrae al Z de antes del ciclo (salvo que sea más bajo que R) | F1 §3.5.20 |
| El **cambio de herramienta** se pide con anticipación, no en el momento | *"On some machines, the carousel will move when a T word is programmed, at the same time machining is occurring… A common programming practice is to put the T word for the next tool to be used on the line after a tool change. This maximizes the time available for the carousel to move."* | F1 §3.7.3 |
| Desbaste y acabado son **herramientas distintas**, no la misma con otro avance | F2 vende familias separadas: "Cortador para Desbaste" (dentado rompeviruta) vs "Cortador Vertical" de acabado | F2 |

## 1.4 El orden de los barrenos

Reconstruido de F1 (ciclos disponibles) y F2 (familias de herramienta que existen). La cadena
canónica que el catálogo hace posible:

```
punto de centro / broca de centros   →  taladro (G81 / G83 si es profundo)
        →  [G82 con pausa si el fondo debe quedar limpio]
        →  mandrinado G85/G86/G89 si hay que corregir posición y redondez
        →  rima H7/H8 (F2 "Rima de Máquina, Tolerancia H7") si hay tolerancia fina
        →  avellanado 82° / 90° (F2 "Avellanador", 3 y 6 filos)
        →  roscado G84 (o G87 back-boring si el rebaje va por debajo)
```

Reglas de secuencia que SÍ están escritas:

- **G87 (back boring) es una coreografía, no un ciclo.** F1 §3.5.16.8 lo describe en 12 pasos con
  orientación de husillo: *"you put an L-shaped tool in the spindle with a cutting surface on the
  UPPER side of its base. You stick it carefully through the hole when it is not spinning and is
  oriented so it fits through the hole…"*. Y el aviso: *"the I and J numbers must be chosen so
  that when the tool is stopped in an oriented position, it will fit through the hole. Because
  different cutters are made differently, **it may take some analysis and/or experimentation** to
  determine appropriate values for I and J."* → El CAM no puede resolver G87 solo: necesita el
  perfil real del cortador.
- **Los ciclos son "pegajosos" (sticky).** *"we will call a number 'sticky' if, when the same cycle
  is used on several lines of code in a row, the number must be used the first time, but is
  optional on the rest of the lines. **The R number is always sticky.**"* (F1 §3.5.16). O sea: una
  fila de barrenos = un G81 + N líneas de X Y. **Esa es la forma canónica del patrón de barrenos.**
- **L>1 en modo incremental** repite el ciclo en lugares equiespaciados sobre una recta; en modo
  absoluto **repite el mismo barreno en el mismo lugar** (F1 §3.5.16). Trampa clásica.
- **Antes del primer ciclo**, si Z está por debajo de R, se traversa a R. *"This happens only once,
  regardless of the value of L."* (F1 §3.5.16.1).

## 1.5 Cómo se elige la herramienta para cada operación

F2 es un **catálogo**, y esa es exactamente su virtud: define el espacio de búsqueda REAL.
La estructura de datos que el catálogo dicta (una fila = una herramienta comprable):

```
SKU · familia · Ø · largo de corte (LOC) · largo total (OAL) · Ø zanco ·
# de filos · ángulo de hélice · sustrato · recubrimiento · tope HRC ·
materiales recomendados · presentación (MIN/INN)
```

### 1.5.1 Sustrato y recubrimiento → material y dureza (texto literal de F2)

| Sustrato / recubrimiento | Lo que dice el catálogo | Tope de dureza |
|---|---|---|
| **AAV** (acero alta velocidad, HSS) | *"Para usos generales de maquinado. Materiales recomendados: ferrosos y no ferrosos"* | — |
| **TiN** (nitruro de titanio) | *"Mejor velocidad de avance. Alta resistencia. Trabaja a mayor velocidad"* | — |
| **Co / M42** (AAV con 8 % cobalto) | *"Alta resistencia a lo abrasivo. Para perfilado y ranurado"* | — |
| **TiAlN** | *"Recubrimiento TiAlN para mayor durabilidad y productividad"*, hélice 30° | — |
| **AlTiN** | *"Materiales recomendados: aceros aleados, aceros inoxidables, aceros para herramientas, aleaciones de níquel y titanio. La excelente resistencia al calor es perfecta para el mecanizado en seco."* | **60 HRC** en la serie estándar, **90 HRC** en la serie de alta gama (¡son dos productos distintos con el mismo recubrimiento!) |
| **AlTiCrN** | *"Materiales recomendados: hierro fundido y aceros inoxidables. Poca fricción."* / *"Mayores velocidades y avances mientras elimina vibración"* / desbaste: *"realiza un despeje suave y pequeñas virutas en los materiales más duros"* | **88 HRC** |
| **nACRo** (Cr-Al-Ti-Si-N) | *"Materiales recomendados: acero al carbono, acero inoxidable, acero endurecido, aleaciones de níquel, hierro fundido, titanio y aleaciones de alto rendimiento. Extrema resistencia al calor y retención de bordes."* | **88–89 HRC** |
| **Carburo grado C6** | Puntas de barras de mandrinado: *"Para aceros y aleaciones de aceros"* | — |

**Regla que sale de esta tabla:** la selección de herramienta es un **filtro por envolvente**, no un
óptimo continuo. `dureza_de_la_pieza ≤ tope_HRC_del_recubrimiento` y
`material_de_la_pieza ∈ materiales_recomendados` son restricciones **duras** y verificables.

### 1.5.2 Hélice y número de filos → vibración y evacuación de viruta

Literal de F2:

- **30° de hélice** es el estándar de la línea de carburo (aparece en TiAlN, AlTiN, y en la
  descripción genérica *"Usos: ranurado, fresado, fundición, cortes de alta velocidad"*).
- **Hélice variable** (AlTiCrN y nACRo, este último *"hélice variable (40° de hélice)"*):
  *"Mayores velocidades y avances **mientras elimina vibración**"* → **la hélice variable es el
  remedio documentado contra el chatter.**
- **20° de hélice** en el cortador de desbaste AlTiCrN → hélice baja para desbaste pesado.
- El conteo de filos disponible por familia es **2 / 4 / 5 / 6** (F2 marca el ícono FILOS en cada
  página). Los cortadores de Ø grande vienen a 6 filos; los de Ø ≤ 1/4" a 2 ó 4.
- Los cortadores de esquina radial (*"Cortador Vertical Radial… Carburo sólido, esquina radial"*)
  son los que dejan radio en el fondo de la cavidad — el que un molde necesita.

### 1.5.3 Geometría de inserto (torneado / careado)

F2 lista la familia ISO con su **radio de punta `r`** como columna de catálogo:
CNMG 431 (`r` = 0.4 mm), CNMG 432 (`r` = 0.8 mm), y las familias CCMT, DCMT, DNMG, APKT,
TPKN, SEHT, SEKN, RNMA, RNHQ, SNHQ, KNUX, MGMN (ranurado), GTN, 16ER/IR (roscado).
Cada una con su etiqueta de uso: *"para acero y procesos de semiacabado"*, *"para fundición de
hierro"* (CNMA), *"para acabados y semiacabados de acero"* (MGMN, RNMA).

**El radio de punta `r` del inserto es el radio mínimo que ese inserto puede dejar en una esquina
interna** — el mismo teorema que el radio de la fresa (§2.7), aplicado a torneado.

### 1.5.4 Familias especiales que resuelven una geometría específica

F2 las vende porque **hay geometrías que solo esa herramienta hace**:

| Herramienta | Geometría que resuelve |
|---|---|
| Cortador **Cola de Milano**, ángulo de 45° | ranura en cola de milano (imposible con fresa recta) |
| Cortador para **Ranura en T** | ranura en T de mesa/sujeción |
| Cortador **Woodruff** / para **cuñeros** | cuñero, chavetero |
| Cortador **para Esquinas** (*"no pierde el filo"*) | chaflán/redondeo de arista |
| **Barras de mandrinado** (juegos 1/2", 3/4", 1", profundidad 3/4"–7-1/2") | barreno grande con tolerancia |
| **Brocha para cuñero** (*"diseñada para prensas"*) | cuñero interior — **no es fresado, es brochado** |
| **Rima ajustable** (*"con cuchillas ajustables para rimar diversos tamaños con la misma herramienta"*) | tolerancia no estándar |

## 1.6 Los juicios humanos que el maquinista NO delega

1. **Cuántos setups y en qué orden** — nada en F1/F2 lo automatiza.
2. **Cómo se sujeta** — y si la sujeción se va a mover con la carga de corte.
3. **Si la pieza se deforma al soltarla** (tensiones residuales del material; F3 documenta que el
   trabajo frío *"leaves behind both micro and macro residual stresses"*).
4. **Qué features van a EDM** — Kazmer §3.3.1.3 lo dice literal: *"the laptop bezel contains many
   narrow ribs that will be produced primarily with EDM, a machining factor of 4 is used"*.
5. **I y J de un G87** — *"may take some analysis and/or experimentation"* (F1 §3.5.16.8).
6. **El K real de doblado** — se mide, no se calcula (F4, F5 §3.4).
7. **Cuándo la herramienta ya no corta** — el catálogo advierte del síntoma, no del contador:
   *"Evitar aplicar presión excesiva durante la operación y procurar trabajar por ciclos para
   evitar el sobrecalentamiento ya que esto puede ocasionar, entre otras cosas, el desprendimiento
   del vástago."* (F2, Recomendaciones para mayor durabilidad).

---

# 2. REGLAS PRESCRIPTIVAS EN PROSA

> **Aviso de honestidad, y es el hallazgo más importante de esta sección:**
> **F2 NO contiene una sola tabla de velocidad de corte ni de avance por diente.** Ni Vc, ni SFM,
> ni m/min, ni fz, ni RPM. Es un catálogo de distribuidor: da **geometría, sustrato, recubrimiento
> y envolvente de dureza**, y deja el dato de corte al fabricante o al taller. Todo lo que sigue
> marcado **⟨EXTENSIÓN DECLARADA⟩** es hueco de fuente, NO invento tolerado: hay que traerlo de
> Machinery's Handbook, del fabricante del inserto, o medirlo en el taller. Kazmer §3.3 ya nos dio
> la doctrina para esto: *"the negotiated machinist's rate should be used if this data is available"* —
> **todo coeficiente del sistema debe ser sobreescribible por dato real del taller.**

## 2.1 Velocidad de corte y avance — lo que SÍ está fundamentado

### 2.1.1 Identidades (definiciones, no datos — seguras de implementar)

```
Vc = π · D · n / 1000          [m/min], D en mm, n en rpm
n  = 1000 · Vc / (π · D)       [rpm]
Vf = n · z · fz                [mm/min]   z = número de filos
fz = Vf / (n · z)              [mm/diente]
MRR = ae · ap · Vf / 1000      [cm³/min]
```

### 2.1.2 La ÚNICA relación de avance/velocidad que los manuales prescriben con número

**Roscado con machuelo (G84)** — F1 §3.5.16.5, literal:

> *"the programmer must be sure to program the speed and feed in the correct proportion to match
> the pitch of threads being made. The relationship is that **the spindle speed equals the feed
> rate times the pitch** (in threads per length unit). For example, if the pitch is 2 threads per
> millimeter, the active length units are millimeters, and the feed rate has been set with the
> command F150, then the speed should be set with the command S300, since 150 × 2 = 300."*

```
S = F · pitch          [pitch en hilos por unidad de longitud]
```

**Esto es una regla de validación implementable HOY, con número, y falla ruidosamente.**
Corolario del mismo párrafo: *"If the feed and speed override switches are enabled and not set at
100%, the one set at the lower setting will take effect. The speed and feed rates will still be
synchronized."*

### 2.1.3 Lo que el catálogo dice en cualitativo (y sirve como ORDEN, no como valor)

Es un orden parcial verificable: `AAV < TiN < TiAlN/AlTiN < AlTiCrN/nACRo` en velocidad admisible.

- TiN: *"Mejor velocidad de avance… Trabaja a mayor velocidad"* (que AAV desnudo).
- AlTiCrN / nACRo: *"Mayores velocidades y avances mientras elimina vibración"*.
- AlTiN: *"Excelente resistencia al calor, perfecto para el mecanizado en seco"*.

⟨EXTENSIÓN DECLARADA⟩ Los valores de Vc y fz por (material, sustrato, recubrimiento, operación)
**no existen en estas fuentes**. El sistema debe arrancar con la tabla vacía y **exigir** que el
taller la llene o la importe. Un CAM que inventa el número miente con precisión de tres decimales.

## 2.2 Profundidad de pasada axial (ap) y radial (ae)

⟨EXTENSIÓN DECLARADA⟩ Las razones típicas (ap ≤ 1·D, ae ≤ 0.5·D en desbaste convencional; ap alto
+ ae bajo en fresado trocoidal) **no aparecen en F2**. Lo que F2 sí acota, y es duro:

- **El largo de corte (LOC) es el techo físico de ap.** El catálogo da LOC por SKU. Ejemplos reales:

| Serie | Ø | LOC | LOC/Ø |
|---|---|---|---|
| Estándar carburo (ST-1-305) | 1/8" | 3/8" | **3.0** |
| Estándar carburo | 1/4" | 3/4" | **3.0** |
| Estándar carburo | 1/2" | 1" | **2.0** |
| Estándar carburo | 3/4" | 1-1/2" | **2.0** |
| Estándar carburo | 1" | 1-1/2" | **1.5** |
| **Largo** AlTiN (ST-1-235) | 5/8" | 2-1/4" | **3.6** |
| **Extra largo** AlTiN | 5/8" | 3" | **4.8** |
| **Extra largo** AlTiN | 1" | 3" | **3.0** |

  → **Regla de catálogo, verificable:** el LOC estándar disponible en México es **1.5×D a 3×D**;
  la serie "largo" llega a ~3.6×D y la "extra largo" a ~4.8×D. **Más allá de eso no hay SKU** →
  la cavidad se maquina con herramienta de mayor Ø, o se va a EDM. Esto alimenta directo §6.

- **Desbaste ≠ acabado en la misma herramienta.** El "Cortador para Desbaste" AlTiCrN de hélice 20°
  *"realiza un despeje suave y pequeñas virutas en los materiales más duros"* — está diseñado para
  ap/ae grandes con viruta segmentada.

## 2.3 Fresado en concordancia (climb) vs oposición (conventional)

⟨EXTENSIÓN DECLARADA⟩ **No aparece en ninguna de las cinco fuentes.** Ni F1 (es una spec de
lenguaje, no de proceso) ni F2 (catálogo).

Lo que **sí** nos da F1 y que es el gancho para implementarlo correctamente: la **compensación de
radio con lado** (G41 = izquierda del contorno, G42 = derecha). F1 App. B.2.1:

> *"if G41 were programmed, the tool would move clockwise around the triangle, so that the tool is
> always to the left of the triangle when facing in the direction of travel. If G42 were programmed,
> the tool would stay right of the triangle and move counterclockwise."*

**El sentido de recorrido + el lado de compensación determinan concordancia u oposición.**
El CAM debe **derivar** el modo de corte de (G41|G42, sentido del contorno, sentido de giro del
husillo M3|M4) y **reportarlo**, no dejarlo implícito. Esa es una regla verificable sin inventar
ningún número.

## 2.4 Entrada y salida de la herramienta

### 2.4.1 Lo que la spec prescribe con precisión quirúrgica (F1 App. B.3.1)

**Método general — dos pre-entradas y una entrada. Siempre funciona:**

1. Escoger un punto **A** sobre el contorno donde sea cómodo pegar un arco de entrada.
2. Especificar un arco **fuera** del contorno que empieza en **B** y termina en **A**, **tangente**
   al contorno y **yendo en el mismo sentido** que se va a recorrer.
   **Restricción dura:** *"The radius of the arc should be **larger than half the diameter** given
   in the tool table."* (es decir, R_arco > R_herramienta).
3. Extender una recta tangente al arco de **B** a un punto **C**, tal que
   *"the line BC is **more than one tool radius** long."*
4. **El código se escribe en orden inverso a la construcción.** Ejemplo del manual (Tabla 12):

```gcode
N0010 G1 X1 Y5        (primera pre-entrada, a C)
N0020 G41 G1 Y4       (prende compensación y hace la segunda pre-entrada, a B)
N0030 G3 X2 Y3 I1     (movimiento de ENTRADA, a A)
...
N0110 G40             (apaga compensación)
```

**Método simple — solo si hay una esquina CONVEXA** (F1 App. B.3.1.2): extender el lado a cortar
para partir el exterior en dos regiones, moverse a la región del lado del material sobrante
(sin tocarlo) y entrar recto con G41/G42 en la misma línea. Dos líneas de código en vez de tres.
*"A nominal path contour has no corners, so the simple method just described will not work."*

**Contorno de trayectoria nominal** (no de borde de material): el arco de entrada debe ser
*"larger than the **maximum radius difference**"* = (radio de la herramienta más grande esperada −
radio nominal), y BC debe medir más que esa diferencia máxima (F1 App. B.4).

### 2.4.2 Salida

*"When cutter radius compensation is turned off, **no special exit move takes place**. The next
move is what it would have been if cutter radius compensation had never been turned on and the
previous move had placed the tool at its current position."* (F1 App. B.6) → **G40 no retira la
herramienta. Si no programas la salida, la dejas clavada en la pieza.**

### 2.4.3 Rampa, hélice, plunge

⟨EXTENSIÓN DECLARADA⟩ Ni F1 ni F2 hablan de rampa helicoidal para entrada en Z. Lo que F1 sí
provee y basta para **construirla**:

- **G2/G3 helicoidal es primitiva del lenguaje**: si el punto final en el eje perpendicular al
  plano difiere del inicial, *"otherwise it is a helical arc"* (F1 §3.5.3.1). O sea: **la entrada
  en hélice se escribe con un solo G2/G3 con Z distinto.** No hace falta inventar nada.
- **Movimiento en Z durante la compensación es legal**: *"Z-axis motion may take place while the
  contour is being followed in the XY-plane. Portions of the contour may be skipped by retracting
  the Z-axis above the part, following the contour to the next point at which machining should be
  done, and re-extending the Z-axis. These skip motions may be performed at feed rate (G1) or at
  traverse rate (G0). **The Z motion will not interfere with the XY path following.**"* (F1 App. B.1)
- **Plunge = G81/G83.** El plunge recto es literalmente un ciclo de taladrado; si es profundo, G83.

## 2.5 Refrigeración

Lo que las fuentes prescriben:

| Regla | Fuente |
|---|---|
| Niebla (M7) y chorro (M8) son **independientes al prender**, pero el lenguaje **los apaga juntos** (M9). Las funciones canónicas sí los apagan por separado | F1 §2.1.2.7, §3.6.4 |
| *"It is always OK to use any of these commands, regardless of what coolant is on or off"* — el comando es idempotente | F1 §3.6.4 |
| **El refrigerante NO se apaga solo en el cambio de herramienta.** *"No other changes will be made. For example, **coolant will continue to flow during the tool change** unless it has been turned off by an M9."* | F1 §3.6.3 |
| M2/M30 **sí** apagan el refrigerante (como M9), junto con otras 8 cosas | F1 §3.6.1 |
| En el orden de ejecución, el refrigerante se prende en el paso **8**, antes de cualquier movimiento (paso 20) | F1 §3.8 Tabla 8 |
| **Mecanizado en seco es una opción declarada del recubrimiento**, no una carencia: AlTiN *"perfecto para el mecanizado en seco"* (dos familias completas del catálogo lo dicen) | F2 |
| **Sobrecalentamiento por presión excesiva** = falla del vástago: *"Evitar aplicar presión excesiva… procurar trabajar por ciclos para evitar el sobrecalentamiento ya que esto puede ocasionar… el desprendimiento del vástago"* | F2 |

## 2.6 Vida de herramienta

⟨EXTENSIÓN DECLARADA⟩ **La ecuación de Taylor (V·Tⁿ = C) no aparece en ninguna fuente.**
Lo que sí hay:

- **Modelo de desgaste por síntoma, no por reloj** (F2): presión excesiva → sobrecalentamiento →
  desprendimiento del vástago. La contramedida prescrita es **trabajar por ciclos** (permitir
  enfriamiento), no bajar el avance.
- **Resistencia a la abrasión como criterio de selección**: Co M42 *"alta resistencia a lo
  abrasivo"*; nACRo *"extrema resistencia al calor y retención de bordes"*.
- **Reafilado**: F2 vende *"Afilador de Cortadores de Carburo SA-010-0000, 12 a 32 mm"* y de los
  cortadores de engranes dice *"pueden afilarse continuamente"*. → **La vida de herramienta en el
  taller LATAM incluye reafilados; el modelo no puede ser "se tira".**
- **Física del calor** (F3): el flow stress cae exponencialmente con la temperatura y la razón de
  deformación en maquinado es `γ̇ = v / a` (velocidad de la herramienta sobre espesor de viruta).
  A mayor Vc, mayor γ̇, más calor en la zona de corte. Es la justificación física de por qué el
  recubrimiento resistente al calor habilita más velocidad — pero **no da el número**.
- Kazmer §3.3.1.3 ya nos da el manejo económico del asunto: la eficiencia de maquinado del **25 %**
  ya absorbe *"programación, herramientas, setups, electrodos, verificación"*.

## 2.7 GEOMETRÍAS QUE NO SE PUEDEN MAQUINAR — el teorema y sus corolarios

### 2.7.1 EL TEOREMA (F1 App. B.5.1, literal)

> *"When cutter radius compensation is on, **it must be physically possible for a circle whose
> radius is half the diameter given in the tool table to be tangent to the contour at all points
> of the contour**. In particular, the Interpreter treats **concave corners** and **concave arcs
> into which the circle will not fit** as errors, since the circle cannot be kept tangent to the
> contour in these situations."*

Y la frase que justifica todo el módulo DFM de La Forja:

> *"This error detection does not limit the shapes which can be cut, but it does require that the
> programmer **specify the actual shape to be cut** (or path to be followed), not an approximation.
> In this respect, the NIST RS274/NGC Interpreter differs from interpreters used with many other
> controllers, which often allow these errors **silently** and either **gouge the part or round
> the corner**."*

### 2.7.2 Los corolarios, escritos como predicados sobre geometría B-Rep

| ID | Predicado | Fundamento |
|---|---|---|
| **DFM-01** | Para toda arista cóncava vertical del bolsillo: `radio_esquina ≥ radio_herramienta`. Esquina interna VIVA (radio 0) es **inmaquinable por fresado**. | F1 App. B.5.1 (teorema del círculo tangente) |
| **DFM-02** | Para todo arco cóncavo del contorno: `R_arco ≥ R_herramienta`, si no, error *"Tool radius not less than arc radius with comp"* | F1 App. B.5, error 16 |
| **DFM-03** | Radio de esquina mínimo del molde ⇒ **Ø máximo de herramienta = 2·R_esquina**. Y como no hay fresa de cualquier Ø: el Ø debe existir en el catálogo (F2 arranca en 1/16" = 1.588 mm, y en métrico en 1 mm). Bajo eso → **EDM**. | F1 + F2 |
| **DFM-04** | `profundidad_del_bolsillo ≤ LOC(herramienta)`, y `LOC/Ø ≤ 3.0` (estándar) / `≤ 4.8` (extra largo). Fuera de ese sobre: no hay SKU. | F2 (tablas de LOC) |
| **DFM-05** | El **radio del fondo** lo fija la geometría de la punta: fresa plana → esquina viva en el fondo; *"Cortador Vertical Radial (esquina radial)"* → radio; ball → radio = D/2. Un fondo con radio menor al de cualquier punta disponible es inmaquinable. | F2 (familias) |
| **DFM-06** | **Acceso**: si el eje de la herramienta no puede llegar a la superficie sin que el zanco (Ø zanco, dato de catálogo) toque otra cara, la feature necesita otro setup, otro eje, o EDM. F2 da el Ø del zanco por SKU — a veces **mayor** que el Ø de corte (p. ej. ST-1-222-009: Ø 9 mm, zanco 10 mm). | F2 (columna "Zanco") |
| **DFM-07** | **Radio de esquina en torneado** = radio de punta del inserto `r` (CNMG 431 → 0.4 mm; CNMG 432 → 0.8 mm). Mismo teorema, otro proceso. | F2 (columna `r`) |
| **DFM-08** | **Gouging**: si la herramienta ya cubre el siguiente punto XY cuando se prende la compensación, es error. *"the tool is already cutting into material it should not cut"* | F1 App. B.5.3 |
| **DFM-09** | **Cola de milano, ranura en T, cuñero interior** NO son features fresables con herramienta cilíndrica: exigen su herramienta dedicada (o brochado, en el caso del cuñero interior). | F2 (familias especiales) |

---

# 3. EL G-CODE COMO CONTRATO — RS274/NGC (F1)

## 3.1 El modelo de máquina que el lenguaje asume

| Elemento | Definición | § |
|---|---|---|
| **Punto controlado** | Punto sobre el eje del husillo (gauge point) desplazado hacia afuera por el offset de longitud de herramienta. Con offset 0, es el gauge point; con offset = longitud de la herramienta, es la **punta** | 2.1.2.3 |
| **Ejes lineales** | X, Y, Z: sistema **derecho** ortogonal | 2.1.2.1 |
| **Ejes rotacionales** | A, B, C en grados, como **ejes lineales enrollados** (crecen sin límite), positivo antihorario **visto desde el extremo positivo del eje correspondiente**, y **desde el punto de vista de la pieza** — que para la mayoría de las configuraciones se ve horario desde donde está parado el operador | 2.1.2.2 |
| **Movimiento lineal coordinado** | Todos los ejes empiezan y terminan a la vez; si un eje no da la velocidad, **todos** se frenan para mantener la trayectoria | 2.1.2.4 |
| **Avance** | (A) con X/Y/Z moviéndose: unidades/min **sobre la trayectoria XYZ**, como si los rotacionales no se movieran. (B) un rotacional solo: grados/min. (C) dos o tres rotacionales: se usa la métrica euclidiana `D = √(dA²+dB²+dC²)` | 2.1.2.5 |
| **Arco** | Cualquier par de ejes lineales; el tercero puede moverse simultáneamente → **hélice**. El avance se aplica **a lo largo de la hélice** (a diferencia de otras versiones de RS274, que lo aplican a la proyección) | 2.1.2.6 |
| **Posición actual** | Debe **reajustarse sin movimiento** si cambian: (1) unidades de longitud, (2) offset de longitud de herramienta, (3) offsets de sistema de coordenadas | 2.1.2.10 |
| **Modos de control de trayectoria** | `exact stop` (para en cada movimiento), `exact path` (sigue exacto, frena en esquinas), `continuous` (redondea esquinas para no perder avance) | 2.1.2.16 |
| **Supuesto de dinámica** | *"machine dynamics can be almost ignored… acceleration and deceleration do not occur… This model obviously does not correspond with reality."* Los modos de control son **la compensación por esa mentira** | 2.1.2.16 |
| **Parámetros** | Arreglo de **5400** números persistentes entre encendidos (archivo de parámetros) | 3.2.1 |
| **Carrusel** | Cero o una herramienta por bolsillo; en el SAI hay **68** bolsillos | 2.1.2.12, App. B.5.4 |

## 3.2 El archivo de herramientas (el "contrato de cargador")

Formato (F1 §2.3, Tabla 1): líneas de encabezado → **exactamente UNA línea en blanco, sin espacios
ni tabs** → líneas de datos. Cinco columnas, las primeras cuatro obligatorias:

| Columna | Tipo | Semántica |
|---|---|---|
| `POCKET` | entero sin signo | bolsillo del carrusel. **Todos distintos.** |
| `FMS` | entero sin signo | código de la herramienta (libre) |
| `TLO` | real | offset de longitud. *"normally a positive real number"* |
| `DIAM` | real | **dos semánticas distintas según el método**: si la trayectoria programada es el **borde del material**, es el **diámetro medido** (positivo). Si es la **trayectoria nominal**, es la **diferencia** medida − nominal (puede ser negativa: Ø real 0.97 con trayectoria a 1.0 ⇒ **−0.03**) |
| `Comment` | texto | solo para humanos |

**Trampas documentadas:**
- *"The units used for the length and diameter… may be in either millimeters or inches, but if the
  data is used by an NC program, **the user must be sure the units used for a tool in the file are
  the same as the units in effect** when NC code that uses the tool data is interpreted."*
  La Tabla 1 del propio manual **mezcla pulgadas y milímetros a propósito**, para enseñar la trampa.
- Si el mismo bolsillo aparece en dos líneas, *"the data for only the last such line will persist"*.
- Diámetro **negativo**: el intérprete *"compensates on the other side of the contour from the one
  programmed and uses the absolute value"*. **Un signo cambia el lado del corte.**

## 3.3 Gramática de la línea

```
línea ::= [ "/" ] [ "N" entero(0..99999, ≤5 dígitos) ] { palabra | asignación | comentario } EOL
palabra ::= letra(≠N) valor_real
valor_real ::= número | "#" valor_real | "[" expresión "]" | unaria "[" expresión "]"
asignación ::= "#" valor_real(1..5399) "=" valor_real
comentario ::= "(" texto_sin_paréntesis ")"
```

- **Máximo 256 caracteres por línea.**
- Espacios y tabs **en cualquier lugar** y no cambian el significado: `g0x +0. 12 34y 7` ≡ `g0 x+0.1234 y7`.
- Insensible a mayúsculas **fuera de comentarios**.
- Líneas en blanco: se ignoran.
- **Un decimal que debe ser entero se acepta si está dentro de 0.0001 del entero.**
- El `#` tiene **precedencia sobre todo**: `#1+2` = (valor de #1) + 2, ≠ `#[1+2]`. Y `##2` es
  indirección de dos niveles.
- **Las asignaciones surten efecto DESPUÉS de leer todos los valores de la línea**: tras `#3=6 G1 x#3`
  con `#3`=15 previo, la máquina va a **x=15** y `#3` queda en 6.
- Operadores binarios: `+ - * / ** MOD AND OR XOR`, en **tres grupos de precedencia**
  (1: `**`; 2: `* / MOD`; 3: `+ - OR XOR AND`), izquierda a derecha dentro del grupo.
- Unarios: `ABS ACOS ASIN ATAN COS EXP FIX FUP LN ROUND SIN SQRT TAN`. **Ángulos en GRADOS.**
  `ATAN` toma la forma `ATAN[y]/[x]`. `FIX[-2.8] = -3`, `FUP[-2.8] = -2`.
- **Cero es falso; cualquier no-cero es verdadero** (los lógicos operan sobre reales, no enteros).
- Un comentario con `MSG,` justo después del paréntesis es un **mensaje al operador**.
- **El orden de los ítems en la línea NO importa** (5 ítems → las 120 permutaciones significan lo
  mismo), salvo por asignaciones repetidas del mismo parámetro y comentarios repetidos.
- Delimitación con `%`: **obligatoria si el archivo no tiene M2 ni M30.** *"An error will be
  signalled if a file has a percent line at the beginning but not at the end."*

## 3.4 Los grupos modales (F1 Tabla 4) — la máquina de estados

**G codes:**

| Grupo | Miembros | Qué controla |
|---|---|---|
| 1 | G0, G1, G2, G3, G38.2, G80, G81…G89 | **movimiento** (siempre hay uno activo) |
| 2 | G17, G18, G19 | plano de trabajo |
| 3 | G90, G91 | absoluto / incremental |
| 5 | G93, G94 | modo de avance (tiempo inverso / por minuto) |
| 6 | G20, G21 | pulgadas / milímetros |
| 7 | G40, G41, G42 | compensación de radio |
| 8 | G43, G49 | offset de longitud |
| 10 | G98, G99 | nivel de retorno en ciclos fijos |
| 12 | G54…G59.3 | sistema de coordenadas |
| 13 | G61, G61.1, G64 | modo de control de trayectoria |
| **0** | G4, G10, G28, G30, G53, G92, G92.1, G92.2, G92.3 | **NO modales** |

**M codes:** 4 = {M0,M1,M2,M30,M60} paro · 6 = {M6} cambio · 7 = {M3,M4,M5} husillo ·
8 = {M7,M8,M9} refrigerante (**caso especial: M7 y M8 pueden estar activos a la vez**) ·
9 = {M48,M49} overrides.

**Regla de interacción crítica:** *"It is an error to put a G-code from group 1 and a G-code from
group 0 on the same line **if both of them use axis words**."* Y si un G del grupo 1 está activo
implícitamente y llega un G del grupo 0 con palabras de eje (G10, G28, G30, G92), **el del grupo 1
queda suspendido para esa línea**.

## 3.5 EL ORDEN DE EJECUCIÓN (F1 Tabla 8) — copiarlo tal cual

```
 1. comentario / mensaje
 2. modo de avance (G93, G94)
 3. avance (F)
 4. velocidad de husillo (S)
 5. seleccionar herramienta (T)
 6. cambiar herramienta (M6)
 7. husillo on/off (M3, M4, M5)
 8. refrigerante on/off (M7, M8, M9)
 9. habilitar/deshabilitar overrides (M48, M49)
10. pausa (G4)
11. plano activo (G17, G18, G19)
12. unidades (G20, G21)
13. compensación de radio on/off (G40, G41, G42)
14. compensación de longitud on/off (G43, G49)
15. sistema de coordenadas (G54…G59.3)
16. modo de control de trayectoria (G61, G61.1, G64)
17. modo de distancia (G90, G91)
18. modo de retorno (G98, G99)
19. home (G28, G30) | datos de coordenadas (G10) | offsets de eje (G92, G92.1, G92.2, G92.3)
20. MOVIMIENTO (G0…G3, G80…G89), modificado (quizá) por G53
21. paro (M0, M1, M2, M30, M60)
```

## 3.6 Sistemas de coordenadas

- **Uno absoluto (de máquina) + nueve de programa.** *"It is **not possible to select the absolute
  coordinate system directly**."* Solo se llega con **G53** en la misma línea que G0 o G1.
- Se fijan con `G10 L2 P<1..9> X… Y… Z… A… B… C…` (valores en absoluto). El sistema puede estar
  activo o no cuando se le cambia el origen. **Solo se resetean los ejes cuya palabra aparece.**
- Se seleccionan con G54(1), G55(2), G56(3), G57(4), G58(5), G59(6), G59.1(7), G59.2(8), G59.3(9).
- **Al inicializar** se selecciona el sistema que diga el parámetro **5220** (1.0 por defecto).
- **G92 desplaza el origen del sistema activo, y eso afecta a los nueve.** Los offsets quedan en
  los parámetros **5211–5216**. Si ya había offset, el nuevo es `A+B` (acumula).
  G92.1 = borra y pone los parámetros en 0 · G92.2 = borra pero **deja los parámetros** ·
  G92.3 = **aplica** los parámetros guardados.
- Mapa de parámetros: 5161–5166 home de G28 · 5181–5186 home de G30 · 5211–5216 offset G92 ·
  5220 número de sistema activo · 5221–5226 sistema 1 … 5381–5386 sistema 9 ·
  5061–5066 resultado del palpado.

## 3.7 Compensación de radio de cortante (G40/G41/G42) — el subsistema más peligroso

- **Solo funciona con el plano XY activo.** Punto.
- G41 = herramienta a la **izquierda** del contorno; G42 = a la **derecha** (con radio positivo).
- `D` es **opcional**: sin D se usa el radio de la herramienta que está en el husillo. Con D, es el
  bolsillo del cual tomar el radio. `D0` ⇒ radio cero.
- **En esquinas convexas el intérprete INSERTA un arco** de radio = radio de la herramienta
  (F1 App. B.6). Nunca "dobla la esquina en seco". Ver Figura 2: el método correcto mantiene la
  herramienta **en contacto** con la esquina; el incorrecto *"removes more material than necessary"*.
- **Bajo G94, el avance se aplica a la trayectoria REAL de la punta, no al contorno programado**
  (F1 App. B.1). ⇒ En una esquina interna, la punta recorre menos y el tiempo real difiere.
- **Cambiar de herramienta con la compensación prendida NO es error** — pero *"the radius used when
  cutter radius compensation was first turned on will continue to be used until compensation is
  turned off, even though a new tool is actually being used."* **Bomba de tiempo.**
- No se puede **cambiar de índice D** ni **cambiar de lado** sin apagar y volver a prender
  (efecto combinado de las reglas 5 y 12 de la lista de errores).
- **Primer movimiento tras prender la compensación**: si es recta, se construye la tangente desde
  el punto programado a un círculo del radio de la herramienta centrado en el punto actual; si el
  punto programado cae **dentro** del círculo inicial de la herramienta → **gouging**. Si es arco,
  se construye un arco auxiliar centrado en el centro programado, que pasa por el punto final y es
  tangente a la herramienta en su posición actual; **si el arco auxiliar no se puede construir, error**.

## 3.8 Ciclos fijos (G81–G89)

**Comunes a todos:** se ejecutan respecto al plano activo (los tres planos son válidos, la
descripción usa XY). Usan X, Y, R, Z. **R** está sobre el eje perpendicular al plano.
`L` = repeticiones (L=0 prohibido; omitir L ≡ L=1; **no** es sticky). `R` **siempre** es sticky.

**Movimiento preliminar** (§3.5.16.1): al inicio, si Z está por debajo de R, se traversa a R
(**una sola vez**, sin importar L). Luego, en cada ciclo y repetición: (1) traverso paralelo al
plano XY hasta la posición XY, (2) traverso solo de Z hasta R si no está ya ahí.

| Ciclo | Qué es | Secuencia |
|---|---|---|
| **G81** | taladrado | Z al avance → retrae a `clear Z` en traverso |
| **G82** | taladrado con pausa | Z al avance → pausa P seg → retrae en traverso |
| **G83** | **peck / picoteo** | baja `Q` o hasta Z (lo que sea menos profundo) → **rapid** afuera a clear Z → rapid de regreso al fondo actual "backed off a bit" → repite → retrae |
| **G84** | roscado a derechas | sincroniza velocidad-avance → Z al avance → **para husillo** → arranca antihorario → retrae **al avance** → si la sincronía no estaba, la apaga → para → arranca horario |
| **G85** | mandrinado / rimado | Z al avance → retrae **al avance** (sin pausa) |
| **G86** | mandrinado | Z al avance → pausa P → **para husillo** → retrae en traverso → rearranca husillo |
| **G87** | **back boring** | 12 pasos con orientación de husillo, I/J para meter y sacar la herramienta, K = cota superior del rebaje |
| **G88** | mandrinado | Z al avance → pausa P → para husillo → **para el programa para que el operador retraiga a mano** → rearranca |
| **G89** | mandrinado | Z al avance → pausa P → retrae **al avance** |

**Traducción de proceso** (la que un maquinista lee de un vistazo): retracción **al avance**
(G85/G89) = deja buen acabado en la pared; retracción en **traverso** (G81/G82/G83/G86) = es rápido
pero raya; **husillo parado antes de salir** (G86/G88) = para no marcar con el filo.

## 3.9 LA TABLA DE VALIDACIÓN — todos los errores que el intérprete DEBE rechazar

> **Esto es la especificación ejecutable.** Se implementa tal cual, como una batería de predicados
> con ID estable. Cada fila viene textual de F1.

### 3.9.1 Archivos y arranque

| ID | Condición de error | § |
|---|---|---|
| `E-FILE-01` | El archivo empieza con línea `%` pero no termina con otra | 3.1 |
| `E-FILE-02` | El archivo no tiene M2 ni M30 **y** no está delimitado con `%` | 3.1 |
| `E-PARM-01` | Falta un parámetro requerido en el archivo de parámetros | 3.2.1 |
| `E-PARM-02` | Los números de parámetro no están en orden ascendente | 3.2.1 |
| `E-PARM-03` | El parámetro 5220 no es un entero entre 1 y 9 | 3.2.2 |
| `E-TOOL-01` | Formato de archivo de herramientas inválido / línea mal formada | App. A.6 |
| `E-TOOL-02` | Número de bolsillo fuera de rango | App. A.6 |

### 3.9.2 Léxico y sintaxis de línea

| ID | Condición de error | § |
|---|---|---|
| `E-LEX-01` | Cualquier entrada no permitida explícitamente por la gramática | 3.3 |
| `E-LEX-02` | Línea de más de 256 caracteres | 3.3 |
| `E-LEX-03` | `N` fuera de 0..99999 o con más de 5 dígitos | 3.3.1 |
| `E-LEX-04` | Índice de parámetro que no evalúa a entero en 1..5399 | 3.3.2.2, 3.3.3 |
| `E-LEX-05` | Paréntesis izquierdo dentro de un comentario (comentarios anidados) | 3.3.4 |
| `E-LEX-06` | Comentario sin cerrar antes del fin de línea | 3.3.4 |
| `E-LEX-07` | Dos G de un mismo grupo modal en la misma línea | 3.3.5 |
| `E-LEX-08` | Más de 4 M en la línea, o dos M del mismo grupo modal | 3.3.5 |
| `E-LEX-09` | Dos palabras que empiezan con la misma letra (≠ G, M) | 3.3.5 |
| `E-LEX-10` | Falta un ítem requerido del prototipo del comando | 3.5 |

### 3.9.3 Movimiento

| ID | Condición de error | § |
|---|---|---|
| `E-MOV-01` | G0 sin ninguna palabra de eje | 3.5.1 |
| `E-MOV-02` | G1 sin ninguna palabra de eje | 3.5.2 |
| `E-MOV-03` | G del grupo 1 **y** G del grupo 0 en la misma línea, ambos usando palabras de eje | 3.4 |
| `E-MOV-04` | G80 activo con palabras de eje (salvo que haya un G del grupo 0 que las use) | 3.5.15 |
| `E-ARC-01` | Arco por radio: faltan **ambas** palabras de eje del plano seleccionado | 3.5.3.1 |
| `E-ARC-02` | Arco por radio: el punto final es **igual** al punto actual | 3.5.3.1 |
| `E-ARC-03` | Arco por centro: la distancia del punto actual al centro difiere de la del punto final al centro por **más de 0.0002 in / 0.002 mm** | 3.5.3.2 |
| `E-ARC-04` | Arco por centro en XY: faltan X **y** Y, o faltan I **y** J (análogo en XZ con I/K, y en YZ con J/K) | 3.5.3.2 |
| `E-G4-01` | `P` negativo en G4 | 3.5.4 |
| `E-G10-01` | `P` de G10 L2 no evalúa a entero en 1..9 | 3.5.5 |
| `E-G92-01` | G92 sin ninguna palabra de eje | 3.5.18 |
| `E-G53-01` | G53 sin G0 ni G1 activo | 3.5.12 |
| `E-FEED-01` | Modo de tiempo inverso (G93) activo y una línea con G1/G2/G3 (explícito o implícito) **sin** palabra F | 3.5.19 |
| `E-S-01` | `S` negativa | 3.7.2 |
| `E-T-01` | `T` negativa, o mayor que el número de bolsillos del carrusel | 3.7.3 |
| `E-H-01` | `H` de G43 no entero, negativo, o mayor que el número de bolsillos | 3.5.11 |

### 3.9.4 Palpado (G38.2)

| ID | Condición de error | § |
|---|---|---|
| `E-PRB-01` | El punto actual está a **menos de 0.254 mm / 0.01 in** del punto programado | 3.5.9.1 |
| `E-PRB-02` | G38.2 en modo de avance de tiempo inverso | 3.5.9.1 |
| `E-PRB-03` | Se comanda movimiento de un eje rotacional | 3.5.9.1 |
| `E-PRB-04` | No se usó ninguna palabra X, Y o Z | 3.5.9.1 |
| `E-PRB-05` | El palpador **no se activó** aun después de rebasar ligeramente el punto programado | 3.5.9.1 |

### 3.9.5 Ciclos fijos

| ID | Condición de error | § |
|---|---|---|
| `E-CYC-01` | X, Y y Z **todas** ausentes durante un ciclo fijo | 3.5.16 |
| `E-CYC-02` | `P` requerida y negativa | 3.5.16 |
| `E-CYC-03` | `L` que no evalúa a entero positivo (incluye L=0) | 3.5.16 |
| `E-CYC-04` | Movimiento de eje rotacional durante un ciclo fijo | 3.5.16 |
| `E-CYC-05` | Modo de avance de tiempo inverso activo durante un ciclo fijo | 3.5.16 |
| `E-CYC-06` | **Compensación de radio activa** durante un ciclo fijo | 3.5.16 |
| `E-CYC-07` | Con plano XY: falta `Z` y el mismo ciclo no estaba ya activo (análogo: `Y` en XZ, `X` en YZ) | 3.5.16 |
| `E-CYC-08` | **`R` menor que `Z`** (análogo por plano) — el nivel de retracción por debajo del fondo | 3.5.16 |
| `E-CYC-09` | `Q` de G83 negativa o **cero** | 3.5.16.4 |
| `E-CYC-10` | G84 con el husillo **no girando en sentido horario** antes de ejecutar | 3.5.16.5 |
| `E-CYC-11` | G86 con el husillo **no girando** antes de ejecutar | 3.5.16.7 |

### 3.9.6 Compensación de radio (F1 App. B.5, lista literal de 17)

| ID | Mensaje del intérprete |
|---|---|
| `E-CRC-01` | Cannot change axis offsets with cutter radius comp |
| `E-CRC-02` | Cannot change units with cutter radius comp |
| `E-CRC-03` | Cannot probe with cutter radius comp on |
| `E-CRC-04` | Cannot turn cutter radius comp on out of xy-plane |
| `E-CRC-05` | Cannot turn cutter radius comp on when on |
| `E-CRC-06` | Cannot use g28 or g30 with cutter radius comp |
| `E-CRC-07` | Cannot use g53 with cutter radius comp |
| `E-CRC-08` | Cannot use xz-plane with cutter radius comp |
| `E-CRC-09` | Cannot use yz-plane with cutter radius comp |
| `E-CRC-10` | **Concave corner with cutter radius comp** ← el teorema de §2.7 |
| `E-CRC-11` | **Cutter gouging with cutter radius comp** |
| `E-CRC-12` | D word with no g41 or g42 |
| `E-CRC-13` | Multiple d words on one line |
| `E-CRC-14` | Negative d word tool radius index used |
| `E-CRC-15` | Tool radius index too big |
| `E-CRC-16` | **Tool radius not less than arc radius with comp** |
| `E-CRC-17` | Two g codes used from same modal group |

### 3.9.7 Las reglas de BUENA PRÁCTICA (no son error, pero deben advertirse)

| ID | Advertencia | Texto de F1 |
|---|---|---|
| `W-01` | **Arcos por radio cercanos a semicírculo o círculo completo** | *"It is not good practice… a small change in the location of the end point will produce a much larger change in the location of the center… rounding error in a number can produce **out-of-tolerance cuts**. Nearly full circles are outrageously bad, semicircles (and nearly so) are only very bad. Other size arcs (in the range tiny to 165 degrees or 195 to 345 degrees) are OK."* (§3.5.3.1) |
| `W-02` | **G20/G21 fuera del preámbulo** | *"It is usually a good idea to program either G20 or G21 near the beginning of a program before any motion occurs, and **not to use either one anywhere else** in the program."* (§3.5.7) |
| `W-03` | **Números de línea repetidos o desordenados** | *"normal practice is to avoid such usage"* (§3.3.1) |
| `W-04` | **Palabras de eje rotacional en ciclos fijos o en G38.2** | *"are allowed, but it is better to omit them"*; si se usan **deben ser iguales a la posición actual** (§3.5.16, §3.5.9.1) |
| `W-05` | **Cambio de herramienta con compensación de radio activa** | legal, pero se sigue usando el radio viejo (App. B.5) |
| `W-06` | **Unidades del archivo de herramientas ≠ unidades del programa** | responsabilidad del usuario; el manual mezcla in y mm en su propio ejemplo (§2.3) |
| `W-07` | **`T` en la misma línea que M6** | funciona, pero desperdicia el tiempo de movimiento del carrusel (§3.7.3) |
| `W-08` | **Trayectoria nominal que se despega de la geometría** | *"If a path… in which the tool does not stay in contact with the part geometry all the time, the Interpreter will not be able to compensate properly when undersized tools are used."* (App. B.4) |
| `W-09` | **Ajustar el mismo parámetro dos veces en una línea** | *"It is silly, but not illegal"* (§3.3.5) |

## 3.10 Lo que el intérprete NO valida — y por eso lo tenemos que validar NOSOTROS

Literal de F1 App. A:

> *"The Interpreter **does not check for axis overtravel or excessively high feeds or speeds**,
> however. The Interpreter also **does not detect situations where a legal command does something
> unfortunate, such as machining a fixture.**"*

**Estos tres huecos son exactamente el alcance de nuestro pre-flight (§5).**

## 3.11 El reset de estado de M2/M30 (lo que el programa siguiente hereda)

M2 o M30 dejan la máquina así (F1 §3.6.1) — un programa que no lo sabe, choca:

1. Offsets de eje a cero (como G92.2) y offsets de origen al default (como **G54**)
2. Plano = **XY** (como G17)
3. Modo de distancia = **absoluto** (como G90)
4. Modo de avance = **unidades por minuto** (como G94)
5. Overrides de avance y velocidad = **ON** (como M48)
6. Compensación de radio **apagada** (como G40)
7. **Husillo parado** (como M5)
8. Modo de movimiento = **G1**
9. **Refrigerante apagado** (como M9)

**Ojo con el 8:** el modo de movimiento por defecto tras M2 es **G1 (al avance)**, no G0.
Un programa que arranca con `X10 Y10` sin G-code de movimiento **hace un corte, no un traslado**.

---

# 4. LÁMINA — doblado, springback, factor K y desdoblado

## 4.1 Vocabulario y geometría (F5 §1.1)

| Símbolo | Término | Definición literal |
|---|---|---|
| `T` | Espesor | espesor de la lámina |
| `Ri` | Radio interior | radio interior del doblez |
| `t` | Posición de la fibra neutra | distancia del interior del doblez a la fibra neutra, *"the line along which no deformation occurs"* |
| `Rn` | Radio neutro | `Rn = Ri + t` |
| `Ln` | **Bend Allowance (BA)** | longitud de arco de la fibra neutra. **No cambia durante el doblado: es constante** |
| `α` | Ángulo de doblez (exterior) | ángulo entre la pestaña y la base |
| `β` | Ángulo de apertura (interior) | `β = 180° − α` |
| `SBout` | Setback exterior | `SBout = tan(α/2)·(Ri + T)` |
| `SBin` | Setback interior | `SBin = tan(α/2)·Ri` |
| `K` | Factor K | `K = t / T` — *"a ratio that represents the location of the neutral sheet with respect to the thickness"* |

**⚠ Trampa nombrada explícitamente por el cliente (F5 §2.4):**
*"Another common mix up in terminology is the difference between the Bend Angle (α), and the
Opening Angle (β). **This can lead to a lot of confusion and errors** when designing and
calculating flat patterns."* Y además: *"It is even common to see charts on a shop floor titled
'Bend Allowance', and the chart is actually a chart of Bend Deductions."*
→ **Todo campo de ángulo en la UI debe decir cuál de los dos es. Sin excepción.**

## 4.2 Las fórmulas del desdoblado

### 4.2.1 Bend Allowance (aditivo)

```
L  = L1 + L2 + Ln                                    (F5 ec. 6)
Ln = α · (π/180°) · Rn = α · (π/180°) · (Ri + t)     (F5 ec. 7)
t  = K · T                                           (F5 ec. 8),  típicamente 0 ≤ K ≤ 1  (8a)

⇒  Ln = α · (π/180°) · (Ri + K·T)                    (F5 ec. 9)  ← LA fórmula
```

Nota de F5 sobre (8a): *"K can be less than 0 or greater than 1 in theory and even in practice,
but in general it is expected to be between 0 and 1."* SolidWorks **solo acepta 0..1** (F4).

Forma equivalente de F4: `BA = (R + K·T)·A/180` con A en grados (falta la π, es errata del PDF;
la de F5 es la correcta y coincide dimensionalmente).

### 4.2.2 Bend Deduction (sustractivo — lo que el taller mide de verdad)

```
L = La + Lb − LBD                                     (F5 ec. 10)

LSetBack = tan(α/2)·(Ri + T)      si 0° ≤ α ≤ 90°     (F5 ec. 11c)
LSetBack = (Ri + T)               si 90° < α ≤ 180°

Ln = 2·LSetBack − LBD                                 (F5 ec. 12c)  ← el puente BA ↔ BD

K = [ (180°/(α·π)) · (2·LSetBack − LBD) − Ri ] / T    (F5 ec. 14)   ← K desde medición

LBC (Bend Compensation) = −LBD                        (F5 ec. 15)
```

**Por qué existe BD y no basta BA** (F5 §2.2, Fig. 3–5): *"Measuring is the real trick. Bending a
known length of sheet metal is easy, but to calculate the Bend Allowance… the lengths of L1 and L2
must be measured. **This is not easy since the exact location of the bend line is really not
known.** It is much easier to measure to the virtual intersection (or **Virtual Sharp**) of the
flanges."* → **El taller acota a la intersección virtual. El software tiene que hablar ese idioma.**

### 4.2.3 DIN 6935 (F5 §3.3) — el estándar alemán, con su propio K

```
L = L1 + L2 + V           (ec. 18)      V = Bend Compensation = −LBD  (ec. 19)

0° ≤ β ≤ 90° :   V = π·((180°−β)/180°)·(Ri + (T/2)·K_DIN) − 2·(Ri + T)
90° < β ≤ 165°:  V = π·((180°−β)/180°)·(Ri + (T/2)·K_DIN) − 2·(Ri + T)·tan((180°−β)/2)
165° < β ≤ 180°: V = 0

K_DIN = 0.65 + 0.5·log10(Ri/T)     si  Ri/T ≤ 5
K_DIN = 1                          si  Ri/T > 5           (ec. 21)
```

**⚠ Advertencia explícita de la fuente:** *"The value of K_DIN is **not the same** as a K Factor
as described in Section 2.1, and **should not be confused** with standard K Factors."*
(La relación es `K_DIN ≈ 2·K` por la `T/2` de la fórmula.)
Nota: DIN 6935 trabaja con **β (ángulo de apertura)**, no con α.

### 4.2.4 Lockheed (F5 §3.1) — de donde sale el K = 0.44 por defecto de Inventor

```
BA = α · (0.017453·Ri + 0.0078·T)
⇒  K = 0.0078 · 180°/π = 0.44
```
*"Most likely this formula was developed for a class of materials, probably Cold Rolled Steels and
Spring Steels."* → **El default de 0.44 tiene material implícito. Hay que decirlo en la UI.**

### 4.2.5 Machinery's Handbook (F5 §3.2) — tres materiales, solo a 90°

| Material | Fórmula (90°) | K derivado |
|---|---|---|
| Latón suave, cobre suave | `Ln = 0.55·T + 1.57·Ri` | **0.35** |
| Cobre y latón semiduro, acero suave, aluminio | `Ln = 0.64·T + 1.57·Ri` | **0.407** |
| Bronce, cobre duro, acero rolado en frío, acero para resorte | `Ln = 0.71·T + 1.57·Ri` | **0.452** |

Para ángulos ≠ 90°: `Ln(α) = Ln(90°) · α/90`.

### 4.2.6 Tablas de Bend Deduction — lo que el cliente REALMENTE prefiere

F5 §3.4, literal: *"While K Factors are convenient and tend to be simple to use (especially for CAD
software), **for the most accurate development of flat patterns, Bend Deduction tables, based on
actual measured data, are the preferred method.** In a given manufacturing environment typically
there are **a finite set** of materials, gauges, bending processes, and tooling. Because of this
finite limit, generation of Bend Deduction Tables for all of the possible combinations of these is
practical."*

La tabla real que muestra (Fig. 6) va de **5° a 170° en pasos de 1°**, con **18 espesores** y
**13 radios** — **160+ páginas**. Ese es el tamaño del objeto de datos.

**Trampa de compatibilidad documentada:** *"in older versions of Inventor, the format supported…
**assumes that the Bend Deduction Table is using the Opening Angle (β), and not the Bend Angle (α)**.
Inventor features are designated using the Bend Angle (α), however."* → **una tabla importada sin
declarar su convención de ángulo produce piezas mal cortadas y nadie sabe por qué.**

## 4.3 Tablas de K medidas en taller (F4 — el dato de campo)

Estas son mediciones de **un taller real (DB Sheetmetals Ltd)**, no un estándar. Valor: muestran la
**dispersión real** — el mismo material y espesor con distinto radio/dado da K distinto.

**Acero dulce (mild steel)** — columnas: espesor · radio (V del dado) · K normal · K de hem · B/A

| T | Radio | K normal | K hem | B/A |
|---|---|---|---|---|
| 0.7 mm | 1.3 mm | 0.509 | 0.625 | 0.0 |
| 0.9 mm | 1.3 mm | 0.395213 | — | 0.0 |
| 1.0 mm | 1.3 mm | 0.355213 | — | 0.0 |
| 1.2 mm | 1.3 mm | 0.455 | 0.625 | 0.2 |
| 1.5 mm | 1.3 mm (V 8 mm) | 0.415 | 0.625 | 0.41 |
| 1.5 mm | 1.5 mm (V 10 mm) | 0.3794 | 0.625 | 0.25 |
| 2.0 mm | 2.0 mm | 0.4325 | 0.625 | 0.5 |
| 2.5 mm | 2.5 mm | 0.46425 | — | 0.75 |
| 3.0 mm | 2.0 mm (V 12 mm) | 0.501 | — | 1.5 |
| 3.0 mm | 2.6 mm (V 16 mm) | 0.4855 | — | — |
| 3.0 mm | 3.0 mm | 0.4855 | — | 1.0 |
| 4.0 mm | 4.0 mm | 0.512 | — | 1.5 |
| 5.0 mm | 4.0 mm | 0.4425 | — | 1.75 |
| 6.0 mm | 6.0 mm (V 40 mm) | 0.4857 | — | 2.0 |
| 6.0 mm | 4.0 mm (V 25 mm) | 0.501 | — | 3.0 |
| 10.0 mm | 8.0 mm | 0.675 | — | 7.16 mm |

**Acero inoxidable:** 0.9/1.3 → 0.3955 · 1.0/1.3 → 0.3555 · 1.2/1.3 → 0.29601 (hem 0.625) ·
1.5/1.5 → 0.3801 y 0.27326 (¡dos valores para la misma combinación!) · 2.0/2.0 → 0.27324 ·
3.0/3.0 → 0.321.

**Aluminio:** 0.9/1.3 → 0.355 · 1.2/1.3 → 0.454 · **Air Bend** 1.5/1.5 → 0.4855 ·
**Coin Bend** 1.5/1.5 → **0.55** · 2.0/2.0 → 0.5500 · 3.0/3.0 → 0.59156 · 5.0/5.0 → 0.5279.

> **⭐ Lectura del dato:** el mismo aluminio de 1.5 mm con el mismo radio da **K = 0.4855 al aire y
> K = 0.55 acuñado**. **El proceso de doblado es una dimensión de la clave de la tabla, no un
> comentario.** Y el inoxidable de 1.5/1.5 tiene dos K distintos en la misma tabla del taller
> (0.3801 y 0.27326) — el dato real trae dispersión y el software no debe fingir que no.

## 4.4 Springback y los tres procesos de doblado (F4)

| Proceso | Definición literal | Springback | Radio interior mínimo | Fuerza |
|---|---|---|---|---|
| **Al aire (Air Bending)** | *"the punch touches the work piece and the work piece **does not bottom** in the lower cavity"*; el ángulo lo determina **la carrera del punzón** | *"The spring back will usually range from **5 to 10 degrees**"* | `Ri = radio del punzón` | *"relatively small"*, pero exige **control preciso de la carrera** |
| **A fondo (Bottoming)** | *"the punch and the work piece bottom on the die"*; se fija la posición final del punzón con **claro punzón-dado menor que el espesor**, el material cede un poco | *"very little spring back"* | **≥ 1·T** | **50–60 % más** que al aire |
| **Acuñado (Coining)** | *"compressive stress is applied to the bending region to increase the amount of plastic deformation"* | el mínimo de los tres | **hasta 0.75·T** | la mayor |

**Qué hace que el springback varíe:** *"The amount of spring back depends on the **material,
thickness, grain and temper**."*
**Ventaja operativa del aire:** *"there is **no need to change any equipment or dies** to obtain
different bending angles because the bend angles are determined by the punch stroke."*
**Regla de herramental:** *"The same angle is usually used in both the punch and the die **to
minimize set-up time**."*

### 4.4.1 K por proceso — las reglas de dedo (F4, tres tablas)

**Doblado al aire:**

| Radio | Material suave | Material medio | Material duro |
|---|---|---|---|
| 0 a T | 0.33 | 0.38 | 0.40 |
| T a 3·T | 0.40 | 0.43 | 0.45 |
| > 3·T | 0.50 | 0.50 | 0.50 |

**A fondo (bottoming):**

| Radio | Suave | Medio | Duro |
|---|---|---|---|
| 0 a T | 0.42 | 0.44 | 0.46 |
| T a 3·T | 0.46 | 0.47 | 0.48 |
| > 3·T | 0.50 | 0.50 | 0.50 |

**Acuñado (coining):**

| Radio | Suave | Medio | Duro |
|---|---|---|---|
| 0 a T | 0.38 | 0.41 | 0.44 |
| T a 3·T | 0.44 | 0.46 | 0.47 |
| > 3·T | 0.50 | 0.50 | 0.50 |

**Patrón invariante:** con `Ri > 3·T`, **K = 0.50 en los tres procesos y los tres materiales**
(la fibra neutra se va al centro). Debajo de eso, K depende de proceso Y dureza. **Es un lookup
tridimensional, no una constante.**

### 4.4.2 Otros procesos que el cliente nombra (F4)

- **V bending**: claro punzón-dado constante = espesor. Rango de espesor **0.5 mm a 25 mm**.
- **U die bending**: dos ejes de doblado paralelos en una operación; el pad exige *"about **30 %**
  of the bending force"*.
- **Wiping die (flanging)**: un borde a 90°, el resto retenido; *"the flange length can be easily
  changed and the bend angle can be controlled by the stroke position of the punch"*.
- **Double die bending**: dos wipes seguidos; *"can enhance strain hardening to **reduce
  spring-back**"*.
- **Rotary bending** (con rocker): (a) **no necesita pisador**, (b) **compensa el springback por
  sobre-doblado**, (c) menos fuerza, (d) permite **más de 90°**.
- **Capacidad de prensa plegadora**: *"20 to 200 tons… stock from 1 m to 4.5 m (3 to 15 feet)"*.

## 4.5 REGLAS DFM DE LÁMINA — "esto no se puede doblar" (F4, "Tips and Tricks", literal)

| ID | Regla | Texto |
|---|---|---|
| **SM-01** | **Un solo radio en toda la pieza** | *"The bend radius should, if possible, be kept the same for all radiuses in the part **to minimize set up changes**."* |
| **SM-02** | **Radio interior mínimo ≥ 1·T** | *"For most materials, the ideal minimum inner radius should be at least 1 material thickness."* |
| **SM-03** | **Dirección del grano** | *"bending **perpendicular** to the rolling direction is easier than bending parallel… Bending parallel to the rolling direction can often lead to **fracture** in hard materials."* |
| **SM-04** | **Prohibición dura por dureza** | *"bending parallel to the rolling direction is **not recommended for cold rolled steel > Rb 70**. And **no bending is acceptable for cold rolled steel > Rb 85**. Hot rolled steel can however be bent parallel to the rolling direction."* |
| **SM-05** | **Pestaña mínima** | `Min Flange Width = 4·T + Ri`. *"Violating this rule could cause **distortions in the part or damage to tooling or operator due to slippage**."* ← **es una regla de SEGURIDAD, no de calidad** |
| **SM-06** | **Distancia mínima de barreno/ranura al doblez** | `D = 3·T + Ri`. *"Slots or holes too close to the bend can cause distortion of these holes. If it is necessary to have holes closer, then the hole or slot should be **extended beyond the bend line**."* ← trae su propia solución |
| **SM-07** | **Acumulación de cotas** | *"Dimensioning of the part should take into account the **stack up of dimensions** that can happen, and mounting holes that can be made **oblong** should be."* |
| **SM-08** | **Cómo se inspecciona** | *"Parts should be inspected in a **restrained position**, so that the natural flexure of the parts does not affect measurements. Similarly inside dimensions in an inside bend should be measured **close to the bend**."* |
| **SM-09** | **Bottoming exige Ri ≥ 1·T**; **coining permite Ri hasta 0.75·T** | F4, secciones Bottoming y Coining |

### 4.5.1 El límite metalúrgico (F3) — por qué SM-03 y SM-04 existen

F3 explica la física detrás de la regla del grano y de la prohibición por dureza:

- El trabajo en frío deja **granos alargados**, **orientación preferente (textura)**, **alta
  densidad de dislocaciones**, **alta dureza**, y **pérdida de ductilidad y tenacidad**; además
  **tensiones residuales micro y macro**.
- *"because of work hardening **the amount of deformation per pass is limited**"* → si la pieza
  necesita mucha deformación, se necesita **recocido intermedio**: *"In several cold working
  operations intermediate annealing becomes necessary to restore the ductility of the metal so
  that it can be given further deformation."*
- **Frontera frío/caliente:** *"the re-crystallization temperature of a metal is around **0.5 times
  the melting point in degree Kelvin (0.5·Tm)**."* El plomo y el estaño a temperatura ambiente
  ya son trabajo **caliente**; el tungsteno a 1000 °C sigue siendo **frío**.
- **Workability por fases:** una sola fase = dúctil (latón 70/30 se trabaja en frío y en caliente);
  dos fases con resistencias muy distintas = poco dúctil (latón 60/40 solo se trabaja en caliente,
  donde es 100 % β). **Fundición gris: *"can not be worked either hot or cold"*.** Titanio α (HCP)
  no tiene 5 sistemas de deslizamiento independientes → *"difficult to form"*; en β (BCC), fácil.
- **Rango de trabajo en caliente** (F3, Tabla 2), °C: Al 320–450 · Cu 450–900 · Pb 100–200 ·
  Acero 800–1250 (laminado y forja).

## 4.6 Secuencia de doblado

⟨EXTENSIÓN DECLARADA⟩ **Ninguna de las cinco fuentes da un algoritmo de secuenciación de dobleces.**
Lo que sí dan, y que son las **restricciones** que cualquier algoritmo debe respetar:

1. **Minimizar cambios de setup** ⇒ agrupar dobleces del mismo radio/dado (SM-01, F4).
2. **El mismo ángulo en punzón y dado** para no cambiar herramental (F4, air bending).
3. **La pieza se posiciona con topes traseros (back gages) y pisadores (hold-downs)** —
   *"The material is placed on the die, and positioned in place with **stops and/or gages**. It is
   held in place with **hold-downs**."* (F4) ⇒ **cada doblez consume una referencia; el orden debe
   dejar siempre una cara plana contra el tope.**
4. **La pestaña mínima (SM-05) es la que hace que el operador pueda sostener la pieza sin
   resbalarse** ⇒ los dobleces que dejan la pieza sin agarre van **al final**.
5. *"Programmable back gages, and multiple die sets currently available can make bending a very
   economical process"* (F4) ⇒ el software debe **emitir la posición del tope trasero por doblez**,
   no solo el patrón plano.

## 4.7 El desdoblado como algoritmo (lo que hay que implementar)

```
entrada:  sólido de lámina B-Rep (espesor T constante) + material + proceso + herramental
1. detectar el ESPESOR (par de caras paralelas a distancia T)
2. detectar las zonas de DOBLEZ (caras cilíndricas de radio Ri, con sus dos caras planas tangentes)
3. construir el GRAFO de pestañas: nodos = caras planas, aristas = dobleces
4. elegir la cara BASE (la que se queda quieta)
5. por cada doblez, resolver en este orden de preferencia:
      a) tabla de Bend Deduction del taller  (F5 §3.4 — la preferida)
      b) K medido por reverse engineering    (F4 — el método del cliente)
      c) K de regla de dedo por (proceso, dureza, Ri/T)  (F4 §4.4.1)
      d) DIN 6935 K_DIN                      (F5 §3.3)
      e) Lockheed K = 0.44                   (F5 §3.1) ← declarar el material implícito
   y emitir SIEMPRE de dónde salió el número
6. desplegar: L = Σ pestañas + Σ BA   (o Σ virtual-sharps − Σ BD)
7. VERIFICAR DFM: SM-01…SM-09 sobre la pieza plana y sobre cada doblez
8. emitir el PATRÓN PLANO + la tabla de dobleces (orden, ángulo α y β, radio,
   dado en V, posición de tope trasero, springback esperado)
```

**Y la regla de honestidad de F4 encima de todo:** *"The only truly effective way of working out
the correct bend allowance is to **reverse engineer it** by taking a measured strip of material,
bending it, and then measuring it."* El software debe traer el **asistente de calibración** de
5 pasos (cortar tira ~100 mm → medir L y T → doblar a 90° **exactamente igual que las piezas
reales** → medir X e Y → calcular K con la ec. 14) como función de primera clase, y guardar el
resultado como dato del taller.

---

# 5. CRITERIOS DE ACEPTACIÓN — el pre-flight antes de mandar el programa a la máquina

Tres bloques. El primero lo dicta F1 con precisión; el segundo son los tres huecos que F1 declara
que **no** cubre; el tercero es de taller.

## 5.1 Bloque A — el programa es LEGAL (implementable hoy, 100 % de F1)

- [ ] Corre completo el intérprete de validación de **§3.9** sin un solo error.
- [ ] **Cero advertencias** `W-01`…`W-09`, o cada una firmada por un humano.
- [ ] El archivo está delimitado con `%` **o** termina en M2/M30 (`E-FILE-01`, `E-FILE-02`).
- [ ] El **preámbulo** fija explícitamente: G20/G21, G17/G18/G19, G90/G91, G93/G94, G54…G59.3,
      G61/G61.1/G64, G98/G99, G40, G49. **Nada se hereda del programa anterior**
      (§3.11 dice qué deja M2/M30; todo lo demás es basura del turno pasado).
- [ ] Toda compensación de radio abre con sus **dos pre-entradas + entrada** y cierra con G40 **y
      su movimiento de salida explícito** (App. B.6: *"no special exit move takes place"*).
- [ ] Ningún G53 / G28 / G30 / G92 / G20 / G21 / G38.2 dentro de una zona con compensación activa.
- [ ] Ningún ciclo fijo con compensación activa (`E-CYC-06`).
- [ ] Todo G84 cumple `S = F · pitch` y arranca con el husillo en horario (§2.1.2, `E-CYC-10`).
- [ ] Todo `R` de ciclo fijo está por encima de su `Z` (`E-CYC-08`).

## 5.2 Bloque B — los tres huecos que F1 declara (App. A) y que son NUESTROS

- [ ] **Sobre-recorrido de ejes.** Simular el programa completo contra los límites de la máquina
      (envolvente X/Y/Z + rotacionales) **en coordenadas absolutas**, resolviendo G54…G59.3, G92
      y G53. *"The Interpreter does not check for axis overtravel."*
- [ ] **Avances y velocidades excesivas.** Contra el husillo (rpm máx, par a esa rpm) y contra la
      envolvente de la herramienta. *"…or excessively high feeds or speeds."*
- [ ] **Colisiones — "machining a fixture".** Simulación de remoción de material con el modelo
      completo: pieza + **mordaza/bridas/tornillos** + mesa + **portaherramienta y zanco** (el
      catálogo da Ø de zanco: a veces **mayor** que el Ø de corte). *"a legal command [that] does
      something unfortunate, such as machining a fixture."*

## 5.3 Bloque C — la máquina y el cargador de verdad

- [ ] **La herramienta correcta está en el bolsillo correcto.** Contrastar cada `T`/`D`/`H` del
      programa contra el archivo de herramientas: bolsillo existe, `POCKET` único, `TLO` cargado,
      `DIAM` con la semántica correcta (borde de material vs trayectoria nominal, y **signo**).
- [ ] **Unidades del archivo de herramientas == unidades del programa** (F1 §2.3 avisa que es
      responsabilidad del usuario y su propio ejemplo mezcla in y mm).
- [ ] **Ningún `T` ni `D` mayor que el número de bolsillos** del carrusel de ESA máquina
      (`E-T-01`, `E-CRC-15`).
- [ ] **Archivo de parámetros completo y ordenado**, con `5220` ∈ 1..9 (`E-PARM-01…03`).
- [ ] Confirmar el **modo de control de trayectoria** elegido: `G61.1` exact stop (esquinas
      cuadradas, lento) vs `G64` continuo (*"sharp corners of the path may be rounded slightly so
      that the feed rate may be kept up"* — **redondea la esquina; en un molde eso es una cota**).
- [ ] Confirmar el **modo de retracción** G98/G99 contra los obstáculos reales (bridas, insertos ya
      montados).
- [ ] Overrides: si el programa lleva M49, el operador **no** podrá corregir en vivo
      (*"the idea is that optimal settings have been included in the program, and the operator
      should not change them"*, §2.2.1) — decisión consciente, no accidente.
- [ ] **Primer corte en el aire / con Z elevado** — no está en el manual, es del taller.

## 5.4 Cómo debe FALLAR el verificador (F1 App. A.1, doctrina de errores)

> 1. *"Check carefully for errors."*
> 2. *"If an error occurs, **identify it specifically** so that the user can be informed."*
> 3. *"If an error occurs, **return through the function call hierarchy** rather than jumping out of it."*

Y el intérprete **siempre guarda el texto de la última línea interpretada** y la **pila de llamadas**
para poder decir *dónde* falló. **Un mensaje de error de nuestro validador que no diga la línea
exacta y la regla exacta no cumple el contrato.** Los errores del NIST se generan automáticamente
del código fuente (`NCE_G_CODE_OUT_OF_RANGE` → `"G code out of range"`), o sea: **el símbolo Y el
texto legible son el mismo objeto**. Copiamos ese patrón.

---

# 6. BRECHA CONTRA LA FORJA

## 6.0 Corrección al supuesto de partida

El enunciado decía: *"Lo que NO tenemos: generación de trayectorias, post-procesador de G-code,
selección de herramienta por operación, ni cálculo de velocidades y avances desde catálogo real."*
**Eso es medio cierto y hay que corregirlo antes de planear nada.** Auditoría del repo:

| Supuesto | Realidad medida |
|---|---|
| "no hay generación de trayectorias" | ❌ **Falso.** Hay 9 generadores en `src/forja/cam/`: `facing.ts`, `pocket.ts`, `drill.ts`, `bore.ts` (con `helicalEntry`), `tap.ts`, `turning.ts`, `adaptive3d.ts`, `laser.ts`, `slicer.ts` — todos cableados a `ForgeBRepStudio.tsx` |
| "no hay post-procesador" | ❌ **Falso a medias.** Hay emisión: `facing.ts:toGcode`, `tap.ts:generateTappingGcode`, `turning.ts:toLatheGcode`, `laser.ts:laserGcode`. **Lo que no hay es el CONTRATO** (validador RS274NGC) ni post configurable por control |
| "no hay selección de herramienta" | ✅ **Cierto.** No hay biblioteca de herramientas ni archivo de herramientas |
| "no hay velocidades y avances" | ⚠️ **Peor que no tenerlos.** `src/forja/cam/tool-stress.ts` **existe y es bueno** (Kienzle `kc = kc11·h^-mc`, adelgazamiento de viruta `hm = fz·√(ae/D)`, viga en voladizo, veredictos `roza`/`rompe`/`flexion`/`potencia`, materiales con `vcMin`/`vcMax`) **pero está desconectado**: su único consumidor es su propio test. Mientras tanto la UI usa `rpm = 100000/(π·D)` hardcodeado en **tres** lugares de `ForgeBRepStudio.tsx` (líneas 4771, 4848, 4878) y `rpm: 7850` / `rpm: 7878` literales en careado y bolsillo (líneas 4677, 4734, comentados *"números del libro"*) — **Vc ≈ 100 m/min para aluminio, para 4140 y para P20 endurecido por igual** |

**Conclusión operativa:** no hay que construir CAM desde cero. Hay que **cerrar el lazo** entre tres
cosas que ya viven en el repo y no se hablan: el generador de moldes → el kernel → el CAM.

## 6.1 Inventario del kernel: qué preguntas de maquinabilidad puedo hacerle HOY

`src/forja/brep/occt.ts` es la única API. Lo que da y lo que no:

| Necesito para el DFM | ¿Existe? | Dónde |
|---|---|---|
| Enumerar caras con su tipo (`plane`/`cylinder`/`cone`/`sphere`), área, centro, normal | ✅ | `enumerateFaces → FaceRef[]` |
| Enumerar aristas con tipo (`line`/`circle`), longitud, punto medio | ✅ | `enumerateEdges → EdgeRef[]` |
| Polilínea 3D y eje de cada arista | ✅ | `enumerateEdgesGeom → EdgeGeom[]` |
| Volumen, área, propiedades de masa | ✅ | `volume`, `surfaceArea`, `massProperties` |
| Bounding box | ⚠️ Solo por teselado: `mold/mold.ts:shapeBBox`. **No usa `Bnd_Box` nativo** |
| **Radio de una cara cilíndrica** | ❌ **NO EXISTE** — `enumerateFaces` usa `BRepAdaptor_Surface`+`BRepLProp_SLProps` **solo para la normal** |
| **Curvatura principal / concavidad de una arista** | ❌ **NO EXISTE** |
| Offset de sólido/superficie (`BRepOffsetAPI_MakeOffsetShape`) | ❌ NO EXISTE (el único offset es 2D: `cam/laser.ts:offsetLoop`) |
| Sección B-Rep (`BRepAlgoAPI_Section`) | ❌ NO EXISTE |
| Feature recognition sobre topología B-Rep | ❌ NO EXISTE (sí hay sobre **malla/slices**: `lib/feature-recognition.ts`, `lib/cross-section.ts`, `lib/gpu-cross-section.ts`) |
| Análisis de desmoldeo | ✅ `mold/mold.ts:draftAnalysis`, `mold/dfm-mesh.ts:dfmFromMesh` |

> **🔴 EL BLOQUEADOR ÚNICO Y CONCRETO:** el teorema de §2.7 (`radio_esquina ≥ radio_fresa`) necesita
> **el radio de la cara cilíndrica cóncava**, y el kernel no lo expone. Es un cambio de ~15 líneas
> en `occt.ts`: en `enumerateFaces`, si `GeomAbs_Cylinder`, leer
> `BRepAdaptor_Surface.Cylinder().Radius()` (idem `Cone().RefRadius()`, `Sphere().Radius()`) y
> devolverlo como `FaceRef.radius?: number`. **Sin eso no hay DFM de maquinabilidad.**
>
> *Atajo mientras tanto (frágil, declararlo):* para una arista `kind:'circle'` completa,
> `R = length / (2π)`. Falla en arcos parciales, que son justo los de las esquinas de bolsillo.
> Sirve para barrenos, no para esquinas. **No sustituye al fix del kernel.**

## 6.2 El módulo a construir: **DFM de maquinabilidad sobre las piezas del molde**

El generador ya produce los sólidos reales: `mold/mold-plano-set.ts:buildMoldParts` devuelve
`MoldPart[]` con roles `inserto-cav`, `inserto-core`, placas (`clamp`/`A`/`B`/`support`/`ejector`/
`ejector-ret`/`bottom`) con **barrenos ya taladrados** (`buildPlateSolid → {solid, drilled, holes}`),
guías, bujes, pines, circuitos de agua, colada, interlocks, pilares. **Todo eso alguien lo maquina.**

### 6.2.1 Contrato del módulo nuevo `src/forja/cam/machinability.ts`

```ts
// entrada: un sólido del molde + la biblioteca de herramienta disponible
export interface ToolLibrary { tools: ToolSpec[] }          // ← poblada desde F2 (catálogo Weston)
export interface ToolSpec {
  sku: string; familia: string;
  dMm: number; locMm: number; oalMm: number; shankMm: number;  // ← el zanco puede ser > d
  z: number; helixDeg: number;
  sustrato: 'HSS'|'M42'|'carburo'; recubrimiento?: 'TiN'|'TiAlN'|'AlTiN'|'AlTiCrN'|'nACRo';
  hrcMax?: number; materialesOk: string[];
  puntaR?: number;                                  // radio de esquina (0 = plana, d/2 = ball)
}

export type ProcesoRequerido = 'fresado'|'taladrado'|'torneado'|'rectificado'|'edm';

export interface HallazgoDFM {
  id: 'DFM-01'|'DFM-02'|'DFM-03'|'DFM-04'|'DFM-05'|'DFM-06'|'DFM-07'|'DFM-09';
  nivel: 'ok'|'aviso'|'inmaquinable';
  faceIdx?: number; edgeIdx?: number;
  medido: number; requerido: number;         // p.ej. R_esquina=1.2 vs R_fresa_min=1.588 (1/8")
  proceso: ProcesoRequerido;                 // a qué proceso EMPUJA este hallazgo
  volumenAfectadoMm3: number;                // ← LO QUE ALIMENTA EL COSTEO (§6.3)
  herramientaSugerida?: string;              // SKU del catálogo
  msg: string;                               // español, en el idioma del taller
}

export interface EstudioMaquinabilidad {
  parte: string; role: MoldPart['role'];
  hallazgos: HallazgoDFM[];
  radioMinimoExigidoMm: number;              // min sobre todas las esquinas cóncavas
  relacionProfundidadDiametro: number;       // max L/D exigido
  mezclaDeProcesos: Record<ProcesoRequerido, number>;  // fracción de volumen, suma = 1
  machiningFactor: number;                   // ← promedio PONDERADO (Kazmer Tabla 3.4)
  edmMm3: number;                            // volumen que forzosamente va a EDM
}
```

### 6.2.2 Los predicados, uno por uno, sobre la geometría que ya tenemos

| Predicado | Cómo se evalúa con la API real | Qué falta |
|---|---|---|
| **DFM-01** radio de esquina | Para cada cara `kind:'cylinder'` **cóncava** y vertical respecto al eje de extracción: `R_cara ≥ min(d/2) de la biblioteca` | `FaceRef.radius` + test de concavidad |
| **DFM-02** arco cóncavo | Igual, sobre `enumerateEdgesGeom` con `kind:'circle'` cóncavos | test de concavidad |
| **DFM-03** Ø máx admisible | `d_max = 2·R_min_esquina`, luego **snap al catálogo** (mínimo 1/16" = 1.588 mm o 1 mm métrico). Si `d_max < d_min_catálogo` ⇒ **EDM** | biblioteca poblada |
| **DFM-04** L/D | profundidad = extensión en Z del bolsillo (ya sale de `shapeBBox` de la cavidad); `LOC ≥ profundidad` y `LOC/d ≤ 4.8` | nada — se puede hoy |
| **DFM-05** radio de fondo | intersección cara-plana-de-fondo con caras cilíndricas tangentes | `FaceRef.radius` |
| **DFM-06** acceso y **zanco** | ray-cast desde el eje de herramienta; el cilindro de colisión es **`max(d, shank)`, no `d`** | biblioteca + ray-cast (se puede sobre la malla de `tessellate`) |
| **DFM-07** radio de punta de inserto | mismo teorema, sobre el perfil de `turning.ts:profileFromMesh` | tabla de insertos (F2 §1.5.3) |
| **DFM-09** familias especiales | detectar cola de milano / ranura en T / cuñero por el patrón de caras | reconocedor |

### 6.2.3 Y lo que ya existe y hay que **enchufar, no escribir**

- **`tool-stress.ts` al lazo.** Ya calcula `cutKinematics` y `toolStress` con Kienzle y viga en
  voladizo, y ya tiene `MATERIALES` con `vcMin`/`vcMax` para inox-304, 1045, 4140, aluminio y
  fundición. **Falta:** (a) exponerlo como comando `cam.toolStress`, (b) que los generadores de
  trayectoria **pidan** el veredicto antes de emitir G-code, (c) matar el `rpm = 100000/(π·D)` de
  `ForgeBRepStudio.tsx` y sustituirlo por `n = 1000·Vc/(π·D)` con Vc del material.
  El voladizo del veredicto `flexion` es exactamente el `LOC/D` de **DFM-04**: **el mismo número
  sirve para el DFM geométrico y para el estudio de esfuerzo.**
- **El instinto DFM ya está ahí, sin nombre.** `ForgeBRepStudio.tsx` (bolsillo circular) ya rechaza:
  *`CAM ranura: la fresa ⌀X no cabe en la ranura ⌀Y`*. Eso **es DFM-03** escrito a mano en un solo
  sitio. El módulo de §6.2 lo generaliza a todas las esquinas, todos los fondos y todas las piezas
  del molde — y en vez de solo negarse, **dice a qué proceso empuja y cuánto cuesta**.
- **`machine-config.ts`** ya parsea `.mch` de Fusion con `maxFeedrate` y `feedrateRatio`
  → **es la fuente de los límites del Bloque B de §5.2** (sobre-recorrido y avances excesivos).
- **`fits.ts`** ya define `EJECTOR_DIAM_CLEARANCE_MM = 0.13` (Kazmer §8.3.2, *reamed*) y
  `guideGeom` con sus tres barrenos/contrataladros consistentes → **esos son barrenos rimados
  H7/H8**, es decir la cadena taladro→rima de §1.4, ya parametrizada. El plan de maquinado de
  barrenos **se deriva de `fits.ts`**, no se inventa.

## 6.3 LA CONEXIÓN: DFM → costeo Kazmer

Aquí es donde esto deja de ser un ejercicio y se vuelve dinero.

**Estado actual** — `src/forja/mold/moldmachine.ts:170` elige el factor de maquinado así:

```
complejidad > 2.5  →  'edm'      (4)
complejidad > 1.5  →  2          (interpolado a mano)
si no              →  'fresado'  (1)
```

Es una **heurística de umbral sobre un escalar geométrico**. Y el libro dice otra cosa
(§3.3.1.3, Tabla 3.4): *el factor de la aplicación es el **promedio ponderado según la proporción
de uso** de cada proceso*. Kazmer llega a esa proporción **mirando la pieza**: *"the laptop bezel
contains many narrow ribs that will be produced primarily with EDM, a machining factor of 4 is
used."* **Eso es exactamente lo que el DFM de §6.2 mide en vez de adivinar.**

**El reemplazo, de una línea:**

```ts
// hoy:  machiningFactor: complexity > 2.5 ? MACHINING_FACTOR.edm : …
// mañana:
const est = machinability(parteSolida, toolLibrary);
const machiningFactor = Object.entries(est.mezclaDeProcesos)
  .reduce((acc, [proc, frac]) => acc + frac * MACHINING_FACTOR[proc], 0);
```

donde `mezclaDeProcesos` sale de **volumen atribuido por hallazgo**:

```
volumen que ninguna fresa del catálogo alcanza          → edm          (×4)
volumen bajo tolerancia/acabado que exige rectificado   → rectificado  (×4)
volumen de barrenos (drill.ts ya los detecta)           → taladrado    (×0.5)
volumen del perfil de revolución (turning.ts)           → torneado     (×0.5)
el resto                                                → fresado      (×1)
```

**Los tres números que el maquinista quiere ver, y que hoy nadie calcula:**

1. **`radioMinimoExigidoMm`** por inserto — la cota que decide si hay EDM o no.
2. **`edmMm3`** — el volumen que forzosamente va a electroerosión, **con su electrodo** (que Kazmer
   ya mete dentro de la eficiencia del 25 %, §3.3.1.3).
3. **`relacionProfundidadDiametro`** — si pasa de 4.8, no hay SKU y hay que rediseñar o erosionar.

**El lazo de retorno (axioma A1 del pliego de UI, §1.5 del libro):** si el DFM dice que la cavidad
exige un radio de 0.8 mm que no existe en fresa, eso **no es un error de maquinado: es una demanda
contra el diseño del inserto**. Va a la bandeja de demandas (P2b) como *"la costilla de 1.6 mm de
la cavidad te está costando $X de EDM; con radio 1.6 mm se fresa"*. **Ese mensaje es el producto.**

## 6.4 El validador RS274NGC — el entregable más barato y más útil

`src/forja/cam/gcode-contract.ts`. Es **puro** (string → diagnósticos), no necesita OCCT, no necesita
GPU, se prueba con `scripts/gcode-contract-check.ts` y **la especificación de prueba ya está escrita
en §3.9 de este pliego**: ~60 predicados con ID estable, todos textuales de F1.

```ts
export interface Diagnostico {
  id: string;              // 'E-CYC-08' | 'W-01'
  nivel: 'error'|'aviso';
  linea: number; texto: string;   // F1 App. A.1: SIEMPRE la línea exacta
  regla: string;                  // el § del NIST que lo obliga
  msg: string;                    // español mexicano
}
export function validarGcode(src: string, ctx: {
  bolsillos: number; toolFile: ToolFileRow[]; unidades: 'in'|'mm';
}): Diagnostico[];
```

Y **el paso 2**: los generadores existentes (`facing.ts:toGcode`, `tap.ts`, `turning.ts`, `laser.ts`)
**pasan por el validador antes de devolver**. Un generador que emite G-code que no pasa su propio
contrato es un bug, y hoy no hay forma de saberlo.

**Ganancia inmediata medible:** `tap.ts:generateTappingGcode` puede verificar `S = F · pitch`
(F1 §3.5.16.5) — es la única relación numérica de corte que los manuales prescriben, y es un
`assert` de dos líneas.

## 6.5 Lámina — de cero, y es el módulo más limpio de todos

No existe nada: `src/ForgePage.tsx:1269-1285` tiene un menú `METAL` con seis ítems
**`disabled: true`** (Flange, Bend, Flat Pattern, Unfold, Refold, Sheet Metal Rules) y ningún handler.
(Ojo con el falso amigo: `buildMoldLaminas` en `mold-plano-set.ts` son **hojas de plano**, no chapa.)

Lo bueno: **§4 de este pliego es una especificación completa y cerrada**, y ya tenemos la otra mitad:
`cam/laser.ts` hace `offsetLoop` con kerf, `nestParts` y `laserGcode` → **el corte del patrón plano
ya está resuelto.** Lo que falta es el desdoblado que lo alimenta.

```
src/forja/sheet/
  bend-tables.ts   → K_DIN(Ri,T), Lockheed, Machinery's (3 materiales), reglas de dedo
                     por (proceso × dureza × Ri/T), y las tablas medidas de F4
  unfold.ts        → BA/BD/setback/K (ecs. 7, 9, 10, 11c, 12c, 14, 15), DIN 6935 (20a-c, 21)
  sheet-dfm.ts     → SM-01…SM-09 como predicados
  bend-sequence.ts → orden + posición de tope trasero  ⟨parcialmente extensión⟩
  calibrate.ts     → el asistente de 5 pasos de F4 (medir K real y guardarlo por taller)
```

**Regla de diseño no negociable, y sale del propio cliente:** cada campo de ángulo lleva
**α o β explícito**, cada tabla importada declara su convención, y cada K muestra **de dónde salió**
(tabla medida / regla de dedo / DIN / Lockheed) — porque el cliente documentó que confundirlos
*"can lead to a lot of confusion and errors"*.

## 6.6 Comandos nuevos para el bus (`registry.ts`, dominios `cam` y `lamina`)

El registry tiene 62 comandos en 16 dominios y **cero de CAM**. La firma es
`{id, domain, eq?, status, needsOc?, summary, run}`. Propuesta mínima:

| id | dominio | needsOc | qué hace |
|---|---|---|---|
| `cam.toolStress` | cam | no | expone el `tool-stress.ts` que ya existe |
| `cam.speedsFeeds` | cam | no | `n = 1000·Vc/(π·D)`, `Vf = n·z·fz`; **falla ruidoso si no hay Vc del material** |
| `cam.toolLibrary` | cam | no | consulta el catálogo (Ø, LOC, zanco, filos, HRC máx, materiales) |
| `cam.machinability` | cam | **sí** | §6.2 — el estudio DFM sobre un sólido |
| `cam.processMix` | cam | sí | la mezcla ponderada de procesos → `machiningFactor` |
| `cam.validateGcode` | cam | no | §6.4 — el contrato RS274NGC |
| `cam.preflight` | cam | sí | §5 completo (bloques A + B + C) |
| `lamina.unfold` | lamina | sí | patrón plano + tabla de dobleces |
| `lamina.dfm` | lamina | sí | SM-01…SM-09 |
| `lamina.calibrateK` | lamina | no | el asistente de 5 pasos |
| `cost.estimateMold` / `cost.estimatePart` | costeo | no | **ya existen en código y NO están en el bus** (`MOLDE-COMANDOS.md` los lista como si sí; es catálogo aspiracional) |

## 6.7 Orden de construcción (cada fase entrega algo usable sola)

| Fase | Qué | Por qué primero | Depende de |
|---|---|---|---|
| **F0** | `FaceRef.radius` en `occt.ts` (~15 líneas) + test | **desbloquea TODO el DFM**; sin esto no hay §6.2 | — |
| **F1** | `gcode-contract.ts` con los ~60 predicados de §3.9 + los 4 generadores existentes pasando por él | puro, sin dependencias, spec ya escrita, valor inmediato | — |
| **F2** | `tool-library.ts` poblada del catálogo F2 (Ø, LOC, OAL, **zanco**, filos, hélice, recubrimiento, HRC máx, materiales) | es el espacio de búsqueda real de todo lo demás | — |
| **F3** | `machinability.ts` (DFM-01…09) sobre `buildMoldParts` | el corazón del pliego | F0, F2 |
| **F4** | **`processMix` → `machiningFactor` ponderado** reemplazando la heurística de `moldmachine.ts:170` | **aquí el CAM se paga solo**: el costeo deja de adivinar | F3 |
| **F5** | Enchufar `tool-stress.ts` + matar `rpm = 100000/(π·D)` | quita la mentira de Vc=100 para todo | F2 |
| **F6** | Pre-flight §5 (overtravel + feeds + colisión con mordaza y **zanco**) usando `machine-config.ts` | los tres huecos que el NIST declara que no cubre | F1, F2 |
| **F7** | `sheet/` completo (§4) enganchado a `laser.ts` | módulo limpio, spec cerrada, no toca nada existente | — |

---

# 7. LOS 10 ⭐ — lo que una máquina lineal se saltaría

> **⭐1 — Fallar RUIDOSO en la esquina cóncava es una FUNCIÓN, no un defecto.**
> F1 App. B.5.1: *"the NIST RS274/NGC Interpreter differs from interpreters used with many other
> controllers, which often allow these errors **silently** and either **gouge the part or round the
> corner**."* Una máquina lineal implementa el camino feliz y "resuelve" la esquina redondeándola.
> El cliente **exige** que truene: prefiere no correr el programa a correrlo y tirar el inserto.

> **⭐2 — `G40` NO retira la herramienta.**
> *"When cutter radius compensation is turned off, **no special exit move takes place**."* (App. B.6)
> Una máquina lineal empareja `G41 … G40` como si fueran abrir/cerrar paréntesis y deja la fresa
> clavada en la pared. La salida es un movimiento que **hay que programar**, simétrico a las dos
> pre-entradas + entrada de la §2.4.1.

> **⭐3 — Después de `M2`/`M30`, el modo de movimiento por defecto es `G1`, no `G0`.**
> F1 §3.6.1, punto 8: *"The current motion mode is set to G_1 (like G1)."* Un programa que arranca
> con `X10 Y10` sin G-code explícito **hace un corte al avance**, no un traslado. Una máquina lineal
> asume que "por defecto" significa rápido, porque así se siente.

> **⭐4 — La columna `DIAM` del archivo de herramientas tiene DOS semánticas, y el signo negativo
> cambia el LADO del corte.**
> Si la trayectoria programada es el **borde del material**, `DIAM` es el diámetro medido (positivo).
> Si es la **trayectoria nominal**, es la **diferencia**: fresa real de 0.97 con trayectoria a 1.0
> ⇒ **`-0.03`**. Y con diámetro negativo el intérprete *"compensates on the **other side** of the
> contour from the one programmed"* (§2.3, App. B.4). Una máquina lineal valida `DIAM > 0` y rompe
> el método de trayectoria nominal completo.

> **⭐5 — `G92` desplaza los NUEVE sistemas de coordenadas, no el activo.**
> *"The axis offsets are always used when motion is specified in absolute distance mode using any of
> the nine coordinate systems… **Thus all nine coordinate systems are affected by G92**."* (§3.5.18)
> Y los offsets **sobreviven al programa** en los parámetros 5211–5216. Corriges un amarre y corres
> los ocho restantes, incluido el del turno de mañana.

> **⭐6 — Un arco por radio cercano a semicírculo o círculo completo es LEGAL y saca la pieza fuera
> de tolerancia.**
> *"a small change in the location of the end point will produce a much larger change in the location
> of the center… rounding error in a number can produce **out-of-tolerance cuts**. **Nearly full
> circles are outrageously bad**, semicircles (and nearly so) are only very bad."* Rango sano:
> minúsculo–165° y 195°–345° (§3.5.3.1). Una máquina lineal solo implementa errores, y este **no es
> un error**: es una advertencia con nombre, umbral numérico y consecuencia dimensional.

> **⭐7 — `G64` (modo continuo) REDONDEA las esquinas para no perder avance.**
> *"In continuous mode, **sharp corners of the path may be rounded slightly** so that the feed rate
> may be kept up."* (§2.1.2.16) En un inserto de molde esa esquina redondeada **es una cota**. Una
> máquina lineal deja el modo de control de trayectoria en el default de la máquina y nunca lo
> menciona; el maquinista lo elige a conciencia por operación (acabado → `G61.1`).

> **⭐8 — El Ø del ZANCO a veces es MAYOR que el Ø de corte.**
> Datos duros del catálogo (F2, serie métrica AlTiN): `ST-1-222-001` = Ø **1 mm** de corte con zanco
> de **3 mm** (¡el zanco es el TRIPLE!); `ST-1-222-002` = 2 mm / 3 mm; `ST-1-222-009` = 9 mm / 10 mm;
> `ST-1-222-011` = 11 mm / 12 mm. Una simulación de colisión que
> modela la herramienta como un cilindro del Ø de **corte** **MIENTE**, y el sitio donde miente es
> justo la pared de una cavidad profunda. El cilindro de colisión es `max(d_corte, d_zanco)` por
> tramo, y el catálogo ya trae la columna.

> **⭐9 — El factor K de doblado es (material × espesor × radio × **PROCESO**), y el dato real trae
> dispersión — y α no es β.**
> Mismo aluminio de 1.5 mm, mismo radio de 1.5 mm: **K = 0.4855 al aire, K = 0.55 acuñado** (F4).
> Y el mismo taller reporta **dos K distintos** para inox 1.5 mm / R 1.5 mm (0.3801 y 0.27326) —
> el dato de campo tiene ruido y el software no debe fingir que no. Encima, el cliente documenta que
> confundir el **ángulo de doblez α** con el **ángulo de apertura β** *"can lead to a lot of confusion
> and errors"*, y que una tabla de Inventor viejo **asume β mientras el feature usa α**. Una máquina
> lineal guarda un campo `K` y un campo `ángulo` y produce piezas mal cortadas sin explicación.

> **⭐10 — Ningún manual da velocidad de corte… y La Forja ya la está inventando.**
> **F2 no contiene una sola tabla de Vc ni de fz** — es catálogo de distribuidor. Mientras tanto,
> `ForgeBRepStudio.tsx` usa `rpm = 100000/(π·D)` en tres lugares (4771, 4848, 4878) y `rpm: 7850`/`7878` literales en otros dos: **Vc ≈ 100 m/min para aluminio,
> para 4140 y para P20 endurecido por igual**, y `tool-stress.ts` — que sí tiene `vcMin`/`vcMax` por
> material — está desconectado, con su propio test como único consumidor. El gemelo de este pecado
> está en el costeo: `moldmachine.ts:170` elige el factor de maquinado con umbrales de complejidad
> (`>2.5 → EDM`), cuando el libro dice que es un **promedio ponderado por la proporción de uso real
> de cada proceso** (Kazmer §3.3.1.3, Tabla 3.4). Una máquina lineal rellena el hueco con un número
> plausible; el maquinista **deja el hueco visible** y exige el dato del taller —
> *"the negotiated machinist's rate should be used if this data is available"*.

---

## Cierre — la frase del cliente que resume el pliego

> *"This error detection **does not limit the shapes which can be cut**, but it does require that the
> programmer **specify the actual shape to be cut**, not an approximation."*
> — NIST RS274/NGC Interpreter v3, Apéndice B.5.1

El maquinista no nos pide un CAM que resuelva todo. Nos pide uno que **no mienta**: que diga qué
radio exige la cavidad, qué herramienta existe en México para hacerlo, cuánto va a EDM, y dónde
el programa va a chocar. Lo demás ya lo sabe hacer él.
