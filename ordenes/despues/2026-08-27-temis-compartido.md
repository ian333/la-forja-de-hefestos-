# ORDEN: Temis compartido entre instancias de Claude

ESTADO: proximo
PRIORIDAD: 3

BASE: 673d485db8c67ff0ea0cd3a69b1bdda623e81bac

OBJETIVO: que ian pueda decirle a CUALQUIER Claude (el de esta máquina, el de Sinué,
el que sea) "revisa los tickets" y todos vean el MISMO tablero, tomen trabajo de ahí y
escriban de vuelta su avance — sin que ian tenga que repetir el contexto en cada sesión.

## YA-EXISTE (prueba de ausencia)
- `ordenes/*.md` + `scripts/temis-tablero.cjs` → el tablero YA es de archivos en git,
  así que dos Claudes con el MISMO repo ya comparten tickets por commit/pull.
- Redis vive en PRIME/ATLAS y ya se usa para el candado de deploy
  (`scripts/forja-deploy.sh --lock-check`) → hay dónde poner estado compartido en vivo.
- `public/temis.json` ya se publica en el lobby → hay dónde LEERLO sin repo.
- Lo que NO existe: un modo de que un Claude sin el repo lea/escriba tickets, ni
  un "quién tomó qué" que evite que dos trabajen lo mismo.

## PENDIENTE DE DECIDIR CON IAN (no improvisar)
- ¿El Claude de Sinué trabaja sobre ESTE repo o sobre otro? Si es el mismo, basta
  disciplina de pull/commit y una sección `TOMADO POR:` en la orden.
- Si es otro repo/máquina: el tablero tiene que salir del git. Opción barata:
  `temis.json` servido por ATLAS + un endpoint de escritura con Redis.

## TOCA
- scripts/temis-tablero.cjs
- ordenes/PLANTILLA.md

## CREA
- (nada)

## BORRA
- (nada)

## EVIDENCIA
- Dos sesiones distintas de Claude leyendo el mismo tablero y una tomando un ticket
  que la otra ve marcado como tomado.
