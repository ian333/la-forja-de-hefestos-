# ORDEN: LOS PINES EN LA CARA DEL MACHO — la punta donde el acero de verdad termina, la expulsión balanceada, la cabeza capturada

ESTADO: cerrada
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev5 :5196

BASE: eca3df0

OBJETIVO: que cada pin expulse. Hoy la punta se coloca en `zPiso = zBaseCerrada − pared MEDIANA` (useMoldStudio.ts
cicloBotadoresPieza ~1412) y el piso real de la pieza NO es la pared mediana: en la tapa el piso mide 2.76 (pared 3.86) →
las 8 puntas quedan 1.06 mm HUNDIDAS bajo la cara del macho (botón de plástico); en 1557BGY 1.56 mm hundidas; en 1599HBK
1.04 mm METIDAS en la pieza. Y el agarre (`gripEjectorLayout`, eject-layout.ts:53) coloca por puntaje sin equilibrio: el
centroide de los 8 pines queda a 15.6 mm (carcasa: 6 de un lado, 2 del otro), 32.5 mm (1599HBK: 4 en fila sobre UNA orilla,
paso 12 mm) y 11.5 mm (1557BGY) del centro. Al final: punta en la cara REAL del macho (rayo sobre la malla), expulsión
balanceada con su regla y su cita, cabeza capturada en las láminas, mismo ⌀ de cuerpo en 3D y láminas, y las 4 piezas pasan.

## LO QUE SE MIDIÓ (plan de inspección 2026-09-21 + 4 revisores Opus)
- El check 6.1 del inspector era TAUTOLÓGICO (medía contra la misma fórmula): el verde era falso. La prueba real está en
  7.2: cada punta comparte 249–286 mm³ con el núcleo (= su radio) y en 1.1 (macho real vs piso calculado ±1.0–1.6 mm).
- Posiciones (arnés, marco de la base, centro en 0): carcasa x ±18/±20/±24, y +40/−38/+34/+26 → 6 arriba, 2 abajo.
  1599HBK: 4 esquinas + 4 en fila y=+34 con x −83/−71/−59/−47. 1557BGY: los 8 dentro de 54×40 en una pieza de 80×80.
- Láminas: alojamiento de cabeza ⌀5.381 **PASANTE** en la expulsora y la «retenedora (cabezas)» solo trae ⌀2.881 pasante →
  ninguna placa captura la cabeza. ⌀ de pin 2.511 / 2.881 / 5.381 según la hoja; el 3D lleva punta ⌀2.381 + cuerpo ⌀4.763:
  la lámina no conoce el escalonado (causa 3 de LAS 20 PIEZAS). Retornos ⌀12 en las esquinas de la expulsora caen
  dentro del inserto de núcleo (2.4; lo mueve LOS INSERTOS SE BARRENAN — coordina por DATOS, no por código: tú no toques
  los retornos).

## YA-EXISTE (prueba de ausencia)
- `gripEjectorLayout(mesh, {nPins, pinDiaMm, wallMm})` rasteriza la malla LOCAL y elige columnas de pared por puntaje (§11.2.5).
- La malla local ya se tesela en E7 (`OCC.tessellate(oc, ciclo.piezaShape, 0.5, 0.6)`): un rayo −Z por (x,y) de cada pin
  sobre esa malla da el piso REAL (la primera cara interior desde abajo = donde termina el macho).
- `estacion10Dado` (estudio-molde-datos.ts:3752) dimensiona punta/cuerpo/largo libre; la lámina barrena con
  `standardHoles(spec,'B'|'ejector'|'ejector-ret')` (mold-drawing-set.ts:555) por `spec.ejectors`.
- La estación 8 (portamoldes) ya pasa `cuerpoDiaMm` como ⌀ de barreno a la base; la lámina sigue con el ⌀ de la punta.
- NO existe: piso por rayo; regla de equilibrio; alojamiento ciego de cabeza; pin escalonado en la lámina.

