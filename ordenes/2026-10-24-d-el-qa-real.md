# ORDEN D: EL QA REAL — determinismo, banco nocturno en el navegador, piezas rotas a propósito y números dorados

ESTADO: hoy
PRIORIDAD: 1

BASE: (el agente pone `git rev-parse --short HEAD` tras `git merge --ff-only main`)

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

## CREA
- scripts/qa-huella.cjs
- scripts/qa-dorados.cjs
- scripts/qa-dorados/1594C-Box.json
- scripts/qa-fabrica-rotos.cjs
- scripts/qa-banco.cjs
- scripts/qa-LEEME.md
- test-parts/rotos/

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

## CIERRE (se llena al terminar)
