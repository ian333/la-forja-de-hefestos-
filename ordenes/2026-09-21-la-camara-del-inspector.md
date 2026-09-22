# ORDEN: LA CÁMARA DEL INSPECTOR — que cada punto del plan de inspección SE VEA (hoy ~36 de 64 tarjetas «no se ve»)

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev7 :5198

BASE: eca3df0

OBJETIVO: el plan de inspección (orden 2026-09-21-el-plan-de-inspeccion) mide bien y MIRA mal. Cuatro revisores Opus, uno
por pieza, juzgaron las 64 tarjetas: en más de la mitad la imagen no deja ver el número que dice el letrero, y a uno la
vista lo ENGAÑÓ (creyó que la pieza estaba al revés). Al final de esta orden cada punto se mira desde una vista que lo prueba.

## LO QUE PIDIERON LOS 4 REVISORES (coinciden)
1. **La pieza pintada por una lente NO obedece al plano de corte** y tapa al macho (1.1, 1.2, 6.1): el corte por el eje —la
   vista más valiosa— no deja ver si el macho está dentro de la pieza. Y la lente de otra pestaña se queda pintando.
2. **Aislar un CONJUNTO de roles** (hoy solo uno): planta «solo agua + pines + retornos + contorno del inserto» (2.3, 7.1).
3. **La cota dibujada** entre los dos puntos que se miden (2.1, 2.2, 3.2): sin ella 0.4–1.1 mm son subpíxel.
4. **Color por rol de alto contraste** y macho OPACO / pieza en alambre para los acercamientos (6.1, 7.2).
5. **Encuadre que incluya la carrera** (3.1 se sale de cuadro) y cámara que nunca quede DENTRO de un sólido (7.2 vacía).
6. **Tapa sólida del corte** (hoy cascarones) y **ortográfica con escala** para medir en la imagen.
7. Acercamiento 8–15× al par mínimo, mirando perpendicular a la línea que los une.

## Y DEL INSPECTOR (mis errores de esta pasada)
- 6.1 era TAUTOLÓGICO (medía la punta contra la misma fórmula que la coloca): medir punta ↔ CARA REAL del macho por rayo.
- 2.2 miraba la cara equivocada (el agua A entra al inserto de cavidad y dio ✓); 2.3 reportaba solo el par mínimo y no
  miraba retornos ni KO; el umbral largo/⌀ ≤ 50 de 7.1 lo puse yo sin cita; bajo 0.6 mm el estudio de contacto es ruido
  de vóxel → «no concluyente», remedir en B-Rep; las láminas se numeran desde 0 (me salté la de ensamble).
- Puntos NUEVOS propuestos por los revisores: piso REAL bajo cada pin · balance de la expulsión (centroide) · agua ↔ TODO
  barreno móvil con lista completa · cabeza capturada (alojamiento ciego) · retorno dentro del contorno de su placa ·
  flecha de la placa de soporte · nada sobresale de las caras de montaje · ⌀ declarado = ⌀ modelado · anillo vs platina.

## EJERCICIOS
- [ ] el inspector entra al repo: `scripts/inspecciona-molde.cjs` (nace de scratchpad plan/inspecciona.cjs) con los arreglos del
      inspector: láminas desde la página 0 · 6.1 por la cara REAL (lee `data-puntas-vs-cara` si existe; si no, rayo) · 2.2
      contra el inserto de cavidad · 2.3 con LISTA completa incl. retornos y KO · 7.1 con el umbral marcado «nuestro, sin
      cita» · < 0.6 mm = «no concluyente» · roles multi-cuerpo juzgados por cuerpo · la cámara NUNCA dentro de un sólido.
- [ ] manijas en `__forgeBrep.inspeccion`: `aislar(roles[])` (solo esos, el resto oculto) · `cota(a, b)` (la distancia dibujada
      entre los dos puntos medidos, en el mundo) · `ortografica(on)` con escala conocida · el corte ya existe (`corte`).
- [ ] la pieza pintada por una lente OBEDECE el plano de corte (hoy sale entera y tapa al macho — 1.1/1.2/6.1); macho opaco +
      pieza en alambre para los acercamientos; encuadre que incluya la carrera al abrir.
- [ ] las 4 piezas re-inspeccionadas con las vistas nuevas: montaje de 64 tarjetas y TU juicio honesto por tarjeta (sí/no/no se
      ve) — la meta es ≥ 90 % «sí»; lo que siga sin verse, dicho.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldScene.tsx

## CREA
- scripts/inspecciona-molde.cjs
- public/evidencia/2026-09-21-la-camara-del-inspector/tarjetas-4-piezas.png
- public/evidencia/2026-09-21-la-camara-del-inspector/resultados.json

## PREEXISTENTE
- (nada — worktree limpio)

## EVIDENCIA (se declara ANTES de trabajar)
- Las mismas 4 piezas: ≥ 90 % de las 64 tarjetas «sí confirma» (juicio propio por tarjeta, honesto); montaje + resultados.json.
- tsc: cero errores nuevos contra la base de 66 · censo igual (0 Canvas nuevos) · orden-gate VERDE · sin deploy.

## CIERRE (se llena al terminar)
