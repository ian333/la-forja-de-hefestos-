# ORDEN: SUBIDA AUTOMATIZADA — Instagram · YouTube · TikTok desde la PC de ian (con autorización por video)

ESTADO: proximo
PRIORIDAD: 2
BASE: c43a93a6694dc568c7864cf0e002dab936ca730e

OBJETIVO: Que subir un video ya aprobado (el master + el copy del manifiesto) a IG, YouTube y
TikTok sea UN comando que corre solo — ian solo dice "autorizado <pieza> <plataformas>". Con
evidencia (screenshot/URL del post publicado) que cae en el registro de Comando. Motivo (ian,
2026-08-26): "hago cientos de cosas al día; a veces es solo subir un video que se ve bien —
hay muchos que ya vi y no he subido (tutoriales de GAIA)".

## YA-EXISTE (prueba de ausencia)
- Comando ya tiene el REGISTRO de subidas por plataforma (`registro.json` en ATLAS,
  `togglePlat` en ComandoCenter.tsx) — hoy se marca a mano. La automatización lo ESCRIBE.
- El copy ya vive en el manifiesto (`publicar.copy`) y sale a Comando solo.
- No existe ningún script de subida. `scripts/reels-web.py` hace derivados 540p (atrio), no
  el derivado de 1080p que piden IG/TikTok.
- En la PC de ian (host Windows de iangpu, ssh admin) Brave tiene sesiones vivas de IG, YT y
  TikTok (perfiles `Default` y `Profile 1`). No hay Node en Windows; Playwright corre en WSL
  y se conecta a Brave por CDP (`--remote-debugging-port`).

## DISEÑO (decidido; ver docs/SUBIDA-AUTOMATIZADA.md)
- YouTube: API oficial (Data API v3, OAuth una vez, cuota ~6 subidas/día). Cero navegador.
- Instagram: Graph API si la cuenta es Business/Creator (publicar Reel desde URL pública del
  derivado 1080p en el sitio, ya cacheado en Cloudflare); si no, Brave por CDP con pausas y
  mouse humano. TikTok: Brave por CDP (su API exige auditoría).
- GATE: NADA se publica sin `AUTORIZADO: <fecha> <plataformas>` en el manifiesto de la pieza
  (lo escribe ian o lo dice y se anota). Pausas/mouse/tiempos humanos en el navegador.
- EVIDENCIA: screenshot del post publicado + URL → `registro.json` + `public/evidencia/<slug>/`.

## TOCA
- scripts/video.sh
- scripts/comando-catalogo.cjs
- src/comando/ComandoCenter.tsx
- public/temis.json

## CREA
- docs/SUBIDA-AUTOMATIZADA.md
- scripts/subir.cjs
- scripts/reels-1080.py

## BORRA
- (nada)

## PREEXISTENTE
- WIP de la otra sesión y lo de cine sin commitear.

## EVIDENCIA
- Un video subido a YouTube por API con su URL en el registro de Comando.
- Un Reel subido a IG (API o Brave) con screenshot del post.
- `registro.json` marcado solo (sin togglePlat a mano).
