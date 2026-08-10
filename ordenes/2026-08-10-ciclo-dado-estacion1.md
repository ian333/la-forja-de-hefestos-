# ORDEN: EL CICLO DEL DADO — estación 1: el cubo entra y el DFM lo juzga

BASE: c6e3c62

OBJETIVO: el DADO (cubo hueco 40×40×40, pared 2, abierto abajo) vive como sólido REAL en
el CAD; el esqueleto de las 12 estaciones del ciclo de Kazmer es visible (dónde estamos,
qué sigue); y la estación 1 juzga EN VIVO las dos entradas: el cubo MACIZO reprobado con
sus números (sección 50 mm → t_c por Eq 9.5 en minutos) y el dado aprobado. Evidencia
visual entregada a Downloads de la laptop + /mnt/e/forja-videos de iangpu.

## YA-EXISTE (prueba de ausencia)
- Sólido por booleana: `occt.makeBox` + `occt.cut` — el dado es caja − caja (draft 1°
  DECLARADO, no tallado: extensión declarada, tallarlo es tema de la estación 3).
- Mostrar UNA pieza como parte del estudio: patrón `cursoPart`/`cursoSet` (así muestra
  el vaso la flanera). El stepper visible: patrón del CURSO ALWIS (cursoStage).
- Juez DFM: `dfm.checkDFM` (§2.3.1-7, Tabla 2.14). LO QUE NO TIENE: la sección masiva —
  es A-013 (🟥 FALTA del índice). DECISIÓN: dfm.ts NO se toca (habría que inventarle un
  umbral); A-013 se resuelve como el libro lo trata — un [COMPARA]: t_c del macizo vs
  t_c del hueco con la Eq 9.5 real, en `estudio-molde-datos::estacion1Dado`.
- t_c real: la Eq 9.5 vive en `mold-cooling` (gate la valida contra 8.4/18.9/22.9 s del
  libro) — el macizo se condena con SU número, no con un adjetivo.
- Paneles DOM del molde: MoldPanels. Botones demo: MoldRibbonGroup (junto a Flanera).

## TOCA
- scripts/orden-gate.cjs
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (mugre de OTRA sesión trabajando en paralelo — reels del agua)
- index.html
- public/comando/catalogo.json
- public/comando/produccion.json
- scripts/comando-catalogo.cjs
- public/atrio/
- scripts/reels-web.py

ENMIENDA (declarada, no silenciosa): el gate tenía dos defectos que ESTA orden destapó —
elegía "la orden más reciente" por orden alfabético (juzgaba contra la de la limpieza) y
PREEXISTENTE no aceptaba prefijos (la otra sesión pare archivos en public/atrio/ más
rápido de lo que se listan). TOCA gana scripts/orden-gate.cjs para arreglar ambos.

## EVIDENCIA (declarada antes de trabajar)
- Sonda node: checkDFM(macizo) con ≥1 error de sección masiva (A-013) y su t_c Eq 9.5;
  checkDFM(dado) sin errores; los números impresos lado a lado.
- Capturas del CAD real (GPU iangpu), revisadas con ojos: (1) el dado sólido en el
  viewport, (2) el panel del CICLO con las 12 estaciones y la 1 activa, (3) la
  estación 1 con macizo REPROBADO (rojo) vs dado APROBADO (verde), lado a lado.
- Entrega: los PNG a /mnt/c/Users/sebas/Downloads (laptop) y /mnt/e/forja-videos (iangpu).
- `node scripts/orden-gate.cjs` VERDE (sin pipe que trague el exit code) · censo IGUAL.
- gates del dominio: mold-dfm-test (si existe para dfm.ts) sigue verde tras A-013.

## CIERRE (2026-08-10)
- orden vs entregado: IDÉNTICO, con dos enmiendas DECLARADAS durante el trabajo:
  (1) dfm.ts no se tocó (A-013 va como [COMPARA] en estacion1Dado, sin umbral inventado)
  — TOCA se corrigió; (2) el gate ganó mtime + prefijos en PREEXISTENTE (sus dos
  defectos los destapó ESTA orden: juzgaba contra la orden equivocada por sort
  alfabético, y la otra sesión pare archivos en public/atrio/).
- números: macizo REPROBADO — t_c 88.3 MIN (Eq 9.5, 625× vs pared 2) + 2 errores §2.3
  (arista viva §2.3.4, draft 0° §2.3.6) · dado APROBADO — t_c 8.5 s (≈ el 8.4 s del
  libro que el gate ya validaba), 0 errores, draft 1.5° Tabla 2.14 · 13 estaciones
  visibles (0-12), la 1 activa · ORDEN_GATE VERDE EXIT=0 · censo IGUAL (8/41/46) ·
  build iangpu ✓ 27 s.
- evidencia: forja-shots/dado-e1/{01-dado-macizo-viewport,02-ciclo-panel}.png —
  revisadas con ojos (un artefacto del arnés cazado y retomado: press('f') activaba
  FILLET) · entregadas a /mnt/c/Users/sebas/Downloads (dado-e1-*.png) y
  /mnt/e/forja-videos de iangpu.
- preguntas abiertas: estación 2 (economía: ¿cuántas cavidades para 100k/año?) es la
  siguiente orden natural; el TDZ del primer intento (loadDado antes de cursoSet) se
  cazó ANTES de romper nada — la regla del archivo lo advertía.
