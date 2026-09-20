# ORDEN: LA ENTRADA — el STEP que suelta el cliente llega al molde como UNA pieza, con su tamaño real y parada en su eje de apertura

ESTADO: cerrado
PRIORIDAD: 2

BASE: be27ab4

OBJETIVO: ian (2026-09-18, tras LAS 20 PIEZAS): «corrige 1». La causa raíz 1 de los revisores: 15 de los 20 STEP
reales son ENSAMBLES y el estudio los moldea como un ladrillo. Al final de esta orden, al soltar un STEP: (1) si trae
varios sólidos, el molde se hace sobre UNO (el de mayor volumen) y el estudio DICE qué es el archivo y qué se quedó
fuera; (2) la pieza queda PARADA en su eje de apertura con la boca arriba, que es lo que todo el ciclo supone; (3) su
tamaño es el real. La carcasa (1 sólido, boca arriba) no cambia ni un número.

## LO QUE SE MIDIÓ AL ABRIR (2026-09-18, node + kernel, los 20 STEP)
- **Son TRES errores apilados, no uno:**
  1. **La caja envolvente «exacta» se infla.** `arbolBBoxExacta` (estudio-molde-datos.ts:1528) usa
     `BRepBndLib.Add(shape, box, false)`, que mide con los POLOS de las superficies BSpline: la caja de 1557BGY da
     81.6×**234.7**×81.6 (mide 80×31.2×80); el compuesto 1553B, 79×119.9×**284.6** (mide 24 de alto).
     `BRepBndLib.AddOptimal(…, false, false)` coincide con la malla en todos; en la carcasa las tres dan 66×106.5×33.3.
     De aquí salían bases de 996×996 para cajas de 24 mm, y los «220 mm extra» que los revisores no explicaban.
  2. **El ensamble se funde.** `importSTEP` → `OneShape` (el compuesto entero). Separar con `uniqueSubShapes` (con el
     ENUM `TopAbs_SOLID`, no `.value` — gotcha ya documentado en piezas-reales-intake.cjs) y tomar el de mayor volumen
     da la pieza de plástico en los 15 (1557BGY → la caja de 50.33 cc, lo mismo que el intake de agosto).
  3. **El eje se supone.** El ciclo supone +Z del STEP = apertura y la boca arriba. Medido: 5 cajas abren en Y
     (1552C3BK, 1554B, 1557BGY, 1591XXCBK, PJ12106) y 5 tienen la boca en −Z (1553B, 1553D, 1593D, 1593K, RL6215BK).
- **El atajo que se mide, no se supone:** la asimetría de la SECCIÓN LLENA en los extremos de cada eje (la boca es un
  anillo, la base cerrada es llena) coincide con `pickDrawAxis` (menor contrasalida §11) en las 20 piezas. Es barata
  (milisegundos) — la carcasa no paga latencia al soltar — y `pickDrawAxis` solo se consulta cuando la asimetría es
  débil (1593K/L: 11/22 y 11/18). Placa plana (todo lleno en los 3 ejes, End Plate): el eje es el ESPESOR.
- `pickDrawAxis` lo usan el registro de comandos y 12 scripts: NO se toca; el desempate de placa va en la función nueva.

  | STEP | sólidos | el elegido | eje+boca | sección llena (lo/hi por eje, %) |
  |---|---|---|---|---|
  | 1551F.stp | 5 | 6.63 cc | Z+ | X 82/82 · Y 84/84 · Z 90/18 |
  | 1552C3BK.stp | 8 | 19.26 cc | Y+ | X 56/56 · Y 85/1 · Z 19/19 |
  | 1553B.stp | 10 | 25.16 cc | Z− | X 22/22 · Y 16/49 · Z 8/75 |
  | 1553D.stp | 12 | 36.48 cc | Z− | X 16/16 · Y 13/42 · Z 0/79 |
  | 1554B.stp | 11 | 32.93 cc | Y+ | X 84/84 · Y 93/7 · Z 84/84 |
  | 1557BGY.stp | 19 | 50.33 cc | Y− | X 46/46 · Y 4/55 · Z 46/46 |
  | 1591BSBK.stp | 6 | 37.89 cc | Z+ | X 93/93 · Y 93/93 · Z 100/10 |
  | 1591XXCBK.stp | 10 | 43.42 cc | Y+ | X 71/71 · Y 95/5 · Z 74/74 |
  | 1593D.stp | 9 | 17.47 cc | Z− | X 72/72 · Y 28/28 · Z 17/85 |
  | 1593K.stp | 9 | 15.87 cc | Z− | X 81/81 · Y 16/16 · Z 11/22 |
  | 1593L.stp | 11 | 22.18 cc | Z? | X 82/82 · Y 16/16 · Z 11/18 |
  | 1594C Box.stp | 1 | 55.82 cc | Z+ | X 93/93 · Y 91/91 · Z 95/14 |
  | 1594C Lid.stp | 1 | 33.29 cc | Z+ | X 74/74 · Y 77/77 · Z 94/9 |
  | 1598B Bottom.stp | 1 | 80.26 cc | Z+ | X 9/9 · Y 85/85 · Z 95/0 |
  | 1598B End Plate.stp | 1 | 9.5 cc | X? | X 100/100 · Y 100/100 · Z 100/100 |
  | 1598B Top.stp | 1 | 79.89 cc | Z+ | X 9/9 · Y 85/85 · Z 95/0 |
  | 1599BBK.stp | 10 | 36.98 cc | Z+ | X 88/88 · Y 90/90 · Z 95/5 |
  | 1599HBK.stp | 10 | 118.71 cc | Z+ | X 76/76 · Y 78/78 · Z 95/1 |
  | PJ12106.step | 36 | 1034.87 cc | Y+ | X 0/0 · Y 76/10 · Z 0/0 |
  | RL6215BK.stp | 6 | 47.87 cc | Z− | X 78/78 · Y 83/83 · Z 10/94 |