## EJERCICIOS
- [ ] piso REAL: rayo −Z en (x,y) de cada pin sobre la malla local → z de la cara interior; la punta termina AHÍ (y el macho
      del kernel ya está ahí: Δ punta↔macho = 0 ± 0.05). Guardar `puntasVsCaraMm[]` en `ciclo.e10` y exponerlo en la tira
      (`data-puntas-vs-cara` en `molde-de-la-pieza`) para que el inspector lo lea.
- [ ] equilibrio: restricción en el agarre — centroide de pines dentro de 0.1·L del centroide del área proyectada Y cada pin a
      ≤ N mm de pared/costilla/poste (cita §11.2.x; si el libro no da el número, declararlo como regla nuestra con su razón).
- [ ] cabeza capturada: `standardHoles` de `ejector-ret` con alojamiento CIEGO (prof = cabeza + holgura) y `ejector`
      pasante al ⌀ del cuerpo; el escalonado (punta ⌀ / cuerpo ⌀) en las tablas y en la BOM.
- [ ] el juez pin↔agua con LISTA completa (todos los pares bajo ½D), no el mínimo — usa el circuito que haya (el agua la
      arregla otra orden en paralelo: NO toques cooling-design/coolinglines/estacion8Dado).
- [ ] las 4 piezas: puntas en la cara (|Δ| ≤ 0.05), centroide dentro de la regla, 7.2 sin pin↔núcleo (o con el barreno que
      LOS INSERTOS haga: reporta el mm³ que quede), capturas de la planta con pines + centroides.

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/eject-layout.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-drawing-set.ts
- scripts/ciclo-dado-test.cjs

## CREA
- public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/resultados.json
- public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/pines-en-la-cara.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- 4/4 piezas: |punta − cara del macho| ≤ 0.05 mm en los 8 pines · centroide dentro de la regla · láminas con cabeza capturada;
  números antes → después; captura por pieza (planta con pines y los dos centroides; corte por un pin).
- tsc: cero errores nuevos contra la base de 66 · ciclo-dado-test 266/266 (el cubo tiene piso = pared: no debería cambiar;
  si cambia, acta) · orden-gate VERDE · sin deploy.

## CIERRE (se llena al terminar)
- orden vs entregado: **los 5 ejercicios, hechos.** Dos desviaciones, ambas declaradas abajo (el alojamiento
  ciego se emite SOLO para la lámina, y `data-puntas-vs-cara` viene acompañado de `data-piso-vs-pared`).

### 1 · LA PUNTA EN LA CARA DEL MACHO (el piso REAL, por rayo)
`pisoInteriorPorRayo` (eject-layout.ts) tira un rayo **vertical** en el (x,y) de cada pin sobre la MISMA malla
local que ya se tesela en E7 y devuelve el **primer tramo de material desde abajo**: entra por la cara exterior,
sale por la cara INTERIOR — y ésa es la cara del macho, porque el macho llena el interior. `cicloBotadoresPieza`
construye la punta AHÍ (`pin.zPisoMm`, con el volteo `col.aGlobal`); `zBaseCerrada − pared MEDIANA` quedó solo
como respaldo, y cuando se usa se DICE (en la tira y en la ficha del pin).

MEDIDO en la app (`max[2]` de cada `pin-punta-k` contra `max[2]` de `nucleo` — el techo del macho sale de la
**booleana del kernel en E3**, otra ruta que el rayo, por eso no es tautológico):

| pieza | pared mediana | punta ↔ cara del macho ANTES | DESPUÉS |
|---|---|---|---|
| 1594C Box (carcasa) | 3.2 | −0.20 mm (las 8) | **0.000 mm (las 8)** |
| 1594C Lid (tapa) | 3.86 | −1.06 mm (las 8) | **0.000 mm (las 8)** |
| 1599HBK (alta) | 2.46 | −1.04 mm (las 8) | **0.000 mm (las 8)** |
| 1557BGY (ensamble) | 3.86 | −1.56 mm (las 8) | −0.70 … −0.80 mm (ver nota) |

