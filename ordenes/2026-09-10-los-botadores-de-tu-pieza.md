# ORDEN: LOS BOTADORES DE TU PIEZA — los expulsores (E10) sobre la pieza soltada; el paso 6 deja de estar a medias

ESTADO: cerrado
PRIORIDAD: 4

BASE: 8922aa6

OBJETIVO: ian (2026-09-10): «no veo los botadores». Los expulsores son la estación 10 y solo existen para el cubo
(`estacion10Dado`). Al final de esta orden los pines §11 (⌀ por catálogo, colocados por agarre §11.2.5 como ya
hace `revisarModelo` para el dictamen) se dibujan en la placa expulsora del molde de la pieza soltada, con su
carrera, y el paso 6 del camino queda COMPLETO en su promesa original (placas, colada, agua, expulsores).

## YA-EXISTE (prueba de ausencia)
- `revisarModelo` ya coloca pines por agarre (§11.2.5, Fig 11.11) para medir el ensamble — los puntos existen.
- `estacion10Dado`/`cicloEstacion10` dibujan los expulsores del CUBO; la lámina «Placa expulsora» ya los dibuja
  para la carcasa (22 pines ⌀10 en el BOM).
- NO existe: E10 para `ciclo.pieza`; el runner tiene el check «expulsores» en el paso 6 (hoy ✗).
## TOCA (confirmado 2026-09-17)
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json
## CREA
- public/evidencia/2026-09-10-los-botadores-de-tu-pieza/resultados.json
- public/evidencia/2026-09-10-los-botadores-de-tu-pieza/botadores-en-el-molde.png
- public/evidencia/2026-09-10-los-botadores-de-tu-pieza/paseo-contactos.png
## BORRA
- (nada)

## PREEXISTENTE
(la otra sesión trabaja en el mismo árbol; git status al abrir, 2026-09-17)
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
(llegaron de la otra sesión durante la orden, 2026-09-17 20:50)
- docs/QUE-EXCITA-EL-OJO.md
- public/precomputed/economia-presa.json
- scripts/precompute-presa.py
- src/cinematic/CinematicMolecule.tsx
- videos/econ-guardadito.json

## LO QUE SE MIDIÓ AL ABRIR (2026-09-17, node + kernel, laptop)
- `estacion10Dado` trae los mismos vicios que tenía el agua: `effectiveArea({h: 0.002, L: 0.040, W: 0.040})`
  (pared 2, huella 40×40), `wallMm = 2`, draft 1.5° a mano, `semi = 19` y las 8 posiciones escritas a mano
  (4 esquinas + 4 medios con el ±12 del carril del baffle), y las salidas de venteo de la E7 del cubo a ±33.5.
- Con los números de LA CARCASA (perímetro 2·(66.02+106.52), pared 3.2, draft EXTERIOR medido 3.606°):
  Aeff 1104 mm², **F_eject 3883 N** — el motor del paquete dice 3892 (Δ 0.2 %: mismas Eqs, cuadran). El ciclo
  R34→R46: 4 pines → ⌀4.763 > pared ✗ (R34 punto caliente) → **8 pines → catálogo ⌀2.381 ≤ 3.2 ✓**.
- **Agarre §11.2.5** (`gripEjectorLayout` sobre la malla real, pared 3.2): 360 columnas de pared, 356 candidatos,
  8 colocados en 52 ms; los 8 empujan sobre material del PISO INTERIOR junto a las paredes (8/8 en z_min+½pared,
  0/8 en la boca) — los pines suben por el macho. Volteados a la base caen dentro de la huella (x 199..247 de
  190..256; y 234.8..313.2 de 219.7..326.3). **Juez contra el agua de la E6: cero conflictos, peor claro 10.51 mm**
  (pin (199,307.2) ↔ B-linea0).
- El paquete dice `ejectors: pin × 19 · ⌀10` (la orden decía 22; MEDIDO: 19). Con ⌀10 el agarre solo puede
  colocar 5 (keepOut 16.1 mm). Eso es lo que hoy dibuja la lámina «Placa expulsora» — otra vez «dos cosas».
