# GAIA — Estrategia de contenido (documento vivo)

> Plan de 100+ videos 4K para YouTube/IG/TikTok. Toda instancia de Claude que produzca
> contenido aquí DEBE seguir esto. Nace del workflow de estrategas (investigación real
> + crítica adversarial, 2026-06). Léelo junto con `CLAUDE.md` (pipeline 4K canónico).

## Principio rector

**"Es más fácil simular un sol que una planta."** Renderizamos SOLO lo que es bello + físicamente
REAL + con ecuación cerrada (barato de parametrizar). El wow EMERGE de la corrección. Eso es el
MOAT vs canales con visuales falsos (After Effects/stock). Astrofísica primero; mate/química de apoyo.

## EL GANCHO = ciencia, no decoración (regla #1 de producción)

El primer **1.5 s decide todo** (50-60% abandona en <3s). FRAME 0 = el fenómeno YA VIVO en
movimiento, alto contraste sobre negro puro. **Cero fade-in, cero logo al inicio, cero intro.**

**El gancho ES el momento físico más brutal de cada objeto** (esto mata la monotonía sin traicionar
la fidelidad — cada física distinta = cada arranque distinto):
- **Agujero negro**: el photon ring reventando / el flash del Doppler δ⁴ del borde que se acerca.
- **Estrella**: el límite incandescente pulsando / el color-temperatura de Planck a quemarropa.
- **Magnetar/púlsar**: el pulso del faro de neutrones, el destello del periodo P real.
- **Nebulosa**: el instante de ionización (la estrella central encendiendo el gas).
- **Quasar**: el jet relativista disparando (boost Doppler δ^(2+α)).
- **Átomo/molécula**: el salto cuántico / el modo vibracional arrancando.
Variar el EVENTO de los primeros 1.5s con 6-8 ganchos científicos distintos. Reusar los beats
deterministas de `CinematicBHReel.tsx`. A/B 2-3 ganchos por motor.

## POR QUÉ el gancho importa — Doctrina de señalización (5 Nobel, la economía REAL del feed)

