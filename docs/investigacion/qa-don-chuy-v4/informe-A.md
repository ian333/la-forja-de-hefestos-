# Informe A — QA visual de Don Chuy (12-el-fiado-b y 38-si-sale-agria-te-la-cambio)

Revisé las 12 hojas, cuadro por cuadro. Para ver bien el texto chico recorté y amplié 2× cada cuadro (`qa/<cap>/zoom-0N.png`). También leí `ElPuesto.tsx`, `naranjas.tsx`, `Subtitulos.tsx`, `brand/tokens.json` (cajas seguras) y `pipeline/escaleta.py`. No edité nada del repo.

**Aviso antes de leer las tablas: los renders son de antes del commit `b0db081` (hoy, 15:15).** Ese commit subió los globos de los vecinos: el 0 pasó de (770,460) a (790,390) y el 1 de (840,350) a (860,290). En las hojas los globos siguen a la altura de la pastilla de la lata, o sea que el video se hizo con el código anterior. Cada defecto trae una marca: **[sigue]** si con el código actual todavía pasaría, o **[b0db081]** si ese commit ya lo corrige. Casi todo lo demás **sigue**.

**Escala para leer las coordenadas.** Pantalla de 1080×1920. El SVG de 1000×1000 unidades se pinta en 840×840 px, con la esquina en (60, 220); 1 unidad = 0.84 px. La banda de subtítulos va de y=1150 a y=1400 px, con letra de 76 px.

**Desfase constante de unos 0.2 s en las hojas.** En casi todos los cuadros, lo que se ve (la palabra encendida, los globos, las cifras) corresponde a t+0.2 s de `words.json`. Algunos ejemplos: en t=5.0 ya se enciende «peso.», que empieza en 5.20; en t=1.0 no se enciende «Chuy?», que termina en 1.12; en t=7.0 no se enciende «lata:», que termina en 7.02. Como el desfase es parejo en todo lo que se pinta, **lo más probable es que venga de cómo se extrajeron los cuadros para la hoja** (el filtro fps de ffmpeg) y no del render. No lo cuento como defecto. Para confirmarlo, extrae un cuadro del mp4 con `-ss 5.0` exacto y revisa si «peso.» ya está encendida. La desincronía REAL es otra y está abajo: bloques de subtítulo que cruzan de una oración a otra.

---

## Defectos (por capítulo)

### 12-el-fiado-b

