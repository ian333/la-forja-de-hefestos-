# ORDEN: v1·0 — TEMIS: el tablero de órdenes (nuestro Jira, sin el impuesto)

BASE: 5f574d5

OBJETIVO: ian ratificó la v1 ("Tu primera pieza, tu primer molde") y pidió el
quick win primero: nuestro Jira, EN el lobby, ultra-mínimo y bien hecho, con
otro nombre y respetando la ideología de los dioses griegos. TEMIS: la diosa del
orden, madre de las Moiras (hilan, miden, CORTAN). Al terminar: el lobby tiene
una pestaña TEMIS con tres columnas (PRÓXIMO ≤7 · EN CURSO ≤1 · CERRADO) leídas
de `ordenes/*.md` — nadie teclea un ticket, la orden ES el ticket — y un cajón
plegado DESPUÉS-DE-V1 (donde vive Hefestos).

## YA-EXISTE
- `ordenes/*.md` (47, todas con CIERRE) + `orden-gate.cjs` = ticket con juez
  mecánico y commit. Es el 80 % del Jira, ya hecho.
- `ProjectSwitcher.tsx` = el lobby, UNA pantalla que baja del título. Temis es
  una pestaña ahí; cero html nuevo, cero Canvas, cero entrada de vite.
- patrón "JSON generado + página que lo lee" (registro.json / comando-catalogo).

## TOCA
- src/forja/brep/ProjectSwitcher.tsx

## CREA
- scripts/temis-tablero.cjs
- public/temis.json
- ordenes/DESPUES-DE-V1.md
- ordenes/2026-08-21-v1-1-puente.md
- ordenes/2026-08-21-v1-2-higiene-recorrido.md
- ordenes/2026-08-21-v1-3-e3-por-pieza.md
- ordenes/2026-08-21-v1-4-draft-cilindros.md
- ordenes/2026-08-21-v1-5-base-cotizacion.md
- ordenes/2026-08-21-v1-6-leccion1-v1-gate.md

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- `node scripts/temis-tablero.cjs` → próximo 6/7 · en curso 1/1 (esta orden) ·
  cerrado 47 · después N; sale 0. Control: con 8 en PRÓXIMO sale 1 (se niega).
- screenshot del lobby con la pestaña TEMIS y las 3 columnas, legible
- verificado EN VIVO en university.gaiaprime.com.mx · censo igual (0 html, 0
  vite, 0 Canvas) · orden-gate VERDE · deploy

## CIERRE (lo que de verdad pasó)

**TEMIS VIVE EN EL LOBBY, EN PROD.** Pestaña `Proyectos | Temis` en el lobby que
ya existía; cero html, cero vite, cero Canvas (censo 46/41/8 igual). Tres
columnas leídas de `ordenes/*.md`: PRÓXIMO 6/7 (la v1 ratificada, numerada),
EN CURSO 1/1 (esta orden), CERRADO 46 con su commit; cajón DESPUÉS-DE-V1 (15,
Hefestos adentro). La orden ES el ticket: nadie tecleó nada.

**LA TAPA se niega:** control negativo con 8 en PRÓXIMO → `exit 1` + "para meter
uno, saca uno" (probado SIN pipe — la primera vez fallé con 7, que está
permitido, y con pipe, el gotcha de siempre).

**Cazado con los ojos:** la primera captura mostraba markdown crudo (`**`, backticks)
en las tarjetas → `plano()` en el generador. Gotchas nuevos: `/tmp` de iangpu se
limpia (recrear `lanza-dev.sh`/`build.sh`/`run.sh`); un `pgrep|kill` dentro del
ssh mata la propia sesión (lanzar cada cosa en su ssh, sin matar).

**Verificado EN VIVO:** `temis.json` 200 (45.5 KB), conteo 6/1/46/15, 0
violaciones, sin markdown residual; pestaña manejada con gestos reales en prod y
capturada. Deploy 25/25. Commit `28ec3af`.

**Nota honesta:** al cerrar esta orden el tablero desplegado sigue mostrándola EN
CURSO hasta el siguiente deploy (el JSON se genera en el repo). El próximo
ticket (v1·1 el puente) la lleva a CERRADO.
