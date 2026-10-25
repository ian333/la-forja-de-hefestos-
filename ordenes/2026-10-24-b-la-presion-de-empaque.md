# ORDEN B: LA PRESIÓN DE EMPAQUE — 50 MPa editable alimenta clamp, placa, pilares y expulsión; los artefactos del dictamen mueren

ESTADO: hoy
PRIORIDAD: 1

BASE: eeeb24e (el worktree nació en origin/main cc86a8a, divergente; sin trabajo propio → `git reset --hard main`)

OBJETIVO: hoy el tonelaje usa solo la presión de LLENADO, sin piso (`clampFor`, `moldmachine.ts:172-179`): la hoja dice «2.3 % de
150 t» cuando a los 50 MPa que cita el propio contrato `llenado-tonelaje` (Kazmer §5.5.3, Eq 5.29) son ≈ 36 t = 24 %. Con ese mismo
número se dimensiona la placa de soporte (`moldmachine.ts:359`), y salen dos ✗ falsos del dictamen: ✗ FUERZA (`eject-fuerza` divide
F_eject entre ese clamp, `mold-contratos.ts:504-516`: 11.5 % → con piso 1.1 %) y ✗ DP (límite ½·ΔP de la misma fórmula,
`mold-contratos.ts:171`). Además ✗ WARPAGE usa la ventana de proceso entera como Δs (`mold-contratos.ts:1172-1174`), ⚠ POSITIVA usa
100 MPa fijos (`shrinkage.ts:87`) y `agua-ciclo` CUMPLE con cualquier ciclo > 0 (`mold-contratos.ts:482`).

**DECISIÓN (ian la delegó a los expertos, 2026-10-24):** DOS presiones con nombre (juez C, D2):
- **p_pack** (presión de empaque/sostenimiento en cavidad): ENTRADA del intake, **50 MPa por defecto, editable**. Alimenta clamp
  (max(0.5·ΔP_fill, p_pack)·A_proy, Eq 5.29), placa de soporte, pilares, `eject-fuerza` y la contracción (Tait). Si la E6 pide más
  (p. ej. 66 MPa), se PROPONE en pantalla; no se cambia sola.
- **p_fill** (presión de llenado): `pMaxMPa` del solver FAN de la E5 cuando exista (ya viaja en `e5fan`, `useMoldStudio.ts:~724`);
  si no, la de `clampFor` rotulada «estimada (longitud de flujo ≈ largo)». Juzga `feed-dp`, el techo de llenado y la máquina.

## LO QUE SE CAMBIA
1. `moldmachine.ts`: clamp con p_pack; la placa y los pilares con ese clamp. Cuentas de referencia del juez C para la 1594C Box: área
   7,029 mm² → 351 kN = 36 t = 24 % de 150 t; flecha de la placa actual a 50 MPa 0.120 mm (= 6 venteos de 0.02) → placa ≈ 74 mm o 2
   pilares. Reproduce TÚ esas cuentas antes de tocar y escríbelas en el CIERRE.
2. `mold-contratos.ts`: `eject-fuerza` y `feed-dp` con la presión que les toca; `agua-ciclo` deja de aprobar cualquier ciclo > 0 (compara
   contra algo medible —p. ej. que el ciclo declarado no sea menor que el t_c calculado— o pasa a SIN-CABLEAR; decide con cita);
   WARPAGE (Eq 10.19 pide la caída de UN disparo, no la ventana) y POSITIVA (100 MPa fijos) pasan a SIN-CABLEAR hasta medirse de verdad,
   con su razón en el `detalle`.
3. `shrinkage.ts`/`revisar-modelo.ts`: donde hoy se usa 100 MPa o 66 MPa fijos para la contracción, que lean p_pack (declarado).
4. El intake (`useMoldStudio.ts` ~L612 y su campo en `MoldPanels.tsx` ~L590-610): campo «presión de empaque (MPa)» con 50 por defecto.