- La animación YA EXISTE y es genérica (`MoldOpenDriver` con `ejectPrefixes=['pin-']`, la colada y la pieza
  viajan con la expulsión; `btn-ciclo-play` → `cicloPlayToggle`, 14 s: llenar · abrir · expulsar · retraer · cerrar).
  Sus dos números están clavados al cubo: `openMm 100` y `ejectMm 48`, que son exactamente **2.5·H** (§6.3.2) y
  **H + 8** (cap 11) con H = 40. Para la carcasa (H 33.34): 83.4 y 41.3.
- Hallazgo propio: en EL AGUA DE TU PIEZA los tapones y O-rings salieron SIN su lado en el rol (`agua-tapon-k`)
  y el conductor de la apertura enruta por prefijo `agua-tapon-A-`: al abrir, los tapones del anillo A se
  quedarían flotando. Se corrige aquí (los 6 primeros tapones y los 2 primeros sellos son del lado A).

## EVIDENCIA (se declara ANTES de trabajar)
- Paso 6: el check `expulsores` del RUNNER pasa; con agua y expulsores el paso 6 sale «ok» y el camino 8/8 en su
  forma de hoy (dicho: el enfriamiento en el tiempo va en el paso 3).
- Los pines coinciden con los de la lámina «Placa expulsora» (misma fuente) y no atraviesan agua ni insertos.
- Paseo con los botadores visibles; video en ambas PCs; orden-gate VERDE.
- LA ANIMACIÓN (ian 2026-09-17: «la animación de los botadores»): al terminar la estación de los expulsores el
  ciclo arranca solo (llenar · abrir · expulsar) y el runner lo MIDE: `cambio(1000) ≥ 0.02` y
  `animZ('pin-punta-0')` > 5 mm en algún cuadro; las carreras salen de la altura de la pieza (2.5·H y H+8).
## CIERRE (2026-09-18 · MEDIDO, no contado)

**EL CAMINO DE LA CARCASA DIO 8/8.** `runner · 2026-09-18 02:54 UTC · 8/8 ok · 1:2/2 2:5/5 3:6/6 4:4/4 5:3/3
6:13/13 7:5/5 8:4/4` con la máquina sola. El paso 6 cerró su promesa original completa — placas · colada (58.2 s,
dentro de 60) · agua · **expulsores** — y además el molde TRABAJA: `cambio(1000)` = 42.5 % de píxeles cambiando por
segundo y `animZ('pin-punta-0')` = **41.3 mm de carrera vista** (= H + 8 = 41.34: la carrera entera). Telemetría:
E2 3.1 + E3 21.6 + E4 0.8 + E5 79.8 + E6 2.4 + **E7 (botadores) 3.2 s**.

**Lo que se entregó**
- Estación 7 del molde de TU pieza = LOS BOTADORES (`cicloBotadoresPieza`), encadenada tras el agua. La fuerza sale
  de TU perímetro, TU pared y TU draft MEDIDO por la E3 (Eq 11.7-11.8 → **3883 N**; el motor del paquete: 3892, Δ 0.2 %).
  El ciclo R34→R46 con la pared 3.2: 4 pines piden ⌀4.763 > pared (punto caliente) → **8 pines ⌀2.381** ✓; recto
  PANDEA (SF 0.16) → escalonado punta ⌀2.381×50 + cuerpo ⌀4.763, SF 9.7. Juez contra el agua REAL de la E6: cero
  conflictos, peor claro 10.51 mm.
- Los pines se colocan donde la pieza AGARRA al macho (§11.2.5, `gripEjectorLayout` sobre la malla en su marco LOCAL,
  volteados a la base): 360 columnas de pared, 356 candidatos, 8 colocados; los 8 empujan sobre material del piso
  interior (8/8) y la punta termina en `zBaseCerrada − pared` = 189.64.
