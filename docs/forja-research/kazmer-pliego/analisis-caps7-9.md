# EL PLIEGO DE ANÁLISIS — Kazmer caps. 7–9
## Ingeniería inversa del modelo mental: qué se calcula, en qué orden, y qué decide

**Fecha:** 2026-08-06 · **Alcance:** cap. 7 (compuertas), cap. 8 (venteo), cap. 9 (enfriamiento),
más los dos análisis del cap. 10 que **cierran** el argumento del cap. 9 (contracción y alabeo).

---

## Por qué existe este documento

El libro de Kazmer **no tiene** un capítulo llamado "análisis a realizar". Tiene a un ingeniero
razonando en voz alta. Cada vez que compara, despeja, sustituye un número o dicta un veredicto,
eso es un análisis — y el grafo que los conecta lo da por obvio porque lo tiene en la cabeza.
Este pliego lo vuelve explícito.

Ya se hicieron dos lecturas del mismo corpus con otras lentes:
- **UI** — `pliego-UI-v2.md`, `pliego-caps7-9.md`, `libro-caps7-9.md` (qué pantallas hacen falta).
- **Verificación visual** — `verificaciones-visuales.md`, 122 fichas (qué se juzga MIRANDO).

Ésta es la tercera: **ANÁLISIS** (qué se calcula, con qué entra, qué sale, y qué decide).

## Qué cuenta como "análisis" aquí

Unidad de razonamiento que **toma datos, produce un número o un veredicto, y alimenta una decisión**.
Si no alimenta ninguna decisión, es lección, no análisis, y no tiene ficha.

Cada ficha lleva nueve campos fijos:

| Campo | Qué contiene |
|---|---|
| **ID y nombre** | `A-nn`, numeración corrida a lo largo de los tres capítulos |
| **CUÁNDO** | en qué momento del flujo se corre |
| **ENTRADAS** | y de qué análisis vienen (`←A-nn`) — esto es lo que arma el grafo |
| **EL CÁLCULO** | ecuación literal con su número de ecuación del libro; si es cualitativo, se dice |
| **SALIDA** | con unidades |
| **DECIDE** | la decisión concreta que alimenta |
| **CRITERIO** | umbral del libro / comparación / juicio humano — se declara CUÁL de los tres |
| **INVALIDA** | qué lo tira a la basura y obliga a recorrerlo |
| **¿TENEMOS?** | archivo y función en `src/forja/mold/`, o **FALTA** |

## Fuente y su límite (regla dura)

Los tomos crudos del libro **ya no existen** (se perdieron en una limpieza de disco). Este pliego se
construyó sobre el corpus DERIVADO, que sí conserva **citas literales verificadas con grep**:
`libro-caps7-9.md`, `pliego-caps7-9.md`, `verificaciones-visuales.md` (fichas V7.x/V8.x/V9.x) y `cruce.md`.

- **Toda cita entre comillas de este documento existe textualmente en el corpus.** Verificado con
  `grep -rlF` archivo por archivo.
- Lo que no es cita y es deducción mía va marcado **`INFERIDO`**.
- Lo que sospecho que el libro dice y el corpus derivado **no capturó** va marcado
  **`NO OBSERVADO EN EL CORPUS`** — es información útil (dice dónde volver a leer si el tomo reaparece),
  no un fracaso.

## Convenciones

- Fórmulas en ASCII. `alpha` = difusividad térmica, `gammadot` = tasa de corte, `Vdot` = caudal
  volumétrico, `Qdot` = potencia, `mu` = viscosidad, `rho` = densidad.
- **[LIBRO]** = umbral numérico explícito del libro · **[COMPARA]** = el criterio es una comparación
  entre dos análisis · **[JUICIO]** = Kazmer decide sin número (y lo dice).
- Las tres piezas de ejemplo del libro se citan por su nombre: **bezel** (marco de tablet, ABS,
  pared 1.5 mm), **cup** (vaso, ABS, pared 3 mm) y **lid** (tapa, ABS, pared 2 mm).
- **Numeración:** `A-01 … A-71` son locales a este tomo. `analisis-caps4-6.md` declara la regla de
  fusión: sus IDs son `A-01…A-76` y **los de este tomo se corren a partir de A-77** al empalmar los
  cuatro. Dentro de este documento se usan siempre los locales.

## Tres cosas que este tomo trata como de primera clase, porque el libro las trata así

1. **Los semáforos que DISCREPAN.** Corte, presión y congelamiento son tres veredictos
   **independientes** sobre la misma compuerta, y el libro los pone a pelear a propósito: un corte
   de 132,000 s⁻¹ que "se ve" fatal da un ΔP de 1.9 MPa aceptable, y una compuerta con corte y
   presión en verde puede dejar la pieza mal empacada. Literal (§7.1.5): *"the dimensions should be
   adjusted **even if the shear rates and pressure drops were found acceptable**"*. Un motor que
   promedie los tres en un score pierde exactamente lo que el libro enseña.
