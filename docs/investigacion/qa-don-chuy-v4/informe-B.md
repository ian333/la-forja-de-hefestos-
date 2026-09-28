# Informe B: QA visual de Don Chuy (05 «¿A cambio de qué?» y 13 «Le subieron y él no»)

Revisé las 13 hojas cuadro por cuadro (156 cuadros, uno cada 0.5 s), con acercamientos 3× de los cuadros dudosos, y crucé todo contra words.json y escaleta.json.
Coordenadas: lienzo SVG de ElPuesto (0–1000). En el master de 1080×1920 el SVG mide 840 px y empieza en y=220, así que 1 unidad = 0.84 px.

> **Aviso importante antes de leer la tabla.** Las hojas se hicieron con un render ANTERIOR al commit `b0db081` (27-sep 15:15, «los globos de los vecinos suben (y 390 / 290)»). Lo medí en el acercamiento: el globo del vecino 0 está en y≈460 del lienzo, que es el valor viejo (`{x:770,y:460}`), no el actual (`{x:790,y:390}`). Los defectos D1/D2 de «globo tapado» ya están corregidos en el código, **pero no en estos videos**: hay que volver a renderizar (y hacer rsync a iangpu si ahí se renderiza). Lo demás sigue igual en el código actual.

## Defectos (por capítulo)

### 05-a-cambio-de-que

| t | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.4–10.4 | Encimado | La pastilla «Prestado $500» (lata) tapa la mitad de abajo del globo del vecino 0. Primero tapa «¡Te presto $500!» (solo se lee en t=0.0) y luego **todo** «¡Todas para mí!» (5.5–10.4): se ve un rectángulo blanco sin texto detrás de la pastilla. El gancho del capítulo nunca se lee. | Globo 0 en y=460 (render viejo), pastilla de la lata en `anclaCifra("lata")` y=482 y se pinta DESPUÉS de los globos (ElPuesto.tsx:213 vs 219). Ya se corrigió en b0db081; hay que volver a renderizar. | 3 |
| 14.2–16.3 | Encimado | Globo «¡Las revendo a $10!»: solo se lee «…o a $10!». La pastilla «$0» (grande) le queda encima. | Misma causa. | 3 |
| 0.4–11.0, 11.5–16.0 | Encimado / coherencia | **La cara de Don Chuy está tapada** casi todo el primer beat: «Prestado $500» cubre la cara (x 483–897 contra la cabeza en x 480–600, y 392–512) y la pila llena le tapa la boca y el lado izquierdo. Los cambios de `carita` (−0.7 en «trabajó gratis», en «él dijera», en «quedó sin nada») **no se ven**. | Ancho de `Pastilla` = 28·letras+50: con 13 letras mide 414 unidades y, centrada en x=690, invade la cara. `PILA` crece hasta y=458, que es la altura de la cara (ElPuesto.tsx:38–39, 42, 91). | 3 |
| 7.0–10.4 | Encimado | Tres cosas amontonadas encima de la cabeza de Don Chuy: «100 naranjas» (pila, y=390), «Prestado $500» (lata, y=482) y el globo blanco escondido. Se leen como un solo bulto. | Las anclas pila/lata/globo0 caen en una franja de unas 150 unidades justo sobre la cabeza. | 2 |
| 0.5–1.5 | Sincronía | Subtítulo «Don Chuy? Le»: «Le» se ve 1.16 s antes de que se diga. | Subtitulos.tsx:65–84: bloques fijos de 3 palabras (`max_palabras_visibles: 3`, escaleta.py:90); solo cortan con silencios de más de 1.5 s y **no cortan en el punto**. | 2 |
| 4.5–5.5 | Sincronía | «otro. Mira la»: una frase ya terminada y el arranque de la otra en la misma línea; «Mira» se adelanta 1.08 s. | Igual. | 2 |
| 10.4–11.5 | Sincronía | «Vendió todas, pagó»: «pagó» se adelanta 1.18 s. | Igual. | 2 |
| 15.0–16.0 | Sincronía | «del otro. Esa»: «Esa» se adelanta 1.34 s y además es el GIRO del capítulo («Esa trampa le valió un Nobel»): se anuncia antes de tiempo. | Igual. | 2 |
| 29.0–30.0 | Sincronía | «esa trampa. Antes»: «Antes» se adelanta 1.28 s. | Igual. | 2 |
| 31.0–32.0 | Sincronía | «presten, pregunta: ¿a»: «¿a» se adelanta 1.56 s y la pregunta queda partida («¿a» / «cambio de qué?»). | Igual. | 2 |
| 19.5–21.0 | Texto | El subtítulo dice «Mujámad Iúnus» y la banda de arriba dice «Muhammad Yunus»: el mismo nombre escrito de dos formas en el mismo cuadro. | El subtítulo sale de words.json (la respelación que se le pasa al TTS). Falta volver a mapear las palabras al `texto_vo` original antes de pintarlas. | 2 |
| 16.5–30.0 | Espacio / ritmo | 13.5 s con el puesto quieto: la camioneta ya se fue, no hay naranjas ni billetes, y solo cambian pastillas de texto en el cielo (Nobel, 42 personas, 27 dólares, De su bolsa, Grameen). Las cifras dichas («cuarenta y dos», «veintisiete dólares») no se dibujan. | La escaleta ya lo reconoce («DIBUJOS QUE HARÍAN FALTA»). | 2 |
| 21.0–26.0 | Legibilidad | «42 personas en Bangladesh» y «27 dólares entre todas» van sin `grande`, así que se ven más chicas que «Nobel de la Paz 2006» (grande). «27 dólares» sale en rojo sobre casi negro y al aparecer se lee débil. | `s = grande ? 0.6+0.65·pop : 0.85+0.15·pop` (ElPuesto.tsx:224). | 1 |
| 32.5–33.5 | Redundancia | La banda «¿A cambio de qué?» y el subtítulo «cambio de qué?» dicen lo mismo a la vez, uno arriba y otro abajo. | Diseño (frase y subtítulo a la vez). Es aceptable, pero gasta dos zonas en lo mismo. | 1 |
| 34.0–36.0 | CTA | La tarjeta dice «¿Trabajaste para otro?» y la voz/subtítulo «¿trabajaste para quien te prestó?»: dos preguntas distintas en pantalla. Por debajo del velo (0.82) se ven Don Chuy y la mesa, y el texto de la tarjeta cae encima de la cabeza. La flecha apunta a la mesa, no «aquí abajo». | `cta` en ElPuesto.tsx:239–248 (velo con opacidad 0.82, flecha en y 600–710). | 2 |
| 11.0 | Coherencia (OK) | 5 billetes vecino→lata = $500 = 100×$5 ✓. Préstamo: 5 entran, 5 van al proveedor, 5 entran por la venta y 5 regresan al vecino → $0 ✓. La camioneta está cuando se le paga (1.2 s) ✓. | — | — |