## EJERCICIOS
- [x] golpe 1 · la caja envolvente real (`AddOptimal`) en `arbolBBoxExacta`; cubo y carcasa bit-iguales.
- [x] golpe 2 · `prepararPiezaDelSTEP(K, oc, shape)` en draw-axis.ts: sólidos → el mayor → eje por sección (o
      `pickDrawAxis` si es débil, o espesor si es placa) → giro propio alrededor del centro para que la boca quede en +Z.
      El estudio la llama al importar (una vez por archivo, no en cada reconstrucción) y enseña un AVISO FLOTANTE:
      qué trae el archivo, qué se moldea, qué quedó fuera, cómo se paró.
- [x] juez: el arnés de las 20 piezas (el mismo del superticket) — orientación, pines por agarre, baffle vs pieza,
      bases; la carcasa idéntica; `ciclo-dado-test` 266/266; camino 8/8.
- [x] golpe 3 (enmienda 2) · `cursoPart`: la deflexión lineal (mm) ya no se pasa también como angular (rad).
- [x] paseo: soltar un ENSAMBLE (1557BGY) y que se vea el aviso y la caja parada; video en las dos PCs.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/draw-axis.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/stl.ts
- src/forja/brep/useMoldStudio.ts
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- public/evidencia/2026-09-18-la-entrada/resultados.json
- public/evidencia/2026-09-18-la-entrada/ensamble-soltado.png
- public/evidencia/2026-09-18-la-entrada/paseo-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; git status al abrir, 2026-09-18)
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
- src/cinematic/CinematicMolecule.tsx

## ENMIENDA 2026-09-19 (lo que el paseo destapó)
- El paseo soltando 1557BGY enseñó el aviso bien, pero el VISOR seguía pintando el ensamble (cabezas Phillips de los
  tornillos, cota «alto 108.9» = el ensamble) y el molde no arrancó en 240 s: la malla del Foco sale de OTRA
  importación, `mallaDesdeArchivo` (src/forja/mold/stl.ts), que ya contaba los sólidos y anotaba «⚠ se están midiendo
  FUSIONADOS» sin hacer nada. Entra al TOCA: esa importación pasa por la misma entrada y le entrega la decisión al
  estudio (una sola medición por archivo).

## ENMIENDA 2 · 2026-09-19 (lo que el SEGUNDO paseo destapó: el molde de la caja no armaba en la app)
- Con la entrada ya buena (19 sólidos → la caja de 50.33 cc, parada, lente sobre la caja), MOLDE se quedaba en «E3 ·
  tallando la cavidad y el núcleo · 0/5» y la pestaña TRONABA («Target crashed»). El arnés de node arma esta pieza
  en 109 s: la diferencia no era el kernel.
- Medido, no supuesto: reproductor con consola + telemetría (`E3T tessellate cavidad 217 211 ms`, heap 2.1 GB) y
  perfil de CPU de Chrome (311 s muestreados: 81 % dentro de `tessellate` ← `cursoPart` ← E3, en el constructor de
  `BRepMesh_IncrementalMesh`).
- Causa: `cursoPart(shape, …, d)` llamaba `tessellate(oc, shape, d, d)` — el MISMO número de milímetros y de
  radianes. La cavidad pide 0.03: se mallaba a 0.03 rad = 1.7° por segmento en cada filete. En el cubo (caras
  planas) no costaba nada; por eso el camino de la carcasa nunca lo vio.
