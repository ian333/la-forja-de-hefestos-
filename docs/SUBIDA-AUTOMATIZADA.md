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

---

# PASO A PASO (según la documentación oficial, leída 2026-08-26)

## A. YouTube — API oficial (Data API v3 + Analytics API)
Lo que dice la doc y lo que implica:
- `videos.insert` cuesta **1 unidad del cupo de subidas (100/día)**; el resto de llamadas comparten 10,000 unidades/día;
  `captions.insert` cuesta 400. Archivo ≤256 GB (el 4K entra directo). `publishAt` (programar) **exige `privacyStatus=private`**.
- OAuth de **app de escritorio** con redirect *loopback* `http://127.0.0.1:PORT`. **Si la app queda en "Testing", el refresh
  token caduca a los 7 días** → hay que ponerla **"In production"** (aunque no esté verificada: solo sale un aviso una vez).
- Scopes: `youtube.upload` (subir) + `youtube.force-ssl` (captions) + `yt-analytics.readonly` (métricas).

**Lo que hace ian una sola vez (10 min, en su navegador):**
1. https://console.cloud.google.com → *Nuevo proyecto* → nombre `gaia-prime-pub`.
2. *APIs y servicios → Biblioteca*: habilitar **YouTube Data API v3** y **YouTube Analytics API**.
3. *APIs y servicios → Pantalla de consentimiento OAuth*: tipo **Externo**; nombre "GAIA Prime pub"; correo de soporte;
   *Ámbitos* → agregar `youtube.upload`, `youtube.force-ssl`, `yt-analytics.readonly`; guardar; y en *Estado de publicación*
   pulsar **PUBLICAR APLICACIÓN** (para que el token no caduque a los 7 días).
4. *Credenciales → Crear credenciales → ID de cliente de OAuth → tipo "Aplicación de escritorio"* → **Descargar JSON**.
5. Ese JSON va a iangpu como `~/.config/gaia-pub/client_secret.json` (me lo pasas por Downloads y yo lo muevo; nunca al repo).
6. Yo corro `subir-youtube.py` la primera vez: imprime una URL → la abres, aceptas con la cuenta del canal → listo, token guardado.

**Después, por video:** `bash scripts/video.sh <id> subir yt` (o `yt,ig`). Sube el master 4K, los subtítulos de `segs.json`
como captions reales. **Programar** (real desde 2026-09-04): `publicar.programar` (ISO con huso) + `bash scripts/video.sh <id> programar` → YouTube PRIVADO con `publishAt` (9:16 y 16:9) y el reel en la cola de PRIME (`scripts/cola-publicar.py`), que lo publica en Instagram a la hora por cron. Registra `publicar.subidas.yt` (id + URL) en el
manifiesto = evidencia. Métricas: `metricas-youtube.py` diario (cron) → `public/comando/metricas.json` con la **curva de
retención** (`audienceWatchRatio` por `elapsedVideoTimeRatio`) por pieza.

## B. Instagram — API con Instagram Login (cuenta professional)
Lo que dice la doc:
- Cuenta **Business o Creator**; **NO hace falta Página de Facebook** con este setup. Permisos: `instagram_business_basic`,
  `instagram_business_content_publish`, `instagram_business_manage_insights`, `instagram_business_manage_comments`.
- Reel: `POST graph.instagram.com/v25.0/{IG_ID}/media` (`media_type=REELS`, `video_url` **pública**, `caption` ≤2200
  chars / 30 hashtags, `share_to_feed`) → sondear `status_code` 1/min ≤5 min hasta `FINISHED` → `POST /media_publish`.
  **100 posts/24 h.** Video: MP4 H.264, moov al frente, **≤300 MB**, ≤25 Mbps, 9:16, 3 s–15 min → `scripts/reels-1080.py`
  (1080×1920, ~60 MB) subido a `/biblioteca/moleculas/reels/` (Cloudflare lo cachea; IG lo baja de ahí).
- Token: Business Login → `code` → token corto (1 h) → `ig_exchange_token` (60 días) → `ig_refresh_token` cada <60 días (cron).
- Insights por Reel: `views, reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time,
  ig_reels_video_view_total_time, reels_skip_rate` (`impressions` deprecada desde jul-2024). Comentarios: `GET /{media}/comments`.

**Lo que hace ian una sola vez (15 min):**
1. Confirmar que el Instagram de GAIA es **Business o Creator** (Ajustes → Cuenta → tipo de cuenta). Si es personal: cambiar a Creator (gratis, reversible).
2. https://developers.facebook.com/apps → *Crear app* → caso de uso **"Otro" → tipo Business** → nombre `gaia-prime-pub`.
3. En el panel de la app: *Agregar producto → Instagram → "API setup with Instagram login"* → se muestran **Instagram App ID** y
   **Instagram App Secret**; en *Business login settings* poner **redirect URI** `https://university.gaiaprime.com.mx/ig-oauth/`
   (solo tiene que ser una URL válida nuestra: el `code` llega en la barra de direcciones).
4. *Roles de la app → Instagram Testers* → agregar la cuenta de GAIA; luego en la app de Instagram: *Configuración → Sitios web y
   apps → Invitaciones de tester* → aceptar. (Con eso publica e lee insights en modo desarrollo, sin App Review.)
5. App ID + secret + redirect a iangpu como `~/.config/gaia-pub/instagram-app.json`
   `{"app_id": "...", "app_secret": "...", "redirect_uri": "https://university.gaiaprime.com.mx/ig-oauth/"}`.
6. Yo corro `subir-instagram.py login`: imprime la URL → la abres con la cuenta de GAIA → me pegas el `code` → token de 60 días.

## C. TikTok
Su Content Posting API exige auditoría de la app → **navegador (Brave por CDP) en tu PC**, con pausas y mouse humanos, solo con
`publicar.autorizado` y solo 1-2/día. Se hace después de que YT+IG estén andando.

## D. El gate y la evidencia (ya en código)
- `pub_comun.gate_autorizado`: sin `publicar.autorizado = "<fecha> yt,ig"` en el manifiesto **no se publica** (`--yo-autorizo`
  solo para pruebas privadas).
- `pub_comun.registrar`: id + URL + fecha en `publicar.subidas.<plataforma>` → Comando/Temis lo muestran.
- Métricas: `metricas-youtube.py` + `metricas-instagram.py` (cron diario) → `public/comando/metricas.json` + comentarios en
  `dist-video/comentarios/<id>.json` (el brief del siguiente video).