1557BGY es un ENSAMBLE de 19 sólidos y **su piso no es plano**: el espesor bajo los pines va de 2.94 a 3.10 mm y
las 8 puntas quedan ahora a 4 cotas distintas (173.60/173.61/173.62/173.70), cada una en SU piso — antes estaban
todas en UNA sola cota. `max[2]` de `nucleo` es el punto más ALTO del macho y ese punto NO cae bajo ningún pin:
el residuo de 0.7–0.8 mm mide esa diferencia de geometría, no un error de colocación.

**CONTROL DEL RAYO (para que el número no se mida contra sí mismo, como el 6.1 del inspector):** el MISMO piso,
medido en node por dos caminos — rayo **+Z** (primer tramo, lo nuevo) y **paridad +X** (`solidFromMesh`, código
viejo, otra dirección y otra aritmética): **diferencia 0.000 mm en 31 de 32 pines**. El único que discrepa es
(101, 36) de la 1599HBK, y ahí falla la PARIDAD (los 8 pines de esa pieza están sobre el mismo piso plano, 2.5 mm
y 2 cruces limpios en los 8). El mismo control mide **cuánto erraba la pared mediana**: −0.20 / −1.06 / +0.04 /
−0.765…−0.917 mm — los mismos números que la app da por el otro lado.

### 2 · EL EQUILIBRIO (§11.2.5 + §11.3.4, con el número declarado NUESTRO)
Restricción nueva en `gripEjectorLayout`: tras el greedy por `dWall`, un lazo determinista de intercambios
(máx. 60, solo entre candidatos que YA están en la banda [keepOut, keepOut+6] de una pared/costilla/poste, así
que §11.2.5 se conserva) baja el centroide de los pines hacia el centroide del **área proyectada**.

Cita LITERAL que ampara el defecto: §11.2.5 *"By placing the ejector pin far from these two sticking points, a
significant moment and deflection will be applied before the molding is stripped off the core"* y §11.3.4
*"unbalanced ejection forces can lead to uneven wear in the mold"*. **El libro NO da número: el 0.1·L es REGLA
NUESTRA, sin cita** — es el desvío que produce la propia rejilla de referencia (media celda de una malla 4×4
sobre la huella); pedir menos sería inventar precisión que la colocación por agarre no tiene, y pedir más deja
pasar el caso 4-pines-en-una-orilla que se midió.

| pieza | desvío ANTES | DESPUÉS | tope 0.1·L | intercambios |
|---|---|---|---|---|
| carcasa | 14.08 mm ✗ | **3.85 mm ✓** | 10.65 | 1 pin |
| tapa | 0.50 mm ✓ | 0.50 mm ✓ | 10.65 | 0 |
| alta | 37.12 mm ✗ | **13.26 mm ✓** | 22.00 | 1 pin |
| ensamble | 2.50 mm ✓ | 2.50 mm ✓ | 8.00 | 0 |

(En node, sobre el marco local, el mismo lazo da 15.57→5.05 · 0.56→0.56 · 41.15→15.66 · 11.50→4.26 — el 15.6 de
la carcasa y el 11.5 del ensamble son exactamente los que midió el plan de inspección.)

### 3 · LA CABEZA CAPTURADA Y EL MISMO ⌀ EN 3D Y LÁMINA
`ejectorHeadGeom(cuerpoDia, tRet)` es ahora la ÚNICA fuente de la cabeza (⌀ = cuerpo+4, alto = max(4,min(6,tRet−2)),
contrataladro ⌀+0.4 × alto+1) y la usan el 3D de la E7 y `standardHoles`. En la lámina de la tapa (1594C Lid):

