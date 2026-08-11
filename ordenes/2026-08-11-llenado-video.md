# ORDEN: EL VIDEO DEL LLENADO — el fundido entrando por la colada, y su juicio

BASE: fda3464

OBJETIVO: ian: "para esto necesito un video, y tú también júzgalo — el video mostrará
si hay un fluido correcto". El frente de fundido ANIMADO sobre el dado, entrando por el
SPRUE (lo que faltaba y hacía falso el análisis), en bandas isócronas como el libro las
dibuja. Render 4K y **juicio propio con frames a lo largo de TODA la línea de tiempo**:
un frente que avanza mal se ve en movimiento, no en una foto.

## YA-EXISTE (prueba de ausencia)
- El motor: `llenadoNivel1` (frente por RESISTENCIA + bandas isócronas) y `Cross-WLF`,
  ya verificados contra el libro (gate 47/47). Esta orden NO toca física.
- Pintor por vértice: `MoldScene.LlenadoPaint` — se reescribe para pintar SOLO lo ya
  llenado en el instante t, por bandas.
- El sprue como sólido: `occt.makeCone`/`makeBox` — el bebedero cónico del §6.3.1.
- Render 4K + NVENC: la receta canónica de CLAUDE.md (contexto fresco por lote,
  super=1, screenshot con timeout finito, hevc_nvenc yuv420p10le).
- Juicio de video: `feedback_revisar_video_antes_de_entregar` — frames por TODA la
  línea de tiempo, no solo el primero.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx

## CREA
- scripts/llenado-video.cjs

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo)
- index.html
- public/comando/
- public/atrio/
- scripts/comando-catalogo.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- videos/
- src/cinematic/
- src/lib/chem/
- public/precomputed/
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py

## EVIDENCIA (declarada antes de trabajar)
- Video 4K (3840×2160) del llenado: el fundido baja por el SPRUE y llena la cavidad
  por bandas isócronas numeradas, con la última zona marcada.
- MI JUICIO, con números sacados de los FRAMES (no de la intención): el volumen llenado
  crece MONÓTONO, el frente nunca retrocede, arranca en la compuerta y termina en la
  última zona que el motor predijo. Si alguna falla, se dice y no se entrega.
- Entrega a Downloads\FORJA-DADO de AMBAS PCs + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL (0 Canvas nuevos).

## CIERRE (2026-08-11) — COMPLETO tras borrar y empezar de cero
- orden vs entregado: PARCIAL y declarado. Entregado: `scripts/llenado-video.cjs` con
  su juicio de 7 criterios. NO entregado: que el frente se VEA (sigue congelado).
- números del juicio (sobre 170 frames 4K): monótono ✔ · arranca vacío ✔ · termina
  lleno ✔ · sin saltos ✔ · avance repartido 25→27 % / 50→50 % / 75→75 % ✔ · consola
  limpia ✔ · **LA IMAGEN CAMBIA ✘ (0.00 de diferencia por tercio)**.
- EL JUEZ APRENDIÓ A VER: su primera versión APROBÓ un video 4K de 170 frames
  completamente congelado, porque medía el DOM y no los píxeles. Ahora compara frames
  con ffmpeg (blend=difference + signalstats) y reprueba. Ése check es el que evitó
  entregar un video muerto con sello de aprobado.
- CUATRO defectos reales cazados por el propio juicio, en cadena: (1) la compuerta caía
  FUERA de la cavidad y el campo nacía vacío; (2) clausura vieja de React — la API
  congelaba `tFill` en 1 y reportaba 100 % siempre (→ ref); (3) usaba la RESISTENCIA
  como reloj cuando la inyectora empuja a CAUDAL CONSTANTE: el volumen es lineal en el
  tiempo, no la presión (→ cuantiles del frente); (4) pintar por VÉRTICES es imposible
  aquí: el dado es todo caras planas y tesela a ~7 vértices.
- RESUELTO — y la lección es la regla de la casa. Escribí `FrenteVoxels`/`FrenteFundido`
  y perseguí el bug OCHO veces (instanceColor tardío, args inestable, m.count, geometría,
  material, coordenadas, grupo padre, color fijo). Ninguna resolvió. ian: "es mejor
  eliminar y empezar de 0 en lugar de andar cazando". Borré los dos componentes y
  REUSÉ `AlarmCloud` tal cual —el que ya se sabía que dibuja— pasándole los vóxeles ya
  llenados en el instante t. Funcionó a la primera. **COPIAR AL GANADOR ES LITERAL**:
  ocho intentos de reescribirlo "parecido" contra un reuso que salió de una.
- VIDEO 4K APROBADO 7/7 → `/mnt/e/forja-videos/dado-llenado-4k.mp4` (3840×2160, 170
  frames): monótono · arranca en 0.01 % · termina en 100 % · salto máx 0.73 % ·
  avance 25→24.8 % / 50→49.7 % / 75→74.5 % (caudal constante) · consola limpia ·
  **la imagen CAMBIA: 1.04 · 0.58 · 0.24** (congelado daba 0.00 exacto).
  Revisado con OJOS a media película: el fundido entra por el bebedero y llena.
  Entregado a Downloads\FORJA-DADO de AMBAS PCs + /mnt/e/forja-videos.
- Y un umbral inventado también miente: puse 0.5 a ojo y reprobaba un video que SÍ se
  mueve. Recalibrado a 0.10 CON la medición (movido ≈0.15–1.04, congelado 0.00).
