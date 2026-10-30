# ORDEN J: EL EXPEDIENTE LIMPIO — lo que la planta descarga no trae errores que un herramentista caza en cinco minutos

ESTADO: hoy
PRIORIDAD: 2

BASE: 6655fdd

OBJETIVO: el expediente (láminas, BOM, sólidos del molde) es lo que la planta se lleva. Hoy trae cuatro errores MEDIDOS por las
órdenes de la semana 1, que un herramentista ve en minutos y nos quitan la confianza del cliente:
1. **Los barrenos de los botadores de la máquina fuera de la placa**: lámina 12 (placa expulsora de 116 mm de ancho), barrenos KO ⌀20
   en X = −2 y X = 118 — fuera de la placa (lo cazó el revisor Fable, orden E).
2. **Los pilares no existen en el papel**: los 3 pilares de soporte (orden B: z 36→132, bajo la cavidad) no tienen renglón en la BOM
   ni posición acotada en ninguna lámina.
3. **Los tornillos del lado NÚCLEO salen al revés**: volumen con signo −12,175.78 mm³ contra +14,578.96 del lado cavidad (orden D): la
   malla está espejada/invertida. Un STL así no se imprime ni se mide bien.
4. **La hoja de análisis**: el valor largo de la máquina se encima con la columna REF/§ (orden B la vio; puede que A la haya
   arreglado: mide primero, y si ya no pasa, dilo y sigue).
5. **La guía**: ⌀16 en el estudio contra ⌀25 en la lámina (hallazgo verificado del debate, `00-PLAN.md`). Mide si sigue; si sigue,
   UN número (el que dice el catálogo del portamoldes que usamos) en estudio, lámina y BOM.
Al terminar: los cinco medidos ANTES → DESPUÉS, y ninguno vuelve (una prueba que lo mida, dentro de lo que ya existe en `scripts/`).

## YA-EXISTE (prueba de ausencia)
- Láminas: `src/forja/mold/mold-drawing-set.ts` (obstáculos = expulsores + pilares + KO + tornillos, ~L393-415) y `mold-drawings.ts`
  (BOM: `type: 'eyector' | 'pilar' | 'tornillo M10' | …` L19; filas extra fuera del corte ~L376).
- La geometría del molde: `__forgeBrep.moldGeom()`; la huella (`scripts/qa-huella.cjs`) ya lee el volumen con signo por cuerpo.
- El revisor (orden E): `scripts/revisor/RUBRICA.md` y `.claude/skills/revisor-forja/` — su REVISION de la 1594C Box está en
  `/mnt/c/Users/sebas/Downloads/revisiones/` (léela: ahí están los KO).

## TOCA
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-drawings.ts
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/qa-huella.cjs
- src/forja/mold/mold-threads.ts
- src/forja/mold/mold-heads.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/mold-assembly.ts
- src/forja/mold/moldbase.ts
- src/forja/mold/estudio-molde-datos.ts
- scripts/mold-assembly-test.cjs
(los 7 últimos entran por las ENMIENDAS 1–4 del 2026-10-29, más abajo)

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (otras órdenes trabajan EN PARALELO)
- ForgeBRepStudio.tsx: J = SOLO la maquetación de la hoja de análisis (ancho de columnas) y, si el error de los tornillos nace ahí,
  la región que arma esos cuerpos. H cambia los VALORES de la hoja; I el paso 7. Si el origen de los tornillos invertidos está en
  otro archivo (p. ej. el generador de tornillería), ENMIENDA esta orden con el archivo y el porqué.
- `scripts/qa-huella.cjs`: J solo agrega la verificación «ningún cuerpo con volumen negativo» (con su par de control); no cambies el
  hash ni el control de la huella.

