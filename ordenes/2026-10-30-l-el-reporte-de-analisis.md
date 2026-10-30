# ORDEN L: EL REPORTE DE ANÁLISIS — llenado, empaque, enfriamiento, alabeo y contracción como los entrega la industria, con la pieza del volumen correcto

ESTADO: hoy
PRIORIDAD: 1

BASE: 90ee856 (el worktree nació en origin/main, divergente y sin trabajo propio: `git reset --hard main` antes de tocar nada)

OBJETIVO: ian (2026-10-30): «nuestro trabajo es darles TODO, no un PDF con medidas, sino videos y análisis de enfriamiento» y
«empecemos por entregar los documentos estándar, validaciones estándar». La industria entrega el análisis del molde como un
reporte por secciones (resumen, material, proceso, llenado, empaque, enfriamiento, alabeo/contracción, conclusiones), cada una con
su imagen, su número y su criterio. La Forja ya calcula todos esos números (FAN de la E5, lente de enfriamiento, Tait, criterios
del dictamen), pero no los entrega así. Y hay un bug que miente en el agua: **la E5 y la E6 reciben el volumen de la pieza de la
rejilla de la E4 (1.918 cc) en vez del sólido (55.8 cc)** — el calor y el caudal térmico de la E6 salen ~8× chicos (orden H lo
midió; `useMoldStudio.ts` ~L1463 `e5tuberia.volPiezaCc: partVolCc`).

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **El volumen correcto PRIMERO.** La E5/E6 usan el volumen del sólido (el mismo que la puerta y el dictamen). Mide ANTES y
   DESPUÉS en la 1594C Box: calor por ciclo, caudal térmico y bombeado, ⌀ y número de líneas de la E6, y el re-juicio ② de H
   (CLARO, PASO, CICLO). Si la geometría del agua cambia, cambian la huella y los dorados: lista cada uno con su razón (NO los
   re-grabes) y, si cambia un literal del cubo, ACTA R94.
2. **El reporte de análisis**, una sección más del expediente descargable (y su vista en el paso 9), con las secciones de arriba.
   Cada sección: una imagen de la app (el lienzo de la lente o de la estación que corresponde), el número de HOY contra su
   límite, la cita de Kazmer y lo que NO se calculó (dicho, no escondido: p. ej. alabeo sin mapa con empaque, venteo sin anatomía).
   Los números salen de la MISMA fuente que el dictamen ② (una verdad). Nada nuevo se inventa: si un número no existe en el motor,
   la sección lo dice.

## YA-EXISTE (prueba de ausencia)
- `ciclo.e5fan` (llenado), la lente ENFRIAMIENTO (`foco-lentes.ts`), `shrinkage.ts` (Tait), `warpage.ts`, el dictamen y su
  re-juicio (`revisar-modelo.ts`, `rejuzgarConElMolde`), el expediente (`expediente.ts`, `expedienteHTML` en ForgeBRepStudio.tsx).

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/expediente.ts
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada — si el reporte necesita su propio archivo, ENMIENDA con el porqué)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (la orden K trabaja EN PARALELO)
- expediente.ts: L = el reporte de análisis; K = láminas/BOM/STEP. ForgeBRepStudio.tsx: L = el reporte y su vista; K = la descarga
  del STEP. useMoldStudio.ts: solo L.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Tabla ANTES → DESPUÉS del volumen (1.918 → 55.8 cc) y todo lo que mueve, en la 1594C Box, medida en la app real.
- El reporte descargado de la 1594C Box: cada sección con su imagen, número, límite y cita; captura 4K de 3 secciones juzgada con
  Read. Par de control: una pieza sin molde enseña solo lo que existe y dice qué falta.
- `qa-banco.cjs` en tu copia: dorados y huella que cambian A PROPÓSITO, listados con razón. tsc sin errores nuevos; el cubo 270/270
  o ACTA R94.

## CIERRE (2026-10-30 · MEDIDO, no contado)

