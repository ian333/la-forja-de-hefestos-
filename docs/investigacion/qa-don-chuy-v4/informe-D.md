# Informe D: QA visual de Don Chuy, caps. 36 y 41

Revisé las 6 hojas de cada capítulo, cuadro por cuadro. Donde la hoja no alcanzaba, bajé de iangpu `out/short.mp4` y `storyboard.json` (copias en `qa/mp4/`) y saqué cuadros exactos en 4K (`qa/zoom/m41-*.png`, `qa/zoom/f36-sub.png`).

**Aviso sobre las hojas:** las hojas van unos 0.2 s atrás de su etiqueta. El cuadro marcado «t=0.5» enseña lo que el mp4 muestra en t≈0.75. Lo comprobé con los cuadros 15, 18, 21 y 24 del mp4 del 36: el karaoke cae **exacto** sobre words.json. Por eso los tiempos de este informe salen de words.json y del storyboard resuelto, no de la etiqueta de la hoja.

**Audio contra words.json:** con `silencedetect` sobre el mp4, la voz arranca entre 0.00 y 0.23 s después de lo que dice words.json (en promedio unos 0.08 s). No es eso lo que ian llama «desincronizado». Lo que sí se nota es la agrupación de los subtítulos (ver P1).

Geometría (para ubicar causas): el lienzo SVG de 1000×1000 se pinta a 840 px. En el cuadro de 1080×1920 queda así: **x_cuadro = 120 + 0.84·x**, **y_cuadro = 220 + 0.84·y**. La caja segura va de x 60 a 900. La banda de subtítulos va de y 1150 a 1400. Los subtítulos miden 76 px y las pastillas 46 u ≈ **39 px**, o sea la mitad. El globo (Caveat 40·1.05) mide ≈ **35 px**.

---

## Defectos (por capítulo)

### 36-cuatro-dias-de-colchon

