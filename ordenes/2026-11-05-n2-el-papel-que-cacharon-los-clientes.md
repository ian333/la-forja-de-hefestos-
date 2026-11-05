# ORDEN N2: EL PAPEL QUE CACHARON LOS CLIENTES — láminas, lista de materiales y textos que una planta pueda poner en la mesa

ESTADO: hoy
PRIORIDAD: 1

BASE: (la pone el agente tras ponerse en main, que ya trae la orden M)

OBJETIVO: el panel de 8 clientes simulados (`/mnt/c/Users/sebas/Downloads/la-forja-clientes/00-RESUMEN.md`; críticas en `ronda1/`,
`ronda2/`) encontró en el expediente errores de taller y jerga interna. Al terminar, el expediente de la 1594C Box no trae ninguno.

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **La lista de materiales completa y coherente**: el baffle del macho y sus O-rings existen en el 3D/STEP pero NO tienen renglón;
   las líneas de agua dicen cantidad 4 en la lista y 8 en el reporte/dictamen (una sola cuenta, con su definición: líneas, tramos o
   barrenos); el buje del bebedero sale en 1.2311 sin templar (debe ser templado, con su fuente o «regla de Hefestos»).
2. **La placa expulsora**: los barrenos de paso ⌀41 de dos pilares (x = 14) rompen el canto de la placa de 116 mm. Los pilares se
   acomodan para que su paso quede DENTRO con pared mínima (Kazmer §12.2.3: «directly under the portions of the mold cavity…»; la
   pared mínima es regla de Hefestos con su razón) y el cálculo de la placa de soporte decide grueso y número (orden B). Y el KO:
   hoy el barreno KO ⌀20 es pasante en la placa expulsora, donde el vástago debe EMPUJAR; revisa con Kazmer §11.3.8 / §4.3.2 dónde
   va pasante (sujeción inferior) y qué lleva la expulsora; el pilar central no puede quedar donde empuja la máquina.
3. **La lámina de ensamble**: el corte A-A dibuja la pieza como bloque macizo; debe verse la caja hueca con el macho adentro. Escala
   normalizada (ISO 5455: 1:1, 1:2, 1:5, 2:1…; hoy 1:1.3). El cajetín ya es ISO 7200 (orden K): no lo rompas.
4. **Cuentas a la vista**: «69 criterios» cuando el panel suma 68 (que todos los estados se cuenten y se vean); el costo de la ficha
   $50,030 contra 45 h × 950 + 16 h × 450 = $49,950 (horas redondeadas en pantalla: que la cuenta mostrada cuadre); el «72/100»
   se explica en una línea o se quita del expediente.
5. **Sin jerga interna en lo que ve el cliente** (expediente, reporte, inspección, ficha): «orden G», «datos inventados · orden G»
   (→ «datos de ejemplo»), «es otra orden», «de panzazo» (→ «justo»), «Foco» (→ «la revisión barreno contra barreno»), «E5/E6»
   (→ el nombre de la estación). «Regla de Hefestos» SE QUEDA (es la doctrina) pero el expediente la explica una vez: «criterio
   propio de GAIA, no está en el libro». La portada del expediente declara qué sale a un proveedor externo de IA (imágenes y
   números de la revisión automática; el STEP no).

## YA-EXISTE
- `mold-drawing-set.ts`, `mold-drawings.ts`, `mold-assembly.ts`, `mold-plano-set.ts` (órdenes J y K), `expediente.ts`, los textos de
  `inspeccion-recorrido.ts`, `MoldPanels.tsx` (ficha TU PLANTA), `ForgeBRepStudio.tsx`.

## TOCA
- src/forja/mold/mold-drawing-set.ts
- src/forja/mold/mold-drawings.ts
- src/forja/mold/mold-assembly.ts
- src/forja/mold/mold-plano-set.ts
- src/forja/mold/expediente.ts
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/mold-assembly-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (la orden N1 trabaja EN PARALELO)
- expediente.ts: N2 = textos, portada, láminas/BOM; N1 = los números del reporte y el ciclo. inspeccion-recorrido.ts: N2 = textos;
  N1 = el ciclo.

## EVIDENCIA
- `node scripts/orden-gate.cjs` → VERDE.
- Tabla ANTES → DESPUÉS en la 1594C Box: renglones de la BOM (baffle, O-rings, agua, buje); X de los pilares y pared al canto; el KO;
  el corte con la caja hueca; la escala; 69 = suma; costo que cuadra; grep de la jerga en el expediente descargado = 0.
- Capturas 4K de la lámina 10, 11 y del expediente, juzgadas con Read; `mold-assembly-test` con checks nuevos (con su control).
- Huella/dorados que cambien A PROPÓSITO (pilares) listados con razón; tsc sin errores nuevos; el cubo 270/270 o ACTA R97.

## CIERRE (se llena al terminar)