| t | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.0–1.5 | encimado | La pastilla «100 naranjas» tapa la gorra y la frente de Don Chuy. | Ancla `pila` = (420,390) en ElPuesto.tsx:93. La pastilla ocupa x 227–613, y 350–428, y la cabeza está en x 480–600, y 384–512. **[sigue]** | 2 |
| 0.0–4.8 | encimado / quién habla | El globo «¡Mañana te pago!» (vecino 0) queda pegado a la cara de Don Chuy, y su colita apunta a la lata, no al vecino. Parece que lo dice Don Chuy. | Globo 0 en (770,460), con la colita fija al centro (naranjas.tsx:177). **[b0db081 lo sube a y=390, pero la colita sigue sin apuntar al vecino]** | 2 |
| 1.0–4.8 | encimado / legibilidad | Dos globos idénticos «¡Mañana te pago!», uno encima del otro y casi tocándose. Se lee como un error de duplicado, no como dos vecinos. | Escaleta: el mismo texto en `quien` 0 y 1. Con b0db081 quedan en y 390/290, con 100 unidades entre centros. | 2 |
| 0.2–1.9 | coherencia | La pastilla dice «100 naranjas» mientras la pila ya se vació a unas 8 (salen 7 en t=0.2). | Escaleta: `salen` en 0.2 y la cifra `pila` sigue hasta «Vendió todas». | 1 |
| 1.0–1.9 | sincronía | Se lee «Don Chuy? Vendió»: «Vendió» sale 1.2 s antes de que la voz lo diga, pegado a la pregunta del gancho. | Subtitulos.tsx:76–81: el bloque de 3 palabras solo se corta en huecos >1.5 s, nunca en el punto. **[sigue]** | 2 |
| 5.0–17.5 | encimado | Las pastillas de la lata («$0», «$500», «$0» grande) pisan la visera de la gorra. | Ancla `lata` = (690,482) en ElPuesto.tsx:91. La visera llega a x=636, y=438–452, y la «grande» llega a escala 1.25 y más con el rebote del spring. **[sigue]** | 1 |
| 6.2–7.0 | coherencia | La voz dice «Mira la lata:» y en la lata no hay nada que ver: la cifra se borró justo en esa ancla. | Escaleta: `cifra lata ""` en «Mira la lata». | 2 |
| 7.5–8.5 | coherencia | «La mitad de sus naranjas se fue fiada»: no hay nada que marque la mitad ni que distinga fiadas de pagadas. Salen 8 naranjas sin billete y no se nota. | Falta un lugar donde se anote la cuenta (ver la propuesta). | 2 |
| 8.5–10.3 | sincronía | «fue fiada. Cobró»: «Cobró» sale 1.2 s antes. | Subtitulos.tsx:76–81 **[sigue]** | 2 |
| 10.0 | encimado | Los billetes que van de los vecinos a la lata tapan las caras de los vecinos. El «$100» no se lee (20 px). | Salen de `lugar("vecinos")` = (850/945, 650), a la altura de la cara. | 1 |
| 11.8–12.2 | sincronía | El bloque «en la tarde» no aparece en ningún cuadro: se muestra menos de 0.5 s. | Bloques de 3 con palabras cortas. | 1 |
| 15.0–15.5 | encimado | Los billetes que van de la lata a la camioneta pasan por encima de la cara de Don Chuy y de la pastilla «$500». | `arco(..., 180)` con el vértice en y≈356, justo a la altura de su cabeza (ElPuesto.tsx:156). **[sigue]** | 1 |
| 16.0–21.5 | coherencia | La camioneta sigue diciendo «Cobra $500» después de haberse llevado los 5 billetes, con la lata en $0. Parece que todavía debe. | Escaleta: `hasta_en: "Vendió exactamente"`. Tendría que cambiar a «Cobró $500» o quitarse. | 2 |
| 17.0–18.4 | sincronía (sentido) | «último billete. Si»: el «Si» del condicional sale 1.5 s antes y queda huérfano. Luego el bloque siguiente, «le pagaban todas,», se lee como si fuera un hecho. | Subtitulos.tsx:76–81 **[sigue]** | 3 |
| 19.5 | sincronía | «le quedaban / quinientos.» se parte en 2 líneas y la banda brinca hacia arriba (cambia la línea base). | `textWrap: balance` con un bloque largo. | 1 |
| 18.5–24.1 | legibilidad | «Si le pagan todas: le quedan $500» es una oración entera en una pastilla de 974 unidades, a 39 px. Es la mitad del tamaño del subtítulo y queda compitiendo con él. | Pastilla `centro` usada como pizarrón. | 2 |
| 24.2 | coherencia | La comparación «le quedarían $500» desaparece justo cuando entra «Fiado: $500». Las dos cifras que forman la tesis nunca se ven juntas. | El `centro` guarda una sola cifra: la nueva reemplaza a la anterior. | 2 |
| 25.0–26.7 | sincronía (sentido) | «calle, fiado. No»: el «No» del remate sale 1.5 s antes y solo se enciende 0.26 s. Después «le faltaron ventas:» se lee SIN el «No», o sea al revés de lo que se quiere decir. | Subtitulos.tsx:76–81 **[sigue]** | 3 |
| 29.0–35.1 | encimado / legibilidad | En la tarjeta CTA se sigue viendo detrás el fantasma de «Fiado: $500», la mesa y los vecinos (la capa oscura es de 0.82). La flecha rebota encima de la mesa fantasma. La pregunta mide 55 px y el pie 39 px: los dos más chicos que el subtítulo de 76. | ElPuesto.tsx:239–248. | 2 |
| 29.0–35.1 | dos frases a la vez | La tarjeta dice «¿Cuánto tienes fiado? / Escríbelo aquí abajo» y el subtítulo repite lo mismo con otras palabras justo debajo. Son dos textos de la misma pregunta, a 2 tamaños. | Tarjeta CTA y karaoke al mismo tiempo. | 1 |

