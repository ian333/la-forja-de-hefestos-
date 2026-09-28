# Informe C: QA visual de Don Chuy, capítulos 20 y 29

Revisé las 12 hojas cuadro por cuadro. Las hojas vienen reducidas (cada cuadro mide ~277×480), así que hice ampliaciones ×2 de la zona del dibujo (`zoom-0N.png` en cada carpeta) para leer pastillas y globos. Crucé cada cuadro contra words.json y contra la escaleta ya resuelta. Las posiciones en «u» son unidades del lienzo SVG de 1000×1000 de ElPuesto. Las posiciones en px son del diseño de 1080×1920 y las estimé de las hojas, así que son aproximadas (±20 px).

Geometría medida, para entender el problema del espacio: el SVG mide `lado = min(840, altoUtil=930)/esc`, así que en pantalla 1 u ≈ 0.74 px. Todo lo que tiene información (pastillas, personajes, mesa) cae entre y≈430 y y≈915 px. La banqueta vacía va de 915 a 1150 px. La banda de subtítulos ocupa de 1150 a 1400 px, pero el texto (una línea) solo usa ~80 px de esos 250.

---

## Defectos por capítulo

### 20-las-de-las-nueve

| t (s) | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.0–23.5 | ENCIMADO | La pastilla «Ya pagadas: $100» (y luego «$100: ya se fue») queda **encima de la gorra y los ojos de Don Chuy** durante 23 s. La carita, que es la emoción del capítulo, casi no se ve. | `anclaCifra("pila") = {420,390}` (ElPuesto.tsx:93). Con esos textos la pastilla mide 450–500 u de ancho y tapa la cabeza (x 480–600, y 384–512). | 3 |
| 0.0–9.6 | ENCIMADO | El globo «¿A diez? Ahí déjelas» (quien 0) tapa la mitad derecha de la cara de Don Chuy (bigote y boca). | Globo 0 fijo en (790,390) con ancho ≥300 u, así que su borde izquierdo llega a x≈630 (ElPuesto.tsx:216). | 2 |
| 0.5–9.6 | ENCIMADO | La colita del globo 1 «Están muy caras» cae dentro del globo 0, así que parece que un globo le habla al otro. Ninguna colita apunta a un vecino: las dos apuntan al hueco entre la lata y los vecinos. No se sabe quién habla. | Colita fija al centro del globo (naranjas.tsx:177). El globo 1 está en (860,290), 100 u arriba del 0. | 2 |
| 0.0–5.5 | SINCRONÍA / carga | 5 textos a la vez: 2 pastillas, 2 globos y el subtítulo. La voz dice «Remató a menos de lo que le costó» mientras los globos dicen otra cosa. Esto es lo que ian llama «diálogos encimados»: dos voces leídas a la vez. | Escaleta: los globos van en t=0 y duran hasta «Les bajó» (9.6 s). | 2 |
| 0.5 | SINCRONÍA | Subtítulo «Don Chuy? **Remató**»: la palabra *Remató* (1.82 s) sale 1.3 s antes de decirse y en el mismo bloque que la pregunta. | Subtitulos.tsx:76-81 corta cada 3 palabras (`max_palabras_visibles: 3`, escaleta.py:90) y no respeta la puntuación. El bloque se pinta entero desde su primera palabra. | 3 |
| 2.5→3.0 | SINCRONÍA | El bloque «lo que le» casi no se ve: a los 2.5 s está «a menos de» y a los 3.0 s ya entra «costó, y salió». | Mismo agrupador: bloques de 3 palabras con palabras de 0.1 s. | 1 |
| 4.5–5.5 | SINCRONÍA | «ganando. **Mira la**»: *Mira la* sale ~1 s antes (5.58 s) y cruza la frase. | Subtitulos.tsx (no corta en «.»). | 2 |
| 10.0–11.5 | LEGIBILIDAD | Letrero «~~$10 c/u~~ $3 c/u»: el tachado en Caveat 40 con raya roja se lee como una mancha a tamaño teléfono (~30 px). El «$3» es el dato y apenas se distingue. | naranjas.tsx:262-264 (letra 40/44 en un letrero de 250 u). | 2 |
| 11.0–13.0 | ENCIMADO | «¡A tres! Deme todas» otra vez sobre la cara de Chuy, y «Yo también, deme» encima con la colita metida en el otro globo. | Igual que arriba. | 2 |
| 11.5 | SINCRONÍA | Las naranjas empiezan a volar a los 11.5 s. La voz dice «volaron» a los 12.12 s. | El ancla «y volaron» se resuelve en la «y» (11.48 s). | 1 |
| 13.4–14.5 | COHERENCIA | Las 3 naranjas **regresan** a la mesa («Fíjate en el bote») sin ninguna señal de que es «la otra opción». Se lee como si las ventas se hubieran deshecho. | Escaleta: `pila n:3` en «Fíjate en el bote». | 2 |
| 15.0–25.0 | ENCIMADO | La pastilla grande «$0» del bote tapa la esquina de la mesa y el cuerpo del vecino morado. | `anclaCifra("basura") = {770,672}`, `grande` a escala 1.25. | 2 |
| 17.0 | SINCRONÍA | «$60» aparece a los 17.04 s («le»). La voz dice «sesenta» a los 17.64 s. | Ancla «le dejaron sesenta» (empieza en «le»). | 1 |
| 17.0–25.0 | LEGIBILIDAD / cuenta | «$0» (grande, rojo) y «$60» (chico, verde) flotan **sin etiqueta**. No se lee que $0 = «si las tira» y $60 = «si las remata». La cifra ganadora es más chica que la perdedora. | Vocabulario `cifra` sin renglón o etiqueta. `$60` sin `grande`. | 2 |
| 17.5–19.0 | SUBTÍTULO | «dejaron / sesenta pesos.» se va a 2 líneas y el bloque salta hacia arriba. | text-wrap: balance con palabras largas. | 1 |
| 23.0–24.9 | ENCIMADO / LEGIBILIDAD | La frase «Lo que ya pagaste no está en juego.» **se sale de su banda** y llega casi al borde izquierdo (x≈7 de 277). La banda es #0B0E14 sobre cielo oscuro y no se ve, así que la frase flota sin caja. | ElPuesto.tsx:234-235: rect de 820 u y texto de 62 u sin medir (≈35 caracteres ≈ 1150 u). | 3 |
| 24.0–25.0 | SINCRONÍA | «en juego. **Y**»: la «Y» (25.04 s) sale 1 s antes y se queda sola en la pausa. | Subtitulos.tsx. | 2 |
| 25.0–32.0 | TEXTO CORTADO | **La pregunta del CTA está cortada por la izquierda**: se lee «enderías por menos de lo que te costó?». Se perdió «¿V». Es el gancho de comentarios. | ElPuesto.tsx:242: `fontSize 66`, una sola línea, 40 caracteres ≈ 1450 u en un lienzo de 1000. | 3 |
| 25.0–32.0 | SINCRONÍA | La tarjeta dice «¿Venderías por menos de lo que te costó?». La voz y el subtítulo dicen «¿venderías más barato de lo que te costó por no tirarlo?». Son dos redacciones distintas de la misma pregunta en el mismo cuadro. El pie dice «escríbelo aquí abajo» y la voz dice «Contéstame… aquí abajo». | Escaleta `cta.texto` escrito aparte del `texto_vo`. | 2 |
| 25.0–32.0 | ESPACIO | El CTA ocupa 180–280 px del cuadro (título, pie, flecha y GAIA PRIME apretados). La flecha apunta a la mesa en penumbra, no a los comentarios. Abajo quedan ~900 px vacíos. | Tarjeta pintada dentro del SVG (y 420–900 u). | 2 |
| 30.0–31.0 | SINCRONÍA | «Contéstame sí **o** / no aquí abajo»: el «sí o no» se parte en dos bloques. | Subtitulos.tsx. | 1 |

