# ORDEN I: LA INSPECCIÓN SEGÚN KAZMER — los rojos se ven, la pieza siempre presente, un corte por lo medido

ESTADO: hoy
PRIORIDAD: 1

BASE: 54ea7ca

OBJETIVO: ian (2026-10-27): «que le preguntemos a Kazmer si le gusta el video, qué otras cosas debería verse en la inspección… se me
hace muy corto… deberíamos ver más datos, vistas más cerca». Kazmer (Opus con el libro, `/mnt/c/Users/sebas/Downloads/la-pelicula/kazmer/
LA-INSPECCION-SEGUN-KAZMER.md` — LÉELO COMPLETO, es tu especificación): «La película sí. La inspección todavía no: muestra cuatro
palomitas y se salta los cuatro rojos». ian dio el «va» (2026-10-29) a: los dos errores gratis + los rojos + los cinco puntos baratos
(S) + la regla de cámara. Al terminar, el paso 7 (la inspección) dura ≈ 2–3 min, enseña cada ✗ del dictamen en su capítulo, y cada
punto arranca con 2 s de contexto (molde completo, punto marcado) y luego el macro con la pieza presente y un corte por lo medido.

## LO QUE SE CAMBIA
0. **Gratis (lo primero que vería un comprador)**:
   - la cita del punto 4: §6.3.2 es el molde de TRES placas; para dos placas es **§6.3.1** (p.123) + **Tabla 6.1** (p.129)
     (`inspeccion-recorrido.ts:162` y `:179`); los +10 mm siguen como regla de Hefestos;
   - **UNA apertura**: el motor elige la máquina con 135.4 mm (`seleccion.apertura.strokeMm`, lo que lee `qa-huella`) y la pantalla dice
     «abre 152.5» (`animZ`). Mide de dónde sale cada uno, decide cuál es la física (lo que la máquina TIENE que abrir según §6.3.1 / §4.3.2)
     y que la pantalla, el expediente y la animación usen ese. Escribe en el CIERRE qué era cada número;
   - «945 pares» (cuadro 58.5) contra 915 en el resumen: una sola fuente, o quita el conteo (Kazmer §4: «al comprador le importa el peor par»).
1. **Los rojos se ven**: cada ✗ del dictamen VIVO tiene su punto en su capítulo (hoy DP y COLADA VS CICLO en colada, FREEZE en
   compuerta, CLARO en enfriamiento). Léelos del dictamen en tiempo de ejecución, NO fijes cuatro: la orden H re-juzga el dictamen en
   paralelo y CAMBIARÁ cuáles salen rojos (CLARO puede pasar a ✓). Si un ✗ no tiene vista 3D todavía (FREEZE: falta el sólido de la
   compuerta), va con su número contra el límite y la mejor vista que exista, rotulando lo que falta.
2. **Los cinco baratos** (Kazmer §3, los S; sus números ya los calcula el motor):
   1) la colada en UN corte por el eje del bebedero: ΔP contra su límite y los dos relojes (bebedero contra pared), §6.2.2/§6.4.7;
   2) qué manda el ciclo: corte por un poste con el campo térmico de ENFRIAMIENTO, y en el mismo corte el agua con su profundidad
      2D < H < 5D (Eq 9.22) y su paso H < W < 2H (Eq 9.24), acotados por línea;
   4) la placa de soporte contra el venteo: 0.0082 mm contra ≈ 0.02 (§12.1.2 p.304) con los 3 pilares bajo la cavidad (§12.2.3),
      deformada exagerada y rotulada «×N»;
   5) los botadores en su agarre: pieza en fantasma, cada pin tocando su poste o su pared con su fuerza (§11.2.5 p.273), y la fuerza
      total contra la de la máquina (§11.2.2; p.269 «typically 2% of the clamp tonnage»);
   8) la máquina HT-150SV con cotas: cierre (t y %), ancho entre barras «including cooling plugs», daylight, disparo dentro de la
      ventana cómoda (§4.3.3 p.82). En 3D NO (eso es M, otra orden).