2. **La dirección del error.** Casi todo lo que se calcula aquí es un **mínimo teórico** que la
   realidad supera: el congelamiento de la compuerta (*"gate pack times should be expected to be
   significantly longer than those predicted"*, §7.3.4), el tiempo de enfriamiento (§9.2.1 notas 1–2),
   el mínimo del venteo (§8.2.3). Y los diseños se entregan a propósito **por debajo** del óptimo
   (steel-safe: compuerta chica, venteo delgado). El signo del sesgo es parte del resultado.
3. **La cadena del cap. 9 es UNA sola.** De la pieza al tiempo de ciclo, al calor, al caudal, al
   diámetro, a la profundidad, al paso, al ruteo, al campo térmico y al alabeo. Veintitantos
   análisis encadenados donde **cada número sale del anterior** — y con un lazo interior declarado
   por el propio Kazmer sobre el número de líneas (§9.2.2). No es un wizard de 7 pasos: es un
   sistema con realimentación.

---

# FASE A — COMPUERTAS (cap. 7)

El cap. 7 declara **5 objetivos en conflicto** (§7.1) y **5 pasos** (§7.3). Los objetivos no son
análisis (son la función objetivo); los pasos sí. La forma del capítulo: se **siembra** una
dimensión por regla de dedo, se corren tres veredictos independientes sobre ella, y se ajusta —
a veces la dimensión, a veces el tipo de compuerta, y a veces **el tipo de molde**.

### A-01 · Ruta de degatado (¿quién separa la colada de la pieza?)
- **CUÁNDO:** al arrancar el cap. 7, antes de elegir el tipo de compuerta — porque es uno de los
  cuatro factores primarios de esa elección.
- **ENTRADAS:** tipo de molde (2 placas / 3 placas / canal caliente) ←cap. 4 · si el moldeador tiene
  robot · costo de mano de obra del taller.
- **EL CÁLCULO:** cualitativo, selección entre 4 rutas. La meta literal (§7.1.2): *"the gate and
  runners should be automatically disconnected from the molding at the time of ejection"*. Las tres
  vías al automático: (1) acción de apertura del molde (túnel en 2 placas, pin-point en 3 placas),
  (2) canal caliente con compuertas térmicas o de válvula (elimina el degatado), (3) robot con
  cortador. La cuarta es la manual, y su costo está cuantificado en consecuencias, no en pesos:
  *"the handling and de-gating of moldings by the operator can also limit the cycle time and induce
  defects into the moldings"*.
- **SALIDA:** ruta elegida ∈ {apertura del molde, canal caliente, robot, manual} + la nota de
  coordinación obligatoria si es robot.
- **DECIDE:** el filtro de la columna "degatado" de la Tabla 7.1 en A-02; y, si es robot, dispara una
  conversación con el moldeador — literal: *"the mold designer should discuss alternative gate types
  and locations with the molder to provide access for pick-up of the molding and de-gating"*.
- **CRITERIO:** **[JUICIO]** con sesgo declarado hacia el automático. Ojo con la nota 2 de la
  Tabla 7.1: la columna "degatado" **no considera robots**, solo la acción del molde.
- **INVALIDA:** cambio de tipo de molde (cap. 4); que el moldeador cambie de celda.
- **¿TENEMOS?** **PARCIAL — está como contrato, no como decisión.** `mold-contratos.ts` id
  `gate-degatado` (§7.1.2 · §7.2.7) cruza
  el tipo de compuerta con el ensamble y detecta el caso mortal del túnel sin sucker pins. Lo que
  **FALTA** es la pantalla de decisión previa: la ruta se infiere del tipo, no se elige antes.

### A-02 · Selección del TIPO de compuerta (Tabla 7.1)
- **CUÁNDO:** paso 1 de §7.3, después de A-01. Y otra vez cada vez que A-07 o A-13 escalan.
- **ENTRADAS:** tipo de runner (frío/caliente) ←cap. 6 · ruta de degatado ←A-01 · corte permisible
  del material ←ficha de material · flujo deseado (radial vs lineal) ←cap. 5.
- **EL CÁLCULO:** consulta tabular sobre 10 tipos × 4 atributos. Los cuatro factores primarios,
  literal: *"the type of runner system, the desired method of de-gating, the allowable level of
  shear rates through the gate, and the resulting flow that is desired."* Calibración de los
  regímenes de corte (nota 3 de la tabla): bajo ≈ **10,000 s⁻¹**, moderado ≈ **40,000 s⁻¹**, alto ≈
  **100,000 s⁻¹**. Nota 4: solo **fan, flash y diafragma** producen flujo lineal; los otros siete, radial.
- **SALIDA:** tipo ∈ {sprue, pin-point, edge, tab, flash/diaphragm, fan, tunnel/submarine,
  thermal pin-point, thermal sprue, valve} + un quinto atributo que el libro añade fuera de la tabla:
  **¿se puede agrandar en el tryout?** (§7.3.5).
- **DECIDE:** todo lo que sigue — la geometría de la semilla (A-05), qué fórmula de corte aplica
  (tira vs cilindro, A-06), si hay reglas geométricas extra (A-14) y el vestigio esperado (A-03).
- **CRITERIO:** **[JUICIO]** declarado como tal: *"Often, the selection of a type of gate is obvious."*
  El experto reconoce el tipo de golpe y luego valida; el software debe permitir **saltar** a un tipo.
- **INVALIDA:** cambio de tipo de molde o de runner; y **la propia dimensión**: ensanchar un edge gate
  más allá del diámetro del runner *"would require a change in the gate type to a fan gate"* (§7.3.2).
- **¿TENEMOS?** **SÍ.** `gating.ts::GATE_TABLE` reproduce la Tabla 7.1 completa (10 tipos × runner /
  degating / shear / flow) y `gating.ts::GATE_AGRANDABLE` añade el quinto atributo del §7.3.5.
  El contrato `mold-contratos.ts` id `gate-tipo` lo audita. **Hueco menor:** el híbrido de la nota 1
  (*"a hot runner system in which each drop feeds a plurality cold 'sub-runners'"*, 4 drops × 4 = 16
  cavidades) no está modelado — el tipo de runner es global, no por rama.

### A-03 · Zona gateable y destino del vestigio
- **CUÁNDO:** junto con A-02, antes de dimensionar. Es una restricción de ubicación, no de tamaño.
- **ENTRADAS:** superficies visibles al usuario ←cap. 2 (worksheet de estética) · superficies de
  acoplamiento del ensamble · mapa de espesores de la pieza ←cap. 2.
- **EL CÁLCULO:** cualitativo, clasificación por superficie. Dos recetas del libro (§7.1.3):
  (a) *"use a very small gate (such as a pin-point gate) in combination with a coarse texture such
  that the gate vestige is less apparent"*; (b) *"locate gates on non-visible surfaces such as
  underneath a side wall instead of into the side wall"*. Y para el tab gate (§7.2.4) la regla
  maestra: *"The key to their effectiveness is to establish potential gating areas where their
  remnants will not affect the aesthetics or functionality of the resulting moldings."*
- **SALIDA:** conjunto de superficies `gateable` / `prohibida` + el veredicto del vestigio
  `invisible / visible / interfiere con acoplamiento`.
- **DECIDE:** dónde puede caer la compuerta; y **al revés**, si el vestigio queda interno al ensamble,
  desbloquea usar el espesor COMPLETO de la pared adyacente en vez de gatear por debajo
  (§7.2.3: *"the edge gate can and should utilize the full thickness of the adjacent wall section"*).
  **La estética solo cuesta cuando se ve.**
- **CRITERIO:** **[JUICIO]** binario por superficie, con una alarma que no es estética sino funcional:
  *"any significant gate vestige may interfere with mating surfaces in the product assembly"*.
- **INVALIDA:** cambio del worksheet de estética; cambio de la orientación de uso de la pieza.
- **¿TENEMOS?** **PARCIAL — la mitad visible sí, la mitad funcional no.**
  `visibilidad.ts::clasificarVisibilidad` rasteriza
  la pieza desde puntos de vista de uso y marca superficies visibles;
  `visibilidad.ts::juzgarMarcas` juzga la marca de compuerta contra esa clasificación citando
  §7.1.3 · Fig 7.1. **Hueco:** la segunda mitad del criterio —interferencia con **superficies de
  acoplamiento**— no se evalúa; solo la visibilidad.

### A-04 · Caudal volumétrico supuesto por compuerta
- **CUÁNDO:** antes del primer cálculo de corte. Es la entrada que **condiciona todos los veredictos**
  de esta fase.
- **ENTRADAS:** caudal total en la boquilla ←cap. 5 (análisis de llenado) · número de compuertas ←
  layout de alimentación (cap. 6).
- **EL CÁLCULO:** reparto simple `Vdot_gate = Vdot_nozzle / n_gates`. Ejemplo bezel: 125 cc/s en la
  boquilla con 2 edge gates → **62.5 cc/s por compuerta**.
- **SALIDA:** caudal por compuerta [m³/s].
- **DECIDE:** el valor de corte (A-06) y de ΔP (A-10); y su **incertidumbre** decide si los veredictos
  se emiten como firmes o como condicionados.
- **CRITERIO:** **[JUICIO]**, y el libro lo declara supuesto: *"the mold designer should assume a
  reasonable flow rate for analysis"*. El caudal real no se conocerá hasta que el moldeador optimice
  el proceso — por eso el registro del supuesto es parte del entregable.
- **INVALIDA:** que el moldeador fije otro caudal; que cambie el número de compuertas o el tiempo de
  llenado objetivo. La palanca inversa también existe: bajar de 125 a 60 cc/s arregla el corte pero
  *"would require a doubling of the filling time"*.
- **¿TENEMOS?** **PARCIAL.** `gating.ts::designGateProcess` recibe `VdotM3s` como entrada y lo usa en
  toda la cadena; el reparto entre compuertas y el **registro del supuesto con su condicionalidad**
  no existen como objeto. El expediente (`expediente.ts`) sí vuelca el plan de tryout, pero no
  etiqueta los veredictos como "condicionados al caudal supuesto".

### A-05 · Semilla dimensional de la compuerta
- **CUÁNDO:** paso 2 de §7.3, **antes** de calcular nada. Es el arranque que un optimizador se saltaría.
- **ENTRADAS:** tipo de compuerta ←A-02 · espesor de pared de la pieza **en el punto de la compuerta**
  ←cap. 2 · longitud de la arista donde se quiere flujo lineal (solo flash/diafragma) ←A-16.
- **EL CÁLCULO:** regla de dedo por clase (§7.3.2), toda ella tabular:
  - gruesos (**sprue, edge, tab, fan, valve**): `h0 = espesor de pared en la compuerta`
  - delgados (**pin-point, flash, diaphragm, tunnel, submarine, thermal**): `h0 = espesor de pared / 2`
  - ancho de tira: flash y diafragma → `W0 = longitud de la arista` (para el diafragma, la
    **circunferencia**); los demás → `W0 = 2 · h`, y de ahí se sube o baja para ajustar el corte.
- **SALIDA:** `h0` [mm] y `W0` [mm] (o `D0` para cilíndricas).
- **DECIDE:** el punto de partida de la iteración A-06 → A-07. No es una decisión de diseño: es la
  condición inicial del lazo.
- **CRITERIO:** **[LIBRO]**, regla de dedo pura, sin justificación física en el texto.
- **INVALIDA:** cambio de tipo (A-02) o de espesor local de la pieza.
- **¿TENEMOS?** **SÍ, literal.** `gating.ts::gateDesign` y `gating.ts::designGateProcess` (paso 2)
  aplican exactamente la partición grueso/delgado y `W0 = 2h`. El comentario del código cita §7.3.2.

### A-06 · Tasa de corte de la compuerta y su veredicto
- **CUÁNDO:** paso 2 de §7.3; se re-corre en cada iteración de dimensión.
- **ENTRADAS:** caudal por compuerta ←A-04 · dimensiones ←A-05 (o ←A-07 en iteraciones) ·
  geometría equivalente ←A-08 · `gammadot_max` del material (Apéndice A o dato del proveedor).
- **EL CÁLCULO:** Tabla 7.2, dos geometrías (versión newtoniana; el libro da también las variantes
  power-law):
  - tira: `gammadot = 6·Vdot / (W · h^2)`
  - cilindro: `gammadot = 4·Vdot / (pi · R^3)`
  Se calcula con **caudal volumétrico**, no con velocidad lineal, porque la máquina solo controla el
  caudal. Para el sprue gate hay una regla especial: *"For the verification of the shear rate, the
  smallest diameter of the sprue should be used."*
- **SALIDA:** `gammadot` [s⁻¹] + veredicto verde/rojo.
- **DECIDE:** si se acepta la dimensión, si se ensancha (A-07), si se baja el caudal (A-04), o si se
  **cambia el tipo** (A-02). El bezel es el caso escuela: `h=0.75 mm, W=6 mm, 62.5 cc/s → 111,000 s⁻¹`
  contra un máximo de 50,000 → ensanchar a 14 mm (pero eso ya es un fan gate) o bajar a 60 cc/s
  (pero eso duplica el llenado).
- **CRITERIO:** **[LIBRO] con confianza declarada baja.** *"the shear rate should be calculated and
  verified that it is below the maximum permissible value"*, pero el máximo tabulado es blando:
  *"the maximum shear rates are dependent not just on the maximum shear rate, but also the entire
  thermal and mechanical history of the polymer melt. In many if not most cases, much higher shear
  rates may be possible."* Y manda el proveedor: *"the mold designer should consult with the material
  supplier for application-specific data"*.
- **INVALIDA:** cambio de caudal, de dimensión, de material o del dato del proveedor. Si excede, los
  defectos que el libro enumera **en orden** son: degradación del material; flujo no laminar y
  jetting; splay y otros defectos visuales; tiempos de llenado extendidos; short shots.
- **¿TENEMOS?** **PARCIAL — la fórmula newtoniana sí, la calibración no.**
  `gating.ts::shearRateStrip` (`6·Vdot/(W·h²)`) y `gating.ts::shearRateCyl`
  (`4·Vdot/(pi·R³)`); veredicto en `designGateProcess` y contrato `gate-shear` (§7.1.4).
  **Huecos:** (a) las variantes **power-law** de la Tabla 7.2 no están (solo la newtoniana);
  (b) no existe la **bandera de confianza** sobre `gammadot_max` — el máximo entra como número duro,
  cuando el libro insiste en que es orientativo; (c) la regla del **diámetro menor del sprue** no está
  automatizada.

### A-07 · Despeje inverso: la dimensión que da el corte objetivo
- **CUÁNDO:** cuando A-06 reprueba. Es el atajo que evita iterar a ciegas.
- **ENTRADAS:** caudal ←A-04 · `gammadot_max` ←material.
- **EL CÁLCULO:** para compuerta cilíndrica, despeje directo de la fórmula de A-06:
  `R = cbrt( 4·Vdot / (pi · gammadot_max) )`. Ejemplo cup: 1.03 mm → **⌀ ≈ 2 mm**.
  Para tira se despeja el ancho `W = 6·Vdot / (gammadot_max · h^2)`.
- **SALIDA:** dimensión mínima que satisface el corte [mm].
- **DECIDE:** el nuevo tamaño candidato — **pero no se adopta tal cual**. El libro inmediatamente
  contrapone el costo: *"This larger diameter would leave a larger gate vestige and require greater
  forces for de-gating. It may be reasonable to initially specify the lesser diameter of 1.5 mm, and
  then increase the diameter if issues are encountered"*. O sea: el despeje da el número, y A-17
  decide especificar **menos**.
- **CRITERIO:** **[COMPARA]** el resultado del despeje contra el costo del vestigio y la fuerza de
  degatado. En el edge gate hay además un umbral de clase: si el ancho necesario supera el diámetro
  del runner, ya no es un edge gate.
- **INVALIDA:** lo mismo que A-06.
- **¿TENEMOS?** **SÍ.** `gating.ts::gateRadiusForShear` = `Math.cbrt((4*Vdot)/(Math.PI*shearMax))`,
  literal. Y `designGateProcess` itera el ancho hasta 12 veces y **escala de tipo** cuando el ancho
  cruza el umbral (contrato `gate-escala-nivel`, §7.3.2 · §7.3.4).

### A-08 · Reducción a geometría equivalente (diafragma y fan)
- **CUÁNDO:** antes de A-06 y A-10, cuando el tipo no es una tira ni un cilindro limpios.
- **ENTRADAS:** geometría real de la compuerta ←A-02/A-05.
- **EL CÁLCULO:** dos conversiones distintas, ambas declaradas:
  - **Diafragma → tira.** Literal: *"Even though the geometry of the diaphragm gate is cylindrical,
    the analysis is correctly performed according to a strip geometry with a width equal to the
    circumference of the diaphragm."* Es decir `W = pi · D_diafragma`.
  - **Fan → segmentos o promedio.** La sección varía a lo largo: *"The fan gate could be broken into
    a number of small segments each with a different section"*, o la aproximación de rectángulo con
    ancho y espesor **a la mitad del camino** entre el inicio circular y el final rectangular.
- **SALIDA:** `(W_eq, h_eq)` o la lista de segmentos.
- **DECIDE:** qué fórmula de A-06/A-10 se aplica. Y desactiva una alarma: estos tipos *"parecen"*
  imponer corte brutal por delgados, pero *"these gates' large width will result in relatively low
  linear melt velocities even at high volumetric flow rates"*.
- **CRITERIO:** **[LIBRO]**, es una regla de modelado, no un umbral. La conversión debe ser **visible**
  en pantalla, no silenciosa.
- **INVALIDA:** cambio de tipo o de geometría del abanico.
- **¿TENEMOS?** **FALTA.** `gating.ts` trata `flash` y `fan` con las mismas fórmulas de tira usando el
  ancho que se le pase; no hay conversión `W = pi·D` para el diafragma ni segmentación del fan.
  Es un hueco barato y de consecuencia grande: sin la conversión, un diafragma se dimensiona con el
  ancho equivocado por un factor de pi·D/h.

### A-09 · Viscosidad evaluada a la tasa de corte de la compuerta
- **CUÁNDO:** entre A-06 y A-10. Es el eslabón que hace que los dos veredictos puedan discrepar.
- **ENTRADAS:** `gammadot` ←A-06 · modelo reológico del material (Cross-WLF o power-law).
- **EL CÁLCULO:** la Tabla 7.3 ofrece dos rutas: newtoniana *"usando viscosidad evaluada A LA SHEAR
  RATE del gate vía Cross-WLF"*, o directamente power-law.
- **SALIDA:** `mu` [Pa·s] a las condiciones de la compuerta.
- **DECIDE:** el ΔP de A-10 — y con él, la posibilidad de que un corte "fatal" dé una presión sana.
- **CRITERIO:** **[LIBRO]** como método. El número resultante es la contraintuición estrella del
  capítulo: `gammadot = 132,000 s⁻¹` con `mu = 5.4 Pa·s` por shear thinning → `ΔP = 1.9 MPa`, aceptable.
- **INVALIDA:** cambio de material o de temperatura de masa.
- **¿TENEMOS?** **PARCIAL.** `filling.ts::viscosityPowerLaw` implementa la rama power-law
  (`ABS_MG47` con k=17070, n=0.348) y `gating.ts::gateDropStripPL` la usa. **La rama Cross-WLF no
  existe** en `src/forja/mold/` — solo power-law. Con power-law se reproduce el ejemplo, pero el
  libro nombra Cross-WLF como la ruta principal.

### A-10 · Caída de presión de la compuerta y su veredicto
- **CUÁNDO:** paso 3 de §7.3, después de A-06 y A-09.
- **ENTRADAS:** dimensiones ←A-05/A-07 · caudal ←A-04 · viscosidad ←A-09 · longitud de la compuerta.
- **EL CÁLCULO:** Tabla 7.3:
  - tira power-law: `dP = (2·k·L/H) · [ 2·(2 + 1/n)·Vdot / (W·H^2) ]^n`
  - cilindro newtoniano: `dP = 8·mu·L·Vdot / (pi·R^4)`
  Caso especial: el **sprue gate no tiene longitud → ΔP = 0 por definición**.
- **SALIDA:** `dP` [MPa].
- **DECIDE:** si la compuerta se acepta, se acorta o se engruesa; y alimenta el presupuesto de presión
  disponible para llenar la cavidad.
- **CRITERIO:** **[LIBRO]**, tres bandas: típico *"on the order of 2 MPa (300 psi)"*; **6 MPa**
  *"potentially excessive dependent on the availability of melt pressure to fill the mold cavity"*;
  y **10 MPa** = rojo directo, *"Pressure drops above 10 MPa are usually indicative of improperly
  designed gates that are either too thin or too long."* Nota de secuencia (§7.1.4): *"If the shear
  rate is permissible, then the pressure drop is usually acceptable as well. However, the mold
  designer should calculate the pressure drop to ensure that it is not excessive."* — *usually*,
  no *always*: por eso es un veredicto propio.
- **INVALIDA:** lo mismo que A-06, más cambio de longitud de la compuerta.
- **¿TENEMOS?** **SÍ.** `gating.ts::gateDropStripPL` y `gating.ts::gateDropCylNewt` son las dos
  fórmulas de la Tabla 7.3, literales; el veredicto vive en `designGateProcess` (`dpVeredicto`) y en
  el contrato `gate-dp` (§7.1.4 · §7.3.3). La banda de 6 MPa aparece; la de 2 MPa como referencia
  típica está en el reporte.

### A-11 · Tiempo de congelamiento de la compuerta
- **CUÁNDO:** paso 4 de §7.3.
- **ENTRADAS:** dimensión final de la compuerta ←A-07 · `alpha` del material · `T_melt`, `T_cool` ·
  **`T_no_flow`** del Apéndice A.
- **EL CÁLCULO:** Tabla 7.4:
  - tira: `ts = (h^2 / (pi^2 · alpha)) · ln( (8/pi^2) · (Tmelt − Tcool)/(Tnoflow − Tcool) )`
  - cilindro: `ts = (D^2 / (23.1 · alpha)) · ln( 0.692 · (Tmelt − Tcool)/(Tnoflow − Tcool) )`
  El criterio de "no flujo" del Apéndice A es una **viscosidad de 100,000 Pa·s "arbitrarily selected"**
  (Fig 7.18).
- **SALIDA:** `ts` [s] — el tiempo mínimo de empaque que permite la compuerta.
- **DECIDE:** nada por sí solo. Su valor está en A-12.
- **CRITERIO:** **[LIBRO]** con sesgo declarado: son **mínimos**. Asumen conducción perfecta e
  **ignoran la convección** del flujo que sigue cruzando la compuerta y que tiende a impedir que
  congele. Literal: *"gate pack times should be expected to be significantly longer than those
  predicted."* Sirve para orden de magnitud, no para ajuste fino.
- **INVALIDA:** cambio de dimensión, material o temperaturas del proceso.
- **¿TENEMOS?** **SÍ, y con una errata del libro documentada.** `gating.ts::gateFreezeStripS` y
  `::gateFreezeCylS` son las dos ecuaciones literales. El comentario del código deja constancia de
  que el ejemplo cilíndrico (pin-point ⌀2 mm → 1.1 s) **reproduce exacto**, pero los dos ejemplos de
  tira impresos en el libro (fan 1.5 s, cup 24 s) **no reproducen con su propia fórmula** (dan 0.76 s
  y 12.1 s, factor 2) → se toma la fórmula como canon y los números impresos como errata.

### A-12 · Semáforo congelamiento vs empaque requerido (el veredicto que puede tirar todo)
- **CUÁNDO:** inmediatamente después de A-11, y es el **último** de los tres semáforos de la compuerta.
- **ENTRADAS:** `ts` de la compuerta ←A-11 · tiempo de solidificación de la sección de la pieza que
  hay que empacar ←A-39 (cap. 9).
- **EL CÁLCULO:** comparación directa `ts_gate` vs `tc_pieza`. Caso escuela del cup: compuerta de
  2 mm congela en **1.1 s** contra una pared de 3 mm que necesita **24 s** → *"It is likely that the
  gate will freeze prematurely and the cup may not be adequately packed"*.
- **SALIDA:** veredicto ∈ {prematuro, adecuado, eterno} + el delta en segundos.
- **DECIDE:** si se ajustan dimensiones **aunque los otros dos semáforos estén verdes**. Literal
  (§7.1.5): *"If the packing time is unexpectedly short or long, then the dimensions should be
  adjusted even if the shear rates and pressure drops were found acceptable."* Y la razón de fondo:
  *"It is really the gate, and not the molding machine, that determines the packing time of the cavity."*
- **CRITERIO:** **[COMPARA]** entre dos análisis, sin umbral absoluto. Las dos puntas duelen:
  compuerta chica → congela prematuro → contracción volumétrica excesiva; compuerta grande → o el
  molde aguanta un empaque larguísimo, o el fundido **se regresa** de la cavidad al runner.
- **INVALIDA:** cualquier cambio en A-11 o en el tiempo de enfriamiento de la pieza (A-39/A-41).
  Nota de acoplamiento con el proceso: *"the molder should set up the molding machine to end the
  packing stage at gate freeze-off and begin the plastication stage."*
- **¿TENEMOS?** **SÍ.** `designGateProcess` calcula `freezeCorto = r.freezeS < o.tPackNeededS`
  y lo reporta como paso 5 con su cita; contrato `gate-freeze` (§7.1.5 · §7.3.4). El `ok` final del
  diseño exige los tres: `shear <= max && dPMPa <= 10 && !freezeCorto`.

### A-13 · ¿La compuerta entra a una sección delgada?
- **CUÁNDO:** junto con A-12, y es el disparador del retorno más caro del capítulo.
- **ENTRADAS:** espesor local de la pieza **en el punto de entrada** ←cap. 2 · espesor de la sección
  que hay que empacar (la gruesa vecina).
- **EL CÁLCULO:** comparación de espesores locales. El disparador literal del tab gate (§7.2.4):
  el edge gate a sección delgada *"can cause premature freeze-off of the flow and excessive
  volumetric shrinkage in the surrounding thicker sections."*
- **SALIDA:** booleano + la razón `h_gate / h_max_pieza`.
- **DECIDE:** tres salidas escalonadas, en orden de costo:
  1. **Tab gate:** costilla permanente de espesor nominal que conecta el runner con la porción gruesa,
     saltándose el marco delgado. Con un defecto aceptado a propósito: *"sink will likely develop on
     the top surface. However, this issue is not significant since this area is hidden by the screen
     assembly."*
  2. **Cambio de arquitectura:** *"this edge gate design does gate into a thinner section of the mold
     cavity, which is not recommended. For this reason, a three-plate mold or hot runner mold should
     be considered to provide gating into the thicker 1.5 mm section with a longer packing time."*
  3. Y una alarma que cierra la puerta al arreglo fácil: si el espesor de la compuerta ya es igual al
     de la pieza en ese punto, **agrandar la compuerta no mejora el empaque lejos de ella**.
- **CRITERIO:** **[LIBRO]** cualitativo pero tajante — *"is not recommended"*.
- **INVALIDA:** rediseño de la pieza (espesores) o reubicación de la compuerta.
- **¿TENEMOS?** **PARCIAL.** El contrato `gate-escala-nivel` (§7.3.2 · §7.3.4) existe y modela la
  escalada de nivel de abstracción, y `lamina-compuerta.ts` dibuja la lámina V7.4 (edge → tab).
  Lo que **FALTA** es la medición automática del **espesor local de la pieza en el punto de entrada**
  contra el mapa de espesores, que es exactamente lo que la ficha visual V7.4 declara juzgable por
  píxeles: *"Comparar el espesor local de la pieza en el punto de entrada contra el espesor máximo"*.

### A-14 · Geometría del túnel: los tres números que "must be specified"
- **CUÁNDO:** solo si A-02 eligió tunnel/submarine. Antes de liberar a maquinado.
- **ENTRADAS:** eje del túnel · plano de partición · diámetro del túnel.
- **EL CÁLCULO:** tres medidas geométricas sobre la sección, todas con umbral literal:
  1. *"a nominal 45 degree angle should be maintained between the centerline of the tunnel gate and
     the parting plane to allow for the transmission of shearing stresses to the gate"*
  2. *"the tunnel gate should have an included taper angle of at least 20 degrees to ensure that the
     tunnel gate does not stick in the mold and that the tunnel gate breaks at the junction with the
     molding"*
  3. *"To ensure adequate structural integrity of the cavity undercut, the tunnel gate should be
     located at least three tunnel diameters off the parting plane."*
- **SALIDA:** tres números (grados, grados, múltiplos de diámetro) + veredicto por cada uno.
- **DECIDE:** si el degatado automático por apertura del molde va a funcionar, y si el undercut de la
  cavidad sobrevive.
- **CRITERIO:** **[LIBRO]**, los tres umbrales son explícitos. La ficha visual V7.7 los llama
  *"de las mejores"* para juzgar por píxeles: tres números leídos de una sola vista.
- **INVALIDA:** mover la compuerta o cambiar su diámetro. Modo de falla temporal declarado:
  *"The primary risk in application is that the tunnel gate may be improperly designed or wear such
  that the runner system does not reliably de-gate"* — **el desgaste mata el degatado**: pasa el
  tryout y falla en producción.
- **¿TENEMOS?** **SÍ, y bien.** `lamina-apertura.ts` implementa las tres cotas con sus citas
  (línea 80: *"the tunnel gate should have an included taper angle of at least 20"*) y emite la
  verificación `V7.7` con el criterio completo; `lamina-compuerta.ts` dibuja la sección acotada.
  `feed-layouts.ts` genera el túnel a 45°/20°.

### A-15 · Retención del sistema de alimentación del lado del núcleo
- **CUÁNDO:** junto con A-14, y es el análisis que **no se puede hacer mirando solo la compuerta**.
- **ENTRADAS:** lado donde queda el runner al abrir ←cap. 6 · presencia de sucker pins ←cap. 6 ·
  tipo de molde.
- **EL CÁLCULO:** cualitativo, un booleano de ensamble. Literal: *"the runners should be designed with
  nearby sucker pins to retain the runner system on the core side. If the tunnel gates and the runner
  system remain on the cavity side, then they can not be removed through actuation of the ejection
  system."*
- **SALIDA:** veredicto `degatado automático viable / imposible`.
- **DECIDE:** si el molde puede operar desatendido. Sin esto, A-01 mintió.
- **CRITERIO:** **[LIBRO]** binario. En 3 placas lo resuelve el propio stripper plate; en 2 placas hay
  que especificar los sucker pins.
- **INVALIDA:** cambio del layout de alimentación o del lado de retención.
- **¿TENEMOS?** **SÍ.** `mold-contratos.ts` id `gate-degatado` lo evalúa explícitamente y distingue
  el caso de 3 placas del de 2 placas; `lamina-compuerta.ts` importa `suckerPinDesign` de
  `threeplate.ts` y dibuja la intrusión del sucker en el canal (V6.5, §6.5.2).

### A-16 · Criterios de flujo lineal (fan, flash, diafragma)
- **CUÁNDO:** solo si el patrón de llenado deseado es lineal (viene del cap. 5).
- **ENTRADAS:** ancho de la pieza donde se quiere flujo lineal · geometría del abanico ←A-02/A-05 ·
  resistencia de flujo a lo ancho ←A-08.
- **EL CÁLCULO:** dos condiciones que el libro marca como obligatorias (*"must be met"*, §7.2.5):
  *"First, the fan gate must span the width of the molding across which linear flow is desired.
  Second, the flow resistance across the width of the fan gate must be negligible."*
  Para el flash gate, la condición equivalente es de contraste de resistencias: *"the flow resistance
  along the thick section is small compared to the flow resistance across the thin section"*.
- **SALIDA:** dos booleanos (cobertura del ancho; resistencia transversal despreciable) + la razón
  `ancho_abanico / ancho_pieza`.
- **DECIDE:** si el flujo lineal se va a lograr o si el frente va a salir en arco a pesar del abanico.
- **CRITERIO:** **[LIBRO]** la primera condición es medible (razón ≈ 1); **[COMPARA]** la segunda.
  La ficha visual V7.5 añade el testigo: en el mapa de isócronas el frente debe salir **recto**.
- **INVALIDA:** cambio de ancho de la pieza o de la geometría del abanico.
- **¿TENEMOS?** **FALTA.** El tipo `fan` existe en `GATE_TABLE` con `flow: 'linear'`, pero ninguna
  función verifica las dos condiciones. Tampoco se contrasta contra el campo de llenado
  (`flowlen.ts` / `flowlen-surface.ts` tienen el frente, y nadie les pregunta si salió recto).

### A-17 · Decisión steel-safe de la compuerta
- **CUÁNDO:** al cerrar el dimensionado, después de que A-06/A-10/A-12 dieron verde.
- **ENTRADAS:** dimensión que satisface los tres semáforos ←A-07 · incertidumbre del caudal ←A-04 ·
  el atributo "¿se puede agrandar?" del tipo ←A-02.
- **EL CÁLCULO:** cualitativo con una dirección fija. Literal: *"Given this dilemma and the ease of
  increasing the size of gates, it may be desirable for the mold designer to be 'steel safe' and
  specify a smaller gate with the intent that the mold will be tested and the gate sizes increased as
  necessary."* Y en §7.4: *"If the specification of the gate dimensions is uncertain, then the mold
  designer should utilize smaller gate dimensions since they can be more readily increased if required
  after molding trials."*
- **SALIDA:** dos números por compuerta — `h_maquinar` (el chico) y `h_objetivo` (hacia dónde crece) —
  más el disparador declarado de la apertura.
- **DECIDE:** la cota que se libera a maquinado, y una línea del plan de tryout.
- **CRITERIO:** **[JUICIO]** con dirección impuesta por la irreversibilidad del acero: se quita, no se
  pone. Y sube un nivel: *"select a type of gate that can be enlarged"* — **el tipo se elige, entre
  otras cosas, por si se puede agrandar**.
- **INVALIDA:** que el tryout ya haya corrido (entonces la cota deja de ser hipótesis).
- **¿TENEMOS?** **SÍ.** `gating.ts` línea 176 aplica el steel-safe explícitamente,
  `gating.ts::GATE_AGRANDABLE` da el atributo por tipo, el contrato `gate-steel-safe` (§7.3.5 · §7.4)
  lo audita, y `expediente.ts:141` emite la línea del plan de tryout:
  `GATE <tipo>: maquinar X mm y abrir hasta Y mm si hay short shot o γ̇ alto (§7.3.5)`.
  Es de los lugares donde el motor **sí** hace lo que el libro pide.

### A-18 · ¿Se puede balancear el llenado con las compuertas?
- **CUÁNDO:** cuando el análisis de llenado (cap. 5) reporta desbalance entre cavidades.
- **ENTRADAS:** desbalance medido ←cap. 5 · dimensiones actuales de las compuertas ←A-07.
- **EL CÁLCULO:** cualitativo, y la respuesta del libro es **no**: *"The extent of the balancing that
  can be achieved through gate design is extremely limited due to the small size of the gate. To
  bring about large changes in flow, the gate dimensions must vary by such significant amounts that
  the shear rates and gate freeze times will vary substantially between gates, causing unintended
  consequences. For this reason, it may be preferred to change the dimensions of the runners or to
  use a dynamic flow control technology."*
- **SALIDA:** veredicto `balancear con gates: NO` + la redirección.
- **DECIDE:** que el retorno vaya a **runners** (cap. 6) o a control dinámico de fundido, no a las
  compuertas.
- **CRITERIO:** **[LIBRO]** cualitativo y tajante.
- **INVALIDA:** nada; es una regla estructural del método.
- **¿TENEMOS?** **FALTA como regla explícita.** `feed-layouts.ts` mide desbalance por rama
  (`desb >= 5` → *"las cavidades NO llenan juntas"*) y balancea con radios de runner, que es la
  redirección correcta — pero el sistema nunca **niega** el camino por compuertas, porque nunca lo
  ofrece. La regla no está escrita; el comportamiento coincide por accidente.

### A-19 · Remedios contra contracción volumétrica excesiva por congelamiento prematuro
- **CUÁNDO:** cuando A-12 da `prematuro`.
- **ENTRADAS:** veredicto de A-12 · presión de empaque disponible ←cap. 5 · espesores de la pieza.
- **EL CÁLCULO:** cualitativo, tres opciones que el libro ordena **por frecuencia real de uso**:
  1. *"The most common approach used by the molder is to impose a very high packing pressure before
     the gate freezes"* — con su riesgo: *"can lead to excessive flashing and/or residual stresses"*.
  2. *"a second common approach is to increase the diameter or thickness of the gate to increase the
     solidification time and provide packing at more moderate melt pressures"*.
  3. *"A third and seldom used approach is to rework the mold to reduce the nominal thickness of the
     molding."*
- **SALIDA:** remedio elegido + quién lo ejecuta (moldeador / diseñador de molde / rediseño de pieza).
- **DECIDE:** si el problema se resuelve en la prensa, en el acero o en la pieza. Nota: la opción 1
  no es del diseñador de molde, es del moldeador — el análisis reparte responsabilidad.
- **CRITERIO:** **[JUICIO]** ordenado por frecuencia observada, no por calidad.
- **INVALIDA:** que A-12 cambie de veredicto.
- **¿TENEMOS?** **FALTA.** Detectamos el congelamiento prematuro (`freezeCorto`) pero no ofrecemos el
  menú de tres remedios con su riesgo y su dueño. El libro convierte un semáforo rojo en una decisión
  con opciones; nosotros lo dejamos en rojo.

### A-20 · Checklist de cierre de compuertas (§7.4)
- **CUÁNDO:** al congelar el diseño de compuertas, antes de pasar al venteo.
- **ENTRADAS:** todos los análisis A-01…A-19.
- **EL CÁLCULO:** conjunción de veredictos. Los nueve criterios de aceptación destilados del §7.4:
  tipo coherente con el tipo de molde y con el degatado deseado y el flujo deseado; corte ≤ máximo;
  ΔP en banda; congelamiento contrastado contra el empaque; la compuerta no entra a sección más
  delgada que la que debe empacar; ruta de degatado declarada **y** con acceso físico; vestigio en
  superficie no visible o sin interferir acoplamientos; para túnel, las tres cotas + sucker pins;
  para flujo lineal, las dos condiciones; y dimensiones steel-safe.
- **SALIDA:** veredicto de subsistema + hoja de especificación de compuertas (tipo y por qué,
  dimensiones, caudal supuesto, los tres veredictos con sus números intermedios, decisiones
  steel-safe y qué se agrandará en el tryout).
- **DECIDE:** si se libera el subsistema de alimentación a maquinado.
- **CRITERIO:** **[LIBRO]** conjunción, con la doctrina de incertidumbre pegada: ante duda,
  dimensiones **menores**.
- **INVALIDA:** cualquier cambio río arriba.
- **¿TENEMOS?** **PARCIAL — siete de los nueve criterios.** En `mold-contratos.ts`: siete criterios
  del subsistema de compuertas
  (`gate-tipo`, `gate-shear`, `gate-dp`, `gate-freeze`, `gate-escala-nivel`, `gate-steel-safe`,
  `gate-degatado`) y el volcado a `expediente.ts`. **Huecos** contra los nueve del libro: falta el
  criterio de **acceso físico** para degatar (la longitud del edge gate la fija *"the molding machine
  operator access for de-gating with gate cutters"*, no la física) y el de **flujo lineal** (A-16).

---

# FASE B — VENTEO (cap. 8)

El capítulo arranca confesando su propio estatus: *"Venting is normally a minor aspect of mold design,
which is frequently neglected until molding trials indicate mold inadequacies related to venting."*
Y de ahí sale la forma del entregable, que tiene **dos partes**: los venteos que sí se maquinan **y
la capacidad reservada** para los que se van a añadir después — *"design vents where clearly needed
and ensure that the mold may accommodate additional vents when required"*.

El proceso declarado son tres pasos (§8.2): estimar el aire, ubicar los venteos, dimensionarlos.
La cota es de dos colas: *"the thickness must be greater than some minimum value to ensure adequate
venting while also smaller than some maximum amount to avoid excessive flashing."*

### A-21 · Gasto de aire desplazado
- **CUÁNDO:** paso 1 de §8.2, en cuanto hay caudal de llenado.
- **ENTRADAS:** caudal de fundido ←cap. 5 / ←A-04.
- **EL CÁLCULO:** una igualdad con supuesto declarado: `Vdot_aire = Vdot_melt`. Literal:
  *"The amount of air displaced will be approximately equal to the volume of the injected plastic."*
  La justificación es una cancelación: el aire se expande al calentarse contra el fundido pero se
  enfría al rozar el acero, y las dos se compensan.
- **SALIDA:** `Vdot_aire` [m³/s].
- **DECIDE:** el espesor mínimo de cada venteo (A-25). Y crea una **dependencia viva** alimentación →
  venteo: si cambia el caudal de llenado, todos los venteos se recalculan solos.
- **CRITERIO:** **[LIBRO]** como supuesto, no como umbral.
- **INVALIDA:** cambio del caudal de llenado o del tiempo de llenado.
- **¿TENEMOS?** **PARCIAL.** `venting.ts::ventDesign` recibe `VdotAirM3s` como parámetro, así que la
  fórmula existe implícitamente — pero **nadie la cablea al caudal de llenado**. El supuesto
  `V_aire = V_melt` no está escrito en ninguna función; el usuario tiene que saberlo y pasarlo.

### A-22 · Reparto del flujo de aire entre venteos (la regla anti-prorrateo)
- **CUÁNDO:** entre A-21 y A-25. Es el paso que un implementador "razonable" hace mal.
- **ENTRADAS:** `Vdot_aire` ←A-21 · número de venteos ←A-24 · partición del flujo por zona.
- **EL CÁLCULO:** **NO se divide entre n**. Literal: *"It may seem reasonable to estimate the air flow
  through each vent as the total volumetric air flow divided by the number of vents. **However, this
  approach would not be conservative.** The reason is that the exact location of the end of fill is
  not known ... **A more conservative approach is to assume that all the local air flow exits through
  each available vent.**"* En el bezel: 125 cc/s se parte en dos flujos locales de 62.5 (arriba y
  abajo), y **cada** venteo de ese lado se diseña para los 62.5 cc/s completos, no para 62.5/4.
- **SALIDA:** `Vdot_por_vent` [m³/s] = el flujo **local**, no el prorrateado.
- **DECIDE:** el valor que entra a A-25 en cada venteo.
- **CRITERIO:** **[LIBRO]**, y el criterio es **conservadurismo**, no exactitud: la razón es la
  ignorancia sobre dónde cae el final de llenado, no un modelo físico.
- **INVALIDA:** que el análisis de llenado localice el final de llenado con certeza (no ocurre).
- **¿TENEMOS?** **SÍ, y explícito.** `mold-contratos.ts` id `vent-flujo-completo` (§8.2.3) audita
  precisamente que cada venteo se dimensione para todo el flujo local. Es una de las trampas del
  libro que sí quedó cazada.

### A-23 · Mapa de ubicaciones candidatas (los tres tipos)
- **CUÁNDO:** paso 2 de §8.2, en cuanto hay patrón de llenado.
- **ENTRADAS:** patrón de llenado / isócronas ←cap. 5 · geometría de la pieza (bosses, costillas,
  recortes) ←cap. 2 · plano de partición y shut-offs ←cap. 4.
- **EL CÁLCULO:** clasificación en tres tipos, literal: *"The first type of vent is required where the
  melt converges at an edge of the mold's parting plane or other shut-off surface. The second type of
  vent is required where two melts converge to form a knit or weld line. The third type of vent is
  required where the melt converges at a dead pocket in the mold."*
  Para el tipo 2 el libro ya da la solución en la misma frase: *"Usually, ejector pins are designed to
  provide such venting functions on the surface of the mold cavity."*
  Para el tipo 3, tres arquetipos que entrenan el ojo: tope de un boss; punto muerto superior de una
  costilla donde chocan dos frentes; esquina de costilla con recorte que atrapa el flujo diagonal.
- **SALIDA:** lista de candidatos, cada uno con `(x,y,z)` y tipo ∈ {fin-de-flujo, soldadura,
  bolsa-muerta}. En el bezel: ~12 en el plano de partición + ~20 bolsas muertas ≈ **tres docenas**.
- **DECIDE:** el universo sobre el que trabaja A-24. Y cruza a **expulsión**: cada candidato de tipo 2
  debería coincidir con un pin expulsor.
- **CRITERIO:** **[LIBRO]** taxonómico, con una alarma de humildad: *"These locations may seem obvious,
  but on closer consideration these locations may not be so trivial to identify."*
- **INVALIDA:** cambio del patrón de llenado (compuertas, espesores, caudal).
- **¿TENEMOS?** **SÍ, y es de lo más fuerte del motor.** `venting-locations.ts::enumerarVenteos`
  detecta los tres tipos sobre el campo de llenado 3D: `TipoVenteo = 'fin-de-flujo' | 'soldadura' |
  'bolsa-muerta'`; usa **máximos locales de resistencia** (no de distancia — el comentario cita §5.5.5:
  *"el race tracking desacopla las dos"*) y distingue bolsa muerta de fin de flujo contando vecinos
  con hueco (≥4 de 6 encerrado ⇒ bolsa). `venting-locations.ts::clasificarCierres` marca si el cierre
  es interior. Contrato `vent-ubicaciones` (§8.2.2).

### A-24 · Clasificación obligatorio / opcional / diferido, y el corte
- **CUÁNDO:** justo después de A-23.
- **ENTRADAS:** candidatos ←A-23 · dirección del flujo (radial vs lineal) ←cap. 5 · costo de un cambio
  de molde posterior.
- **EL CÁLCULO:** cualitativo con tres reglas:
  1. **Obligatorios:** los del final de flujo. *"The other four vent locations at the end of flow
     indicated in Figure 8.2 should be included since a significant fraction of the displaced air from
     the cavity will likely exit here."*
  2. **Opcionales:** esquinas y cercanos a la compuerta, *"may not be necessary since the melt flow is
     predominantly radial"*.
  3. **La apuesta:** *"the mold designer may choose to specify vent locations at these locations to
     avoid mold changes later"* — se maquinan venteos "innecesarios" como **seguro contra un cambio
     de molde futuro**.
  Y el corte: *"it is fairly common for the mold designer to initially specify vents at only the most
  critical vent locations."* En el bezel, de ~36 candidatos se maquinan **8**.
- **SALIDA:** dos listas — `maquinar` y `reservados` — con el estado de cada candidato.
- **DECIDE:** qué se manda a maquinado hoy y qué queda documentado para el tryout.
- **CRITERIO:** **[JUICIO]** puro, con una alarma que impide cerrar la lista: *"the exact melt front
  behavior may change slightly and it is not uncommon for the melt to trap gas at these locations."*
- **INVALIDA:** el tryout (que convierte reservados en maquinados) y cualquier cambio de llenado.
- **¿TENEMOS?** **SÍ.** `venting-locations.ts::PlanVenteo` devuelve `{ maquinar, reservados,
  nCandidatos, notas }` y el default de `nMaquinar` es **8** — el del bezel del libro, con el
  comentario citando §8.1 sobre la capacidad reservada. `expediente.ts:145` vuelca los reservados al
  plan de tryout.

### A-25 · Espesor MÍNIMO del venteo (Eq 8.2)
- **CUÁNDO:** paso 3 de §8.2, por cada venteo.
- **ENTRADAS:** `Vdot` local ←A-22 · longitud del land `L` y ancho `W` (los fija la geometría:
  *"In general, the length and width of the vent are determined by the application geometry."*).
- **EL CÁLCULO:** Eq 8.2, flujo viscoso del aire por una rendija:
  `h_min = cbrt( 12 · mu_aire · Vdot_aire · L / (dP_aire · W) )`
  con `mu_aire = 1.8e-5 Pa·s` (aire a temperatura ambiente) y `dP_aire = 1 atm = 0.1 MPa` —
  *"To avoid compressing the gas and increasing pressure on the plastic melt, the allowable pressure
  drop across the vent is **one atmosphere** (14.7 psi or 0.1 MPa)."*
  Ejemplo: 100 cc/s, W=10 mm, L=10 mm → **0.06 mm**.
- **SALIDA:** `h_min` [mm].
- **DECIDE:** el piso de la banda de A-29. Pero **casi nunca manda**, y el libro explica por qué con
  tres razones de conservadurismo acumulado: (a) el modelo laminar predice más caída que el turbulento
  real; (b) se supuso un solo venteo chico con todo el flujo; (c) la viscosidad a temperatura ambiente
  es mayor que la del aire caliente real. Conclusión literal: *"the minimum thickness of the vent will
  not generally be a limiting design constraint."*
- **CRITERIO:** **[LIBRO]** con su sesgo declarado (conservador por tres lados).
- **INVALIDA:** cambio de caudal, de `L` o de `W`.
- **¿TENEMOS?** **SÍ, literal.** `venting.ts::ventMinThickness` =
  `Math.cbrt((12 * MU_AIR * VdotAirM3s * lM) / (dPPa * wM))` con `MU_AIR = 1.8e-5` y `dPPa = 0.1e6`
  por default. El encabezado del archivo declara la verificación: `h_min=0.06mm`.

### A-26 · Tiempo de solidificación DENTRO del venteo (t_flash)
- **CUÁNDO:** entre A-25 y A-28. Es un análisis del cap. 7 reutilizado en el cap. 8.
- **ENTRADAS:** espesor tentativo del venteo ←A-25 · propiedades térmicas del fundido.
- **EL CÁLCULO:** se aplican **las ecuaciones de congelamiento de la Tabla 7.4** (las de A-11) al
  espesor del venteo. Para 0.06 mm da `t_flash ≈ 0.003 s`.
- **SALIDA:** `t_flash` [s].
- **DECIDE:** entra a A-27 y a A-28. Es la razón por la que el venteo funciona: el fundido congela
  antes de recorrer mucho.
- **CRITERIO:** **[LIBRO]** por reutilización explícita de la Tabla 7.4.
- **INVALIDA:** cambio de espesor del venteo o de material.
- **¿TENEMOS?** **FALTA — está hardcodeado.** `venting.ts::ventMaxThickness` recibe
  `tFlashS = 0.003` **como valor por default fijo**, en vez de llamar a `gateFreezeStripS` con el
  espesor del venteo. Las dos funciones están en el mismo directorio y no se hablan. Es un caso
  exacto del patrón que este pliego persigue: **el dato existe, se calcula bien en otro lado, y no
  llega**. Consecuencia: si el material o el espesor cambian, `h_max` no se entera.

### A-27 · Presión del fundido en el instante del flash (Eq 8.4)
- **CUÁNDO:** junto con A-26.
- **ENTRADAS:** rampa de presión del proceso `dP/dt` · `t_flash` ←A-26.
- **EL CÁLCULO:** `P_melt = (dP/dt) · t_flash`, con `dP/dt < 100 MPa/s` para la mayoría de los
  procesos (el corpus recoge la cota en paráfrasis, no como cita literal).
- **SALIDA:** `P_melt` [Pa] — la presión que empuja la rebaba, que es mucho menor que la presión de
  inyección porque el flash ocurre **al principio** de la rampa.
- **DECIDE:** entra a A-28.
- **CRITERIO:** **[LIBRO]** con la cota de la rampa.
- **INVALIDA:** cambio del perfil de presión del proceso.
- **¿TENEMOS?** **SÍ.** `venting.ts::meltPressureAtVent = rampPaS * tFlashS`, con
  `rampPaS = 100e6` por default. Mismo problema que A-26: la rampa es un default, no un dato del
  proceso.

### A-28 · Espesor MÁXIMO del venteo por rebaba (Eq 8.3)
- **CUÁNDO:** paso 3 de §8.2, después de A-27.
- **ENTRADAS:** `P_melt` ←A-27 · `t_flash` ←A-26 · viscosidad del fundido en el venteo ·
  longitud de rebaba tolerada `L_flash`.
- **EL CÁLCULO:** `h_max = sqrt( 12·mu / (P_melt · t_flash) ) · L_flash`, con
  `mu ≈ 10 Pa·s` — *"Since the vent is thin, there will be significant shear thinning so a low
  viscosity of 10 Pa s is assumed"*. Resultado compacto: **`h_max ≈ 0.4 · L_flash`** (el coeficiente
  exacto del ejemplo es 0.365). Con `L_flash = 0.2 mm` permitida → `h_max = 0.08 mm`.