### 29-dijeron-que-si

| t (s) | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.0–3.9 | ENCIMADO | **La pastilla «$0» de la lata queda ENCIMA del globo «Yo sí te compro»**. Solo se lee «…compro». Es el gancho del capítulo y es ilegible. | Las pastillas se pintan DESPUÉS de los globos (ElPuesto.tsx:213 contra 219). El globo 0 está en (790,390) y la pastilla de la lata en (690,482): se cruzan en x 630–765. | 3 |
| 0.5–3.9 | ENCIMADO | En el globo «Yo también le compro» (quien 1) la pastilla «Su hora: $50» tapa el «Y» inicial: se lee «…o también le compro». | Globo 1 en (860,290), ancho ≈445 u, así que su borde izquierdo queda en x≈637. «Su hora: $50» en `chuy` (540,320) mide ~386 u y su borde derecho queda en ≈733. | 3 |
| 0.0–5.9 | ENCIMADO | «Abrió 2 horas antes» (centro, y=250) y «Su hora: $50» (chuy, y=320) quedan una bajo la otra y **se traslapan unos 8 u**. Se leen como una sola frase. | `anclaCifra` centro (500,250) contra chuy (540,320): separación de 70 u con pastillas de 78 u de alto (ElPuesto.tsx:94,99). | 2 |
| 0.0–3.9 | carga | 6 textos a la vez (3 pastillas, 2 globos y el subtítulo) en los primeros 4 s, justo donde se decide el scroll. | Escaleta: todo en t=0. | 2 |
| 7.0–8.0 | ENCIMADO | «2 horas» (centro) medio escondida detrás de «Su hora: $50». | Mismas anclas centro/chuy. | 2 |
| 8.5–10.0 | ENCIMADO | «2 horas · $0» (grande, rojo) le tapa la mitad de arriba a «Su hora: $50». | Mismas anclas, más la escala `grande`. | 2 |
| 9.5 | ENCIMADO + SINCRONÍA | El globo «Ya vine, Don Chuy» aparece a los 9.34 s pero **queda tapado por la pastilla «$0»**. Solo se lee «…n Chuy». Además dura 0.84 s (hasta «a su» a los 10.18 s): nadie lo alcanza a leer. | Pastilla de la lata sobre el globo 0 (orden de pintado), más `hasta_en` demasiado corto. | 3 |
| 10.0–11.8 | REDUNDANCIA | La pastilla «A su hora de siempre» repite **palabra por palabra** el subtítulo «su hora de siempre», y queda pegada a «Su hora: $50»: dos «hora» apiladas con sentidos distintos (la hora de llegada contra el precio de la hora). | Escaleta: cifra de texto que duplica la voz. | 2 |
| 11.8 | SINCRONÍA | «siempre. **Fíjate en**» cruza la frase y adelanta la palabra ~0.4 s. | Subtitulos.tsx. | 2 |
| 14.0–18.9 | ENCIMADO | Se forma una **torre de pastillas** sobre la cabeza de Chuy: «2 horas × $50 = $100» / «Su hora: $50» / (desde 16.5 s) «0 vendidas». Las tres se tocan. | Centro, chuy y pila apilados en 250/320/390. | 3 |
| 16.5–21.5 | ENCIMADO | «0 vendidas» (pila, grande) **tapa la cara de Don Chuy** justo cuando la carita pasa a triste (16.82 s): la emoción del momento no se ve. | `anclaCifra("pila") = {420,390}`. | 3 |
| 15.0 | SINCRONÍA | «= $100» aparece a los 14.98 s («costaron»). «cien» se dice a los 15.42 s. | Aceptable (±0.5 s). | 1 |
| 17.0–19.0 | SINCRONÍA | «quedó igualita. **Nadie**»: *Nadie* sale 1.9 s antes (18.94 s) y cruza frase y pausa. | Subtitulos.tsx. | 2 |
| 21.5–24.2 | ENCIMADO / LEGIBILIDAD | La frase «Contestar es gratis, comprar cuesta.» toca el borde izquierdo (x≈2) y se sale de su banda invisible. | ElPuesto.tsx:234-235 (igual que en el 20). | 3 |
| 22.5–24.2 | SINCRONÍA | «comprar cuesta. **Y**»: la «Y» (24.28 s) se ve 1.7 s antes, sola, durante la pausa dramática. | Subtitulos.tsx. | 2 |
| 24.5–30.0 | TEXTO CORTADO | **CTA cortado**: se lee «e crees a un cliente que te dice que sí?». Se perdió «¿L». | ElPuesto.tsx:242 (igual que en el 20). | 3 |
| 26.5–27.5 | SINCRONÍA | «que sí? **Sí**»: la respuesta «Sí» (27.64 s) cae en el mismo bloque que la pregunta. | Subtitulos.tsx. | 2 |
| 24.5–30.0 | ESPACIO | La tarjeta CTA se amontona en la franja de 150–270 px de la hoja (30 % del alto), con la flecha sobre la mesa apagada. | Igual que en el 20. | 2 |