3. **La regla de cámara de Kazmer**: la pieza SIEMPRE presente (sólida o fantasma) y un corte que pase por lo medido; 2 s de contexto
   y luego el macro; todo lo exagerado lleva «×N». Arregla los cuadros que Kazmer cazó flotando en el vacío (botadores ≈ 80 s y agua
   ≈ 92 s de la película de la semana 1: `/tmp/claude-1000/-home-ian-Gaia-la-forja/bec93bb9-09c0-4a0d-b030-b3f226c67838/scratchpad/
   kazmer/cuadros/`) y la cámara que al terminar la E8 queda pegada a la sujeción superior (orden B la vio).
4. **El cierre de la inspección**: los rojos, cada uno con la decisión que pide, y lo que NO se revisó.
5. **El guion** (`scripts/guiones/pelicula-camino.json` y `.txt`): el tramo de la inspección dice lo que la pantalla dice, una frase por
   punto nuevo, español mexicano, sin siglas. Lo que la voz dice tiene que verse en ese momento.
NO entra (son M, quedan para otra orden): el sólido de la compuerta, la anatomía del venteo, la contracción con la pieza nominal en
fantasma, el llenado animado, la máquina en 3D. Lista en el CIERRE qué haría falta para cada uno.

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/inspeccion-recorrido.ts` (183 líneas: los puntos del recorrido); lo usan `FocoMolde3D.tsx` y `ForgeBRepStudio.tsx`.
- `__forgeBrep.inspeccion.estado(apertura, expulsión)`, `inspeccion.corte(eje, mm)`, `moldGeom()`, `animZ(rol)`, `llenadoT(1)`.
- Los criterios del dictamen con id (`mold-contratos.ts`: `feed-dp`, `feed-lazo`, `gate-freeze`, `agua-profundidad`, `agua-paso`, …).
- La filmadora (`scripts/filma-camino.cjs`, reloj virtual) y el guion (`scripts/guiones/pelicula-camino.json`).
- Toda vista 3D vive en `ForgeBRepStudio.tsx`/`FocoMolde3D.tsx`: CERO `<Canvas>` nuevos.

## TOCA
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/brep/FocoMolde3D.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/guiones/pelicula-camino.json
- scripts/guiones/pelicula-camino.txt

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el worktree nace limpio)

## REGIONES (otras órdenes trabajan EN PARALELO)
- ForgeBRepStudio.tsx: I = el paso 7 / inspección / cámara de la inspección. H toca el dictamen (~L3931) y la hoja de análisis
  (~L4040-4140); J la maquetación de la hoja. No toques esas regiones.
- Si necesitas un número que hoy no viaja (p. ej. la fuerza por pin), léelo de donde ya se calcula; si hay que tocar otro archivo,
  ENMIENDA esta orden con el porqué.

## EVIDENCIA (se declara ANTES de trabajar)
- `node scripts/orden-gate.cjs` → VERDE.
- Por cada punto nuevo o arreglado: captura 4K de la app real (§5 de las instrucciones) que abres con Read y juzgas — ¿se ve la
  pieza?, ¿el corte pasa por lo medido?, ¿el número en pantalla = el del dictamen/`__forgeBrep`? Tabla en el CIERRE: punto · número
  en pantalla · número del motor · captura.
- Los dos errores gratis: grep de la cita y la apertura única leída en pantalla, en el expediente y en `animZ`.
- Par de control de «los rojos se ven»: una pieza cuyo dictamen tenga otro conjunto de ✗ (la 1594C Lid o una pieza del banco) enseña
  SUS rojos, no los de la Box.
- Una filmación de SOLO el paso 7 en tu copia (filmadora, una pieza, dentro del turno de GPU) para medir la duración (meta 2–3 min)
  y 1 cuadro por punto en `/home/ian/el-plan-dev4/inspeccion-v2/`. La película completa la monta el coordinador tras la fusión.
- El camino de la carcasa (runner) sigue pasando; tsc sin errores nuevos.

## CIERRE (se llena al terminar)
- orden vs entregado:
- números:
- evidencia:
- preguntas abiertas:
