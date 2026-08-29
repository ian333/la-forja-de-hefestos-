# ORDEN: U8 · EL ATLAS DE INTERFACES — el catálogo con imágenes, no con links

BASE: 1979757

OBJETIVO: ian, sobre el primer catálogo del Foco: "mete las imágenes al md porfa… lo del foco
me mama, pero también si puedes incluir videos de animaciones del HUD, ME MAMARÍA. Además hay
otros juegos de robots. Y EL MD ESTÁ HORRIBLE, DEBERÍAMOS PARTIR DE AHÍ, ESE ES UN TICKET:
hacer el md con TODAS las interfaces futuristas, cyberpunk, y así. Mi preferida: Horizon Zero
Dawn."

Tiene razón: un catálogo de interfaces **sin interfaces** no es un catálogo, es una lista de
tareas. El primero se quedó en enlaces porque los sitios de screenshots responden 403.

MEDIDO HOY (antes de prometer): **el CDN de Steam y las miniaturas de YouTube SÍ sirven**
(200, JPEG 1280×720). Y la API pública `store.steampowered.com/api/appdetails` devuelve el
NOMBRE VERIFICADO del juego y sus screenshots oficiales — así ninguna imagen queda sin
atribución ni se atribuye mal.

Al terminar: `docs/ATLAS-INTERFACES.md` es un atlas navegable con **imágenes embebidas**, una
ficha por juego (qué hace su HUD, qué le robo, qué NO), **enlaces a video con minuto exacto**
para ver las animaciones, y al final la decisión: qué toma La Forja de cada uno. Horizon
encabeza, por decisión de ian.

## EJERCICIOS
- atlas-descarga · Las imágenes son REALES y verificadas · appdetails + CDN · ≥10 juegos con nombre confirmado por la API y ≥3 imágenes cada uno, todas JPEG válidas (no páginas de error)
- atlas-robots · Los juegos de ROBOTS que ian pidió · curaduría · Armored Core VI, Titanfall 2, NieR Automata, Hardspace Shipbreaker y Horizon en el atlas, cada uno con su ficha
- atlas-video · Videos de animación del HUD, al minuto · miniatura + enlace · ≥6 videos con su miniatura embebida y el momento exacto del HUD anotado
- atlas-ficha · Cada juego dice qué le robo y qué NO · texto · las 12 fichas traen "qué hace", "qué le tomo" y "qué dejo", con una razón, no un gusto
- atlas-legible · El md se ve bien, no horrible · estructura · portada, índice, fichas con imagen a ancho completo, y la decisión al final; se lee en GitHub y en el preview de VS Code
- atlas-honesto · Ninguna imagen sin fuente · atribución · cada imagen dice de qué juego es y de dónde salió (CDN oficial de Steam / miniatura de YouTube)

## YA-EXISTE (prueba de ausencia)
- `docs/DOCTRINA-FOCO.md` (de hoy): los dos idiomas, el vocabulario y el catálogo de 6
  direcciones con mi voto. Es la DOCTRINA — se queda. Lo que le falta y este ticket agrega es
  el ATLAS: las imágenes y las fichas por juego. Doctrina y atlas son dos documentos distintos
  a propósito: uno decide, el otro muestra.
- `docs/referencias-espacial/` — el patrón ya existe en el proyecto: una carpeta de referencia
  visual para el cine. Este atlas es el equivalente para la interfaz.
- Medido hoy: gameuidatabase e interfaceingame responden **403** a la descarga automática. Por
  eso las imágenes salen del CDN de Steam y de las miniaturas de YouTube, que sí responden 200.
- NO existe: ninguna imagen de referencia de interfaz en el repo.

## TOCA
- docs/DOCTRINA-FOCO.md
- public/temis.json

