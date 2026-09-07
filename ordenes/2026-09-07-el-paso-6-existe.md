# ORDEN: EL PASO 6 EXISTE — EL MOLDE de la pieza soltada se arma solo, hasta donde la máquina llega hoy

BASE: 0869ba7

OBJETIVO: golpe 4 (parte T6) de PARA CERRARLO. ian (2026-09-07): «COMPLETA EL HAPPY PATH». Hoy el
molde de TU pieza existe por dentro (EL PUENTE arma E1 cuando el sólido entra al kernel; E2 y E3
tallan el acero de la pieza real; E4 y E5 ponen llenado y colada) pero vive en botones del panel
de features, lejos de la pieza soltada, y la PARED hay que teclearla (sin ella el STEP se lee MACIZO).
Al final de esta orden: una pestaña MOLDE en EL PARTE; la pared la MIDE el Foco; el ciclo avanza solo
E1→E5; el visor enseña las placas con la pieza tallada; la leyenda dice lo que HAY (placas, colada)
y lo que NO (agua, expulsores: E6 en adelante sigue cableado al cubo). El runner mide el paso 6.

## EJERCICIOS
- molde-gesto · Hay puerta para el molde junto a la pieza · pestaña `parte-lente-molde` · color oro; toggle independiente de lentes y de PARTIR
- pared-medida · La pared la mide el Foco, nadie la teclea · `intake.wallMm = p50 de la lente PARED` · el driver llama `calcularLentes` si hace falta; la leyenda dice «pared N mm (medida)»; control: sin pared no avanza a E2
- ciclo-solo · El ciclo avanza solo hasta E5 · efecto por estación · E1 (PUENTE) → E2 → E3 → E4 → E5, una estación por render, `cursoBusy` respetado; la leyenda enseña E<n>/5 mientras arma
- molde-se-ve · El visor enseña el molde de ESA pieza · render · con MOLDE encendido y placas construidas, el Canvas cambia de la malla al `moldParts` (cavidad + núcleo + pieza tallada + partición + colada); juzgado con ojos sobre el 1594C Box
- honesto · La leyenda dice lo que no hay · `molde-de-la-pieza` data-roles · «✗ agua (E8 cubo) · ✗ expulsores (E10 cubo)» en rojo; el runner marca el paso 6 PARCIAL (placas ✓ colada ✓ agua ✗ expulsores ✗), no verde
- sin-regresion · Nada se rompe · gate · orden-gate VERDE, censo Canvas 8→8, cero pageerror, el dado y los demos siguen igual (el driver solo corre con `piezaMalla` y `ciclo.pieza`)

## YA-EXISTE (prueba de ausencia)
- `useMoldStudio.ts:536-561` EL PUENTE: `arbolRef.shape` → `piezaDesdeArbol` → `estacion1` → `setCiclo` (automático).
- `cicloEstacion2/3/4/5` (802/845/932/1025) ya sirven para `ciclo.pieza` (E3: «el acero talla TU sólido TAL CUAL»); E6+ `onE6={ciclo.pieza ? undefined : …}` + aviso `ciclo-e6-bloqueada` (MoldPanels 628/1097).
- `setIntake({wallMm})` (528-535) dispara `intakeRev` → el PUENTE recalcula E1 con la pared declarada.
- `lentesDelFoco` ya calcula `pared.p50` (foco-lentes.ts:290, «el nominal de la pieza»).
- El Canvas ya dibuja `moldParts` (rama `moldParts.length`), solo que `piezaMalla` la tapaba.
- NO existía: gesto de molde junto a la pieza soltada; pared medida→intake; avance automático; testid `molde-de-la-pieza`.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-07-el-paso-6-existe.md
- public/evidencia/2026-09-07-el-paso-6-existe/resultados.json
- public/evidencia/2026-09-07-el-paso-6-existe/molde-de-la-pieza.png
- public/evidencia/2026-09-07-el-paso-6-existe/molde-antes-del-reencuadre.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- drive contra el dev aislado de iangpu: drop → MOLDE → `molde-de-la-pieza` con estacion ≥3 y roles cavidad/nucleo/pieza (+colada si E4/E5 pasan); captura del visor con las placas y la pieza tallada
- runner completo: paso 6 PARCIAL (no falla), el muro se mueve al 7 · orden-gate VERDE
- paseo v3 regrabado con el paso 6 en pantalla

## CIERRE (se llena al terminar)
**6/6 EN VERDE · el molde de la carcasa se arma solo hasta E5 y SE VE · el runner mide el paso 6 PARCIAL (3/5), que es la verdad.**

Pestaña MOLDE → la pared la mide el Foco (p50 = 2.75 mm) → E1 (PUENTE) → E2 → E3 → E4 → E5, una estación
por render. Salen 7 partes (cavidad, núcleo, pieza tallada, partición, placas A/B ghost, colada; 212,148
triángulos) y el visor enseña el bloque de 246 mm con la carcasa adentro, el bebedero y las cotas de
verificación del acero. Leyenda honesta: «✓ placas ✓ colada ✗ agua (E8 cubo) ✗ expulsores (E10 cubo)».

- orden vs entregado: idéntico, más lo que hubo que aprender para que SE VIERA (ver molde-se-ve).
- números: E3 con el sólido real = 19.5 s en una corrida, 108-110 s en cuatro (misma pieza) — T6
  cplx-tiempo dice ≤20 s; aquí hasta 5×. Se declara. Runner: paso 6 PARCIAL 3/5 en todas las corridas.
- evidencia: molde-de-la-pieza.png (E5 visible) · molde-antes-del-reencuadre.png (el testigo negro) ·
  resultados.json.
- defectos pagados (todos cazados con OJOS, ninguno con números): cámara dentro del bloque; opacidad 0.08
  de E4; E4/E5 recolocan las partes (bbox E3 ≠ bbox E5) → reencuadre en cada cambio; lentes = arreglo con id;
  TDZ de setView/orbitTo (cuarta vez en el archivo); el perfilador de React en DEV clonando props gigantes
  (artefacto del dev, no del producto).
- lo que NO hace (declarado): agua (E8) y expulsores (E10) siguen cableados al cubo; el bloqueo del hilo
  en E3 es real para el humano (la leyenda pinta «armando…» antes, pero la pestaña se detiene).