- Acero FRESCO por pareja (el mallador incremental reusa la malla fina anterior — mi primera medición salió viciada
  por eso y «refutó» la causa en falso), placa de cavidad de 1557BGY en node:
  lineal 0.03 · angular 0.5 → 30,718 tris · 1.1 s | angular 0.2 → 73,578 tris · 2.1 s | angular 0.03 →
  **6,243,430 tris · 229.2 s**.
- Entra al TOCA `src/forja/brep/useMoldStudio.ts`: UNA línea, `Math.max(deflection, 0.2)` para la angular. Solo cambia
  a quien pedía < 0.2 (pieza 0.1, cavidad 0.03, núcleo 0.07…); la flecha lineal sigue mandando en radios > 6 mm.
  Va en su PROPIO commit. Sin esto el ejercicio del paseo (el molde sobre el ensamble soltado) no se puede enseñar.
- Hallazgo que NO se arregla aquí (se registra): `tessellate()` dice limpiar la malla previa (`BRepTools.Clean`), pero
  sobre la misma forma pedir (0.1, 0.1) después de (0.03, 0.2) devolvió los mismos 30,974 triángulos, y (0.03, 0.2)
  después de (0.03, 0.5) dio 30,974 en vez de los 73,578 de una forma fresca: la limpieza no surte efecto.

## EVIDENCIA (se declara ANTES de trabajar)
- Arnés de las 20: las cajas quedan «boca arriba», el agarre coloca pines donde antes daba 0/8, el baffle deja de
  invadir, las bases dejan de ser absurdas; la carcasa con los mismos números de hoy.
- `ciclo-dado-test` 266/266 · camino de la carcasa 8/8 · orden-gate VERDE.
- Paseo soltando 1557BGY: el aviso flotante y la caja parada; video en ambas PCs.

## CIERRE (2026-09-19 · MEDIDO, no contado)

**Sueltas un ENSAMBLE y sales con el molde de la PIEZA, armado y trabajando, en la app.** Paseo del video 34 soltando
`1557BGY.stp` (19 sólidos: caja, tapa, empaque, 4 insertos, 8 tornillos, 2 patas): el aviso flotante dice «Tu archivo
es un ENSAMBLE de 19 sólidos. Moldeo la pieza mayor: 50.33 cc, 80 × 80 × 31 mm… La paré en su eje de apertura —
abría en −Y»; el Foco mide la CAJA (cotas 80.0 / 80.0 / 31.2, 514 caras, 50.33 cc); primera placa del molde a los
4.7 s; agua ✓ y botadores ✓ a los 152 s del clic; `pin-punta-0` sube **39.2 mm** (= H + 8 = 31.2 + 8, la carrera
declarada). Telemetría: E2 5.5 · E3 44.7 (acero 17.0 · cavidad teselada **2.9 s**, eran 217.2) · E4 2.3 · E5 87.0 ·
E6 3.3 · E7 4.8 s. Heap 594 MB (eran 2.1 GB y la pestaña tronaba).

**Lo que se entregó (tres golpes, tres causas apiladas + una que destapó el paseo)**
- **Golpe 1 · la caja envolvente real.** `arbolBBoxExacta` usa `AddOptimal`: la de polos BSpline inflaba 1557BGY a
  81.6×234.7×81.6 (mide 80×31.2×80). De ahí venían las bases de 996×996. En la carcasa el cambio es ≤ 0.04 mm (la de
  polos sumaba la tolerancia): es una corrección HACIA el valor exacto, no bit-igual, y se declara.
- **Golpe 2 · `prepararPiezaDelSTEP`** (draw-axis.ts): sólidos con el ENUM `TopAbs_SOLID` → el de mayor volumen → eje
  por asimetría de la SECCIÓN LLENA (la boca es anillo, la base es llena; `pickDrawAxis` si es débil; el espesor si es
  placa) → giro propio alrededor del centro para dejar la boca en +Z. Se mide UNA vez por archivo (caché por texto del
  STEP; `aplicarEntrada` en cada reconstrucción). La malla del Foco (`mallaDesdeArchivo`, stl.ts) pasa por la MISMA
  entrada: antes el aviso salía bien y el visor seguía pintando el ensamble. Una pieza de un sólido y boca arriba pasa
  intacta (mismo objeto).
- **Golpe 3 · `cursoPart`** (enmienda 2): la deflexión lineal ya no se pasa también como angular. Cavidad de 1557BGY:
  6,243,430 → 73,578 triángulos, 229 s → 2.1 s. Sin esto el ensamble soltado no armaba molde en la app.
- **El aviso flotante** (`aviso-entrada`): qué trae el archivo, qué se moldea, qué quedó fuera (volúmenes), cómo se
  paró y con qué evidencia (sección llena lo/hi). Solo sale si algo cambió.

