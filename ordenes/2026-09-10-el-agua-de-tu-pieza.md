# ORDEN: EL AGUA DE TU PIEZA — las líneas de enfriamiento (E8) sobre la pieza soltada, no sobre el cubo

ESTADO: cerrado
PRIORIDAD: 3

BASE: 4b10b9c

OBJETIVO: ian (2026-09-10): «NO VEO LOS BOTADORES NI LAS LÍNEAS DE ENFRIAMIENTO… yo preferiría que se vea todo el molde».
Hoy el molde de la carcasa termina en E5 (placas, insertos, bebedero); el agua es la estación 8 y solo está
cableada para el cubo (`estacion8Dado`, `cicloEstacion8`). Al final de esta orden las líneas de agua §9 (plug
JP-352, H = 4·D, paso W ∈ [H, 2H], que la hoja de análisis YA cotiza en números) se dibujan en el 3D del molde de
la pieza soltada, en su placa, respetando los insertos, y la leyenda del paso 6 pasa de «✗ agua (E8 cubo)» a «✓ agua».

## YA-EXISTE (prueba de ausencia)
- `estacion8Dado`/`cicloEstacion8` (useMoldStudio) dibujan el agua del CUBO; `mold-drawing-set` ya pone las líneas
  en la lámina de la placa; la hoja de análisis dice «JP-352 · ⌀9.53 · H 38.1 · W 66.7» para la carcasa: la
  geometría del circuito existe como números, no como acero.
- El ciclo por pieza (E1→E5 con `piezaSpec`) es el patrón a extender: E8 por pieza = misma función con la
  huella de la pieza y las placas de `colocacionEnLaBase`.
- NO existe: E8 para `ciclo.pieza`; el runner ya tiene el check «agua» en el paso 6 (hoy ✗).
## LO QUE SE MIDIÓ AL ABRIR (2026-09-17)
- `estacion8Dado` + `estacion8Circuito` ya calculan y DIBUJAN el agua completa del cubo: diámetro y plug del catálogo,
  H = 4·D recortada por el techo del inserto, paso W, anillo perimetral en A, serpentina + BAFFLE en B, tapones NPT,
  O-rings donde cruza interfaces, caudal y el juez de claros. Lo que falta NO es el circuito: es que sus números salgan
  de la PIEZA soltada y no del cubo.
- Clavado al cubo (leído, línea por línea): `zBase = zPart + 39.5` (la boca del cubo), `semi = 30` («libra bebedero y
  rodea la huella 40»), `apiceInteriorZ = zBase − 2` (piso del cubo), y en `estacion8Dado`: pared 2 mm para el t_c,
  `bandMm: 40`, `lineLenMm: 196`, `partVolCc` por defecto 14.14.
- El ciclo por pieza hoy se detiene en E5: el conductor (`ForgeBRepStudio`) solo encadena E1→E5. Para que el agua se
  vea hay que encadenar E8 con la pieza.

## TOCA (confirmado 2026-09-17)
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json
## CREA
- public/evidencia/2026-09-10-el-agua-de-tu-pieza/resultados.json
- public/evidencia/2026-09-10-el-agua-de-tu-pieza/agua-en-el-molde.png
- public/evidencia/2026-09-10-el-agua-de-tu-pieza/paseo-contactos.png
## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; lista de git status al abrir)
- videos/econ-guardadito.json
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## LO QUE SE MIDIÓ AL CABLEARLO (2026-09-17, node + kernel OCC, laptop)
- **HALLAZGO GORDO — la base cerrada estaba en la cara equivocada.** `colocacionEnLaBase` devolvía
  `zBaseCerradaMm = tz`, que solo es la base cerrada si el marco local de la pieza arranca en z=0 (el cubo,
  0..40). La carcasa vive en z −33.31..0.03 → decía **159.53 (¡la boca, en la partición!)** cuando su tapa
  está en **192.84**. Medido con el sólido, no leído: a `z_min+1` la sección de la carcasa está **93 % llena**
  (tapa) y a `z_max−1` solo **16 %** (el anillo de la boca). Arreglado con `local.zMinMm` (el cubo da 0 ⇒
  bit-igual). Arrastraba dos cosas: el **bebedero** de la carcasa aterrizaba en 159.53 con L 102.47 mm —
  ATRAVESANDO la pieza entera — y ahora aterriza en su tapa con L 69.16; y el **anillo de agua** caía en
  z 178.6, DENTRO de la pieza, y ahora va a 210.24.