Lo que SÍ está bien (no lo toquen):
- Las cifras dichas en voz llegan a tiempo, dentro de ±0.6 s: «$3 c/u», «$0», «$60», «2 h × $50 = $100», «0 vendidas».
- La carita cambia en su ancla.
- La pila del 29 queda intacta, como quiere la nota.
- En el 20 la cuenta 3 naranjas = «20» y $100/$60 cuadra con la nota.
- No aparece camioneta en ninguno de los dos, y está bien porque no se surte.
- No vi ningún billete volando sobre texto.

---

## Patrones (se repiten en los dos capítulos)

1. **Los subtítulos cortan cada 3 palabras sin mirar la puntuación.** Es la causa principal de «desincronizados». En los dos capítulos 7 u 8 bloques cruzan un punto o una interrogación («Don Chuy? Remató», «en juego. Y», «comprar cuesta. Y», «que sí? Sí»). Como el bloque se pinta entero desde su primera palabra, la palabra de la frase siguiente aparece 0.4–1.9 s antes de oírse, y peor si cae en una pausa dramática. Subtitulos.tsx:76-81 solo corta por conteo (3) o por huecos de más de 1.5 s. Las pausas entre frases de Matilda son de 0.6–1.3 s, así que nunca llegan a cortar.
2. **Las pastillas y los globos se pisan por diseño.** Las anclas centro (500,250), chuy (540,320) y pila (420,390) están a 70 u una de otra con pastillas de 78 u de alto: siempre se traslapan. Las pastillas se pintan después de los globos, así que el globo, que es el gancho, siempre pierde. No hay ninguna regla que evite la cara de Don Chuy.
3. **La cara de Don Chuy queda tapada** en el 20 durante 0–23.5 s y en el 29 durante 16.5–21.5 s. La carita es el único termómetro emocional y está bajo una pastilla.
4. **Los textos largos no se miden**: la frase (62 u) y el CTA (66 u) van en una sola línea. La pregunta del CTA sale cortada en los dos capítulos, y ese es el llamado a comentar.
5. **Textos que duplican la voz** con otra redacción: el CTA contra la pregunta dicha, y «A su hora de siempre» contra el subtítulo. Dos lecturas de lo mismo compiten.
6. **Los globos arrancan en t=0 y duran 4–10 s** mientras la narradora dice otra cosa. Son «diálogos encimados» en el tiempo, no solo en el espacio.
7. **Las cifras flotan sin etiqueta** («$0», «$60», «$0» en la lata). La cuenta existe, pero repartida en 3 o 4 pastillas por el dibujo: nunca se ve **junta**.
8. **Espacio muerto en todo el video** (medido en los dos, t=0 a 25 s):
   - Banqueta vacía de ~915 a ~1150 px: unos **235 px**, el 12 % del alto.
   - Aire dentro de la banda de subtítulos: unos **170 px**.
   - En total, **~400 px (~21 % del cuadro) sin información**, continuos, justo en la zona donde el ojo cae al leer el subtítulo.
   - Abajo de 1400 px queda la zona de la interfaz de la app, que sí debe quedar libre.
   - Arriba, de 220 a 430 px, está el cielo, que solo usa la frase final.

---

## Propuesta del espacio: «auxiliar visual, no pizarrón pero sí»

### Opción A: La libreta de Don Chuy (la ELEGIDA)
Una tira de libreta de papel cuadriculado, con letra Caveat, en la banqueta. Va juntando **renglones de la cuenta** conforme la voz los dice. Es la tesis de la serie hecha objeto: *anotar es ver*. Al final del capítulo la libreta ES la cuenta completa.

### Opción B: La recta (o balanza) de la cuenta
Una barra horizontal de $0 a $X en la banqueta: entradas en verde a la derecha, lo pagado o hundido en rojo a la izquierda, con un marcador que se mueve con cada cifra. Es muy visual para el 20 ($100 hundidos contra $60 recuperados). Pero exige leer números de los textos (con «2 horas × $50», «0 vendidas» o «Su hora» no funciona), no sirve para capítulos de tiempo o de cantidad, y agrega un código visual nuevo que hay que enseñar.

### Opción C: Lupa o inserto de detalle
Un recuadro en la banqueta con el acercamiento del objeto del que se habla (la lata con su $0, el letrero tachado en grande, el bote). Resolvería lo ilegible del letrero, pero solo repite el dibujo más grande: no suma la cuenta, y hay que decidir cuadro por cuadro qué va en el inserto (más escaleta, no menos).

