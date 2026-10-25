# ORDEN D: EL QA REAL — determinismo, banco nocturno en el navegador, piezas rotas a propósito y números dorados

ESTADO: hoy
PRIORIDAD: 1

BASE: eeeb24e (el worktree nació en origin/main cc86a8a, 3 commits de fogata que main local no tiene y 101 atrás: el ff-only no era posible; `git reset --hard main` en mi rama — los 3 commits siguen en origin/main)

OBJETIVO: ian: «tenemos capacidad de desarrollo, falta coordinación y QA real». Hoy nada corre solo: 0 `*.test.ts` en `src/forja/mold/`,
el gate del CAD sin cambios desde agosto, y el runner del camino mide que algo APAREZCA (8/9 con un molde que salió de otra pieza en la
filmadora). El debate falló (juez C, D4): el certificado corre en el BUILD DEL NAVEGADOR (node tesela y orienta distinto), no en node;
por commit solo pruebas puras + hash ×3; los relojes, de noche. Esta orden deja el QA que mide a las demás órdenes desde mañana.

## LO QUE SE CONSTRUYE
1. **Gate de determinismo** (`scripts/qa-huella.cjs`): carga la 1594C Box en la app (copia dada por URL), arma el molde en tiempo real,
   lee `__forgeBrep.moldGeom()` + lo que defina la pieza/el molde (roles, cajas, volúmenes redondeados a 0.01 mm) y saca un SHA-256.
   Corre 3 veces en contextos frescos: los tres hashes iguales = VERDE. Distintos = ROJO con el diff de qué rol cambió. (Hoy sabemos que
   el reloj virtual congelado rompía esto: es exactamente lo que debe cazar).
2. **Números dorados** (`scripts/qa-dorados.cjs` + `scripts/qa-dorados/1594C-Box.json`): de la misma corrida, ±5 %: clamp (t y % de la
   máquina), t de soporte, n de pilares, flecha, F de expulsión, t_c (placa y barra si ya existe), número de pines, número de tramos de
   agua, la holgura agua-barreno mínima (3.49), apertura y carrera. Si un número se mueve, el gate dice cuál, de cuánto a cuánto, y
   SALE ROJO; re-grabar exige un `--regrabar "razón"` que deja la razón en el JSON. (Al fusionar la orden B el clamp DEBE salir rojo:
   esa es la prueba de que muerde).
3. **Piezas rotas a propósito** (`test-parts/rotos/` + el script que las fabrica, `scripts/qa-fabrica-rotos.cjs`): 5 fixtures derivados de
   piezas sanas del repo: (a) STL con un triángulo borrado (abierta), (b) STL con normales invertidas, (c) STL escalado a pulgadas
   (÷25.4), (d) dos sólidos en un archivo, (e) la tapa con snaps tal cual (contrasalidas). Cada una con su ORÁCULO escrito (qué DEBE
   pasar: rechazar con razón / pedir dato). Hoy casi todas «pasan»: el banco debe decirlo en ROJO hasta que la orden C las detenga.
4. **El banco nocturno EN EL NAVEGADOR** (`scripts/qa-banco.cjs`): recorre una lista (por defecto: la Box + los 5 rotos + 3 Hammond de
   `test-parts/inyeccion-reales/`), con flock del GPU, un contexto fresco por pieza, y escribe un **acta HTML** (`/home/ian/el-plan/qa/
   <fecha>/acta.html`) con, por pieza: matrícula, ¿armó molde?, hash, números dorados vs medidos, y UN still 4K del paso que importa.
   Un fixture roto en VERDE = la corrida entera se marca «NO CONFIABLE» (par de control obligatorio). Un comando para el cron de la noche
   y otro para «solo la Box» (~10 min) que cualquier agente corre antes de su commit.
5. **Cómo lo usa otra sesión**: un `scripts/qa-LEEME.md` corto: qué comando, cuánto tarda, qué significa cada color, cómo re-grabar.

## YA-EXISTE
- `scripts/camino-runner.cjs`, `scripts/forja-drive.cjs`, `scripts/filma-camino.cjs` (reloj virtual, seguro de pines), la API
  `__forgeBrep` (`moldGeom`, `moldSolidCollisions`, `animZ`, `inspeccion.*`), `scripts/verif-matricula-test.cjs`, `matricula.ts`.

## TOCA
- (nada de src/; si de verdad necesitas exponer un dato en `__forgeBrep`, ENMIENDA con la razón y una línea)
- src/forja/brep/ForgeBRepStudio.tsx
  (UNA línea + su comentario, justo debajo de `const mold = useMoldStudio(…)`: ver ENMIENDA 2026-10-24)