## ENMIENDA 2026-10-29 (medido ANTES de tocar; los archivos entran al TOCA de arriba)
1. **Los tornillos NO nacen en ForgeBRepStudio.tsx: nacen en el generador de mallas.** Medido en node con el armado LITERAL de
   `mold-plano-set.ts` (`mide-perno.cjs`): `headMesh` (mold-heads.ts), `plainShaftMesh` y `threadSurfaceMesh` (mold-threads.ts)
   tejen sus caras LATERALES hacia el eje (112 / 48 / 374 caras adentro, 0 afuera) y ninguna pieza cierra (28 / 48 / 52
   aristas sueltas; el perno armado 128). El «volumen» de una malla así depende de DÓNDE esté: el mismo perno da +3,644.73 mm³
   con la cabeza en z=292 (cavidad) y −3,043.94 en z=0 (núcleo) → ×4 = +14,578.96 y −12,175.78, los números exactos de la
   orden D. No está espejado: AMBOS lados mienten (lo físico es ≈ 2,850 y ≈ 4,720 por perno). Entran mold-threads.ts y
   mold-heads.ts (caras hacia afuera + tapas que cierran) y mold-plano-set.ts (una línea: el chaflán ISO 4753 del hilo iba en
   el cuello y no en la punta).
2. **Los pilares no pueden llegar al papel sin mover su colocador.** `supportPillarPositions` vive en mold-plano-set.ts, que
   importa mold-drawing-set.ts: el papel no la podía leer sin import circular. Se MUDA a mold-drawing-set.ts (geometría de
   referencia, como `returnPinLayout`) y mold-plano-set.ts la RE-EXPORTA. La BOM la arma `moldAssemblyDrawing`
   (mold-assembly.ts): recibe los renglones de lo que el corte A-A no ve (pilares, postes y bujes guía).
3. **La guía ⌀16 nace en `selectMoldBase` (moldbase.ts) y se imprime desde estudio-molde-datos.ts.** El ⌀16 es el tamaño de
   la RESERVA (envolvente/12), reportado como `leaderPinDia`; la base se barrena a ⌀25 (tabla tecleada en `standardHoles`).
   Una fuente (`guiaNominalMm`) en moldbase.ts; el texto del estudio dice la reserva y la guía por separado. El catálogo del
   proveedor de la base NO está en el repo (moldbase.ts: «NÚMEROS DE PIEZA … PENDIENTES»): se queda el ⌀ que se BARRENA, como
   regla de Hefestos, y la pregunta va a ian.
4. **«Ninguno vuelve» necesita una prueba de láminas y qa-huella solo puede llevar la del volumen** (REGIONES). La prueba
   existente que arma láminas de molde en node es `scripts/mold-assembly-test.cjs`: se le agregan 6 checks `J_*` (KO dentro
   de la expulsora + el control del patrón viejo que SÍ caía fuera, pilares en BOM y en las 4 láminas, una guía en A/B/BOM,
   la hoja dentro del marco y partiendo lo largo). El juez fino de la hoja (getBBox) solo existe en el navegador.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Tabla ANTES → DESPUÉS en la 1594C Box: KO (X de cada barreno contra el ancho de la placa), pilares (renglón BOM + cota en lámina),
  volumen con signo de cada cuerpo de tornillería (todos > 0), hoja (captura), guía (⌀ en estudio = lámina = BOM).
- Captura 4K de la lámina 12, de la lámina con los pilares y de la BOM, juzgadas con Read.
- Par de control de la verificación nueva en qa-huella: un cuerpo invertido a propósito → ROJO; la Box arreglada → VERDE.
- La huella ×3 estable (el hash PUEDE cambiar si cambia la geometría: dilo y por qué); tsc sin errores nuevos; el cubo 266/266 o ACTA R94.

## CIERRE (2026-10-29 · MEDIDO, no contado)

**Orden vs entregado.** Los cinco, medidos en la APP REAL (forja-dev7 :5198, GPU `ANGLE … D3D12 (NVIDIA GeForce RTX 4070 Ti)`,
1594C Box por el camino hasta el portamoldes, las 17 láminas abiertas una por una) ANTES de tocar y DESPUÉS, con el medidor
`mide-expediente.cjs` (barreno contra el contorno de SU placa en el SVG; textos de un renglón que se enciman con `getBBox`;
volumen con signo y aristas sueltas por cuerpo; ⌀ de la guía en estudio/lámina/BOM/3D). Un cambio a la vez: etapa A
(tornillos) → B (+KO) → C (+hoja, pilares, guía) → C2 (rótulos cortos, números concéntricos, marco) → el arreglo del Foco.
Ninguno de los cinco lo había arreglado la semana 1 (la hoja seguía encimada: la orden A no la tocó).