**El juez: las 20 piezas, mismo arnés, ENTRADA=0 contra ENTRADA=1** (`public/evidencia/2026-09-18-la-entrada/resultados.json`)
- Problemas mecánicos **92 → 37**. Etapas reventadas 10 → **0**. Orientación ambigua o boca abajo 16 → 2. Agarre con
  menos de 8 pines 16 → 2. El agua invade la pieza 14 → 1. Las 17 láminas salen en las 20. Boca arriba 20/20 con un
  verificador independiente.
- Lo que SUBE, y por qué no es regresión: juez de pines en rojo 2 → 10 y pin > pared 4 → 6 — ahora SÍ hay pines que
  juzgar; son las causas 2 y 3 del superticket (el agua del lado B contra los botadores), que antes no se alcanzaban.
- Quedan ambiguas 2: 1593L (media concha, sección 11/18) y 1598B End Plate (placa: se resuelve por espesor).

**Regresión**
- `ciclo-dado-test` 266/266 (con la entrada; el golpe 3 vive en un hook que la prueba de node no toca).
- tsc: 66 = 66 errores, lista idéntica con los 5 archivos en HEAD y en trabajo (cero nuevos, cero que desaparezcan).
- Camino de la carcasa: **8/8, 43/43** el 19 a la 01:16 UTC con la entrada y la máquina sola. Tras el golpe 3, dos
  corridas **7/8, 42/43**: falló SOLO el reloj `p6-5` (colada ≤ 60 s: 64.2 y 62.0 s) con Horizon Forbidden West
  abierto en el host (todo ~1.45× más lento por parejo; E5 83.6 s contra 57.5 sola). El cambio solo quita triángulos.
  **Pendiente honesto: volver a medir con el host libre** — hasta entonces el tablero enseña 7/8.
- orden-gate VERDE.

**Cómo se encontró el golpe 3 (para no repetir el tropiezo)**
1. El arnés del paseo reintenta un `tclick` vencido: MOLDE es interruptor y el reintento lo APAGABA. Clic único.
2. Reproductor mínimo con telemetría con hora → `E3T tessellate cavidad 217 211 ms`. 3. Medí en node y «refuté» la
causa EN FALSO: el mallador incremental reusó la malla fina anterior (0.1:0.1 dio los mismos 30,974 triángulos que
0.03:0.2). 4. Perfil de CPU de Chrome: 81 % en `tessellate` ← `cursoPart`. 5. Acero FRESCO por pareja: 229 s.
Lección: **un arnés sin navegador no prueba que la app arme el molde**, y una medición de teselado sobre una forma
reusada miente.

**Hallazgos registrados, NO arreglados aquí**
- ordenes/despues/2026-09-19-el-reencuadre-espera-al-hilo.md — en esta pieza, ~24 s de viewport vacío tras el clic a MOLDE
  (la cámara sigue en el encuadre del Foco mientras el kernel talla; los 350 ms de respiro se midieron con la carcasa).
  Se ve en la hoja de contactos, cuadros 20–22. El video 34 lo enseña tal cual.
- ordenes/despues/2026-09-19-tessellate-no-remalla.md — `BRepTools.Clean` no surte efecto.
- En el superticket LAS 20 PIEZAS, causa 3: el draft «medido por rebanadas» sale 9°–29° en 9 de 20 cajas (1557BGY
  19.1°) y BAJA la F_eject; en pantalla es la cota roja «draft 0 ≠ 19.121 ✗».
- El aviso aparece ~20 s antes que la pieza en el visor (la malla del Foco tarda): se ve el letrero sobre una rejilla
  vacía. No se tocó.

**Entrega** · video 34 en Downloads de las dos PCs y en E:\forja-videos: `34-LA-ENTRADA-ensamble-soltado-paseo.mp4`
(1600×1000, 407 s) + `-1080-h264` + `-720-chat`. Evidencia: `ensamble-soltado.png` (el aviso | el molde abierto
expulsando la caja), `paseo-contactos.png` (51 cuadros, uno cada 8 s), `resultados.json`.

**Producción** · verificado 2026-09-20 00:45 UTC en university.gaiaprime.com.mx: `temis-deploy.json` servido = `30ce513` (dirty 0); el
bundle servido `assets/forja-brep-CTdF1Iaw.js` trae `aviso-entrada`, «ENSAMBLE de» y el piso angular (`Math.max(Ee,.2)`); la
evidencia responde 200 (`resultados.json`, `ensamble-soltado.png`, `paseo-contactos.png`); el tablero servido dice
«LA ENTRADA · cerrado · en-vivo», 0 sin desplegar, 0 violaciones.