## CREA
- scripts/qa-huella.cjs
- scripts/qa-dorados.cjs
- scripts/qa-dorados/1594C-Box.json
- scripts/qa-fabrica-rotos.cjs
- scripts/qa-banco.cjs
- scripts/qa-LEEME.md
- test-parts/rotos/
  (el juez compara rutas EXACTAS: cada archivo va abajo — ENMIENDA 2026-10-24)
- test-parts/rotos/00-sana-box.stl
- test-parts/rotos/00-sana-box.oraculo.json
- test-parts/rotos/01-abierta.stl
- test-parts/rotos/01-abierta.oraculo.json
- test-parts/rotos/02-normales-invertidas.stl
- test-parts/rotos/02-normales-invertidas.oraculo.json
- test-parts/rotos/03-pulgadas.stl
- test-parts/rotos/03-pulgadas.oraculo.json
- test-parts/rotos/04-dos-cuerpos.stl
- test-parts/rotos/04-dos-cuerpos.oraculo.json
- test-parts/rotos/05-tapa-snaps.stp
- test-parts/rotos/05-tapa-snaps.oraculo.json

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA
- Gate VERDE.
- La huella ×3 de main de hoy: tres hashes iguales (en el acta).
- El acta HTML de una corrida con la Box + los 5 rotos: los rotos que hoy pasan salen ROJOS con su oráculo; la Box VERDE con sus dorados.
  Abres el acta (o su captura) con Read y la juzgas.
- Par de control del gate de dorados: cambiar a mano un número dorado en una copia del JSON → el gate sale ROJO diciendo cuál.

## ENMIENDA 2026-10-24 · una línea en ForgeBRepStudio.tsx (región: debajo de `const mold = useMoldStudio`, ~L3974)
- **Qué**: `window.__qaForja = { ciclo, intake, moldParts, revision, lentes, piezaMalla }` asignado en cada render (referencias, sin
  cómputo). Toda la cuenta (volumen con signo por cuerpo, los números dorados) la hacen los scripts de QA dentro de la página.
- **Por qué**: (1) `moldGeom()` da solo CAJAS: una broca que no entró, un barreno de agua que no cortó o un inserto que salió hueco no
  mueven la caja de su placa — la huella sin volumen no los ve (el cubo salió verde con placas VACÍAS, R93). Ninguna llave de
  `__forgeBrep` entrega posiciones. (2) Los números dorados (clamp, soporte, pilares, flecha, F de expulsión, t_c, tramos, carrera)
  viven en el ciclo y en el dictamen, no en `__forgeBrep`; leerlos del TEXTO de la hoja ataría el gate a rótulos que la orden A apaga.
  (3) El objeto `__forgeBrep` se crea en un efecto cuyas deps no traen `moldParts` ni `mold.ciclo` (grep de la línea ~7095; por eso
  `focoMolde` lee un ref, dice su comentario): un getter nuevo ahí podría leer el acero viejo. La asignación en el render siempre
  trae lo vivo.
- **Región**: no toca la hoja (A ~L4070), ni `abrirArchivo` (C ~L5220), ni el expediente (A ~L10040), ni el Foco (coordinador).
- **Y los fixtures con nombre**: `orden-gate.cjs` ampara rutas exactas, no carpetas; los 12 archivos de `test-parts/rotos/` (6 piezas
  + 6 oráculos, 1.7 MB) van uno por uno en CREA. La 05 es copia byte a byte de `1594C Lid.stp` (187 KB): así la carpeta se basta sola.

## CIERRE (2026-10-24 · MEDIDO, no contado)

**Orden vs entregado** — los 5 puntos, en el navegador (build de producción de forja-dev7 = `eeeb24e` + la línea de la ENMIENDA,
servido en iangpu :4270, GPU `ANGLE … D3D12 (NVIDIA GeForce RTX 4070 Ti)`):
1. **Huella** (`scripts/qa-huella.cjs`): firma pieza (kernel) + **75 cuerpos** del molde (caja, triángulos y VOLUMEN CON SIGNO de
   cada malla) + la leyenda del molde + el Foco + los 18 números dorados → SHA-256. **Huella ×3 de main hoy: `b9d3e4d677853d34` ×3**
   (acero `c2c74622235abd7e`); la misma en **12 corridas** de 5 vueltas distintas (huella-control-1, banco-2 ×2, banco-3 ×3, banco-4 ×3,
   box-final ×3). La primera vuelta ×3 con la firma sin dorados: `c66ac184b7934319` ×3, 372 s. **Par de control**: la falla del
   2026-10-23 reproducida (reloj virtual congelado antes de MOLDE, sin los 40 ms de la filmadora) → huella `a7c2b9c06540e089` (igual
   las 2 veces), **162 diferencias**: 0 pines, partes 75 → 63, «manda la pieza» 21.7 → **2350.3 s**, F de expulsión 3,882 → **40,397 N**,
   máquina 150 → 250 t — exactamente el molde «de otra pieza» del 10-23. **MUERDE.** (Con los 40 ms la carrera NO se da: misma
   huella que la sana — la primera versión del control no mordía y por eso se rehízo.)