| t (s) | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.00–0.9 | coherencia / gancho | El cuadro 0 real no trae «$500 al día»: la camioneta entra deslizándose de 0 a 0.9 s y la pastilla viaja con ella fuera de cuadro (en la hoja 0.0 solo asoma un pedacito negro a la izquierda). Globo y «$2,000» nacen con opacidad 0 y tardan 0.18 s en aparecer. La escaleta promete «la paradoja entera en el cuadro 0». | `ElPuesto.tsx`: `camionX` interpola `[cam.t, cam.t+0.9]` aunque `cam.t = 0`, y `dura()`/`aparece()` suben desde 0 también en eventos con t=0 | 2 |
| 0.70–2.18 | sincronía | Bloque «Don Chuy? **Tenía**»: «Tenía» está en pantalla **1.02 s** antes de que la voz la diga (después de la pausa). | `lib/Subtitulos.tsx` l.65-84: bloques de 3 palabras que solo se parten con huecos > 1.5 s, nunca en puntuación | 3 |
| 6.12–7.64 | sincronía | «abrir. **Mira la**»: «Mira» sale **1.06 s** antes, en plena pausa. | ídem | 3 |
| 7.64–9.18 | sincronía | «lata: **llovió y**»: «llovió» sale 0.70 s antes. | ídem | 2 |
| 14.34–15.64 | sincronía | «otra más. **Fíjate**»: «Fíjate» sale 1.04 s antes. | ídem | 3 |
| 21.26–23.9 | sincronía | «abierto. **No le**» (0.98 s antes) y «guardar: **le**» (1.16 s antes). | ídem | 3 |
| 25.66–27.3 | sincronía | «pesos. **Y tú,**»: «Y» sale 1.14 s antes. | ídem | 2 |
| 0–8.34 | legibilidad / encimado | El globo «Tengo mi guardadito» se lee chico (~35 px, Caveat) y su colita apunta a la punta de la pila, no a la boca de Don Chuy: el globo está en x=400 y él en x=540. Parece que habla la pila. | `ElPuesto.tsx` globos: `quien==="chuy" → {x:400,y:300}` | 2 |
| 0.9–19.58 | encimado (leve) | «$500 al día» (358 u de ancho) roza la naranja de abajo a la izquierda de la pila. | `anclaCifra("camion") = camionX+150`, y el ancho de la pastilla no tiene tope | 1 |
| 11.5–12.3 | encimado | Los 5 billetes lata→camioneta pasan **sobre la cara de Don Chuy** y por debajo de la pastilla «$2,000»: las pastillas se pintan encima de lo que vuela. | `arco(..., 180)`: el pico queda en y≈356 y la cara está en y≈452, así que la trayectoria la cruza | 1 |
| 12.24→14.98 | sincronía OK | Lata $2,000→$1,500→$1,000→$500→$0 y «Día 1…4» caen a ±0.3 s de «una mañana / otra mañana / otra más». Bien. | — | — |
| 16.58–19.58 | legibilidad | En «$2,000 ÷ $500 al día» el «÷» mide 39 px y en miniatura se lee como «+»: «2,000 + 500» es otra cuenta. | Pastilla `fontSize 46`; el glifo ÷ de Manrope es delgado | 2 |
| 16.58–26.8 | espacio | La cuenta del capítulo («Tenía: $2,000» → «÷» → «4 días») vive en **una** pastilla de 39 px en y≈430 del cuadro, encima de los edificios. Mientras tanto la banqueta (y 910–1150) está vacía. | diseño: `centro` en (500,250) | 2 |
| 23.72–26.80 | **encimado / legibilidad** | **LA FRASE (el pico) se sale del cuadro por los dos lados**: se lee «lado no se cuenta en pesos: se cuenta en d». Son 52 caracteres a 62 u (≈1,700 u de ancho) dentro de una caja de 820. Durante 3 s el remate del capítulo es ilegible. | `ElPuesto.tsx` bloque `frase`: `rect width 820` y `fontSize 62` fijos, sin partir renglón | **3** |
| 26.80–32.6 | coherencia | En el CTA, la pregunta «¿Cuántos días aguantas?» pide un número, pero el pie dice «**Sí o no** · escríbelo aquí abajo». Además la voz dice otra frase: «¿cuántos días te dura lo guardado?». | `escaleta.json` del 36, evento `cta` | 2 |
| 26.80–32.6 | legibilidad / encimado | El pie del CTA mide 46 u (~39 px) en gris #9AA6BF: lo más chico del video. Por el velo de 0.82 se transparentan «4 días» y «$0» detrás del texto, y la flecha cae sobre la mesa fantasma. | `ElPuesto.tsx` cta: velo `opacity 0.82`; cifras y globos se siguen pintando debajo | 2 |
| 8.3–22.6 | coherencia (leve) | La camioneta «cobra el surtido» cada mañana, pero la pila nunca cambia y no llega nada. Quien se fije pregunta «¿y qué le surtieron?». | escaleta (decisión de guion) | 1 |

### 41-las-diez-podridas-de-siempre