**Orden vs entregado.** Los dos cambios, uno a la vez, cada uno medido en la APP REAL (forja-dev5 :5196, GPU `ANGLE … D3D12
(NVIDIA GeForce RTX 4070 Ti)`, 1594C Box por PARED → ENFRIAMIENTO → LLENADO → D → PARTIR → MOLDE entero (8 pines) → D → EXPEDIENTE,
capturas 3840×2160 juzgadas con Read) con el arnés `mira-l.cjs` (reúsa mira-h/mira-g2: lee el DOM y `__qaForja`/`__forgeBrep`,
y lee la E4/E5/E6 MIENTRAS se arman).
1. **El volumen correcto** (`useMoldStudio.ts`, la E5): la pieza de TU STEP dimensiona la colada y el agua con el volumen de su
   SÓLIDO (`spec.volumeMm3` = occVolume, el mismo de la puerta y del dictamen); el cubo conserva su rejilla analítica (bit-igual,
   su E5 no trae `ciclo.pieza`). `e5tuberia` lleva además `volPiezaVoxE4Cc` (testigo) y `volPiezaFuente`. El aviso del re-juicio
   («su calor sale de 1.9 cc…») se queda como GUARDA y ya no sale. `estudio-molde-datos.ts`: sólo el comentario de `partVolCc`
   (decía «de los vóxeles de la E4»).
2. **El reporte de análisis** (`expediente.ts`: `reporteDeAnalisis` + `reporteDeAnalisisHTML`, PURO; `ForgeBRepStudio.tsx`: el
   álbum, el memo y la vista del paso 9 + la sección en el archivo). Ocho secciones como las entrega la industria — 1 Resumen ·
   2 Material · 3 Proceso · 4 Llenado · 5 Empaque · 6 Enfriamiento · 7 Alabeo y contracción · 8 Conclusiones —, cada una con:
   la imagen de la app, los renglones «qué · hoy · límite · estado · Kazmer · de dónde» y «Lo que NO se calculó». UNA VERDAD:
   cada renglón con veredicto ES un criterio del dictamen que juzga el molde (② en el acero; ① si no hay molde, y lo dice), tal
   cual (medido, límite, estado, cita, detalle); los renglones de DATO salen de los MISMOS objetos con que se re-juzga el ② (la
   E5: el FAN; la E6: calor, circuito, caudal; las lentes; el paquete ②) — el reporte no recalcula nada. **Las imágenes**: un
   ÁLBUM guarda el lienzo de la app cuando la vista ESTÁ en pantalla (`gl.render` + `drawImage` en la misma tarea, JPEG ≤ 1600 px):
   cada lente 1.8 s después de entrar (ENFRIAMIENTO en modo MAPA: en modo TIEMPO el reloj la pintaba crema parejo — MEDIDO en la
   primera captura —), el llenado de la E5 y el agua de la E6 al terminar su estación, el molde entero 2.5 s después del
   portamoldes. Lo que no se abrió no se finge: la sección dice qué abrir. Material y Conclusiones no tienen lienzo y lo dicen.