- Otros tres números del cubo que salieron a la luz y se parametrizaron: la banda se medía en el eje LARGO
  (debe medirse atravesada a las líneas ⇒ 2·semiX), el serpentín dibujaba **3 líneas clavadas** aunque el
  diseño pidiera otras, y los conteos `nBarrenos`/`nTapones` del lado B estaban escritos a mano (6 y 6).
  Ahora se cuentan. El cubo pide 3 y recibe 3: `ciclo-dado-test` **266/266** sin una sola diferencia.
- Un texto que MENTÍA: el recorte decía «sigue en 2D..5D» SIEMPRE. Para la carcasa el bolsillo del inserto B
  empuja la serpentina a **7.30D** y ahora lo dice: «⚠ SE SALE de 2D..5D (§9.2.6)».
- **CIRCUITO DE LA CARCASA (1594C Box, pared 3.2):** base 446×546, ⌀4.76 (JP-250), anillo en A a z 210.24
  (H 17.40 = 3.66D) rodeando la huella 66×106.5 con 10 mm de aire · serpentina de 3 líneas en B a z 125.24 ·
  baffle ⌀9.53 que sube a 184.40 (5.24 mm del ápice interior) · 12 tapones · 3 sellos · **juez VERDE** (6/6).
- **INTERFERENCIA (kernel, no aritmética):** las 12 líneas ENGORDADAS 2.38 mm (el claro ½⌀ de §9.2.7) contra
  el sólido de la pieza ya colocada ⇒ **0.0 mm³, cero traslapes**. El baffle va **91.9 %** dentro del acero
  del macho+respaldo; el 8.1 % restante es justo donde cruza la placa B, que es donde se declara el sello.
- **LA LÁMINA Y EL 3D NO DICEN LO MISMO** (medido): la lámina de la placa (`coolingCircuitDesign`) dice
  ⌀9.53 · H 32 · W 64 · 5 por lado · JP-352; el 3D (`estacion8Dado`) dice ⌀4.76 · H 19 · W 38.1 · 3 por lado ·
  JP-250. Son DOS caminos distintos al mismo `coolingDesign` (la lámina fuerza el ⌀ del porta-molde con
  `forceDiaMm`, el 3D lo deduce del caudal). Unificarlo MUEVE al cubo, así que no se hace de contrabando aquí:
  queda su ticket → `ordenes/2026-09-10-el-agua-dice-dos-cosas.md`.

## EVIDENCIA (se declara ANTES de trabajar)
- Paso 6: el check `agua` del RUNNER pasa (rol `agua` en `data-roles`), sin quitar ningún check.
- Las líneas no atraviesan insertos ni pieza (`mold-interference`: 0 traslapes) y su paso cumple W ∈ [H, 2H].
- La lámina de la placa y el 3D dicen las MISMAS líneas (misma fuente).
- Paseo con el agua visible; video en ambas PCs; orden-gate VERDE.

### ENMIENDA 2026-09-17 (lo que la medición obligó a corregir de esta lista)
- «W ∈ [H, 2H]» se cumple en el DISEÑO (W 38.1 = 2.00·H con H 19.04) pero NO en el anillo del lado A una vez
  RECORTADO por el techo del inserto (H 17.40 ⇒ W/H = 2.19). El recorte es real y está rotulado; el número que
  se declara es el del diseño. Se dice, no se esconde.
- «La lámina y el 3D dicen las mismas líneas» NO se entrega aquí: se MIDIÓ la diferencia (arriba) y se pasa a
  su propio ticket, porque unificarlas mueve al cubo y esta orden promete no moverlo.
- Aparece un TOCA que no estaba previsto: `src/forja/brep/MoldPanels.tsx` — al pasar la pieza a la estación 6
  el panel de la E5 desaparecía y no entraba ninguno (la ficha del agua es la del cap 9, sin el botón a la E9).
## CIERRE (2026-09-17 · MEDIDO, no contado)

**El agua de la carcasa se ve en el molde y el runner la mide.** El paso 6 pasó de **8/11 a 10/11**
(`✓ placas · ✓ colada · ✓ agua`, rojo solo EXPULSORES) y el camino volvió a **7/8**:
`runner · 2026-09-17 22:55 UTC · 7/8 ok · 1:2/2 2:5/5 3:6/6 4:4/4 5:3/3 6:10/11 7:5/5 8:4/4`.
Telemetría de la corrida: E2 3.0 s + E3 20.4 s + E4 0.8 s + E5 67.1 s + **E6 (agua) 2.4 s**;
`p6-5 colada` 51.3 s (dentro del presupuesto de 60), `p6-6 agua` 1.2 s, encuadre del molde
`dx −0.014 dy 0.127 fill 0.70 luma 0.253`.

