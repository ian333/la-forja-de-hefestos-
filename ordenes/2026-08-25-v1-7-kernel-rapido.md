# ORDEN: v1·7 — EL KERNEL RÁPIDO: 65 MB no pueden cruzar un túnel de 150 KB/s

ESTADO: proximo
PRIORIDAD: 7

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

## TOCA
- (por definir según el camino)

## CREA
- (nada)

## EVIDENCIA
- primera carga del kernel en prod < 60 s desde un navegador SIN caché
