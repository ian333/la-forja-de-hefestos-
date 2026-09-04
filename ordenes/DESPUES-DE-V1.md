# DESPUÉS DE V1 — lo que NO recibe orden hasta que la v1 cruce

> Esto no se borra: se congela. Todo lo de aquí es bueno; por eso duele. La regla
> de Temis: PRÓXIMO tiene tapa de 7 y EN CURSO tiene tapa de 1. Lo que no cabe,
> vive aquí — visible solo si lo abres.

## Hefestos (la forja es la forja de Hefestos)
- Integrar Temis con Hefestos (GAIA Prime): que Hefestos sea quien complete la
  orden a partir de una frase — hoy Hefestos existe pero nadie lo usa por complejo.
  Primero Temis ultra-mínimo bien hecho; luego Hefestos lo alimenta.
- Que las órdenes se ESCRIBAN por IA desde una frase y el tablero las complete
  (TOCA/EVIDENCIA sugeridos del repo) — "nadie querrá llenar nada".

## La máquina más allá de la v1
- E5→E12 por pieza (llenado FAN, venteo, agua, contracción, expulsión con
  §11.2.5, estructura, acta completa) — el cubo las demuestra; las 3 figuras no.
- Cuarta figura y quinta (bezel del libro: alabeo 'marco' + muchos pines).
- Base de catálogo REAL (DME/HASCO/Meusburger) + hardware por receta (N-15/N-16).
- Revisión en lote con los checklists del libro (N-29).

## Validación contra realidad
- Presión medida: SABIC PP 576P (3 supuestos declarados) — el 2º observable.
- Warp en CMM · 2ª fuente de flujo (Toyolac Fig. 8) · tryout T0→T1→T2.
- N2b (pvT sink para empaque) · N3 (campo térmico del molde con el circuito).

## CAD
- Los ~50 features del roadmap del sketcher que no toque el recorrido de v1.
- CAM tool-stress UI · rosca/engranes/DIN como productos.

## Otros dominios (congelados, no muertos)
- Robots / brazo 3 eslabones / evolución del cicloidal.
- La Fuente / micro-AM metal · NOVA OMNI tienda · Catálogo Weston · AERO.
- Cine científico (BH, TDE, pulsar, hemoglobina, saga, tabla periódica): sigue
  como MARKETING, no como producto — cero órdenes nuevas hasta v1.
- Hub Nobel / labs de física / masterclass: fuera del lobby de v1.

## Video ya publicado — recuperar calidad (ian, 2026-08-27)
- Volver a subir a YouTube, en 16:9 y ULTRA alta calidad, TODOS los videos ya
  publicados. Hoy suben en 9:16 porque nacieron para reels; YouTube sí sirve 4K
  real y ahí no aplica ningún tope de peso ni bitrate (medido: el de Instagram
  sí — 588 MB rechazado, 128 MB aceptado). Es recuperar audiencia de escritorio
  con material que ya está pagado.
- El master sale etiquetado `color_space=bt470bg` (BT.601 de PAL) y `profile=Main`.
  Decidir con ian si se corrige: arreglarlo MUEVE el color de toda la serie.

## El Foco
- El enfriamiento ANIMADO en vivo en el CAD (ian, 2026-09-04: «me gustaría poder ver la
  animación en vivo en el cad»). Hoy el campo T(z,t) transitorio solo existe como video
  offline (`scripts/cooling-sim-video.cjs`, serie exacta 40 términos) y el ▶ del ciclo
  anima llenado/apertura/expulsión pero NO la temperatura cayendo sobre la pieza. Es
  la lente ENFRIAMIENTO del Foco con un eje de tiempo: el mismo `centerlineTemperature`
  de cooling.ts, término a término, pintado sobre la pieza mientras corre el reloj del
  ciclo. Cuando entre, el video del expediente sale de la MISMA animación, no de otra.