## YA-EXISTE
- `clampFor`, `llenado-tonelaje` (cita §5.5.3), `optimizeSupportPlate`, `e5fan.pMaxMPa`, el intake con pared/material/volumen.
- El test del cubo `scripts/ciclo-dado-test.cjs` (266 checks): esta orden CAMBIA literales del cubo a propósito (tonelaje, placa,
  expulsión) → van como **ACTA R94** en el CIERRE (check · valor viejo · valor nuevo · por qué).

## TOCA
- src/forja/mold/moldmachine.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/shrinkage.ts
- src/forja/mold/revisar-modelo.ts
- src/forja/mold/platesizing.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA
- Gate VERDE; tsc sin errores nuevos; el cubo con ACTA R94 (o 266/266 si no cambió ningún literal).
- Captura 4K de la hoja de análisis (lámina 08) de la 1594C Box: «36 t · 24 % de 150 t» (o tu número reproducido) y la placa/pilares nuevos.
- Captura 4K del dictamen (04): de 6 ✗ a ≤ 4, cada uno con su número; DP y FUERZA leídos con la presión que les toca.
- Par de control: con p_pack = 4.8 MPa (el valor viejo) el tonelaje vuelve a ~2.3 % (el cambio es el piso, no otra cosa).

## ENMIENDA 2026-10-24
- `src/forja/mold/estudio-molde-datos.ts` entra al TOCA, SOLO `piezaDesdeArbol`/`ArbolPiezaMeta` (2 líneas): la spec de la
  pieza soltada la arma `piezaDesdeArbol` en DOS lugares (el ciclo en `useMoldStudio` y el dictamen en `ForgeBRepStudio`). Sin
  que esa función lleve `packMPa`, el p_pack del intake llegaría al molde y NO al dictamen: dos verdades. Nadie más del reparto
  toca este archivo. Y la línea `costo` de la decisión «estructura» del acta E12 (`estacion12Dado`): decía «0 pilares (la
  placa aguanta sola)» TECLEADO; con el piso de empaque el cubo cierra a 8.2 t y su soporte pide 1 pilar — el acta mentiría.
- `src/forja/brep/ForgeBRepStudio.tsx` entra al TOCA, SOLO la línea de `specPieza` (~L3989, región distinta de A ~L4070 y de
  C ~L5220): pasa `packMPa: mold.intake.packMPa` a `piezaDesdeArbol`, igual que ya pasa material y pzas/año. Por la misma razón.

## CIERRE (2026-10-24 · MEDIDO, no contado)

**Orden vs entregado.** Las dos presiones con nombre existen (`presionesDelMolde`, moldmachine.ts): p_pack (intake, 50 MPa
por defecto, editable) cierra el molde con max(½·p_fill, p_pack)·A (Eq 5.29, §5.5.3) y de ese cierre salen placa de
soporte, pilares, `eject-fuerza`, la máquina y la tarifa de Eq 3.24; p_fill es la del FAN cuando la spec la trae
(`fillMPaFan`) o la estimada, ROTULADA, y juzga `feed-dp`, `llenado-techo` y la presión de inyección. `agua-ciclo`,
POSITIVA y WARPAGE (área cerrada) pasan a SIN-CABLEAR con su razón y su deuda; un nominal ≤ 0 a p_pack SÍ viola. El
nominal de contracción y la lámina de alabeo leen p_pack (antes 0.8·p_fill y 66 MPa tecleados). Campo «presión de
empaque (MPa)» en el intake (`intake-ppack`).

**Las cuentas del juez C, reproducidas (1594C Box, node, pared 3.2 = p50 de la lente PARED).**
- Área 106.5 × 66 = 7,029 mm² · p_fill estimada 8.6 MPa → ½ = 4.3 MPa → 30.2 kN = **3.1 t** (con el 10 % de §4.3.3: 3.4 t =
  **2.3 % de 150 t**). A 50 MPa: 351.5 kN = **35.8 t**; con el 10 % de margen de la máquina 39.4 t = **26.3 % de 150 t** (el
  24 % del juez no lleva el margen).