- **SALIDA:** `h_max` [mm].
- **DECIDE:** el techo de la banda — **y es el que realmente manda**, no el mínimo.
- **CRITERIO:** **[LIBRO]** pero con una advertencia de estatus que hay que respetar: *"The formation
  of flashing in extremely thin channels such as vents is an advanced research topic, requiring
  transient simulation with small time steps. **No simple analytical solution exists.**"* La ecuación
  se ofrece *"for the purpose of discussion only"*.
- **INVALIDA:** cambio de la rebaba tolerada, del material o del perfil de presión.
- **¿TENEMOS?** **SÍ, literal.** `venting.ts::ventMaxThickness` =
  `Math.sqrt((12 * muMeltPaS) / (P * tFlashS)) * lFlashM`, con `muMeltPaS = 10` por default.
  El encabezado del archivo documenta `h_max = 0.4·L_flash`.

### A-29 · Banda de espesor y su palanca
- **CUÁNDO:** al cerrar el dimensionado de cada venteo.
- **ENTRADAS:** `h_min` ←A-25 · `h_max` ←A-28 · número y ancho de venteos ←A-24.
- **EL CÁLCULO:** verificación de banda `h_min <= h_vent <= h_max`. En el ejemplo:
  `0.06 <= h <= 0.08 mm` — **la ventana es angosta**. Y la palanca cuando aprieta:
  *"If less flashing was desired, then **more and wider vents** could be used to reduce the required
  air flow, after which the vent thickness could be reduced to reduce flashing while providing
  adequate air flow."*
- **SALIDA:** `h_vent` especificado [mm] + veredicto de factibilidad.
- **DECIDE:** el espesor que se maquina; y si la banda se cierra (`h_min > h_max`), obliga a volver a
  A-24 con **más venteos y más anchos**.
- **CRITERIO:** **[COMPARA]** entre dos análisis. Pero encima hay una **recomendación operativa que
  contradice al cálculo**, y está bien: *"it is recommended that vents on the parting plane be used
  **sparingly** with a thickness on the order of **0.02 mm**. If venting is subsequently found to be
  inadequate, then additional vents can be added or the thickness of existing vents increased."*
  El cálculo dio 0.06 mm de mínimo; la práctica dice arrancar en 0.02 y abrir en el tryout. Es el
  mismo steel-safe de A-17 aplicado al venteo.
- **INVALIDA:** cualquier cambio en A-25 o A-28.
- **¿TENEMOS?** **SÍ, con las dos capas.** `venting.ts::ventDesign` devuelve
  `{ hMinMm, hMaxMm, hSpecMm, feasible }` con
  `hSpec = Math.min(Math.max(hMin, 0.02), hMax)` — o sea, aplica literalmente la práctica de 0.02 mm
  acotada por la banda. Contratos `vent-espesor` (§8.2.3) y `vent-practica` (§8.3.1).
  `expediente.ts:143` emite la línea de tryout: *arrancar en 0.02 mm en partición y abrir hacia h_max*.
  **Hueco:** la palanca "más venteos y más anchos" no se ejecuta automáticamente cuando `feasible`
  es falso; solo se reporta.

### A-30 · Contraste contra los handbooks (Tabla 8.1)
- **CUÁNDO:** junto con A-29, como segunda opinión.
- **ENTRADAS:** familia de viscosidad del material.
- **EL CÁLCULO:** consulta de tres fuentes con año, en mm:

  | Viscosidad | materiales | Glanvill (1965) | Rosato (1986) | Menges (2000) |
  |---|---|---|---|---|
  | baja | PP, PA, POM, PE | 0.08 | 0.1 | **0.015** |
  | media | PS, ABS, PC, PMMA | 0.2 | 0.3 | **0.03** |

- **SALIDA:** tres números por material, no uno.
- **DECIDE:** la sanidad del `h_vent` de A-29. Difieren hasta **10×** entre sí, así que el sistema
  debe mostrar las tres con su año, nunca un número mágico.
- **CRITERIO:** **[JUICIO]** histórico, y el libro lo explica en vez de promediar: *"there has been a
  long term trend in the plastics industry to move to thinner walls, faster injection rates, and
  higher injection pressures; **the maximum thickness of the vent decreases with increasing melt
  pressure**."* Regla derivada: **más presión de inyección y resina más fluida ⇒ venteo más delgado.**
  Las tablas viejas no son otra opinión: son de otra época del proceso.
- **INVALIDA:** cambio de material.
- **¿TENEMOS?** **SÍ.** `venting.ts::VENT_TABLE_MM` reproduce las seis celdas con los tres nombres
  de fuente. **Hueco:** los **años** (1965 / 1986 / 2000) no están en el dato, y son justamente lo que
  hace legible la divergencia.

### A-31 · Espesor del venteo de expulsor a partir de la holgura de manufactura
- **CUÁNDO:** cuando la solución del candidato es un pin o una cuchilla expulsora (tipo 2 de A-23).
- **ENTRADAS:** holgura diametral de taller entre pin y barreno.
- **EL CÁLCULO:** aritmética directa. Literal: *"Holes for ejector pins are normally **drilled and
  subsequently reamed**. In mold manufacturing, the **diametral clearance between the ejector pin and
  ejector hole is typically 0.13 mm (0.005 in)**, which leaves **0.065 mm (0.0025 in)** thickness for
  venting."*
- **SALIDA:** `h_vent = 0.065 mm` [mm].
- **DECIDE:** que **no** se cierre la holgura para controlar rebaba. Y el libro justifica que sea
  **más grueso** que el recomendado para partición con tres razones **que no son de venteo**:
  (1) *"the clearance is useful to avoid increased sliding friction and ejector pin buckling"*;
  (2) *"ejector pins are usually machined through solid steel, so increased flashing due to parting
  plane deflection are unlikely"*; (3) *"any witness lines associated with flashing at the ejector
  pins are usually located on non-aesthetic surfaces."*
- **CRITERIO:** **[LIBRO]** numérico, pero el criterio real es de **manufactura y mecanismo**, no de
  aire. Un optimizador que minimice rebaba cerraría la holgura y **trabaría el expulsor**.
- **INVALIDA:** cambio del ajuste especificado (que es dato de taller, no de diseño).
- **¿TENEMOS?** **SÍ, doble.** `mold-contratos.ts` id `vent-expulsores` (§8.3.2) y `fits.ts` con la
  holgura literal pin↔barreno de **0.13 mm** (registrada además en la memoria del proyecto).
  Las tres razones del libro están en el criterio del contrato.

### A-32 · Anatomía del venteo (land, alivio, salida)
- **CUÁNDO:** al detallar cada venteo, después de A-29/A-31.
- **ENTRADAS:** `h_vent` ←A-29/A-31 · tipo de solución ←A-34 · ubicación.
- **EL CÁLCULO:** verificación de presencia de elementos, con cotas del ejemplo:
  - **Partición (bezel):** land `h = 0.06 mm, L = 2 mm` → canal de alivio de **2 mm** → salida
    **⌀3 mm** al centro y arriba del inserto. El ancho `W` va deliberadamente alto:
    *"The width of the vent, W, has been made **purposefully high** to provide for uncertainty in the
    last area of the melt to fill the cavity."*
  - **Anillo perimetral (lid, pieza cilíndrica con compuerta central):** `h = 0.015 mm, L = 1 mm` +
    canal al costado del inserto.
  - **Expulsor (Fig 8.8):** canal venteado hasta **3 mm** bajo la superficie de cavidad, y después
    **taper** hacia el barreno nominal. Literal: *"**Both of these elements should be present in a
    good vent design.** The larger channel serves to reduce the flow resistance of the air while also
    assisting in the assembly of the ejector pins to the mold. **The taper is useful to guide the head
    of the pin during mold assembly.**"* — el cono es para **armado**, no para aire.
  - **Bolsa muerta con inserto:** `H = 0.2 mm, L = 2 mm`, canal ancho detrás, y sin transición suave:
    *"**Since there is no ejector pin, there is no need for a smooth transition** between the vent and
    the vent channel."*