### 38-si-sale-agria-te-la-cambio

| t | categoría | qué se ve | causa probable | sev |
|---|---|---|---|---|
| 0.0–6.7 | encimado (el gancho) | La pastilla «$300» (lata, grande) tapa la mitad izquierda del globo «Salió agria». Durante los primeros 6.7 s solo se lee «…gria». | Globo 0 en (770,460) debajo de la pastilla de (690,482). **[b0db081]**. OJO: con el código nuevo la colita del globo (x≈790, y 426–455) todavía roza la esquina de la «$300» grande (x 589–791, y≥432, más con el rebote del spring). | 3 |
| 2.3–6.7 | encimado | El globo de Don Chuy, «Te la cambio», queda debajo de la pastilla «Si sale agria, te la cambio»: solo se ve la mitad de abajo del globo y el texto sale cortado. | Globo `chuy` en (400,300): rect y 254–338, x 243–557. Pastilla `centro` en (500,250): y 210–288, x 97–903. **[sigue]** | 3 |
| 0.0–6.7 | saturación | En el cuadro 0 conviven 4 textos: la pastilla del centro, «$300», el globo del vecino (tapado) y el de Don Chuy (tapado), más el letrero y el subtítulo. Ninguno se lee completo. | Regla «la cuenta en pantalla desde el cuadro 0» sin lugar reservado para cada cosa. | 3 |
| 5.5–7.2 | sincronía | «trescientos. Mira su» y luego «letrero: ayer no»: «Mira su» sale 1.2 s antes y queda separado de «letrero». | Subtitulos.tsx:76–81 **[sigue]** | 2 |
| 6.7–8.1 | coherencia | Brinco de tiempo sin aviso: la pila se llena de golpe y desaparecen «$300» y la promesa. «AYER» no aparece hasta 1.4 s después (8.06). | Escaleta: la pila 15 va en «Mira su letrero» y la pastilla «AYER» en «ayer no prometía». | 2 |
| 6.7–7.7 | coherencia | La voz dice «Mira su letrero» y el letrero («$10 c/u») no hace nada. La promesa, que es de lo que se está hablando, se quita justo en ese momento. | Escaleta, más la falta de un evento para señalar algo. | 2 |
| 6.5–9.4 | encimado | «100 naranjas» tapa la frente y los ojos de Don Chuy (solo se le ve el bigote). | Ancla `pila` (420,390). **[sigue]** | 2 |
| 10.5, 20.0 | encimado | Los billetes que llegan a la lata tapan las caras de los vecinos. | Igual que en el 12. | 1 |
| 11.0–13.4 | encimado | «$500» pisa la visera. | Ancla `lata`. **[sigue]** | 1 |
| 12.5–13.0 | encimado | Los billetes que van a la camioneta cruzan la cara de Don Chuy. | Arco de 180. **[sigue]** | 1 |
| 13.5–15.9 | coherencia | «Cobra $500» sigue ahí con la lata en «$0», ya pagado. | Escaleta. | 2 |
| 15.9–20.4 | coherencia | Empieza HOY: la carita contenta con «$0» rojo y grande en la lata durante 4.5 s. Nada dice «HOY» para oponerlo a «AYER». | Escaleta: el `$0` va `hasta_en: "toda la mesa"` y no hay pastilla «HOY». | 2 |
| 10.4–11.7, 19.9–21.3 | sincronía | «mesa. Llegó la» (1.3 s antes) y «la mesa. Dos» (1.4 s antes). | Subtitulos.tsx:76–81 **[sigue]** | 2 |
| 21.5–24.9 | quién habla | El globo «Salió agria» del vecino 1 sale arriba de la lata y su colita apunta al hueco entre la lata y el vecino 0. | La colita no apunta al hablante. | 1 |
| 23.0–24.9 | encimado | Otra vez el globo «Te la cambio» de Don Chuy queda debajo de la pastilla «2 cambiadas, gratis». En 23.0, mientras la pastilla aparece, los dos textos se transparentan uno sobre otro y no se lee ninguno. | Globo (400,300) contra `centro` (500,250). **[sigue]** | 3 |
| 21.3–23.1 | encimado (lo mete b0db081) | No se ve en estas hojas, pero con el código actual el globo 1 (860,290) mide x 702–1018 × y 244–328 y choca con la pastilla «Si sale agria, te la cambio» (x 97–903, y 210–288). Además se sale del lienzo (x>1000 equivale a unos 915 px de pantalla) y cae en la columna de botones de la app (x>900). | ElPuesto.tsx:216, sin tope al borde. | 2 |
| 25.5–30.0 | texto que se sale | La frase memorable «La promesa que cuesta, es la que se cree.» no cabe en la banda de 820: en pantalla se lee «a promesa que cuesta, es la que se cree.», con la «L» cortada por el borde izquierdo y la frase pegada al borde derecho. | ElPuesto.tsx:234–235: `fontSize 62` fijo y sin partir en 2 líneas. 41 caracteres dan unas 1,470 unidades. **[sigue]** | 3 |
| 25.0–29.8 | sincronía | «sobró. No le», «faltaban naranjas: le», «creyeran. Y tú,»: el remate y la pregunta CTA quedan mezclados en el mismo bloque. | Subtitulos.tsx:76–81 **[sigue]** | 2 |
| 30.0–35.5 | CTA | Mismo caso que en el 12: fantasma de la camioneta, la mesa y los vecinos detrás; la flecha sobre la mesa; la pregunta a 55 px; el pie de 36 caracteres a 39 px. «cliente? Mándaselo al» cruza oraciones. | ElPuesto.tsx:239–248 y Subtitulos. | 2 |