- Placa de 36 mm sin pilares cargada a 50 MPa: δ = 0.0104 × 35.8/3.1 = **0.120 mm = 6.0 venteos de 0.02**. Para el 70 % de
  Hefestos: 36·(0.120/0.014)^⅓ = 73.8 → **76 mm** de catálogo, o **27 mm + 2 pilares** (δ/27). El optimizador (§12.1.3, menos
  acero) elige **22 mm + 3 pilares** (δ 0.0082 = 41 %, 7.6 kg) — menú: 0p 76 mm 21.7 kg · 1p 46 · 2p 27 · 3p 22 · 4p 22.
- FUERZA: 3,890 N / 351.5 kN = **1.11 %** (antes 12.8 % de 3.1 t; con p_pack 4.8 da 11.5 %, el número del juez).

**Números antes → después (1594C Box).**
| qué | antes (eeeb24e) | después |
|---|---|---|
| cierre (Eq 5.29) · hoja | 3.1 t · «clamp 2.3 % de 150 t» | 35.8 t · «clamp 26.3 % de 150 t» (app, lámina Análisis) |
| placa de soporte | 22 mm + 1 pilar · δ 0.0057 (28.5 %) a 4.3 MPa | 22 mm + 3 pilares · δ 0.0082 (41 %) a 50 MPa |
| dictamen | 70/100 · **6 ✗** (DP, COLADA VS CICLO, CLARO, FUERZA, FREEZE, WARPAGE) | 71/100 · **4 ✗** (DP, COLADA VS CICLO, CLARO, FREEZE) |
| contracción nominal | 1.49 % a 6.9 MPa (×1.0151) | 0.58 % a 50 MPa (×1.0058) |
| $/pza (Eq 3.24) | $1.009 (máquina a 41.9 $/h, extrapolada a 3.1 t) | $0.903 (32.8 $/h a 35.8 t); precio del molde igual $18,924 |
- **DP sigue ✗ y es real**: el FAN de la E5 (réplica en node de `cicloEstacion5`, campo conjunto 70×111×141, 20,295 nodos,
  sin tiro corto) mide **p_fill = 18.9 MPa** (2.2× la estimada). Con ella el paquete redimensiona el bebedero (⌀11.94 → ⌀9.47)
  y la caída queda en 12.0 contra un límite de 9.45 MPa: es el conflicto §6.4.7 contra §6.2.2 (la colada que no manda el ciclo
  cuesta presión). Con la estimada el dictamen lo dice: «p_fill ESTIMADA… con ésa se re-juzga».
- **Los pilares caben**: 3 pilares (z 36→132) con 0 colisiones y 0 ajustes a presión contra cualquier cuerpo
  (`moldSolidCollisions`); el Foco: 0 fallas, 2 de panzazo, 78 barrenos, 945 pares; la carrera sigue cabiendo (46 para 41.3).
- **Par de control**: con p_pack ≤ ½·p_fill (4.3 o 0) el molde vuelve BIT-IGUAL al de antes (3.095 t, 2.3 %, 22 + 1 pilar,
  FUERZA 12.82 % ✗): el cambio es el piso, no otra cosa. Con p_pack 4.8: 2.5 %.
- Pruebas de módulo en dev5 (node): contratos, platesizing, machinesizing, structural, analysis, llenado, audit, assembly → todas pasan.

