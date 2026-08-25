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
