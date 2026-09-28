# Informe v4b: confirmación de la ronda 2 (Don Chuy 29 y 38)

**Método.** Revisé las 12 hojas nuevas (v4b-29 y v4b-38). Del `short.mp4` (2160×3840) saqué cuadros exactos reescalados a 1080 de ancho y los recorté en la libreta, el gancho y el CTA. Los recortes están en `qa/z6/`: `h29a/b`, `h38a–d`, `cta29`, `cta38` y `p29`. No toqué el repo.

| # | punto | veredicto | evidencia (t) |
|---|---|---|---|
| 1a | Tachado en general | **resuelto** | En ningún cuadro de los dos capítulos hay tachado rojo. |
| 1b | 38: «Si sale agria, te la cambio» a tinta completa | **parcial** | No se tacha. Pero pasa a **gris** justo cuando se cumple (23.0–25.2) y a los 25.5 sale de la hoja por arriba. En el CTA ya no aparece. Se lee como renglón viejo, no como promesa rota. No estorba, aunque tampoco queda «a tinta completa». |
| 1c | 29: «Abrió 2 horas antes» y «2 horas» sin tachar | **resuelto** | 8.5–13.5: «Abrió 2 horas antes» (gris), «2 horas» y «2 horas · $0», los tres enteros. «2 horas · $0» ya no se pierde. |
| 2 | 29: globo contra pastilla en el gancho | **resuelto** | 0.5–3.5: «Su hora: $50» quedó a la izquierda y los dos globos a la derecha, sin tocarse. Se leen los tres. |
| 3 | Tamaño de letra de la libreta y grises | **resuelto** | Sobre 1080 los renglones miden unos 40 px de alto y «Queda $X» unos 45 px. Se leen en el teléfono. Los grises (29: 19–24; 38: 24–30) se leen en 1080, con contraste bajo pero suficiente. |
| 4 | 38: se apaga «Cobra $500» | **resuelto** | AYER: se ve en 12.5–13.5 y ya no está a los 14.0. HOY: se ve en 24.0–25.0 y ya no está a los 25.5. |
| 5a | 4.º renglón cortado | **resuelto** | Abajo ya no asoma ninguno. Arriba, el renglón que sale se ve cortado 0.3 s mientras se enrolla (29: 14.0). Es normal. |
| 5b | «Queda» a destiempo | **parcial (leve)** | AYER 14.0: cambia junto con el «−» del renglón (bien). HOY 25.2: «$300» ya se está escribiendo y «− $500» empieza a los 25.5, unos 0.3 s después. Aceptable. |
| 5c | Aire entre la libreta y el pie del CTA | **resuelto** | 38 a los 33.0: unos 40 px entre la libreta y «Mándaselo al que…», que ya no se lee como «manda los $300». |
| 6 | 38: hoja nueva «CUENTA · AYER» / «CUENTA · HOY» y lata sin cifra vieja | **resuelto** | AYER: el título sale a los 7.0 y el cambio es limpio (6.6 → 7.0, sin escritura encimada). HOY: el título sale a los 16.0. La lata va sin pastilla de 16.0 a 20.4 y «$800» llega con los billetes. Ya no hay «$0» rojo con la carita contenta. |
| 7 | Subtítulos: bloques de 1 palabra o que cruzan puntuación | **resuelto** | Ningún bloque de 1 palabra en los dos: los más cortos son «Sí o no,», «y su lata» y «así le sobró.». Ninguno cruza `.` `?` `!` ni `:`. Solo cruza coma o «¿» en «Y tú, ¿le…», que la ronda anterior ya había aceptado. Revisé cada 0.5 s, así que un bloque de menos de 0.5 s pudo quedar sin ver. |

## Defectos NUEVOS

| # | sev | t | qué se ve | causa probable y arreglo |
|---|---|---|---|---|
| **R1** | **2** | 29: 8.0–13.5 y 15.0–CTA | **Renglones repetidos.** Como ya no se tacha, cada cifra que «crece» se escribe en un renglón nuevo. La libreta queda así: «2 horas / 2 horas · $0», y luego «2 horas × $50 / 2 horas × $50 = $100 / 0 vendidas». El CTA del 29 muestra ese «2 horas × $50» repetido. La cuenta es correcta, pero se ve torpe, y el mismo patrón va a salir en todos los de los 70 que encadenan `cifra centro`. | En `hojasEn`: si el texto nuevo **empieza con** el anterior (lo extiende), reescribir **el mismo renglón**, sin tachar y sin abrir otro. Si es distinto, renglón nuevo, como ya funciona. |
| R2 | 1–2 | 29: 19.0–24.5 | **La jerarquía de gris sale al revés.** El renglón clave «2 horas × $50 = $100» se apaga a gris, mientras «2 horas × $50», que es la mitad, sigue en tinta. De 23.0 a 24.5 «0 vendidas» también queda gris. En el CTA vuelven a tinta. | Se arregla sola con R1: desaparece el renglón duplicado y el que queda es el completo. Si no, que el gris nunca caiga en el último renglón con «= $». |
| R3 | 1 | 29: 10.0–12.0 | La pastilla «A su hora de siempre» (que además repite la voz) queda pegada encima de «Su hora: $50»: los bordes se tocan. Se leen las dos. De 9.5 a 10.0 el globo «Ya vine, Don Chuy» roza la esquina de «$0». | Subir la pastilla unos 20 u, o poner `renglon:false` en la escaleta y quitarla. Opcional. |

No encontré texto fuera de su caja ni caras tapadas. Todos los renglones cuadran con la cuenta:
- 38 AYER: +500 − 500 = $0.
- 38 HOY: +800 (2 cambiadas gratis) − 500 = $300.
- 29: 2 × 50 = $100 y 0 vendidas, queda $0.

## DICTAMEN: **FALTA:** solo R1

Los 7 puntos de la lista quedaron resueltos. Hay dos parciales leves que no bloquean: el 1b (la promesa se pone gris al cumplirse) y el 5b (Queda se adelanta 0.3 s).

Lo único que yo arreglaría antes de rendir 70 capítulos es **R1**, porque se va a multiplicar. Es un cambio chico en `hojasEn`: si el texto nuevo extiende al anterior, se reescribe el mismo renglón. Con eso sale también R2.

Si se decide dejar R1 como está, la serie ya se entiende y es correcta: la daría por **LISTO PARA LOS 70**, sabiendo que en algunas libretas va a haber renglones repetidos.
