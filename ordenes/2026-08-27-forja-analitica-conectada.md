# ORDEN: conectar TODA La Forja y su analítica

ESTADO: proximo
PRIORIDAD: 2

BASE: 673d485db8c67ff0ea0cd3a69b1bdda623e81bac

OBJETIVO: que exista UN solo lugar donde se vea el estado real de todo lo publicado —
qué video, en qué plataforma, con qué números y con qué archivo— y que Temis lo lea sin
doble captura. Hoy el dato vive partido: métricas en `public/comando/metricas.json`,
subidas en `videos/<id>.json → publicar.subidas`, catálogo en Comando, calidad entregada
solo si alguien corre `ig-calidad-entregada.cjs` a mano.

## YA-EXISTE (prueba de ausencia)
- `scripts/metricas-youtube.py` + `scripts/metricas-instagram.py` → ya escriben
  `public/comando/metricas.json` (cron diario 8:47, hoy sin arrancar).
- `scripts/temis-tablero.cjs` → ya lee `ordenes/*.md` y emite `public/temis.json`;
  ya trae la tira CINE desde `videos/CRONOGRAMA.json`.
- `src/forja/brep/TemisBoard.tsx` → el módulo compartido por lobby y comando.
- `scripts/ig-calidad-entregada.cjs` → mide el rendition ENTREGADO (nuevo, 2026-08-27).
- Falta el pegamento: nadie une manifiesto + métricas + calidad entregada en una vista.

## TOCA
- scripts/temis-tablero.cjs
- src/forja/brep/TemisBoard.tsx
- videos/CRONOGRAMA.json

## CREA
- (nada)

## BORRA
- (nada)

## EVIDENCIA
- Captura del tablero mostrando, por video publicado: plataforma, vistas, guardados,
  retención, y la resolución/bitrate ENTREGADOS (no los del archivo local).
- `public/evidencia/forja-analitica/` con las capturas.

## NOTAS
- La vara de retención es `skip3s` (ver [[reference_apis_publicacion]]).
- El rey: 60,736 vistas / 1,315 guardados. Todo lo nuevo se compara contra eso.
