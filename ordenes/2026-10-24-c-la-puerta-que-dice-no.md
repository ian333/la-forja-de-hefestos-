# ORDEN C: LA PUERTA QUE DICE NO — si no se puede moldear, se dice antes del molde y del precio

ESTADO: hoy
PRIORIDAD: 1

BASE: eeeb24e (la rama nació en origin/main cc86a8a con 3 commits de fogata que main no tiene; `merge --ff-only` falló y se alineó con `reset --hard main` — rama sin commits propios, árbol limpio)

OBJETIVO: hoy La Forja nunca dice NO. La tapa con snaps (`1594C Lid.stp`) sale «con-mecanismos» en el DFM y aun así arma un molde de
2 placas, viable, con precio (red team: $31,464); el revisor de contrasalidas `checkUndercut` (`ejectortypes.ts:75`) existe con CERO
llamadas; `stl.ts:88` fija `solidos: 1`; una pieza con grieta cotiza viable; la matrícula de la malla (`matriculaDeMalla`,
`src/forja/verificacion/matricula.ts:413`) existe y no corre al soltar; y el error de entrada vive en el `sim-panel` que el modo
camino pone en opacidad 0 (`piel-futuro.ts`). Esta orden pone UNA puerta en el paso 2 (al soltar), antes del kernel, que dice:
cerrada / grieta, cuántos cuerpos, unidades sospechosas, y si hay contrasalidas — y si no se puede, lo dice con su razón y lo que haría
falta, y BLOQUEA el molde (paso 6) y cualquier precio. Sin estaciones nuevas (ian congeló 60 días las correderas).

## LO QUE SE CONSTRUYE
1. **La matrícula al soltar** (medido por perf: 748 ms en Benchy 225k triángulos, 157 ms en el snap-fit): cierre (aristas abiertas,
   no-manifold), cuerpos, χ/género, devanado; en ≤ 3 s; el resultado en una tarjeta del paso 2 (verde/ámbar/rojo) con palabras de
   taller. `stl.ts` deja de fijar `solidos: 1`.
2. **Cuerpos**: STEP con N > 1 sólidos → «Tu archivo trae N sólidos: ¿cuál moldeo?» con la lista (volumen y caja de cada uno); el
   camino espera la elección. STL → «Con un STL reviso tu pieza; el molde pide el STEP».
3. **Unidades**: solo para STL (el STEP declara unidades; ver `PJ12106.step`): diagonal < 5 mm → «¿está en pulgadas?».
4. **Contrasalidas**: cablear `checkUndercut` (y lo que ya calcula `dfm-mesh.ts` para «con-mecanismos») sobre la dirección de apertura
   del paso 5; si hay regiones que no salen en línea recta, se PINTAN en la pieza y la tarjeta dice: «Tu pieza tiene N zonas que no
   salen del molde en línea recta (contrasalidas, Kazmer §2.3.7). Aquí no diseño correderas: te doy el dictamen de tu pieza y su
   enfriamiento; el molde y el precio, no». Los pasos 6–9 quedan bloqueados (el riel los muestra apagados con un candado).
5. **El error se ve**: el aviso de entrada (`rp-error` y el «no se pudo abrir…») sale en la tarjeta del paso 2, no en un panel oculto.

## YA-EXISTE
- `matricula.ts` (`matriculaDeMalla`), `scripts/verif-matricula-test.cjs` (su prueba), `checkUndercut`, `dfm-mesh.ts` («con-mecanismos»),
  el rótulo en `MoldPanels.tsx` ~L412, `abrirArchivo` en `ForgeBRepStudio.tsx` ~L5220 y el aviso `aviso-entrada-ok`.
- OJO con la filmadora y el runner: hoy hacen clic en `aviso-entrada-ok`; si cambias ese flujo, conserva ese testid para la pieza sana.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/stl.ts
- src/forja/verificacion/matricula.ts
- src/forja/mold/ejectortypes.ts
- src/forja/mold/dfm-mesh.ts
- src/forja/brep/piel-futuro.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/TransicionPaso.tsx

