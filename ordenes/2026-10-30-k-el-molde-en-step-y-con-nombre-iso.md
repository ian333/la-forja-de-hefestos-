# ORDEN K: EL MOLDE EN STEP Y CON NOMBRE ISO — la planta abre el molde en su CAD y lee la lista de materiales en el idioma de la norma

ESTADO: hoy
PRIORIDAD: 1

BASE: (la pone el agente: `git rev-parse --short HEAD` tras ponerse en main)

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

## CREA
- (nada — si de verdad necesitas un archivo para armar el ensamble B-Rep, ENMIENDA con el porqué)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (la orden L trabaja EN PARALELO)
- expediente.ts: K = la sección de láminas/BOM/STEP; L = el reporte de análisis. ForgeBRepStudio.tsx: K = la descarga del STEP
  (paso 8/9); L = el reporte. Nada de reformatear bloques ajenos.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- **Ida y vuelta del STEP**: el archivo descargado de la 1594C Box se vuelve a LEER con OCCT (STEPControl_Reader) y por cuerpo:
  nombre, volumen y caja coinciden con el molde de la app (tabla en el CIERRE, tolerancia declarada). Ningún cuerpo triangulado
  si su geometría es simple. Par de control: un cuerpo alterado a propósito sale distinto.
- Captura 4K (juzgada con Read) de la BOM con nombres ISO y del cajetín nuevo; lista de cada norma citada con la URL donde la
  verificaste.
- La huella y los dorados en tu copia: si cambian, di por qué (la geometría del molde NO debería cambiar). tsc sin errores nuevos;
  el cubo 270/270.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