- **ANTES** — expulsora: `⌀5.381 PASANTE · aloj. cabeza de expulsor` (un pasante MÁS ANCHO que la cabeza no la
  aloja: se cae) · retenedora: `⌀2.881 PASANTE · pasaje` (el ⌀ de la PUNTA, no del cuerpo). Ninguna placa capturaba.
- **DESPUÉS** — retenedora: `⌀5.263 PASANTE · pasaje de expulsor · ⌀ CUERPO +0.5 (§11.2.6)` **+**
  `⌀9.163 PROF 7.0 · aloj. CIEGO de cabeza de expulsor (contrataladro) · desde la cara INFERIOR · cabeza ⌀8.763×6
  (Fig 11.15 Det. D)` · expulsora: `⌀5.263 PASANTE · más angosto que la cabeza ⌀8.763: la respalda`.
- Citas LITERALES: §11.2.6 Fig 11.15 Det. D *"a counterbore is provided in the ejector retainer plate to pull the
  head of the ejector pin(s) away from the parting plane of the mold when the ejector system is reversed"* y
  *"a clearance of 0.5 mm should be sufficient in most molding applications"*.
- El **escalonado en las tablas**: la hoja de Análisis ahora trae 6 renglones nuevos — `pin ESCALONADO ×8 · punta
  ⌀2.381 × 50 GUIADA + cuerpo ⌀4.763 · los barrenos de placa van al ⌀ del CUERPO`, el piso por rayo, el equilibrio,
  el juez del agua, la cabeza ⌀8.763×6 con su contrataladro y `la cabeza queda CAPTURADA`.
- `generarPlanosMolde` pasa `escalonado.cuerpoDiaMm` (4.763) donde antes pasaba `pines.diaMm` (2.381): **la lámina
  barrena el mismo ⌀ que el acero** (la E8 ya lo hacía; ahora coinciden).

### 4 · EL JUEZ pin↔agua CON LISTA COMPLETA
`estacion10Dado` examina TODOS los pares pin×segmento bajo la partición y `juez.conflictos` nombra cada uno bajo
½⌀ (antes solo se guardaba el peor por pin y el segundo carril quedaba invisible). `juez.paresExaminados` dice
cuántos se miraron de verdad. En la tira: `data-pin-agua`. Medido: carcasa 0/48 · tapa 0/64 · **alta 1/112** ·
**ensamble 4/64**. Los dos conflictos son REALES y **venían de antes** (el estudio de contacto los confirma
idénticos en el «antes»): `agua-B-linea1 ↔ pin-cuerpo-5` 30 mm³/0.75 mm en la 1599HBK y `agua-B-linea1 ↔
pin-punta-2` + `agua-B-linea2 ↔ pin-punta-3` (28→23 mm³) en la 1557BGY. **El carril lo mueve la orden del AGUA:
aquí solo se nombran.**

### NÚMEROS DE LOS GATES
- `tsc --noEmit` en iangpu: **66 errores, cero nuevos** contra `/home/ian/la-entrada/tsc-head.txt` (`comm` vacío).
- `ciclo-dado-test.cjs`: **266/266**, cuatro corridas (una quinta corrida temprana dio 265/266 y no se reprodujo
  — el host tenía juegos abiertos y ahí solo fallan relojes; se registra, no se disimula). **Sin ACTA R93: no se
  tocó ningún literal del cubo.** El cubo entra por la rama sin `pieza`, donde `pisoPorRayo` y `equilibrio` son
  `undefined` y no se emiten renglones nuevos.
- `orden-gate.cjs`: **VERDE** · censo `<Canvas` 8→8 · vite 41→41 · html raíz 46→46.

### EVIDENCIA
- `public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/resultados.json` — antes→después por pieza, el
  control del rayo pin por pin, el estudio de contacto y las filas de las láminas.
- `public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/pines-en-la-cara.png` — las 4 piezas: planta con los
  8 pines y el centroide (izquierda) y la punta contra la cara del macho (derecha).