- **SALIDA:** geometría completa del venteo + veredicto de completitud (¿están los dos elementos?).
- **DECIDE:** si el venteo se puede maquinar y si el aire realmente sale (un land largo sin alivio no
  ventea).
- **CRITERIO:** **[LIBRO]** de presencia. La longitud del land es negociable: *"The vent length, L, of
  3 mm has been chosen for illustrative purposes and is certainly not mandatory."*
- **INVALIDA:** cambio de ubicación o de solución.
- **¿TENEMOS?** **FALTA la geometría.** Tenemos el espesor (A-29) y la ubicación (A-23), pero **no
  existe el objeto "venteo" con land + canal de alivio + salida** ni la verificación de los dos
  elementos del expulsor. La ficha visual V8.6/V8.8 declara esto juzgable por píxeles y hoy no hay
  qué juzgar: `PlanVenteo` guarda puntos, no secciones.

### A-33 · Rebaba por deflexión de placas sobre cara estética
- **CUÁNDO:** después de A-29, y otra vez cuando el cap. 12 entrega la deflexión calculada.
- **ENTRADAS:** `h_vent` en el plano de partición ←A-29 · deflexión de placas bajo presión de fundido
  ←cap. 12 · clasificación de superficies visibles ←A-03.
- **EL CÁLCULO:** comparación directa `deflexion_placas` vs `h_vent`. Literal: *"they are susceptible
  to flashing with bending of the mold plates ... Any significant deflection will tend to increase the
  thickness of the vents and thereby increase the likelihood and amount of flashing."*
- **SALIDA:** veredicto `flash esperado / contenido`, y su gravedad según dónde cae la rebaba.
- **DECIDE:** si hay que rediseñar estructuralmente, o pasar a **venteo interno alrededor de una
  placa desmoldeadora (stripper plate)**. El caso del lid es el que aprieta: *"the outside, bottom
  surface of the lid is an area observed and handled by the end-user"* — la rebaba cae en zona que el
  usuario **toca**.
- **CRITERIO:** **[COMPARA]** entre dos análisis de capítulos distintos. La ficha visual V8.7 lo cruza
  con V12.4 y la TOP-10 #5 lo cuantifica: 0.36 mm de separación contra 0.02 mm de venteo ⇒
  *"significant amount of flashing is expected"*.
- **INVALIDA:** cambio de espesor de placas, de presión, o del venteo.
- **¿TENEMOS?** **SÍ, como contrato cruzado.** `mold-contratos.ts` id `estr-deflexion-vs-venteo`
  (§12.1.2 · cap 8) compara deflexión contra espesor de venteo. Es de los pocos cruces entre
  subsistemas que sí están cableados. **Hueco:** no se pondera por si la cara es estética o manipulada
  (el dato existe en `visibilidad.ts`, no se consulta aquí).

### A-34 · Solución para cada bolsa muerta
- **CUÁNDO:** por cada candidato de tipo 3 (bolsa muerta) de A-23.
- **ENTRADAS:** geometría de la bolsa (ancho de la costilla, si la superficie es plana) · si conviene
  expulsar ahí ←cap. 11 · presupuesto de mantenimiento.
- **EL CÁLCULO:** cualitativo, tres opciones con criterio:
  1. **Inserto venteado** en bolsillo rectangular. Regla de tamaño: *"the vent only spans the width of
     the rib where the trapped air is expected"* — el venteo abarca **solo el ancho de la costilla**.
  2. **Cuchilla expulsora (ejector blade)** en el mismo lugar. Y aquí está el veredicto económico:
     *"the venting function of the insert ... could have also been provided by using an **ejector
     blade** at the same location. The ejector blade like could have been provided **at lower cost
     while also facilitating the ejection** of the part. As such, **venting inserts are not especially
     common**."*
  3. **Venteo sinterizado** ⌀ **2–12 mm** con poros de **0.03–0.1 mm**. Restricción de montaje:
     *"Given their small size and non-machinable top surface, sintered vents are best placed with
     their venting surface **flush with flat mold cavity surfaces**."* Y su contra:
     *"sintered vents can require intermittent replacement or maintenance as the micro-channels may
     clog **without any easy method for in-mold cleaning**."*
- **SALIDA:** solución elegida por bolsa + sus cotas.
- **DECIDE:** qué componente se compra o se maquina, y de paso puede resolver expulsión en el mismo
  punto (opción 2, doble función).
- **CRITERIO:** **[JUICIO]** económico, con el default declarado: **la cuchilla gana casi siempre**
  porque ventea y expulsa.
- **INVALIDA:** que el layout de expulsión no admita cuchilla ahí; que la superficie no sea plana
  (mata la opción 3).
- **¿TENEMOS?** **FALTA el selector.** Existen las piezas por separado —
  `ejectortypes.ts` dimensiona cuchillas con su pandeo (Eqs 11.17–11.19, bezel L_máx 93 mm) y
  `venting-locations.ts` localiza las bolsas — pero **nadie decide** entre inserto, cuchilla y
  sinterizado, ni aplica la regla del ancho de costilla, ni la restricción de superficie plana del
  sinterizado. Es un cruce venteo↔expulsión que el libro resuelve en una frase y nosotros no tenemos.

### A-35 · Ruteo del canal de venteo contra las líneas de agua
- **CUÁNDO:** al detallar el canal (A-32), y otra vez cuando el ruteo de agua (A-61) cambia.
- **ENTRADAS:** trayectoria del canal de alivio ←A-32 · layout de líneas de agua ←A-61.
- **EL CÁLCULO:** detección de interferencia. La regla la da el libro como conveniencia de longitud:
  *"it may be desirable to **avoid a large vent channel near cooling lines**"* — el venteo **cede el
  paso** al agua. Y la segunda conveniencia es de maquinado: *"a mold may be more economically
  produced with the same vent section through the majority of the core insert, **tapering to a larger
  size only where the core insert faces the support plate**"*.
- **SALIDA:** longitud y trayectoria ajustadas del canal.
- **DECIDE:** hasta dónde se extiende el venteo. La longitud del land no es sagrada: se estira hasta
  donde convenga.
- **CRITERIO:** **[JUICIO]** de conveniencia, con prioridad implícita: el agua manda sobre el venteo.
- **INVALIDA:** cualquier cambio del layout de agua.
- **¿TENEMOS?** **PARCIAL — el contrato existe y no tiene qué medir.** `mold-contratos.ts` id
  `vent-vs-agua` (§8.3.2).
  **Hueco:** sin geometría de canal (A-32) el contrato no tiene qué medir; es un criterio que hoy
  se evalúa sobre un objeto que no existe.

### A-36 · Checklist de cierre de venteo (§8.4)
- **CUÁNDO:** al congelar el subsistema.
- **ENTRADAS:** A-21…A-35.
- **EL CÁLCULO:** conjunción de nueve criterios: venteo en **todo** final de flujo; venteo (típicamente
  un expulsor) en **cada** convergencia interna; cada bolsa muerta con ruta de escape o riesgo
  declarado; `h_min <= h <= h_max` con arranque práctico 0.02 mm en partición y 0.065 mm en expulsores;
  cada venteo dimensionado para **todo el flujo local**; cada venteo con canal de alivio y salida;
  los canales sin chocar con agua; la rebaba prevista en superficie no estética; y **espacio reservado**
  para añadir venteos después.
- **SALIDA:** veredicto de subsistema + mapa de venteo (cada candidato con tipo, estado, solución y
  cotas, con la fuente del espesor citada: Eq 8.2–8.3 o Tabla 8.1).
- **DECIDE:** si se libera el venteo a maquinado.
- **CRITERIO:** **[LIBRO]** con la distinción moral del capítulo: la postergación es legítima, la
  ignorancia no. *"This approach [ventear después del tryout] **has some merit** since all of the
  required venting locations may not be known until the mold filling patterns are verified. However,
  a complete lack of analysis and foresight regarding venting can lead to significant mold defects,
  time consuming mold changes, and costly product development delays."*
- **INVALIDA:** cambio del patrón de llenado o del layout de expulsión.
- **¿TENEMOS?** **PARCIAL.** Seis contratos de venteo existen (`vent-espesor`, `vent-flujo-completo`,
  `vent-practica`, `vent-expulsores`, `vent-ubicaciones`, `vent-vs-agua`). Faltan los criterios que
  dependen de geometría de venteo (canal de alivio + salida, A-32) y de la solución por bolsa (A-34).
  Y falta el **mapa de venteo** como entregable con la fuente del espesor citada por venteo.

  > **Nota de mantenimiento, sin ficha.** §8.1.3 pide diseñar venteos de **mantenimiento mínimo**
  > porque *"Many polymers will off-gas in the molten state, releasing particles that can build up and
  > clog the venting system. **Such clogged vents can occur especially quickly with the use of mold
  > release.**"* No lleva ficha porque no produce número ni veredicto; es un sesgo de diseño que
  > favorece los venteos autolimpiables (expulsores) sobre los sinterizados en A-34.

---

# FASE C — ENFRIAMIENTO (cap. 9)

**Aquí está la cadena más larga del libro.** Kazmer abre con el diagnóstico:
*"The cooling system is extremely important to the economics and operation of the designed mold, and
yet remains **one of the most under engineered systems** in injection molds. Perhaps the reason for
the lack of engineering is that **the temperature distribution is not obvious when molding compared
to defects related to flow**."*

Declara siete pasos (§9.2) — `t_c → potencia → caudal → diámetro → profundidad → paso → ruteo` —
y en el mismo capítulo declara que **no son un pipeline**: *"the mold designer should recognize that
**multiple design iterations may be necessary** to perform the cooling analysis for different cooling
line layouts with varying number of cooling lines."* El número de líneas es entrada y salida a la vez.

Y pone el marco de expectativa: *"it is not likely that every objective will be simultaneously
optimized. **The goal is for the mold designer to reach a good compromise**."*

## C.1 — Del plástico al tiempo de ciclo

### A-37 · Sección gobernante (la más gruesa)
- **CUÁNDO:** primer paso de §9.2.1, antes de cualquier ecuación.
- **ENTRADAS:** mapa de espesores de la pieza ←cap. 2 · diámetros del sistema de alimentación ←cap. 6.
- **EL CÁLCULO:** selección del máximo, con la regla literal: *"the mold designer should consider
  **the thickest section** that is likely to require the longest time to solidify."*
- **SALIDA:** `h_gob` [mm] y de qué sección viene (pieza o runner).
- **DECIDE:** qué espesor entra a A-39. Toda la cadena del capítulo cuelga de este número — y va al
  cuadrado.
- **CRITERIO:** **[LIBRO]** por máximo. Nota de método: el criterio de rigidez es de **línea central**,
  no de promedio, y el libro lo justifica dos veces: *"First, it is **conservative**... Second, this
  approach is **supported by bending theory**. Specifically, consider a part that is rigid at the walls
  but semi-molten at the centerline. Since the plastic at the centerline is not able to transmit the
  shear stresses from one wall to the opposing wall under ejection loads, the deformation of the molded
  part will be much higher."*
- **INVALIDA:** rediseño de espesores; cambio de diámetro de runner (A-42).
- **¿TENEMOS?** **SÍ.** `cooling.ts::coolingReport` recorre una lista de secciones
  (`{name, kind:'plate'|'rod', sizeMm}`) y devuelve `governing` + `cycleCoolingS` tomando el máximo;
  `cooling-design.ts::coolingDesign` recibe `thickestMm` y lo reporta. `cooling.ts::centerlineTemperature`
  implementa la solución en serie de la **línea central** (Eq 9.4), o sea el criterio correcto.

### A-38 · Temperatura de expulsión (T_eject)
- **CUÁNDO:** junto con A-37.
- **ENTRADAS:** ficha del material.
- **EL CÁLCULO:** lectura de propiedad. El criterio de rigidez es la **HDT / DTUL (ASTM D648)**.
  Ejemplo cup/lid en ABS: `T_melt = 239 °C`, `T_cool = 60 °C`, `T_eject = 96.7 °C`.
