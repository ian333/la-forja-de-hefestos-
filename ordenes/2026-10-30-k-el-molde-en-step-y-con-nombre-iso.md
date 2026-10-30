# ORDEN K: EL MOLDE EN STEP Y CON NOMBRE ISO — la planta abre el molde en su CAD y lee la lista de materiales en el idioma de la norma

ESTADO: hoy
PRIORIDAD: 1

BASE: 90ee856 (el worktree nació en origin/main divergente y sin trabajo propio: reset a main)

OBJETIVO: ian (2026-10-30): «hay normativas internacionales; empecemos por entregar los documentos estándar, validaciones
estándar y videos» y antes «me gustaría que soporte Fusion para poder jalar todo». Hoy la planta se lleva 17 láminas y una BOM
con NUESTROS nombres, y ningún 3D del molde. Al terminar: (1) el expediente trae un **STEP del molde** (cavidad, macho, placas,
botadores, guías, pilares, bebedero — cada cuerpo con su nombre) que se abre en cualquier CAD (Fusion, SolidWorks, FreeCAD);
(2) la **BOM usa los términos de ISO 12165:2019** y, donde aplique, la **designación de la norma del componente** (botadores
ISO 6751 / ISO 8694, pilares de soporte ISO 10073, guías: verifica el número vigente); (3) el **cajetín** de las láminas trae los
campos de ISO 7200 (título, número de plano, revisión, fecha, aprobó, hoja, escala, unidades, símbolo de proyección).

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **El STEP del molde.** Ya existe `exportSTEP(oc, shape)` en `src/forja/brep/occt.ts` (~L2229). Mide primero QUÉ cuerpos del molde
   son B-Rep (OCCT) y cuáles son solo malla (`moldParts` con `positions`): un STEP con mallas trianguladas no sirve en un CAD de
   verdad. Los que sean malla y tengan geometría simple (placas con barrenos, pines, pilares, bujes) se construyen como B-Rep con
   las MISMAS cotas que ya usan las láminas; la cavidad y el macho ya son B-Rep (`cursoPart`). Un ensamble (compound con nombres)
   descargable desde el paso 8/9.
2. **La BOM con nombre ISO.** Cada renglón: término ISO 12165 (en español y en inglés entre paréntesis) + designación de la norma
   del componente cuando la haya (p. ej. botador ⌀4.763 × L → «ISO 6751 – d × l»). Verifica en iso.org / catálogos públicos el
   número y la vigencia de cada norma que pongas (WebSearch); lo que no puedas verificar va como «regla de Hefestos» o sin
   designación — NUNCA un número de norma inventado. El proveedor de bases del taller no se sabe todavía (pregunta abierta a ian):
   no pongas números de parte de catálogo.
3. **El cajetín ISO 7200** en las láminas (`mold-drawings.ts`): los campos que pide la norma, sin inventar valores (lo que no se sabe
   va vacío con su línea para firma). La orden A ya quitó «ISO 2768-mK» y «DIBUJÓ: La Forja CAD»: no los regreses.

## YA-EXISTE (prueba de ausencia)
- `exportSTEP` (occt.ts); las láminas y la BOM (`mold-drawings.ts`, `mold-drawing-set.ts`, `mold-assembly.ts`, orden J); el
  expediente (`expediente.ts`); el botón de descarga del expediente (ForgeBRepStudio.tsx, paso 9).

## TOCA
- src/forja/brep/occt.ts
- src/forja/mold/mold-drawings.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-assembly.ts
- src/forja/mold/expediente.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/mold-plano-set.ts
(la última entra por la ENMIENDA 1 del 2026-10-30, más abajo)

## CREA
- src/forja/mold/molde-step.ts
(entra por la ENMIENDA 1 del 2026-10-30, más abajo)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (la orden L trabaja EN PARALELO)
- expediente.ts: K = la sección de láminas/BOM/STEP; L = el reporte de análisis. ForgeBRepStudio.tsx: K = la descarga del STEP
  (paso 8/9); L = el reporte. Nada de reformatear bloques ajenos.

