# ORDEN E: EL REVISOR — una IA (Fable) revisa cada expediente con rúbrica, y otra sesión lo puede llevar sola

ESTADO: hoy
PRIORIDAD: 1

BASE: (el agente pone `git rev-parse --short HEAD` tras `git merge --ff-only main`)

OBJETIVO: ian (2026-10-24): «quién firma: quiero que haya una IA con Fable revisando; por eso debería quedar funcionando para que un
hermano tuyo la lleve». El revisor es el CONTROL DE CALIDAD de cada expediente antes de entregarlo a una planta: no aprueba la
fabricación (eso lo firma el fabricante del molde), pero ningún expediente sale sin su revisión. Debe correr con UN comando desde una
sesión de Claude Code en la laptop (en iangpu no hay `claude`), usando iangpu para capturar y Fable para juzgar.

## LO QUE SE CONSTRUYE
1. **La captura** (`scripts/revisor/captura.cjs`): dado un STEP (y opcionalmente el intake: material, volumen, máquina), corre el camino
   en iangpu contra un build de main (preview :4199 de `/home/ian/el-plan/dist-dev3`, o la URL que se le pase) con flock del GPU y deja
   un PAQUETE en `/home/ian/el-plan/revisiones/<folio>/`: stills 4K por paso (02, 03, 04, 06 final, 07b y los 4 puntos, 08 página 0 y
   la hoja de análisis, 09), los números de `__forgeBrep` en `numeros.json` (los mismos que la orden D llama dorados), el expediente
   HTML descargado, y el **folio** = sesión · commit (de `temis-deploy.json` o del build) · SHA-256 del STEP. Reusa `filma-camino.cjs`/
   `camino-runner.cjs`; no inventes otro manejador de la app.
2. **La rúbrica** (`scripts/revisor/RUBRICA.md`): lo que el revisor verifica, sacado del debate (00-PLAN.md y los jueces): coherencia de
   números entre pasos (el mismo 3.49 en 04/07e/08, el mismo ciclo en 03/06/08/09, el mismo tonelaje en 08 y 09); que no aparezca nada
   de la lista de apagones (USD, «puntos débiles», «100/100», «PP» sobre otro material, «50 de 50», cajetín inventado); que lo no
   revisado se diga; la escala del acero declarada; BORRADOR mientras haya firmas pendientes; contrasalidas detenidas; y su juicio con
   los ojos de cada still (¿lo que dice la tarjeta se ve en el 3D?). Cada renglón ◆ (detiene) / ◇ (se entrega con nota) / ✓.
3. **El revisor** (la skill `.claude/skills/revisor-forja/SKILL.md`): una sesión de Claude Code la invoca con `/revisor-forja <ruta.stp>
   [intake]`; la skill (a) corre la captura en iangpu, (b) trae el paquete a la laptop, (c) lanza UN subagente con `model: fable` que lee
   la rúbrica y TODOS los stills con Read y escribe `REVISION.md` (renglón por renglón con su evidencia: still o número) y un veredicto
   «SE ENTREGA / SE ENTREGA CON NOTAS / SE DETIENE», (d) firma al pie: «Revisó: La Forja · revisor automático (Claude Fable 5.1) · fecha ·
   folio · esto no aprueba la fabricación: la aprueba el fabricante del molde», (e) deja el paquete + REVISION.md en
   `Downloads/revisiones/<folio>/` (en los dos PCs). Si Fable no está disponible (límite), cae a Opus y lo dice en la firma.
4. **El manual** (`scripts/revisor/LEEME.md`): para «un hermano»: qué pedirle al cliente, el comando, cuánto tarda, qué hacer con cada
   veredicto, y qué NO decir.

## YA-EXISTE
- `scripts/filma-camino.cjs` (reloj virtual + seguro de pines), `scripts/camino-runner.cjs`, `scripts/forja-drive.cjs`, el expediente
  descargable (`btn-expediente-descargar`), las skills del repo en `.claude/skills/` (ejemplo: `circuito-verificado`).
- La orden D construye en paralelo los «números dorados»: usa el mismo nombre de campos si puedes, pero no dependas de su código.

## TOCA
- (nada de src/)

## CREA
- .claude/skills/revisor-forja/SKILL.md
- scripts/revisor/captura.cjs
- scripts/revisor/RUBRICA.md
- scripts/revisor/LEEME.md

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA
- Gate VERDE.
- UNA revisión completa de punta a punta sobre la `1594C Box.stp` con el build de main de hoy: el paquete, `REVISION.md` escrito por el
  subagente Fable (o Opus si Fable no está, dicho), y su veredicto. Con lo que hay hoy DEBE salir «SE DETIENE» o «CON NOTAS» (USD,
  «puntos débiles», 134 s…): si sale «SE ENTREGA» limpio, la rúbrica está mal (par de control).
- `Downloads/revisiones/<folio>/` en los dos PCs.

## CIERRE (se llena al terminar)