**En la app real (forja-dev5 :5196, GPU ANGLE D3D12 RTX 4070 Ti, capturas 3840×2160 juzgadas con Read).**
- Dictamen (paso 4): «◆ 4 NO CUMPLEN · contratos 71/100 · ✗4 ⚠10 ✓49 🔌5» — DP, COLADA VS CICLO, CLARO, FREEZE. FUERZA en verde con
  su número y su presión: «F_eject 3890 N = 1.11 % del cierre (36 t · cierre a 50.0 MPa = max(½·p_fill 4.3, p_pack 50.0 por
  defecto §5.5.3))». DP con su p_fill rotulada: «límite 4.3 MPa (50 % de p_fill 8.6 MPa, estimada (longitud de flujo ≈ largo)…
  con ésa se re-juzga)». WARPAGE/POSITIVA/CICLO como 🔌 con su razón.
- Hoja de análisis (lámina «Análisis»): «cold-2placas × 1 = dictamen ✓ · FCS HT-150SV (taller) · clamp 26.3 % de 150 t · shot 20 %
  · abierto 447 de 1010 mm ✓ · Dictamen 71/100 · 4 violan». Ensamble: «máquina FCS HT-150SV (taller) (36 t) · Placa de soporte
  22 mm + 3 pilares (deflexión < venteo, §12.1)». Placa de soporte: 22 mm.
- Molde: los 3 pilares en 3D (aislados y en rayos X), 0 choques; intake con el campo nuevo a la vista (valor 50).
- **Par de control EN LA APP** (4.8 tecleado en el intake): el dictamen regresa a «◆ 5 NO CUMPLEN · 68/100» con «✗ FUERZA · F_eject
  3890 N = 11.53 % del cierre (3 t · cierre a 4.8 MPa = max(½·p_fill 4.3, p_pack 4.8 declarada))» — el campo llega al dictamen; y el
  molde cierra a 4.8·7,029·1.1 = 3.78 t. La hoja de esa corrida NO sirve para el 2.3 %: al tocar el intake cayó en el defecto viejo
  de la pieza maciza (abajo) y eligió IM-250 («clamp 1.5 % de 250 t» = 3.78 t; en la FCS serían 2.5 %).

**Evidencia (rutas).** iangpu `/home/ian/el-plan-dev5/`: `app-p50b/` (dictamen 02*, hoja 04, ensamble 05, soporte 06,
`numeros.json`), `app-pilares/` (07 rayos X, 08 pilares, 09 hoja, `pilares.json` con colisiones y Foco), `app-intake/10-intake.png`,
`app-control48/` (par de control tecleado), `presion-antes-box.json` · `presion-g2-box-p{def,4.3}.json` (node antes/después/control),
`fan-box.json` (FAN 18.9 MPa y DP con ella), `cubo-final.log` (270/270), `app-desvio-base/` (el defecto viejo en main).
Arneses: `mide-presion.cjs`, `mide-fan.cjs`, `mira-presion.cjs`, `mira-pilares.cjs`, `mira-intake.cjs`, `mira-desvio.cjs`, `mira-control.cjs`.

**ACTA R95** (ciclo del dado, 267 → **270 checks, 270/270**; R94 ya lo usó EL AGUA NO CRUZA LOS RETORNOS el 2026-10-06):
| check | valor viejo | valor nuevo | por qué |
|---|---|---|---|
| E12 · LA ARQUITECTURA con los DOS números | `$0.423` caliente / `$1.162` frío | `$0.399` / `$0.965` | Eq 3.24 cobra la máquina por el cierre con p_pack (8.16 t, 37.7 $/h) y no por ½·p_fill (0.87 t, 47.7 $/h extrapolado) |
| T1 · el dictamen del engrane | 7 violaciones, score 64 | 6 violaciones, score 64 | sale ✗ FUERZA (108 % de un cierre de 0.52 t; con p_pack el engrane cierra a 51 t); score igual: entra FUERZA a ✓ y sale CICLO a 🔌 |
| B · cierre max(½·p_fill, p_pack) + CONTROL p_pack 0 | — | nuevo | 8.158 t a 50 MPa; con p_pack 0 vuelve bit-igual a 0.871 t |
| B · la estructura carga con ese cierre + CONTROL | — | nuevo | cubo 22 mm + 1 pilar (δ 0.0095, 47.5 %); con p_pack 0: 22 + 0, δ 0.0081 (el de antes) |
| B · las palomitas no suman + CONTROLES | — | nuevo | CICLO/POSITIVA/WARPAGE-placa 🔌 con deuda; WARPAGE-marco ✓; nominal a 120 MPa −0.53 % → POSITIVA ✗ |
Otros números del cubo que se movieron sin literal en el test: cierre 0.87 → 8.16 t (máquina 0.6 → 6 %), soporte 22 + 0 → 22 + 1
pilar, $/pza 0.436 → 0.391, contracción nominal 1.45 → 0.58 %. Ganadora, base (196×196) y precio del molde ($9,259) iguales.

