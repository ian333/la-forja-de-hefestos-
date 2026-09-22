# ORDEN: LA CÁMARA DEL INSPECTOR — que cada punto del plan de inspección SE VEA (hoy ~36 de 64 tarjetas «no se ve»)

ESTADO: en-curso
PRIORIDAD: 1
AGENTE: Opus · worktree propio · iangpu forja-dev7 :5198

BASE: ae41a29
(el worktree nació 33 commits atrás, sin las órdenes ni el API `inspeccion` de la pasada 1: se avanzó
con `merge --ff-only main` — avance rápido, cero commits propios que perder, cero de lo mío hacia main.)

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

## CIERRE (2026-09-21 · MEDIDO, no contado)

**Las 64 tarjetas se ven: 63 de 64 «sí» (98 %) contra 28 de 64 (44 %) de la pasada 1.** El juicio es mío,
tarjeta por tarjeta, abriendo cada PNG (no un contador): el único «no» es `carcasa 5.1` (el letrero dice
134 s y el mapa de t_c sale parejo: no enseña DÓNDE). Las 4 piezas re-inspeccionadas con
`scripts/inspecciona-molde.cjs` desde `forja-dev7 :5198` (GPU real, ANGLE/D3D12 RTX 4070 Ti), **0 PAGEERR
en los cuatro logs**, 17/17 láminas por pieza capturadas **desde la página 0**.

**LA REGLA DE ORO DE UNA VISTA, ya en código:** encuadrar lo que se mide · contraste (lo medido opaco y con
color, el sólido que lo esconde TRANSLÚCIDO, el resto al 5 %) · la cota DIBUJADA.

**Manijas nuevas (`window.__forgeBrep.inspeccion`)**
- `aislar(roles[], {tenues, opacs, colores, opacTenue, opac})` — un CONJUNTO de roles (`moldIsolate` deja UNO);
  acepta prefijos (`'agua-*'`, `'pin-*'`). `aislar(null)` vuelve a todo.
- `cota(a, b, etiqueta, ok)` y `cotas([…])` — la distancia DIBUJADA entre los dos puntos medidos (línea +
  CRUZ en cada extremo + etiqueta con 2 decimales), en el marco del molde.
- `geomPose()` — las cajas de `moldGeom` CON el desplazamiento que la animación puso en pantalla.
- `caraEn(role, x, y)` — rayo vertical contra la malla: la CARA REAL bajo un punto (con dedupe de caras
  coincidentes: el centro exacto cae sobre una arista de la triangulación y devolvía el techo dos veces).

**Escena**: la pintura de una lente (t_c / llenado / frente) ahora OBEDECE el plano de corte y vuelve a
respetar la profundidad cuando hay corte (`pintaCorte`, MoldScene), y se apaga con su pieza cuando la pieza
se oculta o se deja translúcida (`piezaPintable`, ForgeBRepStudio). Era el reclamo #1 de los 4 revisores.

**Lo que se arregló del INSPECTOR** (además de la cámara): 1.1 y 6.1 dejaron de ser tautológicos (rayo contra
la cara real) · 2.2 mide contra el ASIENTO DEL INSERTO · 2.3 da la lista completa y declara que los
retornos/KO son roles de VARIOS CUERPOS (se juzgan por malla) · 7.1 marca su umbral «REGLA NUESTRA, SIN
CITA» · pen < 0.6 mm = «no concluyente (vóxel)» · láminas desde la 0 · la cámara nunca queda dentro del
acero (el lado del corte se elige por la dirección del ojo; sin corte se empuja el radio hasta salir).

**HALLAZGO NUEVO, por quitar la tautología** — `1599HBK` (la caja grande): el techo del macho está en z 180
y el piso interior de la pieza en z 211.5 → **31.5 mm de hueco**, y las puntas de los pines quedan
**32.54 mm METIDAS en el plástico**. La pasada 1 daba ✓ CUMPLE porque medía contra la misma fórmula que
coloca la punta. Tarjetas `alta/p1_1.png` y `alta/p6_1.png`. Es de LOS PINES EN LA CARA DEL MACHO / la pila.
También, con la cara correcta: el agua A entra 1.56–2.19 mm al inserto de cavidad en **4 de 4** piezas.

**Números**: tsc 66 = 66 (cero nuevos) · censo igual (0 `<Canvas>` nuevos) · ciclo del dado **266/266** ·
sin ACTA R93 (no se tocó ningún literal del cubo) · sin deploy, sin push, sin video.

**Evidencia** · `public/evidencia/2026-09-21-la-camara-del-inspector/`: `tarjetas-4-piezas.png` (las 64, 8×8)
y `resultados.json` (los 16 puntos × 4 piezas con su número, su tarjeta, mi juicio y la BITÁCORA DE VISTAS —
az/el/r/objetivo/corte/aislado/cotas de cada tarjeta, para poder repetir cualquiera). Las tarjetas sueltas y
las 17 láminas por pieza quedan en iangpu: `/home/ian/el-plan-dev7/<pieza>/`.

**LO QUE SIGUE SIN VERSE (dicho, no escondido)**
1. `carcasa 5.1`: el mapa de t_c pinta la SUPERFICIE y el punto caliente vive adentro; en la caja grande sí
   se ve (el bebedero rojo), en la carcasa no. Falta una vista del INTERIOR de la pieza para ese punto.
2. Cuando varias cotas caen juntas (2.3 con 4 pares) las etiquetas se encinan: no hay reparto de etiquetas.
3. La **tapa sólida del corte** sigue sin existir (se ven cascarones). Se ESQUIVÓ cortando por encima del
   circuito en las plantas, no se resolvió. Con el corte a la mitad de un tubo, en planta, no se lee nada.
4. La **ortográfica con escala** no entró: el Canvas del estudio crea una cámara perspectiva y cambiarla en
   caliente es otra orden.
5. El punto **8.1** sigue contando láminas, no comparando cota por cota contra el sólido.

**Preguntas abiertas para ian**
- ¿El hueco de 31.5 mm del 1599HBK es de la pila (el macho no se dimensiona por la pieza) o del agarre?
  Lo dejo registrado, no lo toco: es de otra orden.
- ¿Quieres video del recorrido ahora que las vistas sí prueban algo? (La pasada 1 lo aplazaste.)

**Archivos tocados (para la fusión)**: `src/forja/brep/ForgeBRepStudio.tsx` · `src/forja/brep/MoldScene.tsx` ·
`scripts/inspecciona-molde.cjs` (nuevo) · `public/evidencia/2026-09-21-la-camara-del-inspector/*` (nuevo) ·
esta orden. **NO** se tocó `MoldPanels.tsx`, `useMoldStudio.ts`, `packageToAssemblySpec`, el agua, los pines
ni los insertos (son de las otras cuatro órdenes en paralelo).

**Desviación declarada**: el worktree nació 33 commits atrás de `main` (sin las órdenes de hoy ni el API
`inspeccion` de la pasada 1, que es el punto de partida de esta orden). Se hizo `git merge --ff-only main`:
avance rápido puro, sin commits propios que perder y sin meter nada mío a main. BASE quedó en `ae41a29`.
