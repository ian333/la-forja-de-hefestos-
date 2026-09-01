# ORDEN: X1 · EL PANEL DEJA DE MENTIR — y TEMIS estrena IMPREVISTOS

BASE: a09b859
TIPO: imprevisto

OBJETIVO: ian probando su pieza real (`screw-cap-medical`) con el Foco prendido:

> «EL FOCO ME MAMÓ 100/10. **PRIMERA COSA A CAMBIAR: esa cosa que dice SIMULACIÓN VON MISES
> FEA REAL, no tiene ni madres que ver con lo que estamos viendo.** Además el panel está lleno
> de demasiadas cosas, no es mate, no se parece a una interfaz futurista como en Horizon.
> Esto está ahí fijo con una flechita — quita eso.»

Y sobre TEMIS, la parte que faltaba del sistema:

> «Esos WIP están ahí porque salió algo más urgente: yo directamente probando y pidiéndote
> tickets. Tienen prioridad top, no sé cómo llamarlos, ¿**imprevistos**? De esos en teoría se
> deben añadir **1-3 máximo**, ¿me entiendes? Para seguir llevando un orden. Y ponme límites.»

Tiene razón en las dos. El cajón EN CURSO no estaba roto por desorden: **le faltaba la casilla
para lo que entra por la puerta de atrás.** Esta orden crea esa casilla y ES la primera que vive
en ella.

## LO QUE SE MIDIÓ ANTES DE TOCAR

El panel `sim` es un CAJÓN DE SASTRE. Debajo del Foco cuelgan, en orden: CICLO DE INYECCIÓN
(6 botones), FEA von Mises (2 pickers + run + 6 direcciones + clear), ESTUDIO VIENTO (4 toggles
+ 4 calidades + 6 filas de resultados) y DISEÑO GENERATIVO. Y el título de todo eso dice
«Simulación · von Mises (FEA real)».

**Con una MALLA cargada, NADA de eso funciona.** FEA, Viento y Generativo exigen caras del
kernel (`oc` + `result` + `feaFixedFace`); un STL no tiene caras — la propia barra de estado lo
dice: *«sin caras de kernel: para acotar o partir, importa un STEP»*. O sea: el 70 % del panel
que ian ve mientras usa el Foco **no puede hacer nada**, y encima le pone su nombre al conjunto.

Es exactamente la regla de PANTALLA LIMPIA (U5), que ya está en el proyecto y aquí no se
aplicó: **una ventana sin nada que decir no existe.**

## EJERCICIOS
- x1-titulo-no-miente · El encabezado dice lo que ESTÁS viendo · contextual · con una pieza en el visor el panel NO dice "von Mises"; dice la pieza y, con el Foco prendido, EL FOCO
- x1-solo-lo-que-sirve · Lo que no puede correr, no se pinta · guardas · con `piezaMalla` cargada NO se renderizan FEA, Viento ni Generativo (necesitan caras del kernel); con un sólido del kernel siguen intactos
- x1-mate · Se ve instrumento, no formulario · CSS · el encabezado pierde la barra con caja; queda regla fina + versalita, sin fondo de bloque; el chevron se va al borde y se apaga
- x1-sin-regresion · El CAD del kernel no pierde nada · gate · `ciclo-dado-test.cjs` verde y el drive con un STEP muestra FEA/Viento/Generativo como antes
- x1-imprevisto-existe · TEMIS tiene la casilla y su tope · tablero · `TIPO: imprevisto` da una columna propia con tope 3; no cuenta contra EN CURSO; pasado 3 el tablero lo declara violación
- x1-esta-orden-vive-ahi · La prueba es ella misma · meta · esta orden sale en la columna IMPREVISTOS del lobby, no en EN CURSO

## YA-EXISTE (prueba de ausencia)
- `docs/DOCTRINA-FOCO.md` §0 — «EL BANCO: sólido, callado, **cuándo aparece: cuando tiene algo
  que decir**». La regla estaba escrita; el panel `sim` no la cumplía.
- U5 PANTALLA LIMPIA (commit 1753d0e) ya quitó ventanas vacías. Este panel se le escapó porque
  no está vacío — está LLENO de cosas que no aplican, que es peor.
