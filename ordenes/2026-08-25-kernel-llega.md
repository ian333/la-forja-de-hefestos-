# ORDEN: v1·0d — EL KERNEL LLEGA: Cloudflare cachea el .wasm en el borde

BASE: 77d8797

OBJETIVO: hoy el kernel CAD (`opencascade.wasm`, 65 MB) NO llega al usuario en
prod: baja a ~95 KB/s porque el uplink de ATLAS es ~150 KB/s (medido por
Tailscale, sin túnel) y Cloudflare NO cachea `.wasm` (`cf-cache-status: DYNAMIC`;
los `.js` sí, `HIT`). Un usuario nuevo tarda ~12 min; al mediodía coló por poco
(~270 KB/s necesarios para 240 s). Mañana ian prueba los 7 tickets: sin kernel
no hay pruebas. Al terminar: una Cache Rule en CF para `university.gaiaprime
.com.mx/assets/*.wasm` (+ `.hdr` del viewport), caché calentado, y el kernel
cargando en < 90 s desde iangpu con `cf-cache-status: HIT`.

## YA-EXISTE
- creds CF en ATLAS `cluster/.env` (`CF_API_TOKEN`, `CF_ZONE_ID`) — memoria
  reference_gaia_infra. Se usan desde ATLAS por ssh; el token NO se copia ni se
  imprime.
- nginx-forja ya manda `Cache-Control: public, immutable, 30d` para `.wasm`:
  el origen coopera; solo falta que el borde lo respete (regla de caché).
- El diagnóstico completo está en el CIERRE de `2026-08-25-temis-probado`.

## TOCA
- src/forja/brep/occt.ts
- deploy-atlas-build.sh
- public/temis.json

## ENMIENDA (al diseñar)
El token de CF en ATLAS solo alcanza DNS (Cache Rules y Page Rules: no
autorizado). Plan B, que sí controlamos: en PROD la app pide el kernel como
`/assets/X.wasm.js`; nginx-forja (cluster, ATLAS — fuera del repo) sirve el
`.wasm` real bajo esa URL… — CORRECCIÓN: la config de nginx-forja es un mount
:ro y el directorio del host no es de ian → no se toca nginx. En su lugar el
DIST (que sí es de ian) lleva una COPIA real `X.wasm.js`; nginx la sirve como
application/javascript y Emscripten cae a ArrayBuffer (lo hace solo cuando el
MIME no es wasm). CF cachea por extensión → HIT. El deploy genera la copia en
cada publish. Se calienta el caché esta noche.

## ENMIENDA 2 (el truco salió PEOR — REVERTIDO TODO)
El `.wasm.js` sí salió `cf-cache-status: HIT`… pero CF guardó una copia
TRUNCADA (~14 MB de 65,864,037 B) y el kernel abortaba ("both async and sync
fetching of the wasm failed"). Sin permiso de purga (token DNS-only) la URL
quedó ENVENENADA en el borde. Revert completo: `occt.ts` vuelve al `.wasm` a
secas (con NOTA de no repetir), `deploy-atlas-build.sh` vuelve al publish
original, copias `.wasm.js` borradas del dist, redeploy verificado (25/25,
0 referencias a `.wasm.js` en el bundle). El "kernel rápido" queda como ticket
propio: `2026-08-25-v1-7-kernel-rapido.md` (3 caminos reales, elegir con ian).

## CREA
- public/evidencia/2026-08-25-kernel-llega/01-kernel-carga-prod-completa.jpg
- ordenes/2026-08-25-v1-7-kernel-rapido.md

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
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
- scripts/temis-tablero.cjs
- scripts/temis-deploy-stamp.cjs
- ordenes/2026-08-25-temis-modulo-comando.md
- src/forja/brep/TemisBoard.tsx
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
- `cf-cache-status: HIT` en el `.wasm` tras calentar; descarga completa desde la
  laptop en < 30 s (antes: 22 MB en 240 s)
- el kernel carga en prod desde iangpu y la barra dice "Lienzo vacío" (no
  "Kernel: …"); captura
- orden-gate VERDE · sin deploy (es infra), regen de Temis

## CIERRE (2026-08-25)
La meta original (CF `HIT` + <90 s) NO se logró — el objetivo REAL de la noche
sí: **el kernel LLEGA COMPLETO a prod** y mañana ian puede probar los 7 tickets.

Lo medido y lo hecho, honesto:
- Causa raíz MEDIDA: uplink de ATLAS ~150 KB/s (Tailscale, sin túnel) + CF no
  cachea `.wasm` (`DYNAMIC` por extensión). No es bug del código: es tubería.
- Cache Rule por API: el token de CF solo alcanza DNS → no autorizado.
- Truco `.wasm.js`: CF cacheó TRUNCADO (~14 MB de 65) y sin purga quedó
  envenenado → REVERT COMPLETO (occt.ts + deploy + dist), redeploy 25/25,
  bundle con 0 referencias a `.wasm.js`. NO repetir este camino.
- PRUEBA DE ACEPTACIÓN (post-revert, browser sin caché desde iangpu contra
  prod): el kernel cargó COMPLETO en 191 s; barra de estado "Lienzo vacío —
  Boceto → Extruir, o abre un proyecto"; 0 errores de página. Captura:
  `01-kernel-carga-prod-completa.jpg`.
- El browser de ian ya lo tiene en caché (immutable 30d) → sus pruebas de
  mañana cargan al instante.
- El "kernel rápido" (<60 s primera carga) queda como v1·7
  (`2026-08-25-v1-7-kernel-rapido.md`): token CF con Cache Rules+Purge (5 min
  de ian en el dashboard, el más barato), R2/CDN, o build chico de OCC.