### 13-le-subieron-y-el-no

| t | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.0 | Gancho / sincronía | En el cuadro 0 **no está la camioneta** (va entrando) y por eso tampoco la pastilla «$6 c/u», que es el acontecimiento del capítulo. Aparece hasta t=0.5. | `camion llega` en t=0 anima de −900 a 20 en 0.9 s (ElPuesto.tsx:71–74), y `anclaCifra("camion")` depende de `camionX`. | 2 |
| 0.0–2.0 | Encimado | «Ayer: $5 c/u» (centro, y=250) y «100 naranjas» (pila, y=390) quedan apiladas justo sobre la cabeza de Don Chuy, y la pila llena le tapa la cara. El cuadro 0 se lee como «dos pastillas y un montón». | Anclas centro/pila sobre la cabeza; `PILA` hasta y=458. | 2 |
| 3.5–4.8 | Legibilidad / quién habla | Globo «Como siempre»: la letra Caveat se ve chica (unos 35 px a 1080) y la colita cae entre la lata y los vecinos: no queda claro que habla el vecino y no Don Chuy. | Globo 0 en x=770–790; la colita siempre en el centro (naranjas.tsx:177). | 1 |
| 5.0–7.0 | Encimado / coherencia | «Faltan $100» (grande) tapa la cara de Don Chuy justo cuando se pone triste (carita −0.7 en 5.84): la emoción del beat no se ve. | 11 letras → 358·1.25 = 447 unidades de ancho centradas en x=690. | 3 |
| 7.0 | Coherencia | La pila aparece llena de golpe (`pila n:15` en «Mira la camioneta»), sin que la camioneta entregue nada. Luego se vende OTRA vez (13.2 s): el espectador ve dos ventas y solo una entrada de billetes. | escaleta: el `pila` en «Mira la camioneta» es un flashback que no se dibuja como tal. | 2 |
| 9.5–11.0, 11.5–13.0 | Encimado | Tres pastillas en escalera sobre la cabeza de Don Chuy: «Ayer: $500 · hoy: $600» / «Le subió 20 de cada 100» (centro), «100 naranjas» (pila) y «Cobra $600» (camión). La cara no se ve y el ojo no sabe qué leer primero. | Anclas centro (500,250), pila (420,390) y camión (170,515) en la misma diagonal. | 2 |
| 11.0 y 23.3–23.8 | Parpadeo | El letrero «$10 c/u» se APAGA y vuelve a aparecer (fade desde 0) cada vez que se repite el evento `letrero`. Buscaba decir «se vuelve a encender», pero se ve como un parpadeo o un error. | `aparece(letrero)` reinicia la opacidad desde 0 aunque el texto sea el mismo (ElPuesto.tsx:170, 206). | 1 |
| 0.6–2.0 | Sincronía | «Don Chuy? Vendió»: «Vendió» se adelanta 1.28 s. | Subtitulos.tsx:65–84 (bloques de 3 que no cortan en el punto). | 2 |
| 6.0–7.0 | Sincronía | «pesos. Mira la»: se adelanta 1.26 s. | Igual. | 2 |
| 7.5–8.5 | Sincronía | «camioneta: hoy le»: se adelanta 0.94 s. | Igual. | 1 |
| 13.2–14.5 / 14.6–15.5 | Sincronía | «Vendió todas, una» y «por una, y»: parte «una por una» en dos bloques y se adelanta ~1 s. | Igual. | 1 |
| 16.5–18.0 | Sincronía | «de siempre. Le»: «Le» se adelanta 1.42 s. | Igual. | 2 |
| 20.5–22.3 | Sincronía | «pesos. No vendió»: «No vendió» se ve 1.56 s antes. Es el remate («No vendió menos»), que llega adelantado y encimado con la cifra anterior. | Igual. | 2 |
| 20.0 | Sincronía (leve) | «$400» aparece con «quedaron» (19.98), 0.38 s antes de «cuatrocientos». Está dentro de ±0.5, pero la regla sería anclar a la palabra-número. | escaleta: `"en": "quedaron cuatrocientos pesos"` ancla a la PRIMERA palabra del fragmento. | 1 |
| 15.5–16.2, 18.2–18.8 | Encimado (leve) | Los 10 billetes tapan las caras de los vecinos al salir. Al ir al camión pasan por detrás de la pastilla «$1,000» y se ven cortados. | `vuelan` se pinta antes que las cifras (ElPuesto.tsx:209 vs 219). Aceptable. | 1 |
| 24.0–25.9 | Encimado (leve) | La banda «La subida la pagas tú.» queda pegada encima de «Ayer: $500» (unos 50 u de separación): dos píldoras oscuras iguales, una sobre otra. La frase memorable no se distingue de una cifra. | Frase en y 40–160 y centro en 210–290, con el mismo estilo. | 1 |
| 26.0–32.0 | CTA | «Ayer: $500» y «$400» se ven **como fantasmas** a través del velo, por encima y detrás de «¿Subes cuando te suben?». La tarjeta dice una pregunta y la voz otra («¿subes tu precio el día que te sube el proveedor?»). El pie «Sí o no · escríbelo aquí abajo» (gris, 46 u ≈ 39 px) y «GAIA PRIME» (≈29 px) apenas se leen en el celular. Los subtítulos de 3 palabras parten la pregunta en «tu precio el» / «día que te». | Las `cifras` se siguen pintando durante el `cta` (a diferencia de `frase`, que sí revisa `!cta`, ElPuesto.tsx:219 vs 232), y el velo es de 0.82. | 2 |
| 16.9–20.7 | Coherencia (OK) | 10 billetes entran = $1,000 ✓; 6 van al camión = $600 ✓; queda $400 ✓; la camioneta está cuando se le paga y se va en 22.3 ✓. | — | — |