## ENMIENDA 1 · 2026-10-30 (medido ANTES de tocar; los archivos entran al TOCA/CREA de arriba)
1. **El B-Rep de cada cuerpo ya existe, pero se tira al teselar.** `MoldPart` solo guarda la malla (`positions`). Casi todos
   los cuerpos nacen B-Rep y pasan por `tessellate` (occt.ts): los de las estaciones (`cursoPart` en useMoldStudio.ts) y los
   del portamoldes (`push` en `buildFunctionalParts`, las placas en `buildMoldParts`). Para no tocar useMoldStudio.ts (es de
   la orden L), `tessellate` apunta de qué sólido salió cada malla (occt.ts, en TOCA). Quedan DOS cuerpos que nacen como
   malla pura en **mold-plano-set.ts**: los tornillos (cuerda helicoidal, `threadSurfaceMesh`) y los interlocks (revolución
   teselada y corrida por vértice). Ahí se les agrega su B-Rep a pedido (`brep`), armado con las MISMAS variables locales que
   su malla (posición, largo, cabeza, perfil): sin copiar fórmulas a otro archivo. La malla no cambia (la huella no se mueve).
2. **El armador del ensamble B-Rep necesita un archivo propio: `src/forja/mold/molde-step.ts`.** Tiene que llamar a
   `buildPlateSolid`/`plateStackZ` (mold-plano-set.ts) para las placas nominales. No cabe en mold-assembly.ts sin un ciclo de
   importación en tiempo de ejecución (mold-assembly ← mold-drawing-set ← mold-plano-set), ni en expediente.ts sin cargarle el
   kernel de placas a un módulo puro que además edita la orden L. En ForgeBRepStudio.tsx (11.7 k líneas) solo va el botón.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- **Ida y vuelta del STEP**: el archivo descargado de la 1594C Box se vuelve a LEER con OCCT (STEPControl_Reader) y por cuerpo:
  nombre, volumen y caja coinciden con el molde de la app (tabla en el CIERRE, tolerancia declarada). Ningún cuerpo triangulado
  si su geometría es simple. Par de control: un cuerpo alterado a propósito sale distinto.
- Captura 4K (juzgada con Read) de la BOM con nombres ISO y del cajetín nuevo; lista de cada norma citada con la URL donde la
  verificaste.
- La huella y los dorados en tu copia: si cambian, di por qué (la geometría del molde NO debería cambiar). tsc sin errores nuevos;
  el cubo 270/270.

## CIERRE (2026-10-30 · MEDIDO, no contado)

**Orden vs entregado.** Medido en la APP REAL (forja-dev7 :5198, GPU `ANGLE … D3D12 (NVIDIA GeForce RTX 4070 Ti)`, 1594C Box
por el camino hasta el portamoldes) con el medidor `mide-step.cjs`: corrida A (STEP, antes de arreglar nombres), B (STEP +
BOM + cajetín) y C (final, con los arreglos de legibilidad de B).
1. **El STEP del molde — HECHO.** Botón «⬇ Molde 3D (STEP)» en el expediente (paso 9, activo con el portamoldes) y
   `window.__moldeSTEP` para arneses. AP214 (`AUTOMOTIVE_DESIGN`), en mm, ASCII puro: **73 PRODUCT (raíz + 72 cuerpos),
   72 NAUO, 80 MANIFOLD_SOLID_BREP, CERO caras trianguladas**, 7.98 MB. Armar 8.4 s · escribir 3.3 s · leer de vuelta 14.1 s
   (vite dev; relojes = clima). La descarga del botón = el archivo de la API (salvo la fecha y el contador de NAUO).
2. **La BOM con nombre ISO — HECHO.** Cada renglón: denominación en español del término de ISO 12165:2019 (+ medida), el
   término inglés debajo, y en MATERIAL · NORMA «tipo ISO nnnn» (la norma del componente que cita la columna de referencias
   de ISO 12165; para el buje guía y los botadores, la norma cuyo título los nombra: ISO 8018, ISO 8694 / 6751). Entran
   5 piezas que el 3D/STEP traían y la BOM no: retornos ×4, pernos M6 × 90 ×4 y M6 × 156.9 ×4 (largo de `pernosDelMolde`,
   la MISMA cuenta que arma el perno), interlocks ×4, anillo de centrado. Los ids de los botadores (11.1–11.8) bajan debajo de
   su renglón 11. Sin número de parte de catálogo: «JP-251» sale del renglón y de la nota del agua.
3. **El cajetín ISO 7200 — HECHO en las 8 láminas que dibuja mold-drawings.ts** (ensamble + 7 placas): los 8 campos
   OBLIGATORIOS de las Tablas 1–3 (propietario legal, nº de identificación, fecha de emisión, hoja, título, aprobó, elaboró,
   tipo de documento) + revisión, nº de hojas, título suplementario (término inglés + pieza), idioma y formato. Sin inventar:
   propietario, fecha de EMISIÓN, revisión y las tres firmas van con su línea vacía; «generado el 2026-10-30» y «generado por
   La Forja (software)» van aparte, chico. Hojas numeradas n / 17 (`numerarHojas`). Sin ISO 2768 / Ra / «La Forja CAD».
   **Pendiente:** las 8 láminas de «4 vistas» y la pieza las dibuja `isoview.ts` (fuera del TOCA) con su marco viejo, y la hoja
   de análisis no tiene cajetín (su tabla ocupa la hoja entera, orden J).

