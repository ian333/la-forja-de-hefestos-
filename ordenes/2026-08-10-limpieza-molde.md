# ORDEN: el análisis del molde VIVE en el CAD — y las 4 pantallas duplicadas mueren

BASE: f6508be

OBJETIVO: los semáforos §4.3.3/§4.3.4, los números del molde y los invariantes se ven
DENTRO de ForgeBRepStudio (donde está el molde B-Rep real), y los 35 archivos del visor
duplicado desaparecen. El censo BAJA. Nada de geometría nueva.

## YA-EXISTE (prueba de ausencia)
- Visor 3D del molde con despiece/corte/apertura/rayos-X/sonda: `ForgeBRepStudio.tsx`
  (bag `mold` = `useMoldStudio.ts:645` — moldExpanded/moldSliceFrac/moldOpenOn/moldXray/
  moldSelected/moldCompAnalysis). NO se crea visor: se le CUELGA el análisis.
- Paneles DOM del molde: `MoldPanels.tsx` (CalcRows/MoldTreePanel/CursoPanel). El panel
  nuevo de análisis va AHÍ, mismo estilo.
- El pkg de moldMachine YA se calcula en el CAD y se TIRA: `useMoldStudio.ts:372`
  (loadFlaneraMold). Se guarda en estado en vez de tirarse — el mismo bug de
  contabilidad, versión React.
- El cerebro del análisis: `estudio-molde-datos.ts::construirMolde` (números+semáforos+
  stack+invariantes, todo analítico del pkg; la malla solo pinta el moldeo). SE QUEDA y
  el panel lo consume. `mallaCaja` vive en `lamina-seccion.ts:135` (se queda).
- Invariantes de caja dibujada mueren CON la pantalla: el CAD ya mide su verdad con
  colisiones/coordAudit/mold-tornillos (forja-gate).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- vite.config.ts
- deploy-atlas-build.sh

## CREA
- (nada)

## BORRA
- src/forja/mold/EstudioMolde.tsx
- src/forja/mold/EstudioVivo.tsx
- src/forja/mold/EstudioCiclo.tsx
- src/forja/mold/vista3d-agua.tsx
- src/forja/mold/vista3d-alabeo.tsx
- src/forja/mold/vista3d-apertura.tsx
- src/forja/mold/vista3d-corte.tsx
- src/forja/mold/vista3d-llenado.tsx
- src/forja/mold/vista3d-rotulo.tsx
- src/forja/mold/vista3d-comun.ts
- src/forja/mold/vista3d-agua-datos.ts
- src/forja/mold/vista3d-alabeo-datos.ts
- src/forja/mold/vista3d-apertura-datos.ts
- src/forja/mold/vista3d-corte-datos.ts
- src/forja/mold/vista3d-llenado-datos.ts
- src/forja/mold/estudio-vivo-datos.ts
- src/forja/mold/ciclo-datos.ts
- src/molde-main.tsx
- src/estudio-vivo-main.tsx
- src/ciclo-main.tsx
- src/vista3d-anim-main.tsx
- src/vista3d-campo-main.tsx
- src/vista3d-corte-main.tsx
- molde.html
- estudio-vivo.html
- ciclo.html
- vista3d-anim.html
- vista3d-campo.html
- vista3d-corte.html
- scripts/estudio-molde-ss.cjs
- scripts/estudio-vivo-ss.cjs
- scripts/ciclo-ss.cjs
- scripts/vista3d-anim-ss.cjs
- scripts/vista3d-campo-ss.cjs
- scripts/vista3d-corte-ss.cjs

## PREEXISTENTE
- scripts/guiones/butirico.txt
- src/cinematic/CinematicMolecule.tsx
- public/comando/produccion.json
- scripts/comando-catalogo.cjs

## EVIDENCIA (declarada antes de trabajar)
- `node scripts/orden-gate.cjs` → VERDE. Censo esperado: canvas src/forja 11→8,
  entradas vite 45→41, html raíz 52→46. TODO BAJA.
- build de producción en iangpu (`npx vite build`) termina sin error.
- captura del CAD real (forja-brep) con la flanera cargada mostrando el panel de
  análisis: 5 semáforos con estado+medido+límite (data-testid="mold-semaforo-*")
  y los números (data-testid="mold-analisis").
- deploy a university VERDE con el smoke ya SIN las 4 páginas muertas; las rutas
  borradas devuelven el index (ya no son entregables).
- ciclo-datos.ts y el eje de tiempo mueren con su pantalla; si el eje se quiere en el
  CAD es OTRA orden (git guarda el código: `git show 26bdd63:src/forja/mold/ciclo-datos.ts`).

## CIERRE (2026-08-10)
- orden vs entregado: IDÉNTICO. Una enmienda durante el trabajo: el gate cazó 2 archivos
  sucios de OTRA sesión (`public/comando/produccion.json`, `scripts/comando-catalogo.cjs`)
  que no estaban en PREEXISTENTE — se declararon (no se commitean, no son de esta orden).
- números: ORDEN_GATE VERDE (44 cambios, todos amparados) · censo canvas 11→8,
  vite 45→41, html 52→46 (todo BAJA, exacto a lo declarado) · `vite build` en iangpu
  ✓ 39.08 s · panel en el CAD real con GPU D3D12: 5 semáforos (2 ADVIERTE legítimos:
  daylight holgura 8 mm, shot 24 %), invariantes 8/8, flanera $5,700→$9,119 · $0.1173/pza.
- evidencia: `forja-shots/orden-limpieza/{01-cad-con-panel,03-panel-scrolled}.png` ·
  los 404 de consola son el poll conocido de `/mold-live.json` y el `REBUILD_ERR` es el
  documento vacío pre-flanera (ruido preexistente del flujo, no del panel).
- preguntas abiertas: (1) `useMoldLive.ts:62` también tira su pkg (mismo patrón) — se
  dejó fuera a propósito, es enmienda de una línea si se quiere la sesión viva con
  semáforos; (2) el eje de tiempo del CICLO murió con su pantalla — si se quiere en el
  CAD es otra orden (`git show 26bdd63:src/forja/mold/ciclo-datos.ts`).