## CREA
- (nada; si de verdad necesitas un archivo, ENMIENDA la orden con la razón)

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA (los tres happy paths del plan)
- **LA PIEZA QUE SÍ** (`1594C Box.stp`): tarjeta verde ≤ 3 s y el camino sigue igual (captura 4K del paso 2).
- **LA PIEZA QUE NO** (`1594C Lid.stp`): tarjeta roja con las regiones pintadas, 0 moldes, 0 precio, pasos 6–9 con candado (captura 4K).
- **EL ENSAMBLE** (`1557BGY.stp` o un 1593K de `test-parts/`): «trae N sólidos, ¿cuál moldeo?» con la lista (captura 4K).
- Par de control de la matrícula: un STL sano pasa; el mismo con un triángulo borrado sale «abierta» (captura o número).
- Gate VERDE; tsc sin errores nuevos.

## CIERRE (2026-10-24 · MEDIDO, no contado)

ESTADO: hecha (falta fusión del coordinador). Medido en forja-dev6 (vite dev :5197 y build de PRODUCCIÓN en :4260), GPU real
(`ANGLE … D3D12 (NVIDIA GeForce RTX 4070 Ti)`), capturas 1536×864 @2.5 = 3840×2160 en `/home/ian/el-plan-dev6/`, juzgadas con Read.

### Orden vs entregado
1. **La matrícula al soltar** — `mallaDesdeArchivo` (stl.ts) mide en la MISMA malla que verá el Foco: matrícula (cerrada /
   aristas sueltas / 3+ caras / volteadas / volumen con signo → `mallaEnPalabras`, matricula.ts), cuerpos, unidades y
   contrasalidas, y arma `puerta` (`armarPuerta`, puro). Tarjeta del paso 2 (`puerta-pieza`, MoldPanels.tsx `TarjetaPuerta`)
   con semáforo pasa ✓ / aviso ◇ / no ◆ / pregunta ?, en palabras de taller y con `data-*` para el arnés. `stl.ts` ya no fija
   `solidos: 1`: en STL son los cuerpos de la matrícula. Malla volteada de un STL se VOLTEA y se dice. STEP con malla abierta:
   se le pregunta al kernel por el SÓLIDO (`BRepCheck_Analyzer`, solo entonces): válido → aviso «la grieta es de mi teselado,
   no de tu archivo» (red-team r2); inválido → no.
2. **Cuerpos** — STEP con N > 1: «TU ARCHIVO TRAE N SÓLIDOS: ¿CUÁL MOLDEO?» con la lista (volumen exacto + caja por aristas ≈,
   mayor primero, 8 + «y N más chicos»); el camino ESPERA (pasos 3–9 con candado). Tocar el que está en pantalla confirma sin
   volver a medir (`data-en-pantalla="1"`); tocar otro vuelve a cargar con `{ solido: i }` y el estudio se reconstruye con ESE
   sólido (`rebuild()` cuando el texto del STEP no cambió). STL → «CON UN STL REVISO TU PIEZA — el molde y el precio piden el
   STEP» (pasos 6–9 cerrados).
3. **Unidades** — solo STL, diagonal < 5 mm → «¿ESTÁ EN PULGADAS?» con dos botones (`puerta-pulgadas-si/no`); «sí» recarga
   ×25.4, «no» re-arma sin medir. El STEP: «el STEP declara sus unidades: 106.5 × 66.0 × 33.3 mm».
4. **Contrasalidas** — `dfmFromMesh` (§2.3.7) sobre +Z (la apertura del paso 5, la misma de `partingLoops`), contando las
   SIGNIFICATIVAS (`RUIDO_CONTRASALIDA` = el piso que ya decidía «con-mecanismos», ahora con nombre). `checkUndercut` cableado
   por región (`contrasalidaQueHariaFalta`, ejectortypes.ts) para decir qué haría falta (ε = δ/L contra 2 %, §11.3.5). Las
   regiones se PINTAN en la pieza (`ContrasalidasEnLaPieza`: las caras dentro de cada región + una caja con arista visible,
   latiendo). Texto literal de la orden en la tarjeta. Pasos 6–9 cerrados: riel apagado con candado SVG (`riel-paso-N`
   `data-cerrado`), botones de la tira y el riel enseñan la tarjeta en vez de abrir, `pasoActual` no cuenta un paso cerrado
   (sin cortina), y UNA cerradura (efecto) apaga molde/inspección/planos/expediente venga de donde venga; el efecto que arma el
   molde no arranca con la puerta cerrada.
5. **El error se ve** — `rp-error` vive en la tarjeta de la puerta («◆ NO PUDE ABRIR TU ARCHIVO» + el mensaje), no en el
   `sim-panel` (que con pieza en pantalla ni se dibujaba). La espera también se dice (`puerta-midiendo`).
