# ORDEN: EL PASO 5 EXISTE — PARTIR sobre la pieza soltada, la línea de partición desde la malla

BASE: 5d4d71f

OBJETIVO: ian (2026-09-04, viendo el video del camino): «entiendo que se parte en el 5 :D realmente
ahí va la línea de partición? si es así arreglemos eso». El paso 5 del camino decía «HOY NO EXISTE»
por dos razones: no había GESTO para partir en la pantalla del Foco, y la partición real necesita el
sólido que el drop tira. Esta orden derriba la primera: una pestaña PARTIR en EL PARTE que llama
`partingLoops` (ya existía: parting.ts, 4 usos) sobre la MALLA de la pieza soltada y dibuja el lazo
sobre la carcasa, dentro del Canvas que ya existe (Regla #0.7: cero `<Canvas>` nuevo). El runner
mide el paso 5 en verde y el muro del camino se mueve al paso 6 (EL MOLDE). La partición de VERDAD
(dos cuerpos de acero, B-Rep) sigue siendo de T7 y espera al golpe 3 (el drop conserva el sólido).

## EJERCICIOS
- partir-gesto · Hay puerta para partir en la pantalla del Foco · pestaña `parte-lente-particion` · junto a MEDIDAS/PARED/ENFRIAMIENTO/LLENADO, color acero (ni cian medido ni magenta simulado): PARTIR no es un campo, es UNA línea
- partir-linea · La línea cae sobre el borde de la carcasa · `PartingLine3D` dentro del grupo de la pieza · mismas coordenadas que las cotas; depthTest off para verse a través de la pieza translúcida; el 1594C Box da 1 lazo de 340 mm = el perímetro del borde (2×(106.5+66) ≈ 345)
- partir-ruido · El ruido de pared se filtra, y se DECLARA · dos filtros · `partingLoops` crudo dio 208 lazos (las paredes verticales, n·pull≈0, hacen parpadear el signo de n_z); perímetro ≥ 8 mm mata el picoteo y z-span < 40 % de la altura mata las costuras verticales de esquinas y postes; la leyenda dice «de 208; se filtró el ruido de pared»
- partir-testid · El runner lo mide, no lo cree · `linea-particion` · la leyenda ES el testid; el gesto del paso 5 en el camino es Escape (cierra el dictamen del paso 4, que tapaba la pestaña) + tclick PARTIR — sin el Escape el arnés abortaba en el paso 5 y 6-8 quedaban «sin medir»
- paso-5-verde · El camino mide 5/8 y el muro se mueve · runner contra dev en iangpu · 5/8 ok · se rompe en el paso 6 (EL MOLDE, decía bloqueado y ahora es el primero que falla) · 63 s; lo oficial contra producción cuando el cron despliegue
- sin-regresion · Nada se rompe · gate · orden-gate VERDE, censo Canvas 8→8, cero pageerror en el drive; el dictamen sigue diciendo «SIN CABLEAR» en V4.3 — eso es T7 part-en-la-lamina y NO se toca aquí (se declara)

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/parting.ts::partingLoops(mesh, {epsNormal, weldMm})` → lazos cerrados con pull +Z, en
  coords de la malla. Se usa en el ciclo del dado (curso-flow.ts), en lamina-particion-angulo.ts y en
  construccion-molde-video.cjs. NO se copia ni se reescribe: se llama.
- El grupo `rotation={[-π/2,0,0]}` donde vive `SolidMesh(piezaMalla.visor)` + `CotaLines` — la línea
  va AHÍ y hereda la rotación, como las cotas (por eso cae en el borde).
- `analizarParticionAngulo` (V4.4-V4.6, marco de apertura) es el camino RIGUROSO de T7; aquí no se
  usa porque devuelve la pieza transformada al marco de apertura y eso complica dibujar sobre la
  pieza sin transformar — queda declarado para T7.
- NO existía: ninguna puerta PARTIR desde la pieza soltada; ningún dibujo de partición en el Foco;
  ningún testid `linea-particion` (el contrato lo escribió el runner el 2026-09-04).

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- caminos/la-carcasa-de-mitsubishi.md
- public/temis.json
- public/temis-deploy.json

## CREA
- ordenes/2026-09-07-el-paso-5-existe.md
- public/evidencia/2026-09-07-el-paso-5-existe/resultados.json
- public/evidencia/2026-09-07-el-paso-5-existe/paso-5-partir.png
- public/evidencia/2026-09-07-el-paso-5-existe/paso-5-antes-del-filtro.png
- public/evidencia/2026-09-07-el-paso-5-existe/paso-5-en-el-paseo.png
- public/evidencia/2026-09-07-el-paso-5-existe/paseo-v2-contactos.png

## BORRA
- (nada)

## PREEXISTENTE
- (nada: el árbol solo traía lo de esta orden al cerrar)

## EVIDENCIA (se declara ANTES de trabajar — verification-first)
- captura del Foco con PARTIR activo: UN lazo naranja sobre el borde de la carcasa, leyenda «1 lazo · 340 mm · pull +Z (de 208; se filtró el ruido de pared)»
- captura ANTES del filtro (208 lazos, costuras verticales) como testigo de por qué se filtra
- runner completo contra el dev de iangpu: 5/8 · se rompe en el 6; cero abortos del arnés
- orden-gate VERDE · censo Canvas 8→8

## CIERRE (se llena al terminar)
**6/6 EN VERDE · el paso 5 existe · el camino mide 5/8 y el muro se movió al paso 6 · orden-gate VERDE · censo Canvas 8→8.**

PARTIR es una pestaña en EL PARTE; llama `partingLoops` sobre la malla de la pieza soltada y dibuja el
lazo dentro del Canvas existente. 1594C Box: **1 lazo · 340 mm** (el borde: 2×(106.5+66) ≈ 345) tras
filtrar 208 lazos de ruido de pared (perímetro ≥ 8 mm, z-span < 40 % de la altura); la leyenda lo
declara. El runner: **5/8 ok · se rompe en el paso 6 (EL MOLDE)**, escrito por la máquina en el camino
(contra el dev de iangpu; lo oficial contra producción cuando el cron despliegue). Paseo v2 regrabado:
76 s, 0 cuadros encogidos, PASO 5 «✓ SE VE», cierre «HOY SE ROMPE EN EL PASO 6 · EL MOLDE».

- orden vs entregado: idéntico. Además: el gesto del paso 5 en el camino es Escape + PARTIR (el
  dictamen abierto del paso 4 tapaba la pestaña: el arnés abortaba y 5-8 quedaban «sin medir»).
- números: 208 → 7 → 1 lazos en tres iteraciones con captura cada una; 340 mm; runner 5/8 en 62 s;
  paseo 76 s (a DPR 1 no hubo cuadros encogidos, como se predijo en el-video-del-camino).
- evidencia: paso-5-partir.png (la línea limpia) · paso-5-antes-del-filtro.png (208 lazos, testigo)
  · paso-5-en-el-paseo.png (letrero ✓ SE VE) · paseo-v2-contactos.png (12 cuadros) · resultados.json.
  Video en Downloads de las dos PCs: 23-EL-CAMINO-paseo-v2-paso5(-1080).mp4.
- defectos pagados: (1) iangpu tenía un checkout VIEJO sin `foco-lentes.ts` → 500 en el dev; se
  rsync-ó `src/` completo (Regla: sincronizar ANTES de build). (2) iangpu tampoco tiene `ordenes/`
  al día → el letrero final dijo el slug de T6 en vez de su título; se rsync-ó `ordenes/` para la
  próxima. (3) `pgrep -f 'vite.*5191'` se auto-matcheó con el propio ssh: «ya hay dev» era mentira.
- lo que NO hace (declarado): la partición sigue siendo por MALLA (silueta, pull +Z fijo, filtro
  heurístico de z-span que asume línea ~horizontal). La dirección óptima de apertura (part-direccion),
  la superficie no plana y los dos cuerpos de acero son T7 y necesitan el sólido (golpe 3 del camino).
  El dictamen (V4.3) sigue «SIN CABLEAR» a propósito: T7 part-en-la-lamina.
- siguiente muro: paso 6 EL MOLDE sobre ESA pieza (T6) — hoy no hay gesto ni `molde-de-la-pieza`.