2. **Dorados** (`scripts/qa-dorados.cjs` + `scripts/qa-dorados/1594C-Box.json`): 18 números del MOTOR (no del rótulo), ±5 %:
   clamp 3.4041 t · 2.3 % de 150 t · 1 cav · soporte 22 mm · 1 pilar · flecha 0.0057 mm · F 3,882 N · t_c placa 134.463 s · pared
   21.7 s · bebedero 75.7 s · 8 pines · 16 tramos · holgura agua 3.49 mm · apertura 135.4 · carrera 41.3 pedida / 46 libre · 6 ✗ del
   dictamen. La barra (Eq 9.6) del POSTE no existe aún en el motor: no se graba (está dicho en la cita de `tcPlacaMaxS`).
   **Par de control**: automático (`--control`) clampT 3.4041 → 3.74451 en una copia → ROJO nombrando `clampT`; a mano, copia con
   nPilares 1 → 2 → `DORADOS_GATE: ROJO · se movió: nPilares 2 → 1` (−50 %), exit 1. **Al fusionar B, clamp/soporte/pilares/flecha
   DEBEN salir rojos** (B los mueve a propósito): se re-graba con `--regrabar "razón"`.
3. **Piezas rotas** (`scripts/qa-fabrica-rotos.cjs` → `test-parts/rotos/`, 12 archivos, 1.7 MB, deterministas byte a byte en 2
   vueltas): 00 sana (CONTROL) · 01 un triángulo borrado (frontera 3) · 02 normales al revés (vol −55,771.58 mm³) · 03 ÷25.4
   (2.6 × 4.19 × 1.31 mm) · 04 caja + tapa (2 componentes) · 05 la tapa con snaps tal cual. Cada defecto MEDIDO con `matricula.ts`
   al fabricarla (si no trae el defecto que dice, la fábrica sale con 1) y cada una con su oráculo escrito (`NN.oraculo.json`).
4. **Banco** (`scripts/qa-banco.cjs`): un navegador fresco por pieza, turno del GPU por pieza (la Box ×3 + su control en UN turno),
   acta HTML + PNG + JSON. Comandos: `--lista box` (antes de un commit) · `--lista rotos` · `--lista noche` (cron, + 3 Hammond).
5. **`scripts/qa-LEEME.md`**: comandos, tiempos medidos, colores, cómo re-grabar, cómo agregar un roto, gotchas.

**El acta de hoy** — `/home/ian/el-plan/qa/2026-10-24/acta.html` (+ `acta.png`, `acta.json`, `stills/` 4K, `corridas/`), abierta
con Read: **NO CONFIABLE · ROJO** — Box: huella ×3 VERDE (su control muerde), dorados VERDE (su control muerde) · **5 de 5 piezas
rotas pasaron la puerta** · el control sano pasó. Lo que la app hizo con cada una (los stills lo enseñan):
- 01 abierta: la cargó con 3 aristas de frontera y no dijo nada · 02 al revés: volumen −55,771.58 mm³, se ve normal, nada ·
  03 pulgadas: cotas «ancho 2.6 mm · largo 4.2 mm · alto 1.3 mm», sin preguntar · 04 dos cuerpos: 2 componentes medidos como una
  pieza · 05 tapa con snaps: **armó el molde completo (E8, 68 roles) y dio cotización en el expediente**.
- La Box sola (`--lista box`, el comando de antes de un commit): VERDE en **438 s** (`/home/ian/el-plan-dev7/qa/box-final/acta.html`).

**Tiempos medidos** (GPU compartida; se anotan, no se juzgan): corrida de la Box ≈ 2 min (molde 84–121 s); huella ×3 = 372 s;
banco «box» 438 s; banco «rotos» 950 s de pared (Box ×3 + control 7.4 min de GPU, 5 STL 48 s, tapa ≈ 2.5 min). Esa tarde cada turno
de `gpu.lock` esperó 15–40 min (A, B, C, E y un lote de LLM de `/home/ian/llm/marcha` que retuvo el candado ~40 min).

