# ORDEN: CICLO DEL DADO — estación 4: LLENADO (cap 5)

BASE: 991fa09

OBJETIVO: desde la estación 3, avanzar a la 4: el dado pintado por CUÁNDO le llega el
plástico (el 💧 que ya existe), la ÚLTIMA ZONA en llenarse marcada como dato para el
cap 8 (venteo), el LAZO DE CONVERGENCIA de la velocidad visible iterando (A-088), las
presiones con su banda, y los DOS defectos que el dado ya delata con su cita — la
compuerta que congela antes de empacar (§7.1.5) y el bebedero que se come el
presupuesto de presión (§6.4) — ANUNCIADOS aquí, no arreglados aquí (el grafo con
retornos del libro). Cotas del llenado EN el 3D y gate con control negativo.

## YA-EXISTE (prueba de ausencia)
- Todo el motor del cap 5 CORRE YA dentro del pkg: `pkg.diseno.velocidad` (escalera de
  convergencia + convergio + vueltas), `fillMPa`/`cavityMPa`, `gate` (con freezeS,
  tPackNeededS, freezeCorto) y `alimentacion` (dPMPa vs limDPMPa). La estación es
  VISTA + verificación, no motor nuevo.
- Longitud de flujo sobre la malla REAL: `flowlen-surface.ts::surfaceFlowLength`
  (Dijkstra sobre la superficie) — es lo que alimenta al 💧 `liveFlow` del CAD.
- Pintado por tiempo de llegada: `MoldScene.MoldFlowPaint` (ya existe, con frente
  animado). Y `flowlen.ts::computeWeldMask` para las líneas de soldadura.
- Cotas en 3D: la tubería `cotasCicloE3`/CotaLines ya probada en E3 — se reusa.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs
- docs/forja-research/kazmer-pliego/analisis-caps1-3.md
- docs/forja-research/kazmer-pliego/analisis-caps4-6.md
- docs/forja-research/kazmer-pliego/INDICE-ANALISIS.md

ENMIENDA (declarada): el gate cazó dos archivos que toqué sin declarar —
`MoldScene.tsx` (el pintor `LlenadoPaint`) y `ForgeBRepStudio.tsx` (colgarlo de la
escena) — más la SINCRONIZACIÓN DEL PLIEGO que ian aprobó en la misma instrucción
("sincronizo el pliego y arranco la orden de la estación 4"): A-013 y A-050 pasan a SÍ
con su función y su gate citados, A-060 se AMPLÍA pero sigue PARCIAL (el rayo JUZGA la
dirección de apertura; elegirla entre direcciones oblicuas sigue faltando). Marcador:
130→**132 SÍ**, 64→**62 FALTA**.

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo)
- index.html
- public/comando/catalogo.json
- public/comando/produccion.json
- scripts/comando-catalogo.cjs
- public/atrio/
- scripts/reels-web.py
- src/cinematic/
- scripts/guiones/
- videos/
- scripts/video-subs.py
- scripts/video.sh

## EVIDENCIA (declarada antes de trabajar)
- Gate `ciclo-dado-test.cjs` ampliado y VERDE: la escalera de velocidad CONVERGE
  (monótona y estable al final), L/T dentro del rango del ABS, presiones en banda, la
  última zona identificada con coordenada, y los dos defectos DETECTADOS con su cita.
- CONTROL NEGATIVO: una pared de 0.5 mm (mismo dado, pared adelgazada) DEBE reprobar
  por L/T fuera de rango — si el juicio no distingue, no es evidencia.
- Captura CAD (GPU): el dado pintado por tiempo de llegada + la última zona marcada +
  el panel con la escalera. Revisada con ojos → Downloads + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL.

## CIERRE (2026-08-11)
- orden vs entregado: IDÉNTICO.
- números: gate `ciclo-dado-test` **39/39** con OCC real. Lazo A-088: 0.5 → 0.6965 m/s
  en 8 vueltas, monótono y estable · L/T = 30 (ABS aguanta 150) · presiones 10.7 / 5.3
  MPa en banda · última zona en llenarse (0.8, 10.4, 10) a 0.112 s → coordenada para el
  cap 8 · **2 defectos REALES anunciados a su estación**: compuerta congela 3.25 s vs
  8.48 s de empaque (→E6, §7.1.5) y sprue 7.61 MPa vs presupuesto 5.34 (→E5, §6.4).
  CONTROL NEGATIVO: pared 0.35 mm → L/T 171 → VIOLA ✓.
- evidencia: forja-shots/dado-e4/*.png revisadas con ojos → **Downloads\FORJA-DADO** en
  la laptop Y en iangpu + /mnt/e/forja-videos.
- CUATRO bugs míos cazados en este tramo, todos por medir en vez de suponer:
  (1) las imágenes iban solo a la Downloads de la LAPTOP y ian estaba en iangpu (gotcha
      ya documentado que volví a cometer) → ahora van a las dos, en carpeta con nombre;
  (2) `onClick={onE3}` pasa el EVENTO de React como 1er argumento → con un flag opcional
      ahí, la E3 armaba el dado ROTO en CADA clic, en silencio;
  (3) `onE4` quedó en el TIPO de CicloE3 pero no en el DESTRUCTURING → ReferenceError que
      tumbó la app entera. Ni `tsx` ni `vite build` tipan: compiló perfecto y explotó en
      runtime. Mi humo de "importa el módulo" NO prueba que el componente RENDERICE;
  (4) `cursoSet(4, …, [])` BORRABA la escena (los botones de vista en gris por falta de
      sólido) — la E4 no construye acero: conserva el de la E3 y solo lo pinta.
  Y una medición que mató una suposición: instrumenté E3 y corre en **697 ms** — el rayo
  tarda 25-61 ms. Nunca hubo problema de rendimiento; era el ReferenceError.
- preguntas abiertas: el veredicto del rayo a res 160 vs 384 es idéntico (comprobado),
  pero la baja de resolución la hice creyendo que había lentitud — revisar si conviene
  volver a 384 en la ruta interactiva. Sigue: estación 5 (ALIMENTACIÓN), donde vive el
  √n que el libro presenta como CONTRAEJEMPLO y que hoy implementamos como regla.