## Patrones (lo que se repite en los dos capítulos)

1. **Los subtítulos cruzan frases.** Es la «desincronía» que siente ian. Hay 7 bloques en el 05 y 9 en el 13 que meten la primera palabra de la oración siguiente entre 0.8 y 1.6 s antes de que se diga («otro. Mira la», «pesos. No vendió»). Como el bloque se enseña completo desde su primera palabra, **siempre se ve texto que la voz no ha dicho**, y «dos frases a la vez» es lo que se lee como «encimado». Causa única: `Subtitulos.tsx` agrupa de 3 en 3 y solo corta con silencios de más de 1.5 s. Las pausas de Matilda entre oraciones son de 0.8–1.2 s, así que nunca se cortan.
2. **Todo se amontona sobre la cabeza de Don Chuy.** Las anclas `pila` (420,390), `lata` (690,482), `centro` (500,250), `chuy` (540,320) y el globo 0 caen en unas 250×300 unidades alrededor de la cabeza (540,452). Con textos largos (la pastilla crece 28 u por letra) tapan la cara, y la cara es el canal emocional (`carita`). En los dos capítulos la tristeza de Don Chuy casi nunca se ve.
3. **La pastilla es el único recurso para todo.** Se usa igual para una cifra (el dinero en la lata), una etiqueta («100 naranjas»), una comparación («Ayer: $500 · hoy: $600») y un dato de contexto («42 personas en Bangladesh»). Como todo es la misma píldora negra, no hay jerarquía, y lo que se acumula (la cuenta) desaparece cuando la siguiente pastilla del mismo `donde` la reemplaza. La cuenta **nunca se ve completa en un solo cuadro**, y esa es justo la tesis de la serie.
4. **El espacio de abajo está vacío** (medido en 1080×1920):
   - El dibujo útil (fachadas + puesto) ocupa de ~330 a ~910 px.
   - La banqueta, de 910 a 1150 px (240 px, 12 %), es asfalto oscuro sin nada, salvo la casita o la basura cuando alguien las llama.
   - La banda de subtítulos, de 1150 a 1400 px (250 px), lleva UNA línea de ~65 px; sobran ~185 px.
   - De 1400 a 1920 px no hay nada (lo que está debajo de 1440 lo tapa la interfaz de IG/TikTok, así que ahí no va nada importante).
   - En total, de la caja segura (220–1440 = 1220 px), **unos 420 px (34 %) cargan una sola línea de texto** durante todo el video, incluso en el CTA.
