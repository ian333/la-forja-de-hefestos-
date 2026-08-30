# ORDEN: U9 · EL FOCO DE HORIZON — las capturas que ian consiguió cuando yo no pude

BASE: 3a5f413

OBJETIVO: el atlas U8 cerró con una confesión: **de Horizon, la favorita de ian, no había una
sola captura con el Foco encendido** (Steam publica marketing, la comunidad publica modo foto,
YouTube pide *PO tokens*, Fandom responde 403 al HTML). ian lo resolvió a mano: capturó **cinco
cuadros** del video *How Aloy Got Her Focus* (5:42, 5:59, ~6:20, 8:09, 8:26) y me los mandó. Este
ticket mete esas cinco al atlas y **saca de ellas la regla de color del Foco**.

Y contesta su pregunta literal: *«estas son animaciones pero no sé cómo puedes ver animaciones
así jajaja MALDICIOOOON»*. La respuesta va escrita en el atlas como **protocolo**, no como
disculpa: no puedo ver video, pero dos cuadros del mismo efecto **son** la animación.

MEDIDO HOY (antes de escribir): las cinco capturas se leyeron una por una con ojos. De ahí salen
los números, no de la memoria: el aparato de Aloy es **cian**, lo que proyecta es **violeta**;
la trama del holograma es una **retícula regular**, no ruido; el holograma **se deshila abajo**;
el reproductor del registro es **un aro con ▶** y su barra de tiempo son **marquitas**, no línea.

Al terminar: `docs/ATLAS-INTERFACES.md` cita 26 imágenes (0 faltantes) y trae la sección
«HORIZON: EL FOCO, POR FIN» completa, con la regla **cian = medido · violeta = simulado**, la
anatomía de EL ARO, y §3.1 con el protocolo para mandarme movimiento.

## EJERCICIOS
- foco-capturas · Las cinco capturas de ian, en el atlas · imágenes embebidas · las 5 `horizon-foco-*.jpg` existen, son JPEG válidos y están citadas en la sección de Horizon
- foco-regla-color · Sale una REGLA accionable, no una descripción · doctrina · el atlas dice qué se pinta cian y qué violeta en La Forja, con el criterio "de dónde viene el número" (medido vs simulado)
- foco-aro · EL ARO queda descrito como componente · vocabulario · el atlas explica el aro de reproducir anclado al objeto y su barra de marquitas, y lo ata a nuestro ciclo (llenar→compactar→enfriar→abrir→expulsar)
- foco-animacion · La pregunta de ian queda contestada por escrito · §3.1 · el atlas dice que NO puedo ver video, las 3 formas que sí funcionan, y la regla "mándame dos cuadros, no el enlace"
- foco-sin-huerfanas · Ninguna imagen citada falta y ninguna basura entra al repo · verificador · 26/26 citadas existen; `docs/referencias-hud/hud/` queda podado a las 6 que el atlas usa
- foco-produccion · ian lo puede abrir sin entrar al repo · entrega · copia autocontenida en su Downloads de Windows (nada en /tmp)

## YA-EXISTE (prueba de ausencia)
- `docs/ATLAS-INTERFACES.md` (U8, commit 3a5f413): el atlas con 52 imágenes de 12 juegos. Este
  ticket NO crea otro documento — **edita ése**, que es justo lo que la Regla #0.7 pide.
- `docs/DOCTRINA-FOCO.md`: la doctrina de los dos idiomas. Se toca al final, cuando ian decida.
- `docs/referencias-hud/hud/` (bajado ayer con `bajar-hud-comunidad.py`): 128 capturas de la
  comunidad. Se **poda a 6** — las únicas que el atlas cita. Las otras 122 (15 MB) fueron pesca:
  ya se sacaron los peces, la red no se guarda.
- NO existe: ninguna captura del Foco de Horizon encendido en el repo. Ese es el hueco.

## TOCA
- docs/ATLAS-INTERFACES.md
- public/temis.json

## CREA
- ordenes/2026-08-30-u9-el-foco-de-horizon.md
- scripts/bajar-hud-comunidad.py
- public/evidencia/2026-08-30-u9-el-foco-de-horizon/resultados.json
- docs/referencias-hud/horizon-aparato-foco.jpg
- docs/referencias-hud/horizon-foco-escaneo-cuarto.jpg
- docs/referencias-hud/horizon-foco-nexo-codigo.jpg
- docs/referencias-hud/horizon-foco-persona-grabada.jpg
- docs/referencias-hud/horizon-foco-puerta-holograma.jpg
- docs/referencias-hud/horizon-foco-registro-audio.jpg
- docs/referencias-hud/hud/manifiesto-hud.json
- docs/referencias-hud/hud/manifiesto-hud-mostrecent.json
- docs/referencias-hud/hud/prey-hud-1.jpg
- docs/referencias-hud/hud/prey-hud-3.jpg
- docs/referencias-hud/hud/shipbreaker-hud-2.jpg
- docs/referencias-hud/hud/shipbreaker-hud-3.jpg
- docs/referencias-hud/hud/stellaris-mostrecent-hud-1.jpg
- docs/referencias-hud/hud/stellaris-mostrecent-hud-7.jpg

## BORRA
- (nada)

## PREEXISTENTE
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json
- scripts/precompute-water-approach.py
- src/cinematic/CinematicMolecule.tsx

## EVIDENCIA (declarada ANTES de trabajar)
- verificador de citas: `citadas: N · faltantes: 0` contra `docs/referencias-hud/`
- las 5 capturas leídas con ojos (no descritas de memoria) y lo leído escrito en el atlas
- copia autocontenida en el Downloads de Windows de ian — **nada en /tmp**, él lo va a abrir
- orden-gate VERDE · Temis n/6