**Visto, de otras órdenes (no lo toqué).**
- **Defecto VIEJO, ya en main**: tocar la región del intake antes de armar el molde (pasar por DISEÑO con el panel del ciclo a la
  vista, o foco/blur en un campo del intake) hace que la E2 corra con la pieza MACIZA (sin pared). En main (eeeb24e, mi copia con
  su `src`) la hoja sale «hot-runner × 1 = dictamen ✓ · IM-250 · clamp 0 % · shot 97 %» (firma exacta de pared 33.3 en node) y 0
  pines; con esta rama el mismo camino roto da otra respuesta equivocada (16 cavidades, IM-500 126 %). Sin tocar el intake (dos
  corridas, A2 y C) sale bien. Hipótesis: el campo «pared» del intake es `defaultValue` y se queda en 33.3 después de que la lente
  midió 3.2; un blur en él re-siembra el ciclo con la pieza maciza. «= dictamen ✓» además solo compara el número de cavidades,
  no la arquitectura. Es del intake / la puerta (orden C o una nueva).
- La hoja de análisis: el valor largo de la máquina se encima con la columna REF/§ (maquetación; orden A).
- Los pilares no tienen renglón en la BOM ni posición acotada en ninguna lámina (planos; orden A / semana 6 «catálogo»).
- La cámara al terminar la E8 queda pegada a la sujeción superior (solo se ve el anillo centrador).
- Dos bebederos: el del paquete numérico (⌀11.94, L 85.4) que juzga el dictamen y el de la E5 (⌀8.62, L 69.2) que se corta (orden H).
- `llenado-area-proyectada` dice «descuento ya aplicado ✓» pero el cierre usa L×W, no `projectedAreaMm2` (en la caja 7,021 vs
  7,029: 0.1 %; en piezas con ventanas sobreestima). Un cambio a la vez: no lo moví.
- La E6 del cubo (`estacion6Dado`) sigue arrancando de 0.8·p_fill (ahí PROPONE la perilla «subir p_pack a ~X»); el molde de la
  pieza soltada no tiene E6 de empaque. La lámina de alabeo sigue con ΔT = 2 °C fijo.

**Pendientes.** (1) p_fill del FAN en la app: la tubería existe (`spec.fillMPaFan`) pero hoy nadie re-juzga después de la E5 — el
dictamen corre en el paso 4, antes del molde; lo cablea la orden H (un veredicto) pasando `fillMPaFan: ciclo.e5fan.pMaxMPa`.
(2) El defecto viejo del intake (arriba): hasta arreglarlo, editar el intake antes del molde no es confiable — también el p_pack.
(3) Los 3 pilares no salen en la BOM ni acotados en lámina. (4) `agua-ciclo` vuelve a juzgarse cuando la sección más gruesa viaje
al paquete (orden del ciclo con forma, semana 2).