### Por qué A
- Se alimenta sola de lo que ya existe (los eventos `cifra`), sin reescribir 60 escaletas.
- Quita del dibujo las pastillas que causan casi todos los encimados: «centro» y «pila».
- Le da a la cuenta un lugar fijo donde se ve **junta**.
- En el 29 la torre de pastillas de 14–19 s ya ES una libreta mal puesta («2 h × $50 = $100 / Su hora $50 / 0 vendidas»). Solo hay que ponerla donde no tape nada.

### Detalle de la opción A

**Qué la alimenta** (en ElPuesto.tsx, derivado de `pasados`, sin tocar la escaleta):
- Cada evento `cifra` con `donde ∈ {centro, pila}` **deja de pintarse como pastilla** y se vuelve **renglón de la libreta**. Las cifras en lata, basura, vecinos, chuy o camion se quedan como pastilla sobre su objeto, porque ahí señalar el objeto sí importa. Además **cada una de esas cifras también escribe su renglón**, con la etiqueta del lugar por delante:
  - `lata` → «En la lata: $0»
  - `basura` → «Tiradas: $0»
  - `vecinos` → «Cobrado: $60»
  - `chuy` → «Su hora: $50» (el texto ya trae etiqueta, así que se usa tal cual)

  Regla de la etiqueta: si `texto` es solo cifra (`/^[\d$.,\s·×=+-]+$/`), se antepone la etiqueta del lugar. Si ya trae palabras, va tal cual.