**Números, 1594C Box, app real. ANTES = main 90ee856 · DESPUÉS = esta rama.**
| qué | ANTES | DESPUÉS |
|---|---|---|
| volumen con que dimensionan la E5 y la E6 | **1.918 cc** (la rejilla de la E4) | **55.822 cc** (el sólido; la rejilla queda de testigo: 1.918) |
| E5 · V̇ de diseño del bebedero (§6.4.6) | 1.9 cc/s | 55.8 cc/s |
| E5 · el bebedero que corta | ⌀5.00→⌀8.62 × L 69.2 | **igual** (lo gobierna el taper: rBase = rTop + L·tan 1.5°, §6.3.1) |
| E5 · ΔP del sprue · γ̇ en la entrada | 3.3 MPa · 156 1/s | 10.8 MPa · 4,549 1/s |
| E5 · presión total (cavidad + alimentación) | 8.6 + 3.3 = 11.9 MPa ✓ | 8.6 + 10.8 = 19.4 MPa ✓ (de ~140) |
| E5 · regrind (Eq 6.6, ≤ 30 %) | **2.6 cc = 134.6 % ✗ VIOLA** | **2.6 cc = 4.6 % ✓** |
| E5 · anuncios de retorno | 2 («E3 la colada pesa demasiado» · «E9 la colada manda el ciclo») | 1 (E9) |
| E6 · masa del disparo → calor → potencia (Eq 9.10-9.11) | 7.3 g → 2.43 kJ → 16.8 W | **63.6 g → 21.17 kJ → 145.9 W** (t_c del circuito 145.1 s) |
| E6 · caudal TÉRMICO por línea (Eq 9.13) · Re | 0.008 GPM · Re 100 | **0.069 GPM · Re 871** |
| E6 · D_max turbulento (Eq 9.15) · ΔT real | 0.16 mm · 0.025 °C | 1.38 mm · 0.218 °C |
| E6 · caudal BOMBEADO (Re 4000) · total | 0.316 GPM/línea · 2.53 GPM | igual (sigue mandando la turbulencia) |
| E6 · geometría del agua (⌀6.35, 8 líneas, 16 tramos, H 15.85/23.65) | hash de tramos d3fef4d6 | **d3fef4d6 (igual)** |
| E7 · botadores | 8, hash 2264153b, F 3882 N | igual |
| re-juicio ② | 68/100 · ✗5 (DP, COLADA VS CICLO, PASO, CICLO, FREEZE) · ⚠12 | **igual** |
| ② `agua-diametro` | ⚠ «⌀6.35 > D_max 0.16 mm del caudal TÉRMICO (0.008 GPM) … · ⚠ su calor sale de 1.9 cc de pieza (la rejilla de la E4) contra 55.8 cc del sólido» | ⚠ «⌀6.35 > D_max 1.38 mm del caudal TÉRMICO (0.069 GPM) …», sin aviso |
| ② `agua-turbulento` | ✓ Re 4000 bombeado · «con el TÉRMICO serían Re 100» | ✓ igual · «Re 871» |
| ② `feed-dp` | ✗ 11.0 de 9.3 MPa · «⚠ la E5 lo dimensionó con 1.9 cc/s contra 59.3 cc/s…» | ✗ 11.0 de 9.3 MPa, sin aviso (55.8 vs 59.3: < 25 %) |
| ② CLARO · PASO · CICLO · FREEZE · COLADA | ⚠ 3.49/3.17 · ✗ 2.47·H · ✗ 41.0/64.7 s · ✗ 20.01/21.70 s · ✗ 75.8/21.7 s | igual |
| el reporte de análisis | no existe | 8 secciones · 6 con imagen de la app (Material y Conclusiones sin lienzo, dicho) · 74 renglones · archivo 752 KB con 9 imágenes |

**El reporte (1594C Box, con molde; lo que trae · lo que dice que falta).**
1. *Resumen* (§13 · §13.10): la pieza 66.0 × 107 × 33.3 mm · 55.8 cc · pared 3.20 · ABS; cold-2placas × 1 cav · P20; ② 68/100 ✗5
   (con sus nombres); ① 72/100 ✗4; el volumen que dimensiona colada y agua (55.8 cc, el sólido). Imagen: el molde entero. Falta:
   «no es una simulación 3D acoplada».
2. *Material* (Apéndice A p.390/392): la ficha (Cycolac MG47, ρ, cp/k/α, temperaturas, power-law + Cross-WLF, γ̇ máx,
   contracción del proveedor). Falta: el lote real; el FAN usa η newtoniana efectiva (Eq 5.22); el ABS conserva los números de los
   ejemplos del libro. Sin lienzo (dicho).
3. *Proceso* (§5.5 · §4.3.3): temperaturas de las ecuaciones del cap 9, t_llenado 1 s (convención del libro, dicho), p_fill 18.6
   (FAN), p_pack 50 (por defecto §5.5.3), t de empaque 21.7 s, ciclo cotizado 41.0 s (Eq 3.23), la máquina (FCS HT-150SV, cierre,
   disparo, abre 152.5), `llenado-tonelaje`, `layout-maquina`, `layout-shot-ventana`. Falta: perfil del husillo, V/P, empaque por
   etapas, ventana de proceso.
4. *Llenado* (cap 5-6-8): FAN 18.6 MPa · 1.00 s · llena completo; lente LLENADO 108 mm · L/t 33.8:1; techo, cola baja ⚠, velocidad,
   convergencia, área proyectada, DP ✗ 11.0/9.30, shear, Re, volumen, boquilla, venteo. Imágenes: la lente LLENADO + la E5.
   Falta: isotérmico (el N2 térmico no corre en tu pieza), soldaduras/aire no se calculan, venteo sin anatomía.
5. *Empaque* (cap 7): p_pack, t de empaque, FREEZE ✗ 20.0/21.7 s y los gate-*. Imagen: la E5 (la base del bebedero ES la
   compuerta, §7.2.1). Falta: solver de empaque punto a punto, rechupe sin mapa.
