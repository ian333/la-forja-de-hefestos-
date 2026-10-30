# ORDEN M: LOS ROJOS MAL JUZGADOS Y EL FOLIO — FREEZE y CICLO con el criterio del libro, un número por concepto, y el expediente.json del que sale todo número público

ESTADO: hoy
PRIORIDAD: 1

BASE: (la pone el agente: `git rev-parse --short HEAD` tras ponerse en main)

OBJETIVO: el debate del primer video (`/mnt/c/Users/sebas/Downloads/la-forja-video-1/`, ronda 2 del ingeniero `debate/ronda2/04-ingeniero-de-moldes.md`
y el plan `00-EL-VIDEO-1.md` §4 «O1 · Motor») encontró que el motor juzga mal dos de los cinco rojos de la 1594C Box, y que un
mismo concepto sale con dos números. Nada de eso puede salir en un video público. Al terminar: los rojos son los del libro, cada
concepto tiene UN número, y existe un `expediente.json` por folio del que salen todos los números que se publican.

## LO QUE SE CAMBIA (un cambio → medir → el siguiente)
1. **FREEZE con el criterio de Kazmer §7.3.4 (p.181).** Hoy el motor compara el congelamiento de la compuerta (Tabla 7.4) contra la
   pared llegando a temperatura de EXPULSIÓN (Eq 9.5; `moldmachine.ts` ~L570 `tPackNeededS: alimentacion.tcPartS`, y lo mismo en
   la E8 de `estudio-molde-datos.ts`). Kazmer compara contra la solidificación de la pared a NO-FLUJO, con la misma Tabla 7.4.
   `gating.ts:44-53` ya documenta que los ejemplos strip impresos (fan 1.5 s, vaso 24 s) son errata ×2 de su propia fórmula.
   Verifica todo esto TÚ en el PDF (`/mnt/c/Users/sebas/Documents/David O. Kazmer (Auth.) - Injection Mold Design Engineering (Carl, Hanser Fachbuchverlag) - libgen.li.pdf`;
   la página impresa no es PDF − 11 fijo: usa el encabezado) antes de tocar. Esperado en la Box: compuerta 20.0 s contra pared
   ≈ 8–14 s → CUMPLE. Corrige el oráculo `kazmer-c7-06` del extracto `docs/forja-research/libros/kazmer.md` (dice 24 s; la
   fórmula da ~12) con su nota de errata, y deja una prueba de regresión.
2. **CICLO ciclo contra ciclo.** Hoy compara 41.0 s (Eq 3.23, `4·h²`, un CICLO cotizado) contra 64.7 s (el ENFRIAMIENTO de la raíz
   del poste, Eq 9.6) y dice «le faltan 23.7 s» y «se cotizó» (`mold-contratos.ts` ~L611-627, `inspeccion-recorrido.ts` ~L367,379,
   el reporte de L). Compara ciclo contra ciclo (el ciclo que pide lo más grueso con su apertura/expulsión/cierre, con el MISMO
   modelo que da los 41.0 sobre la pared) o enfriamiento contra enfriamiento, con su cita. Ningún texto dice «se cotizó» ni «te
   cotizaron»: nadie cotizó esta pieza; es nuestro cálculo y se rotula así.
3. **Un número por concepto.** La pared: 21.5 s en la lente del paso 3 y 21.7 s en el dictamen. La presión de llenado: 18.6 en el
   dictamen y 18.9 en otros lados. La lámina dice «HT-150SV (36 t)» donde la máquina es de 150 t (36 t es el cierre que pide). Busca
   los demás pares que salgan distintos en lente, dictamen, inspección, reporte, láminas y expediente; cada uno queda con UNA fuente.
4. **La raíz del poste como sección.** Los postes ⌀8 traen barreno ⌀3.93 que se queda 5.4 mm antes del piso: lo lento es esa raíz
   maciza, no el poste entero (a media altura es un tubo de pared 2.04 mm). El número de la lente de enfriamiento (`foco-lentes.ts`,
   el modelo de t_c) y lo que pinta deben ser del MISMO modelo: la raíz cruza la isoterma de expulsión en su t_c ±1 s.
   (La orden P pinta el corte; tú das el número. No toques su render.)
5. **El `expediente.json` por folio.** Un archivo por corrida: commit, SHA-256 del STEP, fecha, folio; y por cada número publicable:
   valor, unidad, límite, veredicto, cita y procedencia (de qué función/estación sale). Dos corridas de la misma pieza dan el mismo
   archivo byte a byte (sin la fecha). Descargable junto al expediente y legible por `__forgeBrep` para la filmadora y el guion.

## YA-EXISTE (prueba de ausencia)
- `gating.ts` (Tabla 7.4 con su errata), `moldmachine.ts`, `mold-contratos.ts`, `revisar-modelo.ts` (re-juicio ②), `expediente.ts`
  (y el reporte de análisis de L), `inspeccion-recorrido.ts`, `foco-lentes.ts`, `estudio-molde-datos.ts` (la E8).

## TOCA
- src/forja/mold/gating.ts
- src/forja/mold/moldmachine.ts
- src/forja/mold/mold-contratos.ts
- src/forja/mold/revisar-modelo.ts
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/mold/foco-lentes.ts
- src/forja/mold/expediente.ts
- src/forja/mold/mold-drawings.ts
- src/forja/brep/ForgeBRepStudio.tsx
- docs/forja-research/libros/kazmer.md

## CREA
- (nada — si el expediente.json necesita su propio módulo, ENMIENDA con el porqué)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (la orden P trabaja EN PARALELO)
- foco-lentes.ts: M = el modelo de t_c (barra/placa/raíz); P = exponer/pintar el campo interior. ForgeBRepStudio.tsx: M = la
  descarga del expediente.json y los textos que corrige; P = el modo película, la cámara, el material y los cortes.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Tabla ANTES → DESPUÉS en la 1594C Box (app real): FREEZE (compuerta contra pared, con el criterio y la página), CICLO (qué contra
  qué), los pares de números unificados (concepto · antes A/B · después), ✗ totales del ② y del ①.
- Par de control de FREEZE: una pieza cuya compuerta SÍ se congela antes que la pared (p. ej. pin-point ⌀2 contra pared de 3 mm,
  el ejemplo del libro) sale ✗.
- El expediente.json de la Box dos veces: idéntico salvo la fecha; cada número del reporte y del dictamen ② está en él.
- Captura 4K del dictamen y del reporte con los números nuevos, juzgada con Read.
- `qa-banco.cjs` en tu copia: los dorados que cambian A PROPÓSITO (p. ej. `dictamenViola`), listados con razón; NO los re-grabes.
- tsc sin errores nuevos (base 58); el cubo 270/270 o ACTA R94.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
