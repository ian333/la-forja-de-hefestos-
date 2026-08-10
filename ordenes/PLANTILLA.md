# ORDEN: <título corto>

> Copia este archivo a `ordenes/<AAAA-MM-DD>-<slug>.md` ANTES de trabajar solo.
> El juez es `node scripts/orden-gate.cjs` — mecánico, sin apelación: archivo
> cambiado que no esté declarado abajo = ROJO. Si a medio camino "necesitas"
> crear algo no declarado: ALTO y pregunta a ian; la orden se enmienda, no se
> improvisa. Formato de las listas: una ruta por línea, con `- `. `- (nada)`
> es válido y es lo NORMAL en CREA.

BASE: <commit sha del que parte el trabajo — `git rev-parse HEAD`>

OBJETIVO: <1-2 líneas: qué queda funcionando al final>

## YA-EXISTE (prueba de ausencia)
<QUÉ buscaste y QUÉ encontraste cercano, con archivo:símbolo. Esta sección es
la razón de ser de la orden: si algo parecido ya existe, el trabajo es un DIFF
sobre eso, no un archivo nuevo.>

## TOCA
- <archivos existentes que se MODIFICAN>

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
<rutas ya sucias en el working tree ANTES de esta orden (git status al crearla).
El gate las ignora: no son de esta orden ni la bloquean.>
- (nada)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- <gate que debe salir verde, con su comando>
- <captura/número esperado, a qué resolución>
- censo esperado: <canvas/vite/html suben, bajan o igual>

## CIERRE (se llena al terminar)
- orden vs entregado: <idéntico | desviaciones, cuáles y por qué>
- números: <salida real de los gates>
- evidencia: <rutas de capturas / logs>
- preguntas abiertas: <lo que NO se hizo por requerir decisión de ian>