6. *Enfriamiento* (cap 9): pared 3.20 mm 21.5 s · lo más grueso 8.00 mm (4 lugares) 64.7 s (poste: barra Eq 9.6; placa 134 cota
   alta) · calor 63.6 g → 21.2 kJ → 146 W · el circuito · el caudal (térmico 0.069 / bombeado 0.32) · CICLO ✗ 41.0/64.7 · COLADA ✗
   75.8/21.7 · PASO ✗ 2.47·H · profundidad · diámetro ⚠ · turbulento · CLARO ⚠ 3.49/3.17 · controlador · conexiones · catálogo.
   Imágenes: la lente ENFRIAMIENTO en modo MAPA + el agua de la E6. Falta: el acero no se simula (núcleo↔cavidad), balance del libro
   y no transitorio.
7. *Alabeo y contracción* (cap 10): 0.58 % a 50 MPa · rango −0.25 a 2.54 % · ×1.00581; positiva, rango ⚠, steel-safe ⚠,
   responsable ⚠, topología 🔌; «el alabeo de tu pieza: no se calcula» (∅). Imagen: la lente PARED rotulada «la CAUSA, no un mapa
   de alabeo». Falta: Ec. 10.19 (empaque centro/orilla) y Ec. 10.17 (ΔT núcleo↔cavidad); contracción isotrópica.
8. *Conclusiones* (§13.10): los 5 ✗ con su decisión del expediente (DP y COLADA → «conflicto abierto en la alimentación», CICLO →
   «el ciclo lo fija lo más grueso», FREEZE → «el gate congela…»; PASO → «sin decisión: es un ajuste del diseño del molde»), los 12
   ⚠ con su cita, 6 de 8 decisiones por firmar. Sin lienzo (dicho).

**Par de control.** (a) node, `mide-l.cjs`: **10/10** — sano (② re-juzgado): 8 secciones, sin aviso, cada ✗ del ② en Conclusiones,
38 renglones con veredicto = su criterio del ② (0 distintos), sólo las imágenes del álbum; roto (sin molde, sin datos): juzga ①,
«falta el molde: … arma el MOLDE (paso 6)», 0 secciones con imagen y cada una dice qué abrir, la E6 «no existe todavía» (3
renglones, no se inventa), Conclusiones = los 4 ✗ de ①. (b) app: la misma pieza sin MOLDE → ver «Evidencia» (corrida
`control-sin-molde`).

**Dorados y huella.** La geometría del molde NO cambió (hash de los 16 tramos del agua d3fef4d6 y de los 8 pines 2264153b
iguales ANTES/DESPUÉS); los dorados leen E2/E8/E10/Foco/① (ninguno lee el calor, el caudal térmico ni el regrind de la E5).
Esperado: **ninguno cambia**. El banco: ver «Evidencia».

**ACTA: no aplica.** El cubo **270/270** sin tocar un literal (su E5 conserva la rejilla analítica). tsc: **58 = los 58 de la
línea base** (`comm -13` vacío).

**Visto, no es de esta orden (no lo arreglé).**
- **La E4 llena 1.7 mm de la pieza.** El 1.918 cc venía de AHÍ: la caja del campo de la E4 (`useMoldStudio.ts`, `cicloEstacion4`)
  asume la pieza en z_local 0..H (el cubo); la carcasa vive en z_local −33.31..0.03 y con el volteo queda ARRIBA de `tz`. MEDIDO:
  rejilla z 154.2–191.2 contra la pieza z 189.5–222.8 → 1.7 mm de traslape, 1,918 vóxeles. El llenado de la E4 (su frente pintado,
  su L máx, su «última zona») mide esa losa. El arreglo son 2 líneas (la caja desde `zBaseCerradaMm`, y la semilla a media pared
  de la base), pero cambia la estación 4 y su video: pregunta 1 para ian. El reporte NO usa la E4: el llenado sale del FAN de la E5
  (campo conjunto, volumen bien) y de la lente LLENADO.
- La E6 calcula su potencia con t_c 145.1 s (la colada del diseño numérico — «dos coladas», visto por H): el reporte lo rotula.
- La E6 bombea a Re 4000 aunque el calor real ahora pide 0.069 GPM: el ⌀6.35 sigue fuera de la ventana térmica (D_max 1.38).