---

## Patrones (lo que se repite en los dos capítulos)

1. **El subtítulo cruza el punto.** Es lo que ian percibe como «desincronizado». Con bloques de 3 palabras que solo se cortan en silencios de más de 1.5 s, **4 de 30 bloques en el 12 y 9 de 30 en el 38** (simulado sobre `words.json` con la misma lógica de Subtitulos.tsx) muestran la primera palabra de la oración siguiente entre 0.4 y 1.5 s antes. Casi siempre es la palabra que carga el sentido: «Si», «No», «Mira su», «Dos», «Y tú». Además los bloques de 3 parten frases en pedazos sin sentido («y se», «a su casa», «le», «mi / Don Chuy»).
2. **Cinco anclas se pelean la misma franja.** El centro (y 250), los globos (y 290–460), la pila (y 390) y la lata (y 482) se amontonan sobre y 210–530, justo encima de la cabeza de Don Chuy (y 384–512). De ahí salen todos los encimados: pastilla sobre cara, pastilla sobre globo, globo sobre globo. No hay nada que revise cajas contra cajas; lo que se usa es subir a mano una coordenada (b0db081), y eso arregla un choque y abre otro.
3. **La pastilla «centro» se usa como pizarrón.** Lleva oraciones enteras («Si le pagan todas: le quedan $500», «Si sale agria, te la cambio») a 39 px, flotando en el cielo. Además solo guarda UNA cifra: cada una borra a la anterior, así que **las dos cifras de la cuenta nunca se ven juntas** (lo que tendría contra lo que tiene; AYER contra HOY).
4. **Todo el texto dibujado es chico.** El subtítulo mide 76 px. En cambio: pastillas 33–39 px (grandes, hasta ~48), globos 35 px en Caveat (con x-height baja, se ven de unos 25), letrero 37, frase 52, pregunta CTA 55, pie CTA 39, «GAIA PRIME» 29, «$100» del billete 20 (ilegible), «PROVEEDOR» 22.
5. **Los billetes vuelan sobre las caras.** El arco de 180 cruza la cabeza de Don Chuy (de la lata a la camioneta) y la de los vecinos (de los vecinos a la lata).
6. **«Cobra $500» se queda después de cobrar**, en los dos capítulos (unos 5 s en el 12 y unos 2.5 s por día en el 38).
7. **«Mira la lata» / «Mira su letrero»**: la voz señala algo que en ese momento no cambia ni se ilumina.
8. **Espacio muerto**, igual en los dos y durante TODO el video:
   - **y 920–1150 px** (12 % del alto): banqueta vacía entre el piso del puesto (y≈917) y la banda de subtítulos. Está dentro de la caja segura y siempre libre.
   - **Banda de subtítulos, y 1150–1400**: 250 px, de los que el texto usa unos 90 (una línea). Sobran unos 160.
   - **y 1400–1920** (27 %): negro. Desde y=1440 lo tapa la interfaz de la app, pero y 1400–1440 sigue siendo seguro.
   - **Arriba, y 220–540**: cielo y fachadas, que solo se usan cuando hay pastilla o frase.
   - Suma: **cerca del 45 % del cuadro no lleva información nunca**, y el puesto (el dibujo que cuenta la historia) mide apenas unos 380 px de alto (y 540–917).
   - En la tarjeta CTA (unos 6 s en cada capítulo) el cuadro entero queda como un fantasma oscuro.