**Los cinco, ANTES → DESPUÉS (1594C Box).**
| # | qué | ANTES (6655fdd = main) | DESPUÉS |
|---|---|---|---|
| 1 | KO en la placa expulsora (lámina 12, placa de 116 mm) | X = −2.00 y 118.00 (⌀20): **2 de 14 barrenos fuera**, 12 mm de cada uno en el aire | X = **20.00 y 96.00**: 0 fuera, 10 mm de acero a cada canto (½⌀, regla de Hefestos); soporte y sujeción inferior 63/183 → **85/161**, el mismo eje |
| 2 | pilares de soporte en el papel | 0 renglones de BOM · 0 láminas (y la expulsora/retenedora SIN el barreno por donde suben) | BOM **13 · «Pilar de soporte ⌀40 × 96» · 3 · 1.1730 (C45)**; posición acotada en soporte y sujeción inferior (apoyo punteado: 123/123, 79/74, 79/172) y holgura ⌀41 pasante en retenedora y expulsora |
| 3 | volumen con signo de la tornillería | cavidad **+14,578.96** · núcleo **−12,175.78** mm³ · 504 aristas sueltas c/u | cavidad **+11,419.28** · núcleo **+18,899.37** · **0** aristas sueltas · 0 no-variedad |
| 4 | hoja de análisis | **12 renglones encimados** (máx 228 mm, la tabla de eyectores) + 1 texto fuera de la hoja (x 441.5 > 415) | **0 · 0**; la tabla ocupa el ancho útil (397 mm, dentro del marco) y parte las celdas largas |
| 5 | la guía | estudio **⌀16** («pilares ⌀16 + holgura») · lámina A y B «pilar guía ⌀25 PASANTE» · BOM — · 3D poste ⌀24.4 | estudio **⌀25** «(la que se barrena)» · lámina A: asiento del buje **⌀33.4** + brida ⌀37.4×6 · lámina B: poste **⌀25** + hombro ⌀31.4×6.5 (lo que el sólido corta) · BOM **«Poste guía ⌀25 × 93.8» ×4** y **«Buje guía ⌀25 (OD 33)» ×4** · 3D igual |

**La causa raíz de los tornillos «al revés».** No estaban espejados: las tres mallas que arman un perno (`headMesh`,
`plainShaftMesh`, `threadSurfaceMesh`) tejían sus caras LATERALES hacia el eje (112 / 48 / 374 caras adentro, 0 afuera), la
cara de apoyo de la cabeza salía mitad arriba y mitad abajo, y ninguna pieza cerraba (28 / 48 / 52 aristas sueltas). Con una
malla así el «volumen» depende de DÓNDE está el perno: medido en node con el armado literal, el MISMO perno da +3,644.73 mm³
con la cabeza a z=292 (cavidad) y −3,043.94 a z=0 (núcleo) → ×4 = los +14,578.96 y −12,175.78 exactos. Los dos lados mentían.
Arreglo: caras hacia afuera y tapas que cierran (la del hilo, en abanico al anillo REAL del extremo), y el chaflán ISO 4753
del hilo en la PUNTA (estaba en el cuello). Perno M6: 2,854.82 / 4,724.84 mm³ (la cota física sin Allen ni hilo: ≈3,016 / 4,907).
**Un efecto que el primer arreglo metió y se cazó:** con un vértice al centro, la cabeza y la caña se tocaban en un punto y el
perno quedaba como UN cuerpo; el Foco ajusta un cilindro por cuerpo con su caja y le daba al perno entero el radio de la
cabeza → apareció una FALLA falsa «2.50 mm entre B-linea0 y el tornillo 1» (dorado `holguraAguaMinMm` 3.49 → 2.5, rojo). Las
tapas de cabeza y caña ya no llevan vértice en el eje: el Foco ve cabeza r 5 (z 0..6) y caña+hilo r 3 (z 6..162.9) — la
geometría verdadera (antes: cabeza+caña como r 5 hasta z 154).