- **Un renglón por `donde`** (misma llave que hoy usa `cifras`, ElPuesto.tsx:167-168). Si llega otra cifra al mismo lugar con otro texto, el renglón **se tacha y se reescribe al lado**. Eso da gratis el «tachado» que hoy no existe en el vocabulario. En el 20, «Ya pagadas: $100» pasa a «~~Ya pagadas: $100~~ $100: ya se fue». Si el texto es igual (el `$0` que se re-emite en el 29), el renglón solo parpadea.
- `texto: ""` **no borra** el renglón (anotar es ver): lo pasa a gris al 45 %. El dibujo sí se limpia.
- Campo opcional nuevo en la escaleta, solo para quien lo quiera: `"renglon": "texto alterno"` o `"renglon": false`, que escaleta.py ya deja pasar sin cambios porque solo quita en/mas/hasta_en/hasta_mas (escaleta.py:56). Los 60 capítulos funcionan sin tocarlos.
- Aparece con el mismo `spring` de la pastilla, como si se escribiera: un trazo que se revela con `clipPath` de izquierda a derecha en 0.35 s, anclado al `t` del evento. Así sale **cuando la voz lo dice**.

**Dónde va** (unidades del SVG de ElPuesto, que es el mismo lienzo en 9:16 y 16:9):
- Rectángulo de papel en **x 130–870, y 850–995** (740×145 u ≈ 550×107 px), con una rotación de −1.5° para que se sienta nota y no interfaz.
- Hasta **3 renglones de 44 u** (Caveat 40 u ≈ 30 px; con la opción de subir la escala del SVG, 34–36 px). Con más de 3 renglones se enrollan hacia arriba y el más viejo sale por el borde.
- Si el capítulo trae `casa` (CASA x 64–236, y 758–946), la libreta se corre a **x 270–940** con 660 u de ancho.
- Arriba a la izquierda, un clip o lápiz y la palabra «CUENTA» en Manrope 800, 22 u, ámbar #F7B32B.

**Por qué no choca con los subtítulos:**
- `altoUtil` (marca.ts:76) garantiza que `lado ≤ banda_subtitulos.y − contenido.y`, así que **el borde inferior del SVG (y=1000) nunca pasa de 1150 px**, donde empieza la banda. Con la libreta dentro de y ≤ 995 hay 0 px de traslape en 9:16.
- En 16:9 la banda es una columna a la derecha, así que tampoco choca.
- Bonus opcional: alinear el subtítulo al **borde de arriba** de la banda (Subtitulos.tsx:108, `alignItems: "flex-start"` más ~20 px de margen) para que la lectura baje en línea recta: libreta → subtítulo.

**Qué pasa en la tarjeta CTA:**
- La libreta **no se oscurece**: se pinta DESPUÉS del velo negro al 82 % (ElPuesto.tsx:241), se sube a **y ≈ 560–760** y crece a escala 1.25. La pregunta queda arriba (y 300–470, **partida en 2 líneas**).
- La flecha ámbar y «GAIA PRIME» pasan debajo de la libreta (y 800–900).
- El cierre queda así: *pregunta → la cuenta que ya viste escrita → «escríbelo aquí abajo»*. La flecha deja de apuntar a una mesa apagada y apunta de la cuenta de Don Chuy a *tu* comentario. Eso refuerza la tesis: anota la tuya.
- Si la libreta está vacía (un capítulo sin cifras), la tarjeta queda como hoy, pero con la pregunta en 2 líneas.

---

## Arreglos ordenados por impacto/esfuerzo