---

## Propuesta del espacio («auxiliar visual: no pizarrón, pero sí»)

### Opción A — La libreta de Don Chuy ✅ (elegida)
Una hojita de libreta de papel (crema, renglones azules, margen rojo, letra Caveat, la misma familia del letrero y los globos) apoyada en la banqueta, debajo del puesto. **Va escribiendo la cuenta renglón por renglón en el instante en que pasa**: cuando aterriza el último billete, cuando la voz dice la cifra. Es la tesis de la serie hecha dibujo: *anotar es ver*. Y como se queda escrita, **las dos cifras que se comparan quedan juntas en pantalla**, que es justo lo que hoy se pierde.

### Opción B — La recta de la lata
Una barra horizontal de $0 a $1000 donde cada flujo de billetes pinta un tramo: verde lo cobrado, ámbar lo que se lleva el proveedor, gris punteado lo fiado. Sirve para comparar AYER contra HOY con dos barras. Contra: es más pizarrón que dibujo, y para quien nunca vio una gráfica pide leer escala. La descarto como principal; queda como variante de un renglón para comparativos.

### Opción C — El mostrador de billetes
Una fila de billetitos rojos en la banqueta que refleja la lata: cada billete que entra se suma a la fila, el que se va sale volando de ahí y el fiado queda como naranja con «?». Es cero lectura y muy de dibujito. Contra: no dice QUÉ es cada cosa («proveedor», «fiado»), y con más de 10 billetes ya no se cuenta de un vistazo. Tomo de aquí el ícono de billete para el margen de los renglones de la libreta.

### Detalle de la elegida (A)

**Qué la alimenta (sin reescribir los 60 capítulos):**
1. **`billetes` (automático).** Cada evento produce un renglón con signo y cantidad (`n × $100`, que ya es la convención: 1 billete = $100). El renglón aparece cuando aterriza el último billete: `e.t + (n-1)·paso + VUELO`, el mismo instante que el `golpe` de la lata. Así queda **sincronizado por construcción** con lo que se ve. La etiqueta sale del par `de→a`:
   - vecinos→lata: `+ $500 cobró`
   - lata→camion: `− $500 proveedor`
   - lata→casa: `− $N a la casa`
   - lata→vecinos: `− $N devolvió`
2. **Saldo (automático).** Debajo, una línea subrayada `= Lata $X` con la suma de la hoja. `escaleta.py` compara ese saldo con cada `cifra donde:"lata"`: si no cuadran, avisa. Es un portero de coherencia gratis: la lata dibujada tiene que decir lo que la libreta suma.
3. **Hoja nueva (automático).** Un evento `pila` con n=15 después de t>0 abre una hoja en blanco. En el 12 pasa en «Mira la lata» y en el 38 en «Mira su letrero» y en «Hoy prometió cambiar». Así el rebobinado se VE. Con un campo opcional `"hoja": "AYER"` / `"HOY"` en ese evento, el título queda arriba del renglón 1. Eso arregla el brinco sin aviso del 38 (6.7–8.1 s) y el HOY que falta.
4. **Las cifras de texto se mudan a la libreta (automático).** Las `cifra` con `donde:"centro"` y `donde:"pila"` dejan de flotar en el cielo y entran como renglón de texto («100 naranjas», «Si le pagan todas: $500», «Fiado: $500», «2 cambiadas, gratis»). Con eso **desaparecen los encimados sobre la cara de Don Chuy y sobre el globo de Don Chuy** (patrón 2), sin tocar coordenadas. Las de `lata` y `camion` (≤5 caracteres) se quedan en la escena como pastillas cortas.
5. **Lo que no sale de un flujo (opcional).** Un campo `"anota": "texto"` en cualquier evento. Ejemplo en el 12: `{"en":"se fue fiada", "tipo":"salen", ..., "anota":"8 fiadas: $0"}`. Los capítulos que no lo usan igual reciben 1 a 4.

