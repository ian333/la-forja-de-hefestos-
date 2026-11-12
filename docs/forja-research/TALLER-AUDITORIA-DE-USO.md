# EL TALLER — auditoría de uso (alguien que solo ve la pantalla)

> **Nota del coordinador (cierre de la noche del 2026-11-11).** Esta auditoría se hizo contra `a313251` (lo que está en
> producción). De su TOP 10, en `main` (sin desplegar) ya quedó arreglado y probado:
> **#1** la base y la cubierta ya se agarran con rayos X (lo de enfrente gana; otro clic en el mismo punto agarra lo de
> atrás) · **#2** el boceto acota con un clic, con el valor seleccionado, cambia y quita cotas, enseña el rectángulo
> mientras se dibuja, tiene Ctrl+Z y recibe el contorno de la cara · **#3** las teclas del kernel ya no ensucian el
> documento (ni dentro del boceto) · **#4** Encuadrar / ISO / SUP / FRE / Sección prendidos y aislar encuadra ·
> **#6** el aviso de forja se pinta antes de congelar y la profundidad se pide ANTES de forjar (la forja sigue
> congelando la pantalla 1–7 s: no se movió a un worker) · **#7** Ctrl+Z deshace golpes · **#9** la barra de estado ·
> **#10** el doble clic ya no mete la cámara entre las piezas, mover no la regresa a la vista de llegada.
> Del resto: A2 (con un cuerpo agarrado ya hay «bajar», «mover» y el radial con Aislar/Ocultar/Mover), M11 (Esc en el
> boceto), el radial (ahora del Taller, con letreros). Quedan como PROPUESTA para ian, sin integrar: **#5** la cinta de
> arriba y **#8** el panel El Taller legible (`C:/Users/sebas/Downloads/taller-propuesta/`, viva en forja-dev10).
> Siguen abiertos: L1 (el lobby dice «ROBOT · plantilla»), L3 (el panel de los jueces abre encima), L7 (el blanco de la
> cámara de llegada), O4 (el árbol plano de 60 hijos), M5 parcial (cotas contra aristas, no solo vértices), M12, M13.

