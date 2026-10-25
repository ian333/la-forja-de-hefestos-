# ORDEN E: EL REVISOR — una IA (Fable) revisa cada expediente con rúbrica, y otra sesión lo puede llevar sola

ESTADO: hoy
PRIORIDAD: 1

BASE: eeeb24e

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

## CIERRE (2026-10-24 · MEDIDO, no contado)

**BASE**: el worktree nació de `origin/main` (cc86a8a, 3 commits de fogata que `main` local no tiene) y `main` local (eeeb24e) ya
había divergido: el merge `--ff-only` no podía. La rama no traía trabajo propio y esos 3 commits viven en `origin/main`, así que se
alineó la rama con `main` con un reset duro (lo mismo que el ff pedía) → BASE eeeb24e. `.claude/` está en `.gitignore`: la skill
entra forzada al índice (sin eso la fusión no la llevaría al árbol principal).

**Orden vs entregado** (los 4 archivos de CREA, nada de src/):
1. `scripts/revisor/captura.cjs` — NO hay otro manejador: genera un `actions.json` y corre `scripts/forja-drive.cjs` (el motor de
   `camino-runner.cjs`) a 1536×864 × DPR 2.5 = **3840×2160**. Los gestos y esperas son los de `filma-camino.cjs`, con su seguro de
   pines (rc 3). Los datos salen por un BUZÓN HTTP en 127.0.0.1 (un `eval` de forja-drive solo deja 300 caracteres): texto VISIBLE
   por paso (opacidad > 0: el modo camino esconde con opacidad 0), `__forgeBrep` (moldGeom, focoMolde, recorrido, telemetría, animZ),
   el detalle de cada fila ✗ del dictamen, el texto de las 17 láminas y el **Blob exacto del botón Descargar** (interceptado en
   `URL.createObjectURL`). Folio = sid de la pestaña · commit (`--commit`, o `temis-deploy.json` declarado NO VERIFICADO si es más viejo
   que el build) · SHA-256 del STEP. Modos sin GPU: `--seco` (compila los 27 gestos y prueba el detector) y `--procesa <paquete>`.
2. `scripts/revisor/RUBRICA.md` — 34 renglones A1–G3 (papel, apagones, una sola verdad, alcance, escala, puerta, ojos), cada uno con
   su ◆/◇ y su cita (00-PLAN, jueces A/B/C, abogado); lo que no tiene cita dice «regla de Hefestos». Veredicto mecánico.
3. `.claude/skills/revisor-forja/SKILL.md` — `/revisor-forja <ruta.stp> [intake]`: sube, verifica el commit del build, captura en
   `flock gpu.lock`, trae el paquete a los DOS Downloads, lanza UN subagente `model: fable` (Opus si hay límite, dicho en la firma),
   verifica mecánicamente (34 renglones, 18 stills, veredicto = marcas, imagen-control) y firma.
4. `scripts/revisor/LEEME.md` — qué pedirle al cliente (orden de servicio + NDA antes del STEP), el comando, los tiempos medidos, qué
   hacer con cada veredicto, qué NO decir, fallas conocidas.

**Números (3 corridas sobre la 1594C Box contra el build de main en :4199)**
- El build: `temis-deploy.json` de `dist-dev3` dice 6f70032 (26-ago, viejo). Medido que es main: `rsync -rcn` de `src/` de main contra
  `forja-dev3/src` → 0 archivos de main distintos, y ningún archivo del src es más nuevo que el build (13:46:31 < 13:47:23) → `--commit 4373705`.
- Captura: 4.3 / 4.8 / 4.5 min · molde E8 + portamoldes en 87 / 96 / 85 s · 8 pines · 18/18 stills (3840×2160 medido en el JPEG) ·
  13 pasos · 17 láminas · expediente 10,963,874 bytes · 0 errores de forja-drive · GPU «ANGLE (… D3D12 (NVIDIA GeForce RTX 4070 Ti) …)».
  La corrida 3 esperó 10 min en la fila del GPU (otras órdenes).
- Revisión Fable (`claude-fable-5-1`): 12.3 min, 238 k tokens, 35 herramientas.

