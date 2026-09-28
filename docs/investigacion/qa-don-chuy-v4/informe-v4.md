# Informe v4: QA visual de Don Chuy (29-dijeron-que-si y 38-si-sale-agria-te-la-cambio)

**Método.** Revisé las 12 hojas del ANTES y las 12 del v4. Como las hojas vienen reducidas unas 4 veces, además saqué del `short.mp4` del v4 (2160×3840) un cuadro cada 0.5 s reescalado a 1080×1920. Con eso armé hojas ampliadas de la zona de dibujo, libreta y subtítulos (`qa/z4/29-a-*.png`, `qa/z4/38-a-*.png`), recortes de la frase (`qa/z4/*-frase.png`) y un cuadro completo 1:1 (`qa/z4/29-full-17.5.png`). Crucé todo contra `words.json`, contra la escaleta (idéntica a la del ANTES en los dos capítulos) y contra el código actual de `lia-video-engine`. No toqué el repo.

**Aviso importante: el v4 que se ve en los mp4 NO es el código actual.**
- `Subtitulos.tsx` se modificó a las 18:02, después de los dos mp4 (29 a las 17:49 y 38 a las 18:01).
- `ElPuesto.tsx` se modificó a las 17:50, después del mp4 del 29.
- Lo comprobé con los propios cuadros. Los bloques que aparecen en pantalla («trescientos.», «gratis.», «sobró.», «nada.» y «abajo.» sueltos) coinciden con la versión anterior del partidor: corta hasta 5 palabras y lo que sobra queda solo. El código de hoy reparte la frase en bloques parejos; simulé ese reparto sobre `words.json` y ya no queda ninguna palabra suelta.
- Conclusión: hay que volver a rendir estos dos capítulos antes de dar por buenos los subtítulos.

---

## 1. Defectos de la ronda anterior: antes contra después

### 38 (informe A)

| defecto | antes (t) | después v4 (t) | veredicto |
|---|---|---|---|
| La pastilla «$300» tapa el globo «Salió agria» (el gancho) | 0–6.7 | 0–6.7: el globo se lee completo y la colita apunta al vecino 0 | **DESAPARECIÓ** |
| El globo «Te la cambio» queda debajo de la pastilla de la promesa | 2.3–6.7 | 2.5–6.7: globo arriba a la izquierda, entero, con la colita hacia Don Chuy | **DESAPARECIÓ** |
| Cuadro 0 saturado (4 textos que no se leen) | 0 | 0: globo, «$300» y letrero en la escena, y la promesa y «Queda $300» en la libreta. Todo se lee | **DESAPARECIÓ** (ver la nota 1 de la sección 2) |
| «trescientos. Mira su» cruza el punto | 5.5–7.2 | «trescientos.» suelto en 5.5–6.6 | **CAMBIÓ**: ya no cruza, pero queda 1 palabra sola (con el código actual sale «cerró con trescientos.») |
| Brinco de tiempo sin aviso (AYER) | 6.7–8.1 | Se abre hoja nueva en 6.5 y aparece «AYER, sin promesa» en 8.0. Hay 1.4 s (6.5–8.0) sin que nada diga AYER | **MEJORÓ**, pero sigue en parte |
| «Mira su letrero» y el letrero no hace nada | 6.7–7.7 | igual | **SIGUE** |
| «100 naranjas» tapa la cara de Don Chuy | 6.5–9.4 | ahora es un renglón de la libreta | **DESAPARECIÓ** |
| Los billetes tapan las caras de los vecinos | 10.5, 20.0 | pasan por arriba de las cabezas (las rozan) | **DESAPARECIÓ** |
| «$500» pisa la visera | 11.0–13.4 | la pastilla toca el borde de la visera | **SIGUE, más leve** (el «$0» grande del 29 hace lo mismo en 6.0–9.0) |
| Los billetes que van a la camioneta cruzan la cara de Don Chuy | 12.5–13.0 | van a la altura del pecho, sobre la pila | **DESAPARECIÓ** |
| «Cobra $500» sigue ahí ya cobrado | 13.5–15.9 | 13.5–15.5 y otra vez 25.0–29.9, con la lata ya descontada | **SIGUE** |
| HOY arranca con «$0» rojo y carita contenta, sin decir HOY | 15.9–20.4 | 16.0–20.4 igual. Además la libreta queda EN BLANCO 16.0–16.9 y sin «Queda», mientras la lata dice «$0» | **SIGUE** |
| «mesa. Llegó la» / «la mesa. Dos» cruzan el punto | 10.4–11.7, 19.9–21.3 | — | **DESAPARECIÓ** |
| La colita del «Salió agria» del vecino 1 no apunta a nadie | 21.5–24.9 | apunta al vecino 1 | **DESAPARECIÓ** |
| «Te la cambio» debajo de «2 cambiadas, gratis» | 23.0–24.9 | el globo se lee entero | **DESAPARECIÓ**, pero sale un defecto nuevo en la libreta (N1) |
| El globo 1 se sale del lienzo o choca | 21.3–23.1 | dentro de la caja, sin choque | **DESAPARECIÓ** |
| La frase se sale («a promesa…») | 25.5–30.0 | 2 líneas, banda con borde ámbar, completa | **DESAPARECIÓ** |
| Remate y CTA en el mismo bloque de subtítulo | 25.0–29.8 | — | **DESAPARECIÓ** |
| CTA: fantasma, flecha sobre la mesa, texto chico | 30.0–35.5 | pregunta en 2 líneas (~64 px), libreta, pie (~44 px), flecha, GAIA PRIME. Quedan fantasmas tenues: el rótulo «PROVEEDOR» a la izquierda y la cara de Don Chuy detrás de la pregunta | **MEJORÓ MUCHO**; los fantasmas leves siguen |

### 29 (informe C)

| defecto | antes (t) | después v4 (t) | veredicto |
|---|---|---|---|
| «$0» tapa el globo «Yo sí te compro» | 0–3.9 | se lee completo | **DESAPARECIÓ** |
| «Su hora: $50» le come la «Y» a «Yo también le compro» | 0.5–3.9 | **ahora es al revés**: el globo tapa la pastilla y solo se lee «Su hora», sin la cifra | **CAMBIÓ DE FORMA** (N3, sev 2) |
| «Abrió 2 horas antes» y «Su hora» se traslapan | 0–5.9 | «Abrió…» ya vive en la libreta | **DESAPARECIÓ** |
| 6 textos a la vez en el gancho | 0–3.9 | 2 globos y 2 pastillas en la escena, más la libreta aparte | **MEJORÓ** |
| «2 horas» medio escondida detrás de «Su hora» | 7.0–8.0 | en la libreta | **DESAPARECIÓ** |
| «2 horas · $0» tapa «Su hora» | 8.5–10.0 | en la libreta | **DESAPARECIÓ** |
| «Ya vine, Don Chuy» tapado por «$0» y dura 0.84 s | 9.5 | se lee, pero sigue durando 0.84 s (9.34–10.18) | **MEDIO**: ya no está tapado, sigue siendo demasiado corto |
| «A su hora de siempre» repite el subtítulo | 10.0–11.8 | 10.5–13.5 en la libreta, repitiendo la voz, y **además borra «2 horas · $0»** | **SIGUE Y EMPEORA** (N2) |
| «siempre. Fíjate en» cruza el punto | 11.8 | — | **DESAPARECIÓ** |
| Torre de pastillas sobre Don Chuy | 14.0–18.9 | la libreta la resuelve: «2 horas × $50 = $100 / 0 vendidas» | **DESAPARECIÓ** (el mejor momento del v4) |
| «0 vendidas» tapa la cara justo cuando se pone triste | 16.5–21.5 | cara libre, renglón en la libreta | **DESAPARECIÓ** |
| «igualita. Nadie» cruza el punto | 17.0–19.0 | — | **DESAPARECIÓ** |
| La frase toca el borde | 21.5–24.2 | 2 líneas, cabe | **DESAPARECIÓ** |
| «cuesta. Y» cruza el punto | 22.5–24.2 | — | **DESAPARECIÓ** |
| CTA cortado («e crees a…») | 24.5–30.0 | completo y en 2 líneas | **DESAPARECIÓ** |
| «que sí? Sí» cruza el punto | 26.5–27.5 | — | **DESAPARECIÓ** |
| CTA amontonado, con la flecha sobre la mesa | 24.5–30.0 | ordenado, con la libreta en medio | **DESAPARECIÓ** |

**Balance:** de 37 defectos, 25 desaparecieron, 4 mejoraron, 5 siguen, 2 cambiaron de forma y 1 empeoró.

---

## 2. Defectos NUEVOS que metió el v4