5. **El CTA repite la pregunta con otras palabras** (la tarjeta dice una, la voz otra) y no apaga lo de abajo (se ven fantasmas de las pastillas y del dibujo).
6. **Lo que sí está bien en los dos:** las cuentas de billetes y naranjas cuadran; las cifras aparecen dentro de ±0.5 s de su palabra; la camioneta está cuando se le paga. El dibujo, el color y la lluvia/luz no tienen defectos.

## Propuesta del espacio («auxiliar visual, no pizarrón pero sí»)

**Opción A: LA LIBRETA DE DON CHUY** (elegida). Una hoja de libreta de papel (cuadriculado tenue, letra Caveat, como la de un tendero) sobre la banqueta, entre el puesto y los subtítulos. Cada vez que se mueve dinero, Don Chuy «anota» un renglón con su signo, y abajo va el total subrayado, que es el mismo que la lata. Es «anotar es ver» literal: la cuenta completa queda en pantalla, renglón por renglón, conforme la voz la dice.

**Opción B: LA REGLETA DE LA LATA.** Una barra horizontal a lo ancho (de x 120 a 880) con una casilla por billete de $100. Se llena en verde cuando entran billetes y se vacía en rojo cuando salen, con una marca fija «Ayer: $500» cuando exista. No necesita palabras y se deriva sola de `billetes`. Es muy visual, pero no explica POR QUÉ salió el dinero (préstamo o proveedor), y en capítulos sin billetes (el beat de Yunus) se queda muerta.

**Opción C: TIRA DE DIÁLOGO.** Bajar los globos a una tira de cómic sobre la banqueta («Vecino: ¡Te presto $500!»), como subtítulo de los personajes, separado de la narradora. Así los globos no chocan nunca con las pastillas, pero no ayuda a entender la cuenta (que es la tesis) y le mete otra lectura de texto al ojo.