**LA REVISIÓN de punta a punta** — folio `evho29ev-mvn7yntb · 4373705 · 237f7aa389eb` ·
`Downloads/revisiones/2026-10-25-1594C-Box-237f7aa389eb-evho29ev-mvn7yntb/REVISION.md` (los dos PCs; copia en
`iangpu:/home/ian/el-plan/revisiones/`). **VEREDICTO: SE DETIENE · ◆ 14 · ◇ 10 · ✓ 8 · — 2**. Firmada «revisor automático (Claude Fable 5.1)».
Lo que detiene: sin folio impreso, sin BORRADOR con 5 firmas pendientes, palomita verde junto a «5 pendientes de firma», cajetín
ISO 2768-mK/Ra 0.8/H7-6H/«DIBUJÓ La Forja CAD» en las 8 láminas, 14 cifras «$» sin moneda, «0 puntos débiles», 70/100 y «DFM 100/100»
(mientras la cotización del MISMO expediente dice «DFM REPROBADO · 2 errores»), «clamp 2.3 % de 150 t», «50 de 50 puntos tocan»,
el acero junto al agua con dos verdades (dictamen ✗ 3.76 vs 4.76 con ⌀9.53 · inspección «cumple» 3.49 vs 3.17 con ⌀6.35), tres ciclos
sin conciliar (134 / 145.1 / 21.7 s), ninguna escala del acero declarada, y la imagen-control.

**Pares de control (los tres muerden)**
1. La Box de hoy NO sale «SE ENTREGA»: salió SE DETIENE con 14 ◆ (la orden lo exigía).
2. La imagen-control (`s06-molde-c`, lienzo 3D apagado bajo «el molde ENTERO»; su lugar se sortea y vive fuera del paquete hasta
   después de revisar) → Fable la marcó ◆ «la tarjeta habla del molde entero y no hay nada en el 3D». Revisión válida.
3. El detector de apagones (14 patrones) prueba cada patrón contra una frase sucia y una limpia antes de correr; en su primera prueba
   cazó su propio error (`13[3-6] s` pegaba en la ventana honesta «poste 65–136 s»).

**Lo que la captura encontró de la app (visto; es de otras órdenes, NO lo toqué)**
- **La apertura que sale 0.0** (inspección, `ForgeBRepStudio.tsx` ~L5440): la inspección LEE la apertura con `animZ('clamp')` 450 ms
  después de `estado(1,0)`. En la corrida 1 una captura 4K cayó en esa ventana, no hubo cuadro y el punto 4 dijo «El molde abre
  0.0 mm · ✗ NO CUMPLE» con el molde ABIERTO en pantalla (still en `iangpu:/home/ian/el-plan/revisiones/_invalido-…-wwwzqyu9-mvn6wbo4/`).
  Sin captura en esa ventana: «152.5 ✓». En una laptop lenta (un cuadro > 450 ms) el cliente vería «0.0 ✗». La captura ya lo esquiva.
- Placa expulsora (lámina 12, 116 mm de ancho): barrenos KO ⌀20 en X = −2 y X = 118, fuera de la placa (lo cazó Fable).
- Dos precios para el mismo molde cold-2placas × 1 cav: $11,827 (decisiones) vs $18,924 (EL DINERO).
- «pilares ⌀16» en la cotización vs «pilar guía ⌀25» en las láminas (hallazgo 10, sigue).
- El expediente fecha con UTC («2026-10-25» la noche del 24 en CDMX).
- `temis-deploy.json` de `dist-dev3` es el de `public/` (26-ago): ningún build local dice su commit.

**Pendientes**
- El intake (material/volumen/máquina) NO entra a la app: el camino no tiene dónde (solo la E1 del curso) y la orden no toca src. Se
  guarda y el revisor lo compara (C6). Cuando B/G pongan el intake en el camino, la captura lo debe alimentar.
- Lo cazó el revisor y ya quedó corregido en el código, NO en el paquete revisado (la revisión cita esos números tal cual): el
  patrón «50 de 50 puntos tocan» y el puntaje «70  /100» con doble espacio; la fecha del folio, ahora en CDMX.
- La rúbrica tiene una sola imagen-control (lienzo apagado). Faltan controles de texto (un still con «USD» sembrado).
- tsc: no aplica (cero archivos de `src/`; `tsconfig.json` incluye solo `src`). El cubo y el camino de la carcasa: no aplican (la orden no los lista).

**Preguntas para ian**
- **La firma del revisor.** Hoy dice «revisor automático (Claude Fable 5.1) · esto no aprueba la fabricación». El abogado pidió que
  nada diga «revisado» sin decir quién; la firma lo cumple (dice que es una IA). ¿Va así en el papel que recibe la planta, o la
  revisión es solo interna y a la planta le llega únicamente el expediente con su folio? Recomiendo: interna hasta que el expediente
  salga BORRADOR con folio (semana 3); después, la firma al pie de cada expediente.

**Archivos (para la fusión)**: CREA `scripts/revisor/captura.cjs`, `scripts/revisor/RUBRICA.md`, `scripts/revisor/LEEME.md`,
`.claude/skills/revisor-forja/SKILL.md` (forzada: `.claude/` está ignorado) · TOCA esta orden. Fuera del repo, en iangpu:
`/home/ian/el-plan/revisor/scripts/` (copia de trabajo que la skill re-sincroniza) y `/home/ian/el-plan/revisiones/` (paquetes,
`_control/`, `_entrada/`).
