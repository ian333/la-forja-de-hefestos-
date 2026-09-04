# ORDEN: EL RUNNER DEL CAMINO — los estados del happy path los escribe la máquina, no yo

BASE: f81ec7a

OBJETIVO: ian (2026-09-04): «abre la orden del runner». Hoy `caminos/la-carcasa-de-mitsubishi.md`
trae los 8 estados escritos a MANO con lo que medimos una vez; mañana alguien arregla la partición
y el tablero sigue diciendo «falla» hasta que alguien se acuerde. Al final de esta orden un solo
comando recorre producción paso a paso con el arnés, mira en el DOM lo que cada paso promete
ver, reescribe los estados en el archivo del camino, deja una captura por paso y regenera el
tablero. Temis deja de opinar y empieza a medir.

Decisiones de ian que fijan el camino (2026-09-04): promesa = DISEÑADO Y COTIZADO («de creado
obviamente no»); el video del enfriamiento va en el expediente; 1594C Box es la pieza controlada.

## EJERCICIOS
- drop-real · El arnés suelta un archivo como lo hace un humano · `forja-drive.cjs` gesto `drop` · el `DataTransfer` se construye DENTRO de la página (x4 lo pagó: `page.dispatchEvent` no cruza contextos y el drop llega vacío); el archivo va por base64 al evaluate. `upload` (input) y `loadstep` (hook) siguen existiendo: son otras puertas, no la del ingeniero
- ve-o-no-ve · Cada paso declara lo que se ve como algo MEDIBLE · `## RUNNER` en el camino + gesto `expect` en el arnés · una línea por paso `n · gestos JSON · ve: <testid | expresión>`; `expect` escribe pasa/falla con su label en meta.json. Lo que no se puede medir no es un paso, es un deseo
- el-camino-se-recorre · Un comando recorre los 8 pasos contra producción · `scripts/camino-runner.cjs` · `URL=… node scripts/camino-runner.cjs caminos/<slug>.md` → arma el actions.json desde `## RUNNER`, corre forja-drive (spawn, mismo motor, cero copia), lee meta.json y saca la lista de pasos con veredicto y una captura por paso
- el-archivo-se-reescribe · Los estados del camino los escribe la máquina · `caminos/*.md` · ok = pasa; falla = el primer paso que no pasa; bloqueado = no pasa y hay un `falla` antes; parcial = pasa parte de sus checks. Reescribe `## PASOS` sin tocar gesto/se-ve/ticket y deja `## MEDIDO` con fecha, URL, commit servido y máquina. Luego corre temis-tablero
- medido-donde-hay-gpu · El paso 3 (campo en ≤2.5 s) se mide en iangpu, no en SwiftShader · iangpu · el runner corre desde iangpu con la receta GPU del CLAUDE.md contra la URL de producción; la laptop solo desarrolla y mide presencia. Un rojo por lentitud de la laptop sería un rojo falso — el veneno de x4 otra vez
- sin-regresion · El tablero muestra lo medido y nada se rompe · gate · temis-tablero corre, orden-gate VERDE, censo Canvas 8→8, deploy y captura del lobby en producción con los estados que puso la máquina

## YA-EXISTE (prueba de ausencia)
- `scripts/forja-drive.cjs`: 22 gestos (click/drag/key/type/upload/hook/probe/loadstep/savedoc…),
  captura por gesto, meta.json, detector de remount. Es el motor; el runner NO lo copia, lo
  invoca. Le faltan exactamente dos gestos: `drop` (DataTransfer real) y `expect` (veredicto).
- `ordenes/2026-09-01-x4-el-happy-path.md` § CIERRE: el drop REAL ya se hizo una vez con un
  DataTransfer construido dentro de la página (24,884 bytes, 3 cotas). Ese código vivió en un
  guion de sesión y se perdió; aquí se vuelve gesto del arnés para que no se pierda dos veces.
- `scripts/temis-tablero.cjs` § EL CAMINO: parsea `## PASOS` (`n · gesto · se ve · estado ·
  ticket`) y `campo()`/`seccion()`; una sección `## RUNNER` nueva la ignora sin romperse.
- `scripts/temis-camino-drive` NO existe; ningún guion recorre un camino; ningún guion
  reescribe un `.md` de caminos. `camino/ver-camino.cjs` (scratchpad de la orden anterior)
  solo miraba el tablero, no la Forja.
- Test-ids que ya existen en la Forja para los checks: `lienzo-vacio-abrir`, `.fb-root` (drop),
  `mold-cycle-driver`, los del Foco (x3/x6) y del dictamen. Los que falten se AGREGAN como
  `data-testid` (no cambian el DOM visible).

## TOCA
- scripts/forja-drive.cjs
- scripts/temis-tablero.cjs
- src/forja/brep/TemisBoard.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- caminos/la-carcasa-de-mitsubishi.md
- ordenes/DESPUES-DE-V1.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-04-el-runner-del-camino.md
- ordenes/2026-09-04-la-forja-sin-luz.md
- scripts/camino-runner.cjs
- public/evidencia/2026-09-04-el-runner-del-camino/resultados.json
- public/evidencia/2026-09-04-el-runner-del-camino/paso-1.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-2.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-3.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-4.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-5.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-6.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-7.png
- public/evidencia/2026-09-04-el-runner-del-camino/paso-8.png
- public/evidencia/2026-09-04-el-runner-del-camino/temis-medido.png