**Qué cuerpos salen B-Rep (inventario medido, los 75 componentes de la app).** NINGUNO sale triangulado.
| de dónde sale el B-Rep | componentes → cuerpos del STEP |
|---|---|
| `tessellate` (el MISMO sólido que la app teseló; `formaDeLaMalla`) | inserto de cavidad y de núcleo (barrenados), colada, 18 tapones, 3 O-rings, lámina del baffle, punta + cuerpo de 8 botadores → 8 botadores escalonados, postes ×4, bujes ×4, retornos ×4, reglas ×2, pilares ×3, anillo → anillo + buje del bebedero |
| `brep()` a pedido (nacían malla pura, mold-plano-set.ts) | pernos ×4 + ×4 (cuerda COSMÉTICA: caña al Ø mayor + hexágono interior, como la dibuja un CAD), interlocks ×4 |
| placa NOMINAL (`buildPlateSolid`, el constructor y el spec de las láminas) | sujeción superior e inferior, soporte, retenedora, expulsora, A y B |
| la pieza del árbol, colocada como la E3 | la pieza (referencia, plástico) |
| **NO van (17)**: 16 líneas/bore de agua (son HUECO, ya barrenado en insertos y placas) + la lámina visual de la partición | — |

**La ida y vuelta (corrida B; 72 cuerpos, leídos con STEPCAFControl_Reader → XCAF).** Archivo ↔ B-Rep enviado: **72/72
exactos — nombre IGUAL, Δcaja 0 mm**, Δvol < 1e-13 en 69 cuerpos, insertos 2.8e-10 y 1.2e-7, la pieza del cliente (superficies
libres) 1.7e-6. Tolerancia declarada: vol ≤ 1e-5 relativo, caja ≤ 1e-3 mm. La corrida A salió ROJA en 23 nombres: OCCT 7.4 cambia
espacios por «_» y PARTE las cadenas de > 72 caracteres en dos renglones; la restitución ahora recorre cada literal (B: 72/72).
Archivo ↔ malla de la app (por rol; tolerancia de caja 1.0 mm — la malla es un poliedro inscrito; el volumen se reporta):
| rol | cuerpos | vol STEP mm³ | vol malla mm³ | Δ % | Δcaja mm | por qué difiere |
|---|---|---|---|---|---|---|
| cavidad | 1 | 1,012,685.82 | 1,012,717.77 | +0.003 | 0 | teselado |
| núcleo | 1 | 829,759.16 | 829,798.99 | +0.005 | 0 | teselado |
| pieza | 1 | 55,821.81 | 55,812.00 | −0.018 | 0 | teselado |
| placa A (app: caja fantasma) | 1 | 2,437,351.69 | 3,994,056.00 | +63.9 | 0 | el STEP lleva la placa de la lámina (bolsa del inserto + barrenos); la app la pinta maciza |
| placa B (app: caja fantasma) | 1 | 1,345,381.04 | 2,178,576.00 | +61.9 | 0 | ídem |
| sujeción superior | 1 | 2,579,486.39 | 2,577,204.42 | −0.09 | 0.06 | la app rasura 0.06–0.24 mm por lado (anti-z-fight); el STEP es nominal |
| soporte | 1 | 1,300,663.55 | 1,295,587.39 | −0.39 | 0.24 | ídem |
| retenedora | 1 | 451,038.56 | 451,338.07 | +0.07 | 0 | teselado |
| expulsora | 1 | 636,918.91 | 637,362.86 | +0.07 | 0 | teselado |
| sujeción inferior | 1 | 2,561,715.28 | 2,554,850.16 | −0.27 | 0.18 | rasurado |
| colada | 1 | 2,581.54 | 2,556.87 | −0.96 | 0.008 | teselado |
| tapones · O-rings · baffle | 18 · 3 · 1 | 6,494.22 · 435.66 · 403.38 | 6,483.42 · 434.94 · 403.38 | −0.17 · −0.17 · 0 | ≤ 0.007 | teselado |
| postes guía | 4 | 182,408.48 | 190,754.68 | +4.6 | 0.17 | la app junta poste + collar como DOS cilindros encimados (cuenta el traslape dos veces); el STEP los funde |
| bujes guía | 4 | 90,310.71 | 96,585.52 | +6.9 | 0.21 | ídem (tubo + brida) |
| retornos | 4 | 61,625.48 | 68,286.50 | +10.8 | 0.09 | ídem (vástago + cabeza) |
| pernos lado fijo · móvil | 4 · 4 | 11,751.95 · 19,318.16 | 11,419.28 · 18,899.37 | −2.8 · −2.2 | 0 | cuerda cosmética (Ø mayor) contra la hélice real |
| interlocks | 4 | 26,869.97 | 26,662.50 | −0.77 | 0 | teselado |
| reglas | 2 | 2,326,926.91 | 2,327,146.31 | +0.01 | 0 | — |
| pilares | 3 | 361,911.47 | 356,535.88 | −1.5 | 0.22 | teselado (⌀40 a 0.6 mm) |
| anillo + buje del bebedero | 2 | 72,727.87 | 72,201.17 | −0.72 | 0.29 | teselado |
| botadores | 8 | 19,329.20 | 18,686.83 | −3.3 | 0.11 | teselado (⌀2.381 a 0.95 mm) |