**Lo que se entregó**
- Estación 6 del molde de TU pieza = EL AGUA (`cicloAguaPieza` en useMoldStudio), encadenada por el
  conductor después de la E5. Dibuja el circuito COMPLETO con roles `agua-*`: 12 líneas ⌀4.76 (JP-250),
  anillo en A que rodea tu huella con 10 mm de aire, serpentina + BAFFLE en B hasta 5.24 mm del ápice
  interior, 12 tapones NPT, 3 O-rings. Ficha del cap 9 en el panel (sin el botón a la E9 del cubo).
- `estacion8Dado`/`estacion8Circuito` dejaron de estar cableados al cubo: pared, huella, base cerrada,
  volumen, banda, largo de línea y número de líneas salen de la pieza. Los defaults reproducen el cubo
  EXACTO — `ciclo-dado-test` **266/266**, corrida a corrida sin una sola diferencia fuera de un reloj.
- La leyenda de la tira dejó de mentir: decía `✗ agua (E8 cubo)` clavado; ahora dice `✓ agua` cuando el
  agua está y `· agua` cuando no.

**EL HALLAZGO QUE VALIÓ MÁS QUE EL TICKET.** La base cerrada de la pieza estaba en la CARA EQUIVOCADA:
`colocacionEnLaBase` devolvía `tz`, que solo es la base cerrada si el marco local arranca en z=0 (el cubo).
La carcasa vive en −33.31..0.03 ⇒ decía 159.53 (la BOCA, en la partición) en vez de 192.84. Comprobado
midiendo el sólido: a `z_min+1` la sección está **93 % llena** (la tapa) y a `z_max−1` solo **16 %** (el
anillo de la boca). Consecuencias que ya estaban en producción y nadie veía:
- el **bebedero** de la carcasa aterrizaba en 159.53 con L 102.47 mm, ATRAVESANDO la pieza de lado a lado;
  ahora cae en su tapa con L 69.16;
- el **anillo de agua** habría caído en z 178.6, DENTRO de la pieza; con la cara correcta va a 210.24.
Arreglo: `local.zMinMm` (el cubo da 0 ⇒ bit-igual).

**La prueba dura de que el agua no toca nada** (kernel, no aritmética): las 12 líneas ENGORDADAS 2.38 mm
(el claro ½⌀ de §9.2.7) intersecadas contra el sólido de la pieza ya colocada ⇒ **0.0 mm³**. El baffle va
**91.9 %** dentro del acero del macho+respaldo; el 8.1 % restante es exactamente donde cruza la placa B,
que es donde el circuito declara su sello. Juez de claros **VERDE 6/6**.

**Lo que se dice y NO se esconde**
- El recorte del lado B deja la serpentina en **7.30D**, fuera de la banda 2D..5D de §9.2.6, porque el
  bolsillo del inserto B la empuja. El texto decía «sigue en 2D..5D» SIEMPRE; ahora avisa cuando se sale.
- El anillo del lado A, RECORTADO por el techo del inserto, queda en W/H = 2.19 (el diseño pide W = 2.00·H).
  El número que se declara es el del diseño; el recorte está rotulado.
- La lámina de la placa y el 3D dibujan circuitos DISTINTOS del mismo molde (⌀9.53·H32·W64·5 vs
  ⌀4.76·H19·W38.1·3). No se unificó aquí porque mueve al cubo → `2026-09-10-el-agua-dice-dos-cosas.md`.
- La escala del ENFRIAMIENTO sigue visible (atenuada a 0.12) encima del molde, con su reloj corriendo.
  Es una decisión del ticket anterior, no una regresión; queda a juicio de ian si debe morir del todo.
- La rejilla de la E5 arranca 36.3 mm abajo de la pieza (26 % de planos vacíos) → registrado en EL FAN EN
  SU CARRIL, porque recortarla mueve la voxelización del cubo.

**Gotcha que costó una corrida entera:** el arnés por ssh SIN la receta de GPU de CLAUDE.md
(`DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`) hace que Chrome NO cree
contexto WebGL (`VENDOR = 0xffff`): el `<Canvas>` no monta, `__forgeBrep.encuadre()` devuelve **null** y
TODOS los checks de encuadre fallan — el camino midió 4/8 y parecía una regresión mía. Con la receta: 7/8.

**Evidencia**: `public/evidencia/2026-09-10-el-agua-de-tu-pieza/` (resultados.json con el circuito completo,
agua-en-el-molde.png, paseo-contactos.png) · video **31-EL-AGUA-DE-TU-PIEZA-paseo.mp4** (4:22) en Downloads
de las dos PCs y en E:\forja-videos · orden-gate VERDE.