**Dónde va (lienzo de ElPuesto, dentro del mismo `<svg>`):**
- Hoja: x 110–890, y 848–1095. En pantalla son unos x 152–808, y 932–1140 px, o sea toda la banqueta muerta, sin tocar el puesto (el piso de todo acaba en y≈830: patas, ruedas, vecinos, sombras).
- Si hay que hacer lugar a la casita, se usa `CASA` en (150,900). Ocupa x 64–236 y 758–956 y choca con la esquina izquierda de la libreta, así que con `casa` presente la hoja se recorre a x 270–890 (o la casita pasa a y 780). Con `basura` (770, 822) no choca.
- Tamaño: renglones a 62 unidades de alto, con Caveat de 54 unidades (unos 45 px; la de los globos queda en unos 35). **Máximo 3 renglones más el saldo.** Cuando entra el cuarto, los de arriba suben y se desvanecen, como una libreta que se va llenando.
- Animación: cada renglón se «escribe» de izquierda a derecha con un `clipPath` que avanza en 0.35 s. El saldo hace el mismo «pop» (spring) que ya usan las pastillas. Todo es función pura de T, igual que el resto de ElPuesto.

**Cómo evita chocar con los subtítulos:**
- La banda empieza en y=1150 px, que es la unidad 1107 del lienzo. La hoja termina en 1095: le quedan 12 unidades de aire contra la CAJA de la banda y unos 90 px contra la primera línea del texto, que va centrado en y≈1275.
- Además (arreglo 1 de la lista de abajo) el subtítulo pasa a cortarse en el punto. Así no hay bloques de 2 líneas que crezcan hacia arriba sin necesidad.
- Nada nuevo en y>1400 ni en la columna derecha (x>900 px): el `lado` del SVG ya respeta `contenido` de tokens.json.

**En la tarjeta CTA:**
- La libreta **no se apaga**: se dibuja DESPUÉS de la capa oscura de 0.82, con la última hoja completa (por ejemplo, en el 12: `+ $500 cobró / − $500 proveedor / Fiado: $500 / = Lata $0`).
- Debajo se agrega **un renglón en blanco con la pregunta como etiqueta**, que sale del texto de la `cta`: «Tu fiado: $______», con un cursor que parpadea. La flecha ámbar baja desde ese renglón hacia los comentarios, en vez de rebotar sobre la mesa fantasma.
- La pregunta sube a y≈330 y crece a 76 (el mismo tamaño que el subtítulo). La capa oscura sube a 0.92 para que no se vea el fantasma. Así el CTA ya no es una pregunta suelta sino **«ahora anota el tuyo»**: el que comenta está llenando SU libreta. Es la misma tesis y amarra el puente a GAIA (la libreta es el ERP en chiquito).

---

## Arreglos ordenados por impacto/esfuerzo