### La elegida (A) con detalle

**Qué la alimenta (derivado automático; los 60 capítulos funcionan sin reescribir escaletas):**
- `billetes`: cada evento con `a: "lata"` escribe `+$(100·n)` y cada uno con `de: "lata"` escribe `−$(100·n)`. La etiqueta del renglón es el lugar del otro lado («vecinos», «proveedor»/`camion`, «casa», …), o un campo opcional nuevo `"nota": "préstamo"`. Con los datos reales:
  - 05: +$500 vecino (préstamo) · −$500 proveedor · +$500 venta · −$500 pagó préstamo → **Queda $0** ✓
  - 13: +$1,000 venta · −$600 proveedor → **Queda $400** ✓
- `letrero` con `antes`: renglón «Precio: ~~$10~~ $5 c/u» (el 05 lo necesita, porque la trampa ES ese renglón).
- `cifra` con un campo opcional nuevo `"libreta": true` (o `"libreta": "texto"`): mete un renglón de contexto sin billetes. En el 13 serían «Proveedor: ~~$5~~ $6 c/u» y «Ayer quedaban $500»; en el 05, «El que prestó: +$500» en otro color (la cuenta del otro).
- El total («Queda $X», subrayado) sale de la suma de los `billetes`. **Gratis de paso sale una puerta de coherencia** en `escaleta.py`: la suma tiene que ser igual al último `cifra donde:"lata"`; si no, el capítulo está mal contado. Así se cazan los errores de los 60 capítulos sin mirarlos.

**Dónde va (lienzo de 1000 de ElPuesto):**
- Hoja en x 250–750, y 850–1100 (en el master: x 270–690 px, y 934–1144 px). El SVG ya tiene `overflow: visible` y la banqueta llega hasta ahí.
- La casita (x 64–236, y 758–946) y la basura (x 730–810, hasta y 822) no la tocan.
- Hasta 4 renglones de Caveat 44 u (~37 px) con 52 u de interlínea, más la línea del total. Cuando entra el quinto, los de arriba suben y se desvanecen, y el total queda fijo.
- Cada renglón entra con su evento (ya anclado a la voz), «escrito»: un clipPath que se abre de izquierda a derecha en 0.35 s. Los positivos en verde `exito`, los negativos en rojo `error`, el total en blanco con subrayado ámbar.
- Nace en el primer renglón; antes solo está la hoja vacía (o nada), para no gastar el cuadro 0.

**Cómo evita a los subtítulos:**
- La hoja acaba en 1144 px y la banda empieza en 1150 px. Como la línea de subtítulo ocupa ~1240–1310, quedan ~100 px libres de verdad.
- Si se quiere más aire: en `tokens.json` → `safe_areas.banda_subtitulos` se puede bajar a `y: 1250, h: 170` **solo para el perfil chispa** (la línea es una sola y cabe). Así la libreta gana 100 px y puede ir hasta 1220 u.
- Nada de la libreta baja de 1440 px (la zona de la interfaz de la app).

**Qué quita de arriba (y así se van los encimados):**
- Con la libreta, `cifra donde:"lata"` queda solo como la cifra corta sobre la lata (≤ 6 caracteres: «$500», «$0»). Las etiquetas largas («Prestado $500», «Faltan $100», «Ayer: $500 · hoy: $600», «Le subió 20 de cada 100») se van a renglones.
- Se libera la cabeza de Don Chuy y la carita vuelve a verse.

**En la tarjeta CTA:**
- La libreta se pinta DESPUÉS del velo, así que se queda encendida: es la cuenta final que el espectador se lleva.
- Se le agrega un último renglón que es la pregunta de la serie con dos casillas: «¿Y tú? ☐ Sí ☐ No».
- Se reacomoda la tarjeta: pregunta en y=380, pie en 450, flecha de 520 a 620 (que ahora apunta a las casillas y a los comentarios), «GAIA PRIME» en y=780.
- Las pastillas se apagan durante el CTA (ver arreglo 3).