- **LA ANIMACIÓN** (ian: «la animación de los botadores»): al terminar la estación el ciclo arranca solo (llenar ·
  abrir · expulsar · retraer · cerrar) con las carreras de TU pieza — apertura 2.5·H = 83.4 (§6.3.2), expulsión
  H + 8 = 41.3 (cap 11); el cubo sigue dando sus 100 y 48. El ciclo se APAGA al salir de la lente MOLDE o al abrir
  los planos: medido en el paseo, con el rAF corriendo de fondo cada check del runner pasaba de 2–9 ms a 1.5–2.5 s.
- La lámina de ENSAMBLE dice lo mismo que el 3D: «Expulsión 8× pin ⌀2.381 (§11.3)», BOM «8 · 1.2842 templado» — la
  lámina lee los pines de la E7 (`aspec.ejectors.positions` relativas al eje), no la rejilla del paquete (19 × ⌀10,
  con la que el agarre solo podía colocar 5).
- La tira ya dice `✓ expulsores` (estaba clavada en ✗) y el curso «paso 7/7» (decía «7/6»).
- El cubo NO se movió: `ciclo-dado-test` **266/266**, único renglón distinto contra la corrida del agua = un reloj.
  (Una corrida con la laptop cargada dio 265: falló SOLO el reloj «LENTE ≤2.5 s» — 3.56 s; no es del código.)

**Hallazgos de paso, corregidos aquí**
- Los tapones y O-rings del agua salieron de EL AGUA DE TU PIEZA sin su lado en el rol (`agua-tapon-k`) y el conductor
  de la apertura enruta por prefijo `agua-tapon-A-`: al abrir, los del anillo A se habrían quedado flotando. Ahora
  llevan su lado (6 primeros tapones y 2 primeros sellos son de A).
- El paquete decía «19 pines ⌀10» para la carcasa (la orden decía 22): con ese ⌀ el agarre solo coloca 5. Otra «dos
  cosas» entre lámina y 3D, resuelta para los pines (la del agua sigue en EL AGUA DICE DOS COSAS).

**Lo que se dice y NO se esconde**
- El video del paseo dura **9:45** (el del agua, 4:22): grabar carga la máquina y todo se estira — la colada tardó
  67 s en el paseo contra 58 con la máquina sola; el paso 3 (ajeno a esta orden) 23 s contra 1. La medición vale
  con la máquina sola; el paseo es la película a velocidad real, no la medida.
- La colada roza el presupuesto de 60 s (58.2 s sola; 62.3 s con carga): es EL FAN EN SU CARRIL, no esta orden.
- La escala del ENFRIAMIENTO sigue atenuada encima del molde con su reloj corriendo (decisión del ticket del reloj;
  a juicio de ian).
- Las salidas de venteo de la E7 del cubo (±33.5) NO se juzgan para la pieza: la pieza aún no tiene E7 y se dice.

- **La máquina de medir tenía un juego corriendo.** Las re-mediciones de 03:17 y 03:27 UTC dieron 4/8 y 6/8 con
  E5 en 110 s (vs 79.8) y hasta la lente del paso 3 fuera de tiempo; desde WSL la carga era 0.4. En el host Windows:
  Horizon Forbidden West (16 000 s de CPU, 5.5 GB) y Cuphead, CPU 51 %, GPU en P3. No se tocaron (no son míos; ian
  no está en casa). El camino queda con la ÚLTIMA corrida del runner (6/8, relojes) y la corrida limpia de 02:54
  (8/8) anotada; se re-sella cuando la máquina esté sola.
- El runner toma « · » como separador de columnas en `## PASOS`: una descripción con « · » adentro le movió el estado
  («llenar · abrir · expulsar» → «llenar · parcial · expulsar»). Corregido con comas.

**Evidencia**: `public/evidencia/2026-09-10-los-botadores-de-tu-pieza/` (resultados.json con fuerza, ciclo de
decisión, pines, agarre y juez; botadores-en-el-molde.png = el molde ABIERTO con la pieza sobre los pines;
paseo-contactos.png) · video **32-LOS-BOTADORES-DE-TU-PIEZA-paseo.mp4** (9:45) en Downloads de las dos PCs y en
E:\forja-videos · orden-gate VERDE.