| # | Qué | Dónde | Impacto | Esfuerzo |
|---|---|---|---|---|
| 1 | **Cortar el bloque del subtítulo en la puntuación final** (`.?!…:`) y en huecos de más de **0.45 s**, no solo de más de 1.5 s. Opcional: permitir hasta 4 palabras si así se completa la frase. Arregla los ~15 cuadros «desincronizados» de los dos capítulos y la «Y» sola en la pausa. Ojo: la regla de 1.5 s del quiz se queda, esto se suma. | `render/src/lib/Subtitulos.tsx:76-81`: `if (/[.?!…:]["'»]?$/.test(w.palabra)) { grupo.push(w); cerrar(); continue; }` | Alto | 5 líneas |
| 2 | **Partir en 2 líneas o autoajustar el CTA y la frase**: medir con ~0.55·fontSize por carácter y, si pasa de 900 u, partir en el espacio más cercano a la mitad (dos `<tspan>`). Hacer visible la banda de la frase (relleno #0B0E14 con borde ámbar al 40 %, o bajar el tamaño a 52). Hoy se cortan «¿V» y «¿L». | `ElPuesto.tsx:232-247` | Alto | 20 líneas |
| 3 | **Pintar los globos DESPUÉS de las pastillas** (o que un globo visible esconda la pastilla que cruza su caja). Es lo mínimo para que «Yo sí te compro» y «Ya vine, Don Chuy» se lean. | `ElPuesto.tsx:213-230`: mover el bloque de globos después del de cifras | Alto | 1 movimiento |
| 4 | **Libreta de Don Chuy** (opción A): las cifras centro y pila salen del dibujo y todas las cifras escriben su renglón. Esto solo elimina la torre de pastillas del 29, la pastilla sobre la cara en los dos capítulos y el choque centro/chuy. | `ElPuesto.tsx` (bloque nuevo después de `{vuelan}` y antes de los globos, más una rama en CTA) y `naranjas.tsx` (componente `Libreta`) | Muy alto | ~120 líneas |
| 5 | **Proteger la cara de Don Chuy**: si no se hace la #4, mover `anclaCifra("pila")` a **(250,470)**, a la izquierda de la cabeza, sobre la pila, y lejos del techo de la camioneta (y≥580). Además, un resolvedor simple: juntar los rectángulos de pastillas y globos visibles más la caja fija de la cara (470–610 × 380–520) y, si hay traslape, subir el más nuevo hasta que no choque. | `ElPuesto.tsx:89-101` y bloque de cifras | Alto | 30–40 líneas |
| 6 | **Colitas de los globos que apunten a quien habla**: pasar `colaX` al Globo (quien 0 → x del vecino 0 = 850; quien 1 → 945; chuy → 540) y dibujar la colita hacia ese punto, no al centro. Separar el globo 1 del 0 lo suficiente para que la colita no caiga dentro del otro. | `naranjas.tsx:171-181` y `ElPuesto.tsx:216` | Medio | 10 líneas |
| 7 | **Letrero legible**: con `antes`, letrero de 300 u, «antes» en 34 y el nuevo en **52**, raya roja más delgada (4) y un poco transparente. | `naranjas.tsx:254-270` | Medio | 5 líneas |
| 8 | **Portero en escaleta.py** que avise, sin bloquear: (a) globos de más de 4 s o de menos de 1.5 s («Ya vine, Don Chuy» = 0.84 s); (b) texto de `cta` o `frase` de más de 28 caracteres por línea; (c) `cifra` con el mismo texto que las palabras que se dicen en ±1 s («A su hora de siempre»). | `pipeline/escaleta.py` después del bucle de eventos (línea ~67) | Medio | 25 líneas |
| 9 | **Anclas en la palabra de la cifra, no en la muletilla**: en el 20, «sesenta» en vez de «le dejaron sesenta» y «volaron» en vez de «y volaron». Son 2 ediciones de escaleta. Como patrón para el salón: el `en` empieza en la palabra que se ve. | `projects/economia/negocio/20-*/escaleta.json` | Bajo | 2 líneas |
| 10 | **Señal de «otro camino»** en el 20 a los 13.4 s: cuando las 3 naranjas regresan, que la libreta escriba «Si las tiraba…» (o una pastilla corta) para que no se lea como si las ventas se deshicieran. | escaleta del 20 (una `cifra` más, o un renglón con la opción A) | Bajo | 1 línea |

Mi recomendación es hacer primero **1 + 2 + 3** (media hora, sin cambiar el diseño: quitan los cortes, el CTA mutilado y los globos tapados) y volver a renderizar el 29 para compararlo. Después va la **#4 (libreta)**, que absorbe la #5 y le da uso a los ~400 px muertos.