**Par de control.** El inserto de cavidad corrido 0.5 mm en X ANTES de escribir → la comparación contra lo enviado sale **ROJA en
ese cuerpo y solo en ese** (Δcaja 0.5000 mm; los otros 71 exactos): `PAR_DE_CONTROL: MUERDE`.

**Las normas citadas, verificadas (número, título, vigencia).**
- ISO 12165:2019 (2.ª ed., confirmada 2025) — términos: https://www.iso.org/standard/75669.html · SCC https://ccn-scc.ca/standardsdb/standards/8168866 · la muestra pública con las Tablas 1–4 (de ahí cada término y clave): https://cdn.standards.iteh.ai/samples/75669/c10fa7a9215a4ae39b563f3952291179/ISO-12165-2019.pdf
- ISO 7200:2004 (confirmada 2025) — cajetín: https://www.iso.org/standard/35446.html · campos y obligación leídos en su adopción idéntica IS 11665:2009: https://law.resource.org/pub/in/bis/S01/is.11665.2010.pdf
- ISO 6753-2:1998 (placas maquinadas para moldes): https://scc-ccn.ca/standardsdb/standards/8109599
- ISO 8017:2007 (columnas guía): https://www.iso.org/standard/44038.html · ISO 8018:2007 (bujes guía con brida): https://www.iso.org/standard/44037.html
- ISO 10073:2008 (pilares de soporte): https://ccn-scc.ca/standardsdb/standards/8145641
- ISO 8406:2008 (elementos de centrado redondos): https://www.iso.org/standard/45063.html
- ISO 10907-1:2008 (anillos de centrado sin lámina aislante): https://www.iso.org/standard/45060.html
- ISO 10072:2004 (bujes de bebedero): https://www.technickenormy.cz/en/bs-iso-10072-2004-tools-for-moulding-sprue-bushes-dimensions
- ISO 4762:2004 (tornillo de cabeza cilíndrica con hexágono interior): https://committee.iso.org/standard/34460.html
- ISO 8694:2011 (botadores escalonados con cabeza cilíndrica): https://www.iso.org/standard/57877.html · SCC https://ccn-scc.ca/standardsdb/standards/8151892
- ISO 6751:2011 (botadores con cabeza cilíndrica): https://www.iso.org/standard/57874.html · SCC https://ccn-scc.ca/standardsdb/standards/8151889
- **Sin designación en ningún renglón**: ninguna norma de componente se compró, así que ni su tabla de medidas ni el formato de
  su designación están verificados → «tipo ISO nnnn» + la medida en la denominación, y la nota de la BOM lo dice (regla de
  Hefestos). Sin norma (fuente Kazmer, «†»): retornos, insertos, O-ring, baffle, líneas de agua (la Tabla 5 de ISO 12165,
  expulsión, no está en la muestra pública).

**Evidencia (iangpu `/home/ian/el-plan-dev7/k/`).** `mide-step.cjs` (el medidor) · `A-step/` · `B-todo/` · `C-final/` (cada una
`medida.json`, `molde.step`, el `.step` bajado por el botón, `expediente.jpg`, y en B/C `lamina-00.jpg`, `lamina-00-abajo.jpg`,
`lamina-04*.jpg`, `lamina-00.svg`, `lamina-04.svg`) · `B-todo/mira-armado.png` y `mira-explosion.png` (el STEP LEÍDO de vuelta y
pintado en Blender, un color por cuerpo: otros ojos que los de la app) · sondas `sonda-*.cjs` (XCAF en este build). Capturas
juzgadas con Read: expediente con el botón (A), ensamble con la BOM ISO (B) y su recorte, cajetín de cerca (B), placa A con su
cajetín «5 / 17» (B). Juez getBBox en las 17 láminas (B): 0 textos encimados en cajetín y BOM, BOM hasta x 410.6 de 415.