- `CollapseHead` (ForgeBRepStudio) — se REUSA, no se reemplaza: cambia su título y su piel.
- `scripts/temis-tablero.cjs` ya tiene `WIP = { proximo: 7, enCurso: 1 }` y el mecanismo de
  violaciones. Se le agrega un tope más, no un sistema nuevo.
- NO existe: ninguna noción de trabajo NO planeado en TEMIS. Por eso 9 supertickets llevaban
  días en EN CURSO: no había dónde poner lo que sí se estaba haciendo.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/TemisBoard.tsx
- scripts/temis-tablero.cjs
- public/temis.json

## CREA
- ordenes/2026-08-31-x1-el-panel-deja-de-mentir.md
- public/evidencia/2026-08-31-x1-el-panel-deja-de-mentir/resultados.json
- public/evidencia/2026-08-31-x1-el-panel-deja-de-mentir/con-malla-el-foco.png
- public/evidencia/2026-08-31-x1-el-panel-deja-de-mentir/sin-malla-sin-regresion.png

## BORRA
- (nada)

## PREEXISTENTE
<!-- las 5 de arriba son de OTRA sesión de Claude trabajando en paralelo (el video del
     alcohol y el túnel a iangpu). No son de esta orden y NO se tocan ni se commitean aquí. -->
- scripts/bin-gate.py
- scripts/render-clip.cjs
- scripts/iangpu.sh
- scripts/still-alarma.py
- scripts/guiones/alcohol.txt
- videos/mol-etoh-el-alcohol.json
- docs/forja-research/datasheets-fuente-corriente/
- docs/inyectora/
- docs/la-fuente-esquematico.pdf
- ml-resultados.json
- public/temis-deploy.json
- scripts/precompute-water-approach.py
- src/cinematic/CinematicMolecule.tsx

## EVIDENCIA (declarada ANTES de trabajar)
- captura del panel CON MALLA: sin "von Mises", sin FEA/Viento/Generativo
- captura del panel CON SÓLIDO del kernel: FEA/Viento/Generativo intactos (la no-regresión)
- gate `ciclo-dado-test.cjs` verde
- el lobby con la columna IMPREVISTOS y esta orden dentro
- entrega a `C:/Users/sebas/Downloads` — nada en /tmp
- deploy + verificación contra el bundle SERVIDO
- orden-gate VERDE · censo Canvas 8→8

## CIERRE (2026-08-31)
**6/6 EN VERDE · desplegado y verificado contra el bundle servido.**

El encabezado dice lo que el panel ES (`EL FOCO` / `TU PIEZA`), no lo que fue cuando se
escribió. FEA von Mises, Estudio Viento y Diseño Generativo **no se pintan con una malla**:
los tres exigen caras del kernel que un STL no tiene — o sea que eran controles muertos
ocupando el 70 % del panel y encima le daban su nombre al conjunto. Con un sólido del
kernel siguen intactos (verificado quitando la pieza: el panel vuelve exacto a lo de antes).
Fuera también el botón de LOTE duplicado, que vivía dos veces en el mismo panel.

Es la regla de PANTALLA LIMPIA (U5) que a este panel se le había escapado: **no estaba
vacío, estaba LLENO de cosas que no aplican** — que es peor.

**Y TEMIS estrenó IMPREVISTOS.** ian tenía razón y mi diagnóstico inicial ("desorden") era
falso: EN CURSO estaba lleno porque él estaba probando y pidiendo cambios urgentes, y **no
había casilla para trabajo no planeado**, así que lo urgente se disfrazaba de EN CURSO y
reventaba la tapa de uno. `TIPO: imprevisto` da columna propia con **tope 3**, y el tope
aplica a los dos. Esta orden fue la primera que vivió en la casilla que ella misma creó.

Gotcha pagado: un acento invertido dentro de un comentario CSS **cierra el template literal**
que lo contiene. El dev server lo cazó con «Identifier cannot follow number».

Gate 260/260 · orden-gate VERDE · censo Canvas 8→8 · drive de producción sin errores.