**Implementación:** un componente `Libreta` en naranjas.tsx (hoja, renglones y total, puro en `T`). En ElPuesto.tsx, un `const renglones = pasados.flatMap(...)` que recorre `billetes`/`letrero`/`cifra.libreta` en el mismo bucle que ya existe (líneas 108–164). En `docs/plantillas/ElPuesto.md` se documentan `nota` (billetes) y `libreta` (cifra). En escaleta.py, la verificación suma = lata.

## Arreglos ordenados por impacto/esfuerzo

1. **Volver a renderizar los dos con el código actual** (b0db081 ya sube los globos: cierra los D de «globo tapado» del 05). Hacer rsync del render/src a iangpu antes. Impacto alto, esfuerzo casi nulo.
2. **Subtítulos que no cruzan frases** (lib/Subtitulos.tsx:76–81). Llamar a `cerrar()` después de una palabra que termina en `. ? ! : ;` y abrir un bloque nuevo cuando el hueco con la anterior sea de más de 0.45 s (hoy es 1.5 s). Opcional: subir `max_palabras_visibles` a 4 en chispa (escaleta.py:90) para que los bloques cortos no queden de 1–2 palabras. **Cierra los 16 adelantos medidos.** Es global: sirve a todas las series, y no pone en riesgo el quiz, porque también corta ahí. Esfuerzo: unas 5 líneas.
3. **Apagar pastillas durante el CTA** (ElPuesto.tsx:219: `!cta &&` como ya lo hace `frase`). Subir el velo a 0.92 y hacer que `cta.texto` sea literal lo que dice la voz (o que la voz diga lo de la tarjeta). Esfuerzo: 1 línea + escaletas.
4. **Liberar la cara de Don Chuy.**
   - Anclar `lata` a x=720 y a la derecha de la cabeza: `anclaCifra("lata") = { x: LATA.x + 40, y: LATA.y - 150 }` con `textAnchor` a la izquierda (la pastilla crece hacia la derecha, no hacia la cara).
   - Mover `pila` a (380,380) para que crezca hacia la izquierda.
   - Tope en escaleta.py: pastillas de `lata`/`pila` de ≤ 8 caracteres y avisar si una es más larga (lo largo va a la libreta).
   - Esfuerzo: bajo.
5. **La libreta (Opción A).** Es el cambio grande que usa el espacio y le da el sentido de «anotar es ver». Esfuerzo: medio (un componente + una derivación + una verificación), sin reescribir escaletas; `nota`/`libreta` son opcionales.
6. **Camioneta ya estacionada en t=0**: si `cam.t <= 0 && accion === "llega"`, `camionX = 20` sin animar (ElPuesto.tsx:71). Así el «$6 c/u» del 13 está en el cuadro 0. Esfuerzo: 1 línea.
7. **Letrero sin parpadeo**: si el `letrero` nuevo trae el mismo texto que el anterior, en vez de fundido desde 0 hacer un pulso (escala 1→1.15→1 en 0.4 s) (ElPuesto.tsx:205–207). Esfuerzo: bajo.
8. **Subtítulo con la ortografía del guion, no la del TTS**: en `align`, mapear las palabras respeladas del glosario («Mujámad Iúnus») de vuelta a las de `texto_vo` («Muhammad Yunus») antes de escribir words.json para pintar. Esfuerzo: bajo-medio (pipeline).
9. **Escaleta del 13**: cambiar el `pila n:15` de «Mira la camioneta» por un `llegan n:15` desde la camioneta, para que se vea de dónde salen y se entienda que el costo es de ESAS naranjas.
10. **Escaleta del 05**: en el beat de Yunus (16.5–30 s), que el ancla de «cuarenta y dos» y de «veintisiete dólares» caiga en la palabra-número. La cifra entra con «cuarenta» (21.06) y la libreta puede cargar «Yunus: $27 de su bolsa» (renglón `libreta`), para que ese medio minuto no quede solo como texto en el cielo.
11. **Menores:**
    - Colita del globo apuntando al vecino que habla (desplazarla hacia `VECINOS[i].x`, naranjas.tsx:177).
    - Pie del CTA en blanco y a 52 u.
    - `grande` por defecto en `centro`, para que todas las cifras de contexto tengan el mismo tamaño.
    - Frase memorable con otro estilo que la pastilla (fondo ámbar o sin píldora) para que no se confunda con una cifra.