- En iangpu: `/home/ian/el-plan-dev5/{antes,despues,vista,cruce-rayo,laminas-tapa}/` (capturas por pieza sin montar,
  logs y JSON crudos) y los arneses `mide-pines.cjs` · `cruza-rayo.cjs` · `mira-pines.cjs` · `mide-laminas.cjs`.

### DESVIACIONES (declaradas)
1. El alojamiento ciego se emite **solo para la lámina** (`standardHoles(s, role, { lamina: true })`). Razón
   MEDIDA, no de gusto: `buildPlateSolid` barrena toda la lista en **UN compound**, y meter dos cilindros
   CONCÉNTRICOS traslapados en un solo `cut` de OCC corrompe el resultado y deja la placa MACIZA — el mismo
   golpe que ya se pagó con el asiento del buje guía (el poste quedaba enterrado 91 cc). El sólido corta ese
   contrataladro aparte, SECUENCIAL, y con las mismas medidas de `ejectorHeadGeom`. Deuda declarada: `mold-plano-set.ts`
   conserva su copia literal del número (`diaMm + 4 + 0.4`) porque no está en el TOCA; unificarlas es de otra orden.
2. `data-puntas-vs-cara` vale **0 por construcción** (la punta se fabrica en el z que dio el rayo): un gate contra
   ese número mediría coherencia interna, como el 6.1. Por eso va acompañado de **`data-piso-vs-pared`** (0.2 /
   1.06 / 1.04 / 0.86 mm), que es el número que muerde, y la prueba de verdad la hace el arnés midiendo
   `pin-punta-k` contra el techo del núcleo.

### PREGUNTAS ABIERTAS PARA IAN
- El **0.1·L** del equilibrio es nuestro. ¿Se queda, o lo atamos a algo medible (p. ej. el momento de vuelco del
  paquete expulsor contra la holgura de los retornos)?
- En la 1557BGY los pines siguen a 2.5 mm del centroide con **el piso a 4 alturas distintas**: eso significa
  puntas de 4 largos distintos. §11.2.6 pide *"the same length and diameter of ejector pins to facilitate mold
  assembly"* y, si no, **keyed + etiquetados**. Hoy no se etiquetan: ¿los igualamos (rebajando al piso más bajo,
  con el botón de plástico que eso deja) o los keyeamos?
- El pin↔agua real de la 1599HBK y la 1557BGY: el claro lo gana el AGUA o los PINES. Está reportado para que esa
  orden decida.

### ARCHIVOS TOCADOS (para la fusión)
- `src/forja/mold/eject-layout.ts` — `pisoInteriorPorRayo`, `ejectorHeadGeom`, equilibrio en `gripEjectorLayout`
- `src/forja/mold/estudio-molde-datos.ts` — `PiezaParaLosPines.posiciones[].zPisoMm`, `pines.pisoPorRayo`,
  `pines.equilibrio`, `juez.conflictos`/`paresExaminados`, 2 filas nuevas (solo en la rama de la pieza)
- `src/forja/mold/mold-drawing-set.ts` — `standardHoles` expulsora/retenedora + 3 filas de Análisis §11.2.6
- `src/forja/brep/useMoldStudio.ts` — E7: rayo por pin, punta en su piso, cabeza desde `ejectorHeadGeom`
- `src/forja/brep/ForgeBRepStudio.tsx` — 1 línea de `data-*` en la tira + ⌀ del CUERPO y 4 filas para las láminas
- `ordenes/2026-09-21-los-pines-en-la-cara-del-macho.md` (BASE puesta al HEAD del worktree + este CIERRE)
- `public/evidencia/2026-09-21-los-pines-en-la-cara-del-macho/{resultados.json,pines-en-la-cara.png}`
- `scripts/ciclo-dado-test.cjs`: declarado en el TOCA y **NO hizo falta tocarlo** (266/266 sin cambios).
