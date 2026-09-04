# ORDEN: LA FORJA SIN LUZ — el único producto que muere cuando se va la luz de casa

ESTADO: proximo
PRIORIDAD: 5

BASE: f81ec7a

OBJETIVO: que `university.gaiaprime.com.mx` siga en 200 cuando ATLAS se apaga. Hoy no:
el 2026-09-03 se fue la luz en casa (Site 2) y La Forja cayó con Error 1033 durante ~2 h
mientras Orkesta siguió viva.

## LO MEDIDO (2026-09-03, durante el apagón)
- Hay TRES túneles de Cloudflare, no uno:
  · `07b56202…` lleva el wildcard `*.gaiaprime.com.mx`; su cloudflared corre en gaia-prime
    (nube). Por eso Orkesta no se cayó.
  · `08281c7b…` el túnel viejo de ATLAS, con réplica en gaia-prime.
  · `a543c165…` el túnel EXCLUSIVO de La Forja. `university` tiene su PROPIO CNAME a este
    túnel (pisa al wildcard) y su cloudflared corre SOLO en ATLAS.
- Conclusión: La Forja es el único producto cuyo camino a internet pasa nada más por la
  casa de ian. Apagón = 1033. No es glitch: Tailscale marcó offline a ATLAS, ian-gpu e
  ian-1 al mismo tiempo, y cloudflared y tailscaled murieron juntos.
- gaia-prime NO tiene `forja-dist` y su gateway solo conoce `_`, `333` y `*-stg`; 39 G libres.

## YA-EXISTE (prueba de ausencia)
- El patrón de RÉPLICA ya existe: el túnel `08281c7b` corre en ATLAS y en gaia-prime
  (`gaia_tunnel_prime`). Replicar `a543c165` es copiar ese patrón, no inventar uno.
- El deploy (`deploy-atlas-build.sh`) construye el dist en ATLAS dentro de docker; hoy no
  sabe empujar a un segundo destino.
- NO existe: ningún dist de La Forja fuera de casa; ninguna prueba de que `university`
  sobreviva con ATLAS apagado.

## DECISIONES DE IAN
- 2026-09-04: «me traerán una PC para tenerla fija como servidor». Esa PC hereda el papel
  de ATLAS para La Forja (más potencia, disco fijo). NO resuelve el apagón: una PC en casa
  se apaga con la misma luz. Lo que resuelve el apagón es la RÉPLICA fuera de casa (o un
  UPS, que solo compra minutos).
- Pendiente de ian: (a) autorizar la réplica en gaia-prime — es cambio de DNS en producción
  (CNAME de `university`), por eso no se hace sin su palabra; (b) cuándo llega la PC.

## TOCA
- deploy-atlas-build.sh
- docs/DEPLOY.md

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al abrir la orden)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- LA PRUEBA DEL APAGÓN: con cloudflared de ATLAS detenido a propósito, `curl -sI
  https://university.gaiaprime.com.mx` responde 200 y `temis-deploy.json` trae el mismo
  commit que ATLAS. Sin esa prueba, la réplica no existe.
- La réplica se actualiza en el MISMO deploy (un deploy, dos destinos) — probado con un
  commit nuevo visible en ambos.
- censo esperado: canvas/vite/html igual (esto es infra, no UI).

## CIERRE (se llena al terminar)
