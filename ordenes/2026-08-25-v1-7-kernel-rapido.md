# ORDEN: v1·7 — EL KERNEL RÁPIDO: 65 MB no pueden cruzar un túnel de 150 KB/s

BASE: 6f70032

OBJETIVO: hoy el kernel CAD (`opencascade.wasm`, 65 MB) llega COMPLETO pero
LENTO a usuarios nuevos (~12 min: uplink de ATLAS ~150 KB/s y Cloudflare no
cachea `.wasm` — `cf-cache-status: DYNAMIC`). Los navegadores que ya lo tienen
(ian) lo sirven de su caché (immutable 30d). Para adopción real, la primera
carga debe bajar de ~1 min.

## LO QUE YA SE PROBÓ (2026-08-25, revertido — no repetir)
- Cache Rule / Page Rule vía API de CF: el token solo alcanza DNS.
- Truco `.wasm.js` (CF cachea por extensión): CF guardó una copia TRUNCADA
  (~14 MB de 65) y sin permiso de purga quedó envenenada → REVERTIDO (el
  `.wasm` a secas carga completo, lento).

## CAMINOS REALES (elegir con ian)
1. Token de CF con permisos de Cache Rules + Purge (5 min en el dashboard de
   ian) → regla para `.wasm` + purge del `.js` envenenado. El más barato.
2. Servir el kernel desde R2/CDN (subir el .wasm a un bucket público con CDN).
3. Partir el build de OCC (opencascade.js custom build con solo los módulos
   usados — hoy va el kernel COMPLETO; el propio paquete documenta builds
   chicos de ~10-20 MB).