| # | sev | t | qué se ve | causa | arreglo |
|---|---|---|---|---|---|
| **N1** | **3** | 38: 23.0 · 29: 7.0 y 8.0 | **El tachado dice lo contrario de la historia.** En el 38, cuando llega «2 cambiadas, gratis», la promesa «Si sale agria, te la cambio» **se tacha en rojo**. Se lee como «rompió la promesa», y el capítulo cuenta que la cumplió. En el 29, «Abrió 2 horas antes» se tacha para escribir «2 horas», y luego «2 horas» se tacha para escribir «2 horas · $0». Parecen correcciones de errores que nunca hubo. | `ElPuesto.tsx` `hojasEn` (líneas 186-203): cualquier `cifra` nueva en el mismo `donde` con otro texto se agrega como versión y la vieja se tacha. Las escaletas usan «centro» como un lugar de texto que avanza, no como una cifra que se corrige. | Por defecto, un texto distinto en el mismo lugar **abre renglón nuevo** (máximo 3, los viejos se enrollan). Que tache solo si el evento lo pide (`"corrige": true` o algo así). Actualizar `docs/plantillas/ElPuesto.md` (§ Contexto). |
| **N2** | 2 | 29: 10.0–13.5 | **La libreta pierde la cuenta.** «2 horas · $0», lo que el capítulo quiere dejar escrito, se borra para escribir «A su hora de siempre», que repite la voz palabra por palabra. En 10–14 s la libreta tiene 1 renglón y ese renglón no es cuenta. | Mismo mecanismo que N1 (un solo renglón por `centro`), más la escaleta del 29. | Con el arreglo de N1 ya no se borra. Además, en la escaleta del 29, a la cifra «A su hora de siempre» ponerle `"renglon": false` o quitarla (el propio `escaleta.py` ya avisa de las cifras que repiten la voz). |
| **N3** | 2 | 29: 0.3–3.4 | El globo 1 «Yo también le compro» **tapa la cifra de «Su hora: $50»** en el gancho: solo se lee «Su hora». | La regla «los globos encima de las pastillas» arregla un choque y abre el opuesto. Nada compara las cajas de globo y pastilla entre sí: `CAJA` solo cuida los bordes del lienzo. | Hacer el portero de cajas que proponía el informe A (#4): globo contra pastilla y contra la cara, que el más nuevo se recorra. Como mínimo, subir o correr a la derecha `POS_GLOBO["1"]`, o mover `anclaCifra("chuy")` para que no se crucen. Esto va a salir en muchos de los 70: todo capítulo con pastilla en `chuy` y dos globos. |
| **N4** | 2 | todo el video | **La letra de la libreta es chica para un teléfono.** Los renglones van en Caveat 40 u, unos 30 px en 1080 (el subtítulo mide 76). «Queda» va a unos 25 px. Los renglones en gris (op. baja) son casi ilegibles incluso en 1080 (29: 19–24 s; 38: 10–11 s y 25–30 s). En el celular «2 horas × $50 = $100» se lee solo si uno se acerca. Además la libreta usa ~60 % del ancho y en el 29 casi siempre tiene 1 renglón: mucho papel vacío. Siguen libres ~150 px entre la libreta (acaba en ~1060 px) y el subtítulo (~1210 px). | `naranjas.tsx:303` `LETRA_LIBRETA = 40`, `:411` «Queda» 34, opacidad del gris. | Subir `LETRA_LIBRETA` a ~50 (el autoajuste de la línea 370 sigue protegiendo los renglones largos), «Queda» a ~40, el gris a opacidad ≥ 0.6. Si no caben 3 renglones en `ALTO_LIBRETA = 145`, bajar a 2 renglones más el Queda. Al CTA le queda bien la escala 1.25 que ya tiene. |
| **N5** | 2 | 38: 5.5, 14.5, 25.0, 35.0 · 29: 29.5 | Bloques de 1 palabra: «trescientos.», «gratis.», «sobró.», «nada.», «abajo.». «gratis.» dura 1.3 s sola. | Render viejo (ver el aviso de arriba). | El `Subtitulos.tsx` actual (reparto parejo) los quita, simulado sobre `words.json`: 0 sueltas en los dos. **Volver a rendir y confirmar.** |
| **N6** | 1 | 29: 14.0 · 38: 6.5, 13.5, 30.0 | Transiciones de la libreta: el renglón nuevo se escribe **encima** del viejo mientras este se desvanece (29: «2 horas × $5» sobre «siempre»; 38: «10» sobre la promesa). El 4.º renglón asoma cortado por el borde de abajo (38: 13.5). En 38 a los 30.0, «PROVEEDOR» cae encima del rótulo «CUENTA» mientras la libreta sube al CTA. Cada uno dura ≤ 0.5 s. | Clip y corrimiento de la libreta. | Que el viejo termine de irse antes de que empiece a escribirse el nuevo (0.2 s). Recortar el renglón que entra con `clipPath` a la hoja, que ya existe. |
| **N7** | 1 | 38: 11.0, 13.5, 20.5 | «Queda» cambia 0.3–0.5 s **antes** de que se escriba el renglón que lo explica (a los 13.5 dice «$0» con los billetes todavía en el aire y sin «− $500 proveedor»). | La `cifra lata` va anclada a la voz y el renglón de dinero al aterrizaje del último billete. | Que Queda tome `max(t de la cifra, aterrizaje del último billete pendiente)`. |
| **N8** | 1 | 38: 30.5–36 | El pie «Mándaselo al que nunca devuelve nada» queda pegado debajo de «Queda $300». Leído de corrido puede entenderse «manda los $300». | Poco aire entre la libreta y el pie. | +30 u de separación, o un separador. |
| **N9** | 1 | 38: 0–6.7 | Contra el ANTES, **la promesa (la premisa del 38) quedó más chica**: antes era la pastilla de arriba y ahora es un renglón de Caveat de ~30 px. El gancho lo siguen cargando los globos, así que no rompe el capítulo, pero pesa menos. | La regla «centro = renglón». | Se puede dejar así, o en el 38 marcar la promesa del cuadro 0 con `"renglon": false` para que siga siendo pastilla (la escena ya tiene lugar para ella). |

---

## 3. La libreta

**¿Aparecen los renglones cuando la voz lo dice?** Sí, todos dentro de ±0.5 s:

| capítulo | renglón | ancla de la voz | aparece |
|---|---|---|---|
| 29 | «2 horas» | 7.08 | 7.5 |
| 29 | «2 horas · $0» | 8.22 | 8.5 |
| 29 | «2 horas × $50» | 13.84 | 14.0 |
| 29 | «= $100» | «cien» 15.42 | 15.5 |
| 29 | «0 vendidas» | 16.52 | 16.5 |
| 38 | «100 naranjas» | 6.68 | 7.0 |
| 38 | «AYER, sin promesa» | 8.06 | 8.0 |
| 38 | «+ $500 cobró» | aterrizaje | 11.5 |
| 38 | «− $500 proveedor» | aterrizaje | 14.0 |
| 38 | promesa de HOY | 16.92 | 17.0 |
| 38 | «+ $800 cobró» | aterrizaje | 21.0 |
| 38 | «2 cambiadas, gratis» | 23.1 | 23.0–23.5 |
| 38 | «− $500 proveedor» | aterrizaje | 25.0 |

**¿Lo que escribe es correcto y se entiende sin la voz?**
- **38: sí**, salvo N1. AYER: «+ $500 cobró / − $500 proveedor → Queda $0». HOY: «+ $800 cobró / − $500 proveedor → Queda $300». Es la cuenta del capítulo y se entiende sin audio. Lo que falta es el título «HOY»: la hoja nueva de las 16.0 llega en blanco.
- **29: a medias.** De 16.5 al CTA dice «2 horas × $50 = $100 / 0 vendidas / Queda $0», que es perfecto. Antes de eso cambia de texto 5 veces en el mismo renglón, tacha cosas que no eran errores y pierde «2 horas · $0» (N1 y N2).

**¿Se lee en el teléfono?** «Queda $X» y los renglones de dinero, apenas. Los renglones de contexto en gris, no (N4). En el CTA, a escala 1.25, sí.

**¿«Queda $X» cuadra con la lata?** Sí, en todos los cuadros: 29 siempre $0; 38 $300 → $500 → $0 → $800 → $300. Las dos hojas del 38 suman bien: 0 + 500 − 500 = 0 y 0 + 800 − 500 = 300. Solo hay dos desfases: N7 (Queda se adelanta 0.3–0.5 s) y la hoja HOY sin columna Queda en 16.0–20.4 mientras la lata dice «$0».

---

## 4. Subtítulos

- **Ningún bloque cruza `.` `?` `!` ni `:`** en los dos capítulos. Lo peor del ANTES (Si, No, Y, Mira su y Nadie adelantados) desapareció.
- **Bloques de 1 palabra en el render:** 38 → «trescientos.», «gratis.», «sobró.», «nada.»; 29 → «abajo.». Con el código actual (reparto parejo, máximo 5) la simulación da 0 sueltas. Por ejemplo, 38 cierra «Mándaselo al que | nunca devuelve nada.» y 29 cierra «Sí o no, | escríbelo aquí abajo.». Falta verlo en un render nuevo.
- Hay cortes todavía algo torpes pero aceptables, en comas: «Y tú, ¿le | devolverías el», «esas dos horas le | costaron…». No los cuento como defecto.
- Sincronía del resaltado contra `words.json`: dentro de ±0.2 s en todo lo revisado.

## 5. Cierre (CTA)

- **29:** «¿Le crees a un cliente que te dice que sí?» en 2 líneas; la libreta en tinta («2 horas × $50 = $100 / 0 vendidas | Queda $0»); «Sí o no · escríbelo aquí abajo»; flecha; GAIA PRIME. Legible y en orden. Fantasma apenas visible.
- **38:** «¿Le devolverías el dinero?» en 2 líneas; la libreta HOY completa; pie en 2 líneas, blanco, de unos 44 px. **«Mándaselo al que nunca devuelve nada» se lee bien**, con el matiz de N8. Fantasmas leves: «PROVEEDOR» a la izquierda y la silueta de Don Chuy. Hay un cuadro de transición en 30.0 donde se enciman libreta y escena (N6).
- En los dos, la pregunta de la tarjeta y la de la voz casi coinciden. Queda aire muerto entre GAIA PRIME (~1020 px) y el subtítulo (~1250 px), pero no molesta.

## 6. Sincronía (±0.5 s)

- Globos, 38: «Te la cambio» 2.54 → 2.5; «Salió agria» (1) 21.32 → 21.5; «Te la cambio» 22.90 → 23.0.
- Globos, 29: «Ya vine» 9.34 → 9.5.
- Pastillas: «$500», «$0», «$800» y «$300» caen en su palabra. «Cobra $500» también cae en su palabra, pero se queda de más.
- Renglones: ver la tabla de la sección 3.
- **Todo OK.** Las únicas excepciones son N7 y el «Ya vine» de 0.84 s.

---

## DICTAMEN: **FALTA** (poco, pero una cosa es grave)

El v4 es claramente mejor que el ANTES: 25 de 37 defectos desaparecieron, sin texto cortado, sin caras tapadas y con subtítulos que respetan la oración. La libreta del 38 y la del 29 desde 16.5 s son justo lo que se buscaba. Pero **no lo re-rendiría en los 70 todavía**:

1. **[sev 3] `render/src/scenes/ElPuesto.tsx`, `hojasEn`, líneas 186-203:** no tachar por defecto. Un texto nuevo en el mismo `donde` abre renglón nuevo; el tachado va solo si el evento lo pide (opt-in). Documentarlo en `docs/plantillas/ElPuesto.md`. Así, en el 38 la promesa cumplida deja de salir tachada en rojo y el 29 deja de perder «2 horas · $0». Revisar con grep las escaletas de los 70 que encadenan varias `cifra centro`: todas se tacharían hoy.
2. **[sev 2] Volver a rendir el 29 y el 38 con el código actual** (`Subtitulos.tsx` 18:02, `ElPuesto.tsx` 17:50, posteriores a los mp4) y repetir esta QA. Hay que confirmar que ya no hay bloques de 1 palabra y que lo que se cambió a las 17:50 no rompió nada.
3. **[sev 2] Choque globo↔pastilla** (29: el globo 1 tapa «Su hora: $50» en el gancho). `ElPuesto.tsx`: portero de cajas entre globos, pastillas y caras, o al menos recolocar `POS_GLOBO["1"]` o `anclaCifra("chuy")`. En los 70 se va a repetir en todo capítulo con pastilla en `chuy` y dos globos.
4. **[sev 2] Letra de la libreta:** en `render/src/dibujos/naranjas.tsx`, `LETRA_LIBRETA` 40→~50, «Queda» 34→~40, gris con opacidad ≥ 0.6. Si no caben 3 renglones, que sean 2 más el Queda.
5. **[sev 2] Escaletas del 29 y el 38** (y mismo patrón en los 70):
   - 29: «A su hora de siempre» → `"renglon": false` o quitarla.
   - 38: apagar «Cobra $500» cuando aterrizan los billetes. Mejor hacerlo genérico en `ElPuesto.tsx`: la pastilla de `camion` se apaga al aterrizar el último billete lata→camion, así no hay que tocar las escaletas.
   - 38: `cifra lata ""` en «Hoy prometió», para que no haya «$0» rojo con la carita contenta.
   - Opcional: título «HOY» en la hoja nueva (el `"hoja": "HOY"` que proponía el informe A).
6. **[sev 1] Pulido de la libreta** (`naranjas.tsx`/`ElPuesto.tsx`):
   - renglón nuevo solo cuando el viejo ya se fue;
   - recortar el 4.º renglón que asoma;
   - que «Queda» espere al aterrizaje;
   - +30 u entre la libreta y el pie del CTA.
   - El «Ya vine, Don Chuy» de 0.84 s del 29 se arregla en su escaleta (`hasta_en` más tardío).

Con 1 a 4 hechos y el re-render del 29 y el 38 limpio: **LISTO PARA LOS 70**. Lo 5 y 6 pueden ir en la misma pasada o después.