El feed ES el mercado de los limones (Akerlof 1970). El pulgar NO puede "partir la sandía" antes de
comprar: en 0.5 s no ve tu calidad real, así que te paga **precio de promedio mental** ("otro canal
de espacio bonito" → swipe). Tu agujero negro físicamente correcto muere INDISTINGUIBLE de la
chatarra de After Effects/IA. Ese es el `welfareLoss` de tu propio lab `MarketForLemons.tsx`, medido
en views perdidas. Las 5 leyes (cada una es un Nobel que ya vive en `src/economia/`):

1. **La belleza NO es señal (Spence 1973).** Una señal solo separa si es CARA de fingir. La belleza de
   render hoy es BARATA de fingir (mil cuentas con IA/stock la escupen en segundos) → ya se **infló**
   (Nash: todos parados de puntitas en el mismo estadio). Es el PISO, no el diferenciador. Subir más
   belleza = pararte más de puntitas donde todos ya están parados; nadie te ve más.
2. **La señal cara de fingir = la PROMESA de una brecha que no puedes des-ver (Spence + Becker).** El
   de humo no tiene física real atrás; tú sí (señal "llena", no "hueca"). El gancho debe prometer
   cerrar una brecha que SOLO tu corrección científica cierra: no "míralo girar bonito", sino "esto es
   lo último que verías al caer" / "esto mide 2 m y cabe donde no alcanzas a ver".
3. **El primer frame ES la criba (Mirrlees-Vickrey 1996).** El algoritmo NO te pregunta si el video es
   bueno: te pone una trampa que te delata sola — los primeros 1.5 s. **Optimiza para PASAR la criba,
   no para la belleza** que vive en el cuarto (segundos 3+) donde el pulgar ya no entra.
4. **Eres el PRODUCTO, no el cliente (Tirole 2014).** TikTok es mercado de dos lados: regala
   entretenimiento a la gente y cobra a anunciantes; tú eres el cebo gratis. Al algoritmo NO le importa
   tu belleza ni tu verdad — solo que la gente no cierre la app (retención). Trabaja CON la máquina y
   te regala alcance; pelea (belleza que no retiene) y te entierra. No es castigo: es el negocio.
5. **Tu MOAT es la verdad que el de humo no puede fingir (Akerlof→Spence, el cable de `relaciones.ts`).**
   "Akerlof ve el problema, Spence la salida." La salida NO es más bonito: es la señal que el canal de
   IA no puede copiar — física correcta + el dato-brecha. Ahí, y solo ahí, vuelves a ser el único.

**Implicación operativa (esto cambia el trabajo):** el cuello NO es producción (vas sobrado de
belleza) — es la **señal en la criba de 1.5 s**. Por eso el video #114 más bonito no mueve la aguja;
el primer frame + la promesa, sí.
- **A/B del texto-gancho sobre el MISMO render** (NO re-renderear): 3 promesas-brecha distintas, una
  por día, mismo video → el feed te dice cuál retiene (Mirrlees: deja que la trampa revele la verdad).
- **Re-subir** los enterrados en 2-3 semanas con gancho nuevo (TikTok los trata como nuevos).
- La belleza es condición NECESARIA, no suficiente: gánate la criba primero; la belleza cobra después.

## Formato (validado por investigación)

- **Duración**: 12-25 s default (reels de 1 objeto); 30-45 s solo para piezas narrativas. Cortar antes de 45s.
- **LOOP perfecto = rewatch gratis**: la física es PERIÓDICA → renderizar exactamente k periodos
  completos (Kepler, rotación, modo vibracional) para que último frame == primer frame (mismo
  color/encuadre/posición). Parámetro `loopFrames` por plantilla.
- **Micro-eventos cada 2-4s** aunque la cámara sea contemplativa: reveal de capa (disco→photon ring→sombra), cambio de Doppler, zoom-beat. Sin romper la limpieza (1 objeto, máx 2 textos).
- **Mudo + 1 caption-dato** quemado (ffmpeg `drawtext`/`captionFilter()`, NO drei `<Text>`): español
  mexicano (tú), un NÚMERO que produzca awe ("Aquí el tiempo casi se detiene", "Cabrían 1.3 millones
  de Tierras", "A 27 millones de grados"). El dato = gancho cognitivo; el visual = gancho emocional.
- **Audio dual**: funciona en mudo (85% lo ve así) PERO recompensa subir el volumen con la
  sonificación real (espectro→audio) = ángulo único que nadie tiene.
- **4K obligatorio** (ver CLAUDE.md). 9:16 reels + 16:9 para YouTube landscape de piezas narrativas.

## Las 8 plantillas (132 videos · 1 motor + parámetro = decenas)

| # | Plantilla | Videos | Motor | Parámetro | Esfuerzo |
|---|-----------|--------|-------|-----------|----------|
| 1 | Agujeros negros Schwarzschild | 24 | BHRaytraced | masa(rs) × inclinación × disco | listo |
| 2 | Estrellas por tipo espectral | 30 | nuevo (Planck) | T_eff (O,B,A,F,G,K,M+gigantes/enanas) | nuevo |
| 3 | Nebulosas narrowband | 16 | shader estelar + VolumetricDust | geometría × T_central × líneas (Hubble) | poco |
| 4 | Púlsares y magnetares | 18 | Magnetar + QuasarPulsar | (P, Ṗ) del catálogo ATNF real | poco |
| 5 | Quasares / AGN | 12 | Quasar* (9 motores) | banda SED × spin Kerr | listo |
| 6 | Escala del universo (Powers of Ten) | 8 | nuevo | escalera de objetos reales | nuevo |
| 7 | Moléculas (LCAO + vibracional) | 14 | CinematicMolecule | id molécula (~30 en BASE_META) | listo |
| 8 | Átomos por Z (reframe) | 10 | CinematicAtom | Z (118 ya rendidos; reframe long-form) | listo |

**Orden de producción** (impacto/esfuerzo): BH → Quasares → Átomos/Moléculas → Púlsares → Estrellas → Nebulosas → Powers of Ten.

## Funnel de marca GAIA (las ~7 impresiones, sin explicar GAIA)

- El video NUNCA explica GAIA. Es ANZUELO de belleza muda.
- **GAIA Prime SOLO al final** (`assets/gaia-prime-outro-vertical-4k.mp4`, canónico e inmutable).
  Meterlo arriba mata el gancho de 0-1s. El bumper consistente hace las impresiones de marca.
- La conversión ocurre DESPUÉS, por afinidad acumulada (modelo Kurzgesagt): link en bio →
  landing → labs/simuladores/Hermes (lo más maduro) donde GAIA se explica solo.
- **El cuello real NO es producción (vas sobrado) — es DISTRIBUCIÓN y CONVERSIÓN.** Congelar el
  funnel (landing + CTA con UTM + SKU en Stripe) ANTES del video ~60, y medir conversión.

## Cadencia y disciplina (lecciones de los 30 subidos en 1 día)

- **1 video/día** (máx 2), misma hora (noche). NUNCA subir lotes de 30 — TikTok los lee como spam,
  prueba 1-2 y entierra el resto (causa de las 0 views).
- **Intercalar dominios** (no 30 átomos seguidos): un BH, una estrella, un quasar… rompe la
  monotonía que el algoritmo penaliza.
- **Re-subir** los mejores enterrados en 2-3 semanas con mejor gancho — TikTok los trata como nuevos.
- 1-2 long-form narrados/semana mostrando los labs (esos SÍ convierten; los mudos dan awareness).

## Números honestos (sin humo — de la crítica adversarial)

- Canal de pocos días: mediana **200-2000 views/video**, ~1 de cada 20 revienta a 5k-50k. **NO 1.1M.**
- Subs: 100-300 a 3 meses, 800-2000 a 12 (modal 50-200). 1000 usuarios de pago necesita ~500k-2M
  views **+ funnel que convierta**. YPP (4000h): 12-24 meses.
- **El riesgo real es abandonar antes del mes 6.** La tracción es probable pero NO automática:
  el tiempo paga SOLO si iteras leyendo datos (qué retiene), no si subes a ciegas.
- **Ads: NO todavía.** Primero producto que retiene + funnel. Cuando 2-3 videos revienten
  orgánicamente, ahí $5-10 de "promote" detrás de los ganadores probados. No antes.

## Métricas a vigilar (en este orden)

1. **Retención a 3s** (calidad del gancho) — si cae, el frame 0 falla.
2. **Completion rate + rewatch** (loop) — la señal que más pesa en el algoritmo.
3. **CTR del link en bio** (intención) — mide si la belleza genera curiosidad real.
4. **Conversión a usuario GAIA** (el norte) — requiere el funnel listo.

## Identidad visual unificada

Negro puro (#000) en todos los reels (lienzo del paradigma scene-design). El color EMERGE de la
física, nunca de paleta inventada. Grade DaVinci 10-bit (halación, grano, split-tone) vía
`CinematicPostFX` + grade ffmpeg. Caption tipográfico premium (no default). Bumper GAIA inmutable.

Ver: `CLAUDE.md` (pipeline 4K), `project_atom_molecule_reels`, `project_video_factory_saga`.