Orden `ordenes/2026-11-11-taller-auditoria-y-brecha.md`, parte 1 · BASE `a313251` · 2026-11-11.
Hecha en `forja-dev10` (vite DEV :5011, el mismo código de producción; nunca contra producción), Chrome con
`ANGLE … D3D12 (NVIDIA GeForce RTX 4070 Ti)`, mouse de verdad, a 1920×1080 y a 1536×864. Cada clic se decidió
mirando la captura anterior; el `__forgeBrep` solo se usó para CONFIRMAR qué quedó agarrado y para medir tiempos.
Capturas: `C:\Users\sebas\Downloads\taller-auditoria\` (el número de cada hallazgo es el del archivo).
Severidad: **bloquea** (no se puede hacer el trabajo o sale mal sin avisar) · **estorba** · **cosmético**.
Líneas = `src/forja/brep/ForgeBRepStudio.tsx` de BASE, salvo que diga `SketchEditor.tsx`.

Lo que SÍ funciona y no se repite abajo: girar/mover/zoom con mouse y touchpad, el chip mouse/touchpad, el foco y el
aislar del árbol, las tres tenazas, clic al vacío o Esc para soltar, doble clic = cara de frente (captura 10), unir /
cortar / cuerpo nuevo sobre una pieza impresa (la ventana de 20 × 12 quedó: el área de la cara bajó 240 mm² exactos),
cambiar profundidad y borrar un golpe.

## TOP 10 — ordenado por cuánto le estorba a ian para rediseñar la base

| # | Sev. | Qué pasa | Captura |
|---|------|----------|---------|
| 1 | bloquea | **La base no se deja agarrar.** Al abrir, «rayos X» viene prendido y las 25 piezas IMPRESAS del cuerpo (base ×4, cubierta ×4, columnas, charolas, tapas, campana: todo lo que el yunque puede modificar ahí) son fantasma: el clic las ATRAVIESA y agarra lo de adentro. Nada lo dice. | 07, 09 |
| 2 | bloquea | **No hay forma evidente de dar una medida exacta en el boceto.** Sin vista previa ni cajas al dibujar; la Cota no funciona como dice su letrero; teclear 20 deja 30.920; una cota no se edita ni se borra; no hay Ctrl+Z. | 11, 12, 13 |
| 3 | bloquea | **Las teclas de Fusion ensucian el documento**, con el laboratorio abierto y también DENTRO del boceto del yunque: F mete un Fillet, E crea un sólido, V da «Error: 16392824», D abre el dictamen. Ctrl+S guardaría eso. | 06, 24 |
| 4 | bloquea | **No hay Encuadrar ni vistas.** Encuadrar / ISO / SUP / FRE / Sección están apagados con el laboratorio; después de navegar o de aislar no hay regreso que no sea recargar. | 05, 09 |
| 5 | estorba | **La cinta de arriba no es del laboratorio**: de sus 22 botones ninguno sirve ahí; 7 hacen algo raro o dañino (sólidos sueltos, errores, avisos encimados), 7 no hacen nada visible y 8 están apagados. El radial y la paleta S ofrecen lo mismo. Nada del Taller está arriba. | 18, 19, 20, 21, 23 |
| 6 | estorba | **La forja congela la pantalla 3–7 s sin avisar** y «Terminar» corta a 10 mm sin preguntar; corregir la profundidad es otra forja. | 15 |
| 7 | estorba | **Deshacer está prendido pero no deshace golpes**; regresa otra cosa y deja una rejilla flotando sobre la pieza. Borrar un golpe no pide confirmación. | 16 |
| 8 | estorba | **El Taller no se lee**: los nombres se cortan justo en lo que distingue («Base frente izqui… / derec…»), la cuenta de cuerpos no se ve, y no se sabe cuál pieza es impresa y cuál de fábrica. | 04, 08, 15 |
| 9 | estorba | **La barra de estado miente**: «Lienzo vacío — Boceto → Extruir…» con 226 cuerpos en pantalla. Título «Estudio de pieza». Chip «Ctrl+S = v1». | 03 |
| 10 | estorba | **La cámara se pierde sola**: doble clic en una cara chica la mete entre las piezas; Cancelar/Terminar la dejan en otra vista; aislar no encuadra; el giro pivotea 23 cm a la izquierda del modelo. | 24, 09 |

## 1 · Llegar
- **L1 · estorba · 01.** En el lobby el laboratorio es la 6.ª tarjeta de «EMPEZAR DE», rotulada **ROBOT · plantilla**,
  con «tres agentes, un contrato (ronda 2)…» (jerga de cómo se generó). «Proyectos 0». *Fusion:* lo último que abrí,
  arriba. *Dónde:* `:6087` (`type: 'robot'`, `meta`). *Arreglo:* tipo propio («banco»), `meta` con lo que ES («banco de
  soldadura · 226 cuerpos»), y recordar el último documento abierto.
- **L2 · estorba · 02.** Los primeros ~2 s la cámara está DENTRO del modelo (capacitores gigantes) y luego salta.
  *Dónde (probable):* efecto de encuadre `:8922–8932` (`orbitTo(...docVista)` llega después del primer cuadro). *Arreglo:* no
  pintar las piezas hasta tener la vista, o arrancar ya en `docVista`.
- **L3 · estorba · 03, 25.** «LABORATORIO · SUS JUECES» (558 × 222 px) abre encima del visor; a 1536×864 tapa la esquina
  de la base. Su ✕ mide 8 × 17 px. El texto es del proceso, no de la pieza. *Dónde:* `LabJuecesPanel` `:4187–4225`,
  montado en `:9522`. *Arreglo:* que nazca cerrado como un renglón del Taller («jueces: 0 errores · 8 avisos ▸»).
- **L4 · estorba · 03.** Barra de estado: «Lienzo vacío — Boceto → Extruir, o abre un proyecto». *Dónde:* `:11978–11987`
  (`vacio` no mira `refParts`). *Arreglo:* rama propia para documento con piezas de referencia (va en la propuesta).
- **L5 · cosmético · 03.** «· Estudio de pieza» junto al nombre (`:10162`) y el chip «Ctrl+S = v1» (`:10170`) no dicen
  nada a quien llega. *Arreglo:* «Taller · 226 cuerpos» y «sin versiones guardadas».
- **L6 · cosmético.** En frío, el rectángulo amarillo del boceto por omisión cruza el texto «SUELTA TU PIEZA AQUÍ».
- **L7 · estorba · 03.** El modelo llega chico y corrido a la derecha, y el blanco de la cámara queda fuera de él
  (230 mm a la izquierda de su centro, medido; `docVista`, `:8929`): al girar, el laboratorio se columpia alrededor de un punto vacío. *Fusion:* gira
  sobre el modelo. *Arreglo:* `docVista` con el blanco en el centro de `meshBBox`.

## 2 · Orientarse
- **O1 · bloquea · 05.** Encuadrar, ISO, SUP, FRE y Sección del visor están `disabled` con el laboratorio; F6, Inicio y
  el doble clic al vacío no hacen nada; el cubo gira pero no recentra. Con dos dedos del touchpad la cámara se va bajo el piso y
  el modelo queda fuera de cuadro sin regreso. *Dónde:* `:10428–10432` y `:10375` (`disabled={!result &&
  !moldParts.length}`); el encuadre ya incluye las piezas de referencia (`meshBBox` `:7326`) y la sección ya las corta
  (`RefMesh clip` `:9497`): solo falta la condición. *Arreglo:* `|| refGeos.length` (va en la propuesta).
- **O2 · estorba.** Botón de en medio arrastrando = zoom; en Fusion es mover (y Shift + medio, girar). *Dónde:*
  `<OrbitControls>` `:3853` (sin `mouseButtons`). ian dijo que el mouse «está cool»: solo preguntarle.
- **O3 · estorba · 08.** En el árbol caben ~17 letras: «Base frente izqui…/derec…», dos «Charola del ducto…», cuatro
  «poste de silicato…» idénticos. Arriba, «Cuerpo impreso · te…» esconde su cuenta (· 80). La tenaza «Pieza» sale
  cortada por el borde. *Dónde:* riel de 244 px `:13438`, `.fb-tnom` con elipsis `:13307`. Medido: 137 px útiles
  contra 317–389 px del texto. *Arreglo:* en la propuesta (riel más ancho + nombre en dos renglones).
- **O4 · estorba · 08.** «Cuerpo impreso» trae 60 hijos en una lista plana que mezcla piezas impresas (Base, Cubierta,
  Columna, tapas), canales («K07 · motor · 342 mm») y piezas de fábrica (fuente, ventiladores, PARO), sin marca que las
  distinga y sin buscador. *Fusion:* carpetas e icono por tipo. *Arreglo:* candado en las de fábrica (`solidoDeRef(r)`
  ya lo sabe), subgrupos «impresas / canales / de fábrica» desde el generador, y una caja de filtro arriba del árbol.
- **O5 · estorba · 09.** Aislar no encuadra: la pieza queda chica en una orilla (y no hay Encuadrar, O1). Además sigue
  FANTASMA si era de las de rayos X. El aviso «◎ aislado…» empuja el árbol 44 px: el ◎ que acabas de oprimir ya no
  está bajo el mouse. *Dónde:* `:10689` y `:10661–10665`. *Arreglo:* al aislar, `setView('iso')` y rayos X no aplica a
  lo aislado; reservar el renglón del aviso.
- **O6 · estorba.** Cada clic que cambia estado (tenaza, foco, agarrar) bloquea el hilo 0.24 s con iangpu libre y
  0.40–0.48 s con carga (re-render del estudio completo). No truena, pero se siente pegajoso.

## 3 · Agarrar
- **A1 · bloquea · 07, 09.** Di clic a la pared de la base y quedó agarrado el «Ventilador de la mesa» de adentro. Aun
  con la base AISLADA, el clic no la agarra. Las fantasmas son las 25 `lab-cuerpo/cuerpo-*`, o sea TODAS las impresas
  del cuerpo (por eso `yunque-verify` solo golpea piezas del módulo del alambre: nunca alcanza la base). Solo apagando el renglón «rayos X: cubierta y paredes…» (texto cortado,
  parece leyenda y no botón; apagado se ve tachado, como deshabilitado) la base se vuelve sólida y agarrable.
  *Fusion:* lo que ves, lo agarras. *Dónde:* `refRayos` arranca en `true` `:4927`; `agarrable … && op >= 0.35` `:2333`.
  *Arreglo:* decirlo donde se mira («rayos X prendido: la cubierta y las paredes no se agarran») y poner el interruptor
  a la vista (propuesta); mejor aún, que el primer clic sobre una fantasma la agarre y el segundo la atraviese.
- **A2 · estorba.** Con un cuerpo o una pieza agarrados no se ofrece nada que hacer (ni barra ni menú): la barra del
  yunque solo sale con CARA. *Fusion:* clic derecho → ocultar, aislar, mover. *Dónde:* `:10015`.
- **A3 · cosmético · 17.** «de fábrica: encadenada» no explica; la razón vive en el `title` de un botón apagado.
  *Arreglo:* texto completo en la barra: «pieza comprada: no se corta ni se le suma; sí acepta un cuerpo nuevo».

## 4 · Modificar una pieza impresa (ventana de 20 × 12, 5 mm; cilindro Ø8; cuerpo nuevo)
- **M1 · bloquea · 11.** Rectángulo y círculo no muestran vista previa entre el primer clic y el segundo, ni medidas;
  teclear «20» no hace nada. El círculo sí tiene una caja «R [mm] [mm] ↵ radio», pero aparece arriba a la izquierda
  ENCIMA de las tenazas, pide radio (Ø8 = teclear 4) y le sobra una caja; el rectángulo no tiene ninguna. *Fusion:*
  cajas junto al cursor, Tab entre ellas. *Dónde:* `SketchEditor.tsx:352` (sin borrador para `rect`), `:1345`
  (entrada dinámica solo para línea/arco/círculo). *Arreglo:* borrador con cajas ancho × alto para `rect`, Ø para círculo.
- **M2 · bloquea · 13.** La Cota: su letrero dice «clic en línea/arco/círculo», pero un clic en una LÍNEA solo la deja
  seleccionada (espera otra línea para medir un ángulo). Hay que dar clic a sus DOS PUNTOS. *Dónde:*
  `SketchEditor.tsx:771–791`. *Arreglo:* una línea sola → cota de su longitud.
- **M3 · bloquea · 12.** La caja de la cota abre con «30.9» sin seleccionar: tecleas 20, Enter, y la ventana queda de
  **30.92 mm** sin ningún aviso. *Dónde:* `SketchEditor.tsx:1334` (`autoFocus` sin `select()`), caja de 56 px.
- **M4 · bloquea · 13.** Una cota no se edita (doble clic) ni se borra (Supr), y Ctrl+Z no hace nada en el boceto. Si
  acotas otra vez los mismos puntos quedan dos cotas: «Conflicto de restricciones», rectángulo rojo de 25.46 mm (el
  promedio) y las etiquetas encimadas. Salida única: Cancelar y empezar. *Dónde:* `SketchEditor.tsx:1080–1093`.
- **M5 · estorba.** La ventana se coloca a ojo: no hay forma de acotarla contra el borde de la cara. Las aristas negras
  que se ven sobre la cara son de otras piezas y ensucian el dibujo. *Fusion:* proyectar aristas de la cara.
- **M6 · estorba · 14.** Nada en la barra del boceto dice «CORTAR sobre Base atrás derecha»; la cinta de arriba sigue con
  «Base» prendido, que es del otro boceto (el del kernel).
- **M7 · estorba.** «Terminar» corta de inmediato a 10 mm (`:6289`, `const prof = 10`). No pregunta profundidad ni hay
  «a través de todo»; para 5 mm hay que hallar la cajita en LOS GOLPES, al fondo del panel. *Fusion:* extruir pide
  distancia con flecha y vista previa.
- **M8 · estorba.** Tiempos medidos en la página (clic → pieza lista): cortar por primera vez 4.5 s con iangpu libre y
  7.2 s con carga ~13/16; cambiar profundidad 2.6–3.4 s; unir 4.6 s; borrar 3.2 s; cuerpo nuevo 1.3 s. En todos el
  hilo se congela casi todo ese tiempo y en 4 de 6 forjas el aviso «⚒ forjando…» NO alcanzó a pintarse antes: el
  `respiro()` de 30 ms (`:5640–5645`) vence antes del siguiente cuadro. *Arreglo:* esperar dos
  `requestAnimationFrame` después de `setForjando(true)`, y a mediano plazo un worker.
- **M9 · estorba · 16.** ↶ está prendido tras cada golpe, pero no los deshace: regresa el plano del boceto del
  documento y deja una rejilla negra sobre la pared. Borrar un golpe (✕ de 13 × 15 px) no confirma. *Dónde:*
  `undo` `:5885` no conoce `golpes`; lo que regresa parece ser el `setSketch` de `bocetoEnCara` (`:6734`). (El coordinador ya lo trae.)
- **M10 · estorba · 24.** Doble clic en una cara chica (1,264 mm²): la cámara queda a 90 mm, metida entre la manguera
  y la antorcha; no se ve ni la cara. *Dónde:* `verDeFrente` `:6705` (`Math.max(90, diag * 2)`). *Arreglo:* piso de
  distancia según la caja de la PIEZA, y volver fantasma lo que quede entre la cámara y la cara.
- **M11 · estorba.** Esc dentro del boceto también SUELTA la cara (se apaga el amarillo) (`:4958–4966`, no mira
  `sketchOpen`). «Cancelar» y «Terminar» dejan la cámara en una vista 3/4, no donde estabas.
- **M12 · estorba · 26.** A 1536×864 la barra del boceto no cabe: «Cancelar» y «Terminar» quedan ENCIMA de tres
  herramientas (simétrica, anclar, construcción) y «✏ Boceto» se parte en dos renglones.
- **M13 · estorba (visto una vez).** Mover la vista con el botón derecho dentro del boceto, con Rectángulo activo, dejó
  dibujado un rectángulo (0 → 4 puntos): el editor no mira qué botón oprimiste.
- **M14 · cosmético · 15.** En LOS GOLPES los nombres se cortan («Saliente…», «Cuerpo n…»), no dicen sobre qué pieza
  van, y las flechitas del campo numérico tapan el número al pasar el mouse.

## 5 · Pieza de fábrica
- **F1 · cosmético · 17.** Se entiende a medias: Unir y Cortar grises y «de fábrica: encadenada» (ver A3). El cubo de
  vistas queda con «ARRIBA» de cabeza al ver una cara que mira a +Z.

## 6 · Cada botón, con el laboratorio abierto (recargando entre uno y otro)

| Botón | Qué hace | Veredicto |
|-------|----------|-----------|
| Boceto | Abre «¿Dónde va el boceto? XY/YZ/XZ… o haz clic en una cara de la pieza» + aviso amarillo; el clic en una cara del lab la agarra con la tenaza y quedan tres avisos encimados (23). | raro |
| XY · YZ · XZ · campo de offset | Cambian su propio resalte; prenden ↶. | nada |
| Base · Unir · Cortar (cinta) | Igual; no son los del yunque. | nada (confunde) |
| Extruir (y tecla E) | Crea un sólido de 11,520 mm³ que no se ve; abre Documento, Caras, Parámetros, Análisis e Historia; El Taller baja 100 px (18). | raro |
| Revolución (y V) | «Error: 16392824» en la barra de estado (19). | truena |
| Agujero | Aviso «Clic en una CARA del sólido» (no hay sólido). | nada |
| Patrón · Redondeo (F) · Chaflán (X) | «Error: El documento no tiene sólido» + panel Parámetros + Historia (06). | raro |
| Más ▾ | Abre 13 opciones: Transición, Barrido, Engrane, Caja cicloidal, Cremallera y Componente crean sólidos sueltos; Barreno, Vaciado, Ángulo y Cajera dan el mismo error; Rosca y Tornillo abren panel; Parámetros abre su panel. | raro (13 de 13) |
| Plano · Sección · Alarma | Apagados. Sección SÍ serviría (O1). | apagado |
| Escala · Move/Copy · Parting Line · Tooling Split · Guías | Apagados (son del molde). | apagado |
| MANUFACTURA | 9 botones de CAM, todos apagados. | nada |
| SIMULACIÓN | Cinta vacía de 75 px + panel «von Mises (FEA real)» (20). | nada |
| ↶ ↷ | Ver M9. | raro |
| ⌃ colapsar | Esconde la cinta. | sirve |
| círculo azul (color) | Sin efecto visible (pinta el sólido del kernel). | nada |
| Opciones | Menú; Exportar STEP y STL apagados; «Guardar versión» no se probó (regla). | sirve a medias |
| ◲ (abajo a la derecha) | Esconde todo el cromo; la barra de estado le tapa media cara al botón. | sirve |
| Radial (dos clics derechos) | 8 íconos sin letrero: Boceto, Extruir, Revolución, Barreno, Redondeo, Chaflán, Patrón, Plano (21). | las mismas del kernel |
| Paleta S («atajos del taller») | 14 herramientas del kernel con letra gris casi invisible (22); ninguna del Taller. | las mismas del kernel |

*Raíz:* la cinta (`:10286–10423`), el radial, la paleta y el mapa de teclas (`KEYMAP` `:8040–8077`) no saben que el
documento es un taller; el mapa de teclas tampoco mira `sketchOpen`, así que R, C, L, D, E, F, X, V y G se disparan dos
veces (en el editor del boceto y en el estudio). *Arreglo mínimo:* con piezas de referencia y sin sólido, la cinta
muestra lo del Taller y esas teclas se callan (propuesta); el radial y la paleta deberían leer la misma lista.

## 7 · Lo que alguien de Fusion busca y no encuentra (solo lista)
Medir · mover o girar una pieza · deshacer/rehacer golpes · exportar STL/STEP de la pieza forjada · editar el boceto de
un golpe ya hecho · proyectar aristas y acotar contra el borde · extruir «a través de todo» y con vista previa ·
empujar/jalar una cara · redondeo y chaflán sobre piezas del laboratorio · menú de clic derecho sobre lo agarrado
(ocultar, aislar, encuadrar selección) · buscar en el árbol · selección múltiple (Ctrl, Shift, ventana) · renombrar ·
copiar un cuerpo · patrón y espejo de golpes · sección (existe, apagada) · volumen y masa de una pieza impresa ·
vistas guardadas · color por pieza.
