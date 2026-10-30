# ORDEN J: EL EXPEDIENTE LIMPIO — lo que la planta descarga no trae errores que un herramentista caza en cinco minutos

ESTADO: hoy
PRIORIDAD: 2

BASE: 54ea7ca

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

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Tabla ANTES → DESPUÉS en la 1594C Box: KO (X de cada barreno contra el ancho de la placa), pilares (renglón BOM + cota en lámina),
  volumen con signo de cada cuerpo de tornillería (todos > 0), hoja (captura), guía (⌀ en estudio = lámina = BOM).
- Captura 4K de la lámina 12, de la lámina con los pilares y de la BOM, juzgadas con Read.
- Par de control de la verificación nueva en qa-huella: un cuerpo invertido a propósito → ROJO; la Box arreglada → VERDE.
- La huella ×3 estable (el hash PUEDE cambiar si cambia la geometría: dilo y por qué); tsc sin errores nuevos; el cubo 266/266 o ACTA R94.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
