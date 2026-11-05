# ORDEN N1: LOS NÚMEROS QUE CACHARON LOS CLIENTES — contracción con la ficha, potencia del agua con el ciclo, presión de los botadores y UN ciclo con su desglose

ESTADO: hoy
PRIORIDAD: 1

BASE: (la pone el agente tras ponerse en main, que ya trae la orden M)

OBJETIVO: el panel de 8 clientes simulados (`/mnt/c/Users/sebas/Downloads/la-forja-clientes/00-RESUMEN.md`; las críticas completas en
`ronda1/` y `ronda2/`) encontró números del motor que un moldista tumba en minutos. Al terminar, la 1594C Box los da bien y con su
cita, medidos en la app.

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **La contracción del acero «seguro»** (`shrinkage.ts`, la E9 / reporte §7): hoy los factores salen del rango COMPLETO del modelo
   PVT (−0.25 % a 2.54 % → cavidad ×0.99751, núcleo ×1.02611: el núcleo queda 2.6 % grande y la pared de 3.2 «sale de ~1.8»). El
   rango para el acero se acota con la ficha del material (ABS del Apéndice A: 0.4–0.8 %) — Kazmer §10.1.6 y §10.2.2 (steel safe =
   décimas, por cota). Verifica la cita en el PDF. El PVT queda como dato, no como rango de corte.
2. **La potencia del agua** (E6, reporte §6): hoy divide el calor del disparo (21.17 kJ) entre 145.1 s, un tiempo del cálculo de la
   colada, y da 146 W. Kazmer Eq 9.10–9.11: calor por ciclo / tiempo de ciclo. Con el ciclo que da el motor tras la orden M. Mide
   cómo cambian caudal térmico, Re, D_max y si cambia la geometría del agua (si cambia: huella y dorados con razón).
3. **La presión de los botadores sobre la pieza**: hoy se revisa el pandeo de cada pin pero no la presión de contacto (485 N en una
   punta de ⌀2.381 ≈ 109 MPa sobre ABS caliente). Agrega el criterio con su fuente (Kazmer §11.2/§11.3 si da un límite o una regla
   de diseño; si no, «regla de Hefestos» con la razón escrita) y, en postes, la recomendación de camisas (§11.3, si el libro las
   trae para bosses). El reparto de fuerza hoy es igual para los 8 pines: si el agarre ya calcula la fuerza por pin, úsala.
4. **UN ciclo con su desglose** (dictamen ②, reporte §3 y §6, inspección): la orden M dejó «ciclo contra ciclo» (41.0 por la pared
   contra 84.5 con lo más grueso). En pantalla y papel hay además 21.5/21.7, 64.7/65.2, 75.8, 134 y 145 s sin nombre. Sale UN «ciclo
   estimado» con su tabla de tiempos, cada uno con su nombre (enfriamiento de la pared, de la raíz de los postes como barra, cota
   como placa, de la colada, etc.) y la nota de que el criterio es conservador (centro de lo más grueso a temperatura de expulsión)
   y aún no está calibrado contra máquina. Los clientes corren cajas así en 35–45 s: que el expediente no lo esconda.

## YA-EXISTE
- `shrinkage.ts`, `cooling.ts`, `estudio-molde-datos.ts` (E6/E9), `mold-contratos.ts`, `revisar-modelo.ts`, `expediente.ts`
  (reporte de análisis de L + folio de M), `inspeccion-recorrido.ts`.

## TOCA
- src/forja/mold/shrinkage.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/moldmachine.ts
- src/forja/mold/expediente.ts
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/brep/useMoldStudio.ts

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (la orden N2 trabaja EN PARALELO)
- expediente.ts: N1 = los números del reporte (§3, §6, §7) y el ciclo; N2 = textos, láminas, BOM y la portada del expediente.

## EVIDENCIA
- `node scripts/orden-gate.cjs` → VERDE.
- Tabla ANTES → DESPUÉS en la 1594C Box (app real): factores de cavidad/núcleo y la pared resultante; potencia, caudal térmico, Re,
  D_max; presión de contacto por pin y su veredicto; el ciclo único con su desglose.
- Captura del reporte §3/§6/§7 y del dictamen, juzgada con Read. Par de control del criterio nuevo de botadores (un pin con punta
  ancha cumple; el de ⌀2.381 con 485 N no).
- Banco: dorados/huella que cambian A PROPÓSITO, listados (dorado · viejo · nuevo · por qué); tsc sin errores nuevos; el cubo 270/270
  o ACTA R97.

## CIERRE (se llena al terminar)