**Par de control de la verificación nueva de qa-huella (VOLUMEN_GATE, fuera del hash).** En la Box arreglada:
`VOLUMEN_GATE: VERDE · 0 cuerpos con volumen < 0 (75/75/75)`; el MISMO tornillo del núcleo con los triángulos al revés en la
misma página → `PAR_DE_CONTROL_VOLUMEN: MUERDE · vol −18,899.37`. Y el juez sobre la corrida de main (857ac2b5, semana 1):
**ROJO · tornillos-core −12,175.78** (1 de 75). El hash y el control de la huella no se tocaron: con este qa-huella, en el
build anterior (dabad13d…), `PAR_DE_CONTROL: MUERDE` (pared 2.8, 24 diferencias) y `REGRESION_CARRERA: VERDE`.

**La huella cambia, y por qué.** main 857ac2b532fc5140 (acero ba09ea8a…) → con el primer arreglo del perno, **×3 VERDE
dabad13d4e1d294d** (acero e63cd8ca…, build de producción :4270, + control) → el src definitivo solo cambia cómo se tejen las
tapas de cabeza y caña: acero **d66f26f4e24aa7e8** (C2, una corrida; tornillos con los mismos volúmenes, 12,520 triángulos).
Su huella ×3 (`huella-J2/`) quedó en la cola del GPU detrás de la filmación de la orden I: ver ADENDA abajo. Lo que se movió
contra main es el acero que la orden mueve, nada más (14 diferencias, todas leídas): los dos cuerpos de tornillería
(triángulos y volumen) y la placa expulsora (los KO ahora caen dentro: 647,951.8 → 637,362.86 mm³); soporte y sujeción
inferior conservan volumen (sus KO solo se corren); la leyenda suma esos triángulos. El papel (hoja, pilares, guía) no mueve
el acero (B y C dan el mismo e63cd8ca…). Con el primer arreglo el Foco cambió (78 → 70 cilindros, la falla falsa de 2.50);
con el definitivo el perno vuelve a ser dos cilindros verdaderos.

**Evidencia (iangpu, rutas).** `/home/ian/el-plan-dev7/j/`: `antes/`, `A-tornillos/`, `B-ko/`, `C-todo/`, `C2/` (cada una
`resumen.json`, `medida.json`, láminas 4K `lamina-NN.jpg`; A y C traen `tornillos-3d.jpg` y `tornillo-nucleo-cerca.jpg`),
`mide-expediente.cjs`, `mide-perno.cjs`, `mide-cuerpos.cjs`, `cubo-final3.log`. Huella: `/home/ian/el-plan-dev7/qa/huella-J/`
(×3 + control) y `huella-J2/` (×3 del src definitivo). Capturas juzgadas con Read: lámina 12 antes/B/C, hoja antes/C, BOM C,
soporte C, placa A C2, tornillos 3D A.

**Pruebas.** El cubo **270/270** (sin ACTA: ningún literal se movió) · tsc 65 errores contra 67 de la base, **0 nuevos** (dos
viejos de mold-drawing-set.ts desaparecen: el tipo de la tupla de las guías) · mold-threads, mold-heads, mold-drawings,
mold-assembly en verde · `mold-assembly-test.cjs` trae 6 checks `J_*` nuevos (base 6655fdd: FATAL, no pasa; final: verdes).
`node scripts/orden-gate.cjs` → VERDE.

**Visto, de otras órdenes o para después (no lo toqué).**
- **Los pilares muerden el canto de la placa expulsora**: 2 de los 3 (⌀40 en x = 79 de la base) cortan una muesca de 6.5 mm
  en el canto de la expulsora y de la retenedora (el 3D ya la cortaba; ahora la lámina lo DICE: «holgura del pilar ⌀41» en
  X = 14 de una placa que empieza en 0). `supportPillarPositions` filtra x ≥ 75 (centro) y no mira la placa expulsora. → pregunta.
- **El buje de la guía queda a 3.3 mm del inserto** (asiento ⌀33.4 en x=37 hasta 53.7; el inserto empieza en 57). §4.3.2 pide
  ½⌀ del componente (12.5 con la guía ⌀25). → pregunta (es la otra cara del ⌀16 vs ⌀25).
