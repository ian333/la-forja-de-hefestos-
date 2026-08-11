# ORDEN: LA PRUEBA DEL RAYO — ¿la pieza SALE? (mapa de desmoldeo sobre el 3D)

BASE: bb06b01

OBJETIVO: la prueba matemática que decide si un molde de 2 placas SIRVE — para cada
triángulo de la pieza, ¿sale por la cavidad (+Z), por el núcleo (−Z) o queda ATRAPADO?
El resultado es a la vez NÚMERO (`atrapadas = 0` es el teorema) y COLOR sobre la pieza
(🟩 sale por A · 🟦 sale por B · 🟥 no sale). Más la booleana hermana
`cavidad ∩ núcleo = ∅`. Las dos entran al gate del ciclo. Y el arsenal visual que YA
existe y no estaba conectado al dado (🩻 rayos X + sección con slider) se enciende.

## YA-EXISTE (prueba de ausencia)
- z-buffer ortográfico por dirección: `visibilidad.ts::clasificarVisibilidad` —
  ES el motor del rayo (fracción de área visible por triángulo, por vista). Se le pasan
  DOS vistas (±Z) y `fracMaxTri`/por-vista da la respuesta. NO se escribe raycaster.
- Falso color sobre malla: `MoldScene.MoldTcPaint` = el patrón exacto (BufferAttribute
  'color' + meshBasicMaterial vertexColors toneMapped=false). Se reusa la técnica.
- 🩻 rayos X y ✂ sección: `moldXray`, `moldSliceAxis/moldSliceFrac` del bag — existen,
  solo hay que ENCENDERLOS en la estación 3.
- Volumen de intersección: `occt.common`/`volume` (si no hay `common`, cut doble).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs

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

## EVIDENCIA (declarada antes de trabajar)
- Gate `ciclo-dado-test.cjs` ampliado y VERDE: sobre el dado con draft, atrapadas = 0
  y el reparto A/B tiene sentido físico (el exterior sale por la cavidad, el interior
  por el núcleo). Y la PRUEBA DEL DEFECTO: el mismo test sobre un dado con undercut
  fabricado a propósito DEBE dar atrapadas > 0 — si no distingue, el test no sirve
  (la regla del render corrupto aplicada al rayo).
- `cavidad ∩ núcleo = ∅` medido (volumen de intersección ≈ 0).
- Captura CAD con el mapa de color sobre la pieza + contador + 🩻 + sección, revisada
  con ojos → Downloads laptop + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL.

## CIERRE (2026-08-11)
- orden vs entregado: IDÉNTICO + 1 enmienda DECLARADA: se agregó el botón
  «🧪 probar el caso ROTO» (mismo TOCA) — el control negativo no puede vivir solo en
  el gate: ian tiene que VER el rojo para creerle a la herramienta.
- números: gate `ciclo-dado-test` 32/32 con OCC real. Dado bueno: SALE, atrapadas = 0,
  cavidad ∩ núcleo = 0 mm³. CONTROL NEGATIVO (draft invertido): NO SALE, 16 caras
  ATRAPADAS, 6,158.7 mm², y el undercut lo sufre LA CAVIDAD (la mitad que no puede
  bajar) — el núcleo sigue limpio, como debe ser. En pantalla el mismo veredicto y la
  cota `draft 1.5 ≠ 0 ✗` se pone ROJA sola.
- evidencia: forja-shots/dado-rayo/{01-ISO,02-FRENTE,03-panel,04-ROTO}.png revisadas
  con ojos → Downloads (dado-rayo-*.png) + /mnt/e/forja-videos.
- DOS defectos VISUALES cazados mirando, no midiendo: (1) el material sin luz volvía
  el mapa un recorte de papel → sombreado N·L HORNEADO en el color (el material sigue
  sin luz para no pastelear el colormap); (2) las 16 atrapadas vivían DENTRO del bloque
  y eran invisibles aunque el panel las contara → mesh aparte con `depthTest: false`
  (el truco de la nube de alarma): el defecto ATRAVIESA el acero. Un defecto que no se
  ve no sirve. Y el 🩻 se apaga con el mapa: peleaban y dejaban todo pálido.
- preguntas abiertas: faltan los otros dos modos que ian pidió (ESPESOR y DRAFT por
  color) y el slider de sección conectado al ciclo; meter ciclo-dado-test a
  forja-gate.cjs; el deploy final del turno anterior quedó cortado — relanzar.