- De paso, con medida: `dfm-mesh.ts` restaba z_min DOS veces en `regionsDetail.zLo/zHi` (la tapa daba zLo 14.9 en una pieza de
  14.1 de alto); ahora es relativo a z_min como dice su tipo. Solo cambia donde z_min ≠ 0. `mold-mecanismos-test` ✓.

### Los tres happy paths (producción :4260, máquina compartida con otras órdenes)
| Pieza | Puerta | Tiempo (leer · parar · teselar · **la puerta**) | Molde / precio | Captura |
|---|---|---|---|---|
| **LA PIEZA QUE SÍ** 1594C Box | ✓ PASA · 1 sólido · cerrada · 0 contrasalidas | 4.36 s = 2.77 · 0.96 · 0.58 · **0.05** | abierto: E4 en 25 s, expediente con cotización | `f-box/02-paso2.png`, `p-box/06-intento-molde.png` |
| **LA PIEZA QUE NO** 1594C Lid | ◆ 6 CONTRASALIDAS pintadas (46 caras + 6 cajas), ε 6.6–7.8 % | 1.51 s = 0.98 · 0.35 · 0.15 · **0.04** | riel-6 + MOLDE + EXPEDIENTE tocados: **0 moldes** (estación 1/12), expediente no abre, **0 precios** en pantalla | `f-lid/02-paso2.png`, `p-lid/09-intento-expediente.png` |
| **EL ENSAMBLE** 1593K | ? 9 SÓLIDOS: ¿CUÁL MOLDEO? (pasos 3–9 con candado) | 4.39 s = 2.80 · 1.14 (con la lista) · 0.42 · **0.04** | elige n.º 5 (la puerta 59.5×22.6×4.2) → ✓ PASA en 2.6 s, 2879 mm³ · 31 caras en el kernel; molde E8 en 20 s | `f-1593k/02-paso2.png`, `f-1593k/02b-elegido.png`, `c-1593k/06-intento-molde.png` |
- ANTES (misma prueba sobre la base, `antes-lid/`): la tapa armaba el molde hasta E4 en 25 s y el expediente salía con
  cotización y «$14,008 · $22,412» en pantalla.
- Par de control de la matrícula (`c-stl-sano`, `c-stl-roto`): rpi4-top sano → «cerrada: sin huecos (15 agujeros pasantes)»,
  ◇ STL (pasos 6–9), 47 ms; el MISMO con un triángulo borrado → «◆ TU MALLA ESTÁ ABIERTA: 3 aristas sueltas», pasos 3–9, 51 ms.
  En node: rpi4-bottom sano/roto igual; en pulgadas (÷25.4, diagonal 4.5 mm) → «¿ESTÁ EN PULGADAS?»; volteado → ◇ «las volteé».
  Archivo basura → `rp-error` visible (`c-basura`).
- Banco STL en node (21 piezas, `puerta-stls.txt`): todas ≤ 1.4 s (3dbenchy 225k triángulos 1.29 s, funnel 258k 1.38 s).
  1557BGY en node: 19 sólidos, la lista; elegir el n.º 1 (la tapa) → malla abierta 92 aristas, BRepCheck válido → ◇ aviso.

### Pruebas
- `node scripts/orden-gate.cjs` → **VERDE** (censo 8/42/47 sin cambio). tsc: **67 = 67** de la base, 0 nuevos.
- Cubo `ciclo-dado-test`: **267/267** (sin literales cambiados: no hay ACTA). `verif-matricula-test --sin-banco` 61 ✓ VERDE.
  `mold-mecanismos-test` ✓, `mold-ejectortypes-test` ✓ (los literales del libro intactos: ε 1.3 %, F 1195 N, τ 1.65 MPa).

### Visto, es de otra orden
- La carga de un STEP cuesta 2.8 s solo en LEERLO (carcasa, 1593K) con iangpu compartida: el «soltar ≤ 3 s» del plan no se
  cumple por el kernel que ya estaba, no por la puerta (≤ 0.05 s). Es de la semana 4 (velocidad / servicio iangpu).
- EL PUENTE (useMoldStudio) sigue sembrando la E1 —con su paquete y su costo— al entrar el sólido aunque la puerta cierre; nada
  la enseña (el expediente no abre), pero el número existe en memoria.
- Los STL no se paran en su eje (el STEP sí): la puerta mide +Z tal como llega el STL, igual que el paso 5. 17 de 21 STL del banco
  salen con contrasalidas (diseños para impresora: ventanas, ganchos, roscas).