| # | Qué | Dónde | Impacto | Esfuerzo |
|---|---|---|---|---|
| 1 | **Cortar el bloque del subtítulo en la puntuación de oración.** En el bucle: `if (/[.?!:…]$/.test(w.palabra)) cerrar();` después de `grupo.push(w)`. También cortar cuando el hueco sea de más de 0.45 s (hoy 1.5; el comentario de la cuenta atrás del quiz sigue valiendo porque 0.45 < 1.5). Sube `max_palabras_visibles` de 3 a 4 para que no queden bloques de 1 palabra. Quita los 13 adelantos de 0.4 a 1.5 s, incluidos el «Si» y el «No» que cambian el sentido. | `render/src/lib/Subtitulos.tsx:76-81`; `pipeline/escaleta.py:90` | Alto (los 60 capítulos y todas las series) | 10 min |
| 2 | **La frase memorable nunca se sale.** Tamaño de letra según el largo: `fs = Math.min(62, 1500/len)`. Si queda por debajo de 44, partir en 2 `<tspan>` por la coma y crecer el rect a 190 de alto. | `ElPuesto.tsx:232-236` | Alto (el payoff del 38 hoy dice «a promesa») | 15 min |
| 3 | **La libreta (opción A)**: componente `Libreta` en naranjas.tsx, más un reductor `renglones(evs, T)` en ElPuesto que lee `billetes`/`pila`/`cifra centro|pila`/`anota`. Las `cifra` de `centro` y `pila` se redirigen a la libreta. | `naranjas.tsx` (nuevo componente), `ElPuesto.tsx:166-230` | Muy alto: usa el 12 % muerto, elimina 4 de los 5 tipos de encimado y deja la cuenta completa a la vista | 2–3 h |
| 4 | **Portero de encimados.** Función pura `cajas(T)` que devuelve el bbox de cada pastilla, globo, frase, cabeza de Don Chuy y cabeza de vecino. Con `?debug=cajas` los pinta en rojo, y `escaleta.py` (o un script node) recorre T cada 0.1 s y falla si dos cajas de texto se cruzan o si una tapa una cara. Esto sustituye el «subir una coordenada a mano». | `ElPuesto.tsx` + script de QA | Alto (evita que vuelva a pasar) | 1–2 h |
| 5 | **Globos**: limitar x a `[ancho/2+10, 990−ancho/2]` (arregla el globo 1 que se sale y cae en los botones), y que la colita apunte al que habla: prop `haciaX` en `Globo`, con el triángulo inclinado hacia vecino 0/1 (850/945) o hacia Don Chuy (540). Mientras el centro siga en el cielo (si no se hace el 3), el globo `chuy` baja a (330, 330) o el `centro` sube a y=200. | `ElPuesto.tsx:216`, `naranjas.tsx:171-181` | Medio | 30 min |
| 6 | **Arcos de billetes por encima de las cabezas**: `alto` de 320 para lata→camion (el vértice queda en y≈216, arriba de la gorra en 384) y salida de los vecinos desde la bolsa (y 720), no desde la cara (650). | `ElPuesto.tsx:79,86,156` | Medio | 10 min |
| 7 | **Ancla de la lata fuera de la visera**: `lata` → `{x: LATA.x + 35, y: LATA.y − 150}`. | `ElPuesto.tsx:91` | Bajo-medio | 2 min |
| 8 | **Tamaños mínimos**: pastilla 46→56, globo 40→50 (y ancho `len·22+70`), pregunta CTA 66→76, pie 46→52, capa CTA 0.82→0.92. | `naranjas.tsx:178,191`; `ElPuesto.tsx:241-243` | Medio | 10 min (revisar que nada se salga, por eso va después del 4) |
| 9 | **Escaletas**: «Cobra $500» → nueva `cifra camion "Cobró $500"` justo después del vuelo de billetes (12 y 38; probablemente todos los capítulos con proveedor). En el 12, un solo globo «¡Mañana te pago!», o dos textos distintos («¡Mañana te pago!» / «¡Yo el lunes!»). En el 38, `hoja: "AYER"`/`"HOY"` y la pila 15 en la misma ancla que «AYER». | `projects/economia/negocio/*/escaleta.json` | Medio | 20 min por capítulo (se puede hacer con un script) |
| 10 | **Señalar lo que la voz nombra** («Mira la lata», «Mira su letrero»): evento nuevo `{"tipo":"senala","donde":"lata"}` con un pulso de escala y un halo de 0.6 s sobre el objeto. | `ElPuesto.tsx` + `docs/plantillas/ElPuesto.md` | Bajo-medio | 30 min |
| 11 | **Re-render** del 38 (y de los capítulos hechos antes de b0db081) después del 1, 2 y 5. Confirmar con ffmpeg `-ss` exacto que el desfase de ~0.2 s de las hojas es de la extracción y no del mp4. | render en iangpu | — | — |

**Mi orden recomendado:** 1 → 2 → 7 → 6, que son 40 minutos y quitan lo que ian llamó «desincronizado». Luego 3 → 4, que es lo que convierte el espacio muerto en la libreta y acaba con los encimados. Después 5, 8 y 9.