- **SALIDA:** `T_eject` [°C].
- **DECIDE:** el argumento del logaritmo de A-39 y el `ΔT` de A-47.
- **CRITERIO:** **[LIBRO]** por norma citada.
- **INVALIDA:** cambio de material.
- **¿TENEMOS?** **SÍ, con la errata del libro cazada.** `cooling.ts::ABS_KAZMER` fija
  `{ alpha: 8.69e-8, tMelt: 239, tCoolant: 60, tEject: 97.6 }` y el comentario documenta:
  *el TEXTO dice T_eject=96.7 pero los CÁLCULOS del propio libro usan 97.6* — con 97.6 se reproducen
  exactos los 8.4 / 18.9 / 22.9 s. El mismo hallazgo está en el corpus (`pliego-caps7-9.md`, Anexo de
  errata #1). **Hueco:** `T_eject` no se deriva de una tabla de HDT por material; hay una constante
  por material en `PLASTICOS_A` (`cooling-design.ts`), no un catálogo ASTM D648.

### A-39 · Tiempo de enfriamiento (Eqs 9.5 y 9.6)
- **CUÁNDO:** paso 1 de los siete. Es la raíz de toda la cadena.
- **ENTRADAS:** `h_gob` ←A-37 · `T_eject` ←A-38 · `T_melt`, `T_cool` ←proceso · `alpha` ←material.
- **EL CÁLCULO:** dos geometrías:
  - placa (Eq 9.5): `tc = h^2/(pi^2·alpha) · ln( (4/pi) · (Tmelt − Tcool)/(Teject − Tcool) )`
  - cilindro/barra (Eq 9.6): `tc = D^2/(23.1·alpha) · ln( 1.60 · (Tmelt − Tcool)/(Teject − Tcool) )`
  Ejemplo cup/lid en ABS: lid 2 mm → **8.4 s**; cup 3 mm → **18.9 s**; runner → **22.9 s**.
- **SALIDA:** `tc` [s] por sección.
- **DECIDE:** el tiempo de ciclo (A-43), la potencia de enfriamiento (A-48), y el empaque disponible
  que A-12 compara contra el congelamiento de la compuerta.
- **CRITERIO:** **[LIBRO]**, con **dos letras chicas que hay que mostrar**: (a) los tiempos reales son
  sustancialmente mayores por **resistencia térmica de contacto**, agravada por *"thin gaps which open
  up between the shrunken molding and the mold walls"*; (b) *"the cooling time is often not driven by
  the rigidity of the part, but rather by **quality requirements**"*.
- **INVALIDA:** cambio de espesor, material o temperaturas del proceso.
- **¿TENEMOS?** **SÍ, literal y verificado.** `cooling.ts::coolingTimePlate` y `::coolingTimeRod` son
  las dos ecuaciones tal cual; `cooling-design.ts::tcPlateS` la repite para la cadena de diseño.
  Los tres números del ejemplo del libro se reproducen. **Hueco:** las dos letras chicas no salen en
  ningún reporte — el número se presenta sin su sesgo.

### A-40 · Contraste con la regla de dedo (Eqs 9.8 y 9.9)
- **CUÁNDO:** junto a A-39, como segunda opinión barata.
- **ENTRADAS:** `h_gob` [mm] ←A-37.
- **EL CÁLCULO:** `tc [s] = 2 · (h [mm])^2`. Kazmer no la cita: **la deriva y la valida** —
  con `alpha ≈ 0.09 mm²/s` y una razón térmica `(Tmelt−Tcool)/(Teject−Tcool) ≈ 5` el coeficiente sale
  **2.08** (Eq 9.9). Con 3 mm: 18 s de dedo contra 19.2 s analíticos.
- **SALIDA:** `tc_dedo` [s] y la discrepancia contra A-39.
- **DECIDE:** la confianza en A-39, y un dato de planeación: *"Eq. (9.9) provides an estimate of the
  cooling time, **which is roughly half of the cycle time**."*
- **CRITERIO:** **[COMPARA]**, con la jerarquía declarada: *"While Eq. (9.8) is an excellent guideline,
  **it is a good idea to use Eqs. (9.5) and (9.6)** to evaluate the cooling time for the specific
  application's design, material properties, and processing conditions."* La regla se muestra al lado,
  no en lugar de.
- **INVALIDA:** nada; es un ancla fija.
- **¿TENEMOS?** **SÍ.** `cooling.ts::coolingTimeRuleOfThumb = 2 * hMm * hMm`.
  **Hueco:** no se muestran juntas ni se reporta la discrepancia; y la relación
  *"roughly half of the cycle time"* no se usa para estimar ciclo en ningún lado.

### A-41 · Corrección por frontera convectiva
- **CUÁNDO:** después de A-39, cuando importa la magnitud real y no el orden.
- **ENTRADAS:** `tc` isotérmico ←A-39 · coeficiente de convección al refrigerante `h_c ≈ 1000 W/(m²·°C)`.
- **EL CÁLCULO:** se resuelve la conducción con frontera de Robin en vez de temperatura impuesta.
  El libro da el resultado del ejemplo: **19 s → 24 s**, es decir **+25 %** sobre el ideal isotérmico.
- **SALIDA:** `tc_real` [s].
- **DECIDE:** el tiempo de ciclo que se cotiza. El isotérmico es **optimista** y cotizar con él
  subestima el costo por pieza.
- **CRITERIO:** **[LIBRO]** con número de ejemplo, no con fórmula cerrada en el corpus.
  ⚠ **NO OBSERVADO EN EL CORPUS:** la ecuación explícita de la corrección convectiva. El corpus da
  `h_c`, el antes y el después, pero no la expresión. Y documenta una inconsistencia de unidades del
  propio libro: `h_c` aparece como *"1000 W/°C"* y *"1000 W/m°C"*, cuando para que `H_line < k/1000` dé
  32 mm con `k = 32 W/m°C` las unidades correctas son **W/(m²·°C)**.
- **INVALIDA:** cambio del caudal de refrigerante (que mueve `h_c`).
- **¿TENEMOS?** **PARCIAL — por otro camino y sin conectar.** `mold-thermal-fdm.ts` resuelve el
  transitorio 3D real con frontera de Robin `q = h·(T − T_c)` y `h = 1000 W/m²·°C` citando **Eq 9.7** —
  o sea, tenemos la física completa. Pero el `tc` que alimenta la cadena de `cooling-design.ts` sigue
  siendo el **isotérmico** de A-39. Tenemos el número bueno y usamos el optimista.

### A-42 · Tiempo de enfriamiento del runner contra el de la pieza
- **CUÁNDO:** junto con A-39, sobre las secciones del sistema de alimentación.
- **ENTRADAS:** diámetros del runner y del sprue ←cap. 6 · Eq 9.6.
- **EL CÁLCULO:** misma Eq 9.6 aplicada al runner, y comparación contra el `tc` de la pieza.
  En el ejemplo el runner da **22.9 s** contra los 18.9 s del cup: **el runner domina**.
- **SALIDA:** veredicto `el runner manda / la pieza manda` + el delta.
- **DECIDE:** ⇒ **RETORNO a alimentación.** Literal: *"the cooling time of the runner is larger than
  that for the cup. In practice, **the runner need not be as rigid as the part being de-molded** so
  the required cooling time of the runner may be less ... However, the results do indicate that **the
  cycle time can be dominated by the cooling of the cold runners**, so it is important to minimize the
  runner diameters **not just for material savings but also to maintain a productive molding process**."*
- **CRITERIO:** **[COMPARA]** con un matiz: el criterio de rigidez del runner es **más laxo** que el de
  la pieza (no se desmolda con carga), así que el veredicto admite descuento con juicio.
- **INVALIDA:** cambio de diámetros del feed system. Y al revés: este retorno invalida `tc`, potencia,
  caudal y costo río abajo.
- **¿TENEMOS?** **SÍ, y con el retorno cableado.** `feed.ts:135` emite la fila
  `t_c sprue vs pieza` con la referencia `§6.4.7: si el sprue domina el ciclo, reducir ⌀ (steel-safe)`
  y la marca como `warn` cuando `tcSprueS > tcPartS`. Es uno de los pocos retornos que el motor
  **señala** de verdad. **Hueco:** señala, no ejecuta: no reduce el diámetro solo.

### A-43 · Tiempo de ciclo gobernante del molde
- **CUÁNDO:** al cerrar A-39/A-42, sobre todas las cavidades del molde.
- **ENTRADAS:** `tc` de cada sección y de cada pieza del molde familiar ←A-39, A-42.
- **EL CÁLCULO:** máximo sobre todas las secciones. En el molde familiar cup/lid: `max(8.4, 18.9, 22.9)`.
- **SALIDA:** `tc_ciclo` [s].
- **DECIDE:** ⇒ **RETORNO a arquitectura.** *"the family mold will be forced to operate at the much
  longer cycle time of the cup. If high production quantities are desired with parts of different wall
  thicknesses, then it may be more economical to use two different molds ... **However, such a mold
  design strategy gives up color matching and at-press assembly which are very significant benefits
  for family molds.**"* Es un juicio de negocio, no de física, y regresa hasta la fase de arquitectura
  (cap. 3–4), invalidando el plan de cavidades completo.
- **CRITERIO:** **[JUICIO]** económico sobre un número físico.
- **INVALIDA:** cambio de espesores, de familia de piezas o del volumen de producción.
- **¿TENEMOS?** **PARCIAL.** `cooling.ts::coolingReport` da el `governing` y el `cycleCoolingS`
  (el máximo), y el contrato `agua-ciclo` (§9.2.1) lo audita. **FALTA** el retorno: no existe la
  comparación "un molde familiar vs dos moldes" con su trade-off de color matching y ensamble a pie
  de prensa. Es una decisión que el motor de costeo (cap. 3) podría resolver y hoy nadie plantea.

### A-44 · Flujo de calor por un solo lado (h → 2h)
- **CUÁNDO:** cuando la geometría lo impone: núcleo esbelto largo, o capa aislante debajo (two-shot).
- **ENTRADAS:** espesor de la capa ←A-37 · detección de la condición de un solo lado.
- **EL CÁLCULO:** sustitución, no ecuación nueva: *"Eqs. (9.5), (9.6), and (9.8) may be used by
  **substituting twice the thickness** of the molding for the variable, h. The result is that any
  molding application with a one sided heat flow will have a **four fold increase in the cooling
  time**."* La justificación: *"the thermal behavior is essentially the same as if **two layers of the
  plastic melt were on top of each other**. This double thickness representation is valid since the
  temperature distribution is symmetric across the centerline so there is no associated heat flux."*
- **SALIDA:** `tc` corregido [s] — **×4**.
- **DECIDE:** si la geometría es viable económicamente, y dispara A-45 y A-63.
- **CRITERIO:** **[LIBRO]** exacto (el factor 4 sale de que `tc` va con `h²`).
- **INVALIDA:** que se agregue enfriamiento por el segundo lado.
- **¿TENEMOS?** **PARCIAL — solo en la lámina.** `lamina-nucleo-enfriamiento.ts:608` hace
  `coolingTimePlate((2 * hMm) / 1000, mat)` con la cita literal en el comentario (línea 602).
  **Hueco:** la **detección automática** de la condición no existe — la lámina lo dibuja cuando se le
  pide, pero `coolingDesign` nunca pregunta "¿esta cara enfría por un solo lado?". El pin conductivo
  esbelto es el caso que más duele: §9.3.5.5 dice que con L/D alto *"the core pins prevent the flow of
  heat down the length of the core pins and **act primarily as insulators**"*, y ese caso debería
  disparar la sustitución solo.

### A-45 · Orden de las capas en two-shot
- **CUÁNDO:** solo en sobremoldeo, después de A-44.
- **ENTRADAS:** espesores y materiales de las dos capas · `tc` de cada orden ←A-44.
- **EL CÁLCULO:** comparación de dos escenarios completos. ABS 3 mm sobre PC (aislante) → **75.6 s**,
  antieconómico porque el ciclo aplica a ambas capas. PC 2 mm al final → **13.5 s**, menor que los
  18.9 s del ABS solo, o sea **no añade tiempo de ciclo**.
- **SALIDA:** el orden de disparos + los dos tiempos.
- **DECIDE:** la secuencia del proceso. Literal: *"To be more economical, **it is preferable to mold
  the thinner layer second**."* **La secuencia de los disparos es una decisión de enfriamiento**, no
  de proceso.
- **CRITERIO:** **[COMPARA]** entre los dos órdenes, con la regla derivada (capa delgada al final).
- **INVALIDA:** cambio de materiales o espesores de capa.
- **¿TENEMOS?** **FALTA.** No hay nada de two-shot / sobremoldeo en `src/forja/mold/`.

## C.2 — Del tiempo de ciclo al caudal

### A-46 · Masa del disparo
- **CUÁNDO:** paso 2 de los siete (§9.2.2).
- **ENTRADAS:** volumen de las piezas ←cap. 2 · volumen de los **runners fríos** ←cap. 6 · densidad.
- **EL CÁLCULO:** `m = (V_piezas + V_runners) · rho`, con la nota literal de que se estima
  *"as the volume of these moldings times their density at room temperature"* — densidad a **20 °C**,
  no la del fundido. Ejemplo: **62.6 g** de ABS.
- **SALIDA:** `m` [kg].
- **DECIDE:** el calor a extraer (A-47). Olvidar los runners subestima el calor.
- **CRITERIO:** **[LIBRO]** de alcance: la masa **incluye la colada fría**.
- **INVALIDA:** cambio de cavidades o de diámetros de runner.
- **¿TENEMOS?** **SÍ, y con la densidad correcta.** `cooling-design.ts::PLASTICOS_A` documenta
  explícitamente que `rhoRT` = *"Density at 20 °C"* y que **Eq 9.10 usa ÉSTA, no la del fundido**.
  `coolingDesign` calcula `massKg` y lo reporta como `disparo`.

### A-47 · Calor a extraer por ciclo (Eq 9.10)
- **CUÁNDO:** paso 2, después de A-46.
- **ENTRADAS:** `m` ←A-46 · `Cp` ←material · `T_melt`, `T_eject` ←A-38.
- **EL CÁLCULO:** `Q = m · Cp · (T_melt − T_eject)` [J]. Ejemplo: 62.6 g de ABS → **20,900 J**.
- **SALIDA:** `Q` [J/ciclo].
- **DECIDE:** la potencia (A-48).
- **CRITERIO:** **[LIBRO]**, balance de energía sensible.
  ⚠ **NO OBSERVADO EN EL CORPUS:** el corpus derivado da la fórmula y el número **pero no le pone
  número de ecuación**. El número "Eq 9.10" viene del encargo y **coincide con lo que el código ya
  tenía escrito** (`cooling.ts::heatToRemove` lo rotula así desde antes), lo cual es evidencia
  independiente de que la numeración es real — pero no está citada en el corpus.
- **INVALIDA:** cambio de masa, material o temperaturas.
- **¿TENEMOS?** **SÍ.** `cooling.ts::heatToRemove(mKg, cpJPerKgC, m)` y
  `cooling-design.ts::heatPerShotJ`, ambas rotuladas Eq 9.10.

### A-48 · Potencia de enfriamiento total y por línea (Eqs 9.11 y 9.12)
- **CUÁNDO:** paso 2, cierre.
- **ENTRADAS:** `Q` ←A-47 · `tc` ←A-39 · número de líneas `n_lines` ←A-59 (¡lazo!).
- **EL CÁLCULO:** `Qdot = Q / tc` (Eq 9.11) y `Qdot_line = Qdot / n_lines` (Eq 9.12), con el supuesto
  literal *"Assuming that the mold is well designed and each cooling line removes the same amount of
  heat"*. Ejemplo: 20,900 J a 20 s → **1,050 W**; con 4 líneas → **260 W por línea**.
- **SALIDA:** `Qdot` [W] y `Qdot_line` [W].
- **DECIDE:** el caudal de refrigerante por línea (A-50).
- **CRITERIO:** **[LIBRO]** con supuesto de reparto uniforme declarado.
- **INVALIDA:** ⇒ **EL LAZO INTERIOR DEL CAPÍTULO.** `n_lines` se decide en A-59 (paso 6, el paso) y
  **regresa aquí** (paso 2). Kazmer lo declara en el propio §9.2.2: *"multiple design iterations may
  be necessary to perform the cooling analysis for different cooling line layouts with varying number
  of cooling lines."* No es un pipeline de 7 pasos: es 7 pasos con realimentación de 9.2.6 → 9.2.2.
- **¿TENEMOS?** **SÍ, y el lazo está cerrado.** `cooling-design.ts::coolingDesign` calcula `qCoolingW`
  y `qLineW`, y el bucle de la función **deriva `nLines` del paso** (comentario en línea 231:
  *"Nº DE LÍNEAS PARA QUE EL PASO NO SE PASE DE W (Eq 9.24)"*) y **recalcula** `qLineW` y `vDotLine`
  con ese número. El lazo 9.2.6 → 9.2.2 está implementado.

### A-49 · ΔT admisible del refrigerante
- **CUÁNDO:** paso 3 (§9.2.3), antes de calcular caudal.
- **ENTRADAS:** clase de la pieza (commodity vs precisión) ←cap. 2.
- **EL CÁLCULO:** selección entre dos anclas. Literal: *"A typical allowable increase in the coolant
  temperature is **1 °C**. For a **precision part**, the allowable increase may be **0.1 °C**."*
- **SALIDA:** `ΔT` [°C].
- **DECIDE:** el caudal (A-50) — que va **inversamente** con `ΔT`, así que 0.1 °C multiplica el caudal
  por diez.
- **CRITERIO:** **[LIBRO]** con un techo de beneficio explícito: *"Much tighter control of the coolant
  temperature requires much higher flow rates, **and yet provides little added benefit** given that the
  mold cavity surface temperatures will tend to vary more significantly **between the cooling lines**."*
  Traducido: **no sirve apretar el refrigerante si el paso está flojo** — A-49 está subordinado a A-59.
- **INVALIDA:** cambio de la clase de tolerancia de la pieza.
- **¿TENEMOS?** **PARCIAL.** `cooling-design.ts` toma `dT` como entrada y lo usa en Eq 9.13, y el
  reporte lo imprime. **FALTA** la selección automática por clase de pieza (1 °C vs 0.1 °C) y, sobre
  todo, **la advertencia del techo de beneficio**: nada avisa que apretar `ΔT` con paso ancho es tirar
  caudal a la basura.

### A-50 · Caudal de refrigerante por línea (Eq 9.13)
- **CUÁNDO:** paso 3.
- **ENTRADAS:** `Qdot_line` ←A-48 · `ΔT` ←A-49 · `rho` y `Cp` del refrigerante (Apéndice C).
- **EL CÁLCULO:** `Vdot = Qdot_line / (ΔT · rho · Cp)`. Ejemplo agua: 260 W con 1 °C →
  **6.2e-5 m³/s ≈ 1 GPM**. Y la corrección de topología: *"if two cooling lines were connected **in
  series**, then the cooling power would also be **doubled** such that **twice the flow rate** would be
  needed to maintain the same temperature distribution."*
- **SALIDA:** `Vdot_line` [m³/s].
- **DECIDE:** el rango de diámetro (A-52, A-53) y la carga sobre el controlador (A-51).
- **CRITERIO:** **[LIBRO]**, balance de energía.
- **INVALIDA:** cambio de `Qdot_line`, de `ΔT`, de refrigerante o de la topología serie/paralelo.
- **¿TENEMOS?** **PARCIAL — con un error del lado optimista.**
  `coolinglines.ts::coolantFlowRate` y la línea 237 de `cooling-design.ts`
  (`vDotLine = qLineW / (c.rhoKgM3 * c.cpJkgC * dT)`), rotulada Eq 9.13.
  **Hueco:** la corrección por serie se aplica a la **longitud** para el ΔP (`lSerieM = lineLenMm *
  inSeries`) pero **no a la potencia por circuito**: dos líneas en serie deberían duplicar el caudal
  requerido y el motor no lo hace. Es un error del lado optimista.

### A-51 · Factibilidad contra el controlador comercial (Tabla 9.1)
- **CUÁNDO:** paso 3, cierre. Es un gate de realidad.
- **ENTRADAS:** `Vdot_line · n_lines` ←A-50/A-59 · presión requerida ←A-53 · temperatura objetivo del
  molde.
- **EL CÁLCULO:** comparación contra catálogo:

  | | VacTherm (agua) | IMSelect (aceite) |
  |---|---|---|
  | T mín / máx | 10 / 99 °C | 32 / 304 °C |
  | Calentamiento | 9 kW | 16 kW |
  | Enfriamiento | 14.6 kW | 16 kW |
  | Gasto | 1e-3 m³/s (15 GPM) | 3e-3 m³/s (45 GPM) |
  | Presión | 200 kPa (29 psi) | 30 kPa (4.3 psi) |

  Ejemplo: las 4 líneas piden 2.5e-4 m³/s → **un solo controlador alcanza**.
- **SALIDA:** número de controladores + veredicto de compatibilidad.
- **DECIDE:** cuántas unidades se rentan y si el diseño es operable. Umbrales de quiebre citados:
  *"multiple mold temperature controllers would be needed if the allowable temperature increase were
  set to 0.1 °C, or if the number of cavities in the mold was increased from 2 to 8."*
- **CRITERIO:** **[LIBRO]** contra catálogo real. El catálogo es restricción dura, no sugerencia.
- **INVALIDA:** cambio de `ΔT`, de cavidades o de refrigerante.
- **¿TENEMOS?** **SÍ, doble.** `cooling-design.ts::CONTROLADORES` y `coolinglines.ts::CONTROLLERS`
  reproducen las dos filas con caudal, presión y rango de temperatura; el contrato `agua-controlador`
  (§9.2.3 · Tabla 9.1) audita la compatibilidad y `coolingDesign` filtra por agua/aceite.

## C.3 — Del caudal al diámetro

### A-52 · Diámetro MÁXIMO por turbulencia (Eqs 9.14 y 9.15)
- **CUÁNDO:** paso 4 (§9.2.4).
- **ENTRADAS:** `Vdot_line` ←A-50 · `rho`, `mu` del refrigerante.
- **EL CÁLCULO:** `Re = 4·rho·Vdot / (pi·mu·D)` (Eq 9.14) con la condición `Re > 4000`, de donde
  `D_max = 4·rho·Vdot / (pi·mu·4000)` (Eq 9.15). Ejemplo: **20 mm**.
- **SALIDA:** `D_max` [mm].
- **DECIDE:** el techo del rango de diámetro. Pero con expectativa baja: *"the requirement of turbulent
  flow is **not very constraining** ... **Most molding applications require a high rate of heat transfer
  and an associated high volumetric flow rate such that turbulent flow is almost given.**"*
  Verifícalo; no lo trates como el driver.
- **CRITERIO:** **[LIBRO]**, `Re > 4000`.
- **INVALIDA:** cambio de caudal o de refrigerante.
- **¿TENEMOS?** **SÍ.** `cooling-design.ts::reynoldsLine` y `::dMaxTurbulentM`;
  `coolinglines.ts::reynolds` y `::maxLineDiameter`. Contrato `agua-turbulento` (§9.2.4) con el
  mensaje correcto: *"flujo LAMINAR, el agua no arranca el calor (Eq 9.14)"*.

### A-53 · Diámetro MÍNIMO por caída de presión (Eqs 9.16 y 9.17)
- **CUÁNDO:** paso 4, junto con A-52.
- **ENTRADAS:** `Vdot_line` ←A-50 · **longitud real del circuito** (las líneas en serie se **suman**) ·
  `ΔP` admisible ←presión del controlador (A-51).
- **EL CÁLCULO:** `ΔP = rho·L·Vdot^2 / (10·pi·D^5)` (Eq 9.16), de donde
  `D_min = ( rho·L·Vdot^2 / (10·pi·ΔP) )^(1/5)` (Eq 9.17). Ejemplo: dos líneas de 302 mm en serie →
  `L = 0.6 m`, con 100 kPa → **3.7 mm**. Junto con A-52: **3.7 mm < D < 20 mm**, y el libro comenta
  *"While this is quite a broad range, the allowable range may be much smaller depending on the
  molding application."*
- **SALIDA:** `D_min` [mm].
- **DECIDE:** el piso del rango.
- **CRITERIO:** **[LIBRO]** con **la regla de reserva de presión**, que es donde se pierde la mitad
  del presupuesto: *"The allowable pressure drop is set to 100 kPa, which is **½ of the maximum supply
  pressure** from the VacTherm controller. **This last assumption is made to ensure that some supply
  pressure is reserved for flow through the cooling hoses from the controller to the mold, as well as
  for pressure drops associated with turns, plugs, etc.**"*
  Como `D` va con `(ΔP·L)^(1/5)`, usar la presión nominal completa y la longitud de una sola línea
  subdimensiona el diámetro por un factor grande.
- **INVALIDA:** cambio de topología del circuito (que cambia `L`), de caudal o de controlador.
- **¿TENEMOS?** **SÍ, con la suma en serie.** `cooling-design.ts::dPLinePa` y `::dMinPressureM`;
  la longitud se suma (`lSerieM = (o.lineLenMm * inSeries) / 1000`) y el reporte lo dice.
  **Verificar:** que el `ΔP` admisible se fije en **½** de la presión del controlador y no en la
  nominal — el default `inSeries = 2` sí reproduce el ejemplo del libro.

### A-54 · Selección del diámetro estándar (Tabla 9.2)
- **CUÁNDO:** paso 4, cierre. Es donde el óptimo continuo se rinde al catálogo.
- **ENTRADAS:** `[D_min, D_max]` ←A-52/A-53 · catálogo de plugs del moldeador.
- **EL CÁLCULO:** elegir dentro del rango un tamaño de catálogo:

  | Plug DME | Rosca NPT | ⌀ línea |
  |---|---|---|
  | JP-250 | 1/16 | 4.76 mm (3/16") |
  | JP-251 | 1/8 | 6.35 mm (1/4") |
  | JP-352 | 1/4 | 9.53 mm (3/8") |
  | JP-553 | 3/8 | 11.1 mm (7/16") |
  | JP-554 | 1/2 | 15.9 mm (5/8") |

  Elección del ejemplo: **6.35 mm**.
- **SALIDA:** `D` [mm] de catálogo + el plug asociado.
- **DECIDE:** el diámetro que se maquina, y con él la profundidad (A-58) y el paso (A-59), que van
  en múltiplos de `D`.
- **CRITERIO:** **[JUICIO] del taller, no del cálculo.** Literal: *"the mold designer should consider
  the **manufacturability** of the cooling lines and **the molder's standards regarding cooling plugs,
  connectors, and hoses** ... The mold designer should select a cooling line diameter that satisfies
  the above analysis **and is a standard size**."*
- **INVALIDA:** cambio del catálogo del moldeador; que `[D_min, D_max]` se vacíe.
- **¿TENEMOS?** **SÍ.** `cooling-design.ts::PLUGS_DME` y `coolinglines.ts::COOLING_PLUGS` con las cinco
  filas; `designCoolingLines` elige el plug dentro del rango y, cuando no hay ninguno, avisa
  *"ningún plug DME en el rango"* y manda la línea a medida. Contrato `agua-catalogo`
  (§9.2.4 · Tabla 9.2) y `agua-diametro` (§9.2.4).

### A-55 · Refrigerante viscoso: régimen laminar (Eq 9.18)
- **CUÁNDO:** solo si el refrigerante no es agua.
- **ENTRADAS:** propiedades del glicol o del aceite.
- **EL CÁLCULO:** con `mu` alta la turbulencia no se logra, así que el ΔP se calcula con
  **Hagen-Poiseuille** (Eq 9.18) en vez de Eq 9.16, y se verifica contra la capacidad del controlador.
- **SALIDA:** `ΔP` laminar [Pa] + veredicto contra el controlador.
- **DECIDE:** el diámetro mínimo en esa rama, y si el refrigerante es viable.
- **CRITERIO:** **[LIBRO]** con desaliento explícito: *"Ethylene glycol and oil are **not as common in
  practice due to environmental and cost concerns**. These non-water coolants are also substantially
  more viscous than water, such that **turbulent flow is not likely to be achieved**."*
- **INVALIDA:** cambio de refrigerante.
- **¿TENEMOS?** **PARCIAL — la fórmula sí, el conmutador no.**
  `cooling-design.ts::dPLineLaminarPa` rotulada Eq 9.18, y
  `coolinglines.ts` define `GLYCOL` y `OIL` con `turbulent: false`.
  **Hueco:** el selector no cambia automáticamente de Eq 9.16 a Eq 9.18 según el refrigerante; la
  bandera `turbulent` existe y hay que consultarla a mano.

## C.4 — Del diámetro al layout

### A-56 · Profundidad por concentración de esfuerzo (Eq 9.19)
- **CUÁNDO:** paso 5 (§9.2.5). Es la restricción que **empuja la línea hacia el fondo**.
- **ENTRADAS:** `D` ←A-54 · presión de fundido esperada ←cap. 5 · límite de fatiga del acero del molde.
- **EL CÁLCULO:** factores de concentración medidos sobre la sección (Fig 9.4):
  `H = 1D → sigma = 3.3 · P_melt` · `H = 4D → sigma = 2.6 · P_melt`,
  de donde `P_melt_max = sigma_endurance / K_t` (Eq 9.19).
  Dos casos del libro: **P20** con 456 MPa de resistencia a 4D → **175 MPa**, *"which is close to the
  maximum injection pressures available from most molding machines"*. **Aluminio** con 166 MPa de
  límite de fatiga a 1D → **50 MPa**.
- **SALIDA:** `P_melt_max` [MPa] a esa profundidad, y el veredicto contra la presión de operación.
- **DECIDE:** el piso de profundidad, y una alarma de **vida del molde**.
- **CRITERIO:** **[COMPARA]** presión de operación contra `P_melt_max`. Con un matiz importante:
  *"This analysis **does not prevent** a mold designer or a molder from operating at higher melt
  pressures, but simply indicates that **the mold will likely not operate for a long life without
  developing cracks emanating from the cooling lines**."* No es una prohibición: es una predicción
  de fatiga.
- **INVALIDA:** cambio de acero, de diámetro o de la presión de proceso.
- **¿TENEMOS?** **SÍ.** `cooling-design.ts::stressConcentration(hOverD)` interpola entre 3.3 y 2.6,
  `::maxMeltPressureMPa(sigmaEnduranceMPa, scf)` aplica Eq 9.19, y `ACEROS_MOLDE` guarda
  `sigmaEnduranceMPa` por acero. La trampa del aluminio (50 MPa) es reproducible con el mismo código.

### A-57 · Profundidad por transferencia de calor (Eqs 9.20 y 9.21)
- **CUÁNDO:** paso 5, en tensión con A-56. Es la restricción que **jala la línea hacia la superficie**.
- **ENTRADAS:** conductividad del acero `k_mold` · coeficiente de convección al refrigerante
  `h_c ≈ 1000 W/(m²·°C)`.
- **EL CÁLCULO:** el acero sobre la línea se modela como una conductancia `h_conduction = k_mold / H_line`
  (Eq 9.20); para que el acero no sea el cuello de botella frente a la convección se pide
  `H_line < k_mold / 1000` (Eq 9.21). Para **P20** con `k = 32 W/m°C` → **H_line máximo 32 mm**.
- **SALIDA:** `H_max_termica` [mm].
- **DECIDE:** el techo de profundidad. Si se rebasa, **la propia línea alarga el ciclo**.
- **CRITERIO:** **[LIBRO]** por comparación de resistencias.
  ⚠ Inconsistencia de unidades del libro, ya anotada en A-41: `h_c` se escribe *"1000 W/°C"* y
  *"1000 W/m°C"*; para que la cuenta dé 32 mm tienen que ser **W/(m²·°C)**.
- **INVALIDA:** cambio de acero (Cu 940 sube muchísimo este techo) o del caudal.
- **¿TENEMOS?** **SÍ.** `cooling-design.ts::hConduction = kMoldWmC / hLineM` (Eq 9.20) y
  `::hLineMaxM = kMoldWmC / 1000` (Eq 9.21). El mensaje de falla es exacto:
  *"la línea está tan honda que ELLA alarga el ciclo (Eq 9.21)"*.

### A-58 · Ventana de profundidad 2D < H < 5D (Eq 9.22)
- **CUÁNDO:** paso 5, cierre. Sintetiza A-56 y A-57.
- **ENTRADAS:** `D` ←A-54 · `P_melt_max` ←A-56 · `H_max_termica` ←A-57.
- **EL CÁLCULO:** intersección de las dos restricciones, con la recomendación literal:
  *"Combining the structural and heat transfer requirements for a typical 6.35 mm diameter cooling
  line, the recommended range for the cooling line depth is **2 D < H_line < 5 D**, which is a commonly
  used range in mold design. While a mold designer may choose an **arbitrary** cooling line depth from
  this range, the provided analysis should be used **for special applications** with diverse structural
  or heat transfer requirements."*
  Ejemplo: `D = 6.35 mm` con `H = 4D` → **25.4 mm**.
- **SALIDA:** `H_line` [mm].
- **DECIDE:** la profundidad que se maquina, y **la base del paso** (A-59, que va en múltiplos de `H`).
- **CRITERIO:** **[LIBRO]**, y el propio libro declara que dentro del rango la elección es
  **arbitraria**: el análisis se reserva para casos especiales. Es honestidad poco común —
  dice cuándo su propio cálculo no hace falta.
- **INVALIDA:** cambio de `D`, de acero o de presión.
- **¿TENEMOS?** **SÍ, y bien resuelto.** `cooling-design.ts::coolingDesign` construye la ventana como
  intersección explícita — `const hi = Math.min(hiEstruct, hMaxTermicaM)` con el comentario
  *"Eq 9.21 RECORTA a Eq 9.22"* — y el default de `H/D` es **4**, el mismo que usa el libro.
  Contrato `agua-profundidad` (§9.2.5), que además emite la falla correcta cuando `H < 2D`:
  *"concentración de esfuerzo, el acero se agrieta desde el barreno"*.

### A-59 · Paso entre líneas (Eqs 9.23 y 9.24)
- **CUÁNDO:** paso 6 (§9.2.6). Y **desde aquí sale el número de líneas que regresa a A-48**.
- **ENTRADAS:** `H_line` ←A-58 · clase de tolerancia del producto ←cap. 2 · ancho a cubrir.
- **EL CÁLCULO:** la recomendación es `H_line < W_line < 2·H_line` (Eq 9.24), sostenida por la curva
  empírica de Menges (Eq 9.23, Fig 9.5) que mide **variación porcentual del flujo de calor** contra la
  razón paso:profundidad. El hallazgo numérico: *"the variation in the heat flux is **less than 5% up
  to a cooling line pitch equal to twice the cooling line depth. Afterwards, the variation in heat flux
  increases dramatically**."*
  Y la modulación por producto: *"A **commodity product with loose tolerances** would likely be fine
  with a cooling line pitch equal to **two or three times** the cooling line depth. For **tighter
  tolerance** applications or for applications requiring **faster cycle times or more uniform cooling**,
  a closer spacing **equal to the cooling line depth** is desirable."*
- **SALIDA:** `W_line` [mm] y, dividiendo el ancho a cubrir, **`n_lines`**.
- **DECIDE:** dos cosas: la uniformidad del campo térmico (A-62 → alabeo A-71), y ⇒ **el regreso a
  A-48** con el nuevo `n_lines`.
- **CRITERIO:** **[LIBRO]** con umbral del 5 % de variación, más **[JUICIO]** por clase de producto.
  Nota de estatus: para la temperatura *"no suitable analytical treatment has yet been developed"* —
  la curva de Menges es una estimación empírica, no teoría.
- **INVALIDA:** cambio de `H_line`, de tolerancia del producto o del ancho de la cavidad.
- **¿TENEMOS?** **SÍ, con el lazo cerrado.** `cooling-design.ts` línea 230:
  `wLineMm = wOverHTarget * hLineM * 1000` (Eq 9.24), y luego **deriva `nLines` del paso** y recalcula
  `qLineW` y `vDotLine` — el retorno 9.2.6 → 9.2.2 que el libro declara.
  `::heatFluxVariation(wOverH)` implementa la curva de Menges (Eq 9.23). Contrato `agua-paso` (§9.2.6).

### A-60 · La trampa del material conductivo a paso ancho
- **CUÁNDO:** cada vez que alguien propone menos líneas porque el molde es de aluminio o cobre.
- **ENTRADAS:** conductividad del material del molde · razón `W/H` ←A-59.
- **EL CÁLCULO:** lectura de la misma Fig 9.5, en la rama del material conductivo. Literal:
  *"Figure 9.5 indicates that the use of highly conductive materials (such as aluminum or copper)
  **actually increases the variation in heat flux** by improving the heat conduction between the
  cooling line and the cavity surface. As such, **the use of highly conductive materials does not
  directly allow for a wider pitch and a reduced number of cooling lines**. If fewer cooling lines are
  desired, then this may best be accomplished by **selecting a large cooling line depth and still
  setting the pitch to twice this amount**. Highly conductive mold materials can then be utilized to
  accomplish high rates of heat transfer with uniform cooling."*
- **SALIDA:** veredicto sobre la propuesta de reducir líneas + la receta correcta
  (subir `H`, mantener `W = 2H`, y **entonces sí** usar material conductivo).
- **DECIDE:** que no se reduzca el número de líneas por argumento de conductividad.
- **CRITERIO:** **[LIBRO]** contraintuitivo: la inferencia natural (mejor conductor ⇒ puedo separar
  las líneas) es **exactamente al revés**. Y hay un corolario que mata el arreglo de piso:
  *"extending the cycle time for the mold with the wider pitch **does not reduce the temperature
  gradients** across the part **until the entire molded part approaches the coolant temperature**."*
  Con paso flojo, alargar el ciclo **no** cura el gradiente.
- **INVALIDA:** nada; es una regla estructural.
- **¿TENEMOS?** **FALTA como alarma.** `heatFluxVariation` existe pero no distingue material, y
  `moldbase.ts:92` recomienda Cu 940 *"El ciclo manda"* **sin** la advertencia de que a paso ancho
  empeora la uniformidad. Hoy el motor puede sugerir cobre y dejar el paso flojo — justo el error que
  el libro dedica un párrafo a prevenir.

### A-61 · Ruteo: interferencia y claro de medio diámetro
- **CUÁNDO:** paso 7 (§9.2.7). Es donde todo choca.
- **ENTRADAS:** layout de líneas ←A-54/A-58/A-59 · geometría de **todos** los demás componentes.
- **EL CÁLCULO:** detección de interferencia con un claro mínimo: *"In general, the mold design should
  provide **at least half a cooling diameter** between the surface of the cooling line and the surface
  of **any other mold component**. This requirement maintains the structural integrity of the mold
  while also **minimizing cooling leaks during mold operation due to corrosion**."*
  La lista literal de con qué choca: *"the mold cavity, cavity inserts, core inserts, **ejector return
  pins, guide pins, sprue bushing**, and other mold components."*
- **SALIDA:** conteo de interferencias (cualquiera > 0 = inviable) + el claro mínimo medido.
- **DECIDE:** ⇒ **EL RETORNO MÁS CARO DEL CAPÍTULO.** Aplicar al pie de la letra `⌀6.35 / H=12.7 /
  W=25.4` da un layout infactible (Fig 9.9): *"many of the cooling lines intersect critical mold
  features such as the sprue bushing or the interface between the cavity inserts and the mold plates."*
  Dos estrategias de rescate, con su costo declarado:
  - **(A) Agrandar** insertos y mold base para que quepan todas las líneas: *"This option is costly
    since it requires **redesign of the mold, procurement of a larger mold base, and more machining**.
    However, such a design **may be economically justified** given the more rapid and uniform cooling."*
    ⇒ invalida base y placas (cap. 4).
  - **(B) Alejar** las líneas manteniendo la razón paso:profundidad: *"While this design provides
    **poor cooling performance, it is quite common**. A primary advantage is that all of the cooling
    lines are **not only straight, but each cooling line also passes through a single mold plate** as
    well. As such, **the cooling lines can be machined in a single setup without any need for seals or
    gaskets.**"* Costo: menor transferencia y ciclos más largos.
- **CRITERIO:** **[LIBRO]** geométrico (½·D) para la factibilidad; **[JUICIO]** económico para elegir
  entre (A) y (B). La lección de la tríada Fig 9.9 → 9.10 → 9.11 es que **"no colisiona" no significa
  "está bien"**: el layout (B) pasa el check de colisión y produce el campo térmico malo de A-62.
- **INVALIDA:** cualquier cambio de `D`, `H`, `W`, del layout de expulsión o del tamaño de insertos.
- **¿TENEMOS?** **PARCIAL, y el propio código denuncia su hueco.** El contrato `agua-claro` (§9.2.7)
  tiene el criterio literal *"al menos medio diámetro de claro entre la línea y CUALQUIER otro
  componente (estructura + fugas por corrosión)"* y el límite bien puesto (`limite: D / 2`), con la
  lista completa de componentes en el detalle. `collision.ts` clasifica interfaces incluyendo
  `'agua-canal'` y trata como **no esperadas** las parejas `pin↔agua` y `agua↔inserto`.
  **Dos huecos, ambos anotados en el código:**
  (a) el criterio nace en estado `SIN-CABLEAR` — *"sin molde ensamblado no se puede medir"*;
  (b) cuando sí mide, la medición viene de `coordAudit`, y el propio detalle avisa:
  *"OJO: coordAudit usa un umbral FIJO de 2 mm, más flojo que el ½⌀ del libro, así que puede estar
  en verde mientras esto está en rojo"* — **el criterio correcto evaluado con la métrica equivocada**.
  Y **falta por completo el retorno**: no existe la elección entre (A) agrandar la base y (B) alejar
  las líneas, con su costo.

### A-62 · Campo térmico del molde y gradiente del núcleo profundo
- **CUÁNDO:** después de A-61, sobre el layout ya ruteado. Es el juez de todo el capítulo.
- **ENTRADAS:** layout de líneas ←A-61 · materiales de inserto ←A-65 · `T_coolant` · carga térmica
  ←A-47 · geometría del núcleo.
- **EL CÁLCULO:** resolver el campo de temperatura del molde y la pieza al final del ciclo y **contar
  isotermas**. Clave de lectura del libro: *"each contour line represents a 2 °C change in temperature."*
  Los dos números que se leen del mapa (Fig 9.11): *"Due to the relatively deep core, a gradient of
  **6 °C** exists from the base of the core to the top of the core"*, y *"the temperature at the top of
  the core is not only 6 °C hotter than the temperature at the base of the core, but is also roughly
  **6 °C hotter than the temperature at the opposing surface on the cavity insert**."*
- **SALIDA:** dos gradientes [°C] — base↔punta del núcleo, y núcleo↔cavidad a través de la pared — más
  el mapa.
- **DECIDE:** dos cosas: (1) dispara los tres remedios de §9.3 — *"using a **highly conductive core
  insert**, implementing a **baffle or bubbler**, or designing a **cooling insert**"* (A-63, A-65);
  (2) alimenta el alabeo (A-71). El libro lo dice explícito: *"The temperature gradient in Figure 9.11
  will drive differential shrinkage along the axis of the cup as well as differential shrinkage through
  the wall thickness of the molding."*
- **CRITERIO:** **[LIBRO]** por conteo de contornos, con **6 °C** como el valor que el propio libro
  declara problemático en su ejemplo. Y el paso de contorno es **fijo en 2 °C**, no auto-escalado: el
  juicio de Kazmer es literalmente contar isotermas.
- **INVALIDA:** cualquier cambio de layout, material o ciclo.
- **¿TENEMOS?** **SÍ, y es el músculo más caro que tenemos.** `mold-thermal-fdm.ts` resuelve el
  transitorio 3D real (`∂T/∂t = alpha·∇²T` explícito sobre las placas A+B, inyección por ciclo,
  líneas de agua como frontera de Robin con `h = 1000 W/m²·°C` citando Eq 9.7, exterior adiabático)
  — *"Es la MISMA física que las Figs 9.7/9.11 del libro (ahí resuelta por FEM)"*.
  `thermal-steady.ts::solveSteadyMoldField` da el permanente. Y el **juez con ojos** existe:
  `laminas-visuales.ts` emite la lámina L18 con isotermas a paso fijo de 2 °C, cuenta contornos y
  reprueba contra el umbral del libro: *"el libro reprueba su ejemplo con 6 °C de base a punta del
  núcleo"*, cerrando con el enlace al alabeo: *"2 °C ya dan 1.6 mm"*.

### A-63 · Selector de enfriamiento para núcleo esbelto (Tabla 9.3)
- **CUÁNDO:** cuando A-62 detecta gradiente en un núcleo, o cuando la esbeltez lo anticipa.
- **ENTRADAS:** **diámetro del núcleo** [mm] · longitud del núcleo · espacio para el barreno.
- **EL CÁLCULO:** selección tabular por diámetro:

  | Opción | ⌀ núcleo | ⌀ barreno | Tasa de enfriamiento |
  |---|---|---|---|
  | Cooling insert | > 50 mm | > 25 mm | Muy alta |
  | Baffle | 12–75 mm | 6–25 mm | Muy alta |
  | Bubbler | 6–30 mm | 3–12 mm | Alta |
  | Heat pipe | 5–20 mm | 3–12 mm | Media |
  | Conductive pin | < 5 mm | N/A | Baja |

  El principio detrás: *"Mold cores with a high length to diameter ratio prevent effective heat transfer
  along the length of the core, **even with the use of highly conductive materials**"* → hay que conducir
  el calor a la superficie del núcleo y **convectarlo por el centro**. Cotas extra: baffle mínimo
  ⌀ barreno **> 6.35 mm (1/4")**; bubbler de **< 2 mm en barreno < 3 mm**.
- **SALIDA:** método elegido + ⌀ de barreno.
- **DECIDE:** qué componente entra al núcleo, y con él A-64 (integridad estructural).
- **CRITERIO:** **[LIBRO]** dimensional, con una **preferencia declarada** que no es de desempeño sino
  de riesgo: *"In terms of availability, **baffles are standard components readily available from a
  number of suppliers, whereas cooling inserts must be designed and manufactured**. Given the
  **complexity, expense, and risk** associated with a custom cooling insert, **the baffle is clearly
  preferred whenever the molding application allows**."*
  Y el fondo de la escalera, cuando nada cabe: núcleo **interbloqueado** con la cavidad opuesta y
  **aire** como refrigerante — *"Air is typically used as the coolant in such a design since this
  coolant will be exposed to the molded part and the environment when the mold is opened."*
- **INVALIDA:** cambio de geometría del núcleo.
- **¿TENEMOS?** **SÍ, completo.** `slendercore.ts::SLENDER_COOLING` reproduce las cinco filas con
  rangos, tasa, carga axial/radial y si es estándar; `::chooseSlenderCoreCooling(coreDiaMm, coreLenMm)`
  aplica la preferencia por baffle y marca `needsAxial` cuando `L/⌀ > 3`.
  `lamina-nucleo-enfriamiento.ts::PREFERENCIA_LITERAL` = `['baffle','inserto','bubbler','heat-pipe',
  'pin-conductivo']` y dibuja la sección. **Hueco menor:** el umbral `L/⌀ > 3` para "necesita canal
  axial" es **INFERIDO** — el libro habla de *"high length to diameter ratio"* sin dar el número.
  ⚠ **NO OBSERVADO EN EL CORPUS:** el valor de `L/D` a partir del cual el núcleo se declara esbelto.

### A-64 · Integridad estructural del núcleo con el dispositivo dentro
- **CUÁNDO:** inmediatamente después de A-63.
- **ENTRADAS:** ⌀ de barreno ←A-63 · ⌀ de núcleo · presión de fundido · tipo de dispositivo.
- **EL CÁLCULO:** balance declarado: *"Larger cooling channels ... allow for higher coolant flow rates
  and higher rates of heat transfer. Larger cooling channels, however, require the removal of more
  volume inside the core and **a lessening of the core's structural integrity**."*
  Y por dispositivo: los **baffles** *"are not designed to carry any load in the axial direction and
  have limited load carrying capability in the radial direction (especially straight baffles). For
  this reason, the wall thickness of the core should be designed appropriately according to the
  analysis in Chapter 12."* El **bubbler** *"does not contact the core and so carries no load"*.
  El **cooling insert** sí puede cargar: *"the cooling insert can be provided with a **tight fit to
  the back surface of the core** so that forces resulting from the melt pressure are **transmitted
  directly to the support plate**."*
- **SALIDA:** espesor de pared requerido del núcleo [mm] + veredicto.
- **DECIDE:** si el ⌀ de barreno de A-63 se acepta o se reduce. Con la autocrítica del propio Kazmer
  sobre su figura: *"This particular design **may favor cooling at too great an expense of core
  strength**. Depending on the melt pressures, it may be warranted to **move the cooling channels
  further from the cavity surface while reducing their width**."*
- **CRITERIO:** **[COMPARA]** contra el análisis del cap. 12, no contra un umbral de este capítulo.
- **INVALIDA:** cambio de presión de fundido o de dispositivo.
- **¿TENEMOS?** **PARCIAL.** `slendercore.ts` acota el barreno a `≤ ⅔·⌀_core` citando §12.3.2 y anota
  por método si carga o no (`cargaAxial`, `cargaRadial`), y `cores.ts` calcula el esfuerzo de pared
  (`(pMPa * phiCoreMm) / (2 * hWallMm)`). **Hueco:** las dos piezas no se encadenan — nadie verifica
  el espesor resultante contra la presión con el dispositivo elegido.

### A-65 · Material asimétrico núcleo / cavidad
- **CUÁNDO:** cuando A-62 muestra gradiente a través del espesor, sobre todo en esquinas internas.
- **ENTRADAS:** gradiente medido ←A-62 · presiones de operación · abrasividad del material · volumen.
- **EL CÁLCULO:** cualitativo, apoyado en una asimetría física medida:
  *"Because of the heat transfer **in three dimensions** and limitations regarding the proximity of the
  cooling line to the mold wall, **the cavity insert will conduct approximately twice the amount of
  heat away from the molding compared to the core insert**."*
  Prueba numérica en la esquina: **P20/P20 → 5 °C** a través del espesor; **P20 cavidad + Cu 940
  núcleo → 1 °C**. Y en el núcleo profundo del cup, el gradiente cae **~60 %**.
- **SALIDA:** par de materiales (cavidad, núcleo) + el gradiente esperado.
- **DECIDE:** de qué se hace cada mitad. **El material es una decisión POR LADO.**
- **CRITERIO:** **[LIBRO]** con **la trampa que un optimizador global nunca encuentra**:
  *"the improved temperature distributions ... were the result of using **different materials for the
  core and the cavity inserts**. These temperature distributions **would not have been as uniform if
  both the core and cavity inserts were made from Cu 940**."* Hacer todo de cobre es **peor** que hacer
  solo el núcleo de cobre: la asimetría del material corrige la asimetría térmica; simetrizar la
  reintroduce. Segunda cota: *"these highly conductive materials tend to have **lower hardness and are
  more susceptible to wear**"* → aplicabilidad *"high production volumes, low to moderate injection
  pressures, and non-abrasive materials"*.
  Y el propósito real, que no es enfriar más: *"The primary advantage of highly conductive core inserts
  is **the ability to strategically control the heat flow**."*
- **INVALIDA:** cambio de presión de operación, de abrasividad o de volumen de producción.
- **¿TENEMOS?** **FALTA la regla, tenemos el material.** `moldbase.ts` tiene `Cu 940` en el catálogo
  (k=259 W/m°C, fatiga 290 MPa) y lo recomienda cuando *"El ciclo manda"*, pero **el material se elige
  para el molde, no por lado**, y no existe ni la regla de asimetría ni la alarma de "ambos de Cu 940
  es peor". Es un hueco de alto valor: el motor puede producir exactamente el diseño que el libro
  señala como error.

### A-66 · Retorno de inversión del material conductivo
- **CUÁNDO:** cuando se evalúa comprar acero o cobre caro para el molde.
- **ENTRADAS:** razón de conductividades · costo del material ←cap. 3.
- **EL CÁLCULO:** comparación de expectativa contra realidad. Literal: *"molds made out of highly
  conductive materials may have a **30% reduction in the cycle time** ... but not anything near the
  **eight-fold** improvement that might be anticipated from these material's high thermal conductivity
  values."* La razón: el cuello de botella se muda a la **conducción a través del plástico** y a la
  **convección al refrigerante**, no al acero.
- **SALIDA:** reducción de ciclo esperada [%].
- **DECIDE:** si la inversión se justifica. La frase que resume el capítulo:
  *"**The key to designing a cost effective mold is to know where to invest.**"*
  Y el costo escondido: *"Complex cooling line designs often require substantial **machining, plugging,
  sealing, fitting, and maintenance**."*
- **CRITERIO:** **[LIBRO]** con el número duro (30 %, no 800 %) y el punto de saturación:
  *"there is a point at which further investment in the cooling system reaps no rewards"*.
- **INVALIDA:** cambio de espesor de la pieza (que mueve el cuello de botella).
- **¿TENEMOS?** **FALTA.** El costeo (cap. 3) sabe cuánto cuesta el Cu 940, pero nadie calcula ni acota
  el **beneficio en ciclo**. Hoy la recomendación de `moldbase.ts` (*"El ciclo manda"*) no lleva número:
  es exactamente la expectativa de 8× que el libro desmonta.

## C.5 — El circuito como objeto de operación

### A-67 · Arquitectura del circuito
- **CUÁNDO:** después de A-61, al conectar las líneas entre sí.
- **ENTRADAS:** layout de líneas ←A-61 · tipo de molde (2 placas / 3 placas / canal caliente) ·
  hardware del moldeador.
- **EL CÁLCULO:** cualitativo, cuatro arquitecturas ordenadas **de peor a mejor**:
  1. **Serie improvisada** por el operador con mangueras cortas — la peor. *"Such a setup has **two
     compounding issues**. First, the flow resistance through the combined length of all the cooling
     lines can be **extremely high, reducing the coolant flow rates**. Second, the mold coolant
     temperature can increase along the length of the cooling circuit at reduced coolant flow rates."*
  2. **Paralelo con manifold en la máquina** — el estándar de facto. *"This configuration is **extremely
     common since it is simple and provides effective cooling**"*, pero *"The high number of components
     and operator steps also **increases the likelihood that the cooling system may be setup incorrectly
     or fail, for instance, due to a loosely connected hose.**"*
  3. **Manifold INTERNO al molde** — el ganador. Dos líneas verticales que unen las ocho horizontales
     con **veinte tapones a presión** → solo dos conexiones externas. *"This internal manifold design
     has **very little added cost while delivering both increased performance and ease of use**."*
  4. **Perimetral taladrado a ciegas** con tapones, cuando el centro no genera calor:
     *"extreme ease of use, moderate flow resistance, and uniform cooling about the entire molding"*.
  La llave que abre las opciones 3 y 4: *"**Once plugging is considered an option** in the routing of
  cooling lines, many more complex cooling line layout become available."*
- **SALIDA:** arquitectura elegida + número de tapones + número de conexiones externas.
- **DECIDE:** el número de conexiones (A-68), el ΔP del circuito (A-53) y el tiempo de setup del molde.
- **CRITERIO:** **[JUICIO]** con **lean manufacturing como criterio de diseño explícito** (menos
  complejidad de proceso, menos tiempo de setup, menos modos de falla del operador).
  ⚠ **Y una condición dura que depende de otro capítulo:** el circuito perimetral solo vale con molde
  de 3 placas o canal caliente. Con 2 placas y runner frío **el centro sí genera calor** (sprue y
  runners) y esas líneas centrales sí trabajan.
- **INVALIDA:** cambio del tipo de molde o del sistema de alimentación.
- **¿TENEMOS?** **FALTA.** No hay ningún modelo de arquitectura de circuito en `src/forja/mold/`:
  ni serie/paralelo, ni manifold interno, ni tapones como objeto, ni el veto del perimetral con molde
  de 2 placas. Se rutean líneas, no circuitos. Es el hueco más grande del cap. 9 en el motor, y es
  además el que gobierna la **usabilidad** (A-68), que sí auditamos sin poder calcularla bien.

### A-68 · Usabilidad del circuito para el operador
- **CUÁNDO:** al cerrar A-67.
- **ENTRADAS:** número de conexiones por mitad ←A-67 · geometría de los componentes externos.
- **EL CÁLCULO:** tres verificaciones literales (§9.1.6):
  1. *"The number of external connections should be kept to a minimum, and **preferably two (one inlet
     and one outlet) per mold half**."*
  2. *"If more than two connections are required, then the connections **should be labeled 'in' and
     'out'** to help the operator **avoid forming a dead circuit**."*
  3. *"To avoid damage to the cooling system, **all external components should be recessed** to avoid
     direct contact with tie bars, work tables, or other items."*
- **SALIDA:** conteo de conexiones + booleanos de etiquetado y de empotramiento.
- **DECIDE:** si el molde es operable sin error. Es un **objetivo de diseño medible** que casi ningún
  software modela.
- **CRITERIO:** **[LIBRO]**, ≤ 2 por mitad.
- **INVALIDA:** cambio de arquitectura (A-67).
- **¿TENEMOS?** **PARCIAL, y con el detalle correcto.** `mold-contratos.ts` id `agua-conexiones`
  (§9.1.6) audita el máximo de 2 conexiones por mitad, y el comentario de la línea 1211 muestra que
  el conteo se hace bien: *"las conexiones externas se cuentan del circuito RUTEADO, no del diseño
  numérico (N líneas ≠ N conexiones: el serpentín las une)"*. **FALTA** el etiquetado in/out, la
  detección de **circuito muerto** y el check de componentes empotrados.

### A-69 · Expulsores dentro del área sellada por gasket
- **CUÁNDO:** solo si A-67 o A-63 eligieron canales fresados en la cara trasera del inserto (§9.3.2).
- **ENTRADAS:** contorno del gasket · posiciones de pines expulsores ←cap. 11.
- **EL CÁLCULO:** booleano de contención punto-en-polígono. Literal: *"a groove has been provided and
  fitted with a **gasket**. When fastened tightly to the support plate, the gasket will prevent leakage
  outside the mold. **However, leakage should be expected at any ejector pins located internal to the
  area surrounded by gasket.** In this application, a **stripper plate** could be successfully used."*
- **SALIDA:** lista de pines dentro del contorno (cualquiera > 0 = fuga garantizada).
- **DECIDE:** cambiar a **placa desmoldeadora (stripper plate)** o mover los pines fuera del sello.
- **CRITERIO:** **[LIBRO]** binario y tajante — *"leakage **should be expected**"*, no "puede haber".
- **INVALIDA:** cambio del layout de expulsión o del contorno del canal fresado.
- **¿TENEMOS?** **FALTA.** No hay gasket ni canales fresados conformes en el motor, y por lo tanto
  tampoco el cruce con expulsión. La ficha visual V9.13 lo llama *"otro cruce entre subsistemas"* y
  lo califica de *"Booleano duro que solo se ve superponiendo dos subsistemas"* — y es de los
  baratos: un punto-en-polígono sobre la planta del núcleo.

  > **Enfriamiento conformal (§9.3.3), sin ficha.** El libro nombra el SLS y su efecto —
  > líneas helicoidales que siguen la cavidad, *"eliminating the temperature gradients"* — pero **no
  > da criterio de selección, ni cotas, ni cálculo**. Es una opción de manufactura a evaluar por costo
  > y disponibilidad, no un análisis. Si se implementa, su juez es A-62 (el campo térmico resultante),
  > no una regla propia.

### A-70 · Checklist de cierre de enfriamiento (§9.4)
- **CUÁNDO:** al congelar el subsistema de agua.
- **ENTRADAS:** A-37…A-69.
- **EL CÁLCULO:** conjunción de quince criterios: `t_c` con criterio de línea central sobre la sección
  más gruesa, contrastado contra `2·h²` y consciente de que la realidad será mayor; potencia, caudal y
  `ΔT` verificados contra un controlador real; `ΔT ≤ 1 °C` (0.1 en precisión); `Re > 4000` en cada
  línea; `D_min < D < D_max` **y** de catálogo; `ΔP` total ≤ **la mitad** de la presión de suministro;
  `2D < H < 5D` y `H < k/1000`; `H < W < 2H`; `P_melt` de operación ≤ `sigma_endurance / K_t`;
  ≥ medio diámetro de claro contra todo; ≤ 2 conexiones por mitad o etiquetadas; ningún circuito muerto
  posible; núcleos profundos con solución declarada de la Tabla 9.3; ningún expulsor dentro del gasket;
  y el gradiente máximo evaluado (6 °C ya es problema declarado).
- **SALIDA:** veredicto de subsistema + spec de enfriamiento (t_c por sección, potencia total y por
  línea, caudal y ΔT, D/H/W con sus rangos, layout con tapones y diagrama de conexión etiquetado
  in/out, compatibilidad citada con controlador y plugs).
- **DECIDE:** si el agua se libera a maquinado.
- **CRITERIO:** **[LIBRO]** conjunción.
- **INVALIDA:** cualquier cambio río arriba.
- **¿TENEMOS?** **PARCIAL.** Ocho contratos de agua existen (`agua-diametro`, `agua-catalogo`,
  `agua-turbulento`, `agua-profundidad`, `agua-paso`, `agua-controlador`, `agua-conexiones`,
  `agua-claro`, `agua-ciclo`). Faltan los criterios que dependen de lo que no modelamos: circuito
  muerto (A-68), gasket (A-69), y la evaluación del gradiente como criterio de cierre (A-62 existe
  como lámina, no como contrato).

---

# FRONTERA CON EL CAP. 10 — el análisis que cierra el argumento del cap. 9

El cap. 9 nunca dice "tu circuito está mal" con un número de pieza. Lo dice el cap. 10, y por eso
esta ficha vive aquí: **es la consecuencia que justifica todo el capítulo anterior.**

### A-71 · Alabeo por contracción diferencial a través del espesor (Ecs. 10.17 y 10.18)
- **CUÁNDO:** después de A-62, con el gradiente núcleo↔cavidad ya medido.
- **ENTRADAS:** `ΔT` a través del espesor ←A-62 · contracción de cada cara a su temperatura ←cap. 10
  (cadena PvT) · espesor `h` de la pieza · semiancho `W` (centro→borde).
- **EL CÁLCULO:**
  `R_warpage = 2·h / (s_core − s_cavity)` (Ec. 10.17)
  `delta = W · sin(W / R_warpage)` (Ec. 10.18)
  Ejemplo del bezel, con la cavidad **2 °C más fría** que el núcleo: `s_cavity = 0.31 %`,
  `s_core = 0.34 %` ⇒ **delta = 1.6 mm** sobre 240 mm de ancho.
- **SALIDA:** radio de curvatura [mm] y flecha fuera de plano `delta` [mm].
- **DECIDE:** si el circuito de agua se acepta. **Éste es el veredicto que el cap. 9 no puede emitir
  solo.**
- **CRITERIO:** **[COMPARA]** contra la contracción total: *"this warpage of 1.6 mm is somewhat greater
  than the absolute edge to edge shrinkage, which is 0.8 mm."* Es decir: **2 °C de desbalance producen
  más deformación que toda la contracción de la pieza.** Y el remate que hace inútil el arreglo de
  piso: *"this warpage estimate is not sensitive to the overall temperature of the molding, but only
  to the temperature gradient through the thickness."* Subir o bajar la temperatura del molde no lo
  arregla; solo emparejarlo.
- **INVALIDA:** cualquier cambio del campo térmico (A-62) o de la contracción del material.
- **¿TENEMOS?** **SÍ, y con una errata del libro documentada.** `warpage.ts::alabeoPorEspesor`
  implementa las Ecs. 10.17–10.18 y devuelve `{ radiusMm, deltaMm, contraccionTotalMm,
  superaContraccion }` — o sea **también hace la comparación del criterio**. El encabezado documenta
  la errata: en el ejemplo del libro `R = 2·1.5/(0.34% − 0.31%) = 9050 mm` pero la línea siguiente
  evalúa `delta = 120·sin(120/1050)`; el resultado publicado (1.6 mm) es el consistente con
  **R = 9050 mm** evaluando el seno en radianes. `laminas-visuales.ts` cierra el enlace visual:
  *"Δs por espesor ⇒ alabeo (Ec. 10.17): 2 °C ya dan 1.6 mm"*.

---

## Lo que NO tiene ficha (y por qué)

Descartado a propósito. Todo esto es **lección, descripción de mecanismo o dato de catálogo**: no
produce número ni veredicto que alimente una decisión.

| Qué | § | Por qué no es análisis |
|---|---|---|
| Anatomía y función de cada tipo de compuerta (cómo entra el fundido, qué se ve en la sección) | §7.2.1–7.2.9 | Descripción. El análisis es la **selección** (A-02) y las cotas (A-05, A-14) |
| El truco físico del flash gate (sección gruesa que presuriza y fuerza a la delgada) | §7.2.6 | Explica **por qué** funciona; el análisis es A-16 (las condiciones) |
| Mecánica del thermal gate: torpedo con *"three or four orifices"*, capa aislante, black specks, vetas de color | §7.2.8 | Pros/contras cualitativos que **entran a A-02** como atributos del tipo, no como cálculo propio |
| Que el valve gate cueste *"twice the cost of a hot runner system with thermal gates"* | §7.2.9 | Dato de costo que consume el cap. 3, no un análisis del cap. 7 |
| Los tres defectos por no ventear (short shot, dieseling/burn marks, soldadura débil con v-notches) | §8.1.1 | Motivación. Pero **la v-notch es estructural, no cosmética**, y eso califica el criterio de A-36 |
| Que la rebaba desgaste el plano de partición y obligue a *resurfacing* | §8.1.2 | Consecuencia que fundamenta el sesgo *"fewer and smaller vents are preferred"* (A-29/A-34) |
| Mantenimiento de venteos y el off-gassing acelerado por desmoldante | §8.1.3 | Sesgo de diseño hacia autolimpiables; nota puesta al pie de A-36 |
| Que cada línea de agua debilite el molde (concentrador + fatiga + corrosión que propaga grietas) | §9.1.5 | Fundamenta A-56 y el claro de ½·D de A-61; no calcula nada aparte |
| Enfriamiento conformal por SLS | §9.3.3 | El libro **no da criterio ni cotas**; se juzga por su campo térmico (A-62). Nota al pie de A-69 |
| Descripción de baffle / bubbler / heat pipe (cómo funciona cada uno) | §9.3.5.1–9.3.5.6 | Mecanismo. El análisis es la **selección** (A-63) y la carga (A-64) |
| Reparto de responsabilidad dimensional entre diseñador de pieza, proveedor, moldeador y diseñador de molde | §10 intro | Gobierno del proyecto. Define el entregable de estos capítulos (*"balanced melt filling and cooling"*) pero no es cálculo |

---

## NO OBSERVADO EN EL CORPUS — dónde este pliego se queda corto contra el libro

El corpus derivado es bueno en prosa, ecuaciones y ejemplos numéricos, y **ciego en imágenes y en
apéndices**. Lo que falta, en orden de cuánto duele:

1. **El Apéndice A completo.** Los `gammadot_max` por material, las **no-flow temperatures** y las
   propiedades térmicas se **citan** en los caps. 7 y 9 y **no vienen** en el corpus. Sin eso, A-06 y
   A-11 no tienen umbral propio: hay que traerlo del proveedor. El libro además avisa que sus valores
   son *"aproximados en el mejor de los casos"*, así que el hueco es menos grave de lo que parece —
   pero es un hueco.
2. **El Apéndice C completo.** Propiedades de refrigerantes (`rho`, `Cp`, `mu`, `k` por fluido).
   A-50 y A-52 las necesitan; hoy salen de constantes nuestras (`AGUA`, `GLYCOL`, `OIL`).
3. **Las variantes power-law completas de las Tablas 7.2 y 7.3.** El corpus da la forma newtoniana de
   cada una y menciona *"con variantes power-law"* sin transcribirlas. Tenemos una (tira) en código
   porque se reconstruyó; las demás filas de ambas tablas no están observadas.
4. **La ecuación de la corrección convectiva de §9.2.1 (A-41).** El corpus da `h_c ≈ 1000` y el
   resultado (19 s → 24 s) pero **no la expresión**. Lo suplimos resolviendo el problema completo por
   FDM, que es más caro y más correcto, pero no es lo que el libro escribió.
5. **El número de ecuación de `Q = m·Cp·(Tmelt − Teject)`.** El corpus da la fórmula y el ejemplo
   (20,900 J) sin numerarla. La rotulamos **Eq 9.10** porque así estaba ya en el código antes de este
   pliego — evidencia independiente, no cita.
6. **El umbral `L/D` que define "núcleo esbelto" (A-63).** El libro dice *"high length to diameter
   ratio"*; nuestro `L/⌀ > 3` es **INFERIDO**.
7. **La expresión de la curva de Menges (Eq 9.23).** El corpus da el hallazgo (variación < 5 % hasta
   `W = 2H`, y luego *"increases dramatically"*) y la forma de la figura, no la función. La nuestra
   (`heatFluxVariation`) es un ajuste propio a esa descripción.
8. **Todo el contenido gráfico.** Las ~55 figuras de estos tres capítulos (7.1–7.18, 8.1–8.10,
   9.1–9.27) existen solo por su *caption* literal y la glosa de `verificaciones-visuales.md`.
   Duele sobre todo en: Fig 9.4 (mapas de esfuerzo alrededor de la línea, de donde salen 3.3 y 2.6),
   Fig 9.5 (la curva de Menges), Fig 9.11 / 9.18 / 9.19 (los mapas de isotermas que son el juez del
   capítulo) y Fig 8.4 (la galería de dead pockets).
9. **Las cotas de la Tabla 9.1 más allá de dos filas.** VacTherm e IMSelect son ejemplos; el catálogo
   real del moldeador no está.
10. **Las referencias cruzadas a otros tomos** que estos capítulos invocan y no resuelven:
    §6.3.2, Fig 6.1 (sucker pins), §11.3.4 (stripper plate), cap. 12 y §12.3.3 (pared del núcleo,
    deflexión de placas), §13.6.4 (control dinámico de fundido), Fig 4.25. Se citan como navegación;
    su contenido está fuera de alcance de este tomo.

### Erratas del libro detectadas al verificar (importantes para implementar)

Ninguna es opinión: todas salen de reproducir los ejemplos numéricamente.

| # | Dónde | Qué dice | Qué cuadra |
|---|---|---|---|
| 1 | §9.2.1 | `T_eject = 96.7 °C` | Las ecuaciones del propio ejemplo usan **97.6 °C**; con 97.6 salen exactos 8.4 / 18.9 / 22.9 s |
| 2 | §9.2.1 | *"the diameter of the primary runner is 6.25 mm"* | El cálculo usa **4.76 mm** para dar 22.9 s (con 6.25 daría ~39.5 s) |
| 3 | §9.2.1 / Eq 9.9 | *"thermal diffusivity on the order of 9·10⁻⁵ m²/s"* | Mal por 3 órdenes: la ecuación usa **9·10⁻⁸ m²/s** (= 0.09 mm²/s), y el ABS de los ejemplos es 8.69·10⁻⁸ |
| 4 | §9.1 / §9.2.5 | `h_c` como *"1000 W/°C"* y *"1000 W/m°C"* | Para que `H < k/1000` dé 32 mm con `k = 32 W/m°C`, son **W/(m²·°C)** |
| 5 | §8.2.3 | `W = 10 mm` y `L = 10 mm` pero sustituye 0.1 m en ambos | Solo entra la razón `L/W`: **el 0.06 mm es correcto de todos modos** |
| 6 | Eq 8.3 | `h_max = 0.4 · L_flash` | El coeficiente exacto del ejemplo es **0.365** |
| 7 | Tabla 7.4 (tira) | Ejemplos impresos: fan 1.5 s, cup 24 s | **No reproducen con su propia fórmula** (dan 0.76 s y 12.1 s, factor 2). El ejemplo cilíndrico (1.1 s) sí reproduce ⇒ la fórmula es el canon |
| 8 | Ec. 10.18 | `R = 9050 mm` en 10.17 pero evalúa `sin(120/1050)` | El resultado publicado (**1.6 mm**) es el consistente con R = 9050 mm en radianes |

---

## INVENTARIO — qué tenemos y qué falta

**71 análisis extraídos.** Reparto por capítulo:

| Capítulo | Análisis | Rango |
|---|---|---|
| Cap. 7 — compuertas | **20** | A-01 … A-20 |
| Cap. 8 — venteo | **16** | A-21 … A-36 |
| Cap. 9 — enfriamiento | **34** | A-37 … A-70 |
| Cap. 10 §10.3.1 (frontera) | **1** | A-71 |

Que el cap. 9 pese la mitad del tomo no es sesgo de extracción: es el capítulo más cuantitativo del
libro y el único con una cadena de veintitantos eslabones donde cada número sale del anterior.

| Estado | Cuántos | Cuáles |
|---|---|---|
| **SÍ (implementado con ancla verificada)** | **38** | A-02, A-05, A-07, A-10, A-11, A-12, A-14, A-15, A-17, A-22, A-23, A-24, A-25, A-27, A-28, A-29, A-30, A-31, A-33, A-37, A-38, A-39, A-40, A-42, A-46, A-47, A-48, A-51, A-52, A-53, A-54, A-56, A-57, A-58, A-59, A-62, A-63, A-71 |
| **PARCIAL** | **20** | A-01, A-03, A-04, A-06, A-09, A-13, A-20, A-21, A-35, A-36, A-41, A-43, A-44, A-49, A-50, A-55, A-61, A-64, A-68, A-70 |
| **FALTA** | **13** | A-08, A-16, A-18, A-19, A-26, A-32, A-34, A-45, A-60, A-65, A-66, A-67, A-69 |

El patrón, en una frase: **las ecuaciones están casi todas y los objetos casi ninguno.**
Sabemos calcular `h_min`, `h_max`, `t_c`, `Re`, `D_min`, `H`, `W` y el campo térmico completo — y no
existe el objeto "venteo" con su land y su alivio, ni el objeto "circuito" con su arquitectura y sus
tapones, ni la decisión de material **por lado**. Todo lo que falta es *forma*, no *física*.

Y hay un segundo patrón, más incómodo: **los sesgos que faltan empujan todos en la misma dirección
optimista.** El `t_c` que alimenta la cadena es el isotérmico (A-41: tenemos el convectivo y no lo
usamos); dos líneas en serie no duplican el caudal requerido (A-50); las dos letras chicas de §9.2.1
no salen en ningún reporte (A-39). Cada una por separado es menor; juntas hacen que el ciclo se vea
más corto de lo que va a ser.

### Los 8 huecos que más duelen

1. **A-67 · No existe el circuito, solo las líneas.** Es el hueco más grande del cap. 9. Sin
   arquitectura (serie / paralelo con manifold en máquina / manifold interno / perimetral) no hay
   tapones, no hay conteo real de conexiones, y el **veto del perimetral con molde de 2 placas** no se
   puede ni plantear. Y A-68 (usabilidad) audita un número que no sabemos calcular bien.
2. **A-65 · El material del inserto no es una decisión por lado.** El motor elige un material para el
   molde. El libro exige asimetría (cavidad drena ~2× el calor que el núcleo) y avisa que
   **hacer ambos de Cu 940 es peor que solo el núcleo**. Hoy podemos producir exactamente el diseño
   que el libro señala como error, con el catálogo que ya tenemos.
3. **A-26 · `t_flash` está hardcodeado en 0.003 s.** `venting.ts::ventMaxThickness` recibe el tiempo
   de solidificación como default fijo, cuando `gating.ts::gateFreezeStripS` sabe calcularlo, está en
   el mismo directorio y el libro dice explícitamente que se use. Cambia el material y `h_max` no se
   entera. **Dato bien calculado que no llega** — el mismo patrón que ya cazamos en el cap. 3.
4. **A-32 · El venteo no tiene geometría.** `PlanVenteo` guarda puntos; el libro pide land + canal de
   alivio + salida, y en el expulsor exige **los dos** elementos (canal a 3 mm + taper de guía) con la
   frase *"Both of these elements should be present in a good vent design"*. Sin geometría, el
   contrato `vent-vs-agua` (A-35) mide sobre un objeto que no existe.
5. **A-60 · Falta la alarma del conductivo a paso ancho.** `moldbase.ts` puede recomendar Cu 940
   porque *"El ciclo manda"* y dejar el paso flojo — la combinación exacta que el libro dedica un
   párrafo a prohibir, porque el conductivo **aumenta** la variación de flujo de calor.
6. **A-08 · Falta la conversión del diafragma a tira.** Sin `W = pi·D_diafragma` la compuerta se
   dimensiona con el ancho equivocado por un factor grande. Es media línea de código.
7. **A-34 · Nadie decide la solución del dead pocket.** Tenemos las cuchillas dimensionadas
   (`ejectortypes.ts`, con su pandeo) y las bolsas localizadas (`venting-locations.ts`), y falta la
   frase que las une: la cuchilla gana casi siempre porque **ventea y expulsa**.
8. **A-61 · El claro de agua se exige a ½·D y se mide a 2 mm fijos.** El contrato `agua-claro` calcula
   bien el límite (`limite: D / 2`) pero consume una holgura medida por `coordAudit` con umbral fijo
   de 2 mm. El propio código lo dice: *"puede estar en verde mientras esto está en rojo"*. Un criterio
   bien citado evaluado con la métrica equivocada es peor que no tenerlo. Y con ⌀6.35 mm el ½⌀ son
   3.2 mm: el umbral flojo es **la mitad** de lo que el libro pide.

### Lo que tenemos y el libro no pide (extensiones honestas)

- `mold-thermal-fdm.ts` — transitorio 3D real con frontera de Robin, cuando el libro solo muestra
  resultados de FEM. El encabezado lo declara: *"Es la MISMA física que las Figs 9.7/9.11 del libro
  (ahí resuelta por FEM); aquí por diferencias finitas explícitas — PDE real, no una correlación."*
- `venting-locations.ts::enumerarVenteos` — el libro **mira** el patrón de llenado y marca a mano;
  nosotros detectamos los tres tipos sobre el campo 3D por máximos locales de **resistencia** (no de
  distancia, citando §5.5.5 sobre race tracking) y distinguimos bolsa muerta contando vecinos.
- `laminas-visuales.ts` L18 — el juez con ojos: isotermas a paso **fijo** de 2 °C, conteo de contornos
  y veredicto contra los 6 °C del libro. Replica literalmente el razonamiento de Kazmer, que juzga
  contando líneas.
- `expediente.ts` — el **plan de tryout** como documento de salida, con las líneas de compuerta
  (§7.3.5), venteo (§8.3.1) y venteos reservados (§8.1). El libro repite el patrón "especifica corto,
  prueba, crece" en tres subsistemas y nadie lo emite como entregable.
- Las **erratas documentadas en el código** (T_eject 97.6, la Tabla 7.4 de tira, el radio de la
  Ec. 10.18): cada una con el número que sí reproduce y el que no. Eso vale más que la cita.

---

# GRAFO

El volcado del orden en que Kazmer piensa en estos tres capítulos. `→` = alimenta ·
`⇒RETORNO` = el resultado obliga a rehacer algo que ya estaba hecho · `‖` = corren en paralelo.

## La forma general

```
[cap. 5 llenado] ──┬─→ FASE A compuertas ──→ FASE B venteo
[cap. 6 runners] ──┘         │                    │
                             └────────────────────┴──→ FASE C enfriamiento ──→ alabeo (cap. 10)
```

Las tres fases **no son secuenciales puras**: el venteo hereda el caudal de llenado (no de las
compuertas), y el enfriamiento le devuelve a las compuertas el `t_c` que decide si empacan (A-39 → A-12).

## Fase A — Compuertas

```
A-01 ruta de degatado ─┐
A-03 zona gateable    ─┼─→ A-02 TIPO (Tabla 7.1) ──→ A-05 semilla dimensional
[cap.6 tipo de runner]─┘         │                          │
[cap.5 flujo deseado] ─┘         │                          ▼
                                 │                   A-08 geometría equivalente
                                 │                          │
[cap.5 caudal] → A-04 caudal por compuerta ─────────────────┤
                                                            ▼
                                              A-06 CORTE  ──┬──→ A-07 despeje inverso
                                                            │         │
                                              A-09 viscosidad al corte│
                                                            ▼         │
                                              A-10 CAÍDA DE PRESIÓN   │
                                                            │         │
                                              A-11 congelamiento ◄────┘
                                                            ▼
                            [FASE C: A-39 t_c] ──→ A-12 FREEZE vs EMPAQUE
                                                            │
                                                   A-13 ¿sección delgada?
                                                            ▼
                                        A-17 steel-safe → A-20 cierre §7.4
  reglas por tipo, en paralelo:  A-14 túnel (45°/20°/3D) → A-15 sucker pins
                                 A-16 flujo lineal (fan/flash/diafragma)
  disparados por veredicto:      A-18 ¿balancear con gates?   A-19 remedios de contracción
```

**Paralelo:** A-01 ‖ A-03 (independientes) · A-14 ‖ A-16 (reglas por tipo, no se estorban) ·
los `n` gates del molde se analizan en paralelo salvo por A-18.

## Fase B — Venteo

```
[cap.5 caudal] → A-21 gasto de aire → A-22 REPARTO (NO dividir entre n)
[cap.5 patrón de llenado] → A-23 candidatos (3 tipos) → A-24 obligatorio/opcional/diferido
                                     │                          │
                                     │                          ├─(tipo 2 knit)→ [cap.11 pin expulsor]
                                     │                          └─(tipo 3 bolsa)→ A-34 inserto/cuchilla/sinterizado
                                     ▼
        A-22 ─→ A-25 h_min (Eq 8.2) ──┐
                                       ├──→ A-29 BANDA h_min ≤ h ≤ h_max ──→ A-32 anatomía
   A-26 t_flash ─→ A-27 P_melt ─→ A-28 h_max (Eq 8.3) ┘          │                  │
                                       A-30 Tabla 8.1 (3 handbooks) ┘               │
        (expulsores) A-31 h = 0.065 por holgura 0.13 ──────────────────────────────┤
                                                                                    ▼
                              [cap.12 deflexión] → A-33 flash sobre cara estética   │
                              [FASE C layout]    → A-35 vent vs línea de agua ──────┤
                                                                                    ▼
                                                                        A-36 cierre §8.4
```

**Paralelo:** A-25 ‖ la rama (A-26 → A-27 → A-28); convergen en A-29. Cada candidato de A-24 se
dimensiona de forma independiente.

## Fase C — Enfriamiento (la cadena larga)

```
[cap.2 espesores] → A-37 sección gobernante ─┐
[material]        → A-38 T_eject (HDT/DTUL) ─┤
                                              ▼
                                    A-39 t_c (Eqs 9.5/9.6) ──→ [FASE A: A-12]
                                       │   ‖ A-40 regla 2h²
                                       │   ‖ A-41 corrección convectiva (+25%)
                                       │   ‖ A-44 un solo lado (h→2h, ×4) → A-45 orden two-shot
                                       ▼
                            A-42 t_c del runner  ⇒RETORNO a cap.6
                                       ▼
                            A-43 t_c GOBERNANTE  ⇒RETORNO a arquitectura (¿2 moldes?)
                                       │
[cap.2 volumen] → A-46 masa del disparo (piezas + coladas)
                                       ▼
                            A-47 Q = m·Cp·ΔT  (Eq 9.10)
                                       ▼
                            A-48 Qdot = Q/t_c ; Qdot_line = Qdot/n_lines   ◄══════════╗
                                       ▼                                              ║
                            A-49 ΔT admisible (1 °C / 0.1 °C)                         ║
                                       ▼                                              ║
                            A-50 Vdot por línea (Eq 9.13)  ──→ A-51 controlador (T9.1) ║
                                       │                                              ║
                        ┌──────────────┴──────────────┐                               ║
                        ▼                             ▼                               ║
            A-52 D_max turbulencia         A-53 D_min por ΔP (½ presión, L en serie)   ║
                        └──────────────┬──────────────┘   ‖ A-55 laminar (Eq 9.18)     ║
                                       ▼                                              ║
                            A-54 D ESTÁNDAR (Tabla 9.2 DME)                            ║
                                       │                                              ║
                        ┌──────────────┴──────────────┐                               ║
                        ▼                             ▼                               ║
            A-56 profundidad estructural   A-57 profundidad térmica                    ║
                        └──────────────┬──────────────┘                               ║
                                       ▼                                              ║
                            A-58 VENTANA 2D < H < 5D (Eq 9.22)                         ║
                                       ▼                                              ║
                            A-59 PASO H < W < 2H (Eq 9.24) → n_lines ═══════════════════╝
                                       │                      EL LAZO INTERIOR (§9.2.2)
                                       ├── A-60 trampa del conductivo a paso ancho
                                       ▼
                            A-61 RUTEO · claro ≥ ½·D   ⇒RETORNO (A) base+placas / (B) alejar
                                       ▼
                            A-62 CAMPO TÉRMICO (isotermas a 2 °C, gradiente 6 °C)
                                       │
                        ┌──────────────┼──────────────┬──────────────┐
                        ▼              ▼              ▼              ▼
              A-63 Tabla 9.3    A-65 material   A-66 ROI del    A-67 arquitectura
              (núcleo esbelto)  asimétrico      conductivo      del circuito
                        ▼                                            ▼
              A-64 integridad del núcleo                   A-68 usabilidad (≤2 conexiones)
                                                           A-69 expulsores dentro del gasket
                                       ▼
                            A-70 cierre §9.4
                                       ▼
                            A-71 ALABEO (Ecs 10.17-10.18): 2 °C ⇒ 1.6 mm
```

## LOS RETORNOS (lo que hace que esto sea un grafo y no un wizard)

```
R1  ⇒ A-06/A-07 → A-02      LA DIMENSIÓN CAMBIA LA CLASE. Ensanchar el edge gate del bezel a 14 mm
                            para bajar el corte "would require a change in the gate type to a fan
                            gate". §7.3.2. TENEMOS: contrato `gate-escala-nivel` y la iteración de
                            `designGateProcess` escalan de tipo.

R2  ⇒ A-13 → arquitectura   EL CÁLCULO DE UNA COMPUERTA CONCLUYE "CAMBIA EL TIPO DE MOLDE".
      de molde (cap. 3-4)   "a three-plate mold or hot runner mold should be considered". §7.3.4.
                            Invalida compuerta Y runner dimensionados. PARCIAL: detectamos el nivel,
                            no ejecutamos el regreso.

R3  ⇒ A-12 → A-05/A-07      FREEZE PREMATURO CON TODO LO DEMÁS EN VERDE. "the dimensions should be
                            adjusted even if the shear rates and pressure drops were found
                            acceptable". §7.1.5/§7.3.5. TENEMOS el veredicto; FALTA el menú de
                            remedios (A-19).

R4  ⇒ A-18 → cap. 6         NO BALANCEES CON COMPUERTAS. El balanceo por gate es "extremely limited";
      (diámetros de runner) va a runners o a control dinámico (§13.6.4). §7.3.5. Coincide por
                            accidente: `feed-layouts.ts` balancea con radios y nunca ofrece gates.

R5  ⇒ A-29 → A-24           BANDA CERRADA. Si h_min > h_max: "more and wider vents could be used to
                            reduce the required air flow, after which the vent thickness could be
                            reduced". §8.2.3. PARCIAL: reportamos `feasible:false`, no ejecutamos.

R6  ⇒ tryout → A-24/A-29    STEEL-SAFE DEL VENTEO. Los reservados se abren y los espesores crecen
                            si aparece quemado. §8.3.1/§8.4. TENEMOS: `expediente.ts` emite las dos
                            líneas del plan de tryout.

R7  ⇒ A-33 → cap. 12        FLASH POR FLEXIÓN DE PLACAS. No es problema del venteo: rediseño
      / stripper plate      estructural, o venteo interno en placa desmoldeadora (§11.3.4). §8.3.1.
                            TENEMOS el cruce (`estr-deflexion-vs-venteo`); falta la ruta de salida.

R8  ⇒ A-61 → A-35           EL AGUA MUEVE AL VENTEO. "it may be desirable to avoid a large vent
                            channel near cooling lines" — el venteo cede el paso. §8.3.2.
                            Contrato `vent-vs-agua`, sin geometría que medir.

R9  ⇒ A-42 → cap. 6         EL RUNNER DOMINA EL CICLO (22.9 s > 18.9 s). "it is important to minimize
      (diámetros de runner) the runner diameters not just for material savings but also to maintain a
                            productive molding process". §9.2.1. Invalida t_c, potencia, caudal y
                            costo. TENEMOS la señal (`feed.ts:135`), no la acción.

R10 ⇒ A-43 → arquitectura   MOLDE FAMILIAR CON ESPESORES DISTINTOS. Dos moldes serían más económicos
                            "However, such a mold design strategy gives up color matching and
                            at-press assembly". §9.2.1. Juicio de negocio sobre número físico. FALTA.

R11 ⇒ A-59 → A-48           ★ EL LAZO INTERIOR, DECLARADO POR EL AUTOR. El paso fija n_lines, que
                            regresa a repartir la potencia: "multiple design iterations may be
                            necessary ... with varying number of cooling lines". §9.2.2 ↔ §9.2.6.
                            TENEMOS: `coolingDesign` deriva n_lines del paso y recalcula Qdot_line
                            y el caudal. Es el único lazo del tomo que está realmente cerrado.

R12 ⇒ A-61 → (A) cap. 4     LAYOUT INFACTIBLE (Fig 9.9). Dos rescates con costo declarado:
             (B) A-58/A-59  (A) agrandar insertos y mold base — "redesign of the mold, procurement of
                            a larger mold base, and more machining", invalida base y placas;
                            (B) alejar las líneas manteniendo el ratio paso:profundidad — "poor
                            cooling performance, it is quite common", se maquina en un solo setup
                            sin sellos. §9.2.7. FALTA la elección; solo detectamos la colisión.

R13 ⇒ A-62 → A-63/A-65      GRADIENTE DE 6 °C EN NÚCLEO PROFUNDO → los tres remedios: "using a highly
                            conductive core insert, implementing a baffle or bubbler, or designing a
                            cooling insert". §9.2.7→§9.3. TENEMOS el gradiente y la Tabla 9.3;
                            FALTA el disparo automático y el material asimétrico.

R14 ⇒ A-51 → A-49/A-67      EL CONTROLADOR NO ALCANZA. "multiple mold temperature controllers would
                            be needed if the allowable temperature increase were set to 0.1 °C, or if
                            the number of cavities was increased from 2 to 8". §9.2.3. TENEMOS el
                            check, no la consecuencia sobre el circuito.

R15 ⇒ A-64 → A-63           EL DISPOSITIVO DEBILITA EL NÚCLEO. "may favor cooling at too great an
                            expense of core strength ... move the cooling channels further from the
                            cavity surface while reducing their width". §9.3.5.1. PARCIAL: acotamos
                            el barreno a ⅔·⌀, no verificamos contra la presión.

R16 ⇒ A-67 → cap. 6         EL PERIMETRAL DEPENDE DE LA ALIMENTACIÓN. Solo vale con 3 placas o canal
                            caliente; con 2 placas y runner frío el centro SÍ genera calor. §9.3.1.
                            FALTA por completo (no hay arquitectura de circuito).

R17 ⇒ A-69 → cap. 11        FUGA GARANTIZADA. "leakage should be expected at any ejector pins located
                            internal to the area surrounded by gasket" → placa desmoldeadora. §9.3.2.
                            FALTA.

R18 ⇒ A-71 → A-59/A-61      ★ EL RETORNO QUE CIERRA EL CAPÍTULO. 2 °C de desbalance dan 1.6 mm de
                            alabeo, más que los 0.8 mm de contracción total borde a borde. Y no se
                            arregla con temperatura global: "not sensitive to the overall temperature
                            of the molding, but only to the temperature gradient through the
                            thickness". §10.3.1. TENEMOS el cálculo y la comparación
                            (`warpage.ts::alabeoPorEspesor` devuelve `superaContraccion`);
                            FALTA que ese veredicto reabra el layout de agua.

R19 ⇒ A-53 → A-54/A-67      D_min POR ENCIMA DEL DESEADO. Subir al plug estándar siguiente, o partir
                            el circuito para reducir la longitud en serie. §9.2.4. PARCIAL.

R20 ⇒ A-45 → proceso        INVERTIR EL ORDEN DE LOS DISPAROS. 75.6 s → 13.5 s moldeando la capa
                            delgada al final. §9.3.6. FALTA.
```

## Lo que se puede correr en paralelo (para quien lo implemente)

- **Fase A:** A-01 ‖ A-03 (arranque) · A-14 ‖ A-16 (reglas por tipo) · las `n` compuertas del molde
  son independientes entre sí salvo por A-18.
- **Fase B:** A-25 ‖ (A-26 → A-27 → A-28) convergen en A-29 · cada uno de los ~36 candidatos de A-23
  se clasifica y dimensiona por separado: es **vergonzosamente paralelo**.
- **Fase C:** A-40 ‖ A-41 ‖ A-44 cuelgan de A-39 sin tocarse · A-52 ‖ A-53 convergen en A-54 ·
  A-56 ‖ A-57 convergen en A-58 · el bloque C.5 (A-67, A-68, A-69) corre en paralelo a A-63/A-65 una
  vez que A-61 entregó el ruteo.
- **Entre fases:** A-21 (aire) puede correr en cuanto hay caudal de llenado, sin esperar a que las
  compuertas cierren. Solo A-12 y A-35 obligan a sincronizar.

## Los tres lugares donde el grafo se muerde la cola

1. **A-48 ↔ A-59** (potencia ↔ número de líneas). El único lazo que el propio Kazmer declara, y el
   único que tenemos cerrado en código.
2. **A-12 ↔ A-39** (empaque de la compuerta ↔ enfriamiento de la pieza). Un análisis del cap. 7 que
   no se puede resolver sin un número del cap. 9. Por eso los capítulos no son subsistemas
   independientes por más que sus checklists de cierre (§7.4, §8.4, §9.4) lo sugieran.
3. **A-71 → A-59/A-61 → A-62 → A-71** (alabeo ↔ layout de agua). El lazo exterior: el paso y el ruteo
   producen el campo térmico, el campo produce el alabeo, y el alabeo condena el paso. Hoy lo
   recorremos una vez, en un solo sentido.

## La forma del grafo, en una frase

El cap. 7 es **tres veredictos que discrepan a propósito** sobre un mismo objeto sembrado por regla
de dedo; el cap. 8 es **una banda de dos colas** donde el techo (rebaba) manda sobre el piso (aire) y
la lista de ubicaciones se deja deliberadamente abierta; y el cap. 9 es **una cadena de veintitantos
eslabones con un lazo interior declarado**, que termina fuera de su propio capítulo: el número que
juzga el circuito de agua es 1.6 mm de alabeo, y está en el cap. 10.