**Preguntas para ian.**
1. *El costo por pieza bajó al cobrar la máquina por su tamaño real.* Cuando el molde se cierra con la presión de empaque, la máquina
   que lo cierra es de 36 t y no de 3 t; la fórmula del libro (Eq 3.24) cobra la hora por ese tamaño, y a 3 t daba una hora MÁS
   cara que la de una máquina de 50 t (la fórmula no está hecha para máquinas tan chicas). Hoy la carcasa baja de $1.009 a $0.903
   por pieza y el molde cuesta lo mismo. ¿Dejamos que el costo use el mismo tonelaje que la placa? **Recomiendo sí**: un solo número.
2. *Tres pilares en lugar de una placa gruesa.* A 50 MPa la placa de soporte de 36 mm se doblaría 0.120 mm (seis veces la rendija de
   0.02 que deja salir rebaba). La máquina escoge la opción de menos acero (§12.1.3): 22 mm + 3 pilares, que se dobla 0.0082 mm =
   41 % de la rendija. La alternativa sin pilares es una placa de 76 mm (21.7 kg contra 7.6). ¿Se queda la regla de «menos acero»
   o el taller prefiere menos piezas (2 pilares y 27 mm, al 52 %)? **Recomiendo** la regla del libro, y que el menú se enseñe.
3. *El dictamen bajó de 6 a 4 rojos, y uno de esos 4 es de verdad.* El de la colada (DP) se queda: con la presión que mide el
   solver de llenado (18.9 MPa, 2.2× la estimada) el bebedero sigue costando 12.0 MPa contra 9.45 permitidos — es el pleito entre
   un bebedero delgado que no alarga el ciclo y uno grueso que no cuesta presión. ¿Lo dejamos en rojo hasta que un moldista elija?
   **Recomiendo sí**: es una decisión del humano (§1.2), no un error de cuenta.

**Archivos tocados (para la fusión).**
- `src/forja/mold/moldmachine.ts` — `MachineSpec.packMPa/fillMPaFan`, `P_PACK_DEFECTO_MPA`, `presionesDelMolde` (nuevo, antes de
  `clampFor`), `clampFor`, `DiseñoFisico` (campos nuevos), `physicalDesign` (presiones, Tait, máquina, soporte: comentarios), reporte.
- `src/forja/mold/mold-contratos.ts` — `feed-dp`, `agua-ciclo`, `eject-fuerza`, `estr-deflexion-vs-venteo` (detalle), `llenado-techo`,
  `llenado-tonelaje`, `contr-positiva`, `contr-rango` (detalle), `contr-warpage-topologia`.
- `src/forja/mold/shrinkage.ts` — `shrinkageRecommendation` (packMPa → nominal; devuelve pNominal/pHigh/pLow).
- `src/forja/mold/revisar-modelo.ts` — `laminasDeRevision` (venteo de referencia en la lámina de deflexión; p_pack en la de alabeo).
- `src/forja/brep/useMoldStudio.ts` — intake (~L612-640: `packMPa`) y el texto de la E11 del cubo (~L1944).
- `src/forja/brep/MoldPanels.tsx` — import y el campo `intake-ppack` (~L590-620).
- `src/forja/mold/estudio-molde-datos.ts` — `ArbolPiezaMeta.packMPa`, 1 línea de `piezaDesdeArbol`, `costo` de «estructura» en E12.
- `src/forja/brep/ForgeBRepStudio.tsx` — 1 línea (`specPieza`, ~L3989).
- `scripts/ciclo-dado-test.cjs` — bloque «B · La presión de empaque» (tras E2) y los dos literales de ACTA R95 (E12, T1).
- `ordenes/2026-10-24-b-la-presion-de-empaque.md` — BASE, ENMIENDA, CIERRE.
- `platesizing.ts` estaba en TOCA y NO se tocó: el dimensionador ya recibe la carga; solo cambió quién se la pasa.
- Riesgo de fusión declarado: los números dorados de la orden D cambian A PROPÓSITO (clamp 2.3 → 26.3 %, soporte 22+1 → 22+3,
  FUERZA 12.8 → 1.1 %, $/pza): ahí su gate debe salir ROJO y se re-graban con esta razón.