| t (s) | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.00 | coherencia / gancho | Saqué el cuadro 0 real del mp4 (`zoom/m41-quad.png`, arriba a la izquierda): **solo la pila, Don Chuy y los vecinos**. No están la camioneta, el letrero, el bote, las tres pastillas ni el globo. La «cuenta entera en el cuadro 0» no existe en el cuadro 0 (ni en la miniatura). | igual que en el 36: fundido desde 0 en eventos con t=0 y camioneta deslizándose | 2 |
| 0.0–5.82 | **encimado** | El globo «Otra vez las de abajo» queda pegado encima de la pastilla «100 naranjas»: **la colita del globo se clava en la pastilla**, y la pastilla **tapa la gorra de Don Chuy**. | Posiciones fijas que chocan: el globo `chuy` (400,300) ocupa y≈256–362 y la pastilla `pila` (420,390) ocupa y≈350–428, x≈227–613. La gorra está en y 384–440, x 478–636 | **3** |
| 0.0–26.0 | **encimado / caja segura** | La pastilla del bote («10 podridas al día» → «10 podridas» → «−$50 al día» → «$0 al bote») **tapa el letrero «$10 c/u» y los torsos de los vecinos todo el capítulo**. La versión grande (4.58–6.0) se estira hasta x≈1000 del cuadro, **dentro de la columna de botones de TikTok** (la caja segura acaba en 900). | `anclaCifra("basura") = (770,672)`, a la misma altura que el letrero (y 672–738, x 448–598). `Pastilla` ancho = `len·28+50` sin tope: 18 caracteres = 554 u | **3** |
| 0.70–2.16 | sincronía | «Don Chuy? **No**»: «No» sale **1.18 s** antes. | `Subtitulos.tsx` (ver 36) | 3 |
| 4.38–6.08 | sincronía | «las podridas. **Mira**»: sale **1.44 s** antes. Es el peor del par. | ídem | 3 |
| 6.08–7.08 | sincronía | «el bote: **ahí**»: 0.82 s antes. | ídem | 2 |
| 17.02–18.52 | sincronía | «del año. **Al**»: 1.32 s antes, y además huérfana. | ídem | 3 |
| 25.06–26.22 | sincronía | «lo cuidan. **Y**»: 0.96 s antes. | ídem | 2 |
| 0.0–5.82 | encimado (leve) | «$5 cada una» roza la pila. | anclaje `camion` | 1 |
| 7.54–17.02 | encimado | «90 buenas» tapa la gorra y la frente de Don Chuy. Con «10 × $5 = $50» (8.98–11.34) y «Al mes: $1,500» (11.98–14.04) quedan **dos o tres pastillas en columna sobre su cabeza**. | `pila` (420,390) y `centro` (500,250) apiladas | 2 |
| 15.62–17.02 | encimado | El globo «Todo el año» vuelve a encimarse sobre «90 buenas»: mismo choque globo contra pila. | ídem al de 0–5.8 | 2 |
| 16.54–17.02 | sincronía / legibilidad | «Va» (la respuesta del proveedor) dura **0.48 s**, en una pastilla chica sobre la camioneta. No da tiempo de leerla y no se entiende como diálogo: parece otra etiqueta de precio. | `hasta_en: "del año"` queda a 0.48 s del inicio | 2 |
| 17.32–18.34 | coherencia | La camioneta ya se fue y el globo «Todo el año» sigue 1 s en pantalla, hablándole a nadie. «−$50 al día» también sigue. | `hasta_en: "Al día siguiente"` | 1 |
| 18.34 | coherencia | La pila pasa de 13 naranjas a 0 de golpe sin que nadie compre: parece que desaparecen. | `pila n=0` como corte de día sin transición | 1 |
| 20.12–25.06 | encimado / saturación | «Al mes: +$1,500», «Una vez: lo de abajo», «$0 al bote» y el letrero salen al mismo tiempo. La franja del 30 % del cuadro trae 4 etiquetas mientras abajo hay 40 % vacío. | diseño | 2 |
| 21.76–26.0 | **encimado / caja segura** | «Una vez: lo de abajo» y «Todo el año: lo bueno» (20–21 caracteres, 610 u) **arrancan en x≈6 px del cuadro**, fuera de la caja segura de 60, y **tapan las tres filas de arriba de la pila**. Justo «lo de arriba / lo bueno» que se está nombrando queda oculto. | `camion` ancla en `camionX+150 = 170`, así que la caja va de −135 a 475 u. Sin tope ni recorte | **3** |
| 25.06–26.02 | sincronía / encimado | La FRASE «Al que vuelve mañana no le fallan.» dura **0.96 s** antes de que el CTA la tape. El texto (≈ x 50–905 del cuadro) se sale de su caja oscura (≈ 140–820). | `frase` sin partir renglón; `!cta` la apaga | 2 |
| 26.02–33.4 | **encimado / caja segura** | **El CTA no cabe**: de «¿Le comprarías todo el año a tu proveedor?» se pierde el «¿Le» en el borde izquierdo y el «?» toca el derecho, durante todo el cierre. | `cta` `fontSize 66` de una línea: 42 caracteres ≈ 1,450 u, más ancho que el cuadro | **3** |
| 26.02–33.4 | **legibilidad (experimento)** | El pie «Mándaselo al que aguanta las podridas callado» es **la variable del experimento `cta_envio`** y va a ~39 px en gris, montado sobre el fantasma de «Todo el año: lo bueno» (se ven las dos capas de texto cruzadas). La flecha cae sobre el fantasma de «$10 c/u». Así, el grupo B del experimento se mide con el texto casi invisible. | `pie` con `fontSize 46` y `#9AA6BF`; velo de 0.82 con las cifras vivas debajo | **3** |
| 26.02–33.4 | coherencia | El texto del CTA no coincide con la voz («¿le dirías a tu proveedor que le compras todo el año?») y tampoco ofrece «sí o no». | escaleta | 1 |
| 0–26 | coherencia | El letrero «$10 c/u» es una segunda cifra que la cuenta no usa (la cuenta es 10 × $5) y casi siempre está tapado. Solo estorba. | escaleta: `letrero` en t=0 | 1 |

