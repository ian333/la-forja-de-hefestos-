# ORDEN: SUBIDA AUTOMATIZADA — Instagram · YouTube · TikTok desde la PC de ian (con autorización por video)

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
- scripts/pub_comun.py
- scripts/subir-youtube.py
- scripts/metricas-youtube.py
- scripts/subir-instagram.py
- scripts/metricas-instagram.py
- scripts/reels-1080.py

## BORRA
- (nada)

## PREEXISTENTE
- WIP de la otra sesión y lo de cine sin commitear.

## SIGUIENTE (2026-08-27)
- **Cloudflare R2** para servir los reels 4K@22Mbps a IG sin el túnel (10 GB gratis, sin egreso).
  La LEY ABSOLUTA exige fuente 4K; el túnel es el único motivo para no dársela ya.

## EVIDENCIA
- Un video subido a YouTube por API con su URL en el registro de Comando.
- Un Reel subido a IG (API o Brave) con screenshot del post.
- `registro.json` marcado solo (sin togglePlat a mano).

## CIERRE (2026-09-04, cerrada desde la orden el-cine-programado)
- orden vs entregado: lo prometido funciona desde el 2026-08-28: `subir-youtube.py` + `subir-instagram.py` +
  `reels-1080.py --subir` publican por API oficial con el gate `publicar.autorizado`, y `pub_comun.registrar()`
  deja la evidencia en `publicar.subidas.*` del manifiesto. Desviación: TikTok NO se implementó (sin API
  aprobada); `--resumable` de Instagram quedó como experimento (Instagram Login exige `video_url`).
- números: 6 piezas publicadas por API y registradas (la-sal 08-26, la-silla 08-28, ostrom 08-28, el-alcohol
  08-31, los-dos-campos 09-01, de-quién-son 09-02); 4 de ellas con 16:9 (`yt16x9`). Race del manifiesto
  cazado y arreglado (registrar relee antes de escribir, commit 700cfa6).
- evidencia: public/evidencia/2026-08-26-subida-automatizada/01-cine-chips-yt-ig.png (la tira 🎬 CINE con los
  chips YT/IG/16:9 que enlazan a cada subida real).
- preguntas abiertas: la programación (hora) quedó fuera de esta orden y vive en 2026-09-04-el-cine-programado.