## CAMINO ELEGIDO (2026-08-26, ian)
**El 1: token de CF con Cache Rules + Purge.** ian creó los permisos esta
mañana sobre el token que ya vive en ATLAS `/home/ian/Orkesta/cluster/.env`
(`CF_API_TOKEN`) — verificado: ya LEE rulesets de la zona (antes: "Authentication
error"). El token NO se copia ni se imprime; se usa por ssh desde ATLAS.

Trabajo (infra, NO toca código del repo):
1. Cache Rule en la fase `http_request_cache_settings` para
   `university.gaiaprime.com.mx` + `.wasm`/`.hdr` → elegible para caché,
   Edge TTL 30 d (el asset trae hash en el nombre: es inmutable por construcción).
2. PURGE de la URL `.wasm.js` ENVENENADA de anoche (copia truncada de ~14 MB) —
   este era el otro permiso que faltaba.
3. Calentar el borde y MEDIR la primera carga desde un navegador SIN caché.

## TOCA
- ordenes/2026-08-25-v1-7-kernel-rapido.md
- public/temis.json

## CREA
- public/evidencia/2026-08-25-v1-7-kernel-rapido/01-kernel-9s-lienzo-vacio.jpg

## BORRA
- (nada)

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
- deploy-atlas-build.sh
- deploy/nginx-forja.conf
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/ACS724-hall-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/ACS758-hall.pdf
- docs/forja-research/datasheets-fuente-corriente/FDH055N15A-mosfet.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4115-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFB4227-mosfet-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/IRFP4568-mosfet-backup.pdf
- docs/forja-research/datasheets-fuente-corriente/LRS-1200-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/MBR60100PT-schottky.pdf
- docs/forja-research/datasheets-fuente-corriente/RSP-1000-spec.pdf
- docs/forja-research/datasheets-fuente-corriente/TC4422-gatedriver-AG.pdf
- docs/forja-research/datasheets-fuente-corriente/UCC27614-gatedriver.pdf
- docs/forja-research/datasheets-fuente-corriente/ag-peina.py
- docs/forja-research/datasheets-fuente-corriente/sim-ag.py
- docs/forja-research/datasheets-fuente-corriente/sim-sensor.py
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- index.html
- meli-cortador-carburo.json
- public/2DN1.pdb
- public/atrio/index.json
- public/atrio/mol-h2o-el-sudor.jpg
- public/comando/catalogo.json
- public/comando/produccion.json
- public/evidencia/2026-08-25-temis-modulo-comando/01-comando-temis-cine.jpg
- public/temis-deploy.json
- scripts/comando-catalogo.cjs
- scripts/forja-release.sh
- scripts/guiones/hemo-v1-proteina-entera.txt
- scripts/guiones/hemo.txt
- scripts/guiones/hielo.txt
- scripts/guiones/sudor.txt
- scripts/narracion-gen.py
- scripts/precompute-heme-approach.py
- scripts/precompute-hemoglobin.py
- scripts/precompute-water-approach.py
- scripts/reels-web.py
- scripts/salud.sh
- scripts/temis-tablero.cjs
- scripts/video.sh
- src/cinematic/CinematicMolecule.tsx
- src/forja/brep/TemisBoard.tsx
- videos/CRONOGRAMA.json
- videos/cargas-gauss.json
- videos/faraday-jaula.json
- videos/mol-grasa-butirico.json
- videos/mol-h2o-el-anillo.json
- videos/mol-h2o-el-cuarteto.json
- videos/mol-h2o-el-hexamero.json
- videos/mol-h2o-el-hielo.json
- videos/mol-h2o-el-puente-camB.json
- videos/mol-h2o-el-puente.json
- videos/mol-h2o-el-sudor.json
- videos/mol-hemo-la-cazadora.json

## EVIDENCIA
- `cf-cache-status: HIT` en el `.wasm` de prod (medido con curl, dos veces)
- primera carga del kernel en prod < 60 s desde un navegador SIN caché
  (línea base MEDIDA anoche: 191 s) — captura de la barra "Lienzo vacío"
- orden-gate VERDE · regen de Temis

## CIERRE (2026-08-26)
**EL KERNEL YA LLEGA RÁPIDO: 191 s → 9 s** (la meta era < 60 s).

Lo que se hizo (infra, cero código):
1. ian creó los permisos `Cache Rules · Edit` + `Cache Purge · Purge` sobre el
   token de CF que ya vive en ATLAS. Verificado por API: el token que ANOCHE
   daba "Authentication error" hoy LEE y ESCRIBE rulesets.
2. Cache Rule creada — ruleset `8c79ece280c2401e90cdb1c2828524ab`, fase
   `http_request_cache_settings`, regla `5de7acd96127400cb1d3579f7a6d3e65`:
   `http.host eq "university.gaiaprime.com.mx" and (ends_with(path,".wasm") or
   ends_with(path,".hdr"))` → `cache: true`, edge_ttl y browser_ttl 30 d
   (override_origin — el asset trae hash en el nombre: inmutable por construcción).
3. PURGE de la URL `.wasm.js` ENVENENADA de anoche (la copia truncada de ~14 MB
   que quedó sin poder borrarse). Ya está limpia.

MEDIDO (iangpu, colo ATL, `opencascade.wasm-DEAxFiks.wasm`, 65,864,037 B):
- 1er GET (llena el borde): `cf-cache-status: MISS` · 18.96 s · 3.47 MB/s
- 2º GET: **`cf-cache-status: HIT`** · 4.73 s · 13.94 MB/s · `age: 18`
- 3er GET: **HIT** · 4.90 s · 13.44 MB/s
- **Navegador SIN caché contra prod: 9 s** hasta "Lienzo vacío — Boceto →
  Extruir…", 0 errores de página (anoche, mismo arnés: 191 s).

CORRECCIÓN HONESTA AL DIAGNÓSTICO DE ANOCHE: el `.wasm` sí salía `DYNAMIC` (eso
era real y la regla lo arregló), pero el "uplink de ATLAS ~150 KB/s" NO se
reprodujo hoy: el MISS bajó 65 MB del origen a 3.47 MB/s. O sea que anoche
había además congestión/mal momento de red, y el número de 95 KB/s no era la
capacidad del enlace. La regla vale por sí sola (HIT = 3-4× más rápido que el
MISS y el origen ya no se toca en 30 días), pero el "túnel de 150 KB/s" del
título era una conclusión apresurada de UNA medición mala. Queda escrito.

Los otros dos caminos (R2/CDN, build chico de OCC) NO se necesitan.