---

## Patrones (lo que se repite en los dos capítulos)

1. **P1: «desincronizado» = subtítulos que se adelantan en la pausa.** El karaoke está bien cronometrado; lo que falla son los **bloques de 3 palabras que cruzan un punto**. La primera palabra de la oración siguiente queda en pantalla de 0.7 a 1.44 s antes de oírse: 7 veces en el 36 y 6 en el 41. En cada pausa dramática (justo antes de «Mira», «Fíjate», «Y tú») el texto ya dice lo que viene. `Subtitulos.tsx` solo parte un bloque con huecos > 1.5 s, y las pausas de Matilda duran 0.3–0.9 s.
2. **P2: «encimado» = cuatro anclas fijas en 300×200 u sobre la cabeza de Don Chuy.** Son `globo chuy` (400,300), `pila` (420,390), `chuy` (540,320) y `centro` (500,250). Cualquier capítulo que use dos a la vez choca. La de `pila` tapa su gorra por diseño. Además la ancla de `basura` (770,672) está a la altura del letrero, así que letrero y pastilla del bote nunca conviven.
3. **P3: ningún texto tiene ancho máximo.** `Pastilla` (`len·28+50`), `frase` (caja de 820 con texto de una línea) y `cta` (una línea a 66 u) crecen sin límite: se salen de su caja, del cuadro o de la caja segura. El QC lo declara resuelto sin medirlo: `escaleta.py` escribe `"todo_dentro_de_safe_area": true` fijo, y `verificar.py` solo revisa `vecinos` y `lata`, más los globos ≤ 22 caracteres.
4. **P4: el cuadro 0 no es el cuadro prometido.** Todo lo que tiene `t:0` arranca en opacidad 0 y la camioneta llega en 0.9 s. Afecta la miniatura y los primeros 300 ms, justo donde el canon de retención pone el gancho.
5. **P5: el cierre es lo más chico y lo más sucio.** Frase y CTA se cortan, el pie (la llamada al comentario o al envío) es el texto más pequeño del video y el velo deja ver las pastillas debajo.
6. **P6: el espacio está mal repartido.** Medido en el cuadro de 1080×1920:
   - 0–330 px (17 %): cielo vacío. De 0 a 220 lo tapa la interfaz de todos modos.
   - **330–910 px (30 %): ahí vive TODO**, dibujo más 3 a 5 etiquetas.
   - **910–1150 px (12.5 %): banqueta vacía los 33 s completos** del video.
   - 1150–1400 px: banda de subtítulos. El texto (una línea de 3 palabras) ocupa ~90 px de 250.
   - 1400–1920 px (27 %): vacío. De 1440 para abajo es zona de caption/usuario de TikTok.

   **Cerca del 57 % del cuadro es fondo oscuro, y el 30 % útil va saturado.**

---

