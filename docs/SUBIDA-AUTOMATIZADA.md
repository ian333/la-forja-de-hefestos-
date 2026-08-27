# SUBIDA AUTOMATIZADA — IG · YouTube · TikTok (diseño, 2026-08-26)

> Orden: `ordenes/2026-08-26-subida-automatizada.md`. Ian: "hago cientos de cosas al día; a
> veces es solo subir un video que se ve bien; hay muchos que ya vi y no he subido". La regla
> de oro: **nada se publica sin autorización explícita por video**; la máquina ejecuta, ian decide.

## Qué se puede automatizar y cómo (honesto, por plataforma)

| plataforma | camino | robustez | requisitos de ian (una sola vez) |
|---|---|---|---|
| **YouTube** | **API oficial** (Data API v3 `videos.insert`, OAuth) | alta; cuota default ~6 subidas/día | crear proyecto en Google Cloud, habilitar YouTube Data API, consentir OAuth en el navegador (yo guío) |
| **Instagram** | (a) **Graph API** `/{ig-user}/media` con `media_type=REELS` + `video_url` pública → `media_publish`; solo cuentas **Business/Creator** ligadas a una Página de Facebook, app propia con `instagram_content_publish` (en modo desarrollo sirve para la cuenta dueña, sin app review) | alta | confirmar tipo de cuenta; ligar Página; crear app en developers.facebook.com (yo guío) |
| | (b) **Brave por CDP** (Playwright en WSL → Brave en el host con `--remote-debugging-port`), flujo web "Crear → Reel", pausas y mouse humanos | media (la UI cambia; riesgo de detección — mitigado con tiempos humanos) | abrir Brave con el flag (yo lo lanzo por ssh); sesión ya iniciada |
| **TikTok** | Brave por CDP (la Content Posting API exige auditoría) | media | ídem |

## El flujo (un comando)
```
bash scripts/video.sh <id> subir yt,ig,tt      # solo si el manifiesto trae AUTORIZADO
```
1. Lee `publicar.copy` (título, descripción, hashtags) y `AUTORIZADO:` del manifiesto.
2. Derivado **1080×1920 h264 ≤ 60 MB** (`scripts/reels-1080.py`) para IG/TikTok; el master 4K va a YouTube.
3. Sube por plataforma; espera al estado "publicado"; captura screenshot + URL.
4. Escribe `registro.json` (lo que hoy hace `togglePlat` a mano) y guarda la evidencia en `public/evidencia/<slug>/`.
5. Temis/Comando muestran "publicado en yt/ig/tt" con la URL.

## Lo que NO se automatiza
- La decisión: `AUTORIZADO: <fecha> <plataformas>` lo escribe ian (o lo dice y se anota).
- Cuentas nuevas / 2FA / captchas: se avisa y se espera.
- Tutoriales de GAIA ya vistos y no subidos: entran a la **cola** (Cine en Temis) con su copy; se suben conforme ian autorice, sin volver a verlos.

## Riesgos declarados
- Automatizar el navegador de IG/TikTok puede disparar controles anti-bot; por eso pausas
  aleatorias, mouse real, 1-2 subidas/día por plataforma, y NUNCA sin sesión humana previa.
- YouTube por API es el único camino sin riesgo; conviene arrancar por ahí.
