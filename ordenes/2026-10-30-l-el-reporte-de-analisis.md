# ORDEN L: EL REPORTE DE ANÁLISIS — llenado, empaque, enfriamiento, alabeo y contracción como los entrega la industria, con la pieza del volumen correcto

ESTADO: hoy
PRIORIDAD: 1

BASE: (la pone el agente: `git rev-parse --short HEAD` tras ponerse en main)

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

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