- Los arneses que sueltan un ENSAMBLE (`inspecciona-molde.cjs`/`inspecciona.cjs` con 1557BGY, `filma-camino.cjs`) ahora se
  detienen en la pregunta: hay que tocar `[data-testid^="puerta-solido-"][data-en-pantalla="1"]` (confirma, 0 ms) — no toqué sus
  archivos (son del coordinador / de la película).
- El rótulo «CON MECANISMOS §11.3» de MoldPanels ~L412 no se tocó: vive en el panel del molde, al que una pieza cerrada ya no llega.

### Preguntas para ian
1. **La carcasa tarda 4.4 s en aparecer, y no es la puerta.** Cuando sueltas la carcasa, la máquina tarda 2.8 s solo en LEER el
   archivo, 1 s en pararla y 0.6 s en mallarla; revisar si sale del molde tarda 0.05 s. Hoy: 4.4 s contra 3 s del plan. ¿Lo
   atacamos ya (leerlo en iangpu como servicio) o lo dejamos en la semana de velocidad? Recomiendo la semana de velocidad: la
   puerta no lo empeora.
2. **¿Cuánto se estira un gancho?** Para decir «esta zona podría botarse estirándose», el libro trae solo el caso de una tapa
   redonda (1 mm sobre 77 mm = 1.3 %). Para un labio recto usé el largo de la pared que se dobla (regla de Hefestos). En la tapa
   da 6.6–7.8 % contra 2 %: ninguna se estira, igual que dicen los expertos. ¿Se queda rotulado así? Recomiendo que sí: solo
   informa, la puerta cierra con o sin él.
3. **El verde de la puerta.** La piel no tenía verde (cumplir es blanco ✓); la orden pedía semáforo, así que agregué UN verde
   (`PIEL.pasa`) solo para «tu pieza pasa la puerta». ¿Lo dejas? Recomiendo que sí: a la entrada, el semáforo se entiende solo.
4. **Los STL de impresora casi todos dicen NO** (17 de 21 del banco; 4 además traen la malla abierta), porque no se paran en su eje como el STEP. ¿Abrimos una
   orden para parar el STL igual que el STEP? Recomiendo que sí, antes de enseñarle la puerta a un alumno.

### Archivos (para la fusión)
- `src/forja/mold/stl.ts` — imports; `MallaCargada`/`OpcionesCarga`; LA PUERTA (`armarPuerta`, `confirmarSolido`,
  `triangulosEnContrasalidas`, `medirMalla`, `cajaPorAristas`); `mallaDesdeArchivo(nombre, buf, o)` (rama STL y STEP).
- `src/forja/verificacion/matricula.ts` — `mallaEnPalabras` al final (nada más cambia).
- `src/forja/mold/dfm-mesh.ts` — `significativa` + `undercutMap` en el reporte, `RUIDO_CONTRASALIDA`, el mapa de regiones y el
  arreglo de zLo/zHi.
- `src/forja/mold/ejectortypes.ts` — `contrasalidaQueHariaFalta` (antes de `EjectorType`).
- `src/forja/brep/TransicionPaso.tsx` — `RielDePasos` (`cierraDesde`, `onCandado`) y `Candado`.
- `src/forja/brep/piel-futuro.ts` — `PIEL.pasa` (1 token).
- `src/forja/brep/MoldPanels.tsx` — `TarjetaPuerta` al final (después de `TarjetaEstacion`); ~L412 intacto.
- `src/forja/brep/ForgeBRepStudio.tsx` (líneas de la base eeeb24e): imports L52 y L70 · `ContrasalidasEnLaPieza` tras
  `PartingLine3D` (~L3014) · estado de la puerta junto a `errPieza`/`modoCamino` (~L3755–3761) · guardia en el efecto que arma
  el molde (~L4000 y su deps L4031) · `abrirArchivo` + `elegirSolido`/`responderUnidades` (~L5220–5261) · `pasoActual` + la
  cerradura + `irAlPaso` (~L5489–5514) · la pintura junto al `SolidMesh` de la pieza (~L7348) · riel (~L7701) · botones de la
  tira (~L7738–7780) · tarjeta de la puerta + aviso de entrada solo con giro (~L7991–8003) · `rp-error` fuera del sim-panel
  (~L8751). Ninguna toca la hoja de análisis (~L4070) ni el expediente (~L10040) de la orden A.