- La columna TIPO de la tabla de barrenos se sale de la hoja en la retenedora (16 textos) y la expulsora (8): rótulos largos
  de los pasajes de pin. Mismo mal que la hoja, otra tabla.
- Las láminas de A y B no traen las hembras/asientos de los interlocks que el sólido sí corta; la sección A-A no dibuja el
  pilar central que el plano medio corta; dos globos del ensamble (5 y 8) se tocan.

**Archivos (para la fusión).** `src/forja/mold/mold-drawing-set.ts` (hoja: `ANCHO_ARIAL`/`anchoTexto`/`partirTexto` +
`analysisSheet`; `PILAR_SOPORTE_DIA_MM` + `supportPillarPositions` mudada aquí; `koLayout`; guías en `standardHoles`;
`moldDrawingSet`: piezas de la BOM y pilares en las láminas) · `src/forja/mold/mold-drawings.ts` (`PlateHole.apoyo`, números
de barrenos concéntricos) · `src/forja/mold/mold-assembly.ts` (`moldAssemblyDrawing(s, { piezas })`) ·
`src/forja/mold/mold-threads.ts` y `mold-heads.ts` (caras y tapas) · `src/forja/mold/mold-plano-set.ts` (re-export de
`supportPillarPositions`, la constante del pilar, el chaflán en la punta) · `src/forja/mold/moldbase.ts` (`guiaNominalMm`,
`leaderPinDia`) · `src/forja/mold/estudio-molde-datos.ts` (1 texto) · `scripts/qa-huella.cjs` (VOLUMEN_GATE + su control) ·
`scripts/mold-assembly-test.cjs` (checks J). `ForgeBRepStudio.tsx` estaba en TOCA y NO se tocó: la hoja es la lámina SVG de
mold-drawing-set.ts y los tornillos nacen en el generador. Riesgo de fusión: H cambia VALORES de la hoja (filas de
`analysisRows`), J su maquetación (`analysisSheet`) — no se pisan; el dorado `holguraAguaMinMm` debe salir igual (3.49).

**Preguntas para ian.**
1. *Dónde empuja la máquina.* El vástago de la inyectora sube por la placa de abajo y empuja la placa expulsora; si el barreno no
   cae en esa placa, el vástago empuja aire junto al riel y los botadores no suben. Hoy los dos vástagos caen a 38 mm del centro
   con 10 mm de acero a cada lado (antes 12 mm fuera de la placa). Pero dónde están los vástagos de TU HT-150SV no lo sabemos:
   el catálogo solo dibuja la platina fija. ¿Le tomas una foto con cinta a la platina móvil? **Recomiendo sí**: el libro
   (§11.3.8) pide confirmarlo con el moldeador; si tu máquina empuja con uno al centro, el molde lo admite sin pisar botadores.
2. *Los pilares que muerden la placa que sube y baja.* Dos de los tres pilares que sostienen la placa de soporte quedan a 14 mm
   del canto de la placa expulsora, y su barreno de paso (⌀41) le saca una muesca de 6.5 mm al canto; la placa sigue guiada,
   pero un taller lo ve raro. Moverlos adentro choca con los botadores. ¿Los acomodo para que pasen completos por dentro
   (puede que quepan menos de 3 y la placa de soporte tenga que engordar) o se queda la muesca? **Recomiendo** acomodarlos y
   dejar que el cálculo de la placa decida el grueso (el libro, §12.2.3: «se ajusta el acomodo de los botadores para dar lugar
   a los pilares»).
3. *Una sola guía, pero ¿cuál?* Ya dice ⌀25 en todos lados (antes la cotización decía 16). Ese 25 es nuestro: no tenemos el
   catálogo del proveedor de la base. Y con 25 el buje queda a 3.3 mm del inserto cuando el libro pide 12.5 (la mitad de la
   guía). ¿Qué proveedor de bases usa el taller (HASCO, DME, Meusburger, local)? **Recomiendo** pedir su tabla y que esa tabla
   mande: con la colocación de hoy, una guía de 16 deja 12.8 mm (cabe en la base de 246); una de 20 deja 8.8 (no llega a 10) y
   una de 25 deja 3.3 — con 20 o más, la carcasa pide la base de 296 (cuenta mía con el acomodo actual, no del catálogo).