## BORRA
- (nada)

## PREEXISTENTE
- scripts/guiones/roba.txt
- src/cinematic/CinematicMolecule.tsx
- videos/mol-etoh-te-roba-el-agua.json
- public/comando/catalogo.json
- public/comando/produccion.json
- scripts/salud.sh

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- `URL=https://university.gaiaprime.com.mx node scripts/camino-runner.cjs caminos/la-carcasa-de-mitsubishi.md`
  corrido DESDE iangpu termina con 8 veredictos y 8 capturas; el `.md` cambia solo en la
  columna estado y en `## MEDIDO`. Esperado hoy: 4/8 ok y se rompe en el 5 (si el runner dice
  otra cosa, o el runner miente o el camino mentía — las dos se investigan, ninguna se tapa).
- Prueba de que el runner NO es un sí automático: un check cambiado a propósito a un testid
  inexistente debe poner ese paso en `falla`.
- `node scripts/temis-tablero.cjs` imprime el camino con los estados nuevos; `node
  scripts/orden-gate.cjs` VERDE; censo Canvas 8→8.
- deploy + captura del lobby en producción con la franja EL CAMINO mostrando `medido <fecha>`.

## CIERRE (se llena al terminar)
**6/6 EN VERDE · medido por la máquina en producción desde iangpu · orden-gate VERDE · censo Canvas 8→8.**

Un comando recorre el happy path y escribe lo que vio:
`URL=https://university.gaiaprime.com.mx/forja-brep.html MAQUINA=iangpu node scripts/camino-runner.cjs caminos/la-carcasa-de-mitsubishi.md --evidencia public/evidencia/<orden>`
→ 8 pasos · 17 acciones · 14 checks · 55 s en iangpu (69 s en la laptop) → `## PASOS` reescrito +
`- runner · 2026-09-04 20:11 UTC · … · servido 6026a20 · iangpu · 4/8 ok · se rompe en el paso 5 · 1:2/2 2:2/2 3:3/3 4:2/2 5:0/1 6:0/1 7:0/1 8:1/2`
→ el tablero en producción dice «medido 2026-09-04 20:11 en iangpu · 6026a20» junto al camino.

- orden vs entregado: idéntico, más dos cosas chicas que la orden no nombró: `MAQUINA=` (los dos WSL
  de ian se llaman «Ian» y `os.hostname()` no distinguía iangpu de la laptop) y el tablero enseña
  «declarado a mano» cuando un camino no tiene línea del runner (para que nunca se confunda lo
  medido con lo recordado).
- números: lo MEDIDO coincidió con lo DECLARADO a mano (4/8 · rompe en 5 · 6-7 bloqueados · 8
  parcial). El archivo no mentía; ahora lo sabemos porque una máquina lo dijo. ENFRIAMIENTO:
  0.3 s declarados por el módulo en iangpu (0.7 s en la laptop — el campo es CPU, no GPU).
  CONTROL NEGATIVO: un testid inexistente a propósito en el paso 2 lo bajó a PARCIAL (1/2).
- evidencia: `public/evidencia/2026-09-04-el-runner-del-camino/` paso-1..8.png (capturas de iangpu
  contra producción: lienzo limpio · pieza con 3 cotas · campo violeta + LA FICHA · dictamen 5 VIOLAN
  · y 5-8 solo el dictamen, sin partición ni expediente — rojo honesto) + temis-medido.png (lobby en
  producción) + resultados.json.
- defectos pagados: (1) `waitForFunction(cond, opts)` — Playwright espera `(cond, arg, opts)`, así
  que TODOS los timeouts eran 30 s y la primera corrida tardó 228 s; (2) el check del tiempo leía
  «233 s» de la leyenda («el peor: 233 s1594C…») en vez de los «0.3 s» del módulo: la regex ahora
  ancla en «vóxeles · N s». Dos lecciones del mismo tipo: un check mal escrito reprueba lo correcto.
- HALLAZGO para T7/T6 (no se tocó, es de ellos): el STEP soltado entra por `abrirArchivo` →
  `mallaDesdeArchivo` = **malla del operador, sin caras de kernel** (la barra de estado lo dice:
  «para acotar o partir, importa un STEP» — y SÍ era un STEP). La partición de verdad (T7
  part-parte-de-verdad) necesita el B-Rep: o el drop conserva el sólido del STEP, o el paso 5 se
  queda en la silueta por malla. Decisión de ian.
- contrato escrito en el camino (`## RUNNER`): T7 expone `linea-particion`, T6 `molde-de-la-pieza`,
  T7/T5 `planos-del-molde` y `expediente-de-la-pieza`. Cuando existan, el runner los pone en verde
  solo — nadie edita el archivo.
- preguntas abiertas: ¿el runner corre solo (cron en iangpu, o al final de cada deploy)? Hoy se corre
  a mano. Y la PC que viene: cuando esté, `MAQUINA=<nombre>` y listo.