**Errores míos que el propio QA cazó (y quedaron arreglados)**: (a) la primera acta tenía 3 de 4 rotos «detenidos»: el oráculo
/abiert/ se cumplía con el NOMBRE del archivo (`01-abierta`) que la app escribe en pantalla → los rotos se sueltan como `pieza.stl`
y el nombre se borra del texto; (b) la matrícula de la página decía «abierta» la Box sana (8 aristas): soldaba exacto y contaba
los 8 triángulos degenerados → ahora suelda a 1e-6·diagonal y los descarta, como `matricula.ts` (validada en node: 0/3/0/0/0 de
frontera, −55,771.58, 2 componentes). (c) Escribí al repo PRINCIPAL de iangpu sin querer: `public/fonts` de TODAS las copias
forja-devN es symlink a `/home/ian/Orkesta/la-forja/public/fonts`; el `rsync public/fonts/` de §6 dejó ahí 8 woff2 sin seguimiento
(ese repo está en 3e61f10). No los borré: las otras 5 copias los usan por el mismo symlink.

**tsc**: 67 → 67 (la diferencia con `norm` sale vacía). **El cubo**: 267/267 después del último cambio de src. **ACTA R94**: no aplica
(ningún literal del cubo cambió). **Gate**: `node scripts/orden-gate.cjs` → VERDE.

**Visto, es de otras órdenes (no lo toqué)**:
- **C**: la regla «diagonal < 5 mm → ¿pulgadas?» NO caza la 1594C Box en pulgadas: su diagonal es **5.10 mm** (el ejemplo exacto
  del red team queda 0.1 mm arriba). El fixture 03 quedará rojo con esa regla.
- **Coordinador (de nadie del reparto)**: los tornillos del lado NÚCLEO salen con volumen con signo **negativo** (−12,175.78 mm³
  contra +14,578.96 del lado cavidad): esa malla está al revés/espejada. La huella lo ve; nadie más lo mide.
- **Coordinador**: la carrera de la E2 sigue en la APP (el temporizador nace con la pieza maciza); en tiempo real no se da (12/12
  iguales), pero cualquier arnés que congele el reloj antes de MOLDE arma el molde de otra pieza. Si alguien la arregla, el control
  de la huella deja de morder: cambiarlo, no borrarlo (dicho en el LEEME).
- **Coordinador**: el `__forgeBrep` corre telemetría a `/api/telemetry/events` (404 en un preview, ruido filtrado) — con el nombre
  de la pieza: lo dijo el abogado del debate.

**Preguntas para ian**
1. *La puerta que hoy nunca dice no.* Le aventamos a La Forja cinco piezas rotas a propósito (una caja de 4 mm, una con un hoyo,
   una al revés, caja y tapa juntas, y la tapa con ganchos) y las cinco pasaron; la tapa hasta salió con molde y con precio. Mientras
   eso pase, el banco de la noche dice «NO CONFIABLE» aunque todo lo demás salga verde. **Recomiendo** no enseñar ningún verde del
   banco a un cliente hasta que la orden C deje las cinco en rojo.
2. *La caja en pulgadas.* Si alguien exporta la 1594C en pulgadas, su diagonal mide 5.1 «mm» y la regla de C («menos de 5 mm,
   pregunta») la deja pasar por una décima. **Recomiendo** que C pregunte desde 10 mm (regla de Hefestos, sin cita; medido: de los 73
   sólidos Hammond de `intake.json` el más chico tiene 35.3 mm de diagonal — 1593D#2, una puerta de 29 × 1.7 × 20).
3. *El turno de la noche.* El banco nocturno (≈ 25 min de GPU) necesita que nadie más tenga el GPU, y hoy un lote de pruebas de LLM
   lo retuvo 40 min. **Recomiendo** el cron a las 2:30 sobre un build de main, y que los lotes de LLM no corran de 2 a 4.

**Archivos (para la fusión)**: TOCA `src/forja/brep/ForgeBRepStudio.tsx` (+2 líneas, ~L3974) · `ordenes/2026-10-24-d-el-qa-real.md`.
CREA `scripts/qa-huella.cjs` · `scripts/qa-dorados.cjs` · `scripts/qa-dorados/1594C-Box.json` · `scripts/qa-fabrica-rotos.cjs` ·
`scripts/qa-banco.cjs` · `scripts/qa-LEEME.md` · `test-parts/rotos/` (12). Pendiente: el cron (lo pone el coordinador); la primera
corrida `--lista noche` con las 3 Hammond (de noche; no se corrió de día por la regla del GPU); re-grabar dorados al fusionar B.

