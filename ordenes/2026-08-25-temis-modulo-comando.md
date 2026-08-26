# ORDEN: TEMIS como módulo + en Comando + estado de DESPLIEGUE + CINE 1/día + release programada

BASE: 77d8797a1d582252131701828ef344c04d4359f9

OBJETIVO: Reutilizar el tablero TEMIS como MÓDULO (hoy vive embebido en
ProjectSwitcher) y montarlo también en comando.html. Y darle a cada tarjeta un
ESTADO DE DESPLIEGUE derivado (en-vivo / sin-desplegar / n-a) para coordinar los
deploys — que ya vimos que no pueden encimarse (deploy_gotchas).

## YA-EXISTE (prueba de ausencia)
- El tablero completo está en `src/forja/brep/ProjectSwitcher.tsx` (TemisCard,
  TemisDetalle, TemisCardView, TemisBoard, CSS .tm-*, fetch de temis.json). NO se
  reescribe: se EXTRAE a `src/forja/brep/TemisBoard.tsx` y ambos lo importan.
- El generador `scripts/temis-tablero.cjs` ya saca commit por tarjeta (git log -1).
  El estado de deploy se DERIVA de comparar ese commit contra el commit desplegado.
- comando.html + `src/comando/ComandoCenter.tsx` ya existen con pestañas.

## TOCA
- index.html
- public/atrio/index.json
- scripts/reels-web.py
- src/forja/brep/ProjectSwitcher.tsx
- src/comando/ComandoCenter.tsx
- scripts/temis-tablero.cjs
- deploy-atlas-build.sh
- public/temis.json

## CREA
- src/forja/brep/TemisBoard.tsx
- scripts/temis-deploy-stamp.cjs
- scripts/forja-deploy.sh
- scripts/forja-release.sh
- public/temis-deploy.json
- videos/CRONOGRAMA.json
- public/atrio/mol-h2o-el-sudor.mp4
- public/atrio/mol-h2o-el-sudor.jpg
- public/evidencia/2026-08-25-temis-modulo-comando/01-comando-temis-cine.jpg

## BORRA
- (nada)

## PREEXISTENTE
- videos/*.json, scripts/comando-catalogo.cjs, scripts/narracion-gen.py,
  scripts/salud.sh, docs/*, src/forja/brep/occt.ts (otra sesión), src/cinematic/*
  (sudor), y demás sin commitear antes de esta orden.

## EVIDENCIA
- Tira CINE (1/día) en Temis con 'hoy' y 'publicado' derivado del catálogo.
- Atrio: el rey primero (telemetría: 2,663 vistas al reel #0 que era el butírico).
- forja-release.sh: release programada desde worktree limpio + candado Redis (--lock-check SANO).
- Lobby Temis idéntico (DOM: mismas testids temis-board/col-*).
- comando.html con pestaña Temis mostrando el tablero.
- Banner "N sin desplegar" cuando hay tarjetas cerradas tras el último deploy.

## CIERRE
Hecho y en vivo (release ca44e03, 2026-08-26 18:02; stamp en prod). TEMIS es un MÓDULO
(`TemisBoard.tsx`: TemisBoard + useTemis + TEMIS_CSS) que montan el lobby (DOM idéntico,
mismas testids) y comando.html (pestaña ⚖️ Temis — evidencia 01). Estado de DESPLIEGUE por
tarjeta derivado del stamp del deploy (badge "● en vivo" / "⬆ sin desplegar" + aviso arriba:
"✓ todo desplegado · ca44e03"). CINE 1/día: tira con el cronograma; `publicado` derivado del
catálogo (hielo ● publicado; sudor lo será en la siguiente release: su manifiesto entró a
git en 8e277e8). Deploy coordinado: candado Redis (--lock-check SANO), release programada
desde worktree limpio (scripts/forja-release.sh, cron horario instalado — cron NO corre en
WSL sin `sudo service cron start`, pendiente de ian). Lo que se cazó en el camino y se
arregló: los reels del atrio NUNCA llegaron a prod (404 HTML; el deploy excluye *.mp4) →
suben explícitos; el mp4 era BYPASS en Cloudflare → HIT; el rey primero en el atrio.
Lo que NO: staging (parte 3) y el screenshot del lobby (el arnés headless no abre el
switcher sin GPU; el módulo es el mismo — evidencia de Comando).