## Propuesta del espacio (auxiliar visual: «no pizarrón, pero sí»)

**Opción A: LA LIBRETA DE DON CHUY (elegida).** Una hojita de libreta de papel, con renglones azules y margen rojo, en la banqueta bajo el puesto. Va escribiendo a mano (Caveat) **los renglones de la cuenta en el momento en que la voz los dice**, y guarda los últimos tres. Es la tesis «anotar es ver» hecha objeto, y conecta directo con GAIA PRIME (la libreta digital) en el cierre.

**Opción B: la recta de la cuenta.** Una barra horizontal bajo el puesto con la única cantidad del capítulo: en el 36, 4 bloques de $500 que se van apagando «Día 1…4»; en el 41, 100 naranjas con un tramo rojo de 10. Es muy clara, pero pide datos por capítulo (un evento `recta` nuevo en 60 escaletas) y no todos los capítulos son una cantidad que baja.

**Opción C: el marcador.** Una fila fija de casillas bajo el puesto, una por lugar (Camioneta | Pila | Lata | Bote), unidas con una línea fina a su dibujo. Todas las pastillas de lugar se mudan ahí. Acaba con los encimados de raíz y se deriva sola de `donde`, pero es contabilidad pura, sin la cuenta que «se arma», y le quita a la escena el «se ve dónde está el dinero».

### La elegida (A), en detalle

**Qué la alimenta (derivación automática, sin reescribir escaletas).** Se deriva en `ElPuesto.tsx` a partir de `pasados`:
- Toda `cifra` con `donde:"centro"` y texto no vacío se convierte en **renglón**. En estos capítulos eso cubre «Día 1…4», «Tenía: $2,000», «$2,000 ÷ $500 al día», «4 días», «10 × $5 = $50», «Al mes: $1,500» y «Al mes: +$1,500».
- Toda `cifra` de **lugar** con más de 12 caracteres, o que contenga `× ÷ = :`, también se va a la libreta y **deja de dibujarse como pastilla**. Esa regla sola quita los tres choques de severidad 3 del 41: «10 podridas al día», «Una vez: lo de abajo» y «Todo el año: lo bueno». Las cortas («$2,000», «$0», «10 podridas», «−$50 al día», «$0 al bote», «90 buenas») se quedan sobre su lugar.
- **Misma familia, mismo renglón.** Si el renglón nuevo empieza con la misma palabra que el anterior («Día 1» → «Día 2», «Al mes: $1,500» → «Al mes: +$1,500»), se tacha el viejo y se escribe el nuevo encima. En el 41 queda precioso: el −$1,500 tachado se convierte en +$1,500.
- **Mismo texto repetido** (el «grande» del 41 a 4.58) no duplica el renglón: solo lo subraya.
- `texto:""` en `centro` no borra nada. La libreta es acumulativa: lo anotado se queda.
- `frase` se escribe como **renglón final a todo lo ancho, en dos líneas si pasa de 26 caracteres** (corta en «:» o en el espacio más cercano a la mitad), con fondo de resaltador. Así se jubila la banda de arriba que hoy se sale del cuadro.

Así queda el 36 al final: «Tenía: $2,000 / $2,000 ÷ $500 al día / **= 4 días**» con doble subrayado rojo, y luego la frase. El 41 queda: «10 × $5 = $50 / ~~Al mes: −$1,500~~ Al mes: +$1,500 / Todo el año: lo bueno», y luego la frase.

**Dónde va (coordenadas del lienzo SVG de ElPuesto):**
- Hoja: `x 80…920, y 850…1085`, que en el cuadro es x 187–893 y **y 934–1131**. Queda dentro de la caja segura (≤ 900) y **19 px arriba de la banda de subtítulos** (1150). La primera línea de subtítulo cae en y≈1240, así que visualmente hay ~110 px de aire.
- Tres renglones con base en y = 915, 980 y 1045. Caveat 58 u (≈ 49 px en el cuadro, un 25 % más grande que hoy las pastillas). Margen rojo en x=140 y texto desde x=160.
- Papel `#E9E1C8` (crema apagado para no deslumbrar de noche), renglones `#9DB4D6`, tinta `#2B3A67` (la misma del globo). Por color: `error` → `#C8323F`, `exito` → `#1E8F5E`, `aviso` → `#B7791F` (versiones oscuras, legibles sobre papel). `grande` lleva doble subrayado y un tamaño de 66.
- Se pinta **después** de `Lluvia` y de la `vineta`, así la lluvia y la sombra de las orillas no la ensucian.

