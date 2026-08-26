# ORDEN: v1·0c — TEMIS: la columna PROBADO (lo que ian ya probó)

ESTADO: en-curso
BASE: 73c3f06

OBJETIVO: ian — "mañana los pruebo, añade una columna de testeado y probado".
CERRADO = lo terminé yo con evidencia; PROBADO = ian lo probó y lo acepta. Sin
formulario: la orden recibe una línea `PROBADO: <fecha> · <nota>` cuando ian lo
dice (o `FALLA: <nota>` si no pasó) y el tablero la mueve/marca solo.

## YA-EXISTE
- `scripts/temis-tablero.cjs` lee `ESTADO:`/`PRIORIDAD:` de la orden — misma
  mecánica para `PROBADO:` / `FALLA:`.
- `ProjectSwitcher.tsx:TemisBoard` — 3 columnas; se agrega la 4ª.

## TOCA
- scripts/temis-tablero.cjs
- src/forja/brep/ProjectSwitcher.tsx
- public/temis.json

## CREA
- public/evidencia/2026-08-25-temis-probado/01-columna-probado-en-prod.jpg

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

## EVIDENCIA
- generador: `PROBADO:` mueve la orden a la columna PROBADO; `FALLA:` la deja en
  CERRADO con insignia roja y la nota; cerradas revisables = "por probar"
- captura del tablero con la 4ª columna (en prod)
- orden-gate VERDE · deploy