**Evidencia** (iangpu `/home/ian/el-plan-dev5/l/`): `antes/`, `antes2/` (ANTES: 02 molde, 03 dictamen ②, 04-agua-diametro y
04-feed-dp abiertos, `numeros.json` con la E4/E5/E6 leídas mientras se arman) · `despues1/` (cambio 1: mismas capturas y
números) · `despues3/` (cambio 2, el código final: 10 expediente, 11-reporte-seccion-<8 secciones> en la app, 20-archivo-<llenado ·
enfriamiento · conclusiones> = el HTML DESCARGADO abierto como lo abre la planta, `expediente.html`, `numeros.json`) ·
`despues2/` (la primera vuelta del reporte: la lente ENFRIAMIENTO salía crema — el defecto que corrigió el modo MAPA) ·
`control-node.json` + `control-node.log` (10/10) · `control-sin-molde/` · `cubo.log` (270/270) · arneses `mira-l.cjs`, `mide-l.cjs` ·
banco `/home/ian/el-plan-dev5/qa/l/`.

**Archivos tocados (para la fusión).**
- `src/forja/brep/useMoldStudio.ts` — el tipo de `e5tuberia` (+2 campos), la E5 (`partVolCc` del sólido, testigo de la rejilla), el
  comentario del aviso del re-juicio. Sólo región L.
- `src/forja/mold/estudio-molde-datos.ts` — el comentario `@param partVolCc` de `estacion5Dado`.
- `src/forja/mold/expediente.ts` — 3 imports nuevos (línea aparte, tras los existentes) y el bloque «EL REPORTE DE ANÁLISIS» al
  FINAL del archivo. No toqué decisiones, costo ni nada de láminas/BOM/STEP (región K).
- `src/forja/brep/ForgeBRepStudio.tsx` — 1 import (línea aparte, tras la de expediente), el álbum + `reporte` (antes del memo del
  expediente), `reporte` en la llamada y en las deps del memo del expediente, `<ReporteDeAnalisisVista>` dentro del overlay del
  expediente (después del texto «Tu expediente…»), el parámetro `reporte` de `expedienteHTML` y UNA línea en su cuerpo (tras
  «1 · Dictamen»), y `ReporteDeAnalisisVista` + sus colores antes de `expedienteHTML`. No toqué la barra de botones del expediente
  (la descarga del STEP es de K). RIESGO DE FUSIÓN con K: la firma de `expedienteHTML` y la llamada del memo (si K les agrega un
  parámetro, se suman los dos).

**Preguntas para ian.**
1. *El llenado de la estación 4 mira sólo el piso de tu caja.* Cuando la máquina enseña por dónde entra y dónde termina el plástico
   (la estación 4), la rejilla con que lo mide está corrida: de los 33 mm de alto de la carcasa sólo ve 1.7 mm del fondo. Hoy ve
   1.9 cc de plástico contra 55.8 cc que tiene la pieza (3 %). Ya nada de lo que se decide usa ese número (la colada, el agua y el
   reporte usan el sólido y el llenado de la estación 5), pero el dibujito de la estación 4 y su «última zona en llenarse» son de esa
   losa. ¿Lo corrijo (dos líneas, cambia el video de la estación 4)? **Recomiendo sí**, en una orden chica, con el video de antes y
   después.
2. *El agua ahora sabe cuánto calor saca, y le sobra caudal.* Con el volumen bien, cada disparo trae 21 kJ y el molde tiene que sacar
   146 W (antes creía 17 W). Aun así el agua que bombea la máquina (0.32 GPM por línea, para que corra turbulenta) es 4.6 veces la
   que pide el calor (0.069). No cambia ningún veredicto. ¿Lo dejamos así (turbulencia primero) o le enseñamos al cliente las dos
   cifras en la ficha de su controlador? **Recomiendo** dejarlo y enseñarlas: ya salen en el reporte (sección 6).
3. *El reporte dice qué falta, y lo que más falta es el alabeo.* De las 8 secciones, la de alabeo dice «no se calcula»: para tener
   ese número hace falta simular el empaque punto por punto y la temperatura del acero. ¿Lo dejamos dicho en v1 (como está) o lo
   ponemos en el plan de después? **Recomiendo** dejarlo dicho en v1 y no prometerlo a las plantas hasta tener el solver de empaque.