**Animación (pura en T, como el resto de la escena):**
- Cada renglón se revela de izquierda a derecha con un `clipPath` cuyo ancho es `interpolate(T, [r.t, r.t+0.4], [0, ancho])`, como escritura a mano.
- Al entrar el cuarto renglón, los anteriores suben 65 u en 0.25 s y el primero se desvanece. Nunca hay más de 3.
- El tachado de familia se dibuja en 0.2 s y el texto nuevo se escribe 0.1 s después.
- El renglón nace en el `t` del evento, que ya está anclado a la palabra (por ejemplo «cincuenta pesos» → 8.98). La libreta escribe **cuando la voz lo dice**.

**Cómo evita a los subtítulos:** los subtítulos son un overlay DOM con la banda fija en 1150–1400 (`tokens.safe_areas`), y el borde inferior de la libreta queda clavado en 1131 (y SVG ≤ 1085). Nunca se tocan. Sirve pedirle a `escaleta.py` o `verificar.py` que confirme `220 + 0.84·1085 < banda_subtitulos.y` para que un cambio de tokens no la rompa.

**En la tarjeta CTA:**
- La libreta se pinta **encima del velo** oscuro (el velo 0.82 tapa la escena, no la libreta). La cuenta final sigue iluminada: es contra lo que el espectador compara su respuesta.
- Aparece un renglón nuevo, «**Tú: ______**» con cursor que parpadea. Sale de un campo opcional `cta.renglon`, y si no viene, default «Tú: ______». El comentario es el renglón del espectador en la libreta de Don Chuy.
- La pregunta sube a `y 300–430`, partida en 2 líneas de ≤ 24 caracteres a 70 u. El pie baja a `y 540` a 54 u. Cuando es la variante de envío («Mándaselo al que…») va en ámbar `#F7B32B`, porque es la variable del experimento.
- La flecha va de y 600 a 790 apuntando al «Tú:» y «GAIA PRIME» sube de y 900 a **y 820**, arriba de la libreta, para que no la pise.
- Las pastillas y los globos **no se pintan** mientras hay `cta`. Se acaban los fantasmas.

---

## Arreglos ordenados por impacto / esfuerzo