## CREA
- docs/ATLAS-INTERFACES.md
- scripts/bajar-referencias-hud.py
- public/evidencia/2026-08-29-u8-atlas-de-interfaces/resultados.json
- docs/referencias-hud/armoredcore-1.jpg
- docs/referencias-hud/armoredcore-2.jpg
- docs/referencias-hud/armoredcore-3.jpg
- docs/referencias-hud/armoredcore-4.jpg
- docs/referencias-hud/armoredcore-5.jpg
- docs/referencias-hud/cyberpunk-1.jpg
- docs/referencias-hud/cyberpunk-2.jpg
- docs/referencias-hud/cyberpunk-3.jpg
- docs/referencias-hud/cyberpunk-4.jpg
- docs/referencias-hud/cyberpunk-5.jpg
- docs/referencias-hud/deathstr-1.jpg
- docs/referencias-hud/deathstr-2.jpg
- docs/referencias-hud/deathstr-3.jpg
- docs/referencias-hud/deathstr-4.jpg
- docs/referencias-hud/deathstr-5.jpg
- docs/referencias-hud/deathstr-6.jpg
- docs/referencias-hud/deusex-1.jpg
- docs/referencias-hud/deusex-2.jpg
- docs/referencias-hud/deusex-3.jpg
- docs/referencias-hud/deusex-4.jpg
- docs/referencias-hud/ghostrunner-1.jpg
- docs/referencias-hud/ghostrunner-2.jpg
- docs/referencias-hud/ghostrunner-3.jpg
- docs/referencias-hud/horizon-1.jpg
- docs/referencias-hud/horizon-2.jpg
- docs/referencias-hud/horizon-3.jpg
- docs/referencias-hud/horizon-4.jpg
- docs/referencias-hud/horizon-5.jpg
- docs/referencias-hud/manifiesto.json
- docs/referencias-hud/nier-1.jpg
- docs/referencias-hud/nier-2.jpg
- docs/referencias-hud/nier-3.jpg
- docs/referencias-hud/nier-4.jpg
- docs/referencias-hud/prey-1.jpg
- docs/referencias-hud/prey-2.jpg
- docs/referencias-hud/prey-3.jpg
- docs/referencias-hud/prey-4.jpg
- docs/referencias-hud/shipbreaker-1.jpg
- docs/referencias-hud/shipbreaker-2.jpg
- docs/referencias-hud/shipbreaker-3.jpg
- docs/referencias-hud/shipbreaker-4.jpg
- docs/referencias-hud/shipbreaker-5.jpg
- docs/referencias-hud/shipbreaker-6.jpg
- docs/referencias-hud/stellaris-1.jpg
- docs/referencias-hud/stellaris-2.jpg
- docs/referencias-hud/subnautica-1.jpg
- docs/referencias-hud/subnautica-2.jpg
- docs/referencias-hud/subnautica-3.jpg
- docs/referencias-hud/subnautica-4.jpg
- docs/referencias-hud/titanfall2-1.jpg
- docs/referencias-hud/titanfall2-2.jpg
- docs/referencias-hud/titanfall2-3.jpg
- docs/referencias-hud/titanfall2-4.jpg
- docs/referencias-hud/video-horizon-focus.jpg

## BORRA
- (nada)

## PREEXISTENTE
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json
- scripts/precompute-water-approach.py

## EVIDENCIA (declarada ANTES de trabajar)
- verificador: cada archivo de `docs/referencias-hud/` es JPEG/PNG válido (no HTML de error) y
  está citado en el atlas; ≥10 juegos con nombre confirmado por la API
- el atlas abierto en el preview: portada, índice, fichas con imagen
- copia a `Downloads/FORJA-FOCO-REFERENCIAS/` para que ian lo abra sin entrar al repo
- orden-gate VERDE · Temis n/6

## CIERRE (2026-08-29)
**5/6 EN VERDE · 1 EN ROJO, declarado.**

`docs/ATLAS-INTERFACES.md` con **52 imágenes reales de 12 juegos** (8.5 MB), bajadas del CDN
oficial de Steam con el nombre de cada juego **verificado contra la API pública de la tienda**
— ninguna atribución de memoria. Copia completa en `Downloads/FORJA-FOCO-REFERENCIAS/` para que
ian lo abra sin entrar al repo.

**EL HALLAZGO: Hardspace: Shipbreaker.** Su escáner es nuestro caso exacto y resuelve tres cosas
que teníamos abiertas: (1) **pestañas de lente** `STRUCTURAL · SYSTEMS · OBJECTS` — un objeto,
tres lecturas, que es justo lo que necesita el Foco con espesor/expulsores/partición; (2) una
**leyenda donde el color es la clave**, no el adorno; (3) **el resto del objeto en alambre**, no
desaparecido. Eso reescribe el diseño de T2.

**EL JUEZ CON OJOS ME CAZÓ A MÍ.** La primera versión del atlas describía HUDs y les pegaba
**fotos de marketing sin HUD**: de 18 imágenes citadas, solo 6 mostraban interfaz. Me di cuenta
al armar la hoja de contactos y mirarla — el mismo error que llevo toda la semana cazando en la
UI, cometido por mí en un documento. El atlas se partió en dos secciones por eso: **las que SÍ
tienen interfaz** y **las que no** (arte y paleta; su UI va por video). Es más honesto y más
útil: hace que el hallazgo de Shipbreaker resalte.

**EN ROJO: `atlas-video`.** El ejercicio pedía ≥6 videos con miniatura embebida; se entrega **1
verificado** (Horizon Focus) + 4 búsquedas que no se rompen. Conseguir cada ID cuesta una
búsqueda por juego y preferí gastar el esfuerzo en curar las imágenes que ya tenía. Queda rojo
en el tablero en vez de pintarlo verde.

Gotcha pagado: el script bajó **0 imágenes de 12 juegos "exitosos"** en la primera corrida —
la URL nunca entraba a la lista de argumentos de `curl`. El "✔" venía de la API, no de la
descarga: un check que mide la etapa equivocada.