**Pruebas.** El cubo **270/270** (sin ACTA: ningún literal se movió) · tsc **58 = 58 de la base, 0 nuevos** (`tsc-base.txt`,
`tsc-final.txt`; occt.ts está fuera del tsconfig desde antes) · `mold-assembly-test.cjs` 17/17 (los checks J siguen: «Pilar de
soporte ⌀40 × 96» y «Poste guía ⌀25 ×» en la BOM) · `mold-drawings-test.cjs` 14/14 · `node scripts/orden-gate.cjs` → VERDE.

**Visto, de otras órdenes o para después (no lo toqué).**
- Las placas A y B de la app son cajas «fantasma» macizas (12 triángulos); el STEP lleva las de la lámina. Y esas placas (lámina
  y STEP) barrenan el agua del PAQUETE (`coolingCircuit`), no la que barrena la E6 en los insertos: dos aguas.
- La sección A-A dibuja el buje del bebedero largo (de la pieza a la sujeción, 1.2311); el 3D lo arma de 8 mm dentro del anillo.
- «JP-251» (número de parte de un tapón de catálogo) sigue en los nombres del 3D de la E6 («tapón NPT (JP-251)»).
- Las 4 vistas (`isoview.ts`) y la hoja de análisis sin cajetín ISO 7200 (arriba).

**Archivos (para la fusión).** `src/forja/brep/occt.ts` (la malla recuerda su B-Rep: `formaDeLaMalla`; `exportSTEPEnsamble`,
`importSTEPEnsamble`, `nombreSTEP`) · `src/forja/mold/molde-step.ts` (NUEVO, ENMIENDA 1: `cuerposDelMolde`, `idaYVuelta`) ·
`src/forja/mold/mold-plano-set.ts` (`MoldPart.brep`; el B-Rep a pedido de pernos e interlocks; el largo de los pernos lo da
`pernosDelMolde` — misma cuenta, la malla no cambia) · `src/forja/mold/mold-assembly.ts` (`TERMINOS_ISO`, `renglonISO`,
`NOTAS_BOM_ISO`, `MoldAssemblySpec.cajetin`, renglones ISO de la sección) · `src/forja/mold/mold-drawings.ts` (cajetín ISO 7200,
`numerarHojas`, BOM de dos líneas con orden padre/hijo) · `src/forja/mold/mold-drawing-set.ts` (`pernosDelMolde`, piezas nuevas
de la BOM, término y cajetín de cada placa) · `src/forja/brep/ForgeBRepStudio.tsx` (`aspecDelMolde` — el spec de los planos,
ahora compartido con el STEP —, `moldeEnSTEP`, botón y línea del STEP en el expediente, `__moldeSTEP`, cajetín y numeración en
los planos). `expediente.ts` estaba en TOCA y NO se tocó (región de L intacta).

**Preguntas para ian.**
1. *Los botadores en pulgadas.* Los 8 botadores de tu carcasa miden ⌀2.381 en la punta y ⌀4.763 en el cuerpo: son 3/32 y 3/16
   de pulgada. La norma ISO de ese botador (ISO 8694) es de catálogo métrico; si el taller compra métrico, ese botador no
   existe tal cual y hay que pasar a la medida métrica de al lado (y re-checar el pandeo). Hoy la BOM dice «tipo ISO 8694» sin
   designación. ¿El taller compra botadores en pulgadas o en milímetros? **Recomiendo** preguntárselo junto con el proveedor de
   la base: con esa respuesta la BOM ya puede escribir la designación de su catálogo.
2. *El tornillo largo de la mitad móvil.* Sube desde abajo de la sujeción inferior hasta morder la placa B: mide 156.9 mm bajo
   la cabeza (M6). Ese largo sale de la cuenta, no de una tabla: en la tienda no hay 156.9. Si se compra el comercial más
   corto, la rosca muerde menos de lo calculado; si el más largo, toca fondo. ¿Ajusto el largo al catálogo del proveedor y
   recalculo cuánto muerde? **Recomiendo** que sí, en cuanto tengamos el catálogo (es la misma pregunta del proveedor).
3. *Quién firma como dueño de los planos.* El cajetín ISO pide «propietario legal» del documento: hoy va la línea vacía. ¿Las
   láminas son de la planta que compra el molde (su nombre de TU PLANTA, paso 2) o de GAIA? **Recomiendo** la planta: el
   expediente lo libera y lo firma ella; GAIA queda como «generado por».