| # | qué | dónde | impacto | esfuerzo |
|---|---|---|---|---|
| 1 | **Partir el bloque de subtítulos en puntuación y en huecos cortos.** En el loop de `bloques`, antes del `push`, cerrar si `anterior.palabra` termina en `. ? ! : ; …` o si `w.inicio - anterior.fin > 0.35`. Opcional: pegar un monosílabo huérfano («Y», «Al») al bloque siguiente. Arregla los 13 adelantos de 0.7–1.44 s. Ojo: `Subtitulos.tsx` es del motor y lo usan todas las series, así que conviene hacerlo por flag del storyboard (p. ej. `subtitulos.cortar_en_puntuacion: true` que `escaleta.py` prenda para ElPuesto). | `render/src/lib/Subtitulos.tsx` l.76-81, `pipeline/escaleta.py` l.90 | **muy alto** | XS |
| 2 | **Frase y CTA que caben.** Partir en 2 `<tspan>` (en «:» o en el espacio más cercano a la mitad) y `fontSize = min(base, 900/(chars_de_la_línea·0.55))`. La caja de la frase crece a 2 líneas. Pie a 54 u, en ámbar si es la variante de envío. No pintar cifras ni globos cuando hay `cta` (o velo de 0.95). | `ElPuesto.tsx` bloques `frase` y `cta` | **muy alto** (el pico y el experimento) | S |
| 3 | **Cuadro 0 completo.** En `dura()` y `aparece()`, `if (e.t <= 0) return 1` en la subida. Si `cam.t <= 0`, la camioneta aparece ya estacionada (`camionX = 20`). | `ElPuesto.tsx` (camionX, `aparece`, `dura`) | alto (miniatura y gancho) | XS |
| 4 | **Tope de ancho y recorte de pastillas:** `ancho ≤ 360 u` (si no cabe, baja el `fontSize`), y `x` acotado para que la caja quede entre −71 y 929 u (caja segura). En `verificar.py`: `cifra` de lugar > 12 caracteres = falla, frase > 2×26 = falla, cta > 2×24 = falla. En `escaleta.py`: dejar de escribir `todo_dentro_de_safe_area: true` a ciegas (medir con las mismas fórmulas o quitar la clave). | `naranjas.tsx` `Pastilla` l.184-194; `projects/economia/_salon/verificar.py` l.53-58; `pipeline/escaleta.py` l.93 | alto | S |
| 5 | **Reubicar las anclas que chocan:** `globo chuy` a (650,262) con la colita corrida a la izquierda, hacia la cara (540,452). `pila` a (400,345), arriba de la gorra (y ≥ 384). Con la libreta, `centro` deja de pintarse. Con eso dejan de chocar globo, pila y gorra en el 41 (0–5.8 y 15.6–17). | `ElPuesto.tsx` `anclaCifra` y el mapa de `globos`; `naranjas.tsx` `Globo` (prop `colaX`) | alto | S |
| 6 | **La libreta** (propuesta A): componente `Libreta` en `naranjas.tsx` (~50 líneas) más derivación de renglones en `ElPuesto.tsx` (~40 líneas: `esCuenta(e)`, familias, scroll, `clipPath`). Las cifras que van a la libreta se excluyen del mapa `cifras`. Plantilla: documentar la regla en `docs/plantillas/ElPuesto.md`. | `ElPuesto.tsx`, `naranjas.tsx`, `ElPuesto.md` | **muy alto** (lo que pidió ian + quita los sev-3 del 41 sin tocar escaletas) | M |
| 7 | **Resolver de choques genérico** (red de seguridad): antes de pintar, calcular cajas de pastillas y globos activos (anchos por las mismas fórmulas) y empujar hacia arriba la de menor prioridad hasta que no se toquen. Pintar globos después de las pastillas. | `ElPuesto.tsx` | medio | M |
| 8 | **Duración mínima legible:** `cifra` o `globo` con `hasta − t < 1.0 s` se alarga a 1.0 s («Va» del 41 dura 0.48 s). `globo` que se queda cuando su hablante ya se fue (camioneta) se corta en `se_va`. | `pipeline/escaleta.py` (al resolver `hasta`) | medio | XS |
| 9 | **Contenido de escaletas** (solo estas dos): 36, pie del CTA sin «Sí o no» (p. ej. «Escribe tus días aquí abajo») y pregunta igual a la voz. 41, quitar `letrero $10 c/u` (segunda cifra que no se usa) y alargar la frase o mover el CTA para que el pico dure ≥ 2 s. | `projects/economia/negocio/36-…/escaleta.json`, `41-…/escaleta.json` | medio | XS |
| 10 | Billetes lata→camioneta: subir `alto` del arco a ~300 cuando `a==="camion"` para que no crucen la cara, o pintarlos detrás de Don Chuy. | `ElPuesto.tsx` rama `billetes` | bajo | XS |

**Orden sugerido para una sola pasada de render:** primero 1+3+2 (XS/S: quitan el «desincronizado» y los cortes del cierre), luego 6+5 (la libreta y las anclas: quitan el «encimado» y usan el espacio), después 4 y 8 en el portero para que no regrese. Al final, volver a renderizar el 41 y revisar los cuadros 0, 1.0, 5.2, 16.7, 22.6, 25.4 y 28 contra este informe.
