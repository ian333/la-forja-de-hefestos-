# ORDEN: T3 · TEXTO CON HILO A LA GEOMETRÍA — los § dejan de flotar

BASE: 3f86e47

OBJETIVO: ian: «todos los demás textos déjalos ahí, pero no me sirven si no está relacionado
directamente a la figura». Los textos son buenos (citan § del libro, dicen QUÉ MIRAR) pero
están al lado de la imagen, no ATADOS a ella.

Al terminar: cada hallazgo tiene una línea de guía al punto exacto de la pieza; al pasar el
mouse se resalta; al hacer clic la cámara vuela ahí y se prende la capa que lo explica.

GOTCHA YA PAGADO: `drei <Text>` dentro de un Canvas con EffectComposer **crashea**. Las
anotaciones van como overlay DOM proyectado desde el punto 3D (mismo patrón que los subtítulos
del cine). No se negocia.

## EJERCICIOS
- hilo-ancla · Cada hallazgo trae su punto 3D (no solo texto) · findings con ancla · ≥80 % de los hallazgos del engrane traen ancla; los que no, lo DICEN ("sin ancla: es global")
- hilo-proyeccion · La etiqueta sigue al punto al orbitar · proyección DOM · girar 90° mantiene la etiqueta sobre su ancla (error ≤4 px medido en dos ángulos)
- hilo-hover · Pasar el mouse resalta la zona en la pieza · hover → highlight · el hallazgo de pared delgada resalta EXACTAMENTE los vóxeles bajo el mínimo
- hilo-clic · Clic vuela la cámara y prende la capa que lo explica · orbitTo + capa · clic en "pines lejos del agarre" deja los pines visibles en cuadro
- hilo-sin-tapar · Las etiquetas no se encinan ni tapan la pieza · reparto anti-colisión · con 12 hallazgos, cero solapes y la pieza ocupa ≥50 % del cuadro
- hilo-textos-completos · NINGÚN texto se pierde en el camino · paridad · los § y QUÉ MIRAR de la lámina siguen todos presentes (conteo igual)

## YA-EXISTE (prueba de ausencia)
- Los textos y sus § ya existen en `laminas-visuales.ts` y en `mold-contratos` (cada criterio
  con su § y su detalle vivo).
- `CoordFinding` (revisar-modelo) — los críticos YA traen coordenada. Ese es el germen del ancla.
- Subtítulos proyectados: patrón probado en el cine (overlay DOM, no drei Text).
- `orbitTo` existe en main (lo usan las lecciones para encuadrar).
- NO existe: anclas para el resto de los hallazgos, ni el overlay que las dibuje.

## TOCA
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/mold/revisar-modelo.ts
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-28-t3-texto-con-hilo/resultados.json

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al activarla)

## EVIDENCIA (declarada ANTES de trabajar)
- gate VERDE + stills con las etiquetas ancladas en 2 ángulos distintos (la prueba del error ≤4 px)
- juez con ojos: la pieza no queda tapada por su propia explicación
- orden-gate VERDE · Temis n/6

## CIERRE (se llena al terminar)

## IAN (2026-09-04) — «NECESITO EVIDENCIA. Acá no hay evidencia, solo un reporte»
ian abrió el hallazgo DP de su engrane en producción: «ΔP sprue 0.8 MPa vs límite 0.3 MPa
(50 % de 0.5 MPa de cavidad, tope 50) · ⌀33.95 mm, sprue L=55.4 mm». Es texto. Evidencia
sería el sprue DIBUJADO sobre su pieza con su ⌀ y su L, y el punto donde la presión se cae —
exactamente el hilo de este ticket. La lámina lo confiesa en su último renglón («Falta aquí: el
hilo de cada § a su lugar en la pieza…»).
Y un ejemplo de por qué el hilo no es adorno: **«0.5 MPa de presión de cavidad» es 60-160×
menos que cualquier inyección real (30-80 MPa)**. `fillMPa` en `mold-contratos.ts` (feed-dp)
está devolviendo otra cosa o trae unidades cruzadas. Sin evidencia sobre la pieza ese número
pasa como verdad. VERIFICAR antes de afirmar cuál de las dos — y es candidato a control negativo
del ticket: un hallazgo cuyo número no se puede señalar en la geometría no es un hallazgo.
